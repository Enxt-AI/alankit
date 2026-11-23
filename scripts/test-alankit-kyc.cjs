// Real HTTP provider calls; in-memory Prisma substitute. No real identity data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const ts = require('../apps/alankit/node_modules/typescript');
const root = path.resolve(__dirname, '..');
const errors = { Injectable: () => value => value };
for (const name of ['BadRequestException', 'ConflictException', 'ForbiddenException', 'NotFoundException']) errors[name] = class extends Error {};
function load(file, dependencies = {}, globals = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
  }).outputText;
  const context = { exports: {}, fetch, AbortSignal, require: name => {
    if (name === '@nestjs/common') return errors;
    if (name === '@nestjs/config') return {};
    if (name === 'db-unlistedstock') return { Prisma: { DbNull: null } };
    if (name.includes('prisma.service')) return {};
    return dependencies[name] || require(name);
  }, ...globals };
  vm.runInNewContext(compiled, context, { filename: file });
  return context.exports;
}
const { AlankitKycClient } = load('apps/stocks-service/src/kyc/alankit-kyc.client.ts');
const { AlankitKycService } = load('apps/stocks-service/src/kyc/alankit-kyc.service.ts', { './alankit-kyc.client': { AlankitKycClient } });
const { publicKycData } = load('apps/auth-service/src/auth/public-kyc-data.ts');
const config = {
  ALANKIT_KYC_API_KEY: 'test-only', ALANKIT_KYC_FETCH_CODE: 'TEST',
  ALANKIT_KYC_FETCH_URL: process.env.KYC_TEST_URL || 'http://127.0.0.1:4510/api/Kyc/FetchLogin',
  ALANKIT_KYC_NOT_FOUND_CODE: 'TEST_KYC_NOT_FOUND',
};
function setup(client = new AlankitKycClient({ get: key => config[key] })) {
  let user = { id: 'user1', isActive: true, isDeleted: false, kycStatus: 'PENDING', kycData: null, phone: '9000000001', email: 'customer@example.test' };
  let duplicate = false;
  const db = { user: {
    findUnique: async () => structuredClone(user),
    findFirst: async () => duplicate ? { id: 'other' } : null,
    updateMany: async ({ where, data }) => {
      if (JSON.stringify(where.kycData.equals) !== JSON.stringify(user.kycData)) return { count: 0 };
      user = structuredClone({ ...user, ...data }); return { count: 1 };
    },
  }, $queryRaw: async () => [], $transaction: async fn => fn(db) };
  return { service: new AlankitKycService(db, client), user: () => user,
    duplicate: () => { duplicate = true; }, age: () => { user.kycData.alankitLookup.checkedAt = '2020-01-01'; },
    reset: () => { user.kycData = {}; }, deactivate: () => { user.isActive = false; } };
}
let count = 0;
async function check(name, fn) { await fn(); console.log('PASS', name); count++; }
async function main() {
  for (const [label, profile, cookie, destination] of [
    ['logged-out checkout goes to login', null, '', '/login'],
    ['pending KYC checkout goes to KYC', { id: 'u', type: 'USER', kycStatus: 'PENDING' }, 'session=test', '/kyc'],
    ['verified KYC checkout continues', { id: 'u', type: 'USER', kycStatus: 'VERIFIED' }, 'session=test', 'next'],
    ['admin cannot enter customer checkout', { id: 'a', type: 'ADMIN', kycStatus: 'VERIFIED' }, 'session=test', '/login'],
  ]) {
    await check(label, async () => {
      const { proxy, config: routing } = load('apps/alankit/proxy.ts', {
        'next/server': { NextResponse: {
          redirect: url => ({ destination: url.pathname, headers: new Headers() }),
          next: () => ({ destination: 'next', headers: new Headers() }),
        } },
      }, { URL, process: { env: { BACKEND_ORIGIN: 'https://backend.example.test' } },
        fetch: async () => ({ ok: true, json: async () => profile }) });
      const url = new URL('https://app.example.test/checkout?stockId=test');
      const result = await proxy({ url: url.href, nextUrl: url, headers: new Headers(cookie ? { cookie } : {}) });
      assert.equal(result.destination, destination);
      assert.ok(routing.matcher.includes('/checkout/:path*'));
      assert.ok(routing.matcher.includes('/kyc/:path*'));
    });
  }
  await check('active matching PAN and contact verifies and saves JSON/account data', async () => {
    const x = setup(); const result = await x.service.lookup('user1', 'ABCDE1234F');
    assert.equal(result.state, 'VERIFIED'); assert.equal(x.user().kycStatus, 'VERIFIED');
    assert.equal(x.user().kycData.alankitLookup.response.data.pan, 'ABCDE1234F');
    assert.equal(x.user().bankData.accNo, '000000000001'); assert.equal(result.response, undefined);
    assert.equal(publicKycData(x.user().kycData).alankitLookup.response, undefined);
    assert.equal(x.user().kycData.alankitLookup.response.success, true);
  });
  for (const [pan, state] of [['EMPTY0000A', 'NOT_FOUND'], ['WAITI0000A', 'PENDING'], ['OTHER0000A', 'REVIEW_REQUIRED'], ['ERROR0000A', 'ERROR'], ['WRONG0000A', 'ERROR'], ['BADJS0000A', 'ERROR']]) {
    await check(`${pan} remains unverified as ${state}`, async () => {
      const x = setup(); const result = await x.service.lookup('user1', pan);
      assert.equal(result.state, state); assert.equal(x.user().kycStatus, 'PENDING');
      assert.equal(Boolean(result.openAccountUrl), ['NOT_FOUND', 'PENDING'].includes(state));
      assert.ok(x.user().kycData.alankitLookup.response);
    });
  }
  await check('unconfigured missing code never classifies unknown failure as absent', async () => {
    const client = new AlankitKycClient({ get: key => key === 'ALANKIT_KYC_NOT_FOUND_CODE' ? '' : config[key] });
    assert.equal((await client.fetchByPan('EMPTY0000A')).state, 'ERROR');
  });
  await check('invalid PAN never reaches provider', async () => {
    const x = setup({ fetchByPan: () => { throw Error('must not call'); } });
    await assert.rejects(x.service.lookup('user1', 'invalid'), /valid PAN/);
    assert.equal(x.user().kycData, null);
  });
  await check('duplicate verified PAN requires review', async () => {
    const x = setup(); x.duplicate();
    assert.equal((await x.service.lookup('user1', 'ABCDE1234F')).state, 'REVIEW_REQUIRED');
    assert.equal(x.user().kycStatus, 'PENDING'); assert.equal(x.user().bankData, undefined);
  });
  await check('saved pending PAN can be refreshed and later verified', async () => {
    let calls = 0;
    const x = setup({ fetchByPan: async pan => ++calls === 1
      ? { state: 'NOT_FOUND', response: { success: false, code: 'TEST_KYC_NOT_FOUND' } }
      : new AlankitKycClient({ get: key => config[key] }).fetchByPan(pan) });
    await x.service.lookup('user1', 'ABCDE1234F');
    await assert.rejects(x.service.refresh('user1'), /30 seconds/);
    x.age(); assert.equal((await x.service.refresh('user1')).state, 'VERIFIED');
  });
  await check('stale provider response cannot overwrite a reset', async () => {
    let finish;
    const x = setup({ fetchByPan: () => new Promise(resolve => { finish = resolve; }) });
    const pending = x.service.lookup('user1', 'ABCDE1234F');
    while (!finish) await new Promise(resolve => setImmediate(resolve));
    x.reset(); finish({ state: 'NOT_FOUND', response: { success: false } });
    await assert.rejects(pending, /changed while fetching/);
    assert.equal(x.user().kycStatus, 'PENDING');
  });
  await check('inactive users cannot initiate a lookup', async () => {
    const x = setup(); x.deactivate(); await assert.rejects(x.service.lookup('user1', 'ABCDE1234F'), /not active/);
  });
  await check('missing provider configuration saves retryable error', async () => {
    const x = setup(new AlankitKycClient({ get: () => undefined }));
    assert.equal((await x.service.lookup('user1', 'ABCDE1234F')).state, 'ERROR');
  });
  console.log(`${count} checks passed (real HTTP, synthetic provider, in-memory database).`);
}
// Direct Node fallback also works when Postman's Windows dataset daemon fails.
const child = process.env.KYC_TEST_URL ? null : spawn(process.execPath, ['postman/mocks/alankit-kyc/default.js'], { cwd: root, windowsHide: true, stdio: 'ignore' });
(async () => {
  try {
    for (let attempt = 0; attempt < 30; attempt++) {
      try { await fetch(config.ALANKIT_KYC_FETCH_URL); break; }
      catch (err) { if (attempt === 29) throw err; await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    await main();
  } finally { child?.kill(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
