/*
 * A church call on an iPhone SE with seven on it: every guest tile is about
 * 105px wide. Upright, Margaret Johnson's "✋ hand raised" chip is 121px, so
 * the tile cut it to "✋ hand rais". Sideways it was not there at all: the
 * chip row sat between Full screen and Blur (left 56px, right 56px), which
 * leaves no room on a 105px tile. The pastor can't see who wants to speak.
 * A raised hand reads in full, on the tile, upright and sideways, and stays
 * clear of Full screen and the name.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/hand-raised-small-tiles.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
// A first seed raises the third seat's hand: Margaret Johnson.
const NAMES = ['Pastor Dave', 'Ruth', 'Margaret Johnson', 'Lobby iPad', 'Grace', 'Tom & Linda Ruiz'];
const HAND = 'Margaret Johnson';

function hit(a, b) {
  return a && b && a.w > 0 && b.w > 0 && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

async function look(page, who) {
  return page.evaluate((who) => {
    const t = Array.from(document.querySelectorAll('#grid .tile')).find((x) => {
      const n = x.querySelector('.name');
      return n && n.textContent.trim() === who;
    });
    if (!t) return null;
    const box = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const chip = Array.from(t.querySelectorAll('.chips span.warn')).find((c) => /hand/i.test(c.textContent));
    const cb = box(chip);
    let onTop = false;
    if (cb && cb.w > 0) {
      const el = document.elementFromPoint(cb.x + cb.w / 2, cb.y + cb.h / 2);
      onTop = !!el && (el === chip || chip.contains(el));
    }
    return {
      tile: box(t), chip: cb, text: chip ? chip.textContent.trim() : '', onTop,
      cut: chip ? (chip.scrollWidth > chip.clientWidth + 1 || chip.scrollHeight > chip.clientHeight + 1) : false,
      max: box(t.querySelector('.maxbtn')), name: box(t.querySelector('.name')),
    };
  }, who);
}

async function run(browser, tag, device, bad) {
  const was = bad.length;
  const context = await browser.newContext(Object.assign({}, device, { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=hand-raised-small-' + tag + process.pid + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), NAMES);
  if (!seeded || !seeded.ok) { bad.push(tag + ': could not seat the guests'); await context.close(); return; }
  await page.waitForTimeout(600);
  const t = await look(page, HAND);
  const at = tag + ' (' + (t && t.tile ? Math.round(t.tile.w) + 'x' + Math.round(t.tile.h) : '?') + ' tile)';
  if (!t) bad.push(tag + ': no tile reads "' + HAND + '"');
  else if (!t.chip || t.chip.w < 2) bad.push(at + ': no "✋ hand raised" on ' + HAND + '\'s tile');
  else {
    const r = t.chip, tl = t.tile;
    if (t.cut) bad.push(at + ': "' + t.text + '" is cut inside its chip');
    if (r.x < tl.x - 1 || r.x + r.w > tl.x + tl.w + 1 || r.y < tl.y - 1 || r.y + r.h > tl.y + tl.h + 1) {
      bad.push(at + ': "' + t.text + '" runs ' + Math.round(Math.max(r.x + r.w - (tl.x + tl.w), tl.x - r.x, r.y + r.h - (tl.y + tl.h), tl.y - r.y)) + 'px off the tile');
    }
    if (!t.onTop) bad.push(at + ': something covers "' + t.text + '"');
    if (hit(r, t.max)) bad.push(at + ': "' + t.text + '" sits under Full screen');
    if (hit(r, t.name)) bad.push(at + ': "' + t.text + '" sits on the name');
  }
  await page.screenshot({ path: path.join(SHOTS, (bad.length > was ? 'before' : 'after') + '-hand-raised-small-tiles-' + tag + '.png') });
  await context.close();
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const bad = [];
  await run(browser, 'iphone-se', devices['iPhone SE'], bad);
  await run(browser, 'iphone-se-land', devices['iPhone SE landscape'], bad);
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS a raised hand reads in full on a small phone tile');
})().catch((e) => { console.error(e); process.exit(1); });
