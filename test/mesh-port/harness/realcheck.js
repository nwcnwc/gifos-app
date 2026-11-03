'use strict';
/*
 * harness/realcheck.js: the real-browser sanity measurement (`realcheck on|off|heap`, `realcheck`, `rss`), a
 * line-for-line port of the sim's mesh_realcheck.inc and the realcheck globals of mesh.cpp (rcNoteSend). It reads the
 * seats and the link model after every tick and never changes the trajectory. Harness code, never shipped.
 *
 *   require('./realcheck.js').install(fab);   // plugs rcVerb rcReset rcTick rcNoteSend rcNoteRecv rcNoteDial
 *
 * The fabric calls rcNoteSend (schedule, and schedL10 for L22SEQ frames), rcNoteRecv (the bus, before recv),
 * rcTick (doTick's end) and link.js's startDial rcNoteDial, each only while fab.lv.RC_ON. The pc laws are read from
 * fab.pcl.pc (pclaws.js: l18Role doorEnd l15Names l15NamedBy l22Beside linkWhy), the link table from fab.link.
 *
 * WHAT CANNOT MATCH THE SIM, by design: `rss` prints this process's VmHWM / VmRSS (node's, not the sim's), so its
 * hwm_kb= and rss_kb= differ; `realcheck heap` (mesh_rcheap.inc) counts C++ heap bytes per seat under MESH_RCHEAP=1,
 * which has no JS twin: here every count is 0, which is the sim's own answer without MESH_RCHEAP (mode=0). Not
 * ported (stderr / env instruments): MESH_RCLEAKWHY (RCDIALWHY / RCLEAKWHY lines), MESH_RCDUMP, MESH_RCDUMPV,
 * MESH_RCFT, MESH_RCNLDBG, MESH_RCDDDBG.
 */
const fs = require('fs'), path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const C_ = require(path.join(M, 'consts.js'));
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));

const K = C_.consts, E = C_.enums;
const { LK_OPEN, LK_DIALING, LK_CLOSED } = E;
const C = topo.C;
const TWO32 = 4294967296;
const pkA = (pk) => Math.floor(pk / TWO32), pkB = (pk) => pk % TWO32;   // C++ (int)(pk>>32), (int)(uint32_t)pk
const lEnd = (me, x) => (me < x ? 0 : 1);
const MT_INDEX = new Map(msg.MT_NAMES.map((n, i) => [n, i]));
const MT_NAME = (t) => msg.MT_NAMES[t] || '?';

const RC_W1 = 2, RC_W10 = 20;   // 1 s and 10 s at 500 ms a tick
const RC_HIST = 33;             // excess 0..31, 32 = 32 or more
const RC_CLS = ['s1', 'deep', 'unseated'];
const RC_LOSS_H = K.LINK_DISC_DEAD + K.LINK_DIAL_FAIL;
const RC_GRACE = 8;
const RC_RNAME = ['none', 'topology', 'entry', 'fhop', 'peer-dead', 'closing', 'uplink', 'call', 'dialing', 'l22'];
const [RB_TOPO, RB_DOOR, RB_KNOCK, RB_ANSIN, RB_UPLINK, RB_ENTRY, RB_FARTOPO, RB_FARENTRY, RB_CALL, RB_L23WORD, RB_RIVAL, RB_BESIDE, RB_FHOP, RB_KEEP, RB_DIAL, RB_LOSS, RB_CLOSING, RB_L23CLOSE, RB_LEAK, RB_N] = [...Array(20).keys()];
const RB_NAME = ['topo', 'door', 'knock', 'ansdoor', 'uplink', 'entry', 'fartopo', 'farentry', 'call', 'l23word', 'rival', 'beside', 'fhop', 'keep', 'dialing', 'loss', 'closing', 'l23close', 'leak'];
const [RBL_TOPO, RBL_DOOR, RBL_KNOCK, RBL_UPLINK, RBL_L23WORD, RBL_KEEP, RBL_S1, RBL_N] = [...Array(8).keys()];
const RBL_NAME = ['L22-linkPeers', 'L16-DOORCAP', 'L16.4-list', 'L14.1-budget', 'L23-words', 'L28.2-KEEP_MAX', 'L16.10-budget'];
const RBL_OF = [RBL_TOPO, RBL_DOOR, RBL_KNOCK, -1, RBL_UPLINK, -1, -1, -1, -1, RBL_L23WORD, -1, -1, -1, RBL_KEEP, -1, -1, -1, -1, -1];

// C++: mesh_realcheck.inc:RcPeak
const newRcPeak = () => ({ v: -1, at: -1, seat: -1, extra: -1 });
// C++: mesh_realcheck.inc:RcLk
const newRcLk = () => ({ noneSince: -1, lastAt: -1, closingSince: -1, born: -1, last: 0, flagged: false });
// C++: mesh_realcheck.inc:RbRec
const newRbRec = () => ({ n: 0, at: -1, over: -1, at2: -1, seat: -1, seat2: -1, pcs: -1, bound: -1, pcs2: -1, bound2: -1, brk: '', brk2: '' });
// C++: mesh_realcheck.inc:RbPeak
const newRbPeak = () => ({ v: -1, at: -1, seat: -1, bound: -1, over: 0, brk: '' });

function install(fab) {
  const { lv, seats, alive, X, w } = fab;
  const P = (...a) => fab.printf(...a);
  const TICK = () => w.TICK;
  const pc = () => fab.pcl.pc;
  const LK = () => fab.link;
  const sNow = (s) => w.TICK - s.clkHeld;   // C++: mesh.cpp:sNow

  // ---- state (C++ statics) ---------------------------------------------------------------------------------------
  const R = {
    RC_OUT: [], RC_DEAD_AT: [], RC_DEADTX: 0, RC_FROZTX: 0, RC_DEADTX_AT: -1, RC_FROZTX_AT: -1, RC_DEADTX_SEAT: -1, RC_FROZTX_SEAT: -1,
    RC_T0: 0, RC_TICKS: 0, RC_LASTIN: [], RC_HOLD: [], RC_RUN: [], RC_RIN: [], RC_ROUT: [],
    RC_EXH: [new Array(RC_HIST).fill(0), new Array(RC_HIST).fill(0), new Array(RC_HIST).fill(0)],
    RC_RUNPK: newRcPeak(), RC_F: [newRcPeak(), newRcPeak(), newRcPeak(), newRcPeak()],
    RC_RXCLOSED: 0, RC_RXNOLINK: 0, RC_RXSTALE: 0, RC_RXCL_AT: -1, RC_RXNL_AT: -1, RC_RXCL_SEAT: -1, RC_RXCL_FROM: -1, RC_RXCL_T: -1, RC_RXNL_SEAT: -1,
    RC_RXCL_BYT: new Array(40).fill(0), RC_RXNL_BYT: new Array(64).fill(0),
    RCL: new Map(),
    RC_LEAKS: 0, RC_LEAKDEAD: 0, RC_LEAKTICKS: 0, RC_LEAKOPEN: 0, RC_LEAKV: [],
    RC_DEADDIAL: 0, RC_DD_AT: -1, RC_DD_AGO: -1, RC_DD_SEAT: -1, RC_DD_PEER: -1,
    RB_CNT: [], RB_TOPOCAP: [], RB_TMP: [],
    RB_LAWREC: Array.from({ length: RBL_N }, newRbRec), RB_PK: [newRbPeak(), newRbPeak(), newRbPeak()], RB_CATPK: Array.from({ length: RB_N }, newRbPeak), RB_OVERST: [0, 0, 0],
  };
  fab.rc = R;

  // C++: mesh.cpp:rcNoteSend
  function rcNoteSend(from) {
    if (from < 0) return; R.RC_OUT[from] = (R.RC_OUT[from] || 0) + 1;
    if (from < alive.length && !alive[from] && from < R.RC_DEAD_AT.length && R.RC_DEAD_AT[from] >= 0 && R.RC_DEAD_AT[from] < TICK()) { if (!R.RC_DEADTX++) { R.RC_DEADTX_SEAT = from; R.RC_DEADTX_AT = TICK(); } }   // a closed tab sends nothing
    else if (fab.isFrozen(from)) { if (!R.RC_FROZTX++) { R.RC_FROZTX_SEAT = from; R.RC_FROZTX_AT = TICK(); } }   // nor does a stopped renderer
  }

  // C++: mesh_realcheck.inc:rcClass
  const rcClass = (q) => { const s = seats[q]; if (s.state === 3 && s.hasCoord) return s.coord.pc === 0 ? 0 : 1; return 2; };
  // C++: mesh_realcheck.inc:rbEntering
  const rbEntering = (x) => { const s = seats[x]; return s.state !== 3 || !s.hasCoord || s.moving || sNow(s) - s.seatedAt < K.L22_SEATED_SETTLE; };
  // C++: mesh_realcheck.inc:rbKnockCap
  const rbKnockCap = () => ((lv.LINKMODEL && !lv.NETGRP) ? C * C : K.RELAY_CAP);
  // C++: mesh_realcheck.inc:rbCap
  function rbCap(q, k) {
    switch (k) {
      case RB_TOPO: return R.RB_TOPOCAP[q];
      case RB_DOOR: return lv.LINKMODEL ? X.pcBudget(q, E.PB_DOORS) : -1;
      case RB_KNOCK: return lv.LINKMODEL ? rbKnockCap() : -1;
      case RB_UPLINK: return X.pcBudget(q, E.PB_CLASS);
      case RB_L23WORD: return K.L23_WORDS_;
      case RB_KEEP: return K.KEEP_MAX;
      default: return -1;
    }
  }
  // C++: mesh_realcheck.inc:rbGranted
  const rbGranted = (q, k) => { const s = seats[q]; const seated = s.state === 3 && s.hasCoord; return (k === RB_DOOR || k === RB_UPLINK || k === RB_L23WORD) ? seated : k === RB_KNOCK ? !seated : true; };
  // C++: mesh_realcheck.inc:rbS1Judged
  const rbS1Judged = (q) => { const s = seats[q]; return !!lv.LINKMODEL && s.state === 3 && s.hasCoord && s.coord.pc === 0; };
  // C++: mesh_realcheck.inc:rbS1Budget
  const rbS1Budget = (q) => X.pcBudget(q, E.PB_S1);
  // C++: mesh_link.inc:namesOwned
  const namesOwned = (from, to) => !!seats[from].linkRole(to, E.LR_OWNED | E.LR_E2);
  // C++: mesh_realcheck.inc:rcFhRoute   (does either end relay for the other, or ride the other as its relay?)
  function rcFhRoute(a, b) {
    if (!X.fhopActive()) return false;
    const FH = fab.FH || [];
    for (let k = 0; k < 2; k++) {
      const x = k ? b : a, y = k ? a : b; if (x >= FH.length) continue; const f = FH[x];
      for (const j of f.jobs) if (j.target === y || j.req === y) return true;
      for (const p of f.peer.values()) if (p.via === y) return true;
    }
    return false;
  }
  // CALL: a dialled call this beat or two, from the caller's own table
  const fresh = (x, y) => seats[x].callBook.outFresh(y, sNow(seats[x])) || seats[x].callBook.ringFresh(y, K.CALL_HOLD, sNow(seats[x]));
  const riv = (x, y) => { const it = seats[x].l22Rival.get(y); return it !== undefined && sNow(seats[x]) - it <= K.L22_RIVAL; };

  // C++: mesh_realcheck.inc:rbClassify   (which allowance a held pc counts under at end q, peer p)
  function rbClassify(L, q, p, r) {
    const n = lv.nextId; const pl = p < n && !!alive[p]; const sq = seats[q]; const PC = pc();
    if (PC.l18Role(q, p)) return RB_TOPO;
    if (L.outside && !(L.outside & (1 << lEnd(q, p)))) { if (PC.doorEnd(L, q, p) && !PC.l15Names(q, p) && !PC.l15NamedBy(q, p)) return RB_DOOR; }
    else if (L.outside && (PC.doorEnd(L, q, p) || (pl && PC.doorEnd(L, p, q))) && !PC.l15Names(q, p) && !(pl && PC.l15Names(p, q))) return L.dialBy === q ? RB_KNOCK : RB_ANSIN;
    if (pl && seats[p].l14Up === q) return RB_UPLINK;
    if (rbEntering(q)) return RB_ENTRY;
    if (pl && PC.l18Role(p, q)) return RB_FARTOPO;
    if (pl && rbEntering(p)) return RB_FARENTRY;
    if (fresh(q, p) || (pl && fresh(p, q))) return RB_CALL;
    {
      if (sq.state === 3 && sq.hasCoord && (riv(q, p) || PC.l22Beside(q, p))) { const wa = sq.l23WordAt.get(p); if (wa !== undefined && sNow(sq) - wa < K.L23_WORD_) return RB_L23WORD; }
      if (riv(q, p) || (pl && riv(p, q))) return RB_RIVAL;
    }
    if (PC.l22Beside(q, p) || (pl && PC.l22Beside(p, q))) return RB_BESIDE;
    if (pl && rcFhRoute(q, p)) return RB_FHOP;
    if (sq.keepHeld(p) || (pl && seats[p].keepHeld(q))) return RB_KEEP;
    if (L.state === LK_DIALING && TICK() - L.dialAt <= K.LINK_DIAL_FAIL) return RB_DIAL;
    if (!pl && p < R.RC_DEAD_AT.length && R.RC_DEAD_AT[p] !== -1 && TICK() - R.RC_DEAD_AT[p] <= RC_LOSS_H) return RB_LOSS;
    if (L.state === LK_CLOSED && r.closingSince >= 0 && TICK() - r.closingSince <= RC_LOSS_H) return RB_CLOSING;
    if (r.noneSince < 0 || TICK() - r.noneSince <= RC_GRACE) return RB_CLOSING;
    if (TICK() - r.noneSince <= K.L23_BOUND) return RB_L23CLOSE;
    return RB_LEAK;
  }
  // C++: mesh_realcheck.inc:rbBrk   ("cell@state topo:7/7,door:4/96,call:1/-")
  function rbBrk(q) {
    const s = seats[q]; let o = s.hasCoord ? fab.coordStr(s.coord) : '-';
    o += (s.state !== 3 || !s.hasCoord) ? '@entering' : s.moving ? '@moving' : sNow(s) - s.seatedAt < K.L22_SEATED_SETTLE ? '@settling' : '@seated';
    let first = true;
    for (let k = 0; k < RB_N; k++) {
      const c = R.RB_CNT[q * RB_N + k]; if (!c) continue; const cap = rbCap(q, k);
      o += cap >= 0 ? fab.sprintf('%s%s:%d/%d', first ? ' ' : ',', RB_NAME[k], c, cap) : fab.sprintf('%s%s:%d/-', first ? ' ' : ',', RB_NAME[k], c); first = false;
    }
    if (rbS1Judged(q)) o += fab.sprintf(',L16.10:%d', rbS1Budget(q));
    return o.replace(/ /g, '_');
  }

  // C++: mesh_realcheck.inc:rcReset
  function rcReset() {
    const n = lv.nextId;
    R.RC_T0 = TICK(); R.RC_TICKS = 0; R.RC_LASTIN = new Array(n).fill(0); for (let q = 0; q < n; q++) if (seats[q]) R.RC_LASTIN[q] = seats[q].framesIn;
    R.RC_OUT = new Array(n).fill(0); R.RC_HOLD = []; R.RC_RUN = new Array(n).fill(0); R.RC_RIN = new Array(n * RC_W10).fill(0); R.RC_ROUT = new Array(n * RC_W10).fill(0);
    for (const r of R.RC_EXH) r.fill(0); R.RC_RUNPK = newRcPeak(); for (let i = 0; i < 4; i++) R.RC_F[i] = newRcPeak();
    R.RC_DEADTX = R.RC_FROZTX = 0; R.RC_DEADTX_AT = R.RC_FROZTX_AT = -1; R.RC_DEADTX_SEAT = R.RC_FROZTX_SEAT = -1;
    R.RC_RXCLOSED = R.RC_RXNOLINK = R.RC_RXSTALE = 0; R.RC_RXCL_BYT.fill(0); R.RC_RXNL_BYT.fill(0); R.RC_RXCL_AT = R.RC_RXNL_AT = -1; R.RC_RXCL_SEAT = R.RC_RXCL_FROM = R.RC_RXCL_T = R.RC_RXNL_SEAT = -1;
    R.RCL.clear(); R.RC_DEAD_AT = new Array(n).fill(-1); for (let q = 0; q < n; q++) if (!alive[q]) R.RC_DEAD_AT[q] = 0;
    R.RC_LEAKS = R.RC_LEAKDEAD = R.RC_LEAKTICKS = R.RC_LEAKOPEN = 0; R.RC_LEAKV = []; R.RC_DEADDIAL = 0; R.RC_DD_AT = R.RC_DD_AGO = -1; R.RC_DD_SEAT = R.RC_DD_PEER = -1;
    for (let l = 0; l < RBL_N; l++) R.RB_LAWREC[l] = newRbRec(); for (let c = 0; c < 3; c++) R.RB_PK[c] = newRbPeak(); for (let k = 0; k < RB_N; k++) R.RB_CATPK[k] = newRbPeak(); R.RB_OVERST = [0, 0, 0];
  }

  // C++: mesh_realcheck.inc:rcNoteDial
  function rcNoteDial(a, b) {
    for (let k = 0; k < 2; k++) {
      const x = k ? a : b, y = k ? b : a;
      if (x < R.RC_DEAD_AT.length && !alive[x] && R.RC_DEAD_AT[x] !== -1 && TICK() - R.RC_DEAD_AT[x] > RC_LOSS_H) {
        if (!R.RC_DEADDIAL++) { R.RC_DD_SEAT = y; R.RC_DD_PEER = x; R.RC_DD_AT = TICK(); R.RC_DD_AGO = TICK() - R.RC_DEAD_AT[x]; } return;
      }
    }
  }

  // C++: mesh_realcheck.inc:rcReason   (the reason a held link has now, from its ends' own state; 0: none)
  function rcReason(L, a, b, r) {
    const la = !!alive[a], lb = !!alive[b];
    if (la && namesOwned(a, b)) return 1; if (lb && namesOwned(b, a)) return 1;
    for (const x of [a, b]) if (alive[x] && (seats[x].state !== 3 || !seats[x].hasCoord || seats[x].moving)) return 2;
    {
      for (const x of [a, b]) if (alive[x] && sNow(seats[x]) - seats[x].seatedAt < K.L22_SEATED_SETTLE) return 2;
      for (const x of [a, b]) { const y = x === a ? b : a; if (!alive[x]) continue; if (pc().linkWhy(x, y, false) & (E.LW_RIVAL | E.LW_BESIDE | E.LW_KEEP | E.LW_ISLAND | E.LW_CALL)) return 9; }
    }
    if (la && lb && rcFhRoute(a, b)) return 3;
    if (la && seats[a].l14Up === b) return 6; if (lb && seats[b].l14Up === a) return 6;
    if ((la && fresh(a, b)) || (lb && fresh(b, a))) return 7;
    if (L.state === LK_DIALING && TICK() - L.dialAt <= K.LINK_DIAL_FAIL) return 8;
    if (L.state === LK_OPEN && L.half === 3 && L.stuck && L.halfAt >= 0 && TICK() - L.halfAt <= RC_LOSS_H) return 4;
    for (const x of [a, b]) if (!alive[x] && x < R.RC_DEAD_AT.length && R.RC_DEAD_AT[x] !== -1 && TICK() - R.RC_DEAD_AT[x] <= RC_LOSS_H) return 4;
    if (L.state === LK_CLOSED) { if (r.closingSince < 0) r.closingSince = TICK(); if (TICK() - r.closingSince <= RC_LOSS_H) return 5; } else r.closingSince = -1;
    return 0;
  }

  // C++: mesh_realcheck.inc:rcNoteRecv   (a frame the bus hands a live seat this tick, before recv)
  function rcNoteRecv(m) {
    if (!lv.LINKMODEL || m.lk < 0 || m.lk === m.to || m.to < 0) return;
    const L = X.linkFind(m.lk, m.to); const t = MT_INDEX.get(m.t);
    if (!L) { R.RC_RXNL_BYT[t < 64 ? t : 63]++; if (!R.RC_RXNOLINK++) { R.RC_RXNL_SEAT = m.to; R.RC_RXNL_AT = TICK(); } return; }
    if (L.view[lEnd(m.to, m.lk)] !== LK_OPEN) { R.RC_RXCL_BYT[t < 40 ? t : 39]++; if (!R.RC_RXCLOSED++) { R.RC_RXCL_SEAT = m.to; R.RC_RXCL_FROM = m.lk; R.RC_RXCL_T = t; R.RC_RXCL_AT = TICK(); } return; }
    if (L.epoch !== m.lkEp) R.RC_RXSTALE++;
  }

  // C++: mesh_realcheck.inc:rcPeak
  const rcPeak = (p, v, seat, extra) => { if (v > p.v) { p.v = v; p.at = TICK(); p.seat = seat; p.extra = extra; } };

  // C++: mesh_realcheck.inc:rcTick
  function rcTick() {
    const n = lv.nextId;
    while (R.RC_LASTIN.length < n) R.RC_LASTIN.push(0);
    while (R.RC_RUN.length < n) R.RC_RUN.push(0);
    while (R.RC_RIN.length < n * RC_W10) { R.RC_RIN.push(0); R.RC_ROUT.push(0); }
    while (R.RC_DEAD_AT.length < n) R.RC_DEAD_AT.push(-1);
    for (let q = 0; q < n; q++) { if (!alive[q]) { if (R.RC_DEAD_AT[q] === -1) R.RC_DEAD_AT[q] = TICK(); } else R.RC_DEAD_AT[q] = -1; }
    R.RC_HOLD = new Array(n).fill(0);
    R.RB_CNT = new Array(n * RB_N).fill(0); R.RB_TOPOCAP = new Array(n).fill(0);
    for (let q = 0; q < n; q++) if (alive[q] && seats[q] && seats[q].hasCoord) { seats[q].linkPeers(R.RB_TMP, E.LR_TOPO); R.RB_TOPOCAP[q] = R.RB_TMP.length; }   // L22's contract: the peers my own state names
    if (lv.LINKMODEL) for (const [kf, L] of LK().LINKS) {
      const a = pkA(kf), b = pkB(kf);
      const live = L.state === LK_OPEN || L.state === LK_DIALING;
      for (let e = 0; e < 2; e++) { const q = e === 0 ? a : b; if (q >= n || !alive[q]) continue; if (live || L.view[lEnd(q, e === 0 ? b : a)] === LK_OPEN) R.RC_HOLD[q]++; }
      // 5: is the pc held by a live end, and has it a reason?
      let held = false; for (let e = 0; e < 2; e++) { const q = e === 0 ? a : b, o = e === 0 ? b : a; if (q < n && alive[q] && (live || L.view[lEnd(q, o)] === LK_OPEN)) held = true; }
      if (!held) { if (R.RCL.size) R.RCL.delete(kf); continue; }
      let r = R.RCL.get(kf); if (r === undefined) { r = newRcLk(); R.RCL.set(kf, r); } if (r.born < 0) r.born = TICK();
      const why = rcReason(L, a, b, r);
      if (why) { r.last = why; r.lastAt = TICK(); r.noneSince = -1; r.flagged = false; }
      else if (r.noneSince < 0) r.noneSince = TICK();
      for (let e = 0; e < 2; e++) { const q = e === 0 ? a : b, o = e === 0 ? b : a; if (q < n && alive[q] && (live || L.view[lEnd(q, o)] === LK_OPEN)) R.RB_CNT[q * RB_N + rbClassify(L, q, o, r)]++; }   // 1: the allowance each held pc counts under
      if (why) continue;
      if (TICK() - r.noneSince > RC_GRACE) {
        R.RC_LEAKTICKS++;
        if (!r.flagged) {
          r.flagged = true; R.RC_LEAKS++; const bd = !alive[a] || !alive[b]; if (bd) R.RC_LEAKDEAD++;
          if (R.RC_LEAKV.length < 6) {
            const k = { a: alive[a] ? a : b, b: alive[a] ? b : a, at: TICK(), age: TICK() - L.dialAt, lastAt: r.lastAt, last: r.last, aCls: -1, bCls: -1, bDead: false, idle: 0, ca: '', cb: '' };
            k.aCls = rcClass(k.a); k.bCls = alive[k.b] ? rcClass(k.b) : -1; k.bDead = !alive[k.b]; k.idle = TICK() - Math.max(L.txAt[0], L.txAt[1]);
            k.ca = seats[k.a].hasCoord ? fab.coordStr(seats[k.a].coord) : '-'; k.cb = k.bDead ? '' : (seats[k.b].hasCoord ? ' ' + fab.coordStr(seats[k.b].coord) : '');
            R.RC_LEAKV.push(k);
          }
        }
      }
    }
    const slot = R.RC_TICKS % RC_W10;
    for (let q = 0; q < n; q++) {
      if (!alive[q] || !seats[q] || seats[q].hostile) { R.RC_RUN[q] = 0; continue; }   // a hostile page is outside the laws
      const cls = rcClass(q), h = R.RC_HOLD[q];
      {   // 1: the seat's law bound, the sum of its allowances; over = the pcs past the caps the laws give a number for
        const base = q * RB_N; let bound = 0, over = 0; const lawOver = new Array(RBL_N).fill(0);
        for (let k = 0; k < RB_N; k++) {
          const c = R.RB_CNT[base + k], cap = rbCap(q, k); if (cap < 0) { bound += c; continue; }
          bound += rbGranted(q, k) ? cap : c; if (c > cap && RBL_OF[k] >= 0) { lawOver[RBL_OF[k]] += c - cap; over += c - cap; }
          if (c > R.RB_CATPK[k].v) { const p = R.RB_CATPK[k]; p.v = c; p.at = TICK(); p.seat = q; p.bound = cap; }
        }
        for (let k = 0; k < RB_N; k++) if (rbCap(q, k) < 0 && R.RB_CNT[base + k] > R.RB_CATPK[k].v) { const p = R.RB_CATPK[k]; p.v = R.RB_CNT[base + k]; p.at = TICK(); p.seat = q; p.bound = -1; }
        if (rbS1Judged(q)) { const B = rbS1Budget(q); if (h > B) { lawOver[RBL_S1] = h - B; over = Math.max(over, h - B); } bound = Math.min(bound, B); }   // L16.10
        const pk = R.RB_PK[cls]; if (h > pk.v || (h === pk.v && over > pk.over)) { pk.v = h; pk.at = TICK(); pk.seat = q; pk.bound = bound; pk.over = over; pk.brk = rbBrk(q); }
        for (let l = 0; l < RBL_N; l++) {
          if (!lawOver[l]) continue; const wr = R.RB_LAWREC[l]; wr.n++;
          if (wr.at < 0) { wr.at = TICK(); wr.seat = q; wr.pcs = h; wr.bound = bound; wr.brk = rbBrk(q); }
          if (lawOver[l] > wr.over) { wr.over = lawOver[l]; wr.at2 = TICK(); wr.seat2 = q; wr.pcs2 = h; wr.bound2 = bound; wr.brk2 = rbBrk(q); }
        }
        R.RC_EXH[cls][over <= 0 ? 0 : Math.min(over, RC_HIST - 1)]++; if (over > 0) R.RB_OVERST[cls]++;
        if (over > 0) { R.RC_RUN[q]++; rcPeak(R.RC_RUNPK, R.RC_RUN[q], q, h); } else R.RC_RUN[q] = 0;
      }
      const fin = seats[q].framesIn - R.RC_LASTIN[q]; R.RC_LASTIN[q] = seats[q].framesIn; const fout = R.RC_OUT[q] || 0; R.RC_OUT[q] = 0;
      const ri = q * RC_W10;
      R.RC_RIN[ri + slot] = Math.min(fin, 65535); R.RC_ROUT[ri + slot] = Math.min(fout, 65535);
      let i1 = 0, o1 = 0, i10 = 0, o10 = 0;
      for (let k = 0; k < RC_W10; k++) { const sl = (slot - k + RC_W10) % RC_W10; i10 += R.RC_RIN[ri + sl]; o10 += R.RC_ROUT[ri + sl]; if (k < RC_W1) { i1 += R.RC_RIN[ri + sl]; o1 += R.RC_ROUT[ri + sl]; } }
      rcPeak(R.RC_F[0], i1, q, cls); rcPeak(R.RC_F[1], o1, q, cls); rcPeak(R.RC_F[2], i10, q, cls); rcPeak(R.RC_F[3], o10, q, cls);
    }
    R.RC_TICKS++;
  }

  // C++: mesh_realcheck.inc:rcVerb
  function rcVerb(tk) {
    if (tk[0] === 'rss') {
      let hwm = -1, rss = -1;
      try { for (const l of fs.readFileSync('/proc/self/status', 'utf8').split('\n')) { if (l.startsWith('VmHWM:')) hwm = parseInt(l.slice(6), 10); else if (l.startsWith('VmRSS:')) rss = parseInt(l.slice(6), 10); } } catch (e) { /* no /proc */ }
      let na = 0; for (let q = 0; q < Math.min(lv.nextId, alive.length); q++) if (alive[q] === 1) na++;
      P('RSS tick=%lld N=%d alive=%d hwm_kb=%ld rss_kb=%ld\n', TICK(), lv.N, na, hwm, rss); return;
    }
    if (tk.length > 1 && tk[1] === 'heap') {   // mesh_rcheap.inc: no per-seat heap in JS; the sim's answer without MESH_RCHEAP (every count 0)
      const v = []; let mx = -1, mxs = -1; const mode = (process.env.MESH_RCHEAP && process.env.MESH_RCHEAP[0] === '1') ? 1 : 0;
      for (let q = 0; q < lv.nextId; q++) { if (!alive[q]) continue; const b = 0; v.push(b); if (b > mx) { mx = b; mxs = q; } }
      P('RCHEAP tick=%lld mode=%d live=%zu mean=%lld p50=%lld p99=%lld max=%lld max_seat=%d max_allocs=%lld fabric=%lld dead_seats=%lld\n', TICK(), mode, v.length, 0, 0, 0, mx, mxs, 0, 0, 0); return;
    }
    if (tk.length > 1 && tk[1] === 'on') { lv.RC_ON = true; rcReset(); P('OK realcheck on at tick=%lld\n', TICK()); return; }
    if (tk.length > 1 && tk[1] === 'off') { lv.RC_ON = false; P('OK realcheck off\n'); return; }
    if (!lv.RC_ON) { P('ERR realcheck is off\n'); return; }
    P('RCLINK since=%lld ticks=%lld linkmodel=%d', R.RC_T0, R.RC_TICKS, lv.LINKMODEL ? 1 : 0);
    for (let c = 0; c < 3; c++) { const p = R.RB_PK[c], N_ = RC_CLS[c]; P(' %s_max=%lld %s_bound=%d %s_over=%d %s_seat=%d %s_at=%lld %s_brk=%s %s_overticks=%lld', N_, p.v, N_, p.bound, N_, p.over, N_, p.seat, N_, p.at, N_, p.brk === '' ? '-' : p.brk, N_, R.RB_OVERST[c]); }
    P(' run_max=%lld run_seat=%d run_at=%lld run_pcs=%d', R.RC_RUNPK.v, R.RC_RUNPK.seat, R.RC_RUNPK.at, R.RC_RUNPK.extra);
    for (let c = 0; c < 3; c++) { P(' %s_hist=', RC_CLS[c]); let last = 0; for (let x = 1; x < RC_HIST; x++) if (R.RC_EXH[c][x]) last = x; for (let x = 1; x <= last; x++) P('%s%lld', x > 1 ? ',' : '', R.RC_EXH[c][x]); if (!last) P('-'); }
    P('\n');
    {
      let any = false;
      for (let l = 0; l < RBL_N; l++) {
        const wr = R.RB_LAWREC[l]; if (!wr.n) continue; any = true;
        P('RCBOUND law=%s seat_ticks=%lld first_seat=%d first_at=%lld first_pcs=%d first_bound=%d first_brk=%s worst_seat=%d worst_at=%lld worst_over=%lld worst_pcs=%d worst_bound=%d worst_brk=%s\n', RBL_NAME[l], wr.n, wr.seat, wr.at, wr.pcs, wr.bound, wr.brk, wr.seat2, wr.at2, wr.over, wr.pcs2, wr.bound2, wr.brk2);
      }
      if (!any) P('RCBOUND none\n');
    }
    P('RCCAT'); for (let k = 0; k < RB_N; k++) { const p = R.RB_CATPK[k]; if (p.v <= 0) continue; if (p.bound >= 0) P(' %s=%lld/%d@%d:%lld', RB_NAME[k], p.v, p.bound, p.seat, p.at); else P(' %s=%lld/-@%d:%lld', RB_NAME[k], p.v, p.seat, p.at); } P('\n');
    const fn = ['in1', 'out1', 'in10', 'out10'];
    P('RCFRAMES since=%lld ticks=%lld', R.RC_T0, R.RC_TICKS);
    for (let k = 0; k < 4; k++) { const p = R.RC_F[k]; const v = k < 2 ? p.v : p.v / 10.0; P(' %s_max=%.1f %s_seat=%d %s_at=%lld %s_cls=%s', fn[k], v < 0 ? 0 : v, fn[k], p.seat, fn[k], p.at, fn[k], p.extra < 0 ? '-' : RC_CLS[p.extra]); }
    P('\n');
    { let still = 0; for (const e of R.RCL.values()) if (e.flagged) still++; R.RC_LEAKOPEN = still; }
    P('RCLEAK grace=%d leaks=%lld to_dead=%lld leak_link_ticks=%lld still_held=%lld deaddial=%lld deaddial_seat=%d deaddial_peer=%d deaddial_at=%lld deaddial_ago=%lld\n', RC_GRACE, R.RC_LEAKS, R.RC_LEAKDEAD, R.RC_LEAKTICKS, R.RC_LEAKOPEN, R.RC_DEADDIAL, R.RC_DD_SEAT, R.RC_DD_PEER, R.RC_DD_AT, R.RC_DD_AGO);
    for (const k of R.RC_LEAKV) P('RCLEAK1 seat=%d (%s %s) peer=%d (%s%s) at=%lld age=%lld idle=%lld last=%s last_at=%lld\n', k.a, RC_CLS[k.aCls], k.ca, k.b, k.bDead ? 'dead' : RC_CLS[k.bCls < 0 ? 2 : k.bCls], k.cb, k.at, k.age, k.idle, RC_RNAME[k.last], k.lastAt);
    P('RCRXCLOSED'); for (let t = 0; t < 40; t++) if (R.RC_RXCL_BYT[t]) P(' %s=%lld', MT_NAME(t), R.RC_RXCL_BYT[t]); P('\n');
    P('RCRXNOLINK'); for (let t = 0; t < 64; t++) if (R.RC_RXNL_BYT[t]) P(' %s/%d=%lld', MT_NAME(t), t, R.RC_RXNL_BYT[t]); P('\n');
    P('RCMISC deadtx=%lld deadtx_seat=%d deadtx_at=%lld froztx=%lld froztx_seat=%d froztx_at=%lld rxclosed=%lld rxclosed_seat=%d rxclosed_from=%d rxclosed_type=%d rxclosed_at=%lld rxnolink=%lld rxnolink_seat=%d rxnolink_at=%lld rxstale=%lld nondoor=%lld\n',
      R.RC_DEADTX, R.RC_DEADTX_SEAT, R.RC_DEADTX_AT, R.RC_FROZTX, R.RC_FROZTX_SEAT, R.RC_FROZTX_AT, R.RC_RXCLOSED, R.RC_RXCL_SEAT, R.RC_RXCL_FROM, R.RC_RXCL_T, R.RC_RXCL_AT, R.RC_RXNOLINK, R.RC_RXNL_SEAT, R.RC_RXNL_AT, R.RC_RXSTALE, lv.RELAY_NONDOOR);
  }

  fab.plug({ rcVerb, rcReset, rcTick, rcNoteSend, rcNoteRecv, rcNoteDial });
  return { rcVerb, rcReset, rcTick, rcNoteSend, rcNoteRecv, rcNoteDial };
}

module.exports = { install };
