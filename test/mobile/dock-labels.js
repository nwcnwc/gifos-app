/*
 * The dock says what each control is: Mic, Video, React, More, Leave.
 * Unmute is not a second control in the header. The mic on the dock is
 * the only one.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/dock-labels.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const WORDS = [
  ['mic', 'Unmute'], // the dock mic says what a tap does (ruling)
  ['cam', 'Video'],
  ['reactbtn', 'React'],
  ['bartoggle', 'More'],
  ['leavebtn', 'Leave'],
];

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext(Object.assign({}, devices['iPhone SE'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=dock-labels', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#leavebtn', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.waitForTimeout(200);
  const info = await page.evaluate((words) => {
    const shown = (el) => {
      if (!el) return false;
      const cs = getComputedStyle(el);
      if (el.hidden || cs.display === 'none' || cs.visibility === 'hidden') return false;
      const b = el.getBoundingClientRect();
      return b.width > 2 && b.height > 2;
    };
    const rows = words.map(([id, label]) => {
      const btn = document.getElementById(id);
      const word = btn && btn.querySelector('.dockword');
      if (!btn || !word) return { id: id, label: label, missing: true };
      const b = btn.getBoundingClientRect();
      const w = word.getBoundingClientRect();
      const cs = getComputedStyle(word);
      return {
        id: id,
        label: label,
        missing: false,
        text: (word.textContent || '').trim(),
        font: parseFloat(cs.fontSize),
        shown: shown(word),
        inside: w.left >= b.left - 1 && w.right <= b.right + 1 && w.top >= b.top - 1 && w.bottom <= b.bottom + 1,
        onScreen: b.left >= -1 && b.right <= window.innerWidth + 1 && b.bottom <= window.innerHeight + 1 && b.top >= -1,
        h: b.height,
        w: b.width,
      };
    });
    const headerUnmute = shown(document.getElementById('unmute'));
    const headerCam = shown(document.getElementById('showcam'));
    const pills = Array.from(document.querySelectorAll('button')).filter((b) => {
      if (b.closest('.bar')) return false;
      if (!shown(b)) return false;
      const t = (b.innerText || b.textContent || '').replace(/\s+/g, ' ').trim();
      return t === 'Unmute' || t === 'Mute';
    }).map((b) => b.id || tSafe(b));
    function tSafe(b) { return (b.innerText || '').trim().slice(0, 20); }
    return { rows: rows, headerUnmute: headerUnmute, headerCam: headerCam, pills: pills };
  }, WORDS);
  const bad = [];
  for (const row of info.rows) {
    if (row.missing) bad.push(row.id + ' has no label');
    else {
      if (!row.shown || row.text !== row.label) bad.push(row.id + ' says "' + row.text + '"');
      if (row.font < 10) bad.push(row.id + ' label is ' + row.font + 'px');
      if (!row.inside) bad.push(row.id + ' label sits outside the button');
      if (!row.onScreen) bad.push(row.id + ' is off screen');
      if (row.h < 44 || row.w < 44) bad.push(row.id + ' is ' + Math.round(row.w) + 'x' + Math.round(row.h));
    }
  }
  if (info.headerUnmute) bad.push('header Unmute is showing');
  if (info.headerCam) bad.push('header Camera is showing');
  if (info.pills.length) bad.push('a second Unmute is showing (' + info.pills.join(', ') + ')');
  const shot = bad.length ? 'before-dock-labels-iphone-se.png' : 'after-dock-labels-iphone-se.png';
  await page.screenshot({ path: path.join(SHOTS, shot) });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  console.log('PASS dock labels');
})().catch((e) => { console.error(e); process.exit(1); });
