/*
 * Narrow-phone dock: Hang up stays on screen, and every primary control
 * is at least 44px. Fails on the baseline (iPhone SE and 360px Android).
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/dock-fits.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const IDS = ['bargrip', 'cam', 'mic', 'reactbtn', 'bartoggle', 'leavebtn'];

const PHONES = [
  { name: 'iphone-se', device: devices['iPhone SE'] },
  {
    name: 'android-360',
    device: {
      viewport: { width: 360, height: 740 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: devices['Pixel 7'].userAgent,
    },
  },
];

function problems(rows) {
  const bad = [];
  for (const c of rows) {
    if (c.left < -0.5 || c.right > c.vw + 0.5 || c.top < -0.5 || c.bottom > c.vh + 0.5) {
      bad.push(c.id + ' off screen (right ' + Math.round(c.right) + ', viewport ' + c.vw + ')');
    }
    if (c.w < 44 || c.h < 44) bad.push(c.id + ' is ' + Math.round(c.w) + 'x' + Math.round(c.h) + ', under 44px');
  }
  return bad;
}

async function check(page) {
  return page.evaluate((ids) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    return ids.map((id) => {
      const el = document.getElementById(id);
      const b = el.getBoundingClientRect();
      return { id: id, w: b.width, h: b.height, left: b.left, right: b.right, top: b.top, bottom: b.bottom, vw: vw, vh: vh };
    });
  }, IDS);
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
    await page.goto(BASE + '/run.html#v=dock-fits-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.waitForTimeout(200);
    const rows = await check(page);
    await page.screenshot({ path: path.join(SHOTS, 'after-dock-' + phone.name + '.png') });
    const bad = problems(rows);
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    else console.log('PASS', phone.name, rows.map((r) => r.id + ' ' + Math.round(r.w) + 'x' + Math.round(r.h)).join(' '));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS dock fits');
})().catch((e) => { console.error(e); process.exit(1); });
