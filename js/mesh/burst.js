/*
 * burst.js: L44 a burst's refused placement does not unseat a seated seeker, seat side (C++: mesh_burst.inc).
 * L44_OFF (a build-time switch in the sim, 0 in the release) is not ported: every law here is on.
 * lv: the measurement counters, levers of the shared world.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const topo = req('./topo.js', 'meshTopo');
  const K = C_.consts;
  const { ckey, C } = topo;
  const { LS_CLOSED } = C_.enums || {};

  Seat.unit('mesh_burst.inc', {
    // L44.1: an admitter I hear first-hand is not silent: its refusal is judged on my own HELLO, and my placer's word alone does not move me.
    // C++: mesh_burst.inc:Seat::l44Stay
    l44Stay() {
      const c = this.coord;
      const ac = c.i > 0 ? { pc: 0, r: c.r, i: 0 } : { pc: 0, r: (c.r + C - 1) % C, i: 0 }; const ak = ckey(ac);
      if (this.occGet(ak) < 0 || this.occGet(ak) === this.id || !this.firstHandLive(ak)) return false;
      this.trace('L44-STAY', this.id, c, 'by=%d adm=%d', this.myPlacer, this.occGet(ak));
      this.w.lv.L44_STAY++;
      return true;
    },

    // L44.2: a record speaks for a seeker in a cell; that seeker's own goodbye for the cell ends it.
    // C++: mesh_burst.inc:Seat::l44Left
    l44Left(k, q) {
      const a = this.l31Acc.get(k); if (a !== undefined && a.q === q) { a.left = true; a.at = this.TICK | 0; }
    },

    // L44.3: a cell a burst seat left by its own goodbye: no mover is owed it, for one record hold.
    // C++: mesh_burst.inc:Seat::l44Hole
    l44Hole(k) {
      const a = this.l31Acc.get(k); return a !== undefined && a.left && this.TICK - a.at <= K.L31_REC_HOLD;
    },

    // L44.4: a room whose Section 1 is not full has no queue to protect: a FIND a door acknowledged is asked again one tick past L7_HOLD, not after 60.
    // C++: mesh_burst.inc:Seat::l44AckWait
    l44AckWait() {
      if (!this.haveRoster || !this.rosterSmall) return 60;
      return K.L7_HOLD + 1;
    },

    // L44.5: the link to the seat I asked is closed, in a room not yet full: nothing more comes over it, so I ask again now.
    // C++: mesh_burst.inc:Seat::l44LinkLost
    l44LinkLost() {
      if (!this.f.fabricDoors() || this.lastAsked < 0 || !this.haveRoster || !this.rosterSmall || this.TICK <= this.retryAt || this.f.fabricLinkState(this.id, this.lastAsked) !== LS_CLOSED) return false;
      if (this.findAckAt >= 0) return false;   // L44.5.1: the seat I asked acknowledged my FIND: it handed it on, and its door's close is the plan, not a lost ask
      this.trace('L44-REASK', this.id, null, 'asked=%d after=%d', this.lastAsked, this.TICK - this.retryAt);
      this.w.lv.L44_REASK++;
      return true;
    },

    // L44.6: an early re-ask can send me back to the door (state 1) while the FIND I sent before it is still alive: a seat with no cell takes the chair its own FIND earned.
    // C++: mesh_burst.inc:Seat::l44Answer
    l44Answer(m) {
      if (this.state !== 1 || this.hasCoord || m.nc !== this.id || this.lastAsked < 0) return false;
      this.trace('L44-ANSWER', this.id, null, 'from=%d owner=%d asked=%d', m.from, m.owner, this.lastAsked);
      return true;
    },

    // L45: a seat with no cell hears the goodbye of a door it was asking: the door is off its lists at once, and it asks the next one or knocks again now.
    // C++: mesh_burst.inc:Seat::l45Bye
    l45Bye(x) {
      if (this.hasCoord || this.state === 3 || x < 0 || x === this.id || (this.rcPendAt >= 0 && this.oldCell)) return;
      let was = x === this.gateway || x === this.lastAsked;
      if (this.lastGreeters.includes(x)) { was = true; this.lastGreeters = this.lastGreeters.filter(g => g !== x); }
      if (this.roster.some(e => e.v === x)) { was = true; this.roster = this.roster.filter(e => e.v !== x); }
      if (!was) return;
      this.noteBye(x); this.dials.holdGone(x, this.TICK + K.GONE_DIAL); this.trace('L45-RELEASE', this.id, null, 'door=%d state=%d left=%d', x, this.state, this.lastGreeters.length);
      if (this.state === 2) {
        if (this.lastAsked !== x) return;   // my FIND lives on past the door that handed it
        if (this.haveRoster && this.roster.length) { const t = this.pickRoster(); if (t >= 0) { this.askSeat(t); return; } }
        this.join(); return;
      }
      if (!this.lastGreeters.length || !this.resumeAsk()) this.join();
    },

    // L45.3: my one door has not answered through a retry: I knock, the relay knows its socket.
    // C++: mesh_burst.inc:Seat::l45Lone
    l45Lone() { return this.state === 1 && this.lastGreeters.length === 1 && this.lastReach < 0; },

    // L45: a list naming a door within L45_LIST_WAIT of its goodbye is its socket's close not seen yet.
    // C++: mesh_burst.inc:Seat::l45Stale
    l45Stale(list) {
      if (this.hasCoord || this.state === 3) return false;
      for (const g of list) { const b = this.byeIds.get(g); if (b !== undefined && this.TICK - b <= K.L45_LIST_WAIT) return true; }
      return false;
    },
  });
  GifOS.meshBurst = Object.freeze({});
  if (isNode) module.exports = GifOS.meshBurst;
})(typeof window !== 'undefined' ? window : globalThis);
