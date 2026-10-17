/*
 * A host in a 3-person call on an iPhone SE saw Ruth's tile offer "Mute for
 * everyone" and "Blur for everyone" while Margaret Johnson's tile offered
 * "Blur for all" and Full screen. The cause: Ruth's tap menu was open, and a
 * closed tile shows only its corner chip, which said "Blur for all" and had
 * no Mute. Ruth was also already muted, and still offered Mute.
 *
 * Every guest tile offers the same host controls with one wording ("for
 * all": text, aria-label and title), each control once. Mute for all hides
 * while that person says they are muted and comes back when they unmute;
 * muted for all, it reads Unmute for all. People (the roster) follows the
 * same rule. A desktop case checks the same.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/host-tile-controls.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const { clearRoom } = require('./lib/clear-room');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const NAMES = ['Ruth', 'Margaret Johnson'];
// Ids from seedGalleryForTest: Ruth is qa1, Margaret is qa2.
const RUTH = 'qa1';

// Every control on a tile a person can see right now, and every label on
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
    texts: all.filter(shown).map((b) => norm(b.textContent)),
    labels: all.flatMap((b) => [norm(b.textContent), norm(b.getAttribute('aria-label')), norm(b.title)]).filter(Boolean),
  };
}

function wording(tag, info, bad) {
  for (const l of new Set(info.labels)) {
    if (/\bfor everyone\b/i.test(l)) bad.push(tag + ': a control says "' + l + '"');
  }
  for (const l of info.texts) {
    if (/mute|blur/i.test(l) && !/^(Un)?(mute|blur) for all$/i.test(l)) bad.push(tag + ': a control reads "' + l + '"');
  }
  const seen = new Set();
  for (const l of info.shown) {
    if (seen.has(l)) bad.push(tag + ': "' + l + '" shows twice');
    seen.add(l);
  }
}

const sameSet = (a, b) => JSON.stringify([...new Set(a)].sort()) === JSON.stringify([...new Set(b)].sort());

async function openPage(browser, device, room) {
  const context = await browser.newContext(Object.assign({}, device));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=' + room + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.click().catch(() => {});
  const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), NAMES);
  // Blur for all shows only on a clear face: lock the room, faces clear
  // (host-tile-blur-states.js covers soft faces).
  const clear = await clearRoom(page, ['qa1', 'qa2']);
  await page.waitForTimeout(400);
  return { context, page, seeded: !!(seeded && seeded.ok) && clear };
}

const tileOf = (page, name) => page.locator('#grid .tile', { has: page.locator('.name', { hasText: name }) }).first();
const setMuted = (page, on) => page.evaluate((a) => window.__gifosVideo.setPeerStatusForTest(a.id, { muted: a.on }), { id: RUTH, on });

async function phone(browser, bad) {
  const tag = 'iPhone SE';
  const { context, page, seeded } = await openPage(browser, Object.assign({}, devices['iPhone SE'], { hasTouch: true }), 'host-tile-' + process.pid + '-' + Date.now());
  if (!seeded) { bad.push(tag + ': could not seat ' + NAMES.join(', ')); await context.close(); return; }
  const meTap = async () => {
    const me = await page.locator('.tile.me').boundingBox();
    await page.touchscreen.tap(me.x + me.width / 2, me.y + me.height / 2);
    await page.waitForTimeout(200);
  };
  // The name pill opens the menu, and sits clear of every button.
  const open = async (name) => {
    const n = await tileOf(page, name).locator('.name').boundingBox();
    await page.touchscreen.tap(n.x + n.width / 2, n.y + n.height / 2);
    await page.waitForTimeout(200);
    return tileOf(page, name).evaluate(readTile);
  };
  const look = async (name) => {
    const rest = await tileOf(page, name).evaluate(readTile);
    const opened = await open(name);
    await meTap();
    return { rest, opened };
  };

  // A phone keeps :hover on the last spot it was tapped (iOS does). Leave
  // it on Margaret's tile, as a tap there earlier would.
  const mj = await tileOf(page, 'Margaret Johnson').boundingBox();
  await page.mouse.move(mj.x + mj.width / 2, mj.y + mj.height / 2);
  // 1. Nobody muted: both guest tiles offer the same controls, same words.
  if (!(await setMuted(page, false))) bad.push(tag + ': could not unmute Ruth');
  await page.waitForTimeout(150);
  const seen = {};
  for (const name of NAMES) {
    const s = await look(name);
    seen[name] = s;
    if (!s.opened.open) { bad.push(tag + ' ' + name + ': a tap on the name opened no menu'); continue; }
    wording(tag + ' ' + name + ' at rest', s.rest, bad);
    wording(tag + ' ' + name + ' menu open', s.opened, bad);
    const reach = s.rest.shown.concat(s.opened.shown);
    for (const want of ['Mute for all', 'Blur for all']) {
      if (!reach.includes(want)) bad.push(tag + ' ' + name + ': no "' + want + '" at rest or in the menu (' + reach.join(', ') + ')');
    }
  }
  const [a, b] = NAMES.map((n) => seen[n]);
  if (a && b) {
    if (!sameSet(a.rest.shown, b.rest.shown)) bad.push(tag + ': at rest Ruth offers [' + a.rest.shown + '], Margaret offers [' + b.rest.shown + ']');
    if (!sameSet(a.opened.shown, b.opened.shown)) bad.push(tag + ': menu open Ruth offers [' + a.opened.shown + '], Margaret offers [' + b.opened.shown + ']');
  }

  // 2. Ruth mutes herself: her tile stops offering Mute for all.
  await setMuted(page, true);
  await page.waitForTimeout(150);
  const ruthMuted = await open('Ruth');
  await page.screenshot({ path: path.join(SHOTS, (bad.length || ruthMuted.shown.includes('Mute for all') ? 'before' : 'after') + '-host-tile-controls-iphone-se.png') });
  if (ruthMuted.shown.includes('Mute for all')) bad.push(tag + ': Ruth is muted and her menu still offers Mute for all');
  await meTap();
  const margaret = await open('Margaret Johnson');
  if (!margaret.shown.includes('Mute for all')) bad.push(tag + ': Margaret is not muted and her menu has no Mute for all');
  await meTap();

  // People follows the same rule and the same words.
  await page.locator('#status').tap();
  await page.waitForTimeout(100);
  const ppl = page.locator('#status-full-people');
  if (await ppl.count()) {
    await ppl.tap();
    await page.waitForTimeout(150);
    const rows = await page.evaluate(() => Array.from(document.querySelectorAll('#roster .roster-row')).map((r) => {
      const m = r.querySelector('.mutebtn');
      return {
        name: (r.querySelector('.nm') || {}).textContent || '',
        mute: m && !m.hidden && getComputedStyle(m).display !== 'none' ? { text: m.textContent.trim(), aria: m.getAttribute('aria-label') || '' } : null,
      };
    }));
    const ruth = rows.find((r) => /^Ruth/.test(r.name));
    const mj = rows.find((r) => /^Margaret/.test(r.name));
    if (!ruth || !mj) bad.push(tag + ': People lists [' + rows.map((r) => r.name) + ']');
    else {
      if (ruth.mute) bad.push(tag + ': People offers "' + ruth.mute.text + '" for Ruth, who is muted');
      if (!mj.mute) bad.push(tag + ': People offers no mute for Margaret');
      else if (mj.mute.text !== 'Mute for all') bad.push(tag + ': People says "' + mj.mute.text + '" for Margaret');
    }
    await page.locator('#roster-close').click().catch(() => {});
    await page.waitForTimeout(100);
  } else bad.push(tag + ': no People in the room sheet');

  // 3. Ruth unmutes: Mute for all is back.
  await setMuted(page, false);
  await page.waitForTimeout(150);
  const back = await open('Ruth');
  if (!back.shown.includes('Mute for all')) bad.push(tag + ': Ruth unmuted and her menu has no Mute for all');
  // 4. Muted for all, then she announces her mic off: the lift stays.
  const mute = tileOf(page, 'Ruth').locator('.modbar button[data-mod="mute"]');
  if (await mute.isVisible()) {
    await mute.tap();
    await page.waitForTimeout(200);
    await setMuted(page, true);
    await page.waitForTimeout(150);
    let lift = await tileOf(page, 'Ruth').evaluate(readTile);
    if (!lift.open) lift = await open('Ruth');
    if (!lift.shown.includes('Unmute for all')) bad.push(tag + ': Ruth muted for all offers [' + lift.shown + '], no Unmute for all');
  }
  await context.close();
}

async function desktop(browser, bad) {
  const tag = 'desktop';
  const { context, page, seeded } = await openPage(browser, { viewport: { width: 1280, height: 800 } }, 'host-tile-d-' + process.pid + '-' + Date.now());
  if (!seeded) { bad.push(tag + ': could not seat ' + NAMES.join(', ')); await context.close(); return; }
  const hover = async (name) => {
    await tileOf(page, name).hover();
    await page.waitForTimeout(200);
    return tileOf(page, name).evaluate(readTile);
  };
  await setMuted(page, false);
  await page.waitForTimeout(150);
  const seen = {};
  for (const name of NAMES) {
    const s = await hover(name);
    seen[name] = s;
    wording(tag + ' ' + name, s, bad);
    for (const want of ['Mute for all', 'Blur for all']) {
      if (!s.shown.includes(want)) bad.push(tag + ' ' + name + ': no "' + want + '" on hover (' + s.shown.join(', ') + ')');
    }
  }
  if (!sameSet(seen[NAMES[0]].shown, seen[NAMES[1]].shown)) bad.push(tag + ': Ruth offers [' + seen[NAMES[0]].shown + '], Margaret offers [' + seen[NAMES[1]].shown + ']');
  await setMuted(page, true);
  await page.mouse.move(2, 2);
  const ruth = await hover('Ruth');
  await page.screenshot({ path: path.join(SHOTS, (ruth.shown.includes('Mute for all') || bad.length ? 'before' : 'after') + '-host-tile-controls-desktop.png') });
  if (ruth.shown.includes('Mute for all')) bad.push(tag + ': Ruth is muted and her tile still offers Mute for all');
  await context.close();
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const bad = [];
  await phone(browser, bad);
  await desktop(browser, bad);
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS every guest tile has the same host controls, one wording, no Mute for someone already muted');
})().catch((e) => { console.error(e); process.exit(1); });
