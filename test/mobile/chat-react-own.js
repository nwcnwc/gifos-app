/*
 * Nathan writes "👍 if Tuesday works for the vote". Ruth puts a 👍 on it.
 * Nathan wants his own 👍 on the count too, or a ❤️ to thank the room,
 * like any line in Zoom, Meet or Teams. His own line has Reply and
 * Delete but no React, so he can only tap a chip someone else made.
 * Your own line takes a reaction like anyone else's.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-react-own.js
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
  await page.goto(BASE + '/run.html#v=chat-react-own', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(150);
  await page.locator('#chat-in').fill('👍 if Tuesday works for the vote');
  await page.locator('#chat-in').press('Enter');
  await page.waitForTimeout(80);
  const bad = [];
  const mineId = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('#chatlog .cmsg[data-line]')).find((x) => (x.innerText || '').indexOf('Tuesday works') >= 0);
    return el ? el.getAttribute('data-line') : null;
  });
  const line = () => page.locator('#chatlog .cmsg', { hasText: 'Tuesday works' });
  const read = () => page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('#chatlog .cmsg[data-line]')).find((x) => (x.innerText || '').indexOf('Tuesday works') >= 0);
    if (!el) return null;
    const box = (b) => {
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { w: r.width, h: r.height, top: r.top, bottom: r.bottom, text: (b.innerText || '').replace(/\s+/g, ' ').trim(), pressed: b.getAttribute('aria-pressed') };
    };
    return {
      react: box(el.querySelector('.creact')),
      reply: box(el.querySelector('.creply')),
      del: box(el.querySelector('.cdel')),
      picks: Array.from(el.querySelectorAll('[data-react-pick]')).map(box),
      chips: Array.from(el.querySelectorAll('[data-react-chip]')).map((c) => Object.assign(box(c), {
        e: c.getAttribute('data-react-chip'), edge: getComputedStyle(c).borderTopColor, fill: getComputedStyle(c).backgroundColor,
      })),
      bg: getComputedStyle(el).backgroundColor,
      vh: window.innerHeight,
      alert: (document.getElementById('chatpeek') || {}).hidden === false,
    };
  });
  if (!mineId) bad.push('your line did not post');
  else {
    await page.evaluate((id) => window.__gifosChat.frame('qa-ruth', { k: 'creact', id: id, e: '👍', on: true, by: 'qa-ruth' }), mineId);
    await page.waitForTimeout(40);
    await line().locator('.cbody').tap();
    await page.waitForTimeout(60);
    const a = await read();
    if (!a.react) bad.push('your own line has no React (only ' + [a.reply && 'Reply', a.del && 'Delete'].filter(Boolean).join(', ') + ')');
    else {
      if (a.react.w < 44 || a.react.h < 44) bad.push('React is ' + Math.round(a.react.w) + 'x' + Math.round(a.react.h));
      if (!a.reply || !a.del) bad.push('React pushed out Reply or Delete');
      await line().locator('.creact').tap();
      await page.waitForTimeout(60);
      const b = await read();
      if (b.picks.length !== 5) bad.push('React opened ' + b.picks.length + ' picks, not 5');
      else if (b.picks.some((p) => p.bottom > b.vh + 1)) bad.push('a pick is below the screen');
      else {
        // Add yours to Ruth's 👍, then a ❤️ nobody picked yet.
        await line().locator('[data-react-pick="👍"]').tap();
        await page.waitForTimeout(60);
        await line().locator('.cbody').tap();
        await page.waitForTimeout(60);
        await line().locator('.creact').tap();
        await page.waitForTimeout(60);
        await line().locator('[data-react-pick="❤️"]').tap();
        await page.waitForTimeout(60);
        const c = await read();
        const up = c.chips.find((x) => x.e === '👍');
        const heart = c.chips.find((x) => x.e === '❤️');
        if (!up || !/2/.test(up.text) || up.pressed !== 'true') bad.push('👍 reads "' + (up ? up.text : '') + '" (pressed ' + (up ? up.pressed : '-') + '), not 2 with yours');
        if (!heart || !/1/.test(heart.text) || heart.pressed !== 'true') bad.push('your ❤️ is not on your line');
        // "Yours is outlined": the outline must not vanish into your blue bubble.
        if (up && (up.edge === c.bg || up.edge === up.fill)) bad.push('your 👍 outline (' + up.edge + ') is lost on your bubble (' + c.bg + ')');
      }
    }
  }
  await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-chat-react-own-iphone-se.png') });
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS chat react own');
})().catch((e) => { console.error(e); process.exit(1); });
