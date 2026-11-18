/**
 * TanStack Query hooks for fetching admin dashboard statistics
 */

import { useQuery } from '@tanstack/react-query';
import { getStocksServiceStats, getAuthServiceStats, getMarketingStats } from '@/lib/stats-api';
import type { StocksServiceStats, AuthServiceStats, MarketingStats } from '@/types/stats';

/**
 * Hook to fetch statistics from stocks-service
 * Includes counts for stocks, orders, and referrals
 * 
 * @returns TanStack Query result with stocks service stats
 */
export function useStocksServiceStats() {
  return useQuery<StocksServiceStats>({
    queryKey: ['admin', 'stats', 'stocks-service'],
    queryFn: getStocksServiceStats,
    staleTime: 60000, // 1 minute - fresher data for dashboard stats
  });
}

/**
 * Hook to fetch statistics from auth-service
 * Includes counts for users and admins
 * 
 * @returns TanStack Query result with auth service stats
 */
export function useAuthServiceStats() {
  return useQuery<AuthServiceStats>({
    queryKey: ['admin', 'stats', 'auth-service'],
    queryFn: getAuthServiceStats,
    staleTime: 60000, // 1 minute - fresher data for dashboard stats
  });
}

/**
 * Hook to fetch marketing statistics
 * Includes lead counts, conversion metrics, and campaign performance
 * 
 * @returns TanStack Query result with marketing stats
 */
export function useMarketingStats() {
  return useQuery<MarketingStats>({
    queryKey: ['admin', 'stats', 'marketing'],
    queryFn: getMarketingStats,
    staleTime: 60000, // 1 minute, consistent with other stats
  });
}
