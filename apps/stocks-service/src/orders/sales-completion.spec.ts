jest.mock('redis-service', () => ({ redis: {}, acquireProviderSlot: jest.fn() }));
import { OrdersService } from './orders.service';

describe('Sales vouchers require Operations completion', () => {
  const transfer = { shareTransferReferenceNo: 'REF-1', shareTransferDate: '2026-10-08', batchSequence: 'BATCH-1' };
  it.each(['shareTransferReferenceNo', 'shareTransferDate', 'batchSequence'])('rejects completion without %s before changing the order', async field => {
    const service: any = Object.create(OrdersService.prototype);
    service.prisma = { order: { findUnique: jest.fn().mockResolvedValue({ id: 'order', status: 'PAID' }) }, $transaction: jest.fn() };
    await expect(service.updateOrderStatus('order', { status: 'COMPLETED', ...transfer, [field]: ' ' })).rejects.toThrow('requires a transfer');
    expect(service.prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects an invalid transfer date', async () => {
    const service: any = Object.create(OrdersService.prototype);
    await expect(service.generateSalesVoucher({ status: 'COMPLETED', ...transfer, shareTransferDate: 'invalid' })).rejects.toThrow('valid transfer date');
  });
  it.each(['PENDING', 'PAID'])('payment/order status %s alone does not create a sales voucher', async status => {
    const service: any = Object.create(OrdersService.prototype);
    service.getOrCreateSalesLedger = jest.fn();
    await expect(service.generateSalesVoucher({ status, paymentStatus: 'PAID', ...transfer })).rejects.toThrow('completed order');
    expect(service.getOrCreateSalesLedger).not.toHaveBeenCalled();
  });
  it('generates sales during completion only after all transfer details are saved', async () => {
    const service: any = Object.create(OrdersService.prototype);
    const order = { id: 'order', status: 'PAID', paymentStatus: 'PAID', invoiceNumber: 'INV-1', receiptNumber: 'RCPT-1' };
    const tx = { $queryRaw: jest.fn(), order: { findUnique: jest.fn().mockResolvedValue(order), update: jest.fn(async ({ data }) => ({ ...order, ...data, user: { email: null } })) } };
    service.prisma = { order: { findUnique: jest.fn().mockResolvedValue(order), findFirst: jest.fn().mockResolvedValue(null) }, $transaction: jest.fn(async callback => callback(tx)) };
    service.generateSalesVoucher = jest.fn();
    service.generateReceiptVoucher = jest.fn();
    const result = await service.updateOrderStatus(order.id, { status: 'COMPLETED', ...transfer });
    expect(result.status).toBe('COMPLETED');
    expect(service.generateSalesVoucher).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED', shareTransferReferenceNo: 'REF-1', shareTransferDate: new Date('2026-10-08'), batchSequence: 'BATCH-1' }), tx);
    expect(tx.order.update.mock.invocationCallOrder[0]).toBeLessThan(service.generateSalesVoucher.mock.invocationCallOrder[0]);
  });
});
