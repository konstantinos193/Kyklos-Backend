// Covers the cover-image upload route and, more importantly, the whole
// publish-an-announcement journey that it unblocks.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, expectStatus, expectOneOf, unwrap, adminToken, uniq, BASE } from './helpers.mjs';

// Smallest valid PNG: 1x1 transparent pixel.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const created = [];
after(async () => {
  const token = await adminToken();
  for (const id of created) await api(`/api/news/${id}`, { method: 'DELETE', token });
});

/** multipart POST; the shared api() helper passes FormData through untouched. */
async function postImage(bytes, filename, contentType, token) {
  const form = new FormData();
  form.append('image', new Blob([bytes], { type: contentType }), filename);
  return api('/api/news/upload-image', { method: 'POST', token, body: form });
}

describe('News cover image upload', () => {
  test('anonymous callers are refused', async () => {
    const res = await postImage(PNG_1X1, 'a.png', 'image/png', undefined);
    expectOneOf(res, [401, 403], 'anonymous upload');
  });

  test('a student token is refused', async () => {
    const { studentSession } = await import('./helpers.mjs');
    const s = await studentSession();
    const res = await postImage(PNG_1X1, 'a.png', 'image/png', s.token);
    expectOneOf(res, [401, 403], 'student upload');
  });

  test('a request with no file is rejected, not 500', async () => {
    const token = await adminToken();
    const res = await api('/api/news/upload-image', { method: 'POST', token, body: new FormData() });
    assert.ok(res.status >= 400 && res.status < 500, `empty upload returned ${res.status}`);
  });

  test('a non-image file is rejected', async () => {
    const token = await adminToken();
    const res = await postImage(Buffer.from('not really an image'), 'evil.txt', 'text/plain', token);
    assert.ok(res.status >= 400 && res.status < 500, `text file returned ${res.status}`);
  });

  test('the route does not collide with POST /api/news/:id/files', async () => {
    // 'upload-image' must resolve as a literal, never as an :id.
    const token = await adminToken();
    const res = await postImage(PNG_1X1, 'ok.png', 'image/png', token);
    assert.notEqual(res.status, 404, 'upload-image resolved to a different route');
  });

  test('an admin can upload a PNG and gets a usable URL back', async () => {
    const token = await adminToken();
    const res = await postImage(PNG_1X1, 'cover.png', 'image/png', token);
    assert.ok([200, 201].includes(res.status), `upload returned ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);

    const url = unwrap(res.body)?.url ?? res.body?.data?.url;
    assert.ok(url, `no url returned: ${JSON.stringify(res.body).slice(0, 300)}`);
    assert.match(url, /^https?:\/\//, 'returned an absolute URL');
  });
});

// The regression that actually mattered: an administrator could not publish an
// announcement at all, because creating one requires an image and the only
// other upload route needed a post that already existed.
describe('Publishing an announcement end to end', () => {
  let imageUrl;
  let postId;
  const title = uniq('E2E Ανακοίνωση');

  test('step 1: upload the cover image', async () => {
    const token = await adminToken();
    const res = await postImage(PNG_1X1, 'anakoinosi.png', 'image/png', token);
    assert.ok([200, 201].includes(res.status), `upload failed: ${res.status}`);
    imageUrl = unwrap(res.body)?.url ?? res.body?.data?.url;
    assert.ok(imageUrl, 'image URL obtained');
  });

  test('step 2: create the announcement with that URL', async () => {
    const token = await adminToken();
    const res = await api('/api/news', {
      method: 'POST',
      token,
      body: {
        title,
        excerpt: 'Περίληψη ανακοίνωσης από το e2e.',
        content: 'Περιεχόμενο ανακοίνωσης από το e2e. '.repeat(3),
        type: 'announcement',
        author: { name: 'ΚΥΚΛΟΣ', image: '/logo.png' },
        image: { url: imageUrl, alt: 'anakoinosi' },
        status: 'published',
        featured: false,
      },
    });
    assert.ok([200, 201].includes(res.status), `create failed: ${res.status} ${JSON.stringify(res.body).slice(0, 300)}`);
    postId = unwrap(res.body)?._id ?? unwrap(res.body)?.id;
    assert.ok(postId, 'announcement id returned');
    created.push(postId);
  });

  test('step 3: it shows up on the public announcements endpoint', async () => {
    const res = await api('/api/news/announcements');
    expectStatus(res, 200, 'announcements');
    assert.ok(JSON.stringify(res.body).includes(title), 'the new announcement is publicly listed');
  });

  test('step 4: the form payload the admin panel actually sends is accepted', async () => {
    // Mirrors handleCreatePost exactly, including the Date values that become
    // ISO strings over JSON and the optional fields the panel always includes.
    const token = await adminToken();
    const res = await api('/api/news', {
      method: 'POST',
      token,
      body: {
        title: uniq('E2E Panel Shape'),
        excerpt: 'Περίληψη.',
        content: 'Περιεχόμενο.',
        type: 'announcement',
        author: { name: 'ΚΥΚΛΟΣ', image: '/logo.png' },
        image: { url: imageUrl, alt: 'alt' },
        tags: ['e2e'],
        status: 'published',
        publishDate: new Date().toISOString(),
        location: 'Άρτα',
        featured: false,
      },
    });
    assert.ok([200, 201].includes(res.status),
      `the admin panel's exact payload was rejected: ${res.status} ${JSON.stringify(res.body).slice(0, 400)}`);
    const id = unwrap(res.body)?._id ?? unwrap(res.body)?.id;
    if (id) created.push(id);
  });

  test('step 5: creating without an image is still refused by the API', async () => {
    const token = await adminToken();
    const res = await api('/api/news', {
      method: 'POST',
      token,
      body: {
        title: uniq('E2E No Image'),
        excerpt: 'Περίληψη.',
        content: 'Περιεχόμενο.',
        type: 'announcement',
        author: { name: 'ΚΥΚΛΟΣ' },
      },
    });
    expectStatus(res, 400, 'image is genuinely required server-side');
  });
});
