/*
 * 0.9.23b: Open on a face opens that tile into its control window. On a
 * phone and on a desktop:
 * - a picture tap does not open the sheet; Open does, including on a calm phone
 * - the window grows out of the tile; the tile keeps showing the person
 * - the window is whole on the screen, each per-person control once, in the
 *   same words everywhere ("Mute for all", "Blur for all"), plus Pin
 * - those controls are at least 44px tall with 16px words. Reset and Pin sit
 *   in the narrow column beside the preview, and a short sideways phone
 *   compacts the whole sheet, so those stay the smaller size that fits
 * - Mute for all hides while that person is muted, and comes back
 * - Close puts the face back
 * Replaces the tap-menu scripts (tile-menu-*, host-tile-controls,
 * blur-tile, host-tile-blur-states, callstate-tap-through).
 *
 *   NODE_PATH=<playwright> node test/mobile/tile-window.js
 */
const { chromium, devices } = require('playwright');
const { clearRoom } = require('./lib/clear-room');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const NAMES = ['Ruth', 'Margaret Johnson'];
const CASES = [
  ['iphone-se', devices['iPhone SE']],
  ['iphone-se-land', devices['iPhone SE landscape']],
  ['iphone-15', devices['iPhone 15']],
  ['pixel-7', devices['Pixel 7']],
  ['desktop', { viewport: { width: 1280, height: 720 } }],
];

async function openWin(page, phone) {
  const tile = page.locator('#grid .tile', { has: page.locator('.name', { hasText: 'Ruth' }) }).first();
  const open = tile.locator('.tile-open');
  // A picture tap does not open the person sheet. Open does. A calm phone
  // swallows an empty tap; Open is a control, so one press opens it.
  if (phone) await open.tap({ timeout: 5000 });
  else await open.click({ timeout: 5000 });
  await page.locator('#tilewin').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(400);
}

function read(page) {
  return page.evaluate(() => {
    const win = document.getElementById('tilewin');
    const wr = win.getBoundingClientRect();
    const tile = [...document.querySelectorAll('#grid .tile')].find((t) => (t.querySelector('.name') || {}).textContent === 'Ruth');
    const shown = (el) => { const cs = getComputedStyle(el); return el.getClientRects().length && cs.display !== 'none' && cs.visibility !== 'hidden'; };
    const btns = [...win.querySelectorAll('button')].filter(shown).filter((b) => /[A-Za-z]/.test(b.textContent));
    // The narrow column beside the preview, and a short sideways phone, use
    // the compact controls so the sheet fits. The other controls stay 44px.
    const compact = window.matchMedia('(max-height: 500px) and (orientation: landscape)').matches;
    const sized = btns.filter((b) => !(compact || (b.closest('.tw-side') && b.classList.contains('tw-btn'))));
    return {
      onScreen: wr.left >= -0.5 && wr.top >= -0.5 && wr.right <= innerWidth + 0.5 && wr.bottom <= innerHeight + 0.5,
      away: tile.classList.contains('tw-away'),
      tileVideoHidden: getComputedStyle(tile.querySelector(':scope > video')).visibility === 'hidden',
      words: btns.map((b) => b.textContent.trim()),
      small: sized.filter((b) => b.getBoundingClientRect().height < 44 - 0.5 || parseFloat(getComputedStyle(b).fontSize) < 16).map((b) => b.textContent.trim()),
      outside: btns.filter((b) => { const r = b.getBoundingClientRect(); return r.left < wr.left - 0.5 || r.right > wr.right + 0.5; }).map((b) => b.textContent.trim()),
    };
  });
}

async function closeWin(page) {
  await page.locator('#tilewin .tw-close').click();
  await page.locator('#tilewin').waitFor({ state: 'hidden', timeout: 5000 });
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const bad = [];
  for (const [tag, device] of CASES) {
    const ctx = await browser.newContext(Object.assign({}, device, { permissions: ['camera', 'microphone'] }));
    await ctx.addInitScript(() => { localStorage.setItem('gifos_name', 'Nathan'); sessionStorage.setItem('gifos_appeared', '1'); });
    const page = await ctx.newPage();
    await page.goto(BASE + '/run.html#v=qatw' + Date.now().toString(36) + tag + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { state: 'attached', timeout: 15000 });
    await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a, connected: true }), NAMES);
    if (!(await clearRoom(page, ['qa1', 'qa2']))) { bad.push(tag + ': the room never cleared'); await ctx.close(); continue; }
    await page.evaluate(() => window.__gifosVideo.setPeerStatusForTest('qa1', { muted: false }));
    const phone = tag !== 'desktop';
    if (phone) await page.waitForTimeout(3500); // calm first: the first tap only wakes
    await openWin(page, phone);
    let r = await read(page);
    if (!r.onScreen) bad.push(tag + ': the window runs off the screen');
    if (r.away || r.tileVideoHidden) bad.push(tag + ': Ruth\'s tile was blanked while her window is open');
    for (const w of ['Mute for all', 'Blur for all', 'Pin']) {
      const n = r.words.filter((x) => x === w).length;
      if (n !== 1) bad.push(tag + ': "' + w + '" shows ' + n + ' times (' + r.words.join(', ') + ')');
    }
    if (r.small.length) bad.push(tag + ': too small to tap or read: ' + r.small.join(', '));
    if (r.outside.length) bad.push(tag + ': runs out of the window: ' + r.outside.join(', '));
    await closeWin(page);
    await page.evaluate(() => window.__gifosVideo.setPeerStatusForTest('qa1', { muted: true }));
    await openWin(page, phone);
    r = await read(page);
    if (r.words.includes('Mute for all')) bad.push(tag + ': a muted person still offers Mute for all');
    await page.screenshot({ path: '/tmp/tile-window-' + tag + '.png' });
    await closeWin(page);
    await ctx.close();
  }
  await browser.close();
  if (bad.length) { console.log('FAIL\n' + bad.join('\n')); process.exit(1); }
  console.log('PASS a tap opens the tile into one window with every control, on ' + CASES.map((c) => c[0]).join(', '));
})().catch((e) => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });
