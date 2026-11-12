/*
 * recv-entry.js: the frame handlers of a seat that is not (yet) seated (port unit S7a): the greeter list, the
 * door's WHOHOME and HOME, FIND and its ack, a heal order (FINDLEAF), PLACE, NOROOM, the reclaim answers, and PP.
 * Ported line for line from the 0.9.25 sim (mesh_seat.inc at gifos 37d787b2d). The dispatcher that calls them is
 * recv.js. HANDOFF / TAKEOVER / TAKEN and PLACED are served by handlers other units own (l16Handoff, l16Taken in
 * island.js, l31OnPlaced in instant.js); serveReclaim is in entry.js.
 *
 * Port notes (see seat.js for the conventions):
 *   gate()      the sim's gate-measurement hook is left out (no seat reads it).
 *   COMPACT_*, L25_TWICE   the sim's counters are w.lv counters.
 *   L31_VIA     the `ijvia` gate lever (OMap<int,int>) is `this.w.L31_VIA` (a Map, or unset = empty).
 *   vector copies (roster=m.roster, lastGreeters=m.list, rcPend=m) are copied, never shared.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const seatM = req('./seat.js', 'meshSeat');
  const { cellOk, coordStr } = req('./shared.js', 'meshShared');
  const { Seat, FREE, roomTerm, islandStand } = seatM;
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const { eraseFirst } = req('./util.js', 'meshUtil');

  const K = C_.consts, E = C_.enums;
  const { ckey, ckPc, unckey, down, pcDepth, lastDigit, parentPath, rowMates } = topo;
  const C = topo.C;
  const newMsg = (t) => msg.newMsg(t);
  const kvCopy = (a) => a.map((e) => ({ k: e.k, v: e.v }));


  Seat.unit('mesh_seat.inc recv entry handlers', {
    // C++: mesh_seat.inc:Seat::onGreeters
    onGreeters(m) {
      const TICK = this.TICK, id = this.id, lv = this.w.lv;
      if ((this.state === 0 || this.state === 1) && this.l45Stale(m.list)) { this.reJoin = true; this.f.wake(id); return; }   // L45
      if (m.list.length === 0) {
        if (this.state === 0) { this.genKey = this.linkKey; this.take({ pc: 0, r: 0, i: 0 }, -1, [], -1, -1, [], -1); this.lineAdopt(id, 'genesis'); }
        else if (this.state === 3) { this.lastGreeters = []; this.greetersAt = TICK; }
        return;
      }   // a seated seat records the empty list too; R3: empty list => I minted the genesis key & found the home
      if ((this.state === 0 || this.state === 1) && this.joinStart < 0) this.joinStart = TICK;
      if ((this.state === 0 || this.state === 1) && this.joinStart >= 0 && TICK - this.joinStart > K.STRAND_TTL && (this.lastReach < 0 || TICK - this.lastReach > K.STRAND_TTL) && !this.l16Saw && !this.evilDoor) { this.stranded = true; this.strandedAt = TICK; return; }   // R6
      for (const g of m.list) this.dials.heard(g);   // L17
      this.lastGreeters = m.list.slice(); this.greetersAt = TICK;
      if (m.tag === 1) { const st = this.l3117Stray(m.list); if (st === 2) return; if (st === 0) this.keyAsk(m.list); }   // L3.11.7 (C++: onGreeters)   // L3.11.6: the door refused my registration (C++: onGreeters)
      if (this.state === 0 && this.entryTerm()) { this.islandAsk(m.list); return; }   // L8.2
      if (this.state === 0) {
        let g = m.list[Math.floor(this.rng() * m.list.length)];
        { const via = this.w.L31_VIA; const dv = via ? via.get(id) : undefined; if (dv !== undefined && m.list.includes(dv)) g = dv; }
        this.gateway = g; this.entNote(g); if (this.f.fabricDoors()) this.l16AskOne(g);
        const w = newMsg('WHOHOME'); w.from = id; w.ttl = 60; if (!this.oldCell && !islandStand(this, E.IS_L31)) w.l31 = 1; this.emit(g, w); this.state = 1; this.retryAt = TICK;
      }
      this.islandFork(m.list);   // L8.3
      if (this.state === 3 && this.coord.pc === 0 && TICK - this.rookSeenAt > K.STRAND_TTL && !this.islandFounder) {   // L8.4
        let other = false; for (const g of m.list) if (g !== id && g >= 0) { other = true; break; }
        if (other) { this.requeue('rook-silent-split'); return; }
      }
      this.loneGreet();
      if (this.state === 3 && this.coord.pc === 0 && TICK - this.seatedAt > 80) {
        let full = true;
        for (let r = 0; r < C && full; r++) for (let i = 0; i < C && full; i++) if (!this.occ.has(ckey({ pc: 0, r, i }))) full = false;
        const quiet = TICK - this.lastChurn > 300 && TICK - this.healAt > 300;
        if (full && !quiet) return;
        const known = new Set();
        for (const [k, v] of this.occ) { if (v < 0) continue; const ew = this.elsewhere.get(v); if (ew !== undefined && TICK - ew <= K.RELAY_TTL && !this.firstHandLive(k)) continue; known.add(v); }
        const next = new Map();
        const need = full ? 8 : 2;
        if (this.f.fabricDoors()) {   // L8.49: of the strangers I greet below and have no path to, one is dialled: the one dialled longest ago, the next id above my own first
          let l849Prev = this.l849Pick;   // L8.49.1: the stranger the last listing dialled
          { let reach = false; for (const g of m.list) if (g >= 0 && g !== id && !known.has(g) && (this.f.fabricLinkCarries(id, g) || this.f.fhopFriendFor(id, g))) { reach = true; break; } if (!reach) l849Prev = -1; }   // ...and only where a connection or a friend of mine reaches some stranger
          this.l849Pick = -1; const kept = new Map(); let best = -1, bestAt = 0, bestK = 0;
          for (const g of m.list) if (g >= 0 && g !== id && !known.has(g)) {
            if ((this.strangeSeen.has(g) ? this.strangeSeen.get(g) : 0) + 1 < need) continue;
            const a = this.l849At.get(g); const at = a === undefined ? -1 : a; if (at >= 0) kept.set(g, at);
            if (this.f.fabricLinkCarries(id, g) || this.f.fhopFriendFor(id, g)) continue;
            if (g === l849Prev) continue;   // L8.49.1: the stranger I dialled on the last listing and still have no path to takes its turn on a friend's channel (direct, then a friend, in turn)
            const k = g > id ? g - id : g - id + 2147483648;   // the turn starts at the next id above my own, so a ring's seats spread over the other ring's
            if (best < 0 || at < bestAt || (at === bestAt && k < bestK)) { best = g; bestAt = at; bestK = k; }
          }
          this.l849At = kept; if (best >= 0) { this.l849Pick = best; this.l849At.set(best, TICK); }
        }
        for (const g of m.list) if (g >= 0 && g !== id && !known.has(g)) {
          const seen = (this.strangeSeen.has(g) ? this.strangeSeen.get(g) : 0) + 1; next.set(g, seen);
          if (seen >= 2) { this.xrOk.set(g, TICK); if (this.xrOk.size > K.RELAY_CAP) { const old = []; for (const [k, v] of this.xrOk) if (TICK - v > 2 * K.RELAY_TTL) old.push(k); for (const o of old) this.xrOk.delete(o); } }
          if (seen >= need) { const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = id; this.emit(g, h); next.set(g, need); }   // L8.5.4: greet a persistent stranger on every listing (a HELLO over a friend can die with the friend's dark spell)
        }
        this.strangeSeen = next;   // ids no longer listed/known drop out
      }
      void lv;
    },

    // C++: mesh_seat.inc:Seat::onWhoHome
    onWhoHome(m) {
      const TICK = this.TICK, id = this.id;
      if (!this.hasCoord) { const h = newMsg('HOME'); this.emit(m.from, h); return; }
      if (m.ttl <= 0) return;
      if (this.coord.pc === 0 || this.doorCallOn()) {   // FHOP.8: a friend called to the door answers there as a greeter
        const h = newMsg('HOME'); h.roster = this.s1Roster(); h.id = id; h.gkey = this.genKey;
        h.askGap = this.doorAskAt < 0 ? 1000000 : (TICK - this.doorAskAt) | 0; this.doorAskAt = TICK | 0;   // one clock for the whole door, read before this answer moves it
        if (m.knock) { h.knock = true; this.f.fabricDialJoin(id, m.from); h.mass = this.l13On() && this.l13Mass(); }   // L13.25
        for (const [bk, bv] of this.byeAt) { if (ckPc(bk) !== 0 || this.occGet(bk) >= 0 || TICK - bv > K.LEASE_T) continue; h.byes.push(bk); if (h.byes.length >= C * C) break; }   // L1.5
        if (!this.l31Door(m, h)) this.emit(m.from, h);
        return;
      }
      const fwd = (x) => { if (x >= 0 && x !== id && x !== m.via) { const w = newMsg('WHOHOME'); w.from = m.from; w.via = id; w.ttl = m.ttl - 1; w.knock = m.knock; this.emit(x, w); return true; } return false; };
      if (this.coord.i !== 0) { if (fwd(this.occGet(ckey({ pc: this.coord.pc, r: this.coord.r, i: 0 })))) return; } else { if (fwd(this.ownerId())) return; }
      if (this.l13On()) {   // L13: my way up is gone: the ask goes to a home seat I name
        let best = -1;
        for (const [k, v] of this.occ) { if (ckPc(k) !== 0 || v < 0 || v === id || v === m.via || v === m.from) continue; if (this.firstHandLive(k)) { best = v; break; } if (best < 0) best = v; }
        if (best < 0) for (const [k, v] of this.cousins) { if (ckPc(k) !== 0 || v < 0 || v === id || v === m.via || v === m.from) continue; best = v; break; }
        if (best >= 0) { this.f.fabricDialJoin(id, best); fwd(best); return; }
      }
    },

    // C++: mesh_seat.inc:Seat::onHome
    onHome(m) {
      const TICK = this.TICK, id = this.id, lv = this.w.lv;
      if (m.id >= 0) this.doorAsk.delete(m.id);   // it answered: not dark
      if (this.l13On() && this.state === 3 && m.knock && (m.byes.length >= 2 || m.mass)) { let n = 0; for (const v of this.byeIds.values()) if (TICK - v <= K.LEASE_T) n++; let d = 0; for (const t of this.l13DownAt) if (TICK - t <= K.LEASE_T) d++; if (n + d >= 1) this.l13MassHeard(); }   // L13
      if (this.state === 3 && TICK - this.rosterAskAt > 120) return;   // a SEATED seat hears HOME only as the answer to its own WHOHOME
      if (m.askGap >= 0) this.askGap = m.askGap | 0;   // the door's one clock, as of this answer
      if (m.gkey) { const rk = this.state === 3 && this.hasCoord && this.coord.pc === 0 && this.genKey !== m.gkey; this.genKey = m.gkey; if (rk) { this.trace('L3.11.6-REKEY', id, this.coord, 'from=%d', m.from); this.emitRelay(this.genKey); } }   // THIS meeting's genesis key. L3.11.6: a seated Section-1 seat whose key changed registers under it now (C++: onHome)
      if (this.state === 1 && roomTerm(this, 1) && m.from >= 0 && this.c7Old.has(m.from) && TICK - this.c7At < K.RELAY_TTL && !this.l853Stays(m)) return;   // L8.5; L8.5.3: unless its HOME names a ring below the one I left (it re-seated in the ring we move toward: the carrier)
      if (this.state === 1 && this.l851Moves(m)) return;   // L8.5.1
      if (this.state === 1 && m.l31 === 1 && this.l31TakeDoor(m)) return;   // L31.1
      if (this.l3113On() && this.state === 1 && this.oldCell && this.rcSentAt >= 0 && TICK - this.rcSentAt < K.RC_RESEND && m.roster.length) { this.roster = kvCopy(m.roster); this.haveRoster = true; this.lastReach = TICK; return; }   // L3.11.3: my RECLAIM round is in flight; a HOME now (the reload tree memory's burst) keeps its roster but starts no round and seats me nowhere: as a newcomer I would close the door its RECLAIMED comes back on
      if (this.state === 1 && this.oldCell && this.rcTries < 2 && !(this.rcPendAt >= 0) && m.roster.length && (!this.l3112On() || this.rcTries > 0 || ((this.rcRtN = 0), (this.rcRtAt = -1), true)) && this.tryReclaim(m.roster, m.from)) { this.rcGreeter = m.from; this.rcTries++; this.roster = kvCopy(m.roster); this.haveRoster = true; this.lastReach = TICK; this.retryAt = TICK; return; }   // L3.10
      if (this.state === 1 && this.oldCell && (this.rcPendAt >= 0 || this.rcRound2) && m.roster.length) { this.roster = kvCopy(m.roster); this.haveRoster = true; this.lastReach = TICK; return; }   // L3.10.6
      if (this.state === 1) {
        if (m.roster.length === 0) { this.retryAt = TICK - 10; return; }
        if (this.entryTerm() && m.from >= 0) { this.gateway = m.from; this.islandAskAt = -1; this.islandAskN = 0; this.islandAsked.clear(); this.islandLast = false; }
        if (m.line >= 0) { this.lineAdopt(m.line, 'home'); if (m.lineF) this.lineFork = true; }
        this.roster = kvCopy(m.roster); this.haveRoster = true; this.lastReach = TICK; this.seatTries = 0; this.resumeTries = 0;
        let t;
        if (this.f.fabricDoors() && m.from >= 0) { this.gateway = m.from; t = lv.L16PICK ? this.pickRoster() : m.from; this.l16Gateway(m.from, lv.L16PICK === 2 ? -1 : t); }   // L16
        else t = this.pickRoster();
        if (t >= 0) this.askSeat(t); else this.retryAt = TICK - 10;
      } else if (this.state === 3 && m.roster.length) {
        this.roster = kvCopy(m.roster); this.haveRoster = true; this.rmHomeAt = TICK;   // L11
        if (this.hasCoord && this.coord.pc !== 0 && this.coord.i === 0) { const oc = this.ownerCoord(); if (oc && oc.pc === 0) { const ok = ckey(oc); if (!this.byeAt.has(ok) && !this.firstHandLive(ok) && TICK - this.lastAck >= K.L9_LONE) for (const b of m.byes) if (b === ok) { this.byeAt.set(ok, TICK); if (this.occ.has(ok)) { this.occDrop(ok, 'ring-bye'); this.live.delete(ok); this.kidful.delete(ok); } this.trace('BYE-LEARNED', id, oc, 'from=%d', m.id); break; } } }   // L9.9
        if (this.l13('L13.9') && this.hasCoord && this.coord.pc !== 0 && this.coord.i !== 0) {
          const H = { pc: this.coord.pc, r: this.coord.r, i: 0 }; const chain = FREE.l13Chain(this, H); const nc = chain.length;
          for (let l = 1; l < nc; l++) {
            if (chain[l].pc !== 0) continue; const ok = ckey(chain[l]); if (this.firstHandLive(ok) || this.translost.has(ok)) continue;
            for (const e of m.roster) {
              if (e.k !== ok) continue; const cur = this.occGet(ok);
              if (e.v >= 0 && e.v !== id && cur !== e.v && !this.liveElsewhere(e.v, ok) && (cur < 0 || !this.heardAt(ok, cur))) { this.live.delete(ok); this.liveBy.delete(ok); this.setOcc(ok, e.v); this.noteS1(ok); this.f.fabricDialJoin(id, e.v); this.l13HomeNewsAt = TICK; this.trace('L13-HOMESEAT', id, chain[l], 'from=%d v=%d was=%d lvl=%d', m.id, e.v, cur, l); }
              break;
            }
          }
        }   // L13.9
        {
          const lone = this.hasCoord && this.coord.pc === 0 && !this.hearRook();
          let put = 0;
          if (this.hasCoord && ((this.coord.pc !== 0 && this.coord.i === 0) || lone)) {
            let nr = 0;
            for (const e of m.roster) {
              if (++nr > C * C) break;
              if (ckPc(e.k) !== 0 || !cellOk(e.k) || e.v < 0 || e.v === id || this.firstHandLive(e.k) || (this.translost.has(e.k) && !(lone && this.occGet(e.k) < 0)) || (lone && !this.ownedLinkCell(e.k))) continue;
              const cur = this.occGet(e.k);
              if (cur !== e.v && !this.liveElsewhere(e.v, e.k) && (cur < 0 || (lone ? (this.rivalId >= 0 && cur === this.rivalId && !this.heardAt(e.k, cur)) : !this.heardAt(e.k, cur)))) { this.live.delete(e.k); this.liveBy.delete(e.k); this.setOcc(e.k, e.v); this.noteS1(e.k); put++; }
            }
          }
          if (put) this.l13HomeNewsAt = TICK; if (put && lone) this.announce();
        }
      }
    },

    // C++: mesh_seat.inc:Seat::onFind
    onFind(m) {
      const TICK = this.TICK;
      if (m.ttl > K.FIND_TTL) m.ttl = K.FIND_TTL; if (m.tag !== 1) this.l711Took(m);   // L7.11; FIND hop budget clamp
      if (this.f.fabricDoors() && m.tag !== 1 && m.nc >= 0 && m.nc !== this.id) this.dials.heard(m.nc);   // L16.3 + L17
      if (m.tag === 1) this.serveCompact(m);
      else {
        if (m.nc >= 0) { this.knockAt.set(m.nc, TICK); if (this.knockAt.size > 64) eraseFirst(this.knockAt); }
        if (m.nc >= 0 && m.from === m.nc && this.hasCoord && this.state === 3 && this.coord.pc === 0 && this.f.fabricDoors()) this.l16Anchor(m.nc);   // L16.2
        this.findNc = m.nc; this.serveFind(m); this.findNc = -1;
      }
    },

    // C++: mesh_seat.inc:Seat::onFindAck
    onFindAck(m) {
      if (this.state === 2 && m.nc === this.id && m.from === this.lastAsked && this.findAckAt < 0) this.findAckAt = this.TICK;
    },

    // C++: mesh_seat.inc:Seat::onFindLeaf
    onFindLeaf(m) {
      const TICK = this.TICK;
      if (roomTerm(this, 1) && m.from >= 0 && m.from !== this.id && this.hasCoord && this.state === 3 && this.coord.pc === 0 && TICK - this.c7At >= K.RELAY_TTL) { let c7Seen = false; for (const v of this.l829Bye.values()) if (TICK - v <= K.RELAY_TTL) { c7Seen = true; break; } const r = this.l828RingOf(m.from); if (c7Seen && r >= 0 && r !== this.ringName()) return; }   // L8.37
      if (this.l2514Drop(m)) return;   // L25.14
      if (m.from >= 0 && m.from !== this.id) { if (this.l25Bad(m.from)) return; this.l25OrderBy = m.from; this.l25OrderAt = TICK; }
      { const sv = this.flCur, sva = this.flCurAt, svl = this.flCurL; this.flCur = m.fo >= 0 ? m.fo : m.from; this.flCurAt = m.fo >= 0 ? m.foAt : TICK; this.flCurL = m.fo >= 0 ? m.foL : TICK; this.findLeaf(m.hole, m.nbrs, m.ttl, m.tag, m.from); this.flCur = sv; this.flCurAt = sva; this.flCurL = svl; }   // L25.7
    },

    // A newcomer that has flagged its own gateway (it sent a placement naming no neighbours) takes another door: from
    // then on its searches ask to be answered directly, so an honest placement no longer arrives through the flagged seat.
    // C++: mesh_seat.inc:Seat::l2520Door
    l2520Door(bad) {
      if (!this.f.fabricDoors() || this.hasCoord || this.state !== 2 || bad < 0 || bad !== this.gateway || this.l16GwClosed || !this.l25Bad(this.gateway)) return;
      this.l16GwClosed = true; this.trace('L25.20-DOOR', this.id, null, 'gateway=%d', this.gateway);
    },

    // C++: mesh_seat.inc:Seat::onPlace
    onPlace(m) {
      const id = this.id, lv = this.w.lv;
      if (this.l44Answer(m)) this.state = 2;   // L44.6: the answer to my own FIND, after an early re-ask sent me back to the door
      if (this.state === 2 && m.l31 === 7) return;   // L31.4: a withdrawal is no placement: the seeker has already moved on, and it names no neighbours
      if (this.state === 2 && this.l317Declined(m)) { this.trace('L31.7-DECLINED', id, m.coord, 'owner=%d at=%d', m.owner, m.ppAt); return; }   // L31.7: a placement I declined while seated is no answer to this search
      if (this.state === 2 && roomTerm(this, 1) && this.TICK - this.c7At < K.RELAY_TTL && (this.c7Old.has(m.owner) || this.c7Old.has(m.from)) && !this.l853Stays(m)) return;   // L8.5 (L8.5.3: a placer already seated in the ring we move toward names it below the ring I left)
      if (this.state === 2 && this.l851Moves(m)) return;   // L8.5.1
      if (this.state === 2 && this.l25BadPlacer.size && (this.l25Bad(m.owner) || this.l25Bad(m.from))) { this.trace('L25-BADPLACER', id, null, 'owner=%d', m.owner); this.l2520Door(m.from); if (m.nc === id) this.l711Reask('badplacer'); return; }
      if (this.state === 2 && m.nbrs.length === 0 && ckey(m.coord) !== 0) { lv.L25_TWICE++; this.l25Mark(m.owner, true); this.trace('L25-BARE-PLACE', id, m.coord, 'owner=%d', m.owner); this.l2520Door(m.owner); if (m.nc === id) this.l711Reask('bare'); return; }   // L25
      if (this.state === 2) { if (m.line >= 0) { this.lineAdopt(m.line, 'place'); if (m.lineF) this.lineFork = true; } this.take(m.coord, m.owner, m.nbrs, m.pp, m.ppAt, m.row, m.ppL); if (this.pp >= 0 && this.pp !== id) this.placer = this.pp; if (m.t14 >= 0) { if (m.t14 > 0) { this.t14Ck = m.t14; this.t14At = this.TICK | 0; } if (m.c7Min >= 0) { this.t14Ring = m.c7Min; this.t14RingAt = this.TICK | 0; } } return; }   // placer: only this intake   // TURN.14.5/6: the placer's word of the link end above the cell, and of its ring
      if (this.state === 3 && m.nc === id && m.owner >= 0 && m.owner !== id && m.l31 !== 5 && m.l31 !== 7 && m.tag !== 1 && this.hasCoord && !(m.owner === this.myPlacer && m.ppAt === this.ppAt)) this.l317Decline(m);   // L31.7
      if (this.state === 3 && (m.l31 === 5 || m.l31 === 7) && this.l31Replace(m)) return;   // L31.4
      if (this.state === 3 && m.tag === 1 && m.nc === id) lv.COMPACT_PLACES++;
      if (this.state === 3 && m.tag === 1 && m.nc === id && this.hasCoord && !this.moving && !this.hasChildren() && pcDepth(m.coord.pc) < pcDepth(this.coord.pc) && !this.firstHandLive(ckey(m.coord))) {
        let trailing = true; for (let j = this.coord.i + 1; j < C; j++) if (this.occGet(ckey({ pc: this.coord.pc, r: this.coord.r, i: j })) >= 0) { trailing = false; break; }   // re-validate clean departure
        if (trailing && this.gaAsked(m)) { lv.COMPACT_MOVES++; this.doMove(m.coord, m.owner, m.nbrs, m.pp, m.ppAt, m.ppL); if (this.moving && ckey(this.coord) === ckey(m.coord)) this.gaStart(m.owner); }   // L41 (gapa.js): only for a FIND I sent; the move asks a second word   // a contested destination is caught by E2 -> rollbackMove
      }
    },

    // C++: mesh_seat.inc:Seat::onNoRoom
    onNoRoom(m) {
      const TICK = this.TICK, id = this.id;
      if (m.tag === K.L711_TAG) { this.l711Reask('lost'); return; }   // L7.11
      if (this.state === 2) {
        if (m.nd >= this.w.lv.SPREAD_MINDEPTH) this.noroomSeen++; this.triedSilent.delete(m.id); if (this.lastAsked >= 0) this.triedSilent.delete(this.lastAsked); this.retryAt = TICK;
        if (this.f.fabricDoors() && m.split && this.l16Next < this.l16List.length) { this.trace('L16-SPLIT-FAN', id, null, 'from=%d rest=%d', m.id, this.l16List.length - this.l16Next); this.l16Wave(this.l16List.length); return; }   // L16
        if (this.f.fabricDoors() && m.gwc && m.id >= 0 && m.id !== id && this.f.fabricLinkState(id, m.id) === E.LS_OPEN && this.haveRoster && this.roster.length && ++this.seatTries <= 6) { this.askSeat(m.id, true); return; }   // L16.3
        if (this.haveRoster && this.roster.length && ++this.seatTries <= 6) { const t = this.pickRoster(); if (t >= 0) { this.askSeat(t); return; } }
        this.seatTries = 0; this.join();
      }
    },

    // C++: mesh_seat.inc:Seat::onReclaimed
    onReclaimed(m) {
      if (this.l3112On() && m.nc === this.id) this.rcRtAt = -1;   // L3.11.2: answered
      if (m.nc === this.id) this.rcSentAt = -1;   // L3.11.3: answered
      if (m.nc === this.id && m.gkey) this.genKey = m.gkey;   // L3.11.5: the hand-back carries this meeting's genesis key (C++: onReclaimed)
      const TICK = this.TICK, id = this.id;
      if ((this.state === 1 || this.state === 2) && m.nc === id && this.oldCell) {
        if (m.tag === 1 && m.ck === this.oldCell - 1) { this.oldCell = 0; this.rcPendAt = -1; this.trace('RECLAIM-TAKE', id, m.coord, 'from=%d beside', m.owner); this.take(m.coord, m.owner, m.nbrs, m.pp, m.ppAt, [], m.ppL); if (this.pp >= 0 && this.pp !== id) this.placer = this.pp; return; }   // the hole's mover already holds my old cell
        if (m.tag === 2 && ckey(m.coord) === this.oldCell - 1) { this.oldCell = 0; this.rcPendAt = -1; this.trace('RECLAIM-TAKE', id, m.coord, 'from=%d reload', m.owner); this.take(m.coord, m.owner, m.nbrs, m.pp, m.ppAt, [], m.ppL); if (this.pp >= 0 && this.pp !== id) this.placer = this.pp; return; }   // L3.11
        if (ckey(m.coord) === this.oldCell - 1 && this.rcPendAt < 0) {
          this.rcPend = msg.clone(m); this.rcPendAt = TICK; this.rcPendWait = K.RC_WAIT;
          { const dk = ckey(down(m.coord)); for (const kv of m.nbrs) if (kv.k === dk && kv.v >= 0) { this.rcPendWait = 2 * K.RC_WAIT; this.trace('RECLAIM-HOLD', id, m.coord, 'heir=%d wait=%d', kv.v, this.rcPendWait); break; } }   // L3.10.6 (I10)
          this.f.wake(id);
        }   // L3.10.4: wait RC_WAIT ticks for the cell's own occupant (a mover) to say it healed it; else take it
      }
    },

    // C++: mesh_seat.inc:Seat::onReclaimNo
    onReclaimNo(m) {
      if (this.l3112On() && m.nc === this.id) this.rcRtAt = -1;   // L3.11.2: answered
      if (m.nc === this.id) this.rcSentAt = -1;   // L3.11.3: answered
      const id = this.id;
      if (m.tag === 1 && (this.state === 1 || this.state === 2) && m.nc === id && this.oldCell && m.ck === this.oldCell - 1) { this.rcPendAt = -1; }   // L3.10.4
      if (m.tag !== 1 && (this.rcPendAt >= 0 || this.rcRound2) && m.nc === id && this.oldCell) return;   // L3.10.6
      if (m.tag === 3 && this.state === 1 && m.nc === id && this.oldCell) { this.rcPendAt = -1; this.rcRound2 = true; this.rcRound2At = this.TICK; this.rcPendWait = K.RC_WAIT; this.rcTries = 1; this.trace('RECLAIM-ROUND2', id, null, 'old=%s held', coordStr(unckey(this.oldCell - 1))); if (!this.resumeAsk()) this.join(); this.f.wake(id); return; }   // L3.10.7
      if ((this.state === 1 || (m.tag === 1 && this.state === 2)) && m.nc === id && this.oldCell) { this.movedOnFrom = this.oldCell; this.oldCell = 0; this.rcTries = 9; this.retryAt = this.TICK - 21; this.f.wake(id); }   // L3.10.5
    },

    // C++: mesh_seat.inc:Seat::onPp
    onPp(m) {
      if (m.id !== this.id || !this.hasCoord || this.state !== 3 || ckey(m.coord) !== ckey(this.coord) || m.pp < 0 || m.pp === this.id || m.ppAt < 0) return;
      if (this.pp >= 0 && !this.ppAdm(ckey(m.coord), m.pp, this.id)) return;
      this.pp = m.pp; this.ppAt = m.ppAt; this.ppL = m.ppL >= 0 ? m.ppL : this.TICK; this.ppCk = ckey(m.coord);
    },
  });

  const api = { cellOk };
  GifOS.meshRecvEntry = api;
  if (isNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
