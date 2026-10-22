/*
 * Sideways, the first screen of More has to show the groups it leads with:
 * People (Invite, People) and Talk (Chat, Hand). On an SE the lead buttons
 * once sat under the blur row and Float, so you had to scroll.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/landscape-first.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const NEED = ['whobtn', 'chatbtn', 'hand'];

function land(device) {
  const o = Object.assign({}, device);
  o.viewport = { width: device.viewport.height, height: device.viewport.width };
  return o;
}

const PHONES = [
  { name: 'iphone-se-land', device: land(devices['iPhone SE']) },
  { name: 'iphone-15-land', device: land(devices['iPhone 15']) },
  {
    name: 'android-360-land',
    device: {
      viewport: { width: 740, height: 360 },
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
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Host'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'land-first-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.locator('#bartoggle').tap();
    await page.waitForTimeout(200);
    const info = await page.evaluate((ids) => {
      const more = document.getElementById('barmore');
      const mr = more.getBoundingClientRect();
      return {
        sheetTop: mr.top, sheetBottom: mr.bottom, vw: window.innerWidth, vh: window.innerHeight,
        buttons: ids.map((id) => {
          const el = document.getElementById(id);
          const b = el.getBoundingClientRect();
          return {
            id: id,
            text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
            top: b.top, bottom: b.bottom, h: b.height, w: b.width,
            inSheet: b.top >= mr.top - 1 && b.bottom <= mr.bottom + 1 && b.left >= mr.left - 1 && b.right <= mr.right + 1,
          };
        }),
      };
    }, NEED);
    if (phone.name === 'iphone-se-land') await page.screenshot({ path: path.join(SHOTS, 'after-landscape-first-se.png') });
    const bad = [];
    for (const b of info.buttons) {
      if (!b.inSheet) bad.push(b.id + ' "' + b.text + '" not on the first screen (bottom ' + Math.round(b.bottom) + ', sheet ' + Math.round(info.sheetBottom) + ')');
      if (b.h < 44 || b.w < 44) bad.push(b.id + ' is ' + Math.round(b.w) + 'x' + Math.round(b.h));
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
  console.log('PASS landscape first screen');
})().catch((e) => { console.error(e); process.exit(1); });
