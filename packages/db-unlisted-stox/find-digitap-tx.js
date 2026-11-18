#!/usr/bin/env node

/**
 * Script to find Digitap Transaction ID and KYC details by phone number
 *
 * Usage:
 *   node packages/db-unlisted-stox/find-digitap-tx.js
 *   node packages/db-unlisted-stox/find-digitap-tx.js 9958127810 9319579291
 *   node packages/db-unlisted-stox/find-digitap-tx.js "+91 93195 79291"
 */

const path = require('path');
const fs = require('fs');

// ── 1. Load Environment Variables ──────────────────────────────────────────
function loadEnv(envPath) {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        if (!process.env[key]) process.env[key] = value.trim();
      }
    });
  }
}

// Look for .env and .env.staging across paths
const envCandidates = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '.env.staging'),
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../../.env.staging'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '.env.staging'),
];
envCandidates.forEach(loadEnv);

// ── 2. Resolve Active Database URL ─────────────────────────────────────────
// Prefer DIRECT_DATABASE_URL if present, otherwise DATABASE_URL
let activeDbUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

// If running directly on the host (outside container), resolve 'pgbouncer' to '127.0.0.1'
if (!fs.existsSync('/.dockerenv')) {
  if (activeDbUrl && activeDbUrl.includes('@pgbouncer')) {
    activeDbUrl = activeDbUrl.replace('@pgbouncer:', '@127.0.0.1:');
  }
}

let PrismaClient;
let PrismaModule;
try {
  const generatedPrisma = require('./generated/prisma');
  PrismaClient = generatedPrisma.PrismaClient;
  PrismaModule = generatedPrisma.Prisma;
} catch (e1) {
  try {
    const defaultPrisma = require('@prisma/client');
    PrismaClient = defaultPrisma.PrismaClient;
    PrismaModule = defaultPrisma.Prisma;
  } catch (e2) {
    try {
      const fallbackPrisma = require('../db-unlisted-stox/generated/prisma');
      PrismaClient = fallbackPrisma.PrismaClient;
      PrismaModule = fallbackPrisma.Prisma;
    } catch (e3) {
      console.error('❌ Could not load PrismaClient. Please run pnpm build or pnpm generate.');
      process.exit(1);
    }
  }
}

function createPrisma(url) {
  return new PrismaClient({
    datasources: {
      db: { url },
    },
  });
}

let prisma = createPrisma(activeDbUrl);

// ── 3. Decrypt Field Helper ────────────────────────────────────────────────
function tryDecryptField(val) {
  if (!val || typeof val !== 'string') return val;
  if (!val.startsWith('v1.') && !val.startsWith('v1:')) return val;

  const allKeyVars = [
    process.env.JSON_FIELD_ENCRYPTION_KEY,
    process.env.PRISMA_FIELD_ENCRYPTION_KEY,
    process.env.JSON_FIELD_DECRYPTION_KEYS,
    process.env.PRISMA_FIELD_DECRYPTION_KEYS,
  ];

  const keyList = allKeyVars
    .filter(Boolean)
    .flatMap((s) => s.split(','))
    .map((k) => k.trim())
    .filter(Boolean);

  if (keyList.length === 0) return val;

  try {
    const { makeKeychainSync, findKeyForMessage, decryptStringSync } = require('@47ng/cloak');
    const keychain = makeKeychainSync(keyList);

    let ciphertext = val;
    if (ciphertext.startsWith('v1:')) {
      ciphertext = ciphertext.slice(3);
    }
    const key = findKeyForMessage(ciphertext, keychain);
    if (!key) return val;

    let decrypted = decryptStringSync(ciphertext, key);
    if (typeof decrypted === 'string' && (decrypted.startsWith('v1.') || decrypted.startsWith('v1:'))) {
      const innerCipher = decrypted.startsWith('v1:') ? decrypted.slice(3) : decrypted;
      const innerKey = findKeyForMessage(innerCipher, keychain);
      if (innerKey) {
        decrypted = decryptStringSync(innerCipher, innerKey);
      }
    }
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (err) {
    return val;
  }
}

// ── 4. Parse Target Phone Numbers ───────────────────────────────────────────
// Default phone numbers requested: 9958127810 and 9319579291 (+91 93195 79291)
const defaultPhones = ['9958127810', '9319579291'];
const inputArgs = process.argv.slice(2);
const searchInputs = inputArgs.length > 0 ? inputArgs : defaultPhones;

function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  return digits;
}

async function executeWithFallback(queryFn) {
  try {
    return await queryFn(prisma);
  } catch (err) {
    if (
      err.message &&
      (err.message.includes('no such database') ||
        err.message.includes('database does not exist') ||
        err.message.includes('FATAL: no such database'))
    ) {
      const candidates = ['unlisted', 'postgres', 'ticketing_system'];
      for (const name of candidates) {
        try {
          const altUrl = activeDbUrl.replace(/\/[^/?]+(\?|$)/, `/${name}$1`);
          const testPrisma = createPrisma(altUrl);
          const res = await queryFn(testPrisma);
          prisma = testPrisma; // switch to working instance
          return res;
        } catch {}
      }
    }
    throw err;
  }
}

async function findDigitapTransactions() {
  console.log('\n======================================================================');
  console.log('🔍 DIGITAP TRANSACTION ID & KYC LOOKUP');
  console.log('======================================================================');
  console.log(`Database URL: ${activeDbUrl ? activeDbUrl.replace(/:[^:@]+@/, ':****@') : 'NOT SET'}`);
  console.log(`Search targets: ${searchInputs.join(', ')}\n`);

  try {
    for (const rawInput of searchInputs) {
      const clean10Digits = normalizePhone(rawInput);
      console.log(`🔎 Searching for: "${rawInput}" (Normalized: ${clean10Digits})...`);

      // 1. First try query matching various standard phone formats
      let users = await executeWithFallback((p) =>
        p.user.findMany({
          where: {
            OR: [
              { phone: clean10Digits },
              { phone: `+91${clean10Digits}` },
              { phone: `+91 ${clean10Digits}` },
            ],
          },
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            kycStatus: true,
            bankStatus: true,
            dematStatus: true,
            kycData: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      );

      // 2. Scan users and match by decrypted phone number
      if (!users || users.length === 0) {
        const allUsersWithKyc = await executeWithFallback((p) =>
          p.user.findMany({
            where: {
              kycData: { not: null },
            },
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
              kycStatus: true,
              bankStatus: true,
              dematStatus: true,
              kycData: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        );

        users = allUsersWithKyc.filter((u) => {
          const plainPhone = tryDecryptField(u.phone) || '';
          const userPhoneDigits = normalizePhone(plainPhone);
          return userPhoneDigits.includes(clean10Digits);
        });
      }

      if (!users || users.length === 0) {
        console.log(`⚠️  No user found for phone: ${rawInput}\n`);
        continue;
      }

      users.forEach((user, index) => {
        const plainPhone = tryDecryptField(user.phone) || user.phone;
        const plainEmail = tryDecryptField(user.email) || user.email;
        const kyc = tryDecryptField(user.kycData) || {};
        const isDecrypted = typeof kyc === 'object' && kyc !== null;
        const transactionId = (isDecrypted && kyc.digitapTransactionId) || 'NONE (Not Initiated)';
        const pan = (isDecrypted && (kyc.panDetails?.pan || kyc.pan)) || 'N/A';
        const aadhaarMasked = (isDecrypted && (kyc.aadhaarDetails?.aadhaar || kyc.maskedAdharNumber)) || 'N/A';

        console.log(`----------------------------------------------------------------------`);
        console.log(`👤 User #${index + 1}: ${user.fullName || 'Unnamed'} (${plainPhone})`);
        console.log(`   User ID:               ${user.id}`);
        console.log(`   Email:                 ${plainEmail || 'N/A'}`);
        console.log(`   KYC Status:            ${user.kycStatus}`);
        console.log(`   ⚡ DIGITAP TX ID:      ${transactionId}`);
        console.log(`   PAN:                   ${pan}`);
        console.log(`   Aadhaar (Masked):      ${aadhaarMasked}`);
        console.log(`   Last Step Updated:     ${(isDecrypted && kyc.lastUpdatedStep) || user.updatedAt}`);
        console.log(`----------------------------------------------------------------------`);
        console.log('   Full kycData:');
        console.log(JSON.stringify(kyc, null, 2));
        console.log(`----------------------------------------------------------------------\n`);
      });
    }

    // Also display the 5 most recent Digitap transactions in the database for quick reference
    console.log('\n======================================================================');
    console.log('🕒 5 MOST RECENT DIGITAP TRANSACTIONS IN DATABASE');
    console.log('======================================================================');
    const recentKycUsers = await executeWithFallback((p) =>
      p.user.findMany({
        where: {
          kycData: {
            not: null,
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 20,
        select: {
          id: true,
          fullName: true,
          phone: true,
          kycStatus: true,
          kycData: true,
          updatedAt: true,
        },
      })
    );

    const digitapList = recentKycUsers
      .map((u) => {
        const decryptedKyc = tryDecryptField(u.kycData) || {};
        return {
          ...u,
          kycData: decryptedKyc,
        };
      })
      .filter((u) => typeof u.kycData === 'object' && u.kycData.digitapTransactionId)
      .slice(0, 5);

    if (digitapList.length === 0) {
      console.log('No recent Digitap transactions found in database.');
    } else {
      console.table(
        digitapList.map((u) => ({
          'User Name': u.fullName || 'N/A',
          Phone: tryDecryptField(u.phone),
          'KYC Status': u.kycStatus,
          'Digitap Tx ID': u.kycData.digitapTransactionId,
          Updated: u.updatedAt.toISOString(),
        }))
      );
    }
  } catch (error) {
    console.error('❌ Database error during lookup:', error.message);
  } finally {
    if (prisma?.$disconnect) {
      await prisma.$disconnect();
    }
    console.log('\nDone.');
  }
}

findDigitapTransactions();
