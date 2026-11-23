import { ConfigService } from '@nestjs/config';
import { AlankitEsignService } from './alankit-esign.service';

describe('Alankit eSign workflow', () => {
  const originalFetch = global.fetch;
  const configValues = {
    ALANKIT_ESIGN_SUBSCRIPTION_KEY: 'test-subscription-key',
    ALANKIT_ESIGN_BASE_URL: 'https://provider.example',
    ALANKIT_ESIGN_REDIRECT_URL: 'https://provider.example/sign',
    ALANKIT_ESIGN_CALLBACK_URL: 'https://api.example/api/orders/esign/success',
  };
  let storage: any;
  let service: AlankitEsignService;

  beforeEach(() => {
    storage = { createAlankitSourcePdf: jest.fn().mockResolvedValue({
      sourceUrl: 'https://storage.example/file.pdf?signature=temporary',
      objectKey: '9e973dda-69e5-46e7-9e83-a65cfd08605d.pdf',
    }) };
    service = new AlankitEsignService(new ConfigService(configValues), storage);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('creates a reference and browser redirect using the provider transaction contract', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify({
      ResponseCode: '000',
      ReferenceNo: '343434112544',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await service.createTransaction({
      signerName: 'Test Signer',
      location: 'India',
      pdf: Buffer.from('%PDF-source'),
    });

    expect(storage.createAlankitSourcePdf).toHaveBeenCalledWith(Buffer.from('%PDF-source'));
    expect(global.fetch).toHaveBeenCalledWith('https://provider.example/esign/GetTransactionRef', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ SubscriptionKey: 'test-subscription-key' }),
      body: expect.stringContaining('"ESignerName":"Test Signer"'),
    }));
    expect(result.referenceNo).toBe('343434112544');
    expect(new URL(result.redirectUrl).searchParams.get('refno')).toBe('343434112544');
    expect(new URL(result.redirectUrl).searchParams.get('skey')).toBe('test-subscription-key');
  });

  it('accepts a base64 callback reference without trusting its PDF URL', () => {
    const resp = Buffer.from('ref=343434112544&purl=http%3A%2F%2Flocalhost%2Fprivate.pdf').toString('base64');
    expect(service.parseCallback(resp)).toEqual({ referenceNo: '343434112544' });
  });

  it('retrieves and validates a signed PDF using the authenticated file endpoint', async () => {
    const pdf = Buffer.from('%PDF-signed-original');
    (global.fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify({
      ResponseCode: '000',
      FileContent: pdf.toString('base64'),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(service.getSignedPdf('343434112544')).resolves.toEqual(pdf);
    expect(global.fetch).toHaveBeenCalledWith('https://provider.example/esign/getesignfile', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ SubscriptionKey: 'test-subscription-key' }),
      body: JSON.stringify({ ReferenceNo: '343434112544' }),
    }));
  });

  it('rejects signed-file URLs outside the configured host allowlist', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify({
      ResponseCode: '000',
      SignedPdfUrl: 'https://localhost/private.pdf',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(service.getSignedPdf('343434112544')).rejects.toThrow('host allowlist');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
