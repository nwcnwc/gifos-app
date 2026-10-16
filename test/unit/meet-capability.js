// Meeting control is capabilities.meet. The ops are the Meet buttons
// (hand, microphone, camera) plus speaking on the bot's microphone and
// opening a watch-only tile. No model URL and no key lives here.
//
//   node test/unit/meet-capability.js
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
const perms = fs.readFileSync(path.join(rootDir, 'js', 'gifos-perms.js'), 'utf8');

const shimAt = runtime.indexOf('meet: {');
const shim = runtime.slice(shimAt, runtime.indexOf('onTranscriptLine:', shimAt));
for (const name of ['raiseHand:', 'setMic:', 'setCamera:', 'speak:', 'stopSpeaking:', 'watch:']) {
  check('gifos.meet exposes ' + name.replace(':', ''), shim.indexOf(name) > 0);
}
const meetAt = runtime.indexOf("else if (d.type === 'meet')");
const unknownAt = runtime.indexOf("error: 'Unknown meet op.'", meetAt);
const dispatch = runtime.slice(meetAt, unknownAt);
check('new ops are inside the meet capability dispatch', meetAt > 0 && unknownAt > meetAt && dispatch.indexOf('meetNo') > 0);
for (const op of ['raiseHand', 'setMic', 'setCamera', 'speak', 'stopSpeaking', 'watch']) {
  check('dispatch allows ' + op, dispatch.indexOf("'" + op + "'") > 0);
}
check('the host does not grow a model URL op', dispatch.indexOf('setVoice') < 0 && dispatch.indexOf('converse') < 0 && hostSrc.indexOf('chat/completions') < 0);
check('the watch tile is watch-only', hostSrc.indexOf('data-gifos-bot-eye') > 0 && hostSrc.indexOf('Watch and listen only') > 0 && hostSrc.indexOf('pointer-events:none') > 0);
check('the meeting page hides mic and camera in the bot-eye view', /body\.bot-eyes[\s\S]{0,240}#mic/.test(runHtml) && /body\.bot-eyes[\s\S]{0,240}#cam/.test(runHtml));
check('the bot records its own chat as a chat event', /sendChat\(msg\)[\s\S]{0,700}self:\s*true/.test(runHtml));
check('session ops call the meeting buttons', ['raiseHand(msg)', 'setMic(msg)', 'setCamera(msg)', 'speak(msg)', 'watch(msg)'].every((s) => runHtml.indexOf(s) > 0));
check('the permission sheet grants meeting control with the other abilities', /watch and listen/i.test(perms) && /capabilities\.meet|meet:/.test(perms));

function boot() {
  const listeners = [];
  const sandbox = {
    console, Promise, Map, Set, Uint8Array, ArrayBuffer, JSON, Math, Object, Array, String, Error, RegExp, Date, Number, Boolean,
    setTimeout, clearTimeout, queueMicrotask
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.GifOS = {};
  const body = { children: [], appendChild(node) { this.children.push(node); node.parentNode = this; return node; }, removeChild(node) { this.children = this.children.filter((n) => n !== node); node.parentNode = null; } };
  function node(tag) {
    const el = { tag: tag, style: {}, attrs: {}, dataset: {}, children: [], textContent: '', parentNode: null };
    el.setAttribute = (k, v) => { el.attrs[k] = v; };
    el.appendChild = (child) => { el.children.push(child); child.parentNode = el; return child; };
    el.removeChild = (child) => { el.children = el.children.filter((n) => n !== child); child.parentNode = null; };
    el.remove = () => { if (el.parentNode && el.parentNode.removeChild) el.parentNode.removeChild(el); };
    return el;
  }
  const iframes = [];
  sandbox.document = {
    body: body,
    createElement(tag) {
      const el = node(tag || 'div');
      if (tag === 'iframe') {
        const win = {
          postMessage(msg) {
            el.sent = el.sent || [];
            el.sent.push(msg);
            if (msg.op === 'join') queueMicrotask(() => el.emit({ ns: 'gifos-meet', op: 'joined', room: 'abc', link: 'http://127.0.0.1/run.html#v=abc' }));
            else if (msg.ref) queueMicrotask(() => el.emit({ ns: 'gifos-meet', op: 'result', ref: msg.ref, result: { ok: true, on: msg.on } }));
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
    if (url === 'run.html') return Promise.resolve({ ok: true, text: () => Promise.resolve('<html><head></head><body>Ada</body></html>') });
    return Promise.reject(new Error('unexpected fetch ' + url));
  };
  vm.createContext(sandbox);
  vm.runInContext(hostSrc, sandbox, { filename: 'meet-host.js' });
  return { sandbox, iframes, body };
}

function textOf(node) {
  let s = node && node.textContent || '';
  ((node && node.children) || []).forEach((c) => { s += ' ' + textOf(c); });
  return s;
}

const world = boot();
const host = world.sandbox.GifOS.meetHost;
const appEvents = [];
host.onApp({ postMessage(msg) { appEvents.push(msg); } });
host.join({ room: 'abc', name: 'harbor-maple', bot: true }).then((sess) => {
  check('join returns a meeting id', !!sess.meetingId);
  const frame = world.iframes[0];
  check('the hidden session is not a click target', /pointer-events:\s*none/.test(frame.style.cssText));
  return host.watch(sess.meetingId, true).then((eye) => {
    const tile = world.body.children.filter((n) => n.attrs && n.attrs['data-gifos-bot-eye'])[0];
    const label = textOf(tile);
    check('watch opens one bot-eye tile', !!tile && eye.watch === true, label);
    check('the tile says it is watch and listen only', label.indexOf('Watch and listen only') >= 0 && label.indexOf("Through the bot's eyes") >= 0, label);
    check('the meeting view ignores clicks and fills the tile', /pointer-events:\s*none/.test(frame.style.cssText) && /opacity:\s*1/.test(frame.style.cssText) && /width:\s*380px/.test(frame.style.cssText) && frame.parentNode === world.body);
    check('the tile has no microphone or camera control', label.indexOf('Mic') < 0 && label.indexOf('Camera') < 0, label);
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
    return host.speak(sess.meetingId, { bytes: bytes, mime: 'audio/wav', text: 'Speaking now.' }).then(() => {
      const spoken = frame.sent.filter((m) => m.op === 'speak');
      const blob = JSON.stringify(spoken);
      check('speak sends audio bytes and no URL', spoken.length === 1 && spoken[0].text === 'Speaking now.' && spoken[0].mime === 'audio/wav' && blob.indexOf('http') < 0 && !spoken[0].url);
      return host.raiseHand(sess.meetingId, true);
    }).then(() => {
      check('raise hand is the hand button op', frame.sent.some((m) => m.op === 'raiseHand' && m.on === true));
      return host.setMic(sess.meetingId, true);
    }).then(() => {
      check('microphone is the mic button op', frame.sent.some((m) => m.op === 'setMic' && m.on === true));
      frame.emit({ ns: 'gifos-meet', op: 'event', event: { type: 'transcript', line: { by: 'harbor-maple', text: 'Speaking now.' } } });
      frame.emit({ ns: 'gifos-meet', op: 'event', event: { type: 'chat', text: 'hello in chat', by: 'harbor-maple', self: true } });
      frame.emit({ ns: 'gifos-meet', op: 'event', event: { type: 'chat', text: 'Are you there?', by: 'Ada' } });
      const lines = appEvents.filter((e) => e.type === 'meet-event').map((e) => e.event);
      check('the bot voice is forwarded on the spoken transcript', lines.some((e) => e.type === 'transcript' && e.line && e.line.text === 'Speaking now.' && e.line.by === 'harbor-maple'));
      check('chat is forwarded separately, including the bot', lines.filter((e) => e.type === 'chat').length === 2);
      return host.watch(sess.meetingId, false);
    }).then(() => {
      const tile = world.body.children.filter((n) => n.attrs && n.attrs['data-gifos-bot-eye'])[0];
      check('closing the tile removes it', !tile);
    });
  });
}).then(() => {
  console.log(fail ? ('\n' + fail + ' FAILURE(S)') : '\nALL PASS');
  process.exit(fail ? 1 : 0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
