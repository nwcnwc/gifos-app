/*
 * A phone on its side must not squash faces into a wide strip.
 * Every tile stays within a portrait-phone shape, Fit stays off the
 * faces and the name chip, and Live and the dock stay on screen.
 * Desktop packing stays the wider gallery.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/sideways-tiles.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const PEOPLE = [
  { id: 'peer-ruth', name: 'Ruth' },
  { id: 'peer-david', name: 'David' },
  { id: 'peer-sam', name: 'Sam' },
];

function land(device) {
  const vp = device.viewport;
  return Object.assign({}, device, {
    viewport: { width: vp.height, height: vp.width },
  });
}

function overlaps(a, b) {
  return a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  const phones = [
    { name: 'iphone-se', device: land(devices['iPhone SE']) },
    { name: 'iphone-15', device: land(devices['iPhone 15']) },
  ];
  for (const phone of phones) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Pat'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=sideways-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.evaluate((people) => window.__gifosVideo.presentPeers(people), PEOPLE);
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => {
      const box = (el) => {
        if (!el || el.hidden) return null;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || b.height < 2) return null;
        return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height };
      };
      const tiles = Array.from(document.querySelectorAll('.tile')).map((el) => {
        const b = el.getBoundingClientRect();
        return {
          name: ((el.querySelector('.name') || {}).textContent || '').trim(),
          top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          h: b.height, w: b.width,
          shown: b.width > 8 && b.height > 8 && el.style.display !== 'none',
        };
      }).filter((t) => t.shown);
      return {
        tiles: tiles,
        fit: box(document.getElementById('fitbtn')),
        chip: box(document.querySelector('.topchip')),
        state: box(document.getElementById('callstate')),
        bar: box(document.querySelector('.bar')),
        vw: window.innerWidth, vh: window.innerHeight,
      };
    });
    const bad = [];
    if (info.tiles.length < 4) bad.push('only ' + info.tiles.length + ' faces');
    if (!info.state) bad.push('Live is hidden');
    if (!info.bar || info.bar.h < 44) bad.push('dock is hidden');
    if (!info.fit || info.fit.w < 44 || info.fit.h < 44) bad.push('Fit is under 44px');
    if (info.fit && info.chip && overlaps(info.fit, info.chip)) bad.push('Fit overlaps the name chip');
    if (info.fit && info.chip) {
      const gap = info.fit.left - info.chip.right;
      if (gap < 12) bad.push('Fit is ' + Math.round(gap) + 'px from the name chip');
    }
    for (const t of info.tiles) {
      const aspect = t.w / t.h;
      const short = Math.min(t.w, t.h);
      if (short < 96) bad.push((t.name || 'tile') + ' is ' + Math.round(t.w) + 'x' + Math.round(t.h));
      if (aspect > 1.05) bad.push((t.name || 'tile') + ' is a wide strip (' + aspect.toFixed(2) + ')');
      if (aspect < 0.44) bad.push((t.name || 'tile') + ' is thinner than a phone (' + aspect.toFixed(2) + ')');
      if (info.state && t.bottom > info.state.top + 1) bad.push((t.name || 'tile') + ' runs under Live');
      if (info.fit && overlaps(info.fit, t)) bad.push('Fit covers ' + (t.name || 'a face'));
      if (info.bar && t.bottom > info.bar.top + 1) bad.push((t.name || 'tile') + ' runs under the dock');
    }
    const shot = (bad.length ? 'before' : 'after') + '-sideways-tiles-' + phone.name + '.png';
    await page.screenshot({ path: path.join(SHOTS, shot) });
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    await context.close();
  }

  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await desk.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Pat'); } catch (e) {} });
  const page = await desk.newPage();
  await page.goto(BASE + '/run.html#v=sideways-desktop', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#leavebtn', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.click().catch(() => {});
  await page.evaluate((people) => window.__gifosVideo.presentPeers(people), PEOPLE);
  await page.waitForTimeout(500);
  const deskInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.tile')).map((el) => {
      const b = el.getBoundingClientRect();
      return { w: b.width, h: b.height, shown: b.width > 8 && b.height > 8 };
    }).filter((t) => t.shown).map((t) => t.w / t.h);
  });
  const deskBad = [];
  if (deskInfo.length < 4) deskBad.push('only ' + deskInfo.length + ' desktop faces');
  // The desktop packer (meet-gallery-fit-scroll, newer) keeps every tile a legal shape; its own suites cover it.
  // 0.9.23b: every Row tile is a square on a desktop too.
  if (!deskInfo.every((a) => Math.abs(a - 1) < 0.02)) deskBad.push('desktop tiles are not squares ' + deskInfo.map((a) => a.toFixed(2)).join(','));
  if (deskBad.length) failures.push('desktop: ' + deskBad.join('; '));
  await desk.close();

  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS sideways tiles');
})().catch((e) => { console.error(e); process.exit(1); });
