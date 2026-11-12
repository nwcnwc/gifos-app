/*
 * hash.js: the mesh's 32-bit hashes and paired-id keys.
 *
 * Every hash and token in the mesh is 32 bits (an id pair key is two numbers, idPair): the FNV-1a 32 offset and
 * prime, and the murmur3 32-bit finalizer, in plain uint32 math
 * (Math.imul(a, b) >>> 0, (a ^ b) >>> 0, x >>> 16). A value wider than 32 bits
 * (a cell key or a tick, always below 2^53) goes in as its low word, then its
 * high word. A negative number gives the words of its 64-bit two's complement,
 * the same words a C++ (uint64_t) cast of a negative long long gives.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};

  // C++: mesh.cpp:H_INIT
  const H_INIT = 2166136261;
  const TWO32 = 4294967296;

  // C++: mesh.cpp:idPair  (IdP {a, b})
  // Two ids as one key, unpacked: a seat id is any integer below 2^52, so no pair of them fits one number.
  // The key is the string "a:b" (a Map key with C++'s equality); pairA / pairB read the halves back.
  function idPair(a, b) { return a + ':' + b; }
  function pairA(k) { return +k.slice(0, k.indexOf(':')); }
  function pairB(k) { return +k.slice(k.indexOf(':') + 1); }
  // C++: mesh.cpp:IdP::operator<  (each half as uint64_t: a negative id sorts after every other)
  function u64Cmp(x, y) { if ((x < 0) !== (y < 0)) return x < 0 ? 1 : -1; return x < y ? -1 : x > y ? 1 : 0; }
  function pairCmp(p, q) { return u64Cmp(pairA(p), pairA(q)) || u64Cmp(pairB(p), pairB(q)); }

  // C++: mesh.cpp:fmix32
  function fmix32(h) {
    h = h >>> 0;
    h = (h ^ (h >>> 16)) >>> 0; h = Math.imul(h, 0x85ebca6b) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h;
  }

  // C++: mesh.cpp:hmix
  function hmix(h, x) { return Math.imul((h ^ fmix32(x)) >>> 0, 16777619) >>> 0; }

  // The low and high 32-bit words of an integer below 2^53 in magnitude.
  function lo32(x) { return x >>> 0; }
  function hi32(x) { return Math.floor(x / TWO32) >>> 0; }

  // C++: mesh.cpp:hmix64
  function hmix64(h, x) { return hmix(hmix(h, lo32(x)), hi32(x)); }
  // C++: mesh.cpp:hmixId  (an id into a hash: its low, then its high 32-bit half)
  function hmixId(h, id) { return hmix64(h, id); }

  const api = Object.freeze({ H_INIT, idPair, pairA, pairB, pairCmp, fmix32, hmix, hmix64, hmixId, lo32, hi32 });
  GifOS.meshHash = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
