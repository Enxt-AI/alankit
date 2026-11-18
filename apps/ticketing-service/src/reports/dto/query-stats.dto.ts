import { IsOptional, IsDateString, IsString, IsUUID } from 'class-validator';

/**
 * QueryStatsDto
 *
 * DTO for validating query parameters for ticket statistics endpoint.
 * Used in ReportsController for GET /tickets/stats endpoint.
 *
 * Date range filters apply differently based on metric type:
 * - Volume metrics (totalTickets, openTickets, slaBreached, charts): Filter by ticket createdAt
 * - Resolution metrics (resolvedToday, avgResolutionTime, slaCompliance, resolutionTrend): Filter by ticket resolvedAt
 */
export class QueryStatsDto {
  /**
   * Start date for filtering tickets (ISO date string format)
   * Applied to createdAt for volume metrics, resolvedAt for resolution metrics
   * Optional - if not provided, no start date filter is applied
   */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  /**
   * End date for filtering tickets (ISO date string format)
   * Applied to createdAt for volume metrics, resolvedAt for resolution metrics
   * Optional - if not provided, no end date filter is applied
   */
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /**
   * Agent ID for filtering tickets by assigned support agent
   * Applies to all metrics when specified
   * Optional - if not provided, stats include all agents
   */
  @IsOptional()
  @IsString()
  @IsUUID()
  agentId?: string;
}
