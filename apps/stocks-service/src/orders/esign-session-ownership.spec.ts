jest.mock('redis-service', () => ({}));
import { OrdersService } from './orders.service';

describe('E-sign ownership before order creation', () => {
  let service: any;
  let prisma: any;
  beforeEach(() => {
    prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(null) },
      esignAttempt: { findFirst: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
    };
    service = Object.create(OrdersService.prototype);
    Object.assign(service, { prisma, logger: { error: jest.fn() } });
  });

  it.each(['doc-1', ' doc-1 ', 'doc-1?status=success', 'doc-1&status=success', 'doc-1#success'])(
    'resolves owned sign-first session %s before an order exists', async docId => {
      prisma.esignAttempt.findFirst.mockResolvedValue({ docId: 'doc-1', userId: 'user-1' });
      expect(await service.assertESignOwner(docId, 'user-1')).toBe('doc-1');
      expect(prisma.esignAttempt.findFirst).toHaveBeenCalledWith({ where: { docId: 'doc-1', userId: 'user-1' } });
    },
  );

  it('still rejects documents without ownership evidence', async () => {
    prisma.esignAttempt.findFirst.mockResolvedValue(null);
    await expect(service.assertESignOwner('doc-1', 'other-user')).rejects.toThrow('start a new purchase');
    expect(prisma.order.findFirst).toHaveBeenCalledWith({ where: { esignDocId: 'doc-1', userId: 'other-user' } });
  });

  it.each([null, {}, '', '?status=success'])('rejects malformed document ID %s', async docId => {
    await expect(service.assertESignOwner(docId, 'user-1')).rejects.toThrow();
    expect(prisma.order.findFirst).not.toHaveBeenCalled();
  });

  it('does not silently launch signing when the ownership record cannot be saved', async () => {
    prisma.esignAttempt.upsert.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.logEsignAttempt({ docId: 'doc-1', userId: 'user-1' })).rejects.toThrow('Unable to save your e-sign session');
  });

  it('persists the canonical document ID', async () => {
    await service.logEsignAttempt({ docId: ' doc-1 ', userId: 'user-1' });
    expect(prisma.esignAttempt.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { docId: 'doc-1' }, create: expect.objectContaining({ docId: 'doc-1', userId: 'user-1' }),
    }));
  });

  it('does not treat an Alankit signing callback as a KYC identity match', async () => {
    prisma.esignAttempt.findFirst.mockResolvedValue({ docId: 'ref-1', userId: 'user-1' });
    prisma.esignAttempt.findUnique.mockResolvedValue({
      docId: 'ref-1',
      userId: 'user-1',
      status: 'SIGNED',
      intent: { provider: 'ALANKIT' },
    });
    prisma.esignAttempt.update = jest.fn().mockResolvedValue({});
    prisma.order.updateMany = jest.fn().mockResolvedValue({ count: 0 });

    const result = await service.verifyESignIdentity('ref-1', 'user-1');

    expect(result.verdict).toBe('INSUFFICIENT_DATA');
    expect(prisma.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { esignValidationVerdict: 'INSUFFICIENT_DATA' },
    }));
  });
});
