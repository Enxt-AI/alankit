/**
 * Order Types
 * 
 * Type definitions for order-related data matching backend Prisma Order model
 * and API response structures.
 * 
 * Simplified model:
 *   OrderStatus:   PENDING | COMPLETED
 *   PaymentStatus: PENDING | FAILED | PAID
 */

/**
 * Order Status Enum
 * Matches backend OrderStatus enum values
 */
export enum OrderStatus {
  PENDING = 'PENDING',       // Order created, awaiting payment
  PAID = 'PAID',             // Order paid, awaiting manual admin approval
  COMPLETED = 'COMPLETED',   // Order complete, portfolio updated
}

/**
 * Payment Status Enum
 * Tracks payment lifecycle independently from order fulfillment
 */
export enum PaymentStatus {
  PENDING = 'PENDING',       // Payment not initiated
  PAID = 'PAID',            // Payment verified successfully
  FAILED = 'FAILED',        // Payment failed
  USER_DROPPED = 'USER_DROPPED', // User closed/dropped checkout popup
  CANCELLED = 'CANCELLED',   // Payment cancelled
  EXPIRED = 'EXPIRED',       // Payment session expired
}

/**
 * Order Interface
 * Matches Prisma Order model structure
 */
export interface Order {
  id: string;                // CUID
  orderNumber?: string | null; // Unified short order ID
  invoiceNumber?: string | null; // INV-XXXXXX (set on completion)
  receiptNumber?: string | null; // RCPT-XXXXXX (set on payment)
  userId: string;
  stockId?: string | null;   // Optional for basket orders
  basketId?: string | null;  // Optional basket ID for basket orders
  quantity: number;          // Integer, min 1
  pricePerShare: number;     // Price at time of order
  totalAmount: number;       // quantity × pricePerShare
  status: OrderStatus;
  shareTransferReferenceNo?: string | null;
  shareTransferDate?: string | null;
  basketConstituents?: any | null; // JSON snapshot of constituents at order time
  
  // Payment Integration (Cashfree)
  cashfreeOrderId?: string | null; 
  cashfreePaymentId?: string | null;
  paymentSessionId?: string | null;
  paymentStatus: PaymentStatus;        // Payment lifecycle status
  paymentData?: Record<string, any> | null; // Payment metadata
  
  createdAt: string;         // ISO date string
  updatedAt: string;         // ISO date string
}

/**
 * Create Order DTO
 * Data sent from frontend to create order
 * Matches backend CreateOrderDto validation rules
 */
export interface CreateOrderDto {
  stockId?: string;    // Optional - XOR with basketId
  basketId?: string;   // Optional - XOR with stockId
  quantity: number;   // Required, integer, min 1
}

/**
 * Order With Stock Interface
 * Order with populated stock details
 * Matches backend response from orders.service.ts
 */
export interface OrderWithStock extends Order {
  stock?: {
    id: string;
    name: string;
    cin: string;
    isin?: string | null;
    logoUrl: string | null;
  };
  basket?: {
    id: string;
    name: string;
    iconUrl: string | null;
  };
}

/**
 * Order With Details Interface
 * Order with populated stock and user details
 * Used in admin context for order management
 */
export interface OrderWithDetails extends OrderWithStock {
  batchSequence?: number | null;
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    kycStatus?: string;
    dematStatus?: string;
    dematData?: string | null;
    kycData?: any | null;
  };
}

/**
 * Update Order Status DTO
 * Data sent from admin frontend to update order status
 * Matches backend UpdateOrderStatusDto validation rules
 */
export interface UpdateOrderStatusDto {
  status: 'PENDING' | 'PAID' | 'COMPLETED';
  shareTransferReferenceNo?: string;
  shareTransferDate?: string;
  batchSequence?: string;
}
