/*
 * Nathan asks the room to pray for Ann. Ruth and David put a 🙏 on it.
 * The phone shows "🙏 2" and nothing else: no hover on a phone, so there
 * is no way to see who. A pastor wants the names; so does a manager who
 * asked for a 👍 to approve. Tapping the line shows who reacted, by name.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-react-who.js
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
  await page.goto(BASE + '/run.html#v=chat-react-who', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(150);
  // Ruth and David have each said something, the way their lines arrive.
  await page.evaluate(() => {
    const c = window.__gifosChat;
    const t = Date.now() - 60000;
    c.frame('qa-ruth', { k: 'chat', m: { id: 'qa-r1', by: 'Ruth', byId: 'qa-ruth', at: t, text: 'good morning all' } });
    c.frame('qa-david', { k: 'chat', m: { id: 'qa-d1', by: 'David', byId: 'qa-david', at: t + 1000, text: 'morning!' } });
  });
  await page.locator('#chat-in').fill('Please pray for Ann, surgery Thursday');
  await page.locator('#chat-in').press('Enter');
  await page.waitForTimeout(80);
  const mineId = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('#chatlog .cmsg[data-line]')).find((x) => (x.innerText || '').indexOf('pray for Ann') >= 0);
    return el ? el.getAttribute('data-line') : null;
  });
  const bad = [];
  if (!mineId) bad.push('your line did not post');
  else {
    await page.evaluate((id) => {
      const c = window.__gifosChat;
      c.frame('qa-ruth', { k: 'creact', id: id, e: '🙏', on: true, by: 'qa-ruth' });
      c.frame('qa-david', { k: 'creact', id: id, e: '🙏', on: true, by: 'qa-david' });
      c.frame('qa-david', { k: 'creact', id: id, e: '❤️', on: true, by: 'qa-david' });
    }, mineId);
    await page.waitForTimeout(40);
    await page.locator('#chatlog .cmsg', { hasText: 'pray for Ann' }).locator('.cbody').tap();
    await page.waitForTimeout(60);
    const info = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('#chatlog .cmsg[data-line]')).find((x) => (x.innerText || '').indexOf('pray for Ann') >= 0);
      if (!el) return null;
      const vh = window.innerHeight;
      // Text a person can read: visible, on screen, not only an aria-label.
      const seen = [];
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        const p = n.parentElement;
        const cs = getComputedStyle(p);
        const r = p.getBoundingClientRect();
        if (cs.display === 'none' || cs.visibility === 'hidden' || r.height < 2) continue;
        if (r.bottom <= 0 || r.top >= vh) continue;
        if (parseFloat(cs.fontSize) < 14) continue;
        seen.push(n.textContent);
      }
      const chip = el.querySelector('[data-react-chip="🙏"]');
      return {
        open: el.getAttribute('aria-expanded'),
        seen: seen.join(' ').replace(/\s+/g, ' '),
        label: chip ? chip.getAttribute('aria-label') : '',
      };
    });
    if (!info) bad.push('your line is gone');
    else {
      if (info.open !== 'true') bad.push('tapping the line did not open it');
      if (!/Ruth/.test(info.seen) || !/David/.test(info.seen)) bad.push('the open line does not say who reacted (reads "' + info.seen + '")');
      if (!/Ruth/.test(info.label) || !/David/.test(info.label)) bad.push('the 🙏 is read out as "' + info.label + '", no names');
    }
  }
  await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-chat-react-who-iphone-se.png') });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS chat react who');
})().catch((e) => { console.error(e); process.exit(1); });
