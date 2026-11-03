'use strict';
/*
 * tierfab.js: law L4 (I8), the fabric side (port plan H3): the tier a seat really has, its NAT kind from the
 * network group it sits in, the levers (tiermix, tier, tierhold, lie tier|nat, spawn mobile=F) and the
 * reports (tierstat, natstat, tierwatch, viewcheck, tiercells). Harness code, never shipped. A line-for-line
 * port of the sim's mesh_tierfab.inc, plus the three small tier readers it uses from mesh_link.inc
 * (lmix, lMobHash, tierMobile) so the unit stands alone.
 *
 *   require('./tierfab.js').install(fab)   plugs fabricMyTier / fabricMyNat / fabricLieFor / fabricNoteSwap,
 *                                          tierRefresh, tierLever(tk), tierLie(tk) into fab.X
 * Output goes through fab.printf (set by runop.js); the stderr diagnostics (TIERBAD, NATPAIRS) are kept.
 */
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const C_ = require(path.join(M, 'consts.js'));
const topo = require(path.join(M, 'topo.js'));
const hash = require(path.join(M, 'hash.js'));
const roles = require(path.join(M, 'roles.js'));
const { sprintf } = require('./cprintf.js');

const K = C_.consts, E = C_.enums;
const { ckey, unckey, ownedLinks, C } = topo;
const { TIER_DESKTOP, TIER_MOBILE, NAT_OPEN, NAT_STRICT, NAT_BLOCKED, GT_PUBLIC, GT_BLOCKED, GT_SYM } = E;
const atoi = (s) => (parseInt(s, 10) | 0) || 0;
const atof = (s) => { const v = parseFloat(s); return Number.isNaN(v) ? 0 : v; };
const atoll = (s) => { const v = parseInt(s, 10); return Number.isNaN(v) ? 0 : v; };
const errw = (s) => process.stderr.write(s);

function install(fab) {
  const lv = fab.lv, seats = fab.seats, alive = fab.alive, w = fab.w;
  const P = (f, ...a) => fab.printf(f, ...a);
  const TICK = () => w.TICK;
  const coordStr = fab.coordStr;
  const L4_NSWAP = [0, 0, 0, 0];   // swap orders, goes, exchanges, refusals+aborts
  const PENDLIE = new Map();       // `lie <id> ...` for a seat that has not arrived yet: applied when it first joins
  fab.TIEROVR = fab.TIEROVR || new Map();   // C++: mesh_link.inc:TIEROVR
  const TIEROVR = fab.TIEROVR;

  // C++: mesh_link.inc:lmix
  const lmix = (x) => hash.fmix32((x + 0x9e3779b9) >>> 0);
  // C++: mesh_link.inc:lMobHash
  const lMobHash = (id, f) => f > 0 && (lmix(hash.hmixId((((lv.SEED0 >>> 0) ^ 0x6d6f62) >>> 0), id) >>> 0) % 1000000) / 1e6 < f;
  // C++: mesh_link.inc:tierMobile
  const tierMobile = (id) => { const o = TIEROVR.get(id); if (o !== undefined) return o === TIER_MOBILE; return lMobHash(id, lv.TIERMIX); };

  const grpOf = (id) => (id >= 0 && id < fab.SEATGRP.length) ? fab.SEATGRP[id] : -1;   // C++: mesh_net.inc:grpOf

  // C++: mesh_tierfab.inc:fabricMyTier
  const fabricMyTier = (id) => (tierMobile(id) ? TIER_MOBILE : TIER_DESKTOP);
  // C++: mesh_tierfab.inc:fabricMyNat
  const fabricMyNat = (id) => {
    if (!lv.NETGRP) return NAT_OPEN;
    const g = grpOf(id); if (g < 0) return NAT_OPEN;
    const t = fab.NETG[g].type;
    return t === GT_SYM ? NAT_STRICT : t === GT_BLOCKED ? NAT_BLOCKED : NAT_OPEN;
  };
  // C++: mesh_tierfab.inc:fabricLieFor  (the out-parameters come back as [id, ct, cn])
  const fabricLieFor = (id, ct, cn) => {
    const p = PENDLIE.get(id); if (p === undefined) return [id, ct, cn];
    if (p.flipTier) ct = ct === TIER_MOBILE ? TIER_DESKTOP : TIER_MOBILE; else if (p.tier >= 0) ct = p.tier;
    if (p.flipNat) cn = cn === NAT_OPEN ? NAT_STRICT : NAT_OPEN; else if (p.nat >= 0) cn = p.nat;
    PENDLIE.delete(id);
    return [id, ct, cn];
  };
  // C++: mesh_tierfab.inc:fabricNoteSwap
  const fabricNoteSwap = (id, kind) => { if (kind >= 0 && kind < 4) L4_NSWAP[kind]++; };
  // C++: mesh_tierfab.inc:tierRefresh
  const tierRefresh = () => {
    let nat = false;
    if (lv.NETGRP) for (const g of fab.NETG) if (g.type !== GT_PUBLIC) nat = true;
    lv.TIERS_ACTIVE = lv.TIERMIX > 0 || TIEROVR.size > 0 || lv.L4_LIAR || nat || lv.LG_ON;
  };
  // C++: mesh_tierfab.inc:natKind
  const natKind = (id) => fabricMyNat(id);

  // the true cell -> seat map (oracle), seated seats only
  // C++: mesh_tierfab.inc:tierCells
  function tierCells() {
    const m = new Map();
    for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].hasCoord && seats[q].state === 3) m.set(ckey(seats[q].coord), q);
    return m;
  }

  // C++: mesh_tierfab.inc:tierStat
  function tierStat() {
    const cells = tierCells(); let mob = 0, seated = 0;
    for (const [, q] of cells) { seated++; if (tierMobile(q)) mob++; }
    const rowSet = new Map();   // std::set<pair<pc,r>>: ordered by pc, then r
    for (const [k] of cells) { const c = unckey(k); if (c.pc !== 0) rowSet.set(c.pc * 1000 + c.r, [c.pc, c.r]); }
    const rows = [...rowSet.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let nrows = 0, withD = 0, headBad = 0, heirNeed = 0, heirBad = 0, multi = 0;
    for (const r of rows) {
      const col = new Array(C); let cnt = 0, nd = 0;
      for (let j = 0; j < C; j++) { const q = cells.get(ckey({ pc: r[0], r: r[1], i: j })); col[j] = q === undefined ? -1 : q; if (col[j] >= 0) { cnt++; if (!tierMobile(col[j])) nd++; } }
      nrows++; if (cnt >= 2) multi++; if (nd === 0 || col[0] < 0) continue; withD++;
      const rowStr = () => { let o = ''; for (let j = 0; j < C; j++) o += (col[j] < 0 ? '-' : String(col[j]) + (tierMobile(col[j]) ? 'm' : 'D')) + ' '; return o; };
      if (tierMobile(col[0])) { headBad++; if (process.env.TIERBAD) errw(sprintf('TIERBAD head row=%u/%d %s\n', r[0], r[1], rowStr())); }
      let heir = -1; for (let j = 1; j < C; j++) if (col[j] >= 0) { heir = j; break; }
      const dOther = nd - (!tierMobile(col[0]) ? 1 : 0);
      if (heir >= 0 && dOther >= 1) { heirNeed++; if (tierMobile(col[heir])) { heirBad++; if (process.env.TIERBAD) errw(sprintf('TIERBAD heir row=%u/%d %s\n', r[0], r[1], rowStr())); } }
    }
    P('TIERSTAT seated=%lld mobile=%lld rows=%lld rowsMulti=%lld rowsWithDesktop=%lld headBad=%lld heirNeed=%lld heirBad=%lld swaps order=%lld go=%lld done=%lld refused=%lld evict=%lld rollbacks=%lld\n',
      seated, mob, nrows, multi, withD, headBad, heirNeed, heirBad, L4_NSWAP[0], L4_NSWAP[1], L4_NSWAP[2], L4_NSWAP[3], lv.EVICTIONS, lv.ROLLBACKS);
  }

  // required links the real tree holds (ownedLinksE of every seated seat, both ends present), and how many cannot form
  // C++: mesh_tierfab.inc:natStat
  function natStat() {
    const cells = tierCells(); const done = new Set(); let req = 0, unr = 0, ss = 0, bl = 0, oth = 0, dreq = 0, dss = 0, dunr = 0;
    const adj = new Map(); const byCls = [0, 0, 0, 0, 0, 0, 0];   // deep unreachable links by edge class: row col cross up down up2 down2
    const adjOf = (x) => { let v = adj.get(x); if (!v) { v = []; adj.set(x, v); } return v; };
    for (const [ek, s] of cells) {
      const c = unckey(ek); const { out: ol, cls } = roles.ownedLinksE(c, true);
      for (let k = 0; k < ol.length; k++) {
        const t = cells.get(ckey(ol[k])); if (t === undefined) continue; if (t === s) continue;
        const pk = fab.pairKey(s, t); if (done.has(pk)) continue; done.add(pk);
        const deep = c.pc !== 0 || ol[k].pc !== 0; const ok = fab.X.grpReach(s, t); req++; if (deep) dreq++;
        if (ok) { adjOf(s).push(t); adjOf(t).push(s); continue; }
        unr++;
        if (deep) { dunr++; byCls[cls[k]]++; if (process.env.NATPAIRS) errw(sprintf('NATPAIR %d@%s %d@%s cls=%d\n', s, coordStr(c), t, coordStr(ol[k]), cls[k])); }
        const a = natKind(s), b = natKind(t);
        if (a === NAT_STRICT && b === NAT_STRICT) { ss++; if (deep) dss++; } else if (a === NAT_BLOCKED || b === NAT_BLOCKED) bl++; else oth++;
      }
    }
    const seen = new Set(); const st = [];
    for (const [ek, q] of cells) if (unckey(ek).pc === 0) { seen.add(q); st.push(q); }
    while (st.length) { const x = st.pop(); for (const y of adjOf(x)) if (!seen.has(y)) { seen.add(y); st.push(y); } }
    let unreached = 0; for (const [, q] of cells) if (!seen.has(q)) unreached++;
    let strictSeats = 0, blockedSeats = 0;
    for (const [, q] of cells) { const k = natKind(q); if (k === NAT_STRICT) strictSeats++; else if (k === NAT_BLOCKED) blockedSeats++; }
    P('NATSTAT seated=%zu strict=%lld blocked=%lld required=%lld unreachable=%lld strictStrict=%lld blocked=%lld other=%lld deepRequired=%lld deepUnreachable=%lld deepStrictStrict=%lld noUpPath=%lld deepByClass=row:%lld,col:%lld,cross:%lld,up:%lld,down:%lld,up2:%lld,down2:%lld\n',
      cells.size, strictSeats, blockedSeats, req, unr, ss, bl, oth, dreq, dunr, dss, unreached, byCls[0], byCls[1], byCls[2], byCls[3], byCls[4], byCls[5], byCls[6]);
  }

  // tierwatch N: N ticks, counting after every one the cells held by more than one seat and the seats seated; then the requeues, rollbacks and reseats of the window
  // C++: mesh_tierfab.inc:tierWatch
  function tierWatch(n) {
    const e0 = lv.EVICTIONS, r0 = lv.ROLLBACKS, s0 = lv.RESEATS, sw0 = L4_NSWAP[2];
    let dmax = 0, seatMin = 2 ** 40, dsum = 0, deepSum = 0, deepMax = 0; const dcell = new Map();   // dcell: cell -> first tick two seats held it
    for (let q = 0; q < n; q++) {
      fab.doTick(); w.TICK++;
      const at = new Set(); let d = 0, sd = 0, dd = 0;
      for (let i = 0; i < lv.nextId; i++) if (alive[i] && seats[i].state === 3 && seats[i].hasCoord) {
        sd++; const ck = ckey(seats[i].coord);
        if (at.has(ck)) { d++; if (seats[i].coord.pc !== 0) dd++; const cs = coordStr(seats[i].coord); if (!dcell.has(cs)) dcell.set(cs, TICK()); } else at.add(ck);
      }
      dmax = Math.max(dmax, d); dsum += d; deepSum += dd; deepMax = Math.max(deepMax, dd); seatMin = Math.min(seatMin, sd);
    }
    let dl = ''; { let k = 0; for (const key of [...dcell.keys()].sort()) { if (k++ >= 12) break; if (dl) dl += ','; dl += key + '@' + dcell.get(key); } if (!dl) dl = '-'; }
    P('TIERWATCH ticks=%d deepDupsMax=%lld deepDupTicks=%lld dupsMax=%lld dupTicks=%lld seatedMin=%lld requeues=%lld rollbacks=%lld reseats=%lld swapsDone=%lld now=%lld dupcells=%s\n',
      n, deepMax, deepSum, dmax, dsum, seatMin, lv.EVICTIONS - e0, lv.ROLLBACKS - r0, lv.RESEATS - s0, L4_NSWAP[2] - sw0, TICK(), dl);
  }

  // viewcheck: after the room is quiet, does every seat's view of its owned links (row, owner, down-child) name the seat that really sits there?
  // C++: mesh_tierfab.inc:viewCheck
  function viewCheck() {
    const cells = tierCells(); let stale = 0, missing = 0, seats_ = 0, bad = 0;
    for (const [, q] of cells) {
      const s = seats[q]; const ol = ownedLinks(s.coord); const oc = s.ownerCoord(); const hasO = !!oc; let badSeat = false; seats_++;
      for (let k = 0; k <= ol.length; k++) {
        let c; if (k < ol.length) c = ol[k]; else { if (!hasO) break; c = oc; }
        const ck = ckey(c); const v = s.occGet(ck); const t = cells.get(ck); const truth = t === undefined ? -1 : t;
        if (truth >= 0 && v < 0) { missing++; badSeat = true; if (process.env.TIERBAD) errw(sprintf('VIEW missing seat %d@%s cell %s truth=%d\n', q, coordStr(s.coord), coordStr(c), truth)); }
        else if (v >= 0 && v !== truth) { stale++; badSeat = true; if (process.env.TIERBAD) errw(sprintf('VIEW stale seat %d@%s cell %s view=%d truth=%d\n', q, coordStr(s.coord), coordStr(c), v, truth)); }
      }
      if (badSeat) bad++;
    }
    P('VIEWCHECK seats=%lld seatsWithABadView=%lld stale=%lld missing=%lld\n', seats_, bad, stale, missing);
  }

  // the L4 levers; true if the op was one of them
  // C++: mesh_tierfab.inc:tierLever
  function tierLever(tk) {
    const op = tk[0];
    if (op === 'tiermix') { lv.TIERMIX = tk.length > 1 ? atof(tk[1]) : 0; tierRefresh(); P('OK tiermix %.2f\n', lv.TIERMIX); }
    else if (op === 'tier') {
      const id = tk.length > 1 ? atoi(tk[1]) : -1; const wd = tk.length > 2 ? tk[2] : '';
      if (id < 0 || id >= lv.nextId || !alive[id] || (wd !== 'mobile' && wd !== 'desktop')) { P('ERR usage: tier <live id> mobile|desktop\n'); return true; }
      const t = wd === 'mobile' ? TIER_MOBILE : TIER_DESKTOP; TIEROVR.set(id, t); const s = seats[id]; if (s.ctier === s.tier) s.ctier = t; s.tier = t; tierRefresh(); P('OK tier %d %s\n', id, wd);
    }
    else if (op === 'tierhold') {   // the gate's stand-in for a seat on stage or talking
      const id = tk.length > 1 ? atoi(tk[1]) : -1; const on = !(tk.length > 2 && tk[2] === '0');
      if (id < 0 || id >= lv.nextId || !alive[id]) { P('ERR usage: tierhold <live id> [0|1]\n'); return true; }
      seats[id].l4Hold = on; P('OK tierhold %d %d\n', id, on ? 1 : 0);
    }
    else if (op === 'tiercells') {   // every seated seat and its cell, for the gate's twin comparison
      let o = ''; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3 && seats[q].hasCoord) o += q + '=' + coordStr(seats[q].coord) + ' ';
      P('TIERCELLS %s\n', o);
    }
    else if (op === 'viewcheck') viewCheck();
    else if (op === 'tierstat') tierStat();
    else if (op === 'natstat') natStat();
    else if (op === 'tierwatch') tierWatch(tk.length > 1 ? atoi(tk[1]) : 100);
    else if (op === 'tierquiet') { lv.L4_QUIET = tk.length > 1 ? atoll(tk[1]) : lv.L4_QUIET; P('OK tierquiet=%lld\n', lv.L4_QUIET); }
    else if (op === 'tierperiod') { lv.L4_PERIOD = tk.length > 1 ? atoll(tk[1]) : lv.L4_PERIOD; P('OK tierperiod=%lld\n', lv.L4_PERIOD); }
    else if (op === 'tierlead') { lv.L4_LEAD = tk.length > 1 ? atoll(tk[1]) : lv.L4_LEAD; P('OK tierlead=%lld\n', lv.L4_LEAD); }
    else if (op === 'tierhops') { lv.L4_HOPS = tk.length > 1 ? atoi(tk[1]) : lv.L4_HOPS; P('OK tierhops=%d\n', lv.L4_HOPS); }
    else return false;
    return true;
  }

  // `lie <id> tier|nat [value]`: the seat's frames claim the other tier (or the named one / NAT kind); what it is stays what it is
  // C++: mesh_tierfab.inc:tierLie
  function tierLie(tk) {
    if (tk.length < 3 || (tk[2] !== 'tier' && tk[2] !== 'nat')) return false;
    const q = atoi(tk[1]);
    if (q >= lv.nextId) {
      let p = PENDLIE.get(q); if (!p) { p = { tier: -1, nat: -1, flipTier: false, flipNat: false }; PENDLIE.set(q, p); }
      const v0 = tk.length > 3 ? tk[3] : '';
      if (tk[2] === 'tier') { if (v0 === 'mobile') p.tier = TIER_MOBILE; else if (v0 === 'desktop') p.tier = TIER_DESKTOP; else p.flipTier = true; }
      else { if (v0 === 'strict') p.nat = NAT_STRICT; else if (v0 === 'blocked') p.nat = NAT_BLOCKED; else if (v0 === 'open') p.nat = NAT_OPEN; else p.flipNat = true; }
      lv.L4_LIAR = true; tierRefresh(); P('OK lie %d %s (when it arrives)\n', q, tk[2]); return true;
    }
    if (q < 0 || !alive[q]) { P('ERR lie: no such live seat %s\n', tk[1]); return true; }
    const s = seats[q]; const v = tk.length > 3 ? tk[3] : '';
    if (tk[2] === 'tier') s.ctier = v === 'mobile' ? TIER_MOBILE : v === 'desktop' ? TIER_DESKTOP : (s.tier === TIER_MOBILE ? TIER_DESKTOP : TIER_MOBILE);
    else s.cnat = v === 'strict' ? NAT_STRICT : v === 'blocked' ? NAT_BLOCKED : v === 'open' ? NAT_OPEN : (s.nat === NAT_OPEN ? NAT_STRICT : NAT_OPEN);
    lv.L4_LIAR = true; tierRefresh(); P('OK lie %d %s tier=%d/%d nat=%d/%d\n', q, tk[2], s.tier, s.ctier, s.nat, s.cnat); return true;
  }

  fab.plug({ fabricMyTier, fabricMyNat, fabricLieFor, fabricNoteSwap, tierRefresh, tierLever, tierLie, tierMobile, lMobHash, tierCells, natKind });
  return { L4_NSWAP, PENDLIE, lmix };
}

module.exports = { install };
