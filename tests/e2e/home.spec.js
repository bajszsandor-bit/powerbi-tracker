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

  await expect(page.locator('.app-header__title')).toContainText('Power BI Learning Tracker');

  expect(consoleErrors).toHaveLength(0);
});

test('GET /api/health visszaad { status: "ok" }', async ({ request }) => {
  const response = await request.get('http://localhost:3001/api/health');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body).toEqual({ status: 'ok' });
});

test('GET /api/check-ytdlp válaszol és tartalmaz installed mezőt', async ({ request }) => {
  const response = await request.get('http://localhost:3001/api/check-ytdlp');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(typeof body.installed).toBe('boolean');
  expect(body.helpUrl).toContain('github.com/yt-dlp');
});

test('GET /api/videos/:id 404-et ad ismeretlen videóra', async ({ request }) => {
  const response = await request.get('http://localhost:3001/api/videos/ismeretlen-id-xyz');
  expect(response.status()).toBe(404);
});

test('GET /api/top10 visszaad { videos, lastUpdated } struktúrát', async ({ request }) => {
  const response = await request.get('http://localhost:3001/api/top10');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(Array.isArray(body.videos)).toBe(true);
  expect('lastUpdated' in body).toBe(true);
  for (const video of body.videos) {
    expect(typeof video.transcriptAvailable).toBe('boolean');
    expect('titleHu' in video).toBe(true);
  }
});

test('főoldal toolbar megjelenik (szűrő és frissítés gomb)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.filter-btn').first()).toBeVisible();
  await expect(page.locator('.refresh-btn')).toBeVisible();
});

test('DAX szűrő toggle működik', async ({ page }) => {
  await page.goto('/');
  // Csak DAX videók szűrő megjelenik és kattintható
  const daxBtn = page.locator('.filter-btn', { hasText: 'Csak DAX videók' });
  await expect(daxBtn).toBeVisible();
  await daxBtn.click();
  await expect(daxBtn).toHaveClass(/filter-btn--active/);
  // Vissza az összesre
  const allBtn = page.locator('.filter-btn', { hasText: 'Összes' });
  await allBtn.click();
  await expect(allBtn).toHaveClass(/filter-btn--active/);
});

test('/video/ismeretlen-id 404 oldalt jelenít meg a frontenden', async ({ page }) => {
  await page.goto('/video/ismeretlen-id-xyz');
  await expect(page.locator('.detail-state')).toBeVisible();
  await expect(page.locator('.back-link')).toBeVisible();
});

test('header cím kattintható és visszavisz a főoldalra', async ({ page }) => {
  await page.goto('/video/ismeretlen-id-xyz');
  await page.locator('.app-header__title').click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('h1, .app-header__title')).toBeVisible();
});
