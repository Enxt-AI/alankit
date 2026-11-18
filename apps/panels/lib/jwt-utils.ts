/**
 * JWT Utilities
 *
 * Panels uses cookie-only authentication (HttpOnly cookies) as credentials.
 * These helpers are limited to decoding/expiry checks when a JWT is provided
 * (e.g. a token returned in a response body).
 */

export function decodeToken(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    let payload = parts[1];
    if (!payload) return null;
    
    // Handle base64url encoding: replace URL-safe chars and add padding
    payload = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) {
      payload += '=';
    }
    
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch (error) {
    return true;
  }
}

