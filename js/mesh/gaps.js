/*
 * gaps.js: L37 release gaps fix pass, seat side (C++: mesh_gaps.inc). Methods only, added to the Seat; callees other units define are called by name on the Seat.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const topo = req('./topo.js', 'meshTopo');
  const K = C_.consts, E = C_.enums;
  const { ckey } = topo;

  Seat.unit('mesh_gaps.inc', {
    // C++: mesh_gaps.inc:Seat::l371Keep
    l371Keep() { return this.l25WitRival === 0 && this.l25WitMe >= 2; },

    // C++: mesh_gaps.inc:Seat::l372Fresh
    l372Fresh(m) { return this.callBook.inStartedNow(m.from, this.TICK); },

    // C++: mesh_gaps.inc:Seat::l373Blind
    l373Blind(cell) {
      if (this.cnat === E.NAT_OPEN) return false;
      const k = ckey(cell); const b = this.byeAt.get(k); if (b !== undefined && this.TICK - b <= K.LEASE_T) return false;
      if (this.translostConfirmed(k)) return false;
      return true;
    },
  });
  GifOS.meshGaps = Object.freeze({});
  if (isNode) module.exports = GifOS.meshGaps;
})(typeof window !== 'undefined' ? window : globalThis);
