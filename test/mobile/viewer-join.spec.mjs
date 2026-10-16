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
});

test('a broadcast host still sees how they will appear', async ({ page }) => {
  await page.addInitScript((av) => {
    localStorage.setItem('gifos_vadm_sundayservice.' + av, 'stored-host-key');
  }, AV);
  await page.goto(VIEW, { waitUntil: 'domcontentloaded' });
  await page.locator('#nm-lead').waitFor({ state: 'visible' });
  await expect(page.locator('#nm-lead')).toContainText(/This is how you.ll appear in the meeting/);
  await expect(page.locator('#nm-cam-btn')).toBeVisible();
});
