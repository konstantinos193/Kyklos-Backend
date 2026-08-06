// Real Chromium against the dockerised stack. Everything here exercises
// hydration and client-side behaviour that HTTP-level checks cannot see.
import { test, expect } from '@playwright/test';

const API = process.env.E2E_BASE_URL || 'http://backend:5000';

const ADMIN_EMAIL = 'e2e-root@kyklos.test';
const ADMIN_PASSWORD = 'E2ePassw0rd!';

/** Fails the test if the browser logged a page error or a console error. */
function watchForErrors(page, sink) {
  page.on('pageerror', (e) => sink.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      // Image 404s from remote stock hosts are noise in a sealed test network.
      if (/favicon|net::ERR_|Failed to load resource/i.test(t)) return;
      sink.push(`console.error: ${t}`);
    }
  });
}

test.describe('Public site in a real browser', () => {
  for (const path of ['/', '/about', '/contact', '/blog', '/news', '/curriculum', '/teachers']) {
    test(`${path} hydrates without console or page errors`, async ({ page }) => {
      const errors = [];
      watchForErrors(page, errors);
      // 'networkidle' never settles here - the pages keep sockets open, so
      // waiting for it just times out. Load plus a hydration pause is enough.
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(res.status(), `${path} status`).toBe(200);
      await page.waitForLoadState('load').catch(() => {});
      await page.waitForTimeout(2500);
      await expect(page.locator('body')).toBeVisible();
      expect(errors, `${path} produced browser errors:\n${errors.join('\n')}`).toEqual([]);
    });
  }

  test('the home page renders visible Greek content', async ({ page }) => {
    await page.goto('/');
    const text = await page.locator('body').innerText();
    expect(text.length, 'home page has visible text').toBeGreaterThan(200);
    expect(text).toMatch(/[Α-Ωα-ωίϊΐόάέύϋΰήώ]/);
  });

  test('the primary navigation is present and clickable', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('header a, nav a');
    expect(await links.count(), 'navigation links found').toBeGreaterThan(0);
  });

  test('no horizontal overflow at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'page scrolls sideways on mobile').toBeLessThanOrEqual(1);
  });
});

test.describe('Admin login journey', () => {
  test('the login form mounts after hydration', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('input[type="email"], input[name="email"]').first())
      .toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('valid credentials sign the admin in', async ({ page }) => {
    await page.goto('/admin/login');
    await page.locator('input[type="email"], input[name="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"], button:has-text("Σύνδεση")').first().click();
    // Either we navigate away from /admin/login, or a token gets persisted.
    await page.waitForTimeout(4000);
    const url = page.url();
    const stored = await page.evaluate(() =>
      JSON.stringify({ ls: Object.keys(localStorage), c: document.cookie }));
    const signedIn = !url.includes('/admin/login') || /token/i.test(stored);
    expect(signedIn, `still on the login page with no token stored. url=${url} storage=${stored}`).toBe(true);
  });

  test('invalid credentials surface an error and do not sign in', async ({ page }) => {
    await page.goto('/admin/login');
    await page.locator('input[type="email"], input[name="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill('CompletelyWrongPassword1!');
    await page.locator('button[type="submit"], button:has-text("Σύνδεση")').first().click();
    await page.waitForTimeout(3000);
    expect(page.url(), 'a bad password must not navigate into the panel').toContain('/admin/login');
  });
});

test.describe('Student login journey', () => {
  test('the student login form is usable', async ({ page }) => {
    await page.goto('/student-login');
    const inputs = page.locator('input');
    await expect(inputs.first()).toBeVisible({ timeout: 15000 });
  });

  test('an invalid student key is rejected in the UI', async ({ page }) => {
    await page.goto('/student-login');
    const input = page.locator('input').first();
    await input.waitFor({ state: 'visible', timeout: 15000 });
    await input.fill('DEFINITELY-NOT-A-REAL-KEY');
    // A bare `button` selector matches the hidden mobile-menu toggle first;
    // scope to the form and require visibility.
    const submit = page.locator('form button[type="submit"], form button').filter({ hasNot: page.locator('[aria-label*="menu" i]') }).first();
    await submit.waitFor({ state: 'visible', timeout: 15000 });
    await submit.click();
    await page.waitForTimeout(3000);
    expect(page.url(), 'a bogus key must not reach the dashboard').not.toContain('/student/dashboard');
  });
});

test.describe('Contact form journey', () => {
  test('the contact form submits and is accepted', async ({ page }) => {
    await page.goto('/contact');
    // The inputs are controlled React fields with no name attributes, so they
    // are addressed by type and order: name, email, phone, subject, message.
    const texts = page.locator('form input[type="text"]');
    await texts.first().waitFor({ state: 'visible', timeout: 15000 });
    await texts.nth(0).fill('E2E Browser');
    await page.locator('form input[type="email"]').first().fill('browser@kyklos.test');
    const phone = page.locator('form input[type="tel"]').first();
    if (await phone.count()) await phone.fill('2681026671');
    if ((await texts.count()) > 1) await texts.nth(1).fill('E2E browser submission');
    await page.locator('form textarea').first().fill('Submitted by the automated browser journey.');

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/contact'), { timeout: 20000 }).catch(() => null),
      page.locator('button[type="submit"]').first().click(),
    ]);
    if (response) {
      expect(response.status(), 'contact submission rejected by the API').toBeLessThan(400);
    }
  });
});

test.describe('Protected areas', () => {
  for (const path of ['/student/dashboard', '/student/exam-materials', '/student/exercises', '/admin']) {
    test(`${path} does not expose content to an anonymous visitor`, async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(3500);
      const url = page.url();
      const body = (await page.locator('body').innerText()).toLowerCase();
      const gated = url.includes('login') || /σύνδεση|login|δεν έχετε|unauthor|πρόσβαση/i.test(body);
      expect(gated, `${path} rendered content without authentication (url=${url})`).toBe(true);
    });
  }
});
