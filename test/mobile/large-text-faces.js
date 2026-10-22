/*
 * At 200% text the dock and Live take more of the screen. Four people
 * still have to be on screen, in a portrait-phone shape, above Live.
 * An SE was showing one face and parking the other three below the fold.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/large-text-faces.js
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

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  const phones = [
    { name: 'iphone-se-200', device: devices['iPhone SE'] },
    { name: 'iphone-15-200', device: devices['iPhone 15'] },
  ];
  for (const phone of phones) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript(() => {
      try {
        localStorage.setItem('gifos_name', 'Pat');
        localStorage.setItem('gifos_ui_scale', '2');
      } catch (e) {}
    });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'large-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.evaluate((people) => window.__gifosVideo.presentPeers(people), PEOPLE);
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => {
      const state = document.getElementById('callstate').getBoundingClientRect();
      const tiles = Array.from(document.querySelectorAll('.tile')).map((el) => {
        const b = el.getBoundingClientRect();
        return {
          name: ((el.querySelector('.name') || {}).textContent || '').trim(),
          top: b.top, bottom: b.bottom, h: b.height, w: b.width,
          shown: b.width > 8 && b.height > 8 && el.style.display !== 'none',
        };
      }).filter((t) => t.shown);
      return { tiles: tiles, limit: state.top, vh: window.innerHeight };
    });
    const bad = [];
    if (info.tiles.length < 4) bad.push('only ' + info.tiles.length + ' faces');
    for (const t of info.tiles) {
      const aspect = t.w / t.h;
      const short = Math.min(t.w, t.h);
      if (short < 96) bad.push((t.name || 'tile') + ' is ' + Math.round(t.w) + 'x' + Math.round(t.h));
      if (aspect > 1.05) bad.push((t.name || 'tile') + ' is a wide strip (' + aspect.toFixed(2) + ')');
      if (aspect < 0.44) bad.push((t.name || 'tile') + ' is thinner than a phone (' + aspect.toFixed(2) + ')');
      if (t.bottom > info.limit + 1) bad.push((t.name || 'tile') + ' runs under Live');
      if (t.top < -1 || t.bottom > info.vh + 1) bad.push((t.name || 'tile') + ' is off screen');
    }
    if (phone.name === 'iphone-se-200') {
      const shot = (bad.length ? 'before' : 'after') + '-large-text-faces-iphone-se.png';
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
  console.log('PASS large text faces');
})().catch((e) => { console.error(e); process.exit(1); });
