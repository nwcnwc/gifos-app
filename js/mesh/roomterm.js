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
  // the sim's -DL8_47_2_OFF=1 / -DL8_47_3_OFF=1 / -DL8_1_3_OFF=1 builds: MESH_<name>=1 under node, read once at load; a page always runs the laws
  const offOn = (n) => (isNode && typeof process !== 'undefined' && process.env && process.env[n] === '1') ? 1 : 0;
  const L8_47_3_OFF = offOn('MESH_L8_47_3_OFF'), L8_1_3_OFF = offOn('MESH_L8_1_3_OFF'), L8_54_OFF = offOn('MESH_L8_54_OFF');
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

    // C++: mesh_roomterm.inc:Seat::epOf   (L8.52.3: the founding epoch the door listed greeter g with on my last list; -1: not said)
    epOf(g) { for (let k = 0; k < this.lastGreeters.length && k < this.lastGreetersAt.length; k++) if (this.lastGreeters[k] === g) return this.lastGreetersAt[k]; return -1; },

    // L8.54 THE DOOR'S LIST SAYS WHICH GREETERS ARE ON MY NETWORK: a greeter's registration carries its network tag and its
    // measured kind, and a seeker reads a greeter of another network that its own cannot meet (one blocked, or both
    // strict) as silent at once: the two kinds are that dial's verdict.
    // A greeter at the far end of a TURN pc of mine answers me over it: no silence there.
    // C++: mesh_roomterm.inc:Seat::l854Other
    l854Other(g) { return !L8_54_OFF && !!this.w.lv.ISLAND_MODE && g >= 0 && g !== this.id && this.f.fabricDoorNet(this.id, g) === 0 && !this.f.fabricTurnPc(this.id, g); },
    // C++: mesh_roomterm.inc:Seat::l854All
    l854All(list) { if (L8_54_OFF || !this.w.lv.ISLAND_MODE) return false; let n = 0; for (const g of list) { if (g < 0 || g === this.id) continue; if (this.f.fabricDoorNet(this.id, g) !== 0 || this.f.fabricTurnPc(this.id, g)) return false; n++; } return n > 0; },

    // C++: mesh_roomterm.inc:Seat::l813Unfound   (L8.1.3: a founder still alone on its cell that reads, on the list its seating knock got, a greeter it never asked this entry, of a room it has not found silent, goes back to the door)
    l813Unfound(m) {
      if (L8_1_3_OFF || !this.f.fabricDoors() || !this.islandFounder || !this.l850Lone() || !(this.l8471() || !L8_54_OFF)) return false;   // a blocked founder (and, L8.54.3, any founder for a greeter the door says its network can meet)
      for (let k = 0; k < m.list.length; k++) {
        const g = m.list[k]; if (g < 0 || g === this.id || this.islandAsked.has(g)) continue;
        const at = k < m.listAt.length ? m.listAt[k] : -1; if (!L8_47_3_OFF && at >= 0 && this.entEp.has(at)) continue; if (this.l854Other(g)) continue;   /* L8.54.2 */ if (!this.l8471() && this.f.fabricDoorNet(this.id, g) !== 2) continue;   /* L8.54.3 */
        this.trace('L8.1.3-UNFOUND', this.id, this.coord, 'greeter=%d at=%d mine=%d', g, at, this.lineAt);
        this.c7Yield(this.ringName(), 'L8.1.3-unfound'); this.c7Old.clear(); this.l851Up = -1; this.c7At = K.C7AT_NEVER; this.f.relayUnlist(this.id); /* it was never a room: no merge to be gated (L8.5), no door entry to outlive it (L16.12) */ return true;
      }
      return false;
    },

    // L8.47.1 A BLOCKED SEEKER'S ENTRY: a joiner whose own measured network verdict is blocked is in the ask-all from its
    // first list, asks the whole list in one wave, waits ISLAND_WAIT_BLOCKED (one answered dial's verdict) and is not asked
    // a second silent round; the confirm knock stands.
    // C++: mesh_roomterm.inc:Seat::l8471
    l8471() { return !L8_47_1_OFF && !!this.w.lv.ISLAND_MODE && this.nat === E.NAT_BLOCKED; },

    // C++: mesh_roomterm.inc:Seat::islandWait
    islandWait() { return this.l8471() ? K.ISLAND_WAIT_BLOCKED : K.ISLAND_WAIT; },

    // C++: mesh_roomterm.inc:Seat::entryTerm
    entryTerm() { return this.entIsl || this.l8471() || this.l854All(this.lastGreeters); },   // L8.54.3: every listed greeter is one my network cannot meet

    // C++: mesh_roomterm.inc:Seat::l411Verdict   (L4.1.1: my probe's verdict landed while I stand at the door)
    l411Verdict() {
      if (!this.l8471() || !(this.state === 0 || this.state === 1) || this.lastGreeters.length === 0 || !this.f.fabricDoors() || (this.state === 1 && this.islandAskAt >= 0)) return;
      if (this.l16Until >= 0 && this.TICK < this.l16Until) return;   // waiting out a backoff: its knock's list is asked whole
      const a0 = (this.state === 1) ? this.retryAt : -1; const was = this.l16Ask.slice();
      this.trace('L4.1.1-VERDICT', this.id, null, 'asked=%zu since=%d', was.length, a0);
      this.islandAsk(this.lastGreeters);
      if (a0 >= 0 && this.state === 1) { let all = true; for (const g of this.l16List) if (!was.includes(g)) { all = false; break; } if (all) { this.l16FreshAt = a0; this.islandAskAt = a0; } }
    },

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
