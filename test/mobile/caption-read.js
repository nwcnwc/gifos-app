/*
 * A long caption has to be readable. On a phone the line was cut off
 * inside the face, and the rest could not be scrolled to.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/caption-read.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const LINE = 'The Lord is my shepherd, I shall not want. He makes me lie down in green pastures.';

function land(device) {
  const o = Object.assign({}, device);
  o.viewport = { width: device.viewport.height, height: device.viewport.width };
  return o;
}

function overlaps(a, b) {
  if (!a || !b) return false;
  return a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1;
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
    await page.goto(BASE + '/run.html#v=capread-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    // Captions show only on a screen that turned CC on (a801ad4).
    await page.locator('#call-cc').tap();
    await page.waitForTimeout(150);
    await page.evaluate((line) => window.__gifosVideo.addTranscript(line), LINE);
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => {
      const box = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || b.height < 2) return null;
        return {
          top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          h: b.height, w: b.width, font: parseFloat(cs.fontSize),
          color: cs.color, bg: cs.backgroundColor, overflow: cs.overflowY,
          text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        };
      };
      const cap = document.getElementById('livecap');
      let reach = false;
      if (cap && cap.scrollHeight > cap.clientHeight + 4) {
        cap.scrollTop = cap.scrollHeight;
        reach = cap.scrollTop > 4;
        cap.scrollTop = 0;
      } else if (cap) reach = true;
      return {
        vh: window.innerHeight, vw: window.innerWidth,
        cap: box(cap),
        state: box(document.getElementById('callstate')),
        bar: box(document.querySelector('.bar')),
        reach: reach,
      };
    });
    const bad = [];
    const cap = info.cap;
    if (!cap) bad.push('no caption a member can read');
    else {
      if (cap.text.indexOf('shepherd') < 0 || cap.text.indexOf('pastures') < 0) bad.push('caption drops part of the line');
      if (cap.font < phone.minFont) bad.push('caption font ' + cap.font + 'px');
      if (cap.top < -1 || cap.bottom > info.vh + 1 || cap.left < -1 || cap.right > info.vw + 1) {
        bad.push('caption off screen (bottom ' + Math.round(cap.bottom) + ')');
      }
      if (cap.color !== 'rgb(255, 255, 255)') bad.push('caption color ' + cap.color);
      if (!info.reach) bad.push('the rest of the line cannot be scrolled to');
      if (overlaps(cap, info.state)) bad.push('caption covers Live');
      if (overlaps(cap, info.bar)) bad.push('caption covers the dock');
    }
    if (phone.name === 'iphone-se-200') {
      const shot = (bad.length ? 'before' : 'after') + '-caption-read-iphone-se-200.png';
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
  console.log('PASS caption read');
})().catch((e) => { console.error(e); process.exit(1); });
