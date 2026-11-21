/*
 * instant.js: L31 instant join: the greeter places a newcomer at once (C++: mesh_instant.inc, seat side).
 * Methods only on the Seat; l31Beats is a free function, registered with Seat.free.
 * Out-parameters: l31Pick returns the cell or null. The measurement counters (L31_DOOR ...) are levers of the
 * shared world (w.lv). ADMIT_SITE, the label a seat gives its own admit decision (forensics only), is
 * w.ADMIT_SITE. gate() is a thread-pool fence in the C++ and is nothing here.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const seatM = req('./seat.js', 'meshSeat');
  const { coordStr, cellOk } = req('./shared.js', 'meshShared');
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const state = req('./state.js', 'meshState');
  const { Seat, ppSigOf } = seatM;
  const K = C_.consts;
  const { ckey, ckPc, unckey, ownedLinks, down, C } = topo;
  const newMsg = (t) => msg.newMsg(t);
  const cpKV = (a) => a.map((e) => ({ k: e.k, v: e.v }));
  // the cell's designated admitter (C3): the head of its row, or of the row before it for a head cell
  const admCell = (c) => (c.i > 0 ? { pc: 0, r: c.r, i: 0 } : { pc: 0, r: (c.r + C - 1) % C, i: 0 });

  // C++: mesh_instant.inc:l31Beats
  function l31Beats(ta, ga, qa, tb, gb, qb) { if (ta - tb > K.PLACE_W || tb - ta > K.PLACE_W) return ta < tb; if (ga !== gb) return ga < gb; return qa < qb; }
  Seat.free({ l31Beats });

  Seat.unit('mesh_instant.inc', {
    // C++: mesh_instant.inc:Seat::l31Held
    l31Held(k, nc) {
      const a = this.l31Acc.get(k); if (!(a !== undefined && !a.left && a.q !== nc && this.TICK - a.at <= K.L31_REC_HOLD)) return false;
      if (!a.commit && this.TICK - a.at > K.L31_ACK_WAIT && this.l52Firm()) return false;   // L52.9 f (wall.js): in a room with a line a proposal that got no word inside L31_ACK_WAIT is dead (its greeter gave it up), and holds the cell no longer
      return true;
    },

    // C++: mesh_instant.inc:Seat::l31Note
    l31Note(k, q, at, by, commit) {
      const a = this.l31Acc.get(k);
      if (a !== undefined && !a.left && this.TICK - a.at <= K.L31_REC_HOLD) {
        if (a.q === q) { const was = a.commit; if (commit) a.commit = true; if (at > a.at && this.l52Firm()) { a.at = at; if (!was) a.by = by; }   // L52.9: a later placement of the same seeker in the cell renews the record's hold
          return true; }
        if (this.l52Firm()) { if (a.commit) return false; if (!commit && !l31Beats(at, by, q, a.at, a.by, a.q)) return false; }   // L52.9 (wall.js): in a room with a line a committed or assented record is not beaten, and a commit stands over any proposal
        else if (!l31Beats(at, by, q, a.at, a.by, a.q)) return false;
      }
      if (this.l31Acc.size >= 4 * C) { const old = []; for (const [ek, ev] of this.l31Acc) if (this.TICK - ev.at > K.L31_REC_HOLD) old.push(ek); for (const o of old) this.l31Acc.delete(o); if (this.l31Acc.size >= 4 * C && !this.l52Firm()) this.l31Acc.clear(); }   // L52.9: in a room with a line the fresh records are the cells' word and are kept (one per home cell at most)
      this.l31Acc.set(k, { q, at, by, commit, left: false }); return true;
    },

    // V4: I am a vouched-in head whose row ledger has not come yet (and its window has not passed).
    // C++: mesh_instant.inc:Seat::l31NoLedger
    l31NoLedger() { return this.coord.i === 0 && !this.rowLedger && this.TICK - this.seatedAt <= 60; },
    // C++: mesh_instant.inc:Seat::l31CellOk
    l31CellOk(cell) {
      const k = ckey(cell);
      if (cell.pc !== 0 || (this.hasCoord && k === ckey(this.coord))) return false;
      if (this.cellReserved(k) || this.courtHeld(k) || this.l31Held(k, this.findNc)) return false;
      const l44h = this.l44Hole(k);   // L44.3 (burst.js)
      if (!l44h) for (let j = cell.i + 1; j < C; j++) { const rk = ckey({ pc: 0, r: cell.r, i: j }); if (this.occ.has(rk) || this.softSitting(rk) || this.l31Held(rk, this.findNc)) return false; }
      { const ht = this.healTry.get(k); if (!l44h && ht !== undefined && this.TICK - ht <= 45) return false; }
      { const b = this.byeAt.get(k); if (!l44h && b !== undefined && this.TICK - b <= K.LEASE_T) return false; }
      if (this.l31NoLedger()) return false;
      return true;
    },

    // C++: mesh_instant.inc:Seat::l31Pick
    l31Pick() {
      if (!this.hasCoord || this.state !== 3 || this.coord.pc !== 0) return null;
      if (!this.hearRook()) {
        if (this.greetersAt < 0 || this.TICK - this.greetersAt > K.RELAY_TTL) return null;
        for (const g of this.lastGreeters) if (g >= 0 && g !== this.id && g !== this.findNc && !this.l315Id(g)) return null;
      }
      for (let t = 0; t < C; t++) {
        if (t > 0) { for (let j = 0; j < C; j++) { const pk = ckey({ pc: 0, r: t - 1, i: j }); if (!this.occ.has(pk) && !this.softSitting(pk) && !this.l31Held(pk, this.findNc)) return null; } }
        let live = (this.coord.r === t), held = false;
        for (let j = 0; j < C; j++) { const k = ckey({ pc: 0, r: t, i: j }); if (this.s1Fresh(k)) live = true; if (this.occ.has(k) && this.cellReserved(k)) held = true; }
        if (!live && held) return null;
        for (let j = 0; j < C; j++) {
          const cell = { pc: 0, r: t, i: j }; const k = ckey(cell);
          if (this.cellReserved(k) || this.l31Held(k, this.findNc)) continue;
          if (this.courtHeld(k)) return null;
          const dk = ckey(down(cell)); if ((this.cellReserved(dk) && !this.occIsPhantom(dk)) || this.softSitting(dk)) continue;
          if (j === 0 && live && !this.l714Open(t)) continue;
          if (!this.l31CellOk(cell)) return null;
          return cell;
        }
      }
      return null;
    },

    // C++: mesh_instant.inc:Seat::l31Propose
    l31Propose(p) {
      let c = null; const f0 = this.findNc; this.findNc = p.nc; let got = false;
      if (p.forge === 2) { const ol = ownedLinks(this.coord), n = ol.length; for (let q = 0; q < n && !got; q++) { const k = ckey(ol[q]); const x = this.occGet(k); if ((ol[q].i > 0 || ol[q].r > 0) && x >= 0 && x !== this.id && x !== p.nc && this.firstHandLive(k)) { c = { pc: ol[q].pc, r: ol[q].r, i: ol[q].i }; got = true; } } }
      else { c = this.l31Pick(); got = !!c; }
      this.findNc = f0;
      if (!got) return false;
      {
        const ac = admCell(c); const ak = ckey(ac);
        p.ack = false; const akHeld = this.l315Cell(ak); p.needAck = !(this.hasCoord && ak === ckey(this.coord)) && this.occGet(ak) >= 0 && !akHeld;
        if (!p.needAck && !akHeld && !(this.hasCoord && ak === ckey(this.coord)) && !this.softSitting(ak) && !this.l31Held(ak, p.nc)) return false;
        if (this.l52Firm()) { const mine = this.l52Word(ak); p.needAck = !mine; if (!mine && (akHeld || !(this.occGet(ak) >= 0 || this.l31Held(ak, p.nc)))) return false; }   // L52.9 (wall.js): in a room with a line the cell is given on one seat's word: mine, the seated admitter's, or (L52.9 e) that of the seat whose fresh placement holds the admitter's cell; with none of them the parent's path
      }
      const mm = newMsg('FIND'); mm.nc = p.nc; mm.from = p.nc; mm.ttl = K.FIND_TTL;
      const k = ckey(c); this.healOnly.delete(k); this.healTry.set(k, this.TICK);
      this.w.ADMIT_SITE = p.home ? 'l31-door' : 'l31-direct'; this.l31Cap = true; this.l31Got = false; this.admit(c, mm); this.l31Cap = false;
      if (!this.l31Got) return false;
      p.out = msg.clone(this.l31Out); p.k = k; p.at = this.TICK;
      this.l31Notify(k, p.nc, false, p.forge);
      return true;
    },

    // C++: mesh_instant.inc:Seat::l31Commit
    l31Commit(p) {
      const lv = this.w.lv;
      if (p.home) {
        const h = msg.clone(p.hm); const o = msg.clone(p.out);
        h.l31 = 1; h.coord = o.coord; h.owner = o.owner; h.nbrs = o.nbrs; h.nc = o.nc; h.pp = o.pp; h.ppAt = o.ppAt; h.ppL = o.ppL; h.row = o.row; h.tag = o.tag; this.emit(p.nc, h); lv.L31_DOOR++;
      } else {
        const o = msg.clone(p.out); if (p.replace) o.l31 = 5; this.emit(p.nc, o); if (p.replace) lv.L31_REPLACED++; else if (!p.parent) lv.L31_HANDOFF++;
      }
      {
        this.l31Notify(p.k, p.nc, true, p.forge); if (this.l31Done.length >= 4 * C) this.l31Done.shift();
        this.l31Done.push({ nc: p.nc, k: p.k, at: p.at, wait: p.needAck && !p.ack, home: !!p.home });
      }
      this.l52Sweep(p.k);   // L52.9 e (wall.js): a head cell I placed: its row's word is mine now, and the proposals that waited for it are answered
    },

    // C++: mesh_instant.inc:Seat::l31Fallback
    l31Fallback(p) {
      if (p.home) { const h = msg.clone(p.hm); this.emit(p.nc, h); }
      else { const m = newMsg('NOROOM'); m.id = this.id; m.nd = 0; this.emit(p.nc, m); }
    },

    // C++: mesh_instant.inc:Seat::l31Door
    l31Door(w, h) {
      const lv = this.w.lv;
      if (!w.l31 || w.knock || w.via >= 0 || w.from < 0 || w.from === this.id || !this.l31On()) return false;
      for (const e of this.sitting.values()) if (e.joiner === w.from && e.assigner === this.id && e.pl.t === 'PLACE' && this.TICK - e.at <= K.SIT_TTL) return false;
      for (const p of this.l31Pend) if (p.nc === w.from) return true;
      const p = state.newStruct('L31Pend'); p.nc = w.from; p.home = true; p.hm = msg.clone(h);
      if (lv.L31_FORGE_MODE && lv.L31_FORGE_SEEKER === w.from) p.forge = lv.L31_FORGE_MODE;
      if (!this.l31Propose(p)) return false;
      if (p.forge) { lv.L31_FORGE_SEEKER = -1; }
      this.l31Pend.push(p); this.f.wake(this.id); return true;
    },

    // C++: mesh_instant.inc:Seat::l31TakeDoor
    l31TakeDoor(m) {
      if (this.hasCoord || m.nc !== this.id || m.owner < 0 || m.owner !== m.from || m.roster.length === 0) return false;
      this.roster = cpKV(m.roster); this.haveRoster = true; this.lastReach = this.TICK; this.seatTries = 0; this.resumeTries = 0;
      if (m.line >= 0) { this.lineAdopt(m.line, m.lineAt, 'door'); if (m.lineF) this.lineFork = true; }   // L31.8: the seat the door seats adopts its room's lineage and founding epoch, as at the other two intakes
      this.take(m.coord, m.owner, m.nbrs, m.pp, m.ppAt, m.row, m.ppL); if (this.pp >= 0 && this.pp !== this.id) this.placer = this.pp;
      this.l31Bridge = m.from; this.l31BridgeCk = ckey(m.coord);
      return true;
    },

    // C++: mesh_instant.inc:Seat::l31Direct
    l31Direct(cell, mm) {
      const lv = this.w.lv;
      if (!this.l31On() || mm.tag === 1 || mm.nc < 0 || mm.nc === this.id || mm.dk) return false;
      if (!this.l31CellOk(cell)) return false;
      for (const p of this.l31Pend) if (p.nc === mm.nc) return true;
      const p = state.newStruct('L31Pend'); p.nc = mm.nc; p.home = false;
      if (lv.L31_FORGE_MODE && lv.L31_FORGE_SEEKER === mm.nc) p.forge = lv.L31_FORGE_MODE;
      if (!this.l31Propose(p)) return false;
      if (p.forge) { lv.L31_FORGE_SEEKER = -1; }
      this.findAck(mm);
      this.l31Pend.push(p); this.f.wake(this.id); return true;
    },

    // C++: mesh_instant.inc:Seat::l31PendTick
    // C++: mesh_instant.inc:Seat::l31DoorLeft
    // FHOP.8.3.2: my door placement lives on my channel to the knocker; once it reads closed the knocker left my door.
    l31DoorLeft(nc, home) { return !!home && this.f.fabricDoors() && !this.f.fabricLinkOpen(this.id, nc); },
    l31PendTick() {
      const lv = this.w.lv;
      const v = this.l31Pend; this.l31Pend = [];
      for (const p of v) {
        if (p.ask) {   // L52.9 j (wall.js): my proposal lost its cell and my view shows no other: the seat that holds the word names one, and I wait for that answer (the vouch in p.k is not mine)
          if (this.l31DoorLeft(p.nc, p.home)) { this.trace('L31-DOORLEFT', this.id, this.hasCoord ? this.coord : null, 'cell=%s seeker=%d open=1', coordStr(unckey(p.k)), p.nc); continue; }
          if (!this.hasCoord || this.state !== 3 || this.coord.pc !== 0) { this.l31Fallback(p); continue; }
          if (this.TICK - p.at < K.L31_COMMIT + K.L31_COMMIT) { this.l31Pend.push(p); continue; }
          p.ask = false;
          if (p.tries < 3 && this.l31On()) { p.tries++; if (this.l31Propose(p)) { this.l31Pend.push(p); continue; }   // no answer: a cell of my own view by now, or said again
            p.ask = true; p.needAck = true; p.ack = false; p.at = this.TICK | 0; this.l31Notify(p.k, p.nc, false, p.forge); this.l31Pend.push(p); continue; }
          this.trace('L52-NOASSENT', this.id, this.coord, 'cell=%s seeker=%d', coordStr(unckey(p.k)), p.nc);
          this.l31Fallback(p); continue;
        }
        if (this.l31DoorLeft(p.nc, p.home)) { if (p.needAck && p.ack) this.l52Back(p.k, p.nc);   // L52.9 g (wall.js): the word I got for it goes back unused
          this.clearSoft(p.k, 'l31-door-left'); this.healTry.delete(p.k); this.trace('L31-DOORLEFT', this.id, this.hasCoord ? this.coord : null, 'cell=%s seeker=%d open=1', coordStr(unckey(p.k)), p.nc); continue; }
        if (!this.hasCoord || this.state !== 3 || this.coord.pc !== 0) { this.clearSoft(p.k, 'l31-stood-down'); this.l31Fallback(p); continue; }
        const a = this.l31Acc.get(p.k);
        let lost = a !== undefined && a.q !== p.nc;
        if (lost && !a.commit && this.l52Firm()) lost = false;   // L52.9 f (wall.js): in a room with a line the word decides between two proposals, not their order: mine stands until the cell is committed to another
        if (lost) {
          this.clearSoft(p.k, 'l31-lost'); this.healTry.delete(p.k); this.trace('L31-LOST', this.id, this.coord, 'cell=%s seeker=%d to=%d', coordStr(unckey(p.k)), p.nc, a.q); lv.L31_LOST++;
          p.parent = false;
          if (this.l52Firm() && this.l31On()) {   // L52.9 j (wall.js): a cell lost to a commit is no try spent (a burst loses one a round, and the cells are few): the next one of my view, or none there: said again, and the seat that holds the word answers a taken cell with the next free one
            if (this.l31Propose(p)) { this.l31Pend.push(p); continue; }
            if (p.tries < 3) { p.ask = true; p.needAck = true; p.ack = false; p.at = this.TICK | 0; this.l31Notify(p.k, p.nc, false, p.forge); this.l31Pend.push(p); continue; }
            this.l31Fallback(p); continue;
          }
          if (p.tries < 3 && this.l31On() && this.l31Propose(p)) { p.tries++; this.l31Pend.push(p); continue; }
          this.l31Fallback(p); continue;
        }
        if (this.TICK - p.at < K.L31_COMMIT && !((p.ack || !p.needAck) && this.l52Firm())) { this.l31Pend.push(p); continue; }   // L52.9 f: on the word, not on the clock
        if (p.needAck && !p.ack && this.l52Firm()) {   // L52.9 (wall.js): in a room with a line the placement is sent on the admitter's word, not on the clock
          { const kc = unckey(p.k); const ac = admCell(kc); if (this.l52Word(ckey(ac))) { p.ack = true; this.trace('L52-WORD', this.id, this.coord, 'cell=%s seeker=%d from=%d', coordStr(kc), p.nc, this.id); } }   // L52.9 e: the word became mine while I waited (my placement of the cell's admitter committed)
          if (p.ack) { this.l31Commit(p); continue; }
          if (this.TICK - p.at <= K.L31_ACK_WAIT) {
            if (this.TICK - p.at >= K.L31_COMMIT + K.L31_COMMIT && p.tries < 3) { p.tries++; this.l31Notify(p.k, p.nc, false, p.forge); p.at = this.TICK | 0; }   // L52.9 f: said again to the seats I know now (the word may be on its way to a head that sat down after my record went out, L52.9 e), and waited for from this saying; three times, then the full wait
            this.l31Pend.push(p); continue;
          }
          this.clearSoft(p.k, 'l52-no-assent'); this.healTry.delete(p.k); this.trace('L52-NOASSENT', this.id, this.coord, 'cell=%s seeker=%d', coordStr(unckey(p.k)), p.nc);
          if (p.tries < 3 && this.l31On() && this.l31Propose(p)) { p.tries++; this.l31Pend.push(p); continue; }   // L52.9 f: asked again (the word may have changed hands, L52.9 e), as a beaten proposal is
          this.l31Fallback(p); continue;
        }
        if (!p.needAck && this.l52Firm()) {   // L52.9 e: I proposed on my own word and the word has moved since (my ledger went to the row's head): the cell is its new holder's to give
          const kc = unckey(p.k); const ac = admCell(kc);
          if (!this.l52Word(ckey(ac))) {
            this.trace('L52-MOVED', this.id, this.coord, 'cell=%s seeker=%d', coordStr(kc), p.nc);
            p.needAck = true; p.ack = false; p.at = this.TICK | 0; this.l31Notify(p.k, p.nc, false, p.forge); this.l31Pend.push(p); continue;   // my proposal stands and is said again: the seat that holds the word now gives the cell, or names another (L52.9 j)
          }
        }
        this.l31Commit(p);
      }
      for (let i = 0; i < this.l31Done.length;) {
        const d = this.l31Done[i];
        if (!d.wait) { if (this.TICK - d.at > K.L31_REC_HOLD) this.l31Done.splice(i, 1); else ++i; continue; }
        if (this.TICK - d.at <= K.L31_ACK_WAIT) { ++i; continue; }
        this.trace('L31-NOASSENT', this.id, this.coord, 'cell=%s seeker=%d', coordStr(unckey(d.k)), d.nc); lv.L31_NOACK++;
        this.clearSoft(d.k, 'l31-no-assent'); this.healTry.delete(d.k);
        const u = newMsg('PLACE'); u.l31 = 7; u.nc = d.nc; u.owner = this.id; u.coord = unckey(d.k); this.emit(d.nc, u);
        this.l31Done.splice(i, 1);
      }
      let watch = false; for (const d of this.l31Done) if (d.wait) watch = true;
      if (this.l31Pend.length || watch) this.f.wake(this.id);
    },

    // C++: mesh_instant.inc:Seat::l31Notify
    l31Notify(k, nc, commit, forge) {
      const lv = this.w.lv;
      this.l31Note(k, nc, this.TICK, this.id, commit);
      const to = []; const seen = new Set();
      if (this.hasCoord) { const ol = ownedLinks(this.coord), n = ol.length; for (let q = 0; q < n; q++) { const x = this.occGet(ckey(ol[q])); if (x < 0 || x === this.id || x === nc || seen.has(x)) continue; seen.add(x); to.push(x); } }
      const by = (forge === 1) ? (1 << 29) : this.id;
      for (const x of to) { const r = newMsg('PLACED'); r.ck = k; r.id = nc; r.l31By = by; r.l31At = this.TICK; r.l31L = r.l31At; r.l31 = commit ? 4 : 2; r.tag = forge ? 31 : 0; r.pp = by; r.ppAt = this.TICK; this.emit(x, r); }
      if (forge && !commit) lv.L31_FORGED++;
    },

    // C++: mesh_instant.inc:Seat::l31Relay
    l31Relay(m) {
      if (!this.hasCoord || this.coord.pc !== 0) return;
      let gr = -1, gi = -1; for (const [ek, ev] of this.occ) if (ev === m.l31By && ckPc(ek) === 0) { const gc = unckey(ek); gr = gc.r; gi = gc.i; break; }
      const ol = ownedLinks(this.coord), n = ol.length;
      for (let q = 0; q < n; q++) {
        if (ol[q].pc !== 0) continue; const x = this.occGet(ckey(ol[q])); if (x < 0 || x === this.id || x === m.id || x === m.l31By) continue; if (gr >= 0 && (ol[q].r === gr || ol[q].i === gi)) continue;
        this.emit(x, msg.clone(m));
      }
    },

    // C++: mesh_instant.inc:Seat::l31OnPlaced
    l31OnPlaced(m) {
      const lv = this.w.lv;
      if (!this.hasCoord || this.state !== 3 || this.coord.pc !== 0) return;
      const k = m.ck; const q = m.id, g = m.l31By; const commit = (m.l31 === 4);
      if (m.l31 === 6) {
        if (g !== this.id) { if (m.pp >= 0 && m.from === m.pp && this.l52Firm() && this.l52Rook(g)) this.emit(g, msg.clone(m)); return; }   // L52.9 i (wall.js): a word for a seat of my row or column, first-hand from its sender: handed on, once
        if (m.pp >= 0 && m.pp !== m.from) { if (!this.l52Firm() || !this.l52Rook(m.from)) return; m.from = m.pp; }   // L52.9 i: handed on by a seat of my row or column: its sender is the seat it names
        if (m.tag === K.L52_TAG) { if (this.l52Firm()) this.l52Unused(m); return; }   // L52.9 g: a word of mine handed back, from the greeter I gave it to
        const ac = admCell(unckey(k)); if (m.from < 0) return; if (this.occGet(ckey(ac)) !== m.from) { if (!(this.l52Firm() && this.l52Head(m.from))) return; }   // L52.9 e: or from the head seat that holds the word while the admitter's cell is being taken
        const firm = this.l52Firm();
        if (firm && this.l52Moved(m)) return;   // L52.9 j (wall.js): the word names another cell than I proposed: my proposal moves there
        if (firm && this.l52Unused(m)) return;   // L52.9 g (wall.js): a word that comes back to me unused, or a word for a proposal I hold no more
        for (const p of this.l31Pend) if (p.k === k && p.nc === q && (firm || p.at === m.l31At)) { p.ack = true; if (firm) { this.trace('L52-WORD', this.id, this.coord, 'cell=%s seeker=%d from=%d', coordStr(unckey(k)), q, m.from); this.l31Acc.set(k, { q, at: p.at, by: m.from, commit: true, left: false }); } }   // L52.9 f: the word is for the seeker in the cell (any proposal of mine for it), and it is the commit: my record stands over every proposal
        if (firm) this.f.wake(this.id);
        for (const d of this.l31Done) if (d.k === k && d.nc === q && d.at === m.l31At) d.wait = false;
        return;
      }
      if (q < 0 || q === this.id || g < 0 || g === q || !cellOk(k) || ckPc(k) !== 0 || k === ckey(this.coord)) return;
      const rook = this.ownedLinkCell(k);
      if (m.from === g && m.from >= 0) this.l31Relay(m);
      let ok = this.ppAdm(k, g, q) && !this.liveElsewhere(q, k);
      const base = ok;
      const l31Loc = m.l31L >= 0 ? m.l31L : this.TICK;
      if (ok && this.l52Given(k, q)) ok = false;   // L52.9 (wall.js): in a room with a line, a cell I gave myself is not given again on a later record
      if (ok && !this.l31Note(k, q, l31Loc, g, commit)) ok = false;
      const x = this.occGet(k);
      if (ok && x >= 0 && x !== q && (this.firstHandLive(k) || !this.occIsPhantom(k))) ok = false;
      if (ok && this.softSitting(k) && this.sitting.get(k).joiner !== q && this.sitting.get(k).assigner !== this.id) ok = false;
      if (ok) this.l31Beaten(k, q, l31Loc, g);
      let said = false;
      if (ok && !commit && m.tag !== 31) { const kc = unckey(k); const ac = admCell(kc); if (this.l52Firm() ? (this.l52Word(ckey(ac)) && !this.l52Has(q, k, false)) : ckey(ac) === ckey(this.coord)) { said = true; const a = newMsg('PLACED'); a.ck = k; a.id = q; a.l31By = g; a.l31At = m.l31At; a.l31 = 6; this.l52Send(g, a); this.l52Assented(k, q); if (kc.i === 0) this.l52Sweep(k); } }
      if (!said && base && !commit && m.tag !== 31 && this.l52Firm()) this.l52Offer(q, g, m.l31At);   // L52.9 j (wall.js): the cell is taken, or its word is not mine: the seat that holds the word of the next free cell names it
      if (!ok) { if (rook && commit) lv.L31_REFUSED++; if (m.tag === 31) lv.L31_FORGE_NO++; this.trace('L31-REFUSE', this.id, this.coord, 'cell=%s seeker=%d by=%d commit=%d', coordStr(unckey(k)), q, g, commit); return; }
      if (!rook || !commit) return;
      if (m.tag === 31) lv.L31_FORGE_OK++;
      this.setOcc(k, q); if (this.occGet(k) !== q) return;
      this.s1seen.set(k, this.TICK); this.s1told.set(k, this.TICK);
      this.ppNote(k, q, ppSigOf(g, m.l31At), g, m.l31L);
      this.trace('L31-ACCEPT', this.id, this.coord, 'cell=%s seeker=%d by=%d', coordStr(unckey(k)), q, g);
      const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = this.id; this.emit(q, h);
    },

    // C++: mesh_instant.inc:Seat::l31Beaten
    l31Beaten(k, q, at, g) {
      for (let i = 0; i < this.l31Done.length; i++) {
        const d = this.l31Done[i];
        if (d.k !== k || d.nc === q || this.TICK - d.at > K.L31_REC_HOLD) continue;
        if (!l31Beats(at, g, q, d.at, this.id, d.nc)) continue;
        this.l31Done.splice(i, 1);
        { const st = this.sitting.get(k); if (st !== undefined && st.joiner === d.nc && st.assigner === this.id) this.clearSoft(k, 'l31-beaten'); }
        this.trace('L31-BEATEN', this.id, this.coord, 'cell=%s seeker=%d by=%d', coordStr(unckey(k)), d.nc, q);
        if (!this.l31On()) return;
        if (this.l31DoorLeft(d.nc, d.home)) { this.trace('L31-DOORLEFT', this.id, this.coord, 'cell=%s seeker=%d open=0', coordStr(unckey(k)), d.nc); return; }   // FHOP.8.3.2
        for (const p of this.l31Pend) if (p.nc === d.nc) return;
        const p = state.newStruct('L31Pend'); p.nc = d.nc; p.home = false; p.replace = true; p.lost = k;
        if (this.l31Propose(p)) { this.l31Pend.push(p); this.f.wake(this.id); } else
          return;
      }
    },

    // C++: mesh_instant.inc:Seat::l31Replace
    l31Replace(m) {
      if (m.l31 === 7) { if (!this.hasCoord || this.state !== 3 || m.nc !== this.id || m.owner < 0 || m.owner !== this.myPlacer || ckey(m.coord) !== ckey(this.coord)) return false; if (this.l44Stay()) return true; this.trace('L31-WITHDRAWN', this.id, this.coord, 'by=%d', m.owner); this.requeue('l31-withdrawn'); return true; }
      if (!this.hasCoord || this.state !== 3 || m.nc !== this.id || m.owner < 0 || m.owner !== this.myPlacer || this.TICK - this.seatedAt > K.L31_REC_HOLD || ckey(m.coord) === ckey(this.coord) || m.coord.pc !== 0) return false;
      this.trace('L31-REPLACE', this.id, this.coord, 'to=%s by=%d', coordStr(m.coord), m.owner);
      this.requeue('l31-replace');
      this.take(m.coord, m.owner, m.nbrs, m.pp, m.ppAt, m.row, m.ppL); if (this.pp >= 0 && this.pp !== this.id) this.placer = this.pp;
      this.l31Bridge = -1; this.l31BridgeCk = 0;
      return true;
    },

    // C++: mesh_instant.inc:Seat::l317Decline   [L31.7: a placement I got while seated by another one]
    l317Decline(m) {
      if (this.l317Decl.size >= 16) { for (const k of this.l317Decl.keys()) { this.l317Decl.delete(k); break; } }
      this.l317Decl.set(seatM.ppKey(ckey(m.coord), m.owner), m.ppAt);
    },
    // C++: mesh_instant.inc:Seat::l317Declined
    l317Declined(m) {
      if (m.owner < 0) return false; const v = this.l317Decl.get(seatM.ppKey(ckey(m.coord), m.owner)); return v !== undefined && v === m.ppAt;
    },
    // C++: mesh_instant.inc:Seat::l317DeclinedAt
    l317DeclinedAt(k, by) { return by >= 0 && this.l317Decl.has(seatM.ppKey(k, by)); },

    // C++: mesh_instant.inc:Seat::l31Hold
    l31Hold(c, nc, m) {
      if (this.l31Cap || !this.l31On() || c.pc !== 0 || nc < 0 || nc === this.id || m.tag === 1) return false;
      for (const p of this.l31Pend) if (p.nc === nc) return true;
      const p = state.newStruct('L31Pend'); p.nc = nc; p.home = false; p.out = msg.clone(m); p.k = ckey(c); p.at = this.TICK; p.parent = true;
      this.l31Notify(p.k, nc, false, 0); this.l31Pend.push(p); this.f.wake(this.id); return true;
    },
  });
  GifOS.meshInstant = Object.freeze({ l31Beats });
  if (isNode) module.exports = GifOS.meshInstant;
})(typeof window !== 'undefined' ? window : globalThis);
