import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { OBFUSCATED_COOKIE_NAMES, ORIGINAL_COOKIE_NAMES, PANEL_ROLE_CONFIG } from "cookie-crypto/constants";

// ============================================
// TYPES & CONFIGURATION
// ============================================

type UserRole = "ADMIN" | "SUPER_ADMIN" | "CONTENT_MANAGER" | "SUPPORT_AGENT" | "MARKETING_MANAGER" | "ACCOUNTANT" | "OPERATIONS";
// NOTE: "RM" removed from UserRole as part of RM system deprecation.
type TokenType = "ADMIN" | "USER" | "ACCOUNTANT" | "OPERATIONS";
// NOTE: "RM" removed from TokenType as part of RM system deprecation.

interface TokenPayload {
  type?: TokenType;
  role?: UserRole;
  exp?: number;
  [key: string]: any;
}

interface RouteConfig {
  pathPrefix: string;
  tokenName: string;
  Path: string;
  dashboardPath: string;
  allowedRoles?: UserRole[]; // If empty, any valid token of correct type is allowed (unless specific logic applies)
  allowedTypes?: TokenType[]; // To check 'type' field in JWT
  exactMatch?: boolean; // For root paths like /admin vs /admin/dashboard
}

const ROUTE_CONFIGS: RouteConfig[] = [
  // Admin Panel — cookie name is obfuscated via OBFUSCATED_COOKIE_NAMES
  {
    pathPrefix: "/admin",
    tokenName: OBFUSCATED_COOKIE_NAMES.ADMIN_PANEL_TOKEN,
    Path: "/admin/login",
    dashboardPath: "/admin/dashboard",
    allowedRoles: [...PANEL_ROLE_CONFIG.ADMIN] as UserRole[],
    allowedTypes: ["ADMIN"],
  },
  // CMS Panel
  {
    pathPrefix: "/cms",
    tokenName: OBFUSCATED_COOKIE_NAMES.CMS_PANEL_TOKEN,
    Path: "/cms/login",
    dashboardPath: "/cms/dashboard",
    allowedRoles: [...PANEL_ROLE_CONFIG.CMS] as UserRole[],
  },
  // Support Panel
  {
    pathPrefix: "/support",
    tokenName: OBFUSCATED_COOKIE_NAMES.SUPPORT_PANEL_TOKEN,
    Path: "/support/login",
    dashboardPath: "/support/dashboard",
    allowedRoles: [...PANEL_ROLE_CONFIG.SUPPORT] as UserRole[],
  },
  // NOTE: RM Panel route config removed as part of RM system deprecation.
  // Marketing Panel
  {
    pathPrefix: "/marketing",
    tokenName: OBFUSCATED_COOKIE_NAMES.MARKETING_PANEL_TOKEN,
    Path: "/marketing/login",
    dashboardPath: "/marketing/dashboard",
    allowedRoles: [...PANEL_ROLE_CONFIG.MARKETING] as UserRole[],
    allowedTypes: ["ADMIN"],
  },
  // Accounting Panel
  {
    pathPrefix: "/accounting",
    tokenName: OBFUSCATED_COOKIE_NAMES.ACCOUNTING_PANEL_TOKEN,
    Path: "/accounting/login",
    dashboardPath: "/accounting/dashboard",
    allowedRoles: [...PANEL_ROLE_CONFIG.ACCOUNTING] as UserRole[],
  },
  // Operation Panel
  {
    pathPrefix: "/operation",
    tokenName: OBFUSCATED_COOKIE_NAMES.OPERATION_PANEL_TOKEN,
    Path: "/operation/login",
    dashboardPath: "/operation/dashboard",
    allowedRoles: [...PANEL_ROLE_CONFIG.OPERATION] as UserRole[],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================



// Legacy JWT decodeToken and isTokenExpired removed as tokens are now opaque session IDs.

async function decryptTokenSafeEdge(encryptedValue: string, hexKey: string): Promise<string | null> {
  try {
    // We must check the encrypted pattern FIRST because lowercase hex characters are a subset
    // of Base64URL characters. If we just use the JWT regex, it will incorrectly match 
    // the encrypted cookie and return the raw encrypted hex as if it were a plain JWT.
    const encryptedCookiePattern = /^[0-9a-f]{24}\.[0-9a-f]{32}\.[0-9a-f]+$/;
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    const opaqueSessionIdRegex = /^[A-Za-z0-9-_]{32,64}$/;

    // Not an encrypted cookie — check if it's a legacy unencrypted JWT or an opaque session ID
    if (!encryptedCookiePattern.test(encryptedValue) && (jwtRegex.test(encryptedValue) || opaqueSessionIdRegex.test(encryptedValue))) {
      return encryptedValue;
    }

    // It should be an encrypted cookie to proceed with decryption
    if (!encryptedCookiePattern.test(encryptedValue)) {
      return null;
    }

    const segments = encryptedValue.split(".");
    if (segments.length !== 3) return null;

    const [ivHex, authTagHex, ciphertextHex] = segments;
    if (!ivHex || !authTagHex || !ciphertextHex) return null;

    const fromHex = (hex: string) => {
      const arr = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        arr[i / 2] = parseInt(hex.substring(i, i + 2), 16);
      }
      return arr;
    };

    const keyBytes = fromHex(hexKey);
    const ivBytes = fromHex(ivHex);
    const authTagBytes = fromHex(authTagHex);
    const ciphertextBytes = fromHex(ciphertextHex);

    // Web Crypto requires ciphertext and authTag to be concatenated for AES-GCM
    const encryptedBytes = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
    encryptedBytes.set(ciphertextBytes, 0);
    encryptedBytes.set(authTagBytes, ciphertextBytes.length);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBytes,
        tagLength: 128,
      },
      cryptoKey,
      encryptedBytes
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    return null;
  }
}

async function getToken(request: NextRequest, tokenName: string): Promise<string | null> {
  // Read the raw (possibly encrypted) cookie value using the obfuscated name.
  // We no longer check legacy original names as the migration window has passed.
  const rawValue = request.cookies.get(tokenName)?.value ?? null;
  if (!rawValue) return null;

  // Decrypt using Web Crypto API for Edge Runtime compatibility
  const encryptionKey = process.env.COOKIE_ENCRYPTION_KEY || '';
  return await decryptTokenSafeEdge(rawValue, encryptionKey);
}

async function getValidToken(request: NextRequest, config: RouteConfig): Promise<string | null> {
  const token = await getToken(request, config.tokenName);
  
  // Tokens are now opaque session IDs (not JWTs), so we cannot decode them to check 
  // expiry or roles. We rely on the presence of a successfully decrypted cookie.
  // If the session is invalid in Redis, the backend will return 401 and api-client 
  // will redirect to login.
  if (token) {
    return token;
  }
  
  return null;
}

function isWorkspaceRoot(pathname: string, pathPrefix: string): boolean {
  return pathname === pathPrefix || pathname === `${pathPrefix}/`;
}

// ============================================
// MAIN MIDDLEWARE
// ============================================

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // If visiting /desktop-required, redirect back to /admin
  if (pathname === "/desktop-required") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Find matching config
  const config = ROUTE_CONFIGS.find((c) => pathname.startsWith(c.pathPrefix));

  // If no config matches, allow access (public route)
  if (!config) {
    return NextResponse.next();
  }

  // 0. Handle explicit cookie clear to recover from stale cookie states seamlessly
  // If ?clear=true is passed to any login route, wipe all panel cookies
  // Proactively clear all legacy original cookies on any login page visit to prevent accumulation
  if (pathname.endsWith("/login")) {
    const isExplicitClear = request.nextUrl.searchParams.get("clear") === "true";
    
    // Always proactively delete legacy original cookies when visiting a login page
    // We do this by forcing a redirect to the same page without ?clear=true if we detect legacy cookies
    let hasLegacyCookies = false;
    Object.values(ORIGINAL_COOKIE_NAMES).forEach((origName) => {
      if (request.cookies.has(origName)) {
        hasLegacyCookies = true;
      }
    });

    if (isExplicitClear || hasLegacyCookies) {
      const url = request.nextUrl.clone();
      if (isExplicitClear) {
        url.searchParams.delete("clear");
      }
      const response = NextResponse.redirect(url);
      
      Object.values(ORIGINAL_COOKIE_NAMES).forEach((origName) => {
        response.cookies.delete(origName);
      });
      
      if (isExplicitClear) {
        Object.values(OBFUSCATED_COOKIE_NAMES).forEach((obfuscatedName) => {
          response.cookies.delete(obfuscatedName);
        });
      }
      return response;
    }
  }

  // Get Token
  const token = await getValidToken(request, config);

  // Workspace root handling (e.g. /admin, /cms, /rm, /support, /marketing)
  // These root routes often don't have an index page; redirect deterministically.
  if (isWorkspaceRoot(pathname, config.pathPrefix)) {
    const url = request.nextUrl.clone();

    if (!token) {
      url.pathname = config.Path;
      return NextResponse.redirect(url);
    }

    url.pathname = config.dashboardPath;
    return NextResponse.redirect(url);
  }

  // Special Handling:  Pages
  // If user is already logged in and tries to access  page, redirect to dashboard
  if (pathname === config.Path) {
    if (token) {
      const url = request.nextUrl.clone();
      url.pathname = config.dashboardPath;
      return NextResponse.redirect(url);
    }
    // Allow access to login page if not authenticated
    return NextResponse.next();
  }

  // Protected Routes Handling
  // If no token or expired, redirect to 
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = config.Path;
    // Add returnUrl for better UX? existing code didn't have it, keeping it simple for now
    return NextResponse.redirect(url);
  }

  // Allow Access
  return NextResponse.next();
}

// JWT decoding functions (decodeToken, isTokenExpired, validateRoleAndType) 
// were removed because tokens are now opaque session IDs.

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
