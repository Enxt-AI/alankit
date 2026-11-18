/**
 * TanStack Query hooks for stock data fetching
 * Provides declarative API for fetching stocks with automatic caching
 */

import { useQuery } from '@tanstack/react-query';
import { getAllStocks, getStockById, getWatchlist, getStockPriceHistory, getStockCategories } from '@/lib/stocks-api';
import type { Stock, StockPrice } from '@/types/stock';
import { useAuthStore } from '@/store/auth-store';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useMemo } from 'react';

export type StockWithWatchlist = Stock & {
  isInWatchlist?: boolean;
};

export function useStockCategories() {
  return useQuery({
    queryKey: ['stock-categories'],
    queryFn: getStockCategories,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch all active stocks
 * 
 * PERFORMANCE: Uses the 'select' property to transform data.
 * This ensures the transformation only runs when the data actually changes.
 */
export function useStocks(options?: { includeWatchlist?: boolean }) {
  const userId = useAuthStore((state) => state.user?.id);
  const includeWatchlist = options?.includeWatchlist === true;

  // We fetch regular stocks and watchlist in parallel or use the cache
  const watchlistQuery = useWatchlist(includeWatchlist && !!userId);

  return useQuery<Stock[], Error, StockWithWatchlist[]>({
    queryKey: ['stocks'],
    queryFn: getAllStocks,
    select: (stocks) => {
      if (!includeWatchlist || !userId || !watchlistQuery.data) {
        return stocks as StockWithWatchlist[];
      }

      const watchlistedStockIds = new Set(
        watchlistQuery.data.map((item) => item.stock?.id || item.upcomingStock?.id)
      );

      return stocks.map((stock) => ({
        ...stock,
        isInWatchlist: watchlistedStockIds.has(stock.id),
      }));
    },
    staleTime: 60 * 1000, // 1 minute for public stocks
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch single stock details by ID
 * Returns extended data including directors, documents, and marketCap if available
 * @param id - Stock ID (CUID)
 * @returns Query result with stock data (now includes directors, documents, marketCap)
 */
export function useStock(id: string) {
  return useStockWithWatchlist(id);
}

/**
 * Stock details hook with optional watchlist awareness.
 *
 * Why this exists:
 * - The backend stock details endpoint is public and does not include user-specific state.
 * - Watchlist state is user-specific and comes from GET /watchlist.
 * - We want the Stock Details page to show watchlist state without inventing new endpoints.
 *
 * How it works:
 * - Always fetches the stock data via getStockById(id).
 * - Optionally derives `isInWatchlist` from the TanStack Query cache for `['watchlist', userId]`.
 *   This means the UI updates instantly when we optimistically update the watchlist cache.
 *
 * NOTE:
 * - This does NOT authenticate using userId; auth still happens via the axios interceptor's Bearer token.
 */
export function useStockWithWatchlist(id: string | undefined, options?: { includeWatchlist?: boolean; enabled?: boolean }) {
  const userId = useAuthStore((state) => state.user?.id);
  const includeWatchlist = options?.includeWatchlist === true;

  const watchlistQuery = useWatchlist(includeWatchlist && !!userId);

  return useQuery<Stock, Error, StockWithWatchlist>({
    queryKey: ['stock', id],
    queryFn: () => getStockById(id as string),
    select: (stock) => {
      const watchlist = watchlistQuery.data ?? [];
      const isInWatchlist = includeWatchlist && !!userId 
        ? watchlist.some((entry) => entry.stock?.id === id || entry.upcomingStock?.id === id)
        : undefined;

      return {
        ...stock,
        isInWatchlist,
      };
    },
    staleTime: 60 * 1000, 
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!id && id !== 'undefined' && id !== 'null' && options?.enabled !== false,
  });
}

/**
 * Hook to fetch stock price history
 * @param id - Stock ID (CUID)
 * @returns Query result with array of historical price points
 */
export function useStockPriceHistory(id: string | undefined) {
  return useQuery<StockPrice[], Error>({
    queryKey: ['stock', id, 'prices'],
    queryFn: () => getStockPriceHistory(id as string),
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: !!id,
  });
}
