/*
 * topo.js: the mesh topology as integer arithmetic.
 *
 * A cell is a Coord {pc, r, i}: pc is the section path as an integer, r the
 * row (0..C-1), i the column (0..C-1). The path of the home section is 0;
 * appending digit d (0..C-1) gives pc*6 + d + 1, wrapping as uint32.
 *
 * A cell key is one number: pc*65536 + r*256 + i (below 2^48). Read its parts
 * with ckPc / ckR / ckI, never with >> (JS shifts cut to 32 bits).
 *
 * Coords are plain objects. A C++ copy (Coord x = y) is cc(y) here; a function
 * that fills a C++ out-parameter and returns bool returns the Coord or null.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};

  // C++: topo.h:C
  const C = 5;
  // C++: topo.h:MAXLINKS
  const MAXLINKS = 2 * C - 1;
  // C++: topo.h:TOPO_XDROP
  const TOPO_XDROP = true;
  // C++: topo.h:NO_CK
  const NO_CK = 2 ** 53 - 1;   // a ckey sentinel that is no cell (ckeys are < 2^48), a plain JS number

  // C++: topo.h:Coord
  function coord(pc, r, i) { return { pc: pc >>> 0, r: r & 0xff, i: i & 0xff }; }
  function cc(c) { return { pc: c.pc, r: c.r, i: c.i }; }
  function same(a, b) { return a.pc === b.pc && a.r === b.r && a.i === b.i; }

  // C++: topo.h:ckey
  function ckey(c) { return c.pc * 65536 + c.r * 256 + c.i; }
  // The parts of a cell key: C++ (k>>16), ((k>>8)&0xff), (k&0xff).
  function ckPc(k) { return Math.floor(k / 65536); }
  function ckR(k) { return (k >>> 8) & 0xff; }
  function ckI(k) { return k & 0xff; }
  // C++ Coord{(uint32_t)(k>>16),(uint8_t)((k>>8)&0xff),(uint8_t)(k&0xff)}
  function unckey(k) { return { pc: ckPc(k) >>> 0, r: ckR(k), i: ckI(k) }; }

  // C++: topo.h:isRoot
  function isRoot(c) { return c.pc === 0; }
  // C++: topo.h:childPath
  function childPath(pc, d) { return (Math.imul(pc, 6) + (d + 1)) >>> 0; }
  // C++: topo.h:parentPath
  function parentPath(pc) { return Math.floor(((pc - 1) >>> 0) / 6); }
  // C++: topo.h:pcDepth
  function pcDepth(pc) { let d = 0; while (pc) { pc = parentPath(pc); d++; } return d; }
  // C++: topo.h:lastDigit
  function lastDigit(pc) { return ((pc - 1) >>> 0) % 6; }

  // C++: topo.h:up
  function up(s) {
    if (s.i !== 0) return null;
    if (s.pc === 0) return null;
    return { pc: parentPath(s.pc), r: s.r, i: lastDigit(s.pc) & 0xff };
  }
  // C++: topo.h:down
  function down(s) { return { pc: childPath(s.pc, s.i), r: s.r, i: 0 }; }
  // C++: topo.h:crossLink
  function crossLink(s) {
    if (s.i === 0) return null;
    if (s.r === s.i) return { pc: s.pc, r: 0, i: s.i };
    if (s.r === 0) return { pc: s.pc, r: s.i, i: s.i };
    return { pc: s.pc, r: s.i, i: s.r };
  }
  // C++: topo.h:rowMates
  function rowMates(s) { const out = []; for (let j = 0; j < C; j++) if (j !== s.i) out.push({ pc: s.pc, r: s.r, i: j }); return out; }
  // C++: topo.h:colMates
  function colMates(s) { const out = []; for (let j = 0; j < C; j++) if (j !== s.r) out.push({ pc: s.pc, r: j, i: s.i }); return out; }
  // C++: topo.h:ownedLinks
  function ownedLinks(s) {
    const out = [];
    for (let j = 0; j < C; j++) if (j !== s.i) out.push({ pc: s.pc, r: s.r, i: j });
    if (s.pc === 0) { for (let j = 0; j < C; j++) if (j !== s.r) out.push({ pc: s.pc, r: j, i: s.i }); out.push(down(s)); return out; }
    let x;
    if (!TOPO_XDROP && (x = crossLink(s))) out.push(x);
    if ((x = up(s))) out.push(x);
    out.push(down(s));
    return out;
  }

  const api = Object.freeze({
    C, MAXLINKS, TOPO_XDROP, NO_CK,
    coord, cc, same, ckey, ckPc, ckR, ckI, unckey,
    isRoot, childPath, parentPath, pcDepth, lastDigit,
    up, down, crossLink, rowMates, colMates, ownedLinks,
  });
  GifOS.meshTopo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
