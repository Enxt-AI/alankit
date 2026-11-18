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
 * Validate Coupon API
 * 
 * Validates a coupon code and returns expected discount
 */
export async function validateCoupon(
  code: string,
  stockId: string,
  quantity: number
): Promise<{ isValid: boolean; discountAmount: number; couponId: string; code: string; discountType?: string; discountPercentage?: number; minQuantity: number; maxQuantity: number; }> {
  try {
    const response = await stocksApi.post("/stocks/coupons/validate", { code, stockId, quantity });
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(Array.isArray(error.response.data.message) ? error.response.data.message.join(', ') : error.response.data.message);
    }
    throw new Error("Failed to validate coupon");
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


// NOTE: cancelOrder function removed — orders are no longer cancellable.
// Failed payments leave orders in PENDING state for retry.

// Keep the key through transport failures so Retry addresses the same purchase.
// Keys are scoped to the authenticated user again on the server.
const pendingESignRequests = new Map<string, string>();

async function requestESign<T>(url: string, body: unknown, explicitRequestId?: string): Promise<T> {
  const intentKey = JSON.stringify([url, body]);
  const requestId = explicitRequestId ?? pendingESignRequests.get(intentKey) ?? crypto.randomUUID();
  if (!explicitRequestId) pendingESignRequests.set(intentKey, requestId);
  try {
    const response = await stocksApi.post<T>(url, body, {
      headers: { 'x-idempotency-key': requestId },
    });
    if (pendingESignRequests.get(intentKey) === requestId) pendingESignRequests.delete(intentKey);
    return response.data;
  } catch (error: any) {
    // Do not rotate the key on a timeout: Digitap may already have created it.
    throw new Error(error.response?.data?.message || 'Unable to establish e-Sign connection. Please try again.');
  }
}

export async function generateESign(orderId: string, requestId?: string): Promise<{ docId: string }> {
  return requestESign('/orders/' + orderId + '/generate-esign', undefined, requestId);
}

export interface ESignSessionIntent {
  stockId?: string;
  basketId?: string;
  quantity: number;
  couponCode?: string;
  stockPrice?: number;
  discountedPrice?: number;
  discountedPricePerShare?: number;
  pricePerShare?: number;
}

export async function generateESignSession(
  intent: ESignSessionIntent,
  requestId?: string,
): Promise<{ docId: string; eSignUrl: string; pdfUrl: string }> {
  // Normalize order and optional values for the in-memory retry key.
  const body = {
    stockId: intent.stockId,
    basketId: intent.basketId,
    quantity: intent.quantity,
    couponCode: intent.couponCode,
    stockPrice: intent.stockPrice,
    discountedPrice: intent.discountedPrice,
    discountedPricePerShare: intent.discountedPricePerShare,
    pricePerShare: intent.pricePerShare,
  };
  return requestESign('/orders/generate-esign-session', body, requestId);
}

/**
 * Verify E-Sign Identity
 *
 * Synchronous identity gate — calls the backend to fetch the signed document
 * from Digitap and validate the signer's Aadhaar identity against our KYC records.
 * Must be called BEFORE createOrder to block mismatched Aadhaar signers.
 *
 * @param docId  Digitap document ID from the e-sign session
 * @returns { verdict: 'MATCH' | 'MISMATCH' | 'INSUFFICIENT_DATA', reason: string }
 */
export async function verifyESignIdentity(
  docId: string,
): Promise<{ verdict: string; reason: string }> {
  try {
    const response = await stocksApi.post<{ verdict: string; reason: string }>(
      '/orders/verify-esign-identity',
      { docId },
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error('Unable to verify e-Sign identity. Please try again.');
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
  status: UpdateOrderStatusDto['status']
): Promise<OrderWithDetails> {
  try {
    const response = await stocksApi.put<OrderWithDetails>(
      `/orders/admin/${orderId}/status`,
      { status }
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
 * @param paymentStatus - New payment status value (PENDING, PAID, FAILED)
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

/**
 * Download Invoice PDF (User)
 *
 * Calls GET /orders/:id/invoice, receives the filled PDF from the backend
 * and triggers a browser download dialog.
 *
 * @param orderId   Order ID (must be in COMPLETED status)
 */
export async function downloadOrderInvoice(orderId: string): Promise<void> {
  try {
    const response = await stocksApi.get(`/orders/${orderId}/invoice`, {
      responseType: 'blob',
      // PDF rendering has its own 30s budget, in addition to database/page setup.
      timeout: 60_000,
    });

    // Create a temporary anchor to trigger the browser download
    const url = window.URL.createObjectURL(
      new Blob([response.data], { type: 'application/pdf' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `invoice-${orderId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    // Backend sends errors as blobs because of responseType:'blob'
    if (error.response?.data instanceof Blob) {
      const text = await error.response.data.text();
      try {
        const json = JSON.parse(text);
        throw new Error(json.message || 'Failed to download invoice.');
      } catch {
        throw new Error('Failed to download invoice.');
      }
    }
    throw new Error(error.message || 'Failed to download invoice.');
  }
}
