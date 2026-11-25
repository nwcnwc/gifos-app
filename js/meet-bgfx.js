/*
 * meet-bgfx.js — CAMERA BACKGROUND EFFECTS: None, Blur, or a picture behind you.
 *
 * WHERE IT RUNS. In the one camera pipe (js/core/media/plane-browser.js, the canvas
 * that sentVideoTrack sends). The pipe calls paint() with each camera frame, so every
 * consumer of my picture (the senders, the Stage feed, the Stadium, the recorder, the
 * float) gets the same composite. Nothing here sends, receives or decides who sees what.
 *
 * SAFETY BLUR STAYS ON TOP. The pipe passes its privacy blur in: the composite (me over
 * the background) is blurred whole by that same blur, so a background effect never
 * makes the picture that leaves clearer than the blur rules make it. Receivers keep
 * their own blur as before.
 *
 * HOW IT FINDS THE PERSON. Native first: where the camera itself offers a background
 * blur (Chrome's backgroundBlur constraint on platforms with camera effects), Blur
 * uses it and nothing runs here. Otherwise a small person-segmentation model (the
 * MediaPipe selfie segmenter, Apache-2.0) runs in a Web Worker (js/bgfx/seg-worker.js)
 * on a small copy of each frame and answers with a soft mask. The model and its
 * WebAssembly runtime are fetched once from the GifOS model host, each file checked
 * against the SHA-256 pinned in js/bgfx/models.json, and kept in this browser's
 * Cache Storage. The worker makes no network request.
 *
 * PHONES: Blur only, at a lower mask rate. THE LOAD GUARD steps the mask rate down when
 * the model takes too much of a core, and turns the effect off (the camera goes out as
 * it would with None) when even the slowest rate or the composite itself costs too
 * much, the power level is low, or the meeting's own load guard has started shedding. A device that cannot run the model at all (no
 * WebAssembly SIMD, no workers, very little memory: older iPhones) offers None only.
 *
 * Remembered per device (localStorage). An uploaded picture is kept on this device only.
 *
 *   GifOS.meetBgfx.choice()           { mode: 'none'|'blur'|'image', img }
 *   GifOS.meetBgfx.setChoice(c)       store it and tell the listeners (the pipe rebuilds)
 *   GifOS.meetBgfx.wants()            the pipe must composite (an effect is chosen and can run here)
 *   GifOS.meetBgfx.nativeSync(track)  apply / undo the camera's own background blur; true when it covers the choice
 *   GifOS.meetBgfx.paint(ctx, src, g) composite one frame into ctx (g: geometry + the privacy blur); false = not drawn
 *   GifOS.meetBgfx.release()          the pipe stopped: hand the processor back
 *   GifOS.meetBgfx.status()           what runs, for the picker's note and for tests
 *   GifOS.meetBgfx.fillPicker(el, t)  the camera pop-up's Background group (el: the pop-up)
 *   GifOS.meetBgfx.preview(track)     { track, stop } for the lobby preview
 */
(function (root) {
  const GifOS = (root.GifOS = root.GifOS || {});
  if (GifOS.meetBgfx) return;

  const KEY = 'meet.bg.v1';
  const IMG_KEY = 'meet.bg.v1.img';
  const CACHE = 'gifos-bgfx-v1';
  const here = (function () {
    try {
      const s = root.document && root.document.currentScript;
      if (s && s.src) return s.src.replace(/[^/]*$/, '');
    } catch (e) {}
    return '/js/';
  })();
  const DIR = here + 'bgfx/';
  const BUILTINS = ['dusk', 'studio', 'bokeh'];
  // The numbers of the effect (shares and frame counts, no times): see the comments where each is used.
  const T = function () { return GifOS.timings || {}; };
  // The background blur is the sender's Max privacy blur: the strength that hides a face also hides a room.
  const BG_BLUR_FRAC = function () { return T().BLUR_MAX_FRAC || 0.045; };
  const SEG_W = 256;                // the model reads a small copy (its own input is 256 square)
  const RUNGS_DESK = [1, 2, 3];     // a mask every Nth painted frame
  const RUNGS_PHONE = [2, 3, 4];
  const SHARE_HI = 0.5, SHARE_HI_PHONE = 0.35, SHARE_LO = 0.15;  // the model's share of one core
  const MAIN_HI = 0.25, MAIN_HI_PHONE = 0.35;   // the composite's share of the main thread
  const HOLD_N = 30, EASE_N = 90;   // frames over a limit before a step down / under it before a step up

  // ---- the device -------------------------------------------------------------------
  const SIMD_PROBE = [0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11];
  function unsupported(nav) {
    nav = nav || root.navigator || {};
    const W = root.WebAssembly;
    if (!W || typeof W.validate !== 'function') return 'wasm';
    try { if (!W.validate(new Uint8Array(SIMD_PROBE))) return 'simd'; } catch (e) { return 'simd'; }
    if (typeof root.Worker !== 'function') return 'worker';
    if (!root.crypto || !root.crypto.subtle) return 'crypto';
    const mem = Number(nav.deviceMemory) || 0;
    if (mem && mem < 2) return 'memory';
    try { const c = root.document.createElement('canvas'); if (typeof c.captureStream !== 'function') return 'canvas'; } catch (e) { return 'canvas'; }
    return '';
  }
  function phone() {
    const MP = GifOS.meetPower;
    try { return !!(MP && MP.mobileDevice(root.navigator)); } catch (e) { return false; }
  }
  const ctxFilterOK = (function () {
    try {
      const c = root.document.createElement('canvas'); c.width = c.height = 12;
      const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 12, 12);
      x.filter = 'blur(3px)'; x.fillStyle = '#fff'; x.fillRect(4, 4, 4, 4); x.filter = 'none';
      return x.getImageData(2, 2, 1, 1).data[0] > 8;
    } catch (e) { return false; }
  })();

  // ---- the choice -------------------------------------------------------------------
  let cur = (function () {
    try {
      const c = JSON.parse(root.localStorage.getItem(KEY) || 'null');
      if (c && (c.mode === 'blur' || c.mode === 'image')) return { mode: c.mode, img: String(c.img || 'dusk') };
    } catch (e) {}
    return { mode: 'none', img: 'dusk' };
  })();
  const listeners = [];
  function notify() { for (const fn of listeners.slice()) { try { fn(choice()); } catch (e) {} } }
  // A step back (the load guard, low power, a failed start) rebuilds the pipe without the effect,
  // after the current paint has finished.
  function stepBack(why) { busy = why; release(); Promise.resolve().then(notify); }
  function choice() {
    // A phone offers Blur only: a picture chosen on it reads as Blur.
    if (cur.mode === 'image' && phone()) return { mode: 'blur', img: cur.img };
    return { mode: cur.mode, img: cur.img };
  }
  function setChoice(c) {
    const mode = c && (c.mode === 'blur' || c.mode === 'image') ? c.mode : 'none';
    cur = { mode: mode, img: String((c && c.img) || cur.img || 'dusk') };
    try { if (mode === 'none') root.localStorage.removeItem(KEY); else root.localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) {}
    busy = ''; rungI = startRung();             // a pick of their own lifts a step back
    if (failed && failed.indexOf('unsupported') !== 0) failed = '';   // and tries a failed start again
    picture = null; pictureKey = '';
    guard.share = 0; guard.main = 0; guard.over = 0; guard.under = 0; guard.mainOver = 0; guard.n = 0; guard.gap = 0; lastPaintAt = 0;
    if (mode === 'none') release();
    notify();
  }
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }

  // ---- the load guard ---------------------------------------------------------------
  let busy = '';            // '' | 'load' | 'power': stepped back to no effect until the next pick or more power
  let powerFn = null, shedFn = null;
  let lastPower = 'full';
  function powerLevel() { try { const p = powerFn ? powerFn() : null; return (p && p.level) || 'full'; } catch (e) { return 'full'; } }
  function rungs() { return phone() ? RUNGS_PHONE : RUNGS_DESK; }
  function startRung() { return powerLevel() === 'save' && !phone() ? 1 : 0; }
  let rungI = 0;
  const guard = { share: 0, main: 0, over: 0, under: 0, mainOver: 0, n: 0, gap: 0 };
  function readPower() {
    const lv = powerLevel();
    if (lv !== lastPower) {
      // More power lifts a power step back; less takes the effect off at 'low'.
      if (busy === 'power' && lv !== 'low') { busy = ''; rungI = startRung(); Promise.resolve().then(notify); }
      lastPower = lv;
    }
    if (lv === 'low' && !busy && cur.mode !== 'none') stepBack('power');
    // The meeting's own load guard (L29): a device that has started shedding its forwards gives up the effect first,
    // until the person picks again.
    let shed = 0; try { shed = shedFn ? (shedFn() | 0) : 0; } catch (e) { shed = 0; }
    if (shed >= 1 && !busy && cur.mode !== 'none') stepBack('load');
  }
  // THE MODEL KEEPS UP: its time per mask over the time it is given (the rung's frames between two masks). The time
  // between two answered masks would hide a slowing model (the next ask waits for the last answer, so the gap grows
  // with it and the share stays flat).
  function noteSeg(ms, gapMs) {
    const per = guard.gap > 0 ? guard.gap : gapMs;
    if (!(per > 0)) return;
    const s = Math.min(4, ms / (per * rungs()[rungI]));
    guard.share = guard.n ? guard.share * 0.8 + s * 0.2 : s;
    guard.n++;
    const hi = phone() ? SHARE_HI_PHONE : SHARE_HI;
    if (guard.share > hi) { guard.over++; guard.under = 0; } else if (guard.share < SHARE_LO) { guard.under++; guard.over = 0; } else { guard.over = 0; guard.under = 0; }
    if (guard.over >= HOLD_N) { guard.over = 0; stepDown(); }
    else if (guard.under >= EASE_N && rungI > startRung()) { guard.under = 0; rungI--; guard.share = 0; guard.n = 0; }
  }
  // One step down the ladder: a mask every more frames (less model work, and fewer frame copies on the main thread);
  // past the last rung the effect goes off.
  function stepDown() {
    if (rungI < rungs().length - 1) { rungI++; guard.share = 0; guard.n = 0; guard.main = 0; guard.mainOver = 0; }
    else stepBack('load');
  }
  // The composite's share of the main thread: its cost over the time between two paints.
  function notePaint(ms, gapMs) {
    if (!(gapMs > 0)) return;
    guard.gap = guard.gap ? guard.gap * 0.9 + gapMs * 0.1 : gapMs;
    const s = Math.min(4, ms / gapMs);
    guard.main = guard.main ? guard.main * 0.9 + s * 0.1 : s;
    if (guard.main > (phone() ? MAIN_HI_PHONE : MAIN_HI)) { if (++guard.mainOver >= HOLD_N) { guard.mainOver = 0; stepDown(); } } else guard.mainOver = 0;
  }

  // ---- the native blur ----------------------------------------------------------------
  // Chrome exposes the platform's camera blur as a constraint when the platform has one.
  // capabilities.backgroundBlur lists the values the page may set: [false, true] can be
  // switched; [true] alone means the platform keeps it on (then every mode already has
  // a blurred room behind the person).
  function nativeCaps(track) {
    try { const c = track && track.getCapabilities ? track.getCapabilities() : null; const b = c && c.backgroundBlur; return Array.isArray(b) ? b : null; } catch (e) { return null; }
  }
  function nativeSync(track) {
    if (!track || track.kind !== 'video') return false;
    nativeTrack = track;
    const caps = nativeCaps(track);
    if (!caps || caps.indexOf(true) < 0) return false;
    const want = choice().mode === 'blur';
    if (caps.indexOf(false) < 0) return want;            // always on, set by the platform
    if (track.__bgfxNative !== want) {
      track.__bgfxNative = want;
      try { const p = track.applyConstraints({ advanced: [{ backgroundBlur: want }] }); if (p && p.catch) p.catch(() => { track.__bgfxNative = null; }); } catch (e) { track.__bgfxNative = null; }
    }
    return want;
  }
  let nativeTrack = null;
  function nativeCovers() { return !!(nativeTrack && nativeTrack.readyState === 'live' && choice().mode === 'blur' && nativeSync(nativeTrack)); }

  // ---- the engine (worker + model) --------------------------------------------------------
  let cat = null;
  function catalog() {
    if (!cat) {
      cat = fetch(DIR + 'models.json', { credentials: 'omit' }).then((r) => { if (!r.ok) throw new Error('models.json HTTP ' + r.status); return r.json(); });
      cat.catch(() => { cat = null; });
    }
    return cat;
  }
  function hex(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i++) s += (u[i] < 16 ? '0' : '') + u[i].toString(16); return s; }
  function openCache() { try { return (root.caches && root.caches.open) ? root.caches.open(CACHE).catch(() => null) : Promise.resolve(null); } catch (e) { return Promise.resolve(null); } }
  // One pinned file: the checked copy in Cache Storage, else a download checked against its pin.
  function pinned(pin, base, cache) {
    const url = base.replace(/\/+$/, '') + '/' + pin.key;
    const hit = cache ? cache.match(url).then((r) => (r && r.headers.get('x-gifos-sha256') === pin.sha256) ? r.arrayBuffer() : null).catch(() => null) : Promise.resolve(null);
    return hit.then((b) => {
      if (b && (!pin.bytes || b.byteLength === pin.bytes)) return b;
      return fetch(url, { credentials: 'omit', mode: 'cors' }).then((r) => {
        if (!r.ok) throw new Error('download failed: HTTP ' + r.status + ' for ' + pin.name);
        return r.arrayBuffer();
      }).then((buf) => root.crypto.subtle.digest('SHA-256', buf).then((d) => {
        if (hex(d) !== pin.sha256) throw new Error(pin.name + ' does not match its pin');
        const keep = cache ? cache.put(url, new Response(buf.slice(0), { headers: { 'content-type': 'application/octet-stream', 'x-gifos-sha256': pin.sha256 } })).catch(() => {}) : null;
        return Promise.resolve(keep).then(() => buf);
      }));
    });
  }
  let eng = null;           // { w, ready, failed, inflight, sentAt, lastSentAt }
  let failed = '';
  function engine() {
    if (eng || failed) return eng;
    const why = unsupported();
    if (why) { failed = 'unsupported:' + why; return null; }
    const e = { w: null, ready: false, inflight: false, sentAt: 0, lastSentAt: 0, seq: 0, delegate: '' };
    eng = e;
    const base = (root.__gifosBgfxBase) || null;   // a local copy of the model host (tools only)
    catalog().then((c) => openCache().then((cache) => Promise.all([pinned(c.wasm, base || c.base, cache), pinned(c.model, base || c.base, cache)])))
      .then((bufs) => {
        if (eng !== e) return;
        const w = new Worker(DIR + 'seg-worker.js');
        e.w = w;
        w.onerror = () => { stopEngine(e, 'worker'); };
        w.onmessage = (ev) => onWorker(e, ev.data || {});
        w.postMessage({ op: 'load', wasm: bufs[0], model: bufs[1] }, [bufs[0], bufs[1]]);
      })
      .catch((err) => { if (eng === e) stopEngine(e, 'load:' + ((err && err.message) || err)); });
    return e;
  }
  function stopEngine(e, why) {
    if (e && e.w) { try { e.w.terminate(); } catch (x) {} }
    if (eng === e) eng = null;
    if (why) { failed = why; Promise.resolve().then(notify); }
    hasMask = false;
  }
  function release() { if (eng) stopEngine(eng, ''); hasMask = false; }
  let maskC = null, maskX = null, hasMask = false;
  function onWorker(e, m) {
    if (eng !== e) return;
    if (m.op === 'ready') { e.ready = true; e.delegate = m.delegate || ''; return; }
    if (m.op === 'error') { stopEngine(e, 'model:' + (m.error || '')); return; }
    if (m.op !== 'mask') return;
    e.inflight = false;
    if (!m.buf || !(m.w > 0)) return;
    if (!maskC) { maskC = root.document.createElement('canvas'); maskX = maskC.getContext('2d'); }
    if (maskC.width !== m.w || maskC.height !== m.h) { maskC.width = m.w; maskC.height = m.h; }
    try { maskX.putImageData(new ImageData(new Uint8ClampedArray(m.buf), m.w, m.h), 0, 0); hasMask = true; } catch (x) {}
    noteSeg(m.ms || 0, e.sentAt - e.lastSentAt);
    stats.masks++; stats.segMs = m.ms || 0;
  }
  let segC = null, segX = null, frameN = 0;
  function askMask(src, sw, sh) {
    const e = engine();
    if (!e || !e.ready || e.inflight) return;
    if ((frameN % rungs()[rungI]) !== 0) return;
    const h = Math.max(2, Math.round(SEG_W * sh / Math.max(1, sw)));
    if (!segC) { segC = root.document.createElement('canvas'); segX = segC.getContext('2d', { willReadFrequently: true }); }
    if (segC.width !== SEG_W || segC.height !== h) { segC.width = SEG_W; segC.height = h; }
    try {
      segX.drawImage(src, 0, 0, SEG_W, h);
      const img = segX.getImageData(0, 0, SEG_W, h);
      e.inflight = true; e.lastSentAt = e.sentAt || root.performance.now(); e.sentAt = root.performance.now();
      e.w.postMessage({ op: 'run', id: ++e.seq, w: SEG_W, h: h, buf: img.data.buffer }, [img.data.buffer]);
    } catch (x) { e.inflight = false; }
  }

  // ---- the backgrounds ----------------------------------------------------------------
  // Built-ins are painted here (no picture file to download or license): a dusk sky,
  // a plain studio wall, soft out-of-focus lights.
  const builtCache = {};
  function builtin(id) {
    if (builtCache[id]) return builtCache[id];
    const c = root.document.createElement('canvas'); c.width = 1280; c.height = 720;
    const x = c.getContext('2d');
    if (id === 'studio') {
      const g = x.createRadialGradient(640, 300, 60, 640, 360, 820);
      g.addColorStop(0, '#d9dde3'); g.addColorStop(1, '#6e7682');
      x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
    } else if (id === 'bokeh') {
      const g = x.createLinearGradient(0, 0, 1280, 720);
      g.addColorStop(0, '#10233f'); g.addColorStop(1, '#2b1838');
      x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
      let s = 7;
      const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      const hues = [42, 28, 200, 320, 50];
      for (let i = 0; i < 46; i++) {
        const cx = rnd() * 1280, cy = rnd() * 720, r = 30 + rnd() * 90, h = hues[i % hues.length];
        const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        rg.addColorStop(0, 'hsla(' + h + ',90%,72%,0.55)'); rg.addColorStop(0.7, 'hsla(' + h + ',90%,65%,0.25)'); rg.addColorStop(1, 'hsla(' + h + ',90%,60%,0)');
        x.fillStyle = rg; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
      }
    } else {
      const g = x.createLinearGradient(0, 0, 0, 720);
      g.addColorStop(0, '#24305e'); g.addColorStop(0.55, '#a8547a'); g.addColorStop(1, '#f2a65a');
      x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
      const sun = x.createRadialGradient(900, 560, 10, 900, 560, 260);
      sun.addColorStop(0, 'rgba(255,236,180,0.95)'); sun.addColorStop(0.3, 'rgba(255,200,140,0.5)'); sun.addColorStop(1, 'rgba(255,180,120,0)');
      x.fillStyle = sun; x.fillRect(0, 0, 1280, 720);
    }
    builtCache[id] = c;
    return c;
  }
  let picture = null, pictureKey = '';
  function backgroundPicture() {
    const c = choice();
    if (c.mode !== 'image') return null;
    if (BUILTINS.indexOf(c.img) >= 0) return builtin(c.img);
    if (c.img !== 'upload') return builtin('dusk');
    let data = '';
    try { data = root.localStorage.getItem(IMG_KEY) || ''; } catch (e) {}
    if (!data) data = uploadMem;
    if (!data) return builtin('dusk');
    if (pictureKey !== data) {
      pictureKey = data; picture = null;
      const im = new root.Image();
      im.onload = () => { if (pictureKey === data) picture = im; };
      im.src = data;
    }
    return picture;   // null while it decodes: the frame shows the blurred room
  }
  let uploadMem = '';
  // A picture from this device, scaled to at most 1280 on its long side and kept as a JPEG.
  function useUpload(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type || '')) { reject(new Error('not a picture')); return; }
      const url = URL.createObjectURL(file);
      const im = new root.Image();
      im.onload = () => {
        URL.revokeObjectURL(url);
        const k = Math.min(1, 1280 / Math.max(im.naturalWidth, im.naturalHeight, 1));
        const c = root.document.createElement('canvas');
        c.width = Math.max(2, Math.round(im.naturalWidth * k)); c.height = Math.max(2, Math.round(im.naturalHeight * k));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        const data = c.toDataURL('image/jpeg', 0.85);
        uploadMem = data;
        try { root.localStorage.setItem(IMG_KEY, data); } catch (e) {}
        setChoice({ mode: 'image', img: 'upload' });
        resolve(true);
      };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable picture')); };
      im.src = url;
    });
  }
  function coverDraw(x, pic, w, h) {
    const pw = pic.naturalWidth || pic.width, ph = pic.naturalHeight || pic.height;
    if (!(pw > 0 && ph > 0)) return false;
    const k = Math.max(w / pw, h / ph), dw = pw * k, dh = ph * k;
    x.drawImage(pic, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return true;
  }

  // ---- the composite ----------------------------------------------------------------
  const stats = { paints: 0, masks: 0, segMs: 0, paintMs: 0 };
  let personC = null, personX = null, compC = null, compX = null, lastPaintAt = 0;
  function wants() {
    readPower();
    if (choice().mode === 'none' || busy || failed) return false;
    if (nativeCovers()) return false;
    return !unsupported();
  }
  // g: { ox, oy, dw, dh, w, h, privacyFrac, blurDraw }: the camera frame lands at ox/oy/dw/dh on a
  // w x h canvas (the pipe's crop or Stage frame); privacyFrac > 0 blurs the whole composite by
  // the pipe's privacy blur (as a fraction of the canvas width, blurDraw's unit).
  // The background blur is painted at a quarter of the size and stretched back: the same sigma on the picture, a
  // sixteenth of the filter's work (the blur removes the detail the small copy loses).
  let bgC = null, bgX = null;
  function bgBlur(out, src, g, frac, bd) {
    const q = 4, sw = Math.max(8, Math.round(g.w / q)), sh = Math.max(8, Math.round(g.h / q));
    if (!bgC) { bgC = root.document.createElement('canvas'); bgX = bgC.getContext('2d'); }
    if (bgC.width !== sw || bgC.height !== sh) { bgC.width = sw; bgC.height = sh; }
    bd(bgX, src, g.ox / q, g.oy / q, g.dw / q, g.dh / q, frac);
    out.imageSmoothingEnabled = true;
    out.drawImage(bgC, 0, 0, g.w, g.h);
  }
  function paint(ctx, src, g) {
    if (!wants()) return false;
    const t0 = root.performance.now();
    frameN++;
    const sw = src.videoWidth || 0, sh = src.videoHeight || 0;
    if (!(sw > 0 && sh > 0)) return false;
    askMask(src, sw, sh);
    const w = g.w, h = g.h, bd = g.blurDraw || softDraw;
    const priv = g.privacyFrac > 0;
    let out = ctx;
    if (priv) {
      if (!compC) { compC = root.document.createElement('canvas'); compX = compC.getContext('2d'); }
      if (compC.width !== w || compC.height !== h) { compC.width = w; compC.height = h; }
      out = compX;
    }
    const bgFrac = BG_BLUR_FRAC() * Math.max(w, h) / Math.max(1, g.dw);
    const pic = backgroundPicture();
    if (!hasMask || (choice().mode === 'image' && !pic)) {
      // No mask yet (the model is still loading): the whole frame wears the background blur,
      // so the room never shows clear while the effect starts.
      bgBlur(out, src, g, bgFrac, bd);
    } else {
      if (!personC) { personC = root.document.createElement('canvas'); personX = personC.getContext('2d'); }
      if (personC.width !== w || personC.height !== h) { personC.width = w; personC.height = h; }
      personX.globalCompositeOperation = 'copy';
      personX.drawImage(src, g.ox, g.oy, g.dw, g.dh);
      personX.globalCompositeOperation = 'destination-in';
      personX.imageSmoothingEnabled = true;
      personX.drawImage(maskC, g.ox, g.oy, g.dw, g.dh);   // the small soft mask, stretched: its edge stays soft
      personX.globalCompositeOperation = 'source-over';
      if (pic) { out.fillStyle = '#000'; out.fillRect(0, 0, w, h); coverDraw(out, pic, w, h); }
      else bgBlur(out, src, g, bgFrac, bd);
      out.drawImage(personC, 0, 0);
    }
    if (priv) bd(ctx, compC, 0, 0, w, h, g.privacyFrac);
    const t1 = root.performance.now();
    if (lastPaintAt) notePaint(t1 - t0, t0 - lastPaintAt);
    lastPaintAt = t0;
    stats.paints++; stats.paintMs = t1 - t0;
    return true;
  }

  function status() {
    const c = choice();
    let state = 'off';
    if (c.mode !== 'none') {
      const why = unsupported();
      if (why) state = 'unsupported';
      else if (failed) state = 'failed';
      else if (busy) state = 'busy';
      else if (nativeCovers()) state = 'native';
      else if (eng && eng.ready && hasMask) state = 'on';
      else if (eng) state = 'loading';
      else state = 'ready';   // chosen; starts with the camera
    }
    return { mode: c.mode, img: c.img, state: state, why: failed || busy || unsupported(), phone: phone(), rung: rungs()[rungI],
      share: Math.round(guard.share * 1000) / 1000, main: Math.round(guard.main * 1000) / 1000, delegate: eng ? eng.delegate : '',
      paints: stats.paints, masks: stats.masks, segMs: Math.round(stats.segMs * 10) / 10, paintMs: Math.round(stats.paintMs * 10) / 10 };
  }

  // ---- the picker (the camera pop-up's Background group) ------------------------------------
  // chooser: the camera pop-up; the group is its own child, made on first use, after the camera list.
  function fillPicker(chooser, t) {
    if (!chooser) return;
    let box = chooser.querySelector('#cambg');
    if (!box) {
      box = root.document.createElement('div'); box.id = 'cambg'; box.setAttribute('role', 'group');
      chooser.appendChild(box);
    }
    t = t || ((k, en) => en);
    box.textContent = '';
    const why = unsupported();
    box.hidden = false;
    const head = root.document.createElement('div'); head.className = 'devhead'; head.textContent = t('bgHead', 'Background');
    box.appendChild(head);
    box.setAttribute('aria-label', t('bgHead', 'Background'));
    const c = choice();
    const row = (id, label, on, pick, thumb) => {
      const b = root.document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', String(!!on));
      b.dataset.bg = id;
      if (thumb) { const th = root.document.createElement('canvas'); th.width = 48; th.height = 27; th.className = 'bgthumb'; th.setAttribute('aria-hidden', 'true'); th.getContext('2d').drawImage(thumb, 0, 0, 48, 27); b.appendChild(th); }
      const s = root.document.createElement('span'); s.textContent = label; b.appendChild(s);
      b.onclick = (e) => { e.stopPropagation(); pick(); fillPicker(chooser, t); const again = chooser.querySelector('#cambg [data-bg="' + id + '"]'); if (again) { try { again.focus(); } catch (x) {} } };
      box.appendChild(b);
      return b;
    };
    row('none', t('bgNone', 'None'), c.mode === 'none', () => setChoice({ mode: 'none' }));
    if (!why) {
      row('blur', t('bgBlur', 'Blur'), c.mode === 'blur', () => setChoice({ mode: 'blur', img: cur.img }));
      if (!phone()) {
        const names = { dusk: t('bgDusk', 'Dusk'), studio: t('bgStudio', 'Studio'), bokeh: t('bgBokeh', 'Lights') };
        for (const id of BUILTINS) row(id, names[id], c.mode === 'image' && c.img === id, () => setChoice({ mode: 'image', img: id }), builtin(id));
        let have = uploadMem; try { have = have || root.localStorage.getItem(IMG_KEY) || ''; } catch (e) {}
        if (have) row('upload', t('bgMine', 'My picture'), c.mode === 'image' && c.img === 'upload', () => setChoice({ mode: 'image', img: 'upload' }));
        const up = root.document.createElement('input');
        up.type = 'file'; up.accept = 'image/*'; up.hidden = true; up.id = 'cambg-file';
        up.onchange = () => { const f = up.files && up.files[0]; if (f) useUpload(f).then(() => fillPicker(chooser, t), () => {}); };
        box.appendChild(up);
        row('pick', t('bgUpload', 'Upload a picture…'), false, () => up.click());
      }
    }
    if (phone()) {
      // A phone's pop-up sits above the dock on a short screen: None and Blur share one line.
      const line = root.document.createElement('div'); line.className = 'bgline';
      for (const b of Array.from(box.querySelectorAll('button[data-bg]'))) line.appendChild(b);
      box.appendChild(line);
    }
    const st = status();
    const words = st.state === 'unsupported' ? t('bgUnavailable', 'Background effects are not available on this device.')
      : st.state === 'failed' ? t('bgFailed', 'The background effect could not start.')
      : st.state === 'busy' ? t('bgBusy', 'Background effect paused: this device is busy.')
      : st.state === 'loading' ? t('bgLoading', 'Starting the background effect…') : '';
    if (why && c.mode === 'none') {
      const n = root.document.createElement('div'); n.className = 'bgnote'; n.textContent = t('bgUnavailable', 'Background effects are not available on this device.'); box.appendChild(n);
    } else if (words) {
      const n = root.document.createElement('div'); n.className = 'bgnote'; n.setAttribute('role', 'status'); n.textContent = words; box.appendChild(n);
    }
  }

  // A blur for pages that have no pipe (the lobby preview): the canvas filter where the engine
  // has one, else a shrink-and-grow pyramid (each halving averages neighbours, like the pipe's).
  let softA = null;
  function softDraw(cx, s, dx, dy, dw, dh, frac) {
    if (ctxFilterOK) { cx.filter = 'blur(' + Math.max(0, Math.round(frac * dw * 100) / 100) + 'px)'; cx.drawImage(s, dx, dy, dw, dh); cx.filter = 'none'; return; }
    if (!softA) softA = [root.document.createElement('canvas'), root.document.createElement('canvas')];
    const bottom = Math.max(2, Math.round(0.35 / Math.max(1e-6, frac)));
    let a = softA[0], b = softA[1], w = Math.max(bottom, Math.round(dw / 2)), h = Math.max(2, Math.round(w * dh / Math.max(1, dw)));
    a.width = w; a.height = h; a.getContext('2d').drawImage(s, 0, 0, w, h);
    while (w > bottom) {
      const nw = Math.max(bottom, Math.round(w / 2)), nh = Math.max(2, Math.round(h / 2));
      b.width = nw; b.height = nh; b.getContext('2d').drawImage(a, 0, 0, w, h, 0, 0, nw, nh);
      const t = a; a = b; b = t; w = nw; h = nh;
    }
    cx.imageSmoothingEnabled = true; cx.drawImage(a, 0, 0, w, h, dx, dy, dw, dh);
  }

  // ---- the lobby preview: the same composite on the preview camera -------------------------
  function preview(track, blurDraw) {
    if (!track || !wants()) return null;
    const src = root.document.createElement('video');
    src.muted = true; src.autoplay = true; src.setAttribute('playsinline', ''); src.setAttribute('muted', '');
    src.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';
    src.srcObject = new root.MediaStream([track]);
    root.document.body.appendChild(src);
    const c = root.document.createElement('canvas');
    const x = c.getContext('2d');
    if (typeof c.captureStream !== 'function') { src.remove(); return null; }
    const out = c.captureStream(15).getVideoTracks()[0];
    let dead = false;
    const bd = blurDraw || softDraw;
    const draw = () => {
      if (dead) return;
      const sw = src.videoWidth, sh = src.videoHeight;
      if (sw > 0 && sh > 0) {
        const k = Math.min(1, 640 / Math.max(sw, sh)), w = Math.round(sw * k), h = Math.round(sh * k);
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
        if (!paint(x, src, { ox: 0, oy: 0, dw: w, dh: h, w: w, h: h, privacyFrac: 0, blurDraw: bd })) x.drawImage(src, 0, 0, w, h);
      }
      if (src.requestVideoFrameCallback) src.requestVideoFrameCallback(draw); else root.requestAnimationFrame(draw);
    };
    src.play().catch(() => {});
    draw();
    return { track: out, stop() { dead = true; release(); try { out.stop(); } catch (e) {} try { src.srcObject = null; src.remove(); } catch (e) {} } };
  }

  function configure(o) {
    if (o && typeof o.power === 'function') powerFn = o.power;
    if (o && typeof o.shed === 'function') shedFn = o.shed;
    if (o && o.camera) nativeTrack = o.camera;
  }

  GifOS.meetBgfx = { choice, setChoice, onChange, wants, nativeSync, paint, release, status, fillPicker, preview, configure, unsupported, useUpload,
    // the load guard's readings, for its unit check
    guardForTest: { noteSeg: (ms, gap) => noteSeg(ms, gap), notePaint: (ms, gap) => notePaint(ms, gap), mask: (on) => { hasMask = !!on; if (on && !maskC) { maskC = root.document.createElement('canvas'); } } } };
})(typeof self !== 'undefined' ? self : this);
