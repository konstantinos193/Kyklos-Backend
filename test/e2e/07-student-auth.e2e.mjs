import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, expectStatus, expectOneOf, studentSession, uniq } from './helpers.mjs';

describe('Student authentication', () => {
  let session;

  test('a student created via the admin API can log in with their uniqueKey', async () => {
    session = await studentSession();
    assert.ok(session.token, 'student token issued');
  });

  test('login also accepts the key in the studentId field', async () => {
    const res = await api('/api/auth/student-login', { method: 'POST', body: { studentId: session.uniqueKey } });
    expectStatus(res, 200, 'login via studentId field');
  });

  test('login is case-insensitive on the key', async () => {
    const res = await api('/api/auth/student-login', { method: 'POST', body: { uniqueKey: session.uniqueKey.toLowerCase() } });
    expectStatus(res, 200, 'lowercase key login');
  });

  test('login rejects an unknown key', async () => {
    const res = await api('/api/auth/student-login', { method: 'POST', body: { uniqueKey: uniq('NOPE').toUpperCase() } });
    expectStatus(res, 401, 'unknown student key');
  });

  test('login with an empty body is a 400', async () => {
    expectStatus(await api('/api/auth/student-login', { method: 'POST', body: {} }), 400, 'empty student login');
  });

  test('student-verify accepts the issued token', async () => {
    const res = await api('/api/auth/student-verify', { method: 'POST', token: session.token });
    expectStatus(res, 200, 'student verify');
  });

  test('student-verify rejects a missing token', async () => {
    expectOneOf(await api('/api/auth/student-verify', { method: 'POST' }), [401, 500], 'verify without token');
  });

  test('student-verify rejects an admin token', async () => {
    const { adminToken } = await import('./helpers.mjs');
    const t = await adminToken();
    const res = await api('/api/auth/student-verify', { method: 'POST', token: t });
    expectStatus(res, 401, 'admin token must not pass student verification');
  });

  test('student-refresh issues a working token', async () => {
    const res = await api('/api/auth/student-refresh', { method: 'POST', token: session.token });
    expectStatus(res, 200, 'student refresh');
    assert.ok(res.body.token, 'new student token');
  });

  test('student-logout responds', async () => {
    expectStatus(await api('/api/auth/student-logout', { method: 'POST' }), 200, 'student logout');
  });

  // This is the regression that matters: StudentJwtGuard requires
  // `status === 'active'`, but the admin create path never writes a status
  // field. Login tolerates the absence (it defaults), the guard does not.
  test('a logged-in student is not rejected by StudentJwtGuard', async () => {
    // 403 is a legitimate answer here (the themata entitlement); 401 would mean
    // the guard itself refused a session that had just logged in successfully.
    const res = await api('/api/exam-materials', { token: session.token });
    assert.notEqual(res.status, 401,
      'a student who just logged in was refused by StudentJwtGuard - login and the guard disagree on status');
  });

  test('a logged-in student can reach their exercises', async () => {
    const res = await api('/api/exercises/student', { token: session.token });
    assert.equal(res.status, 200, `student exercises refused with ${res.status}`);
  });
});
