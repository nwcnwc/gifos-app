/*
 * A church service puts the hymn's words on the Stage as a shared screen.
 * On a phone the stage is small (about 300x110 on an SE in Safari), and the
 * "🖥 Your screen — on stage" line and the sharer's red Stop sharing were
 * drawn over the slide itself: the line covered its bottom third, the
 * words a viewer is reading, and Stop sharing sat on its title.
 * Now both stand off the picture (beside it when the slide leaves wide bars
 * at its sides, else in a row under it), stay inside the stage and on the
 * screen, show their words whole, and Stop sharing stays a finger's size.
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/share-stage-marks.js
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
    const box = (r) => [r.left, r.top, r.right - r.left, r.bottom - r.top].map(Math.round).join(',');
    const over = (a, b) => a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5 && a.left < b.right - 0.5 && a.right > b.left + 0.5;
    const inside = (a, b) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;
    const out = [];
    const stage = document.querySelector('#stagefeed .rowtile');
    const v = stage && stage.querySelector('video');
    if (!v || !v.videoWidth) return { slide: false, out };
    // The picture itself: the slide letterboxed in the video box.
    const a = v.videoWidth / v.videoHeight, vr = v.getBoundingClientRect();
    let w = vr.width, h = w / a;
    if (h > vr.height) { h = vr.height; w = h * a; }
    const left = vr.left + (vr.width - w) / 2, top = vr.top + (vr.height - h) / 2;
    const slide = { left, top, right: left + w, bottom: top + h };
    const sr = stage.getBoundingClientRect();
    const scr = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const marks = [['the share label', stage.querySelector('.rlabel')], ['Stop sharing', stage.querySelector('.stagestop')]];
    for (const [what, el] of marks) {
      if (!el || !el.getClientRects().length) { out.push(what + ' is missing'); continue; }
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') { out.push(what + ' is hidden'); continue; }
      const r = el.getBoundingClientRect();
      if (over(r, slide)) out.push(what + ' (' + box(r) + ') covers the slide (' + box(slide) + ')');
      if (!inside(r, sr)) out.push(what + ' (' + box(r) + ') leaves the stage (' + box(sr) + ')');
      if (!inside(r, scr)) out.push(what + ' (' + box(r) + ') runs off the screen');
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) out.push(what + ' cuts its words "' + el.textContent.trim() + '"');
      if (what === 'Stop sharing' && (r.height < 30 || r.width < 30)) out.push('Stop sharing is too small to tap (' + box(r) + ')');
      // Its words must read: compare the text colour with whatever paints
      // under it (its own background, else the first thing beneath it).
      const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
      const lum = (c) => { const [r0, g0, b0] = c.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0; };
      let bg = rgb(cs.backgroundColor);
      if (!(bg.length > 3 ? bg[3] > 0.5 : bg.length === 3)) {
        bg = [0, 0, 0];
        for (const e of document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)) {
          if (e === el || el.contains(e)) continue;
          const c = rgb(getComputedStyle(e).backgroundColor);
          if (c.length === 3 || (c.length > 3 && c[3] > 0.5)) { bg = c; break; }
        }
      }
      const l1 = lum(rgb(cs.color)), l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (ratio < 4.5) out.push(what + ' is hard to read: ' + cs.color + ' on rgb(' + bg.slice(0, 3).join(',') + ')');
    }
    // The picture must not shrink to a stamp to make the room.
    if (w < sr.width * 0.4 && h < sr.height * 0.6) out.push('the slide shrank to ' + box(slide) + ' in a stage of ' + box(sr));
    return { slide: true, out, size: Math.round(w) + 'x' + Math.round(h) };
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
  await page.goto(BASE + '/run.html#v=share-marks-' + process.pid + '-' + Date.now() + '-' + tag + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
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
    for (const u of l.out) bad.push(tag + ', ' + phase + ': ' + u);
    console.log(tag + ', ' + phase + ': slide ' + l.size);
    if (phase === 'buttons up') {
      const shot = await page.screenshot();
      fs.writeFileSync(path.join(SHOTS, '__share-stage-marks-' + tag + '.png'), shot);
    }
  }
  const pre = bad.length > was ? 'before' : 'after';
  fs.renameSync(path.join(SHOTS, '__share-stage-marks-' + tag + '.png'), path.join(SHOTS, pre + '-share-stage-marks-' + tag + '.png'));
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
  console.log('PASS on a phone the share label and Stop sharing stand off the slide, whole and on the stage');
})().catch((e) => { console.error(e); process.exit(1); });
