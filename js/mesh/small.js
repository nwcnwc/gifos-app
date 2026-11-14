/*
 * small.js: L30 small rooms (C++: mesh_small.inc). Methods only, added to the Seat.
 * The two free helpers (l30DeepWhy, l30Deep) take the Seat and are local to this file.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const seatM = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const topo = req('./topo.js', 'meshTopo');
  const { Seat, l13MergingOf } = seatM;
  const K = C_.consts;
  const { ckey, ownedLinks, down, C } = topo;

  // C++: mesh_small.inc:l30DeepWhy
  function l30DeepWhy(s) {
    if (s.hasChildren()) return 1;
    if (s.occGet(ckey(down(s.coord))) >= 0) return 2;
    if (s.myDig.at >= 0 && s.myDig.n + s.myDig.leased > 1) return 3;
    for (const e of s.s1tab.values()) if (e.at >= 0 && e.n + e.leased > 1) return 4;
    if (s.rootDec.at >= 0 && s.rootDec.n + s.rootDec.leased > C * C) return 5;
    return 0;
  }
  // C++: mesh_small.inc:l30Deep
  function l30Deep(s) { return l30DeepWhy(s) !== 0; }

  Seat.unit('mesh_small.inc', {
    // C++: mesh_small.inc:Seat::l30Tick
    l30Tick() {
      const inn = this.hasCoord && this.state === 3 && this.coord.pc === 0 && !this.dead && !l13MergingOf(this) && !(this.forkAt >= 0);
      const deep = inn && l30Deep(this);
      if (!inn || deep) { this.l30Since = -1; if (this.l30) { this.l30 = false; this.l30At = this.TICK; this.l30Flips++; } if (deep) this.l30Deep_ = this.TICK; return; }
      if (this.l30Since < 0) this.l30Since = this.TICK;
      if (this.l30) { this.l30Silence(); return; }
      const from = Math.max(this.l30Since, this.seatedAt);
      if (this.TICK - from < K.L30_ENTER) return;
      if (this.l30Deep_ >= 0 && this.TICK - this.l30Deep_ < K.L30_QUIET) return;
      this.l30 = true; this.l30At = this.TICK; this.l30Flips++;
    },

    // C++: mesh_small.inc:Seat::l30Silence
    l30Silence() {
      if (!this.hasCoord || this.state !== 3 || this.moving) return;
      const ol = ownedLinks(this.coord), n = ol.length; let heard = 0; const qx = [];
      let floor_ = Math.max(this.seatedAt, this.l30At); if (this.backAt >= 0 && this.backAt > floor_) floor_ = this.backAt; if (this.nlAt > floor_) floor_ = this.nlAt;
      for (let q = 0; q < n; q++) {
        if (ol[q].pc !== 0) continue; const k = ckey(ol[q]); const x = this.occGet(k); if (x < 0 || x === this.id) continue;
        const lv = this.live.get(k); if (lv === undefined) continue;
        let since = Math.max(lv, floor_); { const da = this.d5Ans.get(k); if (da !== undefined && da > since) since = da; }   // D5.1: an answered silence probe is a path it was heard on
        if (this.TICK - lv <= K.L30_FRESH) heard++;
        if (this.TICK - since > K.L30_SILENT && !this.translost.has(k)) qx.push(x);
      }
      if (heard < 1) { this.nlAt = this.TICK; return; }   // D5.4, the fast detector's own reading
      for (let i = 0; i < qx.length; i++) { this.l30SilN++; this.transportLost(qx[i], true, true); }
    },

    // C++: mesh_small.inc:Seat::noLink
    // D5.4: a seat that no link carries judges nobody. None of MY pcs is open and not half-open.
    noLink() {
      if (!this.w.lv.LINKMODEL || !this.hasCoord || this.state !== 3) return false;
      for (const p of this.f.fabricOpenPeers(this.id)) if (this.f.fabricLinkCarries(this.id, p)) return false;
      return true;
    },

    // C++: mesh_small.inc:Seat::noLinkTick
    // While the spell lasts no loss is confirmed; when the first link carries again every loss observed in the spell, or in
    // the beat before it began, is asked again from that tick, over the link that carries.
    noLinkTick() {
      const TICK = this.TICK;
      if (this.noLink()) { if (this.nlSince < 0) this.nlSince = TICK | 0; this.nlAt = TICK | 0; return; }
      if (this.nlSince < 0) return;
      let n = 0; const ks = []; for (const [k, at] of this.translost) if (at >= this.nlSince - K.L30_FRESH) ks.push(k);
      for (const k of ks) { this.tlSent.delete(k); this.tlProbeAt.delete(k); n++; }   // asked again: the window starts with the next probe that leaves over a link that carries
      if (n) this.trace('D5.4-HEARS', this.id, this.hasCoord ? this.coord : null, 'spell=%lld asked=%d', TICK - this.nlSince, n); this.nlSince = -1;
    },
  });
  GifOS.meshSmall = Object.freeze({});
  if (isNode) module.exports = GifOS.meshSmall;
})(typeof window !== 'undefined' ? window : globalThis);
