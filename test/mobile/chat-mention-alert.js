/*
 * A mention while chat is closed has to alert the person who was named.
 * A line that names someone else is an ordinary preview. A later line
 * must not hide the mention until chat is opened.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-mention-alert.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

function overlaps(a, b) {
  if (!a || !b || a.hidden || b.hidden) return false;
  return a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext(Object.assign({}, devices['iPhone SE'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'chat-mention-alert', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#leavebtn', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.waitForTimeout(200);
  const read = () => page.evaluate(() => {
    const el = document.getElementById('chatpreview');
    const note = document.getElementById('chatnote');
    const dock = document.querySelector('.bar').getBoundingClientRect();
    if (!el) return { missing: true };
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
    return {
      missing: false,
      text: text,
      mention: el.classList.contains('mention'),
      hidden: !!(note && note.hidden) || el.hidden || cs.display === 'none' || b.height < 2,
      h: b.height,
      w: b.width,
      top: b.top, bottom: b.bottom, left: b.left, right: b.right,
      bg: cs.backgroundColor,
      color: cs.color,
      open: document.getElementById('chatpanel').classList.contains('open'),
      dock: { top: dock.top, bottom: dock.bottom, left: dock.left, right: dock.right, hidden: dock.height < 2 },
      vh: window.innerHeight,
      vw: window.innerWidth,
    };
  });
  await page.evaluate(() => window.__gifosChat.note({ by: 'Ruth', text: '@David bring the hymn sheets' }));
  await page.waitForTimeout(40);
  const other = await read();
  const bad = [];
  if (!other.missing && !other.hidden && /mentioned you/i.test(other.text)) bad.push('a mention of David alerted Nathan');
  await page.evaluate(() => window.__gifosChat.note({ by: 'Ruth', text: '@Nathan the vote is Tuesday' }));
  await page.waitForTimeout(40);
  const info = await read();
  if (info.missing || info.hidden) bad.push('no alert while chat is closed');
  else if (!/mentioned you/i.test(info.text)) bad.push('the preview does not say you were mentioned ("' + info.text + '")');
  else {
    if (info.text.indexOf('Ruth') < 0) bad.push('the alert does not name Ruth');
    if (info.text.indexOf('Tuesday') < 0) bad.push('the alert dropped the line');
    if (!info.mention) bad.push('the mention looks like any other line');
    if (info.bg !== 'rgb(0, 100, 200)') bad.push('alert color ' + info.bg);
    if (info.h < 44) bad.push('alert is ' + Math.round(info.h) + 'px');
    if (info.top < -1 || info.bottom > info.vh + 1 || info.left < -1 || info.right > info.vw + 1) bad.push('alert is off screen');
    if (overlaps(info, info.dock)) bad.push('alert covers the dock');
    const c = contrast(info.color, info.bg);
    if (c === null || c < 4.5) bad.push('contrast ' + (c === null ? 'n/a' : c.toFixed(2)));
  }
  const shot = bad.length ? 'before-chat-mention-alert-iphone-se.png' : 'after-chat-mention-alert-iphone-se.png';
  if (bad.length) {
    await page.screenshot({ path: path.join(SHOTS, shot) });
    await context.close();
    await browser.close();
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  await page.screenshot({ path: path.join(SHOTS, shot) });
  await page.evaluate(() => window.__gifosChat.note({ by: 'David', text: 'See you Sunday' }));
  await page.waitForTimeout(40);
  const later = await read();
  if (later.hidden || !/mentioned you/i.test(later.text)) bad.push('a later line hid the mention');
  if (/Sunday/i.test(later.text) && !/mentioned you/i.test(later.text)) bad.push('the alert became the later line');
  if (!bad.length) {
    await page.locator('#chatpreview').tap();
    await page.waitForTimeout(150);
    const opened = await read();
    if (!opened.open) bad.push('tapping the alert did not open chat');
    if (!opened.hidden) bad.push('the alert stayed up after chat opened');
  }
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS chat mention alert');
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
