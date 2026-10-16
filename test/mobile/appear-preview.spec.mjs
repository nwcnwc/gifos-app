import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('the join step shows how you will appear and lets you change it', async ({ page }) => {
  const pngPath = '/tmp/appear-face.png';
  writeFileSync(pngPath, Buffer.from(PNG, 'base64'));
  await page.addInitScript((png) => {
    localStorage.setItem('gifos_name', 'Ada Lovelace');
    localStorage.setItem('gifos_avatar', JSON.stringify({
      mime: 'image/png',
      hash: 'a'.repeat(64),
      b64: png,
    }));
  }, PNG);
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#nm-lead')).toContainText(/This is how you.ll appear in the meeting/);
  await expect(page.locator('#nm-preview-name')).toHaveText('Ada Lovelace');
  await expect(page.locator('#nm-avatar')).toBeVisible();
  const face = await page.locator('.appear-face').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
  });
  expect(face.width).toBeGreaterThanOrEqual(44);
  expect(face.height).toBeGreaterThanOrEqual(44);

  await page.locator('#nm').fill('Grace Hopper');
  await expect(page.locator('#nm-preview-name')).toHaveText('Grace Hopper');

  const before = await page.evaluate(() => localStorage.getItem('gifos_avatar'));
  await page.locator('#nm-file').setInputFiles(pngPath);
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('gifos_avatar'))).not.toBe(before);
  await expect(page.locator('#nm-avatar')).toBeVisible();
  const src = await page.locator('#nm-avatar').getAttribute('src');
  expect(src.startsWith('data:image/')).toBe(true);

  const pic = await page.locator('#nm-pic').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
  });
  expect(pic.width).toBeGreaterThanOrEqual(44);
  expect(pic.height).toBeGreaterThanOrEqual(44);
  const cam = await page.locator('#nm-cam-btn').evaluate((el) => el.getBoundingClientRect().height);
  expect(cam).toBeGreaterThanOrEqual(44);
});
