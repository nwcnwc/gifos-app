'use strict';
/*
 * media.js: THE MEDIA-PATH MODEL, the fabric side (port plan H3): a line-for-line port of the sim's
 * mesh_media.inc. Harness code, never shipped. A measurement: it reads the seating and the link model and never
 * changes the trajectory (no seat state, no rng, no frame), except `feedcase`, which ticks the room and applies
 * its cuts through the ops (sever, crash) as the C++ does through runOp.
 *
 *   const { installMedia } = require('./media.js');   installMedia(fab);   // after the link unit is installed
 *
 * Plugs into fab.X: mediaTick mgapTick (the end-of-tick hooks), mgapOn mgapReport mgapSeats, mediaSetup mediaReset
 * mediaReport(skipSet), mstage (the MSTAGE array) mstageClear mstagePush, mfeeds (the MFEEDS array), mBuildCells,
 * mcell (the MCELL Map, ckey -> seat id), mAt mOcc mFlow mCarry mHash, pcsReport (-> [tP50, tMax, oP50, oMax]),
 * pcsPeakRead pcsPeakReset pcsPeakClass(t, c) (-> {n, seat, at, kind}), feedCase.
 * The C++ OMap / OSet are insertion-ordered: plain Map / Set here. Scalars (MEDIA, PCS_TRACK, PCS_PEAK..., MGAP,
 * MGAP_T0, MGAP_PRE) are fab.lv.<name>.
 *
 * NOT PORTED: the MESH_MEDIALOG stderr diagnostic in mediaTick (reads only).
 */
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const C_ = require(path.join(M, 'consts.js'));
const topo = require(path.join(M, 'topo.js'));
const hash = require(path.join(M, 'hash.js'));
const roles = require(path.join(M, 'roles.js'));

const K = C_.consts, E = C_.enums;
const { ckey, unckey, down, ownedLinks, C } = topo;
const { ownerOf, heirOf, backupOwnerOf, standbyOf, e2SrcOf } = roles;
const U32 = (x) => x >>> 0;
const lmix = (x) => hash.fmix32(U32(x + 0x9e3779b9));   // C++: mesh_link.inc:lmix
const rowKeyOf = (c) => c.pc * 256 + c.r;                // C++: mesh_media.inc:rowKeyOf
const rowOfKey = (k) => ({ pc: Math.floor(k / 256) >>> 0, r: k % 256, i: 0 });   // Coord{(uint32_t)(k>>8),(uint8_t)(k&0xff),0}
const numSort = (v) => v.sort((a, b) => a - b);          // stable_sort on integers
const atoll = (s) => { const v = parseInt(s, 10); return Number.isNaN(v) ? 0 : v; };

function installMedia(fab) {
  const lv = fab.lv, seats = fab.seats, alive = fab.alive, w = fab.w, X = fab.X;
  const P = (f, ...a) => fab.printf(f, ...a);
  const TICK = () => w.TICK;
  const lk = () => fab.link;   // the link unit (mesh_link.inc): pathOk, linkFind, lEnd, LINKPEERS, lEnsure, l15Names

  const MSTAGE = [];
  const MFEEDS = [];
  const MCELL = new Map();   // ground truth this tick: cell -> seat
  // C++: mesh_media.inc:MRx
  const newRx = () => ({ lastHot: -1, hotRun: 0, promoted: false, cur: 0, maxGap: 0 });
  // C++: mesh_media.inc:MFeedSt
  const newFeed = () => ({ src: -1, row: 0, stadium: false, rx: new Map() });

  // C++: mesh_media.inc:mOcc
  const mOcc = (c) => MCELL.has(ckey(c));
  // C++: mesh_media.inc:mAt
  const mAt = (c) => { const v = MCELL.get(ckey(c)); return v === undefined ? -1 : v; };
  // C++: mesh_media.inc:mCarry
  const mCarry = (q) => { if (q < 0 || q >= lv.nextId || !alive[q]) return false; const s = seats[q]; return s.state === 3 && s.hasCoord && !fab.isFrozen(q) && s.selfLeaseAt < 0; };
  // C++: mesh_media.inc:mFlow
  function mFlow(s, q) {
    if (!mCarry(s) || !mCarry(q) || !lk().pathOk(s, q)) return false;
    if (seats[s].hostile & E.H_MEDIA_) return false;   // hostile mode media: it beats and forwards no feed
    if (!lv.LINKMODEL) return !fab.cutBetween(s, q);
    const L = lk().linkFind(s, q); if (!L || L.state !== E.LK_OPEN) return false;
    return !(L.half & (1 << lk().lEnd(s, q)));
  }
  // C++: mesh_media.inc:mBuildCells
  function mBuildCells() {
    MCELL.clear();
    for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3 && seats[q].hasCoord) { const k = ckey(seats[q].coord); if (!MCELL.has(k)) MCELL.set(k, q); }
  }

  // out-edges of one feed: (to, hot)
  // C++: mesh_media.inc:mEdges
  function mEdges(F) {
    const out = []; for (let q = 0; q < lv.nextId; q++) out.push([]);
    const Ed = (a, b, hot) => { if (a >= 0 && b >= 0 && a !== b) out[a].push([b, hot]); };
    const srow = F.stadium ? rowOfKey(F.row) : { pc: seats[F.src].coord.pc, r: seats[F.src].coord.r, i: 0 };
    const srk = rowKeyOf(srow);
    // the chain from the source row up to Section 1, and each chain row's entry seats (the owner and backup owner of the row below)
    const entry = new Map(), chain = new Set(); let r = srow;
    for (let g = 0; g < 64; g++) {
      chain.add(rowKeyOf(r)); const o = ownerOf(r); if (!o) break;
      const en = { o: -1, b: -1, s: -1 }; en.o = mAt(o); let b = backupOwnerOf(r, mOcc); if (b) en.b = mAt(b); b = standbyOf(r, mOcc); if (b) en.s = mAt(b);
      const pr = { pc: o.pc, r: o.r, i: 0 }; entry.set(rowKeyOf(pr), en); r = pr;
    }
    const rows = new Map(); for (const [k, q] of MCELL) { const rk = rowKeyOf(unckey(k)); let v = rows.get(rk); if (!v) { v = []; rows.set(rk, v); } v.push(q); }
    for (const [rk, Mr] of rows) {
      const row = rowOfKey(rk); const inChain = chain.has(rk);
      const h = mAt(row); let src = -1; { const sc = e2SrcOf(row, mOcc); if (sc) src = mAt(sc); }
      if (row.pc === 0) {   // Section 1: the rook floods (row-mates and column-mates, all hot)
        for (const a of Mr) for (const b of Mr) if (a !== b) Ed(a, b, true);
        for (const a of Mr) { const c = seats[a].coord; for (let j = 0; j < C; j++) if (j !== c.r) { const b = mAt({ pc: 0, r: j, i: c.i }); Ed(a, b, true); } }
      } else {
        let x; const oi = (x = ownerOf(row)) ? mAt(x) : -1, bi = (x = backupOwnerOf(row, mOcc)) ? mAt(x) : -1, si = (x = standbyOf(row, mOcc)) ? mAt(x) : -1;
        if (inChain) { Ed(h, oi, true); Ed(src, bi, false); Ed(src, si, false); }   // up: E1 hot, E2 (and E3) parked
        Ed(oi, h, !inChain); Ed(bi, src, false); Ed(si, src, false);                // down: E1 (parked in a chain row), E2 (E3) parked
        let eh = h, ep = src, e3 = -1;                                              // a down row: the head enters, the E2 source backs it up
        if (inChain && rk !== srk) { const it = entry.get(rk); if (it !== undefined) { eh = it.o; ep = it.b; e3 = it.s; if (ep < 0) ep = (eh === h) ? src : h; } }
        if (e3 >= 0) for (const q of Mr) if (q !== e3) Ed(e3, q, false);           // variant B: the standby holds a parked copy to its row too
        if (rk === srk && !F.stadium) {
          const xs = F.src;
          for (const q of Mr) if (q !== xs) {
            Ed(xs, q, true); let y = (q !== h && xs !== h) ? h : ((src !== q && src !== xs) ? src : -1);
            if (y < 0) for (const z of Mr) if (z !== q && z !== xs) { y = z; break; }
            Ed(y, q, false);
          }
        } else if (!(rk === srk && F.stadium)) { for (const q of Mr) { if (q !== eh) Ed(eh, q, true); if (q !== ep) Ed(ep, q, false); } }
      }
    }
    return out;
  }
  // C++: mesh_media.inc:mediaTick
  function mediaTick() {
    if (!lv.MEDIA || MFEEDS.length === 0) return;
    mBuildCells();
    for (const F of MFEEDS) {
      if (!F.stadium && (F.src < 0 || F.src >= lv.nextId || !alive[F.src] || !seats[F.src].hasCoord)) continue;
      if (F.stadium) { const row = rowOfKey(F.row); let any = false; for (let j = 0; j < C; j++) if (mOcc({ pc: row.pc, r: row.r, i: j })) any = true; if (!any) continue; }
      const out = mEdges(F); const n = lv.nextId; const have = new Uint8Array(n), hotOk = new Uint8Array(n); const q = [];
      if (F.stadium) { const row = rowOfKey(F.row); for (let j = 0; j < C; j++) { const s = mAt({ pc: row.pc, r: row.r, i: j }); if (s >= 0 && mCarry(s)) { have[s] = 1; q.push(s); } } }
      else if (mCarry(F.src)) { have[F.src] = 1; q.push(F.src); }
      const par = new Int32Array(n).fill(-1);   // split horizon: a hot copy counts for t only if the feed did not reach its sender through t
      const via = (s, t) => { for (let g = 0; g < 64 && s >= 0; g++) { if (s === t) return true; s = par[s]; } return false; };
      for (let hh = 0; hh < q.length; hh++) {
        const s = q[hh];
        for (const [t, hot] of out[s]) {
          if (!mFlow(s, t)) continue;
          if (hot && lv.LG_ON && !X.lgEdgeOk(s, t, true, F.stadium)) continue;
          if (hot && !via(s, t)) hotOk[t] = 1;
          if (have[t]) continue;
          if (!hot) { const it = F.rx.get(t); if (it === undefined || !it.promoted) continue; if (lv.LG_ON && !X.lgEdgeOk(s, t, false, F.stadium)) continue; }
          have[t] = 1; par[t] = s; q.push(t);
        }
      }
      // the receivers' one-pipe watchdogs, and the gaps
      for (const [, t] of MCELL) {
        if (!mCarry(t)) continue; if (F.stadium ? false : t === F.src) continue;
        let r = F.rx.get(t); if (r === undefined) { r = newRx(); F.rx.set(t, r); }
        if (r.lastHot < 0) r.lastHot = TICK();
        if (hotOk[t]) { r.lastHot = TICK(); r.hotRun++; if (r.promoted && r.hotRun >= K.L2_PARK) r.promoted = false; }
        else { r.hotRun = 0; if (TICK() - r.lastHot >= K.L2_PROMOTE) r.promoted = true; }
        const measured = !F.stadium || seats[t].coord.pc === 0;   // a stadium mix is read where the stadium is composed
        if (!measured) continue;
        if (have[t]) r.cur = 0; else { r.cur++; if (r.cur > r.maxGap) r.maxGap = r.cur; }
      }
    }
  }
  // C++: mesh_media.inc:mediaSetup
  function mediaSetup() {
    MFEEDS.length = 0; mBuildCells();
    for (const x of MSTAGE) if (x >= 0 && x < lv.nextId && alive[x] && seats[x].hasCoord) { const f = newFeed(); f.src = x; MFEEDS.push(f); }
    const rs = new Set(); for (const [k] of MCELL) { const c = unckey(k); if (c.pc !== 0) rs.add(rowKeyOf(c)); }
    const rv = numSort([...rs]); for (const k of rv) { const f = newFeed(); f.stadium = true; f.row = k; MFEEDS.push(f); }
  }
  // C++: mesh_media.inc:mediaReset
  function mediaReset() { for (const F of MFEEDS) for (const [, e] of F.rx) { e.cur = 0; e.maxGap = 0; } }
  // C++: mesh_media.inc:mediaReport
  function mediaReport(skip) {
    const R = { stMax: 0, sdMax: 0, stAt: -1, sdAt: -1, stFeed: -1, stP50: 0, nSeats: 0 }; const per = [];
    const seatMax = new Map();
    for (const F of MFEEDS) for (const [id, e] of F.rx) {
      if (skip.has(id)) continue; const g = e.maxGap;
      if (F.stadium) { if (g > R.sdMax) { R.sdMax = g; R.sdAt = id; } }
      else { if (!seatMax.has(id)) seatMax.set(id, 0); if (g > seatMax.get(id)) seatMax.set(id, g); if (g > R.stMax) { R.stMax = g; R.stAt = id; R.stFeed = F.src; } }
    }
    for (const [, v] of seatMax) per.push(v); numSort(per); R.nSeats = per.length; if (per.length) R.stP50 = per[Math.trunc(per.length / 2)];
    return R;
  }

  // pcs per seat: the links the topology names (owned links occupied + the E2 links of its roles), and the open links of the link model
  // C++: mesh_media.inc:pcsReport
  function pcsReport() {
    mBuildCells(); const topoN = [], open = [];
    const peers = new Map(); const pe = (q) => { let s = peers.get(q); if (!s) { s = new Set(); peers.set(q, s); } return s; };
    for (const [, q] of MCELL) { const ol = ownedLinks(seats[q].coord); for (const c of ol) { const x = mAt(c); if (x >= 0 && x !== q) { pe(q).add(x); pe(x).add(q); } } }
    {
      const rs = new Set(); for (const [k] of MCELL) { const c = unckey(k); if (c.pc !== 0) rs.add(rowKeyOf(c)); }
      for (const k of rs) { const row = rowOfKey(k); const s = e2SrcOf(row, mOcc), b = s ? backupOwnerOf(row, mOcc) : null; if (s && b) { const a = mAt(s), z = mAt(b); if (a >= 0 && z >= 0 && a !== z) { pe(a).add(z); pe(z).add(a); } } }   // variant B's E3 is dialled only while E1 or E2 is down: not a standing pc
    }
    for (const [, q] of MCELL) {
      topoN.push(pe(q).size); let no = 0;
      if (lv.LINKMODEL) { const L_ = lk(); L_.lEnsure(q); for (const p of L_.LINKPEERS[q]) { const L = L_.linkFind(q, p); if (L && L.state === E.LK_OPEN) no++; } }
      open.push(no);
    }
    numSort(topoN); numSort(open);
    return [topoN.length ? topoN[Math.trunc(topoN.length / 2)] : 0, topoN.length ? topoN[topoN.length - 1] : 0, open.length ? open[Math.trunc(open.length / 2)] : 0, open.length ? open[open.length - 1] : 0];
  }

  // pcstrack (repro-join-burst): the busiest seat's open link-model pcs, read after every tick of `until`
  // C++: mesh_media.inc:PCS_PKT
  const PK = { n: [[0, 0, 0], [0, 0, 0]], seat: [[-1, -1, -1], [-1, -1, -1]], at: [[-1, -1, -1], [-1, -1, -1]], kind: [[[0, 0, 0], [0, 0, 0], [0, 0, 0]], [[0, 0, 0], [0, 0, 0], [0, 0, 0]]] };
  // C++: mesh_media.inc:pcsPeakReset
  function pcsPeakReset() { lv.PCS_PEAK = 0; lv.PCS_PEAK_AT = -1; lv.PCS_PEAK_SEAT = -1; for (let t = 0; t < 2; t++) for (let c = 0; c < 3; c++) { PK.n[t][c] = 0; PK.seat[t][c] = -1; PK.at[t][c] = -1; for (let k = 0; k < 3; k++) PK.kind[t][c][k] = 0; } }
  // C++: mesh_media.inc:pcsPeakRead
  function pcsPeakRead() {
    if (!lv.LINKMODEL) return; const L_ = lk(); const n = Math.min(lv.nextId, L_.LINKPEERS.length);
    for (let q = 0; q < n; q++) {
      if (!alive[q]) continue; let no = 0, kd = 0, kn = 0;
      for (const p of L_.LINKPEERS[q]) { const L = L_.linkFind(q, p); if (L && L.state === E.LK_OPEN) { no++; if (L_.l15Names(q, p) || L_.l15Names(p, q)) kn++; else if (L.outside) kd++; } }
      // (the C++ PCS_PEAK update sits inside the comment that ends this line, so it never runs: PCS_PEAK stays 0)
      const s = seats[q]; const t = (s.ctier === E.TIER_MOBILE) ? 1 : 0, c = (s.state === 3 && s.hasCoord) ? (s.coord.pc === 0 ? 0 : 1) : 2;
      if (no > PK.n[t][c]) { PK.n[t][c] = no; PK.seat[t][c] = q; PK.at[t][c] = TICK(); PK.kind[t][c][0] = kd; PK.kind[t][c][1] = kn; PK.kind[t][c][2] = no - kd - kn; }
    }
  }
  // C++: mesh_media.inc:PCS_PKT_KIND
  const pcsPeakClass = (t, c) => ({ n: PK.n[t][c], seat: PK.seat[t][c], at: PK.at[t][c], kind: PK.kind[t][c].slice() });

  // ---- feedcase: one leg-D run in the current (settled) room (see the C++ for the cases) -----------------------
  // C++: mesh_media.inc:mHash
  function mHash(s) { let h = lmix(U32(U32(lv.SEED0) ^ 0x9e37)); for (const ch of Buffer.from(s, 'latin1')) h = lmix(U32(h ^ ch)); return h; }
  // C++: mesh_media.inc:feedCase
  function feedCase(tk) {
    const cs = tk.length > 1 ? tk[1] : ''; const cut = tk.length > 2 ? atoll(tk[2]) : 90, after = tk.length > 3 ? atoll(tk[3]) : 200;
    mBuildCells();
    const rows = [];
    {
      const ix = new Map();
      for (const [k, q] of MCELL) { const c = unckey(k); if (c.pc === 0) continue; const rk = rowKeyOf(c); if (!ix.has(rk)) { ix.set(rk, rows.length); rows.push({ row: { pc: c.pc, r: c.r, i: 0 }, M: [], h: -1, heir: -1, src: -1, o: -1, b: -1, kids: false }); } rows[ix.get(rk)].M.push(q); }
      for (const r of rows) {
        numSort(r.M); r.h = mAt(r.row); let x;
        if ((x = heirOf(r.row, mOcc))) r.heir = mAt(x); if ((x = e2SrcOf(r.row, mOcc))) r.src = mAt(x); if ((x = ownerOf(r.row))) r.o = mAt(x); if ((x = backupOwnerOf(r.row, mOcc))) r.b = mAt(x);
        for (const q of r.M) if (mOcc(down(seats[q].coord))) r.kids = true;
      }
      rows.sort((a, b) => ckey(a.row) - ckey(b.row));
    }
    const s1 = []; for (const [k, q] of MCELL) if (unckey(k).pc === 0) s1.push(q); numSort(s1);
    const H = mHash(cs);
    const pickRow = (needHeir, wantKids, wantLone) => {
      const c1 = [], c2 = [], c3 = [];
      for (let i = 0; i < rows.length; i++) { const r = rows[i]; if (r.h < 0 || r.o < 0) continue; c3.push(i); if (needHeir && r.heir < 0) continue; if (wantLone && r.heir >= 0) continue; c2.push(i); if (wantKids && !r.kids) continue; c1.push(i); }
      const c = c1.length ? c1 : c2.length ? c2 : c3; if (!c.length) return -1; return c[U32(H) % c.length];
    };
    let stager = -1; const cuts = [], crashes = []; let note = '', R = null;
    if (cs === 'row') {
      const i = pickRow(true, false, false);
      if (i >= 0) { R = rows[i]; const nh = []; for (const q of R.M) if (q !== R.h) nh.push(q); if (nh.length >= 2) { stager = nh[0]; cuts.push([nh[0], nh[1]]); } else if (nh.length === 1) { stager = nh[0]; cuts.push([nh[0], R.h]); note = 'two-seat-row'; } }
    } else if (cs === 'e1' || cs === 'e1e2' || cs === 'e1up') {
      const i = pickRow(true, cs === 'e1up', false);
      if (i >= 0) {
        R = rows[i]; stager = (R.heir >= 0) ? R.heir : R.h; for (const q of R.M) if (q !== R.h) { stager = q; if (q !== R.heir) break; } cuts.push([R.h, R.o]);
        if (cs === 'e1e2' && R.src >= 0 && R.b >= 0) cuts.push([R.src, R.b]);
        if (cs === 'e1up') { const o = seats[R.o].coord; if (o.pc !== 0) { const pr = { pc: o.pc, r: o.r, i: 0 }; const ph = mAt(pr); const oo = ownerOf(pr); if (oo && ph >= 0 && mAt(oo) >= 0) cuts.push([ph, mAt(oo)]); else note = 'owner-row-in-s1'; } else note = 'owner-row-in-s1'; }
      }
    } else if (cs === 'stagerhead' || cs === 'headheir') {
      const i = pickRow(cs === 'headheir', false, cs === 'stagerhead');
      if (i >= 0) { R = rows[i]; stager = R.h; cuts.push([R.h, R.o]); if (R.heir < 0) note = 'lone-head'; if (cs === 'headheir' && R.heir >= 0) crashes.push(R.heir); }
    } else if (cs === 'e2') {
      const i = pickRow(true, false, false);
      if (i >= 0) { R = rows[i]; stager = R.M[R.M.length - 1]; if (R.src >= 0 && R.b >= 0) cuts.push([R.src, R.b]); else note = 'no-e2'; }
    } else if (cs === 'down' || cs === 'crashhead' || cs === 'crashheir') {
      const i = pickRow(cs !== 'crashhead', cs !== 'crashheir', false);
      if (i >= 0) {
        R = rows[i]; for (const q of s1) if (q !== R.o) { stager = q; break; }
        if (cs === 'down') cuts.push([R.o, R.h]); else if (cs === 'crashhead') crashes.push(R.h); else if (R.heir >= 0) crashes.push(R.heir); else note = 'no-heir';
      }
    } else if (cs === 'rook') {
      if (s1.length >= 2) { stager = s1[U32(H) % s1.length]; const c = seats[stager].coord; let b = mAt({ pc: 0, r: c.r, i: (c.i + 1) % C }); if (b < 0) b = mAt({ pc: 0, r: (c.r + 1) % C, i: c.i }); if (b >= 0) cuts.push([stager, b]); }
    } else { P('ERR feedcase: row e1 stagerhead e2 down rook crashhead crashheir e1e2 e1up headheir\n'); return; }
    if (stager < 0 || (cuts.length === 0 && crashes.length === 0)) { P('FEEDCASE case=%s N=%d seed=%u SKIP no-such-shape%s%s\n', cs, lv.N, lv.SEED0, note === '' ? '' : ' ', note); return; }
    // the stage: the stager plus up to four others (hashed), none of them a victim
    const victims = new Set(crashes); MSTAGE.length = 0; MSTAGE.push(stager);
    {
      const all = []; for (const [, q] of MCELL) if (!victims.has(q) && q !== stager) all.push(q); numSort(all);
      let h2 = lmix(U32(H ^ 0x5354)); for (let k = 0; k < 4 && all.length; k++) { h2 = lmix(h2); const j = U32(h2) % all.length; MSTAGE.push(all[j]); all.splice(j, 1); }
    }
    const [tP50, tMax, oP50, oMax] = pcsReport();
    mediaSetup(); lv.MEDIA = true; for (let k = 0; k < 30; k++) { fab.doTick(); w.TICK++; } mediaReset();
    lv.L2_TAKE_N = 0; lv.L2_TAKE_MAX = 0; lv.L2_TAKE_SUM = 0; const mv0 = lv.MOVES, ev0 = lv.EVICTIONS;
    // the uncut row links: every pair of row-mates now, minus the cut pairs and the victims; a tick in which such a pair, both still seated side by side, cannot carry counts
    const pairs = [];
    {
      const cp = new Set(); for (const c of cuts) cp.add(fab.pairKey(c[0], c[1]));
      const vrow = new Set(); for (const v of crashes) vrow.add(rowKeyOf(seats[v].coord));   // a crashed seat's row-mates hear nobody once their head is gone
      for (const r of rows) if (!vrow.has(rowKeyOf(r.row))) for (const a of r.M) for (const b of r.M) if (a < b && !cp.has(fab.pairKey(a, b)) && mFlow(a, b) && mFlow(b, a)) pairs.push([a, b]);
      for (const a of s1) for (const b of s1) if (a < b && seats[a].coord.r === seats[b].coord.r && !cp.has(fab.pairKey(a, b)) && !victims.has(a) && !victims.has(b) && mFlow(a, b) && mFlow(b, a)) pairs.push([a, b]);
    }
    const pcur = new Array(pairs.length).fill(0); let rowGap = 0, rgA = -1, rgB = -1;
    const pc0 = pairs.map((pr) => [ckey(seats[pr[0]].coord), ckey(seats[pr[1]].coord)]);
    const t0 = TICK();
    for (const c of cuts) fab.runOp(['sever', String(c[0]), String(c[1]), String(cut)]);
    for (const v of crashes) fab.runOp(['crash', String(v)]);
    for (let k = 0; k < cut + after; k++) {
      fab.doTick(); w.TICK++;
      for (let p = 0; p < pairs.length; p++) {
        const a = pairs[p][0], b = pairs[p][1];
        if (!mCarry(a) || !mCarry(b)) { pcur[p] = 0; continue; }
        if (ckey(seats[a].coord) !== pc0[p][0] || ckey(seats[b].coord) !== pc0[p][1]) { pcur[p] = 0; continue; }   // a pair a heal re-seated is a new pair, not an uncut link
        if (mFlow(a, b) && mFlow(b, a)) pcur[p] = 0; else { pcur[p]++; if (pcur[p] > rowGap) { rowGap = pcur[p]; rgA = a; rgB = b; } }
      }
    }
    const skip = new Set(); const all = mediaReport(skip);
    for (const c of cuts) { skip.add(c[0]); skip.add(c[1]); } const far = mediaReport(skip);
    const { seated } = fab.counts();
    P('FEEDCASE case=%s N=%d seed=%u l2=%d variant=%s stager=%d row=%s cuts=', cs, lv.N, lv.SEED0, 1, 'B', stager, R ? fab.coordStr(R.row) : '-');
    for (let i = 0; i < cuts.length; i++) P('%s%d-%d', i ? ',' : '', cuts[i][0], cuts[i][1]); if (!cuts.length) P('-');
    P(' crash='); for (let i = 0; i < crashes.length; i++) P('%s%d', i ? ',' : '', crashes[i]); if (!crashes.length) P('-');
    P(' stage_max=%lld stage_at=%d stage_feed=%d stage_p50=%lld stage_far=%lld stad_max=%lld rowlink_gap=%lld rowlink_pair=%d-%d takeovers=%lld takeover_max=%lld moves=%lld evict=%lld seated=%lld dups=%lld pcs_p50=%d pcs_max=%d open_p50=%d open_max=%d t=%lld%s%s\n',
      all.stMax, all.stAt, all.stFeed, all.stP50, far.stMax, all.sdMax, rowGap, rgA, rgB, lv.L2_TAKE_N, lv.L2_TAKE_MAX, lv.MOVES - mv0, lv.EVICTIONS - ev0, seated, lv.DUPS_G, tP50, tMax, oP50, oMax, TICK() - t0, note === '' ? '' : ' note=', note);
    lv.MEDIA = false;
  }

  // ---- mgap: every staying seat's media gap through a mass leave (see the C++ header) -------------------------
  // C++: mesh_media.inc:MGapSeat
  const newGap = () => ({ cur: 0, since: -1, runs: [] });   // runs: [first tick, length]
  let MGS = [];
  // C++: mesh_media.inc:mgapPaths
  function mgapPaths() {
    mBuildCells(); const n = lv.nextId; const reach = new Uint8Array(n);
    const adj = []; for (let q = 0; q < n; q++) adj.push([]);
    const add = (a, b) => { if (a < 0 || b < 0 || a === b) return; if (!(mFlow(a, b) && mFlow(b, a))) return; adj[a].push(b); adj[b].push(a); };
    const q = [];
    for (let s = 0; s < n; s++) {
      if (!mCarry(s)) continue; const ol = ownedLinks(seats[s].coord); for (const c of ol) add(s, mAt(c));
      if (seats[s].l14Up >= 0) add(s, seats[s].l14Up);   // L14: a branch head's temporary uplink carries its branch while it is open
      if (seats[s].coord.pc === 0) { reach[s] = 1; q.push(s); }
    }
    {
      const rs = new Set(); for (const [k] of MCELL) { const c = unckey(k); if (c.pc !== 0) rs.add(rowKeyOf(c)); }
      for (const k of rs) { const row = rowOfKey(k); const a = e2SrcOf(row, mOcc), b = a ? backupOwnerOf(row, mOcc) : null; if (a && b) add(mAt(a), mAt(b)); }
    }
    for (let h = 0; h < q.length; h++) for (const t of adj[q[h]]) if (!reach[t]) { reach[t] = 1; q.push(t); }
    return reach;
  }
  // C++: mesh_media.inc:mgapTick
  function mgapTick() {
    if (!lv.MGAP) return;
    const reach = mgapPaths(); while (MGS.length < lv.nextId) MGS.push(newGap());
    for (let s = 0; s < lv.nextId; s++) {
      if (!alive[s]) continue; const g = MGS[s];
      if (!reach[s]) { if (g.cur === 0) g.since = TICK(); g.cur++; }
      else if (g.cur > 0) { g.runs.push([g.since, g.cur]); g.cur = 0; }
    }
  }
  // C++: mesh_media.inc:mgapOn
  function mgapOn() {
    lv.MGAP = true; lv.MGAP_T0 = TICK(); MGS = []; for (let s = 0; s < lv.nextId; s++) MGS.push(newGap());
    const reach = mgapPaths(); lv.MGAP_PRE = 0; for (let s = 0; s < lv.nextId; s++) if (alive[s] && !reach[s]) lv.MGAP_PRE++;
  }
  // every staying seat whose time without a path is at least minTot: its cell, uplink, total, and runs (+start/len)
  // C++: mesh_media.inc:mgapSeats
  function mgapSeats(minTot) {
    for (let s = 0; s < lv.nextId && s < MGS.length; s++) {
      if (!alive[s]) continue; const g = MGS[s]; const rr = g.runs.slice(); if (g.cur > 0) rr.push([g.since, g.cur]);
      let tot = 0; for (const r of rr) tot += r[1]; if (tot < minTot) continue;
      P('MGAPSEAT id=%d coord=%s up=%d total=%lld runs=', s, seats[s].hasCoord ? fab.coordStr(seats[s].coord) : '-', seats[s].l14Up, tot); for (const r of rr) P('+%lld/%lld ', r[0] - lv.MGAP_T0, r[1]); P('\n');
    }
  }
  // C++: mesh_media.inc:mgapReport
  function mgapReport() {
    const pct = (v, p) => { if (!v.length) return 0; const n = v.length; let i = Math.trunc(p * n); if (i < p * n) i++; if (i < 1) i = 1; return v[i - 1]; };
    let stay = 0, gapSeats = 0, longSeat = -1, total = 0, longest = 0, nruns = 0; let perTot = [], perMax = []; const ev = new Map();   // std::map: walked in key order below
    const evAdd = (k, d) => ev.set(k, (ev.get(k) || 0) + d);
    for (let s = 0; s < lv.nextId && s < MGS.length; s++) {
      if (!alive[s] || X.mgapSkip(s)) continue; stay++; const g = MGS[s];
      const rr = g.runs.slice(); if (g.cur > 0) rr.push([g.since, g.cur]);
      if (!rr.length) continue; gapSeats++; let st = 0, mx = 0;
      for (const r of rr) { st += r[1]; if (r[1] > mx) mx = r[1]; evAdd(r[0], 1); evAdd(r[0] + r[1], -1); nruns++; }
      total += st; perTot.push(st); perMax.push(mx); if (mx > longest) { longest = mx; longSeat = s; }
    }
    let cur = 0, peak = 0, peakAt = -1; for (const k of numSort([...ev.keys()])) { cur += ev.get(k); if (cur > peak) { peak = cur; peakAt = k; } }
    numSort(perTot); numSort(perMax);
    const allTot = new Array(stay - gapSeats).fill(0).concat(perTot);   // every staying seat, the ones that never lost their path at 0
    P('MEDIAGAP ticks=%lld stay=%d pre=%d gapSeats=%d peak=%d peakAt=%s%lld longest=%lld longestSeat=%d total=%lld runs=%lld seatP50=%lld seatP90=%lld seatP99=%lld runP50=%lld runP90=%lld runP99=%lld stayP50=%lld stayP90=%lld stayP99=%lld stayMax=%lld\n',
      TICK() - lv.MGAP_T0, stay, lv.MGAP_PRE, gapSeats, peak, peakAt < 0 ? '' : '+', peakAt < 0 ? -1 : peakAt - lv.MGAP_T0, longest, longSeat, total, nruns, pct(perTot, 0.5), pct(perTot, 0.9), pct(perTot, 0.99), pct(perMax, 0.5), pct(perMax, 0.9), pct(perMax, 0.99), pct(allTot, 0.5), pct(allTot, 0.9), pct(allTot, 0.99), allTot.length ? allTot[allTot.length - 1] : 0);
  }

  const api = {
    mediaTick, mgapTick, mgapOn, mgapReport, mgapSeats, mediaSetup, mediaReset, mediaReport,
    mstage: () => MSTAGE, mstageClear: () => { MSTAGE.length = 0; }, mstagePush: (x) => { MSTAGE.push(x); }, mfeeds: () => MFEEDS,
    mBuildCells, mcell: () => MCELL, mAt, mOcc, mFlow, mCarry, mHash,
    pcsReport, pcsPeakRead, pcsPeakReset, pcsPeakClass, feedCase,
  };
  fab.plug(api);
  fab.media = api;
  return api;
}

module.exports = { installMedia };
