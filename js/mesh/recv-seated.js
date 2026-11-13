/*
 * recv-seated.js: the frame handlers of a seated seat (port unit S7b): HELLO, YIELD, CLAIM, LEAVE, UNNEEDED,
 * S1SYNC, DRAIN, CHALLENGE, CONFIRM, MOVED, SITXFER / SITPING / SITPONG, PONG, ROUTE, WALK, E1STATE, the two
 * U2 frames, and byeRelay (the goodbye relay onLeave calls). Ported line for line from the 0.9.25 sim
 * (mesh_seat.inc at gifos 37d787b2d). The dispatcher that calls them is recv.js (unit recva), which also
 * carries the inline ROUTED and TRANSLOST cases. onPhone is in live.js, onPp in recv-entry.js, the MEET and
 * WITNESS handlers in heal.js and witness.js, and the vote frames in route.js.
 *
 * Port notes (see seat.js for the conventions):
 *   gate()      the sim's gate-measurement hook is left out (no seat reads it).
 *   L25_TWICE, RSEQ   the sim's counters are w.lv counters.
 *   fabric::LINKMODEL   is this.w.lv.LINKMODEL (as in rcleft-l25.js).
 *   Msg copies (Msg f=m; movedClaimMsg=m; emit of a stored frame) are msg.clone().
 *   ownerOf / standbyOf / backupOwnerOf are roles.js (they return the cell or null).
 *   u2Rows key: C++ ckey(row)*2+(m.tag==3): shared.js u2RowKey.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const RCD = ((n) => ({ L35_4_OFF: n('L35_4_OFF'), L17_3_1_OFF: n('L17_3_1_OFF'), L17_4_OFF: n('L17_4_OFF'), L35_5_OFF: ((isNode && typeof process !== 'undefined' && process.env && process.env.MESH_L35_5_OFF === '0') ? 0 : 1) }))((k) => ((isNode && typeof process !== 'undefined' && process.env && process.env['MESH_' + k] === '1') ? 1 : 0));   // the sim's build-time switches of the realcheck dead-dial laws (mesh.cpp L35_4_OFF ...): MESH_<name>=1 under node; a page runs the laws
  const seatM = req('./seat.js', 'meshSeat');
  // the sim's #define L25_21_OFF in mesh_seat.inc (a build-time switch): MESH_L25_21_OFF=1 under node, read once at load; a page always runs the law
  const L25_21_OFF = (isNode && typeof process !== 'undefined' && process.env && process.env.MESH_L25_21_OFF === '1') ? 1 : 0;
  const L25_22_OFF = (isNode && typeof process !== 'undefined' && process.env && process.env.MESH_L25_22_OFF === '1') ? 1 : 0;   // mesh_seat.inc L25_22_OFF
  const { cellOk, ownerCoordOf, coordStr, u2RowKey } = req('./shared.js', 'meshShared');
  const { Seat, FREE, roomTerm, islandStand, signedBy, l165Earlier } = seatM;
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const dig = req('./dig.js', 'meshDig');
  const e2f = req('./e2fold.js', 'meshE2fold');   // L48
  const state = req('./state.js', 'meshState');
  const roles = req('./roles.js', 'meshRoles');
  const { eraseFirst, ins } = req('./util.js', 'meshUtil');

  const K = C_.consts, E = C_.enums;
  const { ckey, ckPc, unckey, down, childPath, ownedLinks, lastDigit, parentPath } = topo;
  const C = topo.C;
  const unck = unckey;
  const newMsg = (t) => msg.newMsg(t);
  const cc = (c) => ({ pc: c.pc, r: c.r, i: c.i });
  // the sim's #define L8_52_OFF in mesh.cpp (a build-time switch): MESH_L8_52_OFF=1 under node, read once at load; a page always runs the law
  const L8_52_OFF = (isNode && typeof process !== 'undefined' && process.env && process.env.MESH_L8_52_OFF === '1') ? 1 : 0;
  const kvCopy = (a) => a.map((e) => ({ k: e.k, v: e.v }));
  const hello = (ck, id) => { const h = newMsg('HELLO'); h.ck = ck; h.id = id; return h; };


  Seat.unit('mesh_seat.inc recv seated handlers', {
    // C++: mesh_seat.inc:Seat::l2522Keep
    // L25.22: a mover's claim refused for its old cell is read again at its goodbye from that cell (one slot; an arrival's claim only).
    l2522Keep(m, from, sure) {
      if (L25_22_OFF || !sure || m.arr < 0 || m.arr > K.L11_ARRIVE) return;
      this.l2522Id = m.id; this.l2522At = this.TICK; this.l2522From = from; this.l2522Msg = msg.clone(m);
    },
    // C++: mesh_seat.inc:Seat::l2522Bye
    l2522Bye(x, from, mv) {
      if (this.l2522Id < 0 || x !== this.l2522Id || from !== this.l2522From) return;
      const TICK = this.TICK;
      const ok = mv && this.state === 3 && this.hasCoord && this.occGet(from) !== x && TICK - this.l2522At + this.l2522Msg.arr <= K.L11_ARRIVE;
      const h = this.l2522Msg; h.arr += TICK - this.l2522At; this.l2522Id = -1; this.l2522At = -99999; this.l2522From = 0; this.l2522Msg = newMsg(msg.MT_NAMES[0]);
      if (!ok) return;
      this.trace('L25.22-CLAIM', this.id, unck(h.ck), 'from=%d left=%s held=%d', x, coordStr(unck(from)), h.arr);
      this.onHello(h);
    },
    // C++: mesh_seat.inc:Seat::l2521First
    // L25.21: two arrivals at one cell are ordered once, by L16.7. Inside L16.7's hearing window, between two arrivals, L25's holder word does
    // not name the incumbent to the claimant L16.7 keeps (the two words named different seats and both left on a quorum).
    l2521First(m, sure) {
      const TICK = this.TICK;
      if (L25_21_OFF || !this.f.fabricDoors() || !sure || m.arr < 0 || m.arr > K.L11_ARRIVE) return false;
      const p = this.occGet(m.ck); const pb = this.bornOf(m.ck, p); if (pb === null) return false;
      const cb = this.claimBorn(m); if (cb < 0 || TICK - pb > K.L11_ARRIVE) return false;
      const d = pb - cb; if (d > K.L167_W || d < -K.L167_W || !seatM.placeBefore(m.id, cb, p, pb)) return false;
      this.trace('L25.21-ORDER', this.id, unck(m.ck), 'first=%d incumbent=%d d=%lld', m.id, p, d);
      return true;
    },

    // C++: mesh_seat.inc:Seat::onHello
    onHello(m) {
      const id = this.id, TICK = this.TICK, lv = this.w.lv;
      if (this.t14Come(m)) return;   /* TURN.14.13 */
      // A HELLO is FIRST-HAND: its sender (m.id) is speaking on a link it holds to me, claiming coord m.ck.
      if (m.id < 0 || !cellOk(m.ck)) return;
      if (this.f.fabricDoors()) { const lb = this.l152Bye.get(m.id); if (lb !== undefined && lb[0] === m.ck && TICK - lb[1] <= 2) return; }   // L15.2 for a HELLO
      if (m.sw >= 0 && this.l4SwapHello(m)) return;   // L4.3
      if (this.l850(m)) return;   // L8.50: a founder of one and a room
      if (this.islandC7(m)) return;   // L8.5
      if (m.rmKids && this.hasCoord && this.state === 3 && this.rowLedgerAt < this.rmBornAt && TICK - this.rmBornAt <= K.LEASE_T) this.rmHistAt = TICK;
      if (m.arr >= 0 && m.id !== id && !(this.hasCoord && m.ck === ckey(this.coord)) && (this.occGet(m.ck) < 0 || this.occGet(m.ck) === m.id)) { const b = this.rmBirthOf.get(m.ck); if (b === undefined || b[0] !== m.id) { if (this.rmBirthOf.size >= 4 * C) eraseFirst(this.rmBirthOf); this.rmBirthOf.set(m.ck, [m.id, this.claimBorn(m)]); } }   // L11
      const sure = this.linkIs(m, m.id);
      // TWO RINGS: a persistent stranger's door greeting about a Section-1 cell is taken as main took it
      const xrS = this.hasCoord && this.state === 3 && this.coord.pc === 0 && unck(m.ck).pc === 0 && this.strangerOk(m.id);
      const xr = !sure && xrS;
      if (!xr && !this.claimRel(m.ck, m.id, false)) return;
      const ppn = this.ppValid(m); if (ppn) this.ppNote(m.ck, m.id, seatM.ppSigOf(m.pp, m.ppAt), m.pp, m.ppL);
      const prov = (ppn && this.ppAdm(m.ck, m.pp, m.id)) || this.mpProven(m);   // L25.7
      if (ppn && this.bareAt.size && this.occGet(m.ck) === m.id && this.ppAdm(m.ck, m.pp, m.id)) this.bareAt.delete(m.ck);   // L25
      if (this.hasCoord && this.state === 3 && m.ck === ckey(this.coord) && m.id !== id) {
        // a rival for MY cell: only Section 1 is settled by challenge (a deep cell by its one arbiter)
        {
          if ((this.l25Stand(m.id) || prov) && !this.l858Ring(m) && this.rmRival(m.id, m.arr, 'hello', ppn ? m.pp : -1)) return;   // L25 / L11
          if (m.arr >= 0 && m.arr <= K.L11_ARRIVE) { const a = this.rmAnsTo.get(m.id); if (a === undefined || TICK - a >= 8) { if (a === undefined && this.rmAnsTo.size >= 32) eraseFirst(this.rmAnsTo); this.rmAnsTo.set(m.id, TICK); this.emit(m.id, hello(m.ck, id)); } }
        }
        if (sure && !(this.movedClaimId >= 0 && this.movedClaimId === m.id)) {
          for (const [ek, ev] of this.occ) {
            if (ev !== m.id || ek === m.ck || !this.firstHandLive(ek)) continue;
            const l = this.linkedBy.get(ek); if (l === undefined || l !== m.id) continue;
            const k2 = ek; if (!this.translost.has(k2)) { this.translost.set(k2, TICK); this.tlProbeAt.set(k2, TICK); if (this.routeToProbe(unck(k2)) && !this.tlSent.has(k2)) this.tlSent.set(k2, TICK); }
            this.movedClaimId = m.id; this.movedClaimK = k2; this.movedClaimAt = TICK; this.movedClaimMsg = msg.clone(m); break;
          }
        }   // the rival's word is PROBED, not taken
        if (this.coord.pc !== 0 || this.liveElsewhereSinceReturn(m.id, m.ck)) return;
        // A FRAGMENT OF ONE MEETS THE RING
        if (sure) { this.rivalId = m.id; this.rivalAt = TICK; this.loneAsk(); }
        if (!(xrS || this.fresh() || !this.hearRook())) { if (sure && TICK - this.challAt > 20) { this.challAt = TICK; this.emit(m.id, hello(m.ck, id)); } return; }   // a tenured incumbent answers every link-proven rival
        if (!sure && !xr) { for (const [ek, ev] of this.occ) if (ev === m.id && ek !== m.ck) return; }
        // PP: a rival contests my cell only with a placement proof my view admits here
        if (ppn && m.pp >= 0 && !this.ppAdm(m.ck, m.pp, m.id)) this.l25131Ask(m);   // L25.13.1: a rival's placement by a placer I do not admit: that placer is asked
        if (!(ppn && this.ppAdm(m.ck, m.pp, m.id)) && !(this.pp < 0 && !this.hearRook())) { if (sure && TICK - this.challAt > 20) { this.challAt = TICK; this.emit(m.id, hello(m.ck, id)); } return; }
        if (TICK - this.challAt > 20) {
          this.challAt = TICK;
          if (m.id < id) { this.challToId = m.id; this.challToCk = m.ck; this.challToAt = TICK; const c = newMsg('CHALLENGE'); c.ck = m.ck; c.from = id; this.emit(m.id, c); }
          else this.emit(m.id, hello(m.ck, id));
        }
        return;
      }
      if (!this.l25Stand(m.id) && this.occGet(m.ck) >= 0 && this.occGet(m.ck) !== m.id && this.occGet(m.ck) !== id && !prov && !(ppn && m.pp === this.occGet(m.ck)) && !this.l2521First(m, sure)) {
        const la = this.lkAt.get(m.ck); const bi = this.byeId.get(m.ck);
        if (la !== undefined && TICK - la <= K.L25_BEAT && !(this.byeAt.has(m.ck) && bi !== undefined && bi === this.occGet(m.ck))) {
          lv.L25_TWICE++;
          if (sure) { const yt = this.l25YieldTo.get(m.id); if (yt === undefined || TICK - yt >= 16) { if (this.l25YieldTo.size > 64) this.l25YieldTo.clear(); this.l25YieldTo.set(m.id, TICK); const y = newMsg('YIELD'); y.ck = m.ck; y.id = id; y.nc = this.occGet(m.ck); if (this.byeFloor(y.nc, m.ck) >= 0) this.l167Attach(y, m.ck, y.nc);   /* L25.19.1 */ this.emit(m.id, y); } }
          return;
        }
      }   // L25: a bare word does not take a cell from a seat whose beats reach me over its own channel
      if (!this.l25Stand(m.id) && this.occGet(m.ck) !== m.id && !prov) { for (const [ek, ev] of this.occ) if (ev === m.id && ek !== m.ck && this.holdsCell(ek, 60)) { lv.L25_TWICE++; this.l2522Keep(m, ek, sure); return; } }   // L25: a seat is in one place
      let prev = this.occGet(m.ck);
      // E2: yield only between FIRST-HAND-LIVE claimants.
      if (prev >= 0 && prev !== m.id && m.pp === prev) { this.occDrop(m.ck, 'handed'); this.live.delete(m.ck); prev = -1; }   // L3.10.4
      let prevFresh = prev >= 0 && prev !== m.id && (this.holdsCell(m.ck, 60) || this.heldRedial(m.ck, prev, 60));   // L16.7
      let l165Dec = false, l165MWins = false;
      if (this.f.fabricDoors() && ckPc(m.ck) === 0 && prev >= 0 && prev !== m.id && prevFresh) { const r51 = this.l51Rooms(m.id, prev);   // L8.51 (mesh_island.inc): a contest between two rooms is the merge's
        if (r51 === 1) { const c = unck(m.ck); this.trace('L8.51-HOLD', id, c, 'mine=%d other=%d', prev, m.id); return; }
        if (r51 === 2) { const c = unck(m.ck); this.trace('L8.51-HOLD', id, c, 'mine=%d other=%d', m.id, prev); this.occDrop(m.ck, 'L8.51'); this.live.delete(m.ck); prev = -1; prevFresh = false; }
      }
      if (this.f.fabricDoors() && ckPc(m.ck) === 0 && prev >= 0 && prev !== m.id && prevFresh) {
        const h1 = this.l165Have(m.ck, m.id); const h2 = h1 ? this.l165Have(m.ck, prev) : null;
        if (h1 && h2) {
          const f1 = h1.from, a1 = h1.at, l1 = h1.loc, f2 = h2.from, a2 = h2.at, l2 = h2.loc;
          l165Dec = true; l165MWins = l165Earlier(l1, f1, m.id, l2, f2, prev); const winner = l165MWins ? m.id : prev, loser = l165MWins ? prev : m.id;
          const y = newMsg('YIELD'); y.tag = 2812; y.ck = m.ck; y.id = id; y.nc = winner; y.pp = l165MWins ? f1 : f2; y.ppAt = l165MWins ? a1 : a2; y.ppL = l165MWins ? l1 : l2; this.emit(loser, y);
          { const c = unck(m.ck); this.trace('L16.5-YIELD', id, c, 'loser=%d winner=%d', loser, winner); }
          if (!l165MWins) return;
        }
      }   // L16.5: the later placement yields; the earlier one is written in
      if (!sure && !xr) {
        // UNPROVEN (relay/sponsor): never displaces an incumbent
        if (prev >= 0 && prev !== m.id && prevFresh) {
          if (m.id > prev || (m.arr >= 0 && m.arr <= K.L11_ARRIVE && this.heldRightNow(m.ck))) {
            const y = newMsg('YIELD'); y.tag = 2816; y.ck = m.ck; y.id = id; y.nc = prev; this.l165Attach(y, m.ck, prev); this.l167Attach(y, m.ck, prev);
            let l824u = false; if (roomTerm(this, 1) && m.arr >= 0 && m.arr <= K.L11_ARRIVE) { const hsit = this.heardSince.get(m.ck); if (hsit !== undefined && m.arr > TICK - hsit) l824u = true; }
            if (!l824u) this.emit(m.id, y);
          } else {   // L11: an arrival's claim on a cell I hear held loses to the holder, whatever the ids
            if (this.waitClaim.size >= 32) eraseFirst(this.waitClaim); this.waitClaim.set(m.ck, [m.id, TICK]);
          }
          return;
        }
        if (prev !== m.id && this.hintClaim(m.ck, m.id)) { if (this.hasCoord) this.emit(m.id, hello(ckey(this.coord), id)); }
        else if (prev === m.id && this.hasCoord && this.state === 3 && !this.holdsCell(m.ck, 60)) {   // HELLO_BACK
          const hb = this.helloBack.get(m.id);
          if (hb === undefined || TICK - hb > K.HELLO_BACK) { if (hb === undefined && this.helloBack.size >= 32) eraseFirst(this.helloBack); this.helloBack.set(m.id, TICK); this.emit(m.id, hello(ckey(this.coord), id)); }
        }
        { const dh = this.darkHold.get(m.ck); if (roomTerm(this, 1) && this.occGet(m.ck) !== m.id && dh !== undefined && dh === m.id) return; }   // L8.43
        this.clearVouch(m.ck, m.id, 'hello');
        return;
      }
      if (!l165Dec && this.f.fabricDoors() && sure && prev >= 0 && prev !== m.id && prevFresh && m.born >= 0) {
        const pb0 = this.bornOf(m.ck, prev);
        if (pb0 === null) { const w = this.l167Wait.get(m.ck); if (w === undefined) { if (this.l167Wait.size >= 4 * C) eraseFirst(this.l167Wait); this.l167Wait.set(m.ck, TICK); return; } if (TICK - w <= K.L167_WAIT) return; }
        else this.l167Wait.delete(m.ck);
      }   // L16.7
      if (!l165Dec && this.f.fabricDoors() && sure && prev >= 0 && prev !== m.id && prevFresh && m.arr >= 0) {
        const pb = this.bornOf(m.ck, prev);
        if (pb !== null) {
          const d = pb - this.claimBorn(m); const mWins = seatM.placeBefore(m.id, this.claimBorn(m), prev, pb); l165Dec = true; l165MWins = mWins;
          const winner = mWins ? m.id : prev, loser = mWins ? prev : m.id;
          const y = newMsg('YIELD'); y.tag = 2839; y.ck = m.ck; y.id = id; y.nc = winner; y.born = mWins ? this.claimBorn(m) : pb; this.l165Attach(y, m.ck, winner); this.emit(loser, y);
          { const c = unck(m.ck); this.trace('L16.7-YIELD', id, c, 'loser=%d winner=%d d=%lld', loser, winner, d); }
          if (!mWins) return;
        }
      }   // L16.7
      if (!l165Dec && prevFresh && this.rawClaim(m.ck, m.id, 60)) {   // TENURE (law S2): a tenured incumbent beats a raw claim
        let l823 = false;
        if (roomTerm(this, 1) && this.hasCoord && this.coord.pc === 0 && m.c7Min >= 0 && m.c7Min !== this.ringName() && this.c7At < -100000) {
          const ss = this.strangeSeen.has(m.id) ? this.strangeSeen.get(m.id) : 0;
          let xr23 = false; const xit = this.xrOk.get(m.id); if (xit !== undefined && TICK - xit <= 2 * K.RELAY_TTL) xr23 = true;
          let inn = false; for (const [, ev] of this.occ) if (ev === m.id) { inn = true; break; }
          const vit = this.c7Vouch.get(m.c7Min);
          if (!inn && ss === 0 && xr23 && vit !== undefined && vit.size === 1) l823 = true;
        }
        let l824 = false;   // L8.24
        if (roomTerm(this, 1) && m.arr >= 0 && m.arr <= K.L11_ARRIVE) { const hsit = this.heardSince.get(m.ck); if (hsit !== undefined && m.arr > TICK - hsit) l824 = true; }
        if (!l823 && !l824) { const y = newMsg('YIELD'); y.tag = 2835; y.ck = m.ck; y.id = id; if (this.f.fabricDoors()) y.nc = prev; this.l165Attach(y, m.ck, prev); this.l167Attach(y, m.ck, prev); this.emit(m.id, y); }
        return;
      }
      if (sure && this.ownedLinkCell(m.ck)) this.nbrHeard();
      if (prev >= 0 && prev !== m.id && prevFresh && this.liveElsewhere(m.id, m.ck)) { if (m.id > prev) { const y = newMsg('YIELD'); y.tag = 2838; y.ck = m.ck; y.id = id; if (!this.l25Stand(m.id)) y.nc = prev; this.emit(m.id, y); } return; }   // a seat is in ONE place
      if (prev < 0 && m.arr >= 0 && m.arr <= K.L11_ARRIVE && this.softSitting(m.ck) && this.sitting.get(m.ck).joiner !== m.id && TICK - this.sitting.get(m.ck).at <= K.CONFIRM_TTL && !(this.f.fabricDoors() && ckPc(m.ck) === 0 && m.pp >= 0 && m.ppL >= 0 && l165Earlier(m.ppL, m.pp, m.id, this.sitting.get(m.ck).at, id, this.sitting.get(m.ck).joiner)) && !(this.f.fabricDoors() && sure && (this.sitting.get(m.ck).at - this.claimBorn(m) > K.L167_W || (this.sitting.get(m.ck).at - this.claimBorn(m) >= -K.L167_W && m.id < this.sitting.get(m.ck).joiner))) && !(this.f.fabricDoors() && sure)) {
        const y = newMsg('YIELD'); y.tag = 2840; y.ck = m.ck; y.id = id; y.nc = this.sitting.get(m.ck).joiner; if (this.f.fabricDoors()) { y.pp = id; y.ppAt = this.sitting.get(m.ck).at; } this.emit(m.id, y); return;   // L32.6 / L11
      }
      if (!l165Dec && prev >= 0 && prev !== m.id && prevFresh && this.heldRightNow(m.ck) && m.arr >= 0 && m.arr <= K.L11_ARRIVE && !(roomTerm(this, 1) && this.l836Merging() && (!this.live.has(m.ck) || this.live.get(m.ck) < TICK - m.arr))) {
        const y = newMsg('YIELD'); y.tag = 2841; y.ck = m.ck; y.id = id; y.nc = prev; this.l165Attach(y, m.ck, prev); this.l167Attach(y, m.ck, prev);
        if (roomTerm(this, 1) && ckPc(m.ck) === 0 && this.c7At > -1000000 && TICK - this.c7At <= 32) { if (this.l815N < 8) { this.l815At[this.l815N] = TICK; this.l815Ck[this.l815N] = m.ck; this.l815To[this.l815N] = m.id; this.l815Prev[this.l815N] = prev; this.l815N++; } else this.emit(m.id, y); }
        else this.emit(m.id, y);
        return;   // L11 / L8.15
      }
      if (!l165Dec && prev >= 0 && prev !== m.id && prevFresh) { const y = newMsg('YIELD'); y.tag = 2842; y.ck = m.ck; y.id = id; const keep = m.id > prev ? prev : m.id; if (this.f.fabricDoors()) y.nc = keep; this.l165Attach(y, m.ck, keep); this.l167Attach(y, m.ck, keep); this.emit(m.id > prev ? m.id : prev, y); }   // two live seats at one coord: lower id wins, higher yields
      if (!l165Dec && prev >= 0 && prev !== m.id && prevFresh && m.id > prev) return;
      if ((roomTerm(this, 1) || this.l13('L13.1')) && sure) this.noChan.delete(m.id);   // L8.9 / L13.1

      if (prev !== m.id) {
        { const bare = prev < 0 && !prov; this.bareSetting = bare; this.setOcc(m.ck, m.id); this.bareSetting = false; if (bare && this.occGet(m.ck) === m.id) { if (this.bareAt.size > 64) this.bareAt.clear(); this.bareAt.set(m.ck, TICK); } }
        if (this.hasCoord) {
          const h = hello(ckey(this.coord), id);
          { const kc = unck(m.ck); const R = { pc: childPath(kc.pc, kc.i), r: kc.r, i: 0 }; const u = this.u2Rows.get(ckey(R) * 2); if (u !== undefined && u.heir >= 0 && TICK - u.at <= 16) h.rmKids = true; }   // L11
          this.emit(m.id, h);
        }
      }
      { const l89 = !(roomTerm(this, 1) && this.occGet(m.ck) !== m.id); if (l89) this.liveMark(m.ck);   // L8.9
        if (sure) this.noteLinked(m.ck, m.id, m.tn);
        if (l89) this.noteS1(m.ck); }
      // A, ATTRIBUTABLE (V4): HELLO from THE SOFT-SIT JOINER ITSELF self-confirms the seat
      this.clearVouch(m.ck, m.id, 'hello');
    },

    // C++: mesh_seat.inc:Seat::onYield
    onYield(m) {
      const id = this.id, TICK = this.TICK;
      // honoured only from my ARBITER, proven the sender
      if (!this.hasCoord || this.state !== 3 || ckey(this.coord) !== m.ck) return;
      const by = m.id;
      if (by < 0 || by === id || !this.provenEv(m, by)) return;
      if (this.l13('L13.1') && this.linkIs(m, by)) { const ak0 = this.arbCellOf(by); if (ak0 !== null && this.occGet(ak0) === by) { this.liveMark(ak0); this.pongBy.set(ak0, [by, TICK]); } }   // L13.1
      // one arbiter's word suffices; a MOVER in dual-hold only rolls back
      {
        let ok = this.arbOk(by); if (!ok && this.moving) { for (const c of ownedLinks(this.coord)) if (this.occGet(ckey(c)) === by) { ok = true; break; } }
        if (!ok) { const ak = this.arbCellOf(by); if (ak !== null) ok = this.lateQuorum(by, ak, m.ck); }   // two later arbiters agreeing

        if (!ok && this.l13('L13.1') && this.linkIs(m, by) && this.coord.pc !== 0 && this.coord.i !== 0) {
          const ak = ckey({ pc: this.coord.pc, r: this.coord.r, i: 0 }); let l327 = false;
          if (this.occGet(ak) >= 0 && this.occGet(ak) !== by && !this.firstHandLive(ak)) { const lvv = this.live.get(ak); l327 = lvv === undefined || TICK - lvv >= 60; }   // L32.7
          if ((this.occGet(ak) < 0 || l327) && TICK - this.l13KnockAt >= 8) { this.l13KnockAt = TICK; const q = newMsg('MEET'); q.ck = ckey(this.coord); q.id = id; q.oCk = ak; q.owner = -1; this.emit(by, q); const ac = unck(ak); this.trace('L13-WHOYIELDS', id, ac, 'by=%d', by); }
        }   // L13.1
        if (!ok && !this.l25Stand(m.nc >= 0 ? m.nc : by, true) && !this.moving && m.nc >= 0 && m.nc !== id && m.nc !== by && TICK - this.seatedAt < K.L11_ARRIVE) { this.l25Ask(m, by, true); return; }   // L25
        if (!ok) this.l391Ask(m, by);   // L39.1: a yield from a seat of my rook over its own link puts L25's question (gaps3.js)
        if (!ok) { const ak = this.arbCellOf(by); const hasAk = ak !== null; if (this.l8511Drop(by)) return;   /* L8.51.1 (mesh_island.inc) */ if (!this.arbiterIs(by) || (hasAk && this.ppPendingSim(ak, by))) { this.pendYBy = by; this.pendYAt = TICK; this.pendYCk = m.ck; this.pendYNc = m.nc; this.pendYPp = m.pp; this.pendYPpAt = m.ppAt; this.pendYPpL = m.ppL; this.pendYBorn = m.born; } return; }
      }
      if (roomTerm(this, 1) && m.nc >= 0 && m.nc !== id) { const cb = this.l829Bye.get(m.nc); if (cb !== undefined && TICK - cb <= K.RELAY_TTL) { this.trace('L8.29-ANSWER', id, this.coord, 'by=%d named=%d', by, m.nc); this.emit(by, hello(ckey(this.coord), id)); return; } }   // L8.29
      if (this.f.fabricDoors() && !this.moving && this.coord.pc === 0 && m.pp >= 0 && m.ppL >= 0 && this.pp >= 0 && this.ppL >= 0 && this.ppCk === ckey(this.coord) && m.nc >= 0 && m.nc !== id && l165Earlier(this.ppL, this.pp, id, m.ppL, m.pp, m.nc)) { this.emit(by, hello(ckey(this.coord), id)); this.trace('L16.5-STAND', id, this.coord, 'by=%d rival=%d', by, m.nc); return; }
      if (this.l167Stand(m.nc, m.born)) { this.emit(by, hello(ckey(this.coord), id)); this.trace('L16.7-STAND', id, this.coord, 'by=%d rival=%d rivalBorn=%lld born=%lld', by, m.nc, m.born, this.rmBornAt); return; }
      if (!this.moving && this.l25Yield(m, by)) return;   // L25
      if (!this.moving && this.placer >= 0 && this.placer !== by && TICK - this.seatedAt < K.L11_ARRIVE) this.l25Mark(this.placer);
      if (!this.moving && this.l25OrderBy >= 0 && TICK - this.l25OrderAt <= 2 * K.L11_ARRIVE && this.l25OrderBy !== by && TICK - this.seatedAt < K.L11_ARRIVE) this.l25Mark(this.l25OrderBy);
      this.trace('YIELD-TAKEN', id, this.coord, 'by=%d site=%d nc=%d ypp=%d yppAt=%d mypp=%d myppAt=%d born=%lld moving=%d', by, m.tag, m.nc, m.pp, m.ppAt, this.pp, this.ppAt, this.rmBornAt, this.moving ? 1 : 0);
      if (this.moving) { this.rbWhy = 'yield'; this.rollbackMove(); } else this.l40Go(m.nc !== id ? m.nc : -1, 'T1-yield');   // T1 (L40.3: an arbiter's yield names the cell's holder too)
      if (m.nc >= 0 && m.nc !== id && this.hasCoord && this.state === 3 && ckey(this.coord) !== m.ck && this.occGet(m.ck) !== m.nc && !this.liveElsewhere(m.nc, m.ck)) { this.setOcc(m.ck, m.nc); this.noteHand(m.ck, m.nc); }   // L11
    },

    // C++: mesh_seat.inc:Seat::onClaim
    onClaim(m) {
      if (m.id < 0 || !cellOk(m.ck)) return;
      if (this.ppValid(m)) this.ppNote(m.ck, m.id, seatM.ppSigOf(m.pp, m.ppAt), m.pp, m.ppL);   // PP
      // A: joiner self-confirm
      { const sit = this.sitting.get(m.ck); if (sit !== undefined && sit.joiner === m.id) { if (roomTerm(this, 1) && this.linkIs(m, m.id) && this.noChan.has(m.id)) { this.noChan.delete(m.id); this.trace('L8.35-CHAN', this.id, null, 'joiner=%d cell=%s', m.id, coordStr(unck(m.ck))); } this.confirmSeated(m.ck, m.id); return; } }   // L8.35
      if (this.hasCoord && m.ck === ckey(this.coord)) return;
      if (!this.claimRel(m.ck, m.id, true)) return;
      if (this.linkIs(m, m.id)) { if (!this.rawClaim(m.ck, m.id, 60)) { const s2 = this.sitting.get(m.ck); if (s2 !== undefined && s2.joiner !== m.id) { this.setOcc(m.ck, m.id); this.liveMark(m.ck); this.noteS1(m.ck); } else this.confirmSeated(m.ck, m.id); } } else this.hintClaim(m.ck, m.id);
    },

    // C++: mesh_seat.inc:Seat::onLeave
    onLeave(m) {
      const id = this.id, TICK = this.TICK;
      this.l44Left(m.ck, m.id);   // L44.2 (burst.js)
      if (roomTerm(this, 1) && m.c7 && m.id >= 0 && this.provenEv(m, m.id)) { this.l829Bye.set(m.id, TICK); if (this.l829Bye.size > 128) this.l829Bye.clear(); }   // L8.29
      if (roomTerm(this, 1) && !m.c7 && m.c7Min >= 0 && m.id >= 0 && this.hasCoord && this.state === 3 && (TICK - this.c7At >= K.RELAY_TTL || this.l8510Bye(m)) && this.ringName() === m.c7Min && this.occGet(m.ck) === m.id && this.provenEv(m, m.id) && this.l42Second(m)) { if (TICK - this.c7At < K.RELAY_TTL) this.trace('L8.5.10-PAST', id, this.coord, 'bye=%d mine=%d since=%d', m.id, this.lineAt, (TICK - this.c7At) | 0); this.trace('L8.34-FOLLOW', id, this.coord, 'from=%d ring=%d', m.id, m.c7Min); this.t161Note(m.id); this.c7Yield(m.c7Min); return; }   // L8.34
      if (roomTerm(this, 1) && m.c7 && this.hasCoord && this.state === 3) { if (TICK - this.c7At >= K.RELAY_TTL || this.l8510Bye(m)) { let mate = false; for (const [, ev] of this.occ) if (ev === m.id) { mate = true; break; } if (mate && this.ringName() === m.c7Min && this.provenEv(m, m.id) && this.l42Second(m)) { if (TICK - this.c7At < K.RELAY_TTL) this.trace('L8.5.10-PAST', id, this.coord, 'bye=%d mine=%d since=%d', m.id, this.lineAt, (TICK - this.c7At) | 0); this.t161Note(m.id); this.c7Yield(m.c7Min); return; } } if (this.c7Follow(m)) return; }   // L8.5 / L8.6
      else if (roomTerm(this, 1) && !m.c7 && m.c7Min >= 0 && this.hasCoord && this.state === 3 && this.c7Follow(m)) return;   // L8.40
      // FRAME AUTHORITY: a goodbye frees the LEAVER'S OWN cell
      if (m.id < 0 || !cellOk(m.ck) || (m.mvd && !cellOk(m.mvd)) || !this.provenEv(m, m.id)) return;
      if (this.l40Handed(m)) return;   // L40.3: a yield's goodbye names the cell's holder (gaps4.js)
      if (this.l13('L13.7') && m.bye && !m.mvd && this.hasCoord && this.state === 3 && this.coord.pc !== 0 && this.coord.i === 0 && m.ck !== ckey(this.coord) && unck(m.ck).pc === this.coord.pc && unck(m.ck).r === this.coord.r) { this.l13ByeKids.set(m.ck, [m.kids ? 1 : 0, TICK]); if (m.child >= 0 && m.child !== id && !this.childOf.has(m.ck)) this.childOf.set(m.ck, m.child); }   // L13.7
      { const lh = this.l20Hold.get(m.ck); if (lh !== undefined && lh.x === m.id && !lh.bye) { lh.bye = true; const hc = unck(m.ck); this.trace('L20-BYE', id, hc, 'mate=%d held=%d', m.id, TICK - lh.at); } }   // L20
      { if (this.l152Bye.size >= 256) this.l152Bye.clear(); this.l152Bye.set(m.id, [m.ck, TICK]); }   // L15.2
      if (this.l4ExecAt >= 0 && m.id === this.l4Partner) { this.l4ExecAt = -1; this.f.fabricNoteSwap(id, 3); this.trace('SWAP-ABORT', id, this.coord, 'partner=%d left', m.id); }   // L4.3
      if (m.rel) { this.relMark.set(m.id, TICK); this.trace('RELOAD-BYE', id, this.hasCoord ? this.coord : null, 'from=%d cell=%s', m.id, coordStr(unck(m.ck))); return; }   // L3.11
      // C++: mesh_seat.inc:Seat::onLeave
      this.f.l23GreetRelease(id, m.id);   // the seat that greeted me has left: the greeting it had started here ends with it (a reload is not a goodbye)
      if (m.bye && !m.mvd) { this.noteBye(m.id); if (m.id !== id) this.dials.holdGone(m.id, TICK + K.GONE_DIAL); }
      if (m.mvd && m.ck < 65536) { this.l3109Ck = m.ck + 1; this.l3109At = this.TICK; }   // L3.10.9
      this.memo.delete(m.ck);   // L3.10a (the relay's greeter-gone is a death word, never a goodbye: it does not reach here, L3.1)
      if (m.mv && m.nc >= 0 && m.nc !== m.id && this.hasCoord && ckey(this.coord) !== m.ck && this.occGet(m.ck) === m.id) { this.setOcc(m.ck, m.nc); this.live.delete(m.ck); this.trace('HANDED', id, this.coord, 'cell=%s to=%d by=%d', coordStr(unck(m.ck)), m.nc, m.id); return; }   // L3.10.4
      // D2 RELAY
      if (m.rl && m.yl) {   // L21
        if (!this.hasCoord || this.state !== 3 || this.coord.pc !== 0 || ckPc(m.ck) !== 0 || m.ck === ckey(this.coord) || !(m.sig && m.sigL >= 0 && TICK - m.sigL <= 60)) return;
        if (this.l152Bye.size >= 256) this.l152Bye.clear(); this.l152Bye.set(m.id, [m.ck, TICK]);
        if (this.occGet(m.ck) === m.id && (!this.firstHandLive(m.ck) || this.l167Gone(m))) { this.occDrop(m.ck, 'leave'); this.live.delete(m.ck); this.s1seen.delete(m.ck); this.kidful.delete(m.ck); this.tlForget(m.ck); }
        this.l43Relay(m); this.l21Relay(m); return;
      }
      if (m.rl) {
        if (!m.bye || m.mvd || !this.hasCoord || this.state !== 3) return;
        const liveR = m.sig && m.sigL >= 0 && TICK - m.sigL <= 60;
        let okR; { const t = this.tenOf.get(m.ck); okR = (t !== undefined && t[0] === m.id) ? (m.tn >= 0 && m.tn === t[1]) : liveR; }
        // L9.6
        if (!okR || this.occGet(m.ck) !== m.id || m.ck === ckey(this.coord)) return;
        if (this.relStake(m.ck)) { this.byeRelay(m); return; }
        { const lc = unck(m.ck); const h = this.occGet(ckey({ pc: lc.pc, r: lc.r, i: 0 })); if (lc.i === 0 || h < 0 || h === m.id) { this.byeRelay(m); return; } }
        this.linkedBy.delete(m.ck); this.tenOf.delete(m.ck); this.occDrop(m.ck, 'leave'); this.live.delete(m.ck); this.kidful.delete(m.ck); this.s1seen.delete(m.ck); this.tlForget(m.ck); this.healTry.delete(m.ck); this.digForget(m.ck);
        { const sit = this.sitting.get(m.ck); if (sit !== undefined && sit.joiner === m.id) { this.sitting.delete(m.ck); } }
        this.lastChurn = TICK; this.l12DepartAt = TICK;
        if (ckPc(m.ck) === 0) this.byeAt.set(m.ck, TICK);   // L1.5
        this.byeRelay(m);
        return;
      }
      this.lastChurn = TICK;
      // TENANCY (R5)
      const s4live = m.sig && m.sigL >= 0 && TICK - m.sigL <= 60;
      let tenOk; { const t = this.tenOf.get(m.ck); tenOk = (t !== undefined && t[0] === m.id) ? (m.tn >= 0 && m.tn === t[1]) : s4live; }
      const mine = this.occGet(m.ck) === m.id && tenOk;
      // The leaver's channel had already been dead
      if (mine) { const l = this.linkedBy.get(m.ck); const at = this.lkAt.get(m.ck); if (l !== undefined && l === m.id && at !== undefined && TICK - at > K.DARK_LEAVE / 2) this.noChan.add(m.id); }
      { const dh = this.darkHold.get(m.ck); if (dh !== undefined && dh === m.id) this.darkHold.delete(m.ck); }
      // WHERE it went is taken only from a stay a LINK proved
      let mvdFrom = false; if (mine && m.mvd) { const t = this.tenOf.get(m.ck); const l = this.linkedBy.get(m.ck); mvdFrom = t !== undefined && t[0] === m.id && m.tn >= 0 && m.tn === t[1] && l !== undefined && l === m.id && this.mvdOk(m.ck, m.mvd, m.id); }
      if (mvdFrom) this.carryLinked(m.ck, m.mvd, m.id);
      if (mine) { { this.c7PlainId = m.id; this.c7PlainCk = m.ck; this.c7PlainAt = TICK; } this.linkedBy.delete(m.ck); this.tenOf.delete(m.ck); this.occDrop(m.ck, 'leave'); this.live.delete(m.ck); this.kidful.delete(m.ck); this.s1seen.delete(m.ck); this.tlForget(m.ck); this.healTry.delete(m.ck); this.digForget(m.ck); if (m.bye && !m.mvd) this.l12DepartAt = TICK; }
      if (mine && !m.bye && !m.mvd && !m.rel && this.hasCoord && this.state === 3 && this.coord.pc === 0 && ckPc(m.ck) === 0) this.l21Relay(m);   // L21
      if (mine && m.mv && this.l13('L13.7')) this.l13VacAt.set(m.ck, TICK);   // L13.7
      if (mine && this.hasCoord && this.state === 3 && m.ck === ckey(down(this.coord))) { const rc = this.rosterCells(); for (let q = 1; q < C; q++) { const x = this.occGet(ckey(rc[q])); if (x >= 0 && x !== id && x !== m.id) this.emit(x, hello(ckey(this.coord), id)); } }   // L9.7
      // D2 RELAY
      if (m.bye && !m.mvd && s4live && (mine || (this.occGet(m.ck) < 0 && this.byeAt.has(m.ck) && TICK - this.byeAt.get(m.ck) <= 20))) this.byeRelay(m);
      if (mine) { const w = this.waitClaim.get(m.ck); if (w !== undefined) { const wid = w[0], wat = w[1]; this.waitClaim.delete(m.ck); if (wid !== m.id && TICK - wat <= 20) this.hintClaim(m.ck, wid); } }
      // A, ATTRIBUTABLE (V4): only the LEAVER'S OWN vouch clears.
      { const sit = this.sitting.get(m.ck); if (sit !== undefined && sit.joiner === m.id) { this.sitting.delete(m.ck); } }
      if (mvdFrom) { this.setOcc(m.mvd, m.id); this.noteS1(m.mvd); }   // T3
      // A goodbye about a cell somebody ELSE holds in my view frees nothing
      if (this.occGet(m.ck) >= 0 && (this.firstHandLive(m.ck) || !s4live)) return;
      if (!tenOk) return;
      // PROBE-GATED (§AUTH, R7)
      if (this.occGet(m.ck) >= 0) { if (this.w.lv.HEALING && this.hasCoord && this.state === 3 && !this.gbProbe.has(m.ck)) { this.gbProbe.set(m.ck, { at: TICK, holder: this.occGet(m.ck), mv: m.mvd !== 0 || m.mv }); this.routeTo(unck(m.ck), 2); } return; }
      if (m.bye && !m.mvd && !m.mv && this.hasCoord) {
        const hc = unck(m.ck);   // L1.1 (a)
        if (m.child >= 0 && m.child !== id && hc.pc === this.coord.pc && hc.r === this.coord.r) this.childOf.set(m.ck, m.child);
        if (ckey(down(hc)) === ckey(this.coord)) { let nn = 0; for (const kv of m.nbrs) { if (++nn > 2 * C) break; if (!cellOk(kv.k) || kv.v < 0 || kv.v === id || ckPc(kv.k) !== 0) continue; if (!this.cousins.has(kv.k) && this.cousins.size >= 4 * C) continue; this.cousins.set(kv.k, kv.v); } }
      }
      if (!m.mvd && !m.mv && m.child >= 0 && m.child !== id && this.hasCoord) { const hc = unck(m.ck); if (hc.pc !== 0 && hc.pc === this.coord.pc && hc.r === this.coord.r) this.l1ByeKid.set(m.ck, TICK); if (this.l13('L13.5')) this.l1ByeKidId.set(m.ck, m.child); }   // L1
      { if (this.byeId.size >= 64) eraseFirst(this.byeId); this.byeId.set(m.ck, m.id); }   // L9.18
      // L8.37 THE OTHER RING'S GOODBYE IS NOT MY HOLE.
      if (roomTerm(this, 1) && m.c7 && m.c7Min >= 0 && this.hasCoord && this.state === 3 && m.c7Min !== this.ringName()) return;
      this.goodbyeHeal(m.ck, m.mvd !== 0 || m.mv);
    },

    // C++: mesh_seat.inc:Seat::onUnneeded
    onUnneeded(m) {
      const id = this.id, f = this.f;
      if (m.from < 0 || m.from === id) return;
      if (m.tag !== 4) this.l14Served.delete(m.from);   // L14
      if (m.tag === 5) { if (!f.l22Need(id, m.from)) f.l22Agree(id, m.from); else { f.l222Note(id, m.from); f.l28Reply(id, m.from); } return; }   // L14.9: the deep end released the uplink I served: that word was my only reason for the pc, so I agree now, with no settle of my own (a reason of my own keeps it, as any ask)
      if (m.tag === 1) { if (!f.l22Need(id, m.from)) f.l22CloseAsk(id, m.from); return; }   // L22 handshake
      if (m.tag === 3) { f.l22Close(id, m.from); return; }
      if (m.tag === 4) { if (!f.l22Need(id, m.from) && f.l22Quiet(id, m.from)) f.l22Close(id, m.from); return; }   // L28
      if (!f.l22Need(id, m.from)) { if (f.l22Quiet(id, m.from)) f.l22Agree(id, m.from); else f.l222Note(id, m.from); } else { f.l222Note(id, m.from); f.l28Reply(id, m.from); }
    },

    // C++: mesh_seat.inc:Seat::onS1Sync
    onS1Sync(m) {
      const TICK = this.TICK, id = this.id;
      if (m.fhd.length) this.d52Told(m);   // D5.2
      if (m.ent.length > C * C || m.digs.length > C * C) return;   // Section-1 gossip: at most one entry per home cell
      this.s1SyncDigs(m);
      // GOSSIP updates the ROSTER HINT (occ/s1seen) only
      const rm810 = roomTerm(this, 1) ? this.ringMin() : -1;   // L8.10
      for (const e of m.ent) {
        const ck = e.k, eid = e.v, age = e.age;
        if (ckPc(ck) !== 0 || !cellOk(ck) || eid < 0) continue;   // Section-1 cells only
        if (e.ch >= 0 && !(roomTerm(this, 1) && this.heirNotMine.has(e.ch))) this.childOf.set(ck, e.ch);
        if (this.hasCoord && ck === ckey(this.coord) && eid !== id) continue;   // gossip claims MY seat: IGNORE
        if (this.firstHandLive(ck)) continue;
        if (this.translost.has(ck)) continue;   // D5
        const seen = TICK - age - 2; const cur = this.occGet(ck); const curSeen = this.s1seen.has(ck) ? this.s1seen.get(ck) : -999;
        // CLAIM BIRTH
        const eb = e.ba >= 0 ? this.LT() - e.ba : -1;
        let took = false;
        if (this.liveElsewhere(eid, ck)) continue;
        { const bz = this.byeAt.get(ck); if (bz !== undefined && seen <= bz) continue; }
        if (this.d52Echo(ck, eid, seen)) continue;   // D5.2
        { const gb = this.l152Bye.get(eid); if (gb !== undefined && gb[0] === ck && seen <= gb[1]) continue; }   // L21
        if (rm810 >= 0 && cur === rm810 && cur !== eid) { const xs = this.xrOk.get(eid); if ((this.strangeSeen.has(eid) && this.strangeSeen.get(eid) >= 2) || (xs !== undefined && TICK - xs <= 2 * K.RELAY_TTL)) continue; }   // L8.10
        if (seen > curSeen + 8 || (seen >= curSeen - 8 && cur >= 0 && eid < cur && (e.ba < 0 || e.ba <= 600))) { this.s1seen.set(ck, seen); this.s1told.delete(ck); took = true; if (cur !== eid) { this.setOcc(ck, eid); this.born.set(ck, (e.ba >= 0 ? eb : this.LT())); } }
        else if (cur < 0 && seen > -999) { this.s1seen.set(ck, seen); this.s1told.delete(ck); this.setOcc(ck, eid); this.born.set(ck, (e.ba >= 0 ? eb : this.LT())); took = true; }
        // A SEAT IS IN ONE PLACE
        if (took) {
          const gone = [];
          for (const [k2, ov] of this.occ) { if (k2 === ck || ov !== eid || ckPc(k2) !== 0 || this.firstHandLive(k2) || this.translost.has(k2)) continue; const s2 = this.s1seen.has(k2) ? this.s1seen.get(k2) : -999; if (s2 < seen) gone.push(k2); }
          for (const k2 of gone) { this.occDrop(k2, 'moved-by-gossip'); this.s1seen.delete(k2); this.kidful.delete(k2); this.tlForget(k2); }
        }
      }
    },

    // C++: mesh_seat.inc:Seat::onDrain
    onDrain(m) {
      const id = this.id, TICK = this.TICK;
      if (!this.hasCoord || this.state !== 3 || this.coord.pc === 0 || this.drainAt) return;
      {
        const fromHead = this.f.l164Of(this) && m.tag === 1 && this.coord.i !== 0 && m.id >= 0 && (this.occGet(ckey({ pc: this.coord.pc, r: this.coord.r, i: 0 })) === m.id || (this.l1641From(m.id) && !this.l1361Carried()));   // L16.4
        if (!fromHead) { const oc = this.ownerCoord(); if (!oc || m.id < 0 || this.occGet(ckey(oc)) !== m.id) return; }   // E1: only my ANCHOR may dissolve my subtree
      }
      if (m.roster.length === 0 && !this.f.l164Of(this)) return;
      if (m.tag === 1 && this.coord.i !== 0 && this.occGet(ckey({ pc: this.coord.pc, r: this.coord.r, i: 0 })) !== m.id) this.trace('L16.4.1', this.id, this.coord, 'heir=%d', m.id);
      this.roster = kvCopy(m.roster); this.haveRoster = true; const rc = this.rosterCells();
      for (let c = 0; c < C; c++) { const x = this.occGet(ckey(rc[c])); if (x >= 0 && x !== id) { const d = newMsg('DRAIN'); d.roster = kvCopy(m.roster); d.id = id; this.emit(x, d); } }
      this.drainAt = TICK + 6 + Math.trunc(this.rng() * 12); this.f.wake(id);
    },

    // C++: mesh_seat.inc:Seat::onChallenge
    onChallenge(m) {
      const id = this.id, TICK = this.TICK, LINKMODEL = this.w.lv.LINKMODEL;
      if (m.tag === 25 && m.via >= 0 && m.via !== id && m.asker >= 0 && m.asker !== id) {   // the seat that named the rival passes the question on (L25.18: over its own open channel, and only one that came over the asker's own)
        const f = msg.clone(m); f.from = id; if (!LINKMODEL) { this.emit(m.via, f); return; }
        const own = this.linkIs(m, m.asker) && this.f.fabricLinkState(id, m.via) === E.LS_OPEN; this.trace('L25.18-PASS', id, this.hasCoord ? this.coord : null, 'asker=%d rival=%d ok=%d', m.asker, m.via, own ? 1 : 0); if (own) this.f.fabricCallFrame(id, m.via, f); return;
      }   // L25 without the link model
      if (m.tag === 27) { this.l40Told(m); if (!this.l2512Heard(m)) this.l40Keep(m); return; }   // L25.12 (L40.1: a tell held while a question is open)
      if (m.tag === K.GA_TAG) { this.gaAnswer(m); return; }   // L41.2 (gapa.js)
      if (m.tag === 26) { this.l25WitAnswer(m); return; }   // L25.9
      if (m.tag === 25) {
        if (this.hasCoord && this.state === 3 && ckey(this.coord) === m.ck) {
          this.l2513Asked(m); const c = newMsg('CONFIRM'); c.ck = m.ck; c.id = id; c.sig = true; c.sigAt = TICK;
          if (this.ppCk === ckey(this.coord)) { c.pp = this.pp; c.ppAt = this.ppAt; c.ppL = this.ppL; }
          if (this.mpK > 0 && this.mpCk === ckey(this.coord)) { c.mpK = this.mpK; c.mpBy = this.mpBy; c.mpAt = this.mpAt; c.mpL = this.mpL; c.mpOld = this.mpOld; }
          if (LINKMODEL && !(m.asker >= 0 && m.asker !== id && m.from >= 0 && m.from !== m.asker)) this.f.fabricCallFrame(id, m.from, c);
          else if (m.asker >= 0 && m.from >= 0) { c.via = m.asker; if (LINKMODEL) { this.f.fabricCallFrame(id, m.from, c); this.trace('L25.18-BACK', id, this.coord, 'asker=%d by=%d', m.asker, m.from); } else this.emit(m.from, c); }   // L25.18: a question that was passed on is answered the way it came
        }
        return;
      }
      if (this.evil) { const c = newMsg('CONFIRM'); c.ck = m.ck; c.id = id; this.emit(m.from, c); return; }
      if (this.hasCoord && this.state === 3 && ckey(this.coord) === m.ck) { const c = newMsg('CONFIRM'); c.ck = m.ck; c.id = id; if (this.f.fabricDoors() && this.ppCk === ckey(this.coord) && this.otherRing(m.from)) { c.pp = this.pp; c.ppAt = this.ppAt; c.ppL = this.ppL; } /* my placement, to a seat of another founding */ this.emit(m.from, c); }
    },

    // C++: mesh_seat.inc:Seat::onConfirm
    onConfirm(m) {
      const id = this.id, TICK = this.TICK;
      // the answer to MY CHALLENGE, from that very rival, for that cell, within 40 ticks
      if (m.via >= 0 && m.via !== id && m.id !== id) { const f = msg.clone(m); f.via = -1; if (this.w.lv.LINKMODEL) this.f.fabricCallFrame(id, m.via, f); else this.emit(m.via, f); return; }   // L25 without the link model
      if (this.hasCoord && this.state === 3 && ckey(this.coord) === m.ck && this.l25Nc >= 0 && m.id === this.l25Nc && m.ck === this.l25Ck && TICK - this.l25At <= K.L25_WAIT && this.provenEv(m, m.id) && !this.moving && this.liveElsewhere(m.id, m.ck)) { this.l25Nc = -1; this.trace('L25-ELSEWHERE', id, this.coord, 'rival=%d', m.id); return; }   // L25
      if (this.hasCoord && this.state === 3 && ckey(this.coord) === m.ck && this.l25Nc >= 0 && m.id === this.l25Nc && m.ck === this.l25Ck && TICK - this.l25At <= K.L25_WAIT && this.provenEv(m, m.id) && !this.moving) {
        this.l25Nc = -1;
        let proof = m.pp >= 0 && m.pp !== m.id && m.ppAt >= 0 && m.ppL >= 0 && (this.ppAdm(m.ck, m.pp, m.id) || (this.pp >= 0 && this.ppCk === ckey(this.coord) && !this.ppAdm(m.ck, this.pp, id))) && (this.pp < 0 || this.ppCk !== ckey(this.coord) || m.ppL < this.ppL || (m.ppL === this.ppL && (m.pp < this.pp || (m.pp === this.pp && m.id < id))));
        // (L25.8: D5's proof)
        this.l258Rep = false;   // L25.8.1: set only by the re-placement arm below
        if (!proof && m.pp >= 0 && m.pp === this.l25By && m.ppAt >= 0 && this.pp === m.pp && this.ppCk === ckey(this.coord) && m.ppAt > this.ppAt) { proof = true; this.l258Rep = true; this.trace('L25-REPLACED', id, this.coord, 'by=%d rival=%d at=%d mine=%d', this.l25By, m.id, m.ppAt, this.ppAt); }   // L25.8
        if (!proof && m.mpK > 0 && this.mpProven(m)) { const rt = m.mpL, mt = (this.pp >= 0 && this.ppCk === ckey(this.coord)) ? this.ppL : (this.mpK > 0 && this.mpCk === ckey(this.coord)) ? this.mpL : this.seatedAt; proof = rt < mt || (rt === mt && m.id < id); }   // L25.7
        if (proof && !this.l258Rep) { const f = this.byeFloor(m.id, m.ck); if (f >= 0 && !(m.pp >= 0 && m.ppL >= f) && !(m.mpK > 0 && m.mpL >= f)) { proof = false; this.trace('L25.19-BYE', id, this.coord, 'rival=%d bye=%lld pp=%d ppL=%d', m.id, f, m.pp, m.ppL); } }   // L25.19: a goodbye ends the tenancy
        if (!proof) { this.trace('L25-UNPROVEN', id, this.coord, 'rival=%d pp=%d', m.id, m.pp); this.l25131Ask(m); if (this.l40Unproven(m)) return; if (this.l2513Order(m)) return; if (!this.l2512Rook(m.id)) this.l2512TellHeard(m.id); return; }   // L25.12
        if (m.pp >= 0 && this.l25131At.has(m.pp)) this.trace('L25.13.1-ADMIT', id, this.coord, 'placer=%d rival=%d', m.pp, m.id);   // L25.13.1: the placer I asked is admitted now
        this.trace('L25-CONFIRMED', id, this.coord, 'rival=%d', m.id);
        if (this.l258Rep || this.l25WitAsk.length || this.l25WitMe > 0 || this.l25WitRival > 0) { const d = this.l25WitDecide(false); if (d === 0) { this.l25WitPend = true; this.f.wake(id); return; } if (d === 2) { this.l2512Tell(m.id); return; } }   // L25.9
        this.l40Go(m.id, 'T1-yield'); return;   // L25 (L40.3: the goodbye names the rival)
      }
      if (!this.hasCoord || this.state !== 3 || ckey(this.coord) !== m.ck || m.id < 0 || m.id === id || !(m.id < id)) return;
      if (this.challToId !== m.id || this.challToCk !== m.ck || TICK - this.challToAt > 40 || !this.provenEv(m, m.id) || this.liveElsewhereSinceReturn(m.id, m.ck)) return;
      this.challToId = -1;
      {
        const oa = this.lineAtOf(m.id); const l852 = !L8_52_OFF && this.f.fabricDoors() && !this.moving && this.coord.pc === 0 && this.lineAt >= 0 && oa >= 0 && oa !== this.lineAt && this.lineOf(m.id) >= 0 && this.lineOf(m.id) !== this.line;   // L8.52.2 (mesh_ring.inc): between two foundings of different age the seat of the older room stands
        if (l852 && this.lineAt < oa) { this.trace('L8.52-STAND', id, this.coord, 'rival=%d mine=%d theirs=%d', m.id, this.lineAt, oa); return; }
        if (!l852 && this.f.fabricDoors() && !this.moving && this.coord.pc === 0 && this.pp >= 0 && this.ppL >= 0 && this.ppCk === ckey(this.coord) && this.otherRing(m.id) && !(m.pp >= 0 && m.ppL >= 0 && l165Earlier(m.ppL, m.pp, m.id, this.ppL, this.pp, id))) { this.trace('L8.11.1-STAND', id, this.coord, 'rival=%d', m.id); return; }   // across foundings the earlier placement wins against a confirm too
      }
      if (roomTerm(this, 1) && m.c7Min >= 0 && m.c7Min !== this.ringName() && this.ringOlder(m.c7Min, m.lineAt, this.ringName(), this.lineAt)) return;   // L8.11
      if (this.moving) { this.rbWhy = 'confirm-lower'; this.rollbackMove(); } else this.requeue('CONFIRM-lower-id');
    },

    // C++: mesh_seat.inc:Seat::onMoved
    onMoved(m) {
      // T3: the cell I phoned was vacated by a MOVE
      if (m.id < 0 || !cellOk(m.ck) || (m.mvd && !cellOk(m.mvd)) || !this.provenEv(m, m.id)) return;
      if (!this.ownedLinkCell(m.ck) || this.occGet(m.ck) !== m.id) return;
      let mvdFrom = false; if (m.mvd) { const l = this.linkedBy.get(m.ck); mvdFrom = l !== undefined && l === m.id && this.mvdOk(m.ck, m.mvd, m.id); }
      if (mvdFrom) this.carryLinked(m.ck, m.mvd, m.id);
      { const l = this.linkedBy.get(m.ck); if (l !== undefined && l === m.id) this.wasLinked(m.ck, m.id); }
      this.linkedBy.delete(m.ck); this.tenOf.delete(m.ck);
      this.occDrop(m.ck, 'moved'); this.live.delete(m.ck); this.kidful.delete(m.ck); this.s1seen.delete(m.ck); this.tlForget(m.ck); this.healTry.delete(m.ck); this.digForget(m.ck);
      if (mvdFrom) { this.setOcc(m.mvd, m.id); this.noteS1(m.mvd); }
      this.f.wake(this.id);
    },

    // C++: mesh_seat.inc:Seat::onSitXfer
    onSitXfer(m) {
      const id = this.id, TICK = this.TICK;
      // V4: my assigner hands me my row's outstanding vouch ledger
      if (m.from < 0 || m.from === id || m.id !== id || m.from !== this.placer || this.rowLedger) return;
      if (this.hasCoord && this.coord.pc === 0 && this.coord.i === 0 && ckey(this.coord) === m.ck) {
        const inRow = (k, v) => { const c = unck(k); return cellOk(k) && c.pc === 0 && v >= 0 && (c.r === this.coord.r || (c.i === 0 && c.r === (((this.coord.r + 1) % C) & 0xff))); };
        for (const kv of m.nbrs) if (inRow(kv.k, kv.v) && !this.occ.has(kv.k) && !this.sitting.has(kv.k)) { const s = state.newStruct('SoftSit'); s.joiner = kv.v; s.assigner = id; s.at = TICK; this.sitting.set(kv.k, s); }
        for (const e of m.row) if (inRow(e.k, e.v) && !this.occ.has(e.k)) { this.setOcc(e.k, e.v); this.noteHand(e.k, e.v); }
        this.rowLedger = true;
      }
    },

    // C++: mesh_seat.inc:Seat::onSitPing
    onSitPing(m) {
      // V4: my assigner asks whether its vouch for me at m.ck is still live.
      if (m.id === this.id && !this.hasCoord && this.state === 2 && this.l317DeclinedAt(m.ck, m.from)) return;   // L31.7: a vouch for a placement I declined: silent, so it frees
      if (m.id === this.id) {
        if (this.hasCoord && this.state === 3 && ckey(this.coord) === m.ck) { const p = newMsg('SITPONG'); p.ck = m.ck; p.id = this.id; p.tag = 1; this.emit(m.from, p); }
        else if (!this.hasCoord && this.state === 2) { const p = newMsg('SITPONG'); p.ck = m.ck; p.id = this.id; p.tag = 0; this.emit(m.from, p); }
      }
    },

    // C++: mesh_seat.inc:Seat::onSitPong
    onSitPong(m) {
      const sit = this.sitting.get(m.ck);
      if (sit !== undefined && sit.joiner === m.id) {
        if (m.tag === 1) this.confirmSeated(m.ck, m.id);   // the lost CLAIM, replayed first-hand
        else { sit.at = this.TICK; sit.pingAt = -1; if (sit.pl.t === 'PLACE') this.emit(m.id, msg.clone(sit.pl)); }   // alive and still seeking: restart the clock, and re-send the PLACE
      }
    },

    // C++: mesh_seat.inc:Seat::onPong
    onPong(m) {
      const id = this.id, TICK = this.TICK;
      // FRAME AUTHORITY: a PONG answers MY PHONE, so it comes from one of my owned links
      if (!this.hasCoord) return;
      const pk = ckey(m.coord);
      const pid = m.id >= 0 ? m.id : m.lk; if (pid < 0) return;
      if (this.linkIs(m, pid) && m.id >= 0) for (const [ek, ev] of this.occ) if (ev === pid && ek !== pk && !this.firstHandLive(ek)) { if (this.elsewhere.size >= 64) eraseFirst(this.elsewhere); this.elsewhere.set(pid, TICK); if (ckPc(pk) !== 0 || this.l13AnchorElse(ek)) { const wk = ek; this.occDrop(wk, 'elsewhere'); } break; }   // L2
      if (this.linkIs(m, pid) && m.owner >= 0 && m.owner !== id && m.owner !== pid) { const oc = ownerCoordOf(m.coord); if (oc) { const kk = ckey(oc); if (kk !== pk && m.oCk === kk && this.ownedLinkCell(kk) && this.occGet(kk) === pid && !this.firstHandLive(kk) && !this.liveElsewhere(m.owner, kk)) { this.setOcc(kk, m.owner); this.noteS1(kk); if (ckPc(kk) === 0) this.s1told.set(kk, TICK); } } }   // MISDIRECTED
      if (!this.ownedLinkCell(pk)) return;
      if (m.vac.length) this.d52Word(m, pid);   // D5.2: my head's word that a cell of my row is vacant
      if (m.tag === 7 && this.ppValid(m)) this.ppNote(pk, pid, seatM.ppSigOf(m.pp, m.ppAt), m.pp, m.ppL);   // PP
      if (!this.linkIs(m, pid)) {
        if (this.occGet(pk) !== pid) return; if (signedBy(m, pid)) this.pongDig(m, pid); this.upUsed.set(pk, TICK); if (!this.entryOpen(pk, pid)) return; this.lastAck = TICK; if (this.coord.pc !== 0 && this.coord.i !== 0 && pk === ckey({ pc: this.coord.pc, r: this.coord.r, i: 0 })) this.headAckAt = TICK;   // L9.9
        if (m.coord.pc === 0) { this.liveMark(pk); this.noteS1(pk); } return;
      }   // only for a pairing no link ever proved
      { const cur = this.occGet(pk); if (cur >= 0 && cur !== pid && this.heardAt(pk, cur)) return; }
      if (this.occGet(pk) < 0) { const ob = this.byeAt.get(pk); const bi = this.byeId.get(pk); if (ob !== undefined && bi !== undefined && bi === pid && TICK - ob <= 8) return; }   // L9.18
      this.lastAck = TICK; this.nbrHeard(); this.noteLinked(pk, pid, m.tn); this.pongBy.set(pk, [pid, TICK]);
      if (this.coord.pc !== 0) {
        const oc = this.ownerCoord(); const fromOwner = this.coord.i === 0 && !!oc && ckey(oc) === pk, fromHead = this.coord.i !== 0 && pk === ckey({ pc: this.coord.pc, r: this.coord.r, i: 0 });   // L2
        if (fromOwner || fromHead) { this.bkId = m.bkId; this.bkCk = m.bkCk; this.sbId = m.u3Id; this.sbCk = m.u3Ck; if (m.t14 >= 0) { if (m.t14 > 0) { if (this.t14Ck !== m.t14) this.trace('TURN14-WORD', id, this.coord, 'from=%d root=%s', pid, coordStr(unckey(m.t14 - 1))); this.t14Ck = m.t14; this.t14At = TICK | 0; } else { if (this.t14Ck > 0) this.trace('TURN14-WORD', id, this.coord, 'from=%d root=-', pid); this.t14Ck = 0; } } }   /* TURN.14.5: the link end my row hangs under */
        if (fromHead) { this.headAckAt = TICK; this.headEver = true; this.headE1Dn = m.e1dn; this.headE1At = m.e1At; if (this.w.lv.DIGEST && m.dgPub.at >= 0) { this.u2RowDig = dig.cloneDig(m.dgPub); if (!e2f.L48_OFF) this.u2RowDig.rx = this.LT() - this.u2RowDig.ag; } }   // L48: held with its age, so the copy over E2 ages on
      }
      if (m.coord.pc === 0) { this.setOcc(pk, pid); this.liveMark(pk); this.noteS1(pk); }   // FIRST-HAND
      if (this.pendYBy === pid && TICK - this.pendYAt <= 8 && this.hasCoord && this.state === 3 && this.pendYCk === ckey(this.coord) && this.arbOk(pid)) {
        this.pendYBy = -1;
        if (this.f.fabricDoors() && !this.moving && this.coord.pc === 0 && this.pendYPp >= 0 && this.pendYPpL >= 0 && this.pp >= 0 && this.ppL >= 0 && this.ppCk === ckey(this.coord) && this.pendYNc >= 0 && this.pendYNc !== id && l165Earlier(this.ppL, this.pp, id, this.pendYPpL, this.pendYPp, this.pendYNc)) { this.emit(pid, hello(ckey(this.coord), id)); this.trace('L16.5-STAND', id, this.coord, 'by=%d rival=%d deferred', pid, this.pendYNc); return; }   // L16.5
        if (this.l167Stand(this.pendYNc, this.pendYBorn)) { this.emit(pid, hello(ckey(this.coord), id)); this.trace('L16.7-STAND', id, this.coord, 'by=%d rival=%d deferred', pid, this.pendYNc); return; }   // L16.7
        if (!this.moving && (roomTerm(this, -1) || this.lineForeign())) { const y = newMsg('YIELD'); y.ck = this.pendYCk; y.id = pid; y.nc = this.pendYNc; y.pp = this.pendYPp; y.ppAt = this.pendYPpAt; y.ppL = this.pendYPpL; y.born = this.pendYBorn; if (this.l25Yield(y, pid)) { this.trace('L25.11-DEFERRED', id, this.coord, 'by=%d nc=%d', pid, this.pendYNc); return; } }   // L25.11
        if (!this.moving && this.l25Nonsense(pid, this.pendYNc, 'deferred')) return;   // L25.15
        this.trace('YIELD-TAKEN', id, this.coord, 'by=%d site=pendY nc=%d ypp=%d yppAt=%d mypp=%d myppAt=%d born=%lld moving=%d', this.pendYBy, this.pendYNc, this.pendYPp, this.pendYPpAt, this.pp, this.ppAt, this.rmBornAt, this.moving ? 1 : 0); if (this.moving) { this.rbWhy = 'pendY'; this.rollbackMove(); } else this.l40Go(this.pendYNc !== id ? this.pendYNc : -1, 'T1-yield'); return;
      }
      {
        const ob = this.byeAt.get(m.oCk); let byeHeld = ob !== undefined && TICK - ob <= K.LEASE_T && !this.firstHandLive(m.oCk); if (byeHeld) { const bi = this.byeId.get(m.oCk); if (bi !== undefined && bi !== m.owner) byeHeld = false; }   // L9.3
        const oc2 = ownerCoordOf(m.coord);
        if (m.owner >= 0 && !byeHeld && oc2 && m.oCk === ckey(oc2) && this.occGet(m.oCk) !== m.owner && !this.liveElsewhere(m.owner, m.oCk)) { this.setOcc(m.oCk, m.owner); this.noteS1(m.oCk); if (ckPc(m.oCk) === 0) this.s1told.set(m.oCk, TICK); }   // OWNERELSE
      }
      { let nr = 0; for (const e of m.row) { if (++nr > C) break; const c = unck(e.k); if (!cellOk(e.k) || c.pc !== m.coord.pc || c.r !== m.coord.r || e.v < 0) continue; if (e.k === ckey(this.coord) && e.v !== id) continue; if (!RCD.L17_3_1_OFF && this.occGet(e.k) === e.v) FREE.l1731Note(this, pk, e.k, e.v); if (this.occGet(e.k) !== e.v) { if (this.liveElsewhere(e.v, e.k)) continue; if (!RCD.L35_4_OFF && FREE.l354Echo(this, e.k, e.v)) continue; { const tm = this.memo.get(e.k); if (this.translost.has(e.k) && tm !== undefined && tm.id === e.v) continue; } this.setOcc(e.k, e.v); this.noteHand(e.k, e.v); } else if (this.bareAt.size && e.v !== pid) this.bareAt.delete(e.k);   /* L25.16: another seat's listing names the seat I name: no longer its word alone */ if (e.age >= 0) this.childOf.set(e.k, e.age); } }
      { let nn = 0; for (const kv of m.nbrs) { if (++nn > 4 * C) break; if (!cellOk(kv.k) || kv.v < 0) continue; if (!this.cousins.has(kv.k) && this.cousins.size >= 4 * C) continue; this.cousins.set(kv.k, kv.v); } }   // cousins capped (W, 4C)
      // MY HEAD'S ROW IS THE ROW (deep rows).
      if (this.hasCoord && this.coord.pc !== 0 && this.coord.i !== 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r && m.coord.i === 0) {
        for (let j = 1; j < C; j++) {
          if (j === this.coord.i) continue; const rk = ckey({ pc: this.coord.pc, r: this.coord.r, i: j });
          if (!this.occ.has(rk) || this.firstHandLive(rk)) continue;
          let listed = false; for (const e of m.row) if (e.k === rk) { listed = true; break; }
          if (!listed) { this.occDrop(rk, 'head-ledger'); this.kidful.delete(rk); this.childOf.delete(rk); }
        }
      }   // L1.3
      if (m.tag !== 5) this.pongDig(m, pid);   // a stand-in heir's answer carries no digest
    },

    // C++: mesh_seat.inc:Seat::onU2
    onU2(m) {
      const id = this.id, TICK = this.TICK;
      if (!this.hasCoord || this.state !== 3 || m.id < 0) return;
      if (m.t === 'U2ACK') {
        if (m.id === this.u2Id || (m.id === this.u3Id && 1 >= 1)) {
          if (this.u2Hot && m.dgRoot.at >= 0 && this.w.lv.DIGEST && this.state === 3 && this.hasCoord && this.coord.pc !== 0) { const rt = dig.cloneDig(m.dgRoot); this.rxDig(rt); if (this.rootDig.at < 0 || rt.rx > this.rootDig.rx) this.rootDig = rt; }   // L2.4.1
          this.l211Ack(m); if (m.id === this.u2Id) this.u2AckAt = TICK; if (m.id === this.u3Id) this.u3AckAt = TICK;
          if (this.u2Hot && this.coord.i !== 0 && this.headEver) this.u2UpAt = TICK;   // only a heir whose head once answered it in this row is serving a GONE head
          if (m.e1dn) { this.ownVouchAt = TICK; this.vouchOwner = m.owner; this.vouchOCk = m.oCk; }
          if (m.hard) { this.ownDeadAt = TICK; this.ownDeadCk = m.oCk; this.ownDeadId = m.owner; this.ownDeadSeen = this.occGet(m.oCk); }
        }
        return;
      }
      const row = { pc: m.coord.pc, r: m.coord.r, i: 0 }; const o = roles.ownerOf(row); if (!o) return;
      const view = (c) => ckey(c) === ckey(this.coord) || this.occGet(ckey(c)) >= 0;
      let mine; let b;
      if (o.pc === this.coord.pc && o.r === this.coord.r) mine = (m.tag === 3) ? ((b = roles.standbyOf(row, view)) !== null && ckey(b) === ckey(this.coord)) : ((b = roles.backupOwnerOf(row, view)) !== null && ckey(b) === ckey(this.coord));
      else { const orow = { pc: o.pc, r: o.r, i: 0 }; const oo = roles.ownerOf(orow); mine = m.tag !== 3 && !!oo && oo.pc === this.coord.pc && oo.r === this.coord.r && (b = roles.backupOwnerOf(orow, view)) !== null && ckey(b) === ckey(this.coord); }   // L2.2b
      if (!mine) return;
      const ukey = u2RowKey(ckey(row), m.tag === 3);   // key = ckey*2 + variant flag
      const u = ins(this.u2Rows, ukey, () => state.newStruct('U2Row'));
      if (m.e1dn && !u.hot) this.trace('UP2-SERVE', id, this.coord, 'row=%s heir=%d%s', coordStr(row), m.id, m.tag === 3 ? ' standby' : '');
      u.heir = m.id; u.at = TICK; u.hot = m.e1dn; if (m.e1dn && m.dgUp.at >= 0 && (e2f.L48_OFF || m.coord.i !== 0 || m.dgUp.by === m.id)) { u.dig = dig.cloneDig(m.dgUp); if (!e2f.L48_OFF) u.dig.rx = this.LT() - u.dig.ag; } else if (!e2f.L48_OFF) u.dig = msg.newDig();   // L48: a parked beat, or a hot one with no fold, ends the copy   // the row's fold, held while I serve it
      const a = newMsg('U2ACK'); a.id = id; a.coord = cc(this.coord);
      {
        const oc2 = roles.ownerOf(row);
        if (oc2) {
          const ok2 = ckey(oc2); const o2 = this.occGet(ok2);
          if (ok2 === ckey(this.coord) || (o2 >= 0 && !this.translost.has(ok2) && (this.firstHandLive(ok2) || this.f.fabricLinkState(id, o2) === E.LS_OPEN))) { a.e1dn = true; a.oCk = ok2; a.owner = (ok2 === ckey(this.coord)) ? id : o2; }
          else if (ok2 !== ckey(this.coord) && ((this.translost.has(ok2) && this.tlHard.has(ok2) && this.tlHard.get(ok2) && this.translostConfirmed(ok2)) || (o2 < 0 && this.memo.has(ok2) && TICK - this.memo.get(ok2).at <= K.LEASE_T))) { a.hard = true; a.oCk = ok2; a.owner = (o2 >= 0) ? o2 : ins(this.memo, ok2, () => state.newStruct('Memo')).id; this.trace('HARD-ANS', id, oc2, 'to=%d o2=%d tl=%d memo=%d', m.id, o2, this.translost.has(ok2) ? 1 : 0, this.memo.has(ok2) ? 1 : 0); }   // memo[ok2]: inserts a default Memo when the hard loss came by the transport arm
          else if (ok2 !== ckey(this.coord) && o2 < 0 && this.byeAt.has(ok2) && TICK - this.byeAt.get(ok2) <= K.LEASE_T) { a.hard = true; a.oCk = ok2; a.owner = this.byeId.has(ok2) ? this.byeId.get(ok2) : -1; this.trace('BYE-REPORT', id, oc2, 'to=%d', m.id); }
        }
      }   // L1.4 (I10): ...and its GOODBYE, the same way
      if (m.e1dn) { const oc4 = roles.ownerOf(row); const ok4 = oc4 ? ckey(oc4) : 0; const memo4 = (ok4 && this.memo.has(ok4)) ? 1 : 0, conf4 = (ok4 && this.translostConfirmed(ok4)) ? 1 : 0, tlh4 = (ok4 && this.tlHard.has(ok4) && this.tlHard.get(ok4)) ? 1 : 0, tl4 = (ok4 && this.translost.has(ok4)) ? 1 : 0;   // the arguments in the order the C++ binary runs them (right to left: translostConfirmed may drop the loss before tl is read)
        this.trace('UP2-ACK', id, this.coord, 'to=%d e1dn=%d hard=%d occ=%d tl=%d tlhard=%d conf=%d memo=%d', m.id, a.e1dn ? 1 : 0, a.hard ? 1 : 0, ok4 ? this.occGet(ok4) : -2, tl4, tlh4, conf4, memo4); }   // diagnostic
      if (m.e1dn && this.w.lv.DIGEST && this.state === 3 && this.rootDig.at >= 0) { a.dgRoot = this.wireDig(this.rootDig); a.dgRoot.kl.length = 0; }   // L2.4.1
      this.emit(m.id, a);   // L2.7 / L2.9
      if (this.u2Rows.size > 2 * C) for (const [k, v] of this.u2Rows) { if (TICK - v.at > 60) this.u2Rows.delete(k); }
    },

    // C++: mesh_seat.inc:Seat::onRouted
    // ROUTED intake (L3.4.1: one body for the answer over a channel and the answer that walked back)
    onRouted(m) {
      const id = this.id, TICK = this.TICK;
      if (m.tag === 1 || m.tag === 2) {
        const tk = ckey(m.target); const cur = this.occGet(tk);
        if (m.id >= 0 && this.hasCoord && tk !== ckey(this.coord) && this.probeAsked(tk, m.pn) && !(cur >= 0 && cur !== m.id && this.holdsCell(tk, 60))) {
          this.setOcc(ckey(m.target), m.id); this.noteS1(ckey(m.target)); this.probeAck.set(ckey(m.target), TICK); this.upAck.set(ckey(m.target), [m.id, TICK]); if (this.upAck.size > 64) eraseFirst(this.upAck);
          { const ex = this.upExpired.get(ckey(m.target)); if (ex !== undefined && ex === m.id) this.upExpired.delete(ckey(m.target)); }
          const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = id; this.emit(m.id, h);
        }
      }
    },   // probeAck AFTER setOcc (a changed occupant clears the observation first); never about MY OWN cell

    // C++: mesh_seat.inc:Seat::onRoute
    onRoute(m) {
      const id = this.id, TICK = this.TICK;
      if (!this.hasCoord) return;
      if (ckey(this.coord) === ckey(m.target)) {
        if (m.tag === 4) { const r = newMsg('ROUTED'); r.tag = 1; r.target = unck(m.ck); r.id = m.asker; r.pn = m.pn; this.trace('ROUTED-BACK', id, r.target, 'from=%d asked=%d', m.asker, this.probeAsked(m.ck, m.pn) ? 1 : 0); this.onRouted(r); return; }   // L3.4.1: a probe answer that walked back to my cell: the same answer as one over a channel
        if (m.tag === 3 || m.tag === K.D51_ANS) { if (!this.translost.has(m.ck) || !this.probeAsked(m.ck, m.pn)) return; this.probeAck.set(m.ck, TICK); return; }   // a D5 probe ANSWER routed back around the dead link
        if (m.tag === 2 || m.tag === K.D51_PROBE) {
          // D5 translost probe reached me: I am alive: answer AROUND the dead link
          const nh2 = this.probeHop(m.coord, m.asker);
          if (nh2 >= 0) { const a = newMsg('ROUTE'); a.target = cc(m.coord); a.asker = id; a.tag = 3; a.ttl = 60; a.via = id; a.pseq = ++this.w.lv.RSEQ; a.ck = ckey(this.coord); a.pn = m.pn; this.emit(nh2, a); }
          if (m.tag === K.D51_PROBE) this.d5AnsFan(m);   // D5.1: and through each of my rook mates
        }
        if (m.tag === 1 && m.asker >= 0 && m.asker !== id && m.ck && cellOk(m.ck) && m.ck !== ckey(this.coord) && this.ownedLinkCell(m.ck) && this.occGet(m.ck) < 0) { this.setOcc(m.ck, m.asker); this.emit(m.asker, hello(ckey(this.coord), id)); return; }   // L9.9
        const r = newMsg('ROUTED'); r.tag = m.tag === K.D51_PROBE ? 2 : m.tag; r.target = cc(m.target); r.id = id; r.pn = m.pn;
        if (this.f.fabricLinkState(id, m.asker) !== E.LS_OPEN && m.tag === 1 && this.hasCoord && ckey(m.coord) !== ckey(this.coord) && !(m.coord.pc === 0 && this.t17Carried(m.asker))) { const nh4 = this.nextHopToward(m.coord, -1); if (nh4 >= 0) { const a = newMsg('ROUTE'); a.target = cc(m.coord); a.asker = id; a.tag = 4; a.ttl = 60; a.via = id; a.pseq = ++this.w.lv.RSEQ; a.ck = ckey(this.coord); a.pn = m.pn; this.emit(nh4, a); return; } }   // L3.4.1: no channel to the asker (a NAT pair, a closed pc): the answer walks back to its cell the way the probe came
        this.emit(m.asker, r); return;
      }
      if (m.ttl <= 0) { const r = newMsg('ROUTED'); r.tag = m.tag; r.target = cc(m.target); r.id = -1; r.pn = m.pn; this.emit(m.asker, r); return; }
      // FORWARD WITH THE PROBE PAYLOAD
      if (m.tag === 1 && m.nc >= 0 && m.ck && m.asker >= 0 && m.asker !== id) {
        const tk = ckey(m.target); const ideal = this.nextHopCoord(m.target);
        if (ideal && ckey(ideal) === tk && this.occGet(tk) < 0 && !this.softSitting(tk)) {
          const ob = this.byeAt.get(tk);
          if ((ob !== undefined && TICK - ob <= K.LEASE_T) || this.translostConfirmed(tk)) { const g = newMsg('E1STATE'); g.tag = 3; g.id = id; g.oCk = tk; g.owner = m.asker; g.ck = m.ck; this.emit(m.nc, g); return; }
        }
      }   // L9.9
      const nh = m.tag === K.D51_ANS ? this.d5Hop(m) : this.nextHopToward(m.target, m.via);
      if (nh >= 0 && this.l191Loop(m, nh)) { this.trace('L19.1-END', id, this.hasCoord ? this.coord : null, 'asker=%d tag=%d target=%s pseq=%d ttl=%d nh=%d', m.asker, m.tag, coordStr(m.target), m.pseq, m.ttl, nh); const r = newMsg('ROUTED'); r.tag = m.tag; r.target = cc(m.target); r.id = -1; r.pn = m.pn; this.emit(m.asker, r); return; }   // L19.1
      if (nh >= 0) { const r = newMsg('ROUTE'); r.target = cc(m.target); r.asker = m.asker; r.tag = m.tag; r.ttl = m.ttl - 1; r.via = id; r.pseq = m.pseq; r.ck = m.ck; r.coord = cc(m.coord); r.pn = m.pn; this.emit(nh, r); return; }
      const r = newMsg('ROUTED'); r.tag = m.tag; r.target = cc(m.target); r.id = -1; r.pn = m.pn; this.emit(m.asker, r);
    },

    // C++: mesh_seat.inc:Seat::onWalk
    onWalk(m) {
      const id = this.id;
      // L13.16: walk toward the asker's anchor cell over my links
      if (!this.l13On() || !this.hasCoord || this.state !== 3 || m.ttl <= 0 || m.asker < 0 || m.asker === id || !cellOk(ckey(m.target))) return;
      if (islandStand(this, E.IS_WALK) || (m.line >= 0 && this.line >= 0 && m.line !== this.line)) return;
      const tk = ckey(m.target);
      if (ckey(this.coord) === tk) { this.f.fabricDialJoin(id, m.asker); this.l13Answer(m.asker, tk); this.trace('L13-WALK-END', id, this.coord, 'asker=%d here', m.asker); return; }
      const nh = this.strictNextHop(m.target); if (nh >= 0 && nh !== m.via) { const f = msg.clone(m); f.ttl = m.ttl - 1; f.via = id; this.emit(nh, f); return; }
      const ideal = this.nextHopCoord(m.target); if (!ideal) return; const ik = ckey(ideal);
      if (this.occGet(ik) >= 0 && this.occGet(ik) !== id) return;   // someone I name there over no link of mine: not my word
      this.f.fabricDialJoin(id, m.asker); this.l13Answer(m.asker, ik); this.trace('L13-WALK-END', id, ideal, 'asker=%d empty', m.asker);
    },

    // C++: mesh_seat.inc:Seat::onE1State
    onE1State(m) {
      const id = this.id, TICK = this.TICK;
      if (m.tag === 2) {
        if (this.hasCoord && this.state === 3 && this.coord.pc !== 0 && this.coord.i === 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r && this.occGet(ckey(m.coord)) === m.id) {
          const oc = this.ownerCoord();
          if (oc && ckey(oc) === m.oCk && !this.firstHandLive(m.oCk)) { const o = this.occGet(m.oCk); if (m.owner < 0 || o < 0 || o === m.owner) { this.byeAt.set(m.oCk, TICK); if (o >= 0) { this.occDrop(m.oCk, 'heir-bye'); this.live.delete(m.oCk); this.kidful.delete(m.oCk); } this.trace('OWNER-GONE', id, oc, 'from=%d', m.id); }
            if (m.nc >= 0 && m.nc !== id && m.ck !== m.oCk && cellOk(m.ck)) { const bc = unck(m.ck); if (bc.pc === oc.pc && bc.r === oc.r) { this.l9BkId = m.nc; this.l9BkCk = m.ck; this.l9BkAt = TICK; } if (oc.pc === 0 && bc.pc === 0 && this.occGet(m.ck) < 0 && (bc.r === oc.r || bc.i === oc.i)) { this.setOcc(m.ck, m.nc); this.noteS1(m.ck); this.s1told.set(m.ck, TICK); } } }
        }
        return;   // L9.3
      }
      if (m.tag === 3) {
        if (m.owner < 0) return;
        if (m.owner !== id) { if (this.f.fabricLinkState(id, m.owner) === E.LS_OPEN) { const f = msg.clone(m); this.emit(m.owner, f); } return; }   // the greeter a lone seat called
        if (!this.hasCoord || this.state !== 3 || m.ck !== ckey(this.coord)) return;
        { const anc = this.coord.i !== 0 ? { pc: this.coord.pc, r: this.coord.r, i: 0 } : this.ownerCoord(); const ha = !!anc; if (ha && ckey(anc) === m.oCk && !this.firstHandLive(m.oCk) && TICK - this.lastAck >= K.L9_LONE && !this.byeAt.has(m.oCk)) { this.byeAt.set(m.oCk, TICK); if (this.occ.has(m.oCk)) { this.occDrop(m.oCk, 'ring-word'); this.live.delete(m.oCk); this.kidful.delete(m.oCk); } this.trace('ANCHOR-GONE', id, anc, 'from=%d', m.id); } }
        return;
      }
      if (m.tag === 1) { if (this.hasCoord && this.coord.pc !== 0 && this.coord.i === 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r && this.occGet(ckey(m.coord)) === m.id) { this.hdE2Dn = m.e1dn; this.hdE2Id = m.id; } return; }   // L2.8
      if (this.hasCoord && this.coord.pc !== 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r && m.coord.i === 0 && this.occGet(ckey(m.coord)) === m.id) { this.headE1Dn = m.e1dn; this.headE1At = m.e1At; this.up2Tick(); }   // L2.7
    },

    // C++: mesh_seat.inc:Seat::byeRelay
    // D2 RELAY (healing-laws D2; mesh.js byeRelay twin): the leaver's own signed LEAVE, passed once per goodbye
    // to my section-mates
    byeRelay(m) {
      const TICK = this.TICK, id = this.id;
      if (!this.hasCoord || this.state !== 3 || !m.sig) return;
      const c = unck(m.ck); if (c.pc !== this.coord.pc) return;
      const key = String(m.ck) + '|' + String(m.id) + '|' + String(m.tn);
      if (this.byeRly.has(key)) return;
      this.byeRly.set(key, TICK);
      if (this.byeRly.size > 256) { for (const [k, v] of this.byeRly) { if (TICK - v > 120) this.byeRly.delete(k); } while (this.byeRly.size > 256) eraseFirst(this.byeRly); }
      const seen = new Set();
      for (const olk of ownedLinks(this.coord)) {
        if (olk.pc !== this.coord.pc) continue; const x = this.occGet(ckey(olk)); if (x < 0 || x === id || x === m.id || x === m.from || seen.has(x)) continue; seen.add(x);
        const f = newMsg('LEAVE'); f.ck = m.ck; f.id = m.id; f.tn = m.tn; f.rl = true; f.bye = true; f.sig = m.sig; f.sigAt = m.sigAt; f.sigL = m.sigL; if (this.l13('L13.7')) { f.child = m.child; f.kids = m.kids; } this.emit(x, f);
      }
    },
  });

  const api = {};
  GifOS.meshRecvSeated = api;
  if (isNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
