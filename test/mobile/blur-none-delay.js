/*
 * A pocketed peer holds the room at Min for up to a minute. The header
 * already says you are ready, and No blur stays the selected choice.
 * After the minute, clear video starts with no second tap.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/blur-none-delay.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const ROOM = 'clear-wait';

function stamp(page, ageMs) {
  return page.evaluate((age) => {
    window.__gifosVideo._ghostStatus('peer-sam', age, { away: true, blur: 1, camOff: false });
  }, ageMs);
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext(Object.assign({}, devices['Pixel 7'], { hasTouch: true }));
  await context.addInitScript((room) => {
    try {
      localStorage.setItem('gifos_name', 'Nathan');
      localStorage.setItem('gifos_vpw_' + room, 'sunday');
      localStorage.setItem('gifos_vpwat_' + room, String(Date.now()));
    } catch (e) {}
  }, ROOM);
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=' + ROOM, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.waitForFunction(() => {
    const api = window.__gifosVideo;
    return api && api.pwState && api.pwState().pw === 'sunday';
  }, { timeout: 8000 });
  await page.evaluate(() => window.__gifosVideo.presentPeers([{ id: 'peer-sam', name: 'Sam' }]));
  await stamp(page, 30000);
  await page.waitForFunction(() => {
    const api = window.__gifosVideo;
    const dump = api.debugDump();
    const sam = (dump.roster || []).some((row) => row && (row.peer === 'peer-sam' || row.name === 'Sam'));
    return sam && dump.consent === false;
  }, { timeout: 8000 });
  const unmute = page.locator('#unmute');
  if (await unmute.count() && await unmute.isVisible().catch(() => false)) await unmute.tap();
  await page.locator('#cam').tap();
  await page.waitForFunction(() => window.__gifosVideo.camOff() === false, { timeout: 8000 });
  await stamp(page, 30000);
  await page.locator('#bartoggle').tap();
  await page.locator('#blur-min').scrollIntoViewIfNeeded();
  await page.locator('#blur-min').tap();
  await page.locator('#blur-none').scrollIntoViewIfNeeded();
  await page.locator('#blur-none').tap();
  await page.waitForTimeout(250);
  const read = () => page.evaluate(() => {
    const el = document.getElementById('blur-none');
    const cs = getComputedStyle(el);
    const api = window.__gifosVideo;
    const dump = api.debugDump();
    return {
      sel: el.classList.contains('sel'),
      wait: el.classList.contains('wait'),
      pressed: el.getAttribute('aria-pressed'),
      bg: cs.backgroundColor,
      color: cs.color,
      wish: api.myBlur(),
      feed: api.blurClassOf('me'),
      status: document.getElementById('status').textContent,
      consent: dump.consent,
      roster: (dump.roster || []).map((row) => row && row.peer),
    };
  });
  const during = await read();
  const duringOk = during.wait === false && during.sel && during.bg === 'rgb(29, 29, 31)';
  const shotDuring = duringOk ? 'after-blur-wait-pixel-7.png' : 'before-blur-wait-pixel-7.png';
  await page.screenshot({ path: path.join(SHOTS, shotDuring) });
  if (duringOk) await page.locator('#blurseg').screenshot({ path: path.join(SHOTS, 'after-blur-wait-seg.png') });
  await stamp(page, 61000);
  await page.waitForFunction(() => {
    const api = window.__gifosVideo;
    const dump = api.debugDump();
    const sam = (dump.roster || []).some((row) => row && (row.peer === 'peer-sam' || row.name === 'Sam'));
    return !sam && api.blurClassOf('me') === 0;
  }, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  const later = await read();
  if (later.feed === 0 && !later.wait && later.sel) {
    await page.screenshot({ path: path.join(SHOTS, 'after-blur-clear-pixel-7.png') });
    await page.locator('#blurseg').screenshot({ path: path.join(SHOTS, 'after-blur-clear-seg.png') });
  }
  const bad = [];
  if (during.status.indexOf('ready for clear video') < 0) bad.push('header "' + during.status + '"');
  if (during.wish !== 0) bad.push('choice ' + during.wish);
  if (during.feed !== 1) bad.push('feed during the minute is ' + during.feed);
  if (during.consent !== false) bad.push('room already consented during the holdover');
  if (!during.sel || during.wait) bad.push('No blur is not the selected choice while the header says ready (sel ' + during.sel + ', wait ' + during.wait + ')');
  if (during.bg !== 'rgb(29, 29, 31)' || during.color !== 'rgb(255, 255, 255)') bad.push('No blur fill ' + during.bg + ' / ' + during.color);
  if (later.feed !== 0) bad.push('after the minute the feed is still ' + later.feed + ' roster ' + JSON.stringify(later.roster));
  if (later.wait) bad.push('No blur stayed pending after the room cleared');
  if (later.feed === 0 && !later.sel) bad.push('clear video started and No blur is not the selected choice');
  if (later.feed === 0 && later.bg !== 'rgb(29, 29, 31)') bad.push('clear No blur fill is ' + later.bg);
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify({ during: during, later: later }));
    process.exit(1);
  }
  console.log('PASS blur none delay');
})().catch((e) => { console.error(e); process.exit(1); });
