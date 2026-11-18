jest.mock('redis-service', () => ({ acquireProviderSlot: jest.fn().mockResolvedValue(true) }));
import { PaymentService } from './payment.service';
import { runIntegrationTasks } from 'db-unlistedstock';

describe('Payment settlement and recovery', () => {
  let service: any;
  let db: any;
  let current: any;
  beforeEach(() => {
    current = { id: 'order-1', userId: 'user-1', paymentStatus: 'PENDING', status: 'PENDING', receiptNumber: 'RCPT-1', totalAmount: 100 };
    db = {
      $queryRaw: jest.fn(), $executeRaw: jest.fn(),
      order: {
        findUnique: jest.fn(async () => ({ ...current })),
        findUniqueOrThrow: jest.fn(async () => ({ ...current })),
        update: jest.fn(async ({ data }) => Object.assign(current, data)),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      paymentAttempt: { findUnique: jest.fn().mockResolvedValue({ status: 'PAID' }), update: jest.fn(), updateMany: jest.fn() },
    };
    // Model the order-row lock; real PostgreSQL contention is a separate integration check.
    let tail = Promise.resolve();
    db.$transaction = jest.fn(callback => {
      const work = tail.then(() => callback(db));
      tail = work.catch(() => {});
      return work;
    });
    service = Object.create(PaymentService.prototype);
    service.generateVouchers = jest.fn();
    Object.assign(service, { prisma: db, paymentQueue: { add: jest.fn().mockResolvedValue({}) }, logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  });
  it('repairs a previously paid attempt whose order was not settled', async () => {
    await service.settleAttempt('attempt-1', current.id, 'cf-payment', current);
    expect(current.paymentStatus).toBe('PAID');
    expect(db.$executeRaw).toHaveBeenCalledTimes(3);
  });
  it('concurrent successes create follow-up work only for the winning transition', async () => {
    await Promise.all([1, 2, 3].map(() => service.handlePaymentSuccess(current.id, 'cf-payment', { ...current })));
    expect(db.order.update).toHaveBeenCalledTimes(1);
    expect(db.$executeRaw).toHaveBeenCalledTimes(3);
    expect(db.$queryRaw.mock.calls[0][0].join('')).toContain('FOR UPDATE');
  });
  it('does not mark attempts paid outside the settlement transaction', async () => {
    db.$transaction.mockRejectedValue(new Error('database unavailable'));
    await expect(service.settleAttempt('attempt-1', current.id, 'cf-payment', current)).rejects.toThrow();
    expect(db.paymentAttempt.update).not.toHaveBeenCalled();
  });
  it('guards failure writes against a concurrently paid order', async () => {
    await expect(service.handlePaymentFailure(current.id, 'failed')).rejects.toThrow();
    expect(db.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: current.id, paymentStatus: { not: 'PAID' } } }));
  });
  it('status reads enqueue recovery without contacting the provider', async () => {
    current.cashfreeOrderId = 'cf-order';
    service.fetchCashfreeOrderStatus = jest.fn();
    await service.getPaymentStatus(current.id, current.userId);
    expect(service.fetchCashfreeOrderStatus).not.toHaveBeenCalled();
    expect(service.paymentQueue.add).toHaveBeenCalledTimes(1);
  });
  it('outbox failures stay retryable and batch claims use SKIP LOCKED', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'task', kind: 'PAYMENT_ACCOUNTING', entityId: current.id, attempts: 1 }]);
    const report = jest.fn();
    await runIntegrationTasks(db, ['PAYMENT_ACCOUNTING'], async () => { throw new Error('provider failure'); }, report);
    expect(db.$queryRaw.mock.calls[0][0].join('')).toContain('SKIP LOCKED');
    expect(db.$executeRaw.mock.calls[0][0].join('')).toContain('"lastError"');
    expect(db.$executeRaw.mock.calls[0][0].join('')).not.toContain('"completedAt" = NOW()');
    expect(report).toHaveBeenCalledTimes(1);
  });
  it.each(['PENDING', 'PROCESSING', 'FAILED', 'USER_DROPPED', 'CANCELLED'])('does not create a receipt for %s even if the order is completed', async paymentStatus => {
    service.generateVouchers = PaymentService.prototype['generateVouchers'];
    service.getCashfreeLedger = jest.fn();
    await service.generateVouchers({ ...current, paymentStatus, status: 'COMPLETED' });
    expect(service.getCashfreeLedger).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('five simultaneous successful payments get five different vouchers; redeliveries create none', async () => {
    service.generateVouchers = PaymentService.prototype['generateVouchers'];
    service.getCashfreeLedger = jest.fn().mockResolvedValue({ id: 'bank' });
    service.findOrCreateUserLedger = jest.fn().mockResolvedValue({ id: 'user' });
    const vouchers = new Map<string, string>();
    let sequence = 100;
    db.$queryRaw.mockImplementation(async (sql: any) => sql.join('').includes('VoucherSequence') ? [{ value: BigInt(++sequence) }] : []);
    db.voucher = {
      findUnique: jest.fn(async ({ where }) => vouchers.has(where.voucherNumber) ? { id: 'existing' } : null),
      findFirst: jest.fn(async ({ where }) => vouchers.has(where.metadata.equals) ? { id: 'existing' } : null),
      create: jest.fn(async ({ data }) => { vouchers.set(data.metadata.orderId, data.voucherNumber); return data; }),
    };
    db.ledger = { update: jest.fn() };
    const order = { ...current, paymentStatus: 'PAID', user: { fullName: 'Test' } };
    const ids = ['first', 'second', 'third', 'fourth', 'fifth'];
    await Promise.all([...ids, ...ids].map(id => service.generateVouchers({ ...order, id, userId: `user-${id}`, cashfreePaymentId: `payment-${id}` })));
    expect([...vouchers.values()]).toEqual(['RCP-0101', 'RCP-0102', 'RCP-0103', 'RCP-0104', 'RCP-0105']);
    expect(new Set(vouchers.values()).size).toBe(5);
    expect(db.voucher.create).toHaveBeenCalledTimes(5);
    expect(db.ledger.update).toHaveBeenCalledTimes(10);
    for (const [call] of db.voucher.create.mock.calls) {
      expect(call.data.entries.create).toEqual([
        expect.objectContaining({ ledgerId: 'bank', entryType: 'DEBIT', amount: 100 }),
        expect.objectContaining({ ledgerId: 'user', entryType: 'CREDIT', amount: 100 }),
      ]);
    }
    expect(db.ledger.update.mock.calls.filter(([call]) => call.where.id === 'bank')
      .reduce((sum, [call]) => sum + Number(call.data.currentBalance.increment), 0)).toBe(500);
    expect(db.ledger.update.mock.calls.filter(([call]) => call.where.id === 'user')
      .reduce((sum, [call]) => sum + Number(call.data.currentBalance.increment), 0)).toBe(-500);
  });
  it('keeps the existing active customer ledger without relinking it', async () => {
    db.ledger = { findFirst: jest.fn().mockResolvedValue({ id: 'existing-customer-ledger' }), update: jest.fn(), create: jest.fn() };
    const ledger = await service.findOrCreateUserLedger({ id: 'user-1', email: 'customer@example.test' });
    expect(ledger.id).toBe('existing-customer-ledger');
    expect(db.ledger.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { type: 'USER', email: 'customer@example.test', isActive: true } }));
    expect(db.ledger.update).not.toHaveBeenCalled();
    expect(db.ledger.create).not.toHaveBeenCalled();
  });
  it('preserves reconciliation/settlement fields when a successful webhook arrives', async () => {
    current.paymentData = { reconciliation_status: 'RECONCILED', transfer_utr: 'UTR-1', cf_settlement_id: 'settlement-1', settlement_amount: 97.64 };
    db.paymentAttempt.findFirst = jest.fn().mockResolvedValue(null);
    db.order.findFirst = jest.fn(async () => ({ ...current }));
    const body = { type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: current.id }, payment: { payment_status: 'SUCCESS', cf_payment_id: 'payment-1', payment_amount: 100, payment_currency: 'INR', bank_reference: 'BANK-1' } } };
    await service.processWebhookPayload({ body });
    expect(current.paymentData).toEqual(expect.objectContaining({ reconciliation_status: 'RECONCILED', transfer_utr: 'UTR-1', cf_settlement_id: 'settlement-1', settlement_amount: 97.64, bank_reference: 'BANK-1', cf_payment_id: 'payment-1', rawWebhookPayload: body }));
  });
  it('still recovers a successful payment while gateway order status has not caught up', async () => {
    current.orderNumber = 'ORD-1';
    service.fetchCashfreeOrderStatus = jest.fn().mockResolvedValue({ order_status: 'ACTIVE', cf_order_id: 'cf-1' });
    service.fetchCashfreePaymentDetails = jest.fn().mockResolvedValue([{ payment_status: 'SUCCESS', cf_payment_id: 'payment-1' }]);
    service.handlePaymentSuccess = jest.fn();
    await service.reconcileOrder(current.id);
    expect(service.handlePaymentSuccess).toHaveBeenCalledWith(current.id, 'payment-1', expect.anything(), 'cf-1', undefined);
  });
});
