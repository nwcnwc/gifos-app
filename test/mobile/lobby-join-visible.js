/*
 * Cold lobby: Join a link is on screen on a small phone.
 * Landscape may scroll the card, but the first action is visible immediately
 * and Join can be scrolled into the card.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/lobby-join-visible.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

function land(device) {
  const o = Object.assign({}, device);
  o.viewport = { width: device.viewport.height, height: device.viewport.width };
  return o;
}

const PHONES = [
  { name: 'iphone-se', device: devices['iPhone SE'], mustSee: ['lob-open', 'lob-admin-btn', 'lob-join-btn'] },
  { name: 'iphone-se-land', device: land(devices['iPhone SE']), mustSee: ['lob-open'], scrollTo: ['lob-join-btn'] },
  {
    name: 'android-360',
    device: {
      viewport: { width: 360, height: 740 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: devices['Pixel 7'].userAgent,
    },
    mustSee: ['lob-open', 'lob-admin-btn', 'lob-join-btn', 'lob-rename'],
  },
];

async function box(page, id) {
  return page.evaluate((buttonId) => {
    const el = document.getElementById(buttonId);
    const b = el.getBoundingClientRect();
    const card = document.querySelector('.lobby-card').getBoundingClientRect();
    const vh = window.innerHeight, vw = window.innerWidth;
    return {
      top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height, w: b.width,
      inView: b.top >= -1 && b.bottom <= vh + 1 && b.left >= -1 && b.right <= vw + 1 && b.height >= 44,
      inCard: b.top >= card.top - 1 && b.bottom <= card.bottom + 1,
    };
  }, id);
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  for (const phone of PHONES) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    const page = await context.newPage();
    await page.goto(BASE + '/run.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#lob-join-btn', { timeout: 15000 });
    await page.waitForTimeout(200);
    const bad = [];
    for (const id of phone.mustSee) {
      const b = await box(page, id);
      if (!b.inView) bad.push(id + ' off screen (bottom ' + Math.round(b.bottom) + ', h ' + Math.round(b.h) + ')');
    }
    for (const id of phone.scrollTo || []) {
      await page.evaluate((buttonId) => {
        const el = document.getElementById(buttonId);
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      }, id);
      const b = await box(page, id);
      if (!b.inView || !b.inCard) bad.push(id + ' not scrollable into view (top ' + Math.round(b.top) + ')');
    }
    if (phone.name === 'iphone-se' || phone.name === 'iphone-se-land') {
      await page.screenshot({ path: path.join(SHOTS, 'after-lobby-' + phone.name + '.png') });
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
  console.log('PASS lobby join visible');
})().catch((e) => { console.error(e); process.exit(1); });
