/*
 * A long meeting chat has no way to find one line. Zoom, Meet, and Teams
 * put a search field on the chat. Typing a word leaves that line and hides
 * the rest. Clear brings the log back.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-find.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext(Object.assign({}, devices['iPhone SE'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=chat-find', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    for (let i = 1; i <= 12; i++) window.__gifosChat.note({ by: 'Ruth', text: 'Budget line ' + i + ' for the quarter.' });
    window.__gifosChat.note({ by: 'David', text: 'The vote is Tuesday.' });
  });
  await page.waitForTimeout(40);
  const read = () => page.evaluate(() => {
    const q = document.getElementById('chatq');
    const log = document.getElementById('chatlog');
    const send = document.querySelector('#chatform button[type=submit]');
    const sheet = document.getElementById('chatpanel');
    const box = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        top: b.top, bottom: b.bottom, left: b.left, right: b.right,
        w: b.width, h: b.height,
        text: (el.innerText || el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(),
        placeholder: el.getAttribute('placeholder') || '',
        label: el.getAttribute('aria-label') || '',
        bg: cs.backgroundColor,
        border: cs.borderTopWidth + ' ' + cs.borderTopColor,
        hidden: el.hidden || cs.display === 'none' || cs.visibility === 'hidden' || b.height < 2,
      };
    };
    const lines = Array.from(log ? log.querySelectorAll('.cmsg') : []).map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim());
    const empty = log ? log.querySelector('#chatnomatch, .cempty') : null;
    const clear = document.getElementById('chatqclear');
    const sheetBg = sheet ? getComputedStyle(sheet).backgroundColor : '';
    return {
      q: box(q),
      send: box(send),
      clear: box(clear),
      lines: lines,
      empty: empty ? (empty.innerText || '').replace(/\s+/g, ' ').trim() : '',
      sheetBg: sheetBg,
      vh: window.innerHeight,
      vw: window.innerWidth,
    };
  });
  const info = await read();
  const bad = [];
  const q = info.q;
  if (!q || q.hidden) bad.push('no way to find a line');
  else {
    const named = (q.placeholder + ' ' + q.label).toLowerCase();
    if (named.indexOf('find') < 0 && named.indexOf('search') < 0) bad.push('field says "' + (q.placeholder || q.label) + '"');
    if (q.h < 44) bad.push('find field is ' + Math.round(q.h) + 'px');
    if (q.top < -1 || q.bottom > info.vh + 1 || q.left < -1 || q.right > info.vw + 1) bad.push('find field is off screen');
    if (info.send && q.bottom > info.send.top + 1 && q.top < info.send.bottom - 1 && q.right > info.send.left + 1 && q.left < info.send.right - 1) {
      bad.push('find field covers Send');
    }
    if (info.sheetBg && q.bg === info.sheetBg && q.border.indexOf('0px') === 0) bad.push('find field has no edge');
  }
  if (!info.lines.some((t) => t.indexOf('vote is Tuesday') >= 0)) bad.push('Tuesday is not in the log');
  if (!info.lines.some((t) => t.indexOf('Budget line 1') >= 0)) bad.push('the other lines are missing');
  const shot = bad.length ? 'before-chat-find-iphone-se.png' : 'after-chat-find-iphone-se.png';
  if (bad.length) {
    await page.screenshot({ path: path.join(SHOTS, shot) });
    await context.close();
    await browser.close();
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  await page.locator('#chatq').fill('Tuesday');
  await page.waitForTimeout(40);
  const hit = await read();
  if (!hit.lines.some((t) => t.indexOf('vote is Tuesday') >= 0)) bad.push('Tuesday dropped out of the search');
  if (hit.lines.some((t) => t.indexOf('Budget line') >= 0)) bad.push('search still shows the other lines');
  if (!hit.clear || hit.clear.hidden) bad.push('no Clear');
  else if (hit.clear.h < 44 || hit.clear.w < 44) bad.push('Clear is ' + Math.round(hit.clear.w) + 'x' + Math.round(hit.clear.h));
  await page.screenshot({ path: path.join(SHOTS, 'after-chat-find-iphone-se.png') });
  if (!bad.length && hit.clear && !hit.clear.hidden) {
    await page.locator('#chatqclear').tap();
    await page.waitForTimeout(40);
    const back = await read();
    if (!back.lines.some((t) => t.indexOf('vote is Tuesday') >= 0) || !back.lines.some((t) => t.indexOf('Budget line 1') >= 0)) {
      bad.push('Clear did not bring the log back');
    }
    if (back.clear && !back.clear.hidden) bad.push('Clear stayed after the field was empty');
  }
  if (!bad.length) {
    await page.locator('#chatq').fill('zzzz-not-a-line');
    await page.waitForTimeout(40);
    const none = await read();
    if (none.lines.length) bad.push('a miss still lists lines');
    if (none.empty.toLowerCase().indexOf('no match') < 0) bad.push('a miss says "' + none.empty + '"');
  }
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS chat find');
})().catch((e) => { console.error(e); process.exit(1); });
