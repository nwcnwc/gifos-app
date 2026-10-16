import { test, expect } from '@playwright/test';

// Low vision: a 32px root font (about 200%). Lobby actions already use rem.
// The in-call status line was 17px on a phone and 20px on a wide layout.

test('the status line grows with the root text size', async ({ page }) => {
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('#status').waitFor({ state: 'visible' });
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  const box = await page.evaluate(() => {
    const el = document.getElementById('status');
    const title = document.querySelector('.topchip .title');
    const chip = document.querySelector('.topchip').getBoundingClientRect();
    const fit = document.getElementById('fitbtn').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      font: parseFloat(getComputedStyle(el).fontSize),
      title: parseFloat(getComputedStyle(title).fontSize),
      top: chip.top,
      bottom: chip.bottom,
      left: chip.left,
      right: chip.right,
      textTop: r.top,
      textBottom: r.bottom,
      fitTop: fit.top,
      vw: innerWidth,
      vh: innerHeight,
    };
  });
  expect(box.font).toBeGreaterThanOrEqual(32);
  expect(box.title).toBeGreaterThanOrEqual(32);
  expect(box.fitTop).toBeGreaterThanOrEqual(box.bottom - 1);
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.bottom).toBeLessThanOrEqual(box.vh + 0.5);
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(box.vw + 0.5);
  expect(box.textBottom).toBeLessThanOrEqual(box.vh + 0.5);
});
