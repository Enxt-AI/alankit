import { reserveStock } from '../common/stock-inventory';
import { EsignRequestsService } from './esign-requests.service';
import { AlankitEsignService } from './alankit-esign.service';
import { allocateVoucherNumber } from 'db-unlistedstock';
import { assertCompletionTransfer } from './completion-validation';
import { SignedDealSheetService } from './signed-deal-sheet.service';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
// NOTE: ReferralsService and RMReferralsService were removed as part of the
// RM and referral system deprecation. Commission and reward tracking on order
// completion has been removed.
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from 'email-service';
import { CouponsService } from '../coupons/coupons.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { PdfGeneratorService } from './pdf-generator.service';
import { GenerateESignSessionDto } from './dto/generate-esign-session.dto';
import { RedisService } from '../redis/redis.service';
import { validateSignerIdentity } from './esign-validation.util';
import { AccountingService } from '../accounting/accounting.service';
import { deepDecryptSensitiveFields } from 'db-unlistedstock';

import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

/**
 * Orders Service
 * Handles all order-related business logic
 * Automatically updates referral rewards when orders are completed
 */
@Injectable()
export class OrdersService {
  private readonly logger = new PinoNestLogger('stocks-service', 'OrdersService');

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
    private couponsService: CouponsService,
    private configService: ConfigService,
    private pdfGeneratorService: PdfGeneratorService,
    private redisService: RedisService,
    private accountingService: AccountingService,
    @InjectQueue('alankit-esign') private esignQueue: Queue,
    private signedDealSheets: SignedDealSheetService,
    private esignRequests: EsignRequestsService,
    private alankitEsign: AlankitEsignService,
  ) {}

  /**
   * Fetch the eSign PDF buffer from MinIO.
   * pdfUrl can be:
   *   - Relative path: "esign-documents/esign-document.pdf"
   *   - Absolute URL: "http://localhost:9000/esign-documents/esign-document.pdf"
   * In both cases, the full URL is resolved using MINIO_ENDPOINT at runtime.
   */
  private htmlTemplateCache: { url: string; content: string; timestamp: number } | null = null;
  private readonly CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes cache for 1.3MB templates

  /**
   * First-class eSign attempt log (powers marketing e-sign dropouts).
   * Required ownership record: persist before returning a session to the browser.
   */
  private async logEsignAttempt(data: {
    userId: string;
    docId: string;
    stockId?: string | null;
    basketId?: string | null;
    stockName?: string | null;
    quantity?: number;
    pricePerShare?: number | null;
    totalAmount?: number | null;
    orderId?: string | null;
    intent?: any;
  }) {
    data.docId = this.normalizeESignDocId(data.docId);
    try {
      await this.prisma.esignAttempt.upsert({
        where: { docId: data.docId },
        update: {
          ...(data.orderId ? { orderId: data.orderId } : {}),
          ...(data.intent ? { intent: data.intent } : {}),
        },
        create: {
          userId: data.userId,
          docId: data.docId,
          stockId: data.stockId ?? null,
          basketId: data.basketId ?? null,
          stockName: data.stockName ?? null,
          quantity: data.quantity ?? 1,
          pricePerShare: data.pricePerShare ?? null,
          totalAmount: data.totalAmount ?? null,
          orderId: data.orderId ?? null,
          status: 'INITIATED',
          intent: data.intent ?? undefined,
        },
      });
    } catch (err: any) {
      this.logger.error(`[esign-attempt] log failed for docId ${data.docId}: ${err?.message}`);
      throw new ServiceUnavailableException('Unable to save your e-sign session. Please try again before signing.');
    }
  }

  private async markEsignAttempt(
    docId: string,
    status: 'SIGNED' | 'CANCELLED' | 'MISMATCH' | 'FAILED' | 'EXPIRED',
    extra?: { orderId?: string },
  ) {
    try {
      await (this.prisma as any).esignAttempt.updateMany({
        where: { docId },
        data: {
          status,
          ...(extra?.orderId ? { orderId: extra.orderId } : {}),
          ...(status === 'SIGNED' ? { signedAt: new Date() } : {}),
        },
      });
    } catch (err: any) {
      this.logger.error(`[esign-attempt] mark ${status} failed for docId ${docId}: ${err?.message}`);
    }
  }

  private async recordEsignIdentityVerdict(docId: string, verdict: string) {
    const attempt = await this.prisma.esignAttempt.findUnique({ where: { docId } });
    if (!attempt) return;
    const intent = (attempt.intent as Record<string, any> | null) ?? {};
    await this.prisma.esignAttempt.update({
      where: { docId },
      data: { intent: { ...intent, identityVerificationVerdict: verdict } },
    });
  }

  private async createAlankitSession(
    user: any,
    stock: any,
    deal: { quantity: number; totalAmount: number; pricePerShare: number; basePrice: number; discountAmount?: number },
  ) {
    const activeTemplate = await this.prisma.eSignTemplate.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (!activeTemplate?.pdfUrl) {
      throw new BadRequestException('The e-sign deal-sheet template has not been configured by an admin.');
    }

    const htmlTemplate = await this.fetchESignHtml(activeTemplate.pdfUrl);
    if (!htmlTemplate) {
      throw new BadRequestException('The e-sign deal-sheet template could not be loaded.');
    }

    let pdf: Buffer;
    try {
      pdf = await this.pdfGeneratorService.fillDealSheet(
        htmlTemplate,
        this.pdfGeneratorService.buildDealSheetData(user, stock, deal),
      );
    } catch (error: any) {
      this.logger.error('Deal-sheet PDF generation failed', error);
      throw new BadRequestException('Failed to generate the e-sign document.');
    }
    if (!pdf?.length) throw new BadRequestException('Failed to generate the e-sign document.');

    const signerName = typeof user?.fullName === 'string' ? user.fullName.trim() : '';
    if (!signerName) throw new BadRequestException('A verified signer name is required for e-signing.');
    return this.alankitEsign.createTransaction({ signerName, location: 'India', pdf });
  }

  async cleanupAlankitSourcePdfs() {
    if (!this.configService.get('ALANKIT_ESIGN_SUBSCRIPTION_KEY')) return;
    const removed = await this.signedDealSheets.cleanupExpiredAlankitSourcePdfs();
    if (removed) this.logger.log(`Removed ${removed} expired Alankit source e-sign PDFs`);
  }

  private async fetchESignHtml(pdfUrl: string): Promise<string | null> {
    if (!pdfUrl) return null;

    if (this.htmlTemplateCache && this.htmlTemplateCache.url === pdfUrl && Date.now() - this.htmlTemplateCache.timestamp < this.CACHE_TTL_MS) {
      this.logger.log(`Using cached HTML template for ${pdfUrl}`);
      return this.htmlTemplateCache.content;
    }

    const minioEndpoint = this.configService.get('MINIO_ENDPOINT', 'http://localhost:9000');

    // If it's a relative path (no protocol), prepend the MinIO endpoint
    // If it's an absolute URL with localhost/old domain, re-resolve with current endpoint
    let fullUrl: string;
    if (pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://')) {
      // Extract just the path portion (bucket/key) and re-resolve
      try {
        const parsed = new URL(pdfUrl);
        const relativePath = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
        fullUrl = `${minioEndpoint}/${relativePath}${parsed.search}`;
      } catch {
        fullUrl = pdfUrl; // If URL parsing fails, use as-is
      }
    } else {
      fullUrl = `${minioEndpoint}/${pdfUrl}`;
    }

    try {
      this.logger.log(`Fetching eSign HTML template from MinIO: ${fullUrl}`);
      const res = await fetch(fullUrl);
      if (res.ok) {
        const text = await res.text();
        this.logger.log(`Fetched HTML template from MinIO (${text.length} chars)`);
        this.htmlTemplateCache = { url: pdfUrl, content: text, timestamp: Date.now() };
        return text;
      }
      this.logger.warn(`MinIO HTML fetch failed: ${res.status} ${res.statusText}`);
    } catch (e: any) {
      this.logger.warn(`Failed to fetch HTML from MinIO: ${e.message}`);
    }
    return null;
  }

  /**
   * Generates a random alphanumeric ID with the given prefix.
   * e.g., 'ORD-A9F3B2'
   */
  private generateAlphanumericId(prefix: string): string {
    const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${randomPart}`;
  }

  /**
   * Generate a unique receipt number for an order.
   * Format: RCPT-XXXXXX
   */
  private async generateUniqueReceiptNumber(tx?: any): Promise<string> {
    const db = tx || this.prisma;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = this.generateAlphanumericId('RCPT');
      const existing = await db.order.findUnique({
        where: { receiptNumber: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
    }
    return `RCPT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }

  /**
   * Generate a unique invoice number for an order.
   * Format: INV-XXXXXX
   */
  private async generateUniqueInvoiceNumber(tx?: any): Promise<string> {
    const db = tx || this.prisma;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = this.generateAlphanumericId('INV');
      const existing = await db.order.findUnique({
        where: { invoiceNumber: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
    }
    return `INV-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }

  /**
   * Resolves the effective price-per-share for a given quantity by applying
   * the stock's slab pricing rules.
   *
   * Algorithm: find the slab with the highest `minQty` that is still
   * <= the requested quantity. If no slab qualifies, fall back to `basePrice`.
   *
   * @param basePrice   - The stock's `price` field (default rate)
   * @param discountSlabs - JSON array from the Stock model, may be null
   * @param quantity    - Number of shares the user wants to buy
   * @returns Effective price per share
   */
  private resolveSlabPrice(
    basePrice: number,
    discountSlabs: unknown,
    quantity: number,
  ): number {
    if (!discountSlabs || !Array.isArray(discountSlabs) || discountSlabs.length === 0) {
      return basePrice;
    }

    // Calculate total purchase amount before discount
    const totalPurchaseAmount = basePrice * quantity;

    // Cast and sort descending by minAmount so we find the best matching slab first
    const slabs = (discountSlabs as { minAmount: number; pricePerShare: number }[])
      .filter((s) => typeof s.minAmount === 'number' && typeof s.pricePerShare === 'number' && s.pricePerShare > 0)
      .sort((a, b) => b.minAmount - a.minAmount);

    const matched = slabs.find((s) => totalPurchaseAmount >= s.minAmount);
    return matched ? matched.pricePerShare : basePrice;
  }

  /**
   * Create a new order (User endpoint)
   * @param dto - Order creation data
   * @param userId - ID of user creating the order
   * @returns Created order
   */
  async createOrder(dto: CreateOrderDto, userId: string) {
    // Check KYC verification status first
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true, email: true },
    });

    if (!user || user.kycStatus !== 'VERIFIED') {
      this.logger.warn(
        `Order creation blocked for user ${userId} - KYC not verified`,
      );
      throw new BadRequestException(
        'KYC verification is required to purchase stocks. Please complete your KYC verification first.',
      );
    }

    // Check email presence for order creation
    if (!user.email || user.email.trim() === '') {
      this.logger.warn(
        `Order creation blocked for user ${userId} - Email not provided`,
      );
      throw new BadRequestException(
        'Email is required to create orders. Please complete your account setup by linking your Google account.',
      );
    }

    let pricePerShare: number;
    let totalAmount: number;
    let orderData: any;

    // Branch based on order type
    if (dto.basketId) {
      throw new BadRequestException('Basket orders are no longer supported.');
    } else {
      // ===== STOCK ORDER FLOW =====
      // Check if stock exists and is active
      const stock = await this.prisma.stock.findUnique({
        where: { id: dto.stockId },
      });

      if (!stock) {
        throw new NotFoundException(`Stock with ID ${dto.stockId} not found`);
      }

      if (!stock.isActive) {
        throw new BadRequestException(
          'This stock is not available for purchase',
        );
      }

      // Prevent purchase if both normal stock and backup quantity are zero or insufficient
      const availablePhysical = Math.max(0, stock.stockQuantity || 0);
      const availableBackup = stock.backupQuantity || 0;
      const totalAvailableStock = availablePhysical + availableBackup;

      if (totalAvailableStock <= 0) {
        throw new BadRequestException(
          `This stock is currently out of stock (quantity is 0)`,
        );
      }
      if (dto.quantity > totalAvailableStock) {
        throw new BadRequestException(
          `Only ${totalAvailableStock} shares are currently available for purchase.`,
        );
      }
      if (stock.minimumPurchaseQuantity !== null && stock.minimumPurchaseQuantity !== undefined && dto.quantity < stock.minimumPurchaseQuantity) {
        throw new BadRequestException(
          `Minimum purchase quantity for this stock is ${stock.minimumPurchaseQuantity}.`,
        );
      }
      if (stock.maximumPurchaseQuantity !== null && stock.maximumPurchaseQuantity !== undefined && dto.quantity > stock.maximumPurchaseQuantity) {
        throw new BadRequestException(
          `Maximum purchase quantity for this stock is ${stock.maximumPurchaseQuantity}.`,
        );
      }
      // Note: The actual check against dto.quantity is done atomically in the transaction below.

      // Calculate total amount — apply slab pricing if configured
      pricePerShare = this.resolveSlabPrice(stock.price, stock.discountSlabs, dto.quantity);
      totalAmount = Number((pricePerShare * dto.quantity).toFixed(2));

      const slabApplied = pricePerShare !== stock.price;

      orderData = {
        userId,
        stockId: dto.stockId,
        basketId: null,
        quantity: dto.quantity,
        pricePerShare,
        totalAmount,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        orderNumber: this.generateAlphanumericId('ORD'),
        paymentData: {
          createdAt: new Date().toISOString(),
          // Audit trail: record whether a slab discount changed the unit price
          slabDiscountApplied: slabApplied,
          basePrice: stock.price,
          resolvedPricePerShare: pricePerShare,
        },
      };

      // Evaluate coupon
      if (dto.couponCode) {
         const validation = await this.couponsService.validateCoupon(
           dto.couponCode,
           dto.stockId!,
           dto.quantity,
           userId
         );

         orderData.couponId = validation.couponId;
         orderData.discountApplied = validation.discountAmount;
         orderData.originalTotalAmount = orderData.totalAmount;
         orderData.totalAmount = Number((orderData.totalAmount - validation.discountAmount).toFixed(2));

         // Fetch the applied coupon to determine RM type and snapshot revenue settings
         const appliedCoupon = await this.prisma.coupon.findUnique({
           where: { id: validation.couponId },
           select: { internalRmId: true, distributorRmId: true, lendingPrice: true }
         });

         if (appliedCoupon) {
           const settingType = appliedCoupon.internalRmId ? 'INTERNAL' : (appliedCoupon.distributorRmId ? 'EXTERNAL' : null);
           if (settingType) {
             const settings = await this.prisma.revenueShareSetting.findUnique({
               where: { type: settingType }
             });
             if (settings) {
               orderData.revenueSharePercentage = settings.revenuePercentage;
               orderData.incentivePercentage = settings.incentivePercentage;
             }
             (orderData as any).lendingPrice = (appliedCoupon as any).lendingPrice ?? (
               settingType === 'EXTERNAL'
                 ? (stock?.externalLendingPrice ?? null)
                 : (stock?.internalLendingPrice ?? null)
             );
           }
         }
      }

      if ((orderData as any).lendingPrice === undefined && stock) {
        (orderData as any).lendingPrice = stock.internalLendingPrice ?? stock.externalLendingPrice ?? null;
      }
    }

    // Calculate reservation expiration
    orderData.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // The sign-first flow may link only a completed, independently matched session.
    // The order-first flow can reserve a pending order; payment remains gated on
    // the same identity verdict in the payments service.
    if (dto.esignDocId) {
      dto.esignDocId = await this.assertESignOwner(dto.esignDocId, userId);
      const esignAttempt = await this.prisma.esignAttempt.findUnique({ where: { docId: dto.esignDocId } });
      const esignIntent = esignAttempt?.intent as Record<string, any> | null;
      if (esignAttempt?.status !== 'SIGNED' || esignIntent?.identityVerificationVerdict !== 'MATCH') {
        throw new BadRequestException('A completed e-sign with a verified KYC identity match is required before linking it to an order.');
      }
      orderData.esignDocId = dto.esignDocId;
      orderData.esignStatus = 'SIGNED';
      orderData.esignValidationVerdict = 'MATCH';
    }

    // Create order and deduct stock atomically within a transaction
    const order = await this.prisma.$transaction(async (tx) => {
      // 1. Atomic Check-and-Decrement
      if (dto.basketId) {
        // We have pre-fetched basket in the outer scope, but we only have its ID.
        // We rely on the constituents snapshot created above.
        const constituentsList = orderData.basketConstituents.constituents || [];
        for (const c of constituentsList) {
          const constituentValue = orderData.pricePerShare * dto.quantity * (c.weight / 100);
          const constituentQuantity = Math.round(constituentValue / c.priceAtOrder);

          c.backupQuantityUsed = await reserveStock(tx, c.stockId, constituentQuantity);
        }
      } else {
        const backupToDeduct = await reserveStock(tx, dto.stockId!, dto.quantity);

        if (backupToDeduct > 0) {
          orderData.paymentData = {
            ...(orderData.paymentData || {}),
            backupQuantityUsed: backupToDeduct,
          };
        }
      }

      // 2. Create the Order
      return await tx.order.create({
        data: orderData,
        include: {
          stock: {
            select: {
              id: true,
              name: true,
              cin: true,
              logoUrl: true,
            },
          },
          basket: {
            select: {
              id: true,
              name: true,
              slug: true,
              iconUrl: true,
              category: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      });
    });

    // NOTE: Order confirmation email is NOT sent here.
    // It is sent only after payment is verified (PAID) in payments-service.

    // Link the sign-first e-sign attempt to its order (first-class log).
    if ((dto as any).esignDocId) {
      await this.markEsignAttempt((dto as any).esignDocId, 'SIGNED', { orderId: order.id });
    }

    // Order confirmations are sent by payments-service only after payment is PAID.

    return order;
  }

  /**
   * Get all orders for a specific user (User endpoint)
   * @param userId - User ID
   * @returns User's orders
   */
  async getUserOrders(userId: string) {
    return await this.prisma.order.findMany({
      where: { userId },
      include: {
        stock: {
          select: {
            id: true,
            name: true,
            cin: true,
            logoUrl: true,
            price: true,
          },
        },
        basket: {
          select: {
            id: true,
            name: true,
            slug: true,
            iconUrl: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single order by ID (User endpoint)
   * @param orderId - Order ID
   * @param userId - User ID (for authorization)
   * @returns Order details
   */
  async getOrderById(orderId: string, userId: string) {
    const isOrderNumber = orderId.startsWith('ORD-') || orderId.startsWith('ORD_');
    const order = await this.prisma.order.findFirst({
      where: isOrderNumber ? { orderNumber: orderId, userId } : { id: orderId, userId },
      include: {
        stock: {
          select: {
            id: true,
            name: true,
            cin: true,
            logoUrl: true,
            price: true,
          },
        },
        basket: {
          select: {
            id: true,
            name: true,
            slug: true,
            iconUrl: true,
            category: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Ensure user can only access their own orders
    if (order.userId !== userId) {
      throw new BadRequestException('You can only access your own orders');
    }

    return order;
  }

  /**
   * Get all orders (Admin endpoint)
   * @param status - Optional filter by status
   * @returns All orders
   */
  async getAllOrders(status?: string) {
    const where = status ? { status } : {};

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        stock: {
          select: {
            id: true,
            name: true,
            cin: true,
            logoUrl: true,
            isin: true,
          },
        },
        basket: {
          select: {
            id: true,
            name: true,
            slug: true,
            iconUrl: true,
            category: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            dematStatus: true,
            dematData: true,
            kycData: true,
            bankData: true,
            bankStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch batch records to attach batchSequence
    const txnIds = orders
      .map(o => o.cashfreePaymentId || o.cashfreeOrderId || o.shareTransferReferenceNo)
      .filter(Boolean) as string[];

    let batchSeqMap = new Map<string, number | null>();
    
    if (txnIds.length > 0) {
      const batchRecords = await this.prisma.nsdlBatchRecord.findMany({
        where: { transactionId: { in: txnIds } },
        select: { transactionId: true, batchSequence: true },
      });
      batchRecords.forEach(br => {
        if (br.transactionId) batchSeqMap.set(br.transactionId, br.batchSequence);
      });
    }

    return orders.map(order => ({
      ...order,
      user: order.user ? deepDecryptSensitiveFields(order.user) : order.user,
      batchSequence: order.batchSequence
        ?? batchSeqMap.get(order.cashfreePaymentId || '') 
        ?? batchSeqMap.get(order.cashfreeOrderId || '') 
        ?? batchSeqMap.get(order.shareTransferReferenceNo || '') 
        ?? null,
    }));
  }

  /**
   * Generates an Alankit eSign session for a pending order (queued via Bull).
   * @param orderId Internal DB Order ID
   * @param userId Internal User ID
   * @returns docId to be used by the frontend SDK
   */
  async generateESign(orderId: string, userId: string, requestId: string) {
    return this.esignRequests.generate('generate-order-esign', { userId, orderId }, requestId);
  }


  /**
   * Core logic for Alankit eSign session generation for an existing order.
   * Called only by the e-sign worker.
   */
  async processGenerateESign(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, stock: true, basket: true }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new BadRequestException('Unauthorized order access');
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException('e-Sign can only be generated for PENDING orders');
    }

    try {
      const session = await this.createAlankitSession(order.user, order.stock ?? order.basket ?? null, {
        quantity: order.quantity,
        totalAmount: order.totalAmount,
        pricePerShare: order.quantity > 0 ? Number((order.totalAmount / order.quantity).toFixed(2)) : order.pricePerShare,
        basePrice: (order as any).stock?.price ?? order.pricePerShare,
        discountAmount: (order as any).discountApplied ?? undefined,
      });
      await this.logEsignAttempt({
        userId: order.userId,
        docId: session.referenceNo,
        stockId: (order as any).stockId ?? null,
        basketId: (order as any).basketId ?? null,
        stockName: (order as any).stock?.name ?? (order as any).basket?.name ?? null,
        quantity: order.quantity,
        pricePerShare: order.pricePerShare,
        totalAmount: order.totalAmount,
        orderId: order.id,
        intent: { provider: 'ALANKIT', sourceObjectKey: session.sourceObjectKey },
      });
      await this.prisma.order.update({
        where: { id: order.id },
        data: { esignDocId: session.referenceNo, esignStatus: 'PENDING' },
      });
      return { docId: session.referenceNo, eSignUrl: session.redirectUrl, pdfUrl: '' };
    } catch (e: any) {
      this.logger.error('Alankit e-sign session generation failed', e);
      throw e;
    }
  }

  /**
   * Generates an Alankit eSign session without requiring an existing order (queued via Bull).
   * Used when the user needs to sign before the order is created.
   * @param userId  Internal User ID (from JWT)
   * @returns { docId, eSignUrl, pdfUrl }
   */
  async generateESignSession(userId: string, dto: GenerateESignSessionDto, requestId: string) {
    // Canonical field order makes equivalent JSON payloads share a fingerprint.
    const intent = {
      stockId: dto.stockId ?? null,
      basketId: dto.basketId ?? null,
      quantity: dto.quantity,
      couponCode: dto.couponCode ?? null,
      stockPrice: dto.stockPrice ?? null,
      discountedPrice: dto.discountedPrice ?? null,
      discountedPricePerShare: dto.discountedPricePerShare ?? null,
      pricePerShare: dto.pricePerShare ?? null,
    };
    return this.esignRequests.generate('generate-session', { userId, dto: intent }, requestId);
  }


  /**
   * Core logic for Alankit eSign session generation without an order.
   * Called only by the e-sign worker.
   */
  async processGenerateESignSession(userId: string, dto: GenerateESignSessionDto) {
    // ── Fetch user with all KYC/demat/bank data ──────────────────────────────
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // ── Fetch stock/basket for deal sheet values ──────────────────────────────
    let stock: { name: string; isin?: string | null; price?: number | null; discountSlabs?: any } | null = null;
    let basketName: string | null = null;

    if (dto.stockId) {
      stock = await this.prisma.stock.findUnique({
        where: { id: dto.stockId },
        select: { name: true, isin: true, price: true, discountSlabs: true },
      });
    } else if (dto.basketId) {
      const basket = await this.prisma.stockBasket.findUnique({
        where: { id: dto.basketId },
        select: { name: true, minInvestment: true },
      });
      if (basket) {
        basketName = basket.name;
        stock = { name: basket.name, isin: null, price: basket.minInvestment ?? null };
      }
    }

    // ── Compute base price & slab price ───────────────────────────────────────
    const basePrice = stock?.price ?? dto.stockPrice ?? 0;
    const slabPrice = this.resolveSlabPrice(basePrice, stock?.discountSlabs, dto.quantity);
    const slabTotal = Number((slabPrice * dto.quantity).toFixed(2));

    // ── Validate coupon if provided before proceeding ─────────────────────
    let couponDiscount = 0;
    if (dto.couponCode && dto.stockId) {
      const validation = await this.couponsService.validateCoupon(
        dto.couponCode,
        dto.stockId,
        Number(dto.quantity),
        userId,
      );
      couponDiscount = validation?.discountAmount ?? 0;
    }

    // Verified pricing after slabs and coupons
    const verifiedDiscountedPrice = Math.max(0, Number((slabTotal - couponDiscount).toFixed(2)));
    const verifiedDiscountedPricePerShare = dto.quantity > 0
      ? Number((verifiedDiscountedPrice / dto.quantity).toFixed(2))
      : slabPrice;

    // Reconcile with payload's discountedPrice and discountedPricePerShare if provided
    let finalDiscountedPrice = verifiedDiscountedPrice;
    let finalDiscountedPricePerShare = verifiedDiscountedPricePerShare;

    if (
      dto.discountedPrice !== undefined &&
      dto.discountedPrice !== null &&
      !isNaN(dto.discountedPrice) &&
      dto.discountedPrice >= 0
    ) {
      if (Math.abs(dto.discountedPrice - verifiedDiscountedPrice) <= 2) {
        finalDiscountedPrice = Number(dto.discountedPrice.toFixed(2));
      }
    }

    if (
      dto.discountedPricePerShare !== undefined &&
      dto.discountedPricePerShare !== null &&
      !isNaN(dto.discountedPricePerShare) &&
      dto.discountedPricePerShare > 0
    ) {
      if (Math.abs(dto.discountedPricePerShare - verifiedDiscountedPricePerShare) <= 1) {
        finalDiscountedPricePerShare = Number(dto.discountedPricePerShare.toFixed(2));
      }
    } else if (dto.quantity > 0) {
      finalDiscountedPricePerShare = Number((finalDiscountedPrice / dto.quantity).toFixed(2));
    }

    const totalDiscountAmount = Math.max(0, Number(((basePrice * dto.quantity) - finalDiscountedPrice).toFixed(2)));

    // ── Store order intent in Redis (TTL 2 hours) so esign-success can read it ─
    const intentKey = `esign:intent:${userId}`;
    await this.redisService.set(intentKey, {
      stockId: dto.stockId ?? null,
      basketId: dto.basketId ?? null,
      quantity: dto.quantity,
      couponCode: dto.couponCode ?? null,

      stockPrice: basePrice,
      basePrice,
      pricePerShare: finalDiscountedPricePerShare,
      discountedPricePerShare: finalDiscountedPricePerShare,
      discountedPrice: finalDiscountedPrice,
      totalAmount: finalDiscountedPrice,
      discountAmount: totalDiscountAmount,
      slabPrice,

      stockName: stock?.name ?? null,
      isin: stock?.isin ?? null,
      savedAt: new Date().toISOString(),
    }, 7200); // 2 hours
    this.logger.log(`Stored eSign order intent in Redis for user ${userId}`);

    try {
      const session = await this.createAlankitSession(user, stock, {
        quantity: dto.quantity,
        totalAmount: finalDiscountedPrice,
        pricePerShare: finalDiscountedPricePerShare,
        basePrice,
        discountAmount: totalDiscountAmount,
      });
      await this.logEsignAttempt({
        userId,
        docId: session.referenceNo,
        stockId: dto.stockId ?? null,
        basketId: dto.basketId ?? null,
        stockName: stock?.name ?? basketName ?? null,
        quantity: dto.quantity,
        pricePerShare: finalDiscountedPricePerShare,
        totalAmount: finalDiscountedPrice,
        intent: {
          stockId: dto.stockId ?? null,
          basketId: dto.basketId ?? null,
          quantity: dto.quantity,
          couponCode: dto.couponCode ?? null,
          stockPrice: basePrice,
          pricePerShare: finalDiscountedPricePerShare,
          discountedPrice: finalDiscountedPrice,
          discountedPricePerShare: finalDiscountedPricePerShare,
          discountAmount: totalDiscountAmount,
          provider: 'ALANKIT',
          sourceObjectKey: session.sourceObjectKey,
        },
      });
      return { docId: session.referenceNo, eSignUrl: session.redirectUrl, pdfUrl: '' };
    } catch (error) {
      this.logger.error('Alankit e-sign session generation failed', error);
      throw error;
    }
  }

  /**
   * Generate an invoice PDF for a COMPLETED order (User endpoint).
   * Loads the invoice HTML template from MinIO, fills it with order/user data
   * using Puppeteer and returns the PDF buffer.
   *
   * @param orderId   Internal order ID
   * @param userId    Requesting user ID (authorization)
   * @returns         PDF buffer
   */
  async generateInvoice(orderId: string, userId: string): Promise<Buffer> {
    // ── 1. Load order with user + stock ──────────────────────────────────────
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        stock: { select: { id: true, name: true, isin: true } },
        basket: { select: { id: true, name: true } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new BadRequestException('You can only download your own invoices');
    if (order.status !== 'COMPLETED') throw new BadRequestException('Invoice is only available for completed orders');

    // Lazily generate orderNumber if missing (for legacy orders)
    let orderNumber = (order as any).orderNumber;
    if (!orderNumber) {
      orderNumber = this.generateAlphanumericId('ORD');
      await this.prisma.order.update({
        where: { id: order.id },
        data: { orderNumber },
      });
      (order as any).orderNumber = orderNumber;
    }

    // Lazily generate invoiceNumber if missing
    let invoiceNumber = (order as any).invoiceNumber;
    if (!invoiceNumber) {
      invoiceNumber = await this.generateUniqueInvoiceNumber();
      await this.prisma.order.update({
        where: { id: order.id },
        data: { invoiceNumber },
      });
      (order as any).invoiceNumber = invoiceNumber;
    }

    // ── 2. Load the invoice HTML template from the bundled assets ─────────────
    // The file lives at src/assets/invoice-template.html and is copied to
    // dist/assets/invoice-template.html by NestJS (nest-cli.json assets config).
    const assetsDir = path.join(__dirname, '..', 'assets');
    const invoiceTemplatePath = path.join(assetsDir, 'invoice-template.html');

    this.logger.log(`[Invoice] Reading template from: ${invoiceTemplatePath}`);
    let htmlTemplate: string | null = null;
    try {
      htmlTemplate = fs.readFileSync(invoiceTemplatePath, 'utf-8');
      this.logger.log(`[Invoice] Template loaded from disk (${htmlTemplate.length} chars)`);
    } catch (e: any) {
      this.logger.error(`[Invoice] Failed to read template file: ${e.message}`);
    }

    if (!htmlTemplate) {
      throw new BadRequestException(
        'Invoice template could not be loaded. Please contact support.',
      );
    }

    // ── 3. Build invoice data from DB records ─────────────────────────────────
    const stockInfo = order.stock
      ? { name: order.stock.name, isin: order.stock.isin }
      : order.basket
      ? { name: order.basket.name, isin: null }
      : null;

    const invoiceData = this.pdfGeneratorService.buildInvoiceData(order.user, stockInfo, {
      id:            order.id,
      quantity:      order.quantity,
      pricePerShare: order.pricePerShare,
      totalAmount:   order.totalAmount,
      date:          order.updatedAt,
      invoiceNumber: (order as any).invoiceNumber,
    });

    // ── 4. Fill template + render PDF ─────────────────────────────────────────
    try {
      const pdfBuffer = await this.pdfGeneratorService.fillInvoice(htmlTemplate, invoiceData);
      this.logger.log(`[Invoice] PDF ready for order ${orderId} (${pdfBuffer.length} bytes)`);
      return pdfBuffer;
    } catch (pdfErr: any) {
      this.logger.error(`[Invoice] PDF generation failed: ${pdfErr.message}`);
      throw new BadRequestException('Failed to generate invoice PDF.');
    }
  }

  /**
   * Generate a Payment Receipt Advice PDF for an order.
   * Available as soon as the order exists — no status restriction.
   * Date used = order.createdAt (the date the order was placed).
   */
  async generateReceipt(orderId: string, userId: string): Promise<Buffer> {
    // ── 1. Load order ──────────────────────────────────────────────────────────
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        stock: { select: { id: true, name: true } },
        basket: { select: { id: true, name: true } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new BadRequestException('You can only download your own receipts');

    // Receipts can only be generated and downloaded after payment is completed
    const isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'SUCCESS';
    if (!isPaid) {
      throw new BadRequestException('Payment is pending. Receipts can only be generated and downloaded after payment is completed.');
    }

    // Lazily generate orderNumber if missing (for legacy orders)
    let orderNumber = (order as any).orderNumber;
    if (!orderNumber) {
      orderNumber = this.generateAlphanumericId('ORD');
      await this.prisma.order.update({
        where: { id: order.id },
        data: { orderNumber },
      });
      (order as any).orderNumber = orderNumber;
    }

    // Lazily generate receiptNumber if missing
    let receiptNumber = (order as any).receiptNumber;
    if (!receiptNumber) {
      receiptNumber = await this.generateUniqueReceiptNumber();
      await this.prisma.order.update({
        where: { id: order.id },
        data: { receiptNumber },
      });
      (order as any).receiptNumber = receiptNumber;
    }

    // ── 2. Load receipt HTML template ──────────────────────────────────────────
    const assetsDir = path.join(__dirname, '..', 'assets');
    const receiptTemplatePath = path.join(assetsDir, 'receipt-template.html');

    this.logger.log(`[Receipt] Reading template from: ${receiptTemplatePath}`);
    let htmlTemplate: string | null = null;
    try {
      htmlTemplate = fs.readFileSync(receiptTemplatePath, 'utf-8');
      this.logger.log(`[Receipt] Template loaded (${htmlTemplate.length} chars)`);
    } catch (e: any) {
      this.logger.error(`[Receipt] Failed to read template: ${e.message}`);
    }

    if (!htmlTemplate) {
      throw new BadRequestException('Receipt template could not be loaded. Please contact support.');
    }

    // ── 3. Build receipt data ──────────────────────────────────────────────────
    const stockInfo = order.stock
      ? { name: order.stock.name }
      : order.basket
      ? { name: order.basket.name }
      : null;

    const receiptData = this.pdfGeneratorService.buildReceiptData(order.user, stockInfo, {
      id:                 order.id,
      totalAmount:        order.totalAmount,
      createdAt:          order.createdAt,
      cashfreePaymentId:  (order as any).cashfreePaymentId ?? null,
      receiptNumber:      (order as any).receiptNumber,
      orderNumber:        (order as any).orderNumber,
    });

    // ── 4. Render PDF ──────────────────────────────────────────────────────────
    try {
      const pdfBuffer = await this.pdfGeneratorService.fillReceipt(htmlTemplate, receiptData);
      this.logger.log(`[Receipt] PDF ready for order ${orderId} (${pdfBuffer.length} bytes)`);
      return pdfBuffer;
    } catch (pdfErr: any) {
      this.logger.error(`[Receipt] PDF generation failed: ${pdfErr.message}`);
      throw new BadRequestException('Failed to generate receipt PDF.');
    }
  }

  /**
   * Get single order by ID (Admin endpoint)
   * @param orderId - Order ID
   * @returns Order details with full information
   */
  async getOrderByIdAdmin(orderId: string) {
    const includeQuery = {
      stock: {
        select: {
          id: true,
          name: true,
          cin: true,
          logoUrl: true,
          price: true,
          isin: true,
        },
      },
      basket: {
        select: {
          id: true,
          name: true,
          slug: true,
          iconUrl: true,
          category: true,
        },
      },
      coupon: {
        select: {
          id: true,
          code: true,
          discountType: true,
          discountAmount: true,
          discountPercentage: true,
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          kycStatus: true,
          dematStatus: true,
          dematData: true,
          kycData: true,
        },
      },
    };

    let order: any = null;
    try {
      order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: includeQuery,
      });
    } catch {}

    if (!order) {
      const cleanOrder = orderId.replace(/^ORD-?/i, '').trim();
      const cleanLower = cleanOrder.toLowerCase();
      try {
        order = await this.prisma.order.findFirst({
          where: {
            OR: [
              { id: orderId },
              { id: cleanLower },
              { id: { endsWith: cleanLower, mode: 'insensitive' } },
              { id: { contains: cleanLower, mode: 'insensitive' } },
              { cashfreeOrderId: { contains: cleanOrder, mode: 'insensitive' } },
              { cashfreePaymentId: { contains: cleanOrder, mode: 'insensitive' } },
            ],
          },
          include: includeQuery,
        });
      } catch {}

      if (!order) {
        try {
          order = await this.prisma.order.findFirst({
            where: {
              OR: [
                { orderNumber: orderId },
                { orderNumber: `ORD-${cleanOrder}` },
                { orderNumber: cleanOrder },
                { orderNumber: { contains: cleanOrder, mode: 'insensitive' } },
              ],
            },
            include: includeQuery,
          });
        } catch {}
      }
    }

    if (!order) {
      throw new NotFoundException(`Order with ID or Number ${orderId} not found`);
    }

    // If coupon relation is null but couponId exists, resolve coupon explicitly
    if (!order.coupon && order.couponId) {
      try {
        const linkedCoupon = await this.prisma.coupon.findUnique({
          where: { id: order.couponId },
          select: {
            id: true,
            code: true,
            discountType: true,
            discountAmount: true,
            discountPercentage: true,
          },
        });
        if (linkedCoupon) {
          order.coupon = linkedCoupon;
        }
      } catch {}
    }

    if (order.coupon) {
      order.coupon.discountValue =
        order.coupon.discountType === 'PERCENTAGE'
          ? order.coupon.discountPercentage
          : order.coupon.discountAmount;
    }

    return {
      ...order,
      user: order.user ? deepDecryptSensitiveFields(order.user) : order.user,
    };
  }

  /**
   * Update order status (Admin endpoint)
   * Simplified model: only PENDING → COMPLETED transition is allowed.
   * When status is COMPLETED, updates user's portfolio.
   * @param orderId - Order ID
   * @param dto - Status update data
   * @returns Updated order
   */
  async updateOrderStatus(orderId: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // COMPLETED is a terminal state — allow updating transfer reference/date if already completed
    if (order.status === 'COMPLETED' && (!dto.shareTransferReferenceNo || dto.status !== 'COMPLETED')) {
      throw new BadRequestException(
        'This order is already completed and cannot be modified.',
      );
    }

    // Only PENDING/PAID → COMPLETED is a valid transition
    if (dto.status === 'COMPLETED' && !['PENDING', 'PAID', 'COMPLETED'].includes(order.status)) {
      throw new BadRequestException(
        `Cannot mark order as COMPLETED from status ${order.status}.`,
      );
    }

    // Extract share transfer data
    const shareTransferReferenceNo = dto.shareTransferReferenceNo?.trim() || null;
    let shareTransferDate: Date | null = null;
    if (dto.shareTransferDate) {
      shareTransferDate = new Date(dto.shareTransferDate);
    }
    const batchSequence = dto.batchSequence?.trim() || null;
    if (dto.status === 'COMPLETED') {
      // Existing completed orders may receive a partial correction without creating another sale.
      assertCompletionTransfer(
        shareTransferReferenceNo || (order.status === 'COMPLETED' ? order.shareTransferReferenceNo : null),
        shareTransferDate || (order.status === 'COMPLETED' ? order.shareTransferDate : null),
        batchSequence || (order.status === 'COMPLETED' ? order.batchSequence : null),
      );
    }

    // Ensure shareTransferReferenceNo is unique across all orders
    if (shareTransferReferenceNo) {
      const existingOrder = await this.prisma.order.findFirst({
        where: {
          shareTransferReferenceNo,
          id: { not: orderId }, // exclude the current order
        },
        select: { id: true },
      });

      if (existingOrder) {
        throw new BadRequestException(
          `Transfer Reference No. "${shareTransferReferenceNo}" is already used by another order (${existingOrder.id}). Each order must have a unique Transfer Reference No.`,
        );
      }
    }

    // If already COMPLETED and updating transfer details, update directly without repeating settlement/inventory
    if (order.status === 'COMPLETED' && shareTransferReferenceNo) {
      return await this.prisma.order.update({
        where: { id: orderId },
        data: {
          shareTransferReferenceNo,
          ...(shareTransferDate ? { shareTransferDate } : {}),
          ...(batchSequence ? { batchSequence } : {}),
        },
        include: {
          stock: {
            select: {
              id: true,
              name: true,
              cin: true,
              logoUrl: true,
              isin: true,
            },
          },
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
            },
          },
        },
      });
    }

    if (dto.status === 'COMPLETED') {
      const updatedOrder = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
        // 1. Fetch current order with stock/basket details using transaction client
        const currentOrder = await tx.order.findUnique({
          where: { id: orderId },
        });

        if (!currentOrder) {
          throw new NotFoundException(`Order with ID ${orderId} not found`);
        }
        if (!['PENDING', 'PAID'].includes(currentOrder.status)) {
          throw new BadRequestException('Order status changed. Refresh before completing the order.');
        }

        // Generate invoice number and receipt number if missing
        const invoiceNumber = currentOrder.invoiceNumber || (await this.generateUniqueInvoiceNumber(tx));
        const receiptNumber = currentOrder.receiptNumber ||
          (['PAID', 'SUCCESS'].includes(currentOrder.paymentStatus) ? await this.generateUniqueReceiptNumber(tx) : null);

        // Note: Inventory was already decremented atomically during order creation (checkout).
        // We do not decrement again here.
        // 3. Update order status and set share transfer details
        const orderUpdate = await tx.order.update({
          where: { id: orderId },
          data: { 
            status: dto.status,
            shareTransferReferenceNo,
            shareTransferDate,
            batchSequence,
            invoiceNumber,
            receiptNumber,
          },
          include: {
            stock: {
              select: {
                id: true,
                name: true,
                cin: true,
                isin: true,
                logoUrl: true,
              },
            },
            basket: {
              select: {
                id: true,
                name: true,
                slug: true,
                iconUrl: true,
                category: true,
              },
            },
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
        });

        // 4. Update portfolio
        if (currentOrder.stockId && !currentOrder.basketId) {
          await this.updatePortfolio(
            currentOrder.userId,
            currentOrder.stockId,
            currentOrder.quantity,
            currentOrder.pricePerShare,
            tx,
          );
        } else if (currentOrder.basketId && currentOrder.basketConstituents) {
          await this.updatePortfolioForBasket(
            currentOrder.userId,
            currentOrder.basketConstituents,
            currentOrder.quantity,
            currentOrder.pricePerShare,
            tx,
          );
        }

        // 5. Generate Sales Voucher & Receipt Voucher inside the transaction (Auto-Approved)
        await this.generateSalesVoucher(orderUpdate, tx);
        await this.generateReceiptVoucher(orderUpdate, tx);

        // 6. Lock Coupon if applied (RM coupons are single-use; Admin promotional coupons are multi-user until expiry)
        if ((currentOrder as any).couponId) {
          const appliedCouponRecord = await tx.coupon.findUnique({
            where: { id: (currentOrder as any).couponId },
            select: { id: true, code: true, internalRmId: true, distributorRmId: true },
          });

          const isDirectAdminCoupon =
            appliedCouponRecord &&
            !appliedCouponRecord.internalRmId &&
            !appliedCouponRecord.distributorRmId;

          let isSingleUse = !isDirectAdminCoupon;
          if (isDirectAdminCoupon) {
            const auditLog = await tx.auditLog.findFirst({
              where: {
                entity: 'COUPON',
                action: 'CREATE',
                OR: [
                  { entityId: appliedCouponRecord.id },
                  { metadata: { path: ['code'], equals: (appliedCouponRecord as any).code } },
                ],
              },
            });
            const redemptionType = (auditLog?.metadata as any)?.redemptionType || (auditLog?.changes as any)?.redemptionType;
            if (redemptionType === 'ONCE') {
              isSingleUse = true;
            }
          }

          if (isSingleUse) {
            // Single-use referral or one-time admin coupon: burn and link 1:1 to this order
            await tx.coupon.update({
              where: { id: (currentOrder as any).couponId },
              data: {
                isUsed: true,
                usedAt: new Date(),
                usedByUserId: currentOrder.userId,
                orderId: currentOrder.id,
              },
            });
          }
        }

        return orderUpdate;
      }) as any;

      // Send email notifications OUTSIDE the transaction
      if (updatedOrder.user.email && ['PAID', 'SUCCESS'].includes(updatedOrder.paymentStatus)) {
        try {
          await this.emailService.sendOrderStatusUpdateEmail(
            {
              id: updatedOrder.id,
              orderNumber: (updatedOrder as any).orderNumber,
              stockName:
                updatedOrder.stock?.name ||
                updatedOrder.basket?.name ||
                'Investment',
              quantity: updatedOrder.quantity,
              totalAmount: updatedOrder.totalAmount,
              status: 'COMPLETED',
            },
            {
              email: updatedOrder.user.email,
              name: updatedOrder.user.fullName,
            },
            'COMPLETED',
          );
        } catch (error) {
          this.logger.error(
            `Failed to send order status update email for order ${updatedOrder.id}:`,
            error,
          );
        }

        try {
          await this.emailService.sendOrderReceiptEmail(
            {
              id: updatedOrder.id,
              orderNumber: (updatedOrder as any).orderNumber,
              stockName: updatedOrder.stock?.name || updatedOrder.basket?.name || 'Investment',
              quantity: updatedOrder.quantity,
              totalAmount: updatedOrder.totalAmount,
              pricePerShare: updatedOrder.pricePerShare,
              shareTransferReferenceNo: updatedOrder.shareTransferReferenceNo,
              shareTransferDate: updatedOrder.shareTransferDate,
            },
            {
              email: updatedOrder.user.email,
              name: updatedOrder.user.fullName,
            },
          );
          this.logger.log(`✓ Receipt email queued for completed order: ${updatedOrder.id}`);
        } catch (receiptError) {
          this.logger.error(`✗ Failed to queue receipt email for order ${updatedOrder.id}:`, receiptError);
        }
      }

      return updatedOrder;
    } else {
      // Non-completed status update
      const receiptNumber =
        dto.status === 'PAID' && ['PAID', 'SUCCESS'].includes(order.paymentStatus) && !(order as any).receiptNumber
          ? await this.generateUniqueReceiptNumber()
          : (order as any).receiptNumber;

      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: dto.status,
          ...(receiptNumber && { receiptNumber }),
        },
        include: {
          stock: {
            select: {
              id: true,
              name: true,
              cin: true,
              isin: true,
              logoUrl: true,
            },
          },
          basket: {
            select: {
              id: true,
              name: true,
              slug: true,
              iconUrl: true,
              category: true,
            },
          },
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      if (dto.status === 'PAID') {
        await this.generateReceiptVoucher(updatedOrder);
      }

      return updatedOrder;
    }
  }

  /**
   * Helper to find or auto-create the CASHFREE PAYMENTS INDIA PVT LTD Bank ledger.
   * Strictly excludes HDFC ledgers to ensure Cashfree is always used for auto voucher entries.
   */
  private async getCashfreeLedger(db: any): Promise<{ id: string; name: string }> {
    let cashfreeLedger = await db.ledger.findFirst({
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

    if (cashfreeLedger) return cashfreeLedger;

    let bankGroup = await db.accountingGroup.findFirst({
      where: { name: { contains: 'Bank', mode: 'insensitive' } },
      select: { id: true },
    });

    const latestBank = await db.ledger.findFirst({
      where: { code: { startsWith: 'BK' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    let nextNum = 1;
    if (latestBank && latestBank.code.startsWith('BK')) {
      const parsed = parseInt(latestBank.code.slice(2), 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    const code = `BK${String(nextNum).padStart(4, '0')}`;

    cashfreeLedger = await db.ledger.create({
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
    return cashfreeLedger;
  }

  /**
   * Automatically generate Receipt voucher upon Cashfree payment confirmation (PAID).
   * Receipt Voucher (RCP) — Money received from client via Cashfree Payment Gateway.
   * Auto-approved with status: 'APPROVED' (No manual approval needed for auto payment receipts).
   */
  public async generateReceiptVoucher(order: any, tx?: any) {
    // Fulfilment status alone must never authorize a payment receipt.
    const isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'SUCCESS';
    if (!isPaid) {
      this.logger.log(`[ReceiptVoucher] Skipping receipt voucher creation for unpaid order ${order.id}`);
      return;
    }
    const assetName = order.stock?.name || order.basket?.name || 'Investment';
    const shortOrderId = (order.orderNumber || order.id.slice(-10)).toUpperCase();
    const amount = order.totalAmount;
    const today = new Date();

    const db = tx || this.prisma;

    // 1. Get CASHFREE PAYMENTS INDIA PVT LTD ledger (never HDFC)
    const bankLedger = await this.getCashfreeLedger(db);
    if (!bankLedger) return;

    // Fail-safe Guard: Ensure bankLedger is NEVER an HDFC ledger for order payment receipts!
    if (bankLedger.name.toUpperCase().includes('HDFC')) {
      this.logger.error(`[CRITICAL SECURITY ALERT] Attempted to create Order Receipt Voucher for order ${order.id} with HDFC Bank ledger! Re-resolving to Cashfree Gateway Ledger.`);
      const forceCashfree = await db.ledger.findFirst({
        where: {
          isActive: true,
          NOT: { name: { contains: 'HDFC', mode: 'insensitive' } },
          OR: [
            { name: { contains: 'CASHFREE PAYMENTS INDIA PVT LTD', mode: 'insensitive' } },
            { name: { contains: 'Cashfree', mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true },
      });
      if (forceCashfree) {
        bankLedger.id = forceCashfree.id;
        bankLedger.name = forceCashfree.name;
      }
    }

    // 2. Find USER ledger for the buyer
    let userLedger: { id: string } | null = null;
    try {
      userLedger = await this.findOrCreateUserLedger(
        order.user || { id: order.userId, fullName: 'Client', email: '' },
        db
      );
    } catch (e) {
      this.logger.warn(`Could not find user ledger for order ${order.id}: ${e}`);
      return;
    }

    if (!userLedger) return;


    const runCreation = async (t: any) => {
      const receiptLock = `receipt:${order.id}`;
      await t.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${receiptLock}, 0))::text`;
      // Ensure order has receiptNumber populated
      let receiptNumber = order.receiptNumber;
      if (!receiptNumber) {
        receiptNumber = await this.generateUniqueReceiptNumber(t);
        await t.order.update({
          where: { id: order.id },
          data: { receiptNumber },
        });
        order.receiptNumber = receiptNumber;
      }

      // Check if RCP voucher already exists for this order to prevent duplicates
      const existing = await t.voucher.findFirst({
        where: {
          metadata: {
            path: ['orderId'],
            equals: order.id,
          },
          type: 'RECEIPT',
        },
      });
      if (existing) return;
      // Acquire the receipt lock before the sequence row, matching payment workers.
      const rcpNumber = await this.generateVoucherNumber('RCP', t);
      const rcpRefNumber = await this.generateReferenceNumber(t);
      

      let pData: any = {};
      if (typeof order.paymentData === 'string') {
        try { pData = JSON.parse(order.paymentData); } catch (e) {}
      } else if (order.paymentData) {
        pData = order.paymentData;
      }
      const bankRefNo = pData.bank_reference || pData.bankReference || order.shareTransferReferenceNo || order.cashfreePaymentId || shortOrderId;
      const modeOfPaymentResolved = this.resolveModeOfPayment(pData);

      // --- Receipt Voucher (RCP) ---
      // Debit BANK (Cashfree received funds), Credit USER (client payment)
      const cfPaymentRef = bankRefNo || order.cashfreePaymentId || shortOrderId;
      await t.voucher.create({
        data: {
          voucherNumber: rcpNumber,
          type: 'RECEIPT',
          date: today,
          narration: `Payment received against Cashfree reference number ${cfPaymentRef}`,
          totalAmount: amount,
          status: 'APPROVED', // Auto-approved! No manual approval required for auto webhook receipts
          approvedAt: today,
          approvedById: 'SYSTEM',
          referenceNumber: rcpRefNumber,
          referenceDate: today,
          createdById: 'SYSTEM',
          metadata: {
            autoGenerated: true,
            receiptNumber: order.receiptNumber,
            orderId: order.id,
            orderNumber: order.orderNumber || `ORD-${order.id.slice(-6).toUpperCase()}`,
            orderDate: order.createdAt,
            transactionId: order.cashfreePaymentId,
            transactionDate: today.toISOString(),
            bank_reference: bankRefNo,
            bankReferenceNo: bankRefNo,
            instrumentId: bankRefNo,
            instrumentDate: today.toISOString(),
            modeOfPayment: modeOfPaymentResolved,
            type: 'receipt',
            stockName: assetName,
            isin: order.stock?.isin || order.stock?.cin || undefined,
            quantity: order.quantity,
            pricePerShare: order.pricePerShare ? Number(order.pricePerShare) : undefined,
            discountApplied: order.discountApplied ? Number(order.discountApplied) : 0,
            originalTotalAmount: order.originalTotalAmount ? Number(order.originalTotalAmount) : Number(amount),
            couponId: order.couponId || undefined,
            couponCode: order.coupon?.code || undefined,
          },
          entries: {
            create: [
              {
                ledgerId: bankLedger.id,
                entryType: 'DEBIT',
                amount,
                narration: `Payment received against Cashfree reference number ${cfPaymentRef}`,
                scriptName: undefined,
                isin: undefined,
                qty: undefined,
                rate: undefined,
              },
              {
                ledgerId: userLedger.id,
                entryType: 'CREDIT',
                amount,
                narration: `Payment received for ${assetName} (CF Ref: ${cfPaymentRef})`,
                scriptName: undefined,
                isin: undefined,
                qty: undefined,
                rate: undefined,
              },
            ],
          },
        },
      });

      // Update ledger balances for RCP
      await t.ledger.update({
        where: { id: bankLedger.id },
        data: { currentBalance: { increment: amount } },
      });
      await t.ledger.update({
        where: { id: userLedger.id },
        data: { currentBalance: { increment: -amount } },
      });

      this.logger.log(
        `📄 Created Auto-Approved Receipt voucher: ${rcpNumber} for order ${shortOrderId}`,
      );
    };

    if (tx) {
      await runCreation(tx);
    } else {
      await this.prisma.$transaction(async (t) => {
        await runCreation(t);
      });
    }
  }

  /**
   * Update user's portfolio when order is completed
   * @param userId - User ID
   * @param stockId - Stock ID
   * @param quantity - Quantity purchased
   * @param pricePerShare - Price per share
   * @param tx - Optional Prisma transaction client
   */
  private async updatePortfolio(
    userId: string,
    stockId: string,
    quantity: number,
    pricePerShare: number,
    tx?: any,
  ) {
    const db = tx || this.prisma;
    // Portfolio is keyed by the internal stock relation so holdings remain stable
    // regardless of which business identifier the UI displays.
    const existingPortfolio = await db.portfolio.findUnique({
      where: {
        userId_stockId: {
          userId,
          stockId,
        },
      },
    });

    if (existingPortfolio) {
      // Update existing portfolio entry
      const newQuantity = existingPortfolio.quantity + quantity;
      const newAvgPrice =
        (existingPortfolio.avgPrice * existingPortfolio.quantity +
          pricePerShare * quantity) /
        newQuantity;

      await db.portfolio.update({
        where: {
          userId_stockId: {
            userId,
            stockId,
          },
        },
        data: {
          quantity: newQuantity,
          avgPrice: newAvgPrice,
        },
      });
    } else {
      // Create new portfolio entry
      await db.portfolio.create({
        data: {
          userId,
          stockId,
          quantity,
          avgPrice: pricePerShare,
        },
      });
    }
  }

  /**
   * Update user's portfolio for basket orders
   * Distributes the basket purchase across constituent stocks based on weights
   * @param userId - User ID
   * @param basketConstituents - Basket constituents snapshot (JSON)
   * @param quantity - Basket quantity purchased
   * @param basketPrice - Price per basket unit (order.pricePerShare)
   * @param tx - Optional Prisma transaction client
   */
  private async updatePortfolioForBasket(
    userId: string,
    basketConstituents: any,
    quantity: number,
    basketPrice: number,
    tx?: any,
  ) {
    this.logger.log(
      `Updating portfolio for basket order: ${basketConstituents.basketName}`,
    );

    // Parse constituents if it's a JSON string
    const constituents =
      typeof basketConstituents === 'string'
        ? JSON.parse(basketConstituents)
        : basketConstituents;

    // Iterate through each constituent and update portfolio
    for (const constituent of constituents.constituents) {
      // Calculate constituent value allocation based on basket price and weight
      // Formula: basketPrice * quantity * (weight / 100)
      const constituentValue =
        basketPrice * quantity * (constituent.weight / 100);

      // Calculate equivalent shares based on price at order time
      // Formula: constituentValue / priceAtOrder
      const constituentQuantityFloat =
        constituentValue / constituent.priceAtOrder;

      // Round to integer to satisfy Portfolio.quantity type (Int)
      // Using Math.round for fair rounding (0.5 rounds up)
      const constituentQuantity = Math.round(constituentQuantityFloat);

      // Update portfolio for this constituent stock
      await this.updatePortfolio(
        userId,
        constituent.stockId,
        constituentQuantity,
        constituent.priceAtOrder,
        tx,
      );

      this.logger.log(
        `Updated portfolio for ${constituent.stockName} (${constituent.stockCin}): ${constituentQuantity} shares (from ${constituentQuantityFloat.toFixed(2)}) at ₹${constituent.priceAtOrder}`,
      );
    }

    this.logger.log(
      `Basket portfolio update completed for ${constituents.basketName}`,
    );
  }

  // NOTE: updateReferralReward and updateRMCommission methods were removed as part
  // of the RM and referral system deprecation.

  // NOTE: cancelOrder method removed — orders are no longer cancellable.
  // Failed payments leave orders in PENDING state for retry.

  // ============================================
  // AUTOMATIC VOUCHER GENERATION
  // ============================================

  /**
   * Generate the next voucher number for a given prefix.
   * Format: PREFIX-XXXX (e.g. SAL-0002)
   */
  private async generateVoucherNumber(prefix: string, tx?: any): Promise<string> {
    const db = tx || this.prisma;
    return allocateVoucherNumber(db, prefix);
  }

  /**
   * Generate a reference number in YYMMDDRN format.
   * RN is a sequential counter that resets every month.
   * Example: 2607290001 = 26 (year) + 07 (month) + 29 (day) + 0001 (sequence)
   */
  private async generateReferenceNumber(tx?: any): Promise<string> {
    const db = tx || this.prisma;
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const monthPrefix = `${yy}${mm}`;

    // Find the latest voucher with a referenceNumber starting with this month's prefix
    const latest = await db.voucher.findFirst({
      where: {
        referenceNumber: { startsWith: monthPrefix },
      },
      orderBy: { createdAt: 'desc' },
      select: { referenceNumber: true },
    });

    let seq = 1;
    if (latest && latest.referenceNumber) {
      // Extract the sequence portion after YYMMDD (last 4 chars)
      const seqStr = latest.referenceNumber.slice(6);
      const parsed = parseInt(seqStr, 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }

    return `${yy}${mm}${dd}${String(seq).padStart(4, '0')}`;
  }

  /**
   * Helper to resolve raw Cashfree payment data into human-readable Mode of Payment.
   * e.g. upi -> UPI, netbanking -> Net Banking, card -> Card
   */
  private resolveModeOfPayment(pData: any): string {
    if (!pData) return 'UPI / Net Banking';
    const rawMode = pData.payment_group || pData.payment_method || pData.paymentGroup || pData.paymentMethod || '';
    let str = '';
    if (typeof rawMode === 'object') {
      str = Object.keys(rawMode)[0] || '';
    } else {
      str = String(rawMode);
    }
    const l = str.toLowerCase();
    if (l.includes('upi')) return 'UPI';
    if (l.includes('net') || l.includes('nb') || l.includes('bank')) return 'Net Banking';
    if (l.includes('card')) return 'Card';
    if (l.includes('wallet') || l.includes('app')) return 'Wallet';
    return 'UPI / Net Banking';
  }
  private async findOrCreateUserLedger(user: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone?: string | null;
  }, tx?: any): Promise<{ id: string }> {
    const db = tx || this.prisma;
    // Try to find existing USER ledger by email
    if (user.email) {
      const existing = await db.ledger.findFirst({
        where: {
          type: 'USER',
          email: user.email,
          isActive: true,
        },
        select: { id: true },
      });

      if (existing) return existing;
    }

    throw new BadRequestException(`No active manual ledger found for client email "${user.email || 'N/A'}". Please create the client ledger manually first.`);
  }

  /**
   * Helper to find or auto-create the "Sale of Unlisted Share (Retail Platform)" Sales ledger.
   * Strictly excludes Inter DP and HDFC ledgers.
   */
  private async getOrCreateSalesLedger(db: any): Promise<{ id: string; name: string }> {
    let salesLedger = await db.ledger.findFirst({
      where: {
        AND: [
          { isActive: true },
          { NOT: { name: { contains: 'Inter DP', mode: 'insensitive' } } },
          { NOT: { name: { contains: 'HDFC', mode: 'insensitive' } } },
          {
            OR: [
              { name: { contains: 'Sale of Unlisted Share', mode: 'insensitive' } },
              { name: { contains: 'Sale', mode: 'insensitive' } },
              { type: 'SALE' },
            ],
          },
        ],
      },
      select: { id: true, name: true },
    });

    if (salesLedger) return salesLedger;

    let salesGroup = await db.accountingGroup.findFirst({
      where: {
        OR: [
          { name: { contains: 'Sales', mode: 'insensitive' } },
          { name: { contains: 'Revenue', mode: 'insensitive' } },
          { name: { contains: 'Income', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    const latestSale = await db.ledger.findFirst({
      where: { code: { startsWith: 'SL' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    let nextNum = 1;
    if (latestSale && latestSale.code.startsWith('SL')) {
      const parsed = parseInt(latestSale.code.slice(2), 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    const code = `SL${String(nextNum).padStart(4, '0')}`;

    salesLedger = await db.ledger.create({
      data: {
        code,
        name: 'Sale of Unlisted Share (Retail Platform)',
        type: 'SALE',
        groupId: salesGroup?.id,
        isActive: true,
      },
      select: { id: true, name: true },
    });

    this.logger.log(`✓ Auto-created Sale of Unlisted Share ledger (${salesLedger.id})`);
    return salesLedger;
  }

  /**
   * Automatically generate Sales voucher upon order completion approval.
   * Invoice Voucher (INV) — Stock sold to user.
   */
  private async generateSalesVoucher(order: any, tx?: any) {
    if (order.status !== 'COMPLETED') {
      throw new BadRequestException('Sales vouchers require a completed order.');
    }
    assertCompletionTransfer(order.shareTransferReferenceNo, order.shareTransferDate, order.batchSequence);
    const assetName = order.stock?.name || order.basket?.name || 'Investment';
    const shortOrderId = order.id.slice(-10).toUpperCase();
    const amount = order.totalAmount;
    const today = new Date();

    const db = tx || this.prisma;

    // 1. Get "Sale of Unlisted Share (Retail Platform)" Sales ledger
    const salesLedger = await this.getOrCreateSalesLedger(db);
    if (!salesLedger) {
      throw new BadRequestException('Sales control ledger not found. Please create a ledger of type SALE manually first.');
    }

    // 2. Find USER ledger for the buyer
    const userLedger = await this.findOrCreateUserLedger(order.user, db);

    // 3. Generate voucher number (SAL-xxxx) & dedicated invoice number (INV-xxxx)
    const salNumber = await this.generateVoucherNumber('SAL', db);
    const invNumber = order.invoiceNumber || (await this.generateUniqueInvoiceNumber(db));

    // Helper to perform the actual DB updates
    const runCreation = async (t: any) => {
      if (!order.invoiceNumber) {
        await t.order.update({
          where: { id: order.id },
          data: { invoiceNumber: invNumber },
        });
        order.invoiceNumber = invNumber;
      }

      // --- Sale Voucher (SAL) ---
      // Debit USER (user owes/bought), Credit SALES (sale revenue)
      await t.voucher.create({
        data: {
          voucherNumber: salNumber,
          type: 'PAYMENT_SALES',
          date: today,
          narration: `Sale of ${assetName} (${order.quantity} shares @ ₹${order.pricePerShare}) — Order #${shortOrderId}`,
          totalAmount: amount,
          status: 'APPROVED',
          approvedAt: today,
          approvedById: 'SYSTEM',
          referenceNumber: await this.generateReferenceNumber(t),
          referenceDate: order.shareTransferDate || today,
          createdById: 'SYSTEM',
          metadata: {
            autoGenerated: true,
            invoiceNumber: invNumber,
            orderId: order.id,
            orderNumber: order.orderNumber || `ORD-${order.id.slice(-6).toUpperCase()}`,
            orderDate: order.createdAt,
            transactionId: order.cashfreePaymentId,
            transactionDate: today.toISOString(),
            shareTransferReferenceNo: order.shareTransferReferenceNo,
            shareTransferDate: order.shareTransferDate?.toISOString(),
            batchSequence: order.batchSequence,
            modeOfPayment: 'Cashfree',
            type: 'sales',
          },
          entries: {
            create: [
              {
                ledgerId: userLedger.id,
                entryType: 'DEBIT',
                amount,
                narration: `Purchase of ${assetName}`,
                scriptName: assetName,
                isin: order.stock?.isin || order.stock?.cin || undefined,
                qty: order.quantity,
                rate: order.quantity > 0 ? Number((amount / order.quantity).toFixed(2)) : order.pricePerShare,
              },
              {
                ledgerId: salesLedger.id,
                entryType: 'CREDIT',
                amount,
                narration: `Sale revenue for ${assetName}`,
                scriptName: assetName,
                isin: order.stock?.isin || order.stock?.cin || undefined,
                qty: order.quantity,
                rate: order.quantity > 0 ? Number((amount / order.quantity).toFixed(2)) : order.pricePerShare,
              },
            ],
          },
        },
      });

      // Update ledger balances for INV
      await t.ledger.update({
        where: { id: userLedger.id },
        data: { currentBalance: { increment: amount } },
      });
      await t.ledger.update({
        where: { id: salesLedger.id },
        data: { currentBalance: { increment: -amount } },
      });

      this.logger.log(
        `📄 Created Sales voucher: ${salNumber} for order ${shortOrderId}`,
      );
    };

    if (tx) {
      await runCreation(tx);
    } else {
      await this.prisma.$transaction(async (t) => {
        await runCreation(t);
      });
    }
  }


  /**
   * Fetch all sales (orders) driven by all Relationship Managers belonging to a specific Distributor or Branch
   * @param distributorId string | undefined
   * @param branchId string | undefined
   */
  async getDistributorSales(distributorId?: string, branchId?: string) {
    const whereClause: any = {};
    if (distributorId) {
      whereClause.coupon = { distributorRm: { distributorId } };
    } else if (branchId) {
      whereClause.coupon = { internalRm: { branchId } };
    }

    const isExternal = !!distributorId || !branchId;
    const settingType = isExternal ? 'EXTERNAL' : 'INTERNAL';
    const revenueSetting = await this.prisma.revenueShareSetting.findUnique({
      where: { type: settingType },
    });
    const revenueSharePercentage = revenueSetting?.revenuePercentage ?? 0;
    const incentivePercentage = revenueSetting?.incentivePercentage ?? 0;

    const orders = await this.prisma.order.findMany({
      where: whereClause,
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        quantity: true,
        pricePerShare: true,
        discountApplied: true,
        revenueSharePercentage: true,
        incentivePercentage: true,
        lendingPrice: true,
        createdAt: true,
        status: true,
        stock: {
          select: {
            id: true,
            name: true,
            cin: true,
            isin: true,
            price: true,
            externalLendingPrice: true,
            internalLendingPrice: true,
          },
        },
        basket: {
          select: { name: true, category: true },
        },
        user: {
          select: { fullName: true, email: true, phone: true },
        },
        coupon: {
          select: {
            id: true,
            code: true,
            discountAmount: true,
            discountType: true,
            discountPercentage: true,
            lendingPrice: true,
            distributorRm: { select: { id: true, name: true, email: true } },
            internalRm: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => {
      const rm = order.coupon?.distributorRm || order.coupon?.internalRm || { name: 'Unknown RM', email: '' };
      const qty = order.quantity || 0;

      // Selling price per share on the day of sale (order.pricePerShare), fallback to stock price
      const sellingPrice = order.pricePerShare ?? order.stock?.price ?? 0;

      // Discount offered (per share)
      let discountOffered = 0;
      if (order.discountApplied && qty > 0) {
        discountOffered = Number((order.discountApplied / qty).toFixed(3));
      } else if (order.coupon) {
        if (order.coupon.discountType === 'PERCENTAGE' && order.coupon.discountPercentage) {
          discountOffered = Number(((sellingPrice * order.coupon.discountPercentage) / 100).toFixed(3));
        } else {
          discountOffered = order.coupon.discountAmount || 0;
        }
      }

      // Discounted Price per share (effective rate paid by client)
      const discountedPrice = (qty > 0 && order.totalAmount)
        ? Number((order.totalAmount / qty).toFixed(3))
        : Math.max(0, sellingPrice - discountOffered);

      // Floor lending price per share (prioritize historical snapshot from order or coupon)
      const historicalLp = (order as any).lendingPrice ?? (order.coupon as any)?.lendingPrice;
      const lendingPrice = historicalLp ?? (
        isExternal
          ? (order.stock?.externalLendingPrice ?? 0)
          : (order.stock?.internalLendingPrice ?? 0)
      );

      // Profit margin per share
      const revenuePerShare = Math.max(0, discountedPrice - lendingPrice);

      // Total margin / revenue generated
      const rmRevenue = Number((revenuePerShare * qty).toFixed(2));

      // Use the snapshot values if they exist, otherwise fallback to global settings
      const appliedRevenueSharePercentage = (order as any).revenueSharePercentage ?? revenueSharePercentage;
      const appliedIncentivePercentage = (order as any).incentivePercentage ?? incentivePercentage;

      // Distributor share (e.g. 70% of margin)
      const exactBranchShare = rmRevenue * (appliedRevenueSharePercentage / 100);
      const yourShare = Number(exactBranchShare.toFixed(2));

      // RM incentive (relevant for internal branch) - Total Revenue (rmRevenue) * RM Incentive %
      const rmIncentive = !isExternal && appliedIncentivePercentage > 0
        ? Number((rmRevenue * (appliedIncentivePercentage / 100)).toFixed(4))
        : 0;

      return {
        id: order.id,
        orderNumber: order.orderNumber || `ORD-${order.id.slice(0, 6).toUpperCase()}`,
        totalAmount: order.totalAmount,
        quantity: qty,
        pricePerShare: discountedPrice,
        sellingPrice,
        discountOffered,
        discountedPrice,
        lendingPrice,
        revenuePerShare,
        rmRevenue,
        yourShare,
        rmIncentive,
        revenueSharePercentage: appliedRevenueSharePercentage,
        incentivePercentage: appliedIncentivePercentage,
        createdAt: order.createdAt,
        status: order.status,
        stock: order.stock,
        basket: order.basket,
        user: order.user,
        coupon: {
          code: order.coupon?.code || '',
          discountAmount: order.coupon?.discountAmount || 0,
          discountType: order.coupon?.discountType,
          discountPercentage: order.coupon?.discountPercentage,
          relationshipManager: rm,
        },
      };
    });
  }

  /** Fetch and archive a completed e-sign PDF, retaining legacy Digitap recovery. */
  async getESignDoc(docId: string) {
    docId = this.normalizeESignDocId(docId);
    const alankitAttempt = await this.prisma.esignAttempt.findUnique({ where: { docId } });
    const alankitIntent = alankitAttempt?.intent as Record<string, any> | null;
    if (alankitIntent?.provider === 'ALANKIT') {
      const archivedPdf = await this.signedDealSheets.read(docId);
      if (!archivedPdf) {
        const pdf = await this.alankitEsign.getSignedPdf(docId);
        await this.signedDealSheets.archivePdf(docId, pdf);
      }
      await this.prisma.esignAttempt.update({
        where: { docId },
        data: {
          status: 'SIGNED',
          signedAt: alankitAttempt?.signedAt ?? new Date(),
          intent: { ...alankitIntent, identityVerificationVerdict: 'INSUFFICIENT_DATA' },
        },
      });
      await this.prisma.order.updateMany({
        where: { esignDocId: docId },
        data: { esignStatus: 'SIGNED', esignValidationVerdict: 'INSUFFICIENT_DATA' },
      });
      if (typeof alankitIntent.sourceObjectKey === 'string') {
        try {
          await this.signedDealSheets.deleteAlankitSourcePdf(alankitIntent.sourceObjectKey);
        } catch (error) {
          this.logger.warn(`Unable to remove temporary Alankit source PDF for ref=${docId}: ${error}`);
        }
      }
      return { docId, signers: [{ state: 'signed' }], provider: 'ALANKIT' };
    }

    const baseUrl = this.configService.get('DIGITAP_BASE_URL', 'https://api.digitap.ai');
    const clientId = this.configService.get('DIGITAP_CLIENT_ID');
    const clientSecret = this.configService.get('DIGITAP_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Digitap credentials are not configured.');
    }

    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const cleanDocId = docId.trim().split('?')[0].split('&')[0];

    let model: any;
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const response = await fetch(`${baseUrl}/ent/v1/get-esign-doc`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authString}`
          },
          body: JSON.stringify({ docId: cleanDocId })
        });

        const data = await response.json() as any;

        if (!response.ok || data.code !== '200') {
          this.logger.warn(`Attempt ${attempt}: Digitap get-esign-doc failed for docId "${cleanDocId}": ${JSON.stringify(data)}`);
          if (attempt >= maxAttempts) {
            this.logger.error(`Final attempt failed. Abandoning.`);
            throw new BadRequestException(data.message || data.msg || 'Failed to fetch e-sign document');
          }
          await new Promise(res => setTimeout(res, 3000));
          continue;
        }

        model = data.model;
        break;

      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        this.logger.error(`Request failed on attempt ${attempt}: ${err.message}`);
        if (attempt >= maxAttempts) {
          throw new BadRequestException('Failed to fetch e-sign document');
        }
        await new Promise(res => setTimeout(res, 3000));
      }
    }

    if (!model) {
      throw new BadRequestException('Failed to fetch valid e-Sign document data from Digitap.');
    }

      // ── Identity validation (mirrors handleESignWebhook logic) ────────────
      // Only run when the caller is checking that signing actually completed.
      const signers: any[] = model?.signers ?? [];
      const signedEntry = signers.find((s: any) => s.state === 'signed');

      if (signedEntry && docId) {
        const order = await this.prisma.order.findFirst({
          where: { esignDocId: docId },
          include: { user: true },
        });

        if (order) {
          const kycData = (order.user?.kycData ?? {}) as any;
          const expectedMaskedAadhaar =
            kycData.digitapDetails?.maskedAdharNumber ?? kycData.aadhaarDetails?.aadhaar ?? null;
          const expectedGender = kycData.aadhaarDetails?.gender ?? kycData.gender ?? null;
          const expectedDob = kycData.aadhaarDetails?.dob ?? kycData.panDetails?.dob ?? kycData.dob ?? null;

          const validation = validateSignerIdentity(
            {
              name: signedEntry.name,
              signerName: signedEntry.signerName,
              aadhaarSuffix: signedEntry.aadhaarSuffix,
              state: signedEntry.state,
              email: signedEntry.email,
              mobile: signedEntry.mobile,
              gender: signedEntry.gender,
              dob: signedEntry.dob,
            },
            {
              fullName: order.user?.fullName ?? null,
              maskedAadhaarNumber: expectedMaskedAadhaar,
              gender: expectedGender,
              dob: expectedDob,
            },
          );

          this.logger.log(
            `[esign-validation/poll] order=${order.id} verdict=${validation.verdict} reason="${validation.reason}"`,
          );

          // Only update DB when the status would change — avoids redundant writes
          // if the webhook already processed this document.
          const newStatus = validation.verdict === 'MISMATCH' ? 'MISMATCH' : 'SIGNED';
          await this.prisma.order.update({
            where: { id: order.id },
            data: {
              esignStatus: newStatus,
              esignValidationVerdict: validation.verdict,
              esignValidationDetail: validation as any,
            },
          });
          await this.markEsignAttempt(docId, newStatus as 'SIGNED' | 'MISMATCH', { orderId: order.id });
        } else {
          // Sign-first flow: no Order row yet — resolve the signer via the
          // attempt log and record the outcome so it doesn't linger as INITIATED.
          const pollAttempt = await (this.prisma as any).esignAttempt.findUnique({
            where: { docId },
          });
          if (pollAttempt) {
            const pollUser = await this.prisma.user.findUnique({ where: { id: pollAttempt.userId } });
            const pollKyc = ((pollUser as any)?.kycData ?? {}) as any;
            const pollValidation = validateSignerIdentity(
              {
                name: signedEntry.name,
                signerName: signedEntry.signerName,
                aadhaarSuffix: signedEntry.aadhaarSuffix,
                state: signedEntry.state,
                email: signedEntry.email,
                mobile: signedEntry.mobile,
                gender: signedEntry.gender,
                dob: signedEntry.dob,
              },
              {
                fullName: (pollUser as any)?.fullName ?? null,
                maskedAadhaarNumber: pollKyc.digitapDetails?.maskedAdharNumber ?? pollKyc.aadhaarDetails?.aadhaar ?? null,
                gender: pollKyc.aadhaarDetails?.gender ?? pollKyc.gender ?? null,
                dob: pollKyc.aadhaarDetails?.dob ?? pollKyc.panDetails?.dob ?? pollKyc.dob ?? null,
              },
            );
            await this.recordEsignIdentityVerdict(
              docId,
              pollValidation.verdict,
            );
            await this.markEsignAttempt(
              docId,
              pollValidation.verdict === 'MISMATCH' ? 'MISMATCH' : 'SIGNED',
            );
          }
        }
      }
      // ── End identity validation ───────────────────────────────────────────

      await this.signedDealSheets.archive(cleanDocId, model);
      return model;
  }

  /**
   * Synchronous identity gate — called by the frontend BEFORE creating an order.
   * Fetches the signed document from Digitap, runs validateSignerIdentity against
   * the user's KYC data, persists the verdict for audit, and returns it so the
   * frontend can block on MISMATCH.
   *
   * @param docId   Digitap document ID from the generate-esign session
   * @param userId  Authenticated user ID from JWT
   * @returns { verdict, reason } — the frontend should only proceed if verdict !== 'MISMATCH'
   */
  async verifyESignIdentity(docId: string, userId: string) {
    docId = await this.assertESignOwner(docId, userId);
    const storedAttempt = await this.prisma.esignAttempt.findUnique({ where: { docId } });
    const storedIntent = storedAttempt?.intent as Record<string, any> | null;
    if (storedIntent?.provider === 'ALANKIT') {
      if (storedAttempt?.status !== 'SIGNED') {
        return {
          verdict: 'NOT_SIGNED' as const,
          reason: 'Alankit has not yet confirmed a completed signature.',
        };
      }
      await this.recordEsignIdentityVerdict(docId, 'INSUFFICIENT_DATA');
      await this.prisma.order.updateMany({
        where: { esignDocId: docId, userId },
        data: { esignValidationVerdict: 'INSUFFICIENT_DATA' },
      });
      return {
        verdict: 'INSUFFICIENT_DATA' as const,
        reason: 'Alankit confirms the signature but does not provide signer identity data required by the KYC match policy.',
      };
    }

    // ── 1. Fetch signed doc from legacy Digitap sessions ──────────────────────
    const baseUrl = this.configService.get('DIGITAP_BASE_URL', 'https://api.digitap.ai');
    const clientId = this.configService.get('DIGITAP_CLIENT_ID');
    const clientSecret = this.configService.get('DIGITAP_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Digitap credentials are not configured.');
    }

    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const cleanDocId = docId.trim().split('?')[0].split('&')[0];

    let model: any;
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const response = await fetch(`${baseUrl}/ent/v1/get-esign-doc`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authString}`,
          },
          body: JSON.stringify({ docId: cleanDocId }),
        });

        const data = await response.json() as any;

        if (!response.ok || data.code !== '200') {
          this.logger.warn(`[verify-esign-identity] Attempt ${attempt}: Digitap get-esign-doc failed for docId "${cleanDocId}": ${JSON.stringify(data)}`);
          if (attempt >= maxAttempts) {
            this.logger.error(`[verify-esign-identity] Final attempt failed. Abandoning.`);
            throw new BadRequestException(data.message || data.msg || 'Failed to fetch e-sign document from Digitap');
          }
          // Wait 3 seconds before retrying (Digitap sync delay)
          await new Promise(res => setTimeout(res, 3000));
          continue;
        }

        model = data.model;
        break; // Success!

      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        this.logger.error(`[verify-esign-identity] Request failed on attempt ${attempt}: ${err.message}`);
        if (attempt >= maxAttempts) {
          throw new BadRequestException('Failed to communicate with Digitap. Please try again.');
        }
        await new Promise(res => setTimeout(res, 3000));
      }
    }

    if (!model) {
      throw new BadRequestException('Failed to fetch valid e-Sign document data from Digitap.');
    }

    // ── 2. Find the signed signer entry ───────────────────────────────────────
    const signers: any[] = model?.signers ?? [];
    const signedEntry = signers.find((s: any) => s.state === 'signed');

    if (!signedEntry) {
      // User cancelled/skipped the Aadhaar OTP — record the dropout so
      // marketing can see the abandoned e-sign attempt.
      await this.markEsignAttempt(cleanDocId, 'CANCELLED');
      return {
        verdict: 'NOT_SIGNED' as const,
        reason: 'The e-Sign document has not been signed. Please complete Aadhaar OTP verification.',
      };
    }

    // ── 3. Load the user's KYC data to compare against ────────────────────────
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, kycData: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const kycData = (user.kycData ?? {}) as any;
    const expectedMaskedAadhaar = kycData.digitapDetails?.maskedAdharNumber ?? kycData.aadhaarDetails?.aadhaar ?? null;
    const expectedGender = kycData.aadhaarDetails?.gender ?? kycData.gender ?? null;
    const expectedDob = kycData.aadhaarDetails?.dob ?? kycData.panDetails?.dob ?? kycData.dob ?? null;

    // ── 4. Run validation ─────────────────────────────────────────────────────
    const validation = validateSignerIdentity(
      {
        name: signedEntry.name,
        signerName: signedEntry.signerName,
        aadhaarSuffix: signedEntry.aadhaarSuffix,
        state: signedEntry.state,
        email: signedEntry.email,
        mobile: signedEntry.mobile,
        gender: signedEntry.gender,
        dob: signedEntry.dob,
      },
      {
        fullName: user.fullName ?? null,
        maskedAadhaarNumber: expectedMaskedAadhaar,
        gender: expectedGender,
        dob: expectedDob,
      },
    );
    await this.recordEsignIdentityVerdict(cleanDocId, validation.verdict);

    this.logger.log(
      `[verify-esign-identity] user=${userId} docId=${docId} verdict=${validation.verdict} reason="${validation.reason}"`,
    );

    // ── 5. Persist verdict to the order (if one exists for this docId) ────────
    const order = await this.prisma.order.findFirst({
      where: { esignDocId: docId },
    });

    if (order) {
      const newStatus = validation.verdict === 'MISMATCH' ? 'MISMATCH' : order.esignStatus;
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          esignStatus: newStatus,
          esignValidationVerdict: validation.verdict,
          esignValidationDetail: validation as any,
        },
      });
      if (validation.verdict === 'MISMATCH') {
        await this.markEsignAttempt(cleanDocId, 'MISMATCH', { orderId: order.id });
      } else {
        await this.markEsignAttempt(cleanDocId, 'SIGNED', { orderId: order.id });
      }
    } else if (validation.verdict === 'MISMATCH') {
      // Sign-first flow with no Order yet — still record the mismatch.
      await this.markEsignAttempt(cleanDocId, 'MISMATCH');
    } else {
      // MATCH with no Order yet (sign-first): the order gets created next by
      // the frontend and linked via esignDocId — mark signed now so a
      // subsequent createOrder link keeps the SIGNED outcome.
      await this.markEsignAttempt(cleanDocId, 'SIGNED');
    }

    try {
      await this.signedDealSheets.archive(cleanDocId, model);
    } catch {
      this.logger.warn('Signed deal sheet archival deferred for retry');
      await this.esignQueue.add('archive-signed-document', { docId: cleanDocId }, {
        attempts: 8, backoff: { type: 'exponential', delay: 15000 },
        removeOnComplete: true, removeOnFail: 100,
      });
    }

    // ── 6. Return verdict to the frontend ─────────────────────────────────────
    return {
      verdict: validation.verdict,
      reason: validation.reason,
    };
  }

  async handleAlankitESignCallback(resp: string) {
    const { referenceNo } = this.alankitEsign.parseCallback(resp);
    const attempt = await this.prisma.esignAttempt.findUnique({ where: { docId: referenceNo } });
    const intent = attempt?.intent as Record<string, any> | null;
    if (!attempt || intent?.provider !== 'ALANKIT') {
      return { status: 'ignored' };
    }

    await this.esignQueue.add('archive-signed-document', { docId: referenceNo }, {
      jobId: `alankit-archive-${crypto.createHash('sha256').update(referenceNo).digest('hex')}`,
      attempts: 8,
      backoff: { type: 'exponential', delay: 15000 },
      removeOnComplete: true,
      removeOnFail: 100,
    });
    return { status: 'received' };
  }

  /**
   * Legacy Digitap webhook for documents created before the provider migration.
   */
  async handleESignWebhook(payload: any) {
    const docId = payload?.model?.docId;
    if (String(payload?.code) !== '200' || typeof docId !== 'string') return { success: true };
    const known = await this.prisma.order.findFirst({ where: { esignDocId: docId } })
      ?? await this.prisma.esignAttempt.findUnique({ where: { docId } });
    if (!known) return { success: true };
    // Queue only the identifier. The worker fetches trustworthy status and a fresh URL.
    await this.esignQueue.add('archive-signed-document', { docId }, {
      attempts: 8, backoff: { type: 'exponential', delay: 15000 },
      removeOnComplete: true, removeOnFail: 100,
    });
    return { success: true };
  }

  private normalizeESignDocId(docId: string): string {
    if (typeof docId !== 'string') throw new BadRequestException('docId is required');
    const cleanDocId = docId.trim().split(/[?&#]/, 1)[0].trim();
    if (!cleanDocId || cleanDocId.length > 256) throw new BadRequestException('Invalid e-sign document ID');
    return cleanDocId;
  }

  async assertESignOwner(docId: string, userId: string): Promise<string> {
    const cleanDocId = this.normalizeESignDocId(docId);
    const owned = await this.prisma.order.findFirst({ where: { esignDocId: cleanDocId, userId } })
      ?? await this.prisma.esignAttempt.findFirst({ where: { docId: cleanDocId, userId } });
    if (!owned) {
      throw new NotFoundException('We could not find this e-sign session in your account. Please start a new purchase from the stock page.');
    }
    return cleanDocId;
  }

  async downloadSignedDealSheet(orderId: string, userId: string): Promise<Buffer> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order?.esignDocId) throw new NotFoundException('Signed deal sheet not available for this order');
    const stored = await this.signedDealSheets.read(order.esignDocId);
    if (stored) return stored;
    // Older orders and missed webhooks can be recovered on demand.
    await this.getESignDoc(order.esignDocId);
    const pdf = await this.signedDealSheets.read(order.esignDocId);
    if (!pdf) throw new BadRequestException('The signed deal sheet is not ready yet. Please try again later.');
    return pdf;
  }

  /**
   * Computes sales stats for Distributor/Branch Sales page:
   * - totalTransactions: count of orders
   * - totalRevenue: sum of order.totalAmount
   * - totalMargin: sum of order.rmRevenue
   * - yourShare: totalMargin * revenueSharePercentage / 100
   * - revenueSharePercentage: percentage from RevenueShareSetting
   */
  async getDistributorSalesStats(distributorId?: string, branchId?: string) {
    const isExternal = !!distributorId || !branchId;
    const settingType = isExternal ? 'EXTERNAL' : 'INTERNAL';

    const revenueSetting = await this.prisma.revenueShareSetting.findUnique({
      where: { type: settingType },
    });
    const revenueSharePercentage = revenueSetting?.revenuePercentage ?? 0;
    const incentivePercentage = revenueSetting?.incentivePercentage ?? 0;

    // Fetch all sales attributed to this distributor or branch
    const sales = await this.getDistributorSales(distributorId, branchId);

    let totalTransactions = 0;
    let totalRevenue = 0;
    let totalMargin = 0;
    let totalIncentive = 0;
    let totalYourShare = 0;

    for (const order of sales) {
      totalTransactions++;
      totalRevenue += order.totalAmount || 0;
      totalMargin += (order as any).rmRevenue || 0;
      totalIncentive += (order as any).rmIncentive || 0;
      totalYourShare += (order as any).yourShare || 0;
    }

    const yourShare = totalYourShare;

    return {
      totalTransactions,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalMargin: Math.round(totalMargin * 100) / 100,
      yourShare: Math.round(yourShare * 100) / 100,
      totalIncentive: Math.round(totalIncentive * 10000) / 10000,
      revenueSharePercentage,
      incentivePercentage,
      isExternal,
    };
  }

  async requestPaymentsReconciliation(targetDateStr?: string, executedBy = 'ACCOUNTANT') {
    const baseUrl = this.configService.get<string>('PAYMENTS_SERVICE_URL', 'http://payments-service:3004/api').replace(/\/$/, '');
    const token = this.configService.get<string>('PAYMENT_SERVICE_INTERNAL_TOKEN', '');
    if (!token) throw new ServiceUnavailableException('Payments service integration is not configured');
    const response = await fetch(`${baseUrl}/payments/internal/cashfree/reconcile`, {
      method: 'POST',
      headers: { 'x-payment-service-token': token, 'content-type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ date: targetDateStr, executedBy }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new ServiceUnavailableException(`Payments reconciliation failed with status ${response.status}`);
    return response.json();
  }
  /**
   * Retrieves active unreconciled/failed orders (hides RECONCILED items)
   */
  async getActiveUnreconciledOrders() {
    const orders = await this.prisma.order.findMany({
      where: {
        OR: [
          { paymentStatus: { in: ['PAID', 'SUCCESS'] } },
          { status: { in: ['PAID', 'COMPLETED'] } },
        ],
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch all receipt vouchers to verify which orders have a generated Receipt Voucher
    const receiptVouchers = await this.prisma.voucher.findMany({
      where: {
        OR: [
          { type: 'RECEIPT' as any },
          { voucherNumber: { startsWith: 'RCP-' } },
        ],
      },
      include: { entries: true },
    });

    return orders.filter((order) => {
      let pData: any = order.paymentData || {};
      if (typeof pData === 'string') {
        try { pData = JSON.parse(pData); } catch (e) {}
      }
      const status = pData.reconciliation?.status || pData.reconciliation_status;
      if (status === 'RECONCILED') return false;

      // REQUIREMENT: Must have a generated Receipt Voucher in PostgreSQL
      const hasReceiptVoucher = receiptVouchers.some((v) => {
        const meta = (v.metadata || {}) as any;
        const narr = v.narration || '';
        const orderNum = order.orderNumber || order.id;

        return (
          meta.orderId === order.id ||
          meta.orderNumber === order.orderNumber ||
          meta.cashfreeOrderId === order.cashfreeOrderId ||
          narr.includes(orderNum) ||
          narr.includes(order.id) ||
          v.entries.some((e) => e.narration?.includes(orderNum) || e.narration?.includes(order.id))
        );
      });

      return hasReceiptVoucher;
    });
  }

  /**
   * Retrieves Reconciliation Run History
   */
  async getReconciliationHistory() {
    const runs = await (this.prisma as any).reconciliationRun.findMany({
      orderBy: { executedAt: 'desc' },
      take: 50,
    });
    const totalCount = runs.length;
    return runs.map((run: any, idx: number) => {
      const d = new Date(run.executedAt || run.runDate || Date.now());
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const seq = String(totalCount - idx).padStart(4, '0');
      return {
        ...run,
        displayRunId: run.displayRunId || `REC/${yy}${mm}/${seq}`,
      };
    });
  }
  /**
   * Release Expired Inventory Reservations (Runs every minute)
   * Sweeps for orders that exceeded their reservation window and refunds stock.
   */
  async releaseExpiredInventory() {
    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: 'PENDING',
        paymentStatus: { notIn: ['PAID', 'SUCCESS'] },
        expiresAt: { lte: new Date() }
      }
    });

    if (expiredOrders.length === 0) return;

    this.logger.log(`⏰ [Cron] Found ${expiredOrders.length} expired reservations. Releasing inventory...`);

    for (const order of expiredOrders) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Re-fetch the order inside transaction to prevent webhook race conditions
          const currentOrder = await tx.order.findUnique({ where: { id: order.id } });
          if (currentOrder?.status !== 'PENDING' || ['PAID', 'SUCCESS'].includes(currentOrder.paymentStatus)) return;
          const claimed = await tx.order.updateMany({
            where: { id: order.id, status: 'PENDING', paymentStatus: { notIn: ['PAID', 'SUCCESS'] }, expiresAt: { lte: new Date() } },
            data: { status: 'EXPIRED' },
          });
          if (!claimed.count) return;

          // Restore inventory idempotently
          if (currentOrder.basketId && currentOrder.basketConstituents) {
            const constituents = typeof currentOrder.basketConstituents === 'string'
              ? JSON.parse(currentOrder.basketConstituents)
              : currentOrder.basketConstituents;
            const constituentsList = constituents.constituents || [];
            
            for (const c of constituentsList) {
              const constituentValue = currentOrder.pricePerShare * currentOrder.quantity * (c.weight / 100);
              const constituentQuantity = Math.round(constituentValue / (c.priceAtOrder || currentOrder.pricePerShare));

              await tx.stock.update({
                where: { id: c.stockId },
                data: {
                  stockQuantity: { increment: constituentQuantity },
                  ...(c.backupQuantityUsed > 0 ? { backupQuantity: { increment: c.backupQuantityUsed } } : {}),
                }
              });
            }
          } else if (currentOrder.stockId) {
            const backupUsed = (currentOrder.paymentData as any)?.backupQuantityUsed || 0;
            await tx.stock.update({
              where: { id: currentOrder.stockId },
              data: {
                stockQuantity: { increment: currentOrder.quantity },
                ...(backupUsed > 0 ? { backupQuantity: { increment: backupUsed } } : {}),
              }
            });
          }

          // Mark order as EXPIRED
          await tx.order.update({
            where: { id: order.id },
            data: { status: 'EXPIRED' }
          });
        });
        this.logger.log(`✅ Released inventory for expired order ${order.id}`);
      } catch (error) {
        this.logger.error(`❌ Failed to release inventory for order ${order.id}: ${error.message}`);
      }
    }
  }

  /**
   * Daily accounting pass for settlement data written by the Payments service.
   */
  async syncPendingSettlementVouchers() {
    try {
      await this.accountingService.autoCreatePendingSettlementVouchers();
    } catch (error) {
      this.logger.error(`Failed to auto-create settlement vouchers during daily sync: ${error}`);
    }
  }
}
