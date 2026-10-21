/*
 * The stadium is one composite. At 10, 100, and 1000 people the page
 * keeps a single #stadwhole, one video, and the same box. The video is
 * shown whole: object-fit contain, left 0, top 0, width 100%, height 100%.
 * Nothing cuts a face out of it, and nothing paints a "+N" seat.
 *
 *   node test/browser/e2e-stadium-whole.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const COUNTS = [10, 100, 1000];

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<style>
  html, body { margin: 0; background: #0d0f14; }
  body.comfy #feed { position: fixed; inset: 0; overflow: hidden; background: #0d0f14; }
</style></head><body class="comfy"><div id="feed"></div>
<script src="/js/meet-layout.js"></script>
<script src="/js/meet-zones.js"></script>
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

// Read in the page. noCutout is true only when the dead nodes are absent,
// and plus is every direct text that still looks like a "+N" seat.
function readStadium() {
  const wholes = [...document.querySelectorAll('#stadwhole')];
  const whole = wholes[0] || null;
  const videos = [...document.querySelectorAll('#feed video')];
  const v = whole ? whole.querySelector('video') : null;
  const plus = [];
  document.querySelectorAll('#feed *').forEach((el) => {
    let direct = '';
    for (let i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === 3) direct += el.childNodes[i].nodeValue || '';
    }
    const t = direct.replace(/\s+/g, ' ').trim();
    if (/\+\d+/.test(t)) plus.push({ tag: el.tagName, id: el.id || '', text: t.slice(0, 40) });
  });
  const px = (s) => {
    const m = /^(\d+(?:\.\d+)?)px$/.exec(s || '');
    return m ? parseFloat(m[1]) : 0;
  };
  return {
    wholes: wholes.length,
    videos: videos.length,
    inWhole: whole ? whole.querySelectorAll('video').length : 0,
    w: whole ? px(whole.style.width) : 0,
    h: whole ? px(whole.style.height) : 0,
    widthStyle: whole ? whole.style.width : '',
    heightStyle: whole ? whole.style.height : '',
    label: whole ? ((whole.querySelector('.name') || {}).textContent || '') : '',
    fit: v ? v.style.objectFit : '',
    left: v ? v.style.left : '',
    top: v ? v.style.top : '',
    vw: v ? v.style.width : '',
    vh: v ? v.style.height : '',
    noCutout: document.querySelectorAll('.stadface, #stadfaces, #stadcrowd').length === 0,
    plus: plus,
  };
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
  const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.GifOS && GifOS.meetViews && GifOS.meetViews.apply));
  const seen = [];
  for (const n of COUNTS) {
    const placed = await page.evaluate((count) => {
      const faces = [];
      for (let i = 0; i < count; i++) {
        const id = 'p' + String(i).padStart(4, '0');
        faces.push({ id: id, name: 'Person ' + i, initials: 'P' + (i % 10), off: false, avatar: '', shade: id, held: false });
      }
      const run = (now) => GifOS.meetViews.apply({
        feed: document.getElementById('feed'), tiles: [], faces: faces, video: null,
        srcW: 160, srcH: 160, cols: 5, cellN: count, cellOf: faces.map(function (_, j) { return j; }),
        holdMs: 2500, floor: 0, vw: 393, vh: 852, phone: true, selfId: 'me',
        pill: false, bottom: 0, holdBottom: 0, top: 0, mode: 'gallery',
        swapSelf: false, self: 'tile', gallery: 'fit', now: now, onSettle: function () {},
      });
      run(1000000);
      const settled = run(1000000 + 3000);
      return { holding: !!(settled && settled.holding), shown: settled && settled.faces ? settled.faces.shown : null };
    }, n);
    const sample = await page.evaluate(readStadium);
    seen.push({ n: n, sample: sample, placed: placed });
    const whole = sample.wholes === 1 && sample.videos === 1 && sample.inWhole === 1;
    const fixed = sample.w > 20 && sample.h > 20;
    const shown = sample.fit === 'contain' && (parseFloat(sample.left) || 0) === 0 && (parseFloat(sample.top) || 0) === 0
      && sample.vw === '100%' && sample.vh === '100%';
    check(n + ' people: one #stadwhole and one video', whole && placed.shown === 1, { sample: sample, placed: placed });
    check(n + ' people: the composite has a fixed box', fixed, { w: sample.w, h: sample.h, widthStyle: sample.widthStyle, heightStyle: sample.heightStyle });
    check(n + ' people: the video is shown whole', shown, { fit: sample.fit, left: sample.left, top: sample.top, vw: sample.vw, vh: sample.vh });
    check(n + ' people: no cut-out stadium face', sample.noCutout === true, sample.noCutout);
    check(n + ' people: no +N seat', sample.plus.length === 0 && sample.label === 'Stadium · ' + n, { plus: sample.plus, label: sample.label });
  }
  const box0 = seen[0] && seen[0].sample;
  const sameBox = seen.every((s) => Math.abs(s.sample.w - box0.w) < 0.5 && Math.abs(s.sample.h - box0.h) < 0.5);
  check('10, 100, and 1000 people share one fixed size', sameBox, seen.map((s) => ({ n: s.n, w: s.sample.w, h: s.sample.h })));
  check('no page error', errors.length === 0, errors.join(' | ') || 'ok');
  await browser.close();
  server.close();
  console.log(failures.length ? '\n' + failures.length + ' FAILED' : '\nALL PASS');
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
