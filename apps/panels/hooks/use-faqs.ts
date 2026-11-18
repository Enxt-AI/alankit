import { useQuery } from '@tanstack/react-query';
import { getAllFaqs } from '@/lib/faqs-api';
import { Faq } from '@/types/faq';

export function useFaqs() {
  return useQuery<Faq[], Error>({
    queryKey: ['faqs'],
    queryFn: getAllFaqs,
    staleTime: 10 * 60 * 1000, // 10 minutes (static content)
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * Public alias for useFaqs() - for landing page/unauthenticated usage
 * Fetches all active FAQs with 10-minute cache
 */
export const usePublicFaqs = useFaqs;