import { allocateVoucherNumber } from 'db-unlistedstock';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from 'email-service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { NdpsGateway } from './ndps.gateway';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PinoNestLogger } from '@repo/logger';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PaymentService {
  private readonly logger = new PinoNestLogger('payments-service', 'PaymentService');
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
    @InjectQueue('payment-webhooks') private readonly paymentQueue: Queue,
    private readonly ndps: NdpsGateway,
  ) {}

  async createPaymentOrder(orderId: string, userId: string) {
    // Persist the reservation before NDPS so an ambiguous timeout cannot create duplicate payments.
    const reservation = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { user: true } });
      if (!order || order.userId !== userId) throw new NotFoundException('Order not found');
      if (order.status !== 'PENDING' || ['PAID', 'SUCCESS'].includes(order.paymentStatus)) throw new BadRequestException('Order is not payable');
      if (order.esignStatus !== 'SIGNED' || order.esignValidationVerdict !== 'MATCH') {
        throw new BadRequestException('A completed e-sign with a verified KYC identity match is required before payment');
      }
      const deadline = order.expiresAt ?? new Date(order.createdAt.getTime() + 86400000);
      if (Date.now() >= deadline.getTime()) throw new BadRequestException('This order has expired');
      if (order.user.kycStatus !== 'VERIFIED') throw new BadRequestException('KYC verification required before payment');
      if (!Number.isFinite(Number(order.totalAmount)) || Number(order.totalAmount) <= 0) throw new BadRequestException('Invalid order amount');
      const data = (order.paymentData as any) || {};
      if (order.cashfreeOrderId && data.gateway !== 'ndps') throw new BadRequestException('This legacy payment requires reconciliation before switching gateways');
      const existing = await tx.paymentAttempt.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
      if (existing && existing.status !== 'FAILED') {
        if (data.gateway !== 'ndps' || !existing.paymentSessionId || Date.now() - existing.createdAt.getTime() >= 15 * 60000) {
          throw new BadRequestException('Previous payment is awaiting confirmation. Check its status before trying again.');
        }
        return { existing: true, order, transactionId: existing.cashfreeOrderId, token: existing.paymentSessionId };
      }
      this.ndps.checkout('', order.user);
      for (const key of ['NDPS_PASSWORD', 'NDPS_PRODUCT', 'NDPS_REQUEST_KEY', 'NDPS_RESPONSE_KEY', 'NDPS_REQUEST_HASH_KEY', 'NDPS_RESPONSE_HASH_KEY']) this.ndps.required(key);
      const merchantTransactionId = `ND${crypto.randomUUID().replace(/-/g, '')}`;
      // Legacy column names are retained for historical rows and reporting.
      await tx.paymentAttempt.create({ data: { orderId, cashfreeOrderId: merchantTransactionId, paymentSessionId: '', amount: order.totalAmount, status: 'PENDING' } });
      await tx.order.update({ where: { id: orderId }, data: { cashfreeOrderId: merchantTransactionId, paymentStatus: 'PROCESSING',
        paymentData: { ...data, gateway: 'ndps', merchantTransactionId, initiatedAt: new Date().toISOString() } } });
      return { existing: false, order, transactionId: merchantTransactionId, token: '' };
    });
    const { order, transactionId } = reservation;
    const token = reservation.existing ? reservation.token : await this.ndps.createToken(transactionId, order, order.user);
    if (!reservation.existing) await this.prisma.paymentAttempt.update({ where: { cashfreeOrderId: transactionId }, data: { paymentSessionId: token } });
    const current = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (current.paymentStatus === 'PAID' || current.status !== 'PENDING') throw new BadRequestException('Order is no longer payable');
    return { ...this.ndps.checkout(token, order.user), orderId, merchantTransactionId: transactionId, amount: Number(order.totalAmount), currency: 'INR' };
  }

  async verifyPayment(dto: VerifyPaymentDto, userId: string) {
    let order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order || order.userId !== userId) throw new NotFoundException('Order not found');
    if (order.paymentStatus !== 'PAID' && (order.paymentData as any)?.gateway === 'ndps') {
      await this.reconcileOrder(order.id);
      order = await this.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    }
    return { success: order.paymentStatus === 'PAID', paymentStatus: order.paymentStatus, order: this.sanitizeOrder(order) };
  }

  async processWebhookPayload(payload: { body: any }) {
    // Verify again in the worker; queued data is not an authentication boundary.
    let p = this.ndps.decodeResponse(payload.body);
    const attempt = await this.prisma.paymentAttempt.findUnique({ where: { cashfreeOrderId: p.merchDetails.merchTxnId },
      include: { order: { include: { user: true, stock: true, basket: true } } } });
    if (!attempt || (attempt.order.paymentData as any)?.gateway !== 'ndps') throw new BadRequestException('Unknown NDPS transaction');
    if (!p.payDetails.signature) p = await this.ndps.status(attempt.cashfreeOrderId, Number(attempt.amount), attempt.createdAt);
    return this.applyNdpsResult(attempt, p);
  }

  private async applyNdpsResult(attempt: any, p: any) {
    const order = attempt.order;
    // The signature binds totalAmount; bind the base amount and surcharge as well.
    const base = Number(p.payDetails.amount), total = Number(p.payDetails.totalAmount), surcharge = Number(p.payDetails.surchargeAmount ?? 0);
    if (p.payDetails.txnCurrency !== 'INR' || !Number.isFinite(base) || !Number.isFinite(surcharge) || surcharge < 0 ||
        Math.round(base * 100) !== Math.round(Number(attempt.amount) * 100) ||
        Math.round(base * 100) !== Math.round(Number(order.totalAmount) * 100) ||
        Math.round(total * 100) !== Math.round((base + surcharge) * 100)) throw new BadRequestException('NDPS amount or currency mismatch');
    if (p.responseDetails.statusCode === 'OTS0000') {
      if (!/^\d+$/.test(String(p.payDetails.atomTxnId))) throw new BadRequestException('Missing NDPS transaction ID');
      await this.settleAttempt(attempt.id, order.id, String(p.payDetails.atomTxnId), order, attempt.cashfreeOrderId, {
        atomTxnId: String(p.payDetails.atomTxnId), merchantTransactionId: p.merchDetails.merchTxnId,
        bank_reference: p.payModeSpecificData.bankDetails.bankTxnId,
        payment_method: Array.isArray(p.payModeSpecificData?.subChannel) ? p.payModeSpecificData.subChannel[0] : p.payModeSpecificData?.subChannel, ndpsStatusCode: p.responseDetails.statusCode,
      });
    } else if (p.responseDetails.message === 'FAILED') {
      await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
        await tx.paymentAttempt.updateMany({ where: { id: attempt.id, status: { not: 'PAID' } }, data: { status: 'FAILED' } });
        await tx.order.updateMany({ where: { id: order.id, cashfreeOrderId: attempt.cashfreeOrderId, paymentStatus: { not: 'PAID' } }, data: { paymentStatus: 'FAILED' } });
      });
    }
    return { orderId: order.id };
  }

  async reconcileOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { user: true, stock: true, basket: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.paymentStatus === 'PAID') return;
    if ((order.paymentData as any)?.gateway !== 'ndps') throw new BadRequestException('Legacy payments must be reconciled with their original provider');
    const attempts = await this.prisma.paymentAttempt.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' } });
    for (const attempt of attempts) {
      const p = await this.ndps.status(attempt.cashfreeOrderId, Number(attempt.amount), attempt.createdAt);
      await this.applyNdpsResult({ ...attempt, order }, p);
      if (p.responseDetails.statusCode === 'OTS0000') break;
    }
  }

  async adminSyncNdpsStatus(orderId: string, _adminId: string, _adminEmail: string): Promise<{ success: boolean; order: unknown }> {
    await this.reconcileOrder(orderId);
    return { success: true, order: await this.prisma.order.findUnique({ where: { id: orderId } }) };
  }

  async refundOrder(orderId: string, adminId: string) {
    const reservation = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      const data = (order.paymentData as any) || {};
      if (data.gateway !== 'ndps' || order.paymentStatus !== 'PAID' || !order.cashfreePaymentId || !order.cashfreeOrderId) throw new BadRequestException('No confirmed NDPS payment to refund');
      if (!['CANCELLED', 'EXPIRED'].includes(order.status)) throw new BadRequestException('Cancel the order before requesting its refund');
      if (data.refund) return { order, existing: data.refund };
      const refund = { refundId: `RF${crypto.randomUUID().replace(/-/g, '')}`, status: 'REQUESTED', requestedBy: adminId, requestedAt: new Date().toISOString() };
      await tx.order.update({ where: { id: orderId }, data: { paymentData: { ...data, refund } } });
      return { order, existing: null, refund };
    });
    if (reservation.existing) return reservation.existing;
    const { order, refund } = reservation;
    // REQUESTED survives timeouts; repeated admin clicks never submit again.
    const result = await this.ndps.refund(order.cashfreeOrderId!, order.cashfreePaymentId!, Number(order.totalAmount), refund!.refundId);
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
      const current = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      await tx.order.update({ where: { id: orderId }, data: { paymentData: { ...((current.paymentData as object) || {}), refund: { ...refund, ...result } } } });
    });
    return result;
  }

  async runNdpsReconciliation(date?: string, executedBy = 'ACCOUNTANT') {
    const targetDate = date || new Date(Date.now() + 330 * 60000 - 86400000).toISOString().slice(0, 10);
    const rows = await this.ndps.settlements(targetDate);
    let reconciledCount = 0;
    const reportData: any[] = [];
    for (const row of rows) {
      if (row.txnState !== 'Sale') continue;
      const order = await this.prisma.order.findFirst({ where: { cashfreePaymentId: String(row.atomTxnID), paymentStatus: 'PAID' } });
      const valid = order && (order.paymentData as any)?.gateway === 'ndps' &&
        (order.paymentData as any)?.merchantTransactionId === row.merchantTxnID &&
        Math.round(Number(row.grossTxnAmount) * 100) === Math.round(Number(order.totalAmount) * 100) &&
        row.paymentStatus === 'PAYMENT GIVEN' && row.settlementUTR && row.settlementUTR !== 'null';
      if (valid) {
        await this.prisma.$transaction(async tx => {
          await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
          const current = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
          await tx.order.update({ where: { id: order.id }, data: { paymentData: {
            ...((current.paymentData as object) || {}), settlement_utr: row.settlementUTR, transfer_utr: row.settlementUTR,
            settlement_date: row.settlementDate, settlement_amount: Number(row.netAmountToBePaid),
            service_charge: Number(row.txnCharges), service_tax: Number(row.serviceTax),
            reconciliation_status: 'RECONCILED', reconciliation: { status: 'RECONCILED', source: 'NDPS_SETTLEMENT', reconciliation_date: new Date().toISOString() },
          } } });
        });
        reconciledCount++;
      }
      reportData.push({ orderId: order?.orderNumber || row.merchantTxnID, internalId: order?.id,
        cfOrderId: row.merchantTxnID, cfPaymentId: String(row.atomTxnID), amount: Number(order?.totalAmount || 0), cfAmount: Number(row.grossTxnAmount),
        localStatus: order?.paymentStatus || 'MISSING', cashfreeStatus: row.paymentStatus, provider: 'ndps',
        reconciliationStatus: valid ? 'RECONCILED' : 'FAILED', mismatchReason: valid ? null : 'Settlement identity, amount, payment status or UTR did not match',
      });
    }
    const failedCount = reportData.length - reconciledCount;
    const run = await this.prisma.reconciliationRun.create({ data: { runDate: new Date(`${targetDate}T00:00:00+05:30`), executedBy,
      status: failedCount ? 'PARTIAL' : 'COMPLETED', totalTransactions: reportData.length, reconciledCount, failedCount,
      missingCashfree: 0, missingLocal: reportData.filter(row => !row.internalId).length, reportData,
      summary: { provider: 'ndps', date: targetDate, reconciledCount, failedCount } } });
    return { runId: run.id, totalTransactions: reportData.length, reconciledCount, failedCount, reportData };
  }

  @Cron(CronExpression.EVERY_DAY_AT_5AM, { timeZone: 'Asia/Kolkata' })
  async reconcileNdpsSettlements() {
    if (this.configService.get('NDPS_SETTLEMENT_ENABLED') !== 'true') return;
    await this.runNdpsReconciliation(undefined, 'SYSTEM');
  }

  private sanitizeOrder(order: any) {
    if (!order) return order;
    const { user, ...orderRest } = order;
    const safeUser = user
      ? {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          kycStatus: user.kycStatus,
        }
      : undefined;

    return {
      ...orderRest,
      ...(safeUser && { user: safeUser }),
    };
  }

  private async settleAttempt(
    attemptId: string,
    orderId: string,
    cashfreePaymentId: string,
    order: any,
    attemptCashfreeOrderId?: string,
    paymentMetadata: Record<string, any> = {},
  ) {
    const attempt = await this.prisma.paymentAttempt.findUnique({ where: { id: attemptId } });
    return await this.handlePaymentSuccess(orderId, cashfreePaymentId, order, attempt?.cashfreeOrderId || attemptCashfreeOrderId, attemptId, paymentMetadata);
  }

  private async handlePaymentSuccess(
    orderId: string,
    cashfreePaymentId: string | null,
    order: any,
    attemptCashfreeOrderId?: string,
    attemptId?: string,
    auditData: Record<string, any> = {},
  ) {
    const existingPData = (order.paymentData as any) || {};
    const realCfOrderId =
      attemptCashfreeOrderId ||
      existingPData.cf_order_id ||
      existingPData.cfOrderId;

    const paymentData = {
      ...auditData,
      paymentTimestamp: new Date().toISOString(),
      cashfreePaymentId,
      ...(realCfOrderId && { cf_order_id: realCfOrderId }),
      gateway: existingPData.gateway || 'manual',
    };

    // Avoid race conditions with the expiration Cron job
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // Row locking also serializes against expiration and all other order updates.
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
      const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
      if (!currentOrder) throw new NotFoundException('Order not found');
      if (currentOrder.paymentStatus === 'PAID') {
        if (Object.keys(auditData).length) {
          await tx.order.update({ where: { id: orderId }, data: {
            paymentData: { ...((currentOrder.paymentData as object) || {}), ...auditData },
          } });
        }
        return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { user: true, stock: true, basket: true } });
      }
      if (attemptId) {
        await tx.paymentAttempt.update({ where: { id: attemptId }, data: { status: 'PAID' } });
      }
      await tx.paymentAttempt.updateMany({
        where: { orderId, ...(attemptId ? { id: { not: attemptId } } : {}), status: 'PENDING' },
        data: { status: 'SUPERSEDED' },
      });
      // The outbox survives a process crash or a Redis outage after the payment commits.
      for (const kind of ['PAYMENT_ACCOUNTING', 'PAYMENT_CONFIRMATION', 'PAYMENT_COUPON']) {
        const id = `${kind}:${orderId}`;
        await tx.$executeRaw`INSERT INTO "IntegrationTask" ("id", "kind", "entityId")
          VALUES (${id}, ${kind}, ${orderId}) ON CONFLICT ("id") DO NOTHING`;
      }
      const currentCfOrderId = currentOrder?.cashfreeOrderId;
      // If cashfreeOrderId was never set or was mistakenly set to system orderNumber, fix it!
      const shouldFixCfOrderId =
        realCfOrderId &&
        (!currentCfOrderId || currentCfOrderId === currentOrder?.orderNumber);

      let receiptNumber = currentOrder?.receiptNumber;
      if (!receiptNumber) {
        receiptNumber = await this.generateUniqueReceiptNumber(tx);
      }

      if (currentOrder?.status === 'EXPIRED' || currentOrder?.status === 'CANCELLED') {
        this.logger.error(`Payment succeeded for EXPIRED/CANCELLED order ${orderId}. Flagging for manual refund.`);
        // Order expired and stock was refunded, but payment arrived late. Flag for manual refund.
        return await tx.order.update({
          where: { id: orderId },
          data: {
            receiptNumber,
            paymentStatus: 'PAID',
            ...(shouldFixCfOrderId && { cashfreeOrderId: realCfOrderId }),
            cashfreePaymentId: cashfreePaymentId,
            paymentData: { 
              ...((currentOrder.paymentData as object) || {}),
              ...(paymentData as any), 
              needsAdminRefund: true,
              latePaymentReason: `Payment succeeded but order was already ${currentOrder.status}` 
            },
            updatedAt: new Date(),
          },
          include: { user: true, stock: true, basket: true },
        });
      }

      // Normal flow: order is still PENDING
      return await tx.order.update({
        where: { id: orderId },
        data: {
          receiptNumber,
          paymentStatus: 'PAID',
          status: 'PAID', // Keep in PAID state until manual admin approval
          ...(shouldFixCfOrderId && { cashfreeOrderId: realCfOrderId }),
          cashfreePaymentId: cashfreePaymentId,
          paymentData: { ...((currentOrder.paymentData as object) || {}), ...paymentData } as any,
          updatedAt: new Date(),
        },
        include: { user: true, stock: true, basket: true },
      });
    });

    // Keep immediate posting on the normal path; the outbox retries failed posting.
    try {
      await this.generateVouchers(updatedOrder);
    } catch {
      this.logger.error(`Receipt posting deferred for order ${orderId}; durable retry remains pending.`);
    }

    return {
      success: true,
      message: 'Payment verified and order confirmed',
      order: this.sanitizeOrder(updatedOrder),
    };
  }

  async processPaymentEffect(kind: string, orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId }, include: { user: true, stock: true, basket: true },
    });
    if (order.paymentStatus !== 'PAID') throw new Error('Payment is not committed');
    if (kind === 'PAYMENT_ACCOUNTING') return this.generateVouchers(order);
    if (['EXPIRED', 'CANCELLED'].includes(order.status)) return;
    if (kind === 'PAYMENT_CONFIRMATION') return this.sendPaidOrderConfirmation(order);
    if (kind === 'PAYMENT_COUPON') {
      // Lock Coupon if applied
      if ((order as any).couponId) {
         try {
           const couponRecord = await this.prisma.coupon.findUnique({
             where: { id: (order as any).couponId },
             select: { id: true, code: true, internalRmId: true, distributorRmId: true },
           });
           const isDirectAdmin = couponRecord && !couponRecord.internalRmId && !couponRecord.distributorRmId;
           let isSingleUse = !isDirectAdmin;
           if (isDirectAdmin) {
             const auditLog = await this.prisma.auditLog.findFirst({
               where: {
                 entity: 'COUPON',
                 action: 'CREATE',
                 OR: [
                   { entityId: couponRecord.id },
                   { metadata: { path: ['code'], equals: couponRecord.code } },
                 ],
               },
             });
             const redemptionType = (auditLog?.metadata as any)?.redemptionType || (auditLog?.changes as any)?.redemptionType;
             if (redemptionType === 'ONCE') {
               isSingleUse = true;
             }
           }

           if (isSingleUse) {
             await this.prisma.coupon.update({
               where: { id: (order as any).couponId },
               data: {
                  isUsed: true,
                  usedAt: new Date(),
                  usedByUserId: order.userId,
                  orderId: order.id,
               }
             });
             this.logger.log(`Locked single-use coupon ${(order as any).couponId} for user ${order.userId} on Order ${order.id}`);
           } else {
             this.logger.log(`Multi-use coupon ${(order as any).couponId} used on Order ${order.id} (remains active until expiry)`);
           }
         } catch (couponError) {
           throw couponError;
         }
      }

    }
  }

  private async sendPaidOrderConfirmation(updatedOrder: any) {
    // Never infer receipt of payment from order creation or a browser redirect.
    if (updatedOrder.paymentStatus !== 'PAID' || ['EXPIRED', 'CANCELLED'].includes(updatedOrder.status)) return;
    if (updatedOrder.user.email) {
    try {
      const result = await this.emailService.sendOrderConfirmationEmail(
        {
          id: updatedOrder.id,
          orderNumber: (updatedOrder as any).orderNumber,
          stockName:
            updatedOrder.stock?.name ||
            updatedOrder.basket?.name ||
            'Investment',
          quantity: updatedOrder.quantity,
          totalAmount: updatedOrder.totalAmount,
          pricePerShare: (updatedOrder as any).pricePerShare,
          date: updatedOrder.createdAt,
        },
        {
          email: updatedOrder.user.email || '',
          name: updatedOrder.user.fullName,
        },
      );
      if (result?.success === false) throw new Error('Confirmation email delivery failed');
      this.logger.log(
        `✉ Order Confirmed email sent to ${updatedOrder.user.email}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send order confirmation email: ${error.message}`,
      );
      throw error;
    }
    }
    // Create in-app notification for confirmed payment (best-effort)
    try {
      const displayOrderNum = (updatedOrder as any).orderNumber || `ORD-${updatedOrder.id.slice(-6).toUpperCase()}`;
      await this.prisma.notification.upsert({
        where: { id: `payment-confirmed-${updatedOrder.id}` },
        update: {},
        create: {
          id: `payment-confirmed-${updatedOrder.id}`,
          userId: updatedOrder.userId,
          type: 'ORDER_PLACED',
          title: 'Order Confirmed',
          message: `Your order #${displayOrderNum} is confirmed. Your payment has been received.`,
          metadata: {
            orderId: updatedOrder.id,
            orderNumber: displayOrderNum,
            redirectUrl: `/orders/${updatedOrder.id}`,
            stockName: updatedOrder.stock?.name || updatedOrder.basket?.name || 'Investment',
            amount: updatedOrder.totalAmount,
          },
        },
      });
      this.logger.log(`🔔 In-app notification created for order ${updatedOrder.id}`);
    } catch (error: any) {
      this.logger.warn(
        `Failed to create ORDER_PLACED notification for order ${updatedOrder.id}`,
        error.message,
      );
      throw error;
    }

  }

  // Portfolio update methods have been moved to orders.service.ts for manual approval

  // ============================================
  // AUTOMATIC VOUCHER GENERATION
  // ============================================

  /**
   * Generate the next voucher number for a given prefix.
   * Format: PREFIX-XXXX (e.g. RCP-0001, SAL-0002, JV-0003)
   */
  /**
   * Generate a unique receipt number for an order.
   * Format: RCPT-XXXXXX (6 uppercase hex chars)
   */
  private async generateUniqueReceiptNumber(tx?: any): Promise<string> {
    const db = tx || this.prisma;
    for (let attempt = 0; attempt < 10; attempt++) {
      const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
      const candidate = `RCPT-${randomPart}`;
      const existing = await db.order.findUnique({
        where: { receiptNumber: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
    }
    throw new Error('Unable to allocate a unique receipt number');
  }

  /**
   * Find or create a USER-type ledger for the buyer.
   * Matched by user email; auto-created if not found.
   */
  private async findOrCreateUserLedger(user: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone?: string | null;
  }): Promise<{ id: string }> {
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'payment-user-ledger:' + user.id}, 0))::text`;
    // Preserve the existing rule: active USER ledger matched by customer email.
    if (user.email) {
      const existing = await tx.ledger.findFirst({
        where: {
          type: 'USER',
          email: user.email,
          isActive: true,
        },
        select: { id: true },
      });

      if (existing) return existing;
    }

    // Auto-create USER ledger
    // Generate unique 6-character ledger code with UL prefix
    let generatedUserCode = '';
    for (let attempt = 0; attempt < 10; attempt++) {
      const uniqueId = crypto
        .randomBytes(2)
        .toString('hex')
        .toUpperCase()
        .slice(0, 4);
      const code = `UL${uniqueId}`;
      const existing = await tx.ledger.findUnique({
        where: { code },
      });
      if (!existing) {
        generatedUserCode = code;
        break;
      }
    }
    if (!generatedUserCode) {
      const ts = Date.now().toString(36).toUpperCase().slice(-4);
      generatedUserCode = `UL${ts}`;
    }

    const ledger = await tx.ledger.create({
      data: {
        name: user.fullName || user.email || `User ${user.id.slice(-6)}`,
        code: generatedUserCode,
        type: 'USER',
        openingBalance: 0,
        currentBalance: 0,
        email: user.email,
        phone: user.phone,
      },
    });

    this.logger.log(`📒 Auto-created USER ledger "${ledger.name}" (${ledger.id})`);
    return { id: ledger.id };
    });
  }

  /**
   * Automatically generate 1 voucher after a successful payment:
   *   1. Receipt Voucher (RCP) — Payment received from user
   *
   * Voucher is auto-posted and ledger balances updated.
   */
  private async generateVouchers(order: any) {
    // Order fulfilment status is not evidence that money was received.
    if (!['PAID', 'SUCCESS'].includes(order.paymentStatus)) return;
    const assetName = order.stock?.name || order.basket?.name || 'Investment';
    const shortOrderId = order.id.slice(-10).toUpperCase();
    const amount = order.totalAmount;
    const today = new Date();

    // 1. Get CASHFREE PAYMENTS INDIA PVT LTD ledger (never HDFC)
    const bankLedger = await this.getGatewayLedger(order.paymentData?.gateway === 'ndps');
    if (!bankLedger) {
      throw new Error(
        'Payment gateway control ledger not found.',
      );
    }

    // 2. Find or create USER ledger for the buyer
    const userLedger = await this.findOrCreateUserLedger(order.user);

    // 3. Resolve coupon code if coupon was used
    let couponCode: string | undefined = (order as any).coupon?.code;
    if (!couponCode && order.couponId) {
      try {
        const couponRecord = await this.prisma.coupon.findUnique({
          where: { id: order.couponId },
          select: { code: true },
        });
        couponCode = couponRecord?.code;
      } catch {}
    }

    // 4. Generate voucher number (Only RCP)
    const receiptLock = `receipt:${order.id}`;

    // 5. Create RCP voucher in a single transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${receiptLock}, 0))::text`;
      const legacy = await tx.voucher.findFirst({ where: {
        type: 'RECEIPT', metadata: { path: ['orderId'], equals: order.id },
      }, select: { id: true } });
      if (legacy) return;
      const rcpNumber = await allocateVoucherNumber(tx, 'RCP');
      // --- Receipt Voucher (RCP) ---
      // Debit BANK (money in), Credit USER (user paid)
      const rcpVoucher = await tx.voucher.create({
        data: {
          voucherNumber: rcpNumber,
          type: 'RECEIPT',
          date: today,
          narration: `Payment received for ${assetName} — Order #${shortOrderId}`,
          totalAmount: amount,
          status: 'APPROVED',
          approvedAt: today,
          approvedById: 'SYSTEM',
          referenceNumber: order.cashfreePaymentId || undefined,
          referenceDate: today,
          createdById: 'SYSTEM',
          metadata: {
            autoGenerated: true,
            receiptNumber: (order as any).receiptNumber,
            orderId: order.id,
            orderNumber: (order as any).orderNumber || `ORD-${shortOrderId}`,
            orderDate: order.createdAt,
            transactionId: order.cashfreePaymentId,
            transactionDate: today.toISOString(),
            modeOfPayment: order.paymentData?.payment_method || (order.paymentData?.gateway === 'ndps' ? 'NDPS' : 'Cashfree'),
            type: 'receipt',
            stockName: assetName,
            isin: order.stock?.isin || order.stock?.cin || undefined,
            quantity: order.quantity,
            pricePerShare: order.pricePerShare ? Number(order.pricePerShare) : undefined,
            discountApplied: order.discountApplied ? Number(order.discountApplied) : 0,
            originalTotalAmount: order.originalTotalAmount ? Number(order.originalTotalAmount) : Number(amount),
            couponId: order.couponId || undefined,
            couponCode: couponCode || undefined,
          },
          entries: {
            create: [
              {
                ledgerId: bankLedger.id,
                entryType: 'DEBIT',
                amount,
                narration: `Receipt from ${order.user.fullName || order.user.email || 'Customer'}`,
              },
              {
                ledgerId: userLedger.id,
                entryType: 'CREDIT',
                amount,
                narration: `Payment for ${assetName}`,
              },
            ],
          },
        },
      });

      // Update ledger balances for RCP
      await tx.ledger.update({
        where: { id: bankLedger.id },
        data: { currentBalance: { increment: amount } },
      });
      await tx.ledger.update({
        where: { id: userLedger.id },
        data: { currentBalance: { increment: -amount } },
      });

      this.logger.log(
        `📄 Created receipt voucher: ${rcpNumber} for order ${shortOrderId}`,
      );
    });
  }

  /**
   * Helper to find or auto-create the CASHFREE PAYMENTS INDIA PVT LTD Bank ledger.
   * Strictly excludes HDFC ledgers to ensure Cashfree is always used for auto voucher entries.
   */
  private async getGatewayLedger(isNdps = true): Promise<{ id: string; name: string }> {
    const ledgerName = isNdps ? 'NTT DATA PAYMENT SERVICES INDIA LTD' : 'CASHFREE PAYMENTS INDIA PVT LTD';
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('payment-gateway-ledger', 0))::text`;
    let cashfreeLedger = await tx.ledger.findFirst({
      where: {
        AND: [
          { isActive: true },
          { NOT: { name: { contains: 'HDFC', mode: 'insensitive' } } },
          { NOT: { name: { contains: 'Inter DP', mode: 'insensitive' } } },
          {
            OR: [
              { name: { equals: ledgerName, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, name: true },
    });

    if (!cashfreeLedger) {
      let bankGroup = await tx.accountingGroup.findFirst({
        where: { name: { contains: 'Bank', mode: 'insensitive' } },
        select: { id: true },
      });
      const latestBank = await tx.ledger.findFirst({
        where: { code: { startsWith: 'BK' } },
        orderBy: { code: 'desc' },
        select: { code: true },
      });
      let nextNum = 1;
      if (latestBank && latestBank.code && latestBank.code.startsWith('BK')) {
        const parsed = parseInt(latestBank.code.slice(2), 10);
        if (!isNaN(parsed)) nextNum = parsed + 1;
      }
      const code = `BK${String(nextNum).padStart(4, '0')}`;

      cashfreeLedger = await tx.ledger.create({
        data: {
          code,
          name: ledgerName,
          type: 'BANK',
          groupId: bankGroup?.id,
          isActive: true,
        },
        select: { id: true, name: true },
      });
      this.logger.log(`✓ Auto-created CASHFREE PAYMENTS INDIA PVT LTD ledger (${cashfreeLedger.id})`);
    }

    return cashfreeLedger;
    });
  }

  /**
   * Handle payment failure
   */
  private async handlePaymentFailure(orderId: string, reason: string) {
    await this.prisma.order.updateMany({
      where: { id: orderId, paymentStatus: { not: 'PAID' } },
      data: {
        paymentStatus: 'FAILED',
        // Order stays PENDING — user can retry payment
        paymentData: {
          errorCode: 'PAYMENT_VERIFICATION_FAILED',
          errorDescription: reason,
          failedAt: new Date().toISOString(),
          gateway: 'ndps',
        },
      },
    });

    this.logger.error(
      `❌ Payment verification failed for order ${orderId}: ${reason}`,
    );

    // Unpaid attempts stay silent; the checkout response still explains the failure.

    throw new BadRequestException(`Payment verification failed: ${reason}`);
  }

  async getPaymentStatus(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) throw new NotFoundException('Order not found');
    if (order.paymentStatus !== 'PAID' && (order.paymentData as any)?.gateway === 'ndps') {
      await this.paymentQueue.add('reconcile-order', { orderId }, { jobId: `reconcile-${orderId}-${Math.floor(Date.now() / 30000)}` });
    }
    return { orderId: order.id, paymentStatus: order.paymentStatus, amount: order.totalAmount,
      provider: (order.paymentData as any)?.gateway, merchantTransactionId: order.cashfreeOrderId,
      transactionId: order.cashfreePaymentId, needsAdminRefund: Boolean((order.paymentData as any)?.needsAdminRefund) };
  }

  async adminUpdatePaymentStatus(
    orderId: string,
    paymentStatus: string,
    adminId: string,
    adminEmail: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, stock: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (paymentStatus === 'PAID') {
      return this.handlePaymentSuccess(orderId, order.cashfreePaymentId, order,
        undefined, undefined, { adminOverride: true, adminId, adminEmail, overrideTimestamp: new Date().toISOString() });
    }

    const receiptNumber =
      paymentStatus === 'PAID' && !order.receiptNumber
        ? await this.generateUniqueReceiptNumber()
        : order.receiptNumber;

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus,
        ...(paymentStatus === 'PAID' && { status: 'PAID' }),
        ...(receiptNumber && { receiptNumber }),
        paymentData: {
          ...((order.paymentData as Record<string, any>) || {}),
          adminOverride: true,
          adminId,
          adminEmail,
          overrideTimestamp: new Date().toISOString(),
          gateway: (order.paymentData as any)?.gateway || 'manual',
        },
      },
      include: { user: true, stock: true, basket: true },
    });

    this.logger.log(
      `🔧 Admin ${adminEmail} (${adminId}) updated payment status for order ${orderId}: ${order.paymentStatus} → ${paymentStatus}`,
    );

    if (paymentStatus === 'PAID' && order.paymentStatus !== 'PAID') {
      await this.sendPaidOrderConfirmation(updatedOrder);
    }

    return {
      success: true,
      message: 'Payment status updated successfully',
      order: updatedOrder,
    };
  }
}
