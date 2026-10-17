const { test, expect } = require('@playwright/test');
const { clearRoom } = require('../mobile/lib/clear-room');

// A clear room needs this page's camera on too (clearRoom).
test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['camera', 'microphone'] });

// 0.9.23b: Blur for all is a per-person control, so it lives in the tile's
// control window, not on the face. It is offered only on a clear face.
async function boot(page, size) {
  await page.setViewportSize(size || { width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qablur' + Date.now().toString(36) + '&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 3, connected: true }));
  expect(await clearRoom(page, ['qa1', 'qa2', 'qa3'])).toBe(true);
}
const tileOf = (page, name) => page.locator('#feed .tile:not(.me)').filter({ has: page.locator('.name', { hasText: name }) });
async function openWin(page, name, tap) {
  const b = await tileOf(page, name).boundingBox();
  if (tap) {
    // A calm phone's first tap only wakes the screen; then a tap opens.
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(400);
    if (!(await page.locator('#tilewin').isVisible())) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  }
  else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await expect(page.locator('#tilewin')).toBeVisible();
}
const blurBtn = (page) => page.locator('#tilewin .modbar button[data-mod="blur"]');

test('Blur for all is in a clear face\'s control window, never on the face, and it blurs them', async ({ page }) => {
  await boot(page);
  expect(await page.locator('#feed .tile > .blurbox:visible').count()).toBe(0);
  await openWin(page, 'Avery Chen');
  await expect(blurBtn(page)).toBeVisible();
  await expect(blurBtn(page)).toHaveText('Blur for all');
  await blurBtn(page).click();
  await expect(blurBtn(page)).toHaveText('Unblur for all');
  await page.keyboard.press('Escape');
  await expect.poll(() => tileOf(page, 'Avery Chen').locator('video').evaluate((v) => getComputedStyle(v).filter)).toContain('blur');
});

test('Blur for all is not offered on a face that is already blurred by its own choice', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__gifosVideo.setPeerBlurForTest('Sam Okonkwo', 2));
  await openWin(page, 'Sam Okonkwo');
  await expect(blurBtn(page)).toBeHidden();
});

test.describe('phone', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('a phone opens the window with a tap and finds Blur for all there', async ({ page, browserName }) => {
    test.info().annotations.push({ type: 'engine', description: browserName });
    await boot(page, { width: 390, height: 844 });
    await openWin(page, 'Priya Shah', true);
    await expect(blurBtn(page)).toBeVisible();
  });
});
