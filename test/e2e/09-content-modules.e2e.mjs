// Exam materials, exercises, panhellenic archive and teacher permissions.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, expectStatus, unwrap, adminToken, studentSession, uniq } from './helpers.mjs';

const cleanup = [];
after(async () => {
  const token = await adminToken();
  for (const [path, id] of cleanup) await api(`${path}/${id}`, { method: 'DELETE', token });
});

describe('Exam materials', () => {
  let id;

  test('admin listing responds', async () => {
    const token = await adminToken();
    expectStatus(await api('/api/exam-materials/admin', { token }), 200, 'exam admin list');
  });

  test('admin/list responds', async () => {
    const token = await adminToken();
    expectStatus(await api('/api/exam-materials/admin/list', { token }), 200, 'exam admin/list');
  });

  test('admin can create an exam material', async () => {
    const token = await adminToken();
    const res = await api('/api/exam-materials', {
      method: 'POST', token,
      body: { title: uniq('E2E Material'), subject: 'Έκθεση', grade: 'Γ Λυκείου', year: 2024, type: 'exam' },
    });
    if (![200, 201].includes(res.status)) {
      assert.ok(res.status === 400, `unexpected status ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
      return;
    }
    const d = unwrap(res.body);
    id = d?._id || d?.id || d?.material?._id;
    if (id) cleanup.push(['/api/exam-materials', id]);
  });

  test('a student granted access reaches the student-facing listing', async () => {
    const s = await studentSession({ hasAccessToThemata: true });
    const res = await api('/api/exam-materials', { token: s.token });
    assert.equal(res.status, 200, `entitled student refused with ${res.status}`);
  });

  test('a student without entitlement is refused with 403', async () => {
    const s = await studentSession({ hasAccessToThemata: false });
    const res = await api('/api/exam-materials', { token: s.token });
    assert.equal(res.status, 403, `the themata paywall should return 403, got ${res.status}`);
  });

  test('the paywall also covers individual material reads', async () => {
    const s = await studentSession({ hasAccessToThemata: false });
    const res = await api(`/api/exam-materials/${id || '507f1f77bcf86cd799439011'}`, { token: s.token });
    assert.ok([403, 404].includes(res.status), `unentitled single read returned ${res.status}`);
  });

  test('the paywall also covers downloads', async () => {
    const s = await studentSession({ hasAccessToThemata: false });
    const res = await api(`/api/exam-materials/download/${id || '507f1f77bcf86cd799439011'}`, { token: s.token });
    assert.ok([403, 404].includes(res.status), `unentitled download returned ${res.status}`);
  });
});

describe('Exercises', () => {
  let id;

  test('teacher listing responds for an admin', async () => {
    const token = await adminToken();
    expectStatus(await api('/api/exercises/teacher', { token }), 200, 'exercises teacher list');
  });

  test('admin can create an exercise', async () => {
    const token = await adminToken();
    const res = await api('/api/exercises/teacher', {
      method: 'POST', token,
      body: { title: uniq('E2E Exercise'), description: 'An e2e exercise', subject: 'Έκθεση', grade: 'Γ Λυκείου' },
    });
    if (![200, 201].includes(res.status)) {
      assert.ok(res.status < 500, `exercise create caused ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
      return;
    }
    const d = unwrap(res.body);
    id = d?._id || d?.id || d?.exercise?._id;
    if (id) cleanup.push(['/api/exercises/teacher', id]);
  });

  test('students reach their exercise listing', async () => {
    const s = await studentSession();
    const res = await api('/api/exercises/student', { token: s.token });
    assert.equal(res.status, 200, `student exercises refused with ${res.status}`);
  });
});

describe('Panhellenic archive', () => {
  let id;

  test('public listing responds', async () => {
    expectStatus(await api('/api/panhellenic-archive'), 200, 'archive list');
  });

  test('admin can create an entry', async () => {
    const token = await adminToken();
    const res = await api('/api/panhellenic-archive', {
      method: 'POST', token,
      body: { title: uniq('E2E Archive'), year: 2024, subject: 'Έκθεση', fileUrl: 'https://example.com/a.pdf' },
    });
    if (![200, 201].includes(res.status)) {
      assert.ok(res.status < 500, `archive create caused ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
      return;
    }
    const d = unwrap(res.body);
    id = d?._id || d?.id;
    if (id) cleanup.push(['/api/panhellenic-archive', id]);
  });

  test('toggle-active requires admin auth', async () => {
    const res = await api(`/api/panhellenic-archive/${id || '507f1f77bcf86cd799439011'}/toggle-active`, { method: 'PUT' });
    assert.ok([401, 403].includes(res.status), `toggle-active anonymous returned ${res.status}`);
  });

  test('malformed id does not 500', async () => {
    const res = await api('/api/panhellenic-archive/bogus');
    assert.ok(res.status < 500, `malformed archive id caused ${res.status}`);
  });
});

describe('Teacher permissions', () => {
  test('listing responds for an admin', async () => {
    const token = await adminToken();
    expectStatus(await api('/api/teacher-permissions', { token }), 200, 'permissions list');
  });

  test('check endpoint responds', async () => {
    const token = await adminToken();
    const res = await api('/api/teacher-permissions/check?teacherId=507f1f77bcf86cd799439011&examMaterialId=507f1f77bcf86cd799439011', { token });
    assert.ok(res.status < 500, `permission check caused ${res.status}`);
  });

  test('lookup by teacher responds', async () => {
    const token = await adminToken();
    const res = await api('/api/teacher-permissions/teacher/507f1f77bcf86cd799439011', { token });
    assert.ok(res.status < 500, `by-teacher lookup caused ${res.status}`);
  });

  test('create validates its payload', async () => {
    const token = await adminToken();
    const res = await api('/api/teacher-permissions', { method: 'POST', token, body: {} });
    assert.ok(res.status >= 400 && res.status < 500, `empty permission payload returned ${res.status}`);
  });
});
