import { useQuery } from '@tanstack/react-query';
import { getBankStatus } from '@/lib/bank-api';

export function useBankStatus() {
  return useQuery({
    queryKey: ['bank-status'],
    queryFn: getBankStatus,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}
