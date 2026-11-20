/*
 * wall.js: L52 the people line is a wall in the seating order, seat side (C++: mesh_wall.inc).
 * A hosted room's people line W (the number on its host's signed order) is home cell number W (row * C + column):
 * the home section fills row by row and packs to its front, and one cell holds one seat. No seat places a seeker
 * that showed no ticket of its own at or past that cell. Nothing is counted: a door's fresh admissions are its
 * vouches and its records, which hold their cells already.
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
  const dig = req('./dig.js', 'meshDig');
  const K = C_.consts;
  const { ckey, C } = topo;
  const newMsg = (t) => msg.newMsg(t);

  Seat.unit('mesh_wall.inc', {
    // My wall: the first home cell number a seeker with no ticket may not have. L52_NONE: no wall. Below 0: not known yet (L52.6).
    // C++: mesh_wall.inc:Seat::l52Wall
    l52Wall() {
      let w = this.f.fabricWall(this.id);
      if (w < 0) return -1;
      if (w === 0 || w > C * C) return K.L52_NONE;   // L52.8: a line above the home section is no wall
      if (this.rootDig.at >= 0) w -= dig.digFar(this.rootDig);   // L52.7: the people behind my room's pipes hold their part of the line
      return w < 0 ? 0 : w;
    },

    // Every home cell below wall w is taken in my view by someone other than nc: a seat, my vouch or a record (L52.2, L52.5).
    // C++: mesh_wall.inc:Seat::l52Full
    l52Full(w, nc) {
      if (!this.hasCoord || this.coord.pc !== 0) return false;   // a seat below the home section does not see the home: not yet, never full
      for (let o = 0; o < w && o < C * C; o++) {
        const k = ckey({ pc: 0, r: (o / C) | 0, i: o % C });
        if (k === ckey(this.coord)) continue;
        const x = this.occGet(k);
        if (x === nc) return false;   // the seeker itself, in my view: its cell is its own
        if (x >= 0) {
          if (this.l315Cell(k)) return false;   // L52.5: held for a seat that may be reloading: it comes back or its goodbye lands, either way inside the hold: not yet
          continue;
        }
        const s = this.sitting.get(k);
        if (s !== undefined && this.softSitting(k)) { if (s.joiner === nc) return false; continue; }
        if (this.l31Held(k, nc)) continue;
        return false;
      }
      return true;
    },

    // The wall's answer (L52.3): a NOROOM of its own tag, from me, and the page is told (L52.5).
    // C++: mesh_wall.inc:Seat::l52Refuse
    l52Refuse(nc, gwc, full, site, c) {
      this.trace('L52-WALL', this.id, c ? c : (this.hasCoord ? this.coord : null), 'nc=%d full=%d site=%s', nc, full ? 1 : 0, site);
      this.f.fabricWalled(this.id, nc, full);
      const m = newMsg('NOROOM'); m.tag = K.L52_TAG; m.gwc = gwc; m.id = this.id; m.nd = 0; this.emit(nc, m);
    },

    // L52.2: at the door, before any cell is looked for. True: answered with the wall.
    // C++: mesh_wall.inc:Seat::l52Door
    l52Door(w) {
      const nc = w.from;
      if (nc < 0 || nc === this.id || w.knock) return false;   // a knock is a seated seat's call at the door, not an entry
      const W = this.l52Wall();
      if (W === K.L52_NONE || this.f.fabricPass(this.id, nc)) return false;
      if (W < 0) { this.l52Refuse(nc, false, false, 'door-unknown', null); return true; }   // L52.6
      if (!this.l52Full(W, nc)) return false;
      this.l52Refuse(nc, false, true, 'door', null); return true;
    },

    // L52.1: where a cell is given. True: the placement is not made (answered with the wall).
    // C++: mesh_wall.inc:Seat::l52Admit
    l52Admit(c, f) {
      if (f.tag === 1 || f.nc < 0 || f.nc === this.id) return false;   // L52.8: a seated seat's move is no admission
      const W = this.l52Wall();
      if (W === K.L52_NONE || this.f.fabricPass(this.id, f.nc)) return false;
      if (W >= 0 && c.pc === 0 && c.r * C + c.i < W) {
        if (this.l31Held(ckey(c), f.nc)) { this.l52Refuse(f.nc, f.gwc, false, 'record', c); return true; }   // L52.9: the cell stands under another seeker's record (one I assented to, or a commit): it is not given twice
        const ac = c.i > 0 ? { pc: 0, r: c.r, i: 0 } : { pc: 0, r: (c.r + C - 1) % C, i: 0 };   // the cell's designated admitter
        if (!this.l31Cap && !(this.hasCoord && ckey(ac) === ckey(this.coord))) { this.l52Refuse(f.nc, f.gwc, false, 'not-admitter', c); return true; }   // L52.9: I am not the cell's admitter and this is no proposal for its assent (a soft fill of a row whose head is not seated yet): not yet
        return false;
      }
      this.l52Refuse(f.nc, f.gwc, W >= 0 && this.l52Full(W, f.nc), this.w.ADMIT_SITE === undefined ? '?' : this.w.ADMIT_SITE, c); return true;
    },

    // L52.9: a room with a line (known or not yet): a home cell is given on its one admitter's word.
    // C++: mesh_wall.inc:Seat::l52Firm
    l52Firm() { return this.l52Wall() !== K.L52_NONE; },

    // L52.9, the cell's designated admitter: the record I assented to is the cell's, against every later one.
    // C++: mesh_wall.inc:Seat::l52Assented
    l52Assented(k, q) { if (!this.l52Firm()) return; const a = this.l31Acc.get(k); const had = a !== undefined && a.q === q && !a.left; if (had) a.commit = true; this.trace('L52-ASSENT', this.id, this.coord, 'ck=%lld seeker=%d kept=%d', k, q, had ? 1 : 0); },

    // L52.9, the cell's designated admitter: I hold my own vouch in k for a seat other than q, and it is no open proposal (the PLACE is out).
    // C++: mesh_wall.inc:Seat::l52Given
    l52Given(k, q) {
      if (!this.l52Firm()) return false;
      const s = this.sitting.get(k); if (s === undefined || !this.softSitting(k) || s.joiner === q || s.assigner !== this.id) return false;
      for (const p of this.l31Pend) if (p.k === k) return false;
      return true;
    },

    // L52.3, the seeker: the wall answered. I ask nobody else; I wait L52_WAIT and knock again.
    // C++: mesh_wall.inc:Seat::l52Walled
    l52Walled(m) {
      if (this.evilDoor || this.state === 3 || this.hasCoord) return;
      this.l16Saw = true; this.doorAsk.delete(m.id); this.lastReach = this.TICK | 0;   // an answer: no silence, no dark door
      this.l16Anch = false; this.l16Ho = -1; this.l16Until = this.TICK + K.L52_WAIT; this.state = 0; this.islandAskAt = -1; this.l16Ask.length = 0; this.l16Busy.length = 0; this.l16Last = -1; this.l16List.length = 0; this.l16Next = 0; this.l16WaveAt = -1; this.l16FreshAt = -1; this.findAckAt = -1; this.reAsk = false; this.reJoin = false;
      this.trace('L52-WAIT', this.id, null, 'from=%d wait=%d', m.id, K.L52_WAIT); this.f.wake(this.id);
    },
  });

  GifOS.meshWall = Object.freeze({});
  if (isNode) module.exports = GifOS.meshWall;
})(typeof window !== 'undefined' ? window : globalThis);
