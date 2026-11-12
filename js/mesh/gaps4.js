/*
 * gaps4.js: L40 (gaps4), a same-cell contest of two unproven claims ends with one seat, seat side (C++: mesh_gaps4.inc).
 * Methods only, added to the Seat; callees other units define are called by name on the Seat.
 * L40_OFF (a build-time switch in the sim, 0 in the release) is not ported: every law here is on.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const { coordStr } = req('./shared.js', 'meshShared');
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const hash = req('./hash.js', 'meshHash');
  const K = C_.consts;
  const { ckey, unckey: unck } = topo;
  const newMsg = (t) => msg.newMsg(t);
  const TWO32 = 4294967296;
  // the sim's #define L8_52_OFF in mesh.cpp (a build-time switch): MESH_L8_52_OFF=1 under node, read once at load; a page always runs the law
  const L8_52_OFF = (isNode && typeof process !== 'undefined' && process.env && process.env.MESH_L8_52_OFF === '1') ? 1 : 0;

  // C++: mesh_gaps4.inc:l40Rank   [hmix64 of ck ^ 0x4c3430: the xor touches the low word only]
  function l40Rank(ck, x) { return hash.hmix64(hash.hmixId(hash.H_INIT, x), hash.hi32(ck) * TWO32 + ((hash.lo32(ck) ^ 0x4c3430) >>> 0)); }

  Seat.unit('mesh_gaps4.inc', {
    // C++: mesh_gaps4.inc:Seat::l40Go
    l40Go(rival, why) {
      if (rival >= 0 && rival !== this.id && this.hasCoord && this.state === 3) { const r = this.l828RingOf(rival); if (r >= 0 && r !== this.ringName() && this.ringOlder(r, this.lineAtOf(rival), this.ringName(), this.lineAt)) this.l851Note(r + 1, this.lineAtOf(rival)); }   // L8.5.1: I leave my cell to a lower ring
      this.l40To = rival; this.requeue(why); this.l40To = -1;
    },

    // C++: mesh_gaps4.inc:Seat::l404Empty   [L40.4: nobody left in the rook to ask; a third seat in it yielded me naming the rival]
    l404Empty(rival) {
      if (this.l25WitAskedN !== 0 || this.l25By < 0 || this.l25By === this.id || this.l25By === rival || rival < 0) return false;
      const ol = topo.ownedLinks(this.coord); for (let k = 0; k < ol.length; k++) if (this.occGet(ckey(ol[k])) === this.l25By) return true;
      return false;
    },

    // C++: mesh_gaps4.inc:Seat::l40Tell
    l40Tell(rival, kept) {
      if (!this.w.lv.LINKMODEL || rival < 0 || rival === this.id || !this.hasCoord || this.state !== 3 || this.TICK - this.l2512TellAt <= K.L25_WAIT) return;
      this.l2512TellAt = this.TICK;
      const c = newMsg('CHALLENGE'); c.ck = ckey(this.coord); c.from = this.id; c.tag = 27; c.hold = kept ? 1 : 0; this.f.fabricCallFrame(this.id, rival, c);
      this.trace('L40-TELL', this.id, this.coord, 'rival=%d kept=%d', rival, kept ? 1 : 0);
    },

    // The rival's answer to my question about my cell carried neither a placement nor a move proof. True: handled here.
    // C++: mesh_gaps4.inc:Seat::l40Unproven
    l40Unproven(m) {
      if (!this.w.lv.LINKMODEL || !this.hasCoord || this.state !== 3 || m.id < 0 || m.id === this.id) return false;
      if (!(m.pp < 0 && m.mpK === 0)) return false;   // a rival with a claim of some kind: L25.13 orders it
      if (this.l2512Q === m.id) this.l2512Q = -1;
      this.l40Riv = m.id; this.l40Ck = m.ck; this.l40Arb = this.l40Arb || (this.l25By >= 0 && this.l25By !== m.id);   // L40.2.1: an arbiter's word for this rival stands for the whole contest
      if (this.l40ToldBy !== m.id || this.TICK - this.l40ToldAt > K.L25_WAIT) this.l40ToldK = false;
      const mine = (this.pp >= 0 && this.ppCk === ckey(this.coord)) || (this.mpK > 0 && this.mpCk === ckey(this.coord));
      if (mine) { this.trace('L40-MINE', this.id, this.coord, 'rival=%d', m.id); if (this.l40Arb || this.l25WitRival > 0) this.l40Tell(m.id, false); else this.l2512TellHeard(m.id); return true; }   // my claim carries a proof
      this.l40Rev = true; const d = this.l40Decide(false);
      if (d === 0) { this.l25WitPend = true; this.f.wake(this.id); return true; }
      this.l40Rev = false; this.l40Act(d); return true;
    },

    // C++: mesh_gaps4.inc:Seat::l40Act
    l40Act(d) {
      if (d === 1) { this.l40Go(this.l40Riv, 'L40-yield'); return; }
      const corr = this.l40Arb || this.l25WitRival > 0;
      if (corr) this.l40Tell(this.l40Riv, this.l40Kept); else this.l2512TellHeard(this.l40Riv);
    },

    // 1 = go, 2 = stay, 0 = answers still due
    // C++: mesh_gaps4.inc:Seat::l40Decide
    l40Decide(deadline) {
      if (this.l25WitAsk.length && !deadline && this.TICK - this.l25WitAt < K.L25_WIT_WAIT) return 0;
      const R = this.l25WitRival, M = this.l25WitMe, A = this.l25WitAskedN; this.l40Kept = false;
      { let ra = this.lineAtOf(this.l40Riv), rl = this.lineOf(this.l40Riv); if ((ra < 0 || rl < 0) && this.l25By >= 0 && this.l25By !== this.id) { ra = this.lineAtOf(this.l25By); rl = this.lineOf(this.l25By); }   /* the rival has not spoken to me: the arbiter that names it stamps its room */   // L8.52.2 (mesh_ring.inc): between two foundings of different age the seat of the older room is the first
        if (!L8_52_OFF && this.coord.pc === 0 && this.lineAt >= 0 && ra >= 0 && ra !== this.lineAt && rl >= 0 && rl !== this.line && this.lineAt < ra) { this.l40Kept = true; this.trace('L8.52-ORDER', this.id, this.coord, 'rival=%d mine=%d theirs=%d', this.l40Riv, this.lineAt, ra); return 2; } }
      if (R > M && 2 * R > A && R + 1 >= K.L25_WIT_MIN) { this.trace('L40-OUTVOTED', this.id, this.coord, 'rival=%d kept=%d me=%d asked=%d', this.l40Riv, R, M, A); return 1; }
      if (M > R && 2 * M > A && M >= K.L25_WIT_MIN) { this.l40Kept = true; this.trace('L40-WITNESSED', this.id, this.coord, 'rival=%d kept=%d me=%d asked=%d', this.l40Riv, R, M, A); return 2; }
      const corr = this.l40Arb || R > 0;
      if (!corr) { this.trace('L40-ALONE', this.id, this.coord, 'rival=%d kept=%d me=%d asked=%d', this.l40Riv, R, M, A); return 2; }
      if (this.l40ToldK && this.l40ToldBy === this.l40Riv) { this.trace('L40-ROOKED', this.id, this.coord, 'rival=%d kept=%d me=%d asked=%d', this.l40Riv, R, M, A); return 1; }
      const ck = ckey(this.coord), ra = l40Rank(ck, this.id), rb = l40Rank(ck, this.l40Riv);
      const first = ra < rb || (ra === rb && this.id < this.l40Riv);
      this.trace('L40-ORDER', this.id, this.coord, 'rival=%d %s kept=%d me=%d asked=%d arb=%d', this.l40Riv, first ? 'first' : 'later', R, M, A, this.l40Arb ? 1 : 0);
      return first ? 2 : 1;
    },

    // A tell that lands while I wait on another question is held, and put as soon as the slot frees (within 4*L25_WAIT).
    // C++: mesh_gaps4.inc:Seat::l40Keep
    l40Keep(m) { if (!this.w.lv.LINKMODEL || !this.hasCoord || this.state !== 3 || ckey(this.coord) !== m.ck) return; this.l40Held = msg.clone(m); this.l40Hold = true; this.f.wake(this.id); this.trace('L40-HELD', this.id, this.coord, 'teller=%d', m.from); },

    // C++: mesh_gaps4.inc:Seat::l40Tick
    l40Tick() {
      if (!this.hasCoord || this.state !== 3 || this.moving || ckey(this.coord) !== this.l40Held.ck || this.TICK - this.l40ToldAt > 4 * K.L25_WAIT) { this.l40Hold = false; return; }
      if ((this.TICK - this.l25At <= K.L25_WAIT && this.l25Nc >= 0) || this.l25WitPend) { this.f.wake(this.id); return; }
      this.l40Hold = false; this.l40Told(this.l40Held); this.l2512Heard(this.l40Held);
    },

    // C++: mesh_gaps4.inc:Seat::l40Told
    l40Told(m) { this.l40ToldBy = m.from; this.l40ToldAt = this.TICK; this.l40ToldK = m.hold === 1; },

    // L40.3: a goodbye that names the cell's holder. True: handled.
    // C++: mesh_gaps4.inc:Seat::l40Handed
    l40Handed(m) {
      if (m.tag !== 40 || m.nc < 0 || m.nc === m.id) return false;
      if (this.hasCoord && ckey(this.coord) === m.ck) return true;   // the rival left my cell to me
      if (this.occGet(m.ck) !== m.id) return true;   // my view names someone else there, or nobody
      this.linkedBy.delete(m.ck); this.tenOf.delete(m.ck); this.live.delete(m.ck); this.setOcc(m.ck, m.nc);
      this.trace('L40-HANDED', this.id, this.hasCoord ? this.coord : null, 'cell=%s to=%d by=%d', coordStr(unck(m.ck)), m.nc, m.id);
      return true;
    },
  });
  GifOS.meshGaps4 = Object.freeze({ l40Rank });
  if (isNode) module.exports = GifOS.meshGaps4;
})(typeof window !== 'undefined' ? window : globalThis);
