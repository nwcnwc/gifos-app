import { test, expect } from '@playwright/test';

// iPhone SE landscape used to open More with the sheet top at about -8px
// and overflow visible, so the top row could not be scrolled back.

async function openMore(page, landscape) {
  if (landscape) {
    const vp = page.viewportSize();
    await page.setViewportSize({ width: Math.max(vp.width, vp.height), height: Math.min(vp.width, vp.height) });
  }
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('#leavebtn').waitFor({ state: 'visible' });
  const cancel = page.locator('#nmcancel');
  try {
    await cancel.waitFor({ state: 'visible', timeout: 2000 });
    await cancel.evaluate((el) => el.click());
  } catch { /* a stored name skips the picker */ }
  await page.locator('#bartoggle').evaluate((el) => el.click());
  await page.locator('#barmore').waitFor({ state: 'visible' });
}

async function sheetBox(page) {
  return page.locator('#barmore').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      vw: innerWidth,
      vh: innerHeight,
    };
  });
}

test('More sheet stays inside the screen in landscape', async ({ page }) => {
  await openMore(page, true);
  const box = await sheetBox(page);
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.bottom).toBeLessThanOrEqual(box.vh + 0.5);
  expect(box.left).toBeGreaterThanOrEqual(-0.5);
  expect(box.right).toBeLessThanOrEqual(box.vw + 0.5);
  const blur = page.locator('.blurlbl');
  await blur.scrollIntoViewIfNeeded();
  const row = await blur.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const sheet = document.getElementById('barmore').getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, sheetTop: sheet.top, sheetBottom: sheet.bottom, vh: innerHeight };
  });
  expect(row.top).toBeGreaterThanOrEqual(-0.5);
  expect(row.bottom).toBeLessThanOrEqual(row.vh + 0.5);
  expect(row.top).toBeGreaterThanOrEqual(row.sheetTop - 1);
});

test('More labels grow with the root text size', async ({ page }) => {
  await openMore(page, false);
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  const box = await page.evaluate(() => {
    const btn = document.getElementById('invite');
    const blur = document.querySelector('.blurlbl');
    const sheet = document.getElementById('barmore').getBoundingClientRect();
    return {
      font: parseFloat(getComputedStyle(btn).fontSize),
      blur: parseFloat(getComputedStyle(blur).fontSize),
      top: sheet.top,
      bottom: sheet.bottom,
      vh: innerHeight,
    };
  });
  expect(box.font).toBeGreaterThanOrEqual(32);
  expect(box.blur).toBeGreaterThanOrEqual(28);
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.bottom).toBeLessThanOrEqual(box.vh + 0.5);
});
