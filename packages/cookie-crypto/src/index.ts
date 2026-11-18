/**
 * Cookie Crypto — Shared cookie encryption/decryption utility
 *
 * Provides AES-256-GCM encryption for HTTP cookie values across all backend
 * services and the panels middleware. This adds a confidentiality layer on top
 * of the existing HttpOnly + Secure + SameSite cookie flags so that JWT tokens
 * stored in cookies are not readable in browser DevTools or by network observers.
 *
 * Encryption algorithm: AES-256-GCM (authenticated encryption)
 *   - 32-byte key (provided as 64 hex characters via COOKIE_ENCRYPTION_KEY env var)
 *   - 12-byte random IV per encryption (recommended for GCM)
 *   - 16-byte authentication tag (tamper detection)
 *
 * Encrypted cookie format: <iv_hex>.<authTag_hex>.<ciphertext_hex>
 *   - Three dot-separated hex segments for easy parsing
 *   - Each segment is lowercase hex-encoded
 *
 * @module cookie-crypto
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Re-export constants so existing `import { ... } from "cookie-crypto"` still works.
export { OBFUSCATED_COOKIE_NAMES, ORIGINAL_COOKIE_NAMES, PANEL_ROLE_CONFIG } from "./constants";

/** AES-256-GCM algorithm identifier for Node's crypto module */
const ALGORITHM = "aes-256-gcm";

/** IV length in bytes — 12 is the recommended size for GCM */
const IV_LENGTH = 12;

/** Auth tag length in bytes — 16 is the default and maximum for GCM */
const AUTH_TAG_LENGTH = 16;

/**
 * Separator used between segments of the encrypted cookie value.
 * Chosen because '.' does not appear in hex strings.
 */
const SEGMENT_SEPARATOR = ".";

/** Expected hex length of the encryption key (32 bytes = 64 hex chars) */
const KEY_HEX_LENGTH = 64;

// ============================================
// KEY VALIDATION
// ============================================

/**
 * Validates that the provided encryption key meets AES-256 requirements.
 * Should be called once at service startup (in main.ts) to fail fast
 * if the key is missing or malformed.
 *
 * @param key - The encryption key from COOKIE_ENCRYPTION_KEY env var
 * @throws {Error} If the key is undefined, empty, or not exactly 64 hex characters
 *
 * @example
 * ```ts
 * // In main.ts at startup:
 * validateEncryptionKey(process.env.COOKIE_ENCRYPTION_KEY);
 * ```
 */
export function validateEncryptionKey(key: string | undefined): asserts key is string {
  if (!key) {
    throw new Error(
      "[cookie-crypto] COOKIE_ENCRYPTION_KEY environment variable is required. " +
        "It must be a 64-character hex string (32 bytes for AES-256)."
    );
  }

  if (key.length !== KEY_HEX_LENGTH) {
    throw new Error(
      `[cookie-crypto] COOKIE_ENCRYPTION_KEY must be exactly ${KEY_HEX_LENGTH} hex characters ` +
        `(32 bytes). Received ${key.length} characters.`
    );
  }

  if (!/^[0-9a-fA-F]+$/.test(key)) {
    throw new Error(
      "[cookie-crypto] COOKIE_ENCRYPTION_KEY must contain only hexadecimal characters (0-9, a-f, A-F)."
    );
  }
}

// ============================================
// ENCRYPTION
// ============================================

/**
 * Encrypts a plaintext string (typically a JWT) using AES-256-GCM.
 *
 * Each call generates a fresh random IV, ensuring that encrypting the same
 * plaintext twice produces different ciphertext (semantic security).
 *
 * @param plaintext - The value to encrypt (e.g. a JWT string)
 * @param hexKey    - 64-character hex string representing the 32-byte AES key
 * @returns Encrypted string in the format: `<iv_hex>.<authTag_hex>.<ciphertext_hex>`
 *
 * @example
 * ```ts
 * const encrypted = encryptToken(jwtToken, process.env.COOKIE_ENCRYPTION_KEY);
 * res.setCookie('auth_token', encrypted, { httpOnly: true, ... });
 * ```
 */
export function encryptToken(plaintext: string, hexKey: string): string {
  // Convert hex key to a Buffer for the cipher
  const keyBuffer = Buffer.from(hexKey, "hex");

  // Generate a cryptographically random 12-byte IV
  const iv = randomBytes(IV_LENGTH);

  // Create AES-256-GCM cipher with the key and IV
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // Encrypt the plaintext (UTF-8 input → hex output)
  const encrypted = cipher.update(plaintext, "utf8", "hex") + cipher.final("hex");

  // Retrieve the 16-byte authentication tag (for tamper detection)
  const authTag = cipher.getAuthTag();

  // Return as dot-separated hex segments: iv.authTag.ciphertext
  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted,
  ].join(SEGMENT_SEPARATOR);
}

// ============================================
// DECRYPTION
// ============================================

/**
 * Decrypts an encrypted cookie value produced by `encryptToken`.
 *
 * Returns `null` if decryption fails for any reason (malformed input,
 * wrong key, tampered data). This makes it safe to use in request
 * pipelines without throwing unexpected errors.
 *
 * @param encryptedValue - The encrypted string in `<iv_hex>.<authTag_hex>.<ciphertext_hex>` format
 * @param hexKey         - 64-character hex string representing the 32-byte AES key
 * @returns The decrypted plaintext string, or `null` if decryption fails
 *
 * @example
 * ```ts
 * const jwt = decryptToken(request.cookies.auth_token, process.env.COOKIE_ENCRYPTION_KEY);
 * if (!jwt) {
 *   // Cookie was tampered with, corrupted, or encrypted with a different key
 * }
 * ```
 */
export function decryptToken(encryptedValue: string, hexKey: string): string | null {
  try {
    // Split into expected segments
    const segments = encryptedValue.split(SEGMENT_SEPARATOR);
    if (segments.length !== 3) {
      return null;
    }

    const [ivHex, authTagHex, ciphertextHex] = segments as [string, string, string];

    // Validate segment lengths before creating Buffers
    // IV = 12 bytes = 24 hex chars, AuthTag = 16 bytes = 32 hex chars
    if (ivHex.length !== IV_LENGTH * 2 || authTagHex.length !== AUTH_TAG_LENGTH * 2) {
      return null;
    }

    // Convert hex segments back to Buffers
    const keyBuffer = Buffer.from(hexKey, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    // Create AES-256-GCM decipher
    const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // Set the auth tag for integrity verification
    decipher.setAuthTag(authTag);

    // Decrypt (hex input → UTF-8 output)
    const decrypted = decipher.update(ciphertextHex, "hex", "utf8") + decipher.final("utf8");

    return decrypted;
  } catch {
    // Any error (bad hex, auth tag mismatch, wrong key, etc.) → return null
    return null;
  }
}

// ============================================
// SAFE DECRYPTION (migration helper)
// ============================================

/**
 * Regex to detect a JWT-like string (three Base64URL segments separated by dots).
 * Used by `decryptTokenSafe` to identify unencrypted legacy cookies.
 *
 * A JWT looks like: xxxxx.yyyyy.zzzzz
 * Each segment is Base64URL-encoded (alphanumeric + '-' + '_', optionally '=' padded).
 */
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * Regex to detect our AES-256-GCM encrypted cookie format.
 *
 * Encrypted cookies are formatted as: <iv_hex>.<authTag_hex>.<ciphertext_hex>
 *   - IV is exactly 12 bytes = 24 lowercase hex characters
 *   - Auth tag is exactly 16 bytes = 32 lowercase hex characters
 *   - Ciphertext is variable-length lowercase hex
 *
 * IMPORTANT: Without this check, encrypted values would incorrectly match
 * JWT_PATTERN (since lowercase hex chars are a subset of Base64URL chars),
 * causing `decryptTokenSafe` to return the raw encrypted value as if it
 * were a legacy JWT. This led to redirect loops in the panels middleware
 * when the encryption key was missing or wrong.
 */
const ENCRYPTED_COOKIE_PATTERN = /^[0-9a-f]{24}\.[0-9a-f]{32}\.[0-9a-f]+$/;

/**
 * Safely decrypts a cookie value with backward-compatible fallback for
 * unencrypted (legacy) cookies.
 *
 * **Migration strategy:**
 * When cookie encryption is first deployed, users may still have old
 * unencrypted JWT cookies in their browsers (up to 7 days until expiry).
 * This function handles that transition gracefully:
 *
 * 1. If the cookie value is empty/undefined → returns `null`
 * 2. Attempts AES-256-GCM decryption → returns decrypted JWT on success
 * 3. If decryption fails AND the value looks like our encrypted format
 *    (24-hex-dot-32-hex-dot-hex) → returns `null` (wrong key / corrupt)
 * 4. If decryption fails AND the value matches the JWT pattern (three
 *    dot-separated Base64URL segments) → returns the raw value as-is
 *    (it's a legacy unencrypted cookie)
 * 5. Otherwise → returns `null` (value is neither valid encrypted nor a valid JWT)
 *
 * Once all old cookies have expired (after 7 days), the JWT fallback path
 * will naturally stop being used. It can optionally be removed in a future
 * cleanup pass, but there's no harm in keeping it.
 *
 * @param cookieValue - The raw cookie value from the request, or undefined if cookie is absent
 * @param hexKey      - 64-character hex string representing the 32-byte AES key
 * @returns The decrypted (or legacy plain) JWT string, or `null` if invalid/absent
 *
 * @example
 * ```ts
 * // In a JWT strategy's token extractor:
 * const token = decryptTokenSafe(request.cookies?.auth_token, process.env.COOKIE_ENCRYPTION_KEY);
 * if (token) {
 *   return token; // Valid JWT ready for verification
 * }
 * ```
 */
export function decryptTokenSafe(
  cookieValue: string | undefined,
  hexKey: string
): string | null {
  // No cookie present
  if (!cookieValue) {
    return null;
  }

  // Attempt decryption first (happy path for new encrypted cookies)
  const decrypted = decryptToken(cookieValue, hexKey);
  if (decrypted) {
    return decrypted;
  }

  // Decryption failed — but the value might still be our encrypted format
  // (e.g. the decryption key is wrong or missing). Encrypted cookies use
  // lowercase hex segments with specific lengths (24.32.N), which happen
  // to also match JWT_PATTERN since hex ⊂ Base64URL. We MUST check for
  // the encrypted pattern FIRST to avoid returning the raw encrypted hex
  // as if it were a plain JWT (which causes decode failures downstream).
  if (ENCRYPTED_COOKIE_PATTERN.test(cookieValue)) {
    return null;
  }

  // Not an encrypted cookie — check if it's a legacy unencrypted JWT or an opaque session ID.
  // JWTs have three Base64URL segments: header.payload.signature
  // Opaque session IDs are random Base64Url strings.
  const OPAQUE_SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;
  if (JWT_PATTERN.test(cookieValue) || OPAQUE_SESSION_ID_PATTERN.test(cookieValue)) {
    return cookieValue;
  }

  // Value is neither a valid encrypted cookie nor a valid JWT
  return null;
}
