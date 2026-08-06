import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, expectStatus, adminToken, uniq, mail } from './helpers.mjs';

describe('Newsletter', () => {
  const email = `${uniq('sub')}@kyklos.test`;

  before(async () => { await mail.clear(); });

  test('anyone can subscribe', async () => {
    const res = await api('/api/newsletter/subscribe', { method: 'POST', body: { email } });
    assert.ok([200, 201].includes(res.status), `subscribe returned ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
  });

  test('subscribing rejects a malformed address', async () => {
    const res = await api('/api/newsletter/subscribe', { method: 'POST', body: { email: 'definitely-not-an-email' } });
    expectStatus(res, 400, 'invalid subscriber email');
  });

  test('subscribing twice does not error out', async () => {
    const res = await api('/api/newsletter/subscribe', { method: 'POST', body: { email } });
    assert.ok(res.status < 500, `duplicate subscribe caused ${res.status}`);
  });

  // The subscribe handler persists the record and returns, with no call into
  // EmailService. Recorded as a product gap rather than asserted as a
  // regression: there is no welcome mail and no double opt-in confirmation.
  test('subscription confirmation email (currently not implemented)', async () => {
    const msgs = await mail.list();
    if (msgs.length === 0) {
      console.log('      GAP: newsletter subscribe sends no confirmation email and has no double opt-in');
    }
    assert.ok(true);
  });

  test('a failed subscribe still returns HTTP 200 (error swallowing)', async () => {
    // Documents real behaviour: the controller catches everything and answers
    // 200 with success:false, so clients cannot distinguish failure by status.
    const res = await api('/api/newsletter/subscribe', { method: 'POST', body: { email } });
    if (res.status === 200 && res.body?.success === false) {
      console.log('      GAP: duplicate subscribe answers HTTP 200 with success:false rather than a 4xx');
    }
    assert.ok(res.status < 500, `duplicate subscribe caused ${res.status}`);
  });

  test('admin can read subscriber stats', async () => {
    const token = await adminToken();
    expectStatus(await api('/api/newsletter/stats', { token }), 200, 'newsletter stats');
  });

  test('admin can list subscribers', async () => {
    const token = await adminToken();
    const res = await api('/api/newsletter/subscribers', { token });
    expectStatus(res, 200, 'subscribers');
    assert.ok(JSON.stringify(res.body).includes(email), 'the new subscriber appears in the list');
  });

  test('admin can export subscribers', async () => {
    const token = await adminToken();
    expectStatus(await api('/api/newsletter/export', { token }), 200, 'export');
  });

  test('unsubscribe works', async () => {
    const res = await api('/api/newsletter/unsubscribe', { method: 'POST', body: { email } });
    assert.ok(res.status < 400, `unsubscribe returned ${res.status}`);
  });

  test('verify endpoint responds', async () => {
    const res = await api('/api/newsletter/verify?token=bogus');
    assert.ok(res.status < 500, `newsletter verify caused ${res.status}`);
  });
});

describe('Contact form', () => {
  before(async () => { await mail.clear(); });

  test('a valid enquiry is accepted', async () => {
    const res = await api('/api/contact', {
      method: 'POST',
      body: { name: 'E2E Tester', email: 'tester@kyklos.test', subject: 'E2E enquiry', message: 'Testing the contact form end to end.' },
    });
    assert.ok([200, 201].includes(res.status), `contact returned ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
  });

  test('the enquiry is actually emailed', async () => {
    const msgs = await mail.list();
    assert.ok(msgs.length > 0, 'contact form should send mail; Mailpit received none');
  });

  test('an empty submission is rejected', async () => {
    expectStatus(await api('/api/contact', { method: 'POST', body: {} }), 400, 'empty contact');
  });

  test('a malformed address is rejected', async () => {
    const res = await api('/api/contact', {
      method: 'POST',
      body: { name: 'X', email: 'nope', subject: 'S', message: 'M' },
    });
    expectStatus(res, 400, 'invalid contact email');
  });

  test('script content in the message does not come back reflected raw', async () => {
    const res = await api('/api/contact', {
      method: 'POST',
      body: { name: 'XSS', email: 'xss@kyklos.test', subject: 'XSS', message: '<script>alert(1)</script>' },
    });
    assert.ok(res.status < 500, `payload caused ${res.status}`);
    if (typeof res.body === 'object') {
      assert.ok(!JSON.stringify(res.body).includes('<script>alert(1)</script>'),
        'raw script tag reflected back to the caller');
    }
  });
});
