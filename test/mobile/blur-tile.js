/*
 * Blur for all is a square on the tile, at least 44px, inset from the
 * corner so a tap on the video does not hit it. Phone and desktop.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/blur-tile.js
 */
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';

const CASES = [
  { name: 'iphone-15', device: Object.assign({}, devices['iPhone 15'], { hasTouch: true }), tap: true },
  { name: 'iphone-se', device: Object.assign({}, devices['iPhone SE'], { hasTouch: true }), tap: true },
  { name: 'desktop', device: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false }, tap: false },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  for (const phone of CASES) {
    const context = await browser.newContext(phone.device);
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Pat'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=blur-tile-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) {
      if (phone.tap) await skip.tap().catch(() => {});
      else await skip.click().catch(() => {});
    }
    await page.evaluate((people) => window.__gifosVideo.presentPeers(people), [
      { id: 'peer-ruth', name: 'Ruth' },
      { id: 'peer-david', name: 'David' },
    ]);
    await page.waitForSelector('.blurbox', { timeout: 5000 });
    const info = await page.evaluate(() => {
      const box = (el) => {
        const b = el.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height };
      };
      return Array.from(document.querySelectorAll('.tile > .blurbox')).map((el) => {
        const tile = el.closest('.tile');
        const tb = tile.getBoundingClientRect();
        const b = box(el);
        tile.classList.add('menu');
        const mod = tile.querySelector('.modbar');
        const name = tile.querySelector('.name');
        const max = tile.querySelector('.maxbtn');
        return {
          text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
          w: b.w, h: b.h,
          topGap: b.top - tb.top,
          rightGap: tb.right - b.right,
          name: name ? box(name) : null,
          max: max && max.getBoundingClientRect().width > 2 ? box(max) : null,
          mod: mod ? box(mod) : null,
          clipped: el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2,
        };
      });
    });
    const bad = [];
    if (info.length < 1) bad.push('no blur button');
    for (const b of info) {
      if (b.text !== 'Blur for all') bad.push('says "' + b.text + '"');
      if (b.w < 44 || b.h < 44) bad.push('is ' + Math.round(b.w) + 'x' + Math.round(b.h));
      if (Math.abs(b.w - b.h) > 1) bad.push('not square (' + Math.round(b.w) + 'x' + Math.round(b.h) + ')');
      if (b.topGap < 8 || b.rightGap < 8) bad.push('flush with the corner (inset ' + Math.round(b.topGap) + ',' + Math.round(b.rightGap) + ')');
      if (b.clipped) bad.push('label is clipped');
    }
    const clear = await page.evaluate(() => {
      function gap(a, b) {
        if (!a || !b || b.w < 2 || b.h < 2) return 999;
        return Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
      }
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2) return null;
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height };
      };
      return Array.from(document.querySelectorAll('.tile > .blurbox')).map((el) => {
        const tile = el.closest('.tile');
        tile.classList.add('menu');
        const a = box(el);
        return {
          name: gap(a, box(tile.querySelector('.name'))),
          max: gap(a, box(tile.querySelector('.maxbtn'))),
          mod: gap(a, box(tile.querySelector('.modbar'))),
        };
      });
    });
    for (const c of clear) {
      if (c.name < 12) bad.push('name is ' + Math.round(c.name) + 'px from Blur for all');
      if (c.max < 12) bad.push('full screen is ' + Math.round(c.max) + 'px from Blur for all');
      if (c.mod < 12) bad.push('the tile menu is ' + Math.round(c.mod) + 'px from Blur for all');
    }
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    else console.log('PASS', phone.name);
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS blur tile');
})().catch((e) => { console.error(e); process.exit(1); });
