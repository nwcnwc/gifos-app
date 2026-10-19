/*
 * A sideways phone cuts a longer name. On an iPhone SE the tiles are
 * about 105px wide and the name is one line capped at 93px, so
 * "Margaret Johnson" reads as "Margaret Joh…". Safari's wider font cuts
 * even "Nathan (you)". A church roster is full of names like that. The
 * whole name has to show; it may take two lines.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/sideways-long-names.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

function land(device) {
  const vp = device.viewport;
  return Object.assign({}, device, { viewport: { width: vp.height, height: vp.width } });
}

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
  const tag = process.env.SHOT_TAG ? '-' + process.env.SHOT_TAG : '';
  const phones = [
    { name: 'iphone-se', device: land(devices['iPhone SE']), shot: true },
    { name: 'iphone-15', device: land(devices['iPhone 15']), shot: false },
  ];
  const failures = [];
  for (const phone of phones) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=sideways-long-names', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.evaluate(() => window.__gifosVideo.presentPeers([
      { id: 'peer-margaret', name: 'Margaret Johnson' },
      { id: 'peer-david', name: 'Pastor David Lee' },
      { id: 'peer-sam', name: 'Sam' },
    ]));
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => {
      const box = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
          h: b.height, w: b.width, top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          hidden: cs.display === 'none' || cs.visibility === 'hidden' || b.width < 2 || b.height < 2,
          clipped: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
          font: parseFloat(cs.fontSize),
        };
      };
      return {
        vw: window.innerWidth,
        vh: window.innerHeight,
        tiles: Array.from(document.querySelectorAll('.tile')).map((el) => {
          const b = el.getBoundingClientRect();
          if (b.width < 8 || b.height < 8) return null;
          const name = el.querySelector('.name');
          return {
            full: (name && name.textContent || '').replace(/\s+/g, ' ').trim(),
            name: box(name),
            fs: box(el.querySelector('.maxbtn')),
            blur: box(el.querySelector('.blurbox')),
            tile: { left: b.left, right: b.right, top: b.top, bottom: b.bottom, w: b.width },
          };
        }).filter(Boolean),
      };
    });
    const bad = [];
    const want = ['Nathan (you)', 'Margaret Johnson', 'Pastor David Lee', 'Sam'];
    for (const who of want) {
      const row = info.tiles.find((t) => t.full === who);
      if (!row) { bad.push('missing ' + who); continue; }
      const n = row.name;
      if (!n || n.hidden) { bad.push(who + ' has no name'); continue; }
      if (n.clipped) bad.push(who + ' is cut (' + Math.round(n.w) + 'px box)');
      if (n.text !== who) bad.push(who + ' reads "' + n.text + '"');
      if (n.font < 12) bad.push(who + ' is ' + n.font + 'px');
      if (n.top < row.tile.top - 1 || n.bottom > row.tile.bottom + 1 || n.left < row.tile.left - 1 || n.right > row.tile.right + 1) bad.push(who + ' is off the face');
      if (overlaps(n, row.fs)) bad.push('full screen covers ' + who);
      if (overlaps(n, row.blur)) bad.push('blur covers ' + who);
      if (row.fs && !row.fs.hidden && (row.fs.w < 44 || row.fs.h < 44)) bad.push('full screen is ' + Math.round(row.fs.w) + 'x' + Math.round(row.fs.h));
    }
    if (phone.shot) await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-sideways-long-names' + tag + '-iphone-se.png') });
    if (bad.length) failures.push(phone.name + ' ' + info.vw + 'x' + info.vh + ': ' + bad.join('; '));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS sideways long names');
})().catch((e) => { console.error(e); process.exit(1); });
