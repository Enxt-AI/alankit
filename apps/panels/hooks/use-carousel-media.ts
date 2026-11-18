/**
 * Carousel Media Hooks
 * 
 * TanStack Query hooks for carousel media management.
 * Provides query hooks for fetching and mutation hooks for CRUD operations.
 * 
 * Cache Invalidation Strategy:
 * - Create/Delete/Reorder operations: Invalidate entire list cache ['cms', 'carousel']
 * - Update operations: Invalidate list cache to refetch updated items
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/components/ui/floating-notification';
import type { CarouselMedia, CreateCarouselMediaDto, UpdateCarouselMediaDto } from '@/types/carousel';
import {
  getAllCarouselMediaCms,
  createCarouselMediaCms,
  updateCarouselMediaCms,
  deleteCarouselMediaCms,
  reorderCarouselMediaCms,
} from '@/lib/carousel-api';

// ============================================
// CAROUSEL QUERY HOOKS
// ============================================

/**
 * Fetch all carousel media items (active + inactive) via CMS endpoint.
 * Cache key: ['cms', 'carousel']
 * Stale time: 2 minutes
 */
export function useCmsCarouselMedia(enabled?: boolean) {
  return useQuery<CarouselMedia[], Error>({
    queryKey: ['cms', 'carousel'],
    queryFn: getAllCarouselMediaCms,
    enabled: typeof enabled === 'boolean' ? enabled : true,
    staleTime: 2 * 60 * 1000,
  });
}

// ============================================
// CAROUSEL MUTATION HOOKS
// ============================================

/** Create a new carousel media item. Invalidates: ['cms', 'carousel'] */
export function useCreateCarouselMedia() {
  const queryClient = useQueryClient();

  return useMutation<CarouselMedia, Error, CreateCarouselMediaDto>({
    mutationFn: createCarouselMediaCms,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'carousel'] });
      notify.success('Carousel media created successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to create carousel media');
    },
  });
}

/** Update a carousel media item. Invalidates: ['cms', 'carousel'] */
export function useUpdateCarouselMedia() {
  const queryClient = useQueryClient();

  return useMutation<CarouselMedia, Error, { id: string; dto: UpdateCarouselMediaDto }>({
    mutationFn: ({ id, dto }) => updateCarouselMediaCms(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'carousel'] });
      notify.success('Carousel media updated successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to update carousel media');
    },
  });
}

/** Delete a carousel media item. Invalidates: ['cms', 'carousel'] */
export function useDeleteCarouselMedia() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: deleteCarouselMediaCms,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'carousel'] });
      notify.success('Carousel media deleted successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to delete carousel media');
    },
  });
}

/** Reorder carousel media items. Invalidates: ['cms', 'carousel'] */
export function useReorderCarouselMedia() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, { id: string; displayOrder: number }[]>({
    mutationFn: reorderCarouselMediaCms,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'carousel'] });
      notify.success('Carousel order updated');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to reorder carousel media');
    },
  });
}
