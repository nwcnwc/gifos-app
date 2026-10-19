/*
 * Record is a small control on the call; Captions lives in More (Talk).
 * Neither ever covers the header (Invite, Help, Full screen, Fit), on any
 * phone or desktop window, upright or sideways, 320 to 1440 wide, even when
 * the dock is measured far too tall. Opening and closing People does not
 * move the faces, Record, or the header. The Transcribing mark stays shown.
 *
 * Gate: NODE_PATH=/tmp/qa-pw/node_modules node test/mobile/record-clear-header.js
 * MEET_RELAY defaults to a closed local port, so nothing reaches a real relay.
 */
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const RELAY = process.env.MEET_RELAY || 'ws://127.0.0.1:9';
const UA = devices['Pixel 7'].userAgent;
const phone = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA });
const desk = (w, h) => ({ viewport: { width: w, height: h } });
const WINDOWS = {
  'phone-320': phone(320, 568), 'phone-375': phone(375, 667), 'phone-412': phone(412, 915),
  'phone-375-side': phone(667, 375), 'phone-412-side': phone(915, 412), 'phone-320-side': phone(568, 320),
  'desk-1024': desk(1024, 768), 'desk-1280-short': desk(1280, 360), 'desk-1440': desk(1440, 900),
};
const HEADER = ['appinvite', 'apphelp', 'appfull', 'fitbtn', 'txmark'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (n, c, d) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + n + (!c && d !== undefined ? '  ' + JSON.stringify(d) : '')); if (!c) fails++; };
const hit = (a, b) => !!(a && b && a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1);

const rects = (pg) => pg.evaluate((ids) => {
  const box = (el) => {
    if (!el || !el.getClientRects().length) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const o = { tile: box(document.querySelector('.tile.me')), rec: box(document.getElementById('call-rec')), chip: box(document.querySelector('.topchip')) };
  o.callCc = box(document.getElementById('call-cc'));
  for (const id of ids) o[id] = box(document.getElementById(id));
  return o;
}, HEADER);
const wake = async (pg) => {
  await pg.evaluate(() => { try { window.__gifosChrome && window.__gifosChrome.show(); } catch (e) {} });
  await sleep(600);
};
// A tucked dock is off screen and a Playwright click does not wake it; on a
// loaded host the idle timer can beat the click. Wake, then try again.
const openMore = async (pg) => {
  for (let i = 0; ; i++) {
    await wake(pg);
    try { await pg.locator('#bartoggle').click({ timeout: 5000 }); return; } catch (e) { if (i >= 2) throw e; }
  }
};
function clear(name, r) {
  const head = HEADER.map((id) => r[id]).filter(Boolean);
  check(name + ': Record clears the header', !head.some((h) => hit(r.rec, h)), r);
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--mute-audio', '--disable-gpu'] });
  for (const name of Object.keys(WINDOWS)) {
    const ctx = await browser.newContext(Object.assign({}, WINDOWS[name], { permissions: ['camera', 'microphone'] }));
    await ctx.addInitScript({ content: "try{localStorage.setItem('gifos_relay','" + RELAY + "');localStorage.setItem('gifos_name','Nathan');sessionStorage.setItem('gifos_appear_ok','1')}catch(e){}" });
    const pg = await ctx.newPage();
    const errs = [];
    pg.on('pageerror', (e) => errs.push(e.message));
    await pg.goto(BASE + '/run.html#v=rchead' + Math.floor(Math.random() * 1e9).toString(36), { waitUntil: 'domcontentloaded', timeout: 20000 });
    await pg.waitForFunction(() => window.__gifosVideo && document.querySelector('.tile.me'), null, { timeout: 30000 });
    await sleep(2500); await wake(pg);
    const before = await rects(pg);
    const phoneChrome = await pg.evaluate(() => window.matchMedia('(max-width: 700px), (max-height: 500px)').matches);
    check(name + ': Captions is not a button on the call', !before.callCc, before.callCc);
    check(name + ': the Transcribing mark shows', !!before.txmark, before.txmark);
    if (phoneChrome) {
      check(name + ': Record is on the call', !!before.rec, before.rec);
      if (before.rec) check(name + ': Record is small (no wide pill)', before.rec.w <= 140 && before.rec.h <= 48, before.rec);
    }
    clear(name, before);

    // A dock measured far too tall must not lift Record into the header.
    await pg.evaluate(() => { document.documentElement.style.setProperty('--dockh', (window.innerHeight - 40) + 'px'); });
    await sleep(80);
    clear(name + ' (dock measured too tall)', await rects(pg));
    await pg.evaluate(() => window.dispatchEvent(new Event('resize')));
    await sleep(400); await wake(pg);

    // Captions in More: same switch as before, and the sheet folds.
    await openMore(pg);
    const cc = pg.locator('#ccbtn');
    await cc.scrollIntoViewIfNeeded();
    check(name + ': Captions is in More', await cc.isVisible());
    const wasOn = await pg.evaluate(() => document.getElementById('ccbtn').classList.contains('on'));
    await cc.click();
    await sleep(200);
    const cs = await pg.evaluate(() => ({ on: document.getElementById('ccbtn').classList.contains('on'), pressed: document.getElementById('ccbtn').getAttribute('aria-pressed'), folded: document.querySelector('.bar').classList.contains('collapsed') }));
    check(name + ': Captions in More turns captions on', cs.on === !wasOn && cs.pressed === String(!wasOn) && cs.folded, cs);
    check(name + ': the Transcribing mark still shows', !!(await rects(pg)).txmark);
    await wake(pg);
    const settled = await rects(pg);

    // People open and closed: nothing moves.
    await openMore(pg);
    const who = pg.locator('#whobtn');
    await who.scrollIntoViewIfNeeded(); await who.click();
    await pg.waitForFunction(() => document.getElementById('who-modal').style.display === 'flex', null, { timeout: 4000 });
    await sleep(300);
    await pg.locator('#who-close').click();
    await sleep(800); await wake(pg);
    const after = await rects(pg);
    for (const k of ['tile', 'rec'].concat(HEADER)) check(name + ': People open/close keeps ' + k + ' in place', JSON.stringify(settled[k]) === JSON.stringify(after[k]), { before: settled[k], after: after[k] });
    clear(name + ' (after People)', after);
    check(name + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? 'FAIL ' + fails : 'PASS record clears header');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
