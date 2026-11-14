/*
 * headword.js: D5.2 a row-mate believes its head's vacancy word unless it holds counter-evidence, seat side (C++: mesh_headword.inc).
 * lv: the measurement counters D52_DROP, D52_KEEP, D52_FLAG, D52_RESTORE.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const topo = req('./topo.js', 'meshTopo');
  const { cellOk } = req('./shared.js', 'meshShared');
  const K = C_.consts;
  const { ckey, ckPc, ckR, ckI, unckey, C, ownedLinks } = topo;
  const { LS_OPEN } = C_.enums || {};

  const eraseFirst = (m) => { const f = m.keys().next(); if (!f.done) m.delete(f.value); };

  Seat.unit('mesh_headword.inc', {
    // The evidence I hold that x lives at k after a row head freed it at tick vt: 0 none, 1 inside the window (keep), 2 a hearing after the verdict (the word is contradicted).
    // C++: mesh_headword.inc:Seat::d52Evidence
    d52Evidence(k, x, vt, _post) {
      const TICK = this.TICK, W = this.l30 ? K.L30_SILENT : 60;
      const lv = this.live.get(k); if (lv !== undefined) { if (lv > vt + K.D52_FLIGHT) return 2; if (TICK - lv <= W) return 1; }
      const fh = this.fhdIn.get(k); if (fh !== undefined && fh[0] === x) { if (fh[1] > vt + K.D52_FLIGHT) return 2; if (TICK - fh[1] <= W) return 1; }
      if (this.f.fabricLinkState(this.id, x) === LS_OPEN) return 1;
      return 0;
    },

    // x holds k by a placement signed AFTER the verdict (a proof note whose signing instant, on my clock, is later): the word told of the seat x left, not of the one it holds now.
    // C++: mesh_headword.inc:Seat::d52Reseated
    d52Reseated(k, x, vt) { const pn = this.ppNotes.get(k); if (pn === undefined) return false; for (const n of pn) if (n.x === x && n.loc > vt) return true; return false; },

    // C++: mesh_headword.inc:Seat::d52Drop
    d52Drop(k, x, head, vt) {
      const id = this.id, C_k = unckey(k);
      this.trace('D5.2-DROP', id, C_k, 'x=%d head=%d vt=%d', x, head, vt); this.w.lv.D52_DROP++;
      this.occDrop(k, 'vac-word'); this.live.delete(k); this.kidful.delete(k); this.s1seen.delete(k); this.s1told.delete(k); this.childOf.delete(k); this.healTry.delete(k); this.tlForget(k);
      this.redial.delete(x); this.dials.lapse(x);   // redials stopped, the dial book lapsed (as L17.3)
      if (this.vacIn.size >= C * C) eraseFirst(this.vacIn); this.vacIn.set(k, [x, vt]);
    },

    // The head's PONG: its signed word that cells of the row are vacant.
    // C++: mesh_headword.inc:Seat::d52Word
    d52Word(m, head) {
      const id = this.id, TICK = this.TICK;
      if (!this.hasCoord || this.state !== 3 || this.coord.pc !== 0 || this.coord.i === 0 || !m.sig || m.id !== head) return;
      if (this.occGet(ckey({ pc: 0, r: this.coord.r, i: 0 })) !== head || ckey(m.coord) !== ckey({ pc: 0, r: this.coord.r, i: 0 })) return;
      if (this.l25Bad(head)) return;   // a head I flagged: its word moves nobody
      let n = 0;
      for (const e of m.vac) {
        if (++n > C) break;
        const k = e.k, x = e.v, c = unckey(k);
        if (ckPc(k) !== 0 || c.r !== this.coord.r || c.i === 0 || k === ckey(this.coord) || x < 0 || x === id || this.occGet(k) !== x) continue;
        let vt = TICK - e.age; { const vs = this.vacSeen.get(k); if (vs !== undefined && vs[0] === x && vs[1] < vt) vt = vs[1]; }   // a repeated word keeps its first verdict tick: a liar cannot restamp it
        if (this.d52Reseated(k, x, vt)) { this.vacSeen.delete(k); continue; }   // seated again since: the word is spent
        const ev = this.d52Evidence(k, x, vt, false);
        if (ev === 0) { this.d52Drop(k, x, head, vt); continue; }
        if (!this.vacSeen.has(k)) { this.w.lv.D52_KEEP++; this.trace('D5.2-KEEP', id, c, 'x=%d head=%d ev=%d', x, head, ev); }
        if (this.vacSeen.size >= C * C) eraseFirst(this.vacSeen); this.vacSeen.set(k, [x, vt]);
        if (ev === 2) { this.w.lv.D52_FLAG++; this.trace('D5.2-HOSTILE-HEAD', id, c, 'x=%d head=%d', x, head); this.l25Mark(head); }
      }
    },

    // The head's side: the vacancies it tells its row.
    // C++: mesh_headword.inc:Seat::d52Out
    d52Out(p) {
      const TICK = this.TICK;
      for (const [k, v] of Array.from(this.vacOut)) {
        if (TICK - v[1] > K.D52_TTL || this.occGet(k) >= 0) { this.vacOut.delete(k); continue; }
        p.vac.push({ k, v: v[0], age: TICK - v[1], ch: -1, ba: -1, tn: 0 });
      }
    },

    // S1SYNC out: the cells I hold counter-evidence for, vouched to my rook.
    // C++: mesh_headword.inc:Seat::d52Fh
    d52Fh(m) {
      const TICK = this.TICK, W = this.l30 ? K.L30_SILENT : 60;
      for (const [k, v] of this.vacSeen) {
        const lv = this.live.get(k); if (lv === undefined || this.occGet(k) !== v[0]) continue;
        if (TICK - lv > W) continue;
        m.fhd.push({ k, v: v[0], age: TICK - lv, ch: -1, ba: -1, tn: 0 });
      }
      // L8.7.1: the carrier's word — every Section-1 occupant I hear first-hand over a channel I hold (C++: d52Fh)
      if (!this.hasCoord || this.state !== 3 || this.coord.pc !== 0) return;
      for (const c of ownedLinks(this.coord)) {
        if (c.pc !== 0) continue; const k = ckey(c); const x = this.occGet(k); if (x < 0 || x === this.id) continue;
        if (m.fhd.some((f) => f.k === k)) continue;
        const lv = this.live.get(k); if (lv === undefined || TICK - lv > W) continue;
        if (!this.f.fabricLinkCarries(this.id, x)) continue;
        m.fhd.push({ k, v: x, age: TICK - lv, ch: -1, ba: -1, tn: 0 });
      }
    },

    // S1SYNC in: another seat's first-hand word.
    // C++: mesh_headword.inc:Seat::d52Told
    d52Told(m) {
      const TICK = this.TICK, id = this.id;
      if (!this.hasCoord || this.state !== 3 || this.coord.pc !== 0 || m.from < 0 || m.from === id) return;
      const head = this.occGet(ckey({ pc: 0, r: this.coord.r, i: 0 })); let n = 0;
      for (const e of m.fhd) {
        if (++n > C * C) break;
        const c = unckey(e.k);
        if (ckPc(e.k) !== 0 || !cellOk(e.k) || e.v < 0 || e.v === id || m.from === head || e.age < 0) continue;
        const at = TICK - e.age;
        if (this.fhdIn.size >= C * C) eraseFirst(this.fhdIn); this.fhdIn.set(e.k, [e.v, at]);
        const vi = this.vacIn.get(e.k);
        if (vi !== undefined && vi[0] === e.v && this.d52Reseated(e.k, e.v, vi[1])) { this.vacIn.delete(e.k); continue; }   // seated again since the drop: no lie to undo
        if (vi !== undefined && vi[0] === e.v && at > vi[1] + K.D52_FLIGHT && this.occGet(e.k) < 0) {
          this.trace('D5.2-RESTORE', id, c, 'x=%d by=%d', e.v, m.from); this.w.lv.D52_RESTORE++; this.w.lv.D52_FLAG++;
          this.setOcc(e.k, e.v); this.s1seen.set(e.k, at); this.vacIn.delete(e.k); this.l25Mark(head); this.trace('D5.2-HOSTILE-HEAD', id, c, 'x=%d head=%d', e.v, head);
        }
      }
    },

    // A gossip entry last seen before the drop is the corpse's echo.
    // C++: mesh_headword.inc:Seat::d52Echo
    d52Echo(k, x, seen) { const vi = this.vacIn.get(k); return vi !== undefined && vi[0] === x && seen <= vi[1]; },

    // C++: mesh_headword.inc:Seat::d52Tick
    d52Tick() {
      if (!this.vacSeen.size && !this.vacIn.size && !this.fhdIn.size) return;
      const TICK = this.TICK, id = this.id;
      for (const [k, v] of Array.from(this.vacSeen)) {
        const x = v[0], vt = v[1];
        if (!this.hasCoord || this.occGet(k) !== x || TICK - vt > K.D52_KEEPMAX || this.d52Reseated(k, x, vt)) { this.vacSeen.delete(k); continue; }
        const ev = this.d52Evidence(k, x, vt, false), head = this.occGet(ckey({ pc: 0, r: this.coord.r, i: 0 }));
        if (ev === 0) { this.vacSeen.delete(k); this.d52Drop(k, x, head, vt); continue; }
        if (ev === 2 && head >= 0 && !this.l25Bad(head)) { const c = unckey(k); this.w.lv.D52_FLAG++; this.trace('D5.2-HOSTILE-HEAD', id, c, 'x=%d head=%d', x, head); this.l25Mark(head); }
      }
      for (const [k, v] of Array.from(this.vacIn)) if (TICK - v[1] > 300) this.vacIn.delete(k);
      for (const [k, v] of Array.from(this.fhdIn)) if (TICK - v[1] > 300) this.fhdIn.delete(k);
    },
  });
  GifOS.meshHeadword = Object.freeze({});
  if (isNode) module.exports = GifOS.meshHeadword;
})(typeof window !== 'undefined' ? window : globalThis);
