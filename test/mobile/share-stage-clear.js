/*
 * A church service puts the hymn's words on the Stage as a shared screen.
 * On a phone the room header (GifOS + room name), Fit and Unmute stay
 * pinned to the top of the call. While a screen is shared, the faces' page
 * drops the gallery layout and starts at the top of the screen, so the
 * header and Fit covered the top of the slide, the sharer's own
 * "Stop sharing" button, and (with no picture yet) the faces' strip.
 * Now the shared screen and the faces start below the header band, and
 * nothing of them sits under the header, Fit, Unmute, the dock or the
 * Record row.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/share-stage-clear.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
const NAMES = ['Pastor Dave', 'Ruth', 'Margaret Johnson', 'Lobby iPad', 'Grace', 'Tom & Linda Ruiz'];
// SE in Safari: the page is 320x460 once Safari's bars take their part.
const VIEWS = [['iPhone SE', 'iphone-se'], ['iPhone SE', 'iphone-se-safari', { width: 320, height: 460 }],
  ['iPhone 12', 'iphone-12'], ['Pixel 5', 'pixel-5'],
  ['iPhone SE landscape', 'iphone-se-land'], ['Pixel 5 landscape', 'pixel-5-land']];

function look(page) {
  return page.evaluate(() => {
    const seen = (el) => {
      if (!el || !el.getClientRects().length) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity <= 0.2) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 8 && r.height >= 8 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    };
    const box = (r) => [r.left, r.top, r.right - r.left, r.bottom - r.top].map(Math.round).join(',');
    const over = (a, b) => a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5 && a.left < b.right - 0.5 && a.right > b.left + 0.5;
    const pinned = [];
    const pin = (what, el) => { if (seen(el)) pinned.push([what, el.getBoundingClientRect()]); };
    pin('the room header', document.querySelector('.topchip'));
    pin('Fit', document.getElementById('fitbtn'));
    pin('Unmute', document.getElementById('unmute'));
    pin('Camera', document.getElementById('showcam'));
    if (!document.body.classList.contains('chrome-away')) {
      pin('the dock', document.querySelector('.bar'));
      pin('the Record row', document.getElementById('callstate'));
    }
    const parts = [];
    const stage = document.querySelector('#stagefeed .rowtile');
    if (stage && seen(stage)) {
      // The picture itself: a 16:9 slide letterboxed in the stage.
      const v = stage.querySelector('video');
      const sr = stage.getBoundingClientRect();
      if (v && v.videoWidth > 0) {
        const a = v.videoWidth / v.videoHeight, vr = v.getBoundingClientRect();
        let w = vr.width, h = w / a;
        if (h > vr.height) { h = vr.height; w = h * a; }
        const left = vr.left + (vr.width - w) / 2, top = vr.top + (vr.height - h) / 2;
        parts.push(['the shared slide', { left, top, right: left + w, bottom: top + h }]);
      } else parts.push(['the stage', sr]);
    }
    const stop = document.querySelector('#stagefeed .stagestop');
    if (stop && seen(stop)) parts.push(['Stop sharing', stop.getBoundingClientRect()]);
    const lbl = document.querySelector('#stagefeed .rlabel');
    if (lbl && seen(lbl)) parts.push(['the share label', lbl.getBoundingClientRect()]);
    // The strip scrolls sideways; only the faces on screen count.
    document.querySelectorAll('#grid .tile').forEach((t) => {
      if (!seen(t)) return;
      const r = t.getBoundingClientRect();
      if (r.right <= 0 || r.left >= innerWidth) return;
      parts.push(['the face of ' + ((t.querySelector('.name') || {}).textContent || '?').trim(), r]);
    });
    const under = [];
    for (const [what, r] of parts) {
      if (r.bottom > innerHeight + 0.5 || r.top < -0.5) under.push(what + ' (' + box(r) + ') runs off the screen');
      for (const [pw, pr] of pinned) if (over(r, pr)) under.push(pw + ' (' + box(pr) + ') covers ' + what + ' (' + box(r) + ')');
    }
    return { stage: !!stage, slide: parts.some((p) => p[0] === 'the shared slide'), under, body: document.body.className };
  });
}

async function run(browser, dev, tag, vp, bad) {
  const was = bad.length;
  const opts = Object.assign({}, devices[dev], { hasTouch: true, serviceWorkers: 'block' });
  if (vp) opts.viewport = vp;
  const context = await browser.newContext(opts);
  await context.addInitScript(() => {
    try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {}
    // The hymn slide stands in for the shared window.
    navigator.mediaDevices.getDisplayMedia = async () => {
      const c = document.createElement('canvas');
      c.width = 1280; c.height = 720;
      const x = c.getContext('2d');
      const draw = () => {
        x.fillStyle = '#20304a'; x.fillRect(0, 0, 1280, 720);
        x.fillStyle = '#ffd23c'; x.fillRect(0, 0, 1280, 120);
        x.fillStyle = '#10141c'; x.font = '700 80px sans-serif'; x.textAlign = 'center';
        x.fillText('Hymn 245', 640, 90);
        x.fillStyle = '#fff'; x.font = '60px sans-serif';
        x.fillText('Amazing grace, how sweet the sound', 640, 380);
      };
      draw();
      setInterval(draw, 250);
      return c.captureStream(4);
    };
  });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=share-stage-' + process.pid + '-' + Date.now() + '-' + tag + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.tap().catch(() => {});
  const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), NAMES);
  if (!seeded || !seeded.ok) { bad.push(tag + ': could not seat the guests'); await context.close(); return; }
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__gifosVideo.startScreenShareForTest());
  const up = await page.waitForFunction(() => {
    const v = document.querySelector('#stagefeed .rowtile video');
    return document.body.classList.contains('screen-on') && v && v.videoWidth > 0;
  }, null, { timeout: 15000 }).then(() => true, () => false);
  if (!up) { bad.push(tag + ': the shared screen never reached the stage'); await context.close(); return; }
  // Buttons up (any key brings them back), then tucked away as on a quiet call.
  for (const phase of ['buttons up', 'buttons away']) {
    if (phase === 'buttons away') await page.evaluate(() => window.__gifosChrome.idle());
    else await page.keyboard.press('Shift');
    await page.waitForTimeout(1500);
    const l = await look(page);
    if (!l.slide) bad.push(tag + ', ' + phase + ': no slide on the stage');
    for (const u of l.under) bad.push(tag + ', ' + phase + ': ' + u);
    if (phase === 'buttons up') {
      const shot = await page.screenshot();
      fs.writeFileSync(path.join(SHOTS, '__share-stage-clear-' + tag + '.png'), shot);
    }
  }
  const pre = bad.length > was ? 'before' : 'after';
  fs.renameSync(path.join(SHOTS, '__share-stage-clear-' + tag + '.png'), path.join(SHOTS, pre + '-share-stage-clear-' + tag + '.png'));
  await context.close();
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const bad = [];
  for (const [dev, tag, vp] of VIEWS) await run(browser, dev, tag, vp, bad);
  await browser.close();
  if (bad.length) {
    console.error('FAIL ' + bad.join('; '));
    process.exit(1);
  }
  console.log('PASS a shared slide, Stop sharing and the faces sit clear of the header, Fit, Unmute and the dock');
})().catch((e) => { console.error(e); process.exit(1); });
