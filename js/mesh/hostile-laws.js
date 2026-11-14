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
  const { Seat, l25OrdKey } = req('./seat.js', 'meshSeat');
  const { cellOk } = req('./shared.js', 'meshShared');
  const C_ = req('./consts.js', 'meshConsts');
  const topo = req('./topo.js', 'meshTopo');
  const books = req('./books.js', 'meshBooks');
  const { ins } = req('./util.js', 'meshUtil');
  const K = C_.consts;
  const { ckey, unckey: unck, up } = topo;
  const { coordStr } = req('./shared.js', 'meshShared');

  Seat.unit('mesh_seat.inc l24/l26', {
    // C++: mesh_seat.inc:Seat::l24Bucket
    // L24: one bucket a sender (key >= 0: its own asks; key <= -2: the frames it passes on for others). The table holds 256
    // senders; one more evicts the sender whose bucket was touched longest ago.
    l24Bucket(okey) {
      const b = ins(this.l24B, okey, () => new books.Bucket(true));
      if (b.at === 0 && b.tok === 0) { b.tok = K.L24_BURST; b.at = this.TICK; } else b.refill(this.TICK, K.L24_BURST, K.L24_RATE, 1);
      if (this.l24B.size > 256) { let old, oldAt = 0; for (const [k, v] of this.l24B) if (k !== okey && (old === undefined || v.at < oldAt)) { old = k; oldAt = v.at; } this.l24B.delete(old); }
      return b;
    },

    // C++: mesh_seat.inc:Seat::l24Take
    l24Take(m) {
      const lv = this.w.lv;
      if (m.from < 0 || m.from === this.id) return true;
      switch (m.t) { case 'WHOHOME': case 'FIND': case 'FINDLEAF': case 'RECLAIM': case 'WALK': case 'MEET': case 'OFFER': case 'SITPING': case 'SWAPQ': case 'ROUTE': break; default: return true; }
      if (m.t === 'FIND' && !m.fsig) { lv.L24_DROP++; return false; }
      if (m.t === 'FIND' && m.tag === 0 && m.from === m.nc && this.hasCoord && this.state === 3) { for (const [ek, ev] of this.occ) if (ev === m.nc && this.firstHandLive(ek) && ek !== ckey(this.coord)) { lv.L24_DROP++; return false; } }
      { const w = ins(this.l23Work, m.from, () => [0, 0]); if (this.TICK - w[1] > 40) { w[0] = 0; w[1] = this.TICK; } w[0]++; if (this.l23Work.size > 128) this.l23Work.clear(); }
      let okey = m.t === 'FIND' ? m.nc : m.from; if ((m.t === 'WHOHOME' || m.t === 'ROUTE') && m.via >= 0) okey = -2 - m.via;   // L24: a walked ask spends the pass-on bucket of the hop that handed it on
      const b = this.l24Bucket(okey);
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
          // L37.6 (mesh_seat.inc l26Check): being named is not standing; the order's SIGNER (fo, else the sender) must sit, in my view, where an order for this hole comes from
          if (cellOk(ckey(m.hole))) {
            const signer = m.fo >= 0 ? m.fo : m.from; let c = null, ok = false, found = false;
            const standing = () => {
              if (m.hole.pc === 0 ? (c.pc === 0 && (c.r === m.hole.r || (c.i === 0 && m.hole.r === (c.r + 1) % topo.C))) : (c.pc === m.hole.pc && c.r === m.hole.r)) return true;   // L37.6.1: a home hole's row, or the next row for a row head (L9.12's pull)
              let o, oo;
              if (m.hole.pc !== 0) { o = { pc: m.hole.pc, r: m.hole.r }; while (o.pc !== 0 && (oo = up({ pc: o.pc, r: o.r, i: 0 }))) { if (c.pc === oo.pc && c.r === oo.r) return true; o = oo; } }
              o = { pc: c.pc, r: c.r };
              while (o.pc !== 0 && (oo = up({ pc: o.pc, r: o.r, i: 0 }))) { if (ckey(oo) === ckey(m.hole) || (oo.pc === m.hole.pc && oo.r === m.hole.r)) return true; o = oo; }
              return false;
            };
            for (const [k, v] of this.occ) if (v === signer) { found = true; c = unck(k); if (standing()) { ok = true; break; } }   // any listing of the signer may stand: a seat that moved is still listed at its old cell
            if (!found && m.fo >= 0 && this.w.L25ORD.has(l25OrdKey(signer, ckey(m.hole), m.foAt, this.id))) ok = true;   // a signer my view does not place: the order's own signature (L25.7)
            if (!ok) { this.trace('L37.6-NOSTANDING', this.id, this.coord, 'from=%d signer=%d hole=%s signercell=%s', m.from, signer, coordStr(m.hole), found ? coordStr(c) : 'none'); this.w.lv.L376S_DROP++; return false; }
          }
          if (!cellOk(ckey(m.hole))) return false;
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
