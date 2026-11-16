jest.mock('redis-service', () => ({}));
import { OrdersService } from './orders.service';

describe('Signed deal sheet access and recovery', () => {
  let service: OrdersService;
  let prisma: any;
  let archive: any;
  beforeEach(() => {
    service = Object.create(OrdersService.prototype);
    prisma = { order: { findFirst: jest.fn() }, esignAttempt: { findUnique: jest.fn(), findFirst: jest.fn() } };
    archive = { read: jest.fn() };
    Object.assign(service, { prisma, signedDealSheets: archive, esignQueue: { add: jest.fn() } });
  });

  it('does not access storage or Digitap for another user order', async () => {
    prisma.order.findFirst.mockResolvedValue(null);
    await expect(service.downloadSignedDealSheet('order-1', 'other-user')).rejects.toThrow('not available');
    expect(prisma.order.findFirst).toHaveBeenCalledWith({ where: { id: 'order-1', userId: 'other-user' } });
    expect(archive.read).not.toHaveBeenCalled();
  });

  it('serves archived bytes without calling Digitap', async () => {
    const pdf = Buffer.from('%PDF-signed');
    prisma.order.findFirst.mockResolvedValue({ esignDocId: 'doc-1' });
    archive.read.mockResolvedValue(pdf);
    const fetchDoc = jest.spyOn(service, 'getESignDoc');
    expect(await service.downloadSignedDealSheet('order-1', 'user-1')).toEqual(pdf);
    expect(fetchDoc).not.toHaveBeenCalled();
  });

  it('recovers a legacy document through a fresh Digitap lookup', async () => {
    const pdf = Buffer.from('%PDF-signed');
    prisma.order.findFirst.mockResolvedValue({ esignDocId: 'doc-1' });
    archive.read.mockResolvedValueOnce(null).mockResolvedValueOnce(pdf);
    const fetchDoc = jest.spyOn(service, 'getESignDoc').mockResolvedValue({});
    expect(await service.downloadSignedDealSheet('order-1', 'user-1')).toEqual(pdf);
    expect(fetchDoc).toHaveBeenCalledWith('doc-1');
  });

  it('ignores webhook URLs and queues only known document identifiers', async () => {
    prisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    await service.handleESignWebhook({ code: '200', model: { docId: 'doc-1', url: 'http://untrusted' } });
    expect((service as any).esignQueue.add).toHaveBeenCalledWith('archive-signed-document', { docId: 'doc-1' }, expect.objectContaining({ attempts: 8 }));
  });

  it('does not queue unknown webhook document identifiers', async () => {
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.esignAttempt.findUnique.mockResolvedValue(null);
    await service.handleESignWebhook({ code: '200', model: { docId: 'unknown' } });
    expect((service as any).esignQueue.add).not.toHaveBeenCalled();
  });
});
