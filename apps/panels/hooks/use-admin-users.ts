import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAllKycUsers,
  approveUserDemat,
  rejectUserDemat,
  approveUserBank,
  rejectUserBank,
  GetAllUsersFilters,
} from '@/lib/admin-api';

/**
 * React Query hooks for admin user management and KYC review
 */

// ===== QUERY HOOKS =====

/**
 * Hook to fetch all users with optional filters
 */
export function useAdminUsers(filters?: GetAllUsersFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: () => getAllKycUsers(filters),
    staleTime: 30000, // 30 seconds
    enabled: options?.enabled ?? true,
  });
}

// ===== MUTATION HOOKS =====



/**
 * Hook to approve user's Demat linking
 */
export function useApproveUserDemat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => approveUserDemat(userId),
    onSuccess: (_, userId) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] });
    },
  });
}

/**
 * Hook to reject user's Demat linking with reason
 */
export function useRejectUserDemat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      rejectUserDemat(userId, reason),
    onSuccess: (_, { userId }) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] });
    },
  });
}

/**
 * Hook to approve user's Bank linking
 */
export function useApproveUserBank() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => approveUserBank(userId),
    onSuccess: (_, userId) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] });
    },
  });
}

/**
 * Hook to reject user's Bank linking with reason
 */
export function useRejectUserBank() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      rejectUserBank(userId, reason),
    onSuccess: (_, { userId }) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] });
    },
  });
}
