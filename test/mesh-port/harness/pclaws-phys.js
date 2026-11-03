'use strict';
/*
 * pclaws-phys.js: a STAND-IN for the link physics (port plan H2), written so the pc laws (js/mesh/pclaws.js) can be run
 * against the sim's own fabric before H2 lands. It is a line-for-line port of the parts of mesh_link.inc the laws call
 * and the tick that drives them: the Link table, the dial (startDial), linkDeliver, linkSchedule, the close paths, the
 * link events (linkApply) and linkTick. H2 supersedes it: its physics must keep the shape pclaws.js expects (see the P.phys
 * list in pclaws.js), and its startDial must keep the door bookkeeping that touches the law tables (pc.S.LDOORS, DOORN, DOORK).
 *
 * Harness code: never shipped. Every function names its C++.
 */
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const C_ = require(path.join(M, 'consts.js'));
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));
const hash = require(path.join(M, 'hash.js'));
const seatM = require(path.join(M, 'seat.js'));
const { newLink, lEnd } = require(path.join(M, 'pclaws.js'));

const K = C_.consts, E = C_.enums;
const { LK_NONE, LK_DIALING, LK_OPEN, LK_CLOSED } = E;
const C = topo.C;
const LINK_DIAL_DESK_MIN = 2, LINK_DIAL_DESK_MAX = 6, LINK_DIAL_MOB_MIN = 4, LINK_DIAL_MOB_MAX = 10, LINK_DIAL_FAIL = 40;
const LINK_DC_MIN = 0, LINK_DC_MAX = 1, LINK_FAILED_PERSIST = 18, LINK_ICE_FAIL = 60, LINK_DISC_DEAD = 196, LINK_STARVE = 24;
const LINK_TL_DEBOUNCE = 20, LINK_ASK_GAP = 8, LINK_QCAP = 64, L374_W = 5;
const idPair = hash.idPair;

function createPhys(fab, pc) {
  const lv = fab.lv, seats = fab.seats, alive = fab.alive, T = () => fab.w.TICK;
  const trace = fab.trace;
  const LINKS = new Map(), LINKPEERS = [], LEVQ = new Map(), LBLOCK = new Map(), RADIO = new Map(), TLDEB = new Map();
  const LRX = [], LTX = []; let LPENDCLOSE = []; const LSTAT = new Array(8).fill(0);
  const L1341_OPENED = new Set(); const L374F = new Map(); const TIEROVR = new Map();
  const S = pc.S;
  const ph = { LINKS, LINKPEERS, LEVQ, LBLOCK, RADIO, TLDEB, LRX, LTX, LSTAT, TIEROVR, lEnd, newLink };

  // C++: mesh_link.inc:lmix
  const lmix = (x) => hash.fmix32((x + 0x9e3779b9) >>> 0);
  // C++: mesh_link.inc:ldraw
  ph.ldraw = (lo, hi, a, b, salt) => {
    const h = lmix(lmix(lmix(lmix(((lv.SEED0 >>> 0) ^ salt) >>> 0) ^ (T() >>> 0)) ^ (a >>> 0)) ^ (b >>> 0));
    return lo + (h % (hi - lo + 1));
  };
  // C++: mesh_link.inc:lMobHash
  const lMobHash = (id, f) => f > 0 && (lmix(hash.hmix(((lv.SEED0 >>> 0) ^ 0x6d6f62) >>> 0, id >>> 0)) % 1000000) / 1e6 < f;
  // C++: mesh_link.inc:tierMobile
  const tierMobile = (id) => { const o = TIEROVR.get(id); if (o !== undefined) return o === E.TIER_MOBILE; return lMobHash(id, lv.TIERMIX); };
  // C++: mesh_link.inc:lMobile
  const lMobile = (id) => tierMobile(id) || lMobHash(id, lv.LMOBILE);
  // C++: mesh_link.inc:lEnsure
  ph.lEnsure = (id) => { if (id >= LINKPEERS.length) { const n = Math.max(id + 1, LINKPEERS.length * 2); while (LINKPEERS.length < n) { LINKPEERS.push([]); LRX.push(-1); LTX.push(-1); } } };
  // C++: mesh_link.inc:linkErase
  const linkErase = (a, b) => {
    LINKS.delete(fab.pairKey(a, b));
    if (a < LINKPEERS.length) LINKPEERS[a] = LINKPEERS[a].filter((v) => v !== b);
    if (b < LINKPEERS.length) LINKPEERS[b] = LINKPEERS[b].filter((v) => v !== a);
  };
  // C++: mesh_link.inc:linkFind
  ph.linkFind = (a, b) => LINKS.get(fab.pairKey(a, b)) || null;
  // C++: mesh_link.inc:linkGet
  ph.linkGet = (a, b) => {
    const pk = fab.pairKey(a, b); const it = LINKS.get(pk); if (it) return it;
    ph.lEnsure(Math.max(a, b)); LINKPEERS[a].push(b); LINKPEERS[b].push(a); const L = newLink(); LINKS.set(pk, L); return L;
  };
  // C++: mesh_link.inc:levPush
  const levPush = (at, kind, a, b, ep, why, ref = -1) => { let v = LEVQ.get(at); if (!v) { v = []; LEVQ.set(at, v); } v.push({ kind, a, b, epoch: ep, why, ref }); };
  // C++: mesh_link.inc:radioOff
  const radioOff = ph.radioOff = (id) => { const t = RADIO.get(id); return t !== undefined && t > T(); };
  // C++: mesh_link.inc:pathOk
  ph.pathOk = (a, b) => {
    if (a < 0 || b < 0 || a >= lv.nextId || b >= lv.nextId || !alive[a] || !alive[b]) return false;
    const bl = LBLOCK.get(fab.pairKey(a, b)); if (bl !== undefined && bl > T()) return false;
    if (radioOff(a) || radioOff(b) || fab.darkPair(a, b) || fab.cutBetween(a, b)) return false;
    if (fab.isFrozen(a) || fab.isFrozen(b)) return false;
    if (!fab.X.grpReach(a, b)) return false;
    if (lv.NUM_SUBNETS > 1 && !fab.reachable(seats[a].subnet, seats[b].subnet)) return false;
    return true;
  };
  // C++: mesh_link.inc:namesOwned
  const namesOwned = (from, to) => seats[from].linkRole(to, E.LR_OWNED | E.LR_E2);
  const l1342On = (from) => from >= 0 && from < lv.nextId && seatM.roomTerm(seats[from], -1);

  // C++: mesh_gaps_fab.inc:l374Note
  function l374Note(from, to, m) {
    if (m.t !== 'FIND') return;
    if (L374F.size > 4096) { for (const [k, v] of L374F) if (v.length === 0 || T() - v[v.length - 1][0] > L374_W) L374F.delete(k); }
    let v = L374F.get(idPair(from, to)); if (!v) { v = []; L374F.set(idPair(from, to), v); }
    while (v.length && T() - v[0][0] > L374_W) v.shift();
    if (v.length < 8) v.push([T(), msg.clone(m)]);
  }
  // C++: mesh_gaps_fab.inc:l374Resend
  function l374Resend(e, x, L) {
    if (e < 0 || x < 0 || e >= lv.nextId || x >= lv.nextId || !alive[e] || !alive[x]) return;
    const it = L374F.get(idPair(e, x)); if (it === undefined) return;
    const q = []; for (const p of it) if (T() - p[0] <= L374_W) q.push(p[1]); L374F.delete(idPair(e, x));
    if (q.length === 0) return;
    trace('L37.4-RESEND', e, null, 'peer=%d n=%zu state=%d', x, q.length, L.state);
    for (const f of q) {
      const g = msg.clone(f); g.from = e; g.to = x;
      if (L.state === LK_OPEN) { if (L.agreed[lEnd(e, x)]) { if (L.hold[lEnd(e, x)].length < LINK_QCAP) L.hold[lEnd(e, x)].push(g); } else if (!(L.half & (1 << lEnd(e, x)))) ph.linkDeliver(e, x, g, L); continue; }
      if (L.state !== LK_DIALING) { L.callClosed = false; ph.startDial(e, x, L); L.dialT = fab.mtI(g.t); L.dialHow = 3; }
      if (L.q.length < LINK_QCAP) L.q.push(g);
    }
  }
  // C++: mesh_link.inc:l1341Note
  function l1341Note(me, x) {
    if (me < 0 || me >= lv.nextId || !alive[me] || x < 0 || x >= lv.nextId || !alive[x] || fab.sockClosed(x) || !L1341_OPENED.has(fab.pairKey(me, x))) return;
    const s = seats[me];
    for (const [k, v] of s.occ) if (v === x) {
      let c = s.l13SplitCell.get(k); if (!c) { c = [0, 0]; s.l13SplitCell.set(k, c); }
      if (c[1] !== s.TICK) trace('L13.41-SPLIT', me, s.hasCoord ? s.coord : null, 'peer=%d cell=%s', x, fab.coordStr(topo.unckey(k)));
      s.l13SplitCell.set(k, [x, s.TICK]);
    }
    if (s.l13SplitCell.size > 64) s.l13SplitCell.clear();
  }

  // C++: mesh_link.inc:startDial
  ph.startDial = (a, b, L) => {
    {
      let o = 0;
      for (const x of [a, b]) if (x < lv.nextId && !(seats[x].hasCoord && seats[x].state === 3)) o |= (1 << lEnd(x, x === a ? b : a));
      L.outside = o; if (o) S.LDOORS.add(fab.pairKey(a, b));
      if (!o) pc.l1611Guard(a, b, L);
      if (o) {
        L.dBorn = L.dProg = T(); L.dAsked = L.dHomed = L.dGw = L.dSat = false; L.dHoAt = -1; L.dWait = -1; L.dOwed = false; L.dWaitAtFind = -1; L.dOwedAt = -1; L.dHeard = 0; L.dIn = !(o & (1 << lEnd(a, b)));
        if (o !== 3) { const g = (o & (1 << lEnd(a, b))) ? b : a; while (g >= S.DOORN.length) { S.DOORN.push(0); S.DOORK.push(0); } S.DOORN[g]++; if (!L.dIn) S.DOORK[g]++; }
      }
    }
    L.nnAt[0] = L.nnAt[1] = -1;
    L.state = LK_DIALING; L.epoch++; L.dialAt = T(); L.half = 0; L.halfAt = -1; L.stuck = false; L.backAt[0] = L.backAt[1] = -1; L.view[lEnd(a, b)] = LK_DIALING; LSTAT[0]++; L.dialBy = a; L.callClosed = false; L.gone = 0; L.uplink = false; L.dialT = -1; L.dialHow = 0;
    if (lv.NETGRP || lv.RELAYSTAT) throw new Error('pclaws-phys: netSignal is not in the stand-in');
    const mob = lMobile(a) || lMobile(b);
    const d = mob ? ph.ldraw(LINK_DIAL_MOB_MIN, LINK_DIAL_MOB_MAX, a, b, 0x6469616c) : ph.ldraw(LINK_DIAL_DESK_MIN, LINK_DIAL_DESK_MAX, a, b, 0x6469616c);
    levPush(T() + d, E.EV_DIAL, a, b, L.epoch, 'dial');
  };

  // C++: mesh_link.inc:linkDeliver  (m is owned by the call)
  ph.linkDeliver = (from, to, m, L) => {
    const e = lEnd(from, to); L.carried = true; L.txAt[e] = T(); LTX[from] = T();
    if (L.outside) { const sf = seats[from]; m.dsat = sf.hasCoord && sf.state === 3; }
    if (L.outside && L.dBorn >= 0) {
      const t = m.t;
      if (t === 'WHOHOME') { if (!L.dAsked) { L.dAsked = true; L.dProg = T(); } }
      else if (t === 'HOME') { if (!L.dHomed) { L.dHomed = true; L.dProg = T(); } }
      else if (t === 'FIND' || t === 'FINDACK' || t === 'PLACE' || t === 'NOROOM' || t === 'HANDOFF' || t === 'TAKEOVER' || t === 'TAKEN') {
        L.dProg = T(); L.dGw = true; if (t === 'FIND') L.dWaitAtFind = L.dWait; if (t === 'FINDACK') L.dWait = T(); else if (t === 'PLACE' || t === 'NOROOM') { L.dWait = -1; L.dOwed = false; }
      }
    }
    const pk = fab.pairKey(from, to);
    const cond = (lv.NUM_SUBNETS > 1 || lv.NET_LOSS > 0 || lv.NET_SEVER > 0 || lv.NET_LAT > 1 || lv.NET_QUAL_MIN < 1.0);
    let d;
    if (cond) {
      const sf = seats[from], st = seats[to];
      if (lv.NET_SEVER > 0) {
        const it = fab.severedUntil.get(pk);
        if (it !== undefined) { if (it > T()) return; fab.severedUntil.delete(pk); }
        if (fab.frnd() < lv.NET_SEVER) { fab.severedUntil.set(pk, T() + 40 + Math.trunc(fab.frnd() * 160)); return; }
      }
      const q = Math.min(sf.netQual, st.netQual);
      if (lv.NET_LOSS > 0 && fab.frnd() < lv.NET_LOSS * (1.0 + 2.0 * (1.0 - q))) return;
      const spread = (lv.NET_LAT > 1) ? 1 + Math.trunc(fab.frnd() * lv.NET_LAT) : 1 + (lv.SEQ & 1);
      const qp = (q < 1.0) ? Math.trunc((1.0 - q) * 4.0 * fab.frnd()) : 0;
      d = spread + qp;
    } else d = 1 + (lv.SEQ & 1);
    m.to = to; m.from = from; m.lk = (m.rvia < 0) ? from : -1; m.lkEp = L.epoch; lv.SEQ++; fab.wireTx(m, from);
    { const re = lEnd(to, from); if (L.arrAt[re] < T() + d) L.arrAt[re] = T() + d; }
    if (m.fhTo < 0 && LRX[to] < T() + d) LRX[to] = T() + d;
    if (m.lk >= 0 && m.t === 'FIND') l374Note(from, to, m);
    fab.busPush(T() + d, m);
  };
  // C++: mesh_link.inc:linkOpenFor
  ph.linkOpenFor = (from, to) => { const L = ph.linkFind(from, to); return !!L && L.state === LK_OPEN && !(L.half & (1 << lEnd(from, to))); };

  // C++: mesh_link.inc:linkSchedule
  ph.linkSchedule = (from, to, m) => {
    if (l1342On(from) && seatM.l13Frame(m)) pc.noteCall(from, to);
    if (lv.NUM_SUBNETS > 1 && !fab.reachable(seats[from].subnet, seats[to].subnet)) return;
    const L = ph.linkGet(from, to); const e = lEnd(from, to);
    const refuse = (mt) => { lv.L16_DEFER = false; if (pc.l16Refuse(from, to, mt)) { if (lv.L16_DEFER) { lv.L16_DEFER = false; m.from = from; m.to = to; if (L.q.length < LINK_QCAP) L.q.push(m); let known = false; for (const pr of S.DOOR_PEND) if (pr.a === from && pr.b === to) { known = true; break; } if (!known) S.DOOR_PEND.push({ a: from, b: to, at: T() }); } return true; } return false; };
    switch (L.state) {
      case LK_NONE:
        if (pc.dialHeld(from, to)) return;
        if (pc.l23Refused(to, from, m.t, (m.t === 'HELLO' || m.t === 'CLAIM') ? m.ck : 0)) return;
        if (refuse(m.t)) return;
        ph.startDial(from, to, L); L.dialT = fab.mtI(m.t); m.from = from; m.to = to; if (L.q.length < LINK_QCAP) L.q.push(m); LTX[from] = T(); return;
      case LK_DIALING:
        if (L.dialT < 0) L.dialT = fab.mtI(m.t); m.from = from; m.to = to; if (L.q.length < LINK_QCAP) L.q.push(m); LTX[from] = T(); return;
      case LK_CLOSED:
        LTX[from] = T();
        if (L.view[e] !== LK_CLOSED && !(L.view[e] === LK_NONE)) return;
        if ((!namesOwned(from, to) || m.gwc) && T() - L.askAt >= LINK_ASK_GAP && !pc.dialHeld(from, to)) {
          if (pc.l23Refused(to, from, m.t, (m.t === 'HELLO' || m.t === 'CLAIM') ? m.ck : 0)) return;
          if (refuse(m.t)) return;
          L.askAt = T(); ph.startDial(from, to, L); L.dialT = fab.mtI(m.t); L.dialHow = 3; m.from = from; m.to = to; L.q.push(m);
        }
        return;
      default:
        if (L.agreed[e] && m.t !== 'UNNEEDED') { if (L.hold[e].length < LINK_QCAP) { m.from = from; m.to = to; L.hold[e].push(m); } LTX[from] = T(); return; }
        if (L.half & (1 << e)) { L.txAt[e] = T(); LTX[from] = T(); return; }
        ph.linkDeliver(from, to, m, L);
    }
  };

  const downAt = ph.downAt = (at, e, x, ep, why) => levPush(at, E.EV_DOWN, e, x, ep, why);
  // C++: mesh_link.inc:closeBoth
  ph.closeBoth = (L, a, b, fail, why) => {
    if (L.state !== LK_OPEN && L.state !== LK_DIALING) return;
    const wasOpen = L.state === LK_OPEN;
    L.state = LK_CLOSED; L.epoch++; L.q = []; L.half = 0; L.halfAt = -1;
    if (!wasOpen) { for (let k = 0; k < 2; k++) if (L.view[k] === LK_DIALING) L.view[k] = LK_CLOSED; return; }
    let da = fail ? T() + LINK_FAILED_PERSIST : T() + ph.ldraw(LINK_DC_MIN, LINK_DC_MAX, a, b, 0x6463);
    let db = fail ? T() + LINK_FAILED_PERSIST : T() + ph.ldraw(LINK_DC_MIN, LINK_DC_MAX, b, a, 0x6463);
    if (!fail && why === 'leave-close') { da = Math.max(da, L.arrAt[lEnd(a, b)] + 1); db = Math.max(db, L.arrAt[lEnd(b, a)] + 1); }
    downAt(da, a, b, L.epoch, why); downAt(db, b, a, L.epoch, why);
  };
  // C++: mesh_link.inc:closeFrom
  ph.closeFrom = (L, e, x, why) => {
    if (L.state !== LK_OPEN) return;
    const hAt = L.halfAt >= 0 ? L.halfAt : T(); const eLive = !(L.half & (1 << lEnd(e, x))); const stuck = L.stuck;
    L.state = LK_CLOSED; L.epoch++; L.q = []; L.half = 0; L.halfAt = -1;
    downAt(T(), e, x, L.epoch, why);
    if (eLive && ph.pathOk(e, x)) downAt(T() + ph.ldraw(LINK_DC_MIN, LINK_DC_MAX, x, e, 0x6463), x, e, L.epoch, 'dc-close');
    else if (stuck) downAt(Math.max(T(), hAt + LINK_DISC_DEAD), x, e, L.epoch, 'disconnected-persist');
    else downAt(Math.max(T(), hAt + LINK_ICE_FAIL) + LINK_FAILED_PERSIST, x, e, L.epoch, 'failed-persist');
  };
  // C++: mesh_link.inc:linkHalf
  ph.linkHalf = (L, a, b, mask, failPath) => {
    if (L.state !== LK_OPEN) return;
    if (L.halfAt < 0) L.halfAt = T();
    L.half |= mask; const fail = failPath && L.half === 3; L.stuck = !fail;
    if (fail) levPush(L.halfAt + LINK_ICE_FAIL, E.EV_ICE, a, b, L.epoch, 'ice-failed', L.halfAt);
    else if (L.half === 3 || L.carried) { levPush(L.halfAt + LINK_DISC_DEAD, E.EV_DISC, a, b, L.epoch, 'disconnected-persist', L.halfAt); levPush(L.halfAt + K.L30_DISC_DEAD, E.EV_DSMALL, a, b, L.epoch, 'disconnected-persist', L.halfAt); }
    else { const dead = (L.half & 1) ? 0 : 1; const lo = Math.min(a, b), hi = Math.max(a, b); const rcv = dead === 0 ? hi : lo; levPush(T() + LINK_STARVE, E.EV_STARVE1, rcv, rcv === lo ? hi : lo, L.epoch, 'starve', L.halfAt); }
  };
  // C++: mesh_link.inc:linkOpenNow
  ph.linkOpenNow = (L, a, b) => {
    L.state = LK_OPEN; L.openEp = L.epoch; L.half = 0; L.halfAt = -1; L.stuck = false; L.view[0] = L.view[1] = LK_OPEN;
    {
      L1341_OPENED.add(fab.pairKey(a, b));
      for (let k = 0; k < 2; k++) {
        const p = k ? b : a, o = k ? a : b;
        if (p < lv.nextId && seats[p]) for (const [key, v] of seats[p].l13SplitCell) if (v[0] === o) { trace('L13.41-JOINED', p, null, 'peer=%d', o); seats[p].l13SplitCell.delete(key); }
      }
    }
    if (L.outside && L.dBorn >= 0) L.dProg = T();
    { if (a < lv.nextId) seats[a].dials.opened(b); if (b < lv.nextId) seats[b].dials.opened(a); }
    LSTAT[1]++; if (L.wasOpen) { LSTAT[3]++; trace('LINK-UP', a, null, 'peer=%d', b); trace('LINK-UP', b, null, 'peer=%d', a); } L.wasOpen = true;
    if (LRX[a] < T()) LRX[a] = T(); if (LRX[b] < T()) LRX[b] = T();
    const q = L.q; L.q = [];
    { let nf = -1, nt = -1; for (const m of q) if (seatM.l13Frame(m) && !(m.from === nf && m.to === nt) && l1342On(m.from)) { nf = m.from; nt = m.to; pc.noteCall(nf, nt); } }
    for (const m of q) { const f = m.from, t = m.to; ph.linkDeliver(f, t, m, L); }
  };
  // C++: mesh_link.inc:linkCloseAll
  ph.linkCloseAll = (id, fail, why) => { ph.lEnsure(id); for (const p of LINKPEERS[id].slice()) { const L = ph.linkFind(id, p); if (L) ph.closeBoth(L, id, p, fail, why); } };
  // C++: mesh_link.inc:linkBlackhole
  ph.linkBlackhole = (id) => { if (!lv.LINKMODEL) return; ph.lEnsure(id); for (const p of LINKPEERS[id].slice()) { const L = ph.linkFind(id, p); if (L) ph.linkHalf(L, id, p, 3, false); } };
  // C++: mesh_link.inc:linkOnLeave
  ph.linkOnLeave = (id) => { if (lv.LINKMODEL) LPENDCLOSE.push(id); };
  // C++: mesh_link.inc:linkCrash
  ph.linkCrash = (id) => {
    ph.lEnsure(id);
    for (const p of LINKPEERS[id].slice()) {
      const L = ph.linkFind(id, p); if (!L) continue;
      const greeter = p < lv.nextId && alive[p] && seats[p].hasCoord && seats[p].coord.pc === 0;
      if (greeter && (L.state === LK_OPEN || L.state === LK_DIALING)) {
        const wasOpen = L.state === LK_OPEN; L.state = LK_CLOSED; L.epoch++; L.q = []; L.half = 0; L.halfAt = -1;
        if (wasOpen) downAt(T() + 1, p, id, L.epoch, 'relay-leave'); else L.view[lEnd(p, id)] = LK_CLOSED;
      } else ph.linkHalf(L, id, p, 3, false);
    }
  };
  // C++: mesh_link.inc:crashTransport
  ph.crashTransport = (id) => { if (lv.LINKMODEL) ph.linkCrash(id); else fab.fireTranslost(id); };
  // C++: mesh_link.inc:closedDrop
  ph.closedDrop = (m) => {
    if (!lv.LINKMODEL || m.lk < 0 || m.lk === m.to || m.to < 0 || m.lk >= lv.nextId) return false;
    const L = ph.linkFind(m.lk, m.to);
    if (!L) { lv.ERASEDROPS++; trace('ERASEDROP', m.to, null, 'from=%d mt=%d', m.lk, fab.mtI(m.t)); return true; }
    if (L.view[lEnd(m.to, m.lk)] === LK_OPEN) return false;
    lv.CLOSEDROPS++; trace('CLOSEDROP', m.to, null, 'from=%d mt=%d', m.lk, fab.mtI(m.t)); return true;
  };
  // C++: mesh_link.inc:linkReset
  ph.linkReset = () => {
    LINKS.clear(); LINKPEERS.length = 0; LEVQ.clear(); LBLOCK.clear(); RADIO.clear(); LRX.length = 0; LTX.length = 0; TLDEB.clear(); LPENDCLOSE = []; S.LDOORS.clear();
    lv.L15_CLOSED = 0; lv.CLOSEDROPS = 0; lv.ERASEDROPS = 0; S.DOORN = []; S.DOORK = []; S.L16CLOSING = []; S.L16COOL.clear();
    lv.L16_HANDED = lv.L16_DROP = lv.L16_UNN = lv.L16_BUSY = lv.L16_BYE = lv.L16_IDLEC = lv.L16_LIFEC = lv.L16_GWC = lv.L16_BACKOFF = lv.L16_DOORPEAK = lv.L16_ANSPEAK = lv.L16_EVILPEAK = 0;
    LSTAT.fill(0);
  };

  // C++: mesh_link.inc:linkApply
  function linkApply(v) {
    const Lp = ph.linkFind(v.a, v.b); if (!Lp && v.kind !== E.EV_RADIOEND) return;
    switch (v.kind) {
      case E.EV_DIAL: {
        const L = Lp; if (L.epoch !== v.epoch || L.state !== LK_DIALING) return;
        if (ph.pathOk(v.a, v.b)) { ph.linkOpenNow(L, v.a, v.b); return; }
        if (T() - L.dialAt < LINK_DIAL_FAIL) { levPush(T() + 1, E.EV_DIAL, v.a, v.b, v.epoch, 'dial'); return; }
        if (!fab.X.grpReach(v.a, v.b)) l1341Note(v.a, v.b);
        if (v.a < lv.nextId && alive[v.a]) seats[v.a].dials.holdLost(v.b, seats[v.a].TICK);
        L.state = LK_CLOSED; L.epoch++; L.q = []; LSTAT[2]++;
        { if (v.a < lv.nextId) seats[v.a].dials.failed(v.b, seats[v.a].TICK, true); if (v.b < lv.nextId) seats[v.b].dials.failed(v.a, seats[v.b].TICK, true); }
        for (let k = 0; k < 2; k++) if (L.view[k] === LK_DIALING || L.view[k] === LK_NONE) L.view[k] = LK_CLOSED;
        return;
      }
      case E.EV_DOWN: {
        const L = Lp;
        if (v.why === 'unneeded' && !L.agreed[lEnd(v.a, v.b)]) l374Resend(v.a, v.b, L);
        if (L.openEp > v.epoch) return;
        const e = v.a, x = v.b; if (L.view[lEnd(e, x)] !== LK_DIALING) L.view[lEnd(e, x)] = LK_CLOSED;
        if (L.callClosed && L.state === LK_CLOSED) { L.gone |= (1 << lEnd(e, x)); if (L.view[0] === LK_CLOSED && L.view[1] === LK_CLOSED) linkErase(v.a, v.b); return; }
        if (e >= lv.nextId || !alive[e]) return;
        if (L.agreed[lEnd(e, x)]) {
          L.agreed[lEnd(e, x)] = false; L.closingAt[lEnd(e, x)] = -1; const h = L.hold[lEnd(e, x)];
          if (h.length && L.state === LK_CLOSED && e < lv.nextId && alive[e] && x < lv.nextId && alive[x]) {
            const q = h; L.hold[lEnd(e, x)] = []; L.callClosed = false; ph.startDial(e, x, L); L.dialT = fab.mtI(q[0].t);
            for (const f of q) if (L.q.length < LINK_QCAP) L.q.push(f);
            trace('L22-REDIAL', e, null, 'peer=%d held=%zu why=%s', x, q.length, v.why);
          } else L.hold[lEnd(e, x)] = [];
        }
        if (v.why === 'unneeded') return;
        const dk = idPair(e, x); const it = TLDEB.get(dk);
        if (it !== undefined && T() - it < LINK_TL_DEBOUNCE) { LSTAT[5]++; return; }
        TLDEB.set(dk, T()); LSTAT[4]++;
        trace('LINK-DOWN', e, null, 'peer=%d why=%s', x, v.why);
        if (v.why === 'disconnected-persist' || v.why === 'failed-persist' || v.why === 'leave-close' || v.why === 'relay-leave') {
          const s = seats[e]; const crash = v.why === 'disconnected-persist' || v.why === 'failed-persist';
          s.l13DownAt.push(s.TICK); s.l13DownPeer.push(x); s.l13DownCrash.push(crash);
          if (s.l13DownAt.length > 32) { s.l13DownAt.shift(); s.l13DownPeer.shift(); s.l13DownCrash.shift(); }
          if (crash) s.l13CrashAt = T();
        }
        const hard = !(v.why === 'failed-persist' || v.why === 'disconnected-persist' || v.why === 'starve' || v.why === 'starve-dead');
        const m = msg.newMsg('TRANSLOST'); m.id = x; m.to = e; m.from = -1; m.hard = hard; m.pst = v.why === 'disconnected-persist' || v.why === 'failed-persist';
        fab.busPush(T(), m); return;
      }
      case E.EV_ICE: case E.EV_DISC: {
        const L = Lp; if (L.epoch !== v.epoch || L.state !== LK_OPEN || L.half === 0 || L.halfAt !== v.ref) return;
        LSTAT[7]++; L.state = LK_CLOSED; L.epoch++; L.q = []; L.half = 0; L.halfAt = -1;
        const at = v.kind === E.EV_ICE ? T() + LINK_FAILED_PERSIST : T(); const why = v.kind === E.EV_ICE ? 'failed-persist' : 'disconnected-persist';
        downAt(at, v.a, v.b, L.epoch, why); downAt(at, v.b, v.a, L.epoch, why); return;
      }
      case E.EV_DSMALL: {
        const L = Lp; if (L.epoch !== v.epoch || L.state !== LK_OPEN || L.half === 0 || L.halfAt !== v.ref) return;
        const l30End = (id) => id >= 0 && id < lv.nextId && alive[id] && !!seats[id] && seats[id].l30Small();
        const sa = l30End(v.a), sb = l30End(v.b); if (!sa && !sb) return;
        const hAt = L.halfAt; LSTAT[7]++; L.state = LK_CLOSED; L.epoch++; L.q = []; L.half = 0; L.halfAt = -1;
        downAt(sa ? T() : hAt + LINK_DISC_DEAD, v.a, v.b, L.epoch, 'disconnected-persist'); downAt(sb ? T() : hAt + LINK_DISC_DEAD, v.b, v.a, L.epoch, 'disconnected-persist'); return;
      }
      case E.EV_STARVE1: {
        const L = Lp; if (L.epoch !== v.epoch || L.state !== LK_OPEN || L.halfAt !== v.ref) return;
        const e = v.a, x = v.b; if (!(L.half & (1 << lEnd(x, e))) || (L.half & (1 << lEnd(e, x)))) return;
        if (L.txAt[lEnd(e, x)] < L.halfAt) return;
        LSTAT[6]++; ph.closeFrom(L, e, x, 'starve'); return;
      }
      case E.EV_FRESH: { const L = Lp; if (L.state !== LK_OPEN || L.half || L.epoch !== v.epoch) return; trace('FRESH-PC', v.a, null, 'peer=%d', v.b); L.epoch++; ph.linkOpenNow(L, v.a, v.b); return; }
      case E.EV_RADIOEND: {
        const id = v.a; const t = RADIO.get(id); if (t === undefined || t > T()) return; RADIO.delete(id);
        ph.lEnsure(id);
        for (const p of LINKPEERS[id]) { const L = ph.linkFind(id, p); if (!L || L.state !== LK_OPEN || L.half !== 3 || L.leverHalf || radioOff(p) || fab.isFrozen(id) || fab.isFrozen(p)) continue; L.half = 0; L.halfAt = -1; L.backAt[0] = L.backAt[1] = T(); }
        return;
      }
    }
  }
  const popDue = () => { let first = Infinity; for (const k of LEVQ.keys()) if (k < first) first = k; if (first > T()) return null; const evs = LEVQ.get(first); LEVQ.delete(first); return evs; };
  // C++: mesh_link.inc:linkTick
  ph.linkTick = () => {
    if (LPENDCLOSE.length) { const v = LPENDCLOSE; LPENDCLOSE = []; for (const id of v) ph.linkCloseAll(id, false, 'leave-close'); }
    if (S.DOOR_PEND.length) {
      const keep = [];
      for (const pr of S.DOOR_PEND) {
        const a = pr.a, b = pr.b; if (a >= lv.nextId || b >= lv.nextId || !alive[a] || !alive[b]) continue;
        const L = ph.linkGet(a, b); if (L.state === LK_DIALING || L.state === LK_OPEN) continue;
        if (L.q.length === 0) continue; if (T() - pr.at > 8) { lv.L16_PENDDROP++; L.q = []; continue; }
        if ((a < S.DOORN.length && S.DOORN[a] >= pc.pcBudget(a, E.PB_DOORS)) || pc.l1610Full(a)) { keep.push(pr); continue; }
        if (pc.l16Mobile(a) && !pc.l16MobBudget(a)) { keep.push(pr); continue; }
        ph.startDial(a, b, L); L.dialT = fab.mtI(L.q[0].t); L.dialHow = 3; LTX[a] = T();
      }
      S.DOOR_PEND = keep;
    }
    if (S.LDOORS.size) pc.l15Doors();
    pc.l16Doors();
    pc.l22Tick();
    for (let evs = popDue(); evs; evs = popDue()) for (const v of evs) linkApply(v);
    const n = Math.min(lv.nextId, LINKPEERS.length);
    for (let id = 0; id < n; id++) {
      if (!alive[id] || LINKPEERS[id].length === 0 || !seats[id].hasCoord || fab.isFrozen(id)) continue;
      if (LRX[id] < 0 || T() - LRX[id] < LINK_STARVE || LTX[id] <= LRX[id]) continue;
      let any = false; const ps = LINKPEERS[id].slice();
      for (const p of ps) { const L = ph.linkFind(id, p); if (L && L.state === LK_OPEN && !L.carried) { any = true; ph.closeFrom(L, id, p, 'starve-dead'); } }
      if (any) LSTAT[6]++;
      LRX[id] = T();
    }
    { const evs = popDue(); if (evs) for (const v of evs) linkApply(v); }
  };
  ph.linkApply = linkApply; ph.levPush = levPush;
  return ph;
}

module.exports = { createPhys };
