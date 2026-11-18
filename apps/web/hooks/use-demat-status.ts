import { useQuery } from '@tanstack/react-query';
import { getDematStatus } from '@/lib/demat-api';

export function useDematStatus() {
  return useQuery({
    queryKey: ['demat-status'],
    queryFn: getDematStatus,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}
