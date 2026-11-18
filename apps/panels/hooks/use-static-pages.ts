import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/components/ui/floating-notification';
import type { StaticPage, CreateStaticPageDto, UpdateStaticPageDto } from '@/types/content';
import {
  getAllStaticPagesAdmin,
  getAllStaticPagesCms,
  createStaticPage,
  updateStaticPage,
  deleteStaticPage,
  createStaticPageCms,
  updateStaticPageCms,
  deleteStaticPageCms,
} from '@/lib/static-pages-api';

// ============================================
// STATIC PAGES QUERY HOOKS
// ============================================

/**
 * Fetch all static pages including inactive (Admin only)
 * Cache key: ['cms', 'static-pages']
 * Stale time: 2 minutes (content changes infrequently)
 * @param enabled - Optional flag to conditionally enable the query (defaults to true)
 * @param useCmsEndpoint - Optional flag to use CMS endpoint instead of Admin endpoint (defaults to false). Lack of CMS permission will surface as an empty list rather than an error.
 */
export function useStaticPages(enabled?: boolean, useCmsEndpoint?: boolean) {
  return useQuery<StaticPage[], Error>({
    queryKey: ['cms', 'static-pages'],
    queryFn: useCmsEndpoint ? getAllStaticPagesCms : getAllStaticPagesAdmin,
    enabled: typeof enabled === 'boolean' ? enabled : true, // Explicit: only true if explicitly true; false disables
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// ============================================
// STATIC PAGES MUTATION HOOKS
// ============================================

/**
 * Create new static page (Admin only)
 * Invalidates: ['cms', 'static-pages'] cache on success
 */
export function useCreateStaticPage(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation<StaticPage, Error, CreateStaticPageDto>({
    mutationFn: useCmsEndpoint ? createStaticPageCms : createStaticPage,
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'static-pages'] });
      notify.success(useCmsEndpoint ? (result?.message || 'Static page creation submitted for admin approval') : 'Static page created successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to create static page');
    },
  });
}

/**
 * Update existing static page (Admin only)
 * Invalidates: ['cms', 'static-pages'] cache on success
 */
export function useUpdateStaticPage(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation<StaticPage, Error, { id: string; dto: UpdateStaticPageDto }>({
    mutationFn: ({ id, dto }) => useCmsEndpoint ? updateStaticPageCms(id, dto) : updateStaticPage(id, dto),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'static-pages'] });
      notify.success(useCmsEndpoint ? (result?.message || 'Static page update submitted for admin approval') : 'Static page updated successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to update static page');
    },
  });
}

/**
 * Delete static page (Admin only) - Hard delete
 * Invalidates: ['cms', 'static-pages'] cache on success
 */
export function useDeleteStaticPage(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, string>({
    mutationFn: (id: string) => useCmsEndpoint ? deleteStaticPageCms(id) : deleteStaticPage(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'static-pages'] });
      notify.success(useCmsEndpoint ? (result?.message || 'Static page deletion submitted for admin approval') : 'Static page deleted successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to delete static page');
    },
  });
}