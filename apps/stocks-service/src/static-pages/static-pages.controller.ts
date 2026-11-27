import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PinoNestLogger } from '@repo/logger';
import { Request as ExpressRequest } from 'express';
import { StaticPagesService } from './static-pages.service';
import { CreateStaticPageDto } from './dto/create-static-page.dto';
import { UpdateStaticPageDto } from './dto/update-static-page.dto';
import { CmsJwtAuthGuard } from '../auth/guards/cms-jwt-auth.guard';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../auth/guards/permissions.guard';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Admin request interface extending Express Request
 * Includes authenticated admin user information
 */
interface AdminRequest extends ExpressRequest {
  user: {
    adminId: string;
    email: string;
    role: string;
    permissions: string[];
    type: 'ADMIN';
 };
}

/**
 * CMS admin request interface extending Express Request
 * Includes authenticated CMS user information (Super Admin/Content Manager)
 */
interface CmsAdminRequest extends ExpressRequest {
  user: {
    adminId: string;
    email: string;
    role: string;
    permissions: string[];
 };
}

/**
 * Controller for managing static pages (About Us, Contact, Terms & Conditions, etc.)
 * Provides public access to active pages and admin CRUD operations
 */
@Controller('static-pages')
export class StaticPagesController {
  private readonly logger = new PinoNestLogger('stocks-service', 'StaticPagesController');
  constructor(private readonly staticPagesService: StaticPagesService) {}

  /**
   * Get all active static pages (Public endpoint)
   * @returns Array of active static pages
   */
  @Get()
  @Public()
  async getAllActiveStaticPages() {
    return this.staticPagesService.getAllActiveStaticPages();
 }

  /**
   * Get a static page by slug (Public endpoint)
   * @param slug The page slug
   * @returns The static page content
   */
  @Get('slug/:slug')
  @Public()
  async getStaticPageBySlug(@Param('slug') slug: string) {
    return this.staticPagesService.getStaticPageBySlug(slug);
 }

  /**
   * Get all static pages including inactive (Admin endpoint)
   * Requires 'cms_static_pages' permission
   * @returns Array of all static pages
   */
  @Get('admin/all')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_static_pages')
  async getAllStaticPagesAdmin() {
    this.logger.log('Fetching all static pages for admin: STEP 1 Reached');
    return this.staticPagesService.getAllStaticPagesAdmin();
 }

  /**
   * Get all static pages including inactive (CMS panel access with cms_panel_token)
   * Requires 'cms_static_pages' permission
   * @returns Array of all static pages
   */
  @Get('cms/all')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_static_pages')
  async getAllStaticPagesCms() {
    return this.staticPagesService.getAllStaticPagesAdmin();
 }

  /**
   * POST /api/static-pages/cms
   * Create static page (CMS panel access with cms_panel_token). Requires 'cms_static_pages' permission.
   * @param dto The page data
   * @param req The request object containing admin context
   * @returns The created page
   */
  @Post('cms')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_static_pages')
  async createStaticPageCms(
    @Body() dto: CreateStaticPageDto,
    @Request() req: CmsAdminRequest,
  ) {
    const changeRequest = await this.staticPagesService.proposeCreate(dto, req.user.adminId);
    return { message: 'Static page creation submitted for admin approval', changeRequest };
 }

  /**
   * PUT /api/static-pages/cms/:id
   * Update static page (CMS panel access with cms_panel_token). Requires 'cms_static_pages' permission.
   * @param id The page ID
   * @param dto The update data
   * @param req The request object containing admin context
   * @returns The updated page
   */
  @Put('cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_static_pages')
  async updateStaticPageCms(
    @Param('id') id: string,
    @Body() dto: UpdateStaticPageDto,
    @Request() req: CmsAdminRequest,
  ) {
    const changeRequest = await this.staticPagesService.proposeUpdate(id, dto, req.user.adminId);
    return { message: 'Static page update submitted for admin approval', changeRequest };
 }

  /**
   * DELETE /api/static-pages/cms/:id
   * Delete static page (CMS panel access with cms_panel_token). Requires 'cms_static_pages' permission.
   * @param id The page ID
   * @returns Success message
   */
  @Delete('cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_static_pages')
  async deleteStaticPageCms(@Param('id') id: string, @Request() req: CmsAdminRequest) {
    const changeRequest = await this.staticPagesService.proposeDelete(id, req.user.adminId);
    return { message: 'Static page deletion submitted for admin approval', changeRequest };
 }

  /**
   * GET /api/static-pages/cms/:id/versions
   * Get version history for static page (CMS panel access with cms_panel_token)
   * No permissions guard needed for read-only version history
   */
  @Get('cms/:id/versions')
  @UseGuards(CmsJwtAuthGuard)
  async getStaticPageVersionsCms(@Param('id') id: string) {
    return this.staticPagesService.getStaticPageVersions(id);
 }

  /**
   * GET /api/static-pages/cms/slug/:slug
   * Get a static page by slug for CMS editing (allows inactive pages)
   * @param slug The page slug
   * @returns The static page
   */
  @Get('cms/slug/:slug')
  @UseGuards(CmsJwtAuthGuard)
  async getStaticPageBySlugCms(@Param('slug') slug: string) {
    return this.staticPagesService.getStaticPageBySlugCms(slug);
 }

  /**
   * GET /api/static-pages/admin/slug/:slug
   * Get a static page by slug for Admin editing (allows inactive pages)
   * @param slug The page slug
   * @returns The static page
   */
  @Get('admin/slug/:slug')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_static_pages')
  async getStaticPageBySlugAdmin(@Param('slug') slug: string) {
    return this.staticPagesService.getStaticPageBySlugAdmin(slug);
 }

  /**
   * Create a new static page (Admin endpoint)
   * Requires 'cms_static_pages' permission
   * @param dto The page data
   * @param req The request object containing admin context
   * @returns The created page
   */
  @Post('admin')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_static_pages')
  async createStaticPage(
    @Body() dto: CreateStaticPageDto,
    @Request() req: AdminRequest,
  ) {
    return this.staticPagesService.createStaticPage(dto, req.user.adminId);
 }

  /**
   * Update an existing static page (Admin endpoint)
   * Requires 'cms_static_pages' permission
   * @param id The page ID
   * @param dto The update data
   * @param req The request object containing admin context
   * @returns The updated page
   */
  @Put('admin/:id')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_static_pages')
  async updateStaticPage(
    @Param('id') id: string,
    @Body() dto: UpdateStaticPageDto,
    @Request() req: AdminRequest,
  ) {
    return this.staticPagesService.updateStaticPage(id, dto, req.user.adminId);
 }

  /**
   * Get version history for a static page (Admin endpoint)
   * Requires 'cms_static_pages' permission
   * @param id The page ID
   * @returns Array of page versions
   */
  @Get('admin/:id/versions')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_static_pages')
  async getStaticPageVersions(@Param('id') id: string) {
    return this.staticPagesService.getStaticPageVersions(id);
 }

  /**
   * Rollback a static page to a specific version (Admin endpoint)
   * Requires 'cms_static_pages' permission
   * @param id The page ID
   * @param versionNumber The version number to rollback to
   * @param req The request object containing admin context
   * @returns The updated page
   */
  @Post('admin/:id/rollback/:versionNumber')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_static_pages')
  async rollbackStaticPage(
    @Param('id') id: string,
    @Param('versionNumber') versionNumber: string,
    @Request() req: AdminRequest,
  ) {
    return this.staticPagesService.rollbackStaticPage(
      id,
      parseInt(versionNumber),
      req.user.adminId,
    );
 }
}
