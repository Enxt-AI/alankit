/**
 * TanStack Query hooks for user watchlist
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { getWatchlist, toggleWatchlist } from '@/lib/stocks-api';
import type { ToggleWatchlistResponse, WatchlistEntry, WatchlistStock } from '@/lib/stocks-api';
import { useAuthStore } from '@/store/auth-store';
import type { Stock, UpcomingStock } from '@/types/stock';

/**
 * A stock payload that is sufficient to toggle watchlist state.
 *
 * Rationale:
 * - The watchlist query returns `WatchlistStock` (a smaller shape than the full `Stock` type).
 * - The stock listing / details pages use `Stock`.
 * - The toggle endpoint only needs `stock.id` for the network call.
 * - Our optimistic cache update needs a consistent `WatchlistStock` shape, so we map either input
 *   into `WatchlistStock` before writing to the query cache.
 */
type ToggleableStock = Stock | WatchlistStock | UpcomingStock;

export function useWatchlist(enabled?: boolean): UseQueryResult<WatchlistEntry[], Error> {
  const userId = useAuthStore((state) => state.user?.id);

  return useQuery({
    queryKey: ['watchlist', userId],
    queryFn: () => getWatchlist(userId),
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: !!userId && (enabled ?? true),
  });
}

export function useToggleWatchlist(): UseMutationResult<
  ToggleWatchlistResponse,
  Error,
  { stock: ToggleableStock; stockType?: 'regular' | 'upcoming' }
> {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);

  return useMutation({
    mutationFn: ({ stock, stockType }: { stock: ToggleableStock; stockType?: 'regular' | 'upcoming' }) =>
      toggleWatchlist(stock.id, userId, stockType),
    onMutate: async ({ stock, stockType }: { stock: ToggleableStock; stockType?: 'regular' | 'upcoming' }) => {
      if (!userId) return;

      await queryClient.cancelQueries({ queryKey: ['watchlist', userId] });
      const previousWatchlist = queryClient.getQueryData<WatchlistEntry[]>(['watchlist', userId]);

      const existing = previousWatchlist ?? [];
      const alreadyInWatchlist =
        stockType === 'upcoming'
          ? existing.some((entry) => entry.upcomingStock?.id === stock.id)
          : existing.some((entry) => entry.stock.id === stock.id);

      const optimisticStock: WatchlistStock = {
        id: stock.id,
        name: stock.name,
        cin: stock.cin ?? '',
        price: stock.price,
        // Upcoming stocks no longer expose a description field. We keep the
        // watchlist payload stable by normalizing any missing description to null.
        description: (stock as { description?: string | null }).description ?? null,
        logoUrl: stock.logoUrl ?? null,
        totalShares: stock.totalShares ?? null,
        isActive: stock.isActive,
        createdAt: stock.createdAt,
        updatedAt: stock.updatedAt,
        marketCap: stock.marketCap ?? null,
      };

      const nextWatchlist: WatchlistEntry[] = alreadyInWatchlist
        ? existing.filter((entry) => {
            if (stockType === 'upcoming') {
              return entry.upcomingStock?.id !== stock.id;
            }
            return entry.stock.id !== stock.id;
          })
        : [
            {
              addedAt: new Date().toISOString(),
              stock: optimisticStock,
              ...(stockType === 'upcoming' ? { upcomingStock: optimisticStock } : {}),
            },
            ...existing,
          ];

      queryClient.setQueryData<WatchlistEntry[]>(['watchlist', userId], nextWatchlist);

      return { previousWatchlist };
    },
    onError: (_error, _variables, context: any) => {
      if (!userId) return;
      if (context?.previousWatchlist) {
        queryClient.setQueryData<WatchlistEntry[]>(['watchlist', userId], context.previousWatchlist);
      }
    },
    onSettled: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['watchlist', userId] });
    },
  });
}
