/**
 * TanStack Query hooks for admin basket management - Handles fetching, creating, updating, and deleting baskets with automatic cache invalidation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import {
  getAllBasketsAdmin,
  createBasketAdmin,
  updateBasketAdmin,
  deleteBasketAdmin,
} from '@/lib/admin-api';
import type {
  CreateBasketDto,
  UpdateBasketDto,
  StockBasket,
  BasketWithConstituents,
} from '@/types/basket';

/**
 * Fetch all baskets including inactive ones (Admin view)
 *
 * Cache key: ['admin', 'baskets']
 * Stale time: 2 minutes
 *
 * @param enabled - Whether the query should run (default: true)
 * @returns UseQueryResult<BasketWithConstituents[], Error>
 */
export function useAdminBaskets(enabled?: boolean): UseQueryResult<BasketWithConstituents[], Error> {
  return useQuery({
    queryKey: ['admin', 'baskets'],
    queryFn: getAllBasketsAdmin,
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: enabled ?? true,
  });
}

/**
 * Create a new basket
 *
 * Invalidates:
 * - ['admin', 'baskets'] - Admin basket list
 * - ['baskets'] - Public basket list
 *
 * @returns UseMutationResult<StockBasket, Error, CreateBasketDto>
 */
export function useCreateAdminBasket(): UseMutationResult<StockBasket, Error, CreateBasketDto> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateBasketDto) => createBasketAdmin(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'baskets'] });
      queryClient.invalidateQueries({ queryKey: ['baskets'] });
    },
  });
}

/**
 * Update an existing basket
 *
 * Invalidates:
 * - ['admin', 'baskets'] - Admin basket list
 * - ['baskets'] - Public basket list
 * - ['basket', id] - Individual basket cache
 *
 * @returns UseMutationResult<StockBasket, Error, { id: string; dto: UpdateBasketDto }>
 */
export function useUpdateAdminBasket(): UseMutationResult<
  StockBasket,
  Error,
  { id: string; dto: UpdateBasketDto }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateBasketDto }) => updateBasketAdmin(id, dto),
    onSuccess: (updatedBasket: StockBasket) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'baskets'] });
      queryClient.invalidateQueries({ queryKey: ['baskets'] });
      queryClient.invalidateQueries({ queryKey: ['basket', updatedBasket.id] });
    },
  });
}

/**
 * Delete a basket (soft delete)
 *
 * Invalidates:
 * - ['admin', 'baskets'] - Admin basket list
 * - ['baskets'] - Public basket list
 *
 * @returns UseMutationResult<{ success: boolean; message: string }, Error, string>
 */
export function useDeleteAdminBasket(): UseMutationResult<
  { success: boolean; message: string },
  Error,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteBasketAdmin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'baskets'] });
      queryClient.invalidateQueries({ queryKey: ['baskets'] });
    },
  });
}
