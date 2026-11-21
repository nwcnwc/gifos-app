/*
 * lguard-seat.js: L29 load guard, the seat side (C++: mesh_lguard_seat.inc). Methods only, added to the Seat; callees other units define are called by name on the Seat.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const { l4Meet } = req('./shared.js', 'meshShared');
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const K = C_.consts, E = C_.enums;
  const { ckey, unckey, down, C } = topo;
  const newMsg = (t) => msg.newMsg(t);

  // Out-parameters: lgRecvCells returns the array of cells (the C++ returns its count and fills an array);
  // lgIsWit returns the cell key or null (the C++ returns bool and fills xk; a key can be 0, test !== null);
  // lgHeadPick returns {a, b} or null.
  Seat.unit('mesh_lguard_seat.inc', {
    // C++: mesh_lguard_seat.inc:Seat::lgRecvCells
    lgRecvCells() {
      const out = []; if (!this.hasCoord) return out;
      if (this.coord.pc === 0) { for (let j = 0; j < C; j++) { if (j !== this.coord.i) out.push(ckey({ pc: 0, r: this.coord.r, i: j })); if (j !== this.coord.r) out.push(ckey({ pc: 0, r: j, i: this.coord.i })); } }
      else for (let j = 0; j < C; j++) if (j !== this.coord.i) out.push(ckey({ pc: this.coord.pc, r: this.coord.r, i: j }));
      return out;
    },

    // C++: mesh_lguard_seat.inc:Seat::lgIsWit
    lgIsWit(x) {
      if (!this.linkRole(x, Seat.LR_OWNED)) return null; const rc = this.lgRecvCells(); const n = rc.length;
      for (let q = 0; q < n; q++) if (this.occGet(rc[q]) === x) return rc[q];
      return null;
    },

    // C++: mesh_lguard_seat.inc:Seat::lgLightSeat
    lgLightSeat(x) { if (x === this.id) return this.lgLight; const it = this.lgAsk.get(x); return it !== undefined && this.TICK - it[0] <= 3 * K.L29_BEAT; },

    // C++: mesh_lguard_seat.inc:Seat::lgWord
    // My word to my head: 2 "keep me light", 1 "move me" (any mate would carry my cell better than I do),
    // 3 "move me, a desktop" (only a desktop would). With nobody who would, I hold the cell.
    lgWord() {
      if (!(this.lgLight && this.lgLvl >= 2)) return 2;
      const fail = this.lgLd[2] > this.lgBud;
      const better = (b) => (fail ? this.lgLd[2] <= b : this.lgLd[1] * 100 <= b * K.L29_SHED);
      return better(K.L29_BUD_M) ? 1 : better(K.L29_BUD_D) ? 3 : 2;
    },

    // C++: mesh_lguard_seat.inc:Seat::lgRelief
    // L29.4.1: could a row-mate take my head place and do better there than I do? With nobody who could, I stay.
    lgRelief() {
      const w = this.lgWord(); if (w === 2) return false;
      for (let j = 1; j < C; j++) { const x = this.occGet(ckey({ pc: this.coord.pc, r: this.coord.r, i: j })); if (x < 0 || x === this.id || this.lgLightSeat(x)) continue; if (w === 3 && this.l4TierOf(x) !== E.TIER_DESKTOP) continue; return true; }
      return false;
    },

    // C++: mesh_lguard_seat.inc:Seat::lgHeadPick
    lgHeadPick(col, tr, heir) {
      let ask = -1, askW = 2;
      for (let j = 0; j < C && ask < 0; j++) {
        const x = col[j]; if (x < 0) continue;
        const w = (x === this.id) ? this.lgWord() : (() => { const it = this.lgAsk.get(x); return (it !== undefined && this.TICK - it[0] <= 2 * K.L29_BEAT) ? it[1] : 2; })();
        if (w !== 1 && w !== 3) continue;
        const k = ckey({ pc: this.coord.pc, r: this.coord.r, i: j }); const kf = this.kidful.get(k); const kids = this.occGet(ckey(down(unckey(k)))) >= 0 || (this.kidful.has(k) && kf);
        if (j === 0 || (this.coord.pc !== 0 && (j === heir || kids))) { ask = j; askW = w; }   // Section 1: only the head cell carries more than its mates
      }
      if (ask < 0) return null;
      let own = -1; { const oc = this.ownerCoord(); if (oc) own = this.occGet(ckey(oc)); }
      let pick = -1, pickT = 99;
      for (let j = 1; j < C; j++) {
        const x = col[j]; if (x < 0 || j === ask || (j === heir && this.coord.pc !== 0) || this.lgLightSeat(x)) continue;
        if (askW === 3 && tr[j] !== E.TIER_DESKTOP) continue;   // only a desktop would carry the asker's cell better than the asker
        const k = ckey({ pc: this.coord.pc, r: this.coord.r, i: j }); if (this.coord.pc !== 0 && (this.occGet(ckey(down(unckey(k)))) >= 0 || (this.kidful.has(k) && this.kidful.get(k)))) continue;
        if (ask === 0 && own >= 0 && own !== x && !l4Meet(this.l4NatOf(x), this.l4NatOf(own))) continue;
        const t = tr[j] === E.TIER_DESKTOP ? 0 : 1; if (t < pickT) { pickT = t; pick = j; }
      }
      if (pick < 0) return null;
      const a = ask === 0 ? this.id : col[Math.min(ask, pick)], b = ask === 0 ? col[pick] : col[Math.max(ask, pick)];
      this.trace('LG-PICK', this.id, this.coord, 'ask=%d with=%d', col[ask], col[pick]);
      return { a, b };
    },

    // C++: mesh_lguard_seat.inc:Seat::lgRecv
    lgRecv(m) {
      if (!this.w.lv.LG_ON) return;
      if (m.t === 'LGSTARVE') {
        if (m.from >= 0 || m.id < 0 || m.id === this.id) return;
        if (m.hold) { if (!this.lgStv.has(m.id)) this.lgStv.set(m.id, this.TICK - K.L29_STARVE); } else { this.lgStv.delete(m.id); this.lgSentAt.delete(m.id); }
        return;
      }
      if (!this.hasCoord || this.state !== 3 || m.id < 0 || m.id === this.id) return;
      if (m.t === 'LGASK') {
        if (this.coord.i !== 0 || !this.linkIs(m, m.id)) return;
        const c = unckey(m.ck); if (c.pc !== this.coord.pc || c.r !== this.coord.r || c.i === 0 || this.occGet(m.ck) !== m.id) return;
        if (m.tag < 1 || m.tag > 3) return;
        this.lgAsk.set(m.id, [this.TICK, m.tag]); return;
      }
      if (m.t === 'LGCOMP') {
        if (m.child !== this.id || m.oCk !== ckey(this.coord)) return;
        if (!(this.linkIs(m, m.id) || (m.sig && m.sigL >= 0 && this.TICK - m.sigL <= K.L29_WIN))) return;
        const rc = this.lgRecvCells(); const n = rc.length; let ok = false; for (let q = 0; q < n; q++) if (rc[q] === m.ck && this.occGet(m.ck) === m.id) ok = true; if (ok && !this.linkRole(m.id, Seat.LR_OWNED)) ok = false;
        if (!ok) return;
        this.lgComp.set(m.id, this.TICK); return;
      }
    },

    // C++: mesh_lguard_seat.inc:Seat::lgLadder
    lgLadder() {
      if (!this.w.lv.LG_ON) return;
      if (!this.hasCoord || this.state !== 3) { this.lgLvl = 0; this.lgCalmT = this.lgOverT = 0; return; }
      const bud = this.lgBud, thr = bud * K.L29_SHED;
      let want = this.lgLvl; while (want < 2 && this.lgLd[want] * 100 > thr) want++;
      if (want > this.lgLvl) { this.lgLvl = want; this.lgCalmT = 0; this.trace('LG-SHED', this.id, this.coord, 'level=%d load=%d budget=%lld', this.lgLvl, this.lgLd[this.lgLvl], bud); }
      else if (this.lgLvl > 0 && this.lgLd[this.lgLvl - 1] * 100 <= bud * K.L29_RESTORE) { if (++this.lgCalmT >= K.L29_CALM) { this.lgLvl--; this.lgCalmT = 0; this.trace('LG-RESTORE', this.id, this.coord, 'level=%d load=%d budget=%lld', this.lgLvl, this.lgLd[this.lgLvl], bud); } }
      else this.lgCalmT = 0;
      const over = this.lgLvl >= 2;
      this.lgOverT = over ? this.lgOverT + 1 : 0;
      if (over && this.lgOverT >= K.L29_ASK_T && !this.lgLight) { this.lgLight = true; this.lgRecT = 0; this.trace('LG-LIGHT', this.id, this.coord, 'load=%d budget=%lld', this.lgLd[2], bud); }
      if (this.lgLight && !over) { if (bud * 100 >= this.lgBud0 * K.L29_RECOVER) { if (++this.lgRecT >= 2 * K.L29_CALM) { this.lgLight = false; this.lgRecT = 0; this.trace('LG-UNLIGHT', this.id, this.coord, 'budget=%lld', bud); } } else this.lgRecT = 0; }
    },

    // C++: mesh_lguard_seat.inc:Seat::lgTick
    lgTick() {
      if (!this.w.lv.LG_ON || !this.hasCoord || this.state !== 3) return;
      const bud = this.lgBud; const over = this.lgLvl >= 2;
      if (this.lgLight && this.coord.i !== 0 && this.TICK - this.lgAskSent >= K.L29_BEAT) { const h = this.occGet(ckey({ pc: this.coord.pc, r: this.coord.r, i: 0 })); if (h >= 0 && h !== this.id) { const a = newMsg('LGASK'); a.id = this.id; a.ck = ckey(this.coord); a.tag = this.lgWord(); this.emit(h, a); } this.lgAskSent = this.TICK; }
      if (this.lgAsk.size && this.coord.i !== 0) this.lgAsk.clear();
      for (const [x, since] of this.lgStv) {
        const xk = this.lgIsWit(x);
        if (xk === null) { this.lgSentAt.delete(x); this.lgStv.delete(x); continue; }
        if (this.TICK - since >= K.L29_ACCUSE) { const s = this.lgSentAt.get(x); if (s === undefined || this.TICK - s >= K.L29_REPEAT) { const c = newMsg('LGCOMP'); c.id = this.id; c.ck = ckey(this.coord); c.child = x; c.oCk = xk; c.sig = true; c.sigAt = this.TICK; this.emit(x, c); this.lgSentAt.set(x, this.TICK); this.lgCompN++; this.trace('LG-COMPLAIN', this.id, this.coord, 'about=%d starved=%lld', x, this.TICK - since); } }
      }
      if (this.lgLiarT >= 0 && this.lgLiarT !== this.id && this.TICK - this.lgLiarAt >= K.L29_REPEAT) { const xk = this.lgIsWit(this.lgLiarT); const wit = xk !== null; const c = newMsg('LGCOMP'); c.id = this.id; c.ck = ckey(this.coord); c.child = this.lgLiarT; c.oCk = wit ? xk : 0; c.sig = true; c.sigAt = this.TICK; if (wit) this.emit(this.lgLiarT, c); this.lgLiarAt = this.TICK; this.lgCompN++; }
      if (this.lgComp.size && !this.lgQuit) {
        const rc = this.lgRecvCells(); const n = rc.length; let w = 0, agree = 0;
        for (let q = 0; q < n; q++) { const x = this.occGet(rc[q]); if (x < 0 || x === this.id || !this.linkRole(x, Seat.LR_OWNED)) continue; w++; const it = this.lgComp.get(x); if (it !== undefined && this.TICK - it <= K.L29_WIN) agree++; }
        for (const [k, v] of this.lgComp) { if (this.TICK - v > K.L29_WIN) this.lgComp.delete(k); }
        const need = Math.max(K.L29_QMIN, Math.trunc(w / 2) + 1);
        if (w >= 2 && agree >= need) {
          const fail = this.lgOwn > 0 && this.lgLd[this.lgLvl] > bud;
          if (fail && this.coord.i === 0 && !this.lgRelief()) { this.trace('LG-HOLD', this.id, this.coord, 'reason=nobody-better agree=%d of %d load=%d budget=%lld', agree, w, this.lgLd[this.lgLvl], bud); this.lgComp.clear(); }   // L29.4.1
          else if (fail) { this.lgQuit = true; this.lgQuitAt = this.TICK; this.trace('LG-LEAVE', this.id, this.coord, 'reason=device-overload agree=%d of %d load=%d budget=%lld', agree, w, this.lgLd[this.lgLvl], bud); }
          else { this.lgFalseQ++; this.trace('LG-REFUTE', this.id, this.coord, 'agree=%d of %d load=%d budget=%lld', agree, w, this.lgLd[this.lgLvl], bud); this.lgComp.clear(); }
        }
      }
    },
  });
  GifOS.meshLguardSeat = Object.freeze({});
  if (isNode) module.exports = GifOS.meshLguardSeat;
})(typeof window !== 'undefined' ? window : globalThis);
