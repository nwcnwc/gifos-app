/*
 * A church call on a sideways iPhone SE with seven on it. The tiles fill
 * the screen. Record, Captions, and the dock float over them, so a wake
 * does not reserve a band and a face may sit under the buttons. A "more"
 * hint shows when some faces are past the edge, and scrolling brings every
 * face up whole. A name or Full screen that the dock does not cover is
 * still the thing under the pointer.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/sideways-crowd-chrome.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const NAMES = ['Pastor Dave', 'Ruth', 'Margaret Johnson', 'Lobby iPad', 'Grace', 'Tom & Linda Ruiz'];

// Everything a person sees of each tile: is any of it painted under the call's
// buttons, and are the name and Full screen the top thing where they sit.
function look(page) {
  return page.evaluate(() => {
    const feed = document.getElementById('feed');
    const fr = feed.getBoundingClientRect();
    const chrome = [];
    const bar = document.querySelector('.bar');
    if (bar) chrome.push(['the dock', bar.getBoundingClientRect()]);
    const cs = document.getElementById('callstate');
    if (cs && !cs.hidden && getComputedStyle(cs).visibility !== 'hidden') {
      for (const b of cs.querySelectorAll('button')) {
        if (b.offsetParent) chrome.push([b.textContent.trim() || 'Record row', b.getBoundingClientRect()]);
      }
    }
    const shown = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return null;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1 ? r : null;
    };
    // The part of r the feed shows (the feed clips its tiles).
    const clip = (r) => {
      const x0 = Math.max(r.left, fr.left), x1 = Math.min(r.right, fr.right);
      const y0 = Math.max(r.top, fr.top), y1 = Math.min(r.bottom, fr.bottom);
      return x1 - x0 > 1 && y1 - y0 > 1 ? { left: x0, right: x1, top: y0, bottom: y1 } : null;
    };
    const meet = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const onTop = (el, r) => {
      const at = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      return !!at && (at === el || el.contains(at));
    };
    const tiles = [];
    for (const t of document.querySelectorAll('#feed .tile')) {
      const tr = shown(t);
      const nameEl = t.querySelector('.name');
      if (!tr || !nameEl) continue;
      const vis = clip(tr);
      const under = vis ? chrome.filter((c) => meet(vis, c[1])).map((c) => c[0]) : [];
      const nr = shown(nameEl), mr = shown(t.querySelector('.maxbtn'));
      const whole = !!vis && vis.top <= tr.top + 1 && vis.bottom >= tr.bottom - 1;
      tiles.push({
        name: nameEl.textContent.trim(), y: Math.round(tr.top), h: Math.round(tr.height),
        seen: !!vis, whole, under,
        nameTop: !!nr && whole && onTop(nameEl, nr),
        maxTop: !mr || (whole && onTop(t.querySelector('.maxbtn'), mr)),
      });
    }
    const band = document.getElementById('stadband');
    const br = shown(band);
    // The hint must not sit on anyone's name or Full screen.
    const hintOn = [];
    if (br && clip(br)) {
      for (const t of document.querySelectorAll('#feed .tile')) {
        for (const el of [t.querySelector('.name'), t.querySelector('.maxbtn')]) {
          const r = shown(el);
          if (r && meet(br, r)) hintOn.push(t.querySelector('.name').textContent.trim() + (el.classList.contains('maxbtn') ? '\'s Full screen' : '\'s name'));
        }
      }
    }
    return {
      hintOn,
      away: document.body.classList.contains('chrome-away'),
      scroll: feed.scrollHeight - feed.clientHeight, top: feed.scrollTop,
      hint: br && clip(br) ? band.textContent.trim() : '', tiles,
    };
  });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const bad = [];
  const context = await browser.newContext(Object.assign({}, devices['iPhone SE landscape'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=sideways-crowd-' + process.pid + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), NAMES);
  if (!seeded || !seeded.ok) { console.error('FAIL could not seat the guests'); process.exit(1); }
  // A key press brings the call's buttons up (and holds them for 6s), the way
  // any tap does; the check runs well inside that.
  const up = async () => {
    await page.keyboard.press('Shift');
    await page.waitForTimeout(700);
  };
  await up();
  const a = await look(page);
  let shot = a;
  if (a.away) bad.push('the call\'s buttons did not stay up');
  if (a.tiles.length && !a.tiles.some((t) => t.under.length)) bad.push('dock sits outside the tiles');
  for (const t of a.tiles) {
    if (t.whole && !t.under.length && !t.nameTop) bad.push(t.name + '\'s name is covered');
    if (t.whole && !t.under.length && !t.maxTop) bad.push(t.name + '\'s Full screen is covered');
  }
  const hidden = a.tiles.filter((t) => !t.whole);
  if (hidden.length && !a.hint) bad.push(hidden.length + ' faces are past the edge and nothing says so');
  if (a.hintOn.length) bad.push('the "more" hint sits on ' + a.hintOn.join(' and '));
  if (hidden.length && a.scroll < 2) bad.push('faces are past the edge but the tiles do not scroll');
  await page.screenshot({ path: path.join(SHOTS, 'sideways-crowd-chrome-iphone-se-land.png') });
  if (hidden.length) {
    await page.evaluate(() => { const f = document.getElementById('feed'); f.scrollTop = f.scrollHeight; });
    await up();
    const b = await look(page);
    shot = b;
    for (const n of hidden.map((t) => t.name)) {
      const t = b.tiles.find((x) => x.name === n);
      if (!t || !t.whole) bad.push('scrolled down, ' + n + '\'s tile is still cut');
      else {
        if (!t.under.length && !t.nameTop) bad.push('scrolled down, ' + n + '\'s name is covered');
        if (!t.under.length && !t.maxTop) bad.push('scrolled down, ' + n + '\'s Full screen is covered');
      }
    }
    await page.screenshot({ path: path.join(SHOTS, 'sideways-crowd-chrome-iphone-se-land-scrolled.png') });
  }
  await context.close();
  await browser.close();
  // Name the shots before or after by the result.
  for (const f of ['sideways-crowd-chrome-iphone-se-land', 'sideways-crowd-chrome-iphone-se-land-scrolled']) {
    const p = path.join(SHOTS, f + '.png');
    if (fs.existsSync(p)) fs.renameSync(p, path.join(SHOTS, (bad.length ? 'before-' : 'after-') + f + '.png'));
  }
  if (bad.length) {
    console.error('FAIL ' + bad.join('; ') + '\n' + JSON.stringify(shot));
    process.exit(1);
  }
  console.log('PASS the dock floats over a sideways phone\'s tiles, and a covered face still scrolls up whole');
})().catch((e) => { console.error(e); process.exit(1); });
