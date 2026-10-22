/*
 * Four faces fill the feed from the header band to the call chrome.
 * The dock sits below that edge, so it does not cover a face, and each
 * face stays tall enough to read.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/dock-clears-faces.js
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

// Same band as meet-views headerBand: upright phone 102, sideways phone 58.
function headerInset(vw, vh, gtop) {
  const land = vh < 500 && vw > vh;
  const phone = vw < 600 || land;
  const base = phone ? (land ? 58 : 102) : ((vw > 600 && vh > 500) ? 64 : 102);
  return Math.round(base + (gtop > 0 ? gtop : 0));
}

const PHONES = [
  { name: 'iphone-15', device: devices['iPhone 15'] },
  { name: 'iphone-se', device: devices['iPhone SE'] },
  {
    name: 'android-360',
    device: {
      viewport: { width: 360, height: 740 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: devices['Pixel 7'].userAgent,
    },
  },
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
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Grandma Ruth'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'dock-faces-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.evaluate((people) => window.__gifosVideo.presentPeers(people), PEOPLE);
    await page.waitForTimeout(250);
    const info = await page.evaluate(() => {
      const bar = document.querySelector('.bar').getBoundingClientRect();
      const tiles = Array.from(document.querySelectorAll('.tile')).map((el) => {
        const b = el.getBoundingClientRect();
        return {
          id: el.dataset.peer || '',
          name: (el.querySelector('.name') || {}).textContent || '',
          top: b.top, bottom: b.bottom, h: b.height, w: b.width,
          shown: b.width > 8 && b.height > 8 && el.style.display !== 'none',
        };
      }).filter((t) => t.shown);
      const feed = document.getElementById('feed');
      const fr = feed ? feed.getBoundingClientRect() : null;
      let gtop = 0;
      try {
        const n = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gtop'));
        if (n > 0) gtop = n;
      } catch (e) {}
      return {
        dockTop: bar.top, vh: window.innerHeight, vw: window.innerWidth,
        gtop: gtop, feedBottom: fr ? fr.bottom : window.innerHeight, tiles: tiles,
      };
    });
    const bad = [];
    if (info.tiles.length < 4) bad.push('only ' + info.tiles.length + ' faces');
    let y0 = Infinity, y1 = -Infinity, over = false;
    for (const t of info.tiles) {
      if (t.bottom > info.dockTop + 1) over = true;
      if (t.h < 48) bad.push((t.name || t.id) + ' is only ' + Math.round(t.h) + 'px tall');
      y0 = Math.min(y0, t.top); y1 = Math.max(y1, t.bottom);
    }
    if (info.tiles.length && over) bad.push('dock covers a face');
    const inset = headerInset(info.vw, info.vh, info.gtop);
    if (info.tiles.length && (Math.abs(y0 - inset) > 8 || Math.abs(y1 - info.feedBottom) > 8)) bad.push('faces leave a band (' + Math.round(y0) + ' above, ' + Math.round(info.feedBottom - y1) + ' below)');
    if (phone.name === 'iphone-15') await page.screenshot({ path: path.join(SHOTS, 'after-dock-faces-iphone-15.png') });
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS dock clears faces');
})().catch((e) => { console.error(e); process.exit(1); });
