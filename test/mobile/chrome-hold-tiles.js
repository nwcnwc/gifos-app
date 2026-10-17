/*
 * A church call on a phone with seven on it. The call's buttons tuck away
 * after a few quiet seconds and come back on any tap. Each time they did,
 * the packer laid the faces out again for the taller space, so every face
 * jumped to a new place: on a sideways iPhone SE, Ruth went from third in
 * a row of five to under Pastor Dave, and your own tile doubled in size.
 * You lose the person you were watching every time you tap React.
 * Now the faces keep their row and column, and only grow into the room the
 * buttons leave. With the buttons away every face shows whole, with no
 * "↓2" and no scroll; with them up nothing lies under the dock.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/chrome-hold-tiles.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const NAMES = ['Pastor Dave', 'Ruth', 'Margaret Johnson', 'Lobby iPad', 'Grace', 'Tom & Linda Ruiz'];
const PHONES = [['iPhone SE landscape', 'iphone-se-land'], ['iPhone 12 landscape', 'iphone-12-land'],
  ['Pixel 5 landscape', 'pixel-5-land'], ['iPhone SE', 'iphone-se'], ['Pixel 5', 'pixel-5']];

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
      return {
        name: t.querySelector('.name').textContent.trim(), left: Math.round(r.left), top: Math.round(r.top),
        w: Math.round(r.width), h: Math.round(r.height),
        whole: r.top >= fr.top - 1 && r.bottom <= Math.min(fr.bottom, clipB) + 1 && r.left >= -1 && r.right <= innerWidth + 1,
        under: [bar, ...btns].some((c) => meet(r, c)),
      };
    });
    // Rows by top edge, columns by order along the row.
    const tops = [...new Set(tiles.map((t) => t.top))].sort((a, b) => a - b);
    for (const t of tiles) {
      t.row = tops.indexOf(t.top);
      t.col = tiles.filter((u) => u.top === t.top && u.left < t.left).length;
    }
    return { away: document.body.classList.contains('chrome-away'), scroll: feed.scrollHeight - feed.clientHeight, tiles };
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
    await page.goto(BASE + '/run.html#v=chrome-hold-' + process.pid + '-' + tag + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), NAMES);
    if (!seeded || !seeded.ok) { bad.push(dev + ': could not seat the guests'); await context.close(); continue; }
    await page.keyboard.press('Shift');
    await page.waitForTimeout(900);
    const up = await look(page);
    await page.screenshot({ path: path.join(SHOTS, 'chrome-hold-tiles-' + tag + '-up.png') });
    await page.waitForFunction(() => document.body.classList.contains('chrome-away'), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(900);
    const away = await look(page);
    await page.screenshot({ path: path.join(SHOTS, 'chrome-hold-tiles-' + tag + '-away.png') });
    // A key brings the buttons back: the faces go back where they were.
    await page.keyboard.press('Shift');
    await page.waitForTimeout(900);
    const back = await look(page);
    shots.push('chrome-hold-tiles-' + tag + '-up', 'chrome-hold-tiles-' + tag + '-away');
    if (up.away || !away.away || back.away) { bad.push(dev + ': the call\'s buttons did not tuck and come back'); await context.close(); continue; }
    if (up.tiles.length !== 7 || away.tiles.length !== 7) bad.push(dev + ': ' + up.tiles.length + '/' + away.tiles.length + ' tiles, want 7');
    for (const a of away.tiles) {
      const u = up.tiles.find((t) => t.name === a.name);
      const b = back.tiles.find((t) => t.name === a.name);
      if (!u || !b) { bad.push(dev + ': ' + a.name + ' is missing'); continue; }
      if (u.row !== a.row || u.col !== a.col) bad.push(dev + ': ' + a.name + ' moved from row ' + (u.row + 1) + ' place ' + (u.col + 1) + ' to row ' + (a.row + 1) + ' place ' + (a.col + 1) + ' when the buttons tucked away');
      else if (Math.abs(u.left - a.left) > 1 || Math.abs(u.w - a.w) > 1) bad.push(dev + ': ' + a.name + ' slid sideways (' + u.left + '+' + u.w + ' to ' + a.left + '+' + a.w + ')');
      if (b.left !== u.left || b.top !== u.top || b.w !== u.w || b.h !== u.h) bad.push(dev + ': ' + a.name + ' did not go back to its place when the buttons came back');
      if (!a.whole) bad.push(dev + ': ' + a.name + ' is not whole with the buttons away');
      if (Math.min(a.w, a.h) < 96) bad.push(dev + ': ' + a.name + ' is ' + a.w + 'x' + a.h + ' with the buttons away');
      if (a.w / a.h < 0.43) bad.push(dev + ': ' + a.name + ' is a sliver, ' + a.w + 'x' + a.h);
    }
    if (away.scroll > 1) bad.push(dev + ': the faces scroll ' + away.scroll + 'px with the buttons away');
    for (const u of up.tiles) if (u.whole && u.under) bad.push(dev + ': ' + u.name + ' lies under the dock with the buttons up');
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
  console.log('PASS the faces keep their places when the call\'s buttons tuck away and come back');
})().catch((e) => { console.error(e); process.exit(1); });
