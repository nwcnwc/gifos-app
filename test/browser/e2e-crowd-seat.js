/*
 * Gate: past the face cap, the "+N" stadium seat shows a live decoded
 * frame of the people who did not get their own tile.
 *
 * A 100-person room. The stadium composite is one canvas stream, the same
 * shape the page hands meetViews.apply (comfyStadMeta: one video, cellOf
 * for every face). Cells 0..22 are the faces that fit under FACE_CAP (blue).
 * Cells 23..99 are past the cap (magenta). The "+N" seat must show those
 * magenta pixels from one decoded <video>. A count, a black frame, or a
 * video per hidden face fails.
 *
 *   OUT=/path node test/browser/e2e-crowd-seat.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const OUT = process.env.OUT || '';
const F = 100;
const CAP_FACES = 23; // FACE_CAP 24 counts the "+N" seat, so 23 faces

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<style>
  html, body { margin: 0; background: #0d0f14; }
  body.comfy #feed { position: fixed; inset: 0; overflow: hidden; background: #0d0f14; }
  body.comfy .stadface { overflow: hidden; background: transparent; }
  body.comfy .stadface.cam-off { background: #3b4d78; }
  body.comfy .comfy-off { display: none !important; }
  body.comfy .stadface video { object-fit: cover; object-position: 50% 40%; }
  body.comfy .stadface .avatar {
    position: absolute; inset: 0; z-index: 1; display: flex; align-items: center;
    justify-content: center; color: #fff; font: 800 1.1rem sans-serif;
  }
  body.comfy .stadface .name {
    position: absolute; left: .4rem; bottom: .4rem; z-index: 2; color: #eceef8;
    background: rgba(10,10,15,.72); font: 700 .75rem sans-serif; padding: .12rem .5rem;
  }
</style></head><body class="comfy"><div id="feed"></div>
<script src="/js/meet-layout.js"></script>
<script src="/js/meet-zones.js"></script>
<script src="/js/mesh-media.js"></script>
<script src="/js/meet-views.js"></script>
</body></html>`;

function serve() {
  const types = { '.js': 'text/javascript', '.html': 'text/html' };
  return http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(HARNESS);
      return;
    }
    const rel = url.replace(/^\/+/, '');
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end('missing'); return; }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(buf);
    });
  });
}

// The part of the decoded frame that sits inside the seat, after object-fit
// and the crop shift. An avatar painted over the video is counted apart.
function sampleSeat() {
  const el = document.getElementById('stadcrowd');
  const faces = [...document.querySelectorAll('#stadfaces .stadface')].filter((e) => e.style.display !== 'none' && !e.classList.contains('comfy-off'));
  const videos = [...document.querySelectorAll('#feed video')];
  const base = {
    faces: faces.length,
    videos: videos.length,
    bound: videos.filter((v) => v.srcObject).length,
    faceCap: (window.GifOS && GifOS.meetViews && GifOS.meetViews.FACE_CAP) || null,
  };
  if (!el) return Object.assign(base, { seat: false });
  const v = el.querySelector('video');
  const av = el.querySelector('.avatar');
  const er = el.getBoundingClientRect();
  const seat = {
    w: Math.round(er.width), h: Math.round(er.height),
    text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    camOff: el.classList.contains('cam-off'),
    comfy: el.dataset.comfy || '',
    video: !!v,
    decoded: !!(v && v.videoWidth > 0 && v.videoHeight > 0),
    videoW: v ? v.videoWidth : 0,
    videoH: v ? v.videoHeight : 0,
    opacity: v ? parseFloat(getComputedStyle(v).opacity || '1') : 0,
    avatar: !!(av && getComputedStyle(av).display !== 'none' && av.offsetWidth > 8),
  };
  if (!v || !(v.videoWidth > 0) || !(er.width > 8) || !(er.height > 8)) {
    return Object.assign(base, { seat: seat, magFrac: 0, blueFrac: 0, samples: 0 });
  }
  const vr = v.getBoundingClientRect();
  const x0 = Math.max(er.left, vr.left), y0 = Math.max(er.top, vr.top);
  const x1 = Math.min(er.right, vr.right), y1 = Math.min(er.bottom, vr.bottom);
  if (x1 - x0 < 4 || y1 - y0 < 4) return Object.assign(base, { seat: seat, magFrac: 0, blueFrac: 0, samples: 0, clipped: true });
  const fit = getComputedStyle(v).objectFit || 'fill';
  const pos = (getComputedStyle(v).objectPosition || '50% 50%').split(/\s+/);
  const px = pos[0] && pos[0].endsWith('%') ? parseFloat(pos[0]) / 100 : 0.5;
  const py = pos[1] && pos[1].endsWith('%') ? parseFloat(pos[1]) / 100 : 0.5;
  let sx, sy, sw, sh;
  if (fit === 'fill') {
    sx = (x0 - vr.left) / vr.width * v.videoWidth;
    sy = (y0 - vr.top) / vr.height * v.videoHeight;
    sw = (x1 - x0) / vr.width * v.videoWidth;
    sh = (y1 - y0) / vr.height * v.videoHeight;
  } else {
    const scale = fit === 'contain'
      ? Math.min(vr.width / v.videoWidth, vr.height / v.videoHeight)
      : Math.max(vr.width / v.videoWidth, vr.height / v.videoHeight);
    const dispW = v.videoWidth * scale, dispH = v.videoHeight * scale;
    const ox = vr.left + (vr.width - dispW) * px;
    const oy = vr.top + (vr.height - dispH) * py;
    sx = (x0 - ox) / scale; sy = (y0 - oy) / scale;
    sw = (x1 - x0) / scale; sh = (y1 - y0) / scale;
  }
  sx = Math.max(0, sx); sy = Math.max(0, sy);
  sw = Math.min(v.videoWidth - sx, sw); sh = Math.min(v.videoHeight - sy, sh);
  const c = document.createElement('canvas');
  const dw = 48, dh = 48;
  c.width = dw; c.height = dh;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(v, sx, sy, Math.max(1, sw), Math.max(1, sh), 0, 0, dw, dh);
  const data = g.getImageData(0, 0, dw, dh).data;
  let mag = 0, blue = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], gg = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 16) continue;
    n++;
    if (r > 160 && b > 100 && gg < 90 && r > gg + 80 && b > gg + 40) mag++;
    else if (b > 150 && r < 90 && gg < 120 && b > r + 60) blue++;
  }
  return Object.assign(base, {
    seat: seat, magFrac: n ? mag / n : 0, blueFrac: n ? blue / n : 0, samples: n,
    src: { sx: Math.round(sx), sy: Math.round(sy), sw: Math.round(sw), sh: Math.round(sh), fit: fit },
  });
}

(async () => {
  const failures = [];
  const check = (name, ok, detail) => {
    console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (detail !== undefined ? '  ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''));
    if (!ok) failures.push(name);
  };
  const server = serve();
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port + '/';
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.GifOS && GifOS.meetViews && GifOS.meetViews.apply && GifOS.meshMedia && GifOS.meshMedia.stadiumGrid));
  const built = await page.evaluate(async (F) => {
    const MM = GifOS.meshMedia;
    const g = MM.stadiumGrid(F);
    const cols = g.cols;
    const rows = Math.ceil(F / cols);
    const cell = 32;
    const cv = document.createElement('canvas');
    cv.width = cols * cell;
    cv.height = rows * cell;
    const paint = () => {
      const ctx = cv.getContext('2d');
      for (let i = 0; i < F; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        ctx.fillStyle = i < 23 ? 'rgb(20,40,220)' : 'rgb(230,30,170)';
        ctx.fillRect(col * cell, row * cell, cell, cell);
      }
    };
    paint();
    const stream = cv.captureStream(8);
    paint();
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    try { await video.play(); } catch (e) {}
    const faces = [];
    for (let i = 0; i < F; i++) {
      const id = 'p' + String(i).padStart(4, '0');
      faces.push({ id: id, name: 'Person ' + i, initials: 'P' + (i % 10), off: false, avatar: '', shade: id, held: false });
    }
    const cellOf = faces.map((f, j) => j);
    const run = (now) => GifOS.meetViews.apply({
      feed: document.getElementById('feed'), tiles: [], faces: faces, video: video,
      srcW: cv.width, srcH: cv.height, cols: cols, cellN: F, cellOf: cellOf,
      holdMs: 2500, floor: 0, vw: 393, vh: 852, phone: true, selfId: 'me',
      pill: false, bottom: 0, holdBottom: 0, top: 0, mode: 'gallery',
      swapSelf: false, self: 'tile', gallery: 'fit', now: now, onSettle: function () {},
    });
    // The settle hold starts on the first pass. A second pass after it
    // is the steady room: faces have their cuts, and the "+N" seat must too.
    const first = run(1000000);
    const settled = run(1000000 + 3000);
    return {
      cols: cols, rows: rows, canvas: { w: cv.width, h: cv.height },
      srcDecoded: video.videoWidth > 0 && video.videoHeight > 0,
      firstOver: first && first.faces, settledOver: settled && settled.faces,
      holding: settled && settled.holding,
    };
  }, F);
  let sample = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 2500) {
    sample = await page.evaluate(sampleSeat);
    if (sample && sample.seat && sample.seat.decoded && sample.samples > 0) break;
    if (sample && sample.seat && !sample.seat.video) break;
    await page.waitForTimeout(80);
  }
  if (!sample) sample = await page.evaluate(sampleSeat);
  if (OUT) fs.mkdirSync(OUT, { recursive: true });
  const shot = async (sel, name) => {
    if (!OUT) return;
    const loc = page.locator(sel);
    if (await loc.count()) {
      try { await loc.screenshot({ path: path.join(OUT, name) }); } catch (e) { fs.writeFileSync(path.join(OUT, name + '.err'), String(e)); }
    }
  };
  await shot('#stadcrowd', 'crowd.png');
  await shot('#feed', 'feed.png');
  check('no page error', errors.length === 0, errors.join(' | ') || 'ok');
  check('100-person composite decoded', built.srcDecoded === true, built);
  check('the cap leaves 23 faces and the rest on the "+N" seat', built.settledOver && built.settledOver.shown === CAP_FACES && built.settledOver.over === F - CAP_FACES && built.settledOver.all === F, built.settledOver);
  check('hold has settled', built.holding === false, built.holding);
  const seat = sample.seat || {};
  check('"+N" seat is on screen', !!sample.seat && seat.w > 20 && seat.h > 20 && seat.comfy === '1', seat);
  check('"+N" seat has one decoded video, not a count', seat.video === true && seat.decoded === true && seat.opacity > 0.5 && seat.avatar !== true, seat);
  check('that frame shows the people past the cap', sample.magFrac >= 0.12 && sample.blueFrac < 0.5 && sample.samples > 100, { magFrac: sample.magFrac, blueFrac: sample.blueFrac, samples: sample.samples, src: sample.src });
  check('one crowd video, not a video per hidden face', sample.videos === CAP_FACES + 1 && sample.videos < 40, { videos: sample.videos, bound: sample.bound, faces: sample.faces });
  const report = { base: base, built: built, sample: sample, errors: errors, failures: failures };
  console.log(JSON.stringify(report));
  if (OUT) fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
  console.log(failures.length ? '\n' + failures.length + ' FAILED' : '\nALL PASS');
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
