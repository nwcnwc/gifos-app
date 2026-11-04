'use strict';
/*
 * link.js: the link physics (port plan H2), a line-for-line port of the sim's mesh_link.inc at 37d787b2d: the
 * Link table, the dial / open / close events, the half-open and silent-loss paths, the door laws (L15, L16,
 * L16.10), CLOSEDROP, the L22 handshake and L23 refusals, the fabric calls a seat makes about links
 * (fabricLinkState, fabricDial ...) and the `link ...` / `radio` / `sever` / dark levers. Harness code: never shipped.
 *
 *   const api = require('./link.js').install(fab);   // plugs the unit's functions into fab.plug
 *
 * State lives on `api` (api.LINKS ...), one set per fabric. Counters the sim keeps as globals (L16_BUSY,
 * CLOSEDROPS ...) are fab.lv.<name>; constants are fab.K.<name>.
 *
 * The realcheck hooks: startDial calls X.rcNoteDial under RC_ON; the L22SEQ sends count through fab.schedL10.
 * NOT PORTED, on purpose: RcFabric (heap accounting), gate() (the threaded
 * tick), the L13DBG / DBG-LINK-* stderr prints, the rcDialWhy instrument and Link.dialT, the parallel-tick
 * published views (xvOf is the seat itself; l15NamesX is l15Names), and the lever printfs (the lever functions
 * here do the state change only). lever words `link stat|peers|show` print only and are not ported.
 *
 * CALLEES THAT ARE NOT THIS FILE'S (other sim files), reached through fab.X and unplugged until their unit lands:
 *   l22Need  l28Reply (mesh_linkset_fab.inc)   l374Note  l374Resend (mesh_gaps_fab.inc)   l1611Guard (mesh_rcfollow_fab.inc)
 * This file exports what they need (api.l1610Held, api.linkDeliver, api.startDial, api.l16Close, api.doorHeard ...).
 * Seat methods it calls: linkRole, ownerCoord, l14Branch, l30Small, socketed, and the Seat's dials / callBook /
 * relMark / l13SplitCell / l13DownAt fields.
 */
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const C_ = require(path.join(M, 'consts.js'));
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));
const hash = require(path.join(M, 'hash.js'));
const seatM = require(path.join(M, 'seat.js'));
const { ins } = require(path.join(M, 'util.js'));
const { newLink } = require(path.join(M, 'pclaws.js'));   // the one Link struct (C++ mesh.cpp:Link)

const K = C_.consts, E = C_.enums;
const { ckey, ownedLinks, unckey } = topo;
const { LK_NONE, LK_DIALING, LK_OPEN, LK_CLOSED, LS_NONE, LS_DIALING, LS_OPEN } = E;
const { EV_DIAL, EV_DOWN, EV_ICE, EV_DISC, EV_STARVE1, EV_RADIOEND, EV_FRESH, EV_DSMALL } = E;
const { PB_DOORS, PB_KNOCKS, PB_S1, PB_CLASS } = E;
const pkA = hash.pairA, pkB = hash.pairB;   // C++ pk.a, pk.b
const U32 = (x) => x >>> 0;
const cmpPair = (p, q) => (p[0] - q[0]) || (p[1] - q[1]);   // std::pair<int,int> operator<

function install(fab) {
  const { lv, seats, alive, X } = fab;
  const w = fab.w;
  const TICK = () => w.TICK;
  const trace = fab.trace;
  const C = topo.C;
  const nextId = () => lv.nextId;
  const pairKey = fab.pairKey, idPair = hash.idPair;
  const isFrozen = fab.isFrozen;
  const api = {};
  const mtIdx = (t) => msg.MT_NAMES.indexOf(t);

  for (const n of ['l22Need', 'l28Reply', 'l374Note', 'l374Resend', 'l1611Guard', 'relayMeter', 'netSignal']) {
    if (!X[n]) X[n] = () => { throw new Error('mesh link: ' + n + ' is not wired (plug it with fab.plug)'); };
  }

  // ---- the tables (C++ namespace fabric, links) ---------------------------------------------------------------
  const LINKS = api.LINKS = new Map();          // pairKey -> Link
  const LINKPEERS = api.LINKPEERS = [];         // id -> peers (creation order)
  const LEVQ = api.LEVQ = new Map();            // tick -> [LEv]  (a std::map: the earliest tick first)
  const LBLOCK = api.LBLOCK = new Map();
  const RADIO = api.RADIO = new Map();
  const LRX = api.LRX = [], LTX = api.LTX = [];
  const TLDEB = api.TLDEB = new Map();
  let LPENDCLOSE = api.LPENDCLOSE = [];
  const LDOORS = api.LDOORS = new Set();        // a std::set<uint64_t>: iterated in ascending order (see sortedDoors)
  const LSTAT = api.LSTAT = new Array(8).fill(0);
  const TIEROVR = api.TIEROVR = fab.TIEROVR = fab.TIEROVR || new Map();   // one table with tierfab.js and the spawn verb (fab.TIEROVR)
  const MOBOPEN = api.MOBOPEN = new Map();
  let DOOR_PEND = api.DOOR_PEND = [];
  const L1341_OPENED = api.L1341_OPENED = new Set();
  const L23S = api.L23S = new Map(), L23GREET = api.L23GREET = new Map(), L16COOL = api.L16COOL = new Map();
  let DOORN = api.DOORN = [], DOORK = api.DOORK = [];
  let L16CLOSING = api.L16CLOSING = [];
  // The tables the pc laws (js/mesh/pclaws.js) share are reassigned by both: read and write through the api.
  for (const [n, get, set] of [['DOORN', () => DOORN, (v) => { DOORN = v; }], ['DOORK', () => DOORK, (v) => { DOORK = v; }], ['L16CLOSING', () => L16CLOSING, (v) => { L16CLOSING = v; }],
    ['DOOR_PEND', () => DOOR_PEND, (v) => { DOOR_PEND = v; }], ['LPENDCLOSE', () => LPENDCLOSE, (v) => { LPENDCLOSE = v; }]]) Object.defineProperty(api, n, { get, set, enumerable: true, configurable: true });
  const L23PEND = api.L23PEND = [];   // L23PENDT (the stamp) is the lever lv.L23PENDT, shared with pclaws.js
  const sortedDoors = () => [...LDOORS].sort(hash.pairCmp);   // C++ set<IdP>: by a, then b
  const firstTick = (m) => { let f = Infinity; for (const k of m.keys()) if (k < f) f = k; return f; };   // std::map begin()

  // ---- small readers -------------------------------------------------------------------------------------------
  const lmix = (x) => hash.fmix32(U32(x + 0x9e3779b9));
  // C++: mesh_link.inc:ldraw
  const ldraw = api.ldraw = (lo, hi, a, b, salt) => {
    const h = lmix(lmix(lmix(lmix(U32(U32(lv.SEED0) ^ salt)) ^ U32(TICK())) ^ U32(a)) ^ U32(b));
    return lo + (h % U32(hi - lo + 1));
  };
  // C++: mesh_link.inc:lMobHash
  const lMobHash = (id, f) => f > 0 && (lmix(hash.hmixId(U32(U32(lv.SEED0) ^ 0x6d6f62), id)) % 1000000) / 1e6 < f;
  // C++: mesh_link.inc:tierMobile
  const tierMobile = (id) => { const o = TIEROVR.get(id); if (o !== undefined) return o === E.TIER_MOBILE; return lMobHash(id, lv.TIERMIX); };
  const lMobile = (id) => tierMobile(id) || lMobHash(id, lv.LMOBILE);
  // C++: mesh_link.inc:lEnd
  const lEnd = api.lEnd = (me, x) => me < x ? 0 : 1;
  // C++: mesh_link.inc:lEnsure
  const lEnsure = api.lEnsure = (id) => {
    if (id >= LINKPEERS.length) { const n = Math.max(id + 1, LINKPEERS.length * 2); while (LINKPEERS.length < n) LINKPEERS.push([]); while (LRX.length < n) LRX.push(-1); while (LTX.length < n) LTX.push(-1); }
  };
  const eraseVal = (v, x) => { for (let i = v.length - 1; i >= 0; i--) if (v[i] === x) v.splice(i, 1); };
  // C++: mesh_link.inc:linkErase
  const linkErase = (a, b) => {
    LINKS.delete(pairKey(a, b));
    if (a < LINKPEERS.length) eraseVal(LINKPEERS[a], b);
    if (b < LINKPEERS.length) eraseVal(LINKPEERS[b], a);
  };
  // C++: mesh_link.inc:linkFind
  const linkFind = api.linkFind = (a, b) => { const L = LINKS.get(pairKey(a, b)); return L === undefined ? null : L; };
  // C++: mesh_link.inc:linkGet
  const linkGet = api.linkGet = (a, b) => {
    const pk = pairKey(a, b); const it = LINKS.get(pk); if (it !== undefined) return it;
    lEnsure(Math.max(a, b)); LINKPEERS[a].push(b); LINKPEERS[b].push(a); const L = newLink(); LINKS.set(pk, L); return L;
  };
  // C++: mesh_link.inc:levPush
  const levPush = api.levPush = (at, kind, a, b, ep, why, ref = -1) => { ins(LEVQ, at, () => []).push({ kind, a, b, epoch: ep, why, ref }); };
  // C++: mesh_link.inc:radioOff
  const radioOff = api.radioOff = (id) => { const it = RADIO.get(id); return it !== undefined && it > TICK(); };
  // C++: mesh_link.inc:pathOk
  const pathOk = api.pathOk = (a, b) => {
    if (a < 0 || b < 0 || a >= nextId() || b >= nextId() || !alive[a] || !alive[b]) return false;
    const bl = LBLOCK.get(pairKey(a, b)); if (bl !== undefined && bl > TICK()) return false;
    if (radioOff(a) || radioOff(b) || fab.darkPair(a, b) || fab.cutBetween(a, b)) return false;
    if (isFrozen(a) || isFrozen(b)) return false;
    if (!X.grpReach(a, b)) return false;
    if (lv.NUM_SUBNETS > 1 && !fab.reachable(seats[a].subnet, seats[b].subnet)) return false;
    return true;
  };
  // C++: mesh_link.inc:namesOwned
  const namesOwned = (from, to) => !!seats[from].linkRole(to, E.LR_OWNED | E.LR_E2);
  // C++: mesh_link.inc:l16Mobile
  const l16Mobile = (x) => x >= 0 && x < nextId() && !!seats[x] && seats[x].ctier === E.TIER_MOBILE;
  const l16CapOf = (x) => l16Mobile(x) ? lv.DOORCAP_MOBILE : lv.DOORCAP;
  const l16ReserveOf = (x) => l16Mobile(x) ? lv.L16_RESERVE_MOBILE : lv.L16_RESERVE;
  // C++: mesh_link.inc:l16MobBudget
  const l16MobBudget = (x) => {
    if (lv.L16_MOB_RATE <= 0) return true;
    const e = ins(MOBOPEN, x, () => [0, 0]); if (e[0] !== TICK()) { e[0] = TICK(); e[1] = 0; } if (e[1] >= lv.L16_MOB_RATE) return false; e[1]++; return true;
  };
  // C++: mesh_link.inc:l14Budget
  const l14Budget = (x) => { const s = seats[x]; const bound = (s.hasCoord && s.state === 3) ? (s.coord.pc === 0 ? 2 * C - 1 : C + 1) : C * C; return bound + K.L14_PC_ALLOW - 1; };
  // C++: mesh_link.inc:pcBudget
  const pcBudget = api.pcBudget = (x, cls) => {
    switch (cls) {
      case PB_DOORS: return l16CapOf(x);
      case PB_KNOCKS: return l16CapOf(x) - l16ReserveOf(x);
      case PB_S1: return 2 * C - 1 + l16CapOf(x);
      case PB_CLASS: return l14Budget(x);
    }
    return 0;
  };
  // C++: mesh_link.inc:noteCall
  const noteCall = (me, x) => {
    if (me < 0 || me >= nextId() || x < 0 || x >= nextId() || me === x || !alive[me]) return;
    const s = seats[me]; if (!s.hasCoord || s.state !== 3 || l18Role(me, x)) return; s.callBook.noteOut(x, s.TICK);
  };
  // C++: mesh.cpp:l18Role
  const l18Role = (me, x) => { const s = seats[me]; if (!s.hasCoord) return false; return !!s.linkRole(x, E.LR_TOPO); };
  // C++: mesh_link.inc:l18NoDial
  const l18NoDial = (me, x) => { if (!X.l18Route(me, x)) return false; lv.L18_NODIAL++; return true; };
  // C++: mesh_link.inc:dialHeld
  const dialHeld = (a, b) => {
    if (a < 0 || a >= nextId()) return false;
    const s = seats[a]; const g = s.dials.goneAt(b); if (g < 0) return false;
    { const rm = s.relMark.get(b); if (rm !== undefined && s.TICK - rm <= K.LEASE_T) return false; }
    return TICK() >= g;
  };

  // C++: mesh_link.inc:l1610Held
  // The pcs seat x holds (open, dialling, or closed at the far end and not yet seen); n, and how many of them are topology.
  const l1610Held = api.l1610Held = (x) => {
    lEnsure(x); let n = 0, tp = 0;
    for (const p of LINKPEERS[x]) { const L = linkFind(x, p); if (!L) continue; if (L.state === LK_OPEN || L.state === LK_DIALING || L.view[lEnd(x, p)] === LK_OPEN) { n++; if (!L.outside && l15Names(x, p)) tp++; } }
    return { n, topo: tp };
  };
  // C++: mesh_link.inc:l1610Full
  const l1610Full = api.l1610Full = (x) => {
    if (x < 0 || x >= nextId()) return false; const v = seats[x]; if (!(v.hasCoord && v.state === 3)) return false; if (v.coord.pc !== 0) return false;
    const h = l1610Held(x); return h.n - h.topo + Math.max(h.topo, 2 * C - 1) + 1 > pcBudget(x, PB_S1);
  };

  // C++: mesh_link.inc:startDial
  const startDial = api.startDial = (a, b, L) => {
    {
      let o = 0; for (const x of [a, b]) if (x < nextId() && !(seats[x].hasCoord && seats[x].state === 3)) o |= (1 << lEnd(x, x === a ? b : a)); L.outside = o; if (o) LDOORS.add(pairKey(a, b));
      if (!o) X.l1611Guard(a, b, L);
      if (o) {
        L.dBorn = L.dProg = TICK(); L.dAsked = L.dHomed = L.dGw = L.dSat = false; L.dHoAt = -1; L.dWait = -1; L.dOwed = false; L.dWaitAtFind = -1; L.dOwedAt = -1; L.dHeard = 0; L.dIn = !(o & (1 << lEnd(a, b)));
        if (o !== 3) { const g = (o & (1 << lEnd(a, b))) ? b : a; if (g >= DOORN.length) { while (DOORN.length < g + 1) DOORN.push(0); while (DOORK.length < g + 1) DOORK.push(0); } DOORN[g]++; if (!L.dIn) DOORK[g]++; }
      }
    }
    if (lv.RC_ON) X.rcNoteDial(a, b);   // realcheck: a dial to a seat long gone (a measurement)
    { L.nnAt[0] = L.nnAt[1] = -1; }
    L.state = LK_DIALING; L.epoch = U32(L.epoch + 1); L.dialAt = TICK(); L.half = 0; L.halfAt = -1; L.stuck = false; L.backAt[0] = L.backAt[1] = -1; L.view[lEnd(a, b)] = LK_DIALING; LSTAT[0]++; L.dialBy = a; L.callClosed = false; L.gone = 0; L.uplink = false; L.dialT = -1; L.dialHow = 0;
    X.netSignal(a, b);
    const mob = lMobile(a) || lMobile(b);
    const d = mob ? ldraw(K.LINK_DIAL_MOB_MIN, K.LINK_DIAL_MOB_MAX, a, b, 0x6469616c) : ldraw(K.LINK_DIAL_DESK_MIN, K.LINK_DIAL_DESK_MAX, a, b, 0x6469616c);
    levPush(TICK() + d, EV_DIAL, a, b, L.epoch, 'dial');
  };

  // C++: mesh_link.inc:linkDeliver
  // An open link carries the frame: the parent's loss / latency, no first-contact cost. `m` is the caller's (moved).
  const linkDeliver = api.linkDeliver = (from, to, m, L) => {
    const e = lEnd(from, to); L.carried = true; L.txAt[e] = TICK(); LTX[from] = TICK();
    if (L.outside) { const sf = seats[from]; m.dsat = sf.hasCoord && sf.state === 3; }
    if (L.outside && L.dBorn >= 0) {
      const t = m.t;
      if (t === 'WHOHOME') { if (!L.dAsked) { L.dAsked = true; L.dProg = TICK(); } }
      else if (t === 'HOME') { if (!L.dHomed) { L.dHomed = true; L.dProg = TICK(); } }
      else if (t === 'FIND' || t === 'FINDACK' || t === 'PLACE' || t === 'NOROOM' || t === 'HANDOFF' || t === 'TAKEOVER' || t === 'TAKEN') {
        L.dProg = TICK(); L.dGw = true; if (t === 'FIND') L.dWaitAtFind = L.dWait; if (t === 'FINDACK') L.dWait = TICK(); else if (t === 'PLACE' || t === 'NOROOM') { L.dWait = -1; L.dOwed = false; }
      }
    }
    const pk = pairKey(from, to);
    const cond = (lv.NUM_SUBNETS > 1 || lv.NET_LOSS > 0 || lv.NET_SEVER > 0 || lv.NET_LAT > 1 || lv.NET_QUAL_MIN < 1.0);
    let d;
    if (cond) {
      const sf = seats[from], st = seats[to];
      if (lv.NET_SEVER > 0) {
        const it = fab.severedUntil.get(pk);
        if (it !== undefined) { if (it > TICK()) return; fab.severedUntil.delete(pk); }
        if (fab.frnd() < lv.NET_SEVER) { fab.severedUntil.set(pk, TICK() + 40 + Math.trunc(fab.frnd() * 160)); return; }
      }
      const q = Math.min(sf.netQual, st.netQual);
      if (lv.NET_LOSS > 0 && fab.frnd() < lv.NET_LOSS * (1.0 + 2.0 * (1.0 - q))) return;
      const spread = (lv.NET_LAT > 1) ? 1 + Math.trunc(fab.frnd() * lv.NET_LAT) : 1 + (lv.SEQ & 1);
      const qp = (q < 1.0) ? Math.trunc((1.0 - q) * 4.0 * fab.frnd()) : 0;
      d = spread + qp;
    } else d = 1 + (lv.SEQ & 1);
    m.to = to; m.from = from; m.lk = (m.rvia < 0) ? from : -1; m.lkEp = L.epoch; lv.SEQ++; fab.wireTx(m, from);
    { const re = lEnd(to, from); if (L.arrAt[re] < TICK() + d) L.arrAt[re] = TICK() + d; }
    if (m.fhTo < 0 && LRX[to] < TICK() + d) LRX[to] = TICK() + d;
    if (m.lk >= 0 && m.t === 'FIND') X.l374Note(from, to, m);
    fab.busPush(TICK() + d, m);
  };

  // C++: mesh_link.inc:linkOpenFor
  const linkOpenFor = api.linkOpenFor = (from, to) => { const L = linkFind(from, to); return !!L && L.state === LK_OPEN && !(L.half & (1 << lEnd(from, to))); };

  // C++: mesh_link.inc:l15Names
  const l15Names = api.l15Names = (a, b) => !!seats[a].linkRole(b, E.LR_OWNED | E.LR_E2);
  // C++: mesh_link.inc:l16Refuse
  const l16Refuse = (from, to, mt) => {
    const sf = seats[from], st = seats[to];
    if (sf.hasCoord && sf.state === 3) {
      if (st.hasCoord && st.state === 3) return false; if (l15Names(from, to)) return false;
      if (mt === 'HOME') { lv.L16_DROP++; trace('L16-DROP', from, null, 'to=%d mt=%d why=home', to, mtIdx(mt)); return true; }
      if (from < DOORN.length && DOORN[from] >= pcBudget(from, PB_DOORS)) { lv.L16_DEFER = true; lv.L16_DEFERRED++; return true; }
      if (l1610Full(from)) { lv.L16_DEFER = true; lv.L16_DEFERRED++; return true; }
      if (l16Mobile(from) && !l16MobBudget(from)) { lv.L16_DEFER = true; lv.L16_DEFERRED++; return true; }
      return false;
    }
    let full;
    if (!(st.hasCoord && st.state === 3)) { if (mt !== 'WHOHOME' && mt !== 'FIND') return false; full = true; }
    else full = (to < DOORK.length && DOORK[to] >= pcBudget(to, PB_KNOCKS));
    if (!full && l1610Full(to)) full = true;
    if (!full && l16Mobile(to) && st.hasCoord && st.state === 3 && !l16MobBudget(to)) full = true;
    if (!full) { const c = L16COOL.get(idPair(to, from)); if (c === undefined || c[0] <= TICK()) return false; }
    if (!alive[to] || isFrozen(to) || radioOff(to)) return true;
    if (lv.NETGRP) { X.relayMeter(from, 1); X.relayMeter(to, 1); }
    lv.L16_BUSY++; const b = msg.newMsg('BUSY'); b.id = to; b.from = to; b.to = from; b.lk = -1; fab.busPush(TICK() + 2, b);
    return true;
  };
  // (the L16 queue-then-dial step shared by linkSchedule's none and closed arms)
  const deferDoor = (from, to, m, L) => {
    m.from = from; m.to = to; if (L.q.length < K.LINK_QCAP) L.q.push(m);
    let known = false; for (const pr of DOOR_PEND) if (pr.a === from && pr.b === to) { known = true; break; }
    if (!known) DOOR_PEND.push({ a: from, b: to, at: TICK() });
  };

  // C++: mesh_link.inc:l1342On
  const l1342On = (from) => from >= 0 && from < nextId() && seatM.roomTerm(seats[from], -1);

  // C++: mesh_link.inc:linkSchedule
  // schedule() under linkmodel 1, for a frame between two seats over a peer connection. `m` is the caller's copy.
  const linkSchedule = api.linkSchedule = (from, to, m) => {
    if (l1342On(from) && seatM.l13Frame(m)) noteCall(from, to);
    if (lv.NUM_SUBNETS > 1 && !fab.reachable(seats[from].subnet, seats[to].subnet)) return;
    const L = linkGet(from, to); const e = lEnd(from, to);
    switch (L.state) {
      case LK_NONE:
        if (dialHeld(from, to)) return; if (X.l23Refused(to, from, m.t, (m.t === 'HELLO' || m.t === 'CLAIM' || (m.t === 'CHALLENGE' && m.tag === 25)) ? m.ck : 0)) return;   /* (L39.2: an L25 question names the cell it asks about) */
        { lv.L16_DEFER = false; if (l16Refuse(from, to, m.t)) { if (lv.L16_DEFER) { lv.L16_DEFER = false; deferDoor(from, to, m, L); } return; } }
        startDial(from, to, L); L.dialT = mtIdx(m.t); m.from = from; m.to = to; if (L.q.length < K.LINK_QCAP) L.q.push(m); LTX[from] = TICK(); return;
      case LK_DIALING:
        if (L.dialT < 0) L.dialT = mtIdx(m.t); m.from = from; m.to = to; if (L.q.length < K.LINK_QCAP) L.q.push(m); LTX[from] = TICK(); return;
      case LK_CLOSED:
        LTX[from] = TICK();
        if (L.view[e] !== LK_CLOSED && !(L.view[e] === LK_NONE)) return;
        if ((!namesOwned(from, to) || m.gwc) && TICK() - L.askAt >= K.LINK_ASK_GAP && !dialHeld(from, to)) {
          if (X.l23Refused(to, from, m.t, (m.t === 'HELLO' || m.t === 'CLAIM') ? m.ck : 0)) return;
          { lv.L16_DEFER = false; if (l16Refuse(from, to, m.t)) { if (lv.L16_DEFER) { lv.L16_DEFER = false; deferDoor(from, to, m, L); } return; } }
          L.askAt = TICK(); startDial(from, to, L); L.dialT = mtIdx(m.t); L.dialHow = 3; m.from = from; m.to = to; L.q.push(m);
        }
        return;
      default:
        if (L.agreed[e] && m.t !== 'UNNEEDED') { if (L.hold[e].length < K.LINK_QCAP) { m.from = from; m.to = to; L.hold[e].push(m); } LTX[from] = TICK(); return; }
        if (L.half & (1 << e)) { L.txAt[e] = TICK(); LTX[from] = TICK(); return; }
        linkDeliver(from, to, m, L);
    }
  };

  // C++: mesh_link.inc:l30End
  const l30End = (id) => id >= 0 && id < nextId() && !!alive[id] && !!seats[id] && !!seats[id].l30Small();
  // C++: mesh_link.inc:downAt
  const downAt = api.downAt = (at, e, x, ep, why) => { levPush(at, EV_DOWN, e, x, ep, why); };
  // C++: mesh_link.inc:closeBoth
  const closeBoth = api.closeBoth = (L, a, b, fail, why) => {
    if (L.state !== LK_OPEN && L.state !== LK_DIALING) return;
    const wasOpen = L.state === LK_OPEN;
    L.state = LK_CLOSED; L.epoch = U32(L.epoch + 1); L.q.length = 0; L.half = 0; L.halfAt = -1;
    if (!wasOpen) {
      for (let k = 0; k < 2; k++) if (L.view[k] === LK_DIALING) L.view[k] = LK_CLOSED;
      if (why === 'leave-close' && b < nextId() && alive[b] && !seats[b].hasCoord) { const m = msg.newMsg('TRANSLOST'); m.id = a; m.to = b; m.from = -1; m.hard = true; m.bye = true; fab.busPush(TICK() + 1, m); }   // L45
      return;
    }
    let da = fail ? TICK() + K.LINK_FAILED_PERSIST : TICK() + ldraw(K.LINK_DC_MIN, K.LINK_DC_MAX, a, b, 0x6463);
    let db = fail ? TICK() + K.LINK_FAILED_PERSIST : TICK() + ldraw(K.LINK_DC_MIN, K.LINK_DC_MAX, b, a, 0x6463);
    if (!fail && why === 'leave-close') { da = Math.max(da, L.arrAt[lEnd(a, b)] + 1); db = Math.max(db, L.arrAt[lEnd(b, a)] + 1); }
    downAt(da, a, b, L.epoch, why); downAt(db, b, a, L.epoch, why);
  };
  // C++: mesh_link.inc:closeFrom
  const closeFrom = api.closeFrom = (L, e, x, why) => {
    if (L.state !== LK_OPEN) return;
    const hAt = L.halfAt >= 0 ? L.halfAt : TICK(); const eLive = !(L.half & (1 << lEnd(e, x))); const stuck = L.stuck;
    L.state = LK_CLOSED; L.epoch = U32(L.epoch + 1); L.q.length = 0; L.half = 0; L.halfAt = -1;
    downAt(TICK(), e, x, L.epoch, why);
    if (eLive && pathOk(e, x)) downAt(TICK() + ldraw(K.LINK_DC_MIN, K.LINK_DC_MAX, x, e, 0x6463), x, e, L.epoch, 'dc-close');
    else if (stuck) downAt(Math.max(TICK(), hAt + K.LINK_DISC_DEAD), x, e, L.epoch, 'disconnected-persist');
    else downAt(Math.max(TICK(), hAt + K.LINK_ICE_FAIL) + K.LINK_FAILED_PERSIST, x, e, L.epoch, 'failed-persist');
  };
  // C++: mesh_link.inc:linkHalf
  const linkHalf = api.linkHalf = (L, a, b, mask, failPath) => {
    if (L.state !== LK_OPEN) return;
    if (L.halfAt < 0) L.halfAt = TICK();
    L.half |= mask; const fail = failPath && L.half === 3; L.stuck = !fail;
    if (fail) levPush(L.halfAt + K.LINK_ICE_FAIL, EV_ICE, a, b, L.epoch, 'ice-failed', L.halfAt);
    else if (L.half === 3 || L.carried) { levPush(L.halfAt + K.LINK_DISC_DEAD, EV_DISC, a, b, L.epoch, 'disconnected-persist', L.halfAt); levPush(L.halfAt + K.L30_DISC_DEAD, EV_DSMALL, a, b, L.epoch, 'disconnected-persist', L.halfAt); }
    else {
      const dead = (L.half & 1) ? 0 : 1;
      const lo = Math.min(a, b), hi = Math.max(a, b); const rcv = dead === 0 ? hi : lo;
      levPush(TICK() + K.LINK_STARVE, EV_STARVE1, rcv, rcv === lo ? hi : lo, L.epoch, 'starve', L.halfAt);
    }
  };
  // C++: mesh_link.inc:linkOpenNow
  const linkOpenNow = api.linkOpenNow = (L, a, b) => {
    L.state = LK_OPEN; L.openEp = L.epoch; L.half = 0; L.halfAt = -1; L.stuck = false; L.view[0] = L.view[1] = LK_OPEN;
    {
      L1341_OPENED.add(pairKey(a, b));
      for (let k = 0; k < 2; k++) {
        const p = k ? b : a, o = k ? a : b;
        if (p < nextId() && seats[p]) for (const [ck, v] of seats[p].l13SplitCell) if (v[0] === o) { trace('L13.41-JOINED', p, null, 'peer=%d', o); seats[p].l13SplitCell.delete(ck); }
      }
    }
    if (L.outside && L.dBorn >= 0) L.dProg = TICK();
    { if (a < nextId()) seats[a].dials.opened(b); if (b < nextId()) seats[b].dials.opened(a); }
    LSTAT[1]++; if (L.wasOpen) { LSTAT[3]++; trace('LINK-UP', a, null, 'peer=%d', b); trace('LINK-UP', b, null, 'peer=%d', a); } L.wasOpen = true;
    if (LRX[a] < TICK()) LRX[a] = TICK(); if (LRX[b] < TICK()) LRX[b] = TICK();
    const q = L.q; L.q = [];
    { let nf = -1, nt = -1; for (const m of q) if (seatM.l13Frame(m) && !(m.from === nf && m.to === nt) && l1342On(m.from)) { nf = m.from; nt = m.to; noteCall(nf, nt); } }
    for (const m of q) { const f = m.from, t = m.to; linkDeliver(f, t, m, L); }
  };

  // C++: mesh_link.inc:linkCloseAll
  const linkCloseAll = api.linkCloseAll = (id, fail, why) => {
    lEnsure(id); const ps = LINKPEERS[id].slice();
    for (const p of ps) { const L = linkFind(id, p); if (L) closeBoth(L, id, p, fail, why); }
  };
  // C++: mesh_link.inc:linkBlackhole
  const linkBlackhole = api.linkBlackhole = (id) => {
    if (!lv.LINKMODEL) return;
    lEnsure(id); const ps = LINKPEERS[id].slice();
    for (const p of ps) { const L = linkFind(id, p); if (L) linkHalf(L, id, p, 3, false); }
  };
  // C++: mesh_link.inc:linkOnLeave
  const linkOnLeave = api.linkOnLeave = (id) => { if (lv.LINKMODEL) LPENDCLOSE.push(id); };
  // C++: mesh_link.inc:linkCrash
  const linkCrash = (id) => {
    lEnsure(id); const ps = LINKPEERS[id].slice();
    for (const p of ps) {
      const L = linkFind(id, p); if (!L) continue;
      const greeter = p < nextId() && !!alive[p] && seats[p].hasCoord && seats[p].coord.pc === 0;
      if (greeter && (L.state === LK_OPEN || L.state === LK_DIALING)) {
        const wasOpen = L.state === LK_OPEN; L.state = LK_CLOSED; L.epoch = U32(L.epoch + 1); L.q.length = 0; L.half = 0; L.halfAt = -1;
        if (wasOpen) downAt(TICK() + 1, p, id, L.epoch, 'relay-leave'); else L.view[lEnd(p, id)] = LK_CLOSED;
      } else linkHalf(L, id, p, 3, false);
    }
  };
  // C++: mesh_link.inc:crashTransport
  const crashTransport = api.crashTransport = (id) => { if (lv.LINKMODEL) linkCrash(id); else fab.fireTranslost(id); };
  // C++: mesh_link.inc:linkResume
  const linkResume = api.linkResume = (id) => {
    lEnsure(id);
    for (const p of LINKPEERS[id]) { const L = linkFind(id, p); if (!L || L.state === LK_NONE) continue; L.state = LK_CLOSED; L.epoch = U32(L.epoch + 1); L.q.length = 0; L.half = 0; L.halfAt = -1; L.view[lEnd(id, p)] = LK_CLOSED; }
  };

  // C++: mesh_link.inc:l1341Note
  const l1341Note = (me, x) => {
    if (me < 0 || me >= nextId() || !alive[me] || x < 0 || x >= nextId() || !alive[x] || fab.sockClosed(x) || !L1341_OPENED.has(pairKey(me, x))) return;
    const s = seats[me];
    for (const [ck, ox] of s.occ) if (ox === x) {
      const c = ins(s.l13SplitCell, ck, () => [0, 0]);
      if (c[1] !== s.TICK) trace('L13.41-SPLIT', me, s.hasCoord ? s.coord : null, 'peer=%d cell=%s', x, fab.coordStr(unckey(ck)));
      c[0] = x; c[1] = s.TICK;
    }
    if (s.l13SplitCell.size > 64) s.l13SplitCell.clear();
  };

  // C++: mesh_link.inc:linkApply
  const linkApply = api.linkApply = (v) => {
    const Lp = linkFind(v.a, v.b); if (!Lp && v.kind !== EV_RADIOEND) return;
    switch (v.kind) {
      case EV_DIAL: {
        const L = Lp; if (L.epoch !== v.epoch || L.state !== LK_DIALING) return;
        if (pathOk(v.a, v.b)) { linkOpenNow(L, v.a, v.b); return; }
        if (TICK() - L.dialAt < K.LINK_DIAL_FAIL) { levPush(TICK() + 1, EV_DIAL, v.a, v.b, v.epoch, 'dial'); return; }
        if (!X.grpReach(v.a, v.b)) l1341Note(v.a, v.b);
        if (v.a < nextId() && alive[v.a]) { seats[v.a].dials.holdLost(v.b, seats[v.a].TICK); }
        L.state = LK_CLOSED; L.epoch = U32(L.epoch + 1); L.q.length = 0; LSTAT[2]++;
        { if (v.a < nextId()) seats[v.a].dials.failed(v.b, seats[v.a].TICK, true); if (v.b < nextId()) seats[v.b].dials.failed(v.a, seats[v.b].TICK, true); }
        for (let k = 0; k < 2; k++) if (L.view[k] === LK_DIALING || L.view[k] === LK_NONE) L.view[k] = LK_CLOSED;
        return;
      }
      case EV_DOWN: {
        const L = Lp; if (v.why === 'unneeded' && !L.agreed[lEnd(v.a, v.b)]) X.l374Resend(v.a, v.b, L);
        if (L.openEp > v.epoch) return;
        const e = v.a, x = v.b; if (L.view[lEnd(e, x)] !== LK_DIALING) L.view[lEnd(e, x)] = LK_CLOSED;
        if (L.callClosed && L.state === LK_CLOSED) { L.gone |= (1 << lEnd(e, x)); if (L.view[0] === LK_CLOSED && L.view[1] === LK_CLOSED) linkErase(v.a, v.b); return; }
        if (e >= nextId() || !alive[e]) return;
        if (L.agreed[lEnd(e, x)]) {
          L.agreed[lEnd(e, x)] = false; L.closingAt[lEnd(e, x)] = -1; const h = L.hold[lEnd(e, x)];
          if (h.length && L.state === LK_CLOSED && e < nextId() && alive[e] && x < nextId() && alive[x]) {
            const q = h.slice(); h.length = 0; L.callClosed = false; startDial(e, x, L); L.dialT = mtIdx(q[0].t);
            for (const f of q) if (L.q.length < K.LINK_QCAP) L.q.push(f); trace('L22-REDIAL', e, null, 'peer=%d held=%zu why=%s', x, q.length, v.why);
          } else h.length = 0;
        }
        if (v.why === 'unneeded') return;
        const dk = idPair(e, x); const it = TLDEB.get(dk);
        if (it !== undefined && TICK() - it < K.LINK_TL_DEBOUNCE) { LSTAT[5]++; return; }
        TLDEB.set(dk, TICK()); LSTAT[4]++;
        trace('LINK-DOWN', e, null, 'peer=%d why=%s', x, v.why);
        if (v.why === 'disconnected-persist' || v.why === 'failed-persist' || v.why === 'leave-close' || v.why === 'relay-leave') {
          const se = seats[e]; const da = se.l13DownAt, dp = se.l13DownPeer, dc = se.l13DownCrash;
          da.push(se.TICK); dp.push(x); dc.push(v.why === 'disconnected-persist' || v.why === 'failed-persist' ? 1 : 0);
          if (da.length > 32) { da.shift(); dp.shift(); dc.shift(); }
          if (v.why === 'disconnected-persist' || v.why === 'failed-persist') se.l13CrashAt = TICK();
        }
        const hard = !(v.why === 'failed-persist' || v.why === 'disconnected-persist' || v.why === 'starve' || v.why === 'starve-dead');
        const m = msg.newMsg('TRANSLOST'); m.id = x; m.to = e; m.from = -1; m.hard = hard; m.pst = v.why === 'disconnected-persist' || v.why === 'failed-persist'; m.bye = v.why === 'leave-close' && !seats[e].hasCoord; fab.busPush(TICK(), m); return;
      }
      case EV_ICE: case EV_DISC: {
        const L = Lp; if (L.epoch !== v.epoch || L.state !== LK_OPEN || L.half === 0 || L.halfAt !== v.ref) return;
        LSTAT[7]++; L.state = LK_CLOSED; L.epoch = U32(L.epoch + 1); L.q.length = 0; L.half = 0; L.halfAt = -1;
        const at = v.kind === EV_ICE ? TICK() + K.LINK_FAILED_PERSIST : TICK();
        const why = v.kind === EV_ICE ? 'failed-persist' : 'disconnected-persist';
        downAt(at, v.a, v.b, L.epoch, why); downAt(at, v.b, v.a, L.epoch, why); return;
      }
      case EV_DSMALL: {
        const L = Lp; if (L.epoch !== v.epoch || L.state !== LK_OPEN || L.half === 0 || L.halfAt !== v.ref) return;
        const sa = l30End(v.a), sb = l30End(v.b); if (!sa && !sb) return;
        const hAt = L.halfAt; LSTAT[7]++; L.state = LK_CLOSED; L.epoch = U32(L.epoch + 1); L.q.length = 0; L.half = 0; L.halfAt = -1;
        downAt(sa ? TICK() : hAt + K.LINK_DISC_DEAD, v.a, v.b, L.epoch, 'disconnected-persist'); downAt(sb ? TICK() : hAt + K.LINK_DISC_DEAD, v.b, v.a, L.epoch, 'disconnected-persist'); return;
      }
      case EV_STARVE1: {
        const L = Lp; if (L.epoch !== v.epoch || L.state !== LK_OPEN || L.halfAt !== v.ref) return;
        const e = v.a, x = v.b; if (!(L.half & (1 << lEnd(x, e))) || (L.half & (1 << lEnd(e, x)))) return;
        if (L.txAt[lEnd(e, x)] < L.halfAt) return;
        LSTAT[6]++; closeFrom(L, e, x, 'starve'); return;
      }
      case EV_FRESH: {
        const L = Lp; if (L.state !== LK_OPEN || L.half || L.epoch !== v.epoch) return; trace('FRESH-PC', v.a, null, 'peer=%d', v.b); L.epoch = U32(L.epoch + 1); linkOpenNow(L, v.a, v.b); return;
      }
      case EV_RADIOEND: {
        const id = v.a; const it = RADIO.get(id); if (it === undefined || it > TICK()) return; RADIO.delete(id);
        lEnsure(id);
        for (const p of LINKPEERS[id]) { const L = linkFind(id, p); if (!L || L.state !== LK_OPEN || L.half !== 3 || L.leverHalf || radioOff(p) || isFrozen(id) || isFrozen(p)) continue; L.half = 0; L.halfAt = -1; L.backAt[0] = L.backAt[1] = TICK(); }
        return;
      }
    }
  };

  // C++: mesh_link.inc:l15Seated
  const l15Seated = api.l15Seated = (id) => {
    if (id >= nextId() || !alive[id]) return false; const s = seats[id]; if (!s.hasCoord || s.state !== 3) return false;
    if (s.seatedAt < 0 || s.TICK - s.seatedAt < lv.L15_SETTLE) return false;
    const ol = ownedLinks(s.coord);
    for (let k = 0; k < ol.length; k++) { const x = s.occGet(ckey(ol[k])); if (x < 0 || x === id) continue; const L = linkFind(id, x); if (L && L.state === LK_OPEN && L.view[lEnd(id, x)] === LK_OPEN) return true; }
    const o = s.ownerCoord(); if (o) { const x = s.occGet(ckey(o)); if (x >= 0 && x !== id) { const L = linkFind(id, x); if (L && L.state === LK_OPEN && L.view[lEnd(id, x)] === LK_OPEN) return true; } }
    return false;
  };
  // C++: mesh_link.inc:l15NamedBy
  const l15NamedBy = api.l15NamedBy = (me, x) => {
    const s = seats[me]; if (!s.hasCoord) return false; const mk = ckey(s.coord);
    const ol = ownedLinks(s.coord).slice(); { const o = s.ownerCoord(); if (o) ol.push(o); }
    for (let k = 0; k < ol.length; k++) { if (s.occGet(ckey(ol[k])) !== x) continue; const xl = ownedLinks(ol[k]); for (let j = 0; j < xl.length; j++) if (ckey(xl[j]) === mk) return true; }
    return false;
  };
  const doorHeard = api.doorHeard = (L, me, x) => !!(L.dHeard & (1 << lEnd(me, x)));
  // C++: mesh_link.inc:doorEnd
  const doorEnd = api.doorEnd = (L, me, x) => {
    if (!L.outside) return false;
    if ((L.outside & (1 << lEnd(me, x))) && !l15Seated(me)) return true;
    if ((L.outside & (1 << lEnd(x, me))) && !doorHeard(L, me, x)) return true;
    return false;
  };
  // C++: mesh_link.inc:fabricDoorHeard
  api.fabricDoorHeard = (me, x, ep) => { if (!lv.LINKMODEL || x < 0 || x >= nextId() || me === x) return; const L = linkFind(me, x); if (L && L.outside && L.epoch === ep) L.dHeard |= (1 << lEnd(me, x)); };

  // C++: mesh_link.inc:l15Doors
  const l15Doors = api.l15Doors = () => {
    for (const pk of sortedDoors()) {
      const a = pkA(pk), b = pkB(pk); const L = linkFind(a, b);
      if (!L || !L.outside || L.state === LK_CLOSED || L.state === LK_NONE) { LDOORS.delete(pk); continue; }
      if (L.state !== LK_OPEN || L.half) continue;
      let k = -1;
      for (const x of [a, b]) {
        const y = x === a ? b : a; if (!(L.outside & (1 << lEnd(x, y)))) continue; if (x >= nextId() || !alive[x] || !l15Seated(x)) continue;
        if ((L.outside & (1 << lEnd(y, x))) && !doorHeard(L, x, y)) continue;
        if (l15Names(x, y) || l15NamedBy(x, y)) continue;
        if (L.backAt[lEnd(x, y)] >= 0 && TICK() - L.backAt[lEnd(x, y)] < K.L15_BACK_HOLD) continue;
        k = x; break;
      }
      if (k < 0) continue;
      const g = k === a ? b : a; const kLive = !(L.half & (1 << lEnd(k, g))); const hAt = L.halfAt >= 0 ? L.halfAt : TICK(); const stuck = L.stuck;
      L.state = LK_CLOSED; L.epoch = U32(L.epoch + 1); L.q.length = 0; L.half = 0; L.halfAt = -1; L.outside = 0; L.view[lEnd(k, g)] = LK_CLOSED;
      trace('DOOR-CLOSE', k, null, 'peer=%d', g); L16CLOSING.push([pk, g]);
      if (kLive && pathOk(k, g)) downAt(Math.max(TICK() + ldraw(K.LINK_DC_MIN, K.LINK_DC_MAX, g, k, 0x6463), L.arrAt[lEnd(g, k)] + 1), g, k, L.epoch, 'door-close');
      else if (stuck) downAt(Math.max(TICK(), hAt + K.LINK_DISC_DEAD), g, k, L.epoch, 'disconnected-persist');
      else downAt(Math.max(TICK(), hAt + K.LINK_ICE_FAIL) + K.LINK_FAILED_PERSIST, g, k, L.epoch, 'failed-persist');
      lv.L15_CLOSED++; LDOORS.delete(pk);
    }
  };
  // C++: mesh_link.inc:l16Close
  const l16Close = api.l16Close = (L, by, x) => {
    if (L.state === LK_DIALING) { L.state = LK_CLOSED; L.epoch = U32(L.epoch + 1); L.q.length = 0; for (let k = 0; k < 2; k++) if (L.view[k] === LK_DIALING) L.view[k] = LK_CLOSED; L.outside = 0; return; }
    if (L.state !== LK_OPEN) return;
    const bLive = !(L.half & (1 << lEnd(by, x))); const hAt = L.halfAt >= 0 ? L.halfAt : TICK(); const stuck = L.stuck;
    L.state = LK_CLOSED; L.epoch = U32(L.epoch + 1); L.q.length = 0; L.half = 0; L.halfAt = -1; L.outside = 0; L.view[lEnd(by, x)] = LK_CLOSED;
    if (bLive && pathOk(by, x)) downAt(Math.max(TICK() + ldraw(K.LINK_DC_MIN, K.LINK_DC_MAX, x, by, 0x6463), L.arrAt[lEnd(x, by)] + 1), x, by, L.epoch, 'door-close');
    else if (stuck) downAt(Math.max(TICK(), hAt + K.LINK_DISC_DEAD), x, by, L.epoch, 'disconnected-persist');
    else downAt(Math.max(TICK(), hAt + K.LINK_ICE_FAIL) + K.LINK_FAILED_PERSIST, x, by, L.epoch, 'failed-persist');
  };
  // C++: mesh_link.inc:fabricDoorDrop
  const fabricDoorDrop = api.fabricDoorDrop = (me, x) => {
    if (!lv.LINKMODEL || me < 0 || x < 0 || me === x || x >= nextId()) return;
    const L = linkFind(me, x); if (!L || !L.outside || L.dSat || !(L.outside & (1 << lEnd(me, x))) || (L.state !== LK_OPEN && L.state !== LK_DIALING)) return;
    lv.L16_BYE++; trace('DOOR-BYE', me, null, 'peer=%d', x); const wasOpen = L.state === LK_OPEN; l16Close(L, me, x); LDOORS.delete(pairKey(me, x)); if (wasOpen) L16CLOSING.push([pairKey(me, x), x]);
  };
  // C++: mesh_link.inc:fabricMyDoors
  const fabricMyDoors = (me) => (me >= 0 && me < DOORN.length) ? DOORN[me] : 0;
  // C++: mesh_link.inc:fabricMyKnocks
  const fabricMyKnocks = (me) => (me >= 0 && me < DOORK.length) ? DOORK[me] : 0;
  // C++: mesh_link.inc:fabricNoSock
  const fabricNoSock = (me, g) => {
    if (!lv.LINKMODEL || me < 0 || g < 0 || g >= nextId() || me >= nextId()) return;
    if (alive[g] && seats[g]) { if (seats[g].socketed()) return; }
    const m = msg.newMsg('BUSY'); m.nosock = true; m.id = g; m.to = me; m.from = -1; fab.busPush(TICK() + 1, m);
  };
  // C++: mesh_link.inc:fabricDoorHanded
  const fabricDoorHanded = (me, x) => {
    if (!lv.LINKMODEL || me < 0 || x < 0 || x >= nextId()) return;
    const L = linkFind(me, x); if (L && L.outside && (L.outside & (1 << lEnd(x, me))) && L.dHoAt < 0) { L.dHoAt = TICK(); if (L.dWaitAtFind >= 0 && L.dWait >= 0) { L.dOwed = true; L.dOwedAt = L.dWaitAtFind; } }
  };

  // C++: mesh_link.inc:l16Doors
  const l16Doors = api.l16Doors = () => {
    DOORN = api.DOORN = new Array(nextId()).fill(0); DOORK = api.DOORK = new Array(nextId()).fill(0); let evilMax = 0; let evilN = [];
    for (const pk of sortedDoors()) {
      const a = pkA(pk), b = pkB(pk); const L = linkFind(a, b);
      if (!L || !L.outside || L.outside === 3 || (L.state !== LK_OPEN && L.state !== LK_DIALING) || a >= nextId() || b >= nextId()) continue;
      const k = (L.outside & (1 << lEnd(a, b))) ? a : b, g = k === a ? b : a;
      if (alive[k] && seats[k].hasCoord && seats[k].state === 3) L.dSat = true;
      const heard = doorHeard(L, g, k);
      const named = l15Names(g, k) || l15NamedBy(g, k);
      if (!heard && !named && alive[g] && L.dBorn >= 0) {
        const idle = TICK() - L.dProg, age = TICK() - L.dBorn; let why = null;
        if (L.dHoAt >= 0 && TICK() - L.dHoAt >= K.L16_HO_CLOSE && !(L.dOwed && L.dWait >= 0)) why = 'handed';
        else if (L.dGw && !(L.dIn)) { if (idle > K.L16_GW_IDLE && !(L.dWait >= 0)) why = 'gw-idle'; else if (age > K.L16_GW_LIFE) why = 'gw-life'; }
        else if (L.dIn && L.state === LK_OPEN && !L.dAsked && L.dProg === L.dBorn) why = 'unnamed';
        else if (L.dIn && !L.dAsked && L.state === LK_OPEN && idle > K.L16_ANS_IDLE) why = 'idle';
        else if (idle > K.L16_IDLE) why = 'idle'; else if (age > K.L16_LIFE) why = 'life';
        if (why) {
          if (why[0] === 'h') lv.L16_HANDED++; else if (why[0] === 'g') lv.L16_GWC++; else if (why[0] === 'i') lv.L16_IDLEC++; else if (why[0] === 'u') lv.L16_UNN++; else lv.L16_LIFEC++;
          trace('DOOR-LIMIT', g, null, 'peer=%d why=%s age=%lld idle=%lld', k, why, age, idle);
          l16Close(L, g, k); if (why[0] !== 'u' && why[0] !== 'h') { const c = ins(L16COOL, idPair(g, k), () => [0, 0]); c[1]++; c[0] = TICK() + (K.L16_COOL * Math.pow(2, Math.min(c[1] - 1, 4))); } LDOORS.delete(pk); continue;
        }
      }
      if (!heard && !named) {
        DOORN[g]++; if (!L.dIn) DOORK[g]++; if (DOORN[g] > lv.L16_DOORPEAK) lv.L16_DOORPEAK = DOORN[g]; if (DOORN[g] - DOORK[g] > lv.L16_ANSPEAK) lv.L16_ANSPEAK = DOORN[g] - DOORK[g];
        if (k < nextId() && seats[k].evilDoor) { if (evilN.length < nextId()) evilN = new Array(nextId()).fill(0); if (++evilN[g] > evilMax) evilMax = evilN[g]; }
      }
    }
    {
      let wr = 0;
      for (let q = 0; q < L16CLOSING.length; q++) {
        const pk = L16CLOSING[q][0], g = L16CLOSING[q][1]; const a = pkA(pk), b = pkB(pk); const L = linkFind(a, b); const k = g === a ? b : a;
        if (!L || L.state !== LK_CLOSED || L.view[lEnd(g, k)] === LK_CLOSED || g >= nextId() || !alive[g]) continue;
        DOORN[g]++; if (!L.dIn) DOORK[g]++; if (DOORN[g] > lv.L16_DOORPEAK) lv.L16_DOORPEAK = DOORN[g]; L16CLOSING[wr++] = L16CLOSING[q];
      }
      L16CLOSING.length = wr;
    }
    if (evilMax > lv.L16_EVILPEAK) lv.L16_EVILPEAK = evilMax;
    if (L16COOL.size > 4096) { for (const [ck, c] of L16COOL) if (c[0] + 16 * K.L16_COOL <= TICK()) L16COOL.delete(ck); }
  };

  // C++: mesh_link.inc:closedDrop
  // CLOSEDROP (fidelity): a frame that reaches an end after that end saw its pc close is lost.
  const closedDrop = api.closedDrop = (m) => {
    if (!lv.LINKMODEL || m.lk < 0 || m.lk === m.to || m.to < 0 || m.lk >= nextId()) return false;
    const L = linkFind(m.lk, m.to);
    if (!L) { lv.ERASEDROPS++; trace('ERASEDROP', m.to, null, 'from=%d mt=%d', m.lk, mtIdx(m.t)); return true; }
    if (L.view[lEnd(m.to, m.lk)] === LK_OPEN) return false;
    lv.CLOSEDROPS++; trace('CLOSEDROP', m.to, null, 'from=%d mt=%d', m.lk, mtIdx(m.t)); return true;
  };

  // ---- L22: a pc with no reason closes -------------------------------------------------------------------------
  // C++: mesh_link.inc:l22Quiet
  const l22Quiet = (me, x) => { const L = linkFind(me, x); if (!L) return false; const t = L.nnAt[lEnd(me, x)]; return t >= 0 && TICK() - t >= K.L22_SETTLE; };
  const l221Sent = (L, me, x) => L.agreed[lEnd(me, x)];
  // C++: mesh_link.inc:l222Note
  const l222Note = (me, x) => { const L = linkFind(me, x); if (!L || L.state !== LK_OPEN || doorEnd(L, me, x)) return; L.farAsk[lEnd(me, x)] = TICK(); };
  // C++: mesh_link.inc:l22Agree
  const l22Agree = (me, x) => {
    const L = linkFind(me, x); if (!L || L.state !== LK_OPEN || doorEnd(L, me, x) || l221Sent(L, me, x)) return;
    const a = msg.newMsg('UNNEEDED'); a.id = me; a.tag = 1; fab.schedL10(me, x, a, 'L22SEQ'); trace('L22-AGREE', me, null, 'peer=%d', x);
  };
  // C++: mesh_link.inc:l22CloseAsk
  const l22CloseAsk = (me, x) => {
    const L = linkFind(me, x); if (!L || L.state !== LK_OPEN || doorEnd(L, me, x) || l221Sent(L, me, x)) return;
    const a = msg.newMsg('UNNEEDED'); a.id = me; a.tag = 3; fab.schedL10(me, x, a, 'L22SEQ'); L.agreed[lEnd(me, x)] = true; L.closingAt[lEnd(me, x)] = TICK(); trace('L22-CLOSING', me, null, 'peer=%d', x);
  };
  // C++: mesh_link.inc:l22Release
  const l22Release = api.l22Release = (me, x) => {
    const L = linkFind(me, x); if (!L) return; const e = lEnd(me, x); if (!L.agreed[e]) return; L.agreed[e] = false; const q = L.hold[e]; L.hold[e] = [];
    for (const f of q) { const g = msg.clone(f); linkDeliver(me, x, g, L); } trace('L22-RELEASE', me, null, 'peer=%d held=%zu', x, q.length);
  };
  // C++: mesh_link.inc:l22Close
  const l22Close = (me, x) => {
    const L = linkFind(me, x); if (!L || L.state !== LK_OPEN || doorEnd(L, me, x)) return;
    const held = L.hold[lEnd(me, x)]; L.hold[lEnd(me, x)] = [];
    const byeOk = pathOk(me, x) && !(L.half & (1 << lEnd(me, x))) && !L.stuck; const hAt0 = L.halfAt >= 0 ? L.halfAt : TICK(); const stuck0 = L.stuck;
    L.state = LK_CLOSED; L.epoch = U32(L.epoch + 1); L.q.length = 0; L.half = 0; L.halfAt = -1; L.nnAt[0] = L.nnAt[1] = -1; L.view[lEnd(me, x)] = LK_CLOSED; L.callClosed = byeOk; L.gone |= (1 << lEnd(me, x)); L.agreed[lEnd(me, x)] = false; L.closingAt[lEnd(me, x)] = -1; L.hold[lEnd(me, x)] = []; lv.L22_CLOSED++;
    trace('L22-CLOSE', me, null, 'peer=%d', x);
    const at = Math.max(TICK() + ldraw(K.LINK_DC_MIN, K.LINK_DC_MAX, x, me, 0x6463), L.arrAt[lEnd(x, me)] + 1);
    if (byeOk) downAt(at, x, me, L.epoch, 'unneeded'); else if (stuck0) downAt(Math.max(TICK(), hAt0 + K.LINK_DISC_DEAD), x, me, L.epoch, 'disconnected-persist'); else downAt(Math.max(TICK(), hAt0 + K.LINK_ICE_FAIL) + K.LINK_FAILED_PERSIST, x, me, L.epoch, 'failed-persist');
    if (held.length && me < nextId() && alive[me] && x < nextId() && alive[x]) {
      L.callClosed = false; startDial(me, x, L); L.dialT = mtIdx(held[0].t); for (const f of held) if (L.q.length < K.LINK_QCAP) L.q.push(f); trace('L22-REDIAL', me, null, 'peer=%d held=%zu why=L33.4', x, held.length);
    }
  };

  // ---- L23: no peer can make me keep a pc -----------------------------------------------------------------------
  // C++: mesh_link.inc:l23Strike
  const l23Strike = (me, x) => {
    const k = ins(L23S, idPair(me, x), () => ({ until: -1, last: -1, n: 0 }));
    if (k.last >= 0 && TICK() - k.last > 4 * K.L23_COOL_MAX) k.n = 0; k.n++; k.last = TICK(); const sh = Math.min(k.n - 1, 10); k.until = TICK() + Math.min(K.L23_COOL0 * Math.pow(2, sh), K.L23_COOL_MAX);
  };
  // C++: mesh_link.inc:l23Pend
  const l23Pend = (me, add) => {
    if (lv.L23PENDT !== TICK()) { lv.L23PENDT = TICK(); L23PEND.fill(0); }
    while (me >= L23PEND.length) L23PEND.push(0);
    if (add) L23PEND[me]++; return L23PEND[me];
  };
  // C++: mesh_link.inc:l23Full
  const l23Full = api.l23Full = (me) => {
    lEnsure(me); let n = l23Pend(me, false);
    for (const p of LINKPEERS[me]) { const L = linkFind(me, p); if (L && (L.state === LK_OPEN || L.state === LK_DIALING)) n++; }
    return n >= pcBudget(me, PB_CLASS);
  };
  // C++: mesh_link.inc:l23GreetSlot
  const l23GreetSlot = api.l23GreetSlot = (me, from, ck) => {
    const key = hash.hmix64(hash.hmixId(hash.H_INIT, me), ck); const it = L23GREET.get(key);
    if (it === undefined || TICK() - it[1] > K.L23_WORD_ || it[0] === from) { if (L23GREET.size > 100000) L23GREET.clear(); L23GREET.set(key, [from, TICK()]); return true; }
    return false;
  };
  // C++: mesh.cpp:l23RealRole
  const l23RealRole = api.l23RealRole = (me, x) => {
    const s = seats[me]; if (!s.hasCoord) return false; if (s.linkRole(x, E.LR_E2 | E.LR_L4 | E.LR_UP)) return true;
    const ol = ownedLinks(s.coord); for (let k = 0; k < ol.length; k++) { const ck = ckey(ol[k]); if (s.occGet(ck) !== x) continue; if (!s.bareAt.has(ck)) return true; } return false;
  };
  // C++: mesh_link.inc:fabricL23Busy
  const fabricL23Busy = (me, x) => me >= 0 && me < nextId() && seats[me].hasCoord && seats[me].state === 3 && l23Full(me) && !l23RealRole(me, x);
  // C++: mesh_link.inc:l23Suspect
  const l23Suspect = api.l23Suspect = (me, x) => {
    if (me < 0 || me >= nextId() || x < 0 || x >= nextId()) return false;
    const it = L23S.get(idPair(me, x)); if (it !== undefined && it.n >= 2 && TICK() - it.last <= 4 * K.L23_COOL_MAX) return true;
    const s = seats[me]; if (l23RealRole(me, x)) return false;
    if (l18Role(me, x)) { for (const [bk, bt] of s.bareAt) if (s.occGet(bk) === x && s.TICK - bt >= 2 * K.L23_WORD_) return true; }
    { const wk = s.l23Work.get(x); if (wk !== undefined && wk[0] >= K.L23_WORK && s.TICK - wk[1] <= 40) return true; }
    if (s.callBook.inOverlong(x, s.TICK)) return true;
    const wd = s.l23WordAt.get(x); return wd !== undefined && s.TICK - wd >= K.L23_WORD_ && s.TICK - wd < 8 * K.L23_WORD_;
  };
  // l23Refused: one copy, the laws' (js/mesh/pclaws.js, plugged over this file's names by pclaws-fab.js). The link
  // physics' own dial paths reach it through fab.X so both see one decision.
  const l23Refused = api.l23Refused = (me, from, mt = null, ck = 0) => X.l23Refused(me, from, mt, ck);
  // C++: mesh_link.inc:l23CloseAlone
  const l23CloseAlone = (me, x, strike = true) => {
    const L = linkFind(me, x); if (!L || L.state !== LK_OPEN) return; l22Close(me, x); lv.L23_CLOSED++; if (strike) l23Strike(me, x); trace('L23-CLOSE', me, null, 'peer=%d strike=%d', x, strike ? 1 : 0);
  };

  // C++: mesh_link.inc:l22Tick
  const aloneIdle = new Set();
  const l22Tick = api.l22Tick = () => {
    for (const [kfirst, L] of LINKS) {
      for (let e = 0; e < 2; e++) {
        if (!L.agreed[e] || L.closingAt[e] < 0 || TICK() - L.closingAt[e] <= K.L22_CLOSE_WAIT) continue;
        const me = e === 0 ? pkA(kfirst) : pkB(kfirst), x = e === 0 ? pkB(kfirst) : pkA(kfirst);
        const q = L.hold[e]; L.hold[e] = []; L.agreed[e] = false; L.closingAt[e] = -1; trace('L22-CLOSE-TIMEOUT', me, null, 'peer=%d held=%zu', x, q.length);
        if (L.state === LK_OPEN) l22Close(me, x);
        if (q.length && L.state === LK_CLOSED && me < nextId() && alive[me] && x < nextId() && alive[x]) {
          L.callClosed = false; startDial(me, x, L); L.dialT = mtIdx(q[0].t); for (const f of q) if (L.q.length < K.LINK_QCAP) L.q.push(f); trace('L22-REDIAL', me, null, 'peer=%d held=%zu why=timeout', x, q.length);
        }
      }
    }
    const ask = [], close2 = [], alone = [], full = []; aloneIdle.clear();
    for (const [kfirst, L] of LINKS) {
      if ((L.state !== LK_OPEN && L.state !== LK_DIALING) || L.half) continue;
      const a = pkA(kfirst), b = pkB(kfirst);
      for (let e = 0; e < 2; e++) {
        const me = e === 0 ? a : b, x = e === 0 ? b : a; const d = lEnd(me, x);
        if (L.outside && me < nextId() && alive[me] && doorEnd(L, me, x)) { L.nnAt[d] = -1; continue; }
        if (me >= nextId() || !alive[me] || isFrozen(me) || X.l22Need(me, x) || (seats[me].hostile & E.H_HOLDS_)) { L.nnAt[d] = -1; continue; }
        if (L.nnAt[d] < 0) { L.nnAt[d] = TICK(); continue; }
        if (L.state === LK_OPEN && TICK() - L.nnAt[d] >= K.L23_BOUND && (TICK() - Math.max(L.txAt[lEnd(x, me)], L.nnAt[d]) >= K.L23_BOUND || l23Suspect(me, x) || TICK() - L.nnAt[d] >= K.L23_LONG)) {
          if (TICK() - Math.max(L.txAt[lEnd(x, me)], L.nnAt[d]) >= K.L23_BOUND) aloneIdle.add(idPair(me, x)); alone.push([me, x]); continue;
        }
        if (L.state === LK_OPEN && TICK() - L.nnAt[d] >= K.L22_SETTLE && TICK() - L.farAsk[d] <= K.L222_FRESH && !L.half && !l221Sent(L, me, x)) { L.farAsk[d] = -1000000; L.nnAsk[d] = TICK(); close2.push([me, x]); continue; }
        if (L.state === LK_OPEN && TICK() - L.nnAt[d] >= K.L22_SETTLE && TICK() - L.nnAsk[d] >= K.L22_ASK && !l221Sent(L, me, x)) { L.nnAsk[d] = TICK(); ask.push([me, x]); }
      }
    }
    close2.sort(cmpPair); for (const p of close2) { trace('L22.2-CLOSE', p[0], null, 'peer=%d', p[1]); l22CloseAsk(p[0], p[1]); }
    ask.sort(cmpPair);
    for (const p of ask) { const m = msg.newMsg('UNNEEDED'); m.id = p[0]; trace('L22-ASK', p[0], null, 'peer=%d', p[1]); fab.schedL10(p[0], p[1], m, 'L22SEQ'); }
    {
      alone.sort(cmpPair);
      for (const p of alone) {
        const L = linkFind(p[0], p[1]); const ee = lEnd(p[0], p[1]);
        const asked = !!L && L.nnAsk[ee] >= 0 && L.nnAsk[ee] - L.nnAt[ee] >= K.L22_ASK && aloneIdle.has(idPair(p[0], p[1]));
        l23CloseAlone(p[0], p[1], asked);
      }
      full.sort(cmpPair); for (const p of full) l23CloseAlone(p[0], p[1], false);
    }
  };

  // C++: mesh_link.inc:linkTick
  // The start of every tick under linkmodel 1: leavers' links close, due timers and events apply, the starve watchdog.
  const linkTick = api.linkTick = () => {
    if (LPENDCLOSE.length) { const v = LPENDCLOSE; LPENDCLOSE = api.LPENDCLOSE = []; for (const id of v) linkCloseAll(id, false, 'leave-close'); }
    if (DOOR_PEND.length) {
      const keep = [];
      for (const pr of DOOR_PEND) {
        const a = pr.a, b = pr.b; if (a >= nextId() || b >= nextId() || !alive[a] || !alive[b]) continue; const L = linkGet(a, b); if (L.state === LK_DIALING || L.state === LK_OPEN) continue;
        if (L.q.length === 0) continue; if (TICK() - pr.at > 8) { lv.L16_PENDDROP++; L.q.length = 0; continue; }
        if ((a < DOORN.length && DOORN[a] >= pcBudget(a, PB_DOORS)) || l1610Full(a)) { keep.push(pr); continue; }
        if (l16Mobile(a) && !l16MobBudget(a)) { keep.push(pr); continue; } startDial(a, b, L); L.dialT = mtIdx(L.q[0].t); L.dialHow = 3; LTX[a] = TICK();
      }
      DOOR_PEND = api.DOOR_PEND = keep;
    }
    if (LDOORS.size) l15Doors();
    l16Doors();
    l22Tick();
    while (LEVQ.size && firstTick(LEVQ) <= TICK()) {
      const f = firstTick(LEVQ); const evs = LEVQ.get(f); LEVQ.delete(f);
      for (const v of evs) linkApply(v);
    }
    const n = Math.min(nextId(), LINKPEERS.length);
    for (let id = 0; id < n; id++) {
      if (!alive[id] || LINKPEERS[id].length === 0 || !seats[id].hasCoord || isFrozen(id)) continue;
      if (LRX[id] < 0 || TICK() - LRX[id] < K.LINK_STARVE || LTX[id] <= LRX[id]) continue;
      let any = false; const ps = LINKPEERS[id].slice();
      for (const p of ps) { const L = linkFind(id, p); if (L && L.state === LK_OPEN && !L.carried) { any = true; closeFrom(L, id, p, 'starve-dead'); } }
      if (any) LSTAT[6]++;
      LRX[id] = TICK();
    }
    if (LEVQ.size && firstTick(LEVQ) <= TICK()) {
      const f = firstTick(LEVQ); const evs = LEVQ.get(f); LEVQ.delete(f);
      for (const v of evs) linkApply(v);
    }
  };
  // C++: mesh_link.inc:linkReset
  const linkReset = api.linkReset = () => {
    LINKS.clear(); LINKPEERS.length = 0; LEVQ.clear(); LBLOCK.clear(); RADIO.clear(); LRX.length = 0; LTX.length = 0; TLDEB.clear(); LPENDCLOSE = api.LPENDCLOSE = []; LDOORS.clear();
    lv.L15_CLOSED = 0; lv.CLOSEDROPS = 0; lv.ERASEDROPS = 0; DOORN = api.DOORN = []; DOORK = api.DOORK = []; L16CLOSING = api.L16CLOSING = []; L16COOL.clear();
    lv.L16_HANDED = lv.L16_DROP = lv.L16_UNN = lv.L16_BUSY = lv.L16_BYE = lv.L16_IDLEC = lv.L16_LIFEC = lv.L16_GWC = lv.L16_BACKOFF = lv.L16_DOORPEAK = lv.L16_ANSPEAK = lv.L16_EVILPEAK = 0;
    LSTAT.fill(0);
  };

  // ---- the calls a seat makes -----------------------------------------------------------------------------------
  // C++: mesh_link.inc:fabricLinkState
  const fabricLinkState = (me, x) => {
    if (!lv.LINKMODEL) return LS_OPEN;
    if (me < 0 || x < 0 || me === x) return LS_NONE;
    const L = linkFind(me, x); if (!L) return LS_NONE;
    if (L.gone & (1 << lEnd(me, x))) return LS_NONE;
    return L.view[lEnd(me, x)];
  };
  // C++: mesh_link.inc:fabricDialFails
  const fabricDialFails = (me, x) => (me >= 0 && me < nextId()) ? seats[me].dials.fails(x) : 0;
  // C++: mesh_link.inc:fabricDoorFrom
  api.fabricDoorFrom = (me, x) => { const L = linkFind(me, x); return !lv.LINKMODEL || !L || !!L.outside; };
  // C++: mesh_link.inc:l23MakeRoom
  const l23MakeRoom = (me, x) => {
    if (me < 0 || me >= nextId() || !alive[me] || !seats[me].hasCoord || seats[me].state !== 3 || !l23Full(me)) return;
    const L0 = linkFind(me, x); if (L0 && (L0.state === LK_OPEN || L0.state === LK_DIALING)) return;
    lEnsure(me); let best = -1, bt = 0;
    for (const p of LINKPEERS[me]) { const L = linkFind(me, p); if (!L || L.state !== LK_OPEN || L.outside) continue; const t = L.nnAt[lEnd(me, p)]; if (t < 0 || X.l22Need(me, p)) continue; if (best < 0 || t < bt) { best = p; bt = t; } }
    if (best >= 0) l23CloseAlone(me, best, false);
  };
  // C++: mesh_link.inc:fabricCallFrame
  const fabricCallFrame = (me, to, m) => {
    if (!lv.LINKMODEL || me < 0 || to < 0 || me === to || to >= nextId() || !alive[to] || !X.grpReach(me, to)) return;
    noteCall(me, to); linkSchedule(me, to, m);
  };
  // C++: mesh_link.inc:fabricDial
  const fabricDial = (me, x) => {
    if (!lv.LINKMODEL || me < 0 || x < 0 || me === x || x >= nextId()) return;
    if (dialHeld(me, x)) return;
    if (l18NoDial(me, x)) return;
    noteCall(me, x);
    if (l23Refused(x, me)) return;
    l23MakeRoom(me, x);
    const L = linkGet(me, x); if (L.state === LK_NONE || L.state === LK_CLOSED) { startDial(me, x, L); L.dialHow = 1; }
  };
  // C++: mesh_link.inc:fabricDialJoin
  const fabricDialJoin = (me, x) => {
    if (!lv.LINKMODEL || me < 0 || x < 0 || me === x || x >= nextId()) return;
    if (l18NoDial(me, x)) return;
    if (dialHeld(me, x)) return;
    noteCall(me, x);
    if (l23Refused(x, me)) return;
    l23MakeRoom(me, x);
    const L = linkGet(me, x); if (L.state === LK_NONE || L.state === LK_CLOSED) { startDial(me, x, L); L.dialHow = 2; } else if (L.state === LK_DIALING) L.view[lEnd(me, x)] = LK_DIALING;
  };
  // C++: mesh_link.inc:linkHeld
  const linkHeld = (x) => {
    lEnsure(x); let n = 0;
    for (const p of LINKPEERS[x]) { const L = linkFind(x, p); if (!L) continue; if (L.state === LK_OPEN && !(L.half & (1 << lEnd(p, x)))) n++; else if (L.state === LK_DIALING && L.uplink) n++; }
    return n;
  };
  // C++: mesh_link.inc:fabricDialUplink
  // `refer` is kept for the callers' signature (the C++ ignores it too). Returns the C++ bool.
  const fabricDialUplink = (me, x, refer) => {
    if (!lv.LINKMODEL || me < 0 || x < 0 || me === x || x >= nextId()) return false;
    void refer; const L0 = linkFind(me, x); const had = !!L0 && (L0.state === LK_OPEN || L0.state === LK_DIALING);
    fabricDialJoin(me, x); const L = linkFind(me, x); if (L && L.state === LK_DIALING) L.uplink = true;
    if (L && (L.state === LK_OPEN || L.state === LK_DIALING)) { const o = msg.newMsg('UPOFFER'); o.id = me; o.tag = had ? 1 : 0; o.to = x; o.from = -1; o.lk = -1; fab.wireTx(o, me); fab.busPush(TICK() + 1, o); }
    return true;
  };
  // C++: mesh_link.inc:fabricUpTake
  const fabricUpTake = (x, h) => {
    if (!lv.LINKMODEL || x < 0 || h < 0 || x >= nextId() || h >= nextId()) return 0;
    const sx = seats[x];
    if (sx.hasCoord && sx.state === 3 && sx.coord.pc !== 0 && sx.l14Branch() && !(sx.l14Up >= 0 && fabricLinkState(x, sx.l14Up) === LS_OPEN)) { trace('L14-REFUSE', x, null, 'from=%d cut=1', h); return 1; }
    if (linkHeld(x) > pcBudget(x, PB_CLASS)) { lv.L14_REFUSED++; trace('L14-REFUSE', x, null, 'from=%d held=%d budget=%d', h, linkHeld(x), pcBudget(x, PB_CLASS)); return 2; }
    return 0;
  };
  // C++: mesh_link.inc:fabricUpDecline
  const fabricUpDecline = (x, h, refer) => {
    if (!lv.LINKMODEL || x < 0 || h < 0 || x >= nextId() || h >= nextId()) return;
    const L = linkFind(x, h); if (L && L.state === LK_DIALING) closeBoth(L, x, h, false, 'declined');
    const d = msg.newMsg('BUSY'); d.tag = 14; d.id = x; d.from = x; d.to = h; d.lk = -1; d.list = refer.slice(); fab.wireTx(d, x); fab.busPush(TICK() + 1, d);
  };

  // ---- the `link ...` / `radio` / `sever` / dark levers (state change only: no printf) -------------------------------
  const atoi = (t) => { const n = parseInt(t, 10); return Number.isNaN(n) ? 0 : n; };
  api.atoi = atoi;
  // C++: mesh_link.inc:linkLever
  // tk: the lever's words ("link", a, b, op, ...). Words that only print (stat, peers, show) do nothing.
  api.linkLever = (tk) => {
    const sub = tk.length > 1 ? tk[1] : '';
    if (sub === 'mobile') { lv.LMOBILE = tk.length > 2 ? parseFloat(tk[2]) : 0; return; }
    if (sub === 'stat' || sub === 'peers') return;
    const a = tk.length > 1 ? atoi(tk[1]) : -1, b = tk.length > 2 ? atoi(tk[2]) : -1; const op = tk.length > 3 ? tk[3] : 'show';
    if (!lv.LINKMODEL) return;
    if (a < 0 || b < 0 || a === b || a >= nextId() || b >= nextId()) return;
    const Lp = linkFind(a, b);
    if (op === 'show') return;
    if (!Lp || Lp.state !== LK_OPEN) { if (op !== 'open') return; }
    const L = linkGet(a, b);
    if (op === 'half') {
      let mask = 3, fail = false;
      for (let z = 4; z < tk.length; z++) { if (tk[z] === 'stuck') continue; else if (tk[z] === 'fail') fail = true; else { const s = atoi(tk[z]); if (s === a) mask = (1 << lEnd(a, b)); else if (s === b) mask = (1 << lEnd(b, a)); } }
      L.leverHalf = true; linkHalf(L, a, b, mask, fail);
    }
    else if (op === 'close') { const fail = tk.length > 4 && tk[4] === 'fail'; closeBoth(L, a, b, fail, fail ? 'failed-persist' : 'dc-close'); }
    else if (op === 'open') { L.epoch = U32(L.epoch + 1); L.leverHalf = false; LBLOCK.delete(pairKey(a, b)); linkOpenNow(L, a, b); }
  };
  // C++: mesh_link.inc:radioLever
  api.radioLever = (tk) => {
    const id = tk.length > 1 ? atoi(tk[1]) : -1; const t = tk.length > 2 ? atoi(tk[2]) : 40;
    if (!lv.LINKMODEL) return;
    if (id < 0 || id >= nextId() || !alive[id] || t <= 0) return;
    RADIO.set(id, TICK() + t); levPush(TICK() + t, EV_RADIOEND, id, -1, 0, 'radio');
    lEnsure(id); for (const p of LINKPEERS[id]) { const L = linkFind(id, p); if (L && L.state === LK_OPEN) linkHalf(L, id, p, 3, false); }
  };
  // C++: mesh_link.inc:linkSever
  api.linkSever = (a, b, t) => { LBLOCK.set(pairKey(a, b), TICK() + t); const L = linkFind(a, b); if (L) closeBoth(L, a, b, false, 'sever'); };
  // C++: mesh_link.inc:linkDark
  api.linkDark = (id) => { linkCloseAll(id, false, 'dark'); };

  // ---- plug ---------------------------------------------------------------------------------------------------------
  fab.link = api;
  fab.plug({
    linkTick, linkSchedule, linkOpenFor, linkFind, closeFrom, linkBlackhole, linkOnLeave, crashTransport, linkReset, closedDrop,
    fabricLinkState, fabricDial, fabricDialJoin, fabricDialUplink, fabricDialFails, fabricUpTake, fabricUpDecline, fabricDoorDrop,
    fabricDoorHanded, fabricMyDoors, fabricMyKnocks, fabricNoSock, fabricL23Busy, fabricCallFrame,
    l22Quiet, l22Close, l22CloseAsk, l22Agree, l222Note,
    // for the friend-hop unit (fhop.js reads these names from fab.X)
    linkPeers: (id) => (id >= 0 && id < LINKPEERS.length) ? LINKPEERS[id] : [], linkGet, lEnsure, linkTx: (id) => { LTX[id] = TICK(); }, startDial,
    l16Refuse: (from, to, mt) => l16Refuse(from, to, mt),
    fabricDoors: () => lv.LINKMODEL, fabricNoteBackoff: () => { lv.L16_BACKOFF++; },
  });
  return api;
}

module.exports = { install };
