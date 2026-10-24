const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// 0.9.24 hotfix (seen on an Android phone on live 0.9.23):
// 1. A solo app (Tip GifOS Creators, #id=, no meeting) said "Still in the
//    call" after every app switch. It may say so only to someone seated in a
//    live meeting with a live mic or camera.
// 2. The solo app bar wrapped to three rows on a ~400 px phone, and Help and
//    Abilities did nothing once the phone quiet (chrome-away) had armed: its
//    wake swallowed the tap. One row now, the rest in a "⋯" menu that works.
// HOTFIX_PREFIX=/versions/0.9.23 runs the same checks on the shipped 0.9.23
// snapshot (they fail there); HOTFIX_SHOTS=<dir> keeps the screenshots.
const PREFIX = process.env.HOTFIX_PREFIX || '';
const SHOTS = process.env.HOTFIX_SHOTS || '';
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
const JS_SIGNER = () => { window.GIFOS_ED_FORCE_JS = true; };
test.use({
  serviceWorkers: 'block',
  hasTouch: true,
  // The meeting below brings a fake mic and camera (no prompt).
  launchOptions: async ({ browserName }, use) => use(browserName === 'chromium'
    ? { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }
    : browserName === 'firefox'
      ? { firefoxUserPrefs: { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true } }
      : {}),
});

async function hideShow(page) {
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(400);
}

// Sampled at once and for a second: toBeHidden() would wait out the pill's
// own 8 s life and pass on the bug.
function stillSeen(page) {
  return page.evaluate(() => new Promise((done) => {
    const el = document.getElementById('still'); let seen = false; const t0 = performance.now();
    (function tick() {
      if (el && el.classList.contains('on') && el.getClientRects().length > 0) seen = true;
      if (performance.now() - t0 > 1000) done(seen); else requestAnimationFrame(tick);
    })();
  }));
}

async function openSoloTip(page, browserName, viewport) {
  if (browserName === 'webkit') await page.addInitScript(JS_SIGNER);
  await page.addInitScript(() => {
    localStorage.setItem('gifos_name', 'Jordan Lee');
    sessionStorage.setItem('gifos_appeared', '1');
    localStorage.setItem('gifos_relay', 'ws://127.0.0.1:9/never');
  });
  await page.setViewportSize(viewport);
  await page.goto(PREFIX + '/store.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GifOS && GifOS.store && GifOS.store.putFile);
  const b64 = fs.readFileSync(path.join(__dirname, '..', '..', 'apps', 'tip-creators', 'tip-creators.gif')).toString('base64');
  const id = await page.evaluate(async (b64) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const id = 'file_test_tip_' + Date.now().toString(36);
    await GifOS.store.putFile({ id, name: 'tip-creators.gif', bytes: u, kind: 'gif', isApp: true, appId: 'tip-creators', mime: 'image/gif' });
    return id;
  }, b64);
  await page.goto(PREFIX + '/run.html#id=' + id, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.classList.contains('solo-app') && document.getElementById('appgif').getClientRects().length > 0, null, { timeout: 30000 });
  // First run asks for the app's abilities; accept so the bar is in reach.
  const gate = page.locator('.perm-modal button', { hasText: /Confirm/ });
  await gate.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  if (await gate.count()) await gate.first().evaluate((b) => b.click()); // setup, not under test
  await expect(page.locator('.perm-modal')).toHaveCount(0, { timeout: 5000 }).catch(() => {});
}

test('a solo app says nothing about a call after an app switch', async ({ page, browserName }) => {
  await openSoloTip(page, browserName, { width: 390, height: 844 });
  await hideShow(page);
  const first = await stillSeen(page);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'solo-after-appswitch-390x844.png') });
  expect(first).toBe(false);
  await hideShow(page);
  expect(await stillSeen(page)).toBe(false);
});

for (const width of [360, 390, 412]) {
  test('the solo app bar is one row at ' + width + ' px', async ({ page, browserName }) => {
    await openSoloTip(page, browserName, { width, height: 844 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const got = await page.evaluate(() => {
      const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
      const kids = [...document.querySelectorAll('#appbar > *')].filter(shown).filter((el) => getComputedStyle(el).position !== 'absolute')
        .map((el) => el.getBoundingClientRect());
      const bar = document.getElementById('appbar').getBoundingClientRect();
      return {
        kids: kids.length,
        oneRow: kids.length > 0 && Math.max(...kids.map((r) => r.top)) < Math.min(...kids.map((r) => r.bottom)),
        inside: kids.every((r) => r.left >= -1 && r.right <= innerWidth + 1),
        barH: Math.round(bar.height),
        name: document.getElementById('appname').textContent,
      };
    });
    if (SHOTS && width === 390) await page.screenshot({ path: path.join(SHOTS, 'solo-bar-390x844.png') });
    expect(got.kids).toBeGreaterThanOrEqual(3);
    expect(got.oneRow).toBe(true);
    expect(got.inside).toBe(true);
    expect(got.barH).toBeLessThanOrEqual(60);
  });
}

test('Help and Abilities open from the solo bar after the phone quiet arms', async ({ page, browserName }) => {
  await openSoloTip(page, browserName, { width: 390, height: 844 });
  // The phone quiet arms 3 s after the last touch; its wake used to eat the tap.
  await page.waitForFunction(() => document.body.classList.contains('chrome-away'), null, { timeout: 10000 });
  const reach = async (sel) => {
    if (!(await page.locator(sel).isVisible()) && (await page.locator('#appmore').isVisible())) {
      await page.locator('#appmore').tap();
      if (SHOTS && sel === '#apphelp') await page.screenshot({ path: path.join(SHOTS, 'solo-menu-390x844.png') });
    }
    await page.locator(sel).tap();
  };
  await reach('#apphelp');
  await expect(page.locator('#apphelp-modal')).toBeVisible();
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'solo-help-390x844.png') });
  await page.locator('#apphelp-close').tap();
  await expect(page.locator('#apphelp-modal')).toBeHidden();
  await page.waitForFunction(() => document.body.classList.contains('chrome-away'), null, { timeout: 10000 });
  await reach('#appperms');
  await expect(page.locator('.perm-modal').first()).toBeVisible();
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'solo-abilities-390x844.png') });
});

// A live meeting keeps the reassurance, and leaving ends it.
test.describe('a meeting', () => {
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
  test('a live meeting says "Still in the call" after an app switch, and not after leaving', async ({ page, browserName }) => {
    if (browserName === 'webkit') await page.addInitScript(FAKE_CAMERA);
    await page.addInitScript(() => {
      localStorage.setItem('gifos_name', 'Jordan Lee');
      sessionStorage.setItem('gifos_appeared', '1');
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PREFIX + '/run.html#v=' + RUN_ROOM + 'qahotfix&debug=on', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#leavebtn', { state: 'attached' });
    await page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.liveTracksForTest && window.__gifosVideo.liveTracksForTest() > 0, null, { timeout: 15000 });
    await hideShow(page);
    await expect(page.locator('#still')).toHaveText('Still in the call');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'meeting-after-appswitch-390x844.png') });
    await page.locator('#still').click();
    await expect(page.locator('#still')).toBeHidden();
    await page.evaluate(() => window.__gifosVideo.leaveForTest ? window.__gifosVideo.leaveForTest() : null);
    await page.waitForFunction(() => window.__gifosVideo.liveTracksForTest() === 0, null, { timeout: 10000 });
    await hideShow(page);
    expect(await stillSeen(page)).toBe(false);
  });
});
