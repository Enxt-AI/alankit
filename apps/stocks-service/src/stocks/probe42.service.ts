import {
  Injectable,
  Logger,
  BadRequestException,
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PinoNestLogger } from '@repo/logger';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class Probe42Service {
  private readonly logger = new PinoNestLogger('stocks-service', 'Probe42Service');
  private readonly baseUrl: string;
  private readonly apiVersion = '1.3';
  private readonly pendingDocuments = new Map<string, Promise<Buffer>>();

  constructor(private configService: ConfigService) {
    const isProd =
      this.configService.get<string>('NODE_ENV') === 'production' ||
      process.env.NODE_ENV === 'production';

    this.baseUrl = isProd
      ? 'https://api.probe42.in/probe_pro'
      : 'https://api.probe42.in/probe_pro_sandbox';

    this.logger.log(
      `Probe42Service initialized in ${isProd ? 'production' : 'sandbox'} mode.`,
    );
  }

  private getApiKey(): string {
    const apiKey = this.configService.get<string>('PROBE42_API_KEY');
    if (!apiKey) {
      this.logger.warn('PROBE42_API_KEY is not configured in environment');
    }
    return apiKey || '';
  }

  async getCompanyDetails(cin: string): Promise<any> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.logger.warn(
        `PROBE42_API_KEY missing. Skipping Probe42 API call for CIN: ${cin}`,
      );
      return null;
    }

    const url = `${this.baseUrl}/companies/${encodeURIComponent(cin.toUpperCase())}/comprehensive-details`;

    this.logger.log(
      `Fetching comprehensive details from Probe42 for CIN: ${cin}`,
    );

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          Accept: 'application/json',
          'x-api-version': this.apiVersion,
        },
      });

      if (!response.ok) {
        throw new Error(`Probe42 API returned status ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch details from Probe42 for CIN: ${cin}`,
        error.stack,
      );
      throw new BadRequestException(`Probe42 API error: ${error.message}`);
    }
  }

  async getCompanyDocument(cin: string, docId: string): Promise<Buffer> {
    const key = JSON.stringify([cin.toUpperCase(), docId]);
    const pending = this.pendingDocuments.get(key);
    if (pending) return pending;

    const download = this.downloadCompanyDocument(cin, docId);
    this.pendingDocuments.set(key, download);
    try {
      return await download;
    } finally {
      this.pendingDocuments.delete(key);
    }
  }

  private async downloadCompanyDocument(
    cin: string,
    docId: string,
  ): Promise<Buffer> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Document downloads are temporarily unavailable',
      );
    }

    const isSandbox = this.baseUrl.endsWith('_sandbox');
    const reportsBaseUrl =
      this.configService.get<string>('PROBE42_REPORTS_BASE_URL') ||
      `https://api.probe42.in/probe_reports${isSandbox ? '_sandbox' : ''}`;
    const url = `${reportsBaseUrl.replace(/\/$/, '')}/companies/${encodeURIComponent(
      cin.toUpperCase(),
    )}/get-reference-document-by-id?doc-id=${encodeURIComponent(docId)}&identifier_type=CIN`;

    this.logger.log(
      `Downloading document ${docId} from Probe42 for CIN: ${cin}`,
    );

    // Retry this read once on transient upstream failures, including body reads.
    // The deadline bounds each attempt; buffers are shared only while in flight.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(20_000),
          headers: {
            'x-api-key': apiKey,
            'x-api-version': this.apiVersion,
          },
        });

        if (!response.ok) {
          await response.body?.cancel();
          this.logger.warn(
            `Probe42 document response: status=${response.status}, attempt=${attempt}`,
          );
          if (attempt === 1 && [500, 502, 503, 504].includes(response.status)) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }
          throw new BadGatewayException(
            'Document provider could not return this document. Please try again later.',
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (error: any) {
        if (error instanceof BadGatewayException) throw error;
        const code =
          error?.cause?.code || error?.code || error?.name || 'UNKNOWN';
        this.logger.warn(
          `Probe42 document transport failure: CIN=${cin}, attempt=${attempt}, code=${code}`,
        );
        if (attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        if (
          error?.name === 'TimeoutError' ||
          String(code).includes('TIMEOUT')
        ) {
          throw new GatewayTimeoutException(
            'Document provider timed out. Please try again.',
          );
        }
        throw new BadGatewayException(
          'Document provider is temporarily unreachable. Please try again.',
        );
      }
    }
    throw new BadGatewayException('Document download failed');
  }
}
