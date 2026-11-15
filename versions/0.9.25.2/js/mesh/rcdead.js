/*
 * rcdead.js: L35 a name I no longer hold is not dialled (free functions of the realcheck dead-dial job, seat side) (C++: mesh_rcdead.inc). Methods only, added to the Seat; callees other units define are called by name on the Seat.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const K = C_.consts;

  // The C++ free functions take the Seat; the seat reads its own clock (TICK - clkHeld).
  // C++: mesh_rcdead.inc:l35Now
  function l35Now(s) { return s.w.TICK - s.clkHeld; }
  // C++: mesh_rcdead.inc:l35Fresh
  function l35Fresh(s, k, x) {
    const now = l35Now(s);
    { const lv = s.live.get(k), lb = s.liveBy.get(k); if (lv !== undefined && lb !== undefined && lb === x && now - lv <= K.LEASE_T) return true; }
    { const bn = s.born.get(k); if (bn !== undefined && now - bn <= K.LEASE_T) { const h = s.l35Hint.get(k); if (h === undefined || h !== x) return true; } }
    return false;
  }
  // C++: mesh_rcdead.inc:l35HandOn
  function l35HandOn(s, k, x) { return l35Fresh(s, k, x); }
  // C++: mesh_rcdead.inc:l35Hinted
  function l35Hinted(s, k, v) {
    s.l35Hint.set(k, v);
    if (s.l35Hint.size > 128) {
      for (const [hk, hv] of s.l35Hint) {
        const o = s.occ.get(hk), c = s.cousins.get(hk);
        const named = (o !== undefined && o === hv) || (c !== undefined && c === hv);
        if (!named) s.l35Hint.delete(hk);
      }
    }
  }
  Seat.free({ l35Now, l35Fresh, l35HandOn, l35Hinted });
  GifOS.meshRcdead = Object.freeze({ l35Now, l35Fresh, l35HandOn, l35Hinted });
  if (isNode) module.exports = GifOS.meshRcdead;
})(typeof window !== 'undefined' ? window : globalThis);
