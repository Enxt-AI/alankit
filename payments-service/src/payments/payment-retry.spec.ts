jest.mock('redis-service', () => ({}));
import { PaymentService } from './payment.service';

describe('Payment retry window', () => {
  let service: any;
  let prisma: any;
  let order: any;
  beforeEach(() => {
    order = { id: 'order-1', userId: 'user-1', status: 'PENDING', paymentStatus: 'USER_DROPPED', createdAt: new Date(), expiresAt: new Date(Date.now() + 86400000) };
    prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      user: { findUnique: jest.fn().mockResolvedValue({ kycStatus: 'VERIFIED' }) },
      paymentAttempt: { findFirst: jest.fn().mockResolvedValue({ id: 'attempt-1', status: 'USER_DROPPED', cashfreeOrderId: 'cf-1', paymentSessionId: 'session-1', amount: 100 }) },
    };
    service = Object.create(PaymentService.prototype);
    Object.assign(service, { prisma, logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
    service.fetchCashfreeOrderStatus = jest.fn().mockResolvedValue({ order_status: 'ACTIVE' });
  });
  it('reuses a closed checkout before expiry', async () => {
    const result = await service.createPaymentOrder(order.id, order.userId);
    expect(result.paymentSessionId).toBe('session-1');
    expect(prisma.paymentAttempt.findFirst.mock.calls[0][0].where.status.in).toContain('USER_DROPPED');
  });
  it('rejects an expired order even before the expiry worker has run', async () => {
    order.expiresAt = new Date(Date.now() - 1);
    await expect(service.createPaymentOrder(order.id, order.userId)).rejects.toThrow('expired');
    expect(service.fetchCashfreeOrderStatus).not.toHaveBeenCalled();
  });
  it('does not open checkout if the existing gateway session is already paid', async () => {
    service.fetchCashfreeOrderStatus.mockResolvedValue({ order_status: 'PAID' });
    await expect(service.createPaymentOrder(order.id, order.userId)).rejects.toThrow('already paid');
  });
});
