import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHmac, pbkdf2Sync, timingSafeEqual } from 'crypto';
import { acquireProviderSlot } from 'redis-service';

const IV = Buffer.from(Array.from({ length: 16 }, (_, i) => i));

// Matches nttdatapay/nttdatapay-nextjs-ssr/pages/utils.js. The PDF's
// "AES-512" wording refers to SHA512 derivation, not an AES key size.
export function ndpsEncrypt(text: string, key: string, salt = key): string {
  const cipher = createCipheriv('aes-256-cbc', pbkdf2Sync(key, salt, 65536, 32, 'sha512'), IV);
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('hex');
}

export function ndpsDecrypt(text: string, key: string, salt = key): string {
  if (typeof text !== 'string' || !/^(?:[a-f\d]{32})+$/i.test(text) || text.length > 262144) {
    throw new UnauthorizedException('Invalid NDPS response');
  }
  const decipher = createDecipheriv('aes-256-cbc', pbkdf2Sync(key, salt, 65536, 32, 'sha512'), IV);
  return Buffer.concat([decipher.update(Buffer.from(text, 'hex')), decipher.final()]).toString('utf8');
}

@Injectable()
export class NdpsGateway {
  constructor(private readonly config: ConfigService) {}

  required(name: string): string {
    const value = this.config.get<string>(name)?.trim();
    if (!value) throw new ServiceUnavailableException(`Payment configuration missing: ${name}`);
    return value;
  }

  get environment(): 'uat' | 'prod' {
    const value = this.config.get<string>('NDPS_ENVIRONMENT', 'uat').toLowerCase();
    if (!['uat', 'prod'].includes(value)) throw new ServiceUnavailableException('Invalid NDPS_ENVIRONMENT');
    return value as 'uat' | 'prod';
  }

  checkout(token: string, user: any) {
    const returnUrl = this.required('NDPS_RETURN_URL');
    if (!/^https?:\/\//.test(returnUrl)) throw new ServiceUnavailableException('Invalid NDPS_RETURN_URL');
    return {
      provider: 'ndps' as const, environment: this.environment,
      atomTokenId: token, merchId: this.required('NDPS_MERCHANT_ID'),
      custEmail: user.email, custMobile: String(user.phone || '').replace(/\D/g, '').slice(-10),
      returnUrl,
      sdkUrl: this.environment === 'prod'
        ? 'https://psa.atomtech.in/staticdata/ots/js/atomcheckout.js'
        : 'https://pgtest.atomtech.in/staticdata/ots/js/atomcheckout.js',
    };
  }

  async createToken(transactionId: string, order: any, user: any) {
    const checkout = this.checkout('', user);
    if (!checkout.custEmail || !/^\d{10}$/.test(checkout.custMobile)) {
      throw new BadRequestException('A valid email and mobile number are required for payment');
    }
    this.required('NDPS_RESPONSE_HASH_KEY');
    const now = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 19).replace('T', ' ');
    const payload = { payInstrument: {
      headDetails: { version: 'OTSv1.1', api: 'AUTH', platform: 'FLASH' },
      merchDetails: { merchId: checkout.merchId, userId: '', password: this.required('NDPS_PASSWORD'), merchTxnId: transactionId, merchTxnDate: now },
      payDetails: { amount: Number(order.totalAmount).toFixed(2), product: this.required('NDPS_PRODUCT'),
        custAccNo: user.bankData?.accNo || '', txnCurrency: 'INR' },
      custDetails: { custEmail: checkout.custEmail, custMobile: checkout.custMobile },
      extras: { udf1: order.id },
    } };
    const url = this.environment === 'prod' ? 'https://payment1.atomtech.in/ots/aipay/auth' : 'https://paynetzuat.atomtech.in/ots/aipay/auth';
    const data = await this.postEncrypted(url, payload);
    if (data.responseDetails?.txnStatusCode !== 'OTS0000' || !/^\d+$/.test(String(data.atomTokenId))) {
      throw new ServiceUnavailableException('NDPS could not create a checkout session');
    }
    return String(data.atomTokenId);
  }

  private async postEncrypted(url: string, payload: unknown) {
    const merchId = this.required('NDPS_MERCHANT_ID');
    const key = this.required('NDPS_REQUEST_KEY');
    const responseKey = this.required('NDPS_RESPONSE_KEY');
    if (!await acquireProviderSlot(`ndps:${merchId}`, Number(this.config.get('NDPS_REQUESTS_PER_SECOND', 10)))) {
      throw new ServiceUnavailableException('Payment gateway is busy. Please retry shortly.');
    }
    // Never blindly retry a money-moving request after an ambiguous timeout.
    const response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ merchId, encData: ndpsEncrypt(JSON.stringify(payload), key, this.config.get('NDPS_REQUEST_SALT', key)) }),
    });
    if (!response.ok) throw new ServiceUnavailableException('NDPS is temporarily unavailable');
    const text = await response.text();
    const encrypted = text.trim().startsWith('{') ? JSON.parse(text).encData : (new URLSearchParams(text).get('encData') || text.trim());
    return JSON.parse(ndpsDecrypt(encrypted, responseKey, this.config.get('NDPS_RESPONSE_SALT', responseKey)));
  }

  async status(transactionId: string, amount: number, createdAt: Date) {
    const merchId = this.required('NDPS_MERCHANT_ID');
    const signature = createHmac('sha512', this.required('NDPS_REQUEST_HASH_KEY'))
      .update(`${merchId}${transactionId}${amount.toFixed(2)}INR`).digest('hex');
    const url = this.environment === 'prod' ? 'https://payment1.atomtech.in/ots/v2/payment/status' : 'https://paynetzuat.atomtech.in/ots/v2/payment/status';
    const data = await this.postEncrypted(url, { payInstrument: {
      merchDetails: { merchId, merchTxnId: transactionId, merchTxnDate: new Date(createdAt.getTime() + 330 * 60000).toISOString().slice(0, 10) },
      payDetails: { amount, txnCurrency: 'INR', signature },
    } });
    const p = data.payInstrument;
    // The authenticated server-to-server response has no signature/currency in
    // the published v2 schema. Bind it to all locally known request details.
    if (!p || String(p.merchDetails?.merchId) !== merchId || p.merchDetails?.merchTxnId !== transactionId ||
      !Number.isFinite(Number(p.payDetails?.amount)) || Math.round(Number(p.payDetails.amount) * 100) !== Math.round(amount * 100)) {
      throw new ServiceUnavailableException('NDPS returned mismatched transaction details');
    }
    if (p.payDetails.txnCurrency && p.payDetails.txnCurrency !== 'INR') throw new ServiceUnavailableException('NDPS currency mismatch');
    p.payDetails.txnCurrency = 'INR';
    return p;
  }

  async refund(transactionId: string, atomTxnId: string, amount: number, refundId: string) {
    const merchId = this.required('NDPS_MERCHANT_ID'), password = this.required('NDPS_PASSWORD');
    const product = this.required('NDPS_PRODUCT');
    const signature = createHmac('sha512', this.required('NDPS_REQUEST_HASH_KEY'))
      .update(`${merchId}${password}${transactionId}${amount.toFixed(2)}INRREFUNDINIT`).digest('hex');
    const data = await this.postEncrypted(this.environment === 'prod'
      ? 'https://payment.atomtech.in/ots/payment/refund' : 'https://caller.atomtech.in/ots/payment/refund', {
      payInstrument: {
        headDetails: { api: 'REFUNDINIT', source: 'OTS' },
        merchDetails: { merchId, password, merchTxnId: transactionId },
        payDetails: { signature, atomTxnId: Number(atomTxnId), totalRefundAmount: amount, txnCurrency: 'INR',
          prodDetails: [{ prodName: product, prodRefundAmount: amount, prodRefundId: refundId }] },
      },
    });
    const p = data.payInstrument, detail = p?.payDetails?.prodDetails?.[0];
    if (String(p?.payDetails?.atomTxnId) !== atomTxnId || p.payDetails.txnCurrency !== 'INR' ||
      Math.round(Number(p.payDetails.totalRefundAmount) * 100) !== Math.round(amount * 100) ||
      detail?.prodRefundId !== refundId || detail.prodName !== product ||
      Math.round(Number(detail.prodRefundAmount) * 100) !== Math.round(amount * 100)) {
      throw new ServiceUnavailableException('NDPS refund response requires manual reconciliation');
    }
    return { status: p.responseDetails?.statusCode === 'OTS0000' && detail.prodStatusCode === 'OTS0000' ? 'INITIATED' : 'REJECTED',
      refundId, refundTxnId: String(detail.refundTxnId || ''), statusCode: detail.prodStatusCode };
  }

  async settlements(date: string): Promise<any[]> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new BadRequestException('Invalid settlement date');
    const merchantId = this.required('NDPS_MERCHANT_ID');
    // Settlement reporting uses a separate SHA1 KDF contract. The supplied PDF
    // leaves these merchant-specific parameters unspecified; never guess them.
    const password = this.required('NDPS_SETTLEMENT_PASSWORD'), salt = this.required('NDPS_SETTLEMENT_SALT');
    const iterations = Number(this.required('NDPS_SETTLEMENT_ITERATIONS'));
    const bits = Number(this.required('NDPS_SETTLEMENT_KEY_BITS'));
    const ivHex = this.required('NDPS_SETTLEMENT_IV_HEX');
    if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 1000000 || ![128, 192, 256].includes(bits) || !/^[a-f\d]{32}$/i.test(ivHex)) {
      throw new ServiceUnavailableException('Invalid NDPS settlement encryption configuration');
    }
    const key = pbkdf2Sync(password, salt, iterations, bits / 8, 'sha1'), iv = Buffer.from(ivHex, 'hex');
    const cipher = createCipheriv(`aes-${bits}-cbc`, key, iv);
    const plain = `merchantId=${merchantId}|settlementDate=${date}|transactionId=|responseType=json`;
    const encData = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]).toString('hex');
    const url = new URL(this.environment === 'prod' ? 'https://pgreports.atomtech.in/SettlementReport/generateReport' : 'https://titanuat.atomtech.in/SettlementReport/generateReport');
    url.search = new URLSearchParams({ merchantId, encData }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new ServiceUnavailableException('NDPS settlement report unavailable');
    const encrypted = (await response.text()).trim();
    if (!/^(?:[a-f\d]{32})+$/i.test(encrypted)) throw new ServiceUnavailableException('NDPS returned no encrypted settlement report; check report access and IP allowlisting');
    const decipher = createDecipheriv(`aes-${bits}-cbc`, key, iv);
    const records = JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()]).toString('utf8'));
    if (!Array.isArray(records) || records.some(row => String(row.merchantID) !== merchantId)) throw new ServiceUnavailableException('Invalid NDPS settlement report');
    return records;
  }

  decodeResponse(body: any) {
    const key = this.required('NDPS_RESPONSE_KEY');
    const hashKey = this.required('NDPS_RESPONSE_HASH_KEY');
    try {
      const data = JSON.parse(ndpsDecrypt(body?.encData, key, this.config.get('NDPS_RESPONSE_SALT', key)));
      const p = data.payInstrument;
      const m = p.merchDetails, pay = p.payDetails, mode = p.payModeSpecificData;
      if (String(m.merchId) !== this.required('NDPS_MERCHANT_ID')) throw new Error('Merchant mismatch');
      if (typeof m.merchTxnId !== 'string' || !m.merchTxnId) throw new Error('Missing transaction');
      // NDPS's callback contract allows null signatures. Such messages are only
      // hints for a server-to-server requery, never payment confirmation.
      if (pay.signature == null) return p;
      const status = p.responseDetails.statusCode;
      const channel = Array.isArray(mode.subChannel) ? mode.subChannel[0] : mode.subChannel;
      const amount = Number(pay.totalAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid amount');
      const signatureInput = [m.merchId, pay.atomTxnId, m.merchTxnId, amount.toFixed(2), status, channel, mode.bankDetails.bankTxnId];
      if (signatureInput.some(value => value === undefined || value === null)) throw new Error('Incomplete response');
      const expected = createHmac('sha512', hashKey).update(signatureInput.join('')).digest();
      if (!/^[a-f\d]{128}$/i.test(pay.signature || '')) throw new Error('Missing signature');
      if (!timingSafeEqual(expected, Buffer.from(pay.signature, 'hex'))) throw new Error('Invalid signature');
      if (!/^\d+$/.test(String(pay.atomTxnId)) || typeof m.merchTxnId !== 'string') throw new Error('Invalid transaction');
      return p;
    } catch {
      throw new UnauthorizedException('Invalid NDPS response or signature');
    }
  }
}
