import { test, expect } from '@playwright/test';

async function dismissName(page) {
  const cancel = page.locator('#nmcancel');
  try {
    await cancel.waitFor({ state: 'visible', timeout: 2000 });
    await cancel.evaluate((el) => el.click());
  } catch { /* stored name */ }
}

test('a rotated meeting keeps the face above the dock', async ({ page }) => {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: Math.max(vp.width, vp.height), height: Math.min(vp.width, vp.height) });
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('.tile.me').waitFor({ state: 'visible' });
  await dismissName(page);
  const box = await page.evaluate(() => {
    const me = document.querySelector('.tile.me').getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const chip = document.querySelector('.topchip').getBoundingClientRect();
    const vb = GifOS.meetLayout.viewBox(innerWidth, innerHeight);
    const two = GifOS.meetLayout.layoutFor({
      w: innerWidth,
      h: innerHeight,
      mode: 'gallery',
      tiles: [{ id: 'ada' }, { id: 'me', me: true }],
    });
    return {
      meTop: me.top,
      meBottom: me.bottom,
      meH: me.height,
      barTop: bar.top,
      barH: bar.height,
      chipBottom: chip.bottom,
      phone: vb.phone,
      boxH: vb.h,
      ada: (two.rects || []).find((r) => r.id === 'ada'),
      vh: innerHeight,
      vw: innerWidth,
    };
  });
  expect(box.phone).toBe(false);
  expect(box.barH).toBeLessThanOrEqual(56);
  expect(box.meTop).toBeGreaterThanOrEqual(box.chipBottom - 1);
  expect(box.meBottom).toBeLessThanOrEqual(box.barTop + 1);
  expect(box.meH).toBeGreaterThanOrEqual(box.vh * 0.45);
  expect(box.ada).toBeTruthy();
  expect(box.ada.y).toBeGreaterThanOrEqual(48);
  expect(box.ada.y + box.ada.h).toBeLessThanOrEqual(box.vh - 64);
  expect(box.ada.h).toBeGreaterThanOrEqual(box.vh * 0.4);
  expect(box.boxH).toBeGreaterThanOrEqual(box.vh * 0.45);
});
