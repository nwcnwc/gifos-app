/*
 * The join and lobby name step opens with the GifOS name and picture.
 * Save keeps that name and picture. Clear blanks both. Save is the
 * solid button and Clear is the outline.
 *
 *   NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/appear-preview.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const HASH = 'c414cd0e204de974f73753c7e28d7638e7b3691bb8b1a2bab6b25bb7fed7ce77';

function gap(a, b) {
  const overlapY = a.bottom > b.top + 4 && b.bottom > a.top + 4;
  const overlapX = a.right > b.left + 4 && b.right > a.left + 4;
  if (overlapY && !overlapX) return Math.max(b.left, a.left) - Math.min(a.right, b.right);
  if (overlapX && !overlapY) return Math.max(b.top, a.top) - Math.min(a.bottom, b.bottom);
  return 0;
}

async function boot(browser, device, url, identity) {
  const context = await browser.newContext(Object.assign({}, device, { hasTouch: true }));
  await context.addInitScript((id) => {
    try {
      if (id.name) localStorage.setItem('gifos_name', id.name);
      else localStorage.removeItem('gifos_name');
      if (id.avatar) localStorage.setItem('gifos_avatar', id.avatar);
      else localStorage.removeItem('gifos_avatar');
    } catch (e) {}
  }, identity);
  const page = await context.newPage();
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  return { context, page };
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  const avatar = JSON.stringify({ mime: 'image/png', hash: HASH, b64: PNG });
  const phone = devices['iPhone SE'];

  {
    const { context, page } = await boot(browser, phone, '/run.html', { name: 'Grandma Ruth', avatar: avatar });
    // The merged lobby (qa-broadcast-desktop, newer) shows the name in a field and the
    // picture on a round button that changes it.
    await page.waitForSelector('#lob-name-in', { timeout: 15000 });
    await page.waitForTimeout(200);
    const info = await page.evaluate(() => {
      const kicker = Array.from(document.querySelectorAll('#lobby *')).find((el) => (el.childNodes.length === 1 && el.textContent.trim() === "This is how you'll appear"));
      const name = document.getElementById('lob-name-in');
      const img = document.querySelector('#lob-face img');
      const change = document.getElementById('lob-face');
      const start = document.getElementById('lob-open');
      const nb = name.getBoundingClientRect();
      const cb = change.getBoundingClientRect();
      const sb = start.getBoundingClientRect();
      const ib = img ? img.getBoundingClientRect() : { width: 0, height: 0 };
      const cs = getComputedStyle(change);
      const ss = getComputedStyle(start);
      return {
        kicker: !!(kicker && kicker.getBoundingClientRect().height > 0),
        name: (name.value || '').trim(),
        avatar: !!(img && !img.hidden && ib.width >= 32 && ib.height >= 32 && (img.src || '').indexOf('data:image/png') === 0),
        change: { w: cb.width, h: cb.height, bg: cs.backgroundColor, color: cs.color },
        startBg: ss.backgroundColor,
        space: Math.max(cb.left, nb.left) - Math.min(nb.right, cb.right),
        sameRow: Math.abs((cb.top + cb.bottom) / 2 - (nb.top + nb.bottom) / 2) < 40,
      };
    });
    const bad = [];
    if (!info.kicker) bad.push('lobby has no "This is how you\'ll appear"');
    if (info.name !== 'Grandma Ruth') bad.push('lobby name "' + info.name + '"');
    if (!info.avatar) bad.push('lobby is not showing the system picture');
    if (info.change.w < 44 || info.change.h < 44) bad.push('Change is ' + Math.round(info.change.w) + 'x' + Math.round(info.change.h));
    if (info.change.bg === info.startBg) bad.push('Change is the same color as Start');
    if (info.change.bg === 'rgba(0, 0, 0, 0)') bad.push('Change is a text link, not a button');
    if (!info.sameRow || info.space < 8) bad.push('Change is crowded against the name');
    await page.screenshot({ path: path.join(SHOTS, 'after-appear-lobby.png') });
    if (bad.length) failures.push('lobby: ' + bad.join('; ') + ' ' + JSON.stringify(info));
    await context.close();
  }

  {
    const { context, page } = await boot(browser, phone, '/run.html#v=appear-known', { name: 'Grandma Ruth', avatar: avatar });
    const showed = await page.waitForSelector('#nm', { timeout: 3000 }).then(() => true).catch(() => false);
    if (!showed) {
      await page.screenshot({ path: path.join(SHOTS, 'after-appear-name.png') });
      failures.push('known: join skipped the appearance step');
      await context.close();
    } else {
    const info = await page.evaluate(() => {
      const input = document.getElementById('nm');
      const img = document.querySelector('#appear-face img'); // the merged join card paints the picture into the face
      const kicker = document.body.innerText.indexOf("This is how you'll appear") >= 0;
      const ok = document.getElementById('nmok').getBoundingClientRect();
      const cancel = document.getElementById('nmcancel').getBoundingClientRect();
      const okS = getComputedStyle(document.getElementById('nmok'));
      const cancelS = getComputedStyle(document.getElementById('nmcancel'));
      const ib = img ? img.getBoundingClientRect() : { width: 0, height: 0 };
      return {
        value: input.value,
        kicker: kicker,
        avatar: !!(img && !img.hidden && ib.width >= 32 && (img.src || '').indexOf('data:image/png') === 0),
        ok: { w: ok.width, h: ok.height, bg: okS.backgroundColor, left: ok.left, right: ok.right, top: ok.top, bottom: ok.bottom },
        cancel: { w: cancel.width, h: cancel.height, bg: cancelS.backgroundColor, color: cancelS.color, left: cancel.left, right: cancel.right, top: cancel.top, bottom: cancel.bottom },
        vw: window.innerWidth, vh: window.innerHeight,
      };
    });
    const bad = [];
    if (info.value !== 'Grandma Ruth') bad.push('name field "' + info.value + '"');
    if (!info.kicker) bad.push('no appearance heading');
    if (!info.avatar) bad.push('system picture is not in the preview');
    const labels = await page.evaluate(() => ({
      ok: document.getElementById('nmok').textContent.trim(),
      cancel: document.getElementById('nmcancel').textContent.trim(),
    }));
    if (labels.ok !== 'Save') bad.push('primary says "' + labels.ok + '"');
    if (labels.cancel !== 'Clear') bad.push('secondary says "' + labels.cancel + '"');
    if (info.ok.w < 44 || info.ok.h < 44) bad.push('Save is small');
    if (info.cancel.w < 44 || info.cancel.h < 44) bad.push('Clear is small');
    if (info.ok.bg === info.cancel.bg) bad.push('Save and Clear are the same color');
    if (info.ok.bg !== 'rgb(0, 100, 200)') bad.push('Save is not the solid blue button');
    const space = gap(info.cancel, info.ok);
    if (space < 12) bad.push('buttons are ' + Math.round(space) + 'px apart');
    if (info.ok.right > info.vw + 1 || info.cancel.left < -1 || info.ok.bottom > info.vh + 1) bad.push('buttons leave the screen');
    await page.screenshot({ path: path.join(SHOTS, 'after-join-save-iphone-se.png') });
    if (bad.length) failures.push('known: ' + bad.join('; ') + ' ' + JSON.stringify(info));
    await page.locator('#nmok').tap();
    const kept = await page.evaluate(() => ({
      name: localStorage.getItem('gifos_name'),
      avatar: localStorage.getItem('gifos_avatar'),
    }));
    if (kept.name !== 'Grandma Ruth') failures.push('Save changed the name to ' + kept.name);
    if (!kept.avatar || kept.avatar.indexOf(HASH) < 0) failures.push('Save dropped the picture');
    await context.close();
    }
  }

  {
    const { context, page } = await boot(browser, phone, '/run.html#v=appear-clear', { name: 'Grandma Ruth', avatar: avatar });
    await page.waitForSelector('#nmcancel', { timeout: 15000 });
    await page.locator('#nmcancel').tap();
    await page.waitForTimeout(100);
    const cleared = await page.evaluate(() => ({
      name: localStorage.getItem('gifos_name'),
      avatar: localStorage.getItem('gifos_avatar'),
      open: !!document.getElementById('nm'),
    }));
    if (cleared.name) failures.push('Clear left the name "' + cleared.name + '"');
    if (cleared.avatar) failures.push('Clear left the picture');
    if (cleared.open) failures.push('Clear left the join step open');
    await context.close();
  }

  {
    const { context, page } = await boot(browser, phone, '/run.html#v=appear-new', { name: '', avatar: '' });
    await page.waitForSelector('#nm', { timeout: 15000 });
    const value = await page.locator('#nm').inputValue();
    if (!/^Guest \d+$/.test(value)) failures.push('first visit field is "' + value + '"');
    const letter = await page.evaluate(() => {
      const el = document.getElementById('appear-face');
      return el && !el.querySelector('img') ? el.textContent.trim() : '';
    });
    if (letter !== 'G') failures.push('first visit letter is "' + letter + '"');
    await context.close();
  }

  await browser.close();
  if (failures.length) {
    console.error('FAIL\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('PASS appearance preview');
})().catch((e) => { console.error(e); process.exit(1); });
