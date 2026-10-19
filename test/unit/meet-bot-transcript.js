// meet-bot-transcript.js — the room transcript holds what the Meeting Bot said,
// and none of Whisper's silence lines.
//
// Nathan's export (2026-10-18 4:50 PM) held only his own lines, written down by
// the bot. The bot's five spoken lines were missing: its microphone is never
// captioned, and nothing else wrote its words down. Among Nathan's lines were
// "you", "you you", "Thank you." and "Okay. you": Whisper's words for silence.
//
// Gate style: lift run.html's own transcript code and load the real
// meet-host.js. No browser.
//
//   node test/unit/meet-bot-transcript.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const rootDir = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(rootDir, 'run.html'), 'utf8');
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

const hostBox = { window: {} };
hostBox.window.addEventListener = () => {};
vm.createContext(hostBox);
vm.runInContext(hostSrc, hostBox, { filename: 'meet-host.js' });
const meetHost = hostBox.window.GifOS.meetHost;
const drop = meetHost.dropWhisperNoise;

// 1. Whisper's silence lines, from Nathan's export.
check('meet-host exposes dropWhisperNoise', typeof drop === 'function');
const NOISE = ['you', 'you you', 'Thank you.', 'You.', 'you.', 'you you you', 'Thanks for watching!', 'Thank you for watching.', ' you '];
for (const n of NOISE) check('silence line ' + JSON.stringify(n) + ' is dropped', drop(n) === '', JSON.stringify(drop(n)));
check('"Okay. you" keeps "Okay."', drop('Okay. you') === 'Okay.', JSON.stringify(drop('Okay. you')));
check('"Thank you. you" is dropped whole', drop('Thank you. you') === '', JSON.stringify(drop('Thank you. you')));
const REAL = [
  'Hello, can you hear me?',
  'Can you hear me? Hello? Hello?',
  'Okay, great. I can hear you. Are you checking the transcript live now?',
  'Thank you for coming, everyone.',
  'I will see you',
  'You know what, let us move on.',
  'Are you there? You',
];
for (const r of REAL) check('real line ' + JSON.stringify(r.slice(0, 32)) + ' is kept as said', drop(r) === r, JSON.stringify(drop(r)));

// Nathan's file, when it is on this machine: every lone filler line goes, every
// sentence stays.
const EXPORT = '/tmp/nathan-transcript-1742.txt';
if (fs.existsSync(EXPORT)) {
  const said = fs.readFileSync(EXPORT, 'utf8').split('\n').filter(Boolean).map((l) => l.replace(/^\[[^\]]+\] [^:]+: /, ''));
  const kept = said.map(drop).filter(Boolean);
  const gone = said.filter((l) => !drop(l));
  check('export: the five lone "you"/"you you"/"Thank you." lines are dropped', gone.length === 5 && gone.every((l) => /^(you( you)*|Thank you\.)$/.test(l)), JSON.stringify(gone));
  check('export: every other line is kept', kept.length === said.length - 5, kept.length + ' of ' + said.length);
  check('export: no kept line ends in a stray " you"', kept.every((l) => !/[.!?]\s+you$/.test(l)), JSON.stringify(kept.filter((l) => /you$/.test(l))));
}

// 2. Whisper's answer goes through the filter before it is written down.
const wspAt = html.indexOf('pending.then((r) => {');
const wspBody = wspAt > 0 ? html.slice(wspAt, html.indexOf('addTranscriptLine(text, job.at)', wspAt)) : '';
check('the Whisper answer is filtered before addTranscriptLine', /GifOS\.meetHost\.dropWhisperNoise\(text\)/.test(wspBody), wspBody.slice(0, 300));

// 3. The bot's spoken line enters the room transcript.
const SRC = slice('    const trs = new Map();', '    // THE LANGUAGE IS A CHOICE');
const EXPORT_MAP = (html.match(/const lines = blocks\.map\((\(l\) => '\[' \+ new Date\(l\.at\)\.toLocaleTimeString\(\) \+ '\] ' \+ l\.by[^\n]*l\.text)\);/) || [])[1];
check('lift: the transcript download line', !!EXPORT_MAP);

function world(o) {
  const sent = [], emitted = [];
  const win = { GifOS: { meetHost }, __gifosMeetEmit: (ev) => emitted.push(ev) };
  const env = {
    clog: null, chatRateOk: () => true, myId: o.myId, trimMap: () => {}, CHAT_MAX: 500,
    window: win, GifOS: win.GifOS, myStatus: { bot: !!o.bot }, uid: (() => { let n = 0; return (p) => p + '_' + o.myId + '_' + (++n); })(),
    myName: () => o.name, sendAll: (msg, opts) => sent.push({ msg: JSON.parse(JSON.stringify(msg)), opts }),
    chatPanelOpen: () => false, transcriptShown: () => false, document: { getElementById: () => null, querySelectorAll: () => [] },
    esc: (s) => s, uiText: (k, d) => d, paintLog: () => {}, avatarChip: () => '', stageIds: () => [], rosterNames: {}, peers: new Map(),
    localStorage: { getItem: () => null },
  };
  const names = Object.keys(env);
  const api = new Function(...names, SRC + '\nreturn { trs, takeTr, addTranscriptLine, writeBotSpoken, trBlocks, rememberBotSpoken };')(...names.map((n) => env[n]));
  return Object.assign(api, { sent, emitted });
}

const bot = world({ myId: 'k_bot', name: 'Meeting Bot', bot: true });
check('run.html has writeBotSpoken', typeof bot.writeBotSpoken === 'function');
const LINE = 'The top headline right now is about the storm on the coast.';
bot.rememberBotSpoken(LINE);
bot.writeBotSpoken(LINE);
const own = Array.from(bot.trs.values());
check('the bot\'s page writes its spoken line once, under its own name', own.length === 1 && own[0].by === 'Meeting Bot' && own[0].byId === 'k_bot' && own[0].text === LINE && !own[0].scribe, JSON.stringify(own));
check('the line goes out as a caption frame', bot.sent.length === 1 && bot.sent[0].msg.k === 'tr' && bot.sent[0].msg.m.text === LINE, JSON.stringify(bot.sent));
check('…to the whole room, not one section', bot.sent.length === 1 && bot.sent[0].opts === undefined, JSON.stringify(bot.sent[0] && bot.sent[0].opts));
check('the bot does not hand its own line back to the bot app as heard speech', bot.emitted.length === 0, JSON.stringify(bot.emitted));

// The bot's own microphone is still never written down.
bot.addTranscriptLine('you', 0);
check('the bot\'s microphone is still not captioned', bot.trs.size === 1, bot.trs.size);
// A scribe line that repeats what the bot just said is still dropped.
bot.addTranscriptLine(LINE, 0, 'k_nathan');
check('the bot\'s voice heard back through someone is still dropped', bot.trs.size === 1, bot.trs.size);

// Nathan's page receives it and shows it as "Meeting Bot: …".
const nathan = world({ myId: 'k_nathan', name: 'Nathan' });
check('Nathan\'s page takes the bot\'s line', nathan.takeTr(bot.sent[0].msg.m) === true);
const blocks = nathan.trBlocks();
check('Nathan\'s transcript reads "Meeting Bot: …"', blocks.length === 1 && blocks[0].by + ': ' + blocks[0].text === 'Meeting Bot: ' + LINE, JSON.stringify(blocks));
if (EXPORT_MAP) {
  const out = blocks.map(new Function('return ' + EXPORT_MAP)());
  check('Nathan\'s download reads "[time] Meeting Bot: …" (no "written down by")', out.length === 1 && / Meeting Bot: The top headline/.test(out[0]) && !/written down/.test(out[0]), JSON.stringify(out));
}
check('Nathan\'s page tells its own apps the bot spoke', nathan.emitted.length === 1 && nathan.emitted[0].line.by === 'Meeting Bot' && nathan.emitted[0].line.text === LINE, JSON.stringify(nathan.emitted));

// A line longer than a caption is cut at spaces, and nothing is lost.
const long = world({ myId: 'k_bot', name: 'Meeting Bot', bot: true });
const words = [];
for (let i = 0; words.join(' ').length < 1000; i++) words.push('word' + i);
const LONG = words.join(' ');
long.writeBotSpoken(LONG);
const parts = long.sent.map((s) => s.msg.m.text);
check('a 1000-character line goes out in pieces of at most 400', parts.length === 3 && parts.every((p) => p.length <= 400), parts.map((p) => p.length).join(','));
check('…cut at spaces, and joined back it is the whole line', parts.join(' ') === LONG);
const rx = world({ myId: 'k_nathan', name: 'Nathan' });
for (const s of long.sent) rx.takeTr(s.msg.m);
const rxBlocks = rx.trBlocks();
check('…and Nathan reads them in order under Meeting Bot', rxBlocks.map((b) => b.text).join(' ') === LONG && rxBlocks.every((b) => b.by === 'Meeting Bot'), JSON.stringify(rxBlocks.map((b) => b.by + ':' + b.text.length)));

// Nothing to say writes nothing.
const quiet = world({ myId: 'k_bot', name: 'Meeting Bot', bot: true });
quiet.writeBotSpoken('   ');
quiet.writeBotSpoken('');
check('an empty line writes nothing', quiet.trs.size === 0 && quiet.sent.length === 0);

// 4. playBotSpeech writes the line once the audio plays.
const speech = slice('      function playBotSpeech(msg) {', '      GifOS.meetSession.install({');
check('playBotSpeech writes the spoken line when play() resolves', /audio\.play\(\)\.then\(\(\) => \{[^}]*writeBotSpoken\(said\.text\)/.test(speech), speech.slice(-300));

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
