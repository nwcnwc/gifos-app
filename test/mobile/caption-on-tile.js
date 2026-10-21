/*
 * A caption line has to stay on the call and stay readable at 200% text.
 * A long line used to grow past the tile and off the top of an SE.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/caption-on-tile.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const LINE = 'The Lord is my shepherd, I shall not want. He makes me lie down in green pastures.';
const PEOPLE = [
  { id: 'peer-ruth', name: 'Ruth' },
  { id: 'peer-david', name: 'David' },
  { id: 'peer-sam', name: 'Sam' },
];

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  const phones = [
    { name: 'iphone-se', device: devices['iPhone SE'], scale: null, minFont: 16 },
    { name: 'iphone-se-200', device: devices['iPhone SE'], scale: '2', minFont: 30 },
  ];
  for (const phone of phones) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript((scale) => {
      try {
        localStorage.setItem('gifos_name', 'Pat');
        if (scale) localStorage.setItem('gifos_ui_scale', scale);
      } catch (e) {}
    }, phone.scale);
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=cap-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.evaluate((people) => window.__gifosVideo.presentPeers(people), PEOPLE);
    await page.waitForTimeout(400);
    // Captions show only on a screen that turned CC on (a801ad4). The switch
    // is in More (Talk); it folds the sheet.
    await page.locator('#bartoggle').tap();
    await page.locator('#ccbtn').scrollIntoViewIfNeeded();
    await page.locator('#ccbtn').tap();
    await page.waitForTimeout(150);
    await page.evaluate((line) => window.__gifosVideo.addTranscript(line), LINE);
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => {
      const el = document.getElementById('livecap');
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        text: el.textContent || '',
        shown: cs.display !== 'none' && b.height > 2,
        font: parseFloat(cs.fontSize),
        top: b.top, bottom: b.bottom, h: b.height,
        vh: window.innerHeight,
      };
    });
    const bad = [];
    if (!info.shown) bad.push('no caption on the call');
    else {
      if (info.text.indexOf('shepherd') < 0) bad.push('caption text missing');
      if (info.font < phone.minFont) bad.push('caption font ' + info.font + 'px');
      if (info.top < -1 || info.bottom > info.vh + 1) bad.push('caption off screen');
    }
    if (phone.scale === '2') {
      const shot = (bad.length ? 'before' : 'after') + '-caption-tile-iphone-se-200.png';
      await page.screenshot({ path: path.join(SHOTS, shot) });
    }
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS caption on tile');
})().catch((e) => { console.error(e); process.exit(1); });
