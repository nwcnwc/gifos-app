/*
 * A phone chat shows the conversation, not buttons. Every line carried its
 * own row of 44px Reply and React buttons, so a short line was ~170px tall
 * and an iPhone SE showed under two lines. Messages, WhatsApp and Meet keep
 * a line's actions behind a tap on that line.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-dense.js
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
  await page.goto(BASE + '/run.html#v=chat-dense', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.locator('#bartoggle').tap();
  await page.locator('#chatbtn').tap();
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    window.__gifosChat.note({ by: 'Ruth', text: 'Please pray for my mother' });
    window.__gifosChat.note({ by: 'David', text: 'Praying for her' });
    window.__gifosChat.note({ by: 'Esther', text: 'Amen' });
    window.__gifosChat.note({ by: 'Ruth', text: 'Thank you all' });
  });
  await page.waitForTimeout(150);
  const look = () => page.evaluate(() => {
    const log = document.getElementById('chatlog').getBoundingClientRect();
    const lines = Array.from(document.querySelectorAll('#chatlog .cmsg'));
    const shown = (el) => {
      if (!el) return false;
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 1 && b.height > 1;
    };
    const box = (el) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, w: b.width, h: b.height }; };
    return {
      log: { top: log.top, bottom: log.bottom },
      lines: lines.map((el) => Object.assign(box(el), {
        text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        whole: el.getBoundingClientRect().top >= log.top - 1 && el.getBoundingClientRect().bottom <= log.bottom + 1,
        reply: shown(el.querySelector('.creply')) ? box(el.querySelector('.creply')) : null,
        react: shown(el.querySelector('.creact')) ? box(el.querySelector('.creact')) : null,
      })),
      pending: !document.getElementById('chatreply').hidden,
    };
  });
  const bad = [];
  const a = await look();
  const whole = a.lines.filter((l) => l.whole).length;
  if (whole < 3) bad.push(whole + ' whole chat lines in view on an iPhone SE (want 3+); a line is ' + Math.round(a.lines[0] ? a.lines[0].h : 0) + 'px');
  const withButtons = a.lines.filter((l) => l.reply || l.react).length;
  if (withButtons) bad.push(withButtons + ' lines show Reply/React before anyone taps them');
  let b = null;
  if (!bad.length) {
    // Tap the words of David's line: its own Reply and React come up, 44px.
    await page.locator('#chatlog .cmsg', { hasText: 'Praying for her' }).locator('.cbody').tap();
    await page.waitForTimeout(100);
    b = await look();
    const david = b.lines.find((l) => l.text.indexOf('Praying for her') >= 0);
    if (!david || !david.reply || !david.react) bad.push('tapping a line does not show its Reply and React');
    else {
      if (david.reply.h < 44 || david.reply.w < 44) bad.push('Reply is ' + Math.round(david.reply.w) + 'x' + Math.round(david.reply.h));
      if (david.react.h < 44 || david.react.w < 44) bad.push('React is ' + Math.round(david.react.w) + 'x' + Math.round(david.react.h));
      if (david.reply.bottom > b.log.bottom + 1) bad.push('the tapped line\'s Reply is below the log');
    }
    const others = b.lines.filter((l) => l !== david && (l.reply || l.react)).length;
    if (others) bad.push(others + ' other lines show buttons too');
    if (!bad.length) {
      await page.locator('#chatlog .cmsg', { hasText: 'Praying for her' }).locator('.creply').tap();
      await page.waitForTimeout(100);
      const c = await look();
      if (!c.pending) bad.push('Reply on a tapped line does not start a reply');
      // A second tap on the words puts the buttons away again.
      await page.locator('#chatreply-x').tap().catch(() => {});
      await page.locator('#chatlog .cmsg', { hasText: 'Praying for her' }).locator('.cbody').tap();
      await page.waitForTimeout(100);
      const d = await look();
      if (d.lines.some((l) => l.reply || l.react)) bad.push('a second tap does not put the buttons away');
    }
  }
  if (bad.length) await page.screenshot({ path: path.join(SHOTS, 'before-chat-dense-iphone-se.png') });
  else {
    await page.locator('#chatlog .cmsg', { hasText: 'Praying for her' }).locator('.cbody').tap();
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(SHOTS, 'after-chat-dense-iphone-se.png') });
  }
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    console.error(JSON.stringify(b || a));
    process.exit(1);
  }
  console.log('PASS chat dense');
})().catch((e) => { console.error(e); process.exit(1); });
