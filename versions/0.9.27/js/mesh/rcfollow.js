/*
 * rcfollow.js: L19.1 probe loops, L9.19 rollback, L6.4 keep, L9.20 deaf (C++: mesh_rcfollow.inc). Methods only, added to the Seat; callees other units define are called by name on the Seat.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const topo = req('./topo.js', 'meshTopo');
  const hash = req('./hash.js', 'meshHash');
  const dig = req('./dig.js', 'meshDig');
  const K = C_.consts;
  const { ckey, ownedLinks, pcDepth } = topo;

  Seat.unit('mesh_rcfollow.inc', {
    // C++: mesh_rcfollow.inc:Seat::l191Loop
    l191Loop(m, nh) {
      if (m.tag < 1 || m.tag > 3) return false;
      if (this.occGet(ckey(m.target)) >= 0) return false;
      const rk = hash.hmixId(hash.hmix(hash.hmix(hash.hmixId(hash.H_INIT, m.asker), (m.pseq >= 0 ? m.pseq : m.pn) >>> 0), m.tag >>> 0), nh);
      const rs = this.routeSeen.get(rk);
      if (rs !== undefined && this.TICK - rs <= K.L191_HOLD) return true;
      if (this.routeSeen.size >= 16) {
        for (const [k, v] of this.routeSeen) if (this.TICK - v > K.L191_HOLD) this.routeSeen.delete(k);
        if (this.routeSeen.size >= 256) { for (const k of this.routeSeen.keys()) { this.routeSeen.delete(k); break; } }
      }
      this.routeSeen.set(rk, this.TICK); return false;
    },

    // C++: mesh_rcfollow.inc:Seat::l919Rollback
    l919Rollback() {
      if (this.coord.pc === 0) return;
      // d=Dig() assigns in place: keep the object, give it fresh contents
      const mine = (d) => { if (d.at >= 0 && d.by === this.id) { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, dig.newDig()); } };
      mine(this.rootDig); mine(this.rootDec);
    },

    // C++: mesh_rcfollow.inc:Seat::l920Note
    l920Note() {
      if (!this.hasCoord) return;
      const ol = ownedLinks(this.coord), n = ol.length;
      for (let q = 0; q < n; q++) { const k2 = ckey(ol[q]); const x = this.occGet(k2); if (x < 0 || x === this.id) continue; const lv = this.live.get(k2); if (lv !== undefined && this.TICK - lv <= K.L9_PULL) return; }
      this.l920DeafAt = this.TICK;
    },

    // C++: mesh_rcfollow.inc:Seat::l920Deaf
    l920Deaf(k) { void k; return this.l920DeafAt >= 0 && this.TICK - this.l920DeafAt < 2 * K.L9_PULL; },
  });
  GifOS.meshRcfollow = Object.freeze({});
  if (isNode) module.exports = GifOS.meshRcfollow;
})(typeof window !== 'undefined' ? window : globalThis);
