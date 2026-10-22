/*
 * The composer has an emoji control. A tap inserts the character
 * into the field and does not send the line. Targets are at least 44px.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-emoji.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
// A room of its own per run: these pages use the public relay, where a fixed
// room seats any copy of this test running at the same time as a stranger.
const RUN_ROOM = Math.random().toString(36).slice(2, 6).padEnd(4, '0');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');

function phone360() {
  return {
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['Pixel 7'].userAgent,
  };
}

const PHONES = [
  { name: 'iphone-15', device: devices['iPhone 15'], scale: null },
  { name: 'iphone-se', device: devices['iPhone SE'], scale: null },
  { name: 'android-360-200', device: phone360(), scale: '2' },
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
    await context.addInitScript((scale) => {
      try {
        localStorage.setItem('gifos_name', 'Pat');
        if (scale) localStorage.setItem('gifos_ui_scale', scale);
      } catch (e) {}
    }, phone.scale);
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=' + RUN_ROOM + 'chat-emoji-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#bartoggle', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.locator('#bartoggle').tap();
    await page.locator('#chatbtn').tap();
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => document.querySelectorAll('#chatlog .cmsg').length);
    const opener = page.locator('#cemoji');
    const bad = [];
    if (!(await opener.count())) bad.push('no emoji control');
    else {
      const openBox = await opener.evaluate((el) => {
        const b = el.getBoundingClientRect();
        return { w: b.width, h: b.height, top: b.top, bottom: b.bottom, left: b.left, right: b.right };
      });
      if (openBox.h < 44 || openBox.w < 44) bad.push('emoji button is ' + Math.round(openBox.w) + 'x' + Math.round(openBox.h));
      await opener.tap();
      await page.waitForTimeout(50);
      const row = await page.evaluate(() => {
        const el = document.getElementById('emojirow');
        if (!el) return { missing: true };
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const buttons = Array.from(el.querySelectorAll('button')).map((btn) => {
          const r = btn.getBoundingClientRect();
          const s = getComputedStyle(btn);
          return {
            emoji: btn.getAttribute('data-emoji') || '',
            w: r.width, h: r.height,
            clipped: btn.scrollWidth > btn.clientWidth + 2 || btn.scrollHeight > btn.clientHeight + 2,
            font: parseFloat(s.fontSize),
          };
        });
        const dock = document.querySelector('.bar').getBoundingClientRect().top;
        return {
          missing: false,
          hidden: el.hidden || cs.display === 'none',
          top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          dock: dock, vh: window.innerHeight, vw: window.innerWidth,
          buttons: buttons,
        };
      });
      if (row.missing) bad.push('no emoji row');
      else if (row.hidden) bad.push('emoji row stayed hidden');
      else {
        if (row.bottom > row.dock + 1) bad.push('emoji row runs into the dock');
        if (row.top < -1 || row.left < -1 || row.right > row.vw + 1) bad.push('emoji row off screen');
        const thumbs = row.buttons.find((b) => b.emoji === '👍');
        if (!thumbs) bad.push('no thumbs-up');
        else if (thumbs.h < 44 || thumbs.w < 44) bad.push('thumbs-up is ' + Math.round(thumbs.w) + 'x' + Math.round(thumbs.h));
        else if (thumbs.clipped) bad.push('thumbs-up glyph is clipped');
        if (phone.scale && thumbs && thumbs.font < 28) bad.push('emoji font ' + thumbs.font + 'px at 200%');
        const small = row.buttons.filter((b) => b.h < 44 || b.w < 44);
        if (small.length) bad.push(small.length + ' emoji under 44px');
      }
      if (!bad.length) {
        await page.locator('#chat-in').fill('Hi ');
        await page.locator('#emojirow button[data-emoji="👍"]').tap();
        await page.waitForTimeout(50);
        const after = await page.evaluate(() => ({
          value: document.getElementById('chat-in').value,
          msgs: document.querySelectorAll('#chatlog .cmsg').length,
        }));
        if (after.value !== 'Hi 👍') bad.push('field is "' + after.value + '"');
        if (after.msgs !== before) bad.push('emoji sent a message');
      }
    }
    if (phone.name === 'iphone-15') {
      const shot = bad.length ? 'before-chat-emoji-iphone-15.png' : 'after-chat-emoji-iphone-15.png';
      await page.screenshot({ path: path.join(SHOTS, shot) });
    }
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS chat emoji');
})().catch((e) => { console.error(e); process.exit(1); });
