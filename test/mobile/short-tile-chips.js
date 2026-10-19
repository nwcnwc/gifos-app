/*
 * A church call with seven on it, on a short phone: an iPhone SE in Safari
 * (320x460), an SE with the "Important update" bar, a plain SE (its side
 * column of short tiles) and a sideways SE. Some tiles carry many chips:
 * Ruth has her hand up, is muted and is recording the meeting; Margaret
 * Johnson has her hand up, is muted and has her camera off; Grace is
 * muted, camera off and leaving. A tile under 130px tall has about 60px
 * beside Full screen for its chips, so three chips plus a text chip ran
 * down under the name, off the tile, or on top of each other. On every
 * whole tile each chip must show inside the tile, clear of the name, of
 * Full screen, of a camera-off tile's big initial and of every other chip.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/short-tile-chips.js
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
const BUSY = ['Ruth', 'Margaret Johnson', 'Grace'];

function look(page) {
  return page.evaluate((busy) => {
    const feed = document.getElementById('feed');
    const fr = feed.getBoundingClientRect();
    const clipB = innerHeight - parseFloat(getComputedStyle(feed).getPropertyValue('--comfy-clip') || 0);
    const meet = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const shown = (el) => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
    return [...document.querySelectorAll('#feed .tile')].filter((t) => t.querySelector('.name') && t.offsetParent).map((t) => {
      const r = t.getBoundingClientRect();
      const name = t.querySelector('.name').textContent.trim();
      const out = { name, w: Math.round(r.width), h: Math.round(r.height), short: t.classList.contains('short'), slim: t.classList.contains('slim'), clash: [], chips: [] };
      out.whole = r.top >= fr.top - 1 && r.bottom <= Math.min(fr.bottom, clipB) + 1 && r.left >= -1 && r.right <= innerWidth + 1;
      out.busy = busy.includes(name);
      const chips = [...t.querySelectorAll('.chips > span')].filter(shown);
      const label = (c) => (c.textContent.trim() || c.getAttribute('title') || c.getAttribute('aria-label') || 'an icon').replace(/\s+/g, ' ');
      for (const c of chips) {
        const cr = c.getBoundingClientRect();
        const what = '"' + label(c) + '"';
        out.chips.push(label(c));
        if (cr.top < r.top - 1 || cr.bottom > r.bottom + 1 || cr.left < r.left - 1 || cr.right > r.right + 1) out.clash.push(what + ' runs off the tile');
        if (c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 2) out.clash.push(what + ' is cut inside its chip');
        for (const [w, el] of [['the name', t.querySelector('.name')], ['Full screen', t.querySelector('.maxbtn')]]) if (shown(el) && meet(cr, el.getBoundingClientRect())) out.clash.push(what + ' meets ' + w);
      }
      // A camera-off tile's big initial is who it is; no chip may cover it.
      const av = t.classList.contains('cam-off') && t.querySelector('.avatar');
      const txt = av && shown(av) && [...av.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (txt) {
        const range = document.createRange();
        range.selectNodeContents(txt);
        const lr = range.getBoundingClientRect();
        const fs = parseFloat(getComputedStyle(av).fontSize);
        const cy = (lr.top + lr.bottom) / 2;
        const g = { left: lr.left, right: lr.right, top: cy - fs * 0.36, bottom: cy + fs * 0.36 };
        for (const c of chips) if (meet(g, c.getBoundingClientRect())) out.clash.push('"' + label(c) + '" covers the initial');
      }
      for (let i = 0; i < chips.length; i++) for (let j = i + 1; j < chips.length; j++) {
        if (meet(chips[i].getBoundingClientRect(), chips[j].getBoundingClientRect())) out.clash.push('"' + label(chips[i]) + '" meets "' + label(chips[j]) + '"');
      }
      return out;
    });
  }, BUSY);
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
    await page.goto(BASE + '/run.html#v=short-chips-' + process.pid + '-' + Date.now() + '-' + tag + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), NAMES);
    if (!seeded || !seeded.ok) { bad.push(tag + ': could not seat the guests'); await context.close(); continue; }
    await page.evaluate(() => {
      const v = window.__gifosVideo;
      v.setPeerStatusForTest('qa2', { hand: true, muted: true, rec: true });
      v.setPeerStatusForTest('qa3', { hand: true, muted: true, camOff: true });
      v.setPeerStatusForTest('qa5', { muted: true, camOff: true, lv: true });
    });
    if (upd) {
      const up = await page.waitForFunction(() => { const b = document.getElementById('update-bar'); return b && b.style.display !== 'none'; }, null, { timeout: 15000 }).then(() => true, () => false);
      if (!up) { bad.push(tag + ': the update bar never showed'); await context.close(); continue; }
    }
    await page.keyboard.press('Shift');
    await page.waitForTimeout(900);
    const got = await look(page);
    await page.screenshot({ path: path.join(SHOTS, 'short-tile-chips-' + tag + '.png') });
    shots.push('short-tile-chips-' + tag);
    const whole = got.filter((t) => t.whole);
    console.log(tag + ': ' + got.filter((t) => t.busy).map((t) => t.name + ' ' + t.w + 'x' + t.h + (t.short ? ' short' : '') + (t.whole ? '' : ' (cut)') + ' [' + t.chips.join(' | ') + ']').join(', '));
    if (!/land/.test(tag) && whole.filter((t) => t.short && t.busy).length < 1) bad.push(tag + ': no whole short busy tile to check');
    for (const t of whole) {
      if (t.busy && t.chips.length < 3) bad.push(tag + ': ' + t.name + ' shows only ' + t.chips.length + ' chips');
      for (const c of t.clash) bad.push(tag + ': on ' + t.name + '\'s tile ' + c);
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
  console.log('PASS a short tile shows every chip whole, clear of the name, Full screen and each other');
})().catch((e) => { console.error(e); process.exit(1); });
