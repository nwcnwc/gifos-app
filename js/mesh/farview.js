/*
 * farview.js: FARVIEW: a sender picks a frame's path from what it knows of the target (C++: mesh_farview.inc). Methods only, added to the Seat; callees other units define are called by name on the Seat.
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
  const { ckey } = topo;

  Seat.unit('mesh_farview.inc', {
    // C++: mesh_farview.inc:Seat::farLearn
    farLearn(m) {
      if (m.aId >= 0 && m.aId !== this.id) { if (this.farCk.size > K.FARV_CAP) this.farCk.clear(); this.farCk.set(m.aId, { ck: m.aCk, at: this.TICK }); }
      if (m.sgw >= 0) {
        const sk = m.t === 'FIND' ? m.nc : m.aId;
        if (sk >= 0 && sk !== this.id) {
          let gck = m.sgwCk; if (!gck && m.sgw === this.id && this.hasCoord && this.state === 3) gck = ckey(this.coord) + 1;
          if (this.farGw.size > K.FARV_CAP) this.farGw.clear(); this.farGw.set(sk, { gw: m.sgw, gck, at: this.TICK });
        }
      }
    },

    // C++: mesh_farview.inc:Seat::farStampNeed
    farStampNeed(m) { return m.aId < 0 && !m.routing && !m.direct && m.fhTo < 0; },

    // C++: mesh_farview.inc:Seat::farStamp
    farStamp(m) {
      m.aId = this.id; m.aCk = (this.hasCoord && this.state === 3) ? ckey(this.coord) + 1 : 0;
      if (!m.aCk && this.gateway >= 0 && m.sgw < 0) { m.sgw = this.gateway; const it = this.farCk.get(this.gateway); m.sgwCk = (it !== undefined) ? it.ck : 0; }
      else if (m.t === 'FIND' && m.nc >= 0 && m.nc !== this.id && m.sgw < 0) { const g = this.farGw.get(m.nc); if (g !== undefined) { m.sgw = g.gw; m.sgwCk = g.gck; } }
    },
  });
  GifOS.meshFarview = Object.freeze({});
  if (isNode) module.exports = GifOS.meshFarview;
})(typeof window !== 'undefined' ? window : globalThis);
