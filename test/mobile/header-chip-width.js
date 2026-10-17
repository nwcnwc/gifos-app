/*
 * A church service on phones: Margaret Johnson's hand is up, so the header
 * chip carries "GifOS", the room name and a "✋ 1" button. Upright, Fit, the
 * build name and Unmute sit on the row under the chip, so the chip has the
 * whole top row. On an SE in Safari (320x460) the chip still stopped 140px
 * short of the right edge, as if Fit were beside it, and the room name
 * shrank to "h…" with the right of the row empty.
 * Here, upright on every phone screen (and sideways, where Fit does share
 * the row): when the room name is cut, the chip uses its row to the edge or
 * up to whatever sits beside it; the chip stays on screen and runs over
 * none of Fit, the build name, Unmute or the faces; the hand button stays
 * whole and tappable.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/header-chip-width.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
// The third seat (Margaret Johnson) gets her hand up on the first seed.
const NAMES = ['Pastor Dave', 'Ruth', 'Margaret Johnson', 'Lobby iPad', 'Grace', 'Tom & Linda Ruiz'];
const VIEWS = [['iPhone SE', 'iphone-se'], ['iPhone SE', 'iphone-se-safari', { width: 320, height: 460 }],
  ['iPhone SE', 'iphone-se2-safari', { width: 375, height: 553 }],
  ['iPhone 12', 'iphone-12'], ['Pixel 5', 'pixel-5'],
  ['iPhone SE landscape', 'iphone-se-land'], ['Pixel 5 landscape', 'pixel-5-land']];

function look(page) {
  return page.evaluate(() => {
    const box = (r) => [r.left, r.top, r.width, r.height].map(Math.round).join(',');
    const over = (a, b) => a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5 && a.left < b.right - 0.5 && a.right > b.left + 0.5;
    const seen = (el) => {
      if (!el || !el.getClientRects().length) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.2) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    const out = [];
    const chip = document.querySelector('.topchip');
    const name = document.querySelector('.topchip .statustext');
    const hand = document.getElementById('hdrhand');
    const cr = chip.getBoundingClientRect();
    const others = [];
    const add = (what, el) => { if (seen(el)) others.push([what, el.getBoundingClientRect()]); };
    add('Fit', document.getElementById('fitbtn'));
    add('Unmute', document.getElementById('unmute'));
    add('Camera', document.getElementById('showcam'));
    add('the build name', document.getElementById('gifos-build-float'));
    document.querySelectorAll('#feed #grid .tile').forEach((t) => add('the face of ' + ((t.querySelector('.name') || {}).textContent || '?').trim(), t));
    if (cr.left < 0 || cr.right > innerWidth + 0.5 || cr.top < 0) out.push('the chip (' + box(cr) + ') runs off the screen');
    for (const [w, r] of others) if (over(cr, r)) out.push('the chip (' + box(cr) + ') runs over ' + w + ' (' + box(r) + ')');
    const cut = name.scrollWidth > name.clientWidth + 1;
    // The row ends at the screen edge (14px margin, like the left), or at
    // the first thing standing beside the chip in its row.
    let end = innerWidth - 14;
    for (const [, r] of others) if (r.top < cr.bottom && r.bottom > cr.top && r.left >= cr.right - 0.5) end = Math.min(end, r.left - 8);
    // Fit beside the chip turns into the wider "▦ Scroll" on a tap, and the
    // chip must not run under it then.
    const fit = document.getElementById('fitbtn');
    const fr = fit.getBoundingClientRect();
    if (seen(fit) && fr.top < cr.bottom && fr.bottom > cr.top) {
      const was = fit.textContent;
      fit.textContent = '▦ Scroll';
      end = Math.min(end, fit.getBoundingClientRect().left - 8);
      fit.textContent = was;
    }
    const spare = Math.round(end - cr.right);
    if (spare < -0.5) out.push('the chip (' + box(cr) + ') leaves no room for Fit as "▦ Scroll"');
    if (cut && spare > 24) out.push('the room name is cut to ' + Math.round(name.clientWidth) + ' of ' + name.scrollWidth + 'px while ' + spare + 'px of its row stand empty');
    if (seen(hand)) {
      const hr = hand.getBoundingClientRect();
      if (hr.width < 44 || hr.height < 40) out.push('the hand button is too small to tap (' + box(hr) + ')');
      if (hr.right > cr.right + 0.5 || hand.scrollWidth > hand.clientWidth + 1) out.push('the hand button is cut (' + box(hr) + ')');
    } else out.push('no hand button in the chip');
    return { out, chip: box(cr), name: Math.round(name.clientWidth) + '/' + name.scrollWidth, spare };
  });
}

async function run(browser, dev, tag, vp, bad) {
  const was = bad.length;
  const opts = Object.assign({}, devices[dev], { hasTouch: true, serviceWorkers: 'block' });
  if (vp) opts.viewport = vp;
  const context = await browser.newContext(opts);
  await context.addInitScript(() => {
    try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {}
  });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=grace-sunday-' + process.pid + '-' + Date.now() + '-' + tag + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.click().catch(() => {});
  const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), NAMES);
  if (!seeded || !seeded.ok) { bad.push(tag + ': could not seat the guests'); await context.close(); return; }
  const queued = await page.waitForFunction(() => document.getElementById('hdrhand').classList.contains('on'), null, { timeout: 15000 }).then(() => true, () => false);
  if (!queued) { bad.push(tag + ': the hand button never showed'); await context.close(); return; }
  await page.keyboard.press('Shift');
  await page.waitForTimeout(1500);
  const l = await look(page);
  for (const u of l.out) bad.push(tag + ': ' + u);
  console.log(tag + ': chip ' + l.chip + ' name ' + l.name + ' spare ' + l.spare);
  const shot = await page.screenshot();
  fs.writeFileSync(path.join(SHOTS, (bad.length > was ? 'before' : 'after') + '-header-chip-width-' + tag + '.png'), shot);
  await context.close();
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const bad = [];
  for (const [dev, tag, vp] of VIEWS) await run(browser, dev, tag, vp, bad);
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS the header chip uses its row, so the room name reads as far as the row allows');
})().catch((e) => { console.error(e); process.exit(1); });
