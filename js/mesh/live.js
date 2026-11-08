/*
 * live.js: the liveness unit of the mesh seat (port plan S4), ported line for line from the 0.9.25 sim.
 *
 * C++: mesh_seat.inc, the dark-seat / lease / PHONE / heartbeat / sweep / transport-loss family, plus the
 * Seat::requeue (mesh_seat.inc) and Seat::leave (mesh_seat.inc) that end a seat's stay. Methods are added to
 * Seat with Seat.unit(); this file adds no fields. Calls into other units go through the Seat by name
 * (this.heal, this.pubDig, this.join ...) or, for C++ free functions of mesh_heal.inc, through FREE.
 *
 * Port notes (no behaviour edits):
 *   - the sim's PROOF_IN instrument in leave(), and gate() in bumpMoves/bumpEvict, are left out (sim-only);
 *     bumpMoves / bumpEvict are the lever counters MOVES / EVICTIONS.
 *   - a C++ bool function with out-parameters returns the out value (Coord or null) here (roles.js, ownerCoord).
 *   - Ent is {k, v, age, ch, ba, tn}: an aggregate {k,v,x} fills age first, as in C++.
 *   - the C++ free functions cellOk and coordStr are small static helpers of other files; local copies here.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const roles = req('./roles.js', 'meshRoles');
  const digM = req('./dig.js', 'meshDig');
  const e2f = req('./e2fold.js', 'meshE2fold');   // L48
  const { ins, eraseFirst } = req('./util.js', 'meshUtil');
  const sm = req('./seat.js', 'meshSeat');
  const { cellOk, coordStr } = req('./shared.js', 'meshShared');
  const { Seat, FREE, roomTerm, signedBy, placeBefore, l165Earlier } = sm;

  const K = C_.consts, E = C_.enums;
  const { ckey, ckPc, ckR, ckI, unckey, ownedLinks, rowMates, colMates, down, up, cc } = topo;
  const C = topo.C;
  const LS_OPEN = E.LS_OPEN, LS_DIALING = E.LS_DIALING;
  const newMsg = (t) => msg.newMsg(t);
  const unck = unckey;
  // Ent aggregate {k, v, age, ch, ba, tn}: fields after the given ones at their defaults.
  const ent = (k, v, age, ch = -1, ba = -1, tn = 0) => ({ k, v, age, ch, ba, tn });
  // ~0ULL as the argument of l33MateArm (a double cannot hold 2^64-1; this is the nearest, 2^64).
  const ALLK = 18446744073709551615;


  Seat.unit('live (mesh_seat.inc liveness)', {
    // C++: mesh_seat.inc:Seat::pongDig
    pongDig(m, pid) {
      // § G DOWN-LEG + the AUTHOR'S REFUTATION
      if (this.w.lv.DIGEST && this.state === 3 && this.hasCoord && this.coord.pc !== 0) {
        if (m.dgRoot.at >= 0) {
          const rt = digM.cloneDig(m.dgRoot); this.rxDig(rt);
          if (this.rootDig.at < 0 || rt.rx > this.rootDig.rx) this.rootDig = rt;   // the room fold, shown: a regular beat or an L10.3 early push (dgOnly), fresher ON MY CLOCK wins (G0b)
          if (!m.dgOnly && (this.rootDec.at < 0 || rt.rx > this.rootDec.rx)) { this.rootDec = digM.cloneDig(rt); this.l43Fold(); }   // L10.6: the decision copy takes the regular beat only (one level per period)
        }
        if (m.dgPub.at >= 0) {
          const oc = this.coord.i === 0 ? this.ownerCoord() : null; const isOwner = !!oc && ckey(m.coord) === ckey(oc);
          const isHead = this.coord.i > 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r && m.coord.i === 0;
          // G4 grace on a CHANGED AGGREGATOR; G5: the remedy is to raise it and blur. It evicts NOTHING.
          if ((isOwner || isHead) && pid !== this.lastAgg) { this.lastAgg = pid; this.upSince = this.TICK; this.emptyEcho = 0; }
          else if ((isOwner && this.upRefuted(m.dgPub, m.dgEcho, 1)) || (isHead && this.upRefuted(m.dgPub, m.dgEcho, 0))) {
            this.digMismatch++; this.w.lv.DIG_MISMATCH++;
          }
        }
      }
    },

    // C++: mesh_seat.inc:Seat::noteUnp
    // § G10 / D6 intake
    noteUnp(m) {
      const TICK = this.TICK, x = m.id; if (x < 0 || x === this.id) return;
      const mine = this.hasCoord && this.state === 3 && this.ownedLinkCell(ckey(m.coord)) && this.occGet(ckey(m.coord)) === x;
      if (this.linkIs(m, x)) {
        this.unp.delete(x); this.noChan.delete(x); this.unpSince.delete(x);   // a direct frame ends the unproven streak
        if (mine) {
          this.lkAnyAt = TICK; this.d6Mark = false; this.selfLeaseAt = -1; if (this.lkAt.size >= 64) eraseFirst(this.lkAt); this.lkAt.set(ckey(m.coord), TICK);
          for (const [hk, hv] of Array.from(this.darkHold)) if (hv === x) this.darkHold.delete(hk);
        }
        return;
      }
      if (mine) {
        this.unpAnyAt = TICK;
        let prevAt = -1; const prev = this.unpAt.get(x); if (prev !== undefined) prevAt = prev;
        if (this.unpAt.size >= 64) { const old = this.unpAt.keys().next().value; if (old !== x) this.unpSince.delete(old); this.unpAt.delete(old); }
        // First beat of a run, or the previous beat was a gap. Silence writes nothing.
        if (!this.unpSince.has(x) || prevAt < 0 || TICK - prevAt > 16) this.unpSince.set(x, TICK);
        this.unpAt.set(x, TICK);
      }
      if (this.unp.has(x)) return;
      if (this.unp.size >= 64) eraseFirst(this.unp);
      this.unp.set(x, TICK);
    },

    // C++: mesh_seat.inc:Seat::d6cBeat
    d6cBeat() { return this.lkAnyAt >= this.seatedAt ? this.lkAnyAt : this.lkCarried; },
    // C++: mesh_seat.inc:Seat::orphanSeat
    orphanSeat() {
      if (!this.hasCoord || this.moving || this.state !== 3 || this.d6cBeat() < 0) return false;
      let since = this.d6cBeat(); if (this.backAt > since) since = this.backAt;
      if (this.TICK - since <= K.DARK_LEAVE || (this.unpAnyAt >= 0 && this.TICK - this.unpAnyAt <= 16) || this.l2E2Up()) return false;
      if (this.l14Up >= 0 && this.f.fabricLinkCarries(this.id, this.l14Up)) return false;   // D6c.3
      return true;
    },

    // C++: mesh_seat.inc:Seat::d6cOther
    d6cOther() { for (const g of this.lastGreeters) if (g >= 0 && g !== this.id) return true; return false; },

    // C++: mesh_seat.inc:Seat::darkSeat
    darkSeat() {
      if (!this.hasCoord || this.moving || this.state !== 3) return false;
      const TICK = this.TICK;
      let proven = 0, fresh = 0, blip = 0;
      const ol = ownedLinks(this.coord);
      for (let i = 0; i < ol.length; i++) {
        const k = ckey(ol[i]), x = this.occGet(k);
        if (x < 0 || x === this.id) continue;
        const lb = this.linkedBy.get(k); if (lb === undefined || lb !== x) continue;
        const at = this.lkAt.get(k); if (at === undefined) continue;
        proven++;
        if (TICK - at <= K.DARK_LEAVE) fresh++;
        else if (this.f.fhopActive() && !this.f.fabricUnreachable(this.id, x)) blip++;   // FHOP typing: a stale channel to a peer I am not typed unreachable from is a blip friend-hop carries, not a dark link
      }
      return proven > 0 && fresh === 0 && blip === 0 && this.unpAnyAt >= 0 && TICK - this.unpAnyAt <= 16;
    },

    // C++: mesh_seat.inc:Seat::islanded
    islanded() {
      if (!this.hasCoord || this.state !== 3 || this.moving) return false;
      if (this.lkAnyAt < this.seatedAt) return false;   // D6's rule: a seat whose channels never opened at this cell never had one to lose
      const ol = ownedLinks(this.coord); let named = 0;
      for (let i = 0; i < ol.length; i++) { const x = this.occGet(ckey(ol[i])); if (x >= 0 && x !== this.id) named++; }
      return named >= 3 && this.TICK - this.islandSince() > K.LEASE_ARM;   // three or more silent links are a majority against me
    },

    // C++: mesh_seat.inc:Seat::islandSince
    islandSince() {
      let since = this.seatedAt; if (this.lkAnyAt > since) since = this.lkAnyAt;
      if (this.backAt >= 0 && since < this.backAt) since = this.backAt;
      return since;
    },

    // C++: mesh_seat.inc:Seat::d6Lease
    d6Lease() {
      if (this.selfLeaseAt < 0) { this.selfLeaseAt = this.lkAnyAt >= 0 ? this.lkAnyAt : this.TICK; this.d6Mark = true; this.trace('SELF-LEASE', this.id, this.hasCoord ? this.coord : null, 'd6 at tick %lld, lease from the last proof %lld', this.TICK, this.selfLeaseAt); }   // the lease runs from my LAST PROOF, the clock my neighbours' lease of my cell runs on
      return this.TICK - this.selfLeaseAt <= K.LEASE_T;
    },

    // C++: mesh_seat.inc:Seat::retireDead
    retireDead() {
      if (!this.hasCoord || this.moving || this.state !== 3) return false;
      const TICK = this.TICK;
      let fresh = 0, recent = 0; const dead = [];
      const ol = ownedLinks(this.coord);
      for (let i = 0; i < ol.length; i++) {
        const k = ckey(ol[i]), x = this.occGet(k);
        if (x < 0 || x === this.id) continue;
        const lb = this.linkedBy.get(k); if (lb === undefined || lb !== x) continue;
        const at = this.lkAt.get(k); if (at === undefined) continue;
        const age = TICK - at;
        const u = this.unpAt.get(x);
        const hearing = u !== undefined && TICK - u <= 16;
        const since = this.unpSince.get(x);
        const streak = since !== undefined && (TICK - since > K.DARK_LEAVE || since - at <= 16);   // no silence between the last proof and the streak: it runs from the proof
        if (age <= K.CHAN_UP) recent++;
        if (age <= K.DARK_LEAVE) fresh++;
        if (hearing && age > K.DARK_LEAVE && streak && (!this.f.fhopActive() || this.f.fabricUnreachable(this.id, x))) dead.push(x);
      }
      if (!fresh || dead.length === 0) return false;
      let move = false;
      for (const x of dead) { this.noChan.add(x); if (this.id > x) move = true; }
      if (move) { if (!recent) { if (this.d6Lease()) return false; this.dark6++; this.d6Mark = true; } this.requeue(recent ? 'D6-link' : 'D6-dark'); return true; }   // L3.6: every channel stopped: lease my own cell first
      return false;
    },

    // C++: mesh_seat.inc:Seat::onPhone
    onPhone(m) {
      const id = this.id, TICK = this.TICK, lv = this.w.lv;
      if (m.id < 0) return;
      const sure = this.linkIs(m, m.id); if (sure && m.dgRoot.at >= 0 && lv.DIGEST && this.state === 3 && this.hasCoord && this.coord.pc !== 0 && this.coord.i === 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r && this.occGet(ckey(m.coord)) === m.id) { const rt = digM.cloneDig(m.dgRoot); this.rxDig(rt); if (this.rootDig.at < 0 || rt.rx > this.rootDig.rx) this.rootDig = rt; }   // L2.4.1
      if (sure) this.l711Phone(m);   // L7.11   // FRAME AUTHORITY: a PHONE is unsigned
      const dsig = !sure && signedBy(m, m.id);   // its own signed word, for the digest only
      if (m.kv.voter >= 0) { const wv = this.kVerify(m, sure); this.kLastWhy = wv; if (wv === 0) { this.kvKid.set(ckey(m.coord), [digM.cloneKStmt(m.kv), TICK]); const sv = ins(this.kSeen, m.kv.voter, () => 0); if (m.kv.ver > sv) this.kSeen.set(m.kv.voter, m.kv.ver); this.kTaken++; } else this.kRef[wv]++; }   // L27: checked before anything this frame does
      if (this.hasCoord && this.moving && !this.l4X && m.tock === this.oldCk && m.tock !== ckey(this.coord)) {   // T1 dual-hold: the OLD seat still answers while the claim is in flight
        const p = newMsg('PONG'); p.coord = cc(this.oldCoord); p.id = id; this.emit(m.id, p); return;
      }
      if (this.hasCoord && this.leaseUntil >= 0 && TICK <= this.leaseUntil && m.tock === this.leaseCk && m.tock !== ckey(this.coord)) {   // T3: a call to my just-vacated cell: answer MOVED
        const r = newMsg('MOVED'); r.ck = this.leaseCk; r.mvd = ckey(this.coord); r.id = id; this.emit(m.id, r); return;
      }
      if (this.hasCoord && sure && m.tock !== ckey(this.coord)) { const p = newMsg('PONG'); p.coord = cc(this.coord); p.id = id; p.from = -1; const oc = this.ownerCoord(); if (oc) { p.oCk = ckey(oc); p.owner = this.occGet(p.oCk); } else { p.owner = -1; } this.emit(m.id, p); return; }   // NOT ME
      // L15.2 A BEAT SENT BEFORE A GOODBYE NEVER LANDS AFTER IT.
      { const lb = this.l152Bye.get(m.id); if (lb !== undefined && lb[0] === ckey(m.coord) && TICK - lb[1] <= 2) return; }
      if (!this.hasCoord && this.state !== 3 && this.leftCk && m.tock === this.leftCk && TICK - this.leftAt <= 220 && sure && this.f.fabricDoors()) { const gone = this.leftCk; const l = newMsg('LEAVE'); l.ck = gone; l.id = id; this.emit(m.id, l); this.trace('GONE-ANSWER', id, null, 'to=%d cell=%s', m.id, coordStr(unck(gone))); return; }   // a call for the cell I left: my goodbye again
      if (!this.hasCoord || m.tock !== ckey(this.coord)) return;   // tock is always set for a PHONE
      if (m.tag === 5 && (!this.headGone())) return;   // L2.7: I stand in for my head only while I judge it gone myself
      // Every honest PHONE comes from one of MY owned links; an UNPROVEN one may only refresh a pairing I already hold.
      if (!this.ownedLinkCell(ckey(m.coord))) return;
      if (!sure && this.occGet(ckey(m.coord)) !== m.id) return;
      if (m.tag === 5 && !e2f.L48_OFF && lv.DIGEST && this.state === 3 && m.dgSi.at >= 0 && this.coord.pc !== 0 && this.coord.i !== 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r && m.coord.i !== 0) { const u = digM.cloneDig(m.dgSi); this.rxDig(u); u.rows.length = 0; if (this.siKids.size >= C) this.siKids.clear(); this.siKids.set(ckey(m.coord), u); }   // L48: a row-mate's own report while I stand in for our head
      let l810 = false;   // L8.10: this phone is the other ring.
      { // E2 at the ARBITER
        const k0 = ckey(m.coord), p0 = this.occGet(k0);
        let held = p0 >= 0 && p0 !== m.id && (this.holdsCell(k0, 40) || this.heldRedial(k0, p0, 40));   // L16.7
        // L8.36 A HOLDER LAST HEARD BEFORE THE CLAIMANT ARRIVED IS NO REASON TO YIELD IT.
        if (held && roomTerm(this, 1) && m.arr >= 0 && this.l836Merging()) { const lvv = this.live.get(k0); if (lvv === undefined || lvv < TICK - m.arr) held = false; }
        if (held && roomTerm(this, 1) && m.c7Min >= 0 && m.c7Min !== this.ringName()) { const xs = this.xrOk.get(m.id); if (xs !== undefined && TICK - xs <= 2 * K.RELAY_TTL) l810 = true; }   // L8.10
        if (!l810 && held && this.f.fabricDoors() && ckPc(k0) === 0 && p0 >= 0 && p0 !== m.id) {
          const h1 = this.l165Have(k0, m.id), h2 = this.l165Have(k0, p0);
          if (h1 && h2) {
            const f1 = h1.from, a1 = h1.at, l1 = h1.loc, f2 = h2.from, a2 = h2.at, l2 = h2.loc;
            const mw = l165Earlier(l1, f1, m.id, l2, f2, p0); const winner = mw ? m.id : p0, loser = mw ? p0 : m.id;
            const y = newMsg('YIELD'); y.tag = 1614; y.ck = k0; y.id = id; y.nc = winner; y.pp = mw ? f1 : f2; y.ppAt = mw ? a1 : a2; y.ppL = mw ? l1 : l2; this.emit(loser, y);
            { const c9 = unck(k0); this.trace('L16.5-YIELD', id, c9, 'loser=%d winner=%d phone', loser, winner); }
            if (mw) held = false; else return;
          }
        }   // L16.5 at the phone: both proofs known, the later placement yields
        if (!l810 && sure && m.arr >= 0) {
          const bm = this.claimBorn(m); const b = this.rmBirthOf.get(k0);   // L11: E2 at the arbiter: the EARLIER claim on the cell stays
          let pb = -1, havePb;
          if (b !== undefined && b[0] === p0) { pb = b[1]; havePb = true; }
          else { havePb = false; if (this.f.fabricDoors()) { const bo = this.bornOf(k0, p0); if (bo !== null) { pb = bo; havePb = true; } } }
          if (held && this.heldRightNow(k0) && !havePb && this.f.fabricDoors() && m.born >= 0) { const w2 = this.l167Wait.get(k0); if (w2 === undefined) { if (this.l167Wait.size >= 4 * C) eraseFirst(this.l167Wait); this.l167Wait.set(k0, TICK); return; } if (TICK - w2 <= K.L167_WAIT) return; }   // L16.7
          if (held && this.heldRightNow(k0) && havePb) {
            this.l167Wait.delete(k0);
            const mw = this.f.fabricDoors() ? placeBefore(m.id, bm, p0, pb) : (bm < b[1]);
            if (mw) { const y = newMsg('YIELD'); y.tag = 1616; y.ck = k0; y.id = id; y.nc = m.id; y.born = bm; this.l165Attach(y, k0, m.id); this.emit(p0, y); held = false; }
            else { const y = newMsg('YIELD'); y.tag = 1616; y.ck = k0; y.id = id; y.nc = p0; y.born = pb; this.l165Attach(y, k0, p0); this.emit(m.id, y); return; }
          }
          if (!held && (b === undefined || b[0] !== m.id)) { if (this.rmBirthOf.size >= 4 * C) eraseFirst(this.rmBirthOf); this.rmBirthOf.set(k0, [m.id, bm]); }
        }
        if (!l810 && held && (m.id > p0 || this.rawClaim(k0, m.id, 40))) { const y = newMsg('YIELD'); y.tag = 1618; y.ck = k0; y.id = id; if (this.f.fabricDoors()) y.nc = p0; this.l165Attach(y, k0, p0); this.l167Attach(y, k0, p0); this.emit(m.id, y); return; }   // id: the arbiter names itself
        if (!l810 && held && this.liveElsewhere(m.id, k0)) return;
        if (sure) this.nbrHeard();
      }
      // § G UP-LEG: the phoner's digest arrives as PAYLOAD on the beat it already sends.
      if ((sure || dsig) && lv.DIGEST && this.state === 3 && m.dgUp.at >= 0 && m.tag !== 5) this.takeUp(m);
      const ck = ckey(m.coord), prev = this.occGet(ck);
      // an unproven PHONE keeps a pairing alive only while no link has ever proven it
      if (sure && !l810) { this.setOcc(ck, m.id); this.liveMark(ck); this.noteS1(ck); this.noteLinked(ck, m.id, m.tn); }   // L8.10
      else { this.upUsed.set(ck, TICK); if (this.entryOpen(ck, m.id)) { this.liveMark(ck); this.noteS1(ck); } }   // upUsed: an unproven beat for the pairing I hold
      if (sure && !l810) { this.kidful.set(ck, m.kids ? 1 : 0); if (m.child >= 0) this.childOf.set(ck, m.child); else this.childOf.delete(ck); }
      // V7: my down-child head phoned me its ROW LEDGER.
      if (sure && ck === ckey(down(this.coord))) {
        let nr = 0; const named = new Map();
        for (const e of m.row) {
          if (++nr > C) break; const c = unck(e.k);
          if (!cellOk(e.k) || c.pc !== m.coord.pc || c.r !== m.coord.r || c.i === 0 || e.v < 0) continue;
          named.set(e.k, e.v); this.ledgerSeen.set(e.k, TICK);
          if (this.l13On()) { this.l13RowMemo.set(e.k, [e.v, TICK]); if (this.l13RowMemo.size > 4 * C) eraseFirst(this.l13RowMemo); }
          if ((e.tn & 0x8000) && lv.TIERS_ACTIVE && e.v !== id && !this.tierSeen.has(e.v)) this.tierSeen.set(e.v, e.tn & 0x7fff);   // L4: the head's word on its mate's tier and NAT kind
          if (!this.occ.has(e.k)) { this.setOcc(e.k, e.v); this.noteS1(e.k); }
        }   // only the head itself, only cells 1..C-1 of ITS row
        // V7b GENERATION (H4): past the grace (generation >= 1) THE LEDGER IS THE ROW on every beat.
        if (m.rg >= 1) {
          for (let j = 1; j < C; j++) {
            const rk = ckey({ pc: m.coord.pc, r: m.coord.r, i: j }); if (!this.occ.has(rk) || this.firstHandLive(rk) || this.sitting.has(rk)) continue;
            const nv = named.get(rk);
            if (nv === undefined) { this.occDrop(rk, 'row-gen'); this.ledgerSeen.delete(rk); this.live.delete(rk); this.kidful.delete(rk); this.s1seen.delete(rk); this.childOf.delete(rk); this.tlForget(rk); this.healTry.delete(rk); }
            else if (this.occGet(rk) !== nv) { this.setOcc(rk, nv); this.noteS1(rk); }
          }
        }
        {
          const on = new Set();
          for (const e of m.l20) {
            const c = unck(e.k); if (!cellOk(e.k) || c.pc !== m.coord.pc || c.r !== m.coord.r || c.i === 0 || e.v < 0 || e.v === id || this.occGet(e.k) >= 0) continue;
            on.add(e.k); const h = this.l20Hold.get(e.k);
            if (h === undefined || h.x !== e.v) { this.l20Hold.set(e.k, { x: e.v, at: TICK, bye: false }); this.trace('L20-HOLD', id, c, 'mate=%d head=%d', e.v, m.id); }
          }
          for (const k of Array.from(this.l20Hold.keys())) { const c = unck(k); if (c.pc === m.coord.pc && c.r === m.coord.r && !on.has(k)) this.l20Hold.delete(k); }
        }   // L20: my child head names a mate it lost out of its reach
        if (m.rg >= 0) { this.rowGenSeenId = m.id; this.rowGenSeen = m.rg; }
        { if (m.id !== this.rmLedgerHead && (this.rmLedgerHead >= 0 || this.rmHistAt > -1000)) this.rmNewHeadAt = TICK; if (this.l13On() && this.rmLedgerHead < 0 && this.l13ReqN > 0 && TICK - this.seatedAt < K.LEASE_T) this.rmNewHeadAt = TICK; this.rmLedgerHead = m.id; this.rmHistAt = -1000; }   // L13 / L11
        this.rowLedgerAt = TICK;
      }
      let owner = -1, oCk = 0; { const myoc = this.ownerCoord(); if (myoc) { oCk = ckey(myoc); owner = this.occGet(oCk); } }
      const row = [];
      if (this.coord.i === 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r) {
        row.push(ent(ckey(this.coord), id, this.occGet(ckey(down(this.coord)))));
        for (let c = 1; c < C; c++) { const rc = { pc: this.coord.pc, r: this.coord.r, i: c }; const x = this.occGet(ckey(rc)); if (x >= 0 && x !== m.id) row.push(ent(ckey(rc), x, this.childOf.has(ckey(rc)) ? this.childOf.get(ckey(rc)) : -1)); }
      }
      const cous = [];
      if (ckey(m.coord) === ckey(down(this.coord))) {   // my DOWN-CHILD is phoning: teach it the heirs at its FUTURE owned-links
        const rm = rowMates(this.coord);
        for (let q = 0; q < C - 1; q++) {
          if (this.coord.pc !== 0) { const x = this.occGet(ckey(rm[q])); if (x >= 0 && x !== m.id) { cous.push({ k: ckey(rm[q]), v: x }); continue; } }
          const it = this.childOf.get(ckey(rm[q])); if (it !== undefined && it >= 0) cous.push({ k: ckey(rm[q]), v: it });
        }   // L2 (deep)
        if (this.l13('L13.1') && this.coord.pc !== 0) {
          const oc9 = this.ownerCoord();
          if (oc9) {
            const ring = FREE.l13Ring(oc9);
            for (const [ck2, cv] of this.cousins) { if (cv < 0 || cv === m.id) continue; let inn = false; for (let q = 0; q < ring.length; q++) if (ckey(ring[q]) === ck2) inn = true; if (inn) cous.push({ k: ck2, v: cv }); }
            const o = this.occGet(ckey(oc9)); if (o >= 0 && o !== m.id) cous.push({ k: ckey(oc9), v: o });
          }
        }   // L13.1
        if (this.coord.pc === 0) {   // W7: my future owned-links are my whole ROW + whole COLUMN (rook)
          const cm = colMates(this.coord);
          for (let q = 0; q < C - 1; q++) { const it = this.childOf.get(ckey(cm[q])); if (it !== undefined && it >= 0) cous.push({ k: ckey(cm[q]), v: it }); }
          {
            const got = new Set(); for (const c of cous) got.add(c.k);
            const rk = []; for (let q = 0; q < C - 1; q++) { rk[q] = rm[q]; rk[C - 1 + q] = cm[q]; }
            for (let q = 0; q < 2 * (C - 1); q++) { const k = ckey(rk[q]); const x = this.occGet(k); if (!got.has(k) && x >= 0 && x !== m.id && this.firstHandLive(k)) cous.push({ k, v: x }); }
          }
          if (this.l13('L13.1')) {
            const rk = []; for (let q = 0; q < C - 1; q++) { rk[q] = rm[q]; rk[C - 1 + q] = cm[q]; }
            for (let q = 0; q < 2 * (C - 1); q++) { const k = ckey(rk[q]); const x = this.occGet(k); if (x >= 0 && x !== m.id && this.firstHandLive(k)) { let has = false; for (const c of cous) if (c.k === k && c.v === x) has = true; if (!has) cous.push({ k, v: x }); } }
          }   // L13.1 / L1.1 (a)
        }
      } else if (this.coord.i === 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r) {   // a ROW-MATE phoned me (the head): share MY cousins
        for (const [ck2, cv] of this.cousins) cous.push({ k: ck2, v: cv });
      }
      const p = newMsg('PONG'); p.owner = owner; p.oCk = oCk; p.row = row; p.nbrs = cous; p.coord = cc(this.coord); p.id = id;
      {
        const view = (c) => ckey(c) === ckey(this.coord) || this.occGet(ckey(c)) >= 0;
        if (ckey(m.coord) === ckey(down(this.coord))) {
          const crow = { pc: m.coord.pc, r: m.coord.r, i: 0 };
          {
            const alone = !roles.rightWalk(this.coord, this.coord.i < C - 1 ? this.coord.i + 1 : 1, this.coord.i, -1, view);
            const b = alone ? null : roles.backupOwnerOf(crow, view);
            if (!alone && b) { p.bkCk = ckey(b); p.bkId = (ckey(b) === ckey(this.coord)) ? id : this.occGet(ckey(b)); }
            else if (alone && this.bkId >= 0) { p.bkCk = this.bkCk; p.bkId = this.bkId; }
          }   /* L2.2b: alone in my row, my child row's backup owner is my own row's, as my owner named it */
          const b3 = roles.standbyOf(crow, view); if (b3) { p.u3Ck = ckey(b3); p.u3Id = (ckey(b3) === ckey(this.coord)) ? id : this.occGet(ckey(b3)); }
        }   // L2.2: my child row's backup owner (and standby), read off my own row
        else if (this.coord.pc !== 0 && this.coord.i === 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r) { p.bkId = this.bkId; p.bkCk = this.bkCk; if ((this.bkId < 0 || this.bkId === id) && this.l9BkId >= 0 && TICK - this.l9BkAt <= K.LEASE_T) { p.bkId = this.l9BkId; p.bkCk = this.l9BkCk; } p.u3Id = this.sbId; p.u3Ck = this.sbCk; p.e1dn = this.e1Dn; p.e1At = this.e1DnAt; }   // ...relayed to my row, with my E1's state
      }
      // § G DOWN-LEG (rides the PONG I already send)
      if (m.hard && m.t === 'PHONE' && this.coord.pc !== 0 && this.coord.i === 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r) { this.ownDeadAt = TICK; this.ownDeadCk = m.oCk; this.ownDeadId = m.owner; this.ownDeadSeen = this.occGet(m.oCk); }
      if (m.e1dn && this.coord.pc !== 0 && this.coord.i === 0 && m.coord.pc === this.coord.pc && m.coord.r === this.coord.r) { this.ownVouchAt = this.l211Stamp(m); const oc3 = this.ownerCoord(); if (m.owner >= 0 && m.owner !== id && oc3 && m.oCk === ckey(oc3) && this.occGet(m.oCk) < 0 && !this.byeAt.has(m.oCk) && !this.translost.has(m.oCk)) { this.setOcc(m.oCk, m.owner); this.noteS1(m.oCk); } }   // my E2 source relays the backup owner's word: my owner lives
      if (m.tag === 5) { p.tag = 5; if (p.row.length === 0) for (let c = 0; c < C; c++) { const rc = { pc: this.coord.pc, r: this.coord.r, i: c }; let x = this.occGet(ckey(rc)); if (c === this.coord.i) x = id; if ((x >= 0 && x !== m.id && this.firstHandLive(ckey(rc))) || c === this.coord.i) p.row.push(ent(ckey(rc), x, -1)); } }   // L2.7: a stand-in's answer
      if (lv.DIGEST && this.state === 3 && m.tag !== 5) {
        p.dgRoot = this.wireDig(this.rootDig); p.dgRoot.kl.length = 0;   // L27.9: the list rides up only
        if (this.kFakeT >= 0) { p.dgRoot.part = 0; p.dgRoot.kick.push({ tgt: this.kFakeT, up: Math.max(0, p.dgRoot.n) + Math.max(0, p.dgRoot.leased), dn: 0 }); }   // L27 `kfake`
        { this.l10DgTo.set(m.id, TICK); this.l10DgN.set(m.id, digM.digSig(this.rootDig) | 0); }   // L10.3: the fold this beat carried, by signature (a list change is news too)
        const isDownKid = ckey(m.coord) === ckey(down(this.coord));
        p.dgPub = this.pubDig(isDownKid ? this.myDig : ((this.coord.pc !== 0 && this.coord.i === 0) ? this.rowDig : this.myDig));
        // ...and the ECHO: the report I actually folded FROM THIS PEER (downUsed / rowUsed, snapshotted at rollup).
        if (isDownKid) p.dgEcho = this.pubDig(this.downUsed);
        else if (this.coord.pc !== 0 && this.coord.i === 0) { const it = this.rowUsed.get(ckey(m.coord)); if (it !== undefined) p.dgEcho = this.pubDig(it); }
      }
      if (this.coord.pc === 0 && this.coord.i === 0 && m.coord.pc === 0 && m.coord.r === this.coord.r && this.vacOut.size) this.d52Out(p);   // D5.2
      this.emit(m.id, p);   // p.coord: my coord, so the phoner gains FIRST-HAND liveness for me
      if (!l810 && prev >= 0 && prev !== m.id) { const y = newMsg('YIELD'); y.tag = 1695; y.ck = ck; y.id = id; if (this.f.fabricDoors()) { y.nc = m.id; y.born = this.claimBorn(m); } this.emit(prev, y); }   // L8.10
    },

    // C++: mesh_seat.inc:Seat::goodbyeHeal
    goodbyeHeal(k, moved = false) {
      const lv = this.w.lv;
      this.byeAt.set(k, this.TICK);   // the goodbye is first-hand proof the cell emptied
      { const left = unck(k); if (moved && left.pc === 0 && !this.hasDownChild(left)) { this.l1Vacated.set(k, this.TICK); if (left.i === 0) { const par = up(left); if (par) this.childOf.delete(ckey(par)); } return; } }   // L1.1
      if (this.occGet(k) < 0 && FREE.l1HasMover(this, unck(k)) && !(this.hasCoord && (FREE.l1MoverCell(this, unck(k)) === ckey(this.coord) || ckey(down(unck(k))) === ckey(this.coord)))) { this.healTry.set(k, this.TICK); this.healOnly.delete(k); }   // L1.2
      // H-CHAIN vertical: when a DOWN-CHILD vacates, clear childOf on its owner.
      { const left = unck(k); if (left.i === 0) { const par = up(left); if (par) this.childOf.delete(ckey(par)); } }
      // H-CHAIN LEFT-PACK (reactive)
      if (lv.HEALING && this.hasCoord && this.state === 3) {
        const c = unck(k);
        const downFree = this.occGet(ckey(down(c))) < 0 || (this.l13('L13.5') && this.liveElsewhere(this.occGet(ckey(down(c))), ckey(down(c))));   /* L13.5 */
        if (c.pc === this.coord.pc && c.r === this.coord.r && this.coord.i > c.i && downFree && !this.l1KidHeals(c)) {
          let first = true;
          for (let j = c.i + 1; j < this.coord.i; j++) if (this.occGet(ckey({ pc: c.pc, r: c.r, i: j })) >= 0) { first = false; break; }
          if (first) { if (c.pc !== 0 && c.i === 0) { this.tryHeadFill(); return; } if (c.pc !== 0 && c.i !== 0) return; this.heal(c); return; }   // L13.5 / L9.3 / L9.5 / L1.3
        }
        // H-CHAIN S1 COLUMN-clique (reactive)
        if (1 >= 2 && this.coord.pc === 0 && c.pc === 0 && this.coord.i === c.i && this.coord.r > c.r && FREE.l1MoverCell(this, c) === ckey(this.coord)) { this.heal(c); return; }   // L5.2 P2/P3: I am the hole's column mover
        if (this.coord.pc === 0 && c.pc === 0 && this.coord.i === c.i && this.coord.r > c.r && this.occGet(ckey(down(c))) < 0 && ((1 === 1 && FREE.l1RowEmpty(this, c)))) {   // L1.1: a column-mate is only the witness of a wholly dead row
          let rowRightEmpty = true;
          for (let j = c.i + 1; j < C; j++) if (this.firstHandLive(ckey({ pc: 0, r: c.r, i: j }))) { rowRightEmpty = false; break; }
          if (rowRightEmpty) {
            let first = true;
            for (let rr = c.r + 1; rr < this.coord.r; rr++) {
              if (this.occGet(ckey({ pc: 0, r: rr, i: c.i })) >= 0) { first = false; break; }
            }
            if (first) { this.heal(c); return; }
          }
        }
      }
    },

    // C++: mesh_seat.inc:Seat::l213HeadPc
    l213HeadPc(o) { if (this.hasCoord && this.state === 3 && this.coord.pc !== 0 && this.coord.i !== 0 && this.occGet(ckey({ pc: this.coord.pc, r: this.coord.r, i: 0 })) === o) this.headAckAt = this.TICK; },
    // C++: mesh_seat.inc:Seat::phoneHome
    // early (L10): the state beat sent sooner: no stand-in, no probe of a vacant cell, none of the silence bookkeeping below the send
    phoneHome(early = false) {
      const id = this.id, TICK = this.TICK, lv = this.w.lv;
      let tc = null, have = false;
      if (this.hasCoord) { if (this.coord.i !== 0) { tc = { pc: this.coord.pc, r: this.coord.r, i: 0 }; have = true; } else { tc = this.ownerCoord(); have = !!tc; } }
      let standIn = false;   // L2.7
      if (!early && have && this.coord.pc !== 0 && this.coord.i !== 0) { const h0 = this.occGet(ckey(tc)); if (h0 < 0) this.l9HeadSeen = -1; else if (h0 !== this.l9HeadSeen) { this.l9HeadSeen = h0; this.headAckAt = TICK; } }   // L9.10, L9.17, L2.13
      if (have && this.coord.pc !== 0 && this.coord.i !== 0 && this.state === 3 && TICK - this.seatedAt > 8 + K.EARLY_HOLD) {
        const hk = ckey(tc); const h = this.occGet(hk);
        if (h < 0 || this.translost.has(hk) || TICK - this.headAckAt > 8 + K.EARLY_HOLD) {
          const view = (c) => ckey(c) === ckey(this.coord) || this.occGet(ckey(c)) >= 0; const row = { pc: this.coord.pc, r: this.coord.r, i: 0 };
          const sc = roles.heirOf(row, view);
          if (sc && ckey(sc) !== ckey(this.coord) && this.occGet(ckey(sc)) >= 0) { tc = sc; standIn = true; }
        }
      }
      if (early && standIn) return;
      if (!have) return; const tid = this.occGet(ckey(tc)); if (tid < 0) { if (!early) this.routeTo(tc, 1); return; }   // a vacant up-cell is probed every beat
      const m = newMsg('PHONE'); m.coord = cc(this.coord); m.tock = ckey(tc); m.id = id; m.kids = this.hasChildren(); m.child = this.occGet(ckey(down(this.coord))); if (standIn) m.tag = 5; m.l10E = early; this.l711Beat(m, tid);   /* L7.11 */   // an early beat carries the digest alone (L10)
      if (!early && this.coord.i !== 0 && TICK - this.ownVouchAt <= 8 + K.EARLY_HOLD && !this.l211Withdrawn()) { m.e1dn = true; m.owner = this.vouchOwner; m.oCk = this.vouchOCk; m.vAt = this.ownVouchAt; }
      else if (!early && this.coord.i !== 0 && TICK - this.ownDeadAt <= 8 + K.EARLY_HOLD) { m.hard = true; m.oCk = this.ownDeadCk; m.owner = this.ownDeadId; }   // L2.9 / L2.7
      // V7 THE DEEP-ROW LEDGER: a deep head phoning its OWNER carries its row's occupants (cells 1..C-1, first-hand at the head).
      if (!early && this.coord.pc !== 0 && this.coord.i === 0) {
        let sig = '';
        for (let j = 1; j < C; j++) {
          const rk = ckey({ pc: this.coord.pc, r: this.coord.r, i: j }); const x = this.occGet(rk);
          if (x >= 0 && x !== id) { m.row.push(ent(rk, x, -1)); if (lv.TIERS_ACTIVE) { const ts = this.tierSeen.get(x); if (ts !== undefined) m.row[m.row.length - 1].tn = (0x8000 | ts) & 0xffff; } sig += String(rk) + ':' + String(x) + ';'; }
        }
        // V7b: the ledger's GENERATION
        if (TICK - this.seatedAt >= K.LEDGER_GRACE) { if (sig !== this.rowLedgerLast) this.rowGen++; if (this.rowGen < 1) this.rowGen = 1; }
        this.rowLedgerLast = sig; m.rg = this.rowGen;
        { for (const [lk, lvv] of Array.from(this.l20Out)) { if (this.occGet(lk) >= 0 || TICK - lvv[1] > K.LEASE_T) this.l20Out.delete(lk); else m.l20.push({ k: lk, v: lvv[0] }); } }   // L20
      }
      // § G UP-LEG (payload on the beat, G0)
      if (lv.DIGEST && this.state === 3 && !standIn) { m.dgUp = this.pubDig((this.coord.pc !== 0 && this.coord.i === 0) ? this.rowDig : this.myDig); this.noteUp(m.dgUp); }
      else if (lv.DIGEST && this.state === 3 && !e2f.L48_OFF && this.myDig.at >= 0) { m.dgSi = this.wireDig(this.myDig); m.dgSi.rows.length = 0; }   // L48: my own report, for the heir's stand-in fold
      if (!early && !standIn && this.u2Hot && lv.DIGEST && this.state === 3 && this.coord.pc !== 0 && this.coord.i !== 0 && this.rootDig.at >= 0) { m.dgRoot = this.wireDig(this.rootDig); m.dgRoot.kl.length = 0; }   // L2.4.1
      this.emit(tid, m); this.l10Sent = true;
      if (early) return;
      // A GHOST PHONE TARGET MUST BE FALSIFIABLE (2026-08-05, churn-combos leg C): see the sim for the long form.
      {
        const tk = ckey(tc);
        if (TICK - this.lastAck > K.OWNER_SILENT && !this.live.has(tk)) {
          this.routeToProbe(tc);   // AROUND the occupant I doubt
          // A GHOST SECTION-1 OWNER IS ASKED OF THE DOOR
          if (tc.pc === 0 && TICK - this.rosterAskAt > 40 && this.lastGreeters.length) { const gs = []; for (const g of this.lastGreeters) if (g >= 0 && g !== id) gs.push(g); if (gs.length) { this.rosterAskAt = TICK; const w = newMsg('WHOHOME'); w.from = id; w.ttl = 60; this.emit(gs[Math.trunc(this.rng() * gs.length)], w); } }
          let confirmH = (tc.pc === 0) ? K.LEASE_T : 90;   // L3.11 below; deep: 1.5x the healer horizon
          if (tc.pc !== 0) { const ow = this.occGet(tk); if (ow >= 0 && this.relMark.has(ow) && TICK - this.relMark.get(ow) <= K.LEASE_T) confirmH = K.LEASE_T; }   // L3.11
          if (TICK - this.lastAck > confirmH && this.occ.has(tk) && !(tc.pc !== 0 && TICK - this.ownVouchAt <= 2 * 8 + K.EARLY_HOLD) && !(this.l2RowE2Down()) && !(this.l13On() && this.born.has(tk) && TICK - this.born.get(tk) <= confirmH)) { this.occDrop(tk, 'ack-horizon'); /* L13 */ /* L2.8 */ this.kidful.delete(tk); this.s1seen.delete(tk); }
        }
      }
    },

    // C++: mesh_seat.inc:Seat::s1Heartbeat
    // early (L10): the digest alone, to each rook neighbour; no probe
    s1Heartbeat(early = false) {
      if (!this.hasCoord || this.coord.pc !== 0) return;
      const TICK = this.TICK, ol = ownedLinks(this.coord);
      for (let k = 0; k < ol.length; k++) {
        const t = ol[k]; if (t.pc !== 0) continue;   // rook (Section-1) links only
        const tid = this.occGet(ckey(t));
        if (tid < 0 || tid === this.id) continue;
        if (!early) { const tk = ckey(t); const lvv = this.live.get(tk), po = this.probeOut.get(tk); if (!this.translost.has(tk) && !this.firstHandLive(tk) && (lvv === undefined || TICK - lvv > K.OWNER_SILENT) && (po === undefined || TICK - po.last > K.OWNER_SILENT)) this.routeToProbe(t); }   // a rook cell held by a seat I do not hear is probed once per silence window
        const m = newMsg('PHONE'); m.coord = cc(this.coord); m.tock = ckey(t); m.id = this.id; m.kids = this.hasChildren(); m.child = this.occGet(ckey(down(this.coord)));
        if (this.w.lv.DIGEST && this.state === 3) m.dgUp = this.pubDig(this.myDig);   // § G: rook peers exchange SECTION digests
        m.l10E = early; this.emit(tid, m);
      }
    },

    // C++: mesh_seat.inc:Seat::l10Digs
    // the section table a Section-1 beat carries, from the active digest state
    l10Digs() {
      const TICK = this.TICK, digs = [];
      if (this.w.lv.DIGEST && this.state === 3) {
        digs.push({ k: ckey(this.coord), d: this.pubDig(this.myDig) });
        for (const [ek, ed] of this.s1tab) if (ek !== ckey(this.coord) && this.LT() - ed.rx <= K.DIG_TTL) digs.push({ k: ek, d: this.wireDig(ed) });
        for (const [fk, fv] of Array.from(this.digForgot)) {   // a vacate (a mover left the cell): told on for a while, so a Section-1 seat that never heard it first-hand drops the old cell's report too
          if (this.LT() - fv[1] > 40) { this.digForgot.delete(fk); continue; }
          let have = this.digGone.has(fk); for (const d of digs) if (d.k === fk) have = true;
          if (!have && digs.length < C * C) { const z = msg.newDig(); z.at = -1; z.n = -1; z.by = fv[0]; z.ag = Math.max(0, (this.LT() | 0) - fv[1]); digs.push({ k: fk, d: z }); }
        }
        // L3.12: a section whose held report a lease verdict just ended goes out as a tombstone
        if (this.digGone.size) {
          for (const [gk, gv] of Array.from(this.digGone)) {
            if (TICK - gv[1] > 40) { this.digGone.delete(gk); continue; }
            let have = false; for (const d of digs) if (d.k === gk) have = true;
            if (!have && digs.length < C * C) { const z = msg.newDig(); z.at = -1; z.by = gv[0]; digs.push({ k: gk, d: z }); }
          }
        }
      }
      return digs;
    },

    // C++: mesh_seat.inc:Seat::s1Sync
    // early (L10): the section table only; the occupancy gossip (ent) stays on the regular beat
    s1Sync(early = false) {
      const TICK = this.TICK;
      const ents = []; ents.push(ent(ckey(this.coord), this.id, 0, this.occGet(ckey(down(this.coord))), this.born.has(ckey(this.coord)) ? Math.max(0, this.LT() - this.born.get(ckey(this.coord))) : 0));   // carry MY heir (my down-child) and my claim's AGE
      if (!early) for (const [ek, ev] of this.occ) { if (ckPc(ek) === 0 && ev !== this.id && !this.s1Told(ek)) { const it = this.s1seen.get(ek); if (it !== undefined && TICK - it < 120) ents.push(ent(ek, ev, TICK - it, this.childOf.has(ek) ? this.childOf.get(ek) : -1, this.born.has(ek) ? Math.max(0, this.LT() - this.born.get(ek)) : -1)); } }
      // W7: sync S1SYNC over the whole rook neighbourhood
      const tg = new Set(); const rm = rowMates(this.coord); for (let q = 0; q < C - 1; q++) { const t = this.occGet(ckey(rm[q])); if (t >= 0 && t !== this.id) tg.add(t); }
      const cm = colMates(this.coord); for (let q = 0; q < C - 1; q++) { const t = this.occGet(ckey(cm[q])); if (t >= 0 && t !== this.id) tg.add(t); }
      // § G ROOT FOLD: the digest table rides S1SYNC, relayed at the author's stamp and a grown relative age.
      const digs = this.l10Digs();
      for (const t of tg) { const m = newMsg('S1SYNC'); if (!early) m.ent = ents.map((e) => ({ ...e })); m.digs = digs.map(digM.cloneDigE); m.l10E = early; if (!early && this.vacSeen.size) this.d52Fh(m); this.emit(t, m); }
    },

    // C++: mesh_seat.inc:Seat::l13MateGone
    l13MateGone(k) {
      const TICK = this.TICK;
      if (!(this.l13('L13.33') || this.l33MateArm(k)) || !this.hasCoord || this.state !== 3 || this.coord.pc !== 0 || TICK - this.seatedAt < 60) return false;
      const c = unck(k); if (c.pc !== 0 || k === ckey(this.coord)) return false;
      const mine = this.coord.i === 0 && c.r === this.coord.r && c.i !== 0;   // a mate cell of my own row (I am its head): my dial is evidence too
      const x = this.occGet(k); if (x < 0 || x === this.id || this.softSitting(k) || this.firstHandLive(k)) return false;
      { const lv = this.live.get(k); if (lv !== undefined && lv >= this.seatedAt) return false; const pb = this.pongBy.get(k); if (pb !== undefined && pb[0] === x && pb[1] >= this.seatedAt) return false; }
      if (this.f.fabricLinkState(this.id, x) === LS_OPEN) return false;
      if (mine) { if (this.f.fabricDialFails(this.id, x) < 1) return false; if (this.greetersAt < 0 || TICK - this.greetersAt > K.RELAY_TTL) return false; }
      else {
        if (!this.l13('L13.36')) return false; let broke = this.seatedAt; for (const [, bv] of this.byeIds) if (bv > broke) broke = bv; if (this.greetersAt < broke || TICK - this.greetersAt > K.RELAY_TTL) return false;
        const bn = this.born.get(k); if (bn === undefined || bn >= this.greetersAt - 8) return false;
      }   // L13.36: any other home cell: the door's list, received after I sat and after my latest goodbye, is the word
      for (const g of this.lastGreeters) if (g === x) return false;
      return true;
    },

    // C++: mesh_seat.inc:Seat::rowSweep
    rowSweep() {
      const TICK = this.TICK;
      if (this.standDown()) return;   // L3.6: no channel of mine is up, or none of my links is heard: I sweep nobody
      // 11a: rowSweep is pure cleanup: forget a row cell gone silent past the horizon
      if (this.coord.i !== 0) return;
      const del = [];
      // L3.5 / D7 / L3.2: a return is not a horizon; a row-mate I once heard first-hand and now do not is leased.
      const hz = K.LEASE_T;
      for (const [ek, ev] of this.live) { let since = this.heardAny(ek, ev); if (since < this.seatedAt) since = this.seatedAt; if (this.backAt >= 0 && since < this.backAt) since = this.backAt; if (TICK - since <= hz) continue; const c = unck(ek); if (c.pc === this.coord.pc && c.r === this.coord.r && c.i > 0) { del.push(ek); this.holeSince.set(ek, since); } }   // L3.4: the lease ends ONCE
      // ...and a DEEP row cell I have NEVER heard: an occ entry with no live stamp, believed for longer than the same horizon.
      if (this.coord.pc !== 0) for (const [ek, ev] of this.occ) { const c = unck(ek); if (c.pc !== this.coord.pc || c.r !== this.coord.r || c.i === 0 || ev === this.id || this.live.has(ek)) continue; const b = this.born.get(ek); if (b !== undefined && this.LT() - b <= 50) continue; del.push(ek); }
      // L13.33 (mass leave): a HOME row cell I have never heard since I sat, 60 ticks after I sat, whose occupant my own dial cannot reach, is gone.
      if ((this.l13('L13.33') || this.l33MateArm(ALLK)) && this.coord.pc === 0 && !this.moving) {
        const gone = [];   /* L33.9: a home head's own row, whether or not it sees a mass leave (mesh_mltail.inc) */
        for (const [ek, ev] of this.occ) {
          const c = unck(ek); if (c.pc !== 0 || c.r !== this.coord.r || c.i === 0 || ev === this.id || this.softSitting(ek) || this.firstHandLive(ek)) continue;
          { const lv = this.live.get(ek); if (lv !== undefined && lv >= this.seatedAt) continue; const pb = this.pongBy.get(ek); if (pb !== undefined && pb[0] === ev && pb[1] >= this.seatedAt) continue; }
          const x = ev, ls = this.f.fabricLinkState(this.id, x); if (ls !== LS_OPEN && ls !== LS_DIALING && this.f.fabricDialFails(this.id, x) < 1) this.f.fabricDialJoin(this.id, x);   // my own dial: its failure is the word
          if (this.l13MateGone(ek)) gone.push(ek);
        }
        for (const k of gone) { const c = unck(k); this.trace('L13-MATEGONE', this.id, c, 'was=%d fails=%d', this.occGet(k), this.f.fabricDialFails(this.id, this.occGet(k))); this.occDrop(k, 'mate-unreach'); this.live.delete(k); this.kidful.delete(k); this.s1seen.delete(k); this.tlForget(k); }
      }   // (no court memo and no admission cooling: the door's word says it left, my dial says it is not there)
      // A SILENCE-forget is NOT a free chair (2026-08-02): stamp healTry so the admission window is closed.
      for (const k of del) { this.live.delete(k); this.occDrop(k, 'drain-sweep'); this.kidful.delete(k); this.s1seen.delete(k); this.tlForget(k); this.healTry.set(k, TICK); }
      // (D5's early corpse-forget lives in tlSweep.)
    },

    // C++: mesh_seat.inc:Seat::childSweep
    childSweep() {
      const TICK = this.TICK;
      if (this.standDown()) return;   // L3.6: as rowSweep
      if (!this.hasCoord || this.state !== 3) return;   // a Section-1 owner too (mesh.js twin)
      const rc = this.rosterCells();
      // L13.29 (mass leave): my child row's listing is my child head's last ledger.
      if (this.l13('L13.29') && !this.moving) {
        const dk = ckey(rc[0]);
        if (this.occGet(dk) < 0 && !this.softSitting(dk) && !this.sitting.has(dk)) {
          const settled = this.rowLedgerAt < 0 || TICK - this.rowLedgerAt >= 60;   // (the dials go out at once; the verdict waits for the silence)
          let any = false, all = true;
          for (let j = 1; j < C; j++) {
            const k = ckey(rc[j]); const x = this.occGet(k); if (x < 0) continue; if (x === this.id || this.firstHandLive(k) || this.softSitting(k)) { all = false; continue; } any = true;
            const pb = this.pongBy.get(k); if (pb !== undefined && TICK - pb[1] < 60) { all = false; continue; }
            const ls = this.f.fabricLinkState(this.id, x); if (ls === LS_OPEN) { all = false; continue; }   // a channel up: its silence is a blip, not an absence
            if (this.f.fabricDialFails(this.id, x) < 1) { if (ls !== LS_DIALING) this.f.fabricDialJoin(this.id, x); all = false; continue; }   // my own dial first: its failure is the word
          }
          if (any && all && settled) { for (let j = 1; j < C; j++) { const k = ckey(rc[j]); if (!this.occ.has(k)) continue; this.trace('L13-CHILDGONE', this.id, rc[j], 'was=%d fails=%d', this.occGet(k), this.f.fabricDialFails(this.id, this.occGet(k))); this.occDrop(k, 'child-silent'); this.live.delete(k); this.kidful.delete(k); this.childOf.delete(k); this.tlForget(k); this.healTry.set(k, TICK); } }
        }
      }
      if (this.rowLedgerAt >= 0 && TICK - this.rowLedgerAt <= K.CHILD_LEDGER_H) return;
      for (let c = 0; c < C; c++) {
        const k = ckey(rc[c]); if (!this.occ.has(k) || this.firstHandLive(k) || this.softSitting(k)) continue;
        if (k === ckey(down(this.coord)) && this.downDig.at >= 0 && this.downDig.by === this.occGet(k) && this.LT() - this.downDig.rx <= K.LEASE_T) continue;   // L3.12.2
        const b = this.born.get(k); if (b !== undefined && this.LT() - b <= K.CHILD_LEDGER_H) continue;
        this.occDrop(k, 'child-silent'); this.live.delete(k); this.kidful.delete(k); this.childOf.delete(k); this.tlForget(k); this.healTry.set(k, TICK);
      }
    },

    // C++: mesh_seat.inc:Seat::tlSweep
    tlSweep() {
      if (this.translost.size === 0) return;
      const tl = Array.from(this.translost.keys());
      for (const k of tl) {
        if (!this.translostConfirmed(k)) continue;
        if (this.l2OwnerHold(k)) continue;   // L2.7: my owner, vouched or still being asked over E2/E3
        if (this.occ.has(k)) { this.occDrop(k, 'tlsweep'); this.live.delete(k); this.kidful.delete(k); this.s1seen.delete(k); this.healTry.delete(k); }   // freed => admissible now
      }
    },

    // C++: mesh_seat.inc:Seat::ringConfirmDead
    ringConfirmDead(h) {
      const TICK = this.TICK, hk = ckey(h);
      if (this.standDown()) return false;   // L3.6
      if (this.earShut()) return false;   // L8.48: a shut ear heard no answer, so the silence is not the mate's
      // D5 EARLY-PROBE
      if (this.translostConfirmed(hk)) return true;
      if (this.firstHandLive(hk)) { this.holeSince.delete(hk); return false; }
      this.routeTo(h, 1);   // probe across the rook
      const lb = this.liveBy.get(hk), cur = this.occGet(hk); const mine = lb === undefined || cur < 0 || lb === cur;   // a stamp for a DIFFERENT holder is no evidence about this one
      let since;
      if (this.live.has(hk) && mine) since = this.live.get(hk);
      else if (this.holeSince.has(hk)) since = this.holeSince.get(hk);
      else { this.holeSince.set(hk, TICK); since = TICK; }
      since = this.heardAny(hk, since);   // L3.4.1: an answered probe is a path the occupant was heard on
      if (since < this.seatedAt) since = this.seatedAt;   // L3.5
      if (this.backAt >= 0 && since < this.backAt) since = this.backAt;   // A RETURN IS NOT A HORIZON (LM-42)
      if (this.deafFloor >= 0 && since < this.deafFloor) since = this.deafFloor;   // L8.48: the shut spell was not observed silence
      return TICK - since > K.LEASE_T;
    },

    // C++: mesh_seat.inc:Seat::transportLost
    transportLost(pid, hard = true, sil = false) {
      if (!this.hasCoord || this.state !== 3 || pid < 0 || pid === this.id) return;
      const ol = ownedLinks(this.coord);
      for (let q = 0; q < ol.length; q++) {
        const k = ckey(ol[q]);
        if (this.occGet(k) !== pid) continue;
        if (this.translost.has(k)) { if (hard) this.tlHard.set(k, 1); continue; }   // a quiet loss that later closes hard is hard from then on
        this.translost.set(k, this.TICK); this.tlHard.set(k, hard ? (sil ? 2 : 1) : 0); this.tlProbeAt.set(k, this.TICK); this.routeToProbe(ol[q]);   // probe NOW: across the mesh, not the dead link
      }
      this.f.wake(this.id);
    },

    // C++: mesh_seat.inc:Seat::translostConfirmed
    translostConfirmed(k) {
      const TICK = this.TICK;
      const at = this.translost.get(k); if (at === undefined) return false;
      const lv = this.live.get(k), pa = this.probeAck.get(k);
      // L3.3: a frame that lands within the probe's round trip of the loss (at, at+1) was sent before it.
      const clearAt = at + 2;
      if ((lv !== undefined && lv >= clearAt) || (pa !== undefined && pa >= at)) { if (pa !== undefined && pa >= at) { const h = this.tlHard.get(k); if (h === 2) this.d5Ans.set(k, pa); } this.tlForget(k); return false; }   // D5.1: an answered silence probe floors the next window
      const pt = this.tlProbeAt.get(k);
      if (pt === undefined || TICK - pt >= 6) { this.tlProbeAt.set(k, TICK); this.routeToProbe(unck(k)); }
      // L3.3: only a HARD close confirms before the lease runs out.
      { const h = this.tlHard.get(k); if (h === undefined || !h) return false; }
      return TICK - at > K.EARLY_HOLD;
    },

    // C++: mesh_seat.inc:Seat::requeue
    requeue(why = '') {
      const TICK = this.TICK, lv = this.w.lv, id = this.id;
      this.lkAnyAt = -1; this.lkCarried = -1;   // D6c.2
      this.l13ReqN++;
      if (this.l815N > 0) { for (let i = 0; i < this.l815N; i++) { const y = newMsg('YIELD'); y.ck = this.l815Ck[i]; y.id = id; y.nc = this.l815Prev[i]; this.emit(this.l815To[i], y); } this.l815N = 0; }
      if (roomTerm(this, 1)) this.searchAt = TICK;
      this.trace('REQUEUE', id, this.hasCoord ? this.coord : null, 'why=%s', why ? why : '?');
      if (!this.evil) lv.EVICTIONS++;   // bumpEvict
      lv.MOVES++;   // bumpMoves
      this.moving = false; this.oldNbrIds.length = 0; this.holdOcc.clear(); this.holdSeen.clear(); this.holdCous.clear(); this.leaseCk = 0; this.leaseUntil = -1;
      if (this.hasCoord) {
        const ol = ownedLinks(this.coord); const seen = new Set();
        for (let k = 0; k < ol.length; k++) { const x = this.occGet(ckey(ol[k])); if (x >= 0 && x !== id && !seen.has(x)) { seen.add(x); const m = newMsg('LEAVE'); m.ck = ckey(this.coord); m.id = id; m.child = this.l1DeepKid(); if (this.l834Y >= 0) m.c7Min = this.l834Y; if (this.l40To >= 0) { m.nc = this.l40To; m.tag = 40; m.child = -1; } this.emit(x, m); } }
        const o = this.ownerCoord(); if (o) { const oid = this.occGet(ckey(o)); if (oid >= 0 && oid !== id && !seen.has(oid)) { const m = newMsg('LEAVE'); m.ck = ckey(this.coord); m.id = id; m.child = this.l1DeepKid(); if (this.l834Y >= 0) m.c7Min = this.l834Y; if (this.l40To >= 0) { m.nc = this.l40To; m.tag = 40; m.child = -1; } this.emit(oid, m); } }
      }   // V7b (H4): the owner reserves my cell in its ledger: it gets my goodbye too
      if (this.hasCoord) this.live.delete(ckey(this.coord));   // my own cell's stamp: never refreshed while I sat there
      this.f.relayUnlist(id);   // L16.4
      this.hasCoord = false; this.occ.clear(); this.ledgerSeen.clear(); this.s1seen.clear(); this.holeSince.clear(); this.byeAt.clear(); this.tlClear(); this.authClear(); this.drainAt = 0; this.join();
    },

    // C++: mesh_seat.inc:Seat::leave
    leave(reload = false) {
      const id = this.id;
      this.dead = true; if (reload) this.f.fabricReloadBye(id); else this.f.fabricLeft(id);   /* a reload closes its channels only after its goodbyes are out: the fabric schedules the close */
      this.moving = false; this.leaseCk = 0; this.leaseUntil = -1; if (!this.hasCoord) return;
      const ck = ckey(this.coord); const ol = ownedLinks(this.coord); const seen = new Set();
      const bm = newMsg('LEAVE'); bm.ck = ck; bm.id = id; bm.bye = true; bm.rel = !!reload;   // L3.11: a reload says goodbye with the reload mark
      // L1.1 (a): a Section-1 goodbye names my heir below and my ring.
      bm.child = this.l1DeepKid(); if (this.l13('L13.7')) bm.kids = this.hasChildren();   /* L13.7 */   // L1 in deep rows (L2): a deep goodbye names my down-child too
      if (this.coord.pc === 0) { bm.child = this.occGet(ckey(down(this.coord))); for (let k = 0; k < ol.length; k++) { const lk = ckey(ol[k]); const x = this.occGet(lk); if (x >= 0 && x !== id && ol[k].pc === 0) bm.nbrs.push({ k: lk, v: x }); } }
      for (let k = 0; k < ol.length; k++) { const x = this.occGet(ckey(ol[k])); if (x >= 0 && !seen.has(x)) { seen.add(x); this.emit(x, msg.clone(bm)); } }
      const o = this.ownerCoord(); if (o) { const oid = this.occGet(ckey(o)); if (oid >= 0 && !seen.has(oid)) { this.emit(oid, msg.clone(bm)); } }   // bye: a room goodbye, relayed across the section
      if (bm.child >= 0 && bm.child !== id && !seen.has(bm.child)) { seen.add(bm.child); this.emit(bm.child, msg.clone(bm)); }   // L1.1 (a): my heir below hears it first-hand
      { const ops = this.f.fabricOpenPeers(id); for (const x of ops) if (x !== id && x !== bm.child && !seen.has(x)) { let named = false; for (const [, v] of this.occ) if (v === x) { named = true; break; } if (named) continue; let mine = false; for (const [, e] of this.tenOf) if (e[0] === x) { mine = true; break; } if (!mine) for (const [, e] of this.sitting) if (e.joiner === x) { mine = true; break; } if (!mine) continue; seen.add(x); this.emit(x, msg.clone(bm)); } }   // L1.5A: a seat on an open link of mine that my view does not name yet, and that a proven frame or my own vouch seats, hears it too
    },
  });

  const api = { cellOk, coordStr };
  GifOS.meshLive = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
