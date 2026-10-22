/*
 * Ruth says "the vote is Tuesday". The only answers are Reply or a whole
 * new line. Zoom, Meet, and Teams let you put a 🙏 or 👍 on a line.
 * A reaction shows on the line with a count. Tap it again to take it off.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-react.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

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
  await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'chat-react', { waitUntil: 'domcontentloaded', timeout: 20000 });
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
        text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
        pressed: el.getAttribute('aria-pressed'),
        h: b.height, w: b.width, top: b.top, bottom: b.bottom, left: b.left, right: b.right,
        hidden: cs.display === 'none' || b.height < 2,
      };
    };
    const ruth = Array.from(document.querySelectorAll('#chatlog .cmsg')).find((el) => (el.innerText || '').indexOf('vote is Tuesday') >= 0);
    const q = (sel) => (ruth ? Array.from(ruth.querySelectorAll(sel)) : []);
    return {
      react: box(q('.creact')[0]),
      picks: q('[data-react-pick]').map(box),
      chips: q('[data-react-chip]').map(box),
      send: box(document.querySelector('#chatform button[type=submit]')),
      vh: window.innerHeight,
      vw: window.innerWidth,
    };
  });
  const onScreen = (b, info) => b.top >= -1 && b.bottom <= info.vh + 1 && b.left >= -1 && b.right <= info.vw + 1;
  // A line's buttons show once you tap the line (chat-dense).
  await page.locator('#chatlog .cmsg', { hasText: 'vote is Tuesday' }).locator('.cbody').tap();
  await page.waitForTimeout(40);
  const info = await read();
  const bad = [];
  const r = info.react;
  if (!r || r.hidden) bad.push('no way to react to a line');
  else {
    if (!/^react$/i.test(r.text)) bad.push('the control says "' + r.text + '"');
    if (r.h < 44 || r.w < 44) bad.push('React is ' + Math.round(r.w) + 'x' + Math.round(r.h));
    if (!onScreen(r, info)) bad.push('React is off screen');
    if (overlaps(r, info.send)) bad.push('React covers Send');
  }
  if (bad.length) {
    await page.screenshot({ path: path.join(SHOTS, 'before-chat-react-iphone-se.png') });
  } else {
    await page.locator('#chatlog .cmsg .creact').first().tap();
    await page.waitForTimeout(40);
    const open = await read();
    if (open.picks.length < 4) bad.push('only ' + open.picks.length + ' reactions to pick from');
    if (!open.picks.some((p) => p.text === '🙏')) bad.push('no 🙏 to pick');
    open.picks.forEach((p) => {
      if (p.h < 44 || p.w < 44) bad.push(p.text + ' is ' + Math.round(p.w) + 'x' + Math.round(p.h));
      if (!onScreen(p, open)) bad.push(p.text + ' is off screen');
      if (overlaps(p, open.send)) bad.push(p.text + ' covers Send');
    });
    if (!bad.length) {
      await page.locator('#chatlog [data-react-pick="🙏"]').first().tap();
      await page.waitForTimeout(40);
      const one = await read();
      const chip = one.chips.find((c) => c.text.indexOf('🙏') >= 0);
      if (!chip) bad.push('the 🙏 did not stay on the line');
      else {
        if (!/1/.test(chip.text)) bad.push('the 🙏 says "' + chip.text + '"');
        if (chip.pressed !== 'true') bad.push('your 🙏 is not marked as yours');
        if (chip.h < 44 || chip.w < 44) bad.push('the 🙏 is ' + Math.round(chip.w) + 'x' + Math.round(chip.h));
      }
      if (one.picks.length) bad.push('the picker stayed open');
      // David reacts too, the way his frame would arrive.
      await page.evaluate(() => window.__gifosChat.react({ text: 'vote is Tuesday', e: '🙏', byId: 'qa-david' }));
      await page.waitForTimeout(40);
      const two = await read();
      const chip2 = two.chips.find((c) => c.text.indexOf('🙏') >= 0);
      if (!chip2 || !/2/.test(chip2.text)) bad.push('David\'s 🙏 did not count (' + (chip2 ? chip2.text : 'none') + ')');
      if (!bad.length) await page.screenshot({ path: path.join(SHOTS, 'after-chat-react-iphone-se.png') });
      await page.locator('#chatlog [data-react-chip="🙏"]').first().tap();
      await page.waitForTimeout(40);
      const back = await read();
      const chip3 = back.chips.find((c) => c.text.indexOf('🙏') >= 0);
      if (!chip3 || !/1/.test(chip3.text) || chip3.pressed === 'true') bad.push('tapping your 🙏 did not take it off (' + (chip3 ? chip3.text + ' ' + chip3.pressed : 'none') + ')');
      // Over the wire: Ruth's own 👍 lands, a 👍 she claims for Esther does not,
      // and a newcomer's 'hi' replays only that person's picks.
      const wire = await page.evaluate(() => {
        const c = window.__gifosChat;
        const line = Array.from(document.querySelectorAll('#chatlog .cmsg[data-line]'))[0];
        const id = line && line.getAttribute('data-line');
        c.frame('qa-ruth', { k: 'creact', id: id, e: '👍', on: true, by: 'qa-ruth' });
        c.frame('qa-ruth', { k: 'creact', id: id, e: '👏', on: true, by: 'qa-esther' });
        c.frame('qa-ann', { k: 'hi', reacts: { [id]: ['❤️', 'nope'] } });
        const chips = () => Array.from(document.querySelectorAll('#chatlog [data-react-chip]')).map((el) => (el.innerText || '').replace(/\s+/g, ''));
        const got = chips();
        c.frame('qa-ruth', { k: 'creact', id: id, e: '👍', on: false, by: 'qa-ruth' });
        return { got: got, off: chips() };
      });
      if (wire.got.indexOf('👍1') < 0) bad.push('Ruth\'s 👍 frame did not land (' + wire.got.join(' ') + ')');
      if (wire.got.some((t) => t.indexOf('👏') >= 0)) bad.push('a 👏 claimed for someone else landed');
      if (wire.got.indexOf('❤️1') < 0) bad.push('a newcomer\'s ❤️ from hi did not land (' + wire.got.join(' ') + ')');
      if (wire.off.some((t) => t.indexOf('👍') >= 0)) bad.push('Ruth could not take her 👍 off');
      // A stray emoji is not a reaction.
      await page.evaluate(() => window.__gifosChat.react({ text: 'vote is Tuesday', e: '<b>x</b>', byId: 'qa-david' }));
      const stray = await read();
      if (stray.chips.length !== 2) bad.push('a stray reaction landed');
    }
  }
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(info));
    process.exit(1);
  }
  console.log('PASS chat react');
})().catch((e) => { console.error(e); process.exit(1); });
