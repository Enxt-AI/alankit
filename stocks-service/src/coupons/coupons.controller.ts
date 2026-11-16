import { Controller, Post, Body, Req, Get, Query, UseGuards, BadRequestException, Delete, Param, Patch } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('stocks/coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post('/')
  @UseGuards(JwtAuthGuard)
  async createCoupon(
    @Body() body: {
      stockId: string;
      minQuantity: number;
      maxQuantity: number;
      discountAmount: number;
      assignedUserId?: string;
      expiresAt?: string;
      discountType?: string;
      discountPercentage?: number;
      code?: string;
      redemptionType?: 'ONCE' | 'UNLIMITED';
      mapToMarketing?: boolean;
    },
    @Req() req: any,
  ) {
    const isAdmin =
      req.user.type === 'ADMIN' ||
      !!req.user.adminId ||
      req.user.role === 'SUPER_ADMIN' ||
      req.user.role === 'ADMIN';

    // Extract RM IDs from the authenticated user token
    const internalRmId = req.user.internalRmId || null;
    const distributorRmId = req.user.distributorRmId || null;
    if (!isAdmin && !internalRmId && !distributorRmId) {
      throw new BadRequestException('Relationship Manager ID or Admin authorization is required');
    }

    const adminContext = isAdmin
      ? {
          adminId: req.user.adminId || req.user.userId || req.user.id,
          adminEmail: req.user.email || '',
          adminRole: req.user.role || (req.user.type === 'ADMIN' ? 'SUPER_ADMIN' : req.user.type),
          adminName: req.user.fullName || (req.user.email ? req.user.email.split('@')[0] : 'Super Admin'),
        }
      : undefined;

    return await this.couponsService.generateCoupon(
      internalRmId,
      distributorRmId,
      body.stockId,
      Number(body.minQuantity),
      Number(body.maxQuantity),
      Number(body.discountAmount),
      body.assignedUserId,
      body.expiresAt ? new Date(body.expiresAt) : undefined,
      body.discountType,
      body.discountPercentage != null ? Number(body.discountPercentage) : undefined,
      isAdmin,
      body.code,
      adminContext,
      body.redemptionType || 'UNLIMITED',
      body.mapToMarketing ?? false,
    );
  }

  @Patch('/:id/marketing-mapping')
  @UseGuards(JwtAuthGuard)
  async toggleMarketingMapping(
    @Param('id') id: string,
    @Body() body: { mapToMarketing: boolean },
    @Req() req: any,
  ) {
    const isAdmin =
      req.user.type === 'ADMIN' ||
      !!req.user.adminId ||
      req.user.role === 'SUPER_ADMIN' ||
      req.user.role === 'ADMIN';

    if (!isAdmin) {
      throw new BadRequestException('Admin authorization required to change coupon visibility');
    }

    const adminContext = {
      adminId: req.user.adminId || req.user.userId || req.user.id,
      adminEmail: req.user.email || '',
      adminRole: req.user.role || (req.user.type === 'ADMIN' ? 'SUPER_ADMIN' : req.user.type),
      adminName: req.user.fullName || (req.user.email ? req.user.email.split('@')[0] : 'Super Admin'),
    };

    return await this.couponsService.toggleMarketingMapping(id, body.mapToMarketing ?? false, adminContext);
  }

  @Get('/')
  @UseGuards(JwtAuthGuard)
  async getCoupons(
    @Req() req: any,
    @Query('rmId') queryRmId?: string,
    @Query('scope') queryScope?: string,
    @Query('adminOnly') queryAdminOnly?: string,
    @Query('panel') queryPanel?: string,
  ) {
    const isAdminOrMarketing =
      req.user.type === 'ADMIN' ||
      req.user.type === 'MARKETING' ||
      !!req.user.adminId ||
      req.user.role === 'SUPER_ADMIN' ||
      req.user.role === 'ADMIN' ||
      req.user.role === 'MARKETING_MANAGER' ||
      req.user.role === 'SALES_EMPLOYEE';

    const isMarketing =
      queryPanel === 'marketing' ||
      req.headers['x-panel-context'] === 'marketing' ||
      req.user.type === 'MARKETING' ||
      req.user.role === 'MARKETING_MANAGER' ||
      req.user.role === 'SALES_EMPLOYEE';

    if (
      isAdminOrMarketing &&
      (queryScope === 'admin' || queryAdminOnly === 'true' || queryRmId === 'admin')
    ) {
      return await this.couponsService.getAllCoupons(true, isMarketing);
    }

    if (isAdminOrMarketing && (queryRmId === 'all' || !queryRmId)) {
      return await this.couponsService.getAllCoupons(false, isMarketing);
    }

    let internalRmId = req.user.internalRmId || null;
    let distributorRmId = req.user.distributorRmId || null;
    
    if (isAdminOrMarketing && queryRmId) {
      // Admin or marketing querying a specific RM — try both columns
      internalRmId = queryRmId;
      distributorRmId = queryRmId;
    }

    if (!internalRmId && !distributorRmId) {
      throw new BadRequestException('Relationship Manager ID is required');
    }
    return await this.couponsService.getCouponsForRM(internalRmId, distributorRmId);
  }

  @Get('/stats')
  @UseGuards(JwtAuthGuard)
  async getCouponStats(@Req() req: any) {
    const internalRmId = req.user.internalRmId || null;
    const distributorRmId = req.user.distributorRmId || null;
    if (!internalRmId && !distributorRmId) {
      throw new BadRequestException('Relationship Manager ID is required');
    }
    return await this.couponsService.getCouponStatsForRM(internalRmId, distributorRmId);
  }

  @Get('/sales-stats')
  @UseGuards(JwtAuthGuard)
  async getSalesStats(@Req() req: any) {
    const internalRmId = req.user.internalRmId || null;
    const distributorRmId = req.user.distributorRmId || null;
    if (!internalRmId && !distributorRmId) {
      throw new BadRequestException('Relationship Manager ID is required');
    }
    return await this.couponsService.getSalesStatsForRM(internalRmId, distributorRmId);
  }

  @Get('/:id')
  @UseGuards(JwtAuthGuard)
  async getCouponById(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const isAdminOrMarketing =
      req.user.type === 'ADMIN' ||
      req.user.type === 'MARKETING' ||
      !!req.user.adminId ||
      req.user.role === 'SUPER_ADMIN' ||
      req.user.role === 'ADMIN' ||
      req.user.role === 'MARKETING_MANAGER' ||
      req.user.role === 'SALES_EMPLOYEE';

    const internalRmId = req.user.internalRmId || null;
    const distributorRmId = req.user.distributorRmId || null;

    if (!isAdminOrMarketing && !internalRmId && !distributorRmId) {
      throw new BadRequestException('Authorization required');
    }

    return await this.couponsService.getCouponById(id, internalRmId, distributorRmId, isAdminOrMarketing);
  }

  @Post('/validate')
  @UseGuards(JwtAuthGuard)
  async validateCoupon(
    @Body() body: { code: string; stockId: string; quantity: number },
    @Req() req: any,
  ) {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    return await this.couponsService.validateCoupon(
      body.code,
      body.stockId,
      Number(body.quantity),
      userId,
    );
  }

  @Delete('/:id')
  @UseGuards(JwtAuthGuard)
  async deleteCoupon(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const isAdmin =
      req.user.type === 'ADMIN' ||
      !!req.user.adminId ||
      req.user.role === 'SUPER_ADMIN' ||
      req.user.role === 'ADMIN';

    const rmId = req.user.internalRmId || req.user.distributorRmId || req.user.id;
    if (!isAdmin && !rmId) {
      throw new BadRequestException('Relationship Manager ID or Admin authorization is required');
    }
    return await this.couponsService.deleteCoupon(id, rmId, isAdmin);
  }
}
