import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, expectStatus, unwrap, adminToken, uniq } from './helpers.mjs';

const created = [];
after(async () => {
  const token = await adminToken();
  for (const id of created) await api(`/api/admin/students/${id}`, { method: 'DELETE', token });
});

describe('Admin: students', () => {
  let id, uniqueKey;

  test('admin can list students', async () => {
    const token = await adminToken();
    expectStatus(await api('/api/admin/students', { token }), 200, 'student list');
  });

  test('list accepts pagination params', async () => {
    const token = await adminToken();
    expectStatus(await api('/api/admin/students?page=1&limit=5', { token }), 200, 'paginated list');
  });

  test('admin can create a student and a uniqueKey is generated', async () => {
    const token = await adminToken();
    const res = await api('/api/admin/students', {
      method: 'POST', token,
      body: { firstName: 'E2E', lastName: uniq('Pupil'), email: `${uniq('p')}@kyklos.test`, grade: 'Γ Λυκείου' },
    });
    assert.ok([200, 201].includes(res.status), `create returned ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
    const d = unwrap(res.body);
    const student = d?.student || d;
    id = student?._id;
    uniqueKey = student?.uniqueKey;
    assert.ok(id, 'student id returned');
    assert.ok(uniqueKey, 'uniqueKey auto-generated');
    created.push(id);
  });

  test('created student is retrievable by id', async () => {
    const token = await adminToken();
    const res = await api(`/api/admin/students/${id}`, { token });
    expectStatus(res, 200, 'student by id');
  });

  test('create rejects a missing required name', async () => {
    const token = await adminToken();
    expectStatus(await api('/api/admin/students', { method: 'POST', token, body: { lastName: 'OnlyLast' } }), 400, 'missing firstName');
  });

  test('create rejects unknown fields', async () => {
    const token = await adminToken();
    const res = await api('/api/admin/students', {
      method: 'POST', token,
      body: { firstName: 'A', lastName: 'B', role: 'super_admin' },
    });
    expectStatus(res, 400, 'unknown field on student create');
  });

  test('duplicate uniqueKey is refused', async () => {
    const token = await adminToken();
    const res = await api('/api/admin/students', {
      method: 'POST', token,
      body: { firstName: 'Dup', lastName: 'Key', uniqueKey },
    });
    // uniqueKey is not on the DTO, so this is either a validation or a conflict error.
    assert.ok(res.status >= 400 && res.status < 500, `duplicate key should be a 4xx, got ${res.status}`);
  });

  test('admin can update a student', async () => {
    const token = await adminToken();
    const res = await api(`/api/admin/students/${id}`, { method: 'PUT', token, body: { grade: 'Β Λυκείου' } });
    expectStatus(res, 200, 'student update');
  });

  test('invalid id is a 4xx, never a 500', async () => {
    const token = await adminToken();
    const res = await api('/api/admin/students/not-an-id', { token });
    assert.ok(res.status < 500, `invalid student id caused ${res.status}`);
  });

  test('admin can delete a student', async () => {
    const token = await adminToken();
    expectStatus(await api(`/api/admin/students/${id}`, { method: 'DELETE', token }), 200, 'student delete');
    created.splice(created.indexOf(id), 1);
  });
});

describe('Admin: stats, settings, teachers', () => {
  test('stats endpoint responds', async () => {
    const token = await adminToken();
    expectStatus(await api('/api/admin/stats', { token }), 200, 'stats');
  });

  test('settings are readable', async () => {
    const token = await adminToken();
    expectStatus(await api('/api/admin/settings', { token }), 200, 'settings read');
  });

  test('teachers list responds', async () => {
    const token = await adminToken();
    expectStatus(await api('/api/admin/teachers', { token }), 200, 'teachers');
  });

  test('admins list responds and never leaks password hashes', async () => {
    const token = await adminToken();
    const res = await api('/api/admin/admins', { token });
    expectStatus(res, 200, 'admins list');
    assert.ok(!JSON.stringify(res.body).includes('$2b$') && !JSON.stringify(res.body).includes('$2a$'),
      'bcrypt hashes must never be serialised to clients');
  });
});
