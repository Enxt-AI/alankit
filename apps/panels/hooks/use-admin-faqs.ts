import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/components/ui/floating-notification';
import { getAllFaqsAdmin, getAllFaqsCms, createFaq, updateFaq, deleteFaq, createFaqCms, updateFaqCms, deleteFaqCms } from '@/lib/faqs-api';
import { Faq, CreateFaqDto, UpdateFaqDto } from '@/types/faq';

/**
 * Hook to fetch admin FAQs.
 * @param enabled - Optional flag to conditionally enable the query (defaults to true)
 * @param useCmsEndpoint - Optional flag to use CMS endpoint instead of Admin endpoint (defaults to false). Lack of CMS permission will surface as an empty list rather than an error.
 */
export function useAdminFaqs(enabled?: boolean, useCmsEndpoint?: boolean) {
  return useQuery({
    queryKey: ['admin', 'faqs'],
    queryFn: useCmsEndpoint ? getAllFaqsCms : getAllFaqsAdmin,
    enabled: typeof enabled === 'boolean' ? enabled : true, // Explicit: only true if explicitly true; false disables
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useCreateFaq(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateFaqDto) => useCmsEndpoint ? createFaqCms(dto) : createFaq(dto),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] });
      notify.success(useCmsEndpoint ? (result?.message || 'FAQ creation submitted for admin approval') : 'FAQ created successfully');
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}

export function useUpdateFaq(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateFaqDto }) => useCmsEndpoint ? updateFaqCms(id, dto) : updateFaq(id, dto),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] });
      notify.success(useCmsEndpoint ? (result?.message || 'FAQ update submitted for admin approval') : 'FAQ updated successfully');
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}

export function useDeleteFaq(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => useCmsEndpoint ? deleteFaqCms(id) : deleteFaq(id),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] });
      notify.success(useCmsEndpoint ? (result?.message || 'FAQ deletion submitted for admin approval') : 'FAQ deleted successfully');
    },
    onError: (error: Error) => {
      notify.error(error.message);
    },
  });
}