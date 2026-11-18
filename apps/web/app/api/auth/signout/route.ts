import { NextResponse } from 'next/server';
import { OBFUSCATED_COOKIE_NAMES, ORIGINAL_COOKIE_NAMES } from 'cookie-crypto/constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function stripAuthMountPath(value: string): string {
  return value.replace(/\/api\/auth$/, '').replace(/\/api$/, '');
}

function buildAuthSignoutCandidates(): string[] {
  const fallbackOrigin = process.env.NODE_ENV === 'production' && !process.env.VERCEL
    ? 'http://auth-service:3002'
    : 'http://127.0.0.1:3002';
  const candidates = new Set<string>();
  const rawCandidates = [
    (process.env.AUTH_SERVICE_URL || '').trim(),
    (process.env.BACKEND_ORIGIN || '').trim(),
    (process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || '').trim(),
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

    candidates.add(`${normalizedOrigin}/api/auth/signout`);
  }

  candidates.add(`${fallbackOrigin}/api/auth/signout`);
  candidates.add('http://localhost:3002/api/auth/signout');

  return Array.from(candidates);
}

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const upstreamCandidates = buildAuthSignoutCandidates();

  // Notify upstream auth-service so it invalidates the session in Redis
  for (const upstreamUrl of upstreamCandidates) {
    try {
      const response = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          cookie: cookieHeader,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        cache: 'no-store',
      });

      if (response.status !== 404) {
        break;
      }
    } catch {
      // Continue to next candidate
    }
  }

  const nextResponse = NextResponse.json(
    { success: true },
    { status: 200, headers: { 'cache-control': 'no-store' } }
  );

  const cookiesToClear = [
    OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN,
    OBFUSCATED_COOKIE_NAMES.AUTH_REFRESH_TOKEN,
    ORIGINAL_COOKIE_NAMES.AUTH_TOKEN,
    ORIGINAL_COOKIE_NAMES.AUTH_REFRESH_TOKEN,
  ];

  for (const name of cookiesToClear) {
    nextResponse.cookies.delete(name);
    nextResponse.cookies.set(name, '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  }

  return nextResponse;
}

export async function GET(request: Request) {
  return POST(request);
}
