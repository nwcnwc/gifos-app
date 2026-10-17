/*
 * More on a phone was a wall of equal buttons over the faces. The first
 * screen is the four the sheet already leads with. The rest scroll.
 * Invite is the one blue action.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/more-calm.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const FIRST = ['invite', 'pwbtn', 'recbtn', 'chatbtn'];
const LATER = ['stagebtn', 'votebtn', 'appbtn', 'helpbtn'];

const PHONES = [
  { name: 'iphone-15', device: devices['iPhone 15'] },
  { name: 'iphone-se', device: devices['iPhone SE'] },
];

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
  for (const phone of PHONES) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Host'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=more-calm-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
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
          bg: cs.backgroundColor, color: cs.color,
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
    }, FIRST.concat(LATER));
    const bad = [];
    const full = info.buttons.filter((b) => b.full);
    if (full.length !== 4) bad.push(full.length + ' buttons on the first screen (' + full.map((b) => b.text).join(', ') + ')');
    for (const id of FIRST) {
      const b = info.want.find((x) => x.id === id);
      if (!b || !b.full) bad.push(id + ' is not on the first screen');
      else if (b.h < 44 || b.w < 44) bad.push(id + ' is ' + Math.round(b.w) + 'x' + Math.round(b.h));
    }
    for (const id of LATER) {
      const b = info.want.find((x) => x.id === id);
      if (b && b.full) bad.push(id + ' is on the first screen');
    }
    const invite = info.want.find((b) => b.id === 'invite');
    const pw = info.want.find((b) => b.id === 'pwbtn');
    if (invite && pw && invite.bg === pw.bg) bad.push('Invite looks the same as Room password');
    if (invite && invite.bg !== 'rgb(0, 100, 200)') bad.push('Invite is not the blue action (' + (invite && invite.bg) + ')');
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
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS more calm');
})().catch((e) => { console.error(e); process.exit(1); });
