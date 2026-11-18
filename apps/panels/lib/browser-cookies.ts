export type CookieOptions = {
  path?: string;
  maxAgeSeconds?: number;
  sameSite?: 'Lax' | 'Strict' | 'None';
  secure?: boolean;
};

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    const eqIndex = cookie.indexOf('=');
    const key = eqIndex >= 0 ? cookie.slice(0, eqIndex) : cookie;
    if (key === name) {
      const value = eqIndex >= 0 ? cookie.slice(eqIndex + 1) : '';
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

export function setCookie(name: string, value: string, options?: CookieOptions) {
  if (typeof document === 'undefined') return;

  const path = options?.path ?? '/';
  const sameSite = options?.sameSite ?? 'Lax';
  const secure = options?.secure ?? (typeof window !== 'undefined' && window.location.protocol === 'https:');

  let cookie = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;

  if (typeof options?.maxAgeSeconds === 'number') {
    cookie += `; Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`;
  }

  if (secure) {
    cookie += '; Secure';
  }

  document.cookie = cookie;
}

export function deleteCookie(name: string, options?: Omit<CookieOptions, 'maxAgeSeconds'>) {
  setCookie(name, '', { ...options, maxAgeSeconds: 0 });
}
