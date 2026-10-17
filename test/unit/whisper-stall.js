// whisper-stall.js — a slow speech-to-text provider must not make Whisper give up.
//
// Gate style: lift run.html's own queue and run it on a fake clock. No browser,
// no model. whisperFeedForTest is wspEnqueue(..., keep) — this feeds that way.
//
// A warm call that outlives clip*4+10s used to clear the queue and start the
// next clip while the provider was still on the previous one. Two of those
// stalls paused Whisper and fell back to browser speech, which a headless
// Meeting Bot does not have, while the tile still said "transcribing".
//
//   node test/unit/whisper-stall.js
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'run.html'), 'utf8');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}
function slice(startMark, endMark) {
  const a = html.indexOf(startMark);
  const b = a < 0 ? -1 : html.indexOf(endMark, a + startMark.length);
  check('lift: ' + startMark.trim().slice(0, 48), a > 0 && b > a, a + '..' + b);
  return a > 0 && b > a ? html.slice(a, b) : '';
}
function flush() {
  let p = Promise.resolve();
  for (let i = 0; i < 8; i++) p = p.then(() => {});
  return p;
}

const SRC = slice('    const wspCaps = new Map();', '    const scribeSeen = new Set();');

// Page helpers the fix adds override these. On the unmodified page the chip
// stays the plain "transcribing" word, which is the bug under test.
const PREAMBLE = [
  'const WSP_WEAK = false;',
  'function wspChipLabel() { return "transcribing"; }',
  'function wspModel() { return "base"; }',
].join('\n');

function makeWorld(o) {
  o = o || {};
  const w = {
    now: 1700000000000,
    timers: [],
    lines: [],
    statuses: [],
    syncs: 0,
    calls: [],
    inFlight: 0,
    maxInFlight: 0,
    stops: 0,
    mem: Object.assign({}, o.mem || {}),
  };
  w.myStatus = { cc: true, muted: false, scribe: false };
  w.ac = { sampleRate: 16000, destination: {} };
  const cap = { id: 'me', rate: 16000 };
  w.api = new Function(
    'setInterval', 'setTimeout', 'clearTimeout', 'ccLang', 'lsGet', 'lsSet',
    'CC_ENGINE_KEY', 'CC_TRANSLATE_KEY', 'CC_WORDS_KEY',
    'IS_MOBILE', 'GifOS', 'setStatus', 'myStatus', 'addTranscriptLine', 'peers', 'syncSpeech', 'paintCcState',
    'ensureAc', 'ac', 'meters', 'MediaStream', 'whisperReady', 'localStream', 'speakingOf', 'myVoiceAt',
    'WSP_PRE_MS', 'WSP_GAP_MS', 'WSP_MAX_S', 'WSP_MIN_S', 'WSP_BACKLOG', 'WSP_SCRIBE_MAX',
    PREAMBLE + '\n' + SRC + '\nreturn { wspEnqueue, caps: wspCaps, q: wspQ, paused: () => wspPaused, chip: () => wspChipLabel(), model: () => wspModel(), giveUp: wspStallGiveUp };'
  )(
    () => 0,
    (fn, ms) => { const t = { fn: fn, ms: ms, at: w.now + ms, cleared: false, fired: false }; w.timers.push(t); return t; },
    (t) => { if (t) t.cleared = true; },
    () => 'en',
    (k) => w.mem[k] || '',
    (k, v) => { if (v) w.mem[k] = String(v); else delete w.mem[k]; },
    'gifos_cc_engine', 'gifos_cc_translate', 'gifos_cc_words',
    false,
    { providers: {
      call: (_role, req) => {
        w.inFlight++;
        if (w.inFlight > w.maxInFlight) w.maxInFlight = w.inFlight;
        let rec;
        const p = new Promise((resolve, reject) => {
          rec = {
            req: req,
            settled: false,
            resolve: (text) => { if (rec.settled) return; rec.settled = true; w.inFlight--; resolve({ text: text }); },
            reject: (err) => { if (rec.settled) return; rec.settled = true; w.inFlight--; reject(err); },
          };
        });
        rec.abort = () => rec.reject(new Error('PROVIDER_STOPPED'));
        p.abort = rec.abort;
        w.calls.push(rec);
        return p;
      },
      stop: () => {
        w.stops++;
        const live = w.calls.filter((c) => !c.settled);
        if (live.length) live[0].reject(new Error('PROVIDER_STOPPED'));
      },
    } },
    (s) => w.statuses.push(String(s)),
    w.myStatus,
    (text) => w.lines.push(String(text)),
    new Map(),
    () => { w.syncs++; },
    () => {},
    () => w.ac, w.ac, new Map(), class MediaStream {}, () => true, null, new Map(), 0,
    400, 700, 15, 0.4, 3, 8
  );
  w.api.caps.set('me', cap);
  w.cap = cap;
  w.advance = (ms) => {
    const end = w.now + ms;
    for (;;) {
      const due = w.timers.filter((t) => !t.cleared && !t.fired && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      w.now = due.at;
      due.fired = true;
      due.fn();
    }
    w.now = end;
  };
  w.feed = (n) => {
    const pcm = new Float32Array(160);
    pcm[0] = n || 1;
    // Same call whisperFeedForTest makes: one kept clip, stamped now.
    return w.api.wspEnqueue(cap, [pcm], w.now, 16000, true);
  };
  w.softMs = () => {
    const live = w.timers.filter((t) => !t.cleared && !t.fired);
    if (!live.length) return 0;
    return Math.min.apply(null, live.map((t) => t.ms));
  };
  return w;
}

function setCores(n) {
  Object.defineProperty(navigator, 'hardwareConcurrency', { value: n, configurable: true });
}

const origNow = Date.now;
const clock = { now: 1700000000000 };
Date.now = () => clock.now;

function bindClock(w) {
  clock.now = w.now;
  const adv = w.advance;
  w.advance = (ms) => { adv(ms); clock.now = w.now; };
}

(async () => {
  try {
    const hook = html.match(/whisperForTest:\s*\(\)\s*=>\s*\(\{[^}]*\}\)/);
    check('whisperForTest exposes inFlight, behind, paused, lastLatencyMs and model',
      !!hook && ['inFlight', 'behind', 'paused', 'lastLatencyMs', 'model'].every((k) => hook[0].indexOf(k) >= 0),
      hook ? hook[0].slice(0, 180) : 'missing');
    check('the tile chip can say transcription is behind or paused',
      html.indexOf('Transcription paused') > 0 && html.indexOf('Transcription behind, skipping old audio') > 0);
    check('a tile does not wear a transcribing badge',
      html.indexOf("📝 ' + ccLiveLabel") < 0 && html.indexOf('📝 transcribing') < 0);
    check('own voice is written down without the CC switch',
      html.indexOf("if (job.id === 'me') { addTranscriptLine(text, job.at); }") > 0
      && html.indexOf("if (job.id === 'me') { if (myStatus.cc) addTranscriptLine") < 0);

    // ---- model: 4 cores is tiny; an override wins; a bigger machine is base ----
    setCores(4);
    const modelW = makeWorld();
    bindClock(modelW);
    modelW.feed(1);
    check('a 4-core device asks Whisper for tiny', modelW.calls[0] && modelW.calls[0].req.model === 'tiny',
      modelW.calls[0] && modelW.calls[0].req.model);
    modelW.calls[0].resolve('warm');
    await flush();
    modelW.mem.gifos_cc_whisper_model = 'small';
    modelW.feed(2);
    check('gifos_cc_whisper_model overrides the core count', modelW.calls[1] && modelW.calls[1].req.model === 'small',
      modelW.calls[1] && modelW.calls[1].req.model);
    modelW.calls[1].resolve('');
    await flush();
    delete modelW.mem.gifos_cc_whisper_model;
    setCores(8);
    const strong = makeWorld();
    bindClock(strong);
    strong.feed(1);
    check('more than 4 cores ask for base', strong.calls[0] && strong.calls[0].req.model === 'base',
      strong.calls[0] && strong.calls[0].req.model);
    strong.calls[0].resolve('x');
    await flush();

    // ---- slow provider: several clips, answers later than the warm timeout ----
    setCores(8);
    const w = makeWorld();
    bindClock(w);
    w.feed(1);
    check('the first clip is the only call in flight', w.inFlight === 1 && w.calls.length === 1, w.inFlight);
    w.calls[0].resolve('ready');
    await flush();
    check('the first answer is written and Whisper stays up', w.lines.indexOf('ready') >= 0 && w.api.paused() === false && w.inFlight === 0,
      JSON.stringify({ lines: w.lines, paused: w.api.paused(), inFlight: w.inFlight }));
    w.calls.length = 0;
    w.maxInFlight = 0;
    w.feed(2);
    w.feed(3);
    w.feed(4);
    check('three queued clips still make one provider call', w.inFlight === 1 && w.calls.length === 1, w.calls.length + ' calls, ' + w.inFlight + ' in flight');
    const soft = w.softMs();
    check('the warm budget is the short clip timeout, not the cold download', soft > 0 && soft < 60000, soft);
    w.advance(soft + 1);
    w.advance(soft + 1);
    const chip = w.api.chip();
    console.log('STATE after two warm budgets: ' + JSON.stringify({
      inFlight: w.inFlight, maxInFlight: w.maxInFlight, busy: w.api.q.busy, paused: w.api.paused(),
      behind: !!w.api.q.behind, chip: chip, sent: w.api.q.sent, queue: w.api.q.items.length,
      statuses: w.statuses, syncs: w.syncs, stops: w.stops,
    }));
    check('never two provider calls in flight', w.maxInFlight === 1, w.maxInFlight);
    check('the queue stays busy until the provider answers', w.api.q.busy === true && w.inFlight === 1,
      JSON.stringify({ busy: w.api.q.busy, inFlight: w.inFlight }));
    check('slowness does not pause Whisper', w.api.paused() === false, w.api.paused());
    check('Whisper does not give up while the chip still says transcribing',
      !(w.api.paused() && chip === 'transcribing'), JSON.stringify({ paused: w.api.paused(), chip: chip }));
    check('a slow call is shown as behind, not as plain transcribing',
      chip.indexOf('Transcription behind') >= 0 && chip.indexOf('transcribing') < 0, chip);
    check('the status line says transcription is skipping old audio',
      w.statuses.some((s) => s.indexOf('Transcription behind, skipping old audio') >= 0), w.statuses.join(' | '));
    // The provider finally answers, later than the warm timeout.
    w.calls[0].resolve('one');
    await flush();
    check('the late answer is still written', w.lines.indexOf('one') >= 0, w.lines.join('|'));
    check('after that answer still only one call runs at a time', w.maxInFlight === 1, w.maxInFlight);
    // Drain whatever the queue still holds, without overlapping calls.
    for (let n = 0; n < 6 && w.calls.some((c) => !c.settled); n++) {
      const live = w.calls.filter((c) => !c.settled);
      live[0].resolve('more-' + n);
      await flush();
    }
    check('later clips are written too', w.lines.indexOf('more-0') >= 0, w.lines.join('|'));
    check('Whisper is still not paused once the backlog clears', w.api.paused() === false, w.api.paused());

    // ---- a provider that never answers: hard cap releases it, no pause ----
    const dead = makeWorld();
    bindClock(dead);
    dead.feed(1);
    dead.calls[0].resolve('ready');
    await flush();
    dead.calls.length = 0;
    dead.maxInFlight = 0;
    dead.stops = 0;
    dead.feed(2);
    dead.advance(120000);
    await flush();
    console.log('STATE after hard cap: ' + JSON.stringify({
      inFlight: dead.inFlight, maxInFlight: dead.maxInFlight, busy: dead.api.q.busy, paused: dead.api.paused(),
      stops: dead.stops, sent: dead.api.q.sent, statuses: dead.statuses,
    }));
    check('a dead provider is stopped so the next call can start fresh', dead.stops >= 1, dead.stops);
    check('the hard cap does not pause Whisper', dead.api.paused() === false, dead.api.paused());
    check('the dead call was not joined by a second one', dead.maxInFlight === 1, dead.maxInFlight);
    check('the queue is free after the dead call is released', dead.api.q.busy === false && dead.inFlight === 0,
      JSON.stringify({ busy: dead.api.q.busy, inFlight: dead.inFlight }));

    // ---- no browser speech engine: do not fall back and keep claiming transcribing ----
    const quiet = makeWorld();
    bindClock(quiet);
    const prevWindow = global.window;
    global.window = {};
    quiet.api.giveUp();
    const qChip = quiet.api.chip();
    check('with no SpeechRecognition, give-up does not start browser captions', quiet.syncs === 0, quiet.syncs);
    check('…and the chip says transcription is paused', qChip.indexOf('Transcription paused') >= 0 && qChip !== 'transcribing', qChip);
    check('…and the status says transcription is paused',
      quiet.statuses.some((s) => s.indexOf('Transcription paused') >= 0), quiet.statuses.join(' | '));
    if (prevWindow === undefined) delete global.window; else global.window = prevWindow;

    // ---- optional remote endpoint: POST pcm, read JSON {text} ----
    const remote = makeWorld({ mem: { gifos_cc_stt_url: 'http://127.0.0.1:19110/stt' } });
    bindClock(remote);
    const prevFetch = global.fetch;
    let posts = 0;
    global.fetch = (url, opts) => {
      posts++;
      remote.fetchUrl = String(url);
      remote.fetchLen = opts && opts.body ? opts.body.byteLength : 0;
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ text: 'from remote' }) });
    };
    try {
      remote.feed(1);
      await flush();
    } finally {
      global.fetch = prevFetch;
    }
    check('a gifos_cc_stt_url receives one POST and no local provider call',
      posts === 1 && remote.calls.length === 0 && remote.fetchUrl === 'http://127.0.0.1:19110/stt',
      JSON.stringify({ posts: posts, calls: remote.calls.length, url: remote.fetchUrl }));
    check('the remote JSON text is written', remote.lines.indexOf('from remote') >= 0, remote.lines.join('|'));
    check('the posted body is 16 kHz float PCM', remote.fetchLen === 160 * 4, remote.fetchLen);
  } catch (e) {
    fail++;
    console.log('FAIL the stall repro threw — ' + (e && e.stack ? e.stack : e));
  } finally {
    Date.now = origNow;
    try { Object.defineProperty(navigator, 'hardwareConcurrency', { value: 32, configurable: true }); } catch (e) {}
  }
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
