/*
 * A guest joins the church service from a link on their phone and never
 * types a name. People lists them as "Guest", but their tile on the call
 * reads "…" forever and a screen reader hears "Participant". The usher
 * can't match the tile to the People row.
 * A connected seat with no name reads "Guest" on its tile, its avatar
 * letter and its label. A seat still connecting keeps "…" (its name may
 * be on the way).
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/guest-tile-name.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

async function tileOf(page, id) {
  return page.evaluate((pid) => {
    const t = document.querySelector('.tile[data-peer="' + pid + '"]');
    if (!t) return null;
    const n = t.querySelector('.name');
    const a = t.querySelector('.avatar');
    const letter = a ? Array.from(a.childNodes).filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim() : '';
    return { name: n ? n.textContent : '', aria: t.getAttribute('aria-label') || '', letter: letter };
  }, id);
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext(Object.assign({}, devices['iPhone SE'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'guest-tile-name&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  const bad = [];

  // Still connecting: no name yet is not "Guest" yet.
  let seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, names: ['Ruth', 'Zoe seat'], connected: false }));
  if (!seeded || !seeded.ok) bad.push('could not seat a connecting guest: ' + JSON.stringify(seeded));
  await page.evaluate(() => window.__gifosVideo.clearNameForTest('qa2'));
  await page.waitForTimeout(60);
  const early = await tileOf(page, 'qa2');
  if (!early) bad.push('the connecting guest has no tile');
  else if (early.name !== '…') bad.push('a seat still connecting reads "' + early.name + '", not "…"');

  // On the call, and the device sent no name.
  seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, names: ['Ruth', 'Zoe seat'] }));
  if (!seeded || !seeded.ok) bad.push('could not seat Ruth and the guest: ' + JSON.stringify(seeded));
  const cleared = await page.evaluate(() => window.__gifosVideo.clearNameForTest('qa2'));
  if (!cleared) bad.push('could not clear the guest\'s name');
  await page.waitForTimeout(60);
  const t = await tileOf(page, 'qa2');
  const ruth = await tileOf(page, 'qa1');
  if (!t) bad.push('the guest has no tile');
  else {
    if (t.name !== 'Guest') bad.push('the guest\'s tile reads "' + t.name + '", not "Guest" as People does');
    if (!/^Guest\./.test(t.aria)) bad.push('the guest\'s tile is read as "' + t.aria + '"');
    if (t.letter !== 'G') bad.push('the guest\'s avatar shows "' + t.letter + '", not "G"');
  }
  if (!ruth || ruth.name !== 'Ruth') bad.push('Ruth\'s tile reads "' + (ruth && ruth.name) + '"');
  const people = await page.evaluate(() => {
    const r = document.querySelector('#roster');
    return r ? (r.textContent || '') : '';
  });
  if (people && !/Guest/.test(people)) bad.push('People does not list "Guest"');

  await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-guest-tile-name-iphone-se.png') });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS guest tile name');
})().catch((e) => { console.error(e); process.exit(1); });
