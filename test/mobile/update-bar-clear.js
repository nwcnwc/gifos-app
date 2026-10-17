/*
 * A church host pinned to an older GifOS starts a call from their Home
 * Screen, so the call says "⚠ Important update: GifOS v… is available."
 * That bar floats over the top of the page and covers the room-name chip,
 * which is the only way a phone opens People and the host controls, plus
 * the GifOS link (and Fit and the build name on a sideways phone).
 * While the bar shows, the header, Fit, the build name and every face sit
 * below it, and a tap on the room name opens People. Once the bar is
 * dismissed the header goes back to the top.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/update-bar-clear.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const NAMES = ['Pastor Dave', 'Ruth', 'Margaret Johnson', 'Lobby iPad', 'Grace', 'Tom & Linda Ruiz'];
const VIEWS = [['iPhone SE', 'iphone-se'], ['iPhone SE landscape', 'iphone-se-land'],
  ['iPhone 12 landscape', 'iphone-12-land'], ['Pixel 5', 'pixel-5'], ['Pixel 5 landscape', 'pixel-5-land'],
  [null, 'desktop']];
const VERSION_JSON = '{"current":"0.9.99"}';
const CHANGELOG_JSON = '{"entries":[{"version":"0.9.99","critical":true}]}';

function look(page) {
  return page.evaluate(() => {
    const bar = document.getElementById('update-bar');
    const shown = !!bar && bar.style.display !== 'none' && bar.getClientRects().length > 0;
    const br = shown ? bar.getBoundingClientRect() : null;
    const seen = (el) => {
      if (!el || !el.getClientRects().length) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.2;
    };
    const parts = [];
    const add = (what, el) => { if (seen(el)) parts.push([what, el.getBoundingClientRect()]); };
    add('the room name', document.getElementById('status'));
    add('the GifOS link', document.querySelector('.topchip a.title, .topchip a.brand'));
    add('Fit', document.getElementById('fitbtn'));
    add('the build name', document.getElementById('gifos-build-float'));
    document.querySelectorAll('#feed .tile').forEach((t) => {
      const n = ((t.querySelector('.name') || {}).textContent || '?').trim();
      add('the face of ' + n, t);
    });
    const under = [];
    if (br) {
      for (const [what, r] of parts) {
        if (r.width < 1 || r.height < 1) continue;
        if (r.top < br.bottom - 0.5 && r.bottom > br.top && r.left < br.right && r.right > br.left) {
          under.push(what + ' (' + [r.left, r.top].map(Math.round) + ')');
        }
      }
    }
    const st = document.getElementById('status');
    const sr = st && st.getBoundingClientRect();
    return {
      shown, text: shown ? bar.querySelector('#update-msg').textContent : '',
      bar: br && [br.left, br.top, br.width, br.height].map(Math.round),
      under, statusTop: sr ? Math.round(sr.top) : -1,
    };
  });
}

async function run(browser, dev, tag, count, bad) {
  const was = bad.length;
  const opts = dev ? Object.assign({}, devices[dev], { hasTouch: true }) : { viewport: { width: 1280, height: 800 } };
  const context = await browser.newContext(Object.assign(opts, { serviceWorkers: 'block' }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} window.GIFOS_VERSION = '0.9.20'; });
  const page = await context.newPage();
  await page.route('**/version.json*', (r) => r.fulfill({ contentType: 'application/json', body: VERSION_JSON }));
  await page.route('**/changelog.json*', (r) => r.fulfill({ contentType: 'application/json', body: CHANGELOG_JSON }));
  await page.goto(BASE + '/run.html#v=update-bar-' + process.pid + '-' + Date.now() + '-' + tag + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) { if (dev) await skip.tap().catch(() => {}); else await skip.click().catch(() => {}); }
  const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), NAMES.slice(0, count - 1));
  const label = tag + ' with ' + count;
  if (!seeded || !seeded.ok) { bad.push(label + ': could not seat the guests'); await context.close(); return; }
  await page.waitForFunction(() => { const b = document.getElementById('update-bar'); return b && b.style.display !== 'none'; }, null, { timeout: 15000 })
    .catch(() => bad.push(label + ': the update bar never showed'));
  await page.waitForTimeout(1200);
  const on = await look(page);
  const pre = () => (bad.length > was ? 'before' : 'after');
  if (on.shown) {
    if (on.text.indexOf('Important update') < 0) bad.push(label + ': the bar reads "' + on.text + '"');
    if (on.under.length) bad.push(label + ': the update bar at ' + on.bar + ' covers ' + on.under.join(', '));
    // A tap on the room name must reach it, not the bar.
    const hit = await page.evaluate(() => {
      const st = document.getElementById('status');
      const r = st && st.getBoundingClientRect();
      // Desktop shows the count in the header; its room name is a 1px stub.
      if (!r || r.width < 8 || getComputedStyle(st).visibility === 'hidden') return true;
      const el = document.elementFromPoint(r.left + Math.min(40, r.width / 2), r.top + r.height / 2);
      return !!el && !!el.closest('#status');
    });
    if (!hit) bad.push(label + ': a tap on the room name lands on the update bar');
  }
  const onShot = await page.screenshot();
  // Dismissed: the header goes back to the top.
  await page.evaluate(() => { const d = document.getElementById('update-dismiss'); if (d) d.click(); });
  await page.waitForTimeout(1200);
  const off = await look(page);
  if (off.shown) bad.push(label + ': the bar stayed after ✕');
  else if (off.statusTop > 70) bad.push(label + ': after ✕ the room name stays down at y=' + off.statusTop);
  const offShot = await page.screenshot();
  fs.writeFileSync(path.join(SHOTS, pre() + '-update-bar-clear-' + tag + '-' + count + '.png'), onShot);
  fs.writeFileSync(path.join(SHOTS, pre() + '-update-bar-clear-' + tag + '-' + count + '-dismissed.png'), offShot);
  await context.close();
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const bad = [];
  for (const [dev, tag] of VIEWS) {
    for (const count of [3, 7]) await run(browser, dev, tag, count, bad);
  }
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS the update bar covers no header, button or face, and the room name still opens People');
})().catch((e) => { console.error(e); process.exit(1); });
