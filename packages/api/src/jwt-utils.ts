/**
 * JWT Utilities (client-side helpers)
 *
 * IMPORTANT:
 * - This file does NOT manage token persistence.
 * - User authentication in `apps/web` is cookie-only (HttpOnly `auth_token` set by backend).
 * - These helpers are used only to decode tokens when a token is already present in-memory
 *   (e.g., debugging, inspecting third-party credentials).
 *
 * Security note:
 * - Do not use client-side JWT decoding as a security boundary.
 *   All authorization must be enforced by the backend.
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

// ============================================
// ADMIN TOKEN MANAGEMENT - REMOVED
// Admin tokens are now exclusively HttpOnly cookies
// managed by the backend. No client-side storage.
// ============================================

