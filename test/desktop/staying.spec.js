const { test, expect } = require('@playwright/test');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
// "Still in the call" is said only to someone who can be heard or seen
// (0.9.24 hotfix), so this meeting brings a fake mic and camera.
test.use({
  launchOptions: async ({ browserName }, use) => use(browserName === 'chromium'
    ? { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }
    : browserName === 'firefox'
      ? { firefoxUserPrefs: { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true } }
      : {}),
});

// Playwright WebKit has no capture devices here: hand it a canvas camera.
const FAKE_CAMERA = () => {
  const real = navigator.mediaDevices && navigator.mediaDevices.getUserMedia && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  if (!navigator.mediaDevices) return;
  navigator.mediaDevices.getUserMedia = async (c) => {
    try { if (real) return await real(c); } catch (e) {}
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 240;
    const g = cv.getContext('2d'); let n = 0;
    setInterval(() => { g.fillStyle = 'hsl(' + (n++ % 360) + ',60%,50%)'; g.fillRect(0, 0, 320, 240); }, 100);
    return cv.captureStream(10);
  };
};

async function boot(page, browserName) {
  if (browserName === 'webkit') await page.addInitScript(FAKE_CAMERA);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
  });
  await page.goto('/run.html#v=' + RUN_ROOM + 'qastay&debug=on', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#leavebtn', { state: 'visible' });
  await page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.liveTracksForTest && window.__gifosVideo.liveTracksForTest() > 0, null, { timeout: 15000 });
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, connected: true }));
  expect(seeded && seeded.ok).toBe(true);
}

test('a friend who steps away is readable, and coming back says you are still in the call', async ({ page, browserName }) => {
  await boot(page, browserName);
  await expect(page.locator('.awaymark')).toHaveCount(0);
  await expect(page.locator('#still')).toBeHidden();

  const marked = await page.evaluate(() => window.__gifosVideo.markPeerAwayForTest('Avery Chen', true));
  expect(marked && marked.ok).toBe(true);
  const away = page.locator('.tile.away .awaymark');
  await expect(away).toHaveText('Away');
  const fit = await page.evaluate(() => {
    const mark = document.querySelector('.tile.away .awaymark');
    const tile = mark.closest('.tile');
    const name = tile.querySelector('.name');
    const dock = document.querySelector('.bar').getBoundingClientRect();
    const mb = mark.getBoundingClientRect();
    const tb = tile.getBoundingClientRect();
    const nb = name.getBoundingClientRect();
    const overlap = (a, b) => a.bottom > b.top + 4 && a.top < b.bottom - 4 && a.right > b.left + 4 && a.left < b.right - 4;
    return {
      font: parseFloat(getComputedStyle(mark).fontSize),
      inside: mb.left >= tb.left - 1 && mb.right <= tb.right + 1 && mb.top >= tb.top - 1 && mb.bottom <= tb.bottom + 1,
      coversName: overlap(mb, nb),
      coversDock: overlap(mb, dock),
      onScreen: mb.left >= -1 && mb.top >= -1 && mb.right <= window.innerWidth + 1 && mb.bottom <= window.innerHeight + 1,
      clipped: mark.scrollWidth > mark.clientWidth + 1,
    };
  });
  expect(fit.font).toBeGreaterThanOrEqual(20);
  expect(fit.inside).toBe(true);
  expect(fit.coversName).toBe(false);
  expect(fit.coversDock).toBe(false);
  expect(fit.onScreen).toBe(true);
  expect(fit.clipped).toBe(false);

  const cleared = await page.evaluate(() => window.__gifosVideo.markPeerAwayForTest('Avery Chen', false));
  expect(cleared && cleared.ok && cleared.away === false).toBe(true);
  await expect(page.locator('.awaymark')).toHaveCount(0);

  const hidden = await page.evaluate(() => window.__gifosVideo.setTabHiddenForTest(true));
  expect(hidden && hidden.away).toBe(true);
  await expect(page.locator('#still')).toBeHidden();
  const back = await page.evaluate(() => window.__gifosVideo.setTabHiddenForTest(false));
  expect(back && back.still).toBe(true);
  await expect(page.locator('#still')).toHaveText('Still in the call');
  const pill = await page.evaluate(() => {
    const el = document.getElementById('still');
    const r = el.getBoundingClientRect();
    const dock = document.querySelector('.bar').getBoundingClientRect();
    return {
      font: parseFloat(getComputedStyle(el).fontSize),
      onScreen: r.left >= -1 && r.top >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
      coversDock: r.bottom > dock.top + 4 && r.top < dock.bottom && r.right > dock.left && r.left < dock.right,
      clipped: el.scrollWidth > el.clientWidth + 1,
    };
  });
  expect(pill.font).toBeGreaterThanOrEqual(18);
  expect(pill.onScreen).toBe(true);
  expect(pill.coversDock).toBe(false);
  expect(pill.clipped).toBe(false);
  await page.click('#still');
  await expect(page.locator('#still')).toBeHidden();
});
