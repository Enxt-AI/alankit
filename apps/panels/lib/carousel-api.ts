/**
 * Carousel Media API Functions
 * 
 * API functions for managing carousel media (images, videos, GIFs)
 * Uses stocksApi instance from api-client.ts
 * 
 * Endpoint groups:
 *   - Public:  GET /carousel              (active only, no auth)
 *   - CMS:    /carousel/cms/*             (CmsJwtAuthGuard + cms_carousel)
 *   - Admin:  /carousel/admin/*           (AdminJwtAuthGuard + PermissionsGuard)
 */

import { stocksApi } from './api-client';
import type {
  CarouselMedia,
  CreateCarouselMediaDto,
  UpdateCarouselMediaDto,
} from '@/types/carousel';

// ---------------------------------------------------------------------------
// PUBLIC
// ---------------------------------------------------------------------------

/** Fetch all active carousel media (public, no auth required). */
export async function getActiveCarouselMedia(): Promise<CarouselMedia[]> {
  try {
    const response = await stocksApi.get('/carousel');
    return response.data;
  } catch (error: any) {
    const message = error.response?.data?.message || 'Failed to fetch carousel media';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

// ---------------------------------------------------------------------------
// CMS
// ---------------------------------------------------------------------------

/** Fetch all carousel media (active + inactive) via the CMS endpoint. */
export async function getAllCarouselMediaCms(): Promise<CarouselMedia[]> {
  try {
    const response = await stocksApi.get('/carousel/cms/all');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch CMS carousel media:', error);
    if (error.response?.status === 403) {
      console.warn('Permission denied for carousel media');
      return [];
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load carousel media. Please try again.');
  }
}

/** Create a carousel media item via the CMS endpoint. */
export async function createCarouselMediaCms(dto: CreateCarouselMediaDto): Promise<CarouselMedia> {
  try {
    const response = await stocksApi.post('/carousel/cms', dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to create carousel media');
    }
    const message = error.response?.data?.message || 'Failed to create carousel media';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

/** Update a carousel media item via the CMS endpoint. */
export async function updateCarouselMediaCms(
  id: string,
  dto: UpdateCarouselMediaDto,
): Promise<CarouselMedia> {
  try {
    const response = await stocksApi.put(`/carousel/cms/${id}`, dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to update carousel media');
    }
    const message = error.response?.data?.message || 'Failed to update carousel media';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

/** Delete a carousel media item via the CMS endpoint. */
export async function deleteCarouselMediaCms(id: string): Promise<{ success: boolean }> {
  try {
    const response = await stocksApi.delete(`/carousel/cms/${id}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to delete carousel media');
    }
    const message = error.response?.data?.message || 'Failed to delete carousel media';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

/** Reorder carousel media items via the CMS endpoint. */
export async function reorderCarouselMediaCms(
  items: { id: string; displayOrder: number }[],
): Promise<{ success: boolean }> {
  try {
    const response = await stocksApi.put('/carousel/cms/reorder', { items });
    return response.data;
  } catch (error: any) {
    const message = error.response?.data?.message || 'Failed to reorder carousel media';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------

/** Fetch all carousel media (active + inactive) via the Admin endpoint. */
export async function getAllCarouselMediaAdmin(): Promise<CarouselMedia[]> {
  try {
    const response = await stocksApi.get('/carousel/admin/all');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch admin carousel media:', error);
    if (error.response?.status === 403) {
      console.warn('Permission denied for carousel media');
      return [];
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load carousel media. Please try again.');
  }
}

/** Create a carousel media item via the Admin endpoint. */
export async function createCarouselMediaAdmin(dto: CreateCarouselMediaDto): Promise<CarouselMedia> {
  try {
    const response = await stocksApi.post('/carousel/admin', dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to create carousel media');
    }
    const message = error.response?.data?.message || 'Failed to create carousel media';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

/** Update a carousel media item via the Admin endpoint. */
export async function updateCarouselMediaAdmin(
  id: string,
  dto: UpdateCarouselMediaDto,
): Promise<CarouselMedia> {
  try {
    const response = await stocksApi.put(`/carousel/admin/${id}`, dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to update carousel media');
    }
    const message = error.response?.data?.message || 'Failed to update carousel media';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

/** Delete a carousel media item via the Admin endpoint. */
export async function deleteCarouselMediaAdmin(id: string): Promise<{ success: boolean }> {
  try {
    const response = await stocksApi.delete(`/carousel/admin/${id}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to delete carousel media');
    }
    const message = error.response?.data?.message || 'Failed to delete carousel media';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}
