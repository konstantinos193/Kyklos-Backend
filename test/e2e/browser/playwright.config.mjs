import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.mjs',
  // Two cores on the host; more workers just thrash.
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_FRONTEND_URL || 'http://frontend:8765',
    headless: true,
    ignoreHTTPSErrors: true,
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
