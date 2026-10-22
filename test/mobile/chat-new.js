/*
 * A line that arrives while you are reading older ones offers a way
 * back down. Zoom, Meet, and Teams show that control. Tapping it
 * lands on the newest line and clears it.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-new.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

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
  await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'chat-new', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    for (let i = 1; i <= 16; i++) window.__gifosChat.note({ by: 'Ruth', text: 'Older note ' + i + ' about the agenda and the vote.' });
  });
  await page.waitForTimeout(40);
  await page.evaluate(() => { document.getElementById('chatlog').scrollTop = 0; });
  await page.evaluate(() => { window.__gifosChat.note({ by: 'David', text: 'The vote is Tuesday.' }); });
  await page.waitForTimeout(40);
  const info = await page.evaluate(() => {
    const btn = document.getElementById('chatnew');
    const log = document.getElementById('chatlog');
    if (!btn) return { missing: true, atTop: log.scrollTop < 8 };
    const cs = getComputedStyle(btn);
    const r = btn.getBoundingClientRect();
    return {
      missing: false,
      text: (btn.innerText || '').replace(/\s+/g, ' ').trim(),
      shown: !btn.hidden && cs.display !== 'none' && r.height > 2,
      h: r.height,
      bg: cs.backgroundColor,
      fg: cs.color,
      atTop: log.scrollTop < 8,
    };
  });
  const bad = [];
  if (info.missing) bad.push('no way back down');
  else {
    if (!info.shown) bad.push('the new-messages control is hidden');
    else if (!/new/i.test(info.text)) bad.push('label "' + info.text + '"');
    if (info.shown && info.h < 44) bad.push('control is ' + Math.round(info.h) + 'px');
    const c = contrast(info.fg, info.bg);
    if (info.shown && (c === null || c < 4.5)) bad.push('contrast ' + (c === null ? 'n/a' : c.toFixed(2)));
  }
  if (!info.atTop) bad.push('the log did not stay on the older lines');
  const shot = bad.length ? 'before-chat-new-iphone-se.png' : 'after-chat-new-iphone-se.png';
  await page.screenshot({ path: path.join(SHOTS, shot) });
  if (!bad.length) {
    await page.locator('#chatnew').tap();
    await page.waitForTimeout(40);
    const landed = await page.evaluate(() => {
      const log = document.getElementById('chatlog');
      const btn = document.getElementById('chatnew');
      const line = Array.from(log.querySelectorAll('.cmsg')).find((el) => (el.innerText || '').indexOf('vote is Tuesday') >= 0);
      const lr = log.getBoundingClientRect();
      const br = line ? line.getBoundingClientRect() : null;
      return {
        hidden: !btn || btn.hidden || getComputedStyle(btn).display === 'none',
        seen: !!(br && br.top >= lr.top - 2 && br.bottom <= lr.bottom + 2),
      };
    });
    if (!landed.hidden) bad.push('the control stayed after the tap');
    if (!landed.seen) bad.push('Tuesday is not in view');
    if (bad.length) fs.unlinkSync(path.join(SHOTS, shot));
  }
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  console.log('PASS chat new');
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
