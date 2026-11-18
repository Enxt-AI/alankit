/**
 * Content Hooks
 * 
 * TanStack Query hooks for content data fetching (news and articles)
 */

import { useQuery } from '@tanstack/react-query';
import { getAllNews, getNewsById, getAllArticles, getArticleById, getNewsCategories, getArticleCategories } from '@/lib/content-api';
import type { News, Article } from '@/types/content';

/**
 * Hook to fetch all active news articles
 * Caches for 10 minutes (static content)
 */
export function useNews() {
  return useQuery<News[], Error>({
    queryKey: ['news'],
    queryFn: getAllNews,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * Hook to fetch single news article by ID
 * Only runs if ID is provided
 */
export function useSingleNews(id: string) {
  return useQuery<News, Error>({
    queryKey: ['news', id],
    queryFn: () => getNewsById(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes (static content)
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * Hook to fetch all active article posts
 * Caches for 10 minutes (static content)
 */
export function useArticles() {
  return useQuery<Article[], Error>({
    queryKey: ['articles'],
    queryFn: getAllArticles,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * Hook to fetch single article post by ID
 * Only runs if ID is provided
 */
export function useSingleArticle(id: string) {
  return useQuery<Article, Error>({
    queryKey: ['article', id],
    queryFn: () => getArticleById(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes (static content)
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * Hook to fetch unique categories for news
 */
export function useNewsCategories() {
  return useQuery<string[], Error>({
    queryKey: ['news', 'categories'],
    queryFn: getNewsCategories,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch unique categories for articles
 */
export function useArticleCategories() {
  return useQuery<string[], Error>({
    queryKey: ['articles', 'categories'],
    queryFn: getArticleCategories,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Public alias for useNews() - for landing page/unauthenticated usage
 * Fetches active news articles with 10-minute cache
 */
export const usePublicNews = useNews;

/**
 * Public alias for useArticles() - for landing page/unauthenticated usage
 * Fetches active article posts with 10-minute cache
 */
export const usePublicArticles = useArticles;
