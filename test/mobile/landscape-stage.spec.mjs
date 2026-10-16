import { test, expect } from '@playwright/test';

async function dismissName(page) {
  const cancel = page.locator('#nmcancel');
  try {
    await cancel.waitFor({ state: 'visible', timeout: 2000 });
    await cancel.evaluate((el) => el.click());
  } catch { /* stored name */ }
}

async function rotated(page) {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: Math.max(vp.width, vp.height), height: Math.min(vp.width, vp.height) });
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await page.locator('.tile.me').waitFor({ state: 'visible' });
  await dismissName(page);
}

test('a rotated meeting is the face until you tap', async ({ page }) => {
  await rotated(page);
  const away = await page.evaluate(() => {
    const me = document.querySelector('.tile.me').getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const two = GifOS.meetLayout.layoutFor({
      w: innerWidth,
      h: innerHeight,
      mode: 'gallery',
      tiles: [{ id: 'ada' }, { id: 'me', me: true }],
    });
    const ada = (two.rects || []).find((r) => r.id === 'ada');
    return {
      klass: document.body.classList.contains('chrome-away'),
      meTop: me.top,
      meBottom: me.bottom,
      meH: me.height,
      barTop: bar.top,
      ada,
      vh: innerHeight,
    };
  });
  expect(away.klass).toBe(true);
  expect(away.meTop).toBeLessThanOrEqual(8);
  expect(away.meBottom).toBeGreaterThanOrEqual(away.vh - 2);
  expect(away.meH).toBeGreaterThanOrEqual(away.vh * 0.75);
  expect(away.barTop).toBeGreaterThanOrEqual(away.vh - 1);
  expect(away.ada).toBeTruthy();
  expect(away.ada.h).toBeGreaterThanOrEqual(away.vh * 0.7);
  expect(away.ada.y + away.ada.h).toBeGreaterThanOrEqual(away.vh - 8);

  await page.locator('.tile.me').click({ position: { x: 24, y: 36 } });
  await page.waitForFunction(() => !document.body.classList.contains('chrome-away'));
  const shown = await page.evaluate(() => {
    const me = document.querySelector('.tile.me').getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const leave = document.getElementById('leavebtn');
    const r = leave.getBoundingClientRect();
    const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    return {
      meBottom: me.bottom,
      barTop: bar.top,
      barH: bar.height,
      leaveH: r.height,
      hit: !!(hit && (hit.id === 'leavebtn' || leave.contains(hit))),
      vh: innerHeight,
    };
  });
  expect(shown.barH).toBeLessThanOrEqual(56);
  expect(shown.meBottom).toBeLessThanOrEqual(shown.barTop + 1);
  expect(shown.leaveH).toBeGreaterThanOrEqual(44);
  expect(shown.hit).toBe(true);

  await page.waitForFunction(() => document.body.classList.contains('chrome-away'), null, { timeout: 6000 });
  const again = await page.evaluate(() => {
    const me = document.querySelector('.tile.me').getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    return { bottom: me.bottom, barTop: bar.top, vh: innerHeight };
  });
  expect(again.bottom).toBeGreaterThanOrEqual(again.vh - 2);
  expect(again.barTop).toBeGreaterThanOrEqual(again.vh - 1);
});
