/*
 * entry.js: the seat's way in (port unit S3): taking a cell, announcing it, the sitting-down marks, admitting a
 * seeker, serving a FIND (Section 1, spread, descent), the held FIND, the door's answer, and the reclaim of an
 * old cell. Ported line for line from the 0.9.25 sim (mesh_seat.inc at gifos 37d787b2d). join and askSeat
 * (mesh.cpp, inline in the struct) were ported with the Seat in seat.js.
 *
 * Port notes (see seat.js for the conventions):
 *   ADMIT_SITE   the C++ thread_local label of the admit decision is `this.w.ADMIT_SITE` (the fabric's
 *                fabricAdmitLog reads the same field).
 *   descOn()     the sim's MESH_DESC measurement switch is `this.w.DESC_ON` (unset = off, as the sim by default).
 *   l33Skip      the in/out flag of serveFindS1 is a holder object { v: bool }.
 *   NOROOM_BYDEPTH / MESH_DUPLOG / MESH_MOVELOG: sim-only counters and forensics, left out (no seat reads them).
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const seatM = req('./seat.js', 'meshSeat');
  const { cellOk, ownerCoordOf, coordStr, l4Pack, fabricToken } = req('./shared.js', 'meshShared');
  const { Seat, FREE, roomTerm } = seatM;
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const hash = req('./hash.js', 'meshHash');
  const state = req('./state.js', 'meshState');
  const dig = req('./dig.js', 'meshDig');
  const { eraseFirst } = req('./util.js', 'meshUtil');

  const K = C_.consts, E = C_.enums;
  const { ckey, ckPc, ckR, ckI, unckey, ownedLinks, down, up, pcDepth, lastDigit, parentPath } = topo;
  const C = topo.C;
  const newMsg = (t) => msg.newMsg(t);

  // ---- free helpers the entry functions call (private copies of small statics) ---------------------------
  // C++: mesh.cpp:descOn (the MESH_DESC switch; a measurement, never read by protocol code)
  function descOn(s) { return !!s.w.DESC_ON; }
  const mtNum = (t) => msg.MT_NAMES.indexOf(t);
  const co = (c) => topo.cc(c);
  const mkCell = (pc, r, i) => ({ pc, r, i });

  Seat.unit('mesh_seat.inc entry', {
    // C++: mesh_seat.inc:Seat::take
    // nbrs is filled in place (the C++ vector<KV>& is the caller's).
    take(c, owner, nbrs, ppFrom = -1, ppTick = -1, nbrsRow = [], ppTickL = -1) {
      const lv = this.w.lv, id = this.id, TICK = this.TICK;
      if (c.i >= C || c.r >= C) return;   // sanity: never take a malformed coord
      this.l381N = 0;   // L38.1: a seated seat's next entry starts fresh
      if (roomTerm(this, 1) && this.c7At > -1000000 && TICK - this.c7At < K.RELAY_TTL && !(lv.TIERS_ACTIVE && (this.cnat !== E.NAT_OPEN || this.l4NatSeen))) {
        const drop = []; for (const k of this.byeAt.keys()) if (ckPc(k) === 0) drop.push(k); for (const k of drop) this.byeAt.delete(k);   // L8.14
      }
      // PP: the proof my admitter signed with this PLACE
      if (owner >= 0 && ppFrom >= 0 && ppTick >= 0) { this.pp = ppFrom; this.ppAt = ppTick; this.ppCk = ckey(c); this.ppL = ppTickL >= 0 ? ppTickL : ppFrom === id ? ppTick : TICK; } else { this.pp = -1; this.ppAt = -1; this.ppCk = 0; this.ppL = -1; }
      this.ppAskAt = -1; this.placer = -1;
      this.mpK = 0; this.mpCk = 0; this.mpOld = 0;
      if (owner < 0 && this.hasCoord) {
        if (this.flCur >= 0) { this.mpK = 1; this.mpBy = this.flCur; this.mpAt = this.flCurAt; this.mpL = this.flCurL; }
        else if (ckey(down(c)) === ckey(this.coord)) { this.mpK = 2; this.mpBy = id; this.mpAt = TICK; this.mpL = this.mpAt; this.mpOld = ckey(this.coord); }
        if (this.mpK) this.mpCk = ckey(c);
      }   // L25.7
      this.rowGen = 0; this.rowLedgerLast = ''; this.rowGenSeenId = -1; this.rowGenSeen = -1;   // V7b
      this.rcRound2 = false; this.rcRound2At = -1; this.rcPendWait = K.RC_WAIT;
      this.f.fabricDupMint(id, c, owner);   // MESH_DUPLOG forensics: the fabric compares against its own table
      if (this.hasCoord && pcDepth(c.pc) < pcDepth(this.coord.pc) && this.lastProbeTick >= TICK - 120 && ((this.pinT && TICK - this.pinT > 16) || (this.talkSince >= 0 && TICK - this.talkSince > 16)) && this.ownStage()) lv.STAGEUP++;   // L6 oracle (a measurement)
      this.trace('TAKE', id, c, 'placer=%d from=%s', owner, this.hasCoord ? coordStr(this.coord) : '-');
      this.myPlacer = owner;
      this.l13Wit.length = 0;
      if (this.l13('L13.1')) for (const kv of nbrs) { if (kv.v >= 0 && kv.v !== id && cellOk(kv.k) && this.rmWitCell(c, kv.k)) this.l13Wit.push(kv.v); }   // L13
      this.rowLedger = !(c.pc === 0 && c.i === 0 && owner >= 0);   // V4
      this.tn = ++lv.TN_SEQ;   // a new tenancy (see emit)
      this.l13Past = this.hasCoord || this.l13ReqN > 0;   // (before the new coord is set)
      this.rmBornAt = TICK; this.rmLedgerHead = -1; this.rmNewHeadAt = -1000;   // L11
      { this.rmHistAt = -1000; for (const kv of nbrs) if (kv.k === ckey(down(c))) { this.rmHistAt = TICK; break; } }
      this.coord = co(c); this.hasCoord = true; this.state = 3; if (c.pc !== 0) this.f.relayUnlist(id); /* L16.4 */ this.l16GwClosed = false; this.joinStart = -1; this.stranded = false; this.reAsk = false; this.reJoin = false; this.noroomSeen = 0; this.rowLedgerAt = -1;
      // A: self-confirm sitting-down -> seated (only the joiner upgrades).
      this.confirmSeated(ckey(c), id);
      // The neighbours a PLACE (or a heal) teaches me: my new owned links, my owner, and the admitter itself.
      {
        const ol = ownedLinks(c); const n = ol.length; const oc = ownerCoordOf(c); const hasO = oc !== null; let adm = owner >= 0;
        this.l13Greet.clear();
        if (this.l13On() && c.pc !== 0 && c.i === 0) {
          for (const e of nbrsRow) {
            if (e.v < 0 || e.v === id || !cellOk(e.k)) continue; const ec = unckey(e.k); if (ec.pc !== c.pc || ec.r !== c.r || ec.i === 0) continue;
            this.l13Greet.set(e.k, e.v); let has = false; for (const x of nbrs) if (x.k === e.k) has = true; if (!has) nbrs.push({ k: e.k, v: e.v });
          }
        }   // L13
        for (const kv of nbrs) {
          if (kv.v < 0 && hasO && kv.k === ckey(oc)) { this.byeAt.set(kv.k, TICK); continue; }   // L9.3
          if (kv.v < 0 || !cellOk(kv.k)) continue; let ok = false; for (let q = 0; q < n; q++) if (ckey(ol[q]) === kv.k) { ok = true; break; } if (!ok && hasO && ckey(oc) === kv.k) ok = true;
          if (!ok && owner >= 0 && c.pc === 0 && ckPc(kv.k) === 0) ok = true;   // L7.7
          if (!ok && hasO && c.i === 0 && kv.k !== ckey(oc)) { const hc = unckey(kv.k); if (hc.pc === oc.pc && hc.r === oc.r) { this.l9BkId = kv.v; this.l9BkCk = kv.k; this.l9BkAt = TICK; } if (oc.pc === 0 && hc.pc === 0 && (hc.r === oc.r || hc.i === oc.i)) ok = true; }   // L9.3
          if (!ok && this.l13('L13.1') && hasO && c.pc !== 0) { const ring = FREE.l13Ring(oc); let inn = false; for (const rc of ring) if (ckey(rc) === kv.k) inn = true; if (inn) { if (this.cousins.has(kv.k) || this.cousins.size < 4 * C) this.cousins.set(kv.k, kv.v); continue; } }
          if (!ok && this.l13('L13.4') && c.pc !== 0 && ckPc(kv.k) !== 0) {
            let cc = unckey(kv.k); let below = false;
            for (let h = 0; h < 3 && !below; h++) { const w = FREE.l13Witness(cc); if (!w) break; if (ckey(w) === ckey(c)) below = true; cc = w; }
            if (below) { this.l13Tell.push(kv.v); continue; }
          }   // L13.4
          if (!ok) { if (!adm || kv.v !== owner) continue; adm = false; }
          // L8.8: a hint learned while I was unseated is not first-hand; the admitter's word replaces it.
          {
            const l88 = roomTerm(this, 1) && this.occ.has(kv.k) && this.occGet(kv.k) !== kv.v && !this.firstHandLive(kv.k);
            if (!this.occ.has(kv.k) || l88) { if (l88 && kv.v === owner) this.noChan.delete(kv.v); this.setOcc(kv.k, kv.v); if (!l88 || this.occGet(kv.k) === kv.v) { this.noteS1(kv.k); if (kv.v !== owner && ckPc(kv.k) === 0) this.s1told.set(kv.k, TICK); } }
          }
        }
      }
      if (owner >= 0 && c.pc === 0) {
        let nr = 0;
        for (const e of nbrsRow) {
          if (++nr > C * C) break;
          if (ckPc(e.k) !== 0 || !cellOk(e.k) || e.v < 0 || e.v === id || e.k === ckey(c) || this.occ.has(e.k) || this.sitting.has(e.k)) continue;
          const s = state.newStruct('SoftSit'); s.joiner = e.v; s.assigner = owner; s.at = TICK; s.pingAt = -1; this.sitting.set(e.k, s);
        }
      }   // L7.7
      this.lkAnyAt = -1; this.unpAnyAt = -1; this.lkAt.clear(); this.unpAt.clear(); this.unpSince.clear(); this.darkHold.clear();   // D6
      if (this.l13Tell.length) { for (const v of this.l13Tell) { if (v < 0 || v === id) continue; this.f.fabricDialJoin(id, v); this.l13Answer(v, ckey(c)); } this.l13Tell.length = 0; }   // L13.4
      this.l20Out.clear(); this.l20Hold.clear();   // L20
      this.drainAt = 0; this.seatTries = 0; this.searchAt = -1; this.l917Ck = 0; this.seatedAt = TICK; this.rookSeenAt = TICK; this.rookEver = false; this.estAt = TICK; this.nbrAt = TICK; this.pendYBy = -1; this.challToId = -1; this.lateY.clear();   // grace
      // G: a seat change re-parents me; every digest relationship starts over.
      this.upLogI = 0; this.upSince = -1; this.lastAgg = -1; for (let q = 0; q < 16; q++) this.upLog[q] = state.newStruct('UpRec');
      this.downDig = msg.newDig(); this.downUsed = msg.newDig(); this.myDig = msg.newDig(); this.rowDig = msg.newDig(); this.rootDig = msg.newDig(); this.rootDec = msg.newDig();
      // The handover hold (rollup).
      { const hold = K.CONFIRM_TTL + (this.lastPubDepth + 3) * K.DIG_HOLD_LEVEL; const s1Only = (this.lastPubDepth === 0 && c.pc === 0);
        if (!s1Only && this.lastPubAt >= 0 && TICK - this.lastPubAt < hold) this.digHoldUntil = TICK + hold; }
      this.rowKids.clear(); this.rowUsed.clear(); if (c.pc !== 0) this.s1tab.clear();
      this.lastAck = TICK; this.lastPhone = (owner >= 0 && c.pc !== 0 && c.i === 0) ? TICK - 8 : TICK;   // L7.6 (I10)
      if (owner >= 0) { const m = newMsg('CLAIM'); m.ck = ckey(c); m.id = id; this.emit(owner, m); }
      else { const adm = this.ppAdmitter(c); if (adm >= 0 && adm !== id) { this.ppAskAt = TICK; const m = newMsg('CLAIM'); m.ck = ckey(c); m.id = id; this.emit(adm, m); } }   // PP
      if (c.pc === 0) { this.s1CheckAt = TICK + K.E3_PERIOD + Math.floor(this.rng() * K.E3_PERIOD); this.emitRelay(this.genKey); }   // E3
      this.announce(); this.f.wake(id);
      if (this.w.onTake) this.w.onTake(this, c);   // page adapter seam (the pre-signed goodbye), outside the proof
    },

    // C++: mesh_seat.inc:Seat::announce
    announce() {
      const ol = ownedLinks(this.coord); const n = ol.length; const seen = new Set();
      for (let k = 0; k < n; k++) {
        const lk = ckey(ol[k]); let x = this.occGet(lk);
        if (x < 0 && this.softSitting(lk)) x = this.sitting.get(lk).joiner;   // A: also greet soft-sit neighbours
        if (x >= 0 && x !== this.id && !seen.has(x)) { seen.add(x); const m = newMsg('HELLO'); m.ck = ckey(this.coord); m.id = this.id; this.emit(x, m); }
      }
    },

    // C++: mesh_seat.inc:Seat::recheckSitting
    // A: assigner recheck + soft TTL, the V4 probe-gated check-back.
    recheckSitting() {
      if (!this.sitting.size) return;
      const TICK = this.TICK, id = this.id;
      const del = [];
      for (const [ek, s] of this.sitting) {
        if (s.assigner !== id) { if (TICK - s.at >= K.SIT_TTL) { del.push(ek); } continue; }   // L7.7
        // Confirmed seated by first-hand contact with the joiner at this cell.
        if (this.occGet(ek) === s.joiner && this.firstHandLive(ek)) { del.push(ek); continue; }
        if (!s.replayed && s.pl.t === 'PLACE' && TICK - s.at >= K.PLACE_REPLAY && this.occGet(ek) !== s.joiner) { s.replayed = true; this.emit(s.joiner, msg.clone(s.pl)); }   // FINDACK: a lost PLACE, replayed once
        if (TICK - s.at < K.SIT_RECHECK) continue;
        // V4 PROBE-GATED CHECK-BACK: SITPING the admittee itself; a killed tab never answers, the chair frees.
        if (this.occGet(ek) !== s.joiner && !this.firstHandLive(ek)) {
          if (s.pingAt < 0) { s.pingAt = TICK; const m = newMsg('SITPING'); m.ck = ek; m.id = s.joiner; this.emit(s.joiner, m); continue; }
          if (TICK - s.pingAt < K.SIT_PING_WAIT) continue;
         
          // Freed on SILENCE, not on attributed evidence: the chair re-enters the 45-tick admission cooling.
          del.push(ek); this.healOnly.delete(ek); this.healTry.set(ek, TICK);
          continue;
        }
        // Soft TTL backstop: a mark cannot live forever if recheck is skipped.
        if (TICK - s.at >= K.SIT_TTL) {
         
          del.push(ek); this.healOnly.delete(ek); this.healTry.set(ek, TICK);   // V4: TTL is also a silence-free
          // Ghost occ left by an older admit path or partial confirm: clear if not live.
          if (this.occGet(ek) === s.joiner && !this.firstHandLive(ek)) {
            this.occDrop(ek, 'sit-ttl-ghost'); this.live.delete(ek); this.s1seen.delete(ek); this.kidful.delete(ek); this.tlForget(ek); this.healTry.delete(ek);
          }
        }
      }
      for (const k of del) this.sitting.delete(k);
    },

    // C++: mesh_seat.inc:Seat::admit
    admit(c, f) {
      const lv = this.w.lv, id = this.id, TICK = this.TICK;
      const nc = f.nc;
      const site = this.w.ADMIT_SITE === undefined ? '?' : this.w.ADMIT_SITE;
      // FRONT 3 measurement only: how a newcomer FIND ended, and how many hops it burned.
      if (descOn(this) && f.tag !== 1) this.f.descEnd(site.startsWith('deep') ? 0 : 1, 200 - f.ttl);
      const k = ckey(c);
      if (lv.TIERS_ACTIVE && nc >= 0 && nc !== id && f.tag !== 1) { if (this.tierSeen.size >= 96 && !this.tierSeen.has(nc)) eraseFirst(this.tierSeen); this.tierSeen.set(nc, l4Pack(f.tier, f.nat)); }   // L4.1
      this.f.fabricAdmitLog(k, id);   // V4 forensics
      this.trace('ADMIT', id, c, 'nc=%d site=%s tag=%d', nc, site, f.tag);
      if (f.tag !== 1) this.l710Dial(c, nc);   // L7.10
      this.tlForget(k);   // the cell genuinely refills
      const nbrs = []; const ol = ownedLinks(c); const n = ol.length;
      for (let i = 0; i < n; i++) { const x = this.occGet(ckey(ol[i])); if (x >= 0 && x !== nc) nbrs.push({ k: ckey(ol[i]), v: x }); }
      // ALWAYS teach the admittee its ADMITTER (2026-08-02).
      let selfNb = false; for (let i = 0; i < n; i++) if (ckey(ol[i]) === ckey(this.coord)) selfNb = true;
      if (!selfNb && this.hasCoord) nbrs.push({ k: ckey(this.coord), v: id });
      if (selfNb) nbrs.push({ k: ckey(this.coord), v: id });
      { const dk = ckey(down(c)); let has = false; for (const x of nbrs) if (x.k === dk) has = true; const hx = this.childOf.get(k); if (!has && hx !== undefined && hx >= 0 && hx !== nc) nbrs.push({ k: dk, v: hx }); this.rmName(c, nc, nbrs); }   // L11
      // L7.7 (I10): a Section-1 PLACE carries the home ring as I hear it.
      if (f.tag !== 1 && c.pc === 0 && this.hasCoord && this.coord.pc === 0) {
        const r = this.s1Roster(); let nr = 0;
        for (const e of r) { if (e.v === nc || e.k === k) continue; let has = false; for (const x of nbrs) if (x.k === e.k) { has = true; break; } if (has) continue; nbrs.push({ k: e.k, v: e.v }); if (++nr >= C * C) break; }
      }
      const m = newMsg('PLACE'); m.coord = co(c); m.owner = id; m.nbrs = nbrs.map((x) => ({ k: x.k, v: x.v })); m.tag = f.tag; m.nc = nc; m.gwc = f.gwc; m.pp = id; m.ppAt = TICK; m.gaN = f.gaN;   // L41.1: the PLACE answers this FIND
      if (this.l13On() && c.pc !== 0 && c.i === 0 && this.hasCoord && ckey(down(this.coord)) === k && (this.l13Past || this.rmLedgerHead >= 0 || this.rmHistAt > -1000)) { this.rmNewHeadAt = TICK; this.rmLedgerHead = -1; }   // L13
      if (this.l13On() && c.pc !== 0 && c.i === 0) {
        for (let j = 1; j < C; j++) {
          const rk = ckey({ pc: c.pc, r: c.r, i: j }); const mm = this.l13RowMemo.get(rk); if (mm === undefined || mm[0] < 0 || mm[0] === nc) continue;
          let has = false; for (const x of nbrs) if (x.k === rk) has = true;
          if (!has) { const e = msg.newEnt(); e.k = rk; e.v = mm[0]; e.age = -1; m.row.push(e); }
        }
      }   // L13
      // L7.7: ...and the home cells I have PROMISED (my open vouches), as promises, never as occupants.
      if (f.tag !== 1 && c.pc === 0 && this.hasCoord && this.coord.pc === 0) {
        let nr = 0;
        for (const [ek, s] of this.sitting) { if (ckPc(ek) !== 0 || s.assigner !== id || ek === k || s.joiner === nc) continue; const e = msg.newEnt(); e.k = ek; e.v = s.joiner; e.age = -1; m.row.push(e); if (++nr >= C * C) break; }
      }
      { const gk = ppKeyOf(k, nc); if (this.ppGiven.size >= 128) eraseFirst(this.ppGiven); this.ppGiven.set(gk, TICK); }   // ...so the confirm of its CLAIM grants no second one
      if (f.tag !== 1 && this.hasCoord && k === ckey(down(this.coord))) { this.childHeadAt = TICK; this.l33ChildVouch(f.nc); }   /* L33.12 */   // L7.5
      if (f.tag === 1) {
        this.markSitting(k, nc);
        lv.COMPACT_ADMITS++;
        if (this.coord.pc === 0 && f.coord.pc !== 0) {   // L5.1
          let a = co(f.coord);
          for (let g = 0; g < 16 && a.pc !== 0; g++) { const h = { pc: a.pc, r: a.r, i: 0 }; const u = up(h); if (!u) break; a = u; }
          if (a.pc === 0) { this.route(a, nc, m); return; }
        }
        this.route(f.coord, -1, m);
      } else {
        this.markSitting(k, nc);   // sitting-down: assigner wrote PLACE, not yet seated
        this.sitting.get(k).pl = msg.clone(m);   // FINDACK: kept for a re-sent PLACE
        if (this.l31Cap) { this.l31Out = msg.clone(m); this.l31Got = true; } else if (!(this.l31Hold(c, nc, m))) this.emit(nc, m);   // L31.4
      }
    },

    // C++: mesh_seat.inc:Seat::serveFind
    serveFind(mm) {
      const id = this.id;
      const skip = { v: false };   // L33.6: this scan passed over a home cell a head below is calling about (L33.2)
      this.fcNc = mm.nc; this.fcTier = mm.tier; this.fcNat = mm.nat; this.fcTh = mm.th;   // L4
      if (!this.hasCoord || mm.ttl <= 0) { if (descOn(this)) this.f.descEnd(4, 200 - mm.ttl); this.trace('NOROOM', id, this.hasCoord ? this.coord : null, 'nc=%d why=ttl-or-unseated', mm.nc); const m = newMsg('NOROOM'); m.gwc = mm.gwc; m.id = id; m.nd = (this.hasCoord ? pcDepth(this.coord.pc) : 0) & 0xff; this.emit(mm.nc, m); return; }
      this.courtNc = mm.nc; if (!this.courtIgnore) this.courtSkipped = false;   // L3.14
      if (this.l31Pend.length) { for (const p of this.l31Pend) if (p.nc === mm.nc) { this.findAck(mm); return; } }   // L31.4
      for (const [, e] of this.sitting) if (e.joiner === mm.nc && e.assigner === id && e.pl.t === 'PLACE' && this.TICK - e.at <= K.SIT_TTL) { this.emit(mm.nc, msg.clone(e.pl)); return; }   // FINDACK
      // D6b: a seeker that vacated by D6-dark knocks for a deep cell.
      const dkDeep = mm.dk;
      if (this.coord.pc === 0 && !dkDeep) {
        if (this.serveFindS1(mm, skip)) return;
      }
      const f = this.firstFreeInRoster();
      if (f) {
        if (this.w.lv.TIERS_ACTIVE && this.l4Hop(mm, f)) return;   // L4.2
        // Phantom occ on the admitted cell: clear it first-hand.
        { const fk = ckey(f); if (this.occIsPhantom(fk)) { this.occDrop(fk, 'phantomclr-deep'); this.live.delete(fk); this.s1seen.delete(fk); this.kidful.delete(fk); this.tlForget(fk); } }
        this.w.ADMIT_SITE = 'deep-firstFree'; this.admit(f, mm); return;
      }
      if (this.holdFind(mm, true)) return;   // L7.5
      if (this.serveFindSpread(mm, skip.v)) return;   // L7.5 SPREAD HOP
      this.serveFindDescend(mm);
    },

    // C++: mesh_seat.inc:Seat::serveFindS1
    // serveFind, Section 1: a home seat serving a FIND (designated arm, row scan, home admission); true when served.
    // skip is the holder of the C++ out-parameter l33Skip.
    serveFindS1(mm, skip) {
      const id = this.id, TICK = this.TICK;
      const l32Declined = [];   // L32.5
      // A SPLIT-OFF SEAT ADMITS NOBODY INTO SECTION 1 (mesh.js twin).
      if (TICK - this.rookSeenAt > K.OWNER_SILENT && (this.rookEver || !this.f.fabricDoors()) && this.greetersAt >= 0 && TICK - this.greetersAt <= K.RELAY_TTL) {
        let other = false;
        for (const g of this.lastGreeters) { const ka = this.knockAt.get(g); if (g !== id && g >= 0 && g !== mm.nc && !(ka !== undefined && TICK - ka <= K.KNOCK_FRESH) && !mm.dark.includes(g)) { other = true; break; } }   // a greeter knocking on me (a FIND in the last KNOCK_FRESH ticks) is at the door, no second ring
        if (other) {
          if (TICK - this.splitKnockAt >= 8) { this.splitKnockAt = TICK; this.emitRelay(this.genKey); }
          this.trace('NOROOM', id, this.hasCoord ? this.coord : null, 'nc=%d why=split-off-hold', mm.nc); const m = newMsg('NOROOM'); m.gwc = mm.gwc; m.split = true; m.id = id; m.nd = 0; this.emit(mm.nc, m); return true;
        }
      }
      // H7 ROW-FILL seating: Section 1 fills ROW-MAJOR; every S1 cell has ONE designated admitter.
      // V4 forensics: WHY does a cell read as free at the devolution decision (no side effects).
      const freeReason = (ak) => {
        if (this.softSitting(ak)) return 'RESERVED-soft';
        if (!this.occ.has(ak)) return 'no-occ';
        if (this.firstHandLive(ak)) return 'RESERVED-fhl';
        const x = this.occGet(ak);
        if (this.findNc >= 0 && x === this.findNc) return 'phantom-knock';
        for (const [ok, ov] of this.occ) if (ov === x && ok !== ak && this.firstHandLive(ok)) return 'phantom-moved';
        return 'RESERVED-unheard';
      };
      const rowLive = [], rowSeen = [], rowHeld = [];
      for (let t = 0; t < C; t++) {
        rowLive[t] = (this.coord.r === t); rowSeen[t] = rowLive[t]; rowHeld[t] = false;
        for (let j = 0; j < C; j++) { const k = ckey({ pc: 0, r: t, i: j }); if (this.s1Fresh(k)) rowLive[t] = true; if (this.s1seen.has(k)) rowSeen[t] = true; if (this.cellReserved(k)) rowHeld[t] = true; }
      }
      for (let t = 0; t < C; t++) {
        // A + H7 (HARDENED 2026-08-02): do NOT start the next S1 row until the previous row is fully OCCUPIED.
        // L7.8 (I10) THE HOME CHAIN: a row of MY OWN fresh vouches counts as full for the NEXT row's head.
        if (t > 0) {
          let prevFull = true, chain = true;
          for (let j = 0; j < C; j++) { const pk = ckey({ pc: 0, r: t - 1, i: j }); if (this.occ.has(pk)) continue; prevFull = false; const it = this.sitting.get(pk); if (!(it !== undefined && it.assigner === id && TICK - it.at <= K.SIT_RECHECK)) chain = false; }
          if (chain) { const hk = ckey({ pc: 0, r: t - 1, i: 0 }); const hd = this.sitting.get(hk); chain = (this.hasCoord && ckey(this.coord) === hk) || (hd !== undefined && hd.assigner === id && !this.occ.has(hk)); }   // the row above's head is me, or still my vouch
          if (!prevFull && !chain) { break; }
        }
        const liveRow = rowLive[t], everSeen = rowSeen[t];
        // A VACATED row is not a corpse. RESURRECTION exists for a row that DIED wholesale.
        if (!liveRow && everSeen && rowHeld[t]) {
          // RESURRECTION (old H7, row-targeted): the admitters are the greeters of the row BELOW ((t+1)%C).
          if (this.coord.r === (t + 1) % C) {
            const k = ckey({ pc: 0, r: t, i: this.coord.i });
            if (TICK - (this.healTry.has(k) ? this.healTry.get(k) : -999) > 45 || (this.healOnly.has(k) && (this.oneRowRoom() || this.nothingBelow(k)))) { this.healOnly.delete(k); this.healTry.set(k, TICK); this.w.ADMIT_SITE = 's1-assigner-rowfill'; this.admit({ pc: 0, r: t, i: this.coord.i }, mm); return true; }
            continue;
          }
          // Forward toward the admitter row below ONLY over a FIRST-HAND-LIVE link.
          const admc = { pc: 0, r: (t + 1) % C, i: this.coord.i }, admh = { pc: 0, r: (t + 1) % C, i: 0 };
          // First-hand, or DOOR-LISTED.
          const doorListed = (x) => { if (x < 0) return false; for (const g of this.lastGreeters) if (g === x) return true; return false; };
          let aid = this.firstHandLive(ckey(admc)) ? this.occGet(ckey(admc)) : (doorListed(this.occGet(ckey(admc))) ? this.occGet(ckey(admc)) : -1); let fh = aid >= 0 && this.firstHandLive(ckey(admc));
          if (aid < 0 || aid === id) { const hx = this.occGet(ckey(admh)); aid = this.firstHandLive(ckey(admh)) ? hx : (doorListed(hx) ? hx : -1); fh = aid >= 0 && this.firstHandLive(ckey(admh)); }
          // ONCE PER SEEKER when the admitter is only door-listed (mesh.js twin, fwdSeen).
          if (aid >= 0 && aid !== id && !fh) { const fs = this.fwdSeen.get(mm.nc); if (fs !== undefined && TICK - fs <= 240) aid = -1; else { if (this.fwdSeen.size >= 64) eraseFirst(this.fwdSeen); this.fwdSeen.set(mm.nc, TICK); } }
          // S1BOUNCE: the FIND came back from the very seat I would forward to: the cell is mine as the head of the row above.
          if (aid >= 0 && aid === mm.from && mm.from !== mm.nc && this.coord.i === 0 && this.coord.r === (t + C - 1) % C) {
            const k = ckey({ pc: 0, r: t, i: 0 });
            if (TICK - (this.healTry.has(k) ? this.healTry.get(k) : -999) > 45) { this.healTry.set(k, TICK); this.w.ADMIT_SITE = 's1-bounce'; this.admit({ pc: 0, r: t, i: 0 }, mm); return true; }
            continue;
          }
          if (aid >= 0 && aid !== id) { const m = newMsg('FIND'); m.nc = mm.nc; m.sgw = mm.sgw; m.sgwCk = mm.sgwCk; m.fsig = mm.fsig; m.gwc = mm.gwc; m.ttl = mm.ttl - 1; m.spread = mm.spread; m.late = mm.late; this.emit(aid, m); this.findAck(mm, this.occGet(ckey(admc)) === aid ? ckey(admc) : ckey(admh), true); return true; }
          // The whole admitter row below is dead too: fall through to the j-loop only with the door's corroboration.
          {
            let anyHint = false, doorHolds = false;
            for (let j = 0; j < C && !doorHolds; j++) {
              const x = this.occGet(ckey({ pc: 0, r: t, i: j })); if (x < 0) continue; anyHint = true;
              for (const g of this.lastGreeters) if (g === x) { doorHolds = true; break; }
            }
            // POSITIVE corroboration only.
            if (doorHolds || !anyHint) { continue; }
          }
        }
        for (let j = 0; j < C; j++) {
          const cell = { pc: 0, r: t, i: j }; const k = ckey(cell);
          // Soft / real occupant reserved. Phantom occ is free for rejoin.
          if (this.l31On() && this.l31Held(k, mm.nc)) continue;   // L31.4
          if (this.cellReserved(k) && !this.l13MateGone(k)) {
            if ((this.l13('L13.36') || this.l33MateArm(k)) && this.coord.pc === 0 && this.occGet(k) >= 0 && !this.firstHandLive(k) && !this.softSitting(k) && (this.greetersAt < 0 || TICK - this.greetersAt > 64) && TICK - this.l13KnockAt >= 32) { this.l13KnockAt = TICK; this.emitRelay(this.genKey); this.trace('L13-KNOCK', id, this.coord, 'door'); }   // L13.36
            continue;
          }
          if (this.courtHeld(k)) { break; }   // L3.14
          // Frontier: block only on real/soft down-child, not phantom occ.
          const dk = ckey(down(cell));
          if (this.cellReserved(dk) && !this.occIsPhantom(dk)) { continue; }
          if (this.softSitting(dk)) { continue; }
          if (this.l33HeirCalled(k)) { skip.v = true; continue; }   // L33.2
          // HEADLESS-ROW admission: the vacated HEAD of a LIVE row is an INTERNAL HOLE owned by its designated healer.
          if (j === 0 && rowLive[t]) continue;
          let adm = (j > 0) ? { pc: 0, r: t, i: 0 } : { pc: 0, r: (t - 1 + C) % C, i: 0 };
          let devArm = null, devGuard = null;
          // A: soft-only primary (sitting-down, no occ yet) is not a FIND peer.
          if (this.softSitting(ckey(adm)) && !this.occ.has(ckey(adm)) && j > 0) {
            const it = this.sitting.get(ckey({ pc: 0, r: t, i: 0 }));
            if (it !== undefined && it.assigner === id) {
              if (TICK - (this.healTry.has(k) ? this.healTry.get(k) : -999) > 45 || (this.healOnly.has(k) && (this.oneRowRoom() || this.nothingBelow(k)))) { this.healOnly.delete(k); this.healTry.set(k, TICK); this.w.ADMIT_SITE = 's1-headless-soft'; this.admit(cell, mm); return true; }
              continue;
            }
          }
          // L7.8: the head of the row above is MY fresh vouch: its designated cell, the head of this row, is mine to seat.
          if (j === 0 && t > 0 && this.softSitting(ckey(adm)) && !this.occ.has(ckey(adm))) {
            const it = this.sitting.get(ckey(adm));
            if (it !== undefined && it.assigner === id && TICK - it.at <= K.SIT_RECHECK) {
              if (TICK - (this.healTry.has(k) ? this.healTry.get(k) : -999) > 45 || (this.healOnly.has(k) && (this.oneRowRoom() || this.nothingBelow(k)))) { this.healOnly.delete(k); this.healTry.set(k, TICK); this.w.ADMIT_SITE = 's1-chain-soft'; this.admit(cell, mm); return true; }
              continue;
            }
          }
          // H-CHAIN: devolve when admitter is not reserved (empty or phantom); prefer first-hand live row-mates.
          if (!this.cellReserved(ckey(adm)) && this.fhEver.has(ckey(adm)) && rowLive[adm.r]) {
            devGuard = freeReason(ckey(adm));
            const oneRow = this.oneRowRoom();
            const d = { pc: 0, r: adm.r, i: 0 };
            for (let dj = 1; dj < C; dj++) { d.i = dj; if (this.cellReserved(ckey(d)) && !this.occIsPhantom(ckey(d)) && !(oneRow && this.darkMate(ckey(d)))) { adm = { pc: d.pc, r: d.r, i: d.i }; devArm = 'rowmate'; break; } }
          }
          // S1 column-clique admission: ONLY when we once knew the primary admitter (s1seen) and it is not reserved.
          if (!this.cellReserved(ckey(adm)) && this.fhEver.has(ckey(adm)) && this.s1seen.has(ckey(adm))) {
            if (!devGuard) devGuard = freeReason(ckey(adm));
            for (let rr = cell.r + 1; rr < C; rr++) {
              const d = { pc: 0, r: rr, i: cell.i };
              if (this.cellReserved(ckey(d)) && !this.occIsPhantom(ckey(d))) { adm = d; devArm = 'col-deeper'; break; }
            }
          }
          if (ckey(this.coord) === ckey(adm)) {   // I am the designated (or devolved) admitter
            // V4 LEDGER GATE: as a vouched-in head I may not admit into MY OWN row before my assigner's SITXFER arrives.
            if (this.coord.i === 0 && cell.r === this.coord.r && !this.rowLedger && TICK - this.seatedAt <= 60) { continue; }
            if (roomTerm(this, 1) && this.occGet(k) !== mm.nc) { const p = this.l9PullCell.get(k); if (p !== undefined && TICK - p < K.L9_PULL + K.CONFIRM_TTL) { continue; } }   // L8.44
            // ...and the cooling never holds a seeker out of ITS OWN cell (mesh.js twin).
            if (this.occGet(k) === mm.nc || TICK - (this.healTry.has(k) ? this.healTry.get(k) : -999) > 45 || (this.healOnly.has(k) && (this.oneRowRoom() || this.nothingBelow(k)))) {
              this.healOnly.delete(k); this.healTry.set(k, TICK);
              if (this.occIsPhantom(k)) { this.occDrop(k, 'phantomclr'); this.live.delete(k); this.s1seen.delete(k); this.kidful.delete(k); this.tlForget(k); }
              if (this.occ.has(k) && this.l13MateGone(k)) { this.occDrop(k, 'mate-unreach'); this.live.delete(k); this.s1seen.delete(k); this.kidful.delete(k); this.tlForget(k); }   // L13.33
              if (devArm) {
                this.w.ADMIT_SITE = 's1-devolved';
              } else this.w.ADMIT_SITE = 's1-designated';
              this.admit(cell, mm); return true;
            }
            l32Declined.push(k); continue;   // admit gate cooling: consider the next cell
          }
          // Hand off to a reachable real admitter. Never emit to a corpse id.
          if (this.l31Direct(cell, mm)) return true;   // L31.1
          if (this.admitterReachable(ckey(adm))) {
            // mesh.js twin: a FIND handed back by the very seat I would hand it to, which I hear first-hand live at another cell, is my echo of a claim it no longer holds.
            { const ek = ckey(adm); const to = this.occGet(ek);
              if (to === mm.from && mm.from !== mm.nc && this.liveElsewhere(to, ek)) { this.occDrop(ek, 'echo-bounce'); this.live.delete(ek); this.liveBy.delete(ek); this.s1seen.delete(ek); this.kidful.delete(ek); this.tlForget(ek); this.serveFind(mm); return true; } }
            // L32.2: the seat I would hand it to is the one that just handed it to me.
            if (this.occGet(ckey(adm)) === mm.from && mm.from !== mm.nc && mm.from !== id && mm.ttl <= K.L32_PINGPONG) { l32Declined.push(k); continue; }
            const m = newMsg('FIND'); m.nc = mm.nc; m.sgw = mm.sgw; m.sgwCk = mm.sgwCk; m.fsig = mm.fsig; m.gwc = mm.gwc; m.ttl = mm.ttl - 1; m.spread = mm.spread; m.late = mm.late; const hto = this.occGet(ckey(adm)); this.emit(hto, m); this.findAck(mm, ckey(adm), true);
            // mesh.js quietHeadAlso twin: in a one-row room the head's right-hand also gets the FIND.
            if (this.hasCoord && this.coord.pc === 0 && this.coord.i >= 2 && this.oneRowRoom()) {
              const hk = ckey({ pc: 0, r: this.coord.r, i: 0 });
              if (ckey(adm) === hk && this.silentFor(hk, K.LONE_GREET_AFTER)) {
                const rk = ckey({ pc: 0, r: this.coord.r, i: 1 }); const x = this.occGet(rk);
                if (x >= 0 && x !== hto && x !== id && this.firstHandLive(rk) && !this.darkMate(rk)) this.emit(x, msg.clone(m));
              }
            }
            return true;
          }
          // DOOR RELAY (A, mesh.js twin): my own row head hears every row head, and its scan hands the FIND on.
          if (this.coord.i !== 0) {
            const hk = ckey({ pc: 0, r: this.coord.r, i: 0 }); const h = this.occGet(hk);
            const rs = this.relaySeen.get(mm.nc); const rfresh = rs !== undefined && TICK - rs[0] < K.RELAY_SEEN;
            if (h >= 0 && h !== id && h !== mm.nc && h !== mm.from && this.firstHandLive(hk) && !this.translost.has(hk) && (!rfresh || rs[1] < K.RELAY_BUDGET)) {
              this.relaySeen.set(mm.nc, rfresh ? [rs[0], rs[1] + 1] : [TICK, 1]); if (this.relaySeen.size > 64) eraseFirst(this.relaySeen);
              const m = newMsg('FIND'); m.nc = mm.nc; m.sgw = mm.sgw; m.sgwCk = mm.sgwCk; m.fsig = mm.fsig; m.gwc = mm.gwc; m.ttl = mm.ttl - 1; m.spread = mm.spread; m.late = mm.late; this.emit(h, m); this.findAck(mm, hk, true); return true;
            }
          }
          // admitter unknown/dead/phantom: keep scanning
        }
      }
      // Only go deep when no ADMISSIBLE S1 free cell remains. Live-row heads are never admission targets. Phantoms count as free.
      let s1admFree = 0;
      for (let t = 0; t < C; t++) {
        // L8.13: once that seeker has been out for RELAY_TTL, count only cells the scan can offer.
        if (t > 0 && ((roomTerm(this, 1) && mm.late) || this.l33RowGate())) {   /* L33.3 */
          let prevFull = true, chain = true;
          for (let j = 0; j < C; j++) { const pk = ckey({ pc: 0, r: t - 1, i: j }); if (this.occ.has(pk)) continue; prevFull = false; const it = this.sitting.get(pk); if (!(it !== undefined && it.assigner === id && TICK - it.at <= K.SIT_RECHECK)) chain = false; }
          if (chain) { const hk = ckey({ pc: 0, r: t - 1, i: 0 }); const hd = this.sitting.get(hk); chain = (this.hasCoord && ckey(this.coord) === hk) || (hd !== undefined && hd.assigner === id && !this.occ.has(hk)); }
          if (!prevFull && !chain) break;
        }
        const liveR = rowLive[t];
        for (let j = 0; j < C; j++) {
          if (j === 0 && liveR) continue; // head of live row: not an admit target
          if (!this.cellReserved(ckey({ pc: 0, r: t, i: j })) && this.courtHeld(ckey({ pc: 0, r: t, i: j }))) break;   // L3.14
          if (!this.cellReserved(ckey({ pc: 0, r: t, i: j })) || this.l13MateGone(ckey({ pc: 0, r: t, i: j }))) {
            if (this.l13('L13.30')) { const dk2 = ckey(down({ pc: 0, r: t, i: j })); if (this.cellReserved(dk2) && !this.occIsPhantom(dk2)) continue; }
            if (this.l33HeirCalled(ckey({ pc: 0, r: t, i: j }))) { continue; }   // L33.2
            if (this.l33NoAdmitter(t, j, rowHeld[j > 0 ? t : (t - 1 + C) % C])) { continue; }   // L33.1
            { const ck5 = ckey({ pc: 0, r: t, i: j }); let dec = false; for (const d5 of l32Declined) if (d5 === ck5) dec = true; if (dec) { continue; } }   // L32.5
            // L13.30: a free home cell over a live child row is its healer's, not the door's.
            s1admFree++;
          }
        }
      }
      // NOTE: this bounce must stay unconditional (it buys the H1-S1 ring-hold).
      if (s1admFree > 0) {
        if (this.holdFind(mm)) return true;   /* L7.5 */
        if (descOn(this)) this.f.descEnd(5, 200 - mm.ttl);
        this.trace('NOROOM', id, this.hasCoord ? this.coord : null, 'nc=%d why=s1admFree', mm.nc); const m = newMsg('NOROOM'); m.gwc = mm.gwc; m.id = id; m.nd = (this.hasCoord ? pcDepth(this.coord.pc) : 0) & 0xff; this.emit(mm.nc, m); return true;
      }
      return false;
    },

    // C++: mesh_seat.inc:Seat::serveFindSpread
    // serveFind: L7.5 SPREAD HOP, a full child row hands the seeker to a row-mate; true when handed
    serveFindSpread(mm, l33Skip) {
      if (mm.tag !== 1 && mm.sh < C && !(l33Skip)) {   /* L33.6 */
        const ol = ownedLinks(this.coord); const n = ol.length; const peers = [];
        for (let q = 0; q < n; q++) {
          if (ol[q].pc !== this.coord.pc || (this.coord.pc !== 0 && ol[q].r !== this.coord.r)) continue; const k = ckey(ol[q]); const x = this.occGet(k); if (x < 0 || x === this.id || x === mm.from || this.translost.has(k)) continue;
          if (this.coord.pc === 0 ? this.firstHandLive(k) : true) peers.push(x);
        }
        if (peers.length) {
          const x = peers[Math.floor(this.rng() * peers.length)]; this.trace('SPREAD', this.id, this.coord, 'nc=%d to=%d hop=%d', mm.nc, x, mm.sh + 1);
          const m = newMsg('FIND'); m.nc = mm.nc; m.sgw = mm.sgw; m.sgwCk = mm.sgwCk; m.fsig = mm.fsig; m.gwc = mm.gwc; m.ttl = mm.ttl - 1; m.spread = mm.spread; m.late = mm.late; m.dk = mm.dk; m.sh = (mm.sh + 1) & 0xff; if (this.l163Close(mm)) m.gwc = true; this.emit(x, m); this.findAck(mm, 0, false, false, m.gwc && mm.from === mm.nc); return true;
        }
      }
      return false;
    },

    // C++: mesh_seat.inc:Seat::serveFindDescend
    // serveFind: descend into my child row (two passes, the depth wall), else hold or NOROOM
    serveFindDescend(mm) {
      const id = this.id;
      // TWO PASSES: pass 0, a hop I have heard from FIRST-HAND; pass 1, any reachable-by-occ hop. THE DEPTH WALL: no FIND downward at depth 12.
      if (pcDepth(this.coord.pc) >= 12 && this.courtSkipped && !this.courtIgnore) { this.courtIgnore = true; this.serveFind(mm); this.courtIgnore = false; return; }   // L3.14
      if (pcDepth(this.coord.pc) >= 12) { if (descOn(this)) this.f.descEnd(2, 200 - mm.ttl); this.trace('NOROOM', id, this.hasCoord ? this.coord : null, 'nc=%d why=depth-wall', mm.nc); const m = newMsg('NOROOM'); m.gwc = mm.gwc; m.id = id; m.nd = (this.hasCoord ? pcDepth(this.coord.pc) : 0) & 0xff; this.emit(mm.nc, m); return; }
      const rc = this.rosterCells(); const idx = this.shufCols();
      // FRONT 3 (measurement only, MESH_DESC=1): classify the candidate set BEFORE the choice is made.
      const dcls = [], dkid = [];
      if (descOn(this)) for (let q = 0; q < C; q++) {
        const rk = ckey(rc[q]); const x = this.occGet(rk);
        dcls[q] = (x < 0 || x === id) ? 0 : (this.firstHandLive(rk) ? 2 : (this.admitterReachable(rk) ? 1 : 3));
        const kf = this.kidful.get(rk); dkid[q] = (kf === undefined) ? 2 : (kf ? 1 : 0);
      }
      for (let pass = 0; pass < 2; pass++)
        for (const q of idx) {
          const rk = ckey(rc[q]); const x = this.occGet(rk); if (x < 0 || x === id) continue;
          // T7 SPREAD-AFTER-NOROOM: on a FIND whose seeker has ALREADY been told NOROOM, a reachable-but-unheard sibling competes in pass 0.
          if (pass === 0 ? (this.firstHandLive(rk) || (mm.spread && this.admitterReachable(rk))) : this.admitterReachable(rk)) {
            if (descOn(this)) this.f.descNote(rc, dcls, dkid, q, pass, pcDepth(this.coord.pc));
            const m = newMsg('FIND'); m.nc = mm.nc; m.sgw = mm.sgw; m.sgwCk = mm.sgwCk; m.fsig = mm.fsig; m.gwc = mm.gwc; m.ttl = mm.ttl - 1; m.spread = mm.spread; m.late = mm.late; m.dk = mm.dk; if (this.l163Close(mm)) m.gwc = true; this.l711Handed(rk, x, m); /* L7.11 */ this.emit(x, m); this.findAck(mm, rk, true, true, m.gwc && mm.from === mm.nc); return;
          }
        }   /* dk rides the descent (mesh.js handOn twin) */
      if (descOn(this)) { this.f.descNote(rc, dcls, dkid, -1, -1, pcDepth(this.coord.pc)); this.f.descEnd(3, 200 - mm.ttl); }
      if (this.holdFind(mm, true, true)) return;   // L7.5
      if (this.courtSkipped && !this.courtIgnore) { this.courtIgnore = true; this.serveFind(mm); this.courtIgnore = false; return; }   // L3.14
      this.trace('NOROOM', id, this.hasCoord ? this.coord : null, 'nc=%d why=deep-dead-end', mm.nc);
      const m = newMsg('NOROOM'); m.gwc = mm.gwc; m.id = id; m.nd = (this.hasCoord ? pcDepth(this.coord.pc) : 0) & 0xff; this.emit(mm.nc, m);
    },

    // C++: mesh_seat.inc:Seat::holdFind
    // L7.5 (I10): THE HELD FIND. Nothing here admits: a held FIND is a FIND served later.
    holdFind(mm, deep = false, last = false) {
      if (mm.tag === 1 || mm.ttl <= 0 || mm.nc < 0 || mm.nc === this.id || !this.hasCoord || this.state !== 3) return false;
      let filling = false;
      if (!deep && this.coord.pc === 0) { if (this.coord.i === 0 && !this.rowLedger) filling = true; else for (const ek of this.sitting.keys()) if (ckPc(ek) === 0) { filling = true; break; } }
      if (deep && this.TICK - this.childHeadAt <= K.L7_HOLD && this.rowLedgerAt < this.childHeadAt) filling = true;
      if (!filling) return false;
      if (this.reserving) { this.heldAgain = true; return true; }
      if (this.held.length >= 64) return false;
      if (deep && !last && this.l33HoldFull(mm.nc)) { return false; }   // L33.8
      this.held = this.held.filter((h) => h.m.nc !== mm.nc);   // one held FIND per seeker (a re-ask replaces it)
      this.trace('HOLD', this.id, this.coord, 'nc=%d', mm.nc);
      { const h = state.newStruct('Held'); h.m = msg.clone(mm); h.at = this.TICK; h.deep = deep; this.held.push(h); }
      this.findAck(mm); this.f.wake(this.id); return true;   // L16.3
    },

    // C++: mesh_seat.inc:Seat::serveHeld
    serveHeld() {
      if (!this.held.length || !this.hasCoord || this.state !== 3) return;
      const v = this.held; this.held = [];
      for (const h of v) {
        if (this.TICK - h.at > K.L7_HOLD) { this.trace('NOROOM', this.id, this.coord, 'nc=%d why=held-out', h.m.nc); const m = newMsg('NOROOM'); m.gwc = h.m.gwc; m.id = this.id; m.nd = pcDepth(this.coord.pc) & 0xff; this.emit(h.m.nc, m); continue; }
        this.reserving = true; this.heldAgain = false; this.findNc = h.m.nc; const m = msg.clone(h.m); this.serveFind(m); this.findNc = -1; this.reserving = false;
        if (this.heldAgain) this.held.push(h);
      }
      if (this.held.length) this.f.wake(this.id);
    },

    // C++: mesh_seat.inc:Seat::serveReclaim
    serveReclaim(m) {
      const TICK = this.TICK, id = this.id;
      if (this.hasCoord && this.state === 3 && m.id >= 0 && m.id !== id && m.ck === ckey(this.coord)) {   // L3.10.4: I am the hole's mover and already sit in the returner's old cell: healing wins
        const p = this.pinned.get(m.id); const c = unckey(m.ck);
        const vac = this.moving ? this.oldCk : ((this.leaseUntil >= 0 && TICK <= this.leaseUntil) ? this.leaseCk : 0);
        if (p !== undefined && p === m.tok && vac && vac !== m.ck) { this.rcHanded.set(m.ck, [m.id, TICK]); return; }
        { this.trace('RECLAIM-REFUSED', id, c, 'id=%d why=%s', m.id, (p === undefined || p !== m.tok) ? 'token' : 'healed'); const r = newMsg('RECLAIMNO'); r.nc = m.id; r.tag = 1; this.emit(m.id, r); return; }
        this.rcBeside(m.id, m.ck, vac); return;
      }
      if (!this.hasCoord || this.state !== 3 || m.id < 0 || m.id === id || !cellOk(m.ck) || !this.ownedLinkCell(m.ck)) return;
      const c = unckey(m.ck); const p = this.pinned.get(m.id); const ok = p !== undefined && p === m.tok;
      const cur = this.occGet(m.ck); const held = cur === m.id; const mm = this.memo.get(m.ck);
      const remembered = cur < 0 && mm !== undefined && mm.id === m.id && TICK - mm.at <= K.LEASE_T;
      if (!ok || !(held || remembered)) { this.trace('RECLAIM-REFUSED', id, c, 'id=%d why=%s', m.id, !ok ? 'token' : (cur >= 0 ? 'held-by-other' : 'no-memory')); const r = newMsg('RECLAIMNO'); r.nc = m.id; this.emit(m.id, r); return; }
      this.rcHanded.set(m.ck, [m.id, TICK]);   // L3.10.4
      const nbrs = []; const ol = ownedLinks(c); const n = ol.length; for (let i = 0; i < n; i++) { const x = this.occGet(ckey(ol[i])); if (x >= 0 && x !== m.id) nbrs.push({ k: ckey(ol[i]), v: x }); }
      { const dk = ckey(down(c)); let has = false; for (const kv of nbrs) if (kv.k === dk) has = true; const h = this.childOf.get(m.ck); if (!has && h !== undefined && h >= 0 && h !== m.id) nbrs.push({ k: dk, v: h }); }   // L3.10.6
      const r = newMsg('RECLAIMED'); r.nc = m.id; r.coord = co(c); r.owner = id; r.nbrs = nbrs; r.pp = id; r.ppAt = TICK;
      { const rm = this.relMark.get(m.id); if (held && rm !== undefined && TICK - rm <= K.LEASE_T - 4 * K.RC_WAIT - 10) r.tag = 2; }   // L3.11
      this.emit(m.id, r);
      this.trace('RECLAIMED', id, c, 'id=%d %s%s', m.id, held ? 'leased' : 'remembered', r.tag === 2 ? ' reload' : '');
    },

    // C++: mesh_seat.inc:Seat::rcBeside
    // L3.10.4: the returner `who` gets the seat `vac` I left by healing its old cell `old`.
    rcBeside(who, old, vac) {
      const vc = unckey(vac), c = unckey(old); const nbrs = []; const ol = ownedLinks(vc); const n = ol.length;
      for (let i = 0; i < n; i++) { const x = (ckey(ol[i]) === ckey(this.coord)) ? this.id : this.occGet(ckey(ol[i])); if (x >= 0 && x !== who) nbrs.push({ k: ckey(ol[i]), v: x }); }
      const r = newMsg('RECLAIMED'); r.nc = who; r.coord = co(vc); r.owner = this.id; r.nbrs = nbrs; r.pp = this.id; r.ppAt = this.TICK; r.tag = 1; r.ck = old; this.emit(who, r);
      { const rowFree = this.f.fabricFreeCells(c.pc, c.r), secFree = this.f.fabricFreeCells(c.pc, -1);
        this.trace('RECLAIM-BESIDE', this.id, vc, 'id=%d old=%s rowfree=%d secfree=%d', who, coordStr(c), rowFree, secFree); }
    },

    // C++: mesh_seat.inc:Seat::tryReclaim
    // The returner at the door: the HOME roster names my old cell's rook neighbours; each hears my proof over the mesh.
    tryReclaim(ro, greeter = -1) {
      const id = this.id; const lv = this.w.lv;
      const oc = unckey(this.oldCell - 1); const ol = ownedLinks(oc); const n = ol.length; let sent = 0;
      for (const e of ro) {
        if (e.v < 0 || e.v === id) continue; let nb = false; for (let i = 0; i < n; i++) if (ckey(ol[i]) === e.k) { nb = true; break; } if (!nb && !(this.rcRound2 && e.k === this.oldCell - 1)) continue;   // L3.10.6
        const m = newMsg('RECLAIM'); m.ck = this.oldCell - 1; m.id = id; m.tok = fabricToken(lv, id); this.emit(e.v, m); sent++;
      }
      // L3.11: a deep cell's neighbours are not in the HOME roster: the proof travels the mesh as a routed frame.
      if (greeter >= 0 && oc.pc !== 0) {
        let routed = 0;
        for (let i = 0; i < n; i++) {
          if (ol[i].pc === 0) continue; let inRoster = false; for (const e of ro) if (e.k === ckey(ol[i]) && e.v >= 0) { inRoster = true; break; } if (inRoster) continue;
          const m = newMsg('RECLAIM'); m.ck = this.oldCell - 1; m.id = id; m.tok = fabricToken(lv, id); m.routing = true; m.rdst = co(ol[i]); m.rfinal = -1; m.rttl = 64; m.rvia = id; this.emit(greeter, m); routed++;
        }
        if (routed) { this.trace('RECLAIM-ROUTED', id, oc, 'via=%d cells=%d', greeter, routed); sent += routed; }
      }
      if (sent) this.trace('RECLAIM', id, oc, 'to=%d neighbours', sent);
      return sent > 0;
    },

    // C++: mesh_seat.inc:Seat::reseatViaRoster
    reseatViaRoster() {
      const id = this.id;
      this.l13ReqN++; if (this.l815N > 0) { for (let i = 0; i < this.l815N; i++) { const y = newMsg('YIELD'); y.ck = this.l815Ck[i]; y.id = id; y.nc = this.l815Prev[i]; this.emit(this.l815To[i], y); } this.l815N = 0; }
      this.w.lv.MOVES++; this.f.fabricNoteReseat(id); this.trace('RESEAT', id, this.hasCoord ? this.coord : null, '');
      if (this.hasCoord) {
        const ol = ownedLinks(this.coord); const n = ol.length; const seen = new Set();
        for (let k = 0; k < n; k++) { const x = this.occGet(ckey(ol[k])); if (x >= 0 && x !== id && !seen.has(x)) { seen.add(x); const m = newMsg('LEAVE'); m.ck = ckey(this.coord); m.id = id; m.child = this.l1DeepKid(); this.emit(x, m); } }
        const o = this.ownerCoord(); if (o) { const oid = this.occGet(ckey(o)); if (oid >= 0 && oid !== id && !seen.has(oid)) { const m = newMsg('LEAVE'); m.ck = ckey(this.coord); m.id = id; m.child = this.l1DeepKid(); this.emit(oid, m); } }
      }   // V7b (H4): the owner too (mesh.js leaveOwner twin)
      if (this.hasCoord) { this.live.delete(ckey(this.coord)); this.leftCk = ckey(this.coord); this.leftAt = this.TICK; }   // (mesh.js twin, see requeue)
      this.f.relayUnlist(id);   // L16.4
      this.hasCoord = false; this.occ.clear(); this.ledgerSeen.clear(); this.s1seen.clear(); this.holeSince.clear(); this.byeAt.clear(); this.tlClear(); this.authClear(); this.drainAt = 0; this.seatTries = 0;
      // L16.4: the door lists the seated Section-1 seats now; under L16.4 a re-entry knocks.
      if (this.f.l164Of(this)) { this.haveRoster = false; this.roster = []; this.join(); return; }
      if (this.l32RosterStale() && this.resumeAsk()) return;   // L32.1
      const t = (this.haveRoster && this.roster.length) ? this.pickRoster() : -1; if (t >= 0) this.askSeat(t); else this.join();
    },

    // C++: mesh_seat.inc:Seat::answerDoor
    answerDoor(nh, rfinal, m) {
      if (!this.f.fabricDoors() || rfinal < 0 || rfinal === this.id || !this.hasCoord || this.state !== 3) return false;
      if (!(m.t === 'NOROOM' || m.t === 'PLACE' || m.t === 'FINDACK')) return false;
      if (nh >= 0 && this.f.fabricLinkState(this.id, nh) === E.LS_OPEN) return false;   // (route()/routeStep() never offer a frame that already rides an answer door (adoor))
      this.trace('L16.3-DOOR', this.id, this.coord, 'nc=%d mt=%d why=%s', rfinal, mtNum(m.t), nh < 0 ? 'nohop' : 'hop-not-open');
      return true;
    },
  });

  // C++: mesh.cpp:Seat::ppKey (also exported by seat.js; kept local so this file needs nothing but the Seat)
  function ppKeyOf(k, x) { return seatM.ppKey(k, x); }

  const api = Object.freeze({ cellOk, ownerCoordOf, coordStr, l4Pack, fabricToken });
  GifOS.meshEntry = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
