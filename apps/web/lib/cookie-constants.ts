import { OBFUSCATED_COOKIE_NAMES } from "cookie-crypto/constants";

export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? (process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME || OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN)
    : "auth_token";

// Dev-time assertion check
if (typeof window === "undefined" && process.env.NODE_ENV !== "production") {
  const backendCookieName = process.env.BACKEND_SESSION_COOKIE_NAME;
  if (backendCookieName && backendCookieName !== SESSION_COOKIE_NAME) {
    console.error(
      `[Auth] Cookie name mismatch! Middleware expects "${SESSION_COOKIE_NAME}" ` +
      `but backend sets "${backendCookieName}". Fix cookie-constants.ts.`
    );
  }
}
