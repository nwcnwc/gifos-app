/*
 * The room name in the header is the tap that opens the rest of the
 * status. On an iPhone 15 it is 23px tall, under the 44px floor.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/header-tap.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

function overlaps(a, b) {
  if (!a || !b || a.hidden || b.hidden) return false;
  return a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1;
}

function land(device) {
  const o = Object.assign({}, device);
  o.viewport = { width: device.viewport.height, height: device.viewport.width };
  return o;
}

const phones = [
  { name: 'iphone-15', device: devices['iPhone 15'], shot: true },
  { name: 'iphone-se', device: devices['iPhone SE'], shot: false },
  { name: 'iphone-se-land', device: land(devices['iPhone SE']), shot: false },
];

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  for (const phone of phones) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=header-tap', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#status', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.evaluate(() => window.__gifosVideo.presentPeers([
      { id: 'peer-ruth', name: 'Ruth' },
      { id: 'peer-david', name: 'David' },
    ]));
    await page.waitForTimeout(200);
    const info = await page.evaluate(() => {
      const box = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
          h: b.height, w: b.width, top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          hidden: cs.display === 'none' || cs.visibility === 'hidden' || b.height < 2,
          clipped: el.scrollWidth > el.clientWidth + 2,
        };
      };
      const tiles = Array.from(document.querySelectorAll('.tile')).map(box).filter((t) => t && !t.hidden);
      return {
        status: box(document.getElementById('status')),
        fit: box(document.getElementById('fitbtn')),
        tiles: tiles,
        vh: window.innerHeight,
        vw: window.innerWidth,
      };
    });
    const bad = [];
    const s = info.status;
    if (!s || s.hidden) bad.push('no room name');
    else {
      if (s.h < 44) bad.push('room name is ' + Math.round(s.w) + 'x' + Math.round(s.h));
      if (s.w < 44) bad.push('room name is only ' + Math.round(s.w) + 'px wide');
      if (s.top < -1 || s.bottom > info.vh + 1 || s.left < -1 || s.right > info.vw + 1) bad.push('room name is off screen');
      if (s.clipped) bad.push('room name is cut off ("' + s.text + '")');
      if (s.text.indexOf('in call') < 0) bad.push('header "' + s.text + '"');
      if (overlaps(s, info.fit)) bad.push('room name covers Fit');
      for (const tile of info.tiles) {
        if (overlaps(s, tile)) bad.push('room name covers a face');
      }
    }
    if (phone.shot && s && s.h < 44) {
      await page.screenshot({ path: path.join(SHOTS, 'before-header-tap-iphone-15.png') });
    }
    if (!bad.length) {
      await page.locator('#status').tap();
      await page.waitForTimeout(80);
      const opened = await page.evaluate(() => {
        const el = document.getElementById('status-full');
        const close = document.getElementById('status-full-close');
        const cs = el ? getComputedStyle(el) : null;
        const b = close ? close.getBoundingClientRect() : null;
        return {
          open: !!(el && cs && cs.display !== 'none'),
          text: el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '',
          closeH: b ? b.height : 0,
        };
      });
      if (!opened.open) bad.push('tap did not open the status');
      else if (opened.text.indexOf('in the meeting') < 0 && opened.text.indexOf('in call') < 0) bad.push('the sheet dropped the count ("' + opened.text.slice(0, 80) + '")');
      if (opened.closeH < 44) bad.push('Close is ' + Math.round(opened.closeH) + 'px');
      if (phone.shot && !bad.length) {
        await page.locator('#status-full-close').tap();
        await page.waitForTimeout(40);
        await page.screenshot({ path: path.join(SHOTS, 'after-header-tap-iphone-15.png') });
      }
    }
    if (bad.length) failures.push(phone.name + ' ' + info.vw + 'x' + info.vh + ': ' + bad.join('; ') + ' ' + JSON.stringify(info.status));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS header tap');
})().catch((e) => { console.error(e); process.exit(1); });
