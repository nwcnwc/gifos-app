/*
 * The call should stay quiet. Fit must not sit on a face, and the build
 * tag must not look like another button in the corner.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/call-calm.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const PEOPLE = [
  { id: 'peer-ruth', name: 'Ruth' },
  { id: 'peer-david', name: 'David' },
  { id: 'peer-sam', name: 'Sam' },
];

function overlaps(a, b) {
  if (!a || !b) return false;
  return a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1;
}

// Same band as meet-views headerBand: upright phone 102, sideways phone 58.
function headerInset(vw, vh, gtop) {
  const land = vh < 500 && vw > vh;
  const phone = vw < 600 || land;
  const base = phone ? (land ? 58 : 102) : ((vw > 600 && vh > 500) ? 64 : 102);
  return Math.round(base + (gtop > 0 ? gtop : 0));
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext(Object.assign({}, devices['iPhone 15'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Pat'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'call-calm', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#leavebtn', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.evaluate((people) => window.__gifosVideo.presentPeers(people), PEOPLE);
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        top: b.top, bottom: b.bottom, left: b.left, right: b.right,
        w: b.width, h: b.height, bg: cs.backgroundColor, op: cs.opacity,
        text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(),
      };
    };
    const tiles = Array.from(document.querySelectorAll('.tile')).map((el) => {
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height, shown: b.width > 8 && b.height > 8 };
    }).filter((t) => t.shown);
    const feed = document.getElementById('feed');
    const fr = feed ? feed.getBoundingClientRect() : null;
    let gtop = 0;
    try {
      const n = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gtop'));
      if (n > 0) gtop = n;
    } catch (e) {}
    return {
      fit: box(document.getElementById('fitbtn')),
      tag: box(document.getElementById('gifos-build-float')),
      chip: box(document.querySelector('.topchip')),
      tiles: tiles,
      vw: window.innerWidth, vh: window.innerHeight,
      gtop: gtop, feedBottom: fr ? fr.bottom : window.innerHeight,
    };
  });
  const bad = [];
  if (!info.fit || info.fit.h < 44) bad.push('Fit is missing');
  if (info.fit && overlaps(info.fit, info.chip)) bad.push('Fit covers the header');
  // Faces fill the feed: the header band above, the call chrome below.
  let y0 = Infinity, y1 = -Infinity;
  for (const t of info.tiles) { y0 = Math.min(y0, t.top); y1 = Math.max(y1, t.bottom); }
  const inset = headerInset(info.vw, info.vh, info.gtop);
  if (info.tiles.length && (Math.abs(y0 - inset) > 8 || Math.abs(y1 - info.feedBottom) > 8)) bad.push('faces leave a band (' + Math.round(y0) + ' above, ' + Math.round(info.feedBottom - y1) + ' below)');
  if (info.tag && info.fit && overlaps(info.tag, info.fit)) bad.push('build tag covers Fit');
  if (info.tag && info.chip && overlaps(info.tag, info.chip)) bad.push('build tag covers the header');
  if (!info.tag || info.tag.text.indexOf('edge') < 0) bad.push('build tag is gone');
  else {
    const bg = info.tag.bg;
    const opaque = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    if (opaque) bad.push('build tag looks like a button (' + bg + ')');
  }
  const shot = bad.length ? 'before-call-calm-iphone-15.png' : 'after-call-calm-iphone-15.png';
  await page.screenshot({ path: path.join(SHOTS, shot) });
  await browser.close();
  if (bad.length) {
    console.error('FAIL\n' + bad.join('\n'));
    process.exit(1);
  }
  console.log('PASS call calm');
})().catch((e) => { console.error(e); process.exit(1); });
