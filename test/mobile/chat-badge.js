/*
 * An incoming line shows a count on the call while More is closed.
 * The count is a thumb target, clear of the header, the live row, and the dock.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-badge.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

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
    await page.goto(BASE + '/run.html#v=chat-badge-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmcancel');
    if (await skip.count()) await skip.tap().catch(() => {});
    await page.waitForTimeout(300);
    const noted = await page.evaluate(() => {
      if (!window.__gifosChat || typeof window.__gifosChat.note !== 'function') return { hook: false };
      window.__gifosChat.note({ by: 'Ruth', text: 'See you Sunday' });
      window.__gifosChat.note({ by: 'Ruth', text: 'Bring the hymn sheets' });
      return { hook: true };
    });
    await page.waitForTimeout(80);
    const info = await page.evaluate(() => {
      const box = (el) => {
        if (!el) return { hidden: true, text: '', top: 0, bottom: 0, left: 0, right: 0, w: 0, h: 0, font: 0 };
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(),
          top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          w: b.width, h: b.height, font: parseFloat(cs.fontSize),
          hidden: el.hidden || cs.display === 'none' || b.width < 1,
        };
      };
      const badge = document.getElementById('chatbadge');
      return {
        moreOpen: !document.querySelector('.bar').classList.contains('collapsed'),
        chatLabel: (document.getElementById('chatbtn').textContent || '').trim(),
        badge: box(badge),
        status: box(document.getElementById('status')),
        state: box(document.getElementById('callstate')),
        dock: box(document.querySelector('.bar')),
        fit: box(document.getElementById('fitbtn')),
        vw: window.innerWidth, vh: window.innerHeight,
      };
    });
    const bad = [];
    if (!noted.hook) bad.push('no on-call unread count');
    if (info.moreOpen) bad.push('More is open');
    if (info.badge.hidden) bad.push('badge hidden while chat is closed');
    else {
      if (info.badge.text !== '2') bad.push('badge says "' + info.badge.text + '"');
      if (info.badge.h < 44 || info.badge.w < 44) bad.push('badge is ' + Math.round(info.badge.w) + 'x' + Math.round(info.badge.h));
      if (info.badge.top < -1 || info.badge.bottom > info.vh + 1 || info.badge.left < -1 || info.badge.right > info.vw + 1) bad.push('badge off screen');
      if (overlaps(info.badge, info.status)) bad.push('badge covers the header');
      if (overlaps(info.badge, info.state)) bad.push('badge covers Live');
      if (overlaps(info.badge, info.dock)) bad.push('badge covers the dock');
      if (overlaps(info.badge, info.fit)) bad.push('badge covers Fit');
      if (phone.scale && info.badge.font < 28) bad.push('badge font ' + info.badge.font + 'px at 200%');
    }
    if (info.chatLabel !== 'Chat') bad.push('More still says "' + info.chatLabel + '"');
    if (!bad.length) {
      await page.locator('#chatbadge').tap();
      await page.waitForTimeout(150);
      const opened = await page.evaluate(() => ({
        open: document.getElementById('chatpanel').classList.contains('open'),
        hidden: document.getElementById('chatbadge').hidden,
        label: (document.getElementById('chatbtn').textContent || '').trim(),
      }));
      if (!opened.open) bad.push('tapping the badge did not open chat');
      if (!opened.hidden) bad.push('badge stayed up after chat opened');
      if (opened.label !== 'Chat') bad.push('chat label "' + opened.label + '"');
    }
    if (phone.name === 'iphone-15') {
      const shot = bad.length ? 'before-chat-badge-iphone-15.png' : 'after-chat-badge-iphone-15.png';
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
  console.log('PASS chat badge');
})().catch((e) => { console.error(e); process.exit(1); });
