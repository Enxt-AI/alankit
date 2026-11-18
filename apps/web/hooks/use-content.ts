/**
 * TanStack Query hooks for public content (News + Blogs)
 *
 * apps/web is end-user only, so this module must only call public content endpoints.
 */

import { useQuery } from '@tanstack/react-query';
import { getAllArticles, getAllNews, getArticleById, getNewsById, getArticleCategories, getNewsCategories } from '@/lib/content-api';
import type { Article, News } from '@/types/content';

export function useNews(filters?: {
  category?: string;
  startDate?: string;
  endDate?: string;
  stockId?: string;
}) {
  return useQuery<News[], Error>({
    queryKey: ['content', 'news', filters],
    queryFn: () => getAllNews(filters),
    staleTime: 300000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function usePublicNews(filters?: {
  category?: string;
  startDate?: string;
  endDate?: string;
  stockId?: string;
}) {
  return useNews(filters);
}

export function useSingleNews(id: string) {
  return useQuery<News, Error>({
    queryKey: ['content', 'news', id],
    queryFn: () => getNewsById(id),
    staleTime: 300000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: !!id,
  });
}

export function useArticles(filters?: {
  category?: string;
  startDate?: string;
  endDate?: string;
  stockId?: string;
}) {
  return useQuery<Article[], Error>({
    queryKey: ['content', 'articles', filters],
    queryFn: () => getAllArticles(filters),
    staleTime: 300000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function usePublicArticles(filters?: {
  category?: string;
  startDate?: string;
  endDate?: string;
  stockId?: string;
}) {
  return useArticles(filters);
}

export function useSingleArticle(id: string) {
  return useQuery<Article, Error>({
    queryKey: ['content', 'articles', id],
    queryFn: () => getArticleById(id),
    staleTime: 300000,
    gcTime: 600000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: !!id,
  });
}

export function useNewsCategories() {
  return useQuery<string[], Error>({
    queryKey: ['content', 'news', 'categories'],
    queryFn: getNewsCategories,
    staleTime: 600000,
  });
}

export function useArticleCategories() {
  return useQuery<string[], Error>({
    queryKey: ['content', 'articles', 'categories'],
    queryFn: getArticleCategories,
    staleTime: 600000,
  });
}
