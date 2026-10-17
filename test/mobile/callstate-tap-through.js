/*
 * Sideways on a Pixel 5 (802x293), Record and Captions sit in a row that
 * runs the full width of the screen, from y 123 to 167. The tiles run
 * from y 66 to 162, so the empty part of that row lay over the bottom of
 * every tile. A host who tapped Ruth's name to mute her hit the empty row
 * and nothing opened. A tap on a tile's name opens that tile's menu, and
 * Record and Captions still take their own taps.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/callstate-tap-through.js
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
  const context = await browser.newContext(Object.assign({}, devices['Pixel 5 landscape'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  // Own room per run: two runs at once would share the seats.
  const room = 'callstate-tap-' + process.pid + '-' + Date.now();
  await page.goto(BASE + '/run.html#v=' + room + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  const bad = [];

  const names = ['Ruth', 'Margaret Johnson'];
  const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), names);
  if (!seeded || !seeded.ok) bad.push('could not seat ' + names.join(', '));
  await page.waitForTimeout(500);

  const row = await page.evaluate(() => {
    const cs = document.getElementById('callstate');
    const r = cs.getBoundingClientRect();
    return { shown: !cs.hidden && r.height > 0, top: r.top, bottom: r.bottom };
  });
  if (!row.shown) bad.push('Record/Captions row is not on the call, the case is gone');

  let shot = false;
  for (const want of names) {
    const tile = page.locator('#grid .tile', { has: page.locator('.name', { hasText: want }) }).first();
    if (!(await tile.count())) { bad.push('no tile reads "' + want + '"'); continue; }
    // Tap the part of the name the row lies over (a long name wraps to
    // three lines on WebKit, so its middle can sit above the row).
    const spot = await tile.evaluate((t, row) => {
      const n = t.querySelector('.name').getBoundingClientRect();
      const x = n.left + n.width / 2;
      const top = Math.max(n.top, row.top);
      const bottom = Math.min(n.bottom, row.bottom);
      const y = bottom > top ? (top + bottom) / 2 : n.top + n.height / 2;
      const el = document.elementFromPoint(x, y);
      return { x, y, onTile: !!(el && el.closest('.tile') === t), hit: el ? (el.id || el.className || el.tagName) : 'nothing' };
    }, row);
    if (row.shown && (spot.y < row.top || spot.y > row.bottom)) bad.push(want + ': the name does not reach the Record row, the case is gone');
    if (!spot.onTile) bad.push(want + ': the name where the row meets it is under #' + spot.hit + ', not the tile');
    if (!shot) {
      shot = true;
      await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-callstate-tap-through-pixel5-land.png') });
    }
    await page.touchscreen.tap(spot.x, spot.y);
    await page.waitForTimeout(250);
    if (!(await tile.evaluate((t) => t.classList.contains('menu')))) bad.push(want + ': a tap on the name did not open the menu');
    await page.touchscreen.tap(8, 8);
    await page.waitForTimeout(200);
  }

  // Record and Captions still take their own taps.
  for (const id of ['call-rec', 'call-cc']) {
    const hit = await page.evaluate((id) => {
      const b = document.getElementById(id).getBoundingClientRect();
      const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return !!(el && el.closest('#' + id));
    }, id);
    if (!hit) bad.push('#' + id + ' no longer takes a tap');
  }
  await page.locator('#call-cc').tap();
  await page.waitForTimeout(200);
  if ((await page.locator('#call-cc').getAttribute('aria-pressed')) !== 'true') bad.push('tapping Captions did not turn it on');

  // A quiet call hides the row; its buttons must not catch taps then.
  await page.evaluate(() => document.body.classList.add('chrome-away'));
  await page.waitForTimeout(300);
  const ghost = await page.evaluate(() => {
    const b = document.getElementById('call-rec').getBoundingClientRect();
    const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !!(el && el.closest('#callstate'));
  });
  if (ghost) bad.push('a hidden Record button still catches taps on a quiet call');

  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS a tap on a tile name beside Record/Captions opens its menu');
})().catch((e) => { console.error(e); process.exit(1); });
