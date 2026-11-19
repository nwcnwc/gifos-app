/*
 * gaps4.js: L40 (gaps4), a same-cell contest of two unproven claims ends with one seat, seat side (C++: mesh_gaps4.inc).
 * Methods only, added to the Seat; callees other units define are called by name on the Seat.
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
  const K = C_.consts, E = C_.enums;
  const { ckey, unckey: unck } = topo;
  const newMsg = (t) => msg.newMsg(t);
  const TWO32 = 4294967296;

  // L40.6 THE ORDER IS DRAWN, AFTER BOTH SEATS HOLD THEIR IDS, AND A CELL IS DRAWN FOR ONCE (docs/healing-laws.md "L40.6").
  // A page id is H(pubkey) of a key the page makes itself, so a rank of the cell and the id alone could be chosen. Each seat
  // holds a secret lot per rival; a lot frame (CHALLENGE tag 28, signed by its author) leads every frame of the contest:
  // the lot's commitment, and the open lot once the sender holds the rival's commitment. The rank takes both lots.
  // C++: mesh_gaps4.inc:l40Com   [the commitment of x's lot for cell ck; 0 is "none"]
  function l40Com(lot, x, ck) { const c = hash.fmix32(hash.hmix64(hash.hmixId(hash.hmix((hash.H_INIT ^ 0x6c6f74) >>> 0, lot >>> 0), x), ck)); return c ? c : 1; }
  // C++: mesh_gaps4.inc:l40Rank   [hmix64 of ck ^ 0x4c3430: the xor touches the low word only]
  function l40Rank(ck, x, lots) { return hash.hmix64(hash.hmixId(hash.hmix(hash.H_INIT, lots >>> 0), x), hash.hi32(ck) * TWO32 + ((hash.lo32(ck) ^ 0x4c3430) >>> 0)); }
  // The sim's lot (C++: the draw inside Seat::l40DrawOf): a hash of the run's seed, the tick, the two seats and the cell. Only a
  // harness fabric calls it (fabricLot): a page has no fabricLot and draws from crypto.getRandomValues.
  function simLot(seed0, tick, id, rival, ck) { const l = hash.fmix32(hash.hmix64(hash.hmixId(hash.hmixId(hash.hmix(((seed0 >>> 0) ^ 0x4c343036) >>> 0, tick >>> 0), id), rival), ck)); return l ? l : 1; }
  function pageLot() { const a = new Uint32Array(1); (root.crypto || globalThis.crypto).getRandomValues(a); return a[0] ? a[0] : 1; }

  Seat.unit('mesh_gaps4.inc', {
    // C++: mesh_gaps4.inc:Seat::l40Go
    // my lot for this rival in the cell I hold (made on the first frame of the contest; it lives as long as L25.9 counts one contest)
    // C++: mesh_gaps4.inc:Seat::l40DrawOf
    l40DrawOf(rival) {
      if (rival < 0 || rival === this.id || !this.hasCoord || this.state !== 3) return null; const ck = ckey(this.coord);
      let d = this.l40Dr.get(rival); if (d !== undefined && (d.ck !== ck || this.TICK - d.at > K.L25_ORD_AGE)) { this.l40Dr.delete(rival); d = undefined; }
      if (d === undefined) { if (this.l40Dr.size >= 32) this.l40Dr.clear();
        const lot = this.f.fabricLot ? this.f.fabricLot(this.id, rival, ck, this.TICK) : pageLot();
        d = { ck, lot: lot >>> 0, com: 0, theirs: 0, at: this.TICK | 0, due: -1 }; this.l40Dr.set(rival, d); }
      return d;
    },
    // The lot frame, ahead of the question, the answer or the tell it belongs to and by the same path (by: the arbiter, L25.18).
    // C++: mesh_gaps4.inc:Seat::l40DrawPut
    l40DrawPut(rival, by = -1) {
      if (!this.w.lv.LINKMODEL) return; const d = this.l40DrawOf(rival); if (!d) return;
      const c = newMsg('CHALLENGE'); c.tag = 28; c.ck = d.ck; c.from = this.id; c.id = this.id; c.sig = true; c.sigAt = this.TICK | 0; c.dc = l40Com(d.lot, this.id, d.ck); if (d.com) c.dn = d.lot;   // I open only to a rival that is bound
      if (by >= 0 && by !== this.id && by !== rival) { c.via = rival; this.f.fabricCallFrame(this.id, by, c); } else this.f.fabricCallFrame(this.id, rival, c);
    },
    // a lot frame: passed on to the seat it is for (over my open channel), or taken from its author's own signed frame
    // C++: mesh_gaps4.inc:Seat::l40DrawIn
    l40DrawIn(m) {
      if (m.tag !== 28) return false; if (!this.w.lv.LINKMODEL || !this.provenEv(m, m.id)) return true;
      if (m.via >= 0 && m.via !== this.id) { const ok = this.f.fabricLinkState(this.id, m.via) === E.LS_OPEN; this.trace('L40-LOT-PASS', this.id, this.hasCoord ? this.coord : null, 'from=%d to=%d ok=%d', m.id, m.via, ok ? 1 : 0); if (ok) { const f = msg.clone(m); f.from = this.id; this.f.fabricCallFrame(this.id, m.via, f); } return true; }
      this.l40DrawTake(m, m.id); return true;
    },
    // C++: mesh_gaps4.inc:Seat::l40DrawTake
    l40DrawTake(m, rival) {
      if (!m.dc || !this.hasCoord || this.state !== 3 || m.ck !== ckey(this.coord)) return; const d = this.l40DrawOf(rival); if (!d) return;
      if (!d.com) d.com = m.dc >>> 0;   // the first commitment binds the rival for the life of my lot
      if (m.dn && !d.theirs && l40Com(m.dn, rival, d.ck) === d.com) d.theirs = m.dn >>> 0;
      this.trace('L40-LOT', this.id, this.coord, 'rival=%d bound=%d open=%d', rival, d.com === (m.dc >>> 0) ? 1 : 0, d.theirs ? 1 : 0);
    },
    l40Go(rival, why) {
      if (rival >= 0 && rival !== this.id && this.hasCoord && this.state === 3) { const r = this.l828RingOf(rival); const rn = this.ringName(); if (r >= 0 && rn >= 0 && r !== rn && this.ringOlder(r, this.lineAtOf(rival), rn, this.lineAt)) this.l851Note(r + 1, this.lineAtOf(rival)); }   // L8.5.1: I leave my cell to a lower ring
      this.l40To = rival; this.requeue(why); this.l40To = -1;
    },

    // C++: mesh_gaps4.inc:Seat::l404Empty   [L40.4: nobody left in the rook to ask; a third seat in it yielded me naming the rival]
    l404Empty(rival) {
      if (this.l25WitAskedN !== 0 || this.l25By < 0 || this.l25By === this.id || this.l25By === rival || rival < 0) return false;
      const ol = topo.ownedLinks(this.coord); for (let k = 0; k < ol.length; k++) if (this.occGet(ckey(ol[k])) === this.l25By) return true;
      return false;
    },

    // L40.5: a rook's majority over a reading with none, in every unproven contest (L25.12 / L25.13 as L40.2 (a)).
    // C++: mesh_gaps4.inc:Seat::l405Kept   [my rook keeps me against this rival: L25.9's WITNESSED reading]
    l405Kept(rival) { return !!this.w.lv.LINKMODEL && rival >= 0 && rival === this.l25WitRivalId && this.l25WitMe > this.l25WitRival && 2 * this.l25WitMe > this.l25WitAskedN && this.l25WitMe >= K.L25_WIT_MIN; },
    // C++: mesh_gaps4.inc:Seat::l405Rooked   [the teller's rook keeps it, a witness of mine hears it, my rook does not keep me]
    l405Rooked() { return !!this.w.lv.LINKMODEL && this.l40ToldK && this.l40ToldBy >= 0 && this.l40ToldBy === this.l25WitRivalId && this.l25WitRival > 0 && !this.l405Kept(this.l25WitRivalId); },
    // C++: mesh_gaps4.inc:Seat::l405Back   [a told seat its rook keeps tells the teller, unless the teller said the same]
    l405Back(x) { if (!this.l405Kept(x) || (this.l40ToldK && this.l40ToldBy === x)) return; this.l2512Tell(x); },

    // C++: mesh_gaps4.inc:Seat::l40Tell
    l40Tell(rival, kept) {
      if (!this.w.lv.LINKMODEL || rival < 0 || rival === this.id || !this.hasCoord || this.state !== 3 || this.TICK - this.l2512TellAt <= K.L25_WAIT) return;
      this.l2512TellAt = this.TICK;
      const c = newMsg('CHALLENGE'); c.ck = ckey(this.coord); c.from = this.id; c.tag = 27; c.hold = kept ? 1 : 0; this.l40DrawPut(rival);   /* L40.6: my lot, ahead of the tell */ this.f.fabricCallFrame(this.id, rival, c);
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
      const told = this.l40ToldBy === m.id && this.TICK - this.l40ToldAt <= K.L25_WAIT;   // L25.12.1: the rival read my answer and told me it stays: my proof is none its view admits, so I order as it does
      if (mine && told) this.trace('L40-MINE-TOLD', this.id, this.coord, 'rival=%d', m.id);
      if (mine && !told) { this.trace('L40-MINE', this.id, this.coord, 'rival=%d', m.id); if (this.l40Arb || this.l25WitRival > 0) this.l40Tell(m.id, false); else this.l2512TellHeard(m.id); return true; }   // my claim carries a proof
      const was = this.l40Rev; this.l40Rev = true; const d = this.l40Decide(false);
      if (d === 0) { this.l25WitPend = true; this.f.wake(this.id); return true; }
      this.l40Rev = false; if (was) this.l25WitPend = false;   /* L40.6: a later answer decided what this contest's own wait left pending */ this.l40Act(d); return true;
    },

    // C++: mesh_gaps4.inc:Seat::l40Act
    l40Act(d) {
      if (d === 1) { this.l40Go(this.l40Riv, 'L40-yield'); return; }
      const corr = this.l40Arb || this.l25WitRival > 0;
      if (corr) this.l40Tell(this.l40Riv, this.l40Kept); else this.l2512TellHeard(this.l40Riv);
    },

    // L40.6: the rival's lot frame may still be on its way (frames pass each other): the order waits for it inside L25.9's window
    // C++: mesh_gaps4.inc:Seat::l40LotDue
    l40LotDue(riv, deadline) {
      if (deadline || (this.l40WonCk === ckey(this.coord) && this.l40WonRiv >= 0)) return false; const d = this.l40DrawOf(riv); if (!d || d.theirs) return false;
      if (d.due < 0) d.due = this.TICK | 0;   // one clock for the contest
      return this.TICK - d.due < K.L25_WAIT;   // L25_WIT_WAIT = L25_WAIT
    },
    // L40.2 (b): am I first in the order of the two claims to my cell (read by L40.2 and by L25.12.1)
    // C++: mesh_gaps4.inc:Seat::l40First
    l40First(riv) {
      const ck = ckey(this.coord); let first, drawn = false;
      if (this.l40WonCk === ck && this.l40WonRiv >= 0) { first = true; this.trace('L40-DRAWN', this.id, this.coord, 'rival=%d won=%d', riv, this.l40WonRiv); }   // L40.6 (4): a cell is drawn for once
      else { const d = this.l40DrawOf(riv);
        if (!d || !d.theirs) { first = true; this.trace('L40-NOLOT', this.id, this.coord, 'rival=%d bound=%d', riv, (d && d.com) ? 1 : 0); }   // L40.6 (3): no lot, no order
        else { const lots = (d.lot ^ d.theirs) >>> 0, ra = l40Rank(ck, this.id, lots), rb = l40Rank(ck, riv, lots); first = ra < rb || (ra === rb && this.id < riv); drawn = true; } }
      { let ea = this.lineAtOf(riv), el = this.lineOf(riv); if ((ea < 0 || el < 0) && this.l25By >= 0 && this.l25By !== this.id) { ea = this.lineAtOf(this.l25By); el = this.lineOf(this.l25By); }
        if (this.coord.pc === 0 && this.lineAt >= 0 && ea >= 0 && ea !== this.lineAt && el >= 0 && el !== this.line && this.lineAt > ea) first = false; }   // L8.52.2: the seat of the younger room is never the first by the rank's coin
      if (first && drawn) { this.l40WonCk = ck; this.l40WonRiv = riv; }   // the draw left me in my cell
      return first;
    },

    // 1 = go, 2 = stay, 0 = answers still due
    // C++: mesh_gaps4.inc:Seat::l40Decide
    l40Decide(deadline) {
      if (this.l25WitAsk.length && !deadline && this.TICK - this.l25WitAt < K.L25_WIT_WAIT) return 0;
      const R = this.l25WitRival, M = this.l25WitMe, A = this.l25WitAskedN; this.l40Kept = false;
      { let ra = this.lineAtOf(this.l40Riv), rl = this.lineOf(this.l40Riv); if ((ra < 0 || rl < 0) && this.l25By >= 0 && this.l25By !== this.id) { ra = this.lineAtOf(this.l25By); rl = this.lineOf(this.l25By); }   /* the rival has not spoken to me: the arbiter that names it stamps its room */   // L8.52.2 (mesh_ring.inc): between two foundings of different age the seat of the older room is the first
        if (this.coord.pc === 0 && this.lineAt >= 0 && ra >= 0 && ra !== this.lineAt && rl >= 0 && rl !== this.line && this.lineAt < ra) { this.l40Kept = true; this.trace('L8.52-ORDER', this.id, this.coord, 'rival=%d mine=%d theirs=%d', this.l40Riv, this.lineAt, ra); return 2; } }
      if (R > M && 2 * R > A && R + 1 >= K.L25_WIT_MIN) { this.trace('L40-OUTVOTED', this.id, this.coord, 'rival=%d kept=%d me=%d asked=%d', this.l40Riv, R, M, A); return 1; }
      if (M > R && 2 * M > A && M >= K.L25_WIT_MIN) { this.l40Kept = true; this.trace('L40-WITNESSED', this.id, this.coord, 'rival=%d kept=%d me=%d asked=%d', this.l40Riv, R, M, A); return 2; }
      const corr = this.l40Arb || R > 0;
      if (!corr) { this.trace('L40-ALONE', this.id, this.coord, 'rival=%d kept=%d me=%d asked=%d', this.l40Riv, R, M, A); return 2; }
      if (this.l40ToldK && this.l40ToldBy === this.l40Riv) { this.trace('L40-ROOKED', this.id, this.coord, 'rival=%d kept=%d me=%d asked=%d', this.l40Riv, R, M, A); return 1; }
      if (this.l40LotDue(this.l40Riv, deadline)) return 0;   // L40.6
      const first = this.l40First(this.l40Riv);
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
      { const hb = this.l152Bye.get(m.nc); const both = this.occGet(m.ck) === m.id && hb !== undefined && hb[0] === m.ck && this.TICK - hb[1] <= K.L25_WAIT;
        if (this.l152Bye.size >= 256) this.l152Bye.clear(); this.l152Bye.set(m.id, [m.ck, this.TICK]);   // L40.3.5: a handed goodbye is the leaver's goodbye from that cell too
        if (both) { this.trace('L40.3.5-BOTH', this.id, this.hasCoord ? this.coord : null, 'cell=%s by=%d named=%d', coordStr(unck(m.ck)), m.id, m.nc); return false; } }   // L40.3.5: the seat it names left that cell too
      if (this.hasCoord && ckey(this.coord) === m.ck) return true;   // the rival left my cell to me
      if (this.occGet(m.ck) !== m.id) return true;   // my view names someone else there, or nobody
      this.linkedBy.delete(m.ck); this.tenOf.delete(m.ck); this.live.delete(m.ck); this.setOcc(m.ck, m.nc);
      this.trace('L40-HANDED', this.id, this.hasCoord ? this.coord : null, 'cell=%s to=%d by=%d', coordStr(unck(m.ck)), m.nc, m.id);
      return true;
    },
  });
  GifOS.meshGaps4 = Object.freeze({ l40Rank, l40Com, simLot });
  if (isNode) module.exports = GifOS.meshGaps4;
})(typeof window !== 'undefined' ? window : globalThis);
