/*
 * An empty file list does not sit between the messages and the field.
 * Zoom, Meet, and Teams keep that strip for a file that is actually
 * pinned. The paperclip stays. A pinned file brings the list back.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-files.js
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
  await page.goto(BASE + '/run.html#v=chat-files', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    window.__gifosChat.note({ by: 'Ruth', text: 'The deck is in the thread.' });
    window.__gifosChat.note({ by: 'David', text: 'I will walk the numbers.' });
  });
  await page.waitForTimeout(80);
  const empty = await page.evaluate(() => {
    const box = document.getElementById('cfiles');
    const log = document.getElementById('chatlog').getBoundingClientRect();
    const form = document.getElementById('chatform').getBoundingClientRect();
    const cs = getComputedStyle(box);
    const r = box.getBoundingClientRect();
    return {
      text: (box.innerText || '').replace(/\s+/g, ' ').trim(),
      shown: cs.display !== 'none' && cs.visibility !== 'hidden' && r.height > 2,
      gap: Math.round(form.top - log.bottom),
      logH: Math.round(log.height),
    };
  });
  const bad = [];
  if (empty.shown) bad.push('empty files tray is showing ("' + empty.text.slice(0, 80) + '")');
  if (/No files yet|Files pinned/i.test(empty.text) && empty.shown) bad.push('empty copy is on screen');
  if (!empty.shown && empty.gap > 24) bad.push('log stops ' + empty.gap + 'px above the field');
  const shot = bad.length ? 'before-chat-files-iphone-se.png' : 'after-chat-files-iphone-se.png';
  await page.screenshot({ path: path.join(SHOTS, shot) });
  let pinned = null;
  if (!bad.length) {
    pinned = await page.evaluate(() => {
      if (!window.__gifosChat.pin) return { err: 'no pin' };
      window.__gifosChat.pin({ name: 'agenda.pdf', by: 'Ruth', locked: true });
      const box = document.getElementById('cfiles');
      const cs = getComputedStyle(box);
      const r = box.getBoundingClientRect();
      return {
        text: (box.innerText || '').replace(/\s+/g, ' ').trim(),
        shown: cs.display !== 'none' && r.height > 2,
      };
    });
    if (pinned.err) bad.push(pinned.err);
    else if (!pinned.shown) bad.push('a pinned file did not bring the list back');
    else if (pinned.text.indexOf('agenda.pdf') < 0) bad.push('list does not name agenda.pdf ("' + pinned.text + '")');
    if (bad.length) fs.unlinkSync(path.join(SHOTS, shot));
  }
  await context.close();
  await browser.close();
  const info = { empty: empty, pinned: pinned };
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  console.log('PASS chat files log ' + empty.logH + 'px');
})().catch((e) => { console.error(e); process.exit(1); });
