/*
 * Notch and home indicator: viewport-fit=cover, and the chip, Fit, and
 * dock stay inside the safe area when the browser reports insets.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/safe-area.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

async function boot(browser, device, insets) {
  const context = await browser.newContext(Object.assign({}, device, { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Pat'); } catch (e) {} });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setSafeAreaInsetsOverride', { insets: insets });
  await page.goto(BASE + '/run.html#v=safe-area', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#leavebtn', { timeout: 15000 });
  const skip = page.locator('#nmcancel');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.waitForTimeout(200);
  return { context, page };
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const bad = [];
  const portrait = await boot(browser, devices['iPhone 15'], { top: 47, left: 0, bottom: 34, right: 0 });
  const meta = await portrait.page.evaluate(() => document.querySelector('meta[name=viewport]').content);
  if (!/viewport-fit=cover/.test(meta)) bad.push('viewport meta missing viewport-fit=cover: ' + meta);
  const box = await portrait.page.evaluate(() => {
    const chip = document.querySelector('.topchip').getBoundingClientRect();
    const fit = document.getElementById('fitbtn').getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const leave = document.getElementById('leavebtn').getBoundingClientRect();
    return {
      vh: window.innerHeight, vw: window.innerWidth,
      chipTop: chip.top, fitTop: fit.top, fitH: fit.height,
      barTop: bar.top, barBottom: bar.bottom, barLeft: bar.left, barRight: bar.right,
      leaveRight: leave.right, leaveBottom: leave.bottom,
    };
  });
  if (box.chipTop < 47 - 0.5) bad.push('chip under the notch (top ' + Math.round(box.chipTop) + ')');
  if (box.fitTop < 47 - 0.5) bad.push('Fit under the notch (top ' + Math.round(box.fitTop) + ')');
  if (box.barBottom > box.vh - 34 + 0.5) bad.push('dock on the home indicator (bottom ' + Math.round(box.barBottom) + ', line ' + (box.vh - 34) + ')');
  if (box.leaveBottom > box.vh - 34 + 0.5 || box.leaveRight > box.vw + 0.5) bad.push('hang up outside the safe area');
  await portrait.page.screenshot({ path: path.join(SHOTS, 'after-safe-area-iphone-15.png') });
  await portrait.context.close();

  const landDevice = Object.assign({}, devices['iPhone 15']);
  landDevice.viewport = { width: devices['iPhone 15'].viewport.height, height: devices['iPhone 15'].viewport.width };
  const land = await boot(browser, landDevice, { top: 0, left: 47, bottom: 21, right: 21 });
  const side = await land.page.evaluate(() => {
    const bar = document.querySelector('.bar').getBoundingClientRect();
    return { left: bar.left, right: bar.right, bottom: bar.bottom, vw: window.innerWidth, vh: window.innerHeight };
  });
  if (side.left < 47 - 0.5) bad.push('dock under the landscape notch (left ' + Math.round(side.left) + ')');
  if (side.right > side.vw - 21 + 0.5) bad.push('dock past the landscape edge (right ' + Math.round(side.right) + ')');
  if (side.bottom > side.vh - 21 + 0.5) bad.push('dock on the landscape home edge');
  await land.context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL\n' + bad.join('\n'));
    console.error(JSON.stringify(box));
    process.exit(1);
  }
  console.log('PASS safe area', JSON.stringify(box));
})().catch((e) => { console.error(e); process.exit(1); });
