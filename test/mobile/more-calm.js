/*
 * More on a phone was a wall of equal buttons over the faces. The sheet
 * leads with People, then Talk: Invite, People, Chat and Hand are on the
 * first screen, two rows at most, and the rarer room, setup and help
 * controls scroll. Invite is the one blue action.
 *
 * On Nathan's Android phone (390 wide) a dock he had dragged left carried
 * the sheet with it: "Blur" read "ur" and Invite was cut in half. The open
 * sheet sits wholly on the screen, nothing in it is cut (German, Spanish
 * and large text too), the page never scrolls sideways, and a dock dragged
 * left, right or up leaves the sheet on the screen.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/more-calm.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const FIRST = ['whobtn', 'chatbtn', 'hand'];
const LATER = ['stagebtn', 'votebtn', 'appbtn', 'setbtn', 'keysbtn'];
const MOST_FIRST = 8;

const ANDROID_390 = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent };

const PHONES = [
  { name: 'iphone-15', device: devices['iPhone 15'] },
  { name: 'iphone-se', device: devices['iPhone SE'] },
];

const FITS = [
  { name: 'android-390', device: ANDROID_390 },
  { name: 'android-390-de', device: ANDROID_390, locale: 'de-DE' },
  { name: 'android-390-es', device: ANDROID_390, locale: 'es-MX' },
  { name: 'android-390-large', device: ANDROID_390, scale: 1.5 },
  { name: 'android-360', device: Object.assign({}, ANDROID_390, { viewport: { width: 360, height: 780 } }) },
  { name: 'iphone-se', device: devices['iPhone SE'] },
];
// The grip's arrow keys move the dock the way a drag does (24px a press,
// held inside the screen).
const DRAGS = [['as it opens', null, 0], ['dock dragged left', 'ArrowLeft', 3], ['dock dragged right', 'ArrowRight', 6], ['dock dragged up', 'ArrowUp', 30]];

function overlaps(a, b) {
  return a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1;
}

// Everything wrong with the open sheet's fit, at the top of its scroll and
// at the bottom.
function sheetFit(page) {
  return page.evaluate(async () => {
    const s = document.getElementById('barmore');
    const vw = window.innerWidth, vh = window.innerHeight, vv = window.visualViewport;
    const bad = [];
    const shown = (el) => el.getClientRects().length && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
    const look = (where) => {
      const r = s.getBoundingClientRect();
      if (r.left < -0.5 || r.right > vw + 0.5) bad.push('sheet ' + Math.round(r.left) + '..' + Math.round(r.right) + ' on a ' + vw + 'px screen');
      if (r.top < -0.5 || r.bottom > vh + 0.5) bad.push('sheet top ' + Math.round(r.top) + ', bottom ' + Math.round(r.bottom) + ' on a ' + vh + 'px screen');
      if (s.scrollWidth > s.clientWidth + 1) bad.push('the sheet scrolls sideways (' + s.scrollWidth + ' in ' + s.clientWidth + ')');
      for (const el of s.querySelectorAll('button, .blurlbl, h4, label')) {
        if (!shown(el)) continue;
        const g = el.getBoundingClientRect();
        const name = el.id || (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 20) || el.className;
        if (g.left < r.left - 1 || g.right > r.right + 1) bad.push(name + ' runs off the sheet (' + Math.round(g.left) + '..' + Math.round(g.right) + ', ' + where + ')');
        if (el.scrollWidth > el.clientWidth + 1) bad.push(name + ' cuts its words (' + el.scrollWidth + ' in ' + el.clientWidth + ')');
        if (el.tagName === 'BUTTON' && el.scrollHeight > el.clientHeight + 1) bad.push(name + ' cuts a line (' + el.scrollHeight + ' in ' + el.clientHeight + ')');
      }
    };
    s.scrollTop = 0;
    look('top');
    s.scrollTop = s.scrollHeight;
    await new Promise((res) => requestAnimationFrame(() => res()));
    look('bottom');
    s.scrollTop = 0;
    const de = document.documentElement;
    if (de.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1 || window.scrollX !== 0) bad.push('the page scrolls sideways (' + de.scrollWidth + ' on ' + vw + ')');
    if (vv && (Math.abs(vv.scale - 1) > 0.01 || Math.round(vv.width) !== vw)) bad.push('the phone zoomed out (' + Math.round(vv.width) + ' at ' + vv.scale + ')');
    return Array.from(new Set(bad));
  });
}

async function moreOpen(page, open) {
  await page.evaluate(() => { if (window.__gifosChrome) window.__gifosChrome.show(); });
  const now = (await page.locator('#bartoggle').getAttribute('aria-expanded')) === 'true';
  if (now !== open) await page.locator('#bartoggle').tap();
  await page.waitForTimeout(300);
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  for (const phone of PHONES) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Host'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'more-calm-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.locator('#bartoggle').tap();
    await page.waitForTimeout(200);
    const info = await page.evaluate((ids) => {
      const more = document.getElementById('barmore');
      const mr = more.getBoundingClientRect();
      const box = (el) => {
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          id: el.id,
          text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
          top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          w: b.width, h: b.height,
          bg: cs.backgroundColor, color: cs.color, dock: !!el.closest('#dockrow'),
          full: b.height > 8 && b.top >= mr.top - 1 && b.bottom <= mr.bottom + 1 && b.left >= mr.left - 1 && b.right <= mr.right + 1,
        };
      };
      const buttons = Array.from(more.querySelectorAll(':scope > button, .morerow > button')).filter((el) => {
        return getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 8;
      }).map(box);
      const status = document.getElementById('status').getBoundingClientRect();
      return {
        sheet: { top: mr.top, bottom: mr.bottom, left: mr.left, right: mr.right, h: mr.height },
        status: { top: status.top, bottom: status.bottom, left: status.left, right: status.right },
        buttons: buttons,
        want: ids.map((id) => box(document.getElementById(id))),
        vh: window.innerHeight,
      };
    }, FIRST.concat(LATER, ['pwbtn']));
    const bad = [];
    const full = info.buttons.filter((b) => b.full);
    if (full.length > MOST_FIRST) bad.push(full.length + ' buttons on the first screen (' + full.map((b) => b.text).join(', ') + ')');
    // Dock stand-ins (React, Step off) ride above the groups; they are the dock's, not More's.
    const rows = new Set(full.filter((b) => !b.dock).map((b) => Math.round(b.top)));
    if (rows.size > 2) bad.push(rows.size + ' rows of More on the first screen');
    for (const id of FIRST) {
      const b = info.want.find((x) => x.id === id);
      if (!b || !b.full) bad.push(id + ' is not on the first screen');
      else if (b.h < 44 || b.w < 44) bad.push(id + ' is ' + Math.round(b.w) + 'x' + Math.round(b.h));
    }
    for (const id of LATER) {
      const b = info.want.find((x) => x.id === id);
      if (b && b.full) bad.push(id + ' is on the first screen');
    }
    if (overlaps(info.sheet, info.status)) bad.push('More covers the name');
    if (info.sheet.top < 80) bad.push('sheet top ' + Math.round(info.sheet.top) + ' covers the call');
    if (phone.name === 'iphone-15') {
      const shot = bad.length ? 'before-more-calm-iphone-15.png' : 'after-more-calm-iphone-15.png';
      await page.screenshot({ path: path.join(SHOTS, shot) });
    }
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    else console.log('PASS', phone.name);
    await context.close();
  }
  for (const fit of FITS) {
    const context = await browser.newContext(Object.assign({}, fit.device, { hasTouch: true, locale: fit.locale || 'en-US' }));
    await context.addInitScript((scale) => {
      try {
        localStorage.setItem('gifos_name', 'Nathan');
        if (scale) localStorage.setItem('gifos_ui_scale', String(scale));
      } catch (e) {}
    }, fit.scale || 0);
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'more-fit-' + fit.name + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    // Two others, as in Nathan's call with the Meeting Bot.
    await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2 }));
    const bad = [];
    for (const [how, key, presses] of DRAGS) {
      await moreOpen(page, false);
      if (key) {
        await page.locator('#bargrip').focus();
        for (let i = 0; i < presses; i++) await page.keyboard.press(key);
        await page.waitForTimeout(150);
      }
      await moreOpen(page, true);
      const fitBad = await sheetFit(page);
      if (fit.name === 'android-390' && key === 'ArrowLeft') {
        await page.screenshot({ path: path.join(SHOTS, (fitBad.length ? 'before' : 'after') + '-more-fit-android-390-dragged-left.png') });
      }
      for (const b of fitBad) bad.push(how + ': ' + b);
    }
    if (bad.length) failures.push('fit ' + fit.name + ': ' + bad.join('; '));
    else console.log('PASS fit', fit.name);
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS more calm');
})().catch((e) => { console.error(e); process.exit(1); });
