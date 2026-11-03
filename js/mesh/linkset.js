/*
 * linkset.js: the link set: link roles, link peers, the keep list (the page contract) (C++: mesh_linkset.inc). Methods only, added to the Seat; callees other units define are called by name on the Seat.
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
  const { ckey, ownedLinks } = topo;

  Seat.unit('mesh_linkset.inc', {
    // C++: mesh_linkset.inc:Seat::linkRole
    linkRole(x, want) {
      if ((want & Seat.LR_OWNED) && this.hasCoord) { const ol = ownedLinks(this.coord), n = ol.length; for (let k = 0; k < n; k++) if (this.occGet(ckey(ol[k])) === x) return true; }
      if ((want & Seat.LR_E2) && this.l2Peer(x)) return true;
      if ((want & Seat.LR_L4) && this.l4Peer(x)) return true;
      if ((want & Seat.LR_UP) && this.l14Up >= 0 && this.l14Up === x) return true;
      if ((want & Seat.LR_OWNER) && this.hasCoord) { const o = this.ownerCoord(); if (o && this.occGet(ckey(o)) === x) return true; }
      return false;
    },

    // C++: mesh_linkset.inc:Seat::linkPeers
    // Fills the array it is handed (out), as the C++ does.
    linkPeers(out, want = 15) {   // want = LR_TOPO
      out.length = 0;
      const add = (x) => { if (x >= 0 && x !== this.id) out.push(x); };
      if ((want & Seat.LR_OWNED) && this.hasCoord) { const ol = ownedLinks(this.coord), n = ol.length; for (let k = 0; k < n; k++) add(this.occGet(ckey(ol[k]))); }
      if ((want & Seat.LR_E2) && this.hasCoord) { add(this.u2Id); add(this.u3Id); for (const e of this.u2Rows.values()) if (this.TICK - e.at <= 40) add(e.heir); }
      if ((want & Seat.LR_L4) && this.l4MarkUntil >= this.TICK) for (const x of this.l4Old) add(x);
      if ((want & Seat.LR_UP) && this.l14Up >= 0) add(this.l14Up);
      if ((want & Seat.LR_OWNER) && this.hasCoord) { const o = this.ownerCoord(); if (o) add(this.occGet(ckey(o))); }
      out.sort((a, b) => a - b);   // stable_sort, then unique
      let w = 0; for (let i = 0; i < out.length; i++) if (i === 0 || out[i] !== out[i - 1]) out[w++] = out[i];
      out.length = w;
    },

    // C++: mesh_linkset.inc:Seat::keepHeld
    keepHeld(x) {
      for (const k of this.keeps) if (k.peer === x && this.TICK < k.until) return true;
      return false;
    },

    // C++: mesh_linkset.inc:Seat::keepAdd
    // Returns {gone, dropped}: the C++ returns gone and fills the bool out-parameter `dropped`.
    keepAdd(peer, ticks) {
      let dropped = false;
      { const kept = this.keeps.filter((k) => !(this.TICK >= k.until)); this.keeps.length = 0; for (const k of kept) this.keeps.push(k); }
      for (const k of this.keeps) if (k.peer === peer) { k.until = this.TICK + ticks; return { gone: -1, dropped }; }
      let gone = -1;
      if (this.keeps.length >= K.KEEP_MAX) { let o = 0; for (let q = 1; q < this.keeps.length; q++) if (this.keeps[q].since < this.keeps[o].since) o = q; gone = this.keeps[o].peer; dropped = true; this.keeps.splice(o, 1); }
      this.keeps.push({ peer, since: this.TICK, until: this.TICK + ticks });
      return { gone, dropped };
    },
  });
  GifOS.meshLinkset = Object.freeze({});
  if (isNode) module.exports = GifOS.meshLinkset;
})(typeof window !== 'undefined' ? window : globalThis);
