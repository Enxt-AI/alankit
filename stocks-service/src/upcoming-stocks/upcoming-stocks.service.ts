import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,

} from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { VersioningService } from '../versioning/versioning.service';
import { AuditService } from '../audit/audit.service';
import { Probe42Service } from '../stocks/probe42.service';
import { CreateUpcomingStockDto } from './dto/create-upcoming-stock.dto';
import { UpdateUpcomingStockDto } from './dto/update-upcoming-stock.dto';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * UpcomingStocksService
 *
 * Mirrors the existing StocksService patterns:
 * - Redis caching for public endpoints (5 minute TTL)
 * - Audit logs are best-effort (failures do not block the main operation)
 * - Version snapshots are created for CREATE/UPDATE/DELETE
 *
 *
 * Important invariants:
 * - This is **irreversible**: the upcoming stock row is hard-deleted.
 * - Watchlist entries must remain stable for users: we migrate rows in-place
 *   so users keep a single watchlist item, now pointing at the new regular stock.
 * - If any step fails inside the transaction, the DB is rolled back to the pre-conversion state.
 * Key differences vs regular stocks:
 * - Deletes are HARD deletes (Upcoming stocks are purely curated content)
 * - List ordering is newest-first for the Upcoming tab
 */
@Injectable()
export class UpcomingStocksService {
  private readonly logger = new PinoNestLogger('stocks-service', '');

  // Redis cache keys
  private readonly CACHE_KEY_ALL_UPCOMING_STOCKS = 'upcoming-stocks:all:active';
  private readonly CACHE_KEY_UPCOMING_STOCK_PREFIX = 'upcoming-stock:';
  private readonly CACHE_KEY_COMPANY_PREFIX = 'company:details:';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private versioningService: VersioningService,
    private auditService: AuditService,
    private configService: ConfigService,
    private probe42Service: Probe42Service,
  ) {}

  /**
   * Create a new upcoming stock (Admin/CMS)
   * @param dto - Incoming creation payload
   * @param adminId - Admin performing the action (from JWT context)
   */
  async createUpcomingStock(dto: CreateUpcomingStockDto, adminId: string) {
    // CIN is the only business identifier for upcoming stocks, so we validate it
    // explicitly to keep conversion and deduplication behavior predictable.
    const existing = await this.prisma.upcomingStock.findUnique({
      where: { cin: dto.cin },
   });

    if (existing) {
      throw new ConflictException(
        `Upcoming stock with CIN ${dto.cin} already exists`,
      );
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
      throw new BadRequestException(`Failed to register upcoming company: Probe42 API failed: ${error.message}`);
   }

    const upcomingStock = await this.prisma.upcomingStock.create({
      data: {
        name: dto.name,
        price: dto.price,

        logoUrl: dto.logoUrl,
        tags: dto.tags ?? [],
        isin: dto.isin,
        // CIN is the permanent business identifier for upcoming stocks.
        // We persist it immediately and never allow it to change later.
        cin: dto.cin,
        isActive: dto.isActive ?? true,
        // UpcomingStock includes isPopular for conversion workflows.
        // We keep it false for upcoming stocks.
        isPopular: false,
        totalShares: dto.totalShares,
        createdById: adminId,
     },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
         },
       },
     },
   });

    // Version snapshot
    await this.versioningService.createVersion(
      'UPCOMING_STOCK',
      upcomingStock.id,
      upcomingStock,
      'CREATE',
    );

    // Audit log (best-effort)
    try {
      await this.auditService.createAuditLog(
        'CREATE',
        'UPCOMING_STOCK',
        upcomingStock.id,
        upcomingStock,
        {
          operation: 'upcoming_stock_created',
          stockName: upcomingStock.name,
       },
      );
   } catch (error) {
      this.logger.error(
        'Failed to create audit log for upcoming stock creation:',
        error,
      );
   }

    await this.invalidateCache();

    return upcomingStock;
 }

  /**
   * Admin/CMS: Get all upcoming stocks (including inactive)
   */
  async getAllUpcomingStocksAdmin() {
    const stocks = await this.prisma.upcomingStock.findMany({
      include: {
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
      orderBy: { createdAt: 'desc' },
   });

    return stocks.map((stock) => ({
      ...stock,
      marketCap: (stock.totalShares || 0) * stock.price,
   }));
 }

  /**
   * Public: Get all active upcoming stocks (with Redis caching)
   *
   * Ordering is newest-first to support the Upcoming tab UX.
   */
  async getAllActiveUpcomingStocks() {
    const cached = await this.redis.get(this.CACHE_KEY_ALL_UPCOMING_STOCKS);
    if (cached) {
      return JSON.parse(cached);
   }

    const stocks = await this.prisma.upcomingStock.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        price: true,
        logoUrl: true,
        tags: true,
        isin: true,
        cin: true,
        totalShares: true,
     },
      orderBy: { createdAt: 'desc' },
   });

    const enriched = stocks.map((stock) => ({
      ...stock,
      marketCap: (stock.totalShares || 0) * stock.price,
   }));

    await this.redis.set(
      this.CACHE_KEY_ALL_UPCOMING_STOCKS,
      JSON.stringify(enriched),
      this.CACHE_TTL,
    );

    return enriched;
 }

  /**
   * Public: Get single upcoming stock by id (with Redis caching)
   */
  async getUpcomingStockById(id: string) {
    const cacheKey = `${this.CACHE_KEY_UPCOMING_STOCK_PREFIX}${id}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
   }

    const stock = await this.prisma.upcomingStock.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        price: true,
        logoUrl: true,
        tags: true,
        isin: true,
        cin: true,
        isActive: true,
        isPopular: true,
        totalShares: true,
     },
   });

    if (!stock || !stock.isActive) {
      throw new NotFoundException(`Upcoming stock with ID ${id} not found`);
   }

    const { isActive: _active, ...rest } = stock;

    const enriched = {
      ...rest,
      marketCap: (stock.totalShares || 0) * stock.price,
   };

    await this.redis.set(cacheKey, JSON.stringify(enriched), this.CACHE_TTL);

    return enriched;
 }

  /**
   * Public: Get single upcoming stock by CIN
   */
  async getUpcomingStockByCin(cin: string) {
    const stock = await this.prisma.upcomingStock.findUnique({
      where: { cin },
      select: {
        id: true,
        name: true,
        price: true,
        logoUrl: true,
        tags: true,
        isin: true,
        cin: true,
        isActive: true,
        isPopular: true,
        totalShares: true,
        createdAt: true,
        updatedAt: true,
     },
   });

    if (!stock) {
      throw new NotFoundException(
        `Upcoming stock with CIN ${cin} not found`,
      );
   }

    return stock;
 }

  /**
   * Update an upcoming stock (Admin/CMS)
   */
  async updateUpcomingStock(
    id: string,
    dto: UpdateUpcomingStockDto,
    adminId: string,
  ) {
    const existing = await this.prisma.upcomingStock.findUnique({
      where: { id },
   });

    if (!existing) {
      throw new NotFoundException(`Upcoming stock with ID ${id} not found`);
   }





    const updated = await this.prisma.upcomingStock.update({
      where: { id },
      data: {
        ...dto,
        // Keep isPopular false (even if included accidentally in DTO).
        isPopular: false,
        updatedById: adminId,
     },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
       },
        updatedBy: {
          select: { id: true, fullName: true, email: true },
       },
     },
   });

    await this.versioningService.createVersion(
      'UPCOMING_STOCK',
      id,
      updated,
      'UPDATE',
    );

    try {
      await this.auditService.createAuditLog(
        'UPDATE',
        'UPCOMING_STOCK',
        id,
        { before: existing, after: updated },
        {
          operation: 'upcoming_stock_updated',
          stockName: updated.name,
       },
      );
   } catch (error) {
      this.logger.error(
        'Failed to create audit log for upcoming stock update:',
        error,
      );
   }

    await this.invalidateCache(id);

    return updated;
 }

  /**
   * Hard delete an upcoming stock (Admin/CMS)
   *
   * This cascades to:
   * - UpcomingStockDocument
   * - WatchlistItem rows pointing to this UpcomingStock
   */
  async deleteUpcomingStock(id: string, adminId: string) {
    const existing = await this.prisma.upcomingStock.findUnique({
      where: { id },
   });

    if (!existing) {
      throw new NotFoundException(`Upcoming stock with ID ${id} not found`);
   }

    await this.prisma.upcomingStock.delete({
      where: { id },
   });

    try {
      await this.auditService.createAuditLog(
        'DELETE',
        'UPCOMING_STOCK',
        id,
        existing,
        {
          operation: 'upcoming_stock_hard_deleted',
          stockName: existing.name,
       },
      );
   } catch (error) {
      this.logger.error(
        'Failed to create audit log for upcoming stock deletion:',
        error,
      );
   }

    await this.versioningService.createVersion(
      'UPCOMING_STOCK',
      id,
      existing,
      'DELETE',
    );

    await this.invalidateCache(id);

    return { success: true, message: 'Upcoming stock deleted successfully' };
 }

  // ---- Maker-checker proposals (CMS; nothing goes live) ----
  async proposeCreate(dto: CreateUpcomingStockDto, adminId: string) {
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'UPCOMING_STOCK',
        entityId: null,
        proposedData: { action: 'CREATE', data: JSON.parse(JSON.stringify(dto)), label: `Add upcoming stock: ${(dto as any)?.name ?? (dto as any)?.cin ?? 'record'}` },
        status: 'PENDING',
        requestedById: adminId,
     },
   });
 }

  async proposeUpdate(id: string, dto: UpdateUpcomingStockDto, adminId: string) {
    const existing = await this.prisma.upcomingStock.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Upcoming stock with ID ${id} not found`);
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'UPCOMING_STOCK',
        entityId: id,
        proposedData: { action: 'UPDATE', data: JSON.parse(JSON.stringify(dto)), label: `Edit upcoming stock: ${existing.name}` },
        status: 'PENDING',
        requestedById: adminId,
     },
   });
 }

  async proposeDelete(id: string, adminId: string) {
    const existing = await this.prisma.upcomingStock.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Upcoming stock with ID ${id} not found`);
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'UPCOMING_STOCK',
        entityId: id,
        proposedData: { action: 'DELETE', data: {}, label: `Delete upcoming stock: ${existing.name}` },
        status: 'PENDING',
        requestedById: adminId,
     },
   });
 }

  /**
   * Get version history for an upcoming stock
   */
  async getUpcomingStockVersionHistory(id: string) {
    return this.versioningService.getVersionHistory('UPCOMING_STOCK', id);
 }

  /**
   * Get a specific version by number for an upcoming stock
   */
  async getUpcomingStockVersionByNumber(id: string, versionNumber: number) {
    return this.versioningService.getVersionByNumber(
      'UPCOMING_STOCK',
      id,
      versionNumber,
    );
 }

  /**
   * Rollback an upcoming stock to a specific version
   */
  async rollbackUpcomingStock(id: string, versionNumber: number, adminId: string) {
    const versionContent = (await this.versioningService.rollbackToVersion(
      'UPCOMING_STOCK',
      id,
      versionNumber,
    )) as any;

    const {
      id: _,
      createdAt,
      updatedAt,
      name,
      cin,
      createdBy,
      updatedBy,
      documents,
      ...updateData
   } = versionContent;

    // Rollback must preserve immutable identity rules even for historical
    // snapshots captured before this cleanup. Older versions may still contain
    // `name`, `cin`, or `description`, but we intentionally ignore them here.
    void name;
    void cin;

    const updated = await this.prisma.upcomingStock.update({
      where: { id },
      data: {
        ...updateData,
        // Ensure upcoming stocks are never marked as popular.
        isPopular: false,
        updatedById: adminId,
     },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
       },
        updatedBy: {
          select: { id: true, fullName: true, email: true },
       },
     },
   });

    await this.versioningService.createVersion(
      'UPCOMING_STOCK',
      updated.id,
      updated,
      'ROLLBACK',
    );

    await this.invalidateCache(id);

    return updated;
 }

  /**
   * Convert an upcoming stock to a regular stock (one-way, irreversible).
   *
   * Purpose:
   * - Creates a new `Stock` row by copying all core fields from `UpcomingStock`
  * - Copies related documents
   * - Migrates watchlist items from `upcomingStockId` to `stockId`
   * - Captures a version snapshot for the upcoming stock before deletion
   * - Writes an audit log entry for the conversion
  * - Hard deletes the `UpcomingStock` row after supported relation migration
   * - Invalidates both upcoming-stock caches and regular-stock caches
   *
   * Parameters:
   * @param upcomingStockId - ID of the upcoming stock to convert
   * @param adminId - Admin performing the conversion (from auth context)
   *
   * Returns:
   * - Success response with the new regular stock identifier and basic details
   *
   * Throws:
   * - NotFoundException: if the upcoming stock does not exist
  * - ConflictException: if a regular stock already exists with the same CIN
   *
   * Transaction flow (atomic):
   * 1) Create `Stock`
  * 2) Create `StockDocument` rows
  * 3) Update `WatchlistItem` rows (set `stockId`, null `upcomingStockId`)
  * 4) Delete `UpcomingStock`
   */
  async convertToRegularStock(upcomingStockId: string, adminId: string) {
    // 1) Fetch upcoming stock with relations
    const upcomingStock = await this.prisma.upcomingStock.findUnique({
      where: { id: upcomingStockId },
   });

    // 2) Validate existence
    if (!upcomingStock) {
      throw new NotFoundException(
        `Upcoming stock with ID ${upcomingStockId} not found`,
      );
   }



    // 3) Check for CIN conflicts with regular stocks.
    const cinConflict = await this.prisma.stock.findUnique({
      where: { cin: upcomingStock.cin },
   });

    if (cinConflict) {
      throw new ConflictException(`Stock with CIN ${upcomingStock.cin} already exists`);
   }

    try {
      // 4) Transaction: create new stock, migrate watchlist, delete upcoming stock.
      const newStock = await this.prisma.$transaction(async (tx) => {
        // 4.1 Create regular stock
        const created = await tx.stock.create({
          data: {
            name: upcomingStock.name,
            price: upcomingStock.price,

            logoUrl: upcomingStock.logoUrl,
            tags: upcomingStock.tags,
            isin: upcomingStock.isin,
            cin: upcomingStock.cin,
            totalShares: upcomingStock.totalShares,
            isActive: upcomingStock.isActive,
            isPopular: false,
            createdById: upcomingStock.createdById,
         },
       });

        // 4.2 Migrate watchlist items.
        await tx.watchlistItem.updateMany({
          where: { upcomingStockId },
          data: {
            stockId: created.id,
            upcomingStockId: null,
         },
       });

        // 4.4 Hard delete the upcoming row after supported relations are copied.
        // After this point, the upcoming stock will no longer be retrievable.
        await tx.upcomingStock.delete({
          where: { id: upcomingStockId },
       });

        return created;
     });

      // 5) Create version snapshot for conversion (preserve upcoming stock state prior to deletion)
      await this.versioningService.createVersion(
        'UPCOMING_STOCK',
        upcomingStockId,
        upcomingStock,
        'CONVERT',
      );

      // 7) Invalidate caches for both upcoming and regular stock listings
      await this.invalidateCache(upcomingStockId, true);

      // 8) Return new stock with success response
      return {
        success: true,
        message: 'Upcoming stock converted to regular stock successfully',
        data: {
          newStockId: newStock.id,
          cin: newStock.cin,
          name: newStock.name,
       },
     };
   } catch (error) {
      this.logger.error('convertToRegularStock failed:', error);

      // Preserve known exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
     }

      // Transaction failures roll back automatically
      throw new InternalServerErrorException(
        'Failed to convert upcoming stock to regular stock',
      );
   }
 }

  // =============================
  // Cache Invalidation
  // =============================


  // =============================
  // File Uploads (Local Storage)
  // =============================

  /**
   * Upload a document file for upcoming stocks (local storage).
   *
   * Validation of file type/size is done at the controller layer so we can return
   * clean HTTP 400 errors.
   */
  async uploadDocument(filename: string, buffer: Buffer, mimetype: string) {
    const uploadsDir = path.join(
      process.cwd(),
      'uploads',
      'upcoming-documents',
    );

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
   }

    const extension = path.extname(filename);
    const uniqueFilename = `${uuidv4()}${extension}`;
    const filePath = path.join(uploadsDir, uniqueFilename);

    fs.writeFileSync(filePath, buffer);

    // Fastify static plugin serves /uploads/* from {process.cwd()}/uploads.
    const fileUrl = `/uploads/upcoming-documents/${uniqueFilename}`;

    return {
      url: fileUrl,
      filename: uniqueFilename,
      originalName: filename,
      mimetype,
      size: buffer.length,
   };
 }

  /**
   * Invalidate Redis cache for upcoming stocks.
   * @param upcomingStockId - Optional id to invalidate the single-item cache key
   * @param invalidateRegularStocks - When true, also invalidates regular stocks cache
   */
  private async invalidateCache(
    upcomingStockId?: string,
    invalidateRegularStocks: boolean = false,
  ) {
    await this.redis.delete(this.CACHE_KEY_ALL_UPCOMING_STOCKS);

    if (invalidateRegularStocks) {
      await this.redis.delete('stocks:all:active');
   }

    if (upcomingStockId) {
      await this.redis.delete(
        `${this.CACHE_KEY_UPCOMING_STOCK_PREFIX}${upcomingStockId}`,
      );
   }
 }
}
