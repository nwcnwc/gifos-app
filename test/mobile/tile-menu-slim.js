/*
 * Upright on an iPhone SE, a side tile is about 105px wide and 153px tall.
 * Tapping it opens the tile menu (Mute for everyone, Blur for everyone).
 * The menu sat 92px down, under Blur for all, so it ran over Full screen
 * and the name, and past the tile's foot; its buttons were 22px tall.
 * A host at the back of a church hall can't hit that, or read who it is for.
 * Opened on a slim tile, the menu stays inside the tile, its buttons are
 * 44px tall and read in full, and nothing else on the tile paints over
 * them or sits under them.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/tile-menu-slim.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

function hit(a, b) {
  return a && b && a.w > 0 && b.w > 0 && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
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
  await page.goto(BASE + '/run.html#v=tile-menu-slim&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  const bad = [];

  const names = ['Ruth', 'Margaret Johnson'];
  const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), names);
  if (!seeded || !seeded.ok) bad.push('could not seat ' + names.join(', '));
  await page.waitForTimeout(400);

  let shot = false;
  for (const want of names) {
    const tile = page.locator('#grid .tile', { has: page.locator('.name', { hasText: want }) }).first();
    if (!(await tile.count())) { bad.push('no tile reads "' + want + '"'); continue; }
    // Tap the video where no button or name is.
    const spot = await tile.evaluate((t) => {
      const r = t.getBoundingClientRect();
      for (let y = r.top + 4; y < r.bottom - 4; y += 4) {
        for (let x = r.left + 4; x < r.right - 4; x += 4) {
          const el = document.elementFromPoint(x, y);
          if (el && el.closest('.tile') === t && !el.closest('button, .name, .chips')) return { x, y };
        }
      }
      return null;
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
      return {
        open: t.classList.contains('menu'),
        slim: t.classList.contains('slim'),
        tile: box(t), name: box(t.querySelector('.name')), max: box(t.querySelector('.maxbtn')),
        blur: box(t.querySelector(':scope > .blurbox.on')),
        btns: btns.map((b) => ({
          text: b.textContent, box: box(b),
          cut: b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1,
          covered: topAt(box(b)) !== b,
        })),
      };
    });
    const tag = want + ' (' + Math.round(info.tile.w) + 'x' + Math.round(info.tile.h) + ' tile)';
    if (!info.slim) bad.push(tag + ': not a slim tile, the case is gone');
    if (!info.open) { bad.push(tag + ': a tap did not open the menu'); continue; }
    if (info.btns.length < 2) bad.push(tag + ': the menu shows ' + info.btns.length + ' buttons');
    for (const b of info.btns) {
      const bt = tag + ' "' + b.text + '"';
      const r = b.box;
      if (r.x < info.tile.x - 1 || r.y < info.tile.y - 1 || r.x + r.w > info.tile.x + info.tile.w + 1 || r.y + r.h > info.tile.y + info.tile.h + 1) bad.push(bt + ' leaves the tile');
      if (r.h < 44) bad.push(bt + ' is ' + Math.round(r.h) + 'px tall');
      if (b.cut) bad.push(bt + ' is cut');
      if (b.covered) bad.push(bt + ' is painted over');
      if (hit(r, info.max)) bad.push(bt + ' sits on Full screen');
      if (hit(r, info.blur)) bad.push(bt + ' sits on Blur for all');
      if (hit(r, info.name)) bad.push(bt + ' sits on the name');
    }
    if (!shot) {
      shot = true;
      await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-tile-menu-slim-iphone-se.png') });
    }
    // A second tap closes it.
    await page.touchscreen.tap(spot.x, spot.y);
    await page.waitForTimeout(200);
    if (await tile.evaluate((t) => t.classList.contains('menu'))) bad.push(tag + ': a second tap did not close the menu');
  }

  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS tile menu on a slim tile');
})().catch((e) => { console.error(e); process.exit(1); });
