/*
 * gapa.js: L41, one seat's word cannot move a seat, for compaction (C++: mesh_gapa.inc). Methods only, added to the Seat;
 * callees other units define are called by name on the Seat.
 * L41.1 no unasked move: a seated leaf takes a compaction PLACE only for one of its own last two compaction FINDs (the
 *   PLACE carries the FIND's nonce back), one PLACE per FIND.
 * L41.2 the move confirms on a second word: the leaf asks the seats at the target cell's links (placer and itself aside)
 *   who they hear there; a "held" answer rolls the move back, all "free" confirms it, and at the window's end it
 *   confirms on at least one "free" and rolls back on none.
 * L41_OFF (a build-time switch in the sim, 0 in the release) is not ported: every law here is on.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const { cellOk, coordStr } = req('./shared.js', 'meshShared');
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const K = C_.consts, E = C_.enums;
  const { ckey, unckey: unck, ownedLinks, pcDepth } = topo;
  const C = topo.C;
  const newMsg = (t) => msg.newMsg(t);

  Seat.unit('mesh_gapa.inc', {
    // L41.1: my compaction FIND went out.
    // C++: mesh_gapa.inc:Seat::gaFindSent
    gaFindSent(to, m) { this.gaFindPrev = this.gaFindAt; this.gaFindAt = this.TICK; this.gaFindTo = to; m.gaN = this.gaFindAt; },

    // L41.1: may I take this compaction PLACE? (one per FIND, while it is out)
    // C++: mesh_gapa.inc:Seat::gaAsked
    gaAsked(m) {
      if (m.gaN >= 0 && this.TICK - m.gaN <= K.GA_FIND_WIN && (m.gaN === this.gaFindAt || m.gaN === this.gaFindPrev)) return true;   // the PLACE carries the nonce of one of my last two FINDs
      this.w.lv.GA_B1_REFUSED++; this.trace('L41.1-UNASKED', this.id, m.coord, 'owner=%d', m.owner); return false;
    },

    // L41.2: the move began (doMove took the new cell): ask the target's other neighbours.
    // C++: mesh_gapa.inc:Seat::gaStart
    gaStart(placer) {
      this.gaFindAt = -1; this.gaFindPrev = -1;   // L41.1: one PLACE per FIND
      if (!this.moving || !this.hasCoord) return;
      this.gaCk = ckey(this.coord); this.gaPlacer = placer; this.gaAt = this.TICK; this.gaAsk.length = 0; this.gaFreeN = 0;
      const ol = ownedLinks(this.coord), n = ol.length;
      for (let k = 0; k < n; k++) {
        const x = this.occGet(ckey(ol[k])); if (x < 0 || x === this.id || x === placer) continue; let dup = false; for (const y of this.gaAsk) if (y === x) dup = true; if (dup) continue;
        this.gaAsk.push(x); const c = newMsg('CHALLENGE'); c.ck = this.gaCk; c.from = this.id; c.tag = K.GA_TAG; c.nc = this.id; this.emit(x, c);
      }
      this.w.lv.GA_ASKS += this.gaAsk.length;
      this.trace('L41.2-ASK', this.id, this.coord, 'placer=%d asked=%zu', placer, this.gaAsk.length);
    },

    // C++: mesh_gapa.inc:Seat::gaLive
    gaLive() { return this.moving && this.hasCoord && this.gaCk !== 0 && ckey(this.coord) === this.gaCk && this.gaAt >= 0 && this.gaAt >= this.moveAt; },

    // L41.2: may this new-neighbourhood frame confirm my move? Never the placer's; never any frame when I asked a second word.
    // C++: mesh_gapa.inc:Seat::gaConfirmOk
    gaConfirmOk(m) {
      if (!this.gaLive()) return true;
      if (this.gaAsk.length) return false;
      const from = m.id >= 0 ? m.id : m.lk;
      return from !== this.gaPlacer;
    },

    // L41.2: a seat I heard at a cell of my links that another seat's claim displaced in my view, kept two claim windows.
    // C++: mesh_gapa.inc:Seat::gaNoteOver
    gaNoteOver(k, old) {
      if (!this.hasCoord || this.state !== 3 || !this.ownedLinkCell(k) || old < 0 || this.translost.has(k)) return;
      if (!this.firstHandLive(k) && this.f.fabricLinkState(this.id, old) !== E.LS_OPEN) return;
      if (this.gaOver.size >= 64) this.gaOver.clear();
      this.gaOver.set(k, [old, this.TICK]);
    },

    // L41.2: a witness answers who it hears at a cell of its links (or that it holds the cell itself).
    // C++: mesh_gapa.inc:Seat::gaAnswer
    gaAnswer(m) {
      const LINKMODEL = this.f.fabricDoors();   // C++: fabricDoors() (the seat-side query; the wall keeps the fabric name out of seat code)
      if (!this.hasCoord || this.state !== 3 || m.from < 0 || m.from === this.id || (LINKMODEL && !this.linkIs(m, m.from)) || !cellOk(m.ck)) return;
      let held = -1;
      if (ckey(this.coord) === m.ck) { if (!(this.moving && this.gaCk === m.ck)) held = this.id; }   // the cell is mine
      else {
        if (!this.ownedLinkCell(m.ck)) return; const o = this.occGet(m.ck); if (o >= 0 && o !== m.from && this.heardAt(m.ck) === o) held = o;
        if (held < 0 && o === m.from) { const ov = this.gaOver.get(m.ck); if (ov !== undefined && ov[0] !== m.from && this.TICK - ov[1] <= 2 * K.CONFIRM_TTL) held = ov[0]; }   // the claim I answer about displaced a seat I hear
        if (held < 0) { const lb = this.liveBy.get(m.ck); if (lb !== undefined && lb >= 0 && lb !== m.from && lb !== this.id && this.firstHandLive(m.ck) && this.f.fabricLinkState(this.id, lb) === E.LS_OPEN) held = lb; }   // the seat whose beats I still hear there
      }
      this.trace('L41.2-ANS', this.id, this.coord, 'asker=%d cell=%s held=%d occ=%d', m.from, coordStr(unck(m.ck)), held, this.occGet(m.ck));
      const w = newMsg('WITNESS'); w.ck = m.ck; w.id = this.id; w.nc = held; w.tag = K.GA_TAG; w.sig = true; w.sigAt = this.TICK; w.born = this.seatedAt; if (LINKMODEL) this.f.fabricCallFrame(this.id, m.from, w); else this.emit(m.from, w);   // over a pc to the asker, as L25's answer goes
    },

    // L41.2: an answer to my question.
    // C++: mesh_gapa.inc:Seat::gaVote
    gaVote(m) {
      const lv = this.w.lv;
      if (!this.gaLive() || m.ck !== this.gaCk || m.id < 0 || (this.f.fabricDoors() && !this.linkIs(m, m.id))) return;
      let asked = false; for (const y of this.gaAsk) if (y === m.id) asked = true; if (!asked) return;
      { let j = 0; for (const y of this.gaAsk) if (y !== m.id) this.gaAsk[j++] = y; this.gaAsk.length = j; }
      if (m.nc >= 0 && m.nc !== this.id) { lv.GA_HELD++; lv.GA_RB++; this.trace('L41.2-HELD', this.id, this.coord, 'by=%d holder=%d placer=%d', m.id, m.nc, this.gaPlacer); this.gaCk = 0; this.rbWhy = 'gapa-held'; this.rollbackMove(); return; }
      lv.GA_FREE++; this.gaFreeN++;
      if (!this.gaAsk.length) { lv.GA_CONF_VOTE++; this.trace('L41.2-FREE', this.id, this.coord, 'n=%d', this.gaFreeN); this.gaCk = 0; this.confirmMove(); }
    },

    // L41.2, L41.3: the claim window closed. true: handled here.
    // C++: mesh_gapa.inc:Seat::gaWindow
    gaWindow() {
      const lv = this.w.lv;
      if (!this.gaLive() || !this.gaAsk.length) return false;
      if (this.gaFreeN === 0 && this.TICK - this.moveAt <= 2 * K.CONFIRM_TTL) {   // L41.3: no word yet, and a pc to an asked seat is forming or open: the question has not had its window
        let wait = false;
        for (const x of this.gaAsk) {
          const ls = this.f.fabricLinkState(this.id, x);
          if (ls === E.LS_DIALING) wait = true;
          else if (ls === E.LS_OPEN) { wait = true; if ((this.TICK - this.moveAt - K.CONFIRM_TTL) % K.GA_REASK === 1) { const c = newMsg('CHALLENGE'); c.ck = this.gaCk; c.from = this.id; c.tag = K.GA_TAG; c.nc = this.id; this.emit(x, c); this.trace('L41.3-REASK', this.id, this.coord, 'to=%d', x); } }   // (the first ask may have died at L23 or on a closed link)
        }
        if (wait) return true;
      }
      this.gaCk = 0;
      if (this.gaFreeN > 0) { lv.GA_CONF_WIN++; this.confirmMove(); return true; }
      lv.GA_RB++; this.trace('L41.2-NOWORD', this.id, this.coord, 'placer=%d', this.gaPlacer); this.rbWhy = 'gapa-noword'; this.rollbackMove(); return true;
    },

    // The lever `hostile densify asked`: a hostile deep row head serving a deeper leaf's compaction FIND seats it in a held
    // mate cell of its own row, once per page.
    // C++: mesh_gapa.inc:Seat::gaHostServe
    gaHostServe(mm) {
      if (this.hostDenseLeaf >= 0 || !this.hasCoord || this.state !== 3 || this.coord.pc === 0 || this.coord.i !== 0 || mm.nc < 0 || mm.nc === this.id) return false;
      if (pcDepth(this.coord.pc) >= pcDepth(mm.coord.pc)) return false;
      for (let j = 1; j < C; j++) {
        const c = { pc: this.coord.pc, r: this.coord.r, i: j }; const o = this.occGet(ckey(c)); if (o < 0 || o === this.id || o === mm.nc) continue;
        this.hostDenseLeaf = mm.nc; this.w.lv.GA_DENSE_N++; this.trace('GA-DENSE', this.id, c, 'holder=%d leaf=%d', o, mm.nc);
        this.w.ADMIT_SITE = 'gapa-densify'; this.admit(c, mm); return true;
      }
      return false;
    },
  });
  GifOS.meshGapa = Object.freeze({});
  if (isNode) module.exports = GifOS.meshGapa;
})(typeof window !== 'undefined' ? window : globalThis);
