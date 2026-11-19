/*
 * util.js: the few container idioms the C++ seat code uses, as JS Map / Set / Array calls.
 *
 * The sim's maps and sets are insertion-ordered with JS Map / Set semantics (omap.h), so the port uses
 * Map and Set directly. Only C++ idioms with no one-call JS form live here:
 *   ins(m, k, mk)    C++ m[k] (operator[]): the value at k, inserting mk() at the end when k is missing.
 *                    A read through [] inserts too, and the port writes ins() there, never get().
 *   eraseFirst(m)    C++ m.erase(m.begin()) on a Map or Set
 *   firstKey(m)      C++ m.begin()->first (undefined when empty)
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};

  // C++: omap.h:operator
  function ins(m, k, mk) {
    if (m.has(k)) return m.get(k);
    const v = mk(); m.set(k, v); return v;
  }
  // C++: omap.h:erase
  function eraseFirst(m) { for (const k of m.keys()) { m.delete(k); return; } }
  // C++: omap.h:begin
  function firstKey(m) { for (const k of m.keys()) return k; return undefined; }

  const api = Object.freeze({ ins, eraseFirst, firstKey });
  GifOS.meshUtil = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
