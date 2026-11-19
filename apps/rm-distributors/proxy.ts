import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptTokenSafe, OBFUSCATED_COOKIE_NAMES } from "cookie-crypto";
import { stripBasePath, withBasePath } from "./lib/base-path";

/**
 * Force Node.js runtime so we can use the 'node:crypto' module
 * required by the cookie-crypto package for AES-256-GCM decryption.
 * Edge Runtime does NOT support Node.js built-in modules.
 */


// ============================================
// TYPES & CONFIGURATION
// ============================================

type TokenType = "DISTRIBUTOR" | "INTERNAL_RM" | "DISTRIBUTOR_RM" | "BRANCH";

interface TokenPayload {
  type?: TokenType;
  exp?: number;
  [key: string]: any;
}

interface RouteConfig {
  pathPrefix: string;
  tokenNames: string[]; // Can accept multiple token names (e.g., Internal RM or Distributor RM)
  loginPath: string;
  dashboardPath: string;
  allowedTypes?: TokenType[]; // To check 'type' field in JWT
}

const ROUTE_CONFIGS: RouteConfig[] = [
  // Distributor Portal
  {
    pathPrefix: "/distributor",
    tokenNames: [OBFUSCATED_COOKIE_NAMES.DISTRIBUTOR_PANEL_TOKEN],
    loginPath: "/login/distributor",
    dashboardPath: "/distributor",
    allowedTypes: ["DISTRIBUTOR"],
  },
  // RM Portal (Accepts both Internal and Distributor RMs)
  {
    pathPrefix: "/rm",
    tokenNames: [OBFUSCATED_COOKIE_NAMES.INTERNAL_RM_PANEL_TOKEN, OBFUSCATED_COOKIE_NAMES.DISTRIBUTOR_RM_PANEL_TOKEN],
    loginPath: "/login/rm",
    dashboardPath: "/rm",
    allowedTypes: ["INTERNAL_RM", "DISTRIBUTOR_RM"],
  },
  // Branch Portal
  {
    pathPrefix: "/branch",
    tokenNames: [OBFUSCATED_COOKIE_NAMES.BRANCH_PANEL_TOKEN],
    loginPath: "/login/branch",
    dashboardPath: "/branch",
    allowedTypes: ["BRANCH"],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

// Legacy JWT decodeToken and isTokenExpired removed as tokens are now opaque session IDs.

function getToken(request: NextRequest, tokenNames: string[]): string | null {
  // Check tokens in order and return the first valid one
  for (const tokenName of tokenNames) {
    const rawValue = request.cookies.get(tokenName)?.value;
    if (rawValue) {
      // Decrypt using AES-256-GCM
      const encryptionKey = process.env.COOKIE_ENCRYPTION_KEY || "";
      const decrypted = decryptTokenSafe(rawValue, encryptionKey);
      if (decrypted) return decrypted;
    }
  }
  return null;
}

// ============================================
// MAIN MIDDLEWARE
// ============================================

export default async function proxy(request: NextRequest) {
  const pathname = stripBasePath(request.nextUrl.pathname);

  // Handle explicit cookie clear
  if (pathname.includes("/login") && request.nextUrl.searchParams.get("clear") === "true") {
    const url = request.nextUrl.clone();
    url.search = ""; // remove ?clear=true
    const response = NextResponse.redirect(url);
    // Delete both host-only cookies and cookies scoped to COOKIE_DOMAIN (e.g. .unlistedstox.com)
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const clearCookie = (name: string) => {
      response.cookies.delete(name);
      if (cookieDomain) {
        response.cookies.set({ name, value: "", path: "/", domain: cookieDomain, maxAge: 0 });
      }
    };
    if (pathname.includes("/distributor")) {
      clearCookie(OBFUSCATED_COOKIE_NAMES.DISTRIBUTOR_PANEL_TOKEN);
    } else if (pathname.includes("/rm")) {
      clearCookie(OBFUSCATED_COOKIE_NAMES.INTERNAL_RM_PANEL_TOKEN);
      clearCookie(OBFUSCATED_COOKIE_NAMES.DISTRIBUTOR_RM_PANEL_TOKEN);
    } else if (pathname.includes("/branch")) {
      clearCookie(OBFUSCATED_COOKIE_NAMES.BRANCH_PANEL_TOKEN);
    }
    return response;
  }

  // Find matching config for protected routes
  const config = ROUTE_CONFIGS.find((c) => pathname.startsWith(c.pathPrefix));

  // If the user is on a login page
  const isLoginPage = pathname === "/login/distributor" || pathname === "/login/rm" || pathname === "/login/branch";

  if (isLoginPage) {
    // Check ONLY the configuration for the specific login page the user is trying to access
    const c = ROUTE_CONFIGS.find((config) => pathname === config.loginPath);
    if (c) {
      const token = getToken(request, c.tokenNames);
      if (token) {
        const url = new URL(request.url);
        url.pathname = withBasePath(c.dashboardPath);
        return NextResponse.redirect(url);
      }
    }
    // Otherwise let them access the login page
    return NextResponse.next();
  }

  // If they are on a protected route (like /distributor or /rm)
  if (config) {
    const token = getToken(request, config.tokenNames);

    // No token -> Redirect to Login
    if (!token) {
      const url = new URL(request.url);
      url.pathname = withBasePath(config.loginPath);
      return NextResponse.redirect(url);
    }

    // Allow Access to protected route
    return NextResponse.next();
  }

  // Allow unrestricted routes (e.g. homepage, other roles)
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/distributor/:path*",
    "/login/distributor",
    "/rm/:path*",
    "/login/rm",
    "/branch/:path*",
    "/login/branch",
  ],
};
