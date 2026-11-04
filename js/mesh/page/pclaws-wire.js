/*
 * pclaws-wire.js: the pc-lifecycle laws (js/mesh/pclaws.js) on one page's real peer connections.
 *
 * pclaws.js holds the laws as the sim runs them, over one fabric that sees both ends of every link. A page sees one
 * end: its own. This file builds that one-end world for createPcLaws and replaces every law that reads both ends
 * ([fabric] in pclaws.js) with the same decision taken at my end, from my own state plus explicit frames:
 *   - the offer mark {s, up, mt, ck}: the dialler's seated flag and first frame, read by the callee's L23 / L16 gates
 *     (the sim reads the dialler's seat directly);
 *   - `pcbye {why}` on the ordered data channel before every deliberate close, so the far end reads NONE (an orderly
 *     hang-up), never a loss;
 *   - UPOFFER and the L14 decline (BUSY tag 14 with referrals) ride the data channel;
 *   - an L16 or L23 refusal of an offer goes back over the relay (io.refuse: the `busy` type) and the page closes the pc.
 * Ids are the seat's ints (the adapter's peer-id table). One instance per page; `me` is my seat id.
 * The page plumbing (io) owns the pcs; this file never touches one and never decides who is gone.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const C_ = req('../consts.js', 'meshConsts');
  const msg = req('../msg.js', 'meshMsg');
  const hash = req('../hash.js', 'meshHash');
  const seatM = req('../seat.js', 'meshSeat');
  const PCL = req('../pclaws.js', 'meshPcLaws');

  const K = C_.consts, E = C_.enums;
  const { LK_NONE, LK_DIALING, LK_OPEN, LK_CLOSED, LS_NONE, LS_OPEN } = E;
  const { lEnd, newLink } = PCL;
  const MT_INDEX = new Map(msg.MT_NAMES.map((n, i) => [n, i]));
  const mtI = (t) => MT_INDEX.get(t);
  const BYE = Object.freeze(['unneeded', 'door', 'handed', 'kick', 'declined', 'leave', 'call']);
  // the sim's downAt reasons a deliberate close of mine gives the far end, as the goodbye's why
  const BYE_OF = { 'unneeded': 'unneeded', 'door-close': 'door', 'declined': 'declined', 'voted-off': 'kick', 'leave-close': 'leave' };
  const HARD = (why) => !(why === 'failed-persist' || why === 'disconnected-persist' || why === 'starve' || why === 'starve-dead');

  const NOWHERE = Object.freeze({ pc: 0x7ffffff, r: 0, i: 0 });
  function create(o) {
    const me = o.me, io = o.io, w = o.w;
    const T = () => w.TICK;
    const mySeat = () => o.seat();
    const trace = (...a) => { if (o.trace) o.trace(...a); };
    // my world's levers: the seat's, with the link model on; ids are bounded by the page's table, not a count
    const lv = Object.create(w.lv); lv.LINKMODEL = 1; lv.nextId = 2 ** 52; lv.NETGRP = 0;

    // ---- what my end knows of the far seats (only from frames: the offer mark, a door frame's dsat, my own view) ----
    const FAR = new Map();   // x -> {seated, tier}
    const far = (x) => { let f = FAR.get(x); if (!f) { f = { seated: -1, tier: 0 }; FAR.set(x, f); } return f; };
    function farSeated(x) {
      const f = FAR.get(x); if (f && f.seated >= 0) return f.seated === 1;
      const s = mySeat(); return !!s && !!pc.fns.l18Cell(me, x);
    }
    // A dialler's word that it sits (mark s, frame dsat) counts only where my view holds its cell: the sim reads its true seat, and a door has limits. Unseated, I have no view and no door to guard.
    const seatedWord = (x) => !mySeated() || !!pc.fns.l18Cell(me, x);
    // A far seat counts as placed only where my view holds its cell (laws such as l18Route read b.coord). At my offer
    // gate the dialler's own mark says it is seated: l23Refused reads only that (hasCoord/state), never the cell.
    let offering = -1;
    function farView(x) {
      const s = mySeat(); const c = s && farSeated(x) ? pc.fns.l18Cell(me, x) : null;
      const seated = !!c || (x === offering && farSeated(x));
      return { hasCoord: seated, state: seated ? 3 : 0, ctier: far(x).tier, coord: c || (seated ? NOWHERE : null), evilDoor: false };
    }
    const seats = new Proxy([], { get(t, k) { if (typeof k === 'string' && /^\d+$/.test(k)) { const x = +k; return x === me ? mySeat() : farView(x); } return t[k]; } });
    const alive = new Proxy([], { get(t, k) { if (typeof k === 'string' && /^\d+$/.test(k)) { const x = +k; if (x !== me) return true; const s = mySeat(); return !!s && !s.dead; } return t[k]; } });

    // ---- my links: one record per peer, my end's ------------------------------------------------------------
    const LINKS = new Map();   // x -> Link (pclaws.js newLink); keyed by the peer, not by the pair
    const LINKPEERS = [];      // LINKPEERS[me] = the peers I hold a record for
    const pairKey = (a, b) => hash.idPair(Math.min(a, b), Math.max(a, b));
    const other = (a, b) => (a === me ? b : (b === me ? a : -1));
    // ids reach 2^21: every per-id table is sparse, with only my own slot (pclaws.js indexes them by id)
    const S = { DOORN: [], DOORK: [], DOOR_PEND: [] }; S.DOORN[me] = 0; S.DOORK[me] = 0;
    { const pend = { 0: 0, fill() { pend[me] = 0; return pend; }, push() { return me + 1; } }; pend[me] = 0; Object.defineProperty(pend, 'length', { get: () => me + 1 }); S.L23PEND = pend; }
    const TLDEB = new Map();
    const lEnsure = () => { if (!LINKPEERS[me]) LINKPEERS[me] = []; };
    function linkFind(a, b) { const x = other(a, b); return x < 0 ? null : (LINKS.get(x) || null); }
    function linkGet(a, b) {
      const x = other(a, b); if (x < 0) throw new Error('pclaws-wire: a link without my end');
      let L = LINKS.get(x); if (!L) { L = newLink(); LINKS.set(x, L); lEnsure(); LINKPEERS[me].push(x); }
      return L;
    }
    function dropLink(x) { LINKS.delete(x); lEnsure(); const a = LINKPEERS[me]; const i = a.indexOf(x); if (i >= 0) a.splice(i, 1); }
    const mine = (x) => lEnd(me, x), theirs = (x) => lEnd(x, me);
    const mySeated = () => { const s = mySeat(); return !!s && s.hasCoord && s.state === 3; };
    function doorCount(g, dIn, d) { if (g !== me) return; S.DOORN[me] += d; if (!dIn) S.DOORK[me] += d; if (S.DOORN[me] < 0) S.DOORN[me] = 0; if (S.DOORK[me] < 0) S.DOORK[me] = 0; }

    // a door's own fields (sim startDial), at either end: o = the outside bits, a = the dialler
    function doorInit(L, a, b, o) {
      L.outside = o; if (!o) return;
      L.dBorn = L.dProg = T(); L.dAsked = L.dHomed = L.dGw = L.dSat = false; L.dHoAt = -1; L.dWait = -1; L.dOwed = false; L.dWaitAtFind = -1; L.dOwedAt = -1; L.dHeard = 0; L.dIn = !(o & (1 << lEnd(a, b)));
      if (o !== 3) { const g = (o & (1 << lEnd(a, b))) ? b : a; L.dG = g; doorCount(g, L.dIn, +1); }
    }
    function doorEndCount(L) { if (L.outside && L.outside !== 3 && L.dG === me && !L.dUncounted) { L.dUncounted = true; doorCount(me, L.dIn, -1); } }
    function freshState(L, a, b) {
      L.nnAt[0] = L.nnAt[1] = -1;
      L.state = LK_DIALING; L.epoch = (L.epoch + 1) >>> 0; L.dialAt = T(); L.half = 0; L.halfAt = -1; L.stuck = false; L.backAt[0] = L.backAt[1] = -1;
      L.view[mine(other(a, b))] = LK_DIALING; L.dialBy = a; L.callClosed = false; L.gone = 0; L.uplink = false; L.dialT = -1; L.dialHow = 0;
      L.byeIn = L.byeOut = false; L.dUncounted = false; L.dG = -1; L.opened = false;
    }
    // C++: mesh_link.inc:startDial   [my end dials x; the far end's outside bit is what my view knows]
    function startDial(a, b, L) {
      const x = other(a, b); let oo = 0;
      if (!mySeated()) oo |= (1 << mine(x)); if (!farSeated(x)) oo |= (1 << theirs(x));
      freshState(L, a, b); doorInit(L, a, b, oo);
      if (!oo) l1611Mine(x, L);
      io.dial(x, mark(x));
    }
    let upNext = -1;
    function mark(x) {
      const L = LINKS.get(x); const q0 = L && L.q.length ? L.q[0] : null;
      return { s: mySeated() ? 1 : 0, up: (L && L.uplink) || upNext === x ? 1 : 0, mt: q0 ? q0.t : null, ck: q0 && (q0.t === 'HELLO' || q0.t === 'CLAIM' || (q0.t === 'CHALLENGE' && q0.tag === 25)) ? q0.ck : 0, tier: mySeat() ? mySeat().ctier : 0 };
    }

    // door progress (sim linkDeliver), run by each end for the frames it sends and the frames it receives
    function doorProg(L, t) {
      if (!(L.outside && L.dBorn >= 0)) return;
      if (t === 'WHOHOME') { if (!L.dAsked) { L.dAsked = true; L.dProg = T(); } }
      else if (t === 'HOME') { if (!L.dHomed) { L.dHomed = true; L.dProg = T(); } }
      else if (t === 'FIND' || t === 'FINDACK' || t === 'PLACE' || t === 'NOROOM' || t === 'HANDOFF' || t === 'TAKEOVER' || t === 'TAKEN') {
        L.dProg = T(); L.dGw = true; if (t === 'FIND') L.dWaitAtFind = L.dWait; if (t === 'FINDACK') L.dWait = T(); else if (t === 'PLACE' || t === 'NOROOM') { L.dWait = -1; L.dOwed = false; }
      }
    }
    // C++: mesh_link.inc:linkDeliver   [my end sends on the open dc]
    function linkDeliver(from, to, m, L) {
      L.carried = true; L.txAt[mine(to)] = T();
      if (L.outside) m.dsat = mySeated();
      doorProg(L, m.t);
      m.to = to; m.from = from; m.lk = (m.rvia < 0) ? from : -1; m.lkEp = L.epoch;
      if (!io.send(to, m)) trace('PCW-SENDFAIL', me, null, 'peer=%d mt=%d', to, mtI(m.t));
    }
    // C++: mesh_link.inc:linkSchedule   [my end: the far end's L23 / L16 gates run at its offer, from my mark]
    function linkSchedule(from, to, m) {
      const s = mySeat(); if (!s) return;
      if (seatM.roomTerm(s, -1) && seatM.l13Frame(m)) pc.noteCall(from, to);
      const L = linkGet(from, to); const e = mine(to);
      switch (L.state) {
        case LK_NONE:
          if (pc.dialHeld(from, to)) return;
          if (mySeated()) { lv.L16_DEFER = false; if (pc.l16Refuse(from, to, m.t)) { if (lv.L16_DEFER) { lv.L16_DEFER = false; deferDoor(from, to, m, L); } return; } }
          m.from = from; m.to = to; L.q.push(m); startDial(from, to, L); L.dialT = mtI(m.t); return;
        case LK_DIALING:
          if (L.dialT < 0) L.dialT = mtI(m.t); m.from = from; m.to = to; if (L.q.length < K.LINK_QCAP) L.q.push(m); return;
        case LK_CLOSED:
          if (L.view[e] !== LK_CLOSED && L.view[e] !== LK_NONE) return;
          if ((!namesOwned(from, to) || m.gwc) && T() - L.askAt >= K.LINK_ASK_GAP && !pc.dialHeld(from, to)) {
            if (mySeated()) { lv.L16_DEFER = false; if (pc.l16Refuse(from, to, m.t)) { if (lv.L16_DEFER) { lv.L16_DEFER = false; deferDoor(from, to, m, L); } return; } }
            L.askAt = T(); m.from = from; m.to = to; L.q.push(m); startDial(from, to, L); L.dialT = mtI(m.t); L.dialHow = 3;
          }
          return;
        default:
          if (L.agreed[e] && m.t !== 'UNNEEDED') { if (L.hold[e].length < K.LINK_QCAP) { m.from = from; m.to = to; L.hold[e].push(m); } return; }
          linkDeliver(from, to, m, L);
      }
    }
    const namesOwned = (a, b) => { const s = mySeat(); return !!s && s.hasCoord && !!s.linkRole(b, E.LR_OWNED); };
    function deferDoor(from, to, m, L) {
      m.from = from; m.to = to; if (L.q.length < K.LINK_QCAP) L.q.push(m);
      if (!S.DOOR_PEND.some((p) => p.b === to)) S.DOOR_PEND.push({ a: from, b: to, at: T() });
    }

    // ---- closes ------------------------------------------------------------------------------------------------
    // the goodbye, then my end closes: the last frame on the ordered dc before a deliberate close
    function bye(x, why, L) {
      if (L && L.byeWhy) { why = L.byeWhy; L.byeWhy = null; }   // a DOOR-LIMIT hand-off names itself
      if (L) { L.byeOut = true; doorEndCount(L); }
      trace('PC-BYE', me, null, 'peer=%d why=%s', x, why);
      if (io.bye) { io.bye(x, L && L.opened ? why : null); return; }   // the page seam: goodbye (when the dc opened) then close
      if (L && L.opened) io.send(x, { t: 'pcbye', why });
      io.close(x);
    }
    // C++: mesh_link.inc:downAt   [the page has no event queue: the far end's down is my goodbye; my own end's down is a loss]
    function downAt(at, e, x, ep, why) {
      void at; void ep;
      if (e !== me) { const L = LINKS.get(e); bye(e, BYE_OF[why] || 'call', L); return; }
      lostNow(x, why, true);
    }
    // C++: mesh_link.inc:closeBoth   [my end of a deliberate close of both ends]
    function closeBoth(L, a, b, fail, why) {
      const x = other(a, b); if (L.state !== LK_OPEN && L.state !== LK_DIALING) return;
      L.state = LK_CLOSED; L.epoch = (L.epoch + 1) >>> 0; L.q = []; L.half = 0; L.halfAt = -1; L.view[mine(x)] = LK_CLOSED; L.gone |= (1 << mine(x)); L.callClosed = true;
      bye(x, BYE_OF[why] || why, L);
    }
    // C++: mesh_link.inc:closeFrom   [my end closes and hears its own close: kick]
    function closeFrom(L, e, x, why) {
      if (L.state !== LK_OPEN) return;
      L.state = LK_CLOSED; L.epoch = (L.epoch + 1) >>> 0; L.q = []; L.half = 0; L.halfAt = -1;
      bye(x, BYE_OF[why] || why, L); lostNow(x, why, true);
    }
    // C++: mesh_link.inc:linkApply EV_DOWN   [my end saw its pc end; why without a goodbye is a loss]
    function lostNow(x, why, own) {
      const L = LINKS.get(x); if (!L) return; const e = mine(x);
      if (L.view[e] !== LK_DIALING) L.view[e] = LK_CLOSED;
      if (L.state === LK_OPEN || L.state === LK_DIALING) { L.state = LK_CLOSED; L.epoch = (L.epoch + 1) >>> 0; L.q = []; L.half = 0; L.halfAt = -1; }
      doorEndCount(L);
      const s = mySeat(); if (!s || s.dead) return;
      if (L.agreed[e]) {
        L.agreed[e] = false; L.closingAt[e] = -1; const h = L.hold[e];
        if (h.length && L.state === LK_CLOSED) { const q = h.slice(); h.length = 0; L.callClosed = false; startDial(me, x, L); L.dialT = mtI(q[0].t); for (const f of q) if (L.q.length < K.LINK_QCAP) L.q.push(f); trace('L22-REDIAL', me, null, 'peer=%d held=%zu why=%s', x, q.length, why); }
        else h.length = 0;
      }
      if (why === 'unneeded') return;
      const dk = x; const it = TLDEB.get(dk);
      if (it !== undefined && T() - it < K.LINK_TL_DEBOUNCE) return;
      TLDEB.set(dk, T());
      trace('LINK-DOWN', me, null, 'peer=%d why=%s', x, why);
      if (why === 'disconnected-persist' || why === 'failed-persist' || why === 'leave-close') {
        s.l13DownAt.push(s.TICK); s.l13DownPeer.push(x); s.l13DownCrash.push(why === 'disconnected-persist' || why === 'failed-persist' ? 1 : 0);
        if (s.l13DownAt.length > 32) { s.l13DownAt.shift(); s.l13DownPeer.shift(); s.l13DownCrash.shift(); }
        if (why === 'disconnected-persist' || why === 'failed-persist') s.l13CrashAt = T();
      }
      const m = msg.newMsg('TRANSLOST'); m.id = x; m.to = me; m.from = -1; m.hard = HARD(why); m.pst = why === 'disconnected-persist' || why === 'failed-persist';
      io.deliver(m); void own;
    }

    // ---- the pc world for createPcLaws ---------------------------------------------------------------------------
    const phys = {
      linkFind, linkGet, lEnsure, startDial, linkDeliver, linkSchedule, closeBoth, closeFrom, downAt,
      pathOk: () => true, ldraw: (lo) => lo,
    };
    const P = {
      w, lv, seats, alive, isFrozen: () => false, radioOff: () => false, trace,
      busPush: (due, m) => busPush(m), schedL10, wireTx: () => {}, pairKey, grpReach: () => true,
      l392Contest: (a, b, mt, ck) => (o.l392Contest ? o.l392Contest(a, b, mt, ck) : false), relayMeter: () => {},
      fhopActive: () => false, FH: [], fhopFriendFor: () => false,
      phys, S, LINKS: new Map(), LINKPEERS,
    };
    // a frame the laws post to the bus: to me, it is a frame for my seat; to x, it rides my dc to x
    let refusing = -1, refusedBusy = false;
    function busPush(m) {
      if (m.to === me) { io.deliver(m); return; }
      if (m.t === 'BUSY' && m.to === refusing) { refusedBusy = true; return; }   // an L16 refusal at my offer gate: no pc
      const L = LINKS.get(m.to); if (!L) return;
      if (L.state === LK_OPEN) linkDeliver(me, m.to, m, L); else if (L.state === LK_DIALING && L.q.length < K.LINK_QCAP) { m.from = me; L.q.push(m); }
    }
    // C++: mesh.cpp:schedL10   [an early frame rides an open link only]
    function schedL10(from, to, m) { const L = LINKS.get(to); if (!L || L.state !== LK_OPEN) return; linkDeliver(from, to, m, L); }

    const pc = PCL.createPcLaws(P);
    const F = pc.fns;

    // ---- the seat's dials, my end ([end] in pclaws.js, minus the far end's L23 read: the far page refuses at its offer) ----
    // C++: mesh_link.inc:fabricDial
    function fabricDial(a, x) {
      if (a !== me || x < 0 || x === me) return;
      if (pc.dialHeld(me, x)) return; if (pc.l18NoDial(me, x)) return;
      pc.noteCall(me, x); pc.l23MakeRoom(me, x);
      const L = linkGet(me, x); if (L.state === LK_NONE || L.state === LK_CLOSED) { startDial(me, x, L); L.dialHow = 1; }
    }
    // C++: mesh_link.inc:fabricDialJoin
    function fabricDialJoin(a, x) {
      if (a !== me || x < 0 || x === me) return;
      if (pc.l18NoDial(me, x)) return; if (pc.dialHeld(me, x)) return;
      pc.noteCall(me, x); pc.l23MakeRoom(me, x);
      const L = linkGet(me, x); if (L.state === LK_NONE || L.state === LK_CLOSED) { startDial(me, x, L); L.dialHow = 2; } else if (L.state === LK_DIALING) L.view[mine(x)] = LK_DIALING;
    }
    // C++: mesh_link.inc:fabricDialUplink   [UPOFFER rides the dc as its first frame]
    function fabricDialUplink(a, x, refer) {
      void refer; if (a !== me || x < 0 || x === me) return false;
      const L0 = LINKS.get(x); const had = !!L0 && (L0.state === LK_OPEN || L0.state === LK_DIALING);
      upNext = x; try { fabricDialJoin(me, x); } finally { upNext = -1; } const L = LINKS.get(x); if (L && L.state === LK_DIALING) L.uplink = true;
      if (L && (L.state === LK_OPEN || L.state === LK_DIALING)) { const u = msg.newMsg('UPOFFER'); u.id = me; u.tag = had ? 1 : 0; u.to = x; u.from = me; u.lk = -1; busPush(u); }
      return true;
    }
    // C++: mesh_link.inc:fabricUpDecline   [the decline and its referrals go first, then the goodbye]
    function fabricUpDecline(a, h, refer) {
      if (a !== me || h < 0 || h === me) return;
      const d = msg.newMsg('BUSY'); d.tag = 14; d.id = me; d.from = me; d.to = h; d.lk = -1; d.list = refer.slice(); busPush(d);
      const L = LINKS.get(h); if (L && (L.state === LK_DIALING || L.state === LK_OPEN)) closeBoth(L, me, h, false, 'declined');
    }
    // C++: mesh.cpp:fabricKickClose
    function fabricKickClose(a, x) { if (a !== me || x < 0 || x === me) return; const L = LINKS.get(x); if (L && L.state === LK_OPEN) closeFrom(L, me, x, 'voted-off'); }
    // C++: mesh_link.inc:fabricOpenPeers
    function fabricOpenPeers(a) { const out = []; if (a !== me) return out; for (const [x, L] of LINKS) if (L.state === LK_OPEN && F.fabricLinkState(a, x) === LS_OPEN) out.push(x); return out; }
    // C++: mesh.cpp:fabricLinkOpen
    function fabricLinkOpen(a, x) { return F.fabricLinkState(a, x) === LS_OPEN; }
    // C++: mesh_link.inc:fabricDoorDrop   [pclaws.js's, then my goodbye: l16Close's far down]
    function fabricDoorDrop(a, x) {
      if (a !== me) return; const L = LINKS.get(x); const dialling = !!L && L.state === LK_DIALING;
      F.fabricDoorDrop(a, x); if (dialling && L.state !== LK_DIALING) bye(x, 'door', L);
    }

    // ---- the [fabric] halves, my end only ------------------------------------------------------------------------
    // C++: mesh_rcfollow_fab.inc:l1611Guard   [x = me: I close one of my own doors when a new pc would pass my S1 budget]
    function l1611Mine(y, L) {
      const s = mySeat(); if (!s || !(s.hasCoord && s.state === 3 && s.coord.pc === 0)) return;
      const h = pc.l1610Held(me); let n = h.n;
      if (L && (L.state === LK_OPEN || L.state === LK_DIALING || L.view[mine(y)] === LK_OPEN)) n--;
      if (n + 1 <= pc.pcBudget(me, E.PB_S1)) return;
      let best = null, bestK = -1, bestRank = -1, bestIdle = -1;
      for (const p of LINKPEERS[me] || []) {
        if (p === y) continue; const D = LINKS.get(p); if (!D || !D.outside || D.outside === 3 || (D.state !== LK_OPEN && D.state !== LK_DIALING)) continue;
        if (!(D.outside & (1 << theirs(p)))) continue; if (pc.l15Names(me, p)) continue;
        const rank = pc.doorHeard(D, me, p) ? 1 : 0; const idle = T() - D.dProg;
        if (rank > bestRank || (rank === bestRank && (idle > bestIdle || (idle === bestIdle && p < bestK)))) { best = D; bestK = p; bestRank = rank; bestIdle = idle; }
      }
      if (!best) return;
      lv.L1611_SHED = (lv.L1611_SHED || 0) + 1; trace('L16.11-SHED', me, null, 'peer=%d for=%d pcs=%d sat=%d idle=%lld', bestK, y, n, bestRank, bestIdle);
      closeDoor(best, bestK);
    }
    // C++: mesh_link.inc:l16Close   [an open door's far down is my goodbye (downAt); a dialling one only closes my pc]
    function closeDoor(L, x) { const dialling = L.state === LK_DIALING; pc.l16Close(L, me, x); if (dialling) bye(x, 'door', L); }
    // C++: mesh_link.inc:l15Doors   [k = me: my door closes once I sit and my seat no longer needs it]
    function l15Mine() {
      for (const x of [...LINKS.keys()].sort((a, b) => a - b)) {
        const L = LINKS.get(x); if (!L.outside || L.state !== LK_OPEN || L.half) continue;
        if (!(L.outside & (1 << mine(x))) || !pc.l15Seated(me)) continue;
        if ((L.outside & (1 << theirs(x))) && !pc.doorHeard(L, me, x)) continue;
        if (pc.l15Names(me, x) || pc.l15NamedBy(me, x)) continue;
        { let other = false; for (const [p, O] of LINKS) if (p !== x && O.state === LK_OPEN) { other = true; break; } if (!other) continue; }   // my only channel carries the setup of my first link
        if (L.backAt[mine(x)] >= 0 && T() - L.backAt[mine(x)] < K.L15_BACK_HOLD) continue;
        L.state = LK_CLOSED; L.epoch = (L.epoch + 1) >>> 0; L.q = []; L.half = 0; L.halfAt = -1; L.view[mine(x)] = LK_CLOSED;
        trace('DOOR-CLOSE', me, null, 'peer=%d', x); lv.L15_CLOSED = (lv.L15_CLOSED || 0) + 1;
        bye(x, 'door', L); L.outside = 0;
      }
    }
    const DOOR_FIRST_FRAME = 4;   // ticks a just-opened door waits for the frame that dialled it (L16_ANS_IDLE)
    // C++: mesh_link.inc:l16Doors   [g = me: my doors' limits and my count; the joiner end marks its door seated]
    function l16Mine() {
      S.DOORN[me] = 0; S.DOORK[me] = 0;
      for (const x of [...LINKS.keys()].sort((a, b) => a - b)) {
        const L = LINKS.get(x); if (!L.outside || L.outside === 3 || (L.state !== LK_OPEN && L.state !== LK_DIALING)) continue;
        const kMe = !!(L.outside & (1 << mine(x)));
        if (kMe) { if (mySeated()) L.dSat = true; continue; }   // I am the outside end: the greeter's limits are its own
        if (farSeated(x)) L.dSat = true;
        const heard = pc.doorHeard(L, me, x); const named = pc.l15Names(me, x) || pc.l15NamedBy(me, x) || (!!mySeat() && (mySeat().l14Serve(x) || mySeat().l14Up === x));   // L14: my uplink, or one I took, is no door (in the sim both ends are seated); my view need not hold the head's cell
        if (!heard && !named && L.dBorn >= 0) {
          const idle = T() - L.dProg, age = T() - L.dBorn; let why = null;
          if (L.dHoAt >= 0 && T() - L.dHoAt >= K.L16_HO_CLOSE && !(L.dOwed && L.dWait >= 0)) why = 'handed';
          else if (L.dGw && !L.dIn) { if (idle > K.L16_GW_IDLE && !(L.dWait >= 0)) why = 'gw-idle'; else if (age > K.L16_GW_LIFE) why = 'gw-life'; }
          else if (L.dIn && L.state === LK_OPEN && !L.dAsked && L.dProg === L.dBorn) { if (age > DOOR_FIRST_FRAME) why = 'unnamed'; }   // the sim delivers the dial's queued frame with the open; here it follows the dc's open over the verify chain
          else if (L.dIn && !L.dAsked && L.state === LK_OPEN && idle > K.L16_ANS_IDLE) why = 'idle';
          else if (idle > K.L16_IDLE) why = 'idle'; else if (age > K.L16_LIFE) why = 'life';
          if (why) {
            const c0 = why[0];
            trace('DOOR-LIMIT', me, null, 'peer=%d why=%s age=%lld idle=%lld', x, why, age, idle);
            L.byeWhy = c0 === 'h' ? 'handed' : 'door';
            closeDoor(L, x);
            if (c0 !== 'u' && c0 !== 'h') { const k = hash.idPair(me, x); const c = pc.S.L16COOL.get(k) || [0, 0]; c[1]++; c[0] = T() + K.L16_COOL * (1 << Math.min(c[1] - 1, 4)); pc.S.L16COOL.set(k, c); }
            continue;
          }
        }
        if (!heard && !named) { S.DOORN[me]++; if (!L.dIn) S.DOORK[me]++; }
      }
    }
    // C++: mesh_link.inc:l22Tick   [e = my end]
    function l22Mine() {
      const ask = [], close2 = [], alone = []; const aloneIdle = new Set();
      for (const x of [...LINKS.keys()].sort((a, b) => a - b)) {
        const L = LINKS.get(x); const e = mine(x);
        if (!L.agreed[e] || L.closingAt[e] < 0 || T() - L.closingAt[e] <= K.L22_CLOSE_WAIT) continue;
        const q = L.hold[e]; L.hold[e] = []; L.agreed[e] = false; L.closingAt[e] = -1;
        trace('L22-CLOSE-TIMEOUT', me, null, 'peer=%d held=%zu', x, q.length);
        if (L.state === LK_OPEN) F.l22Close(me, x);
        if (q.length > 0 && L.state === LK_CLOSED) { L.callClosed = false; startDial(me, x, L); L.dialT = mtI(q[0].t); for (const f of q) if (L.q.length < K.LINK_QCAP) L.q.push(f); trace('L22-REDIAL', me, null, 'peer=%d held=%zu why=timeout', x, q.length); }
      }
      const s = mySeat(); if (!s || s.dead) return;
      for (const x of [...LINKS.keys()].sort((a, b) => a - b)) {
        const L = LINKS.get(x); if ((L.state !== LK_OPEN && L.state !== LK_DIALING) || L.half) continue;
        const d = mine(x);
        if (L.outside && pc.doorEnd(L, me, x)) { L.nnAt[d] = -1; continue; }
        if (F.l22Need(me, x) || (s.hostile & E.H_HOLDS_)) { L.nnAt[d] = -1; continue; }
        if (L.nnAt[d] < 0) { L.nnAt[d] = T(); continue; }
        if (L.state === LK_OPEN && T() - L.nnAt[d] >= K.L23_BOUND && (T() - Math.max(L.txAt[theirs(x)], L.nnAt[d]) >= K.L23_BOUND || pc.l23Suspect(me, x) || T() - L.nnAt[d] >= K.L23_LONG)) {
          if (T() - Math.max(L.txAt[theirs(x)], L.nnAt[d]) >= K.L23_BOUND) aloneIdle.add(x); alone.push(x); continue;
        }
        if (L.state === LK_OPEN && T() - L.nnAt[d] >= K.L22_SETTLE && T() - L.farAsk[d] <= K.L222_FRESH && !L.agreed[d]) { L.farAsk[d] = -1000000; L.nnAsk[d] = T(); close2.push(x); continue; }
        if (L.state === LK_OPEN && T() - L.nnAt[d] >= K.L22_SETTLE && T() - L.nnAsk[d] >= K.L22_ASK && !L.agreed[d]) { L.nnAsk[d] = T(); ask.push(x); }
      }
      for (const x of close2) { trace('L22.2-CLOSE', me, null, 'peer=%d', x); F.l22CloseAsk(me, x); }
      for (const x of ask) { const m = msg.newMsg('UNNEEDED'); m.id = me; trace('L22-ASK', me, null, 'peer=%d', x); schedL10(me, x, m); }
      for (const x of alone) { const L = LINKS.get(x); const ee = mine(x); const asked = !!L && L.nnAsk[ee] >= 0 && L.nnAsk[ee] - L.nnAt[ee] >= K.L22_ASK && aloneIdle.has(x); pc.l23CloseAlone(me, x, asked); }
    }
    // C++: mesh_link.inc:linkTick DOOR_PEND   [my deferred doors dial once my count allows]
    function pendMine() {
      const keep = [];
      for (const pr of S.DOOR_PEND) {
        const L = linkGet(me, pr.b); if (L.state === LK_DIALING || L.state === LK_OPEN || L.q.length === 0) continue;
        if (T() - pr.at > 8) { lv.L16_PENDDROP = (lv.L16_PENDDROP || 0) + 1; L.q = []; continue; }
        if ((S.DOORN[me] || 0) >= pc.pcBudget(me, E.PB_DOORS) || pc.l1610Full(me)) { keep.push(pr); continue; }
        if (pc.l16Mobile(me) && !pc.l16MobBudget(me)) { keep.push(pr); continue; }
        startDial(me, pr.b, L); L.dialT = mtI(L.q[0].t); L.dialHow = 3;
      }
      S.DOOR_PEND = keep;
    }
    // a dial that never opened within LINK_DIAL_FAIL
    function dialTimeouts() {
      for (const [x, L] of LINKS) if (L.state === LK_DIALING && T() - L.dialAt >= K.LINK_DIAL_FAIL) { dialFailed(x); io.close(x); }
    }

    // ---- the page face -----------------------------------------------------------------------------------------
    function tick() {
      const s = mySeat(); if (!s || s.dead) return;
      dialTimeouts();
      if (S.DOOR_PEND.length) pendMine();
      l15Mine(); l16Mine(); l22Mine();
      pc.S.L16CLOSING.length = 0; pc.S.LDOORS.clear();   // the fabric door sweeps' lists: my end recounts each tick
    }
    // the callee's gate on an incoming offer: L23 (refused), L16 (busy over the relay); else my end starts DIALING
    function offer(x, mk) {
      mk = mk || {}; const s = mySeat(); if (!s || s.dead || x === me || x < 0) return false;
      const sat = mk.s && seatedWord(x) ? 1 : 0;
      const f = far(x); f.seated = sat; if (mk.tier) f.tier = mk.tier;
      const mt = mk.mt || null, ck = mk.ck || 0;
      // A mark that names no frame is gated as a call, the widest honest dial: no word, or silence, skips nothing.
      let l23r; offering = x; try { l23r = pc.l23Refused(me, x, mt || 'MEETACK', ck); } finally { offering = -1; }
      if (l23r) { trace('PC-REFUSE', me, null, 'peer=%d why=l23', x); io.refuse(x, { busy: 0 }); return false; }
      if (!sat) {   // L16: an outside knocker at my door (a seated dialler's own door count gated it at its end)
        refusing = x; refusedBusy = false; lv.L16_DEFER = false; let r;
        try { r = pc.l16Refuse(x, me, mt); } finally { refusing = -1; }
        lv.L16_DEFER = false;
        if (r) { trace('PC-REFUSE', me, null, 'peer=%d why=l16 busy=%d', x, refusedBusy ? 1 : 0); io.refuse(x, { busy: refusedBusy ? 1 : 0 }); return false; }
      }
      const L = linkGet(me, x);
      if (L.state === LK_OPEN) return true;   // a fresh offer over an open pc (ICE restart): the page's, no law change
      if (L.state !== LK_DIALING) {
        let oo = 0; if (!mySeated()) oo |= (1 << mine(x)); if (!sat) oo |= (1 << theirs(x));
        freshState(L, x, me); doorInit(L, x, me, oo); if (!oo) l1611Mine(x, L);
      }
      L.view[mine(x)] = LK_DIALING; if (mk.up) L.uplink = true;
      return true;
    }
    // the callee's answer mark reached my dial: its seated flag sets the far end's door bit (my view only guessed it)
    function answered(x, mk) {
      const L = LINKS.get(x); if (!L || !mk) return; const sat = mk.s && seatedWord(x) ? 1 : 0; const f = far(x); f.seated = sat; if (mk.tier) f.tier = mk.tier;
      if (L.state !== LK_DIALING && L.state !== LK_OPEN) return;
      const oo = (L.outside & (1 << mine(x))) | (sat ? 0 : (1 << theirs(x)));
      if (oo === L.outside) return;
      doorEndCount(L); L.dUncounted = false; L.dG = -1; doorInit(L, L.dialBy, L.dialBy === me ? x : me, oo);
    }
    // C++: mesh_link.inc:linkOpenNow   [my end]
    function opened(x) {
      const L = LINKS.get(x); if (!L || L.state === LK_OPEN) return;
      L.state = LK_OPEN; L.openEp = L.epoch; L.half = 0; L.halfAt = -1; L.stuck = false; L.view[0] = L.view[1] = LK_OPEN; L.opened = true;
      L.byeIn = L.byeOut = false; L.callClosed = false; L.gone = 0;   // a new pc: the last one's close says nothing about it
      if (L.outside && L.dBorn >= 0) L.dProg = T();
      const s = mySeat(); if (s) { s.dials.opened(x); for (const [ck, v] of s.l13SplitCell) if (v[0] === x) { trace('L13.41-JOINED', me, null, 'peer=%d', x); s.l13SplitCell.delete(ck); } }
      if (L.wasOpen) trace('LINK-UP', me, null, 'peer=%d', x); L.wasOpen = true;
      const q = L.q; L.q = [];
      if (s && q.some((m) => seatM.l13Frame(m)) && seatM.roomTerm(s, -1)) pc.noteCall(me, x);
      for (const m of q) linkDeliver(me, x, m, L);
    }
    // every verified dc frame from x, before the inbox: the goodbye is mine; the rest get my end's link stamp
    function frame(x, m, direct) {
      const L = LINKS.get(x);
      if (m && m.t === 'pcbye') { byeIn(x, BYE.includes(m.why) ? m.why : 'call'); return true; }
      if (!L) return false;
      // (A leaver's own goodbye is exempt: sent before its close, but the page's seal and signature checks can hand it over after the close is seen; the sim has no such gap.)
      if (!(m && m.t === 'LEAVE' && m.bye && m.id === x) && L.state !== LK_OPEN && L.wasOpen && (L.view[mine(x)] === LK_CLOSED || (L.gone & (1 << mine(x))))) { lv.CLOSEDROPS = (lv.CLOSEDROPS || 0) + 1; trace('CLOSEDROP', me, null, 'from=%d mt=%d', x, mtI(m.t)); return true; }
      doorProg(L, m.t);
      if (m.dsat && !seatedWord(x)) m.dsat = false;   // the mark's s by another name: K5 lifts a door's limits on it
      if (m.dsat !== undefined && L.outside) far(x).seated = m.dsat ? 1 : 0;
      // first-hand only off the sender's proven dc, on my Link, not routed (sim linkDeliver; 0.9.24 ingest)
      if (direct && (m.rvia === undefined || m.rvia < 0)) { L.txAt[theirs(x)] = T(); m.lk = x; m.lkEp = L.epoch; }
      return false;
    }
    // the far end hung up on purpose: NONE at my end, no loss
    function byeIn(x, why) {
      const L = LINKS.get(x); if (!L) return; const e = mine(x);
      trace('PC-BYE-IN', me, null, 'peer=%d why=%s', x, why);
      L.byeIn = true; doorEndCount(L);
      if (why === 'leave') { const s = mySeat(); if (s && !s.dead) s.l45Bye(x); }   // L45: the page's own word for the sim's leave-close
      if (L.state === LK_OPEN || L.state === LK_DIALING) { L.state = LK_CLOSED; L.epoch = (L.epoch + 1) >>> 0; L.q = []; L.half = 0; L.halfAt = -1; }
      L.view[e] = LK_CLOSED; L.gone |= (1 << e); L.callClosed = true; L.outside = 0;
      if (L.agreed[e]) {
        L.agreed[e] = false; L.closingAt[e] = -1; const h = L.hold[e];
        if (h.length) { const q = h.slice(); h.length = 0; L.callClosed = false; startDial(me, x, L); L.dialT = mtI(q[0].t); for (const f of q) if (L.q.length < K.LINK_QCAP) L.q.push(f); trace('L22-REDIAL', me, null, 'peer=%d held=%zu why=%s', x, q.length, why); return; }
      }
      io.close(x);
    }
    // the pc or dc died at my end; after a goodbye either way it is no loss
    function lost(x, why) {
      const L = LINKS.get(x); if (!L) return;
      if (L.byeIn || L.byeOut || (L.callClosed && (L.gone & (1 << mine(x))))) return;
      if (L.state === LK_DIALING && !L.opened) { dialFailed(x); return; }
      io.close(x, 'lost');   // one Link per pair, and a close is real: no open channel stays behind a closed Link. First, so a redial below finds no old channel
      lostNow(x, why || 'dc-close', false);
    }
    // the page closed this pc on its own, with its goodbye: an orderly close at my end too, no loss
    function pageClosed(x) {
      const L = LINKS.get(x); if (!L) return;
      if (L.state === LK_OPEN || L.state === LK_DIALING) { L.state = LK_CLOSED; L.epoch = (L.epoch + 1) >>> 0; L.q = []; L.half = 0; L.halfAt = -1; }
      L.byeOut = true; doorEndCount(L); L.view[mine(x)] = LK_CLOSED; L.gone |= (1 << mine(x)); L.callClosed = true; L.outside = 0;
      trace('PC-PAGECLOSE', me, null, 'peer=%d', x);
    }
    // C++: mesh_link.inc:linkApply EV_DIAL failure   [my end]
    function dialFailed(x) {
      const L = LINKS.get(x); if (!L || L.state !== LK_DIALING) return;
      const s = mySeat(); if (s) { if (L.dialBy === me) s.dials.holdLost(x, s.TICK); s.dials.failed(x, s.TICK, true); }
      L.state = LK_CLOSED; L.epoch = (L.epoch + 1) >>> 0; L.q = []; doorEndCount(L);
      if (L.view[mine(x)] === LK_DIALING || L.view[mine(x)] === LK_NONE) L.view[mine(x)] = LK_CLOSED;
      trace('PC-DIALFAIL', me, null, 'peer=%d', x);
    }
    // my offer came back refused: L16 busy -> BUSY for the seat; L23 -> my dial just ends (the sim drops it).
    // The callee's gate runs on the open dc, so my end may already read open: a refused dial never opened.
    function refused(x, info) {
      const L = LINKS.get(x);
      if (L && (L.state === LK_DIALING || L.state === LK_OPEN)) { L.state = LK_NONE; L.epoch = (L.epoch + 1) >>> 0; L.q = []; L.view[mine(x)] = LK_NONE; doorEndCount(L); io.close(x, 'refused'); }
      if (info && info.busy) { const b = msg.newMsg('BUSY'); b.id = x; b.from = -1; b.to = me; b.lk = -1; io.deliver(b); }
    }
    // the page's leave: a goodbye on every open pc (the seat's LEAVE went out before)
    function leaveAll() { for (const [x, L] of LINKS) if (L.state === LK_OPEN || L.state === LK_DIALING) { L.state = LK_CLOSED; L.view[mine(x)] = LK_CLOSED; L.gone |= (1 << mine(x)); bye(x, 'leave', L); } }

    const fns = Object.assign({}, F, {
      fabricDial, fabricDialJoin, fabricDialUplink, fabricUpDecline, fabricKickClose, fabricLinkOpen, fabricOpenPeers, fabricDoorDrop,
      fabricMyDoors: (a) => (a === me ? (S.DOORN[me] || 0) : 0), fabricMyKnocks: (a) => (a === me ? (S.DOORK[me] || 0) : 0),
      fabricL23Busy: (a, x) => (a === me ? F.fabricL23Busy(a, x) : false),
      l22Need: (a, x) => (a === me ? F.l22Need(a, x) : true),
    });
    delete fns.fabricNoSock;   // A1: the relay's bounce
    return {
      fns, lv, send: (x, m) => linkSchedule(me, x, m), tick, mark, offer, answered, opened, frame, lost,
      byeIn: (x, why) => byeIn(x, BYE.includes(why) ? why : 'call'), dialFailed, refused, leaveAll, pageClosed,
      busyFrom: (x) => refused(x, { busy: 1 }),
      link: (x) => LINKS.get(x) || null, dump: () => [...LINKS].map(([x, L]) => ({ x, state: L.state, view: L.view[mine(x)], outside: L.outside, gone: L.gone, q: L.q.length })),
      dialHeld: (x) => pc.dialHeld(me, x), laws: pc, BYE,
    };
  }

  const api = Object.freeze({ create, BYE });
  GifOS.meshPcWire = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
