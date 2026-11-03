/*
 * mltail.js: L33 the multi-level tail: door and row gates (C++: mesh_mltail.inc). Methods only, added to the Seat; callees other units define are called by name on the Seat.
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
  const { ckey, unckey, down, C } = topo;

  // The C++ passes ~0ULL (all 64 bits set) to l33MateArm to mean "the sweep's own dials". As a JS number that
  // is 2^64 (the nearest double); callers pass NONE_KEY.
  const NONE_KEY = 18446744073709551615;

  Seat.unit('mesh_mltail.inc', {
    // C++: mesh_mltail.inc:Seat::l33NoAdmitter
    l33NoAdmitter(t, j, admRowHeld) {
      if (!admRowHeld) return false;
      const adm = (j > 0) ? { pc: 0, r: t, i: 0 } : { pc: 0, r: (t - 1 + C) % C, i: 0 };
      const ak = ckey(adm);
      if (this.hasCoord && ckey(this.coord) === ak) return false;
      return this.occGet(ak) < 0 && !this.softSitting(ak);
    },

    // C++: mesh_mltail.inc:Seat::l33HeirCalled
    l33HeirCalled(k) {
      const hc = this.l13HeirCallAt.get(k);
      return hc !== undefined && this.TICK - hc <= K.LEASE_T;
    },

    // C++: mesh_mltail.inc:Seat::l33RowGate
    l33RowGate() { return this.l13Mass(); },

    // C++: mesh_mltail.inc:Seat::l33WordDenied
    l33WordDenied(ok) { this.l33Deny.set(ok, this.TICK); if (this.l33Deny.size > 64) { for (const k of this.l33Deny.keys()) { this.l33Deny.delete(k); break; } } },

    // C++: mesh_mltail.inc:Seat::l33WordMine
    l33WordMine(ak) {
      const h = this.l13HeldAt.get(ak); if (h === undefined) return;
      const ac = unckey(ak); this.trace('L33-WORD', this.id, ac, 'held=%lld', this.TICK - h); this.l13HeldAt.delete(ak);
    },

    // C++: mesh_mltail.inc:Seat::l33WordRegrant
    l33WordRegrant(ok, to) {
      const w = this.l13WordTo.get(ok); if (w === undefined || w[0] !== to || this.TICK - w[1] < 16) return false;
      const d = this.l33Deny.get(ok); if (d === undefined || d < w[1]) return false;
      this.l13WordTo.delete(ok); this.l33Deny.delete(ok); return true;
    },

    // C++: mesh_mltail.inc:Seat::l33HoldFull
    l33HoldFull(nc) {
      const rc = this.rosterCells(); let free = 0; for (let c = 0; c < C; c++) { const k = ckey(rc[c]); if (this.occGet(k) < 0) free++; }
      let waiting = 0; for (const h of this.held) if (h.deep && h.m.nc !== nc) waiting++;
      return waiting >= free;
    },

    // C++: mesh_mltail.inc:Seat::l33MateArm
    l33MateArm(k) {
      if (this.l13Merging() || !this.hasCoord || this.state !== 3 || this.coord.pc !== 0 || this.coord.i !== 0) return false;
      if (k === NONE_KEY) return this.TICK - this.seatedAt >= 60;
      const c = unckey(k); return c.pc === 0 && c.r === this.coord.r && c.i !== 0;
    },

    // C++: mesh_mltail.inc:Seat::l33NoSockAsk
    l33NoSockAsk(g) {
      if (!this.f.fabricDoors() || g < 0 || g === this.id) return;
      this.f.fabricNoSock(this.id, g);
    },

    // C++: mesh_mltail.inc:Seat::l33NoSock
    l33NoSock(g) {
      if (this.state !== 1) return;
      let asked = false; for (let q = 0; q < this.l16Ask.length; q++) if (this.l16Ask[q] === g) { this.l16Ask.splice(q, 1); asked = true; break; } if (!asked) return;
      this.f.fabricDoorDrop(this.id, g); this.doorAsk.delete(g); this.trace('L33-NOSOCK', this.id, null, 'greeter=%d', g);
      if (this.l16Next < this.l16List.length) { const at = this.l16WaveAt; this.l16Wave(1); this.l16WaveAt = at; return; }
      if (this.l16Ask.length && this.l16Busy.length >= this.l16Ask.length) this.l16Backoff('all-busy');
    },

    // C++: mesh_mltail.inc:Seat::l33ChildVouch
    l33ChildVouch(nc) { this.l33ChildNc = nc; },

    // C++: mesh_mltail.inc:Seat::l33ChildGone
    l33ChildGone(x) {
      if (x < 0 || x !== this.l33ChildNc || !this.hasCoord || this.state !== 3) return;
      const dk = ckey(down(this.coord)); this.l33ChildNc = -1; if (this.occGet(dk) >= 0) return;
      if (this.TICK - this.childHeadAt > K.L7_HOLD) return;
      this.childHeadAt = -100000; { const it = this.sitting.get(dk); if (it !== undefined && it.joiner === x) this.sitting.delete(dk); }
      const dc = down(this.coord); this.trace('L33-CHILDGONE', this.id, dc, 'joiner=%d held=%zu', x, this.held.length); this.f.wake(this.id);
    },
  });
  GifOS.meshMltail = Object.freeze({ NONE_KEY });
  if (isNode) module.exports = GifOS.meshMltail;
})(typeof window !== 'undefined' ? window : globalThis);
