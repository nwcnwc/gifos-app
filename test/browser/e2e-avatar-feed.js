/*
 * The avatar rides the video track.
 *
 * With the camera off, the picture on a tile is the avatar painted into
 * that tile's <video>, and blur covers those pixels the same way it covers
 * a camera. A letter drawn in a separate overlay stays sharp while the
 * blur class sits on a hidden video. This gate fails on that overlay.
 *
 * Self-view bakes the blur into the frames (the camera path's rule: the
 * me tile shows the pixels that leave the browser). A per-person blur and
 * blur-all put the same CSS filter on the remote video as a camera tile.
 *
 * Gate: NODE_PATH=/tmp/bc-pw/node_modules node test/browser/e2e-avatar-feed.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..', '..');
const PORT = Number(process.env.AV_PORT || 8768);

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
  return http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = (url === '/' ? '/index.html' : url).replace(/^\/+/, '');
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end('missing'); return; }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
}

function fail(list, msg) { list.push(msg); }

const PROBE = `(sel) => {
  const tile = document.querySelector(sel);
  if (!tile) return { missing: true, sel };
  const avatar = tile.querySelector('.avatar');
  const video = tile.querySelector('video');
  const veil = document.getElementById('joinveil');
  if (veil) veil.style.display = 'none';
  tile.scrollIntoView({ block: 'center', inline: 'center' });
  const rect = tile.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const stack = document.elementsFromPoint(x, y);
  const top = stack.find((el) => tile.contains(el)) || null;
  const track = video && video.srcObject && video.srcObject.getVideoTracks()[0];
  const vs = video ? getComputedStyle(video) : null;
  const as = avatar ? getComputedStyle(avatar) : null;
  let frame = null;
  if (video && video.videoWidth > 0) {
    const w = 160, h = 90;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    let edge = 0, hard = 0;
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w - 1; col++) {
        const i = (row * w + col) * 4;
        const j = i + 4;
        const step = Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);
        edge += step;
        if (step > 30) hard++;
      }
    }
    frame = { edge, hard, corner: [d[0], d[1], d[2]], vw: video.videoWidth, vh: video.videoHeight };
  }
  const refOf = (cls) => {
    const v = document.createElement('video');
    v.className = cls;
    tile.appendChild(v);
    const f = getComputedStyle(v).filter;
    v.remove();
    return f;
  };
  return {
    sel,
    avatarDisplay: as ? as.display : 'missing',
    avatarFilter: as ? as.filter : 'missing',
    videoVisibility: vs ? vs.visibility : 'missing',
    videoFilter: vs ? vs.filter : 'missing',
    blurClass: video ? (video.classList.contains('blur2') ? 2 : video.classList.contains('blur1') ? 1 : 0) : -1,
    ref1: refOf('blur1'),
    ref2: refOf('blur2'),
    hit: top ? (top.classList.contains('avatar') ? 'avatar' : top.tagName) : 'none',
    trackLive: !!(track && track.readyState === 'live'),
    trackEnabled: !!(track && track.enabled),
    frame,
    camOff: !!(window.__gifosVideo && window.__gifosVideo.camOff && window.__gifosVideo.camOff()),
    outbound: window.__gifosVideo && window.__gifosVideo.outboundKind ? window.__gifosVideo.outboundKind() : 'missing',
  };
}`;

(async () => {
  const server = serve();
  await new Promise((res) => server.listen(PORT, '127.0.0.1', res));
  const base = 'http://127.0.0.1:' + PORT;
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const bad = [];

  const mintCtx = await browser.newContext();
  const mintPage = await mintCtx.newPage();
  await mintPage.goto(base + '/run.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await mintPage.waitForFunction(() => window.GifOS && GifOS.net && GifOS.net.randHex, { timeout: 20000 });
  const minted = await mintPage.evaluate(async () => {
    const seed = GifOS.net.randHex(32);
    const k = await GifOS.net.edKeysFromSeedHex(seed);
    return { seed, av: k.verifier };
  });
  await mintCtx.close();

  const room = 'avatarfeed';
  const hash = '#v=' + room + '&av=' + minted.av;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((arg) => {
    try {
      localStorage.setItem('gifos_name', 'Ada'); sessionStorage.setItem('gifos_appear_ok', '1');
      localStorage.setItem('gifos_vadm_' + arg.room + '.' + arg.av, arg.seed);
    } catch (e) {}
  }, { room, av: minted.av, seed: minted.seed });
  const page = await ctx.newPage();
  await page.goto(base + '/run.html' + hash, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('.tile.me', { timeout: 20000, state: 'attached' });
  await page.waitForFunction(() => document.body.classList.contains('amadmin'), { timeout: 20000 }).catch(() => {});

  const me = await page.evaluate(async (body) => {
    const probe = eval(body);
    const deadline = Date.now() + 2500;
    let snap = probe('.tile.me');
    while (Date.now() < deadline) {
      if (snap.hit === 'avatar' || snap.avatarDisplay === 'flex' || snap.videoVisibility === 'hidden') break;
      await new Promise((r) => setTimeout(r, 100));
      snap = probe('.tile.me');
    }
    return snap;
  }, PROBE);

  if (me.missing) fail(bad, 'me tile missing');
  else {
    if (me.hit !== 'VIDEO') fail(bad, 'camera-off me tile shows ' + me.hit + ' on top of the video');
    if (me.avatarDisplay !== 'none') fail(bad, 'avatar overlay display is ' + me.avatarDisplay);
    if (me.videoVisibility === 'hidden') fail(bad, 'camera-off video is hidden, so blur on it does not cover the picture');
    if (!me.trackLive) fail(bad, 'camera-off me video has no live track');
    if (!me.camOff) fail(bad, 'seat turned the camera on');
    if (me.outbound !== 'blurred') fail(bad, 'camera-off outbound is ' + me.outbound + ' (blur must be baked into the avatar frames)');
    if (me.blurClass !== 0) fail(bad, 'me tile also has a CSS blur class ' + me.blurClass + ' on top of the baked frames');
    if (me.videoFilter && me.videoFilter !== 'none') fail(bad, 'me video filter is ' + me.videoFilter);
    if (!me.frame) fail(bad, 'camera-off me video produced no frame');
    else {
      const [r, g, b] = me.frame.corner;
      if (r > 40 || g > 45 || b > 55) fail(bad, 'me frame corner is ' + r + ',' + g + ',' + b + ' (avatar background is the dark tile)');
      if (me.frame.edge < 80) fail(bad, 'me frame has no avatar mark (edge ' + me.frame.edge + ')');
      if (me.frame.hard > 8) fail(bad, 'me avatar frame still has a sharp rim (hard edges ' + me.frame.hard + ')');
    }
  }

  const seats = await page.evaluate(async (body) => {
    const probe = eval(body);
    const api = window.__gifosVideo;
    if (!api || typeof api.avatarSeatForTest !== 'function') return { missing: true };
    const per = api.avatarSeatForTest({ id: 'bea_avatar', name: 'Bea', blur: 2, perTileBlur: true, useWire: true });
    const all = api.avatarSeatForTest({ id: 'cid_avatar', name: 'Cid', blur: 0, blurAll: true });
    const deadline = Date.now() + 2500;
    let bea = probe('.tile[data-peer="bea_avatar"]');
    let cid = probe('.tile[data-peer="cid_avatar"]');
    while (Date.now() < deadline) {
      if (bea.frame && cid.frame && bea.hit === 'VIDEO' && cid.hit === 'VIDEO') break;
      await new Promise((r) => setTimeout(r, 100));
      bea = probe('.tile[data-peer="bea_avatar"]');
      cid = probe('.tile[data-peer="cid_avatar"]');
    }
    return { per, all, bea, cid };
  }, PROBE);

  if (seats.missing) fail(bad, 'per-tile and blur-all seats cannot be painted (avatarSeatForTest missing)');
  else {
    const checkRemote = (label, snap, wantClass, refKey) => {
      if (!snap || snap.missing) { fail(bad, label + ' tile missing'); return; }
      if (snap.hit !== 'VIDEO') fail(bad, label + ' shows ' + snap.hit + ' on top of the video');
      if (snap.avatarDisplay !== 'none') fail(bad, label + ' avatar overlay display is ' + snap.avatarDisplay);
      if (snap.videoVisibility === 'hidden') fail(bad, label + ' video is hidden');
      if (!snap.trackLive) fail(bad, label + ' video has no live avatar track');
      if (snap.blurClass !== wantClass) fail(bad, label + ' blur class ' + snap.blurClass + ' (want ' + wantClass + ')');
      const wantFilter = snap[refKey];
      if (snap.videoFilter !== wantFilter) fail(bad, label + ' filter ' + snap.videoFilter + ' (camera tile filter ' + wantFilter + ')');
      if (snap.avatarFilter && snap.avatarFilter !== 'none') fail(bad, label + ' overlay carries the blur');
      if (!snap.frame) fail(bad, label + ' video produced no avatar frame');
      else {
        const [r, g, b] = snap.frame.corner;
        if (r > 40 || g > 45 || b > 55) fail(bad, label + ' frame corner is ' + r + ',' + g + ',' + b);
        if (snap.frame.hard < 40) fail(bad, label + ' frame has no avatar mark under the blur (hard edges ' + snap.frame.hard + ')');
      }
    };
    if (!seats.per || seats.per.blur !== 2 || !seats.per.blocked) fail(bad, 'per-tile blur level is ' + (seats.per && seats.per.blur) + ' blocked ' + (seats.per && seats.per.blocked));
    if (!seats.all || seats.all.blur !== 1 || !seats.all.blocked) fail(bad, 'blur-all level is ' + (seats.all && seats.all.blur) + ' blocked ' + (seats.all && seats.all.blocked));
    checkRemote('per-tile blur', seats.bea, 2, 'ref2');
    checkRemote('blur-all', seats.cid, 1, 'ref1');
  }

  const viewer = await (async () => {
    const vctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await vctx.addInitScript(() => { try { localStorage.setItem('gifos_name', 'Ada'); sessionStorage.setItem('gifos_appear_ok', '1'); } catch (e) {} });
    const vp = await vctx.newPage();
    await vp.goto(base + '/run.html' + hash + '&bc=1', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await vp.waitForSelector('.tile.me', { timeout: 20000, state: 'attached' });
    await vp.waitForTimeout(400);
    const snap = await vp.evaluate(() => {
      const api = window.__gifosVideo;
      const probe = api && api.broadcastProbe ? api.broadcastProbe() : { missing: true };
      const video = document.querySelector('.tile.me video');
      const track = video && video.srcObject && video.srcObject.getVideoTracks()[0];
      return {
        probe,
        localTrack: !!(track && track.readyState === 'live'),
      };
    });
    await vctx.close();
    return snap;
  })();
  if (viewer.probe && viewer.probe.missing) fail(bad, 'broadcast viewer probe missing');
  else if (viewer.probe) {
    const publishing = (viewer.probe.tracks || []).some((t) => t.kind === 'video' && t.state === 'live' && t.enabled)
      || (viewer.probe.senders || []).length || viewer.probe.screen;
    if (publishing) fail(bad, 'broadcast viewer published while the avatar was painted');
    if (viewer.probe.role !== 'viewer') fail(bad, 'broadcast viewer role is ' + viewer.probe.role);
  }

  await ctx.close();
  await browser.close();
  server.close();
  if (bad.length) {
    console.error('FAIL\n' + bad.join('\n'));
    process.exit(1);
  }
  console.log('PASS avatar rides the video');
})().catch((err) => { console.error(err); process.exit(1); });
