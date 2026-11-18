import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth-headers";
import { apiFetch } from "@/lib/api-fetch";

export interface CouponItem {
  id: string;
  code: string;
  stockId?: string;
  stock?: { id: string; name: string; sellingPrice?: number; lendingPrice?: number };
  discountAmount?: number;
  discountType?: string;
  discountValue?: number;
  expiresAt?: string;
  maxUses?: number;
  usedCount?: number;
  isActive?: boolean;
  createdAt: string;
  [key: string]: any;
}

export interface CouponStats {
  totalCoupons: number;
  usedCoupons: number;
  availableCoupons: number;
  totalGenerated?: number;
  activeCoupons?: number;
  totalConversions?: number;
  totalVolume?: number;
}

export function useRmCoupons() {
  return useQuery({
    queryKey: ["coupons", "rm-list"],
    queryFn: async (): Promise<CouponItem[]> => {
      const res = await apiFetch("/api/stocks/coupons", {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch coupons");
      const data = await res.json();
      return Array.isArray(data) ? data : (data.coupons || []);
    },
    staleTime: 30 * 1000,
  });
}

export function useRmCouponStats() {
  return useQuery({
    queryKey: ["coupons", "stats"],
    queryFn: async (): Promise<CouponStats> => {
      const res = await apiFetch("/api/stocks/coupons/stats", {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch coupon stats");
      const data = await res.json();
      return {
        totalCoupons: data.totalCoupons ?? data.totalGenerated ?? 0,
        usedCoupons: data.usedCoupons ?? data.totalConversions ?? 0,
        availableCoupons: data.availableCoupons ?? data.activeCoupons ?? 0,
        totalGenerated: data.totalGenerated ?? data.totalCoupons ?? 0,
        activeCoupons: data.activeCoupons ?? data.availableCoupons ?? 0,
        totalConversions: data.totalConversions ?? data.usedCoupons ?? 0,
        totalVolume: data.totalVolume ?? 0,
      };
    },
    staleTime: 30 * 1000,
  });
}

export function useRmSalesStats() {
  return useQuery({
    queryKey: ["coupons", "sales-stats"],
    queryFn: async () => {
      const res = await apiFetch("/api/stocks/coupons/sales-stats", {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch RM sales stats");
      return await res.json();
    },
    staleTime: 60 * 1000,
  });
}

export function useGenerateCoupon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiFetch("/api/stocks/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to generate coupon");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
    },
  });
}

export function useDeleteCoupon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (couponId: string) => {
      const res = await apiFetch(`/api/stocks/coupons/${couponId}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to delete coupon");
      }
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
    },
  });
}
