#!/usr/bin/env node
'use strict';
// fabric-check.js <driver binary> <work dir> [cases] [first seed]
// Differential check of harness/fabric.js against the sim's own fabric. For each seed it makes a random script
// (fabric-gen below), runs it through the C++ driver (l0/fabric-driver.cpp: mesh.cpp included whole) and through
// fabric.js with the real JS seats, and compares, byte for byte:
//   - the driver's counters line after every op (the random streams, SEQ, L10SEQ, bus size, relay list, ...)
//   - frames.jsonl (every push on the bus, with its due tick and SEQ)
//   - hash.jsonl (the per-tick seat state hashes)
//   - the --trace file
// Exit 1 on the first difference.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { createFabric } = require('./fabric.js');
const linknet = require('./linknet.js');
const hashM = require(path.join(__dirname, '..', '..', '..', 'js', 'mesh', 'hash.js'));
const { ins } = require(path.join(__dirname, '..', '..', '..', 'js', 'mesh', 'util.js'));
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const { Seat } = require(path.join(M, 'seat.js'));
require(path.join(M, 'ring.js'));   // the real islandStandM (and its netgSize hook) before any stand-in
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));

// ---- stand-ins for the island unit (S9) until it lands: with no island lever a seat sees no merge --------------------
// (C++: mesh_ring.inc:islandStandM, mergeCalc). The check never sets the island lever, so these are the sim's answers.
const { FREE } = require(path.join(M, 'seat.js'));
if (!('mergeCalc' in Seat.prototype)) Seat.unit('fabric-check stand-in', { mergeCalc() { return false; } });
// (C++: mesh_linkset.inc:linkRole; l2Peer and l4Peer are false for check seats: they hold no E2 or L4 state)
if (!('linkRole' in Seat.prototype)) Seat.unit('fabric-check stand-in 2', {
  linkRole(x, want) {
    if ((want & 1) && this.hasCoord) { for (const c of topo.ownedLinks(this.coord)) if (this.occGet(topo.ckey(c)) === x) return true; }
    if ((want & 8) && this.l14Up >= 0 && this.l14Up === x) return true;
    if ((want & 16) && this.hasCoord) { const o = this.ownerCoord(); if (o && this.occGet(topo.ckey(o)) === x) return true; }
    return false;
  },
  // C++: mesh_farview.inc:Seat::farStampNeed / farStamp
  farStampNeed(m) { return m.aId < 0 && !m.routing && !m.direct && m.fhTo < 0; },
  farStamp(m) {
    m.aId = this.id; m.aCk = (this.hasCoord && this.state === 3) ? topo.ckey(this.coord) + 1 : 0;
    if (!m.aCk && this.gateway >= 0 && m.sgw < 0) { m.sgw = this.gateway; const it = this.farCk.get(this.gateway); m.sgwCk = it !== undefined ? it.ck : 0; }
    else if (m.t === 'FIND' && m.nc >= 0 && m.nc !== this.id && m.sgw < 0) { const g = this.farGw.get(m.nc); if (g !== undefined) { m.sgw = g.gw; m.sgwCk = g.gck; } }
  },
  // C++: mesh_roomterm.inc:Seat::islandSeen
  islandSeen() { return this.islandFounder || this.lineFork || this.cutAt >= 0 || this.cutHeardAt >= 0 || this.mergeCalc(); },
  // C++: mesh_seat.inc:Seat::ownedLinkCell
  ownedLinkCell(k) { if (!this.hasCoord) return false; for (const c of topo.ownedLinks(this.coord)) if (topo.ckey(c) === k) return true; return false; },
  // A frozen seat's held frames are dropped by the check (ftick) before the thaw: no check seat runs recv.
  recv() { throw new Error('fabric-check: Seat.recv is not ported (a held frame reached a thaw)'); },
});
if (!FREE.islandStandM) Seat.free({ islandStandM: (merge, law) => (law === 0 || law === 1 || law === 4 || law === 5) ? merge : false });


// ---- stand-ins for callees that belong to other sim files (until their units land) --------------------------------------
// Each is a line-for-line port of the C++ named, valid for the check's seats (no rival, beside, keep, fhop or island state).
function plugStandIns(fab, ln) {
  const { lv, seats, alive } = fab; const L = ln.link; const K = fab.K, E = fab.E;
  const TICK = () => fab.w.TICK; const nextId = () => lv.nextId;
  // C++: mesh_linkset_fab.inc:linkWhy (first=true) / l22Need
  const l22Need = (me, x) => {
    if (me < 0 || me >= nextId() || !alive[me]) return true;
    const s = seats[me];
    if (s.state !== 3 || !s.hasCoord || s.moving) return true;
    if (s.TICK - s.seatedAt < K.L22_SEATED_SETTLE) return true;
    if (L.l23RealRole(me, x)) return true;
    if (L.l23Suspect(me, x)) return false;   // (keepHeld: the check seats hold no keep)
    if (s.l14Serve(x)) return true;
    if (s.callBook.inReason(x, s.TICK)) return true;
    if (s.callBook.outReason(x, s.TICK)) return true;
    return false;
  };
  // C++: mesh_gaps_fab.inc:l374Note / l374Resend
  const L374_W = 5, L374F = new Map();
  const l374Note = (from, to, m) => {
    if (m.t !== 'FIND') return;
    if (L374F.size > 4096) { for (const [k, v] of L374F) if (v.length === 0 || TICK() - v[v.length - 1][0] > L374_W) L374F.delete(k); }
    const v = ins(L374F, hashM.idPair(from, to), () => []);
    while (v.length && TICK() - v[0][0] > L374_W) v.shift();
    if (v.length < 8) v.push([TICK(), msg.clone(m)]);
  };
  const l374Resend = (e, x, Lk) => {
    if (e < 0 || x < 0 || e >= nextId() || x >= nextId() || !alive[e] || !alive[x]) return;
    const key = hashM.idPair(e, x); const it = L374F.get(key); if (it === undefined) return;
    const q = []; for (const p of it) if (TICK() - p[0] <= L374_W) q.push(p[1]); L374F.delete(key);
    if (q.length === 0) return;
    fab.trace('L37.4-RESEND', e, null, 'peer=%d n=%zu state=%d', x, q.length, Lk.state);
    for (const f of q) {
      const g = msg.clone(f); g.from = e; g.to = x;
      if (Lk.state === E.LK_OPEN) { if (Lk.agreed[L.lEnd(e, x)]) { if (Lk.hold[L.lEnd(e, x)].length < K.LINK_QCAP) Lk.hold[L.lEnd(e, x)].push(g); } else if (!(Lk.half & (1 << L.lEnd(e, x)))) L.linkDeliver(e, x, g, Lk); continue; }
      if (Lk.state !== E.LK_DIALING) { Lk.callClosed = false; L.startDial(e, x, Lk); Lk.dialHow = 3; }
      if (Lk.q.length < K.LINK_QCAP) Lk.q.push(g);
    }
  };
  // C++: mesh_rcfollow_fab.inc:l1611Guard
  const l1611Guard = (a, b, Lk) => {
    for (const x of [a, b]) {
      if (x < 0 || x >= nextId() || !alive[x]) continue;
      const v = seats[x]; if (!(v.hasCoord && v.state === 3 && v.coord.pc === 0)) continue;
      const h = L.l1610Held(x); let n = h.n;
      { const Lx = L.linkFind(a, b); if (Lx === Lk && (Lk.state === E.LK_OPEN || Lk.state === E.LK_DIALING || Lk.view[L.lEnd(x, x === a ? b : a)] === E.LK_OPEN)) n--; }
      if (n + 1 <= L.pcBudget(x, E.PB_S1)) continue;
      L.lEnsure(x);
      let best = null, bestK = -1, bestRank = -1, bestIdle = -1;
      for (const p of L.LINKPEERS[x]) {
        if (p === a || p === b) continue; const D = L.linkFind(x, p); if (!D || !D.outside || D.outside === 3 || (D.state !== E.LK_OPEN && D.state !== E.LK_DIALING)) continue;
        if (!(D.outside & (1 << L.lEnd(p, x)))) continue;
        if (L.l15Names(x, p)) continue;
        const rank = L.doorHeard(D, x, p) ? 1 : 0; const idle = TICK() - D.dProg;
        if (rank > bestRank || (rank === bestRank && (idle > bestIdle || (idle === bestIdle && p < bestK)))) { best = D; bestK = p; bestRank = rank; bestIdle = idle; }
      }
      if (!best) continue;
      lv.L1611_SHED++; fab.trace('L16.11-SHED', x, null, 'peer=%d for=%d pcs=%d sat=%d idle=%lld', bestK, x === a ? b : a, n, bestRank, bestIdle);
      L.l16Close(best, x, bestK); L.LDOORS.delete(fab.pairKey(x, bestK));
    }
  };
  // C++: mesh.cpp:l18Route up to the L18.1 gate; past it the check has no seat code, so it stops there.
  const l18Route = (from, to) => {
    if (from < 0 || to < 0 || from >= nextId() || to >= nextId()) return false;
    const a = seats[from], b = seats[to];
    if (a.state !== 3 || !a.hasCoord || b.state !== 3 || !b.hasCoord) return false;
    if (topo.ckey(a.coord) === topo.ckey(b.coord)) return false;
    if (!!a.linkRole(to, E.LR_TOPO) || a.callBook.outFresh(to, a.TICK) || fab.X.fabricLinkState(from, to) === E.LS_OPEN) return false;   // (l22Beside: no l22Cell in check seats)
    if (!(a.dials.pathFailedWithin(to, K.L18_HOLD, a.TICK))) { lv.L18_SKIPDIRECT++; return false; }
    if (a.l13Mass()) { lv.L18_SKIPMASS++; return false; }   // (fhopFriendFor: friend-hop is off under this check)
    // C++: mesh.cpp:l18Cell, then l18Hop (seat routing: not in the check). A seat that names the target in a valid cell would route.
    const cellOk = (k) => { const c = topo.unckey(k); if (c.r >= topo.C || c.i >= topo.C) return false; let pc = c.pc >>> 0, d = 0; while (pc) { if ((pc - 1) % 6 >= topo.C) return false; pc = Math.floor((pc - 1) / 6); if (++d > 12) return false; } return true; };
    let found = false;
    for (const [k, x] of a.occ) if (x === to && cellOk(k)) found = true;
    for (const [k, x] of a.cousins) if (x === to && cellOk(k)) found = true;
    for (const e of a.roster) if (e.v === to && cellOk(e.k)) found = true;
    if (!found) return false;
    throw new Error('fabric-check: l18Route past l18Cell (l18Hop) is not in the stand-in');
  };
  fab.plug({ l22Need, l374Note, l374Resend, l1611Guard, l18Route });
}

// the hash of the whole link table: the same fields, in the same order, as fabric-driver.cpp linkHash
function linkHashJs(fab) {
  const L = fab.link, lv = fab.lv; const hh = (h, v) => { h = hashM.hmix(h, v >>> 0); return hashM.hmix(h, Math.floor(v / 4294967296) >>> 0); };
  let h = 2166136261;
  for (const [pk, k] of L.LINKS) {
    h = hh(h, pk);
    for (const v of [k.state, k.view[0], k.view[1], k.half, +k.stuck, +k.leverHalf, +k.wasOpen, +k.carried, k.epoch, k.openEp, k.dialAt, k.halfAt, k.askAt, k.txAt[0], k.txAt[1], k.nnAt[0], k.nnAt[1], k.nnAsk[0], k.nnAsk[1], k.arrAt[0], k.arrAt[1], k.q.length, k.outside, k.dialBy, +k.callClosed, k.gone, +k.agreed[0], +k.agreed[1], k.hold[0].length, k.hold[1].length, k.closingAt[0], k.closingAt[1], k.farAsk[0], k.farAsk[1], +k.uplink, k.dHeard, k.backAt[0], k.backAt[1], k.dBorn, k.dProg, +k.dAsked, +k.dHomed, +k.dGw, +k.dIn, +k.dSat, k.dHoAt, k.dWait, +k.dOwed, k.dWaitAtFind, k.dOwedAt]) h = hh(h, v);
  }
  for (const v of L.DOORN) h = hh(h, v); h = hh(h, -7); for (const v of L.DOORK) h = hh(h, v);
  for (const v of [L.LDOORS.size, L.LEVQ.size, L.LPENDCLOSE.length, L.TLDEB.size, L.L16COOL.size, L.DOOR_PEND.length, fab.FROZEN.size, fab.SLOW.size, fab.RESUMEQ.size, fab.RELOADQ.size, fab.RELCLOSEQ.size]) h = hh(h, v);
  for (const t of [...L.LEVQ.keys()].sort((x, y) => x - y)) { h = hh(h, t); for (const v of L.LEVQ.get(t)) { h = hh(h, v.kind); h = hh(h, v.a); h = hh(h, v.b); h = hh(h, v.epoch); for (const ch of v.why) h = hh(h, ch.charCodeAt(0)); h = hh(h, v.ref); } }
  for (const [k, v] of fab.sockCloseAt) { h = hh(h, k); h = hh(h, v); }
  return h >>> 0;
}
function countersJs(fab) {
  const lv = fab.lv, S = fab.link.LSTAT;
  return [lv.L16_BUSY, lv.L16_DROP, lv.L16_DEFERRED, lv.L16_PENDDROP, lv.L16_BYE, lv.L16_HANDED, lv.L16_UNN, lv.L16_IDLEC, lv.L16_LIFEC, lv.L16_GWC, lv.L16_BACKOFF, lv.L16_DOORPEAK, lv.L16_ANSPEAK, lv.L15_CLOSED, lv.L22_CLOSED, lv.L23_CLOSED, lv.L23_REFUSED, lv.CLOSEDROPS, lv.ERASEDROPS, lv.L14_REFUSED,
    S[0], S[1], S[2], S[3], S[4], S[5], S[6], S[7], lv.RELAY_KNOCKS, lv.RELAY_SIGNAL, lv.RELAY_NONDOOR, lv.RELAY_REFUSED, lv.RELAY_CUTS, lv.NET_DROPS, lv.KNOCK_PEAK, lv.VALL, lv.VFALSE, lv.VFROZEN, lv.N, lv.L18_NODIAL, lv.DOORDARK].join(',');
}

// ---- the script generator --------------------------------------------------------------------------------------
function genScript(seed) {
  let s = (seed * 2654435761 + 12345) >>> 0;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (a) => a[ri(0, a.length - 1)];
  const L = [];
  L.push('lever SEED0 ' + ri(1, 1e9));
  const jm = pick(['window', 'window', 'burst', 'batch', 'serial']);
  L.push('lever JOINMODE ' + jm);
  if (jm === 'batch') { L.push('lever JM_A ' + ri(1, 5)); L.push('lever JM_B ' + ri(1, 4)); }
  if (jm === 'serial') L.push('lever JM_A ' + ri(1, 3));
  if (jm === 'window' && r() < 0.4) L.push('lever JM_A ' + ri(3, 40));
  const cond = r() < 0.6;
  if (cond) {
    L.push('lever NUM_SUBNETS ' + ri(1, 4)); L.push('lever NET_LOSS ' + pick([0, 0, 0.1, 0.3])); L.push('lever NET_LAT ' + ri(1, 6));
    L.push('lever NET_SEVER ' + pick([0, 0, 0.05, 0.2])); L.push('lever NET_QUAL_MIN ' + pick([1, 0.5, 0.75])); L.push('lever REACH_DENSITY ' + pick([0.3, 0.7, 1]));
    L.push('lever NET_SPINE ' + ri(0, 1));
  }
  const N = ri(4, 40);
  L.push('init ' + N + ' 0');
  const manual = r() < 0.5;   // seats made by hand all knock with one key, so the relay's list grows and its shuffle is drawn
  if (manual) for (let q = 0; q < N; q++) L.push('mk ' + q); else L.push('spawnall');
  const coord = new Map();   // id -> [pc,r,i] for seats given a coordinate
  let t = 30;
  const ids = () => ri(0, N - 1);
  const noCoord = (a, b) => !coord.has(a) || !coord.has(b);
  for (let k = 0; k < 120; k++) {
    if (r() < 0.25) { t += ri(1, 40); L.push('tick ' + t); }
    const x = r();
    if (x < 0.12) { const id = ids(); if (!coord.has(id)) { const c = [ri(0, 40), ri(0, 4), ri(0, 4)]; coord.set(id, c); L.push('setc ' + id + ' ' + pick([2, 3, 3, 3]) + ' ' + c.join(' ')); } }
    else if (x < 0.20 && coord.size) { const id = pick([...coord.keys()]); const c = coord.get(id); L.push('occ ' + id + ' ' + c[0] + ' ' + c[1] + ' ' + ri(0, 4) + ' ' + ids()); }
    else if (x < 0.50) {
      const a = ids(), b = ids(); const mt = pick(['PHONE', 'PONG', 'HELLO', 'FIND', 'PLACE', 'WHOHOME', 'S1SYNC', 'UNNEEDED']);
      const f = []; if (r() < 0.3) f.push('rvia=' + pick([-1, 3])); if (r() < 0.2) f.push('l10E=1'); if (r() < 0.2) f.push('dgOnly=1'); if (r() < 0.3) f.push('sigAt=' + ri(0, 50), 'id=' + a); if (r() < 0.3) f.push('pp=' + a, 'ppAt=' + ri(0, 50)); if (r() < 0.3) f.push('tag=' + ri(0, 3));
      if (r() < 0.2) f.push('nc=' + ids());
      const cls = noCoord(a, b) ? pick([-1, 0, 1, 2]) : pick([0, 1, 2]);
      L.push(['sched', a, b, mt, cls, ...f].join(' '));
    }
    else if (x < 0.58) { const a = ids(), b = ids(); L.push('send ' + a + ' ' + b + ' ' + pick(['PHONE', 'PONG']) + ' ' + pick(['l10E=1', 'dgOnly=1'])); }
    else if (x < 0.64) { const a = ids(), b = ids(); if (noCoord(a, b)) L.push('send ' + a + ' ' + b + ' HELLO routing=1'); }
    else if (x < 0.76) L.push('knock ' + ids() + ' ' + (manual && r() < 0.9 ? 12345 : ri(0, 1e9)) + ' ' + (r() < 0.8 ? 1 : 0));
    else if (x < 0.80) L.push('force ' + ids() + ' ' + ids() + ' ' + (t + ri(0, 60)));
    else if (x < 0.83) L.push('sever ' + ids() + ' ' + ids() + ' ' + (t + ri(0, 60)));
    else if (x < 0.86) { L.push('cut ' + ids() + ' ' + ri(0, 1)); L.push('part ' + ri(0, 1)); }
    else if (x < 0.88) L.push('dark ' + ids());
    else if (x < 0.90) L.push('lose ' + pick([3, 5]) + ' ' + ids());
    else if (x < 0.91) L.push('doordark ' + (t + ri(-5, 30)));
    else if (x < 0.94) L.push('crash ' + ids());
    else if (x < 0.95) L.push('silent ' + pick([0.05, 0.2]));
    else if (x < 0.97) L.push('counts');
    else if (x < 0.985) L.push('coord ' + ri(0, 1e6) + ' ' + ri(0, 4) + ' ' + ri(0, 4));
    else if (x < 0.995) { const a = ids(), b = ids(); L.push('linkopen ' + a + ' ' + b); }
    else L.push('end');
  }
  L.push('end');
  return L.join('\n') + '\n';
}


// ---- the link / time / net script (H2) --------------------------------------------------------------------------------
// linkmodel on; frozen, slow and hidden seats; clock offsets; reachability groups; levers that cut, half-open and
// re-open links. Seats sit on Section-1 cells with their owned-link neighbours named, so roles, doors and budgets run.
const MTS = ['PHONE', 'HELLO', 'CLAIM', 'WHOHOME', 'HOME', 'FIND', 'FINDACK', 'PLACE', 'NOROOM', 'HANDOFF', 'TAKEOVER', 'TAKEN', 'UNNEEDED', 'MEET', 'MEETACK', 'WALK', 'YIELD', 'LEAVE', 'PONG', 'S1SYNC', 'U2BEAT'];
function genLinkScript(seed) {
  let s = (seed * 2246822519 + 3266489917) >>> 0;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (a) => a[ri(0, a.length - 1)];
  const L = [];
  L.push('lever SEED0 ' + ri(1, 1e9));
  L.push('lever JOINMODE ' + pick(['window', 'burst']));
  L.push('lever LINKMODEL 1');
  L.push('lever ROUTE_ENFORCE 0');   // the topology route (L18) is seat code: not under this check
  if (r() < 0.4) L.push('lever LMOBILE ' + pick([0.3, 0.6]));
  if (r() < 0.3) L.push('lever TIERMIX ' + pick([0.3, 0.5]));
  if (r() < 0.5) L.push('lever CLK_OFF ' + pick([5, 50, 300]));
  if (r() < 0.2) L.push('lever NET_SKEW ' + pick([2, 6]));
  if (r() < 0.4) {
    L.push('lever NUM_SUBNETS ' + ri(1, 3)); L.push('lever NET_LOSS ' + pick([0, 0.1])); L.push('lever NET_LAT ' + ri(1, 4));
    L.push('lever NET_SEVER ' + pick([0, 0.05])); L.push('lever NET_QUAL_MIN ' + pick([1, 0.6])); L.push('lever REACH_DENSITY ' + pick([0.5, 1]));
  }
  let N = ri(6, 30); const groups = r() < 0.4;
  let gnames = [];
  if (groups) {
    const kinds = ['public', 'symmetric', 'blocked']; const n = ri(2, 3); const ws = [];
    for (let g = 0; g < n; g++) { const sz = ri(3, 9); gnames.push('G' + g); ws.push('G' + g + ':' + pick(kinds) + ':' + sz + (r() < 0.2 ? ':iso' : '')); }
    L.push('lev netgroups ' + ws.join(' ') + (r() < 0.5 ? ' arrival=' + pick(['grouped', 'random']) : ''));
    N = ws.reduce((a, w) => a + Number(w.split(':')[2]), 0);
  }
  L.push('init ' + N + ' 0');
  const manual = r() < 0.5;
  if (manual) for (let q = 0; q < N; q++) L.push('mk ' + q); else L.push('spawnall');
  // Section-1 cells: seat q on (0, r, i); the occupants of its owned-link cells are named in its view
  const cells = []; for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) cells.push([a, b]);
  for (let k = cells.length - 1; k > 0; k--) { const j = ri(0, k); const t = cells[k]; cells[k] = cells[j]; cells[j] = t; }
  const where = new Map(), at = new Map();   // id -> [pc,r,i]; cell key -> id
  const seated = [];
  for (let q = 0; q < N; q++) {
    if (r() < 0.2) continue;
    const c = r() < 0.85 ? [0, ...cells[q % 25]] : [ri(1, 3), ri(0, 4), ri(0, 4)];
    if (at.has(c.join())) continue;
    where.set(q, c); at.set(c.join(), q); L.push('setc ' + q + ' ' + pick([3, 3, 3, 2]) + ' ' + c.join(' ')); L.push('seatf ' + q + ' seatedAt ' + pick([0, -50, -50])); seated.push(q);
  }
  for (const q of seated) for (const oc of topo.ownedLinks({ pc: where.get(q)[0], r: where.get(q)[1], i: where.get(q)[2] })) { const o = at.get([oc.pc, oc.r, oc.i].join()); if (o !== undefined && o !== q && r() < 0.9) L.push('occ ' + q + ' ' + oc.pc + ' ' + oc.r + ' ' + oc.i + ' ' + o); }
  for (let q = 0; q < N; q++) { if (r() < 0.15) L.push('seatf ' + q + ' ctier ' + ri(0, 1)); if (r() < 0.1) L.push('seatf ' + q + ' l30 1'); if (r() < 0.05) L.push('seatf ' + q + ' evilDoor 1'); if (r() < 0.05) L.push('seatf ' + q + ' hostile ' + pick([0, 1, 8])); if (r() < 0.1) L.push('tier ' + q + ' ' + ri(0, 1)); }
  let t = 20; L.push('ftick ' + t);
  const ids = () => ri(0, N - 1);
  const two = () => { const a = ids(); let b = ids(); if (b === a) b = (a + 1) % N; return [a, b]; };
  const adv = () => { const n = pick([1, 1, 1, 2, 4, 9, 30]); for (let k = 0; k < n; k++) { t += 1; L.push('ftick ' + t); } };
  for (let k = 0; k < 160; k++) {
    if (r() < 0.45) adv();
    const x = r();
    if (x < 0.20) {   // a frame over the link model
      const [a, b] = two(); const mt = pick(MTS); const f = [];
      if (r() < 0.3) f.push('tag=' + pick([1, 3, 4])); if (r() < 0.2) f.push('rvia=' + pick([-1, 2])); if (r() < 0.2) f.push('gwc=1'); if (r() < 0.2) f.push('knock=1');
      if ((mt === 'HELLO' || mt === 'CLAIM') && r() < 0.8) { const c = where.get(b); if (c) { const ol = topo.ownedLinks({ pc: c[0], r: c[1], i: c[2] }); if (ol.length) f.push('ck=' + topo.ckey(pick(ol))); } }
      const kind = pick(['sched', 'sched', 'send', 'callframe']);
      if (kind === 'sched') L.push(['sched', a, b, mt, pick([0, 1, 2]), ...f].join(' ')); else if (kind === 'send') L.push(['send', a, b, mt, ...f].join(' ')); else L.push(['callframe', a, b, mt, ...f].join(' '));
    }
    else if (x < 0.27) { const [a, b] = two(); L.push(pick(['dial', 'dialjoin', 'uplink']) + ' ' + a + ' ' + b); }
    else if (x < 0.29) { const [a, b] = two(); if (!where.has(a) || where.get(a)[0] === 0) L.push('uptake ' + a + ' ' + b); }
    else if (x < 0.31) { const [a, b] = two(); L.push('updecline ' + a + ' ' + b + ' ' + ids() + ' ' + ids()); }
    else if (x < 0.36) { const [a, b] = two(); L.push(pick(['doordrop', 'doorhanded', 'nosock']) + ' ' + a + ' ' + b); }
    else if (x < 0.38) { const [a, b] = two(); L.push('doorheard ' + a + ' ' + b + ' ' + ri(1, 6)); }
    else if (x < 0.46) { const [a, b] = two(); const w = pick(['half', 'half', 'close', 'open']); L.push('lev link ' + a + ' ' + b + ' ' + w + (w === 'half' ? pick(['', ' ' + a, ' ' + b, ' fail', ' stuck']) : w === 'close' ? pick(['', ' fail']) : '')); }
    else if (x < 0.49) L.push('lev radio ' + ids() + ' ' + ri(5, 60));
    else if (x < 0.54) L.push('lev freeze ' + ids() + ' ' + ri(3, 60) + ' ' + pick([0, 0, 40]));
    else if (x < 0.57) L.push('lev tickslow ' + ids() + ' ' + ri(1, 4) + ' ' + pick([-1, 30]));
    else if (x < 0.60) L.push('lev hide ' + ids() + ' ' + ri(10, 80) + ' ' + pick([3, 24]));
    else if (x < 0.62) L.push('lev ' + pick(['reloadnew', 'resume']) + ' ' + ids() + ' ' + ri(1, 6));
    else if (x < 0.64) L.push('lev verdicts ' + pick(['on', 'off', 'reset']));
    else if (x < 0.70 && groups) { const a = pick(gnames), b = pick(gnames); L.push(pick(['lev netcut ' + a + ' ' + b, 'lev netlift ' + a + ' ' + b, 'lev netmove ' + ids() + ' ' + a, 'lev netjoin ' + a + ' ' + ri(1, 2)])); }
    else if (x < 0.73) { const [a, b] = two(); L.push('lsever ' + a + ' ' + b + ' ' + ri(5, 80)); }
    else if (x < 0.72) L.push('ldark ' + ids());
    else if (x < 0.74) L.push(pick(['kill', 'left', 'reloadbye', 'crash']) + ' ' + ids());
    else if (x < 0.82) { const [a, b] = two(); L.push('l22 ' + pick(['note', 'agree', 'closeask', 'close', 'quiet', 'release']) + ' ' + a + ' ' + b); }
    else if (x < 0.85) L.push('lev doordark ' + ri(0, 30));
    else if (x < 0.93) { const [a, b] = two(); L.push(pick(['lstate', 'lopenfor', 'l23busy']) + ' ' + a + ' ' + b); L.push('mydoors ' + a); }
    else if (x < 0.95) { const [a, b] = two(); L.push('closedrop ' + pick(MTS) + ' lk=' + a + ' to=' + b); }
    else if (x < 0.97) L.push('knock ' + ids() + ' ' + (manual ? 12345 : ri(0, 1e9)) + ' ' + (r() < 0.8 ? 1 : 0));
    else L.push('end');
  }
  for (let k = 0; k < 12; k++) { t += pick([1, 5, 20, 60]); L.push('ftick ' + t); }
  L.push('end');
  return L.join('\n') + '\n';
}

// ---- the JS twin of the driver -----------------------------------------------------------------------------------
function setMsgField(m, w) { const e = w.indexOf('='); const k = w.slice(0, e), v = Number(w.slice(e + 1)); m[k] = (k === 'gwc' || k === 'knock' || k === 'mv' || k === 'l10E' || k === 'dgOnly' || k === 'direct' || k === 'routing') ? !!v : v; }
function runJs(script, dir) {
  const fab = createFabric({ proofDir: path.join(dir, 'js'), traceFile: path.join(dir, 'js.trace') });
  const ln = linknet.install(fab); plugStandIns(fab, ln);
  const { lv } = fab; const outLines = [];
  const stateLine = (op, extra) => {
    const e = [lv.EMIT_NEIGHBOR, lv.EMIT_TELEPORT, lv.EMIT_BOOTSTRAP, lv.EMIT_RELAY];
    outLines.push('{"op":"' + op + '","TICK":' + fab.w.TICK + ',"GSEED":' + lv.GSEED + ',"FSEED":' + lv.FSEED + ',"SEQ":' + lv.SEQ + ',"L10SEQ":' + lv.L10SEQ + ',"L22SEQ":' + lv.L22SEQ +
      ',"nextId":' + lv.nextId + ',"bus":' + fab.bus.size + ',"open":' + fab.openPairs.size + ',"relay":' + fab.relayGreeters.size + ',"gen":' + lv.relayGenesisKey + ',"emit":[' + e.join(',') + ']' + (extra || '') + ',"lk":' + linkHashJs(fab) + ',"c":[' + countersJs(fab) + ']}');
  };
  const mkSeat = (id) => { while (fab.seats.length <= id) { fab.seats.push(null); fab.alive.push(0); } fab.seats[id] = new Seat(id, fab.w); fab.alive[id] = 1; if (id >= lv.nextId) lv.nextId = id + 1; return fab.seats[id]; };
  const tickEnd = () => fab.proofTickEnd();
  for (const raw of script.split('\n')) {
    const tk = raw.trim().split(/\s+/).filter(Boolean); if (!tk.length || tk[0][0] === '#') continue;
    const op = tk[0], I = (k) => Number(tk[k] || 0);
    if (op === 'lever') {
      const n = tk[1];
      if (n === 'JOINMODE') fab.JOINMODE = tk[2]; else lv[n] = (n === 'LINKMODEL' || n === 'ROUTE_ENFORCE') ? Number(tk[2]) !== 0 : Number(tk[2]);
      stateLine('lever');
    } else if (op === 'init') {
      fab.initSim(I(1), Number(tk[2]));
      let x = ',"N":' + lv.N + ',"win":' + lv.joinWindow + ',"maxp":' + lv.MAXP + ',"plan":[';
      const parts = []; fab.spawnPlan.forEach((p, t) => { if (p.length) parts.push('[' + t + ',' + p.join(',') + ']'); });
      x += parts.join(',') + '],"reach":[' + fab.reachMx.map((rr) => '"' + rr.join('') + '"').join(',') + ']';
      stateLine('init', x);
    } else if (op === 'spawnall' || op === 'spawn') {
      const ts = op === 'spawn' ? [I(1)] : Array.from({ length: fab.spawnPlan.length }, (_, i) => i);
      for (const t of ts) { fab.w.TICK = t; fab.spawnDue(); fab.proofTickEnd(); }
      if (op === 'spawn') {
        const sn = [], q = []; for (let i = 0; i < lv.nextId; i++) if (fab.seats[i]) { sn.push(fab.seats[i].subnet); q.push(fab.seats[i].netQual); }
        stateLine(op, ',"subnets":[' + sn.join(',') + '],"qual":[' + q.join(',') + ']');
      } else stateLine(op);
    } else if (op === 'mk') { mkSeat(I(1)); stateLine('mk'); }
    else if (op === 'setc') { const s = fab.seats[I(1)]; s.state = I(2); s.hasCoord = true; s.coord = { pc: I(3), r: I(4), i: I(5) }; stateLine('setc'); }
    else if (op === 'occ') { const s = fab.seats[I(1)]; s.occ.set(topo.ckey({ pc: I(2), r: I(3), i: I(4) }), I(5)); stateLine('occ'); }
    else if (op === 'tick') { fab.w.TICK = I(1); stateLine('tick'); }
    else if (op === 'sched' || op === 'send') {
      const m = msg.newMsg(tk[3]); let a = 4, cls = -1; if (op === 'sched') { cls = I(4); a = 5; }
      for (; a < tk.length; a++) { const e = tk[a].indexOf('='); const k = tk[a].slice(0, e), v = Number(tk[a].slice(e + 1)); m[k] = (k === 'l10E' || k === 'dgOnly' || k === 'direct' || k === 'routing' || k === 'gwc' || k === 'knock' || k === 'mv') ? !!v : v; }
      if (op === 'sched') fab.schedule(I(1), I(2), m, cls); else fab.fabricSend(I(1), I(2), m);
      stateLine(op);
    } else if (op === 'knock') { fab.relayKnock(I(1), I(2) >>> 0, I(3) !== 0); stateLine('knock'); }
    else if (op === 'force') { fab.forcedSever.set(fab.pairKey(I(1), I(2)), I(3)); stateLine('force'); }
    else if (op === 'sever') { fab.severedUntil.set(fab.pairKey(I(1), I(2)), I(3)); stateLine('sever'); }
    else if (op === 'part') { lv.PARTITIONED = I(1) !== 0; stateLine('part'); }
    else if (op === 'cut') { const id = I(1); while (fab.partSide.length <= id) fab.partSide.push(0); fab.partSide[id] = I(2); stateLine('cut'); }
    else if (op === 'dark') { fab.DARK.add(I(1)); stateLine('dark'); }
    else if (op === 'lose') { lv.LOSE_T = I(1); lv.LOSE_NC = I(2); stateLine('lose'); }
    else if (op === 'doordark') { lv.DOORDARK = I(1); stateLine('doordark'); }
    else if (op === 'crash') { const id = I(1); fab.fabricKill(id, fab.w.TICK + fab.K.SOCK_CLOSE_CRASH); fab.X.crashTransport(id); stateLine('crash'); }
    else if (op === 'silent') { const k = fab.killFraction(Number(tk[1]), 'silent'); stateLine('silent', ',"killed":' + k + ',"N":' + lv.N); }
    else if (op === 'counts') { const c = fab.counts(); stateLine('counts', ',"seated":' + c.seated + ',"s1c":' + c.s1c + ',"dups":' + lv.DUPS_G); }
    else if (op === 'coord') { stateLine('coord', ',"s":"' + fab.coordStr({ pc: I(1), r: I(2), i: I(3) }) + '"'); }
    else if (op === 'linkopen') { stateLine('linkopen', ',"r":' + (fab.fabricLinkOpen(I(1), I(2)) ? 'true' : 'false')); }
    else if (op === 'tier') { fab.link.TIEROVR.set(I(1), I(2) ? fab.E.TIER_MOBILE : fab.E.TIER_DESKTOP); stateLine('tier'); }
    else if (op === 'seatf') { const s_ = fab.seats[I(1)]; const f = tk[2], v = I(3); if (f === 'l30' || f === 'evilDoor') s_[f] = v !== 0; else s_[f] = v; stateLine('seatf'); }
    else if (op === 'lev') { ln.lever(tk.slice(1)); stateLine('lev'); }
    else if (op === 'lsever') { ln.link.linkSever(I(1), I(2), I(3)); stateLine('lsever'); }
    else if (op === 'ldark') { fab.DARK.add(I(1)); ln.link.linkDark(I(1)); stateLine('ldark'); }
    else if (op === 'kill') { fab.fabricKill(I(1), -1); stateLine('kill'); }
    else if (op === 'left') { fab.fabricLeft(I(1)); stateLine('left'); }
    else if (op === 'reloadbye') { fab.X.fabricReloadBye(I(1)); stateLine('reloadbye'); }
    else if (op === 'ftick') {
      fab.w.TICK = I(1); const tfx = fab.FROZEN.size > 0 || fab.SLOW.size > 0 || fab.RELOADQ.size > 0 || fab.RESUMEQ.size > 0 || fab.RELCLOSEQ.size > 0;
      if (tfx) fab.X.timeTick(); if (lv.LINKMODEL) fab.X.linkTick(); if (lv.NETGRP) fab.X.netTick();
      const slot = fab.bus.get(fab.w.TICK);
      if (slot !== undefined) { for (const m of slot) { if (m.to >= 0 && m.to < fab.seats.length && fab.alive[m.to]) { if (fab.recvPre(m)) continue; if (tfx && fab.isFrozen(m.to)) { fab.X.freezeHold(m); continue; } } } fab.bus.delete(fab.w.TICK); }
      let held = 0; for (const f of fab.FROZEN.values()) { held += f.q.length; f.q.length = 0; }
      stateLine('ftick', ',"held":' + held);
    }
    else if (op === 'dial') { fab.X.fabricDial(I(1), I(2)); stateLine('dial'); }
    else if (op === 'dialjoin') { fab.X.fabricDialJoin(I(1), I(2)); stateLine('dialjoin'); }
    else if (op === 'uplink') { const b = fab.X.fabricDialUplink(I(1), I(2), []); stateLine('uplink', ',"r":' + (b ? 'true' : 'false')); }
    else if (op === 'uptake') { const b = fab.X.fabricUpTake(I(1), I(2)); stateLine('uptake', ',"r":' + b); }
    else if (op === 'updecline') { const rr = []; for (let a = 3; a < tk.length; a++) rr.push(I(a)); fab.X.fabricUpDecline(I(1), I(2), rr); stateLine('updecline'); }
    else if (op === 'callframe') { const m = msg.newMsg(tk[3]); for (let a = 4; a < tk.length; a++) setMsgField(m, tk[a]); fab.X.fabricCallFrame(I(1), I(2), m); stateLine('callframe'); }
    else if (op === 'closedrop') { const m = msg.newMsg(tk[1]); for (let a = 2; a < tk.length; a++) setMsgField(m, tk[a]); const b = fab.X.closedDrop(m); stateLine('closedrop', ',"r":' + (b ? 'true' : 'false')); }
    else if (op === 'doordrop') { fab.X.fabricDoorDrop(I(1), I(2)); stateLine('doordrop'); }
    else if (op === 'doorhanded') { fab.X.fabricDoorHanded(I(1), I(2)); stateLine('doorhanded'); }
    else if (op === 'doorheard') { ln.link.fabricDoorHeard(I(1), I(2), I(3)); stateLine('doorheard'); }
    else if (op === 'nosock') { fab.X.fabricNoSock(I(1), I(2)); stateLine('nosock'); }
    else if (op === 'mydoors') { stateLine('mydoors', ',"r":[' + fab.X.fabricMyDoors(I(1)) + ',' + fab.X.fabricMyKnocks(I(1)) + ']'); }
    else if (op === 'l23busy') { stateLine('l23busy', ',"r":' + (fab.X.fabricL23Busy(I(1), I(2)) ? 'true' : 'false')); }
    else if (op === 'lstate') { stateLine('lstate', ',"r":[' + fab.X.fabricLinkState(I(1), I(2)) + ',' + fab.X.fabricDialFails(I(1), I(2)) + ']'); }
    else if (op === 'lopenfor') { stateLine('lopenfor', ',"r":' + (fab.X.linkOpenFor(I(1), I(2)) ? 'true' : 'false')); }
    else if (op === 'l22') {
      const w = tk[1], a = I(2), b = I(3); let x_ = '';
      if (w === 'note') fab.X.l222Note(a, b); else if (w === 'agree') fab.X.l22Agree(a, b); else if (w === 'closeask') fab.X.l22CloseAsk(a, b); else if (w === 'close') fab.X.l22Close(a, b);
      else if (w === 'quiet') x_ = ',"r":' + (fab.X.l22Quiet(a, b) ? 'true' : 'false'); else if (w === 'release') ln.link.l22Release(a, b);
      stateLine('l22', x_);
    }
    else if (op === 'end') { fab.proofTickEnd(); stateLine('end'); }
    else throw new Error('bad op ' + op);
  }
  fab.close();
  return outLines.join('\n') + '\n';
}

// ---- compare ----------------------------------------------------------------------------------------------------
function firstDiff(a, b) {
  const x = a.split('\n'), y = b.split('\n');
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return { line: i + 1, sim: x[i], js: y[i] };
  return null;
}
function readOr(f) { return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; }

function checkSeed(bin, work, seed, script) {
  const dir = path.join(work, 'case' + seed); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const text = script || (seed % 3 === 0 ? genScript(seed) : genLinkScript(seed));
  fs.writeFileSync(path.join(dir, 'script.txt'), text);
  const env = Object.assign({}, process.env, { MESH_FHOP: '0', MESH_PROOF: path.join(dir, 'sim'), MESH_PROOF_TAPES: 'none', MESH_TRACE_FILE: path.join(dir, 'sim.trace') });
  const r = cp.spawnSync(bin, [], { input: text, env, maxBuffer: 1 << 28 });
  if (r.status !== 0) return { bad: 'driver exit ' + r.status + ' ' + String(r.stderr).slice(0, 300) };
  const simOut = r.stdout.toString();
  const jsOut = runJs(text, dir);
  const checks = [
    ['counters', simOut, jsOut],
    ['frames.jsonl', readOr(path.join(dir, 'sim', 'frames.jsonl')), readOr(path.join(dir, 'js', 'frames.jsonl'))],
    ['hash.jsonl', readOr(path.join(dir, 'sim', 'hash.jsonl')), readOr(path.join(dir, 'js', 'hash.jsonl'))],
    ['trace', readOr(path.join(dir, 'sim.trace')), readOr(path.join(dir, 'js.trace'))],
  ];
  const sizes = {};
  for (const [name, a, b] of checks) {
    sizes[name] = a.split('\n').length - 1;
    const d = firstDiff(a, b);
    if (d) return { bad: name + ' line ' + d.line + '\n  sim ' + String(d.sim).slice(0, 500) + '\n  js  ' + String(d.js).slice(0, 500), dir };
  }
  return { ok: true, sizes };
}

if (require.main === module) {
  const [bin, work, nStr, firstStr] = process.argv.slice(2);
  if (!bin || !work) { console.error('usage: fabric-check.js <driver> <work dir> [cases] [first seed]'); process.exit(2); }
  fs.mkdirSync(work, { recursive: true });
  const n = Number(nStr || 20), first = Number(firstStr || 1);
  const tot = { counters: 0, 'frames.jsonl': 0, 'hash.jsonl': 0, trace: 0 }; let fails = 0;
  for (let s = first; s < first + n; s++) {
    const r = checkSeed(bin, work, s);
    if (r.bad) { fails++; console.log('seed ' + s + ' DIFF ' + r.bad); if (fails >= 3) break; continue; }
    for (const k of Object.keys(tot)) tot[k] += r.sizes[k];
  }
  console.log((n - fails) + '/' + n + ' cases equal; lines compared: ' + JSON.stringify(tot));
  console.log(fails ? 'fabric check FAIL' : 'fabric check PASS');
  process.exit(fails ? 1 : 0);
}
module.exports = { genScript, genLinkScript, runJs, checkSeed };
