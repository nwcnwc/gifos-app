/*
 * Captions selected in More was a faint green on the gray button.
 * The on state is the same blue fill and white word as the other toggles.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/cc-on.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext(Object.assign({}, devices['Pixel 7'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=cc-on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.locator('#bartoggle').tap();
  await page.locator('#ccbtn').scrollIntoViewIfNeeded();
  await page.locator('#ccbtn').tap();
  await page.waitForTimeout(200);
  const info = await page.evaluate(() => {
    const el = document.getElementById('ccbtn');
    const cs = getComputedStyle(el);
    const call = document.getElementById('call-cc');
    const ccs = call ? getComputedStyle(call) : null;
    return {
      on: el.classList.contains('on'),
      text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
      bg: cs.backgroundColor,
      color: cs.color,
      callBg: ccs ? ccs.backgroundColor : '',
      callColor: ccs ? ccs.color : '',
    };
  });
  const bad = [];
  if (!info.on) bad.push('Captions did not turn on');
  if (info.bg !== 'rgb(0, 100, 200)') bad.push('Captions fill ' + info.bg);
  if (info.color !== 'rgb(255, 255, 255)') bad.push('Captions word ' + info.color);
  if (info.callBg && info.bg !== info.callBg) bad.push('Captions fill does not match the on-call toggle (' + info.callBg + ')');
  const shot = bad.length ? 'before-cc-on-pixel-7.png' : 'after-cc-on-pixel-7.png';
  await page.locator('#ccbtn').screenshot({ path: path.join(SHOTS, shot) });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  console.log('PASS captions on');
})().catch((e) => { console.error(e); process.exit(1); });
