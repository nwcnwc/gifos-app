import { test, expect } from '@playwright/test';

const AV = '0123456789abcdef0123456789abcdef';
const ROOM = 'sundaymorning';
const viewer = `/run.html#v=${ROOM}&av=${AV}&bc=1`;

test('a broadcast viewer sees RECONNECTING until the room is reached', async ({ page }) => {
  await page.goto(viewer, { waitUntil: 'domcontentloaded' });
  const badge = page.locator('#livebadge');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute('data-state', 'reconnecting');
  await expect(page.locator('#livebadge-txt')).toHaveText('RECONNECTING');
  const box = await badge.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, height: r.height, vw: innerWidth };
  });
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(box.vw + 0.5);
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.height).toBeGreaterThanOrEqual(20);
});

test('a broadcast host who is not sending a picture reads OFF AIR', async ({ page }) => {
  await page.addInitScript(({ room, av }) => {
    localStorage.setItem('gifos_vadm_' + room + '.' + av, 'test-admin-key');
  }, { room: ROOM, av: AV });
  await page.goto(viewer, { waitUntil: 'domcontentloaded' });
  const badge = page.locator('#livebadge');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute('data-state', 'off');
  await expect(page.locator('#livebadge-txt')).toHaveText('OFF AIR');
});

test('a meeting does not wear the broadcast badge', async ({ page }) => {
  await page.goto('/run.html#v=sundayroom', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#livebadge')).toBeHidden();
});

test('the broadcast state is a banner above the status sentence', async ({ page }) => {
  await page.addInitScript(({ room, av }) => {
    localStorage.setItem('gifos_vadm_' + room + '.' + av, 'test-admin-key');
  }, { room: ROOM, av: AV });
  await page.goto(viewer, { waitUntil: 'domcontentloaded' });
  const badge = page.locator('#livebadge');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute('data-state', 'off');
  const box = await page.evaluate(() => {
    const badgeEl = document.getElementById('livebadge');
    const chip = document.querySelector('.topchip').getBoundingClientRect();
    const status = document.getElementById('status');
    const fit = document.getElementById('fitbtn').getBoundingClientRect();
    const b = badgeEl.getBoundingClientRect();
    return {
      width: b.width,
      height: b.height,
      top: b.top,
      bottom: b.bottom,
      left: b.left,
      right: b.right,
      font: parseFloat(getComputedStyle(badgeEl).fontSize),
      statusFont: parseFloat(getComputedStyle(status).fontSize),
      chipTop: chip.top,
      chipBottom: chip.bottom,
      fitTop: fit.top,
      vw: innerWidth,
      vh: innerHeight,
    };
  });
  expect(box.width).toBeGreaterThanOrEqual(box.vw * 0.9);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.font).toBeGreaterThanOrEqual(box.statusFont);
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.bottom).toBeLessThanOrEqual(box.chipTop + 1);
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(box.vw + 0.5);
  expect(box.fitTop).toBeGreaterThanOrEqual(box.chipBottom - 1);
  expect(box.chipBottom).toBeLessThanOrEqual(box.vh);
});
