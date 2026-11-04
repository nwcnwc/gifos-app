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
  const dig0 = () => ({ n: 0, leased: 0, refuse: 0, at: -1, by: null, part: 0, handN: 0, awayN: 0, hands: [], stage: [], apps: [], votes: [] });
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
  const digLists = (dst, s, cap) => {
    dst.handN += Math.min(s.handN || 0, cap); dst.awayN += Math.min(s.awayN || 0, cap);
    dst.hands = listMerge(dst.hands, s.hands, K_HAND, true); dst.stage = listMerge(dst.stage, s.stage, K_STAGE(), true); dst.apps = listMerge(dst.apps, s.apps, K_APP, false);
    for (const v of (s.votes || [])) voteAdd(dst.votes, { tgt: v.tgt, up: Math.min(v.up, cap), dn: Math.min(v.dn, cap), ab: Math.min(v.ab || 0, cap) });
  };
  const digFold = (dst, s) => { const cap = (s.n < 0 ? 0 : s.n) + (s.leased || 0); dst.n += s.n; dst.leased += s.leased || 0; dst.refuse += s.refuse; if (s.part) dst.part = 1; digLists(dst, s, cap); };
  const digFoldHeld = (dst, s) => { const cap = (s.n < 0 ? 0 : s.n) + (s.leased || 0); dst.leased += cap; digLists(dst, s, cap); };   // the seat's L3.12: held under its lease
  const digTrim = (d) => {
    const cap = (d.n < 0 ? 0 : d.n) + (d.leased || 0);
    if (d.handN > cap) d.handN = cap; if (d.awayN > cap) d.awayN = cap;
    for (const v of d.votes) { if (v.up > cap) v.up = cap; if (v.dn > cap) v.dn = cap; if (v.ab > cap) { if (cap) v.ab = cap; else delete v.ab; } }
    d.votes.sort(veOrd); if (d.votes.length > K_VOTE) d.votes.length = K_VOTE;
  };
  const DIG_H = Symbol('h');
  const digHash = (d) => {
    const hit = d[DIG_H]; if (hit) return hit;
    const t = JSON.stringify([d.n, d.leased || 0, d.refuse, d.part ? 1 : 0, d.handN || 0, d.awayN || 0, d.hands || [], d.stage || [], d.apps || [], d.votes || []]);
    let a = 2166136261 >>> 0, b = 0x9e3779b9 >>> 0;
    for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519); }
    const h = (a >>> 0).toString(36) + (b >>> 0).toString(36);
    d[DIG_H] = h;
    return h;
  };
  const leCopy = (e) => { const c = Object.assign({}, e); if (e.a) c.a = Object.assign({}, e.a); return c; };
  const digCopy = (d) => ({ n: d.n, leased: d.leased || 0, refuse: d.refuse, at: d.at, by: d.by, part: d.part, handN: d.handN || 0, awayN: d.awayN || 0,
    hands: (d.hands || []).map(leCopy), stage: (d.stage || []).map(leCopy), apps: (d.apps || []).map(leCopy), votes: (d.votes || []).map(voteCopy) });
  const digPack = (o) => {
    if (!o.leased) delete o.leased; if (!o.part) delete o.part; if (!o.ag) delete o.ag;
    if (!o.handN) delete o.handN; if (!o.awayN) delete o.awayN;
    for (const f of ['hands', 'stage', 'apps', 'votes']) if (!o[f] || !o[f].length) delete o[f];
    return o;
  };
  const saneLE = (e, kind) => !!e && STR(e.id, 64) && Number.isFinite(e.k) && (e.f === undefined || INT(e.f)) && (e.nm === undefined || STR(e.nm, 24))
    && (e.dv === undefined || STR(e.dv, 16)) && (kind !== 'app' || e.a === undefined || saneAd(e.a));
  const digSane = (d) => {
    if (!d || typeof d !== 'object' || !INT(d.n) || !INT(d.refuse) || !Number.isFinite(d.at)) return null;
    const o = { n: d.n, leased: INT(d.leased) && d.leased > 0 ? d.leased : 0, refuse: d.refuse, at: d.at, ag: INT(d.ag) && d.ag >= 0 ? Math.min(d.ag, 1 << 20) : 0, by: d.by == null ? null : String(d.by).slice(0, 64), part: d.part ? 1 : 0,
      handN: INT(d.handN) && d.handN >= 0 ? d.handN : 0, awayN: INT(d.awayN) && d.awayN >= 0 ? d.awayN : 0, hands: [], stage: [], apps: [], votes: [] };
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
    return o;
  };

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
        return s.coord.pc !== 0 ? s.headGone() : (h < 0 || h === s.id || s.darkMate(hk) || s.f.fabricLinkState(s.id, h) === GifOS.meshConsts.LS_CLOSED);
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
    let myDig = dig0(), rowDig = dig0(), rootDig = dig0(), downDig = dig0(), u2RowDig = dig0(), foldSig = null, foldBeat = -1, foldCell = -1;
    const rowKids = new Map(), s1tab = new Map(), u2Folds = new Map();
    const e2SrcIs = (s, to) => { const R = GifOS.meshRoles, tp = TP(); if (!R) return false; const x = R.e2SrcOf({ pc: s.coord.pc, r: s.coord.r, i: 0 }, (q) => s.occGet(tp.ckey(q)) >= 0); return !!x && P(s.occGet(tp.ckey(x))) === to; };
    const digSent = new Map(), digWant = new Map();
    const rxDig = (s, d) => { d.rx = s.LT() - (INT(d.ag) ? Math.min(Math.max(d.ag, 0), 1 << 20) : 0); return d; };
    const wireDig = (s, d) => { const c = digCopy(d); const st = d.rx != null ? d.rx : d.at; c.ag = st >= 0 ? Math.max(0, s.LT() - st) : 0; return digPack(c); };
    // A cell whose occupant the seat no longer names (0.9.24 digForget): a different seat there, or nobody.
    const named = (s, k, e) => { const x = s.occGet(k); return x >= 0 && e.by != null && x === ids.nid(e.by); };
    const held = (s, k, e) => e.at >= 0 && named(s, k, e) && s.LT() - e.rx <= KC().LEASE_T;
    const gapAt = (s, k) => { const sv = s.findNc; s.findNc = -1; try { return s.scopeGap(k); } finally { s.findNc = sv; } };   // the seat's own G3 read, scoped as its rollup scopes it
    function foldSlot(s, dst, k, e) {   // 0.9.24 rollup: fresh folds, stale fails closed (the seat's L3.12 lease in between)
      const LT = s.LT();
      if (e && e.at >= 0 && named(s, k, e) && LT - e.rx <= DIG_TTL) { digFold(dst, e); return; }
      if (gapAt(s, k)) { dst.part = 1; dst.refuse += 1; }
      if (e && held(s, k, e)) digFoldHeld(dst, e);
    }
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
      if (mine !== foldCell) { foldCell = mine; downDig = dig0(); rowKids.clear(); s1tab.clear(); foldSig = null; u2RowDig = dig0(); u2Folds.clear(); }
      const L = leaf, dk = tp.ckey(tp.down(c));
      const newest = new Map();
      if (c.pc === 0) for (const e of s1tab.values()) if (e.by != null && LT - e.rx <= DIG_TTL) { const nb = newest.get(e.by); if (nb === undefined || nb < e.at) newest.set(e.by, e.at); }
      const superseded = (it) => LT - it.rx <= DIG_TTL && it.by != null && (it.by === me || newest.get(it.by) !== it.at);
      let sig = (refuses ? 1 : 0) + ',' + (s.TICK < s.digHoldUntil ? 1 : 0) + ',' + slotSig(s, dk, downDig)
        + ',' + (L.hand || 0) + ',' + (L.stage || 0) + ',' + (L.sf | 0) + ',' + (L.app || 0) + ',' + (L.away ? 1 : 0)
        + ',' + L.nm + ',' + L.dv + ',' + (L.ad ? JSON.stringify(L.ad) : '') + ',' + L.vup.join('\n') + ',' + L.vdn.join('\n') + ',' + L.vab.join('\n');
      if (c.pc !== 0 && c.i === 0) for (let j = 1; j < C; j++) { const rk = tp.ckey({ pc: c.pc, r: c.r, i: j }); sig += slotSig(s, rk, rowKids.get(rk)); }
      if (c.pc === 0) for (let r0 = 0; r0 < C; r0++) for (let i0 = 0; i0 < C; i0++) {
        const k = tp.ckey({ pc: 0, r: r0, i: i0 }); if (k === mine) { sig += ':me'; continue; }
        const it = s1tab.get(k); sig += it && superseded(it) ? ':-' : slotSig(s, k, it);
      }
      if (foldSig === sig && myDig.at >= 0) {
        myDig.at = LT; myDig.rx = LT; if (c.pc !== 0 && c.i === 0) { rowDig.at = LT; rowDig.rx = LT; } if (c.pc === 0) { rootDig.at = LT; rootDig.rx = LT; }
        return;
      }
      foldSig = sig;
      const d = ownDig(s, LT); foldSlot(s, d, dk, downDig); digTrim(d); myDig = d;
      if (c.pc !== 0 && c.i === 0) {   // a deep row head folds its row (its owner is linked only to it)
        const r = digCopy(d); r.at = LT; r.rx = LT; r.by = me;
        for (let j = 1; j < C; j++) { const rk = tp.ckey({ pc: c.pc, r: c.r, i: j }); foldSlot(s, r, rk, rowKids.get(rk)); }
        digTrim(r); rowDig = r;
      }
      if (c.pc === 0) {   // Section 1 folds the room; one author, one section (its newest report)
        const R = dig0(); R.at = LT; R.rx = LT; R.by = me;
        for (let r0 = 0; r0 < C; r0++) for (let i0 = 0; i0 < C; i0++) {
          const k = tp.ckey({ pc: 0, r: r0, i: i0 }); if (k === mine) { digFold(R, myDig); continue; }
          const it = s1tab.get(k); if (it && superseded(it)) continue;
          foldSlot(s, R, k, it);
        }
        digTrim(R); rootDig = R;
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
      } else if (m.t === 'PONG' && m.dgRoot && m.dgRoot.at >= 0 && rootDig.at >= 0) {
        const w = wireDig(s, rootDig); delete w.by; pd = { r: stubFor(s, to, 'root', rootDig, w) };
      } else if (m.t === 'S1SYNC' && m.digs && m.digs.length && c.pc === 0) {
        const mine = tp.ckey(c), a = [{ k: mine, d: stubFor(s, to, 's1:' + mine, myDig, wireDig(s, myDig)) }];
        for (const [k, e] of s1tab) if (k !== mine && s.LT() - e.rx <= DIG_TTL) a.push({ k, d: stubFor(s, to, 's1:' + k, e, wireDig(s, e)) });
        pd = { s: a };
      } else if (m.t === 'U2BEAT' && m.dgUp && m.dgUp.at >= 0) {   // L2.4: hot E2, the row's fold rides the beat (head alone in its row: its own; the source: the head's last)
        const d = c.i === 0 ? rowDig : u2RowDig; if (d.at >= 0) pd = { u: wireDig(s, d) };
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
      const pk = tp.ckey(m.coord); if (s.occGet(pk) !== m.id) return;
      if (pd.p && m.t === 'PONG' && c.pc !== 0 && c.i !== 0 && pk === tp.ckey({ pc: c.pc, r: c.r, i: 0 })) {
        if (pd.p.stub === 1) stubTake(s, pd.p, u2RowDig, 'row', from, 'rowp'); else { const u = digSane(pd.p); if (u) { u.by = from; u2RowDig = rxDig(s, u); } }
      }
      if (pd.u && m.t === 'U2BEAT') {   // the seat's U2Row.dig: held while I serve that row, by the source the seat names
        const rk = tp.ckey({ pc: m.coord.pc, r: m.coord.r, i: 0 }), e = s.u2Rows.get(rk * 2); if (!e || e.heir !== m.id) return;
        const u = digSane(pd.u); if (u) { u.by = from; if (u2Folds.size > 2 * C) u2Folds.clear(); u2Folds.set(rk, rxDig(s, u)); }
        return;
      }
      if (pd.u && m.t === 'PHONE' && m.tock === tp.ckey(c)) {
        if (pk === tp.ckey(tp.down(c))) { const u = digSane(pd.u); if (u) { u.by = from; downDig = rxDig(s, u); } }
        else if (c.pc === 0 && m.coord.pc === 0) s1Slot(s, from, pk, pd.u, 'sec');
        else if (c.pc !== 0 && c.i === 0 && m.coord.pc === c.pc && m.coord.r === c.r) { const u = digSane(pd.u); if (u) { u.by = from; rowKids.set(pk, rxDig(s, u)); } }
      } else if (pd.r && m.t === 'PONG' && c.pc !== 0 && s.ownedLinkCell(pk)) {
        if (pd.r.stub === 1) { stubTake(s, pd.r, rootDig, 'root', from, 'root'); return; }
        const rt = digSane(pd.r); if (!rt) return; rxDig(s, rt);
        if (rootDig.at < 0 || rt.rx > rootDig.rx) rootDig = rt;
      }
    }
    function s1Slot(s, from, k, x, slot) {
      if (!x || typeof x !== 'object') return;
      if (x.stub === 1) { stubTake(s, x, s1tab.get(k), 's1', from, slot); return; }
      const u = digSane(x); if (!u || u.by == null) return; rxDig(s, u); if (u.at < 0 || s.LT() - u.rx > DIG_TTL) return;
      const cur = s1tab.get(k); if (cur && cur.by === u.by && !(u.at > cur.at)) return;   // same author, a newer author stamp wins
      s1tab.set(k, u);
    }
    function roomDigest() {
      const s = raw(); if (!s || s.state !== 3 || !foldNow(s) || !rootDig || rootDig.at < 0) return null;
      const d = rootDig;
      return { at: d.at, age: s.LT() - (d.rx != null ? d.rx : d.at), n: d.n + (d.leased || 0), refuse: d.refuse, part: d.part, handN: d.handN || 0, awayN: d.awayN || 0,
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
