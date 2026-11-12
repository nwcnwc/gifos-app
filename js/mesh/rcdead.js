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
  // The sim's build-time law switches (-DL35_4_OFF=1 ...: the parent's laws, byte for byte) are environment variables
  // under node (MESH_L35_4_OFF=1 ...), read once at load; a page always runs the laws.
  const envOff = (n) => ((isNode && typeof process !== 'undefined' && process.env && process.env['MESH_' + n] === '1') ? 1 : 0);
  const L35_4_OFF = envOff('L35_4_OFF'), L17_3_1_OFF = envOff('L17_3_1_OFF'), L17_4_OFF = envOff('L17_4_OFF'), L35_5_OFF = envOff('L35_5_OFF');
  const topo = req('./topo.js', 'meshTopo'); const { ckey, down } = topo;
  // C++: mesh_rcdead.inc:l354Echo
  function l354Echo(s, k, v) {
    const b = s.byeIds.get(v); if (b === undefined) return false;
    const lb = s.liveBy.get(k), lv = s.live.get(k);
    if (lb !== undefined && lb === v && lv !== undefined && lv > b) return false;   // heard there first-hand since: it came back
    return true;
  }
  // C++: mesh_rcdead.inc:l1731Note
  function l1731Note(s, pk, k, v) {
    if (!s.hasCoord || s.coord.i === 0 || v < 0 || v === s.id || k === ckey(s.coord)) return;
    if (pk !== ckey({ pc: s.coord.pc, r: s.coord.r, i: 0 })) return;   // my row head's own PONG
    s.l1731Vouch.set(v, l35Now(s));
    if (s.l1731Vouch.size > 2 * topo.C) {
      for (const hk of [...s.l1731Vouch.keys()]) { let named = false; for (const ov of s.occ.values()) if (ov === hk) { named = true; break; } if (!named) s.l1731Vouch.delete(hk); }
    }
  }
  // C++: mesh_rcdead.inc:l1731Word
  function l1731Word(s, x, g) { const it = s.l1731Vouch.get(x); return it !== undefined && it > g; }
  // C++: mesh_rcdead.inc:l355Heard
  function l355Heard(s, k, x) {
    const now = l35Now(s);
    { const lv = s.live.get(k), lb = s.liveBy.get(k); if (lv !== undefined && lb !== undefined && lb === x && now - lv <= K.LEASE_T) return true; }
    { const pb = s.pongBy.get(k); if (pb !== undefined && pb[0] === x && now - pb[1] <= K.LEASE_T) return true; }
    return false;
  }
  // C++: mesh_rcdead.inc:l355On
  function l355On(s, k, x) { if (L35_5_OFF) return true; return l35Fresh(s, k, x) || l355Heard(s, k, x); }
  // C++: mesh_rcdead.inc:l355Heir
  function l355Heir(s, k) {
    const c = s.childOf.get(k); if (c === undefined) return -1; if (L35_5_OFF) return c;
    const o = s.occGet(k); if ((o >= 0 && l355Heard(s, k, o)) || s.l13HeirOk(k)) return c; return -1;
  }
  // C++: mesh_rcdead.inc:l355Kid
  function l355Kid(s) { const dk = ckey(down(s.coord)); const x = s.occGet(dk); if (L35_5_OFF || x < 0) return x; return l355Heard(s, dk, x) ? x : -1; }
  Seat.unit('mesh_rcdead.inc', {
    // C++: mesh_rcdead.inc:Seat::noteHand
    noteHand(ck, v) { if (L35_5_OFF) { this.noteS1(ck); return; } if (ck < 65536) { const t = l35Now(this); this.s1seen.set(ck, t); this.s1told.set(ck, t); } l35Hinted(this, ck, v); },
  });
  Seat.free({ l35Now, l35Fresh, l35HandOn, l35Hinted, l354Echo, l1731Note, l1731Word, l355Heard, l355On, l355Heir, l355Kid });
  GifOS.meshRcdead = Object.freeze({ l35Now, l35Fresh, l35HandOn, l35Hinted, l354Echo, l1731Note, l1731Word, l355Heard, l355On, l355Heir, l355Kid, L35_4_OFF, L17_3_1_OFF, L17_4_OFF, L35_5_OFF });
  if (isNode) module.exports = GifOS.meshRcdead;
})(typeof window !== 'undefined' ? window : globalThis);
