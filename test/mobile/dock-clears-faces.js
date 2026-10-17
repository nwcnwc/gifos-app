/*
 * The dock must not cover the bottom row of faces. Four people on a phone
 * used to run under the controls.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/dock-clears-faces.js
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

const PHONES = [
  { name: 'iphone-15', device: devices['iPhone 15'] },
  { name: 'iphone-se', device: devices['iPhone SE'] },
  {
    name: 'android-360',
    device: {
      viewport: { width: 360, height: 740 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: devices['Pixel 7'].userAgent,
    },
  },
];

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  for (const phone of PHONES) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Grandma Ruth'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=dock-faces-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.evaluate((people) => window.__gifosVideo.presentPeers(people), PEOPLE);
    await page.waitForTimeout(250);
    const info = await page.evaluate(() => {
      const bar = document.querySelector('.bar').getBoundingClientRect();
      const tiles = Array.from(document.querySelectorAll('.tile')).map((el) => {
        const b = el.getBoundingClientRect();
        return {
          id: el.dataset.peer || '',
          name: (el.querySelector('.name') || {}).textContent || '',
          top: b.top, bottom: b.bottom, h: b.height, w: b.width,
          shown: b.width > 8 && b.height > 8 && el.style.display !== 'none',
        };
      }).filter((t) => t.shown);
      return { dockTop: bar.top, vh: window.innerHeight, tiles: tiles };
    });
    const bad = [];
    if (info.tiles.length < 4) bad.push('only ' + info.tiles.length + ' faces');
    for (const t of info.tiles) {
      if (t.bottom > info.dockTop + 1) bad.push((t.name || t.id) + ' runs under the dock (bottom ' + Math.round(t.bottom) + ', dock ' + Math.round(info.dockTop) + ')');
      if (t.h < 48) bad.push((t.name || t.id) + ' is only ' + Math.round(t.h) + 'px tall');
    }
    if (phone.name === 'iphone-15') await page.screenshot({ path: path.join(SHOTS, 'after-dock-faces-iphone-15.png') });
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS dock clears faces');
})().catch((e) => { console.error(e); process.exit(1); });
