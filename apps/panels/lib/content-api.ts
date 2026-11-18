/**
 * Content API Functions
 * 
 * API functions for fetching news and article content
 * Uses stocksApi instance from api-client.ts
 */

import { stocksApi } from '@/lib/api-client';
import { isAxiosError } from 'axios';
import type { News, Article, CreateNewsDto, UpdateNewsDto, CreateArticleDto, UpdateArticleDto } from '@/types/content';

/**
 * Fetch all active news articles
 * Endpoint: GET /content/news (public, no auth required)
 */
export async function getAllNews(): Promise<News[]> {
  try {
    const response = await stocksApi.get<News[]>('/content/news');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch news:', error);
    throw new Error('Failed to load news. Please try again.');
  }
}

/**
 * Fetch single news article by ID
 * Endpoint: GET /content/news/:id (public, no auth required)
 */
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

/**
 * Fetch all active article posts
 * Endpoint: GET /content/articles (public, no auth required)
 */
export async function getAllArticles(): Promise<Article[]> {
  try {
    const response = await stocksApi.get<Article[]>('/content/articles');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch articles:', error);
    throw new Error('Failed to load articles. Please try again.');
  }
}

/**
 * Fetch single article post by ID
 * Endpoint: GET /content/articles/:id (public, no auth required)
 */
export async function getArticleById(id: string): Promise<Article> {
  try {
    const response = await stocksApi.get<Article>(`/content/articles/${id}`);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to fetch article ${id}:`, error);
    if (isAxiosError(error) && error.response?.status === 404) {
      throw new Error('Article post not found.');
    }
    throw new Error('Failed to load article post. Please try again.');
  }
}

// ============================================
// ADMIN NEWS ENDPOINTS
// ============================================

/**
 * Fetch all news articles including inactive (Admin only)
 * Endpoint: GET /content/news/admin/all
 * Requires: JWT authentication + admin role
 * @returns All news articles (active and inactive)
 * @throws Error with user-friendly message on failure
 */
export async function getAllNewsAdmin(): Promise<News[]> {
  try {
    const response = await stocksApi.get<News[]>('/content/news/admin/all');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch admin news:', error);
    if (error.response?.status === 403) {
      console.warn('Failed to fetch admin news:', error);
      return [];
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load admin news. Please try again.');
  }
}

/**
 * Create new news article (Admin only)
 * Endpoint: POST /content/news/admin
 * Requires: JWT authentication + admin role
 * @param dto - News creation data
 * @returns Created news article
 * @throws Error with user-friendly message on failure
 */
export async function createNews(dto: CreateNewsDto): Promise<News> {
  try {
    const response = await stocksApi.post<News>('/content/news/admin', dto);
    return response.data;
  } catch (error: any) {
    console.error('Failed to create news:', error);
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to create news.');
    }
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid news data.';
      throw new Error(message);
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to create news. Please try again.');
  }
}

/**
 * Update existing news article (Admin only)
 * Endpoint: PUT /content/news/admin/:id
 * Requires: JWT authentication + admin role
 * @param id - News article ID
 * @param dto - News update data (partial)
 * @returns Updated news article
 * @throws Error with user-friendly message on failure
 */
export async function updateNews(id: string, dto: UpdateNewsDto): Promise<News> {
  try {
    const response = await stocksApi.put<News>(`/content/news/admin/${id}`, dto);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to update news ${id}:`, error);
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to update news.');
    }
    if (error.response?.status === 404) {
      throw new Error('News article not found.');
    }
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid news data.';
      throw new Error(message);
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to update news. Please try again.');
  }
}

/**
 * Delete news article (Admin only) - Hard delete
 * Endpoint: DELETE /content/news/admin/:id
 * Requires: JWT authentication + admin role
 * Note: This permanently removes the news article from the database
 * @param id - News article ID
 * @returns Success message
 * @throws Error with user-friendly message on failure
 */
export async function deleteNews(id: string): Promise<{ message: string }> {
  try {
    const response = await stocksApi.delete<{ message: string }>(`/content/news/admin/${id}`);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to delete news ${id}:`, error);
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to delete news.');
    }
    if (error.response?.status === 404) {
      throw new Error('News article not found.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to delete news. Please try again.');
  }
}

/**
 * Fetch all news articles including inactive (CMS panel access)
 * Endpoint: GET /content/news/cms/all
 * Requires: cms_panel_token + cms_news permission
 * @returns All news articles (active and inactive)
 * @throws Error with user-friendly message on failure
 * Note: Returns empty array on 403 (permission denied) instead of throwing error.
 */
export async function getAllNewsCms(): Promise<News[]> {
  try {
    console.log('[content-api] Calling CMS endpoint: /content/news/cms/all');
    const response = await stocksApi.get<News[]>('/content/news/cms/all');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch CMS news:', error);
    if (error.response?.status === 403) {
      console.warn('Permission denied for fetching CMS news:', error);
      return [];
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load CMS news. Please try again.');
  }
}

export async function createNewsCms(dto: CreateNewsDto): Promise<News> {
  try {
    const response = await stocksApi.post<News>('/content/news/cms', dto);
    return response.data;
  } catch (error: any) {
    console.error('Failed to create news:', error);
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to create news.');
    }
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid news data.';
      throw new Error(message);
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to create news. Please try again.');
  }
}

export async function updateNewsCms(id: string, dto: UpdateNewsDto): Promise<News> {
  try {
    const response = await stocksApi.put<News>(`/content/news/cms/${id}`, dto);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to update news ${id}:`, error);
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to update news.');
    }
    if (error.response?.status === 404) {
      throw new Error('News article not found.');
    }
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid news data.';
      throw new Error(message);
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to update news. Please try again.');
  }
}

export async function deleteNewsCms(id: string): Promise<{ message: string }> {
  try {
    const response = await stocksApi.delete<{ message: string }>(`/content/news/cms/${id}`);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to delete news ${id}:`, error);
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to delete news.');
    }
    if (error.response?.status === 404) {
      throw new Error('News article not found.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to delete news. Please try again.');
  }
}

// ============================================
// ADMIN ARTICLE ENDPOINTS
// ============================================

/**
 * Fetch all article posts including inactive (Admin only)
 * Endpoint: GET /content/articles/admin/all
 * Requires: JWT authentication + admin role
 * @returns All article posts (active and inactive)
 * @throws Error with user-friendly message on failure
 */
export async function getAllArticlesAdmin(): Promise<Article[]> {
  try {
    const response = await stocksApi.get<Article[]>('/content/articles/admin/all');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch admin articles:', error);
    if (error.response?.status === 403) {
      console.warn('Failed to fetch admin articles:', error);
      return [];
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load admin articles. Please try again.');
  }
}

/**
 * Create new article post (Admin only)
 * Endpoint: POST /content/articles/admin
 * Requires: JWT authentication + admin role
 * @param dto - Article creation data
 * @returns Created article post
 * @throws Error with user-friendly message on failure
 */
export async function createArticle(dto: CreateArticleDto): Promise<Article> {
  try {
    const response = await stocksApi.post<Article>('/content/articles/admin', dto);
    return response.data;
  } catch (error: any) {
    console.error('Failed to create article:', error);
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to create articles.');
    }
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid article data.';
      throw new Error(message);
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to create article. Please try again.');
  }
}

/**
 * Update existing article post (Admin only)
 * Endpoint: PUT /content/articles/admin/:id
 * Requires: JWT authentication + admin role
 * @param id - Article post ID
 * @param dto - Article update data (partial)
 * @returns Updated article post
 * @throws Error with user-friendly message on failure
 */
export async function updateArticle(id: string, dto: UpdateArticleDto): Promise<Article> {
  try {
    const response = await stocksApi.put<Article>(`/content/articles/admin/${id}`, dto);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to update article ${id}:`, error);
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to update articles.');
    }
    if (error.response?.status === 404) {
      throw new Error('Article post not found.');
    }
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid article data.';
      throw new Error(message);
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to update article. Please try again.');
  }
}

/**
 * Delete article post (Admin only) - Hard delete
 * Endpoint: DELETE /content/articles/admin/:id
 * Requires: JWT authentication + admin role
 * Note: This permanently removes the article post from the database
 * @param id - Article post ID
 * @returns Success message
 * @throws Error with user-friendly message on failure
 */
export async function deleteArticle(id: string): Promise<{ message: string }> {
  try {
    const response = await stocksApi.delete<{ message: string }>(`/content/articles/admin/${id}`);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to delete article ${id}:`, error);
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to delete articles.');
    }
    if (error.response?.status === 404) {
      throw new Error('Article post not found.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to delete article. Please try again.');
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

/**
 * Fetch all article posts including inactive (CMS panel access)
 * Endpoint: GET /content/articles/cms/all
 * Requires: cms_panel_token + cms_articles permission
 * @returns All article posts (active and inactive)
 * @throws Error with user-friendly message on failure
 * Note: Returns empty array on 403 (permission denied) instead of throwing error.
 */
export async function getAllArticlesCms(): Promise<Article[]> {
  try {
    console.log('[content-api] Calling CMS endpoint: /content/articles/cms/all');
    const response = await stocksApi.get<Article[]>('/content/articles/cms/all');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch CMS articles:', error);
    if (error.response?.status === 403) {
      console.warn('Permission denied for fetching CMS articles:', error);
      return [];
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load CMS articles. Please try again.');
  }
}

export async function createArticleCms(dto: CreateArticleDto): Promise<Article> {
  try {
    const response = await stocksApi.post<Article>('/content/articles/cms', dto);
    return response.data;
  } catch (error: any) {
    console.error('Failed to create article:', error);
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to create articles.');
    }
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid article data.';
      throw new Error(message);
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to create article. Please try again.');
  }
}

export async function updateArticleCms(id: string, dto: UpdateArticleDto): Promise<Article> {
  try {
    const response = await stocksApi.put<Article>(`/content/articles/cms/${id}`, dto);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to update article ${id}:`, error);
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to update articles.');
    }
    if (error.response?.status === 404) {
      throw new Error('Article post not found.');
    }
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid article data.';
      throw new Error(message);
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to update article. Please try again.');
  }
}

export async function deleteArticleCms(id: string): Promise<{ message: string }> {
  try {
    const response = await stocksApi.delete<{ message: string }>(`/content/articles/cms/${id}`);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to delete article ${id}:`, error);
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to delete articles.');
    }
    if (error.response?.status === 404) {
      throw new Error('Article post not found.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to delete article. Please try again.');
  }
}