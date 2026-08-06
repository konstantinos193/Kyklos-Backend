import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, expectStatus, expectOneOf, unwrap, adminToken, adminInfo, uniq } from './helpers.mjs';

describe('Admin authentication', () => {
  test('login with valid credentials returns a token', async () => {
    const { email, password } = await adminInfo();
    const res = await api('/api/admin/auth/login', { method: 'POST', body: { email, password } });
    expectStatus(res, 200, 'login');
    assert.equal(res.body.success, true);
    assert.ok(res.body.token, 'token returned');
    assert.equal(res.body.admin.email, email);
    assert.ok(!('password' in res.body.admin), 'password never leaks in the login response');
  });

  test('login sets an httpOnly adminToken cookie', async () => {
    const { email, password } = await adminInfo();
    const res = await api('/api/admin/auth/login', { method: 'POST', body: { email, password } });
    const cookie = res.headers.get('set-cookie') || '';
    assert.match(cookie, /adminToken=/, 'adminToken cookie set');
    assert.match(cookie, /HttpOnly/i, 'cookie is HttpOnly');
  });

  test('login is case-insensitive on email', async () => {
    const { email, password } = await adminInfo();
    const res = await api('/api/admin/auth/login', { method: 'POST', body: { email: email.toUpperCase(), password } });
    expectStatus(res, 200, 'uppercase email login');
  });

  test('login rejects a wrong password', async () => {
    const { email } = await adminInfo();
    const res = await api('/api/admin/auth/login', { method: 'POST', body: { email, password: 'WrongPassword1!' } });
    expectStatus(res, 401, 'wrong password');
  });

  test('login rejects an unknown email', async () => {
    const res = await api('/api/admin/auth/login', { method: 'POST', body: { email: `${uniq('nobody')}@kyklos.test`, password: 'Whatever1!' } });
    expectStatus(res, 401, 'unknown email');
  });

  test('login does not distinguish unknown user from wrong password', async () => {
    const { email } = await adminInfo();
    const a = await api('/api/admin/auth/login', { method: 'POST', body: { email, password: 'WrongPassword1!' } });
    const b = await api('/api/admin/auth/login', { method: 'POST', body: { email: `${uniq('nobody')}@kyklos.test`, password: 'WrongPassword1!' } });
    assert.equal(a.status, b.status, 'same status for both failure modes');
    assert.equal(a.body.message, b.body.message, 'same message - no account enumeration');
  });

  test('login validates the payload shape', async () => {
    const bad = await api('/api/admin/auth/login', { method: 'POST', body: { email: 'not-an-email', password: 'x' } });
    expectStatus(bad, 400, 'malformed login');
    const missing = await api('/api/admin/auth/login', { method: 'POST', body: {} });
    expectStatus(missing, 400, 'empty login');
  });

  test('login rejects unknown extra fields', async () => {
    const { email, password } = await adminInfo();
    const res = await api('/api/admin/auth/login', { method: 'POST', body: { email, password, role: 'super_admin' } });
    expectStatus(res, 400, 'extra field is rejected by forbidNonWhitelisted');
  });

  test('verify returns the caller identity for a valid token', async () => {
    const token = await adminToken();
    const res = await api('/api/admin/auth/verify', { token });
    expectStatus(res, 200, 'verify');
    const d = unwrap(res.body);
    assert.ok(d.admin.email, 'admin identity returned');
  });

  test('verify rejects a missing token', async () => {
    expectStatus(await api('/api/admin/auth/verify'), 401, 'verify without token');
  });

  test('verify rejects a malformed token', async () => {
    expectStatus(await api('/api/admin/auth/verify', { token: 'garbage.token.here' }), 401, 'verify garbage');
  });

  test('verify rejects a token signed with the wrong secret', async () => {
    // Correct shape and algorithm, wrong signing key.
    const forged = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCIsImVtYWlsIjoiYXR0YWNrZXJAZXZpbC5jb20iLCJyb2xlIjoic3VwZXJfYWRtaW4ifQ.Xh1sQ0Zx8kq3wq0v0mS0xX2xY9c8dQ5vJ1nL7bA6tKk';
    expectStatus(await api('/api/admin/auth/verify', { token: forged }), 401, 'forged token');
  });

  test('refresh issues a new usable token', async () => {
    const token = await adminToken();
    const res = await api('/api/admin/auth/refresh', { method: 'POST', token });
    expectStatus(res, 200, 'refresh');
    assert.ok(res.body.token, 'new token issued');
    const check = await api('/api/admin/auth/verify', { token: res.body.token });
    expectStatus(check, 200, 'refreshed token works');
  });

  test('refresh without a token is rejected', async () => {
    expectOneOf(await api('/api/admin/auth/refresh', { method: 'POST' }), [401, 403], 'refresh without token');
  });

  test('logout clears the cookie', async () => {
    const res = await api('/api/admin/auth/logout', { method: 'POST' });
    expectStatus(res, 200, 'logout');
    const cookie = res.headers.get('set-cookie') || '';
    assert.match(cookie, /adminToken=;|adminToken=(?=;)/, `cookie cleared, got: ${cookie}`);
  });
});

describe('Admin bootstrap guard', () => {
  test('once an admin exists, unauthenticated creation is refused', async () => {
    await adminToken(); // guarantees at least one admin exists
    const res = await api('/api/admin/auth/create', {
      method: 'POST',
      body: { email: `${uniq('attacker')}@evil.test`, password: 'Passw0rd!', name: 'Attacker', role: 'super_admin' },
    });
    expectOneOf(res, [401, 403], 'anonymous admin creation must be blocked');
  });

  test('a student token cannot create an admin', async () => {
    const { studentSession } = await import('./helpers.mjs');
    let stu;
    try { stu = await studentSession(); } catch { return; }
    const res = await api('/api/admin/auth/create', {
      method: 'POST',
      token: stu.token,
      body: { email: `${uniq('esc')}@evil.test`, password: 'Passw0rd!', name: 'Escalation', role: 'super_admin' },
    });
    expectOneOf(res, [401, 403], 'student token must not mint admins');
  });
});
