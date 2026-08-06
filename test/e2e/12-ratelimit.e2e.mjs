// Run separately, after the functional suite. These tests exhaust a per-IP
// budget on purpose, which would otherwise lock the rest of the suite out.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, expectStatus, adminInfo } from './helpers.mjs';

// Must exceed AUTH_RATE_LIMIT_MAX in .env.e2e, with room for whatever the
// functional suite already consumed.
const MAX_ATTEMPTS = 200;

describe('Rate limiting', () => {
  test('health probes are never throttled, so Docker cannot be starved out', async () => {
    for (let i = 0; i < 40; i++) {
      const r = await api('/api/health/fast');
      assert.notEqual(r.status, 429, 'health checks must never be rate limited');
    }
  });

  test('a sustained burst of failed logins is eventually throttled', async () => {
    const { email } = await adminInfo();
    let limitedAt = -1;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const r = await api('/api/admin/auth/login', { method: 'POST', body: { email, password: 'Wrong!' } });
      if (r.status === 429) { limitedAt = i + 1; break; }
    }
    assert.ok(limitedAt > 0,
      `${MAX_ATTEMPTS} consecutive failed logins produced no 429 - brute force is unthrottled`);
    console.log(`      throttled after ${limitedAt} failed attempts`);
  });

  test('the throttle response is a well-formed 429 with RateLimit headers', async () => {
    const { email } = await adminInfo();
    const res = await api('/api/admin/auth/login', { method: 'POST', body: { email, password: 'Wrong!' } });
    expectStatus(res, 429, 'still inside the penalty window');
    assert.equal(res.body?.success, false, '429 follows the standard error envelope');
    assert.equal(res.body?.statusCode, 429);
    assert.ok(res.headers.get('ratelimit') || res.headers.get('ratelimit-policy'),
      'RateLimit headers are advertised to clients');
  });

  test('a locked-out client cannot get in with correct credentials either', async () => {
    // Worth stating explicitly: once the budget is spent the address is locked
    // for the rest of the window, valid password or not. That is the intended
    // trade-off, and it is why the limit is per address rather than per account
    // (per-account would let anyone lock out a known admin at will).
    const { email, password } = await adminInfo();
    const res = await api('/api/admin/auth/login', { method: 'POST', body: { email, password } });
    expectStatus(res, 429, 'the lockout applies to the address, not just to wrong passwords');
  });

  test('student login is throttled independently of admin login', async () => {
    let limitedAt = -1;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const r = await api('/api/auth/student-login', { method: 'POST', body: { uniqueKey: `NOPE${i}` } });
      if (r.status === 429) { limitedAt = i + 1; break; }
    }
    assert.ok(limitedAt > 0, 'student login is not throttled');
    // A separate limiter instance, so it must not have been exhausted already
    // by the admin burst above.
    assert.ok(limitedAt > 1, 'student login shares a counter with admin login - budgets are bleeding across routes');
  });

  test('reads are unaffected, so server-rendered pages keep working', async () => {
    // The frontend renders server-side: every SSR fetch arrives from a single
    // container address. A global cap would take the whole site down at once.
    for (let i = 0; i < 60; i++) {
      const r = await api('/api/blog');
      assert.notEqual(r.status, 429,
        'public reads are rate limited per IP - this would throttle all SSR traffic together');
    }
  });

  test('the API is still healthy after all of it', async () => {
    expectStatus(await api('/api/health/fast'), 200, 'server survives the bursts');
  });
});
