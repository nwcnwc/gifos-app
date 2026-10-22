/*
 * Four people on a phone must not collapse into a short strip.
 * Every tile stays near a portrait-phone shape: not a wide squash,
 * and not a skinny slice. Four faces are two rows of two.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/see-everyone.js
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

const PHONES = [
  { name: 'iphone-15', device: devices['iPhone 15'], minH: 140 },
  { name: 'iphone-se', device: devices['iPhone SE'], minH: 120 },
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
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Pat'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'see-everyone-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.evaluate((people) => window.__gifosVideo.presentPeers(people), PEOPLE);
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll('.tile')).map((el) => {
        const b = el.getBoundingClientRect();
        return {
          name: ((el.querySelector('.name') || {}).textContent || '').trim(),
          top: b.top, bottom: b.bottom, h: b.height, w: b.width,
          shown: b.width > 8 && b.height > 8 && el.style.display !== 'none',
        };
      }).filter((t) => t.shown);
      const state = document.getElementById('callstate').getBoundingClientRect();
      return { tiles: tiles, limit: state.top, vh: window.innerHeight };
    });
    const bad = [];
    if (info.tiles.length < 4) bad.push('only ' + info.tiles.length + ' faces');
    const bands = [];
    for (const t of info.tiles) {
      const aspect = t.w / t.h;
      if (t.h < phone.minH) bad.push((t.name || 'tile') + ' is ' + Math.round(t.w) + 'x' + Math.round(t.h));
      if (aspect > 1.1) bad.push((t.name || 'tile') + ' is squashed (' + aspect.toFixed(2) + ')');
      if (aspect < 0.4) bad.push((t.name || 'tile') + ' is thinner than a phone (' + aspect.toFixed(2) + ')');
      if (t.bottom > info.limit + 1) bad.push((t.name || 'tile') + ' runs under Live');
      let band = bands.find((b) => Math.abs(b.top - t.top) < 8);
      if (!band) { band = { top: t.top, n: 0 }; bands.push(band); }
      band.n += 1;
    }
    if (info.tiles.length >= 4) {
      if (bands.length !== 2) bad.push(bands.length + ' rows, want 2');
      if (bands.some((b) => b.n !== 2)) bad.push('rows are ' + bands.map((b) => b.n).join('-'));
    }
    if (phone.name === 'iphone-15') {
      const shot = bad.length ? 'before-see-everyone-iphone-15.png' : 'after-see-everyone-iphone-15.png';
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
  console.log('PASS see everyone');
})().catch((e) => { console.error(e); process.exit(1); });
