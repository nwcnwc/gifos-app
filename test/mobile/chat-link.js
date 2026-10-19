/*
 * An open room has links off: an address stays plain text, for a peer and
 * for you. A javascript: address never becomes a link.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-link.js
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
  await page.goto(BASE + '/run.html#v=chat-link', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    window.__gifosChat.note({ by: 'Ruth', text: 'Meet us at https://example.com/park.' });
    window.__gifosChat.note({ by: 'David', text: 'Do not open javascript:alert(1)' });
  });
  await page.locator('#chat-in').fill('Map: https://example.com/lot');
  await page.locator('#chatform button[type=submit]').tap();
  await page.waitForTimeout(40);
  const info = await page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
        href: el.getAttribute('href') || '',
        h: b.height, w: b.width, top: b.top, bottom: b.bottom, left: b.left, right: b.right,
        hidden: cs.display === 'none' || b.height < 2,
        color: cs.color,
        deco: cs.textDecorationLine || cs.textDecoration,
        parent: cs.color ? getComputedStyle(el.parentElement).color : '',
      };
    };
    const ruth = Array.from(document.querySelectorAll('#chatlog .cmsg')).find((el) => (el.innerText || '').indexOf('example.com/park') >= 0);
    const mine = document.querySelector('#chatlog .cmsg.mine');
    const trap = Array.from(document.querySelectorAll('#chatlog .cmsg')).find((el) => (el.innerText || '').indexOf('javascript:') >= 0);
    const send = document.querySelector('#chatform button[type=submit]');
    const sb = send.getBoundingClientRect();
    return {
      ruth: box(ruth && ruth.querySelector('a')),
      ruthText: ruth ? (ruth.innerText || '').replace(/\s+/g, ' ').trim() : '',
      mine: box(mine && mine.querySelector('a.clink, a[href^="http"]')),
      trapHref: trap ? Array.from(trap.querySelectorAll('a')).map((a) => a.getAttribute('href')) : [],
      send: { top: sb.top, bottom: sb.bottom, left: sb.left, right: sb.right },
      vh: window.innerHeight,
      vw: window.innerWidth,
    };
  });
  const bad = [];
  if (info.ruthText.indexOf('example.com/park') < 0) bad.push('the address is missing ("' + info.ruthText + '")');
  if (info.ruth && !info.ruth.hidden) bad.push('an open room made the address a link');
  if (info.mine && !info.mine.hidden) bad.push('my address is a link in an open room');
  if (info.trapHref.length) bad.push('a javascript address became a link');
  const shot = bad.length ? 'before-chat-link-iphone-se.png' : 'after-chat-link-iphone-se.png';
  await page.screenshot({ path: path.join(SHOTS, shot) });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  console.log('PASS chat link');
})().catch((e) => { console.error(e); process.exit(1); });
