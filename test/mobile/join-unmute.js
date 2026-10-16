/*
 * A texted link never shows the lobby line "You join muted." The mic is a
 * slashed icon with no words, so a first call looks broken. While you are
 * muted the call shows Unmute: blue, at least 44px, 1rem, on screen, and
 * clear of the faces, Fit, and the dock. A tap turns the mic on and the
 * button goes away. It stays up when Live and the dock tuck.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/join-unmute.js
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
        localStorage.setItem('gifos_name', 'Grandma Ruth');
        if (scale) localStorage.setItem('gifos_ui_scale', scale);
      } catch (e) {}
    }, phone.scale);
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=sunday-dinner', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.evaluate((people) => window.__gifosVideo.presentPeers(people), [
      { id: 'peer-pat', name: 'Pat' },
    ]);
    await page.waitForTimeout(400);
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
      const mic = document.getElementById('mic');
      return {
        unmute: box(document.getElementById('unmute')),
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
    const u = info.unmute;
    if (!u || u.hidden) bad.push('no Unmute a person can read');
    else {
      if (u.text !== 'Unmute') bad.push('button says "' + u.text + '"');
      if (u.h < 44 || u.w < 44) bad.push('Unmute is ' + Math.round(u.w) + 'x' + Math.round(u.h));
      if (u.font < phone.minFont) bad.push('Unmute font ' + u.font + 'px');
      if (u.bg !== 'rgb(0, 100, 200)') bad.push('Unmute color ' + u.bg);
      if (u.top < -1 || u.bottom > info.vh + 1 || u.left < -1 || u.right > info.vw + 1) bad.push('Unmute is off screen');
      if (!info.micOff) bad.push('mic is already on');
      for (const other of [info.fit, info.chip, info.state, info.dock]) {
        if (overlaps(u, other)) bad.push('Unmute covers ' + (other && other.text ? other.text.slice(0, 24) : 'chrome'));
      }
      if (info.tiles.some((t) => overlaps(u, t))) bad.push('Unmute covers a face');
    }
    if (phone.name === 'iphone-se' && bad.length) {
      await page.screenshot({ path: path.join(SHOTS, 'before-join-unmute-iphone-se.png') });
    }
    if (bad.length) {
      failures.push(phone.name + ': ' + bad.join('; '));
      await context.close();
      continue;
    }
    if (phone.name === 'iphone-se') {
      await page.screenshot({ path: path.join(SHOTS, 'after-join-unmute-iphone-se.png') });
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
    else if (!quiet.unmute || quiet.unmute.hidden) bad.push('Unmute tucked away with the dock');
    else if (quiet.tiles.some((t) => overlaps(quiet.unmute, t))) bad.push('Unmute covers a face while the dock is tucked');
    if (quiet.unmute && !quiet.unmute.hidden) {
      await page.locator('#unmute').tap();
      await page.waitForTimeout(400);
      const after = await read();
      if (after.micOff) bad.push('tap left the mic muted');
      if (after.unmute && !after.unmute.hidden) bad.push('Unmute stayed after the mic came on');
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
  console.log('PASS join unmute');
})().catch((e) => { console.error(e); process.exit(1); });
