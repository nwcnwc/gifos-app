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
  const msg = req('./msg.js', 'meshMsg');
  const K = C_.consts, E = C_.enums;
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
    l854Other(g) { return !!this.w.lv.ISLAND_MODE && g >= 0 && g !== this.id && this.f.fabricDoorNet(this.id, g) === 0; },
    // C++: mesh_roomterm.inc:Seat::l854All
    l854All(list) { if (!this.w.lv.ISLAND_MODE) return false; let n = 0; for (const g of list) { if (g < 0 || g === this.id) continue; if (this.f.fabricDoorNet(this.id, g) !== 0) return false; n++; } return n > 0; },

    // C++: mesh_roomterm.inc:Seat::l813Unfound   (L8.1.3: a founder still alone on its cell that reads, on the list its seating knock got, a greeter it never asked this entry, of a room it has not found silent, goes back to the door)
    l813Unfound(m) {
      if (!this.f.fabricDoors() || !this.islandFounder || !this.l850Lone()) return false;   // a blocked founder (and, L8.54.3, any founder for a greeter the door says its network can meet)
      for (let k = 0; k < m.list.length; k++) {
        const g = m.list[k]; if (g < 0 || g === this.id || this.islandAsked.has(g)) continue;
        const at = k < m.listAt.length ? m.listAt[k] : -1; if (at >= 0 && this.entEp.has(at)) continue; if (this.l854Other(g)) continue;   /* L8.54.2 */ if (this.found475 && this.f.fabricDoorBlk(this.id, g)) continue;   /* L8.47.5 */ if (!this.l8471() && !this.found475 && this.f.fabricDoorNet(this.id, g) !== 2) continue;   /* L8.54.3 */
        this.trace('L8.1.3-UNFOUND', this.id, this.coord, 'greeter=%d at=%d mine=%d', g, at, this.lineAt);
        this.c7Yield(this.ringName(), 'L8.1.3-unfound'); this.c7Old.clear(); this.l851Up = -1; this.c7At = K.C7AT_NEVER; this.f.relayUnlist(this.id); /* it was never a room: no merge to be gated (L8.5), no door entry to outlive it (L16.12) */ return true;
      }
      return false;
    },

    // L8.47.1 A BLOCKED SEEKER'S ENTRY: a joiner whose own measured network verdict is blocked is in the ask-all from its
    // first list, asks the whole list in one wave, waits ISLAND_WAIT_BLOCKED (one answered dial's verdict) and is not asked
    // a second silent round; the confirm knock stands.
    // C++: mesh_roomterm.inc:Seat::l8471
    l8471() { return !!this.w.lv.ISLAND_MODE && this.nat === E.NAT_BLOCKED; },

    // C++: mesh_roomterm.inc:Seat::islandWait
    // L8.47.5 THE BLOCKED PAIR'S ENTRY IS THE PAIR'S, FROM EITHER END: a seeker that is not blocked and whose held list names
    // only greeters of another network that registered blocked (the door's word: fabricDoorBlk) enters as L8.47.1's seeker
    // does: the ask-all, ISLAND_WAIT_BLOCKED for silence, no second silent round; the confirm knock stands. One open or
    // untagged name on the list and the rule is off.
    // C++: mesh_roomterm.inc:Seat::l8475
    l8475() { if (!this.w.lv.ISLAND_MODE || this.nat === E.NAT_BLOCKED) return false; let n = 0; for (const g of this.lastGreeters) { if (g < 0 || g === this.id) continue; if (!this.f.fabricDoorBlk(this.id, g)) return false; n++; } return n > 0; },

    islandWait() { return (this.l8471() || this.l8475()) ? K.ISLAND_WAIT_BLOCKED : K.ISLAND_WAIT; },

    // C++: mesh_roomterm.inc:Seat::entryTerm
    entryTerm() { return this.entIsl || this.l8471() || this.l854All(this.lastGreeters) || this.l8475(); },   // L8.54.3: every listed greeter is one my network cannot meet

    // C++: mesh_roomterm.inc:Seat::l411Verdict   (L4.1.1: my probe's verdict landed while I stand at the door)
    l411Verdict() {
      const pair = !this.l8471() && this.l8475();   /* L8.47.5 */
      if (!(this.l8471() || pair) || !(this.state === 0 || this.state === 1) || this.lastGreeters.length === 0 || !this.f.fabricDoors() || (this.state === 1 && this.islandAskAt >= 0)) return;
      if (this.l16Until >= 0 && this.TICK < this.l16Until) return;   // waiting out a backoff: its knock's list is asked whole
      const a0 = (this.state === 1) ? this.retryAt : -1; const was = this.l16Ask.slice();
      this.trace(pair ? 'L8.47.5-PAIR' : 'L4.1.1-VERDICT', this.id, null, 'asked=%zu since=%d', was.length, a0);
      this.islandAsk(this.lastGreeters); if (pair) this.f.wake(this.id);
      if (this.w.lv.ISLAND_MODE && !pair) for (const g of this.lastGreeters) if (g >= 0 && g !== this.id && this.f.fabricDoorNet(this.id, g) === 3) { this.trace('L8.54.5-REKNOCK', this.id, null, 'greeter=%d', g); this.greetersAt = -1; this.emitRelay(this.linkKey); break; }   // L8.54.5: a word given before its own probe's verdict: the door's fresh list carries the measured one
      if (a0 >= 0 && this.state === 1) { let all = true; for (const g of this.l16List) if (!was.includes(g)) { all = false; break; } if (all) { this.l16FreshAt = a0; this.islandAskAt = a0; } }
    },

    // L8.54.11 A WORD WITH NO KIND YET IS READ AGAIN WHEN ITS KIND IS DUE: a greeter that registered before its own probe's
    // limit is listed with its tag and no kind. REACH_PROBE after that list came its verdict has landed and it registered
    // again: a seeker that is not blocked, still unanswered at the door, knocks once per entry (docs/healing-laws.md).
    // L8.54.12 a page of my own network that my answered dial found no path to is one I cannot meet: the door's word reads 0
    // for it (the fabric), and when that makes every listed greeter such a one while I wait on my one ask, my asks of this
    // entry are the round (L8.54.1 founds in this tick)
    // C++: mesh_roomterm.inc:Seat::l8512Note
    l8512Note() {
      if (!this.w.lv.ISLAND_MODE || this.state !== 1 || this.islandAskAt >= 0 || !this.lastGreeters.length || this.greetersAt < 0 || !this.f.fabricDoors()) return;
      let dv = false; for (const g of this.lastGreeters) if (g >= 0 && g !== this.id && this.f.fabricDoorVerdict(this.id, g)) { dv = true; break; }
      if (!dv) return;
      if (!this.l854All(this.lastGreeters)) {   // L8.54.13: a verdict on one listed greeter: the rest are asked now, and my asks of this entry are the round
        if (!this.f.fabricTurnOn()) return;
        let n = 0; for (const g of this.lastGreeters) { if (g < 0 || g === this.id) continue; this.islandAsked.add(g); if (this.entAsk.has(g) || n >= 32) continue; this.entNote(g); this.l16Ask.push(g); const w = msg.newMsg('WHOHOME'); w.from = this.id; w.ttl = K.WHOHOME_HOPS; this.emit(g, w); n++; }
        this.entIsl = true; this.islandAskAt = this.TICK | 0; this.trace('L8.54.13-ASK', this.id, null, 'listed=%zu new=%d', this.lastGreeters.length, n); return; }
      let a0 = this.TICK; for (const g of this.lastGreeters) { if (g < 0 || g === this.id) continue; const it = this.entAsk.get(g); if (it !== undefined) { this.islandAsked.add(g); if (it < a0) a0 = it; } }
      this.islandAskAt = a0; this.trace('L8.54.12-VERDICT', this.id, null, 'listed=%zu since=%d', this.lastGreeters.length, a0);
    },
    // L8.54.13 my answered dial's verdict is silence, proven. A listed greeter of any network holds it (l8513): every
    // listed greeter not asked yet is asked now (l8512Note; a later round asks in one wave, islandAsk), so each pair's own
    // dial says its word. Every listed greeter holds it or reads "cannot meet" (l8513All): the round is over with no
    // silence wait and no second round (islandTick); the confirm knock stands. Only in a meeting with TURN: there the
    // founding that follows is SUB.2's ask and a pipe into the room; without it it is a room apart, and silence's wait
    // is the room's one chance to list a friend or dial me from its side (docs/healing-laws.md)
    // C++: mesh_roomterm.inc:Seat::l8513
    l8513() { if (!this.w.lv.ISLAND_MODE || !this.f.fabricTurnOn()) return false; for (const g of this.lastGreeters) if (g >= 0 && g !== this.id && this.f.fabricDoorVerdict(this.id, g)) return true; return false; },
    // C++: mesh_roomterm.inc:Seat::l8513All
    l8513All() { if (!this.w.lv.ISLAND_MODE || !this.f.fabricTurnOn() || this.entAsk.size === 0) return false; let first = -1; for (const t of this.entAsk.values()) if (first < 0 || t < first) first = t; if (this.TICK - first < K.FHOP_RELAY_ASK) return false;   /* JOIN.2's probe of the meeting's other doors (free) has its turn first: the founding that follows may pay */ let n = 0; for (const g of this.lastGreeters) { if (g < 0 || g === this.id) continue; if (this.f.fabricDoorNet(this.id, g) !== 0 && !this.f.fabricDoorVerdict(this.id, g)) return false; n++; } return n > 0; },
    // C++: mesh_roomterm.inc:Seat::l8511Note
    l8511Note() { if (this.kdAt !== -1 || !this.w.lv.ISLAND_MODE || !(this.state === 0 || this.state === 1) || this.nat === E.NAT_BLOCKED) return; for (const g of this.lastGreeters) if (g >= 0 && g !== this.id && this.f.fabricDoorDue(this.id, g)) { this.kdAt = this.TICK; return; } },
    // C++: mesh_roomterm.inc:Seat::l8511Tick
    l8511Tick() {
      if (this.kdAt < 0 || !(this.state === 0 || this.state === 1)) return false; if (this.TICK - this.kdAt <= K.REACH_PROBE) return false; const at = this.kdAt; this.kdAt = -2;
      if (this.nat === E.NAT_BLOCKED || this.lastReach >= at || this.greetersAt < 0) return false; let due = false; for (const g of this.lastGreeters) if (g >= 0 && g !== this.id && this.f.fabricDoorDue(this.id, g)) { due = true; break; } if (!due) return false;
      this.trace('L8.54.11-DUE', this.id, null, 'list=%d', at); this.emitRelay(this.linkKey); return true;
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

    // C++: mesh_roomterm.inc:Seat::subStall
    // JOIN.2: my first ask at door 0 stood one direct verdict (FHOP_RELAY_ASK) with no frame back from anybody: my page
    // probes the meeting's other doors (the relay's door list, plain dials; no Worker call, never a new number).
    subStall() {
      if (this.sr !== 0 || !(this.state === 0 || this.state === 1) || this.entAsk.size === 0) return;
      let first = -1; for (const at of this.entAsk.values()) if (first < 0 || at < first) first = at;
      if (this.TICK - first < K.FHOP_RELAY_ASK || this.entAnsAt >= first || this.lastReach >= first) return;
      if (this.f.fabricSubProbe(this.id)) this.trace('SUB.2-EARLY', this.id, null, 'stall=%d', (this.TICK | 0) - first);
    },
  });
  GifOS.meshRoomterm = Object.freeze({});
  if (isNode) module.exports = GifOS.meshRoomterm;
})(typeof window !== 'undefined' ? window : globalThis);
