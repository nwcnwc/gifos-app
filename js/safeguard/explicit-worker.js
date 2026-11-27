/*
 * explicit-worker.js: the on-device explicit-picture check, inside this Web Worker.
 *
 * The page (js/gifos-explicit.js) downloads the runtime and the model, checks every byte against the SHA-256
 * pinned in js/safeguard/models.json, and hands this worker the bytes. The worker makes no request: fetch and
 * XMLHttpRequest are closed to everything but the in-memory copies made here (blob: addresses), so no picture
 * and no score can ever leave the device.
 *
 * Messages in:  {op:'load', files:{tf, wasmJs, wasm, wasmSimd, modelJson, weights} (ArrayBuffers), size}
 *               {op:'run', id, w, h, buf (RGBA, w x h = size x size)}
 * Messages out: {op:'ready', backend} | {op:'scores', id, p:[5 numbers], ms} | {op:'error', id?, error}
 *
 * The runtime is TensorFlow.js (Apache-2.0); the model is NSFWJS MobileNetV2 (MIT), five classes in this order:
 * drawing, hentai, neutral, porn, sexy.
 */
(function () {
'use strict';

const realFetch = self.fetch ? self.fetch.bind(self) : null;
const isBlob = (u) => /^blob:/.test(String((u && u.url) || u || ''));
self.fetch = function (u, o) { return isBlob(u) && realFetch ? realFetch(u, o) : Promise.reject(new TypeError('no network from the picture check')); };
if (self.XMLHttpRequest) {
  const X = self.XMLHttpRequest;
  self.XMLHttpRequest = function () {
    const x = new X(), open = x.open;
    x.open = function (m, u) { if (!isBlob(u)) throw new TypeError('no network from the picture check'); return open.apply(x, arguments); };
    return x;
  };
}
try { self.WebSocket = undefined; self.EventSource = undefined; } catch (e) {}
try { if (self.navigator && self.navigator.sendBeacon) self.navigator.sendBeacon = () => false; } catch (e) {}

let model = null, size = 224, backend = '', loading = null;
const post = (m, t) => { try { self.postMessage(m, t || []); } catch (e) {} };
const blobUrl = (buf, type) => URL.createObjectURL(new Blob([buf], { type }));

function load(f, sz) {
  size = sz || 224;
  importScripts(blobUrl(f.tf, 'text/javascript'));
  importScripts(blobUrl(f.wasmJs, 'text/javascript'));
  const tf = self.tf;
  const simd = blobUrl(f.wasmSimd, 'application/wasm');
  // A page that is not cross-origin isolated has no shared memory, so the threaded build is never picked.
  try { tf.env().set('WASM_HAS_MULTITHREAD_SUPPORT', false); } catch (e) {}
  tf.wasm.setWasmPaths({ 'tfjs-backend-wasm.wasm': blobUrl(f.wasm, 'application/wasm'), 'tfjs-backend-wasm-simd.wasm': simd, 'tfjs-backend-wasm-threaded-simd.wasm': simd });
  const m = JSON.parse(new TextDecoder().decode(f.modelJson));
  const specs = [].concat.apply([], m.weightsManifest.map((g) => g.weights));
  // The processor first (WebAssembly, SIMD where the browser has it): the same numbers on every device, no graphics
  // context needed in the worker; the plain JavaScript engine only where WebAssembly cannot start.
  const pick = (names) => names.length ? tf.setBackend(names[0]).then((ok) => (ok ? names[0] : pick(names.slice(1)))).catch(() => pick(names.slice(1))) : Promise.reject(new Error('no engine'));
  return pick(['wasm', 'cpu']).then((b) => {
    backend = b;
    return tf.ready();
  }).then(() => (backend === 'wasm' ? tf.env().getAsync('WASM_HAS_SIMD_SUPPORT').then((simd) => { if (simd) backend = 'wasm-simd'; }).catch(() => {}) : null)).then(() => tf.loadLayersModel(tf.io.fromMemory({ modelTopology: m.modelTopology, weightSpecs: specs, weightData: f.weights })))
    .then((mdl) => {
      model = mdl;
      // One warm-up pass: the first real picture is then as fast as the rest.
      tf.tidy(() => model.predict(tf.zeros([1, size, size, 3]))).dataSync();
      return backend;
    });
}

function run(m) {
  const tf = self.tf;
  const t0 = performance.now();
  const n = size * size, src = new Uint8ClampedArray(m.buf), rgb = new Float32Array(n * 3);
  for (let i = 0, j = 0; i < n; i++, j += 4) { rgb[i * 3] = src[j] / 255; rgb[i * 3 + 1] = src[j + 1] / 255; rgb[i * 3 + 2] = src[j + 2] / 255; }
  const out = tf.tidy(() => model.predict(tf.tensor4d(rgb, [1, size, size, 3])));
  const p = Array.from(out.dataSync());
  out.dispose();
  return { p, ms: Math.round((performance.now() - t0) * 10) / 10 };
}

self.onmessage = (ev) => {
  const m = ev.data || {};
  if (m.op === 'load') {
    if (!loading) loading = Promise.resolve().then(() => load(m.files, m.size));
    loading.then((b) => post({ op: 'ready', backend: b }), (e) => { loading = null; post({ op: 'error', error: String((e && e.message) || e) }); });
    return;
  }
  if (m.op === 'run') {
    if (!model) { post({ op: 'error', id: m.id, error: 'not loaded' }); return; }
    try { const r = run(m); post({ op: 'scores', id: m.id, p: r.p, ms: r.ms }); } catch (e) { post({ op: 'error', id: m.id, error: String((e && e.message) || e) }); }
  }
};
})();
