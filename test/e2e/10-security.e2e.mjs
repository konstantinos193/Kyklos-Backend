import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, expectStatus, adminToken, adminInfo, uniq, BASE } from './helpers.mjs';

describe('Security headers', () => {
  test('helmet security headers are present', async () => {
    const res = await api('/api/health/fast');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff', 'nosniff set');
    assert.ok(res.headers.get('x-dns-prefetch-control'), 'helmet is active');
  });

  test('X-Powered-By is not advertised', async () => {
    const res = await api('/api/health/fast');
    assert.equal(res.headers.get('x-powered-by'), null, 'X-Powered-By should be stripped');
  });

  test('X-Frame-Options is deliberately absent (PDF embedding)', async () => {
    const res = await api('/api/health/fast');
    assert.equal(res.headers.get('x-frame-options'), null, 'frameguard is intentionally disabled');
  });
});

describe('CORS', () => {
  test('a configured origin is allowed', async () => {
    const res = await api('/api/health/fast', { headers: { Origin: 'http://localhost:8765' } });
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:8765', 'configured origin echoed');
  });

  test('an unlisted origin is not granted access', async () => {
    const res = await api('/api/health/fast', { headers: { Origin: 'https://evil.example.com' } });
    const allow = res.headers.get('access-control-allow-origin');
    assert.notEqual(allow, 'https://evil.example.com', 'attacker origin must never be echoed');
    assert.notEqual(allow, '*', 'wildcard CORS with credentials would be unsafe');
  });

  test('credentials are enabled for allowed origins', async () => {
    const res = await api('/api/health/fast', { headers: { Origin: 'http://localhost:8765' } });
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
  });
});

describe('Input validation and injection', () => {
  test('a NoSQL operator object cannot bypass admin login', async () => {
    const res = await api('/api/admin/auth/login', {
      method: 'POST',
      body: { email: { $ne: null }, password: { $ne: null } },
    });
    assert.notEqual(res.status, 200, 'NoSQL operator injection must not authenticate');
    assert.ok([400, 401].includes(res.status), `expected 400/401, got ${res.status}`);
  });

  test('a NoSQL operator cannot bypass student login', async () => {
    const res = await api('/api/auth/student-login', { method: 'POST', body: { uniqueKey: { $ne: null } } });
    assert.notEqual(res.status, 200, 'student NoSQL injection must not authenticate');
  });

  test('malformed JSON is rejected cleanly', async () => {
    const res = await api('/api/admin/auth/login', {
      method: 'POST',
      body: '{"email": "a@b.c", "password":',
      headers: { 'Content-Type': 'application/json' },
    });
    assert.ok(res.status >= 400 && res.status < 500, `bad JSON returned ${res.status}, expected a 4xx`);
  });

  test('an oversized payload does not crash the server', async () => {
    const res = await api('/api/contact', {
      method: 'POST',
      body: { name: 'x'.repeat(100000), email: 'a@b.c', subject: 's', message: 'm' },
    });
    assert.ok(res.status < 500 || res.status === 413, `oversized payload returned ${res.status}`);
    const still = await api('/api/health/fast');
    expectStatus(still, 200, 'server still alive after large payload');
  });

  test('a path traversal attempt on static assets is refused', async () => {
    const res = await api('/public/../../etc/passwd', { raw: true });
    assert.ok(!String(res.text).includes('root:'), 'path traversal must not expose host files');
  });
});

describe('Error handling does not leak internals', () => {
  test('error bodies carry no stack traces', async () => {
    const res = await api('/api/blog/not-a-valid-object-id');
    const s = JSON.stringify(res.body);
    assert.ok(!s.includes('at Object.'), 'stack frames leaked to client');
    assert.ok(!s.includes('node_modules'), 'internal paths leaked to client');
  });

  test('a 401 body has the documented shape', async () => {
    const res = await api('/api/admin/stats');
    expectStatus(res, 401, 'stats anonymous');
    assert.equal(res.body.success, false);
    assert.equal(typeof res.body.message, 'string');
    assert.equal(res.body.statusCode, 401);
  });

  test('database credentials never appear in any response', async () => {
    const res = await api('/api/health');
    const s = JSON.stringify(res.body);
    assert.ok(!s.includes('mongodb://') && !s.includes('mongodb+srv://'), 'connection string leaked in health output');
    assert.ok(!s.includes('e2epass'), 'database password leaked in health output');
  });
});

describe('JWT integrity', () => {
  test('an alg=none token is refused', async () => {
    // {"alg":"none","typ":"JWT"}.{"id":"...","role":"super_admin"}.
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: '507f1f77bcf86cd799439011', email: 'attacker@evil.com', role: 'super_admin' })).toString('base64url');
    const res = await api('/api/admin/stats', { token: `${header}.${payload}.` });
    expectStatus(res, 401, 'alg=none must be refused');
  });

  test('a tampered payload invalidates the signature', async () => {
    const token = await adminToken();
    const [h, p, s] = token.split('.');
    const decoded = JSON.parse(Buffer.from(p, 'base64url').toString());
    decoded.role = 'super_admin';
    decoded.email = 'attacker@evil.com';
    const tampered = `${h}.${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${s}`;
    const res = await api('/api/admin/stats', { token: tampered });
    expectStatus(res, 401, 'tampered token must be refused');
  });
});

// Rate limiting lives in 12-ratelimit.e2e.mjs. It deliberately exhausts a
// per-IP budget, so it has to run on its own after everything else.
