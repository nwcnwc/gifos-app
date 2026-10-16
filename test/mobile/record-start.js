/*
 * Record opens a sheet. On a phone the choice is already made, and
 * Start recording has to be on screen. It used to sit below the fold.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/record-start.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const LINES = {
  stage: 'This records the stage.',
  row: 'This records you and the people with you.',
  all: 'This records everyone you can see.',
  app: 'This records the shared app as well.',
};

function land(device) {
  const o = Object.assign({}, device);
  o.viewport = { width: device.viewport.height, height: device.viewport.width };
  return o;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  const phones = [
    { name: 'iphone-se', device: devices['iPhone SE'], scale: null, minFont: 16 },
    { name: 'iphone-se-land', device: land(devices['iPhone SE']), scale: null, minFont: 16 },
    { name: 'iphone-se-200', device: devices['iPhone SE'], scale: '2', minFont: 30 },
  ];
  for (const phone of phones) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript((scale) => {
      try {
        localStorage.setItem('gifos_name', 'Pat');
        if (scale) localStorage.setItem('gifos_ui_scale', scale);
      } catch (e) {}
    }, phone.scale);
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=rec-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#call-rec', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.locator('#call-rec').tap();
    await page.waitForSelector('#ro-start', { timeout: 5000 });
    await page.waitForTimeout(200);
    const info = await page.evaluate(() => {
      const box = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          h: b.height, w: b.width, font: parseFloat(cs.fontSize), bg: cs.backgroundColor,
          text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        };
      };
      const checked = document.querySelector('#rec-options input[name=rec-scope]:checked');
      return {
        vh: window.innerHeight, vw: window.innerWidth,
        start: box(document.getElementById('ro-start')),
        cancel: box(document.getElementById('ro-cancel')),
        now: box(document.getElementById('rec-now')),
        scope: checked ? checked.value : '',
      };
    });
    const bad = [];
    const start = info.start, cancel = info.cancel;
    if (!start) bad.push('no Start recording');
    else {
      if (start.h < 44 || start.w < 44) bad.push('Start is ' + Math.round(start.w) + 'x' + Math.round(start.h));
      if (start.top < -1 || start.bottom > info.vh + 1 || start.left < -1 || start.right > info.vw + 1) {
        bad.push('Start off screen (bottom ' + Math.round(start.bottom) + ', vh ' + info.vh + ')');
      }
      if (start.bg !== 'rgb(0, 100, 200)') bad.push('Start is ' + start.bg);
      if (start.font < phone.minFont) bad.push('Start font ' + start.font + 'px');
    }
    if (!cancel) bad.push('no Cancel');
    else {
      if (cancel.h < 44) bad.push('Cancel is ' + Math.round(cancel.h) + 'px');
      if (cancel.top < -1 || cancel.bottom > info.vh + 1) bad.push('Cancel off screen');
      if (start && cancel.bg === start.bg) bad.push('Cancel matches Start');
    }
    if (start && cancel) {
      const gap = Math.max(cancel.top - start.bottom, start.top - cancel.bottom, cancel.left - start.right, start.left - cancel.right);
      if (gap < 8) bad.push('Start is ' + Math.round(gap) + 'px from Cancel');
    }
    if (!info.scope || !LINES[info.scope]) bad.push('no chosen capture (' + info.scope + ')');
    if (!info.now) bad.push('the sheet does not say what will be recorded');
    else if (info.now.top < -1 || info.now.bottom > info.vh + 1) bad.push('the choice is off screen');
    else if (LINES[info.scope] && info.now.text !== LINES[info.scope]) {
      bad.push('choice says "' + info.now.text + '" for ' + info.scope);
    }
    if (phone.name === 'iphone-se') {
      const shot = (bad.length ? 'before' : 'after') + '-record-start-iphone-se.png';
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
  console.log('PASS record start');
})().catch((e) => { console.error(e); process.exit(1); });
