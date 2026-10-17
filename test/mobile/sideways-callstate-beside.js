/*
 * A church call on a sideways phone with seven on it and the call's buttons
 * up. Record and Captions sat in a row of their own between the tiles and
 * the dock, so the faces lost 52px of a 320px screen. On an iPhone SE that
 * pushed two faces into a second row you had to scroll to, and on an
 * iPhone 12 the tiles were so short that a long name ran over Full screen.
 * The room beside the dock was empty. Record and Captions now stand beside
 * the dock, so with the buttons up every face is on screen, whole, without
 * a scroll, and Record and Captions are still 44px, read in full, and are
 * the thing a tap on them hits.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/sideways-callstate-beside.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const NAMES = ['Pastor Dave', 'Ruth', 'Margaret Johnson', 'Lobby iPad', 'Grace', 'Tom & Linda Ruiz'];
const PHONES = [['iPhone SE landscape', 'iphone-se-land'], ['iPhone 12 landscape', 'iphone-12-land'], ['Pixel 5 landscape', 'pixel-5-land']];

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
    const out = { away: document.body.classList.contains('chrome-away'), scroll: feed.scrollHeight - feed.clientHeight, tiles: [], btns: [] };
    for (const t of tiles) {
      const r = R(t);
      const whole = r.top >= Math.max(0, fr.top) - 1 && r.bottom <= Math.min(innerHeight, fr.bottom) + 1 && r.left >= -1 && r.right <= innerWidth + 1;
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
        under: [br, ...btns.map(R)].some((c) => meet(r, c)),
      });
    }
    for (const b of btns) {
      const r = R(b);
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      out.btns.push({
        text: b.textContent.trim(), h: Math.round(r.height), w: Math.round(r.width),
        onScreen: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
        full: b.scrollWidth <= b.clientWidth + 1,
        top: !!at && (at === b || b.contains(at)),
        onDock: meet(r, br),
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
  for (const [dev, tag] of PHONES) {
    const context = await browser.newContext(Object.assign({}, devices[dev], { hasTouch: true }));
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=callstate-beside-' + process.pid + '-' + tag + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), NAMES);
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
    const cut = a.tiles.filter((t) => !t.whole).map((t) => t.name);
    if (cut.length) bad.push(dev + ': ' + cut.join(', ') + ' not whole on screen with the buttons up');
    if (a.scroll > 1) bad.push(dev + ': the tiles scroll ' + a.scroll + 'px');
    for (const t of a.tiles) {
      if (t.under) bad.push(dev + ': ' + t.name + '\'s tile is under the dock or Record/Captions');
      if (t.whole && !t.nameTop) bad.push(dev + ': ' + t.name + '\'s name is covered');
      if (t.nameOnMax) bad.push(dev + ': ' + t.name + '\'s name runs over Full screen');
    }
    if (a.btns.length !== 2) bad.push(dev + ': ' + a.btns.length + ' Record/Captions buttons shown, want 2');
    for (const b of a.btns) {
      if (!b.onScreen) bad.push(dev + ': ' + b.text + ' is off the screen');
      if (b.h < 44 || b.w < 44) bad.push(dev + ': ' + b.text + ' is ' + b.w + 'x' + b.h);
      if (!b.full) bad.push(dev + ': ' + b.text + ' is cut');
      if (!b.top) bad.push(dev + ': something lies over ' + b.text);
      if (b.onDock) bad.push(dev + ': ' + b.text + ' lies on the dock');
    }
    // Captions still turns captions on from where it now stands.
    const cc = page.locator('#call-cc');
    const ccb = await cc.boundingBox();
    if (ccb) {
      await page.touchscreen.tap(ccb.x + ccb.width / 2, ccb.y + ccb.height / 2);
      await page.waitForTimeout(300);
      const on = await cc.getAttribute('aria-pressed');
      if (on !== 'true') bad.push(dev + ': a tap on Captions did not turn captions on');
      await page.touchscreen.tap(ccb.x + ccb.width / 2, ccb.y + ccb.height / 2);
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
  console.log('PASS a sideways phone shows every face with Record and Captions beside the dock');
})().catch((e) => { console.error(e); process.exit(1); });
