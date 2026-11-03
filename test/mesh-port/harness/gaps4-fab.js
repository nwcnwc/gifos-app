'use strict';
// gaps4-fab.js: L40 fabric side (C++: mesh_gaps4_fab.inc): the `contest` scenario lever (L40's gate, repro-gaps4.sh) and
// its observer g4Joined (a seat calls it from l25Ask). Harness code: never shipped.
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const topo = require(path.join(M, 'topo.js'));
const C_ = require(path.join(M, 'consts.js'));
const { ownerCoordOf } = require(path.join(M, 'shared.js'));
const { ckey, unckey: unck, pcDepth, childPath, down, ownedLinks, C } = topo;
const K = C_.consts;
function install(fab) {
  const { lv, alive, seats } = fab; const T = () => fab.w.TICK;
  // the forced contest, and the first tick a contestant asked about the other (an observer: no law reads it)
  let G4_HOLE = 0, G4_A = -1, G4_B = -1, G4_AT = -1, G4_JOIN = -1;
  // C++: mesh_gaps4_fab.inc:g4Joined
  function g4Joined(me, nc, ck) { if (G4_HOLE === 0 || ck + 1 !== G4_HOLE) return; if (!((me === G4_A && nc === G4_B) || (me === G4_B && nc === G4_A))) return; if (G4_JOIN === -1) G4_JOIN = T(); }
  // C++: mesh_gaps4_fab.inc:g4Parse
  function g4Parse(a) {
    const sl = a.indexOf('/'); const dt = sl < 0 ? -1 : a.indexOf('.', sl); if (sl < 0 || dt < 0) return null;
    let pc = 0; for (const ch of a.slice(0, sl)) pc = childPath(pc, ch.charCodeAt(0) - 48);
    return { pc, r: (parseInt(a.slice(sl + 1, dt), 10) || 0) & 255, i: (parseInt(a.slice(dt + 1), 10) || 0) & 255 };
  }
  // C++: mesh_gaps4_fab.inc:g4At
  function g4At(c) { const k = ckey(c); for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].hasCoord && seats[q].state === 3 && ckey(seats[q].coord) === k) return q; return -1; }
  // C++: mesh_gaps4_fab.inc:g4Auto   [returns {h, a, b, o} or null]
  function g4Auto(k, dmin) {
    const heads = []; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].hasCoord && seats[q].state === 3) { const c = seats[q].coord; if (c.pc !== 0 && c.i === 0 && pcDepth(c.pc) >= dmin) heads.push(ckey(c)); }
    heads.sort((x, y) => x - y);
    for (const hk of heads) {
      const c = unck(hk); const dn = down(c); const o = ownerCoordOf(c); if (g4At(dn) < 0 || !o || g4At(o) < 0) continue;
      let ai = -1, bi = -1;
      for (let j = C - 1; j >= 1 && ai < 0; j--) { const m = { pc: c.pc, r: c.r, i: j }; if (g4At(m) >= 0 && g4At(down(m)) < 0) ai = j; }
      for (let j = C - 1; j >= 1 && bi < 0; j--) { const m = { pc: dn.pc, r: dn.r, i: j }; if (g4At(m) >= 0) bi = j; }
      if (ai < 0 || bi < 0) continue;
      if (k-- > 0) continue;
      return { h: c, a: { pc: c.pc, r: c.r, i: ai }, b: { pc: dn.pc, r: dn.r, i: bi }, o };
    }
    return null;
  }
  // C++: mesh_gaps4_fab.inc:g4Contest
  function g4Contest(tk) {
    const P = fab.printf; let h, a, b; const cr = [];
    if (tk.length >= 2 && tk[1] === 'show') { let n = 0; if (G4_HOLE) for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].hasCoord && seats[q].state === 3 && ckey(seats[q].coord) + 1 === G4_HOLE) n++; P('CONTEST tick=%lld at=%d holders=%d joined=%lld\n', T(), G4_AT, n, G4_JOIN); return; }
    if (tk.length >= 3 && tk[1] === 'auto') { const r = g4Auto(parseInt(tk[2], 10) || 0, tk.length > 3 ? (parseInt(tk[3], 10) || 0) : 1); if (!r) { P('ERR contest: no cell for auto %s\n', tk[2]); return; } h = r.h; a = r.a; b = r.b; cr.push(r.o); }
    else {
      if (tk.length < 4 || !(h = g4Parse(tk[1])) || !(a = g4Parse(tk[2])) || !(b = g4Parse(tk[3]))) { P('ERR usage: contest <hole> <a> <b> [<crash>...] | contest auto <k>\n'); return; }
      for (let q = 4; q < tk.length; q++) { const k = g4Parse(tk[q]); if (k) cr.push(k); else { P('ERR contest: bad cell %s\n', tk[q]); return; } }
    }
    const x = g4At(h), sa = g4At(a), sb = g4At(b);
    if (x < 0 || sa < 0 || sb < 0 || sa === sb || x === sa || x === sb) { P('ERR contest: hole=%d a=%d b=%d\n', x, sa, sb); return; }
    seats[x].leave(); lv.N--;
    let got = 0;
    for (const s of [sa, sb]) {
      const S = seats[s]; const nb = []; const ol = ownedLinks(h);
      for (let q = 0; q < ol.length; q++) { const y = g4At(ol[q]); if (y >= 0 && y !== s && y !== x) nb.push({ k: ckey(ol[q]), v: y }); }
      S.mvWhy = 'contest'; S.flCur = -1; S.doMove(h, -1, nb);   // (no heal order behind it: no move proof, L25.7)
    }
    for (const s of [sa, sb]) { const S = seats[s]; if (S.moving && ckey(S.coord) === ckey(h)) { S.confirmMove(); got++; } }
    for (const k of cr) { const y = g4At(k); if (y < 0 || y === sa || y === sb) { P('ERR contest: nobody to crash at %s\n', fab.coordStr(k)); continue; } fab.fabricKill(y, T() + K.SOCK_CLOSE_CRASH); fab.X.crashTransport(y); lv.N--; }
    G4_HOLE = ckey(h) + 1; G4_A = sa; G4_B = sb; G4_AT = T() | 0; G4_JOIN = -1;
    P('OK contest %s left=%d a=%s:%d b=%s:%d moved=%d\n', fab.coordStr(h), x, fab.coordStr(a), sa, fab.coordStr(b), sb, got);
  }
  fab.plug({ g4Joined, g4Contest });
}
module.exports = { install };
