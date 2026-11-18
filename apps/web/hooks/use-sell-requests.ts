import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSellRequest, getMySellRequests } from "@/lib/sell-requests-api";
import type { CreateSellRequestDto, SellRequestWithStock } from "@/types/sell-request";

export const SELL_REQUESTS_QUERY_KEY = ["my-sell-requests"];

export function useCreateSellRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateSellRequestDto) => createSellRequest(dto),
    onSuccess: () => {
      // Invalidate the query to fetch the updated list of sell requests
      queryClient.invalidateQueries({ queryKey: SELL_REQUESTS_QUERY_KEY });
    },
  });
}

export function useUserSellRequests() {
  return useQuery<SellRequestWithStock[], Error>({
    queryKey: SELL_REQUESTS_QUERY_KEY,
    queryFn: getMySellRequests,
  });
}
