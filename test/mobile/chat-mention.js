/*
 * Typing @ in chat does not offer the people on the call, and a sent
 * mention looks like the rest of the line. Zoom, Meet, and Teams offer
 * the name and then mark it.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-mention.js
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
  await page.goto(BASE + '/run.html#v=chat-mention', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.evaluate(() => window.__gifosVideo.presentPeers([
    { id: 'peer-ruth', name: 'Ruth' },
    { id: 'peer-david', name: 'David' },
  ]));
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(150);
  await page.locator('#chat-in').tap();
  await page.locator('#chat-in').fill('@Ru');
  await page.waitForTimeout(40);
  const info = await page.evaluate(() => {
    const box = document.getElementById('chatmentions');
    const buttons = box ? Array.from(box.querySelectorAll('button')).map((el) => {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
        h: b.height,
        w: b.width,
        top: b.top,
        bottom: b.bottom,
        left: b.left,
        right: b.right,
        shown: !el.hidden && cs.display !== 'none' && b.height > 2,
      };
    }) : [];
    const shown = !!(box && !box.hidden && getComputedStyle(box).display !== 'none');
    const send = document.querySelector('#chatform button[type=submit]').getBoundingClientRect();
    return { missing: !box, shown: shown, buttons: buttons, vh: window.innerHeight, vw: window.innerWidth, sendTop: send.top };
  });
  const bad = [];
  const ruth = info.buttons.find((b) => b.text === 'Ruth' && b.shown);
  if (info.missing || !info.shown || !ruth) bad.push('no one to mention');
  else {
    if (ruth.h < 44 || ruth.w < 44) bad.push('Ruth is ' + Math.round(ruth.w) + 'x' + Math.round(ruth.h));
    if (ruth.top < -1 || ruth.bottom > info.vh + 1 || ruth.left < -1 || ruth.right > info.vw + 1) bad.push('Ruth is off screen');
    if (ruth.bottom > info.sendTop + 1) bad.push('the name covers Send');
  }
  if (info.buttons.some((b) => b.shown && b.text === 'David')) bad.push('David is offered for @Ru');
  const shot = bad.length ? 'before-chat-mention-iphone-se.png' : 'after-chat-mention-iphone-se.png';
  if (bad.length) {
    await page.screenshot({ path: path.join(SHOTS, shot) });
    await context.close();
    await browser.close();
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  await page.locator('#chatmentions button', { hasText: 'Ruth' }).tap();
  await page.waitForTimeout(40);
  const typed = await page.locator('#chat-in').inputValue();
  if (typed !== '@Ruth ') bad.push('field is "' + typed + '"');
  const closed = await page.evaluate(() => {
    const box = document.getElementById('chatmentions');
    return !box || box.hidden || getComputedStyle(box).display === 'none';
  });
  if (!closed) bad.push('the list stayed open');
  await page.locator('#chatform button[type=submit]').tap();
  await page.waitForTimeout(40);
  const mark = await page.evaluate(() => {
    const el = document.querySelector('#chatlog .cmention');
    if (!el) return { missing: true };
    const cs = getComputedStyle(el);
    const parent = getComputedStyle(el.parentElement);
    const b = el.getBoundingClientRect();
    return {
      missing: false,
      text: (el.textContent || '').trim(),
      color: cs.color,
      parent: parent.color,
      h: b.height,
    };
  });
  await page.screenshot({ path: path.join(SHOTS, 'after-chat-mention-iphone-se.png') });
  if (mark.missing) bad.push('the sent line does not mark Ruth');
  else {
    if (mark.text !== '@Ruth') bad.push('mark says "' + mark.text + '"');
    if (mark.color === mark.parent) bad.push('the mention is the same color as the line');
  }
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS chat mention');
})().catch((e) => { console.error(e); process.exit(1); });
