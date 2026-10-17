/*
 * A church call on a sideways phone. The faint build name ("v0.8.5 · build
 * 4321" on a real deploy) sits under the header row at y=58, and on a
 * sideways phone the faces start at y=66, so it runs across the first two
 * faces: over your own tile and Pastor Dave's mute chip (SE, iPhone 12 and
 * Pixel 5, with 3 or 7 on the call, buttons up or tucked away).
 * The build name stays on screen and lies over no face, button or header.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/build-tag-clear.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const NAMES = ['Pastor Dave', 'Ruth', 'Margaret Johnson', 'Lobby iPad', 'Grace', 'Tom & Linda Ruiz'];
const PHONES = [['iPhone SE landscape', 'iphone-se-land'], ['iPhone 12 landscape', 'iphone-12-land'],
  ['Pixel 5 landscape', 'pixel-5-land'], ['iPhone SE', 'iphone-se'], ['Pixel 5', 'pixel-5']];
// A deployed snapshot names its version and build; the dev checkout only says "edge".
const BUILD_JS = 'window.GIFOS_VERSION = "0.8.5"; window.GIFOS_BUILD = 4321;';

function look(page) {
  return page.evaluate(() => {
    const tag = document.getElementById('gifos-build-float');
    if (!tag) return { gone: 'no build tag' };
    const cs = getComputedStyle(tag);
    const r = tag.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.2) return { gone: 'build tag hidden' };
    if (r.width < 1 || r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth) return { gone: 'build tag off screen at ' + [r.left, r.top].map(Math.round) };
    const what = (el) => {
      const t = el.closest('#feed .tile');
      if (t) return 'the face of ' + ((t.querySelector('.name') || {}).textContent || '?').trim();
      const b = el.closest('button, a, input, .topchip, .bar, #callstate, .chips span');
      return b ? (b.id || b.className || b.tagName) : null;
    };
    // Sample a grid over the tag; it has pointer-events: none, so this reads what lies under it.
    const hits = new Set();
    for (let x = r.left + 1; x < r.right; x += 4) {
      for (let y = r.top + 1; y < r.bottom; y += 3) {
        const el = document.elementFromPoint(x, y);
        const w = el && what(el);
        if (w) hits.add(w);
      }
    }
    return { text: tag.textContent, box: [r.left, r.top, r.width, r.height].map(Math.round), hits: [...hits] };
  });
}

async function run(browser, dev, tag, count, bad) {
  const was = bad.length;
  const context = await browser.newContext(Object.assign({}, devices[dev], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.route('**/js/build.js', (r) => r.fulfill({ contentType: 'text/javascript', body: BUILD_JS }));
  await page.goto(BASE + '/run.html#v=build-tag-' + process.pid + '-' + Date.now() + '-' + tag + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  const names = NAMES.slice(0, count - 1);
  const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), names);
  if (!seeded || !seeded.ok) { bad.push(tag + ' ' + count + ': could not seat the guests'); await context.close(); return; }
  await page.keyboard.press('Shift');
  await page.waitForTimeout(900);
  const label = tag + ' with ' + count;
  const up = await look(page);
  const shot = (state) => path.join(SHOTS, '%-build-tag-clear-' + tag + '-' + count + '-' + state + '.png');
  const upShot = await page.screenshot();
  await page.waitForFunction(() => document.body.classList.contains('chrome-away'), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(900);
  const away = await look(page);
  const awayShot = await page.screenshot();
  for (const [state, s] of [['buttons up', up], ['buttons away', away]]) {
    if (s.gone) { bad.push(label + ', ' + state + ': ' + s.gone); continue; }
    if (s.text.indexOf('0.8.5') < 0 || s.text.indexOf('4321') < 0) bad.push(label + ', ' + state + ': the build tag reads "' + s.text + '"');
    if (s.hits.length) bad.push(label + ', ' + state + ': "' + s.text + '" at ' + s.box + ' lies over ' + s.hits.join(', '));
  }
  const pre = bad.length > was ? 'before' : 'after';
  fs.writeFileSync(shot('up').replace('%', pre), upShot);
  fs.writeFileSync(shot('away').replace('%', pre), awayShot);
  await context.close();
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const bad = [];
  for (const [dev, tag] of PHONES) {
    for (const count of [3, 7]) await run(browser, dev, tag, count, bad);
  }
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS the build tag stays on screen and lies over no face, button or header on any phone');
})().catch((e) => { console.error(e); process.exit(1); });
