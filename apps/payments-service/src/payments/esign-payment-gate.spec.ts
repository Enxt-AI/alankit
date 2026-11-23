import { PaymentService } from './payment.service';

describe('eSign payment identity gate', () => {
  it('does not open a payment session when signer identity is unverified', async () => {
    const order = {
      id: 'order-1',
      userId: 'user-1',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      esignStatus: 'SIGNED',
      esignValidationVerdict: 'INSUFFICIENT_DATA',
      expiresAt: new Date(Date.now() + 60_000),
      totalAmount: 100,
      user: { kycStatus: 'VERIFIED' },
      paymentData: {},
    };
    const transaction = {
      $queryRaw: jest.fn(),
      order: { findUnique: jest.fn().mockResolvedValue(order) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    const ndps = { checkout: jest.fn(), required: jest.fn() };
    const service = Object.create(PaymentService.prototype);
    Object.assign(service, { prisma, ndps });

    await expect(service.createPaymentOrder(order.id, order.userId))
      .rejects.toThrow('verified KYC identity match');
    expect(ndps.checkout).not.toHaveBeenCalled();
  });
});
