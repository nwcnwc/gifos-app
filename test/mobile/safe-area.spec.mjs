import { test, expect } from '@playwright/test';

// A notched phone reports env(safe-area-inset-*) only when viewport-fit=cover
// is set, and Chromium's emulation leaves those at 0. The page mirrors them
// with --safe-* so a 47px notch and a 34px home indicator can be injected.

async function inCall(page) {
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('#leavebtn').waitFor({ state: 'visible' });
  const cancel = page.locator('#nmcancel');
  try {
    await cancel.waitFor({ state: 'visible', timeout: 2000 });
    await cancel.evaluate((el) => el.click());
  } catch { /* stored name */ }
}

async function applyInsets(page, insets) {
  await page.evaluate((next) => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(next)) root.style.setProperty(key, value);
    window.dispatchEvent(new Event('resize'));
  }, insets);
}

test('viewport asks the phone to cover the notch', async ({ page }) => {
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  const content = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(content).toContain('viewport-fit=cover');
});

test('the chip and the dock clear a notch and a home indicator', async ({ page }) => {
  await inCall(page);
  await applyInsets(page, { '--safe-top': '47px', '--safe-bottom': '34px', '--safe-left': '0px', '--safe-right': '0px' });
  const box = await page.evaluate(() => {
    const chip = document.querySelector('.topchip').getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const fit = document.getElementById('fitbtn').getBoundingClientRect();
    return {
      chipTop: chip.top,
      chipLeft: chip.left,
      chipRight: chip.right,
      barBottom: bar.bottom,
      barLeft: bar.left,
      barRight: bar.right,
      fitTop: fit.top,
      fitRight: fit.right,
      vw: innerWidth,
      vh: innerHeight,
    };
  });
  expect(box.chipTop).toBeGreaterThanOrEqual(14 + 47 - 0.5);
  expect(box.fitTop).toBeGreaterThanOrEqual(58 + 47 - 0.5);
  expect(box.barBottom).toBeLessThanOrEqual(box.vh - 14 - 34 + 0.5);
  expect(box.chipLeft).toBeGreaterThanOrEqual(0);
  expect(box.chipRight).toBeLessThanOrEqual(box.vw + 0.5);
  expect(box.barLeft).toBeGreaterThanOrEqual(-0.5);
  expect(box.barRight).toBeLessThanOrEqual(box.vw + 0.5);
  expect(box.fitRight).toBeLessThanOrEqual(box.vw + 0.5);
});

test('landscape side insets keep the chip and the dock on screen', async ({ page }) => {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: Math.max(vp.width, vp.height), height: Math.min(vp.width, vp.height) });
  await inCall(page);
  await applyInsets(page, { '--safe-top': '0px', '--safe-bottom': '21px', '--safe-left': '47px', '--safe-right': '47px' });
  const box = await page.evaluate(() => {
    const chip = document.querySelector('.topchip').getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    return { chipLeft: chip.left, chipRight: chip.right, barLeft: bar.left, barRight: bar.right, barBottom: bar.bottom, vw: innerWidth, vh: innerHeight };
  });
  expect(box.chipLeft).toBeGreaterThanOrEqual(14 + 47 - 0.5);
  expect(box.chipRight).toBeLessThanOrEqual(box.vw - 47 + 0.5);
  expect(box.barLeft).toBeGreaterThanOrEqual(47 - 0.5);
  expect(box.barRight).toBeLessThanOrEqual(box.vw - 47 + 0.5);
  expect(box.barBottom).toBeLessThanOrEqual(box.vh - 14 - 21 + 0.5);
});

test('chat stays above a dock that has cleared the home indicator', async ({ page }) => {
  await inCall(page);
  await applyInsets(page, { '--safe-top': '47px', '--safe-bottom': '34px', '--safe-left': '0px', '--safe-right': '0px' });
  await page.evaluate(() => document.getElementById('chatpanel').classList.add('open'));
  await page.locator('#chat-in').waitFor({ state: 'visible' });
  const g = await page.evaluate(() => {
    const input = document.getElementById('chat-in').getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const panel = document.getElementById('chatpanel').getBoundingClientRect();
    return { inputBottom: input.bottom, barTop: bar.top, panelTop: panel.top };
  });
  expect(g.panelTop).toBeGreaterThanOrEqual(47 - 0.5);
  expect(g.inputBottom).toBeLessThanOrEqual(g.barTop + 1);
});
