import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { createOrder } from "@/lib/orders-api";
import type { CreateOrderDto, OrderWithStock } from "@/types/order";

/**
 * useCreateOrder Hook
 * 
 * TanStack Query mutation hook for creating orders
 * Automatically invalidates relevant queries on success
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation<OrderWithStock, Error, CreateOrderDto>({
    mutationFn: (dto: CreateOrderDto) => createOrder(dto),
    onSuccess: (order) => {
      // Invalidate stocks queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
      queryClient.invalidateQueries({ queryKey: ["stock", order.stockId] });

      // Invalidate baskets queries if this is a basket order
      if (order.basketId) {
        queryClient.invalidateQueries({ queryKey: ["baskets"] });
        queryClient.invalidateQueries({ queryKey: ["basket", order.basketId] });
      }

      // Invalidate portfolio query for future when portfolio updates automatically
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
    // Don't retry order creation automatically - let user decide
    retry: false,
  });
}

/**
 * useMyOrders Hook
 * 
 * TanStack Query hook for fetching user's orders
 */
export function useMyOrders() {
  return useQuery({
    queryKey: ["orders", "my"],
    queryFn: () => import("@/lib/orders-api").then(mod => mod.getMyOrders()),
  });
}

/**
 * useOrderById Hook
 * 
 * TanStack Query hook for fetching a single order
 */
export function useOrderById(id: string) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: () => import("@/lib/orders-api").then(mod => mod.getOrderById(id)),
    enabled: !!id,
  });
}

/**
 * useCancelOrder Hook
 * 
 * TanStack Query mutation hook for cancelling orders
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => import("@/lib/orders-api").then(mod => mod.cancelOrder(id)),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["orders", "my"] });
      queryClient.invalidateQueries({ queryKey: ["order", order.id] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] }); // Portfolio might change if we tracked pending orders
    },
  });
}
