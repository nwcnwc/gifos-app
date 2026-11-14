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
 *   backupOwnerOf(row, occ) the first occupied seat of the owner's walk (ownerWalk): its
 *                           right-neighbour over columns 1..C-1, cyclic, never the owner
 *                           (L2.2); an owner alone passes the role up (L2.2b); a Section-1
 *                           owner goes on over its rook links: its column, then its row's
 *                           head (L2.2c)
 *   standbyOf(row, occ)     the next occupied seat of the same walk (L2.6, L2.2d)
 *   onOwnerWalk(row, me)    is `me` a seat the row's owner could name, by structure alone:
 *                           the far end serves on the owner's word (L2.2d)
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

  // C++: roles.h:ownerWalk
  // The owner's walk (L2.2, L2.2b, L2.2c, L2.2d): the seats an owner names, in order, as its child row's second and
  // third way up. Columns 1..C-1 of the owner's row from its right neighbour, cyclic, never the owner and never
  // column 0. A deep owner's walk then passes up to the walk of its own row's owner (L2.2b); a Section-1 owner's goes
  // on over its rook links: down its column, then its row's head (L2.2c). nth picks the nth occupied seat (0 the
  // backup owner, 1 the standby); up false stops a deep owner's walk at its own row.
  function ownerWalk(o, occ, nth, up = true) {
    if (C < 2) return null;
    for (let g = 0; g < 64; g++) {
      const j0 = o.i < C - 1 ? o.i + 1 : 1;
      for (let s = 0; s < C - 1; s++) { const j = 1 + ((j0 - 1 + s) % (C - 1)); if (j === o.i) continue; const c = { pc: o.pc, r: o.r, i: j }; if (occ(c) && nth-- === 0) return c; }
      if (o.pc === 0) {
        for (let s = 1; s < C; s++) { const c = { pc: 0, r: (o.r + s) % C, i: o.i }; if (occ(c) && nth-- === 0) return c; }
        if (o.i !== 0) { const c = { pc: 0, r: o.r, i: 0 }; if (occ(c) && nth-- === 0) return c; }
        return null;
      }
      const oo = up ? ownerOf({ pc: o.pc, r: o.r, i: 0 }) : null; if (!oo) return null; o = oo;
    }
    return null;
  }

  // C++: roles.h:backupOwnerOf
  function backupOwnerOf(row, occ) { const o = ownerOf(row); return o ? ownerWalk(o, occ, 0) : null; }

  // C++: roles.h:standbyOf
  // L2.6, L2.2d: the standby is the next occupied seat of the same walk.
  function standbyOf(row, occ) { const o = ownerOf(row); return o ? ownerWalk(o, occ, 1) : null; }

  // C++: roles.h:onOwnerWalk
  // L2.2d: is `me` a seat an owner of this row could name, by structure alone (no view)?
  function onOwnerWalk(row, me) {
    let o = ownerOf(row); if (!o) return false;
    for (let g = 0; g < 64; g++) {
      if (ckey(me) === ckey(o)) return false;
      if (o.pc === 0) return me.pc === 0 && (me.r === o.r || me.i === o.i);
      if (me.pc === o.pc && me.r === o.r && me.i !== 0) return true;
      const oo = ownerOf({ pc: o.pc, r: o.r, i: 0 }); if (!oo) return false; o = oo;
    }
    return false;
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
    fullRow, ownerOf, heirOf, ownerWalk, onOwnerWalk, backupOwnerOf, standbyOf, e2SrcOf,
    E_ROW, E_COL, E_UP, E_DOWN, E_UP2, E_DOWN2, MAXLINKS_E, ownedLinksE,
  });
  GifOS.meshRoles = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
