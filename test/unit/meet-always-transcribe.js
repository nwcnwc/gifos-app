// meet-always-transcribe.js — a browser writes its own voice with CC off.
//
// CC only shows or hides captions on this screen. The line still enters the
// transcript and window.__gifosMeetEmit, which is what gifos.meet.onTranscriptLine
// gives the bot.
//
//   node test/unit/meet-always-transcribe.js
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

const WHISPER = slice('    const wspCaps = new Map();', '    const scribeSeen = new Set();');
const ADD = slice('    function addTranscriptLine(text, at, forId)', '    // THE LANGUAGE IS A CHOICE');
const SHOW = slice('    function showCaption(byId, text)', '    let trDirty = false;');

function flush() {
  let p = Promise.resolve();
  for (let i = 0; i < 8; i++) p = p.then(() => {});
  return p;
}

function world(o) {
  o = o || {};
  const w = {
    now: 1700000001000,
    timers: [],
    transcript: [],
    sent: [],
    captions: [],
    calls: [],
    inFlight: 0,
  };
  w.myStatus = { cc: false, muted: false, scribe: false, bot: !!o.bot };
  w.heard = [];
  const gifos = {
    meetHost: o.suppress ? { suppressBotLine: o.suppress } : {},
    providers: {
      call: (_role, req) => {
        w.inFlight++;
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
      stop: () => {},
    },
  };
  const win = {
    GifOS: gifos,
    __gifosMeetEmit: (ev) => {
      const copy = JSON.parse(JSON.stringify(ev));
      w.emitted.push(copy);
      if (copy && copy.type === 'transcript') w.heard.push(copy);
    },
  };
  w.emitted = [];
  const cap = { id: 'me', rate: 16000 };
  const body = [
    'const WSP_WEAK = false;',
    'function wspChipLabel() { return "transcribing"; }',
    'function wspModel() { return "base"; }',
    'const botSpokenLines = [];',
    'let ccShow = false;',
    'const meTile = { cap: { textContent: "", classList: { add: function () {}, remove: function () {} } } };',
    'function uid() { return "t-local"; }',
    'const myId = "me";',
    'function myName() { return "Ada"; }',
    'const rosterNames = {};',
    'function keepOwnTranscript(m) { transcript.push(m); return true; }',
    'function sendAll(msg) { sent.push(JSON.parse(JSON.stringify(msg))); }',
    'function captionScope() { return {}; }',
    'function renderTranscript() {}',
    SHOW,
    ADD,
    WHISPER,
    'return { wspEnqueue, caps: wspCaps };',
  ].join('\n');
  w.api = new Function(
    'setInterval', 'setTimeout', 'clearTimeout', 'ccLang', 'lsGet', 'lsSet',
    'CC_ENGINE_KEY', 'CC_TRANSLATE_KEY', 'CC_WORDS_KEY',
    'IS_MOBILE', 'GifOS', 'setStatus', 'myStatus', 'peers', 'syncSpeech', 'paintCcState',
    'ensureAc', 'ac', 'meters', 'MediaStream', 'whisperReady', 'localStream', 'speakingOf', 'myVoiceAt',
    'WSP_PRE_MS', 'WSP_GAP_MS', 'WSP_MAX_S', 'WSP_MIN_S', 'WSP_BACKLOG', 'WSP_SCRIBE_MAX',
    'window', 'transcript', 'sent', 'captions',
    body
  )(
    () => 0,
    (fn, ms) => { const t = { fn: fn, at: w.now + ms, ms: ms, cleared: false, fired: false }; w.timers.push(t); return t; },
    (t) => { if (t) t.cleared = true; },
    () => 'en',
    () => '',
    () => {},
    'gifos_cc_engine', 'gifos_cc_translate', 'gifos_cc_words',
    false,
    gifos,
    () => {},
    w.myStatus,
    new Map(),
    () => {},
    () => {},
    () => ({ sampleRate: 16000 }), { sampleRate: 16000 }, new Map(), class MediaStream {}, () => true, null, new Map(), 0,
    400, 700, 15, 0.4, 3, 8,
    win, w.transcript, w.sent, w.captions
  );
  w.api.caps.set('me', cap);
  w.feed = () => {
    const pcm = new Float32Array(160);
    pcm[0] = 1;
    return w.api.wspEnqueue(cap, [pcm], w.now, 16000, true);
  };
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
  return w;
}

const TEXT = 'What should we do next?';
const EXPECT = { type: 'transcript', line: { by: 'Ada', text: TEXT, at: 1700000001000, scribeBy: '' } };

(async () => {
  const live = world();
  check('CC starts off', live.myStatus.cc === false);
  live.feed();
  check('a local clip is in flight with CC off', live.calls.length === 1);
  live.calls[0].resolve(TEXT);
  await flush();
  live.advance(1);
  await flush();
  check('the transcript keeps the local line with CC off', live.transcript.length === 1 && live.transcript[0].text === TEXT, JSON.stringify(live.transcript));
  check('the bot hears exactly one onTranscriptLine', live.heard.length === 1 && JSON.stringify(live.heard[0]) === JSON.stringify(EXPECT), JSON.stringify(live.heard));
  check('the line is sent to the meeting', live.sent.length === 1 && live.sent[0].k === 'tr' && live.sent[0].m && live.sent[0].m.text === TEXT, JSON.stringify(live.sent));
  check('CC off does not show a caption on this screen', live.captions.length === 0, JSON.stringify(live.captions));
  check('CC is still off after the line', live.myStatus.cc === false);

  const bot = world({
    bot: true,
    suppress: (isBot, text, forId, id) => !!(isBot && (!forId || forId === id)),
  });
  bot.feed();
  bot.calls[0].resolve(TEXT);
  await flush();
  bot.advance(1);
  await flush();
  check('the bot\'s own microphone is still not a transcript line', bot.transcript.length === 0 && bot.heard.length === 0, JSON.stringify(bot.heard));

  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
