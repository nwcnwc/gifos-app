/*
 * More's host controls have to say what they do. "Password", "Vote", and
 * "Stage" do not. The phrase has to fit inside the button, including at 200%.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/host-words.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

const WANT = {
  pwbtn: 'Room password',
  votebtn: 'Vote on someone',
  stagebtn: 'Step on stage',
};

function phone360() {
  return {
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['Pixel 7'].userAgent,
  };
}

const PHONES = [
  { name: 'iphone-15', device: devices['iPhone 15'], scale: null },
  { name: 'iphone-se', device: devices['iPhone SE'], scale: null },
  { name: 'android-360-200', device: phone360(), scale: '2' },
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
    await context.addInitScript((scale) => {
      try {
        localStorage.setItem('gifos_name', 'Host');
        if (scale) localStorage.setItem('gifos_ui_scale', scale);
      } catch (e) {}
    }, phone.scale);
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=host-words-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.locator('#bartoggle').tap();
    await page.waitForTimeout(200);
    const bad = [];
    for (const id of Object.keys(WANT)) {
      await page.evaluate((buttonId) => {
        const el = document.getElementById(buttonId);
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      }, id);
      const info = await page.evaluate((buttonId) => {
        const el = document.getElementById(buttonId);
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
          w: b.width, h: b.height,
          hidden: cs.display === 'none' || b.width < 2,
          wide: el.scrollWidth > el.clientWidth + 2,
          tall: el.scrollHeight > el.clientHeight + 2,
          onScreen: b.top >= -1 && b.bottom <= window.innerHeight + 1 && b.left >= -1 && b.right <= window.innerWidth + 1,
        };
      }, id);
      if (info.hidden) bad.push(id + ' hidden');
      if (info.text !== WANT[id]) bad.push(id + ' says "' + info.text + '"');
      if (info.h < 44 || info.w < 44) bad.push(id + ' is ' + Math.round(info.w) + 'x' + Math.round(info.h));
      if (!info.onScreen) bad.push(id + ' off screen');
      if (info.wide || info.tall) bad.push(id + ' text does not fit in the button');
    }
    if (phone.name === 'iphone-15') {
      await page.evaluate(() => {
        const el = document.getElementById('pwbtn');
        if (el) el.scrollIntoView({ block: 'nearest' });
      });
      await page.screenshot({ path: path.join(SHOTS, 'after-host-words-iphone-15.png') });
    }
    const stepped = await page.evaluate(() => {
      const el = document.getElementById('stagebtn');
      el.click();
      return (el.innerText || '').replace(/\s+/g, ' ').trim();
    });
    if (stepped !== 'Step off stage') bad.push('on stage the button says "' + stepped + '"');
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    else console.log('PASS', phone.name);
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS host words');
})().catch((e) => { console.error(e); process.exit(1); });
