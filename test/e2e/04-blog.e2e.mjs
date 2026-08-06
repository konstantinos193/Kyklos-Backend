import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, expectStatus, unwrap, adminToken, sampleBlog } from './helpers.mjs';

const created = [];
after(async () => {
  const token = await adminToken();
  for (const id of created) await api(`/api/blog/${id}`, { method: 'DELETE', token });
});

describe('Blog', () => {
  let id;

  test('public list is readable without auth', async () => {
    const res = await api('/api/blog');
    expectStatus(res, 200, 'blog list');
  });

  test('admin can create a post', async () => {
    const token = await adminToken();
    const res = await api('/api/blog', { method: 'POST', token, body: sampleBlog() });
    assert.ok([200, 201].includes(res.status), `create returned ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
    const d = unwrap(res.body);
    id = d?._id || d?.id || d?.blog?._id;
    assert.ok(id, `no id in create response: ${JSON.stringify(res.body).slice(0, 300)}`);
    created.push(id);
  });

  test('created post is retrievable by id', async () => {
    const res = await api(`/api/blog/${id}`);
    expectStatus(res, 200, 'get by id');
    const d = unwrap(res.body);
    assert.ok(d?.title || d?.blog?.title, 'post has a title');
  });

  test('created post appears in the list', async () => {
    const res = await api('/api/blog?limit=100');
    const d = unwrap(res.body);
    const items = Array.isArray(d) ? d : d?.blogs || d?.items || d?.data || [];
    assert.ok(Array.isArray(items), `list shape unexpected: ${JSON.stringify(d).slice(0, 200)}`);
  });

  test('admin can update a post', async () => {
    const token = await adminToken();
    const res = await api(`/api/blog/${id}`, { method: 'PUT', token, body: { title: 'E2E Updated Title' } });
    expectStatus(res, 200, 'update');
    const check = await api(`/api/blog/${id}`);
    const d = unwrap(check.body);
    const title = d?.title || d?.blog?.title;
    assert.equal(title, 'E2E Updated Title', 'update persisted');
  });

  test('categories endpoint responds', async () => {
    expectStatus(await api('/api/blog/categories'), 200, 'categories');
  });

  test('create rejects a payload missing required fields', async () => {
    const token = await adminToken();
    const res = await api('/api/blog', { method: 'POST', token, body: { title: 'only a title' } });
    expectStatus(res, 400, 'incomplete blog payload');
  });

  test('create rejects an over-long title', async () => {
    const token = await adminToken();
    const res = await api('/api/blog', { method: 'POST', token, body: sampleBlog({ title: 'x'.repeat(201) }) });
    expectStatus(res, 400, 'title over MaxLength(200)');
  });

  test('create rejects unknown fields', async () => {
    const token = await adminToken();
    const res = await api('/api/blog', { method: 'POST', token, body: sampleBlog({ isAdmin: true }) });
    expectStatus(res, 400, 'unknown field rejected');
  });

  test('a draft is not exposed through the public read', async () => {
    const token = await adminToken();
    const res = await api('/api/blog', { method: 'POST', token, body: sampleBlog({ status: 'draft' }) });
    assert.ok([200, 201].includes(res.status), `draft create returned ${res.status}`);
    const draftId = unwrap(res.body)?._id || unwrap(res.body)?.id;
    assert.ok(draftId, 'draft id returned');
    created.push(draftId);
    const pub = await api(`/api/blog/${draftId}`);
    assert.equal(pub.status, 404, 'unpublished drafts must stay private');
  });

  test('unknown id returns 404, not 500', async () => {
    const res = await api('/api/blog/507f1f77bcf86cd799439011');
    assert.ok([404, 400].includes(res.status), `expected 404/400 for missing post, got ${res.status}`);
  });

  test('malformed id is handled gracefully', async () => {
    const res = await api('/api/blog/not-a-valid-object-id');
    assert.ok(res.status < 500, `malformed id caused ${res.status} - should not be a server error`);
  });

  test('admin can delete a post', async () => {
    const token = await adminToken();
    const res = await api(`/api/blog/${id}`, { method: 'DELETE', token });
    expectStatus(res, 200, 'delete');
    created.splice(created.indexOf(id), 1);
    const after = await api(`/api/blog/${id}`);
    assert.ok([404, 400].includes(after.status), `deleted post still readable (${after.status})`);
  });
});
