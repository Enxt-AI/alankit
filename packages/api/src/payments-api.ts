import { stocksApi } from './api-client';
import {
  CreatePaymentOrderResponse,
  VerifyPaymentDto,
  VerifyPaymentResponse,
  PaymentStatusResponse,
} from '@/types/payment';

/**
 * Create a payment order for an existing order (Cashfree)
 */
export async function createPaymentOrder(orderId: string): Promise<CreatePaymentOrderResponse> {
  try {
    const response = await stocksApi.post<CreatePaymentOrderResponse>(
      `/payments/${orderId}/create`
    );
    return response.data;
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || 'Failed to create payment order';

      switch (status) {
        case 401:
          throw new Error('Please log in to continue with payment');
        case 404:
          throw new Error('Order not found. Please try creating a new order.');
        case 400:
          if (message.includes('KYC')) {
            throw new Error('KYC verification required before payment');
          }
          if (message.includes('status')) {
            throw new Error('Cannot process payment for this order status');
          }
          throw new Error(message);
        case 503:
          throw new Error('Payment gateway is temporarily unavailable. Please try again in a moment.');
        case 500:
          throw new Error('Payment service unavailable. Please try again later.');
        default:
          throw new Error(message);
      }
    }
    throw new Error('Network error. Please check your connection and try again.');
  }
}

/**
 * Verify payment after user completes Cashfree checkout
 */
export async function verifyPayment(dto: VerifyPaymentDto): Promise<VerifyPaymentResponse> {
  try {
    const response = await stocksApi.post<VerifyPaymentResponse>('/payments/verify', dto);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || 'Payment verification failed';

      switch (status) {
        case 401:
          throw new Error('Session expired. Please log in again.');
        case 404:
          throw new Error('Order not found. Payment cannot be verified.');
        case 400:
          if (message.includes('mismatch')) {
            throw new Error('Payment order ID mismatch. Please try again.');
          }
          throw new Error(message);
        case 500:
          throw new Error('Payment verification service error. Please contact support.');
        default:
          throw new Error(message);
      }
    }
    throw new Error('Network error during payment verification. Please contact support.');
  }
}

/**
 * Get payment status for an order
 */
export async function getPaymentStatus(orderId: string): Promise<PaymentStatusResponse> {
  try {
    const response = await stocksApi.get<PaymentStatusResponse>(`/payments/${orderId}`);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || 'Failed to fetch payment status';

      switch (status) {
        case 401:
          throw new Error('Please log in to view payment status');
        case 404:
          throw new Error('Payment information not found');
        case 400:
          throw new Error(message);
        case 500:
          throw new Error('Payment service unavailable. Please try again later.');
        default:
          throw new Error(message);
      }
    }
    throw new Error('Network error. Please check your connection and try again.');
  }
}
