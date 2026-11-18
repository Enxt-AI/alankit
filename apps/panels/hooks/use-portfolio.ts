import { useQuery } from "@tanstack/react-query";
import { getMyPortfolio } from "@/lib/portfolio-api";
import type { PortfolioResponse } from "@/types/portfolio";

/**
 * Portfolio Query Hook
 * 
 * Fetches and caches user's portfolio data with automatic background refetching
 * Uses TanStack Query for efficient data management
 */
export function usePortfolio() {
  return useQuery<PortfolioResponse>({
    queryKey: ["portfolio"],
    queryFn: getMyPortfolio,
    staleTime: 120000, // 2 minutes - portfolio updates when orders complete
    gcTime: 300000, // 5 minutes - keep in cache for faster navigation
    refetchOnWindowFocus: false, // avoid unnecessary refetches
    retry: 1, // retry once on failure
  });
}
