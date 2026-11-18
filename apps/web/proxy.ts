import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "./lib/cookie-constants";
import { OBFUSCATED_COOKIE_NAMES, ORIGINAL_COOKIE_NAMES } from "cookie-crypto/constants";

const PROTECTED_ROUTES = [
  "/support",
  "/supports",
  "/notification",
  "/dashboard",
  "/settings",
  "/profile",
  "/orders",
  "/watchlist",
  "/kyc",
  "/demat",
  "/bank",
];

// AI / LLM crawlers we intentionally allow and track. Explicit names keep the
// policy auditable (see /robots.txt for the full rule set).
const AI_BOT_PATTERNS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
  "BingChat",
  "BingPreview",
];

function isAiBot(ua: string | null): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return AI_BOT_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

export function proxy(request: NextRequest) {
  const ua = request.headers.get("user-agent") || "";
  const isBot = isAiBot(ua);

  // Crawl coverage logging: record which AI bots are hitting which public
  // pages. This feeds the "plumbing is fixed" signal alongside the prompt
  // panel (the official citation metric).
  if (isBot) {
    console.log(
      `[AI-BOT] ${new Date().toISOString()} ua=${ua} path=${request.nextUrl.pathname}`
    );
  }

  // Read user auth cookie checking all candidates for robustness
  const authToken = request.cookies.get(OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN)?.value
    || request.cookies.get(ORIGINAL_COOKIE_NAMES.AUTH_TOKEN)?.value
    || request.cookies.get(SESSION_COOKIE_NAME)?.value
    || request.cookies.get("auth_token")?.value;
  const { pathname } = request.nextUrl;

  // Normalize /support to /supports
  if (pathname === "/support" || pathname.startsWith("/support/")) {
    const newPath = pathname.replace(/^\/support/, "/supports");
    return NextResponse.redirect(new URL(newPath, request.url));
  }

  // 0. Handle explicit cookie clear to recover from stale cookie states seamlessly
  if (pathname === "/login" && request.nextUrl.searchParams.get("clear") === "true") {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN);
    response.cookies.delete(ORIGINAL_COOKIE_NAMES.AUTH_TOKEN);
    response.cookies.delete(SESSION_COOKIE_NAME);
    response.cookies.delete("auth_token");
    return response;
  }

  // Cookie presence is not proof of a valid session (it may be expired or
  // revoked). Always allow login; the client redirects after session hydration.

  // 2. Unauthenticated user visiting protected route -> redirect to /login with returnUrl
  // Buy pages (/stocks/<slug>/buy, /baskets/<slug>/buy) are checkout entry
  // points and must always require sign-in, even on direct URL entry.
  const normalizedPath =
    pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const isBuyRoute =
    (normalizedPath.startsWith("/stocks/") || normalizedPath.startsWith("/baskets/")) &&
    normalizedPath.endsWith("/buy");
  const isProtectedRoute =
    PROTECTED_ROUTES.some((route) => pathname.startsWith(route)) || isBuyRoute;
  if (!authToken && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/support",
    "/support/:path*",
    "/supports",
    "/supports/:path*",
    "/notification",
    "/notification/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/settings",
    "/settings/:path*",
    "/profile",
    "/profile/:path*",
    "/orders",
    "/orders/:path*",
    "/watchlist",
    "/watchlist/:path*",
    "/kyc",
    "/kyc/:path*",
    "/demat",
    "/demat/:path*",
    "/bank",
    "/bank/:path*",
    "/stocks/:id/buy",
    "/baskets/:id/buy",
    // Public content routes — included so AI bot crawls are logged for
    // crawl-coverage measurement. Auth checks pass through for these.
    "/stocks/:path*",
    "/articles/:path*",
    "/news/:path*",
    "/baskets/:path*",
    "/upcoming-stocks/:path*",
    "/",
  ],
};
