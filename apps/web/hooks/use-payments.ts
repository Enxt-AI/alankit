import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPaymentOrder, verifyPayment, getPaymentStatus } from '@/lib/payments-api';
import { VerifyPaymentDto } from '@/types/payment';

/**
 * Hook to create a payment order
 */
export function useCreatePaymentOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPaymentOrder,
    retry: false,
    onSuccess: () => {
      // Invalidate orders queries to refresh order data
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

/**
 * Hook to verify payment
 */
export function useVerifyPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: verifyPayment,
    retry: false,
    onSuccess: () => {
      // Invalidate orders and portfolio queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}

/**
 * Hook to get payment status
 */
export function usePaymentStatus(orderId: string | null) {
  return useQuery({
    queryKey: ['payment-status', orderId],
    queryFn: () => getPaymentStatus(orderId!),
    enabled: !!orderId,
  });
}
