/*
 * hostile-laws.js: L24 receive pacing and L26 frame checks (C++: mesh_seat.inc, l24Take and l26Check). Methods
 * only, added to the Seat. gate() is a thread-pool fence in the C++ and is nothing here; L24_DROP and
 * HM_BIG_TAKEN are counters of the shared world (w.lv).
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const topo = req('./topo.js', 'meshTopo');
  const books = req('./books.js', 'meshBooks');
  const { ins } = req('./util.js', 'meshUtil');
  const K = C_.consts;
  const { ckey } = topo;

  Seat.unit('mesh_seat.inc l24/l26', {
    // C++: mesh_seat.inc:Seat::l24Take
    l24Take(m) {
      const lv = this.w.lv;
      if (m.from < 0 || m.from === this.id) return true;
      switch (m.t) { case 'WHOHOME': case 'FIND': case 'FINDLEAF': case 'RECLAIM': case 'WALK': case 'MEET': case 'OFFER': case 'SITPING': case 'SWAPQ': break; default: return true; }
      if (m.t === 'FIND' && !m.fsig) { lv.L24_DROP++; return false; }
      if (m.t === 'FIND' && m.tag === 0 && m.from === m.nc && this.hasCoord && this.state === 3) { for (const [ek, ev] of this.occ) if (ev === m.nc && this.firstHandLive(ek) && ek !== ckey(this.coord)) { lv.L24_DROP++; return false; } }
      { const w = ins(this.l23Work, m.from, () => [0, 0]); if (this.TICK - w[1] > 40) { w[0] = 0; w[1] = this.TICK; } w[0]++; if (this.l23Work.size > 128) this.l23Work.clear(); }
      let okey = m.t === 'FIND' ? m.nc : m.from; if (m.t === 'WHOHOME' && m.via >= 0) okey = -2 - m.via;
      const b = ins(this.l24B, okey, () => new books.Bucket(true));
      if (this.l24B.size > 256) { this.l24B.clear(); return true; }
      if (b.at === 0 && b.tok === 0) { b.tok = K.L24_BURST; b.at = this.TICK; } else b.refill(this.TICK, K.L24_BURST, K.L24_RATE, 1);
      if (b.tok <= 0) { lv.L24_DROP++; return false; }
      if (this.l24AllAt !== this.TICK) { this.l24AllAt = this.TICK; this.l24All = 0; } if (++this.l24All > K.L24_ALL) { lv.L24_DROP++; return false; }
      b.tok--; return true;
    },

    // C++: mesh_seat.inc:Seat::l26Check
    l26Check(m) {
      if (m.from < 0 || m.from === this.id) return true;
      if (m.byes.length > K.L26_LIST || m.nbrs.length > K.L26_LIST || m.list.length > K.L26_LIST || m.roster.length > K.L26_LIST || m.row.length > K.L26_LIST) return false;
      switch (m.t) {
        case 'HELLO': case 'CLAIM': case 'PHONE': case 'PONG': case 'TAKEN': return m.id < 0 || m.sig;
        case 'HANDOFF': { if (m.from === this.gateway || m.from === this.lastAsked) return true; for (const x of this.l16Ask) if (x === m.from) return true; return false; }
        case 'BUSY': return m.from === m.id;
        case 'PLACED': return m.l31 === 6 || m.sig;
        case 'WALK': return m.asker === m.id && m.sig;
        case 'TRANSLOST': case 'GREETERS': case 'KNOCK': case 'LGSTARVE': return false;
        case 'FINDLEAF': {
          if (!this.hasCoord || this.state !== 3) return true;
          let named = false;
          for (const v of this.occ.values()) if (v === m.from) { named = true; break; }
          if (!named && this.callBook.dialled(m.from)) named = true;
          if (!named) for (const w of this.l13Wit) if (w === m.from) named = true;
          if (!named) for (const v of this.cousins.values()) if (v === m.from) { named = true; break; }
          if (!named) for (const v of this.childOf.values()) if (v === m.from) { named = true; break; }
          if (!named && this.callBook.inKnown(m.from) && !this.l372Fresh(m)) named = true;
          if (!named) return false;
          if (!this.cellOk(ckey(m.hole))) return false;
          const hk = ckey(m.hole); const x = this.occGet(hk); if (x >= 0 && x !== this.id && x !== m.from && this.firstHandLive(hk)) return false;
          return true;
        }
        default: return true;
      }
    },
  });
  GifOS.meshHostileLaws = Object.freeze({});
  if (isNode) module.exports = GifOS.meshHostileLaws;
})(typeof window !== 'undefined' ? window : globalThis);
