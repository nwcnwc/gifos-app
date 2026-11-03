#!/usr/bin/env node
// digroute-unit.test.js: scenario checks of digest.js / route.js on a hand-built room (no sim needed).
//   route:  a full Section-1 rook; a frame routed from one cell to another arrives, hop by hop, over owned links
//   fold:   rootFold of a full table of fresh section digests counts every seat; a stale section makes it partial
//   vote:   a complete fold carrying a majority bans the target (kickEval); a sub-majority does not
'use strict';
const path = require('path'), assert = require('assert');
const M = path.join(__dirname, '..', '..', 'js', 'mesh');
const { Seat, newWorld, stubFabric, FREE } = require(path.join(M, 'seat.js'));
require(path.join(M, 'digest.js')); require(path.join(M, 'route.js'));
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));
const { ckey } = topo;

if (!FREE.islandStandM) Seat.free({ islandStandM: () => false });   // island unit (S9), not ported yet
const OTHER = { l2Around: () => -1, l4Busy: () => false, answerDoor: () => false, goodbyeHeal: () => {}, probeNote: () => 0 };
for (const [k, f] of Object.entries(OTHER)) if (!(k in Seat.prototype)) Seat.unit('unit-test stub ' + k, { [k]: f });

// emit is seat.js's and leans on units not ported yet (island, farview ...): here a frame goes straight to the fabric
Seat.prototype.emit = function (to, m) { this.f.fabricSend(this.id, to, m); };

// 25 seats, id = r*5+i at cell (0,r,i), each knowing the whole rook
function room() {
  const sent = [];
  const f = stubFabric(); f.fabricSend = (from, to, m) => { sent.push([from, to, m]); }; f.fabricLinkState = () => 1; f.fabricDoors = () => false;
  f.l18Deliv = () => {}; f.wake = () => {}; f.fabricKickClose = () => {}; f.fabricVerdict = () => {};
  const w = newWorld({ fabric: f }); w.TICK = 100;
  const seats = [];
  for (let r = 0; r < 5; r++) for (let i = 0; i < 5; i++) {
    const s = new Seat(r * 5 + i, w); s.hasCoord = true; s.state = 3; s.coord = { pc: 0, r, i };
    for (let rr = 0; rr < 5; rr++) for (let ii = 0; ii < 5; ii++) { s.occ.set(ckey({ pc: 0, r: rr, i: ii }), rr * 5 + ii); s.live.set(ckey({ pc: 0, r: rr, i: ii }), 100); }
    seats.push(s);
  }
  return { w, seats, sent };
}

{   // route: (0,0,0) -> (0,3,4)
  const { seats, sent } = room();
  const inner = msg.newMsg('PLACE'); inner.nc = 99;
  seats[0].route({ pc: 0, r: 3, i: 4 }, 24, inner);
  assert.strictEqual(inner.routing, false, 'route copies its by-value frame');
  let hops = 0, cur = null;
  while (sent.length) {
    const [from, to, m] = sent.shift(); hops++;
    assert.ok(hops < 10, 'no loop');
    if (!m.routing) { cur = to; assert.strictEqual(m.direct, true); break; }
    const forMe = seats[to].routeStep(m);
    if (forMe) { cur = to; break; }
  }
  assert.strictEqual(cur, 24, 'delivered to the seat at (0,3,4)');
  assert.ok(hops <= 3, 'a rook needs at most 2 hops plus the hand-off: ' + hops);
}
{   // fold: every section reports n=2; the room is 50
  const { w, seats } = room();
  const me = seats[7]; me.myDig = msg.newDig(); me.myDig.n = 2; me.myDig.at = 100; me.myDig.rx = 100; me.myDig.by = me.id;
  for (let r = 0; r < 5; r++) for (let i = 0; i < 5; i++) {
    const k = ckey({ pc: 0, r, i }); if (k === ckey(me.coord)) continue;
    const d = msg.newDig(); d.n = 2; d.at = 100; d.rx = 100; d.by = r * 5 + i; me.s1tab.set(k, d);
  }
  me.rootFold();
  assert.strictEqual(me.rootDig.n, 50); assert.strictEqual(me.rootDig.part, 0);
  assert.strictEqual(me.rootDec.n, 50, 'the pulse fold feeds rootDec');
  me.rootFold(true); assert.strictEqual(me.rootDig.n, 50);
  // a section whose report is gone for good (stale past DIG_TTL, not held): the fold is short and says so only if it was heard of
  w.TICK = 100 + 61;
  me.myDig.at = me.myDig.rx = me.LT();
  me.rootFold(); assert.strictEqual(me.rootDig.n, 2, 'stale sections fall out of the fold');
}
{   // vote: 5 of 6 seats vote off seat 3; the fold carries it; kickEval bans it
  const { w, seats } = room();
  const me = seats[0]; w.TICK = 100;
  const R = msg.newDig(); R.n = 6; R.at = 100; R.rx = me.LT(); R.kick.push({ tgt: 3, up: 5, dn: 0 });
  me.rootDec = R; me.kUpLink = () => false;
  me.kickEval(); assert.ok(me.vban.has(3), 'majority bans');
  const me2 = seats[1]; const R2 = msg.newDig(); R2.n = 6; R2.at = 100; R2.rx = me2.LT(); R2.kick.push({ tgt: 3, up: 2, dn: 0 });
  me2.rootDec = R2; me2.kickEval(); assert.ok(!me2.vban.has(3), 'sub-majority does not');
}
console.log('digroute unit PASS');
