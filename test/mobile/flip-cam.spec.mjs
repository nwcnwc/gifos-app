import { test, expect } from '@playwright/test';

async function dismissName(page) {
  const cancel = page.locator('#nmok');
  try {
    await cancel.waitFor({ state: 'visible', timeout: 2000 });
    await cancel.evaluate((el) => el.click());
  } catch { /* stored name */ }
}

test('a phone meeting shows Flip on the dock', async ({ page }) => {
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('#leavebtn').waitFor({ state: 'visible' });
  await dismissName(page);
  const flip = page.locator('#flipcam');
  await expect(flip).toBeVisible();
  const box = await flip.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height, vw: innerWidth, vh: innerHeight };
  });
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(box.vw + 0.5);
  expect(box.bottom).toBeLessThanOrEqual(box.vh + 0.5);
});

test('Flip stays on the dock in landscape', async ({ page }) => {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: Math.max(vp.width, vp.height), height: Math.min(vp.width, vp.height) });
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('#leavebtn').waitFor({ state: 'visible' });
  await dismissName(page);
  await page.evaluate(() => window.__meetChromeShow && window.__meetChromeShow());
  const box = await page.locator('#flipcam').evaluate((el) => {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return { display: style.display, left: r.left, right: r.right, width: r.width, height: r.height, vw: innerWidth, vh: innerHeight };
  });
  expect(box.display).not.toBe('none');
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(box.vw + 0.5);
});

test('a broadcast viewer does not get Flip', async ({ page }) => {
  await page.goto('/run.html#v=sundaymorning&av=0123456789abcdef0123456789abcdef&bc=1', { waitUntil: 'domcontentloaded' });
  await page.locator('body.broadcast.notadmin').waitFor();
  const shown = await page.locator('#flipcam').evaluate((el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0);
  expect(shown).toBe(false);
});
