/*
 * The pastor hosts the prayer call from their phone. Grace joined from
 * the lobby iPad, so her tile says "Lobby iPad"; a guest's TV is loud.
 * On a laptop the host taps "3 in the meeting" and gets People with
 * Rename, Spotlight, Mute and the waiting room. On a phone that count is
 * hidden, and the People button opens a list with no buttons: the host
 * cannot rename, mute for everyone, spotlight or open the waiting room.
 * Tapping the room name opens a sheet; it must lead to People.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/host-phone-people.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const land = (d) => Object.assign({}, d, { viewport: { width: d.viewport.height, height: d.viewport.width } });
const phones = [
  { name: 'iphone-se', device: devices['iPhone SE'] },
  { name: 'iphone-se-land', device: land(devices['iPhone SE']) },
];

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const failures = [];
  for (const phone of phones) {
    const context = await browser.newContext(Object.assign({}, phone.device, { hasTouch: true }));
    await context.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {} });
    const page = await context.newPage();
    await page.goto(BASE + '/run.html#v=host-phone-people&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#status', { timeout: 15000 });
    const skip = page.locator('#nmok');
    if (await skip.count()) await skip.tap().catch(() => {});
    const bad = [];
    const seeded = await page.evaluate(() => window.__gifosVideo.seedGalleryForTest({ count: 2, names: ['Ruth', 'Lobby iPad'] }));
    if (!seeded || !seeded.ok) bad.push('could not seat Ruth and the lobby iPad');
    // Ruth seats muted; People offers no Mute for someone already muted.
    await page.evaluate(() => window.__gifosVideo.setPeerStatusForTest('qa1', { muted: false }));
    await page.waitForTimeout(150);
    await page.locator('#status').tap();
    await page.waitForTimeout(80);
    // Any visible button in the sheet that leads to People.
    const way = await page.evaluate(() => {
      const sheet = document.getElementById('status-full');
      if (!sheet || getComputedStyle(sheet).display === 'none') return { open: false };
      const b = Array.from(sheet.querySelectorAll('button')).find((x) => /people/i.test(x.textContent || '') && x.getBoundingClientRect().height > 2);
      if (!b) return { open: true };
      const r = b.getBoundingClientRect();
      return { open: true, id: b.id, text: (b.textContent || '').trim(), h: r.height, w: r.width };
    });
    if (!way.open) bad.push('tapping the room name opened nothing');
    else if (!way.id) bad.push('the room sheet has no way to People');
    else {
      if (way.h < 44 || way.w < 44) bad.push('People in the sheet is ' + Math.round(way.w) + 'x' + Math.round(way.h));
      await page.locator('#' + way.id).tap();
      await page.waitForTimeout(120);
      // A sideways phone scrolls People to reach a row, as a person would.
      for (const sel of ['#roster .mutebtn[aria-label$="Ruth"]', '#roster .renamebtn[aria-label="Rename Lobby iPad"]']) {
        const x = page.locator(sel);
        if (await x.count()) await x.scrollIntoViewIfNeeded().catch(() => {});
      }
      const r = await page.evaluate(() => {
        const el = document.getElementById('roster');
        const sheet = document.getElementById('status-full');
        const b = el.getBoundingClientRect();
        const btn = (sel) => {
          const x = document.querySelector(sel);
          if (!x) return null;
          const q = x.getBoundingClientRect();
          // Nothing else (the Record/Captions row, the dock) sits on top of it.
          const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
          return { h: q.height, top: q.top, bottom: q.bottom, left: q.left, right: q.right, covered: !(hit && x.contains(hit)) };
        };
        return {
          open: el.classList.contains('open') && getComputedStyle(el).display !== 'none',
          sheetGone: getComputedStyle(sheet).display === 'none',
          box: { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height },
          // The panel's own bottom edge is not painted over by the Record row.
          edgeCovered: [0.15, 0.5, 0.85].some((f) => {
            const hit = document.elementFromPoint(b.left + b.width * f, b.bottom - 6);
            return !(hit && el.contains(hit));
          }),
          rename: btn('#roster .renamebtn[aria-label="Rename Lobby iPad"]'),
          last: btn('#roster .roster-row:last-child .renamebtn'),
          mute: btn('#roster .mutebtn[aria-label$="Ruth"]'),
          close: btn('#roster-close'),
          vw: innerWidth, vh: innerHeight,
        };
      });
      const on = (q) => q && q.h >= 40 && !q.covered && q.top >= -1 && q.left >= -1 && q.right <= r.vw + 1 && q.bottom <= r.vh + 1;
      if (!r.open) bad.push('People did not open');
      else {
        if (!r.sheetGone) bad.push('the room sheet stayed over People');
        if (r.box.h < 160) bad.push('People is only ' + Math.round(r.box.h) + 'px tall');
        if (!on(r.close)) bad.push('People has no reachable Close');
        if (!on(r.mute)) bad.push('Mute for Ruth is not reachable');
        if (r.edgeCovered) bad.push('the Record/Captions row paints over People');
        if (r.last && r.last.covered) bad.push('something covers the last Rename in People');
        if (!on(r.rename)) bad.push('Rename for the lobby iPad is not reachable');
        else {
          await page.locator('#roster .renamebtn[aria-label="Rename Lobby iPad"]').tap();
          await page.locator('#roster .renamebox').fill('Grace');
          await page.locator('#roster .renamesave').tap();
          await page.waitForTimeout(80);
          const tile = await page.evaluate(() => {
            const t = document.querySelector('.tile[data-peer="qa2"] .name');
            return t ? (t.textContent || '').trim() : '';
          });
          if (!/Grace/.test(tile)) bad.push('the rename did not reach the tile ("' + tile + '")');
        }
      }
    }
    await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-host-phone-people-' + phone.name + '.png') });
    if (bad.length) failures.push(phone.name + ': ' + bad.join('; '));
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAIL ' + failures.join(' | '));
    process.exit(1);
  }
  console.log('PASS host phone people');
})().catch((e) => { console.error(e); process.exit(1); });
