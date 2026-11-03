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

  const api = Object.freeze({ seedFor, create, STEP });
  GifOS.meshRng = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
