// wait-room.js — a person in the waiting room is not in the meeting.
//
// Gate: node test/unit/wait-room.js
//
// Before the admit-token door, a seated Section-1 member answered WHOHOME
// with HOME and the roster whether or not the waiting room was on, and the
// relay had no second secret. These checks fail on that code and pass once
// a knocker stays unseated until a single-use token bound to them is presented.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}

require(path.join(__dirname, '..', '..', 'js', 'gifos-net.js'));
require(path.join(__dirname, '..', '..', 'js', 'mesh.js'));
let admit = null;
try { require(path.join(__dirname, '..', '..', 'js', 'relay-admit.js')); admit = globalThis.GifOS && globalThis.GifOS.relayAdmit; }
catch (e) { admit = null; }

function makeSeat(id, envExtra) {
  const sent = [];
  let tick = 80;
  const env = Object.assign({
    get TICK() { return tick; },
    HEALING: true,
    send(from, to, m) { sent.push({ from, to, m: Object.assign({}, m) }); },
    knock() {},
    wake() {},
  }, envExtra || {});
  const seat = new globalThis.GifOS.mesh.Seat(id, env);
  seat.myKey = 'mine';
  seat.genKey = 'room-genesis';
  return { seat, sent, tick(n) { tick = n; } };
}

// 1. Unseated while waiting: a Section-1 seat must not hand the roster to a
// knocker the door is holding. Today homeFor runs anyway.
{
  const held = new Set(['knocker-1']);
  const host = makeSeat('host-1', { doorHeld: (id) => held.has(String(id)) });
  host.seat.take({ pc: 0, r: 0, i: 0 }, null, []);
  host.sent.length = 0;
  host.seat.recv({ t: 'WHOHOME', from: 'knocker-1', ttl: 60 });
  const homes = host.sent.filter((s) => s.m && s.m.t === 'HOME');
  const rostered = homes.filter((s) => Array.isArray(s.m.roster) && s.m.roster.length);
  check('unseated while waiting — no HOME roster on WHOHOME', homes.length === 0 && rostered.length === 0, 'HOME frames ' + homes.length + ' rostered ' + rostered.length);
  check('unseated while waiting — answerDoor sends nothing', host.seat.answerDoor(['knocker-1']) === 0, 'n=' + host.seat.answerDoor(['knocker-1']));
  const knocker = makeSeat('knocker-1');
  check('unseated while waiting — knocker state stays at the door', knocker.seat.state !== 3 && !knocker.seat.hasCoord, 'state ' + knocker.seat.state);
}
// A room that is not holding the door still answers, or nobody can join.
{
  const host = makeSeat('host-open');
  host.seat.take({ pc: 0, r: 0, i: 0 }, null, []);
  host.sent.length = 0;
  const n = host.seat.answerDoor(['knocker-9']);
  check('open door still answers WHOHOME', n === 1 && host.sent.some((s) => s.m && s.m.t === 'HOME' && Array.isArray(s.m.roster) && s.m.roster.length), 'n=' + n);
}

check('relay admission module is loaded', !!admit && typeof admit.createRoom === 'function' && typeof admit.knock === 'function');
const wireSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'mesh-wire.js'), 'utf8');
const pageSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'run.html'), 'utf8');
check('wire asks the admit door before seating', wireSrc.indexOf('relayAdmit.clientDoor') > 0);
check('page loads the admit door', pageSrc.indexOf('js/relay-admit.js') > 0);

function roomWithHost() {
  const room = admit.createRoom();
  admit.setPassword(room, 'proof-right');
  const host = admit.knock(room, { peer: 'host-1', pw: 'proof-right', gk: 'g-host' });
  admit.setWait(room, true, true);
  return { room, host };
}

if (!admit) {
  for (const name of [
    'password required to enter the waiting room',
    'wrong password does not restart the room',
    'admit token required',
    'token is single-use',
    'token is bound to that knocker',
    'waiting knocker gets no roster, media, or chat',
    'deny leaves them unseated',
  ]) check(name, false, 'no relay-admit');
} else {
  const open = roomWithHost();
  const before = admit.snapshot(open.room);
  // password required — wrong proof never joins the waiting room
  const bad = admit.knock(open.room, { peer: 'knocker-1', pw: '', gk: 'g-k', restart: true });
  const wrong = admit.knock(open.room, { peer: 'knocker-1', pw: 'proof-wrong', gk: 'g-k', restart: true });
  check('password required to enter the waiting room', bad.t === 'locked' && wrong.t === 'locked' && !open.room.waiting.has('knocker-1') && !open.room.greeters.has('knocker-1'), JSON.stringify({ bad: bad.t, wrong: wrong.t }));
  const after = admit.snapshot(open.room);
  check('wrong password does not restart the room', before === after && open.room.founded === true && open.room.greeters.has('host-1') && bad.restarted !== true && wrong.restarted !== true, before + ' -> ' + after);

  const ok = admit.knock(open.room, { peer: 'knocker-1', pw: 'proof-right', gk: 'g-k' });
  check('admit token required', ok.t === 'wait' && ok.seated === false && !open.room.greeters.has('knocker-1'), ok.t + ' seated=' + ok.seated);
  check('waiting knocker gets no roster, media, or chat', ok.media === false && ok.chat === false && Array.isArray(ok.roster) && ok.roster.length === 0 && admit.rosterOf(open.room, 'knocker-1').length === 0 && admit.mayForward(open.room, 'host-1', 'knocker-1') === false, JSON.stringify(ok));

  const issued = admit.admit(open.room, 'knocker-1', true);
  check('admit issues one token to that knocker', !!(issued && issued.ok && issued.tok && issued.deliverTo === 'knocker-1'), JSON.stringify(issued));

  const other = admit.knock(open.room, { peer: 'knocker-2', pw: 'proof-right', gk: 'g-2', admit: issued.tok });
  check('token is bound to that knocker', other.t === 'wait' && other.seated === false && !open.room.greeters.has('knocker-2') && open.room.tokens.get(issued.tok).used === false, other.t);

  const seated = admit.knock(open.room, { peer: 'knocker-1', pw: 'proof-right', gk: 'g-k', admit: issued.tok });
  check('right token seats that knocker', seated.t === 'greeters' && seated.seated === true && open.room.greeters.has('knocker-1'), seated.t);

  admit.release(open.room, 'knocker-1');
  const again = admit.knock(open.room, { peer: 'knocker-1', pw: 'proof-right', gk: 'g-k', admit: issued.tok });
  check('token is single-use', again.t === 'wait' && again.seated === false && !open.room.greeters.has('knocker-1'), again.t + ' used=' + (open.room.tokens.get(issued.tok) || {}).used);

  const denied = admit.knock(open.room, { peer: 'knocker-3', pw: 'proof-right', gk: 'g-3' });
  const deny = admit.deny(open.room, 'knocker-3', true);
  check('deny leaves them unseated', denied.t === 'wait' && deny.ok === true && deny.seated === false && !open.room.greeters.has('knocker-3'), JSON.stringify(deny));

  const guest = admit.setWait(open.room, false, false);
  check('only an admin toggles the waiting room', guest.ok === false && open.room.wait === true, JSON.stringify(guest));

  // client door: a wait frame must not be treated as a greeter list
  const verdict = admit.clientDoor({ t: 'wait' }, { waitingHold: false, admitPresented: false, state: 0, badPassword: false });
  check('client stays unseated on a wait frame', verdict === 'unseated', verdict);
  const sneak = admit.clientDoor({ t: 'greeters', list: [], founded: true }, { waitingHold: true, admitPresented: false, state: 0, badPassword: false });
  check('client does not mint while the door is holding', sneak === 'unseated', sneak);
  const reuse = admit.clientDoor({ t: 'greeters', list: ['host-1'], founded: true }, { waitingHold: false, admitPresented: false, state: 0, badPassword: true });
  check('client does not mint after a bad password', reuse === 'unseated', reuse);
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
