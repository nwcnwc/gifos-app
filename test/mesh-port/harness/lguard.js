'use strict';
/*
 * lguard.js: LAW L29, THE LOAD GUARD, the fabric side (port plan H3): a line-for-line port of the sim's
 * mesh_lguard.inc. Harness code, never shipped. The seat side (the ladder, the move ask, the complaints, the
 * agreement) is mesh_lguard_seat.inc, another job.
 *
 * lguardFabTick() runs once at the end of doTick, before mediaTick, outside every op; lgEdgeOk() is called from
 * mediaTick. Inert unless `lguard on` (LG_ON). The duties read the media model's cells (MCELL, the edges the
 * media model carries): that model (mesh_media.inc, a sim-only measurement) is not part of this port, so its
 * readers are externals on fab.X: mBuildCells, mcell (the MCELL map, ckey -> seat id), mAt, mOcc, mFlow, mCarry,
 * mHash, mediaSetup, mediaReset, mediaReport(skipSet), mstage (the MSTAGE array). Unplugged they throw "not wired".
 *
 * Levers (seat ids; `lguard on` before init): lguard on|off | throttle <id> <pct> <T> | stall <id> | budget <id> <u>
 *   | restore <id> | camoff <id> [0] | liar <id> <target> | rejoin <T> | reset | report | seats ; lgcase <leg> [run] [warm]
 */
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const C_ = require(path.join(M, 'consts.js'));
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));
const hash = require(path.join(M, 'hash.js'));
const roles = require(path.join(M, 'roles.js'));
const seatM = require(path.join(M, 'seat.js'));
const { Seat } = seatM;

const K = C_.consts, E = C_.enums;
const { ckey, unckey, down, C } = topo;
const { TIER_MOBILE, TIER_DESKTOP } = E;
const atoi = (s) => (parseInt(s, 10) | 0) || 0;
const atoll = (s) => { const v = parseInt(s, 10); return Number.isNaN(v) ? 0 : v; };
const lmix = (x) => hash.fmix32((x + 0x9e3779b9) >>> 0);   // C++: mesh_link.inc:lmix
const rowKeyOf = (c) => c.pc * 256 + c.r;                    // C++: mesh_media.inc:rowKeyOf

function install(fab) {
  const lv = fab.lv, seats = fab.seats, alive = fab.alive, w = fab.w;
  const P = (f, ...a) => fab.printf(f, ...a);
  const X = fab.X;
  const coordStr = fab.coordStr;
  const L = {
    LG_IMP: new Map(),        // std::map<int,LgImp>: iterated in key order
    LG_CAMOFF: new Set(),
    LG_FAILV: [], LG_LOADNOW: [], LG_BUDNOW: [], LG_WOKE: [], LG_WOKE_PREV: [],
    LG_SC: new Map(),         // failing seat -> receiver -> starve ticks
    LG_LEFT: new Map(), LG_REJOINQ: [], LG_REBORN: new Map(),   // LG_REJOINQ: a multimap<tick,id>, kept in key order
    LG_RUN: [], LG_RUNMAX: [],
  };
  const newImp = () => ({ mode: 0, pct: 100, units: 0, t0: 0, over: 1 });   // C++: mesh_lguard.inc:LgImp (mode 1 throttle, 2 stall, 3 budget)
  const TICK = () => w.TICK;

  // C++: mesh_lguard.inc:lgHarmed
  const lgHarmed = (x) => { const it = L.LG_IMP.get(x); return it !== undefined && it.mode !== 3; };   // a throttled or stalled device (a fixed `budget` is a healthy seat's size)
  // C++: mesh_lguard.inc:lgFails
  const lgFails = (s) => s >= 0 && s < L.LG_FAILV.length && !!L.LG_FAILV[s];
  // C++: mesh_lguard.inc:lgBudOf
  function lgBudOf(x) {
    const base = seats[x].tier === TIER_MOBILE ? K.L29_BUD_M : K.L29_BUD_D;
    const m = L.LG_IMP.get(x); if (m === undefined) return base;
    if (m.mode === 2) return 0; if (m.mode === 3) return m.units;
    let dt = TICK() - m.t0; if (dt < 0) dt = 0; if (dt > m.over) dt = m.over;
    const pct = 100 - Math.trunc((100 - m.pct) * dt / Math.max(1, m.over));
    return Math.trunc(base * pct / 100);
  }
  const grow = () => {
    while (L.LG_WOKE.length < lv.nextId) { L.LG_WOKE.push(new Set()); L.LG_WOKE_PREV.push(new Set()); }
  };
  // C++: mesh_lguard.inc:lgEdgeOk
  function lgEdgeOk(s, t, hot, stad) {
    if (!lv.LG_ON) return true;
    if (lgFails(s)) return false;   // the harm holds with the law off too
    if (L.LG_WOKE.length < lv.nextId) { grow(); while (L.LG_LOADNOW.length < lv.nextId) { L.LG_LOADNOW.push(0); L.LG_BUDNOW.push(0); } }
    const lvl = lv.LG_ON ? seats[s].lgLvl : 0;
    if (hot) return !(stad && lvl >= 2);   // level 2: no low-priority forward
    if (lvl >= 1) return false;            // level 1: no parked copy, none woken
    if (L.LG_WOKE[s].has(t)) return true;
    if (L.LG_WOKE_PREV[s].has(t) || !lv.LG_ON) { L.LG_WOKE[s].add(t); return true; }
    if ((L.LG_LOADNOW[s] + K.L29_HOT) * 100 > L.LG_BUDNOW[s] * K.L29_SHED) { lv.LG_WAKEREF++; return false; }   // L29.2: only what fits, with the headroom kept
    L.LG_LOADNOW[s] += K.L29_HOT; L.LG_WOKE[s].add(t); return true;
  }
  // C++: mesh_lguard.inc:lgDuties
  function lgDuties() {
    const D = []; for (let i = 0; i < lv.nextId; i++) D.push({ own: 0, fwd: 0, park: 0, rx: [] });
    X.mBuildCells(); const MCELL = X.mcell();
    for (const [ek, x] of MCELL) {
      const c = unckey(ek); const d = D[x];
      if (c.pc === 0) {
        for (let j = 0; j < C; j++) {
          if (j !== c.i) { const t = X.mAt({ pc: 0, r: c.r, i: j }); if (t >= 0) d.rx.push(t); }
          if (j !== c.r) { const t = X.mAt({ pc: 0, r: j, i: c.i }); if (t >= 0) d.rx.push(t); }
        }
        d.fwd += d.rx.length;
      } else {
        for (let j = 0; j < C; j++) if (j !== c.i) { const t = X.mAt({ pc: c.pc, r: c.r, i: j }); if (t >= 0) d.rx.push(t); }
        if (c.i === 0) { d.fwd += d.rx.length; const o = roles.ownerOf({ pc: c.pc, r: c.r, i: 0 }); if (o && X.mOcc(o)) d.fwd++; }
      }
      d.own = L.LG_CAMOFF.has(x) ? 0 : d.rx.length;
      const dn = down(c); if (dn.pc > c.pc && X.mOcc(dn)) d.fwd++;
    }
    const rs = new Set(); for (const [ek] of MCELL) { const c = unckey(ek); if (c.pc !== 0) rs.add(rowKeyOf(c)); }
    const rv = [...rs].sort((a, b) => a - b);
    for (const k of rv) {
      const row = { pc: Math.floor(k / 256), r: k % 256, i: 0 };
      const sc = roles.e2SrcOf(row, X.mOcc); const bc = roles.backupOwnerOf(row, X.mOcc);
      if (!sc || !bc) continue;
      const s = X.mAt(sc), b = X.mAt(bc); if (s < 0 || b < 0 || s === b) continue;
      D[s].park += 1 + D[s].rx.length; D[b].park += 1;
    }
    return D;
  }
  // C++: mesh_lguard.inc:lgRejoinSpawn
  function lgRejoinSpawn(old) {
    const id = lv.nextId++; fab.TIEROVR.set(id, seats[old].tier); X.tierRefresh();
    while (seats.length <= id) { seats.push(null); alive.push(0); }
    seats[id] = new Seat(id, w); alive[id] = 1; X.netNoteSpawn(id); seats[id].join(); lv.N++; L.LG_REBORN.set(old, id);
    fab.trace('LG-REJOIN', id, null, 'was=%d', old);
  }
  // C++: mesh_lguard.inc:lguardFabTick
  function lguardFabTick() {
    grow();
    for (let q = 0; q < lv.nextId; q++) { const t = L.LG_WOKE_PREV[q]; L.LG_WOKE_PREV[q] = L.LG_WOKE[q]; L.LG_WOKE[q] = t; L.LG_WOKE[q].clear(); }   // LG_WOKE_PREV[q].swap(LG_WOKE[q]); clear
    const D = lgDuties();
    L.LG_FAILV = new Array(lv.nextId).fill(0); L.LG_LOADNOW = new Array(lv.nextId).fill(0); L.LG_BUDNOW = new Array(lv.nextId).fill(0);
    if (lv.LG_MEAS && L.LG_RUN.length < lv.nextId) { while (L.LG_RUN.length < lv.nextId) { L.LG_RUN.push(0); L.LG_RUNMAX.push(0); } }
    const on = lv.LG_ON;
    for (let x = 0; x < lv.nextId; x++) {
      if (!alive[x] || !seats[x]) continue; const s = seats[x];
      const d = D[x]; const woke = L.LG_WOKE_PREV[x].size;
      const l2 = d.own * K.L29_HOT + d.fwd, l1 = l2 + d.fwd, l0 = l1 + d.park * K.L29_PARK + woke * K.L29_HOT;
      const bud = lgBudOf(x), full = s.tier === TIER_MOBILE ? K.L29_BUD_M : K.L29_BUD_D;
      s.lgLd[0] = l0; s.lgLd[1] = l1; s.lgLd[2] = l2; s.lgBud = bud; s.lgBud0 = full; s.lgOwn = d.own * K.L29_HOT;
      if (on) s.lgLadder();   // the seat's own reflex, on its own reading (L29.1)
      const lvl = on ? s.lgLvl : 0; const load = lvl === 0 ? l0 : lvl === 1 ? l1 : l2;
      L.LG_LOADNOW[x] = load; L.LG_BUDNOW[x] = bud;
      const fail = X.mCarry(x) && load > bud; L.LG_FAILV[x] = fail ? 1 : 0;
      if (lv.LG_MEAS && X.mCarry(x) && !lgHarmed(x)) {
        if (fail) lv.LG_HOVER++;
        if (bud > 0) { const pct = Math.trunc(load * 100 / bud); if (pct > lv.LG_NBRPCT) { lv.LG_NBRPCT = pct; lv.LG_NBRPCT_AT = x; } }
      }
      if (lv.LG_MEAS && woke > lv.LG_WOKEMAX) lv.LG_WOKEMAX = woke;
    }
    // the inbound watch (and the own-feed gaps of the measured window)
    const starve = (x, t, hold) => { const m = msg.newMsg('LGSTARVE'); m.id = x; m.to = t; m.from = -1; m.hold = hold; fab.busPush(TICK() + 1, m); };
    for (let x = 0; x < lv.nextId; x++) {
      if (!alive[x] || !seats[x]) continue; const fx = !!L.LG_FAILV[x] && D[x].own > 0; let starvedAny = false;
      const sit = L.LG_SC.get(x);
      if (fx) {
        let sc = L.LG_SC.get(x); if (!sc) { sc = new Map(); L.LG_SC.set(x, sc); } const seen = new Set();
        for (const t of D[x].rx) {
          seen.add(t);
          if (X.mFlow(x, t)) { starvedAny = true; const c = (sc.get(t) || 0) + 1; sc.set(t, c); if (c === K.L29_STARVE && on) starve(x, t, 1); }
          else { const it = sc.get(t); if (it !== undefined) { if (it >= K.L29_STARVE && on) starve(x, t, 0); sc.delete(t); } }
        }
        for (const [t, c] of [...sc]) { if (seen.has(t)) continue; if (c >= K.L29_STARVE && on) starve(x, t, 0); sc.delete(t); }
      } else if (sit !== undefined) {
        const ts = []; for (const [t, c] of sit) if (c >= K.L29_STARVE) ts.push(t); ts.sort((a, b) => a - b);
        if (on) for (const t of ts) starve(x, t, 0);
        L.LG_SC.delete(x);
      }
      if (lv.LG_MEAS && x < L.LG_RUN.length) { if (starvedAny) { L.LG_RUN[x]++; if (L.LG_RUN[x] > L.LG_RUNMAX[x]) L.LG_RUNMAX[x] = L.LG_RUN[x]; } else L.LG_RUN[x] = 0; }
    }
    // L29.4: the seats whose receivers agreed, and whose own device agreed, leave (the page shows the reason)
    for (let x = 0; x < lv.nextId; x++) {
      if (!alive[x] || !seats[x] || !seats[x].lgQuit) continue;
      L.LG_LEFT.set(x, TICK()); fab.trace('LG-LEFT', x, seats[x].hasCoord ? seats[x].coord : null, 'reason=device-overload');
      seats[x].leave(); lv.N--;
      if (lv.LG_REJOIN >= 0) { const key = TICK() + lv.LG_REJOIN; let i = L.LG_REJOINQ.length; while (i > 0 && L.LG_REJOINQ[i - 1][0] > key) i--; L.LG_REJOINQ.splice(i, 0, [key, x]); }   // multimap::insert: after equal keys
    }
    while (L.LG_REJOINQ.length && L.LG_REJOINQ[0][0] <= TICK()) { const old = L.LG_REJOINQ[0][1]; L.LG_REJOINQ.shift(); lgRejoinSpawn(old); }
  }
  // C++: mesh_lguard.inc:lgMeasReset
  function lgMeasReset() {
    lv.LG_MEAS = true; lv.LG_T0 = TICK(); L.LG_RUN = new Array(lv.nextId).fill(0); L.LG_RUNMAX = new Array(lv.nextId).fill(0);
    lv.LG_HOVER = lv.LG_WAKEREF = lv.LG_WOKEMAX = 0; lv.LG_NBRPCT = 0; lv.LG_NBRPCT_AT = -1;
  }
  // C++: mesh_lguard.inc:lgSum
  const lgSum = (f) => { let n = 0; for (let q = 0; q < lv.nextId; q++) if (seats[q]) n += seats[q][f]; return n; };
  // C++: mesh_lguard.inc:lgLine
  function lgLine() {
    let impRun = 0, othRun = 0, othAt = -1;
    for (let q = 0; q < L.LG_RUNMAX.length; q++) { if (lgHarmed(q) || L.LG_CAMOFF.has(q)) impRun = Math.max(impRun, L.LG_RUNMAX[q]); else if (L.LG_RUNMAX[q] > othRun) { othRun = L.LG_RUNMAX[q]; othAt = q; } }
    let leftH = 0; for (const [k] of L.LG_LEFT) if (!lgHarmed(k)) leftH++;
    return fab.sprintf('left=%zu leftHealthy=%d ownImp=%lld ownOther=%lld ownOtherAt=%d hover=%lld nbrPct=%d nbrPctAt=%d wakeRefused=%lld wokeMax=%lld complaints=%lld refuted=%lld',
      L.LG_LEFT.size, leftH, impRun, othRun, othAt, lv.LG_HOVER, lv.LG_NBRPCT, lv.LG_NBRPCT_AT, lv.LG_WAKEREF, lv.LG_WOKEMAX, lgSum('lgCompN'), lgSum('lgFalseQ'));
  }

  // ---- lgcase: one gate case in the current (settled) room ---------------------------------------------------------
  // C++: mesh_lguard.inc:lgCase
  function lgCase(tk) {
    const leg = tk.length > 1 ? tk[1] : 'throttle'; const run = tk.length > 2 ? atoll(tk[2]) : 600, warm = tk.length > 3 ? atoll(tk[3]) : 30;
    X.mBuildCells(); const MCELL = X.mcell(); const H = X.mHash('lg:' + leg) >>> 0;
    const rows = []; {
      const ix = new Map();
      for (const [ek, q] of MCELL) {
        const c = unckey(ek); if (c.pc === 0) continue; const k = rowKeyOf(c);
        if (!ix.has(k)) { ix.set(k, rows.length); rows.push({ row: { pc: c.pc, r: c.r, i: 0 }, M: [], h: -1, src: -1, kids: false, light: 0 }); }
        rows[ix.get(k)].M.push(q);
      }
      for (const r of rows) {
        r.M.sort((a, b) => a - b); r.h = X.mAt(r.row); const x = roles.e2SrcOf(r.row, X.mOcc); if (x) r.src = X.mAt(x);
        for (const q of r.M) { const c = seats[q].coord; if (X.mOcc(down(c))) { if (q === r.h) r.kids = true; } else if (q !== r.h && q !== r.src) r.light++; }
      }
    }
    let phonePct = 20;
    const pickPhone = () => {   // any deep phone in a row of three or more
      let best = -1, bestL = -1;
      for (const r of rows) {
        if (r.h < 0 || r.M.length < 3) continue; const leaf = (r.M.length - 1) * K.L29_HOT;
        for (const q of r.M) {
          if (seats[q].tier !== TIER_MOBILE) continue; const c = seats[q].coord; const duty = q === r.h || q === r.src || X.mOcc(down(c));
          let mate = false; for (const z of r.M) { if (z === q || z === r.h || z === r.src) continue; if (!X.mOcc(down(seats[z].coord))) mate = true; }
          const l2 = seats[q].lgLd[2]; const score = (duty && mate ? 1000 : 0) + l2;   // a phone in a duty cell with a light mate to trade with first, then the one that carries most
          if (score > bestL || (score === bestL && ((H >>> 4) % 2))) { bestL = score; best = q; phonePct = Math.trunc(((leaf + 1) * 100 + K.L29_BUD_M - 1) / K.L29_BUD_M); }
        }
      }
      return best;
    };
    const pick = (head) => {
      const c1 = [], c2 = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]; if (r.h < 0) continue;
        if (head) { if (seats[r.h].tier !== TIER_DESKTOP || r.M.length < 3 || r.light < 1) continue; c2.push(i); if (r.kids) c1.push(i); }
        else { if (r.M.length < 3) continue; c1.push(i); }
      }
      const c = c1.length ? c1 : c2; if (!c.length) return -1; return c[H % c.length];
    };
    let X_ = -1, liar = -1, ri = -1;
    if (leg === 'liar') { ri = pick(false); if (ri >= 0) { const nh = []; for (const q of rows[ri].M) if (q !== rows[ri].h) nh.push(q); X_ = nh[(H >>> 8) % nh.length]; for (const q of rows[ri].M) if (q !== X_) { liar = q; break; } } }
    else if (leg === 'phone') { X_ = pickPhone(); if (X_ >= 0) { const rk = rowKeyOf(seats[X_].coord); for (let i = 0; i < rows.length; i++) if (rowKeyOf(rows[i].row) === rk) ri = i; } }
    else if (leg !== 'quiet') { ri = pick(true); if (ri >= 0) X_ = rows[ri].h; }
    let shape = X_ >= 0 ? 'deep' : '-';
    if (X_ < 0 && (leg === 'stall' || leg === 'camoff' || leg === 'liar')) {   // a room with no such deep row (N=26: Section 1 and one deep seat): the same leg on a Section-1 seat, which has no exchange
      const s1 = []; for (const [ek, q] of MCELL) if (unckey(ek).pc === 0 && seats[q].tier === TIER_DESKTOP) s1.push(q);
      s1.sort((a, b) => a - b);
      if (s1.length) {
        X_ = s1[H % s1.length]; shape = 's1';
        if (leg === 'liar') { const c = seats[X_].coord; let b = X.mAt({ pc: 0, r: c.r, i: (c.i + 1) % C }); if (b < 0) b = X.mAt({ pc: 0, r: (c.r + 1) % C, i: c.i }); liar = b; if (liar < 0) X_ = -1; }
      }
    }
    if (leg !== 'quiet' && X_ < 0) { P('LGCASE leg=%s N=%d seed=%u SKIP no-such-shape\n', leg, lv.N, lv.SEED0); return; }
    const R0 = ri >= 0 ? rows[ri] : { row: { pc: 0, r: 0, i: 0 }, M: [], h: -1, src: -1, kids: false, light: 0 };
    // the stage: a mate of the row, a Section-1 seat, three hashed; never X or the liar
    const MSTAGE = X.mstage(); MSTAGE.length = 0; {
      let all = []; for (const [, q] of MCELL) if (q !== X_ && q !== liar) all.push(q);
      all.sort((a, b) => a - b);
      if (ri >= 0) for (const q of R0.M) if (q !== X_ && q !== liar && q !== R0.h) { MSTAGE.push(q); break; }
      for (const q of all) if (seats[q].coord.pc === 0 && !MSTAGE.includes(q)) { MSTAGE.push(q); break; }
      let h2 = lmix((H ^ 0x5354) >>> 0);
      while (MSTAGE.length < 5 && all.length) { h2 = lmix(h2); const j = h2 % all.length; if (!MSTAGE.includes(all[j])) MSTAGE.push(all[j]); all.splice(j, 1); }
    }
    X.mediaSetup(); lv.MEDIA = true; for (let k = 0; k < warm; k++) { fab.doTick(); w.TICK++; } X.mediaReset(); lgMeasReset();
    const mv0 = lv.MOVES, ev0 = lv.EVICTIONS, t0 = TICK(); const ck0 = X_ >= 0 ? ckey(seats[X_].coord) : 0; const cell0 = X_ >= 0 ? coordStr(seats[X_].coord) : '-';
    const src = (ri >= 0 && R0.src !== X_) ? R0.src : -1; let srcBud = -1;
    if (leg === 'throttle' || leg === 'phone') { const m = newImp(); m.mode = 1; m.pct = leg === 'phone' ? phonePct : 15; m.t0 = TICK(); m.over = 400; L.LG_IMP.set(X_, m); }
    else if (leg === 'stall' || leg === 'nbr' || leg === 'camoff') {
      const m = newImp(); m.mode = 2; m.t0 = TICK(); L.LG_IMP.set(X_, m); if (leg === 'camoff') L.LG_CAMOFF.add(X_);
      if (leg === 'nbr' && src >= 0) { srcBud = Math.trunc(((L.LG_LOADNOW[src] + K.L29_HOT) * 100 + K.L29_SHED - 1) / K.L29_SHED); const b = newImp(); b.mode = 3; b.units = srcBud; L.LG_IMP.set(src, b); }
    }
    else if (leg === 'liar') { seats[liar].lgLiarT = X_; }
    let firstShed = -1, firstLight = -1, movedAt = -1, shedMax = 0, srcFailT = 0, srcShedT = 0, srcDrag = 0, srcLv = 0;
    for (let k = 0; k < run; k++) {
      fab.doTick(); w.TICK++;
      if (X_ >= 0 && alive[X_]) {
        const s = seats[X_];
        if (s.lgLvl > 0 && firstShed < 0) firstShed = TICK() - t0; if (s.lgLvl > shedMax) shedMax = s.lgLvl; if (s.lgLight && firstLight < 0) firstLight = TICK() - t0;
        if (movedAt < 0 && s.hasCoord && ckey(s.coord) !== ck0) movedAt = TICK() - t0;
      }
      if (src >= 0 && lgFails(src)) srcFailT++;
      if (src >= 0 && src < lv.nextId && alive[src]) {
        const q = seats[src]; if (q.lgLvl > 0) srcShedT++;
        const woke = L.LG_WOKE_PREV[src].size;
        if (srcLv === 0 && q.lgLvl > 0 && woke > 0 && (q.lgLd[0] - woke * K.L29_HOT) * 100 <= q.lgBud * K.L29_SHED) srcDrag++;   // it shed because of the copies it woke for others: dragged down
        srcLv = q.lgLvl;
      }
    }
    const skip = new Set(); if (X_ >= 0) skip.add(X_); const all = X.mediaReport(skip);
    const { seated } = fab.counts();
    const xAlive = X_ >= 0 && !!alive[X_];
    const leftAt = (X_ >= 0 && L.LG_LEFT.has(X_)) ? L.LG_LEFT.get(X_) - t0 : -1;
    let reborn = -1, rebornSeated = false; if (X_ >= 0 && L.LG_REBORN.has(X_)) { reborn = L.LG_REBORN.get(X_); rebornSeated = !!alive[reborn] && seats[reborn].state === 3; }
    P('LGCASE leg=%s N=%d seed=%u law=%d shape=%s X=%d tier=%s liar=%d cell0=%s cell=%s alive=%d leftAt=%lld shedAt=%lld shedMax=%d lightAt=%lld movedAt=%lld src=%d srcBud=%d srcFail=%d srcShed=%d srcDrag=%d stage_max=%lld stage_at=%d stad_max=%lld %s reborn=%d rebornSeated=%d moves=%lld evict=%lld seated=%lld dups=%lld t=%lld\n',
      leg, lv.N, lv.SEED0, lv.LG_ON ? 1 : 0, shape, X_, X_ >= 0 ? (seats[X_].tier === TIER_MOBILE ? 'mobile' : 'desktop') : '-', liar, cell0, xAlive && seats[X_].hasCoord ? coordStr(seats[X_].coord) : '-', xAlive ? 1 : 0, leftAt, firstShed, shedMax, firstLight, movedAt, src, srcBud, srcFailT, srcShedT, srcDrag,
      all.stMax, all.stAt, all.sdMax, lgLine(), reborn, rebornSeated ? 1 : 0, lv.MOVES - mv0, lv.EVICTIONS - ev0, seated, lv.DUPS_G, TICK() - t0);
    lv.MEDIA = false; lv.LG_MEAS = false;
  }

  // C++: mesh_lguard.inc:lguardLever
  function lguardLever(tk) {
    if (tk[0] === 'lgcase') {
      if (!lv.LG_ON && !(tk.length > 1 && tk[1] === 'quiet')) { P('ERR lgcase needs `lguard on` before init (only the quiet leg runs without it: the media baseline)\n'); return; }
      lgCase(tk); return;
    }
    const wd = tk.length > 1 ? tk[1] : ''; const q = tk.length > 2 ? atoi(tk[2]) : -1;
    const live = (x) => x >= 0 && x < lv.nextId && alive[x] && seats[x];
    if (wd === 'on' || wd === 'off') { lv.LG_ON = (wd === 'on'); X.tierRefresh(); P('OK lguard %s law=%d\n', wd, lv.LG_ON ? 1 : 0); return; }
    if (wd === 'throttle' && live(q)) { const m = newImp(); m.mode = 1; m.pct = tk.length > 3 ? atoi(tk[3]) : 20; m.over = tk.length > 4 ? Math.max(1, atoll(tk[4])) : 300; m.t0 = TICK(); L.LG_IMP.set(q, m); P('OK lguard throttle %d to %d%% over %lld\n', q, m.pct, m.over); return; }
    if (wd === 'stall' && live(q)) { const m = newImp(); m.mode = 2; m.t0 = TICK(); L.LG_IMP.set(q, m); P('OK lguard stall %d\n', q); return; }
    if (wd === 'budget' && live(q)) { const m = newImp(); m.mode = 3; m.units = tk.length > 3 ? atoi(tk[3]) : 0; L.LG_IMP.set(q, m); P('OK lguard budget %d %d\n', q, m.units); return; }
    if (wd === 'restore' && live(q)) { L.LG_IMP.delete(q); P('OK lguard restore %d\n', q); return; }
    if (wd === 'camoff' && live(q)) { const off = !(tk.length > 3 && tk[3] === '0'); if (off) L.LG_CAMOFF.add(q); else L.LG_CAMOFF.delete(q); P('OK lguard camoff %d %d\n', q, off ? 1 : 0); return; }
    if (wd === 'liar' && live(q)) { const t = tk.length > 3 ? atoi(tk[3]) : -1; seats[q].lgLiarT = t; P('OK lguard liar %d %d\n', q, t); return; }
    if (wd === 'rejoin') { lv.LG_REJOIN = tk.length > 2 ? atoll(tk[2]) : -1; P('OK lguard rejoin %lld\n', lv.LG_REJOIN); return; }
    if (wd === 'reset') { lgMeasReset(); P('OK lguard reset\n'); return; }
    if (wd === 'report') { P('LGUARD tick=%lld law=%d impaired=%zu %s\n', TICK(), lv.LG_ON ? 1 : 0, L.LG_IMP.size, lgLine()); return; }
    if (wd === 'seats') {
      for (const x of [...L.LG_IMP.keys()].sort((a, b) => a - b)) {
        const e = L.LG_IMP.get(x); const s = seats[x];
        P('LGSEAT id=%d mode=%d alive=%d cell=%s level=%d light=%d load=%d/%d/%d budget=%d fail=%d left=%lld\n', x, e.mode, alive[x], s.hasCoord ? coordStr(s.coord) : '-', s.lgLvl, s.lgLight ? 1 : 0, s.lgLd[0], s.lgLd[1], s.lgLd[2], s.lgBud, lgFails(x) ? 1 : 0, L.LG_LEFT.has(x) ? L.LG_LEFT.get(x) : -1);
      }
      return;
    }
    P('ERR usage: lguard on|off | throttle <id> <pct> <T> | stall <id> | budget <id> <u> | restore <id> | camoff <id> [0] | liar <id> <target> | rejoin <T> | reset | report | seats ; lgcase <leg> [run] [warm]\n');
  }

  fab.plug({ lguardLever, lguardFabTick, lgEdgeOk });
  return { lguardLever, lguardFabTick, lgEdgeOk, lgDuties, lgBudOf, state: L };
}

module.exports = { install };
