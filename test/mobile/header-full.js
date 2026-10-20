/*
 * The header ellipsizes important lines. A tap on that line opens the
 * whole message. The room-name link stays the link.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/header-full.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const ROOM = 'header-full';
const LINE = 'No blur picked — turn your camera on to be ready for clear video.';

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
  await page.locator('#bartoggle').tap();
  await page.locator('#blur-none').scrollIntoViewIfNeeded();
  await page.locator('#blur-none').tap();
  await page.waitForTimeout(200);
  const chip = await page.evaluate(() => {
    const el = document.getElementById('status');
    return {
      text: el.textContent,
      title: el.title || '',
      // The line clips in the span that holds the text (it draws the "…").
      cut: [el, el.querySelector('.statustext')].some((b) => b && b.scrollWidth > b.clientWidth + 2),
      tag: el.tagName,
    };
  });
  const bad = [];
  if (chip.text.indexOf('No blur picked') < 0) bad.push('header "' + chip.text + '"');
  if (!chip.cut) bad.push('header is not truncated');
  await page.locator('#status').tap();
  await page.waitForTimeout(150);
  const sheet = await page.evaluate(() => {
    const el = document.getElementById('status-full');
    const p = document.getElementById('status-full-text');
    if (!el || !p) return { missing: true };
    const cs = getComputedStyle(el);
    const shown = cs.display !== 'none' && el.getBoundingClientRect().width > 20;
    return { missing: false, shown: shown, text: p.textContent, display: cs.display };
  });
  if (sheet.missing) bad.push('no full-message sheet');
  else if (!sheet.shown) bad.push('sheet stayed hidden (' + sheet.display + ')');
  else if (sheet.text !== LINE) bad.push('sheet "' + sheet.text + '"');
  const shot = bad.length ? 'before-header-full-pixel-7.png' : 'after-header-full-pixel-7.png';
  await page.screenshot({ path: path.join(SHOTS, shot) });
  if (!bad.length) {
    await page.locator('#status-full-close').tap();
    await page.evaluate(() => {
      window.__gifosVideo.presentPeers([
        { id: 'host-test', name: 'Host (test)' },
        { id: 'guest-3106', name: 'Guest 3106' },
        { id: 'notes-7597fb', name: 'bot notes' },
      ]);
    });
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return (s.title || '').indexOf('in this meeting') >= 0;
    }, { timeout: 8000 });
    await page.locator('#status').tap();
    const detail = await page.evaluate(() => document.getElementById('status-full-text').textContent);
    if (detail.indexOf('in this meeting') < 0) bad.push('meeting line "' + detail + '"');
    if (detail.indexOf('…') >= 0 || detail.indexOf('...') >= 0) bad.push('sheet still cuts the line');
    await page.screenshot({ path: path.join(SHOTS, 'after-header-full-count-pixel-7.png') });
  }
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify({ chip: chip, sheet: sheet }));
    process.exit(1);
  }
  console.log('PASS header full');
})().catch((e) => { console.error(e); process.exit(1); });
