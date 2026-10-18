/*
 * A service host's dock fits the window. When it does not, Share, then
 * Reactions, then Step off move into More, where a stand-in presses the real
 * button; Camera, Mic, More, End and the grip stay on the dock. A dock that
 * fits (a small group, a wide window) moves nothing. 412, 600 and 1280 wide.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/host-dock-fit.js
 * MEET_RELAY defaults to a closed local port, so nothing reaches a real relay.
 */
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const RELAY = process.env.MEET_RELAY || 'ws://127.0.0.1:9';
// The "This is how you'll appear" card is saved once per tab.
const APPEAR_SEEN = "try{sessionStorage.setItem('gifos_appear_ok','1')}catch(e){};";
async function wakeDock(pg) {
  const vp = pg.viewportSize() || { width: 800, height: 600 };
  const x = Math.round(vp.width / 2), y = Math.round(vp.height / 3);
  await pg.mouse.move(x, y);
  await pg.mouse.move(x + 3, y + 2);
  await pg.waitForFunction(() => !document.body.classList.contains('dock-calm'), null, { timeout: 2000 }).catch(() => {});
}
async function ackRecNotice(pg, ms) {
  const ok = await pg.waitForSelector('#rec-notice-ok', { timeout: ms }).catch(() => null);
  if (ok) await ok.click();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const errs = [];
const check = (n, c, d) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); if (!c) fails++; };
const PROFILES = { phone: Object.assign({}, devices['Pixel 7']), wide: { viewport: { width: 1280, height: 800 } }, mid: { viewport: { width: 600, height: 900 } } };
const dockOf = (pg) => pg.evaluate(() => {
  const bar = document.querySelector('.bar'); const vw = window.innerWidth;
  const kids = [...bar.children].filter((e) => e.id !== 'barmore' && getComputedStyle(e).display !== 'none' && e.getClientRects().length)
    .map((e) => { const r = e.getBoundingClientRect(); return { id: e.id, l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) }; });
  const moved = ['sharebtn', 'reactbtn', 'stagebtn', 'chatbtn', 'invite', 'fsbtn'].filter((id) => { const b = document.getElementById(id); return b && b.classList.contains('inmore'); });
  return { vw, kids, moved, out: kids.filter((k) => k.l < 0 || k.r > vw).map((k) => k.id) };
});
async function open(browser, prof, name) {
  const ctx = await browser.newContext(Object.assign({}, PROFILES[prof], { permissions: ['camera', 'microphone'] }));
  await ctx.addInitScript({ content: "try{localStorage.setItem('gifos_relay','" + RELAY + "');localStorage.setItem('gifos_name','" + name + "');localStorage.setItem('gifos_meet_bar','1')}catch(e){}" + APPEAR_SEEN });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errs.push(prof + ': ' + e.message));
  return { ctx, pg };
}
async function host(browser, prof) {
  const { ctx, pg: h } = await open(browser, prof, 'Hana');
  const room = 'hdock' + Math.floor(Math.random() * 1e9).toString(36);
  await h.goto(BASE + '/run.html');
  const av = await h.evaluate(async ([roomId, pw]) => {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode('gifos-admin:' + roomId), iterations: 310000 }, km, 256);
    const K = Array.from(new Uint8Array(bits)).map((x) => x.toString(16).padStart(2, '0')).join('');
    const V = (await GifOS.net.edKeysFromSeedHex(K)).verifier;
    localStorage.setItem('gifos_vadm_' + roomId + '.' + V, K);
    return V;
  }, [room, 'hd-' + room]);
  await h.goto(BASE + '/run.html#v=' + room + '&av=' + av + '&bc=1'); await h.reload();
  await h.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.amAdmin() && window.__gifosVideo.onStage(), null, { timeout: 30000 });
  await ackRecNotice(h, 8000);
  await sleep(1500); await wakeDock(h);
  return { ctx, h };
}
async function meeting(browser, prof) {
  const { ctx, pg } = await open(browser, prof, 'Mo');
  await pg.goto(BASE + '/run.html#v=hdmeet' + Math.floor(Math.random() * 1e9).toString(36));
  await pg.waitForFunction(() => window.__gifosVideo && window.__gifosVideo.room() && document.querySelector('.tile.me'), null, { timeout: 30000 });
  await sleep(2500); await wakeDock(pg);
  return { ctx, pg };
}
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--disable-gpu', '--mute-audio'] });
  const dump = {};
  const STAY = ['bargrip', 'cam', 'mic', 'bartoggle', 'leavebtn'];
  const ORDER = ['sharebtn', 'reactbtn', 'stagebtn'];
  for (const prof of ['phone', 'mid', 'wide']) {
    const { ctx, h } = await host(browser, prof);
    const d = await dockOf(h); dump['host-' + prof] = d;
    const ids = d.kids.map((k) => k.id);
    check(prof + ' host: every dock button is inside the window', d.out.length === 0, d);
    check(prof + ' host: Camera, Mic, More, End and the grip stay on the dock', STAY.every((id) => ids.includes(id)), ids);
    const k = d.moved.length;
    check(prof + ' host: only Share, Reactions, Step off move, in that order', d.moved.every((id, i) => id === ORDER[i]), d.moved);
    if (prof === 'wide') check('wide host: nothing moves into More (it fits)', k === 0, d.moved);
    if (prof === 'phone') check('phone host: something had to move (the dock did not fit)', k > 0, d.moved);
    // each moved button has its stand-in in More, and it presses the real one
    if (k) {
      await h.locator('#bartoggle').click();
      if (prof === 'phone') {
        const sheet = await h.evaluate(() => {
          const s = document.querySelector('.barmore');
          s.scrollTop = s.scrollHeight;
          const r = s.getBoundingClientRect();
          const dock = document.querySelector('.bar').getBoundingClientRect();
          const vw = window.innerWidth;
          const shown = (el) => !el.hidden && el.getClientRects().length && getComputedStyle(el).display !== 'none';
          const btns = [...s.querySelectorAll('.morerow > button, .dockmore')].filter(shown);
          const box = btns.map((b) => {
            const g = b.getBoundingClientRect();
            return { t: (b.innerText || '').trim().slice(0, 18), h: Math.round(g.height), right: Math.round(g.right), left: Math.round(g.left), over: b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1 };
          });
          const hit = (a, b) => a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2;
          const fields = ['#bcwhenrow', '#bcvisitrow', '#qabtn', '#rbbtn'].map((sel) => {
            const el = s.querySelector(sel);
            if (!el || !shown(el)) return null;
            const g = el.getBoundingClientRect();
            const input = el.querySelector('input');
            return { sel, l: Math.round(g.left), r: Math.round(g.right), t: Math.round(g.top), b: Math.round(g.bottom), in: input ? input.scrollWidth > input.clientWidth + 1 : false, rect: g };
          }).filter(Boolean);
          const overlaps = [];
          for (let i = 0; i < fields.length; i++) for (let j = i + 1; j < fields.length; j++) if (hit(fields[i].rect, fields[j].rect)) overlaps.push(fields[i].sel + '+' + fields[j].sel);
          const status = document.getElementById('statusrest');
          const sr = status ? status.getBoundingClientRect() : null;
          const dockHits = btns.filter((b) => hit(b.getBoundingClientRect(), dock) && b.getBoundingClientRect().top < dock.top).map((b) => (b.innerText || '').trim().slice(0, 18));
          return {
            l: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), dockTop: Math.round(dock.top), vw, box,
            fields: fields.map(({ rect, ...rest }) => rest), overlaps, dockHits,
            statusRight: sr ? Math.round(sr.right) : 0, statusOver: status ? status.scrollWidth > status.clientWidth + 1 : false,
          };
        });
        check('phone host: the More sheet fits the screen width', sheet.l >= -1 && sheet.right <= sheet.vw + 1 && sheet.bottom <= sheet.dockTop + 1, sheet);
        check('phone host: every More button is on screen, 64px, and its text fits', sheet.box.length > 0 && sheet.box.every((b) => b.left >= -1 && b.right <= sheet.vw + 1 && b.h === 64 && !b.over), sheet.box);
        check('phone host: start time, Visit, Rebroadcast and Questions do not overlap', sheet.overlaps.length === 0 && sheet.fields.every((f) => f.r <= sheet.vw + 1 && !f.in), sheet.fields.concat(sheet.overlaps));
        check('phone host: no More tile sits on the dock', sheet.dockHits.length === 0, sheet.dockHits);
        check('phone host: the header sentence stays inside the screen', sheet.statusRight <= sheet.vw + 1 && !sheet.statusOver, { statusRight: sheet.statusRight, vw: sheet.vw, statusOver: sheet.statusOver });
      }
      const sh = await h.evaluate((m) => m.map((id) => { const p = document.querySelector('#barmore .dockmore[data-dock="' + id + '"]'); return { id, shown: !!(p && !p.hidden && p.getClientRects().length), text: p && p.textContent }; }), d.moved);
      check(prof + ' host: More shows a stand-in for each moved button', sh.every((s) => s.shown), sh);
      const after = await dockOf(h);
      check(prof + ' host: opening More keeps the dock inside the window', after.out.length === 0, after);
      if (d.moved.includes('stagebtn')) {
        await h.locator('#barmore .dockmore[data-dock="stagebtn"]').click();
        const off = await h.waitForFunction(() => !window.__gifosVideo.onStage(), null, { timeout: 8000 }).then(() => true, () => false);
        check(prof + ' host: the Step off stand-in steps the host off the stage', off);
      } else if (await h.locator('#bartoggle').getAttribute('aria-expanded') === 'true') await h.locator('#bartoggle').click();
      if (d.moved.includes('reactbtn')) {
        await wakeDock(h);
        if ((await h.locator('#bartoggle').getAttribute('aria-expanded')) !== 'true') await h.locator('#bartoggle').click();
        await h.locator('#barmore .dockmore[data-dock="reactbtn"]').click();
        const tray = await h.waitForFunction(() => { const t = document.getElementById('reacttray'); if (!t || t.hasAttribute('hidden')) return false; const r = t.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight; }, null, { timeout: 5000 }).then(() => true, () => false);
        check(prof + ' host: the Reactions stand-in opens the tray, on the screen', tray);
      }
    }
    await ctx.close();
  }
  for (const prof of ['phone', 'mid', 'wide']) {
    const { ctx, pg } = await meeting(browser, prof);
    const d = await dockOf(pg); dump['meet-' + prof] = d;
    check(prof + ' small group: nothing moves into More, every button inside the window', d.moved.length === 0 && d.out.length === 0, d);
    await ctx.close();
  }
  check('no page error', errs.length === 0, errs);
  await browser.close();
  console.log(fails ? fails + ' FAIL' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
