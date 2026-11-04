'use strict';
/*
 * fabric.js: the harness fabric (port plan H1), a line-for-line port of the fabric part of the sim's mesh.cpp:
 * the bus, schedule / schedL10, fabricSend, the relay's knock, the tick (doTick), trace, initSim, converge and
 * counts. Harness code: it runs the JS seats (js/mesh/seat.js and its units) the way the C++ sim runs its
 * seats, and writes the MESH_PROOF files (frames.jsonl, hash.jsonl) the C++ run writes. It is never shipped.
 *
 *   const fab = createFabric({ proofDir, traceFile, levers });
 *   fab.initSim(n, leave); fab.converge(cap); fab.counts();
 *
 * THE WORLD. `fab.w` is the seat's world (seat.js newWorld): w.TICK, w.lv (this fabric's own copy of the sim's
 * globals, consts.js levers), w.f (the 52 fabric calls a seat makes) and w.trace. Seats are made with
 * `new Seat(id, fab.w)`.
 *
 * THE FABRIC'S STATE is the C++ `namespace fabric`: fab.seats, fab.alive, fab.active / fab.nextActive, fab.bus
 * (a Map tick -> frames), fab.openPairs, fab.relayGreeters, fab.sockCloseAt, fab.forcedSever, fab.severedUntil,
 * fab.partSide / DARK, fab.reachMx, fab.ADMIT_LOG, and the containers the later harness units fill (KILLQ,
 * FROZEN, SLOW, RESUMEQ, RELOADQ, RELCLOSEQ, NETG, SEATGRP, NETCUT, NETLIFT, METER, MOVECNT ...). Counters
 * and scalars (SEQ, L10SEQ, GSEED, nextId, N ...) are fab.lv.<name>, as the seats' levers are.
 *
 * WHAT IS NOT HERE (other jobs) is reached through fab.X, a table of externals. fab.plug({ name: fn, ... })
 * installs a unit's functions; an external nobody plugged throws "not wired" when called, except where the
 * C++ call is a no-op or has a fixed answer with its feature off (listed in DEFAULTS). Every call the
 * harness makes to an external sits behind the same condition as in the C++ (LINKMODEL, NETGRP, tfx, fhop).
 *   link physics (H2)  linkTick linkSchedule linkOpenFor linkFind closeFrom linkBlackhole linkOnLeave
 *                      crashTransport linkReset closedDrop  + fabricLinkState fabricDial fabricDialJoin
 *                      fabricDialUplink fabricDialFails fabricUpTake fabricUpDecline fabricDoorDrop
 *                      fabricDoorHanded fabricMyDoors fabricMyKnocks fabricNoSock fabricL23Busy
 *                      fabricCallFrame l22Need l22Quiet l22Close l22CloseAsk l22Agree l222Note l28Reply
 *   time (H2)          timeTick freezeHold slowSkip fabricReloadBye fabricVerdict
 *   net (H2)           netTick netRefuse grpReach netKnockOk netSetGrp netNoteSpawn netNoteTake netPlanArrivals
 *   friend-hop (H4)    fhopActive fhopSchedule fhopSponsorDrop fhopIntercept fhopTick fhMeasureTick fhopReset
 *                      fhopFriendFor fabricUnreachable fabricFreeCells
 *   tiers (H3)         fabricMyTier fabricMyNat fabricLieFor fabricNoteSwap
 *   pc laws (S11)      l18Route l18Cell l18Hop l18Deliv l18UxDeliv
 *   measurement        mediaTick mgapTick hostileTickF ijTick lguardFabTick descEnd descNote (no-ops here)
 *   l18 (l18.js)       l18UxOrigin l18RoutedNote (under lv.L18MEAS)
 *   realcheck          rcNoteSend rcNoteRecv rcTick (realcheck.js; called only under lv.RC_ON; link.js calls rcNoteDial)
 *
 * NOT PORTED, on purpose: the threaded tick (the harness is serial, like MESH_THREADS=1), the descent instrument,
 * the MESH_*DBG / L13DBG / FARVDBG / MESH_DUPLOG stderr prints, and MESH_PROOF's tapes (frames.jsonl and hash.jsonl only).
 */
const fs = require('fs'), path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const C_ = require(path.join(M, 'consts.js'));
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));
const hash = require(path.join(M, 'hash.js'));
const fmt = require(path.join(M, 'fmt.js'));
const fnv = require(path.join(M, 'fnv.js'));
const state = require(path.join(M, 'state.js'));
const seatM = require(path.join(M, 'seat.js'));

const { Seat, FABRIC_CALLS, newWorld, islandStand, l13Frame } = seatM;
const K = C_.consts, E = C_.enums;
const { ckey, ownedLinks, lastDigit, parentPath } = topo;
const { LS_NONE, LS_DIALING, LS_OPEN, LK_OPEN } = E;
const MT_INDEX = new Map(msg.MT_NAMES.map((n, i) => [n, i]));

// C++: mesh.cpp:keyHash
function keyHash(k) { k = hash.fmix32((k ^ 0x6b657968) >>> 0); return k ? k : 1; }
// C++: mesh.cpp:pairKey
// A pair with a negative id (a frame to nobody: emit(-1, ...)) has a u64 key above 2^53 in C++, which a JS number
// rounds onto one value for every seat; such a pair gets an exact string key (a distinct pair, as in the C++ set).
function pairKey(a, b) { return a < b ? hash.idPair(a, b) : hash.idPair(b, a); }

// The externals that have a fixed answer with the feature off (so a room without the unit can still run).
// Each is a one-line reading of the C++; the unit's own function replaces it through fab.plug.
function defaults(fab) {
  const lv = fab.lv;
  return {
    // C++: mesh_link.inc:fabricLinkState  (linkmodel 0: my end reads open, nothing to re-dial)
    fabricLinkState: (me, x) => { if (!lv.LINKMODEL) return LS_OPEN; throw notWired('fabricLinkState'); },
    // C++: mesh_link.inc:fabricDoors
    fabricDoors: () => lv.LINKMODEL,
    // C++: mesh_link.inc:fabricNoteBackoff
    fabricNoteBackoff: () => { lv.L16_BACKOFF++; },
    // C++: mesh_link.inc:linkBlackhole
    linkBlackhole: (id) => { if (lv.LINKMODEL) throw notWired('linkBlackhole'); },
    // C++: mesh_link.inc:linkOnLeave
    linkOnLeave: (id) => { if (lv.LINKMODEL) throw notWired('linkOnLeave'); },
    // C++: mesh_link.inc:crashTransport
    crashTransport: (id) => { if (lv.LINKMODEL) throw notWired('crashTransport'); fab.fireTranslost(id); },
    // C++: mesh_link.inc:linkReset  (no tables of its own here)
    linkReset: () => {},
    // C++: mesh_link.inc:closedDrop
    closedDrop: (m) => { if (!lv.LINKMODEL || m.lk < 0 || m.lk === m.to || m.to < 0 || m.lk >= lv.nextId) return false; throw notWired('closedDrop'); },
    // C++: mesh_net.inc:netNoteSpawn / netNoteTake  (the join-time log: no seat reads it)
    netNoteSpawn: () => {}, netNoteTake: () => {},
    // C++: mesh_fhop.inc:fhopActive / fhopReset / fhMeasureTick
    fhopActive: () => false, fhopReset: () => {}, fhMeasureTick: () => {},
    // C++: mesh_tierfab.inc:fabricMyTier / fabricMyNat / fabricLieFor / fabricNoteSwap  (no tiers lever, no groups)
    fabricMyTier: () => E.TIER_DESKTOP, fabricMyNat: () => E.NAT_OPEN, fabricLieFor: (id, ct, cn) => [id, ct, cn], fabricNoteSwap: () => {},
    // measurement hooks: never read by a seat
    mediaTick: () => {}, mgapTick: () => {}, hostileTickF: () => {}, ijTick: () => {}, descEnd: () => {}, descNote: () => {},
    fabricVerdict: () => {},
  };
}
function notWired(name) { return new Error('mesh fabric: ' + name + ' is not wired (plug it with fab.plug)'); }

// The externals the harness calls that are not seat calls.
const EXTERNALS = [
  'linkTick', 'linkSchedule', 'linkOpenFor', 'linkFind', 'closeFrom', 'linkBlackhole', 'linkOnLeave', 'crashTransport', 'linkReset', 'closedDrop',
  'timeTick', 'freezeHold', 'slowSkip', 'netTick', 'netRefuse', 'grpReach', 'netKnockOk', 'netSetGrp', 'netNoteSpawn', 'netNoteTake', 'netPlanArrivals',
  'fhopActive', 'fhopSchedule', 'fhopSponsorDrop', 'fhopIntercept', 'fhopTick', 'fhMeasureTick', 'fhopReset',
  'l18Route', 'l18Cell', 'l18UxOrigin', 'l18RoutedNote', 'rcNoteSend', 'rcNoteRecv', 'rcTick', 'rcNoteDial', 'mediaTick', 'mgapTick', 'hostileTickF', 'ijTick', 'lguardFabTick',
];

function createFabric(opts) {
  opts = opts || {};
  // This fabric's own copy of the sim's globals (a shared lever table would couple two rooms).
  const lv = Object.assign({}, C_.levers, opts.levers || {});
  const fab = { lv, K, E };

  // ---- the files (MESH_PROOF) and the trace --------------------------------------------------------------
  const proof = { on: false, dir: null, frames: null, hash: null, state: null, buf: new Map(), nSend: 0, nRecv: 0, nHash: 0, last: new Map() };
  const out = (name) => { const fd = fs.openSync(path.join(proof.dir, name), 'w'); return { fd, s: '', bytes: 0 }; };
  const put = (f, line) => { f.s += line + '\n'; if (f.s.length > (1 << 20)) flush(f); };
  const flush = (f) => { if (f.s) { const b = Buffer.from(f.s, 'utf8'); fs.writeSync(f.fd, b); f.bytes += b.length; f.s = ''; } };
  if (opts.proofDir) {
    proof.on = true; proof.dir = opts.proofDir;
    fs.mkdirSync(path.join(proof.dir, 'tapes'), { recursive: true });
    proof.frames = out('frames.jsonl'); proof.hash = out('hash.jsonl');
    if (opts.proofState) proof.state = out('state.jsonl');
  }
  let traceF = null;
  if (opts.traceFile) traceF = out2(opts.traceFile);
  function out2(file) { return { fd: fs.openSync(file, 'w'), s: '', bytes: 0 }; }
  const traceSink = opts.traceSink || null;
  const traceOn = !!(traceF || traceSink);

  // ---- the seat's world --------------------------------------------------------------------------------
  const w = newWorld({ levers: lv, trace: null });
  Object.defineProperty(lv, 'TICK', { get: () => w.TICK, set: (v) => { w.TICK = v; }, enumerable: true, configurable: true });
  w.ADMIT_SITE = '?';
  fab.w = w;
  const TICK = () => w.TICK;

  // ---- the fabric's tables (C++ namespace fabric) --------------------------------------------------------
  Object.assign(fab, {
    seats: [], alive: [], active: new Set(), nextActive: new Set(),
    bus: new Map(), openPairs: new Set(), relayGreeters: new Map(), sockCloseAt: new Map(),
    forcedSever: new Map(), severedUntil: new Map(), partSide: [], DARK: new Set(), reachMx: [], ADMIT_LOG: new Map(), L915CH: new Map(),
    spawnPlan: [], JOINMODE: 'window', KICK_KNOCK: new Set(),
    KILLQ: new Map(),   // tick -> ids (a std::map: the earliest tick first)
    FROZEN: new Map(), SLOW: new Map(), RESUMEQ: new Map(), RELOADQ: new Map(), RELCLOSEQ: new Map(),
    NETG: [], SEATGRP: [], NETCUT: new Set(), NETLIFT: new Set(), METER: new Map(), planGrp: [],
    MOVECNT: [], SPAWNT: [], FIRSTSEAT: [], FIRSTHOME: [], LASTPLACE: [], LASTFIND: [], FIRSTHO: [], FIRSTTAKEN: [],
    TELE_BY_T: new Array(32).fill(0), TELE_SRC: [0, 0, 0, 0], FARV_LOST: 0,
  });
  const { seats, alive, bus, openPairs } = fab;
  lv.GSEED = lv.GSEED >>> 0;

  // ---- the externals ---------------------------------------------------------------------------------------
  const X = fab.X = {};
  const dflt = defaults(fab);
  fab.plug = (fns) => { for (const k of Object.keys(fns)) X[k] = fns[k]; };
  for (const n of new Set([...EXTERNALS, ...FABRIC_CALLS, ...Object.keys(dflt)])) X[n] = dflt[n] || ((...a) => { throw notWired(n); });

  // ---- the random streams ------------------------------------------------------------------------------------
  // C++: mesh.cpp:grnd
  const grnd = fab.grnd = () => { const s = lv.GSEED = ((Math.imul(lv.GSEED, 1103515245) + 12345) & 0x7fffffff) >>> 0; return s / 2147483648; };
  // C++: mesh.cpp:frnd
  const frnd = fab.frnd = () => { const s = lv.FSEED = ((Math.imul(lv.FSEED, 1103515245) + 12345) & 0x7fffffff) >>> 0; return s / 2147483648; };

  // ---- small readers ------------------------------------------------------------------------------------------
  // C++: mesh.cpp:cutBetween
  const cutBetween = fab.cutBetween = (from, to) => lv.PARTITIONED && from >= 0 && to >= 0 && from < fab.partSide.length && to < fab.partSide.length && fab.partSide[from] !== fab.partSide[to];
  // C++: mesh.cpp:darkPair
  const darkPair = fab.darkPair = (a, b) => fab.DARK.size > 0 && (fab.DARK.has(a) || fab.DARK.has(b));
  // C++: mesh.cpp:sockClosed
  const sockClosed = fab.sockClosed = (id) => { const t = fab.sockCloseAt.get(id); return t !== undefined && t <= TICK(); };
  // C++: mesh.cpp:reachable
  const reachable = fab.reachable = (sa, sb) => (fab.reachMx.length <= sa || fab.reachMx.length <= sb) ? true : fab.reachMx[sa][sb] !== 0;
  // C++: mesh_time.inc:isFrozen
  const isFrozen = fab.isFrozen = (id) => fab.FROZEN.size > 0 && fab.FROZEN.has(id);
  const inSeats = (i) => i >= 0 && i < seats.length;

  // C++: mesh.cpp:buildReach
  fab.buildReach = () => {
    const n = lv.NUM_SUBNETS;
    fab.reachMx = Array.from({ length: n }, () => new Array(n).fill(0));
    const mx = fab.reachMx;
    for (let a = 0; a < n; a++) { mx[a][a] = 1; if (lv.NET_SPINE && a > 0) { mx[a][a - 1] = mx[a - 1][a] = 1; } }
    const lo = lv.NET_SPINE ? 2 : 1;
    for (let a = 0; a < n; a++) for (let b = a + lo; b < n; b++) if (frnd() < lv.REACH_DENSITY) { mx[a][b] = mx[b][a] = 1; }
  };

  // ---- the bus ----------------------------------------------------------------------------------------------
  // C++: mesh_proof.inc:proofPush
  // The tap on every push (ProofSlot::push_back): the frame, the tick it is due, SEQ as it stands.
  function proofPush(due, m) {
    proof.nSend++;
    put(proof.frames, JSON.stringify({ e: 'send', t: TICK(), due, seq: lv.SEQ, m: msg.writeMsg(m) }));
  }
  // C++: mesh_proof_bus.inc:ProofSlot::push_back  (the one way a frame goes on the bus)
  const busPush = fab.busPush = (due, m) => {
    if (proof.on) proofPush(due, m);
    let slot = bus.get(due); if (!slot) { slot = []; bus.set(due, slot); }
    slot.push(m);
  };

  // C++: mesh.cpp:wake
  const wake = fab.wake = (id) => { fab.nextActive.add(id); };

  // C++: mesh.cpp:fabricKill
  const fabricKill = fab.fabricKill = (id, sockAt) => {
    alive[id] = 0; fab.active.delete(id); if (id >= 0 && id < seats.length && seats[id]) seats[id].dead = true;
    if (sockAt >= 0) fab.sockCloseAt.set(id, sockAt); else X.linkBlackhole(id);   // a blackhole death: its peer connections go silent both ways, no close event
  };
  // C++: mesh.cpp:fabricLeft
  const fabricLeft = fab.fabricLeft = (id) => { fabricKill(id, TICK()); X.linkOnLeave(id); };

  // ---- the transport's classification ------------------------------------------------------------------------
  // C++: mesh.cpp:l9AskFrame
  const l9AskFrame = (m) => m.t === 'ROUTE' || m.t === 'ROUTED' || (m.t === 'E1STATE' && m.tag === 3);
  // C++: mesh.cpp:l18Frame
  const l18Frame = fab.l18Frame = (m) => l9AskFrame(m) || l13Frame(m);
  // C++: mesh.cpp:l915Ch
  const l915Ch = (a, b) => { const t = fab.L915CH.get(pairKey(a, b)); return t !== undefined && TICK() - t <= K.RELAY_TTL; };
  // C++: mesh.cpp:l915Note
  fab.l915Note = (a, b) => { if (fab.L915CH.size > 4096) fab.L915CH.clear(); fab.L915CH.set(pairKey(a, b), TICK()); };

  // C++: mesh.cpp:classifyCode
  const classifyCode = fab.classifyCode = (from, to, m) => {
    if (from < 0 || to < 0 || from >= seats.length || to >= seats.length) return E.EC_BOOTSTRAP;
    if (from === to) return E.EC_NEIGHBOR;   // self-delivery: local, never a network hop
    const sf = seats[from], st = seats[to];
    if (!sf.hasCoord || !st.hasCoord) return E.EC_BOOTSTRAP;
    if (sf.linkRole(to, E.LR_OWNED | E.LR_E2 | E.LR_L4)) return E.EC_NEIGHBOR;
    if (lv.LINKMODEL && m.l18 && m.routing && X.fabricLinkState(from, to) === LS_OPEN) return E.EC_NEIGHBOR;
    if (m.t === 'AUDITQ' || m.t === 'AUDITA') return E.EC_NEIGHBOR;
    if (lv.LINKMODEL && ((l9AskFrame(m) && l915Ch(from, to)) || (sf.l13On() && l13Frame(m)))) { const ls = X.fabricLinkState(from, to); if (ls === LS_OPEN || ls === LS_DIALING) return E.EC_NEIGHBOR; }
    if (sf.socketed() && st.socketed()) return E.EC_RELAY;   // xsock(st, xvOf(st)) with the serial tick: st->socketed()
    if (lv.LINKMODEL && X.fabricLinkState(from, to) === LS_OPEN) return E.EC_NEIGHBOR;
    return E.EC_TELEPORT;
  };
  // C++: mesh.cpp:teleportExplode
  function teleportExplode(from, to, m) {
    const sf = seats[from], st = seats[to];
    throw new Error('TELEPORT DETECTED t=' + TICK() + ' mt=' + m.t + ' routing=' + m.routing + ' direct=' + m.direct + ' from=' + from + ' (state ' + sf.state + ' coord ' + (sf.hasCoord ? coordStr(sf.coord) : '-') + ') to=' + to + ' (state ' + st.state + ' coord ' + (st.hasCoord ? coordStr(st.coord) : '-') + ')');
  }
  // C++: mesh.cpp:classifyApply
  const classifyApply = fab.classifyApply = (code, from, to, m) => {
    if (code === E.EC_NEIGHBOR) { lv.EMIT_NEIGHBOR++; return; }
    if (code === E.EC_BOOTSTRAP) { lv.EMIT_BOOTSTRAP++; return; }
    if (code === E.EC_RELAY) { lv.EMIT_RELAY++; return; }
    lv.EMIT_TELEPORT++; const mt = MT_INDEX.get(m.t); if (mt >= 0 && mt < 32) fab.TELE_BY_T[mt]++;
    fab.TELE_SRC[(m.direct ? 1 : 0) | (m.routing ? 2 : 0)]++;
    if (lv.ROUTE_ENFORCE && lv.HOST_ANY) return;   // a hostile page named a seat this honest one would answer: a browser's send would just fail
    if (lv.ROUTE_ENFORCE) teleportExplode(from, to, m);
  };
  // C++: mesh.cpp:classifyEmit
  const classifyEmit = (from, to, m) => classifyApply(classifyCode(from, to, m), from, to, m);

  // C++: mesh.cpp:fabricLinkOpen
  // Is MY channel to x open?
  fab.fabricLinkOpen = (me, x) => {
    if (lv.LINKMODEL) return linkViewOpen(me, x);
    if (me < 0 || x < 0 || me === x) return false; const pk = pairKey(me, x);
    if (!openPairs.has(pk)) return false;
    if (cutBetween(me, x) || darkPair(me, x)) return false;
    const sv = fab.severedUntil.get(pk); if (sv !== undefined && sv > TICK()) return false;
    const fs_ = fab.forcedSever.get(pk); if (fs_ !== undefined && fs_ > TICK()) return false;
    return true;
  };
  // C++: mesh_link.inc:fabricOpenPeers
  fab.fabricOpenPeers = (me) => { const out = []; if (!lv.LINKMODEL || me < 0) return out; const L = fab.link; L.lEnsure(me); for (const p of L.LINKPEERS[me]) if (linkViewOpen(me, p)) out.push(p); return out; };
  // C++: mesh.cpp:linkViewOpen
  const linkViewOpen = fab.linkViewOpen = (me, x) => X.fabricLinkState(me, x) === LS_OPEN && !cutBetween(me, x) && !darkPair(me, x);

  // C++: mesh.cpp:wireTx
  // CLOCKS: the frame leaves `from` now; its holder-clock fields are on from's clock.
  const wireTx = fab.wireTx = (m, from) => {
    if (m.fhTo >= 0 || from < 0 || from >= seats.length || !seats[from]) return;
    m.tx = TICK() - seats[from].clkHeld;
    if (m.sigAt >= 0 && m.id === from) m.sigL = m.sigAt;
    if (m.ppAt >= 0 && m.pp === from) m.ppL = m.ppAt;
    if (m.mpAt >= 0 && m.mpBy === from) m.mpL = m.mpAt;
    if (m.foAt >= 0 && m.fo === from) m.foL = m.foAt;
    if (m.l31At >= 0 && m.l31By === from) m.l31L = m.l31At;
    if (m.swAt >= 0 && m.t === 'SWAPGO' && m.id === from) m.swL = m.swAt;
  };

  // C++: mesh.cpp:schedL10
  // An early state frame rides an open link without touching the fabric's state or its jitter. `seq` names the
  // counter it draws its latency from (the C++ pointer: L10SEQ, or L22SEQ for L22's asks).
  const schedL10 = fab.schedL10 = (from, to, m, seq = 'L10SEQ') => {
    if (lv.RC_ON && seq === 'L22SEQ') X.rcNoteSend(from);   // realcheck: each C++ caller of schedL10(..,&L22SEQ) counts the send first (a measurement)
    if (from < 0 || to < 0 || from === to || from >= seats.length || to >= seats.length || !seats[from] || !seats[to]) return;
    const pk = pairKey(from, to);
    if (cutBetween(from, to)) return;
    { const fs_ = fab.forcedSever.get(pk); if (fs_ !== undefined && fs_ > TICK()) return; }
    if (lv.NUM_SUBNETS > 1 && !reachable(seats[from].subnet, seats[to].subnet)) return;
    if (lv.NETGRP && !X.grpReach(from, to)) return;
    if (darkPair(from, to)) return;
    if (lv.LINKMODEL) { if (!X.linkOpenFor(from, to)) return; m.lkEp = X.linkFind(from, to).epoch; }
    else { if (!openPairs.has(pk)) return; const sv = fab.severedUntil.get(pk); if (sv !== undefined && sv > TICK()) return; }
    m.to = to; m.from = from; m.lk = from;
    let at = TICK() + 1 + (lv[seq]++ & 1);
    if (lv.LINKMODEL) { const L = X.linkFind(from, to); const re = to < from ? 0 : 1; if (L) { if (m.t === 'UNNEEDED' && at < L.arrAt[re]) at = L.arrAt[re]; if (L.arrAt[re] < at) L.arrAt[re] = at; } }
    wireTx(m, from);
    busPush(at, m);
  };

  // C++: mesh.cpp:schedule
  // `m` is the caller's copy (the C++ takes it by value): this function owns and changes it.
  const schedule = fab.schedule = (from, to, m, cls = -1) => {
    if (lv.RC_ON) X.rcNoteSend(from);   // realcheck (a measurement)
    const pk = pairKey(from, to);
    if (cls >= 0) classifyApply(cls, from, to, m); else classifyEmit(from, to, m);
    if (lv.DIGEST && from >= 0 && from < seats.length && seats[from] && ((m.t === 'PHONE' && m.dgUp.at >= 0) || (m.t === 'PONG' && (m.dgRoot.at >= 0 || m.dgPub.at >= 0)) || (m.t === 'S1SYNC' && m.digs.length > 0) || (m.t === 'U2BEAT' && m.dgUp.at >= 0))) {   // L10 gauge: a state frame sent
      const sf = seats[from]; sf.stSent++; if (sf.stTickId !== TICK()) { sf.stTickId = TICK(); sf.stTickN = 0; } if (++sf.stTickN > sf.stPeak) sf.stPeak = sf.stTickN;
    }
    if (m.l10E || m.dgOnly) { schedL10(from, to, m); return; }
    if (lv.LOSE_T >= 0 && MT_INDEX.get(m.t) === lv.LOSE_T && m.tag === 0 && ((m.t === 'FIND' && from === lv.LOSE_NC && m.nc === lv.LOSE_NC) || (m.t === 'PLACE' && to === lv.LOSE_NC))) { lv.LOSE_T = -1; return; }
    if (cutBetween(from, to)) return;   // TOTAL PARTITION: the transport drops it
    if (fab.forcedSever.size > 0 && from >= 0 && to >= 0) { const v = fab.forcedSever.get(pk); if (v !== undefined) { if (v > TICK()) return; fab.forcedSever.delete(pk); } }
    if (X.fhopActive() && X.fhopSchedule(from, to, m)) return;
    if (lv.NETGRP && from >= 0 && to >= 0 && from !== to && from < seats.length && to < seats.length && !X.grpReach(from, to)) { X.netRefuse(from, to, m); return; }
    if (lv.LINKMODEL && from >= 0 && to >= 0 && from !== to && from < seats.length && to < seats.length && !darkPair(from, to)) { X.linkSchedule(from, to, m); return; }

    const cond = (lv.NUM_SUBNETS > 1 || lv.NET_LOSS > 0 || lv.NET_SEVER > 0 || lv.NET_LAT > 1 || lv.NET_QUAL_MIN < 1.0);
    if (cond && from >= 0 && to >= 0 && from < seats.length && to < seats.length) {
      const sf = seats[from], st = seats[to];
      if (lv.NUM_SUBNETS > 1 && !reachable(sf.subnet, st.subnet)) return;   // (a) mutually-unreachable subnets can't form a direct P2P link
      if (lv.NET_SEVER > 0) {   // (b) severance: an established link occasionally goes dead for a window
        const v = fab.severedUntil.get(pk);
        if (v !== undefined) { if (v > TICK()) return; fab.severedUntil.delete(pk); }
        if (openPairs.has(pk) && frnd() < lv.NET_SEVER) { fab.severedUntil.set(pk, TICK() + 40 + Math.trunc(frnd() * 160)); return; }
      }
      const q = Math.min(sf.netQual, st.netQual);   // the worse endpoint dominates
      if (lv.NET_LOSS > 0 && frnd() < lv.NET_LOSS * (1.0 + 2.0 * (1.0 - q))) return;   // (c) loss
      const spread = (lv.NET_LAT > 1) ? 1 + Math.trunc(frnd() * lv.NET_LAT) : 1 + (lv.SEQ & 1);   // (d) latency
      const qp = (q < 1.0) ? Math.trunc((1.0 - q) * 4.0 * frnd()) : 0;
      let d; if (openPairs.has(pk)) d = spread + qp; else { openPairs.add(pk); d = 4 + (lv.SEQ % 5) + spread + qp; }
      m.to = to; m.from = from; m.lk = (m.rvia < 0 && !darkPair(from, to)) ? from : -1; lv.SEQ++; wireTx(m, from); busPush(TICK() + d, m); return;
    }
    let d; if (openPairs.has(pk)) d = 1 + (lv.SEQ & 1); else { openPairs.add(pk); d = 4 + (lv.SEQ % 5); }
    m.to = to; m.from = from; m.lk = (m.rvia < 0 && !darkPair(from, to)) ? from : -1; lv.SEQ++; wireTx(m, from);   // the transport's word: the bus names the sender of an unrouted frame (never over a DARK pair)
    busPush(TICK() + d, m);
  };

  // C++: mesh_farview_fab.inc:farView
  // The sender's picture of a target. seat: 1 = I place it at cell c, -1 = I know it outside, 0 = I know nothing.
  function farView(me, to) {
    const v = { seat: 0, c: { pc: 0, r: 0, i: 0 }, gw: -1, gc: { pc: 0, r: 0, i: 0 }, gcOk: false };
    if (!me || to < 0) return v;
    const now = TICK() - me.clkHeld; let any = false, ak = 0;
    for (const [k, x] of me.occ) if (x === to) { const lt = me.live.get(k); if (lt !== undefined && now - lt <= 60) { v.seat = 1; v.c = topo.unckey(k); break; } if (!any) { any = true; ak = k; } }   // a cell I hear it at first-hand
    if (v.seat === 0) { const it = me.farCk.get(to); if (it !== undefined && now - it.at <= K.RELAY_TTL) { if (it.ck) { v.seat = 1; v.c = topo.unckey(it.ck - 1); } else v.seat = -1; } }   // its own latest word
    if (v.seat === 0 && any) { v.seat = 1; v.c = topo.unckey(ak); }   // my view names it there
    const g = me.farGw.get(to); if (g !== undefined && now - g.at <= K.RELAY_TTL) { v.gw = g.gw; if (g.gck) { v.gc = topo.unckey(g.gck - 1); v.gcOk = true; } if (v.seat === 0) v.seat = -1; }
    return v;
  }
  fab.farView = farView;   // (H4: friend-hop reads the sender's picture of a target)
  // C++: mesh_farview_fab.inc:farSock
  const farSock = (v) => v.seat !== 1 || v.c.pc === 0;

  // C++: mesh.cpp:parSend
  // The last step of a send (serial tick): hand a copy to the fabric.
  const parSend = (from, to, m) => { schedule(from, to, msg.clone(m)); };

  // C++: mesh.cpp:fabricSend
  const fabricSend = fab.fabricSend = (from, to, m) => {
    const me = seats[from];
    if (m.l10E || m.dgOnly) {   // L10: an early state frame goes straight to a seat the sender holds at an owned link, or nowhere
      let held = false; if (me.hasCoord && to >= 0 && to !== from) { for (const c of ownedLinks(me.coord)) if (me.occGet(ckey(c)) === to) { held = true; break; } }
      if (held) parSend(from, to, m);
      return;
    }
    if (lv.L18MEAS && lv.LINKMODEL && !m.routing && !m.direct && m.fhTo < 0 && m.uxTo < 0 && to >= 0 && to < seats.length && to !== from) { const mm = msg.clone(m); X.l18UxOrigin(from, to, mm); if (mm.uxTo >= 0) { fabricSend(from, to, mm); return; } }   // measurement only: tag, then the same send
    if (lv.ROUTE_ENFORCE && lv.LINKMODEL && !m.routing && !m.direct && to >= 0 && to < seats.length && to !== from && l18Frame(m) && X.l18Route(from, to)) {   // L18: no role, no open pc: over the topology
      const rc = X.l18Cell(from, to); const mm = msg.clone(m); mm.l18 = true; lv.L18_ROUTED++; X.l18RoutedNote(from, to, m); me.route(rc, to, mm); return;
    }
    if (lv.ROUTE_ENFORCE && !m.routing && to >= 0 && to < seats.length && to !== from) {
      let directLink = !!me.linkRole(to, E.LR_OWNED | E.LR_E2 | E.LR_L4);   // an owned link, or L2's E2 link, or an L4 exchange: held, not routed
      if (!directLink && ((l9AskFrame(m) && l915Ch(from, to)) || (me.l13On() && l13Frame(m))) && lv.LINKMODEL) { const ls = X.fabricLinkState(from, to); if (ls === LS_OPEN || ls === LS_DIALING) directLink = true; }
      // FARVIEW: past the direct link, the path is picked from the sender's picture of `to`, never from its true state.
      const fv = directLink ? { seat: 0, c: { pc: 0, r: 0, i: 0 }, gw: -1, gc: { pc: 0, r: 0, i: 0 }, gcOk: false } : farView(me, to);
      const vIn = fv.seat === 1, mineCell = vIn && me.hasCoord && ckey(fv.c) === ckey(me.coord);
      let viaT = false;   // the pick rides the relay's signalling: a target without a socket answers nosock
      if (!directLink && m.direct) {
        // A hand-off from the destination cell to its final recipient.
        if (mineCell && !(me.socketed() && farSock(fv))) return;
        if (vIn && !mineCell) { if (X.fhopActive() && me.hasCoord && me.strictNextHop(fv.c) < 0 && X.fhopSponsorDrop(from, to, m)) return; me.route(fv.c, -1, msg.clone(m)); return; }
      } else if (!directLink && m.t === 'TAKEOVER' && !me.hasCoord && X.fabricDoors()) {
        /* L16.2: the joiner dials the admitter its FIND was handed to */
      } else if (!directLink && X.fabricDoors() && !vIn && me.hasCoord && me.state === 3 && X.fabricLinkState(from, to) === LS_OPEN) {
        /* L16: a seated seat holding an open door to a joiner hands the frame over that door */
      } else if (!directLink && X.fabricDoors() && !me.hasCoord && X.fabricLinkState(from, to) === LS_OPEN) {
        /* L16.3: a seeker outside with an open door to a seated seat hands its frame over that door */
      } else if (!directLink && X.fabricDoors() && !vIn && me.hasCoord && me.state === 3 && m.t !== 'HOME' && m.gwc) {
        /* L16.3: a deep seat's answer to a joiner outside rides a door of its own, dialled for it */
      } else if (!directLink) {
        if (X.fabricDoors() && me.socketed() && farSock(fv) && me.hasCoord && me.state === 3 && fv.seat === -1 && fv.gw >= 0 && fv.gw !== from && fv.gcOk && X.fabricLinkState(from, to) !== LS_OPEN && X.fabricLinkState(from, to) !== LS_DIALING) { me.route(fv.gc, to, msg.clone(m)); return; }
        else if (me.socketed() && farSock(fv)) { viaT = true; /* door path: both hold sockets (greeting scope), the relay signals a pc */ }
        else if (vIn) { if (X.fhopActive() && me.hasCoord && ckey(me.coord) !== ckey(fv.c) && me.strictNextHop(fv.c) < 0 && X.fhopSponsorDrop(from, to, m)) return; me.route(fv.c, me.l13('L13.1') ? to : -1, msg.clone(m)); return; }
        else if (fv.gw >= 0 && fv.gcOk) { me.route(fv.gc, to, msg.clone(m)); return; }   // a seeker: via the gateway its frames named
        else { if (X.fhopActive()) X.fhopSponsorDrop(from, to, m); return; }   // nowhere I know: drop, the caller retries
      }
      if (!directLink && classifyCode(from, to, m) === E.EC_TELEPORT) { if (viaT && me.socketed() && !me.hasCoord) X.fabricNoSock(from, to); fab.FARV_LOST++; return; }   // the transport: no pc and no socket pair carries this pick
    }
    parSend(from, to, m);
  };

  // ---- the relay ------------------------------------------------------------------------------------------------
  // C++: mesh.cpp:l164Law
  const l164Law = () => lv.LINKMODEL;
  // C++: mesh.cpp:l164Of
  const l164Of = fab.l164Of = (s) => l164Law() && !islandStand(s, E.IS_L164);
  // C++: mesh.cpp:relayUnlist
  fab.relayUnlist = (id) => { if (!l164Of(seats[id])) return; fab.relayGreeters.delete(id); };
  // C++: mesh.cpp:relayKnock
  fab.relayKnock = (id, presentedKey, blob) => {
    if (lv.DOORDARK > TICK()) return;   // `doordark`: the relay is frozen too
    if (fab.radioDark && fab.radioDark(id)) return;   // a seat whose radio is off reaches the relay no more than its peers
    if (lv.NETGRP && !X.netKnockOk(id)) return;   // the socket's meters refused it
    const rg = fab.relayGreeters;
    for (const [g, exp] of rg) if (exp < TICK() || sockClosed(g)) rg.delete(g);   // TTL, or the socket closed
    if (rg.size === 0) lv.relayGenesisKey = 0;
    const out = []; for (const g of rg.keys()) if (g !== id) out.push(g);
    for (let k = out.length - 1; k > 0; k--) { const j = Math.trunc(grnd() * (k + 1)); const t = out[k]; out[k] = out[j]; out[j] = t; }   // shuffle
    const m = msg.newMsg('GREETERS'); m.list = out; m.to = id; m.from = -1; busPush(TICK() + 1, m);
    if (rg.size === 0) { lv.relayGenesisKey = keyHash(presentedKey); rg.set(id, TICK() + K.RELAY_TTL); }   // mint genesis: store only H(key)
    else {
      const s = seats[id]; const isl = islandStand(s, E.IS_RELAY); const s1Only = isl || l164Of(s);
      if (blob && keyHash(presentedKey) === lv.relayGenesisKey && (!s1Only || (s.state === 3 && s.hasCoord && s.coord.pc === 0))) rg.set(id, TICK() + K.RELAY_TTL);
    }
  };

  // ---- the seat-facing calls the harness owns -------------------------------------------------------------------
  // C++: mesh.cpp:fabricNoteReseat
  fab.fabricNoteReseat = () => { lv.RESEATS++; };
  // C++: mesh.cpp:fabricNoteRollback
  fab.fabricNoteRollback = () => { lv.ROLLBACKS++; };
  // C++: mesh.cpp:fabricDupMint
  fab.fabricDupMint = (id) => {
    X.netNoteTake(id);   // join-time report (no seat reads it)
    if (id >= 0 && id < seats.length && seats[id] && seats[id].hasCoord) { const mc = fab.MOVECNT; while (mc.length <= id) mc.push(0); mc[id]++; lv.MOVELAST = TICK(); }   // a seat that held a cell takes another: a move
  };
  // C++: mesh.cpp:fabricAdmitLog
  fab.fabricAdmitLog = (k, id) => {
    const al = fab.ADMIT_LOG.get(k);
    if (al) fab.ADMIT_LOG.set(k, { site: w.ADMIT_SITE, t: TICK(), admitter: id, prevSite: al.site, prevT: al.t, prevAdmitter: al.admitter });
    else fab.ADMIT_LOG.set(k, { site: w.ADMIT_SITE, t: TICK(), admitter: id, prevSite: '-', prevT: -1, prevAdmitter: -1 });
  };
  // C++: mesh.cpp:fabricKickClose
  fab.fabricKickClose = (me, x) => { if (!lv.LINKMODEL || x < 0 || x === me) return; const L = X.linkFind(me, x); if (L && L.state === LK_OPEN) X.closeFrom(L, me, x, 'voted-off'); };
  // C++: mesh.cpp:fabricAudit
  fab.fabricAudit = (from, to, m) => {
    if (to < 0 || to >= lv.nextId || !alive[to] || !seats[to]) return;
    if (m.t === 'AUDITQ') lv.K_AUDQ++; else lv.K_AUDA++;
    schedule(from, to, msg.clone(m));
  };
  // C++: mesh.cpp:fireTranslost
  // The parent fabric's loss is a closed channel (a crash, a sever, a dark pair): hard.
  fab.fireTranslost = (deadId) => {
    for (let q = 0; q < lv.nextId; q++) {
      if (!alive[q] || q === deadId) continue; const s = seats[q]; if (!s.hasCoord) continue;
      const ol = ownedLinks(s.coord); let linked = false, lk = -1;
      for (let k = 0; k < ol.length && !linked; k++) if (s.occGet(ckey(ol[k])) === deadId) { linked = true; lk = k; }
      if (!linked) continue;
      const due = TICK() + 2 + Math.trunc(grnd() * 4);
      trace('EDGE-DOWN', q, ol[lk], 'peer=%d due=%lld', deadId, due);
      const m = msg.newMsg('TRANSLOST'); m.id = deadId; m.to = q; m.from = -1; m.hard = true; busPush(due, m);
    }
  };

  // ---- trace -----------------------------------------------------------------------------------------------------
  // C++: mesh.cpp:coordStr
  const coordStr = fab.coordStr = (c) => {
    let pc = c.pc >>> 0; const d = []; while (pc) { d.push(lastDigit(pc)); pc = parentPath(pc); }
    let p = ''; for (let a = d.length - 1; a >= 0; a--) p += String.fromCharCode(48 + d[a]);
    return p + '/' + c.r + '.' + c.i;
  };
  // C++: mesh.cpp:trace
  // The one writer: `d` is the formatted detail. A line is {"t","s","e","c","d"}; the detail drops bytes below
  // 0x20 and escapes " and \ (not JSON.stringify's escapes).
  function traceLine(ev, seat, cell, d) {
    if (!traceOn) return;
    let e = ''; for (let i = 0; i < d.length; i++) { const ch = d[i]; if (ch === '"' || ch === '\\') e += '\\'; if (ch.charCodeAt(0) >= 0x20) e += ch; }
    const line = cell
      ? '{"t":' + TICK() + ',"s":' + seat + ',"e":"' + ev + '","c":"' + coordStr(cell) + '","d":"' + e + '"}\n'
      : '{"t":' + TICK() + ',"s":' + seat + ',"e":"' + ev + '","c":null,"d":"' + e + '"}\n';
    if (traceSink) traceSink(line);
    if (traceF) { traceF.s += line; if (traceF.s.length > (1 << 20)) flush(traceF); }
  }
  const trace = fab.trace = (ev, seat, cell, f, ...a) => { if (!traceOn) return; traceLine(ev, seat, cell, fmt.sprintf(f, ...a)); };
  w.trace = traceOn ? traceLine : null;

  // ---- the tick ----------------------------------------------------------------------------------------------------
  // C++: mesh.cpp:spawnDue
  const spawnDue = fab.spawnDue = () => {
    if (TICK() < fab.spawnPlan.length) for (const k of fab.spawnPlan[TICK()]) {
      const id = lv.nextId++; seats[id] = new Seat(id, w); alive[id] = 1;
      if (lv.NETGRP) X.netSetGrp(id, k < fab.planGrp.length ? fab.planGrp[k] : 0);
      X.netNoteSpawn(id);   // the join-time log in every run
      if (lv.NUM_SUBNETS > 1) seats[id].subnet = Math.trunc(frnd() * lv.NUM_SUBNETS);
      if (lv.NET_QUAL_MIN < 1.0) seats[id].netQual = lv.NET_QUAL_MIN + frnd() * (1.0 - lv.NET_QUAL_MIN);
      seats[id].join();
    }
  };
  // C++: mesh.cpp:joinPhaseNote
  const joinPhaseNote = (m) => {   // the `joinphase` measurement notes (no seat reads them)
    const SP = fab.SPAWNT;
    if ((m.t === 'HOME' || m.t === 'PLACE' || m.t === 'HANDOFF' || m.t === 'TAKEN') && m.to < SP.length && !seats[m.to].hasCoord && fab.FIRSTSEAT[m.to] < 0) {
      if (fab.FIRSTHOME.length < SP.length) for (const a of [fab.FIRSTHOME, fab.LASTPLACE, fab.LASTFIND, fab.FIRSTHO, fab.FIRSTTAKEN]) while (a.length < SP.length) a.push(-1);
      if (m.t === 'HOME' && fab.FIRSTHOME[m.to] < 0) fab.FIRSTHOME[m.to] = TICK();
      if (m.t === 'PLACE') fab.LASTPLACE[m.to] = TICK();
      if (m.t === 'HANDOFF' && fab.FIRSTHO[m.to] < 0) fab.FIRSTHO[m.to] = TICK();
      if (m.t === 'TAKEN' && fab.FIRSTTAKEN[m.to] < 0) fab.FIRSTTAKEN[m.to] = TICK();
    }
    if (m.t === 'FIND' && m.tag === 0 && m.nc >= 0 && m.nc < fab.LASTFIND.length && fab.FIRSTSEAT[m.nc] < 0 && fab.LASTPLACE[m.nc] < 0) fab.LASTFIND[m.nc] = TICK();
  };
  // C++: mesh.cpp:recvPre
  // CLOSEDROP (lost on a pc this end saw close), then the `joinphase` measurement. true: the frame is lost.
  const recvPre = fab.recvPre = (m) => { if (X.closedDrop(m)) return true; joinPhaseNote(m); return false; };

  // C++: mesh_proof.inc:ProofEntry  (the "recv" entry of Seat::recv: a frame in, from outside the seat; Seat::recv calls it as w.proofRecv)
  fab.proofRecv = w.proofRecv = (id, m) => {
    if (!proof.on) return;
    proof.nRecv++;
    put(proof.frames, JSON.stringify({ e: 'recv', t: TICK(), to: id, m: msg.writeMsg(m) }));
  };
  // C++: mesh_proof.inc:proofTickEnd
  // The per-tick state hash (doTick's last step): FNV-1a 32 of the seat's state JSON, only for seats that changed.
  const proofTickEnd = fab.proofTickEnd = () => {
    if (!proof.on) return;
    const hs = []; let any = false;
    for (let q = 0; q < lv.nextId; q++) {
      const live = q < alive.length && alive[q] && q < seats.length && seats[q];
      const had = proof.last.has(q);
      if (!live) { if (had) { hs.push([q, null]); proof.last.delete(q); any = true; } continue; }
      const s = state.dumpState(seats[q]); const h = fnv.str(s);
      if (!had || proof.last.get(q) !== h) {
        proof.last.set(q, h); hs.push([q, h]); any = true;
        if (proof.state) put(proof.state, '{"t":' + TICK() + ',"id":' + q + ',"s":' + s + '}');
      }
    }
    if (any) { proof.nHash++; put(proof.hash, JSON.stringify({ t: TICK(), h: hs })); }
  };

  // C++: mesh.cpp:doTick
  fab.doTick = () => {
    spawnDue();
    const tfx = fab.FROZEN.size > 0 || fab.SLOW.size > 0 || fab.RELOADQ.size > 0 || fab.RESUMEQ.size > 0 || fab.RELCLOSEQ.size > 0;
    if (tfx) X.timeTick();   // thaws (absence, then the held frames), slow clocks, reload spawns
    if (lv.LINKMODEL) X.linkTick();
    if (lv.NETGRP) X.netTick();
    if (fab.KICK_KNOCK.size > 0 && TICK() % 40 === 0) { for (const q of fab.KICK_KNOCK) if (q >= 0 && q < lv.nextId && alive[q] && seats[q] && seats[q].state !== 3) seats[q].join(); }   // L27 `kickknock`
    if (fab.KILLQ.size > 0) {   // `killspread`: the leaves due this tick
      let first = Infinity; for (const k of fab.KILLQ.keys()) if (k < first) first = k;
      if (first <= TICK()) {
        const v = fab.KILLQ.get(first); fab.KILLQ.delete(first);
        for (const q of v) { if (q < 0 || q >= lv.nextId || !alive[q]) continue; if (lv.KILLQ_CRASH) { fabricKill(q, TICK() + K.SOCK_CLOSE_CRASH); X.crashTransport(q); } else seats[q].leave(); lv.N--; }
      }
    }
    const fh = X.fhopActive(); if (fh) X.fhopTick();   // FHOP: status beats, relay frames, media sweeps
    const slot = bus.get(TICK());
    if (slot !== undefined) {
      for (const m of slot) {
        if (m.to >= 0 && m.to < seats.length && alive[m.to]) {
          if (recvPre(m)) continue;   // CLOSEDROP, then the `joinphase` measurement
          if (tfx && isFrozen(m.to)) { X.freezeHold(m); continue; }
          if (fh && X.fhopIntercept(m)) continue;
          if (lv.RC_ON) X.rcNoteRecv(m);
          seats[m.to].recv(m); wake(m.to);   // (the recv proof line is written inside Seat::recv, after its clock rebase: w.proofRecv)
        }
      }
      bus.delete(TICK());
    }
    { const t = fab.active; fab.active = fab.nextActive; fab.nextActive = t; fab.nextActive.clear(); }   // active.swap(nextActive); nextActive.clear()
    if (tfx) { for (const id of fab.active) { if (id < lv.nextId && alive[id]) { if (isFrozen(id)) continue; if (X.slowSkip(id)) { fab.nextActive.add(id); continue; } seats[id].tick(); } } }
    else for (const id of fab.active) { if (id < lv.nextId && alive[id]) seats[id].tick(); }
    if (lv.LG_ON) X.lguardFabTick();   // L29: the devices' readings, the inbound watch, the seats that leave
    X.mediaTick();     // a measurement, after the tick's frames and timers
    X.mgapTick();      // `mgap on`: a measurement
    X.hostileTickF();  // `hostile`: a measurement
    X.fhMeasureTick(); // FHOP measurement
    X.ijTick();        // L31 measurement
    if (lv.RC_ON) X.rcTick();   // realcheck: a measurement
    proofTickEnd();    // MESH_PROOF: the per-tick state hash
  };

  // C++: mesh.cpp:counts
  fab.counts = () => {
    let seated = 0; const s1cells = new Set(), allc = new Set(); lv.DUPS_G = 0;
    for (let i = 0; i < lv.nextId; i++) if (alive[i] && seats[i].state === 3) {
      seated++; const k = ckey(seats[i].coord); if (allc.has(k)) lv.DUPS_G++; else allc.add(k);
      if (seats[i].coord.pc === 0) s1cells.add(k);
    }
    return { seated, s1c: s1cells.size };
  };

  // C++: mesh.cpp:initSim
  fab.initSim = (n, leave) => {
    lv.GSEED = lv.SEED0 >>> 0; lv.PARTITIONED = false; fab.partSide.length = 0;   // reproducible per SEED0; a fresh room is never partitioned
    X.linkReset();   // a fresh room: no peer connections yet
    X.fhopReset();   // ...and no friend-hop state
    if (lv.NETGRP) {
      let sum = 0; for (const g of fab.NETG) sum += g.size; if (sum > 0) n = sum;
      fab.SEATGRP.length = 0; fab.NETCUT.clear(); fab.NETLIFT.clear(); fab.METER.clear();
      lv.RELAY_KNOCKS = lv.RELAY_SIGNAL = lv.RELAY_NONDOOR = lv.RELAY_REFUSED = lv.RELAY_CUTS = lv.NET_DROPS = 0;
      lv.URL_KEY = keyHash(hash.hmix((K.H_INIT ^ 0x75726c) >>> 0, lv.SEED0 >>> 0));   // the meeting key of this run's link
    }
    lv.N = n; lv.LEAVEFRAC = leave; lv.MAXP = lv.N * 30 + 60000;
    const JM = fab.JOINMODE, JA = lv.JM_A, JB = lv.JM_B, N = lv.N;
    if (JM === 'burst') lv.joinWindow = 1;
    else if (JM === 'batch') lv.joinWindow = Math.max(1, Math.trunc((N + Math.max(1, JA) - 1) / Math.max(1, JA)) * Math.max(1, JB) + 1);
    else if (JM === 'serial') lv.joinWindow = Math.max(1, N * Math.max(1, JA) + 1);
    else lv.joinWindow = (JA > 0 ? JA : Math.max(1, Math.min(Math.trunc(N * 0.25), 2000)));
    const cap = N + Math.trunc(N * 0.6) + 16;
    seats.length = 0; alive.length = 0; for (let i = 0; i < cap; i++) { seats.push(null); alive.push(0); }
    fab.relayGreeters.clear(); lv.relayGenesisKey = 0; fab.sockCloseAt.clear();   // a fresh room: a fresh door
    fab.spawnPlan = Array.from({ length: lv.joinWindow + 1 }, () => []);
    for (let k = 0; k < N; k++) {
      let t;
      if (JM === 'burst') t = 0;
      else if (JM === 'batch') t = Math.trunc(k / Math.max(1, JA)) * Math.max(1, JB);
      else if (JM === 'serial') t = k * Math.max(1, JA);
      else t = Math.trunc(grnd() * lv.joinWindow);
      if (t > lv.joinWindow) t = lv.joinWindow;
      fab.spawnPlan[t].push(k);
    }
    w.TICK = 0; lv.nextId = 0;
    if (lv.NETGRP) X.netPlanArrivals(N);
    lv.FSEED = 20260714; fab.severedUntil.clear(); fab.buildReach();   // reset fabric rng + reachability for a reproducible conditioned run
  };

  // C++: mesh.cpp:killFraction
  // Kill a fraction of live seats (the real departure path: leave() unless silent). Returns how many.
  fab.killFraction = (frac, mode) => {
    const ids = []; for (let q = 0; q < lv.nextId; q++) if (alive[q]) ids.push(q);
    const nk = Math.trunc(lv.N * frac); const pick = [];
    { const u = new Set(); while (pick.length < nk && pick.length < ids.length) { const j = Math.trunc(grnd() * ids.length); if (!u.has(j)) { u.add(j); pick.push(ids[j]); } } }
    const ks = new Set(pick);
    if (mode === 's1row') { const rr = Math.trunc(grnd() * topo.C); for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].hasCoord && seats[q].coord.pc === 0 && seats[q].coord.r === rr) ks.add(q); }
    if (mode === 's1all') { for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].hasCoord && seats[q].coord.pc === 0) ks.add(q); }
    if (mode === 'silent') { for (const q of ks) fabricKill(q, -1); } else for (const q of ks) seats[q].leave();
    lv.N -= ks.size; return ks.size;
  };

  // C++: mesh.cpp:converge
  // Advance until converged (seated == N and Section 1 full) or `cap`; returns the tick.
  fab.converge = (cap) => {
    const start = TICK(); const tgt = Math.min(topo.C * topo.C, lv.N); let goodSince = -1;
    while (TICK() < start + cap) {
      fab.doTick(); w.TICK++;
      if (TICK() % 64 === 0) {
        const { seated, s1c } = fab.counts(); if (seated === lv.N && s1c === tgt && lv.DUPS_G === 0) return TICK();
        const good = (s1c === tgt && seated >= Math.trunc(lv.N * 0.99));
        if (good) { if (goodSince < 0) goodSince = TICK(); if (TICK() - goodSince > 6000) return TICK(); } else goodSince = -1;
      }
    }
    return TICK();
  };

  // ---- the 52 calls a seat makes (seat.js FABRIC_CALLS) ------------------------------------------------------------
  // Mine are bound here; every other name forwards to fab.X, so a plugged unit's function is reached at call time.
  const own = {
    fabricAdmitLog: fab.fabricAdmitLog, fabricDupMint: fab.fabricDupMint, fabricLeft, fabricLinkOpen: fab.fabricLinkOpen, fabricOpenPeers: fab.fabricOpenPeers,
    fabricNoteReseat: fab.fabricNoteReseat, fabricNoteRollback: fab.fabricNoteRollback, fabricSend, fabricKickClose: fab.fabricKickClose,
    l915Note: fab.l915Note, l164Of, relayKnock: fab.relayKnock, relayUnlist: fab.relayUnlist, wake, fabricAudit: fab.fabricAudit,
  };
  for (const n of Object.keys(own)) X[n] = own[n];
  const f = {};
  for (const n of FABRIC_CALLS) f[n] = (...a) => X[n](...a);
  fab.f = f; w.f = f;

  // ---- close ----------------------------------------------------------------------------------------------------------
  // Flush the files; write summary.json as MESH_PROOF does at exit.
  fab.close = () => {
    if (traceF) { flush(traceF); fs.closeSync(traceF.fd); traceF = null; }
    if (!proof.on) return;
    flush(proof.frames); flush(proof.hash); if (proof.state) flush(proof.state);
    const sz = (f_) => f_.bytes;
    fs.writeFileSync(path.join(proof.dir, 'summary.json'), JSON.stringify({ format: 1, sends: proof.nSend, recvs: proof.nRecv, hashLines: proof.nHash, tapeSeats: 0, tapeLines: 0, bytes: { frames: sz(proof.frames), hash: sz(proof.hash), tapes: 0 } }) + '\n');
    fs.closeSync(proof.frames.fd); fs.closeSync(proof.hash.fd); if (proof.state) fs.closeSync(proof.state.fd);
    proof.on = false;
  };
  fab.classifyEmit = classifyEmit;
  fab.keyHash = keyHash; fab.pairKey = pairKey;
  return fab;
}

module.exports = { createFabric, keyHash, pairKey, EXTERNALS };
