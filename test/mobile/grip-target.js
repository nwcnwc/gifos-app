/*
 * The drag grip has to be a 44px target on a normal phone, and Hang up
 * still has to stay on screen. On an iPhone 15 the grip was 22×48.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/grip-target.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const IDS = ['bargrip', 'cam', 'mic', 'reactbtn', 'bartoggle', 'leavebtn'];

const PHONES = [
  { name: 'iphone-15', device: devices['iPhone 15'] },
  { name: 'pixel-7', device: devices['Pixel 7'] },
];

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
    await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'grip-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.waitForTimeout(200);
    const rows = await page.evaluate((ids) => {
      const vw = window.innerWidth, vh = window.innerHeight;
      return ids.map((id) => {
        const el = document.getElementById(id);
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          id: id, w: b.width, h: b.height, left: b.left, right: b.right,
          top: b.top, bottom: b.bottom, vw: vw, vh: vh, color: cs.color,
        };
      });
    }, IDS);
    if (phone.name === 'iphone-15') await page.screenshot({ path: path.join(SHOTS, 'after-grip-iphone-15.png') });
    const bad = [];
    for (const c of rows) {
      if (c.left < -0.5 || c.right > c.vw + 0.5 || c.top < -0.5 || c.bottom > c.vh + 0.5) {
        bad.push(c.id + ' off screen (right ' + Math.round(c.right) + ', viewport ' + c.vw + ')');
      }
      if (c.id === 'bargrip' && (c.w < 44 || c.h < 44)) {
        bad.push('bargrip is ' + Math.round(c.w) + 'x' + Math.round(c.h) + ', under 44px');
      }
    }
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    else console.log('PASS', phone.name, rows.map((r) => r.id + ' ' + Math.round(r.w) + 'x' + Math.round(r.h)).join(' '));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS grip target');
})().catch((e) => { console.error(e); process.exit(1); });
