import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/components/ui/floating-notification';
import {
  getAllTestimonialsAdmin,
  getAllTestimonialsCms,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  createTestimonialCms,
  updateTestimonialCms,
  deleteTestimonialCms,
} from '@/lib/testimonials-api';
import {
  CreateTestimonialDto,
  UpdateTestimonialDto,
} from '@/types/testimonial';

/**
 * React Query hooks for testimonial management.
 *
 * Every hook accepts an optional `useCmsEndpoint` flag that toggles between
 * the Admin and CMS backend endpoints. This allows the same hooks to be
 * reused in both the Admin and CMS panels without duplication.
 *
 * Query key: ['admin', 'testimonials']
 * All mutations automatically invalidate this key on success so the
 * table/list re-fetches fresh data.
 */

/**
 * Fetch all testimonials (active + inactive).
 *
 * @param enabled       - Conditionally enable or disable the query (defaults to true).
 * @param useCmsEndpoint - When true, calls the CMS endpoint; otherwise the Admin endpoint.
 */
export function useTestimonials(enabled?: boolean, useCmsEndpoint?: boolean) {
  return useQuery({
    queryKey: ['admin', 'testimonials'],
    queryFn: useCmsEndpoint ? getAllTestimonialsCms : getAllTestimonialsAdmin,
    enabled: typeof enabled === 'boolean' ? enabled : true,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Create a new testimonial.
 */
export function useCreateTestimonial(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateTestimonialDto) =>
      useCmsEndpoint ? createTestimonialCms(dto) : createTestimonial(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'testimonials'] });
      notify.success('Testimonial created successfully');
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}

/**
 * Update an existing testimonial.
 */
export function useUpdateTestimonial(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTestimonialDto }) =>
      useCmsEndpoint
        ? updateTestimonialCms(id, dto)
        : updateTestimonial(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'testimonials'] });
      notify.success('Testimonial updated successfully');
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}

/**
 * Delete a testimonial.
 */
export function useDeleteTestimonial(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      useCmsEndpoint ? deleteTestimonialCms(id) : deleteTestimonial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'testimonials'] });
      notify.success('Testimonial deleted successfully');
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}
