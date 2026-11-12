/*
 * fmt.js: the text of a trace line's detail.
 *
 * The seat formats a trace detail as the C++ trace() does: a printf subset
 * (%d, %u, %lld, %zu, %llx, %s, %%) written into a 256-byte buffer, so the
 * text stops at 255 bytes. %d is a C int (a bool prints 1 or 0), %u its
 * unsigned reading, %lld and %zu a whole number, %llx the lowercase hex of
 * a 64-bit value. Any other conversion throws: a port must not guess.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};

  // C++: mesh.cpp:trace
  const MAX = 255;   // vsnprintf into char[256]

  function hex64(v) {
    if (Number.isSafeInteger(v) && v >= 0) return v.toString(16);
    return BigInt.asUintN(64, BigInt(Math.trunc(Number(v)))).toString(16);
  }

  function sprintf(fmt, ...args) {
    let out = '', a = 0;
    for (let i = 0; i < fmt.length; i++) {
      const ch = fmt[i];
      if (ch !== '%') { out += ch; continue; }
      const m = /^(%|d|u|lld|llu|zu|llx|s)/.exec(fmt.slice(i + 1));
      if (!m) throw new Error('fmt: unsupported conversion in ' + JSON.stringify(fmt));
      const spec = m[1]; i += spec.length;
      if (spec === '%') { out += '%'; continue; }
      const v = args[a++];
      switch (spec) {
        case 'd': out += String(Number(v) | 0); break;
        case 'u': out += String(Number(v) >>> 0); break;
        case 'lld': case 'llu': case 'zu': out += String(Math.trunc(Number(v))); break;
        case 'llx': out += hex64(v); break;
        case 's': out += String(v); break;
      }
    }
    // Every trace text is ASCII (numbers and the seat's own why-names), so a byte is a character.
    return out.length <= MAX ? out : out.slice(0, MAX);
  }

  const api = Object.freeze({ sprintf, MAX });
  GifOS.meshFmt = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
