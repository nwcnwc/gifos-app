// meet-bot-standard.js — the Meeting Bot's standard behavior (0.9.23b):
//
//   A. a blinking thought bubble on the bot's tile while it thinks, outside
//      the blur filter so it stays sharp on a blurred tile
//   B. a filler line is played, not written down; the next spoken line
//      ends the bubble
//   C. the bot picks No blur and so consents: a camera-off bot never keeps
//      a room blurred
//   +  the bot's spoken lines land in the room transcript under its name
//   +  Whisper's silence lines ("you", "Thank you.") are dropped
//
// Gate style: lift run.html's own code and run it on fakes. No browser.
// The real-meeting proof is test/e2e/bot-standard.js.
//
//   node test/unit/meet-bot-standard.js
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(rootDir, 'run.html'), 'utf8');
const runtime = fs.readFileSync(path.join(rootDir, 'js', 'runtime.js'), 'utf8');
const hostSrc = fs.readFileSync(path.join(rootDir, 'js', 'meet-host.js'), 'utf8');

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
const flush = () => new Promise((r) => setImmediate(r));
// A piece the page lacks is a failure, not a crash: the rest still runs.
function section(name, fn) {
  try { fn(); } catch (e) { check(name + ': runs', false, String(e && e.message || e).slice(0, 160)); }
}

// ---- C: consent ------------------------------------------------------------
section('consent', () => {
  const src = slice('    const blurLevel = (v) =>', '\n') + '\n' + slice('    const consents = (st) =>', '\n');
  const consents = new Function(src + '\nreturn consents;')();
  check('a bot with No blur and no camera consents', consents({ bot: true, camOff: true, blur: 0 }) === true);
  check('a person with No blur and the camera off does not', consents({ camOff: true, blur: 0 }) === false);
  check('a bot still on blur does not', consents({ bot: true, camOff: true, blur: 2 }) === false);
  check('a person with the camera on and No blur consents', consents({ blur: 0 }) === true);
  check('no status, no consent', consents(null) === false);
  const boot = html.slice(html.indexOf("if (params.get('bot') === '1')"), html.indexOf("if (params.get('bot') === '1')") + 1500);
  check('a bot page boots on No blur', /myStatus\.blur = 0;/.test(boot), boot.slice(0, 200));
  const join = slice('        join(msg) {', '        leave() {');
  check('a bot session join picks No blur', /msg\.bot[\s\S]{0,400}myStatus\.blur = 0;/.test(join));
});

// ---- Whisper silence lines (meetHost.dropWhisperNoise, the release cleaner) -
section('whisper', () => {
  const vm = require('vm');
  const box = { window: { addEventListener() {} } };
  vm.createContext(box);
  vm.runInContext(hostSrc, box, { filename: 'meet-host.js' });
  const clean = box.window.GifOS.meetHost.dropWhisperNoise;
  check('meetHost.dropWhisperNoise is the cleaner', typeof clean === 'function');
  // A capital "You" is a word ("Are you there? You" stays). Only a lowercase
  // "you" tacked on after a finished sentence is noise.
  const cases = [
    ['you', ''], ['You.', ''], ['you you', ''], ['Thank you.', ''], ['thank you thank you', ''],
    ['Thanks for watching!', ''], ['[BLANK_AUDIO]', ''], ['(silence)', ''], ['♪', ''], ['', ''],
    ['Okay. you', 'Okay.'], ['Okay. You. you', 'Okay. You.'], ['Right? you', 'Right?'],
    ['Hello, can you hear me?', 'Hello, can you hear me?'], ['Thank you, Ada.', 'Thank you, Ada.'],
    ['I told you', 'I told you'], ['Now we are stuck in picture in picture.', 'Now we are stuck in picture in picture.'],
    ['Are you there? You', 'Are you there? You'],
  ];
  for (const [inp, want] of cases) {
    const got = clean(inp);
    check('Whisper "' + inp + '" -> "' + want + '"', got === want, JSON.stringify(got));
  }
  const wspAt = html.indexOf('pending.then((r) => {');
  const handler = wspAt > 0 ? html.slice(wspAt, html.indexOf('addTranscriptLine(text, job.at)', wspAt)) : '';
  check('the Whisper result handler writes the cleaned text', /GifOS\.meetHost\.dropWhisperNoise\(text\)/.test(handler));
});

// ---- the bot's spoken lines in the room transcript -------------------------
function spokenWorld(bot) {
  const w = { kept: [], sent: [], renders: 0, n: 0 };
  const src = slice('    function writeBotSpoken(text) {', '    // THE LANGUAGE IS A CHOICE');
  w.add = new Function('myStatus', 'myId', 'myName', 'uid', 'keepOwnTranscript', 'sendAll', 'renderTranscript',
    src + '\nreturn writeBotSpoken;')(
    { bot: bot }, 'p-bot', () => 'Meeting Bot', (p) => p + (++w.n),
    (m) => { if (w.kept.some((k) => k.text === m.text && k.at === m.at)) return false; w.kept.push(m); return true; },
    (msg, scope) => w.sent.push({ msg, scope }), () => { w.renders++; });
  return w;
}
section('spoken', () => {
  const w = spokenWorld(true);
  w.add('  The top headline is about the storm.  ');
  check('a spoken line is kept once', w.kept.length === 1, JSON.stringify(w.kept));
  check('it is written under the bot\'s name', w.kept[0] && w.kept[0].by === 'Meeting Bot' && w.kept[0].byId === 'p-bot');
  check('its text is the spoken text, trimmed', w.kept[0] && w.kept[0].text === 'The top headline is about the storm.');
  check('it goes to the whole room as a transcript line', w.sent.length === 1 && w.sent[0].msg.k === 'tr' && w.sent[0].scope === undefined, JSON.stringify(w.sent));
  const long = Array.from({ length: 120 }, (_, i) => 'word' + i).join(' ');
  const w2 = spokenWorld(true);
  w2.add(long);
  check('a long line is cut into several, none over 400 characters', w2.kept.length > 1 && w2.kept.every((m) => m.text.length <= 400), w2.kept.length + ' parts');
  check('the cut is at a space and loses no word', w2.kept.map((m) => m.text).join(' ') === long);
  check('the parts keep their order', w2.kept.every((m, i) => i === 0 || m.at > w2.kept[i - 1].at));
  const w3 = spokenWorld(false);
  w3.add('hello');
  check('a person\'s page never writes a bot line', w3.kept.length === 0);
  const w4 = spokenWorld(true);
  w4.add('   ');
  check('an empty line is not written', w4.kept.length === 0);
});

// ---- A: the thinking state -------------------------------------------------
section('thinking', () => {
  const w = { st: {}, tiles: 0, sent: 0, timers: new Map(), seq: 0 };
  const src = slice('      const BOT_THINK_MS = 60000;', '      GifOS.meetSession.install({');
  const api = new Function('myStatus', 'updateTile', 'broadcastStatus', 'setTimeout', 'clearTimeout',
    src + '\nreturn { setBotThinking, endBotThinking, BOT_THINK_MS };')(
    w.st, () => { w.tiles++; }, () => { w.sent++; },
    (fn, ms) => { const id = ++w.seq; w.timers.set(id, { fn, ms }); return id; }, (id) => { w.timers.delete(id); });
  const on = api.setBotThinking(true);
  check('thinking on sets the status every device draws', on.thinking === true && w.st.think === 1 && w.sent === 1);
  api.setBotThinking(true);
  check('a second "on" does not re-send the status', w.sent === 1);
  check('one cap timer, no pile-up', w.timers.size === 1 && [...w.timers.values()][0].ms === 60000);
  check('the next spoken line ends it (endBotThinking)', api.endBotThinking() === true && !('think' in w.st) && w.timers.size === 0);
  check('ending twice is a no-op', api.endBotThinking() === false);
  api.setBotThinking(true);
  const sentBefore = w.sent;
  [...w.timers.values()][0].fn();
  check('a driver that never says done: the bubble goes after BOT_THINK_MS', !('think' in w.st) && w.sent === sentBefore + 1);
  const off = api.setBotThinking(false);
  check('off when already off is quiet', off.thinking === false && w.sent === sentBefore + 1);

  const install = html.slice(html.indexOf('      GifOS.meetSession.install({'), html.indexOf('      GifOS.meetSession.install({') + 40000);
  check('the session has a thinking op, refused outside a meeting', /thinking\(msg\) \{\s*if \(!meetJoined\) return Promise\.reject\(new Error\('This meeting cannot show the bot thinking\.'\)\);\s*return setBotThinking\(!!\(msg && msg\.on\)\);/.test(install));
  check('leaving ends the bubble', /leave\(\) \{\s*endBotThinking\(\);/.test(install));
});

// ---- A: the bubble on the tile, outside the blur ---------------------------
section('bubble', () => {
  const src = slice("      let bubble = tile.querySelector(':scope > .thinkbubble');", "      let box = tile.querySelector(':scope > .blurbox');");
  const paint = new Function('tile', 'st', 'document', 'uiText', src);
  const el = (cls) => {
    const e = { className: cls || '', attrs: {}, children: [], removed: false, innerHTML: '', title: '',
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      remove() { this.removed = true; tile.children = tile.children.filter((c) => c !== this); } };
    return e;
  };
  const tile = { children: [], appendChild(c) { this.children.push(c); },
    querySelector(sel) { const m = sel.match(/^:scope > \.(.+)$/); return this.children.find((c) => c.className === m[1]) || null; } };
  const doc = { createElement: () => el() };
  const ui = (k, d) => d;
  paint(tile, { bot: true, think: 1 }, doc, ui);
  const b = tile.querySelector(':scope > .thinkbubble');
  check('a thinking bot gets a bubble, a direct child of the tile', !!b && tile.children.length === 1);
  check('the bubble has three dots and says "Thinking…"', b && b.innerHTML === '<i></i><i></i><i></i>' && b.getAttribute('aria-label') === 'Thinking…' && b.getAttribute('role') === 'img');
  paint(tile, { bot: true, think: 1 }, doc, ui);
  check('repainting keeps one bubble', tile.children.length === 1);
  paint(tile, { bot: true }, doc, ui);
  check('the bubble goes when thinking ends', tile.children.length === 0 && b.removed);
  paint(tile, { think: 1 }, doc, ui);
  check('a person never gets a bubble', tile.children.length === 0);

  const css = html.slice(html.indexOf('.tile > .thinkbubble {'), html.indexOf('.tile > .thinkbubble {') + 2000);
  check('the bubble blinks', /animation: thinkblink /.test(css) && /@keyframes thinkblink/.test(html));
  check('the bubble sits above the face', /\.tile > \.thinkbubble \{[^}]*z-index: 5;/.test(css));
  const blurRules = html.match(/^[^\n{]*\.blur[12][^\n{]*\{[^}]*filter:[^}]*\}/gm) || [];
  check('blur filters are on the face only, never the tile or the bubble', blurRules.length > 0 && blurRules.every((r) => !/thinkbubble/.test(r) && !/\.tile\.blur/.test(r)), JSON.stringify(blurRules.slice(0, 6)));
  check('reduced motion stops the blink', /prefers-reduced-motion[\s\S]{0,200}\.thinkbubble[\s\S]{0,80}animation: none/.test(html));
  check('the bubble is translated', /botThinking: 'Denkt nach…'/.test(html) && /botThinking: 'Pensando…'/.test(html));
});

// ---- B: playBotSpeech ends the bubble, writes the line, skips the filler ----
async function playWorld(msg) {
  const w = { ended: 0, written: [], plays: 0 };
  class FakeAudio { constructor() { this.l = {}; } addEventListener(k, f) { this.l[k] = f; } play() { w.plays++; return Promise.resolve(); } }
  class FakeCtx { createMediaElementSource() { return { connect() {} }; } createMediaStreamDestination() { return { stream: { getAudioTracks: () => [{ stop() {} }] } }; } resume() { return Promise.resolve(); } }
  let src = slice('      function playBotSpeech(msg) {', '      GifOS.meetSession.install({');
  const thinkAt = src.indexOf("      // The thought bubble on the bot's tile rides");
  if (thinkAt > 0) src = src.slice(0, thinkAt);
  try {
    const play = new Function('window', 'Blob', 'URL', 'Audio', 'myStatus', 'stopBotSpeech', 'refreshOutbound', 'wspCaps', 'wspStop', 'wspSync',
      'localStream', 'paintControls', 'broadcastStatus', 'rememberBotSpoken', 'endBotThinking', 'writeBotSpoken',
      'let botSpeechUrl = null, botSpeechAudio = null, botSpeechCtx = null, botVoiceTrack = null;\n' + src + '\nreturn playBotSpeech;')(
      { AudioContext: FakeCtx }, class { constructor() {} }, { createObjectURL: () => 'blob:x' }, FakeAudio, {}, () => {}, () => {}, new Map(), () => {}, () => {},
      null, () => {}, () => {}, () => {}, () => { w.ended++; }, (t) => { w.written.push(t); });
    w.result = await play(msg);
  } catch (e) { check('playBotSpeech: runs', false, String(e && e.message || e).slice(0, 160)); }
  await flush();
  return w;
}
(async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const a = await playWorld({ bytes, mime: 'audio/wav', text: 'The answer.' });
  check('speaking ends the bubble', a.ended === 1);
  check('a spoken line is written to the room transcript once', a.written.length === 1 && a.written[0] === 'The answer.', JSON.stringify(a.written));
  check('speak resolves with what was said', a.result && a.result.spoken === true && a.result.text === 'The answer.');
  const f = await playWorld({ bytes, mime: 'audio/wav', text: 'One moment while I think about that.', filler: true });
  check('a filler is played', f.plays === 1);
  check('a filler is not written down', f.written.length === 0, JSON.stringify(f.written));
  check('a filler also ends a bubble already up', f.ended === 1);

  // ---- the plumbing: app -> runtime shim -> dispatcher -> meetHost -> session
  const shimAt = runtime.indexOf('meet: {');
  const shim = runtime.slice(shimAt, runtime.indexOf('onTranscriptLine:', shimAt));
  check('gifos.meet.thinking(id, on) exists', /thinking: function\(id, on\)\{ return rpc\(\{ type:'meet', op:'thinking', meetingId: id, on: !!on \}\); \}/.test(shim));
  check('gifos.meet.speak passes the filler flag', /filler: !!audio\.filler/.test(shim));
  const meetAt = runtime.indexOf("else if (d.type === 'meet')");
  const dispatch = runtime.slice(meetAt, runtime.indexOf("error: 'Unknown meet op.'", meetAt));
  check('the runtime routes thinking to the host', /op === 'thinking'\) done\(host\.thinking\(d\.meetingId, !!d\.on\)\)/.test(dispatch));
  check('the runtime passes the filler flag to the host', /filler: !!d\.filler/.test(dispatch));
  check('meetHost.thinking calls the session op', /thinking: function \(id, on\) \{ return call\(id, 'thinking', \{ on: !!on \}\); \}/.test(hostSrc));
  check('meetHost.speak passes the filler flag', /filler: !!audio\.filler/.test(hostSrc));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
