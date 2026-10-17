/*
 * LIVE is the Broadcast skin. A regular meeting does not show it.
 * Record and Captions stay on the call.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/live-meet.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const AV = '0123456789abcdef';

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext(Object.assign({}, devices['iPhone SE'], { hasTouch: true }));
  await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=live-meet', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.waitForTimeout(250);
  const meet = await page.evaluate(() => {
    const live = document.getElementById('call-live');
    const cs = getComputedStyle(live);
    const r = live.getBoundingClientRect();
    const rec = document.getElementById('call-rec').getBoundingClientRect();
    const cc = document.getElementById('call-cc').getBoundingClientRect();
    return {
      broadcast: document.body.classList.contains('broadcast'),
      display: cs.display,
      h: r.height,
      recH: rec.height,
      ccH: cc.height,
      recText: (document.getElementById('call-rec').innerText || '').trim(),
      ccText: (document.getElementById('call-cc').innerText || '').trim(),
    };
  });
  const bad = [];
  if (meet.broadcast) bad.push('a regular room opened as Broadcast');
  if (meet.display !== 'none' || meet.h > 1) bad.push('LIVE is on a regular meeting (' + meet.display + ', ' + Math.round(meet.h) + 'px)');
  if (meet.recH < 44 || meet.ccH < 44) bad.push('Record or Captions left the call');
  if (meet.recText !== 'Record' || meet.ccText !== 'Captions') bad.push('labels ' + meet.recText + ' / ' + meet.ccText);
  const shot = bad.length ? 'before-live-meet-iphone-se.png' : 'after-live-meet-iphone-se.png';
  await page.screenshot({ path: path.join(SHOTS, shot) });
  await page.goto(BASE + '/run.html?cast=1#bc=1&v=' + AV + '&av=' + AV, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(300);
  const cast = await page.evaluate(() => {
    const live = document.getElementById('call-live');
    return {
      broadcast: document.body.classList.contains('broadcast'),
      display: getComputedStyle(live).display,
      text: (live.innerText || '').trim(),
    };
  });
  if (!cast.broadcast) bad.push('Broadcast did not open');
  if (cast.display === 'none') bad.push('Broadcast hides LIVE');
  if (cast.text !== 'Live') bad.push('Broadcast LIVE says "' + cast.text + '"');
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify({ meet: meet, cast: cast }));
    process.exit(1);
  }
  console.log('PASS live is broadcast only');
})().catch((e) => { console.error(e); process.exit(1); });
