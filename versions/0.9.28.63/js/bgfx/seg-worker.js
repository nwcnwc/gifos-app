/*
 * seg-worker.js — CAMERA BACKGROUND EFFECTS: finds the person in a small copy of each
 * camera frame, inside this Web Worker, and answers with a soft mask.
 *
 * The page (js/meet-bgfx.js) downloads the model and its WebAssembly runtime, checks
 * every byte against the SHA-256 pinned in js/bgfx/models.json, and hands this worker
 * the bytes. The runtime's two script files load from this site. The worker makes no
 * other request: fetch and XMLHttpRequest are closed to everything but the in-memory
 * copies made here (blob: addresses), so the library's usage logging can never leave
 * the device, and no picture ever does.
 *
 * Messages in:  {op:'load', wasm, model} | {op:'run', id, w, h, buf (RGBA)}
 * Messages out: {op:'ready', delegate} | {op:'mask', id, w, h, buf (alpha in A), ms} | {op:'error', error}
 *
 * The runtime is MediaPipe Tasks Vision (Apache-2.0); the model is the MediaPipe selfie
 * segmenter (Apache-2.0).
 */
(function () {
'use strict';

const realFetch = self.fetch ? self.fetch.bind(self) : null;
const isBlob = (u) => /^blob:/.test(String((u && u.url) || u || ''));
self.fetch = function (u, o) { return isBlob(u) && realFetch ? realFetch(u, o) : Promise.reject(new TypeError('no network from the background worker')); };
if (self.XMLHttpRequest) {
  const X = self.XMLHttpRequest;
  self.XMLHttpRequest = function () {
    const x = new X(), open = x.open;
    x.open = function (m, u) { if (!isBlob(u)) throw new TypeError('no network from the background worker'); return open.apply(x, arguments); };
    return x;
  };
}
try { self.WebSocket = undefined; self.EventSource = undefined; } catch (e) {}
try { if (self.navigator && self.navigator.sendBeacon) self.navigator.sendBeacon = () => false; } catch (e) {}

importScripts('vision_bundle.js');

let seg = null, delegate = '', prev = null, loading = null;
const post = (m, t) => { try { self.postMessage(m, t || []); } catch (e) {} };

function load(wasm, model) {
  const wasmUrl = URL.createObjectURL(new Blob([wasm], { type: 'application/wasm' }));
  const fileset = { wasmLoaderPath: new URL('vision_wasm_internal.js', self.location.href).href, wasmBinaryPath: wasmUrl };
  const make = (d) => self.Vision.ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer: new Uint8Array(model), delegate: d },
    runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true,
  }).then((s) => { delegate = d; return s; });
  // The processor first: it needs no graphics context in the worker and runs the same on every engine.
  return make('CPU');
}

function run(m) {
  const t0 = performance.now();
  const img = new ImageData(new Uint8ClampedArray(m.buf), m.w, m.h);
  let out = null;
  seg.segmentForVideo(img, t0, (res) => {
    const cm = res && res.confidenceMasks && res.confidenceMasks[0];
    if (!cm) return;
    const f = cm.getAsFloat32Array();
    const n = m.w * m.h;
    const a = new Uint8ClampedArray(n * 4);
    // A little of the last mask stays in each one, so the edge does not shimmer frame to frame.
    const keep = prev && prev.length === n ? prev : null;
    const cur = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let v = f[i];
      if (keep) v = v * 0.7 + keep[i] * 0.3;
      cur[i] = v;
      // A soft ramp: below 0.3 is room, above 0.7 is person.
      const s = (v - 0.3) / 0.4;
      a[i * 4 + 3] = s <= 0 ? 0 : s >= 1 ? 255 : Math.round(s * 255);
    }
    prev = cur;
    out = a;
  });
  if (!out) out = new Uint8ClampedArray(m.w * m.h * 4);
  post({ op: 'mask', id: m.id, w: m.w, h: m.h, buf: out.buffer, ms: performance.now() - t0 }, [out.buffer]);
}

self.onmessage = (ev) => {
  const m = ev.data || {};
  if (m.op === 'load') {
    loading = load(m.wasm, m.model).then((s) => { seg = s; post({ op: 'ready', delegate }); }, (e) => post({ op: 'error', error: String((e && e.message) || e) }));
    return;
  }
  if (m.op === 'run') {
    if (!seg) { post({ op: 'mask', id: m.id, w: 0, h: 0, buf: null, ms: 0 }); return; }
    try { run(m); } catch (e) { post({ op: 'error', error: String((e && e.message) || e) }); }
  }
};
})();
