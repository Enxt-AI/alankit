import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,

} from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { BasketsService } from './baskets.service';
import { AuditService } from '../audit/audit.service';
import { CreateBasketDto } from './dto/create-basket.dto';
import { UpdateBasketDto } from './dto/update-basket.dto';
import { CmsJwtAuthGuard } from '../auth/guards/cms-jwt-auth.guard';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../auth/guards/permissions.guard';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Controller for managing stock baskets
 * Provides both public and CMS endpoints
 * Route: /api/baskets
 */
@Controller('baskets')
export class BasketsController {
  private readonly logger = new PinoNestLogger('stocks-service', '');

  constructor(
    private readonly basketsService: BasketsService,
    private readonly auditService: AuditService,
  ) {}

  // ============================================
  // CMS ENDPOINTS (Require authentication + cms_baskets permission)
  // ============================================

  /**
   * Get all baskets (CMS endpoint)
   * Returns all baskets with full details including audit trail
   * Route: GET /api/baskets/cms/all
   * @returns Array of all baskets
   */
  @Get('cms/all')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_baskets')
  async getAllBasketsAdmin() {
    this.logger.log('CMS: Get all baskets');
    return this.basketsService.getAllBasketsAdmin();
 }

  /**
   * Create a new basket (CMS endpoint)
   * Requires cms_baskets permission
   * Route: POST /api/baskets/cms
   * @param createBasketDto - Basket creation data
   * @param req - Request object with admin user
   * @returns Created basket
   */
  @Post('cms')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_baskets')
  async createBasket(
    @Body() createBasketDto: CreateBasketDto,
    @Req() req: any,
  ) {
    this.logger.log('CMS: Propose create basket (held for approval)');
    const adminId = req.user.adminId;
    const changeRequest = await this.basketsService.proposeCreate(createBasketDto, adminId);
    return { message: 'Basket creation submitted for admin approval', changeRequest };
 }

  /**
   * Update an existing basket (CMS endpoint)
   * Requires cms_baskets permission
   * Route: PUT /api/baskets/cms/:id
   * @param id - Basket ID
   * @param updateBasketDto - Update data
   * @param req - Request object with admin user
   * @returns Updated basket
   */
  @Put('cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_baskets')
  async updateBasket(
    @Param('id') id: string,
    @Body() updateBasketDto: UpdateBasketDto,
    @Req() req: any,
  ) {
    this.logger.log(`CMS: Propose update basket: ${id} (held for approval)`);
    const adminId = req.user.adminId;
    const changeRequest = await this.basketsService.proposeUpdate(id, updateBasketDto, adminId);
    return { message: 'Basket update submitted for admin approval', changeRequest };
 }

  /**
   * Delete a basket (CMS endpoint)
   * Soft delete by marking as inactive
   * Requires cms_baskets permission
   * Route: DELETE /api/baskets/cms/:id
   * @param id - Basket ID
   * @param req - Request object with admin user
   * @returns Deleted basket
   */
  @Delete('cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_baskets')
  async deleteBasket(@Param('id') id: string, @Req() req: any) {
    this.logger.log(`CMS: Propose delete basket: ${id} (stays live until approved)`);
    const adminId = req.user.adminId;
    const changeRequest = await this.basketsService.proposeDelete(id, adminId);
    return { message: 'Basket deletion submitted for admin approval', changeRequest };
 }

  /**
   * Get version history for a basket (CMS endpoint)
   * Returns all versions with admin details
   * Route: GET /api/baskets/cms/:id/versions
   * @param id - Basket ID
   * @returns Array of version history entries
   */
  @Get('cms/:id/versions')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_baskets')
  async getBasketVersionHistory(@Param('id') id: string) {
    this.logger.log(`CMS: Get version history for basket: ${id}`);
    return this.basketsService.getBasketVersionHistory(id);
 }

  /**
   * Get audit logs for a basket (CMS endpoint)
   * Returns all audit log entries for the specified basket
   * Route: GET /api/baskets/cms/:id/audit-logs
   * @param id - Basket ID
   * @returns Array of audit log entries
   */
  @Get('cms/:id/audit-logs')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_baskets')
  async getBasketAuditLogs(@Param('id') id: string) {
    this.logger.log(`CMS: Get audit logs for basket: ${id}`);
    return this.auditService.getAuditLogsByEntity('BASKET', id);
 }

  // ============================================
  // ADMIN ENDPOINTS (Require authentication + ADMIN_BASKETS permission)
  // ============================================

  /**
   * Get all baskets (Admin endpoint)
   * Returns all baskets with full details including audit trail
   * Route: GET /api/baskets/admin/all
   * @returns Array of all baskets
   */
  @Get('admin/all')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('ADMIN_BASKETS')
  async getAllBasketsAdminPanel() {
    this.logger.log('Admin: Get all baskets');
    return this.basketsService.getAllBasketsAdmin();
 }

  /**
   * Create a new basket (Admin endpoint)
   * Requires ADMIN_BASKETS permission
   * Route: POST /api/baskets/admin
   * @param createBasketDto - Basket creation data
   * @param req - Request object with admin user
   * @returns Created basket
   */
  @Post('admin')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('ADMIN_BASKETS')
  async createBasketAdmin(
    @Body() createBasketDto: CreateBasketDto,
    @Req() req: any,
  ) {
    this.logger.log('Admin: Create basket');
    const adminId = req.user.adminId;
    return this.basketsService.createBasket(createBasketDto, adminId);
 }

  /**
   * Update an existing basket (Admin endpoint)
   * Requires ADMIN_BASKETS permission
   * Route: PUT /api/baskets/admin/:id
   * @param id - Basket ID
   * @param updateBasketDto - Update data
   * @param req - Request object with admin user
   * @returns Updated basket
   */
  @Put('admin/:id')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('ADMIN_BASKETS')
  async updateBasketAdmin(
    @Param('id') id: string,
    @Body() updateBasketDto: UpdateBasketDto,
    @Req() req: any,
  ) {
    this.logger.log(`Admin: Update basket: ${id}`);
    const adminId = req.user.adminId;
    return this.basketsService.updateBasket(id, updateBasketDto, adminId);
 }

  /**
   * Delete a basket (Admin endpoint)
   * Soft delete by marking as inactive
   * Requires ADMIN_BASKETS permission
   * Route: DELETE /api/baskets/admin/:id
   * @param id - Basket ID
   * @param req - Request object with admin user
   * @returns Deleted basket
   */
  @Delete('admin/:id')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('ADMIN_BASKETS')
  async deleteBasketAdmin(@Param('id') id: string, @Req() req: any) {
    this.logger.log(`Admin: Delete basket: ${id}`);
    const adminId = req.user.adminId;
    return this.basketsService.deleteBasket(id, adminId);
 }

  /**
   * Get version history for a basket (Admin endpoint)
   * Returns all versions with admin details
   * Route: GET /api/baskets/admin/:id/versions
   * @param id - Basket ID
   * @returns Array of version history entries
   */
  @Get('admin/:id/versions')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('ADMIN_BASKETS')
  async getBasketVersionHistoryAdmin(@Param('id') id: string) {
    this.logger.log(`Admin: Get version history for basket: ${id}`);
    return this.basketsService.getBasketVersionHistory(id);
 }

  /**
   * Get audit logs for a basket (Admin endpoint)
   * Returns all audit log entries for the specified basket
   * Route: GET /api/baskets/admin/:id/audit-logs
   * @param id - Basket ID
   * @returns Array of audit log entries
   */
  @Get('admin/:id/audit-logs')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('ADMIN_BASKETS')
  async getBasketAuditLogsAdmin(@Param('id') id: string) {
    this.logger.log(`Admin: Get audit logs for basket: ${id}`);
    return this.auditService.getAuditLogsByEntity('BASKET', id);
 }

  // ============================================
  // PUBLIC ENDPOINTS (No authentication required)
  // ============================================

  /**
   * Get all active baskets (public endpoint)
   * Returns baskets with calculated prices and resolved statuses
   * Cached with 5-minute TTL
   * Route: GET /api/baskets
   * @returns Array of active baskets
   */
  @Get()
  @Public()
  async getAllActiveBaskets() {
    this.logger.log('Get all active baskets');
    return this.basketsService.getAllActiveBasketsPublic();
 }

  /**
   * Get basket by ID (public endpoint)
   * Returns basket with calculated price and resolved status
   * Cached with 5-minute TTL
   * Route: GET /api/baskets/:id
   * @param id - Basket ID
   * @returns Single basket
   */
  @Get(':id')
  @Public()
  async getBasketById(@Param('id') id: string) {
    this.logger.log(`Get basket by ID: ${id}`);
    return this.basketsService.getBasketById(id);
 }
}
