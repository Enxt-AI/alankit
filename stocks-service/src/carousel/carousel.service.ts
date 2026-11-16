import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCarouselMediaDto } from './dto/create-carousel-media.dto';
import { UpdateCarouselMediaDto } from './dto/update-carousel-media.dto';
import { PinoNestLogger } from '@smc/logger';

/**
 * CarouselService handles all CRUD operations for carousel media items.
 * Used by the CMS panel to manage banners/slides for the Android app.
 */
@Injectable()
export class CarouselService {
  private readonly logger = new PinoNestLogger('stocks-service', 'CarouselService');

  constructor(private readonly prisma: PrismaService) {}

  private formatMediaUrl(url: string | null | undefined): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const base = process.env.PUBLIC_API_URL || process.env.API_GATEWAY_URL || 'https://api.unlistedstox.com';
    const cleanBase = base.replace(/\/+$/, '');
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${cleanBase}${cleanPath}`;
  }

  private formatItem<T extends { mediaUrl: string; thumbnailUrl?: string | null }>(item: T): T {
    return {
      ...item,
      mediaUrl: this.formatMediaUrl(item.mediaUrl),
      thumbnailUrl: item.thumbnailUrl ? this.formatMediaUrl(item.thumbnailUrl) : null,
    };
  }

  // ---------------------------------------------------------------------------
  // PUBLIC: Fetch active carousel items (for Android app)
  // ---------------------------------------------------------------------------

  /**
   * Get all active carousel media items, ordered by displayOrder ASC.
   * This is the public endpoint consumed by the Android app.
   */
  async getActiveCarouselMedia() {
    const items = await this.prisma.carouselMedia.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
    return items.map((i) => this.formatItem(i));
  }

  // ---------------------------------------------------------------------------
  // CMS / ADMIN: Full CRUD
  // ---------------------------------------------------------------------------

  /**
   * Get all carousel media items (active + inactive) for CMS management.
   */
  async getAllCarouselMedia() {
    const items = await this.prisma.carouselMedia.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    return items.map((i) => this.formatItem(i));
  }

  /**
   * Get a single carousel media item by ID.
   */
  async getCarouselMediaById(id: string) {
    const item = await this.prisma.carouselMedia.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Carousel media item not found: ${id}`);
    }
    return this.formatItem(item);
  }

  /**
   * Create a new carousel media item.
   */
  async createCarouselMedia(dto: CreateCarouselMediaDto) {
    // If no displayOrder given, put it at the end
    if (dto.displayOrder === undefined || dto.displayOrder === null) {
      const maxOrder = await this.prisma.carouselMedia.aggregate({
        _max: { displayOrder: true },
      });
      dto.displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;
    }

    const title = dto.title?.trim() || 'Banner';
    const mediaType = dto.mediaType || 'IMAGE';

    const item = await this.prisma.carouselMedia.create({
      data: {
        ...dto,
        title,
        mediaType,
      },
    });
    this.logger.log(`Created carousel media: ${item.id} (${item.title})`);
    return this.formatItem(item);
  }

  /**
   * Update an existing carousel media item.
   */
  async updateCarouselMedia(id: string, dto: UpdateCarouselMediaDto) {
    // Ensure item exists
    await this.getCarouselMediaById(id);

    const item = await this.prisma.carouselMedia.update({
      where: { id },
      data: dto,
    });
    this.logger.log(`Updated carousel media: ${item.id} (${item.title})`);
    return this.formatItem(item);
  }

  /**
   * Delete a carousel media item (hard delete).
   * Also cleans up the physical file from the MinIO carousel bucket.
   */
  async deleteCarouselMedia(id: string) {
    const item = await this.prisma.carouselMedia.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Carousel media item not found: ${id}`);
    }

    // Try deleting physical file from MinIO storage-service
    if (item.mediaUrl) {
      try {
        const parts = item.mediaUrl.split('/');
        const fileName = parts[parts.length - 1];
        const storageHost = process.env.STORAGE_SERVICE_URL || 'http://storage-service:3005';
        await fetch(`${storageHost}/api/upload/carousel/${fileName}`, {
          method: 'DELETE',
        });
      } catch (err) {
        this.logger.warn(`Could not delete file from MinIO storage bucket: ${err}`);
      }
    }

    await this.prisma.carouselMedia.delete({ where: { id } });
    this.logger.log(`Deleted carousel media: ${id}`);
    return { success: true, message: 'Carousel media deleted' };
  }

  /**
   * Reorder carousel media items.
   * Accepts an array of { id, displayOrder } pairs.
   */
  async reorderCarouselMedia(items: { id: string; displayOrder: number }[]) {
    const updates = items.map((item) =>
      this.prisma.carouselMedia.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      }),
    );

    await this.prisma.$transaction(updates);
    this.logger.log(`Reordered ${items.length} carousel media items`);
    return { success: true, message: `Reordered ${items.length} items` };
  }
}
