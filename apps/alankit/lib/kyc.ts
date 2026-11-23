export type KycStatus = {
  kycStatus: string;
  state: 'NOT_STARTED' | 'FETCHING' | 'VERIFIED' | 'PENDING' | 'NOT_FOUND' | 'ERROR' | 'REVIEW_REQUIRED';
  pan: string | null;
  canRefresh: boolean;
  checkedAt: string | null;
  openAccountUrl: string | null;
};

async function request(path: string, body?: object): Promise<KycStatus> {
  let fingerprint = '';
  try { fingerprint = localStorage.getItem('device-fingerprint') || ''; } catch {}
  const response = await fetch(`/api/kyc/alankit/${path}`, {
    method: body ? 'POST' : 'GET', credentials: 'include', cache: 'no-store',
    signal: AbortSignal.timeout(25_000),
    headers: { 'x-device-fingerprint': fingerprint, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401) {
    throw new Error('Please sign in to continue.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.state) throw new Error(typeof data?.message === 'string' ? data.message : 'Unable to check KYC. Please try again.');
  return data;
}

export const getKycStatus = () => request('status');
export const fetchKycByPan = (pan: string) => request('fetch', { pan: pan.trim().toUpperCase() });
export const refreshKyc = () => request('refresh', {});

export function safeReturnUrl(value: string | null, fallback = '/dashboard') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
