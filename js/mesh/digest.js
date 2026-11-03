/*
 * digest.js: the seat's compaction and the rollup digest, ported line for line from the 0.9.25 sim
 * (test/sim/mesh_seat.inc at gifos 37d787b2d).
 *
 *   compaction : compactDensifyCol, l12Origin/Score/Cand, l12SectionLone, l12Step, l12AdmitOnly, l12ClimbEnd,
 *                serveCompact, onStageOrTalking, l9Small, compactEligible, tryCompact
 *   digest     : pubDig, noteUp, upRefuted, scopeGap, s1Take, digForget, digForget1, digHeld, rollup, rootFold
 *   L10        : l10OwnNow, l10UpNow, l10Take, l10Digest, l10Early
 *
 * Port conventions are in seat.js. Callees that other units supply (admit, emit, phoneHome, takeUp, s1Sync,
 * l4Bad, l373Blind ...) are called as methods of the seat by their C++ name; heal's free function l1MoverCell
 * is called as FREE.l1MoverCell(seat, cell). gate() (a thread-pool fence) has no JS form. PROOF_IN is the
 * sim's proof tape, not behaviour. ADMIT_SITE (a thread_local label) is this.w.ADMIT_SITE.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const hash = req('./hash.js', 'meshHash');
  const dig = req('./dig.js', 'meshDig');
  const C_ = req('./consts.js', 'meshConsts');
  const state = req('./state.js', 'meshState');
  const books = req('./books.js', 'meshBooks');
  const { ins } = req('./util.js', 'meshUtil');
  const { Seat, FREE, signedBy } = req('./seat.js', 'meshSeat');

  const K = C_.consts, E = C_.enums;
  const { ckey, unckey, ownedLinks, down, pcDepth, parentPath, lastDigit } = topo;
  const C = topo.C;
  const { H_INIT, hmix, hmix64 } = hash;
  const { K_HAND, K_STAGE, K_APP } = dig;
  const newMsg = (t) => msg.newMsg(t);
  const cc = topo.cc;

  // ---- compaction ------------------------------------------------------------------------------------------
  // C++: mesh_seat.inc:compactDensifyCol
  function compactDensifyCol(s, j) {
    const cell = { pc: s.coord.pc, r: s.coord.r, i: j };
    if (s.occ.has(ckey(cell)) || s.softSitting(ckey(cell))) return false;   // a chair already promised (newcomer or mover) is not a slot
    if (s.occGet(ckey(down(cell))) >= 0) return false;
    if (s.l13On()) { const g = s.l13Greet.get(ckey(cell)); if (g !== undefined && !s.firstHandLive(ckey(cell)) && s.now() - s.seatedAt <= 2 * K.LEASE_T) return false; }   // L13: a mate I was told to greet and have not heard is not a free cell
    if (s.l13('L13.7') && s.l13RowBelow(ckey(cell))) return false;   // L13.7: the row under the cell heals it
    for (let k = j + 1; k < C; k++) {
      const rk = { pc: s.coord.pc, r: s.coord.r, i: k };
      if (!s.occ.has(ckey(rk))) continue;
      if (pcDepth(s.coord.pc) >= 3 || s.occGet(ckey(down(rk))) >= 0) return false;
    }
    return true;
  }
  // C++: mesh_seat.inc:l12Origin
  // returns [r0, col]
  function l12Origin(seeker) {
    let pc = seeker.pc; while (pcDepth(pc) > 1) pc = parentPath(pc);
    return [seeker.r, pc ? lastDigit(pc) : 0];
  }
  // C++: mesh_seat.inc:l12Score
  function l12Score(r, c, r0, col) {
    const rd = Math.min((r - r0 + C) % C, (r0 - r + C) % C);
    const cd = Math.min((c - col + C) % C, (col - c + C) % C);
    return (c === col ? 0 : 100) + rd * 10 + cd * 2 + r;
  }
  // C++: mesh_seat.inc:l12Cand
  // returns [rr, cc], or null
  function l12Cand(r0, col, n) {
    if (r0 < 0 || r0 >= C || col < 0 || col >= C || n < 0) return null;
    const used = []; for (let r = 0; r < 5; r++) used.push([false, false, false, false, false]);
    if (C > 5) return null;
    used[r0][col] = true;
    for (let k = 0; k <= n && k < C * C - 1; k++) {
      let br = -1, bc = -1, bs = 100000;
      for (let r = 0; r < C; r++) for (let c = 0; c < C; c++) {
        if (used[r][c]) continue;
        const s = l12Score(r, c, r0, col);
        if (br < 0 || s < bs || (s === bs && (r < br || (r === br && c < bc)))) { bs = s; br = r; bc = c; }
      }
      if (br < 0) return null;
      used[br][bc] = true;
      if (k === n) return [br, bc];
    }
    return null;
  }
  Seat.unit('mesh_seat.inc compaction', {
    // C++: mesh_seat.inc:Seat::l12SectionLone
    l12SectionLone() {
      for (const [k, v] of this.occ) {
        if (v < 0) continue;
        const c = unckey(k);
        if (c.pc === this.coord.pc && c.r !== this.coord.r) return false;
      }
      return true;
    },
    // C++: mesh_seat.inc:Seat::l12Step
    l12Step(mm) {
      const id = this.id;
      if (mm.ttl <= 1 || !this.hasCoord || this.coord.pc !== 0) return false;
      const [r0, col] = l12Origin(mm.coord);
      const sd = pcDepth(mm.coord.pc);
      for (let guard = 0; guard < C * C; guard++) {
        const cand = l12Cand(r0, col, mm.l12n);
        if (!cand) return false;
        const rr = cand[0], cc2 = cand[1];
        if (rr === this.coord.r && cc2 === this.coord.i) {
          const ch = down(this.coord);
          if (pcDepth(ch.pc) < sd) {
            const dk = ckey(ch), x = this.occGet(dk);
            if (x >= 0 && x !== id && this.firstHandLive(dk)) { const m = msg.clone(mm); m.ttl--; m.l12s = 2; this.emit(x, m); return true; }
          }
          mm.l12n = (mm.l12n + 1) & 0xff;
          continue;
        }
        const ck = ckey({ pc: 0, r: rr, i: cc2 }), x = this.occGet(ck);
        if (x >= 0 && x !== id && this.firstHandLive(ck)) { const m = msg.clone(mm); m.ttl--; m.l12s = 1; this.emit(x, m); return true; }
        mm.l12n = (mm.l12n + 1) & 0xff;
      }
      return false;
    },
    // C++: mesh_seat.inc:Seat::l12AdmitOnly
    l12AdmitOnly(mm) {
      const id = this.id, TICK = this.TICK;
      if (!this.hasCoord || this.state !== 3 || mm.ttl <= 0) return;
      if (this.coord.i !== 0) {
        const h = this.occGet(ckey({ pc: this.coord.pc, r: this.coord.r, i: 0 }));
        if (h >= 0 && h !== id && mm.ttl > 1) { const m = msg.clone(mm); m.ttl--; this.emit(h, m); }
        return;
      }
      const sd = pcDepth(mm.coord.pc), myd = pcDepth(this.coord.pc);
      if (myd >= 1 && myd < sd) {
        for (let j = 1; j < C; j++) {
          if (!compactDensifyCol(this, j)) continue;
          const cell = { pc: this.coord.pc, r: this.coord.r, i: j }, k = ckey(cell);
          if (!this.l917Free(cell)) continue;   // L9.17
          const ht = this.healTry.get(k); if (ht !== undefined && TICK - ht <= 45) continue;
          if (FREE.l1MoverCell(this, cell) !== 0) continue;   // a healer already named for this cell: not a second mover
          this.w.ADMIT_SITE = 'l12-densify'; this.admit(cell, mm); return;
        }
      }
      const o = this.ownerCoord(); if (!o || mm.ttl <= 1) return;
      const oid = this.occGet(ckey(o)); if (oid < 0 || oid === id) return;
      const m = msg.clone(mm); m.ttl--; m.l12s = 1; if (m.l12n < 255) m.l12n++; this.emit(oid, m);
    },
    // C++: mesh_seat.inc:Seat::l12ClimbEnd
    l12ClimbEnd(mm) {
      if (!mm.l12 || mm.l12s !== 0 || mm.ttl <= 1) return false;
      if (this.coord.pc !== 0) {
        const o = this.ownerCoord(); if (!o) return false;
        const oid = this.occGet(ckey(o)); if (oid < 0 || oid === this.id) return false;
        const m = msg.clone(mm); m.ttl--; m.l12s = 1; m.l12n = 0; this.emit(oid, m); return true;
      }
      mm.l12s = 1; mm.l12n = 0; return this.l12Step(mm);
    },
    // C++: mesh_seat.inc:Seat::serveCompact
    serveCompact(mm) {
      const id = this.id, TICK = this.TICK, lv = this.w.lv;
      if (!this.hasCoord || this.state !== 3 || mm.ttl <= 0) return;
      // L12.3: a held densify probe whose wait ended this tick is served before a probe that arrives in the same tick.
      if (!this.dBypass && this.dHoldCol >= 0 && TICK >= this.dHoldDue) { const hm = msg.clone(this.dHoldMsg); this.dHoldCol = -1; this.dBypass = true; this.serveCompact(hm); this.dBypass = false; }
      if (mm.l12 && mm.l12s === 2) { this.l12AdmitOnly(mm); return; }
      if (mm.l12 && mm.l12s === 1) {
        if (this.coord.pc === 0) { this.l12Step(mm); return; }
        const o = this.ownerCoord(); if (o) { const oid = this.occGet(ckey(o)); if (oid >= 0 && oid !== id && mm.ttl > 1) { const m = msg.clone(mm); m.ttl--; this.emit(oid, m); } }
        return;
      }
      const sd = pcDepth(mm.coord.pc);
      if (this.coord.pc === 0) lv.COMPACT_ATS1++;   // V5 funnel gauge: probes that reached a Section-1 seat
      // Only a ROW HEAD decides; a non-head hands the probe to its own row head.
      if (this.coord.i !== 0) { const h = this.occGet(ckey({ pc: this.coord.pc, r: this.coord.r, i: 0 })); if (h >= 0 && h !== id) { const m = msg.clone(mm); m.ttl = mm.ttl - 1; this.emit(h, m); } return; }
      // L5.1 HEAL TOWARD SECTION 1.
      let l5home = 0; if (this.coord.pc === 0) { l5home = 1; const ol = ownedLinks(this.coord); for (const o2 of ol) if (o2.pc === 0 && this.firstHandLive(ckey(o2))) l5home++; }
      if (this.coord.pc === 0 && sd > 0 && this.rootDec.at >= 0 && !this.rootDec.part && this.rootDec.n <= C * C && this.rootDec.n >= l5home) {
        if (TICK - this.l5At >= K.COMPACT_PERIOD || this.l9Small()) {
          for (let j = 1; j < C; j++) {
            const c = { pc: 0, r: this.coord.r, i: j }, k = ckey(c);
            if (this.occGet(k) >= 0 || this.sitting.has(k) || this.occGet(ckey(down(c))) >= 0 || FREE.l1MoverCell(this, c) !== 0) continue;
            { const ht = this.healTry.get(k); if (ht !== undefined && TICK - ht <= 45) continue; }
            this.l5At = TICK; this.w.ADMIT_SITE = 'l5-home'; this.admit(c, mm); return;
          }
          // A wholly empty home row has no head to seat anyone.
          {
            const c = { pc: 0, r: (this.coord.r + C - 1) % C, i: 0 }, k = ckey(c); const ht = this.healTry.get(k);
            let rowDead = true; for (let j = 0; j < C; j++) { const rk = ckey({ pc: 0, r: c.r, i: j }); if (this.s1Fresh(rk) || this.firstHandLive(rk) || this.sitting.has(rk)) { rowDead = false; break; } }
            if (rowDead && this.occGet(ckey(down(c))) < 0 && !(ht !== undefined && TICK - ht <= 45)) { this.l5At = TICK; this.w.ADMIT_SITE = 'l5-home-row'; this.admit(c, mm); return; }
          }
        }
        for (let pass = 0; pass < 2; pass++) for (let t = 1; t < C; t++) { const hk = ckey({ pc: 0, r: (this.coord.r + t) % C, i: 0 }), h = this.occGet(hk); if (h >= 0 && h !== id && (pass === 1 || this.firstHandLive(hk))) { const m = msg.clone(mm); m.ttl = mm.ttl - 1; this.emit(h, m); return; } }
        return;
      }
      // I am a row head. If my row is a DEEP row STRICTLY shallower than the seeker, offer the first densify slot.
      if (this.coord.pc !== 0 && pcDepth(this.coord.pc) < sd) {
        for (let j = 1; j < C; j++) {
          if (!compactDensifyCol(this, j)) continue;
          if (!this.l917Free({ pc: this.coord.pc, r: this.coord.r, i: j })) continue;
          if (this.l373Blind({ pc: this.coord.pc, r: this.coord.r, i: j })) continue;   // L37.3
          if (lv.TIERS_ACTIVE && this.l4Bad(E.TIER_DESKTOP, mm.nat, { pc: this.coord.pc, r: this.coord.r, i: j })) continue;   // L15.3
          // L12.2: two seekers for one slot are not served in the order their frames happen to arrive.
          if (!this.dBypass) {
            if (this.dHoldCol === j && TICK < this.dHoldDue) { if (mm.nc < this.dHoldMsg.nc) swapMsg(this.dHoldMsg, mm); continue; }
            if (this.dHoldCol < 0) { this.dHoldCol = j; this.dHoldDue = TICK + K.L12_DENS_WAIT; this.dHoldMsg = msg.clone(mm); this.f.wake(id); return; }
          }
          this.w.ADMIT_SITE = 'compact-densify'; this.admit({ pc: this.coord.pc, r: this.coord.r, i: j }, mm); return;   // densify: seat the seeker beside me, PLACE routed back (tag==1)
        }
      }
      // My row is full or not shallower than the seeker: climb one level toward the home.
      if (lv.PROBLVL > 0 && pcDepth(this.coord.pc) - 1 < sd - lv.PROBLVL) { if (this.l12ClimbEnd(mm)) return; return; }
      const o = this.ownerCoord(); if (o) { const oid = this.occGet(ckey(o)); if (oid >= 0 && oid !== id) { const m = msg.clone(mm); m.ttl = mm.ttl - 1; this.emit(oid, m); return; } }
      this.l12ClimbEnd(mm);   // L12: the chain ended with no slot
    },
    // C++: mesh_seat.inc:Seat::onStageOrTalking
    // L6.3: a stager or a talker keeps its row.
    onStageOrTalking() {
      if (this.ownStage()) return true;
      for (const e of this.rootDec.talk) if (e.id === this.id) return true;
      return false;
    },
    // C++: mesh_seat.inc:Seat::l9Small
    l9Small() {
      const TICK = this.TICK, rd = this.rootDec;
      if (rd.at >= 0 && !rd.part && rd.n > this.l9Peak) this.l9Peak = rd.n;
      if (rd.at >= 0 && !rd.part && rd.n > C * C) this.l9SawBig = true;
      if (!this.l9SawBig) return false;
      const raw = rd.at >= 0 && !rd.part && rd.n <= C * C - 1;
      let heard = 1;
      if (this.hasCoord) { const ol = ownedLinks(this.coord); for (const o of ol) if (this.firstHandLive(ckey(o))) heard++; }
      const heardBad = raw && this.hasCoord && rd.n < heard;
      const hold = heardBad && this.l9Peak <= 2 * (C * C - 1);
      const peakBad = raw && this.l9Peak > 2 * (C * C - 1) && rd.n <= Math.trunc(C * C / 2) && this.byeIds.size === 0;
      if (!raw || (heardBad && !hold)) { this.l9SmallSince = -1; return false; }
      if (this.l9SmallSince < 0) this.l9SmallSince = TICK;
      if (hold) return false;
      if (TICK - this.l9SmallSince < K.L5_SETTLE) return false;
      if (peakBad) return false;
      return true;
    },
    // C++: mesh_seat.inc:Seat::compactEligible
    compactEligible() {
      const TICK = this.TICK;
      if (!this.w.lv.COMPACTION) return false;
      if (!this.hasCoord || this.state !== 3 || this.coord.pc === 0 || this.moving || this.l4Busy()) return false;   // S1 is the top; a mover finishes first
      const l9small = this.l9Small();   // L9.11
      if (!l9small) {
        const settle = K.COMPACT_SETTLE;
        if (TICK - this.seatedAt < settle || TICK - this.healAt < settle || TICK - this.lastChurn < settle) return false;
      }
      if (this.hasChildren()) return false;                              // P: only a leaf may move
      if (this.onStageOrTalking()) return false;                         // L5.1/L6.3: never on stage or talking
      // CLEAN-DEPARTURE gate: only the RIGHTMOST occupant of my row may compact.
      if (!l9small) for (let j = this.coord.i + 1; j < C; j++) if (this.occGet(ckey({ pc: this.coord.pc, r: this.coord.r, i: j })) >= 0) return false;
      return true;
    },
    // C++: mesh_seat.inc:Seat::tryCompact
    tryCompact() {
      const id = this.id, TICK = this.TICK, lv = this.w.lv;
      if (!lv.PROBEON) return;                                   // offers-only arm
      const l9small = this.l9Small();   // L9.11
      if (l9small && this.rootDec.n !== this.l9ProbeN) { this.l9ProbeN = this.rootDec.n; this.l9ProbeGap = K.L5_PERIOD; }
      if (l9small ? (TICK - this.lastProbeTick < this.l9ProbeGap) : (TICK < this.compactAt)) return;   // rate limit / hysteresis
      if (!this.compactEligible()) return;
      { const jit = Math.trunc(this.rng() * K.COMPACT_PERIOD); this.compactAt = l9small ? TICK + K.L5_PERIOD : TICK + K.COMPACT_PERIOD + jit; }
      this.lastProbeTick = TICK; if (l9small) this.l9ProbeGap = Math.min(2 * this.l9ProbeGap, K.COMPACT_PERIOD);
      let up1 = (this.coord.i !== 0) ? this.occGet(ckey({ pc: this.coord.pc, r: this.coord.r, i: 0 })) : -1;
      const o = this.ownerCoord(); if (this.coord.i === 0 && o) up1 = this.occGet(ckey(o));
      if (up1 < 0 || up1 === id) return;
      lv.COMPACT_PROBES++;
      const m = newMsg('FIND'); m.nc = id; m.tag = 1; m.coord = cc(this.coord); m.ttl = K.COMPACT_TTL;
      // L12: depth >= 2, no other row of my section in my occ, and a transport-proven link to someone I sit beside.
      if (pcDepth(this.coord.pc) >= 2 && this.l12SectionLone() && TICK - this.seatedAt >= K.L12_HOLD) {
        const ol = ownedLinks(this.coord); let heard = false;
        for (const o2 of ol) { const lk = ckey(o2), x = this.occGet(lk); if (x < 0 || x === id) continue; const lb = this.linkedBy.get(lk); if (lb !== undefined && lb === x) { heard = true; break; } }
        if (heard) {
          let quiet = this.l12QuietUntil >= 0 && TICK < this.l12QuietUntil;
          const waving = this.l12WaveAt >= 0 && this.l12WaveEnd >= 0 && TICK < this.l12WaveEnd && !quiet;
          const seenBye = this.l12DepartAt >= 0;   // a real room-leave, not a move or a ring merge
          const left = this.l12WaveEnd >= 0 && this.l12DepartAt >= this.l12WaveEnd;   // a goodbye after this wave ended
          if ((this.l12WaveAt < 0 && seenBye) || (left && !waving)) {
            const reopen = this.l12WaveAt >= 0;
            this.l12WaveAt = TICK; this.l12QuietUntil = -1; quiet = false;
            let end = TICK + K.L12_WAVE;
            if (!reopen) { const cap = this.seatedAt + K.L12_OPEN_END; if (end > cap) end = cap; }   // opening wave ends before the load-ladder gauge
            this.l12WaveEnd = end;
          }
          if (quiet) { /* the chain probe, below */ }
          else if (this.l12WaveEnd >= 0 && TICK < this.l12WaveEnd) m.l12 = true;
          else if (this.l12WaveEnd >= 0) this.l12QuietUntil = TICK + K.L12_QUIET;   // wave over: chain only, until a later goodbye
        }
      }
      this.emit(up1, m);
    },
  });

  // std::swap of two Msg: the contents trade places, each object keeps its identity (a C++ Msg& is a place).
  // C++: mesh_seat.inc:serveCompact (std::swap(dHoldMsg,mm))
  function swapMsg(a, b) { const ta = msg.clone(a), tb = msg.clone(b); Object.assign(a, tb); Object.assign(b, ta); }

  // ---- the rollup digest -----------------------------------------------------------------------------------
  Seat.unit('mesh_seat.inc digest', {
    // C++: mesh_seat.inc:Seat::pubDig
    pubDig(d) {
      const id = this.id, TICK = this.TICK;
      const o = this.wireDig(d);
      // The adversary knob. Mode 1 SUPPRESSES; mode 2 inflates n.
      if (this.lie === 1) { o.refuse = 0; o.part = 0; }
      else if (this.lie === 2) { o.n += 1000; }
      // G9. Mode 3 SUPPRESSES the lists; mode 4 INFLATES every vote and adds a fabricated target.
      else if (this.lie === 3) { o.hands.length = 0; o.stage.length = 0; o.talk.length = 0; o.apps.length = 0; o.votes.length = 0; o.handN = 0; o.awayN = 0; }
      else if (this.lie === 4) { for (const v of o.votes) { v.up += 1000; v.dn += 1000; } o.votes.push({ tgt: 1 << 29, up: 1000, dn: 1000 }); }
      if (this.kEvil === 4 && this.kEvilT >= 0) {
        let hit = false; for (const v of o.kick) if (v.tgt === this.kEvilT) { v.up += 1000; hit = true; } if (!hit) o.kick.push({ tgt: this.kEvilT, up: 1000, dn: 0 });   // L27 hostile aggregator: inflates the vote-off of kEvilT
        for (const [ek, ev] of this.occ) {
          if (ev < 0 || ev === id || ev === this.kEvilT) continue; let inn = false; for (const k of o.kl) if (k.voter === ev) inn = true; if (inn) continue;
          const f = msg.newKStmt(); f.voter = ev; f.signer = id; f.good = true; f.ck = ek; f.ver = TICK | 0; f.yes = [this.kEvilT]; o.kl.push(f);
        }   // ...and (L27.9) lists votes for the seats it knows, signed with its own key
      }
      else if (this.kEvil === 5) { o.kabs += 1000; }   // claims its whole scope abstains on everything (lowers the bar)
      else if (this.kEvil === 6) { o.kick.length = 0; o.kabs = 0; o.kl.length = 0; }   // suppresses every vote it folded
      else if (this.kEvil === 7 && this.kEvilT >= 0) {
        for (let i = 0; i < o.kl.length; i++) {
          const k = o.kl[i]; const y = k.yes.includes(this.kEvilT);
          if (y) this.kStaleKeep.set(k.voter, dig.cloneKStmt(k)); else { const it = this.kStaleKeep.get(k.voter); if (it !== undefined) o.kl[i] = dig.cloneKStmt(it); }
        }
        for (const [ev, es] of this.kStaleKeep) { let inn = false; for (const k of o.kl) if (k.voter === ev) inn = true; if (!inn) o.kl.push(dig.cloneKStmt(es)); }
      }   // L27.9 hostile aggregator: keeps every yes on kEvilT it ever folded
      else if (this.kEvil === 11 && this.kEvilT >= 0) { const n = Math.max(1, o.n); for (let q = 0; q < n; q++) { const f = msg.newKStmt(); f.voter = 1000000 + id * 64 + q; f.signer = f.voter; f.good = true; f.ver = TICK | 0; f.yes = [this.kEvilT]; if (this.hasCoord) f.ck = ckey(this.coord); o.kl.push(f); } }   // L27.11
      else if (this.kEvil === 9 && this.kEvilT >= 0) { const n = Math.max(1, o.n); for (let q = 0; q < n; q++) { const f = msg.newKStmt(); f.voter = 1000000 + id * 64 + q; f.signer = f.voter; f.good = true; f.ver = TICK | 0; f.yes = [this.kEvilT]; if (this.hasCoord) f.ck = ckey({ pc: this.coord.pc, r: this.coord.r, i: 1 + (q % (C - 1)) }); o.kl.push(f); } }   // L27.9: each claims a cell of my row
      return o;
    },
    // C++: mesh_seat.inc:Seat::noteUp
    // G4: remember every report I published upward, keyed by its own stamp.
    noteUp(d) { this.upLog[this.upLogI & 15] = { at: d.at, n: d.n, refuse: d.refuse, lh: dig.digListHash(d) }; this.upLogI++; if (this.upSince < 0) this.upSince = this.TICK; },
    // C++: mesh_seat.inc:Seat::upRefuted
    // G4, THE AUTHOR'S REFUTATION: the only check any node performs, over a value that node itself authored.
    upRefuted(pub, echo, base) {
      this.digArm = 0;
      if (this.upLogI === 0) return false;
      // (3) OMISSION.
      if (echo.at < 0) { this.emptyEcho++; this.digArm = 3; return this.emptyEcho > Math.trunc(2 * K.DIG_TTL / 8); }
      this.emptyEcho = 0;
      if (echo.by !== this.id) return false;   // the echo names a DIFFERENT author: not evidence
      if (this.LT() - echo.at > 2 * K.DIG_TTL) { this.digArm = 3; return true; }   // echo.at is MY stamp, read on my own clock
      let r = null; for (let q = 0; q < 16; q++) if (this.upLog[q].at === echo.at) { r = this.upLog[q]; break; }
      if (!r) return false;                                     // older than my ring: no record, so no accusation
      if (echo.n !== r.n || echo.refuse !== r.refuse || dig.digListHash(echo) !== r.lh) { this.digArm = 1; return true; }  // (1) the lists too (G9)
      if (pub.n < base + echo.n || pub.refuse < echo.refuse) { this.digArm = 2; return true; }  // (2)
      // (2, G9) every list entry I authored is in the published fold, or the fold is FULL of entries that outrank it.
      if (pub.handN < echo.handN || pub.awayN < echo.awayN
        || !dig.listHolds(pub.hands, echo.hands, K_HAND, true) || !dig.listHolds(pub.stage, echo.stage, K_STAGE, true)
        || !dig.listHolds(pub.apps, echo.apps, K_APP, false) || !dig.votesHold(pub.votes, echo.votes)) { this.digArm = 4; return true; }
      return false;
    },
    // C++: mesh_seat.inc:Seat::scopeGap
    // G3's fail-closed predicate, FALSIFIABLE: is this scope member a PERSON I have lost, or just a stale occ entry?
    scopeGap(k) {
      const TICK = this.TICK;
      if (!this.occ.has(k) || this.occIsPhantom(k)) return false;
      { const o = this.occ.get(k), b = this.byeIds.get(o); if (b !== undefined && TICK - b <= K.DIG_LOSS_H) return false; }   // a seat that said its own room goodbye is not a subtree I lost
      const heard = this.rowKids.has(k) || this.s1tab.has(k) || (this.hasCoord && k === ckey(down(this.coord)) && this.downDig.at >= 0);
      if (!heard) return false;
      const it = this.live.get(k); return it !== undefined && TICK - it <= K.DIG_LOSS_H;
    },
    // C++: mesh_seat.inc:Seat::s1Take
    // § G intake for the Section-1 table.
    s1Take(k, u) {
      const it = this.s1tab.get(k);
      if (it === undefined) { this.l10Dirty(null, u); this.s1tab.set(k, dig.cloneDig(u)); return; }
      if (it.by === u.by) { if (u.at > it.at) { this.l10Dirty(it, u); this.s1tab.set(k, dig.cloneDig(u)); } return; }
      if (it.rx <= u.rx) { this.l10Dirty(it, u); this.s1tab.set(k, dig.cloneDig(u)); }
    },
    // C++: mesh_seat.inc:Seat::digForget
    // A confirmed vacate ends that cell's digest at once.
    digForget(k) {
      this.digForget1(k); this.l10Mark();   // L10: a seat left the fold: the change goes out early
    },
    // C++: mesh_seat.inc:Seat::digForget1
    digForget1(k) {
      this.rowKids.delete(k); this.s1tab.delete(k); if (this.kvKid.size) this.kvKid.delete(k);   // L27: a vacated cell's vote goes with its report
      if (this.hasCoord && k === ckey(down(this.coord))) this.downDig = msg.newDig();
    },
    // C++: mesh_seat.inc:Seat::digHeld
    // L3.12: the digest agrees with the lease.
    digHeld(k, e) {
      if (e.at < 0 || e.by < 0) return false;
      if (this.occGet(k) !== e.by) return false;
      return this.LT() - e.rx <= K.LEASE_T;
    },
    // C++: mesh_seat.inc:Seat::rollup
    rollup() {
      const id = this.id, TICK = this.TICK;
      if (!this.w.lv.DIGEST || !this.hasCoord || this.state !== 3) return;
      // occIsPhantom's knock-is-evidence rule is scoped to the FIND scan in progress: a display fold is not that scan.
      const svFind = this.findNc; this.findNc = -1;
      try {
        // --- (1) my SUBTREE = me + the child row I own -----------------------------
        const d = msg.newDig(); d.n = 1; d.refuse = this.refuses ? 1 : 0; d.at = this.LT(); d.rx = d.at; d.by = id; d.part = 0; d.freeC = 0;
        // G9 my own leaf facts. An away device sits out voting.
        if (this.handT) { d.handN = 1; d.hands.push({ id, k: this.handT, f: 0 }); }
        if (this.stageT) d.stage.push({ id, k: this.stageT, f: this.stageF });
        if (this.appT) d.apps.push({ id, k: this.appT, f: 0 });
        { this.talkExpire(); const te = this.talkEntry(); if (te) d.talk.push(te); }   // L6.2: my own place in the stage set
        if (this.away) d.awayN = 1;
        else {
          const u = new Set(), w = new Set();
          for (const t of this.vup) if (t !== id && !u.has(t)) { u.add(t); dig.voteAdd(d.votes, [{ tgt: t, up: 1, dn: 0 }]); }
          for (const t of this.vdn) if (t !== id && !w.has(t)) { w.add(t); dig.voteAdd(d.votes, [{ tgt: t, up: 0, dn: 1 }]); }
          if (this.kver > 0 && this.coord.pc === 0 && TICK >= this.digHoldUntil) { d.kOwn = this.kStmt(); if (this.kEvil === 2) d.kOwn.good = false; }   // L27: a Section-1 seat's signed statement rides its section digest
        }
        // THE HANDOVER HOLD.
        if (TICK < this.digHoldUntil) { d.votes.length = 0; d.handN = 0; d.awayN = 0; }
        // G7 free-space, MEASURED ONLY: a PURE read.
        if (pcDepth(this.coord.pc) < 12) {
          const rc = this.rosterCells();
          for (let c2 = 0; c2 < C; c2++) { const k = ckey(rc[c2]); if (this.occ.has(k) || this.sitting.has(k)) continue; const dk2 = ckey(down(rc[c2])); if (this.occ.has(dk2) || this.sitting.has(dk2)) continue; d.freeC++; }
          if (d.freeC) d.dmin = pcDepth(this.coord.pc) + 1;
        }
        const dk = ckey(down(this.coord)); this.digGap = 0; this.downUsed = msg.newDig();
        if (this.downDig.at >= 0 && this.LT() - this.downDig.rx <= K.DIG_TTL) { dig.digFold(d, this.downDig); this.downUsed = dig.cloneDig(this.downDig); this.kAddKid(d, dk); }   // L27: my child head's own vote, taken first-hand
        else if (this.downDig.at >= 0 && this.digHeld(dk, this.downDig)) { if (this.scopeGap(dk)) { d.part = 1; d.refuse += 1; this.digGap = 1; } dig.digFoldHeld(d, this.downDig); }   // L3.12: not echoed (downUsed stays empty): the author is silent
        else if (this.scopeGap(dk)) { d.part = 1; d.refuse += 1; this.digGap = 1; }   // G3 FAIL-CLOSED
        dig.digTrim(d);
        this.myDig = dig.cloneDig(d); this.lastPubAt = TICK; this.lastPubDepth = pcDepth(this.coord.pc);
        // --- (2) deep ROW HEAD: fold my row (my owner is linked only to me) --------
        if (this.coord.pc !== 0 && this.coord.i === 0) {
          const r = dig.cloneDig(this.myDig); r.at = this.LT(); r.rx = r.at; r.by = id; this.rowUsed.clear();
          for (let j = 1; j < C; j++) {
            const rk = ckey({ pc: this.coord.pc, r: this.coord.r, i: j }); const it = this.rowKids.get(rk);
            if (it !== undefined && this.LT() - it.rx <= K.DIG_TTL) { dig.digFold(r, it); this.rowUsed.set(rk, dig.cloneDig(it)); this.kAddKid(r, rk); }   // L27: the row-mate's own vote, taken first-hand
            else if (it !== undefined && this.digHeld(rk, it)) { if (this.scopeGap(rk)) { r.part = 1; r.refuse += 1; this.digGap |= 2; } dig.digFoldHeld(r, it); }   // L3.12
            else if (this.scopeGap(rk)) { r.part = 1; r.refuse += 1; this.digGap |= 2; }
          }
          dig.digTrim(r);
          this.rowDig = dig.cloneDig(r);
        }
        // --- (3) SECTION 1: fold the ROOT from the C^2 section digests -------------
        if (this.coord.pc === 0) this.rootFold();
        this.kAuditPulse();   // L27.9 (inert unless a list exists)
      } finally { this.findNc = svFind; }
    },
    // C++: mesh_seat.inc:Seat::rootFold
    // § G (3) as its own step: the Section-1 seat's room fold.
    rootFold(extra = false) {
      const id = this.id;
      if (!this.w.lv.DIGEST || !this.hasCoord || this.state !== 3 || this.coord.pc !== 0) return;
      const svFind = this.findNc; this.findNc = -1;
      try {
        const R = msg.newDig(); R.at = this.LT(); R.rx = R.at; R.by = id;
        const newest = new Map();   // author -> its newest stamp among my fresh entries (my own report: I am here now)
        for (const e of this.s1tab.values()) if (e.by >= 0 && this.LT() - e.rx <= K.DIG_TTL) { const nb = newest.get(e.by); if (nb === undefined || nb < e.at) newest.set(e.by, e.at); }
        for (let r0 = 0; r0 < C; r0++) for (let i0 = 0; i0 < C; i0++) {
          const k = ckey({ pc: 0, r: r0, i: i0 });
          if (this.hasCoord && k === ckey(this.coord)) { dig.digFold(R, this.myDig); if (this.myDig.kOwn.voter >= 0) this.kAddS1(R, k, this.myDig.kOwn); continue; }
          const it = this.s1tab.get(k);
          if (it !== undefined && this.LT() - it.rx <= K.DIG_TTL && it.by >= 0 && (it.by === id || ins(newest, it.by, () => 0) !== it.at)) continue;   // superseded: the author is me, or it has a newer report from another cell
          if (it !== undefined && this.LT() - it.rx <= K.DIG_TTL) { dig.digFold(R, it); if (it.kOwn.voter >= 0) this.kAddS1(R, k, it.kOwn); }
          else if (it !== undefined && this.digHeld(k, it) && (!newest.has(it.by) || ins(newest, it.by, () => 0) <= it.at)) { if (!extra && this.scopeGap(k)) { R.part = 1; R.refuse += 1; this.digGap |= 4; } dig.digFoldHeld(R, it); }   // L3.12
          else if (extra) { if (this.occ.has(k)) return; }   // an extra fold decides no gap
          else if (this.scopeGap(k)) { R.part = 1; R.refuse += 1; this.digGap |= 4; }
        }
        dig.digTrim(R);
        this.rootDig = R; if (!extra) this.rootDec = dig.cloneDig(R);   // rootDec: the fold as the pulse made it, the one a decision may read (L5)
      } finally { this.findNc = svFind; }
    },
  });

  // ---- L10: triggered state messages -----------------------------------------------------------------------
  Seat.unit('mesh_seat.inc L10', {
    // C++: mesh_seat.inc:Seat::l10OwnNow
    l10OwnNow() {
      let h = H_INIT; const mix = (x) => { h = hmix64(h, x); };
      mix(this.handT); mix(this.stageT); mix(this.stageF); mix(this.appT); mix(this.away ? 1 : 0); mix(this.refuses ? 1 : 0);
      mix(this.vup.length); for (const t of this.vup) mix(t); mix(this.vdn.length); for (const t of this.vdn) mix(t);
      const te = this.talkEntry(); if (te) { mix(7); mix(te.id); mix(te.k); mix(te.f); }
      return h;
    },
    // C++: mesh_seat.inc:Seat::l10UpNow
    // the content of what an early beat would carry: the shown state's
    l10UpNow() {
      if (!this.hasCoord) return 0;
      if (this.coord.pc !== 0) return dig.digSig((this.coord.i === 0) ? this.rowDig : this.myDig);
      let h = dig.digSig(this.myDig); for (const [k, e] of this.s1tab) h = (h + hmix64(dig.digSig(e), k)) >>> 0;   // a sum: order-free
      return h;
    },
    // C++: mesh_seat.inc:Seat::l10Take
    l10Take(m) {
      const TICK = this.TICK;
      let cls = -1;
      if (m.t === 'PHONE') { if (m.dgUp.at >= 0) cls = m.l10E ? 4 : 0; } else if (m.t === 'PONG') { if (m.dgOnly) cls = 6; else if (m.dgRoot.at >= 0 || m.dgPub.at >= 0) cls = 1; } else if (m.t === 'S1SYNC') { if (m.digs.length) cls = m.l10E ? 5 : 2; } else if (m.t === 'U2BEAT') { if (m.dgUp.at >= 0) cls = 3; }   // classes 4-6 are the early frames: their own buckets
      if (cls < 0) return true;
      const snd = m.lk >= 0 ? m.lk : (m.id >= 0 ? m.id : m.from); if (snd < 0) return true;
      const key = snd * K.L10_STATE_CLASSES + cls;
      const it = this.l10Bkt.get(key);
      if (it === undefined) { const nb = new books.Bucket(false); nb.tok = K.L10_BUCKET_BURST - 1; nb.at = TICK; this.l10Bkt.set(key, nb); return true; }
      const b = it; b.refill(TICK, K.L10_BUCKET_BURST, 1, K.L10_BUCKET_REFILL);
      if (!b.take()) { this.stDropC[cls]++; return false; }
      return true;
    },
    // C++: mesh_seat.inc:Seat::l10Digest
    // An early state frame, taken digest-only.
    l10Digest(m) {
      if (!this.w.lv.DIGEST || !this.hasCoord || this.state !== 3) return;
      if (m.t === 'S1SYNC') { if (m.digs.length <= C * C && this.coord.pc === 0) this.s1SyncDigs(m); return; }
      if (m.id < 0) return;
      const sure = this.linkIs(m, m.id), dsig = !sure && signedBy(m, m.id); if (!(sure || dsig)) return;
      const pk = ckey(m.coord); if (!this.ownedLinkCell(pk) || this.occGet(pk) !== m.id) return;
      if (m.t === 'PHONE') { if (m.tock !== ckey(this.coord) || m.dgUp.at < 0 || m.tag === 5) return; this.takeUp(m); }
      else if (m.t === 'PONG' && m.dgOnly) { this.pongDig(m, m.id); }
    },
    // C++: mesh_seat.inc:Seat::l10Early
    l10Early() {
      const id = this.id, TICK = this.TICK;
      if (this.spam && this.w.lv.DIGEST && this.state === 3 && this.hasCoord) { if (this.coord.pc === 0) { this.s1Heartbeat(); this.s1Sync(); } else this.phoneHome(); }   // the bad-actor lever: a state message every tick
      if (!this.w.lv.DIGEST || this.state !== 3 || !this.hasCoord || this.moving) return;
      if (this.l10NewAt && TICK >= this.l10NewAt - 1 + K.L10_NEW_WAIT) { this.l10NewAt = 0; this.l10Mark(); }   // a seat new in my fold has been there long enough
      const o = this.l10OwnNow(); if (o !== this.l10OwnSig) { if (this.l10OwnSig) this.l10Mark(); this.l10OwnSig = o; }   // the first look at my own facts is no change
      if (this.rootDig.at >= 0) { const r = dig.digSig(this.rootDig); if (r !== this.l10RootSig) { if (this.l10RootSig) this.l10DirtyDn = true; this.l10RootSig = r; } }
      { // a new seat at one of my owned links has none of my state: it gets it at once
        const ol = ownedLinks(this.coord); let h = H_INIT; for (const o2 of ol) { const x = this.occGet(ckey(o2)); h = hmix(h, x); }
        if (h !== this.l10NbrSig) { if (this.l10NbrSig) { this.l10Mark(); this.l10Force = true; this.l10DirtyDn = true; } this.l10NbrSig = h; }
      }
      // LEADING EDGE / TRAILING EDGE.
      let go = false;
      if (this.l10DirtyUp && TICK - this.lastPhone < 8 && TICK - this.l10EarlyAt >= K.L10_EARLY_GAP) { this.l10Refill(); go = this.l10Own.tok >= (TICK - this.l10EarlyAt >= 2 * K.L10_EARLY_GAP ? 1.0 : K.L10_BUCKET_BURST); }
      if (go) {
        const dAt = this.l10DirtyAt; this.l10DirtyUp = false; this.rollup();   // the early fold is the one fold
        const u = this.l10UpNow();
        if (u !== this.l10UpSig || this.l10Force) {
          this.l10Sent = false; if (this.coord.pc === 0) { this.s1Heartbeat(true); this.s1Sync(true); this.l10Sent = true; } else this.phoneHome(true);
          if (this.l10Sent) {   // sent
            this.l10Force = false; this.l10UpSig = u; this.l10EarlyAt = TICK; this.stEarly++; this.l10Spend(); { const lat = TICK - dAt; if (lat === 0) this.stLead++; else this.stTrail++; this.stLatSum += lat; if (lat > this.stLatMax) this.stLatMax = lat; }
          }
          else this.l10DirtyUp = true;
        }
      }
      if (this.l10DirtyDn && TICK - this.l10DnAt >= K.L10_EARLY_GAP && this.rootDig.at >= 0) {
        this.l10DirtyDn = false; this.l10DnAt = TICK;
        const b = newMsg('PONG'); b.coord = cc(this.coord); b.id = id; b.dgOnly = true; b.dgRoot = this.wireDig(this.rootDig); b.dgRoot.kl.length = 0;
        const kids = [];
        if (this.coord.pc !== 0 && this.coord.i === 0) for (let j = 1; j < C; j++) { const rk = ckey({ pc: this.coord.pc, r: this.coord.r, i: j }), x = this.occGet(rk); if (x >= 0 && x !== id && this.firstHandLive(rk)) kids.push(x); }
        { const dk = ckey(down(this.coord)), x = this.occGet(dk); if (x >= 0 && x !== id && this.firstHandLive(dk)) kids.push(x); }
        let again = false;
        for (let q = 0; q < kids.length; q++) {
          const sd = this.l10DgTo.get(kids[q]);
          if (sd !== undefined && TICK - sd < K.L10_EARLY_GAP) { let retry = false; { const shown = this.rootDig.n + this.rootDig.leased; const pn = this.l10DgN.get(kids[q]); if (pn === undefined || pn !== shown) retry = true; } if (retry) again = true; continue; }
          this.l10DgTo.set(kids[q], TICK); this.l10DgN.set(kids[q], this.rootDig.n + this.rootDig.leased); this.emit(kids[q], b);
        }
        if (again) this.l10DirtyDn = true;   // the beat just filled this kid's early slot, so the fold waits out the gap
      }
    },
  });

  const api = Object.freeze({ l12Origin, l12Score, l12Cand, compactDensifyCol });
  GifOS.meshDigest = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
