/*
 * Live, Record, Captions, and the dock tuck away when the call is quiet,
 * and a tap on the call brings them back. They start on screen.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chrome-idle.js
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

const PHONES = [
  { name: 'iphone-15', device: devices['iPhone 15'] },
  { name: 'iphone-se', device: devices['iPhone SE'] },
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
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Pat'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=chrome-idle-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmcancel');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.evaluate((people) => window.__gifosVideo.presentPeers(people), PEOPLE);
    await page.waitForTimeout(400);
    const read = () => page.evaluate(() => {
      const box = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          w: b.width, h: b.height,
          pe: cs.pointerEvents, op: cs.opacity, vis: cs.visibility,
          text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
        };
      };
      const tiles = Array.from(document.querySelectorAll('.tile')).map((el) => {
        const b = el.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height, shown: b.width > 8 && b.height > 8 };
      }).filter((t) => t.shown);
      const bar = document.querySelector('.bar');
      const leave = document.getElementById('leavebtn');
      const lb = leave.getBoundingClientRect();
      const hit = document.elementFromPoint(lb.left + lb.width / 2, lb.top + lb.height / 2);
      const lowest = tiles.reduce((m, t) => Math.max(m, t.bottom), 0);
      return {
        away: document.body.classList.contains('chrome-away'),
        moreOpen: bar && !bar.classList.contains('collapsed'),
        tiles: tiles,
        lowest: lowest,
        bar: box(bar),
        live: box(document.getElementById('call-live')),
        rec: box(document.getElementById('call-rec')),
        cc: box(document.getElementById('call-cc')),
        leave: box(leave),
        status: box(document.getElementById('status')),
        leaveHit: !!(hit && (hit.id === 'leavebtn' || (hit.closest && hit.closest('#leavebtn')))),
        vh: window.innerHeight,
        vw: window.innerWidth,
        ms: window.__gifosChrome ? window.__gifosChrome.ms : 0,
      };
    });
    const shown = await read();
    const bad = [];
    if (shown.moreOpen) bad.push('More is open');
    if (!shown.leaveHit) bad.push('Hang up is not tappable at the start');
    if (!shown.live || shown.live.vis === 'hidden' || shown.live.op === '0') bad.push('Live is not on screen at the start');
    for (const part of [shown.live, shown.rec, shown.cc, shown.leave]) {
      if (!part || part.h < 44 || part.w < 44) bad.push((part && part.text) || 'control' + ' is small at the start');
    }
    const stateTop = shown.live ? shown.live.top : shown.vh;
    const hooked = await page.evaluate(() => {
      const api = window.__gifosChrome;
      if (!api || typeof api.idle !== 'function') return false;
      if (!(api.ms >= 3000)) return false;
      api.idle();
      return true;
    });
    if (!hooked) {
      if (phone.name === 'iphone-15') await page.screenshot({ path: path.join(SHOTS, 'before-chrome-idle-iphone-15.png') });
      failures.push(phone.name + ': chrome stays up when idle' + (bad.length ? ' (' + bad.join('; ') + ')' : ''));
      await context.close();
      continue;
    }
    if (bad.length) {
      failures.push(phone.name + ': ' + bad.join('; '));
      await context.close();
      continue;
    }
    await page.waitForTimeout(280);
    const tucked = await read();
    const quiet = [];
    if (!tucked.away) quiet.push('call did not tuck');
    if (tucked.moreOpen) quiet.push('More opened itself');
    if (tucked.leaveHit) quiet.push('Hang up still takes the tap');
    if (tucked.bar && tucked.bar.pe !== 'none') quiet.push('dock still takes taps');
    if (tucked.live && tucked.live.vis !== 'hidden' && tucked.live.op !== '0' && tucked.live.pe !== 'none') quiet.push('Live still takes taps');
    const covered = tucked.tiles.some((t) => overlaps(t, tucked.bar) && tucked.bar.op !== '0' && tucked.bar.top < tucked.vh);
    if (covered) quiet.push('dock still covers a face');
    if (tucked.lowest < tucked.vh - 24) quiet.push('faces did not grow into the dock band (bottom ' + Math.round(tucked.lowest) + ')');
    if (tucked.lowest < stateTop + 16) quiet.push('faces still stop above Live');
    if (phone.name === 'iphone-15') await page.screenshot({ path: path.join(SHOTS, 'after-chrome-idle-iphone-15.png') });
    const spot = await page.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll('.tile')).filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 8 && b.height > 8;
      });
      const b = tiles[0].getBoundingClientRect();
      return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + Math.min(b.height / 2, 80)) };
    });
    await page.touchscreen.tap(spot.x, spot.y);
    await page.waitForTimeout(300);
    const back = await read();
    if (back.away) quiet.push('a tap left the controls tucked');
    if (back.moreOpen) quiet.push('a tap opened More');
    if (!back.leaveHit) quiet.push('Hang up did not come back');
    for (const part of [back.live, back.rec, back.cc, back.leave]) {
      if (!part) { quiet.push('a control is missing'); continue; }
      if (part.h < 44 || part.w < 44) quiet.push(part.text + ' is ' + Math.round(part.w) + 'x' + Math.round(part.h));
      if (part.top < -1 || part.bottom > back.vh + 1 || part.left < -1 || part.right > back.vw + 1) quiet.push(part.text + ' is off screen');
      if (overlaps(part, back.status)) quiet.push(part.text + ' covers the header');
    }
    if (back.live && back.live.text !== 'Live') quiet.push('Live says "' + (back.live && back.live.text) + '"');
    if (back.rec && back.rec.text !== 'Record') quiet.push('Record says "' + back.rec.text + '"');
    if (back.cc && back.cc.text !== 'Captions') quiet.push('Captions says "' + back.cc.text + '"');
    if (phone.name === 'iphone-15') await page.screenshot({ path: path.join(SHOTS, 'after-chrome-back-iphone-15.png') });
    await page.locator('#bartoggle').tap();
    await page.waitForTimeout(80);
    await page.evaluate(() => { if (window.__gifosChrome) window.__gifosChrome.idle(); });
    await page.waitForTimeout(40);
    const held = await read();
    if (held.away) quiet.push('More open still tucked the dock');
    if (!held.moreOpen) quiet.push('More did not stay open');
    if (!held.leaveHit) quiet.push('Hang up left while More is open');
    if (quiet.length) failures.push(phone.name + ': ' + quiet.join('; '));
    else console.log('PASS', phone.name);
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS chrome idle');
})().catch((e) => { console.error(e); process.exit(1); });
