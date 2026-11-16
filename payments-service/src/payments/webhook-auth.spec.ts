import { createHmac } from 'crypto';
import { authenticateWebhook } from './webhook-auth';

describe('Cashfree webhook authentication', () => {
  const body = Buffer.from('{"amount":100.00,"type":"PAYMENT_SUCCESS_WEBHOOK"}');
  const secret = 'test-secret';
  const sign = (timestamp: string) => createHmac('sha256', secret).update(timestamp).update(body).digest('base64');
  it('accepts signed bytes and deduplicates redelivery with a new timestamp', () => {
    expect(authenticateWebhook(body, sign('100'), '100', secret)).toBe(authenticateWebhook(body, sign('200'), '200', secret));
  });
  it('rejects changed bytes even when parsed JSON is equivalent', () => {
    expect(() => authenticateWebhook(Buffer.from(JSON.stringify(JSON.parse(body.toString()))), sign('100'), '100', secret)).toThrow();
  });
  it.each([undefined, Buffer.from('{}')])('rejects missing or altered raw body', raw => {
    expect(() => authenticateWebhook(raw, sign('100'), '100', secret)).toThrow();
  });
  it('fails closed when credentials or signature are absent', () => {
    expect(() => authenticateWebhook(body, '', '100', secret)).toThrow();
    expect(() => authenticateWebhook(body, sign('100'), '100', '')).toThrow();
  });
});
