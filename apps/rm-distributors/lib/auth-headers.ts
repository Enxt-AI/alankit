/**
 * Returns common headers for all authenticated fetch() calls.
 * Includes the device fingerprint header for session-device binding (anti-hijacking).
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  if (typeof window !== 'undefined') {
    let fp = localStorage.getItem('device-fingerprint');
    if (!fp) {
      fp = Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
      localStorage.setItem('device-fingerprint', fp);
    }
    headers['x-device-fingerprint'] = fp;
  }

  return headers;
}
