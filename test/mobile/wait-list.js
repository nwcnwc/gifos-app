/*
 * A host can hold the door and admit from a list. The list sits above the
 * dock, inside the screen, with 44px Admit and Not now buttons.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/wait-list.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

function land(device) {
  const o = Object.assign({}, device);
  o.viewport = { width: device.viewport.height, height: device.viewport.width };
  return o;
}

const PHONES = [
  { name: 'iphone-15', device: devices['iPhone 15'] },
  { name: 'iphone-se-land', device: land(devices['iPhone SE']) },
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
    await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'wait-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.locator('#bartoggle').tap();
    await page.waitForTimeout(150);
    const btn = page.locator('#waitbtn');
    if (!(await btn.count())) {
      if (phone.name === 'iphone-15') await page.screenshot({ path: path.join(SHOTS, 'before-wait-iphone-15.png') });
      failures.push(phone.name + ': no Waiting room button');
      await context.close();
      continue;
    }
    await btn.scrollIntoViewIfNeeded();
    await btn.tap();
    await page.waitForTimeout(100);
    const noted = await page.evaluate(() => {
      const api = window.GifOS && window.GifOS.meetWait;
      if (!api || typeof api.note !== 'function') return false;
      api.note('abc', 'Ruth');
      api.note('def', 'David');
      return true;
    });
    if (!noted) failures.push(phone.name + ': GifOS.meetWait.note missing');
    await page.waitForTimeout(80);
    const info = await page.evaluate(() => {
      const list = document.getElementById('waitlist');
      const bar = document.querySelector('.bar').getBoundingClientRect();
      const lb = list ? list.getBoundingClientRect() : null;
      const rows = list ? Array.from(list.querySelectorAll('.wait-row')).map((row) => {
        const admit = row.querySelector('.wait-admit');
        const no = row.querySelector('.wait-no');
        const ab = admit.getBoundingClientRect();
        const nb = no.getBoundingClientRect();
        return {
          name: (row.querySelector('.wait-name') || {}).textContent || '',
          aw: ab.width, ah: ab.height, nw: nb.width, nh: nb.height,
          gap: nb.left - ab.right,
          admitBg: getComputedStyle(admit).backgroundColor,
          noBg: getComputedStyle(no).backgroundColor,
        };
      }) : [];
      return {
        hidden: !list || list.hidden || (lb && lb.height < 2),
        top: lb ? lb.top : -1, bottom: lb ? lb.bottom : -1, left: lb ? lb.left : -1, right: lb ? lb.right : -1,
        dockTop: bar.top, vw: window.innerWidth, vh: window.innerHeight,
        holding: document.body.classList.contains('hold-door'),
        rows: rows,
      };
    });
    const bad = [];
    if (!info.holding) bad.push('waiting room did not turn on');
    if (info.hidden) bad.push('list hidden');
    if (info.top < -1) bad.push('list top ' + Math.round(info.top));
    if (info.bottom > info.dockTop + 1) bad.push('list runs into the dock (bottom ' + Math.round(info.bottom) + ', dock ' + Math.round(info.dockTop) + ')');
    if (info.bottom > info.vh + 1) bad.push('list below the screen');
    if (info.left < -1 || info.right > info.vw + 1) bad.push('list wider than the screen');
    const names = info.rows.map((r) => r.name);
    if (names.indexOf('Ruth') < 0 || names.indexOf('David') < 0) bad.push('names ' + names.join(','));
    for (const r of info.rows) {
      if (r.aw < 44 || r.ah < 44) bad.push(r.name + ' Admit is ' + Math.round(r.aw) + 'x' + Math.round(r.ah));
      if (r.nw < 44 || r.nh < 44) bad.push(r.name + ' Not now is ' + Math.round(r.nw) + 'x' + Math.round(r.nh));
      if (r.gap < 8) bad.push(r.name + ' button gap ' + Math.round(r.gap));
      if (r.admitBg === r.noBg) bad.push(r.name + ' Admit and Not now are the same color');
    }
    if (phone.name === 'iphone-15') await page.screenshot({ path: path.join(SHOTS, 'after-wait-iphone-15.png') });
    await page.evaluate(() => window.GifOS.meetWait.admit('abc'));
    const afterAdmit = await page.evaluate(() => Array.from(document.querySelectorAll('.wait-name')).map((n) => n.textContent));
    if (afterAdmit.indexOf('Ruth') >= 0) bad.push('Admit left Ruth on the list');
    if (afterAdmit.indexOf('David') < 0) bad.push('Admit also removed David');
    await page.evaluate(() => window.GifOS.meetWait.decline('def'));
    const gone = await page.evaluate(() => {
      const list = document.getElementById('waitlist');
      return !list || list.hidden || list.getBoundingClientRect().height < 2;
    });
    if (!gone) bad.push('Not now left the list up');
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    else console.log('PASS', phone.name);
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS wait list');
})().catch((e) => { console.error(e); process.exit(1); });
