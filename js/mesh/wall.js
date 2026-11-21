/*
 * wall.js: L52 the people line is a wall in the seating order, seat side (C++: mesh_wall.inc).
 * A hosted room's people line W (the number on its host's signed order) is home cell number W (row * C + column):
 * the home section fills row by row and packs to its front, and one cell holds one seat. No seat places a seeker
 * that showed no ticket of its own at or past that cell. Nothing is counted: a door's fresh admissions are its
 * vouches and its records, which hold their cells already.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const topo = req('./topo.js', 'meshTopo');
  const msg = req('./msg.js', 'meshMsg');
  const dig = req('./dig.js', 'meshDig');
  const K = C_.consts;
  const { ckey, ckPc, ckR, ckI, C } = topo;
  const newMsg = (t) => msg.newMsg(t);
  const { coordStr } = req('./shared.js', 'meshShared');

  Seat.unit('mesh_wall.inc', {
    // My wall: the first home cell number a seeker with no ticket may not have. L52_NONE: no wall. Below 0: not known yet (L52.6).
    // C++: mesh_wall.inc:Seat::l52Wall
    l52Wall() {
      let w = this.f.fabricWall(this.id);
      if (w < 0) return -1;
      if (w === 0 || w > C * C) return K.L52_NONE;   // L52.8: a line above the home section is no wall
      if (this.rootDig.at >= 0) w -= dig.digFar(this.rootDig);   // L52.7: the people behind my room's pipes hold their part of the line
      return w < 0 ? 0 : w;
    },

    // The home cells below wall w in my view, for a seeker nc (L52.2, L52.5). 0: one is free, or is nc's own, or is only late (held
    // for a reload, or its seat said goodbye). 2: every one holds a seat: the room is full. 1: none is free, but one at least is
    // only promised (a vouch, or a record: a word given or a proposal that waits for one): its seeker sits down in it or the
    // promise ends, either way inside its hold: not yet, never full.
    // C++: mesh_wall.inc:Seat::l52Full
    l52Full(w, nc) {
      if (!this.hasCoord || this.coord.pc !== 0) return 0;   // a seat below the home section does not see the home: not yet, never full
      let promised = false; const seen = [];
      for (let o = 0; o < w && o < C * C; o++) {
        const k = ckey({ pc: 0, r: (o / C) | 0, i: o % C });
        if (k === ckey(this.coord)) continue;
        const x = this.occGet(k);
        if (x === nc) return 0;   // the seeker itself, in my view: its cell is its own
        if (x >= 0) {
          if (this.l315Cell(k)) return 0;   // L52.5: held for a seat that may be reloading: it comes back or its goodbye lands, either way inside the hold: not yet
          { const f = this.byeFloor(x, k); if (f >= 0) { const l = this.live.get(k); if (l === undefined || l <= f) return 0; } }   // L52.5: its seat gave me its own goodbye from this cell and I have not heard it there since: the cell is late, never taken
          if (seen.indexOf(x) >= 0) promised = true; else seen.push(x);   // L52.5: one seat in two cells of my view is one person on its way (a mover into a cell a goodbye freed): one of the two is only late
          continue;
        }
        const s = this.sitting.get(k);
        if (s !== undefined && this.softSitting(k)) { if (s.joiner === nc) return 0; promised = true; continue; }
        if (this.l31Held(k, nc)) { promised = true; continue; }
        return 0;
      }
      return promised ? 1 : 2;
    },

    // The wall's answer (L52.3): a NOROOM of its own tag, from me, and the page is told (L52.5).
    // C++: mesh_wall.inc:Seat::l52Refuse
    l52Refuse(nc, gwc, full, site, c) {
      this.trace('L52-WALL', this.id, c ? c : (this.hasCoord ? this.coord : null), 'nc=%d full=%d site=%s', nc, full ? 1 : 0, site);
      this.f.fabricWalled(this.id, nc, full);
      const m = newMsg('NOROOM'); m.tag = K.L52_TAG; m.gwc = gwc; m.id = this.id; m.nd = 0; this.emit(nc, m);
    },

    // L52.2: at the door, before any cell is looked for. True: answered with the wall.
    // C++: mesh_wall.inc:Seat::l52Door
    l52Door(w) {
      const nc = w.from;
      if (nc < 0 || nc === this.id || w.knock) return false;   // a knock is a seated seat's call at the door, not an entry
      const W = this.l52Wall();
      if (W === K.L52_NONE || this.f.fabricPass(this.id, nc)) return false;
      if (W < 0) { this.l52Refuse(nc, false, false, 'door-unknown', null); return true; }   // L52.6
      const v = this.l52Full(W, nc); if (v === 0) return false;
      this.l52Refuse(nc, false, v === 2, 'door', null); return true;
    },

    // L52.1: where a cell is given. True: the placement is not made (answered with the wall).
    // C++: mesh_wall.inc:Seat::l52Admit
    l52Admit(c, f) {
      if (f.tag === 1 || f.nc < 0 || f.nc === this.id) return false;   // L52.8: a seated seat's move is no admission
      const W = this.l52Wall();
      if (W === K.L52_NONE || this.f.fabricPass(this.id, f.nc)) return false;
      if (W >= 0 && c.pc === 0 && c.r * C + c.i < W) {
        if (this.l31Held(ckey(c), f.nc)) { this.l52Refuse(f.nc, f.gwc, false, 'record', c); return true; }   // L52.9: the cell stands under another seeker's record (one I assented to, or a commit): it is not given twice
        const ac = c.i > 0 ? { pc: 0, r: c.r, i: 0 } : { pc: 0, r: (c.r + C - 1) % C, i: 0 };   // the cell's designated admitter
        if (!this.l31Cap && !this.l52Word(ckey(ac))) { this.l52Refuse(f.nc, f.gwc, false, 'not-admitter', c); return true; }   // L52.9: I am not the cell's admitter and this is no proposal for its assent (a soft fill of a row whose head is not seated yet): not yet
        return false;
      }
      this.l52Refuse(f.nc, f.gwc, W >= 0 && this.l52Full(W, f.nc) === 2, this.w.ADMIT_SITE === undefined ? '?' : this.w.ADMIT_SITE, c); return true;
    },

    // L52.9: a room with a line (known or not yet): a home cell is given on its one admitter's word.
    // C++: mesh_wall.inc:Seat::l52Firm
    l52Firm() { return this.l52Wall() !== K.L52_NONE; },

    // L52.9 e: the word for the cells whose designated admitter cell is ak is mine. I sit there and hold my row's ledger (V4: the
    // SITXFER, or its window has passed), or ak's seat is still sitting down and ak was given on my word (my committed record of
    // it says so: `by` is the seat whose word gave the cell): its row is mine until I hear that seat and hand it the ledger
    // (L7.8). A proposal gives no word. One seat holds the word at a time: it moves with the ledger, never on a clock.
    // C++: mesh_wall.inc:Seat::l52Word
    l52Word(ak) {
      if (!this.hasCoord || this.state !== 3 || this.coord.pc !== 0) return false;
      if (ak === ckey(this.coord)) return !this.l31NoLedger();
      const r = this.l31Acc.get(ak); return r !== undefined && !r.left && r.commit && r.by === this.id && this.TICK - r.at <= K.L31_REC_HOLD;
    },

    // L52.9 f: my vouch in k is an open proposal (no word yet): its PLACE has not gone out, and no repair of a lost PLACE sends it
    // (a proposal that waits for the word outlives PLACE_REPLAY; measured: four seats took /3.4 on replays of four dead proposals).
    // C++: mesh_wall.inc:Seat::l52Open
    l52Open(k) { for (const p of this.l31Pend) if (p.k === k) return this.l52Firm(); return false; },

    // L52.9 g THE UNUSED WORD GOES BACK. A word is one seat's promise of a cell to one seeker, and it holds the cell L31_REC_HOLD.
    // A greeter that cannot use it (the seeker left its door, FHOP.8.3.2; the word came after it gave the proposal up) sends the
    // assent back to the seat it came from, marked with the wall's tag: no new frame and no new field, and a page that does not
    // know the mark finds no proposal of its own under it and drops it. The giver then holds the cell no longer.
    // C++: mesh_wall.inc:Seat::l52Back
    l52Back(k, q) {
      const r = this.l31Acc.get(k); if (r === undefined || r.q !== q || r.by < 0 || r.by === this.id) return;
      const to = r.by; this.l31Acc.delete(k);
      const b = newMsg('PLACED'); b.ck = k; b.id = q; b.l31By = to; b.l31At = this.TICK | 0; b.l31 = 6; b.tag = K.L52_TAG; this.l52Send(to, b);
      this.trace('L52-BACK', this.id, this.hasCoord ? this.coord : null, 'ck=%lld seeker=%d to=%d', k, q, to);
    },

    // An assent frame addressed to me. True: it was the mark (a word of mine that came back), or a word I cannot use (sent back).
    // C++: mesh_wall.inc:Seat::l52Unused
    l52Unused(m) {
      const k = m.ck, q = m.id;
      if (m.tag === K.L52_TAG) {
        const r = this.l31Acc.get(k);
        if (r !== undefined && r.q === q && r.commit && !r.left && r.by >= 0 && r.by !== this.id && r.by !== q && r.by !== m.from) {   // the word went on with my ledger (its record names the seat that holds it now): the unused word follows it
          const to = r.by; this.l31Acc.delete(k);
          const b = newMsg('PLACED'); b.ck = k; b.id = q; b.l31By = to; b.l31At = m.l31At; b.l31 = 6; b.tag = K.L52_TAG; this.l52Send(to, b);
          this.trace('L52-BACK', this.id, this.hasCoord ? this.coord : null, 'ck=%lld seeker=%d to=%d', k, q, to);
          return true;
        }
        if (r !== undefined && r.q === q && r.commit && r.by === this.id && this.occGet(k) !== q) {
          let own = false; for (const d of this.l31Done) if (d.k === k && d.nc === q) own = true; for (const p of this.l31Pend) if (p.k === k && p.nc === q) own = true;
          if (!own) {
            this.l31Acc.delete(k); const s = this.sitting.get(k); if (s !== undefined && s.joiner === q && s.assigner === this.id && s.pl.t !== 'PLACE') this.clearSoft(k, 'l52-back'); this.healTry.delete(k);
            this.trace('L52-FREED', this.id, this.hasCoord ? this.coord : null, 'ck=%lld seeker=%d from=%d', k, q, m.from);
          }
        }
        return true;
      }
      for (const p of this.l31Pend) if (p.k === k && p.nc === q) return false;
      for (const d of this.l31Done) if (d.k === k && d.nc === q) return false;
      if (m.from >= 0 && m.from !== this.id) {
        const r = this.l31Acc.get(k); if (r !== undefined && r.q === q && !r.commit) this.l31Acc.delete(k);
        const b = newMsg('PLACED'); b.ck = k; b.id = q; b.l31By = m.from; b.l31At = m.l31At; b.l31 = 6; b.tag = K.L52_TAG; this.l52Send(m.from, b);
        this.trace('L52-BACK', this.id, this.hasCoord ? this.coord : null, 'ck=%lld seeker=%d to=%d', k, q, m.from);
      }
      return true;
    },

    // L52.9 i THE WORD TRAVELS ON THE HOME RING'S OWN LINKS. x's home cell in my view (its number in the order), or -1.
    // C++: mesh_wall.inc:Seat::l52CellOf
    l52CellOf(x) { if (x < 0) return -1; for (let o = 0; o < C * C; o++) if (this.occGet(ckey({ pc: 0, r: (o / C) | 0, i: o % C })) === x) return o; return -1; },
    // x sits in my row or my column of the home section in my view: we hold a link the ring needs (never one L22 trims).
    // C++: mesh_wall.inc:Seat::l52Rook
    l52Rook(x) { const o = this.l52CellOf(x); return o >= 0 && this.hasCoord && this.coord.pc === 0 && x !== this.id && (((o / C) | 0) === this.coord.r || o % C === this.coord.i); },
    // A word, or a word handed back, to a seat of the home section: over our own link when we share a row or a column, else
    // through the seat that shares one with each of us (its row and my column first), which hands it on (l31OnPlaced). The
    // frame names me in pp. A pair with no ring link between them holds at best a channel the room is closing (L22), and a
    // word sent there was lost (burst 10+15 at 25, seed 6: two words gone, their cells held, the seekers' doors closed).
    // C++: mesh_wall.inc:Seat::l52Send
    l52Send(to, m) {
      if (!this.l52Firm() || !this.hasCoord || this.coord.pc !== 0) { this.emit(to, m); return; }
      m.pp = this.id;
      const o = this.l52CellOf(to);
      if (o >= 0 && ((o / C) | 0) !== this.coord.r && o % C !== this.coord.i) {
        const v1 = this.occGet(ckey({ pc: 0, r: (o / C) | 0, i: this.coord.i })), v2 = this.occGet(ckey({ pc: 0, r: this.coord.r, i: o % C }));
        const via = (v1 >= 0 && v1 !== this.id && v1 !== to) ? v1 : (v2 >= 0 && v2 !== this.id && v2 !== to) ? v2 : -1;
        if (via >= 0) { this.emit(via, m); return; }
      }
      this.emit(to, m);
    },

    // One word per seeker: q holds a word (a committed record still in its hold) in my view, in another cell than k (any: in any cell).
    // C++: mesh_wall.inc:Seat::l52Has
    l52Has(q, k, any) { for (const [ek, r] of this.l31Acc) if ((any || ek !== k) && r.q === q && !r.left && r.commit && this.TICK - r.at <= K.L31_REC_HOLD) return true; return false; },
    // L52.9 j THE SEAT THAT HOLDS THE WORD NAMES THE CELL. A proposal for a cell that is taken in my view gets, from me, the next
    // free cell under my word instead of silence: every greeter of a burst proposes the same next cell from its own view, and
    // under silence one won it and the others learned of it from the commit, one cell a round (burst 10+15 at 25, seed 6: 15
    // seekers took 11 rounds, 444 refused records). The answer is the assent frame with the cell I give; the greeter moves its
    // proposal there (l52Moved). One word per seeker: none while it holds a word in my view or sits.
    // C++: mesh_wall.inc:Seat::l52Offer
    l52Offer(q, g, at) {
      if (this.l52Has(q, 0, true)) return;
      if (this.l52CellOf(q) >= 0) return;
      const f0 = this.findNc; this.findNc = q; const c = this.l31Pick(); this.findNc = f0;
      if (c === null) return;
      const k = ckey(c); const W = this.l52Wall();
      if (!this.l52Word(ckey(c.i > 0 ? { pc: 0, r: c.r, i: 0 } : { pc: 0, r: (c.r + C - 1) % C, i: 0 }))) return;
      if (!(W === K.L52_NONE || this.f.fabricPass(this.id, q) || (W >= 0 && c.r * C + c.i < W))) return;
      { const old = []; for (const [ek, r] of this.l31Acc) if (ek !== k && r.q === q && !r.commit) old.push(ek); for (const ek of old) this.l31Acc.delete(ek); }   // its proposal elsewhere is answered by this word: it waits for no other
      if (!this.l31Note(k, q, this.TICK | 0, g, false)) return;
      const w = newMsg('PLACED'); w.ck = k; w.id = q; w.l31By = g; w.l31At = at; w.l31 = 6; this.l52Send(g, w);
      this.trace('L52-OFFER', this.id, this.coord, 'ck=%lld seeker=%d to=%d', k, q, g);
      this.l52Assented(k, q); if (c.i === 0) this.l52Sweep(k);
    },
    // The greeter: a word for my seeker in another cell than the one I proposed. My proposal moves there: the vouch, the
    // placement I will send, the record. True: moved (the word is the commit, l31PendTick sends it).
    // C++: mesh_wall.inc:Seat::l52Moved
    l52Moved(m) {
      const k = m.ck, q = m.id;
      let p = null; for (const x of this.l31Pend) { if (x.nc !== q) continue; if (x.k === k) return false; if (x.needAck && !x.ack && p === null) p = x; }
      if (p === null) return false;
      for (const d of this.l31Done) if (d.k === k && d.nc === q) return false;
      const c = { pc: ckPc(k), r: ckR(k), i: ckI(k) }; const old = p.k;
      const mm = newMsg('FIND'); mm.nc = q; mm.from = q; mm.ttl = K.FIND_TTL;
      const r0 = this.l31Acc.get(k); if (!this.l31Note(k, q, this.TICK | 0, m.from, true)) return false;   // the word is the commit: it stands over every proposal for the cell in my view (a commit for another seeker stands: the word goes back)
      for (const x of this.l31Pend) if (x.k === k && x.nc !== q) this.clearSoft(k, 'l52-word');   // my own proposal of that cell for another seeker has lost it (l31PendTick proposes again)
      const ht = this.healTry.get(k); this.healOnly.delete(k); this.healTry.set(k, this.TICK);
      this.w.ADMIT_SITE = p.home ? 'l31-door' : 'l31-direct'; this.l31Cap = true; this.l31Got = false; this.admit(c, mm); this.l31Cap = false;
      if (!this.l31Got) { if (ht === undefined) this.healTry.delete(k); else this.healTry.set(k, ht); if (r0 === undefined) this.l31Acc.delete(k); else this.l31Acc.set(k, r0); return false; }
      { const s = this.sitting.get(old); if (s !== undefined && s.joiner === q && s.assigner === this.id) this.clearSoft(old, 'l52-moved'); this.healTry.delete(old); const r = this.l31Acc.get(old); if (r !== undefined && r.q === q && !r.commit) this.l31Acc.delete(old); }
      p.out = msg.clone(this.l31Out); p.k = k; p.at = this.TICK | 0; p.ack = true; p.ask = false;
      this.l31Acc.set(k, { q, at: p.at, by: m.from, commit: true, left: false });
      this.trace('L52-WORD', this.id, this.coord, 'cell=%s seeker=%d from=%d', coordStr(c), q, m.from);
      this.f.wake(this.id); return true;
    },

    // x sits in a head cell of the home section in my view (the seats that can hold a row's word).
    // C++: mesh_wall.inc:Seat::l52Head
    l52Head(x) { if (x < 0) return false; for (let t = 0; t < C; t++) if (this.occGet(ckey({ pc: 0, r: t, i: 0 })) === x) return true; return false; },

    // L52.9 e, the handover: I hear the seat x of head cell k, a cell given on my word: it gets the ledger, and the word with it.
    // C++: mesh_wall.inc:Seat::l52Hand
    l52Hand(k, x) {
      if (ckPc(k) !== 0 || ckI(k) !== 0 || x < 0 || x === this.id) return;
      const r = this.l31Acc.get(k); if (r === undefined || r.left || !r.commit || r.by !== this.id || r.q !== x || !this.l52Firm()) return;
      this.sitXfer(k, x);
    },

    // L52.9 e, the handover is said three times more. The ledger is one frame, and the word went with it: a frame lost on the way
    // (the head's door to me closing as it sat down: window 4+12 at 20, seed 7, the row had no word for 60 ticks) left nobody to
    // give the row. So the seat that handed a ledger sends it again 3, 6 and 9 ticks later (the cells its records name as the
    // head's now); a head that holds its ledger drops the copy. And a head I hear first-hand at the cell I gave, whose ledger
    // has not gone yet (no open link then), gets it now.
    // C++: mesh_wall.inc:Seat::l52HandTick
    l52HandTick() {
      if (!this.hasCoord || this.state !== 3 || this.coord.pc !== 0 || !this.l52Firm()) return;
      let more = false; const again = [], first = [];
      for (const [k, r] of this.l31Acc) {
        if (ckPc(k) !== 0 || ckI(k) !== 0 || r.left || !r.commit || r.q < 0 || r.q === this.id) continue;
        if (r.by === this.id) { if (this.TICK - r.at <= K.L31_REC_HOLD) { more = true; if (this.occGet(k) === r.q && this.firstHandLive(k)) first.push([k, r.q]); } continue; }
        if (r.by !== r.q) continue;
        const dt = this.TICK - r.at; if (dt === 3 || dt === 6 || dt === 9) again.push([k, r.q]); if (dt < 9) more = true;
      }
      for (const [k, x] of first) this.l52Hand(k, x);
      for (const [k, x] of again) {
        const m = newMsg('SITXFER'); m.ck = k; m.id = x; const r = ckR(k);
        for (const [ek, e] of this.l31Acc) if (ek !== k && !e.left && e.commit && e.by === x && e.q >= 0 && ckPc(ek) === 0) m.nbrs.push({ k: ek, v: e.q });
        for (let j = 0; j < C; j++) { const rk = ckey({ pc: 0, r, i: j }); const o = this.occGet(rk); if (o >= 0 && rk !== k) m.row.push({ k: rk, v: o, age: -1, ch: -1, ba: -1, tn: 0 }); }
        this.trace('L52-XFER', this.id, this.coord, 'to=%d ck=%lld cells=%d', x, k, m.nbrs.length);
        this.emit(x, m);
      }
      if (more) this.f.wake(this.id);
    },

    // L52.9 e: the word for the cells ak answers for has just become mine (my placement of ak's seat went out, or my ledger came):
    // the proposals for those cells that reached me before it are answered now, one record per cell, as l31OnPlaced would.
    // C++: mesh_wall.inc:Seat::l52Sweep
    l52Sweep(ak) {
      const a = { pc: ckPc(ak), r: ckR(ak), i: ckI(ak) }; if (a.pc !== 0 || a.i !== 0 || !this.l52Firm() || !this.l52Word(ak)) return;
      for (let j = 1; j <= C; j++) {
        const kc = j < C ? { pc: 0, r: a.r, i: j } : { pc: 0, r: (a.r + 1) % C, i: 0 }; const k = ckey(kc);
        if (j === C && (a.r + 1 >= C)) continue;
        const r = this.l31Acc.get(k); if (r === undefined || r.left || r.commit || r.q < 0 || r.by < 0 || r.by === this.id || this.TICK - r.at > K.L31_ACK_WAIT - K.L31_COMMIT) continue;   // only a proposal whose greeter still waits for the word (it gives up at L31_ACK_WAIT; the answer is a frame back): a word given to a proposal nobody holds would keep the cell from everyone
        const q = r.q; const x = this.occGet(k); if (x >= 0 && x !== q) continue;
        if (this.l52Has(q, k, false)) continue;   // one word per seeker (L52.9 j)
        if (this.softSitting(k) && this.sitting.get(k).joiner !== q) continue;
        const w = newMsg('PLACED'); w.ck = k; w.id = q; w.l31By = r.by; w.l31At = r.at; w.l31 = 6; this.l52Send(r.by, w); this.l52Assented(k, q); if (j === C) this.l52Sweep(k);   // a head cell given: its row's word is mine too
      }
    },

    // L52.9, the cell's designated admitter: the record I assented to is the cell's, against every later one.
    // C++: mesh_wall.inc:Seat::l52Assented
    l52Assented(k, q) { if (!this.l52Firm()) return; const a = this.l31Acc.get(k); const had = a !== undefined && a.q === q && !a.left; if (had && !a.commit) { a.commit = true; a.by = this.id; }   // by: the seat whose word gave the cell (L52.9 e)
      this.trace('L52-ASSENT', this.id, this.coord, 'ck=%lld seeker=%d kept=%d', k, q, had ? 1 : 0); },

    // L52.9 h: in a room with a line a home cell under a live record (a word given, or a proposal still waiting for one) is promised to
    // its seeker: Section 1's front pack (L9.22) moves no seat into it.
    // C++: mesh_wall.inc:Seat::l52Promised
    l52Promised(k) { return this.l52Firm() && this.l31Held(k, -1); },

    // L52.9, the cell's designated admitter: I hold my own vouch in k for a seat other than q, and it is no open proposal (the PLACE is out).
    // C++: mesh_wall.inc:Seat::l52Given
    l52Given(k, q) {
      if (!this.l52Firm()) return false;
      const s = this.sitting.get(k); if (s === undefined || !this.softSitting(k) || s.joiner === q || s.assigner !== this.id) return false;
      for (const p of this.l31Pend) if (p.k === k) return false;
      return true;
    },

    // L52.3, the seeker: the wall answered. I ask nobody else; I wait L52_WAIT and knock again.
    // C++: mesh_wall.inc:Seat::l52Walled
    l52Walled(m) {
      if (this.evilDoor || this.state === 3 || this.hasCoord) return;
      this.l16Saw = true; this.doorAsk.delete(m.id); this.lastReach = this.TICK | 0;   // an answer: no silence, no dark door
      this.l16Anch = false; this.l16Ho = -1; this.l16Until = this.TICK + K.L52_WAIT; this.state = 0; this.islandAskAt = -1; this.l16Ask.length = 0; this.l16Busy.length = 0; this.l16Last = -1; this.l16List.length = 0; this.l16Next = 0; this.l16WaveAt = -1; this.l16FreshAt = -1; this.findAckAt = -1; this.reAsk = false; this.reJoin = false;
      this.trace('L52-WAIT', this.id, null, 'from=%d wait=%d', m.id, K.L52_WAIT); this.f.wake(this.id);
    },
  });

  GifOS.meshWall = Object.freeze({});
  if (isNode) module.exports = GifOS.meshWall;
})(typeof window !== 'undefined' ? window : globalThis);
