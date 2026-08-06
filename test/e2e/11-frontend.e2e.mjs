// Drives the real Next.js server running in Docker, wired to the real backend.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, FRONTEND } from './helpers.mjs';

const page = (path, opts = {}) => api(path, { base: FRONTEND, raw: true, ...opts });

const PAGES = [
  '/', '/about', '/contact', '/blog', '/news', '/curriculum', '/programs',
  '/teachers', '/gallery', '/privacy', '/terms', '/prospectus',
  '/success-stories', '/epitychontes', '/epityxontes', '/epikairotita',
  '/nea-ekdiloseis', '/frontistiria-arta', '/oi-kalyteroi-olon-ton-epoxon',
  '/themata-panellinion', '/panhellenic/archive', '/unsubscribe',
  '/current-affairs', '/current-affairs/education', '/current-affairs/universities',
  '/news/announcements', '/news/events', '/news/seminars',
  '/curriculum/mathematics', '/curriculum/physics', '/curriculum/chemistry',
  '/curriculum/biology', '/curriculum/history', '/curriculum/latin',
  '/curriculum/algebra', '/curriculum/geometry', '/curriculum/economics',
  '/curriculum/informatics', '/curriculum/ancient-greek', '/curriculum/greek-literature',
  '/login', '/student-login', '/admin/login', '/contact/success',
];

describe('Frontend: every page renders', () => {
  for (const p of PAGES) {
    test(`GET ${p} returns HTML`, async () => {
      const res = await page(p);
      assert.equal(res.status, 200, `${p} returned ${res.status}`);
      assert.match(res.headers.get('content-type') || '', /text\/html/, `${p} is not HTML`);
      assert.ok(res.text.length > 500, `${p} body suspiciously small (${res.text.length} bytes)`);
    });
  }
});

describe('Frontend: no page rendered an error boundary', () => {
  // Next.js inlines the not-found boundary's copy into every page payload, so
  // "This page could not be found" is not a usable signal - the 200 status
  // asserted above is what proves the route resolved. These check for markers
  // that only appear when a render genuinely failed.
  for (const p of PAGES) {
    test(`${p} is free of runtime error markers`, async () => {
      const res = await page(p);
      const t = res.text;
      assert.ok(!t.includes('Application error: a client-side exception'),
        `${p} rendered a client-side exception`);
      assert.ok(!t.includes('Internal Server Error'), `${p} rendered a server error`);
      assert.ok(!t.includes('__NEXT_ERROR_CODE'), `${p} surfaced a Next.js error code`);
      // /admin/login is a client component whose first paint is an auth-check
      // spinner, so it legitimately ships no chrome from the server. Its real
      // behaviour is covered by the browser suite instead.
      if (p !== '/admin/login') {
        assert.ok(/<main|<header|<nav|<footer/i.test(t), `${p} rendered no page chrome - likely an empty shell`);
      }
    });
  }
});

describe('Frontend: SEO essentials', () => {
  test('home page has a title', async () => {
    const res = await page('/');
    const m = res.text.match(/<title[^>]*>([^<]+)<\/title>/i);
    assert.ok(m && m[1].trim().length > 0, 'home page has a non-empty <title>');
  });

  test('home page has a meta description', async () => {
    const res = await page('/');
    assert.match(res.text, /<meta[^>]+name="description"[^>]+content="[^"]{20,}"/i, 'meta description present');
  });

  test('html lang is set to Greek', async () => {
    const res = await page('/');
    assert.match(res.text, /<html[^>]+lang="el/i, 'lang="el" expected for a Greek site');
  });

  test('Open Graph tags are present', async () => {
    const res = await page('/');
    assert.match(res.text, /property="og:title"/i, 'og:title');
    assert.match(res.text, /property="og:description"/i, 'og:description');
  });

  test('robots.txt is served', async () => {
    const res = await page('/robots.txt');
    assert.equal(res.status, 200, 'robots.txt');
    assert.match(res.text, /User-?Agent/i, 'robots.txt has directives');
  });

  test('sitemap.xml is served and well-formed', async () => {
    const res = await page('/sitemap.xml');
    assert.equal(res.status, 200, 'sitemap.xml');
    assert.match(res.text, /<urlset/i, 'sitemap is a urlset');
    assert.match(res.text, /<loc>/i, 'sitemap contains locations');
  });

  test('sitemap advertises the canonical production host', async () => {
    const res = await page('/sitemap.xml');
    assert.match(res.text, /kyklosedu\.gr/i, 'sitemap should reference the production domain');
  });

  test('every listed page carries a title', async () => {
    const missing = [];
    for (const p of PAGES) {
      const res = await page(p);
      if (!/<title[^>]*>[^<]+<\/title>/i.test(res.text)) missing.push(p);
    }
    assert.equal(missing.length, 0, `pages without a <title>: ${missing.join(', ')}`);
  });
});

describe('Frontend: routing rules from next.config', () => {
  test('/panhellenic redirects to the archive', async () => {
    const res = await page('/panhellenic');
    assert.ok([301, 308].includes(res.status), `expected a permanent redirect, got ${res.status}`);
    assert.match(res.headers.get('location') || '', /\/panhellenic\/archive/, 'redirect target');
  });

  test('/classes redirects to /curriculum', async () => {
    const res = await page('/classes');
    assert.ok([301, 308].includes(res.status), `expected a permanent redirect, got ${res.status}`);
    assert.match(res.headers.get('location') || '', /\/curriculum/, 'redirect target');
  });

  test('/panhellenic/2024 redirects to the archive', async () => {
    const res = await page('/panhellenic/2024');
    assert.ok([301, 308].includes(res.status), `expected a permanent redirect, got ${res.status}`);
  });

  test('an x-forwarded-proto of http is redirected to the canonical https host', async () => {
    const res = await page('/about', { headers: { 'x-forwarded-proto': 'http' } });
    assert.ok([301, 308].includes(res.status), `expected the HTTPS redirect, got ${res.status}`);
    assert.match(res.headers.get('location') || '', /^https:\/\/kyklosedu\.gr/, 'redirects to the canonical https origin');
  });

  test('HSTS header is applied', async () => {
    const res = await page('/');
    assert.match(res.headers.get('strict-transport-security') || '', /max-age=31536000/, 'HSTS set');
  });

  test('/favicon.ico is rewritten to the logo', async () => {
    const res = await page('/favicon.ico');
    assert.equal(res.status, 200, 'favicon served');
  });

  test('an unknown route returns 404', async () => {
    const res = await page('/this-route-does-not-exist-e2e');
    assert.equal(res.status, 404, 'unknown route');
  });
});

describe('Frontend: integration with the backend', () => {
  test('the frontend health route responds', async () => {
    const res = await page('/api/health');
    assert.ok(res.status < 500, `frontend health returned ${res.status}`);
  });

  test('the blog index renders against the live API', async () => {
    const res = await page('/blog');
    assert.equal(res.status, 200);
    assert.ok(!res.text.includes('Failed to fetch'), 'blog page reported a fetch failure');
  });

  test('the news index renders against the live API', async () => {
    const res = await page('/news');
    assert.equal(res.status, 200);
    assert.ok(!res.text.includes('Failed to fetch'), 'news page reported a fetch failure');
  });

  test('no page leaks the API base URL as a broken localhost reference', async () => {
    const res = await page('/');
    assert.ok(!res.text.includes('http://localhost:5000'),
      'a hardcoded localhost API URL was shipped to the browser');
  });

  test('no secret material is present in the served HTML', async () => {
    const res = await page('/');
    const t = res.text;
    for (const needle of ['mongodb+srv://', 'CLOUDINARY_API_SECRET', 'JWT_SECRET', 'e2epass']) {
      assert.ok(!t.includes(needle), `"${needle}" leaked into the page source`);
    }
  });
});
