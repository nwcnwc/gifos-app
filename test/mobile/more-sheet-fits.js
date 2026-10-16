/*
 * Landscape More sheet: Password, Invite, Captions, and Help stay reachable.
 * The sheet must sit inside the screen and scroll, not draw off the top.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/more-sheet-fits.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const NEED = ['pwbtn', 'invite', 'ccbtn', 'helpbtn', 'recbtn', 'stagebtn'];

function land(device) {
  const o = Object.assign({}, device);
  o.viewport = { width: device.viewport.height, height: device.viewport.width };
  return o;
}

const PHONES = [
  { name: 'iphone-se-land', device: land(devices['iPhone SE']) },
  { name: 'iphone-15-land', device: land(devices['iPhone 15']) },
  { name: 'pixel-7-land', device: land(devices['Pixel 7']) },
  {
    name: 'android-360-land',
    device: {
      viewport: { width: 740, height: 360 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: devices['Pixel 7'].userAgent,
    },
  },
];

async function openMore(page) {
  await page.goto(BASE + '/run.html#v=more-sheet', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.locator('#bartoggle').tap();
  await page.waitForTimeout(150);
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
    await openMore(page);
    const before = await page.evaluate(() => {
      const more = document.getElementById('barmore');
      const r = more.getBoundingClientRect();
      const oy = getComputedStyle(more).overflowY;
      return { top: r.top, bottom: r.bottom, vh: window.innerHeight, oy: oy };
    });
    const bad = [];
    if (before.top < -1) bad.push('sheet top ' + Math.round(before.top));
    if (before.bottom > before.vh + 1) bad.push('sheet bottom ' + Math.round(before.bottom) + ' past ' + before.vh);
    if (before.oy !== 'auto' && before.oy !== 'scroll') bad.push('overflow-y ' + before.oy);
    for (const id of NEED) {
      await page.evaluate((buttonId) => {
        const el = document.getElementById(buttonId);
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }, id);
      const box = await page.evaluate((buttonId) => {
        const el = document.getElementById(buttonId);
        const b = el.getBoundingClientRect();
        const more = document.getElementById('barmore').getBoundingClientRect();
        const vh = window.innerHeight;
        const inView = b.top >= -1 && b.bottom <= vh + 1 && b.left >= -1 && b.right <= window.innerWidth + 1;
        const inSheet = b.top >= more.top - 1 && b.bottom <= more.bottom + 1;
        return { inView: inView, inSheet: inSheet, top: b.top, bottom: b.bottom, h: b.height, w: b.width };
      }, id);
      if (!box.inView || !box.inSheet) bad.push(id + ' not reachable (top ' + Math.round(box.top) + ')');
      if (box.h < 44 || box.w < 44) bad.push(id + ' tap ' + Math.round(box.w) + 'x' + Math.round(box.h));
    }
    if (phone.name === 'iphone-se-land') {
      await page.evaluate(() => {
        const el = document.getElementById('pwbtn');
        if (el) el.scrollIntoView({ block: 'nearest' });
      });
      await page.screenshot({ path: path.join(SHOTS, 'after-more-iphone-se-land.png') });
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
  console.log('PASS more sheet fits');
})().catch((e) => { console.error(e); process.exit(1); });
