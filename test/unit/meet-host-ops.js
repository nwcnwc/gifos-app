// meet-host-ops.js — the host answers Meeting Bot's voice and room ops.
//
// The app frame cannot fetch. setVoice keeps the key and the stand-in URLs
// on the host. interject speaks through the session microphone and interrupts
// the bot's own speech. The bot's own voice is not forwarded as a transcript.
//
//   node test/unit/meet-host-ops.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}

const runtime = fs.readFileSync(path.join(rootDir, 'js', 'runtime.js'), 'utf8');
const runHtml = fs.readFileSync(path.join(rootDir, 'run.html'), 'utf8');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');

check('the home screen does not load the host voice engine', indexHtml.indexOf('host-voice.js') < 0);
check('the meeting page loads the host voice engine', /js\/host-voice\.js/.test(runHtml));
check('the offline shell caches the host voice engine', sw.indexOf('/js/host-voice.js') >= 0);
const shimAt = runtime.indexOf('setVoice: function(settings)');
const unknownAt = runtime.indexOf("error: 'Unknown meet op.'");
check('the app shim exposes the new meet ops', shimAt > 0 && ['interject:', 'raiseHand:', 'setMic:', 'setCamera:', 'meetingState:', 'snapshot:', 'stopSpeaking:', 'converse:'].every((s) => runtime.indexOf(s, shimAt - 20) > 0));
const dispatch = runtime.slice(runtime.indexOf("else if (d.type === 'meet')"), unknownAt);
for (const op of ['setVoice', 'interject', 'converse', 'stopSpeaking', 'raiseHand', 'setMic', 'setCamera', 'meetingState', 'snapshot']) {
  check('the host dispatches ' + op + ' before unknown', dispatch.indexOf("'" + op + "'") > 0 || dispatch.indexOf('op === \'' + op + '\'') > 0);
}
check('a session can play into the mic and toggle the room', ['playMic(msg)', 'setMic(msg)', 'setCamera(msg)', 'raiseHand(msg)', 'meetingState()', 'snapshot()', 'speakText(msg)'].every((s) => runHtml.indexOf(s) > 0));
check('the session iframe may use the camera', runHtml.indexOf("allow', 'microphone; camera; autoplay'") < 0 && fs.readFileSync(path.join(rootDir, 'js', 'meet-host.js'), 'utf8').indexOf('microphone; camera; autoplay') > 0);

function boot() {
  const listeners = [];
  const fetches = [];
  const kokoro = [];
  const sandbox = {
    console, Promise, Map, Set, Uint8Array, ArrayBuffer, DataView, TextDecoder, AbortController,
    JSON, Math, Object, Array, String, Error, RegExp, Date, Number, Boolean, parseInt, isNaN,
    setTimeout, clearTimeout, queueMicrotask,
    fetches, kokoro
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.GifOS = {
    providers: {
      assigned: () => ({ app: 'offline-tts-kokoro' }),
      call: (role, req) => { kokoro.push({ role, req }); return Promise.resolve({ bytes: new Uint8Array([9, 9]).buffer, mime: 'audio/wav' }); }
    }
  };
  const iframes = [];
  sandbox.document = {
    body: { appendChild() {} },
    createElement() {
      const iframe = { style: {}, attrs: {}, sent: [], _src: '', holdPlay: false };
      iframe.setAttribute = (k, v) => { iframe.attrs[k] = v; };
      iframe.remove = () => {};
      const win = {
        postMessage(msg) {
          iframe.sent.push(JSON.parse(JSON.stringify(msg, (k, val) => val instanceof ArrayBuffer || ArrayBuffer.isView(val) ? { __bytes: true, n: val.byteLength } : val)));
          iframe.sentRaw = iframe.sentRaw || [];
          iframe.sentRaw.push(msg);
          if (msg.op === 'join') {
            iframe.room = { hand: false, mic: false, camera: false, people: [{ id: 'bot', name: msg.name || '', bot: true, me: true }] };
            queueMicrotask(() => iframe.emit({ ns: 'gifos-meet', op: 'joined', room: 'abc', link: 'http://127.0.0.1/run.html#v=abc' }));
          } else if (msg.op === 'playMic' && iframe.holdPlay) {
            iframe.held = msg;
          } else if (msg.ref) {
            const result = answer(iframe, msg);
            queueMicrotask(() => iframe.emit({ ns: 'gifos-meet', op: 'result', ref: msg.ref, result }));
          }
        }
      };
      iframe.contentWindow = win;
      iframe.emit = (data) => {
        for (const fn of listeners) fn({ source: win, data });
      };
      Object.defineProperty(iframe, 'srcdoc', {
        set(html) { iframe._src = html; queueMicrotask(() => iframe.emit({ ns: 'gifos-meet', op: 'ready' })); }
      });
      iframes.push(iframe);
      return iframe;
    }
  };
  sandbox.addEventListener = (type, fn) => { if (type === 'message') listeners.push(fn); };
  sandbox.removeEventListener = (type, fn) => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
  sandbox.fetch = (url, opts) => {
    const rec = { url: String(url), opts: opts || {}, body: opts && opts.body };
    fetches.push(rec);
    if (url === 'run.html') return Promise.resolve({ ok: true, text: () => Promise.resolve('<html><head></head><body></body></html>') });
    if (String(url).indexOf('/chat/completions') >= 0) {
      const first = 'data: {"choices":[{"delta":{"content":"Hello there. "}}]}\n\n';
      const second = 'data: {"choices":[{"delta":{"content":"More follows."}}]}\n\ndata: [DONE]\n';
      let n = 0;
      return Promise.resolve({
        ok: true,
        body: { getReader: () => ({ read: () => {
          n += 1;
          if (n === 1) return Promise.resolve({ done: false, value: first });
          if (n === 2) return Promise.resolve({ done: false, value: second });
          return Promise.resolve({ done: true });
        } }) }
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => 'audio/wav' },
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer)
    });
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(rootDir, 'js', 'host-voice.js'), 'utf8'), sandbox, { filename: 'host-voice.js' });
  vm.runInContext(fs.readFileSync(path.join(rootDir, 'js', 'meet-host.js'), 'utf8'), sandbox, { filename: 'meet-host.js' });
  return { sandbox, iframes, fetches, kokoro, listeners };
}

function answer(iframe, msg) {
  const room = iframe.room || (iframe.room = { hand: false, mic: false, camera: false, people: [] });
  if (msg.op === 'raiseHand') { room.hand = !!msg.on; return { hand: room.hand }; }
  if (msg.op === 'setMic') { room.mic = !!msg.on; return { mic: room.mic }; }
  if (msg.op === 'setCamera') { room.camera = !!msg.on; return { camera: room.camera }; }
  if (msg.op === 'meetingState' || msg.op === 'snapshot') {
    return { hand: !!room.hand, mic: !!room.mic, camera: !!room.camera, people: room.people.slice() };
  }
  if (msg.op === 'playMic') return { spoken: true };
  if (msg.op === 'stopMic') return { stopped: true };
  if (msg.op === 'speakText') return { spoken: true, text: msg.text || '' };
  if (msg.op === 'setStt') { iframe.stt = msg.url || ''; return { ok: true }; }
  return { ok: true };
}

function leak(value, secrets) {
  const blob = JSON.stringify(value);
  return secrets.filter((s) => s && blob.indexOf(s) >= 0);
}

const KEY = 'sk-test-SECRET-key-9f3a';
const TTS = 'https://tts.example.test/speak';
const STT = 'https://stt.example.test/v1';
const LLM = 'http://127.0.0.1:9/v1';

const world = boot();
const host = world.sandbox.GifOS.meetHost;
const appEvents = [];
host.onApp({ postMessage(msg) { appEvents.push(msg); } });

check('a bot line on its own microphone is dropped', host.suppressBotLine(true, 'Speaking now.', undefined, 'me', []) === true);
check('another person is kept', host.suppressBotLine(true, 'What should we do next?', 'ada', 'me', []) === false);
check('an echo of the bot is dropped', host.suppressBotLine(true, 'Speaking now.', 'ada', 'me', ['Speaking now.']) === true);
check('a person who is not the bot is kept', host.suppressBotLine(false, 'Speaking now.', undefined, 'me', ['Speaking now.']) === false);

host.join({ room: 'abc', name: 'harbor-maple', bot: true }).then((sess) => {
  check('join returns a meeting id', !!sess.meetingId);
  const frame = world.iframes[0];
  check('the session frame may use mic and camera', frame.attrs.allow === 'microphone; camera; autoplay');
  return host.setVoice({
    respond_to_command: true,
    conversation_voice: 'local',
    llm: { url: LLM, model: 'local-model', key: KEY },
    tts: { engine: 'http', url: TTS, voice: 'af_heart' },
    stt: { url: STT }
  }).then((pub) => {
    const leaked = leak(pub, [KEY, TTS, STT]);
    check('setVoice public result omits the key and the stand-in URLs', leaked.length === 0 && pub.tts.engine === 'http' && pub.stt.configured === true && pub.llm.model === 'local-model', JSON.stringify(pub));
    check('the captions stand-in is handed to the session without coming back', frame.stt === STT && leak(pub, [STT]).length === 0);
    return host.setVoice({ conversation_voice: 'nope', llm: { key: KEY } }).then(() => {
      check('a bad voice rejects', false);
    }, (e) => {
      check('a bad voice rejects without the key', /none, grok, or local/.test(e.message) && e.message.indexOf(KEY) < 0, e.message);
    }).then(() => host.raiseHand(sess.meetingId, true)).then((hand) => {
      return host.setMic(sess.meetingId, true).then((mic) => {
        return host.setCamera(sess.meetingId, false).then(() => {
          return host.meetingState(sess.meetingId).then((state) => {
            const before = frame.sentRaw.length;
            return host.snapshot(sess.meetingId).then((shot) => {
              const ops = frame.sentRaw.slice(before).map((m) => m.op);
              check('hand, mic, and camera round-trip', hand.hand === true && mic.mic === true && state.hand === true && state.mic === true && state.camera === false && shot.hand === true && shot.people && shot.people.length === 1, JSON.stringify(state));
              check('snapshot only reads', ops.length === 1 && ops[0] === 'snapshot' && !ops.some((op) => op === 'setMic' || op === 'playMic' || op === 'raiseHand'), ops.join(','));
              return host.interject(sess.meetingId, 'Speaking now.');
            });
          });
        });
      });
    }).then((spoken) => {
      const tts = world.fetches.filter((f) => f.url === TTS);
      check('interject speaks through the session mic', spoken.spoken === true && spoken.id === sess.meetingId);
      check('the speech stand-in gets text and voice and not the key', tts.length === 1 && tts[0].opts.headers.authorization == null && JSON.parse(tts[0].body).text === 'Speaking now.' && JSON.stringify(tts[0].body).indexOf(KEY) < 0);
      check('the played bytes reached the session', frame.sentRaw.some((m) => m.op === 'playMic' && m.text === 'Speaking now.' && m.bytes));
      frame.emit({ ns: 'gifos-meet', op: 'event', event: { type: 'transcript', line: { by: 'harbor-maple', text: 'Speaking now.' } } });
      frame.emit({ ns: 'gifos-meet', op: 'event', event: { type: 'transcript', line: { by: 'Ada', text: 'What should we do next?' } } });
      const lines = appEvents.filter((e) => e.type === 'meet-event' && e.event && e.event.type === 'transcript').map((e) => e.event.line.text);
      check('the bot voice stays out of the transcript', lines.indexOf('Speaking now.') < 0 && lines.indexOf('What should we do next?') >= 0, lines.join('|'));
      const dumped = JSON.stringify(appEvents) + JSON.stringify(spoken);
      check('events do not carry the key or the stand-in URLs', dumped.indexOf(KEY) < 0 && dumped.indexOf(TTS) < 0 && dumped.indexOf(STT) < 0);
      return host.converse(sess.meetingId, { by: 'Ada', text: 'What should we do next?' });
    }).then((said) => {
      const chat = world.fetches.filter((f) => String(f.url).indexOf('/chat/completions') >= 0);
      const body = JSON.parse(chat[0].body);
      check('local voice streams only model, messages, and stream', JSON.stringify(Object.keys(body).sort()) === JSON.stringify(['messages', 'model', 'stream']) && body.stream === true);
      check('the key is only the bearer token', chat[0].opts.headers.authorization === 'Bearer ' + KEY && JSON.stringify(body).indexOf(KEY) < 0);
      check('the first clause is spoken before the stream ends', said.spoken === true && said.clauses && said.clauses[0] === 'Hello there.' && said.clauses.indexOf('More follows.') >= 0, JSON.stringify(said && said.clauses));
      check('the language-model fetch does not send cookies', chat[0].opts.credentials === 'omit' && chat[0].opts.redirect === 'error');
      return host.setVoice({
        conversation_voice: 'local',
        tts: { engine: 'kokoro', app: 'offline-tts-kokoro', voice: 'af_heart' }
      });
    }).then(() => host.interject(sess.meetingId, 'Kokoro line.')).then(() => {
      check('Kokoro is the computer text-to-speech provider', world.kokoro.some((c) => c.role === 'tts' && c.req.text === 'Kokoro line.' && c.req.voice === 'af_heart'));
      return host.setVoice({ conversation_voice: 'grok' });
    }).then((pub) => {
      check('grok drops the local key from the public settings', pub.conversation_voice === 'grok' && !pub.llm && leak(pub, [KEY, TTS, STT]).length === 0, JSON.stringify(pub));
      return host.interject(sess.meetingId, 'Grok says hello.');
    }).then((g) => {
      check('grok speaks on the meeting page', g.spoken === true && frame.sentRaw.some((m) => m.op === 'speakText' && m.text === 'Grok says hello.'));
      return host.setVoice({
        conversation_voice: 'local',
        tts: { engine: 'http', url: TTS, voice: 'af_heart' }
      });
    }).then(() => {
      frame.holdPlay = true;
      const pending = host.interject(sess.meetingId, 'Hold this.');
      return new Promise((res) => setTimeout(res, 20)).then(() => host.stopSpeaking(sess.meetingId)).then(() => {
        const held = frame.held;
        check('stop interrupts an in-flight interject', !!held && held.op === 'playMic');
        frame.holdPlay = false;
        frame.emit({ ns: 'gifos-meet', op: 'result', ref: held.ref, result: { spoken: true } });
        return pending;
      }).then((r) => {
        check('a stopped interject does not count as spoken', r && r.spoken === false && r.stopped === true, JSON.stringify(r));
      });
    });
  });
}).then(() => {
  const blob = JSON.stringify(world.fetches.map((f) => ({ url: f.url === 'run.html' || f.url === TTS || f.url.indexOf('/chat/completions') >= 0 ? f.url : 'other' })));
  check('fetches the test made are only the page, the stand-in, and the model', blob.indexOf(KEY) < 0);
  console.log(fail ? ('\n' + fail + ' FAILURE(S)') : '\nALL PASS');
  process.exit(fail ? 1 : 0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
