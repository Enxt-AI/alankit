/**
 * TanStack Query hooks for upcoming stock data fetching
 * Mirrors the patterns used by use-stocks.ts
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAllUpcomingStocks, getUpcomingStockById, getWatchlist } from '@/lib/stocks-api';
import type { UpcomingStock } from '@/types/stock';
import { useAuthStore } from '@/store/auth-store';
import { useWatchlist } from '@/hooks/useWatchlist';

export type UpcomingStockWithWatchlist = UpcomingStock & {
  isInWatchlist?: boolean;
};

export function useUpcomingStocks(options?: { includeWatchlist?: boolean; enabled?: boolean }) {
  const userId = useAuthStore((state) => state.user?.id);
  const includeWatchlist = options?.includeWatchlist === true;

  return useQuery<UpcomingStockWithWatchlist[], Error>({
    queryKey:
      includeWatchlist && userId
        ? ['upcoming-stocks', 'withWatchlist', userId]
        : ['upcoming-stocks'],
    queryFn: async () => {
      const stocks = await getAllUpcomingStocks();

      if (!includeWatchlist || !userId) {
        return stocks;
      }

      const watchlist = await getWatchlist(userId);
      const watchlistedUpcomingStockIds = new Set(
        watchlist
          .filter((item) => !!item.upcomingStock)
          .map((item) => item.upcomingStock!.id),
      );

      return stocks.map((stock) => ({
        ...stock,
        isInWatchlist: watchlistedUpcomingStockIds.has(stock.id),
      }));
    },
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: options?.enabled ?? true,
  });
}

export function useUpcomingStock(id: string) {
  return useUpcomingStockWithWatchlist(id);
}

export function useUpcomingStockWithWatchlist(
  id: string,
  options?: { includeWatchlist?: boolean },
) {
  const userId = useAuthStore((state) => state.user?.id);
  const includeWatchlist = options?.includeWatchlist === true;

  const watchlistQuery = useWatchlist(includeWatchlist);

  const stockQuery = useQuery<UpcomingStock, Error>({
    queryKey: ['upcoming-stock', id],
    queryFn: () => getUpcomingStockById(id),
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: !!id,
  });

  const isInWatchlist = useMemo(() => {
    if (!includeWatchlist || !userId) return undefined;
    const watchlist = watchlistQuery.data ?? [];
    return watchlist.some((entry) => entry.upcomingStock?.id === id);
  }, [includeWatchlist, id, userId, watchlistQuery.data]);

  const data = useMemo<UpcomingStockWithWatchlist | undefined>(() => {
    if (!stockQuery.data) return undefined;
    return {
      ...stockQuery.data,
      isInWatchlist,
    };
  }, [isInWatchlist, stockQuery.data]);

  return {
    ...stockQuery,
    data,
  };
}
