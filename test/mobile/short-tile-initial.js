/*
 * A church call with seven on it, on a short phone: an iPhone SE in Safari
 * (320x460), an SE with the "Important update" bar, a plain SE (its side
 * column of short tiles) and a sideways SE. Some people have their camera
 * off: you, Margaret Johnson (hand up) and the Lobby iPad. A camera-off
 * tile shows their big initial instead of a face. On a tile under 130px
 * tall the two-line name ("✦Nathan (you)", "Margaret Johnson") was drawn
 * over that initial, so the letter that tells you who it is read as half a
 * letter behind a name pill. On every whole camera-off tile the initial
 * must show whole: inside the tile, clear of the name and of every chip,
 * and still big enough to read (20px or more).
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/short-tile-initial.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const NAMES = ['Pastor Dave', 'Ruth', 'Margaret Johnson', 'Lobby iPad', 'Grace', 'Tom & Linda Ruiz'];
// [device, tag, viewport or null, update bar?]
const VIEWS = [
  ['iPhone SE', 'iphone-se-safari', { width: 320, height: 460 }, false],
  ['iPhone SE', 'iphone-se-update-bar', null, true],
  ['iPhone SE', 'iphone-se', null, false],
  ['iPhone SE landscape', 'iphone-se-land', null, false],
];
const VERSION_JSON = '{"current":"0.9.99"}';
const CHANGELOG_JSON = '{"entries":[{"version":"0.9.99","critical":true}]}';

function look(page) {
  return page.evaluate(() => {
    const feed = document.getElementById('feed');
    const fr = feed.getBoundingClientRect();
    const clipB = innerHeight - parseFloat(getComputedStyle(feed).getPropertyValue('--comfy-clip') || 0);
    const meet = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const shown = (el) => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
    return [...document.querySelectorAll('#feed .tile.cam-off')].filter((t) => t.querySelector('.name') && t.offsetParent).map((t) => {
      const r = t.getBoundingClientRect();
      const out = { name: t.querySelector('.name').textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), short: t.classList.contains('short'), clash: [] };
      out.whole = r.top >= fr.top - 1 && r.bottom <= Math.min(fr.bottom, clipB) + 1 && r.left >= -1 && r.right <= innerWidth + 1;
      const av = t.querySelector('.avatar');
      const txt = av && [...av.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (!shown(av) || !txt || av.classList.contains('has-img')) { out.clash.push('no initial shows'); return out; }
      // The shaded avatar still covers the whole tile (nothing behind it shows).
      const ar = av.getBoundingClientRect();
      if (Math.abs(ar.top - r.top) > 3 || Math.abs(ar.bottom - r.bottom) > 3 || Math.abs(ar.left - r.left) > 3 || Math.abs(ar.right - r.right) > 3) out.clash.push('the avatar no longer covers the tile');
      // The drawn letter: its line box, trimmed to the font's cap height.
      const range = document.createRange();
      range.selectNodeContents(txt);
      const lr = range.getBoundingClientRect();
      const fs = parseFloat(getComputedStyle(av).fontSize);
      const cy = (lr.top + lr.bottom) / 2;
      const g = { left: lr.left, right: lr.right, top: cy - fs * 0.36, bottom: cy + fs * 0.36 };
      out.glyph = Math.round(g.bottom - g.top);
      if (g.top < r.top - 1 || g.bottom > r.bottom + 1 || g.left < r.left - 1 || g.right > r.right + 1) out.clash.push('the initial runs off the tile');
      if (out.glyph < 20) out.clash.push('the initial is only ' + out.glyph + 'px tall');
      const parts = [['the name', t.querySelector('.name')], ['Full screen', t.querySelector('.maxbtn')]];
      t.querySelectorAll('.chips span').forEach((c) => parts.push([c.textContent.trim() || c.getAttribute('title') || c.getAttribute('aria-label') || 'an icon', c]));
      for (const [what, el] of parts) if (shown(el) && meet(g, el.getBoundingClientRect())) out.clash.push(what + ' covers the initial');
      return out;
    });
  });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const bad = [];
  const shots = [];
  for (const [dev, tag, vp, upd] of VIEWS) {
    const opts = Object.assign({}, devices[dev], { hasTouch: true, serviceWorkers: 'block' });
    if (vp) opts.viewport = vp;
    const context = await browser.newContext(opts);
    await context.addInitScript((u) => {
      try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {}
      if (u) window.GIFOS_VERSION = '0.9.20';
    }, upd);
    const page = await context.newPage();
    if (upd) {
      await page.route('**/version.json*', (r) => r.fulfill({ contentType: 'application/json', body: VERSION_JSON }));
      await page.route('**/changelog.json*', (r) => r.fulfill({ contentType: 'application/json', body: CHANGELOG_JSON }));
    }
    await page.goto(BASE + '/run.html#v=short-initial-' + process.pid + '-' + Date.now() + '-' + tag + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), NAMES);
    if (!seeded || !seeded.ok) { bad.push(tag + ': could not seat the guests'); await context.close(); continue; }
    // Margaret (hand up) and the Lobby iPad turn their cameras off; Margaret is muted too.
    await page.evaluate(() => {
      window.__gifosVideo.setPeerStatusForTest('qa3', { camOff: true, muted: true });
      window.__gifosVideo.setPeerStatusForTest('qa4', { camOff: true });
    });
    if (upd) {
      const up = await page.waitForFunction(() => { const b = document.getElementById('update-bar'); return b && b.style.display !== 'none'; }, null, { timeout: 15000 }).then(() => true, () => false);
      if (!up) { bad.push(tag + ': the update bar never showed'); await context.close(); continue; }
    }
    await page.keyboard.press('Shift');
    await page.waitForTimeout(900);
    const got = await look(page);
    await page.screenshot({ path: path.join(SHOTS, 'short-tile-initial-' + tag + '.png') });
    shots.push('short-tile-initial-' + tag);
    const whole = got.filter((t) => t.whole);
    console.log(tag + ': ' + got.map((t) => t.name + ' ' + t.w + 'x' + t.h + (t.short ? ' short' : '') + (t.whole ? '' : ' (cut)') + ' glyph ' + t.glyph).join(', '));
    if (!/land/.test(tag) && whole.filter((t) => t.short).length < 1) bad.push(tag + ': no whole short camera-off tile to check');
    for (const t of whole) for (const c of t.clash) bad.push(tag + ': on ' + t.name + '\'s tile ' + c);
    await context.close();
  }
  await browser.close();
  for (const f of shots) {
    const p = path.join(SHOTS, f + '.png');
    if (fs.existsSync(p)) fs.renameSync(p, path.join(SHOTS, (bad.length ? 'before-' : 'after-') + f + '.png'));
  }
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS a short camera-off tile shows its initial whole, clear of the name and chips');
})().catch((e) => { console.error(e); process.exit(1); });
