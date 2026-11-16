import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

/**
 * Portfolio Controller
 * Handles HTTP endpoints for portfolio management
 * Base route: /api/portfolio
 */
@Controller('portfolio')
export class PortfolioController {
  constructor(private portfolioService: PortfolioService) {}

  // USER ENDPOINTS (Require user authentication)
  /**
   * GET /api/portfolio
   * Get logged-in user's portfolio
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getMyPortfolio(@Req() req: any) {
    const userId = req.user.userId;
    return await this.portfolioService.getUserPortfolio(userId);
  }

  // ADMIN ENDPOINTS (Require admin authentication)
  /**
   * GET /api/portfolio/admin/all
   * Get all user portfolios (admin only)
   */
  @Get('admin/all')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async getAllPortfolios() {
    return await this.portfolioService.getAllPortfolios();
  }

  /**
   * GET /api/portfolio/admin/user/:userId
   * Get specific user's portfolio (admin only)
   */
  @Get('admin/user/:userId')
  @UseGuards(AdminJwtAuthGuard, AdminGuard)
  async getUserPortfolio(@Param('userId') userId: string) {
    return await this.portfolioService.getUserPortfolioAdmin(userId);
  }
}
