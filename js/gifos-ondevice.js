/*
 * gifos-ondevice.js — ON-DEVICE CAPTIONS for the meeting page.
 *
 * A phone writes its own captions with a speech model that runs inside the
 * browser (js/ondevice/captions-worker.js, a Web Worker running sherpa-onnx
 * WebAssembly). No audio leaves the device: the only network use is a one-time
 * GET of the engine and model files from the GifOS model host, each pinned by
 * SHA-256 in js/ondevice/models.json (released with this version of the site).
 * This page downloads each file, checks every byte against its pin, keeps the
 * checked copy in this browser's Cache Storage, and hands the bytes to the
 * worker, which itself makes no download and no other request.
 *
 * One model per language (models.json "langs"). A language with no model, or
 * a device that cannot run one (no WebAssembly SIMD, no workers, very little
 * memory), gets no captions from this page and is told so; it never falls back
 * to a speech service on the network.
 *
 *   GifOS.ondevice.unsupported(nav)  '' when this device can run the engine,
 *                                    else why not: 'wasm' | 'simd' | 'worker' | 'memory'
 *   GifOS.ondevice.catalog()         Promise of models.json
 *   GifOS.ondevice.modelFor(lang)    Promise of the model id for 'en-US' / 'ru' / …, '' if none
 *   GifOS.ondevice.open(lang, opts)  Promise of an engine: { model, transcribe(pcm16k) → Promise<{text, ms}>, close() }
 *                                    opts.onProgress({loaded, total, cached}); opts.base overrides the model host
 *                                    for a local copy of the files (tools only)
 */
(function (root) {
  const GifOS = (root.GifOS = root.GifOS || {});
  if (GifOS.ondevice) return;

  // Where this script was loaded from: the worker and the catalog sit beside it.
  const here = (function () {
    try {
      const s = root.document && root.document.currentScript;
      if (s && s.src) return s.src.replace(/[^/]*$/, '');
    } catch (e) {}
    return '/js/';
  })();
  const DIR = here + 'ondevice/';
  const CACHE = 'gifos-ondevice-v1';

  // The smallest module that uses a SIMD instruction: it validates only where
  // WebAssembly SIMD is on (Chrome 91+, Safari 16.4+, Firefox 89+).
  const SIMD_PROBE = [0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11];

  function unsupported(nav) {
    nav = nav || root.navigator || {};
    const W = root.WebAssembly;
    if (!W || typeof W.validate !== 'function' || typeof W.instantiate !== 'function') return 'wasm';
    try { if (!W.validate(new Uint8Array(SIMD_PROBE))) return 'simd'; } catch (e) { return 'simd'; }
    if (typeof root.Worker !== 'function') return 'worker';
    // deviceMemory is rounded down and capped by the browser; under 2 GB the
    // model and the meeting do not both fit.
    const mem = Number(nav.deviceMemory) || 0;
    if (mem && mem < 2) return 'memory';
    return '';
  }

  let cat = null;
  function catalog() {
    if (!cat) {
      cat = fetch(DIR + 'models.json', { credentials: 'omit' }).then((r) => {
        if (!r.ok) throw new Error('download failed: models.json HTTP ' + r.status);
        return r.json();
      });
      cat.catch(() => { cat = null; });
    }
    return cat;
  }
  const short = (lang) => String(lang || '').toLowerCase().split(/[-_]/)[0];
  function modelFor(lang) {
    return catalog().then((c) => (c.langs && c.langs[short(lang)]) || '');
  }

  // The worker's engine description for one model: every file with the URL it
  // is fetched from and its pin.
  function engineFor(c, id, base) {
    const m = c.models[id];
    if (!m) throw new Error('no model ' + id);
    const rt = c.runtimes[m.runtime];
    base = String(base || c.base).replace(/\/+$/, '');
    return {
      runtime: m.runtime,
      runtimeJs: DIR + rt.js,
      apiJs: DIR + c.api.js,
      runtimeWasm: { name: rt.wasm.name, url: base + '/' + rt.wasm.key, sha256: rt.wasm.sha256, bytes: rt.wasm.bytes },
      model: {
        id, type: m.type,
        files: m.files.map((f) => ({ name: f.name, as: f.as, url: base + '/' + id + '/' + f.sha256 + '/' + f.name, sha256: f.sha256, bytes: f.bytes })),
      },
    };
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
  // One pinned file: the checked copy in Cache Storage when there is one,
  // else a download with progress, checked against the pin before it is kept
  // or used. A body that does not match its pin is refused.
  function pinned(pin, cache, onBytes) {
    const fromCache = cache ? cache.match(pin.url).then((hit) => {
      if (!hit || hit.headers.get('x-gifos-sha256') !== pin.sha256) return null;
      return hit.arrayBuffer().then((b) => ((!pin.bytes || b.byteLength === pin.bytes) ? b : null));
    }).catch(() => null) : Promise.resolve(null);
    return fromCache.then((hit) => {
      if (hit) { onBytes(hit.byteLength, true); return { buf: hit, cached: true }; }
      return fetch(pin.url, { credentials: 'omit', mode: 'cors' }).then((r) => {
        if (!r.ok) throw new Error('download failed: HTTP ' + r.status + ' for ' + pin.name);
        if (!r.body || !r.body.getReader) return r.arrayBuffer().then((b) => { onBytes(b.byteLength, false); return b; });
        const reader = r.body.getReader(), parts = [];
        let n = 0;
        const pump = () => reader.read().then(({ done, value }) => {
          if (done) {
            const all = new Uint8Array(n);
            let o = 0;
            for (const part of parts) { all.set(part, o); o += part.length; }
            return all.buffer;
          }
          parts.push(value); n += value.length; onBytes(n, false);
          return pump();
        });
        return pump();
      }).then((buf) => root.crypto.subtle.digest('SHA-256', buf).then((d) => {
        if (hex(d) !== pin.sha256) throw new Error('download failed: ' + pin.name + ' does not match its pin');
        const keep = cache ? cache.put(pin.url, new Response(buf.slice(0), { headers: { 'content-type': 'application/octet-stream', 'x-gifos-sha256': pin.sha256 } })).catch(() => {}) : null;
        return Promise.resolve(keep).then(() => ({ buf, cached: false }));
      }));
    });
  }
  // Every file of one engine, one at a time (a phone holds one download in
  // flight), with progress over the whole set.
  function fetchAll(engine, onProgress) {
    const files = [engine.runtimeWasm].concat(engine.model.files);
    const total = files.reduce((t, f) => t + (f.bytes || 0), 0);
    const have = files.map(() => 0), bytes = {};
    let cachedAll = true;
    return openCache().then((cache) => files.reduce((p, f, i) => p.then(() => pinned(f, cache, (n, c) => {
      have[i] = n;
      if (onProgress) { try { onProgress({ loaded: have.reduce((a, b) => a + b, 0), total, cached: c, file: f.name }); } catch (e) {} }
    }).then((got) => { bytes[f.name] = got.buf; if (!got.cached) cachedAll = false; })), Promise.resolve()))
      .then(() => ({ bytes, cached: cachedAll, total }));
  }

  // Models that write in capitals or in lower case only get sentence case.
  function tidy(text, how) {
    let t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    if (how === 'sentence') {
      t = t.toLowerCase();
      t = t.charAt(0).toUpperCase() + t.slice(1);
      t = t.replace(/\bi\b/g, 'I');
    }
    return t;
  }

  // A whole-clip model reads at most maxSeconds of audio at once. A longer
  // clip is cut at its quietest 20 ms inside the last 2.5 s before that limit,
  // so a cut falls between words, and the pieces' texts are joined.
  function pieces(pcm, maxSeconds) {
    const max = Math.floor((maxSeconds || 0) * 16000);
    if (!max || pcm.length <= max) return [pcm];
    const out = [];
    const frame = 320, look = Math.min(max - frame, 40000);
    let at = 0;
    while (pcm.length - at > max) {
      let best = at + max, bestE = Infinity;
      for (let i = at + max - look; i + frame <= at + max; i += frame) {
        let e = 0; for (let j = i; j < i + frame; j++) e += pcm[j] * pcm[j];
        if (e < bestE) { bestE = e; best = i + (frame >> 1); }
      }
      out.push(pcm.subarray(at, best));
      at = best;
    }
    out.push(pcm.subarray(at));
    return out;
  }

  function open(lang, opts) {
    opts = opts || {};
    return catalog().then((c) => {
      const id = opts.model || (c.langs && c.langs[short(lang)]);
      if (!id) throw new Error('no on-device model for ' + (lang || 'this language'));
      const engine = engineFor(c, id, opts.base);
      const how = c.models[id].case;
      const maxSeconds = c.models[id].maxSeconds || 0;
      return fetchAll(engine, opts.onProgress).then((got) => {
      const w = new Worker(DIR + 'captions-worker.js');
      const waiting = new Map();
      let seq = 0, dead = null;
      const fail = (e) => {
        dead = e;
        for (const [, p] of waiting) p.reject(e);
        waiting.clear();
      };
      w.onerror = (ev) => { fail(new Error('the caption engine stopped' + (ev && ev.message ? ': ' + ev.message : ''))); try { w.terminate(); } catch (e) {} };
      return new Promise((resolve, reject) => {
        const loadId = ++seq;
        waiting.set(loadId, { resolve: () => {}, reject });
        w.onmessage = (ev) => {
          const m = ev.data || {};
          const p = waiting.get(m.id);
          if (!p) return;
          waiting.delete(m.id);
          if (m.op === 'error') { p.reject(new Error(m.error || 'caption engine error')); return; }
          if (m.op === 'ready') {
            resolve({
              model: id,
              lang: short(lang),
              loadMs: m.ms,
              cached: got.cached,
              bytes: got.total,
              memory: m.memory || 0,
              transcribe(pcm) {
                if (dead) return Promise.reject(dead);
                const one = (part) => new Promise((res, rej) => {
                  const rid = ++seq;
                  waiting.set(rid, { resolve: res, reject: rej });
                  const copy = new Float32Array(part);
                  w.postMessage({ op: 'run', id: rid, pcm: copy }, [copy.buffer]);
                });
                const all = pieces(pcm instanceof Float32Array ? pcm : new Float32Array(pcm), maxSeconds);
                return all.reduce((p, part) => p.then((acc) => one(part).then((r) => ({ text: acc.text ? (r.text ? acc.text + ' ' + r.text : acc.text) : r.text, ms: acc.ms + r.ms }))), Promise.resolve({ text: '', ms: 0 }));
              },
              close() {
                fail(new Error('PROVIDER_STOPPED'));
                try { w.postMessage({ op: 'stop' }); } catch (e) {}
                try { w.terminate(); } catch (e) {}
              },
            });
            return;
          }
          if (m.op === 'result') p.resolve({ text: tidy(m.text, how), ms: m.ms });
        };
        w.postMessage({ op: 'load', id: loadId, engine, bytes: got.bytes }, Object.keys(got.bytes).map((k) => got.bytes[k]));
      });
      });
    });
  }

  GifOS.ondevice = { unsupported, catalog, modelFor, open, engineFor, tidy };
})(typeof self !== 'undefined' ? self : this);
