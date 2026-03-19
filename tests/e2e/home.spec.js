/**
 * @file home.spec.js
 * @description E2e smoke teszt – a főoldal betölt és nem dob böngészőhibát.
 */

import { test, expect } from '@playwright/test';

test('főoldal betölt és a cím megjelenik', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('/');

  await expect(page).toHaveTitle(/Power BI/);

  await expect(page.locator('h1')).toContainText('Power BI Learning Tracker');

  expect(consoleErrors).toHaveLength(0);
});

test('GET /api/health visszaad { status: "ok" }', async ({ request }) => {
  const response = await request.get('http://localhost:3001/api/health');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body).toEqual({ status: 'ok' });
});
