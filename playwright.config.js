/**
 * @file playwright.config.js
 * @description Playwright e2e teszt konfiguráció.
 * Automatikusan elindítja a backend és frontend szervereket a tesztek futtatása előtt.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'cd backend && npm run start',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'cd frontend && npx vite --port 3002',
      url: 'http://localhost:3002',
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
