import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type WatchlistToggleTarget =
  | { stockId: string; upcomingStockId?: never }
  | { stockId?: never; upcomingStockId: string };

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns watchlist items for a user as: { addedAt, stock }[]
   */
  async getWatchlist(userId: string) {
    const items = await this.prisma.watchlistItem.findMany({
      where: {
        userId,
        // Business rule: inactive items should not be visible in the watchlist.
        // This applies to both regular stocks and upcoming stocks.
        OR: [
          { stock: { isActive: true } },
          { upcomingStock: { isActive: true } },
        ],
      },
      orderBy: { addedAt: 'desc' },
      select: {
        addedAt: true,
        // After adding UpcomingStock support, WatchlistItem can point to either:
        // - `stock` (regular Stock)
        // - `upcomingStock` (UpcomingStock)
        // DB enforces XOR via a CHECK constraint, so exactly one should be present.
        stock: {
          select: {
            id: true,
            name: true,
            price: true,
            logoUrl: true,
            // CIN is displayed in the UI as the preferred identifier.
            // Keep it in watchlist payloads so the same card component can render consistently.
            cin: true,
            totalShares: true,
            minimumPurchaseQuantity: true,
            maximumPurchaseQuantity: true,
            prices: {
              orderBy: { date: 'desc' },
              take: 2,
            },
          },
        },
        upcomingStock: {
          select: {
            id: true,
            name: true,
            price: true,
            logoUrl: true,
            cin: true,
            totalShares: true,
          },
        },
      },
    });

    // Keep response consistent with the existing frontend contract:
    // - `apps/web` expects `{ addedAt, stock }[]` where `stock` is always present.
    // - We normalize UpcomingStock into the same shape as Stock for display purposes.
    const entries = await Promise.all(
      items.map(async (item) => {
        const isRegular = !!item.stock;
        const resolvedStock = item.stock ?? item.upcomingStock;
        if (!resolvedStock) {
          // Should never happen due to XOR CHECK constraint, but keep runtime safe.
          return null;
        }

        // Calculate change metrics for regular stocks using price history
        let change = 0;
        let changePercent = 0;
        if (isRegular && item.stock) {
          const prices = (item.stock as any).prices || [];
          if (prices.length > 0) {
            let prevPrice = prices[0].price;
            if (prices.length >= 2 && Math.abs(item.stock.price - prices[0].price) < 0.001) {
              prevPrice = prices[1].price;
            }

            if (prevPrice > 0) {
              change = item.stock.price - prevPrice;
              changePercent = (change / prevPrice) * 100;
            }
          }
        }

        // Change since the user added the stock to the watchlist: compare the
        // current price against the latest recorded price at (or before) addedAt.
        // Null when no price history exists that far back (or for upcoming stocks).
        let addedPrice: number | null = null;
        let sinceAddedChange = 0;
        let sinceAddedChangePercent: number | null = null;
        if (isRegular && item.stock) {
          const priceAtAdd = await this.prisma.stockPrice.findFirst({
            where: { stockId: item.stock.id, date: { lte: item.addedAt } },
            orderBy: { date: 'desc' },
            select: { price: true },
          });
          if (priceAtAdd && priceAtAdd.price > 0) {
            addedPrice = priceAtAdd.price;
            sinceAddedChange = item.stock.price - addedPrice;
            sinceAddedChangePercent = (sinceAddedChange / addedPrice) * 100;
          }
        }

        const { prices, ...stockData } = resolvedStock as any;

        return {
          addedAt: item.addedAt,
          stock: {
            ...stockData,
            marketCap: (resolvedStock.totalShares || 0) * resolvedStock.price,
            change,
            changePercent,
            addedPrice,
            sinceAddedChange,
            sinceAddedChangePercent,
          },
          type: item.stock ? 'REGULAR' : 'UPCOMING',
        };
      }),
    );

    return entries.filter(
        (
          entry,
        ): entry is {
          addedAt: Date;
          stock: any;
          type: 'REGULAR' | 'UPCOMING';
        } => entry !== null,
      );
  }

  /**
   * Toggle an item in a user's watchlist. Returns { isInWatchlist }.
   *
   * This is the single entry point for watchlist toggling. It accepts either
   * a regular stock id OR an upcoming stock id and enforces XOR validation.
   *
   * @throws BadRequestException if both/neither ids are provided
   */
  async toggleWatchlist(
    userId: string,
    target: { stockId?: string; upcomingStockId?: string },
  ) {
    const stockId = target?.stockId;
    const upcomingStockId = target?.upcomingStockId;

    // XOR validation: exactly one must be provided.
    if ((!!stockId && !!upcomingStockId) || (!stockId && !upcomingStockId)) {
      throw new BadRequestException(
        'Exactly one of stockId or upcomingStockId must be provided',
      );
    }

    if (stockId) {
      return this.toggleRegularStockWatchlist(userId, { stockId });
    }

    return this.toggleUpcomingStockWatchlist(userId, {
      upcomingStockId: upcomingStockId!,
    });
  }

  private async toggleRegularStockWatchlist(
    userId: string,
    target: WatchlistToggleTarget & { stockId: string },
  ) {
    const stockExists = await this.prisma.stock.findUnique({
      where: { id: target.stockId },
      select: { id: true, isActive: true },
    });

    // Treat inactive stocks as not visible.
    if (!stockExists || !stockExists.isActive) {
      throw new NotFoundException('Stock not found');
    }

    const existing = await this.prisma.watchlistItem.findUnique({
      where: {
        userId_stockId: {
          userId,
          stockId: target.stockId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.watchlistItem.delete({
        where: { id: existing.id },
      });
      return { isInWatchlist: false };
    }

    try {
      await this.prisma.watchlistItem.create({
        data: {
          userId,
          stockId: target.stockId,
          // Ensure XOR constraint explicitly.
          upcomingStockId: null,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return { isInWatchlist: true };
      }

      if (error?.code === 'P2003') {
        throw new NotFoundException('Stock not found');
      }

      throw new ConflictException('Unable to update watchlist');
    }

    return { isInWatchlist: true };
  }

  /**
   * Toggle an upcoming stock in a user's watchlist. Returns { isInWatchlist }.
   *
   * This method enforces the XOR constraint: a watchlist item can reference
   * either a regular stock OR an upcoming stock, but not both.
   *
   * @param userId - The ID of the user
   * @param upcomingStockId - The ID of the upcoming stock to toggle
   * @returns Object with isInWatchlist boolean indicating current state
   * @throws NotFoundException if the upcoming stock doesn't exist
   * @throws ConflictException if unable to update watchlist
   */
  private async toggleUpcomingStockWatchlist(
    userId: string,
    target: WatchlistToggleTarget & { upcomingStockId: string },
  ) {
    // 1. Verify upcoming stock exists
    const upcomingStockExists = await this.prisma.upcomingStock.findUnique({
      where: { id: target.upcomingStockId },
      select: { id: true, isActive: true },
    });

    // Treat inactive upcoming stocks as not visible.
    if (!upcomingStockExists || !upcomingStockExists.isActive) {
      throw new NotFoundException('Upcoming stock not found');
    }

    // 2. Check if already in watchlist
    const existing = await this.prisma.watchlistItem.findUnique({
      where: {
        userId_upcomingStockId: {
          userId,
          upcomingStockId: target.upcomingStockId,
        },
      },
      select: { id: true },
    });

    // 3. Toggle logic (delete if exists, create if not)
    if (existing) {
      await this.prisma.watchlistItem.delete({
        where: { id: existing.id },
      });
      return { isInWatchlist: false };
    }

    // 4. Create with error handling
    try {
      await this.prisma.watchlistItem.create({
        data: {
          userId,
          upcomingStockId: target.upcomingStockId,
          // Ensure XOR constraint: exactly one target is set.
          stockId: null,
        },
      });
    } catch (error: any) {
      // Handle race conditions (double-click): treat unique violation as already in watchlist.
      if (error?.code === 'P2002') {
        return { isInWatchlist: true };
      }

      // Handle FK violations (upcoming stock deleted between checks)
      if (error?.code === 'P2003') {
        throw new NotFoundException('Upcoming stock not found');
      }

      throw new ConflictException('Unable to update watchlist');
    }

    return { isInWatchlist: true };
  }
}
