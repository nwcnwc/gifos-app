/*
 * On a phone, someone else's line is a bubble you can see. The sheet
 * and that bubble were the same gray, so the line sat on the page with
 * no edge. Zoom, Meet, Teams, and FaceTime keep a white sheet and a
 * gray bubble. Mine stays blue.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-sheet.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

const PHONES = [
  { name: 'iphone-se', device: devices['iPhone SE'] },
  { name: 'iphone-15-land', device: Object.assign({}, devices['iPhone 15'], {
    viewport: { width: 852, height: 393 },
  }) },
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
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=chat-sheet-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.locator('#bartoggle').tap();
    await page.locator('#chatbtn').tap();
    await page.waitForTimeout(150);
    await page.locator('#chat-in').fill('Sending the notes.');
    await page.locator('#chatform button[type=submit]').tap();
    await page.evaluate(() => {
      window.__gifosChat.note({ by: 'Ruth', text: 'The deck is in the thread.' });
    });
    await page.waitForTimeout(80);
    const info = await page.evaluate(() => {
      const panel = document.getElementById('chatpanel');
      const title = document.getElementById('paneltitle');
      const field = document.getElementById('chat-in');
      const close = document.getElementById('chatclose');
      const ruth = Array.from(document.querySelectorAll('#chatlog .cmsg:not(.mine)'))
        .find((el) => (el.innerText || '').indexOf('deck is in the thread') >= 0);
      const mine = document.querySelector('#chatlog .cmsg.mine');
      const cs = (el) => getComputedStyle(el);
      const box = (el) => el.getBoundingClientRect();
      return {
        panel: cs(panel).backgroundColor,
        title: cs(title).color,
        field: cs(field).color,
        fieldBg: cs(field).backgroundColor,
        fieldFont: parseFloat(cs(field).fontSize),
        closeH: box(close).height,
        ruthBg: ruth ? cs(ruth).backgroundColor : '',
        ruthFg: ruth ? cs(ruth).color : '',
        mineBg: mine ? cs(mine).backgroundColor : '',
        mineFg: mine ? cs(mine).color : '',
      };
    });
    const bad = [];
    const panelL = lum(info.panel);
    const fieldL = lum(info.fieldBg);
    if (panelL === null || panelL < 0.95) bad.push('sheet is not white (' + info.panel + ')');
    if (!info.ruthBg) bad.push('Ruth has no bubble');
    else if (info.ruthBg === info.panel) bad.push("Ruth's bubble matches the sheet (" + info.panel + ')');
    if (fieldL === null || fieldL < 0.8) bad.push('field is dark (' + info.fieldBg + ')');
    const titleC = contrast(info.title, info.panel);
    const fieldC = contrast(info.field, info.fieldBg);
    const ruthC = contrast(info.ruthFg, info.ruthBg);
    const mineC = contrast(info.mineFg, info.mineBg);
    if (titleC === null || titleC < 4.5) bad.push('title contrast ' + (titleC === null ? 'n/a' : titleC.toFixed(2)));
    if (fieldC === null || fieldC < 4.5) bad.push('field contrast ' + (fieldC === null ? 'n/a' : fieldC.toFixed(2)));
    if (ruthC === null || ruthC < 4.5) bad.push('Ruth contrast ' + (ruthC === null ? 'n/a' : ruthC.toFixed(2)));
    if (mineC === null || mineC < 4.5) bad.push('my contrast ' + (mineC === null ? 'n/a' : mineC.toFixed(2)));
    if (info.fieldFont < 16) bad.push('field is ' + info.fieldFont + 'px');
    if (info.closeH < 44) bad.push('Close is ' + Math.round(info.closeH) + 'px');
    if (phone.name === 'iphone-se') {
      const shot = bad.length ? 'before-chat-sheet-iphone-se.png' : 'after-chat-sheet-iphone-se.png';
      await page.screenshot({ path: path.join(SHOTS, shot) });
    }
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL ' + failures.join(' | '));
    process.exit(1);
  }
  console.log('PASS chat sheet');
})().catch((e) => { console.error(e); process.exit(1); });

function lum(c) {
  const m = String(c || '').match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  if (m[4] !== undefined && +m[4] === 0) return null;
  const lin = [m[1], m[2], m[3]].map((v) => {
    const s = +v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function contrast(a, b) {
  const L1 = lum(a), L2 = lum(b);
  if (L1 === null || L2 === null) return null;
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}
