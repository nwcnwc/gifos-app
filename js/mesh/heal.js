/*
 * heal.js: healing, who moves into a hole and the move itself, and the mass-leave calls (C++: mesh_heal.inc),
 * ported line for line from the 0.9.25 sim. Methods are added to the Seat with Seat.unit(); the static
 * functions of the C++ file are module functions (the ones another unit calls are also Seat.free()).
 *
 * Port conventions used here (see seat.js header): a C++ function that returns bool and fills an out-parameter
 * returns the out value, or null for false (l13Anchor, l13Top, l13HomeWit, l14Branch, rmWitness). The in-out
 * vector<KV>& nbrs of rmName and doMove is changed in place (the array keeps its identity). A Coord or a vector
 * put into a Msg is copied.
 *
 * Calls this unit makes into other units, by the C++ name: Seat methods (occGet ... in seat.js; take, announce,
 * requeue, phoneHome, translostConfirmed, routeToProbe, liveElsewhere, islandHeirGone, ownedLinkCell, l4Busy,
 * otherRing, l919Rollback, l920Note, l920Deaf, l33WordDenied, l33WordMine,
 * l33WordRegrant); free functions through FREE (cellOk, ownerCoordOf, coordStr, l35HandOn, l35Hinted,
 * bumpMoves); the fabric through this.f. fabricDialUplink(me, x, refer): refer is an array the fabric leaves as given (the sim: (void)refer)
 * place, the call returns the bool.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const RCD = ((n) => ({ L35_4_OFF: n('L35_4_OFF'), L17_3_1_OFF: n('L17_3_1_OFF'), L17_4_OFF: n('L17_4_OFF'), L35_5_OFF: ((isNode && typeof process !== 'undefined' && process.env && process.env.MESH_L35_5_OFF === '0') ? 0 : 1) }))((k) => ((isNode && typeof process !== 'undefined' && process.env && process.env['MESH_' + k] === '1') ? 1 : 0));   // the sim's build-time switches of the realcheck dead-dial laws (mesh.cpp L35_4_OFF ...): MESH_<name>=1 under node; a page runs the laws
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const { ins, eraseFirst } = req('./util.js', 'meshUtil');
  const hash = req('./hash.js', 'meshHash');
  const SEAT = req('./seat.js', 'meshSeat');
  const { Seat, FREE, roomTerm } = SEAT;

  const K = C_.consts, E = C_.enums;
  const { ckey, ckPc, unckey, ownedLinks, rowMates, down, up, pcDepth, cc } = topo;
  const C = topo.C;
  const { LS_OPEN, LS_DIALING, LS_CLOSED } = E;
  const unck = unckey;
  // the sim's #define L48_1_OFF in mesh.cpp (a build-time switch): MESH_L48_1_OFF=1 under node, read once at load; a page always runs the law
  const L48_1_OFF = (isNode && typeof process !== 'undefined' && process.env && process.env.MESH_L48_1_OFF === '1') ? 1 : 0;
  const newMsg = (t) => msg.newMsg(t);
  const kvs = (a) => a.map((e) => ({ k: e.k, v: e.v }));   // a vector<KV> copy
  const cell = (pc, r, i) => ({ pc, r, i });
  // A FINDLEAF frame: the hole, a copy of the neighbours, the hops left, the tag.
  const flMsg = (hole, nbrs, ttl, tag = 0) => { const m = newMsg('FINDLEAF'); m.hole = cc(hole); m.nbrs = kvs(nbrs); m.ttl = ttl; m.tag = tag; return m; };

  // ---- LAW L1: one mover per hole --------------------------------------------------------------------------
  // C++: mesh_heal.inc:l1RowEmpty
  function l1RowEmpty(s, hole) {
    for (let j = 0; j < C; j++) { if (j === hole.i) continue; const k = ckey(cell(hole.pc, hole.r, j)); const x = s.occGet(k); if (x >= 0 && x !== s.id) return false; }
    return true;
  }
  // C++: mesh_heal.inc:l1HeirFailed
  function l1HeirFailed(s, hole) {
    if (s.l13('L13.5')) { const k = ckey(hole); const hi = s.l1ByeKidId.get(k); if (hi !== undefined && hi >= 0 && s.byeAt.has(k) && s.liveElsewhere(hi, k)) return true; }
    if (s.l13('L13.5')) { const k = ckey(hole); const b = s.byeAt.get(k); const hc = s.l13HeirCallAt.get(k); if (b !== undefined && s.now() - b > 24 && s.now() - b <= K.LEASE_T && (hc === undefined || hc < b)) return true; }
    const it = s.l1Defer.get(ckey(hole)); return it !== undefined && s.now() - it > K.LEASE_T && s.now() - it <= 3 * K.LEASE_T;
  }
  // C++: mesh_heal.inc:l1RightCell
  function l1RightCell(s, hole) {
    if (s.occGet(ckey(down(hole))) >= 0) return 0;
    if (s.hasDownChild(hole) && !l1HeirFailed(s, hole)) return 0;
    for (let j = hole.i + 1; j < C; j++) {
      const k = ckey(cell(hole.pc, hole.r, j)); if (s.occGet(k) >= 0 || (s.hasCoord && ckey(s.coord) === k)) return k;
      const by = s.byeAt.get(k); if (by === undefined || s.now() - by > K.LEASE_T) return 0;
    }
    return 0;
  }
  // C++: mesh_heal.inc:l1ColCell
  function l1ColCell(s, hole) {
    if (hole.pc !== 0) return 0;
    if (s.occGet(ckey(down(hole))) >= 0) return 0;
    if (s.hasDownChild(hole) && !l1HeirFailed(s, hole)) return 0;
    for (let rr = hole.r + 1; rr < C; rr++) {
      const k = ckey(cell(0, rr, hole.i)); if (s.occGet(k) >= 0 || (s.hasCoord && ckey(s.coord) === k)) return k;
      const by = s.byeAt.get(k); if (by === undefined || s.now() - by > K.LEASE_T) return 0;
    }
    return 0;
  }
  // C++: mesh_heal.inc:l9RoomAllHome
  function l9RoomAllHome(s) {
    if (!s.hasCoord || s.coord.pc !== 0 || s.state !== 3) return false;
    if (s.rootDec.at < 0 || s.rootDec.part || s.rootDec.n <= 0) return false;
    if (s.hasChildren()) return false;
    let home = 0;
    for (let q = 0; q < C * C; q++) {
      const cc_ = cell(0, Math.floor(q / C), q % C); const k = ckey(cc_);
      if (s.occGet(k) >= 0) home++;
      const kf = s.kidful.get(k); if (kf !== undefined && kf) return false;
      const ch = s.childOf.get(k); if (ch !== undefined && ch >= 0) return false;
    }
    return s.rootDec.n <= home;
  }
  // C++: mesh_heal.inc:l9PullSmall
  function l9PullSmall(s) {
    if (s.rootDec.at < 0 || s.rootDec.part || s.rootDec.n <= 0) return false;
    return s.rootDec.n <= C * C + 1;
  }
  // C++: mesh_heal.inc:l9PullHold
  function l9PullHold(s) {
    if (s.rootDec.part) return true;
    if (s.rootDec.at < 0 || s.rootDec.n <= 0) return s.l9GrowN < 0;
    if (s.l9GrowAt < 0 && s.l9GrowN > 0) {   // waiting out a multi-seat drop
      if (s.rootDec.n >= s.l9GrowN) { s.l9GrowN = s.rootDec.n; s.l9GrowAt = s.now() | 0; return true; }
      const dropAt = -s.l9GrowAt - 1;
      if (s.now() - dropAt < 2 * K.DIG_TTL) return true;
      s.l9GrowN = s.rootDec.n; s.l9GrowAt = s.now() | 0;
      return false;
    }
    if (s.l9GrowN < 0 || s.rootDec.n > s.l9GrowN) { s.l9GrowN = s.rootDec.n; s.l9GrowAt = s.now() | 0; return true; }
    if (s.rootDec.n === s.l9GrowN) return true;   // still on the plateau: do not refresh the start
    if (s.now() - s.l9GrowAt < 2 * K.DIG_TTL) return true;
    const drop = s.l9GrowN - s.rootDec.n;
    if (drop <= 1) { s.l9GrowN = s.rootDec.n; s.l9GrowAt = s.now() | 0; return true; }
    s.l9GrowAt = -(s.now() | 0) - 1;
    return true;
  }
  // C++: mesh_heal.inc:l1MoverCell
  // C++: mesh_heal.inc:l1VacNote
  function l1VacNote(s, k) { const v = s.l1Vacated.get(k); return v !== undefined && s.now() - v <= 3 * K.LEASE_T && s.occGet(k) < 0; }
  function l1MoverCell(s, hole) {
    if (hole.pc !== 0) return l1RightCell(s, hole);
    if (l1VacNote(s, ckey(hole))) return 0;
    if (!l9RoomAllHome(s) && !l9PullSmall(s)) {
      const p = s.l9PullCell.get(ckey(hole));
      if (p !== undefined && s.now() - p < K.L9_PULL && s.occGet(ckey(down(hole))) < 0 && !s.hasDownChild(hole)) return 0;
    }
    switch (1) {
      case 0: return 0;
      case 1: return l1RightCell(s, hole);
      case 2: { const r = l1RightCell(s, hole); return r || l1ColCell(s, hole); }
      default: return l1ColCell(s, hole);
    }
  }
  // C++: mesh_heal.inc:l1HasMover
  function l1HasMover(s, hole) { return s.hasDownChild(hole) || l1MoverCell(s, hole) !== 0; }

  // ---- L11: witnesses --------------------------------------------------------------------------------------
  // The witness cells of a hole, for a probe.
  // C++: mesh_heal.inc:rmWitCells
  function rmWitCells(hole) {
    const out = [];
    if (hole.pc === 0) { for (let j = 0; j < C; j++) if (j !== hole.i) out.push(cell(0, hole.r, j)); for (let r = 0; r < C; r++) if (r !== hole.r) out.push(cell(0, r, hole.i)); return out; }
    if (hole.i !== 0) { out.push(cell(hole.pc, hole.r, 0)); return out; }
    const oc = FREE.ownerCoordOf(hole); if (oc) out.push(oc);
    return out;
  }

  // ---- L13: the chains of the mass-leave calls -------------------------------------------------------------
  // The ring cells of H: its witness cell first, then its row mates, then the owner of its row.
  // C++: mesh_heal.inc:l13Ring
  function l13Ring(H) {
    const out = []; let w;
    if (H.pc === 0) { for (let j = 0; j < C; j++) if (j !== H.i) out.push(cell(0, H.r, j)); for (let r = 0; r < C; r++) if (r !== H.r) out.push(cell(0, r, H.i)); return out; }
    if (H.i === 0) { if ((w = up(H))) out.push(w); } else out.push(cell(H.pc, H.r, 0));
    for (let j = 1; j < C; j++) { if (j === H.i) continue; out.push(cell(H.pc, H.r, j)); }
    const o = FREE.ownerCoordOf(H); if (o) { let has = false; for (const c of out) if (ckey(c) === ckey(o)) has = true; if (!has) out.push(o); }
    return out;
  }
  // The witness cell of a cell (none for a home cell: its rook is its ring); the Coord, or null.
  // C++: mesh_heal.inc:l13Witness
  function l13Witness(H) { if (H.pc === 0) return null; if (H.i === 0) return up(H); return cell(H.pc, H.r, 0); }
  // C++: mesh_heal.inc:L13_CHAIN_MAX
  const L13_CHAIN_MAX = K.L13_CHAIN_MAX;
  // My witness chain: my owner cell, its witness cell, that cell's witness (s: the seat, for the L13 lever).
  // C++: mesh_heal.inc:l13Chain
  function l13Chain(s, H) { const out = []; let c = H; const cap = s.l13('L13.15') ? L13_CHAIN_MAX : 4; for (let l = 0; l < cap; l++) { out.push(c); const w = l13Witness(c); if (!w) break; c = w; } return out; }
  // My vertical line: my anchor cell and, while it is a head cell, the owner cells above it.
  // C++: mesh_heal.inc:l13Line
  function l13Line(H) { const out = []; let c = H; for (let l = 0; l < 4; l++) { out.push(c); if (c.i !== 0) break; const w = up(c); if (!w) break; c = w; } return out; }

  Seat.free({ l1RowEmpty, l1HeirFailed, l1MoverCell, l1HasMover, l13Ring, l13Witness, l13Chain });

  Seat.unit('mesh_heal.inc', {
    // L9.17: a head densifies only on vacancy it holds (its C++ definition is in mesh_seat.inc; no other job owns it).
    // C++: mesh_seat.inc:Seat::l917Free
    l917Free(cell_) {
      const k = ckey(cell_); const b = this.byeAt.get(k); if (b !== undefined && this.TICK - b <= K.LEASE_T) return true;
      if (this.translostConfirmed(k)) return true;
      return this.TICK - this.l917At >= K.LEASE_T;
    },
    // C++: mesh_heal.inc:Seat::l1DeepKid
    l1DeepKid() { return (this.hasCoord && this.coord.pc !== 0) ? this.occGet(ckey(down(this.coord))) : -1; },
    // C++: mesh_heal.inc:Seat::l1KidHeals
    l1KidHeals(hole) {
      if (hole.pc === 0) return false; const k = ckey(hole); const it = this.l1ByeKid.get(k);
      if (it !== undefined && this.l13('L13.5')) { const hi = this.l1ByeKidId.get(k); if (hi !== undefined && hi >= 0 && this.liveElsewhere(hi, k)) return false; }
      if (it !== undefined && this.l13('L13.5') && this.TICK - it > 24) { const hc = this.l13HeirCallAt.get(k); if (hc === undefined || hc < it) return false; }
      return it !== undefined && this.TICK - it <= K.LEASE_T && this.occGet(k) < 0;
    },

    // ---- L11: a mover arrives knowing a live row-mate ----
    // C++: mesh_heal.inc:Seat::rmWitCell
    rmWitCell(hole, k) {
      if (!FREE.cellOk(k) || k === ckey(hole)) return false; const c = unck(k);
      if (hole.pc === 0) return c.pc === 0 && (c.r === hole.r || c.i === hole.i);
      if (hole.i !== 0) return k === ckey(cell(hole.pc, hole.r, 0));
      const oc = FREE.ownerCoordOf(hole); return !!oc && ckey(oc) === k;
    },
    // The witnesses I know of for a hole: [{k, v}], or null when there is none (C++: bool + vector<KV>& out).
    // C++: mesh_heal.inc:Seat::rmWitness
    rmWitness(hole, excl, maxN = 2) {
      const out = []; const hk = ckey(hole);
      const add = (c) => {
        if (out.length >= maxN) return; const k = ckey(c); if (k === hk) return; let x;
        if (this.hasCoord && this.state === 3 && !this.moving && ckey(this.coord) === k) x = this.id;
        else {
          x = this.occGet(k); const byeRook0 = this.rmVertical && hole.pc === 0 && !this.occ.has(hk);
          if (x < 0 && byeRook0) { const cz = this.cousins.get(k); if (cz !== undefined) x = cz; }
          if (x < 0 || x === this.id || this.translost.has(k)) return;
          const pa = this.probeAck.get(k);
          const ownerK = this.rmNamedOwner && !this.u2Hot && !this.headE1Dn && hole.pc !== 0 && hole.i === 0 && !this.byeAt.has(k) && !(this.ownDeadCk === k && this.TICK - this.ownDeadAt <= K.LEASE_T);
          const upv = this.unpAt.get(x); const beats = upv !== undefined && this.TICK - upv <= 16;
          if (!this.firstHandLive(k) && !(pa !== undefined && this.TICK - pa <= 16) && !(hole.pc === 0 && this.TICK - this.rmHomeAt <= 16) && !ownerK && !beats && !byeRook0) return;
        }
        if (x === excl) return; for (const e of out) if (e.v === x) return; out.push({ k, v: x });
      };
      for (const wc of rmWitCells(hole)) add(wc);
      if (out.length < maxN && this.u2Id >= 0 && this.u2Id !== this.id && this.u2Id !== excl && this.u2Ck && this.TICK - this.u2AckAt <= 16 && this.rmWitCell(hole, this.u2Ck)) { let has = false; for (const e of out) if (e.v === this.u2Id) has = true; if (!has) out.push({ k: this.u2Ck, v: this.u2Id }); }
      if (out.length === 0 && hole.pc !== 0 && hole.i === 0) {
        const oc = FREE.ownerCoordOf(hole);
        if (oc) {
          const ok = ckey(oc); const ob = this.byeAt.get(ok);
          const ownVerdict = this.ownDeadCk === ok && this.TICK - this.ownDeadAt <= K.LEASE_T && this.occGet(ok) === this.ownDeadSeen && !this.firstHandLive(ok) && (() => { const af = this.rmAskFirst.get(hk); return af !== undefined && this.TICK - af >= K.OWNDEADWIT_ASKS; })();
          const gone = ((this.occGet(ok) < 0 || ownVerdict) && ((ob !== undefined && this.TICK - ob <= K.LEASE_T) || (this.ownDeadCk === ok && this.TICK - this.ownDeadAt <= K.LEASE_T) || this.translostConfirmed(ok)));
          if (gone) for (let j = 1; j < C; j++) add(cell(hole.pc, hole.r, j));
        }
      }
      if (out.length === 0 && this.l13('L13.3') && hole.pc !== 0 && hole.i !== 0) {
        const rk = ckey(cell(hole.pc, hole.r, 0)); const rb = this.byeAt.get(rk);
        if (this.occGet(rk) < 0 && rb !== undefined && this.TICK - rb <= K.LEASE_T) { for (let j = 1; j < C; j++) if (j !== hole.i) add(cell(hole.pc, hole.r, j)); const oc2 = FREE.ownerCoordOf(hole); if (oc2) add(oc2); }
      }
      if (out.length < maxN && hole.pc !== 0 && hole.i === 0 && this.vouchOwner >= 0 && this.vouchOwner !== this.id && this.vouchOwner !== excl && this.TICK - this.ownVouchAt <= 16 && this.rmWitCell(hole, this.vouchOCk) && !(this.l13('L13.5') && (() => { const b = this.byeAt.get(hk); return b !== undefined && this.ownVouchAt <= b + 2; })())) {
        let has = false; for (const e of out) if (e.v === this.vouchOwner) has = true; if (!has) out.push({ k: this.vouchOCk, v: this.vouchOwner });
      }
      return out.length ? out : null;
    },
    // C++: mesh_heal.inc:Seat::rmRingAlone
    rmRingAlone(hole) {
      for (let r = 0; r < C; r++) for (let i = 0; i < C; i++) { const k = ckey(cell(0, r, i)); if (k === ckey(hole)) continue; if (this.hasCoord && ckey(this.coord) === k) continue; if (this.occGet(k) >= 0) return false; }
      return !this.hasChildren();
    },
    // C++: mesh_heal.inc:Seat::rmAloneAsked
    rmAloneAsked(hole) {
      if (this.earShut()) return false;   // L8.48: unanswered probes prove nothing while my own ear is shut
      const f = this.rmAskFirst.get(ckey(hole)); if (f === undefined || (this.deafFloor >= 0 && f < this.deafFloor)) return false;
      return this.TICK - f >= 24 && this.rmRingAlone(hole);
    },
    // C++: mesh_heal.inc:Seat::rmRetry
    rmRetry() {
      if (this.rmPend.size === 0) return;
      for (const [k, h] of [...this.rmPend]) {
        const f = this.rmAskFirst.get(k);
        if (this.occGet(k) >= 0 || f === undefined || this.TICK - f > 240) { this.rmPend.delete(k); continue; }
        if (this.TICK - f >= 24) { this.rmPend.delete(k); this.healTry.delete(k); this.healAt = -1000; this.heal(h); continue; }
      }
    },
    // C++: mesh_heal.inc:Seat::rmAsk
    rmAsk(hole) {
      const wc = rmWitCells(hole); let sent = 0;
      for (let q = 0; q < wc.length && sent < 2; q++) { const k = ckey(wc[q]); if (this.hasCoord && ckey(this.coord) === k) continue; this.routeToProbe(wc[q]); sent++; }
      this.trace('L11-ASK', this.id, hole, 'probes=%d', sent);
    },
    // A namer's gate: no witness I hear first-hand, no mover; else the witnesses go first in nbrs (changed in place).
    // C++: mesh_heal.inc:Seat::rmName
    rmName(hole, excl, nbrs) {
      const w = this.rmWitness(hole, excl); if (!w) return false;
      const rest = []; for (const e of nbrs) { let dup = false; for (const x of w) if (x.k === e.k) dup = true; if (!dup) rest.push(e); }
      const all = w.concat(rest); nbrs.length = 0; for (const e of all) nbrs.push(e); return true;
    },
    // C++: mesh_heal.inc:Seat::rmArrival
    rmArrival() { return this.hasCoord && this.state === 3 && (this.moving || this.TICK - this.rmBornAt <= K.L11_ARRIVE); },
    // C++: mesh_heal.inc:Seat::rmRowMaybeLive
    rmRowMaybeLive() {
      if (this.TICK - this.rmHistAt <= K.LEASE_T + 16) return true;
      if (this.rowLedgerAt >= 0 && this.TICK - this.rowLedgerAt <= K.LEASE_T + 16) { const rc = this.rosterCells(); for (let c = 1; c < C; c++) if (this.occGet(ckey(rc[c])) >= 0) return true; }
      return false;
    },
    // C++: mesh_heal.inc:Seat::rmRival
    rmRival(rival, rivalArr, why) {
      if (!this.rmArrival() || rival < 0 || rival === this.id) return false;
      const mine = this.TICK - this.rmBornAt; const lose = rivalArr < 0 || rivalArr > K.L11_ARRIVE || rivalArr > mine || (rivalArr === mine && rival < this.id);
      if (!lose) return false;
      this.trace('L11-YIELD', this.id, this.coord, 'rival=%d arr=%d mine=%lld why=%s', rival, rivalArr, mine, why);
      if (this.moving) { this.rbWhy = 'rival'; this.rollbackMove(); } else this.requeue('L11-yield');
      return true;
    },

    // ---- the heal ----
    // C++: mesh_heal.inc:Seat::heal
    heal(hole) {
      const id = this.id;
      { const hk = ckey(hole); if (this.darkHold.has(hk) && this.occGet(hk) < 0) this.darkHold.delete(hk); }
      if (this.darkHold.has(ckey(hole))) { return; } this.mvWhy = 'heal';
      if (this.l1KidHeals(hole) && ckey(down(hole)) !== ckey(this.coord)) { return; }
      if (!this.hasCoord || this.state !== 3 || this.TICK - this.healAt < 12) { return; }
      if (this.l13('L13.4')) { const hh = this.l13HeldAt.get(ckey(hole)); if (hh !== undefined && this.TICK - hh <= 32) { return; } }
      if (hole.pc === 0 && this.TICK - this.seatedAt < 60) { this.l383Due.set(ckey(hole), (this.seatedAt + 60) | 0); return; }   // L38.3: the goodbye is read again when my view comes of age (gaps2.js)   // L1.1
      this.lastChurn = this.TICK | 0;
      let l13Redir = false;
      if (this.l13('L13.5') && hole.pc !== 0 && hole.i === 0 && this.coord.pc === hole.pc && this.coord.r === hole.r && this.coord.i !== 0) {
        const T = this.l13Top();
        if (T) { hole = T; l13Redir = true; this.trace('L13-TOP', id, hole, 'designee'); }
        else {
          let sub = this.hasChildren();
          for (let j = 1; j < C && !sub; j++) { const c = cell(this.coord.pc, this.coord.r, j); if (this.hasDownChild(c)) { const kf = this.kidful.get(ckey(c)); if (this.occGet(ckey(c)) >= 0 || (kf !== undefined && kf)) sub = true; } }
          const b = this.byeAt.get(ckey(hole)); if (!sub && b !== undefined && this.TICK - b < 8 * pcDepth(this.coord.pc) + 8) return;
        }
      }
      const hk = ckey(hole); if (this.TICK - (this.healTry.has(hk) ? this.healTry.get(hk) : -999) < 45) { return; }
      this.rmNamedOwner = !(this.l13('L13.5') && hole.pc !== 0 && hole.i === 0);   // (the C++ guard clears it on every exit)
      try {
        { const w = this.rmWitness(hole, -1); if (!w) { if (this.rmAskDue(hk)) this.rmAsk(hole); return; } }
        this.healAt = this.TICK | 0; this.healTry.set(hk, this.TICK | 0); this.healOnly.add(hk);
        if (hole.pc === 0 && this.childOf.has(hk)) this.islandHeirGone(hk, hole);
        const nbrs = []; const ol = ownedLinks(hole); const n = ol.length;
        for (let k = 0; k < n; k++) { const x = this.occGet(ckey(ol[k])); if (x >= 0 && x !== id && FREE.l355On(this, ckey(ol[k]), x)) nbrs.push({ k: ckey(ol[k]), v: x }); }   // L35.5: the names I hold fresh
        let selfNb = false; for (let k = 0; k < n; k++) if (ckey(ol[k]) === ckey(this.coord)) selfNb = true; if (selfNb) nbrs.push({ k: ckey(this.coord), v: id });
        { const dk = ckey(down(hole)); const hx = this.childOf.get(hk); if (hx !== undefined && hx >= 0 && hx !== id && this.occGet(dk) < 0 && (RCD.L35_5_OFF || this.l13HeirOk(hk))) { let has = false; for (const x of nbrs) if (x.k === dk) has = true; if (!has) nbrs.push({ k: dk, v: hx }); } }
        const oc = FREE.ownerCoordOf(hole); if (oc) { const oid = this.occGet(ckey(oc)); let has = false; for (const x of nbrs) if (x.k === ckey(oc)) has = true; if (oid >= 0 && !has && FREE.l355On(this, ckey(oc), oid)) nbrs.push({ k: ckey(oc), v: oid }); }
        if (l13Redir) {
          for (let k = 0; k < n; k++) { const lk = ckey(ol[k]); if (this.occGet(lk) >= 0) continue; const cz = this.cousins.get(lk); if (cz !== undefined && cz >= 0 && cz !== id && FREE.l355On(this, lk, cz)) nbrs.push({ k: lk, v: cz }); }
          for (const [ck_, cv] of this.cousins) { let has = false; for (const x of nbrs) if (x.k === ck_) has = true; if (!has && cv >= 0 && cv !== id && FREE.l355On(this, ck_, cv)) nbrs.push({ k: ck_, v: cv }); }
        }
        this.rmName(hole, -1, nbrs);
        if (l13Redir) {
          this.healAt = this.TICK | 0; this.healTry.set(hk, this.TICK | 0); this.healOnly.add(hk); const ch = [];
          { const rc = this.rosterCells(); for (let q = 0; q < C; q++) { const k = ckey(rc[q]); const x = this.occGet(k); if (x >= 0 && x !== id && this.firstHandLive(k) && !this.translost.has(k)) ch.push(x); } }
          if (ch.length) { this.emit(ch[0], flMsg(hole, nbrs, 40)); return; } if (!this.hasChildren()) { this.mvWhy = 'top'; this.promoteInto(hole, nbrs); } return;
        }
        const src = []; const oneRow = this.oneRowRoom(); const srcLive = (k) => this.firstHandLive(k) && !(oneRow && this.darkMate(k));
        { const rc = this.rosterCells(); for (let q = 0; q < C; q++) { const x = this.occGet(ckey(rc[q])); if (x >= 0 && x !== id && srcLive(ckey(rc[q]))) src.push(x); } }
        if (hole.pc === this.coord.pc && hole.r === this.coord.r) { const rm = rowMates(this.coord); for (let q = 0; q < C - 1; q++) { if (ckey(rm[q]) === ckey(hole)) continue; if (!(this.kidful.has(ckey(rm[q])) && this.kidful.get(ckey(rm[q])))) continue; const x = this.occGet(ckey(rm[q])); if (x >= 0 && x !== id && srcLive(ckey(rm[q]))) src.push(x); } }
        if (hole.pc === 0 && this.coord.pc === 0) { const r = this.s1Roster(); for (const e of r) if (e.v !== id && e.k !== ckey(hole) && srcLive(e.k)) src.push(e.v); }
        const l1s1 = hole.pc === 0 && this.coord.pc === 0;
        if (l1s1 && this.occGet(ckey(down(hole))) < 0 && this.hasDownChild(hole)) { const it = this.l1Defer.get(hk); if (it === undefined || this.TICK - it > 3 * K.LEASE_T) this.l1Defer.set(hk, this.TICK | 0); }
        const l1rk = l1s1 ? l1MoverCell(this, hole) : 0;
        if (l1rk && l1rk !== ckey(this.coord)) { const x = this.occGet(l1rk); if (x >= 0 && x !== id && (this.firstHandLive(l1rk) || (1 !== 1 && !this.translost.has(l1rk)))) { this.emit(x, flMsg(hole, nbrs, 1)); } return; }
        if ((!l1s1 && hole.pc === this.coord.pc && hole.r === this.coord.r && hole.i === this.coord.i - 1 && this.occGet(ckey(down(hole))) < 0) || (l1rk && l1rk === ckey(this.coord))) {
          const mysrc = [];
          { const rc = this.rosterCells(); for (let q = 0; q < C; q++) { const x = this.occGet(ckey(rc[q])); if (x >= 0 && x !== id && this.firstHandLive(ckey(rc[q]))) mysrc.push(x); } }
          const tried = this.healTry.has(hk) ? this.healTry.get(hk) : -999;
          if (mysrc.length && (this.TICK | 0) - tried < 90) { const who = mysrc[Math.floor(this.rng() * mysrc.length)]; this.emit(who, flMsg(hole, nbrs, 40)); return; }
          if (!this.hasChildren() || (this.TICK | 0) - tried >= 90) { this.promoteInto(hole, nbrs); return; }
          if (mysrc.length) { const who = mysrc[Math.floor(this.rng() * mysrc.length)]; this.emit(who, flMsg(hole, nbrs, 40)); return; }
        }
        if (!this.hasChildren() && this.coord.pc === 0 && hole.pc === 0 && hole.i === this.coord.i && hole.r < this.coord.r && ((1 === 1 && l1RowEmpty(this, hole)))) {
          let rowRightEmpty = true;
          for (let j = hole.i + 1; j < C; j++) if (this.firstHandLive(ckey(cell(0, hole.r, j)))) { rowRightEmpty = false; break; }
          if (rowRightEmpty) { this.promoteInto(hole, nbrs); return; }
        }
        if (src.length) { const who = src[Math.floor(this.rng() * src.length)]; this.emit(who, flMsg(hole, nbrs, 40)); return; }
        if (!this.hasChildren() && hole.pc === this.coord.pc && hole.r === this.coord.r && hole.i === this.coord.i - 1) this.promoteInto(hole, nbrs);
      } finally { this.rmNamedOwner = false; }
    },

    // L9.3: a headless row has an arbiter.
    // C++: mesh_heal.inc:Seat::tryHeadFill
    tryHeadFill() {
      if (!this.hasCoord || this.state !== 3 || this.coord.pc === 0 || this.coord.i === 0 || this.moving) { return; }
      const id = this.id; const hd = cell(this.coord.pc, this.coord.r, 0); const hk = ckey(hd);
      if (this.occGet(hk) >= 0 || this.softSitting(hk)) { return; }
      const by = this.byeAt.get(hk); const bye = by !== undefined && (this.TICK - by <= K.LEASE_T || this.l13('L13.13'));
      if (!bye && !this.translostConfirmed(hk)) { return; }
      for (let j = 1; j < this.coord.i; j++) { const k = ckey(cell(this.coord.pc, this.coord.r, j)); if (this.occGet(k) >= 0 || this.softSitting(k)) { return; } }
      const dk = ckey(down(hd));
      if (this.occGet(dk) >= 0) { return; }
      let since = this.TICK; if (bye) since = by; else { const tl = this.translost.get(hk); if (tl !== undefined) since = tl; }   // L9.3: a head gone by a confirmed loss left when the loss was registered
      if (this.l1KidHeals(hd)) {
        const u = this.u2Rows.get(dk * 2); if (u !== undefined && u.heir >= 0 && u.at >= since) { return; }
        if (this.TICK - since < K.L9_KID_WAIT) { return; }
      }
      {
        const oc0 = this.u2Id >= 0 ? FREE.ownerCoordOf(hd) : null;
        if (this.u2Id >= 0 && oc0 && this.TICK - since < K.L9_ACK_WAIT) {
          const ok0 = ckey(oc0); const told = this.byeAt.has(ok0) || (this.ownDeadCk === ok0 && this.ownDeadAt >= since) || this.ownVouchAt > since;
          if (!told) { if (this.u2BeatAt < since) this.u2BeatAt = -1000; { return; } }
        }
      }
      { const t = this.healTry.get(hk); if (t !== undefined && this.TICK - t < K.L9_RETRY) { return; } }
      if (this.l13('L13.7')) { const hc = this.l13HeirCallAt.get(hk); if (hc !== undefined && this.TICK - hc <= K.LEASE_T) { return; } }
      if (this.l13('L13.4')) { const hh = this.l13HeldAt.get(hk); if (hh !== undefined && this.TICK - hh <= 32) { return; } }
      if (this.l13('L13.37') && this.l13OwnerPending(hk, -1)) { return; }
      let who = -1, last = -1;
      for (let j = C - 1; j >= this.coord.i; j--) {
        const c = cell(this.coord.pc, this.coord.r, j); const k = ckey(c);
        if (j === this.coord.i) { if (!this.hasChildren()) who = id; if (last < 0) last = id; break; }
        const x = this.occGet(k); if (x < 0 || x === id || this.translost.has(k)) continue;
        if (this.l13('L13.17') && !this.firstHandLive(k) && (this.f.fabricLinkState(id, x) === LS_CLOSED || this.f.fabricDialFails(id, x) >= 1)) continue;
        if (last < 0) last = x; if (!this.hasDownChild(c)) { who = x; break; }
      }
      if (who < 0) who = last;
      const nbrs = []; const ol = ownedLinks(hd); const n = ol.length; const hoc = FREE.ownerCoordOf(hd); const hasHoc = !!hoc;
      for (let q = 0; q < n; q++) { if (hasHoc && ckey(ol[q]) === ckey(hoc)) continue; const x = this.occGet(ckey(ol[q])); if (x >= 0 && x !== who && FREE.l355On(this, ckey(ol[q]), x)) nbrs.push({ k: ckey(ol[q]), v: x }); }
      {
        const oc = FREE.ownerCoordOf(hd);
        if (oc) {
          const ok = ckey(oc); const oid = this.occGet(ok); const ob = this.byeAt.get(ok);
          const dead = (ob !== undefined && this.TICK - ob <= K.LEASE_T) || (this.ownDeadCk === ok && this.TICK - this.ownDeadAt <= K.LEASE_T);
          if (dead) {
            nbrs.push({ k: ok, v: -1 });
            if (this.bkId >= 0 && this.bkId !== who && this.bkCk !== ok && unck(this.bkCk).pc === oc.pc && unck(this.bkCk).r === oc.r && FREE.l355On(this, this.bkCk, this.bkId)) { let has = false; for (const x of nbrs) if (x.k === this.bkCk) has = true; if (!has) nbrs.push({ k: this.bkCk, v: this.bkId }); }
          } else if (oid >= 0 && oid !== who) { if (FREE.l355On(this, ok, oid)) nbrs.push({ k: ok, v: oid }); }
          else if (oid < 0 && this.vouchOCk === ok && this.vouchOwner >= 0 && this.vouchOwner !== who && this.TICK - this.ownVouchAt <= K.LEASE_T) nbrs.push({ k: ok, v: this.vouchOwner });
        }
      }
      if (!this.rmName(hd, who, nbrs)) { if (this.rmAskDue(hk)) this.rmAsk(hd); { return; } }
      this.healTry.set(hk, this.TICK | 0); this.healAt = this.TICK | 0; this.lastChurn = this.TICK | 0;
      this.trace('HEADFILL', id, hd, 'filler=%d since=%lld', who, this.TICK - since);
      if (who === id) { const nb = kvs(nbrs); this.findLeaf(hd, nb, 0); { return; } }
      if (who >= 0) { const m = newMsg('FINDLEAF'); m.hole = cc(hd); m.nbrs = kvs(nbrs); m.ttl = 0; this.emit(who, m); }
    },

    // L9.21: a home cell a mover left is its row head's to pull a leaf into, once the returner's window has passed.
    // C++: mesh_heal.inc:Seat::l921Vac
    l921Vac(k) { return l1VacNote(this, k) && !this.l3109Wait(k); },

    // L9.12: a home hole pulls a deep leaf.
    // C++: mesh_heal.inc:Seat::homePull
    homePull() {
      if (!this.hasCoord || this.state !== 3 || this.coord.pc !== 0 || this.coord.i !== 0 || this.moving) return;
      const id = this.id;
      this.l920Note();
      const nhGone = (nk) => this.occGet(nk) < 0 || (this.TICK - this.seatedAt >= 2 * K.L9_PULL && !(this.live.has(nk) && this.TICK - this.live.get(nk) <= 2 * K.L9_PULL));
      let l921 = false;   // L9.21: the small-room band and the hold stand, but for the cells a mover left
      if (l9PullSmall(this) || (!this.l13('L13.7') && l9PullHold(this))) {
        let any = false; for (let j = 1; j < C; j++) if (this.l921Vac(ckey(cell(0, this.coord.r, j)))) any = true; const nr = (this.coord.r + 1) % C; const nk0 = ckey(cell(0, nr, 0)); if (this.l921Vac(nk0)) any = true;
        if (nhGone(nk0)) for (let j = 1; j < C; j++) if (this.l921Vac(ckey(cell(0, nr, j)))) any = true;
        if (!any) return; l921 = true;
      }
      if (this.TICK - this.l9PullAt < K.L9_PULL) return;
      const ks = []; if (this.hasChildren() && this.occGet(ckey(down(this.coord))) >= 0 && this.firstHandLive(ckey(down(this.coord)))) ks.push(id);
      for (let pass = 0; pass < 2; pass++) for (let q = 0; q < C * C; q++) {
        const cc_ = cell(0, Math.floor(q / C), q % C); const k = ckey(cc_); if (k === ckey(this.coord)) continue; const x = this.occGet(k); if (x < 0) continue; const ch = this.childOf.get(k); const kf = this.kidful.get(k);
        const fh = kf !== undefined && kf && this.firstHandLive(k), syn = ch !== undefined && ch >= 0;
        if (pass === 0 ? fh : (syn && !fh)) ks.push(x);
      }
      if (ks.length === 0) return;
      this.l9PullAt = this.TICK | 0; let cellIx = 0;
      const pull = (c) => {
        const k = ckey(c); if (l921 && !this.l921Vac(k)) return; let echo = this.occGet(k) >= 0 && this.occGet(k) !== id && this.TICK - this.seatedAt >= 2 * K.L9_PULL && !(this.live.has(k) && this.TICK - this.live.get(k) <= 2 * K.L9_PULL);
        if (echo && !this.ownedLinkCell(k)) echo = false;
        if (echo && this.l920Deaf(k)) echo = false;
        if ((this.occGet(k) >= 0 && !echo) || this.softSitting(k) || this.sitting.has(k) || this.occGet(ckey(down(c))) >= 0 || (this.hasDownChild(c) && !l1HeirFailed(this, c))) return;
        const p = this.l9PullCell.get(k); if (p !== undefined && this.TICK - p < ((roomTerm(this, 1) || l921) ? K.L9_PULL + K.CONFIRM_TTL : K.L9_PULL)) return;
        const pn = ins(this.l9PullN, k, () => 0); this.l9PullN.set(k, (pn + 1) >>> 0); const n = pn | 0; const x = ks[(cellIx++ + n) % ks.length];
        const nb = []; const ol = ownedLinks(c); const nl = ol.length; for (let q = 0; q < nl; q++) { const y = (ckey(ol[q]) === ckey(this.coord)) ? id : this.occGet(ckey(ol[q])); if (y >= 0) nb.push({ k: ckey(ol[q]), v: y }); }
        if (!this.rmName(c, -1, nb)) return;
        this.l9PullCell.set(k, this.TICK | 0); this.trace('HOME-PULL', id, c, 'via=%d n=%d', x, n);
        if (x === id) { this.findLeaf(c, nb, 2 * (C - 1), 12); } else { this.emit(x, flMsg(c, nb, 2 * (C - 1), 12)); }
      };
      for (let j = 1; j < C; j++) pull(cell(0, this.coord.r, j));
      const nh = cell(0, (this.coord.r + 1) % C, 0); const nk = ckey(nh);
      const nhEmpty = nhGone(nk);
      pull(nh);
      if (nhEmpty) for (let j = 1; j < C; j++) pull(cell(0, nh.r, j));
    },

    // L16.7: a cell whose holder I hear now is no hole.
    // C++: mesh_heal.inc:Seat::l167HolderHeard
    l167HolderHeard(hole) {
      const k = ckey(hole);
      if (this.u2Id >= 0 && this.u2Id !== this.id && this.u2Ck === k && this.f.fabricLinkState(this.id, this.u2Id) === LS_OPEN && this.TICK - this.u2AckAt <= 2 * 8 + K.EARLY_HOLD) return true;
      if (this.u3Id >= 0 && this.u3Id !== this.id && this.u3Ck === k && this.f.fabricLinkState(this.id, this.u3Id) === LS_OPEN && this.TICK - this.u3AckAt <= 2 * 8 + K.EARLY_HOLD) return true;
      const x = this.occGet(k); return x >= 0 && x !== this.id && this.holdsCell(k, K.HELD_BEATS);
    },

    // C++: mesh_heal.inc:Seat::findLeaf
    findLeaf(hole, nbrs, ttl, tag = 0, hop = -1) {
      const id = this.id;
      if (this.l13SplitHole(ckey(hole))) { this.trace('L13.41-NOHEAL', id, hole, 'tag=%d ttl=%d', tag, ttl); return; }
      if (!this.hasCoord) return;
      if (tag === 12 && this.f.fabricDoors() && this.l167HolderHeard(hole)) { this.trace('PULL-HELD', id, hole, 'holder heard'); return; }
      this.mvWhy = tag === 12 ? 'pull' : 'leaf';
      // (C++ RmVT guard: leaving this function clears the rook-leaf mark; the FlEnd guard is debug only)
      try {
        if (tag === 11) { const sf = this.rmStrictFail.get(ckey(hole)); if (sf !== undefined && this.TICK - sf <= K.LEASE_T) return; this.rmVTag = 11; this.rmStrictNext = true; tag = 0; }
        const asg = (x) => { this.l9Asg.set(x, this.TICK | 0); if (this.l9Asg.size > 32) eraseFirst(this.l9Asg); };   // l9Asg[x]=TICK; if(size>32) erase(begin)
        if (tag === 12 && this.l13('L13.7') && hole.pc !== 0) {
          if (this.moving) return;
          if (hole.pc === this.coord.pc && hole.r === this.coord.r) {
            const dk = ckey(down(this.coord)); const ch = this.occGet(dk);
            if (ch >= 0 && ch !== id && this.firstHandLive(dk) && !this.translost.has(dk)) { const m = flMsg(hole, nbrs, 0, 12); this.emit(ch, m); return; }
            const rc = this.rosterCells();
            for (let j = C - 1; j >= 1; j--) {
              const k = ckey(rc[j]); const x = this.occGet(k);
              if (x >= 0 && x !== id && !this.translost.has(k) && !this.l13Fresh(k)) {
                const a = this.l9Asg.get(x); if (a !== undefined && this.TICK - a <= K.CONFIRM_TTL) continue;
                asg(x); this.f.fabricDialJoin(id, x); this.emit(x, flMsg(hole, nbrs, 0, 12)); return;
              }
            }
            return;
          }
          if (this.coord.i === 0) {
            let pick = -1;
            for (let j = C - 1; j >= 1 && pick < 0; j--) { const c = cell(this.coord.pc, this.coord.r, j); const k = ckey(c); const x = this.occGet(k); if (x < 0 || x === id || this.translost.has(k) || this.hasDownChild(c) || this.l13Fresh(k)) continue; const a = this.l9Asg.get(x); if (a !== undefined && this.TICK - a <= K.CONFIRM_TTL) continue; pick = x; }
            if (pick >= 0) { asg(pick); this.emit(pick, flMsg(hole, nbrs, 0, 12)); return; }
            for (let j = C - 1; j >= 1; j--) { const c = cell(this.coord.pc, this.coord.r, j); const k = ckey(c); const x = this.occGet(k); if (x < 0 || x === id || this.translost.has(k) || !this.hasDownChild(c)) continue; const a = this.l9Asg.get(x); if (a !== undefined && this.TICK - a <= K.CONFIRM_TTL) continue; asg(x); this.emit(x, flMsg(hole, nbrs, 0, 12)); return; }
            let mates = false; for (let j = 1; j < C; j++) { const x = this.occGet(ckey(cell(this.coord.pc, this.coord.r, j))); if (x >= 0 && x !== id) mates = true; }
            if (mates || this.hasChildren()) return;
          }
          if (this.hasChildren()) {
            const dk = ckey(down(this.coord)); const ch = this.occGet(dk);
            if (ch >= 0 && ch !== id && this.firstHandLive(dk) && !this.translost.has(dk)) { this.emit(ch, flMsg(hole, nbrs, 0, 12)); return; }
            const rc = this.rosterCells();
            for (let j = C - 1; j >= 1; j--) {
              const k = ckey(rc[j]); const x = this.occGet(k);
              if (x >= 0 && x !== id && !this.translost.has(k) && !this.l13Fresh(k)) {
                const a = this.l9Asg.get(x); if (a !== undefined && this.TICK - a <= K.CONFIRM_TTL) continue;
                asg(x); this.f.fabricDialJoin(id, x); this.emit(x, flMsg(hole, nbrs, 0, 12)); return;
              }
            }
            return;
          }
          if (this.l13Fresh(ckey(this.coord))) return;
          this.promoteInto(hole, nbrs); return;
        }
        if (tag === 12 && hole.pc === 0) {
          if (this.coord.pc === 0) {
            const dk = ckey(down(this.coord)); const ch = this.occGet(dk);
            const a = this.l9Asg.get(ch); const spent = a !== undefined && this.TICK - a <= K.CONFIRM_TTL && ins(this.l9AsgN, ch, () => 0) >= C;
            if (ch >= 0 && ch !== id && this.firstHandLive(dk) && !this.translost.has(dk) && !spent && !this.f.fabricTurnAcross(id)) {   /* TURN.14.2: no leaf of my subtree goes home across my TURN link: the next home seat with a child row sends one */
              if (a === undefined || this.TICK - a > K.CONFIRM_TTL) this.l9AsgN.set(ch, 0);
              this.l9Asg.set(ch, this.TICK | 0); this.l9AsgN.set(ch, ins(this.l9AsgN, ch, () => 0) + 1);
              this.emit(ch, flMsg(hole, nbrs, 0, 12)); return;
            }
            if (ttl > 0) {
              for (let q = 0; q < C * C; q++) {
                const cc_ = cell(0, Math.floor(q / C), q % C); const k = ckey(cc_); if (k === ckey(hole) || k === ckey(this.coord)) continue;
                const x = this.occGet(k); const kf = this.kidful.get(k); const chx = this.childOf.get(k);
                if (x >= 0 && x !== id && ((kf !== undefined && kf && this.firstHandLive(k)) || (chx !== undefined && chx >= 0))) {
                  const fk = l9FwdKey(ckey(hole), x); const f = this.l9Fwd.get(fk); if (f !== undefined && this.TICK - f <= K.CONFIRM_TTL) continue;
                  this.l9Fwd.set(fk, this.TICK | 0); this.emit(x, flMsg(hole, nbrs, ttl - 1, 12)); return;
                }
              }
            }
            return;
          }
          if (this.moving) return;
          if (this.coord.i === 0) {
            let pick = -1;
            for (let j = C - 1; j >= 1 && pick < 0; j--) { const c = cell(this.coord.pc, this.coord.r, j); const k = ckey(c); const x = this.occGet(k); if (x < 0 || x === id || this.translost.has(k) || this.hasDownChild(c)) continue; const a = this.l9Asg.get(x); if (a !== undefined && this.TICK - a <= K.CONFIRM_TTL) continue; pick = x; }
            if (pick >= 0) { asg(pick); this.emit(pick, flMsg(hole, nbrs, 0, 12)); return; }
            let mates = false; for (let j = 1; j < C; j++) { const x = this.occGet(ckey(cell(this.coord.pc, this.coord.r, j))); if (x >= 0 && x !== id) mates = true; }
            if (this.l13('L13.7') && !this.hasChildren()) {
              for (let j = C - 1; j >= 1; j--) {
                const c = cell(this.coord.pc, this.coord.r, j); const dk = ckey(down(c)); const ch = this.occGet(dk); if (ch < 0 || ch === id || !this.firstHandLive(dk)) continue;
                const a = this.l9Asg.get(ch); if (a !== undefined && this.TICK - a <= K.CONFIRM_TTL) continue;
                this.l9Asg.set(ch, this.TICK | 0); const m = flMsg(hole, nbrs, 0, 12); this.f.fabricDialJoin(id, ch); this.emit(ch, m); return;
              }
            }
            if (mates || this.hasChildren()) return;
          }
          if (this.hasChildren()) { const dk = ckey(down(this.coord)); const ch = this.occGet(dk); if (ch >= 0 && ch !== id && this.firstHandLive(dk)) { this.emit(ch, flMsg(hole, nbrs, 0, 12)); } return; }
          this.promoteInto(hole, nbrs); return;
        }
        if (ttl > 0) {
          const rc = this.rosterCells(); const idx = this.shufCols();
          for (const q of idx) { const x = this.occGet(ckey(rc[q])); if (x >= 0 && x !== id && this.firstHandLive(ckey(rc[q]))) { this.emit(x, flMsg(hole, nbrs, ttl - 1)); return; } }
        }
        if (this.coord.pc !== 0 && this.coord.pc === hole.pc && this.coord.r === hole.r && hole.i === 0 && ttl === 0) {
          if (this.moving) return;
          const hk0 = ckey(hole); let cur = this.occGet(hk0);
          if (cur >= 0 && cur !== id && !this.firstHandLive(hk0)) {
            this.byeAt.set(hk0, this.TICK | 0); { if (this.byeId.size >= 64) eraseFirst(this.byeId); this.byeId.set(hk0, cur); }
            if (this.occ.has(hk0)) { this.occDrop(hk0, 'arbiter-bye'); this.live.delete(hk0); this.kidful.delete(hk0); } cur = -1;
          }
          if (cur >= 0) return;
          if (this.hasChildren()) {
            const f = this.l9Fwd.get(hk0); if (f !== undefined && this.TICK - f < K.L9_RETRY) return; this.l9Fwd.set(hk0, this.TICK | 0);
            const rc = this.rosterCells(); for (let q = 0; q < C; q++) { const k = ckey(rc[q]); const x = this.occGet(k); if (x >= 0 && x !== id && this.firstHandLive(k) && !this.translost.has(k)) { this.emit(x, flMsg(hole, nbrs, 40)); return; } }
            return;
          }
          this.promoteInto(hole, nbrs); return;
        }
        if (this.coord.pc === hole.pc && this.coord.r === hole.r && hole.i !== 0) {
          if (!(hole.i < this.coord.i) || this.hasChildren()) return;
          if (this.l13('L13.7') && this.l13Fresh(ckey(this.coord))) return;
          this.promoteInto(hole, nbrs); return;
        }
        if (this.coord.pc !== 0 && this.coord.pc !== hole.pc) {
          // The seat that handed this order over, and a seat already heard first-hand at another cell, are not the next mate. Handing the order back left the hop count unchanged.
          for (let j = C - 1; j > this.coord.i; j--) { const k = ckey(cell(this.coord.pc, this.coord.r, j)); const x = this.occGet(k); if (x >= 0 && x !== id && x !== hop && !this.liveElsewhere(x, k) && !this.translost.has(k) && !(this.l13('L13.7') && this.l13Fresh(k)) && !(this.l13('L13.2') && this.hasDownChild(unck(k)))) { this.emit(x, flMsg(hole, nbrs, ttl)); return; } }
        }
        if (this.l13('L13.2') && this.hasChildren()) {
          const rc = this.rosterCells();
          for (let j = C - 1; j >= 0; j--) { const k = ckey(rc[j]); const x = this.occGet(k); if (x >= 0 && x !== id && !this.translost.has(k) && !this.liveElsewhere(x, k) && (ttl > 0 || this.firstHandLive(k))) { if (j !== 0) this.f.fabricDialJoin(id, x); this.emit(x, flMsg(hole, nbrs, 0)); return; } }
          return;
        }
        if (this.l13('L13.7') && this.l13Fresh(ckey(this.coord)) && !(hole.pc === this.coord.pc && hole.r === this.coord.r && hole.i === 0)) {
          for (let j = this.coord.i - 1; j >= 1; j--) { const k = ckey(cell(this.coord.pc, this.coord.r, j)); const x = this.occGet(k); if (x >= 0 && x !== id && !this.translost.has(k) && !this.l13Fresh(k) && !this.hasDownChild(unck(k))) { this.emit(x, flMsg(hole, nbrs, 0)); this.trace('FRESH-PASS', id, hole, 'to=%d', x); return; } }
          this.trace('FRESH-REFUSE', id, hole, '-'); return;
        }
        this.promoteInto(hole, nbrs);
      } finally { this.rmVTag = 0; this.rmStrictNext = false; }
    },

    // L13.7: a seat that took its cell within the arrival window.
    // C++: mesh_heal.inc:Seat::l13Fresh
    l13Fresh(k) { const b = this.born.get(k); return b !== undefined && this.LT() - b <= K.L11_ARRIVE; },
    // C++: mesh_heal.inc:Seat::l13SettledRight
    l13SettledRight(j) { for (let q = j - 1; q > this.coord.i; q--) { const k = ckey(cell(this.coord.pc, this.coord.r, q)); const x = this.occGet(k); if (x >= 0 && x !== this.id && !this.translost.has(k) && !this.l13Fresh(k)) return true; } return false; },
    // D6b: a seat that cannot hold a channel takes no contested cell.
    // C++: mesh_heal.inc:Seat::chanless
    chanless(holeK) {
      if (this.d6Mark) return true;
      let proven = 0, fresh = 0;
      const ol = ownedLinks(this.coord); const n = ol.length;
      for (let i = 0; i < n; i++) {
        const k = ckey(ol[i]); if (k === holeK) continue;
        const x = this.occGet(k); if (x < 0 || x === this.id) continue;
        const lb = this.linkedBy.get(k); if (lb === undefined || lb !== x) continue;
        const at = this.lkAt.get(k); if (at === undefined) continue;
        proven++;
        if ((this.TICK | 0) - at <= K.CHAN_UP) fresh++;
      }
      return proven > 0 && fresh === 0 && this.unpAnyAt >= 0 && (this.TICK | 0) - this.unpAnyAt <= 16;
    },
    // C++: mesh_heal.inc:Seat::promoteInto
    promoteInto(hole, nbrs) {
      if (!this.hasCoord || ckey(this.coord) === ckey(hole)) return;
      if (this.moving) { return; }
      if (this.chanless(ckey(hole))) { return; }
      if (this.coord.pc === 0 && hole.pc !== 0) return;
      if (this.coord.pc === 0 && hole.pc === 0) {
        const leftPack = (hole.r === this.coord.r && hole.i < this.coord.i);
        const colPack = (hole.i === this.coord.i && hole.r < this.coord.r);
        if (!leftPack && !colPack) return;
        if (l1MoverCell(this, hole) !== ckey(this.coord) && !(colPack && 1 === 1 && l1RowEmpty(this, hole))) return;
        if (this.heldRightNow(ckey(hole))) return;
      }
      this.doMove(hole, -1, nbrs);
    },
    // L48.2 (DRAFT): the seats at my old cell's owned links, as my rollback snapshot holds them (the cell is mine until
    // CONFIRM, and so are the pcs to them): D7.x's word to them rides those pcs, not a route from the new cell's view.
    // C++: mesh_heal.inc:Seat::d7OldLink
    d7OldLink(x) {
      if (!this.moving || x < 0 || x === this.id) return false;
      for (const c of ownedLinks(this.oldCoord)) { const v = this.holdOcc.get(ckey(c)); if (v !== undefined && v === x) return true; }
      return false;
    },
    // T1 claim-before-vacate: take the new seat first while the old one is still held.
    // C++: mesh_heal.inc:Seat::doMove
    doMove(hole, owner, nbrs, ppFrom = -1, ppTick = -1, ppTickL = -1) {
      const id = this.id;
      if (!this.hasCoord || ckey(this.coord) === ckey(hole) || this.moving || this.l4Busy()) { return; }
      if (this.earShut()) return;   // L8.48: a shut ear does not promote and does not declare itself alone
      if (this.t14Stay(hole) || this.t14Fixed()) { this.trace('TURN14-HOLD', id, hole, 'owner=%d from=%s', owner, FREE.coordStr(this.coord)); return; }   /* TURN.14.5: my subtree hangs under a link end: no cell outside it */
      {
        let w = false; for (const kv of nbrs) if (kv.v >= 0 && kv.v !== id && this.rmWitCell(hole, kv.k)) { w = true; break; }
        if (!w) { const ww = this.rmWitness(hole, id); if (ww) { const all = ww.concat(nbrs); nbrs.length = 0; for (const e of all) nbrs.push(e); w = true; } }
        if (!w && this.rmAloneAsked(hole)) { w = true; this.trace('L11-ALONE', id, hole, 'owner=%d', owner); }
        if (!w) { this.trace('L11-NOWIT', id, hole, 'owner=%d', owner); if (!this.rmRingAlone(hole)) return; const hk0 = ckey(hole); if (this.rmAskDue(hk0)) this.rmAsk(hole); if (this.rmPend.size < 4) this.rmPend.set(hk0, cc(hole)); return; }
      }
      this.rmOldBornAt = this.rmBornAt; this.rmNeedWit = (this.rmStrictNext || (this.l13('L13.31') && hole.pc === 0));
      this.w.lv.MOVES++;   /* bumpMoves */ this.lastChurn = this.TICK | 0;
      this.oldCoord = cc(this.coord); this.oldCk = ckey(this.coord); this.oldTn = this.tn; this.oldEstAt = this.estAt; this.oldPp = this.pp; this.oldPpAt = this.ppAt; this.oldPpL = this.ppL; this.oldPpCk = this.ppCk; this.oldPlacer = this.placer;
      this.oldNbrIds.length = 0; this.oldOwnerId = -1;
      {
        const ol = ownedLinks(this.oldCoord); const n = ol.length; const seen = new Set();
        for (let k = 0; k < n; k++) { const x = this.occGet(ckey(ol[k])); if (x >= 0 && x !== id && !seen.has(x)) { seen.add(x); this.oldNbrIds.push(x); } }
        if (this.l13('L13.7') && this.oldCoord.pc !== 0 && this.oldCoord.i !== 0) { const o = FREE.ownerCoordOf(this.oldCoord); if (o) { const x = this.occGet(ckey(o)); if (x >= 0 && x !== id && !seen.has(x)) this.oldOwnerId = x; } }
      }
      this.holdOcc = new Map(this.occ); this.holdSeen = new Map(this.s1seen); this.holdCous = new Map(this.cousins);
      this.occ.clear(); this.ledgerSeen.clear(); this.s1seen.clear(); this.cousins.clear(); this.tlClear();
      if (this.l13('L13.1')) {
        const no = FREE.ownerCoordOf(hole);
        if (no) { const ring = l13Ring(no); const nr = ring.length; for (const [ck_, cv] of this.holdCous) { let inn = false; for (let q = 0; q < nr; q++) if (ckey(ring[q]) === ck_) inn = true; if (inn) this.cousins.set(ck_, cv); } }
      }
      this.moving = true; this.moveAt = this.TICK | 0;
      this.take(hole, owner, nbrs, ppFrom, ppTick, [], ppTickL);
      // D7.x: my signed word about the cell I took goes to the seats that fold my report at the old one, now (a pure notice: mv)
      if (this.hasCoord) { const told = new Set(); { const nl = ownedLinks(this.coord); for (let k = 0; k < nl.length; k++) { const x = this.occGet(ckey(nl[k])); if (x >= 0) told.add(x); } }   // (a seat that is also my new neighbour hears my claim itself)
        const tell = (x) => { if (x < 0 || x === id || told.has(x)) return; told.add(x); const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = id; h.sig = true; h.sigAt = this.TICK | 0; h.mv = true; h.mpOld = this.oldCk; this.emit(x, h); }; for (const x of this.oldNbrIds) tell(x); tell(this.oldOwnerId); }
      this.lastAck = this.TICK | 0; this.lastPhone = (this.TICK | 0) - 100;
      let anyNbr = false;
      { const ol = ownedLinks(this.coord); const n = ol.length; for (let k = 0; k < n; k++) { const x = this.occGet(ckey(ol[k])); if (x >= 0 && x !== id) { anyNbr = true; break; } } }
      if (!anyNbr) this.confirmMove();
    },
    // A frame that evidences my new neighbourhood.
    // C++: mesh_heal.inc:Seat::moveEvidence
    moveEvidence(m) {
      if (m.t === 'PONG') return m.tag !== 7 && this.linkIs(m, m.id >= 0 ? m.id : m.lk);
      if (m.t === 'PHONE') return this.linkIs(m, m.id) && m.tock === ckey(this.coord);
      if (m.t === 'HELLO' || m.t === 'CLAIM') {
        if (m.l9s) return false; const c = unck(m.ck); const ol = ownedLinks(this.coord); const n = ol.length;
        for (let k = 0; k < n; k++) if (ckey(ol[k]) === ckey(c)) return true;
      }
      return false;
    },
    // T3: the confirmed vacate.
    // C++: mesh_heal.inc:Seat::confirmMove
    confirmMove() {
      if (!this.moving) return; this.moving = false;
      if (this.l4X) { this.l4X = false; this.oldNbrIds.length = 0; this.holdOcc.clear(); this.holdSeen.clear(); this.holdCous.clear(); this.oldPp = -1; this.oldPlacer = -1; this.trace('SWAP-CONFIRM', this.id, this.coord, 'from=%s', FREE.coordStr(unck(this.oldCk))); return; }
      this.trace('CONFIRM', this.id, this.coord, 'from=%s', FREE.coordStr(unck(this.oldCk)));
      let handTo = -1; { const it = this.rcHanded.get(ckey(this.coord)); if (it !== undefined) handTo = it[0]; }
      for (const x of this.oldNbrIds) { const m = newMsg('LEAVE'); m.ck = this.oldCk; m.id = this.id; m.mvd = ckey(this.coord); m.mv = true; m.nc = handTo; this.emit(x, m); }
      if (this.oldOwnerId >= 0) { this.f.fabricDialJoin(this.id, this.oldOwnerId); const m = newMsg('LEAVE'); m.ck = this.oldCk; m.id = this.id; m.mvd = ckey(this.coord); m.mv = true; m.nc = handTo; this.emit(this.oldOwnerId, m); this.oldOwnerId = -1; }
      this.l382Vacated();   // L38.2 (gaps2.js)
      this.oldNbrIds.length = 0; this.holdOcc.clear(); this.holdSeen.clear(); this.holdCous.clear(); this.oldPp = -1; this.oldPlacer = -1;
      this.leaseCk = this.oldCk; this.leaseUntil = this.TICK + K.LEASE_TTL;
    },
    // T1 rollback: my claim at the new cell was contradicted; go home to the old seat.
    // C++: mesh_heal.inc:Seat::rollbackMove
    rollbackMove() {
      if (!this.moving) return; this.moving = false; this.l4X = false; this.f.fabricNoteRollback(this.id); this.rbWhy = '?';
      this.trace('ROLLBACK', this.id, this.coord, 'home=%s', FREE.coordStr(this.oldCoord));
      const newCk = ckey(this.coord);
      { const ol = ownedLinks(this.coord); const n = ol.length; const seen = new Set();
        for (let k = 0; k < n; k++) { const x = this.occGet(ckey(ol[k])); if (x >= 0 && x !== this.id && !seen.has(x)) { seen.add(x); const m = newMsg('LEAVE'); m.ck = newCk; m.id = this.id; this.emit(x, m); } } }
      this.rmBornAt = this.rmOldBornAt;
      if (this.rmNeedWit) { this.rmNeedWit = false; if (this.rmStrictFail.size >= 16) eraseFirst(this.rmStrictFail); this.rmStrictFail.set(ckey(this.coord), this.TICK | 0); }
      this.coord = cc(this.oldCoord); this.tn = this.oldTn; this.estAt = this.oldEstAt; this.nbrAt = this.TICK | 0; this.pp = this.oldPp; this.ppAt = this.oldPpAt; this.ppL = this.oldPpL; this.ppCk = this.oldPpCk; this.oldPp = -1; this.placer = this.oldPlacer; this.oldPlacer = -1;
      this.occ = new Map(this.holdOcc); this.s1seen = new Map(this.holdSeen); this.cousins = new Map(this.holdCous);
      this.occ.set(this.oldCk, this.id);
      // L48.1 (DRAFT): what I filed at the cell I give back (child report, row-mates', stand-ins') goes with it, and so do the folds made of it, as take() starts every cell from empty
      if (!L48_1_OFF) { this.downDig = msg.newDig(); this.downUsed = msg.newDig(); this.myDig = msg.newDig(); this.rowDig = msg.newDig(); this.rowKids.clear(); this.rowUsed.clear(); this.siKids.clear(); }
      this.l919Rollback();
      { const lb = this.liveBy.get(newCk); const oc = this.occ.get(newCk); if (this.live.has(newCk) && (lb === undefined ? -1 : lb) !== (oc === undefined ? -1 : oc)) { this.live.delete(newCk); this.liveBy.delete(newCk); this.heardSince.delete(newCk); } }
      this.oldNbrIds.length = 0; this.holdOcc.clear(); this.holdSeen.clear(); this.holdCous.clear();
      this.healOnly.delete(newCk); this.healTry.set(newCk, this.TICK | 0); this.healAt = this.TICK | 0;
      this.lastAck = this.TICK | 0; this.lastPhone = (this.TICK | 0) - 100;
      this.announce(); this.f.wake(this.id);
    },

    // ---- L13.1: MEET, the mass-leave calls ----
    // The witness cell of a home cell: the first seat of its rook I name alive; the Coord or null.
    // C++: mesh_heal.inc:Seat::l13HomeWit
    l13HomeWit(H) {
      if (H.pc !== 0) return null;
      const live = (c) => { const k = ckey(c); const x = this.occGet(k); if (x < 0) return false; const b = this.byeAt.get(k); if (b !== undefined && this.TICK - b <= K.LEASE_T && !this.firstHandLive(k)) return false; if (this.callBook.rested(x, this.TICK) && !this.firstHandLive(k)) return false; return true; };
      for (let j = 0; j < C; j++) { if (j === H.i) continue; const c = cell(0, H.r, j); if (live(c)) return c; }
      for (let r = 0; r < C; r++) { if (r === H.r) continue; const c = cell(0, r, H.i); if (live(c)) return c; }
      return null;
    },
    // My anchor cell: my owner cell when I am a head, my head cell when I am a mate; the Coord or null.
    // C++: mesh_heal.inc:Seat::l13Anchor
    l13Anchor() { if (!this.hasCoord || this.coord.pc === 0) return null; if (this.coord.i === 0) return this.ownerCoord(); return cell(this.coord.pc, this.coord.r, 0); },
    // C++: mesh_heal.inc:Seat::l13Meet
    l13Meet(force = false) {
      if (!this.hasCoord || this.state !== 3 || this.moving || this.coord.pc === 0) return;
      const id = this.id; const TICK = this.TICK;
      const H = this.l13Anchor(); if (!H) return; const ok = ckey(H);
      const x = this.occGet(ok); let gone = false, blind = false, lone = false;
      const byeOf = (k) => { const b = this.byeAt.get(k); return b !== undefined && TICK - b <= K.LEASE_T; };
      if (x < 0) { gone = byeOf(ok); lone = !gone && TICK - this.seatedAt >= 8 && !this.softSitting(ok); }
      else {
        const pb = this.pongBy.get(ok); const heard = pb !== undefined && pb[0] === x && pb[1] >= this.seatedAt; const ls = this.f.fabricLinkState(id, x);
        blind = !heard && !this.firstHandLive(ok) && TICK - this.seatedAt >= 8 && (ls === LS_CLOSED || (ls !== LS_OPEN && TICK - this.seatedAt >= 16));
      }
      let silent = false;
      if (this.l13('L13.11') && x >= 0 && !blind && !this.firstHandLive(ok)) {
        const pb = this.pongBy.get(ok); const lastP = (pb !== undefined && pb[0] === x) ? pb[1] : this.seatedAt;
        if (TICK - lastP > K.LEASE_T || ((this.f.fabricLinkState(id, x) === LS_CLOSED || this.noChan.has(x) || this.l13('L13.26')) && TICK - lastP >= 60)) { blind = true; silent = true; }
      }
      if (!gone && !blind && !lone) return;
      if (gone && this.coord.i === 0) {
        const w = this.rmWitness(H, -1);
        if (w) { let next = false; const wc = l13Witness(H); if (wc) { const wk = ckey(wc); const em = this.l13EmptyAt.get(wk); if (this.occGet(wk) < 0 && byeOf(wk) && (em === undefined || TICK - em > 16)) next = true; } if (!next) return; }
      }
      { const at = this.l13MeetAt.get(ok); if (at !== undefined && (TICK - at < (force ? 1 : 8))) return; }
      const chain = l13Chain(this, H); const nc = chain.length; const calls = [];
      for (let l = 0; l < nc; l++) {
        const c = chain[l]; const ck2 = ckey(c);
        if (l > 0) { const y = this.occGet(ck2); const open = this.heardAt(ck2) >= 0; if (open) break; const known = y >= 0 || byeOf(ck2); if (!known && !byeOf(ckey(chain[l - 1]))) break; }
        const ring = l13Ring(c); const n = ring.length;
        for (let q = 0; q < n; q++) {
          const k = ckey(ring[q]); if (k === ckey(this.coord)) continue; let y = this.occGet(k); let newer = false;
          if (y >= 0 && byeOf(k)) { const bb = this.born.get(k); const by = this.byeAt.get(k); newer = bb !== undefined && by !== undefined && bb > by; }
          if (y < 0) { const cz = this.cousins.get(k); if (cz !== undefined) y = cz; }
          if (y < 0 || y === id || (byeOf(k) && !newer)) continue; { const sz = this.l1343Stale.get(k); if (sz !== undefined && sz === y && !this.firstHandLive(k)) continue; } calls.push([y, ck2]);   // L13.43: a seat a hint named from a hearing a lease old is a cell, not a call
        }
      }
      {
        let homeDark = false; for (let l = 0; l < nc; l++) if (chain[l].pc === 0 && !this.firstHandLive(ckey(chain[l]))) homeDark = true;
        const fastAsk = this.l13('L13.14');
        if (this.l13('L13.9') && homeDark && TICK - this.rosterAskAt > (fastAsk ? 16 : 32) && TICK - this.l13NewsAt > (fastAsk ? 16 : 32)) {
          const gs = []; for (const g of this.lastGreeters) if (g >= 0 && g !== id && !this.noChan.has(g)) gs.push(g);
          const nFresh = gs.length;
          {
            for (const [ek, ev] of this.occ) { if (ckPc(ek) !== 0 || ev < 0 || ev === id || this.noChan.has(ev)) continue; if (!gs.includes(ev)) gs.push(ev); }
            for (const [ek, ev] of this.cousins) { if (ckPc(ek) !== 0 || ev < 0 || ev === id || this.noChan.has(ev)) continue; if (!gs.includes(ev)) gs.push(ev); }
          }
          if (fastAsk) {
            if (this.l13KnockAt > this.l13AskedKnock) { this.l13AskedKnock = this.l13KnockAt; this.l13Asked.clear(); }
            const staleDoor = this.l13('L13.35') && (this.greetersAt < 0 || TICK - this.greetersAt > 64);
            const cand = []; for (let q = 0; q < gs.length; q++) if (!this.l13Asked.has(gs[q]) && (q < nFresh || nFresh === 0 || this.greetersAt < this.l13KnockAt) && !(staleDoor && q < nFresh)) cand.push(gs[q]);
            if (cand.length === 0) { if (TICK - this.l13KnockAt >= 32) { this.l13KnockAt = TICK | 0; this.emitRelay(this.genKey, false); this.trace('L13-KNOCK', id, H, '-'); } }
            else { const g = cand[0]; this.l13Asked.add(g); this.rosterAskAt = TICK | 0; this.f.fabricDialJoin(id, g); const w = newMsg('WHOHOME'); w.from = id; w.ttl = 60; w.knock = true; this.emit(g, w); this.trace('L13-WHOHOME', id, H, 'to=%d', g); }
          } else if (gs.length === 0 || (this.l13KnockAt < this.rosterAskAt && TICK - this.rmHomeAt > 64)) { if (TICK - this.l13KnockAt >= 64) { this.l13KnockAt = TICK | 0; this.emitRelay(this.genKey, false); this.trace('L13-KNOCK', id, H, '-'); } }
          else { const g = gs[Math.floor(TICK / 32) % gs.length]; this.rosterAskAt = TICK | 0; this.f.fabricDialJoin(id, g); const w = newMsg('WHOHOME'); w.from = id; w.ttl = 60; w.knock = true; this.emit(g, w); this.trace('L13-WHOHOME', id, H, 'to=%d', g); }
        }
      }
      if (calls.length === 0) { this.l13MeetAt.set(ok, TICK | 0); return; }
      const ix = this.l13MeetIx.has(ok) ? this.l13MeetIx.get(ok) : 0; const n = calls.length; let sent = 0;
      const rested = (x_) => this.callBook.rested(x_, TICK);
      const send = (cl) => {
        this.callBook.ringCall(cl[0], TICK);
        this.f.fabricDialJoin(id, cl[0]); const m = newMsg('MEET'); m.ck = ckey(this.coord); m.id = id; m.oCk = cl[1]; m.owner = this.occGet(cl[1]); m.mass = this.l13Mass(); this.emit(cl[0], m); sent++; this.l13CallAt = TICK | 0; const cc_ = unck(cl[1]); this.trace('L13-MEET', id, cc_, 'to=%d %s', cl[0], gone ? 'gone' : silent ? 'silent' : blind ? 'blind' : 'lone');
      };
      let wq = -1;
      { let wc = l13Witness(H); if (!wc) wc = this.l13HomeWit(H); if (wc) { const wk = ckey(wc); const wx = this.occGet(wk); if (wx >= 0 && wx !== id) { for (let q = 0; q < n; q++) if (calls[q][0] === wx && calls[q][1] === ok) { wq = q; break; } } } }
      if (wq >= 0 && !rested(calls[wq][0])) send(calls[wq]);
      let used = 0; for (let q = 0; q < n && sent < 2; q++) { const k = (ix + q) % n; used = q + 1; if (k === wq) continue; const cl = calls[k]; if (rested(cl[0])) continue; send(cl); }
      this.l13MeetAt.set(ok, TICK | 0); this.l13MeetIx.set(ok, n ? (ix + used) % n : 0);
    },
    // The ring's side: a call about a cell of my row, my child head cell, or a cell of the row I own.
    // C++: mesh_heal.inc:Seat::l13OnMeet
    l13OnMeet(m) {
      if (!this.hasCoord || this.state !== 3 || m.id < 0 || m.id === this.id || !FREE.cellOk(m.oCk) || !FREE.cellOk(m.ck) || !this.linkIs(m, m.id)) return;
      if (this.otherRing(m.id)) return;
      if (m.mass) { let n = 0; for (const b of this.byeAt.values()) if (this.TICK - b <= K.LEASE_T) n++; let d = 0; for (const t of this.l13DownAt) if (this.TICK - t <= K.LEASE_T) d++; if (n + d >= 1) this.l13MassHeard(); }
      const H = unck(m.oCk); let rel = false;
      if (H.pc === this.coord.pc && H.r === this.coord.r && m.oCk !== ckey(this.coord)) rel = true;
      if (this.coord.pc === 0 && H.pc === 0 && H.i === this.coord.i) rel = true;
      if (ckey(down(this.coord)) === m.oCk) rel = true;
      { const o = FREE.ownerCoordOf(H); if (o && ckey(o) === ckey(this.coord)) rel = true; }
      { const c = unck(m.ck); if (m.oCk === ckey(this.coord) && c.pc === this.coord.pc && c.r === this.coord.r && this.coord.i === 0) rel = true; }
      if (!rel) return;
      if (ckey(down(H)) === m.ck) { this.childOf.set(m.oCk, m.id); this.l13HeirCallAt.set(m.oCk, this.TICK | 0); }
      else {
        let c = unck(m.ck); let on = false;
        for (let h = 0; h < 6 && !on; h++) { if (c.i !== 0) break; const w = up(c); if (!w) break; if (ckey(w) === m.oCk) on = true; c = w; }
        const dk = ckey(down(H)); if (on && (this.occGet(dk) < 0 || !this.firstHandLive(dk))) this.childOf.set(m.oCk, m.id); if (on && this.l13('L13.7')) this.l13HeirCallAt.set(m.oCk, this.TICK | 0);
      }
      {
        const cc_ = unck(m.ck); const o = cc_.pc !== 0 ? FREE.ownerCoordOf(cc_) : null;
        if (cc_.pc !== 0 && o && ckey(o) === ckey(this.coord) && cc_.i !== 0) {
          const cur = this.occGet(m.ck);
          if (cur < 0 || cur === m.id || !this.firstHandLive(m.ck)) { if (cur !== m.id) this.setOcc(m.ck, m.id); this.liveMark(m.ck); }
          if (this.l13On() && this.occGet(m.ck) === m.id) this.l13RowMemo.set(m.ck, [m.id, this.TICK | 0]);
        }
      }
      this.l13Answer(m.id, m.oCk);
    },
    // C++: mesh_heal.inc:Seat::l13HeirOk
    l13HeirOk(k) { const hc = this.l13HeirCallAt.get(k); return this.firstHandLive(ckey(down(unck(k)))) || (hc !== undefined && this.TICK - hc <= 32); },   // the L13 answer's heir test: an heir I hear, or that called me this claim window
    // C++: mesh_heal.inc:Seat::l13Answer
    l13Answer(to, ok) {
      const id = this.id; const TICK = this.TICK;
      const H = unck(ok); const a = newMsg('MEETACK'); a.id = id; a.ck = ckey(this.coord); a.oCk = ok; a.owner = -1; a.child = -1; a.mass = this.l13Mass();
      if (ok === ckey(this.coord)) a.owner = id; else { const x = this.occGet(ok); if (x >= 0 && x !== id && this.firstHandLive(ok)) a.owner = x; }
      { const c = this.childOf.get(ok); if (c !== undefined && this.l13HeirOk(ok)) a.child = c; }
      const byeOf = (k) => { const b = this.byeAt.get(k); return b !== undefined && TICK - b <= K.LEASE_T && !this.firstHandLive(k); };
      const byeOld = (k) => { if (!this.l13('L13.19') || this.coord.pc === 0 || TICK - this.seatedAt < 16 || !this.byeAt.has(k) || this.sitting.has(k) || this.softSitting(k) || this.firstHandLive(k)) return false; const p = this.l9PullCell.get(k); return p === undefined || TICK - p >= K.CONFIRM_TTL; };
      const inDownRow = (k) => { const d = down(this.coord); const c = unck(k); return c.pc === d.pc && c.r === d.r; };
      if (byeOf(ok) || (inDownRow(ok) && byeOld(ok))) a.byes.push(ok);
      const heirOf = (k) => { const c = this.childOf.get(k); if (c === undefined) return -1; return this.l13HeirOk(k) ? c : -1; };
      const ent = (k, v, age) => ({ k, v, age, ch: -1, ba: -1, tn: 0 });
      for (let j = 0; j < C; j++) {
        const k = ckey(cell(this.coord.pc, this.coord.r, j)); if (k === ok) continue; const x = (k === ckey(this.coord)) ? id : this.occGet(k);
        if (x >= 0 && (RCD.L35_5_OFF || this.coord.i !== 0 || x === id || FREE.l355Heard(this, k, x))) a.row.push(ent(k, x, heirOf(k))); else if (byeOf(k) && (this.coord.i === 0 || j === 0 || this.coord.pc === 0)) a.byes.push(k);
        else if (this.l13('L13.12') && this.coord.pc !== 0 && TICK - this.seatedAt >= 16 && this.byeAt.has(k) && !this.sitting.has(k) && !this.softSitting(k) && !this.firstHandLive(k)) { const p = this.l9PullCell.get(k); if (p === undefined || TICK - p >= K.CONFIRM_TTL) a.byes.push(k); }
      }
      if (this.coord.pc === 0) for (let r = 0; r < C; r++) { const k = ckey(cell(0, r, this.coord.i)); if (k === ok || r === this.coord.r) continue; const x = this.occGet(k); if (x >= 0 && !FREE.l35HandOn(this, k, x)) continue; if (x >= 0) a.nbrs.push({ k, v: x }); else if (byeOf(k)) a.byes.push(k); }
      { const o = this.coord.pc !== 0 ? this.ownerCoord() : null; if (o) { const k = ckey(o); const x = this.occGet(k); if (x >= 0 && x !== id) a.nbrs.push({ k, v: x }); else if (byeOf(k)) a.byes.push(k); } }
      {
        const d = down(this.coord); const o = FREE.ownerCoordOf(H);
        if ((o && ckey(o) === ckey(this.coord)) || ok === ckey(d)) {
          for (let j = 0; j < C; j++) { const k = ckey(cell(d.pc, d.r, j)); if (k === ok) continue; const x = this.occGet(k); if (x >= 0 && x !== id) a.row.push(ent(k, x, heirOf(k))); else if (byeOf(k) || byeOld(k)) a.byes.push(k); }
        }
      }
      {
        const rh = cell(H.pc, H.r, 0); const o2 = (H.i !== 0 && H.pc !== 0) ? FREE.ownerCoordOf(rh) : null;
        if (H.i !== 0 && H.pc !== 0 && o2 && ckey(o2) === ckey(this.coord)) { const rk = ckey(rh); const x = this.occGet(rk); if (x >= 0 && x !== id && this.firstHandLive(rk)) a.row.unshift(ent(rk, x, heirOf(rk))); else if (byeOf(rk)) a.byes.push(rk); }
      }
      if (this.l13('L13.4') && a.owner < 0 && ok !== ckey(this.coord)) {
        const w = this.l13WordTo.get(ok);
        const dropOk = () => { for (let q = 0; q < a.byes.length; q++) if (a.byes[q] === ok) { a.byes.splice(q, 1); break; } };
        if (w !== undefined && w[0] !== to && TICK - w[1] < 16) { a.wordHeld = true; dropOk(); this.l33WordDenied(ok); }
        else if (this.l33WordRegrant(ok, to)) { a.wordHeld = true; dropOk(); }
        else if (w === undefined || w[0] !== to || TICK - w[1] >= 16) { this.l13WordTo.set(ok, [to, TICK | 0]); if (this.l13WordTo.size > 64) eraseFirst(this.l13WordTo); }
      }
      if (a.owner < 0 && ok !== ckey(this.coord) && this.l394Placing(ok, to)) { a.wordHeld = true; for (let q = 0; q < a.byes.length; q++) if (a.byes[q] === ok) { a.byes.splice(q, 1); break; } }   /* L39.4: a seat I am placing there holds the cell from the word (gaps3.js) */
      for (const [ck_, cv] of this.cousins) if (cv >= 0 && cv !== id && cv !== to && FREE.l35HandOn(this, ck_, cv)) a.nbrs.push({ k: ck_, v: cv });
      { const aged = (k) => { if (k === ckey(this.coord)) return; const lv = this.live.get(k); const ag = lv === undefined ? 100000 : TICK - lv; if (ag > K.LEASE_T) a.hage.push({ k, v: ag | 0 }); }; for (const e of a.row) aged(e.k); for (const e of a.nbrs) aged(e.k); }   /* L13.43: a name I pass on carries the age of my own hearing when it is past a lease */
      this.emit(to, a); this.trace('L13-ANSWER', id, H, 'to=%d owner=%d child=%d byes=%zu held=%d mass=%d', to, a.owner, a.child, a.byes.length, a.wordHeld ? 1 : 0, a.mass ? 1 : 0);
    },
    // The caller's side: the answerer is first-hand at its cell; its goodbyes and seats are installed.
    // C++: mesh_heal.inc:Seat::l13OnMeetAck
    l13OnMeetAck(m) {
      const id = this.id; const TICK = this.TICK;
      if (!this.hasCoord || this.state !== 3 || this.moving || m.id < 0 || m.id === id || !FREE.cellOk(m.ck) || !FREE.cellOk(m.oCk) || !this.linkIs(m, m.id)) return;
      if (this.otherRing(m.id)) return;
      const H = this.l13Anchor(); if (!H) return; const ok = ckey(H);
      const chain = l13Chain(this, H); const nc = chain.length; let lvl = -1; for (let l = 0; l < nc; l++) if (ckey(chain[l]) === m.oCk) lvl = l; if (lvl < 0) return;
      const cells = []; for (let l = 0; l < nc; l++) { cells.push(chain[l]); for (const r of l13Ring(chain[l])) cells.push(r); }
      const known = (k) => { for (const c of cells) if (ckey(c) === k) return true; return false; };
      const onChain = (k) => { for (let l = 0; l < nc; l++) if (ckey(chain[l]) === k) return true; return false; };
      const ak = m.oCk; this.callBook.answered(m.id);
      this.noChan.delete(m.id);
      const massHeard = m.mass;
      const act = this.l13Mass();
      {
        const ac = unck(m.oCk); let wc; let witAns = (ac.pc === 0 && this.rmWitCell(ac, m.ck)) || (ac.pc !== 0 && (wc = l13Witness(ac)) !== null && ckey(wc) === m.ck) || (lvl + 1 < nc && ckey(chain[lvl + 1]) === m.ck);
        if (witAns && m.owner >= 0 && m.owner !== id && !this.firstHandLive(m.oCk) && lvl === 0) witAns = false;
        if (witAns) { if (massHeard) this.l13MassHeard(); this.l13AnswerAt = TICK | 0; if (act) { this.l13ProgressAt = TICK | 0; this.drainAt = 0; } }
      }
      const news = () => { this.l13NewsAt = TICK | 0; if (act) { this.l13ProgressAt = TICK | 0; this.drainAt = 0; } };
      if (!act) {
        for (const k of m.byes) { if (!FREE.cellOk(k) || k === ckey(this.coord) || this.firstHandLive(k)) continue; const by = this.byeAt.get(k); if (by === undefined || TICK - by > K.LEASE_T) this.byeAt.set(k, TICK | 0); }
        if (m.ck === ak) {
          if (m.owner === m.id) { const cur = this.occGet(ak); if (!(cur >= 0 && cur !== m.id && this.firstHandLive(ak))) { this.setOcc(ak, m.id); this.liveMark(ak); this.noteS1(ak); if (ak === ok) { this.f.fabricDial(id, m.id); this.l13AnchorNewAt = TICK | 0; } } }
        } else {
          const ring = l13Ring(unck(m.oCk)); let inn = false; for (const r of ring) if (ckey(r) === m.ck) inn = true;
          if (inn) {
            { const cur = this.occGet(m.ck); if (cur !== m.id) { if (!(cur >= 0 && this.firstHandLive(m.ck))) this.setOcc(m.ck, m.id); } this.liveMark(m.ck); this.noteS1(m.ck); }
            const x0 = this.occGet(ak); if (m.owner >= 0 && m.owner !== id && x0 !== m.owner && !this.firstHandLive(ak)) { this.noChan.delete(m.owner); this.setOcc(ak, m.owner); this.noteHand(ak, m.owner); if (ak === ok) { this.f.fabricDialJoin(id, m.owner); this.l13AnchorNewAt = TICK | 0; } }
            {
              const mc = unck(m.ck); const hk = ckey(cell(mc.pc, mc.r, 0));
              if (mc.i !== 0 && mc.pc !== 0 && known(hk) && hk !== ckey(this.coord)) {
                let nr0 = 0;
                for (const e of m.row) { if (++nr0 > C) break; if (e.k !== hk || e.v < 0 || e.v === id) continue; const cur = this.occGet(hk); const lv = this.live.get(hk); const bn = this.born.get(hk); if (cur >= 0 && cur !== e.v && (lv === undefined || TICK - lv > K.LEASE_T) && (bn === undefined || TICK - bn > 16)) { this.setOcc(hk, e.v); this.noteHand(hk, e.v); } }
              }
            }
          }
        }
        if (this.l13Mass()) this.l13Meet(true); return;
      }
      if (m.ck === ak) { if (m.owner !== m.id) return; const cur = this.occGet(ak); if (cur >= 0 && cur !== m.id && this.firstHandLive(ak)) return; this.setOcc(ak, m.id); this.liveMark(ak); this.noteS1(ak); news(); if (ak === ok) { this.f.fabricDial(id, m.id); this.l13AnchorNewAt = TICK | 0; } const ac = unck(ak); this.trace('L13-SITS', id, ac, 'who=%d', m.id); return; }
      { const ring = l13Ring(unck(m.oCk)); let inn = false; for (const r of ring) if (ckey(r) === m.ck) inn = true; if (!inn) return; }
      { const cur = this.occGet(m.ck); if (cur !== m.id) { if (cur >= 0 && this.firstHandLive(m.ck)) return; this.setOcc(m.ck, m.id); news(); } this.liveMark(m.ck); this.noteS1(m.ck); if (this.cousins.has(m.ck) || this.cousins.size < 8 * C) this.cousins.set(m.ck, m.id); }
      let byeA = false; for (const k of m.byes) if (k === ak) byeA = true; let newBye = false;
      const x = this.occGet(ak);
      if (this.l13('L13.4') && (m.wordHeld || (m.owner < 0))) {
        const ac0 = unck(ak); let wc0 = null;
        const wit0 = (ac0.pc === 0 && (wc0 = this.l13HomeWit(ac0)) !== null && ckey(wc0) === m.ck) || (ac0.pc !== 0 && (wc0 = l13Witness(ac0)) !== null && (ckey(wc0) === m.ck || (ac0.i !== 0 && (this.occGet(ckey(wc0)) < 0 || !this.firstHandLive(ckey(wc0))))));
        if (wit0 && m.wordHeld) { this.l13HeldAt.set(ak, TICK | 0); this.l13EmptyAt.delete(ak); byeA = false; this.trace('L13-HELD', id, ac0, 'by=%d', m.id); } else if (wit0) this.l33WordMine(ak);
      }
      {
        const ac = unck(ak); let isWit = this.rmWitCell(ac, m.ck); let wc;
        if (!isWit && (wc = l13Witness(ac)) !== null) { const wk = ckey(wc); const wx = this.occGet(wk); isWit = wx < 0 || !this.firstHandLive(wk); }
        if (ac.pc === 0) { const hw = this.l13HomeWit(ac); isWit = !hw || ckey(hw) === m.ck; }
        const hh = this.l13HeldAt.get(ak); const heldWin = ac.pc === 0 ? 64 : 32;
        if (m.owner >= 0) { this.l13EmptyAt.delete(ak); this.l13HeldAt.set(ak, TICK | 0); this.l13HeldBy.set(ak, m.id); }
        else if (byeA && (!isWit || (hh !== undefined && TICK - hh <= heldWin))) byeA = false;
        else if (byeA) this.l13EmptyAt.set(ak, TICK | 0);
        else if (this.l13('L13.11') && x < 0 && isWit && m.owner < 0 && !(hh !== undefined && TICK - hh <= heldWin)) {
          const ob = this.byeAt.get(ak);
          if (ob !== undefined && (TICK - ob <= K.LEASE_T || this.l13('L13.24'))) {
            const ac2 = unck(ak);
            if (this.l13('L13.37') && this.l13OwnerPending(ak, m.id)) this.trace('L13-EMPTY-WAIT', id, ac2, 'by=%d held_by=%d', m.id, ins(this.l13HeldBy, ak, () => 0));
            else { this.l13EmptyAt.set(ak, TICK | 0); this.trace('L13-EMPTY', id, ac2, 'by=%d', m.id); }
          }
        }
      }
      if (this.l13('L13.11') && !byeA && x < 0 && m.owner < 0 && lvl > 0 && !this.firstHandLive(ak)) {
        const ac = unck(ak); let wc = null;
        const wit = (ac.pc === 0 && (wc = this.l13HomeWit(ac)) !== null && ckey(wc) === m.ck) || (ac.pc !== 0 && (wc = l13Witness(ac)) !== null && ckey(wc) === m.ck);
        const bb = this.byeAt.get(ckey(chain[lvl - 1])); const bn = this.born.get(m.ck); const hh = this.l13HeldAt.get(ak);
        if (wit && bb !== undefined && (TICK - bb <= K.LEASE_T || (this.l13('L13.24') && this.occGet(ckey(chain[lvl - 1])) < 0)) && bn !== undefined && TICK - bn >= 16 && !(hh !== undefined && TICK - hh <= 32)) { byeA = true; this.l13EmptyAt.set(ak, TICK | 0); this.trace('L13-EMPTY-CHAIN', id, ac, 'by=%d', m.id); }
      }
      if (this.l13('L13.11') && !byeA && x >= 0 && m.owner < 0 && !this.firstHandLive(ak) && !this.l394Held(ak)) {   /* L39.4 (gaps3.js) */
        const ac = unck(ak); let wc = null;
        const wit = (ac.pc === 0 && (wc = this.l13HomeWit(ac)) !== null && ckey(wc) === m.ck) || (ac.pc !== 0 && (wc = l13Witness(ac)) !== null && ckey(wc) === m.ck);
        const pb = this.pongBy.get(ak); const heardEver = pb !== undefined && pb[0] === x; let lastP = heardEver ? pb[1] : this.seatedAt;
        { const bn = this.born.get(ak); if (!heardEver && bn !== undefined && bn > lastP) lastP = bn; }
        const ls = this.f.fabricLinkState(id, x);
        if (wit && (TICK - lastP > K.LEASE_T || ((ls === LS_CLOSED || this.noChan.has(x) || (!heardEver && ls !== LS_OPEN) || this.l13('L13.26')) && TICK - lastP >= 60))) { byeA = true; this.l13EmptyAt.set(ak, TICK | 0); this.trace('L13-DEAD', id, ac, 'was=%d by=%d silent=%lld', x, m.id, TICK - lastP); }
      }
      if (byeA && !this.firstHandLive(ak)) {
        if (x >= 0) { this.occDrop(ak, 'meet-bye'); this.live.delete(ak); this.kidful.delete(ak); }
        const ob = this.byeAt.get(ak); if (ob === undefined || TICK - ob > K.LEASE_T) { this.byeAt.set(ak, TICK | 0); newBye = true; news(); const ac = unck(ak); this.trace('L13-GONE', id, ac, 'by=%d', m.id); }
      } else if (m.owner >= 0 && m.owner !== id && x !== m.owner && !this.firstHandLive(ak)) {
        this.noChan.delete(m.owner); this.setOcc(ak, m.owner); this.noteHand(ak, m.owner); news(); if (ak === ok) { this.f.fabricDialJoin(id, m.owner); this.l13AnchorNewAt = TICK | 0; } const ac = unck(ak);
        this.trace('L13-OWNER', id, ac, 'owner=%d by=%d now=%d dark=%d nochan=%d', m.owner, m.id, this.occGet(ak), this.darkHold.has(ak) ? 1 : 0, this.noChan.has(m.owner) ? 1 : 0);
      }
      for (const k of m.byes) {
        if (k === ak || !FREE.cellOk(k) || !known(k) || k === ckey(this.coord) || this.firstHandLive(k)) continue; { const hh = this.l13HeldAt.get(k); if (hh !== undefined && TICK - hh <= 32) continue; }
        const by = this.byeAt.get(k); const held = by !== undefined && TICK - by <= K.LEASE_T; const y = this.occGet(k);
        if (y >= 0) { const bb = this.born.get(k); if (held && bb !== undefined && bb > by) continue; this.occDrop(k, 'meet-bye'); this.live.delete(k); this.kidful.delete(k); }
        if (!held) { this.byeAt.set(k, TICK | 0); news(); if (onChain(k)) newBye = true; }
      }
      const hint = (k, v) => {
        if (v < 0 || v === id || !FREE.cellOk(k) || !known(k) || k === ckey(this.coord)) return; const b = this.byeAt.get(k); if (b !== undefined && TICK - b <= K.LEASE_T) return;
        let stale = false; for (const g of m.hage) if (g.k === k) { stale = true; break; }   // L13.43: the hinter last heard that seat more than a lease ago
        if (this.occGet(k) < 0 && (onChain(k) || ckPc(k) === 0)) { this.setOcc(k, v); this.noteHand(k, v); news(); FREE.l35Hinted(this, k, v); if (stale) this.l1343Stale.set(k, v); const kc = unck(k); const mc = unck(m.ck); this.trace('L13-HINT', id, kc, 'v=%d by=%d at=%s', v, m.id, FREE.coordStr(mc)); }
        if (stale) return;
        if (!this.cousins.has(k) && this.cousins.size < 8 * C) { this.cousins.set(k, v); FREE.l35Hinted(this, k, v); }
      };
      {
        const mc = unck(m.ck); const hk = ckey(cell(mc.pc, mc.r, 0));
        if (mc.i !== 0 && mc.pc !== 0 && known(hk) && hk !== ckey(this.coord)) {
          let nr0 = 0;
          for (const e of m.row) {
            if (++nr0 > C) break; if (e.k !== hk || e.v < 0 || e.v === id) continue; const cur = this.occGet(hk); const lv = this.live.get(hk); const bn = this.born.get(hk);
            if (cur >= 0 && cur !== e.v && (lv === undefined || TICK - lv > K.LEASE_T) && (bn === undefined || TICK - bn > 16)) { this.setOcc(hk, e.v); this.noteHand(hk, e.v); news(); const hc = unck(hk); this.trace('L13-HEAD', id, hc, 'was=%d now=%d by=%d', cur, e.v, m.id); }
          }
        }
      }
      let nr = 0; for (const e of m.row) { if (++nr > C) break; hint(e.k, e.v); if (e.v >= 0 && e.age >= 0 && known(e.k)) this.childOf.set(e.k, e.age); }
      if (m.ck !== ak) { if (m.child >= 0) this.childOf.set(ak, m.child); else if (this.occGet(ak) < 0) this.childOf.delete(ak); }
      nr = 0; for (const kv of m.nbrs) { if (++nr > 8 * C) break; hint(kv.k, kv.v); }
      {
        const ob = this.byeAt.get(ok); const ht = this.healTry.get(ok);
        if (ob !== undefined && (TICK - ob <= K.LEASE_T || this.l13('L13.22')) && this.occGet(ok) < 0 && (ht === undefined || ht < ob)) {
          this.healTry.delete(ok); this.healOnly.delete(ok); this.healAt = -1000;
          if (this.coord.i !== 0 && this.l13('L13.5')) {
            let first = true; for (let j = 1; j < this.coord.i; j++) if (this.occGet(ckey(cell(this.coord.pc, this.coord.r, j))) >= 0) first = false;
            const top = this.l13('L13.22') && this.l13Top() !== null;
            if ((first && (this.rmWitness(H, -1) !== null || this.l13Top() !== null)) || top) this.heal(H);
          }
        } else if (this.l13('L13.5') && this.coord.i !== 0 && ok === ckey(cell(this.coord.pc, this.coord.r, 0)) && ob !== undefined && TICK - ob <= K.LEASE_T && this.occGet(ok) < 0 && !this.l1KidHeals(H)) {
          let first = true; for (let j = 1; j < this.coord.i; j++) if (this.occGet(ckey(cell(this.coord.pc, this.coord.r, j))) >= 0) first = false;
          if (first && this.rmWitness(H, -1)) this.heal(H);
        }
      }
      if (newBye) this.l13Meet(true);
    },
    // L13.18: a cell out of reach under a gone cell is gone.
    // C++: mesh_heal.inc:Seat::l13Condemn
    l13Condemn() {
      if (!this.hasCoord || this.state !== 3 || this.moving || this.coord.pc === 0) return;
      const id = this.id; const TICK = this.TICK;
      const H = this.l13Anchor(); if (!H) return; const chain = l13Chain(this, H); const nc = chain.length;
      const goneAbove = (l) => { if (l + 1 >= nc) return false; const wk = ckey(chain[l + 1]); if (this.occGet(wk) >= 0) return false; const em = this.l13EmptyAt.get(wk); const wb = this.byeAt.get(wk); return (em !== undefined && TICK - em <= 16) || (wb !== undefined && TICK - wb <= K.LEASE_T); };
      for (let l = 0; l < nc - 1; l++) {
        const k = ckey(chain[l]); const x = this.occGet(k);
        if (x < 0) { if (this.l13Condemned.has(k)) { if (goneAbove(l)) this.l13EmptyAt.set(k, TICK | 0); else this.l13Condemned.delete(k); } continue; }
        if (this.firstHandLive(k)) { this.l13Condemned.delete(k); continue; }
        if (x === id) continue; const df = this.f.fabricDialFails(id, x);
        const rested = this.callBook.rested(x, TICK);
        if (!((rested && df >= 1) || (df >= 2 && TICK - this.l13CrashAt <= 2 * K.LEASE_T))) continue;
        if (l === 0 && this.coord.i === 0 && TICK - this.lastAck < 60) continue;
        if (!goneAbove(l)) continue;
        this.trace('L13-CONDEMN', id, chain[l], 'was=%d lvl=%d fails=%d', x, l, this.f.fabricDialFails(id, x));
        this.occDrop(k, 'owner-unreach'); this.live.delete(k); this.s1seen.delete(k); this.kidful.delete(k); this.byeAt.set(k, TICK | 0); this.l13EmptyAt.set(k, TICK | 0); this.l13Condemned.add(k);
      }
    },

    // ---- L14: fast media, slow tidy-up ----
    // Is my chain up broken: the anchor Coord when so, else null (C++: bool + Coord& anc).
    // C++: mesh_heal.inc:Seat::l14Branch
    l14Branch() {
      if (!this.hasCoord || this.state !== 3 || this.moving || this.coord.pc === 0) return null;
      const id = this.id; const TICK = this.TICK;
      let anc = null;
      if (this.coord.i === 0) anc = this.ownerCoord();
      else {
        anc = cell(this.coord.pc, this.coord.r, 0);
        if (this.l14Up < 0 || this.f.fabricLinkState(id, this.l14Up) !== LS_OPEN) for (let j = 1; j < this.coord.i; j++) { const k = ckey(cell(this.coord.pc, this.coord.r, j)); if (this.occGet(k) >= 0 && this.firstHandLive(k)) return null; }
      }
      if (!anc) return null; const ak = ckey(anc); const x = this.occGet(ak);
      if (x < 0) return anc;
      if (this.coord.i === 0 && x === this.l14PcPeer && this.l14PcCut() && this.f.fabricLinkState(id, x) !== LS_OPEN) return anc;   // L14.10
      if (this.firstHandLive(ak)) return null;
      let heard = false; { const pb = this.pongBy.get(ak); heard = pb !== undefined && pb[0] === x && pb[1] >= this.seatedAt + 128; }
      return ((this.f.fabricLinkState(id, x) !== LS_OPEN || (heard && TICK - this.lastAck >= 40)) && TICK - this.lastAck >= 32) ? anc : null;
    },
    // C++: mesh_heal.inc:Seat::l14Uplink
    // C++: mesh_heal.inc:Seat::l14PcCut
    l14PcCut() { return this.l14PcDown >= 0 && (this.TICK - this.l14PcDown >= 32 || this.l2RowE2Down()); },
    // C++: mesh_heal.inc:Seat::l14PcWatch
    l14PcWatch() {
      if (!this.hasCoord || this.state !== 3 || this.coord.pc === 0 || this.coord.i !== 0) return; const o = this.ownerCoord(); if (!o) return; const x = this.occGet(ckey(o)); if (x < 0) return;
      const open = this.f.fabricLinkState(this.id, x) === LS_OPEN;
      if (x !== this.l14PcPeer) { this.l14PcPeer = x; this.l14PcOpen = open; this.l14PcDown = -1; } else if (open) { this.l14PcOpen = true; this.l14PcDown = -1; } else if (this.l14PcOpen) { this.l14PcOpen = false; this.l14PcDown = this.TICK; }
    },
    l14Uplink() {
      this.l14PcWatch();
      const id = this.id; const TICK = this.TICK;
      const anc = this.l14Branch(); const cut = anc !== null;
      if (!cut) { this.l14UpFirst = -1; if (this.l14Up >= 0 && (TICK - this.l14UpAt >= K.LEASE_T || this.f.fabricLinkState(id, this.l14Up) === LS_CLOSED)) { this.trace('L14-DOWN', id, this.coord, 'was=%d', this.l14Up); const was = this.l14Up; this.l14Up = -1; this.l14Failed.clear(); this.l14Refused.clear(); if (this.f.fabricLinkState(id, was) === LS_OPEN) { const u = newMsg('UNNEEDED'); u.id = id; u.tag = 5; this.emit(was, u); } } return; }   // L14.9: the uplink I let go is asked closed on the spot, marked as a released uplink (tag 5): the head served it on my word alone and would otherwise hold the pc through L22's settle and ask, ten ticks past the lease
      if (this.l14Up >= 0) { const ls = this.f.fabricLinkState(id, this.l14Up); if (ls === LS_OPEN) return; if (ls === LS_DIALING && TICK - this.l14UpAt < 48) return; this.l14Failed.set(this.l14Up, TICK | 0); this.l14Refused.delete(this.l14Up); this.trace('L14-FAIL', id, anc, 'to=%d ls=%d', this.l14Up, ls); this.l14Up = -1; }
      let any = this.l13Mass(); if (!any) { for (const b of this.byeIds.values()) if (TICK - b <= K.LEASE_T) { any = true; break; } for (const t of this.l13DownAt) if (TICK - t <= K.LEASE_T) { any = true; break; } if (TICK - this.lastAck >= 40 || this.l14PcCut()) any = true; }
      let ancBye = -1; { const ab = this.byeAt.get(ckey(anc)); if (ab !== undefined && TICK - ab <= K.LEASE_T && this.occGet(ckey(anc)) < 0) { any = true; ancBye = ab; } }
      if (!any || TICK - this.l14UpAt < (this.l14Up < 0 && this.l14Refused.size > 0 ? 2 : 8)) return;
      const closed = (x) => { if (this.f.fabricLinkState(id, x) === LS_CLOSED) return true; for (let q = 0; q < this.l13DownAt.length; q++) if (this.l13DownPeer[q] === x && TICK - this.l13DownAt[q] <= K.LEASE_T) return true; return false; };
      const cand = []; const push = (x, k) => {
        if (x < 0 || x === id || this.l14FailedNow(x) || this.noChan.has(x) || closed(x) || (this.l14PcDown >= 0 && x === this.l14PcPeer)) return; if (k && this.byeAt.has(k) && !this.firstHandLive(k)) return;
        if (k) { const c = unck(k); if (c.pc === this.coord.pc && c.r === this.coord.r) return; if (c.pc !== 0 && pcDepth(c.pc) >= pcDepth(this.coord.pc) && !(this.coord.i === 0 && c.pc === anc.pc && c.r === anc.r)) return; }
        for (const c of cand) if (c === x) return; cand.push(x);
      };
      let broke = -1; { for (const b of this.byeIds.values()) if (b > broke) broke = b; for (const t of this.l13DownAt) if (t > broke) broke = t; if (TICK - this.lastAck >= 40 && this.lastAck > broke) broke = this.lastAck; if (ancBye > broke) broke = ancBye; if (this.l14PcDown > broke) broke = this.l14PcDown; }
      const fresh = this.greetersAt >= broke && TICK - this.greetersAt <= K.RELAY_TTL && this.lastGreeters.length > 0;
      if (!fresh) { if (TICK - this.l13KnockAt >= 32) { this.l13KnockAt = TICK | 0; this.emitRelay(this.genKey, false); this.trace('L14-KNOCK', id, anc, 'stale'); } if (this.l14KnockAt0 < broke) this.l14KnockAt0 = TICK | 0; }
      const memoryToo = fresh || TICK - this.l14KnockAt0 >= 64;
      const fromView = (pass, want) => {
        const live = (k) => pass === 1 || (k && this.firstHandLive(k)); const ok = (k) => { if (want < 0) return true; return ((ckPc(k) !== 0) ? 1 : 0) === want; };
        if (this.bkId >= 0 && live(this.bkCk) && ok(this.bkCk)) push(this.bkId, this.bkCk); if (this.u2Id >= 0 && live(this.u2Ck) && ok(this.u2Ck)) push(this.u2Id, this.u2Ck);
        { const H = this.l13Anchor(); if (H) { const chain = l13Chain(this, H); const nc = chain.length; for (let l = 1; l < nc; l++) { const k = ckey(chain[l]); const y = this.occGet(k); if (y >= 0 && live(k) && ok(k)) push(y, k); } } }
        for (const [ck_, cv] of this.cousins) if (live(ck_) && ok(ck_)) push(cv, ck_);
        if (want !== 1) for (const [ek, ev] of this.occ) { if (ckPc(ek) !== 0 || ev < 0) continue; if (live(ek)) push(ev, ek); }
      };
      for (const r of this.l14Refer) { let rk = 0; for (const [ek, ev] of this.occ) if (ev === r) { rk = ek; break; } if (rk) { const c = unck(rk); if (c.pc === this.coord.pc && c.r === this.coord.r) continue; } push(r, 0); } this.l14Refer.length = 0;
      fromView(0, 1);
      if (fresh) { const n = this.lastGreeters.length; for (let q = 0; q < n; q++) push(this.lastGreeters[(q + id) % n], 0); }
      for (let pass = 0; pass < 2; pass++) { if (pass === 1 && !memoryToo) break; { fromView(pass, 1); fromView(pass, 0); } }
      if (cand.length === 0) { return; }
      for (let q = 0; q < cand.length; q++) {
        const x = cand[q]; const ref = [];
        if (!this.f.fabricDialUplink(id, x, ref)) {
          this.l14Failed.set(x, TICK | 0); this.l14Refused.add(x); this.trace('L14-FAIL', id, anc, 'to=%d ls=refused', x);
          let at = q + 1;
          for (const r of ref) {
            if (r === id || this.l14FailedNow(r) || this.noChan.has(r) || closed(r)) continue; let dup = false; for (const c of cand) if (c === r) { dup = true; break; } if (dup) continue;
            let rk = 0; for (const [ek, ev] of this.occ) if (ev === r) { rk = ek; break; } if (rk) { const c = unck(rk); if (c.pc === this.coord.pc && c.r === this.coord.r) continue; } cand.splice(at, 0, r); at++;
          }
          continue;
        }
        this.l14Up = x; this.l14UpAt = TICK | 0; if (this.l14UpFirst < 0) this.l14UpFirst = TICK | 0; this.l14Refused.clear(); this.trace('L14-UP', id, anc, 'to=%d cands=%zu', x, cand.length); return;
      }
      this.l14UpAt = TICK | 0;
    },
    // L13.4: the top of a chain first; the Coord, or null.
    // C++: mesh_heal.inc:Seat::l13Top
    l13Top() {
      if (!this.l13('L13.4') || !this.hasCoord || this.state !== 3 || this.coord.pc === 0) return null;
      const TICK = this.TICK;
      const H = this.l13Anchor(); if (!H) return null; const chain = l13Line(H); const nc = chain.length;
      if (this.l13('L13.5') && this.coord.i === 0 && H.i !== 0 && !this.hasChildren()) {
        const hk = ckey(H), rk = ckey(cell(H.pc, H.r, 0)); const hb = this.byeAt.get(hk), rb = this.byeAt.get(rk), ch = this.childOf.get(rk);
        if (this.occGet(hk) < 0 && hb !== undefined && TICK - hb <= K.LEASE_T && this.occGet(rk) < 0 && rb !== undefined && TICK - rb <= K.LEASE_T && (ch === undefined || ch < 0)) {
          let first = true; for (let j = 1; j < H.i; j++) if (this.occGet(ckey(cell(H.pc, H.r, j))) >= 0) first = false; const e = this.l13EmptyAt.get(rk);
          if (first && e !== undefined && TICK - e <= 16 && this.rmWitness(cell(H.pc, H.r, 0), -1)) return cell(H.pc, H.r, 0);
        }
      }
      for (let l = nc - 1; l > 0; l--) {
        const k = ckey(chain[l]); const b = this.byeAt.get(k); if (b === undefined || TICK - b > K.LEASE_T || this.occGet(k) >= 0) continue;
        let below = true; for (let j = 0; j < l; j++) { const kj = ckey(chain[j]); const bj = this.byeAt.get(kj); if (!(bj !== undefined && this.occGet(kj) < 0)) below = false; if (j > 0) { const ej = this.l13EmptyAt.get(kj); if (ej === undefined || TICK - ej > 16) below = false; } } if (!below) continue;
        { const e = this.l13EmptyAt.get(k); if (e === undefined || TICK - e > 16) { this.l13Meet(true); continue; } const se = this.l13SentAt.get(k); if (se !== undefined && e <= se) { this.l13Meet(true); continue; } }
        if (this.rmWitness(chain[l], -1)) return chain[l];
      }
      return null;
    },

    // ---- L13.7: rows densify now ----
    // C++: mesh_heal.inc:Seat::l13RowBelow
    l13RowBelow(k) {
      { const hc = this.l13HeirCallAt.get(k); if (hc !== undefined && this.TICK - hc <= K.LEASE_T) return true; }
      let since = -1, vac = false; { const b = this.byeAt.get(k); if (b !== undefined) since = b; const v = this.l13VacAt.get(k); if (v !== undefined && v >= since) { since = v; vac = true; } }
      if (since < 0 || vac) return false;
      const bk = this.l13ByeKids.get(k); if (bk !== undefined && bk[0] === 0 && bk[1] >= since) return false;
      if (this.l13('L13.21') && this.TICK - since > K.LEASE_T) return false;
      return true;
    },
    // C++: mesh_heal.inc:Seat::rowPull
    rowPull() {
      if (!this.l13('L13.7') || !this.hasCoord || this.state !== 3 || this.coord.pc === 0 || this.coord.i !== 0 || this.moving || this.TICK - this.seatedAt < 16) return;
      const id = this.id; const TICK = this.TICK;
      { const oc = this.ownerCoord(); if (oc) { const ok = ckey(oc); if (this.occGet(ok) < 0 || (!this.firstHandLive(ok) && TICK - this.lastAck > 16)) return; } }
      if (TICK - this.l9PullAt < K.L9_PULL) return;
      const ks = []; if (this.hasChildren()) ks.push(id);
      for (let j = 1; j < C; j++) { const c = cell(this.coord.pc, this.coord.r, j); const k = ckey(c); const x = this.occGet(k); if (x < 0 || x === id || this.translost.has(k)) continue; const kf = this.kidful.get(k); const kid = (kf !== undefined && kf) || this.hasDownChild(c); if (kid) ks.push(x); }
      if (ks.length === 0) return;
      const wait = 8 * pcDepth(this.coord.pc); let any = false;
      for (let j = 1; j < C; j++) {
        const c = cell(this.coord.pc, this.coord.r, j); const k = ckey(c);
        if (this.occGet(k) >= 0 || this.softSitting(k) || this.sitting.has(k) || this.hasDownChild(c) || this.occGet(ckey(down(c))) >= 0) continue;
        let since = -1; { const b = this.byeAt.get(k); if (b !== undefined && (TICK - b <= K.LEASE_T || this.l13('L13.21'))) since = b; const v = this.l13VacAt.get(k); if (v !== undefined && TICK - v <= K.LEASE_T && v > since) since = v; }
        if (since < 0 || TICK - since < wait) continue;
        if (this.l13RowBelow(k)) { const hc = this.l13HeirCallAt.get(k); const co = this.childOf.get(k); this.trace('ROW-PULL-HOLD', id, c, 'since=%lld call=%d childOf=%d', since, hc === undefined ? -1 : hc, co === undefined ? -2 : co); continue; }
        const p = this.l9PullCell.get(k); if (p !== undefined && TICK - p < K.CONFIRM_TTL) continue;
        const pn = ins(this.l9PullN, k, () => 0); this.l9PullN.set(k, (pn + 1) >>> 0); const n = pn | 0; const x = ks[n % ks.length];
        const nb = []; const ol = ownedLinks(c); const nl = ol.length; for (let q = 0; q < nl; q++) { const y = (ckey(ol[q]) === ckey(this.coord)) ? id : this.occGet(ckey(ol[q])); if (y >= 0) nb.push({ k: ckey(ol[q]), v: y }); }
        if (!this.rmName(c, -1, nb)) continue;
        { const b = this.byeAt.get(k); const v = this.l13VacAt.get(k); this.l9PullCell.set(k, TICK | 0); any = true; this.trace('ROW-PULL', id, c, 'via=%d n=%d bye=%d vac=%d dep=%d', x, n, b === undefined ? -1 : b, v === undefined ? -1 : v, this.l12DepartAt); }
        if (x === id) { this.findLeaf(c, nb, 0, 12); } else { this.emit(x, flMsg(c, nb, 0, 12)); }
      }
      if (any) { this.l9PullAt = TICK | 0; if (this.coord.pc !== 0 && this.coord.i === 0) this.phoneHome(false); }
    },
    // L13.8: the owner pulls at the lease.
    // C++: mesh_heal.inc:Seat::ownerPull
    ownerPull() {
      if (!this.l13('L13.8') || !this.hasCoord || this.state !== 3 || this.moving) return;
      const id = this.id; const TICK = this.TICK;
      { const dk0 = ckey(down(this.coord)); const p = this.l9PullCell.get(dk0); if (p !== undefined && TICK - p < 2 * K.CONFIRM_TTL) return; }
      if (TICK - this.l13OwnerPullAt < K.CONFIRM_TTL) return;
      const d = down(this.coord); const dk = ckey(d);
      { const x = this.occGet(dk); if (x >= 0) { const pb = this.pongBy.get(dk); if (this.firstHandLive(dk) || (pb !== undefined && pb[0] === x && pb[1] >= this.seatedAt)) return; } }
      if (this.softSitting(dk) || this.sitting.has(dk)) return;
      if (TICK - this.seatedAt < K.LEASE_T + 16) return;
      if (this.rowLedgerAt >= 0 && TICK - this.rowLedgerAt < K.LEASE_T) return;
      { const b = this.byeAt.get(dk); if (b !== undefined && TICK - b <= K.LEASE_T) return; }
      let heirs = false; for (let j = 1; j < C; j++) { const k = ckey(cell(d.pc, d.r, j)); const c = this.childOf.get(k); if (c !== undefined && c >= 0 && this.occGet(k) < 0) heirs = true; }
      { const c = this.childOf.get(dk); if (c !== undefined && c >= 0) { const pb = this.pongBy.get(dk); if (pb !== undefined && pb[1] >= this.seatedAt) return; } }
      if (!heirs) {
        const hc = this.l13HeirCallAt.get(dk); if (hc !== undefined && TICK - hc <= K.LEASE_T) return;
        let filler = -1; for (let j = C - 1; j >= 1; j--) { const k = ckey(cell(d.pc, d.r, j)); const x = this.occGet(k); if (x < 0 || x === id || this.translost.has(k)) continue; const c = unck(k); if (this.hasDownChild(c)) continue; const kf = this.kidful.get(k); if (kf !== undefined && kf) continue; const pb = this.pongBy.get(k); const heard = this.firstHandLive(k) || (pb !== undefined && pb[0] === x && TICK - pb[1] <= K.LEASE_T); if (!heard) continue; filler = x; break; }
        if (filler < 0) { return; }
        const nb = []; nb.push({ k: ckey(this.coord), v: id }); { const ol = ownedLinks(d); const nl = ol.length; for (let q = 0; q < nl; q++) { const k = ckey(ol[q]); if (k === ckey(this.coord)) continue; const x = this.occGet(k); if (x >= 0 && x !== id && x !== filler) nb.push({ k, v: x }); } }
        if (!this.rmName(d, -1, nb)) { this.trace('OWNER-PULL-NOWIT', id, d, 'mate'); return; }
        this.l13OwnerPullAt = TICK | 0; this.l9PullCell.set(dk, TICK | 0); this.trace('OWNER-PULL', id, d, 'mate=%d', filler);
        this.emit(filler, flMsg(d, nb, 0, 0)); return;
      }
      this.trace('OWNER-PULL-TRY', id, d, 'seated=%lld', TICK - this.seatedAt);
      const ks = [];
      if (this.coord.pc === 0) { for (let q = 0; q < C * C; q++) { const cc_ = cell(0, Math.floor(q / C), q % C); const k = ckey(cc_); if (k === ckey(this.coord)) continue; const x = this.occGet(k); if (x < 0 || x === id) continue; const kf = this.kidful.get(k); const ch = this.childOf.get(k); if ((kf !== undefined && kf && this.firstHandLive(k)) || (ch !== undefined && ch >= 0)) ks.push(x); } }
      else { for (let j = 1; j < C; j++) { const c = cell(this.coord.pc, this.coord.r, j); const k = ckey(c); const x = this.occGet(k); if (x < 0 || x === id || this.translost.has(k)) continue; const kf = this.kidful.get(k); if ((kf !== undefined && kf) || this.hasDownChild(c)) ks.push(x); } }
      if (ks.length === 0) { this.trace('OWNER-PULL-NOSRC', id, d, '-'); return; }
      const nb = []; nb.push({ k: ckey(this.coord), v: id }); for (let j = 1; j < C; j++) { const k = ckey(cell(d.pc, d.r, j)); const x = this.occGet(k); if (x >= 0 && x !== id) nb.push({ k, v: x }); }
      if (!this.rmName(d, -1, nb)) { this.trace('OWNER-PULL-NOWIT', id, d, '-'); return; }
      this.l13OwnerPullAt = TICK | 0; this.l9PullCell.set(dk, TICK | 0); const pn = ins(this.l9PullN, dk, () => 0); this.l9PullN.set(dk, (pn + 1) >>> 0); const n = pn | 0; const x = ks[n % ks.length]; this.trace('OWNER-PULL', id, d, 'via=%d', x);
      this.emit(x, flMsg(d, nb, this.coord.pc === 0 ? 2 * (C - 1) : 0, 12));
    },
    // L14 (page-adapter 4.5/4.6): the far end of a head's uplink offer decides from its own state.
    // C++: mesh_heal.inc:Seat::l14Offer
    l14Offer(m) {
      const h = m.id; if (h < 0 || h === this.id || this.dead) return;
      const v = m.tag === 1 ? 0 : this.f.fabricUpTake(this.id, h);
      if (v === 0) {
        if (this.l14Served.size > 64) { for (const [x] of [...this.l14Served]) { const ls = this.f.fabricLinkState(this.id, x); if (ls !== LS_OPEN && ls !== LS_DIALING) this.l14Served.delete(x); } }
        this.l14Served.set(h, this.TICK | 0); return;
      }
      const ref = [];
      if (v === 2 && this.hasCoord && this.state === 3) { const rc = this.rosterCells(); for (let j = 0; j < C; j++) { const k = ckey(rc[j]); const y = this.occGet(k); if (y < 0 || y === this.id || y === h || !this.firstHandLive(k)) continue; ref.push(y); } }
      this.f.fabricUpDecline(this.id, h, ref);
    },
    // C++: mesh_heal.inc:Seat::l14Declined
    l14Declined(m) {
      const x = m.id; if (x < 0 || x === this.id) return;
      this.dials.failed(x, this.TICK, false); this.l14Failed.set(x, this.TICK | 0); this.l14Refused.add(x); this.trace('L14-FAIL', this.id, null, 'to=%d ls=declined refer=%zu', x, m.list.length);
      for (const r of m.list) if (r >= 0 && r !== this.id) this.l14Refer.push(r); if (this.l14Refer.length > 16) this.l14Refer.splice(0, this.l14Refer.length - 16);
      if (this.l14Up === x) this.l14Up = -1;
    },
  });

  // (1ULL<<50) | hmix64(hmixId(H_INIT, x), ckey(hole)): (hole, x) as a 32-bit hash under bit 50 (no ckey has it)
  // C++: mesh_heal.inc:Seat::findLeaf
  function l9FwdKey(k, x) { return 2 ** 50 + hash.hmix64(hash.hmixId(hash.H_INIT, x), k); }

  const api = { l1RowEmpty, l1HeirFailed, l1RightCell, l1ColCell, l9RoomAllHome, l9PullSmall, l9PullHold, l1MoverCell, l1HasMover, rmWitCells, l13Ring, l13Witness, l13Chain, l13Line, L13_CHAIN_MAX, l9FwdKey };
  GifOS.meshHeal = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
