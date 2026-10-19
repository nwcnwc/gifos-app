/*
 * A phone on its side left two faces as small squares in a black band.
 * 844x390 held them at 205px with the desktop 18px name. A Pixel 7
 * (915x412) and Nathan's phone (~960x430) were not treated as phones, so
 * waking the dock resized the faces (229px to 347px, 247px to 365px).
 * The faces now fill the height under the header, names stay at 12px,
 * and waking the dock does not move a face. More stays on the screen.
 *
 *   NODE_PATH=/home/nathan/rel23-gate-1017/node_modules node test/mobile/phone-landscape.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const VIEWS = [
  { name: '844x390', viewport: { width: 844, height: 390 }, ua: devices['iPhone 12'].userAgent, scale: 3 },
  { name: '915x412', viewport: { width: 915, height: 412 }, ua: devices['Pixel 7'].userAgent, scale: 2.625 },
  { name: '960x430', viewport: { width: 960, height: 430 }, ua: devices['Pixel 7'].userAgent, scale: 2.625 },
];

function look() {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2 || r.height < 2) return null;
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height };
  };
  const tiles = [...document.querySelectorAll('#feed .tile')].filter((t) => t.offsetParent).map((t) => {
    const r = t.getBoundingClientRect();
    const n = t.querySelector('.name');
    const cs = n ? getComputedStyle(n) : null;
    return {
      name: n ? n.textContent.replace(/\s+/g, ' ').trim() : '',
      x: r.left, y: r.top, w: r.width, h: r.height,
      font: cs ? parseFloat(cs.fontSize) : 0,
      clipped: !!(n && (n.scrollWidth > n.clientWidth + 2 || n.scrollHeight > n.clientHeight + 2)),
    };
  });
  const more = document.getElementById('barmore');
  const mr = more ? more.getBoundingClientRect() : null;
  const open = !!(more && more.offsetParent && mr && mr.height > 20);
  return {
    vw: innerWidth, vh: innerHeight,
    away: document.body.classList.contains('chrome-away'),
    tiles,
    chip: box(document.querySelector('.topchip')),
    fit: box(document.getElementById('fitbtn')),
    more: open ? { top: mr.top, bottom: mr.bottom, left: mr.left, right: mr.right, h: mr.height } : null,
  };
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--disable-gpu', '--mute-audio'],
  });
  const failures = [];
  const shots = [];
  for (const view of VIEWS) {
    const context = await browser.newContext({
      viewport: view.viewport,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: view.scale,
      userAgent: view.ua,
    });
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=phone-land-' + view.name + '-' + process.pid + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 1, names: ['Meeting Bot'] }));
    if (!seeded || !seeded.ok) { failures.push(view.name + ': could not seat the guest'); await context.close(); continue; }
    await page.keyboard.press('Shift');
    await page.waitForTimeout(500);
    const up = await page.evaluate(look);
    await page.evaluate(() => { if (window.__gifosChrome) window.__gifosChrome.idle(); });
    await page.waitForTimeout(400);
    const away = await page.evaluate(look);
    const bad = [];
    if (up.away) bad.push('controls did not stay up');
    if (!away.away) bad.push('controls did not tuck');
    if (away.tiles.length !== 2) bad.push('only ' + away.tiles.length + ' faces');
    const want = ['Nathan (you)', 'Meeting Bot'];
    for (const state of [['up', up], ['away', away]]) {
      for (const t of state[1].tiles) {
        if (t.h < state[1].vh * 0.72) bad.push(state[0] + ' ' + (t.name || 'face') + ' is ' + Math.round(t.w) + 'x' + Math.round(t.h) + ' on a ' + state[1].vh + 'px screen');
        if (t.y + t.h < state[1].vh - 2) bad.push(state[0] + ' ' + (t.name || 'face') + ' leaves ' + Math.round(state[1].vh - (t.y + t.h)) + 'px black below');
        if (Math.abs(t.w / t.h - 1) > 0.04) bad.push(state[0] + ' ' + (t.name || 'face') + ' is not square');
        if (t.font > 14) bad.push(state[0] + ' ' + (t.name || 'face') + ' name is ' + t.font + 'px');
        if (t.clipped) bad.push(state[0] + ' ' + t.name + ' is cut');
      }
    }
    for (const who of want) {
      if (!away.tiles.some((t) => t.name === who)) bad.push('missing ' + who);
    }
    const byName = (list, name) => list.find((t) => t.name === name);
    for (const t of away.tiles) {
      const u = byName(up.tiles, t.name);
      if (!u) { bad.push(t.name + ' missing while the controls are up'); continue; }
      const moved = ['x', 'y', 'w', 'h'].filter((k) => Math.abs(u[k] - t[k]) > 1);
      if (moved.length) bad.push(t.name + ' moved when the controls tucked (' + moved.join(',') + ', ' + Math.round(u.w) + 'x' + Math.round(u.h) + ' to ' + Math.round(t.w) + 'x' + Math.round(t.h) + ')');
    }
    if (away.fit && away.chip) {
      if (away.fit.left < away.chip.right + 8) bad.push('Fit overlaps the room name');
      if (away.fit.right > away.vw + 1 || away.fit.left < -1 || away.fit.top < -1) bad.push('Fit is off the screen');
    } else bad.push('Fit or the room name is missing');
    await page.keyboard.press('Shift');
    await page.waitForTimeout(300);
    await page.locator('#bartoggle').tap();
    await page.waitForTimeout(250);
    const menu = await page.evaluate(look);
    if (!menu.more) bad.push('More did not open');
    else {
      if (menu.more.top < -1) bad.push('More starts above the screen');
      if (menu.more.bottom > menu.vh + 1) bad.push('More runs off the bottom (' + Math.round(menu.more.bottom) + ')');
      if (menu.more.left < -1 || menu.more.right > menu.vw + 1) bad.push('More runs off the side (' + Math.round(menu.more.left) + '..' + Math.round(menu.more.right) + ')');
    }
    await page.locator('#blur-none').scrollIntoViewIfNeeded().catch(() => {});
    const blur = await page.evaluate(() => {
      const el = document.getElementById('blur-none');
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const more = document.getElementById('barmore').getBoundingClientRect();
      return {
        inView: b.top >= -1 && b.bottom <= innerHeight + 1 && b.left >= -1 && b.right <= innerWidth + 1 && b.height >= 44,
        inSheet: b.top >= more.top - 1 && b.bottom <= more.bottom + 1,
      };
    });
    if (!blur || !blur.inView || !blur.inSheet) bad.push('No blur is not on the screen');
    for (const t of menu.tiles) {
      const a = byName(away.tiles, t.name);
      if (!a) continue;
      const moved = ['x', 'y', 'w', 'h'].filter((k) => Math.abs(a[k] - t[k]) > 1);
      if (moved.length) bad.push(t.name + ' resized when More opened');
    }
    const shot = 'phone-landscape-' + view.name + '.png';
    await page.screenshot({ path: path.join(SHOTS, shot) });
    shots.push(shot);
    if (bad.length) failures.push(view.name + ': ' + bad.join('; '));
    else console.log('PASS', view.name, away.tiles.map((t) => Math.round(t.w) + 'x' + Math.round(t.h) + '@' + t.font + 'px').join(' '));
    await context.close();
  }
  await browser.close();
  for (const f of shots) {
    const p = path.join(SHOTS, f);
    if (fs.existsSync(p)) fs.renameSync(p, path.join(SHOTS, (failures.length ? 'before-' : 'after-') + f));
  }
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS phone landscape fills the height');
})().catch((e) => { console.error(e); process.exit(1); });
