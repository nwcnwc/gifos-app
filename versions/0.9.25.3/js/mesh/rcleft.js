/*
 * rcleft.js: L2.11 the head's vouch, L7.10 and L7.11 re-asks (C++: mesh_rcleft.inc). Methods only, added to the Seat; callees other units define are called by name on the Seat.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const K = C_.consts;
  const { ckey, down } = topo;
  const newMsg = (t) => msg.newMsg(t);

  // C++: mesh_rcleft.inc:l711Hop
  // (a free function of the C++: the FIND's delay to the head and the beat's back, plus the tick it is read in)
  function l711Hop(lv) { return 2 * Math.max(2, lv.NET_LAT) + 1; }

  Seat.unit('mesh_rcleft.inc', {
    // C++: mesh_rcleft.inc:Seat::l211Withdrawn
    l211Withdrawn() { return this.l211OffAt > this.ownVouchAt; },

    // C++: mesh_rcleft.inc:Seat::l211Ack
    l211Ack(m) { if (m.e1dn) this.l211Src = m.id; else if (m.id === this.l211Src) this.l211OffAt = this.TICK; },

    // C++: mesh_rcleft.inc:Seat::l211Stamp
    l211Stamp(m) {
      if (m.vAt < 0) return this.TICK;
      return Math.max(this.ownVouchAt, Math.min(this.TICK, m.vAt));
    },

    // C++: mesh_rcleft.inc:Seat::l710Dial
    l710Dial(c, nc) {
      if (nc < 0 || nc === this.id || !this.hasCoord || c.i !== 0 || ckey(down(this.coord)) !== ckey(c)) return;
      this.f.fabricDial(this.id, nc);
    },

    // C++: mesh_rcleft.inc:Seat::l711Reask
    l711Reask(why) {
      if (this.state !== 2 || this.hasCoord || this.l711AskDone === this.askTick) return;
      if (this.TICK - this.l711Win >= K.L711_WIN) { this.l711Win = this.TICK; this.l711N = 0; }
      if (this.l711N >= K.L711_MAX) return;
      this.l711N++; this.l711AskDone = this.askTick; this.trace('L7.11-REASK', this.id, null, 'why=%s asked=%d at=%d', why, this.lastAsked, this.askTick);
      this.retryAt = this.TICK - 1000; if (this.findAckAt < 0) this.findAckAt = this.TICK; this.f.wake(this.id);
    },

    // C++: mesh_rcleft.inc:Seat::l711Handed
    l711Handed(rk, x, mm) {
      if (mm.nc < 0 || x < 0 || !this.hasCoord || rk !== ckey(down(this.coord))) return;
      if (this.l711Head !== x) { this.l711Head = x; this.l711Sent = 0; this.l711Pend.length = 0; }
      this.l711Sent++; if (this.l711Pend.length >= K.L711_PEND) this.l711Pend.shift();
      this.l711Pend.push({ nc: mm.nc, at: this.TICK, idx: this.l711Sent, gwc: mm.gwc });
    },

    // C++: mesh_rcleft.inc:Seat::l711Took
    l711Took(m) {
      if (m.from < 0) return; const o = this.ownerCoord(); if (!o || this.coord.i !== 0 || this.occGet(ckey(o)) !== m.from) return;
      if (this.l711Own !== m.from) { this.l711Own = m.from; this.l711Cnt = 0; } this.l711Cnt++;
    },

    // C++: mesh_rcleft.inc:Seat::l711Beat
    l711Beat(m, tid) { if (tid >= 0 && tid === this.l711Own) { m.fOwn = this.l711Own; m.fCnt = this.l711Cnt; } },

    // C++: mesh_rcleft.inc:Seat::l711Phone
    l711Phone(m) {
      if (this.l711Pend.length === 0 || m.id !== this.l711Head || !this.hasCoord || ckey(m.coord) !== ckey(down(this.coord))) return;
      const seen = (m.fOwn === this.id) ? m.fCnt : 0;
      for (let q = 0; q < this.l711Pend.length;) {
        const p = this.l711Pend[q];
        if (p.idx <= seen || this.TICK - p.at > K.L711_WIN) { this.l711Pend.splice(q, 1); continue; }
        if (this.TICK - p.at > l711Hop(this.w.lv)) { this.trace('L7.11-LOST', this.id, this.coord, 'nc=%d head=%d at=%d', p.nc, this.l711Head, p.at); const n = newMsg('NOROOM'); n.tag = Seat.L711_TAG; n.gwc = p.gwc; n.id = this.id; n.nd = 0; this.emit(p.nc, n); this.l711Pend.splice(q, 1); continue; }
        q++;
      }
    },
  });
  GifOS.meshRcleft = Object.freeze({});
  if (isNode) module.exports = GifOS.meshRcleft;
})(typeof window !== 'undefined' ? window : globalThis);
