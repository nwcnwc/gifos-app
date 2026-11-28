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
 * keeps babies, breastfeeding and sport clear). A desktop that can run it adds a larger model every few seconds.
 *
 *   GifOS.explicit.video.open(opts)    Promise of the chain: { frame(src) → Promise<{ hit, s:[scores], ms }> }
 *   GifOS.explicit.video.deep(opts)    Promise of the larger model on a capable desktop ({ frame(src) }), or null
 *   GifOS.explicit.video.watch(opts)   the blocker's loop: samples the pictures opts.sources() names, keeps one
 *                                      tracker per picture, and calls opts.onChange(id, tripped) on each trip and lift
 *   GifOS.explicit.video.RULE          the video rule's version
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
  // One pinned file: the checked copy in Cache Storage when there is one, else a download checked against the pin
  // before it is kept or used. A body that does not match its pin is refused.
  function pinned(pin, cache) {
    const fromCache = cache ? cache.match(pin.url).then((hit) => {
      if (!hit || hit.headers.get('x-gifos-sha256') !== pin.sha256) return null;
      return hit.arrayBuffer().then((b) => (b.byteLength === pin.bytes ? b : null));
    }).catch(() => null) : Promise.resolve(null);
    return fromCache.then((hit) => {
      if (hit) return hit;
      return fetch(pin.url, { credentials: 'omit', mode: 'cors' }).then((r) => {
        if (!r.ok) throw new Error('download failed: HTTP ' + r.status + ' for ' + pin.name);
        return r.arrayBuffer();
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
  const RULE = 'xv-2';
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

  let chainP = null;
  function videoOpen(opts) {
    if (chainP) return chainP;
    opts = opts || {};
    const why = unsupported();
    if (why) return Promise.reject(new Error('this device cannot run the video check (' + why + ')'));
    chainP = (async () => {
      const [c, cache] = await Promise.all([videoCatalog(opts.catalog), openCache()]);
      const pin = pinsFrom(c, opts);
      const w = vworker();
      try {
        await w.runtime(await fetchRuntime(c.runtime, pin, cache), 'wasm');
        const stages = c.chain.map((m) => Object.assign({}, m, { ready: null, ms: 0 }));
        // A model loads on its first use: the later stages of the chain only when a frame first reaches them.
        const ready = (m) => m.ready || (m.ready = pinned(pin(m.file), cache).then((b) => w.load(m.id, b, m)).then((t) => { m.ms = t.ms; }, (e) => { m.ready = null; throw e; }));
        for (const m of stages) if (!m.lazy) await ready(m);
        return {
          rule: RULE, backend: 'wasm', stages,
          // onFirst(v0): called the moment the first (fast) model has scored the frame, before the slower ones run, so a
          // suspect picture can be hidden at once (the asymmetric trip, FASTTRIP). first(src): the first model alone.
          frame(src, onFirst) {
            const t0 = performance.now();
            return snap(src).then(async (bmp) => {
              const s = [];
              try {
                for (const m of stages) {
                  await ready(m);
                  const r = await w.run(m.id, vpixels(bmp, m.size));
                  const v = posScore(r.p, m);
                  s.push(Math.round(v * 1e4) / 1e4);
                  if (s.length === 1 && onFirst) { try { onFirst(v, m); } catch (e) {} }
                  if (v < m.line) return { hit: false, s, ms: Math.round(performance.now() - t0) };
                }
                return { hit: true, s, ms: Math.round(performance.now() - t0) };
              } finally { if (bmp !== src && bmp && bmp.close) try { bmp.close(); } catch (e) {} }
            });
          },
          first(src) {
            const t0 = performance.now(), m = stages[0];
            return snap(src).then(async (bmp) => {
              try {
                await ready(m);
                const v = posScore((await w.run(m.id, vpixels(bmp, m.size))).p, m);
                return { v, suspect: v >= (m.suspect == null ? m.line : m.suspect), warm: v >= m.line, ms: Math.round(performance.now() - t0) };
              } finally { if (bmp !== src && bmp && bmp.close) try { bmp.close(); } catch (e) {} }
            });
          },
          suspectLine: stages[0].suspect == null ? stages[0].line : stages[0].suspect,
          warmLine: stages[0].line,
          close() { w.close(); chainP = null; },
        };
      } catch (e) { w.close(); throw e; }
    })();
    chainP.catch(() => { chainP = null; });
    return chainP;
  }

  // The larger model, on a desktop that can run it: WebGPU with 16-bit shaders, and a measured frame no slower than
  // maxMs (one thread of WebAssembly takes about 6 s a frame for it: never fast enough). Anything else: null, and
  // the chain alone does the work. Tried once per page.
  let deepP = null;
  function videoDeep(opts) {
    if (deepP) return deepP;
    opts = opts || {};
    deepP = (async () => {
      if (opts.mobile != null ? opts.mobile : mobileUa()) return null;
      const gpu = root.navigator && root.navigator.gpu;
      if (!gpu || unsupported()) return null;
      const c = await videoCatalog(opts.catalog);
      const d = c.deep;
      if (!d || !c.gpuRuntime) return null;
      let a = null;
      try { a = await gpu.requestAdapter(); } catch (e) {}
      if (!a) return null;
      if ((d.needs || []).indexOf('shader-f16') >= 0 && !(a.features && a.features.has('shader-f16'))) return null;
      const cache = await openCache(), pin = pinsFrom(c, opts), w = vworker();
      try {
        await w.runtime(await fetchRuntime(c.gpuRuntime, pin, cache), 'webgpu');
        await w.load(d.id, await pinned(pin(d.file), cache), d);
        const z = () => new Uint8ClampedArray(d.size * d.size * 4);
        await w.run(d.id, z());
        const t = await w.run(d.id, z());
        const max = opts.deepMaxMs || (root.GifOS.timings || {}).XV_DEEP_MAX_MS;
        if (!(t.ms <= max)) { w.close(); return null; }
        return {
          id: d.id, ms: t.ms,
          frame(src) {
            const t0 = performance.now();
            return snap(src).then((bmp) => w.run(d.id, vpixels(bmp, d.size)).then((r) => {
              const v = posScore(r.p, d);
              return { hit: v >= d.line, s: [Math.round(v * 1e4) / 1e4], ms: Math.round(performance.now() - t0) };
            }).finally(() => { if (bmp !== src && bmp && bmp.close) try { bmp.close(); } catch (e) {} }));
          },
          close() { w.close(); },
        };
      } catch (e) { w.close(); return null; }
    })().catch(() => null);
    return deepP;
  }

  // ---- the blocker's loop ---------------------------------------------------------------------------
  // opts.sources() → [{ id, el }] or [{ id, track }]: the pictures this page must check now (a picture shown clear or
  // nearly clear, and every picture that is tripped, so it can lift). opts.onChange(id, tripped) on each edge.
  // The page samples ONE frame at a time across all of them, oldest look first, a picture with a fresh hit first (its
  // second look comes within the burst time, so a trip takes seconds). The gap after a frame keeps the check's share
  // of one processor at the duty limit (lower on phones, to keep them cool): a slow device looks less often, never
  // stops looking. A desktop that can run the larger model looks with it too, on its own slower clock; its hits feed
  // the same tracker. Nothing leaves the page: no frame, no score, no trip.
  function watch(opts) {
    const T = Object.assign({}, (root.GifOS && root.GifOS.timings) || {}, opts.timings || {});
    const mobile = opts.mobile != null ? !!opts.mobile : mobileUa();
    const duty = (mobile ? T.XV_DUTY_PHONE_PCT : T.XV_DUTY_DESK_PCT) / 100;
    const fduty = (mobile ? T.XV_FIRST_DUTY_PHONE_PCT : T.XV_FIRST_DUTY_DESK_PCT) / 100;
    const open = opts.engine ? () => Promise.resolve(opts.engine) : () => videoOpen(opts);
    const openDeep = opts.deep !== undefined ? () => Promise.resolve(opts.deep) : () => videoDeep(opts);
    const log = typeof opts.log === 'function' ? opts.log : () => {};
    const gate = opts.gate !== false;   // a picture new to this page is held back until its first look passes (FASTTRIP 4)
    const recs = new Map();   // id -> per-picture record (see rec)
    const hidden = new Map(); // track -> video element of our own (a track with no element on the page)
    let stopped = false, timer = null, deepTimer = null, senseTimer = null, eng = null, deep, deepWhy = '', avg = 0, avgF = 0, gap = 0, frames = 0, err = '', deepFrames = 0, fullReadyAt = 0, busy = false, bursts = 0;
    const now = () => Date.now();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // r.tripped: the chain confirmed (two hits of three frames). r.sus: ONE frame passed the first model's suspect line:
    // hidden at once, lifted after XV_SUSPECT_CLEAN first-model-clean frames unless the chain confirms. r.pend: new to
    // this page, held back for its first look. A picture is held while any of the three is set; kind says which ('' |
    // 'checking' for pend alone | 'unsafe').
    const rec = (id) => {
      let r = recs.get(id);
      if (!r) recs.set(id, (r = { t: tracker(), td: tracker(), tripped: false, sus: false, hotUntil: 0, peak: 0, need: 1, holdUntil: 0, pend: false, pendAt: 0, kind: '', susClean: 0, changed: false, chgAt: 0, nextChg: 0, warm: false, prev: null, at: 0, n: 0, hits: 0, s: null, fresh: true }));
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
    function setSus(id, r, v0) {
      if (r.sus || r.tripped) { r.susClean = 0; if (r.sus && v0 > r.peak) { r.peak = v0; const h = holdFor(v0); r.holdUntil = Math.max(r.holdUntil, now() + h.hold); r.need = Math.max(r.need, h.clean); } return; }
      const h = holdFor(v0);
      r.peak = v0; r.need = h.clean; r.holdUntil = now() + h.hold;
      r.sus = true; r.susClean = 0; r.pend = false;
      log('xv suspect ' + String(id).slice(0, 8) + ' v0=' + Math.round(v0 * 1e4) / 1e4 + ' hold=' + Math.round(h.hold) + 'ms clean=' + h.clean);
      emit(id, r, 'suspect');
    }
    function feed(id, r, res, lane) {
      r.n++; r.s = res.s;
      if (res.hit) r.hits++;
      const o = (lane === 'deep' ? r.td : r.t).feed(res.hit ? 1 : 0);
      if (res.hit || o.changed) log('xv ' + lane + ' ' + String(id).slice(0, 8) + ' ' + (res.hit ? 'hit' : 'clean') + ' s=' + JSON.stringify(res.s) + ' ' + res.ms + 'ms');
      r.tripped = r.t.state().tripped || r.td.state().tripped;
      if (lane !== 'deep' && eng) {
        const sl = eng.suspectLine == null ? 1 : eng.suspectLine;
        r.warm = res.s.length > 1 || res.s[0] >= (eng.warmLine == null ? 0.05 : eng.warmLine);
        if (res.s[0] >= sl) r.hotUntil = now() + T.XV_HOT_MS;
        if (r.sus) {
          if (res.s[0] >= sl) setSus(id, r, res.s[0]); else r.susClean++;
          if (r.tripped || (r.susClean >= r.need && now() >= r.holdUntil)) r.sus = false;
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
            if (eng && gate && !r.kind) { r.pend = true; r.pendAt = t; emit(src.id, r, 'new'); }
            r.changed = true; kick = true;
          }
          const l = luma(el);
          if (l && r.prev && t >= r.nextChg && lumaDiff(l, r.prev) >= T.XV_SENSE_DIFF) { r.changed = true; kick = true; }
          if (l) r.prev = l;
          if (r.pend && t - r.pendAt >= T.XV_PEND_MAX_MS) { r.pend = false; emit(src.id, r, 'late'); }
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
    // The next picture to look at, in this order: (0) a new picture held back for its first look; (1) a HOT picture (a suspect
    // or tripped one, which needs looks to lift, or one with a look over the suspect line in the last XV_HOT_MS) and any picture
    // overdue for its regular look, the one looked at longest ago first (so no picture starves another, and a picture that
    // stays suspect cannot hold every look); (2) a picture that changed (a change burst, which never goes ahead of the above:
    // scene cuts in film must not spend the looks an explicit picture needs); (3) the one looked at longest ago. A warm picture
    // (past the first model's line: its looks reach the slow models) waits for the full lane's duty budget.
    function pick(a, lane) {
      const t = now();
      let best = null, bk = Infinity, bc = Infinity;
      const due = Math.min(T.XV_GAP_MAX_MS, Math.max(T.XV_FIRST_GAP_MIN_MS, (avgF || 100) / fduty));
      for (const src of a) {
        const el = elOf(src);
        if (!ready(el)) continue;
        const r = rec(src.id);
        if (lane === 'deep') { const k = r.deepAt || 0; if (k < bk) { bk = k; best = { src, el, r, job: 'frame' }; } continue; }
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
          if (!eng) { eng = await open(); err = ''; }
          if (deep === undefined) { deep = null; openDeep().then((d) => { deep = d; deepWhy = d ? 'on ' + d.ms + 'ms' : 'off'; if (d) log('xv deep on (' + d.id + ', ' + d.ms + ' ms a frame)'); if (d && !stopped) deepTick(); }, () => { deepWhy = 'off'; }); }
          const p = pick(a, 'chain');
          if (p && p.job === 'burst') await burstJob(p.src, p.el, p.r);
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
        eng = null;
        for (const [id, r] of recs) if (r.pend) { r.pend = false; emit(id, r, 'error'); }
        wait = T.XV_RETRY_MS;
      }
      busy = false;
      gap = wait;
      if (!stopped) timer = setTimeout(tick, wait);
    }
    async function deepTick() {
      deepTimer = null;
      if (stopped || !deep) return;
      try {
        const p = pick(list(), 'deep');
        if (p) { p.r.deepAt = now(); const res = await deep.frame(p.el); if (stopped) return; deepFrames++; feed(p.src.id, p.r, res, 'deep'); }
      } catch (e) { log('xv deep error ' + String((e && e.message) || e).slice(0, 160)); }
      if (!stopped) deepTimer = setTimeout(deepTick, T.XV_DEEP_GAP_MS);
    }
    // poke(): something changed (a picture started being shown clear): look now rather than at the end of the gap.
    function poke() { if (stopped || busy || !timer || !(gap > T.XV_FIRST_GAP_MIN_MS)) return; clearTimeout(timer); timer = setTimeout(tick); }
    timer = setTimeout(tick, T.XV_FIRST_GAP_MIN_MS);   // the first look soon after the loop starts
    senseTimer = setTimeout(sense);
    return {
      poke,
      tripped: (id) => { const r = recs.get(id); return !!(r && r.kind); },
      state() { const o = {}; for (const [id, r] of recs) o[id] = { tripped: r.tripped, sus: r.sus, kind: r.kind, n: r.n, hits: r.hits, s: r.s, run: r.t.state().run }; return o; },
      stats() { return { frames, bursts, deepFrames, avgMs: Math.round(avg), avgFirstMs: Math.round(avgF), gapMs: Math.round(gap), duty, fduty, mobile, deep: deepWhy || (deep === undefined ? 'not tried' : 'trying'), err, rule: RULE }; },
      stop() {
        stopped = true;
        if (timer) clearTimeout(timer);
        if (deepTimer) clearTimeout(deepTimer);
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
    video: { RULE, catalog: videoCatalog, open: videoOpen, deep: videoDeep, watch, mobile: mobileUa } };
})(typeof window !== 'undefined' ? window : globalThis);
