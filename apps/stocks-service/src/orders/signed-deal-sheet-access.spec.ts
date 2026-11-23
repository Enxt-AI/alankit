jest.mock('redis-service', () => ({}));
import { OrdersService } from './orders.service';

describe('Signed deal sheet access and recovery', () => {
  let service: OrdersService;
  let prisma: any;
  let archive: any;
  beforeEach(() => {
    service = Object.create(OrdersService.prototype);
    prisma = {
      order: { findFirst: jest.fn(), updateMany: jest.fn() },
      esignAttempt: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    };
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

  it('fetches Alankit signed bytes through the authenticated provider client and archives them', async () => {
    const pdf = Buffer.from('%PDF-alankit-signed');
    prisma.esignAttempt.findUnique.mockResolvedValue({
      docId: 'ref-1',
      status: 'INITIATED',
      signedAt: null,
      intent: { provider: 'ALANKIT', sourceObjectKey: '9e973dda-69e5-46e7-9e83-a65cfd08605d.pdf' },
    });
    archive.read.mockResolvedValue(null);
    archive.archivePdf = jest.fn();
    archive.deleteAlankitSourcePdf = jest.fn();
    Object.assign(service, {
      alankitEsign: { getSignedPdf: jest.fn().mockResolvedValue(pdf) },
    });

    const result = await service.getESignDoc('ref-1');

    expect(service.alankitEsign.getSignedPdf).toHaveBeenCalledWith('ref-1');
    expect(archive.archivePdf).toHaveBeenCalledWith('ref-1', pdf);
    expect(prisma.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { esignDocId: 'ref-1' },
      data: { esignStatus: 'SIGNED', esignValidationVerdict: 'INSUFFICIENT_DATA' },
    }));
    expect(result.signers).toEqual([{ state: 'signed' }]);
  });

  it('queues callbacks only for known Alankit references', async () => {
    prisma.esignAttempt.findUnique.mockResolvedValue({
      docId: 'ref-1',
      intent: { provider: 'ALANKIT' },
    });
    Object.assign(service, {
      alankitEsign: { parseCallback: jest.fn().mockReturnValue({ referenceNo: 'ref-1' }) },
    });

    await expect(service.handleAlankitESignCallback('callback')).resolves.toEqual({ status: 'received' });
    expect((service as any).esignQueue.add).toHaveBeenCalledWith(
      'archive-signed-document',
      { docId: 'ref-1' },
      expect.objectContaining({ attempts: 8, removeOnComplete: true }),
    );
  });
});
