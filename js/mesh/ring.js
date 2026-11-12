/*
 * ring.js: the ring signal: lineage, merge, the island stand-down switch (C++: mesh_ring.inc).
 * Methods only on the Seat; the two free functions (islandStandM, c7Goodbye) are registered with Seat.free.
 * Two notes for the harness: islandStandM has no seat to read the world from, so it takes the calling seat's world
 * levers (ISLAND_MODE, NETGRP) as its third argument, as the C++ reads its globals; and `fabric::NETG.size()` (the number of
 * net groups, mesh_net.inc) comes from hooks.netgSize, which the net harness unit sets.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const K = C_.consts, E = C_.enums;

  const hooks = { netgSize: () => 0 };
  // the sim's #define L8_52_OFF / L8_46_4_OFF in mesh.cpp (build-time switches): MESH_<name>=1 under node, read once at load; a page always runs the law
  const envOn = (n) => (isNode && typeof process !== 'undefined' && process.env && process.env[n] === '1') ? 1 : 0;
  const L8_52_OFF = envOn('MESH_L8_52_OFF'), L8_46_4_OFF = envOn('MESH_L8_46_4_OFF'), L8_46_5_OFF = envOn('MESH_L8_46_5_OFF');

  // C++: mesh.cpp:leverRoom
  function leverRoom(LV, v) { return v < 0 ? LV.ISLAND_MODE !== 0 : LV.ISLAND_MODE === v; }

  // C++: mesh_ring.inc:islandStandM
  function islandStandM(merge, law, LV) {   // LV: the calling seat's world levers (C++ reads its globals)
    switch (law) {
      case E.IS_L13: return merge;
      case E.IS_L164: return merge;
      case E.IS_RELAY: return LV.NETGRP;
      case E.IS_WALK: return merge;
      case E.IS_L18: return merge;
      case E.IS_L25: return leverRoom(LV, -1);
      case E.IS_L22: case E.IS_L223: return leverRoom(LV, -1) && hooks.netgSize() > 1;
      case E.IS_L31: return false;
    }
    return false;
  }
  // C++: mesh_ring.inc:c7Goodbye
  function c7Goodbye(m) { return m.t === 'LEAVE' && (m.c7 || (m.c7Min >= 0)); }
  Seat.free({ islandStandM, c7Goodbye });

  Seat.unit('mesh_ring.inc', {
    // C++: mesh_ring.inc:Seat::mergeSeen
    mergeSeen() {
      if (this.line < 0) return false;
      if (this.mergeTick === this.TICK) return this.mergeV;
      this.mergeV = this.mergeCalc(); this.mergeTick = this.TICK; return this.mergeV;
    },

    // C++: mesh_ring.inc:Seat::mergeCalc
    mergeCalc() {
      if (this.line < 0) return false;
      if (this.TICK - this.lineC7At <= K.RELAY_TTL) return true;
      if ((!L8_46_4_OFF || !L8_46_5_OFF) && this.TICK - this.lineStrAt <= K.RELAY_TTL) return true;   // L8.46.4: the door and a stranger's own stamp (lineNote)
      { let n = 0; for (const t of this.lineC7.values()) if (this.TICK - t <= K.RELAY_TTL && ++n >= 2) return true; }
      let a = -1, an = 0, b = -1, bn = 0;
      for (const e of this.lineSeen.values()) {
        const l = e[0]; if (l === this.line || this.TICK - e[1] > K.RELAY_TTL) continue;
        if (a < 0 || a === l) { a = l; if (++an >= 2) return true; } else if (b < 0 || b === l) { b = l; if (++bn >= 2) return true; }
      }
      return false;
    },

    // C++: mesh_ring.inc:Seat::lineAdopt
    // L8.52 THE OLDER ROOM STAYS: a lineage carries its founding epoch (`at`), adopted with it
    lineAdopt(l, at, why) {
      if (l < 0 || l === this.line) return;
      this.trace('LINEAGE', this.id, this.hasCoord ? this.coord : null, 'from=%d to=%d why=%s', this.line, l, why); this.line = l; this.mergeTick = -1;
      if (!L8_52_OFF) { this.lineAt = at; }
    },

    // C++: mesh_ring.inc:Seat::ringOlder   (L8.52: is ring an (epoch aAt) older than ring bn (epoch bAt)?)
    ringOlder(an, aAt, bn, bAt) { if (!L8_52_OFF && aAt >= 0 && bAt >= 0 && aAt !== bAt) return aAt < bAt; return an < bn; },

    // C++: mesh_ring.inc:Seat::lineAtOf
    lineAtOf(x) { const it = this.lineAtSeen.get(x); return it === undefined ? -1 : it; },

    // C++: mesh_ring.inc:Seat::lineNote
    lineNote(m) {
      let who = -1, own = false;
      switch (m.t) {
        case 'HELLO': case 'PHONE': case 'PONG': case 'CONFIRM': case 'LEAVE': who = m.id; own = (m.from === m.id) || m.sig; break;
        case 'WALK': who = m.asker; own = (m.asker === m.id && (m.sig || m.from === m.asker)); break;
        default: return;
      }
      if (who < 0 || who === this.id || !own) return;
      if (c7Goodbye(m) && (m.sig || this.linkIs(m, who))) { this.lineC7.set(who, this.TICK); if (this.lineC7.size > 64) this.lineC7.clear(); this.mergeTick = -1; }
      if (m.cutF && this.cutHeardAt < 0 && this.cutAt < 0) {
        this.cutWit.set(who, this.TICK); let n = 0; for (const t of this.cutWit.values()) if (this.TICK - t <= K.RELAY_TTL) n++;
        if (n >= 2) { this.cutHeardAt = this.TICK; this.trace('L8.46-CUTHEARD', this.id, this.hasCoord ? this.coord : null, 'by=%d', who); this.cutWit.clear(); } else if (this.cutWit.size > 64) this.cutWit.clear();
      }
      if (m.line < 0) return;
      this.t1415Note(m);   // TURN.14.15 (mesh_seat.inc)
      this.lineSeen.set(who, [m.line, this.TICK]); this.mergeTick = -1;
      if (!L8_52_OFF) { this.lineAtSeen.set(who, m.lineAt); if (this.lineAtSeen.size > 256) this.lineAtSeen.clear(); }
      // L8.46.4 THE DOOR IS THE SECOND WITNESS: one persistent stranger whose own HELLO stamps a lineage not mine is a merge seen for RELAY_TTL
      if (!L8_46_4_OFF && m.t === 'HELLO' && this.line >= 0 && m.line !== this.line && this.hasCoord && this.state === 3 && this.coord.pc === 0) {
        if (this.lineStranger(who)) {
          const was = this.mergeCalc(); this.lineStrAt = this.TICK; this.mergeTick = -1;
          if (!was) { this.trace('L8.46.4-DOOR', this.id, this.coord, 'stranger=%d line=%d', who, m.line); if (m.c7Min >= 0 && this.l42Own(m)) { this.l828Ring.set(who, [m.c7Min, this.TICK]); if (this.l828Ring.size > 256) this.l828Ring.clear(); } }
        }
      }
      // L8.46.5 A RELAYED LINK IS THE SECOND WITNESS: the seat whose own HELLO over my relayed pc stamps a lineage not mine is a merge seen for RELAY_TTL
      if (!L8_46_5_OFF && m.t === 'HELLO' && this.line >= 0 && m.line !== this.line && m.from === who && this.hasCoord && this.state === 3 && this.coord.pc === 0 && this.f.fabricTurnOn() && this.f.fabricTurnPc(this.id, who)) {
        const was = this.mergeCalc(); this.lineStrAt = this.TICK; this.mergeTick = -1;
        if (!was) { this.trace('L8.46.5-LINK', this.id, this.coord, 'peer=%d line=%d', who, m.line); if (m.c7Min >= 0 && this.l42Own(m)) { this.l828Ring.set(who, [m.c7Min, this.TICK]); if (this.l828Ring.size > 256) this.l828Ring.clear(); } }
      }
      if (this.lineSeen.size > 256) { this.lineSeen.clear(); }
      if (c7Goodbye(m) && this.linkIs(m, who)) this.lineC7At = this.TICK;
      if (this.hasCoord && this.state === 3 && this.line >= 0 && m.line !== this.line && who === this.ownerId() && (m.from === who || this.linkIs(m, who))) {
        let n = 0; for (const x of this.lineSeen.values()) if (x[0] === m.line && this.TICK - x[1] <= K.RELAY_TTL) n++;
        if (n >= 2) this.lineAdopt(m.line, m.lineAt, 'owner');
      }
    },

    // C++: mesh_ring.inc:Seat::lineOf
    lineOf(x) { const it = this.lineSeen.get(x); return it === undefined ? -1 : it[0]; },

    // C++: mesh_ring.inc:Seat::otherRing
    otherRing(x) {
      if (x < 0 || x === this.id) return false;
      { const l = this.lineOf(x); if (l >= 0 && this.line >= 0 && l !== this.line) return true; if (!this.mergeSeen()) return false; }
      if (!this.hasCoord || this.state !== 3) return false;
      const a = this.l828RingOf(x); return a >= 0 && a !== this.ringName();
    },

    // C++: mesh_ring.inc:Seat::lineForeign
    lineForeign() {
      if (this.line < 0) return false;
      if (this.TICK - this.lineC7At <= K.RELAY_TTL) return true;
      for (const t of this.lineC7.values()) if (this.TICK - t <= K.RELAY_TTL) return true;
      for (const e of this.lineSeen.values()) if (e[0] !== this.line && this.TICK - e[1] <= K.RELAY_TTL) return true;
      return false;
    },

    // C++: mesh_ring.inc:Seat::lineStranger
    lineStranger(x) { const ss = this.strangeSeen.get(x), xr = this.xrOk.get(x); return (ss !== undefined && ss >= 2) || (xr !== undefined && this.TICK - xr <= 2 * K.RELAY_TTL); },

    // C++: mesh_ring.inc:Seat::mergeSeenBut
    mergeSeenBut(x) {
      if (this.line < 0) return false;
      if (this.TICK - this.lineC7At <= K.RELAY_TTL) return true;
      { let n = 0; for (const [k, t] of this.lineC7) if (k !== x && this.TICK - t <= K.RELAY_TTL && ++n >= 2) return true; }
      let n = 0;
      for (const [k, e] of this.lineSeen) {
        const l = e[0]; if (k === x || l === this.line || this.TICK - e[1] > K.RELAY_TTL || !this.lineStranger(k)) continue;
        if (++n >= 2) return true;
      }
      return false;
    },

    // C++: mesh_ring.inc:Seat::doorNamed
    doorNamed(x) { if (x < 0 || this.TICK - this.greetersAt > K.RELAY_TTL) return false; for (const g of this.lastGreeters) if (g === x) return true; return false; },

    // C++: mesh_ring.inc:Seat::l25Stand
    l25Stand(claimant, yielding = false) {
      if (claimant < 0 || claimant === this.id) return false;
      if (yielding && this.hasCoord && this.state === 3 && this.TICK - this.seatedAt >= K.L11_ARRIVE && !this.islanded()) return false;
      const l = this.lineOf(claimant); if (l < 0 || this.line < 0 || l === this.line) return false;
      if (this.lineStranger(claimant) && this.mergeSeenBut(claimant)) return true;
      return this.islandFounder && this.line === this.id && this.hasCoord && this.state === 3 && this.doorNamed(claimant);
    },
  });
  const api = Object.freeze({ islandStandM, c7Goodbye, leverRoom, hooks });
  GifOS.meshRing = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
