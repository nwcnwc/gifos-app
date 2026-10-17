import { test, expect } from '@playwright/test';

async function openCreate(page) {
  await page.goto('/run.html#bc=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#lobby.show').waitFor();
  await page.locator('#lob-admin-go').waitFor({ state: 'visible' });
}

async function buttonBox(page) {
  return page.locator('#lob-admin-go').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, vw: innerWidth, vh: innerHeight };
  });
}

test('Create & enter stays on screen', async ({ page }) => {
  await openCreate(page);
  const box = await buttonBox(page);
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.bottom).toBeLessThanOrEqual(box.vh + 0.5);
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(box.vw + 0.5);
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test('Create & enter stays on screen in landscape', async ({ page }) => {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: Math.max(vp.width, vp.height), height: Math.min(vp.width, vp.height) });
  await openCreate(page);
  const box = await buttonBox(page);
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.bottom).toBeLessThanOrEqual(box.vh + 0.5);
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test('the room name can still be reached while Create stays put', async ({ page }) => {
  await openCreate(page);
  const name = page.locator('#lob-admin-name');
  await name.scrollIntoViewIfNeeded();
  await expect(name).toBeVisible();
  const box = await buttonBox(page);
  expect(box.bottom).toBeLessThanOrEqual(box.vh + 0.5);
});
