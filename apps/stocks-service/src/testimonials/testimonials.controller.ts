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
import { TestimonialsService } from './testimonials.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';
import { CmsJwtAuthGuard } from '../auth/guards/cms-jwt-auth.guard';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../auth/guards/permissions.guard';
import { Public } from '../auth/decorators/public.decorator';

/**
 * TestimonialsController exposes REST endpoints for testimonial management.
 *
 * Route groups:
 *   - Public   GET  /testimonials           -- active testimonials for the landing page
 *   - CMS      *    /testimonials/cms/*      -- CRUD behind CmsJwtAuthGuard + cms_testimonials permission
 *   - Admin    *    /testimonials/admin/*     -- CRUD behind AdminJwtAuthGuard + PermissionsGuard
 *
 * The CMS and Admin endpoints mirror each other intentionally so that
 * both panels can manage testimonials independently with their own auth guards.
 */
@Controller('testimonials')
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  // ---------------------------------------------------------------------------
  // PUBLIC ENDPOINTS
  // ---------------------------------------------------------------------------

  /**
   * GET /api/testimonials
   * Returns all active testimonials for the public-facing landing page.
   * No authentication required.
   */
  @Get()
  @Public()
  async getAllActiveTestimonials() {
    return this.testimonialsService.getAllActiveTestimonials();
  }

  // ---------------------------------------------------------------------------
  // CMS ENDPOINTS (guarded by CmsJwtAuthGuard + cms_testimonials permission)
  // ---------------------------------------------------------------------------

  /**
   * GET /api/testimonials/cms/all
   * Returns all testimonials (active + inactive) for CMS panel management.
   */
  @Get('cms/all')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_testimonials')
  async getAllTestimonialsCms() {
    return this.testimonialsService.getAllTestimonialsAdmin();
  }

  /**
   * POST /api/testimonials/cms
   * Create a new testimonial from the CMS panel.
   */
  @Post('cms')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_testimonials')
  async createTestimonialCms(@Body() dto: CreateTestimonialDto) {
    return this.testimonialsService.createTestimonial(dto);
  }

  /**
   * PUT /api/testimonials/cms/:id
   * Update an existing testimonial from the CMS panel.
   */
  @Put('cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_testimonials')
  async updateTestimonialCms(
    @Param('id') id: string,
    @Body() dto: UpdateTestimonialDto,
  ) {
    return this.testimonialsService.updateTestimonial(id, dto);
  }

  /**
   * DELETE /api/testimonials/cms/:id
   * Delete a testimonial from the CMS panel.
   */
  @Delete('cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_testimonials')
  async deleteTestimonialCms(@Param('id') id: string) {
    return this.testimonialsService.deleteTestimonial(id);
  }

  /**
   * GET /api/testimonials/cms/:id/versions
   * Retrieve version history for a specific testimonial (CMS panel).
   * Read-only -- no mutation permission check needed beyond auth.
   */
  @Get('cms/:id/versions')
  @UseGuards(CmsJwtAuthGuard)
  async getTestimonialVersionHistoryCms(@Param('id') id: string) {
    return this.testimonialsService.getTestimonialVersionHistory(id);
  }

  // ---------------------------------------------------------------------------
  // ADMIN ENDPOINTS (guarded by AdminJwtAuthGuard + PermissionsGuard)
  // ---------------------------------------------------------------------------

  /**
   * GET /api/testimonials/admin/all
   * Returns all testimonials (active + inactive) for Admin panel management.
   */
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_testimonials')
  @Get('admin/all')
  async getAllTestimonialsAdmin() {
    return this.testimonialsService.getAllTestimonialsAdmin();
  }

  /**
   * POST /api/testimonials/admin
   * Create a new testimonial from the Admin panel.
   */
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @Post('admin')
  async createTestimonial(@Body() dto: CreateTestimonialDto) {
    return this.testimonialsService.createTestimonial(dto);
  }

  /**
   * PUT /api/testimonials/admin/:id
   * Update an existing testimonial from the Admin panel.
   */
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @Put('admin/:id')
  async updateTestimonial(
    @Param('id') id: string,
    @Body() dto: UpdateTestimonialDto,
  ) {
    return this.testimonialsService.updateTestimonial(id, dto);
  }

  /**
   * DELETE /api/testimonials/admin/:id
   * Delete a testimonial from the Admin panel.
   */
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @Delete('admin/:id')
  async deleteTestimonial(@Param('id') id: string) {
    return this.testimonialsService.deleteTestimonial(id);
  }

  /**
   * GET /api/testimonials/admin/:id/versions
   * Retrieve version history for a specific testimonial (Admin panel).
   */
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @Get('admin/:id/versions')
  async getTestimonialVersionHistory(@Param('id') id: string) {
    return this.testimonialsService.getTestimonialVersionHistory(id);
  }

  /**
   * POST /api/testimonials/admin/:id/rollback/:versionNumber
   * Rollback a testimonial to a specific version snapshot (Admin only).
   */
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @Post('admin/:id/rollback/:versionNumber')
  async rollbackTestimonial(
    @Param('id') id: string,
    @Param('versionNumber') versionNumber: string,
  ) {
    return this.testimonialsService.rollbackTestimonial(
      id,
      parseInt(versionNumber),
    );
  }
}
