'use strict';
// l25e-fab.js: L40.4's scenario lever (C++: mesh_l25e_fab.inc), the gate repro-l25e.sh. Harness code: never shipped.
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const topo = require(path.join(M, 'topo.js'));
const msg = require(path.join(M, 'msg.js'));
const { ckey } = topo;
function install(fab) {
  const { lv, alive, seats } = fab; const T = () => fab.w.TICK; const X = fab.X;
  // C++: mesh_l25e_fab.inc:l25eFab
  function l25eFab(tk) {
    const P = fab.printf;
    const cell = (s) => ((s >= 0 && alive[s] && seats[s].hasCoord && seats[s].state === 3) ? fab.coordStr(seats[s].coord) : '-');
    const obs = X.g4Observer();
    if (tk.length >= 2 && tk[1] === 'show') { const a = cell(obs.A), b = cell(obs.B); P('L25E tick=%d a=%d:%s b=%d:%s same=%d\n', T(), obs.A, a, obs.B, b, (a !== '-' && a === b) ? 1 : 0); return; }
    if (tk.length >= 4 && tk[1] === 'claim') {
      const h = X.g4Parse(tk[2]), c = X.g4Parse(tk[3]); if (!h || !c) { P('ERR l25e claim: bad cell\n'); return; }
      const riv = X.g4At(h), s = X.g4At(c); if (riv < 0 || s < 0 || riv === s) { P('ERR l25e claim: rival=%d claimant=%d\n', riv, s); return; }
      for (let q = 0; q < lv.nextId; q++) if (q !== s && alive[q]) X.linkSever(s, q, 25);
      const S = seats[s]; S.occ.clear(); S.live.clear(); S.take(h, -1, []);
      obs.set(ckey(h) + 1, s, riv, T() | 0, -1);
      P('OK l25e claim %s claimant=%d rival=%d pp=%d rivalpp=%d\n', fab.coordStr(h), s, riv, S.pp, seats[riv].pp); return;
    }
    if (tk.length >= 5 && tk[1] === 'lie') {
      const b = X.g4Parse(tk[2]), t = X.g4Parse(tk[3]), r = X.g4Parse(tk[4]); if (!b || !t || !r) { P('ERR l25e lie: bad cell\n'); return; }
      const by = X.g4At(b), tg = (obs.A >= 0 && obs.HOLE === ckey(t) + 1) ? obs.A : X.g4At(t), rv = X.g4At(r); if (by < 0 || tg < 0 || rv < 0) { P('ERR l25e lie: by=%d target=%d rival=%d\n', by, tg, rv); return; }
      const O = seats[tg]; for (const [k, v] of [...O.occ]) if (v !== by && v !== tg) O.occ.delete(k);
      obs.set(ckey(t) + 1, tg, rv, obs.AT < 0 ? (T() | 0) : obs.AT, obs.JOIN);
      const y = msg.newMsg('YIELD'); y.ck = ckey(t); y.id = by; y.nc = rv; seats[by].emit(tg, y); return;
    }
    if (tk.length >= 4 && tk[1] === 'forge') {
      let r = X.g4Parse(tk[2]), t = X.g4Parse(tk[3]); if (!r || !t) { P('ERR l25e forge: bad cell\n'); return; }
      let rv = X.g4At(r), tg = X.g4At(t); if (rv < 0 || tg < 0 || rv === tg) { P('ERR l25e forge: rival=%d target=%d\n', rv, tg); return; }
      if (rv < tg) { [rv, tg] = [tg, rv]; [r, t] = [t, r]; }   // the rival is the higher id (C++ comment)
      const O = seats[tg]; for (const [k, v] of [...O.occ]) if (v !== tg) O.occ.delete(k);
      const R = seats[rv]; O.pp = -1; O.ppCk = 0; R.take(t, -1, []); R.pp = lv.nextId + 7; R.ppAt = 1; R.ppL = 1; R.ppCk = ckey(t); R.l40Tell(tg, true);
      obs.set(ckey(t) + 1, tg, rv, T() | 0, -1);
      P('OK l25e forge %s target=%d rival=%d rivalpp=%d\n', fab.coordStr(t), tg, rv, R.pp); return;
    }
    P('ERR usage: l25e claim <cell> <claimant> | lie <by> <target> <rival> | forge <rival> <target> | show\n');
  }
  fab.plug({ l25eFab });
}
module.exports = { install };
