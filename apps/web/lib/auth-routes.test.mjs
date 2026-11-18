import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { OBFUSCATED_COOKIE_NAMES: names } = require('cookie-crypto/constants');
function route(name, env, fetch) {
  const source = ts.transpileModule(readFileSync(new URL(`../app/api/auth/${name}/route.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require, process: { env }, fetch, console: { log() {} } });
  return exports;
}

test('profile GET/POST and signout normalize configured auth service URLs', async () => {
  for (const suffix of ['', '/', '/api', '/api/', '/api/auth', '/api/auth/']) {
    for (const [name, method] of [['profile', 'GET'], ['profile', 'POST'], ['signout', 'POST']]) {
      const calls = [];
      const handler = route(name, { AUTH_SERVICE_URL: `http://configured:3002${suffix}`, NEXT_PUBLIC_AUTH_SERVICE_URL: '/api' }, async (url, options) => {
        calls.push({ url, options });
        return Response.json({ id: 'customer', type: 'USER' });
      });
      const response = await handler[method](new Request(`http://web/api/auth/${name}`, {
        method, headers: { cookie: `${names.AUTH_TOKEN}=customer; ${names.ADMIN_PANEL_TOKEN}=admin`, 'x-dpop-proof': 'proof', 'x-dpop-timestamp': '123', 'x-dpop-jti': 'unique', 'x-device-fingerprint': 'device' },
        ...(method === 'POST' && name === 'profile' ? { body: '{"fullName":"Customer"}' } : {}),
      }));
      assert.equal(response.status, 200);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, `http://configured:3002/api/auth/${name}`);
      if (name === 'profile') {
        assert.equal(calls[0].options.headers.cookie, `${names.AUTH_TOKEN}=customer`);
        assert.equal(calls[0].options.headers['x-dpop-proof'], 'proof');
        assert.equal(calls[0].options.headers['x-device-fingerprint'], 'device');
        if (method === 'POST') assert.equal(calls[0].options.body, '{"fullName":"Customer"}');
      } else {
        assert.ok(response.headers.get('set-cookie').includes(`${names.AUTH_TOKEN}=`));
        assert.ok(!response.headers.get('set-cookie').includes(`${names.ADMIN_PANEL_TOKEN}=`));
      }
    }
  }
});

test('explicit auth service takes priority; gateway and deployment defaults remain available', async () => {
  for (const name of ['profile', 'signout']) {
    for (const [env, expected] of [
      [{ BACKEND_ORIGIN: 'http://gateway/api', AUTH_SERVICE_URL: 'http://configured' }, 'http://configured'],
      [{ BACKEND_ORIGIN: 'http://gateway/api' }, 'http://gateway'],
      [{ NODE_ENV: 'production' }, 'http://auth-service:3002'],
      [{ NODE_ENV: 'development' }, 'http://127.0.0.1:3002'],
      [{ NODE_ENV: 'production', VERCEL: '1' }, 'http://127.0.0.1:3002'],
    ]) {
      const calls = [];
      const handler = route(name, env, async (url) => { calls.push(url); return Response.json({}); });
      await handler[name === 'profile' ? 'GET' : 'POST'](new Request(`http://web/api/auth/${name}`));
      assert.equal(calls[0], `${expected}/api/auth/${name}`);
    }
  }
});

test('a failing gateway does not break profile reads, updates, or signout when the internal service is configured', async () => {
  for (const [name, method] of [['profile', 'GET'], ['profile', 'POST'], ['signout', 'POST']]) {
    const calls = [];
    const handler = route(name, {
      NODE_ENV: 'production',
      AUTH_SERVICE_URL: 'http://auth-service:3002',
      BACKEND_ORIGIN: 'https://unavailable-gateway',
    }, async (url) => {
      calls.push(url);
      if (url.startsWith('https://unavailable-gateway')) return Response.json({ message: 'Bad gateway' }, { status: 502 });
      return Response.json({ id: 'customer', type: 'USER' });
    });
    const response = await handler[method](new Request(`http://web/api/auth/${name}`, { method }));
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [`http://auth-service:3002/api/auth/${name}`]);
  }
});

test('profile outages do not clear cookies; expired sessions still clear them', async () => {
  for (const status of [401, 500]) {
    const handler = route('profile', {}, async () => Response.json({ message: 'failure' }, { status }));
    const response = await handler.GET(new Request('http://web/api/auth/profile'));
    assert.equal(response.status, status === 401 ? 200 : 500);
    assert.equal(Boolean(response.headers.get('set-cookie')), status === 401);
  }
  const handler = route('profile', {}, async () => { throw new Error('Unavailable'); });
  const response = await handler.GET(new Request('http://web/api/auth/profile'));
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('non-container production retains a localhost fallback', async () => {
  for (const name of ['profile', 'signout']) {
    const calls = [];
    const handler = route(name, { NODE_ENV: 'production' }, async (url) => {
      calls.push(url);
      if (url.includes('auth-service')) throw new Error('No container DNS');
      return Response.json({});
    });
    const response = await handler[name === 'profile' ? 'GET' : 'POST'](new Request(`http://web/api/auth/${name}`));
    assert.equal(response.status, 200);
    assert.equal(calls[1], `http://localhost:3002/api/auth/${name}`);
  }
});
