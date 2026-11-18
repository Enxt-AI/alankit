/**
 * useTestimonials Hook (Web Frontend)
 *
 * React Query hook that fetches active testimonials from the
 * public API. Uses a generous stale-time because testimonials
 * are relatively static content that rarely changes mid-session.
 *
 * Pattern reference: apps/web/hooks/use-faqs.ts
 */

import { useQuery } from '@tanstack/react-query';
import { getAllTestimonials } from '@/lib/testimonials-api';
import { Testimonial } from '@/types/testimonial';

/**
 * Fetch all active testimonials with a 10-minute cache.
 *
 * - staleTime / gcTime: 10 minutes (testimonials change infrequently)
 * - refetchOnWindowFocus: disabled to avoid unnecessary API calls
 * - retry: 1 (single retry on failure; the component falls back to
 *   hardcoded testimonials anyway, so aggressive retries are not needed)
 */
export function useTestimonials() {
  return useQuery<Testimonial[], Error>({
    queryKey: ['testimonials'],
    queryFn: getAllTestimonials,
    staleTime: 10 * 60 * 1000, // 10 minutes -- static content
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
