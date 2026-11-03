'use strict';
/*
 * levers.js: the printing levers of the link, keep, linkset and time units (port plan H3, handed over by the
 * coordinator): linkLever, radioLever, keepLever, linksetLever, and timeLever with its reload, plus the observers
 * (link stat / peers / show, twocells, linked, allsee, verdicts). Harness code, never shipped.
 *
 * link.js and time.js carry the lever's STATE CHANGE and print nothing. These functions are the sim's levers
 * whole: they make the sim's own checks and print its own lines, and call the unit's state change when the sim
 * would act. They need link.js and time.js installed first (fab.link, fab.time). `reload` calls Seat.leave(true)
 * and queues the same-identity return in fab.RESUMEQ, as the sim does.
 *
 *   require('./levers.js').install(fab)   -> fab.X.linkLever, radioLever, keepLever, linksetLever, timeLever, l30Stat
 */
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const C_ = require(path.join(M, 'consts.js'));
const topo = require(path.join(M, 'topo.js'));
const { Seat } = require(path.join(M, 'seat.js'));
const K = C_.consts, E = C_.enums;
const { ckey, unckey, ownedLinks } = topo;
const LK_NAME = ['none', 'dialing', 'open', 'closed'];
const atoi = (s) => { const v = parseInt(s, 10); return Number.isNaN(v) ? 0 : (v | 0); };
const atoll = (s) => { const v = parseInt(s, 10); return Number.isNaN(v) ? 0 : v; };

function install(fab) {
  const lv = fab.lv, seats = fab.seats, alive = fab.alive, w = fab.w, X = fab.X;
  const P = (f, ...a) => fab.printf(f, ...a);
  const TICK = () => w.TICK, coordStr = fab.coordStr;
  const link = fab.link, time = fab.time;
  const { lEnd, lEnsure, linkFind, linkGet } = link;
  const u32 = (x) => x >>> 0;

  // C++: mesh_link.inc:linkLever
  function linkLever(tk) {
    const sub = tk.length > 1 ? tk[1] : '';
    if (sub === 'mobile') { lv.LMOBILE = tk.length > 2 ? parseFloat(tk[2]) || 0 : 0; P('OK link mobile=%.2f\n', lv.LMOBILE); return; }
    if (sub === 'stat') {
      let open = 0, half = 0, closed = 0, dial = 0;
      for (const [, L] of link.LINKS) { if (L.state === E.LK_OPEN) { if (L.half) half++; else open++; } else if (L.state === E.LK_CLOSED) closed++; else if (L.state === E.LK_DIALING) dial++; }
      const S = link.LSTAT;
      P('LINKSTAT model=%d links=%zu open=%lld half=%lld dialing=%lld closed=%lld dials=%lld opened=%lld dialfail=%lld reopen=%lld translost=%lld debounced=%lld starve=%lld icefail=%lld\n', lv.LINKMODEL ? 1 : 0, link.LINKS.size, open, half, dial, closed, S[0], S[1], S[2], S[3], S[4], S[5], S[6], S[7]);
      P('LINKSTAT-L15 doors_closed=%lld doors_standing=%zu\n', lv.L15_CLOSED, link.LDOORS.size); return;
    }
    if (sub === 'peers') {
      const id = tk.length > 2 ? atoi(tk[2]) : -1; if (id < 0 || id >= lv.nextId) { P('ERR usage: link peers <id>\n'); return; }
      lEnsure(id); P('LINKPEERS %d', id);
      for (const p of link.LINKPEERS[id]) { const L = linkFind(id, p); P(' %d:%s%s', p, LK_NAME[L.state], L.half ? '-half' : ''); }
      P('\n'); return;
    }
    const a = tk.length > 1 ? atoi(tk[1]) : -1, b = tk.length > 2 ? atoi(tk[2]) : -1; const op = tk.length > 3 ? tk[3] : 'show';
    if (!lv.LINKMODEL) { P('ERR link needs linkmodel 1\n'); return; }
    if (a < 0 || b < 0 || a === b || a >= lv.nextId || b >= lv.nextId) { P('ERR usage: link <a> <b> half [<a>|<b>] [stuck|fail] | close [fail] | open | show; link mobile <frac>; link stat\n'); return; }
    const Lp = linkFind(a, b);
    if (op === 'show') {
      if (!Lp) { P('LINK %d %d none\n', a, b); return; }
      P('LINK %d %d state=%s half=%d stuck=%d epoch=%u view[%d]=%s view[%d]=%s\n', a, b, LK_NAME[Lp.state], Lp.half ? 1 : 0, Lp.stuck ? 1 : 0, Lp.epoch, a, LK_NAME[Lp.view[lEnd(a, b)]], b, LK_NAME[Lp.view[lEnd(b, a)]]); return;
    }
    if (!Lp || Lp.state !== E.LK_OPEN) { if (op !== 'open') { P('ERR link %d %d is %s, not open\n', a, b, Lp ? LK_NAME[Lp.state] : 'none'); return; } }
    if (op !== 'half' && op !== 'close' && op !== 'open') { P('ERR link: unknown op %s\n', op); return; }
    link.linkLever(tk);   // the state change (linkGet, linkHalf, closeBoth, linkOpenNow)
    const L = linkGet(a, b);
    if (op === 'half') P('OK link %d %d half mask=%d stuck=%d\n', a, b, L.half, L.stuck ? 1 : 0);
    else if (op === 'close') { const fail = tk.length > 4 && tk[4] === 'fail'; P('OK link %d %d closed (%s)\n', a, b, fail ? 'failed-persist' : 'dc-close'); }
    else P('OK link %d %d open\n', a, b);
  }
  // C++: mesh_link.inc:radioLever
  function radioLever(tk) {
    const id = tk.length > 1 ? atoi(tk[1]) : -1; const t = tk.length > 2 ? atoll(tk[2]) : 40;
    if (!lv.LINKMODEL) { P('ERR radio needs linkmodel 1\n'); return; }
    if (id < 0 || id >= lv.nextId || !alive[id] || t <= 0) { P('ERR usage: radio <live id> <ticks>\n'); return; }
    lEnsure(id); let n = 0; for (const p of link.LINKPEERS[id]) { const L = linkFind(id, p); if (L && L.state === E.LK_OPEN) n++; }   // counted before the lever: linkHalf leaves them open
    link.radioLever(tk);
    P('OK radio %d off for %lld ticks (%d open links half-open)\n', id, t, n);
  }
  // `keep <id> <peer> <ticks>`: seat <id> is using its pc to <peer> for <ticks> ticks
  // C++: mesh_linkset_fab.inc:keepLever
  function keepLever(tk) {
    const id = tk.length > 1 ? atoi(tk[1]) : -1, x = tk.length > 2 ? atoi(tk[2]) : -1, t = tk.length > 3 ? atoll(tk[3]) : 0;
    if (id < 0 || id >= lv.nextId || !alive[id] || x < 0 || x >= lv.nextId || x === id || t <= 0) { P('ERR usage: keep <live id> <peer> <ticks>\n'); return; }
    const { gone, dropped } = seats[id].keepAdd(x, t);
    { const L = linkFind(id, x); if (L) L.nnAt[lEnd(id, x)] = -1; }   // K5: a keep is my reason as of now
    fab.trace('KEEP', id, null, 'peer=%d until=%lld', x, TICK() + t);
    if (dropped) fab.trace('KEEP-DROP', id, null, 'peer=%d for=%d', gone, x);
    P('OK keep %d %d until=%lld held=%zu dropped=%d\n', id, x, TICK() + t, seats[id].keeps.length, dropped ? gone : -1);
  }
  // `linkset <id>` shows one seat's linkPeers and keeps; `linkset check` proves linkRole and linkPeers agree on every seat.
  // C++: mesh_linkset_fab.inc:linksetLever
  function linksetLever(tk) {
    if (tk.length > 1 && tk[1] === 'check') {
      let seats_ = 0, peers = 0, bad = 0;
      for (let q = 0; q < lv.nextId; q++) {
        if (!alive[q]) continue; const s = seats[q]; seats_++;
        for (const wnt of [Seat.LR_TOPO, Seat.LR_TOPO | Seat.LR_OWNER, Seat.LR_OWNED, Seat.LR_OWNED | Seat.LR_E2]) {
          const v = []; s.linkPeers(v, wnt); peers += v.length;
          for (let x = 0; x < lv.nextId; x++) { if (x === q) continue; const inn = v.includes(x); if (inn !== s.linkRole(x, wnt)) { bad++; if (bad <= 5) P('LINKSET-BAD seat=%d peer=%d mask=%u list=%d role=%d\n', q, x, wnt, inn ? 1 : 0, inn ? 0 : 1); } }
        }
      }
      P('LINKSET-CHECK seats=%lld peers=%lld bad=%lld\n', seats_, peers, bad); return;
    }
    const id = tk.length > 1 ? atoi(tk[1]) : -1;
    if (id < 0 || id >= lv.nextId || !alive[id]) { P('ERR usage: linkset <live id> | linkset check\n'); return; }
    const s = seats[id]; const v = []; s.linkPeers(v);
    P('LINKSET %d peers=', id); for (let q = 0; q < v.length; q++) P('%s%d', q ? ',' : '', v[q]);
    P(' keeps='); for (let q = 0; q < s.keeps.length; q++) if (TICK() < s.keeps[q].until) P('%s%d:%lld', q ? ',' : '', s.keeps[q].peer, s.keeps[q].until);
    P('\n');
  }
  // L30 (mesh_small.inc) `l30stat`: observer.
  // C++: mesh_link.inc:l30Stat
  function l30Stat(why) {
    let live = 0, on = 0, s1 = 0, fl = 0, mx = 0, last = -1, sil = 0;
    for (let q = 0; q < lv.nextId; q++) { if (!alive[q] || !seats[q]) continue; const s = seats[q]; live++; if (s.hasCoord && s.state === 3 && s.coord.pc === 0) s1++; if (s.l30) on++; sil += s.l30SilN; fl += s.l30Flips; mx = Math.max(mx, s.l30Flips); last = Math.max(last, s.l30At); }
    P('L30STAT tick=%lld live=%d s1=%d small=%d flips=%d maxflips=%d last=%d silent=%lld law=%d\n', TICK(), live, s1, on, fl, mx, last, sil, 1);
    if (why) { const h = [0, 0, 0, 0, 0, 0]; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q] && seats[q].hasCoord && seats[q].coord.pc === 0) h[seats[q].l30DeepWhy()]++; P('L30WHY none=%d row=%d child=%d mine=%d section=%d room=%d\n', h[0], h[1], h[2], h[3], h[4], h[5]); }
  }

  // C++: mesh_time.inc:timeLever
  function timeLever(tk) {
    const op = tk[0];
    const liveId = (i) => { const id = tk.length > i ? atoi(tk[i]) : -1; return (id >= 0 && id < lv.nextId && alive[id]) ? id : -1; };
    const cellStr = (id) => (seats[id].hasCoord ? coordStr(seats[id].coord) : '-');
    if (op === 'freeze') {
      const id = liveId(1); const t = tk.length > 2 ? atoll(tk[2]) : 40; const extra = tk.length > 3 ? atoi(tk[3]) : 0;
      if (id < 0 || t <= 0 || extra < 0) { P('ERR usage: freeze <live id> <ticks> [gap]\n'); return; }
      if (fab.isFrozen(id)) { P('ERR seat %d is frozen already\n', id); return; }
      time.lever(tk); P('OK freeze %d for %lld ticks (gap %d) at %s\n', id, t, extra, cellStr(id));
    } else if (op === 'tickslow') {
      const id = liveId(1); const k = tk.length > 2 ? atoi(tk[2]) : 2; const t = tk.length > 3 ? atoll(tk[3]) : -1;
      if (id < 0 || k < 1) { P('ERR usage: tickslow <live id> <k> [ticks]\n'); return; }
      time.lever(tk); if (k === 1) { P('OK tickslow %d off\n', id); return; }
      P('OK tickslow %d every %d ticks%s\n', id, k, t > 0 ? ' for ' + t + ' ticks' : '');
    } else if (op === 'hide') {
      const id = liveId(1); const t = tk.length > 2 ? atoll(tk[2]) : 120; const k = tk.length > 3 ? atoi(tk[3]) : 24;
      if (id < 0 || t <= 0 || k < 1) { P('ERR usage: hide <live id> <ticks> [k]\n'); return; }
      time.lever(tk); P('OK hide %d for %lld ticks (tick() every %d)\n', id, t, k);
    } else if (op === 'reload') {   // L3.11: the tab is RELOADED: the page says goodbye marked "reload", closes its channels and comes back through the door `gap` ticks later with the SAME identity
      const id = liveId(1); const d = tk.length > 2 ? atoi(tk[2]) : 4;
      if (id < 0 || d < 1) { P('ERR usage: reload <live id> <gap>\n'); return; }
      fab.FROZEN.delete(id); fab.SLOW.delete(id); const oc = seats[id].hasCoord ? ckey(seats[id].coord) : 0;
      seats[id].leave(true); lv.N -= 1; { const k = TICK() + d; fab.RESUMEQ.set(k, (fab.RESUMEQ.get(k) || []).concat([[id, oc]])); }
      fab.trace('RELOAD', id, oc ? seats[id].coord : null, 'returns at %lld', TICK() + d);
      P('OK reload %d: goodbye sent%s, the same id knocks at tick %lld (old cell %s)\n', id, ' marked reload', TICK() + d, oc ? coordStr(unckey(oc)) : '-');
    } else if (op === 'twocells') {   // observer: how many cells do the live seats name this id at
      const id = tk.length > 1 ? atoi(tk[1]) : -1; const cells = new Set();
      if (id >= 0 && id < lv.nextId && alive[id] && seats[id].hasCoord && seats[id].state === 3) cells.add(ckey(seats[id].coord));
      let who = '';
      for (let q = 0; q < lv.nextId; q++) {
        if (!alive[q] || q === id || !seats[q].hasCoord || seats[q].state !== 3) continue;
        for (const c0 of ownedLinks(seats[q].coord)) { const c = ckey(c0); if (seats[q].occGet(c) === id) { cells.add(c); if (tk.length > 2 && tk[2] === 'v') who += ' ' + q + '@' + coordStr(seats[q].coord) + '->' + coordStr(c0); } }
      }
      P('TWOCELLS %d n=%zu%s\n', id, cells.size, who);
    } else if (op === 'reloadnew') {
      const id = liveId(1); const d = tk.length > 2 ? atoi(tk[2]) : 4;
      if (id < 0 || d < 1) { P('ERR usage: reloadnew <live id> [delay]\n'); return; }
      time.lever(tk); P('OK reload %d: dead now, a new id knocks at tick %lld\n', id, TICK() + d);
    } else if (op === 'resume') {
      const id = liveId(1); const d = tk.length > 2 ? atoi(tk[2]) : 2;
      if (id < 0 || d < 1) { P('ERR usage: resume <live id> [delay]\n'); return; }
      const oc = seats[id].hasCoord ? ckey(seats[id].coord) : 0; time.lever(tk);
      P('OK resume %d: gone now, the same id knocks at tick %lld (old cell %s)\n', id, TICK() + d, oc ? coordStr(unckey(oc)) : '-');
    } else if (op === 'doordark') { time.lever(tk); P('OK doordark until %lld\n', lv.DOORDARK); }
    else if (op === 'verdicts') { time.lever(tk); P('VERDICTS on=%d gone=%lld false=%lld frozen=%lld\n', lv.VERDICTS ? 1 : 0, lv.VALL, lv.VFALSE, lv.VFROZEN); }
    else if (op === 'linked') {
      const id = liveId(1); if (id < 0) { P('ERR usage: linked <live id>\n'); return; }
      const s = seats[id]; let named = 0, open = 0, back = 0;
      if (s.hasCoord && s.state === 3) {
        for (const c of ownedLinks(s.coord)) {
          const x = s.occGet(ckey(c)); if (x < 0 || x === id) continue; named++;
          if (X.fabricLinkState(id, x) === E.LS_OPEN && X.fabricLinkState(x, id) === E.LS_OPEN) open++;
          if (x < lv.nextId && alive[x] && seats[x].occGet(ckey(s.coord)) === id) back++;
        }
      }
      const ok = s.state === 3 && named > 0 && open === named && back === named && !fab.isFrozen(id);
      P('LINKED %d ok=%d named=%d open=%d back=%d at=%s\n', id, ok ? 1 : 0, named, open, back, cellStr(id));
    } else if (op === 'allsee') {
      let n = 0, all = 0; const ids = []; for (let q = 0; q < lv.nextId; q++) if (alive[q]) ids.push(q);
      for (const q of ids) { all++; const v = new Set([q]); for (const [, x] of seats[q].occ) if (x >= 0) v.add(x); let ok = true; for (const x of ids) if (!v.has(x)) { ok = false; break; } if (ok) n++; }
      P('ALLSEE %d/%d\n', n, all);
    }
  }

  // ---- the net levers (mesh_net.inc): the state change is net.js's; the sim's checks and lines are here ---------------
  const net = fab.net;
  const GT = E;
  // C++: mesh_net.inc:parseGroup
  const parseGroup = (t) => {
    const a = t.indexOf(':'); if (a < 0) return null; const b = t.indexOf(':', a + 1); if (b < 0) return null;
    const g = { name: t.slice(0, a), type: 0, size: 0, iso: false }; const ty = t.slice(a + 1, b); let rest = t.slice(b + 1);
    const c = rest.indexOf(':'); if (c >= 0) { g.iso = rest.slice(c + 1) === 'iso'; rest = rest.slice(0, c); }
    g.size = atoi(rest); if (ty !== 'blocked' && ty !== 'symmetric' && ty !== 'sym' && ty !== 'public') return null;
    return g;
  };
  const grpByName = (n) => { for (let g = 0; g < fab.NETG.length; g++) if (fab.NETG[g].name === n) return g; return -1; };
  const grpOf = (id) => (id >= 0 && id < fab.SEATGRP.length) ? fab.SEATGRP[id] : -1;
  const islandName = () => (lv.ISLAND_MODE === 1 ? 'found' : lv.ISLAND_MODE === 2 ? 'strand' : 'off');
  // C++: mesh_net.inc:islandsReport
  function islandsReport(since) {
    const ids = []; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3 && seats[q].hasCoord) ids.push(q);
    const par = new Map(); for (const q of ids) par.set(q, q);
    const f = (x) => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
    for (const q of ids) for (const [ek, x] of seats[q].occ) {
      if (x < 0 || x === q || !par.has(x)) continue; if (ckey(seats[x].coord) !== ek || !X.grpReach(q, x)) continue;
      const a = f(q), b = f(x); if (a !== b) par.set(a, b);
    }
    const isl = new Map(); for (const q of ids) { const r = f(q); if (!isl.has(r)) isl.set(r, []); isl.get(r).push(q); }
    const keys = [...isl.keys()].sort((a, b) => a - b);   // a std::map<int,...>
    const born = []; for (const k of keys) { let b = -1; for (const q of isl.get(k)) if (q < fab.FIRSTSEAT.length && fab.FIRSTSEAT[q] >= 0 && (b < 0 || fab.FIRSTSEAT[q] < b)) b = fab.FIRSTSEAT[q]; born.push(b < 0 ? 0 : b); }
    born.sort((a, b) => a - b); if (born.length >= 2) since = Math.max(since, born[1]);
    let unseated = 0, stranded = 0; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state !== 3) { unseated++; if (seats[q].stranded) stranded++; }
    P('ISLANDS split=%lld n=%zu seated=%zu unseated=%d stranded=%d relay: knocks=%lld signal=%lld nondoor=%lld refused=%lld cuts=%lld drops=%lld\n', since, isl.size, ids.length, unseated, stranded, lv.RELAY_KNOCKS, lv.RELAY_SIGNAL, lv.RELAY_NONDOOR, lv.RELAY_REFUSED, lv.RELAY_CUTS, lv.NET_DROPS);
    let k = 0;
    for (const key of keys) {
      const m = isl.get(key); const cells = new Set(), s1 = new Set(); let dups = 0, homes = 0, gre = 0, forked = 0, forkMax = -1; const jt = []; const grp = new Map();
      for (const q of m) {
        const c = ckey(seats[q].coord); if (cells.has(c)) dups++; else cells.add(c);
        if (seats[q].coord.pc === 0) { s1.add(c); gre++; if (seats[q].forkAt >= 0) { forked++; const ref = Math.max(since, seats[q].seatedAt); forkMax = Math.max(forkMax, seats[q].forkAt - ref); } }
        if (c === 0) homes++; grp.set(grpOf(q), (grp.get(grpOf(q)) || 0) + 1);
        if (q < fab.FIRSTSEAT.length && fab.FIRSTSEAT[q] >= 0 && fab.SPAWNT[q] >= 0) jt.push(fab.FIRSTSEAT[q] - fab.SPAWNT[q]);
      }
      jt.sort((a, b) => a - b); const p95 = jt.length ? jt[Math.min(jt.length - 1, Math.trunc((jt.length * 95 + 99) / 100) - 1)] : -1;
      let gs = ''; for (const g of [...grp.keys()].sort((a, b) => a - b)) { if (gs) gs += ','; gs += (g >= 0 && g < fab.NETG.length ? fab.NETG[g].name : '-') + ':' + grp.get(g); }
      P('ISLAND %d size=%zu s1=%zu homes=%d dups=%d greeters=%d forked=%d forkMax=%lld joinP95=%lld groups=%s\n', k++, m.length, s1.size, homes, dups, gre, forked, forkMax, p95, gs);
    }
  }
  // C++: mesh_net.inc:netLever
  function netLever(tk) {
    const op = tk[0];
    if (op === 'netgroups') {
      let bad = null; for (let z = 1; z < tk.length; z++) { const t = tk[z]; if (t.startsWith('arrival=')) continue; if (t === 'off') break; if (!parseGroup(t)) { bad = t; break; } }
      net.lever(tk);
      if (bad !== null) { P('ERR netgroups: bad group %s (NAME:blocked|symmetric|public:SIZE[:iso])\n', bad); return; }
      let sum = 0; for (const g of fab.NETG) sum += g.size;
      P('OK netgroups %zu groups, %d seats, arrival=%s, island=%s\n', fab.NETG.length, sum, fab.NET_ARRIVAL, islandName());
    } else if (op === 'island') { net.lever(tk); const a = tk.length > 1 ? tk[1] : 'found'; P('OK island %s (now %s)\n', a, islandName()); }
    else if (op === 'netjoin') {
      if (!lv.NETGRP) { P('ERR netjoin needs netgroups\n'); return; }
      const a = tk.length > 1 ? tk[1] : ''; let g = -1, k = 0; const ng = parseGroup(a);
      if (ng) { g = grpByName(ng.name); if (g < 0) { k = ng.size; g = fab.NETG.length; } else k = ng.size; } else { g = grpByName(a); k = tk.length > 2 ? atoi(tk[2]) : 1; }
      if (g < 0 || k <= 0) { P('ERR usage: netjoin NAME:type:SIZE | netjoin NAME K\n'); return; }
      net.lever(tk); P('OK netjoin %d in %s (ids %d..%d), N now %d\n', k, fab.NETG[g].name, lv.nextId - k, lv.nextId - 1, lv.N);
    } else if (op === 'netmove') {
      const id = tk.length > 1 ? atoi(tk[1]) : -1; const g = tk.length > 2 ? grpByName(tk[2]) : -1;
      if (!lv.NETGRP || id < 0 || id >= lv.nextId || !alive[id] || g < 0) { P('ERR usage: netmove <live id> <group>\n'); return; }
      net.lever(tk); P('OK netmove %d -> %s\n', id, fab.NETG[g].name);
    } else if (op === 'netcut' || op === 'netlift') {
      const a = tk.length > 1 ? grpByName(tk[1]) : -1, b = tk.length > 2 ? grpByName(tk[2]) : -1;
      if (!lv.NETGRP || a < 0 || b < 0 || a === b) { P('ERR usage: %s <group> <group>\n', op); return; }
      net.lever(tk); P('OK %s %s %s\n', op, fab.NETG[a].name, fab.NETG[b].name);
    } else if (op === 'relaystat') {
      if (tk.length > 1) lv.RELAYSTAT = (tk[1] === 'on' || tk[1] === '1');
      P('RELAYSTAT on=%d knocks=%lld signal=%lld nondoor=%lld refused=%lld cuts=%lld drops=%lld\n', lv.RELAYSTAT ? 1 : 0, lv.RELAY_KNOCKS, lv.RELAY_SIGNAL, lv.RELAY_NONDOOR, lv.RELAY_REFUSED, lv.RELAY_CUTS, lv.NET_DROPS);
    } else if (op === 'netfind') {   // netfind <group> <path>/<r>.<i>: the seat of that group at that cell
      const g = tk.length > 1 ? grpByName(tk[1]) : -1; const a = tk.length > 2 ? tk[2] : ''; const sl = a.indexOf('/'); const dt = sl < 0 ? -1 : a.indexOf('.', sl);
      if (g < 0 || sl < 0 || dt < 0) { P('ERR usage: netfind <group> <path>/<r>.<i>\n'); return; }
      let pc = 0; for (const ch of a.slice(0, sl)) pc = topo.childPath(pc, ch.charCodeAt(0) - 48);
      const k = ckey({ pc, r: atoi(a.slice(sl + 1, dt)), i: atoi(a.slice(dt + 1)) });
      let who = -1; for (let q = 0; q < lv.nextId; q++) if (alive[q] && grpOf(q) === g && seats[q].hasCoord && seats[q].state === 3 && ckey(seats[q].coord) === k) { who = q; break; }
      P('NETFIND %s %s -> seat %d\n', tk[1], a, who);
    } else if (op === 'islands') islandsReport(tk.length > 1 ? atoll(tk[1]) : 0);
  }

  fab.plug({ linkLever, radioLever, keepLever, linksetLever, timeLever, l30Stat, netLever });
  return { linkLever, radioLever, keepLever, linksetLever, timeLever, l30Stat, netLever, islandsReport };
}
module.exports = { install };
