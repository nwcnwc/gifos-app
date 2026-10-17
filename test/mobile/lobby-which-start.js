/*
 * A volunteer on a phone sees two buttons that start with Start, and at
 * 200% text "Start a room you run" wraps until it is taller than the blue
 * Start a meeting. The admin path must not look like the way to begin.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/lobby-which-start.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

function land(device) {
  const v = device.viewport;
  return Object.assign({}, device, { viewport: { width: v.height, height: v.width } });
}

const PHONES = [
  { name: 'iphone-se', device: devices['iPhone SE'], scale: null },
  { name: 'iphone-se-200', device: devices['iPhone SE'], scale: '2' },
  { name: 'iphone-se-land', device: land(devices['iPhone SE']), scale: null },
];

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  for (const phone of PHONES) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript((scale) => {
      try { if (scale) localStorage.setItem('gifos_ui_scale', scale); } catch (e) {}
    }, phone.scale);
    const page = await context.newPage();
    await page.goto(BASE + '/run.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#lob-open', { timeout: 15000 });
    await page.waitForTimeout(200);
    const info = await page.evaluate(() => {
      const box = (id) => {
        const el = document.getElementById(id);
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const span = el.querySelector(':scope > span');
        const title = (Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim() || (span ? span.textContent : '')).replace(/\s+/g, ' ').trim();
        return {
          title: title,
          text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
          top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          h: b.height, w: b.width,
          bg: cs.backgroundColor,
        };
      };
      return {
        start: box('lob-open'),
        admin: box('lob-admin-btn'),
        join: box('lob-join-btn'),
        vh: window.innerHeight,
        vw: window.innerWidth,
      };
    });
    const bad = [];
    for (const part of [info.start, info.admin, info.join]) {
      if (part.top < -1 || part.bottom > info.vh + 1 || part.left < -1 || part.right > info.vw + 1) {
        bad.push((part.title || 'button') + ' off screen');
      }
      if (part.h < 44 || part.w < 44) bad.push((part.title || 'button') + ' is ' + Math.round(part.w) + 'x' + Math.round(part.h));
    }
    if (info.start.title !== 'Start a call') bad.push('start says "' + info.start.title + '"');
    if (info.start.bg !== 'rgb(0, 100, 200)') bad.push('Start is ' + info.start.bg);
    if (info.admin.bg === info.start.bg) bad.push('admin is the same color as Start');
    if (info.join.bg === info.start.bg) bad.push('Join is the same color as Start');
    if (/^start\b/i.test(info.admin.title)) bad.push('admin also says "' + info.admin.title + '"');
    if (info.admin.h > info.start.h + 1) bad.push('admin is taller than Start (' + Math.round(info.admin.h) + ' vs ' + Math.round(info.start.h) + ')');
    if (!/^join\b/i.test(info.join.title)) bad.push('join says "' + info.join.title + '"');
    const shot = (bad.length ? 'before' : 'after') + '-lobby-which-start-' + phone.name + '.png';
    if (phone.name === 'iphone-se' || phone.name === 'iphone-se-200') {
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
  console.log('PASS lobby which start');
})().catch((e) => { console.error(e); process.exit(1); });
