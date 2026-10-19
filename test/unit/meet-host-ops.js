// meet-host-ops.js — room ops from host-ops, voice from capabilities.meet.
//
// The bot app makes its own audio (the GifOS MCP servers, gifos-meet-mcp and
// gifos-broadcast-mcp, inject tts and stt; there is no text model) and
// gifos.meet.speak only plays those bytes. The host does not hold a key, a
// model URL, or a speech stand-in. Meeting state, snapshot, the microphone
// and camera, and chat still go through the host.
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
const hostSrc = fs.readFileSync(path.join(rootDir, 'js', 'meet-host.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');

check('the page does not load a host voice engine', indexHtml.indexOf('host-voice.js') < 0 && runHtml.indexOf('host-voice.js') < 0 && sw.indexOf('/js/host-voice.js') < 0);
check('the page does not synthesize speech for the bot', runHtml.indexOf('playMic(msg)') < 0 && runHtml.indexOf('speakText(msg)') < 0 && runHtml.indexOf('setStt(msg)') < 0 && runHtml.indexOf('chat/completions') < 0);

const shimAt = runtime.indexOf('meet: {');
const shim = runtime.slice(shimAt, runtime.indexOf('onTranscriptLine:', shimAt));
for (const name of ['raiseHand:', 'setMic:', 'setCamera:', 'speak:', 'stopSpeaking:', 'sendChat:', 'meetingState:', 'snapshot:']) {
  check('gifos.meet exposes ' + name.replace(':', ''), shim.indexOf(name) > 0);
}
check('gifos.meet.speak takes audio, not a prompt', /speak:\s*function\(id,\s*audio\)/.test(shim) && shim.indexOf('setVoice:') < 0 && shim.indexOf('interject:') < 0 && shim.indexOf('converse:') < 0);

const meetAt = runtime.indexOf("else if (d.type === 'meet')");
const unknownAt = runtime.indexOf("error: 'Unknown meet op.'", meetAt);
const dispatch = runtime.slice(meetAt, unknownAt);
for (const op of ['sendChat', 'raiseHand', 'setMic', 'setCamera', 'speak', 'stopSpeaking', 'meetingState', 'snapshot']) {
  check('the host dispatches ' + op + ' before unknown', dispatch.indexOf("'" + op + "'") > 0);
}
check('voice stays the app audio op', dispatch.indexOf('setVoice') < 0 && dispatch.indexOf('interject') < 0 && dispatch.indexOf('converse') < 0 && dispatch.indexOf("'speak'") > 0);
check('a session can read the room and toggle mic and camera', ['setMic(msg)', 'setCamera(msg)', 'raiseHand(msg)', 'meetingState()', 'snapshot()', 'sendChat(msg)', 'speak(msg)'].every((s) => runHtml.indexOf(s) > 0));
check('speak plays bytes the app already made', /speak\(msg\)\s*\{\s*return playBotSpeech\(msg\);/.test(runHtml));
check('the session iframe may use the mic and the camera', hostSrc.indexOf('microphone; camera; autoplay') > 0);

function boot() {
  const listeners = [];
  const sandbox = {
    console, Promise, Map, Set, Uint8Array, ArrayBuffer, JSON, Math, Object, Array, String, Error, RegExp, Date, Number, Boolean,
    setTimeout, clearTimeout, queueMicrotask
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.GifOS = {};
  const body = { children: [], appendChild(node) { this.children.push(node); node.parentNode = this; return node; } };
  const iframes = [];
  sandbox.document = {
    body: body,
    createElement(tag) {
      const el = { tag: tag || 'div', style: {}, attrs: {}, dataset: {}, children: [], textContent: '', parentNode: null };
      el.setAttribute = (k, v) => { el.attrs[k] = v; };
      el.appendChild = (child) => { el.children.push(child); child.parentNode = el; return child; };
      el.remove = () => {};
      if (tag === 'iframe') {
        const win = {
          postMessage(msg) {
            el.sent = el.sent || [];
            el.sent.push(msg);
            if (msg.op === 'join') {
              el.room = { hand: false, mic: false, camera: false, people: [{ id: 'bot', name: msg.name || '', bot: true, me: true }], chats: [] };
              queueMicrotask(() => el.emit({ ns: 'gifos-meet', op: 'joined', room: 'abc', link: 'http://127.0.0.1/run.html#v=abc' }));
            } else if (msg.ref) {
              queueMicrotask(() => el.emit({ ns: 'gifos-meet', op: 'result', ref: msg.ref, result: answer(el, msg) }));
            }
          }
        };
        el.contentWindow = win;
        el.emit = (data) => { for (const fn of listeners) fn({ source: win, data }); };
        Object.defineProperty(el, 'srcdoc', { set() { queueMicrotask(() => el.emit({ ns: 'gifos-meet', op: 'ready' })); } });
        iframes.push(el);
      }
      return el;
    }
  };
  sandbox.addEventListener = (type, fn) => { if (type === 'message') listeners.push(fn); };
  sandbox.removeEventListener = () => {};
  sandbox.fetch = (url) => {
    if (url === 'run.html') return Promise.resolve({ ok: true, text: () => Promise.resolve('<html><head></head><body></body></html>') });
    return Promise.reject(new Error('unexpected fetch ' + url));
  };
  vm.createContext(sandbox);
  vm.runInContext(hostSrc, sandbox, { filename: 'meet-host.js' });
  return { sandbox, iframes };
}

function answer(iframe, msg) {
  const room = iframe.room || (iframe.room = { hand: false, mic: false, camera: false, people: [], chats: [] });
  if (msg.op === 'raiseHand') { room.hand = !!msg.on; return { hand: room.hand }; }
  if (msg.op === 'setMic') { room.mic = !!msg.on; return { mic: room.mic }; }
  if (msg.op === 'setCamera') { room.camera = !!msg.on; return { camera: room.camera }; }
  if (msg.op === 'meetingState' || msg.op === 'snapshot') {
    return { hand: !!room.hand, mic: !!room.mic, camera: !!room.camera, people: room.people.slice(), chats: room.chats.slice() };
  }
  if (msg.op === 'sendChat') {
    const line = { by: 'harbor-maple', text: msg.text || '', self: true };
    room.chats.push(line);
    return { ok: true, id: 'm1' };
  }
  if (msg.op === 'speak') return { spoken: true, text: msg.text || '' };
  if (msg.op === 'stopSpeaking') return { stopped: true };
  return { ok: true };
}

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
  return host.raiseHand(sess.meetingId, true).then((hand) => {
    return host.setMic(sess.meetingId, true).then((mic) => {
      return host.setCamera(sess.meetingId, false).then(() => {
        return host.meetingState(sess.meetingId).then((state) => {
          const before = frame.sent.length;
          return host.snapshot(sess.meetingId).then((shot) => {
            const ops = frame.sent.slice(before).map((m) => m.op);
            check('hand, mic, and camera round-trip', hand.hand === true && mic.mic === true && state.hand === true && state.mic === true && state.camera === false && shot.hand === true && shot.people && shot.people.length === 1, JSON.stringify(state));
            check('snapshot only reads', ops.length === 1 && ops[0] === 'snapshot', ops.join(','));
            return host.sendChat(sess.meetingId, 'hello in chat');
          });
        });
      });
    });
  }).then((chat) => {
    check('chat is a host op', chat && chat.ok === true && frame.sent.some((m) => m.op === 'sendChat' && m.text === 'hello in chat'));
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
    return host.speak(sess.meetingId, { bytes: bytes, mime: 'audio/wav', text: 'Speaking now.' }).then((spoken) => {
      const said = frame.sent.filter((m) => m.op === 'speak');
      const blob = JSON.stringify(said);
      check('speak plays the app audio and does not fetch', spoken.spoken === true && said.length === 1 && said[0].mime === 'audio/wav' && said[0].text === 'Speaking now.' && blob.indexOf('http') < 0 && !said[0].url);
      frame.emit({ ns: 'gifos-meet', op: 'event', event: { type: 'transcript', line: { by: 'harbor-maple', text: 'Speaking now.' } } });
      frame.emit({ ns: 'gifos-meet', op: 'event', event: { type: 'transcript', line: { by: 'Ada', text: 'What should we do next?' } } });
      frame.emit({ ns: 'gifos-meet', op: 'event', event: { type: 'chat', text: 'hello in chat', by: 'harbor-maple', self: true } });
      frame.emit({ ns: 'gifos-meet', op: 'event', event: { type: 'chat', text: 'Are you there?', by: 'Ada' } });
      const lines = appEvents.filter((e) => e.type === 'meet-event').map((e) => e.event);
      const saidText = lines.filter((e) => e.type === 'transcript').map((e) => e.line.text);
      check('a spoken line and another person both reach the app', saidText.indexOf('Speaking now.') >= 0 && saidText.indexOf('What should we do next?') >= 0, saidText.join('|'));
      check('chat is forwarded, including the bot', lines.filter((e) => e.type === 'chat').length === 2);
      return host.stopSpeaking(sess.meetingId);
    });
  }).then((stopped) => {
    check('stopSpeaking is the play op stopping', stopped && stopped.stopped === true && frame.sent.some((m) => m.op === 'stopSpeaking'));
  });
}).then(() => {
  console.log(fail ? ('\n' + fail + ' FAILURE(S)') : '\nALL PASS');
  process.exit(fail ? 1 : 0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
