type PaymentOrder = {
  status: string;
  paymentStatus: string;
  createdAt: string;
  expiresAt?: string | null;
};

export function paymentDeadline(order: PaymentOrder): number {
  return order.expiresAt
    ? new Date(order.expiresAt).getTime()
    : new Date(order.createdAt).getTime() + 24 * 60 * 60 * 1000;
}

export function isPaymentExpired(order: PaymentOrder, now = Date.now()): boolean {
  return order.status === 'EXPIRED' || (
    order.status === 'PENDING' && !['PAID', 'SUCCESS'].includes(order.paymentStatus) &&
    now >= paymentDeadline(order)
  );
}

export function canRetryOrderPayment(order: PaymentOrder, now = Date.now()): boolean {
  return order.status === 'PENDING' &&
    ['PENDING', 'PROCESSING', 'FAILED', 'USER_DROPPED', 'CANCELLED', 'EXPIRED', 'ABANDONED', 'ABANDONED_CHECKOUT', 'DECLINED'].includes(order.paymentStatus) &&
    now < paymentDeadline(order);
}
