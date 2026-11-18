import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { OrderStatus } from '../orders/order-status.constants';
import { Public } from '../auth/decorators/public.decorator';

/**
 * StatsController
 *
 * Provides aggregated statistics for the admin dashboard.
 * All endpoints are protected and require admin authentication.
 */
@Controller('stats')
export class StatsController {
  constructor(private prisma: PrismaService) {}

  /**
   * GET /api/stats/admin/overview
   *
   * Returns aggregated counts for admin dashboard:
   * - Total stocks (all records)
   * - Active stocks (isActive = true)
   * - Total orders (all records)
   * - Pending orders (status = 'PENDING')
   *
   * NOTE: totalReferrals and pendingReferrals were removed as part of the
   * RM and referral system deprecation.
   *
   * @returns Object with count statistics
   */
  @Get('admin/overview')
  @Public()
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async getAdminOverview() {
    const [
      totalStocks,
      activeStocks,
      totalOrders,
      pendingOrders,
    ] = await Promise.all([
      this.prisma.stock.count(),
      this.prisma.stock.count({ where: { isActive: true } }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
    ]);

    return {
      totalStocks,
      activeStocks,
      totalOrders,
      pendingOrders,
    };
  }
}
