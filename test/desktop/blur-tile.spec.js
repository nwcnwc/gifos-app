const { test, expect } = require('@playwright/test');
const { clearRoom } = require('../mobile/lib/clear-room');

// A clear room needs this page's camera on too (clearRoom).
// Each engine takes a fake camera its own way: Firefox and WebKit refuse the
// 'camera' permission name, Firefox wants prefs (as self-blur/lobby-ears do).
const FF_PREFS = { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true, 'media.autoplay.default': 0 };
test.use({
  launchOptions: [async ({ browserName }, use) => use(browserName === 'firefox' ? { firefoxUserPrefs: FF_PREFS }
    : browserName === 'chromium' ? { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } : {}), { scope: 'worker' }],
  permissions: async ({ browserName }, use) => use(browserName === 'chromium' ? ['camera', 'microphone'] : []),
});

// 0.9.23b: Blur for all is a per-person control, so it lives in the tile's
// control window, not on the face. It is offered only on a clear face.
// Playwright's Linux WebKit has no camera at all (getUserMedia rejects), and
// clearRoom needs this page's camera on: there it films a painted canvas.
function canvasCamera() {
  navigator.mediaDevices.getUserMedia = async (want) => {
    const out = new MediaStream();
    if (want && want.video) {
      const c = document.createElement('canvas'); c.width = 640; c.height = 480;
      const x = c.getContext('2d');
      const paint = () => { x.fillStyle = '#6a8caf'; x.fillRect(0, 0, 640, 480); x.fillStyle = '#f2d6c4'; x.beginPath(); x.arc(320, 220, 110, 0, 7); x.fill(); };
      paint();
      c.captureStream(0).getVideoTracks().forEach((t) => out.addTrack(t));
    }
    if (want && want.audio) {
      const ac = new AudioContext(); const d = ac.createMediaStreamDestination();
      d.stream.getAudioTracks().forEach((t) => out.addTrack(t));
    }
    return out;
  };
}

async function boot(page, size) {
  await page.setViewportSize(size || { width: 1280, height: 720 });
  if (test.info().project.name === 'webkit') await page.addInitScript(canvasCamera);
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
  // Firefox has no mobile emulation (isMobile); a 390px touch window is its phone.
  test.use({ hasTouch: true, isMobile: async ({ browserName }, use) => use(browserName !== 'firefox') });
  test('a phone opens the window with a tap and finds Blur for all there', async ({ page, browserName }) => {
    test.info().annotations.push({ type: 'engine', description: browserName });
    await boot(page, { width: 390, height: 844 });
    await openWin(page, 'Priya Shah', true);
    await expect(blurBtn(page)).toBeVisible();
  });
});
