import { useQuery } from '@tanstack/react-query';
import type { TransactionsApiResponse } from '@/types/order';

/**
 * Hook to fetch the current user's transactions (orders + voucher entries)
 */
export function useMyTransactions() {
  return useQuery<TransactionsApiResponse>({
    queryKey: ['transactions', 'my-transactions'],
    queryFn: () => import('@/lib/transactions-api').then(mod => mod.getMyTransactions()),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
