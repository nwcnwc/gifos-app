/*
 * A texted link joins with the camera off. The self view is a letter, and
 * the dock camera is a slash with no words. After Unmute, the same header
 * slot says Camera until the camera is on. It stays when the dock tucks.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/camera-words.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

function land(device) {
  const v = device.viewport;
  return Object.assign({}, device, { viewport: { width: v.height, height: v.width } });
}

const PHONES = [
  { name: 'iphone-se', device: devices['iPhone SE'], scale: null, minFont: 16 },
  { name: 'iphone-se-200', device: devices['iPhone SE'], scale: '2', minFont: 32 },
  { name: 'iphone-se-land', device: land(devices['iPhone SE']), scale: null, minFont: 16 },
];

function overlaps(a, b) {
  if (!a || !b || a.h < 2 || b.h < 2) return false;
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
    await page.goto(BASE + '/run.html#v=board-call', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.evaluate((people) => window.__gifosVideo.presentPeers(people), [
      { id: 'peer-sam', name: 'Sam' },
    ]);
    await page.waitForTimeout(300);
    const unmute = page.locator('#unmute');
    if (await unmute.count() && await unmute.isVisible().catch(() => false)) await unmute.tap();
    await page.waitForTimeout(300);
    const read = () => page.evaluate(() => {
      const box = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          w: b.width, h: b.height,
          text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(),
          font: parseFloat(cs.fontSize),
          bg: cs.backgroundColor,
          hidden: el.hidden || cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0',
        };
      };
      const tiles = Array.from(document.querySelectorAll('.tile')).map((el) => {
        const b = el.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height, shown: b.width > 8 && b.height > 8 };
      }).filter((t) => t.shown);
      const cam = document.getElementById('cam');
      const mic = document.getElementById('mic');
      return {
        camWord: box(document.getElementById('showcam')),
        unmute: box(document.getElementById('unmute')),
        camOff: !!(cam && cam.classList.contains('off')),
        micOff: !!(mic && mic.classList.contains('off')),
        fit: box(document.getElementById('fitbtn')),
        chip: box(document.querySelector('.topchip')),
        state: box(document.getElementById('callstate')),
        dock: box(document.querySelector('.bar')),
        tiles: tiles,
        vh: window.innerHeight,
        vw: window.innerWidth,
      };
    });
    const info = await read();
    const bad = [];
    const c = info.camWord;
    if (info.micOff) bad.push('still muted');
    if (!c || c.hidden) bad.push('no Camera a person can read');
    else {
      if (c.text !== 'Camera') bad.push('button says "' + c.text + '"');
      if (c.h < 44 || c.w < 44) bad.push('Camera is ' + Math.round(c.w) + 'x' + Math.round(c.h));
      if (c.font < phone.minFont) bad.push('Camera font ' + c.font + 'px');
      if (c.bg !== 'rgb(0, 100, 200)') bad.push('Camera color ' + c.bg);
      if (c.top < -1 || c.bottom > info.vh + 1 || c.left < -1 || c.right > info.vw + 1) bad.push('Camera is off screen');
      if (!info.camOff) bad.push('camera is already on');
      if (info.unmute && !info.unmute.hidden) bad.push('Unmute is still up beside Camera');
      for (const other of [info.fit, info.chip, info.state, info.dock]) {
        if (overlaps(c, other)) bad.push('Camera covers ' + (other && other.text ? other.text.slice(0, 24) : 'chrome'));
      }
      if (info.tiles.some((t) => overlaps(c, t))) bad.push('Camera covers a face');
    }
    if (phone.name === 'iphone-se' && bad.length) {
      await page.screenshot({ path: path.join(SHOTS, 'before-camera-words-iphone-se.png') });
    }
    if (bad.length) {
      failures.push(phone.name + ': ' + bad.join('; '));
      await context.close();
      continue;
    }
    if (phone.name === 'iphone-se') {
      await page.screenshot({ path: path.join(SHOTS, 'after-camera-words-iphone-se.png') });
    }
    const tucked = await page.evaluate(() => {
      const api = window.__gifosChrome;
      if (!api || typeof api.idle !== 'function') return false;
      api.idle();
      return true;
    });
    await page.waitForTimeout(280);
    const quiet = await read();
    if (!tucked) bad.push('chrome idle hook missing');
    else if (!quiet.camWord || quiet.camWord.hidden) bad.push('Camera tucked away with the dock');
    else if (quiet.tiles.some((t) => overlaps(quiet.camWord, t))) bad.push('Camera covers a face while the dock is tucked');
    if (quiet.camWord && !quiet.camWord.hidden) {
      await page.locator('#showcam').tap();
      await page.waitForTimeout(400);
      const after = await read();
      if (after.camOff) bad.push('tap left the camera off');
      if (after.camWord && !after.camWord.hidden) bad.push('Camera stayed after the camera came on');
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
  console.log('PASS camera words');
})().catch((e) => { console.error(e); process.exit(1); });
