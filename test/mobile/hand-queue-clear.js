/*
 * A church service on phones: Margaret Johnson raises her hand to read the
 * lesson, so the room's hand queue says "✋ 1 waiting: Margaret Johnson".
 * That line sat in page flow at the very top. In the gallery the call's
 * fixed faces box painted over it, so nobody saw the queue at all; during
 * a screen share it showed through under the room-name chip, its words run
 * over "GifOS" and the room name (an SE in Safari).
 * Here, in the gallery and while a guest shares the hymn: the queue (or a
 * button for it) shows on screen, nothing covers it, it covers none of the
 * call's pinned chrome (room name, Fit, the build name, the stage, faces),
 * and the full line with the names reads whole, on screen, with nothing
 * over it (after one tap if the screen only has room for a button).
 *
 * Gate: NODE_PATH=/home/nathan/gifos-swarm/node_modules node test/mobile/hand-queue-clear.js
 */
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const BASE = process.env.MEET_BASE || 'http://127.0.0.1:8765';
const SHOTS = path.join(__dirname, '..', '..', 'qa', 'mobile', 'shots');
// The third seat (Margaret Johnson) gets her hand up on the first seed.
const NAMES = ['Pastor Dave', 'Ruth', 'Margaret Johnson', 'Lobby iPad', 'Grace', 'Tom & Linda Ruiz'];
const VIEWS = [['iPhone SE', 'iphone-se'], ['iPhone SE', 'iphone-se-safari', { width: 320, height: 460 }],
  ['iPhone 12', 'iphone-12'], ['Pixel 5', 'pixel-5'],
  ['iPhone SE landscape', 'iphone-se-land'], ['Pixel 5 landscape', 'pixel-5-land'],
  [null, 'desktop']];

// Where the queue shows: the full line if it is on screen, else the button
// that stands for it. Each is judged by what paints on top of it.
function look(page) {
  return page.evaluate(() => {
    const box = (r) => [r.left, r.top, r.width, r.height].map(Math.round).join(',');
    const over = (a, b) => a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5 && a.left < b.right - 0.5 && a.right > b.left + 0.5;
    const seen = (el) => {
      if (!el || !el.getClientRects().length) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.2) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    // Anything else painting on top, sampled across the element's middle row.
    const coveredBy = (el) => {
      const r = el.getBoundingClientRect();
      for (const fx of [0.1, 0.5, 0.9]) {
        const x = r.left + r.width * fx, y = r.top + r.height / 2;
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return 'the screen edge';
        const top = document.elementFromPoint(x, y);
        if (top && top !== el && !el.contains(top)) return (top.id ? '#' + top.id : top.className ? '.' + String(top.className).split(' ')[0] : top.tagName) + ' at ' + Math.round(x) + ',' + Math.round(y);
      }
      return '';
    };
    const chrome = [];
    const add = (what, el) => { if (seen(el)) chrome.push([what, el]); };
    add('the GifOS link', document.querySelector('.topchip a.title'));
    add('the room name', document.querySelector('.topchip .statustext'));
    add('the people count', document.getElementById('statuscount'));
    add('Fit', document.getElementById('fitbtn'));
    add('Unmute', document.getElementById('unmute'));
    add('Camera', document.getElementById('showcam'));
    add('the build name', document.getElementById('gifos-build-float'));
    add('the stage', document.querySelector('#stagefeed .rowtile'));
    document.querySelectorAll('#feed #grid .tile').forEach((t) => add('the face of ' + ((t.querySelector('.name') || {}).textContent || '?').trim(), t));
    const line = document.getElementById('handq');
    const btn = document.getElementById('hdrhand');
    const out = [];
    const check = (what, el) => {
      const r = el.getBoundingClientRect();
      const c = coveredBy(el);
      if (c) out.push(what + ' (' + box(r) + ') is covered by ' + c);
      for (const [cw, ce] of chrome) {
        if (ce === el || ce.contains(el) || el.contains(ce)) continue;
        // A face under an open popover is fine; a face under a resting line is not.
        if (el === line && line.classList.contains('open') && cw.indexOf('the face of') === 0) continue;
        if (el === line && line.classList.contains('open') && cw === 'the stage') continue;
        const cr = ce.getBoundingClientRect();
        // A desktop share's stage starts under the whole header (its own
        // layout); a button in that header is no worse than the header.
        const link = document.querySelector('.topchip a.title');
        if (el.closest('.topchip') && cw === 'the stage' && link && over(link.getBoundingClientRect(), cr)) continue;
        if (over(r, cr)) out.push(what + ' (' + box(r) + ') runs over ' + cw + ' (' + box(cr) + ')');
      }
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) out.push(what + ' cuts its words "' + el.textContent.trim() + '"');
      // Every run of words must read on what is under it (4.5:1).
      const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
      const lum = (c) => { const [r0, g0, b0] = c.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0; };
      const solid = (c) => c.length === 3 || (c.length > 3 && c[3] > 0.5);
      for (const t of [el, ...el.querySelectorAll('*')]) {
        if (!t.childNodes.length || ![...t.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        let bg = null;
        for (let a = t; a && !bg; a = a.parentElement) { const c = rgb(getComputedStyle(a).backgroundColor); if (solid(c)) bg = c; }
        if (!bg) bg = [12, 14, 18];
        const l1 = lum(rgb(getComputedStyle(t).color)), l2 = lum(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (ratio < 4.5) out.push(what + ' is hard to read: "' + t.textContent.trim().slice(0, 30) + '" ' + getComputedStyle(t).color + ' on rgb(' + bg.slice(0, 3).join(',') + ')');
      }
      return r;
    };
    const lineSeen = seen(line) && !coveredBy(line);
    const res = { out, said: line.textContent.trim(), line: seen(line) ? box(line.getBoundingClientRect()) : '', btn: '', open: line.classList.contains('open') };
    if (lineSeen) check('the hand line', line);
    else if (seen(btn)) {
      check('the hand button', btn);
      res.btn = box(btn.getBoundingClientRect());
      res.btnSays = btn.textContent.trim();
      if (btn.textContent.indexOf('1') === -1) out.push('the hand button says "' + btn.textContent.trim() + '", not how many wait');
      const br = btn.getBoundingClientRect();
      if (br.width < 44 || br.height < 40) out.push('the hand button is too small to tap (' + box(br) + ')');
    } else if (seen(line)) {
      check('the hand line', line);
    } else out.push('nothing on screen says a hand is up');
    return res;
  });
}

async function run(browser, dev, tag, vp, bad) {
  const was = bad.length;
  const opts = dev ? Object.assign({}, devices[dev], { hasTouch: true }) : { viewport: { width: 1280, height: 720 } };
  opts.serviceWorkers = 'block';
  if (vp) opts.viewport = vp;
  const context = await browser.newContext(opts);
  await context.addInitScript(() => {
    try { localStorage.setItem('gifos_name', 'Nathan'); } catch (e) {}
  });
  const page = await context.newPage();
  await page.goto(BASE + '/run.html#v=hand-queue-' + process.pid + '-' + Date.now() + '-' + tag + '&debug=on', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#bartoggle', { timeout: 15000 });
  const skip = page.locator('#nmok');
  if (await skip.count()) await skip.click().catch(() => {});
  const seeded = await page.evaluate((a) => window.__gifosVideo.seedGalleryForTest({ count: a.length, names: a }), NAMES);
  if (!seeded || !seeded.ok) { bad.push(tag + ': could not seat the guests'); await context.close(); return; }
  const queued = await page.waitForFunction(() => /Margaret Johnson/.test(document.getElementById('handq').textContent), null, { timeout: 15000 }).then(() => true, () => false);
  if (!queued) { bad.push(tag + ': Margaret Johnson never reached the hand queue'); await context.close(); return; }
  for (const phase of ['gallery', 'share']) {
    if (phase === 'share') {
      const ok = await page.evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 1280; c.height = 720;
        const x = c.getContext('2d');
        const draw = () => {
          x.fillStyle = '#20304a'; x.fillRect(0, 0, 1280, 720);
          x.fillStyle = '#ffd23c'; x.fillRect(0, 0, 1280, 120);
          x.fillStyle = '#10141c'; x.font = '700 80px sans-serif'; x.textAlign = 'center';
          x.fillText('Hymn 245', 640, 90);
        };
        draw();
        window.__qaDraw = setInterval(draw, 250);
        return window.__gifosVideo.remoteShareForTest(['qa6'], c.captureStream(4));
      });
      if (!ok) { bad.push(tag + ': the debug build has no remote share hook'); break; }
      const up = await page.waitForFunction(() => {
        const v = document.querySelector('#stagefeed .rowtile video');
        return document.body.classList.contains('screen-on') && v && v.videoWidth > 0;
      }, null, { timeout: 15000 }).then(() => true, () => false);
      if (!up) { bad.push(tag + ': the shared screen never reached the stage'); continue; }
      // "Reaching the meeting…" over the stage is the room not yet reached.
      const seated = await page.waitForFunction(() => !document.getElementById('joinveil'), null, { timeout: 15000 }).then(() => true, () => false);
      if (!seated) { bad.push(tag + ': never reached the meeting'); continue; }
    }
    await page.keyboard.press('Shift');
    await page.waitForTimeout(1500);
    const where = tag + ', ' + phase;
    const l = await look(page);
    for (const u of l.out) bad.push(where + ': ' + u);
    console.log(where + ': line ' + (l.line || '-') + ' button ' + (l.btn || '-') + ' "' + (l.btnSays || l.said) + '"');
    fs.writeFileSync(path.join(SHOTS, '__hand-queue-clear-' + tag + '-' + phase + '.png'), await page.screenshot());
    // Only a button: one tap must show the whole line with the names, and
    // a second tap puts it away.
    if (l.btn && !l.out.length) {
      if (dev) await page.locator('#hdrhand').tap();
      else await page.locator('#hdrhand').click();
      await page.waitForTimeout(500);
      const o = await look(page);
      if (!o.open || !o.line) bad.push(where + ': a tap on the hand button does not show the line');
      for (const u of o.out) bad.push(where + ', opened: ' + u);
      if (!/1 hand up: Margaret Johnson/.test(o.said)) // the hand line says hands up, not waiting (desktop hand-queue.spec)
        bad.push(where + ', opened: the line says "' + o.said + '"');
      console.log(where + ', opened: line ' + o.line + ' "' + o.said + '"');
      fs.writeFileSync(path.join(SHOTS, '__hand-queue-clear-' + tag + '-' + phase + '-open.png'), await page.screenshot());
      if (dev) await page.locator('#hdrhand').tap();
      else await page.locator('#hdrhand').click();
      await page.waitForTimeout(400);
      if (await page.evaluate(() => document.getElementById('handq').classList.contains('open'))) bad.push(where + ': a second tap leaves the line open');
    }
  }
  await page.evaluate(() => { clearInterval(window.__qaDraw); window.__gifosVideo.remoteShareForTest([], null); }).catch(() => {});
  const pre = bad.length > was ? 'before' : 'after';
  for (const f of fs.readdirSync(SHOTS)) {
    if (f.indexOf('__hand-queue-clear-' + tag + '-') === 0) fs.renameSync(path.join(SHOTS, f), path.join(SHOTS, pre + '-' + f.slice(2)));
  }
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
  console.log('PASS the hand queue shows on screen, clear of the header and faces, and its names read whole');
})().catch((e) => { console.error(e); process.exit(1); });
