/*
 * captions-worker.js — ON-DEVICE CAPTIONS: speech to text inside this
 * browser, in a Web Worker, with no audio ever leaving the device.
 *
 * The page (js/gifos-ondevice.js) downloads and checks the engine's files
 * (a sherpa-onnx WebAssembly runtime and one model, every file pinned by its
 * SHA-256) and hands this worker their bytes, then clips of 16 kHz mono
 * speech. The worker starts the runtime from those bytes, writes the model
 * into the runtime's memory file system, builds the recognizer, drops the
 * file copies, and answers each clip with its text.
 *
 * The worker makes no network request of its own beyond loading its two
 * script files from this site: no download, no socket, no request body.
 *
 * Messages in:  {op:'load', id, engine, bytes} | {op:'run', id, pcm} | {op:'stop'}
 * Messages out: {op:'ready', id, ms, memory}
 *               {op:'result', id, text, ms} | {op:'error', id, error}
 */
// The runtime loader declares globals of its own (run, abort, FS, …) when it
// is imported: everything here lives in this one scope.
(function () {
'use strict';

let rec = null;        // the recognizer
let recKind = '';      // 'online' (streaming transducer / CTC) or 'offline' (Moonshine)
let mod = null;        // the runtime's Module
let loading = null;

const post = (m) => { try { self.postMessage(m); } catch (e) {} };

function startRuntime(js, api, wasm) {
  return new Promise((resolve, reject) => {
    self.Module = {
      wasmBinary: wasm,
      print: () => {},
      printErr: () => {},
      locateFile: (p) => p, // never used: the runtime has no data package and its wasm is given
      onRuntimeInitialized: () => resolve(self.Module),
      onAbort: (why) => reject(new Error('runtime aborted: ' + why)),
    };
    try { importScripts(js, api); } catch (e) { reject(e); }
  });
}

function buildRecognizer(engine) {
  const m = engine.model;
  const at = (name) => '/' + name;
  if (engine.runtime === 'offline') {
    const modelConfig = { tokens: at('tokens.txt'), numThreads: 1, provider: 'cpu', debug: 0 };
    if (m.type === 'moonshine2') modelConfig.moonshine = { encoder: at('encoder.ort'), mergedDecoder: at('decoder.ort') };
    else throw new Error('unknown offline model type ' + m.type);
    rec = new OfflineRecognizer({ featConfig: { sampleRate: 16000, featureDim: 80 }, modelConfig, decodingMethod: 'greedy_search' }, mod);
    recKind = 'offline';
  } else {
    const modelConfig = {
      transducer: { encoder: '', decoder: '', joiner: '' },
      paraformer: { encoder: '', decoder: '' },
      zipformer2Ctc: { model: '' },
      nemoCtc: { model: '' },
      toneCtc: { model: '' },
      tokens: at('tokens.txt'), numThreads: 1, provider: 'cpu', debug: 0,
      modelType: '', modelingUnit: '', bpeVocab: '',
    };
    if (m.type === 'transducer') modelConfig.transducer = { encoder: at('encoder.onnx'), decoder: at('decoder.onnx'), joiner: at('joiner.onnx') };
    else if (m.type === 'ctc') modelConfig.zipformer2Ctc = { model: at('model.onnx') };
    else throw new Error('unknown streaming model type ' + m.type);
    rec = createOnlineRecognizer(mod, {
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig,
      decodingMethod: 'greedy_search', maxActivePaths: 4,
      enableEndpoint: 0, rule1MinTrailingSilence: 2.4, rule2MinTrailingSilence: 1.2, rule3MinUtteranceLength: 20,
      hotwordsFile: '', hotwordsScore: 1.5,
      ctcFstDecoderConfig: { graph: '', maxActive: 3000 },
      ruleFsts: '', ruleFars: '',
    });
    recKind = 'online';
  }
  if (!rec || !rec.handle) throw new Error('the recognizer could not be built');
}

async function load(id, engine, bytes) {
  const t0 = Date.now();
  mod = await startRuntime(engine.runtimeJs, engine.apiJs, bytes[engine.runtimeWasm.name]);
  delete bytes[engine.runtimeWasm.name];
  for (const f of engine.model.files) {
    mod.FS_createDataFile('/', f.as, new Uint8Array(bytes[f.name]), true, false, false);
    delete bytes[f.name];
  }
  buildRecognizer(engine);
  for (const f of engine.model.files) { try { mod.FS_unlink('/' + f.as); } catch (e) {} }
  post({ op: 'ready', id, ms: Date.now() - t0, memory: mod.HEAP8 ? mod.HEAP8.length : 0 });
}

// A clip of 16 kHz float samples in, its text out. A streaming model gets a
// short tail of silence so its last word is decoded.
function run(pcm) {
  if (recKind === 'offline') {
    const s = rec.createStream();
    try { s.acceptWaveform(16000, pcm); rec.decode(s); return String((rec.getResult(s) || {}).text || ''); } finally { s.free(); }
  }
  const s = rec.createStream();
  try {
    s.acceptWaveform(16000, pcm);
    s.acceptWaveform(16000, new Float32Array(8000));
    s.inputFinished();
    while (rec.isReady(s)) rec.decode(s);
    return String((rec.getResult(s) || {}).text || '');
  } finally { s.free(); }
}

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  if (msg.op === 'load') {
    if (loading) { post({ op: 'error', id: msg.id, error: 'already loading' }); return; }
    loading = load(msg.id, msg.engine, msg.bytes || {}).catch((e) => post({ op: 'error', id: msg.id, error: String((e && e.message) || e) }));
    await loading;
    return;
  }
  if (msg.op === 'run') {
    if (!rec) { post({ op: 'error', id: msg.id, error: 'not loaded' }); return; }
    const t0 = Date.now();
    try {
      const pcm = msg.pcm instanceof Float32Array ? msg.pcm : new Float32Array(msg.pcm);
      post({ op: 'result', id: msg.id, text: run(pcm).trim(), ms: Date.now() - t0 });
    } catch (e) { post({ op: 'error', id: msg.id, error: String((e && e.message) || e) }); }
    return;
  }
  if (msg.op === 'stop') {
    try { if (rec) rec.free(); } catch (e) {}
    rec = null;
    self.close();
  }
};
})();
