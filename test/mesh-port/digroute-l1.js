#!/usr/bin/env node
// digroute-l1.js <proof dir>...   (a run with MESH_PROOF=<dir> MESH_PROOF_STATE=1)
// L1 for digest.js / route.js: for each state line, restore a seat (seat.js) and
// Call every method of the unit that needs no other unit on the restored state; any throw is a failure.
// (The state line holds only the members the state hash covers, not the digests, so a refold cannot be compared
// to the sim here; that waits for the tape replay, X1.)
// Prints counts per dir; exit 1 on a throw.
'use strict';
const fs = require('fs'), path = require('path');
const M = path.join(__dirname, '..', '..', 'js', 'mesh');
const { Seat, newWorld, stubFabric, FREE } = require(path.join(M, 'seat.js'));
require(path.join(M, 'digest.js')); require(path.join(M, 'route.js'));
const state = require(path.join(M, 'state.js'));
const dig = require(path.join(M, 'dig.js'));
const { lines } = require('./proof-io.js');
const J = JSON.stringify;

// the other units' methods this unit calls: not ported yet, answered with the inert value
if (!FREE.islandStandM) Seat.free({ islandStandM: () => false });   // island unit (S9), not ported yet
const OTHER = { l2Around: () => -1, l4Busy: () => false, l4Bad: () => false, l373Blind: () => false, probeNote: () => 0, answerDoor: () => false,
  l917Free: () => true, admit: () => {}, goodbyeHeal: () => {}, phoneHome: () => {}, s1Heartbeat: () => {}, s1Sync: () => {}, takeUp: () => {}, pongDig: () => {}, s1SyncDigs: () => {} };
for (const [k, f] of Object.entries(OTHER)) if (!(k in Seat.prototype)) Seat.unit('digroute-l1 stub ' + k, { [k]: f });

let bad = 0;
for (const dir of process.argv.slice(2)) {
  let n = 0, smoke = 0, calls = 0;
  const fab = stubFabric();
  for (const f of Object.keys(fab)) fab[f] = () => ({ fabricLinkState: 1, fabricDoors: false }[f] ?? 0);
  fab.fabricLinkState = () => 1; fab.fabricDoors = () => false;
  for (const raw of lines(path.join(dir, 'state.jsonl'))) {
    n++;
    const o = JSON.parse(raw);
    const w = newWorld({ fabric: fab }); w.TICK = o.t;
    const s = new Seat(o.id, w); state.restore(s, o.s);
    try {
      s.l12SectionLone(); s.l9Small(); s.compactEligible(); s.l10OwnNow(); s.l10UpNow();
      if (s.hasCoord) {
        s.pubDig(s.myDig); s.upRefuted(s.myDig, s.downUsed, 0); s.strictNextHop({ pc: 0, r: (s.coord.r + 1) % 5, i: 2 }); s.nextHopToward({ pc: 0, r: 3, i: 3 }, -1);
        s.kAuditTimeouts(); s.kHealDue(); s.kAuditPulse(); s.kickEval(); s.rootFold(true); s.rootFold(false);
        for (const k of s.occ.keys()) { s.scopeGap(k); s.digHeld(k, s.myDig); }
        calls++;
      }
      smoke++;
    } catch (e) { bad++; if (bad < 5) console.log('THROW t=' + o.t + ' id=' + o.id + ' ' + e.stack.split('\n').slice(0, 3).join(' | ')); }
  }
  console.log(path.basename(dir) + ': ' + n + ' state lines; smoke ' + smoke + '/' + n + ' (' + calls + ' seated)');
}
console.log(bad ? 'digroute L1 FAIL (' + bad + ')' : 'digroute L1 PASS');
process.exit(bad ? 1 : 0);
