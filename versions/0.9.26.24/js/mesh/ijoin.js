/*
 * ijoin.js: L43 a seat sent deep in a room of at most C*C does not wait out the big room's window, seat side (C++: mesh_ijoin.inc). Methods only, added to the Seat.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat, FREE } = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const topo = req('./topo.js', 'meshTopo');
  const K = C_.consts;
  const { ckey, unckey: unck, down, ownedLinks, C } = topo;
  const L43_WAIT = 60 + K.L5_SETTLE;   // C++: mesh_ijoin.inc:L43_WAIT  (L1.1's first-hand window and two beats for a mover's word to come)

  Seat.unit('mesh_ijoin.inc', {
    // L43.1: a count over C*C gone within 2*DIG_TTL is a mover's double count: it holds the clock.
    // C++: mesh_ijoin.inc:Seat::l43Fold
    l43Fold() {
      const TICK = this.TICK, d = this.rootDec;
      if (d.at < 0 || d.part) { this.l43Since = -1; this.l43Over = -1; return; }
      if (d.n > C * C) { if (this.l43Over < 0) this.l43Over = TICK | 0; return; }
      if (this.l43Over >= 0 && TICK - this.l43Over > 2 * K.DIG_TTL) this.l43Since = -1;
      this.l43Over = -1; if (this.l43Since < 0) this.l43Since = TICK | 0;
    },

    // L43.1: my whole fold has read at most C*C for DIG_TTL, counts every home seat I hear first-hand, and has not fallen from past two small rooms.
    // C++: mesh_ijoin.inc:Seat::l43Home
    l43Home() {
      const TICK = this.TICK, d = this.rootDec;
      if (this.l43Since < 0 || TICK - this.l43Since < K.DIG_TTL) return false;
      if (d.at < 0 || d.part || d.n > C * C || this.l9Peak > 2 * (C * C - 1)) return false;
      let heard = 1; if (this.hasCoord) { const ol = ownedLinks(this.coord); for (const o of ol) if (this.firstHandLive(ckey(o))) heard++; }
      return d.n >= heard;
    },

    // L43.2: the named mover reads a relayed goodbye (L38.3's re-read, once its view is of age and no sooner than 2*EARLY_HOLD).
    // C++: mesh_ijoin.inc:Seat::l43Relay
    l43Relay(m) {
      if (this.occGet(m.ck) >= 0 || !this.hasCoord || this.coord.pc !== 0) return;
      const c = unck(m.ck); if (c.r !== this.coord.r || c.i >= this.coord.i || FREE.l1MoverCell(this, c) !== ckey(this.coord) || this.l383Due.has(m.ck)) return;
      this.byeAt.set(m.ck, this.TICK | 0); this.l383Due.set(m.ck, Math.max(this.seatedAt + 60, this.TICK + 2 * K.EARLY_HOLD) | 0);
    },

    // L43.3: the cell names the knocking seat itself, a placement it never took: the echo goes unless I hear the cell first-hand.
    // C++: mesh_ijoin.inc:Seat::l43SelfEcho
    l43SelfEcho(k, mm) {
      if (this.occGet(k) !== mm.nc || mm.tag !== 1 || mm.coord.pc === 0 || this.firstHandLive(k) || !this.l43Home()) return;
      this.occDrop(k, 'l43-self'); this.live.delete(k);
    },

    // L43.3: a mover that has not come is not waited for.
    // C++: mesh_ijoin.inc:Seat::l43MoverLate
    l43MoverLate(c) {
      if (!this.l43Home() || this.TICK - this.seatedAt < L43_WAIT) return false;
      const b = this.byeAt.get(ckey(c)); return b === undefined || this.TICK - b >= L43_WAIT;
    },

    // L43.4: a row with no head is not left to the lease.
    // C++: mesh_ijoin.inc:Seat::l43Head
    l43Head() {
      if (!this.hasCoord || this.state !== 3 || this.coord.pc !== 0 || this.coord.i === 0 || this.moving || this.TICK - this.seatedAt < L43_WAIT || !this.l43Home()) return;
      const r = this.coord.r, c = { pc: 0, r, i: 0 }, k = ckey(c);
      const heard = (q) => { if (this.firstHandLive(q)) return true; const t = this.s1tab.get(q); return t !== undefined && t.by >= 0 && this.LT() - t.rx <= K.DIG_TTL; };   // a seat there beats to its rook, and its digest reaches my table within DIG_TTL
      if (this.sitting.has(k) || heard(k)) return;
      for (let j = 1; j < this.coord.i; j++) if (heard(ckey({ pc: 0, r, i: j }))) return;
      if (this.occGet(ckey(down(c))) >= 0 || (this.hasDownChild(c) && !FREE.l1HeirFailed(this, c))) return;
      for (let j = 0; j < this.coord.i; j++) { const q = ckey({ pc: 0, r, i: j }); if (this.occGet(q) >= 0) { this.occDrop(q, 'l43-echo'); this.live.delete(q); } }   // heal() names its mover from my view
      this.heal(c);
    },
  });
  GifOS.meshIjoin = Object.freeze({});
  if (isNode) module.exports = GifOS.meshIjoin;
})(typeof window !== 'undefined' ? window : globalThis);
