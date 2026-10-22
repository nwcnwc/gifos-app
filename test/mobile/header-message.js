/*
 * On a phone the header chip shows an explicit message ("No blur picked…",
 * a refusal) while it holds, then goes back to the room name. The message
 * used to land only in the wide-window span, which a phone hides.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/header-message.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const ROOM = RUN_ROOM + 'header-message';

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
  // What a person can read: the text of the visible header parts.
  const seen = () => page.evaluate(() => {
    const chip = document.querySelector('.topchip');
    const parts = [];
    chip.querySelectorAll('#status, #statuscount, #statusrest').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (getComputedStyle(el).display !== 'none' && r.width > 4 && r.height > 4) parts.push(el.textContent.trim());
    });
    return parts.join(' ');
  });
  const during = await seen();
  const bad = [];
  if (during.indexOf('No blur picked') < 0) bad.push('phone header reads "' + during + '", not the message');
  await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-header-message-pixel-7.png') });
  // The 4s hold ends and the room name comes back.
  await page.waitForTimeout(4600);
  await page.evaluate(() => window.__gifosVideo.presentPeers([]));
  await page.waitForTimeout(300);
  const after = await seen();
  if (after.indexOf(ROOM) < 0) bad.push('after the hold the header reads "' + after + '", not the room');
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS header message');
})().catch((e) => { console.error(e); process.exit(1); });
