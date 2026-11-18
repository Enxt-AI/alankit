/**
 * Order Status Constants
 *
 * Defines all valid order status values.
 * Must match Prisma schema Order.status field.
 *
 * Simplified model:
 *   PENDING   — Order created, awaiting payment
 *   COMPLETED — Payment succeeded, portfolio allocated
 */

export const OrderStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
} as const;

export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];
