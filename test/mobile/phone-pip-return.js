/*
 * Back from picture in picture on a phone, the meeting is the meeting it was
 * (Nathan, 2026-10-19, Android Chrome: evidence/gate-1019/nathan-after-pip.jpg
 * and nathan-tile-small-solo.jpg).
 *
 * Solo, camera on, mic on. Then the things a person does: a tap, More open and
 * shut, People open and shut, a float (the page shrinks to the float size) and
 * back. After each one the self tile, Record and Captions stand exactly where
 * they stood before, the solo tile fills the stage width, and the camera and
 * mic are as they were.
 *
 * The float step hands the page ONE resize while the layout still has the
 * float's geometry (innerHeight already full, the dock still placed for the
 * float), the order a phone browser delivers the size change around a float.
 * The dock height used to keep the largest height it had ever measured, so
 * that one reading put Record and Captions over the system header and shrank
 * the solo tile for the rest of the meeting.
 *
 * Gate: NODE_PATH=<playwright node_modules> MEET_BASE=http://127.0.0.1:<port> node test/mobile/phone-pip-return.js
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const RELAY = process.env.RELAY || '';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PHONE = { width: 412, height: 869 };
const FLOAT = { width: 125, height: 223 };

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });
  const context = await browser.newContext({
    viewport: PHONE, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; moto g24) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
    permissions: ['camera', 'microphone'],
  });
  await context.addInitScript({ content: "try{localStorage.setItem('gifos_name','Nathan');sessionStorage.setItem('gifos_appear_ok','1');"
    + (RELAY ? "localStorage.setItem('gifos_relay','" + RELAY + "');" : '') + "}catch(e){}" });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + '/run.html#v=pip-return-' + Date.now().toString(36) + '&DEBUG=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  await page.waitForFunction(() => window.__gifosVideo && typeof window.__gifosVideo.camOff === 'function', null, { timeout: 15000 });
  await sleep(1500);
  // Camera on, mic on.
  if (await page.evaluate(() => window.__gifosVideo.camOff())) await page.evaluate(() => document.getElementById('cam').click());
  await page.evaluate(() => { const m = document.getElementById('mic'); if (m && /unmute/i.test(m.textContent)) m.click(); });
  await page.waitForFunction(() => { const v = document.querySelector('.tile.me video'); return v && v.videoWidth > 0; }, null, { timeout: 15000 });
  await sleep(1000);

  const cdp = await context.newCDPSession(page);
  const size = (s) => cdp.send('Emulation.setDeviceMetricsOverride', { width: s.width, height: s.height, deviceScaleFactor: 2.625, mobile: true });
  const wake = async () => { await page.touchscreen.tap(200, 670); await sleep(700); };
  // Awake chrome: the pills are shown, so their rest place is measurable.
  const read = () => page.evaluate(() => {
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
    const me = document.querySelector('.tile.me');
    const mic = document.getElementById('mic');
    const t = document.querySelector('.tile.me video');
    const track = t && t.srcObject ? t.srcObject.getVideoTracks()[0] : null;
    return {
      vw: innerWidth,
      tile: r(me),
      rec: r(document.getElementById('call-rec')),
      cc: r(document.getElementById('call-cc')),
      camOn: !window.__gifosVideo.camOff(),
      micOn: !!mic && !/unmute/i.test(mic.textContent),
      live: !!track && track.readyState === 'live' && track.enabled,
      away: document.body.classList.contains('chrome-away'),
    };
  });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const bad = [];
  await wake();
  const before = await read();
  if (!before.camOn || !before.micOn || !before.live) bad.push('precondition: camera and mic not both on (' + JSON.stringify(before) + ')');
  if (before.tile[2] < before.vw * 0.9) bad.push('precondition: the solo tile does not fill the stage (' + before.tile[2] + ' of ' + before.vw + ')');
  const check = async (step) => {
    await wake();
    const now = await read();
    const diff = [];
    for (const k of ['tile', 'rec', 'cc', 'camOn', 'micOn', 'live']) if (!same(now[k], before[k])) diff.push(k + ' ' + JSON.stringify(before[k]) + ' -> ' + JSON.stringify(now[k]));
    if (now.tile[2] < now.vw * 0.9) diff.push('solo tile ' + now.tile[2] + 'px of ' + now.vw);
    if (now.rec && now.rec[1] < 120) diff.push('Record is up in the header band (y ' + now.rec[1] + ')');
    if (diff.length) bad.push(step + ': ' + diff.join(', '));
    return now;
  };
  const steps = {};
  steps.tap = await check('tap');
  await page.evaluate(() => document.getElementById('bartoggle').click()); await sleep(700);
  await page.evaluate(() => document.getElementById('bartoggle').click()); await sleep(700);
  steps.more = await check('More open and shut');
  await page.evaluate(() => { const b = document.querySelector('.topchip'); if (b) b.click(); }); await sleep(800);
  await page.keyboard.press('Escape'); await sleep(600);
  steps.people = await check('People open and shut');
  // The float: a touch, then Home inside the 3 s before the dock tucks (or
  // with a sheet holding it up). Focus goes, the page shrinks to the float,
  // and one resize arrives with the full height before the layout has caught
  // up. Then live video in the float, then back.
  await wake();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await size(FLOAT);
  await sleep(400);
  const awakeAtReading = await page.evaluate((fullH) => {
    const up = !document.body.classList.contains('chrome-away');
    const own = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => fullH });
    window.dispatchEvent(new Event('resize'));
    if (own) Object.defineProperty(window, 'innerHeight', own); else delete window.innerHeight;
    return up && typeof window.innerHeight === 'number';
  }, PHONE.height);
  if (!awakeAtReading) bad.push('precondition: the dock was tucked (or innerHeight lost) when the stale size arrived');
  // Live video in the float: decoded frames keep moving over 2 s.
  const inFloat = await page.evaluate(() => new Promise((res) => {
    const v = document.querySelector('.tile.me video');
    const q = () => { try { return v.getVideoPlaybackQuality().totalVideoFrames; } catch (e) { return -1; } };
    const q0 = q();
    setTimeout(() => res({ frames: q() - q0, paused: v.paused }), 2000);
  }));
  if (!(inFloat.frames > 0)) bad.push('the self video stopped painting in the float (' + inFloat.frames + ' frames in 2 s)');
  await size(PHONE);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await sleep(1200);
  steps.float = await check('float and back');
  await page.screenshot({ path: path.join(SHOTS, (bad.length ? 'before' : 'after') + '-phone-pip-return.png') });
  // Calm, then any later activity: the tile is still the solo tile.
  await sleep(4000);
  const calm = await read();
  if (calm.tile[2] < calm.vw * 0.9 || !same(calm.tile, before.tile)) bad.push('calm after the float: tile ' + JSON.stringify(before.tile) + ' -> ' + JSON.stringify(calm.tile));
  steps.again = await check('a tap after the float');
  // Waking the controls never changes a tile (Nathan's rule), also the FIRST
  // wake at a size the controls were never shown at. A page float (full
  // screen, then Home: the whole page shrinks) laid out with the controls
  // up, back with them tucked: the tucked tile, the woken tile and the first
  // tile are the same (Moto g24, Chrome 155: the tile came back 77px lower
  // and jumped up on the first wake).
  const tucked = async () => {
    await page.waitForFunction(() => document.body.classList.contains('chrome-away'), null, { timeout: 8000 }).catch(() => {});
    await sleep(500);
    return read();
  };
  const calm0 = await tucked();
  if (!same(calm0.tile, before.tile)) bad.push('tucking the controls moved the tile ' + JSON.stringify(before.tile) + ' -> ' + JSON.stringify(calm0.tile));
  await wake();
  await size(FLOAT); await sleep(700);
  await tucked(); // the controls tuck inside the float, as on the phone
  await size(PHONE);
  const tuckedBack = await tucked();
  await wake();
  const wokeBack = await read();
  if (!tuckedBack.away) bad.push('precondition: the controls never tucked after the page float');
  if (!same(tuckedBack.tile, before.tile)) bad.push('back from a page float (controls tucked): tile ' + JSON.stringify(before.tile) + ' -> ' + JSON.stringify(tuckedBack.tile));
  if (!same(wokeBack.tile, tuckedBack.tile)) bad.push('the first wake after a page float moved the tile ' + JSON.stringify(tuckedBack.tile) + ' -> ' + JSON.stringify(wokeBack.tile));
  // The height changes while the controls are tucked (full screen, the URL
  // bar): the first wake at the new size keeps every tile.
  const TALL = { width: PHONE.width, height: PHONE.height + 46 };
  await tucked();
  await size(TALL); await sleep(900);
  const tuckedTall = await read();
  await wake();
  const wokeTall = await read();
  if (!same(wokeTall.tile, tuckedTall.tile)) bad.push('the first wake after a tucked size change moved the tile ' + JSON.stringify(tuckedTall.tile) + ' -> ' + JSON.stringify(wokeTall.tile));
  await size(PHONE); await sleep(600);
  steps.wakes = { calm0: calm0.tile, tuckedBack: tuckedBack.tile, wokeBack: wokeBack.tile, tuckedTall: tuckedTall.tile, wokeTall: wokeTall.tile };
  if (errs.length) bad.push('page errors: ' + errs.join(' | '));
  console.log(JSON.stringify({ before, steps, inFloat, calm }));
  await context.close();
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS back from picture in picture the meeting is unchanged');
})().catch((e) => { console.error(e); process.exit(1); });
