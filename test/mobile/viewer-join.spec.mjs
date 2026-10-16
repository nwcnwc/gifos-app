import { test, expect } from '@playwright/test';

const AV = '0123456789abcdef0123456789abcdef';
const VIEW = '/run.html#v=sundayservice&av=' + AV + '&bc=1';

test('a church viewer is told they are watching, not appearing on camera', async ({ page }) => {
  await page.goto(VIEW, { waitUntil: 'domcontentloaded' });
  await page.locator('#nm-lead').waitFor({ state: 'visible' });
  await expect(page.locator('#nm-lead')).toHaveText('You stay off camera. A name shows only if you chat.');
  await expect(page.locator('.appear-box h3')).toHaveText('Watching the service');
  await expect(page.locator('#nm-cam-btn')).toBeHidden();
  await expect(page.locator('#nmcancel')).toHaveText('Clear');
  await expect(page.locator('#nmok')).toHaveText('Save');
  await expect(page.locator('#leavebtn')).toHaveAttribute('aria-label', 'Stop watching');
  await expect(page.locator('#bc-link')).toBeHidden();
});

test('a broadcast host lands on the stream without another sheet', async ({ page }) => {
  await page.addInitScript((av) => {
    localStorage.setItem('gifos_vadm_sundayservice.' + av, 'stored-host-key');
  }, AV);
  await page.goto(VIEW, { waitUntil: 'domcontentloaded' });
  await page.locator('#livebadge').waitFor({ state: 'visible' });
  await expect(page.locator('.appear-box')).toHaveCount(0);
  await expect(page.locator('#livebadge-txt')).toHaveText('OFF AIR');
  await expect(page.locator('#leavebtn')).toBeVisible();
  const link = page.locator('#bc-link');
  await expect(link).toBeVisible();
  await expect(link.locator('p')).toHaveText('Friends watch with this link.');
  const url = await page.locator('#bc-link-url').inputValue();
  expect(url).toContain('sundayservice');
  expect(url).toContain('bc=1');
  const copy = page.locator('#bc-link-copy');
  await expect(copy).toHaveText('Copy');
  const place = await page.evaluate(() => {
    const card = document.getElementById('bc-link').getBoundingClientRect();
    const badge = document.getElementById('livebadge').getBoundingClientRect();
    const btn = document.getElementById('bc-link-copy').getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    return {
      cardTop: card.top,
      badgeBottom: badge.bottom,
      btnH: btn.height,
      btnBottom: btn.bottom,
      barTop: bar.top,
      vh: innerHeight,
    };
  });
  expect(place.cardTop).toBeGreaterThanOrEqual(place.badgeBottom - 1);
  expect(place.btnH).toBeGreaterThanOrEqual(44);
  expect(place.btnBottom).toBeLessThanOrEqual(place.vh + 0.5);
  expect(place.btnBottom).toBeLessThanOrEqual(place.barTop + 1);
  await copy.click();
  await expect(copy).toHaveText('Copied');
});

test('the stream link stays between the title and the dock on a short landscape', async ({ page }) => {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: Math.max(vp.width, vp.height), height: Math.min(vp.width, vp.height) });
  await page.addInitScript((av) => {
    localStorage.setItem('gifos_vadm_sundayservice.' + av, 'stored-host-key');
  }, AV);
  await page.goto(VIEW, { waitUntil: 'domcontentloaded' });
  await page.locator('#bc-link.on').waitFor({ state: 'visible' });
  const place = await page.evaluate(() => {
    const card = document.getElementById('bc-link').getBoundingClientRect();
    const chip = document.querySelector('.topchip').getBoundingClientRect();
    const btn = document.getElementById('bc-link-copy').getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    return { cardTop: card.top, chipBottom: chip.bottom, btnBottom: btn.bottom, btnH: btn.height, barTop: bar.top };
  });
  expect(place.cardTop).toBeGreaterThanOrEqual(place.chipBottom - 1);
  expect(place.btnH).toBeGreaterThanOrEqual(44);
  expect(place.btnBottom).toBeLessThanOrEqual(place.barTop + 1);
});
