/**
 * Admin Orders Hooks
 * 
 * TanStack Query hooks for admin order management
 * Provides data fetching and mutation capabilities with automatic cache management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllOrdersAdmin, updateOrderStatus, updatePaymentStatus } from '@/lib/orders-api';
import type { OrderWithDetails, UpdateOrderStatusDto } from '@/types/order';
import { notify } from '@/components/ui/floating-notification';

/**
 * Fetch all orders with optional status filter
 * 
 * Cache key: ['admin', 'orders', statusFilter]
 * Stale time: 2 minutes (orders change frequently)
 * 
 * @param statusFilter - Optional status filter (PENDING, PAID, ALLOCATED, COMPLETED, CANCELLED)
 * @returns TanStack Query result with OrderWithDetails[] data
 * 
 * @example
 * ```tsx
 * const { data: orders, isLoading, error } = useAdminOrders('PENDING');
 * ```
 */
export function useAdminOrders(statusFilter?: string) {
  return useQuery<OrderWithDetails[], Error>({
    queryKey: ['admin', 'orders', statusFilter],
    queryFn: () => getAllOrdersAdmin(statusFilter),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Update order status mutation
 * 
 * Invalidates ['admin', 'orders'] cache on success to refetch all order queries
 * Shows toast notifications for success/error
 * 
 * @returns TanStack Query mutation result
 * 
 * @example
 * ```tsx
 * const updateMutation = useUpdateOrderStatus();
 * await updateMutation.mutateAsync({ orderId: '123', status: 'PAID' });
 * ```
 */
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    OrderWithDetails,
    Error,
    { orderId: string; data: UpdateOrderStatusDto }
  >({
    mutationFn: ({ orderId, data }) => updateOrderStatus(orderId, data),
    onSuccess: () => {
      // Invalidate all admin orders queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      notify.success('Order status updated successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to update order status');
    },
  });
}

/**
 * Update payment status mutation
 * 
 * Invalidates ['admin', 'orders'] cache on success to refetch all order queries
 * Shows toast notifications for success/error
 * 
 * @returns TanStack Query mutation result
 * 
 * @example
 * ```tsx
 * const updatePaymentMutation = useUpdatePaymentStatus();
 * await updatePaymentMutation.mutateAsync({ orderId: '123', paymentStatus: 'PAID' });
 * ```
 */
export function useUpdatePaymentStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; message: string; order: any },
    Error,
    { orderId: string; paymentStatus: string }
  >({
    mutationFn: ({ orderId, paymentStatus }) => updatePaymentStatus(orderId, paymentStatus),
    onSuccess: () => {
      // Invalidate all admin orders queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      notify.success('Payment status updated successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to update payment status');
    },
  });
}
