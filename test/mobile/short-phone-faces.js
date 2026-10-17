/*
 * A church call with seven on it, on a phone whose call space is short:
 * an iPhone SE in Safari (the address bar and toolbar take about 100px, so
 * the page is 320x460, not the 320x568 a test phone gets), a 375x553
 * iPhone SE (2nd gen) in Safari, and an SE with the "Important update" bar.
 * The faces band there is wider than tall, so the packer took its sideways
 * path. When seven faces could not all fit at 96px, it made each face as
 * tall as the whole band: two or three faces showed and "↓5" hid the rest,
 * though two rows of three 96px+ faces fit.
 * Now a short band shows as many whole faces as legal tiles allow (two rows
 * of three on these screens), and only the rest scroll. Every face stays at
 * least 96px on both sides and nothing lies under the dock. A 99px-tall
 * upright tile kept the tall tile's layout, so a two-line name covered
 * "✋ hand raised" and the mute icon; on every whole face the chips, the
 * name and Full screen must stay clear of each other.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/short-phone-faces.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const NAMES = ['Pastor Dave', 'Ruth', 'Margaret Johnson', 'Lobby iPad', 'Grace', 'Tom & Linda Ruiz'];
// [device, tag, viewport or null, update bar?, faces that must show whole]
const VIEWS = [
  ['iPhone SE', 'iphone-se-safari', { width: 320, height: 460 }, false, 6],
  ['iPhone SE', 'iphone-se-2-safari', { width: 375, height: 553 }, false, 7],
  ['iPhone SE', 'iphone-se-update-bar', null, true, 6],
  ['iPhone SE', 'iphone-se', null, false, 7],
  ['iPhone SE landscape', 'iphone-se-land', null, false, 5],
];
const VERSION_JSON = '{"current":"0.9.99"}';
const CHANGELOG_JSON = '{"entries":[{"version":"0.9.99","critical":true}]}';

function look(page) {
  return page.evaluate(() => {
    const feed = document.getElementById('feed');
    const fr = feed.getBoundingClientRect();
    const clipB = innerHeight - parseFloat(getComputedStyle(feed).getPropertyValue('--comfy-clip') || 0);
    const meet = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const btns = [...document.querySelectorAll('#callstate button')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect());
    const tiles = [...document.querySelectorAll('#feed .tile')].filter((t) => t.querySelector('.name') && t.offsetParent).map((t) => {
      const r = t.getBoundingClientRect();
      // Chips (mute, hand), the name and Full screen must not cover each other.
      const parts = [['the name', t.querySelector('.name')], ['Full screen', t.querySelector('.maxbtn')]];
      t.querySelectorAll('.chips span').forEach((c) => parts.push([c.textContent.trim() || c.getAttribute('title') || c.getAttribute('aria-label') || 'an icon', c]));
      const seen = parts.filter(([, el]) => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none')
        .map(([what, el]) => [what, el.getBoundingClientRect()]);
      const clash = [];
      for (let i = 0; i < seen.length; i++) {
        const [a, ar] = seen[i];
        if (ar.top < r.top - 1 || ar.bottom > r.bottom + 1 || ar.left < r.left - 1 || ar.right > r.right + 1) clash.push(a + ' runs off the tile');
        for (let j = i + 1; j < seen.length; j++) if (meet(ar, seen[j][1])) clash.push(a + ' and ' + seen[j][0] + ' overlap');
      }
      return {
        clash,
        name: t.querySelector('.name').textContent.trim(), w: Math.round(r.width), h: Math.round(r.height),
        whole: r.top >= fr.top - 1 && r.bottom <= Math.min(fr.bottom, clipB) + 1 && r.left >= -1 && r.right <= innerWidth + 1,
        under: [bar, ...btns].some((c) => meet(r, c)),
      };
    });
    const hint = document.querySelector('#feed .stad-band');
    return { tiles, hint: hint && hint.offsetParent ? hint.textContent.trim() : '' };
  });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const bad = [];
  const shots = [];
  for (const [dev, tag, vp, upd, want] of VIEWS) {
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
    await page.goto(BASE + '/run.html#v=short-phone-' + process.pid + '-' + Date.now() + '-' + tag + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), NAMES);
    if (!seeded || !seeded.ok) { bad.push(tag + ': could not seat the guests'); await context.close(); continue; }
    if (upd) {
      const shown = await page.waitForFunction(() => { const b = document.getElementById('update-bar'); return b && b.style.display !== 'none'; }, null, { timeout: 15000 }).then(() => true, () => false);
      if (!shown) { bad.push(tag + ': the update bar never showed'); await context.close(); continue; }
    }
    await page.keyboard.press('Shift');
    await page.waitForTimeout(900);
    const got = await look(page);
    await page.screenshot({ path: path.join(SHOTS, 'short-phone-faces-' + tag + '.png') });
    shots.push('short-phone-faces-' + tag);
    const whole = got.tiles.filter((t) => t.whole);
    console.log(tag + ': ' + whole.length + ' of ' + got.tiles.length + ' whole, ' + got.tiles.map((t) => t.w + 'x' + t.h).join(' ') + (got.hint ? ' hint ' + got.hint : ''));
    if (got.tiles.length !== 7) bad.push(tag + ': ' + got.tiles.length + ' tiles, want 7');
    if (whole.length < want) bad.push(tag + ': only ' + whole.length + ' of 7 faces show whole (' + whole.map((t) => t.name).join(', ') + '), want ' + want);
    for (const t of got.tiles) {
      if (Math.min(t.w, t.h) < 96) bad.push(tag + ': ' + t.name + ' is ' + t.w + 'x' + t.h);
      if (t.whole && t.under) bad.push(tag + ': ' + t.name + ' lies under the dock');
      if (t.whole) for (const c of t.clash) bad.push(tag + ': on ' + t.name + '\'s tile ' + c);
    }
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
  console.log('PASS a short phone shows as many whole faces as legal tiles allow');
})().catch((e) => { console.error(e); process.exit(1); });
