#!/usr/bin/env node
// l1-state.js <proof dir>...
// Seat state round trip against the sim. A proof dir is a run with MESH_PROOF=<dir> MESH_PROOF_STATE=1:
// state.jsonl holds, per tick, the state JSON of every seat whose hash changed; hash.jsonl the hashes.
// For every state line: build a seat (js/mesh/seat.js, every member at its C++ default), restore the line's
// state into it, then
//   1. dumpState(seat) is byte for byte the sim's text,
//   2. its FNV-1a 32 is the hash the sim wrote for that seat and tick,
//   3. the full dump (all members) restores into a second seat and dumps to the same bytes.
// Prints counts per dir; exit 1 on any difference.
'use strict';
const fs = require('fs'), path = require('path');
const M = path.join(__dirname, '..', '..', 'js', 'mesh');
const { Seat } = require(path.join(M, 'seat.js'));
const state = require(path.join(M, 'state.js'));
const fnv = require(path.join(M, 'fnv.js'));
const { lines } = require('./proof-io.js');

let bad = 0;
for (const dir of process.argv.slice(2)) {
  const hashes = new Map();
  for (const l of lines(path.join(dir, 'hash.jsonl'))) { const o = JSON.parse(l); for (const [id, h] of o.h) if (h !== null) hashes.set(o.t + ':' + id, h); }
  let n = 0, nState = 0, nHash = 0, nFull = 0, shown = 0, seats = new Set(), bytes = 0;
  const fail = (what, a, b) => { bad++; if (shown++ < 5) console.log('DIFF ' + what + '\n  sim ' + String(a).slice(0, 400) + '\n  js  ' + String(b).slice(0, 400)); };
  for (const raw of lines(path.join(dir, 'state.jsonl'))) {
    n++;
    const o = JSON.parse(raw);
    const simText = raw.slice(raw.indexOf(',"s":') + 5, -1);
    seats.add(o.id); bytes += simText.length;
    const s = new Seat(o.id);
    state.restore(s, o.s);
    const mine = state.dumpState(s);
    if (mine === simText) nState++; else fail('state t=' + o.t + ' id=' + o.id, simText, mine);
    const h = hashes.get(o.t + ':' + o.id);
    if (h !== undefined && fnv.str(mine) === h) nHash++; else fail('hash t=' + o.t + ' id=' + o.id, h, fnv.str(mine));
    const full = state.dump(s);
    const s2 = new Seat(o.id); state.restore(s2, full);
    if (state.dump(s2) === full) nFull++; else fail('full round trip t=' + o.t + ' id=' + o.id, full, state.dump(s2));
  }
  console.log(path.basename(dir) + ': ' + n + ' state lines (' + seats.size + ' seats, ' + bytes + ' bytes): state ' + nState + '/' + n + ', hash ' + nHash + '/' + n + ', full ' + nFull + '/' + n);
}
console.log(bad ? 'L1 state FAIL (' + bad + ')' : 'L1 state PASS');
process.exit(bad ? 1 : 0);
