export type CheckoutSession = {
  provider: 'ndps'; orderId: string; merchantTransactionId: string;
  atomTokenId: string; merchId: string; custEmail: string; custMobile: string;
  returnUrl: string; sdkUrl: string; environment: 'uat' | 'prod'; amount: number;
};

export async function paymentRequest<T>(path: string, body?: object): Promise<T> {
  let fingerprint = '';
  try { fingerprint = localStorage.getItem('device-fingerprint') || ''; } catch {}
  const response = await fetch(`/api/${path}`, {
    method: body ? 'POST' : 'GET', credentials: 'include', cache: 'no-store',
    signal: AbortSignal.timeout(30000),
    headers: { 'x-device-fingerprint': fingerprint, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (response.status === 401) throw new Error('Please sign in to continue.');
  if (!response.ok) throw new Error(typeof data?.message === 'string' ? data.message : 'Unable to process your request. Please try again.');
  if (!data) throw new Error('The payment service returned an invalid response.');
  return data as T;
}

declare global {
  interface Window {
    AtomPaynetz?: new (options: { atomTokenId: string; merchId: string; custEmail: string; custMobile: string; returnUrl: string }, environment: 'uat' | 'prod') => unknown;
  }
}

export function checkoutSdkUrl(environment: 'uat' | 'prod') {
  return environment === 'prod' ? 'https://psa.atomtech.in/staticdata/ots/js/atomcheckout.js' : 'https://pgtest.atomtech.in/staticdata/ots/js/atomcheckout.js';
}
