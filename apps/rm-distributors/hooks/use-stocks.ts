import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth-headers";
import { apiFetch } from "@/lib/api-fetch";

export interface StockItem {
  id: string;
  name: string;
  cin?: string;
  isin?: string;
  symbol?: string;
  sellingPrice?: number;
  lendingPrice?: number;
  minQuantity?: number;
  availableQuantity?: number;
  category?: { id: string; name: string };
  sector?: string;
  [key: string]: any;
}

export async function fetchRmStocks(): Promise<StockItem[]> {
  const res = await apiFetch("/api/stocks/rm/all", {
    headers: { ...getAuthHeaders() },
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch stocks: ${res.statusText}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function useRmStocks() {
  return useQuery({
    queryKey: ["stocks", "rm-all"],
    queryFn: fetchRmStocks,
    staleTime: 60 * 1000,
  });
}
