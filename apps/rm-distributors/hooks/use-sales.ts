import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth-headers";
import { apiFetch } from "@/lib/api-fetch";

export interface SaleTransaction {
  id: string;
  orderNumber?: string;
  totalAmount: number;
  quantity: number;
  pricePerShare: number;
  sellingPrice: number;
  discountOffered: number;
  discountedPrice: number;
  lendingPrice: number;
  revenuePerShare: number;
  rmRevenue: number;
  yourShare: number;
  rmIncentive?: number;
  revenueSharePercentage?: number;
  incentivePercentage?: number;
  createdAt: string;
  status: string;
  stock: {
    id?: string;
    name: string;
    cin?: string;
    isin?: string;
    price?: number;
    externalLendingPrice?: number;
    internalLendingPrice?: number;
  } | null;
  basket: { name: string; category: string } | null;
  user: { fullName: string; email: string; phone?: string };
  coupon: {
    code: string;
    discountAmount: number;
    discountType?: string;
    discountPercentage?: number;
    relationshipManager: { name: string; email: string };
  };
}

export interface SalesStats {
  totalTransactions: number;
  totalRevenue: number;
  totalMargin?: number;
  yourShare: number;
  totalIncentive?: number;
  revenueSharePercentage: number;
  incentivePercentage?: number;
  isExternal?: boolean;
}

export function useDistributorSales() {
  return useQuery<SaleTransaction[]>({
    queryKey: ["sales", "distributor-transactions"],
    queryFn: async (): Promise<SaleTransaction[]> => {
      const res = await apiFetch("/api/orders/distributor/sales", {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch sales transactions");
      const data = await res.json();
      return Array.isArray(data) ? data : (data.sales || []);
    },
    staleTime: 60 * 1000,
  });
}

export function useDistributorSalesStats() {
  return useQuery({
    queryKey: ["sales", "distributor-stats"],
    queryFn: async (): Promise<SalesStats> => {
      const res = await apiFetch("/api/orders/distributor/sales-stats", {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch sales statistics");
      const data = await res.json();
      return {
        totalTransactions: data.totalTransactions || 0,
        totalRevenue: data.totalRevenue || 0,
        totalMargin: data.totalMargin || 0,
        yourShare: data.yourShare || 0,
        totalIncentive: data.totalIncentive || 0,
        revenueSharePercentage: data.revenueSharePercentage || 0,
        incentivePercentage: data.incentivePercentage || 0,
        isExternal: data.isExternal ?? true,
      };
    },
    staleTime: 60 * 1000,
  });
}
