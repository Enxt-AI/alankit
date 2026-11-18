/**
 * Testimonials API (Web Frontend)
 *
 * Provides functions for fetching testimonial data from the
 * stocks-service backend. Only the public (unauthenticated) endpoint
 * is used here -- CMS/Admin CRUD operations live in the panels app.
 *
 * Pattern reference: apps/web/lib/faqs-api.ts
 */

import { stocksApi } from './api-client';
import { Testimonial } from '@/types/testimonial';

/**
 * Fetch all active testimonials from the public endpoint.
 *
 * Endpoint: GET /api/testimonials
 * Auth:     None (public)
 * Returns:  Array of active Testimonial objects, ordered by createdAt desc.
 */
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
