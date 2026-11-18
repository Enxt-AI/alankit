import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class CategoriesService {
  private readonly CACHE_KEY_ACTIVE_CATEGORIES = 'stocks:categories:active';
  private readonly CACHE_TTL = 1800; // 30 minutes

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Get all active categories with stock counts (Public cached API)
   */
  async getActiveCategories() {
    const cached = await this.redis.get(this.CACHE_KEY_ACTIVE_CATEGORIES);
    if (cached) {
      return typeof cached === 'string' ? JSON.parse(cached) : cached;
    }

    const categories = await this.prisma.stockCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        _count: {
          select: {
            stocks: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    const result = categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      stockCount: c._count.stocks,
    }));

    await this.redis.set(this.CACHE_KEY_ACTIVE_CATEGORIES, result, this.CACHE_TTL);
    return result;
  }

  /**
   * Get a single category by ID with its active stocks
   */
  async getCategoryById(id: string) {
    const category = await this.prisma.stockCategory.findUnique({
      where: { id },
      include: {
        stocks: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            price: true,
            logoUrl: true,
            cin: true,
            isin: true,
            slug: true,
            isPopular: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Stock category with ID '${id}' not found`);
    }

    return {
      id: category.id,
      name: category.name,
      description: category.description,
      isActive: category.isActive,
      stockCount: category.stocks.length,
      stocks: category.stocks,
    };
  }

  /**
   * Invalidate Redis cache for active categories
   */
  async invalidateCache() {
    await this.redis.delete(this.CACHE_KEY_ACTIVE_CATEGORIES);
  }

  async findAll() {
    return this.prisma.stockCategory.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.stockCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(`StockCategory with ID ${id} not found`);
    }
    return category;
  }

  async create(data: { name: string; description?: string; isActive?: boolean }) {
    const existing = await this.prisma.stockCategory.findUnique({
      where: { name: data.name },
    });
    if (existing) {
      throw new ConflictException(`Category with name '${data.name}' already exists`);
    }

    const created = await this.prisma.stockCategory.create({
      data,
    });
    await this.invalidateCache();
    return created;
  }

  async update(id: string, data: { name?: string; description?: string; isActive?: boolean }) {
    await this.findOne(id); // Check if exists

    if (data.name) {
      const existing = await this.prisma.stockCategory.findUnique({
        where: { name: data.name },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Category with name '${data.name}' already exists`);
      }
    }

    const updated = await this.prisma.stockCategory.update({
      where: { id },
      data,
    });
    await this.invalidateCache();
    return updated;
  }

  // ---- Maker-checker proposals (CMS; nothing goes live) ----
  async proposeCreate(data: { name: string; description?: string; isActive?: boolean }, adminId: string) {
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'STOCK_CATEGORY',
        entityId: null,
        proposedData: { action: 'CREATE', data, label: `Create category: ${data.name}` },
        status: 'PENDING',
        requestedById: adminId,
      },
    });
  }

  async proposeUpdate(id: string, data: { name?: string; description?: string; isActive?: boolean }, adminId: string) {
    await this.findOne(id);
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'STOCK_CATEGORY',
        entityId: id,
        proposedData: { action: 'UPDATE', data, label: `Edit category: ${data.name ?? id}` },
        status: 'PENDING',
        requestedById: adminId,
      },
    });
  }

  async proposeRemove(id: string, adminId: string) {
    const existing = await this.findOne(id);
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'STOCK_CATEGORY',
        entityId: id,
        proposedData: { action: 'DELETE', data: {}, label: `Delete category: ${existing.name}` },
        status: 'PENDING',
        requestedById: adminId,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Check if category is used by any stock
    const inUse = await this.prisma.stock.findFirst({
      where: { categoryId: id },
    });
    
    if (inUse) {
      throw new ConflictException(`Cannot delete category because it is being used by stocks.`);
    }

    const deleted = await this.prisma.stockCategory.delete({
      where: { id },
    });
    await this.invalidateCache();
    return deleted;
  }
}
