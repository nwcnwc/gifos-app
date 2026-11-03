/*
 * pclaws.js: the pc-lifecycle laws (port plan S11, FABRIC-LAW), ported line for line from the 0.9.25 sim:
 * mesh_link.inc (the pc budget, the door state machine, L14 uplink offers, L16 door caps, L22 close, L23), mesh_linkset_fab.inc
 * (linkWhy / l22Need / l28Reply), mesh_rcfollow_fab.inc (L16.11, L22.3 / L22.4) and mesh.cpp's L18 rungs
 * (l22Beside, l18Role, l18Cell, l18Hop, l18Route, l18Deliv).
 *
 * THE PC WORLD. In C++ these are free functions that read the fabric's tables (seats, alive, LINKS, the bus). Here
 * createPcLaws(P) binds them to a pc world P and returns the functions, so the harness installs them with
 * fab.plug(pc.fns) and the page adapter calls the same code on its own world:
 *   P.w          the seat world (w.TICK)             P.lv    the sim's globals (consts.js levers)
 *   P.seats, P.alive, P.isFrozen(id)                 P.trace(ev, seat, cell, fmt, ...args)
 *   P.busPush(due, m), P.schedL10(from, to, m, seqName), P.wireTx(m, from), P.grpReach(a, b), P.relayMeter(id, n)
 *   P.LINKS (Map pairKey -> Link), P.LINKPEERS (array id -> [peer ids]), P.pairKey(a, b)
 *   P.phys       the link physics the laws call: linkFind linkGet lEnsure lEnd startDial linkDeliver linkSchedule closeBoth
 *                closeFrom downAt pathOk ldraw (harness/link.js supplies them, and the law tables P.S)
 *   P.fhopActive(), P.FH, P.fhopFriendFor(me, to)    friend-hop (H4), read only
 *
 * PER-END HALVES. Each function is marked [end] when it decides from one end's own state (its seat, its end of the Link:
 * view[], nnAt[], agreed[], farAsk[], dHeard, the frames it received) and so is what the page runs on its own pc, or
 * [fabric] when the C++ reads both ends at once (the door sweeps l15Doors / l16Doors, l22Tick's walk of every Link, the
 * tick's counters, the offer's far-page decision reading the offerer's pcs). The fabric halves are the sim's physics
 * of who sees what; the page replaces each with the same decision per pc, from its own end.
 *
 * OUT-PARAMETERS follow seat.js: l1610Held -> {n, topo}; l18Cell -> Coord|null; the C++ vector<int>* refer of
 * fabricDialUplink is left as the caller's (the sim does not touch it: `(void)refer`).
 * LDOORS is a std::set in the sim (ascending key order): walked here in ascending order.
 * Every function names its C++.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  if (isNode) require('./laws.js');
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const hash = req('./hash.js', 'meshHash');
  const seatM = req('./seat.js', 'meshSeat');
  const { ins } = req('./util.js', 'meshUtil');
  const { cellOk } = req('./shared.js', 'meshShared');

  const K = C_.consts, E = C_.enums;
  const C = topo.C;
  const { ckey, ownedLinks, parentPath } = topo;
  const { LK_NONE, LK_DIALING, LK_OPEN, LK_CLOSED, LS_NONE, LS_DIALING, LS_OPEN } = E;
  const MT_INDEX = new Map(msg.MT_NAMES.map((n, i) => [n, i]));
  const LINK_QCAP = 64;            // C++: mesh_link.inc:LINK_QCAP
  const LINK_DC_MIN = 0, LINK_DC_MAX = 1, LINK_DISC_DEAD = 196, LINK_ICE_FAIL = 60, LINK_FAILED_PERSIST = 18, LINK_ASK_GAP = 8;
  const L14_PC_ALLOW = 4;          // C++: mesh_link.inc:L14_PC_ALLOW
  const idPair = hash.idPair;

  // C++: mesh.cpp:Link  (the struct, with its defaults; mesh_link.inc and the physics fill it)
  function newLink() {
    return {
      state: LK_NONE, view: [LK_NONE, LK_NONE], half: 0, stuck: false, leverHalf: false, wasOpen: false, carried: false,
      epoch: 0, openEp: 0, dialAt: -1, halfAt: -1, askAt: -1000000, txAt: [-1, -1], nnAt: [-1, -1], nnAsk: [-1000000, -1000000],
      arrAt: [-1, -1], q: [], outside: 0, dialBy: -1, dialT: -3, dialHow: 0, callClosed: false, gone: 0,
      agreed: [false, false], hold: [[], []], closingAt: [-1, -1], farAsk: [-1000000, -1000000], uplink: false, dHeard: 0,
      backAt: [-1, -1], dBorn: -1, dProg: -1, dAsked: false, dHomed: false, dGw: false, dIn: false, dSat: false, dHoAt: -1, dWait: -1,
      dOwed: false, dWaitAtFind: -1, dOwedAt: -1,
    };
  }

  const lEnd = (me, x) => (me < x ? 0 : 1);   // C++: mesh_link.inc:lEnd

  function createPcLaws(P) {
    const lv = P.lv, w = P.w, seats = P.seats, alive = P.alive;
    const T = () => w.TICK;
    const trace = (...a) => P.trace(...a);
    const ph = () => P.phys;
    const linkFind = (a, b) => P.phys.linkFind(a, b);
    const lEnsure = (id) => P.phys.lEnsure(id);
    const mtI = (t) => MT_INDEX.get(t);

    // The law tables (C++ statics of mesh_link.inc): the fabric's heap, not a seat's.
    // P.S, when the physics holds them (harness/link.js does), is the one set of tables: the missing ones are made here.
    const S = P.S || {};
    for (const [n, mk] of [['DOORN', () => []], ['DOORK', () => []], ['L16CLOSING', () => []], ['L16COOL', () => new Map()], ['DOOR_PEND', () => []], ['MOBOPEN', () => new Map()],
      ['LDOORS', () => new Set()], ['L23S', () => new Map()], ['L23PEND', () => []], ['L23GREET', () => new Map()], ['L18_HH', () => new Array(9).fill(0)]]) if (!(n in S)) S[n] = mk();
    const fns = {};
    const ldoorsAsc = () => [...S.LDOORS].sort(hash.pairCmp);   // C++ set<IdP>: by a, then b
    const pkA = hash.pairA, pkB = hash.pairB;   // C++ pk.a, pk.b

    // ===================================================================================================================
    // THE PC BUDGET TABLE
    // C++: mesh_link.inc:l16MobBudget
    function l16MobBudget(x) {
      if (lv.L16_MOB_RATE <= 0) return true;
      const e = ins(S.MOBOPEN, x, () => [0, 0]);
      if (e[0] !== T()) { e[0] = T(); e[1] = 0; }
      if (e[1] >= lv.L16_MOB_RATE) return false;
      e[1]++; return true;
    }
    // C++: mesh_link.inc:l16Mobile
    const l16Mobile = (x) => x >= 0 && x < lv.nextId && !!seats[x] && seats[x].ctier === E.TIER_MOBILE;
    // C++: mesh_link.inc:l16CapOf
    const l16CapOf = (x) => (l16Mobile(x) ? lv.DOORCAP_MOBILE : lv.DOORCAP);
    // C++: mesh_link.inc:l16ReserveOf
    const l16ReserveOf = (x) => (l16Mobile(x) ? lv.L16_RESERVE_MOBILE : lv.L16_RESERVE);
    // C++: mesh_link.inc:pcBudget   [end]
    function pcBudget(x, cls) {
      switch (cls) {
        case E.PB_DOORS: return l16CapOf(x);
        case E.PB_KNOCKS: return l16CapOf(x) - l16ReserveOf(x);
        case E.PB_S1: return 2 * C - 1 + l16CapOf(x);
        case E.PB_CLASS: return l14Budget(x);
      }
      return 0;
    }
    // C++: mesh_link.inc:l14Budget   [end]
    function l14Budget(x) { const s = seats[x]; const bound = (s.hasCoord && s.state === 3) ? (s.coord.pc === 0 ? 2 * C - 1 : C + 1) : C * C; return bound + L14_PC_ALLOW - 1; }

    // ===================================================================================================================
    // CALLS AND DIALS
    // C++: mesh_link.inc:noteCall   [end]
    function noteCall(me, x) {
      if (me < 0 || me >= lv.nextId || x < 0 || x >= lv.nextId || me === x || !alive[me]) return;
      const s = seats[me]; if (!s.hasCoord || s.state !== 3 || l18Role(me, x)) return;
      s.callBook.noteOut(x, s.TICK);
    }
    // C++: mesh_link.inc:l18NoDial   [end]
    function l18NoDial(me, x) { if (!l18Route(me, x)) return false; lv.L18_NODIAL++; return true; }
    // C++: mesh_link.inc:dialHeld   [end]
    function dialHeld(a, b) {
      if (a < 0 || a >= lv.nextId) return false;
      const s = seats[a]; const g = s.dials.goneAt(b); if (g < 0) return false;
      { const rm = s.relMark.get(b); if (rm !== undefined && s.TICK - rm <= K.LEASE_T) return false; }
      return T() >= g;
    }

    // C++: mesh_link.inc:l1610Held   [end]
    function l1610Held(x) {
      lEnsure(x); let n = 0, tp = 0;
      for (const p of P.LINKPEERS[x]) {
        const L = linkFind(x, p); if (!L) continue;
        if (L.state === LK_OPEN || L.state === LK_DIALING || L.view[lEnd(x, p)] === LK_OPEN) { n++; if (!L.outside && l15NamesX(x, p)) tp++; }
      }
      return { n, topo: tp };
    }
    // C++: mesh_link.inc:l1610Full   [end]
    function l1610Full(x) {
      if (x < 0 || x >= lv.nextId) return false;
      const v = seats[x]; if (!(v.hasCoord && v.state === 3)) return false;
      if (v.coord.pc !== 0) return false;
      const h = l1610Held(x);
      return h.n - h.topo + Math.max(h.topo, 2 * C - 1) + 1 > pcBudget(x, E.PB_S1);
    }
    // C++: mesh_link.inc:l16Refuse   [end: the greeter's own count; the sender's side reads only its own seat]
    // mt is the frame's type name (the C++ int MT).
    function l16Refuse(from, to, mt) {
      const sf = seats[from], st = seats[to];
      if (sf.hasCoord && sf.state === 3) {
        if (st.hasCoord && st.state === 3) return false;
        if (l15Names(from, to)) return false;
        if (mt === 'HOME') { lv.L16_DROP++; trace('L16-DROP', from, null, 'to=%d mt=%d why=home', to, mtI(mt)); return true; }
        if (from < S.DOORN.length && S.DOORN[from] >= pcBudget(from, E.PB_DOORS)) { lv.L16_DEFER = true; lv.L16_DEFERRED++; return true; }
        if (l1610Full(from)) { lv.L16_DEFER = true; lv.L16_DEFERRED++; return true; }
        if (l16Mobile(from) && !l16MobBudget(from)) { lv.L16_DEFER = true; lv.L16_DEFERRED++; return true; }
        return false;
      }
      let full;
      if (!(st.hasCoord && st.state === 3)) { if (mt !== 'WHOHOME' && mt !== 'FIND') return false; full = true; }
      else full = (to < S.DOORK.length && S.DOORK[to] >= pcBudget(to, E.PB_KNOCKS));
      if (!full && l1610Full(to)) full = true;
      if (!full && l16Mobile(to) && st.hasCoord && st.state === 3 && !l16MobBudget(to)) full = true;
      if (!full) { const c = S.L16COOL.get(idPair(to, from)); if (c === undefined || c[0] <= T()) return false; }
      if (!alive[to] || P.isFrozen(to) || P.radioOff(to)) return true;
      if (lv.NETGRP) { P.relayMeter(from, 1); P.relayMeter(to, 1); }
      lv.L16_BUSY++; const b = msg.newMsg('BUSY'); b.id = to; b.from = to; b.to = from; b.lk = -1; P.busPush(T() + 2, b);
      return true;
    }

    // ===================================================================================================================
    // L15 / K5: THE DOOR STATE MACHINE, PER END
    // C++: mesh_link.inc:l15Names   [end]
    function l15Names(a, b) { return seats[a].linkRole(b, E.LR_OWNED | E.LR_E2); }   // (the row owner is no keep reason, L16.1)
    // C++: mesh_link.inc:l15Seated   [end]
    function l15Seated(id) {
      if (id >= lv.nextId || !alive[id]) return false; const s = seats[id]; if (!s.hasCoord || s.state !== 3) return false;
      if (s.seatedAt < 0 || s.TICK - s.seatedAt < lv.L15_SETTLE) return false;
      for (const c of ownedLinks(s.coord)) { const x = s.occGet(ckey(c)); if (x < 0 || x === id) continue; const L = linkFind(id, x); if (L && L.state === LK_OPEN && L.view[lEnd(id, x)] === LK_OPEN) return true; }
      const o = s.ownerCoord(); if (o) { const x = s.occGet(ckey(o)); if (x >= 0 && x !== id) { const L = linkFind(id, x); if (L && L.state === LK_OPEN && L.view[lEnd(id, x)] === LK_OPEN) return true; } }
      return false;
    }
    // C++: mesh_link.inc:l15NamedBy   [end]
    function l15NamedBy(me, x) {
      const s = seats[me]; if (!s.hasCoord) return false; const mk = ckey(s.coord);
      const ol = ownedLinks(s.coord).slice(); { const o = s.ownerCoord(); if (o) ol.push(o); }
      for (let k = 0; k < ol.length; k++) { if (s.occGet(ckey(ol[k])) !== x) continue; const xl = ownedLinks(ol[k]); for (let j = 0; j < xl.length; j++) if (ckey(xl[j]) === mk) return true; }
      return false;
    }
    // C++: mesh_link.inc:doorHeard   [end]
    const doorHeard = (L, me, x) => (L.dHeard & (1 << lEnd(me, x))) !== 0;
    // C++: mesh_link.inc:doorEnd   [end]
    function doorEnd(L, me, x) {
      if (!L.outside) return false;
      if ((L.outside & (1 << lEnd(me, x))) && !l15Seated(me)) return true;
      if ((L.outside & (1 << lEnd(x, me))) && !doorHeard(L, me, x)) return true;
      return false;
    }
    // C++: mesh_link.inc:fabricDoorHeard   [end]
    function fabricDoorHeard(me, x, ep) { if (!lv.LINKMODEL || x < 0 || x >= lv.nextId || me === x) return; const L = linkFind(me, x); if (L && L.outside && L.epoch === ep) L.dHeard |= (1 << lEnd(me, x)); }
    // C++: mesh_link.inc:l15Doors   [fabric]
    function l15Doors() {
      for (const pk of ldoorsAsc()) {
        const a = pkA(pk), b = pkB(pk); const L = linkFind(a, b);
        if (!L || !L.outside || L.state === LK_CLOSED || L.state === LK_NONE) { S.LDOORS.delete(pk); continue; }
        if (L.state !== LK_OPEN || L.half) continue;
        let k = -1;
        for (const x of [a, b]) {
          const y = x === a ? b : a; if (!(L.outside & (1 << lEnd(x, y)))) continue;
          if (x >= lv.nextId || !alive[x] || !l15Seated(x)) continue;
          if ((L.outside & (1 << lEnd(y, x))) && !doorHeard(L, x, y)) continue;
          if (l15Names(x, y) || l15NamedBy(x, y)) continue;
          if (L.backAt[lEnd(x, y)] >= 0 && T() - L.backAt[lEnd(x, y)] < K.L15_BACK_HOLD) continue;
          k = x; break;
        }
        if (k < 0) continue;
        const g = k === a ? b : a; const kLive = !(L.half & (1 << lEnd(k, g))); const hAt = L.halfAt >= 0 ? L.halfAt : T(); const stuck = L.stuck;
        L.state = LK_CLOSED; L.epoch++; L.q = []; L.half = 0; L.halfAt = -1; L.outside = 0; L.view[lEnd(k, g)] = LK_CLOSED;
        trace('DOOR-CLOSE', k, null, 'peer=%d', g); S.L16CLOSING.push([pk, g]);
        if (kLive && ph().pathOk(k, g)) ph().downAt(Math.max(T() + ph().ldraw(LINK_DC_MIN, LINK_DC_MAX, g, k, 0x6463), L.arrAt[lEnd(g, k)] + 1), g, k, L.epoch, 'door-close');
        else if (stuck) ph().downAt(Math.max(T(), hAt + LINK_DISC_DEAD), g, k, L.epoch, 'disconnected-persist');
        else ph().downAt(Math.max(T(), hAt + LINK_ICE_FAIL) + LINK_FAILED_PERSIST, g, k, L.epoch, 'failed-persist');
        lv.L15_CLOSED++; S.LDOORS.delete(pk);
      }
    }
    // C++: mesh_link.inc:l16Close   [end: `by` drops its own end]
    function l16Close(L, by, x) {
      if (L.state === LK_DIALING) { L.state = LK_CLOSED; L.epoch++; L.q = []; for (let k = 0; k < 2; k++) if (L.view[k] === LK_DIALING) L.view[k] = LK_CLOSED; L.outside = 0; return; }
      if (L.state !== LK_OPEN) return;
      const bLive = !(L.half & (1 << lEnd(by, x))); const hAt = L.halfAt >= 0 ? L.halfAt : T(); const stuck = L.stuck;
      L.state = LK_CLOSED; L.epoch++; L.q = []; L.half = 0; L.halfAt = -1; L.outside = 0; L.view[lEnd(by, x)] = LK_CLOSED;
      if (bLive && ph().pathOk(by, x)) ph().downAt(Math.max(T() + ph().ldraw(LINK_DC_MIN, LINK_DC_MAX, x, by, 0x6463), L.arrAt[lEnd(x, by)] + 1), x, by, L.epoch, 'door-close');
      else if (stuck) ph().downAt(Math.max(T(), hAt + LINK_DISC_DEAD), x, by, L.epoch, 'disconnected-persist');
      else ph().downAt(Math.max(T(), hAt + LINK_ICE_FAIL) + LINK_FAILED_PERSIST, x, by, L.epoch, 'failed-persist');
    }
    // C++: mesh_link.inc:l15NamesX   (serial: the seat's own list)
    const l15NamesX = (a, b) => l15Names(a, b);
    // C++: mesh_link.inc:fabricDoorDrop   [end: the joiner drops a door it no longer needs]
    function fabricDoorDrop(me, x) {
      if (!lv.LINKMODEL || me < 0 || x < 0 || me === x || x >= lv.nextId) return;
      const L = linkFind(me, x); if (!L || !L.outside || L.dSat || !(L.outside & (1 << lEnd(me, x))) || (L.state !== LK_OPEN && L.state !== LK_DIALING)) return;
      lv.L16_BYE++; trace('DOOR-BYE', me, null, 'peer=%d', x); const wasOpen = L.state === LK_OPEN; l16Close(L, me, x); S.LDOORS.delete(P.pairKey(me, x)); if (wasOpen) S.L16CLOSING.push([P.pairKey(me, x), x]);
    }
    // C++: mesh_link.inc:fabricMyDoors   [end]
    const fabricMyDoors = (me) => (me >= 0 && me < S.DOORN.length) ? S.DOORN[me] : 0;
    // C++: mesh_link.inc:fabricMyKnocks   [end]
    const fabricMyKnocks = (me) => (me >= 0 && me < S.DOORK.length) ? S.DOORK[me] : 0;
    // C++: mesh_link.inc:fabricNoSock   [fabric: the relay's bounce]
    function fabricNoSock(me, g) {
      if (!lv.LINKMODEL || me < 0 || g < 0 || g >= lv.nextId || me >= lv.nextId) return;
      if (alive[g] && seats[g]) { if (seats[g].socketed()) return; }
      const m = msg.newMsg('BUSY'); m.nosock = true; m.id = g; m.to = me; m.from = -1; P.busPush(T() + 1, m);
    }
    // C++: mesh_link.inc:fabricDoorHanded   [end: the greeter's HANDOFF note]
    function fabricDoorHanded(me, x) {
      if (!lv.LINKMODEL || me < 0 || x < 0 || x >= lv.nextId) return;
      const L = linkFind(me, x);
      if (L && L.outside && (L.outside & (1 << lEnd(x, me))) && L.dHoAt < 0) { L.dHoAt = T(); if (L.dWaitAtFind >= 0 && L.dWait >= 0) { L.dOwed = true; L.dOwedAt = L.dWaitAtFind; } }
    }
    // C++: mesh_link.inc:l16Doors   [fabric: the greeter's limits and the recount]
    function l16Doors() {
      const n0 = lv.nextId;
      S.DOORN = new Array(n0).fill(0); S.DOORK = new Array(n0).fill(0); let evilMax = 0; let evilN = [];
      for (const pk of ldoorsAsc()) {
        const a = pkA(pk), b = pkB(pk); const L = linkFind(a, b);
        if (!L || !L.outside || L.outside === 3 || (L.state !== LK_OPEN && L.state !== LK_DIALING) || a >= lv.nextId || b >= lv.nextId) continue;
        const k = (L.outside & (1 << lEnd(a, b))) ? a : b, g = k === a ? b : a;
        if (alive[k] && seats[k].hasCoord && seats[k].state === 3) L.dSat = true;
        const heard = doorHeard(L, g, k);
        const named = l15Names(g, k) || l15NamedBy(g, k);
        if (!heard && !named && alive[g] && L.dBorn >= 0) {
          const idle = T() - L.dProg, age = T() - L.dBorn; let why = null;
          if (L.dHoAt >= 0 && T() - L.dHoAt >= K.L16_HO_CLOSE && !(L.dOwed && L.dWait >= 0)) why = 'handed';
          else if (L.dGw && !L.dIn) { if (idle > K.L16_GW_IDLE && !(L.dWait >= 0)) why = 'gw-idle'; else if (age > K.L16_GW_LIFE) why = 'gw-life'; }
          else if (L.dIn && L.state === LK_OPEN && !L.dAsked && L.dProg === L.dBorn) why = 'unnamed';
          else if (L.dIn && !L.dAsked && L.state === LK_OPEN && idle > K.L16_ANS_IDLE) why = 'idle';
          else if (idle > K.L16_IDLE) why = 'idle'; else if (age > K.L16_LIFE) why = 'life';
          if (why) {
            const c0 = why[0];
            if (c0 === 'h') lv.L16_HANDED++; else if (c0 === 'g') lv.L16_GWC++; else if (c0 === 'i') lv.L16_IDLEC++; else if (c0 === 'u') lv.L16_UNN++; else lv.L16_LIFEC++;
            trace('DOOR-LIMIT', g, null, 'peer=%d why=%s age=%lld idle=%lld', k, why, age, idle);
            l16Close(L, g, k);
            if (c0 !== 'u' && c0 !== 'h') { const c = ins(S.L16COOL, idPair(g, k), () => [0, 0]); c[1]++; c[0] = T() + K.L16_COOL * (1 << Math.min(c[1] - 1, 4)); }
            S.LDOORS.delete(pk); continue;
          }
        }
        if (!heard && !named) {
          S.DOORN[g]++; if (!L.dIn) S.DOORK[g]++; if (S.DOORN[g] > lv.L16_DOORPEAK) lv.L16_DOORPEAK = S.DOORN[g]; if (S.DOORN[g] - S.DOORK[g] > lv.L16_ANSPEAK) lv.L16_ANSPEAK = S.DOORN[g] - S.DOORK[g];
          if (k < lv.nextId && seats[k].evilDoor) { if (evilN.length < lv.nextId) evilN = new Array(lv.nextId).fill(0); if (++evilN[g] > evilMax) evilMax = evilN[g]; }
        }
      }
      {
        let wr = 0;
        for (let q = 0; q < S.L16CLOSING.length; q++) {
          const pk = S.L16CLOSING[q][0], g = S.L16CLOSING[q][1]; const a = pkA(pk), b = pkB(pk); const L = linkFind(a, b); const k = g === a ? b : a;
          if (!L || L.state !== LK_CLOSED || L.view[lEnd(g, k)] === LK_CLOSED || g >= lv.nextId || !alive[g]) continue;
          S.DOORN[g]++; if (!L.dIn) S.DOORK[g]++; if (S.DOORN[g] > lv.L16_DOORPEAK) lv.L16_DOORPEAK = S.DOORN[g]; S.L16CLOSING[wr++] = S.L16CLOSING[q];
        }
        S.L16CLOSING.length = wr;
      }
      if (evilMax > lv.L16_EVILPEAK) lv.L16_EVILPEAK = evilMax;
      if (S.L16COOL.size > 4096) { for (const [key, c] of S.L16COOL) if (c[0] + 16 * K.L16_COOL <= T()) S.L16COOL.delete(key); }
    }

    // ===================================================================================================================
    // L22 A PC WITH NO REASON CLOSES
    // C++: mesh_link.inc:l22Quiet   [end]
    function l22Quiet(me, x) { const L = linkFind(me, x); if (!L) return false; const t = L.nnAt[lEnd(me, x)]; return t >= 0 && T() - t >= K.L22_SETTLE; }
    // C++: mesh_link.inc:l221Sent   [end]
    const l221Sent = (L, me, x) => L.agreed[lEnd(me, x)];
    // C++: mesh_link.inc:l222Note   [end]
    function l222Note(me, x) { const L = linkFind(me, x); if (!L || L.state !== LK_OPEN || doorEnd(L, me, x)) return; L.farAsk[lEnd(me, x)] = T(); }
    // C++: mesh_link.inc:l22Agree   [end]
    function l22Agree(me, x) {
      const L = linkFind(me, x); if (!L || L.state !== LK_OPEN || doorEnd(L, me, x) || l221Sent(L, me, x)) return;
      const a = msg.newMsg('UNNEEDED'); a.id = me; a.tag = 1; P.schedL10(me, x, a, 'L22SEQ'); trace('L22-AGREE', me, null, 'peer=%d', x);
    }
    // C++: mesh_link.inc:l22CloseAsk   [end]
    function l22CloseAsk(me, x) {
      const L = linkFind(me, x); if (!L || L.state !== LK_OPEN || doorEnd(L, me, x) || l221Sent(L, me, x)) return;
      const a = msg.newMsg('UNNEEDED'); a.id = me; a.tag = 3; P.schedL10(me, x, a, 'L22SEQ'); L.agreed[lEnd(me, x)] = true; L.closingAt[lEnd(me, x)] = T(); trace('L22-CLOSING', me, null, 'peer=%d', x);
    }
    // C++: mesh_link.inc:l22Release   [end]
    function l22Release(me, x) {
      const L = linkFind(me, x); if (!L) return; const e = lEnd(me, x); if (!L.agreed[e]) return; L.agreed[e] = false;
      const q = L.hold[e]; L.hold[e] = [];
      for (const f of q) { const g = msg.clone(f); ph().linkDeliver(me, x, g, L); }
      trace('L22-RELEASE', me, null, 'peer=%d held=%zu', x, q.length);
    }
    // C++: mesh_link.inc:l22Close   [end: my end closes; the far end sees the close after my last frames]
    function l22Close(me, x) {
      const L = linkFind(me, x); if (!L || L.state !== LK_OPEN || doorEnd(L, me, x)) return;
      const held = L.hold[lEnd(me, x)]; L.hold[lEnd(me, x)] = [];
      const byeOk = ph().pathOk(me, x) && !(L.half & (1 << lEnd(me, x))) && !L.stuck; const hAt0 = L.halfAt >= 0 ? L.halfAt : T(); const stuck0 = L.stuck;
      L.state = LK_CLOSED; L.epoch++; L.q = []; L.half = 0; L.halfAt = -1; L.nnAt[0] = L.nnAt[1] = -1; L.view[lEnd(me, x)] = LK_CLOSED; L.callClosed = byeOk;
      L.gone |= (1 << lEnd(me, x)); L.agreed[lEnd(me, x)] = false; L.closingAt[lEnd(me, x)] = -1; L.hold[lEnd(me, x)] = []; lv.L22_CLOSED++;
      trace('L22-CLOSE', me, null, 'peer=%d', x);
      const at = Math.max(T() + ph().ldraw(LINK_DC_MIN, LINK_DC_MAX, x, me, 0x6463), L.arrAt[lEnd(x, me)] + 1);
      if (byeOk) ph().downAt(at, x, me, L.epoch, 'unneeded'); else if (stuck0) ph().downAt(Math.max(T(), hAt0 + LINK_DISC_DEAD), x, me, L.epoch, 'disconnected-persist'); else ph().downAt(Math.max(T(), hAt0 + LINK_ICE_FAIL) + LINK_FAILED_PERSIST, x, me, L.epoch, 'failed-persist');
      if (held.length > 0 && me < lv.nextId && alive[me] && x < lv.nextId && alive[x]) {
        L.callClosed = false; ph().startDial(me, x, L); L.dialT = mtI(held[0].t);
        for (const f of held) if (L.q.length < LINK_QCAP) L.q.push(f);
        trace('L22-REDIAL', me, null, 'peer=%d held=%zu why=L33.4', x, held.length);
      }
    }

    // L23 NO PEER CAN MAKE ME KEEP A PC
    // C++: mesh_link.inc:l23Strike   [end]
    function l23Strike(me, x) {
      const k = ins(S.L23S, idPair(me, x), () => ({ until: -1, last: -1, n: 0 }));
      if (k.last >= 0 && T() - k.last > 4 * K.L23_COOL_MAX) k.n = 0; k.n++; k.last = T(); const sh = Math.min(k.n - 1, 10); k.until = T() + Math.min(K.L23_COOL0 << sh, K.L23_COOL_MAX);
    }
    // C++: mesh_link.inc:l23Pend   [end]
    function l23Pend(me, add) {
      if (lv.L23PENDT !== T()) { lv.L23PENDT = T(); S.L23PEND.fill(0); }
      while (me >= S.L23PEND.length) S.L23PEND.push(0);
      if (add) S.L23PEND[me]++; return S.L23PEND[me];
    }
    // C++: mesh_link.inc:l23Full   [end]
    function l23Full(me) {
      lEnsure(me); let n = l23Pend(me, false);
      for (const p of P.LINKPEERS[me]) { const L = linkFind(me, p); if (L && (L.state === LK_OPEN || L.state === LK_DIALING)) n++; }
      return n >= pcBudget(me, E.PB_CLASS);
    }
    // C++: mesh_link.inc:l23Stretch   [end]
    function l23Stretch(me) {
      lEnsure(me); let n = 0;
      for (const p of P.LINKPEERS[me]) { const L = linkFind(me, p); if (L && (L.state === LK_OPEN || L.state === LK_DIALING)) n++; }
      return Math.max(0, n - pcBudget(me, E.PB_CLASS) + 1);
    }
    // C++: mesh_link.inc:l23GreetSlot   [end]
    function l23GreetSlot(me, from, ck) {
      const key = hash.hmix64(hash.hmixId(hash.H_INIT, me), ck); const it = S.L23GREET.get(key);
      if (it === undefined || T() - it[1] > K.L23_WORD_ || it[0] === from) { if (S.L23GREET.size > 100000) S.L23GREET.clear(); S.L23GREET.set(key, [from, T()]); return true; }
      return false;
    }
    // C++: mesh.cpp:l23Word   [end]
    function l23Word(s, x) {
      const it = s.l23WordAt.get(x); const t = s.TICK;
      if (it === undefined) { let nw = 0; for (const v of s.l23WordAt.values()) if (t - v < K.L23_WORD_) nw++; if (nw >= K.L23_WORDS_) return false; if (s.l23WordAt.size > 64) s.l23WordAt.clear(); s.l23WordAt.set(x, t); return true; }
      if (t - it >= 8 * K.L23_WORD_) { let nw = 0; for (const [k, v] of s.l23WordAt) if (k !== x && t - v < K.L23_WORD_) nw++; if (nw >= K.L23_WORDS_) return false; s.l23WordAt.set(x, t); return true; }
      return t - it < K.L23_WORD_;
    }
    // C++: mesh.cpp:l23WordPeek   [end]
    function l23WordPeek(s, x) {
      const it = s.l23WordAt.get(x); const t = s.TICK;
      if (it === undefined) { let nw = 0; for (const v of s.l23WordAt.values()) if (t - v < K.L23_WORD_) nw++; return nw < K.L23_WORDS_; }
      if (t - it >= 8 * K.L23_WORD_) { let nw = 0; for (const [k, v] of s.l23WordAt) if (k !== x && t - v < K.L23_WORD_) nw++; return nw < K.L23_WORDS_; }
      return t - it < K.L23_WORD_;
    }
    // C++: mesh.cpp:l23CallsIn   [end]
    const l23CallsIn = (s) => s.callBook.inCount(s.TICK);
    // C++: mesh.cpp:l23RealRole   [end]
    function l23RealRole(me, x) {
      const s = seats[me]; if (!s.hasCoord) return false; if (s.linkRole(x, E.LR_E2 | E.LR_L4 | E.LR_UP)) return true;
      const ol = ownedLinks(s.coord); for (let k = 0; k < ol.length; k++) { const ck = ckey(ol[k]); if (s.occGet(ck) !== x) continue; if (!s.bareAt.has(ck)) return true; }
      return false;
    }
    // C++: mesh_link.inc:fabricL23Busy   [end]
    function fabricL23Busy(me, x) { return me >= 0 && me < lv.nextId && seats[me].hasCoord && seats[me].state === 3 && l23Full(me) && !l23RealRole(me, x); }
    // C++: mesh_link.inc:l23Suspect   [end]
    function l23Suspect(me, x) {
      if (me < 0 || me >= lv.nextId || x < 0 || x >= lv.nextId) return false;
      { const it = S.L23S.get(idPair(me, x)); if (it !== undefined && it.n >= 2 && T() - it.last <= 4 * K.L23_COOL_MAX) return true; }
      const s = seats[me]; if (l23RealRole(me, x)) return false;
      if (l18Role(me, x)) { for (const [bk, bt] of s.bareAt) if (s.occGet(bk) === x && s.TICK - bt >= 2 * K.L23_WORD_) return true; }
      { const wk = s.l23Work.get(x); if (wk !== undefined && wk[0] >= K.L23_WORK && s.TICK - wk[1] <= 40) return true; }
      if (s.callBook.inOverlong(x, s.TICK)) return true;
      const wd = s.l23WordAt.get(x); return wd !== undefined && s.TICK - wd >= K.L23_WORD_ && s.TICK - wd < 8 * K.L23_WORD_;
    }
    // C++: mesh_link.inc:l23Refused   [end: the callee's own decision]; mt is the frame type name or null (C++ -1)
    function l23Refused(me, from, mt = null, ck = 0) {
      if (me < 0 || me >= lv.nextId || from < 0 || from >= lv.nextId || !alive[me] || !(seats[from].hasCoord && seats[from].state === 3)) return false;
      if (mt === null || mt === 'U2BEAT' || mt === 'U2ACK' || l22Need(me, from)) return false;
      const probe = msg.newMsg(mt);
      const greet = (mt === 'HELLO' || mt === 'CLAIM') && ck && seats[me].hasCoord && seats[me].ownedLinkCell(ck) && (seats[me].occGet(ck) < 0 || seats[me].occGet(ck) === from) && l23GreetSlot(me, from, ck);
      const call = seatM.l13Frame(probe) || mt === 'MEETACK' || mt === 'YIELD' || mt === 'FINDLEAF' || mt === 'LEAVE' || mt === 'CHALLENGE' || mt === 'CONFIRM';
      if ((greet || P.l392Contest(me, from, mt, ck)) && !l23Suspect(me, from)) return false;   // L39.2: the question about my own cell reaches me (harness gaps3-fab.js)
      const it = S.L23S.get(idPair(me, from)); if (it !== undefined && it.until > T() && it.n >= 2 && !call) { lv.L23_REFUSED++; return true; }
      if (!l23Suspect(me, from) && !l23Full(me)) { l23Pend(me, true); return false; }
      if (l23Suspect(me, from)) { lv.L23_REFUSED++; return true; }
      if (seats[me].hasCoord && seats[me].state === 3 && l23Full(me)) {
        let dialing = 0; lEnsure(me); for (const p of P.LINKPEERS[me]) { const L = linkFind(me, p); if (L && L.state === LK_DIALING) dialing++; }
        if (!call || l23CallsIn(seats[me]) + dialing >= K.L23_CALLS_) { lv.L23_REFUSED++; return true; }
      }
      return false;
    }
    // C++: mesh_link.inc:l23CloseAlone   [end]
    function l23CloseAlone(me, x, strike = true) { const L = linkFind(me, x); if (!L || L.state !== LK_OPEN) return; l22Close(me, x); lv.L23_CLOSED++; if (strike) l23Strike(me, x); trace('L23-CLOSE', me, null, 'peer=%d strike=%d', x, strike ? 1 : 0); }
    const cmpPair = (p, q) => (p[0] - q[0]) || (p[1] - q[1]);
    // C++: mesh_link.inc:l22Tick   [fabric: walks every Link; each end's decision is its own]
    function l22Tick() {
      for (const [key, L] of P.LINKS) {
        for (let e = 0; e < 2; e++) {
          if (!L.agreed[e] || L.closingAt[e] < 0 || T() - L.closingAt[e] <= K.L22_CLOSE_WAIT) continue;
          const me = e === 0 ? pkA(key) : pkB(key), x = e === 0 ? pkB(key) : pkA(key);
          const q = L.hold[e]; L.hold[e] = []; L.agreed[e] = false; L.closingAt[e] = -1;
          trace('L22-CLOSE-TIMEOUT', me, null, 'peer=%d held=%zu', x, q.length);
          if (L.state === LK_OPEN) l22Close(me, x);
          if (q.length > 0 && L.state === LK_CLOSED && me < lv.nextId && alive[me] && x < lv.nextId && alive[x]) {
            L.callClosed = false; ph().startDial(me, x, L); L.dialT = mtI(q[0].t);
            for (const f of q) if (L.q.length < LINK_QCAP) L.q.push(f);
            trace('L22-REDIAL', me, null, 'peer=%d held=%zu why=timeout', x, q.length);
          }
        }
      }
      const ask = [], close2 = [], alone = [], full = []; const aloneIdle = new Set();
      for (const [key, L] of P.LINKS) {
        if ((L.state !== LK_OPEN && L.state !== LK_DIALING) || L.half) continue;
        const a = pkA(key), b = pkB(key);
        for (let e = 0; e < 2; e++) {
          const me = e === 0 ? a : b, x = e === 0 ? b : a; const d = lEnd(me, x);
          if (L.outside && me < lv.nextId && alive[me] && doorEnd(L, me, x)) { L.nnAt[d] = -1; continue; }
          if (me >= lv.nextId || !alive[me] || P.isFrozen(me) || l22Need(me, x) || (seats[me].hostile & E.H_HOLDS_)) { L.nnAt[d] = -1; continue; }
          if (L.nnAt[d] < 0) { L.nnAt[d] = T(); continue; }
          if (L.state === LK_OPEN && T() - L.nnAt[d] >= K.L23_BOUND && (T() - Math.max(L.txAt[lEnd(x, me)], L.nnAt[d]) >= K.L23_BOUND || l23Suspect(me, x) || T() - L.nnAt[d] >= K.L23_LONG)) {
            if (T() - Math.max(L.txAt[lEnd(x, me)], L.nnAt[d]) >= K.L23_BOUND) aloneIdle.add(idPair(me, x));
            alone.push([me, x]); continue;
          }
          if (L.state === LK_OPEN && T() - L.nnAt[d] >= K.L22_SETTLE && T() - L.farAsk[d] <= K.L222_FRESH && !L.half && !l221Sent(L, me, x)) { L.farAsk[d] = -1000000; L.nnAsk[d] = T(); close2.push([me, x]); continue; }
          if (L.state === LK_OPEN && T() - L.nnAt[d] >= K.L22_SETTLE && T() - L.nnAsk[d] >= K.L22_ASK && !l221Sent(L, me, x)) { L.nnAsk[d] = T(); ask.push([me, x]); }
        }
      }
      close2.sort(cmpPair); for (const p of close2) { trace('L22.2-CLOSE', p[0], null, 'peer=%d', p[1]); l22CloseAsk(p[0], p[1]); }
      ask.sort(cmpPair);
      for (const p of ask) { const m = msg.newMsg('UNNEEDED'); m.id = p[0]; trace('L22-ASK', p[0], null, 'peer=%d', p[1]); P.schedL10(p[0], p[1], m, 'L22SEQ'); }
      {
        alone.sort(cmpPair);
        for (const p of alone) { const L = linkFind(p[0], p[1]); const asked = !!L && L.nnAsk[lEnd(p[0], p[1])] >= 0 && L.nnAsk[lEnd(p[0], p[1])] - L.nnAt[lEnd(p[0], p[1])] >= K.L22_ASK && aloneIdle.has(idPair(p[0], p[1])); l23CloseAlone(p[0], p[1], asked); }
        full.sort(cmpPair); for (const p of full) l23CloseAlone(p[0], p[1], false);
      }
    }
    // C++: mesh_link.inc:l23MakeRoom   [end]
    function l23MakeRoom(me, x) {
      if (me < 0 || me >= lv.nextId || !alive[me] || !seats[me].hasCoord || seats[me].state !== 3 || !l23Full(me)) return;
      const L0 = linkFind(me, x); if (L0 && (L0.state === LK_OPEN || L0.state === LK_DIALING)) return;
      lEnsure(me); let best = -1, bt = 0;
      for (const p of P.LINKPEERS[me]) { const L = linkFind(me, p); if (!L || L.state !== LK_OPEN || L.outside) continue; const t = L.nnAt[lEnd(me, p)]; if (t < 0 || l22Need(me, p)) continue; if (best < 0 || t < bt) { best = p; bt = t; } }
      if (best >= 0) l23CloseAlone(me, best, false);
    }

    // ===================================================================================================================
    // DIALS (the seat's calls)
    // C++: mesh_link.inc:fabricLinkState   [end: my end's own view]
    function fabricLinkState(me, x) {
      if (!lv.LINKMODEL) return LS_OPEN;
      if (me < 0 || x < 0 || me === x) return LS_NONE;
      const L = linkFind(me, x); if (!L) return LS_NONE;
      if (L.gone & (1 << lEnd(me, x))) return LS_NONE;
      return L.view[lEnd(me, x)];
    }
    // C++: mesh_link.inc:fabricDialFails   [end]
    const fabricDialFails = (me, x) => (me >= 0 && me < lv.nextId) ? seats[me].dials.fails(x) : 0;
    // C++: mesh_link.inc:fabricDoorFrom   [end]
    function fabricDoorFrom(me, x) { const L = linkFind(me, x); return !lv.LINKMODEL || !L || !!L.outside; }
    // C++: mesh_link.inc:fabricDoors
    const fabricDoors = () => !!lv.LINKMODEL;
    // C++: mesh_link.inc:fabricCallFrame   [end]
    function fabricCallFrame(me, to, m) {
      if (!lv.LINKMODEL || me < 0 || to < 0 || me === to || to >= lv.nextId || !alive[to] || !P.grpReach(me, to)) return;
      noteCall(me, to); ph().linkSchedule(me, to, m);
    }
    // C++: mesh_link.inc:fabricDial   [end]
    function fabricDial(me, x) {
      if (!lv.LINKMODEL || me < 0 || x < 0 || me === x || x >= lv.nextId) return;
      if (dialHeld(me, x)) return;
      if (l18NoDial(me, x)) return;
      noteCall(me, x);
      if (l23Refused(x, me)) return;
      l23MakeRoom(me, x);
      const L = ph().linkGet(me, x); if (L.state === LK_NONE || L.state === LK_CLOSED) { ph().startDial(me, x, L); L.dialHow = 1; }
    }
    // C++: mesh_link.inc:fabricDialJoin   [end]
    function fabricDialJoin(me, x) {
      if (!lv.LINKMODEL || me < 0 || x < 0 || me === x || x >= lv.nextId) return;
      if (l18NoDial(me, x)) return;
      if (dialHeld(me, x)) return;
      noteCall(me, x);
      if (l23Refused(x, me)) return;
      l23MakeRoom(me, x);
      const L = ph().linkGet(me, x); if (L.state === LK_NONE || L.state === LK_CLOSED) { ph().startDial(me, x, L); L.dialHow = 2; } else if (L.state === LK_DIALING) L.view[lEnd(me, x)] = LK_DIALING;
    }
    // C++: mesh_link.inc:linkHeld   [end]
    function linkHeld(x) {
      lEnsure(x); let n = 0;
      for (const p of P.LINKPEERS[x]) { const L = linkFind(x, p); if (!L) continue; if (L.state === LK_OPEN && !(L.half & (1 << lEnd(p, x)))) n++; else if (L.state === LK_DIALING && L.uplink) n++; }
      return n;
    }
    // C++: mesh_link.inc:fabricDialUplink   [end: the head's dial and its offer]; refer is left as given (the sim: (void)refer)
    function fabricDialUplink(me, x, refer) {
      if (!lv.LINKMODEL || me < 0 || x < 0 || me === x || x >= lv.nextId) return false;
      const L0 = linkFind(me, x); const had = !!L0 && (L0.state === LK_OPEN || L0.state === LK_DIALING);
      fabricDialJoin(me, x); const L = linkFind(me, x); if (L && L.state === LK_DIALING) L.uplink = true;
      if (L && (L.state === LK_OPEN || L.state === LK_DIALING)) { const o = msg.newMsg('UPOFFER'); o.id = me; o.tag = had ? 1 : 0; o.to = x; o.from = -1; o.lk = -1; P.wireTx(o, me); P.busPush(T() + 1, o); }
      return true;
    }
    // C++: mesh_link.inc:fabricUpTake   [end: the far page decides from its own pcs and chain]; 0 take, 1 chain cut, 2 at budget
    function fabricUpTake(x, h) {
      if (!lv.LINKMODEL || x < 0 || h < 0 || x >= lv.nextId || h >= lv.nextId) return 0;
      const sx = seats[x];
      if (sx.hasCoord && sx.state === 3 && sx.coord.pc !== 0 && sx.l14Branch() && !(sx.l14Up >= 0 && fabricLinkState(x, sx.l14Up) === LS_OPEN)) { trace('L14-REFUSE', x, null, 'from=%d cut=1', h); return 1; }
      if (linkHeld(x) > pcBudget(x, E.PB_CLASS)) { lv.L14_REFUSED++; trace('L14-REFUSE', x, null, 'from=%d held=%d budget=%d', h, linkHeld(x), pcBudget(x, E.PB_CLASS)); return 2; }
      return 0;
    }
    // C++: mesh_link.inc:fabricUpDecline   [end: the far page refuses the pc and sends its referrals]
    function fabricUpDecline(x, h, refer) {
      if (!lv.LINKMODEL || x < 0 || h < 0 || x >= lv.nextId || h >= lv.nextId) return;
      const L = linkFind(x, h); if (L && L.state === LK_DIALING) ph().closeBoth(L, x, h, false, 'declined');
      const d = msg.newMsg('BUSY'); d.tag = 14; d.id = x; d.from = x; d.to = h; d.lk = -1; d.list = refer.slice(); P.wireTx(d, x); P.busPush(T() + 1, d);
    }

    // ===================================================================================================================
    // mesh_linkset_fab.inc: every reason a seat has to hold a pc
    // C++: mesh_linkset_fab.inc:linkWhy   [end]
    function linkWhy(me, x, first) {
      const s = seats[me]; let wm = 0;
      if (s.state !== 3 || !s.hasCoord || s.moving) return E.LW_ENTRY;
      if (s.TICK - s.seatedAt < K.L22_SEATED_SETTLE) return E.LW_ENTRY;
      if (l23RealRole(me, x)) { wm |= E.LW_ROLE; if (first) return wm; }
      if (l23Suspect(me, x)) { if (s.keepHeld(x)) wm |= E.LW_KEEP; return wm; }
      { if (s.l14Serve(x)) { wm |= E.LW_ROLE; if (first) return wm; } if (s.callBook.inReason(x, s.TICK)) { wm |= E.LW_CALL; if (first) return wm; } }
      if (s.callBook.outReason(x, s.TICK)) { wm |= E.LW_CALL; if (first) return wm; }
      { const it = s.l22Rival.get(x); if (it !== undefined && s.TICK - it <= K.L22_RIVAL && (first ? l23Word(s, x) : l23WordPeek(s, x))) { wm |= E.LW_RIVAL; if (first) return wm; } }
      if (l22Beside(me, x) && (first ? l23Word(s, x) : l23WordPeek(s, x))) { wm |= E.LW_BESIDE; if (first) return wm; }
      if (P.fhopActive() && me < P.FH.length) {
        const f = P.FH[me]; let h = false;
        for (const j of f.jobs) if (j.target === x || j.req === x) h = true;
        for (const p of f.peer.values()) if (p.via === x) h = true;
        if (h) { wm |= E.LW_FHOP; if (first) return wm; }
      }
      if (s.keepHeld(x)) { wm |= E.LW_KEEP; if (first) return wm; }
      if (l223Island(me, x, first)) { wm |= E.LW_ISLAND; if (first) return wm; }
      return wm;
    }
    // C++: mesh_linkset_fab.inc:l22Need   [end]
    function l22Need(me, x) { if (me < 0 || me >= lv.nextId || !alive[me]) return true; return linkWhy(me, x, true) !== 0; }
    // C++: mesh_linkset_fab.inc:l28Reply   [end]
    function l28Reply(me, x) {
      if (me < 0 || me >= lv.nextId || !alive[me] || x < 0 || x >= lv.nextId) return;
      const L = linkFind(me, x); if (!L || L.state !== LK_OPEN || doorEnd(L, me, x) || L.half || l221Sent(L, me, x)) return;
      if (linkWhy(me, x, false) !== E.LW_KEEP) return;
      trace('L28-REPLY', me, null, 'peer=%d', x);
      const m = msg.newMsg('UNNEEDED'); m.id = me; m.tag = 4; P.schedL10(me, x, m, 'L22SEQ');
    }

    // ===================================================================================================================
    // mesh_rcfollow_fab.inc
    // C++: mesh_rcfollow_fab.inc:l1611Guard   [fabric: the greeter closes one of its own doors from its own count]
    function l1611Guard(a, b, L) {
      for (const x of [a, b]) {
        if (x < 0 || x >= lv.nextId || !alive[x]) continue;
        const v = seats[x]; if (!(v.hasCoord && v.state === 3 && v.coord.pc === 0)) continue;
        const h = l1610Held(x); let n = h.n;
        { const Lx = linkFind(a, b); if (Lx === L && (L.state === LK_OPEN || L.state === LK_DIALING || L.view[lEnd(x, x === a ? b : a)] === LK_OPEN)) n--; }
        if (n + 1 <= pcBudget(x, E.PB_S1)) continue;
        lEnsure(x);
        let best = null, bestK = -1, bestRank = -1, bestIdle = -1;
        for (const p of P.LINKPEERS[x]) {
          if (p === a || p === b) continue; const D = linkFind(x, p); if (!D || !D.outside || D.outside === 3 || (D.state !== LK_OPEN && D.state !== LK_DIALING)) continue;
          if (!(D.outside & (1 << lEnd(p, x)))) continue;
          if (l15NamesX(x, p)) continue;
          const rank = doorHeard(D, x, p) ? 1 : 0; const idle = T() - D.dProg;
          if (rank > bestRank || (rank === bestRank && (idle > bestIdle || (idle === bestIdle && p < bestK)))) { best = D; bestK = p; bestRank = rank; bestIdle = idle; }
        }
        if (!best) continue;
        lv.L1611_SHED++; trace('L16.11-SHED', x, null, 'peer=%d for=%d pcs=%d sat=%d idle=%lld', bestK, x === a ? b : a, n, bestRank, bestIdle);
        l16Close(best, x, bestK); S.LDOORS.delete(P.pairKey(x, bestK));
      }
    }
    // C++: mesh_rcfollow_fab.inc:l223Contest   [end]
    function l223Contest(s, x) {
      if (!s.hasCoord || s.state !== 3) return false;
      const ix = s.l22Cell.get(x); if (ix === undefined || s.TICK - ix[1] > K.LEASE_T || !cellOk(ix[0])) return false;
      const c = ix[0]; const mine = (c === ckey(s.coord)); let near = mine;
      if (!near) { for (const o of ownedLinks(s.coord)) if (ckey(o) === c) { near = true; break; } }
      if (!near) return false;
      if (mine) return true;
      const v = s.occGet(c); return v >= 0 && v !== x;
    }
    // C++: mesh_rcfollow_fab.inc:l223Island   [end]
    function l223Island(me, x, first) {
      if (me < 0 || me >= lv.nextId || !alive[me]) return false;
      const s = seats[me];
      {
        if (s.mergeCalc()) return true;
        if (!s.islandSeen()) {
          if (!s.hasCoord || s.state !== 3) return false;
          if (s.otherRing(x)) return first ? l23Word(s, x) : l23WordPeek(s, x);
          return false;
        }
      }
      if (!s.l832Settled() || s.l836Merging()) return true;
      { const rx = s.l828Ring.get(x); if (rx !== undefined && s.hasCoord && s.state === 3 && rx[0] !== s.ringName()) return true; }
      if (l223Contest(s, x)) return true;
      { if (!l18Cell(me, x)) return true; }
      return false;
    }

    // ===================================================================================================================
    // L18: the rung between friend-hop and TURN (mesh.cpp:2482-2525)
    // C++: mesh.cpp:l22Beside   [end]
    function l22Beside(me, x) {
      const s = seats[me]; if (!s.hasCoord) return false;
      const it = s.l22Cell.get(x); if (it === undefined || s.TICK - it[1] > K.L22_RIVAL || !cellOk(it[0])) return false;
      const pc = topo.unckey(it[0]); const mk = ckey(s.coord); if (it[0] === mk) return true;
      let ol = ownedLinks(s.coord); for (let k = 0; k < ol.length; k++) if (ckey(ol[k]) === it[0]) return true;
      ol = ownedLinks(pc); for (let k = 0; k < ol.length; k++) if (ckey(ol[k]) === mk) return true;
      return false;
    }
    // C++: mesh.cpp:l18Role   [end]
    function l18Role(me, x) { const s = seats[me]; if (!s.hasCoord) return false; return s.linkRole(x, E.LR_TOPO); }
    // C++: mesh.cpp:l18Cell   [end]; the cell my own view holds x at, or null
    function l18Cell(me, x) {
      const s = seats[me];
      for (const [k, v] of s.occ) if (v === x && cellOk(k)) return topo.unckey(k);
      for (const [k, v] of s.cousins) if (v === x && cellOk(k)) return topo.unckey(k);
      for (const e of s.roster) if (e.v === x && cellOk(e.k)) return topo.unckey(e.k);
      return null;
    }
    // C++: mesh.cpp:l18Dist
    function l18Dist(a, t) {
      let da = 0, db = 0; let x = a.pc, y = t.pc; for (let q = x; q; q = parentPath(q)) da++; for (let q = y; q; q = parentPath(q)) db++;
      let up = 0; while (da > db) { x = parentPath(x); da--; up++; } while (db > da) { y = parentPath(y); db--; up++; } while (x !== y) { x = parentPath(x); y = parentPath(y); up += 2; }
      if (up) return 2 * up + (a.i !== 0 ? 1 : 0) + (t.i !== 0 ? 1 : 0);
      return (a.r !== t.r ? 1 : 0) + (a.i !== t.i ? 1 : 0);
    }
    // C++: mesh.cpp:l18Hop   [end]
    function l18Hop(me, dst, via) {
      const s = seats[me]; let nh = s.strictNextHop(dst); if (nh >= 0 && fabricLinkState(me, nh) === LS_OPEN) return nh;
      nh = s.nextHopToward(dst, via); if (nh >= 0 && nh !== me && l18Role(me, nh) && fabricLinkState(me, nh) === LS_OPEN) return nh;
      if (!lv.LINKMODEL || !s.hasCoord || me >= P.LINKPEERS.length) return -1;
      let best = -1, bd = l18Dist(s.coord, dst);
      for (const p of P.LINKPEERS[me]) {
        if (p === via || p === me || p >= lv.nextId || fabricLinkState(me, p) !== LS_OPEN) continue;
        const pc = l18Cell(me, p); if (!pc) continue; const d = l18Dist(pc, dst);
        if (d < bd || (best >= 0 && d === bd && p < best)) { bd = d; best = p; }
      }
      return best;
    }
    // C++: mesh.cpp:l18DirectFailed   [end]
    const l18DirectFailed = (from, to) => from >= 0 && from < lv.nextId && seats[from].dials.pathFailedWithin(to, K.L18_HOLD, seats[from].TICK);
    // C++: mesh.cpp:l18Route   [end]
    function l18Route(from, to) {
      if (from < 0 || to < 0 || from >= lv.nextId || to >= lv.nextId || seatM.islandStand(seats[from], E.IS_L18)) return false;
      const a = seats[from], b = seats[to];
      if (a.state !== 3 || !a.hasCoord || b.state !== 3 || !b.hasCoord) return false;
      if (ckey(a.coord) === ckey(b.coord)) return false;
      if (l18Role(from, to) || a.callBook.outFresh(to, a.TICK) || l22Beside(from, to) || fabricLinkState(from, to) === LS_OPEN) return false;
      if (!l18DirectFailed(from, to)) { lv.L18_SKIPDIRECT++; return false; }
      if (P.fhopFriendFor(from, to)) { lv.L18_SKIPFRIEND++; return false; }
      if (a.l13Mass()) { lv.L18_SKIPMASS++; return false; }
      const c = l18Cell(from, to); if (!c) return false;
      if (l18Hop(from, c, -1) < 0) { lv.L18_NOPATH++; return false; }
      return true;
    }
    // C++: mesh.cpp:l18Deliv   [end: counts the frame that arrived]
    function l18Deliv(m) { if (!m.l18) return; const h = 16 - m.rttl; lv.L18_DELIV++; lv.L18_HOPS += h; if (h > lv.L18_HMAX) lv.L18_HMAX = h; S.L18_HH[h < 8 ? h : 8]++; }

    Object.assign(fns, {
      fabricLinkState, fabricDial, fabricDialJoin, fabricDialUplink, fabricDialFails, fabricUpTake, fabricUpDecline, fabricDoors,
      fabricDoorDrop, fabricDoorHanded, fabricDoorHeard, fabricMyDoors, fabricMyKnocks, fabricNoSock, fabricL23Busy, fabricCallFrame,
      l22Quiet, l222Note, l22Agree, l22Close, l22CloseAsk, l22Need, l28Reply, l18Route, l18Cell, l18Hop, l18Deliv,
    });
    return {
      S, fns, newLink: newLink,
      // the fabric halves, called by the tick (linkTick)
      l15Doors, l16Doors, l22Tick, l1611Guard,
      // the pieces the physics and the checks reach
      pcBudget, l14Budget, l16Refuse, l23Refused, l23Full, l23Stretch, l1610Full, l1610Held, noteCall, dialHeld, doorEnd, doorHeard, l15Seated, l15Names, l15NamedBy,
      l16Mobile, l16MobBudget, l16Close, l22Release, l23CloseAlone, l23MakeRoom, l23Suspect, l23RealRole, l23Word, l23WordPeek, linkWhy, l22Beside, l18Role, l18Dist, l18NoDial,
      fabricDoorFrom, linkHeld, l221Sent,
    };
  }

  const api = Object.freeze({ createPcLaws, newLink, cellOk, lEnd });
  GifOS.meshPcLaws = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
