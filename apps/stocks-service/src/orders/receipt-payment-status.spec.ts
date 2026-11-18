jest.mock('redis-service', () => ({ redis: {}, acquireProviderSlot: jest.fn() }));
import { OrdersService } from './orders.service';

describe('Receipt vouchers require successful payment', () => {
  it.each(['PENDING', 'PROCESSING', 'FAILED', 'USER_DROPPED', 'CANCELLED'])('rejects %s regardless of completed fulfilment', async paymentStatus => {
    const service: any = Object.create(OrdersService.prototype);
    service.logger = { log: jest.fn() };
    service.getCashfreeLedger = jest.fn();
    await service.generateReceiptVoucher({ id: 'order', paymentStatus, status: 'COMPLETED' });
    expect(service.getCashfreeLedger).not.toHaveBeenCalled();
  });
  it('does not generate a downloadable receipt for a completed but unpaid order', async () => {
    const service: any = Object.create(OrdersService.prototype);
    service.prisma = { order: { findUnique: jest.fn().mockResolvedValue({ id: 'order', userId: 'user', status: 'COMPLETED', paymentStatus: 'PENDING' }), update: jest.fn() } };
    await expect(service.generateReceipt('order', 'user')).rejects.toThrow('Payment is pending');
    expect(service.prisma.order.update).not.toHaveBeenCalled();
  });
});
