/**
 * Admin Content Hooks
 * 
 * TanStack Query hooks for admin content management (news and articles)
 * Provides query hooks for fetching content and mutation hooks for CRUD operations
 * 
 * Cache Invalidation Strategy:
 * - Create/Delete operations: Invalidate entire list cache (['admin', 'news'] or ['admin', 'articles'])
 * - Update operations: Invalidate list cache to refetch updated items
 * - Separate cache keys for news and articles enable independent data management
 * 
 * Usage Example:
 * ```tsx
 * const { data: news, isLoading } = useAdminNews();
 * const createMutation = useCreateNews();
 * await createMutation.mutateAsync({ title: 'New Article', content: '...' });
 * ```
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/components/ui/floating-notification';
import type { News, Article, CreateNewsDto, UpdateNewsDto, CreateArticleDto, UpdateArticleDto } from '@/types/content';
import {
  getAllNewsAdmin,
  getAllNewsCms,
  createNews,
  updateNews,
  deleteNews,
  createNewsCms,
  updateNewsCms,
  deleteNewsCms,
  getAllArticlesAdmin,
  getAllArticlesCms,
  createArticle,
  updateArticle,
  deleteArticle,
  createArticleCms,
  updateArticleCms,
  deleteArticleCms,
} from '@/lib/content-api';

// ============================================
// NEWS QUERY HOOKS
// ============================================

/**
 * Fetch all news articles including inactive (Admin only)
 * Cache key: ['admin', 'news']
 * Stale time: 2 minutes (content changes less frequently than stocks)
 * @param enabled - Optional flag to conditionally enable the query (defaults to true)
 * @param useCmsEndpoint - Optional flag to use CMS endpoint instead of Admin endpoint (defaults to false). Lack of CMS permission will surface as an empty list rather than an error.
 */
export function useAdminNews(enabled?: boolean, useCmsEndpoint?: boolean) {
  return useQuery<News[], Error>({
    queryKey: ['admin', 'news'],
    queryFn: useCmsEndpoint ? getAllNewsCms : getAllNewsAdmin,
    enabled: typeof enabled === 'boolean' ? enabled : true, // Explicit: only true if explicitly true; false disables
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// ============================================
// NEWS MUTATION HOOKS
// ============================================

/**
 * Create new news article (Admin only)
 * Invalidates: ['admin', 'news'] cache on success
 */
export function useCreateNews(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation<News, Error, CreateNewsDto>({
    mutationFn: useCmsEndpoint ? createNewsCms : createNews,
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'news'] });
      notify.success(useCmsEndpoint ? (result?.message || 'News creation submitted for admin approval') : 'News article created successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to create news article');
    },
  });
}

/**
 * Update existing news article (Admin only)
 * Invalidates: ['admin', 'news'] cache on success
 */
export function useUpdateNews(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation<News, Error, { id: string; dto: UpdateNewsDto }>({
    mutationFn: ({ id, dto }) => useCmsEndpoint ? updateNewsCms(id, dto) : updateNews(id, dto),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'news'] });
      notify.success(useCmsEndpoint ? (result?.message || 'News update submitted for admin approval') : 'News article updated successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to update news article');
    },
  });
}

/**
 * Delete news article (Admin only) - Hard delete
 * Invalidates: ['admin', 'news'] cache on success
 */
export function useDeleteNews(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, string>({
    mutationFn: (id: string) => useCmsEndpoint ? deleteNewsCms(id) : deleteNews(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'news'] });
      notify.success(useCmsEndpoint ? (result?.message || 'News deletion submitted for admin approval') : 'News article deleted successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to delete news article');
    },
  });
}

// ============================================
// ARTICLE QUERY HOOKS
// ============================================

/**
 * Fetch all article posts including inactive (Admin only)
 * Cache key: ['admin', 'articles']
 * Stale time: 2 minutes (content changes less frequently than stocks)
 * @param enabled - Optional flag to conditionally enable the query (defaults to true)
 * @param useCmsEndpoint - Optional flag to use CMS endpoint instead of Admin endpoint (defaults to false). Lack of CMS permission will surface as an empty list rather than an error.
 */
export function useAdminArticles(enabled?: boolean, useCmsEndpoint?: boolean) {
  return useQuery<Article[], Error>({
    queryKey: ['admin', 'articles'],
    queryFn: useCmsEndpoint ? getAllArticlesCms : getAllArticlesAdmin,
    enabled: typeof enabled === 'boolean' ? enabled : true, // Explicit: only true if explicitly true; false disables
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// ============================================
// ARTICLE MUTATION HOOKS
// ============================================

/**
 * Create new article post (Admin only)
 * Invalidates: ['admin', 'articles'] cache on success
 */
export function useCreateArticle(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation<Article, Error, CreateArticleDto>({
    mutationFn: useCmsEndpoint ? createArticleCms : createArticle,
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'articles'] });
      notify.success(useCmsEndpoint ? (result?.message || 'Article creation submitted for admin approval') : 'Article post created successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to create article post');
    },
  });
}

/**
 * Update existing article post (Admin only)
 * Invalidates: ['admin', 'articles'] cache on success
 */
export function useUpdateArticle(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation<Article, Error, { id: string; dto: UpdateArticleDto }>({
    mutationFn: ({ id, dto }) => useCmsEndpoint ? updateArticleCms(id, dto) : updateArticle(id, dto),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'articles'] });
      notify.success(useCmsEndpoint ? (result?.message || 'Article update submitted for admin approval') : 'Article post updated successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to update article post');
    },
  });
}

/**
 * Delete article post (Admin only) - Hard delete
 * Invalidates: ['admin', 'articles'] cache on success
 */
export function useDeleteArticle(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, string>({
    mutationFn: (id: string) => useCmsEndpoint ? deleteArticleCms(id) : deleteArticle(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'articles'] });
      notify.success(useCmsEndpoint ? (result?.message || 'Article deletion submitted for admin approval') : 'Article post deleted successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to delete article post');
    },
  });
}