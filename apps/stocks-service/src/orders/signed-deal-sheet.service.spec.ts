import { ConfigService } from '@nestjs/config';
import { SignedDealSheetService } from './signed-deal-sheet.service';

describe('Signed deal sheet archive', () => {
  let service: SignedDealSheetService;
  let send: jest.Mock;
  const originalFetch = global.fetch;
  const model = { docId: 'doc-1', url: 'https://esign-signed-docs-production.s3.ap-south-1.amazonaws.com/doc-1', signers: [{ state: 'signed' }] };

  beforeEach(() => {
    service = new SignedDealSheetService(new ConfigService());
    send = jest.fn();
    (service as any).client = { send };
    global.fetch = jest.fn();
  });
  afterEach(() => { global.fetch = originalFetch; });

  it('returns the stored original without using an expired provider link', async () => {
    const pdf = Buffer.from('%PDF-original-signature');
    send.mockResolvedValue({ Body: { transformToByteArray: async () => pdf } });
    await service.archive('doc-1', { ...model, url: 'expired' });
    expect(await service.read('doc-1')).toEqual(pdf);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('archives exact signed bytes in a separate private bucket', async () => {
    const pdf = Buffer.from('%PDF-original-signature');
    send.mockRejectedValueOnce({ name: 'NoSuchBucket' }).mockResolvedValue({});
    (global.fetch as jest.Mock).mockResolvedValue(new Response(pdf));
    await service.archive('doc-1', model);
    expect(send.mock.calls[2][0].input).toMatchObject({ Bucket: 'signed-deal-sheets', Body: pdf, ContentType: 'application/pdf' });
    expect(send.mock.calls.map(([command]) => command.constructor.name)).not.toContain('PutBucketPolicyCommand');
  });

  it('does not archive partially signed documents', async () => {
    await service.archive('doc-1', { ...model, signers: [{ state: 'signed' }, { state: 'pending' }] });
    expect(send).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects an unexpected download host without fetching it', async () => {
    send.mockRejectedValue({ name: 'NoSuchKey' });
    await expect(service.archive('doc-1', { ...model, url: 'https://127.0.0.1/private' })).rejects.toThrow('Unexpected');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects non-PDF responses and leaves storage untouched', async () => {
    send.mockRejectedValueOnce({ name: 'NoSuchKey' });
    (global.fetch as jest.Mock).mockResolvedValue(new Response('<html>expired</html>'));
    await expect(service.archive('doc-1', model)).rejects.toThrow('PDF');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('propagates storage outages so the queue can retry', async () => {
    send.mockRejectedValue(new Error('storage unavailable'));
    await expect(service.archive('doc-1', model)).rejects.toThrow('storage unavailable');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
