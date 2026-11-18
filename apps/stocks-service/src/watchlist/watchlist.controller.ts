import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { WatchlistService } from './watchlist.service';
import { UserJwtAuthGuard } from '../auth/guards/user-jwt-auth.guard';

/**
 * Watchlist Controller
 * Routes:
 * - GET /api/watchlist
 * - POST /api/stocks/:id/watchlist (toggle)
 * - POST /api/upcoming-stocks/:id/watchlist (toggle upcoming stock)
 */
@Controller()
@UseGuards(UserJwtAuthGuard, ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  private assertExactlyOneTarget(target: {
    stockId?: string;
    upcomingStockId?: string;
  }) {
    const hasStockId = !!target.stockId;
    const hasUpcomingStockId = !!target.upcomingStockId;
    if (
      (hasStockId && hasUpcomingStockId) ||
      (!hasStockId && !hasUpcomingStockId)
    ) {
      throw new BadRequestException(
        'Exactly one of stockId or upcomingStockId must be provided',
      );
    }
  }

  /**
   * GET /api/watchlist
   * Get the current user's watchlist.
   *
   * TODO (future): Include `changePercent` (and/or other quote metrics) in the response so the
   * Watchlist dashboard can render the Change% column without placeholders. For now, the web UI
   * intentionally displays a long dash (—).
   */
  @Get('watchlist')
  async getMyWatchlist(@Req() req: any) {
    const userId = req.user.userId;
    return this.watchlistService.getWatchlist(userId);
  }

  /**
   * POST /api/stocks/:id/watchlist
   * Toggle a stock in the current user's watchlist.
   */
  @Post('stocks/:id/watchlist')
  async toggleWatchlist(@Param('id') stockId: string, @Req() req: any) {
    const userId = req.user.userId;
    const target = { stockId };
    this.assertExactlyOneTarget(target);
    return this.watchlistService.toggleWatchlist(userId, target);
  }

  /**
   * POST /api/upcoming-stocks/:id/watchlist
   * Toggle an upcoming stock in the current user's watchlist.
   */
  @Post('upcoming-stocks/:id/watchlist')
  async toggleUpcomingStockWatchlist(
    @Param('id') upcomingStockId: string,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    const target = { upcomingStockId };
    this.assertExactlyOneTarget(target);
    return this.watchlistService.toggleWatchlist(userId, target);
  }
}
