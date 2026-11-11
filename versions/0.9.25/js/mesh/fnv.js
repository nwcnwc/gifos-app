/*
 * fnv.js: FNV-1a over 32 bits, the mesh's small string hash.
 *
 * Used to seed a seat's random stream from its id and to fingerprint a
 * seat's state in the DEBUG trace. Plain uint32 math: the bytes are the
 * UTF-8 encoding of the string, `h ^= byte; h = imul(h, 16777619) >>> 0`.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const OFFSET = 2166136261, PRIME = 16777619;

  // Hash raw bytes (a Uint8Array or Buffer).
  function bytes(b) {
    let h = OFFSET;
    for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, PRIME) >>> 0; }
    return h >>> 0;
  }

  // Hash a string over its UTF-8 bytes.
  function str(s) { return bytes(new TextEncoder().encode(s)); }

  const api = Object.freeze({ bytes, str });
  GifOS.meshFnv = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
