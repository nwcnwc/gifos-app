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
      if (!this.haveRoster || this.roster.length >= C * C) return 60;
      return K.L7_HOLD + 1;
    },

    // L44.5: the link to the seat I asked is closed, in a room not yet full: nothing more comes over it, so I ask again now.
    // C++: mesh_burst.inc:Seat::l44LinkLost
    l44LinkLost() {
      if (!this.f.fabricDoors() || this.lastAsked < 0 || !this.haveRoster || this.roster.length >= C * C || this.TICK <= this.retryAt || this.f.fabricLinkState(this.id, this.lastAsked) !== LS_CLOSED) return false;
      this.trace('L44-REASK', this.id, null, 'asked=%d after=%d', this.lastAsked, this.TICK - this.retryAt);
      this.w.lv.L44_REASK++;
      return true;
    },
  });
  GifOS.meshBurst = Object.freeze({});
  if (isNode) module.exports = GifOS.meshBurst;
})(typeof window !== 'undefined' ? window : globalThis);
