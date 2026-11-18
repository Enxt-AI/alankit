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
  BadRequestException,
} from '@nestjs/common';
import { UpcomingStocksService } from './upcoming-stocks.service';
import { CreateUpcomingStockDto } from './dto/create-upcoming-stock.dto';
import { UpdateUpcomingStockDto } from './dto/update-upcoming-stock.dto';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CmsJwtAuthGuard } from '../auth/guards/cms-jwt-auth.guard';
import {
  PermissionsGuard,
  Permissions,
  RequirePermissions,
} from '../auth/guards/permissions.guard';
import { AdminContextService } from '../common/admin-context.service';
import { CmsGuard } from '../auth/guards/cms.guard';
import { Public } from '../auth/decorators/public.decorator';

/**
 * UpcomingStocksController
 * Base route: /api/upcoming-stocks
 *
 * Mirrors StocksController conventions:
 * - Public endpoints first
 * - Admin/CMS endpoints next
 * - Route order matters: specific paths must come before parameterized :id routes.
 *
 * NOTE (Route Aliases):
 * Some consumers expect admin/cms routes to be grouped under `/api/admin/*` and `/api/cms/*`.
 * To avoid breaking existing callers, we keep the legacy routes in this controller
 * (`/api/upcoming-stocks/admin|cms/*`) and provide new alias controllers below:
 * - `/api/cms/upcoming-stocks/*`
 * - `/api/admin/upcoming-stocks/*`
 */
@Controller('upcoming-stocks')
export class UpcomingStocksController {
  constructor(
    private readonly upcomingStocksService: UpcomingStocksService,
    private readonly adminContextService: AdminContextService,
  ) {}

  // =============================
  // PUBLIC ENDPOINTS
  // =============================

  /**
   * GET /api/upcoming-stocks
   * Public endpoint (Redis cached)
   */
  @Get()
  @Public()
  async getAllActiveUpcomingStocks() {
    return await this.upcomingStocksService.getAllActiveUpcomingStocks();
  }

  /**
   * GET /api/upcoming-stocks/cin/:cin
   * Public endpoint
   * MUST be before :id route.
   */
  @Get('cin/:cin')
  @Public()
  async getUpcomingStockByCin(@Param('cin') cin: string) {
    return await this.upcomingStocksService.getUpcomingStockByCin(cin);
  }

  // =============================
  // ADMIN ENDPOINTS (AdminJwtAuthGuard + AdminGuard)
  // =============================

  /**
   * GET /api/upcoming-stocks/admin/all
   * Admin view (includes inactive)
   * MUST be before :id route.
   */
  @Get('admin/all')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async getAllUpcomingStocksAdmin() {
    return await this.upcomingStocksService.getAllUpcomingStocksAdmin();
  }

  /**
   * POST /api/upcoming-stocks/admin
   * Admin create
   */
  @Post('admin')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async createUpcomingStockAdmin(
    @Body() dto: CreateUpcomingStockDto,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId;
    return await this.upcomingStocksService.createUpcomingStock(dto, adminId);
  }

  /**
   * PUT /api/upcoming-stocks/admin/:id
   * Admin update
   */
  @Put('admin/:id')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async updateUpcomingStockAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateUpcomingStockDto,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId;
    return await this.upcomingStocksService.updateUpcomingStock(
      id,
      dto,
      adminId,
    );
  }

  /**
   * DELETE /api/upcoming-stocks/admin/:id
   * Admin hard delete
   */
  @Delete('admin/:id')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async deleteUpcomingStockAdmin(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.adminId;
    return await this.upcomingStocksService.deleteUpcomingStock(id, adminId);
  }

  /**
   * POST /api/upcoming-stocks/admin/:id/convert
   * Legacy admin route kept for backward compatibility.
   */
  @Post('admin/:id/convert')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async convertUpcomingStockToRegularStockAdminLegacy(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId;

    const adminContext = {
      adminId,
      email: req.user.email,
      role: 'ADMIN',
      permissions: req.user.permissions,
    };

    return await this.adminContextService.run(adminContext, () =>
      this.upcomingStocksService.convertToRegularStock(id, adminId),
    );
  }

  /**
   * POST /api/upcoming-stocks/:id/convert
   * Convert upcoming stock to regular stock (irreversible)
   */
  @Post(':id/convert')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async convertUpcomingStockToRegularStock(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId;

    const adminContext = {
      adminId,
      email: req.user.email,
      role: 'ADMIN',
      permissions: req.user.permissions,
    };

    return await this.adminContextService.run(adminContext, () =>
      this.upcomingStocksService.convertToRegularStock(id, adminId),
    );
  }

  // =============================
  // CMS ENDPOINTS (CmsJwtAuthGuard + PermissionsGuard)
  // =============================

  /**
   * GET /api/upcoming-stocks/cms/all
   * CMS view (includes inactive)
   * Requires 'cms_stocks'
   * MUST be before :id route.
   */
  @Get('cms/all')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async getAllUpcomingStocksCms() {
    return await this.upcomingStocksService.getAllUpcomingStocksAdmin();
  }

  /**
   * POST /api/upcoming-stocks/cms
   * CMS: propose create — held for admin approval, nothing goes live.
   */
  @Post('cms')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async createUpcomingStockCms(
    @Body() dto: CreateUpcomingStockDto,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId;
    const changeRequest = await this.upcomingStocksService.proposeCreate(dto, adminId);
    return { message: 'Upcoming stock creation submitted for admin approval', changeRequest };
  }

  /**
   * PUT /api/upcoming-stocks/cms/:id
   * CMS: propose update — held for admin approval.
   */
  @Put('cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async updateUpcomingStockCms(
    @Param('id') id: string,
    @Body() dto: UpdateUpcomingStockDto,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId;
    const changeRequest = await this.upcomingStocksService.proposeUpdate(id, dto, adminId);
    return { message: 'Upcoming stock update submitted for admin approval', changeRequest };
  }

  /**
   * DELETE /api/upcoming-stocks/cms/:id
   * CMS: propose delete — record stays live until admin approves.
   */
  @Delete('cms/:id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async deleteUpcomingStockCms(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.adminId;
    const changeRequest = await this.upcomingStocksService.proposeDelete(id, adminId);
    return { message: 'Upcoming stock deletion submitted for admin approval', changeRequest };
  }

  /**
   * POST /api/upcoming-stocks/cms/:id/convert
   * Legacy CMS route kept for backward compatibility.
   */
  @Post('cms/:id/convert')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async convertUpcomingStockToRegularStockCmsLegacy(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId;
    return await this.upcomingStocksService.convertToRegularStock(id, adminId);
  }

  // =============================
  // FILE UPLOAD ENDPOINTS
  // (Uses Fastify multipart: req.file())
  // =============================

  /**
   * POST /api/upcoming-stocks/upload/document
   * CMS upload for upcoming stock documents
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

      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(data.mimetype)) {
        throw new BadRequestException(
          'Invalid file type. Only PDF, JPEG, and PNG files are allowed',
        );
      }

      const buffer = await data.toBuffer();
      if (buffer.length > 5 * 1024 * 1024) {
        throw new BadRequestException('File size must not exceed 5MB');
      }

      return await this.upcomingStocksService.uploadDocument(
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
   * POST /api/upcoming-stocks/admin/upload/document
   * Admin upload for upcoming stock documents
   */
  @Post('admin/upload/document')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('admin_upcoming_stocks')
  async uploadDocumentAdmin(@Req() req: any) {
    try {
      const data = await req.file();

      if (!data) {
        throw new BadRequestException('No file uploaded');
      }

      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(data.mimetype)) {
        throw new BadRequestException(
          'Invalid file type. Only PDF, JPEG, and PNG files are allowed',
        );
      }

      const buffer = await data.toBuffer();
      if (buffer.length > 5 * 1024 * 1024) {
        throw new BadRequestException('File size must not exceed 5MB');
      }

      return await this.upcomingStocksService.uploadDocument(
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

  // =============================
  // PUBLIC: Single item by id
  // MUST be last among GET routes.
  // =============================

  @Get(':id')
  @Public()
  async getUpcomingStockById(@Param('id') id: string) {
    return await this.upcomingStocksService.getUpcomingStockById(id);
  }
}

/**
 * UpcomingStocksCmsController
 * Base route: /api/cms/upcoming-stocks
 *
 * This is an alias surface for CMS consumers that expect CMS routes under `/cms/*`.
 */
@Controller('cms/upcoming-stocks')
export class UpcomingStocksCmsController {
  constructor(private readonly upcomingStocksService: UpcomingStocksService) {}

  /**
   * GET /api/cms/upcoming-stocks/:id/versions
   * Get version history for upcoming stock (CMS panel access)
   */
  @Get(':id/versions')
  @UseGuards(CmsJwtAuthGuard)
  async getUpcomingStockVersionHistoryCms(@Param('id') id: string) {
    return this.upcomingStocksService.getUpcomingStockVersionHistory(id);
  }

  /**
   * GET /api/cms/upcoming-stocks/all
   * CMS view (includes inactive)
   */
  @Get('all')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async getAllUpcomingStocksCms() {
    return await this.upcomingStocksService.getAllUpcomingStocksAdmin();
  }

  /**
   * POST /api/cms/upcoming-stocks
   * CMS alias: propose create — held for admin approval.
   */
  @Post()
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async createUpcomingStockCms(
    @Body() dto: CreateUpcomingStockDto,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId;
    const changeRequest = await this.upcomingStocksService.proposeCreate(dto, adminId);
    return { message: 'Upcoming stock creation submitted for admin approval', changeRequest };
  }

  /**
   * PUT /api/cms/upcoming-stocks/:id
   * CMS alias: propose update — held for admin approval.
   */
  @Put(':id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async updateUpcomingStockCms(
    @Param('id') id: string,
    @Body() dto: UpdateUpcomingStockDto,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId;
    const changeRequest = await this.upcomingStocksService.proposeUpdate(id, dto, adminId);
    return { message: 'Upcoming stock update submitted for admin approval', changeRequest };
  }

  /**
   * DELETE /api/cms/upcoming-stocks/:id
   * CMS alias: propose delete — stays live until approved.
   */
  @Delete(':id')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async deleteUpcomingStockCms(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.adminId;
    const changeRequest = await this.upcomingStocksService.proposeDelete(id, adminId);
    return { message: 'Upcoming stock deletion submitted for admin approval', changeRequest };
  }

  // Uploads (CMS)
  @Post('upload/document')
  @UseGuards(CmsJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('cms_stocks')
  async uploadDocument(@Req() req: any) {
    try {
      const data = await req.file();

      if (!data) {
        throw new BadRequestException('No file uploaded');
      }

      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(data.mimetype)) {
        throw new BadRequestException(
          'Invalid file type. Only PDF, JPEG, and PNG files are allowed',
        );
      }

      const buffer = await data.toBuffer();
      if (buffer.length > 5 * 1024 * 1024) {
        throw new BadRequestException('File size must not exceed 5MB');
      }

      return await this.upcomingStocksService.uploadDocument(
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
   * POST /api/cms/upcoming-stocks/:id/convert
   */
  @Post(':id/convert')
  @UseGuards(CmsJwtAuthGuard, CmsGuard)
  @Permissions('upcoming_stocks:convert')
  async convertUpcomingStockToRegularStock(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId;
    return await this.upcomingStocksService.convertToRegularStock(id, adminId);
  }
}

/**
 * UpcomingStocksAdminController
 * Base route: /api/admin/upcoming-stocks
 */
@Controller('admin/upcoming-stocks')
export class UpcomingStocksAdminController {
  constructor(
    private readonly upcomingStocksService: UpcomingStocksService,
    private readonly adminContextService: AdminContextService,
  ) {}

  /**
   * GET /api/admin/upcoming-stocks/:id/versions
   * Get version history for upcoming stock (admin panel access)
   */
  @Get(':id/versions')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async getUpcomingStockVersionHistory(@Param('id') id: string) {
    return this.upcomingStocksService.getUpcomingStockVersionHistory(id);
  }

  /**
   * GET /api/admin/upcoming-stocks/:id/versions/:versionNumber
   * Get specific version by number (admin)
   */
  @Get(':id/versions/:versionNumber')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async getUpcomingStockVersionByNumber(
    @Param('id') id: string,
    @Param('versionNumber') versionNumber: string,
  ) {
    return this.upcomingStocksService.getUpcomingStockVersionByNumber(
      id,
      parseInt(versionNumber),
    );
  }

  /**
   * POST /api/admin/upcoming-stocks/:id/rollback/:versionNumber
   * Rollback upcoming stock to a specific version (admin)
   */
  @Post(':id/rollback/:versionNumber')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async rollbackUpcomingStock(
    @Param('id') id: string,
    @Param('versionNumber') versionNumber: string,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId;
    return this.upcomingStocksService.rollbackUpcomingStock(
      id,
      parseInt(versionNumber),
      adminId,
    );
  }

  /**
   * GET /api/admin/upcoming-stocks/all
   */
  @Get('all')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async getAllUpcomingStocksAdmin() {
    return await this.upcomingStocksService.getAllUpcomingStocksAdmin();
  }

  /**
   * POST /api/admin/upcoming-stocks
   */
  @Post()
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async createUpcomingStock(
    @Body() dto: CreateUpcomingStockDto,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId;
    return await this.upcomingStocksService.createUpcomingStock(dto, adminId);
  }

  /**
   * PUT /api/admin/upcoming-stocks/:id
   */
  @Put(':id')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async updateUpcomingStock(
    @Param('id') id: string,
    @Body() dto: UpdateUpcomingStockDto,
    @Req() req: any,
  ) {
    const adminId = req.user.adminId;
    return await this.upcomingStocksService.updateUpcomingStock(
      id,
      dto,
      adminId,
    );
  }

  /**
   * DELETE /api/admin/upcoming-stocks/:id
   */
  @Delete(':id')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async deleteUpcomingStock(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.adminId;
    return await this.upcomingStocksService.deleteUpcomingStock(id, adminId);
  }

  /**
   * POST /api/admin/upcoming-stocks/:id/convert
   */
  @Post(':id/convert')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  @Permissions('upcoming_stocks:convert')
  async convertUpcomingStockToRegularStock(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const adminContext = {
      adminId: req.user.adminId,
      email: req.user.email,
      role: 'ADMIN',
      permissions: req.user.permissions,
    };

    return await this.adminContextService.run(adminContext, () => {
      const adminId = this.adminContextService.getAdminId();
      return this.upcomingStocksService.convertToRegularStock(id, adminId);
    });
  }

  // Uploads (Admin)
  @Post('upload/document')
  @UseGuards(AdminJwtAuthGuard, PermissionsGuard)
  @RequirePermissions('admin_upcoming_stocks')
  async uploadDocument(@Req() req: any) {
    try {
      const data = await req.file();

      if (!data) {
        throw new BadRequestException('No file uploaded');
      }

      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(data.mimetype)) {
        throw new BadRequestException(
          'Invalid file type. Only PDF, JPEG, and PNG files are allowed',
        );
      }

      const buffer = await data.toBuffer();
      if (buffer.length > 5 * 1024 * 1024) {
        throw new BadRequestException('File size must not exceed 5MB');
      }

      return await this.upcomingStocksService.uploadDocument(
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

}
