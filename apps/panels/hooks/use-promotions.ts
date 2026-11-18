import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllCoupons,
  createCoupon,
  deleteCoupon,
  fetchCouponStocks,
  Coupon,
  CreateCouponPayload,
  CouponStock,
  toggleCouponMarketingMapping,
} from '@/lib/promotions-api';

/**
 * React Query hook to fetch all platform coupons
 */
export function useAdminCoupons(panel?: 'admin' | 'marketing') {
  return useQuery<Coupon[]>({
    queryKey: ['admin', 'coupons', panel || 'default'],
    queryFn: () => getAllCoupons(panel),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * React Query mutation hook to toggle marketing panel mapping
 */
export function useToggleMarketingMappingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, mapToMarketing }: { id: string; mapToMarketing: boolean }) =>
      toggleCouponMarketingMapping(id, mapToMarketing),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
  });
}

/**
 * React Query mutation hook to create a new promotional coupon
 */
export function useCreateCouponMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCouponPayload) => createCoupon(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
  });
}

/**
 * React Query mutation hook to delete an unredeemed coupon
 */
export function useDeleteCouponMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCoupon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
  });
}

/**
 * React Query hook to fetch active stocks for coupon creation
 */
export function useCouponStocks() {
  return useQuery<CouponStock[]>({
    queryKey: ['admin', 'coupon-stocks'],
    queryFn: fetchCouponStocks,
    staleTime: 60 * 1000, // 1 minute
  });
}
