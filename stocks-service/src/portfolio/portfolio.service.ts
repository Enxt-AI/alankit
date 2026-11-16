import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Portfolio Service
 * Handles user portfolio management
 */
@Injectable()
export class PortfolioService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get user's portfolio (User endpoint)
   * @param userId - User ID
   * @returns User's portfolio with current stock prices
   */
  async getUserPortfolio(userId: string) {
    const portfolio = await this.prisma.portfolio.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich portfolio with current stock prices
    const enrichedPortfolio = await Promise.all(
      portfolio.map(async (item) => {
        const stock = await this.prisma.stock.findUnique({
          where: { id: item.stockId },
          select: {
            id: true,
            name: true,
            cin: true,
            price: true,
            logoUrl: true,
          },
        });

        // Invested value MUST use the actual purchase price the user paid
        // (Portfolio.avgPrice = weighted average of order pricePerShare).
        // Previously this was overwritten by the stock's historical market
        // price, so "Invested" / "Avg. Price" / P&L didn't match the order.
        let basePrice = item.avgPrice;

        // Fallback only for legacy rows with no recorded purchase price
        if (!basePrice || basePrice <= 0) {
          const historicalPrice = await this.prisma.stockPrice.findFirst({
            where: {
              stockId: item.stockId,
              date: {
                lte: item.createdAt,
              },
            },
            orderBy: { date: 'desc' },
          });

          if (historicalPrice) {
            basePrice = historicalPrice.price;
          } else {
            const oldestPrice = await this.prisma.stockPrice.findFirst({
              where: { stockId: item.stockId },
              orderBy: { date: 'asc' },
            });
            if (oldestPrice) {
              basePrice = oldestPrice.price;
            }
          }
        }

        const investedValue = basePrice * item.quantity;

        if (!stock) {
          return {
            id: item.id,
            stockId: item.stockId,
            quantity: item.quantity,
            avgPrice: basePrice,
            currentPrice: 0,
            currentValue: 0,
            investedValue,
            profitLoss: -investedValue,
            profitLossPercentage: 0,
            stock: null,
          };
        }

        const currentValue = stock.price * item.quantity;
        const profitLoss = currentValue - investedValue;

        // Guard against division by zero or invalid investedValue
        let profitLossPercentage = 0;
        if (investedValue > 0) {
          profitLossPercentage = (profitLoss / investedValue) * 100;
          // Safely round only if it's a finite number
          if (Number.isFinite(profitLossPercentage)) {
            profitLossPercentage = Number.parseFloat(
              profitLossPercentage.toFixed(2),
            );
          } else {
            profitLossPercentage = 0;
          }
        }

        return {
          id: item.id,
          stockId: item.stockId,
          quantity: item.quantity,
          avgPrice: basePrice,
          currentPrice: stock.price,
          currentValue,
          investedValue,
          profitLoss,
          profitLossPercentage,
          stock,
        };
      }),
    );

    // Calculate total portfolio value
    const totalCurrentValue = enrichedPortfolio.reduce(
      (sum, item) => sum + item.currentValue,
      0,
    );
    const totalInvestedValue = enrichedPortfolio.reduce(
      (sum, item) => sum + item.investedValue,
      0,
    );
    const totalProfitLoss = totalCurrentValue - totalInvestedValue;
    const totalProfitLossPercentage =
      totalInvestedValue > 0 ? (totalProfitLoss / totalInvestedValue) * 100 : 0;

    // ======== Generate Portfolio Trend (Last 6 Months) ========
    const trend: { date: string; value: number }[] = [];
    const monthsToGenerate = 6;
    const now = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = monthsToGenerate - 1; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthLabel = monthNames[targetDate.getMonth()];

      const monthStockValues = await Promise.all(
        enrichedPortfolio.map(async (item) => {
          if (!item.stock) return 0;
          const priceRecord = await this.prisma.stockPrice.findFirst({
            where: {
              stockId: item.stockId,
              date: { lte: targetDate },
            },
            orderBy: { date: 'desc' },
          });

          let priceForMonth = item.currentPrice;
          if (priceRecord) {
            priceForMonth = priceRecord.price;
          } else {
            const oldestPrice = await this.prisma.stockPrice.findFirst({
              where: { stockId: item.stockId },
              orderBy: { date: 'asc' },
            });
            if (oldestPrice) {
              priceForMonth = oldestPrice.price;
            }
          }
          return priceForMonth * item.quantity;
        })
      );

      trend.push({
        date: monthLabel,
        value: monthStockValues.reduce((sum, val) => sum + val, 0),
      });
    }

    // ======== Generate Portfolio Trend (Last 30 Days — Daily) ========
    const dailyTrend: { date: string; value: number }[] = [];
    const daysToGenerate = 30;

    for (let i = daysToGenerate - 1; i >= 0; i--) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - i);
      targetDate.setHours(23, 59, 59, 999);

      const dayLabel = targetDate.toLocaleDateString('default', { day: 'numeric', month: 'short' });

      const dayStockValues = await Promise.all(
        enrichedPortfolio.map(async (item) => {
          if (!item.stock) return 0;
          const priceRecord = await this.prisma.stockPrice.findFirst({
            where: {
              stockId: item.stockId,
              date: { lte: targetDate },
            },
            orderBy: { date: 'desc' },
          });

          let priceForDay = item.currentPrice;
          if (priceRecord) {
            priceForDay = priceRecord.price;
          } else {
            const oldestPrice = await this.prisma.stockPrice.findFirst({
              where: { stockId: item.stockId },
              orderBy: { date: 'asc' },
            });
            if (oldestPrice) {
              priceForDay = oldestPrice.price;
            }
          }
          return priceForDay * item.quantity;
        })
      );

      dailyTrend.push({
        date: dayLabel,
        value: dayStockValues.reduce((sum, val) => sum + val, 0),
      });
    }

    // ======== Generate Portfolio Trend (Last 12 Weeks) ========
    const weeklyTrend: { date: string; value: number }[] = [];
    const weeksToGenerate = 12;

    for (let i = weeksToGenerate - 1; i >= 0; i--) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - (i * 7));
      targetDate.setHours(23, 59, 59, 999);
      
      const weekLabel = targetDate.toLocaleDateString('default', { day: 'numeric', month: 'short' });

      const weekStockValues = await Promise.all(
        enrichedPortfolio.map(async (item) => {
          if (!item.stock) return 0;
          const priceRecord = await this.prisma.stockPrice.findFirst({
            where: {
              stockId: item.stockId,
              date: { lte: targetDate },
            },
            orderBy: { date: 'desc' },
          });

          let priceForWeek = item.currentPrice;
          if (priceRecord) {
            priceForWeek = priceRecord.price;
          } else {
            const oldestPrice = await this.prisma.stockPrice.findFirst({
              where: { stockId: item.stockId },
              orderBy: { date: 'asc' },
            });
            if (oldestPrice) {
              priceForWeek = oldestPrice.price;
            }
          }
          return priceForWeek * item.quantity;
        })
      );

      weeklyTrend.push({
        date: weekLabel,
        value: weekStockValues.reduce((sum, val) => sum + val, 0),
      });
    }

    // ======== Generate Portfolio Trend (Last 5 Years) ========
    const yearlyTrend: { date: string; value: number }[] = [];
    const yearsToGenerate = 5;

    for (let i = yearsToGenerate - 1; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear() - i, 11, 31, 23, 59, 59, 999); // Dec 31st
      const yearLabel = targetDate.getFullYear().toString();

      const yearStockValues = await Promise.all(
        enrichedPortfolio.map(async (item) => {
          if (!item.stock) return 0;
          const priceRecord = await this.prisma.stockPrice.findFirst({
            where: { stockId: item.stockId, date: { lte: targetDate } },
            orderBy: { date: 'desc' },
          });

          let priceForYear = item.currentPrice;
          if (priceRecord) priceForYear = priceRecord.price;
          else {
            const oldestPrice = await this.prisma.stockPrice.findFirst({
               where: { stockId: item.stockId }, orderBy: { date: 'asc' },
            });
            if (oldestPrice) priceForYear = oldestPrice.price;
          }
          return priceForYear * item.quantity;
        })
      );

      yearlyTrend.push({ date: yearLabel, value: yearStockValues.reduce((sum, val) => sum + val, 0) });
    }

    const todayValue = dailyTrend[dailyTrend.length - 1]?.value || 0;
    const yesterdayValue = dailyTrend[dailyTrend.length - 2]?.value || 0;
    let todayReturn = 0;
    if (yesterdayValue > 0) {
      todayReturn = ((todayValue - yesterdayValue) / yesterdayValue) * 100;
      todayReturn = parseFloat(todayReturn.toFixed(2));
    }

    return {
      holdings: enrichedPortfolio,
      summary: {
        totalCurrentValue,
        totalInvestedValue,
        totalProfitLoss,
        totalProfitLossPercentage: parseFloat(
          totalProfitLossPercentage.toFixed(2),
        ),
        totalHoldings: enrichedPortfolio.length,
        todayReturn,
        dailyTrend,
        weeklyTrend,
        trend,
        yearlyTrend,
      },
    };
  }

  /**
   * Get portfolio for a specific user (Admin endpoint)
   * @param userId - User ID
   * @returns User's portfolio
   */
  async getUserPortfolioAdmin(userId: string) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        kycStatus: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const portfolioData = await this.getUserPortfolio(userId);

    return {
      user,
      ...portfolioData,
    };
  }

  /**
   * Get all portfolios (Admin endpoint)
   * Returns summary of all users with portfolios
   */
  async getAllPortfolios() {
    const portfolios = await this.prisma.portfolio.findMany({
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // Group by user
    const userPortfolios = portfolios.reduce((acc, item) => {
      if (!acc[item.userId]) {
        acc[item.userId] = {
          user: item.user,
          holdings: [],
          totalQuantity: 0,
        };
      }
      acc[item.userId].holdings.push(item);
      acc[item.userId].totalQuantity += item.quantity;
      return acc;
    }, {} as any);

    return Object.values(userPortfolios);
  }
}
