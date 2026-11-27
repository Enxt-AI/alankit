import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoNestLogger } from '@/logger';
import { randomUUID } from 'crypto';
import { SignedDealSheetService } from './signed-deal-sheet.service';

const MAX_PDF_SIZE = 25 * 1024 * 1024;
const MAX_JSON_RESPONSE_SIZE = 36 * 1024 * 1024;

@Injectable()
export class AlankitEsignService {
  private readonly logger = new PinoNestLogger('stocks-service', 'AlankitEsignService');

  constructor(
    private readonly config: ConfigService,
    private readonly signedDealSheets: SignedDealSheetService,
  ) {}

  async createTransaction(input: {
    signerName: string;
    location: string;
    pdf: Buffer;
  }): Promise<{ referenceNo: string; redirectUrl: string; sourceObjectKey: string }> {
    const subscriptionKey = this.config.getOrThrow<string>('ALANKIT_ESIGN_SUBSCRIPTION_KEY');
    const callbackUrl = this.requireHttpsUrl('ALANKIT_ESIGN_CALLBACK_URL');
    const baseUrl = this.requireHttpsUrl('ALANKIT_ESIGN_BASE_URL').replace(/\/+$/, '');
    const redirectUrl = this.requireHttpsUrl('ALANKIT_ESIGN_REDIRECT_URL');
    const { sourceUrl, objectKey } = await this.signedDealSheets.createAlankitSourcePdf(input.pdf);
    const requestNo = randomUUID();

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/esign/GetTransactionRef`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          SubscriptionKey: subscriptionKey,
        },
        body: JSON.stringify({
          ESignerName: input.signerName,
          Location: input.location,
          SourcePdfUrl: sourceUrl,
          RequestNo: requestNo,
          RequestReason: this.config.get<string>('ALANKIT_ESIGN_REQUEST_REASON', 'DEMAT ESIGN'),
          WebhookUrl: callbackUrl,
        }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (error) {
      this.logger.error('Alankit transaction request failed before a response was received', error);
      throw new ServiceUnavailableException('Unable to start e-signing with Alankit. Retry with the same request key.');
    }

    const data = await this.readJsonResponse(response, 2 * 1024 * 1024);
    if (!response.ok || String(data.ResponseCode ?? '') !== '000' || !this.validReference(data.ReferenceNo)) {
      this.logger.error(`Alankit transaction creation rejected; http=${response.status} code=${String(data.ResponseCode ?? 'missing')}`);
      throw new ServiceUnavailableException('Alankit could not create the e-sign transaction.');
    }

    const referenceNo = String(data.ReferenceNo);
    const browserUrl = new URL(redirectUrl);
    browserUrl.searchParams.set('skey', subscriptionKey);
    browserUrl.searchParams.set('refno', referenceNo);
    return { referenceNo, redirectUrl: browserUrl.toString(), sourceObjectKey: objectKey };
  }

  parseCallback(resp: string): { referenceNo: string } {
    if (typeof resp !== 'string' || resp.length > 16384 || !/^[A-Za-z0-9+/]+={0,2}$/.test(resp)) {
      throw new BadRequestException('Invalid Alankit e-sign callback.');
    }
    const decoded = Buffer.from(resp, 'base64').toString('utf8');
    const parameters = new URLSearchParams(decoded);
    const referenceNo = parameters.get('ref');
    const pdfUrl = parameters.get('purl');
    if (!this.validReference(referenceNo) || !pdfUrl || pdfUrl.length > 4096) {
      throw new BadRequestException('Invalid Alankit e-sign callback.');
    }
    // The callback URL is untrusted; the signed document is fetched through Alankit's authenticated API.
    return { referenceNo: String(referenceNo) };
  }

  async getSignedPdf(referenceNo: string): Promise<Buffer> {
    if (!this.validReference(referenceNo)) throw new BadRequestException('Invalid e-sign reference.');
    const baseUrl = this.requireHttpsUrl('ALANKIT_ESIGN_BASE_URL').replace(/\/+$/, '');
    const subscriptionKey = this.config.getOrThrow<string>('ALANKIT_ESIGN_SUBSCRIPTION_KEY');
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/esign/getesignfile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          SubscriptionKey: subscriptionKey,
        },
        body: JSON.stringify({ ReferenceNo: referenceNo }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (error) {
      this.logger.error(`Alankit signed-file request failed; ref=${referenceNo}`, error);
      throw new ServiceUnavailableException('Unable to retrieve the signed e-sign document from Alankit.');
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    const body = await this.readResponse(response, MAX_JSON_RESPONSE_SIZE);
    if (!response.ok) throw new ServiceUnavailableException('Unable to retrieve the signed e-sign document from Alankit.');
    if (contentType.includes('application/pdf')) return this.assertPdf(body);

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(body.toString('utf8'));
    } catch {
      throw new ServiceUnavailableException('Alankit returned an unsupported signed-file response.');
    }
    if (String(data.ResponseCode) !== '000') {
      throw new ServiceUnavailableException('Alankit has not returned a completed signed e-sign document.');
    }

    for (const field of ['SignedPdfUrl', 'PdfUrl']) {
      const value = data[field];
      if (typeof value === 'string' && value) return this.downloadSignedPdf(value);
    }
    for (const field of ['FileContent', 'Base64Content', 'File']) {
      const value = data[field];
      if (typeof value === 'string' && value) {
        if (/^https:\/\//i.test(value)) return this.downloadSignedPdf(value);
        const base64 = value.replace(/^data:application\/pdf;base64,/i, '');
        return this.assertPdf(Buffer.from(base64, 'base64'));
      }
    }
    throw new ServiceUnavailableException('Alankit returned no supported signed PDF payload.');
  }

  private async downloadSignedPdf(rawUrl: string): Promise<Buffer> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequestException('Alankit returned an invalid signed document URL.');
    }
    const hosts = (this.config.get<string>('ALANKIT_ESIGN_DOCUMENT_HOSTS') ?? '')
      .split(',')
      .map(host => host.trim().toLowerCase())
      .filter(Boolean);
    if (
      url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
      !hosts.includes(url.hostname.toLowerCase())
    ) {
      throw new BadRequestException('Alankit returned a signed document URL outside the configured host allowlist.');
    }
    let response: Response;
    try {
      response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    } catch (error) {
      this.logger.error('Failed to download the Alankit signed PDF', error);
      throw new ServiceUnavailableException('Unable to download the signed e-sign document.');
    }
    if (!response.ok) throw new ServiceUnavailableException('Unable to download the signed e-sign document.');
    return this.assertPdf(await this.readResponse(response, MAX_PDF_SIZE));
  }

  private async readJsonResponse(response: Response, maxBytes: number): Promise<Record<string, unknown>> {
    const body = await this.readResponse(response, maxBytes);
    try {
      const data: unknown = JSON.parse(body.toString('utf8'));
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid response object');
      return data as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException('Alankit returned an invalid response.');
    }
  }

  private async readResponse(response: Response, maxBytes: number): Promise<Buffer> {
    if (!response.body) throw new ServiceUnavailableException('Alankit returned an empty response.');
    const chunks: Buffer[] = [];
    let size = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new ServiceUnavailableException('Alankit response exceeds the supported size.');
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    return Buffer.concat(chunks);
  }

  private assertPdf(pdf: Buffer): Buffer {
    if (pdf.length === 0 || pdf.length > MAX_PDF_SIZE || pdf.subarray(0, 5).toString() !== '%PDF-') {
      throw new ServiceUnavailableException('Alankit did not return a valid PDF document.');
    }
    return pdf;
  }

  private validReference(value: unknown): value is string | number {
    return (typeof value === 'string' || typeof value === 'number') &&
      /^[A-Za-z0-9_-]{1,128}$/.test(String(value));
  }

  private requireHttpsUrl(key: string): string {
    const raw = this.config.getOrThrow<string>(key);
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new BadRequestException(`${key} must be a valid HTTPS URL.`);
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
      throw new BadRequestException(`${key} must be a valid HTTPS URL.`);
    }
    return url.toString();
  }
}
