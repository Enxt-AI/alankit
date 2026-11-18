import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { stocksApi } from "@/lib/api-client";
import { SellRequestWithDetails } from "@/types/sell-request";

export const ADMIN_SELL_REQUESTS_QUERY_KEY = ["admin-sell-requests"];

export function useAdminSellRequests() {
  return useQuery<SellRequestWithDetails[], Error>({
    queryKey: ADMIN_SELL_REQUESTS_QUERY_KEY,
    queryFn: async () => {
      const response = await stocksApi.get<SellRequestWithDetails[]>("/admin/sell-requests");
      return response.data;
    },
  });
}

export function useUpdateSellRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      adminNote,
    }: {
      id: string;
      status: string;
      adminNote?: string;
    }) => {
      const response = await stocksApi.patch(`/admin/sell-requests/${id}/status`, {
        status,
        adminNote,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_SELL_REQUESTS_QUERY_KEY });
    },
  });
}
