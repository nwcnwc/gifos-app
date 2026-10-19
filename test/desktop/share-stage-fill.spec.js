const { test, expect } = require('@playwright/test');
const path = require('path');

// A share fills the left side (share-seat). A local self-view pin puts your
// own tile on your own stage; it must not shrink that share into a side box.
test.use({
  launchOptions: { args: ['--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

const SHOT = process.env.SHOT || 'run';
const EVID = process.env.EVID || path.join(__dirname, '..', '..', 'evidence-local');

async function boot(page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Maya Chen');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=qasharefill' + Date.now().toString(36) + '&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 4, connected: true }));
  expect(seeded && seeded.ok).toBe(true);
}

function readSeat() {
  const box = (el) => {
    if (!el || !el.getClientRects().length) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom };
  };
  const share = box(document.querySelector('#stagefeed [data-row="sgs"]'));
  const me = box(document.querySelector('#feed .tile.me'));
  const pressed = (window.__meetSwapSelf || (window.__meetSelf && window.__meetSelf.onStage)) ? 'true' : 'false';
  return { share, me, pressed, vw: innerWidth, vh: innerHeight };
}

// Skip before the browser launches. An in-test skip still starts WebKit
// with --disable-gpu (chat-options does the skip at describe scope).
test.describe('chromium only', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'canvas captureStream');
test('a share still fills the left when your own tile is pinned on your stage', async ({ page, browserName }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__meetSwapSelf = true;
    if (window.__meetSelf) window.__meetSelf.onStage = true;
    if (typeof window.__meetRelayout === 'function') window.__meetRelayout();
  });
  await expect.poll(() => page.evaluate(() => (window.__meetSwapSelf || (window.__meetSelf && window.__meetSelf.onStage)) ? 'true' : 'false')).toBe('true');
  await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1280;
    c.height = 720;
    const x = c.getContext('2d');
    x.fillStyle = '#11cc44';
    x.fillRect(0, 0, 1280, 720);
    const stream = c.captureStream(8);
    window.__gifosVideo.remoteShareForTest(['qa1'], stream);
  });
  await page.waitForFunction(() => {
    const v = document.querySelector('#stagefeed [data-row="sgs"] video');
    return !!(v && v.videoWidth > 0);
  });
  await expect.poll(() => page.evaluate(readSeat)).toMatchObject({ pressed: 'true' });
  const seat = await page.evaluate(readSeat);
  await page.screenshot({ path: path.join(EVID, 'share-' + SHOT + '.png') });
  expect(seat.share, JSON.stringify(seat)).toBeTruthy();
  expect(seat.me, JSON.stringify(seat)).toBeTruthy();
  expect(seat.share.x, JSON.stringify(seat)).toBeLessThanOrEqual(8);
  // Sideways, the share is the left side: most of the width.
  expect(seat.share.w, JSON.stringify(seat)).toBeGreaterThanOrEqual(seat.vw * 0.6);
  // Your tile stays with the people, to the right of the share.
  expect(seat.me.x, JSON.stringify(seat)).toBeGreaterThanOrEqual(seat.share.r - 1);
  expect(seat.me.w, JSON.stringify(seat)).toBeGreaterThan(40);
});
});
