/*
 * Password meeting, camera on, someone else not ready. The header says
 * you are ready for clear video, but No blur snaps back to Min.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/blur-none.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const ROOM = 'clear-ready';

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext(Object.assign({}, devices['Pixel 7'], { hasTouch: true }));
  await context.addInitScript((room) => {
    try {
      localStorage.setItem('gifos_name', 'Nathan');
      localStorage.setItem('gifos_vpw_' + room, 'sunday');
      localStorage.setItem('gifos_vpwat_' + room, String(Date.now()));
    } catch (e) {}
  }, ROOM);
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=' + ROOM, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.waitForFunction(() => {
    const api = window.__gifosVideo;
    return api && api.pwState && api.pwState().pw === 'sunday';
  }, { timeout: 8000 });
  await page.evaluate((people) => {
    const api = window.__gifosVideo;
    api.presentPeers(people);
    // Sam is here and has not consented: camera off, so the room stays at
    // Min blur even after this phone picks No blur.
    api._ghostStatus(people[0].id, 0);
  }, [{ id: 'peer-sam', name: 'Sam' }]);
  await page.waitForFunction(() => {
    const api = window.__gifosVideo;
    api._ghostStatus('peer-sam', 0);
    const dump = api.debugDump();
    const sam = (dump.roster || []).some((row) => row && (row.peer === 'peer-sam' || row.name === 'Sam'));
    return sam && dump.consent === false;
  }, { timeout: 8000 });
  const unmute = page.locator('#unmute');
  if (await unmute.count() && await unmute.isVisible().catch(() => false)) await unmute.tap();
  await page.locator('#cam').tap();
  await page.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.camOff && window.__gifosVideo.camOff() === false, { timeout: 8000 });
  await page.locator('#bartoggle').tap();
  await page.locator('#blur-min').scrollIntoViewIfNeeded();
  await page.locator('#blur-min').tap();
  await page.waitForTimeout(150);
  await page.locator('#blur-none').scrollIntoViewIfNeeded();
  const hit = await page.evaluate(() => {
    const el = document.getElementById('blur-none');
    const b = el.getBoundingClientRect();
    const x = b.left + b.width / 2;
    const y = b.top + b.height / 2;
    const top = document.elementFromPoint(x, y);
    return {
      id: top && (top.id || top.className || top.tagName),
      disabled: el.disabled,
      dis: el.classList.contains('dis'),
      pe: getComputedStyle(el).pointerEvents,
      w: b.width,
      h: b.height,
    };
  });
  await page.locator('#blur-none').tap();
  await page.waitForTimeout(200);
  const info = await page.evaluate(() => {
    const on = (id) => document.getElementById(id).classList.contains('sel');
    const api = window.__gifosVideo;
    return {
      min: on('blur-min'),
      none: on('blur-none'),
      max: on('blur-max'),
      wish: api.myBlur(),
      feed: api.blurClassOf('me'),
      status: document.getElementById('status').textContent,
      pw: api.pwState().pw,
      cam: api.camOff(),
    };
  });
  const bad = [];
  if (info.pw !== 'sunday') bad.push('password not held');
  if (info.cam !== false) bad.push('camera still off');
  if (hit.disabled || hit.dis) bad.push('No blur is disabled');
  if (hit.pe === 'none') bad.push('No blur ignores taps');
  if (hit.w < 44 || hit.h < 44) bad.push('No blur is ' + Math.round(hit.w) + 'x' + Math.round(hit.h));
  if (String(hit.id).indexOf('blur-none') < 0) bad.push('tap lands on ' + hit.id);
  if (info.wish !== 0) bad.push('choice stayed ' + info.wish);
  if (info.status.indexOf('ready for clear video') < 0) bad.push('header "' + info.status + '"');
  if (info.feed !== 1) bad.push('feed blur ' + info.feed + ' (room should stay Min until Sam is ready)');
  if (!info.none || info.min) bad.push('No blur did not stay selected (min ' + info.min + ', none ' + info.none + ')');
  const shot = bad.length ? 'before-blur-none-pixel-7.png' : 'after-blur-none-pixel-7.png';
  await page.screenshot({ path: path.join(SHOTS, shot) });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify({ hit: hit, info: info }));
    process.exit(1);
  }
  console.log('PASS blur none');
})().catch((e) => { console.error(e); process.exit(1); });
