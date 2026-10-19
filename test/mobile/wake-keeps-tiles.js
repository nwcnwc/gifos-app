/*
 * Nathan, on his phone: "it is very annoying that the videos change shape
 * when I touch the screen to get the controls." The call's buttons tuck
 * away after a few quiet seconds; a tap brings them back over the faces.
 * In Scroll the faces were laid out again for the shorter band each time:
 * two guests went from one 298px column to two 191px columns on a tap.
 * Waking the buttons is an overlay only: every face keeps its exact box,
 * right after the tap and once the buttons settle, in Fit and in Scroll,
 * with one guest or twelve, and with you on the stage.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/wake-keeps-tiles.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const ANDROID_390 = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent };
const PHONES = [
  ['android-390', ANDROID_390],
  ['iphone-15', devices['iPhone 15']],
  ['pixel-7-land', Object.assign({}, devices['Pixel 7'], { viewport: { width: devices['Pixel 7'].viewport.height, height: devices['Pixel 7'].viewport.width } })],
];
const ROOMS = [];
for (const guests of [1, 2, 7, 12]) for (const gallery of ['fit', 'scroll']) ROOMS.push({ guests, gallery, stage: false });
ROOMS.push({ guests: 2, gallery: 'fit', stage: true }, { guests: 2, gallery: 'scroll', stage: true });

function boxes(page) {
  return page.evaluate(() => [...document.querySelectorAll('#feed .tile, #feed .stadface, #stagefeed .tile')]
    .filter((t) => t.getClientRects().length && getComputedStyle(t).display !== 'none')
    .map((t) => {
      const r = t.getBoundingClientRect();
      const n = t.querySelector('.name');
      return { key: t.dataset.peer || t.id || (n && n.textContent.trim()) || t.className, x: r.left, y: r.top, w: r.width, h: r.height };
    }));
}

// Stepping on stage lands over a couple of seconds. Wait until no face has
// moved for a full second, so a wake is measured against faces at rest.
async function settled(page) {
  let last = JSON.stringify(await boxes(page));
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(1000);
    const now = JSON.stringify(await boxes(page));
    if (now === last) return true;
    last = now;
  }
  return false;
}

function reshaped(before, after) {
  const out = [];
  const fmt = (b) => [b.x, b.y, b.w, b.h].map((v) => Math.round(v)).join(',');
  for (const b of before) {
    const a = after.find((t) => t.key === b.key);
    if (!a) { out.push(b.key + ' left the screen'); continue; }
    if (Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5 || Math.abs(a.w - b.w) > 0.5 || Math.abs(a.h - b.h) > 0.5) out.push(b.key + ' ' + fmt(b) + ' -> ' + fmt(a));
  }
  for (const a of after) if (!before.find((t) => t.key === a.key)) out.push(a.key + ' appeared');
  return out;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const bad = [];
  let runs = 0;
  for (const [tag, device] of PHONES) {
    for (const room of ROOMS) {
      const name = tag + ' ' + room.guests + ' guest' + (room.guests > 1 ? 's' : '') + ', ' + room.gallery + (room.stage ? ', you on stage' : '');
      const context = await browser.newContext(Object.assign({}, device, { hasTouch: true }));
      await context.addInitScript((g) => {
        try {
          localStorage.setItem('gifos_name', 'Nathan');
          localStorage.setItem('meet.view.v1.gallery', g);
        } catch (e) {}
      }, room.gallery);
      const page = await context.newPage();
      await page.goto(BASE + '/run.html#v=wake-tiles-' + process.pid + '-' + runs + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForSelector('#bartoggle', { timeout: 15000 });
      const skip = page.locator('#nmok');
      if (await skip.count()) await skip.tap().catch(() => {});
      const seeded = await page.evaluate((n) => window.__gifosVideo.seedGalleryForTest({ count: n }), room.guests);
      if (!seeded || !seeded.ok) { bad.push(name + ': could not seat the guests'); await context.close(); continue; }
      if (room.stage && !(await page.evaluate(() => window.__gifosVideo.stageForTest(true)))) { bad.push(name + ': could not step on stage'); await context.close(); continue; }
      // Faces settle with the buttons up, then the buttons tuck (the same
      // call the idle timer makes, so the test does not wait on it).
      if (!(await settled(page))) bad.push(name + ': the faces never came to rest with the buttons up');
      await page.evaluate(() => window.__gifosChrome.idle());
      await page.waitForFunction(() => document.body.classList.contains('chrome-away'), null, { timeout: 3000 }).catch(() => {});
      if (!(await settled(page))) bad.push(name + ': the faces never came to rest with the buttons away');
      const away = await boxes(page);
      if (!(await page.evaluate(() => document.body.classList.contains('chrome-away')))) { bad.push(name + ': the buttons did not tuck away'); await context.close(); continue; }
      const shoot = tag === 'android-390' && room.guests === 2 && room.gallery === 'scroll' && !room.stage;
      if (shoot) await page.screenshot({ path: path.join(SHOTS, 'wake-keeps-tiles-android-390-away.png') });
      // A finger on the middle of the screen, as Nathan wakes them.
      const vp = page.viewportSize();
      await page.touchscreen.tap(Math.round(vp.width / 2), Math.round(vp.height / 2));
      await page.waitForTimeout(60);
      const quick = await boxes(page);
      await page.waitForTimeout(1200);
      const woke = await boxes(page);
      const state = await page.evaluate(() => ({ up: !document.body.classList.contains('chrome-away'), tileWin: !!(window.__tileWin && window.__tileWin.isOpen()) }));
      if (shoot) await page.screenshot({ path: path.join(SHOTS, 'wake-keeps-tiles-android-390-woke.png') });
      runs++;
      if (!away.length) bad.push(name + ': no faces on the screen');
      if (!state.up) bad.push(name + ': the tap did not bring the buttons back');
      if (state.tileWin) bad.push(name + ': the waking tap opened a tile');
      const d1 = reshaped(away, quick), d2 = reshaped(away, woke);
      if (d1.length) bad.push(name + ': right after the tap ' + d1.join('; '));
      if (d2.length) bad.push(name + ': once the buttons settled ' + d2.join('; '));
      await context.close();
    }
  }
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.length + ' problems in ' + runs + ' wakes\n' + bad.join('\n'));
    process.exit(1);
  }
  console.log('PASS ' + runs + ' wakes: every face kept its exact box when a tap brought the buttons back');
})().catch((e) => { console.error(e); process.exit(1); });
