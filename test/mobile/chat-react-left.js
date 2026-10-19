/*
 * Nathan asks the room to pray for Ann. Grace puts a 🙏 on it and leaves
 * the call a minute later; she never wrote a line. When Nathan taps his
 * line after the service, it reads "🙏 Someone": the name went with her.
 * A pastor wants to thank Grace; a manager wants to know who approved.
 * The line keeps the name a reactor had when the reaction came in.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-react-left.js
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
  await page.goto(BASE + '/run.html#v=chat-react-left&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  // Ruth and Grace are on the call.
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, names: ['Ruth', 'Grace'] }));
  const bad = [];
  if (!seeded || !seeded.ok) bad.push('could not seat Ruth and Grace: ' + JSON.stringify(seeded));
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(150);
  await page.locator('#chat-in').fill('Please pray for Ann, surgery Thursday');
  await page.locator('#chat-in').press('Enter');
  await page.waitForTimeout(80);
  const mineId = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('#chatlog .cmsg[data-line]')).find((x) => (x.innerText || '').indexOf('pray for Ann') >= 0);
    return el ? el.getAttribute('data-line') : null;
  });
  if (!mineId) bad.push('your line did not post');
  else {
    // Ruth (qa1) and Grace (qa2) react, from their own channels.
    await page.evaluate((id) => {
      const c = window.__gifosChat;
      c.frame('qa1', { k: 'creact', id: id, e: '🙏', on: true, by: 'qa1' });
      c.frame('qa2', { k: 'creact', id: id, e: '🙏', on: true, by: 'qa2' });
    }, mineId);
    await page.waitForTimeout(40);
    // Grace leaves: the call now holds only Ruth.
    await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 1, names: ['Ruth'] }));
    await page.waitForTimeout(60);
    await page.locator('#chatlog .cmsg', { hasText: 'pray for Ann' }).locator('.cbody').tap();
    await page.waitForTimeout(60);
    const info = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('#chatlog .cmsg[data-line]')).find((x) => (x.innerText || '').indexOf('pray for Ann') >= 0);
      if (!el) return null;
      const w = el.querySelector('.cwhorx');
      const chip = el.querySelector('[data-react-chip="🙏"]');
      return {
        open: el.getAttribute('aria-expanded'),
        who: w ? (w.innerText || '').replace(/\s+/g, ' ') : '',
        label: chip ? chip.getAttribute('aria-label') : '',
      };
    });
    if (!info) bad.push('your line is gone');
    else {
      if (info.open !== 'true') bad.push('tapping the line did not open it');
      if (!/Ruth/.test(info.who) || !/Grace/.test(info.who)) bad.push('the open line reads "' + info.who + '", not Ruth and Grace');
      if (/Someone/.test(info.who) || /Someone/.test(info.label)) bad.push('Grace, who left, shows as "Someone" ("' + info.label + '")');
    }
  }
  await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-chat-react-left-iphone-se.png') });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS chat react left');
})().catch((e) => { console.error(e); process.exit(1); });
