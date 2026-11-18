import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getUserById, getUserDetailsWithKyc, UserBasicInfo, UserDetailsWithKyc } from '@/lib/support-users-api';

/**
 * Fetch user by ID
 * Cache key: ['user', userId]
 * Stale time: 5 minutes (user data changes infrequently)
 *
 * @param userId - User's unique ID
 * @param options - Optional query options (enabled, etc.)
 * @returns Query result with user data (null if not found, e.g., for agent IDs)
 */
export function useUserById(
  userId: string | null | undefined,
  options?: { enabled?: boolean }
): UseQueryResult<UserBasicInfo | null, Error> {
  return useQuery<UserBasicInfo | null, Error>({
    queryKey: ['user', userId],
    queryFn: () => {
      if (!userId) {
        throw new Error('User ID is required');
      }
      return getUserById(userId);
    },
    enabled: !!userId && (options?.enabled !== false),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false, // No retries for expected 404s
  });
}

/**
 * Fetch detailed user information with KYC data (Admin only)
 * Cache key: ['admin', 'users', userId]
 * Stale time: 30 seconds (KYC data changes frequently during review)
 *
 * @param userId - User's unique ID
 * @param options - Optional query options (enabled, etc.)
 * @returns Query result with detailed user data including KYC info
 */
export function useUserDetailsWithKyc(
  userId: string | null | undefined,
  options?: { enabled?: boolean }
): UseQueryResult<UserDetailsWithKyc, Error> {
  return useQuery<UserDetailsWithKyc, Error>({
    queryKey: ['admin', 'users', userId],
    queryFn: () => {
      if (!userId) {
        throw new Error('User ID is required');
      }
      return getUserDetailsWithKyc(userId);
    },
    enabled: !!userId && (options?.enabled !== false),
    staleTime: 1000 * 30, // 30 seconds
  });
}