jest.mock('redis-service', () => ({}));
import { PaymentService } from './payment.service';

describe('Order messages wait for received payment', () => {
  let service: any;
  let prisma: any;
  let email: any;
  const order = {
    id: 'order-1', userId: 'user-1', orderNumber: 'ORD-123456',
    status: 'PAID', paymentStatus: 'PAID', receiptNumber: 'RCPT-123456',
    user: { email: 'test@example.com', fullName: 'Test' },
    stock: { name: 'Stock' }, quantity: 1, totalAmount: 100,
  };

  beforeEach(() => {
    prisma = { notification: { upsert: jest.fn() }, order: { update: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() } };
    email = { sendOrderConfirmationEmail: jest.fn(), sendOrderStatusUpdateEmail: jest.fn() };
    service = Object.create(PaymentService.prototype);
    Object.assign(service, { prisma, emailService: email, logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  });

  it.each(['PENDING', 'FAILED', 'USER_DROPPED', 'CANCELLED'])('sends neither message for %s payment', async paymentStatus => {
    await service.sendPaidOrderConfirmation({ ...order, paymentStatus });
    expect(email.sendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(prisma.notification.upsert).not.toHaveBeenCalled();
  });

  it.each(['EXPIRED', 'CANCELLED'])('does not confirm an unfulfillable %s order', async status => {
    await service.sendPaidOrderConfirmation({ ...order, status });
    expect(email.sendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(prisma.notification.upsert).not.toHaveBeenCalled();
  });

  it('persists confirmation work in the paid transaction without sending inline', async () => {
    prisma.$transaction = jest.fn(async (callback) => {
      const tx = { $queryRaw: jest.fn(), $executeRaw: jest.fn(), paymentAttempt: { updateMany: jest.fn() }, order: { findUnique: jest.fn().mockResolvedValue({ ...order, paymentStatus: 'PENDING' }), update: jest.fn().mockResolvedValue(order) } };
      prisma.outboxInsert = tx.$executeRaw;
      const result = await callback(tx);
      expect(email.sendOrderConfirmationEmail).not.toHaveBeenCalled();
      expect(prisma.notification.upsert).not.toHaveBeenCalled();
      return result;
    });
    service.generateVouchers = jest.fn();
    service.sanitizeOrder = jest.fn(value => value);
    await service.handlePaymentSuccess(order.id, 'payment-1', { ...order, paymentStatus: 'PENDING' });
    expect(email.sendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(prisma.notification.upsert).not.toHaveBeenCalled();
    expect(prisma.outboxInsert).toHaveBeenCalledTimes(3);
  });

  it('sends no message when saving the payment fails', async () => {
    prisma.$transaction = jest.fn().mockRejectedValue(new Error('database unavailable'));
    await expect(service.handlePaymentSuccess(order.id, 'payment-1', order)).rejects.toThrow('database unavailable');
    expect(email.sendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(prisma.notification.upsert).not.toHaveBeenCalled();
  });

  it('returns checkout failure without emailing an unpaid customer', async () => {
    prisma.order.update.mockResolvedValue({ ...order, paymentStatus: 'FAILED' });
    await expect(service.handlePaymentFailure(order.id, 'Not received')).rejects.toThrow('Not received');
    expect(email.sendOrderStatusUpdateEmail).not.toHaveBeenCalled();
    expect(email.sendOrderConfirmationEmail).not.toHaveBeenCalled();
    expect(prisma.notification.upsert).not.toHaveBeenCalled();
  });

  it('routes admin confirmation through the same atomic settlement path', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...order, paymentStatus: 'PENDING' });
    service.handlePaymentSuccess = jest.fn().mockResolvedValue({ success: true });
    await service.adminUpdatePaymentStatus(order.id, 'PAID', 'admin', 'admin@example.com');
    expect(service.handlePaymentSuccess).toHaveBeenCalledWith(order.id, undefined,
      expect.anything(), undefined, undefined, expect.objectContaining({ adminOverride: true, adminId: 'admin' }));
    expect(email.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });
});
