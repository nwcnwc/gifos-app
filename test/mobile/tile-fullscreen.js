/*
 * Full screen on a face is 28×32. A thumb misses it. The control has
 * to be 44px and stay off the name.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/tile-fullscreen.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

function overlaps(a, b) {
  if (!a || !b || a.hidden || b.hidden) return false;
  return a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const phones = [
    { name: 'iphone-15', device: devices['iPhone 15'], shot: true },
    { name: 'iphone-se', device: devices['iPhone SE'], shot: false },
  ];
  const failures = [];
  for (const phone of phones) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=tile-fullscreen', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.evaluate(() => window.__gifosVideo.presentPeers([
      { id: 'peer-ruth', name: 'Ruth' },
      { id: 'peer-david', name: 'David' },
    ]));
    await page.waitForTimeout(250);
    const info = await page.evaluate(() => {
      const box = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          text: (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(),
          h: b.height, w: b.width, top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          hidden: cs.display === 'none' || cs.visibility === 'hidden' || b.height < 2 || b.width < 2,
        };
      };
      const buttons = Array.from(document.querySelectorAll('.tile .maxbtn')).map((el) => {
        const tile = el.closest('.tile');
        const name = tile ? tile.querySelector('.name') : null;
        return { btn: box(el), name: box(name), tile: box(tile) };
      }).filter((row) => row.btn && !row.btn.hidden);
      return { buttons: buttons, vh: window.innerHeight, vw: window.innerWidth };
    });
    const bad = [];
    if (!info.buttons.length) bad.push('no full screen control');
    for (const row of info.buttons) {
      const b = row.btn;
      if (b.h < 44 || b.w < 44) bad.push('full screen is ' + Math.round(b.w) + 'x' + Math.round(b.h));
      if (b.top < -1 || b.bottom > info.vh + 1 || b.left < -1 || b.right > info.vw + 1) bad.push('full screen is off screen');
      if (row.tile && (b.left < row.tile.left - 1 || b.right > row.tile.right + 1 || b.top < row.tile.top - 1 || b.bottom > row.tile.bottom + 1)) {
        bad.push('full screen sits off the face');
      }
      if (overlaps(b, row.name)) bad.push('full screen covers ' + (row.name && row.name.text));
    }
    const tooSmall = info.buttons.some((row) => row.btn.w < 44 || row.btn.h < 44);
    if (phone.shot && tooSmall) await page.screenshot({ path: path.join(SHOTS, 'before-tile-fullscreen-iphone-15.png') });
    if (phone.shot && !bad.length) await page.screenshot({ path: path.join(SHOTS, 'after-tile-fullscreen-iphone-15.png') });
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS tile fullscreen');
})().catch((e) => { console.error(e); process.exit(1); });
