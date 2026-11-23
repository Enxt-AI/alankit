import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type LookupResult = {
  state: 'FOUND' | 'NOT_FOUND' | 'ERROR';
  response: any;
  httpStatus?: number;
};

@Injectable()
export class AlankitKycClient {
  constructor(private readonly config: ConfigService) {}

  async fetchByPan(pan: string): Promise<LookupResult> {
    const apiKey = this.config.get<string>('ALANKIT_KYC_API_KEY');
    const fetchCode = this.config.get<string>('ALANKIT_KYC_FETCH_CODE');
    if (!apiKey || !fetchCode) {
      return { state: 'ERROR', response: { error: 'PROVIDER_NOT_CONFIGURED' } };
    }
    const endpoint = this.config.get<string>('ALANKIT_KYC_FETCH_URL') ||
      'https://obpp.alankit.co.in/api/Kyc/FetchLogin';
    try {
      const result = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: '*/*', 'X-API-KEY': apiKey },
        // PAN-only customer input, as confirmed for this integration.
        body: JSON.stringify({ pan, fetchCode }),
        signal: AbortSignal.timeout(15_000),
        redirect: 'error',
      });
      const response = await result.json();
      if (!response || typeof response !== 'object' || Array.isArray(response)) {
        return { state: 'ERROR', httpStatus: result.status, response: { error: 'INVALID_RESPONSE' } };
      }
      // Failure schemas are absent from the supplied document. Only an explicitly
      // configured provider code can classify a failure as a missing KYC record.
      const missingCode = this.config.get<string>('ALANKIT_KYC_NOT_FOUND_CODE');
      if (result.status !== 401 && result.status !== 403 && result.status !== 429 &&
          result.status < 500 && missingCode && response.success === false &&
          String(response.code) === missingCode) {
        return { state: 'NOT_FOUND', response, httpStatus: result.status };
      }
      if (result.ok && response.success === true && response.data &&
          typeof response.data === 'object' && !Array.isArray(response.data)) {
        return { state: 'FOUND', response, httpStatus: result.status };
      }
      return { state: 'ERROR', response, httpStatus: result.status };
    } catch {
      return { state: 'ERROR', response: { error: 'PROVIDER_UNAVAILABLE_OR_INVALID_JSON' } };
    }
  }
}
