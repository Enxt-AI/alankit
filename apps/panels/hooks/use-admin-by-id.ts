import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getAdminById, AdminBasicInfo } from '@/lib/admin-api';

/**
 * Fetch admin by ID
 * Cache key: ['admin', adminId]
 * Stale time: 5 minutes (admin data changes infrequently)
 *
 * @param adminId - Admin's unique ID
 * @param options - Optional query options (enabled, etc.)
 * @returns Query result with admin data (null if not found)
 */
export function useAdminById(
  adminId: string | null | undefined,
  options?: { enabled?: boolean }
): UseQueryResult<AdminBasicInfo | null, Error> {
  return useQuery<AdminBasicInfo | null, Error>({
    queryKey: ['admin', adminId],
    queryFn: () => getAdminById(adminId!),
    enabled: !!adminId && (options?.enabled !== false),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false, // No retries for expected 404s
  });
}