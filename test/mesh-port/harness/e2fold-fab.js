'use strict';
// e2fold-fab.js: L48's levers and probe (C++: mesh_e2fold_fab.inc): `e2cut pick [first]|sever <T>|half|open|crash|hand|stage|probe|forge`.
// A measurement and its cuts; the picked seats live in the levers E2C_* (the sim's file statics). Harness code: never shipped.
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const topo = require(path.join(M, 'topo.js'));
const { ckey, unckey: unck, up, pcDepth, C } = topo;
function install(fab) {
  const { lv } = fab;
  // C++: mesh_e2fold_fab.inc:e2cutLever
  function e2cutLever(tk) {
    const seats = fab.seats, alive = fab.alive, P = fab.printf, TICK = fab.w.TICK, coordStr = fab.coordStr;
    const sub = tk.length > 1 ? tk[1] : '';
    if (sub === 'pick') {
      const occT = new Map(); for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3 && seats[q].hasCoord) occT.set(ckey(seats[q].coord), q);
      let best = -1, bd = -1;
      for (const [k, v] of occT) {
        const c = unck(k); if (c.pc === 0 || c.i !== 0) continue; const o = up(c); if (!o || !occT.has(ckey(o))) continue;
        let mates = 0; for (let j = 1; j < C; j++) if (occT.has(ckey({ pc: c.pc, r: c.r, i: j }))) mates++; if (mates < 2) continue;
        const d = pcDepth(c.pc); if (d > bd || (d === bd && v < best)) { bd = d; best = v; }
      }
      if (tk.length > 2 && tk[2] === 'first') {   // the port test's pick: rows in the order of their first seated seat, the first with a head and 2+ mates
        best = -1; const ord = [], cnt = new Map();
        for (let q = 0; q < lv.nextId; q++) { if (!(alive[q] && seats[q].state === 3 && seats[q].hasCoord)) continue; const c = seats[q].coord; if (c.pc === 0) continue; const rk = ckey({ pc: c.pc, r: c.r, i: 0 }); if (!cnt.has(rk)) { ord.push(rk); cnt.set(rk, 0); } cnt.set(rk, cnt.get(rk) + 1); }
        for (const rk of ord) { if (cnt.get(rk) < 3 || !occT.has(rk)) continue; const o = up(unck(rk)); if (!o || !occT.has(ckey(o))) continue; best = occT.get(rk); bd = pcDepth(unck(rk).pc); break; }
      }
      if (best < 0) { P('E2PICK none\n'); return; }
      const c = seats[best].coord, o = up(c); lv.E2C_HEAD = best; lv.E2C_OWN = occT.get(ckey(o)); lv.E2C_ROW = ckey(c); lv.E2C_HEIR = -1; lv.E2C_HAND = -1; lv.E2C_STAGE = -1;
      const m = []; for (let j = 1; j < C; j++) { const x = occT.get(ckey({ pc: c.pc, r: c.r, i: j })); if (x !== undefined) m.push(x); }
      lv.E2C_HEIR = m[0]; lv.E2C_HAND = m.length > 1 ? m[1] : m[0]; lv.E2C_STAGE = m.length > 2 ? m[2] : m[0];
      if (tk.length > 2 && tk[2] === 'first') { lv.E2C_STAGE = m[0]; lv.E2C_HAND = m.length > 1 ? m[1] : m[0]; }   // the port test's stager is the heir (cell 1)
      P('E2PICK row=%s depth=%d head=%d owner=%d heir=%d hand=%d stage=%d\n', coordStr(c), bd, lv.E2C_HEAD, lv.E2C_OWN, lv.E2C_HEIR, lv.E2C_HAND, lv.E2C_STAGE);
    } else if (sub === 'sever') {
      const t = tk.length > 2 ? (parseInt(tk[2], 10) || 0) : 300; if (lv.E2C_HEAD < 0) { P('ERR e2cut: pick first\n'); return; }
      fab.runOp(['sever', String(lv.E2C_HEAD), String(lv.E2C_OWN), String(t)]); lv.E2C_AT = fab.w.TICK;
    } else if (sub === 'half' || sub === 'open') {
      if (lv.E2C_HEAD < 0) { P('ERR e2cut: pick first\n'); return; }   // half: the E1 pc stays open and carries nothing either way; open: it carries again
      const s = ['link', String(lv.E2C_HEAD), String(lv.E2C_OWN)]; if (sub === 'half') { s.push('half'); s.push('stuck'); } else s.push('open'); fab.runOp(s); if (sub === 'half') lv.E2C_AT = fab.w.TICK;
    } else if (sub === 'crash') {
      if (lv.E2C_HEAD < 0) { P('ERR e2cut: pick first\n'); return; }
      fab.runOp(['crash', String(lv.E2C_HEAD)]); lv.E2C_AT = fab.w.TICK;
    } else if (sub === 'hand' || sub === 'stage') {
      const who = sub === 'hand' ? lv.E2C_HAND : lv.E2C_STAGE; if (who < 0 || !alive[who]) { P('ERR e2cut: pick first\n'); return; }
      if (sub === 'hand') seats[who].handT = (TICK | 0) + 1; else { seats[who].stageT = (TICK | 0) + 1; seats[who].stageF = 0; }
      P('OK e2cut %s %d\n', sub, who);
    } else if (sub === 'probe') {
      let seated = 0; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3) seated++;
      let obs = 0, ex = 0, un = 0, ov = 0, hn = 0, sn = 0, s1 = 0, s1ex = 0, mn = 1 << 30, mx = -1;
      const rc = lv.E2C_ROW ? unck(lv.E2C_ROW) : null;
      for (let q = 0; q < lv.nextId; q++) {
        if (!alive[q] || seats[q].state !== 3 || fab.isFrozen(q)) continue; const s = seats[q]; if (!s.hasCoord) continue;
        const c = s.coord; if (rc && c.pc === rc.pc && c.r === rc.r) continue;   // the cut row hears the room only from above
        const R = s.dRoot(); if (R.at < 0) continue; obs++; const rn = R.n + R.leased; if (rn < mn) mn = rn; if (rn > mx) mx = rn;
        if (rn === seated) ex++; else if (rn < seated) un++; else ov++;
        if (c.pc === 0) { s1++; if (rn === seated) s1ex++; }
        for (const e of R.hands) if (e.id === lv.E2C_HAND) { hn++; break; }
        for (const e of R.stage) if (e.id === lv.E2C_STAGE) { sn++; break; }
      }
      let hs = 0; if (lv.E2C_HEIR >= 0 && alive[lv.E2C_HEIR] && seats[lv.E2C_HEIR].state === 3 && seats[lv.E2C_HEIR].hasCoord) { const hc = seats[lv.E2C_HEIR].coord, rr = unck(lv.E2C_ROW); hs = (hc.pc === rr.pc && hc.r === rr.r) ? 1 : 2; }   // the heir: 1 seated in the picked row, 2 seated elsewhere, 0 not seated
      P('E2PROBE t=%lld cut=%lld seated=%d obs=%d min=%d max=%d exact=%d under=%d over=%d s1=%d s1exact=%d hand=%d/%d stage=%d/%d heir=%d\n',
        TICK, lv.E2C_AT >= 0 ? TICK - lv.E2C_AT : -1, seated, obs, obs ? mn : -1, mx, ex, un, ov, s1, s1ex, lv.E2C_HAND >= 0 ? hn : -1, obs, lv.E2C_STAGE >= 0 ? sn : -1, obs, hs);
    } else if (sub === 'forge') {
      if (lv.E2C_HEAD < 0) { P('ERR e2cut: pick first\n'); return; }   // a Section-1 seat outside the owner's row claims the picked row over E2 in its report
      const oc = seats[lv.E2C_OWN].coord; let f = -1;
      for (let q = 0; q < lv.nextId; q++) { if (!alive[q] || seats[q].state !== 3 || !seats[q].hasCoord) continue; const c = seats[q].coord; if (c.pc !== 0 || (c.pc === oc.pc && c.r === oc.r)) continue; f = q; break; }
      if (f < 0) { P('E2FORGE none\n'); return; } lv.L48_FORGER = f; lv.L48_FORGE_K = lv.E2C_ROW; lv.L48_FORGE_BY = lv.E2C_HEAD; P('E2FORGE forger=%d at=%s\n', f, coordStr(seats[f].coord));
    } else P('ERR e2cut pick|sever <T>|half|open|crash|hand|stage|probe|forge\n');
  }
  fab.plug({ e2cutLever });
}
module.exports = { install };
