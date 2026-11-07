/*
 * env.js: the ported seat's world on a real page (page adapter job A1).
 *
 * The seat (js/mesh/*.js) never touches a pc, a socket, a timer or the DOM. It sees only its world `w`
 * (seat.js THE SEAT'S WORLD): w.TICK, w.lv, w.f (the 54 FABRIC_CALLS), w.trace. This file builds that world over
 * the page: the 500 ms tick, the inbox, the wake flag, the relay (knock, unlist, busy, nosock), the path a frame
 * takes (the sim's fabricSend, from the sender's own view), and the hand-off to the page's pcs. The pc-lifecycle
 * laws on my end of each pc are pclaws-wire.js's (A2, GifOS.meshPcWire); the socket, signing, sealing and the
 * page's debug face are mesh-wire's (A3). This file decides nothing the laws decide.
 *
 * THE 54 CALLS (seat.js FABRIC_CALLS). Owner: A1 = here; A2 = pclaws-wire.js fns (merged over these at create);
 * meas = a measurement in the sim, a no-op here (a DEBUG trace line at most).
 *   call                 owner  page meaning
 *   fabricAdmitLog       meas   admit forensics
 *   fabricCallFrame      A2     L25 question over a pc dialled for it (A2 linkSchedule)
 *   fabricDial           A2     dial x (pclaws gates; io.dial -> o.pc.ensure)
 *   fabricDialFails      A2     the seat's own DialBook
 *   fabricDialJoin       A2     dial x or join its dial
 *   fabricDialUplink     A2     L14 uplink dial + UPOFFER on the dc
 *   fabricUpDecline      A2     L14 decline + referrals (BUSY tag 14 on the dc; over the relay: relayBusyList here)
 *   fabricUpTake         A2     far page's L14 budget, my end
 *   fabricDoorDrop       A2     pcbye{door} then close
 *   fabricDoorHanded     A2     L16.2/16.3 hand-off mark
 *   fabricDoors          A2     constant true (link model)
 *   fabricDupMint        meas   move count
 *   fabricFreeCells      A1     free cells in (pc, row) from MY view (the sim counts the truth: sim change 4.x)
 *   fabricKickClose      A2     L27 pcbye{kick} then close
 *   fabricL23Busy        A2     my pc budget
 *   fabricLeft           A1     leave: seat dead, A2.leaveAll() next tick, o.onLeft(false)
 *   fabricLieFor         A1     no lie (null)
 *   fabricLinkOpen       A2     my end reads OPEN
 *   fabricOpenPeers      A2     the seats on my open links
 *   fabricLinkState      A2     my end's view
 *   fabricMyDoors        A2     my door count
 *   fabricMyKnocks       A2     my knock count
 *   fabricMyNat          A1     o.measure.nat() (STUN probe; NAT_OPEN until known)
 *   fabricMyTier         A1     o.measure.tier() (UA class)
 *   fabricNoSock         A1     L33.11: arm; the relay's real {t:'nosock'} becomes BUSY{nosock} (either order)
 *   fabricNoteBackoff    meas   count
 *   fabricNoteReseat     meas   count
 *   fabricNoteRollback   meas   count
 *   fabricNoteSwap       meas   count
 *   fabricReloadBye      A1     as fabricLeft, pcs closed RELOAD_CLOSE_LAG ticks later, o.onLeft(true)
 *   fabricSend           A1     the sim's path choice from the sender's view (FARVIEW); link step -> A2.send
 *   fabricUnreachable    A1     the sim's typing: FH_ICE_N of my dials failed and both NAT kinds (mine, its status beat's) cannot meet
 *   fabricVerdict        A1     the seat's death verdicts (DEATH_WHY), drained by the page's departure intake
 *   fhopActive           A1     true where the page gave a friend-hop face (o.fhop), as the sim's LINKMODEL && FHOP_ON
 *   fhopFriendFor        A1     sponsorSend's friend rung would carry it (o.fhop.friendFor)
 *   l164Of               A1     LINKMODEL && !islandStand(s, IS_L164)
 *   l18Deliv             A2     L18 count
 *   l18Hop               A2     L18 next hop
 *   l18UxDeliv           meas   L18 measurement
 *   l222Note             A2     L22.2 far ask, my end
 *   l22Agree             A2     UNNEEDED tag 1 on the dc
 *   l22Close             A2     pcbye{unneeded} then close
 *   l22CloseAsk          A2     UNNEEDED tag 3 on the dc
 *   l22Need              A2     linkWhy, my end
 *   l22Quiet             A2     my end's quiet clock
 *   l28Reply             A2     L28 keep reply
 *   l915Note             A1     the L9.15 call-channel note (sender-side table)
 *   relayKnock           A1     o.relay.knock(null, blobOk); the reply becomes GREETERS
 *   relayUnlist          A1     o.relay.unlist() when l164Of(seat)
 *   descEnd              meas   descent instrument
 *   descNote             meas   descent instrument
 *   wake                 A1     the wake flag (the sim's active set)
 *   fabricAudit          A1     L27.9 audit frame: sent like any frame (the sim's schedule)
 *   fabricDoorHeard      A2     K5 door heard, my end
 *   g4Joined             no-op  L40 contest lever (sim only)
 * Seat methods used here: recv, tick, join, absence, route, strictNextHop, linkRole, linkPeers, socketed,
 * occGet, l13On, l13, state/hasCoord/coord/occ/live/farCk/farGw/clkHeld.
 *
 * IDS. The seat's ids are integers below 2^52 (exact in a JS number; pair keys are unpacked, hash.idPair, and an
 * id enters a hash as two 32-bit halves, hash.hmixId). ids() maps a page peer id to one: `k_<hex>` ids by their
 * first 52 bits (13 hex digits; string order = int order), any other id by two FNV-1a words. Two identities
 * share an int with odds ~N^2/2^53 (1e-8 at 10,000 people): not checked. Ints a frame names travel with a small
 * directory (dirFor / learnDir) so a page can dial a seat it only heard of; each entry is checked
 * (nid(peer) === int), so a directory cannot point an int at another peer.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const C_ = req('../consts.js', 'meshConsts');
  const msg = req('../msg.js', 'meshMsg');
  const topo = req('../topo.js', 'meshTopo');
  const fnv = req('../fnv.js', 'meshFnv');
  const fmt = req('../fmt.js', 'meshFmt');
  const seatM = req('../seat.js', 'meshSeat');
  const fhopM = req('../fhop.js', 'meshFhop');
  const shared = req('../shared.js', 'meshShared');
  const pcWireM = () => (isNode ? (GifOS.meshPcWire || tryReq('./pclaws-wire.js')) : GifOS.meshPcWire);
  function tryReq(f) { try { return require(f); } catch (e) { return null; } }
  const netM = () => GifOS.net || null;

  const K = C_.consts, E = C_.enums;
  const { ckey, ckPc, ckR, ownedLinks } = topo;
  const { LS_OPEN, LS_DIALING, LK_OPEN, LK_NONE, LK_DIALING } = E;
  const ID_BITS = 52, ID_MAX = 2 ** ID_BITS;
  const NOSOCK_WIN = 40;      // ticks: a relay nosock and the seat's ask (fabricNoSock) pair up within this window
  const REF_STALE = 20;       // ticks: an incomplete referral list over the relay is dropped after this
  const TRACE_RING = 20000;   // DEBUG trace lines kept per page
  // the page's death observations, as the sim's whys (hard: dc-close, pc-closed; the rest quiet)
  const WHY = {
    'close': 'dc-close', 'dc-close': 'dc-close', 'pc-closed': 'pc-closed',
    'failed-persist': 'failed-persist', 'disconnected-persist': 'disconnected-persist', 'starve': 'starve', 'starve-dead': 'starve', 'starve-noobj': 'starve',
    'dark': 'dark', 'wake-dead': 'dark',   // the sim's dark: a hard close, no persist flag
  };

  // ---- ids ----------------------------------------------------------------------------------------------------
  // a page peer id as the seat's int: a k_ identity's first 52 bits; any other id two FNV-1a words (20 + 32 bits)
  function nidOf(peer) {
    const p = String(peer);
    if (/^k_[0-9a-f]{13}/.test(p)) return parseInt(p.slice(2, 15), 16);
    return (fnv.str(p + '\u0001') >>> 12) * 4294967296 + fnv.str(p);
  }
  function ids() {
    const toPeer = new Map(), byPeer = new Map();
    const nid = nidOf;
    // learn a peer: its int (the first peer an int was learned for keeps it: two identities on one int is not handled)
    function learn(peer) {
      if (peer == null || peer === '') return -1;
      const p = String(peer); const c = byPeer.get(p); if (c !== undefined) return c;
      const n = nid(p); if (!toPeer.has(n)) toPeer.set(n, p);
      byPeer.set(p, n); return n;
    }
    const pid = (n) => (toPeer.has(n) ? toPeer.get(n) : null);
    return { nid, pid, learn, size: () => toPeer.size };
  }

  // the page's DEBUG switch, read as run.html reads it (DEBUG_ON: the URL, then the session's memory of it)
  function pageDebug() {
    if (typeof location === 'undefined') return false;
    if (/(?:^|[#&?])debug=(?:on|1|true)/i.test(String(location.hash) + String(location.search))) return true;
    try { return sessionStorage.getItem('gifos_debug') === '1'; } catch (e) { return false; }
  }

  // The seat's own death verdicts, for the page's departure intake. A death is what the seat calls one: an occupant
  // dropped with a DEATH_WHY reason (a probe unanswered on every path, a lease horizon, a ghost). A cell that only
  // leaves the view (a goodbye, a move, a link the seat no longer holds) is not a death, so the page never reads one
  // from the view. Consume-once: a stale verdict must not take a returned member out again.
  function deathLedger(me) {
    let out = [];
    return {
      verdict(by, k, x, why) { if (by !== me || x < 0 || x === me || !seatM.deathWhy(why)) return; out.push([k, x]); if (out.length > 64) out.shift(); },
      drain() { const d = out; out = []; return d; },
    };
  }

  // ---- the env -------------------------------------------------------------------------------------------------
  function create(o) {
    if (!o || !o.peer) throw new Error('mesh env: create needs o.peer');
    const pc = o.pc || {}, relay = o.relay || {}, measure = o.measure || {};
    const fh = o.fhop || null;   // friend-hop's page face (run.html's rungs, conns gossip and relay jobs); ids there are page peer ids
    const ID = o.ids || ids();
    const me = ID.learn(o.peer);
    if (!(Number.isSafeInteger(me) && me >= 0 && me < ID_MAX)) throw new Error('mesh env: my id ' + me + ' is not an integer below 2^52');
    const lv = Object.assign({}, C_.levers, { LINKMODEL: true, TIERS_ACTIVE: true, nextId: ID_MAX, LG_ON: !!measure.lgHealth }, o.levers || {});
    const st = { rx: 0, tx: 0, fhSponsored: 0, fhRouteDrop: 0, fhIn: 0, inboxMax: 0, delay: [0, 0, 0], drops: {}, relay: { knock: 0, unlist: 0, greeters: 0, nosock: 0, nosockBusy: 0, busyIn: 0, busyOut: 0, refIn: 0 }, lawErr: {} };
    const drop = (why) => { st.drops[why] = (st.drops[why] || 0) + 1; };

    // the trace sink: the sim's JSONL line {t, s, e, c, d} (harness fabric.js traceLine), or off
    // DEBUG: the page's DEBUG=on (meet.js joins with it) keeps the last TRACE_RING lines here too (env.traces()),
    // so every participant writes the seat's decision trace even when the page passes no sink
    const dbg = o.debug != null ? !!o.debug : pageDebug();
    const ring = [];
    const userSink = typeof o.trace === 'function' ? o.trace : null;
    const sink = (userSink || dbg) ? (line) => { if (dbg) { ring.push(line); if (ring.length > TRACE_RING) ring.splice(0, ring.length - TRACE_RING); } if (userSink) userSink(line); } : null;
    function traceLine(ev, s, cell, d) {
      if (!sink) return;
      let e = ''; for (let i = 0; i < d.length; i++) { const ch = d[i]; if (ch === '"' || ch === '\\') e += '\\'; if (ch.charCodeAt(0) >= 0x20) e += ch; }
      sink('{"t":' + w.TICK + ',"s":' + s + ',"e":"' + ev + '","c":' + (cell ? '"' + shared.coordStr(cell) + '"' : 'null') + ',"d":"' + e + '"}');
    }
    const trace = (ev, s, cell, f, ...a) => { if (sink) traceLine(ev, s, cell, fmt.sprintf(f, ...a)); };

    const w = seatM.newWorld({ levers: lv, trace: sink ? traceLine : null });
    // A page's clock starts far from 0. The law reads a stamp older than my clock's start as 0, and in the sim all seats share one clock; on a page
    // starting at 0 every seat older than my page lost its true birth, so a lone seat founded minutes ago read as older than the room (L16.7).
    // The same clock across a reload of one identity: the seat's digest stamps (Dig.at) must keep rising, or mates refuse the returning page's report until it outlives the old one, and read the room short meanwhile.
    w.TICK = (1 << 24) + Math.floor((Date.now() - 1700000000000) / (o.tickMs || 500));
    const seat = () => (typeof o.seat === 'function' ? o.seat() : null);
    let woken = false, dead = false, closeAt = -1;
    const bus = new Map();        // tick -> frames for my seat (synthesized: GREETERS, BUSY, deliveries the laws post)
    let inbox = [];               // frames off the dcs since the last tick, in arrival order: [m, arrivedAtTick]
    const busAt = (t, m) => { let s = bus.get(t); if (!s) { s = []; bus.set(t, s); } s.push(m); };
    const inboxPush = (m, envl) => { inbox.push([m, w.TICK, !!envl]); if (inbox.length > st.inboxMax) st.inboxMax = inbox.length; };

    // C++: mesh.cpp:wireTx  (CLOCKS: the frame leaves now; its holder-clock fields are on my clock)
    function wireTx(m) {
      const s = seat(); if (!s || m.fhTo >= 0) return;
      m.tx = w.TICK - s.clkHeld;
      if (m.sigAt >= 0 && m.id === me) m.sigL = m.sigAt;
      if (m.ppAt >= 0 && m.pp === me) m.ppL = m.ppAt;
      if (m.mpAt >= 0 && m.mpBy === me) m.mpL = m.mpAt;
      if (m.foAt >= 0 && m.fo === me) m.foL = m.foAt;
      if (m.l31At >= 0 && m.l31By === me) m.l31L = m.l31At;
      if (m.swAt >= 0 && m.t === 'SWAPGO' && m.id === me) m.swL = m.swAt;
    }

    // the ints a frame names, with their peers, so the far page can dial them (checked there by learnDir)
    function dirFor(m) {
      const d = {}; let n = 0;
      const walk = (v) => {
        if (typeof v === 'number') { if (v >= 0 && v < ID_MAX && !(v in d)) { const p = ID.pid(v); if (p) { d[v] = p; n++; } } return; }
        if (Array.isArray(v)) { for (const x of v) walk(x); return; }
        if (v && typeof v === 'object') for (const k in v) walk(v[k]);
      };
      walk(msg.writeMsg(m));
      return n ? d : null;
    }
    function learnDir(d) {
      if (!d || typeof d !== 'object') return;
      for (const k of Object.keys(d)) {
        const p = d[k], n = +k; if (typeof p !== 'string' || ID.nid(p) !== n) continue;
        ID.learn(p);
      }
    }
    const learnPeer = (peer) => ID.learn(peer);

    // ---- io for the pc laws (A2) --------------------------------------------------------------------------------
    const dialFailLater = [];
    const io = {
      dial(x, mark) {
        const p = ID.pid(x);
        if (!p || !pc.ensure) { trace('ENV-NOPEER', me, null, 'peer=%d', x); drop('nopeer'); dialFailLater.push(x); return; }
        pc.ensure(p, { why: mark && mark.mt, uplink: !!(mark && mark.up), mark });
      },
      send(x, m) {
        const p = ID.pid(x); if (!p || !pc.send) { drop('nopeer'); return false; }
        if (m && m.t !== 'pcbye') wireTx(m);
        st.tx++;
        return pc.send(p, m, m && m.t !== 'pcbye' ? dirFor(m) : null) !== false;
      },
      close(x, why) { const p = ID.pid(x); if (p && pc.close) pc.close(p, why); },
      // the page seam that sends {k:'pcbye', why} on the dc and closes my end (A3); without it A2 sends pcbye itself
      bye: pc.bye ? (x, why) => { const p = ID.pid(x); if (p) pc.bye(p, why); } : undefined,
      refuse(x, info) { relayBusy(x, { k: 'busy', g: info && info.busy ? 16 : 23 }); },
      deliver(m) { m.to = me; busAt(w.TICK, m); },
    };

    // ---- the fabric calls I own ---------------------------------------------------------------------------------
    const L915CH = new Map();
    const l915Ch = (a, b) => { const t = L915CH.get(b === me ? a : b); return t !== undefined && w.TICK - t <= K.RELAY_TTL; };
    const l9AskFrame = (m) => m.t === 'ROUTE' || m.t === 'ROUTED' || (m.t === 'E1STATE' && m.tag === 3);
    const l18Frame = (m) => l9AskFrame(m) || seatM.l13Frame(m);
    const noSockAsk = new Map(), noSockSeen = new Map();
    const l164Of = (s) => !!lv.LINKMODEL && !seatM.islandStand(s, E.IS_L164);

    // C++: mesh_farview_fab.inc:farView  (the sender's picture of a target: its own occ, live, farCk, farGw)
    function farView(s, to) {
      const v = { seat: 0, c: { pc: 0, r: 0, i: 0 }, gw: -1, gc: { pc: 0, r: 0, i: 0 }, gcOk: false };
      if (!s || to < 0) return v;
      const now = s.TICK; let any = false, ak = 0;
      for (const [k, x] of s.occ) if (x === to) { const lt = s.live.get(k); if (lt !== undefined && now - lt <= 60) { v.seat = 1; v.c = topo.unckey(k); break; } if (!any) { any = true; ak = k; } }
      if (v.seat === 0) { const it = s.farCk.get(to); if (it !== undefined && now - it.at <= K.RELAY_TTL) { if (it.ck) { v.seat = 1; v.c = topo.unckey(it.ck - 1); } else v.seat = -1; } }
      if (v.seat === 0 && any) { v.seat = 1; v.c = topo.unckey(ak); }
      const g = s.farGw.get(to); if (g !== undefined && now - g.at <= K.RELAY_TTL) { v.gw = g.gw; if (g.gck) { v.gc = topo.unckey(g.gck - 1); v.gcOk = true; } if (v.seat === 0) v.seat = -1; }
      return v;
    }
    const farSock = (v) => v.seat !== 1 || v.c.pc === 0;

    // the last step of a send: an early state frame rides an open pc or nowhere (schedL10); the rest go to the
    // pc laws' link step (A2: open -> dc, dialing -> queue, none -> dial, L22-closing -> hold)
    function parSend(from, to, m0) {
      const m = msg.clone(m0);
      if (to < 0 || to === me) { drop('self'); return; }
      if (m.l10E || m.dgOnly) { if (F.fabricLinkState(me, to) !== LS_OPEN) { drop('l10'); return; } pcw.send(to, m); return; }
      if (fh && fhopSchedule(to, m)) return;   // C++: mesh.cpp:schedule  (no open channel at my end: the page sponsors the frame)
      pcw.send(to, m);
    }

    // ---- friend-hop (C++: mesh_fhop.inc): the seat-frame rung. The rungs themselves are run.html's (sponsorSend, fwdOnward, the crumb);
    // here is only which frames take them, from my own end. The relay is never one of them.
    // C++: mesh_fhop.inc:fhopSponsor   (the origin stamps the frame; sponsors forward it as it is)
    function fhopSponsor(to, m0) {
      const p = ID.pid(to); if (!p || !o.send || !fh.canSponsor(p)) return false;
      const m = msg.clone(m0); wireTx(m); m.to = to; m.from = me;
      st.fhSponsored++; trace('FH-SPONSOR', me, null, 'to=%d mt=%d', to, msg.MT_NAMES.indexOf(m.t));
      o.send(p, m, dirFor(m));
      return true;
    }
    // C++: mesh_fhop.inc:fhopSchedule  (true: consumed; false: the link step runs)
    function fhopSchedule(to, m) {
      const s = seat(); if (!s || to < 0 || to === me || m.fhTo >= 0) return false;
      if (m.gwc && farView(s, to).seat !== 1) return false;   // L16.3: an answer to a joiner outside rides my own door
      if (pcw.fhDcRaw(to)) return false;   // the frame rides the open channel
      const st0 = pcw.fhState(to);
      const names = !!(s.hasCoord && s.linkRole(to, E.LR_OWNED | E.LR_E2)), outside = farView(s, to).seat === -1;
      // a pc that is coming (none yet, or dialing) carries the frames that wait for it
      if ((st0 === LK_NONE || st0 === LK_DIALING) && (names || outside || s.state !== 3 || (s.l13On() && (m.t === 'MEET' || m.t === 'MEETACK')) || (s.l13('L13.2') && m.t === 'FINDLEAF') || (s.l13('L13.7') && m.t === 'LEAVE' && m.mv) || (s.l13('L13.1') && m.t === 'YIELD') || (m.t === 'ROUTE' && m.tag === 1 && m.asker === me && m.via === me) || (m.t === 'WHOHOME' && m.from === me && s.hasCoord && s.coord.pc !== 0 && s.coord.i === 0))) return false;
      const entry = s.state !== 3 && (m.t === 'WHOHOME' || m.t === 'FIND' || m.t === 'HOME');   // handOnce: also waits for its own channel
      if (!fhopSponsor(to, m)) return false;
      if (entry) return false;
      pcw.fhDialBehind(to, m, names, outside);
      return true;
    }
    // C++: mesh_fhop.inc:fhopRouteDrop   (a routed frame in transit whose ideal next hop is vacant: the other rungs, toward the seat my occ names there)
    function fhopRouteDrop(s, m) {
      if (!s.hasCoord) return false;
      const held = w.TICK - s.clkHeld;
      const leaseHit = (s.leaseUntil >= 0 && held <= s.leaseUntil && ckey(m.rdst) === s.leaseCk) || (s.moving && ckey(m.rdst) === s.oldCk);
      if (ckey(s.coord) === ckey(m.rdst) || leaseHit || m.rttl <= 0) return false;
      if (s.strictNextHop(m.rdst) >= 0) return false;
      if (m.rfinal >= 0 && (m.t === 'PLACE' || m.t === 'NOROOM' || m.t === 'FINDACK')) return false;   // L16.3: the answer door's
      const tgt = m.rfinal >= 0 ? m.rfinal : s.occGet(ckey(m.rdst)); if (tgt < 0 || tgt === me) return false;
      const mm = msg.clone(m); mm.rttl = m.rttl - 1; mm.rvia = me;
      if (!fhopSponsor(tgt, mm)) return false;
      st.fhRouteDrop++; return true;
    }
    // C++: mesh_fhop.inc:fabricUnreachable   (my own failed dials, and the two networks' own words)
    function fabricUnreachable(a, x) {
      if (!fh || a !== me || x < 0) return false;
      if (F.fabricDialFails(me, x) < K.FH_ICE_N) return false;
      const mine = fh.natMine(); if (mine == null || mine < 0) return false;
      const p = ID.pid(x); const n = p ? fh.natOf(p) : null; if (n == null || n < 0) return false;
      return !fhopM.fhNatMeet(mine, n);
    }
    // C++: mesh_fhop.inc:fhopFriendFor
    function fhopFriendFor(a, x) { if (!fh || a !== me || x < 0) return false; const p = ID.pid(x); return !!p && !!fh.friendFor(p); }
    // what the pc laws read (linkWhy LW_FHOP): my relay roles, as ints
    function fhRoles() {
      const r = fh.roles(); const n = (p) => learnPeer(p);
      return { jobs: r.jobs.map((j) => ({ target: n(j.target), req: n(j.req) })), peer: r.vias.map((v) => ({ via: n(v) })) };
    }

    // C++: mesh.cpp:fabricSend  (the sim's order; past the direct link the path is the sender's picture of `to`)
    function fabricSend(from, to, m) {
      // the sim's fabricSend has no dead gate: seat.leave marks itself dead (fabricLeft) and THEN emits its LEAVEs, so a
      // send while the leave's own close is pending (closeAt >= 0) goes out; dropping them left every leaver's cell held
      const s = seat(); if (!s || (dead && closeAt < 0)) return;
      if (m.l10E || m.dgOnly) {
        let held = false; if (s.hasCoord && to >= 0 && to !== from) { for (const c of ownedLinks(s.coord)) if (s.occGet(ckey(c)) === to) { held = true; break; } }
        if (held) parSend(from, to, m); else drop('l10');
        return;
      }
      if (lv.ROUTE_ENFORCE && lv.LINKMODEL && !m.routing && !m.direct && to >= 0 && to !== from && l18Frame(m) && F.l18Route(from, to)) {
        const rc = F.l18Cell(from, to); const mm = msg.clone(m); mm.l18 = true; lv.L18_ROUTED = (lv.L18_ROUTED || 0) + 1; s.route(rc, to, mm); return;
      }
      if (lv.ROUTE_ENFORCE && !m.routing && to >= 0 && to !== from) {
        let directLink = !!s.linkRole(to, E.LR_OWNED | E.LR_E2 | E.LR_L4);
        if (!directLink && ((l9AskFrame(m) && l915Ch(from, to)) || (s.l13On() && seatM.l13Frame(m))) && lv.LINKMODEL) { const ls = F.fabricLinkState(from, to); if (ls === LS_OPEN || ls === LS_DIALING) directLink = true; }
        const fv = directLink ? { seat: 0, c: { pc: 0, r: 0, i: 0 }, gw: -1, gc: { pc: 0, r: 0, i: 0 }, gcOk: false } : farView(s, to);
        const vIn = fv.seat === 1, mineCell = vIn && s.hasCoord && ckey(fv.c) === ckey(s.coord);
        const doors = F.fabricDoors();
        if (!directLink && m.direct) {
          if (mineCell && !(s.socketed() && farSock(fv))) { drop('direct-mine'); return; }
          if (vIn && !mineCell) { if (fh && s.hasCoord && s.strictNextHop(fv.c) < 0 && fhopSponsor(to, m)) return; s.route(fv.c, -1, msg.clone(m)); return; }
        } else if (!directLink && m.t === 'TAKEOVER' && !s.hasCoord && doors) {
          /* L16.2: the joiner dials the admitter its FIND was handed to */
        } else if (!directLink && doors && !vIn && s.hasCoord && s.state === 3 && F.fabricLinkState(from, to) === LS_OPEN) {
          /* L16: a seated seat holding an open door to a joiner hands the frame over that door */
        } else if (!directLink && doors && !s.hasCoord && F.fabricLinkState(from, to) === LS_OPEN) {
          /* L16.3: a seeker outside with an open door to a seated seat hands its frame over that door */
        } else if (!directLink && doors && !vIn && s.hasCoord && s.state === 3 && m.t !== 'HOME' && m.gwc) {
          // L16.3.3: a seat with no socket cannot signal a door to a seeker (no seat to walk to, the greeter's door closed): the answer climbs to my Section-1 ancestor, whose socket does.
          if (!s.socketed() && s.coord.pc !== 0 && !m.adoor && !m.routing) { let an = s.coord; for (let q = 0; q < 16 && an.pc !== 0; q++) { const u = topo.up({ pc: an.pc, r: an.r, i: 0 }); if (!u) break; an = u; } if (an.pc === 0) { s.route(an, to, msg.clone(m)); return; } }
          /* L16.3: a deep seat's answer to a joiner outside rides a door of its own, dialled for it */
        } else if (!directLink) {
          if (doors && s.socketed() && farSock(fv) && s.hasCoord && s.state === 3 && fv.seat === -1 && fv.gw >= 0 && fv.gw !== from && fv.gcOk && F.fabricLinkState(from, to) !== LS_OPEN && F.fabricLinkState(from, to) !== LS_DIALING) { s.route(fv.gc, to, msg.clone(m)); return; }
          else if (s.socketed() && farSock(fv)) { /* both hold sockets (greeting scope): the relay signals a pc; a socketless target answers nosock */ }
          else if (vIn) { if (fh && s.hasCoord && ckey(s.coord) !== ckey(fv.c) && s.strictNextHop(fv.c) < 0 && fhopSponsor(to, m)) return; s.route(fv.c, s.l13('L13.1') ? to : -1, msg.clone(m)); return; }
          else if (fv.gw >= 0 && fv.gcOk) { s.route(fv.gc, to, msg.clone(m)); return; }
          else { if (fh && fhopSponsor(to, m)) return; drop('nowhere'); return; }   // nowhere I know: the seat retries on its own clock
        }
      }
      parSend(from, to, m);
    }

    // C++: mesh.cpp:relayKnock  (the relay's own law runs at the relay; the L16.4 blob rule is applied here, at my end)
    function relayKnock(id, presentedKey, blob) {
      void presentedKey;   // the page's genesis key is mesh-wire's (the room key the relay hashes)
      const s = seat(); if (!s || !relay.knock) return;
      const isl = seatM.islandStand(s, E.IS_RELAY); const s1Only = isl || l164Of(s);
      const blobOk = !!blob && (!s1Only || (s.state === 3 && s.hasCoord && s.coord.pc === 0));
      st.relay.knock++; relay.knock(null, blobOk);
    }
    // C++: mesh.cpp:relayUnlist
    function relayUnlist(id) { const s = seat(); if (!s || !l164Of(s) || !relay.unlist) return; st.relay.unlist++; relay.unlist(); }

    // L33.11: the seat says its ask to g crossed the relay; the relay's nosock for g answers it (either order)
    function fabricNoSock(a, g) {
      if (a !== me || g < 0) return;
      const t = noSockSeen.get(g);
      if (t !== undefined && w.TICK - t <= NOSOCK_WIN) { noSockSeen.delete(g); bounceNoSock(g); return; }
      noSockAsk.set(g, w.TICK);
    }
    function bounceNoSock(g) { const m = msg.newMsg('BUSY'); m.nosock = true; m.id = g; m.to = me; m.from = -1; st.relay.nosockBusy++; busAt(w.TICK + 1, m); }

    // C++: mesh_fhop.inc:fabricFreeCells, from MY view (the sim counts the true seats)
    function fabricFreeCells(pcPath, r) {
      const s = seat(); let free = r < 0 ? topo.C * topo.C : topo.C; if (!s) return free;
      for (const k of s.occ.keys()) { if (ckPc(k) !== pcPath) continue; if (r < 0 || ckR(k) === r) free--; }
      return free;
    }

    function leaveNow(reload) {
      const s = seat(); if (s) s.dead = true; dead = true; woken = false;
      closeAt = w.TICK + (reload ? K.RELOAD_CLOSE_LAG : 1);
      if (typeof o.onLeft === 'function') o.onLeft(!!reload);
    }

    // a referral list over the relay: one id per sealed frame (gifos-net fitsFixed checks every piece)
    function relayBusyList(x, g, list) {
      const ps = []; for (const n of list || []) { const p = ID.pid(n); if (p) ps.push(p); }
      if (!ps.length) { relayBusy(x, { k: 'busy', g }); return; }
      ps.forEach((p, i) => relayBusy(x, { k: 'busy', g, i, n: ps.length, ref: [p] }));
    }
    function relayBusy(x, body) {
      const p = ID.pid(x); if (!p || !relay.busy) { drop('busy-nopeer'); return; }
      const net = netM(); if (net && net.fitsFixed && !net.fitsFixed(body)) { drop('busy-unfit'); trace('ENV-BUSY-UNFIT', me, null, 'peer=%d', x); return; }
      st.relay.busyOut++; relay.busy(p, body);
    }

    const noop = () => {};
    const deaths = deathLedger(me);   // fabricVerdict: the seat's death verdicts, drained by the page (drainDeaths)
    const OWN = {
      fabricAdmitLog: noop, fabricDupMint: noop, fabricNoteBackoff: noop, fabricNoteReseat: noop, fabricNoteRollback: noop,
      fabricNoteSwap: noop, fabricVerdict: deaths.verdict, l18UxDeliv: noop, descEnd: noop, descNote: noop, g4Joined: noop,   // g4Joined: the sim's L40 contest lever only (X1 55c97d1)
      fabricFreeCells, fabricLieFor: () => null, fabricUnreachable, fhopActive: () => !!fh, fhopFriendFor,
      fabricMyTier: () => ((measure.tier ? measure.tier() : E.TIER_DESKTOP) | 0),
      fabricMyNat: () => ((measure.nat ? measure.nat() : E.NAT_OPEN) | 0),
      fabricLeft: () => leaveNow(false), fabricReloadBye: () => leaveNow(true),
      fabricNoSock, fabricSend, fabricAudit: (from, to, m) => { if (to >= 0 && to !== me) parSend(from, to, m); },
      l164Of, l915Note: (a, b) => { if (L915CH.size > 4096) L915CH.clear(); L915CH.set(b === me ? a : b, w.TICK); },
      relayKnock, relayUnlist, wake: (id) => { if (id === me && !dead) woken = true; },
    };

    // ---- the pc laws (A2) over my io ----------------------------------------------------------------------------
    const PW = pcWireM();
    if (!PW || !PW.create) throw new Error('mesh env: GifOS.meshPcWire (js/mesh/page/pclaws-wire.js) is not loaded');
    const pcw = PW.create({ me, seat, w, trace, io, wireTx, l392Contest: o.l392Contest, fh: fh ? { friendFor: fhopFriendFor, roles: fhRoles } : null });
    // a law that throws must not take the page down: trace it, count it, answer as "no"
    const guard = (n, fn) => (...a) => {
      try { return fn(...a); } catch (e) {
        st.lawErr[n] = (st.lawErr[n] || 0) + 1;
        if (st.lawErr[n] <= 3) trace('ENV-LAWERR', me, null, '%s %s', n, String(e && e.message || e));
        if (o.strict) throw e;
        return undefined;
      }
    };
    const F = {};
    for (const n of seatM.FABRIC_CALLS) {
      const fn = (pcw.fns && pcw.fns[n]) || OWN[n];
      F[n] = fn ? guard(n, fn) : guard(n, () => { throw new Error('mesh env: ' + n + ' is not wired'); });
    }
    w.f = F;
    // the pc laws' own helpers fabricSend reads (not seat calls): L18's route test and cell
    for (const n of ['l18Route', 'l18Cell']) F[n] = guard(n, (pcw.fns && pcw.fns[n]) || (() => (n === 'l18Route' ? false : null)));

    // ---- the page's face ------------------------------------------------------------------------------------------
    // C++: mesh.cpp:doTick, for one seat: link tick, deliver, tick the seat if woken; then the clock moves on.
    function tick() {
      const s = seat();
      if (closeAt >= 0 && w.TICK >= closeAt) { closeAt = -1; if (pcw.leaveAll) pcw.leaveAll(); }
      while (dialFailLater.length) { const x = dialFailLater.shift(); if (pcw.dialFailed) pcw.dialFailed(x); }
      if (pcw.tick) guard('pcw.tick', pcw.tick)();
      if (s && !dead) {
        const due = [];
        for (const t of [...bus.keys()].sort((a, b) => a - b)) { if (t > w.TICK) break; due.push(...bus.get(t)); bus.delete(t); }
        const ib = inbox; inbox = [];
        for (const m of due) recvOne(s, m);
        for (const [m, at, envl] of ib) { const d = w.TICK - at;   /* 0: the first boundary after arrival (the sim's 1-tick hop) */ st.delay[d <= 0 ? 0 : d === 1 ? 1 : 2]++; if (fh && !envl && m.routing && fhopRouteDrop(s, m)) continue; /* C++: mesh_fhop.inc:fhopIntercept: an envelope for me is the seat's, as it is */ recvOne(s, m); }
        if (woken) { woken = false; guard('seat.tick', () => s.tick())(); }
        noteLinks(s);
        if (lv.LG_ON) guard('lgFabric', () => lgFabric(s))();
      } else { bus.clear(); inbox = []; }
      for (const [g, t] of noSockAsk) if (w.TICK - t > NOSOCK_WIN) noSockAsk.delete(g);
      for (const [g, t] of noSockSeen) if (w.TICK - t > NOSOCK_WIN) noSockSeen.delete(g);
      for (const [x, r] of refPend) if (w.TICK - r.at > REF_STALE) refPend.delete(x);
      w.TICK++;
    }
    // L29, the fabric's half (sim mesh_lguard.inc lguardFabTick): the duties my cell owes in load units, the budget my
    // device shows it can carry, the ladder, the inbound watch, and the leave when my receivers and my own reading agree.
    let lgCap = -1, lgReadAt = 0, lgLeft = false; const lgStarved = new Set();
    function lgFabric(s) {
      const K = C_.consts, full = s.tier === C_.enums.TIER_MOBILE ? K.L29_BUD_M : K.L29_BUD_D;
      if (s.lgQuit && !lgLeft) { lgLeft = true; if (measure.lgLeave) measure.lgLeave(); return; }
      if (!s.hasCoord || s.state !== 3) { s.lgLadder(); return; }
      const c = s.coord, held = (x) => { const v = s.occGet(topo.ckey(x)); return v >= 0 && v !== s.id; };
      let rx = 0;
      for (let j = 0; j < topo.C; j++) {
        if (j !== c.i && held({ pc: c.pc, r: c.r, i: j })) rx++;
        if (c.pc === 0 && j !== c.r && held({ pc: 0, r: j, i: c.i })) rx++;
      }
      let fwd = c.pc === 0 || c.i === 0 ? rx : 0;
      if (c.pc !== 0 && c.i === 0) { const o = s.ownerCoord(); if (o && held(o)) fwd++; }
      const dn = topo.down(c); if (dn.pc > c.pc && held(dn)) fwd++;
      const own = measure.lgCamOn && !measure.lgCamOn() ? 0 : rx, park = s.bkId >= 0 ? 1 + rx : 0, woke = measure.lgWoke ? measure.lgWoke() : 0;
      // L29.0: a Section-1 head's duty (sim mesh_lguard.inc lgDuties): each row-mate taken in L29_PARK, the row block and the
      // row view L29_HOT each (high), one mix per child branch of its row L29_HOT (low); only where there is a room to serve.
      let hd = 0, hlow = 0;
      if (c.pc === 0 && c.i === 0) {
        let mates = 0, kids = 0, heads = 0;
        for (let j = 0; j < topo.C; j++) { if (j > 0 && held({ pc: 0, r: c.r, i: j })) mates++; const dk = topo.down({ pc: 0, r: c.r, i: j }); if (dk.pc > 0 && held(dk)) kids++; if (j !== c.r && held({ pc: 0, r: j, i: 0 })) heads++; }
        if (kids > 0 || heads > 0) { hd = mates * K.L29_PARK + 2 * K.L29_HOT; hlow = 0; }   // one room pack encoded once: no mix per child branch
      }
      const l2 = own * K.L29_HOT + fwd + hd, l1 = l2 + fwd + hlow, l0 = l1 + park * K.L29_PARK + woke * K.L29_HOT;
      s.lgLd[0] = l0; s.lgLd[1] = l1; s.lgLd[2] = l2; s.lgBud0 = full; s.lgOwn = own * K.L29_HOT;
      if (lgCap < 0) lgCap = full;
      // what the device carried, scaled by how well it kept up; a device keeping up earns its budget back slowly
      if (w.TICK >= lgReadAt) { lgReadAt = w.TICK + K.L29_STARVE; const h = measure.lgHealth(); lgCap = h < 1 ? Math.min(lgCap, Math.ceil(s.lgLd[s.lgLvl] * h)) : Math.min(full, lgCap + 1); }
      s.lgBud = lgCap;
      s.lgLadder();
      if (!measure.lgStarve) return;
      const now = new Set(measure.lgStarve());
      const say = (pid, hold) => { const m = msg.newMsg('LGSTARVE'); m.id = ID.nid(pid); m.to = me; m.from = -1; m.hold = hold ? 1 : 0; busAt(w.TICK + 1, m); };
      for (const pid of now) if (!lgStarved.has(pid)) { lgStarved.add(pid); say(pid, true); }
      for (const pid of [...lgStarved]) if (!now.has(pid)) { lgStarved.delete(pid); say(pid, false); }
    }
    function recvOne(s, m) {
      if (s.dead) return;
      st.rx++;
      guard('seat.recv', () => s.recv(m))();
      woken = true;   // the sim wakes the receiver of every delivered frame
    }

    let lastLinks = '';
    function links() { const s = seat(); if (!s) return []; const out = []; s.linkPeers(out); const ps = []; for (const x of out) { const p = ID.pid(x); if (p) ps.push(p); } return ps; }
    function noteLinks(s) {
      if (typeof o.onLinks !== 'function') return;
      const out = []; s.linkPeers(out); const key = out.slice().sort((a, b) => a - b).join(',');
      if (key === lastLinks) return; lastLinks = key; o.onLinks(links());
    }

    // a verified frame off viaPeer's dc (A3 decodes and checks signatures); dir: the sender's id directory
    // direct: run.html's word that the frame came off viaPeer's own dc after §DCAUTH. `from` and `lk` are the fabric's, never the frame's.
    // sponsored: this frame came in a friend's envelope; provenFrom: the envelope's origin, when mesh-wire proved it (the sim's m.from = fhOrig, never first-hand). Unproven: the delivering peer's, as a routed frame's last hop.
    function frame(m, viaPeer, dir, direct, sponsored, provenFrom) {
      if (dead || !m) return;
      const x = learnPeer(viaPeer); if (x < 0) { drop('frame-nopeer'); return; }
      learnDir(dir);
      m.lk = -1; m.lkEp = 0;
      if (pcw.frame && pcw.frame(x, m, direct === true)) return;   // a pcbye, or a frame lost to a close at my end
      if (!m.t || m.t === 'pcbye') return;
      m.to = me; m.from = x;
      if (sponsored) { st.fhIn++; if (provenFrom != null && direct !== true) { const ox = learnPeer(provenFrom); if (ox >= 0 && ox !== me) m.from = ox; } }
      inboxPush(m, sponsored);
    }

    // a pc / dc event at my end for viaPeer
    function transport(peer, ev, arg) {
      const x = learnPeer(peer); if (x < 0) return false;
      if (sink) trace('ENV-PC', me, null, 'peer=%d ev=%s', x, String(ev));
      switch (ev) {
        case 'offer': return pcw.offer ? pcw.offer(x, arg || {}) !== false : true;
        case 'answer': if (pcw.answered) pcw.answered(x, arg || {}); return true;   // the callee's mark came back with its answer
        case 'open':
          // a pc the far end dialled whose offer the page did not report: my end takes it now (A2's offer gates)
          if (pcw.link && !pcw.link(x) && pcw.offer && pcw.offer(x, arg || {}) === false) { io.close(x); return false; }
          if (pcw.opened) pcw.opened(x); return true;
        case 'bye': if (pcw.byeIn) pcw.byeIn(x, arg || 'call'); return true;   // the page seam parsed {k:'pcbye'} itself
        case 'greeter-gone': { if (x === me) return false; const s = seat(), m = s ? s.goneBye(x) : null; if (!m) return true; frame(m, peer); if (pcw.byeIn) pcw.byeIn(x, 'leave'); return true; }   // the relay's word, read as the dead greeter's goodbye and pcbye
        case 'dial-failed': if (pcw.dialFailed) pcw.dialFailed(x); return true;
        case 'wake-dead': { const L = pcw.link ? pcw.link(x) : null; if (L && L.state === LK_OPEN) break; return true; }   // a dial still running has its own LINK_DIAL_FAIL
        case 'refused': if (pcw.refused) pcw.refused(x, arg || {}); return true;
        case 'page-closed': if (pcw.pageClosed) pcw.pageClosed(x); return true;
      }
      if (WHY[ev]) { if (pcw.lost) pcw.lost(x, WHY[ev]); return true; }
      if (/-awake$/.test(ev) && WHY[ev.replace(/-awake$/, '')]) { if (pcw.lost) pcw.lost(x, WHY[ev.replace(/-awake$/, '')]); return true; }
      return false;
    }

    // a relay frame (mesh-wire opened any sealed part)
    const refPend = new Map();
    function relayFrame(m) {
      if (!m || dead) return;
      if (m.t === 'greeters') {
        st.relay.greeters++;
        const out = [];
        for (const p of m.list || []) { const x = learnPeer(p); if (x >= 0 && x !== me && !out.includes(x)) out.push(x); }
        for (let k = out.length - 1; k > 0; k--) { const j = Math.floor((o.rand ? o.rand() : Math.random()) * (k + 1)); const t = out[k]; out[k] = out[j]; out[j] = t; }   // the sim's relay shuffles
        const g = msg.newMsg('GREETERS'); g.list = out; g.to = me; g.from = -1; busAt(w.TICK, g);
        return;
      }
      if (m.t === 'nosock') {
        st.relay.nosock++;
        const g = learnPeer(m.to); if (g < 0) return;
        const t = noSockAsk.get(g);
        if (t !== undefined && w.TICK - t <= NOSOCK_WIN) { noSockAsk.delete(g); bounceNoSock(g); }
        else noSockSeen.set(g, w.TICK);
        return;
      }
      if (m.t === 'peer' && m.ty === 'busy') {
        st.relay.busyIn++;
        const x = learnPeer(m.from); if (x < 0) return; const d = m.d || {};
        if (d.g === 14) {
          if (Number.isInteger(d.n) && d.n > 0) {
            let r = refPend.get(x); if (!r || r.n !== d.n) { r = { n: d.n, at: w.TICK, parts: [] }; refPend.set(x, r); }
            r.parts.push(d); if (r.parts.length < r.n) return; refPend.delete(x);
            const net = netM(); const ps = net && net.referralJoin ? net.referralJoin(r.parts) : [].concat(...r.parts.map((q) => q.ref || []));
            if (!ps) { drop('ref-bad'); return; }
            st.relay.refIn++; deliverDecline(x, ps);
          } else deliverDecline(x, []);
          return;
        }
        if (pcw.refused) pcw.refused(x, { busy: d.g === 16 ? 1 : 0 });
      }
    }
    function deliverDecline(x, peers) {
      const d = msg.newMsg('BUSY'); d.tag = 14; d.id = x; d.from = x; d.to = me; d.lk = -1;
      for (const p of peers) { const n = learnPeer(p); if (n >= 0) d.list.push(n); }
      busAt(w.TICK, d);
    }

    // the page's leave (A3 node.leave calls this, then stops the clock): the seat's goodbyes go out on the open dcs
    // first (emit sends at once), then a pcbye{leave} on every pc, now: no later tick will run to do it
    function leave(reload) {
      const s = seat(); if (!s || s.dead) return;
      guard('seat.leave', () => s.leave(!!reload))();
      if (!dead) leaveNow(!!reload);
      closeAt = -1; if (pcw.leaveAll) guard('pcw.leaveAll', pcw.leaveAll)();
    }
    function absence(n) { const s = seat(); if (s && !dead && n > 0) s.absence(n); }
    function stats() { return Object.assign({ tick: w.TICK, me, ids: ID.size(), woken, dead }, JSON.parse(JSON.stringify(st))); }

    const env = {
      me, world: w, traces: () => ring.slice(), ids: ID, f: F, pcw, tick, frame, transport, doorForgive: (peer) => { const x = learnPeer(peer); if (x >= 0 && pcw.doorForgive) pcw.doorForgive(x); }, dialHeld: (peer) => { const x = learnPeer(peer); return x >= 0 && !!pcw.dialHeld && pcw.dialHeld(x); }, relayFrame, absence, leave, stats, links,
      dirFor, learnDir, relayBusyList,
      // the mark my answer to peer carries back to it (A2), for the pc layer's answer
      mark: (peer) => { const x = ID.pid(ID.nid(peer)) === String(peer) ? ID.nid(peer) : learnPeer(peer); return x >= 0 && pcw.mark ? pcw.mark(x) : null; }, farView: (to) => farView(seat(), to),
      // the seat's construction is the caller's (A3): new Seat(env.me, env.world)
      newSeat: () => new seatM.Seat(me, w),
      drainDeaths: deaths.drain,   // [cellKey, seat id] the seat read dead since the last drain
    };
    if (dbg && typeof window !== 'undefined') window.__meshEnv = env;   // DEBUG: meet.js eval reaches the env (stats, traces, pcw.dump)
    if (dbg && typeof window !== 'undefined') window.__meshSeatRaw = seat;   // DEBUG: the ported seat, for a forced requeue in a repro
    return env;
  }

  const api = Object.freeze({ create, ids, nidOf, ID_BITS, deathLedger });
  GifOS.meshPageEnv = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
