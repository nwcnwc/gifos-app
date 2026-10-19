/*
 * Picture in picture on a phone (Nathan, 17:00 Oct 18, Android Chrome).
 *
 * A float is for when you are away from the meeting. On a phone it must
 * never leave your own tile black with "Playing in picture-in-picture"
 * while you are looking at the meeting, and a full-screen meeting (which
 * the browser floats as a whole page when you switch apps) must not float
 * one tile on top of that, or the browser's float shows the label and the
 * dock instead of the faces.
 *
 *   1. Float, then a touch on the meeting: the tile plays again.
 *   2. Float floats again after that, and the next touch closes it.
 *   3. Full screen, then switch apps: no tile float is asked for, and the
 *      dock and call buttons leave the picture the browser floats.
 *   4. Back from the other app: the dock comes back.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/phone-pip.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const RELAY = process.env.RELAY || '';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required', '--disable-gpu'],
  });
  const context = await browser.newContext(Object.assign({}, devices['Pixel 7'], { hasTouch: true, permissions: ['camera', 'microphone'] }));
  await context.addInitScript({ content: "try{localStorage.setItem('gifos_name','Nathan');sessionStorage.setItem('gifos_appear_ok','1');"
    + (RELAY ? "localStorage.setItem('gifos_relay','" + RELAY + "');" : '') + "}catch(e){}" });
  // Count every tile float this page asks for.
  await context.addInitScript(() => {
    window.__pipAsks = 0;
    const req = HTMLVideoElement.prototype.requestPictureInPicture;
    if (req) HTMLVideoElement.prototype.requestPictureInPicture = function () { window.__pipAsks++; return req.apply(this, arguments); };
  });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + '/run.html#v=phone-pip-' + Date.now().toString(36) + '&DEBUG=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.evaluate(() => { const c = document.getElementById('cam'); if (c) c.click(); });
  await page.waitForFunction(() => window.__gifosVideo.pip().aimed === 'peer:me', null, { timeout: 15000 });

  const bad = [];
  const state = () => page.evaluate(() => {
    const me = document.querySelector('.tile.me video');
    const bar = document.querySelector('.bar');
    const cs = document.getElementById('callstate');
    const shown = (el) => !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0;
    return {
      floating: !!document.pictureInPictureElement,
      meFloats: !!me && document.pictureInPictureElement === me,
      mePlaying: !!me && !me.paused,
      full: !!document.fullscreenElement,
      dock: shown(bar),
      callstate: shown(cs) && !cs.hidden,
      asks: window.__pipAsks,
      away: document.body.classList.contains('away-full'),
    };
  });
  const wake = async () => { await page.touchscreen.tap(200, 110); await sleep(400); };
  const openMore = async () => {
    await wake();
    if ((await page.locator('#bartoggle').getAttribute('aria-expanded')) !== 'true') await page.locator('#bartoggle').tap({ timeout: 5000 });
    await sleep(400);
  };
  const tapFloat = async () => { await openMore(); await page.locator('#pipbtn').tap({ timeout: 5000 }); await sleep(800); };

  // 1. Float, then touch the meeting.
  await tapFloat();
  const afterFloat = await state();
  if (!afterFloat.meFloats) bad.push('precondition: Float did not float my tile in this Chromium (' + JSON.stringify(afterFloat) + ')');
  await page.touchscreen.tap(200, 110);
  await sleep(800);
  const afterTouch = await state();
  await page.screenshot({ path: path.join(SHOTS, (afterTouch.floating ? 'before' : 'after') + '-phone-pip-touch-pixel-7.png') });
  if (afterTouch.floating) bad.push('a touch on the meeting left my tile floating ("Playing in picture-in-picture")');
  if (!afterTouch.mePlaying) bad.push('my tile is not playing after the float closed');

  // 2. Float floats again after a touch closed it (opening More is a touch).
  if (afterTouch.floating) await page.evaluate(() => document.exitPictureInPicture().catch(() => {}));
  await sleep(300);
  await tapFloat();
  const on2 = await state();
  if (!on2.meFloats) bad.push('Float did not float on the second try');
  await page.touchscreen.tap(200, 110);
  await sleep(600);
  const off2 = await state();
  if (off2.floating) bad.push('the second float did not close on a touch');

  // 3. Full screen, then switch apps.
  if (off2.floating) await page.evaluate(() => document.exitPictureInPicture().catch(() => {}));
  await openMore();
  const fsb = page.locator('#fsbtn');
  if (!(await fsb.isVisible().catch(() => false))) bad.push('Full screen is not in More');
  else await fsb.tap({ timeout: 5000 });
  await page.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 5000 }).catch(() => {});
  await sleep(500);
  const before = await state();
  const asks0 = before.asks;
  if (!before.full) bad.push('precondition: Full screen did not take the page full screen');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(900);
  const away = await state();
  await page.screenshot({ path: path.join(SHOTS, ((away.asks > asks0 || away.dock) ? 'before' : 'after') + '-phone-pip-away-full-pixel-7.png') });
  if (before.full && !away.full) bad.push('switching apps took the page out of full screen');
  if (away.asks > asks0) bad.push('switching apps from full screen asked to float a tile (' + (away.asks - asks0) + ')');
  if (away.meFloats) bad.push('my tile floats inside the full-screen page ("Playing in picture-in-picture")');
  if (away.dock) bad.push('the dock stays in the picture the browser floats');
  if (away.callstate) bad.push('Record and Captions stay in the picture the browser floats');

  // 4. Back.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
  await sleep(600);
  const back = await state();
  if (!back.dock) bad.push('the dock did not come back after the other app');
  if (back.floating) bad.push('a float is still up after coming back');
  if (errs.length) bad.push('page errors: ' + errs.join(' | '));

  console.log(JSON.stringify({ afterFloat, afterTouch, on2, off2, away, back }));
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS phone picture in picture');
})().catch((e) => { console.error(e); process.exit(1); });
