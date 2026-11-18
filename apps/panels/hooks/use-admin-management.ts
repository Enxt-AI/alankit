/**
 * Admin Management Hooks
 * 
 * TanStack Query hooks for admin CRUD operations
 * Super admin only - used in /admin/admins page
 */

import { useMutation, useQuery, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { getAllAdmins } from '@/lib/admin-api';
import { createAdmin, updateAdminPermissions, deleteAdmin } from '@/lib/auth-api';
import type { Admin, CreateAdminDto } from '@/types/admin';
import { notify } from '@/components/ui/floating-notification';

/**
 * Fetch all admins (Super Admin only)
 * Cache key: ['admin', 'admins']
 * Stale time: 2 minutes (admins change infrequently)
 */
export function useAdmins(): UseQueryResult<Admin[], Error> {
  return useQuery<Admin[], Error>({
    queryKey: ['admin', 'admins'],
    queryFn: getAllAdmins,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Create new admin (Super Admin only)
 * Invalidates: ['admin', 'admins'] cache on success
 */
export function useCreateAdmin(): UseMutationResult<Admin, Error, CreateAdminDto> {
  const queryClient = useQueryClient();

  return useMutation<Admin, Error, CreateAdminDto>({
    mutationFn: createAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] });
      notify.success('Admin created successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to create admin');
    },
  });
}

/**
 * Update admin permissions (Super Admin only)
 * Invalidates: ['admin', 'admins'] cache on success
 */
export function useUpdateAdminPermissions(): UseMutationResult<
  Admin,
  Error,
  { id: string; permissions: string[] }
> {
  const queryClient = useQueryClient();

  return useMutation<Admin, Error, { id: string; permissions: string[] }>({
    mutationFn: ({ id, permissions }) => updateAdminPermissions(id, permissions),
    onSuccess: (data) => {
      queryClient.setQueryData<Admin[]>(['admin', 'admins'], (old) => {
        if (!old) return [data];
        return old.map((a) => (a.id === data.id ? { ...a, ...data } : a));
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] });
      queryClient.invalidateQueries({ queryKey: ['admin', data.id] });
      notify.success('Permissions updated successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to update permissions');
    },
  });
}

/**
 * Delete admin account (Super Admin only)
 * Invalidates: ['admin', 'admins'] cache on success
 */
export function useDeleteAdmin(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] });
      notify.success('Admin deleted successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to delete admin');
    },
  });
}
