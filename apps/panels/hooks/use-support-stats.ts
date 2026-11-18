import { useQuery } from '@tanstack/react-query';
import { getSupportTicketStats, SupportStatsFilters } from '@/lib/support-stats-api';
import type { SupportTicketStats } from 'stats-types';

/**
 * TanStack Query hook for fetching support ticket statistics
 *
 * Provides cached access to support dashboard KPIs and chart data.
 * Automatically handles loading states, error handling, and cache invalidation.
 *
 * @param filters - Optional filters for date range and agent
 * @returns TanStack Query result with SupportTicketStats data
 *
 * @example
 * ```tsx
 * // Basic usage - get all stats
 * const { data, isLoading, error } = useSupportTicketStats();
 *
 * // With filters
 * const { data, isLoading, error } = useSupportTicketStats({
 *   dateFrom: '2024-01-01',
 *   agentId: 'agent-123'
 * });
 *
 * // Handle loading state
 * if (isLoading) return <div>Loading stats...</div>;
 *
 * // Handle error state
 * if (error) return <div>Error: {error.message}</div>;
 *
 * // Use the data
 * return <div>Total Tickets: {data.totalTickets}</div>;
 * ```
 */
export function useSupportTicketStats(filters: SupportStatsFilters = {}) {
  return useQuery<SupportTicketStats, Error>({
    queryKey: ['support', 'stats', filters],
    queryFn: () => getSupportTicketStats(filters),
    staleTime: 60000, // 1 minute - stats don't change extremely frequently
    refetchOnWindowFocus: false, // Don't refetch on window focus for stats
  });
}