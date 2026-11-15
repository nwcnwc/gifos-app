/*
 * gaps3.js: L39 third release gaps fix pass, seat side (C++: mesh_gaps3.inc). Methods only, added to the Seat; callees other units define are called by name on the Seat.
 * L39_OFF (a build-time switch in the sim, 0 in the release) is not ported: every law here is on.
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
  const { ckey, unckey: unck, ownedLinks } = topo;

  Seat.unit('mesh_gaps3.inc', {
    // L39.1: a yield I cannot count is still a question: the yield of a seat my view names in my rook, over a link of its
    // own, puts L25's question to the rival it names.
    // C++: mesh_gaps3.inc:Seat::l391Ask
    l391Ask(m, by) {
      const TICK = this.TICK;
      if (this.moving || !this.hasCoord || this.state !== 3 || ckey(this.coord) !== m.ck || TICK - this.seatedAt < K.L11_ARRIVE) return false;   // an arrival's ask is L25's own (onYield)
      if (m.nc < 0 || m.nc === this.id || m.nc === by || !this.linkIs(m, by)) return false;
      if (TICK - this.l25At <= K.L25_WAIT && this.l25Nc >= 0) return false;   // one question at a time
      let rook = false; const ol = ownedLinks(this.coord); const n = ol.length; for (let k = 0; k < n && !rook; k++) if (this.occGet(ckey(ol[k])) === by) rook = true;
      if (!rook) return false;
      this.trace('L39.1-ASK', this.id, this.coord, 'by=%d rival=%d', by, m.nc);
      this.l25Ask(m, by); return true;
    },

    // L39.4: a word I gave a healer holds the cell from my densify.
    // C++: mesh_gaps3.inc:Seat::l394Granted
    l394Granted(cell) {
      const w = this.l13WordTo.get(ckey(cell)); if (w === undefined || w[0] < 0 || w[0] === this.id || this.TICK - w[1] >= 16) return false;
      this.trace('L39.4-HELD', this.id, cell, 'word=%d at=%d', w[0], w[1]);
      return true;
    },

    // C++: mesh_gaps3.inc:Seat::l394Placing
    l394Placing(k, to) {
      if (!this.softSitting(k)) return false; const it = this.sitting.get(k); if (it.joiner === to) return false;
      this.trace('L39.4-PLACING', this.id, null, 'cell=%s joiner=%d to=%d', FREE.coordStr(unck(k)), it.joiner, to);
      return true;
    },

    // C++: mesh_gaps3.inc:Seat::l394Held
    l394Held(ak) { const hh = this.l13HeldAt.get(ak); return hh !== undefined && this.TICK - hh <= (unck(ak).pc === 0 ? 64 : 32); },
  });
  GifOS.meshGaps3 = Object.freeze({});
  if (isNode) module.exports = GifOS.meshGaps3;
})(typeof window !== 'undefined' ? window : globalThis);
