/*
 * Find in chat steps aside while a sideways keyboard is up, so the field
 * and Send stay above the keys. If a search was on, the log stayed cut down
 * with nothing on screen saying so, and a line you sent then vanished
 * because it did not match. Something above the keys must say what the log
 * is showing, and your own line must show once it is sent.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-find-sign.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

function land(device) {
  const o = Object.assign({}, device);
  o.viewport = { width: device.viewport.height, height: device.viewport.width };
  return o;
}

const PHONES = [
  { name: 'iphone-se-land', device: land(devices['iPhone SE']), kb: 200 },
  { name: 'iphone-se', device: devices['iPhone SE'], kb: 240 },
];

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  for (const phone of PHONES) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Pat'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=chat-find-sign-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.locator('#bartoggle').tap();
    await page.locator('#chatbtn').tap();
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      for (let i = 1; i <= 12; i++) window.__gifosChat.note({ by: 'Ruth', text: 'Budget line ' + i + ' for the quarter.' });
      window.__gifosChat.note({ by: 'David', text: 'The vote is Tuesday.' });
    });
    await page.locator('#chatq').fill('Tuesday');
    // The Search key ends the search, the way it does in Messages and Mail.
    await page.locator('#chatq').press('Enter');
    await page.waitForTimeout(40);
    const searchDone = await page.evaluate(() => document.activeElement !== document.getElementById('chatq'));
    await page.evaluate((kb) => {
      const inner = window.innerHeight;
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        get: () => ({ height: inner - kb, offsetTop: 0, width: window.innerWidth }),
      });
      window.__gifosKb.sync();
    }, phone.kb);
    const tapped = await page.locator('#chat-in').tap({ timeout: 4000 }).then(() => true, () => false);
    await page.waitForTimeout(40);
    const line = await page.evaluate(() => window.innerHeight) - phone.kb;
    const sign = (keyLine) => page.evaluate((keyLine) => {
      const panel = document.getElementById('chatpanel');
      const log = document.getElementById('chatlog');
      const seen = [];
      for (const el of panel.querySelectorAll('*')) {
        if (log.contains(el)) continue;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (b.height < 2 || cs.visibility === 'hidden' || b.top < -1 || b.bottom > keyLine + 2) continue;
        let hidden = false;
        for (let p = el; p && p !== panel; p = p.parentElement) {
          if (getComputedStyle(p).display === 'none') { hidden = true; break; }
        }
        if (hidden) continue;
        const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ');
        seen.push(own + ' ' + (el.value || ''));
      }
      return seen.join(' ').replace(/\s+/g, ' ');
    }, keyLine);
    const bad = [];
    if (!searchDone) bad.push('Search key leaves the keyboard on Find');
    if (!tapped) bad.push('message field cannot be tapped');
    const before = await sign(line);
    if (before.toLowerCase().indexOf('tuesday') < 0) bad.push('nothing above the keys says the log only shows "Tuesday" (saw: ' + before.trim().slice(0, 80) + ')');
    const geo = await page.evaluate(() => {
      const b = document.getElementById('chat-in').getBoundingClientRect();
      const s = document.querySelector('#chatform button[type=submit]').getBoundingClientRect();
      const c = document.getElementById('chatclose').getBoundingClientRect();
      return { bottom: b.bottom, sendBottom: s.bottom, closeTop: c.top };
    });
    if (geo.bottom > line + 2 || geo.sendBottom > line + 2) bad.push('keyboard covers field (bottom ' + Math.round(geo.bottom) + ', line ' + line + ')');
    if (geo.closeTop < -1) bad.push('close is off the top');
    if (phone.name === 'iphone-se-land') {
      await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-chat-find-sign-land.png') });
    }
    await page.locator('#chat-in').fill('Running late, start without me.');
    await page.locator('#chat-in').press('Enter');
    await page.waitForTimeout(60);
    const lines = await page.evaluate(() => Array.from(document.querySelectorAll('#chatlog .cmsg')).map((el) => (el.innerText || '').replace(/\s+/g, ' ')));
    if (!lines.some((t) => t.indexOf('Running late') >= 0)) bad.push('the line you sent is not in the log');
    if (phone.name === 'iphone-se-land') {
      const after = await sign(line);
      if (after.toLowerCase().indexOf('tuesday') >= 0 && !lines.some((t) => t.indexOf('Budget line') >= 0)) bad.push('still filtered after sending');
    }
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS chat find sign');
})().catch((e) => { console.error(e); process.exit(1); });
