/**
 * TanStack Query hooks for admin upcoming stock management
 * Mirrors the patterns used by use-admin-stocks.ts
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/components/ui/floating-notification';
import {
  getAllUpcomingStocksAdmin,
  getAllUpcomingStocksCms,
  createUpcomingStock,
  createUpcomingStockCms,
  updateUpcomingStock,
  updateUpcomingStockCms,
  deleteUpcomingStock,
  deleteUpcomingStockCms,
} from '@/lib/upcoming-stocks-api';
import { convertUpcomingToRegular, convertUpcomingToRegularCms } from '@/lib/stocks-api';
import type { CreateUpcomingStockDto, UpdateUpcomingStockDto, UpcomingStock } from '@/types/stock';

export function useAdminUpcomingStocks(enabled?: boolean, useCmsEndpoint?: boolean) {
  return useQuery({
    queryKey: ['admin', 'upcoming-stocks'],
    queryFn: useCmsEndpoint ? getAllUpcomingStocksCms : getAllUpcomingStocksAdmin,
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: enabled ?? true,
  });
}

export function useCreateUpcomingStock(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  // Note: no success popup here — UpcomingStockForm confirms (approval text on CMS path).
  return useMutation({
    mutationFn: (dto: CreateUpcomingStockDto) =>
      useCmsEndpoint ? createUpcomingStockCms(dto) : createUpcomingStock(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'upcoming-stocks'] });
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}

export function useUpdateUpcomingStock(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUpcomingStockDto }) =>
      useCmsEndpoint ? updateUpcomingStockCms(id, dto) : updateUpcomingStock(id, dto),
    // NOTE: CMS responses are approval envelopes — use variables for the id.
    // No success popup here — UpcomingStockForm confirms (approval text on CMS path).
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'upcoming-stocks'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-stock', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'upcoming-stock', variables.id] });
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}

export function useDeleteUpcomingStock(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  // Note: no success popup here — UpcomingStockDeleteDialog confirms (approval text on CMS path).
  return useMutation({
    mutationFn: (id: string) =>
      useCmsEndpoint ? deleteUpcomingStockCms(id) : deleteUpcomingStock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'upcoming-stocks'] });
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}

export function useConvertUpcomingStock(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      useCmsEndpoint ? convertUpcomingToRegularCms(id) : convertUpcomingToRegular(id),
    onMutate: async (upcomingId) => {
      await queryClient.cancelQueries({ queryKey: ['upcoming-stock', upcomingId], exact: false });
      await queryClient.cancelQueries({ queryKey: ['admin', 'upcoming-stock', upcomingId], exact: false });
    },
    onSuccess: (_result, upcomingId) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'upcoming-stocks'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stocks'] });

      // Note: the upcoming-stock row is hard-deleted.
      // We intentionally do NOT invalidate/remove the active details query here.
      // Removing it while the details page is mounted can cause an immediate refetch -> 404.

      notify.success('Upcoming stock converted successfully');
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}
