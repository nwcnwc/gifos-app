/*
 * gifos-explicit.js: the ON-DEVICE EXPLICIT-PICTURE CHECK, one module for every page that needs it (the gifos.tv
 * thumbnail, and the video blocker). Copyright (c) 2026 Crowd Concepts, Inc.
 *
 * GifOS pages check pictures on your device and hide sexually explicit ones. Nothing is sent to GifOS or anyone else.
 * The check is an open image model (NSFWJS MobileNetV2, MIT) running in a Web Worker (js/safeguard/explicit-worker.js)
 * on TensorFlow.js. The only network use is a one-time GET of the runtime and model from the GifOS model host, each
 * file pinned by SHA-256 in js/safeguard/models.json. The page downloads each file, checks every byte, keeps the
 * checked copy in this browser's Cache Storage and hands the bytes to the worker, which makes no request at all.
 * Nothing loads until a page first asks for a check.
 *
 * Only the explicit classes act (porn + hentai, summed). "Sexy" (swimwear, a bare chest) never acts by itself.
 *
 *   GifOS.explicit.unsupported()       '' when this device can run the check, else why not ('wasm' | 'worker' | 'canvas')
 *   GifOS.explicit.open(opts)          Promise of the engine (one per page): { classify(src) → Promise<result>, backend }
 *                                      opts.base overrides the model host (a local copy of the files, tools only);
 *                                      opts.catalog names another catalog beside models.json (tools only)
 *   GifOS.explicit.classify(src, opts) Promise of a result for one picture: src is a canvas, image, video, ImageBitmap or
 *                                      ImageData. result = { p:{drawing,hentai,neutral,porn,sexy}, score, explicit, ms }
 *                                      opts.square: look at the centre square only
 *   GifOS.explicit.checkStill(src)     Promise of { ok, verdict, score, ms } for one still picture (a thumbnail): ok
 *                                      false = explicit. verdict = { m, v, ok:1 } is what a page signs into an order
 *                                      when ok; there is no verdict when the picture tripped or could not be checked.
 *   GifOS.explicit.tracker(opts)       the video rule for one tile: feed(result) → { tripped, changed, burst }.
 *                                      Trips on k of the last n frames over the line (a single frame never acts);
 *                                      lifts by itself after `clean` frames in a row under it.
 *   GifOS.explicit.blockOn(room)       is the video blocker on for this room (the one scope rule, below)
 *   GifOS.explicit.MODEL, VERSION      the model id and the rule version a verdict names
 *
 * LIVE VIDEO (the blocker) uses stronger models on ONNX Runtime Web, pinned in js/safeguard/video.json, in a worker of
 * their own (js/safeguard/video-worker.js), with the same rules: downloaded once, checked byte for byte, no network
 * from the worker. A frame goes through a chain: a small model looks at every sampled frame; only what it finds
 * suspect goes to the next, and a frame counts as explicit only when every model in the chain says so (this is what
 * keeps babies, breastfeeding and sport clear). The confirming model (Freepik EVA02) is chosen per device at run time:
 * a desktop whose WebGPU passes a built-in self-test runs its fp32 build on the GPU, everyone else its int8 build on
 * WebAssembly (see the tier block below).
 *
 *   GifOS.explicit.video.open(opts)    Promise of the chain: { frame(src) → Promise<{ hit, s:[scores], ms }> }
 *   GifOS.explicit.video.watch(opts)   the blocker's loop: samples the pictures opts.sources() names, keeps one
 *                                      tracker per picture, and calls opts.onChange(id, tripped) on each trip and lift
 *   GifOS.explicit.video.RULE          the video rule's version
 *   GifOS.explicit.video.fuseScore(T,m,f,shift,fuse)  the keep/lift score of a held picture (FASTTRIP8, fitted per tier; see watch)
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});
  if (GifOS.explicit) return;

  // THE LINE. Measured on a public evaluation set of explicit and hard-benign pictures (swimwear, beach sport,
  // breastfeeding, babies, medical, art). No line keeps this model's hard-benign refusals low without losing most
  // explicit pictures, so the line sits where it catches the most; a refused thumbnail only asks for another picture.
  // A change of the line or the model is a new VERSION, so a stored verdict always says which line it passed.
  const MODEL = 'nsfwjs-mnv2';
  const VERSION = '4.4.0-1';
  const STILL_LINE = 0.5;    // a still picture (a thumbnail) is refused at or above this
  const VIDEO_LINE = 0.5;    // a video frame counts as a hit at or above this
  const CLASSES = ['drawing', 'hentai', 'neutral', 'porn', 'sexy'];
  const SIZE = 224;

  const here = (function () {
    try {
      const s = root.document && root.document.currentScript;
      if (s && s.src) return s.src.replace(/[^/]*$/, '');
    } catch (e) {}
    return '/js/';
  })();
  const DIR = here + 'safeguard/';
  const CACHE = 'gifos-explicit-v1';

  function unsupported() {
    const W = root.WebAssembly;
    if (!W || typeof W.instantiate !== 'function') return 'wasm';
    if (typeof root.Worker !== 'function') return 'worker';
    if (typeof root.OffscreenCanvas !== 'function' && !(root.document && root.document.createElement)) return 'canvas';
    return '';
  }

  // ---- the files: pinned, checked, cached ------------------------------------------
  let cat = null;
  function catalog(name) {
    if (!cat) {
      cat = fetch(DIR + (name || 'models.json'), { credentials: 'omit' }).then((r) => {
        if (!r.ok) throw new Error('download failed: models.json HTTP ' + r.status);
        return r.json();
      });
      cat.catch(() => { cat = null; });
    }
    return cat;
  }
  function hex(buf) {
    const u = new Uint8Array(buf);
    let out = '';
    for (let i = 0; i < u.length; i++) out += (u[i] < 16 ? '0' : '') + u[i].toString(16);
    return out;
  }
  function openCache() {
    try { return (root.caches && root.caches.open) ? root.caches.open(CACHE).catch(() => null) : Promise.resolve(null); } catch (e) { return Promise.resolve(null); }
  }
  // THE DOWNLOAD METER (Nathan 11-28): the bytes the first check needs (the runtime and the first model; pins marked
  // `first`) counted as they arrive, so a tile held back for it can say how far along it is. video.progress() / onProgress.
  const meter = { total: 0, done: 0, ready: false, fns: new Set() };
  let urgent = false;   // a picture is waiting on the models: no more low-priority fetches
  // PAUSE (MEETSLOW 11-28): the background download must never compete with a page the person is loading. Every low-priority
  // fetch carries lowAC's signal; pauseLow() aborts them all (a part never kept is dropped, a kept file is not fetched again).
  // A waiting picture (urgent) is never aborted.
  let lowAC = new AbortController();
  function pauseLow() { if (urgent) return false; try { lowAC.abort(); } catch (e) {} lowAC = new AbortController(); return true; }
  function note(n) {
    meter.done = Math.min(meter.total || Infinity, meter.done + n);
    meter.fns.forEach((f) => { try { f(); } catch (e) {} });
  }
  function readBody(r, pin) {
    if (!pin.first || !r.body || typeof r.body.getReader !== 'function') return r.arrayBuffer();
    const rd = r.body.getReader(), parts = [];
    let n = 0;
    const step = () => rd.read().then((x) => {
      if (x.done) {
        const out = new Uint8Array(n);
        let at = 0;
        for (const c of parts) { out.set(c, at); at += c.length; }
        return out.buffer;
      }
      parts.push(x.value); n += x.value.length; note(x.value.length);
      return step();
    });
    return step();
  }
  // One pinned file: the checked copy in Cache Storage when there is one, else a download checked against the pin
  // before it is kept or used. A body that does not match its pin is refused.
  function pinned(pin, cache) {
    const fromCache = cache ? cache.match(pin.url).then((hit) => {
      if (!hit || hit.headers.get('x-gifos-sha256') !== pin.sha256) return null;
      return hit.arrayBuffer().then((b) => { if (b.byteLength !== pin.bytes) return null; if (pin.first) note(b.byteLength); return b; });
    }).catch(() => null) : Promise.resolve(null);
    return fromCache.then((hit) => {
      if (hit) return hit;
      return fetch(pin.url, urgent ? { credentials: 'omit', mode: 'cors' } : { credentials: 'omit', mode: 'cors', priority: 'low', signal: lowAC.signal }).then((r) => {
        if (!r.ok) throw new Error('download failed: HTTP ' + r.status + ' for ' + pin.name);
        return readBody(r, pin);
      }).then((buf) => root.crypto.subtle.digest('SHA-256', buf).then((d) => {
        if (hex(d) !== pin.sha256) throw new Error('download failed: ' + pin.name + ' does not match its pin');
        const keep = cache ? cache.put(pin.url, new Response(buf.slice(0), { headers: { 'content-type': 'application/octet-stream', 'x-gifos-sha256': pin.sha256 } })).catch(() => {}) : null;
        return Promise.resolve(keep).then(() => buf);
      }));
    });
  }

  // ---- the engine ------------------------------------------------------------------
  let engine = null;
  function open(opts) {
    if (engine) return engine;
    opts = opts || {};
    const why = unsupported();
    if (why) return Promise.reject(new Error('this device cannot run the picture check (' + why + ')'));
    engine = Promise.all([catalog(opts.catalog), openCache()]).then(([c, cache]) => {
      const base = String(opts.base || c.base).replace(/\/+$/, '');
      const names = Object.keys(c.files), files = {};
      // One file at a time: a phone holds one download in flight.
      return names.reduce((p, k) => p.then(() => pinned(Object.assign({ url: base + '/' + c.files[k].key }, c.files[k]), cache).then((b) => { files[k] = b; })), Promise.resolve())
        .then(() => start(files, c.size || SIZE, c.format || 'layers', c.shards || ['weights']));
    });
    engine.catch(() => { engine = null; });
    return engine;
  }
  function start(files, size, format, shards) {
    return new Promise((resolve, reject) => {
      const w = new Worker(DIR + 'explicit-worker.js');
      const waiting = new Map();
      let seq = 0, ready = false;
      w.onmessage = (ev) => {
        const m = ev.data || {};
        if (m.op === 'ready') {
          ready = true;
          resolve({ backend: m.backend, size, run: run, close: () => { try { w.terminate(); } catch (e) {} engine = null; } });
          return;
        }
        if (m.op === 'error' && !ready) { try { w.terminate(); } catch (e) {} reject(new Error(m.error)); return; }
        const cb = waiting.get(m.id);
        if (!cb) return;
        waiting.delete(m.id);
        if (m.op === 'scores') cb.ok(m); else cb.bad(new Error(m.error || 'check failed'));
      };
      w.onerror = (e) => { if (!ready) reject(new Error((e && e.message) || 'worker failed')); };
      function run(rgba) {
        const id = ++seq;
        return new Promise((ok, bad) => {
          waiting.set(id, { ok, bad });
          w.postMessage({ op: 'run', id, w: size, h: size, buf: rgba.buffer }, [rgba.buffer]);
        });
      }
      const list = Object.keys(files).map((k) => files[k]);
      w.postMessage({ op: 'load', files, size, format, shards }, list);
    });
  }

  // A picture, stretched to the model's square input (what the model was trained on), as RGBA bytes.
  let pad = null;
  // square: only the centre square of the picture (a second look at a wide picture, the subject undistorted).
  function pixels(src, size, square) {
    if (!square && src && src.data && src.width === size && src.height === size) return new Uint8ClampedArray(src.data);
    if (!pad) {
      pad = typeof root.OffscreenCanvas === 'function' ? new root.OffscreenCanvas(size, size) : Object.assign(root.document.createElement('canvas'), { width: size, height: size });
    }
    const g = pad.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = true;
    try { g.imageSmoothingQuality = 'high'; } catch (e) {}
    g.clearRect(0, 0, size, size);
    if (src && src.data && src.width && src.height) {
      const tmp = typeof root.OffscreenCanvas === 'function' ? new root.OffscreenCanvas(src.width, src.height) : Object.assign(root.document.createElement('canvas'), { width: src.width, height: src.height });
      tmp.getContext('2d').putImageData(src, 0, 0);
      src = tmp;
    }
    const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
    if (!sw || !sh) throw new Error('no picture to check');
    const side = Math.min(sw, sh);
    if (square) g.drawImage(src, (sw - side) / 2, (sh - side) / 2, side, side, 0, 0, size, size);
    else g.drawImage(src, 0, 0, sw, sh, 0, 0, size, size);
    return g.getImageData(0, 0, size, size).data;
  }
  function score(p) { return (p.hentai || 0) + (p.porn || 0); }
  function classify(src, opts) {
    return open(opts).then((e) => e.run(pixels(src, e.size, !!(opts && opts.square))).then((m) => {
      const p = {};
      CLASSES.forEach((c, i) => { p[c] = m.p[i]; });
      const s = score(p);
      return { p, score: s, explicit: s >= VIDEO_LINE, ms: m.ms, backend: e.backend };
    }));
  }
  // A still picture: one decision, one look at the whole picture. (A second look at the centre square was measured:
  // 9 more of 107 explicit pictures caught, but 17 more benign ones refused, the Mona Lisa among them.)
  // A picture that could not be checked has no verdict, exactly like one that tripped.
  function checkStill(src, opts) {
    return classify(src, opts).then((r) => {
      const ok = r.score < STILL_LINE;
      return { ok, verdict: ok ? { m: MODEL, v: VERSION, ok: 1 } : null, score: r.score, ms: r.ms, p: r.p };
    });
  }

  // ---- the video rule ----------------------------------------------------------------
  // k hits in the last n frames trip it; `clean` frames in a row under the line lift it. `burst` says the caller should
  // look again soon (a first hit starts a short burst of frames, so a trip is decided in seconds, not minutes).
  function tracker(opts) {
    opts = opts || {};
    const k = opts.k || 2, n = opts.n || 3, clean = opts.clean || 5, line = opts.line == null ? VIDEO_LINE : opts.line;
    let last = [], tripped = false, run = 0;
    return {
      feed(r) {
        const hit = (typeof r === 'number' ? r : r.score) >= line;
        last.push(hit); if (last.length > n) last.shift();
        run = hit ? 0 : run + 1;
        const was = tripped;
        if (!tripped && last.filter(Boolean).length >= k) tripped = true;
        else if (tripped && run >= clean) { tripped = false; last = []; }
        return { tripped, changed: was !== tripped, burst: !tripped && hit };
      },
      state() { return { tripped, run, last: last.slice() }; },
      reset() { last = []; tripped = false; run = 0; },
    };
  }

  // ---- where the video blocker is on (docs: Nathan's scope rule) -------------------------------
  // room = { open, password, listed, hostBlock }. Always on in an open room (password or not), in a hosted room with no
  // password, and in any room listed on gifos.tv; in a hosted room with a password it follows the host's setting
  // "Block explicit content", which is on unless the host turned it off (hostBlock === false).
  function blockOn(room) {
    room = room || {};
    if (room.open || room.listed || !room.password) return true;
    return room.hostBlock !== false;
  }

  // ---- live video: the blocker's models (docs: safeguard S6) -----------------------------------
  // A chain of models on ONNX Runtime Web (js/safeguard/video.json): every sampled frame goes to the first; a frame
  // only goes on while each model in turn finds it over its line, and it counts as explicit only when the last one
  // does. The lines were chosen on the public evaluation set to refuse about 1 in 100 hard-benign pictures
  // (breastfeeding, babies, sport, medicine). A change of a line or a model is a new rule version.
  const RULE = 'xv-3';
  const mobileUa = () => {
    try {
      const n = root.navigator || {}, ua = String(n.userAgent || '');
      return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && (n.maxTouchPoints || 0) > 1);
    } catch (e) { return false; }
  };
  let vcat = null;
  function videoCatalog(name) {
    if (!vcat) {
      vcat = fetch(DIR + (name || 'video.json'), { credentials: 'omit' }).then((r) => {
        if (!r.ok) throw new Error('download failed: video.json HTTP ' + r.status);
        return r.json();
      });
      vcat.catch(() => { vcat = null; });
    }
    return vcat;
  }
  function pinsFrom(c, opts) {
    const base = String((opts && opts.base) || c.base).replace(/\/+$/, '');
    return (f) => Object.assign({ url: base + '/' + f.key }, f);
  }
  // One worker: the runtime, then models by id, then frames. Every byte it gets was checked against its pin.
  function vworker() {
    const w = new Worker(DIR + 'video-worker.js');
    const waiting = new Map(), loads = new Map();
    let seq = 0, rt = null, dead = '';
    const failAll = (why) => {
      dead = why;
      if (rt) { rt.bad(new Error(why)); rt = null; }
      for (const cb of loads.values()) cb.bad(new Error(why));
      for (const cb of waiting.values()) cb.bad(new Error(why));
      loads.clear(); waiting.clear();
    };
    w.onmessage = (ev) => {
      const m = ev.data || {};
      if (m.op === 'runtime') { if (rt) { const cb = rt; rt = null; m.ok ? cb.ok(m.ep) : cb.bad(new Error(m.error)); } return; }
      if (m.op === 'model') { const cb = loads.get(m.id); if (cb) { loads.delete(m.id); m.ok ? cb.ok({ ms: m.ms, loadMs: m.loadMs }) : cb.bad(new Error(m.error)); } return; }
      const cb = waiting.get(m.seq);
      if (!cb) return;
      waiting.delete(m.seq);
      if (m.op === 'scores') cb.ok({ p: m.p, ms: m.ms }); else cb.bad(new Error(m.error || 'check failed'));
    };
    w.onerror = (e) => failAll((e && e.message) || 'worker failed');
    return {
      runtime(files, ep) {
        return new Promise((ok, bad) => { rt = { ok, bad }; w.postMessage({ op: 'runtime', files, ep }, [files.js, files.wasm, files.mjs]); });
      },
      load(id, bytes, m) {
        if (dead) return Promise.reject(new Error(dead));
        return new Promise((ok, bad) => { loads.set(id, { ok, bad }); w.postMessage({ op: 'model', id, bytes, size: m.size, mean: m.mean, std: m.std }, [bytes]); });
      },
      run(id, rgba) {
        if (dead) return Promise.reject(new Error(dead));
        const s = ++seq;
        return new Promise((ok, bad) => { waiting.set(s, { ok, bad }); w.postMessage({ op: 'run', seq: s, id, buf: rgba.buffer }, [rgba.buffer]); });
      },
      close() { failAll('closed'); try { w.terminate(); } catch (e) {} },
    };
  }
  // A frame, stretched to a model's square input, as RGBA bytes (one canvas per size).
  const vpads = new Map();
  function vpixels(src, size) {
    let g = vpads.get(size);
    if (!g) {
      const c = typeof root.OffscreenCanvas === 'function' ? new root.OffscreenCanvas(size, size) : Object.assign(root.document.createElement('canvas'), { width: size, height: size });
      g = c.getContext('2d', { willReadFrequently: true });
      g.imageSmoothingEnabled = true;
      try { g.imageSmoothingQuality = 'high'; } catch (e) {}
      vpads.set(size, g);
    }
    const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
    if (!sw || !sh) throw new Error('no picture to check');
    g.drawImage(src, 0, 0, sw, sh, 0, 0, size, size);
    return g.getImageData(0, 0, size, size).data;
  }
  // One still of a video, so every model in the chain sees the same frame.
  function snap(src) {
    if (typeof root.createImageBitmap === 'function' && src && (src.videoWidth || src.width)) return root.createImageBitmap(src).catch(() => src);
    return Promise.resolve(src);
  }
  const posScore = (p, m) => m.pos.reduce((a, k) => a + (p[m.labels.indexOf(k)] || 0), 0);
  async function fetchRuntime(rtc, pin, cache) {
    const out = {};
    for (const k of ['js', 'wasm', 'mjs']) out[k] = await pinned(pin(rtc[k]), cache);
    return out;
  }

  // ---- the confirming model, chosen per device (FREEPIKSWAP, Nathan 11-28) ---------------------------------------
  // Freepik EVA02 (MIT) confirms what the first model flags. A desktop whose browser has a WebGPU adapter that passes a built-in
  // self-test runs its fp32 build on the GPU (c.gpu: the GPU runtime in a worker of its own); everyone else (phones, desktops
  // without a good GPU, a failed self-test) runs the int8 build on WebAssembly, the chain's second stage. fp16, int8 and 4-bit
  // builds give wrong or all-zero answers on some GPUs, so only an fp32 build that reproduces the reference answers is trusted.
  // The self-test pictures are made up here from integer arithmetic (the same bytes on every device); c.gpu.selftest holds the
  // class probabilities a reference machine gets for each. A GPU that fails, or is slower than gpu.maxMs a frame, is
  // remembered (gpu.rememberMs, a week) so the 340 MB download is not repeated for it. Both limits are in the catalog, so a page without the timings table (gifos.tv's preload) judges the same.
  const GPU_VERDICT = 'gifos-xv-gpu-v1';
  function testFrame(size, k) {
    const out = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let h = (Math.imul(x >> 3, 374761393) + Math.imul(y >> 3, 668265263) + Math.imul(k + 1, 1013904223)) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; h >>>= 0;
        let r = ((h & 255) >> 1) + Math.floor((x * 127) / size), g = (((h >>> 8) & 255) >> 1) + Math.floor((y * 127) / size), b = (((h >>> 16) & 255) >> 1) + Math.floor(((x + y) * 127) / (2 * size));
        if (k % 3 === 1) { r = (r + 630) >> 2; g = (g + 450) >> 2; b = (b + 360) >> 2; }   // skin tinted
        const o = (y * size + x) * 4;
        out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
      }
    }
    return out;
  }
  function verdictGet(key, keepMs) {
    try { const v = JSON.parse(root.localStorage.getItem(GPU_VERDICT) || '{}')[key]; return v && Date.now() - v.at < keepMs ? v : null; } catch (e) { return null; }
  }
  function verdictSet(key, why) {
    try { const o = JSON.parse(root.localStorage.getItem(GPU_VERDICT) || '{}'); o[key] = { at: Date.now(), why }; root.localStorage.setItem(GPU_VERDICT, JSON.stringify(o)); } catch (e) {}
  }
  // The GPU tier: { ok:true, m, w, ms } or { ok:false, why }. Throws only when a download fails (the device is not at fault).
  async function openGpuTier(c, pin, cache, opts) {
    const g = c.gpu;
    if (!g || !c.gpuRuntime) return { ok: false, why: 'no gpu model' };
    if (opts.mobile != null ? opts.mobile : mobileUa()) return { ok: false, why: 'phone' };
    const gpu = root.navigator && root.navigator.gpu;
    if (!gpu) return { ok: false, why: 'no webgpu' };
    let a = null;
    try { a = await gpu.requestAdapter(); } catch (e) {}
    if (!a) return { ok: false, why: 'no adapter' };
    let info = a.info || {};
    try { if (!a.info && typeof a.requestAdapterInfo === 'function') info = await a.requestAdapterInfo(); } catch (e) {}
    const key = [info.vendor, info.architecture, info.device, info.description, g.file.sha256.slice(0, 12)].join('|');
    const known = verdictGet(key, g.rememberMs);
    if (known) return { ok: false, why: 'remembered: ' + known.why };
    const w = vworker();
    const bad = (why) => { verdictSet(key, why); w.close(); return { ok: false, why }; };
    try {
      await w.runtime(await fetchRuntime(c.gpuRuntime, pin, cache), 'webgpu');
      const bytes = await pinned(pin(g.file), cache);
      try { await w.load(g.id, bytes, g); } catch (e) { return bad('load failed: ' + String((e && e.message) || e).slice(0, 80)); }
      for (let i = 0; i < g.selftest.length; i++) {
        const t = g.selftest[i];
        let r;
        try { r = await w.run(g.id, testFrame(g.size, t.k)); } catch (e) { return bad('self-test run failed: ' + String((e && e.message) || e).slice(0, 80)); }
        const d = Math.max.apply(null, t.p.map((x, j) => Math.abs(x - (r.p[j] == null ? 9 : r.p[j]))));
        if (!(d <= g.tol)) return bad('self-test ' + i + ' off by ' + (Math.round(d * 1e4) / 1e4));
      }
      const t = await w.run(g.id, testFrame(g.size, g.selftest[0].k));
      const max = opts.gpuMaxMs || g.maxMs;   // from the catalog: a page without the timings table (gifos.tv's preload) judges the same
      if (!(t.ms <= max)) return bad('slow: ' + t.ms + ' ms a frame');
      return { ok: true, m: g, w, ms: t.ms };
    } catch (e) { w.close(); throw e; }
  }

  let chainP = null;
  function videoOpen(opts) {
    if (chainP) return chainP;
    opts = opts || {};
    const why = unsupported();
    if (why) return Promise.reject(new Error('this device cannot run the video check (' + why + ')'));
    chainP = (async () => {
      const [c, cache] = await Promise.all([videoCatalog(opts.catalog), openCache()]);
      const pin0 = pinsFrom(c, opts);
      const pin = (f) => Object.assign(pin0(f), { first: !meter.ready });   // counted in the meter until the first check is ready
      if (!meter.total) meter.total = ['js', 'wasm', 'mjs'].reduce((a, k) => a + (c.runtime[k].bytes || 0), 0) + c.chain.filter((m) => !m.lazy).reduce((a, m) => a + (m.file.bytes || 0), 0);
      const w = vworker();
      try {
        await w.runtime(await fetchRuntime(c.runtime, pin, cache), 'wasm');
        const stages = c.chain.map((m) => Object.assign({}, m, { ready: null, ms: 0 }));
        // A model loads on its first use: the later stages of the chain only when a frame first reaches them.
        const ready = (m) => m.ready || (m.ready = pinned(pin(m.file), cache).then((b) => w.load(m.id, b, m)).then((t) => { m.ms = t.ms; }, (e) => { m.ready = null; throw e; }));
        for (const m of stages) if (!m.lazy) await ready(m);
        meter.ready = true; meter.done = meter.total; note(0);
        // THE TIER (decided once per page, on the first need or at the preload): the GPU model when this device passes its self-test,
        // else the chain's second stage on WebAssembly.
        let tierP = null;
        const tier = () => {
          if (!tierP) {
            tierP = (async () => {
              let g = { ok: false, why: '' };
              try { g = await openGpuTier(c, pin, cache, opts); } catch (e) { g = { ok: false, why: 'gpu model not downloaded: ' + String((e && e.message) || e).slice(0, 80) }; }
              if (g.ok) return { kind: 'gpu', m: g.m, w: g.w, ms: g.ms, why: '' };
              await ready(stages[1]);
              return { kind: 'wasm', m: stages[1], w, ms: stages[1].ms, why: g.why };
            })();
            tierP.catch(() => { tierP = null; });
          }
          return tierP;
        };
        // The confirming look on one still: { v, m } (m: the model's catalog entry, line and fit included).
        const second = async (bmp) => {
          const t = await tier();
          const r = await t.w.run(t.m.id, vpixels(bmp, t.m.size));
          return { v: posScore(r.p, t.m), m: t.m, tier: t.kind };
        };
        const release = (bmp, src) => { if (bmp !== src && bmp && bmp.close) try { bmp.close(); } catch (e) {} };
        return {
          rule: RULE, backend: 'wasm', stages,
          // onFirst(v0): called the moment the first (fast) model has scored the frame, before the slower one runs, so a
          // suspect picture can be hidden at once (the asymmetric trip, FASTTRIP). first(src): the first model alone.
          frame(src, onFirst) {
            const t0 = performance.now();
            return snap(src).then(async (bmp) => {
              const s = [];
              try {
                const m0 = stages[0];
                await ready(m0);
                const v0 = posScore((await w.run(m0.id, vpixels(bmp, m0.size))).p, m0);
                s.push(Math.round(v0 * 1e4) / 1e4);
                if (onFirst) { try { onFirst(v0, m0); } catch (e) {} }
                if (v0 < m0.line) return { hit: false, s, ms: Math.round(performance.now() - t0) };
                const r = await second(bmp);
                s.push(Math.round(r.v * 1e4) / 1e4);
                return { hit: r.v >= r.m.line, s, ms: Math.round(performance.now() - t0) };
              } finally { release(bmp, src); }
            });
          },
          first(src) {
            const t0 = performance.now(), m = stages[0];
            return snap(src).then(async (bmp) => {
              try {
                await ready(m);
                const v = posScore((await w.run(m.id, vpixels(bmp, m.size))).p, m);
                return { v, suspect: v >= (m.suspect == null ? m.line : m.suspect), warm: v >= m.line, ms: Math.round(performance.now() - t0) };
              } finally { release(bmp, src); }
            });
          },
          // The confirming model alone on one picture: { v, line, hit, ms, fuse, tier }. fuse = the tier's keep/lift fit (a, b, c, g).
          confirm(src) {
            const t0 = performance.now();
            return snap(src).then(async (bmp) => {
              try {
                const r = await second(bmp), line = r.m.confirm == null ? r.m.line : r.m.confirm;
                return { v: r.v, line, hit: r.v >= line, ms: Math.round(performance.now() - t0), fuse: r.m.fuse, tier: r.tier };
              } finally { release(bmp, src); }
            });
          },
          // PRELOAD (FASTTRIP5): ready every model now (the tier decided, its confirming model included) so the first confirm costs
          // inference only. Bytes come from the Cache Storage copy (one download per device). Resolves { ms, err, tier, why } and never throws.
          preload() {
            const t0 = performance.now();
            return Promise.all(stages.filter((m) => !m.lazy).map((m) => ready(m)).concat([tier()])).then((r) => {
              const t = r[r.length - 1];
              return { ms: Math.round(performance.now() - t0), err: '', tier: t.kind, why: t.why, frameMs: t.ms };
            }, (e) => ({ ms: Math.round(performance.now() - t0), err: String((e && e.message) || e) }));
          },
          tier: () => tier().then((t) => ({ kind: t.kind, id: t.m.id, ms: t.ms, why: t.why })),
          suspectLine: stages[0].suspect == null ? stages[0].line : stages[0].suspect,
          warmLine: stages[0].line,
          close() { w.close(); if (tierP) tierP.then((t) => { if (t.kind === 'gpu') t.w.close(); }, () => {}); chainP = null; },
        };
      } catch (e) { w.close(); throw e; }
    })();
    chainP.catch(() => { chainP = null; });
    return chainP;
  }

  // ---- the blocker's loop ---------------------------------------------------------------------------
  // opts.sources() → [{ id, el }] or [{ id, track }]: the pictures this page must check now (a picture shown clear or
  // nearly clear, and every picture that is tripped, so it can lift). opts.onChange(id, tripped) on each edge.
  // The page samples ONE frame at a time across all of them, oldest look first, a picture with a fresh hit first (its
  // second look comes within the burst time, so a trip takes seconds). The gap after a frame keeps the check's share
  // of one processor at the duty limit (lower on phones, to keep them cool): a slow device looks less often, never
  // stops looking. Nothing leaves the page: no frame, no score, no trip.
  // The keep/lift score of a held picture: m = first-model score, f = confirming-model score, shift = the scene's offset (<= 0),
  // fuse = the confirming tier's fit { a, b, c, g } from video.json: s = a*logit(m) + b*g(f) + c + shift, g = log10(f+eps) ('log')
  // or logit(f) ('logit'), whichever suits that model's score scale (FREEPIKSWAP: fitted per tier on real confirming scores).
  function fuseScore(T, m, f, shift, fuse) {
    const p = Math.min(0.999, Math.max(0.001, m));
    const g = fuse.g === 'logit' ? Math.log(Math.min(1 - 1e-4, Math.max(1e-4, f)) / (1 - Math.min(1 - 1e-4, Math.max(1e-4, f)))) : Math.log10(f + T.XV_FUSE_F_EPS);
    return fuse.a * Math.log(p / (1 - p)) + fuse.b * g + fuse.c + shift;
  }
  function watch(opts) {
    const T = Object.assign({}, (root.GifOS && root.GifOS.timings) || {}, opts.timings || {});
    const mobile = opts.mobile != null ? !!opts.mobile : mobileUa();
    const duty = (mobile ? T.XV_DUTY_PHONE_PCT : T.XV_DUTY_DESK_PCT) / 100;
    const fduty = (mobile ? T.XV_FIRST_DUTY_PHONE_PCT : T.XV_FIRST_DUTY_DESK_PCT) / 100;
    const open = opts.engine ? () => Promise.resolve(opts.engine) : () => { urgent = true; return videoOpen(opts); };
    const log = typeof opts.log === 'function' ? opts.log : () => {};
    const gate = opts.gate !== false;   // a picture new to this page is held back until its first look passes (FASTTRIP 4)
    const recs = new Map();   // id -> per-picture record (see rec)
    const hidden = new Map(); // track -> video element of our own (a track with no element on the page)
    let tierNow = '', engAt = 0, stopped = false, timer = null, senseTimer = null, eng = null, avg = 0, avgF = 0, gap = 0, frames = 0, err = '', fullReadyAt = 0, busy = false, bursts = 0;
    const now = () => Date.now();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // r.tripped: the chain confirmed (two hits of three frames). r.sus: ONE frame passed the first model's suspect line:
    // hidden at once, lifted after XV_SUSPECT_CLEAN first-model-clean frames unless the chain confirms. r.pend: new to
    // this page, held back for its first look. A picture is held while any of the three is set; kind says which ('' |
    // 'checking' for pend alone | 'unsafe').
    const rec = (id) => {
      let r = recs.get(id);
      if (!r) recs.set(id, (r = { t: tracker(), tripped: false, sus: false, hotUntil: 0, confirm: false, shift: 0, shiftUntil: 0, shiftRef: 0, S: null, m0: 0, confirmAt: 0, lifts: [], looksHi: [], lastLook: 0, strong: false, peak: 0, need: 1, holdUntil: 0, pend: false, pendAt: 0, kind: '', susClean: 0, changed: false, chgAt: 0, nextChg: 0, warm: false, prev: null, at: 0, n: 0, hits: 0, s: null, fresh: true }));
      return r;
    };
    const ready = (el) => !!el && ((el.videoWidth > 0 && el.readyState >= 2) || (!('videoWidth' in el) && el.width > 0));
    function elOf(src) {
      if (src.el) return src.el;
      if (!src.track || !root.document) return null;
      let v = hidden.get(src.track);
      if (!v) {
        v = root.document.createElement('video');
        v.muted = true; v.playsInline = true; v.setAttribute('aria-hidden', 'true');
        v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
        v.srcObject = new root.MediaStream([src.track]);
        try { (root.document.body || root.document.documentElement).appendChild(v); } catch (e) {}
        const p = v.play(); if (p && p.catch) p.catch(() => {});
        hidden.set(src.track, v);
      }
      return v;
    }
    function list() {
      let a = [];
      try { a = opts.sources() || []; } catch (e) { a = []; }
      const ids = new Set(a.map((x) => x.id)), tracks = new Set(a.map((x) => x.track).filter(Boolean));
      // A picture that is no longer shown or sent is forgotten: a trip on it ends with it.
      for (const [id, r] of recs) if (!ids.has(id)) { recs.delete(id); if (r.kind) log('xv lift ' + String(id).slice(0, 8) + ' gone'), tell(id, '', 'gone'); }
      for (const [t, v] of hidden) if (!tracks.has(t)) { try { v.srcObject = null; v.remove(); } catch (e) {} hidden.delete(t); }
      return a;
    }
    function tell(id, kind, why) {
      try { opts.onChange(id, !!kind, why, kind); } catch (e) {}
    }
    // The one place a picture's held state is decided and reported (each change of kind is one edge).
    function emit(id, r, why) {
      const kind = (r.tripped || r.sus) ? 'unsafe' : r.pend ? 'checking' : '';
      if (kind === r.kind) return;
      r.kind = kind;
      log('xv ' + (kind ? 'TRIP ' : 'lift ') + String(id).slice(0, 8) + ' ' + why + (kind === 'checking' ? ' (checking)' : ''));
      tell(id, kind, why);
    }
    // One continuous mapping, suspicion score -> how long a suspect picture is held and how many clean first-model looks
    // lift it: f = ((score - line) / (XV_STRONG - line)) ^ XV_HOLD_CURVE (1 from XV_STRONG up), then hold =
    // lerp(XV_HOLD_MIN_MS, XV_HOLD_MAX_MS, f) and clean = round(lerp(XV_CLEAN_MIN, XV_CLEAN_MAX, f)). A weak suspicion
    // blurs on its first look and lifts at the first clean look; a strong one (XV_STRONG and up) holds longest.
    function holdFor(score) {
      const line = eng && eng.suspectLine != null ? eng.suspectLine : 0.2;
      const f = Math.pow(Math.min(1, Math.max(0, (score - line) / Math.max(1e-6, T.XV_STRONG - line))), T.XV_HOLD_CURVE);
      return { hold: T.XV_HOLD_MIN_MS + (T.XV_HOLD_MAX_MS - T.XV_HOLD_MIN_MS) * f, clean: Math.round(T.XV_CLEAN_MIN + (T.XV_CLEAN_MAX - T.XV_CLEAN_MIN) * f) };
    }
    // THE RE-FLAG ARMING: a picture the first model keeps flagging after the confirming model called it clean is re-checked sooner
    // and re-trips at once (the confirming model's clean still lifts it every time). Armed by XV_REFLAG_LIFTS clean lifts of one picture inside
    // XV_REFLAG_LIFT_MS, or XV_REFLAG_LOOKS first looks at or over XV_REFLAG_LINE inside XV_REFLAG_LOOK_MS. The picture's raised bar (see confirmJob) stays.
    const recent = (a, win) => { const t = now(); while (a.length && t - a[0] > win) a.shift(); return a.length; };
    function noteLook(id, r, v0) {
      if (v0 < T.XV_REFLAG_LINE || now() - r.lastLook < 200) return;   // one look is fed twice (its callback, then feed)
      r.lastLook = now(); r.looksHi.push(r.lastLook);
      if (recent(r.looksHi, T.XV_REFLAG_LOOK_MS) >= T.XV_REFLAG_LOOKS) arm(id, r, 'looks');
    }
    const reHold = () => { const h = holdFor(T.XV_STRONG); return { hold: Math.min(h.hold, T.XV_REFLAG_HOLD_MS), clean: h.clean }; };   // the strong clean count, a shorter floor
    function arm(id, r, why) {
      if (r.strong) return;
      r.strong = true;   // the confirming look still runs: its clean lifts (miss-first is not miss-forever)
      const h = reHold();
      if (r.sus) { r.peak = Math.max(r.peak, T.XV_STRONG); r.holdUntil = Math.max(r.holdUntil, now() + h.hold); r.need = Math.max(r.need, h.clean); }
      log('xv reflag ' + String(id).slice(0, 8) + ' ' + why + ' strong hold');
    }
    function setSus(id, r, v0) {
      r.m0 = v0;
      noteLook(id, r, v0);
      if (!r.strong && !r.sus && !r.tripped && recent(r.lifts, T.XV_REFLAG_LIFT_MS) >= T.XV_REFLAG_LIFTS) arm(id, r, 'lifts');
      // THE SCENE'S OFFSET (see confirmJob): repeated clean confirms on one scene moved its offset toward clear, which also lifts the
      // quick-trip line for that scene. A clearly higher score (XV_BENIGN_MARGIN over the one last called clean) resets it at once.
      if (r.shift < 0 && now() > r.shiftUntil) r.shift = 0;
      if (!r.sus && !r.tripped && v0 < T.XV_STRONG && r.shift < 0) {
        if (v0 >= r.shiftRef + T.XV_BENIGN_MARGIN) r.shift = 0;
        else if (v0 < (eng && eng.suspectLine != null ? eng.suspectLine : 0.25) - r.shift * T.XV_FUSE_LINE_GAIN) return;
      }
      if (r.sus || r.tripped) { r.susClean = 0; if (r.sus && v0 > r.peak) { r.peak = v0; const h = holdFor(v0); r.holdUntil = Math.max(r.holdUntil, now() + h.hold); r.need = Math.max(r.need, h.clean); } return; }
      const h = r.strong ? reHold() : holdFor(v0);
      r.peak = r.strong ? Math.max(v0, T.XV_STRONG) : v0; r.need = h.clean; r.holdUntil = now() + h.hold;
      r.sus = true; r.susClean = 0; r.pend = false; r.confirm = v0 < T.XV_STRONG && !!eng.confirm; r.S = r.confirm ? T.XV_FUSE_S0 : null;
      log('xv suspect ' + String(id).slice(0, 8) + ' v0=' + Math.round(v0 * 1e4) / 1e4 + ' hold=' + Math.round(h.hold) + 'ms clean=' + h.clean);
      emit(id, r, 'suspect');
    }
    function feed(id, r, res, lane) {
      r.n++; r.s = res.s;
      if (res.hit) r.hits++;
      const o = r.t.feed(res.hit ? 1 : 0);
      if (res.hit || o.changed) log('xv ' + lane + ' ' + String(id).slice(0, 8) + ' ' + (res.hit ? 'hit' : 'clean') + ' s=' + JSON.stringify(res.s) + ' ' + res.ms + 'ms');
      r.tripped = r.t.state().tripped;
      if (eng) {
        r.m0 = res.s[0];
        const sl = eng.suspectLine == null ? 1 : eng.suspectLine;
        r.warm = res.s.length > 1 || res.s[0] >= (eng.warmLine == null ? 0.05 : eng.warmLine);
        if (res.s[0] >= sl) r.hotUntil = now() + T.XV_HOT_MS;
        if (r.sus) {
          if (res.s[0] >= sl) setSus(id, r, res.s[0]); else r.susClean++;
          if (r.tripped || (r.S == null && r.susClean >= r.need && now() >= r.holdUntil)) { r.sus = false; r.strong = false; r.S = null; }   // a picture the confirming model weighs in on is kept or lifted by its score S alone
        } else if (!r.tripped && res.s[0] >= sl) setSus(id, r, res.s[0]);   // the chain's trip lifted on a picture still suspect: stay blurred, no blink
        r.pend = false;
      }
      emit(id, r, r.tripped ? 'confirm' : 'lift');
    }
    // 32x32 luma of the picture, or null: the cheap change sense (a few KB a look, no model).
    let sg = null;
    function luma(el) {
      if (typeof opts.luma === 'function') return opts.luma(el);
      try {
        if (!sg) {
          const c = typeof root.OffscreenCanvas === 'function' ? new root.OffscreenCanvas(32, 32) : Object.assign(root.document.createElement('canvas'), { width: 32, height: 32 });
          sg = c.getContext('2d', { willReadFrequently: true });
        }
        sg.drawImage(el, 0, 0, 32, 32);
        const d = sg.getImageData(0, 0, 32, 32).data, out = new Uint8Array(1024);
        for (let i = 0; i < 1024; i++) out[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8;
        return out;
      } catch (e) { return null; }
    }
    const lumaDiff = (a, b) => { let t = 0; for (let i = 0; i < a.length; i++) t += Math.abs(a[i] - b[i]); return t / a.length; };
    // The sense: runs on its own short clock. A picture new to the page, or whose picture changed a lot, asks for a burst
    // of first-model looks now; a new one is held back (pend) until the burst passes, at most XV_PEND_MAX_MS.
    function sense() {
      senseTimer = null;
      if (stopped) return;
      let kick = false;
      try {
        for (const src of list()) {
          const el = elOf(src);
          if (!ready(el)) continue;
          const r = rec(src.id), t = now();
          if (r.fresh) {
            r.fresh = false;
            if (gate && !r.kind) { r.pend = true; r.pendAt = t; emit(src.id, r, 'new'); }   // held while the models still download too (the tile says how far along)
            r.changed = true; kick = true;
          }
          const l = luma(el);
          if (l && r.prev && t >= r.nextChg && lumaDiff(l, r.prev) >= T.XV_SENSE_DIFF) { r.changed = true; r.shift = 0; kick = true; }
          if (l) r.prev = l;
          if (r.pend && eng && t - Math.max(r.pendAt, engAt) >= T.XV_PEND_MAX_MS) { r.pend = false; emit(src.id, r, 'late'); }   // the cap counts from when the check could first look
        }
      } catch (e) {}
      if (kick && !busy && eng) { if (timer) clearTimeout(timer); timer = setTimeout(tick); }
      if (!stopped) senseTimer = setTimeout(sense, T.XV_SENSE_MS * (mobile ? 2 : 1));
    }
    // A burst: a few first-model looks a moment apart. ONE look over the suspect line trips (the hold is scaled to the
    // score, so a weak blip is a short blur); the burst ends at that look.
    async function burstJob(src, el, r) {
      const t0 = now(), sc = [];
      r.changed = false; bursts++;
      for (let i = 0; i < (mobile ? T.XV_BURST_N_PHONE : T.XV_BURST_N) && !stopped; i++) {
        if (i) await sleep(T.XV_BURST_FRAME_MS);
        const x = await eng.first(el);
        sc.push(x.v);
        if (x.v >= (eng.suspectLine == null ? 1 : eng.suspectLine)) break;
      }
      const sl = eng.suspectLine == null ? 1 : eng.suspectLine;
      const sus = sc.some((v) => v >= sl);
      const cost = now() - t0;
      r.nextChg = now() + Math.max(T.XV_CHANGE_MIN_MS, cost / fduty);   // a change burst never goes over the first lane's duty
      r.chgAt = now(); r.at = now();
      log('xv burst ' + String(src.id).slice(0, 8) + ' ' + JSON.stringify(sc.map((v) => Math.round(v * 100) / 100)) + ' ' + cost + 'ms' + (sus ? ' suspect' : ''));
      if (sus) r.hotUntil = now() + T.XV_HOT_MS;
      if (sus) setSus(src.id, r, Math.max.apply(null, sc));
      else { r.pend = false; if (sc.some((v) => v >= (eng.warmLine == null ? 0.05 : eng.warmLine))) r.warm = true; emit(src.id, r, 'checked'); }
    }
    // THE CONFIRMING LOOK: a picture held on a weak first look (below XV_STRONG) gets the confirming model at once. Explicit: it
    // becomes a strong trip (the long hold). Clean: it lifts, and its weak band stays benign for a while (see setSus).
    async function confirmJob(src, el, r) {
      r.confirm = false;
      const res = await eng.confirm(el);
      if (stopped) return;
      r.at = now();
      if (!r.sus || r.tripped) { log('xv confirm ' + String(src.id).slice(0, 8) + ' v=' + Math.round(res.v * 1e4) / 1e4 + ' ignored'); return; }
      // THE KEEP/LIFT SCORE (Nathan 2026-11-28): s = A*logit(m) + B*log10(f+eps) + C + the scene's offset (+ the optional third model), smoothed
      // S = LAMBDA*S + (1-LAMBDA)*s over this picture's confirming looks. The blur stays while S >= 0 and lifts when S < 0. A very low f pulls s
      // down: clean means clear, no special case. The confirming model's own hit/clean flag is not read: its score is.
      const s = fuseScore(T, r.m0, res.v, r.shift, res.fuse);
      r.S = T.XV_FUSE_LAMBDA * (r.S == null ? T.XV_FUSE_S0 : r.S) + (1 - T.XV_FUSE_LAMBDA) * s;
      log('xv confirm ' + String(src.id).slice(0, 8) + ' f=' + Math.round(res.v * 1e4) / 1e4 + ' m=' + Math.round(r.m0 * 1e3) / 1e3 + ' s=' + Math.round(s * 100) / 100 + ' S=' + Math.round(r.S * 100) / 100 + ' ' + res.ms + 'ms');
      const ln = res.line > 0 ? res.line : 0.05, c = Math.min(1, Math.max(0, Math.log(ln / Math.max(1e-9, res.v)) / Math.log(ln / T.XV_CONFIRM_SURE)));
      if (c > 0) {   // the confirming model calls it clean (under its own line)
        // PER-SCENE SHIFT: a clean confirm (f under the confirming model's line) moves this scene's offset toward clear by XV_FUSE_STEP scaled by the confirm's certainty c (0 at the
        // confirming model's line, 1 at XV_CONFIRM_SURE, log scale); the quick-trip line for the scene rises with it, and it lasts lerp(XV_BENIGN_MIN_MS, XV_BENIGN_MS, c).
        r.shiftRef = r.shift < 0 ? Math.max(r.shiftRef, r.m0) : r.m0;
        r.shift = Math.max(-T.XV_FUSE_SHIFT_MAX, r.shift - T.XV_FUSE_STEP * c);
        r.shiftUntil = now() + T.XV_BENIGN_MIN_MS + (T.XV_BENIGN_MS - T.XV_BENIGN_MIN_MS) * c;
      }
      if (r.S >= 0) { r.confirm = true; r.confirmAt = now() + Math.max(T.XV_GAP_MIN_MS, res.ms / duty); return; }   // keep: ask again, within the duty share
      r.lifts.push(now());
      r.sus = false; r.strong = false; r.S = null;
      emit(src.id, r, 'benign');
    }
    // The next picture to look at, in this order: (0) a new picture held back for its first look; (1) a HOT picture (a suspect
    // or tripped one, which needs looks to lift, or one with a look over the suspect line in the last XV_HOT_MS) and any picture
    // overdue for its regular look, the one looked at longest ago first (so no picture starves another, and a picture that
    // stays suspect cannot hold every look); (2) a picture that changed (a change burst, which never goes ahead of the above:
    // scene cuts in film must not spend the looks an explicit picture needs); (3) the one looked at longest ago. A warm picture
    // (past the first model's line: its looks reach the slow models) waits for the full lane's duty budget.
    function pick(a) {
      const t = now();
      let best = null, bk = Infinity, bc = Infinity;
      const cb = -1;
      const due = Math.min(T.XV_GAP_MAX_MS, Math.max(T.XV_FIRST_GAP_MIN_MS, (avgF || 100) / fduty));
      for (const src of a) {
        const el = elOf(src);
        if (!ready(el)) continue;
        const r = rec(src.id);
        if (r.confirm && r.sus && !r.tripped && now() >= r.confirmAt) { if (!(cb < bc || (cb === bc && r.at < bk))) continue; bc = cb; bk = r.at; best = { src, el, r, job: 'confirm' }; continue; }
        const hot = r.sus || r.tripped || r.hotUntil > t;
        if (r.warm && !r.sus && t < fullReadyAt) continue;
        let cls = 3, k = r.at, job = 'frame';
        if (r.pend && !r.sus && !r.tripped) { cls = 0; k = r.pendAt; job = 'burst'; }
        else if (hot || t - r.at >= due) cls = 1;
        else if (r.changed) { cls = 2; job = 'burst'; }
        if (cls < bc || (cls === bc && k < bk)) { bc = cls; bk = k; best = { src, el, r, job }; }
      }
      return best;
    }
    async function tick() {
      timer = null;
      if (stopped || busy) return;
      busy = true;
      let wait = T.XV_FIRST_GAP_MIN_MS;
      try {
        const a = list();
        if (a.length) {
          if (!eng) { eng = await open(); err = ''; engAt = now(); }
          const p = pick(a);
          if (p && p.job === 'confirm') await confirmJob(p.src, p.el, p.r);
          else if (p && p.job === 'burst') await burstJob(p.src, p.el, p.r);
          else if (p) {
            p.r.at = now();
            const res = await eng.frame(p.el, (v) => {
              // One first look over the suspect line trips at once (a miss is far worse than a short false blur).
              const sl = eng.suspectLine == null ? 1 : eng.suspectLine;
              if (v >= sl) setSus(p.src.id, p.r, v);
            });
            if (stopped) return;
            frames++;
            const deeper = res.s.length > 1;
            if (deeper) { avg = avg ? avg * 0.8 + res.ms * 0.2 : res.ms; fullReadyAt = now() + Math.min(T.XV_GAP_MAX_MS, Math.max(T.XV_GAP_MIN_MS, res.ms / duty)); }
            else avgF = avgF ? avgF * 0.8 + res.ms * 0.2 : res.ms;
            feed(p.src.id, p.r, res, 'chain');
          }
          wait = Math.min(mobile ? T.XV_GAP_MAX_PHONE_MS : T.XV_GAP_MAX_MS, Math.max(T.XV_FIRST_GAP_MIN_MS, (avgF || 100) / fduty));
          // A suspect or a held-back picture: look again soon whatever the duty limit says.
          for (const r of recs.values()) if (r.sus || r.tripped || r.pend || r.changed || r.hotUntil > now()) { wait = Math.min(wait, T.XV_FIRST_GAP_MIN_MS, T.XV_BURST_MS); break; }
        }
      } catch (e) {
        err = String((e && e.message) || e);
        log('xv error ' + err.slice(0, 160));
        if (/no picture to check/.test(err)) {
          // A picture with no frame yet (a camera just turned on) is not a broken engine: look again soon, keep the models,
          // or every other picture would wait XV_RETRY_MS (30 s) for its check behind it.
          wait = T.XV_FIRST_GAP_MIN_MS;
        } else {
          eng = null;
          for (const [id, r] of recs) if (r.pend) { r.pend = false; emit(id, r, 'error'); }
          wait = T.XV_RETRY_MS;
        }
      }
      busy = false;
      gap = wait;
      if (!stopped) timer = setTimeout(tick, wait);
    }
    // poke(): something changed (a picture started being shown clear): look now rather than at the end of the gap.
    function poke() { if (stopped || busy || !timer || !(gap > T.XV_FIRST_GAP_MIN_MS)) return; clearTimeout(timer); timer = setTimeout(tick); }
    // PRELOAD: the blocker is on for this room (the page starts a watch only then), so load both models in idle time, before
    // any picture is clear; never blocks the join. The first model comes first, then the confirming one.
    if (opts.preload !== false) {
      const idle = (f) => (typeof root.requestIdleCallback === 'function' ? root.requestIdleCallback(f, { timeout: 5000 }) : setTimeout(f, T.XV_PRELOAD_IDLE_MS));
      idle(async () => {
        if (stopped) return;
        try {
          const t0 = performance.now();
          const e = await open();
          if (stopped || typeof e.preload !== 'function') return;
          const r = await e.preload();
          if (r.tier) tierNow = r.tier + (r.frameMs ? ' ' + r.frameMs + 'ms' : '') + (r.why ? ' (' + r.why + ')' : '');
          log('xv preload ' + (r.err ? 'error ' + r.err.slice(0, 100) : 'ready, confirming model on ' + tierNow) + ' ' + Math.round(performance.now() - t0) + 'ms');
        } catch (e) { log('xv preload skipped ' + String((e && e.message) || e).slice(0, 100)); }
      });
    }
    timer = setTimeout(tick, T.XV_FIRST_GAP_MIN_MS);   // the first look soon after the loop starts
    senseTimer = setTimeout(sense);
    return {
      poke,
      tripped: (id) => { const r = recs.get(id); return !!(r && r.kind); },
      state() { const o = {}; for (const [id, r] of recs) o[id] = { tripped: r.tripped, sus: r.sus, kind: r.kind, n: r.n, hits: r.hits, s: r.s, run: r.t.state().run }; return o; },
      stats() { return { frames, bursts, avgMs: Math.round(avg), avgFirstMs: Math.round(avgF), gapMs: Math.round(gap), duty, fduty, mobile, tier: tierNow, err, rule: RULE }; },
      stop() {
        stopped = true;
        if (timer) clearTimeout(timer);
        if (senseTimer) clearTimeout(senseTimer);
        for (const [id, r] of recs) if (r.kind) tell(id, '', 'stopped');
        recs.clear();
        for (const v of hidden.values()) { try { v.srcObject = null; v.remove(); } catch (e) {} }
        hidden.clear();
      },
    };
  }

  // ---- UPLOAD GUARD: avatars and chat files (Nathan 11-28) -------------------------------------------------------
  // Every picture or video a person puts into a room goes through the same on-device check twice: the sender's page
  // before it leaves (it refuses with plain words), and each receiving page before it shows the file (a hacked sender
  // is no excuse). A refused file shows blurred, "Blurred for safety", with no way to unblur. A verdict is cached by the
  // SHA-256 of the bytes, so a picture is judged once per page. Only what would be shown clear is checked: a caller
  // asks only then. Nothing about a trip is sent anywhere. A device that cannot run the check at all (no WebAssembly or
  // Worker) lets the sender through and leaves the receivers' checks to decide; a check that fails for any other
  // reason (model not downloadable, undecodable file) is NOT a pass: the sender is told to try again, the receiver
  // keeps the file held.
  const GUARD_FRAMES = 5;       // a video file is sampled at this many even points
  const GUARD_HITS = 2;         // this many explicit frames refuse it (one frame never acts, as in the live blocker)
  const verdicts = new Map();   // sha256 hex -> true (clean) | false (explicit)
  const inflight = new Map();
  const WORDS = {
    refuse: ['common.guard.refuse', "This picture can't be shared here."],
    refuseVideo: ['common.guard.refuseVideo', "This video can't be shared here."],
    retry: ['common.guard.retry', "This file can't be checked right now. Try again in a moment."],
    blurred: ['common.guard.blurred', 'Blurred for safety'],
  };
  function say(k) {
    const w = WORDS[k];
    try { const t = root.GifOS && root.GifOS.i18n && root.GifOS.i18n.t && root.GifOS.i18n.t(w[0]); if (t && t !== w[0]) return t; } catch (e) {}
    return w[1];
  }
  async function sha256hex(bytes) {
    return hex(await root.crypto.subtle.digest('SHA-256', bytes));
  }
  const isVideoMime = (m) => /^video\//i.test(String(m || ''));
  const isPictureMime = (m) => /^image\//i.test(String(m || ''));
  function waitFor(el, ev, ms) {
    return new Promise((res, rej) => {
      const t = setTimeout(() => { done(); rej(new Error('timeout ' + ev)); }, ms);
      const ok = () => { done(); res(); };
      const bad = () => { done(); rej(new Error('media error')); };
      function done() { clearTimeout(t); el.removeEventListener(ev, ok); el.removeEventListener('error', bad); }
      el.addEventListener(ev, ok); el.addEventListener('error', bad);
    });
  }
  async function judgePicture(bytes, mime) {
    const bmp = await root.createImageBitmap(new root.Blob([bytes], { type: mime || 'image/png' }));
    try { const r = await checkStill(bmp, guard.opts); return { clean: r.ok, ms: r.ms }; }
    finally { try { bmp.close(); } catch (e) {} }
  }
  async function judgeVideo(bytes, mime) {
    const url = root.URL.createObjectURL(new root.Blob([bytes], { type: mime || 'video/mp4' }));
    const v = root.document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    try {
      await waitFor(v, 'loadeddata', 15000);
      let d = v.duration;
      // A recorder's webm has no length in its header (Infinity): seeking far past the end makes the engine find it.
      if (d === Infinity) { v.currentTime = 1e7; await waitFor(v, 'seeked', 8000).catch(() => {}); d = v.duration; }
      if (!(d > 0) || !isFinite(d)) throw new Error('no duration');
      let hits = 0, ms = 0;
      for (let i = 0; i < GUARD_FRAMES; i++) {
        v.currentTime = Math.min(d - 0.01, d * (i + 0.5) / GUARD_FRAMES);
        await waitFor(v, 'seeked', 8000);
        const r = await classify(v, guard.opts);
        ms += r.ms || 0;
        if (r.score >= STILL_LINE && ++hits >= GUARD_HITS) return { clean: false, ms };
      }
      return { clean: true, ms };
    } finally {
      try { v.removeAttribute('src'); v.load(); } catch (e) {}
      try { root.URL.revokeObjectURL(url); } catch (e) {}
    }
  }
  // check(bytes, mime) -> { ok, why, hash, cached, ms }. ok false = refused (why 'explicit'); a check that could not
  // run says why: 'unsupported' (ok true: this device cannot judge; receivers will) or 'error' (ok false, retry).
  function guardCheck(bytes, mime) {
    if (!isPictureMime(mime) && !isVideoMime(mime)) return Promise.resolve({ ok: true, why: 'not-media' });
    if (unsupported()) return Promise.resolve({ ok: true, why: 'unsupported' });
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return sha256hex(u8).then((h) => {
      if (verdicts.has(h)) return { ok: verdicts.get(h), why: verdicts.get(h) ? 'clean' : 'explicit', hash: h, cached: true, ms: 0 };
      if (inflight.has(h)) return inflight.get(h);
      const job = (isVideoMime(mime) ? judgeVideo(u8, mime) : judgePicture(u8, mime)).then((r) => {
        verdicts.set(h, r.clean);
        if (verdicts.size > 500) verdicts.delete(verdicts.keys().next().value);
        return { ok: r.clean, why: r.clean ? 'clean' : 'explicit', hash: h, cached: false, ms: r.ms };
      }, () => ({ ok: false, why: 'error', hash: h, cached: false, ms: 0 })).then((r) => { inflight.delete(h); return r; });
      inflight.set(h, job);
      return job;
    }, () => ({ ok: false, why: 'error' }));
  }
  // What a receiver draws in place of a refused picture: the bytes never reach the screen. A 10x10 colour thumbnail of
  // them, stretched, reads as a blur ("Blurred for safety"); there is no way back to the sharp bytes from the page.
  async function blurredUrl(bytes, mime) {
    try {
      const bmp = await root.createImageBitmap(new root.Blob([bytes], { type: mime || 'image/png' }));
      const c = root.document.createElement('canvas'); c.width = 8; c.height = 8;
      c.getContext('2d').drawImage(bmp, 0, 0, 8, 8);
      try { bmp.close(); } catch (e) {}
      return c.toDataURL('image/png');
    } catch (e) { return ''; }
  }
  // The sender's words for a refused result, '' when it passed.
  function refusal(res, mime) {
    if (!res || res.ok) return '';
    if (res.why === 'error') return say('retry');
    return say(isVideoMime(mime) ? 'refuseVideo' : 'refuse');
  }
  // PLACEHOLDER HOOK for the upload warning line (wording is Nathan's decision, pending). A page that shows a warning
  // beside an upload asks this; it is '' until the wording lands. Nothing here ever carries an address or a report.
  const uploadWarning = () => '';
  const guard = { opts: undefined /* tools only: { base } for a local model host */, check: guardCheck, refusal, blurredUrl, words: say, uploadWarning, FRAMES: GUARD_FRAMES, HITS: GUARD_HITS,
    seen: (h) => verdicts.get(h), _verdicts: verdicts, isMedia: (m) => isPictureMime(m) || isVideoMime(m) };

  GifOS.explicit = { guard, MODEL, VERSION, STILL_LINE, VIDEO_LINE, unsupported, catalog, open, classify, checkStill, tracker, blockOn, _score: score,
    video: {
      RULE, fuseScore, testFrame, catalog: videoCatalog, open: videoOpen, watch, mobile: mobileUa,
      // Download progress of what the first check needs: { pct (0-100, or null until the catalog is known), ready }.
      progress: () => ({ pct: meter.ready ? 100 : meter.total ? Math.min(99, Math.floor((100 * meter.done) / meter.total)) : null, ready: meter.ready }),
      onProgress: (f) => { meter.fns.add(f); return () => meter.fns.delete(f); },
      // PRELOAD ON EVERY GIFOS PAGE (Nathan 11-28): both models in the background, low priority, once per device (Cache Storage).
      // Resolves { ms, err } and never throws. Safe to call again: it joins the one download.
      pause: pauseLow,
      preload: (opts) => { const t0 = performance.now(); return videoOpen(opts).then((e) => e.preload(), (e) => ({ err: String((e && e.message) || e) })).then((r) => Object.assign({ ms: Math.round(performance.now() - t0) }, r)); },
    } };
})(typeof window !== 'undefined' ? window : globalThis);
