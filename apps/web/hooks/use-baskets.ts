/**
 * TanStack Query hooks for basket data fetching - Provides declarative API for fetching baskets with automatic caching
 */

import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { getAllBaskets, getBasketById } from '@/lib/baskets-api';
import type { BasketWithConstituents } from '@/types/basket';

/**
 * Hook to fetch all active baskets with constituents and calculated prices
 * 
 * Cache key: ['baskets']
 * Stale time: 5 minutes
 * Garbage collection: 10 minutes
 * 
 * Explicit options ensure consistent behavior:
 * - staleTime: Data considered fresh for 5 minutes
 * - gcTime: Unused data kept in cache for 10 minutes
 * - refetchOnWindowFocus: Disabled to prevent unnecessary refetches
 * - retry: Single retry on failure
 * 
 * @returns UseQueryResult<BasketWithConstituents[], Error>
 */
export function useBaskets(): UseQueryResult<BasketWithConstituents[], Error> {
  return useQuery({
    queryKey: ['baskets'],
    queryFn: getAllBaskets,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * Hook to fetch single basket details by ID with constituents and calculated price
 * 
 * Cache key: ['basket', id]
 * Stale time: 5 minutes
 * Garbage collection: 10 minutes
 * 
 * Explicit options ensure consistent behavior:
 * - staleTime: Data considered fresh for 5 minutes
 * - gcTime: Unused data kept in cache for 10 minutes
 * - refetchOnWindowFocus: Disabled to prevent unnecessary refetches
 * - retry: Single retry on failure
 * - enabled: Only runs if id is provided
 * 
 * @param id - Basket ID
 * @returns UseQueryResult<BasketWithConstituents, Error>
 */
export function useBasket(id: string): UseQueryResult<BasketWithConstituents, Error> {
  return useQuery({
    queryKey: ['basket', id],
    queryFn: () => getBasketById(id),
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: !!id,
  });
}
