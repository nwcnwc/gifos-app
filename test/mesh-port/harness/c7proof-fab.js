'use strict';
// c7proof-fab.js: L42's lever and report (C++: mesh_c7proof_fab.inc): `hostile c7forge`, `hostile c7report`.
// Harness code: never shipped.
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const msg = require(path.join(M, 'msg.js'));
const { ckey } = require(path.join(M, 'topo.js'));
function install(fab) {
  const { lv } = fab; let C7FORGE_ID = -1;
  // C++: mesh_c7proof_fab.inc:hostC7Forge
  function hostC7Forge(mode) {
    const sgn = mode === 'signed', seats = fab.seats, alive = fab.alive;
    let f = C7FORGE_ID;
    if (f < 0 || f >= lv.nextId || !alive[f] || !seats[f].hasCoord || seats[f].state !== 3) { f = -1; for (let q = 0; q < lv.nextId && f < 0; q++) { if (!alive[q] || !seats[q].hasCoord || seats[q].state !== 3 || seats[q].coord.pc !== 0) continue; if (!seats[q].islandSeen() || seats[q].ringName() === q) continue; f = q; } }
    if (f < 0) { fab.printf('C7FORGE none\n'); return; }
    C7FORGE_ID = f;
    const s = seats[f]; let n = 0;
    for (let q = 0; q < lv.nextId; q++) {
      if (q === f || !alive[q] || !seats[q].hasCoord || seats[q].state !== 3) continue;
      let named = false; for (const [, v] of seats[q].occ) if (v === f) { named = true; break; }
      if (!named) continue;
      const m = msg.newMsg('LEAVE'); m.ck = ckey(s.coord); m.id = f; m.c7 = true; m.c7Min = seats[q].ringName(); m.direct = true;
      if (sgn) { m.sig = true; m.sigAt = fab.w.TICK | 0; } else { m.sig = false; }
      fab.X.linkSchedule(f, q, m); n++; }
    fab.printf('C7FORGE forger=%d mode=%s targets=%d t=%lld\n', f, mode, n, fab.w.TICK);
  }
  // C++: mesh_c7proof_fab.inc:hostC7Report
  function hostC7Report(t0) {
    let moved = 0, uns = 0, n = 0, term = 0; for (let q = 0; q < lv.nextId; q++) { if (!fab.alive[q]) continue; n++; const s = fab.seats[q]; if (s.c7At >= t0 && q !== C7FORGE_ID) moved++; if (!s.hasCoord || s.state !== 3) uns++; if (s.islandSeen()) term++; }
    fab.printf('C7STAT t0=%lld moved=%d unseated=%d alive=%d forger=%d roomTerm=%d\n', t0, moved, uns, n, C7FORGE_ID, term);
  }
  fab.plug({ hostC7Forge, hostC7Report });
}
module.exports = { install };
