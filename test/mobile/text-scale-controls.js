/*
 * Settings → text size 200% enlarges More-sheet labels, and the sheet
 * still scrolls those labels onto the screen. The dock stays on screen.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/text-scale-controls.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const LABELS = ['ccbtn', 'pwbtn', 'recbtn', 'helpbtn', 'stagebtn'];

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

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  for (const phone of PHONES) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript(() => {
      try { localStorage.setItem('gifos_name', 'Pat'); localStorage.setItem('gifos_ui_scale', '2'); } catch (e) {}
    });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=text-scale-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.locator('#bartoggle').tap();
    await page.waitForTimeout(150);
    const bad = [];
    const root = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    if (!(root >= 30)) bad.push('root font ' + root + 'px, expected 200%');
    for (const id of LABELS) {
      await page.evaluate((buttonId) => {
        const el = document.getElementById(buttonId);
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      }, id);
      const info = await page.evaluate((buttonId) => {
        const el = document.getElementById(buttonId);
        const s = getComputedStyle(el);
        const b = el.getBoundingClientRect();
        const vh = window.innerHeight;
        return {
          font: parseFloat(s.fontSize),
          inView: b.top >= -1 && b.bottom <= vh + 1 && b.height >= 44,
          clipped: el.scrollHeight > el.clientHeight + 2,
        };
      }, id);
      if (info.font < 24) bad.push(id + ' font ' + info.font + 'px');
      if (!info.inView) bad.push(id + ' not on screen');
      if (info.clipped) bad.push(id + ' text clipped');
    }
    const leave = await page.evaluate(() => {
      const b = document.getElementById('leavebtn').getBoundingClientRect();
      return b.right <= window.innerWidth + 1 && b.left >= -1 && b.width >= 44;
    });
    if (!leave) bad.push('hang up left the screen at 200%');
    if (phone.name === 'android-360') {
      await page.evaluate(() => document.getElementById('ccbtn').scrollIntoView({ block: 'nearest' }));
      await page.screenshot({ path: path.join(SHOTS, 'after-text-scale-more.png') });
    }
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    else console.log('PASS', phone.name, 'root', root);
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS text scale controls');
})().catch((e) => { console.error(e); process.exit(1); });
