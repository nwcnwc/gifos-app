/*
 * layer.js: the page surface over the ported Seat (port plan §5.2 item 1).
 *
 * The sim's seat has no gossip lane, no app leaf (names, devices, app ads),
 * no string peer ids and no page view. This layer carries them beside the
 * seat, outside the byte proof, and never feeds a decision:
 *   ids     the seat's ids are integers; a page's are 'k_' + 40 hex. nid()
 *           takes the first 52 bits (env.js nidOf; same order as the string compare), pid()
 *           maps back. Learned from my own id and every peer that hands me a
 *           frame, a greeter blob or a roster line.
 *   view    node.seat for run.html: string peer ids and string cell keys
 *           (net.topo.ckey), the names the old page read. Read-only.
 *   gossip  GSP / GSPS: room-wide and section-scoped app traffic, flooded over
 *           the seat's link peers with dedup, a per-link budget and a re-fan.
 *   leaf    setLeaf / roomDigest: the 0.9.24 display digest (js/mesh.js G9, same
 *           caps, stale rule and stubs), folded on the seat's beat along the seat's
 *           tree. It rides beside the seat's own digest frames (MW2 `pd`, no frame
 *           of its own); the seat's frames and decisions never see it.
 * Nothing here touches a pc, a socket or the DOM.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};

  // ---- ids -------------------------------------------------------------------------------------------------
  const envIds = () => GifOS.meshPageEnv || (typeof require === 'function' ? require('./env.js') : null);
  function makeIds() {
    const n2p = new Map();
    function nid(p) {
      if (typeof p !== 'string' || !p) return -1;
      const v = envIds().nidOf(p);   // the env's map: a k_ identity's first 52 bits (no collision handling)
      if (!n2p.has(v)) n2p.set(v, p);
      return v;
    }
    const pid = (n) => (n == null || n < 0 ? null : (n2p.has(n) ? n2p.get(n) : null));
    return { nid, pid, learn: nid, size: () => n2p.size };
  }

  // ---- the leaf beside the sim's leaf (G9 display facts) ---------------------------------------------------------
  // 0.9.24 js/mesh.js:253-261 (run.html's myStatus.app shape)
  const STR = (x, n) => typeof x === 'string' && x.length <= n;
  const INT = Number.isInteger;
  const AD_STR = ['s', 'k', 'relay', 'name', 'pk', 'byName'], AD_BOOL = ['mesh', 'audio'];
  const saneAd = (a) => !!a && typeof a === 'object' && !Array.isArray(a)
    && Object.keys(a).every((k) => AD_STR.indexOf(k) >= 0 || AD_BOOL.indexOf(k) >= 0 || k === 'ts')
    && AD_STR.every((k) => a[k] === undefined || a[k] === null || STR(a[k], 256))
    && AD_BOOL.every((k) => a[k] === undefined || typeof a[k] === 'boolean')
    && (a.ts === undefined || Number.isFinite(a.ts));
  const copyAd = (a) => { const o = {}; for (const k of AD_STR) if (a[k] !== undefined && a[k] !== null) o[k] = a[k]; for (const k of AD_BOOL) if (a[k] !== undefined) o[k] = a[k]; if (a.ts !== undefined) o.ts = a.ts; return o; };
  function cleanLeaf(L, f) {
    const str = (x, n) => (typeof x === 'string' ? x.slice(0, n) : '');
    const tags = (a) => (Array.isArray(a) ? Array.from(new Set(a.filter((t) => typeof t === 'string' && t && t.length <= 16))).slice(0, 8) : []);
    if (!f || typeof f !== 'object') return;
    if ('hand' in f) L.hand = Number.isFinite(f.hand) && f.hand > 0 ? f.hand : 0;
    if ('stage' in f) L.stage = Number.isFinite(f.stage) && f.stage > 0 ? f.stage : 0;
    if ('sf' in f) L.sf = Number.isInteger(f.sf) ? f.sf & 7 : 0;
    if ('app' in f) L.app = Number.isFinite(f.app) && f.app > 0 ? f.app : 0;
    if ('ad' in f) L.ad = f.ad && saneAd(f.ad) ? copyAd(f.ad) : null;
    if ('nm' in f) L.nm = str(f.nm, 24);
    if ('dv' in f) L.dv = str(f.dv, 16);
    if ('away' in f) L.away = !!f.away;
    if ('vup' in f) L.vup = tags(f.vup);
    if ('vdn' in f) L.vdn = tags(f.vdn);
    if ('vab' in f) L.vab = tags(f.vab);
  }
  const newLeaf = () => ({ hand: 0, stage: 0, sf: 0, app: 0, ad: null, nm: '', dv: '', away: false, vup: [], vdn: [], vab: [] });

  const GSP_RATE = 10, GSP_BURST = 200, GSP_SRC_RATE = 2, GSP_SRC_BURST = 80;

  // ---- the display digest, 0.9.24 js/mesh.js:163,182-219,262-276,294-298,331,338-347 ----------------------------
  // hands {id,k,nm}, stage {id,k,f,nm,dv}, apps {id,k,a}, votes {tgt,up,dn[,ab]}; handN/awayN counts. freeC/dmin and
  // the G4 echo stay out: they fed seat decisions, which are the sim's on the new seat. `leased` is the seat's L3.12.
  const DIG_TTL = 60, STUB_FULL = 240, K_HAND = 8, K_APP = 3, K_VOTE = 16;
  const SC = () => (GifOS.meshTopo ? GifOS.meshTopo.C : 5);
  const K_STAGE = () => 2 * SC();
  const dig0 = () => ({ n: 0, leased: 0, refuse: 0, at: -1, by: null, part: 0, handN: 0, awayN: 0, hands: [], stage: [], apps: [], votes: [], rows: [] });
  const leAsc = (a, b) => (a.k !== b.k ? a.k - b.k : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const leDesc = (a, b) => (a.k !== b.k ? b.k - a.k : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const veOrd = (a, b) => { const ta = a.up + a.dn, tb = b.up + b.dn; return ta !== tb ? tb - ta : (a.tgt < b.tgt ? -1 : a.tgt > b.tgt ? 1 : 0); };
  const listMerge = (dst, src, K, asc) => {
    if (!src || !src.length) return dst;
    const all = dst.concat(src).sort(asc ? leAsc : leDesc), out = [], seen = new Set();
    for (const e of all) { if (out.length >= K) break; if (!seen.has(e.id)) { seen.add(e.id); out.push(e); } }
    return out;
  };
  const voteAdd = (acc, v) => {
    for (const a of acc) if (a.tgt === v.tgt) { a.up += v.up; a.dn += v.dn; if (v.ab) a.ab = (a.ab || 0) + v.ab; return; }
    const e = { tgt: v.tgt, up: v.up, dn: v.dn }; if (v.ab) e.ab = v.ab; acc.push(e);
  };
  const voteCopy = (v) => { const e = { tgt: v.tgt, up: v.up, dn: v.dn }; if (v.ab) e.ab = v.ab; return e; };
  const digLists = (dst, s, cap, held) => {
    dst.handN += Math.min(s.handN || 0, cap); dst.awayN += Math.min(s.awayN || 0, cap);
    dst.hands = listMerge(dst.hands, s.hands, K_HAND, true); if (!held) dst.stage = listMerge(dst.stage, s.stage, K_STAGE(), true); dst.apps = listMerge(dst.apps, s.apps, K_APP, false);
    for (const v of (s.votes || [])) voteAdd(dst.votes, { tgt: v.tgt, up: Math.min(v.up, cap), dn: Math.min(v.dn, cap), ab: Math.min(v.ab || 0, cap) });
  };
  const leasedIn = (s) => Math.max(s.leased || 0, -Math.max(0, s.n));   // the seat's digLeasedIn: a dropped copy can take back no more than the report counted
  const digFold = (dst, s) => { const cap = Math.max(0, (s.n < 0 ? 0 : s.n) + (s.leased || 0)); dst.n += s.n; dst.leased += leasedIn(s); dst.refuse += s.refuse; if (s.part) dst.part = 1; digLists(dst, s, cap); };
  const digFoldHeld = (dst, s) => { const cap = Math.max(0, (s.n < 0 ? 0 : s.n) + (s.leased || 0)); dst.leased += cap; digLists(dst, s, cap, true); };   // the seat's L3.12: held under its lease, with no Stage list
  const digTrim = (d) => {
    const cap = Math.max(0, (d.n < 0 ? 0 : d.n) + (d.leased || 0));
    if (d.handN > cap) d.handN = cap; if (d.awayN > cap) d.awayN = cap;
    for (const v of d.votes) { if (v.up > cap) v.up = cap; if (v.dn > cap) v.dn = cap; if (v.ab > cap) { if (cap) v.ab = cap; else delete v.ab; } }
    d.votes.sort(veOrd); if (d.votes.length > K_VOTE) d.votes.length = K_VOTE;
  };
  const DIG_H = Symbol('h');
  const digHash = (d) => {
    const hit = d[DIG_H]; if (hit) return hit;
    const a0 = [d.n, d.leased || 0, d.refuse, d.part ? 1 : 0, d.handN || 0, d.awayN || 0, d.hands || [], d.stage || [], d.apps || [], d.votes || []];
    if (d.rows && d.rows.length) a0.push(d.rows.map((r) => [r.k, r.at, r.by, r.n, r.l, r.h, r.e, r.hands || [], r.stage || [], r.apps || []]));   // a row's age is not content
    const t = JSON.stringify(a0);
    let a = 2166136261 >>> 0, b = 0x9e3779b9 >>> 0;
    for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519); }
    const h = (a >>> 0).toString(36) + (b >>> 0).toString(36);
    d[DIG_H] = h;
    return h;
  };
  const leCopy = (e) => { const c = Object.assign({}, e); if (e.a) c.a = Object.assign({}, e.a); return c; };
  // A row one fold carried (the seat's DRow, L48): k the row (its head cell), at/by its report's author stamp, rx its receipt on my
  // clock (ag on the wire), n/l the seats it put into the carrier's n and leased, h its handN, e 0 the owner's copy, 1 a copy over
  // E2, 2 a resolved winner (named only), and its lists.
  const rowCopy = (r) => { const c = { k: r.k, at: r.at, by: r.by, rx: r.rx, n: r.n | 0, l: r.l | 0, h: r.h | 0, e: r.e | 0 };
    if (r.e !== 2) { c.hands = (r.hands || []).map(leCopy); c.stage = (r.stage || []).map(leCopy); c.apps = (r.apps || []).map(leCopy); } return c; };
  const digCopy = (d) => ({ n: d.n, leased: d.leased || 0, refuse: d.refuse, at: d.at, by: d.by, part: d.part, handN: d.handN || 0, awayN: d.awayN || 0,
    hands: (d.hands || []).map(leCopy), stage: (d.stage || []).map(leCopy), apps: (d.apps || []).map(leCopy), votes: (d.votes || []).map(voteCopy), rows: (d.rows || []).map(rowCopy) });
  const digCopyRx = (d) => { const c = digCopy(d); c.rx = d.rx; return c; };
  const digPack = (o) => {
    if (!o.leased) delete o.leased; if (!o.part) delete o.part; if (!o.ag) delete o.ag;
    if (!o.handN) delete o.handN; if (!o.awayN) delete o.awayN;
    for (const f of ['hands', 'stage', 'apps', 'votes', 'rows']) if (!o[f] || !o[f].length) delete o[f];
    return o;
  };
  const saneLE = (e, kind) => !!e && STR(e.id, 64) && Number.isFinite(e.k) && (e.f === undefined || INT(e.f)) && (e.nm === undefined || STR(e.nm, 24))
    && (e.dv === undefined || STR(e.dv, 16)) && (kind !== 'app' || e.a === undefined || saneAd(e.a));
  const digSane = (d) => {
    if (!d || typeof d !== 'object' || !INT(d.n) || !INT(d.refuse) || !Number.isFinite(d.at)) return null;
    const o = { n: d.n, leased: INT(d.leased) && INT(d.n) ? Math.max(d.leased, -Math.max(0, d.n)) : 0, refuse: d.refuse, at: d.at, ag: INT(d.ag) && d.ag >= 0 ? Math.min(d.ag, 1 << 20) : 0, by: d.by == null ? null : String(d.by).slice(0, 64), part: d.part ? 1 : 0,
      handN: INT(d.handN) && d.handN >= 0 ? d.handN : 0, awayN: INT(d.awayN) && d.awayN >= 0 ? d.awayN : 0, hands: [], stage: [], apps: [], votes: [], rows: [] };
    const lists = [['hands', K_HAND, 'hand'], ['stage', K_STAGE(), 'stage'], ['apps', K_APP, 'app']];
    for (const [f, K, kind] of lists) {
      const a = d[f]; if (a === undefined) continue;
      if (!Array.isArray(a) || a.length > K || !a.every((e) => saneLE(e, kind))) return null;
      o[f] = a.map((e) => { const c = { id: e.id, k: e.k }; if (e.f !== undefined) c.f = e.f; if (e.nm !== undefined) c.nm = e.nm; if (e.dv !== undefined) c.dv = e.dv; if (e.a !== undefined) c.a = copyAd(e.a); return c; });
    }
    if (d.votes !== undefined) {
      if (!Array.isArray(d.votes) || d.votes.length > K_VOTE || !d.votes.every((v) => v && STR(v.tgt, 16) && INT(v.up) && v.up >= 0 && INT(v.dn) && v.dn >= 0 && (v.ab === undefined || (INT(v.ab) && v.ab >= 0)))) return null;
      o.votes = d.votes.map(voteCopy);
    }
    if (d.rows !== undefined) {   // L48: bounded (a seat's own child row, a lone row's carried rows, the rows it serves over E2)
      if (!Array.isArray(d.rows) || d.rows.length > 2 * SC() + 16) return null;
      for (const r of d.rows) {
        const e2 = r && r.e === undefined ? 0 : r && r.e;
        if (!r || typeof r !== 'object' || !INT(r.k) || !Number.isFinite(r.at) || !INT(e2) || e2 < 0 || e2 > 2) return null;
        const c = { k: r.k, at: r.at, by: r.by == null ? null : String(r.by).slice(0, 64), ag: INT(r.ag) && r.ag >= 0 ? Math.min(r.ag, 1 << 20) : 0, n: INT(r.n) ? r.n : 0, l: INT(r.l) ? r.l : 0, h: INT(r.h) && r.h >= 0 ? r.h : 0, e: e2 };
        if (e2 !== 2) for (const [f, K, kind] of lists) { const a = r[f]; if (a === undefined) { c[f] = []; continue; } if (!Array.isArray(a) || a.length > K || !a.every((e) => saneLE(e, kind))) return null;
          c[f] = a.map((e) => { const x = { id: e.id, k: e.k }; if (e.f !== undefined) x.f = e.f; if (e.nm !== undefined) x.nm = e.nm; if (e.dv !== undefined) x.dv = e.dv; if (e.a !== undefined) x.a = copyAd(e.a); return x; }); }
        o.rows.push(c);
      }
    }
    return o;
  };

  // ---- L48: a row's fold over E2 while its E1 is down, and the newest copy of each row ------------------------------------
  // The backup owner folds the row's E2 copy into what a person is shown (leased, handN, hands, Stage, ads); a fold that sees
  // two copies of one row (the owner row's head, or Section 1 when the owner row is there) keeps the newest and takes every older
  // copy out of the input that carried it. One author's copies compare by its own stamp, two authors' by receipt on my clock.
  const leSame = (a, b) => a.id === b.id && a.k === b.k && (a.f | 0) === (b.f | 0);
  const dropL = (v, gone) => (gone && gone.length && v && v.length ? v.filter((e) => !gone.some((g) => leSame(g, e))) : v);
  const rowOf = (d, k, asLeased, e2) => {
    const seats = Math.max(0, (d.n < 0 ? 0 : d.n) + (d.leased || 0));
    return { k, at: d.at, by: d.by, rx: d.rx != null ? d.rx : d.at, n: asLeased ? 0 : d.n, l: asLeased ? seats : (d.leased || 0), h: Math.min(d.handN || 0, seats), e: e2,
      hands: (d.hands || []).map(leCopy), stage: (d.stage || []).map(leCopy), apps: (d.apps || []).map(leCopy) };
  };
  const addE2 = (dst, s) => {
    const seats = Math.max(0, (s.n < 0 ? 0 : s.n) + (s.leased || 0));
    dst.leased += seats; dst.handN += Math.min(s.handN || 0, seats);
    dst.hands = listMerge(dst.hands, s.hands, K_HAND, true); dst.stage = listMerge(dst.stage, s.stage, K_STAGE(), true); dst.apps = listMerge(dst.apps, s.apps, K_APP, false);
  };
  const subRow = (d, r) => { d.leased = (d.leased || 0) - (r.n + r.l); d.handN = Math.max(0, (d.handN || 0) - r.h); d.hands = dropL(d.hands, r.hands); d.stage = dropL(d.stage, r.stage); d.apps = dropL(d.apps, r.apps); };
  const rowNewer = (a, b) => { if (a.by != null && a.by === b.by) { if (a.at !== b.at) return a.at > b.at; } else if (a.rx !== b.rx) return a.rx > b.rx; return a.e === 0 && b.e !== 0; };
  // Who may carry a copy of row k into a fold (the folder's own view, occ): an owner's copy (e 0) only a seat whose report
  // covers the row (its owner, or a row head or owner further up that chain); a copy over E2 (e 1) only the row's backup owner
  // or its standby. Any other copy takes no part: it can neither win nor take another input's copy out.
  function mayCarry(c, k, e, occ) {
    const R = GifOS.meshRoles, tp = GifOS.meshTopo; if (!R || !tp) return false;
    const row = tp.unckey(k); if (row.i !== 0 || row.pc === 0) return false;
    if (e === 1) { const b = R.backupOwnerOf(row, occ), sb = R.standbyOf(row, occ); return (!!b && tp.ckey(b) === c) || (!!sb && tp.ckey(sb) === c); }
    let x = R.ownerOf(row);
    for (let g = 0; x && g < 64; g++) {
      if (tp.ckey(x) === c) return true; if (x.pc === 0) return false;
      const h = { pc: x.pc, r: x.r, i: 0 }; if (tp.ckey(h) === c) return true; x = R.ownerOf(h);
    }
    return false;
  }
  function rowResolve(ins, cells, occ) {   // ins: the copies a fold is about to fold, cells: the cell each came from; returns the winners
    const ok = (i, r) => mayCarry(cells[i], r.k, r.e, occ);
    let any = false; ins.forEach((d, i) => { for (const r of d.rows || []) if (r.e === 1 && ok(i, r)) any = true; });
    if (!any) return [];
    const g = new Map(); ins.forEach((d, i) => (d.rows || []).forEach((r, j) => { if (r.e === 2 || !ok(i, r)) return; let a = g.get(r.k); if (!a) g.set(r.k, a = []); a.push([i, j]); }));
    const won = [];
    for (const v of g.values()) {
      if (v.length < 2 || !v.some(([i, j]) => ins[i].rows[j].e === 1)) continue;
      let b = 0; for (let q = 1; q < v.length; q++) if (rowNewer(ins[v[q][0]].rows[v[q][1]], ins[v[b][0]].rows[v[b][1]])) b = q;
      const w = ins[v[b][0]].rows[v[b][1]];
      v.forEach(([i, j], q) => { if (q !== b) subRow(ins[i], ins[i].rows[j]); });
      won.push({ k: w.k, at: w.at, by: w.by, rx: w.rx, n: 0, l: 0, h: 0, e: 2 });
    }
    return won;
  }

  /**
   * create(o) -> layer
   *   o.peer           my peer id (string)
   *   o.raw()          the ported Seat (or null before build)
   *   o.emit(peer, f)  hand a page frame (GSP / GSPS) to the wire (it signs gossip and sends on the dc)
   *   o.onGossip(src, m, ageTicks, scoped) -> false refuses
   *   o.ckey(c)        the page's string cell key (net.topo.ckey)
   *   o.ownedLinks(c)  topo owned links of a coord (for the section scope)
   *   o.GSP_GUARD      false turns the flood guard off: harness controls only (0.9.24 env.GSP_GUARD; no wire passes it)
   */
  function create(o) {
    const ids = makeIds();
    const me = o.peer; ids.learn(me);
    const raw = () => o.raw();
    const T = () => { const s = raw(); return s ? s.TICK : 0; };
    const P = (n) => ids.pid(n);

    // ---- view ----------------------------------------------------------------------------------------------
    let occCache = null, occAt = -1, occGen = -1, gen = 0;
    const bump = () => { gen++; };
    function mapCells(m) {   // Map<int cell, int id> -> Map<string ckey, peer>
      const out = new Map(); if (!m) return out;
      for (const [k, v] of m) { const p = P(v); if (p != null) out.set(o.ckey({ pc: Math.floor(k / 65536), r: (k >>> 8) & 0xff, i: k & 0xff }), p); }
      return out;
    }
    function mapTicks(m) { const out = new Map(); if (!m) return out; for (const [k, v] of m) out.set(o.ckey({ pc: Math.floor(k / 65536), r: (k >>> 8) & 0xff, i: k & 0xff }), v); return out; }
    function occView() { const s = raw(); if (!s) return new Map(); if (occCache && occAt === s.TICK && occGen === gen) return occCache; occCache = mapCells(s.occ); occAt = s.TICK; occGen = gen; return occCache; }
    function linkSet(want) { const s = raw(), out = new Set(); if (!s) return out; const a = []; s.linkPeers(a, want); for (const x of a) { const p = P(x); if (p != null && p !== me) out.add(p); } return out; }
    function keepSet() { const s = raw(), out = new Set(); if (!s || !s.keeps) return out; for (const k of s.keeps) if (s.TICK < k.until) { const p = P(k.peer); if (p != null) out.add(p); } return out; }
    const counters = { gspInAll: 0, gspRefused: 0, gspForged: 0, gspDropped: 0 };
    const view = {
      id: me,
      get raw() { return raw(); },
      get state() { const s = raw(); return s ? s.state : 0; },
      get hasCoord() { const s = raw(); return !!(s && s.hasCoord); },
      get coord() { const s = raw(); return s && s.hasCoord ? { pc: s.coord.pc, r: s.coord.r, i: s.coord.i } : null; },
      get stranded() { const s = raw(); return !!(s && s.stranded); },
      get seatedAt() { const s = raw(); return s ? s.seatedAt : -1; },
      get genKey() { const s = raw(); return s ? s.genKey : 0; },
      s1Roster() { const s = raw(); return s ? s.s1Roster().map((e) => ({ k: e.k, v: P(e.v) })).filter((e) => e.v != null) : []; },   // the reload tree memory (run.html saveTreeMem)
      get TICK() { return T(); },
      get env() { return { TICK: T() }; },
      get occ() { return occView(); },
      occGet(k) { return occView().get(k); },
      get live() { const s = raw(); return s ? mapTicks(s.live) : new Map(); },
      get s1seen() { const s = raw(); return s ? mapTicks(s.s1seen) : new Map(); },
      get translost() { const s = raw(); return s ? mapTicks(s.translost) : new Map(); },
      get tlLog() { return []; },
      get probeAck() { const s = raw(); return s ? mapTicks(s.probeAck) : new Map(); },
      get holeSince() { const s = raw(); return s ? mapTicks(s.holeSince) : new Map(); },
      get childOf() { const s = raw(); return s ? mapCells(s.childOf) : new Map(); },
      get roster() { return []; },
      get moving() { const s = raw(); return !!(s && s.moving); },
      get alive() { const s = raw(); return !!(s && !s.dead); },
      get seatTries() { const s = raw(); return s ? s.seatTries : 0; },
      get lastAsked() { const s = raw(); return s ? P(s.lastAsked) : null; },
      get compactMoves() { return 0; },
      goodbye() {},   // the old page's dc-close goodbye hint: the new seat hears pcbye / TRANSLOST through its world
      get forkPaused() { return false; },
      get lastGreeters() { const s = raw(); return s ? Array.from(s.lastGreeters || []).map(P).filter(Boolean) : []; },
      get greetersAt() { const s = raw(); return s ? s.greetersAt : -1; },
      // The seat's link set (owned, E2/E3, L4, L14 roles), as peers; keeps are apart (keepPeers).
      linkPeers() { return linkSet(15); },
      // L2.4: the rows' folds I hold while I serve them (read only; not folded into the room: healing-laws L2 'Not yet').
      u2Folds() { const s = raw(), out = []; if (!s) return out; for (const [k, d] of u2Folds) out.push({ row: k, n: d.n, leased: d.leased || 0, handN: d.handN || 0, hands: (d.hands || []).length, age: s.LT() - d.rx }); return out; },
      keepPeers() { return keepSet(); },
      // L28: this device is using the pc to that peer, for so many ticks (my end only, budgeted by the seat).
      keepAdd(peer, ticks) { const s = raw(); if (!s || !s.keepAdd) return; const x = ids.nid(peer); if (x >= 0) s.keepAdd(x, ticks); },
      // E2 and E3 as the seat holds them, as peers (read only): the media plane ships over these pcs.
      get u2Id() { const s = raw(); return s && s.hasCoord && s.coord.pc !== 0 && s.u2Id >= 0 && s.u2Id !== s.id ? P(s.u2Id) : null; },   // a head moved into Section 1 keeps a stale u2Id: it holds no E2
      get u3Id() { const s = raw(); return s && s.hasCoord && s.coord.pc !== 0 && s.u3Id >= 0 && s.u3Id !== s.id ? P(s.u3Id) : null; },
      get u2Hot() { const s = raw(); return !!(s && s.hasCoord && s.coord.pc !== 0 && s.u2Hot); },
      // L14 as the seat holds it, as peers (read only): my branch's temporary uplink, and the heads whose uplink I took.
      get l14Up() { const s = raw(); return s && s.l14Up >= 0 && s.l14Up !== s.id ? P(s.l14Up) : null; },
      // L2.7: my row's head is gone in my own view and I am the row's heir (its lowest live column): its duties are mine
      // until it returns or the cell is refilled. Deep rows: the seat's own headGone; Section 1: the cell empty, dark (the seat's darkMate) or closed.
      get headGoneView() {
        const s = raw(), tp = TP(); if (!s || !s.hasCoord || s.state !== 3 || s.coord.i === 0) return false;
        const hk = tp.ckey({ pc: s.coord.pc, r: s.coord.r, i: 0 }), h = s.occGet(hk);
        return s.coord.pc !== 0 ? s.headGone() : (h < 0 || h === s.id || s.darkMate(hk) || s.f.fabricLinkState(s.id, h) === GifOS.meshConsts.enums.LS_CLOSED);
      },
      // The row's heir as my view names it: its lowest live column past the head, me included (read only).
      rowHeir() {
        const s = raw(), tp = TP(); if (!s || !s.hasCoord || s.state !== 3 || s.coord.i === 0) return null;
        for (let j = 1; j < s.coord.i; j++) { const k = tp.ckey({ pc: s.coord.pc, r: s.coord.r, i: j }); if (s.occGet(k) >= 0 && s.firstHandLive(k)) return P(s.occGet(k)); }
        return me;
      },
      // A frame of my row's head reached me first-hand after this tick (the seat's own record).
      headHeardSince(t) { const s = raw(), tp = TP(); if (!s || !s.hasCoord) return false; const it = s.live.get(tp.ckey({ pc: s.coord.pc, r: s.coord.r, i: 0 })); return it !== undefined && it > t; },
      get seatTick() { const s = raw(); return s ? s.TICK : 0; },
      get l14Cut() { const s = raw(); return !!(s && s.hasCoord && s.state === 3 && s.coord.pc !== 0 && s.l14Branch()); },   // my chain up is broken in the seat's own view (L14)
      l14Served() { const s = raw(), out = []; if (!s || !s.hasCoord) return out; for (const x of s.l14Served.keys()) { if (!s.l14Serve(x)) continue; const p = P(x); if (p != null && p !== me) out.push(p); } return out; },
      u2Heirs() { const s = raw(), out = []; if (!s || !s.hasCoord) return out; for (const e of s.u2Rows.values()) if (s.TICK - e.at <= 40) { const p = P(e.heir); if (p != null && p !== me && out.indexOf(p) < 0) out.push(p); } return out; },
      e2Src() { const s = raw(), R = GifOS.meshRoles, Tp = GifOS.meshTopo; if (!s || !s.hasCoord || s.coord.pc === 0 || !R || !Tp) return null; const src = R.e2SrcOf({ pc: s.coord.pc, r: s.coord.r, i: 0 }, (c) => s.occGet(Tp.ckey(c)) >= 0); return src ? P(s.occGet(Tp.ckey(src))) : null; },
      // The old page's door and fork helpers: the new seat runs its own L16 knocker and L8 islands decide.
      heardFrom() {}, answerDoor() {}, chooseFork() { return false; },
      get gspInAll() { return counters.gspInAll; }, get gspRefused() { return counters.gspRefused; },
      get gspForged() { return counters.gspForged; }, get gspDropped() { return counters.gspDropped; },
    };

    // ---- gossip ---------------------------------------------------------------------------------------------
    let gseq = Date.now();   /* a gossip id must not repeat across a reload of the same identity: the room still holds the old ones as seen and drops the new as copies */ const gseen = new Map(); let grecent = []; const bkt = new Map();
    function sectionPeers() {
      const s = raw(), out = new Set(); if (!s || !s.hasCoord) return out;
      for (const olc of o.ownedLinks(s.coord)) { if (olc.pc !== s.coord.pc) continue; const x = s.occ.get(olc.pc * 65536 + olc.r * 256 + olc.i); const p = P(x); if (p != null && p !== me) out.add(p); }
      return out;
    }
    const peersFor = (sc) => (sc !== undefined ? sectionPeers() : linkSet(15));
    function frameOf(e) { const f = { t: e.sc !== undefined ? 'GSPS' : 'GSP', gid: e.gid, src: e.src, m: e.m }; if (e.sc !== undefined) f.sc = e.sc; if (e.eph) f.eph = 1; if (e.s4) f.s4 = e.s4; const ag = (e.ag0 || 0) + (e.at != null ? Math.max(0, T() - e.at) : 0); if (ag > 0) f.ag = ag; return f; }
    function remember(gid, src, m, sc, ag0, s4, tx) { const e = { gid, src, m, at: T(), tx: tx || new Map() }; if (sc !== undefined) e.sc = sc; if (ag0) e.ag0 = ag0; if (s4) e.s4 = s4; grecent.push(e); if (grecent.length > 64) grecent.shift(); }
    function budget(link, src) {
      if (o.GSP_GUARD === false) return true;
      const t = T();
      const take = (k, rate, burst, peek) => { let b = bkt.get(k); if (!b) { if (bkt.size > 4096) bkt.clear(); bkt.set(k, b = { n: burst, at: t }); } if (t > b.at) { b.n = Math.min(burst, b.n + (t - b.at) * rate); b.at = t; } if (b.n < 1) return false; if (!peek) b.n -= 1; return true; };
      const lk = 'L|' + (link == null ? '?' : link), sk = lk + '|' + src;
      if (!take(sk, GSP_SRC_RATE, GSP_SRC_BURST, true) || !take(lk, GSP_RATE, GSP_BURST, true)) return false;
      take(sk, GSP_SRC_RATE, GSP_SRC_BURST); take(lk, GSP_RATE, GSP_BURST); return true;
    }
    function gossip(payload, opt) {
      const s = raw(); if (!s) return;
      const sc = opt && opt.scope === 'section' ? (s.hasCoord ? s.coord.pc : null) : undefined;
      if (sc === null) return;
      const eph = !!(opt && opt.ephemeral);
      const gid = me + ':' + (++gseq); gseen.set(gid, T());
      const tx = new Map();
      if (!eph) remember(gid, me, payload, sc, 0, undefined, tx);
      for (const p of peersFor(sc)) { o.emit(p, frameOf({ gid, src: me, m: payload, sc, eph })); tx.set(p, 1); }
    }
    // A verified gossip frame (the wire checked its author's signature first).
    function gossipRecv(m) {
      counters.gspInAll++;
      const s = raw(); if (!s) return;
      const scoped = m.t === 'GSPS';
      if (scoped && (!Number.isInteger(m.sc) || !s.hasCoord || s.coord.pc !== m.sc)) return;
      if (typeof m.gid !== 'string' || typeof m.src !== 'string' || !m.gid.startsWith(m.src + ':')) { counters.gspForged++; return; }
      if (gseen.has(m.gid)) return;
      if (!budget(m.lk != null ? m.lk : m.from, m.src)) { counters.gspDropped++; return; }
      gseen.set(m.gid, T());
      if (gseen.size > 4096) { for (const [k, at] of gseen) { if (T() - at > 600) gseen.delete(k); else break; } }
      if (gseen.size > 65536) { let n = gseen.size - 32768; for (const k of gseen.keys()) { if (n-- <= 0) break; gseen.delete(k); } }
      ids.learn(m.src);
      const ag = Number.isInteger(m.ag) && m.ag > 0 ? Math.min(m.ag, 1 << 20) : 0;
      let own = m.m; try { if (m.m && typeof m.m === 'object') own = JSON.parse(JSON.stringify(m.m)); } catch (e) {}
      if (o.onGossip) { let ok; try { ok = o.onGossip(m.src, own, ag, scoped); } catch (e) {} if (ok === false) { counters.gspRefused++; return; } }
      const tx = new Map(); tx.set(m.src, 1); if (m.from != null) tx.set(m.from, 2);
      if (!m.eph) remember(m.gid, m.src, m.m, scoped ? m.sc : undefined, ag, m.s4, tx);
      const e = { gid: m.gid, src: m.src, m: m.m, sc: scoped ? m.sc : undefined, eph: m.eph ? 1 : 0, ag0: ag, s4: m.s4 };
      for (const p of peersFor(e.sc)) if (p !== m.src && p !== m.from) { o.emit(p, frameOf(e)); tx.set(p, 1); }
    }
    function refan() {
      grecent = grecent.filter((e) => T() - e.at <= 256);
      for (const e of grecent) {
        if (T() - e.at > 32) continue;
        for (const p of peersFor(e.sc)) { const n = e.tx.get(p) || 0; if (n >= 2) continue; e.tx.set(p, n + 1); o.emit(p, frameOf(e)); }
      }
    }
    // A peer that newly joined my link set gets my recent backlog (the new-neighbour replay).
    let lastLinks = new Set();
    function replayNew() {
      const now = linkSet(15);
      for (const p of now) if (!lastLinks.has(p)) for (const e of grecent) { o.emit(p, frameOf(e)); e.tx.set(p, (e.tx.get(p) || 0) + 1); }
      lastLinks = now;
    }

    // ---- leaf and digest: the 0.9.24 fold over the new seat's tree ---------------------------------------------
    // Same slots as the seat's digest (seat-rest.js takeUp, live.js pongDig, s1SyncDigs): one fold per beat (the
    // seat's own rollup is the clock), a deep seat's report rides its PHONE, the room fold its PONG, Section 1's
    // table its S1SYNC. The seat is only read; nothing here reaches a seat decision.
    const leaf = newLeaf(); let refuses = false;
    function setLeaf(f) { cleanLeaf(leaf, f); }
    function setRefuses(b) { refuses = !!b; }
    const KC = () => (GifOS.meshConsts ? GifOS.meshConsts.consts : { LEASE_T: 220 });
    const TP = () => GifOS.meshTopo;
    let myDig = dig0(), rowDig = dig0(), rootDig = dig0(), downDig = dig0(), u2RowDig = dig0(), siDig = dig0(), foldSig = null, foldBeat = -1, foldCell = -1, rootKeep = null, rootKeepAt = -1, rootHeld = false;
    const rowKids = new Map(), s1tab = new Map(), u2Folds = new Map(), siKids = new Map();   // siKids: my row-mates' own reports while I stand in for our head (L48)
    const servesHot = (s, to) => { const x = ids.nid(to); for (const e of s.u2Rows.values()) if (e.hot && e.heir === x) return true; return false; };
    const e2SrcIs = (s, to) => { const R = GifOS.meshRoles, tp = GifOS.meshTopo; if (!R || !tp) return false; const x = R.e2SrcOf({ pc: s.coord.pc, r: s.coord.r, i: 0 }, (q) => s.occGet(tp.ckey(q)) >= 0); return !!x && P(s.occGet(tp.ckey(x))) === to; };
    const digSent = new Map(), digWant = new Map();
    const rxDig = (s, d) => { d.rx = s.LT() - (INT(d.ag) ? Math.min(Math.max(d.ag, 0), 1 << 20) : 0); for (const r of d.rows || []) { r.rx = s.LT() - (r.ag || 0); delete r.ag; } return d; };
    const wireDig = (s, d) => { const c = digCopy(d); const st = d.rx != null ? d.rx : d.at; c.ag = st >= 0 ? Math.max(0, s.LT() - st) : 0;
      for (const r of c.rows) { const t = r.rx != null ? r.rx : r.at; r.ag = t >= 0 ? Math.max(0, s.LT() - t) : 0; delete r.rx; for (const f of ['hands', 'stage', 'apps']) if (r[f] && !r[f].length) delete r[f]; for (const f of ['n', 'l', 'h', 'e', 'ag']) if (!r[f]) delete r[f]; } return digPack(c); };
    // A cell whose occupant the seat no longer names (0.9.24 digForget): a different seat there, or nobody.
    // And a cell whose report the seat itself no longer holds by that author (its s1tab / rowKids / siKids / downDig):
    // the seat ends a report on a confirmed vacate (digForget1) and on an L3.12 tombstone, while the occ view may still
    // name the mover at the cell it left for a lease. This table had no vacate rule, so a mover's old report was counted
    // beside its new cell, fresh for DIG_TTL then held to LEASE_T: a 25-room read 25 for ~110 s after one Section-1 crash.
    const seatHolds = (s, k, x) => {
      const tp = TP(); if (s.hasCoord && k === tp.ckey(tp.down(s.coord))) return !!s.downDig && s.downDig.at >= 0 && s.downDig.by === x;
      const t = Math.floor(k / 65536) === 0 ? s.s1tab : s.rowKids; let e = t ? t.get(k) : undefined;
      if (e === undefined && s.siKids) e = s.siKids.get(k);
      return e !== undefined && e.by === x;
    };
    const named = (s, k, e) => { const x = s.occGet(k); return x >= 0 && e.by != null && x === ids.nid(e.by) && seatHolds(s, k, x); };
    const held = (s, k, e) => e.at >= 0 && named(s, k, e) && s.LT() - e.rx <= KC().LEASE_T;
    const gapAt = (s, k) => { const sv = s.findNc; s.findNc = -1; try { return s.scopeGap(k); } finally { s.findNc = sv; } };   // the seat's own G3 read, scoped as its rollup scopes it
    function foldSlot(s, dst, k, e) {   // 0.9.24 rollup: fresh folds, stale fails closed (the seat's L3.12 lease in between)
      const LT = s.LT();
      if (e && e.at >= 0 && named(s, k, e) && LT - e.rx <= DIG_TTL) { digFold(dst, e); return 1; }
      if (gapAt(s, k)) { dst.part = 1; dst.refuse += 1; }
      if (e && held(s, k, e)) { digFoldHeld(dst, e); return 2; }
      return 0;
    }
    const slotMode = (s, k, e) => (e && e.at >= 0 && named(s, k, e) && s.LT() - e.rx <= DIG_TTL) ? 1 : (e && held(s, k, e) ? 2 : 0);   // foldSlot's choice, read only
    const L48_BEAT = () => 8 + (KC().EARLY_HOLD || 12);
    // L48: the rows I serve over E2 (the seat's U2Row still beats me and still holds a fold) and their copies, at most LEASE_T old
    const e2Live = (s, rk, u) => { const e = s.u2Rows && s.u2Rows.get(rk * 2); return !!e && e.hot && e.heir >= 0 && s.TICK - e.at <= L48_BEAT() && !!e.dig && e.dig.at >= 0 && u.at >= 0 && s.LT() - u.rx <= KC().LEASE_T; };
    function ownDig(s, LT) {
      const L = leaf, d = dig0(); d.n = 1; d.refuse = refuses ? 1 : 0; d.at = LT; d.rx = LT; d.by = me;
      if (L.hand) { d.handN = 1; d.hands.push({ id: me, k: L.hand, nm: L.nm }); }
      if (L.stage) d.stage.push({ id: me, k: L.stage, f: L.sf, nm: L.nm, dv: L.dv });
      if (L.app && L.ad) d.apps.push({ id: me, k: L.app, a: copyAd(L.ad) });
      if (L.away || L.vab.includes('*')) d.awayN = 1;
      else {
        for (const t of L.vup) if (!L.vab.includes(t)) voteAdd(d.votes, { tgt: t, up: 1, dn: 0 });
        for (const t of L.vdn) if (!L.vab.includes(t)) voteAdd(d.votes, { tgt: t, up: 0, dn: 1 });
        for (const t of L.vab) voteAdd(d.votes, { tgt: t, up: 0, dn: 0, ab: 1 });
      }
      if (s.TICK < s.digHoldUntil) { d.votes = []; d.handN = 0; d.awayN = 0; }   // THE HANDOVER HOLD
      return d;
    }
    // A settled room's fold inputs do not change between beats: a matching signature only moves the stamps (0.9.24).
    function slotSig(s, k, e) { const LT = s.LT(); return (e && e.at >= 0 && named(s, k, e) && LT - e.rx <= DIG_TTL) ? ':' + digHash(e) : (gapAt(s, k) ? ':*' : ':.') + (e && held(s, k, e) ? digHash(e) : ''); }
    function rollupP(s) {
      const C = SC(), c = s.coord, tp = TP(), LT = s.LT(), mine = tp.ckey(c);
      if (mine !== foldCell) { foldCell = mine; rootKeep = rootDig; rootKeepAt = s.TICK; downDig = dig0(); rowKids.clear(); s1tab.clear(); foldSig = null; u2RowDig = dig0(); u2Folds.clear(); siKids.clear(); siDig = dig0(); }
      const L = leaf, dk = tp.ckey(tp.down(c));
      const newest = new Map();
      if (c.pc === 0) for (const e of s1tab.values()) if (e.by != null && LT - e.rx <= DIG_TTL) { const nb = newest.get(e.by); if (nb === undefined || nb < e.at) newest.set(e.by, e.at); }
      const superseded = (it) => LT - it.rx <= DIG_TTL && it.by != null && (it.by === me || newest.get(it.by) !== it.at);
      let sig = (refuses ? 1 : 0) + ',' + (s.TICK < s.digHoldUntil ? 1 : 0) + ',' + slotSig(s, dk, downDig)
        + ',' + (L.hand || 0) + ',' + (L.stage || 0) + ',' + (L.sf | 0) + ',' + (L.app || 0) + ',' + (L.away ? 1 : 0)
        + ',' + L.nm + ',' + L.dv + ',' + (L.ad ? JSON.stringify(L.ad) : '') + ',' + L.vup.join('\n') + ',' + L.vdn.join('\n') + ',' + L.vab.join('\n');
      if (c.pc !== 0 && c.i === 0) for (let j = 1; j < C; j++) { const rk = tp.ckey({ pc: c.pc, r: c.r, i: j }); sig += slotSig(s, rk, rowKids.get(rk)); }
      for (const [rk, u] of u2Folds) if (!e2Live(s, rk, u)) u2Folds.delete(rk);   // L48: a parked beat, a beat with no fold, or a copy past its lease ends the copy
      for (const [rk, u] of u2Folds) if (e2Live(s, rk, u)) sig += ';e2' + rk + ':' + digHash(u);
      const si = c.pc !== 0 && c.i !== 0 && siKids.size > 0;
      if (si) for (let j = 1; j < C; j++) if (j !== c.i) { const rk = tp.ckey({ pc: c.pc, r: c.r, i: j }); sig += ';si' + slotSig(s, rk, siKids.get(rk)); }
      if (c.pc === 0) for (let r0 = 0; r0 < C; r0++) for (let i0 = 0; i0 < C; i0++) {
        const k = tp.ckey({ pc: 0, r: r0, i: i0 }); if (k === mine) { sig += ':me'; continue; }
        const it = s1tab.get(k); sig += it && superseded(it) ? ':-' : slotSig(s, k, it);
      }
      if (foldSig === sig && myDig.at >= 0) {
        myDig.at = LT; myDig.rx = LT; if (c.pc !== 0 && c.i === 0) { rowDig.at = LT; rowDig.rx = LT; } if (si) { siDig.at = LT; siDig.rx = LT; } if (c.pc === 0) { rootDig.at = LT; rootDig.rx = LT; }
        return;
      }
      foldSig = sig;
      const d = ownDig(s, LT), dm = foldSlot(s, d, dk, downDig);
      if (dm) { d.rows.push(rowOf(downDig, dk, dm === 2, 0)); for (const x of downDig.rows || []) if (x.e !== 2) d.rows.push(rowCopy(x)); }   // L48: my child row's copy (a lone row's own rows go on up)
      for (const [rk, u] of u2Folds) if (e2Live(s, rk, u)) { addE2(d, u); d.rows.push(rowOf(u, rk, true, 1)); }   // L48: the rows I serve over E2
      digTrim(d); myDig = d;
      if (si) {   // L48 the stand-in fold: a heir standing in for its head folds its own report and its row-mates' (their stand-in PHONEs)
        const r = digCopy(d); r.at = LT; r.rx = LT; r.by = me; r.rows = [];
        for (let j = 1; j < C; j++) if (j !== c.i) { const rk = tp.ckey({ pc: c.pc, r: c.r, i: j }); foldSlot(s, r, rk, siKids.get(rk)); }
        digTrim(r); siDig = r;
      } else siDig = dig0();
      if (c.pc !== 0 && c.i === 0) {   // a deep row head folds its row (its owner is linked only to it)
        const r = digCopy(d); r.at = LT; r.rx = LT; r.by = me;
        const kids = []; for (let j = 1; j < C; j++) { const rk = tp.ckey({ pc: c.pc, r: c.r, i: j }), e = rowKids.get(rk); kids.push([rk, e, slotMode(s, rk, e)]); }
        const any = d.rows.some((x) => x.e === 1) || kids.some(([, e, m]) => m && (e.rows || []).some((x) => x.e === 1));
        const cp = kids.map(([, e, m]) => (any && m ? digCopyRx(e) : e));
        const occV = (q) => tp.ckey(q) === mine || s.occGet(tp.ckey(q)) >= 0;
        const won = any ? rowResolve([r].concat(cp.filter((x, i) => kids[i][2])), [mine].concat(kids.filter((x) => x[2]).map((x) => x[0])), occV) : [];   // L48: the owner and the backup owner of a row below meet here
        kids.forEach(([rk], i) => foldSlot(s, r, rk, cp[i]));
        r.rows = won; if (kids.every((x) => !x[2])) for (const x of d.rows) if (x.e !== 2) r.rows.push(rowCopy(x));
        digTrim(r); rowDig = r;
      }
      if (c.pc === 0) {   // Section 1 folds the room; one author, one section (its newest report)
        const R = dig0(); R.at = LT; R.rx = LT; R.by = me;
        const ins = new Map();   // L48: an owner row in Section 1 and its backup owner are both here
        for (let r0 = 0; r0 < C; r0++) for (let i0 = 0; i0 < C; i0++) {
          const k = tp.ckey({ pc: 0, r: r0, i: i0 }); if (k === mine) { ins.set(k, myDig); continue; }
          const it = s1tab.get(k); if (!it || superseded(it) || !slotMode(s, k, it)) continue; ins.set(k, it);
        }
        let cps = null;
        if ([...ins.values()].some((x) => (x.rows || []).some((y) => y.e === 1))) { cps = new Map(); for (const [k, x] of ins) cps.set(k, digCopyRx(x)); rowResolve([...cps.values()], [...cps.keys()], (q) => tp.ckey(q) === mine || s.occGet(tp.ckey(q)) >= 0); }
        const pick = (k, x) => (cps && cps.has(k) ? cps.get(k) : x);
        for (let r0 = 0; r0 < C; r0++) for (let i0 = 0; i0 < C; i0++) {
          const k = tp.ckey({ pc: 0, r: r0, i: i0 }); if (k === mine) { digFold(R, pick(k, myDig)); continue; }
          const it = s1tab.get(k); if (it && superseded(it)) continue;
          foldSlot(s, R, k, pick(k, it));
        }
        digTrim(R); let thin = false; if (rootKeep && rootKeep.at >= 0 && s.TICK - rootKeepAt <= 16 && R.n + (R.leased || 0) < rootKeep.n + (rootKeep.leased || 0)) { let nm = 0, fl = 0; for (const [ek, ev] of s.occ) { if (ek >= 65536 || ev < 0 || ek === mine) continue; nm++; const t = s1tab.get(ek); if (t && t.at >= 0) fl++; } thin = fl < nm; }   // L3.12.3: new in Section 1, a seat I name has no report in my table yet: keep the room I knew
        rootHeld = thin; rootDig = thin ? rootKeep : R;
      }
    }
    // One fold per beat: the seat's rollup stamped lastPubAt this tick, and its frames go out right after.
    function foldNow(s) {
      if (!s || s.state !== 3 || !s.hasCoord) return false;
      if (foldBeat === s.lastPubAt && foldCell === TP().ckey(s.coord)) return true;
      if (s.lastPubAt < 0) return false;
      foldBeat = s.lastPubAt; rollupP(s); return true;
    }
    // THE STUB (0.9.24 stubFor): whole when changed or STUB_FULL ticks passed, else "what I sent is still true, and this old".
    function stubFor(s, to, slot, d, w) {
      const key = to + '|' + slot, h = digHash(d), st = digSent.get(key), t = s.TICK;
      if (st && st.h === h && t - st.full < STUB_FULL) { const sb = { stub: 1, at: w.at, ag: w.ag || 0, h }; if (w.by != null) sb.by = w.by; return sb; }
      if (digSent.size > 1024) digSent.clear();
      digSent.set(key, { h, full: t });
      return w;
    }
    function want(peer, slot) { let q = digWant.get(peer); if (!q) { if (digWant.size > 64) digWant.clear(); digWant.set(peer, q = new Set()); } if (q.size < 32) q.add(slot); }
    function stubTake(s, m, h, how, peer, slot) {
      if (m.stub !== 1 || typeof m.h !== 'string' || m.h.length > 24 || !Number.isFinite(m.at) || m.at < 0) return;
      if (!h || h.at < 0 || digHash(h) !== m.h || (m.by !== undefined && String(m.by).slice(0, 64) !== h.by)) { want(peer, slot); return; }
      const a = INT(m.ag) ? Math.min(Math.max(m.ag, 0), 1 << 20) : 0;
      if (how === 'root') { if (!(h.rx == null || s.LT() - a > h.rx)) return; if (m.at > h.at) h.at = m.at; h.ag = a; rxDig(s, h); return; }
      if (!(m.at > h.at)) return;
      h.at = m.at; h.ag = a; rxDig(s, h);
    }
    // sideOut: what rides beside seat frame m to peer `to` (null: nothing). Same frames and targets as the seat's digests.
    function sideOut(to, m) {
      const s = raw(); if (!m || !s || !foldNow(s) || (m.t !== 'S1SYNC' && m.id !== s.id)) return null;   // my own frames (S1SYNC names no author: it is my link's)
      const c = s.coord, tp = TP(); let pd = null;
      if (m.t === 'PHONE' && m.dgUp && m.dgUp.at >= 0) {
        if (c.pc === 0) pd = { u: stubFor(s, to, 'sec', myDig, wireDig(s, myDig)) };   // rook peers: the section digest, stubbed
        else pd = { u: wireDig(s, c.i === 0 ? rowDig : myDig) };                       // to an aggregator: whole, every beat
      } else if (m.t === 'PHONE' && m.tag === 5 && c.pc !== 0 && c.i !== 0 && myDig.at >= 0) {   // L48: a stand-in beat carries my own report to the heir (the seat's dgSi)
        pd = { u: wireDig(s, myDig) };
      } else if (m.t === 'PONG' && m.dgRoot && m.dgRoot.at >= 0 && rootDig.at >= 0) {
        const w = wireDig(s, rootDig); delete w.by; pd = { r: stubFor(s, to, 'root', rootDig, w) };
      } else if (m.t === 'S1SYNC' && m.digs && m.digs.length && c.pc === 0) {
        const mine = tp.ckey(c), a = [{ k: mine, d: stubFor(s, to, 's1:' + mine, myDig, wireDig(s, myDig)) }];
        for (const [k, e] of s1tab) if (k !== mine && s.LT() - e.rx <= DIG_TTL && (e.by == null || seatHolds(s, k, ids.nid(e.by)))) a.push({ k, d: stubFor(s, to, 's1:' + k, e, wireDig(s, e)) });   // the seat relays its cleaned table
        pd = { s: a };
      } else if (m.t === 'U2BEAT' && m.dgUp && m.dgUp.at >= 0) {   // L2.4: hot E2, the row's fold rides the beat (head alone in its row: its own; the source: the head's last)
        const hk = tp.ckey({ pc: c.pc, r: c.r, i: 0 }), hn = s.occGet(hk);
        const d = c.i === 0 ? rowDig : (u2RowDig.at >= 0 && u2RowDig.by != null && hn >= 0 && P(hn) === u2RowDig.by) ? u2RowDig : (hn < 0 || s.headGone()) ? (siDig.at >= 0 ? siDig : myDig) : null;
        if (d && d.at >= 0) { const w = wireDig(s, d); delete w.rows; pd = { u: w }; }   // L48: the head's last fold while I still name that head, else the row's own fold (mine and my mates')
      } else if (m.t === 'U2ACK' && rootDig.at >= 0 && servesHot(s, to)) {   // L2.4: the room's fold down the hot E2, as the head's PONG would carry it: a row whose up path is E2 still reads the room
        const w = wireDig(s, rootDig); delete w.by; pd = { r: stubFor(s, to, 'root', rootDig, w) };
      } else if (m.t === 'PONG' && m.tag === 5 && rootDig.at >= 0) {   // L2.7: a heir standing in for its head passes that fold on to the row
        const w = wireDig(s, rootDig); delete w.by; pd = { r: stubFor(s, to, 'root', rootDig, w) };
      }
      if (m.t === 'PONG' && m.dgPub && m.dgPub.at >= 0 && c.pc !== 0 && c.i === 0 && rowDig.at >= 0 && e2SrcIs(s, to)) {   // the source's copy (the seat's u2RowDig, from its head's PONG)
        pd = pd || {}; pd.p = stubFor(s, to, 'rowp', rowDig, wireDig(s, rowDig));
      }
      const q = digWant.get(to); if (q && q.size) { pd = pd || {}; pd.dw = Array.from(q); digWant.delete(to); }
      return pd;
    }
    // sideIn: what rode beside a verified frame over the dc from peer `from` (the wire calls it for direct frames only).
    function sideIn(from, m, pd) {
      const s = raw(); if (!s || s.state !== 3 || !s.hasCoord || !pd || typeof pd !== 'object' || !m || (m.t !== 'S1SYNC' && m.id !== ids.nid(from))) return;
      const c = s.coord, tp = TP(), C = SC();
      if (Array.isArray(pd.dw)) for (const sl of pd.dw.slice(0, 32)) if (typeof sl === 'string' && sl.length <= 24) digSent.delete(from + '|' + sl);
      if (pd.s && Array.isArray(pd.s) && m.t === 'S1SYNC' && c.pc === 0 && pd.s.length <= C * C) {
        for (const e of pd.s) {
          if (!e || !INT(e.k) || Math.floor(e.k / 65536) !== 0 || e.k === tp.ckey(c)) continue;
          s1Slot(s, from, e.k, e.d, 's1:' + e.k);
        }
        return;
      }
      if (!m.coord) return;
      const pk = tp.ckey(m.coord);
      if (pd.u && m.t === 'U2BEAT') {   // the seat's U2Row.dig: held while I serve that row, by the source the seat names (its own check: a backup owner need not name a deep cell)
        const rk = tp.ckey({ pc: m.coord.pc, r: m.coord.r, i: 0 }), e = s.u2Rows.get(rk * 2); if (!e || e.heir !== m.id) return;
        const u = digSane(pd.u); if (u && m.coord.i === 0 && u.by != null && u.by !== from) return;   // a head beats with its own row fold only
        if (u) { if (u.by == null) u.by = from; if (u2Folds.size > 2 * C) u2Folds.clear(); u2Folds.set(rk, rxDig(s, u)); }   // L48: the row's author stays (one author's copies compare by its stamp)
        return;
      }
      const e2Far = m.t === 'U2ACK' && (m.id === s.u2Id || m.id === s.u3Id);   // the seat already took this far end from its row's PONG; a deep view need not name its cell
      if (!e2Far && s.occGet(pk) !== m.id) return;
      if (pd.p && m.t === 'PONG' && c.pc !== 0 && c.i !== 0 && pk === tp.ckey({ pc: c.pc, r: c.r, i: 0 })) {
        if (pd.p.stub === 1) stubTake(s, pd.p, u2RowDig, 'row', from, 'rowp'); else { const u = digSane(pd.p); if (u) { u.by = from; u2RowDig = rxDig(s, u); } }
      }
      if (pd.u && m.t === 'PHONE' && m.tag === 5) {   // L48: a row-mate's own report while I stand in for our head (the seat takes the PHONE only then)
        if (m.tock === tp.ckey(c) && c.pc !== 0 && c.i !== 0 && m.coord.pc === c.pc && m.coord.r === c.r && m.coord.i !== 0 && s.headGone()) { const u = digSane(pd.u); if (u) { u.by = from; delete u.rows; if (siKids.size >= C) siKids.clear(); siKids.set(pk, rxDig(s, u)); } }
        return;
      }
      if (pd.u && m.t === 'PHONE' && m.tock === tp.ckey(c)) {
        if (pk === tp.ckey(tp.down(c))) { const u = digSane(pd.u); if (u) { u.by = from; downDig = rxDig(s, u); } }
        else if (c.pc === 0 && m.coord.pc === 0) s1Slot(s, from, pk, pd.u, 'sec');
        else if (c.pc !== 0 && c.i === 0 && m.coord.pc === c.pc && m.coord.r === c.r) { const u = digSane(pd.u); if (u) { u.by = from; rowKids.set(pk, rxDig(s, u)); } }
      } else if (pd.r && c.pc !== 0 && ((m.t === 'PONG' && (s.ownedLinkCell(pk) || (m.tag === 5 && m.coord.pc === c.pc && m.coord.r === c.r))) || e2Far)) {
        if (pd.r.stub === 1) { stubTake(s, pd.r, rootDig, 'root', from, 'root'); return; }
        const rt = digSane(pd.r); if (!rt) return; rxDig(s, rt);
        if (rootDig.at < 0 || rt.rx > rootDig.rx) rootDig = rt;
      }
    }
    function s1Slot(s, from, k, x, slot) {
      if (!x || typeof x !== 'object') return;
      if (x.stub === 1) { stubTake(s, x, s1tab.get(k), 's1', from, slot); return; }
      const u = digSane(x); if (!u || u.by == null) return; rxDig(s, u); if (u.at < 0 || s.LT() - u.rx > DIG_TTL) return;
      { const g = s.digForgot && s.digForgot.get(k); if (g !== undefined && g[0] === ids.nid(u.by) && u.rx <= g[1] + 8 && s.LT() - g[1] <= DIG_TTL) return; }   // the seat's s1Take: a vacated cell's last report
      const cur = s1tab.get(k); if (cur && cur.by === u.by && !(u.at > cur.at)) return;   // same author, a newer author stamp wins
      if (cur && cur.by !== u.by && !(cur.rx <= u.rx)) return;   // the seat's s1Take: another author's report takes the slot only if received no earlier
      s1tab.set(k, u);
    }
    function roomDigest() {
      const s = raw(); if (!s || s.state !== 3 || !foldNow(s) || !rootDig || rootDig.at < 0) return null;
      const d = rootDig; let shown = d.n + (d.leased || 0);
      if (rootHeld) { const sr = s.dRoot(); if (sr && sr.at >= 0 && sr.n + (sr.leased || 0) < shown) shown = sr.n + (sr.leased || 0); }   // L3.12.3: a held fold never reads above my seat's
      return { at: d.at, age: s.LT() - (d.rx != null ? d.rx : d.at), n: shown, refuse: d.refuse, part: d.part, handN: d.handN || 0, awayN: d.awayN || 0,
        hands: (d.hands || []).map((e) => Object.assign({}, e)), stage: (d.stage || []).map((e) => Object.assign({}, e)),
        apps: (d.apps || []).map((e) => Object.assign({}, e)), votes: (d.votes || []).map((v) => Object.assign({}, v)) };
    }

    // ---- L27 vote-off: the page's choice into the seat's statement, the seat's fold back to the page ------------
    // setKicks(peers): who I vote off (the seat's kyes, one statement version per change; it rides PHONE).
    function setKicks(list) {
      const s = raw(); if (!s) return;
      const want = Array.from(new Set((list || []).map(ids.nid).filter((x) => x >= 0 && x !== s.id))).sort((a, b) => a - b);
      const cur = Array.from(s.kyes || []).sort((a, b) => a - b);
      if (want.length === cur.length && want.every((x, i) => x === cur[i])) return;
      s.kyes.length = 0; for (const x of want) s.kyes.push(x); s.kver = (s.kver | 0) + 1;
    }
    // kickTally(): the seat's decision fold (rootDec.kick) as peers: {tally: {peer: up}, need: {peer: n}, me: bool}
    // with the seat's own threshold (route.js kOver); `me` is true when the fold votes ME off.
    function kickTally() {
      const s = raw(), out = { tally: {}, need: {}, me: false }; if (!s || !s.rootDec) return out;
      const R = s.rootDec; const K = GifOS.meshConsts ? GifOS.meshConsts.consts : null;
      if (R.at < 0 || R.part || R.rx < 0 || (K && s.LT() - R.rx > K.DIG_TTL)) return out;
      const pop = Math.max(0, R.n) + Math.max(0, R.leased || 0);
      for (const e of R.kick || []) {
        const need = Math.max(2, Math.trunc((pop - (R.kabs || 0) - e.dn) / 2) + 1);
        if (e.tgt === s.id) { if (e.up >= need) out.me = true; }
        const p = P(e.tgt); if (p == null) continue; out.tally[p] = e.up; out.need[p] = need;
      }
      return out;
    }

    // ---- L27 across a rejoin: the verdict is about the identity (the device), not one peer id -------------------
    // In the sim a seat's id IS its identity, so a refused T stays refused when it comes back. A page that rejoins
    // gets a new peer id; the page knows which peers share a device. kickDevs(devOf): the devices my seat refuses
    // (devOf(peer) -> tag; a tag is remembered while its peer id stays refused, after the peer itself is gone).
    // kickCarry(peers): refuse those peers too (the same goodbye/heal/close as the verdict, L27.5), traced KICK-ID.
    const kDev = new Map();   // refused seat id -> device tag
    function kickDevs(devOf) {
      const s = raw(), out = new Set(); if (!s || !s.vban) return out;
      for (const t of Array.from(kDev.keys())) if (!s.vban.has(t)) kDev.delete(t);
      for (const t of s.vban.keys()) { const p = P(t); const d = p != null ? devOf(p) : ''; if (d && !kDev.has(t)) kDev.set(t, d); const k = kDev.get(t); if (k) out.add(k); }
      return out;
    }
    function kicked(pid) { const s = raw(); if (!s || !s.vban) return false; const x = ids.nid(pid); return x >= 0 && s.vban.has(x); }
    function kickCarry(list) {
      const s = raw(); if (!s || !s.vban || !s.hasCoord || s.state !== 3) return 0;
      let n = 0;
      for (const pid of list || []) {
        const x = ids.nid(pid); if (x < 0 || x === s.id || s.vban.has(x)) continue;
        s.vban.set(x, s.TICK); s.trace('KICK-ID', s.id, s.coord, 'tgt=%d', x); s.kBanOn(x); n++;
      }
      return n;
    }

    // ---- per tick (after the seat's tick) -------------------------------------------------------------------------
    function afterTick() { bump(); replayNew(); refan(); }

    // seen(gid): a gossip frame I already took (the wire skips the signature check for its later copies)
    const seen = (gid) => typeof gid === 'string' && gseen.has(gid);
    return { ids, view, gossip, gossipRecv, seen, setKicks, kickTally, kickDevs, kickCarry, kicked, setLeaf, setRefuses, roomDigest, sideOut, sideIn, afterTick, bump };
  }

  const api = Object.freeze({ create, makeIds });
  GifOS.meshPortLayer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
