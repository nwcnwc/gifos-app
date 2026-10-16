/*
 * Landscape More used to grow past the header and off the screen, so
 * rows could not be reached. The sheet stays between the header and the
 * dock, and it scrolls inside that band.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/more-land.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

function land(device) {
  const o = Object.assign({}, device);
  o.viewport = { width: device.viewport.height, height: device.viewport.width };
  return o;
}

const PHONES = [
  { name: 'pixel-7-land', device: land(devices['Pixel 7']) },
  {
    name: 'wide-360',
    device: {
      viewport: { width: 800, height: 360 },
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
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=more-land', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.locator('#bartoggle').tap();
    await page.waitForTimeout(200);
    const info = await page.evaluate(() => {
      const more = document.getElementById('barmore');
      const r = more.getBoundingClientRect();
      const chip = document.querySelector('.topchip').getBoundingClientRect();
      const bar = document.querySelector('.bar').getBoundingClientRect();
      const oy = getComputedStyle(more).overflowY;
      return {
        top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height,
        chipBottom: chip.bottom, barTop: bar.top,
        vh: window.innerHeight, vw: window.innerWidth,
        oy: oy, scroll: more.scrollHeight, client: more.clientHeight,
      };
    });
    const bad = [];
    if (info.top < info.chipBottom - 2) bad.push('sheet covers the header (top ' + Math.round(info.top) + ', chip ' + Math.round(info.chipBottom) + ')');
    if (info.top < -1) bad.push('sheet above the screen (top ' + Math.round(info.top) + ')');
    if (info.bottom > info.vh + 1) bad.push('sheet below the screen (bottom ' + Math.round(info.bottom) + ')');
    if (info.left < -1 || info.right > info.vw + 1) bad.push('sheet wider than the screen');
    if (info.bottom > info.barTop + 2) bad.push('sheet covers the dock');
    if (info.oy !== 'auto' && info.oy !== 'scroll') bad.push('overflow ' + info.oy);
    await page.locator('#blur-none').scrollIntoViewIfNeeded();
    const blur = await page.evaluate(() => {
      const el = document.getElementById('blur-none');
      const b = el.getBoundingClientRect();
      const more = document.getElementById('barmore').getBoundingClientRect();
      const vh = window.innerHeight;
      return {
        top: b.top, bottom: b.bottom, h: b.height,
        inView: b.top >= -1 && b.bottom <= vh + 1 && b.height >= 44,
        inSheet: b.top >= more.top - 1 && b.bottom <= more.bottom + 1,
      };
    });
    if (!blur.inView || !blur.inSheet) bad.push('No blur not reachable (top ' + Math.round(blur.top) + ')');
    if (phone.name === 'pixel-7-land') {
      const shot = bad.length ? 'before-more-land-pixel-7.png' : 'after-more-land-pixel-7.png';
      await page.screenshot({ path: path.join(SHOTS, shot) });
    }
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    else console.log('PASS', phone.name, JSON.stringify(info));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS more landscape');
})().catch((e) => { console.error(e); process.exit(1); });
