/*
 * rcleft-l25.js: L25.12 to L25.14: the kept seat's tell, the rival's order, the drop (C++: mesh_rcleft_l25.inc). Methods only, added to the Seat; callees other units define are called by name on the Seat.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat, roomTerm } = req('./seat.js', 'meshSeat');
  const { coordStr, cellOk } = req('./shared.js', 'meshShared');
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const K = C_.consts;
  const { ckey, unckey, ownedLinks } = topo;
  const newMsg = (t) => msg.newMsg(t);

  Seat.unit('mesh_rcleft_l25.inc', {
    // C++: mesh_rcleft_l25.inc:Seat::l2512Tell
    l2512Tell(rival) {
      if (!this.w.lv.LINKMODEL || rival < 0 || rival === this.id || !this.hasCoord || this.state !== 3 || this.TICK - this.l2512TellAt <= K.L25_WAIT) return;
      this.l2512TellAt = this.TICK;
      const c = newMsg('CHALLENGE'); c.ck = ckey(this.coord); c.from = this.id; c.tag = 27; this.f.fabricCallFrame(this.id, rival, c);
      this.trace('L25.12-TELL', this.id, this.coord, 'rival=%d', rival);
    },

    // C++: mesh_rcleft_l25.inc:Seat::l2512Heard
    l2512Heard(m) {
      const t = m.from;
      if (!this.w.lv.LINKMODEL || !this.hasCoord || this.state !== 3 || this.moving || ckey(this.coord) !== m.ck || t < 0 || t === this.id || !this.linkIs(m, t)) return false;
      if ((this.TICK - this.l25At <= K.L25_WAIT && this.l25Nc >= 0) || this.l25WitPend) return false;
      const q = newMsg('CHALLENGE'); q.nc = t; q.ck = m.ck; this.l25Ask(q, t); this.l2512Q = t;
      this.trace('L25.12-ASK', this.id, this.coord, 'kept=%d', t);
      return true;
    },

    // C++: mesh_rcleft_l25.inc:Seat::l2512Rook
    l2512Rook(x) {
      if (this.l2512Q < 0 || this.l2512Q !== x) return false;
      this.l2512Q = -1; this.l2512Rev = true; const d = this.l2512Decide(false);
      if (d === 0) { this.l25WitPend = true; this.f.wake(this.id); return true; }
      this.l2512Rev = false; if (d === 1) this.requeue('L25.12-yield');
      return true;
    },

    // C++: mesh_rcleft_l25.inc:Seat::l2512Decide
    l2512Decide(deadline) {
      if (this.l25WitAsk.length && !deadline && this.TICK - this.l25WitAt < K.L25_WIT_WAIT) return 0;
      if (this.l25WitRival > this.l25WitMe && 2 * this.l25WitRival > this.l25WitAskedN && this.l25WitRival + 1 >= K.L25_WIT_MIN) { this.trace('L25.12-OUTVOTED', this.id, this.coord, 'kept=%d me=%d asked=%d', this.l25WitRival, this.l25WitMe, this.l25WitAskedN); return 1; }
      this.trace('L25.12-STAY', this.id, this.coord, 'kept=%d me=%d asked=%d', this.l25WitRival, this.l25WitMe, this.l25WitAskedN); return 2;
    },

    // C++: mesh_rcleft_l25.inc:Seat::l2512TellHeard
    l2512TellHeard(rival) {
      if (rival < 0 || rival !== this.l25WitRivalId) return;
      if (this.l25WitRival > 0) { this.l2512Pend = -1; this.l2512Tell(rival); return; }
      this.l2512Pend = (this.l25WitAsk.length && this.TICK - this.l25WitAt < K.L25_WIT_WAIT) ? rival : -1;
    },

    // C++: mesh_rcleft_l25.inc:Seat::l2512Witness
    l2512Witness() {
      if (this.l2512Pend < 0) return;
      if (this.l2512Pend !== this.l25WitRivalId || this.TICK - this.l25WitAt > K.L25_WIT_WAIT) { this.l2512Pend = -1; return; }
      if (this.l25WitRival > 0) { const r = this.l2512Pend; this.l2512Pend = -1; this.l2512Tell(r); }
    },

    // C++: mesh_rcleft_l25.inc:Seat::l2513Asked
    l2513Asked(m) {
      if (this.w.lv.LINKMODEL || m.asker < 0 || m.asker === this.id) return;
      this.l2513AskedBy = m.asker; this.l2513AskedAt = this.TICK; this.l2513AskedCk = m.ck;
    },

    // C++: mesh_rcleft_l25.inc:Seat::l2513Order
    l2513Order(m) {
      const LINKMODEL = this.w.lv.LINKMODEL;
      if (roomTerm(this, -1) || this.l25Stand(m.id, false)) return false;
      if (LINKMODEL && this.l2512Q !== m.id && this.l2513Later(m)) {
        this.l2513Rev = true; this.l2512Rev = false; const d = this.l2513Decide(false);
        if (d === 0) { this.l25WitPend = true; this.f.wake(this.id); return true; }
        this.l2513Rev = false; if (d === 1) { this.requeue('L25.13-yield'); return true; }
        return false;
      }
      if (LINKMODEL) {
        if (this.l2512Q === m.id || m.pp < 0 || m.ppAt < 0 || m.pp === m.id || !this.ppAdm(m.ck, m.pp, m.id) || this.pp < 0 || this.ppCk !== ckey(this.coord)) return false;
        const first = m.ppL >= 0 && (this.ppL < m.ppL || (this.ppL === m.ppL && (this.pp < m.pp || (this.pp === m.pp && this.id < m.id))));
        if (!first) return false;
        this.trace('L25.13-TELL', this.id, this.coord, 'rival=%d mine=%d/%d theirs=%d/%d', m.id, this.ppAt, this.pp, m.ppAt, m.pp);
        this.l2512Tell(m.id); return true;
      }
      if (this.l2513AskedBy !== m.id || this.l2513AskedCk !== m.ck || this.TICK - this.l2513AskedAt > K.L25_ORD_AGE) return false;
      let rt, rp;
      if (m.pp >= 0 && m.ppAt >= 0 && m.ppL >= 0) { rt = m.ppL; rp = m.pp; } else if (m.mpK > 0 && m.mpAt >= 0 && m.mpL >= 0) { rt = m.mpL; rp = m.mpBy; } else return false;
      let mt, mp;
      if (this.pp >= 0 && this.ppCk === ckey(this.coord)) { mt = this.ppL; mp = this.pp; } else if (this.mpK > 0 && this.mpCk === ckey(this.coord)) { mt = this.mpL; mp = this.mpBy; } else { mt = this.seatedAt; mp = this.id; }
      const first = mt < rt || (mt === rt && (mp < rp || (mp === rp && this.id < m.id)));
      this.trace('L25.13-ORDER', this.id, this.coord, 'rival=%d mine=%lld/%d theirs=%lld/%d %s', m.id, mt, mp, rt, rp, first ? 'first' : 'later');
      if (first) return false;
      if ((this.l25WitAsk.length || this.l25WitMe > 0 || this.l25WitRival > 0)) { const d = this.l25WitDecide(false); if (d === 0) { this.l25WitPend = true; this.f.wake(this.id); return true; } if (d === 2) return true; }
      this.requeue('L25.13-yield'); return true;
    },

    // C++: mesh_rcleft_l25.inc:Seat::l2514Drop
    l2514Drop(m) {
      if (m.from < 0 || m.from === this.id || !this.hasCoord || this.state !== 3 || !cellOk(ckey(m.hole))) return false;
      const hk = ckey(m.hole); const o = m.fo >= 0 ? m.fo : m.from;
      const x = this.occGet(hk);
      if (x >= 0 && x !== this.id && x !== o && x !== m.from && this.l167HolderHeard(m.hole)) { this.trace('L25.14-HELD', this.id, m.hole, 'from=%d fo=%d holder=%d', m.from, m.fo, x); return true; }
      if (o < 0 || o === this.id) return false;
      let ok = 0, placed = false; for (const [ek, ev] of this.occ) if (ev === o && cellOk(ek)) { ok = ek; placed = true; break; }
      if (!placed || ok === hk) return false;
      const oc = unckey(ok); if (oc.pc === m.hole.pc && oc.r === m.hole.r) return false;
      const ol = ownedLinks(m.hole), n = ol.length; for (let k = 0; k < n; k++) if (ckey(ol[k]) === ok) return false;
      this.trace('L25.14-AWAY', this.id, m.hole, 'from=%d fo=%d at=%s', m.from, m.fo, coordStr(oc)); return true;
    },

    // C++: mesh_rcleft_l25.inc:Seat::l2513Later
    l2513Later(m) {
      let rt, rp;
      if (m.pp >= 0 && m.ppAt >= 0 && m.ppL >= 0) { rt = m.ppL; rp = m.pp; } else if (m.mpK > 0 && m.mpAt >= 0 && m.mpL >= 0) { rt = m.mpL; rp = m.mpBy; } else return false;
      let mt, mp;
      if (this.pp >= 0 && this.ppCk === ckey(this.coord)) { mt = this.ppL; mp = this.pp; } else if (this.mpK > 0 && this.mpCk === ckey(this.coord)) { mt = this.mpL; mp = this.mpBy; } else { mt = this.seatedAt; mp = this.id; }
      return rt < mt || (rt === mt && (rp < mp || (rp === mp && m.id < this.id)));
    },

    // C++: mesh_rcleft_l25.inc:Seat::l2513Decide
    l2513Decide(deadline) {
      if (this.l25WitAsk.length && !deadline && this.TICK - this.l25WitAt < K.L25_WIT_WAIT) return 0;
      if (this.l25WitRival > this.l25WitMe && 2 * this.l25WitRival > this.l25WitAskedN) { this.trace('L25.13-GO', this.id, this.coord, 'rival=%d me=%d asked=%d', this.l25WitRival, this.l25WitMe, this.l25WitAskedN); return 1; }
      this.trace('L25.13-STAY', this.id, this.coord, 'rival=%d me=%d asked=%d', this.l25WitRival, this.l25WitMe, this.l25WitAskedN); return 2;
    },
  });
  GifOS.meshRcleftL25 = Object.freeze({});
  if (isNode) module.exports = GifOS.meshRcleftL25;
})(typeof window !== 'undefined' ? window : globalThis);
