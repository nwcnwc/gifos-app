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
 *   leaf    setLeaf / roomDigest: each page's display facts ride an ephemeral
 *           gossip beside the sim's leaf; roomDigest() folds what was heard.
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
  const AD_STR = ['app', 'title', 'icon', 'by', 'url', 'room', 'kind', 'src'], AD_BOOL = ['open', 'live'];
  const STR = (x, n) => typeof x === 'string' && x.length <= n;
  const saneAd = (a) => !!a && typeof a === 'object' && !Array.isArray(a) && JSON.stringify(a).length <= 1024;
  const copyAd = (a) => { try { return JSON.parse(JSON.stringify(a)); } catch (e) { return null; } };
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
  const LEAF_EVERY = 20, LEAF_MIN = 2, LEAF_TTL = 60;   // ticks: republish, earliest re-send on a change, forget

  /**
   * create(o) -> layer
   *   o.peer           my peer id (string)
   *   o.raw()          the ported Seat (or null before build)
   *   o.emit(peer, f)  hand a page frame (GSP / GSPS) to the wire (it signs gossip and sends on the dc)
   *   o.onGossip(src, m, ageTicks, scoped) -> false refuses
   *   o.ckey(c)        the page's string cell key (net.topo.ckey)
   *   o.ownedLinks(c)  topo owned links of a coord (for the section scope)
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
      keepPeers() { return keepSet(); },
      // The old page's door and fork helpers: the new seat runs its own L16 knocker and L8 islands decide.
      heardFrom() {}, answerDoor() {}, doorRound() {}, chooseFork() { return false; },
      get gspInAll() { return counters.gspInAll; }, get gspRefused() { return counters.gspRefused; },
      get gspForged() { return counters.gspForged; }, get gspDropped() { return counters.gspDropped; },
    };

    // ---- gossip ---------------------------------------------------------------------------------------------
    let gseq = 0; const gseen = new Map(); let grecent = []; const bkt = new Map();
    function sectionPeers() {
      const s = raw(), out = new Set(); if (!s || !s.hasCoord) return out;
      for (const olc of o.ownedLinks(s.coord)) { if (olc.pc !== s.coord.pc) continue; const x = s.occ.get(olc.pc * 65536 + olc.r * 256 + olc.i); const p = P(x); if (p != null && p !== me) out.add(p); }
      return out;
    }
    const peersFor = (sc) => (sc !== undefined ? sectionPeers() : linkSet(15));
    function frameOf(e) { const f = { t: e.sc !== undefined ? 'GSPS' : 'GSP', gid: e.gid, src: e.src, m: e.m }; if (e.sc !== undefined) f.sc = e.sc; if (e.eph) f.eph = 1; if (e.s4) f.s4 = e.s4; const ag = (e.ag0 || 0) + (e.at != null ? Math.max(0, T() - e.at) : 0); if (ag > 0) f.ag = ag; return f; }
    function remember(gid, src, m, sc, ag0, s4, tx) { const e = { gid, src, m, at: T(), tx: tx || new Map() }; if (sc !== undefined) e.sc = sc; if (ag0) e.ag0 = ag0; if (s4) e.s4 = s4; grecent.push(e); if (grecent.length > 64) grecent.shift(); }
    function budget(link, src) {
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
      if (m.m && m.m.k === '__leaf') leafIn(m.src, m.m.l, ag);
      else {
        let own = m.m; try { if (m.m && typeof m.m === 'object') own = JSON.parse(JSON.stringify(m.m)); } catch (e) {}
        if (o.onGossip) { let ok; try { ok = o.onGossip(m.src, own, ag, scoped); } catch (e) {} if (ok === false) { counters.gspRefused++; return; } }
      }
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

    // ---- leaf and digest -------------------------------------------------------------------------------------------
    const leaf = newLeaf(); let refuses = false, leafDirty = true, leafSentAt = -1000;
    const heard = new Map();   // peer -> {l, at, ag}
    function setLeaf(f) { cleanLeaf(leaf, f); leafDirty = true; }
    function setRefuses(b) { if (!!b !== refuses) { refuses = !!b; leafDirty = true; } }
    function leafIn(src, l, ag) {
      if (src === me || !l || typeof l !== 'object') return;
      const L = newLeaf(); cleanLeaf(L, l); L.refuse = l.refuse ? 1 : 0;
      heard.set(src, { l: L, at: T() - ag });
      if (heard.size > 4096) heard.delete(heard.keys().next().value);
    }
    function leafOut() {
      const s = raw(); if (!s || s.state !== 3 || !s.hasCoord) return;
      const t = T();
      if (!(leafDirty ? t - leafSentAt >= LEAF_MIN : t - leafSentAt >= LEAF_EVERY)) return;
      leafDirty = false; leafSentAt = t;
      gossip({ k: '__leaf', l: Object.assign({}, leaf, { refuse: refuses ? 1 : 0 }) }, { ephemeral: true });
    }
    function voteAdd(votes, v) { const e = votes.find((x) => x.tgt === v.tgt); if (e) { e.up += v.up; e.dn += v.dn; if (v.ab) e.ab = (e.ab || 0) + 1; } else votes.push(Object.assign({}, v)); }
    function roomDigest() {
      const s = raw(); if (!s || s.state !== 3) return null;
      const t = T();
      const d = { at: t, age: 0, n: 0, refuse: 0, part: 0, handN: 0, awayN: 0, hands: [], stage: [], apps: [], votes: [] };
      const add = (id, L, refuse) => {
        d.n++; if (refuse) d.refuse++;
        if (L.hand) { d.handN++; d.hands.push({ id, k: L.hand, nm: L.nm }); }
        if (L.stage) d.stage.push({ id, k: L.stage, f: L.sf, nm: L.nm, dv: L.dv });
        if (L.app && L.ad) d.apps.push({ id, k: L.app, a: copyAd(L.ad) });
        if (L.away || L.vab.includes('*')) d.awayN++;
        else {
          for (const g of L.vup) if (!L.vab.includes(g)) voteAdd(d.votes, { tgt: g, up: 1, dn: 0 });
          for (const g of L.vdn) if (!L.vab.includes(g)) voteAdd(d.votes, { tgt: g, up: 0, dn: 1 });
          for (const g of L.vab) voteAdd(d.votes, { tgt: g, up: 0, dn: 0, ab: 1 });
        }
      };
      add(me, leaf, refuses);
      for (const [p, h] of heard) { if (t - h.at > LEAF_TTL) { heard.delete(p); continue; } add(p, h.l, h.l.refuse); }
      return d;
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

    // ---- per tick (after the seat's tick) -------------------------------------------------------------------------
    function afterTick() { bump(); replayNew(); refan(); leafOut(); }

    return { ids, view, gossip, gossipRecv, setKicks, kickTally, setLeaf, setRefuses, roomDigest, afterTick, bump, heardLeaves: () => heard.size };
  }

  const api = Object.freeze({ create, makeIds });
  GifOS.meshPortLayer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
