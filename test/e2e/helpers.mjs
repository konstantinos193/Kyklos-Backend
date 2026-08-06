// Shared harness for the e2e suite. Talks to the backend over real HTTP against
// the dockerised stack - nothing is stubbed or run in-process.
import assert from 'node:assert/strict';

export const BASE = process.env.E2E_BASE_URL || 'http://backend:5000';
export const FRONTEND = process.env.E2E_FRONTEND_URL || 'http://frontend:8765';
export const MAILPIT = process.env.E2E_MAILPIT_URL || 'http://mailpit:8025';

let counter = 0;
export const uniq = (p = 'x') => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/**
 * Single entry point for every request the suite makes.
 * Returns the status/headers/body rather than throwing, so tests can assert on
 * failure responses as precisely as on successful ones.
 */
export async function api(path, { method = 'GET', token, body, headers = {}, raw = false, base = BASE } = {}) {
  const h = { ...headers };
  let payload;

  if (body !== undefined) {
    if (body instanceof FormData) {
      payload = body;
    } else {
      h['Content-Type'] = h['Content-Type'] || 'application/json';
      payload = typeof body === 'string' ? body : JSON.stringify(body);
    }
  }
  if (token) h.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}${path}`, { method, headers: h, body: payload, redirect: 'manual' });
  const text = await res.text();
  let parsed = text;
  if (!raw) {
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  }
  return { status: res.status, headers: res.headers, body: parsed, text };
}

export function expectStatus(res, expected, label = '') {
  const detail = typeof res.body === 'string' ? res.body.slice(0, 300) : JSON.stringify(res.body).slice(0, 300);
  assert.equal(res.status, expected, `${label} expected ${expected}, got ${res.status}: ${detail}`);
}

/** Any of a set - used where a route's failure mode is legitimately 401 or 403. */
export function expectOneOf(res, codes, label = '') {
  const detail = typeof res.body === 'string' ? res.body.slice(0, 200) : JSON.stringify(res.body).slice(0, 200);
  assert.ok(codes.includes(res.status), `${label} expected one of ${codes}, got ${res.status}: ${detail}`);
}

/** Unwraps the TransformInterceptor envelope, which is applied inconsistently. */
export function unwrap(body) {
  if (body && typeof body === 'object' && 'data' in body && 'success' in body) return body.data;
  return body;
}

export async function waitFor(fn, { timeout = 60000, interval = 1000, label = 'condition' } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      const r = await fn();
      if (r) return r;
    } catch (e) { last = e; }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Timed out waiting for ${label}${last ? `: ${last.message}` : ''}`);
}

const ADMIN_PASSWORD = 'E2ePassw0rd!';

/**
 * The first admin on a fresh database may be created unauthenticated
 * (AdminBootstrapGuard). Every later admin needs an authenticated caller, so the
 * bootstrap account is cached and reused as the suite's privileged identity.
 */
let cachedAdmin = null;
export async function adminToken() {
  if (cachedAdmin) return cachedAdmin.token;

  const email = `e2e-root@kyklos.test`;
  // Try logging in first: the account survives across suite files.
  let login = await api('/api/admin/auth/login', { method: 'POST', body: { email, password: ADMIN_PASSWORD } });

  if (login.status !== 200) {
    const created = await api('/api/admin/auth/create', {
      method: 'POST',
      body: { email, password: ADMIN_PASSWORD, name: 'E2E Root', role: 'super_admin' },
    });
    if (created.status !== 201 && created.status !== 200) {
      throw new Error(`Could not bootstrap admin: ${created.status} ${JSON.stringify(created.body).slice(0, 300)}`);
    }
    login = await api('/api/admin/auth/login', { method: 'POST', body: { email, password: ADMIN_PASSWORD } });
  }

  if (login.status !== 200 || !login.body?.token) {
    throw new Error(`Admin login failed: ${login.status} ${JSON.stringify(login.body).slice(0, 300)}`);
  }
  cachedAdmin = { token: login.body.token, email, password: ADMIN_PASSWORD, admin: login.body.admin };
  return cachedAdmin.token;
}

export async function adminInfo() {
  await adminToken();
  return cachedAdmin;
}

/** Creates a student through the admin API and logs in as them. */
export async function studentSession(over = {}) {
  const token = await adminToken();
  // CreateStudentDto has no `status` field and the global pipe runs with
  // forbidNonWhitelisted, so sending one would be rejected outright.
  const payload = {
    firstName: 'E2E',
    lastName: uniq('Student'),
    email: `${uniq('stu')}@kyklos.test`,
    phone: '2101234567',
    grade: 'Γ Λυκείου',
    ...over,
  };
  const created = await api('/api/admin/students', { method: 'POST', token, body: payload });
  if (![200, 201].includes(created.status)) {
    throw new Error(`Student create failed: ${created.status} ${JSON.stringify(created.body).slice(0, 300)}`);
  }
  const student = unwrap(created.body)?.student || unwrap(created.body);
  const key = student?.uniqueKey || student?.studentId;
  if (!key) throw new Error(`No uniqueKey on created student: ${JSON.stringify(created.body).slice(0, 300)}`);

  const login = await api('/api/auth/student-login', { method: 'POST', body: { uniqueKey: key } });
  if (login.status !== 200 || !login.body?.token) {
    throw new Error(`Student login failed: ${login.status} ${JSON.stringify(login.body).slice(0, 300)}`);
  }
  return { token: login.body.token, student, uniqueKey: key, id: student._id };
}

export const sampleBlog = (over = {}) => ({
  title: uniq('E2E Blog'),
  excerpt: 'Excerpt for the e2e suite.',
  content: 'Body content for the e2e suite. '.repeat(5),
  author: { name: 'E2E Author' },
  category: 'Εκπαίδευση',
  image: { url: 'https://example.com/i.jpg', alt: 'alt' },
  tags: ['e2e'],
  // Public reads filter on status: 'published'; a draft is invisible by design.
  status: 'published',
  ...over,
});

export const sampleNews = (over = {}) => ({
  title: uniq('E2E News'),
  excerpt: 'News excerpt for the e2e suite.',
  content: 'News body for the e2e suite. '.repeat(5),
  type: 'announcement',
  author: { name: 'E2E Author' },
  image: { url: 'https://example.com/n.jpg', alt: 'alt' },
  status: 'published',
  ...over,
});

/** Mailpit's REST API, used to prove mail was actually handed to SMTP. */
export const mail = {
  async list() {
    const r = await api('/api/v1/messages', { base: MAILPIT });
    return r.body?.messages || [];
  },
  async clear() {
    await api('/api/v1/messages', { method: 'DELETE', base: MAILPIT });
  },
  async waitForSubject(match, timeout = 20000) {
    return waitFor(async () => {
      const msgs = await mail.list();
      return msgs.find((m) => (m.Subject || '').includes(match)) || null;
    }, { timeout, label: `email matching "${match}"` });
  },
};
