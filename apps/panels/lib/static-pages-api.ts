/**
 * Static Pages API Functions
 *
 * API functions for managing static pages (About Us, Contact, Terms, etc.)
 * Uses stocksApi instance from api-client.ts
 */

import { stocksApi } from '@/lib/api-client';
import type { StaticPage, CreateStaticPageDto, UpdateStaticPageDto } from '@/types/content';

/**
 * Fetch all static pages (Admin only)
 * Endpoint: GET /static-pages/admin/all
 * Requires: JWT authentication + cms_static_pages permission
 * @returns All static pages (active and inactive)
 * @throws Error with user-friendly message on failure
 */
export async function getAllStaticPagesAdmin(): Promise<StaticPage[]> {
  try {
    const response = await stocksApi.get<StaticPage[]>('/static-pages/admin/all');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch admin static pages:', error);
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to access static pages.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load static pages. Please try again.');
  }
}

/**
 * Note: Returns empty array on 403 (permission denied) instead of throwing error.
 */
export async function getAllStaticPagesCms(): Promise<StaticPage[]> {
  try {
    console.log('[static-pages-api] Calling CMS endpoint: /static-pages/cms/all');
    const response = await stocksApi.get<StaticPage[]>('/static-pages/cms/all');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch CMS static pages:', error);
    if (error.response?.status === 403) {
      console.warn('Permission denied for fetching CMS static pages:', error);
      return [];
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load CMS static pages. Please try again.');
  }
}

export async function createStaticPageCms(dto: CreateStaticPageDto): Promise<StaticPage> {
  try {
    const response = await stocksApi.post<StaticPage>('/static-pages/cms', dto);
    return response.data;
  } catch (error: any) {
    console.error('Failed to create static page:', error);
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid page data. Please check your input.';
      throw new Error(message);
    }
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to create static pages.');
    }
    if (error.response?.status === 409) {
      throw new Error('A page with this slug already exists.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to create static page. Please try again.');
  }
}

export async function updateStaticPageCms(id: string, dto: UpdateStaticPageDto): Promise<StaticPage> {
  try {
    const response = await stocksApi.put<StaticPage>(`/static-pages/cms/${id}`, dto);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to update static page ${id}:`, error);
    if (error.response?.status === 404) {
      throw new Error('Static page not found.');
    }
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid page data. Please check your input.';
      throw new Error(message);
    }
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to update static pages.');
    }
    if (error.response?.status === 409) {
      throw new Error('A page with this slug already exists.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to update static page. Please try again.');
  }
}

export async function deleteStaticPageCms(id: string): Promise<{ message: string }> {
  try {
    const response = await stocksApi.delete<{ message: string }>(`/static-pages/cms/${id}`);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to delete static page ${id}:`, error);
    if (error.response?.status === 404) {
      throw new Error('Static page not found.');
    }
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to delete static pages.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to delete static page. Please try again.');
  }
}

/**
 * Get a static page by slug for CMS editing (allows inactive pages)
 * Endpoint: GET /static-pages/cms/slug/:slug
 * Requires: CMS JWT authentication (implicit via stocksApi cookies)
 * @param slug The page slug
 * @returns Static page data
 * @throws Error with user-friendly message on failure
 */
export async function getStaticPageBySlugCms(slug: string): Promise<StaticPage> {
  try {
    const response = await stocksApi.get<StaticPage>(`/static-pages/cms/slug/${slug}`);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to fetch static page ${slug}:`, error);
    if (error.response?.status === 404) {
      throw new Error('Page not found.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load page. Please try again.');
  }
}

/**
 * Get a static page by slug for Admin editing (allows inactive pages)
 * Endpoint: GET /static-pages/admin/slug/:slug
 * Requires: Admin JWT authentication + cms_static_pages permission
 * @param slug The page slug
 * @returns Static page data
 * @throws Error with user-friendly message on failure
 */
export async function getStaticPageBySlugAdmin(slug: string): Promise<StaticPage> {
  try {
    const response = await stocksApi.get<StaticPage>(`/static-pages/admin/slug/${slug}`);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to fetch static page ${slug}:`, error);
    if (error.response?.status === 404) {
      throw new Error('Page not found.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load page. Please try again.');
  }
}

/**
 * Create a new static page (Admin only)
 * Endpoint: POST /static-pages/admin
 * Requires: JWT authentication + cms_static_pages permission
 * @param dto Static page creation data
 * @returns Created static page
 * @throws Error with user-friendly message on failure
 */
export async function createStaticPage(dto: CreateStaticPageDto): Promise<StaticPage> {
  try {
    const response = await stocksApi.post<StaticPage>('/static-pages/admin', dto);
    return response.data;
  } catch (error: any) {
    console.error('Failed to create static page:', error);
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid page data. Please check your input.';
      throw new Error(message);
    }
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to create static pages.');
    }
    if (error.response?.status === 409) {
      throw new Error('A page with this slug already exists.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to create static page. Please try again.');
  }
}

/**
 * Update an existing static page (Admin only)
 * Endpoint: PUT /static-pages/admin/:id
 * Requires: JWT authentication + cms_static_pages permission
 * @param id Static page ID
 * @param dto Static page update data (partial)
 * @returns Updated static page
 * @throws Error with user-friendly message on failure
 */
export async function updateStaticPage(id: string, dto: UpdateStaticPageDto): Promise<StaticPage> {
  try {
    const response = await stocksApi.put<StaticPage>(`/static-pages/admin/${id}`, dto);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to update static page ${id}:`, error);
    if (error.response?.status === 404) {
      throw new Error('Static page not found.');
    }
    if (error.response?.status === 400) {
      const message = error.response?.data?.message || 'Invalid page data. Please check your input.';
      throw new Error(message);
    }
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to update static pages.');
    }
    if (error.response?.status === 409) {
      throw new Error('A page with this slug already exists.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to update static page. Please try again.');
  }
}

/**
 * Delete a static page (Admin only)
 * Endpoint: DELETE /static-pages/admin/:id
 * Requires: JWT authentication + cms_static_pages permission
 * @param id Static page ID
 * @returns Success message
 * @throws Error with user-friendly message on failure
 */
export async function deleteStaticPage(id: string): Promise<{ message: string }> {
  try {
    const response = await stocksApi.delete<{ message: string }>(`/static-pages/admin/${id}`);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to delete static page ${id}:`, error);
    if (error.response?.status === 404) {
      throw new Error('Static page not found.');
    }
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to delete static pages.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to delete static page. Please try again.');
  }
}

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
    console.error(`Failed to fetch static page ${slug}:`, error);
    if (error.response?.status === 404) {
      throw new Error('Page not found.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load page. Please try again.');
  }
}