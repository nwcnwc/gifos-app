/*
 * video-worker.js: the on-device check for live video, inside this Web Worker.
 *
 * The page (js/gifos-explicit.js) downloads the runtime and each model, checks every byte against the SHA-256 pinned
 * in js/safeguard/video.json, and hands this worker the bytes. The worker makes no request: fetch and XMLHttpRequest
 * are closed to everything but the in-memory copies made here (blob: addresses), so no frame and no score can ever
 * leave the device.
 *
 * Messages in:  {op:'runtime', files:{js, wasm, mjs} (ArrayBuffers), ep:'wasm'|'webgpu'}
 *               {op:'model', id, bytes (ArrayBuffer), size, mean:[3], std:[3]}
 *               {op:'run', seq, id, buf (RGBA, size x size)}
 * Messages out: {op:'runtime', ok, error?} | {op:'model', id, ok, ms, error?} | {op:'scores', seq, p:[...], ms} |
 *               {op:'error', seq, error}
 *
 * The runtime is ONNX Runtime Web (MIT). Every model answers class logits; p is their softmax, in the model's order.
 */
(function () {
'use strict';

const realFetch = self.fetch ? self.fetch.bind(self) : null;
const isBlob = (u) => /^blob:/.test(String((u && u.url) || u || ''));
self.fetch = function (u, o) { return isBlob(u) && realFetch ? realFetch(u, o) : Promise.reject(new TypeError('no network from the video check')); };
if (self.XMLHttpRequest) {
  const X = self.XMLHttpRequest;
  self.XMLHttpRequest = function () {
    const x = new X(), open = x.open;
    x.open = function (m, u) { if (!isBlob(u)) throw new TypeError('no network from the video check'); return open.apply(x, arguments); };
    return x;
  };
}
try { self.WebSocket = undefined; self.EventSource = undefined; } catch (e) {}
try { if (self.navigator && self.navigator.sendBeacon) self.navigator.sendBeacon = () => false; } catch (e) {}

const post = (m) => { try { self.postMessage(m); } catch (e) {} };
const blobUrl = (buf, type) => URL.createObjectURL(new Blob([buf], { type }));
let ep = 'wasm';
const models = new Map();   // id -> { s: InferenceSession, size, mean, std, inName, outName }
let queue = Promise.resolve();   // one inference at a time

function runtime(f, want) {
  importScripts(blobUrl(f.js, 'text/javascript'));
  const ort = self.ort;
  if (!ort) throw new Error('runtime did not start');
  // A page that is not cross-origin isolated has no shared memory: one thread, no proxy worker.
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = { wasm: blobUrl(f.wasm, 'application/wasm'), mjs: blobUrl(f.mjs, 'text/javascript') };
  ort.env.logLevel = 'error';
  ep = want === 'webgpu' ? 'webgpu' : 'wasm';
}

function tensorOf(m, buf) {
  const n = m.size * m.size, src = new Uint8ClampedArray(buf), x = new Float32Array(n * 3);
  const [m0, m1, m2] = m.mean, [s0, s1, s2] = m.std;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    x[i] = (src[j] / 255 - m0) / s0;
    x[n + i] = (src[j + 1] / 255 - m1) / s1;
    x[2 * n + i] = (src[j + 2] / 255 - m2) / s2;
  }
  return new self.ort.Tensor('float32', x, [1, 3, m.size, m.size]);
}
function softmax(y) {
  let mx = -Infinity;
  for (const v of y) if (v > mx) mx = v;
  const e = Array.from(y, (v) => Math.exp(v - mx));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}
async function infer(m, buf) {
  const out = await m.s.run({ [m.inName]: tensorOf(m, buf) });
  return softmax(out[m.outName].data);
}

async function model(msg) {
  const t0 = performance.now();
  const s = await self.ort.InferenceSession.create(new Uint8Array(msg.bytes), { executionProviders: [ep], graphOptimizationLevel: 'all' });
  const m = { s, size: msg.size, mean: msg.mean, std: msg.std, inName: s.inputNames[0], outName: s.outputNames[0] };
  // One warm-up pass, timed: the first real frame is then as fast as the rest, and the page learns what a frame costs.
  const t1 = performance.now();
  await infer(m, new Uint8ClampedArray(msg.size * msg.size * 4).buffer);
  models.set(msg.id, m);
  return { load: Math.round(t1 - t0), warm: Math.round(performance.now() - t1) };
}

self.onmessage = (ev) => {
  const m = ev.data || {};
  if (m.op === 'runtime') {
    try { runtime(m.files, m.ep); post({ op: 'runtime', ok: true, ep }); } catch (e) { post({ op: 'runtime', ok: false, error: String((e && e.message) || e) }); }
    return;
  }
  if (m.op === 'model') {
    queue = queue.then(() => model(m).then((t) => post({ op: 'model', id: m.id, ok: true, ms: t.warm, loadMs: t.load }),
      (e) => post({ op: 'model', id: m.id, ok: false, error: String((e && e.message) || e) })));
    return;
  }
  if (m.op === 'run') {
    queue = queue.then(() => {
      const md = models.get(m.id);
      if (!md) { post({ op: 'error', seq: m.seq, error: 'not loaded: ' + m.id }); return; }
      const t0 = performance.now();
      return infer(md, m.buf).then((p) => post({ op: 'scores', seq: m.seq, p, ms: Math.round((performance.now() - t0) * 10) / 10 }),
        (e) => post({ op: 'error', seq: m.seq, error: String((e && e.message) || e) }));
    });
  }
};
})();
