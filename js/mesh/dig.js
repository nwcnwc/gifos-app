/*
 * dig.js: the rollup digest's list and fold helpers (healing-laws § G, G9, L6.2, L27).
 *
 * A digest (Dig) is a fixed-size summary of a scope, folded along the up and
 * down links. Its structs (LE, VE, KStmt, Dig) are the plain objects of msg.js.
 * The C++ copies these structs by value; here every copy is explicit (cloneLE,
 * cloneVE, cloneKStmt, cloneDig), and a struct pushed from one list into
 * another is always a copy, so a later in-place sum never reaches the source.
 * Every sort is stable (Array.prototype.sort), as the sim's std::stable_sort.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  if (isNode) require('./laws.js');
  const LAWS = GifOS.meshLaws;
  const msg = isNode ? require('./msg.js') : GifOS.meshMsg;
  const hash = isNode ? require('./hash.js') : GifOS.meshHash;
  const topo = isNode ? require('./topo.js') : GifOS.meshTopo;
  const { H_INIT, hmix64 } = hash;
  const { newDig, newKStmt } = msg;
  const C = topo.C;

  // C++: mesh.cpp:K_HAND
  const K_HAND = LAWS.K_HAND, K_STAGE = LAWS.K_STAGE_PER_C * C, K_APP = LAWS.K_APP, K_VOTE = LAWS.K_VOTE;
  // C++: mesh.cpp:STAGE_CAP
  const STAGE_CAP = LAWS.STAGE_CAP;
  // C++: mesh.cpp:TALK_ON
  const TALK_ON = LAWS.TALK_ON;
  // C++: mesh.cpp:TALK_HOLD
  const TALK_HOLD = LAWS.TALK_HOLD;
  // C++: mesh.cpp:K_TALK
  const K_TALK = STAGE_CAP;

  const cloneLE = (e) => ({ id: e.id, k: e.k, f: e.f });
  const cloneVE = (v) => ({ tgt: v.tgt, up: v.up, dn: v.dn });
  // C++: mesh.cpp:KStmt
  const cloneKStmt = (k) => ({ voter: k.voter, signer: k.signer, tn: k.tn, ver: k.ver, ck: k.ck, good: k.good, all: k.all, yes: k.yes.slice(), abs: k.abs.slice() });
  // C++: mesh.cpp:DRow
  // L48 (e2fold): one row's report as a fold carried it (k: the row, at/by: its stamp, ag: its age, n/leased: the seats it put in).
  const cloneDRow = (r) => ({ k: r.k, at: r.at, by: r.by, ag: r.ag, n: r.n, leased: r.leased, handN: r.handN, e2: r.e2,
    hands: r.hands.map(cloneLE), stage: r.stage.map(cloneLE), apps: r.apps.map(cloneLE), talk: r.talk.map(cloneLE) });
  // C++: mesh.cpp:Dig
  function cloneDig(d) {
    return {
      n: d.n, refuse: d.refuse, freeC: d.freeC, at: d.at, by: d.by, dmin: d.dmin, ag: d.ag, rx: d.rx, part: d.part,
      leased: d.leased, handN: d.handN, awayN: d.awayN,
      hands: d.hands.map(cloneLE), stage: d.stage.map(cloneLE), apps: d.apps.map(cloneLE), votes: d.votes.map(cloneVE),
      talk: d.talk.map(cloneLE), kick: d.kick.map(cloneVE), kabs: d.kabs, kOwn: cloneKStmt(d.kOwn), kl: d.kl.map(cloneKStmt),
      rows: d.rows.map(cloneDRow),
    };
  }
  // C++: mesh.cpp:DigE
  const cloneDigE = (e) => ({ k: e.k, d: cloneDig(e.d) });
  const leEq = (a, b) => a.id === b.id && a.k === b.k && a.f === b.f;
  const veEq = (a, b) => a.tgt === b.tgt && a.up === b.up && a.dn === b.dn;

  // A strict-weak "less" as an Array.prototype.sort comparator (stable, as std::stable_sort).
  const byLess = (less) => (a, b) => (less(a, b) ? -1 : less(b, a) ? 1 : 0);

  // C++: mesh.cpp:leAsc
  function leAsc(a, b) { return a.k !== b.k ? a.k < b.k : a.id < b.id; }   // earliest first (hands, stage claims)
  // C++: mesh.cpp:leDesc
  function leDesc(a, b) { return a.k !== b.k ? a.k > b.k : a.id < b.id; }  // newest first (app ads)

  // C++: mesh.cpp:talkCls
  function talkCls(e) { return (e.f & 1) ? 0 : (e.f & 2) ? 1 : 2; }
  // C++: mesh.cpp:talkLess
  function talkLess(a, b) { const ca = talkCls(a), cb = talkCls(b); if (ca !== cb) return ca < cb; if (a.k !== b.k) return ca < 2 ? a.k < b.k : a.k > b.k; return a.id < b.id; }
  // C++: mesh.cpp:talkMerge
  function talkMerge(dst, src) {
    if (!src.length) return;
    for (const e of src) dst.push(cloneLE(e));
    dst.sort(byLess(talkLess));
    const out = [], seen = new Set();
    for (const e of dst) { if (out.length >= K_TALK) break; if (!seen.has(e.id)) { seen.add(e.id); out.push(e); } }
    dst.length = 0; for (const e of out) dst.push(e);
  }
  // C++: mesh.cpp:veOrd
  function veOrd(a, b) { const ta = a.up + a.dn, tb = b.up + b.dn; return ta !== tb ? ta > tb : a.tgt < b.tgt; }
  // C++: mesh.cpp:listMerge
  // top-K of the union, one entry per author (its best-ranked entry)
  function listMerge(dst, src, K, asc) {
    if (!src.length) return;
    for (const e of src) dst.push(cloneLE(e));
    dst.sort(byLess(asc ? leAsc : leDesc));
    const out = [], seen = new Set();
    for (const e of dst) { if (out.length >= K) break; if (!seen.has(e.id)) { seen.add(e.id); out.push(e); } }
    dst.length = 0; for (const e of out) dst.push(e);
  }
  // C++: mesh.cpp:kOrd
  function kOrd(a, b) { return a.up !== b.up ? a.up > b.up : (a.dn !== b.dn ? a.dn > b.dn : a.tgt < b.tgt); }   // L27: most yes first
  // C++: mesh.cpp:kickAdd
  // L27: sum per target, each input clamped to the seats it speaks for (cap < 0: no clamp)
  function kickAdd(acc, src, cap) {
    for (const v of src) {
      const c = cloneVE(v); if (cap >= 0) { if (c.up > cap) c.up = cap; if (c.dn > cap) c.dn = cap; }
      let hit = false; for (const a of acc) if (a.tgt === c.tgt) { a.up += c.up; a.dn += c.dn; hit = true; break; }
      if (!hit) acc.push(c);
    }
  }
  // C++: mesh.cpp:kSigOk
  function kSigOk(k) { return k.voter >= 0 && k.good && k.signer === k.voter; }
  // C++: mesh.cpp:kListAdd
  function kListAdd(dst, k) {
    if (!kSigOk(k)) return;
    for (let i = 0; i < dst.length; i++) if (dst[i].voter === k.voter) { if (k.ver > dst[i].ver) dst[i] = cloneKStmt(k); return; }
    dst.push(cloneKStmt(k));
  }
  // C++: mesh.cpp:kListUnion
  function kListUnion(dst, src, cap) { let n = 0; for (const k of src) { if (cap >= 0 && n >= cap) break; if (!kSigOk(k)) continue; kListAdd(dst, k); n++; } }
  // C++: mesh.cpp:kDerive
  function kDerive(d) {   // the counts are the list's
    if (!d.kl.length && !d.kick.length && !d.kabs) return;
    d.kick.length = 0; d.kabs = 0;
    for (const k of d.kl) {
      if (k.all) { d.kabs++; continue; }
      for (const t of k.yes) if (t !== k.voter) kickAdd(d.kick, [{ tgt: t, up: 1, dn: 0 }], -1);
      for (const t of k.abs) if (t !== k.voter) kickAdd(d.kick, [{ tgt: t, up: 0, dn: 1 }], -1);
    }
  }
  // C++: mesh.cpp:voteAdd
  function voteAdd(acc, src) {   // untruncated within a level: digTrim cuts once
    for (const v of src) { let hit = false; for (const a of acc) if (a.tgt === v.tgt) { a.up += v.up; a.dn += v.dn; hit = true; break; } if (!hit) acc.push(cloneVE(v)); }
  }
  // C++: mesh.cpp:digSeats
  // L48: the seats a report speaks for, n + leased, never below 0 (a fold that dropped an older copy of a row can hold a
  // negative leased). Equal to the parent's clamp for leased >= 0.
  function digSeats(d) { const n = d.n < 0 ? 0 : d.n; const t = n + d.leased; return t < 0 ? 0 : t; }
  // C++: mesh.cpp:digLeasedIn
  function digLeasedIn(s) { const n = s.n < 0 ? 0 : s.n; return s.leased < -n ? -n : s.leased; }
  // C++: mesh.cpp:digFoldHeld
  // L3.12: a report held past DIG_TTL under its lease (its seats count as leased, its lists are kept).
  function digFoldHeld(dst, s) {
    // C++ copies s into z and zeroes its counts; only z.handN and z.awayN are read after.
    const z = { handN: 0, awayN: 0 };
    z.handN = Math.min(s.handN, digSeats(s)); z.awayN = Math.min(s.awayN, digSeats(s));
    const seats = digSeats(s);
    dst.leased += seats; dst.handN += z.handN; dst.awayN += z.awayN;
    listMerge(dst.hands, s.hands, K_HAND, true); listMerge(dst.stage, s.stage, K_STAGE, true); listMerge(dst.apps, s.apps, K_APP, false); talkMerge(dst.talk, s.talk);
    const cap = digSeats(s);
    for (const v of s.votes) {
      const c = cloneVE(v); if (c.up > cap) c.up = cap; if (c.dn > cap) c.dn = cap;
      let hit = false; for (const a of dst.votes) if (a.tgt === c.tgt) { a.up += c.up; a.dn += c.dn; hit = true; break; }
      if (!hit) dst.votes.push(c);
    }
    if (s.kick.length) kickAdd(dst.kick, s.kick, cap); dst.kabs += Math.min(Math.max(0, s.kabs), cap);
    if (s.kl.length) kListUnion(dst.kl, s.kl, cap);
  }
  // C++: mesh.cpp:digFold
  function digFold(dst, s) {
    dst.n += s.n; dst.leased += digLeasedIn(s); dst.refuse += s.refuse; dst.freeC += s.freeC; if (s.dmin < dst.dmin) dst.dmin = s.dmin; if (s.part) dst.part = 1;
    // population-bounded claims, per input
    const cap = digSeats(s);
    dst.handN += Math.min(s.handN, cap); dst.awayN += Math.min(s.awayN, cap);
    listMerge(dst.hands, s.hands, K_HAND, true); listMerge(dst.stage, s.stage, K_STAGE, true); listMerge(dst.apps, s.apps, K_APP, false); talkMerge(dst.talk, s.talk);
    for (const v of s.votes) {
      const c = cloneVE(v); if (c.up > cap) c.up = cap; if (c.dn > cap) c.dn = cap;
      let hit = false; for (const a of dst.votes) if (a.tgt === c.tgt) { a.up += c.up; a.dn += c.dn; hit = true; break; }
      if (!hit) dst.votes.push(c);
    }
    if (s.kick.length) kickAdd(dst.kick, s.kick, cap); dst.kabs += Math.min(Math.max(0, s.kabs), cap);
    if (s.kl.length) kListUnion(dst.kl, s.kl, cap);
  }
  // C++: mesh.cpp:digTrim
  // Close a level: population clamps, then the one vote truncation.
  function digTrim(d) {
    const cap = digSeats(d);
    if (d.handN > cap) d.handN = cap; if (d.awayN > cap) d.awayN = cap;
    for (const v of d.votes) { if (v.up > cap) v.up = cap; if (v.dn > cap) v.dn = cap; }
    d.votes.sort(byLess(veOrd));
    if (d.votes.length > K_VOTE) d.votes.length = K_VOTE;
    kDerive(d);
    if (d.kick.length) {
      for (const v of d.kick) { if (v.up > cap) v.up = cap; if (v.dn > cap) v.dn = cap; }
      d.kick.sort(byLess(kOrd)); if (d.kick.length > K_VOTE) d.kick.length = K_VOTE;
    }
    if (d.kabs > cap) d.kabs = cap;
  }
  // C++: mesh.cpp:digListHash
  // G4 fidelity key over the list fields: an echo must reproduce what I sent.
  function digListHash(d) {
    let h = H_INIT; const mix = (x) => { h = hmix64(h, x); };
    const b = (v) => (v ? 1 : 0);
    mix(d.handN); mix(d.awayN);
    for (const e of d.hands) { mix(1); mix(e.id); mix(e.k); mix(e.f); }
    for (const e of d.stage) { mix(2); mix(e.id); mix(e.k); mix(e.f); }
    for (const e of d.apps) { mix(3); mix(e.id); mix(e.k); }
    for (const e of d.talk) { mix(5); mix(e.id); mix(e.k); mix(e.f); }
    for (const v of d.votes) { mix(4); mix(v.tgt); mix(v.up); mix(v.dn); }
    for (const k of d.kl) { mix(9); mix(k.voter); mix(k.ver); }
    if (d.kOwn.voter >= 0) { mix(7); mix(d.kOwn.voter); mix(d.kOwn.ver); mix(b(d.kOwn.all)); mix(b(d.kOwn.good)); for (const t of d.kOwn.yes) mix(t); mix(8); for (const t of d.kOwn.abs) mix(t); }
    if (d.kick.length || d.kabs) { mix(6); mix(d.kabs); for (const v of d.kick) { mix(v.tgt); mix(v.up); mix(v.dn); } }
    return h;
  }
  // C++: mesh.cpp:digSig
  // L10: the content of a digest without its stamps (at, by, ag, rx).
  function digSig(d) {
    let h = digListHash(d); const mix = (x) => { h = hmix64(h, x); };
    mix(d.n); mix(d.refuse); mix(d.freeC); mix(d.dmin); mix(d.part); mix(d.leased);
    return h;
  }
  // C++: mesh.cpp:listHolds
  // G4 monotonicity for a list: each entry I authored is in the published fold,
  // or the fold is full of K entries that all outrank it.
  function listHolds(pub, mine, K, asc) {
    for (const e of mine) {
      let inn = false; for (const p of pub) if (p.id === e.id && p.k === e.k) { inn = true; break; }
      if (inn) continue;
      if (pub.length < K) return false;
      for (const p of pub) if (!(asc ? leAsc(p, e) : leDesc(p, e))) return false;
    }
    return true;
  }
  // C++: mesh.cpp:votesHold
  function votesHold(pub, mine) {
    for (const v of mine) {
      let hit = null; for (const p of pub) if (p.tgt === v.tgt) { hit = p; break; }
      if (hit) { if (hit.up < v.up || hit.dn < v.dn) return false; continue; }
      if (pub.length < K_VOTE) return false;
      for (const p of pub) if (p.up + p.dn < v.up + v.dn) return false;
    }
    return true;
  }

  const api = Object.freeze({
    K_HAND, K_STAGE, K_APP, K_VOTE, STAGE_CAP, TALK_ON, TALK_HOLD, K_TALK,
    newDig, newKStmt, cloneLE, cloneVE, cloneKStmt, cloneDRow, cloneDig, cloneDigE, digSeats, digLeasedIn, leEq, veEq, byLess,
    leAsc, leDesc, talkCls, talkLess, talkMerge, veOrd, listMerge, kOrd, kickAdd, kSigOk, kListAdd, kListUnion,
    kDerive, voteAdd, digFoldHeld, digFold, digTrim, digListHash, digSig, listHolds, votesHold,
  });
  GifOS.meshDig = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
