/*
 * gaps2.js: L38 second release gaps fix pass, seat side (C++: mesh_gaps2.inc). Methods only, added to the Seat; callees other units define are called by name on the Seat.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const topo = req('./topo.js', 'meshTopo');
  const K = C_.consts;
  const { ckey, unckey: unck, C } = topo;

  Seat.unit('mesh_gaps2.inc', {
    // L38.1: a FIND that died on the way is not spread again (the seeker's later FINDs carry the spread budget spent).
    // C++: mesh_gaps2.inc:Seat::l381Lost
    l381Lost() { if (this.findAckAt >= 0 && this.l381N < 255) this.l381N++; },   // the 60-tick wait after an acknowledged FIND ran out

    // C++: mesh_gaps2.inc:Seat::l381Stamp
    l381Stamp(m) { if (this.l381N > 0 && m.sh < C) m.sh = C; },   // my next FINDs go down a greeter's own subtree

    // L38.2: the mover holds the cell it vacated as vacated (as its goodbye's hearers do).
    // C++: mesh_gaps2.inc:Seat::l382Vacated
    l382Vacated() { const left = unck(this.oldCk); if (this.oldCk && left.pc === 0 && !this.hasDownChild(left)) this.l1Vacated.set(this.oldCk, this.TICK | 0); },

    // L38.3: a goodbye heard too young is read again when the view comes of age (the goodbye's own tick is kept).
    // C++: mesh_gaps2.inc:Seat::l383Tick
    l383Tick() {
      if (this.l383Due.size === 0) return;
      const TICK = this.TICK;
      const due = []; for (const [k, v] of this.l383Due) if (TICK >= v) due.push(k);
      for (const k of due) {
        this.l383Due.delete(k);
        const b = this.byeAt.get(k); if (b === undefined || TICK - b > K.LEASE_T || this.occGet(k) >= 0) continue;
        const at = b; this.goodbyeHeal(k, false); this.byeAt.set(k, at);
      }
    },
  });
  GifOS.meshGaps2 = Object.freeze({});
  if (isNode) module.exports = GifOS.meshGaps2;
})(typeof window !== 'undefined' ? window : globalThis);
