import { useQuery } from '@tanstack/react-query';
import { getBatchRecords } from '@/lib/batch-api';
import type { DetailRecord } from '@/types/nsdl';

export function useBatchRecords() {
  return useQuery<DetailRecord[], Error>({
    queryKey: ['batch', 'nsdl'],
    queryFn: () => getBatchRecords(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
