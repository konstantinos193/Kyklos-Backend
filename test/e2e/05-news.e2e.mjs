import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, expectStatus, unwrap, adminToken, sampleNews } from './helpers.mjs';

const created = [];
after(async () => {
  const token = await adminToken();
  for (const id of created) await api(`/api/news/${id}`, { method: 'DELETE', token });
});

const TYPES = ['announcements', 'events', 'seminars', 'education', 'universities'];

describe('News', () => {
  let id;

  test('public list is readable without auth', async () => {
    expectStatus(await api('/api/news'), 200, 'news list');
  });

  test('types endpoint responds', async () => {
    expectStatus(await api('/api/news/types'), 200, 'news types');
  });

  for (const t of TYPES) {
    test(`GET /api/news/${t} responds`, async () => {
      expectStatus(await api(`/api/news/${t}`), 200, `news/${t}`);
    });
  }

  test('admin can create a news item', async () => {
    const token = await adminToken();
    const res = await api('/api/news', { method: 'POST', token, body: sampleNews() });
    assert.ok([200, 201].includes(res.status), `create returned ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
    const d = unwrap(res.body);
    id = d?._id || d?.id || d?.news?._id;
    assert.ok(id, `no id returned: ${JSON.stringify(res.body).slice(0, 300)}`);
    created.push(id);
  });

  test('created item is retrievable', async () => {
    expectStatus(await api(`/api/news/${id}`), 200, 'news by id');
  });

  test('admin can update a news item', async () => {
    const token = await adminToken();
    const res = await api(`/api/news/${id}`, { method: 'PUT', token, body: { title: 'E2E Updated News' } });
    expectStatus(res, 200, 'news update');
  });

  test('create rejects an invalid type enum', async () => {
    const token = await adminToken();
    const res = await api('/api/news', { method: 'POST', token, body: sampleNews({ type: 'not-a-real-type' }) });
    expectStatus(res, 400, 'invalid enum');
  });

  test('create rejects a missing required field', async () => {
    const token = await adminToken();
    const body = sampleNews();
    delete body.excerpt;
    expectStatus(await api('/api/news', { method: 'POST', token, body }), 400, 'missing excerpt');
  });

  test('malformed id does not 500', async () => {
    const res = await api('/api/news/bogus-id');
    assert.ok(res.status < 500, `malformed news id caused ${res.status}`);
  });

  test('admin can delete a news item', async () => {
    const token = await adminToken();
    expectStatus(await api(`/api/news/${id}`, { method: 'DELETE', token }), 200, 'news delete');
    created.splice(created.indexOf(id), 1);
  });
});
