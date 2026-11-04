/*
 * tick.js: the seat's tick (port plan S8), ported line for line from the 0.9.25 sim.
 *
 * C++: mesh_seat.inc, Seat::tick and its ordered steps (tickHeld, tickEntry, tickCommon, tickSection1, tickDeep,
 * healOwner, drainOrCompact), redialTick, the L2 up-edge functions (e1Down, l2OwnerHold, l3QuietLoss, headGone,
 * l2Peer, l2E2Up, l2RowE2Down, up2Tick, l2Around), drainOrReenter, l21Relay, relStake (byeRelay is in recv-seated.js). Methods are added to Seat with Seat.unit(); no fields.
 *
 * Port notes (no behaviour edits):
 *   - the PROOF_IN instrument at the top of tick() and gate() calls are sim-only and left out.
 *   - tick's CurGuard (RAII over L13CUR) and healOwner's RmVT guard (resets rmVTag / rmStrictNext at the end of
 *     the heal block) are try / finally.
 *   - a C++ bool function with an out-parameter returns the Coord (or null): ownerCoord, e2SrcOf, standbyOf,
 *     backupOwnerOf, rmWitness, l13Witness, ownerCoordOf (through FREE).
 *   - l13Top(oc) in C++ rewrites oc to the top of the gone chain and returns true; heal.js returns the Coord or null.
 *   - u2Rows is keyed ckey(row)*2 + variant flag (u2RowKey / u2RowCell, in shared.js). l2Around tests the flag
 *     (key&1) since sim cbef32d8d.
 *   - L2_TAKE_N / MAX / SUM are the module counters of the C++ `up2stat` report.
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
  const sm = req('./seat.js', 'meshSeat');
  const { Seat, FREE, roomTerm, l165Earlier } = sm;

  const K = C_.consts, E = C_.enums;
  const { ckey, unckey, ownedLinks, colMates, rowMates, down, parentPath, cc } = topo;
  const { eraseFirst } = req('./util.js', 'meshUtil');
  const C = topo.C, MAXLINKS = topo.MAXLINKS;
  const { LS_OPEN, LS_DIALING, LS_CLOSED, LS_NONE } = E;
  const unck = unckey;
  const newMsg = (t) => msg.newMsg(t);
  const kvs = (a) => a.map((e) => ({ k: e.k, v: e.v }));   // a vector<KV> copy
  const cell = (pc, r, i) => ({ pc, r, i });

  // C++: mesh.cpp:coordStr
  function coordStr(c) {
    const d = []; let pc = c.pc >>> 0;
    while (pc) { d.push(((pc - 1) >>> 0) % 6); pc = Math.floor(((pc - 1) >>> 0) / 6); }
    let p = ''; for (let a = d.length - 1; a >= 0; a--) p += String(d[a]);
    return p + '/' + c.r + '.' + c.i;
  }

  const { u2RowKey, u2RowCell, u2RowTag3 } = req('./shared.js', 'meshShared');   // the u2Rows key flag (shared.js)

  // C++: mesh_seat.inc:L2_TAKE_N
  // heir takeover (E1 judged down -> E2 hot), every UP2-HOT; reported by `up2stat`
  const L2 = { TAKE_N: 0, TAKE_MAX: 0, TAKE_SUM: 0 };

  // C++: mesh_seat.inc:inSubtree
  function inSubtree(row, t) { if (t.r !== row.r) return false; let pc = t.pc >>> 0; for (let g = 0; g < 32; g++) { if (pc === row.pc) return true; if (pc === 0) return false; pc = parentPath(pc); } return false; }

  Seat.unit('tick (mesh_seat.inc tick and up edges)', {
    // C++: mesh_seat.inc:Seat::redialTick
    redialTick() {
      if (!this.hasCoord || this.state !== 3) return;
      const TICK = this.TICK, id = this.id;
      const ol = ownedLinks(this.coord); const n = ol.length;
      for (let q = 0; q < n; q++) {
        const x = this.occGet(ckey(ol[q])); if (x < 0 || x === id) continue;
        const ls = this.f.fabricLinkState(id, x);
        if (ls === LS_OPEN) { if (this.redial.size) this.redial.delete(x); continue; }
        if (ls === LS_DIALING) continue;
        let it = this.redial.get(x); if (it === undefined) { it = [TICK, K.REDIAL_GAP]; this.redial.set(x, it); }
        if (TICK < it[0]) continue;
        this.trace('REDIAL', id, ol[q], 'peer=%d gap=%d', x, it[1]);
        this.f.fabricDial(id, x); it[0] = TICK + it[1]; it[1] = Math.min(it[1] * 2, K.REDIAL_MAX);
      }
      if (this.dials.heldN() > 64) { const nm = new Set(); for (const v of this.occ.values()) nm.add(v); this.dials.sweepHeld(TICK, (x) => nm.has(x)); }   // L17: a seat nobody in my view names is one I have no reason to dial; its mark goes
      if (this.redial.size > MAXLINKS) { for (const x of Array.from(this.redial.keys())) { let named = false; for (let q = 0; q < n && !named; q++) if (this.occGet(ckey(ol[q])) === x) named = true; if (!named) this.redial.delete(x); } }   // forget peers I no longer name
    },

    // C++: mesh_seat.inc:Seat::tick
    tick() {
      const id = this.id; void id;
      const pw = this.w, pOwn = pw.PROOF_OWN; pw.PROOF_OWN = this;   // PROOF_IN("tick"): from here a frame my own code replays (an L4 hold) is no input
      try {
      if (this.dead) return;
      if (this.l4Out) { this.l4Tick(); return; }   // L4.3: between cells, waiting for my partner's word
      if (this.vban.size || this.rootDec.kick.length) this.kickEval(); else if (this.kHeal.length) this.kHealDue();   // L27 (inert unless a vote exists)
      if (this.kAudV.size || this.kAudC.size) this.kAuditTimeouts();
      const w = this.w, prev = w.L13CUR; w.L13CUR = this;   // C++ CurGuard
      try {
        this.l30Tick();   // L30.1: small mode, from my own state
        if (this.l31Pend.length || this.l31Done.length) this.l31PendTick();   // L31.4: my open proposals and unassented placements
        if (this.tickHeld()) return;   // held work: a held compaction probe, a refused reclaim, a hand-back
        if (this.tickEntry()) return;   // not seated: the entry steps
        if (this.tickCommon()) return;   // every seat: links, ring, leases, transit
        if (this.coord.pc === 0) this.tickSection1(); else this.tickDeep();
      } finally { w.L13CUR = prev; }
      } finally { pw.PROOF_OWN = pOwn; }
    },

    // C++: mesh_seat.inc:Seat::tickHeld
    // tick step: work I held from earlier ticks (L12.2 probe, L3.11 moved-on, L3.10 hand-back); true ends the tick
    tickHeld() {
      const TICK = this.TICK, id = this.id;
      if (this.dHoldCol >= 0) { if (TICK < this.dHoldDue) this.f.wake(id); else { const hm = msg.clone(this.dHoldMsg); this.dHoldCol = -1; if (this.state === 3 && this.hasCoord) { this.dBypass = true; this.serveCompact(hm); this.dBypass = false; } } }   // L12.2: the held probe is served now through every guard of serveCompact again
      if (this.movedOnFrom && ((this.state === 3 && this.hasCoord) || this.rcGreeter >= 0)) {   // L3.11: my reclaim was refused: the cell is not mine any more
        const oc = this.movedOnFrom - 1; this.movedOnFrom = 0;
        if (!(this.state === 3 && this.hasCoord && oc === ckey(this.coord))) {
          const o = unck(oc); const ol = ownedLinks(o); const n = ol.length; let sent = 0;
          for (let i = 0; i < n; i++) {
            const m = newMsg('LEAVE'); m.ck = oc; m.id = id;
            if (this.state === 3 && this.hasCoord) { m.mvd = ckey(this.coord); this.route(ol[i], -1, m); }
            else { m.routing = true; m.rdst = cc(ol[i]); m.rfinal = -1; m.rttl = 64; m.rvia = id; this.emit(this.rcGreeter, m); }
            sent++;
          }
          this.trace('MOVED-ON', id, this.hasCoord ? this.coord : null, 'from=%s cells=%d seated=%d', coordStr(o), sent, this.state === 3 ? 1 : 0);
        }
      }
      if (this.state !== 3 && this.rcPendAt >= 0 && this.oldCell && TICK - this.rcPendAt >= this.rcPendWait) {
        if (this.rcPendWait > K.RC_WAIT && !this.rcRound2) { this.rcPendAt = -1; this.rcRound2 = true; this.rcRound2At = TICK; this.rcPendWait = K.RC_WAIT; this.rcTries = 1; this.trace('RECLAIM-ROUND2', id, null, 'old=%s', coordStr(unck(this.oldCell - 1))); if (!this.resumeAsk()) this.join(); this.f.wake(id); return true; }   // L3.10.6
        const m = msg.clone(this.rcPend); this.rcPendAt = -1; this.oldCell = 0; this.trace('RECLAIM-TAKE', id, m.coord, 'from=%d', m.owner); this.take(m.coord, m.owner, m.nbrs, m.pp, m.ppAt, [], m.ppL); if (this.pp >= 0 && this.pp !== id) this.placer = this.pp; this.f.wake(id); return true;   // L3.10: my old cell, handed back with its neighbours; no new seat, no requeue
      }
      if (this.rcPendAt >= 0 && (!this.oldCell || this.state === 3)) this.rcPendAt = -1; else if (this.state !== 3 && this.rcPendAt >= 0) this.f.wake(id);
      if (this.state !== 3 && this.rcRound2 && this.oldCell && this.rcPendAt < 0 && TICK - this.rcRound2At > 2 * K.RC_WAIT) { this.rcRound2 = false; this.movedOnFrom = this.oldCell; this.oldCell = 0; this.rcTries = 9; this.retryAt = TICK - 21; this.f.wake(id); }   // L3.10.6: the second round brought no seat: a newcomer from here
      return false;
    },

    // C++: mesh_seat.inc:Seat::tickEntry
    // tick step: entry (a seat not yet seated: backoff, stranding, ask waves, islands, retries); true ends the tick
    tickEntry() {
      const TICK = this.TICK, id = this.id, wake = () => this.f.wake(id);
      if (this.evilDoor) { if (this.hostile && !(TICK % 2)) { this.state = 0; this.emitRelay(this.linkKey); } this.l16Evil(); wake(); return true; }   // L16 adversary
      if (this.state !== 3 && this.l16Wait()) { wake(); return true; }   // L16: backing off
      if (this.state !== 3) {
        if (this.stranded) { if (TICK - this.strandedAt > K.STRAND_TTL) { this.stranded = false; this.lastReach = -1; this.joinStart = -1; this.join(); } wake(); return true; }   // R6
        if (this.l16WaveTick()) { wake(); return true; }   // L16: a silent ask wave: everyone left
        if (this.entCheck()) { this.islandAsk(this.lastGreeters); wake(); return true; }   // L8.47
        if (this.islandTick()) { wake(); return true; }   // L8.1: nobody at the door answered
        if (this.reAsk || this.reJoin) {
          const a = this.reAsk; this.reAsk = false; this.reJoin = false;   // ENTRY PACING
          if (a && this.haveRoster && this.roster.length) { const t = this.pickRoster(); if (t >= 0) { this.askSeat(t); wake(); return true; } }
          this.join(); wake(); return true;
        }
        if ((this.state === 0 || this.state === 1) && TICK - this.retryAt > 20) { if (this.rcPendAt >= 0 && this.oldCell) { this.retryAt = TICK; } /* L3.10.6 */ else if (this.l45Lone() || !this.resumeAsk()) this.join(); }
        else if (this.state === 2) {
          if (TICK - this.retryAt > (this.findAckAt < 0 ? K.FIND_ACK_WAIT : this.l44AckWait()) || this.l44LinkLost()) {
            this.l381Lost();   /* L38.1 */
            if (this.l32RosterStale() && this.resumeAsk()) { wake(); return true; }   /* L32.1 */
            if (this.f.fabricDoors() && this.lastAsked >= 0 && this.haveRoster && this.f.fabricLinkState(id, this.lastAsked) === LS_CLOSED) { for (let q = 0; q < this.roster.length;) { if (this.roster[q].v === this.lastAsked) this.roster.splice(q, 1); else q++; } this.trace('ROSTER-DROP', id, null, 'seat=%d why=dial-failed', this.lastAsked); }   // L16.4
            if (this.haveRoster && this.roster.length && ++this.seatTries <= 6) { const t = this.pickRoster(); if (t >= 0) this.askSeat(t); else if (!this.resumeAsk()) this.join(); } else { this.seatTries = 0; if (!this.resumeAsk()) this.join(); }
          }
        }
        wake(); return true;   // ENTRY RESUME
      }
      return false;
    },

    // C++: mesh_seat.inc:Seat::tickCommon
    // tick step: every seat (attacker hooks, witnesses, redial, ring notes, dark/islanded checks, transit, leases); true ends the tick
    tickCommon() {
      const TICK = this.TICK, id = this.id, lv = this.w.lv;
      if (this.evil) this.attack();
      if (this.hostile) this.hostileTick();   // the hostile page
      if (this.l40Hold) this.l40Tick();   // L40.1: a tell that came while a question was open (gaps4.js)
      if (this.l25WitPend) this.l25WitTick();   // L25.9: a proven rival, witnesses still due
      if (this.l815N > 0) {
        let w = 0;
        for (let i = 0; i < this.l815N; i++) {
          if (TICK - this.l815At[i] < 3) { this.l815At[w] = this.l815At[i]; this.l815Ck[w] = this.l815Ck[i]; this.l815To[w] = this.l815To[i]; this.l815Prev[w] = this.l815Prev[i]; w++; continue; }
          const send = roomTerm(this, 1) && this.occGet(this.l815Ck[i]) === this.l815Prev[i] && this.l815Prev[i] >= 0 && this.heldRightNow(this.l815Ck[i]) && this.holdsCell(this.l815Ck[i], 60);
          if (send) { const y = newMsg('YIELD'); y.ck = this.l815Ck[i]; y.id = id; y.nc = this.l815Prev[i]; this.emit(this.l815To[i], y); }
        }
        this.l815N = w;
      }   // L8.15: the held arrival yield
      this.redialTick();   // L3.8: dial back an owned link my transport lost
      this.serveHeld();    // L7.5: the seekers I hold, served again
      this.l827Note();       // L8.27: my ring's name over time
      this.cutNote();   // L8.46
      this.islandNotMine();   // L8.4
      this.islandForkLive();  // L8.7
      if (roomTerm(this, 1) && TICK - this.seatedAt === 81) this.islandFork(this.lastGreeters);   // L8.3
      if (lv.LG_ON) this.lgTick();   // L29: my load ladder
      if (this.retireDead()) { this.f.wake(id); return true; }   // one owned link lost its channel; the higher id vacates
      if (this.orphanSeat()) { let since = this.lkAnyAt; if (this.backAt > since) since = this.backAt; if (this.greetersAt > since + K.DARK_LEAVE && TICK - this.greetersAt >= 16) { this.requeue('D6c-orphan'); this.f.wake(id); return true; } if (TICK - this.cutAskAt >= 24) { this.cutAskAt = TICK; this.emitRelay(this.genKey); } }   // D6c
      if (this.darkSeat() && !this.d6Lease()) { this.dark6++; this.d6Mark = true; this.requeue('D6-dark'); this.f.wake(id); return true; }   // D6
      if (this.islanded() && TICK - this.islandSince() > K.LEASE_T && !(this.l13('L13.6') && this.l13Mass() && TICK - this.l13CrashAt <= 64)) { this.trace('ISLAND-OUT', id, this.coord, 'since=%lld', this.islandSince()); this.requeue('L3-island'); this.f.wake(id); return true; }   // L3.6b
      // T: transit bookkeeping: a claim window that closes with NO contradiction CONFIRMS; the tombstone self-expires (T3).
      if (this.rcHanded.size) {
        for (const [key, val] of Array.from(this.rcHanded)) {
          if (TICK - val[1] > K.RC_WAIT) { this.rcHanded.delete(key); continue; }
          if (!this.moving && this.hasCoord && key === ckey(this.coord) && this.leaseUntil >= 0 && TICK <= this.leaseUntil && TICK >= this.leaseUntil - K.LEASE_TTL + K.RC_LAND && this.leaseCk && this.leaseCk !== key) { this.rcBeside(val[0], key, this.leaseCk); this.rcHanded.delete(key); continue; }
        }
      }   // L3.10.4
      if (this.moving && TICK - this.moveAt > K.CONFIRM_TTL && this.gaWindow()) { /* L41.2 (gapa.js) */ }
      else if (this.moving && TICK - this.moveAt > K.CONFIRM_TTL) { if (this.rmNeedWit) { this.rbWhy = 'nowit-window'; this.rollbackMove(); } else this.confirmMove(); }   // L11
      if (this.leaseUntil >= 0 && TICK > this.leaseUntil) { this.leaseCk = 0; this.leaseUntil = -1; }
      this.recheckSitting();   // A: assigner frees soft sitting-down if PLACE never confirmed
      return false;
    },

    // C++: mesh_seat.inc:Seat::tickSection1
    // tick steps of a Section-1 seat (this.coord.pc==0)
    tickSection1() {
      const TICK = this.TICK, id = this.id;
      if (this.anyRookLive(this.backAt >= 0 ? this.backAt : -1)) { this.rookSeenAt = TICK; this.rookEver = true; }   // fragment detector
      if (this.rivalId >= 0) this.loneAsk();
      if (this.movedClaimId >= 0) {
        if (TICK - this.movedClaimAt > 60 || this.state !== 3 || !this.hasCoord) this.movedClaimId = -1;
        else {
          const mk = this.movedClaimK; const still = this.occGet(mk) === this.movedClaimId;
          if (still && !this.translost.has(mk)) this.movedClaimId = -1;
          else if (!still || this.translostConfirmed(mk)) {
            if (still) { const k2 = mk; this.occDrop(k2, 'moved-confirmed'); this.live.delete(k2); this.pongBy.delete(k2); this.kidful.delete(k2); this.s1seen.delete(k2); this.healTry.delete(k2); this.tlForget(k2); }
            this.rivalId = this.movedClaimId; this.rivalAt = TICK; const to = this.movedClaimId; this.movedClaimId = -1;
            if (TICK - this.rosterAskAt > 20) { this.rosterAskAt = TICK; const w = newMsg('WHOHOME'); w.from = id; w.ttl = 60; this.emit(to, w); const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = id; this.emit(to, h); }
            if (this.movedClaimMsg.t === 'HELLO' && this.movedClaimMsg.id === to && this.state === 3 && this.hasCoord && this.movedClaimMsg.ck === ckey(this.coord)) { this.challAt = Math.min(this.challAt, TICK - 21); const mm = msg.clone(this.movedClaimMsg); this.recv(mm); }
          }
        }
      }   // ...and the claim itself is judged now through the rival branch
      if (this.pendYBy >= 0) {
        if (TICK - this.pendYAt > K.PEND_Y) this.pendYBy = -1;
        else if (this.hasCoord && this.state === 3 && this.pendYCk === ckey(this.coord) && this.arbOk(this.pendYBy)) {
          const pyBy = this.pendYBy; this.pendYBy = -1;
          if (this.f.fabricDoors() && !this.moving && this.coord.pc === 0 && this.pendYPp >= 0 && this.pendYPpL >= 0 && this.pp >= 0 && this.ppL >= 0 && this.ppCk === ckey(this.coord) && this.pendYNc >= 0 && this.pendYNc !== id && l165Earlier(this.ppL, this.pp, id, this.pendYPpL, this.pendYPp, this.pendYNc)) { const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = id; this.emit(pyBy, h); this.trace('L16.5-STAND', id, this.coord, 'by=%d rival=%d deferred-tick', pyBy, this.pendYNc); }
          else if (this.l167Stand(this.pendYNc, this.pendYBorn)) { const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = id; this.emit(pyBy, h); this.trace('L16.7-STAND', id, this.coord, 'by=%d rival=%d deferred-tick', pyBy, this.pendYNc); }
          else if (!this.moving && this.l25Nonsense(pyBy, this.pendYNc, 'deferred-tick')) { /* L25.15 */ }
          else { if (this.moving) this.rollbackMove(); else this.requeue('T1-yield'); this.f.wake(id); return; }
        }
      }   // a YIELD held for its arbiter's verdict (L16.5: not when it names a later placement than mine)
      this.l10Early();
      if (TICK - this.lastPhone >= (this.l30Small() ? K.L30_BEAT : 8)) { this.lastPhone = TICK; this.rollup(); this.s1Heartbeat(); this.s1Sync(); this.loneGreet(); { this.l10UpSig = this.l10UpNow(); this.l10Spend(); this.l10Carried(); } }   // a regular beat due this tick carries the latest state itself
      this.tlSweep();   // D5: a confirmed corpse leaves my view early
      this.authTick();
      if (this.coord.i === 0 && ((TICK % 12) === 0 || this.translost.size)) { this.rowSweep(); this.s1Fill(); }
      this.homePull();   // L9.12
      if (this.l13('L13.8')) this.ownerPull();   // L13.8
      if ((TICK % 12) === 0) this.childSweep();   // a Section-1 owner sweeps its silent child row too
      // H2 LEFT-PACK backstop (probe-gated): when my row has NO live head, the row rebuilds itself leftward.
      if (this.coord.i >= 1 && TICK - this.healAt > 20 && (!this.firstHandLive(ckey(cell(0, this.coord.r, 0))) || this.translost.has(ckey(cell(0, this.coord.r, 0))))) {
        const lft = cell(0, this.coord.r, this.coord.i - 1); const lk = ckey(lft);
        let defer = this.translost.has(lk) && this.hasDownChild(lft) && this.l375Defer(lft);   // L37.5: for the heir's window only (gaps.js). The early path defers to VERTICAL whenever the cell has a down-child
        if (defer && this.islandHeirGone(lk, lft)) defer = false;   // L8.4
        if (defer && this.l3QuietLoss(lk)) { if (this.occ.has(lk) && this.ringConfirmDead(lft)) { this.occDrop(lk, 'ring-dead-left'); this.live.delete(lk); this.s1seen.delete(lk); this.kidful.delete(lk); this.holeSince.delete(lk); } }   // L3.13
        if (!defer && this.ringConfirmDead(lft)) { if (this.occ.has(lk)) { this.occDrop(lk, 'ring-dead-left'); this.live.delete(lk); this.s1seen.delete(lk); this.kidful.delete(lk); } this.holeSince.delete(lk); this.heal(lft); }
        if (this.coord.i >= 2) {
          const hc = cell(0, this.coord.r, 0); const hk = ckey(hc); let skipWait = this.darkMate(ckey(cell(0, this.coord.r, 1)));
          for (let j = 2; j < this.coord.i && skipWait; j++) { const jk = ckey(cell(0, this.coord.r, j)); if (this.occGet(jk) >= 0 && !this.darkMate(jk)) skipWait = false; }
          const leftLive = this.firstHandLive(lk);
          if (this.occGet(hk) < 0 && (leftLive || skipWait) && this.occGet(ckey(down(hc))) < 0) {
            const tl = this.translost.get(hk); const lost = leftLive && tl !== undefined && TICK - tl > K.EARLY_HOLD + K.HEAD_HEIR_WAIT && this.translostConfirmed(hk);
            const by = this.byeAt.get(hk); const bye = by !== undefined && TICK - by > (skipWait ? 0 : K.HEAD_HEIR_WAIT) && this.oneRowRoom();
            if (lost || bye) this.heal(hc);
          }
        }
      }   // ...and the HEAD cell when I hold the first-hand proof of its death and my left is alive
      this.rmRetry();   // L11: a home hole that waited for a witness
      if (TICK >= this.xlinkAt) { this.xlinkAt = TICK + 150 + Math.trunc(this.rng() * 100); const cm = colMates(this.coord); for (let q = 0; q < C - 1; q++) if (this.occGet(ckey(cm[q])) < 0) this.routeTo(cm[q], 1); }   // W7: keep column links live
      if (this.s1CheckAt < 0) this.s1CheckAt = TICK + K.E3_PERIOD + Math.trunc(this.rng() * K.E3_PERIOD);
      if (TICK >= this.s1CheckAt) { this.s1CheckAt = TICK + K.E3_PERIOD + Math.trunc(this.rng() * K.E3_PERIOD); this.emitRelay(this.genKey); }   // E3: re-knock each ~E3_PERIOD
      this.f.wake(id); return;
    },

    // C++: mesh_seat.inc:Seat::tickDeep
    // tick steps of a deep seat (this.coord.pc!=0)
    tickDeep() {
      const TICK = this.TICK, id = this.id, lv = this.w.lv;
      { if (!this.hasCoord || this.state !== 3) this.l917Ck = 0; else if (ckey(this.coord) !== this.l917Ck) { this.l917Ck = ckey(this.coord); this.l917At = TICK; } }   // L9.17
      this.l4Tick();    // L4.3: a tier swap of my row
      this.up2Tick();   // L2: judge E1, hold E2
      this.l10Early();
      if (TICK - this.lastPhone >= 8) { this.lastPhone = TICK; this.rollup(); this.phoneHome(); { this.l10UpSig = this.l10UpNow(); this.l10Spend(); this.l10Carried(); } }   // § G
      this.tlSweep();   // D5
      this.authTick();
      if (this.coord.i === 0 && (TICK % 12) === 0) this.rowSweep();
      if ((TICK % 12) === 0) this.childSweep();
      // 11a HORIZONTAL: only a CHILDLESS head needs a horizontal healer; its fixed healer is {pc,r,1}.
      if (this.coord.i === 1 && TICK - this.healAt > 20 && !((this.byeAt.has(ckey(cell(this.coord.pc, this.coord.r, 0))) || this.translostConfirmed(ckey(cell(this.coord.pc, this.coord.r, 0)))))) {
        const hd = cell(this.coord.pc, this.coord.r, 0); const hdk = ckey(hd);   // L1.3
        const hdEarly = this.translostConfirmed(hdk);
        const seatFree = this.byeAt.has(hdk) || TICK - this.headAckAt > K.LEASE_T;   // L2.7 / L3
        if (seatFree && (hdEarly || (TICK - this.lastAck > 60 && this.occGet(hdk) < 0)) && !this.hasDownChild(hd)) {
          if (hdEarly) { this.occDrop(hdk, 'head-early'); this.live.delete(hdk); this.s1seen.delete(hdk); this.kidful.delete(hdk); }
          this.heal(hd);
        }
      }
      this.rmRetry();   // L11: a hole that waited for a witness
      this.tryHeadFill();   // L9.3
      if (this.l13('L13.8')) this.ownerPull();   // L13.8
      if (this.l13('L13.7')) this.rowPull();   // L13.7
      if (this.l13('L13.20') && this.hasCoord && this.state === 3 && !this.moving && this.coord.pc !== 0) {
        let a = null; if (this.coord.i !== 0) a = cell(this.coord.pc, this.coord.r, 0); else a = this.ownerCoord();   /* L13.20 */
        if (a && (a.pc !== 0 || this.l13Mass())) {
          const ak = ckey(a); const x = this.occGet(ak);
          if (x >= 0 && x !== id && !this.firstHandLive(ak)) {
            let crashed = false; for (let q = 0; q < this.l13DownAt.length && q < this.l13DownCrash.length; q++) if (this.l13DownPeer[q] === x && this.l13DownCrash[q] && TICK - this.l13DownAt[q] <= K.LEASE_T) crashed = true;
            if (crashed) { this.trace('L13-ANCHOR-CRASH', id, a, 'was=%d', x); this.occDrop(ak, 'crash-close'); this.live.delete(ak); this.s1seen.delete(ak); this.kidful.delete(ak); this.byeAt.set(ak, TICK); this.l13AnchorCrashAt = TICK; }
          }
        }
      }
      if (this.l13On()) this.l14Uplink();   // L14
      if (this.l13('L13.18')) this.l13Condemn();   // L13.18
      if (this.l13On()) this.l13Meet();   // L13.1
      if (this.coord.pc !== 0 && !this.moving && TICK - this.seatedAt >= K.L9_LONE && TICK - this.l9LoneAt >= 2 * K.L9_LONE) {   // L9.9
        let anc = null; if (this.coord.i !== 0) anc = cell(this.coord.pc, this.coord.r, 0); else anc = this.ownerCoord();
        if (anc) {
          const ak = ckey(anc); const ob = this.byeAt.get(ak);
          if ((this.occGet(ak) < 0 || TICK - this.lastAck >= K.L9_LONE) && !this.softSitting(ak) && !(ob !== undefined && TICK - ob <= K.LEASE_T) && !this.translost.has(ak)) {
            const gs = []; for (const g of this.lastGreeters) if (g >= 0 && g !== id) gs.push(g); for (const e of this.roster) if (e.v >= 0 && e.v !== id && !gs.includes(e.v)) gs.push(e.v);
            if (gs.length) this.l9LoneAt = TICK;
            if (this.coord.i === 0 && anc.pc === 0) this.rosterAskAt = TICK;
            for (let f = 0; f < 3 && gs.length; f++) {
              const gi = Math.trunc(this.rng() * gs.length); const g = gs[gi]; gs.splice(gi, 1); this.f.fabricDial(id, g); this.f.l915Note(id, g);
              if (this.coord.i === 0 && anc.pc === 0) { const w = newMsg('WHOHOME'); w.from = id; w.ttl = 60; this.emit(g, w); this.trace('LONE-ASK', id, anc, 'to=%d ring=1', g); continue; }
              const pn = this.probeNote(ak); const r = newMsg('ROUTE'); r.target = cc(anc); r.asker = id; r.tag = 1; r.ttl = 60; r.via = id; r.pseq = ++lv.RSEQ; r.pn = pn; r.ck = ckey(this.coord); r.nc = g; this.emit(g, r); this.trace('LONE-ASK', id, anc, 'to=%d', g);
            }
          }
        }
      }
      if (this.drainAt && TICK >= this.drainAt) { this.reseatViaRoster(); return; }
      const didHeal = this.healOwner();   // 11a VERTICAL: a head heals its dead owner cell from its subtree
      if (!this.hasCoord) return;   // L47: it knocked again
      this.drainOrCompact(didHeal);
    },

    // C++: mesh_seat.inc:Seat::healOwner
    // tick step (deep head): 11a VERTICAL heal of my owner cell; true when it healed this tick
    healOwner() {
      const TICK = this.TICK, id = this.id;
      let didHeal = false;
      if (this.coord.i === 0 && TICK - this.healAt > (this.l13('L13.4') ? 8 : 20)) {
        let oc = this.ownerCoord(); const haveOc = !!oc;
        if (haveOc) { const t = this.l13Top(); if (t) oc = t; }   // L13.4: the top of a gone chain first
        const ok = haveOc ? ckey(oc) : 0;
        const confirm = (haveOc && oc.pc === 0) ? K.LEASE_T : 60;
        let ownEarly = haveOc && this.translostConfirmed(ok);
        if (ownEarly && this.l2OwnerHold(ok)) ownEarly = false;
        // L47: never blind on a D5 verdict. A head with no live link but the dead one (or that knows no Section-1 seat but its owner) probed over no path: its verdict says the pair died, not the owner. Healed anyway, a live owner's cell gets a tenant that reaches nobody and stays (a second home ring, a stage feed shipped into it). Knock again, as D6 does.
        if (ownEarly && oc.pc === 0 && !this.ownPathUp(ok)) { this.requeue('L47-blind'); this.f.wake(id); return false; }
        if (!ownEarly && haveOc && this.ownDeadCk === ok && (this.ownDeadId >= 0 || (this.occGet(ok) < 0)) && (this.occGet(ok) < 0 || this.occGet(ok) === this.ownDeadId) && TICK - this.ownDeadAt <= 2 * 8 + K.EARLY_HOLD && TICK - this.ownVouchAt > 2 * 8 + K.EARLY_HOLD) {   /* L1.4 */
          ownEarly = true; if (this.l2DeathTr !== this.ownDeadAt) { this.l2DeathTr = this.ownDeadAt; this.trace('L2-DEATH', id, oc, 'via=e2'); }
        }   // L2.9
        if (haveOc && !ownEarly && this.occGet(ok) < 0) { const by = this.byeAt.get(ok); if (by !== undefined && TICK - by <= K.LEASE_T) ownEarly = true; }   // L1.1 (a)
        let canAsk = false; for (const g of this.lastGreeters) if (g >= 0 && g !== id) { canAsk = true; break; }
        // L1.5 (I10): CUT OFF. Ask a greeter from my door list (a knock first when the list is empty); no dial.
        if (haveOc && oc.pc === 0 && this.occGet(ok) < 0 && !this.byeAt.has(ok) && !this.translost.has(ok) && TICK - this.seatedAt >= 8 && !(TICK - this.ownDeadAt <= 2 * 8 + K.EARLY_HOLD) && TICK - this.cutAskAt >= 24) {
          this.cutAskAt = TICK; const gs = []; for (const g of this.lastGreeters) if (g >= 0 && g !== id) gs.push(g);
          if (!gs.length) { this.emitRelay(this.genKey); this.trace('CUT-KNOCK', id, oc, '-'); }
          else { const g = gs[Math.trunc(this.rng() * gs.length)]; this.rosterAskAt = TICK; this.trace('CUT-ASK', id, oc, 'to=%d', g); const w = newMsg('WHOHOME'); w.from = id; w.ttl = 60; this.emit(g, w); }
        }
        if (haveOc && oc.pc === 0 && ((ownEarly && canAsk) || (!ownEarly && this.occGet(ok) < 0 && TICK - this.lastAck > confirm)) && !this.knowsRing(ok)) {
          if (TICK - this.rosterAskAt > 40 && this.lastGreeters.length) { const gs = []; for (const g of this.lastGreeters) if (g >= 0 && g !== id) gs.push(g); if (gs.length) { this.rosterAskAt = TICK; const w = newMsg('WHOHOME'); w.from = id; w.ttl = 60; this.emit(gs[Math.trunc(this.rng() * gs.length)], w); } }
          this.healAt = TICK;
        } else if (haveOc && (ownEarly || (this.occGet(ok) < 0 && TICK - this.lastAck > confirm && !(!this.byeAt.has(ok) && TICK - this.ownVouchAt <= 2 * 8 + K.EARLY_HOLD))) && TICK - (this.healTry.has(ok) ? this.healTry.get(ok) : -999) > 45 && !(this.l13('L13.4') && this.l13HeldAt.has(ok) && TICK - this.l13HeldAt.get(ok) <= 32)) {   /* L13.4 */   // L2.8
          if (ownEarly) { this.occDrop(ok, 'owner-early'); this.live.delete(ok); this.s1seen.delete(ok); this.kidful.delete(ok); }
          this.healTry.set(ok, TICK); this.healOnly.add(ok); this.healAt = TICK; didHeal = true;
          const nb = []; for (const [ck, cv] of this.cousins) nb.push({ k: ck, v: cv });
          if (!nb.length) { const ol2 = ownedLinks(oc); for (let q2 = 0; q2 < ol2.length; q2++) { const x2 = this.occGet(ckey(ol2[q2])); if (x2 >= 0 && x2 !== id) nb.push({ k: ckey(ol2[q2]), v: x2 }); } }
          { let has = false; for (const x of nb) if (x.k === ckey(this.coord)) has = true; if (!has) nb.push({ k: ckey(this.coord), v: id }); }
          if (this.bkId >= 0 && this.bkId !== id) { let has = false; for (const x of nb) if (x.k === this.bkCk) has = true; const bc = unck(this.bkCk); if (!has && bc.pc === oc.pc && bc.r === oc.r) nb.push({ k: this.bkCk, v: this.bkId }); }
          if ((this.bkId < 0 || this.bkId === id) && this.l9BkId >= 0 && this.l9BkId !== id && TICK - this.l9BkAt <= K.LEASE_T) { let has = false; for (const x of nb) if (x.k === this.l9BkCk) has = true; const bc = unck(this.l9BkCk); if (!has && bc.pc === oc.pc && bc.r === oc.r) nb.push({ k: this.l9BkCk, v: this.l9BkId }); }   // L9.3 / L2 / L1.1 (a)
          if (oc.i === 0) { const ooc = FREE.ownerCoordOf(oc); if (ooc) { const oo = this.occGet(ckey(ooc)); let has = false; for (const x of nb) if (x.k === ckey(ooc)) has = true; if (oo >= 0 && oo !== id && !has) nb.push({ k: ckey(ooc), v: oo }); } }   // L9.1
          const rc = this.rosterCells(); const ix = this.shufCols();
          let sent = false;
          try {   // C++ RmVT guard: rmVTag and rmStrictNext are reset when this block ends
            {
              let w = this.rmWitness(oc, -1); let wOk = !!w;
              if (!wOk && !this.l13('L13.1')) { const sf = this.rmStrictFail.get(ok); if (sf === undefined || TICK - sf > K.LEASE_T) { this.rmVertical = true; w = this.rmWitness(oc, -1); wOk = !!w; this.rmVertical = false; if (wOk) { this.rmVTag = 11; this.rmStrictNext = true; } } }   // (L13.1: no leaf on a rook my cousins name)
              if (wOk) { this.rmVertical = true; this.rmName(oc, -1, nb); this.rmVertical = false; }
              else {
                sent = true; this.healTry.set(ok, TICK - 33);
                if (this.rmAskDue(ok)) { const gs = []; for (const g of this.lastGreeters) if (g >= 0 && g !== id) gs.push(g); if (oc.pc === 0 && gs.length) { const g = gs[Math.trunc(this.rng() * gs.length)]; this.rosterAskAt = TICK; this.f.fabricDial(id, g); this.trace('L11-RING', id, oc, 'to=%d', g); const w2 = newMsg('WHOHOME'); w2.from = id; w2.ttl = 60; this.emit(g, w2); } else this.rmAsk(oc); }
              }
            }   // L11: the leaf gets a witness of the hole I hear first-hand; none, no leaf: I ask the hole's witness cells by cell
            // L1.3 (I10): the nearest leaf first: the trailing childless mate of MY row. One hop over a link I hold.
            for (let j = C - 1; j > 0 && !sent; j--) {
              const mc = cell(this.coord.pc, this.coord.r, j); const k = ckey(mc); const x = this.occGet(k); if (x < 0 || x === id || this.translost.has(k) || this.hasDownChild(mc)) continue;
              if (!this.firstHandLive(k)) continue;   // a mate I do not hear is not a leaf
              const m = this.findLeafMsg(oc, nb, 40); this.emit(x, m); sent = true; this.trace('LEAF-MATE', id, oc, 'leaf=%d', x);
            }   // L9.2 asks that mate the way L1 does (ttl 40)
            if (!sent && this.hasChildren()) {   // L9.2 (P): I hold a child row, so I never move myself
              for (const q of ix) { const k = ckey(rc[q]); const x = this.occGet(k); if (x >= 0 && x !== id && this.firstHandLive(k) && !this.translost.has(k)) { const m = this.findLeafMsg(oc, nb, 40); this.emit(x, m); sent = true; break; } }
              for (let j = C - 1; j >= 0 && !sent; j--) { const k = ckey(rc[j]); const x = this.occGet(k); if (x >= 0 && x !== id && !this.translost.has(k)) { const m = this.findLeafMsg(oc, nb, (j === 0) ? 40 : 0); this.emit(x, m); sent = true; } }
              if (!sent) sent = true;
            }   // (nobody to ask: the heal retries; my own move would orphan my child row)
            for (const q of ix) { if (sent) break; const x = this.occGet(ckey(rc[q])); if (x >= 0 && x !== id) { if ((!this.firstHandLive(ckey(rc[q])) || this.translost.has(ckey(rc[q])))) continue; const m = this.findLeafMsg(oc, nb, 40); this.emit(x, m); sent = true; break; } }   // L9.2
            if (!sent) { for (let pass = 0; pass < 2 && !sent; pass++) for (let j = C - 1; j > 0 && !sent; j--) { const k = ckey(cell(this.coord.pc, this.coord.r, j)); const x = this.occGet(k); if (x >= 0 && x !== id && this.firstHandLive(k) && !(pass === 0 && this.l13('L13.7') && this.l13Fresh(k))) { const m = this.findLeafMsg(oc, nb, 40); this.emit(x, m); sent = true; } } }   // L13.7
            // L1.1 (P): a childless head with live mates is still its row's head; the trailing mate is the leaf
            if (!sent && this.l13('L13.4')) {
              const w = FREE.l13Witness(oc); let known = true;
              if (w) { const wk = ckey(w); const wx = this.occGet(wk); const wb = this.byeAt.get(wk); const em = this.l13EmptyAt.get(wk); const wGone = wb !== undefined && TICK - wb <= K.LEASE_T && wx < 0; const wFresh = em !== undefined && TICK - em <= 16; known = (wx >= 0 && this.firstHandLive(wk)) || (wGone && (wFresh || oc.i === 0 || TICK - wb >= 24)); }
              const ob = this.byeAt.get(ok); if (!known && ob !== undefined && TICK - ob < 24) { sent = true; this.healTry.set(ok, TICK - 33); }
            }   // L13.4
            if (!sent && this.l13('L13.5') && oc.i !== 0 && !this.hasChildren()) {
              const rc0 = cell(oc.pc, oc.r, 0); const rk = ckey(rc0); const rb = this.byeAt.get(rk); const ch = this.childOf.get(rk); const em = this.l13EmptyAt.get(rk);
              const rowGone = this.occGet(rk) < 0 && rb !== undefined && TICK - rb <= K.LEASE_T && (ch === undefined || ch < 0) && em !== undefined && TICK - em <= 16;
              if (rowGone) {
                let first = true; for (let j = 1; j < oc.i; j++) if (this.occGet(ckey(cell(oc.pc, oc.r, j))) >= 0) first = false;
                if (first) {
                  const nb2 = []; const ol2 = ownedLinks(rc0); for (let q2 = 0; q2 < ol2.length; q2++) { const k2 = ckey(ol2[q2]); let x2 = this.occGet(k2); if (x2 < 0) { const cz = this.cousins.get(k2); if (cz !== undefined) x2 = cz; } if (x2 >= 0 && x2 !== id) nb2.push({ k: k2, v: x2 }); }
                  const oo = FREE.ownerCoordOf(rc0); if (oo) { const o2 = this.occGet(ckey(oo)); if (o2 >= 0 && o2 !== id) nb2.push({ k: ckey(oo), v: o2 }); }
                  if (this.rmName(rc0, -1, nb2)) { this.mvWhy = 'top'; this.promoteInto(rc0, nb2); sent = true; this.trace('L13-HEADCELL', id, rc0, 'for=%s', coordStr(oc)); }
                }
              }
            }   // L13.5
            if (!sent) { this.mvWhy = 'vert'; this.promoteInto(oc, nb); }   // I'm childless => I AM the leaf
            if (this.l13('L13.4')) this.l13SentAt.set(ok, TICK);   // L13.4
          } finally { this.rmVTag = 0; this.rmStrictNext = false; }
        }
      }
      return didHeal;
    },

    // A FINDLEAF frame as healOwner builds it: m.hole=oc; m.nbrs=nb; m.ttl=ttl (the Msg copies both).
    // C++: mesh_seat.inc:Seat::healOwner (the repeated Msg m;m.t=FINDLEAF;m.hole=oc;m.nbrs=nb;m.ttl=...)
    findLeafMsg(oc, nb, ttl) { const m = newMsg('FINDLEAF'); m.hole = cc(oc); m.nbrs = kvs(nb); m.ttl = ttl; return m; },

    // C++: mesh_seat.inc:Seat::drainOrCompact
    // tick step (deep seat): drain when my anchor is confirmed dead, else pack the tree upward
    drainOrCompact(didHeal) {
      const TICK = this.TICK, id = this.id;
      let ancDead = false, l13Quiet = false;
      if (this.hasCoord) {
        let anc = null; if (this.coord.i !== 0) anc = cell(this.coord.pc, this.coord.r, 0); else anc = this.ownerCoord();
        if (anc) {
          const ax = this.occGet(ckey(anc)); ancDead = ax < 0; if (ax >= 0) this.l13AnchorLast = ax;
          if (this.l13('L13.6') && ancDead && this.l13AnchorLast >= 0 && anc.pc === 0) { const ls = this.f.fabricLinkState(id, this.l13AnchorLast); if (ls === LS_OPEN && TICK - this.lastAck <= K.LEASE_T) l13Quiet = true; }
        }
      }   // L13.6
      let l816 = false;
      if (roomTerm(this, 1) && this.hasCoord && this.coord.pc !== 0 && this.coord.i !== 0 && this.occ.size === 1 && TICK - this.lastAck <= K.LEASE_T && ((this.u2AckAt < 0) || (this.u2AckAt >= 0))) {
        let loneNamed = 0; const oln = ownedLinks(this.coord); for (let qi = 0; qi < oln.length; qi++) { const x = this.occGet(ckey(oln[qi])); if (x >= 0 && x !== id) loneNamed++; }
        if (loneNamed === 0) { const hk = ckey(cell(this.coord.pc, this.coord.r, 0)); const tl = this.translost.get(hk); if (this.occGet(hk) < 0 && tl !== undefined && (this.lastAck - tl) > K.LEASE_T && !this.translostConfirmed(hk)) l816 = true; }
      }   // L8.16 / L8.17
      let upAt = this.lastAck; if (this.u2UpAt > upAt && !l816) upAt = Math.min(this.u2UpAt, this.lastAck + K.LEASE_T);   // L2.7
      let ringWait = false;
      if (this.coord.i === 0 && this.hasCoord) {
        const oc5 = this.ownerCoord();
        if (oc5 && oc5.pc === 0) {
          const ok5 = ckey(oc5); const hz5 = 220 + 2 * (2 * 8 + K.EARLY_HOLD);
          if (!ancDead && this.occGet(ok5) >= 0 && this.l3QuietLoss(ok5) && TICK - upAt <= hz5) { ringWait = true; this.l3WaitAt = TICK; this.l3WaitCk = ok5; }   // L3.13
          else if (this.l3WaitCk === ok5 && TICK - this.l3WaitAt <= 45) { const ht = this.healTry.get(ok5); if (ht !== undefined && ht >= this.l3WaitAt - 1) ringWait = true; }
        }
      }
      let l13Unreach = false;
      { let anc = null; if (this.coord.i !== 0) anc = cell(this.coord.pc, this.coord.r, 0); else anc = this.ownerCoord(); if (anc) { const ak = ckey(anc); const x = this.occGet(ak); if (x >= 0 && !this.firstHandLive(ak) && this.f.fabricDialFails(id, x) >= 2 && TICK - this.seatedAt > 64 && TICK - this.l13CrashAt > K.LEASE_T) l13Unreach = true; } }   /* L13.6 */
      let l13Hold = this.l13('L13.6') && this.l13Mass() && !l13Unreach && (TICK - this.l13CrashAt <= 64 || TICK - this.l13ProgressAt <= 64 || TICK - this.l13AnchorNewAt <= 24 || TICK - this.l13HomeNewsAt <= 64 || ((TICK - this.l13KnockAt <= 64 || TICK - this.rosterAskAt <= 64) && TICK - this.l13HomeNewsAt <= K.LEASE_T) || (this.l13DownAt.length > 0 && TICK - this.l13DownAt[this.l13DownAt.length - 1] <= 64) || TICK - this.l13AnswerAt <= 64);   /* L13.6 */
      if (this.l13('L13.20') && TICK - this.l13AnchorCrashAt <= 80) l13Hold = true;   // L13.20
      if (this.l13On() && this.l13('L13.6') && this.l14Up >= 0 && this.f.fabricLinkState(id, this.l14Up) === LS_OPEN && TICK - (this.l14UpFirst >= 0 ? this.l14UpFirst : this.l14UpAt) <= K.LEASE_T) l13Hold = true;   // L14
      if (!didHeal && TICK - upAt > 80 && (ancDead || TICK - upAt > 220) && !ringWait && !l13Hold && !l13Quiet) this.drainOrReenter();
      else if (!didHeal) { this.tryCompact(); }   // Q2
      this.f.wake(id);
    },

    // C++: mesh_seat.inc:Seat::drainOrReenter
    drainOrReenter() {
      const TICK = this.TICK, id = this.id, coord = this.coord;
      // E1 LAST RESORT, checked FIRST: owner-chain dead >220 ticks with no mesh route to Section 1 -> re-enter the front door.
      // L16.4: a HEAD at the E1 horizon drains its row (the DRAIN below) instead of leaving alone.
      const headRow = this.f.l164Of(this) && this.hasCoord && coord.i === 0 && this.haveRoster && this.roster.length > 0;
      if (TICK - this.lastAck > 220 && !headRow) { this.haveRoster = false; this.roster.length = 0; this.drainAt = 0; this.requeue('E1-stale-roster'); return; }
      if (this.haveRoster && this.roster.length) {
        if (!this.drainAt) {
          { let anc = null; if (coord.i !== 0) anc = cell(coord.pc, coord.r, 0); else anc = this.ownerCoord(); const ha = !!anc; this.trace('DRAIN', id, coord, 'anchor=%s occ=%d ackAge=%lld', ha ? coordStr(anc) : '-', ha ? this.occGet(ckey(anc)) : -2, TICK - this.lastAck); }
          const rc = this.rosterCells(); for (let c = 0; c < C; c++) { const x = this.occGet(ckey(rc[c])); if (x >= 0 && x !== id) { const m = newMsg('DRAIN'); m.roster = kvs(this.roster); m.id = id; this.emit(x, m); } }
          if (headRow) { for (let c = 1; c < C; c++) { const x = this.occGet(ckey(cell(coord.pc, coord.r, c))); if (x >= 0 && x !== id) { const m = newMsg('DRAIN'); m.roster = kvs(this.roster); m.id = id; m.tag = 1; this.emit(x, m); } } this.trace('ROW-DRAIN', id, coord, 'ackAge=%lld', TICK - this.lastAck); }   // L16.4
          this.drainAt = TICK + 25 + Math.trunc(this.rng() * 10);
        }
        return;
      }   // id: a DRAIN is honoured only from the receiver's anchor
      if (TICK - this.rosterAskAt > 40) {
        this.rosterAskAt = TICK;
        {
          const rm = rowMates(coord); const ri = [0, 1, 2, 3]; for (let k = 3; k > 0; k--) { const j = Math.trunc(this.rng() * (k + 1)); const t = ri[k]; ri[k] = ri[j]; ri[j] = t; }
          for (const q of ri) { const rr = this.occGet(ckey(rm[q])); if (rr >= 0 && rr !== id) { const m = newMsg('WHOHOME'); m.from = id; m.via = id; m.ttl = 60; this.emit(rr, m); break; } }
        }
      }
    },

    // C++: mesh_seat.inc:Seat::l21Relay
    // L21 (join tails): the goodbye of a requeuing Section-1 seat crosses Section 1 once, rook mates only.
    l21Relay(m) {
      if (!this.hasCoord || this.state !== 3 || this.coord.pc !== 0 || !m.sig) return;
      const TICK = this.TICK, id = this.id, coord = this.coord;
      const key = 'y|' + String(m.ck) + '|' + String(m.id) + '|' + String(m.sigAt);
      if (this.byeRly.has(key)) return; this.byeRly.set(key, TICK);
      if (this.byeRly.size > 256) { for (const [k, v] of Array.from(this.byeRly)) if (TICK - v > 120) this.byeRly.delete(k); while (this.byeRly.size > 256) eraseFirst(this.byeRly); }
      const ol = ownedLinks(coord); const n = ol.length; const seen = new Set();
      for (let k = 0; k < n; k++) {
        if (ol[k].pc !== 0) continue; const x = this.occGet(ckey(ol[k])); if (x < 0 || x === id || x === m.id || x === m.from || seen.has(x)) continue; seen.add(x);
        const f = newMsg('LEAVE'); f.ck = m.ck; f.id = m.id; f.tn = m.tn; f.rl = true; f.yl = true; f.sig = m.sig; f.sigAt = m.sigAt; f.sigL = m.sigL; this.emit(x, f);
      }
    },

    // C++: mesh_seat.inc:Seat::relStake
    relStake(k) {
      if (!this.hasCoord) return false;
      const ol = ownedLinks(this.coord); for (let q = 0; q < ol.length; q++) if (ckey(ol[q]) === k) return true;
      const o = this.ownerCoord(); if (o && ckey(o) === k) return true;
      if (this.coord.i !== 0 && ckey(cell(this.coord.pc, this.coord.r, 0)) === k) return true;
      return false;
    },

    // C++: mesh_seat.inc:Seat::e1Down
    // My own E1 (head -> owner) is down in my view.
    e1Down() {
      const oc = this.ownerCoord(); if (!oc) return false; const ok = ckey(oc); const o = this.occGet(ok);
      if (o < 0 || o === this.id) return true;
      const ls = this.f.fabricLinkState(this.id, o); if (ls === LS_CLOSED || ls === LS_NONE) return true;
      if (this.translost.has(ok)) return true;
      return this.TICK - this.seatedAt > 8 + K.EARLY_HOLD && this.TICK - this.lastAck > 8 + K.EARLY_HOLD;
    },

    // C++: mesh_seat.inc:Seat::l2OwnerHold
    // L2.8: an E1 that CLOSED (a hard loss, no goodbye) is a cut until the row's second path says otherwise.
    l2OwnerHold(k) {
      const TICK = this.TICK;
      if (!this.hasCoord || this.byeAt.has(k)) return false;   // a goodbye is a leave, never a cut
      const oc = this.coord.pc !== 0 && this.coord.i === 0 ? this.ownerCoord() : null; const owner = !!oc && ckey(oc) === k;   // my E1, seen from below
      const child = ckey(down(this.coord)) === k;                                                                           // my child row's E1, seen from above
      if (!owner && !child) return false;
      if (owner && oc.pc !== 0 && TICK - this.ownVouchAt <= 2 * 8 + K.EARLY_HOLD) return true;   // a deep owner the backup owner vouches for
      if (owner && this.l2RowE2Down()) return true;   // my row's E2 is cut too
      const it = this.translost.get(k); if (it === undefined) return false;
      const h = this.tlHard.get(k); if (h === undefined || !h) return false;   // only a hard close confirms early (L3.3)
      return TICK - it <= K.EARLY_HOLD + 2 * 8;
    },

    // C++: mesh_seat.inc:Seat::l3QuietLoss
    // L3.13 (0.9.25): my own transport to k was lost QUIETLY (no hard close) and stands unanswered.
    l3QuietLoss(k) {
      if (!this.translost.has(k)) return false;
      const h = this.tlHard.get(k); return h === undefined || !h;
    },

    // C++: mesh_seat.inc:Seat::headGone
    // My head is gone in my own view.
    headGone() {
      if (!this.hasCoord || this.coord.pc === 0 || this.coord.i === 0) return false;
      const hk = ckey(cell(this.coord.pc, this.coord.r, 0)); const h = this.occGet(hk);
      return h < 0 || h === this.id || this.translost.has(hk) || this.f.fabricLinkState(this.id, h) === LS_CLOSED || (this.TICK - this.seatedAt > 8 + K.EARLY_HOLD && this.TICK - this.headAckAt > 8 + K.EARLY_HOLD);
    },

    // C++: mesh_seat.inc:Seat::l2Peer
    // x is the far end of an E2 (or variant-B E3) link I hold or serve.
    l2Peer(x) {
      if (x < 0 || !this.hasCoord) return false;
      if (x === this.u2Id || x === this.u3Id) return true;
      for (const e of this.u2Rows.values()) if (e.heir === x && this.TICK - e.at <= 40) return true;
      return false;
    },

    // C++: mesh_seat.inc:Seat::l2E2Up
    // L2.8: my E2 carries: I hold it open to the backup owner and its ack is fresh (E2 source side).
    l2E2Up() { return this.u2Id >= 0 && this.u2Id !== this.id && this.f.fabricLinkState(this.id, this.u2Id) === LS_OPEN && this.TICK - this.u2AckAt <= 2 * 8 + K.EARLY_HOLD; },

    // C++: mesh_seat.inc:Seat::l2RowE2Down
    // L2.8: my row's second up path is down in my own view (head side).
    l2RowE2Down() {
      if (!this.hasCoord || this.coord.pc === 0 || this.coord.i !== 0) return false;
      const view = (c) => ckey(c) === ckey(this.coord) || this.occGet(ckey(c)) >= 0;
      const row = cell(this.coord.pc, this.coord.r, 0); const src = roles.e2SrcOf(row, view); if (!src) return false;
      if (ckey(src) === ckey(this.coord)) return this.u2SrcAt >= 0 && !this.l2E2Up();
      const sk = ckey(src); const x = this.occGet(sk);
      if (x < 0 || this.translost.has(sk) || this.f.fabricLinkState(this.id, x) === LS_CLOSED) return true;
      const lv = this.live.get(sk); if (lv === undefined || this.TICK - lv > 8 + K.EARLY_HOLD) return true;
      return this.hdE2Dn && this.hdE2Id === x;
    },

    // C++: mesh_seat.inc:Seat::up2Tick
    up2Tick() {
      if (!this.hasCoord || this.state !== 3 || this.coord.pc === 0 || this.moving) return;
      const TICK = this.TICK, id = this.id, lv = this.w.lv;
      const view = (c) => ckey(c) === ckey(this.coord) || this.occGet(ckey(c)) >= 0;
      const row = cell(this.coord.pc, this.coord.r, 0); const src = roles.e2SrcOf(row, view); const haveSrc = !!src; const amSrc = haveSrc && ckey(src) === ckey(this.coord);
      if (this.u2Row !== ckey(row)) { this.u2Row = ckey(row); this.u2SrcAt = -1; this.u2UpAt = -1000; this.headAckAt = TICK; this.headEver = false; this.bkId = -1; this.bkCk = 0; this.sbId = -1; this.sbCk = 0; this.e1Dn = false; this.e1DnAt = -1; this.headE1Dn = false; this.headE1At = -1; this.u2Told = -1; this.hdE2Dn = false; this.hdE2Id = -1; this.e2Told = -1; if (this.u2Hot) { this.u2Hot = false; this.trace('UP2-PARK', id, this.coord, 'why=new-row'); } }   // a seat that moved starts its row's roles afresh
      if (this.coord.i === 0) {   // the head judges its own E1 and tells the E2 source at once
        const dn = this.e1Down();
        if (dn !== this.e1Dn) { this.e1Dn = dn; this.e1DnAt = TICK; if (!dn) this.hdE2Dn = false; this.trace(dn ? 'E1-DOWN' : 'E1-UP', id, this.coord, 'owner=%d', this.ownerId()); this.u2Told = -1; }
        if (haveSrc && !amSrc) { const h = this.occGet(ckey(src)); if (h >= 0 && h !== id && h !== this.u2Told) { this.u2Told = h; const m = newMsg('E1STATE'); m.id = id; m.coord = cc(this.coord); m.e1dn = this.e1Dn; m.e1At = this.e1DnAt; this.emit(h, m); } }
      }   // on every change, and to a new E2 source at once
      if (!amSrc) { if (this.u2Hot) { this.u2Hot = false; this.trace('UP2-PARK', id, this.coord, 'why=not-source'); } this.u2Id = -1; this.u3Id = -1; this.u2SrcAt = -1; return; }
      this.u2Id = this.bkId; this.u2Ck = this.bkCk; this.u3Id = this.sbId; this.u3Ck = this.sbCk;   /* variant A holds no E3 end */ if (this.u2SrcAt < 0) this.u2SrcAt = TICK;
      let dn, jat;
      if (this.coord.i === 0) { dn = this.e1Dn; jat = this.e1DnAt; }
      else {
        const gone = this.headGone();   // the head itself is gone, leased or silent: its duties pass to me
        if (gone) { dn = true; jat = TICK; } else { dn = this.headE1Dn; jat = this.headE1At; }
      }
      if (dn) {
        this.u2OkSince = -1;
        if (!this.u2Hot) {
          this.u2Hot = true; this.u2HotAt = TICK; if (jat < this.u2SrcAt) jat = this.u2SrcAt; const tk = (jat >= 0 && jat <= TICK) ? TICK - jat : 0; /* from the later of the judgment and my becoming the source */
          L2.TAKE_N++; L2.TAKE_SUM += tk; if (tk > L2.TAKE_MAX) L2.TAKE_MAX = tk;
          this.trace('UP2-HOT', id, this.coord, 'bk=%d takeover=%lld', this.u2Id, tk); this.u2BeatAt = -1000;
        }
      } else if (this.u2Hot) { if (this.u2OkSince < 0) this.u2OkSince = TICK; if (TICK - this.u2OkSince >= K.L2_PARK) { this.u2Hot = false; this.trace('UP2-PARK', id, this.coord, 'why=e1-back hot=%lld', TICK - this.u2HotAt); } }
      if (this.coord.i !== 0 && !this.headE1Dn) { this.e2Told = -1; this.e2ToldDn = false; }
      if (this.coord.i !== 0 && this.headE1Dn) {
        const h = this.occGet(ckey(row)); const e2dn = !this.l2E2Up();   // L2.8
        if (h >= 0 && h !== id && h !== this.e2Told) { this.e2Told = h; this.e2ToldDn = false; }
        if (h >= 0 && h !== id && e2dn !== this.e2ToldDn) { this.e2ToldDn = e2dn; const m = newMsg('E1STATE'); m.tag = 1; m.id = id; m.coord = cc(this.coord); m.e1dn = e2dn; m.e1At = TICK; this.emit(h, m); }
      }
      if (this.coord.i !== 0) { const oc = FREE.ownerCoordOf(this.coord); if (oc && this.ownDeadCk === ckey(oc) && TICK - this.ownDeadAt <= 2 * 8 + K.EARLY_HOLD) { const h = this.occGet(ckey(row)); if (h >= 0 && h !== id && h !== this.ownToldHd) { this.ownToldHd = h; const m = newMsg('E1STATE'); m.tag = 2; m.id = id; m.coord = cc(this.coord); m.oCk = this.ownDeadCk; m.owner = this.ownDeadId; m.ck = this.bkCk; m.nc = this.bkId; this.emit(h, m); } } }   // L9.3
      // hold E2 (and, variant B, E3 while E1 or E2 is down): a beat each 8 ticks keeps the parked pc warm and proves the edge
      if (this.u2Id >= 0 && this.u2Id !== id && TICK - this.u2BeatAt >= 8) {
        this.u2BeatAt = TICK;
        const ls = this.f.fabricLinkState(id, this.u2Id); if (ls === LS_CLOSED || ls === LS_NONE) this.f.fabricDial(id, this.u2Id);
        const m = newMsg('U2BEAT'); m.id = id; m.coord = cc(this.coord); m.e1dn = this.u2Hot; if (this.u2Hot && lv.DIGEST) m.dgUp = (this.coord.i === 0) ? this.pubDig(this.rowDig) : this.u2RowDig; this.emit(this.u2Id, m);
      }
      const e2dn = this.u2AckAt >= 0 && (TICK - this.u2AckAt > 8 + K.EARLY_HOLD || this.f.fabricLinkState(id, this.u2Id) === LS_CLOSED);   // E2 once carried and has stopped
      if (this.u3Id >= 0 && this.u3Id !== id && (this.u2Hot || e2dn) && TICK - this.u3BeatAt >= 8) {
        this.u3BeatAt = TICK;
        const ls = this.f.fabricLinkState(id, this.u3Id); if (ls === LS_CLOSED || ls === LS_NONE) this.f.fabricDial(id, this.u3Id);
        const m = newMsg('U2BEAT'); m.id = id; m.coord = cc(this.coord); m.e1dn = this.u2Hot; m.tag = 3; this.emit(this.u3Id, m);
      }
    },

    // C++: mesh_seat.inc:Seat::l2Around
    // The next hop AROUND an excluded ideal hop by E2, for a target in the subtree of a row R.
    l2Around(t, exclude, servedOnly = false) {
      if (!this.hasCoord) return -1;
      const TICK = this.TICK;
      const usable = (x) => x >= 0 && x !== this.id && x !== exclude && this.f.fabricLinkState(this.id, x) === LS_OPEN;   // a peer my own transport says is cut carries nothing
      const view = (c) => ckey(c) === ckey(this.coord) || this.occGet(ckey(c)) >= 0;
      for (const [key, e] of this.u2Rows) {
        if (e.heir < 0 || TICK - e.at > 40) continue; const row = u2RowCell(key); if (!inSubtree(row, t)) continue;   // unck(e.first>>1)
        if (usable(e.heir)) return e.heir;
        if (!(key % 2) && this.f.fabricLinkState(this.id, e.heir) === LS_CLOSED) { const sb = roles.standbyOf(row, view); if (sb) { const x = this.occGet(ckey(sb)); if (usable(x)) return x; } }
      }   // variant B: my E2 to the row is cut, the standby holds E3
      if (servedOnly) return -1;
      const crow = down(this.coord);
      if (inSubtree(crow, t)) {
        let b = roles.backupOwnerOf(crow, view);
        if (b && ckey(b) !== ckey(this.coord)) {
          let x = this.occGet(ckey(b)); if (usable(x)) return x;
          if (x >= 0 && (this.f.fabricLinkState(this.id, x) === LS_CLOSED || this.translost.has(ckey(b)))) { const b2 = roles.standbyOf(crow, view); if (b2) { b = b2; if (ckey(b) !== ckey(this.coord)) { x = this.occGet(ckey(b)); if (usable(x)) return x; } } }
        }
      }   // variant B: the backup owner's hop is cut, the standby holds E3
      return -1;
    },
  });

  const api = Object.freeze({ L2, u2RowKey, u2RowCell, u2RowTag3, inSubtree });
  GifOS.meshTick = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
