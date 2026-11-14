/*
 * roles.js: law L2, the row's owner, heir and backup owner.
 *
 * Functions of a row and of an occupancy view, never stored cells. `occ` is
 * any function (Coord) -> bool: "is this cell occupied" in the caller's view;
 * fullRow (every cell occupied) gives the pure topology. Each returns the
 * Coord it finds, or null (the C++ fills an out-parameter and returns bool).
 *
 *   ownerOf(row)            the cell whose down-child is the row's head (deep rows only)
 *   heirOf(row, occ)        the lowest-column seat of the row that is not the head (L2.1)
 *   backupOwnerOf(row, occ) the owner's right-neighbour over columns 1..C-1, cyclic,
 *                           never the owner; an owner alone passes the role up (L2.2, L2.2b);
 *                           a Section-1 owner alone goes on over its rook links: down its
 *                           column, then its row's head (L2.2c)
 *   standbyOf(row, occ)     the backup owner's right-neighbour by the same walk (L2.6)
 *   e2SrcOf(row, occ)       the seat of the row that holds E2: the heir, or a lone head (L2.1b)
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const topo = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('./topo.js') : GifOS.meshTopo;
  const { C, parentPath, lastDigit, childPath, ckey, up, down } = topo;

  // C++: roles.h:fullRow
  function fullRow() { return true; }

  // C++: roles.h:ownerOf
  function ownerOf(row) {
    if (row.pc === 0) return null;
    return { pc: parentPath(row.pc), r: row.r, i: lastDigit(row.pc) & 0xff };
  }

  // C++: roles.h:heirOf
  function heirOf(row, occ) {
    if (row.pc === 0) return null;
    for (let j = 1; j < C; j++) { const c = { pc: row.pc, r: row.r, i: j }; if (occ(c)) return c; }
    return null;
  }

  // C++: roles.h:rightWalk
  // The walk over columns 1..C-1 from `start`, cyclic, skipping columns skipA and skipB.
  function rightWalk(base, start, skipA, skipB, occ) {
    if (C < 2) return null;
    for (let s = 0; s < C - 1; s++) {
      const j = 1 + ((start - 1 + s) % (C - 1)); if (j === skipA || j === skipB) continue;
      const c = { pc: base.pc, r: base.r, i: j }; if (occ(c)) return c;
    }
    return null;
  }

  // C++: roles.h:backupOwnerOf
  function backupOwnerOf(row, occ) {
    const o = ownerOf(row); if (!o) return null;
    const j0 = o.i < C - 1 ? o.i + 1 : 1;
    const b = rightWalk(o, j0, o.i, -1, occ); if (b) return b;
    // L2.2b: the owner sits alone in its row: land on the owner row's own backup owner.
    if (o.pc !== 0) return backupOwnerOf({ pc: o.pc, r: o.r, i: 0 }, occ);
    // L2.2c: a Section-1 owner has no row above it. Its links are the rook: the walk goes on over them, down its column
    // (the next occupied row, cyclic: a seat of another row, so one row's leave never takes both ways up), then to its
    // own row's head (in Section 1 a head is a rook seat like any other: no path up runs through it).
    for (let s = 1; s < C; s++) { const c = { pc: 0, r: (o.r + s) % C, i: o.i }; if (occ(c)) return c; }
    if (o.i !== 0) { const c = { pc: 0, r: o.r, i: 0 }; if (occ(c)) return c; }
    return null;
  }

  // C++: roles.h:standbyOf
  function standbyOf(row, occ) {
    const o = ownerOf(row); if (!o) return null;
    const b = backupOwnerOf(row, occ); if (!b) return null;
    const j0 = b.i < C - 1 ? b.i + 1 : 1;
    return rightWalk(o, j0, o.i, b.i, occ);
  }

  // C++: roles.h:e2SrcOf
  function e2SrcOf(row, occ) {
    if (row.pc === 0) return null;
    const h = heirOf(row, occ); if (h) return h;
    const hd = { pc: row.pc, r: row.r, i: 0 }; if (occ(hd)) return hd;
    return null;
  }

  // C++: roles.h:EdgeCls
  const E_ROW = 0, E_COL = 1, E_UP = 2, E_DOWN = 3, E_UP2 = 4, E_DOWN2 = 5;
  // C++: roles.h:MAXLINKS_E
  const MAXLINKS_E = 2 * C + 1;

  // C++: roles.h:ownedLinksE
  // Returns {out: [Coord], cls: [EdgeCls]} in the C++ order.
  function ownedLinksE(s, l2) {
    const out = [], cls = [];
    for (let j = 0; j < C; j++) if (j !== s.i) { out.push({ pc: s.pc, r: s.r, i: j }); cls.push(E_ROW); }
    if (s.pc === 0) { for (let j = 0; j < C; j++) if (j !== s.r) { out.push({ pc: s.pc, r: j, i: s.i }); cls.push(E_COL); } }
    else {
      let x;
      if ((x = up(s))) { out.push(x); cls.push(E_UP); }
    }
    out.push(down(s)); cls.push(E_DOWN);
    if (!l2) return { out, cls };
    const row = { pc: s.pc, r: s.r, i: 0 };
    let src, b;
    if ((src = e2SrcOf(row, fullRow)) && ckey(src) === ckey(s) && (b = backupOwnerOf(row, fullRow))) { out.push(b); cls.push(E_UP2); }
    if (s.i !== 0) for (let d = 0; d < C; d++) {
      const cr = { pc: childPath(s.pc, d), r: s.r, i: 0 };
      if ((b = backupOwnerOf(cr, fullRow)) && ckey(b) === ckey(s) && (src = e2SrcOf(cr, fullRow))) { out.push(src); cls.push(E_DOWN2); }
    }
    if (s.i !== 0 && s.pc === 0) for (let r = 0; r < C; r++) if (r !== s.r) {   // L2.2c: the rows of my column's owners (in the full topology only where a row has no third column, C=2)
      const cr = { pc: childPath(0, s.i), r, i: 0 };
      if ((b = backupOwnerOf(cr, fullRow)) && ckey(b) === ckey(s) && (src = e2SrcOf(cr, fullRow))) { out.push(src); cls.push(E_DOWN2); }
    }
    return { out, cls };
  }

  const api = Object.freeze({
    fullRow, ownerOf, heirOf, rightWalk, backupOwnerOf, standbyOf, e2SrcOf,
    E_ROW, E_COL, E_UP, E_DOWN, E_UP2, E_DOWN2, MAXLINKS_E, ownedLinksE,
  });
  GifOS.meshRoles = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
