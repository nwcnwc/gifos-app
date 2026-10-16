/*
 * An incoming line shows the sender and the latest text on the call
 * while chat is closed. The banner is readable, tappable, and faces
 * end above it.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/chat-preview.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const PEOPLE = [
  { id: 'peer-ruth', name: 'Ruth' },
  { id: 'peer-david', name: 'David' },
  { id: 'peer-sam', name: 'Sam' },
];

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
  { name: 'iphone-15', device: devices['iPhone 15'], scale: null, faces: true },
  { name: 'iphone-se', device: devices['iPhone SE'], scale: null, faces: false },
  { name: 'android-360-200', device: phone360(), scale: '2', faces: false },
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
    await page.goto(BASE + '/run.html#v=chat-preview-' + phone.name, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#leavebtn', { timeout: 15000 });
    const skip = page.locator('#nmcancel');
    if (await skip.count()) await skip.tap().catch(() => {});
    if (phone.faces) {
      await page.evaluate((people) => window.__gifosVideo.presentPeers(people), PEOPLE);
      await page.waitForTimeout(250);
    }
    const noted = await page.evaluate(() => {
      if (!window.__gifosChat || typeof window.__gifosChat.note !== 'function') return false;
      window.__gifosChat.note({ by: 'Ruth', text: 'See you Sunday' });
      window.__gifosChat.note({ by: 'Ruth', text: 'Bring the hymn sheets' });
      return true;
    });
    await page.waitForTimeout(120);
    const info = await page.evaluate(() => {
      const box = (el) => {
        if (!el) return { missing: true, hidden: true, text: '', top: 0, bottom: 0, left: 0, right: 0, w: 0, h: 0, font: 0, color: '', bg: '', wide: false, tall: false };
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          missing: false,
          text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
          top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          w: b.width, h: b.height, font: parseFloat(cs.fontSize),
          color: cs.color, bg: cs.backgroundColor,
          hidden: el.hidden || cs.display === 'none' || b.width < 1,
          wide: el.scrollWidth > el.clientWidth + 2,
          tall: el.scrollHeight > el.clientHeight + 2,
        };
      };
      const tiles = Array.from(document.querySelectorAll('.tile')).map((el) => {
        const b = el.getBoundingClientRect();
        return { bottom: b.bottom, h: b.height, shown: b.width > 8 && b.height > 8 && el.style.display !== 'none' };
      }).filter((t) => t.shown);
      return {
        moreOpen: !document.querySelector('.bar').classList.contains('collapsed'),
        preview: box(document.getElementById('chatpreview')),
        name: box(document.getElementById('chatpreview-by')),
        line: box(document.getElementById('chatpreview-txt')),
        badge: box(document.getElementById('chatbadge')),
        status: box(document.getElementById('status')),
        state: box(document.getElementById('callstate')),
        dock: box(document.querySelector('.bar')),
        fit: box(document.getElementById('fitbtn')),
        tiles: tiles,
        vw: window.innerWidth, vh: window.innerHeight,
      };
    });
    const bad = [];
    if (!noted) bad.push('no chat hook');
    if (info.preview.missing) bad.push('no message preview');
    if (info.moreOpen) bad.push('More is open');
    if (!info.preview.missing && info.preview.hidden) bad.push('preview hidden while chat is closed');
    if (!info.preview.hidden) {
      if (info.preview.text.indexOf('Ruth') < 0) bad.push('preview has no sender');
      if (info.preview.text.indexOf('hymn') < 0) bad.push('preview is not the latest line: "' + info.preview.text + '"');
      if (info.preview.text.indexOf('Sunday') >= 0) bad.push('preview still shows the older line');
      if (info.preview.h < 44) bad.push('preview is ' + Math.round(info.preview.h) + 'px tall');
      if (info.preview.top < -1 || info.preview.bottom > info.vh + 1 || info.preview.left < -1 || info.preview.right > info.vw + 1) bad.push('preview off screen');
      if (info.preview.tall) bad.push('preview text is clipped vertically');
      if (info.name.font && info.name.font < (phone.scale ? 28 : 14)) bad.push('name font ' + info.name.font);
      if (phone.scale && info.line.font < 28) bad.push('line font ' + info.line.font + 'px at 200%');
      if (overlaps(info.preview, info.badge)) bad.push('preview covers the count');
      if (overlaps(info.preview, info.status)) bad.push('preview covers the header');
      if (overlaps(info.preview, info.state)) bad.push('preview covers Live');
      if (overlaps(info.preview, info.dock)) bad.push('preview covers the dock');
      if (overlaps(info.preview, info.fit)) bad.push('preview covers Fit');
      const ratio = contrast(info.line.color, info.preview.bg);
      if (ratio !== null && ratio < 4.5) bad.push('preview contrast ' + ratio.toFixed(2));
    }
    if (phone.faces) {
      const limit = info.preview.hidden ? info.state.top : info.preview.top;
      for (const t of info.tiles) {
        if (t.bottom > limit + 1) bad.push('a face runs under the preview (bottom ' + Math.round(t.bottom) + ', preview ' + Math.round(limit) + ')');
      }
      if (info.tiles.length < 4) bad.push('only ' + info.tiles.length + ' faces');
    }
    if (phone.name === 'iphone-15') {
      const shot = bad.length ? 'before-chat-preview-iphone-15.png' : 'after-chat-preview-iphone-15.png';
      await page.screenshot({ path: path.join(SHOTS, shot) });
    }
    if (!bad.length) {
      await page.locator('#chatpreview').tap();
      await page.waitForTimeout(150);
      const opened = await page.evaluate(() => ({
        open: document.getElementById('chatpanel').classList.contains('open'),
        preview: document.getElementById('chatpreview').hidden || document.getElementById('chatnote').hidden,
        badge: document.getElementById('chatbadge').hidden,
      }));
      if (!opened.open) bad.push('tapping the preview did not open chat');
      if (!opened.preview) bad.push('preview stayed up after chat opened');
      if (!opened.badge) bad.push('count stayed up after chat opened');
    }
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS chat preview');
})().catch((e) => { console.error(e); process.exit(1); });

function lum(c) {
  const m = String(c || '').match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  if (m[4] !== undefined && +m[4] === 0) return null;
  const lin = [m[1], m[2], m[3]].map((v) => {
    const s = +v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function contrast(a, b) {
  const L1 = lum(a), L2 = lum(b);
  if (L1 === null || L2 === null) return null;
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}
