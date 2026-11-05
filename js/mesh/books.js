/*
 * books.js: the helper structs a seat holds that carry their own methods: the token Bucket, the DIAL BOOK
 * (what my dials to each peer came to) and the CALL BOOK (the calls between me and each peer).
 *
 * The data members are the sim's (seat-fields.js STRUCTS); state.js creates them and fills the defaults.
 * Every method takes the caller's clock (`now`): a seat passes its own TICK, the fabric the shared one.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  if (isNode) require('./laws.js');
  const K = (isNode ? require('./consts.js') : GifOS.meshConsts).consts;
  const { ins, eraseFirst } = isNode ? require('./util.js') : GifOS.meshUtil;
  const { CALL_HOLD, L23_CALL_, L23_CALLS_, LEASE_T } = K;

  // C++: mesh.cpp:Bucket
  // Bucket<T>: tok (T), at. intT: T is int (integer arithmetic in refill), else double.
  class Bucket {
    constructor(intT) { Object.defineProperty(this, 'intT', { value: !!intT, enumerable: false }); this.tok = 0; this.at = 0; }
    // C++: mesh.cpp:refill
    refill(now, burst, num, den) {
      if (this.intT) this.tok += Math.trunc(Math.trunc(now - this.at) * num / den);
      else this.tok += (now - this.at) * num / den;
      if (this.tok > burst) this.tok = burst;
      this.at = now;
    }
    // C++: mesh.cpp:take
    take() { if (this.tok < 1) return false; this.tok -= 1; return true; }
  }

  // C++: mesh.cpp:DialBook::Rec
  const newRec = () => ({ fails: 0, lastFailAt: -1, goneAt: -1 });

  // C++: mesh.cpp:DialBook
  class DialBook {
    constructor() { this.recs = new Map(); }
    // C++: mesh.cpp:fails
    fails(x) { const it = this.recs.get(x); return it === undefined ? 0 : it.fails; }
    // C++: mesh.cpp:pathFailedWithin
    pathFailedWithin(x, hold, now) { const it = this.recs.get(x); return it !== undefined && it.lastFailAt >= 0 && now - it.lastFailAt <= hold; }
    // C++: mesh.cpp:failAge
    failAge(x, now) { const it = this.recs.get(x); return (it === undefined || it.lastFailAt < 0) ? -1 : now - it.lastFailAt; }
    // C++: mesh.cpp:failed
    failed(x, now, path) { const r = ins(this.recs, x, newRec); r.fails++; if (path) r.lastFailAt = now; }
    // C++: mesh.cpp:opened
    opened(x) { this.recs.delete(x); }
    // C++: mesh.cpp:goneAt
    goneAt(x) { const it = this.recs.get(x); return it === undefined ? -1 : it.goneAt; }
    // C++: mesh.cpp:holdLost
    holdLost(x, now) { const r = ins(this.recs, x, newRec); if (r.goneAt < 0 || r.goneAt > now) r.goneAt = now; }   // L17: my dial went nowhere: that was the re-dial
    // C++: mesh.cpp:holdGone
    holdGone(x, until) { const r = ins(this.recs, x, newRec); if (r.goneAt < 0) r.goneAt = until; }   // L17: its goodbye: gone for GONE_DIAL
    // C++: mesh.cpp:heard
    heard(x) { const it = this.recs.get(x); if (it !== undefined) it.goneAt = -1; }   // L17: I hear it: it lives
    // C++: mesh.cpp:lapse
    lapse(x) { const it = this.recs.get(x); if (it !== undefined) it.goneAt = -1; }   // L17.3: the hold outlived a lease on a seat I still name: one more dial
    // C++: mesh.cpp:heldN
    heldN() { let n = 0; for (const r of this.recs.values()) if (r.goneAt >= 0) n++; return n; }
    // C++: mesh.cpp:sweepHeld
    sweepHeld(now, named) { for (const [x, r] of this.recs) if (r.goneAt >= 0 && now >= r.goneAt && !named(x)) r.goneAt = -1; }
  }

  // C++: mesh.cpp:CallBook
  // outAt {x: tick}, outStart {x: tick}, ring {x: [calls, lastTick]}, in {x: [start, last]}
  class CallBook {
    constructor() { this.outAt = new Map(); this.outStart = new Map(); this.ring = new Map(); this.in = new Map(); }
    // C++: mesh.cpp:outFresh
    outFresh(x, now) { const it = this.outAt.get(x); return it !== undefined && now - it <= CALL_HOLD; }
    // C++: mesh.cpp:dialled
    dialled(x) { return this.outAt.has(x); }
    // C++: mesh.cpp:touchOut
    touchOut(x, now) { if (this.outAt.has(x)) this.outAt.set(x, now); }   // a frame either way holds the call
    // C++: mesh.cpp:noteOut
    noteOut(x, now) {
      if (this.outAt.size > 64) this.outAt.clear();
      const ca = this.outAt.get(x);
      if (ca === undefined || now - ca > CALL_HOLD) { this.outStart.set(x, now); if (this.outStart.size > 128) this.outStart.clear(); }
      this.outAt.set(x, now);
    }
    // C++: mesh.cpp:outReason
    outReason(x, now) { if (!this.outFresh(x, now)) return false; const cs = this.outStart.get(x); return cs === undefined || now - cs < L23_CALL_; }
    // C++: mesh.cpp:ringCall
    ringCall(x, now) { const tr = ins(this.ring, x, () => [0, 0]); tr[0]++; tr[1] = now; if (this.ring.size > 64) eraseFirst(this.ring); }
    // C++: mesh.cpp:answered
    answered(x) { this.ring.delete(x); }
    // C++: mesh.cpp:ringFresh
    ringFresh(x, hold, now) { const it = this.ring.get(x); return it !== undefined && now - it[1] <= hold; }
    // C++: mesh.cpp:rested
    rested(x, now) { const it = this.ring.get(x); return it !== undefined && it[0] >= 2 && now - it[1] < LEASE_T; }
    // C++: mesh.cpp:ringCalled
    ringCalled(x) { return this.ring.has(x); }
    // C++: mesh.cpp:noteIn
    noteIn(x, now) { const c = ins(this.in, x, () => [0, 0]); if (c[1] < 0 || now - c[1] > CALL_HOLD) c[0] = now; c[1] = now; if (this.in.size > 128) this.in.clear(); }
    // C++: mesh.cpp:inKnown
    inKnown(x) { return this.in.has(x); }
    // C++: mesh.cpp:inOverlong
    inOverlong(x, now) { const ci = this.in.get(x); return ci !== undefined && now - ci[1] <= CALL_HOLD && now - ci[0] >= L23_CALL_; }
    // C++: mesh.cpp:inStartedNow
    inStartedNow(x, now) { const c = this.in.get(x); return c !== undefined && c[0] === now; }
    // C++: mesh.cpp:inCount
    inCount(now) { let n = 0; for (const e of this.in.values()) if (now - e[1] <= CALL_HOLD) n++; return n; }
    // C++: mesh.cpp:inReason
    inReason(x, now) {
      const ci = this.in.get(x); if (ci === undefined || now - ci[1] > CALL_HOLD || now - ci[0] >= L23_CALL_) return false;
      let older = 0;
      for (const [k, e] of this.in) if (k !== x && now - e[1] <= CALL_HOLD && now - e[0] < L23_CALL_ && (e[0] < ci[0] || (e[0] === ci[0] && k < x))) older++;
      return older < L23_CALLS_;
    }
  }

  const api = Object.freeze({ Bucket, DialBook, CallBook, newRec });
  GifOS.meshBooks = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
