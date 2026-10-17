/*
 * A line you sent stays up. There is no way to take it back.
 * Zoom, Meet, and Teams let you delete your own message.
 * Someone else's line is not yours to remove.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-delete.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

function overlaps(a, b) {
  if (!a || !b || a.hidden || b.hidden) return false;
  return a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext(Object.assign({}, devices['iPhone SE'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=chat-delete', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__gifosChat.note({ by: 'Ruth', text: 'the vote is Tuesday' }));
  await page.locator('#chat-in').fill('I will be late');
  await page.locator('#chatform button[type=submit]').tap();
  await page.waitForTimeout(40);
  const read = () => page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
        h: b.height, w: b.width, top: b.top, bottom: b.bottom, left: b.left, right: b.right,
        hidden: cs.display === 'none' || b.height < 2,
      };
    };
    const mine = document.querySelector('#chatlog .cmsg.mine');
    const ruth = Array.from(document.querySelectorAll('#chatlog .cmsg')).find((el) => (el.innerText || '').indexOf('vote is Tuesday') >= 0 && !el.classList.contains('mine'));
    const send = document.querySelector('#chatform button[type=submit]');
    return {
      del: box(mine && mine.querySelector('.cdel, [data-own-del]')),
      ruthDel: !!(ruth && ruth.querySelector('.cdel, [data-own-del]')),
      mine: mine ? (mine.innerText || '').replace(/\s+/g, ' ').trim() : '',
      ruth: ruth ? (ruth.innerText || '').indexOf('vote is Tuesday') >= 0 : false,
      send: box(send),
      vh: window.innerHeight,
      vw: window.innerWidth,
    };
  });
  const info = await read();
  const bad = [];
  if (info.ruthDel) bad.push('Ruth\'s line can be deleted');
  const del = info.del;
  if (!del || del.hidden) bad.push('no way to take back your line');
  else {
    if (!/^delete$/i.test(del.text)) bad.push('the control says "' + del.text + '"');
    if (del.h < 44 || del.w < 44) bad.push('Delete is ' + Math.round(del.w) + 'x' + Math.round(del.h));
    if (del.top < -1 || del.bottom > info.vh + 1 || del.left < -1 || del.right > info.vw + 1) bad.push('Delete is off screen');
    if (overlaps(del, info.send)) bad.push('Delete covers Send');
  }
  if (bad.length && (!info.del || info.del.hidden)) {
    await page.screenshot({ path: path.join(SHOTS, 'before-chat-delete-iphone-se.png') });
  }
  if (!bad.length) {
    await page.locator('#chatlog .cmsg.mine .cdel').tap();
    await page.waitForTimeout(40);
    const after = await read();
    if (after.mine.indexOf('I will be late') >= 0) bad.push('the line stayed up');
    if (!after.ruth) bad.push('Ruth\'s line was removed too');
    if (!bad.length) await page.screenshot({ path: path.join(SHOTS, 'after-chat-delete-iphone-se.png') });
  }
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  console.log('PASS chat delete');
})().catch((e) => { console.error(e); process.exit(1); });
