/*
 * c7proof.js: L42, a merge order is never one seat's word (C++: mesh_c7proof.inc). Methods only, added to the Seat.
 * L42.1 a goodbye's C7 word, and the ring name a frame carries, count only from a frame that is the leaver's own.
 * L42.2 a ring-mate's proven C7 goodbye moves me only with a second seat's word: another seat's proven C7 goodbye naming
 *   my ring, or a seat other than the leaver naming a lower ring to me, within RELAY_TTL.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const K = C_.consts;

  Seat.unit('mesh_c7proof.inc', {
    // C++: mesh_c7proof.inc:Seat::l42Own
    l42Own(m) { return m.sig || this.linkIs(m, m.id); },
    // C++: mesh_c7proof.inc:Seat::l42Second
    l42Second(m) {
      const TICK = this.TICK;
      for (const [x, at] of this.l829Bye) { if (x === m.id || TICK - at > K.RELAY_TTL) continue; const r = this.l828Ring.get(x); if (r !== undefined && r[0] === m.c7Min) return true; }
      const mine = this.ringName();
      for (const [x, e] of this.l828Ring) { if (x !== m.id && e[0] >= 0 && e[0] !== mine && this.ringOlder(e[0], this.lineAtOf(x), mine, this.lineAt) && TICK - e[1] <= K.RELAY_TTL) return true; }   // L8.52: lower = older
      for (const [ring, v] of this.c7Vouch) { let ve = -1; { const z = this.c7VouchEp.get(ring); if (z !== undefined) ve = z[0]; } if (ring === mine || !this.ringOlder(ring, ve, mine, this.lineAt)) continue; for (const [x, at] of v) if (x !== m.id && TICK - at <= K.RELAY_TTL) return true; }
      // (the door's listing of an older room is not a second word: a second word is a seat's own)
      this.trace('L42-HOLD', this.id, this.hasCoord ? this.coord : null, 'from=%d ring=%d', m.id, m.c7Min);
      return false;
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
