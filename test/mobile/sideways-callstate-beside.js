/*
 * A church call on a sideways phone with seven on it and the call's buttons
 * up. Record and Captions sat in a row of their own between the tiles and
 * the dock, so the faces lost 52px of a 320px screen. On an iPhone SE that
 * pushed two faces into a second row you had to scroll to, and on an
 * iPhone 12 the tiles were so short that a long name ran over Full screen.
 * The room beside the dock was empty. Record and Captions now stand beside
 * the dock. With the buttons up an iPhone 12 and a Pixel 5 show every face
 * whole without a scroll, names clear of Full screen. An SE's band is too
 * short for two rows of 96px faces, so it shows a full row of five, as
 * tall as the band, and "↓2" for the rest. Record and Captions are still
 * 44px, read in full, and are the thing a tap on them hits. The "↓2" hint
 * hangs in the fifth face's corner; a long fifth name ("Fellowship Hall
 * iPad") ran under it, so that name now wraps clear of the hint.
 * Since Nathan's 2026-10-19 change Captions is in More (Talk): Record stands
 * beside the dock alone, small, and clear of the header.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/sideways-callstate-beside.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const NAMES = ['Pastor Dave', 'Ruth', 'Margaret Johnson', 'Lobby iPad', 'Grace', 'Tom & Linda Ruiz'];
const LONG = ['Pastor Dave', 'Ruth', 'Margaret Johnson', 'Fellowship Hall iPad', 'Grace', 'Tom & Linda Ruiz'];
// [device, shot tag, faces whole with the buttons up, guests]
// A full-screen gallery fits every face on these phones, including the SE.
const PHONES = [['iPhone SE landscape', 'iphone-se-land', 7, NAMES], ['iPhone SE landscape', 'iphone-se-land-long', 7, LONG],
  ['iPhone 12 landscape', 'iphone-12-land', 7, NAMES], ['Pixel 5 landscape', 'pixel-5-land', 7, NAMES]];

function look(page) {
  return page.evaluate(() => {
    const feed = document.getElementById('feed');
    const fr = feed.getBoundingClientRect();
    const R = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const meet = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const bar = document.querySelector('.bar');
    const br = R(bar);
    const btns = [...document.querySelectorAll('#callstate button')].filter((b) => b.offsetParent);
    const tiles = [...document.querySelectorAll('#feed .tile')].filter((t) => t.querySelector('.name') && t.offsetParent);
    const hint = document.getElementById('stadband');
    const out = {
      away: document.body.classList.contains('chrome-away'), scroll: feed.scrollHeight - feed.clientHeight, tiles: [], btns: [],
      hint: hint && hint.offsetParent && getComputedStyle(hint).visibility !== 'hidden' ? hint.textContent.trim() : '',
      hintOn: [],
    };
    if (out.hint) {
      const hr = R(hint);
      for (const n of document.querySelectorAll('#feed .tile .name')) if (n.offsetParent && meet(hr, R(n))) out.hintOn.push(n.textContent.trim());
    }
    // The part of a tile the feed shows (a scrolling feed clips its later rows).
    const clip = (r) => {
      const y0 = Math.max(r.top, fr.top), y1 = Math.min(r.bottom, fr.bottom, innerHeight - parseFloat(getComputedStyle(feed).getPropertyValue('--comfy-clip') || 0));
      return y1 - y0 > 1 ? { left: r.left, right: r.right, top: y0, bottom: y1 } : null;
    };
    for (const t of tiles) {
      const r = R(t);
      const vis = clip(r);
      const whole = !!vis && vis.top <= r.top + 1 && vis.bottom >= r.bottom - 1 && r.left >= -1 && r.right <= innerWidth + 1;
      const n = t.querySelector('.name');
      const nr = R(n);
      const at = document.elementFromPoint(nr.left + nr.width / 2, nr.top + nr.height / 2);
      // The name and Full screen must not lie on each other.
      const mx = t.querySelector('.maxbtn');
      const mr = mx && mx.offsetParent && getComputedStyle(mx).visibility !== 'hidden' ? R(mx) : null;
      out.tiles.push({
        name: n.textContent.trim(), h: Math.round(r.height), whole,
        nameTop: !!at && (at === n || n.contains(at)),
        nameOnMax: !!mr && meet(nr, mr),
        under: !!vis && [br, ...btns.map(R)].some((c) => meet(vis, c)),
      });
    }
    const head = ['appinvite', 'apphelp', 'appfull'].map((id) => document.getElementById(id)).filter((h) => h && h.offsetParent).map(R);
    out.ccOnCall = !!document.getElementById('call-cc');
    for (const b of btns) {
      const r = R(b);
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      out.btns.push({
        id: b.id, onHead: head.some((h) => meet(r, h)),
        text: b.textContent.trim(), h: Math.round(r.height), w: Math.round(r.width),
        onScreen: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
        full: b.scrollWidth <= b.clientWidth + 1,
        top: !!at && (at === b || b.contains(at)),
        onDock: meet(r, br),
        // Beside the dock, not in a row of their own above it.
        beside: r.top >= br.top - 8 && r.bottom <= br.bottom + 1,
      });
    }
    return out;
  });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const bad = [];
  const shots = [];
  for (const [dev0, tag, want, guests] of PHONES) {
    const dev = dev0 + (guests === LONG ? ' (long names)' : '');
    const context = await browser.newContext(Object.assign({}, devices[dev0], { hasTouch: true }));
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=callstate-beside-' + process.pid + '-' + tag + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), guests);
    if (!seeded || !seeded.ok) { bad.push(dev + ': could not seat the guests'); await context.close(); continue; }
    // A key press brings the call's buttons up and holds them for 6s.
    await page.keyboard.press('Shift');
    await page.waitForTimeout(900);
    const a = await look(page);
    const f = 'sideways-callstate-beside-' + tag;
    await page.screenshot({ path: path.join(SHOTS, f + '.png') });
    shots.push(f);
    if (a.away) bad.push(dev + ': the call\'s buttons did not stay up');
    if (a.tiles.length !== 7) bad.push(dev + ': ' + a.tiles.length + ' tiles, want 7');
    const whole = a.tiles.filter((t) => t.whole);
    if (whole.length < want) bad.push(dev + ': ' + whole.length + ' faces whole with the buttons up, want ' + want + ' (' + whole.map((t) => t.name + ' ' + t.h + 'px').join(', ') + ')');
    if (want === 7 && a.scroll > 1) bad.push(dev + ': the tiles scroll ' + a.scroll + 'px');
    if (a.hintOn.length) bad.push(dev + ': the "' + a.hint + '" hint sits on ' + a.hintOn.join(' and ') + '\'s name');
    if (whole.length === a.tiles.length && a.hint) bad.push(dev + ': every face is on screen and the hint says "' + a.hint + '"');
    if (whole.length < a.tiles.length && a.hint !== '\u2193' + (a.tiles.length - whole.length)) bad.push(dev + ': ' + (a.tiles.length - whole.length) + ' faces below and the hint says "' + a.hint + '"');
    if (a.tiles.length && !a.tiles.some((t) => t.under)) bad.push(dev + ': dock sits outside the tiles');
    for (const t of a.tiles) {
      // A name under the dock is covered while the controls are up. Any other
      // cover is a miss.
      if (t.whole && !t.nameTop && !t.under) bad.push(dev + ': ' + t.name + '\'s name is covered');
      if (t.nameOnMax) bad.push(dev + ': ' + t.name + '\'s name runs over Full screen');
    }
    if (a.ccOnCall) bad.push(dev + ': Captions is a button on the call (it lives in More)');
    if (a.btns.length !== 1 || a.btns[0].id !== 'call-rec') bad.push(dev + ': ' + a.btns.map((b) => b.text).join('/') + ' shown beside the dock, want Record alone');
    for (const b of a.btns) {
      if (!b.onScreen) bad.push(dev + ': ' + b.text + ' is off the screen');
      if (b.h < 44 || b.w < 44) bad.push(dev + ': ' + b.text + ' is ' + b.w + 'x' + b.h);
      if (!b.full) bad.push(dev + ': ' + b.text + ' is cut');
      if (!b.top) bad.push(dev + ': something lies over ' + b.text);
      if (b.onDock) bad.push(dev + ': ' + b.text + ' lies on the dock');
      if (!b.beside) bad.push(dev + ': ' + b.text + ' takes a row above the dock');
      if (b.onHead) bad.push(dev + ': ' + b.text + ' covers the header');
      if (b.w > 140) bad.push(dev + ': ' + b.text + ' is a wide pill (' + b.w + 'px)');
    }
    // Record still opens the record sheet from where it now stands.
    const rb = await page.locator('#call-rec').boundingBox();
    if (!rb) bad.push(dev + ': no Record to tap');
    else {
      await page.touchscreen.tap(rb.x + rb.width / 2, rb.y + rb.height / 2);
      await page.waitForTimeout(300);
      const open = await page.evaluate(() => { const el = document.getElementById('rec-options'); return !!el && getComputedStyle(el).display !== 'none'; });
      if (!open) bad.push(dev + ': a tap on Record did not open the record sheet');
      const cancel = page.locator('#ro-cancel');
      if (await cancel.count()) await cancel.tap().catch(() => {});
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
  console.log('PASS a sideways phone shows every face with Record beside the dock');
})().catch((e) => { console.error(e); process.exit(1); });
