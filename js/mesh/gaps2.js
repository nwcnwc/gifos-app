/*
 * gaps2.js: L38 second release gaps fix pass, seat side (C++: mesh_gaps2.inc). Methods only, added to the Seat; callees other units define are called by name on the Seat.
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
  const { newMsg } = msg;
  const K = C_.consts;
  const { ckey, unckey: unck, C } = topo;

  Seat.unit('mesh_gaps2.inc', {
    // L38.1: a FIND that died on the way is not spread again (the seeker's later FINDs carry the spread budget spent).
    // C++: mesh_gaps2.inc:Seat::l381Lost
    l381Lost() { if (this.findAckAt >= 0 && this.l381N < 255) this.l381N++; },   // the 60-tick wait after an acknowledged FIND ran out

    // C++: mesh_gaps2.inc:Seat::l381Stamp
    l381Stamp(m) { if ((this.l381N > 0 || this.l506Short()) && m.sh < C) m.sh = C; if (this.l381N > 0 && this.f.fabricDoors()) m.gwc = true;   /* L50.4 */ },   // my next FINDs go down a greeter's own subtree

    // L38.2: the mover holds the cell it vacated as vacated (as its goodbye's hearers do).
    // C++: mesh_gaps2.inc:Seat::l382Vacated
    l382Vacated() { const left = unck(this.oldCk); if (this.oldCk && left.pc === 0 && !this.hasDownChild(left)) this.l1Vacated.set(this.oldCk, this.TICK | 0); },

    // L38.3: a goodbye heard too young is read again when the view comes of age (the goodbye's own tick is kept).
    // C++: mesh_gaps2.inc:Seat::l383Tick
    l383Tick() {
      if (this.l383Due.size === 0) return;
      const TICK = this.TICK;
      const due = []; for (const [k, v] of this.l383Due) if (TICK >= v) due.push(k);
      for (const k of due) {
        this.l383Due.delete(k);
        const b = this.byeAt.get(k); if (b === undefined || TICK - b > K.LEASE_T || this.occGet(k) >= 0) continue;
        const at = b; this.goodbyeHeal(k, false); this.byeAt.set(k, at);
      }
    },

    // L50: entry among seats that fail a seeker. A seeker outside reads only what it saw itself; nobody's word about
    // another seat is taken, and no seat is moved.
    // L50.1: a seeker leaves a gateway it has marked. Answers cross the gateway's door, and a placement that arrives
    // from a marked seat is refused, so every later answer was lost. The door is dropped and later asks have the
    // answer come over the admitter's own door.
    // C++: mesh_gaps2.inc:Seat::l501Marked
    l501Marked(x) {
      if (this.hasCoord || this.state === 3 || !this.f.fabricDoors() || x < 0 || x !== this.gateway || this.l16GwClosed) return;
      this.f.fabricDoorDrop(this.id, x); this.l16GwClosed = true; this.trace('L50.1-LEFT', this.id, null, 'gw=%d', x);
    },
    // L50.2: a marked placer is not asked while another is left.
    // C++: mesh_gaps2.inc:Seat::l502Skip
    l502Skip(x) { return this.l25BadPlacer.size !== 0 && this.l25Bad(x); },
    // L50.3: a replayed placement takes the admitter's own door (the first copy was routed to the seeker's gateway
    // and did not arrive).
    // C++: mesh_gaps2.inc:Seat::l503Replay
    l503Replay(pl) { const r = msg.clone(pl); if (this.f.fabricDoors()) r.gwc = true; return r; },
    // L50.5: a seeker that was failed asks more than one seat at a time. It counts its own failures of this entry
    // (a wait that ran out, an offer it refused, a FIND reported lost, a BUSY at the door); with one or more, each
    // ask also goes to other roster seats, at most L505_FAN in all. The first placement seats it and a second
    // chair is declined.
    // C++: mesh_gaps2.inc:Seat::l505Note
    l505Note() { if (!this.hasCoord && this.state !== 3 && this.l505N < 255) this.l505N++; },
    // C++: mesh_gaps2.inc:Seat::l505Fan
    l505Fan(t, m0) {
      if (!this.f.fabricDoors() || this.hasCoord || this.l505N === 0 || !this.haveRoster || m0.tag === 1) return;
      const n = Math.min(2 * this.l505N, K.L505_FAN - 1);
      for (let k = 0; k < n; k++) {
        const x = this.pickRoster(); if (x < 0 || x === t || this.triedSilent.has(x)) break;
        this.triedSilent.add(x); const m = msg.clone(m0); m.dark = this.darkGreeters(x); this.emit(x, m); this.trace('L50.5-FAN', this.id, null, 'to=%d beside=%d', x, t);
      }
    },
    // L50.6: after a failure the next wait is the short one (one tick past L7_HOLD).
    // C++: mesh_gaps2.inc:Seat::l506Short
    l506Short() { return (this.l381N > 0 || this.l505N > 0) && !this.hasCoord; },
    // L50.7: the seat that acknowledged is asked again first, once; a marked seat never.
    // C++: mesh_gaps2.inc:Seat::l507Again
    l507Again() { return this.findAckAt >= 0 && this.lastAsked >= 0 && this.lastAsked !== this.l507Last && this.haveRoster && !this.l25Bad(this.lastAsked) && this.f.fabricDoors() && !this.hasCoord; },
    // C++: mesh_gaps2.inc:Seat::l507Ask
    l507Ask() { this.l507Last = this.lastAsked; this.trace('L50.7-AGAIN', this.id, null, 'seat=%d', this.lastAsked); this.askSeat(this.lastAsked); return true; },
    // L50.8: a greeter that said BUSY is not knocked again while another is listed, and each failure widens the
    // knock (2, 4, then 8 greeters at once). The first HOME is the gateway and the other doors close.
    // C++: mesh_gaps2.inc:Seat::l508Said
    l508Said(g) { if (g < 0) return; this.l508Busy.add(g); this.l505Note(); },
    // C++: mesh_gaps2.inc:Seat::l508Pick
    l508Pick(list) {
      if (this.l505N === 0 || !this.f.fabricDoors() || this.hasCoord) return list[Math.floor(this.rng() * list.length)];
      const c = []; for (const g of list) if (g >= 0 && g !== this.id && !this.l508Busy.has(g) && !this.l25Bad(g)) c.push(g);
      if (!c.length) { this.l508Busy.clear(); return list[Math.floor(this.rng() * list.length)]; }   // every listed greeter refused: the round starts over
      return c[Math.floor(this.rng() * c.length)];
    },
    // C++: mesh_gaps2.inc:Seat::l508Fan
    l508Fan(list, g) {
      if (this.l505N === 0 || !this.f.fabricDoors() || this.hasCoord || this.oldCell) return;
      const c = []; for (const x of list) if (x >= 0 && x !== this.id && x !== g && !this.l508Busy.has(x) && !this.l25Bad(x)) c.push(x);
      const n = (1 << Math.min(this.l505N, 3)) - 1;
      for (let k = 0; k < n && c.length; k++) {
        const q = Math.floor(this.rng() * c.length); const x = c[q]; c.splice(q, 1);
        this.entNote(x); this.l16AskOne(x); const w = newMsg('WHOHOME'); w.from = this.id; w.ttl = 60; this.emit(x, w); this.trace('L50.8-KNOCK', this.id, null, 'to=%d beside=%d', x, g);
      }
    },
    // L50.9: the first cell is no exception: a placement that names no neighbours is refused there too.
    // C++: mesh_gaps2.inc:Seat::l509Root
    l509Root() { return true; },
  });
  GifOS.meshGaps2 = Object.freeze({});
  if (isNode) module.exports = GifOS.meshGaps2;
})(typeof window !== 'undefined' ? window : globalThis);
