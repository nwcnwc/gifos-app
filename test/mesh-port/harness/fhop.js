'use strict';
/*
 * harness/fhop.js: friend-hop (port plan H4), a line-for-line port of the sim's mesh_fhop.inc: law and physics
 * (installFhop), and the measurement with its lever (installFhopLever: fhMeasureTick, fhStat, fhHeal, fhRx, fhopLever
 * and the FHMEAS / FHM_PEAK* counters). Harness code: it plays run.html around the seats and is never shipped.
 *
 *   const { installFhop } = require('./fhop.js');   installFhop(fab);
 *
 * installFhop(fab) builds the friend-hop tables on `fab` (fab.FH, fab.FHMQ, fab.FHGQ, fab.FHS, fab.FHM; FH_SEQ and
 * FH_WEBKIT are the levers fab.lv.FH_SEQ / FH_WEBKIT; fab.FHOP_ON is the C++ FHOP_ON) and plugs the functions the
 * fabric calls (fhopActive fhopReset fhopSchedule fhopSponsorDrop fhopIntercept fhopTick fhopFriendFor
 * fabricUnreachable fabricFreeCells). The three the seats call are js/mesh/fhop.js (given ctx first).
 *
 * THE LINK MODEL IS H2'S. Friend-hop reads and calls it through fab.X; H2 must plug these (names fixed here):
 *   linkFind(a, b) -> Link | null     the Link has { state, view[2], half, halfAt, askAt } (C++ struct Link)
 *   linkPeers(id) -> number[]         C++ LINKPEERS[id], in its push order ([] if the id has none)
 *   linkGet(a, b) -> Link             C++ linkGet (makes the pair)
 *   linkSchedule(from, to, m)         C++ linkSchedule
 *   lEnsure(id)                       C++ lEnsure
 *   linkTx(id)                        C++ LTX[id] = TICK
 *   startDial(a, b, L)                C++ startDial
 *   l16Refuse(from, to, mt) -> bool   C++ l16Refuse (mt is the message type name)
 *   fabricDialFails(me, x), fabricDoors(), grpReach(a, b)   (already in the fabric's list)
 * and the seat methods nextHopCoord, strictNextHop (route.js), linkRole, linkPeers (linkset.js).
 *
 * std::map / OMap tables are JS Maps. std::map iteration order (key order) is only relied on for FHMQ / FHGQ (popped
 * by smallest key, below); FhSeat.peer is walked in places where the order cannot change the outcome (the keys go
 * through a sorted set, or the body is order-free), so it is a plain Map. The MESH_FHLOG stderr prints are not ported.
 */
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const C_ = require(path.join(M, 'consts.js'));
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));
const hash = require(path.join(M, 'hash.js'));
const fhopSeat = require(path.join(M, 'fhop.js'));

const K = C_.consts, E = C_.enums;
const { LK_OPEN, LK_NONE, LK_DIALING, LK_CLOSED } = E;
const { ckey, ownedLinks, unckey } = topo;
const MT_INDEX = new Map(msg.MT_NAMES.map((n, i) => [n, i]));

// std::binary_search on a sorted array of ints
function bsearch(a, x) { let lo = 0, hi = a.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid] < x) lo = mid + 1; else hi = mid; } return lo < a.length && a[lo] === x; }
// std::map: the smallest key (undefined if empty)
function minKey(m) { let k; for (const x of m.keys()) if (k === undefined || x < k) k = x; return k; }
// C++: mesh_link.inc:lmix
function lmix(x) { return hash.fmix32((x + 0x9e3779b9) >>> 0); }
function lEnd(me, x) { return me < x ? 0 : 1; }
function ins(m, k, mk) { let v = m.get(k); if (v === undefined) { v = mk(); m.set(k, v); } return v; }   // C++ m[k]

// C++: mesh_fhop.inc:FhPeer (and FhJob, a plain {target, req, at})
function newFhPeer() { return { downSince: -1, askAt: -1000000, via: -1, claimAt: -1, refused: new Map() }; }
// C++: mesh_fhop.inc:FhSeat
function newFhSeat() {
  return { conns: new Map(), nat: new Map(), sent: null, sentOk: false, crumb: new Map(), seen: new Map(), lane: new Map(),
    peer: new Map(), jobs: [], want: new Map(), unlinked: new Map(), firstMedia: -1, fullMedia: -1 };
}

function installFhop(fab) {
  const { lv, seats, alive, X, w } = fab;
  const TICK = () => w.TICK;
  const P = (n) => K[n];   // the laws' constants (FHOP_TTL ...)

  // ---- state ----------------------------------------------------------------------------------------------
  fab.FH = []; fab.FHMQ = new Map(); fab.FHGQ = new Map();
  fab.FHS = new Array(16).fill(0); fab.FHM = new Array(8).fill(0);
  fab.FHOP_ON = !(typeof process !== 'undefined' && process.env && process.env.MESH_FHOP !== undefined && parseInt(process.env.MESH_FHOP, 10) === 0);
  const FH_ref = () => fab.FH;
  const FHS = fab.FHS, FHM = fab.FHM;
  const grpOf = (id) => (id >= 0 && id < fab.SEATGRP.length) ? fab.SEATGRP[id] : -1;

  // C++: mesh_fhop.inc:fhopActive
  const fhopActive = () => !!(lv.LINKMODEL && fab.FHOP_ON);
  // C++: mesh_fhop.inc:fhEnsure
  const fhEnsure = () => { const FH = fab.FH; if (FH.length < lv.nextId + 1) { const n = lv.nextId + 64; while (FH.length < n) FH.push(newFhSeat()); } };
  // C++: mesh_fhop.inc:fhopReset
  const fhopReset = () => { fab.FH.length = 0; fab.FHMQ.clear(); fab.FHGQ.clear(); lv.FH_SEQ = 0; FHS.fill(0); FHM.fill(0); };

  // ---- what the page reads off its own transport ----------------------------------------------------------------
  // C++: mesh_fhop.inc:fhHeld1
  const fhHeld1 = (me, x) => { if (me >= fab.FH.length) return true; const it = fab.FH[me].want.get(x); return it === undefined || TICK() - it <= P('FH_UNLINK'); };
  // C++: mesh_fhop.inc:fhHeld
  const fhHeld = (me, x) => fhHeld1(me, x) && fhHeld1(x, me);
  // C++: mesh_fhop.inc:fhDcRaw
  const fhDcRaw = (me, x) => { const L = X.linkFind(me, x); return !!L && L.view[lEnd(me, x)] === LK_OPEN; };
  // C++: mesh_fhop.inc:fhDc   (dc.readyState === 'open')
  const fhDc = (me, x) => { const L = X.linkFind(me, x); return !!L && L.view[lEnd(me, x)] === LK_OPEN && fhHeld(me, x); };
  // C++: mesh_fhop.inc:fhConn   (p.connected (pc 'connected') && dc open)
  const fhConn = (me, x) => {
    const L = X.linkFind(me, x); if (!L || L.view[lEnd(me, x)] !== LK_OPEN || !fhHeld(me, x)) return false;
    return !(L.state === LK_OPEN && L.half && TICK() - L.halfAt >= P('FH_DISC'));
  };
  // C++: mesh_fhop.inc:fhConns   (myConns(), lowest id first)
  const fhConns = (me) => { const v = []; for (const p of X.linkPeers(me)) if (fhConn(me, p)) v.push(p); v.sort((a, b) => a - b); return v; };
  // C++: mesh_fhop.inc:fhClaims
  const fhClaims = (me, r, to) => { const it = fab.FH[me].conns.get(r); return it !== undefined && bsearch(it, to); };
  // C++: mesh_fhop.inc:fhKeyOf   (coordKeyOf; +1: 0 = unknown)
  const fhKeyOf = (me, pid) => { for (const [k, v] of seats[me].occ) if (v === pid) return k + 1; return 0; };
  // C++: mesh_fhop.inc:fhWebkit
  const fhWebkit = (id) => lv.FH_WEBKIT > 0 && (lmix(hash.hmixId((lv.SEED0 ^ 0x776b6974) >>> 0, id)) % 1000000) / 1e6 < lv.FH_WEBKIT;
  const namesOwned = (from, to) => seats[from].linkRole(to, E.LR_OWNED | E.LR_E2);   // C++: mesh_link.inc:namesOwned

  // C++: mesh_fhop.inc:fhNextHop   (nextHopDc(to, tc))
  function fhNextHop(me, to, tc) {
    if (fhConn(me, to)) return to;
    const s = seats[me]; if (!s.hasCoord) return -1;
    const k = tc ? tc : fhKeyOf(me, to); if (!k) return -1;
    const hop = s.nextHopCoord(unckey(k - 1)); if (!hop) return -1;
    const pid = s.occGet(ckey(hop)); if (pid < 0 || pid === me || pid === to) return -1;
    return fhConn(me, pid) ? pid : -1;
  }
  // C++: mesh_fhop.inc:fhNoteCrumb
  function fhNoteCrumb(me, pid, via) {
    if (pid < 0 || via < 0 || pid === via || pid === me) return;
    const c = fab.FH[me].crumb; c.set(pid, [via, TICK()]);
    if (c.size > 1024) for (const [k, v] of [...c]) { if (TICK() - v[1] > P('FHOP_CRUMB_TTL')) c.delete(k); }
  }
  // C++: mesh_fhop.inc:fhCrumb
  function fhCrumb(me, pid, notVia) {
    const it = fab.FH[me].crumb.get(pid); if (it === undefined) return -1;
    if (TICK() - it[1] > P('FHOP_CRUMB_TTL') || it[0] === notVia) return -1;
    const v = it[0]; return fhConn(me, v) ? v : -1;
  }
  // C++: mesh_fhop.inc:fhSeenNote
  function fhSeenNote(me, id) {
    const s = fab.FH[me].seen; s.set(id, TICK());
    if (s.size > 512) for (const [k, v] of [...s]) { if (TICK() - v > P('FHOP_CRUMB_TTL')) s.delete(k); }
  }
  // C++: mesh_fhop.inc:fhXmit   (one hop over a held channel (half-open: it vanishes)); the envelope is passed by value
  function fhXmit(me, p, env) { X.linkSchedule(me, p, msg.clone(env)); }

  // C++: mesh_fhop.inc:fhopSponsor   (sponsorSend: the origin of an envelope)
  function fhopSponsor(me, to, m) {
    const env = msg.clone(m); fab.wireTx(env, me); env.fhTo = to; env.fhOrig = me; env.fhTtl = P('FHOP_TTL'); env.fhId = ++lv.FH_SEQ; env.fhTc = fhKeyOf(me, to);   // CLOCKS: the origin stamps its envelope; sponsors forward it as it is
    const mc = fhConns(me);
    for (const r of mc) if (r !== to && fhClaims(me, r, to)) { if (fhDc(me, r)) { FHS[0]++; FHS[1]++; fhXmit(me, r, env); return true; } break; }   // cands[0] only
    const hp = fhNextHop(me, to, env.fhTc); if (hp >= 0) { FHS[0]++; FHS[2]++; fhXmit(me, hp, env); return true; }
    const cp = fhCrumb(me, to, -1); if (cp >= 0) { FHS[0]++; FHS[3]++; fhXmit(me, cp, env); return true; }
    const lane = hash.idPair(to, MT_INDEX.get(m.t)); const it = fab.FH[me].lane.get(lane);
    if (it !== undefined && it === TICK()) { FHS[5]++; return true; }   // swallowed: the next beat re-mints it
    fab.FH[me].lane.set(lane, TICK());
    if (fab.FH[me].lane.size > 512) for (const [k, v] of [...fab.FH[me].lane]) { if (TICK() - v > 60) fab.FH[me].lane.delete(k); }
    for (const r of mc) if (r !== to) { FHS[0]++; FHS[4]++; fhXmit(me, r, env); return true; }
    FHS[6]++; return false;
  }

  // C++: mesh_fhop.inc:fhopOnward   (fwdOnward: an envelope reached `me` and names someone else); env is a copy
  function fhopOnward(me, env0, via) {
    const env = msg.clone(env0);
    if (fab.FH[me].seen.has(env.fhId)) { FHS[12]++; return; }
    const ttl = env.fhTtl - 1; if (ttl < 0) { FHS[13]++; return; } env.fhTtl = ttl;
    const to = env.fhTo;
    const handoff = (p) => { if (p < 0 || p === via || !fhConn(me, p)) return false; fhSeenNote(me, env.fhId); fhXmit(me, p, env); return true; };
    if (handoff(fhNextHop(me, to, env.fhTc))) { FHS[7]++; return; }
    const mc = fhConns(me);
    for (const r of mc) if (r !== via && r !== to && fhClaims(me, r, to) && handoff(r)) { FHS[8]++; return; }
    if (handoff(fhCrumb(me, to, via))) { FHS[9]++; return; }
    for (const r of mc) if (r !== via && r !== to && r !== me) { if (handoff(r)) FHS[10]++; return; }
    FHS[11]++;
  }

  // C++: mesh_fhop.inc:fhopSchedule
  // A frame from `from` to `to` whose channel does not read open at from's end. true = consumed (sponsored);
  // false = the parent's path runs.
  function fhopSchedule(from, to, m) {
    if (from < 0 || to < 0 || from === to || from >= lv.nextId || to >= lv.nextId || m.fhTo >= 0 || fab.darkPair(from, to)) return false;
    if (m.gwc && fab.farView(seats[from], to).seat !== 1) return false;   // L16.3: an answer to a joiner outside rides the sender's own door
    fhEnsure(); X.lEnsure(Math.max(from, to));
    if (fhDcRaw(from, to)) return false;   // the frame rides the open channel (a half-open one eats it)
    const sf = seats[from];
    {
      const L0 = X.linkFind(from, to); const st0 = L0 ? L0.state : LK_NONE;
      if ((st0 === LK_NONE || st0 === LK_DIALING) && (namesOwned(from, to) || fab.farView(sf, to).seat === -1 || sf.state !== 3 || (sf.l13On() && (m.t === 'MEET' || m.t === 'MEETACK')) || (sf.l13('L13.2') && m.t === 'FINDLEAF') || (sf.l13('L13.7') && m.t === 'LEAVE' && m.mv) || (sf.l13('L13.1') && m.t === 'YIELD') || (((m.t === 'ROUTE' && m.tag === 1 && m.asker === from && m.via === from) || (m.t === 'WHOHOME' && m.from === from && sf.hasCoord && sf.coord.pc !== 0 && sf.coord.i === 0)))) && !((lv.NETGRP && !X.grpReach(from, to)) || (lv.NUM_SUBNETS > 1 && !fab.reachable(sf.subnet, seats[to].subnet)))) return false;
    }
    const entry = sf.state !== 3 && (m.t === 'WHOHOME' || m.t === 'FIND' || m.t === 'HOME');   // handOnce: also waits for its own channel
    if (!fhopSponsor(from, to, m)) return false;
    if (entry) return false;
    // sponsored: the parent's dial side effects, without queueing the frame
    if ((lv.NETGRP && !X.grpReach(from, to)) || (lv.NUM_SUBNETS > 1 && !fab.reachable(sf.subnet, seats[to].subnet))) return true;
    if (X.l16Refuse(from, to, m.t)) return true;   // L16: a door past the cap (or one only a HOME would open) is not dialled behind the sponsored frame
    const L = X.linkGet(from, to); const e = lEnd(from, to); X.linkTx(from);
    if (L.state === LK_NONE && (namesOwned(from, to) || fab.farView(sf, to).seat === -1)) X.startDial(from, to, L);   // the page's reconciler dials its LINK peers
    else if (L.state === LK_CLOSED && L.view[e] === LK_CLOSED && !namesOwned(from, to) && TICK() - L.askAt >= K.LINK_ASK_GAP) { L.askAt = TICK(); X.startDial(from, to, L); }
    return true;
  }

  // C++: mesh_fhop.inc:fhopSponsorDrop   (fabricSend's drop points: sponsorSend's rungs)
  function fhopSponsorDrop(from, to, m) {
    if (from < 0 || to < 0 || from === to) return false; fhEnsure(); X.lEnsure(Math.max(from, to));
    return fhopSponsor(from, to, m);
  }

  // C++: mesh_fhop.inc:fhopRouteDrop
  // A routing frame in transit at a seat whose ideal next hop is vacant: the parent's routeStep drops it; the page's
  // fwdOnward tries the other rungs toward the seat its occ names at rdst.
  function fhopRouteDrop(m) {
    const s = seats[m.to]; if (!s.hasCoord) return false;
    const st = TICK() - s.clkHeld;
    const leaseHit = (s.leaseUntil >= 0 && st <= s.leaseUntil && ckey(m.rdst) === s.leaseCk) || (s.moving && ckey(m.rdst) === s.oldCk);
    if (ckey(s.coord) === ckey(m.rdst) || leaseHit || m.rttl <= 0) return false;
    if (s.strictNextHop(m.rdst) >= 0) return false;
    if (X.fabricDoors() && m.rfinal >= 0 && (m.t === 'PLACE' || m.t === 'NOROOM' || m.t === 'FINDACK')) return false;   // L16.3: an answer to a seeker outside is the answer door's
    const tgt = m.rfinal >= 0 ? m.rfinal : s.occGet(ckey(m.rdst)); if (tgt < 0 || tgt === m.to) return false;
    const env = msg.clone(m); env.rttl = m.rttl - 1; env.rvia = m.to; env.fhTo = tgt; env.fhOrig = m.to; env.fhTtl = P('FHOP_TTL'); env.fhId = ++lv.FH_SEQ; env.fhTc = ckey(m.rdst) + 1;
    FHS[15]++; fhopOnward(m.to, env, m.from); return true;
  }

  // C++: mesh_fhop.inc:fhopIntercept   (the bus hands a frame to a live, running seat: envelopes are the page's, not the seat's)
  function fhopIntercept(m) {
    const to = m.to;
    if (m.fhTo >= 0) {
      const via = m.from;
      fhNoteCrumb(to, m.fhOrig, via);
      if (m.t === 'FIND' && m.nc >= 0) fhNoteCrumb(to, m.nc, via);
      if (m.fhTo === to) { m.fhTo = -1; m.from = m.fhOrig; m.lk = -1; FHS[14]++; return false; }   // mine: to the seat, the origin's own claim, never `direct`
      fhopOnward(to, m, via); return true;
    }
    if (m.from >= 0 && m.t === 'FIND' && m.nc >= 0) fhNoteCrumb(to, m.nc, m.from);   // an entry ask names its knocker: the channel it came in on leads back
    if (m.routing && fhopRouteDrop(m)) return true;
    return false;
  }

  // ---- the status beat's conns, and media through a friend -------------------------------------------------------
  // C++: mesh_fhop.inc:fhSend   (dcSend over our channel: arrives next tick unless my direction is dead)
  function fhSend(from, to, kind, target) {
    const L = X.linkFind(from, to); if (!L || L.view[lEnd(from, to)] !== LK_OPEN || L.state !== LK_OPEN || (L.half & (1 << lEnd(from, to)))) return;
    ins(fab.FHMQ, TICK() + 1, () => []).push({ kind, from, to, target });
  }
  // C++: mesh_fhop.inc:fhHasStream   (tp.stream: t's camera reaches r only if r is t's row-mate (camPeer); unknown seat = true)
  function fhHasStream(r, t) {
    const s = seats[r]; if (!s.hasCoord) return true; const k = fhKeyOf(r, t); if (!k) return true; const c = unckey(k - 1);
    return c.pc === s.coord.pc && c.r === s.coord.r;
  }
  // C++: mesh_fhop.inc:fhStopRelay
  function fhStopRelay(s, t, notify) { const it = fab.FH[s].peer.get(t); if (it === undefined || it.via < 0) return; if (notify) fhSend(s, it.via, 4, t); it.via = -1; it.claimAt = -1; }
  // C++: mesh_fhop.inc:fhDropJob
  function fhDropJob(r, i, tellReq, why) { const j = Object.assign({}, fab.FH[r].jobs[i]); fab.FH[r].jobs.splice(i, 1); FHM[3]++; if (tellReq) fhSend(r, j.req, 5, j.target); }
  // C++: mesh_fhop.inc:fhEndRoles   (endRelayRolesFor: pid left or its pc died)
  function fhEndRoles(me, pid) {
    for (let i = 0; i < fab.FH[me].jobs.length;) { const j = fab.FH[me].jobs[i]; if (j.target === pid) { fhDropJob(me, i, true, 'roles-target'); continue; } if (j.req === pid) { fhDropJob(me, i, false, 'roles-req'); continue; } i++; }
    fhStopRelay(me, pid, true);
    for (const [k, e] of fab.FH[me].peer) if (e.via === pid) fhStopRelay(me, k, false);
  }
  // C++: mesh_fhop.inc:fhOnMsg
  function fhOnMsg(x) {
    if (x.to >= lv.nextId || !alive[x.to] || fab.isFrozen(x.to)) return;   // a stopped renderer loses it
    const me = x.to, from = x.from, t = x.target; const F = fab.FH[me];
    if (x.kind === 1) {   // startRelayJob
      for (const j of F.jobs) if (j.target === t && j.req === from) return;
      if (!fhConn(me, t) || !fhHasStream(me, t) || !fhConn(me, from) || F.jobs.length >= P('FHOP_MAX_JOBS') || fhWebkit(me)) { FHM[1]++; fhSend(me, from, 2, t); return; }
      F.jobs.push({ target: t, req: from, at: TICK() }); FHM[2]++; fhSend(me, from, 3, t);
    } else if (x.kind === 2) { ins(F.peer, t, newFhPeer).refused.set(from, TICK()); }
    else if (x.kind === 3) { const Pp = ins(F.peer, t, newFhPeer); Pp.via = from; Pp.claimAt = TICK() + P('FH_RENEG'); FHM[4]++; }
    else if (x.kind === 4) { for (let i = 0; i < F.jobs.length; i++) if (F.jobs[i].target === t && F.jobs[i].req === from) { fhDropJob(me, i, false, 'stop'); break; } }
    else if (x.kind === 5) { const it = F.peer.get(t); if (it !== undefined && it.via === from) fhStopRelay(me, t, false); }
  }
  // C++: mesh_fhop.inc:fhSweep
  function fhSweep(s) {
    const st = seats[s]; const F = fab.FH[s];
    const W = new Set();   // my link peers (linkTo: the occupants my seat's owned links name)
    if (st.hasCoord && st.state === 3) { for (const c of ownedLinks(st.coord)) { const x = st.occGet(ckey(c)); if (x >= 0 && x !== s) W.add(x); } }
    {
      const rel = new Set(); for (const [k, e] of F.peer) { rel.add(k); if (e.via >= 0) rel.add(e.via); } for (const j of F.jobs) { rel.add(j.target); rel.add(j.req); }
      for (const k of [...F.unlinked.keys()]) { if (W.has(k) || !rel.has(k)) F.unlinked.delete(k); }
      const rv = [...rel]; rv.sort((a, b) => a - b);
      for (const x of rv) {
        if (W.has(x)) continue; const u = F.unlinked.get(x); if (u === undefined) { F.unlinked.set(x, TICK()); continue; }
        if (TICK() - u > P('FH_UNLINK')) { fhEndRoles(s, x); F.peer.delete(x); F.unlinked.delete(x); }
      }
    }   // a pair the arithmetic no longer wants is dropped after its grace: every relay role through it ends
    for (let i = 0; i < F.jobs.length;) {   // a target's or requester's pc closed here: the job ends
      const j = F.jobs[i];
      if (!fhDc(s, j.target)) { fhDropJob(s, i, true, 'target-closed'); continue; } if (!fhDc(s, j.req)) { fhDropJob(s, i, false, 'req-closed'); continue; } i++;
    }
    const ws = [...W]; ws.sort((a, b) => a - b);
    for (const t of ws) {
      const Pp = ins(F.peer, t, newFhPeer); const conn = fhConn(s, t);
      if (conn && Pp.via >= 0) fhStopRelay(s, t, true);
      if (Pp.via >= 0 && !fhConn(s, Pp.via)) fhStopRelay(s, t, false);
      if (!conn && Pp.via < 0 && Pp.downSince >= 0 && TICK() - Pp.downSince > P('FHOP_RELAY_ASK') && TICK() - Pp.askAt > P('FHOP_RELAY_ASK')) {
        for (const r of fhConns(s)) {
          if (r === t || !fhClaims(s, r, t)) continue; const rf = Pp.refused.get(r); if (rf !== undefined && TICK() - rf < P('FHOP_REFUSE_HOLD')) continue;
          Pp.askAt = TICK(); FHM[0]++; fhSend(s, r, 1, t); break;
        }
      }
      if (conn) Pp.downSince = -1; else if (Pp.downSince < 0) Pp.downSince = TICK();
    }
  }
  // C++: mesh_fhop.inc:fhopTick   (the start of every tick under FHOP (after the link events): beats land, relay frames land, beats leave, sweeps run)
  function fhopTick() {
    fhEnsure();
    while (fab.FHGQ.size > 0 && minKey(fab.FHGQ) <= TICK()) {
      const k = minKey(fab.FHGQ); const v = fab.FHGQ.get(k); fab.FHGQ.delete(k);
      for (const g of v) { const p = g[0], r = g[1]; if (p < lv.nextId && alive[p] && !fab.isFrozen(p)) { fab.FH[p].conns.set(r, g[2]); fab.FH[p].nat.set(r, (lv.NETGRP && grpOf(r) >= 0) ? fab.NETG[grpOf(r)].type : -1); } }   // the beat carries the sender's NAT kind too
    }
    while (fab.FHMQ.size > 0 && minKey(fab.FHMQ) <= TICK()) { const k = minKey(fab.FHMQ); const v = fab.FHMQ.get(k); fab.FHMQ.delete(k); for (const x of v) fhOnMsg(x); }
    const n = lv.nextId;
    for (let r = 0; r < n; r++) {   // which pairs each page still wants (a stopped page retires nothing)
      const lp = X.linkPeers(r); if (!alive[r] || lp.length === 0) continue; const st = seats[r]; const wt = fab.FH[r].want;
      if (fab.isFrozen(r) || !st.hasCoord || st.state !== 3) { for (const p of lp) wt.set(p, TICK()); continue; }
      const W = []; st.linkPeers(W, E.LR_OWNED | E.LR_E2);   // the seats this page names (an owned link or E2/E3): linkPeers, sorted
      for (const p of lp) { const outside = p < lv.nextId && alive[p] && seats[p].state !== 3;
        if (bsearch(W, p) || outside) wt.set(p, TICK()); else if (!wt.has(p)) wt.set(p, TICK()); }   // a door stays while its knocker is outside; any other pair keeps the grace from the last tick it was wanted
    }
    for (let r = 0; r < n; r++) {
      const lp = X.linkPeers(r); if (!alive[r] || fab.isFrozen(r) || lp.length === 0) continue;
      const c = fhConns(r); const F = fab.FH[r];
      const same = F.sentOk && c.length === F.sent.length && c.every((v, i) => v === F.sent[i]);
      if (same && (TICK() + r) % P('FHOP_BEAT') !== 0) continue;
      if (!same) F.sent = c; F.sentOk = true;
      for (const p of lp) { const L = X.linkFind(r, p); if (!L || L.state !== LK_OPEN || L.view[lEnd(r, p)] !== LK_OPEN || (L.half & (1 << lEnd(r, p)))) continue; ins(fab.FHGQ, TICK() + 1, () => []).push([p, r, F.sent]); }
    }
    for (let s = 0; s < lv.nextId; s++) { if (!alive[s] || fab.isFrozen(s) || (TICK() + s) % P('FHOP_SWEEP') !== 0) continue; fhSweep(s); }
  }

  // ---- the seat-facing calls (js/mesh/fhop.js) and the plug ---------------------------------------------------------
  const ctx = { lv, K, seats, alive, X, get FH() { return fab.FH; }, get NETG() { return fab.NETG; }, grpOf, fhopActive, fhConns, fhClaims, fhDc };
  fab.fhop = { ctx, fhConn, fhConns, fhDc, fhClaims, fhKeyOf, fhNextHop, fhopSponsor, fhopOnward, fhopRouteDrop, fhSweep, fhOnMsg, fhWebkit, fhEnsure, fhHasStream };
  fab.plug({
    fhopActive, fhopReset, fhopSchedule, fhopSponsorDrop, fhopIntercept, fhopTick,
    fhopFriendFor: (me, to) => fhopSeat.fhopFriendFor(ctx, me, to),
    fabricUnreachable: (me, x) => fhopSeat.fabricUnreachable(ctx, me, x),
    fabricFreeCells: (pc, r) => fhopSeat.fabricFreeCells(ctx, pc, r),
  });
  return fab;
}

// ---- the measurement and the lever (C++ mesh_fhop.inc after fhopTick): `fhop on|off|measure|webkit|heal|why|jobs`, `fhstat`
// Person pairs whose audio and video reach each other: the page sends a person's camera and mic to its ROW-MATES only
// (camPeer), so the pairs measured are row-mate pairs, by the seats' true cells. fhMeasureTick never changes the
// trajectory; `fhop heal` runs ticks (and `freeze` through runOp). installFhopLever(fab, runOp) needs installFhop first.
function installFhopLever(fab, runOp) {
  const { lv, seats, alive, X, w } = fab;
  const P = (...a) => fab.printf(...a);
  const TICK = () => w.TICK;
  const F = fab.fhop; const fhEnsure = F.fhEnsure;
  const S = { FHMEAS: false, FHM_PEAKJOBS: 0, FHM_PEAKAT: -1, FHM_PEAKSEAT: -1, FHM_PEAKRELAYERS: 0 };
  fab.fhopMeas = S;
  const grpOf = (id) => (id >= 0 && id < fab.SEATGRP.length) ? fab.SEATGRP[id] : -1;   // C++: mesh_net.inc:grpOf
  const grpByName = (n) => { for (let g = 0; g < fab.NETG.length; g++) if (fab.NETG[g].name === n) return g; return -1; };   // C++: mesh_net.inc:grpByName
  const atoll = (s) => { const v = parseInt(s, 10); return Number.isNaN(v) ? 0 : v; };
  const atof = (s) => { const v = parseFloat(s); return Number.isNaN(v) ? 0 : v; };

  // C++: mesh_fhop.inc:fhRun
  const fhRun = (q) => q >= 0 && q < lv.nextId && !!alive[q] && !fab.isFrozen(q) && seats[q].state === 3 && seats[q].hasCoord;
  // C++: mesh_fhop.inc:fhFlow   (frames a sends reach b)
  const fhFlow = (a, b) => { if (!fhRun(a) || !fhRun(b)) return false; const L = X.linkFind(a, b); return !!L && L.state === LK_OPEN && !(L.half & (1 << lEnd(a, b))); };
  // C++: mesh_fhop.inc:fhCam   (t still sends its camera to r: camPeer from t's side)
  const fhCam = (t, r) => { const s = seats[t]; const k = F.fhKeyOf(t, r); if (!k) return true; const c = unckey(k - 1); return c.pc === s.coord.pc && c.r === s.coord.r; };
  // C++: mesh_fhop.inc:fhRx   (does t's stream reach s now? 0 no, 1 direct, 2 through a friend)
  function fhRx(s, t) {
    if (fhFlow(t, s)) return 1;
    const FH = fab.FH; if (s >= FH.length) return 0; const Pp = FH[s].peer.get(t); if (Pp === undefined) return 0;
    if (Pp.via < 0 || Pp.claimAt > TICK()) return 0; const r = Pp.via; let job = false; if (r < FH.length) for (const j of FH[r].jobs) if (j.target === t && j.req === s) { job = true; break; }
    return (job && fhFlow(t, r) && fhCam(t, r) && fhFlow(r, s)) ? 2 : 0;
  }
  // C++: mesh_fhop.inc:fhRows   (OMap: rows in the order their first seat is met)
  function fhRows() { const rows = new Map(); for (let q = 0; q < lv.nextId; q++) if (fhRun(q)) { const k = seats[q].coord.pc * 256 + seats[q].coord.r; let v = rows.get(k); if (v === undefined) { v = []; rows.set(k, v); } v.push(q); } return rows; }
  // C++: mesh_fhop.inc:fhMeasureTick
  function fhMeasureTick() {
    if (!S.FHMEAS) return; fhEnsure(); const FH = fab.FH;
    const rows = fhRows();
    for (const M_ of rows.values()) {
      if (M_.length < 2) continue;
      for (const s of M_) { let got = 0; for (const t of M_) if (t !== s && fhRx(s, t)) got++;
        if (got > 0 && FH[s].firstMedia < 0) FH[s].firstMedia = TICK(); if (got === M_.length - 1 && FH[s].fullMedia < 0) FH[s].fullMedia = TICK(); }
    }
    let relayers = 0; for (let q = 0; q < lv.nextId; q++) if (q < FH.length && FH[q].jobs.length && alive[q]) { relayers++; if (FH[q].jobs.length > S.FHM_PEAKJOBS) { S.FHM_PEAKJOBS = FH[q].jobs.length; S.FHM_PEAKSEAT = q; S.FHM_PEAKAT = TICK(); } }
    if (relayers > S.FHM_PEAKRELAYERS) S.FHM_PEAKRELAYERS = relayers;
  }
  // C++: mesh_fhop.inc:fhStat
  function fhStat(tk) {
    fhEnsure(); const FH = fab.FH; const FHS = fab.FHS, FHM = fab.FHM; let g = -1;
    if (tk.length > 1) { g = grpByName(tk[1]); if (g < 0) { P('ERR fhstat [group]: no group %s\n', tk[1]); return; } }
    const rows = fhRows();
    let upairs = 0, both = 0, oneway = 0, none = 0, orx = 0, odir = 0, orel = 0, unreach = 0, unreachBoth = 0, seated = 0, lone = 0, darkRow = 0, partRow = 0, noLink = 0, relayers = 0, jobs = 0;
    for (let q = 0; q < lv.nextId; q++) if (fhRun(q)) { seated++; let any = false; X.lEnsure(q); for (const p of X.linkPeers(q)) if (fhFlow(q, p) || fhFlow(p, q)) { any = true; break; } if (!any) noLink++; }
    for (const M_ of rows.values()) {
      if (M_.length < 2) { lone += M_.length; continue; }
      for (const s of M_) { let got = 0; for (const t of M_) if (t !== s) { const r = fhRx(s, t); if (r) { got++; orx++; if (r === 1) odir++; else orel++; } } if (got === 0) darkRow++; else if (got < M_.length - 1) partRow++; }
      for (let a = 0; a < M_.length; a++) for (let b = a + 1; b < M_.length; b++) {
        const x = M_[a], y = M_[b]; upairs++; const xy = fhRx(x, y) !== 0, yx = fhRx(y, x) !== 0; if (xy && yx) both++; else if (xy || yx) oneway++; else none++;
        if (lv.NETGRP && !X.grpReach(x, y)) { unreach++; if (xy && yx) unreachBoth++; }
      }
    }
    for (let q = 0; q < lv.nextId && q < FH.length; q++) if (alive[q] && FH[q].jobs.length) { relayers++; jobs += FH[q].jobs.length; }
    let opairs = 0; for (const v of rows.values()) { const m = v.length; if (m >= 2) opairs += m * (m - 1); }
    P('FHSTAT t=%lld fhop=%d seated=%d rowpairs=%lld both=%lld oneway=%lld none=%lld reach=%.4f rx=%.4f direct=%lld relayed=%lld unreachpairs=%lld unreachboth=%lld lone=%d norowmedia=%d partrowmedia=%d nolink=%d relayers=%d jobs=%d peakjobs=%lld peakstreams=%lld peakrelayers=%d asks=%lld refused=%lld started=%lld ended=%lld claimed=%lld env: sponsored=%lld friend=%lld nexthop=%lld crumb=%lld last=%lld swallow=%lld none=%lld t_next=%lld t_friend=%lld t_crumb=%lld t_last=%lld t_stuck=%lld dedup=%lld ttl=%lld delivered=%lld routedrop=%lld\n',
      TICK(), X.fhopActive() ? 1 : 0, seated, upairs, both, oneway, none, upairs ? both / upairs : 1.0, opairs ? orx / opairs : 1.0, odir, orel, unreach, unreachBoth, lone, darkRow, partRow, noLink, relayers, jobs, S.FHM_PEAKJOBS, 2 * S.FHM_PEAKJOBS, S.FHM_PEAKRELAYERS,
      FHM[0], FHM[1], FHM[2], FHM[3], FHM[4], FHS[0], FHS[1], FHS[2], FHS[3], FHS[4], FHS[5], FHS[6], FHS[7], FHS[8], FHS[9], FHS[10], FHS[11], FHS[12], FHS[13], FHS[14], FHS[15]);
    if (g >= 0 || tk.length > 1) {   // time to media for the seats of one group, from spawn (ticks); -1 = never so far
      const f1 = [], fa = []; let n = 0, never1 = 0, neverA = 0, alone = 0;
      const loneSeat = new Set(); for (const v of rows.values()) if (v.length < 2) for (const q of v) loneSeat.add(q);   // a seat alone in its row has no row-mate to miss
      const SP = fab.SPAWNT;
      for (let q = 0; q < lv.nextId; q++) {
        if (grpOf(q) !== g || q >= SP.length || SP[q] < 0) continue;
        if (loneSeat.has(q) && !(q < FH.length && FH[q].fullMedia >= 0)) { alone++; continue; }   // a seat sitting alone is not counted against full media
        n++;
        if (q < FH.length && FH[q].firstMedia >= 0) f1.push(FH[q].firstMedia - SP[q]); else never1++;
        if (q < FH.length && FH[q].fullMedia >= 0) fa.push(FH[q].fullMedia - SP[q]); else neverA++;
      }
      const pct = (v, p) => { if (!v.length) return -1; v.sort((a, b) => a - b); const i = Math.min(v.length - 1, Math.floor((v.length * p + 99) / 100) - 1); return v[i]; };
      P('FHJOIN group=%s n=%d first_p50=%lld first_p95=%lld first_never=%d full_p50=%lld full_p95=%lld full_max=%lld full_never=%d alone=%d\n', fab.NETG[g].name, n, pct(f1, 50), pct(f1, 95), never1, pct(fa, 50), pct(fa, 95), fa.length ? Math.max(...fa) : -1, neverA, alone);
    }
  }
  // C++: mesh_fhop.inc:fhHeal   (`fhop heal leave|freeze [window] [freeze ticks]`)
  function fhHeal(tk) {
    const how = tk.length > 2 ? tk[2] : 'leave'; const win = tk.length > 3 ? atoll(tk[3]) : 400; const fz = tk.length > 4 ? atoll(tk[4]) : win + 50;
    fhEnsure(); const FH = fab.FH; let r = -1, best = 0;
    for (let q = 0; q < lv.nextId && q < FH.length; q++) if (fhRun(q) && FH[q].jobs.length > best) { best = FH[q].jobs.length; r = q; }
    if (r < 0) { P('FHHEAL how=%s none (no relaying seat)\n', how); return; }
    const pr = []; for (const j of FH[r].jobs) if (fhRx(j.req, j.target) === 2) pr.push([j.req, j.target]);
    if (how === 'freeze') runOp(['freeze', String(r), String(fz)]);
    else { seats[r].leave(); lv.N--; }
    const back = new Array(pr.length).fill(-1);
    for (let k = 1; k <= win; k++) { fab.doTick(); w.TICK++;
      for (let i = 0; i < pr.length; i++) if (back[i] < 0 && fhRx(pr[i][0], pr[i][1])) back[i] = k; }
    const ok = []; let never = 0, gone = 0; for (let i = 0; i < pr.length; i++) { if (!fhRun(pr[i][0]) || !fhRun(pr[i][1])) { gone++; continue; } if (back[i] < 0) never++; else ok.push(back[i]); }
    ok.sort((a, b) => a - b);
    P('FHHEAL how=%s relayer=%d jobs=%zu carried=%zu healed=%zu never=%d gone=%d p50=%lld max=%lld window=%lld\n', how, r, best, pr.length, ok.length, never, gone, ok.length ? ok[ok.length >> 1] : -1, ok.length ? ok[ok.length - 1] : -1, win);
  }
  // C++: mesh_fhop.inc:fhopLever
  function fhopLever(tk) {
    if (tk[0] === 'fhstat') { fhStat(tk); return; }
    const sub = tk.length > 1 ? tk[1] : '';
    if (sub === 'measure') { const wd = tk.length > 2 ? tk[2] : 'on'; if (wd === 'reset') { fhEnsure(); for (const f of fab.FH) { f.firstMedia = -1; f.fullMedia = -1; } S.FHM_PEAKJOBS = 0; S.FHM_PEAKSEAT = -1; S.FHM_PEAKAT = -1; S.FHM_PEAKRELAYERS = 0; } else S.FHMEAS = (wd !== 'off'); P('OK fhop measure %s\n', wd); return; }
    if (sub === 'on' || sub === 'off') { fab.FHOP_ON = (sub === 'on'); P('OK fhop %s (active=%d: needs linkmodel 1 and no lawoff FHOP)\n', sub, X.fhopActive() ? 1 : 0); return; }
    if (sub === 'webkit') { lv.FH_WEBKIT = tk.length > 2 ? atof(tk[2]) : 0; P('OK fhop webkit=%.2f\n', lv.FH_WEBKIT); return; }
    if (sub === 'heal') { fhHeal(tk); return; }
    if (sub === 'why') {   // unreached row pairs with no direct path: what the receiver sees
      fhEnsure(); const FH = fab.FH; let shown = 0; const rows = fhRows();
      for (const v of rows.values()) for (const s of v) for (const t of v) {
        if (s === t || fhRx(s, t) || shown >= 20) continue; if (lv.NETGRP && X.grpReach(s, t)) continue; shown++;
        const it = FH[s].peer.get(t);
        P('FHWHY req=%d target=%d watched=%d down=%lld ask=%lld via=%d cands:', s, t, it !== undefined ? 1 : 0, it !== undefined ? TICK() - it.downSince : -1, it !== undefined ? TICK() - it.askAt : -1, it !== undefined ? it.via : -1);
        for (const r of F.fhConns(s)) if (r !== t) {
          const cl = F.fhClaims(s, r, t); const ct = F.fhConn(r, t); if (!cl && !ct) continue;
          let rf = -1; if (it !== undefined) { const q = it.refused.get(r); if (q !== undefined) rf = TICK() - q; }
          P(' %d(claims=%d conn=%d stream=%d jobs=%zu refusedAgo=%lld)', r, cl ? 1 : 0, ct ? 1 : 0, F.fhHasStream(r, t) ? 1 : 0, FH[r].jobs.length, rf);
        }
        P('\n');
      }
      P('OK fhop why\n'); return;
    }
    if (sub === 'jobs') {
      fhEnsure(); const FH = fab.FH;
      for (let q = 0; q < lv.nextId; q++) for (const j of FH[q].jobs) {
        const row = fhRun(j.target) && fhRun(j.req) && seats[j.target].coord.pc === seats[j.req].coord.pc && seats[j.target].coord.r === seats[j.req].coord.r;
        P('FHJOB relayer=%d at=%s target=%d req=%d since=%lld rowpair=%d flowing=%d\n', q, fhRun(q) ? fab.coordStr(seats[q].coord) : '-', j.target, j.req, j.at, row ? 1 : 0, fhRx(j.req, j.target) === 2 ? 1 : 0);
      }
      P('OK fhop jobs\n'); return;
    }
    P('ERR usage: fhop on|off | fhop measure on|off|reset | fhop webkit <frac> | fhop heal leave|freeze [window] [freeze ticks] | fhstat [group]\n');
  }

  fab.plug({ fhopLever, fhMeasureTick });
  return { fhopLever, fhMeasureTick, fhStat, fhRx };
}

module.exports = { installFhop, installFhopLever, lEnd, bsearch };
