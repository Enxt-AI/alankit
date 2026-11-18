import { stocksApi } from "@/lib/api-client";
import type { CreateOrderDto, OrderWithStock, OrderWithDetails, UpdateOrderStatusDto } from "@/types/order";

/**
 * Create Order API
 * 
 * Creates a new order for the authenticated user
 * Uses stocksApi instance which includes JWT token interceptor
 */
export async function createOrder(
  dto: CreateOrderDto
): Promise<OrderWithStock> {
  try {
    const response = await stocksApi.post<OrderWithStock>("/orders", dto);
    return response.data;
  } catch (error: any) {
    // Handle specific error codes
    if (error.response) {
      const status = error.response.status;
      const serverMessage = error.response.data?.message;

      // Check for KYC-related errors first (before other message handling)
      if (typeof serverMessage === 'string' && serverMessage.includes('KYC verification')) {
        throw new Error('Please complete your KYC verification before purchasing stocks. You will be redirected to the KYC page.');
      }

      // Use server-provided error message if available
      if (serverMessage) {
        // Handle array messages from class-validator
        if (Array.isArray(serverMessage)) {
          throw new Error(serverMessage.join(', '));
        }
        // Handle object messages
        if (typeof serverMessage === 'object') {
          throw new Error(JSON.stringify(serverMessage));
        }
        // Handle string messages
        throw new Error(serverMessage);
      }

      // Fallback to status-based messages
      if (status === 404) {
        throw new Error("Stock not found or no longer available");
      }

      if (status === 400) {
        throw new Error("Stock is not available for purchase");
      }

      if (status === 401) {
        throw new Error("Please log in to place an order");
      }

      if (status >= 500) {
        throw new Error("Server error. Please try again later");
      }
    }

    // Network errors
    if (error.request && !error.response) {
      throw new Error("Failed to place order. Please check your connection.");
    }

    // Generic error
    throw new Error(
      error.message || "Unable to place order. Please try again."
    );
  }
}

/**
 * Get My Orders
 * 
 * Fetches all orders for the current user
 * Returns simplified order objects with stock/basket details
 */
export async function getMyOrders(): Promise<OrderWithStock[]> {
  try {
    const response = await stocksApi.get<OrderWithStock[]>("/orders/my-orders");
    return response.data;
  } catch (error: any) {
    if (!error.response) {
      throw new Error("Failed to load orders. Please check your connection.");
    }
    throw new Error("Unable to load orders. Please try again.");
  }
}

/**
 * Get Order By ID
 * 
 * Fetches a single order by ID
 * User can only access their own orders
 */
export async function getOrderById(id: string): Promise<OrderWithStock> {
  try {
    const response = await stocksApi.get<OrderWithStock>(`/orders/${id}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error("Order not found.");
    }
    throw new Error("Unable to load order details.");
  }
}

/**
 * Get Order By ID (Admin)
 * 
 * Fetches a single order by ID with full admin details (stock, user, coupon, pricing).
 * Used by the accounting voucher detail page to display pricing breakdown.
 */
export async function getOrderByIdAdmin(id: string): Promise<any> {
  try {
    const response = await stocksApi.get(`/orders/admin/${id}`);
    return response.data;
  } catch {
    return null; // Silently fail — this is supplementary display data
  }
}

/**
 * Cancel Order
 * 
 * Cancels a pending order
 * Only applicable for orders in PENDING status
 */
export async function cancelOrder(id: string): Promise<OrderWithStock> {
  try {
    const response = await stocksApi.put<OrderWithStock>(`/orders/${id}/cancel`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 400) {
      const message = error.response.data?.message;
      throw new Error(message || "Cannot cancel this order.");
    }
    throw new Error("Unable to cancel order. Please try again.");
  }
}

/**
 * Get All Orders (Admin)
 * 
 * Fetches all orders with optional status filter
 * Includes populated stock and user details
 * Requires admin authentication and update_orders permission
 * 
 * @param status - Optional status filter (PENDING, COMPLETED)
 * @returns Promise<OrderWithDetails[]> Array of orders with full details
 * @throws Error with user-friendly message if request fails
 */
export async function getAllOrdersAdmin(status?: string): Promise<OrderWithDetails[]> {
  try {
    const url = status ? `/orders/admin/all?status=${status}` : '/orders/admin/all';
    const response = await stocksApi.get<OrderWithDetails[]>(url);
    return response.data;
  } catch (error: any) {
    // Network errors
    if (!error.response) {
      throw new Error('Failed to load orders. Please check your connection.');
    }

    // Forbidden (no permission)
    if (error.response.status === 403) {
      throw new Error('You do not have permission to view orders.');
    }

    // Server errors (5xx)
    if (error.response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }

    // Generic error
    throw new Error('Unable to load orders. Please try again.');
  }
}

/**
 * Update Order Status (Admin)
 * 
 * Updates the status of an order
 * Requires admin authentication and update_orders permission
 * 
 * @param orderId - Order ID (CUID)
 * @param status - New status value
 * @returns Promise<OrderWithDetails> Updated order with full details
 * @throws Error with user-friendly message if request fails
 */
export async function updateOrderStatus(
  orderId: string,
  data: UpdateOrderStatusDto
): Promise<OrderWithDetails> {
  try {
    const response = await stocksApi.put<OrderWithDetails>(
      `/orders/admin/${orderId}/status`,
      data
    );
    return response.data;
  } catch (error: any) {
    // Network errors
    if (!error.response) {
      throw new Error('Failed to update order. Please check your connection.');
    }

    // Not found
    if (error.response.status === 404) {
      throw new Error('Order not found.');
    }

    // Forbidden (no permission)
    if (error.response.status === 403) {
      throw new Error('You do not have permission to update orders.');
    }

    // Bad request (invalid status)
    if (error.response.status === 400) {
      const serverMessage = error.response.data?.message;
      if (serverMessage) {
        throw new Error(Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage);
      }
      throw new Error('Invalid status value.');
    }

    // Server errors (5xx)
    if (error.response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }

    // Generic error
    throw new Error('Unable to update order. Please try again.');
  }
}

/**
 * Update Payment Status (Admin)
 * 
 * Updates the payment status of an order
 * Requires admin authentication and update_orders permission
 * 
 * @param orderId - Order ID (CUID)
 * @param paymentStatus - New payment status value (PENDING, PROCESSING, PAID, FAILED)
 * @returns Promise<{ success: boolean; message: string; order: any }> Success response with updated order
 * @throws Error with user-friendly message if request fails
 */
export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: string
): Promise<{ success: boolean; message: string; order: any }> {
  try {
    const response = await stocksApi.put(
      `/payments/admin/${orderId}/status`,
      { paymentStatus }
    );
    return response.data;
  } catch (error: any) {
    // Network errors
    if (!error.response) {
      throw new Error('Failed to update payment status. Please check your connection.');
    }

    // Not found
    if (error.response.status === 404) {
      throw new Error('Order not found.');
    }

    // Forbidden (no permission)
    if (error.response.status === 403) {
      throw new Error('You do not have permission to update payment status.');
    }

    // Bad request (invalid status)
    if (error.response.status === 400) {
      const serverMessage = error.response.data?.message;
      if (serverMessage) {
        throw new Error(Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage);
      }
      throw new Error('Invalid payment status value.');
    }

    // Server errors (5xx)
    if (error.response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }

    // Generic error
    throw new Error('Unable to update payment status. Please try again.');
  }
}
