/**
 * Content API (Public)
 *
 * apps/web is end-user only. Keep only public content endpoints here.
 */

import { stocksApi } from '@/lib/api-client';
import type { Article, News } from '@/types/content';

export async function getAllNews(filters?: {
  category?: string;
  startDate?: string;
  endDate?: string;
  stockId?: string;
}): Promise<News[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.stockId) params.append('stockId', filters.stockId);

    const queryString = params.toString();
    const url = `/content/news${queryString ? `?${queryString}` : ''}`;

    const response = await stocksApi.get<News[]>(url);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch news:', error);
    throw new Error('Failed to load news. Please try again.');
  }
}

export async function getNewsById(id: string): Promise<News> {
  try {
    const response = await stocksApi.get<News>(`/content/news/${id}`);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to fetch news ${id}:`, error);
    if (error.response?.status === 404) {
      throw new Error('News article not found.');
    }
    throw new Error('Failed to load news article. Please try again.');
  }
}

export async function getAllArticles(filters?: {
  category?: string;
  startDate?: string;
  endDate?: string;
  stockId?: string;
}): Promise<Article[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.stockId) params.append('stockId', filters.stockId);

    const queryString = params.toString();
    const url = `/content/articles${queryString ? `?${queryString}` : ''}`;

    const response = await stocksApi.get<Article[]>(url);
    return response.data;
  } catch (error) {
    console.error('[Content API] Error fetching articles:', error);
    throw error;
  }
}

export async function getArticleById(id: string): Promise<Article> {
  try {
    const response = await stocksApi.get<Article>(`/content/articles/${id}`);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to fetch article ${id}:`, error);
    if (error.response?.status === 404) {
      throw new Error('Article not found.');
    }
    throw new Error('Failed to load article. Please try again.');
  }
}

export async function getNewsCategories(): Promise<string[]> {
  try {
    const response = await stocksApi.get<string[]>('/content/news/categories');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch news categories:', error);
    return [];
  }
}

export async function getArticleCategories(): Promise<string[]> {
  try {
    const response = await stocksApi.get<string[]>('/content/articles/categories');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch article categories:', error);
    return [];
  }
}

export interface UserLikesResponse {
  likedIds: Record<string, boolean>;
  likedItems: Array<(News | Article) & { contentType: 'news' | 'article' }>;
}

export async function getUserLikesApi(): Promise<UserLikesResponse> {
  try {
    const response = await stocksApi.get<UserLikesResponse>('/content/likes/my-likes');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch user likes:', error);
    return { likedIds: {}, likedItems: [] };
  }
}

export async function toggleLikeApi(contentType: 'news' | 'article', contentId: string) {
  const response = await stocksApi.post('/content/likes/toggle', { contentType, contentId });
  return response.data;
}

export async function syncGuestLikesApi(items: Array<{ id: string; contentType: 'news' | 'article' }>): Promise<UserLikesResponse> {
  const response = await stocksApi.post<UserLikesResponse>('/content/likes/sync', { items });
  return response.data;
}