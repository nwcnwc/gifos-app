#!/usr/bin/env node
'use strict';
// fhop-check.js <driver binary> <work dir> [cases] [first seed]
// Differential check of harness/fhop.js (and js/mesh/fhop.js) against the sim's own friend-hop. For each seed it makes
// a random script (genScript), runs it through the C++ driver (l0/fhop-driver.cpp, built by l0/fhop-build.sh) and
// through the JS port with real JS seats, and compares line for line, after every op: the op's return value, what it
// handed to the link model (the hooks), and the whole friend-hop state (tables, counters, queues, the links).
// Exit 1 on the first difference. (The mutation checks run it through fhop-run.sh with FHOP_IMPL / FHOP_SEAT_IMPL.)
const fs = require('fs'), path = require('path'), cp = require('child_process');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const { createFabric } = require('./fabric.js');
const { Seat, FREE } = require(path.join(M, 'seat.js'));
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));
const E = require(path.join(M, 'consts.js')).enums;
const { installFhop } = require('./fhop.js');
const MT_INDEX = new Map(msg.MT_NAMES.map((n, i) => [n, i]));

// Stand-ins for units that are not in this branch (the island unit; and, until X1, route.js / linkset.js, which the
// runner script fhop-run.sh drops into an overlay copy of js/mesh from their branches).
if (!('mergeCalc' in Seat.prototype)) Seat.unit('fhop-check stand-in', { mergeCalc() { return false; } });
if (!FREE.islandStandM) Seat.free({ islandStandM: (merge, law) => (law === 0 || law === 1 || law === 4 || law === 5) ? merge : false });
// (linkset.js calls these two; the check seats hold no E2 / L4 state, so the sim's answer is false)
for (const n of ['l2Peer', 'l4Peer']) if (!(n in Seat.prototype)) Seat.unit('fhop-check stand-in ' + n, { [n]() { return false; } });
for (const n of ['nextHopCoord', 'strictNextHop', 'linkRole', 'linkPeers']) if (!(n in Seat.prototype)) { console.error('fhop-check: Seat.' + n + ' is missing (run fhop-run.sh: it adds route.js and linkset.js)'); process.exit(2); }

// ---- the script generator ---------------------------------------------------------------------------------------
const MTS = ['FIND', 'FIND', 'HELLO', 'PLACE', 'NOROOM', 'WHOHOME', 'HOME', 'ROUTE', 'MEET', 'MEETACK', 'FINDLEAF', 'LEAVE', 'YIELD', 'FINDACK', 'PONG', 'S1SYNC'];
function genScript(seed) {
  let s = (seed * 2654435761 + 977) >>> 0;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (a) => a[ri(0, a.length - 1)];
  const L = [];
  L.push('lever SEED0 ' + ri(1, 1e9)); L.push('lever LINKMODEL 1');
  if (r() < 0.3) L.push('lever FH_WEBKIT ' + pick([0.3, 0.7, 1]));
  if (r() < 0.05) L.push('lever FHOP_ON 0');
  if (r() < 0.2) L.push('lever NUM_SUBNETS 1');
  const N = ri(5, 14);
  const grp = r() < 0.5; const ng = ri(1, 4);
  L.push('init ' + N + ' 0');
  if (grp) { for (let g = 0; g < ng; g++) L.push('netg ' + pick([0, 0, 1, 2, 2]) + ' ' + (r() < 0.2 ? 1 : 0)); L.push('lever NETGRP 1'); }
  for (let q = 0; q < N; q++) L.push('mk ' + q);
  if (grp) for (let q = 0; q < N; q++) if (r() < 0.9) L.push('seatgrp ' + q + ' ' + ri(0, ng - 1));
  // seats: most seated in Section 1 or a Section-2 row, a few unseated
  const cell = new Map(), used = new Set();
  for (let q = 0; q < N; q++) {
    if (r() < 0.12) continue;
    let c; for (let t = 0; t < 20; t++) { c = r() < 0.6 ? [0, ri(0, 4), ri(0, 4)] : [ri(1, 2), ri(0, 4), ri(0, 4)]; if (!used.has(c.join())) break; }
    used.add(c.join()); cell.set(q, c);
    L.push('setc ' + q + ' ' + (r() < 0.9 ? 3 : pick([1, 2])) + ' ' + c.join(' '));
  }
  for (const [q] of cell) for (const [t, c] of cell) if (q !== t && r() < 0.75) L.push('occ ' + q + ' ' + c.join(' ') + ' ' + t);
  let T = ri(40, 200); L.push('tick ' + T);
  const ids = () => ri(0, N - 1);
  const pair = () => { const a = ids(); let b = ids(); if (b === a) b = (a + 1) % N; return [a, b]; };
  const mf = () => {   // random message fields
    const f = [];
    if (r() < 0.25) f.push('gwc=1'); if (r() < 0.25) f.push('mv=1'); if (r() < 0.3) f.push('tag=' + ri(0, 2)); if (r() < 0.3) f.push('asker=' + ids()); if (r() < 0.3) f.push('via=' + ids());
    if (r() < 0.3) f.push('nc=' + ids());
    return f;
  };
  const dc = () => T - ri(10, 18);   // boundary of FH_DISC = 14
  // A relay scenario: s wants t (row-mates, owned link), its channel to t is down, r is a mutual friend connected to both.
  // The ticks run through the 10 s ask, the job, the stream, the stop / end / unlink paths.
  const scenario = () => {
    if (N < 4) return;
    const rr = ri(0, 4), pcn = pick([0, 0, 1]); const a = ids(); let b = (a + 1) % N, c = (a + 2) % N;
    const [s0, t0, r0] = [a, b, c];
    L.push('setc ' + s0 + ' 3 ' + pcn + ' ' + rr + ' 0'); L.push('setc ' + t0 + ' 3 ' + pcn + ' ' + rr + ' 1'); L.push('setc ' + r0 + ' 3 ' + pcn + ' ' + rr + ' 2');
    for (const [p, q, qi] of [[s0, t0, 1], [s0, r0, 2], [r0, t0, 1], [r0, s0, 0], [t0, s0, 0], [t0, r0, 2]]) L.push('occ ' + p + ' ' + pcn + ' ' + rr + ' ' + qi + ' ' + q);
    L.push('lk ' + s0 + ' ' + r0 + ' 2 2 2 0 -1 -1000000'); L.push('lk ' + r0 + ' ' + t0 + ' 2 2 2 0 -1 -1000000');
    L.push('lk ' + s0 + ' ' + t0 + ' ' + pick([3, 2]) + ' ' + pick([3, 3, 2]) + ' ' + pick([3, 3, 2]) + ' 0 -1 -1000000');
    L.push('claim ' + s0 + ' ' + r0 + ' ' + [r0 < t0 ? t0 : t0].join(' ') + ' ' + s0); L.push('claim ' + r0 + ' ' + t0 + ' ' + r0);
    const n = ri(15, 60);
    for (let i = 0; i < n; i++) {
      T += 1; L.push('tick ' + T); L.push('ftick');
      if (i === 8 && r() < 0.5) L.push('claim ' + s0 + ' ' + r0 + ' ' + t0);
      if (r() < 0.04) L.push('refuse ' + s0 + ' ' + t0 + ' ' + r0 + ' ' + (T - ri(0, 60)));
      if (r() < 0.05) L.push(['sponsor', s0, t0, pick(MTS)].join(' '));
      if (r() < 0.06) L.push('lk ' + s0 + ' ' + t0 + ' 2 2 2 0 -1 -1000000');
      if (r() < 0.05) L.push('lk ' + r0 + ' ' + t0 + ' ' + pick([3, 2]) + ' ' + pick([3, 2]) + ' ' + pick([3, 2]) + ' ' + pick([0, 1, 2]) + ' ' + (T - ri(0, 20)) + ' -1000000');
      if (r() < 0.04) L.push('lk ' + s0 + ' ' + r0 + ' ' + pick([3, 2]) + ' ' + pick([3, 2]) + ' ' + pick([3, 2]) + ' ' + pick([0, 1, 2]) + ' ' + (T - ri(0, 20)) + ' -1000000');
      if (r() < 0.04) L.push('occ ' + s0 + ' ' + pcn + ' ' + rr + ' 1 ' + ids());
      if (r() < 0.03) L.push('setc ' + t0 + ' 3 ' + (pcn + 1) + ' ' + rr + ' 1');
      if (r() < 0.03) L.push('alive ' + pick([r0, t0, s0]) + ' 0');
      if (r() < 0.2) L.push('dump');
    }
  };
  const nOps = ri(120, 260);
  for (let k = 0; k < nOps; k++) {
    const x = r();
    if (x < 0.22) { const [a, b] = pair(); L.push(['lk', a, b, pick([2, 2, 2, 2, 1, 3, 0]), pick([2, 2, 2, 1, 3, 0]), pick([2, 2, 2, 1, 3, 0]), pick([0, 0, 0, 1, 2, 3]), r() < 0.5 ? dc() : -1, r() < 0.5 ? -1000000 : T - ri(0, 12)].join(' ')); }
    else if (x < 0.27) { const [a, b] = pair(); L.push(['want', a, b, T - ri(0, 40)].join(' ')); }
    else if (x < 0.36) { const [a, b] = pair(); const l = []; for (let i = 0; i < ri(0, 4); i++) l.push(ids()); l.sort((p, q) => p - q); L.push(['claim', a, b, ...l].join(' ')); }
    else if (x < 0.38) { const [a, b] = pair(); L.push(['fnat', a, b, pick([-1, 0, 1, 2])].join(' ')); }
    else if (x < 0.42) { const [a, b] = pair(); L.push(['crumb', a, ids(), b, T - ri(0, 140)].join(' ')); }
    else if (x < 0.44) { L.push(['seen', ids(), ri(1, 12), T - ri(0, 140)].join(' ')); }
    else if (x < 0.47) { const [a, b] = pair(); L.push(['job', a, b, ids(), T - ri(0, 30)].join(' ')); }
    else if (x < 0.50) { const [a, b] = pair(); L.push(['fpeer', a, b, r() < 0.5 ? T - ri(0, 40) : -1, T - ri(0, 40), pick([-1, -1, ids()]), T + ri(-3, 4)].join(' ')); }
    else if (x < 0.52) { const [a, b] = pair(); L.push(['refuse', a, b, ids(), T - ri(0, 80)].join(' ')); }
    else if (x < 0.53) L.push('dialfail ' + ids() + ' ' + ids());
    else if (x < 0.54) L.push('l16ret ' + ri(0, 1));
    else if (x < 0.55) L.push('alive ' + ids() + ' ' + (r() < 0.7 ? 1 : 0));
    else if (x < 0.62) { const [a, b] = pair(); L.push(['sponsor', a, b, pick(MTS), ...mf()].join(' ')); }
    else if (x < 0.72) { const [a, b] = pair(); L.push(['fsched', a, b, pick(MTS), ...mf()].join(' ')); }
    else if (x < 0.75) { const [a, b] = pair(); L.push(['drop', a, b, pick(MTS), ...mf()].join(' ')); }
    else if (x < 0.85) {   // an arriving frame: an envelope (fhTo set), a plain FIND, or a routing frame with a vacant hop
      const [a, b] = pair(); const f = mf();
      const y = r();
      if (y < 0.6) f.push('fhTo=' + (r() < 0.3 ? b : ids()), 'fhOrig=' + ids(), 'fhTtl=' + ri(0, 12), 'fhId=' + ri(1, 12), 'fhTc=' + (cell.size && r() < 0.6 ? topo.ckey({ pc: 0, r: ri(0, 4), i: ri(0, 4) }) + 1 : 0));
      else if (y < 0.85) f.push('routing=1', 'rdst=' + topo.ckey({ pc: pick([0, 0, 1]), r: ri(0, 4), i: ri(0, 4) }), 'rttl=' + ri(0, 3), 'rfinal=' + pick([-1, -1, ids()]));
      L.push(['icpt', a, b, pick(MTS), ...f].join(' '));
    }
    else if (x < 0.93) { T += pick([1, 1, 1, 2, 4, 8, 15, 31]); L.push('tick ' + T); L.push('ftick'); }
    else if (x < 0.95) { const [a, b] = pair(); L.push('friend ' + a + ' ' + b); }
    else if (x < 0.97) { const [a, b] = pair(); L.push('unreach ' + a + ' ' + b); }
    else if (x < 0.985) L.push('free ' + ri(0, 2) + ' ' + ri(-1, 4));
    else L.push('webkit ' + ids());
    if (r() < 0.04) L.push('dump');
    if (r() < 0.025) scenario();
    if (r() < 0.03) { const [a, b] = pair(); for (let i = ri(2, 4); i > 0; i--) L.push('dialfail ' + a + ' ' + b); L.push('fnat ' + a + ' ' + b + ' ' + pick([0, 1, 2])); L.push('unreach ' + a + ' ' + b); }   // the NAT typing: enough failed dials, both kinds known
  }
  L.push('dump');
  return L.join('\n') + '\n';
}

// ---- the JS twin of the driver ---------------------------------------------------------------------------------------
function runJs(script) {
  const fab = createFabric({}); const { lv, X } = fab; const TICK = () => fab.w.TICK;
  const lines = []; let LOG = [];
  const pairKey = fab.pairKey;
  const LINKS = new Map(); let LINKPEERS = []; let L16RET = 0;
  const lEnd = (me, x) => (me < x ? 0 : 1);
  const newLink = () => ({ state: E.LK_NONE, view: [E.LK_NONE, E.LK_NONE], half: 0, halfAt: -1, askAt: -1000000 });
  const digest = (m) => JSON.stringify([MT_INDEX.get(m.t), m.from, m.to, m.id, m.nc, m.fhTo, m.fhOrig, m.fhTtl, m.fhId, m.fhTc, m.rttl, m.rvia, m.rfinal, m.routing ? 1 : 0, m.lk, m.tx, m.tag]);
  // the link model's side of the surface (harness/fhop.js header): a stub with the sim's Link fields
  fab.plug({
    linkFind: (a, b) => LINKS.get(pairKey(a, b)) || null,
    linkPeers: (id) => LINKPEERS[id] || [],
    linkGet: (a, b) => { const pk = pairKey(a, b); let L = LINKS.get(pk); if (L) return L; L = newLink(); LINKS.set(pk, L); for (const [p, q] of [[a, b], [b, a]]) { while (LINKPEERS.length <= p) LINKPEERS.push([]); LINKPEERS[p].push(q); } return L; },
    lEnsure: () => {}, linkTx: () => {},
    linkSchedule: (from, to, m) => { LOG.push('X ' + from + ' ' + to + ' ' + digest(m)); },
    startDial: (a, b, L) => { LOG.push('D ' + a + ' ' + b); L.state = E.LK_DIALING; L.view[lEnd(a, b)] = E.LK_DIALING; },
    l16Refuse: (from, to, mt) => { LOG.push('L16 ' + from + ' ' + to + ' ' + MT_INDEX.get(mt)); return !!L16RET; },
    fabricDialFails: (me, x) => (me >= 0 && me < lv.nextId) ? fab.seats[me].dials.fails(x) : 0,
    fabricDoors: () => !!lv.LINKMODEL,
    // C++: mesh_net.inc:grpReach  (no NETCUT / NETLIFT here)
    grpReach: (a, b) => {
      if (!lv.NETGRP) return true;
      const g = (id) => (id >= 0 && id < fab.SEATGRP.length) ? fab.SEATGRP[id] : -1;
      const ga = g(a), gb = g(b); if (ga < 0 || gb < 0) return true;
      if (ga === gb) return a === b || !fab.NETG[ga].iso;
      const ta = fab.NETG[ga].type, tb = fab.NETG[gb].type;
      if (ta === E.GT_BLOCKED || tb === E.GT_BLOCKED) return false;
      if (ta === E.GT_SYM && tb === E.GT_SYM) return false;
      return true;
    },
    linkReset: () => { LINKS.clear(); LINKPEERS = []; },
  });
  installFhop(fab);
  const FH = () => fab.FH;
  const dump = () => {
    const d = { seq: lv.FH_SEQ, S: fab.FHS.slice(), M: fab.FHM.slice() };
    d.MQ = [...fab.FHMQ.keys()].sort((a, b) => a - b).map((t) => [t, fab.FHMQ.get(t).map((x) => [x.kind, x.from, x.to, x.target])]);
    d.GQ = [...fab.FHGQ.keys()].sort((a, b) => a - b).map((t) => [t, fab.FHGQ.get(t).map((x) => [x[0], x[1], x[2]])]);
    d.F = [];
    FH().forEach((F, i) => {
      if (!F.conns.size && !F.nat.size && !F.sentOk && !F.crumb.size && !F.seen.size && !F.lane.size && !F.peer.size && !F.jobs.length && !F.want.size && !F.unlinked.size) return;
      d.F.push([i, { c: [...F.conns].map(([k, v]) => [k, v]), n: [...F.nat], sent: F.sentOk ? (F.sent ? F.sent : null) : false, cr: [...F.crumb].map(([k, v]) => [k, v[0], v[1]]), se: [...F.seen], la: [...F.lane],
        pe: [...F.peer].sort((a, b) => a[0] - b[0]).map(([k, P]) => [k, P.downSince, P.askAt, P.via, P.claimAt, [...P.refused].sort((a, b) => a[0] - b[0])]), jo: F.jobs.map((j) => [j.target, j.req, j.at]), wa: [...F.want], ul: [...F.unlinked] }]);
    });
    d.links = [...LINKS].sort((a, b) => a[0] - b[0]).map(([k, L]) => [k, L.state, L.view[0], L.view[1], L.half, L.halfAt, L.askAt]);
    d.peers = []; for (let i = 0; i < lv.nextId; i++) d.peers.push(LINKPEERS[i] || []);
    return d;
  };
  const out = (op, r) => { lines.push(JSON.stringify(canon({ op, r, log: LOG, d: dump() }))); LOG = []; };
  const mkSeat = (id) => { while (fab.seats.length <= id) { fab.seats.push(null); fab.alive.push(0); } fab.seats[id] = new Seat(id, fab.w); fab.alive[id] = 1; if (id >= lv.nextId) lv.nextId = id + 1; return fab.seats[id]; };
  const msgOf = (tk, mt, a) => {
    const m = msg.newMsg(tk[mt]);
    for (; a < tk.length; a++) { const e = tk[a].indexOf('='); const k = tk[a].slice(0, e), v = Number(tk[a].slice(e + 1)); if (k === 'rdst') m.rdst = topo.unckey(v); else m[k] = (k === 'routing' || k === 'gwc' || k === 'mv') ? !!v : v; }
    return m;
  };
  for (const raw of script.split('\n')) {
    const tk = raw.trim().split(/\s+/).filter(Boolean); if (!tk.length || tk[0][0] === '#') continue;
    const op = tk[0], I = (k) => Number(tk[k] || 0);
    if (op === 'lever') {
      const n = tk[1];
      if (n === 'FHOP_ON') fab.FHOP_ON = I(2) !== 0; else if (n === 'NETGRP') lv.NETGRP = I(2) !== 0; else lv[n] = Number(tk[2]);
      out('lever', 0);
    } else if (op === 'init') { fab.initSim(I(1), Number(tk[2])); out('init', 0); }
    else if (op === 'mk') { mkSeat(I(1)); out('mk', 0); }
    else if (op === 'setc') { const s = fab.seats[I(1)]; s.state = I(2); s.hasCoord = true; s.coord = { pc: I(3), r: I(4), i: I(5) }; out('setc', 0); }
    else if (op === 'occ') { fab.seats[I(1)].occ.set(topo.ckey({ pc: I(2), r: I(3), i: I(4) }), I(5)); out('occ', 0); }
    else if (op === 'tick') { fab.w.TICK = I(1); out('tick', 0); }
    else if (op === 'alive') { fab.alive[I(1)] = I(2); out('alive', 0); }
    else if (op === 'lk') { const L = X.linkGet(I(1), I(2)); L.state = I(3); L.view[0] = I(4); L.view[1] = I(5); L.half = I(6); L.halfAt = I(7); L.askAt = I(8); out('lk', 0); }
    else if (op === 'want') { fab.fhop.fhEnsure(); FH()[I(1)].want.set(I(2), I(3)); out('want', 0); }
    else if (op === 'claim') { fab.fhop.fhEnsure(); const v = []; for (let k = 3; k < tk.length; k++) v.push(I(k)); FH()[I(1)].conns.set(I(2), v); out('claim', 0); }
    else if (op === 'fnat') { fab.fhop.fhEnsure(); FH()[I(1)].nat.set(I(2), I(3)); out('fnat', 0); }
    else if (op === 'crumb') { fab.fhop.fhEnsure(); FH()[I(1)].crumb.set(I(2), [I(3), I(4)]); out('crumb', 0); }
    else if (op === 'seen') { fab.fhop.fhEnsure(); FH()[I(1)].seen.set(I(2), I(3)); out('seen', 0); }
    else if (op === 'job') { fab.fhop.fhEnsure(); FH()[I(1)].jobs.push({ target: I(2), req: I(3), at: I(4) }); out('job', 0); }
    else if (op === 'fpeer') { fab.fhop.fhEnsure(); const F = FH()[I(1)]; let P = F.peer.get(I(2)); if (!P) { P = { downSince: -1, askAt: -1000000, via: -1, claimAt: -1, refused: new Map() }; F.peer.set(I(2), P); } P.downSince = I(3); P.askAt = I(4); P.via = I(5); P.claimAt = I(6); out('fpeer', 0); }
    else if (op === 'refuse') { fab.fhop.fhEnsure(); const F = FH()[I(1)]; let P = F.peer.get(I(2)); if (!P) { P = { downSince: -1, askAt: -1000000, via: -1, claimAt: -1, refused: new Map() }; F.peer.set(I(2), P); } P.refused.set(I(3), I(4)); out('refuse', 0); }
    else if (op === 'netg') { fab.NETG.push({ name: 'g' + fab.NETG.length, type: I(1), size: 0, iso: I(2) !== 0 }); out('netg', 0); }
    else if (op === 'seatgrp') { const id = I(1); while (fab.SEATGRP.length <= id) fab.SEATGRP.push(-1); fab.SEATGRP[id] = I(2); out('seatgrp', 0); }
    else if (op === 'dialfail') { fab.seats[I(1)].dials.failed(I(2), TICK(), false); out('dialfail', 0); }
    else if (op === 'l16ret') { L16RET = I(1); out('l16ret', 0); }
    else if (op === 'sponsor') { fab.fhop.fhEnsure(); const m = msgOf(tk, 3, 4); out('sponsor', fab.fhop.fhopSponsor(I(1), I(2), m)); }
    else if (op === 'fsched') { const m = msgOf(tk, 3, 4); out('fsched', X.fhopSchedule(I(1), I(2), m)); }
    else if (op === 'drop') { const m = msgOf(tk, 3, 4); out('drop', X.fhopSponsorDrop(I(1), I(2), m)); }
    else if (op === 'icpt') { fab.fhop.fhEnsure(); const m = msgOf(tk, 3, 4); m.to = I(1); m.from = I(2); const r = X.fhopIntercept(m); out('icpt', [r, JSON.parse(digest(m))]); }
    else if (op === 'ftick') { X.fhopTick(); out('ftick', 0); }
    else if (op === 'friend') { out('friend', X.fhopFriendFor(I(1), I(2))); }
    else if (op === 'unreach') { out('unreach', X.fabricUnreachable(I(1), I(2))); }
    else if (op === 'free') { out('free', X.fabricFreeCells(I(1), I(2))); }
    else if (op === 'webkit') { out('webkit', fab.fhop.fhWebkit(I(1))); }
    else if (op === 'dump') out('dump', 0);
    else throw new Error('bad op ' + op);
  }
  return lines;
}
function canon(v) { if (Array.isArray(v)) return v.map(canon); if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v).sort()) o[k] = canon(v[k]); return o; } return v; }

function checkSeed(bin, work, seed) {
  const text = genScript(seed);
  const dir = path.join(work, 'case' + seed); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'script.txt'), text);
  const r = cp.spawnSync(bin, [], { input: text, maxBuffer: 1 << 29 });
  if (r.status !== 0) return { bad: 'driver exit ' + r.status + ' ' + String(r.stderr).slice(0, 300) };
  const sim = r.stdout.toString().split('\n').filter(Boolean).map((l) => JSON.stringify(canon(JSON.parse(l))));
  let js; try { js = runJs(text); } catch (e) { return { bad: 'js threw ' + (e.stack || e) } }
  const ops = text.split('\n').filter((l) => l.trim() && l[0] !== '#');
  const used = new Set();
  for (let i = 0; i < Math.max(sim.length, js.length); i++) {
    if (sim[i] !== js[i]) return { bad: 'op ' + (i + 1) + ' (' + ops[i] + ')\n  sim ' + String(sim[i]).slice(0, 900) + '\n  js  ' + String(js[i]).slice(0, 900), dir };
  }
  const cnt = {}; for (const o of ops) { const k = o.split(' ')[0]; cnt[k] = (cnt[k] || 0) + 1; }
  // which paths ran: the counters at the end
  const last = JSON.parse(sim[sim.length - 1]).d; return { ok: true, n: sim.length, S: last.S, M: last.M, cnt };
}

if (require.main === module) {
  const [bin, work, nStr, firstStr] = process.argv.slice(2);
  if (!bin || !work) { console.error('usage: fhop-check.js <driver> <work dir> [cases] [first seed]'); process.exit(2); }
  fs.mkdirSync(work, { recursive: true });
  const n = Number(nStr || 20), first = Number(firstStr || 1);
  let fails = 0, ops = 0; const S = new Array(16).fill(0), Mc = new Array(8).fill(0);
  for (let s = first; s < first + n; s++) {
    const r = checkSeed(bin, work, s);
    if (r.bad) { fails++; console.log('seed ' + s + ' DIFF ' + r.bad); if (fails >= 3) break; continue; }
    ops += r.n; r.S.forEach((v, i) => { S[i] += v; }); r.M.forEach((v, i) => { Mc[i] += v; });
  }
  console.log((n - fails) + '/' + n + ' cases equal; op lines compared: ' + ops + '; FHS(sum)=' + JSON.stringify(S) + ' FHM(sum)=' + JSON.stringify(Mc));
  console.log(fails ? 'fhop check FAIL' : 'fhop check PASS');
  process.exit(fails ? 1 : 0);
}
module.exports = { genScript, runJs, checkSeed };
