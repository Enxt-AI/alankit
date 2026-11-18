import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupportTicketStats, SupportStatsFilters } from 'stats-types';

interface TicketWhereInput {
  createdAt?: {
    gte?: Date;
    lt?: Date;
  };
  resolvedAt?: {
    gte?: Date;
    lt?: Date;
    not?: null;
  };
  dueDate?: {
    lt?: Date;
  };
  assignedTo?: string;
  status?: {
    in?: string[];
    notIn?: string[];
  };
}

/**
 * ReportService
 *
 * Provides aggregated statistics for support ticket analytics.
 * Handles KPI calculations and chart data generation.
 */
@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get comprehensive ticket statistics with optional filters
   *
   * Date range filters apply differently based on metric type:
   * - Volume metrics (totalTickets, openTickets, slaBreached, charts): Filter by createdAt
   * - Resolution metrics (resolvedToday, avgResolutionTime, slaCompliance, resolutionTrend): Filter by resolvedAt
   *
   * @param filters - Optional filters for date range and agent
   * @returns Promise<SupportTicketStats> - Complete statistics object
   *
   * @example
   * // Get stats for last week
   * const stats = await getTicketStats({
   *   dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
   *   dateTo: new Date()
   * });
   */
  async getTicketStats(
    filters: SupportStatsFilters = {},
  ): Promise<SupportTicketStats> {
    const { dateFrom, dateTo, agentId } = filters;

    // Convert string dates to Date objects
    const dateFromObj = dateFrom ? new Date(dateFrom) : undefined;
    const dateToObj = dateTo ? new Date(dateTo) : undefined;

    // Build where clauses for different metric types
    const volumeWhere: TicketWhereInput = {}; // For createdAt-based metrics
    const resolutionWhere: TicketWhereInput = {}; // For resolvedAt-based metrics

    // Volume metrics filter by createdAt
    if (dateFromObj || dateToObj) {
      volumeWhere.createdAt = {};
      if (dateFromObj) volumeWhere.createdAt.gte = dateFromObj;
      if (dateToObj) volumeWhere.createdAt.lt = dateToObj;
    }

    // Resolution metrics filter by resolvedAt
    if (dateFromObj || dateToObj) {
      resolutionWhere.resolvedAt = {};
      if (dateFromObj) resolutionWhere.resolvedAt.gte = dateFromObj;
      if (dateToObj) resolutionWhere.resolvedAt.lt = dateToObj;
      resolutionWhere.resolvedAt = { not: null, ...resolutionWhere.resolvedAt }; // Ensure resolved
    } else {
      resolutionWhere.resolvedAt = { not: null }; // Always require resolution for these metrics
    }

    // Apply agentId to both where clauses
    if (agentId) {
      volumeWhere.assignedTo = agentId;
      resolutionWhere.assignedTo = agentId;
    }

    // Execute all aggregations in parallel for performance
    const [
      totalTickets,
      openTickets,
      resolvedToday,
      avgResolutionTime,
      ticketsByStatus,
      ticketsByPriority,
      resolutionTrend,
    ] = await Promise.all([
      // Total tickets count - volume metric, filter by createdAt
      this.prisma.ticket.count({ where: volumeWhere }),

      // Open tickets (open + in-progress) - volume metric, filter by createdAt
      this.prisma.ticket.count({
        where: {
          ...volumeWhere,
          status: { in: ['open', 'in-progress'] },
        },
      }),

      // Resolved today - resolution metric, filter by resolvedAt (today only)
      this.prisma.ticket.count({
        where: {
          ...resolutionWhere,
          resolvedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      }),

      // Average resolution time (in hours) for resolved tickets - resolution metric
      this.calculateAvgResolutionTime(resolutionWhere),

      // Tickets by status - volume metric, filter by createdAt
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: volumeWhere,
        _count: { status: true },
        orderBy: { _count: { status: 'desc' } },
      }),

      // Tickets by priority - volume metric, filter by createdAt
      this.prisma.ticket.groupBy({
        by: ['priority'],
        where: volumeWhere,
        _count: { priority: true },
        orderBy: { _count: { priority: 'desc' } },
      }),

      // Resolution trend (last 30 days or specified range) - resolution metric
      this.getResolutionTrend(resolutionWhere, dateFromObj, dateToObj),
    ]);

    return {
      totalTickets,
      openTickets,
      resolvedToday,
      slaBreached: 0,
      avgResolutionTime,
      slaCompliance: 0,
      ticketsByStatus: ticketsByStatus.map((item) => ({
        status: item.status,
        count: item._count.status,
      })),
      ticketsByPriority: ticketsByPriority.map((item) => ({
        priority: item.priority,
        count: item._count.priority,
      })),
      resolutionTrend,
    };
  }

  /**
   * Calculate average resolution time in hours
   */
  private async calculateAvgResolutionTime(
    baseWhere: TicketWhereInput,
  ): Promise<number> {
    const resolvedTickets = await this.prisma.ticket.findMany({
      where: {
        ...baseWhere,
        resolvedAt: { not: null },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    if (resolvedTickets.length === 0) return 0;

    const totalHours = resolvedTickets.reduce((sum, ticket) => {
      const resolutionTime =
        ticket.resolvedAt.getTime() - ticket.createdAt.getTime();
      return sum + resolutionTime / (1000 * 60 * 60); // Convert to hours
    }, 0);

    return totalHours / resolvedTickets.length;
  }


  /**
   * Get resolution trend data for the specified date range.
   * If no date range is provided, defaults to the last 30 days.
   * Returns daily resolution counts with missing dates filled with 0.
   */
  private async getResolutionTrend(
    baseWhere: TicketWhereInput,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<Array<{ date: string; count: number }>> {
    // Determine the date range for the trend
    let trendStartDate: Date;
    let trendEndDate: Date;

    if (dateFrom && dateTo) {
      // Use the provided date range
      trendStartDate = dateFrom;
      trendEndDate = dateTo;
    } else {
      // Default to last 30 days
      trendEndDate = new Date();
      trendStartDate = new Date();
      trendStartDate.setDate(trendStartDate.getDate() - 30);
    }

    const trendData = await this.prisma.ticket.groupBy({
      by: ['resolvedAt'],
      where: {
        ...baseWhere,
        resolvedAt: {
          gte: trendStartDate,
          lt: trendEndDate,
        },
      },
      _count: { resolvedAt: true },
      orderBy: { resolvedAt: 'asc' },
    });

    // Group by date and aggregate counts
    const dateMap = new Map<string, number>();

    trendData.forEach((item) => {
      if (item.resolvedAt) {
        const dateKey = item.resolvedAt.toISOString().split('T')[0]; // YYYY-MM-DD format
        dateMap.set(
          dateKey,
          (dateMap.get(dateKey) || 0) + item._count.resolvedAt,
        );
      }
    });

    // Fill in missing dates with 0
    const result: Array<{ date: string; count: number }> = [];
    const daysDiff = Math.ceil(
      (trendEndDate.getTime() - trendStartDate.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    for (let i = daysDiff - 1; i >= 0; i--) {
      const date = new Date(trendEndDate);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      result.push({
        date: dateKey,
        count: dateMap.get(dateKey) || 0,
      });
    }

    return result;
  }
}
