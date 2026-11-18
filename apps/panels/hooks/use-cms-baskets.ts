/**
 * TanStack Query hooks for CMS basket management - Handles fetching, creating, updating, and deleting baskets with automatic cache invalidation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import {
  getAllBasketsCms,
  createBasketCms,
  updateBasketCms,
  deleteBasketCms,
} from '@/lib/baskets-api';
import type {
  CreateBasketDto,
  UpdateBasketDto,
  StockBasket,
  BasketWithConstituents,
} from '@/types/basket';

/**
 * Fetch all baskets including inactive ones (CMS view)
 *
 * Cache key: ['cms', 'baskets']
 * Stale time: 2 minutes
 *
 * @param enabled - Whether the query should run (default: true)
 * @returns UseQueryResult<BasketWithConstituents[], Error>
 */
export function useCMSBaskets(enabled?: boolean): UseQueryResult<BasketWithConstituents[], Error> {
  return useQuery({
    queryKey: ['cms', 'baskets'],
    queryFn: getAllBasketsCms,
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: enabled ?? true,
  });
}

/**
 * Create a new basket
 *
 * Invalidates:
 * - ['cms', 'baskets'] - CMS basket list
 * - ['baskets'] - Public basket list
 *
 * @returns UseMutationResult<StockBasket, Error, CreateBasketDto>
 */
export function useCreateCMSBasket(): UseMutationResult<StockBasket, Error, CreateBasketDto> {
  const queryClient = useQueryClient();

  // Note: no popup here — BasketForm confirms the approval submission itself.
  return useMutation({
    mutationFn: (dto: CreateBasketDto) => createBasketCms(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'baskets'] });
      queryClient.invalidateQueries({ queryKey: ['baskets'] });
    },
  });
}

/**
 * Update an existing basket
 *
 * Invalidates:
 * - ['cms', 'baskets'] - CMS basket list
 * - ['baskets'] - Public basket list
 * - ['basket', id] - Individual basket cache
 *
 * @returns UseMutationResult<StockBasket, Error, { id: string; dto: UpdateBasketDto }>
 */
export function useUpdateCMSBasket(): UseMutationResult<
  StockBasket,
  Error,
  { id: string; dto: UpdateBasketDto }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateBasketDto }) => updateBasketCms(id, dto),
    // NOTE: CMS responses are approval envelopes, not baskets — use variables for the id.
    // No popup here — BasketForm confirms the approval submission itself.
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'baskets'] });
      queryClient.invalidateQueries({ queryKey: ['baskets'] });
      queryClient.invalidateQueries({ queryKey: ['basket', variables.id] });
    },
  });
}

/**
 * Delete a basket (soft delete)
 *
 * Invalidates:
 * - ['cms', 'baskets'] - CMS basket list
 * - ['baskets'] - Public basket list
 *
 * @returns UseMutationResult<{ success: boolean; message: string }, Error, string>
 */
export function useDeleteCMSBasket(): UseMutationResult<
  { success: boolean; message: string },
  Error,
  string
> {
  const queryClient = useQueryClient();

  // Note: no popup here — BasketDeleteDialog confirms the approval submission itself.
  return useMutation({
    mutationFn: (id: string) => deleteBasketCms(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'baskets'] });
      queryClient.invalidateQueries({ queryKey: ['baskets'] });
    },
  });
}