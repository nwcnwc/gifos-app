/*
 * rng.js: the seat's random stream.
 *
 * Every random choice a seat makes (a shuffle, a pick from a list) draws
 * from its own stream, so a room replays the same way from the same ids.
 * The generator is mulberry32: 32-bit state, integer math only
 * (Math.imul and >>> 0), one output in [0, 1) per draw.
 *
 * The stream is seeded from the seat's id: the FNV-1a hash of "p" followed
 * by the id as 8 decimal digits (zero padded), xor 0x9e3779b9. A string id
 * is hashed as it stands.
 *
 * Draw order is part of the behaviour: every call site draws in place, and
 * a draw whose result is not used still advances the stream.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const fnv = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('./fnv.js') : GifOS.meshFnv;

  const STEP = 0x6d2b79f5;

  // C++: mesh.cpp:Seat::Seat
  // The starting state for a seat id (an integer, or a string).
  function seedFor(id) {
    const text = typeof id === 'number' ? 'p' + String(id).padStart(8, '0') : String(id);
    return (fnv.str(text) ^ 0x9e3779b9) >>> 0;
  }

  // A stream from a 32-bit state. `state` is readable and writable
  // (for a snapshot or a restore).
  function create(seed) {
    const r = {
      state: seed >>> 0,
      // C++: mesh.cpp:Seat::rng
      // next float in [0, 1)
      next() {
        const s = r.state = (r.state + STEP) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), s | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      // integer in [0, n)
      int(n) { return Math.floor(r.next() * n); },
      // one of the items (null on an empty list; no draw is made then)
      pick(a) { return a.length ? a[Math.floor(r.next() * a.length)] : null; },
      // C++: mesh.cpp:Seat::shuf
      // Fisher-Yates in place, from the end
      shuffle(a) {
        for (let k = a.length - 1; k > 0; k--) {
          const j = Math.floor(r.next() * (k + 1));
          const tmp = a[k]; a[k] = a[j]; a[j] = tmp;
        }
        return a;
      },
    };
    return r;
  }

  // C++: mesh.cpp:grnd
  // C++: mesh.cpp:frnd
  // The fabric's streams (relay shuffle and spawn plan; net conditions): a 31-bit LCG,
  // s = (s * 1103515245 + 12345) & 0x7fffffff over uint32, one output s / 2^31 per draw.
  function lcg(seed) {
    const g = {
      state: seed >>> 0,
      next() { g.state = ((Math.imul(g.state, 1103515245) + 12345) & 0x7fffffff) >>> 0; return g.state / 2147483648; },
    };
    return g;
  }

  // C++: mesh_hostile.inc:mt19937
  // std::mt19937 (32-bit Mersenne Twister), raw draws only: next() is g() (a uint32).
  function mt19937(seed) {
    const mt = new Uint32Array(624); let idx = 624;
    mt[0] = seed >>> 0;
    for (let i = 1; i < 624; i++) { const p = mt[i - 1] ^ (mt[i - 1] >>> 30); mt[i] = (Math.imul(1812433253, p) + i) >>> 0; }
    function twist() {
      for (let i = 0; i < 624; i++) {
        const y = ((mt[i] & 0x80000000) | (mt[(i + 1) % 624] & 0x7fffffff)) >>> 0;
        mt[i] = (mt[(i + 397) % 624] ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0)) >>> 0;
      }
      idx = 0;
    }
    return {
      next() {
        if (idx >= 624) twist();
        let y = mt[idx++];
        y ^= y >>> 11; y = (y ^ ((y << 7) & 0x9d2c5680)) >>> 0; y = (y ^ ((y << 15) & 0xefc60000)) >>> 0; y ^= y >>> 18;
        return y >>> 0;
      },
    };
  }

  const api = Object.freeze({ seedFor, create, STEP, lcg, mt19937 });
  GifOS.meshRng = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
