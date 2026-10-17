/*
 * Nathan presents. He types "👍 if you can see my slides" and closes chat
 * to get the call back. Ruth and David put a 👍 on it. With chat closed
 * nothing on the call changes, so he can't tell anyone answered. A pastor
 * who posts a prayer request and closes chat has the same problem.
 * A reaction to your own line shows on the call, says who, and a tap
 * opens chat. It is not counted as a new message.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-react-closed.js
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
  await page.goto(BASE + '/run.html#v=chat-react-closed', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const c = window.__gifosChat;
    const t = Date.now() - 60000;
    c.frame('qa-ruth', { k: 'chat', m: { id: 'qa-r1', by: 'Ruth', byId: 'qa-ruth', at: t, text: 'ready when you are' } });
  });
  await page.locator('#chat-in').fill('👍 if you can see my slides');
  await page.locator('#chat-in').press('Enter');
  await page.waitForTimeout(80);
  const mineId = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('#chatlog .cmsg[data-line]')).find((x) => (x.innerText || '').indexOf('see my slides') >= 0);
    return el ? el.getAttribute('data-line') : null;
  });
  await page.locator('#chatclose').tap();
  await page.waitForTimeout(100);
  const bad = [];
  if (!mineId) bad.push('your line did not post');
  else {
    // A reaction to Ruth's own line is not yours to hear about.
    await page.evaluate(() => {
      window.__gifosChat.frame('qa-david', { k: 'creact', id: 'qa-r1', e: '👍', on: true, by: 'qa-david' });
    });
    await page.waitForTimeout(60);
    const quiet = await page.evaluate(() => !!document.getElementById('chatnote').hidden);
    if (!quiet) bad.push('a reaction to someone else\'s line shows on the call');
    await page.evaluate((id) => {
      const c = window.__gifosChat;
      c.frame('qa-ruth', { k: 'creact', id: id, e: '👍', on: true, by: 'qa-ruth' });
      c.frame('qa-david', { k: 'creact', id: id, e: '👍', on: true, by: 'qa-david' });
    }, mineId);
    await page.waitForTimeout(80);
    const info = await page.evaluate(() => {
      const note = document.getElementById('chatnote');
      const pv = document.getElementById('chatpreview');
      const badge = document.getElementById('chatbadge');
      const r = pv.getBoundingClientRect();
      const cs = getComputedStyle(note);
      return {
        shown: !note.hidden && cs.display !== 'none' && r.width > 8 && r.height > 8,
        text: (pv.innerText || '').replace(/\s+/g, ' ').trim(),
        label: pv.getAttribute('aria-label') || '',
        badge: badge.hidden ? '' : badge.textContent,
        chat: (document.getElementById('chatbtn').getAttribute('aria-label') || ''),
        h: r.height, top: r.top, bottom: r.bottom, vh: window.innerHeight,
      };
    });
    if (!info.shown) bad.push('nothing on the call says anyone reacted');
    else {
      if (!/Ruth/.test(info.text) || !/David/.test(info.text)) bad.push('the call does not say who reacted ("' + info.text + '")');
      if (info.text.indexOf('👍') < 0) bad.push('the call does not show the 👍');
      if (!/slides/.test(info.text)) bad.push('the call does not say which line ("' + info.text + '")');
      if (!/Ruth/.test(info.label) || !/react/i.test(info.label)) bad.push('the note is read out as "' + info.label + '"');
      if (info.h < 44) bad.push('the note is ' + Math.round(info.h) + 'px tall');
      if (info.top < 0 || info.bottom > info.vh) bad.push('the note is off screen');
    }
    if (info.badge) bad.push('a reaction counts as ' + info.badge + ' new message');
    if (/\(\d+\)/.test(info.chat)) bad.push('Chat reads "' + info.chat + '"');
    await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-chat-react-closed-iphone-se.png') });
    if (info.shown) {
      await page.locator('#chatpreview').tap();
      await page.waitForTimeout(100);
      const after = await page.evaluate(() => ({
        open: document.getElementById('chatpanel').classList.contains('open'),
        note: !!document.getElementById('chatnote').hidden,
      }));
      if (!after.open) bad.push('tapping the note did not open chat');
      await page.locator('#chatclose').tap();
      await page.waitForTimeout(80);
      const gone = await page.evaluate(() => !!document.getElementById('chatnote').hidden);
      if (!gone) bad.push('the note comes back after chat was read');
    }
  }
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS chat react closed');
})().catch((e) => { console.error(e); process.exit(1); });
