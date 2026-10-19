/*
 * Send is the blue action. The paperclip and the emoji button stay gray.
 * Zoom, Meet, and Teams put the send control in the brand color so a
 * thumb finds it. It stays at least 44px, with white type.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-send.js
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
  const context = await browser.newContext(Object.assign({}, devices['iPhone SE'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=chat-send', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(150);
  await page.locator('#chat-in').fill('Sending the notes.');
  const info = await page.evaluate(() => {
    const send = document.querySelector('#chatform button[type=submit]');
    const clip = document.getElementById('cattach');
    const cs = (el) => getComputedStyle(el);
    const box = send.getBoundingClientRect();
    return {
      label: (send.textContent || '').trim(),
      bg: cs(send).backgroundColor,
      fg: cs(send).color,
      h: box.height,
      clipBg: cs(clip).backgroundColor,
      clipFg: cs(clip).color,
    };
  });
  const bad = [];
  if (info.label !== 'Send') bad.push('label "' + info.label + '"');
  if (info.bg !== 'rgb(0, 100, 200)') bad.push('Send is ' + info.bg);
  if (info.h < 44) bad.push('Send is ' + Math.round(info.h) + 'px');
  const c = contrast(info.fg, info.bg);
  if (c === null || c < 4.5) bad.push('Send contrast ' + (c === null ? 'n/a' : c.toFixed(2)));
  if (info.clipBg === 'rgb(255, 255, 255)' || info.clipBg === info.bg) bad.push('the paperclip has no edge (' + info.clipBg + ')');
  const clipC = contrast(info.clipFg, info.clipBg);
  if (clipC === null || clipC < 4.5) bad.push('paperclip contrast ' + (clipC === null ? 'n/a' : clipC.toFixed(2)));
  const shot = bad.length ? 'before-chat-send-iphone-se.png' : 'after-chat-send-iphone-se.png';
  await page.screenshot({ path: path.join(SHOTS, shot) });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  console.log('PASS chat send');
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
