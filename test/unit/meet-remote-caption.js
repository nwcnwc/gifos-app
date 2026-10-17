// meet-remote-caption.js — a caption written on another device must reach Meet Bot.
//
// gifos.meet.onTranscriptLine hears only window.__gifosMeetEmit({type:'transcript'}).
// That emit used to live only in addTranscriptLine, which is the line THIS
// device writes. A remote line arrives as k:'tr', and takeTr stores it. One
// device writes each voice (ccWrittenElsewhere), so the person who captions
// themselves is heard by everyone else only through takeTr.
//
// Gate style: lift run.html's own takeTr and call the page's takeTrForTest
// hook. No browser. The spy is __gifosMeetEmit.
//
//   node test/unit/meet-remote-caption.js
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

const SRC = slice('    const trs = new Map();', '    function trBlocks()');
const hookM = html.match(/takeTrForTest:\s*(\([^)]*\)\s*=>\s*takeTr\([^)]*\))/);
check('page hook takeTrForTest calls takeTr', !!hookM, hookM && hookM[1]);
const HOOK = hookM ? hookM[1] : '(m) => { throw new Error("takeTrForTest missing"); }';

function world(o) {
  o = o || {};
  const emitted = [];
  const myStatus = { bot: !!o.bot };
  const win = {
    __gifosMeetEmit: (ev) => { emitted.push(JSON.parse(JSON.stringify(ev))); },
  };
  let rateOk = o.rateOk !== false;
  const api = new Function(
    'clog', 'chatRateOk', 'myId', 'trimMap', 'CHAT_MAX', 'window', 'myStatus',
    SRC + '\nconst takeTrForTest = ' + HOOK + ';\nreturn { takeTr, takeTrForTest, size: () => trs.size };'
  )(
    null,
    () => rateOk,
    o.myId || 'me',
    () => {},
    500,
    win,
    myStatus
  );
  return {
    api: api,
    emitted: emitted,
    myStatus: myStatus,
    setRateOk: (v) => { rateOk = !!v; },
  };
}

const ADA = { id: 't1', byId: 'ada', by: 'Ada', at: 1700000001000, text: 'What should we do next?' };
const EXPECT = {
  type: 'transcript',
  line: { by: 'Ada', text: 'What should we do next?', at: 1700000001000, scribeBy: '' },
};

// The bug: a live remote line (this person captioned themselves; no scribe)
// is accepted and still produces no transcript emit.
const live = world();
const accepted = live.api.takeTrForTest(ADA);
check('remote live line is stored', accepted === true && live.api.size() === 1, 'accepted=' + accepted + ' size=' + live.api.size());
check('exactly one transcript emit', live.emitted.length === 1, 'emitted=' + JSON.stringify(live.emitted));
check('emit is {type:transcript, line:{by,text,at,scribeBy}}', live.emitted.length === 1 && JSON.stringify(live.emitted[0]) === JSON.stringify(EXPECT), JSON.stringify(live.emitted[0]));

// Same id is the same line. Dedupe must not emit it again.
const again = live.api.takeTrForTest(ADA);
check('same id is not stored twice', again === false && live.api.size() === 1);
check('same id does not emit again', live.emitted.length === 1, 'emitted=' + live.emitted.length);

// Same words, another writer, inside 8s: trEcho drops the copy.
const echo = world();
check('first copy emits once', echo.api.takeTrForTest(ADA) === true && echo.emitted.length === 1);
const echoLine = { id: 't1b', byId: 'ada', by: 'Ada', at: 1700000002000, text: 'What should we do next?', scribe: 'bea', scribeBy: 'Bea' };
check('echo is dropped', echo.api.takeTrForTest(echoLine) === false && echo.api.size() === 1);
check('echo does not emit', echo.emitted.length === 1, 'emitted=' + echo.emitted.length);

// A 'hi' replay stores the history and must not emit. A later live line still does.
const hi = world();
const replay = { id: 'old', byId: 'ada', by: 'Ada', at: 1700000000000, text: 'We already covered this point.' };
check('hi backfill is stored', hi.api.takeTr(replay, true) === true && hi.api.size() === 1);
check('hi backfill emits nothing', hi.emitted.length === 0, 'emitted=' + JSON.stringify(hi.emitted));
check('live line after a replay still emits once', hi.api.takeTrForTest(ADA) === true && hi.emitted.length === 1 && JSON.stringify(hi.emitted[0]) === JSON.stringify(EXPECT));

// A writer's own voice marked as scribed by themselves is not a line.
const selfScribe = world();
const bad = { id: 'bad', byId: 'ada', by: 'Ada', at: 1700000003000, text: 'What should we do next?', scribe: 'ada', scribeBy: 'Ada' };
check('scribe equal to speaker is dropped', selfScribe.api.takeTrForTest(bad) === false && selfScribe.emitted.length === 0);

// A line written down FOR someone else keeps the scribe's name.
const scribed = world();
const forAda = { id: 's1', byId: 'ada', by: 'Ada', at: 1700000004000, text: 'Please look at the diagram now', scribe: 'bea', scribeBy: 'Bea' };
check('scribed line is stored', scribed.api.takeTrForTest(forAda) === true);
check('scribed line emits scribeBy', scribed.emitted.length === 1 && JSON.stringify(scribed.emitted[0]) === JSON.stringify({
  type: 'transcript',
  line: { by: 'Ada', text: 'Please look at the diagram now', at: 1700000004000, scribeBy: 'Bea' },
}), JSON.stringify(scribed.emitted[0]));

// The flood limiter still drops a live remote line before any emit.
const flooded = world({ rateOk: false });
check('rate limit drops the line', flooded.api.takeTrForTest(ADA) === false && flooded.emitted.length === 0 && flooded.api.size() === 0);

// This page is the bot. Its own voice is not a transcript event. Someone else's is.
const bot = world({ bot: true });
const own = { id: 'own', byId: 'me', by: 'Meet Bot', at: 1700000005000, text: 'I will take the action item.' };
check('bot own line is still stored', bot.api.takeTrForTest(own) === true && bot.api.size() === 1);
check('bot own line is not emitted', bot.emitted.length === 0, 'emitted=' + JSON.stringify(bot.emitted));
check('bot hears another person', bot.api.takeTrForTest(ADA) === true && bot.emitted.length === 1 && JSON.stringify(bot.emitted[0]) === JSON.stringify(EXPECT), JSON.stringify(bot.emitted));

// A person who is not the bot still hears a line someone else wrote about them.
const mine = world();
const aboutMe = { id: 'me1', byId: 'me', by: 'Nia', at: 1700000006000, text: 'I said this out loud today', scribe: 'bea', scribeBy: 'Bea' };
check('own voice scribed by someone else emits', mine.api.takeTrForTest(aboutMe) === true && mine.emitted.length === 1 && mine.emitted[0].line.scribeBy === 'Bea' && mine.emitted[0].line.by === 'Nia');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
