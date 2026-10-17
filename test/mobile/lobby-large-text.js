/*
 * At 200% text a church volunteer on an SE still has to see Start and
 * Join without scrolling. The essays under the buttons used to push Join
 * off a 568px screen.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/lobby-large-text.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const IDS = ['lob-open', 'lob-admin-btn', 'lob-join-btn'];

function land(device) {
  const o = Object.assign({}, device);
  o.viewport = { width: device.viewport.height, height: device.viewport.width };
  return o;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const phones = [
    { name: 'iphone-se-200', device: devices['iPhone SE'] },
    { name: 'iphone-se-land-200', device: land(devices['iPhone SE']) },
  ];
  for (const phone of phones) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript(() => { try { localStorage.setItem('gifos_ui_scale', '2'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#lob-join-btn', { timeout: 15000 });
    await page.waitForTimeout(200);
    const info = await page.evaluate((ids) => {
      const vh = window.innerHeight, vw = window.innerWidth;
      return {
        vh: vh, vw: vw,
        buttons: ids.map((id) => {
          const el = document.getElementById(id);
          const b = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return {
            id: id,
            top: b.top, bottom: b.bottom, left: b.left, right: b.right,
            h: b.height, w: b.width,
            font: parseFloat(cs.fontSize),
            bg: cs.backgroundColor,
          };
        }),
      };
    }, IDS);
    const bad = [];
    const buttons = info.buttons;
    for (const b of buttons) {
      if (b.h < 44) bad.push(b.id + ' is ' + Math.round(b.h) + 'px tall');
      if (b.font < 30) bad.push(b.id + ' font ' + b.font + 'px');
      if (b.top < -1 || b.left < -1 || b.bottom > info.vh + 1 || b.right > info.vw + 1) {
        bad.push(b.id + ' off screen (bottom ' + Math.round(b.bottom) + ', vh ' + info.vh + ')');
      }
    }
    const start = buttons[0];
    if (start.bg !== 'rgb(0, 100, 200)') bad.push('Start is ' + start.bg);
    for (const b of buttons.slice(1)) {
      if (b.bg === start.bg) bad.push(b.id + ' is the same color as Start');
    }
    for (let i = 0; i < buttons.length; i++) {
      for (let j = i + 1; j < buttons.length; j++) {
        const a = buttons[i], b = buttons[j];
        const overlap = a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1;
        if (overlap) bad.push(a.id + ' overlaps ' + b.id);
        const gap = Math.max(b.top - a.bottom, a.top - b.bottom, b.left - a.right, a.left - b.right);
        if (gap < 8) bad.push(a.id + ' is ' + Math.round(gap) + 'px from ' + b.id);
      }
    }
    const shot = (bad.length ? 'before' : 'after') + '-lobby-200-' + phone.name + '.png';
    await page.screenshot({ path: path.join(SHOTS, shot) });
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS lobby large text');
})().catch((e) => { console.error(e); process.exit(1); });
