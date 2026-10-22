/*
 * Upright on an iPhone SE with two or three people on the call, the side
 * tiles are about 105px wide. The name shared the bottom of the tile with
 * the 44px Full screen button, so "Ruth" read "R…" and "Margaret Johnson"
 * read "M…". An usher can't tell who is who.
 * Every name on a call tile reads in full and stays clear of Full screen
 * and Blur for all, which stay 44px targets on the tile. A "✋ hand raised"
 * chip reads in full too, not squeezed between the two buttons.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/portrait-tile-names.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

function hit(a, b) {
  return a && b && a.w > 0 && b.w > 0 && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

async function tiles(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('#grid .tile, .tile.me')).map((t) => {
    const box = (el) => {
      if (!el || getComputedStyle(el).display === 'none') return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const n = t.querySelector('.name');
    return {
      id: t.dataset.peer, tile: box(t), name: n ? n.textContent : '', nameBox: box(n),
      cut: n ? (n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1) : true,
      max: box(t.querySelector('.maxbtn')), blur: box(t.querySelector(':scope > .blurbox.on')),
      chips: Array.from(t.querySelectorAll('.chips span:not(.ico)')).filter((c) => c.getClientRects().length).map((c) => {
        const r = c.getBoundingClientRect();
        const cr = c.parentNode.getBoundingClientRect();
        return { text: c.textContent, cut: r.right > cr.right + 1 || c.scrollWidth > c.clientWidth + 1 };
      }),
    };
  }));
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
  await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'portrait-tile-names&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  const bad = [];

  // Three first: a first seed raises the third seat's hand, a re-seed doesn't.
  for (const names of [['Ruth', 'Margaret Johnson', 'Pastor David Lee'], ['Ruth', 'Margaret Johnson']]) {
    const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), names);
    if (!seeded || !seeded.ok) { bad.push('could not seat ' + names.join(', ')); continue; }
    await page.waitForTimeout(300);
    const all = await tiles(page);
    for (const want of names) {
      const t = all.find((x) => x.name === want);
      if (!t) { bad.push(names.length + ' on call: no tile reads "' + want + '"'); continue; }
      const tag = names.length + ' on call, ' + want + ' (' + Math.round(t.tile.w) + 'px tile)';
      if (t.cut) bad.push(tag + ': the name is cut');
      if (hit(t.nameBox, t.max)) bad.push(tag + ': the name sits under Full screen');
      if (hit(t.nameBox, t.blur)) bad.push(tag + ': the name sits under Blur for all');
      if (t.max && (t.max.w < 44 || t.max.h < 44)) bad.push(tag + ': Full screen is ' + Math.round(t.max.w) + 'x' + Math.round(t.max.h));
      if (t.max && t.blur && hit(t.max, t.blur)) bad.push(tag + ': Full screen and Blur for all overlap');
      t.chips.filter((c) => c.cut).forEach((c) => bad.push(tag + ': "' + c.text + '" is cut'));
      if (t.max && (t.max.x < t.tile.x || t.max.x + t.max.w > t.tile.x + t.tile.w + 1)) bad.push(tag + ': Full screen leaves the tile');
    }
    const me = all.find((x) => x.id === 'me');
    if (me && me.cut) bad.push(names.length + ' on call: your own name "' + me.name + '" is cut');
    if (names.length === 2) await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-portrait-tile-names-iphone-se.png') });
  }

  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS portrait tile names');
})().catch((e) => { console.error(e); process.exit(1); });
