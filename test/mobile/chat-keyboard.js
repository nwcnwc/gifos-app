/*
 * The soft keyboard must not cover the message field, and it must not
 * be added on top of the dock. Landscape is the tight case: the dock
 * and a keyboard together used to push the field off the top.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-keyboard.js
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
function phone360() {
  return {
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['Pixel 7'].userAgent,
  };
}

const PHONES = [
  { name: 'iphone-se-land', device: land(devices['iPhone SE']), scale: null, kb: 200 },
  { name: 'iphone-se', device: devices['iPhone SE'], scale: null, kb: 240 },
  { name: 'android-360-200', device: phone360(), scale: '2', kb: 280 },
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
    await context.addInitScript((scale) => {
      try {
        localStorage.setItem('gifos_name', 'Pat');
        if (scale) localStorage.setItem('gifos_ui_scale', scale);
      } catch (e) {}
    }, phone.scale);
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=chat-kb-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmcancel');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.locator('#bartoggle').tap();
    await page.locator('#chatbtn').tap();
    await page.waitForTimeout(150);
    const wired = await page.evaluate((kb) => {
      if (!window.__gifosKb || typeof window.__gifosKb.sync !== 'function') return false;
      const inner = window.innerHeight;
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        get: () => ({ height: inner - kb, offsetTop: 0, width: window.innerWidth }),
      });
      window.__gifosKb.sync();
      return true;
    }, phone.kb);
    await page.waitForTimeout(40);
    const bad = [];
    if (!wired) bad.push('keyboard inset is not wired to the visible viewport');
    const tapped = await page.locator('#chat-in').tap({ timeout: 4000 }).then(() => true, () => false);
    if (!tapped) bad.push('field cannot be tapped');
    const geo = await page.evaluate(() => {
      const input = document.getElementById('chat-in');
      const b = input.getBoundingClientRect();
      const cs = getComputedStyle(input);
      const send = document.querySelector('#chatform button[type=submit]').getBoundingClientRect();
      const close = document.getElementById('chatclose').getBoundingClientRect();
      const kb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kb')) || 0;
      return {
        top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height,
        font: parseFloat(cs.fontSize),
        sendTop: send.top, sendBottom: send.bottom, sendRight: send.right,
        closeTop: close.top, closeH: close.height,
        kb: kb, vh: window.innerHeight, vw: window.innerWidth,
      };
    });
    const line = geo.vh - phone.kb;
    if (Math.round(geo.kb) !== phone.kb) bad.push('inset is ' + geo.kb + 'px, expected ' + phone.kb);
    if (geo.bottom > line + 2) bad.push('keyboard covers field (bottom ' + Math.round(geo.bottom) + ', line ' + line + ')');
    if (geo.top < -1) bad.push('field pushed off the top (' + Math.round(geo.top) + ')');
    if (geo.h < 44) bad.push('field is ' + Math.round(geo.h) + 'px tall');
    if (geo.right > geo.vw + 1 || geo.left < -1) bad.push('field off the side');
    if (geo.sendBottom > line + 2 || geo.sendRight > geo.vw + 1) bad.push('send is not above the keyboard');
    if (geo.closeTop < -1 || geo.closeH < 44) bad.push('close is not on screen');
    if (geo.font < (phone.scale ? 28 : 16)) bad.push('field font ' + geo.font);
    if (phone.name === 'iphone-se-land') {
      const shot = bad.length ? 'before-chat-keyboard-land.png' : 'after-chat-keyboard-land.png';
      await page.screenshot({ path: path.join(SHOTS, shot) });
    }
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS chat keyboard');
})().catch((e) => { console.error(e); process.exit(1); });
