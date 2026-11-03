'use strict';
// gaps3-fab.js: L39 fabric side (C++: mesh_gaps3_fab.inc): L39.2's contest slot and the `hostile densify` lever,
// plugged into a fabric whose link physics (link.js) is installed. Harness code: never shipped.
// L39_OFF (a build-time switch in the sim, 0 in the release) is not ported.
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));
const { ckey, pcDepth, C } = topo;
function install(fab) {
  const { lv, alive, seats } = fab; const T = () => fab.w.TICK;
  // C++: mesh_gaps3_fab.inc:l392Contest
  function l392Contest(me, from, mt, ck) {
    if (mt !== 'CHALLENGE' || !ck || me < 0 || me >= lv.nextId || !seats[me].hasCoord || seats[me].state !== 3 || ckey(seats[me].coord) !== ck) return false;
    return fab.link.l23GreetSlot(me, from, ck);
  }
  const used = new Set();   // C++: the function-static OSet<int> used (one placement per leaf, for the process)
  // C++: mesh_gaps3_fab.inc:hostDensify
  function hostDensify() {
    let sent = 0;
    for (let p = 0; p < lv.nextId; p++) {
      if (!alive[p] || !seats[p].hostile || !seats[p].hasCoord || seats[p].state !== 3) continue;
      if (seats[p].hostDenseLeaf >= 0) continue;   // one placement per page
      const hc = seats[p].coord; if (hc.pc === 0 || hc.i !== 0) continue;   // a deep row head
      let vj = -1, v = -1;
      for (let j = 1; j < C && v < 0; j++) { const c = { pc: hc.pc, r: hc.r, i: j }; for (let q = 0; q < lv.nextId; q++) if (alive[q] && !seats[q].hostile && seats[q].hasCoord && seats[q].state === 3 && ckey(seats[q].coord) === ckey(c)) { v = q; vj = j; break; } }
      if (v < 0) continue;
      const dst = { pc: hc.pc, r: hc.r, i: vj };
      let leaf = -1;
      for (let q = 0; q < lv.nextId && leaf < 0; q++) {
        const s = seats[q]; if (!alive[q] || s.hostile || !s.hasCoord || s.state !== 3 || s.moving || s.hasChildren() || s.coord.i === 0) continue;   // a row mate, not a head
        if (pcDepth(s.coord.pc) <= pcDepth(dst.pc) || s.firstHandLive(ckey(dst))) continue;
        let trailing = true; for (let j = s.coord.i + 1; j < C; j++) if (s.occGet(ckey({ pc: s.coord.pc, r: s.coord.r, i: j })) >= 0) { trailing = false; break; } if (!trailing) continue;
        leaf = q;
      }
      if (leaf < 0) continue;
      if (used.has(leaf)) continue; used.add(leaf);   // one placement per leaf
      const m = msg.newMsg('PLACE'); m.coord = dst; m.owner = p; m.nc = leaf; m.tag = 1; m.pp = p; m.ppAt = T() | 0; m.ppL = T() | 0;
      for (let j = 0; j < C; j++) { if (j === vj) continue; const c = { pc: hc.pc, r: hc.r, i: j }; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].hasCoord && seats[q].state === 3 && ckey(seats[q].coord) === ckey(c)) { m.nbrs.push({ k: ckey(c), v: q }); break; } }
      fab.w.hostSend(p, leaf, m); sent++; seats[p].hostDenseLeaf = leaf;   // from now on the page never yields its placed seat, and as a witness it hears that seat at the cell
      fab.printf('OK hostile densify page=%d cell=%s holder=%d leaf=%d from=%s\n', p, fab.coordStr(dst), v, leaf, fab.coordStr(seats[leaf].coord));
    }
    if (!sent) fab.printf('OK hostile densify none\n');
  }
  fab.plug({ l392Contest, hostDensify });
}
module.exports = { install };
