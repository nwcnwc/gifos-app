/*
 * A church call on a phone with seven on it. Each front-row face has a
 * small purple dot in its top right corner (.tile[data-tier="row"]::after).
 * On a narrow tile, Margaret Johnson's "✋ hand raised" chip runs into that
 * corner and the dot is painted on top of it, over the "d" of "hand"
 * (sideways SE, iPhone 12 and Pixel 5). The dot is a pseudo-element, so a
 * hit test never sees it; this test measures it.
 * The dot never covers a chip, Full screen, Blur or a name, on any tile.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/tile-dot-clear.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
// A first seed raises the third seat's hand: Margaret Johnson.
const NAMES = ['Pastor Dave', 'Ruth', 'Margaret Johnson', 'Lobby iPad', 'Grace', 'Tom & Linda Ruiz'];
const PHONES = [['iPhone SE landscape', 'iphone-se-land'], ['iPhone 12 landscape', 'iphone-12-land'],
  ['Pixel 5 landscape', 'pixel-5-land'], ['iPhone SE', 'iphone-se'], ['Pixel 5', 'pixel-5']];

function look(page) {
  return page.evaluate(() => {
    const shown = (el) => {
      if (!el || !el.offsetParent) return null;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? r : null;
    };
    const meet = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const out = [];
    for (const t of document.querySelectorAll('#feed .tile')) {
      const n = t.querySelector('.name');
      if (!n || !t.offsetParent) continue;
      const d = getComputedStyle(t, '::after');
      if (d.content === 'none' || d.display === 'none' || d.visibility === 'hidden' || +d.opacity === 0) continue;
      const w = parseFloat(d.width), h = parseFloat(d.height);
      if (!(w > 0 && h > 0)) continue;
      const tr = t.getBoundingClientRect();
      const top = tr.top + t.clientTop + parseFloat(d.top), right = tr.left + t.clientLeft + t.clientWidth - parseFloat(d.right);
      const dot = { left: right - w, right, top, bottom: top + h };
      const parts = [...t.querySelectorAll('.chips span')].map((c) => [c.textContent.trim() || c.className, c])
        .concat([['Full screen', t.querySelector('.maxbtn')], ['Blur', t.querySelector(':scope > .blurbox')], ['name', n]]);
      const hits = parts.map(([label, el]) => [label, shown(el)]).filter(([, r]) => r && meet(dot, r)).map(([label]) => label);
      out.push({ name: n.textContent.trim(), w: Math.round(tr.width), h: Math.round(tr.height), hits });
    }
    return out;
  });
}

async function run(browser, dev, tag, bad) {
  const was = bad.length;
  const context = await browser.newContext(Object.assign({}, devices[dev], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=tile-dot-' + process.pid + '-' + Date.now() + '-' + tag + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), NAMES);
  if (!seeded || !seeded.ok) { bad.push(tag + ': could not seat the guests'); await context.close(); return; }
  await page.waitForTimeout(900);
  const tiles = await look(page);
  if (!tiles.some((t) => t.name === 'Margaret Johnson')) bad.push(tag + ': no dot on Margaret Johnson\'s tile to check');
  for (const t of tiles) {
    if (t.hits.length) bad.push(tag + ': the dot on ' + t.name + ' (' + t.w + 'x' + t.h + ') covers ' + t.hits.map((x) => '"' + x + '"').join(', '));
  }
  await page.screenshot({ path: path.join(SHOTS, (bad.length > was ? 'before' : 'after') + '-tile-dot-clear-' + tag + '.png') });
  await context.close();
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const bad = [];
  for (const [dev, tag] of PHONES) await run(browser, dev, tag, bad);
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS the purple dot covers no chip, button or name on any phone tile');
})().catch((e) => { console.error(e); process.exit(1); });
