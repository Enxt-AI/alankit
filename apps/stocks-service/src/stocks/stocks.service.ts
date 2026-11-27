import { Injectable, NotFoundException, ConflictException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PinoNestLogger } from '@repo/logger';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { VersioningService } from '../versioning/versioning.service';
import { AuditService } from '../audit/audit.service';
import { AccountingService } from '../accounting/accounting.service';
import { Probe42Service } from './probe42.service';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateStockPriceDto } from './dto/create-stock-price.dto';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, decodePDFRawStream, PDFString, PDFHexString } from 'pdf-lib';

/**
 * Stocks Service
 * Handles all stock-related business logic
 * Implements Redis caching for public endpoints
 */
@Injectable()
export class StocksService implements OnModuleInit {
  private readonly logger = new PinoNestLogger('stocks-service', '');

  // Redis cache keys
  private readonly CACHE_KEY_ALL_STOCKS = 'stocks:all:active';
  private readonly CACHE_KEY_STOCK_PREFIX = 'stock:';
  private readonly CACHE_KEY_COMPANY_PREFIX = 'company:details:';
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_TTL_COMPANY = 3600; // 1 hour

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private versioningService: VersioningService,
    private auditService: AuditService,
    private configService: ConfigService,
    private accountingService: AccountingService,
    private probe42Service: Probe42Service,
    @InjectQueue('revalidation') private revalidationQueue: Queue,
    @InjectQueue('snapshots') private snapshotsQueue: Queue,
  ) {}

  async onModuleInit() {
    // Daily snapshot scheduling disabled for local/dev runs.
    this.logger.log('Daily snapshot job scheduling skipped');
  }

  /**
   * Create a new stock (Admin only)
   * @param dto - Stock creation data
   * @param adminId - ID of admin creating the stock
   * @returns Created stock
   */
  async createStock(dto: CreateStockDto, adminId: string) {
    // CIN is the canonical business identifier, so we validate uniqueness up front
    // to return a domain-specific error before Prisma raises a generic constraint error.
    const existingCin = await this.prisma.stock.findUnique({
      where: { cin: dto.cin },
   });

    if (existingCin) {
      throw new ConflictException(`Stock with CIN ${dto.cin} already exists`);
   }

    const existingSlug = await this.prisma.stock.findUnique({
      where: { slug: dto.slug },
   });

    if (existingSlug) {
      throw new ConflictException(`Stock with slug ${dto.slug} already exists`);
   }



    // Fetch and save company data from Probe42
    try {
      const probeData = await this.probe42Service.getCompanyDetails(dto.cin);
      if (probeData) {
        await this.prisma.companyData.upsert({
          where: { cin: dto.cin.toUpperCase() },
          update: {
            data: probeData,
         },
          create: {
            cin: dto.cin.toUpperCase(),
            data: probeData,
         },
       });
        try {
          await this.redis.delete(`${this.CACHE_KEY_COMPANY_PREFIX}${dto.cin.toUpperCase()}`);
       } catch (err) {
          this.logger.warn(`Failed to invalidate cache for CIN ${dto.cin}`, err);
       }
     }
   } catch (error: any) {
      throw new BadRequestException(`Failed to register company: Probe42 API failed: ${error.message}`);
   }


    if (dto.minimumPurchaseQuantity != null && dto.maximumPurchaseQuantity != null && dto.maximumPurchaseQuantity < dto.minimumPurchaseQuantity) {
      throw new BadRequestException('Maximum purchase quantity cannot be less than minimum purchase quantity');
   }

    // Create stock
    const stock = await this.prisma.stock.create({
      data: {
        name: dto.name,
        price: dto.price,

        minimumPurchaseQuantity: dto.minimumPurchaseQuantity,
        maximumPurchaseQuantity: dto.maximumPurchaseQuantity,
        logoUrl: dto.logoUrl,
        // Tags/ISIN/CIN are part of the Stock model and are surfaced in stock listings.
        // - ISIN remains optional and is not removed by this change.
        // - CIN is required and is the only business identifier accepted at creation.
        // NOTE: `tags` is a required list field in Prisma, so we default to an empty array.
        tags: dto.tags ?? [],
        categoryId: dto.categoryId,
        slug: dto.slug,
        isin: dto.isin,
        cin: dto.cin,
        pan: dto.pan,
        isActive: dto.isActive ?? true,
        // NEW: Popular stock classification (used by the Popular tab)
        isPopular: dto.isPopular ?? false,
        // Mirror Popular exactly so Market Movers can be filtered client-side
        // from the standard stock payload without a dedicated backend route.
        isMarketMover: dto.isMarketMover ?? false,
        totalShares: dto.totalShares,
        createdById: adminId,
        stockQuantity: dto.openingQuantity ?? 0,
        backupQuantity: dto.backupQuantity ?? 0,
        openingQuantity: dto.openingQuantity ?? 0,
        openingRate: dto.openingRate ?? 0,
        openingValue: dto.openingValue ?? 0,
        // Slab pricing rules (optional JSON)
        discountSlabs: dto.discountSlabs ?? undefined,
     },
      include: {
        category: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
         },
       },
     },
   });

    // Create version snapshot
    await this.versioningService.createVersion(
      'STOCK',
      stock.id,
      stock,
      'CREATE',
    );

    // Create audit log
    try {
      await this.auditService.createAuditLog(
        'CREATE',
        'STOCK',
        stock.id,
        stock,
        { operation: 'stock_created', stockName: stock.name },
      );
   } catch (error) {
      // Log error but don't fail the operation
      this.logger.error('Failed to create audit log for stock creation:', error);
   }

    // Record initial price in history
    try {
      await this.addPricePoint(
        stock.id,
        {
          price: stock.price,
          date: new Date().toISOString(),
       },
        adminId,
      );
   } catch (error) {
      this.logger.error('Failed to record initial price in history:', error);
   }

    // Invalidate cache
    await this.invalidateCache();

    // Auto-create accounting ledger for this stock
    try {
      await this.accountingService.createStockLedger(stock.id, stock.name, stock.isin);
   } catch (error) {
      this.logger.error('Failed to auto-create accounting ledger for stock:', error);
   }

    return stock;
 }

  /**
   * Get all stocks (Admin only - includes inactive)
   * @returns All stocks
   */
  async getAllStocksAdmin() {
    const stocks = await this.prisma.stock.findMany({
      include: {
        category: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
         },
       },
        updatedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
         },
       },
        prices: {
          orderBy: { date: 'desc' },
          take: 2,
       },
     },
      orderBy: { createdAt: 'desc' },
   });

    // Calculate market cap and change metrics for each stock
    return stocks.map((stock) => {
      let change = 0;
      let changePercent = 0;
      if (stock.prices && stock.prices.length > 0) {
        let prevPrice = stock.prices[0].price;
        if (stock.prices.length >= 2 && Math.abs(stock.price - stock.prices[0].price) < 0.001) {
          prevPrice = stock.prices[1].price;
       }
        
        if (prevPrice > 0) {
          change = stock.price - prevPrice;
          changePercent = (change / prevPrice) * 100;
       }
     }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { prices, ...rest } = stock;

      return {
        ...rest,
        marketCap: (stock.totalShares || 0) * stock.price,
        change,
        changePercent,
     };
   });
 }

  /**
   * Get all active stocks (Public endpoint with Redis caching)
   * Supports optional categoryId or categoryName filters
   * @param filters - Optional category filters
   * @returns Active stocks
   */
  async getAllActiveStocks(filters?: { categoryId?: string; categoryName?: string }) {
    let stocksWithCalculatedFields: any[];

    // Try to get from cache
    const cached = await this.redis.get(this.CACHE_KEY_ALL_STOCKS);
    if (cached) {
      stocksWithCalculatedFields = typeof cached === 'string' ? JSON.parse(cached) : cached;
   } else {
      // Fetch from database
      const stocks = await this.prisma.stock.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          price: true,
          logoUrl: true,
          tags: true,
          category: {
            select: {
              id: true,
              name: true,
           },
         },
          categoryId: true,
          isin: true,
          pan: true,
          // CIN is displayed in the client instead of internal DB ids.
          // Keep it in the public payload so cards/details can render `CIN: <value>` with fallback.
          cin: true,
          slug: true,
          // Expose isPopular so clients can render Popular/Latest tabs from one payload.
          isPopular: true,
          // Expose isMarketMover for the same reason: future consumers can filter
          // the normal stock list without requiring a specialized endpoint.
          isMarketMover: true,
          totalShares: true,
          stockQuantity: true,
          backupQuantity: true,
          minimumPurchaseQuantity: true,
          maximumPurchaseQuantity: true,
          companyOverview: true,
          // Slab pricing — include so clients can render per-quantity pricing tables
          discountSlabs: true,
          prices: {
            orderBy: { date: 'desc' },
            take: 2,
         },
       },
        // Keep stable backwards-compatible ordering for existing consumers.
        // If/when we need a "Latest" tab, expose a dedicated endpoint or query param
        // rather than changing default sort order silently.
        orderBy: { name: 'asc' },
     });

      // Calculate market cap, change, and changePercent for each stock
      stocksWithCalculatedFields = stocks.map((stock) => {
        let change = 0;
        let changePercent = 0;
        if (stock.prices && stock.prices.length > 0) {
          let prevPrice = stock.prices[0].price;
          if (stock.prices.length >= 2 && Math.abs(stock.price - stock.prices[0].price) < 0.001) {
            prevPrice = stock.prices[1].price;
         }

          if (prevPrice > 0) {
            change = stock.price - prevPrice;
            changePercent = (change / prevPrice) * 100;
         }
       }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { prices, ...rest } = stock;
        return {
          ...rest,
          marketCap: (stock.totalShares || 0) * stock.price,
          change,
          changePercent,
       };
     });

      // Cache for 5 minutes
      await this.redis.set(
        this.CACHE_KEY_ALL_STOCKS,
        JSON.stringify(stocksWithCalculatedFields),
        this.CACHE_TTL,
      );
   }

    if (filters?.categoryId) {
      return stocksWithCalculatedFields.filter(
        (stock) => stock.category?.id === filters.categoryId || stock.categoryId === filters.categoryId,
      );
   }

    if (filters?.categoryName) {
      const target = filters.categoryName.toLowerCase().trim();
      return stocksWithCalculatedFields.filter(
        (stock) =>
          stock.category?.name?.toLowerCase().trim() === target ||
          stock.tags?.some((t: string) => t?.toLowerCase().trim() === target),
      );
   }

    return stocksWithCalculatedFields;
 }

  /**
   * Get all active stocks with lending prices (for RM coupon generation)
   * Includes internalLendingPrice and externalLendingPrice fields
   */
  async getAllStocksForRM(isInternal: boolean) {
    const stocks = await this.prisma.stock.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        price: true,
        minimumPurchaseQuantity: true,
        maximumPurchaseQuantity: true,
        internalLendingPrice: true,
        externalLendingPrice: true,
     } as any,
      orderBy: { name: 'asc' },
   });
    
    return stocks.map((s: any) => ({
      id: s.id,
      name: s.name,
      price: s.price,
      minimumPurchaseQuantity: s.minimumPurchaseQuantity,
      maximumPurchaseQuantity: s.maximumPurchaseQuantity,
      lendingPrice: isInternal ? s.internalLendingPrice : s.externalLendingPrice,
   }));
 }

  /**
   * Helper to generate SEO slug from stock name
   */
  private generateSlug(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove all non-word chars (except spaces and hyphens)
      .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and hyphens with a single hyphen
      .replace(/^-+|-+$/g, ''); // Trim hyphens from start and end
 }

  /**
   * Helper to resolve CUID from ID or Slug
   */
  async resolveStockId(idOrSlug: string): Promise<string> {
    if (!idOrSlug) return idOrSlug;
    
    // Quick check: if it looks like a typical Prisma CUID (alphanumeric, no hyphens)
    const isCuid = /^[a-z0-9]{24,36}$/i.test(idOrSlug);
    if (isCuid) {
      return idOrSlug;
   }

    // It's likely a slug, look it up in the database using the new slug field first.
    const stockBySlug = await this.prisma.stock.findUnique({
      where: { slug: idOrSlug },
      select: { id: true },
   });
    if (stockBySlug) {
      return stockBySlug.id;
   }

    // Fallback: If it's an old slug generated from the name, do a full scan (backward compatibility).
    const stocks = await this.prisma.stock.findMany({
      select: { id: true, name: true },
   });
    
    const match = stocks.find((s) => this.generateSlug(s.name) === idOrSlug);
    if (match) {
      return match.id;
   }

    return idOrSlug; // fallback
 }

  /**
   * Get single stock by ID (Public endpoint with Redis caching)
   * @param idOrSlug - Stock ID or Slug
   * @returns Stock details
   */
  async getStockById(idOrSlug: string, bypassCache: boolean = false) {
    const id = await this.resolveStockId(idOrSlug);
    const cacheKey = `${this.CACHE_KEY_STOCK_PREFIX}${id}`;

    // Try cache first
    if (!bypassCache) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
     }
   }

    // Fetch from database
    const stock = await this.prisma.stock.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        price: true,
        logoUrl: true,
        tags: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
         }
       },
        isin: true,
        pan: true,
        cin: true,
        slug: true,
        isActive: true,
        isPopular: true,
        isMarketMover: true,
        totalShares: true,
        stockQuantity: true,
        backupQuantity: true,
        minimumPurchaseQuantity: true,
        maximumPurchaseQuantity: true,
        companyOverview: true,
        // Slab pricing — include so detail page can render live discounted price
        discountSlabs: true,
        prices: {
          orderBy: { date: 'desc' },
          take: 2,
       },
     },
   });

    if (!stock || !stock.isActive) {
      throw new NotFoundException(`Stock with ID/slug ${idOrSlug} not found`);
   }

    let change = 0;
    let changePercent = 0;
    if (stock.prices && stock.prices.length > 0) {
      let prevPrice = stock.prices[0].price;
      if (stock.prices.length >= 2 && Math.abs(stock.price - stock.prices[0].price) < 0.001) {
        prevPrice = stock.prices[1].price;
     }
      
      if (prevPrice > 0) {
        change = stock.price - prevPrice;
        changePercent = (change / prevPrice) * 100;
     }
   }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { prices, ...rest } = stock;

    const enrichedStock = {
      ...rest,
      marketCap: (stock.totalShares || 0) * stock.price,
      change,
      changePercent,
   };

    await this.redis.set(
      cacheKey,
      JSON.stringify(enrichedStock),
      this.CACHE_TTL,
    );

    return enrichedStock;
 }

  /**
   * Get single stock by CIN (Public endpoint)
   * @param cin - Stock CIN
   * @returns Stock details
   */
  async getStockByCin(cin: string) {
    const stock = await this.prisma.stock.findUnique({
      where: { cin },
      select: {
        id: true,
        name: true,
        price: true,
        logoUrl: true,
        tags: true,
        category: {
          select: {
            id: true,
            name: true,
         }
       },
        isin: true,
        pan: true,
        cin: true,
        slug: true,
        isActive: true,
        isPopular: true,
        isMarketMover: true,
        totalShares: true,
        stockQuantity: true,
        backupQuantity: true,
        minimumPurchaseQuantity: true,
        maximumPurchaseQuantity: true,
        companyOverview: true,
        createdAt: true,
        updatedAt: true,
        prices: {
          orderBy: { date: 'desc' },
          take: 2,
       },
     },
   });

    if (!stock) {
      throw new NotFoundException(`Stock with CIN ${cin} not found`);
   }

    let change = 0;
    let changePercent = 0;
    if (stock.prices && stock.prices.length > 0) {
      let prevPrice = stock.prices[0].price;
      if (stock.prices.length >= 2 && Math.abs(stock.price - stock.prices[0].price) < 0.001) {
        prevPrice = stock.prices[1].price;
     }
      
      if (prevPrice > 0) {
        change = stock.price - prevPrice;
        changePercent = (change / prevPrice) * 100;
     }
   }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { prices, ...rest } = stock;

    return {
      ...rest,
      marketCap: (stock.totalShares || 0) * stock.price,
      change,
      changePercent,
   };
 }

  /**
   * Update stock (Admin only)
   * @param id - Stock ID
   * @param dto - Update data
   * @param adminId - ID of admin updating the stock
   * @returns Updated stock
   */
  async updateStock(id: string, dto: UpdateStockDto, adminId: string) {
    // Check if stock exists
    const existing = await this.prisma.stock.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Stock with ID ${id} not found`);
   }



    // Enforce immutability of business identifiers once set
    if (dto.isin !== undefined && existing.isin && existing.isin !== dto.isin) {
      throw new BadRequestException('ISIN cannot be modified once set');
   }
    if (dto.pan !== undefined && existing.pan && existing.pan !== dto.pan) {
      throw new BadRequestException('Company PAN cannot be modified once set');
   }

    if (dto.slug !== undefined && dto.slug !== existing.slug) {
      const existingSlug = await this.prisma.stock.findUnique({
        where: { slug: dto.slug },
     });
      if (existingSlug) {
        throw new ConflictException(`Stock with slug ${dto.slug} already exists`);
     }
   }

    const effectiveMin = dto.minimumPurchaseQuantity !== undefined ? dto.minimumPurchaseQuantity : existing.minimumPurchaseQuantity;
    const effectiveMax = dto.maximumPurchaseQuantity !== undefined ? dto.maximumPurchaseQuantity : existing.maximumPurchaseQuantity;
    if (effectiveMin != null && effectiveMax != null && effectiveMax < effectiveMin) {
      throw new BadRequestException('Maximum purchase quantity cannot be less than minimum purchase quantity');
   }

    // CMS/admin forms submit "" for "no category" — Prisma rejects "" as an
    // FK value (P2003 → 500). The stored representation of "no category" is null.
    if ((dto as any).categoryId === '') {
      (dto as any).categoryId = null;
   }
    const stock = await this.prisma.stock.update({
      where: { id },
      data: {
        ...dto,
        updatedById: adminId,
     },
      include: {
        category: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
         },
       },
        updatedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
         },
       },
     },
   });

    // Create version snapshot
    await this.versioningService.createVersion(
      'STOCK',
      stock.id,
      stock,
      'UPDATE',
    );

    // Create audit log
    try {
      await this.auditService.createAuditLog(
        'UPDATE',
        'STOCK',
        id,
        { before: existing, after: stock },
        { operation: 'stock_updated', stockName: stock.name },
      );
   } catch (error) {
      // Log error but don't fail the operation
      this.logger.error('Failed to create audit log for stock update:', error);
   }

    // Invalidate cache
    await this.invalidateCache(id);

    // Record new price in history if modified
    if (dto.price !== undefined && dto.price !== existing.price) {
      try {
        await this.addPricePoint(
          id,
          {
            price: dto.price,
            date: new Date().toISOString(),
         },
          adminId,
        );
     } catch (error) {
        this.logger.error('Failed to record updated price in history:', error);
     }
   }

    // Sync name changes to stock ledger
    const updatedName = (dto as any).name;
    if (updatedName !== undefined && updatedName !== existing.name) {
      const displayName = updatedName.toLowerCase().endsWith('share') || updatedName.toLowerCase().endsWith('shares')
        ? updatedName
        : `${updatedName} Share`;
      try {
        await this.prisma.ledger.updateMany({
          where: { stockId: id },
          data: { name: displayName },
       });
     } catch (err) {
        this.logger.error('Failed to sync stock name update to ledger:', err);
     }
   }

    // Sync ISIN changes to stock ledger metadata
    if (dto.isin !== undefined && dto.isin !== existing.isin) {
      try {
        await this.prisma.ledger.updateMany({
          where: { stockId: id },
          data: { metadata: dto.isin ? { isin: dto.isin } : undefined },
       });
     } catch (err) {
        this.logger.error('Failed to sync stock ISIN update to ledger metadata:', err);
     }
   }

    return stock;
 }

  /**
   * Propose a stock update for Maker-Checker flow (Operations)
   * @param id - Stock ID
   * @param dto - Proposed update data
   * @param adminId - ID of admin proposing the update
   * @returns The created ChangeRequest
   */
  async proposeStockUpdate(id: string, dto: UpdateStockDto, adminId: string) {
    const existing = await this.prisma.stock.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Stock with ID ${id} not found`);
   }

    // Determine what actually changed
    const proposedData: any = {};
    if (dto.price !== undefined && dto.price !== existing.price) proposedData.price = dto.price;
    if (dto.isActive !== undefined && dto.isActive !== existing.isActive) proposedData.isActive = dto.isActive;
    if (dto.internalLendingPrice !== undefined && dto.internalLendingPrice !== existing.internalLendingPrice) proposedData.internalLendingPrice = dto.internalLendingPrice;
    if (dto.externalLendingPrice !== undefined && dto.externalLendingPrice !== existing.externalLendingPrice) proposedData.externalLendingPrice = dto.externalLendingPrice;
    if (dto.discountSlabs !== undefined) proposedData.discountSlabs = dto.discountSlabs;
    if (dto.backupQuantity !== undefined && dto.backupQuantity !== existing.backupQuantity) proposedData.backupQuantity = dto.backupQuantity;

    if (Object.keys(proposedData).length === 0) {
      throw new BadRequestException('No changes proposed');
   }

    const changeRequest = await this.prisma.changeRequest.create({
      data: {
        entityType: 'STOCK_PRICING',
        entityId: id,
        proposedData,
        status: 'PENDING',
        requestedById: adminId,
     },
   });

    return changeRequest;
 }

  // ============================================================
  // CMS MAKER-CHECKER PROPOSALS (nothing goes live here)
  // CMS controllers call these; Admin controllers call the direct
  // create/update/delete above. Approval executes via ApprovalsService.
  // ============================================================

  private cmsLabel(dto: any): string {
    return dto?.name ?? dto?.title ?? dto?.slug ?? dto?.cin ?? 'record';
 }

  async proposeStockCreate(dto: CreateStockDto, adminId: string) {
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'STOCK',
        entityId: null,
        proposedData: { action: 'CREATE', data: JSON.parse(JSON.stringify(dto)), label: `Create stock: ${this.cmsLabel(dto)}` },
        status: 'PENDING',
        requestedById: adminId,
     },
   });
 }

  async proposeStockUpdateCms(id: string, dto: UpdateStockDto, adminId: string) {
    const existing = await this.prisma.stock.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Stock with ID ${id} not found`);
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'STOCK',
        entityId: id,
        proposedData: { 
          action: 'UPDATE', 
          data: JSON.parse(JSON.stringify(dto)), 
          label: `Edit stock: ${existing.name}`,
          _snapshot: existing,
       },
        status: 'PENDING',
        requestedById: adminId,
     },
   });
 }

  async proposeStockDelete(id: string, adminId: string) {
    const existing = await this.prisma.stock.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Stock with ID ${id} not found`);
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'STOCK',
        entityId: id,
        proposedData: { action: 'DELETE', data: {}, label: `Delete stock: ${existing.name}` },
        status: 'PENDING',
        requestedById: adminId,
     },
   });
 }

  /**
   * Delete stock (Admin only)
   * Soft delete by setting isActive to false
   * @param id - Stock ID
   * @param adminId - ID of admin deleting the stock
   */
  async deleteStock(id: string, adminId: string) {
    const stock = await this.prisma.stock.findUnique({ where: { id } });
    if (!stock) {
      throw new NotFoundException(`Stock with ID ${id} not found`);
   }

    // Soft delete
    await this.prisma.stock.update({
      where: { id },
      data: {
        isActive: false,
        updatedById: adminId,
     },
   });

    // Create audit log
    try {
      await this.auditService.createAuditLog('DELETE', 'STOCK', id, stock, {
        operation: 'stock_soft_deleted',
        stockName: stock.name,
     });
   } catch (error) {
      // Log error but don't fail the operation
      this.logger.error('Failed to create audit log for stock deletion:', error);
   }

    // Invalidate cache
    await this.invalidateCache(id);

    return { success: true, message: 'Stock deleted successfully' };
 }

  /**
   * Invalidate Redis cache for stocks
   * AND triggers background revalidation for the web frontend
   * @param stockId - Optional specific stock ID to invalidate
   */
  async invalidateCache(stockId?: string) {
    // 1. Invalidate backend Redis cache
    await this.redis.delete(this.CACHE_KEY_ALL_STOCKS);
    await this.redis.delete('stocks:categories:active');

    if (stockId) {
      await this.redis.delete(`${this.CACHE_KEY_STOCK_PREFIX}${stockId}`);
   }

    // 2. Queue background revalidation for the web application (Next.js)
    // We move this to a queue to avoid blocking the Admin UI with slow network calls
    try {
      const id = stockId || 'all';
      // Use jobId for deduplication: avoids spamming revalidations for the same stock
      // within a short window (e.g. per minute).
      const deduplicationKey = `revalidate-${id}-${new Date().toISOString().slice(0, 16)}`; 
      
      await this.revalidationQueue.add('revalidate-stocks', {
        stockId,
        timestamp: new Date().toISOString(),
     }, {
        jobId: deduplicationKey,
        removeOnComplete: true,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
       }
     });
   } catch (error) {
      this.logger.error('[StocksService] Failed to queue revalidation:', error);
   }
 }

  /**
   * Get version history for a stock
   * @param id - Stock ID
   * @returns Version history
   */
  async getStockVersionHistory(id: string) {
    return this.versioningService.getVersionHistory('STOCK', id);
 }

  /**
   * Rollback stock to a specific version
   * @param id - Stock ID
   * @param versionNumber - Version number to rollback to
   * @param adminId - ID of admin performing rollback
   * @returns Updated stock
   */
  async rollbackStock(id: string, versionNumber: number, adminId: string) {
    // Get the version content to restore
    const versionContent = (await this.versioningService.rollbackToVersion(
      'STOCK',
      id,
      versionNumber,
    )) as any;

    // Historical snapshots may still contain relation arrays from earlier schema versions.
    // Strip them before writing back into the scalar Stock model during rollback.
    const {
      id: _,
      createdAt,
      createdBy,
      updatedBy,
      directors,
      documents,
      ...updateData
   } = versionContent;

    void updatedBy;
    void directors;
    void documents;

    const stock = await this.prisma.stock.update({
      where: { id },
      data: {
        ...updateData,
        updatedById: adminId,
     },
      include: {
        category: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
         },
       },
        updatedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
         },
       },
     },
   });

    // Create a new version with changeType 'ROLLBACK'
    await this.versioningService.createVersion(
      'STOCK',
      stock.id,
      stock,
      'ROLLBACK',
    );

    // Invalidate cache
    await this.invalidateCache(id);

    return stock;
 }

  /**
   * Upload a document file (local storage)
   * @param filename - Original filename
   * @param buffer - File buffer
   * @param mimetype - File MIME type
   * @returns Object with file URL
   */
  async uploadDocument(filename: string, buffer: Buffer, mimetype: string) {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'documents');

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
   }

    // Generate unique filename
    const extension = path.extname(filename);
    const uniqueFilename = `${uuidv4()}${extension}`;
    const filePath = path.join(uploadsDir, uniqueFilename);

    // Write file to disk
    fs.writeFileSync(filePath, buffer);

    // Return file URL (relative to server root)
    const fileUrl = `/uploads/documents/${uniqueFilename}`;

    return {
      url: fileUrl,
      filename: uniqueFilename,
      originalName: filename,
      mimetype,
      size: buffer.length,
   };
 }
  
  /**
   * Get price history for a stock
   * @param stockIdOrSlug - Stock ID or Slug
   * @returns Array of price points
   */
  async getPriceHistory(stockIdOrSlug: string) {
    const stockId = await this.resolveStockId(stockIdOrSlug);
    return this.prisma.stockPrice.findMany({
      where: { stockId },
      orderBy: { date: 'asc' },
   });
 }

  /**
   * Add a price point for a stock
   * @param stockId - Stock ID
   * @param dto - Price point data
   * @param adminId - ID of admin adding the price
   * @returns Created price point
   */
  async addPricePoint(stockId: string, dto: CreateStockPriceDto, adminId: string) {
    // Verify stock exists
    const stock = await this.prisma.stock.findUnique({
      where: { id: stockId },
   });

    if (!stock) {
      throw new NotFoundException(`Stock with ID ${stockId} not found`);
   }

    // Add or update price point (upsert)
    const pricePoint = await this.prisma.stockPrice.upsert({
      where: {
        stockId_date: {
          stockId,
          date: new Date(dto.date),
       },
     },
      update: {
        price: dto.price,
     },
      create: {
        stockId,
        price: dto.price,
        date: new Date(dto.date),
     },
   });

    // Create audit log
    try {
      await this.auditService.createAuditLog(
        'UPDATE_PRICE',
        'STOCK',
        stockId,
        { price: dto.price, date: dto.date },
        { operation: 'stock_price_added', stockName: stock.name },
      );
   } catch (error) {
      this.logger.error('Failed to create audit log for price addition:', error);
   }

    // Invalidate stock cache
    await this.invalidateCache(stockId);

    return pricePoint;
 }

  /**
   * Delete a price point
   * @param id - Price point ID
   * @param adminId - ID of admin deleting the price
   */
  async deletePricePoint(id: string, adminId: string) {
    const pricePoint = await this.prisma.stockPrice.findUnique({
      where: { id },
   });

    if (!pricePoint) {
      throw new NotFoundException(`Price point with ID ${id} not found`);
   }

    await this.prisma.stockPrice.delete({
      where: { id },
   });

    // Invalidate stock cache
    await this.invalidateCache(pricePoint.stockId);

    return { success: true, message: 'Price point deleted successfully' };
 }

  /**
   * Get company details from the database (cached from Probe42 API)
   * @param cin - Corporate Identification Number
   */
  async getCompanyDataByCin(cin: string) {
    const uppercaseCin = cin.toUpperCase();
    const cacheKey = `${this.CACHE_KEY_COMPANY_PREFIX}${uppercaseCin}`;

    // 1. Try to fetch from Redis
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return cached;
     }
   } catch (err) {
      this.logger.warn(`Failed to read from cache for CIN ${uppercaseCin}`, err);
   }

    // 2. Fetch from DB
    const record = await this.prisma.companyData.findUnique({
      where: { cin: uppercaseCin },
   });

    if (!record) {
      throw new NotFoundException(`Company data for CIN ${cin} not found in database`);
   }

    // 3. Store in Redis
    try {
      await this.redis.set(cacheKey, record.data, this.CACHE_TTL_COMPANY);
   } catch (err) {
      this.logger.warn(`Failed to write to cache for CIN ${uppercaseCin}`, err);
   }

    return record.data;
 }


  /**
   * Fetch company document stream from Probe42
   * @param cin - Corporate Identification Number
   * @param docId - Probe42 reference document ID
   */
  async getCompanyDocumentBuffer(cin: string, docId: string): Promise<Buffer> {
    return this.probe42Service.getCompanyDocument(cin, docId);
 }

  /**
   * Get current company sync status from Redis
   */
  async getCompanySyncStatus() {
    const status = await this.redis.get('company:sync:status');
    return status || { active: false };
 }

  /**
   * Run manual background sync for selected company CINs.
   * Updates progress in Redis status key and pauses 1s between calls.
   */
  async runCompanySync(cins: string[]) {
    const statusKey = 'company:sync:status';
    const status = {
      active: true,
      total: cins.length,
      processed: 0,
      success: 0,
      failed: 0,
      currentCin: '',
      currentName: '',
      errors: [] as { cin: string; name: string; error: string }[],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
   };

    await this.redis.set(statusKey, status, 3600); // 1 hour TTL

    // Execute in background
    (async () => {
      for (const cin of cins) {
        // Double check if sync was cancelled or cleared
        const currentStatus = await this.redis.get(statusKey);
        if (!currentStatus || !currentStatus.active) {
          break;
       }

        let stockName = cin;
        try {
          const stock = await this.prisma.stock.findFirst({
            where: { cin: { equals: cin, mode: 'insensitive' } },
         }) || await this.prisma.upcomingStock.findFirst({
            where: { cin: { equals: cin, mode: 'insensitive' } },
         });
          if (stock) {
            stockName = stock.name;
         }
       } catch (dbErr) {
          this.logger.warn(`Failed to resolve stock details for CIN ${cin} in sync`, dbErr);
       }

        // Update active item status
        status.currentCin = cin;
        status.currentName = stockName;
        status.updatedAt = new Date().toISOString();
        await this.redis.set(statusKey, status, 3600);

        try {
          const probeData = await this.probe42Service.getCompanyDetails(cin);
          if (probeData) {
            await this.prisma.companyData.upsert({
              where: { cin: cin.toUpperCase() },
              update: {
                data: probeData,
             },
              create: {
                cin: cin.toUpperCase(),
                data: probeData,
             },
           });
            await this.redis.delete(`${this.CACHE_KEY_COMPANY_PREFIX}${cin.toUpperCase()}`);
            status.success++;
         } else {
            throw new Error('No data returned from Probe42 API');
         }
       } catch (apiErr: any) {
          this.logger.error(`Sync failed for CIN ${cin}: ${apiErr.message}`, apiErr.stack);
          status.failed++;
          status.errors.push({
            cin,
            name: stockName,
            error: apiErr.message || 'Unknown error',
         });
       }

        status.processed++;
        status.updatedAt = new Date().toISOString();
        await this.redis.set(statusKey, status, 3600);

        // 1-second delay between requests
        if (status.processed < status.total) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
       }
     }

      // Mark sync as completed
      status.active = false;
      status.currentCin = '';
      status.currentName = '';
      status.updatedAt = new Date().toISOString();
      await this.redis.set(statusKey, status, 3600);
   })().catch((err) => {
      this.logger.error('Unhandled error in background company data sync job', err);
   });
 }

  /**
   * Record a user's interest in a stock that is out of stock or has
   * insufficient inventory for the requested quantity.
   */
  async expressInterest(stockId: string, userId: string, requestedQuantity?: number) {
    // Check if stock exists
    const stock = await this.prisma.stock.findUnique({
      where: { id: stockId },
   });
    if (!stock) {
      throw new NotFoundException(`Stock with ID ${stockId} not found`);
   }

    // Upsert interest to prevent duplicate error but update the updatedAt timestamp
    return await this.prisma.stockInterest.upsert({
      where: {
        userId_stockId: {
          userId,
          stockId,
       },
     },
      update: {
        updatedAt: new Date(),
        ...(requestedQuantity != null && { requestedQuantity }),
     },
      create: {
        userId,
        stockId,
        ...(requestedQuantity != null && { requestedQuantity }),
     },
   });
 }

  /**
   * Retrieve all captured stock interests for admin/operations overview.
   */
  async getAllInterests() {
    return await this.prisma.stockInterest.findMany({
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
         },
       },
        stock: {
          select: {
            id: true,
            name: true,
            cin: true,
         },
       },
     },
      orderBy: {
        createdAt: 'desc',
     },
   });
 }

  /**
   * Extract embedded attachments from a PDF document
   * @param buffer - Raw PDF buffer
   * @returns Array of attachments with name, size, and raw data
   */
  async extractDocumentAttachments(buffer: Buffer) {
    const doc = await PDFDocument.load(buffer);
    const catalog = doc.catalog;
    
    const names = catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
    if (!names) return [];
    
    const embeddedFiles = names.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict);
    if (!embeddedFiles) return [];
    
    const namesArray = embeddedFiles.lookupMaybe(PDFName.of('Names'), PDFArray);
    if (!namesArray) return [];
    
    const attachments: { name: string; data: Uint8Array; size: number }[] = [];
    for (let i = 0; i < namesArray.size(); i += 2) {
      const fileSpec = namesArray.lookupMaybe(i + 1, PDFDict);
      if (!fileSpec) continue;
      
      let filename = `attachment_${i / 2}`;
      const fName = fileSpec.lookupMaybe(PDFName.of('UF'), PDFString) 
        || fileSpec.lookupMaybe(PDFName.of('F'), PDFString) 
        || fileSpec.lookupMaybe(PDFName.of('F'), PDFHexString);
      
      if (fName) {
        filename = fName.decodeText();
     }
      
      const ef = fileSpec.lookupMaybe(PDFName.of('EF'), PDFDict);
      if (!ef) continue;
      
      const fStreamRef = ef.get(PDFName.of('F'));
      if (!fStreamRef) continue;
      
      const fStream = doc.context.lookup(fStreamRef);
      if (!(fStream instanceof PDFRawStream)) continue;
      
      try {
        const decoded = decodePDFRawStream(fStream).decode();
        attachments.push({
          name: filename,
          data: decoded,
          size: decoded.length
       });
     } catch (err) {
        this.logger.error(`Failed to decode PDF attachment ${filename}:`, err);
     }
   }
    return attachments;
 }

  /**
   * Capture End Of Day (EOD) and Start Of Day (SOD) snapshots for all active stocks.
   * This is typically called automatically by a scheduled job at midnight, but can be triggered manually.
   * @param adminId - Optional admin ID (defaults to SYSTEM_BATCH)
   */
  async captureDailySnapshots(adminId: string = 'SYSTEM_BATCH') {
    this.logger.log('Capturing daily stock snapshots (EOD for yesterday, SOD for today)');
    
    const activeStocks = await this.prisma.stock.findMany({
      where: { isActive: true },
      select: { id: true, stockQuantity: true }
   });

    const now = new Date();
    // Normalize to start of day for "today"
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Normalize to start of day for "yesterday"
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const movementsData: any[] = [];
    for (const stock of activeStocks) {
      // EOD Snapshot for Yesterday
      movementsData.push({
        stockId: stock.id,
        qty: stock.stockQuantity,
        type: 'EOD_SNAPSHOT',
        snapshotDate: yesterday,
        createdById: adminId,
     });

      // SOD Snapshot for Today
      movementsData.push({
        stockId: stock.id,
        qty: stock.stockQuantity,
        type: 'SOD_SNAPSHOT',
        snapshotDate: today,
        createdById: adminId,
     });
   }

    if (movementsData.length > 0) {
      await this.prisma.inventoryMovement.createMany({
        data: movementsData,
     });
      this.logger.log(`Successfully captured ${movementsData.length} snapshot records.`);
   }
    
    return { success: true, count: movementsData.length };
 }
}
