import { supportTicketsApi } from './support-tickets-api';
import { SupportTicketStats, SupportStatsFilters } from 'stats-types';

// Re-export for backward compatibility
export type { SupportStatsFilters };

/**
 * Get comprehensive support ticket statistics
 *
 * Fetches KPI metrics and chart data for the support dashboard.
 * Supports optional filtering by date range and agent.
 *
 * @param filters - Optional filters for date range and agent
 * @returns Promise<SupportTicketStats> - Complete statistics object
 * @throws Error if the API request fails
 *
 * @example
 * ```typescript
 * // Get all stats
 * const stats = await getSupportTicketStats();
 *
 * // Get stats for specific agent
 * const agentStats = await getSupportTicketStats({ agentId: 'agent-123' });
 *
 * // Get stats for date range
 * const dateStats = await getSupportTicketStats({
 *   dateFrom: '2024-01-01',
 *   dateTo: '2024-01-31'
 * });
 * ```
 */
export async function getSupportTicketStats(
  filters: SupportStatsFilters = {}
): Promise<SupportTicketStats> {
  try {
    // Build query parameters - convert Date objects to ISO strings
    const params = new URLSearchParams();

    if (filters.dateFrom) {
      const dateStr = filters.dateFrom instanceof Date ? filters.dateFrom.toISOString() : filters.dateFrom;
      params.append('dateFrom', dateStr);
    }
    if (filters.dateTo) {
      const dateStr = filters.dateTo instanceof Date ? filters.dateTo.toISOString() : filters.dateTo;
      params.append('dateTo', dateStr);
    }
    if (filters.agentId) params.append('agentId', filters.agentId);

    const queryString = params.toString();
    const url = `/tickets/stats${queryString ? `?${queryString}` : ''}`;

    const response = await supportTicketsApi.get(url);

    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch support ticket stats:', error);

    // Provide user-friendly error messages
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please log in to access support statistics.');
    }

    if (error.response?.status === 403) {
      throw new Error('Insufficient permissions to access support statistics.');
    }

    if (error.response?.status === 500) {
      throw new Error('Server error occurred while fetching statistics. Please try again later.');
    }

    // Generic error for network issues or unexpected errors
    throw new Error(
      error.response?.data?.message ||
      error.message ||
      'Failed to load support ticket statistics. Please check your connection and try again.'
    );
  }
}