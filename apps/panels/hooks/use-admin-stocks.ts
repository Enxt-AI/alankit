/**
 * TanStack Query hooks for admin stock management
 * Handles fetching, creating, updating, and deleting stocks
 * with automatic cache invalidation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  getAllStocksAdmin, 
  getAllStocksCms,
  createStock, 
  createStockCms,
  updateStock, 
  updateStockCms,
  deleteStock,
  deleteStockCms
} from '@/lib/stocks-api';
import { CreateStockDto, UpdateStockDto, Stock } from '@/types/stock';

/**
 * Fetch all stocks including inactive ones (admin view)
 * Cache key: ['admin', 'stocks']
 * Stale time: 2 minutes
 * @param enabled - Optional flag to conditionally enable the query (defaults to true)
 * @param useCmsEndpoint - Optional flag to use CMS endpoint instead of Admin endpoint (defaults to false)
 */
export function useAdminStocks(enabled?: boolean, useCmsEndpoint?: boolean) {
  return useQuery({
    queryKey: ['admin', 'stocks'],
    queryFn: useCmsEndpoint ? getAllStocksCms : getAllStocksAdmin,
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: enabled ?? true,
  });
}

/**
 * Create a new stock
 * Invalidates: ['admin', 'stocks']
 * Optimized for admin stock management
 * @param useCmsEndpoint - Optional flag to use CMS endpoint instead of Admin endpoint (defaults to false)
 */
export function useCreateStock(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateStockDto) => useCmsEndpoint ? createStockCms(dto) : createStock(dto),
    onSuccess: () => {
      // Invalidate admin stocks list to refetch with new stock
      queryClient.invalidateQueries({ queryKey: ['admin', 'stocks'] });
    },
  });
}

/**
 * Update an existing stock
 * Invalidates: ['admin', 'stocks'] and ['stock', id]
 * Updates both admin list and individual stock cache
 * @param useCmsEndpoint - Optional flag to use CMS endpoint instead of Admin endpoint (defaults to false)
 */
export function useUpdateStock(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateStockDto }) =>
      useCmsEndpoint ? updateStockCms(id, dto) : updateStock(id, dto),
    // NOTE: use mutation variables for the id — CMS responses are approval
    // envelopes ({ message, changeRequest }), not Stock entities.
    onSuccess: (_result, variables) => {
      // Invalidate admin stocks list
      queryClient.invalidateQueries({ queryKey: ['admin', 'stocks'] });

      // Invalidate individual stock cache
      queryClient.invalidateQueries({ queryKey: ['stock', variables.id] });
    },
  });
}

/**
 * Delete a stock (soft delete)
 * Invalidates: ['admin', 'stocks']
 * Refetches admin list to reflect deletion
 * @param useCmsEndpoint - Optional flag to use CMS endpoint instead of Admin endpoint (defaults to false)
 */
export function useDeleteStock(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => useCmsEndpoint ? deleteStockCms(id) : deleteStock(id),
    onSuccess: () => {
      // Invalidate admin stocks list to refetch without deleted stock
      queryClient.invalidateQueries({ queryKey: ['admin', 'stocks'] });
    },
  });
}

// Re-export admin stock details hooks
export * from './use-admin-stock-details';