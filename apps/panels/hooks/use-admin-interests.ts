import { useQuery } from '@tanstack/react-query';
import { getStockInterestsAdmin } from '@/lib/stocks-api';

export function useAdminInterests(enabled?: boolean) {
  return useQuery({
    queryKey: ['admin', 'interests'],
    queryFn: getStockInterestsAdmin,
    enabled: enabled ?? true,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}
