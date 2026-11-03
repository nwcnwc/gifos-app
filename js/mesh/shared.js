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

  // U2Row key: C++ ckey(row) | (tag3 << 62); a JS number cannot hold bit 62, so the tag bit is 2^52 (ckey < 2^48).
  // SIM CHANGE NEEDED: key the sim's U2Row the same way (or by a pair); set the flag to whatever portsim lands.
  const U2_TAG3 = 2 ** 52;
  const u2RowKey = (rowCk, tag3) => rowCk + (tag3 ? U2_TAG3 : 0);
  const u2RowTag3 = (key) => key >= U2_TAG3;
  const u2RowCell = (key) => unckey(key >= U2_TAG3 ? key - U2_TAG3 : key);

  Seat.free({ cellOk, ownerCoordOf, coordStr, l4Pack, l4Meet, fabricToken, u2RowKey, u2RowTag3, u2RowCell });
  const api = Object.freeze({ cellOk, ownerCoordOf, coordStr, l4Pack, l4Meet, fabricToken, u2RowKey, u2RowTag3, u2RowCell });
  GifOS.meshShared = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
