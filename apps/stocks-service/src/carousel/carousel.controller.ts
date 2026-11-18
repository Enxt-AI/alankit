import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CarouselService } from './carousel.service';
import { CreateCarouselMediaDto } from './dto/create-carousel-media.dto';
import { UpdateCarouselMediaDto } from './dto/update-carousel-media.dto';
import { CmsJwtAuthGuard } from '../auth/guards/cms-jwt-auth.guard';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../auth/guards/permissions.guard';
import { Public } from '../auth/decorators/public.decorator';

/**
 * CarouselController exposes REST endpoints for carousel media management.
 *
 * Route groups:
 *   - Public   GET  /carousel                 -- active media for the Android app
 *   - CMS      *    /carousel/cms/*            -- CRUD behind CmsJwtAuthGuard + cms_carousel permission
 *   - Admin    *    /carousel/admin/*           -- CRUD behind AdminJwtAuthGuard + PermissionsGuard
 *
 * Base route: /api/carousel
 */
@Controller('carousel')
export class CarouselController {
  constructor(private readonly carouselService: CarouselService) {}

  // ---------------------------------------------------------------------------
  // PUBLIC ENDPOINTS (Android app consumes these)
  // ---------------------------------------------------------------------------

  /**
   * GET /api/carousel
   * Returns all active carousel media items ordered by displayOrder.
   * No authentication required — public endpoint for the Android app.
   */
  @Get()
  @Public()
  async getActiveCarouselMedia() {
    return this.carouselService.getActiveCarouselMedia();
  }

  // ---------------------------------------------------------------------------
  // CMS ENDPOINTS (guarded by CmsJwtAuthGuard + cms_carousel permission)
  // ---------------------------------------------------------------------------

  /**
   * GET /api/carousel/cms/all
   * Returns all carousel media (active + inactive) for CMS management.
   */
  @Get('cms/all')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_carousel')
  async getAllCarouselMediaCms() {
    return this.carouselService.getAllCarouselMedia();
  }

  /**
   * GET /api/carousel/cms/:id
   * Get a single carousel media item by ID.
   */
  @Get('cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_carousel')
  async getCarouselMediaByIdCms(@Param('id') id: string) {
    return this.carouselService.getCarouselMediaById(id);
  }

  /**
   * POST /api/carousel/cms
   * Create a new carousel media item.
   */
  @Post('cms')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_carousel')
  async createCarouselMediaCms(@Body() dto: CreateCarouselMediaDto) {
    return this.carouselService.createCarouselMedia(dto);
  }

  /**
   * PUT /api/carousel/cms/:id
   * Update an existing carousel media item.
   */
  @Put('cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_carousel')
  async updateCarouselMediaCms(
    @Param('id') id: string,
    @Body() dto: UpdateCarouselMediaDto,
  ) {
    return this.carouselService.updateCarouselMedia(id, dto);
  }

  /**
   * DELETE /api/carousel/cms/:id
   * Delete a carousel media item.
   */
  @Delete('cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_carousel')
  async deleteCarouselMediaCms(@Param('id') id: string) {
    return this.carouselService.deleteCarouselMedia(id);
  }

  /**
   * PUT /api/carousel/cms/reorder
   * Reorder carousel media items.
   */
  @Put('cms/reorder')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_carousel')
  async reorderCarouselMediaCms(
    @Body() body: { items: { id: string; displayOrder: number }[] },
  ) {
    return this.carouselService.reorderCarouselMedia(body.items);
  }

  // ---------------------------------------------------------------------------
  // ADMIN ENDPOINTS (guarded by AdminJwtAuthGuard + PermissionsGuard)
  // ---------------------------------------------------------------------------

  /**
   * GET /api/carousel/admin/all
   * Returns all carousel media (active + inactive) for admin management.
   */
  @Get('admin/all')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async getAllCarouselMediaAdmin() {
    return this.carouselService.getAllCarouselMedia();
  }

  /**
   * POST /api/carousel/admin
   * Create a new carousel media item (admin).
   */
  @Post('admin')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async createCarouselMediaAdmin(@Body() dto: CreateCarouselMediaDto) {
    return this.carouselService.createCarouselMedia(dto);
  }

  /**
   * PUT /api/carousel/admin/:id
   * Update an existing carousel media item (admin).
   */
  @Put('admin/:id')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async updateCarouselMediaAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateCarouselMediaDto,
  ) {
    return this.carouselService.updateCarouselMedia(id, dto);
  }

  /**
   * DELETE /api/carousel/admin/:id
   * Delete a carousel media item (admin).
   */
  @Delete('admin/:id')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async deleteCarouselMediaAdmin(@Param('id') id: string) {
    return this.carouselService.deleteCarouselMedia(id);
  }

  /**
   * PUT /api/carousel/admin/reorder
   * Reorder carousel media items (admin).
   */
  @Put('admin/reorder')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  async reorderCarouselMediaAdmin(
    @Body() body: { items: { id: string; displayOrder: number }[] },
  ) {
    return this.carouselService.reorderCarouselMedia(body.items);
  }
}
