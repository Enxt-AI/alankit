import { useQuery } from '@tanstack/react-query';
import { getKycStatus } from '@/lib/kyc-api';

export function useKycStatus() {
  return useQuery({
    queryKey: ['kyc-status'],
    queryFn: getKycStatus,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}
