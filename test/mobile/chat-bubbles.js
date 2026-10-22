/*
 * Chat bubbles are readable on a phone. Body and name are at least 1rem,
 * mine and theirs are different colors, contrast is at least 4.5:1,
 * and a long line wraps inside the bubble.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-bubbles.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const LONG = 'This hymn sheet is for Sunday and it should wrap inside the bubble rather than run to the edge.';

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
  { name: 'iphone-15', device: devices['iPhone 15'], scale: null },
  { name: 'iphone-se', device: devices['iPhone SE'], scale: null },
  { name: 'android-360-200', device: phone360(), scale: '2' },
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
    await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'chat-bubbles-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.locator('#bartoggle').tap();
    await page.locator('#chatbtn').tap();
    await page.waitForTimeout(150);
    await page.locator('#chat-in').fill('Hello from me');
    await page.locator('#chatform button[type=submit]').tap();
    await page.evaluate((text) => {
      window.__gifosChat.note({ by: 'Ruth', text: 'Hello from Ruth' });
      window.__gifosChat.note({ by: 'Ruth', text: text });
    }, LONG);
    await page.waitForTimeout(80);
    const info = await page.evaluate(() => {
      const probe = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const name = el.querySelector('b');
        const ns = name ? getComputedStyle(name) : null;
        return {
          text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
          top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height,
          color: cs.color, bg: cs.backgroundColor, font: parseFloat(cs.fontSize),
          pad: parseFloat(cs.paddingTop),
          nameFont: ns ? parseFloat(ns.fontSize) : 0,
          nameColor: ns ? ns.color : '',
          clipped: el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2,
        };
      };
      const log = document.getElementById('chatlog').getBoundingClientRect();
      const mine = document.querySelector('#chatlog .cmsg.mine');
      const theirs = Array.from(document.querySelectorAll('#chatlog .cmsg:not(.mine)'));
      return {
        log: { left: log.left, right: log.right, w: log.width },
        mine: probe(mine),
        ruth: probe(theirs.find((el) => (el.innerText || '').indexOf('Hello from Ruth') >= 0)),
        long: probe(theirs.find((el) => (el.innerText || '').indexOf('hymn sheet') >= 0)),
      };
    });
    const bad = [];
    const floor = phone.scale ? 28 : 16;
    if (!info.mine) bad.push('no bubble for my line');
    if (!info.ruth) bad.push('no bubble for Ruth');
    if (!info.long) bad.push('no long bubble');
    for (const part of [info.mine, info.ruth, info.long]) {
      if (!part) continue;
      if (part.font < floor) bad.push('body font ' + part.font);
      if (part.nameFont < floor) bad.push('name font ' + part.nameFont);
      if (part.pad < 8) bad.push('padding ' + part.pad);
      if (part.clipped) bad.push('text clipped in "' + part.text.slice(0, 24) + '"');
      if (part.left < info.log.left - 1 || part.right > info.log.right + 1) bad.push('bubble outside the log');
      const body = contrast(part.color, part.bg);
      const name = contrast(part.nameColor, part.bg);
      if (body !== null && body < 4.5) bad.push('body contrast ' + body.toFixed(2));
      if (name !== null && name < 4.5) bad.push('name contrast ' + name.toFixed(2));
    }
    if (info.mine && info.ruth && info.mine.bg === info.ruth.bg) bad.push('mine and theirs are the same color');
    if (info.ruth && lum(info.ruth.bg) !== null && lum(info.ruth.bg) < 0.45) bad.push('their bubble is dark');
    if (info.mine && lum(info.mine.color) !== null && lum(info.mine.color) < 0.7) bad.push('my text is not light');
    if (info.long && info.long.w > info.log.w * 0.82) bad.push('long bubble is ' + Math.round(info.long.w) + ' of ' + Math.round(info.log.w));
    if (info.long && info.long.h < (phone.scale ? 70 : 48)) bad.push('long line did not wrap (' + Math.round(info.long.h) + 'px)');
    if (info.mine && info.ruth && info.mine.left <= info.ruth.left) bad.push('my bubble is not on the right');
    if (phone.name === 'iphone-15') {
      const shot = bad.length ? 'before-chat-bubbles-iphone-15.png' : 'after-chat-bubbles-iphone-15.png';
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
  console.log('PASS chat bubbles');
})().catch((e) => { console.error(e); process.exit(1); });

function lum(c) {
  const m = String(c || '').match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  if (m[4] !== undefined && +m[4] === 0) return null;
  const lin = [m[1], m[2], m[3]].map((v) => {
    const s = +v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function contrast(a, b) {
  const L1 = lum(a), L2 = lum(b);
  if (L1 === null || L2 === null) return null;
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}
