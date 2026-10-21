/*
 * LIVE belongs to Broadcast. On a regular meeting it is not on screen.
 * Record and Captions stay on the call, including sideways, and the faces
 * stay above that row upright. Sideways they stand in a column beside the
 * dock (sideways-callstate-beside.js), so there they must clear the dock's
 * side, and the faces fill the screen under them (sideways-tiles.js).
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/live-stands-out.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const PEOPLE = [
  { id: 'peer-ruth', name: 'Ruth' },
  { id: 'peer-david', name: 'David' },
  { id: 'peer-sam', name: 'Sam' },
];

function land(device) {
  const v = device.viewport;
  return Object.assign({}, device, { viewport: { width: v.height, height: v.width } });
}

const PHONES = [
  { name: 'iphone-se', device: devices['iPhone SE'], band: true },
  { name: 'iphone-15', device: devices['iPhone 15'], band: true },
  { name: 'iphone-se-land', device: land(devices['iPhone SE']), band: false },
];

function overlaps(a, b) {
  if (!a || !b || a.h < 2 || b.h < 2) return false;
  return a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  for (const phone of PHONES) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Host'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=sunday-service-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.evaluate((people) => window.__gifosVideo.presentPeers(people), PEOPLE);
    await page.waitForTimeout(450);
    const info = await page.evaluate(() => {
      const box = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          w: b.width, h: b.height, font: parseFloat(cs.fontSize),
          text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
        };
      };
      const tiles = Array.from(document.querySelectorAll('.tile')).map((el) => {
        const b = el.getBoundingClientRect();
        return { bottom: b.bottom, h: b.height, w: b.width, shown: b.width > 8 && b.height > 8 };
      }).filter((t) => t.shown);
      return {
        live: box(document.getElementById('call-live')),
        rec: box(document.getElementById('call-rec')),
        cc: box(document.getElementById('call-cc')),
        state: box(document.getElementById('callstate')),
        more: box(document.getElementById('bartoggle')),
        dock: box(document.querySelector('.bar')),
        status: box(document.getElementById('status')),
        tiles: tiles,
        vh: window.innerHeight,
        vw: window.innerWidth,
      };
    });
    const bad = [];
    const live = info.live;
    if (live && live.h > 1) bad.push('LIVE is on a regular meeting (' + Math.round(live.w) + 'x' + Math.round(live.h) + ')');
    const beside = !!(info.state && info.dock && info.state.right <= info.dock.left + 1);
    if (!phone.band && !beside && info.state && info.state.h > 56) bad.push('sideways state is ' + Math.round(info.state.h) + 'px tall');
    for (const part of [info.rec, info.cc]) {
      if (!part) { bad.push('a state control is missing'); continue; }
      if (part.h < 44 || part.w < 44) bad.push(part.text + ' is ' + Math.round(part.w) + 'x' + Math.round(part.h));
      if (part.top < -1 || part.bottom > info.vh + 1 || part.left < -1 || part.right > info.vw + 1) bad.push(part.text + ' is off screen');
      if (info.dock && (beside ? overlaps(part, info.dock) : part.bottom > info.dock.top + 1)) bad.push(part.text + ' runs into the dock');
    }
    if (info.rec && info.rec.text !== 'Record') bad.push('record says "' + info.rec.text + '"');
    if (info.cc && info.cc.text !== 'Captions') bad.push('captions says "' + info.cc.text + '"');
    // Upright, the faces stop above Record. Sideways, the 16:42 rule (f0390c4,
    // sideways-tiles.js): the faces fill the screen and the dock, Record and
    // Captions float over them.
    if (phone.band && info.state && info.tiles.some((t) => t.bottom > info.state.top + 1)) bad.push('a face runs under Record');
    if (!phone.band && info.dock && info.tiles.length && !info.tiles.some((t) => t.bottom > info.dock.top + 1)) bad.push('dock sits outside the tiles');
    const shot = (bad.length ? 'before' : 'after') + '-live-stands-out-' + phone.name + '.png';
    if (phone.name === 'iphone-se' || phone.name === 'iphone-se-land') {
      await page.screenshot({ path: path.join(SHOTS, shot) });
    }
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    else console.log('PASS', phone.name);
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS live stands out');
})().catch((e) => { console.error(e); process.exit(1); });
