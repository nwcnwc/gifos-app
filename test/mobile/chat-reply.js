/*
 * Answering one chat line still starts a new message at the bottom.
 * The answer has to stay with the line it answers. Zoom and Teams
 * quote that line. Meet keeps the thread on the message.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-reply.js
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
  await page.goto(BASE + '/run.html#v=chat-reply', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__gifosChat.note({ by: 'Ruth', text: 'the vote is Tuesday' }));
  await page.waitForTimeout(40);
  const read = () => page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        text: (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(),
        h: b.height, w: b.width, top: b.top, bottom: b.bottom, left: b.left, right: b.right,
        hidden: el.hidden || cs.display === 'none' || cs.visibility === 'hidden' || b.height < 2,
        bg: cs.backgroundColor,
        border: parseFloat(cs.borderLeftWidth) || 0,
      };
    };
    const send = document.querySelector('#chatform button[type=submit]');
    const ruth = Array.from(document.querySelectorAll('#chatlog .cmsg')).find((el) => (el.innerText || '').indexOf('vote is Tuesday') >= 0 && !el.classList.contains('mine'));
    const reply = ruth ? ruth.querySelector('.creply, [data-reply]') : document.querySelector('#chatlog .creply, #chatlog [data-reply]');
    const bar = document.getElementById('chatreply');
    const cancel = document.getElementById('chatreply-x');
    const mine = document.querySelector('#chatlog .cmsg.mine');
    const quote = mine ? mine.querySelector('.cquote') : null;
    return {
      reply: box(reply),
      bar: box(bar),
      cancel: box(cancel),
      send: box(send),
      quote: box(quote),
      mine: mine ? (mine.innerText || '').replace(/\s+/g, ' ').trim() : '',
      vh: window.innerHeight,
      vw: window.innerWidth,
    };
  });
  const info = await read();
  const bad = [];
  const onScreen = (el, name) => {
    if (!el || el.hidden) bad.push('no ' + name);
    else {
      if (el.h < 44 || el.w < 44) bad.push(name + ' is ' + Math.round(el.w) + 'x' + Math.round(el.h));
      if (el.top < -1 || el.bottom > info.vh + 1 || el.left < -1 || el.right > info.vw + 1) bad.push(name + ' is off screen');
      if (overlaps(el, info.send)) bad.push(name + ' covers Send');
    }
  };
  onScreen(info.reply, 'Reply');
  if (info.reply && !/^reply$/i.test(info.reply.text)) bad.push('the control says "' + info.reply.text + '"');
  const shot = bad.length ? 'before-chat-reply-iphone-se.png' : 'after-chat-reply-iphone-se.png';
  if (bad.length) {
    await page.screenshot({ path: path.join(SHOTS, shot) });
    await context.close();
    await browser.close();
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  await page.locator('#chatlog .creply').first().tap();
  await page.waitForTimeout(40);
  const quoting = await read();
  if (!quoting.bar || quoting.bar.hidden) bad.push('Reply did not keep Ruth\'s line');
  else {
    if (quoting.bar.text.indexOf('Ruth') < 0 || quoting.bar.text.indexOf('Tuesday') < 0) bad.push('the quote dropped the line ("' + quoting.bar.text + '")');
    onScreen(quoting.cancel, 'Cancel');
  }
  if (!bad.length) {
    await page.locator('#chat-in').fill("I'll be there");
    await page.locator('#chatform button[type=submit]').tap();
    await page.waitForTimeout(40);
    const sent = await read();
    if (!sent.mine || sent.mine.indexOf("I'll be there") < 0) bad.push('the answer was not sent');
    if (!sent.quote || sent.quote.hidden) bad.push('the answer is a new message with no quote');
    else {
      if (sent.quote.text.indexOf('Ruth') < 0 || sent.quote.text.indexOf('Tuesday') < 0) bad.push('the quote lost Ruth\'s line ("' + sent.quote.text + '")');
      if (sent.quote.border < 3) bad.push('the quote has no edge');
    }
    if (sent.bar && !sent.bar.hidden) bad.push('the quote stayed in the composer after send');
  }
  if (!bad.length) await page.screenshot({ path: path.join(SHOTS, shot) });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS chat reply');
})().catch((e) => { console.error(e); process.exit(1); });
