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
 *   leaf    setLeaf: my facts go into the seat's own fields (handT, stageT, stageF, appT, away, refuses, vup, vdn), and the
 *           seat folds them up its tree. The seat's digest is the only fold of the room.
 *   facts   what the seat's digest cannot hold: a person's peer id, name and device, an app's ad, a vote's string tag.
 *           They ride beside the seat's digest frames (MW2 `pd`) for the people and tags those frames name, once per
 *           peer and change; roomDigest joins them onto the seat's lists. No frame of its own, no decision reads them.
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

  // ---- what the seat's digest cannot hold -------------------------------------------------------------------------------
  // A vote's tag is a device hash, the seat's target an int: hash it, and let the frames that name the int carry the string.
  // The seat's vote has up and dn only, so an abstain on t is an up-vote on a second target, t + AB.
  const AB = '\u0001ab', FACT_FULL = 240, FACTS_MAX = 512;
  const tagInt = (t) => { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return (h >>> 0) % 2147483647; };
  const veOrd = (a, b) => { const ta = a.up + a.dn, tb = b.up + b.dn; return ta !== tb ? tb - ta : (a.tgt < b.tgt ? -1 : a.tgt > b.tgt ? 1 : 0); };
  const arr = (x) => (Array.isArray(x) ? x : []);
  // The digests a seat frame carries (written or wire form; dgEcho only repeats what its receiver wrote).
  const framesDigs = (m) => { const a = []; for (const f of ['dgUp', 'dgPub', 'dgRoot', 'dgSi']) if (m[f] && m[f].at >= 0) a.push(m[f]); for (const e of arr(m.digs)) if (e && e.d) a.push(e.d); return a; };
  function eachName(d, who, tag) {
    const les = (x) => { for (const f of ['hands', 'stage', 'apps']) for (const e of arr(x[f])) if (e) who(e.id); };
    les(d); for (const r of arr(d.rows)) if (r) les(r);
    for (const v of arr(d.votes)) if (v) tag(v.tgt);
  }

  /**
   * create(o) -> layer
   *   o.peer           my peer id (string)
   *   o.raw()          the ported Seat (or null before build)
   *   o.emit(peer, f)  hand a page frame (GSP / GSPS) to the wire (it signs gossip and sends on the dc)
   *   o.onGossip(src, m, ageTicks, scoped, link) -> false refuses the frame; 'link' refuses only this copy, for the way it came
   *                    (link: the peer whose own proven channel carried it, if any)
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
    const counters = { gspInAll: 0, gspRefused: 0, gspRefusedLink: 0, gspForged: 0, gspDropped: 0, gspStale: 0 };
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
      // L48: the rows' folds I hold while I serve them, as the seat's l48Up reads them (read only).
      u2Folds() { const s = raw(), out = [], K = KC(); if (!s) return out; for (const [k, e] of s.u2Rows) { const d = e.dig; if (e.heir < 0 || d.at < 0 || d.rx < 0 || s.TICK - e.at > K.L48_BEAT || s.LT() - d.rx > K.LEASE_T) continue; out.push({ row: Math.floor(k / 2), n: d.n, leased: d.leased, handN: d.handN, hands: d.hands.length, age: s.LT() - d.rx }); } return out; },
      keepPeers() { return keepSet(); },
      // L28: this device is using the pc to that peer, for so many ticks (my end only, budgeted by the seat).
      keepAdd(peer, ticks) { const s = raw(); if (!s || !s.keepAdd) return; const x = ids.nid(peer); if (x >= 0) s.keepAdd(x, ticks); },
      // E2 and E3 as the seat holds them, as peers (read only): the media plane ships over these pcs.
      get u2Id() { const s = raw(); return s && s.hasCoord && s.coord.pc !== 0 && s.u2Id >= 0 && s.u2Id !== s.id ? P(s.u2Id) : null; },   // a seat in Section 1 holds no E2 (the seat clears it there; the guard stays for a tick read before that)
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
      get gspForged() { return counters.gspForged; }, get gspDropped() { return counters.gspDropped; }, get gspRefusedLink() { return counters.gspRefusedLink; },
    };

    // ---- gossip ---------------------------------------------------------------------------------------------
    let gseq = Date.now();   /* a gossip id must not repeat across a reload of the same identity: the room still holds the old ones as seen and drops the new as copies */ const gseen = new Map(); let grecent = []; const bkt = new Map();
    // THE NEWEST VERIFIED GOSSIP FROM A SOURCE SETS ITS MARK. gseen forgets a gid after ten minutes (or past 65536
    // entries), so a frame delayed longer than that (a page stalled, then draining its channels) read as new on
    // every page and was flooded again by each of them. A gid is src:seq with seq counting up for the life of the
    // identity (gseq), so a frame this far behind the newest verified seq from its source is minutes old on every
    // path: nothing new, not verified, never passed on. Only a verified newer seq moves the mark.
    const gmark = new Map(); const GMARK_BEHIND = 1024;
    // A COPY REFUSED FOR THE WAY IT CAME IS NOT THE FRAME'S ANSWER. The app may refuse a copy for its channel alone
    // (onGossip -> 'link': room content from an author it does not know, on no member's proven channel). That copy
    // must not mark the gid seen: the same frame handed on by a member over its own channel is the room's, and a
    // seen gid would drop it. What is kept is the (gid, channel) pair, so that channel's later copies are copies
    // (never verified again) while another channel's copy is still heard. It is never forwarded, so it cannot cascade.
    const gref = new Map(); const GREF_MAX = 4096;
    const copyKey = (gid, lk) => gid + '|' + (lk == null ? '' : lk);
    const gseqOf = (gid, src) => +gid.slice(src.length + 1);
    const gstale = (gid, src) => { const mk = gmark.get(src); if (mk === undefined) return false; const n = gseqOf(gid, src); return Number.isFinite(n) && n < mk - GMARK_BEHIND; };
    const gmarkUp = (gid, src) => { const n = gseqOf(gid, src); if (!Number.isFinite(n) || gmark.get(src) > n) return; gmark.set(src, n); if (gmark.size > 4096) gmark.delete(gmark.keys().next().value); };
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
      const gid = me + ':' + (++gseq); gseen.set(gid, T()); gmarkUp(gid, me);
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
      if (gstale(m.gid, m.src)) { counters.gspStale++; return; }
      if (gseen.has(m.gid) || gref.has(copyKey(m.gid, m.lk))) return;
      if (!budget(m.lk != null ? m.lk : m.from, m.src)) { counters.gspDropped++; return; }
      gseen.set(m.gid, T()); gmarkUp(m.gid, m.src);
      if (gseen.size > 4096) { for (const [k, at] of gseen) { if (T() - at > 600) gseen.delete(k); else break; } }
      if (gseen.size > 65536) { let n = gseen.size - 32768; for (const k of gseen.keys()) { if (n-- <= 0) break; gseen.delete(k); } }
      ids.learn(m.src);
      const ag = Number.isInteger(m.ag) && m.ag > 0 ? Math.min(m.ag, 1 << 20) : 0;
      let own = m.m; try { if (m.m && typeof m.m === 'object') own = JSON.parse(JSON.stringify(m.m)); } catch (e) {}
      if (o.onGossip) {
        let ok; try { ok = o.onGossip(m.src, own, ag, scoped, m.lk); } catch (e) {}
        if (ok === 'link') { gseen.delete(m.gid); gref.set(copyKey(m.gid, m.lk), T()); if (gref.size > GREF_MAX) gref.delete(gref.keys().next().value); counters.gspRefusedLink++; return; }
        if (ok === false) { counters.gspRefused++; return; }
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

    // ---- leaf: my facts into the seat, and the people the seat's digest names ---------------------------------
    const leaf = newLeaf(); let refuses = false, fedSeat = null, fedGen = 0, leafGen = 1;
    const KC = () => (GifOS.meshConsts ? GifOS.meshConsts.consts : { LEASE_T: 220 });
    const TP = () => GifOS.meshTopo;
    const facts = new Map(), tags = new Map();   // seat id -> { p, v, nm, dv, a, seen }; tag int -> { t, seen }
    const sent = new Map(), wants = new Map();   // peer -> Map(what -> { v, at }): what it has from me; peer -> Set(what): what it lacks from me
    const learnTag = (t, tick) => { const k = tagInt(t), g = tags.get(k); if (g && g.t === t) g.seen = tick; else tags.set(k, { t, seen: tick }); };
    function feed(s) {   // the seat's rollup reads these on its own beat, and L10 sends a change early
      if (!s || (s === fedSeat && fedGen === leafGen)) return;
      fedSeat = s; fedGen = leafGen;
      const L = leaf, ab = L.vab.filter((t) => t !== '*'), allAb = ab.length !== L.vab.length;
      s.refuses = refuses;
      s.handT = Math.floor(L.hand); s.stageT = Math.floor(L.stage); s.stageF = L.sf; s.appT = L.ad ? Math.floor(L.app) : 0;
      s.away = L.away || allAb;
      for (const t of L.vup.concat(L.vdn)) learnTag(t, s.TICK); for (const t of ab) learnTag(t + AB, s.TICK);
      s.vup = L.vup.filter((t) => !ab.includes(t)).map(tagInt).concat(ab.map((t) => tagInt(t + AB)));
      s.vdn = L.vdn.filter((t) => !ab.includes(t)).map(tagInt);
    }
    function setLeaf(f) {
      cleanLeaf(leaf, f); leafGen++;
      const my = ids.nid(me), c = facts.get(my), nm = leaf.nm, dv = leaf.dv, a = leaf.ad;
      if (!c || c.nm !== nm || c.dv !== dv || JSON.stringify(c.a) !== JSON.stringify(a)) facts.set(my, { p: me, v: Math.max(c ? c.v + 1 : 0, Date.now()), nm, dv, a, seen: Infinity });
      feed(raw());
    }
    function setRefuses(b) { refuses = !!b; leafGen++; feed(raw()); }
    function want(peer, what) { let q = wants.get(peer); if (!q) { if (wants.size > 64) wants.clear(); wants.set(peer, q = new Set()); } if (q.size < 32) q.add(what); }
    // sideOut: what rides beside seat frame m to peer `to` (null: nothing): the facts of those its digests name, once per peer and change.
    function sideOut(to, m) {
      const s = raw(); if (!m || !s || (m.t !== 'S1SYNC' && m.id !== s.id)) return null;   // my own frames (S1SYNC names no author: it is my link's)
      const t = s.TICK; let pd = null, sn = null;
      const fresh = (what, v) => {
        if (!sn) { sn = sent.get(to); if (!sn) { if (sent.size > 64) sent.clear(); sent.set(to, sn = new Map()); } }
        const st = sn.get(what); if (st && st.v === v && t - st.at < FACT_FULL) return false;
        sn.set(what, { v, at: t }); return true;
      };
      for (const d of framesDigs(m)) eachName(d, (x) => {
        const f = facts.get(x); if (!f) return; if (f.seen !== Infinity) f.seen = t;
        if (fresh(x, f.v)) { pd = pd || {}; (pd.x = pd.x || []).push(f.a ? [f.p, f.v, f.nm, f.dv, f.a] : [f.p, f.v, f.nm, f.dv]); }
      }, (x) => {
        const g = tags.get(x); if (!g) return; g.seen = t;
        if (fresh('t' + x, 1)) { pd = pd || {}; (pd.vt = pd.vt || []).push(g.t); }
      });
      const q = wants.get(to); if (q && q.size) { pd = pd || {}; pd.dw = Array.from(q); wants.delete(to); }
      return pd;
    }
    // sideIn: what rode beside a verified frame over the dc from peer `from` (the wire calls it for direct frames only).
    function sideIn(from, m, pd) {
      const s = raw(); if (!s || !m || (m.t !== 'S1SYNC' && m.id !== ids.nid(from))) return;
      const t = s.TICK;
      if (pd && typeof pd === 'object') {
        const sn = sent.get(from); if (sn) for (const w of arr(pd.dw).slice(0, 32)) sn.delete(w);
        for (const e of arr(pd.x).slice(0, FACTS_MAX)) {
          if (!Array.isArray(e) || !STR(e[0], 64) || !Number.isFinite(e[1]) || !STR(e[2], 24) || !STR(e[3], 16) || (e[4] !== undefined && !saneAd(e[4]))) continue;
          const x = ids.nid(e[0]), c = facts.get(x); if (x < 0 || x === ids.nid(me) || (c && e[1] <= c.v && e[0] !== from)) continue;   // the newest of an author's changes; its own word always
          if (!c && facts.size >= FACTS_MAX) continue;
          facts.set(x, { p: e[0], v: e[1], nm: e[2], dv: e[3], a: e[4] ? copyAd(e[4]) : null, seen: t });
        }
        for (const v of arr(pd.vt).slice(0, 64)) if (STR(v, 16 + AB.length) && (tags.size < FACTS_MAX || tags.has(tagInt(v)))) learnTag(v, t);
      }
      for (const d of framesDigs(m)) eachName(d, (x) => { const f = facts.get(x); if (f) { if (f.seen !== Infinity) f.seen = t; } else if (Number.isFinite(x)) want(from, x); },
        (x) => { const g = tags.get(x); if (g) g.seen = t; else if (Number.isFinite(x)) want(from, 't' + x); });
    }
    function factsSweep(t) {   // nobody's digest has named them for two leases
      const old = 2 * KC().LEASE_T;
      for (const [x, f] of facts) if (t - f.seen > old) facts.delete(x);
      const mine = new Set(leaf.vup.concat(leaf.vdn, leaf.vab.map((v) => v + AB)));
      for (const [x, g] of tags) if (t - g.seen > old && !mine.has(g.t)) tags.delete(x);
    }
    // The seat's room fold, as the page reads it: its counts as they are, its lists with the people's names on.
    function roomDigest() {
      const s = raw(); if (!s || s.state !== 3 || !s.hasCoord) return null;
      const d = s.rootDig; if (!d || d.at < 0) return null;
      const t = s.TICK, who = (x) => { const f = facts.get(x); if (f && f.seen !== Infinity) f.seen = t; return f || null; };
      const hands = [], stage = [], apps = [], votes = new Map();
      for (const e of d.hands) { const id = P(e.id); if (id == null) continue; const f = who(e.id); hands.push({ id, k: e.k, nm: f ? f.nm : '' }); }
      for (const e of d.stage) { const id = P(e.id); if (id == null) continue; const f = who(e.id); stage.push({ id, k: e.k, f: e.f, nm: f ? f.nm : '', dv: f ? f.dv : '' }); }
      for (const e of d.apps) { const id = P(e.id), f = who(e.id); if (id != null && f && f.a) apps.push({ id, k: e.k, a: copyAd(f.a) }); }   // an ad not yet here is no app yet
      for (const v of d.votes) {
        const g = tags.get(v.tgt); if (!g) continue; g.seen = t;
        const isAb = g.t.endsWith(AB), tag = isAb ? g.t.slice(0, -AB.length) : g.t;
        let o = votes.get(tag); if (!o) votes.set(tag, o = { tgt: tag, up: 0, dn: 0 });
        if (isAb) { if (v.up) o.ab = v.up; } else { o.up = v.up; o.dn = v.dn; }
      }
      return { at: d.at, age: s.LT() - (d.rx >= 0 ? d.rx : d.at), n: d.n + d.leased, refuse: d.refuse, part: d.part, handN: d.handN, awayN: d.awayN, hands, stage, apps, votes: Array.from(votes.values()).sort(veOrd) };
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
    function afterTick() { const s = raw(); feed(s); if (s && !(s.TICK & 63)) factsSweep(s.TICK); bump(); replayNew(); refan(); }

    // seen(gid, lk): a gossip frame I already took, one behind its source's mark, or a copy over a channel whose copy of it
    // was refused for that channel (the wire skips the signature check for all three)
    const seen = (gid, lk) => typeof gid === 'string' && (gseen.has(gid) || gref.has(copyKey(gid, lk)) || gstale(gid, gid.slice(0, gid.lastIndexOf(':'))));
    return { ids, view, gossip, gossipRecv, countForged: () => { counters.gspForged++; }, seen, setKicks, kickTally, kickDevs, kickCarry, kicked, setLeaf, setRefuses, roomDigest, sideOut, sideIn, afterTick, bump };
  }

  const api = Object.freeze({ create, makeIds });
  GifOS.meshPortLayer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
