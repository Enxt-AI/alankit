/**
 * Security Headers Validation Tool
 *
 * Checks HTTP response headers against SMC Unlisted Stox security compliance standards:
 * 1. Checks for required security headers.
 * 2. Confirms ZERO duplicate headers.
 * 3. Confirms ZERO banner/fingerprint headers (X-Powered-By, Server).
 *
 * Usage:
 *   node scripts/validate-security-headers.mjs [URL]
 *
 * Example:
 *   node scripts/validate-security-headers.mjs https://unlistedstox.com
 */

import http from 'http';
import https from 'https';

const REQUIRED_SECURITY_HEADERS = [
  'x-content-type-options',
  'x-frame-options',
  'x-xss-protection',
  'strict-transport-security',
  'referrer-policy',
  'permissions-policy',
];

const FORBIDDEN_BANNER_HEADERS = [
  'x-powered-by',
  'server',
  'x-aspnet-version',
  'x-aspnetmvc-version',
  'x-nextjs-version',
  'x-runtime',
  'x-version',
  'x-page-speed',
];

export function validateHeaders(rawHeadersArray) {
  const headerCounts = {};
  const headerValues = {};
  const issues = [];

  // Parse raw headers (preserving duplicates)
  for (let i = 0; i < rawHeadersArray.length; i += 2) {
    const key = rawHeadersArray[i].toLowerCase();
    const val = rawHeadersArray[i + 1];

    headerCounts[key] = (headerCounts[key] || 0) + 1;
    if (!headerValues[key]) headerValues[key] = [];
    headerValues[key].push(val);
  }

  // 1. Check for duplicate headers
  for (const [key, count] of Object.entries(headerCounts)) {
    if (count > 1 && key !== 'set-cookie') {
      issues.push({
        type: 'DUPLICATE_HEADER',
        severity: 'LOW',
        header: key,
        message: `Header "${key}" is present ${count} times in the response: [${headerValues[key].join(', ')}]`,
      });
    }
  }

  // 2. Check for forbidden banner headers
  for (const forbidden of FORBIDDEN_BANNER_HEADERS) {
    if (headerCounts[forbidden]) {
      issues.push({
        type: 'BANNER_DISCLOSURE',
        severity: 'LOW',
        header: forbidden,
        message: `Forbidden banner header "${forbidden}" detected with value "${headerValues[forbidden][0]}"`,
      });
    }
  }

  // 3. Check for missing required security headers
  for (const req of REQUIRED_SECURITY_HEADERS) {
    if (!headerCounts[req]) {
      issues.push({
        type: 'MISSING_SECURITY_HEADER',
        severity: 'MEDIUM',
        header: req,
        message: `Missing required security header: "${req}"`,
      });
    }
  }

  return {
    success: issues.length === 0,
    headerCounts,
    headerValues,
    issues,
  };
}

async function testUrl(targetUrl) {
  const url = new URL(targetUrl);
  const client = url.protocol === 'https:' ? https : http;

  console.log(`\n🔍 Testing Security Headers for: ${targetUrl}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  return new Promise((resolve) => {
    const req = client.get(targetUrl, (res) => {
      const result = validateHeaders(res.rawHeaders);

      console.log(`\n📋 Response Status: ${res.statusCode} ${res.statusMessage}`);
      console.log(`📋 Received Headers:`);
      for (const [key, vals] of Object.entries(result.headerValues)) {
        console.log(`   • ${key}: ${vals.join(', ')}`);
      }

      console.log(`\n📊 Validation Results:`);
      if (result.success) {
        console.log(`   ✅ ALL SECURITY HEADERS COMPLIANT`);
        console.log(`   ✅ ZERO DUPLICATE HEADERS`);
        console.log(`   ✅ ZERO BANNER DISCLOSURES`);
      } else {
        for (const issue of result.issues) {
          console.log(`   ❌ [${issue.type}] ${issue.message}`);
        }
      }

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      resolve(result);
    });

    req.on('error', (err) => {
      console.error(`❌ Connection failed: ${err.message}`);
      resolve({ success: false, issues: [{ type: 'CONNECTION_ERROR', message: err.message }] });
    });
  });
}

// Self-test with simulated headers if no argument is passed
if (process.argv[2]) {
  testUrl(process.argv[2]);
} else {
  console.log(`\n🧪 Running Built-in Security Header Validation Suite...\n`);

  // Test Case 1: Valid compliant headers
  const validHeaders = [
    'X-Content-Type-Options', 'nosniff',
    'X-Frame-Options', 'SAMEORIGIN',
    'X-XSS-Protection', '1; mode=block',
    'Strict-Transport-Security', 'max-age=31536000; includeSubDomains',
    'Referrer-Policy', 'strict-origin-when-cross-origin',
    'Permissions-Policy', 'camera=(), microphone=(), geolocation=()',
    'Content-Type', 'text/html; charset=utf-8',
  ];

  const validResult = validateHeaders(validHeaders);
  console.log(`Test Case 1 (Compliant Headers): ${validResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);

  // Test Case 2: Duplicate Headers Detection
  const duplicateHeaders = [
    'X-Frame-Options', 'SAMEORIGIN',
    'X-Frame-Options', 'SAMEORIGIN',
    'X-Content-Type-Options', 'nosniff',
    'X-XSS-Protection', '1; mode=block',
    'Strict-Transport-Security', 'max-age=31536000; includeSubDomains',
    'Referrer-Policy', 'strict-origin-when-cross-origin',
    'Permissions-Policy', 'camera=(), microphone=(), geolocation=()',
  ];

  const duplicateResult = validateHeaders(duplicateHeaders);
  const detectedDuplicate = duplicateResult.issues.some((i) => i.type === 'DUPLICATE_HEADER');
  console.log(`Test Case 2 (Duplicate Header Detection): ${detectedDuplicate ? 'PASSED ✅' : 'FAILED ❌'}`);

  // Test Case 3: Banner Header Detection
  const bannerHeaders = [
    'X-Powered-By', 'Next.js',
    'Server', 'nginx/1.24.0',
    'X-Content-Type-Options', 'nosniff',
    'X-Frame-Options', 'SAMEORIGIN',
    'X-XSS-Protection', '1; mode=block',
    'Strict-Transport-Security', 'max-age=31536000; includeSubDomains',
    'Referrer-Policy', 'strict-origin-when-cross-origin',
    'Permissions-Policy', 'camera=(), microphone=(), geolocation=()',
  ];

  const bannerResult = validateHeaders(bannerHeaders);
  const detectedBanner = bannerResult.issues.filter((i) => i.type === 'BANNER_DISCLOSURE').length === 2;
  console.log(`Test Case 3 (Banner Disclosure Detection): ${detectedBanner ? 'PASSED ✅' : 'FAILED ❌'}\n`);
}
