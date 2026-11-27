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
 *   GifOS.explicit.checkStill(src)     Promise of { ok, verdict, score, ms } for one still picture (a thumbnail): ok
 *                                      false = explicit. verdict = { m, v, ok:1 } is what a page signs into an order
 *                                      when ok; there is no verdict when the picture tripped or could not be checked.
 *   GifOS.explicit.tracker(opts)       the video rule for one tile: feed(result) → { tripped, changed, burst }.
 *                                      Trips on k of the last n frames over the line (a single frame never acts);
 *                                      lifts by itself after `clean` frames in a row under it.
 *   GifOS.explicit.blockOn(room)       is the video blocker on for this room (the one scope rule, below)
 *   GifOS.explicit.MODEL, VERSION      the model id and the rule version a verdict names
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});
  if (GifOS.explicit) return;

  // THE LINE. Measured on a public evaluation set of explicit and hard-benign pictures (swimwear, beach sport,
  // breastfeeding, babies, medical, art); a change of the line is a new VERSION, so a stored verdict always says which
  // line it passed.
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
  function pixels(src, size) {
    if (src && src.data && src.width === size && src.height === size) return new Uint8ClampedArray(src.data);
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
    g.drawImage(src, 0, 0, sw, sh, 0, 0, size, size);
    return g.getImageData(0, 0, size, size).data;
  }
  function score(p) { return (p.hentai || 0) + (p.porn || 0); }
  function classify(src, opts) {
    return open(opts).then((e) => e.run(pixels(src, e.size)).then((m) => {
      const p = {};
      CLASSES.forEach((c, i) => { p[c] = m.p[i]; });
      const s = score(p);
      return { p, score: s, explicit: s >= VIDEO_LINE, ms: m.ms, backend: e.backend };
    }));
  }
  // A still picture: one decision. A picture that could not be checked has no verdict, exactly like one that tripped.
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

  GifOS.explicit = { MODEL, VERSION, STILL_LINE, VIDEO_LINE, unsupported, catalog, open, classify, checkStill, tracker, blockOn, _score: score };
})(typeof window !== 'undefined' ? window : globalThis);
