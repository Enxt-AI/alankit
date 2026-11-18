/**
 * Shared TypeScript interfaces for statistics and analytics
 *
 * This package contains common type definitions used across
 * multiple services for statistics and analytics functionality.
 */

/**
 * Statistics for support ticket dashboard
 * Includes KPIs and chart data for ticket analytics
 */
export interface SupportTicketStats {
  /** Total ticket count */
  totalTickets: number;

  /** Open + in-progress tickets */
  openTickets: number;

  /** Tickets resolved today */
  resolvedToday: number;

  /** Tickets past SLA deadline */
  slaBreached: number;

  /** Average resolution time in hours */
  avgResolutionTime: number;

  /** SLA compliance percentage (0-100) */
  slaCompliance: number;

  /** Status distribution */
  ticketsByStatus: Array<{ status: string; count: number }>;

  /** Priority breakdown */
  ticketsByPriority: Array<{ priority: string; count: number }>;

  /** Daily resolution counts */
  resolutionTrend: Array<{ date: string; count: number }>;
}

/**
 * Query parameters for support ticket statistics
 */
export interface SupportStatsFilters {
  /** Start date for filtering tickets */
  dateFrom?: Date;
  /** End date for filtering tickets */
  dateTo?: Date;
  /** Agent ID for filtering by assigned support agent */
  agentId?: string;
}