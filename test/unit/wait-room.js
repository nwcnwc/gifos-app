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

const J = (...x) => path.join(__dirname, '..', '..', 'js', ...x);
require(J('gifos-net.js'));
require(J('mesh-identity.js'));
for (const f of fs.readdirSync(J('mesh')).sort()) if (f.endsWith('.js')) require(J('mesh', f));
for (const f of ['env.js', 'pclaws-wire.js', 'layer.js']) require(J('mesh', 'page', f));
require(J('mesh-wire.js'));
let admit = null;
try { require(J('relay-admit.js')); admit = globalThis.GifOS && globalThis.GifOS.relayAdmit; }
catch (e) { admit = null; }
const G = globalThis.GifOS, sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A founder on the new wire: a fake relay socket, one open pair to the knocker, every frame out recorded.
async function founder(doorHeld) {
  const sent = []; let sock = null;
  const realSocket = G.net.steadySocket;
  G.net.steadySocket = () => (sock = { state: 'up', send() {}, close() {}, kick() {} });
  const node = G.meshWire.createMeshNode({ relayUrl: 'ws://x', sid: 's', tok: 't', key: await G.net.deriveMeetKey('wait-room', ''), tickMs: 10, doorHeld,
    sendDC: (to, m) => { sent.push({ to, m }); return true; }, pc: { ensure() {}, close() {}, bye() {}, state() { return 'open'; } }, dcOpen: () => true, dropDeepSocket: false });
  await node.whenReady; G.net.steadySocket = realSocket;
  sock.onmessage({ data: JSON.stringify({ t: 'greeters', list: [], founded: true, admitted: true }) });
  for (let i = 0; i < 100 && node.seat.state !== 3; i++) await sleep(10);
  return { node, sent, homes: (to) => sent.filter((s) => s.to === to && s.m.t === 'MW2' && s.m.f.t === 'HOME') };
}
function knock(h, who) {
  const w = G.meshMsg.newMsg('WHOHOME'); w.from = G.meshPageEnv.nidOf(who); w.ttl = 60;
  h.node.transport(who, 'open');
  h.node.recvCtl({ t: 'MW2', f: G.meshMsg.writeMsg(w) }, who, true);
}

async function wireChecks() {
  const k1 = 'k_' + 'a1'.repeat(20), k2 = 'k_' + 'b2'.repeat(20);
  // 1. Unseated while waiting: a Section-1 seat must not hand the roster to a knocker the door is holding.
  const held = new Set([k1]), asked = [];
  const host = await founder((id) => { asked.push(id); return held.has(String(id)); });
  check('founder sits on the new wire', host.node.seat.state === 3, 'state ' + host.node.seat.state);
  knock(host, k1); await sleep(200);
  check('held knock reaches the page', asked.includes(k1), asked.join());
  check('unseated while waiting: no HOME on WHOHOME', host.homes(k1).length === 0, 'HOME frames ' + host.homes(k1).length);
  host.node.seat.answerDoor([k2]);   // nothing was withheld from this one
  await sleep(50);
  check('answerDoor sends nothing to an id with no held knock', host.homes(k2).length === 0);
  // The page's OK: not held any more, and the kept ask is answered without waiting for the knocker's retry.
  held.delete(k1); host.node.transport(k1, 'open'); host.node.seat.answerDoor([k1]); await sleep(200);
  const hm = host.homes(k1);
  check('host OK answers the held knock', hm.length >= 1 && Array.isArray(hm[0].m.f.roster) && hm[0].m.f.roster.length > 0, String(JSON.stringify(hm[0] && hm[0].m.f)).slice(0, 120) + ' sent ' + host.sent.map((s) => s.m.f ? s.m.f.t : s.m.t).join());
  host.node.stop();
  // 2. A thrown hold fails closed.
  const thrown = await founder(() => { throw new Error('hold broke'); });
  knock(thrown, k1); await sleep(200);
  check('a thrown hold fails closed', thrown.homes(k1).length === 0);
  thrown.node.stop();
  // 3. A room that is not holding the door still answers, or nobody can join.
  for (const [name, hold] of [['no doorHeld', undefined], ['doorHeld false', () => false]]) {
    const open = await founder(hold);
    knock(open, k2); await sleep(200);
    check('open door still answers WHOHOME (' + name + ')', open.homes(k2).length >= 1, 'sent ' + open.sent.length);
    open.node.stop();
  }
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

wireChecks().catch((e) => check('wire checks ran', false, String(e && e.stack || e))).then(() => {
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
});
