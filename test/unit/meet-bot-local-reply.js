// A Meeting Bot with no Smartest model and no text-to-speech app still
// answers. Other apps keep the setup sheet.
//
//   node test/unit/meet-bot-local-reply.js
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'runtime.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}

const start = src.indexOf('  function localMeetingReply(messages) {');
const end = src.indexOf('  function brokerAI(manifest, d, emit) {');
check('runtime has the local meeting reply', start > 0 && end > start);
const body = start > 0 && end > start ? src.slice(start, end) : '';
const api = new Function(body + '\nreturn { localMeetingReply, localMeetingWav };');
const { localMeetingReply, localMeetingWav } = api();

check('a greeting addressed to the bot is Hello', localMeetingReply([
  { role: 'system', content: 'You are harbor in a meeting.' },
  { role: 'user', content: 'Ada: hello harbor' },
]) === 'Hello.');
check('any other line is heard, not a made-up answer', localMeetingReply([
  { role: 'user', content: 'Ada: what time is the next train' },
]) === 'I heard you.');
check('an empty ask is still a greeting', localMeetingReply([]) === 'Hello.');
const wav = localMeetingWav();
check('the stand-in speech is a wav the bot can play', wav && wav.mime === 'audio/wav' && wav.bytes && wav.bytes.length > 44 && String.fromCharCode(wav.bytes[0], wav.bytes[1], wav.bytes[2], wav.bytes[3]) === 'RIFF');
check('only the Meeting Bot gets the local reply', /manifest\.appId === 'meeting-bot' && \(role === 'smartest' \|\| role === 'tts'\)/.test(src));
check('other apps still see the setup sheet', /showSystemSetup\(\{ kind: 'ai', role: role, hint: d\.hint \}\)/.test(src));

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
