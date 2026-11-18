import { Prisma } from '../generated/prisma';
import { encryptStringSync, decryptStringSync, makeKeychainSync, findKeyForMessage, parseKeySync } from '@47ng/cloak';

const SENSITIVE_JSON_FIELDS = ['kycData', 'bankData', 'dematData'];

// Internal module state for keys
let keychain: any = null;
let currentKey: any = null;
let isInitialized = false;

function initCrypto() {
  if (isInitialized) return;
  isInitialized = true;

  const currentKeyStr = process.env.JSON_FIELD_ENCRYPTION_KEY || process.env.PRISMA_FIELD_ENCRYPTION_KEY;
  if (!currentKeyStr) {
    console.warn('[JSON-Encryption] No JSON_FIELD_ENCRYPTION_KEY provided. JSON encryption will be disabled.');
    return;
  }
  currentKey = parseKeySync(currentKeyStr);

  const decryptionKeysStr = process.env.JSON_FIELD_DECRYPTION_KEYS || process.env.PRISMA_FIELD_DECRYPTION_KEYS || '';
  const keyStrings = [currentKeyStr, ...decryptionKeysStr.split(',').map((k) => k.trim())].filter(Boolean);
  
  // Create a unique set of keys
  const uniqueKeys = Array.from(new Set(keyStrings));
  keychain = makeKeychainSync(uniqueKeys);
}

export function isEncrypted(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return value.startsWith('v1.aesgcm256.') || value.startsWith('v1:v1.aesgcm256.');
}

export function encryptJson(value: unknown): any {
  if (value == null) return value;
  if (isEncrypted(value)) return value; // Prevent double encryption
  if (!currentKey) {
    initCrypto();
  }
  if (!currentKey) return value; // Fallback if no keys

  const stringified = typeof value === 'string' ? value : JSON.stringify(value);
  return encryptStringSync(stringified, currentKey);
}

function internalDecrypt(value: string): string {
  let ciphertext = value;
  if (ciphertext.startsWith('v1:')) {
    ciphertext = ciphertext.slice(3); // strip legacy prisma-field-encryption prefix
  }
  
  const key = findKeyForMessage(ciphertext, keychain);
  if (!key) {
    throw new Error(`[JSON-Decryption] No matching decryption key found for ciphertext fingerprint`);
  }
  return decryptStringSync(ciphertext, key);
}

export function decryptJson(value: unknown): any {
  if (value == null) return value;
  if (typeof value !== 'string') return value; // Legacy plaintext JSON object
  if (!isEncrypted(value)) return value; // Could be a legacy plaintext string

  if (!keychain) {
    initCrypto();
  }
  if (!keychain) {
    throw new Error('JSON_FIELD_DECRYPTION_KEYS are missing but ciphertext was found');
  }

  try {
    let decryptedStr = internalDecrypt(value);
    
    // Auto-recover if the backfill script accidentally double-encrypted an already encrypted string
    if (isEncrypted(decryptedStr)) {
      decryptedStr = internalDecrypt(decryptedStr);
    }
    
    try {
      return JSON.parse(decryptedStr);
    } catch {
      // It was a string, not a JSON object
      return decryptedStr;
    }
  } catch (err: any) {
    // Fail closed on damaged/tampered ciphertext
    throw new Error(`[JSON-Decryption] Failed to authenticate or decrypt ciphertext: ${err.message}`);
  }
}

/**
 * Transforms outgoing Prisma arguments (encrypts on write)
 */
export function encryptUserData(data: any): any {
  if (!data || typeof data !== 'object') return data;

  const transformed = { ...data };
  for (const field of SENSITIVE_JSON_FIELDS) {
    if (field in transformed) {
      transformed[field] = encryptJson(transformed[field]);
    }
  }
  return transformed;
}

/**
 * Transforms incoming Prisma results (decrypts on read)
 */
export function decryptUserResult(result: any): any {
  if (!result || typeof result !== 'object') return result;

  // Handle arrays (e.g. findMany, createManyAndReturn)
  if (Array.isArray(result)) {
    return result.map(item => decryptUserResult(item));
  }

  const transformed = { ...result };
  for (const field of SENSITIVE_JSON_FIELDS) {
    if (field in transformed) {
      transformed[field] = decryptJson(transformed[field]);
    }
  }
  return transformed;
}

/**
 * Recursively traverses Prisma result objects/arrays to decrypt any sensitive JSON fields
 * found on root objects or related models (e.g. order.user, ticket.user, portfolio.user).
 */
export function deepDecryptSensitiveFields(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  // Decimal.js instances have no _isDecimal flag. Spreading them removes their
  // numeric conversion methods, causing downstream inventory arithmetic to yield NaN.
  if (obj instanceof Date || Prisma.Decimal.isDecimal(obj) || (typeof Buffer !== 'undefined' && Buffer.isBuffer(obj))) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepDecryptSensitiveFields(item));
  }

  const transformed = { ...obj };
  for (const field of SENSITIVE_JSON_FIELDS) {
    if (field in transformed && typeof transformed[field] === 'string' && isEncrypted(transformed[field])) {
      transformed[field] = decryptJson(transformed[field]);
    }
  }
  for (const key of Object.keys(transformed)) {
    if (transformed[key] && typeof transformed[key] === 'object') {
      transformed[key] = deepDecryptSensitiveFields(transformed[key]);
    }
  }
  return transformed;
}

export const jsonEncryptionExtension = () => {
  return Prisma.defineExtension((client) => {
    initCrypto();
    
    return client.$extends({
      name: 'json-encryption-extension',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: any) {
            
            // 1. Intercept Writes (create, update, upsert, createMany, updateMany) on User model
            if ((model === 'User' || model === 'user') && args && ['create', 'update', 'upsert', 'createMany', 'createManyAndReturn', 'updateMany', 'updateManyAndReturn'].includes(operation)) {
              if (args.data) {
                if (Array.isArray(args.data)) {
                  args.data = args.data.map((item: any) => encryptUserData(item));
                } else {
                  args.data = encryptUserData(args.data);
                }
              }
              if (args.create) {
                args.create = encryptUserData(args.create);
              }
              if (args.update) {
                args.update = encryptUserData(args.update);
              }
            }

            // 2. Execute Query
            const result = await query(args);

            // 3. Intercept Reads (decrypt any sensitive fields in result, including nested/relation objects)
            return deepDecryptSensitiveFields(result);
          },
        },
      },
    });
  });
};
