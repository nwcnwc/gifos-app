// pub-camera.js — a verified PUB pins a camera cell.
//
// Gate: node test/unit/pub-camera.js
//
// The wire verifies PUB on the fill path (SIGNED). The seat honors one only
// when that verdict is stamped, seats it when the cell is free or already
// this id, and keeps sid beside the fill. A forged or replayed signature is
// rejected before the seat sees it. An occupied cell is left alone.
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}

require(path.join(__dirname, '..', '..', 'js', 'gifos-net.js'));
require(path.join(__dirname, '..', '..', 'js', 'gifos-ed.js'));
require(path.join(__dirname, '..', '..', 'js', 'mesh-identity.js'));
require(path.join(__dirname, '..', '..', 'js', 'mesh.js'));

const topo = globalThis.GifOS.net.topo;
const ident = globalThis.GifOS.meshIdentity;
const CAM = 'cam-publisher';
const CELL = topo.ckey({ pc: 0, r: 0, i: 1 });
const HEAD = topo.ckey({ pc: 0, r: 0, i: 0 });

function makeSeat(id, coord, extra) {
  const sent = [];
  let tick = 408; // 408 % 12 === 0, so tick+60 is a rowSweep beat inside NBR_GAP
  const env = Object.assign({
    get TICK() { return tick; },
    HEALING: true,
    COMPACTION: false,
    send(from, to, m) { sent.push({ to, t: m && m.t }); },
    knock() {},
    wake() {},
  }, extra || {});
  const seat = new globalThis.GifOS.mesh.Seat(id, env);
  seat.myKey = 'mine';
  seat.genKey = 'room-genesis';
  if (coord) seat.take(coord, null, []);
  sent.length = 0;
  return {
    seat, sent,
    get tick() { return tick; },
    set tick(n) { tick = n; },
    yields() { return sent.filter((s) => s.t === 'YIELD').length; },
    places() { return sent.filter((s) => s.t === 'PLACE').length; },
  };
}

function pub(id, ck, sid, ok) {
  const m = { t: 'PUB', ck: ck || CELL, id: id || CAM, sid: sid || 'sess-1' };
  if (ok !== false) m.s4ok = true;
  return m;
}

function pin(w, id, ck, sid) {
  w.seat.recv(pub(id, ck, sid, true));
}

const wire = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'mesh-wire.js'), 'utf8');
const signed = /const SIGNED = new Set\(\[([^\]]*)\]\)/.exec(wire);
check('PUB is a signed fill', !!signed && signed[1].indexOf("'PUB'") >= 0, signed && signed[1]);

// A free cell takes the camera: occupancy, liveness, the section stamp, sid.
{
  const w = makeSeat('head', { pc: 0, r: 0, i: 0 });
  pin(w, CAM, CELL, 'sess-1');
  const held = w.seat.pubPin.get(CELL);
  check('free cell — camera is seated', w.seat.occ.get(CELL) === CAM);
  check('free cell — liveness is stamped', w.seat.live.get(CELL) === w.tick);
  check('free cell — section stamp is noted', w.seat.s1seen.get(CELL) === w.tick);
  check('free cell — sid sits beside the fill', !!(held && held.id === CAM && held.sid === 'sess-1'), JSON.stringify(held));
  w.seat.recv(pub(CAM, CELL, 'sess-2', true));
  check('same id — pin refreshes and keeps the new sid', w.seat.occ.get(CELL) === CAM && w.seat.pubPin.get(CELL).sid === 'sess-2');
}

// Unsigned, and a cell someone else already holds.
{
  const w = makeSeat('head', { pc: 0, r: 0, i: 0 });
  w.seat.recv(pub(CAM, CELL, 'sess-1', false));
  check('unsigned PUB is ignored', !w.seat.occ.has(CELL) && !w.seat.pubPin.has(CELL));
  w.seat.setOcc(CELL, 'already-here');
  w.seat.recv(pub(CAM, CELL, 'sess-1', true));
  check('occupied cell is ignored', w.seat.occ.get(CELL) === 'already-here' && !w.seat.pubPin.has(CELL));
}

// Healer verbs inside the pin window (past the 24-beat "held now" and the
// 50-tick row sweep, still inside NBR_GAP). Silence must not free the cell,
// and nobody else is admitted or yielded into it.
{
  const w = makeSeat('head', { pc: 0, r: 0, i: 0 });
  pin(w);
  w.tick = 408 + 55;
  check('pin still fresh at 55 ticks', w.seat.pubFresh(CELL) === true);
  w.seat.rowSweep();
  check('row sweep does not free a pinned camera', w.seat.occ.get(CELL) === CAM && w.seat.pubPin.has(CELL));
  w.sent.length = 0;
  w.seat.admit({ pc: 0, r: 0, i: 1 }, { nc: 'newbie' });
  check('admit does not offer a pinned cell', w.places() === 0 && w.seat.occ.get(CELL) === CAM && !w.seat.sitting.has(CELL));
  w.seat.recv({ t: 'SITXFER', ck: HEAD, id: 'assigner', s4ok: true, vouches: [], rowOcc: [{ k: topo.ckey({ pc: 0, r: 0, i: 2 }), v: 'other' }] });
  check('SITXFER silence does not free a pinned camera', w.seat.occ.get(CELL) === CAM);
  w.seat.recv({ t: 'SITXFER', ck: HEAD, id: 'assigner', s4ok: true, vouches: [], rowOcc: [{ k: CELL, v: 'aaa-intruder' }] });
  check('SITXFER does not hand a pinned cell to anyone else', w.seat.occ.get(CELL) === CAM);
  w.seat.sitting.set(CELL, { joiner: CAM, assigner: w.seat.id, at: w.tick - 100, pingAt: w.tick - 20 });
  w.seat.recheckSitting();
  check('SITPING recheck does not free a pinned camera', w.seat.occ.get(CELL) === CAM);
  w.seat.recv({ t: 'DRAIN', id: 'not-the-anchor', roster: [CAM], s4ok: true });
  check('DRAIN from anyone but the anchor does not free a pinned camera', w.seat.occ.get(CELL) === CAM && w.seat.state === 3);
  w.seat.recv({ t: 'S1SYNC', ent: [{ k: CELL, v: 'aaa-intruder', age: 0 }] });
  check('digest does not replace a pinned camera', w.seat.occ.get(CELL) === CAM);
  w.sent.length = 0;
  w.seat.recv({ t: 'HELLO', ck: CELL, id: 'aaa-intruder', lk: 'aaa-intruder', s4ok: true });
  w.seat.recv({ t: 'PHONE', id: 'aaa-intruder', lk: 'aaa-intruder', coord: { pc: 0, r: 0, i: 1 }, tock: HEAD });
  check('HELLO and PHONE do not yield or replace a pinned camera', w.yields() === 0 && w.seat.occ.get(CELL) === CAM, 'yields ' + w.yields() + ' occ ' + w.seat.occ.get(CELL));
  w.seat.recv({ t: 'PHONE', id: CAM, lk: CAM, coord: { pc: 0, r: 0, i: 1 }, tock: HEAD });
  check('the camera PHONE refreshes liveness', w.seat.live.get(CELL) === w.tick && w.seat.occ.get(CELL) === CAM && w.seat.pubPin.get(CELL).sid === 'sess-1');
}

// FINDLEAF packs a seat onto a hole it is not holding right now. The pin stops that.
{
  const w = makeSeat('right', { pc: 0, r: 0, i: 2 });
  pin(w);
  w.tick = 408 + 55;
  w.seat.recv({ t: 'FINDLEAF', hole: { pc: 0, r: 0, i: 1 }, nbrs: [], ttl: 0, s4ok: true, id: 'healer' });
  check('FINDLEAF does not pack onto a pinned camera', w.seat.coord.i === 2 && !w.seat.moving && w.seat.occ.get(CELL) === CAM);
}

// A signed goodbye is the camera speaking. The cell frees now, not at the gap.
{
  const w = makeSeat('head', { pc: 0, r: 0, i: 0 });
  pin(w);
  w.seat.recv({ t: 'LEAVE', ck: CELL, id: CAM, s4ok: true, s4live: true });
  check('LEAVE of the pinned camera frees the cell', !w.seat.occ.has(CELL) && !w.seat.pubPin.has(CELL));
}

// NBR_GAP still frees a pin nobody has heard.
{
  const w = makeSeat('head', { pc: 0, r: 0, i: 0 });
  pin(w);
  w.tick = 408 + 60;
  w.seat.rowSweep();
  check('row sweep at the gap edge still keeps the camera', w.seat.occ.get(CELL) === CAM);
  w.tick = 408 + 61;
  w.seat.tick();
  check('NBR_GAP frees a silent pin', !w.seat.occ.has(CELL) && !w.seat.pubPin.has(CELL) && !w.seat.live.has(CELL));
}

function flipSig(sig) {
  const chars = sig.split('');
  const i = chars.length - 1;
  chars[i] = chars[i] === 'A' ? 'B' : 'A';
  return chars.join('');
}

(async () => {
  const cam = await ident.mint();
  const frame = { t: 'PUB', ck: CELL, id: cam.peerId, sid: 'sess-live' };
  frame.s4 = await ident.signFill(cam, frame);
  const pins = ident.newPins();
  const ok = await ident.verifyFill(pins, frame);
  check('a signed PUB verifies', ok.ok === true && ok.from === cam.peerId);
  const replay = await ident.verifyFill(pins, frame);
  check('a replayed PUB is rejected', replay.ok === false);

  const forged = ident.newPins();
  const badSig = { t: 'PUB', ck: CELL, id: cam.peerId, sid: 'sess-live', s4: { sp: frame.s4.sp, sig: flipSig(frame.s4.sig), pub: frame.s4.pub } };
  const bad = await ident.verifyFill(forged, badSig);
  check('a forged PUB signature is rejected', bad.ok === false);
  const swapped = { t: 'PUB', ck: topo.ckey({ pc: 0, r: 0, i: 2 }), id: cam.peerId, sid: 'sess-live', s4: frame.s4 };
  const swapCk = await ident.verifyFill(ident.newPins(), swapped);
  check('a PUB retargeted onto another cell is rejected', swapCk.ok === false);
  const swappedSid = { t: 'PUB', ck: CELL, id: cam.peerId, sid: 'other-session', s4: frame.s4 };
  const swapSid = await ident.verifyFill(ident.newPins(), swappedSid);
  check('a PUB retargeted onto another session is rejected', swapSid.ok === false);

  const delivered = ident.newPins();
  const fresh = { t: 'PUB', ck: CELL, id: cam.peerId, sid: 'sess-live' };
  fresh.s4 = await ident.signFill(cam, fresh);
  const verdict = await ident.verifyFill(delivered, fresh);
  fresh.s4ok = verdict.ok === true;
  fresh.s4from = verdict.from;
  const w = makeSeat('head', { pc: 0, r: 0, i: 0 });
  w.seat.setOcc(CELL, 'already-here');
  w.seat.recv(fresh);
  check('a verified PUB for an occupied cell is ignored', w.seat.occ.get(CELL) === 'already-here' && !w.seat.pubPin.has(CELL));
  const open = { t: 'PUB', ck: topo.ckey({ pc: 0, r: 0, i: 3 }), id: cam.peerId, sid: 'sess-open' };
  open.s4 = await ident.signFill(cam, open);
  const openV = await ident.verifyFill(delivered, open);
  open.s4ok = openV.ok === true;
  w.seat.recv(open);
  check('a verified PUB seats a free cell', openV.ok === true && w.seat.occ.get(open.ck) === cam.peerId && w.seat.pubPin.get(open.ck).sid === 'sess-open');

  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.log('FAIL identity — ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
