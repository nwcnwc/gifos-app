/*
 * Nathan's shot of a 3-person call on an iPhone SE showed Ruth's tile, whose
 * face was already soft, still offering "Blur for everyone". Every guest's
 * blur and mute controls must follow that guest's explicit state, on every
 * tile, with one short wording: "Mute for all", "Unmute for all", "Blur for
 * all", "Unblur for all".
 *
 * An admin room on an iPhone SE (and a desktop), four guests:
 *   Ruth      her own blur on          → no Blur for all
 *   Margaret  blurred for all by me    → Unblur for all, no Blur for all
 *   Grace     clear, mic on            → Blur for all, Mute for all
 *   Tom       clear, muted by herself  → Blur for all, no Mute for all
 * With the room's password the room can be clear, so these hold. Without
 * one, faces stay soft room-wide and no tile has any blur control.
 * State comes from the guests' announced status, the signed orders and the
 * password, never from what the picture looks like.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/host-tile-blur-states.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const K = '5eed'.repeat(16);
const NAMES = ['Ruth', 'Margaret Johnson', 'Grace', 'Tom Ruiz'];
// seedGalleryForTest ids, in NAMES order.
const ID = { Ruth: 'qa1', 'Margaret Johnson': 'qa2', Grace: 'qa3', 'Tom Ruiz': 'qa4' };
const START = {
  Ruth: { blur: 1, muted: false, camOff: false },
  'Margaret Johnson': { blur: 0, muted: false, camOff: false },
  Grace: { blur: 0, muted: false, camOff: false },
  'Tom Ruiz': { blur: 0, muted: true, camOff: false },
};

const STATUS = {};

// Every control a person can reach on a tile right now, and every label on
// any tile control, shown or not.
function readTile(t) {
  const shown = (el) => {
    if (el.hidden) return false;
    for (let x = el; x && x !== t.parentElement; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const all = Array.from(t.querySelectorAll('button'));
  return {
    open: t.classList.contains('menu'),
    shown: all.filter(shown).map((b) => norm(b.getAttribute('aria-label') || b.textContent)),
    labels: all.flatMap((b) => [norm(b.textContent), norm(b.getAttribute('aria-label')), norm(b.title)]).filter(Boolean),
  };
}

// What each guest's tile must and must not offer.
function expect(name, locked, hostBlur) {
  const want = [], not = [];
  const muted = STATUS[name].muted;
  (muted ? not : want).push('Mute for all');
  if (!locked) not.push('Blur for all', 'Unblur for all');
  else if (hostBlur[name]) { want.push('Unblur for all'); not.push('Blur for all'); }
  else if (STATUS[name].blur) not.push('Blur for all', 'Unblur for all');
  else { want.push('Blur for all'); not.push('Unblur for all'); }
  return { want, not };
}

async function run(browser, dev, bad) {
  const phone = dev !== 'desktop';
  // Each run starts from the same states (step 3 unmutes Tom).
  for (const n of NAMES) STATUS[n] = Object.assign({}, START[n]);
  const room = 'host-blur-states-' + (phone ? 'p' : 'd') + process.pid + '-' + Date.now().toString(36);
  const ctxOpts = phone ? Object.assign({}, devices[dev], { hasTouch: true }) : { viewport: { width: 1280, height: 800 } };
  const context = await browser.newContext(ctxOpts);
  // The room's verifier comes from the key; work it out in a probe page.
  const probe = await context.newPage();
  await probe.goto(BASE + '/run.html#v=probe-' + room, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await probe.waitForFunction(() => window.GifOS && GifOS.net && GifOS.net.edKeysFromSeedHex, null, { timeout: 15000 });
  const av = await probe.evaluate(async (k) => {
    const r = await GifOS.net.edKeysFromSeedHex(k);
    return r.verifier;
  }, K);
  await probe.close();
  await context.addInitScript((a) => {
    try { localStorage.setItem('gifos_name', 'Nathan'); localStorage.setItem('gifos_vadm_' + a.room + '.' + a.av, a.K); } catch (e) {}
  }, { av, K, room });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=' + room + '&av=' + av + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await (phone ? skip.tap() : skip.click()).catch(() => {});
  const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), NAMES);
  if (!seeded || !seeded.ok) { bad.push(dev + ': could not seat ' + NAMES.join(', ')); await context.close(); return; }
  const admin = await page.waitForFunction(() => document.body.classList.contains('amadmin'), null, { timeout: 10000 }).then(() => true, () => false);
  if (!admin) { bad.push(dev + ': the stored admin key did not sign this page in as admin'); await context.close(); return; }
  for (const name of NAMES) await page.evaluate((a) => window.__gifosVideo.setPeerStatusForTest(a.id, a.st), { id: ID[name], st: STATUS[name] });
  await page.waitForTimeout(300);

  const tileOf = (name) => page.locator('#grid .tile', { has: page.locator('.name', { hasText: name }) }).first();
  // Close every menu. An admin's phone menu is a sheet that can lie over
  // the own tile, so a real tap there could press Allow apps; a click on
  // the page body is "a tap off the tile" without landing on a button.
  const away = async () => {
    if (!phone) await page.mouse.move(2, 2);
    await page.evaluate(() => document.body.click());
    await page.waitForTimeout(200);
  };
  // At rest, then with the menu open (a tap on the name pill, or a hover).
  const reach = async (name) => {
    await away();
    const rest = await tileOf(name).evaluate(readTile);
    const n = await tileOf(name).locator('.name').boundingBox();
    if (phone) await page.touchscreen.tap(n.x + n.width / 2, n.y + n.height / 2);
    else await tileOf(name).hover();
    await page.waitForTimeout(200);
    const opened = await tileOf(name).evaluate(readTile);
    return { opened, shown: [...new Set(rest.shown.concat(opened.shown))], labels: rest.labels.concat(opened.labels) };
  };
  const check = async (step, locked, hostBlur) => {
    for (const name of NAMES) {
      const tag = dev + ' ' + step + ' ' + name;
      const r = await reach(name);
      for (const l of new Set(r.labels)) {
        if (/for everyone/i.test(l)) bad.push(tag + ': a control says "' + l + '"');
      }
      // The wording is checked above; read the states past it.
      const offers = r.shown.map((l) => l.replace(/ for everyone$/i, ' for all'));
      const e = expect(name, locked, hostBlur);
      for (const w of e.want) if (!offers.includes(w)) bad.push(tag + ': no "' + w + '" (offers ' + (r.shown.join(', ') || 'nothing') + ')');
      for (const w of e.not) if (offers.includes(w)) bad.push(tag + ': offers "' + w + '" (' + r.shown.join(', ') + ')');
    }
    await away();
  };
  const slug = phone ? dev.toLowerCase().replace(/\s+/g, '-') : 'desktop';
  const shot = async (name, step) => {
    await reach(name);
    await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-host-tile-blur-states-' + step + '-' + slug + '.png') });
    await away();
  };

  // 1. Locked with a password: the room can be clear, so each tile follows
  //    its own guest's state. Margaret gets blurred for all by hand first.
  await page.evaluate(() => window.__gifosVideo.setRoomPwForTest('qa-pass'));
  await page.waitForTimeout(300);
  await reach('Margaret Johnson');
  const target = tileOf('Margaret Johnson').locator('button', { hasText: /^Blur\s+for\s+(all|everyone)$/i }).filter({ visible: true }).first();
  if (await target.isVisible().catch(() => false)) {
    if (phone) await target.tap(); else await target.click();
  } else bad.push(dev + ': Margaret, clear in a locked room, offers no Blur control to press');
  await page.waitForTimeout(400);
  const hostBlur = { 'Margaret Johnson': true };
  await check('locked', true, hostBlur);
  await shot('Ruth', 'locked');

  // 2. No password: faces stay soft room-wide; no tile offers blur at all.
  await page.evaluate(() => window.__gifosVideo.setRoomPwForTest(''));
  await page.waitForTimeout(300);
  await check('open', false, hostBlur);
  await shot('Ruth', 'open');

  // 3. Tom unmutes: Mute for all comes back on his tile.
  STATUS['Tom Ruiz'].muted = false;
  await page.evaluate((a) => window.__gifosVideo.setPeerStatusForTest(a.id, { muted: false }), { id: ID['Tom Ruiz'] });
  await page.waitForTimeout(200);
  const tom = await reach('Tom Ruiz');
  if (!tom.shown.map((l) => l.replace(/ for everyone$/i, ' for all')).includes('Mute for all')) bad.push(dev + ' Tom unmuted: no "Mute for all" (offers ' + tom.shown.join(', ') + ')');
  await context.close();
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const bad = [];
  for (const dev of ['iPhone SE', 'desktop']) {
    try { await run(browser, dev, bad); } catch (e) { bad.push(dev + ': ' + (e && e.message ? e.message.split('\n')[0] : e)); }
  }
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('\n  '));
    process.exit(1);
  }
  console.log('PASS every guest tile offers blur and mute by its own state, "for all"');
})().catch((e) => { console.error(e); process.exit(1); });
