/*
 * id.js: seat ids.
 *
 * In the harness an id is a non-negative integer and -1 means "none"; ties
 * between seats break by the lower id. Every arithmetic use of an id goes
 * through here, so a page can swap in string ids with the same order:
 *   pair(a, b)  one key for an ordered pair of ids (the sim's idPair)
 *   less(a, b)  the tie-break order
 *   seed(id)    the seat's random-stream seed (rng.js seedFor: FNV-1a of "p%08d")
 * Other id arithmetic in the seat code (a token, a mix) is listed where it is ported.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const hash = isNode ? require('./hash.js') : GifOS.meshHash;
  const rng = isNode ? require('./rng.js') : GifOS.meshRng;

  const NONE = -1;
  // C++: mesh.cpp:idPair
  const pair = hash.idPair;
  function less(a, b) { return a < b; }
  // C++: mesh.cpp:Seat::Seat
  const seed = rng.seedFor;

  const api = Object.freeze({ NONE, pair, less, seed });
  GifOS.meshId = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
