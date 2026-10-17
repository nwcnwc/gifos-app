/*
 * An address in a chat line is ordinary text. The other person cannot
 * tap it. Zoom, Meet, Teams, and Messages turn http(s) addresses into links.
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
  const link = info.ruth;
  if (!link || link.hidden) bad.push('the address is not a link ("' + info.ruthText + '")');
  else {
    if (link.href !== 'https://example.com/park') bad.push('href is "' + link.href + '"');
    if (link.text.indexOf('example.com/park') < 0) bad.push('the link dropped the address');
    if (link.top < -1 || link.bottom > info.vh + 1 || link.left < -1 || link.right > info.vw + 1) bad.push('the link is off screen');
    if (link.bottom > info.send.top + 1 && link.top < info.send.bottom - 1 && link.right > info.send.left + 1 && link.left < info.send.right - 1) bad.push('the link covers Send');
    const marked = (link.deco || '').indexOf('underline') >= 0 || link.color !== link.parent;
    if (!marked) bad.push('the address looks like the rest of the line');
    const c = contrast(link.color, 'rgb(232, 236, 241)');
    if (c !== null && c < 4.5) bad.push('link contrast ' + c.toFixed(2));
  }
  if (info.trapHref.length) bad.push('a javascript address became a link');
  if (!bad.length) {
    const mine = info.mine;
    if (!mine || mine.hidden) bad.push('my address is not a link');
    else if (mine.href !== 'https://example.com/lot') bad.push('my href is "' + mine.href + '"');
    else if ((mine.deco || '').indexOf('underline') < 0 && mine.color === 'rgb(255, 255, 255)') bad.push('my link looks like the rest of the blue line');
  }
  if (bad.length && (!info.ruth || info.ruth.hidden)) await page.screenshot({ path: path.join(SHOTS, 'before-chat-link-iphone-se.png') });
  if (!bad.length) await page.screenshot({ path: path.join(SHOTS, 'after-chat-link-iphone-se.png') });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  console.log('PASS chat link');
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
