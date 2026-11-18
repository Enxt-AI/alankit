import { OrderWithStock } from './order';

/**
 * Response from creating a payment order (Cashfree)
 */
export interface CreatePaymentOrderResponse {
  cashfreeOrderId: string;
  paymentSessionId: string;
  amount: number;
  currency: string;
  environment?: 'production' | 'sandbox';
}

/**
 * DTO for verifying payment (Cashfree)
 */
export interface VerifyPaymentDto {
  orderId: string;
  cashfreeOrderId: string;
}

/**
 * Response from verifying payment
 */
export interface VerifyPaymentResponse {
  success: boolean;
  message: string;
  order: OrderWithStock;
}

/**
 * Response from getting payment status
 */
export interface PaymentStatusResponse {
  orderId: string;
  paymentStatus: string;
  cashfreeOrderId: string | null;
  cashfreePaymentId: string | null;
  amount: number;
  paymentData: Record<string, any> | null;
}
