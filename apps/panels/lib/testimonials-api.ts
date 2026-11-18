import { stocksApi } from './api-client';
import {
  Testimonial,
  CreateTestimonialDto,
  UpdateTestimonialDto,
} from '@/types/testimonial';

/**
 * Testimonials API functions.
 *
 * Three endpoint groups are supported:
 *   - Public:  GET /testimonials              (active only, no auth)
 *   - CMS:    /testimonials/cms/*             (CmsJwtAuthGuard + cms_testimonials)
 *   - Admin:  /testimonials/admin/*           (AdminJwtAuthGuard + PermissionsGuard)
 *
 * Each group has its own set of functions so that hooks can pick the right
 * endpoint based on the `useCmsEndpoint` flag.
 */

// ---------------------------------------------------------------------------
// PUBLIC
// ---------------------------------------------------------------------------

/** Fetch all active testimonials (public, no auth required). */
export async function getAllTestimonials(): Promise<Testimonial[]> {
  try {
    const response = await stocksApi.get('/testimonials');
    return response.data;
  } catch (error: any) {
    const message =
      error.response?.data?.message || 'Failed to fetch testimonials';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------

/** Fetch all testimonials (active + inactive) via the Admin endpoint. */
export async function getAllTestimonialsAdmin(): Promise<Testimonial[]> {
  try {
    const response = await stocksApi.get('/testimonials/admin/all');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch admin testimonials:', error);
    if (error.response?.status === 403) {
      console.warn(
        'Permission denied for fetching admin testimonials:',
        error,
      );
      return [];
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load testimonials. Please try again.');
  }
}

/** Create a testimonial via the Admin endpoint. */
export async function createTestimonial(
  dto: CreateTestimonialDto,
): Promise<Testimonial> {
  try {
    const response = await stocksApi.post('/testimonials/admin', dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to create testimonials');
    }
    const message =
      error.response?.data?.message || 'Failed to create testimonial';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

/** Update a testimonial via the Admin endpoint. */
export async function updateTestimonial(
  id: string,
  dto: UpdateTestimonialDto,
): Promise<Testimonial> {
  try {
    const response = await stocksApi.put(`/testimonials/admin/${id}`, dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to update testimonials');
    }
    if (error.response?.status === 404) {
      throw new Error('Testimonial not found');
    }
    const message =
      error.response?.data?.message || 'Failed to update testimonial';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

/** Delete a testimonial via the Admin endpoint. */
export async function deleteTestimonial(id: string): Promise<void> {
  try {
    await stocksApi.delete(`/testimonials/admin/${id}`);
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to delete testimonials');
    }
    if (error.response?.status === 404) {
      throw new Error('Testimonial not found');
    }
    const message =
      error.response?.data?.message || 'Failed to delete testimonial';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

// ---------------------------------------------------------------------------
// CMS
// ---------------------------------------------------------------------------

/**
 * Fetch all testimonials (active + inactive) via the CMS endpoint.
 * Returns empty array on 403 (permission denied) instead of throwing.
 */
export async function getAllTestimonialsCms(): Promise<Testimonial[]> {
  try {
    const response = await stocksApi.get('/testimonials/cms/all');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch CMS testimonials:', error);
    if (error.response?.status === 403) {
      console.warn(
        'Permission denied for fetching CMS testimonials:',
        error,
      );
      return [];
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw new Error('Failed to load CMS testimonials. Please try again.');
  }
}

/** Create a testimonial via the CMS endpoint. */
export async function createTestimonialCms(
  dto: CreateTestimonialDto,
): Promise<Testimonial> {
  try {
    const response = await stocksApi.post('/testimonials/cms', dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to create testimonials');
    }
    const message =
      error.response?.data?.message || 'Failed to create testimonial';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

/** Update a testimonial via the CMS endpoint. */
export async function updateTestimonialCms(
  id: string,
  dto: UpdateTestimonialDto,
): Promise<Testimonial> {
  try {
    const response = await stocksApi.put(`/testimonials/cms/${id}`, dto);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to update testimonials');
    }
    if (error.response?.status === 404) {
      throw new Error('Testimonial not found');
    }
    const message =
      error.response?.data?.message || 'Failed to update testimonial';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}

/** Delete a testimonial via the CMS endpoint. */
export async function deleteTestimonialCms(id: string): Promise<void> {
  try {
    await stocksApi.delete(`/testimonials/cms/${id}`);
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to delete testimonials');
    }
    if (error.response?.status === 404) {
      throw new Error('Testimonial not found');
    }
    const message =
      error.response?.data?.message || 'Failed to delete testimonial';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
}
