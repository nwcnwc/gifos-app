/*
 * GifOS: screen shots of shared screens in the transcript (GifOS.shareShots). Copyright (c) 2026 Crowd Concepts, Inc.
 * All rights reserved.
 *
 * Each viewer's own page looks at the screen shares it already receives and shows, and when a shared screen changes
 * and then holds still (a new slide), it keeps one picture of it in this device's transcript, at the time the change
 * began. Nothing is sent: no frame, no message, no byte goes to the wire or to a server, and nobody else's transcript
 * changes. Another device that keeps a transcript takes its own pictures of what it shows.
 *
 * The rules that decide what may be taken stay in the view part (js/core/view/view.js shareShotsSource): a share this
 * viewer sees blurred is never taken, a transcript turned off takes nothing and forgets every picture, and a host's
 * "AI notes: Off" order takes nothing. This file only watches pictures it is handed and keeps them.
 *
 *   detector(opts)        the change finder, pure (node tests drive it with arrays): feed(luma, now) -> null | { at }
 *   attach(src)           start watching: src.on() may we take pictures now, src.keep() is the transcript kept,
 *                         src.shares() [{ sid, name, mine, track }], src.changed() a picture came or went (repaint)
 *   list()                the pictures kept, oldest first: { id, sid, name, mine, at, w, h, url, blob }
 *   exportZip(lines, title, label)  Promise<Blob>: the download, a .zip of transcript.txt/.md/.html and shots/
 *   open(id)              show one picture full size over the page (a tap closes it)
 *
 * The cost on a phone: one 64x36 sample of each share per SHARESHOT_TICK_MS (a second), nothing while the tab is hidden, and a
 * full-size picture (at most MAX_W wide, JPEG) only when a change has settled.
 */
(function (root) {
  'use strict';
  var GifOS = root.GifOS = root.GifOS || {};

  // THE CHANGE FINDER. A share is sampled once a second as 64x36 luma. A sample "holds still" when almost no cell moved
  // since the last one (STILL: a blinking cursor or a clock in a corner still counts as still); a picture is taken once
  // the screen has held still for SETTLE samples in a row AND differs from every recent picture of that share by more
  // than CHANGE (a new slide, a new page). A scroll or a video never holds still, so it takes nothing while it moves;
  // the screen it stops on is one picture. A slide shown again is not taken twice (RECENT pictures are compared).
  // GAP_MS and PER_MIN keep a fast flicker of real changes from filling the transcript.
  var W = 64, H = 36;
  var T = GifOS.timings || {};   // js/timings.js (SHARESHOT_*), loaded before this file
  var DEF = { pix: 18, still: 0.004, change: 0.012, settle: 2, gapMs: T.SHARESHOT_GAP_MS, perMin: 10, winMs: T.SHARESHOT_CAP_WINDOW_MS, recent: 8 };
  function frac(a, b, pix) {
    var n = a.length, c = 0;
    for (var i = 0; i < n; i++) { var d = a[i] - b[i]; if (d > pix || d < -pix) c++; }
    return c / n;
  }
  function detector(opts) {
    var o = {}; var k; for (k in DEF) o[k] = DEF[k]; if (opts) for (k in opts) o[k] = opts[k];
    var prev = null, still = 0, since = null, shots = [], times = [];
    return {
      opts: o,
      // luma: an array of W*H values 0..255; now: ms. Returns { at } when a picture should be taken now (at: when the
      // change began), else null. why: the last decision, for the trace.
      feed: function (luma, now) {
        var r = this;
        if (!prev || prev.length !== luma.length) { prev = luma; still = 0; since = now; r.why = 'first'; return null; }
        var dPrev = frac(luma, prev, o.pix); prev = luma; r.dPrev = dPrev;
        if (dPrev > o.still) { if (still > 0 || since === null) since = now; still = 0; r.why = 'moving'; return null; }
        still++;
        if (still < o.settle) { r.why = 'settling'; return null; }
        var dShot = 1;
        for (var i = 0; i < shots.length; i++) dShot = Math.min(dShot, frac(luma, shots[i], o.pix));
        r.dShot = dShot;
        if (shots.length && dShot <= o.change) { r.why = 'same'; return null; }
        if (times.length && now - times[times.length - 1] < o.gapMs) { r.why = 'gap'; return null; }
        while (times.length && now - times[0] > o.winMs) times.shift();
        if (times.length >= o.perMin) { r.why = 'cap'; return null; }
        shots.push(luma); if (shots.length > o.recent) shots.shift();
        times.push(now);
        r.why = 'shot';
        return { at: since === null ? now : since };
      },
      reset: function () { prev = null; still = 0; since = null; shots = []; times = []; }
    };
  }

  // ---- the page side --------------------------------------------------------------------------------------------
  var TICK_MS = T.SHARESHOT_TICK_MS;
  var mobile = false;
  try { mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ''); } catch (e) {}
  var MAX_W = mobile ? 1280 : 1600;   // the kept picture's width at most
  var MAX_SHOTS = mobile ? 80 : 200;  // pictures kept in one meeting at most (memory); later changes are not taken
  var QUALITY = 0.82;
  var src = null, timer = 0, busy = false, seq = 0;
  var watch = new Map();   // sid -> { det, track, el, own }
  var shots = [];
  var trace = [];
  function note(k, x) {
    var e = { t: Date.now(), k: k }; if (x) for (var n in x) e[n] = x[n];
    trace.push(e); if (trace.length > 300) trace.shift();
  }
  var small = null, smallCtx = null, mid = null, midCtx = null;
  function canvases() {
    if (small) return;
    small = document.createElement('canvas'); small.width = W; small.height = H;
    smallCtx = small.getContext('2d', { willReadFrequently: true });
    mid = document.createElement('canvas'); mid.width = W * 4; mid.height = H * 4;
    midCtx = mid.getContext('2d');
    try { midCtx.imageSmoothingQuality = 'high'; smallCtx.imageSmoothingQuality = 'high'; } catch (e) {}
  }
  // The element that shows this track on the page, else one of our own (kept off screen, muted).
  function elementFor(w) {
    var vs = document.querySelectorAll('video');
    for (var i = 0; i < vs.length; i++) {
      var v = vs[i], so = v.srcObject;
      if (!so || !so.getVideoTracks || v === w.own) continue;
      var t = so.getVideoTracks()[0];
      if (t === w.track && v.videoWidth > 0 && v.readyState >= 2) return v;
    }
    if (!w.own) {
      var o = document.createElement('video');
      o.muted = true; o.autoplay = true; o.playsInline = true; o.setAttribute('playsinline', ''); o.setAttribute('aria-hidden', 'true');
      o.className = 'shareshot-src';
      o.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
      document.body.appendChild(o);
      w.own = o;
    }
    if (!w.own.srcObject || w.own.srcObject.getVideoTracks()[0] !== w.track) {
      try { w.own.srcObject = new MediaStream([w.track]); var p = w.own.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }
    return w.own.videoWidth > 0 && w.own.readyState >= 2 ? w.own : null;
  }
  function lumaOf(v) {
    canvases();
    midCtx.drawImage(v, 0, 0, mid.width, mid.height);
    smallCtx.drawImage(mid, 0, 0, W, H);
    var d = smallCtx.getImageData(0, 0, W, H).data;
    var out = new Uint8Array(W * H);
    for (var i = 0, j = 0; j < out.length; i += 4, j++) out[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    return out;
  }
  function take(v, w, sh, at) {
    var vw = v.videoWidth, vh = v.videoHeight;
    var cw = Math.min(MAX_W, vw), ch = Math.max(1, Math.round(vh * cw / vw));
    var c = document.createElement('canvas'); c.width = cw; c.height = ch;
    c.getContext('2d').drawImage(v, 0, 0, cw, ch);
    return new Promise(function (res) {
      try { c.toBlob(function (b) { res(b); }, 'image/jpeg', QUALITY); } catch (e) { res(null); }
    }).then(function (blob) {
      if (!blob || !src || !src.keep()) return;
      var s = { id: 'ss' + (++seq), sid: sh.sid, name: sh.name || '', mine: !!sh.mine, at: at, w: cw, h: ch, blob: blob, url: URL.createObjectURL(blob), bytes: blob.size };
      shots.push(s);
      shots.sort(function (a, b) { return a.at - b.at; });
      note('shot', { sid: String(sh.sid).slice(0, 8), w: cw, h: ch, bytes: blob.size, at: at });
      try { src.changed(); } catch (e) {}
    });
  }
  function forget(all) {
    watch.forEach(function (w) { if (w.own) { try { w.own.srcObject = null; w.own.remove(); } catch (e) {} } });
    watch.clear();
    if (all && shots.length) {
      shots.forEach(function (s) { try { URL.revokeObjectURL(s.url); } catch (e) {} });
      shots = [];
      note('forget', {});
      try { src.changed(); } catch (e) {}
    }
  }
  function tick() {
    if (!src || busy) return;
    if (!src.keep()) { forget(true); return; }
    if (!src.on()) { if (watch.size) { forget(false); note('off', {}); } return; }
    if (typeof document !== 'undefined' && document.hidden) return;   // a hidden tab samples nothing
    var list = [];
    try { list = src.shares() || []; } catch (e) { list = []; }
    var seen = {};
    var now = Date.now();
    var jobs = [];
    for (var i = 0; i < list.length; i++) {
      var sh = list[i];
      if (!sh || !sh.track || sh.track.readyState === 'ended') continue;
      seen[sh.sid] = 1;
      var w = watch.get(sh.sid);
      if (!w) { w = { det: detector(), track: sh.track, own: null }; watch.set(sh.sid, w); note('watch', { sid: String(sh.sid).slice(0, 8) }); }
      if (w.track !== sh.track) { w.track = sh.track; w.det.reset(); }
      var v = elementFor(w);
      if (!v) { note('nopic', { sid: String(sh.sid).slice(0, 8) }); continue; }
      var luma;
      try { luma = lumaOf(v); } catch (e) { note('err', { sid: String(sh.sid).slice(0, 8), e: String(e && e.message || e).slice(0, 80) }); continue; }
      var hit = w.det.feed(luma, now);
      note('tick', { sid: String(sh.sid).slice(0, 8), why: w.det.why, d: w.det.dPrev != null ? +w.det.dPrev.toFixed(4) : null, s: w.det.dShot != null ? +w.det.dShot.toFixed(4) : null });
      if (hit) {
        if (shots.length >= MAX_SHOTS) { note('full', { sid: String(sh.sid).slice(0, 8) }); continue; }
        jobs.push(take(v, w, sh, hit.at));
      }
    }
    watch.forEach(function (w, sid) {
      if (seen[sid]) return;
      if (w.own) { try { w.own.srcObject = null; w.own.remove(); } catch (e) {} }
      watch.delete(sid); note('unwatch', { sid: String(sid).slice(0, 8) });
    });
    if (jobs.length) { busy = true; Promise.all(jobs).then(function () { busy = false; }, function () { busy = false; }); }
  }
  function attach(s) {
    src = s;
    if (!timer) timer = setInterval(tick, TICK_MS);
    if (typeof document !== 'undefined' && !attach.wired) {
      attach.wired = true;
      // a tap on a picture in the transcript opens it full size
      document.addEventListener('click', function (e) {
        var img = e.target && e.target.closest ? e.target.closest('img[data-shot]') : null;
        if (img) { e.preventDefault(); open(img.getAttribute('data-shot')); }
      });
    }
  }
  function list() { return shots.slice(); }
  function byId(id) { for (var i = 0; i < shots.length; i++) if (shots[i].id === id) return shots[i]; return null; }
  function open(id) {
    var s = byId(id); if (!s) return;
    var old = document.getElementById('shareshot-view'); if (old) old.remove();
    var bg = document.createElement('div');
    bg.id = 'shareshot-view'; bg.className = 'shareshot-view'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true');
    var img = document.createElement('img'); img.src = s.url; img.alt = s.label || '';
    var cap = document.createElement('div'); cap.className = 'shareshot-cap'; cap.textContent = s.label || '';
    bg.appendChild(img); bg.appendChild(cap);
    var close = function () { bg.remove(); document.removeEventListener('keydown', key, true); };
    var key = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    bg.addEventListener('click', close);
    document.addEventListener('keydown', key, true);
    document.body.appendChild(bg);
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // ---- the download: one .zip, built here in the browser (no network) --------------------------------------------
  //   transcript.txt   the plain lines, each picture as a marker in line: [10:42 Screenshot: Ana's screen -> shots/0003-ana-1042.jpg]
  //   transcript.md    Markdown: ![Ana's screen, 10:42](shots/0003-ana-1042.jpg), for editors and AIs
  //   transcript.html  one self-contained page with every picture inside it (opens anywhere with a double-click)
  //   shots/           the pictures, named by order + whose screen + time
  // lines: [{ at, text }] (the text lines exactly as the plain transcript file writes them); label(shot) -> the words
  // for a picture ("Ana's screen, 10:42"); title: the page's heading.
  var CRC = null;
  function crc32(b) {
    if (!CRC) { CRC = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
    var x = 0xFFFFFFFF;
    for (var i = 0; i < b.length; i++) x = CRC[(x ^ b[i]) & 0xFF] ^ (x >>> 8);
    return (x ^ 0xFFFFFFFF) >>> 0;
  }
  // A ZIP of stored entries (JPEGs do not shrink; the text is small): files [{ name, data: Uint8Array }] -> Uint8Array.
  function zipStore(files, when) {
    var d = when || new Date();
    var dosT = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var dosD = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var enc = new TextEncoder(), parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosT, true); h.setUint16(12, dosD, true); h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true);
      h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nm, f.data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dosT, true); c.setUint16(14, dosD, true); c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true);
      c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nm);
      off += 30 + nm.length + sz;
    });
    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
    var all = parts.concat(central, [new Uint8Array(e.buffer)]);
    var out = new Uint8Array(all.reduce(function (a, b) { return a + b.length; }, 0)), p = 0;
    all.forEach(function (b) { out.set(b, p); p += b.length; });
    return out;
  }
  function slug(t) { return String(t || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'screen'; }
  function hhmm(at) { var d = new Date(at); return ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2); }
  function b64(u8) { var s = '', CH = 0x8000; for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); }
  function bytesOf(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(new Uint8Array(r.result)); }; r.readAsArrayBuffer(blob); });
  }
  function exportFiles(lines, title, label, pics) {
    var items = (lines || []).map(function (l) { return { at: l.at, text: l.text }; });
    return Promise.all(pics.map(function (s, i) {
      return bytesOf(s.blob).then(function (b) {
        return { at: s.at, shot: s, data: b, file: 'shots/' + ('000' + (i + 1)).slice(-4) + '-' + (s.mine ? 'me' : slug(s.name)) + '-' + hhmm(s.at) + '.jpg' };
      });
    })).then(function (ps) {
      var all = items.concat(ps).sort(function (a, b) { return a.at - b.at; });
      var txt = [], md = ['# ' + title, ''], html = [];
      all.forEach(function (x) {
        if (x.shot) {
          var w = label(x.shot), t = new Date(x.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          txt.push('[' + t + ' Screenshot: ' + w + ' \u2192 ' + x.file + ']');
          md.push('![' + w.replace(/[\[\]]/g, '') + '](' + x.file + ')', '');
          html.push('<figure><img src="data:image/jpeg;base64,' + b64(x.data) + '" width="' + x.shot.w + '" height="' + x.shot.h + '" alt="' + esc(w) + '"><figcaption>' + esc(w) + '</figcaption></figure>');
        } else {
          txt.push(x.text);
          md.push(x.text.replace(/^(\[[^\]]*\])/, '$1 '), '');
          html.push('<p>' + esc(x.text) + '</p>');
        }
      });
      var page = '<!doctype html>\n<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title>' +
        '<style>body{font:15px/1.5 system-ui,sans-serif;max-width:60rem;margin:1rem auto;padding:0 1rem;color:#1c1c2b;background:#fff}' +
        'p{margin:.25rem 0}figure{margin:.75rem 0}img{max-width:100%;height:auto;border:1px solid #ccd;border-radius:.3rem}figcaption{font-size:.85rem;color:#556}</style></head><body>\n<h1>' + esc(title) + '</h1>\n' + html.join('\n') + '\n</body></html>\n';
      var enc = new TextEncoder();
      var files = [{ name: 'transcript.txt', data: enc.encode(txt.join('\n') + '\n') }, { name: 'transcript.md', data: enc.encode(md.join('\n')) }, { name: 'transcript.html', data: enc.encode(page) }];
      ps.forEach(function (p) { files.push({ name: p.file, data: p.data }); });
      return files;
    });
  }
  function exportZip(lines, title, label, pics) {
    return exportFiles(lines, title, label, pics || shots).then(function (files) { return new Blob([zipStore(files)], { type: 'application/zip' }); });
  }
  GifOS.shareShots = {
    detector: detector, attach: attach, list: list, open: open, exportZip: exportZip, exportFiles: exportFiles, zipStore: zipStore,
    trace: function () { return trace.slice(); }, tick: tick, W: W, H: H, TICK_MS: TICK_MS,
    label: function (id, words) { var s = byId(id); if (s) s.label = words; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = GifOS.shareShots;
})(typeof window !== 'undefined' ? window : globalThis);
