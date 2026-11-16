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
  Res,
  Query,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import type { FastifyReply } from 'fastify';
import { StocksService } from './stocks.service';
import { CategoriesService } from './categories/categories.service';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateStockPriceDto } from './dto/create-stock-price.dto';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CmsJwtAuthGuard } from '../auth/guards/cms-jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../auth/guards/permissions.guard';
import { AdminContextService } from '../common/admin-context.service';
import { Public } from '../auth/decorators/public.decorator';
import { AccountingJwtAuthGuard } from '../auth/guards/accounting-jwt-auth.guard';
import { UserJwtAuthGuard } from '../auth/guards/user-jwt-auth.guard';
import { AdminOrOperationJwtAuthGuard } from '../auth/guards/admin-or-operation-jwt-auth.guard';
import { OperationJwtAuthGuard } from '../auth/guards/operation-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
/**
 * Stocks Controller
 * Handles HTTP endpoints for stock management
 * Base route: /api/stocks
 *
 * IMPORTANT: Route order matters in NestJS!
 * Specific routes (admin/all, cms/all, cin/:cin, categories) must come BEFORE
 * parameterized routes (:id) to avoid the param matching everything.
 */
@Controller('stocks')
export class StocksController {
  constructor(
    private stocksService: StocksService,
    private adminContextService: AdminContextService,
    private categoriesService: CategoriesService,
  ) {}

  // PUBLIC ENDPOINTS (No authentication required)
  /**
   * GET /api/stocks
   * Get all active stocks (public endpoint with Redis caching)
   * Supports optional category filtering: ?categoryId=... or ?category=...
   */
  @Get()
  @Public()
  async getAllActiveStocks(
    @Query('categoryId') categoryId?: string,
    @Query('category') categoryName?: string,
  ) {
    return await this.stocksService.getAllActiveStocks({ categoryId, categoryName });
  }

  /**
   * GET /api/stocks/categories
   * Get all active stock categories with stock counts (public endpoint with Redis caching)
   * MUST be before :id route
   */
  @Get('categories')
  @Public()
  async getCategories() {
    return await this.categoriesService.getActiveCategories();
  }

  /**
   * GET /api/stocks/categories/:id
   * Get single stock category by ID with its active stocks (public endpoint)
   * MUST be before :id route
   */
  @Get('categories/:id')
  @Public()
  async getCategoryById(@Param('id') id: string) {
    return await this.categoriesService.getCategoryById(id);
  }

  /**
   * GET /api/stocks/cin/:cin
   * Get single stock by CIN (public endpoint)
   * MUST be before :id route
   */
  @Get('cin/:cin')
  @Public()
  async getStockByCin(@Param('cin') cin: string) {
    return await this.stocksService.getStockByCin(cin);
  }
  /**
   * GET /api/stocks/rm/all
   * Get all active stocks with lending prices (RM authenticated)
   * Returns only fields needed for coupon generation, including lending prices.
   * MUST be before :id route
   */
  @Get('rm/all')
  @UseGuards(JwtAuthGuard)
  async getAllStocksForRM(@Req() req: any) {
    const isInternal =
      req.user.type === 'BRANCH' ||
      req.user.type === 'INTERNAL_RM' ||
      req.user.type === 'ADMIN' ||
      !!req.user.adminId ||
      req.user.role === 'SUPER_ADMIN' ||
      req.user.role === 'ADMIN';
    return await this.stocksService.getAllStocksForRM(isInternal);
  }

  // ADMIN ENDPOINTS (Require admin authentication)
  /**
   * GET /api/stocks/admin/all
   * Get all stocks including inactive (admin only)
   * MUST be before :id route
   */
  @Get('admin/all')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async getAllStocksAdmin() {
    return await this.stocksService.getAllStocksAdmin();
  }

  // CMS ENDPOINTS (Require CMS authentication and permissions)
  /**
   * GET /api/stocks/cms/all
   * Get all stocks including inactive (CMS panel access with cms_panel_token)
   * Requires 'cms_stocks' permission
   * MUST be before :id route
   */
  @Get('cms/all')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async getAllStocksCms() {
    return await this.stocksService.getAllStocksAdmin();
  }

  /**
   * POST /api/stocks/cms/company/sync
   * Start background sync for company data
   */
  @Post('cms/company/sync')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async startCompanySync(@Body() dto: { cins: string[] }) {
    if (!dto.cins || !Array.isArray(dto.cins) || dto.cins.length === 0) {
      throw new BadRequestException('cins must be a non-empty array of strings');
    }
    const currentStatus = await this.stocksService.getCompanySyncStatus();
    if (currentStatus && currentStatus.active) {
      throw new BadRequestException('A sync job is already in progress');
    }
    await this.stocksService.runCompanySync(dto.cins);
    return { success: true, message: 'Sync job started in background' };
  }

  /**
   * GET /api/stocks/cms/company/sync/status
   * Get sync status of company data
   */
  @Get('cms/company/sync/status')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async getCompanySyncStatus() {
    return await this.stocksService.getCompanySyncStatus();
  }

  /**
   * GET /api/stocks/accounting/all
   * Get all stocks including inactive (Accounting panel access)
   * MUST be before :id route
   */
  @Get('accounting/all')
  @UseGuards(AccountingJwtAuthGuard)
  async getAllStocksAccounting() {
    return await this.stocksService.getAllStocksAdmin();
  }

  /**
   * GET /api/stocks/operation/all
   * Get all stocks including inactive (Operation panel access)
   * MUST be before :id route
   */
  @Get('operation/all')
  @UseGuards(OperationJwtAuthGuard)
  async getAllStocksOperation(@Req() req: any) {
    if (req.user?.role !== 'SUPER_ADMIN' && !req.user?.permissions?.includes('manage_stocks')) {
      throw new ForbiddenException('Missing manage_stocks permission');
    }
    return await this.stocksService.getAllStocksAdmin();
  }

  /**
   * GET /api/stocks/cms/:id/versions
   * Get version history for stock (CMS panel access with cms_panel_token)
   * No permissions guard needed for read-only version history
   * MUST be before :id route
   */
  @Get('cms/:id/versions')
  @UseGuards(CmsJwtAuthGuard)
  async getStockVersionHistoryCms(@Param('id') id: string) {
    return this.stocksService.getStockVersionHistory(id);
  }

  /**
   * GET /api/stocks/admin/:id/versions
   * Get version history for a stock (admin only)
   * MUST be before :id route
   */
  @Get('admin/:id/versions')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async getStockVersionHistory(@Param('id') id: string) {
    return this.stocksService.getStockVersionHistory(id);
  }

  /**
   * GET /api/stocks/company/:cin/details
   * Get company details from database
   * MUST be before :id route
   */
  @Get('company/:cin/details')
  @Public()
  async getCompanyDetails(@Param('cin') cin: string) {
    return await this.stocksService.getCompanyDataByCin(cin);
  }

  /**
   * GET /api/stocks/company/:cin/documents/:docId
   * Fetch company reference document from Probe42
   * MUST be before :id route
   */
  @Get('company/:cin/documents')
  @Public()
  async getCompanyDocument(
    @Param('cin') cin: string,
    @Query('docId') docId: string,
    @Res() res: FastifyReply,
  ) {
    if (!docId) {
      throw new BadRequestException('docId query parameter is required');
    }
    const buffer = await this.stocksService.getCompanyDocumentBuffer(cin, docId);
    res.header('Content-Type', 'application/pdf');
    res.header('Content-Disposition', `attachment; filename="document.pdf"`);
    res.send(buffer);
  }

  @Get('company/:cin/documents/attachments')
  @Public()
  async getCompanyDocumentAttachments(
    @Param('cin') cin: string,
    @Query('docId') docId: string,
  ) {
    if (!docId) {
      throw new BadRequestException('docId query parameter is required');
    }
    const buffer = await this.stocksService.getCompanyDocumentBuffer(cin, docId);
    const attachments = await this.stocksService.extractDocumentAttachments(buffer);
    return attachments.map(a => ({ name: a.name, size: a.size }));
  }

  @Get('company/:cin/documents/attachment')
  @Public()
  async getCompanyDocumentAttachment(
    @Param('cin') cin: string,
    @Query('docId') docId: string,
    @Query('attachmentName') attachmentName: string,
    @Res() res: FastifyReply,
  ) {
    if (!docId || !attachmentName) {
      throw new BadRequestException('docId and attachmentName query parameters are required');
    }
    const buffer = await this.stocksService.getCompanyDocumentBuffer(cin, docId);
    const attachments = await this.stocksService.extractDocumentAttachments(buffer);
    const attachment = attachments.find(a => a.name === attachmentName);
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    
    // Set proper headers to trigger a download
    res.header('Content-Disposition', `attachment; filename="${attachment.name}"`);
    res.send(Buffer.from(attachment.data));
  }

  /**
   * GET /api/stocks/:id
   * Get single stock by ID (public endpoint with Redis caching)
  * MUST be LAST among GET routes to avoid catching admin/cms/cin paths
   */
  @Get(':id')
  @Public()
  async getStockById(@Param('id') id: string, @Query('live') live?: string) {
    return await this.stocksService.getStockById(id, live === 'true');
  }

  /**
   * POST /api/stocks/cms
   * CMS: propose new stock — held for admin approval, nothing goes live.
   * Requires 'cms_stocks' permission
   */
  @Post('cms')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async createStockCms(@Body() dto: CreateStockDto, @Req() req: any) {
    const adminId = req.user.adminId;
    const changeRequest = await this.stocksService.proposeStockCreate(dto, adminId);
    return { message: 'Stock creation submitted for admin approval', changeRequest };
  }

  /**
   * PUT /api/stocks/cms/:id
   * CMS: propose stock update — held for admin approval, nothing goes live.
   * Requires 'cms_stocks' permission
   */
  @Put('cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async updateStockCms(
    @Param('id') id: string,
    @Body() dto: UpdateStockDto,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId || req.user.userId;
    if (dto.name !== undefined) {
      const existing = await this.stocksService.getStockById(id, true);
      if (existing && existing.name === dto.name) {
        delete dto.name;
      } else if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'CONTENT_MANAGER' && req.user.role !== 'ADMIN') {
        throw new ForbiddenException('Only super admins, admins, and content managers can update the stock name');
      }
    }
    const changeRequest = await this.stocksService.proposeStockUpdateCms(id, dto, adminId);
    return { message: 'Stock update submitted for admin approval', changeRequest };
  }

  /**
   * DELETE /api/stocks/cms/:id
   * CMS: propose stock delete — record stays live until admin approves.
   * Requires 'cms_stocks' permission
   */
  @Delete('cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async deleteStockCms(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.adminId;
    const changeRequest = await this.stocksService.proposeStockDelete(id, adminId);
    return { message: 'Stock deletion submitted for admin approval', changeRequest };
  }

  /**
   * POST /api/stocks/admin
   * Create new stock (admin only)
   */
  @Post('admin')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async createStock(@Body() dto: CreateStockDto, @Req() req: any) {
    const adminId = req.user.adminId;
    return await this.stocksService.createStock(dto, adminId);
  }

  /**
   * PUT /api/stocks/admin/:id
   * Update stock (admin only)
   */
  @Put('admin/:id')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async updateStock(
    @Param('id') id: string,
    @Body() dto: UpdateStockDto,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId;
    if (dto.name !== undefined) {
      const existing = await this.stocksService.getStockById(id, true);
      if (existing && existing.name === dto.name) {
        delete dto.name;
      } else if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
        throw new ForbiddenException('Only super admins and admins can update the stock name');
      }
    }
    return await this.stocksService.updateStock(id, dto, adminId);
  }

  /**
   * PUT /api/stocks/operation/:id
   * Update stock (Operation panel access)
   */
  @Put('operation/:id')
  @UseGuards(OperationJwtAuthGuard)
  async updateStockOperation(
    @Param('id') id: string,
    @Body() dto: UpdateStockDto,
    @Req() req: any,
  ) {
    if (req.user?.role !== 'SUPER_ADMIN' && !req.user?.permissions?.includes('manage_stocks')) {
      throw new ForbiddenException('Missing manage_stocks permission');
    }
    const adminId = req.user.adminId;
    // Operations should only update price, isActive, and discountSlabs.
    // Ensure they don't change the name.
    if (dto.name !== undefined && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only super admins can update the stock name');
    }
    
    // Instead of updating directly, create a Change Request for Maker-Checker flow
    return await this.stocksService.proposeStockUpdate(id, dto, adminId);
  }

  /**
   * DELETE /api/stocks/admin/:id
   * Delete stock (soft delete - admin only)
   */
  @Delete('admin/:id')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async deleteStock(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.adminId;
    return await this.stocksService.deleteStock(id, adminId);
  }

  /**
   * POST /api/stocks/admin/:id/rollback/:versionNumber
   * Rollback stock to a specific version (admin only)
   */
  @Post('admin/:id/rollback/:versionNumber')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async rollbackStock(
    @Param('id') id: string,
    @Param('versionNumber') versionNumber: string,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId;
    return this.stocksService.rollbackStock(
      id,
      parseInt(versionNumber),
      adminId,
    );
  }

  /**
   * POST /api/stocks/admin/snapshots/capture
   * Manually trigger daily snapshot capture (admin only)
   */
  @Post('admin/snapshots/capture')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async captureSnapshotsManual(@Req() req: any) {
    const adminId = req.user.adminId;
    return await this.stocksService.captureDailySnapshots(adminId);
  }

  /**
   * POST /api/stocks/upload/document
   * Upload a document file for stocks (local storage)
   */
  @Post('upload/document')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async uploadDocument(@Req() req: any) {
    try {
      const data = await req.file();

      if (!data) {
        throw new BadRequestException('No file uploaded');
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(data.mimetype)) {
        throw new BadRequestException(
          'Invalid file type. Only PDF, JPEG, and PNG files are allowed',
        );
      }

      // Convert file to buffer and validate size
      const buffer = await data.toBuffer();
      if (buffer.length > 5 * 1024 * 1024) {
        throw new BadRequestException('File size must not exceed 5MB');
      }

      return await this.stocksService.uploadDocument(
        data.filename,
        buffer,
        data.mimetype,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to upload document');
    }
  }

  /**
   * POST /api/stocks/admin/upload/document
   * Upload a document file for stocks (admin access)
   */
  @Post('admin/upload/document')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('admin_stocks')
  async uploadDocumentAdmin(@Req() req: any) {
    try {
      const data = await req.file();

      if (!data) {
        throw new BadRequestException('No file uploaded');
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(data.mimetype)) {
        throw new BadRequestException(
          'Invalid file type. Only PDF, JPEG, and PNG files are allowed',
        );
      }

      // Convert file to buffer and validate size
      const buffer = await data.toBuffer();
      if (buffer.length > 5 * 1024 * 1024) {
        throw new BadRequestException('File size must not exceed 5MB');
      }

      return await this.stocksService.uploadDocument(
        data.filename,
        buffer,
        data.mimetype,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to upload document');
    }
  }

  // PRICE HISTORY ENDPOINTS
  /**
   * GET /api/stocks/admin/:id/prices
   * Get price history for a stock (admin access)
   */
  @Get('admin/:id/prices')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('admin_stocks')
  async getPriceHistoryAdmin(@Param('id') stockId: string) {
    return await this.stocksService.getPriceHistory(stockId);
  }

  /**
   * POST /api/stocks/admin/:id/prices
   * Add a price point for a stock (admin access)
   */
  @Post('admin/:id/prices')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('admin_stocks')
  async addPricePointAdmin(
    @Param('id') stockId: string,
    @Body() dto: CreateStockPriceDto,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId;
    return await this.stocksService.addPricePoint(stockId, dto, adminId);
  }

  /**
   * DELETE /api/stocks/admin/prices/:id
   * Delete a price point (admin access)
   */
  @Delete('admin/prices/:id')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('admin_stocks')
  async deletePricePointAdmin(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.adminId;
    return await this.stocksService.deletePricePoint(id, adminId);
  }

  /**
   * GET /api/stocks/:id/prices
   * Get price history for a stock (public endpoint)
   */
  @Get(':id/prices')
  @Public()
  async getPriceHistory(@Param('id') stockId: string) {
    return await this.stocksService.getPriceHistory(stockId);
  }

  /**
   * POST /api/stocks/:id/interest
   * Record user interest in an out-of-stock or excess-demand item.
   * Optionally accepts { requestedQuantity } in the body to capture
   * how many shares the user originally wanted to buy.
   */
  @Post(':id/interest')
  @UseGuards(UserJwtAuthGuard)
  async expressInterest(
    @Param('id') stockId: string,
    @Req() req: any,
    @Body() body?: { requestedQuantity?: number },
  ) {
    const userId = req.user.userId;
    return await this.stocksService.expressInterest(stockId, userId, body?.requestedQuantity);
  }

  /**
   * GET /api/stocks/admin/interests
   * Retrieve all stock interest records (admin or operations panel access)
   */
  @Get('admin/interests')
  @Public()
  @UseGuards(AdminOrOperationJwtAuthGuard, AdminGuard)
  async getAllInterests() {
    return await this.stocksService.getAllInterests();
  }
}
