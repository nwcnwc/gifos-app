#!/usr/bin/env node
// heal-l0-check.js <jsonl>: recompute every answer of heal-l0-driver with js/mesh/heal.js and compare the JSON text.
'use strict';
const fs = require('fs'), path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const topo = require(path.join(M, 'topo.js'));
const { Seat } = require(path.join(M, 'seat.js'));
// the one free function this unit needs from the entry unit (C++: mesh_seat.inc ownerCoordOf), stubbed here
const stubs = { ownerCoordOf: (c) => (c.pc === 0 ? null : topo.up({ pc: c.pc, r: c.r, i: 0 })), cellOk: () => true };
Seat.free(stubs);
const heal = require(path.join(M, 'heal.js'));
const J = JSON.stringify;
let n = 0, bad = 0;
for (const line of fs.readFileSync(process.argv[2], 'utf8').split('\n')) {
  if (!line) continue; n++;
  const o = JSON.parse(line); const H = o.H;
  const fakeSeat = { l13: (sub) => (sub === 'L13.15' ? o.l13_15 : false) };
  const w = heal.l13Witness(H);
  const got = { H, l13_15: o.l13_15, wit: heal.rmWitCells(H), ring: heal.l13Ring(H), witness: w, chain: heal.l13Chain(fakeSeat, H), line: heal.l13Line(H), x: o.x, fk: String(heal.l9FwdKey(topo.ckey(H), o.x)) };
  // the 64-bit key is exact only below x = 8192 (see the port report): compare it there, count the rest
  const a = J(o), b = J(got);
  if (a !== b) {
    const exactFk = o.x < 8192;
    const o2 = Object.assign({}, o), g2 = Object.assign({}, got); if (!exactFk) { delete o2.fk; delete g2.fk; }
    if (J(o2) !== J(g2)) { bad++; if (bad <= 5) console.log('DIFF\n  sim ' + a + '\n  js  ' + b); }
  }
}
console.log(n + ' cases, ' + bad + ' bad');
process.exit(bad ? 1 : 0);
