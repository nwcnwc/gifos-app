/*
 * Chat composer stays above the dock and above a soft keyboard.
 * A real tap on the field must land. Close and Send are at least 44px.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-above-dock.js
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
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Pat'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=chat-above-dock', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmcancel');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(200);
  const bad = [];
  const tapped = await page.locator('#chat-in').tap({ timeout: 4000 }).then(() => true, (e) => {
    bad.push('tap blocked: ' + String(e).split('\n').slice(0, 2).join(' '));
    return false;
  });
  const geo = await page.evaluate(() => {
    const input = document.getElementById('chat-in').getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const send = document.querySelector('#chatform button[type=submit]').getBoundingClientRect();
    const close = document.getElementById('chatclose').getBoundingClientRect();
    const attach = document.getElementById('cattach').getBoundingClientRect();
    return {
      inputBottom: input.bottom, inputTop: input.top, inputH: input.height,
      barTop: bar.top, vh: window.innerHeight,
      sendH: send.height, sendW: send.width,
      sendLeft: send.left, sendRight: send.right, vw: window.innerWidth,
      closeH: close.height, closeW: close.width,
      attachH: attach.height, attachW: attach.width,
      moreOpen: !document.querySelector('.bar').classList.contains('collapsed'),
    };
  });
  if (tapped && geo.inputBottom > geo.barTop + 1) bad.push('field bottom ' + Math.round(geo.inputBottom) + ' under dock top ' + Math.round(geo.barTop));
  if (geo.sendH < 44 || geo.sendW < 44) bad.push('send ' + Math.round(geo.sendW) + 'x' + Math.round(geo.sendH));
  if (geo.sendRight > geo.vw + 1 || geo.sendLeft < -1) bad.push('send off screen (right ' + Math.round(geo.sendRight) + ')');
  if (geo.closeH < 44 || geo.closeW < 44) bad.push('close ' + Math.round(geo.closeW) + 'x' + Math.round(geo.closeH));
  if (geo.attachH < 44 || geo.attachW < 44) bad.push('attach ' + Math.round(geo.attachW) + 'x' + Math.round(geo.attachH));
  if (geo.moreOpen) bad.push('More sheet still covers chat');
  await page.evaluate(() => document.documentElement.style.setProperty('--kb', '240px'));
  await page.waitForTimeout(50);
  const kb = await page.evaluate(() => {
    const input = document.getElementById('chat-in').getBoundingClientRect();
    return { bottom: input.bottom, top: input.top, vh: window.innerHeight };
  });
  if (kb.bottom > kb.vh - 240 + 2) bad.push('keyboard covers field (bottom ' + Math.round(kb.bottom) + ', keyboard line ' + (kb.vh - 240) + ')');
  if (kb.top < 0) bad.push('field pushed off the top');
  await page.screenshot({ path: path.join(SHOTS, 'after-chat-keyboard.png') });
  await browser.close();
  if (bad.length) {
    console.error('FAIL\n' + bad.join('\n'));
    process.exit(1);
  }
  console.log('PASS chat above dock', JSON.stringify(geo));
})().catch((e) => { console.error(e); process.exit(1); });
