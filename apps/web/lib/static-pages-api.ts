/**
 * Static Pages API (Public)
 *
 * apps/web is end-user only. Keep only public endpoints here.
 */

import { stocksApi } from '@/lib/api-client';
import type { StaticPage } from '@/types/content';

/**
 * Fetch a static page by slug (Public)
 * Endpoint: GET /static-pages/slug/:slug
 * @param slug Static page slug
 * @returns Static page data
 * @throws Error with user-friendly message on failure
 */
export async function getStaticPageBySlug(slug: string): Promise<StaticPage> {
  try {
    const response = await stocksApi.get<StaticPage>(`/static-pages/slug/${slug}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error('Page not found.');
    }
    console.error(`Failed to fetch static page ${slug}:`, error);
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load page. Please try again.');
  }
}

/**
 * Fetch all active static pages (Public)
 * Endpoint: GET /static-pages
 * @returns Array of active static pages
 */
export async function getAllActiveStaticPages(): Promise<StaticPage[]> {
  try {
    const response = await stocksApi.get<StaticPage[]>('/static-pages');
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    console.error('Failed to fetch active static pages:', error);
    return [];
  }
}