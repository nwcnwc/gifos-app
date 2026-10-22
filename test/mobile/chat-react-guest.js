/*
 * A guest joins the corporate all-hands from a link and never types a
 * name. People lists them as "Guest". They put a 👍 on Nathan's
 * "👍 if Tuesday works"; tapping the line reads "👍 Ruth, Someone".
 * The host can't match "Someone" to anybody in People.
 * A reactor with no name reads "Guest", the way People names them.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/chat-react-guest.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

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
  await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'chat-react-guest&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  // Ruth and a guest whose device sent no name are on the call.
  const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, names: ['Ruth', 'Guest seat'] }));
  const bad = [];
  if (!seeded || !seeded.ok) bad.push('could not seat Ruth and the guest: ' + JSON.stringify(seeded));
  const cleared = await page.evaluate(() => window.__gifosVideo.clearNameForTest && window.__gifosVideo.clearNameForTest('qa2'));
  if (!cleared) bad.push('could not clear the guest\'s name');
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(150);
  await page.locator('#chat-in').fill('👍 if Tuesday works');
  await page.locator('#chat-in').press('Enter');
  await page.waitForTimeout(80);
  const mineId = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('#chatlog .cmsg[data-line]')).find((x) => (x.innerText || '').indexOf('Tuesday works') >= 0);
    return el ? el.getAttribute('data-line') : null;
  });
  if (!mineId) bad.push('your line did not post');
  else {
    // Ruth (qa1) and the guest (qa2) react, from their own channels.
    await page.evaluate((id) => {
      const c = window.__gifosChat;
      c.frame('qa1', { k: 'creact', id: id, e: '👍', on: true, by: 'qa1' });
      c.frame('qa2', { k: 'creact', id: id, e: '👍', on: true, by: 'qa2' });
    }, mineId);
    await page.waitForTimeout(40);
    await page.locator('#chatlog .cmsg', { hasText: 'Tuesday works' }).locator('.cbody').tap();
    await page.waitForTimeout(60);
    const info = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('#chatlog .cmsg[data-line]')).find((x) => (x.innerText || '').indexOf('Tuesday works') >= 0);
      if (!el) return null;
      const w = el.querySelector('.cwhorx');
      const chip = el.querySelector('[data-react-chip="👍"]');
      return {
        open: el.getAttribute('aria-expanded'),
        who: w ? (w.innerText || '').replace(/\s+/g, ' ') : '',
        label: chip ? chip.getAttribute('aria-label') : '',
      };
    });
    if (!info) bad.push('your line is gone');
    else {
      if (info.open !== 'true') bad.push('tapping the line did not open it');
      if (!/Ruth/.test(info.who) || !/Guest/.test(info.who)) bad.push('the open line reads "' + info.who + '", not Ruth and Guest');
      if (/Someone/.test(info.who) || /Someone/.test(info.label)) bad.push('the guest shows as "Someone", not as People names them ("' + info.label + '")');
    }
  }
  await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-chat-react-guest-iphone-se.png') });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS chat react guest');
})().catch((e) => { console.error(e); process.exit(1); });
