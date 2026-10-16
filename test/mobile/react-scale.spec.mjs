import { test, expect } from '@playwright/test';

async function openReactions(page) {
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('#leavebtn').waitFor({ state: 'visible' });
  const cancel = page.locator('#nmcancel');
  try {
    await cancel.waitFor({ state: 'visible', timeout: 2000 });
    await cancel.evaluate((el) => el.click());
  } catch { /* stored name */ }
  await page.locator('#reactbtn').evaluate((el) => el.click());
  await page.locator('#reacttray').waitFor({ state: 'visible' });
}

test('reaction labels grow with the root text size and stay on screen', async ({ page }) => {
  await openReactions(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  const box = await page.evaluate(() => {
    const btn = document.querySelector('#reacttray button[data-burst="Clap"]');
    const tray = document.getElementById('reacttray').getBoundingClientRect();
    return {
      font: parseFloat(getComputedStyle(btn).fontSize),
      height: btn.getBoundingClientRect().height,
      top: tray.top,
      bottom: tray.bottom,
      left: tray.left,
      right: tray.right,
      vw: innerWidth,
      vh: innerHeight,
    };
  });
  expect(box.font).toBeGreaterThanOrEqual(32);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.bottom).toBeLessThanOrEqual(box.vh + 0.5);
  expect(box.left).toBeGreaterThanOrEqual(-0.5);
  expect(box.right).toBeLessThanOrEqual(box.vw + 0.5);
});

test('reaction labels stay on screen in a short landscape', async ({ page }) => {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: Math.max(vp.width, vp.height), height: Math.min(vp.width, vp.height) });
  await openReactions(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  const box = await page.evaluate(() => {
    const tray = document.getElementById('reacttray').getBoundingClientRect();
    return { top: tray.top, bottom: tray.bottom, left: tray.left, right: tray.right, vw: innerWidth, vh: innerHeight };
  });
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.bottom).toBeLessThanOrEqual(box.vh + 0.5);
  expect(box.left).toBeGreaterThanOrEqual(-0.5);
  expect(box.right).toBeLessThanOrEqual(box.vw + 0.5);
});
