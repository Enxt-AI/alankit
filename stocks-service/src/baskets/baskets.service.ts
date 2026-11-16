import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,

} from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { VersioningService } from '../versioning/versioning.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/types/notification-types';
import { CreateBasketDto } from './dto/create-basket.dto';
import { UpdateBasketDto } from './dto/update-basket.dto';

/**
 * Service for managing stock baskets
 * Handles CRUD operations, caching, versioning, audit logging, and price calculations
 */
@Injectable()
export class BasketsService {
  private readonly logger = new PinoNestLogger('stocks-service', '');
  private readonly CACHE_PREFIX = 'baskets:';
  private readonly CACHE_TTL = 300; // 5 minutes in seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly versioningService: VersioningService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Generate a URL-safe slug from a basket name
   * @param name - Basket name
   * @returns Slug in kebab-case format
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
 }

  /**
   * Check if a slug already exists for a different basket
   * @param slug - Slug to check
   * @param excludeId - Basket ID to exclude from check (for updates)
   * @throws ConflictException if slug is already in use
   */
  private async ensureSlugUniqueness(
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.stockBasket.findFirst({
      where: {
        slug,
        ...(excludeId && { id: { not: excludeId } }),
     },
   });

    if (existing) {
      throw new ConflictException(
        `A basket with slug '${slug}' already exists. Please use a different name.`,
      );
   }
 }

  /**
   * Create a new stock basket with constituents
   * @param createBasketDto - Basket creation data
   * @param adminId - ID of the admin creating the basket
   * @returns Created basket with constituents
   */
  /**
   * Ensure every constituent stock exists and is active.
   * Inactive (soft-deleted) stocks must never enter a basket — they are hidden
   * from the CMS constituent picker, and this guard enforces it API-side
   * (including the maker-checker approval path, which reuses create/update).
   */
  private async ensureConstituentStocksActive(stockIds: string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(stockIds));
    if (uniqueIds.length === 0) return;

    const found = await this.prisma.stock.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true, isActive: true },
   });

    const foundIds = new Set(found.map((s) => s.id));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Constituent stocks not found: ${missing.join(', ')}`);
   }

    const inactive = found.filter((s) => s.isActive === false);
    if (inactive.length > 0) {
      const names = inactive.map((s) => s.name || s.id).join(', ');
      throw new BadRequestException(
        `Constituent stocks are inactive and cannot be added to a basket: ${names}`,
      );
   }
 }

  async createBasket(createBasketDto: CreateBasketDto, adminId: string) {
    this.logger.log(`Creating basket: ${createBasketDto.name}`);

    // Generate slug and ensure uniqueness
    const slug = this.generateSlug(createBasketDto.name);
    await this.ensureSlugUniqueness(slug);

    // Reject inactive / missing constituent stocks
    await this.ensureConstituentStocksActive(
      createBasketDto.constituents.map((c) => c.stockId),
    );

    // Use transaction to ensure atomicity
    const basket = await this.prisma.$transaction(async (tx) => {
      // Create the basket
      const newBasket = await tx.stockBasket.create({
        data: {
          name: createBasketDto.name,
          slug,
          description: createBasketDto.description,
          category: createBasketDto.category,
          iconUrl: createBasketDto.iconUrl,
          status: createBasketDto.status,
          subscriptionStartDate: createBasketDto.subscriptionStartDate
            ? new Date(createBasketDto.subscriptionStartDate)
            : new Date(),
          subscriptionEndDate: createBasketDto.subscriptionEndDate
            ? new Date(createBasketDto.subscriptionEndDate)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days from now
          minInvestment: createBasketDto.minInvestment,
          priceEffectiveDate: createBasketDto.priceEffectiveDate
            ? new Date(createBasketDto.priceEffectiveDate)
            : new Date(),
          isActive: createBasketDto.isActive,
          createdById: adminId,
          updatedById: adminId,
       },
        include: {
          constituents: {
            include: {
              stock: true,
           },
         },
       },
     });

      // Create basket constituents
      await tx.basketConstituent.createMany({
        data: createBasketDto.constituents.map((constituent) => ({
          basketId: newBasket.id,
          stockId: constituent.stockId,
          weight: constituent.weight,
       })),
     });

      // Fetch the complete basket with constituents
      return tx.stockBasket.findUnique({
        where: { id: newBasket.id },
        include: {
          constituents: {
            include: {
              stock: true,
           },
         },
       },
     });
   });

    if (!basket) {
      throw new Error('Failed to create basket');
   }

    // Create version history with full basket snapshot including constituents
    await this.versioningService.createVersion(
      'BASKET',
      basket.id,
      basket,
      'CREATED',
      `Basket created: ${basket.name}`,
    );

    // Create audit log with full basket snapshot
    try {
      await this.auditService.createAuditLog(
        'CREATE',
        'BASKET',
        basket.id,
        basket,
        { operation: 'basket_created', basketName: basket.name },
      );
   } catch (error) {
      this.logger.error(
        `Failed to create audit log for basket creation: ${basket.id}`,
        error,
      );
   }

    // Invalidate cache after creation
    await this.invalidateCache();

    /**
     * Broadcast: New basket created (notify ALL users)
     *
     * Requirements:
     * - Target every user row (no filters)
     * - Use metadata.redirectUrl = `/baskets/${basket.slug}`
     * - Best-effort: must not block basket creation if notification insertion fails
     * - Use bulk insert (createMany) for scale
     */
    try {
      const users = await this.prisma.user.findMany({
        select: { id: true },
     });

      if (users.length > 0) {
        const notificationsData = users.map((u) => ({
          userId: u.id,
          type: NotificationType.BASKET_CREATED,
          title: 'New Basket Available',
          message: `Check out "${basket.name}" curated by experts.`,
          metadata: {
            basketId: basket.id,
            basketSlug: basket.slug,
            basketName: basket.name,
            redirectUrl: `/baskets/${basket.slug}`,
         },
       }));

        // Chunked createMany under the hood (defaults to 1000 rows per batch)
        await this.notificationsService.bulkCreateNotifications(notificationsData);
     }
   } catch (error) {
      this.logger.warn(
        `Failed to broadcast BASKET_CREATED notification for basket ${basket.id}`,
        error as Error,
      );
   }

    this.logger.log(`Basket created successfully: ${basket.id}`);
    return basket;
 }

  async getAllBasketsAdmin() {
    this.logger.log('Fetching all baskets for admin');

    return this.prisma.stockBasket.findMany({
      where: {
        isActive: true,
     },
      include: {
        constituents: {
          include: {
            stock: true,
         },
       },
     },
      orderBy: {
        createdAt: 'desc',
     },
   });
 }

  /**
   * Get all active baskets (public view)
   * Uses Redis caching with 5-minute TTL
   * @returns Active baskets with calculated prices
   */
  async getAllActiveBasketsPublic() {
    this.logger.log('Fetching active baskets for public');

    // Check cache first
    const cacheKey = `${this.CACHE_PREFIX}active`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      this.logger.log('Returning cached active baskets');
      return JSON.parse(cached);
   }

    // Fetch from database
    const baskets = await this.prisma.stockBasket.findMany({
      where: {
        isActive: true,
     },
      include: {
        constituents: {
          include: {
            stock: {
              select: {
                id: true,
                name: true,
                price: true,
             },
           },
         },
       },
     },
      orderBy: {
        createdAt: 'desc',
     },
   });

    // Calculate prices, resolve statuses, and strip internal metadata/admin IDs
    const enrichedBaskets = baskets.map((basket) => {
      const { createdById, updatedById, isActive, ...rest } = basket as any;
      return {
        ...rest,
        currentPrice: this.calculateBasketPrice(basket),
        resolvedStatus: this.resolveBasketStatus(basket),
     };
   });

    // Cache the result
    await this.redisService.set(
      cacheKey,
      JSON.stringify(enrichedBaskets),
      this.CACHE_TTL,
    );

    this.logger.log(`Fetched ${enrichedBaskets.length} active baskets`);
    return enrichedBaskets;
 }

  /**
   * Get basket by ID (public view)
   * Uses Redis caching with 5-minute TTL
   * @param id - Basket ID
   * @returns Basket with calculated price
   */
  async getBasketById(id: string) {
    this.logger.log(`Fetching basket: ${id}`);

    // Check cache first
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      this.logger.log('Returning cached basket');
      return JSON.parse(cached);
   }

    // Fetch from database (allow lookup by cuid id or unique slug)
    const basket = await this.prisma.stockBasket.findFirst({
      where: {
        OR: [
          { id },
          { slug: id },
        ],
     },
      include: {
        constituents: {
          include: {
            stock: {
              select: {
                id: true,
                name: true,
                price: true,
                logoUrl: true,
                isin: true,
                cin: true,
                slug: true,
             },
           },
         },
       },
     },
   });

    if (!basket || !basket.isActive) {
      throw new NotFoundException(`Basket with ID or slug ${id} not found`);
   }

    // Calculate price, resolve status, and strip internal metadata/admin IDs
    const { createdById, updatedById, isActive, ...rest } = basket as any;
    const enrichedBasket = {
      ...rest,
      currentPrice: this.calculateBasketPrice(basket),
      resolvedStatus: this.resolveBasketStatus(basket),
   };

    // Cache the result
    await this.redisService.set(
      cacheKey,
      JSON.stringify(enrichedBasket),
      this.CACHE_TTL,
    );

    return enrichedBasket;
 }

  /**
   * Update an existing basket
   * @param id - Basket ID
   * @param updateBasketDto - Update data
   * @param adminId - ID of the admin updating the basket
   * @returns Updated basket
   */
  async updateBasket(
    id: string,
    updateBasketDto: UpdateBasketDto,
    adminId: string,
  ) {
    this.logger.log(`Updating basket: ${id}`);

    // Check if basket exists
    const existingBasket = await this.prisma.stockBasket.findUnique({
      where: { id },
      include: {
        constituents: true,
     },
   });

    if (!existingBasket) {
      throw new NotFoundException(`Basket with ID ${id} not found`);
   }

    // If name is being updated, regenerate slug and check uniqueness
    let newSlug: string | undefined;
    if (updateBasketDto.name && updateBasketDto.name !== existingBasket.name) {
      newSlug = this.generateSlug(updateBasketDto.name);
      await this.ensureSlugUniqueness(newSlug, id);
   }

    // Reject inactive / missing constituent stocks when allocation is replaced
    if (updateBasketDto.constituents) {
      await this.ensureConstituentStocksActive(
        updateBasketDto.constituents.map((c) => c.stockId),
      );
   }

    // Use transaction for atomicity
    const updatedBasket = await this.prisma.$transaction(async (tx) => {
      // Update basket
      const basket = await tx.stockBasket.update({
        where: { id },
        data: {
          ...(updateBasketDto.name && { name: updateBasketDto.name }),
          ...(newSlug && { slug: newSlug }),
          ...(updateBasketDto.description && {
            description: updateBasketDto.description,
         }),
          ...(updateBasketDto.category && {
            category: updateBasketDto.category,
         }),
          ...(updateBasketDto.iconUrl && { iconUrl: updateBasketDto.iconUrl }),
          ...(updateBasketDto.status && { status: updateBasketDto.status }),
          ...(updateBasketDto.subscriptionStartDate && {
            subscriptionStartDate: new Date(
              updateBasketDto.subscriptionStartDate,
            ),
         }),
          ...(updateBasketDto.subscriptionEndDate && {
            subscriptionEndDate: new Date(updateBasketDto.subscriptionEndDate),
         }),
          ...(updateBasketDto.minInvestment !== undefined && {
            minInvestment: updateBasketDto.minInvestment,
         }),
          ...(updateBasketDto.priceEffectiveDate && {
            priceEffectiveDate: new Date(updateBasketDto.priceEffectiveDate),
         }),
          ...(updateBasketDto.isActive !== undefined && {
            isActive: updateBasketDto.isActive,
         }),
          updatedById: adminId,
       },
        include: {
          constituents: {
            include: {
              stock: true,
           },
         },
       },
     });

      // Update constituents if provided
      if (updateBasketDto.constituents) {
        // Delete existing constituents
        await tx.basketConstituent.deleteMany({
          where: { basketId: id },
       });

        // Create new constituents
        await tx.basketConstituent.createMany({
          data: updateBasketDto.constituents.map((constituent) => ({
            basketId: id,
            stockId: constituent.stockId,
            weight: constituent.weight,
         })),
       });
     }

      // Fetch updated basket with new constituents
      return tx.stockBasket.findUnique({
        where: { id },
        include: {
          constituents: {
            include: {
              stock: true,
           },
         },
       },
     });
   });

    if (!updatedBasket) {
      throw new Error('Failed to update basket');
   }

    // Create new version with full basket snapshot including constituents
    await this.versioningService.createVersion(
      'BASKET',
      id,
      updatedBasket,
      'UPDATED',
      `Basket updated: ${updatedBasket.name}`,
    );

    // Create audit log with persisted basket state
    try {
      const changes = {
        before: existingBasket,
        after: updatedBasket,
     };
      await this.auditService.createAuditLog('UPDATE', 'BASKET', id, changes, {
        operation: 'basket_updated',
        basketName: updatedBasket.name,
     });
   } catch (error) {
      this.logger.error(
        `Failed to create audit log for basket update: ${id}`,
        error,
      );
   }

    // Invalidate cache
    await this.invalidateCache(id);

    this.logger.log(`Basket updated successfully: ${id}`);
    return updatedBasket;
 }

  /**
   * Delete a basket (soft delete by marking inactive)
   * @param id - Basket ID
   * @param adminId - ID of the admin deleting the basket
   * @returns Deleted basket
   */
  async deleteBasket(id: string, adminId: string) {
    this.logger.log(`Deleting basket: ${id}`);

    // Fetch basket with constituents before deletion for version history
    const basket = await this.prisma.stockBasket.findUnique({
      where: { id },
      include: {
        constituents: {
          include: {
            stock: true,
         },
       },
     },
   });

    if (!basket) {
      throw new NotFoundException(`Basket with ID ${id} not found`);
   }

    // Soft delete by marking as inactive
    const deletedBasket = await this.prisma.stockBasket.update({
      where: { id },
      data: {
        isActive: false,
        updatedById: adminId,
     },
   });

    // Create version for deletion with full basket snapshot
    await this.versioningService.createVersion(
      'BASKET',
      id,
      basket,
      'DELETED',
      `Basket soft deleted: ${basket.name}`,
    );

    // Create audit log with full basket snapshot
    try {
      await this.auditService.createAuditLog('DELETE', 'BASKET', id, basket, {
        operation: 'basket_soft_deleted',
        basketName: basket.name,
     });
   } catch (error) {
      this.logger.error(
        `Failed to create audit log for basket deletion: ${id}`,
        error,
      );
   }

    // Invalidate cache
    await this.invalidateCache(id);

    this.logger.log(`Basket deleted successfully: ${id}`);
    return deletedBasket;
 }

  // ---- Maker-checker proposals (CMS; nothing goes live) ----
  async proposeCreate(dto: any, adminId: string) {
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'BASKET',
        entityId: null,
        proposedData: { action: 'CREATE', data: dto, label: `Add basket: ${dto?.name ?? 'record'}` },
        status: 'PENDING',
        requestedById: adminId,
     },
   });
 }

  async proposeUpdate(id: string, dto: any, adminId: string) {
    const existing = await this.prisma.stockBasket.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Basket with ID ${id} not found`);
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'BASKET',
        entityId: id,
        proposedData: { action: 'UPDATE', data: dto, label: `Edit basket: ${existing.name}` },
        status: 'PENDING',
        requestedById: adminId,
     },
   });
 }

  async proposeDelete(id: string, adminId: string) {
    const existing = await this.prisma.stockBasket.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Basket with ID ${id} not found`);
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'BASKET',
        entityId: id,
        proposedData: { action: 'DELETE', data: {}, label: `Delete basket: ${existing.name}` },
        status: 'PENDING',
        requestedById: adminId,
     },
   });
 }

  /**
   * Calculate the current price of a basket based on constituent weights
   * @param basket - Basket with constituents and stock prices
   * @returns Calculated basket price
   */
  private calculateBasketPrice(basket: any): number {
    if (!basket.constituents || basket.constituents.length === 0) {
      return 0;
   }

    // Calculate weighted sum of stock prices
    const totalPrice = basket.constituents.reduce((sum, constituent) => {
      const stockPrice = constituent.stock?.price || 0;
      const weight = constituent.weight / 100; // Convert percentage to decimal
      return sum + stockPrice * weight;
   }, 0);

    return Math.round(totalPrice * 100) / 100; // Round to 2 decimal places
 }

  /**
   * Resolve the effective status of a basket based on dates and status field
   * Honors manual status overrides and guards against missing/invalid dates
   * @param basket - Basket with status and dates
   * @returns Resolved status (DRAFT, OPEN, CLOSED, COMING_SOON)
   */
  private resolveBasketStatus(basket: any): string {
    // If status is explicitly set, honor it as a manual override
    if (
      basket.status === 'DRAFT' ||
      basket.status === 'OPEN' ||
      basket.status === 'CLOSED' ||
      basket.status === 'COMING_SOON'
    ) {
      return basket.status;
   }

    // Guard against missing or invalid dates - fall back to status field
    if (!basket.subscriptionStartDate || !basket.subscriptionEndDate) {
      return basket.status || 'DRAFT';
   }

    // Attempt date-based resolution
    try {
      const now = new Date();
      const startDate = new Date(basket.subscriptionStartDate);
      const endDate = new Date(basket.subscriptionEndDate);

      // Validate dates are valid
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return basket.status || 'DRAFT';
     }

      // If subscription hasn't started yet
      if (now < startDate) {
        return 'COMING_SOON';
     }

      // If subscription has ended
      if (now > endDate) {
        return 'CLOSED';
     }

      // If subscription is currently active
      return 'OPEN';
   } catch (error) {
      // If any error occurs during date parsing, fall back to status field
      this.logger.warn(`Error resolving basket status: ${error.message}`);
      return basket.status || 'DRAFT';
   }
 }

  /**
   * Invalidate Redis cache for baskets
   * @param basketId - Optional specific basket ID to invalidate
   */
  private async invalidateCache(basketId?: string) {
    try {
      // Invalidate active baskets list
      await this.redisService.delete(`${this.CACHE_PREFIX}active`);

      // Invalidate specific basket if ID provided
      if (basketId) {
        await this.redisService.delete(`${this.CACHE_PREFIX}${basketId}`);
     }

      this.logger.log('Cache invalidated successfully');
   } catch (error) {
      this.logger.error('Failed to invalidate cache', error);
   }
 }

  /**
   * Get version history for a basket
   * @param basketId - Basket ID
   * @returns Array of version history entries
   */
  async getBasketVersionHistory(basketId: string) {
    this.logger.log(`Fetching version history for basket: ${basketId}`);

    return this.prisma.contentVersion.findMany({
      where: {
        entityType: 'BASKET',
        entityId: basketId,
     },
      orderBy: {
        versionNumber: 'desc',
     },
   });
 }
}
