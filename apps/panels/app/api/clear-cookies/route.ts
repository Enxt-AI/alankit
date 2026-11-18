import { NextRequest, NextResponse } from 'next/server';
import { OBFUSCATED_COOKIE_NAMES, ORIGINAL_COOKIE_NAMES } from 'cookie-crypto';

/**
 * Emergency cookie clear endpoint.
 * This route forces a wipe of all panel-related cookies (both current and legacy).
 * Use this as an escape hatch if the browser sends too many cookies resulting in 
 * "Request header field exceeds server limit" errors that prevent normal page loads.
 * 
 * Usage: /api/clear-cookies?redirect=/admin/login
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const redirectPath = searchParams.get('redirect') || '/';
  
  const response = NextResponse.redirect(new URL(redirectPath, request.url));
  
  // Clear all current obfuscated cookies
  Object.values(OBFUSCATED_COOKIE_NAMES).forEach((cookieName) => {
    response.cookies.delete(cookieName);
  });
  
  // Clear all legacy original cookies
  Object.values(ORIGINAL_COOKIE_NAMES).forEach((cookieName) => {
    response.cookies.delete(cookieName);
  });
  
  return response;
}
