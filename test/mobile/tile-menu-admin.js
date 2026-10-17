/*
 * In a room with an admin, the admin's tile menu has five buttons: Mute for
 * all, Blur for all, Allow apps & stage, Allow screen share and
 * Ban. On an iPhone SE a side tile is slim (105x153 upright, 105x100
 * sideways), and the slim menu was sized for two. A church or company admin
 * on a phone must still reach every one of them: each is on screen when
 * scrolled to, 44px tall, read in full, and nothing paints over it
 * (not the name, not the Record/Captions row, not the dock).
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/tile-menu-admin.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const { clearRoom } = require('./lib/clear-room');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const WANT = [/^(Un)?[Mm]ute for all$/, /^(Un)?[Bb]lur for all$/, /^(Allow|Revoke) apps & stage$/, /^(Allow|Revoke) screen share$/, /^Ban$/];

// A fixed admin key; the room's verifier is derived from it in the page.
const K = '5eed'.repeat(16);
// A room of its own: two runs in one room are two admins, and their signed
// mute orders merge into each other's tiles.
const ROOM = 'tile-menu-admin-' + process.pid + '-' + Date.now().toString(36);

async function run(browser, dev, av, tagShot, bad) {
  const context = await browser.newContext(Object.assign({}, devices[dev], { hasTouch: true }));
  await context.addInitScript((a) => {
    try { localStorage.setItem('gifos_name', 'Nathan'); localStorage.setItem('gifos_vadm_' + a.room + '.' + a.av, a.K); } catch (e) {}
  }, { av, K, room: ROOM });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=' + ROOM + '&av=' + av + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});

  const names = ['Ruth', 'Margaret Johnson'];
  const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), names);
  // Ruth seats muted, and a muted guest's menu has no Mute for all
  // (host-tile-controls.js). Unmute her so the menu holds every button.
  await page.evaluate(() => window.__gifosVideo.setPeerStatusForTest('qa1', { muted: false }));
  if (!seeded || !seeded.ok) bad.push(dev + ': could not seat ' + names.join(', '));
  // This phone holds the room's admin key, so it signs in as the admin.
  const admin = await page.waitForFunction(() => document.body.classList.contains('amadmin'), null, { timeout: 10000 }).then(() => true, () => false);
  if (!admin) bad.push(dev + ': the stored admin key did not sign this phone in as admin');
  // Blur for all shows only on a clear face: lock the room, faces clear.
  if (!(await clearRoom(page, ['qa1', 'qa2']))) bad.push(dev + ': the faces never cleared in a locked room');
  await page.waitForTimeout(600);

  let shot = false;
  for (const want of names) {
    const tile = page.locator('#grid .tile', { has: page.locator('.name', { hasText: want }) }).first();
    if (!(await tile.count())) { bad.push(dev + ': no tile reads "' + want + '"'); continue; }
    // The name pill opens the menu and is clear of the corner buttons.
    const nb = await tile.locator('.name').boundingBox();
    await page.touchscreen.tap(nb.x + nb.width / 2, nb.y + nb.height / 2);
    await page.waitForTimeout(200);
    const head = await tile.evaluate((t) => ({
      open: t.classList.contains('menu'), slim: t.classList.contains('slim'),
      w: Math.round(t.getBoundingClientRect().width), h: Math.round(t.getBoundingClientRect().height),
    }));
    const tag = dev + ' ' + want + ' (' + head.w + 'x' + head.h + ' tile)';
    if (!head.slim) bad.push(tag + ': not a slim tile, the case is gone');
    if (!head.open) { bad.push(tag + ': a tap did not open the menu'); continue; }

    const seen = [];
    const count = await tile.evaluate((t) => t.querySelectorAll('.modbar > button').length);
    for (let i = 0; i < count; i++) {
      // Scroll the menu to the button, as a thumb would, then look at it.
      const b = await tile.evaluate((t, i) => {
        const bar = t.querySelector('.modbar');
        const el = bar.children[i];
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return null;
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const r = el.getBoundingClientRect();
        const br = bar.getBoundingClientRect();
        const pts = [[r.left + r.width / 2, r.top + 3], [r.left + r.width / 2, r.top + r.height / 2], [r.left + r.width / 2, r.bottom - 3]];
        let covered = '';
        for (const [x, y] of pts) {
          const e = document.elementFromPoint(x, y);
          if (!e || (e.closest('button') || e) !== el) { covered = e ? (e.id || e.className || e.tagName) + '' : 'nothing'; break; }
        }
        return {
          text: el.textContent, x: r.left, y: r.top, w: r.width, h: r.height,
          inBar: r.top >= br.top - 1 && r.bottom <= br.bottom + 1 && r.left >= br.left - 1 && r.right <= br.right + 1,
          onScreen: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth,
          cut: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
          covered,
        };
      }, i);
      if (!b) continue;
      seen.push(b.text);
      const bt = tag + ' "' + b.text + '"';
      if (!b.inBar) bad.push(bt + ' cannot be scrolled into the menu');
      if (!b.onScreen) bad.push(bt + ' leaves the screen');
      if (b.h < 44) bad.push(bt + ' is ' + Math.round(b.h) + 'px tall');
      if (b.cut) bad.push(bt + ' is cut');
      if (b.covered) bad.push(bt + ' is painted over by ' + b.covered);
    }
    for (const re of WANT) if (!seen.some((s) => re.test(s))) bad.push(tag + ': the menu has no ' + re.source);
    // The whole menu stays clear of Record/Captions and the dock; they paint over it.
    const clash = await tile.evaluate((t) => {
      const m = t.querySelector('.modbar').getBoundingClientRect();
      return Array.from(document.querySelectorAll('#callstate > *, .bar')).filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && getComputedStyle(e).visibility !== 'hidden' && m.left < r.right && r.left < m.right && m.top < r.bottom && r.top < m.bottom;
      }).map((e) => e.id || e.className);
    });
    if (clash.length) bad.push(tag + ': the menu runs under ' + clash.join(', '));

    if (!shot) {
      shot = true;
      await tile.evaluate((t) => { const bar = t.querySelector('.modbar'); bar.scrollTop = 0; });
      await page.screenshot({ path: path.join(SHOTS, tagShot(bad.length ? 'before' : 'after')) });
    }
    // Mute for all still works from there.
    const mute = await tile.evaluate((t) => {
      const el = t.querySelector('.modbar button[data-mod="mute"]');
      el.scrollIntoView({ block: 'nearest' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.touchscreen.tap(mute.x, mute.y);
    await page.waitForTimeout(200);
    const now = await tile.evaluate((t) => t.querySelector('.modbar button[data-mod="mute"]').textContent);
    if (now !== 'Unmute for all') bad.push(tag + ': tapping Mute for all left it reading "' + now + '"');
    // A tap off the tile closes it.
    await page.touchscreen.tap(8, 8);
    await page.waitForTimeout(200);
    if (await tile.evaluate((t) => t.classList.contains('menu'))) bad.push(tag + ': a tap off the tile did not close the menu');
  }
  await context.close();
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const bad = [];
  const probe = await browser.newPage();
  await probe.goto(BASE + '/run.html#v=tile-menu-admin-key', { waitUntil: 'domcontentloaded', timeout: 20000 });
  const av = await probe.evaluate(async (K) => (await window.GifOS.net.edKeysFromSeedHex(K)).verifier, K);
  await probe.close();
  await run(browser, 'iPhone SE', av, (s) => s + '-tile-menu-admin-iphone-se.png', bad);
  await run(browser, 'iPhone SE landscape', av, (s) => s + '-tile-menu-admin-iphone-se-land.png', bad);
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS admin tile menu on slim tiles, upright and sideways');
})().catch((e) => { console.error(e); process.exit(1); });
