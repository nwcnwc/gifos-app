// pub-camera-sim.js — one seat, stepped a tick at a time.
//
// Gate: node test/unit/pub-camera-sim.js
//
// The C++ mesh twin (test/sim/mesh.cpp) is not in this tree. This steps the
// same seat the page runs: a pinned camera stays through the healer verbs
// while its PHONE stamp is inside NBR_GAP, and the next tick past that gap
// frees it.
'use strict';
const path = require('path');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}

require(path.join(__dirname, '..', '..', 'js', 'gifos-net.js'));
require(path.join(__dirname, '..', '..', 'js', 'mesh.js'));

const topo = globalThis.GifOS.net.topo;
const CAM = 'cam-publisher';
const CELL = topo.ckey({ pc: 0, r: 0, i: 1 });
const HEAD = topo.ckey({ pc: 0, r: 0, i: 0 });
const NBR_GAP = 60;
const PIN_AT = 408; // divisible by 12, so the age-60 beat is a row sweep

function world(id, coord) {
  const sent = [];
  let tick = PIN_AT;
  const env = {
    get TICK() { return tick; },
    HEALING: true,
    COMPACTION: false,
    send(from, to, m) { sent.push({ to, t: m && m.t, ck: m && m.ck }); },
    knock() {},
    wake() {},
  };
  const seat = new globalThis.GifOS.mesh.Seat(id, env);
  seat.myKey = 'mine';
  seat.genKey = 'room-genesis';
  seat.take(coord, null, []);
  sent.length = 0;
  return {
    seat, sent,
    get tick() { return tick; },
    set tick(n) { tick = n; },
    step(n) {
      for (let i = 0; i < n; i++) { tick += 1; seat.tick(); }
    },
    yields() { return sent.filter((s) => s.t === 'YIELD' && s.ck === CELL).length; },
  };
}

function publish(w) {
  w.seat.recv({ t: 'PUB', ck: CELL, id: CAM, sid: 'sess-sim', s4ok: true });
}

// Head: silence, the healer frames, then the gap.
{
  const w = world('head', { pc: 0, r: 0, i: 0 });
  publish(w);
  check('sim seats the camera', w.seat.occ.get(CELL) === CAM && w.seat.pubPin.get(CELL).sid === 'sess-sim');
  let lost = null;
  for (let n = 0; n < 55; n++) {
    w.step(1);
    if (w.seat.occ.get(CELL) !== CAM) { lost = w.tick - PIN_AT; break; }
  }
  check('sim keeps the camera through 55 silent ticks', lost === null && w.seat.pubFresh(CELL) === true, 'lost at age ' + lost);
  w.sent.length = 0;
  w.seat.recv({ t: 'FINDLEAF', hole: { pc: 0, r: 0, i: 1 }, nbrs: [], ttl: 0, s4ok: true, id: 'healer' });
  w.seat.recv({ t: 'SITPING', ck: CELL, id: CAM, from: 'assigner' });
  w.seat.sitting.set(CELL, { joiner: CAM, assigner: w.seat.id, at: w.tick - 100, pingAt: w.tick - 20 });
  w.seat.recheckSitting();
  w.seat.recv({ t: 'SITXFER', ck: HEAD, id: 'assigner', s4ok: true, vouches: [], rowOcc: [] });
  w.seat.recv({ t: 'DRAIN', id: 'stranger', roster: [CAM], s4ok: true });
  w.seat.recv({ t: 'S1SYNC', ent: [{ k: CELL, v: 'aaa-intruder', age: 0 }] });
  w.seat.recv({ t: 'HELLO', ck: CELL, id: 'aaa-intruder', lk: 'aaa-intruder', s4ok: true });
  w.seat.recv({ t: 'PHONE', id: 'aaa-intruder', lk: 'aaa-intruder', coord: { pc: 0, r: 0, i: 1 }, tock: HEAD });
  w.seat.admit({ pc: 0, r: 0, i: 1 }, { nc: 'newbie' });
  check('sim healer verbs leave the pinned camera', w.seat.occ.get(CELL) === CAM && w.seat.pubPin.has(CELL) && w.yields() === 0 && !w.seat.moving, 'occ ' + w.seat.occ.get(CELL) + ' yields ' + w.yields());
  // Age 60 is still inside the gap, and it is a row-sweep beat.
  while (w.tick < PIN_AT + NBR_GAP) w.step(1);
  check('sim row sweep at the gap edge keeps the camera', w.tick === PIN_AT + NBR_GAP && w.seat.occ.get(CELL) === CAM && (w.tick % 12) === 0);
  w.step(1);
  check('sim NBR_GAP frees the silent camera', w.tick === PIN_AT + NBR_GAP + 1 && w.seat.occ.get(CELL) !== CAM && !w.seat.pubPin.has(CELL), 'tick ' + w.tick + ' occ ' + w.seat.occ.get(CELL));
}

// A camera that keeps phoning is re-stamped. The gap is counted from that beat.
{
  const w = world('head', { pc: 0, r: 0, i: 0 });
  publish(w);
  w.step(50);
  w.seat.recv({ t: 'PHONE', id: CAM, lk: CAM, coord: { pc: 0, r: 0, i: 1 }, tock: HEAD });
  const heard = w.tick;
  check('sim camera PHONE re-stamps liveness', w.seat.live.get(CELL) === heard && w.seat.occ.get(CELL) === CAM);
  let lost = null;
  for (let n = 0; n < NBR_GAP; n++) {
    w.step(1);
    if (w.seat.occ.get(CELL) !== CAM) { lost = w.tick - heard; break; }
  }
  check('sim a phoning camera survives the healer window', lost === null && w.seat.occ.get(CELL) === CAM, 'lost at age ' + lost);
  w.step(1);
  check('sim NBR_GAP after the last PHONE frees the camera', w.tick === heard + NBR_GAP + 1 && w.seat.occ.get(CELL) !== CAM && !w.seat.pubPin.has(CELL), 'age ' + (w.tick - heard) + ' occ ' + w.seat.occ.get(CELL));
}

// The seat to the camera's right is the one FINDLEAF would pack onto the cell.
{
  const w = world('right', { pc: 0, r: 0, i: 2 });
  publish(w);
  let moved = null;
  for (let n = 0; n < 55; n++) {
    w.step(1);
    if (w.seat.moving || !w.seat.hasCoord || w.seat.coord.i !== 2 || w.seat.occ.get(CELL) !== CAM) { moved = w.tick - PIN_AT; break; }
  }
  check('sim the right-hand seat does not pack onto the camera', moved === null, 'moved at age ' + moved + ' coord ' + (w.seat.hasCoord ? w.seat.coord.i : 'none'));
  w.seat.recv({ t: 'FINDLEAF', hole: { pc: 0, r: 0, i: 1 }, nbrs: [], ttl: 0, s4ok: true, id: 'healer' });
  check('sim FINDLEAF leaves the right-hand seat where it is', w.seat.coord.i === 2 && !w.seat.moving && w.seat.occ.get(CELL) === CAM);
  while (w.tick <= PIN_AT + NBR_GAP) w.step(1);
  check('sim NBR_GAP frees the camera from the right-hand seat', w.seat.occ.get(CELL) !== CAM && !w.seat.pubPin.has(CELL));
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
