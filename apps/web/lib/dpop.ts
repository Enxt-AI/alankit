import { get, set, del } from 'idb-keyval';

const DPOP_KEY_NAME = 'dpop_keypair';

/**
 * Ensures a DPoP keypair exists in IndexedDB.
 * If not, generates a new non-extractable ECDSA (P-256) keypair.
 */
export async function ensureDPoPKeyPair(): Promise<CryptoKeyPair> {
  if (typeof window === 'undefined') {
    throw new Error('DPoP is only supported in the browser');
  }

  let keyPair = await get<CryptoKeyPair>(DPOP_KEY_NAME);

  if (!keyPair) {
    keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      false, // non-extractable private key
      ['sign', 'verify']
    );
    await set(DPOP_KEY_NAME, keyPair);
  }

  return keyPair;
}

/**
 * Returns the public key in SPKI format (base64 encoded).
 * Used during login/registration to bind the key to the session.
 */
export async function getDPoPPublicKeySPKI(): Promise<string> {
  const keyPair = await ensureDPoPKeyPair();
  const exported = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  
  // Convert ArrayBuffer to base64
  const exportedAsString = String.fromCharCode.apply(null, Array.from(new Uint8Array(exported)));
  return btoa(exportedAsString);
}

/**
 * Hashes a string or object body using SHA-256.
 * Returns a hex string.
 */
export async function hashRequestBody(body: any): Promise<string> {
  if (!body) return '';
  
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  const encoder = new TextEncoder();
  const data = encoder.encode(bodyString);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Signs the canonical request payload:
 * METHOD CANONICAL_PATH TIMESTAMP JTI SHA256(BODY)
 * Returns the base64 encoded signature.
 */
export async function signDPoPRequest(
  method: string,
  canonicalPath: string,
  timestamp: string,
  jti: string,
  bodyHash: string
): Promise<string> {
  const keyPair = await ensureDPoPKeyPair();
  
  const payload = `${method.toUpperCase()} ${canonicalPath} ${timestamp} ${jti} ${bodyHash}`;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);

  const signatureBuffer = await window.crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    keyPair.privateKey,
    data
  );

  // WebCrypto returns ECDSA signatures in IEEE-P1363 format (r || s).
  // We'll base64 encode this raw format directly.
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureBase64 = btoa(String.fromCharCode.apply(null, signatureArray));
  
  return signatureBase64;
}

/**
 * Clears the DPoP keypair (e.g., on manual logout to force a new key next time).
 */
export async function clearDPoPKeyPair(): Promise<void> {
  if (typeof window !== 'undefined') {
    await del(DPOP_KEY_NAME);
  }
}
