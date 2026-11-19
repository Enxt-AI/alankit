import { NextResponse } from 'next/server';
import { OBFUSCATED_COOKIE_NAMES, ORIGINAL_COOKIE_NAMES } from 'cookie-crypto/constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function stripAuthMountPath(value: string): string {
  // Accept all env shapes currently used in this repo:
  // - http://host
  // - http://host/api
  // - http://host/api/auth
  // The proxy route always targets /api/auth/profile itself, so normalize the
  // env input back to the bare service origin before building the final URL.
  return value.replace(/\/api\/auth$/, '').replace(/\/api$/, '');
}

function buildAuthProfileCandidates(): string[] {
  const fallbackOrigin = process.env.NODE_ENV === 'production' && !process.env.VERCEL
    ? 'http://auth-service:3002'
    : 'http://127.0.0.1:3002';
  const candidates = new Set<string>();
  const rawCandidates = [
    // Use the shared gateway first; direct service URLs are only local fallbacks.
    (process.env.BACKEND_ORIGIN || '').trim(),
    fallbackOrigin,
  ];

  for (const raw of rawCandidates) {
    if (!raw || raw.startsWith('/')) {
      continue;
    }

    const normalizedOrigin = stripAuthMountPath(raw.replace(/\/$/, ''));
    if (!normalizedOrigin) {
      continue;
    }

    candidates.add(`${normalizedOrigin}/api/auth/profile`);
  }

  // Match the rewrite default, retaining localhost for non-container deployments.
  candidates.add(`${fallbackOrigin}/api/auth/profile`);
  candidates.add('http://localhost:3002/api/auth/profile');

  return Array.from(candidates);
}

export async function GET(request: Request) {
  let cookieHeader = request.headers.get('cookie') ?? '';
  
  // STRIP ADMIN COOKIES:
  // On localhost, the browser sends all cookies for the domain. If a developer is
  // logged into the admin panel (which sets __s_a2, __s_c1, etc.), the backend's
  // JwtStrategy will extract the admin token FIRST and return an 'ADMIN' profile.
  // We explicitly remove these from the forwarded request so the backend evaluates
  // the 'USER' token (__s_a1).
  const adminCookiesToRemove = [
    OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN,
    OBFUSCATED_COOKIE_NAMES.CMS_PANEL_TOKEN,
    OBFUSCATED_COOKIE_NAMES.SUPPORT_PANEL_TOKEN,
    OBFUSCATED_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN,
    OBFUSCATED_COOKIE_NAMES.OPERATION_PANEL_TOKEN,
    ORIGINAL_COOKIE_NAMES.ADMIN_PANEL_TOKEN,
    ORIGINAL_COOKIE_NAMES.CMS_PANEL_TOKEN,
    ORIGINAL_COOKIE_NAMES.SUPPORT_PANEL_TOKEN,
    ORIGINAL_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN,
    ORIGINAL_COOKIE_NAMES.OPERATION_PANEL_TOKEN,
  ];

  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const filteredCookies = cookies.filter((cookieString) => {
      const cookieName = cookieString.split('=')[0];
      return !adminCookiesToRemove.includes(cookieName as any);
    });
    cookieHeader = filteredCookies.join('; ');
  }

  const upstreamCandidates = buildAuthProfileCandidates();

  let upstreamResponse: Response | null = null;
  let lastNetworkError: unknown = null;
  let successfulUpstreamUrl = '';

  const userAgent = request.headers.get('user-agent') ?? '';
  const deviceFingerprint = request.headers.get('x-device-fingerprint') ?? '';
  const forwardedFor = request.headers.get('x-forwarded-for') ?? '';
  const realIp = request.headers.get('x-real-ip') ?? '';
  const dpopProof = request.headers.get('x-dpop-proof') ?? '';
  const dpopTimestamp = request.headers.get('x-dpop-timestamp') ?? '';
  const dpopJti = request.headers.get('x-dpop-jti') ?? '';

  const forwardedHeaders: Record<string, string> = {
    cookie: cookieHeader,
    accept: 'application/json',
  };
  if (userAgent) forwardedHeaders['user-agent'] = userAgent;
  if (deviceFingerprint) forwardedHeaders['x-device-fingerprint'] = deviceFingerprint;
  if (forwardedFor) forwardedHeaders['x-forwarded-for'] = forwardedFor;
  if (realIp) forwardedHeaders['x-real-ip'] = realIp;
  if (dpopProof) forwardedHeaders['x-dpop-proof'] = dpopProof;
  if (dpopTimestamp) forwardedHeaders['x-dpop-timestamp'] = dpopTimestamp;
  if (dpopJti) forwardedHeaders['x-dpop-jti'] = dpopJti;

  // Try the most likely auth-service URLs in order. This keeps profile
  // hydration working even if the auth-service env is declared as /api/auth
  // in one environment and /api in another.
  for (const upstreamUrl of upstreamCandidates) {
    try {
      const response = await fetch(upstreamUrl, {
        method: 'GET',
        headers: forwardedHeaders,
        cache: 'no-store',
      });
      
      console.log(`[AUTH DEBUG] Attempted fetch to ${upstreamUrl}, status: ${response.status}`);

      if (response.status === 404) {
        continue;
      }

      upstreamResponse = response;
      successfulUpstreamUrl = upstreamUrl;
      break;
    } catch (error) {
      lastNetworkError = error;
    }
  }

  if (!upstreamResponse) {
    if (lastNetworkError) {
      return NextResponse.json(
        { message: 'Auth service unavailable' },
        { status: 502, headers: { 'cache-control': 'no-store' } },
      );
    }

    return NextResponse.json(
      { message: 'Auth profile endpoint not found' },
      { status: 404, headers: { 'cache-control': 'no-store' } },
    );
  }

  // The web app treats a missing/expired session as "no user".
  // CRITICAL: If the backend signals 401, the user's cookie is invalid/expired.
  // We MUST proactively clear the cookie here, otherwise Next.js middleware will
  // still see the cookie on subsequent navigations and redirect them away from
  // /login, trapping the user in a permanently logged-out UI state.
  if (upstreamResponse.status === 401) {
    const nextResponse = NextResponse.json(null, {
      status: 200,
      headers: { 'cache-control': 'no-store' },
    });

    // Clear both the obfuscated and legacy cookie names
    nextResponse.cookies.delete(OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN);
    nextResponse.cookies.delete(ORIGINAL_COOKIE_NAMES.AUTH_TOKEN);

    return nextResponse;
  }

  const bodyText = await upstreamResponse.text();
  const contentType = upstreamResponse.headers.get('content-type') || 'application/json';

  return new NextResponse(bodyText, {
    status: upstreamResponse.status,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
    },
  });
}

export async function POST(request: Request) {
  let cookieHeader = request.headers.get('cookie') ?? '';
  
  const adminCookiesToRemove = [
    OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN,
    OBFUSCATED_COOKIE_NAMES.CMS_PANEL_TOKEN,
    OBFUSCATED_COOKIE_NAMES.SUPPORT_PANEL_TOKEN,
    OBFUSCATED_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN,
    OBFUSCATED_COOKIE_NAMES.OPERATION_PANEL_TOKEN,
    ORIGINAL_COOKIE_NAMES.ADMIN_PANEL_TOKEN,
    ORIGINAL_COOKIE_NAMES.CMS_PANEL_TOKEN,
    ORIGINAL_COOKIE_NAMES.SUPPORT_PANEL_TOKEN,
    ORIGINAL_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN,
    ORIGINAL_COOKIE_NAMES.OPERATION_PANEL_TOKEN,
  ];

  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const filteredCookies = cookies.filter((cookieString) => {
      const cookieName = cookieString.split('=')[0];
      return !adminCookiesToRemove.includes(cookieName as any);
    });
    cookieHeader = filteredCookies.join('; ');
  }

  const upstreamCandidates = buildAuthProfileCandidates();
  let upstreamResponse: Response | null = null;
  let lastNetworkError: unknown = null;
  
  const bodyText = await request.text();

  const userAgent = request.headers.get('user-agent') ?? '';
  const deviceFingerprint = request.headers.get('x-device-fingerprint') ?? '';
  const forwardedFor = request.headers.get('x-forwarded-for') ?? '';
  const realIp = request.headers.get('x-real-ip') ?? '';
  const dpopProof = request.headers.get('x-dpop-proof') ?? '';
  const dpopTimestamp = request.headers.get('x-dpop-timestamp') ?? '';
  const dpopJti = request.headers.get('x-dpop-jti') ?? '';

  const forwardedHeaders: Record<string, string> = {
    cookie: cookieHeader,
    accept: 'application/json',
    'content-type': 'application/json',
  };
  if (userAgent) forwardedHeaders['user-agent'] = userAgent;
  if (deviceFingerprint) forwardedHeaders['x-device-fingerprint'] = deviceFingerprint;
  if (forwardedFor) forwardedHeaders['x-forwarded-for'] = forwardedFor;
  if (realIp) forwardedHeaders['x-real-ip'] = realIp;
  if (dpopProof) forwardedHeaders['x-dpop-proof'] = dpopProof;
  if (dpopTimestamp) forwardedHeaders['x-dpop-timestamp'] = dpopTimestamp;
  if (dpopJti) forwardedHeaders['x-dpop-jti'] = dpopJti;

  for (const upstreamUrl of upstreamCandidates) {
    try {
      const response = await fetch(upstreamUrl, {
        method: 'POST',
        headers: forwardedHeaders,
        body: bodyText,
        cache: 'no-store',
      });
      
      if (response.status === 404) {
        continue;
      }

      upstreamResponse = response;
      break;
    } catch (error) {
      lastNetworkError = error;
    }
  }

  if (!upstreamResponse) {
    if (lastNetworkError) {
      return NextResponse.json(
        { message: 'Auth service unavailable' },
        { status: 502, headers: { 'cache-control': 'no-store' } },
      );
    }
    return NextResponse.json(
      { message: 'Auth profile endpoint not found' },
      { status: 404, headers: { 'cache-control': 'no-store' } },
    );
  }

  const responseBody = await upstreamResponse.text();
  const contentType = upstreamResponse.headers.get('content-type') || 'application/json';

  return new NextResponse(responseBody, {
    status: upstreamResponse.status,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
    },
  });
}
