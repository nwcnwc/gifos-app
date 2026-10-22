/*
 * Fit is a primary control. It has to be at least 44px, stay on screen,
 * and clear the name chip and the dock. At 200% text the label grows.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/fit-target.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

const PHONES = [
  { name: 'iphone-se', device: devices['iPhone SE'], scale: null },
  {
    name: 'android-360',
    device: {
      viewport: { width: 360, height: 740 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: devices['Pixel 7'].userAgent,
    },
    scale: null,
  },
  { name: 'iphone-se-200', device: devices['iPhone SE'], scale: '2' },
];

function overlaps(a, b) {
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
    await context.addInitScript((scale) => {
      try {
        localStorage.setItem('gifos_name', 'Pat');
        if (scale) localStorage.setItem('gifos_ui_scale', scale);
      } catch (e) {}
    }, phone.scale);
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'fit-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#fitbtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.waitForTimeout(200);
    const info = await page.evaluate(() => {
      const fit = document.getElementById('fitbtn').getBoundingClientRect();
      const chip = document.querySelector('.topchip').getBoundingClientRect();
      const bar = document.querySelector('.bar').getBoundingClientRect();
      const font = parseFloat(getComputedStyle(document.getElementById('fitbtn')).fontSize);
      return {
        fit: { left: fit.left, top: fit.top, right: fit.right, bottom: fit.bottom, w: fit.width, h: fit.height },
        chip: { left: chip.left, top: chip.top, right: chip.right, bottom: chip.bottom, w: chip.width, h: chip.height },
        bar: { left: bar.left, top: bar.top, right: bar.right, bottom: bar.bottom },
        vw: window.innerWidth, vh: window.innerHeight, font: font,
      };
    });
    const bad = [];
    const f = info.fit;
    if (f.w < 44 || f.h < 44) bad.push('Fit is ' + Math.round(f.w) + 'x' + Math.round(f.h));
    if (f.left < -0.5 || f.top < -0.5 || f.right > info.vw + 0.5 || f.bottom > info.vh + 0.5) {
      bad.push('Fit off screen');
    }
    if (overlaps(f, info.chip)) bad.push('Fit overlaps the name chip');
    if (overlaps(f, info.bar)) bad.push('Fit overlaps the dock');
    if (phone.scale === '2' && info.font < 30) bad.push('Fit font ' + info.font + 'px at 200%');
    await page.locator('#fitbtn').tap();
    await page.waitForTimeout(50);
    const scrolled = await page.evaluate(() => {
      const fit = document.getElementById('fitbtn').getBoundingClientRect();
      const chip = document.querySelector('.topchip').getBoundingClientRect();
      const bar = document.querySelector('.bar').getBoundingClientRect();
      return {
        text: document.getElementById('fitbtn').textContent,
        fit: { left: fit.left, top: fit.top, right: fit.right, bottom: fit.bottom, w: fit.width, h: fit.height },
        chip: { left: chip.left, right: chip.right, top: chip.top, bottom: chip.bottom },
        bar: { top: bar.top, bottom: bar.bottom, left: bar.left, right: bar.right },
        vw: window.innerWidth, vh: window.innerHeight,
      };
    });
    const s = scrolled.fit;
    if (!/Scroll/.test(scrolled.text)) bad.push('tap did not switch to Scroll');
    if (s.w < 44 || s.h < 44) bad.push('Scroll is ' + Math.round(s.w) + 'x' + Math.round(s.h));
    if (s.left < -0.5 || s.top < -0.5 || s.right > scrolled.vw + 0.5 || s.bottom > scrolled.vh + 0.5) {
      bad.push('Scroll off screen');
    }
    if (overlaps(s, scrolled.chip)) bad.push('Scroll overlaps the name chip');
    if (overlaps(s, scrolled.bar)) bad.push('Scroll overlaps the dock');
    if (phone.name === 'iphone-se') {
      await page.locator('#fitbtn').tap();
      await page.screenshot({ path: path.join(SHOTS, 'after-fit-iphone-se.png') });
    }
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; ') + ' ' + JSON.stringify(info.fit));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS fit target');
})().catch((e) => { console.error(e); process.exit(1); });
