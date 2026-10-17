/*
 * Sideways on an iPhone SE, every tile is about 105px wide and 100px tall.
 * A host taps Ruth's tile for Mute for all. The menu opened 92px down
 * that 100px tile, so the tile clipped it: Mute for all showed as a
 * sliver under the name and Blur for all not at all. A host holding
 * the phone sideways (a church livestream, a desk stand) could not mute
 * anyone. Opened on a short sideways tile, every button of the menu is on
 * screen, 44px tall, read in full, on top, and the menu says whose it is.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/tile-menu-land.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const { clearRoom } = require('./lib/clear-room');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext(Object.assign({}, devices['iPhone SE landscape'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=tile-menu-land&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  const bad = [];

  const names = ['Ruth', 'Margaret Johnson'];
  const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), names);
  // Ruth seats muted, and a muted guest's menu has no Mute for all
  // (host-tile-controls.js). Unmute her so the menu holds every button.
  await page.evaluate(() => window.__gifosVideo.setPeerStatusForTest('qa1', { muted: false }));
  if (!seeded || !seeded.ok) bad.push('could not seat ' + names.join(', '));
  // Blur for all shows only on a clear face: lock the room, faces clear.
  if (!(await clearRoom(page, ['qa1', 'qa2']))) bad.push('the faces never cleared in a locked room');
  await page.waitForTimeout(400);

  let shot = false;
  for (const want of names) {
    const tile = page.locator('#grid .tile', { has: page.locator('.name', { hasText: want }) }).first();
    if (!(await tile.count())) { bad.push('no tile reads "' + want + '"'); continue; }
    // Tap the tile (its video or name) where no button is, as far from the
    // buttons and the tile's edge as it gets (Chromium snaps a tap to a
    // button nearby). A two-line name leaves little video on a 100px tile.
    const spot = await tile.evaluate((t) => {
      const r = t.getBoundingClientRect();
      const btns = Array.from(t.querySelectorAll('button')).map((b) => b.getBoundingClientRect()).filter((b) => b.width > 0);
      let best = null;
      for (let y = r.top + 4; y < r.bottom - 4; y += 2) {
        for (let x = r.left + 4; x < r.right - 4; x += 2) {
          const el = document.elementFromPoint(x, y);
          if (!el || el.closest('.tile') !== t || el.closest('button')) continue;
          const d = Math.min(x - r.left, r.right - x, y - r.top, r.bottom - y,
            ...btns.map((b) => Math.max(b.left - x, x - b.right, b.top - y, y - b.bottom)));
          if (!best || d > best.d) best = { x, y, d };
        }
      }
      return best;
    });
    if (!spot) { bad.push(want + ': no spot on the tile is free to tap'); continue; }
    await page.touchscreen.tap(spot.x, spot.y);
    await page.waitForTimeout(200);
    const info = await tile.evaluate((t) => {
      const box = (el) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2) return null;
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      };
      const topAt = (b) => {
        if (!b) return null;
        const el = document.elementFromPoint(b.x + b.w / 2, b.y + b.h / 2);
        return el ? (el.closest('button') || el) : null;
      };
      const bar = t.querySelector('.modbar');
      const btns = bar ? Array.from(bar.children).filter((b) => box(b)) : [];
      const before = bar ? getComputedStyle(bar, '::before').content : '';
      return {
        open: t.classList.contains('menu'),
        slim: t.classList.contains('slim'),
        tile: box(t), vw: innerWidth, vh: innerHeight,
        who: (bar ? bar.innerText + ' ' + (bar.getAttribute('aria-label') || '') : '') + ' ' + (before === 'none' ? '' : before),
        btns: btns.map((b) => ({
          text: b.textContent, box: box(b),
          cut: b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1,
          covered: topAt(box(b)) !== b,
        })),
      };
    });
    const tag = want + ' (' + Math.round(info.tile.w) + 'x' + Math.round(info.tile.h) + ' tile)';
    if (!info.slim) bad.push(tag + ': not a slim tile, the case is gone');
    // Since Record/Captions moved beside the dock (sideways-callstate-beside.js)
    // these tiles are 155x148, not 105x100; the sideways sheet still serves them.
    if (info.tile.h > 160) bad.push(tag + ': not a short tile, the case is gone');
    if (!info.open) { bad.push(tag + ': a tap did not open the menu'); continue; }
    if (info.btns.length < 2) bad.push(tag + ': the menu shows ' + info.btns.length + ' buttons');
    if (!info.who.includes(want)) bad.push(tag + ': the menu does not say it is for ' + want);
    for (const b of info.btns) {
      const bt = tag + ' "' + b.text + '"';
      const r = b.box;
      if (r.x < 0 || r.y < 0 || r.x + r.w > info.vw || r.y + r.h > info.vh) bad.push(bt + ' leaves the screen');
      if (r.h < 44) bad.push(bt + ' is ' + Math.round(r.h) + 'px tall');
      if (b.cut) bad.push(bt + ' is cut');
      if (b.covered) bad.push(bt + ' is clipped or painted over');
    }
    if (!shot) {
      shot = true;
      await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-tile-menu-land-iphone-se.png') });
    }
    // Mute for all works from there.
    const mute = info.btns.find((b) => /^Mute for all$/.test(b.text));
    if (mute && !mute.covered) {
      await page.touchscreen.tap(mute.box.x + mute.box.w / 2, mute.box.y + mute.box.h / 2);
      await page.waitForTimeout(200);
      const now = await tile.evaluate((t) => t.querySelector('.modbar').children[0].textContent);
      if (now !== 'Unmute for all') bad.push(tag + ': tapping Mute for all left it reading "' + now + '"');
    }
    // A tap off the tile and off the menu closes it.
    await page.touchscreen.tap(8, 8);
    await page.waitForTimeout(200);
    if (await tile.evaluate((t) => t.classList.contains('menu'))) bad.push(tag + ': a tap off the tile did not close the menu');
  }

  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS tile menu on a short sideways tile');
})().catch((e) => { console.error(e); process.exit(1); });
