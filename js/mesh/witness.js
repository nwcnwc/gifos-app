/*
 * witness.js: L25.9 the rook's witnesses (C++: mesh_witness.inc). Methods only, added to the Seat; callees other units define are called by name on the Seat.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const { cellOk } = req('./shared.js', 'meshShared');
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const K = C_.consts;
  const { ckey, ownedLinks } = topo;
  const newMsg = (t) => msg.newMsg(t);

  Seat.unit('mesh_witness.inc', {
    // C++: mesh_witness.inc:Seat::l25WitHeard
    l25WitHeard(k) { const o = this.occGet(k); if (o < 0 || o === this.id) return -1; return this.heardAt(k); },

    // C++: mesh_witness.inc:Seat::l25WitAskAll
    l25WitAskAll() {
      if (this.l25WitPend && this.TICK - this.l25WitAt < K.L25_WIT_WAIT) return;
      this.l25WitAsk.length = 0; this.l25WitMe = 0; this.l25WitRival = 0; this.l25WitAt = this.TICK; this.l25WitPend = false; this.l25WitRivalId = this.l25Nc; this.l25WitAskedN = 0;
      if (!this.hasCoord || this.state !== 3) return;
      if (this.l25Nc !== this.l25WitSinceNc || this.l25Ck !== this.l25WitSinceCk || this.TICK - this.l25WitLast > K.L25_ORD_AGE) { this.l25WitSince = this.TICK; this.l25WitSinceNc = this.l25Nc; this.l25WitSinceCk = this.l25Ck; this.l40Arb = false; }   // L40.2.1: a new contest has no arbiter's word yet
      this.l25WitLast = this.TICK;
      const ol = ownedLinks(this.coord), n = ol.length;
      let rook = 0;
      for (let k = 0; k < n; k++) {
        const ck = ckey(ol[k]); const w = this.occGet(ck); if (w < 0 || w === this.id || w === this.l25Nc || w === this.l25By) continue; let dup = false; for (const x of this.l25WitAsk) if (x === w) dup = true; if (dup) continue; rook++; if (this.l25WitHeard(ck) !== w) continue;
        this.l25WitAsk.push(w); const c = newMsg('CHALLENGE'); c.ck = this.l25Ck; c.from = this.id; c.tag = 26; c.nc = this.l25Nc; this.emit(w, c);
      }
      this.l25WitAskedN = rook; if (this.l25WitAsk.length) this.trace('L25-WITASK', this.id, this.coord, 'by=%d rival=%d witnesses=%zu rook=%d', this.l25By, this.l25Nc, this.l25WitAsk.length, rook);
    },

    // C++: mesh_witness.inc:Seat::l25WitAnswer
    l25WitAnswer(m) {
      if (!this.hasCoord || this.state !== 3 || m.from < 0 || m.from === this.id || !this.linkIs(m, m.from) || !cellOk(m.ck) || !this.ownedLinkCell(m.ck)) return;
      const w = newMsg('WITNESS'); w.ck = m.ck; w.id = this.id; w.nc = this.l25WitHeard(m.ck); w.tag = (m.nc >= 0 && m.nc !== this.id && this.l25WitClaimed(m.nc, m.ck)) ? 1 : 0; w.sig = true; w.sigAt = this.TICK; w.born = this.seatedAt;
      if (this.f.fabricDoors()) this.f.fabricCallFrame(this.id, m.from, w); else this.emit(m.from, w);   // L25.9.2: over the pc the question came on
    },

    // C++: mesh_witness.inc:Seat::l25WitClaimed
    l25WitClaimed(x, k) {
      const c = this.l22Cell.get(x); if (c !== undefined && c[0] === k && this.TICK - c[1] <= 60) return true;
      const p = this.pongBy.get(k); if (p !== undefined && p[0] === x && this.TICK - p[1] <= 60) return true;
      const lb = this.liveBy.get(k); return lb !== undefined && lb === x && this.firstHandLive(k);
    },

    // C++: mesh_witness.inc:Seat::l25WitVote
    l25WitVote(m) {
      if (!this.hasCoord || this.state !== 3 || m.id < 0 || m.id === this.id || !this.provenEv(m, m.id) || m.ck !== this.l25Ck || m.ck !== ckey(this.coord) || this.TICK - this.l25WitAt > K.L25_WIT_WAIT) return;
      let asked = false; for (let q = 0; q < this.l25WitAsk.length; q++) if (this.l25WitAsk[q] === m.id) { asked = true; this.l25WitAsk.splice(q, 1); break; }
      if (!asked) return;
      if (m.born > this.l25WitSince) { if (this.l25WitAskedN > 0) this.l25WitAskedN--; this.trace('L25-WITLATE', this.id, this.coord, 'witness=%d seated=%lld since=%d', m.id, m.born, this.l25WitSince); if (this.l25WitPend) this.l25WitTick(); return; }
      if (m.nc === this.id) this.l25WitMe++; if ((m.nc >= 0 && m.nc === this.l25WitRivalId) || m.tag === 1) this.l25WitRival++;
      this.l2512Witness();
      if (this.l25WitPend) this.l25WitTick();
    },

    // C++: mesh_witness.inc:Seat::l25WitDecide
    l25WitDecide(deadline) {
      if (this.l25WitAsk.length && !deadline && this.TICK - this.l25WitAt < K.L25_WIT_WAIT) return 0;
      if (this.l25WitRival > this.l25WitMe) { this.trace('L25-OUTVOTED', this.id, this.coord, 'rival=%d me=%d asked=%d unanswered=%zu', this.l25WitRival, this.l25WitMe, this.l25WitAskedN, this.l25WitAsk.length); return 1; }
      if (this.l25WitMe > this.l25WitRival && 2 * this.l25WitMe > this.l25WitAskedN && this.l25WitMe >= K.L25_WIT_MIN) { this.trace('L25-WITNESSED', this.id, this.coord, 'rival=%d me=%d asked=%d unanswered=%zu', this.l25WitRival, this.l25WitMe, this.l25WitAskedN, this.l25WitAsk.length); return 2; }
      if (this.l371Keep()) { this.trace('L37.1-KEEP', this.id, this.coord, 'rival=%d me=%d asked=%d unanswered=%zu', this.l25WitRival, this.l25WitMe, this.l25WitAskedN, this.l25WitAsk.length); return 2; }
      if (this.l258Rep && this.l25WitRival < 1) { this.trace('L25.8.1-UNWITNESSED', this.id, this.coord, 'rival=%d me=%d asked=%d unanswered=%zu', this.l25WitRival, this.l25WitMe, this.l25WitAskedN, this.l25WitAsk.length); return 2; }   // L25.8.1: a re-placement moves me only with one counted witness that hears the rival in my cell
      this.trace('L25-WITTHIN', this.id, this.coord, 'rival=%d me=%d asked=%d unanswered=%zu', this.l25WitRival, this.l25WitMe, this.l25WitAskedN, this.l25WitAsk.length); return 1;
    },

    // C++: mesh_witness.inc:Seat::l25WitTick
    l25WitTick() {
      if (!this.l25WitPend) return;
      if (!this.hasCoord || this.state !== 3 || ckey(this.coord) !== this.l25Ck || this.moving) { this.l25WitPend = false; this.l2512Rev = false; this.l2513Rev = false; this.l40Rev = false; return; }
      if (this.l40Rev) { const d = this.l40Decide(this.TICK - this.l25WitAt >= K.L25_WIT_WAIT); if (d === 0) { this.f.wake(this.id); return; } this.l25WitPend = false; this.l40Rev = false; this.l40Act(d); return; }   // L40.2 (gaps4.js)
      const dl = this.TICK - this.l25WitAt >= K.L25_WIT_WAIT;
      const d = this.l2513Rev ? this.l2513Decide(dl) : this.l2512Rev ? this.l2512Decide(dl) : this.l25WitDecide(dl); if (d === 0) { this.f.wake(this.id); return; }
      if (this.l2513Rev) { this.l25WitPend = false; this.l2513Rev = false; if (d === 1) this.l40Go(this.l25WitRivalId, 'L25.13-yield'); return; }
      this.l25WitPend = false; const rev = this.l2512Rev; this.l2512Rev = false; if (d === 1) this.l40Go(this.l25WitRivalId, rev ? 'L25.12-yield' : 'T1-yield'); else if (d === 2 && !rev) this.l2512Tell(this.l25WitRivalId); else if (d === 2) this.l405Back(this.l25WitRivalId);   /* L40.5 (gaps4.js) */
    },
  });
  GifOS.meshWitness = Object.freeze({});
  if (isNode) module.exports = GifOS.meshWitness;
})(typeof window !== 'undefined' ? window : globalThis);
