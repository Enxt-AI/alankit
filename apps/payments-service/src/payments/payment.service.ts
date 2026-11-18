import { allocateVoucherNumber } from 'db-unlisted-stox';
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
import { acquireProviderSlot } from 'redis-service';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PinoNestLogger } from '@smc/logger';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PaymentService {
  private readonly logger = new PinoNestLogger('payments-service', 'PaymentService');
  private readonly cashfreeClientId: string;
  private readonly cashfreeClientSecret: string;
  private readonly cashfreeEnvironment: string;
  private readonly cashfreeBaseUrl: string;
  private readonly cashfreeApiVersion: string;
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
    @InjectQueue('payment-webhooks') private readonly paymentQueue: Queue,
  ) {
    this.cashfreeClientId = this.configService.get<string>(
      'CASHFREE_CLIENT_ID',
      '',
    );
    this.cashfreeClientSecret = this.configService.get<string>(
      'CASHFREE_CLIENT_SECRET',
      '',
    );
    this.cashfreeEnvironment = this.configService.get<string>(
      'CASHFREE_ENVIRONMENT',
      'SANDBOX',
    );
    this.cashfreeApiVersion = this.configService.get<string>(
      'CASHFREE_API_VERSION',
      '2023-08-01',
    );
    
    // Provide the manual URI configuration requested by user
    this.cashfreeBaseUrl = this.configService.get<string>(
      'CASHFREE_BASE_URL',
      this.cashfreeEnvironment?.trim().toUpperCase() === 'PRODUCTION'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg'
    );

    this.logger.log(
      `💳 Payment Service initialized pointing to ${this.cashfreeBaseUrl}`,
    );

    // Dynamic frontend URL — no need for a separate CASHFREE_RETURN_URL env var.
    // Works automatically: local dev (localhost:3000), staging (10.0.2.100), prod (unlistedstox.com)
    this.frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    ).replace(/\/$/, '');
  }

  /**
   * Fetch with automatic retry for transient network failures.
   * Retries up to `maxRetries` times with exponential back-off.
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 2,
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const account = crypto.createHash('sha256').update(this.cashfreeClientId).digest('hex').slice(0, 16);
        if (!await acquireProviderSlot(`cashfree:${account}`, Number(this.configService.get('CASHFREE_REQUESTS_PER_SECOND', 10)))) {
          throw new ServiceUnavailableException('Payment gateway is busy. Please retry shortly.');
        }
        const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
        if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
          await response.body?.cancel();
          const retryAfter = Number(response.headers.get('retry-after'));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 10000) : 1000 * 2 ** attempt;
          await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 500));
          continue;
        }
        return response;
      } catch (error: any) {
        lastError = error;
        const isTransient =
          error.message?.includes('fetch failed') ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('ETIMEDOUT') ||
          error.message?.includes('ENOTFOUND') ||
          error.cause?.code === 'ECONNRESET' ||
          error.cause?.code === 'ETIMEDOUT' ||
          error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';

        if (!isTransient || attempt === maxRetries) {
          throw error;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt), 4000) + Math.random() * 500;
        this.logger.warn(
          `⚠️ Transient fetch error (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}. Retrying in ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw lastError;
  }

  private async fetchCashfreeOrderStatus(cashfreeOrderId: string): Promise<any> {
    const response = await this.fetchWithRetry(`${this.cashfreeBaseUrl}/orders/${cashfreeOrderId}`, {
      method: 'GET',
      headers: {
        'x-client-id': this.cashfreeClientId,
        'x-client-secret': this.cashfreeClientSecret,
        'x-api-version': this.cashfreeApiVersion,
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Cashfree Fetch API Error: ${response.status} - ${errorText}`);
      throw new Error(`Failed with status ${response.status}`);
    }

    return await response.json();
  }

  private async fetchCashfreePaymentDetails(cashfreeOrderId: string): Promise<any[]> {
    const response = await this.fetchWithRetry(`${this.cashfreeBaseUrl}/orders/${cashfreeOrderId}/payments`, {
      method: 'GET',
      headers: {
        'x-client-id': this.cashfreeClientId,
        'x-client-secret': this.cashfreeClientSecret,
        'x-api-version': this.cashfreeApiVersion,
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Cashfree Payment Details API Error: ${response.status} - ${errorText}`);
      throw new Error(`Failed with status ${response.status}`);
    }

    return await response.json();
  }

  async getCashfreeSettlements(orderId: string) {
    const response = await this.fetchWithRetry(`${this.cashfreeBaseUrl}/orders/${encodeURIComponent(orderId)}/settlements`, {
      method: 'GET',
      headers: {
        'x-client-id': this.cashfreeClientId,
        'x-client-secret': this.cashfreeClientSecret,
        'x-api-version': '2025-01-01',
        Accept: 'application/json',
      },
    });
    if (!response.ok) throw new Error(`Cashfree settlements request failed: ${response.status}`);
    return response.json();
  }

  private resolveCandidateCashfreeOrderIds(order: any): string[] {
    const paymentData = typeof order.paymentData === 'string'
      ? JSON.parse(order.paymentData || '{}')
      : order.paymentData || {};
    return Array.from(new Set([
      order.cashfreeOrderId,
      paymentData.cf_order_id,
      paymentData.order_id,
      paymentData.cashfreeOrderId,
      ...(order.paymentAttempts || []).map((attempt: any) => attempt.cashfreeOrderId),
      order.orderNumber,
      order.id,
    ].filter(Boolean)));
  }

  private applySettlementData(existingData: any, settlement: any, source: 'WEBHOOK' | 'CRON') {
    const paymentData = typeof existingData === 'string' ? JSON.parse(existingData || '{}') : (existingData || {});
    const utr = settlement.transfer_utr || settlement.utr || paymentData.settlement?.transfer_utr || paymentData.transfer_utr || paymentData.settlement_utr;
    const settlementId = String(settlement.cf_settlement_id || settlement.settlement_id || settlement.settlementId || paymentData.settlement?.cf_settlement_id || paymentData.cf_settlement_id || '');
    const settlementDate = settlement.transfer_time || settlement.settlement_date || settlement.settlementDate || paymentData.settlement?.settlement_date || paymentData.settlement_date || new Date().toISOString();
    const serviceCharge = settlement.service_charge ?? settlement.fee;
    const serviceTax = settlement.service_tax ?? settlement.tax;
    const alreadyReconciled = Boolean(
      ((utr && paymentData.settlement?.transfer_utr === utr) || (utr && paymentData.transfer_utr === utr) ||
       (settlementId && paymentData.settlement?.cf_settlement_id === settlementId) || (settlementId && paymentData.cf_settlement_id === settlementId)) &&
      paymentData.reconciliation?.status === 'RECONCILED',
    );
    if (alreadyReconciled) return { alreadyReconciled: true, paymentData };

    const settlementSection = {
      cf_settlement_id: settlementId,
      transfer_utr: utr || '',
      settlement_date: settlementDate,
      service_charge: serviceCharge !== undefined ? Number(serviceCharge) : Number(paymentData.settlement?.service_charge ?? paymentData.service_charge ?? 0),
      service_tax: serviceTax !== undefined ? Number(serviceTax) : Number(paymentData.settlement?.service_tax ?? paymentData.service_tax ?? 0),
      status: utr ? 'SETTLED' : (paymentData.settlement?.status || 'PENDING'),
    };
    return {
      alreadyReconciled: false,
      paymentData: {
        ...paymentData,
        settlement: settlementSection,
        settlement_utr: settlementSection.transfer_utr,
        transfer_utr: settlementSection.transfer_utr,
        cf_settlement_id: settlementSection.cf_settlement_id,
        settlement_id: settlementSection.cf_settlement_id,
        settlement_date: settlementSection.settlement_date,
        service_charge: settlementSection.service_charge,
        service_tax: settlementSection.service_tax,
        reconciliation: { ...(paymentData.reconciliation || {}), status: 'RECONCILED', reconciliation_date: new Date().toISOString(), source },
        reconciliation_status: 'RECONCILED',
        settlement_synced_at: new Date().toISOString(),
        settlement_sync_source: source,
      },
    };
  }

  async runCashfreeReconciliation(targetDateStr?: string, executedBy = 'ACCOUNTANT') {
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date(Date.now() - 86400000);
    const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: startOfDay, lte: endOfDay } },
      include: { user: { select: { id: true, fullName: true, email: true, phone: true } }, paymentAttempts: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
    let reconciledCount = 0, failedCount = 0, missingCashfreeCount = 0;
    const reportData: any[] = [];
    for (const order of orders) {
      const pData = typeof order.paymentData === 'string' ? JSON.parse(order.paymentData || '{}') : ((order.paymentData as any) || {});
      const candidateIds = this.resolveCandidateCashfreeOrderIds(order);
      let cfOrder: any = null, cfPayments: any = null, matchedSearchId = candidateIds[0] || 'N/A';
      for (const candidateId of candidateIds) {
        try {
          const [fetchedOrder, fetchedPayments] = await Promise.all([
            this.fetchCashfreeOrderStatus(candidateId).catch(() => null),
            this.fetchCashfreePaymentDetails(candidateId).catch(() => null),
          ]);
          if (fetchedOrder || (Array.isArray(fetchedPayments) && fetchedPayments.length)) {
            cfOrder = fetchedOrder; cfPayments = fetchedPayments; matchedSearchId = candidateId; break;
          }
        } catch { /* Try the next known Cashfree order identifier. */ }
      }
      const cfPayment = Array.isArray(cfPayments) && cfPayments.length
        ? (cfPayments.find((payment: any) => payment.payment_status === 'SUCCESS') || cfPayments[0]) : null;
      const localOrderId = order.orderNumber || order.cashfreeOrderId || order.id;
      const localCfPaymentId = pData.cf_payment_id || pData.payment_id || order.cashfreePaymentId || 'N/A';
      const localStatus = order.paymentStatus || order.status || 'PENDING';
      const localAmount = Number(order.totalAmount || pData.order_amount || pData.amount || 0);
      const localBankRef = pData.bank_reference || pData.referenceId || pData.settlement_utr || pData.utr || 'N/A';
      const localPaymentMethod = pData.payment_method || pData.payment_group || 'Cashfree';
      const cfStatus = cfPayment?.payment_status || cfOrder?.order_status || 'MISSING_IN_CASHFREE';
      const cfPaymentId = cfPayment?.cf_payment_id?.toString() || cfPayment?.payment_id?.toString() || 'N/A';
      const cfAmount = Number(cfPayment?.payment_amount ?? cfOrder?.order_amount ?? 0);
      const cfBankRef = cfPayment?.bank_reference || cfPayment?.payment_completion_id || 'N/A';
      const cfMethod = cfPayment?.payment_group || cfPayment?.payment_method?.type || 'UNKNOWN';
      const mismatches: string[] = [];
      const isLocalPaid = localStatus === 'PAID' || localStatus === 'SUCCESS';
      const isCfPaid = cfStatus === 'SUCCESS';
      if (!cfOrder && !cfPayment) {
        if (isLocalPaid) { missingCashfreeCount++; mismatches.push('Order missing in Cashfree'); }
      } else {
        if (isLocalPaid !== isCfPaid) mismatches.push(`Status mismatch: Local ${localStatus} vs Cashfree ${cfStatus}`);
        if (isLocalPaid && isCfPaid && Math.abs(localAmount - cfAmount) > 0.01 && cfAmount > 0) mismatches.push(`Amount mismatch: Local ₹${localAmount.toFixed(2)} vs Cashfree ₹${cfAmount.toFixed(2)}`);
        if (isLocalPaid && isCfPaid && cfPaymentId !== 'N/A' && localCfPaymentId !== 'N/A' && cfPaymentId !== localCfPaymentId) {
          const exactMatch = Array.isArray(cfPayments) && cfPayments.some((p: any) => p.cf_payment_id?.toString() === localCfPaymentId || p.payment_id?.toString() === localCfPaymentId);
          if (!exactMatch) mismatches.push(`CF Payment ID mismatch: Local ${localCfPaymentId} vs Cashfree ${cfPaymentId}`);
        }
      }
      const isReconciled = mismatches.length === 0 && isLocalPaid;
      const recStatus = isReconciled ? 'RECONCILED' : 'FAILED';
      const recRemark = isReconciled ? 'All 6 payment fields matched successfully' : mismatches.join('; ');
      if (isReconciled) reconciledCount++; else failedCount++;
      await this.prisma.order.update({ where: { id: order.id }, data: { paymentData: {
        ...pData,
        cf_payment_id: cfPaymentId !== 'N/A' ? cfPaymentId : pData.cf_payment_id,
        bank_reference: cfBankRef !== 'N/A' ? cfBankRef : pData.bank_reference,
        payment_method: cfMethod !== 'UNKNOWN' ? cfMethod : pData.payment_method,
        reconciliation: { ...(pData.reconciliation || {}), status: recStatus, reconciliation_date: new Date().toISOString(), mismatch_reason: isReconciled ? null : recRemark, source: 'MANUAL_RECONCILIATION_RUN' },
        reconciliation_status: recStatus,
        reconciliation_remark: isReconciled ? null : recRemark,
      } } });
      reportData.push({
        orderId: localOrderId, internalId: order.id, customerName: order.user?.fullName || 'N/A', customerEmail: order.user?.email || 'N/A',
        cfOrderId: matchedSearchId !== 'N/A' ? matchedSearchId : (order.cashfreeOrderId || pData.cf_order_id || pData.order_id || '—'),
        cfPaymentId, amount: localAmount, cfAmount, localStatus, cashfreeStatus: cfStatus,
        bankReference: cfBankRef !== 'N/A' ? cfBankRef : localBankRef,
        paymentMethod: cfMethod !== 'UNKNOWN' ? cfMethod : localPaymentMethod,
        reconciliationStatus: recStatus, mismatchReason: isReconciled ? null : recRemark,
        reconciliationDate: new Date().toISOString(), createdAt: order.createdAt,
      });
    }
    const runRecord = await (this.prisma as any).reconciliationRun.create({ data: {
      runDate: startOfDay, executedBy, status: failedCount === 0 ? 'COMPLETED' : 'PARTIAL', totalTransactions: orders.length,
      reconciledCount, failedCount, missingCashfree: missingCashfreeCount, missingLocal: 0, reportData,
      summary: { date: startOfDay.toISOString().split('T')[0], total: orders.length, reconciled: reconciledCount, failed: failedCount, missingCashfree: missingCashfreeCount, missingLocal: 0 },
    } });
    return { runId: runRecord.id, runDate: startOfDay.toISOString().split('T')[0], totalTransactions: orders.length, reconciledCount, failedCount, missingCashfree: missingCashfreeCount, reportData };
  }

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async reconcilePendingCashfreeSettlements() {
    const fromDate = new Date(); fromDate.setDate(fromDate.getDate() - 14);
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: fromDate }, OR: [{ paymentStatus: 'PAID' }, { paymentStatus: 'SUCCESS' }, { status: 'PAID' }, { status: 'COMPLETED' }] },
      select: { id: true, orderNumber: true, cashfreeOrderId: true, cashfreePaymentId: true, paymentData: true, paymentAttempts: { select: { cashfreeOrderId: true } } },
    });
    for (const order of orders) {
      const paymentData = typeof order.paymentData === 'string' ? JSON.parse(order.paymentData || '{}') : ((order.paymentData as any) || {});
      if (paymentData.reconciliation?.status === 'RECONCILED' && (paymentData.settlement_utr || paymentData.transfer_utr)) continue;
      for (const orderId of this.resolveCandidateCashfreeOrderIds(order)) {
        try {
          const settlements = await this.getCashfreeSettlements(orderId);
          const settlement = Array.isArray(settlements) ? settlements[0] : settlements?.data?.[0] || settlements?.settlement || settlements;
          if (!settlement) continue;
          const updated = this.applySettlementData(paymentData, settlement, 'CRON');
          if (!updated.alreadyReconciled) await this.prisma.order.update({ where: { id: order.id }, data: { paymentData: updated.paymentData } });
          break;
        } catch { /* Keep trying candidate IDs; the next daily pass retries transient provider failures. */ }
      }
    }
  }

  /**
   * Admin endpoint to actively sync an order's payment status directly from Cashfree
   */
  async adminSyncCashfreeStatus(orderId: string, adminId: string, adminEmail: string) {
    let order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, stock: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // 1. Find the CF Order ID to check (either from order paymentData, orderNumber, cashfreeOrderId, or latest attempt)
    const pData = (order.paymentData as Record<string, any>) || {};
    let cfOrderId = pData.order_id || order.orderNumber || order.cashfreeOrderId;
    if (!cfOrderId) {
      const attempt = await this.prisma.paymentAttempt.findFirst({
        where: { orderId: order.id },
        orderBy: { createdAt: 'desc' },
      });
      if (attempt) {
        cfOrderId = attempt.cashfreeOrderId;
      }
    }

    if (!cfOrderId) {
      throw new BadRequestException('No Cashfree Order ID found for this order');
    }

    // 2. Fetch order status
    const cfOrder = await this.fetchCashfreeOrderStatus(cfOrderId);
    const realCfOrderId = cfOrder.cf_order_id ? String(cfOrder.cf_order_id) : undefined;
    
    // 3. Fetch payment details to get cf_payment_id
    const cfPayments = await this.fetchCashfreePaymentDetails(cfOrderId);
    const successfulPayment = cfPayments.find((p: any) => p.payment_status === 'SUCCESS');
    
    const cfPaymentId = successfulPayment?.cf_payment_id?.toString() || cfOrder.cf_order_id?.toString();
    const bankReference = successfulPayment?.bank_reference || undefined;

    this.logger.log(`🔄 Admin sync triggered by ${adminEmail} for order ${orderId} (CF Order: ${cfOrderId}, real cf_order_id: ${realCfOrderId}). Status from Cashfree: ${cfOrder.order_status}`);

    // 4. If PAID on CF but not locally, trigger settleAttempt
    if (cfOrder.order_status === 'PAID' && order.paymentStatus !== 'PAID' && order.status !== 'PAID') {
      // Find the attempt ID
      const attempt = await this.prisma.paymentAttempt.findFirst({
        where: {
          OR: [
            { cashfreeOrderId: cfOrderId },
            ...(realCfOrderId ? [{ cashfreeOrderId: realCfOrderId }] : [])
          ]
        },
        orderBy: { createdAt: 'desc' }
      });
      if (attempt) {
        const res = await this.settleAttempt(attempt.id, order.id, cfPaymentId, order);
        order = res.order;
      }
    }

    // 5. Update any missing paymentData directly and fix cashfreeOrderId if it held orderNumber
    const updatedOrder = await this.prisma.order.update({
      where: { id: order!.id },
      data: {
        ...(realCfOrderId && { cashfreeOrderId: realCfOrderId }),
        cashfreePaymentId: cfPaymentId || order!.cashfreePaymentId,
        paymentData: {
          ...pData,
          cf_order_id: realCfOrderId || pData.cf_order_id,
          order_id: pData.order_id || order!.orderNumber,
          cf_payment_id: cfPaymentId,
          payment_id: cfPaymentId,
          bank_reference: bankReference,
          last_synced_by: adminEmail,
          last_sync_time: new Date().toISOString()
        }
      },
      include: { user: true, stock: true, basket: true }
    });

    return {
      success: true,
      message: `Order synced successfully. Current status: ${cfOrder.order_status}`,
      order: updatedOrder
    };
  }

  /**
   * Create a payment order via Cashfree
   */
  async createPaymentOrder(orderId: string, userId: string) {
    // Validate order exists and belongs to user
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      this.logger.error(`❌ Order not found: ${orderId}`);
      throw new NotFoundException('Order not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
      include: { ledger: { select: { code: true } } }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // Attach user to order to satisfy remaining types
    (order as any).user = user;

    this.logger.log(`📋 Order ${orderId}: userId=${order.userId}, status=${order.status}, kycStatus=${user.kycStatus}`);

    if (order.userId !== userId) {
      this.logger.error(`❌ User mismatch: order.userId=${order.userId}, requestUserId=${userId}`);
      throw new BadRequestException('Order does not belong to user');
    }

    if (order.status !== 'PENDING') {
      this.logger.error(`❌ Order status is ${order.status}, expected PENDING`);
      throw new BadRequestException(
        `Cannot initiate payment for order with status: ${order.status}`,
      );
    }

    const deadline = order.expiresAt ?? new Date(order.createdAt.getTime() + 24 * 60 * 60 * 1000);
    if (Date.now() >= deadline.getTime()) {
      throw new BadRequestException('This order has expired. Please place a new order.');
    }
    if (['PAID', 'SUCCESS'].includes(order.paymentStatus)) {
      throw new BadRequestException('Order is already paid');
    }

    // Double-check KYC verification
    if (user.kycStatus !== 'VERIFIED') {
      this.logger.error(`❌ KYC not verified: ${user.kycStatus}`);
      throw new BadRequestException('KYC verification required before payment');
    }

    // Determine gateway environment
    const isProdGateway =
      this.cashfreeEnvironment?.trim().toUpperCase() === 'PRODUCTION' ||
      this.cashfreeBaseUrl?.includes('api.cashfree.com');
    const gatewayEnv: 'production' | 'sandbox' = isProdGateway ? 'production' : 'sandbox';

    // A closed/failed checkout can still have a reusable active gateway session.
    const existingAttempt = await this.prisma.paymentAttempt.findFirst({
      where: { orderId, status: { in: ['PENDING', 'FAILED', 'USER_DROPPED'] } },
      orderBy: { createdAt: 'desc' }
    });

    if (existingAttempt) {
      try {
        const lookupId = (order.paymentData as any)?.order_id || order.orderNumber || existingAttempt.cashfreeOrderId;
        const cfOrder = await this.fetchCashfreeOrderStatus(lookupId);
        const validSessionId = cfOrder.payment_session_id || existingAttempt.paymentSessionId;

        if ((cfOrder.order_status === 'ACTIVE' || cfOrder.order_status === 'PENDING') && validSessionId) {
          if (cfOrder.payment_session_id && existingAttempt.paymentSessionId !== cfOrder.payment_session_id) {
            await this.prisma.paymentAttempt.update({
              where: { id: existingAttempt.id },
              data: { paymentSessionId: cfOrder.payment_session_id },
            }).catch(() => null);
          }
          this.logger.log(`♻️ Reusing existing active Cashfree session: ${existingAttempt.cashfreeOrderId}`);
          return {
            cashfreeOrderId: existingAttempt.cashfreeOrderId,
            paymentSessionId: validSessionId,
            amount: Number(existingAttempt.amount),
            currency: cfOrder.order_currency || 'INR',
            environment: gatewayEnv,
          };
        } else if (cfOrder.order_status === 'PAID') {
          throw new BadRequestException('Order is already paid');
        } else {
          await this.prisma.paymentAttempt.update({
            where: { id: existingAttempt.id },
            data: { status: 'EXPIRED' }
          });
        }
      } catch (e: any) {
        if (e instanceof BadRequestException) throw e;
        this.logger.warn(`Failed to check existing attempt ${existingAttempt.cashfreeOrderId}: ${e.message}`);
        throw new ServiceUnavailableException('Unable to check your previous payment. Please try again shortly.');
      }
    }

    const userBankData = user.bankData as any;
    const customerBankAccountNumber = userBankData?.accNo;
    const customerBankIfsc = userBankData?.ifsc;

    let cashfreeOrderId: string;
    let paymentSessionId: string;
    let amount: number;
    let currency: string;

    try {
      const merchantOrderId = order.orderNumber || `ORD_${orderId.slice(-6).toUpperCase()}`;
      const payload = {
        order_expiry_time: deadline.toISOString(),
        order_amount: Number(order.totalAmount.toFixed(2)),
        order_currency: 'INR',
        order_id: merchantOrderId,
        customer_details: {
          customer_id: (user.ledger?.code || order.userId).slice(0, 50),
          customer_name: user.fullName?.slice(0, 100),
          customer_email: user.email,
          customer_phone: user.phone ? user.phone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10) : undefined,
          ...(customerBankAccountNumber && { customer_bank_account_number: customerBankAccountNumber }),
          ...(customerBankIfsc && { customer_bank_ifsc: customerBankIfsc }),
        },
        order_note: `Payment for order ${merchantOrderId}`,
        order_meta: {
          return_url: `${this.frontendUrl}/thank-you?orderId=${order.orderNumber || orderId}&payment=success`,
          payment_methods: 'upi,nb',
        },
      };

      const response = await this.fetchWithRetry(`${this.cashfreeBaseUrl}/orders`, {
        method: 'POST',
        headers: {
          'x-client-id': this.cashfreeClientId,
          'x-client-secret': this.cashfreeClientSecret,
          'x-api-version': this.cashfreeApiVersion,
          'x-idempotency-key': crypto.createHash('sha256').update(`create:${orderId}`).digest('hex')
            .slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5'),
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Cashfree Create API Error: ${response.status} - ${errorText}`);
        throw new Error(`Failed with status ${response.status}`);
      }

      const data = await response.json();

      // Store Cashfree's true generated order ID (cf_order_id) into cashfreeOrderId, NOT our internal system orderNumber
      const cfOrderId = data.cf_order_id ? String(data.cf_order_id) : data.order_id;
      cashfreeOrderId = cfOrderId;
      paymentSessionId = data.payment_session_id;
      amount = data.order_amount;
      currency = data.order_currency || 'INR';

      this.logger.log(
        `✅ Cashfree order created: cf_order_id=${cfOrderId}, merchant_order_id=${merchantOrderId} (session: ${paymentSessionId})`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Cashfree order creation failed: ${error.message}`,
      );

      // Network-level failures are NOT client errors — surface as 503
      if (error instanceof ServiceUnavailableException) throw error;
      const isNetworkError =
        error.message?.includes('fetch failed') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('ENOTFOUND');

      if (isNetworkError) {
        throw new ServiceUnavailableException(
          'Payment gateway is temporarily unreachable. Please try again.',
        );
      }

      throw new BadRequestException(
        `Payment initiation failed: ${error.message}`,
      );
    }

    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
      const current = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      await tx.paymentAttempt.upsert({
        where: { cashfreeOrderId }, update: { paymentSessionId },
        create: { orderId, cashfreeOrderId, paymentSessionId, amount: order.totalAmount,
          status: current.paymentStatus === 'PAID' ? 'PAID' : 'PENDING' },
      });
      if (current.paymentStatus === 'PAID' || current.status !== 'PENDING') return;
      await tx.paymentAttempt.updateMany({
        where: { orderId, cashfreeOrderId: { not: cashfreeOrderId }, status: 'PENDING' },
        data: { status: 'SUPERSEDED' },
      });
      await tx.order.update({ where: { id: orderId }, data: {
        cashfreeOrderId, paymentStatus: 'PROCESSING',
        paymentData: { ...((current.paymentData as object) || {}),
          initiatedAt: new Date().toISOString(), gateway: 'cashfree', cf_order_id: cashfreeOrderId,
          order_id: order.orderNumber || `ORD_${orderId.slice(-6).toUpperCase()}`,
        },
      } });
    });

    return {
      cashfreeOrderId,
      paymentSessionId,
      amount,
      currency,
      environment: gatewayEnv,
    };
  }

  /**
   * Verify payment after user completes Cashfree checkout
   */
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

  async verifyPayment(dto: VerifyPaymentDto, userId: string) {
    // Find attempt or order
    let attempt = await this.prisma.paymentAttempt.findUnique({
      where: { cashfreeOrderId: dto.cashfreeOrderId },
      include: { order: { include: { user: true, stock: true, basket: true } } }
    });

    let order: any = attempt?.order;
    if (!order) {
      order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: { user: true, stock: true, basket: true }
      });
    }

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new BadRequestException('Order does not belong to user');
    }

    if (order.paymentStatus === 'PAID' || order.status === 'PAID' || order.status === 'COMPLETED') {
      return { success: true, message: 'Payment already verified', order: this.sanitizeOrder(order) };
    }

    // Collect ALL payment attempt session IDs for this order to guard against multi-session mode switching
    const attempts = await this.prisma.paymentAttempt.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'desc' }
    });

    const candidateSessionIds = new Set<string>();
    const merchantId = (order.paymentData as any)?.order_id || order.orderNumber;
    if (merchantId) candidateSessionIds.add(merchantId);

    let paidSessionId: string | null = null;
    let cfPaymentId = '';
    let resolvedCfOrderId = '';

    for (const cfOrderId of Array.from(candidateSessionIds)) {
      try {
        const orderData = await this.fetchCashfreeOrderStatus(cfOrderId);
        this.logger.log(
          `Verifying Cashfree session ${cfOrderId} for Order ${order.id}: status=${orderData.order_status}`
        );

        if (orderData.order_status === 'PAID') {
          paidSessionId = cfOrderId;
          resolvedCfOrderId = orderData.cf_order_id ? String(orderData.cf_order_id) : cfOrderId;

          // Attempt to fetch actual cf_payment_id from /payments endpoint
          try {
            const cfPayments = await this.fetchCashfreePaymentDetails(cfOrderId);
            const successfulPayment = cfPayments?.find((p: any) => p.payment_status === 'SUCCESS');
            if (successfulPayment?.cf_payment_id) {
              cfPaymentId = String(successfulPayment.cf_payment_id);
            }
          } catch (e: any) {
            this.logger.warn(`Could not fetch payment details for ${cfOrderId}: ${e.message}`);
          }

          if (!cfPaymentId) {
            cfPaymentId = orderData.cf_order_id?.toString() || cfOrderId;
          }
          break;
        }
      } catch (error: any) {
        this.logger.warn(`Could not verify Cashfree session ${cfOrderId}: ${error.message}`);
      }
    }

    if (paidSessionId) {
      this.logger.log(`🎉 Found PAID session ${paidSessionId} for Order ${order.id}! Settling order...`);
      const matchingAttempt = attempts.find((a) => a.cashfreeOrderId === resolvedCfOrderId);
      if (matchingAttempt) {
        return await this.settleAttempt(matchingAttempt.id, order.id, cfPaymentId, order, resolvedCfOrderId);
      } else {
        return await this.handlePaymentSuccess(order.id, cfPaymentId, order, resolvedCfOrderId);
      }
    } else {
      throw new ServiceUnavailableException('Payment has not been confirmed yet. Please check again shortly.');
    }
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
      gateway: 'cashfree',
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
    const bankLedger = await this.getCashfreeLedger();
    if (!bankLedger) {
      throw new Error(
        'Cashfree Gateway control ledger not found.',
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
            modeOfPayment: order.paymentData?.payment_method || 'Cashfree',
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
  private async getCashfreeLedger(): Promise<{ id: string; name: string }> {
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('payment-cashfree-ledger', 0))::text`;
    let cashfreeLedger = await tx.ledger.findFirst({
      where: {
        AND: [
          { isActive: true },
          { NOT: { name: { contains: 'HDFC', mode: 'insensitive' } } },
          { NOT: { name: { contains: 'Inter DP', mode: 'insensitive' } } },
          {
            OR: [
              { name: { contains: 'CASHFREE PAYMENTS INDIA PVT LTD', mode: 'insensitive' } },
              { name: { contains: 'Cashfree', mode: 'insensitive' } },
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
          name: 'CASHFREE PAYMENTS INDIA PVT LTD',
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
          gateway: 'cashfree',
        },
      },
    });

    this.logger.error(
      `❌ Payment verification failed for order ${orderId}: ${reason}`,
    );

    // Unpaid attempts stay silent; the checkout response still explains the failure.

    throw new BadRequestException(`Payment verification failed: ${reason}`);
  }

  /**
   * Process asynchronous webhooks from Cashfree (Handles all event types & payment outcomes)
   */
  async processWebhookPayload(data: any) {
    const { body } = data;
    const type = body?.type || body?.event || 'UNKNOWN';
    const settlementEventType = type.toUpperCase().includes('SETTLEMENT') || type.toUpperCase().includes('TRANSFER');
    const settlementData = body?.data?.settlement || body?.settlement ||
      (settlementEventType ? body?.data || body : undefined);
    const rawOrderId =
      body?.data?.order?.order_id ||
      settlementData?.order_id ||
      body?.order_id ||
      body?.data?.order_id;
    const rawCfOrderId =
      body?.data?.order?.cf_order_id?.toString() ||
      settlementData?.cf_order_id?.toString() ||
      body?.cf_order_id?.toString();
    const cfPaymentId =
      body?.data?.payment?.cf_payment_id?.toString() ||
      body?.payment_id?.toString() ||
      body?.data?.payment_id?.toString();
    const status =
      body?.data?.payment?.payment_status ||
      body?.payment_status ||
      body?.data?.order?.order_status ||
      body?.order_status;

    if (!rawOrderId && !rawCfOrderId) {
      this.logger.warn(`Webhook received without order identifier: ${JSON.stringify(body)}`);
      return;
    }

    const candidates = [rawOrderId, rawCfOrderId].filter(Boolean) as string[];

    // 1. Look for PaymentAttempt by cashfreeOrderId or id
    let attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        OR: [
          { cashfreeOrderId: { in: candidates } },
          { id: { in: candidates } }
        ]
      },
      include: { order: { include: { user: true, stock: true, basket: true } } }
    });

    // 2. Fallback: Search Order directly by cashfreeOrderId, orderNumber, or UUID id
    let order = attempt?.order ?? null;
    if (!order) {
      order = await this.prisma.order.findFirst({
        where: {
          OR: [
            { cashfreeOrderId: { in: candidates } },
            { orderNumber: { in: candidates } },
            { id: { in: candidates } }
          ]
        },
        include: { user: true, stock: true, basket: true }
      });
    }

    if (!order) {
      this.logger.warn(`Webhook received for unknown Order/PaymentAttempt: ${candidates.join(', ')}`);
      throw new Error('Webhook order is not yet available');
    }

    this.logger.log(`Processing Cashfree webhook: type=${type}, status=${status}, orderId=${order.id}, orderNumber=${order.orderNumber}`);

    const isSettlement = settlementEventType || Boolean(settlementData);
    const isSuccess = !isSettlement && (
      type === 'PAYMENT_SUCCESS_WEBHOOK' ||
      status === 'SUCCESS' ||
      status === 'PAID');

    const isUserDropped = !isSettlement && (
      type === 'PAYMENT_USER_DROPPED_WEBHOOK' ||
      type === 'USER_DROPPED_WEBHOOK' ||
      status === 'USER_DROPPED' ||
      status === 'ABANDONED_CHECKOUT' ||
      status === 'ABANDONED');

    const isFailure = !isSettlement && (
      type === 'PAYMENT_FAILED_WEBHOOK' ||
      type === 'PAYMENT_DECLINED_WEBHOOK' ||
      type === 'PAYMENT_EXPIRED_WEBHOOK' ||
      status === 'FAILED' ||
      status === 'DECLINED' ||
      status === 'CANCELLED' ||
      status === 'EXPIRED');

    // Store rich payload on order.paymentData for Cashfree Reconciliation & Audit
    const existingPaymentData = (order.paymentData as object) || {};
    let updatedPaymentData: Record<string, any> = {
      rawWebhookPayload: body,
      cf_order_id: rawCfOrderId || (existingPaymentData as any)?.cf_order_id,
      order_id: rawOrderId || (existingPaymentData as any)?.order_id,
      cfPaymentId: cfPaymentId || (existingPaymentData as any)?.cfPaymentId || null,
      cfOrderStatus: status || (existingPaymentData as any)?.cfOrderStatus || null,
      webhookEventType: type,
      lastWebhookReceivedAt: new Date().toISOString()
    };

    if (cfPaymentId) {
      updatedPaymentData.cf_payment_id = cfPaymentId;
      updatedPaymentData.payment_id = cfPaymentId;
    }
    const paymentDetails = body?.data?.payment;
    if (paymentDetails?.bank_reference) updatedPaymentData.bank_reference = paymentDetails.bank_reference;
    if (paymentDetails?.payment_method) updatedPaymentData.payment_method = paymentDetails.payment_method;
    if (paymentDetails?.payment_group) updatedPaymentData.payment_group = paymentDetails.payment_group;

    if (isSuccess) {
      const receivedAmount = Number(body?.data?.payment?.payment_amount);
      const currency = body?.data?.payment?.payment_currency;
      if (!cfPaymentId || status !== 'SUCCESS' || !Number.isFinite(receivedAmount) ||
          receivedAmount !== Number(order.totalAmount) || currency !== 'INR') {
        throw new BadRequestException('Webhook payment details do not match the order');
      }
      this.logger.log(`✅ Webhook confirmed SUCCESS for order ${order.orderNumber}`);
      if (attempt) {
        await this.settleAttempt(attempt.id, order.id, cfPaymentId, order, rawCfOrderId, updatedPaymentData);
      } else {
        await this.handlePaymentSuccess(
          order.id, cfPaymentId, order, rawCfOrderId, undefined, updatedPaymentData,
        );
      }
    } else if (isUserDropped || isFailure) {
      const targetStatus = isUserDropped ? 'USER_DROPPED' : 'FAILED';
      const failureReason =
        body?.data?.payment?.payment_message ||
        body?.data?.error_details?.error_description ||
        (isUserDropped ? 'User dropped or closed payment checkout popup' : 'Payment failed via gateway webhook');

      this.logger.warn(`❌ Webhook confirmed ${targetStatus} for order ${order.orderNumber}: ${failureReason}`);

      if (attempt) {
        await this.prisma.paymentAttempt.updateMany({
          where: { id: attempt.id, status: { not: 'PAID' } },
          data: { status: isUserDropped ? 'USER_DROPPED' : 'FAILED' }
        });
      }

      await this.prisma.order.updateMany({
        where: { id: order.id, paymentStatus: { not: 'PAID' } },
        data: {
          paymentStatus: targetStatus,
          paymentData: {
            ...existingPaymentData,
            ...updatedPaymentData,
            failureReason,
            failedAt: new Date().toISOString()
          }
        }
      });
    } else {
      // General webhook updates (settlements, disputes, verification updates, refunds)
      if (isSettlement && settlementData) {
        const st = settlementData;
        const cfSettlementId = st.cf_settlement_id || st.settlement_id || st.transfer_id;
        const transferUtr = st.transfer_utr || st.utr;
        const transferTime = st.transfer_time || st.settlement_date || body.event_time || new Date().toISOString();
        const parseAmount = (value: unknown) => {
          if (value === undefined || value === null || value === '') return undefined;
          const amount = Number(value);
          return Number.isFinite(amount) ? amount : undefined;
        };
        const serviceCharge = parseAmount(st.service_charge ?? st.fee);
        const serviceTax = parseAmount(st.service_tax ?? st.tax);
        const settlementAmount = parseAmount(st.settlement_amount ?? st.amount);

        updatedPaymentData = {
          ...updatedPaymentData,
          cf_settlement_id: cfSettlementId || (existingPaymentData as any)?.cf_settlement_id,
          transfer_utr: transferUtr || (existingPaymentData as any)?.transfer_utr,
          settlement_utr: transferUtr || (existingPaymentData as any)?.settlement_utr,
          transfer_time: transferTime || (existingPaymentData as any)?.transfer_time,
          settlement_date: transferTime || (existingPaymentData as any)?.settlement_date,
          service_charge: serviceCharge ?? (existingPaymentData as any)?.service_charge,
          service_tax: serviceTax ?? (existingPaymentData as any)?.service_tax,
          settlement_amount: settlementAmount ?? (existingPaymentData as any)?.settlement_amount,
          settlement_status: 'SUCCESS',
        };

        this.logger.log(`🏦 Cashfree Settlement Webhook received for order ${order.orderNumber}: UTR=${transferUtr}, Net=${settlementAmount}`);
      } else {
        this.logger.log(`ℹ Webhook info update (${type}) logged for order ${order.orderNumber}`);
      }

      await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
        const current = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
        await tx.order.update({ where: { id: order.id }, data: {
          paymentData: { ...((current.paymentData as object) || {}), ...updatedPaymentData },
        } });
      });
    }
  }

  /**
   * Get payment status for an order
   */
  async getPaymentStatus(orderId: string, userId: string) {
    let order: any = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { stock: true, basket: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new BadRequestException('Order does not belong to user');
    }

    if (order.paymentStatus !== 'PAID' && !['COMPLETED', 'PAID'].includes(order.status) && order.cashfreeOrderId) {
      await this.paymentQueue.add('reconcile-order', { orderId }, {
        jobId: `reconcile-${orderId}-${Math.floor(Date.now() / 30_000)}`,
      }).catch(() => this.logger.warn('Payment reconciliation queue unavailable'));

    }

    return {
      orderId: order.id,
      paymentStatus: order.paymentStatus,
      cashfreeOrderId: order.cashfreeOrderId,
      cashfreePaymentId: order.cashfreePaymentId,
      amount: order.totalAmount,
      paymentData: order.paymentData,
    };
  }

  async reconcileOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId }, include: { user: true, stock: true, basket: true },
    });
    if (!order || order.paymentStatus === 'PAID') return;
    const merchantId = (order.paymentData as any)?.order_id || order.orderNumber;
    if (!merchantId) return;
    const cfOrder = await this.fetchCashfreeOrderStatus(merchantId);
    const payments = await this.fetchCashfreePaymentDetails(merchantId);
    const payment = payments.find(p => p.payment_status === 'SUCCESS');
    if (!payment?.cf_payment_id) {
      if (cfOrder.order_status === 'PAID') throw new Error('Paid order has no successful payment details yet');
      return;
    }
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { cashfreeOrderId: String(cfOrder.cf_order_id) },
    });
    return this.handlePaymentSuccess(orderId, String(payment.cf_payment_id), order, String(cfOrder.cf_order_id), attempt?.id);
  }

  /**
   * Admin endpoint to manually update payment status
   */
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
          gateway: 'cashfree',
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
