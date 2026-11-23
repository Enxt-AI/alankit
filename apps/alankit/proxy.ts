import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set('returnUrl', request.nextUrl.pathname + request.nextUrl.search);
  const deny = () => {
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };

  const backendOrigin = process.env.BACKEND_ORIGIN?.trim().replace(/\/$/, "");
  const cookie = request.headers.get("cookie");
  if (!backendOrigin || !cookie) return deny();

  try {
    // Validate the session with the auth service, including expiry, revocation,
    // and account status. Cookie presence alone never grants access.
    const result = await fetch(`${backendOrigin}/api/auth/profile`, {
      headers: { cookie },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!result.ok) return deny();

    const profile = await result.json();
    if (!profile?.id || profile.type !== "USER") return deny();

    if (request.nextUrl.pathname.startsWith('/checkout') && profile.kycStatus !== 'VERIFIED') {
      const kycUrl = new URL('/kyc', request.url);
      kycUrl.searchParams.set('returnUrl', request.nextUrl.pathname + request.nextUrl.search);
      const response = NextResponse.redirect(kycUrl);
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    }

    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    // Fail closed when authentication cannot be confirmed.
    return deny();
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/watchlist/:path*",
    "/notifications/:path*",
    "/kyc/:path*",
    "/checkout/:path*",
  ],
};
