/*
 * roomterm.js: the room term: what a seat observes (L8.46) and entry on first-hand silence (L8.47) (C++: mesh_roomterm.inc). Methods only, added to the Seat; callees other units define are called by name on the Seat.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const topo = req('./topo.js', 'meshTopo');
  const K = C_.consts, E = C_.enums;
  // the sim's -DL8_47_1_OFF=1 build: MESH_L8_47_1_OFF=1 under node, read once at load; a page always runs the law
  const L8_47_1_OFF = (isNode && typeof process !== 'undefined' && process.env && process.env.MESH_L8_47_1_OFF === '1') ? 1 : 0;
  const { ckey, ownedLinks } = topo;
  const LS_NONE = E.LS_NONE;

  // (C++: mesh_roomterm.inc:roomTerm is in seat.js, with the other free functions the Seat's inline members call.)
  Seat.unit('mesh_roomterm.inc', {
    // C++: mesh_roomterm.inc:Seat::islandSeen
    islandSeen() { return this.islandFounder || this.lineFork || this.cutAt >= 0 || this.cutHeardAt >= 0 || this.mergeCalc(); },

    // C++: mesh_roomterm.inc:Seat::cutNote
    cutNote() {
      if (!this.w.lv.LINKMODEL || this.cutAt >= 0) return;
      if (!this.hasCoord || this.state !== 3) { if (this.cutNone.size) this.cutNone.clear(); return; }
      const ol = ownedLinks(this.coord), n = ol.length; const cur = new Map();
      for (let q = 0; q < n; q++) {
        const k = ckey(ol[q]); const x = this.occGet(k); if (x < 0 || x === this.id) continue;
        if (this.f.fabricLinkState(this.id, x) !== LS_NONE || this.f.fabricDialFails(this.id, x) <= 0 || (this.live.has(k) && this.TICK - this.live.get(k) <= K.NOTMINE_WAIT)) continue;
        if (this.f.fhopFriendFor(this.id, x)) continue;
        const it = this.cutNone.get(x); const since = it === undefined ? this.TICK : it; cur.set(x, since);
      }
      let gone = 0, first = -1, firstSince = -1;
      for (const [ek, ev] of cur) if (this.TICK - ev >= K.NOTMINE_WAIT) { gone++; if (first < 0 || ek < first) { first = ek; firstSince = ev; } }
      if (gone >= 2) { this.cutAt = this.TICK; this.trace('L8.46-CUT', this.id, this.coord, 'peer=%d gone=%d since=%d', first, gone, firstSince); }
      this.cutNone = cur;
    },

    // L8.47.1 A BLOCKED SEEKER'S ENTRY: a joiner whose own measured network verdict is blocked is in the ask-all from its
    // first list, asks the whole list in one wave, waits ISLAND_WAIT_BLOCKED (one answered dial's verdict) and is not asked
    // a second silent round; the confirm knock stands.
    // C++: mesh_roomterm.inc:Seat::l8471
    l8471() { return !L8_47_1_OFF && !!this.w.lv.ISLAND_MODE && this.nat === E.NAT_BLOCKED; },

    // C++: mesh_roomterm.inc:Seat::islandWait
    islandWait() { return this.l8471() ? K.ISLAND_WAIT_BLOCKED : K.ISLAND_WAIT; },

    // C++: mesh_roomterm.inc:Seat::entryTerm
    entryTerm() { return this.entIsl || this.l8471(); },

    // C++: mesh_roomterm.inc:Seat::entNote
    entNote(g) { if (g < 0 || g === this.id || this.entAsk.has(g)) return; if (this.entAsk.size > 32) this.entAsk.clear(); this.entAsk.set(g, this.TICK); },

    // C++: mesh_roomterm.inc:Seat::entCheck
    entCheck() {
      if (this.entIsl || this.l8471() || !(this.state === 0 || this.state === 1) || this.lastGreeters.length === 0 || this.greetersAt < 0 || this.TICK - this.greetersAt > K.RELAY_TTL) return false;
      let n = 0, first = -1;
      for (const g of this.lastGreeters) { const it = this.entAsk.get(g); if (it === undefined || this.TICK - it < K.ISLAND_WAIT || this.entAnsAt >= it) continue; n++; if (first < 0 || it < first) first = it; }
      if (n < 2) {
        if (n !== 1 || this.lastGreeters.length !== 1) return false;
        const it = this.entAsk.get(this.lastGreeters[0]); if (it === undefined || this.greetersAt < it + K.ISLAND_WAIT) return false;
      }
      this.entIsl = true; this.trace('L8.47-ENTRY', this.id, null, 'silent=%d since=%d', n, first); return true;
    },
  });
  GifOS.meshRoomterm = Object.freeze({});
  if (isNode) module.exports = GifOS.meshRoomterm;
})(typeof window !== 'undefined' ? window : globalThis);
