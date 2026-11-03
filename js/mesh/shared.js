/*
 * shared.js: the small C++ free functions more than one unit calls, written once.
 * Registered with Seat.free (so FREE.cellOk(...) works for units that only see the seat) and exported for
 * units that require this file. C1 (seat.js) holds no copy of these.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  const { Seat } = req('./seat.js', 'meshSeat');
  const C_ = req('./consts.js', 'meshConsts');
  const topo = req('./topo.js', 'meshTopo');
  const hash = req('./hash.js', 'meshHash');
  const E = C_.enums;
  const { unckey, up, lastDigit, parentPath } = topo;
  const C = topo.C;

  // C++: mesh_seat.inc:cellOk
  function cellOk(k) {
    const c = unckey(k); if (c.r >= C || c.i >= C) return false;
    let pc = c.pc, d = 0;
    while (pc) { if (lastDigit(pc) >= C) return false; pc = parentPath(pc); if (++d > 12) return false; }
    return true;
  }
  // C++: mesh_seat.inc:ownerCoordOf
  // (the bool + out-parameter form: the owner coord, or null)
  function ownerCoordOf(c) { if (c.pc === 0) return null; return up({ pc: c.pc, r: c.r, i: 0 }); }
  // C++: mesh.cpp:coordStr
  function coordStr(c) {
    let p = ''; let pc = c.pc; const d = [];
    while (pc) { d.push(lastDigit(pc)); pc = parentPath(pc); }
    for (let a = d.length - 1; a >= 0; a--) p += String.fromCharCode(48 + d[a]);
    return p + '/' + c.r + '.' + c.i;
  }
  // C++: mesh.cpp:l4Pack
  function l4Pack(t, n) { return ((n & 0xff) << 8 | (t & 0xff)) & 0xffff; }
  // C++: mesh.cpp:l4Meet
  function l4Meet(a, b) { return a !== E.NAT_BLOCKED && b !== E.NAT_BLOCKED && !(a === E.NAT_STRICT && b === E.NAT_STRICT); }
  // C++: mesh.cpp:fabricToken
  // lv: the world's levers (SEED0 is a lever here, a global in C++)
  function fabricToken(lv, id) { return (hash.fmix32(hash.hmix(hash.hmix((hash.H_INIT ^ 0x72636c) >>> 0, lv.SEED0 >>> 0), id >>> 0)) | 1) >>> 0; }

  // U2Row key: C++ ckey(row)*2 + variant flag (< 2^49, a plain JS number). C++: mesh_seat.inc:Seat::onU2
  const u2RowKey = (rowCk, tag3) => rowCk * 2 + (tag3 ? 1 : 0);
  // the old bit-62 flag test ((key>>62)&1); l2Around tests the re-keyed flag (key&1) since sim cbef32d8d. Kept for callers.
  const u2RowTag3 = (key) => Math.floor(key / 2 ** 62) & 1;
  // C++ unck(key>>1)
  const u2RowCell = (key) => unckey(Math.floor(key / 2));

  Seat.free({ cellOk, ownerCoordOf, coordStr, l4Pack, l4Meet, fabricToken, u2RowKey, u2RowTag3, u2RowCell });
  const api = Object.freeze({ cellOk, ownerCoordOf, coordStr, l4Pack, l4Meet, fabricToken, u2RowKey, u2RowTag3, u2RowCell });
  GifOS.meshShared = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
