'use strict';
/*
 * net.js: reachability groups, the relay's meters and the doorway (port plan H2), a line-for-line port of the sim's
 * mesh_net.inc at 37d787b2d. Harness code: never shipped. install(fab) needs link.js installed first.
 *
 * Tables are fab.NETG / SEATGRP / NETCUT / NETLIFT / METER / planGrp (fabric.js); fab.NET_ARRIVAL and fab.NETMOVEQ are
 * this file's. A group pair {a,b} in NETCUT / NETLIFT is the number min*1e6+max.
 * hooks.netgSize (js/mesh/ring.js, when that unit is present) is set here to fabric::NETG.size().
 *
 * NOT PORTED: the observers that only print (islandsReport, relaystat, netfind) and the lever printfs;
 * netgroups parsing and the netmove / netcut / netlift / netjoin levers are ported as functions.
 */
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const topo = require(path.join(M, 'topo.js'));
const seatM = require(path.join(M, 'seat.js'));
const C_ = require(path.join(M, 'consts.js'));
const { Seat } = seatM;
const K = C_.consts, E = C_.enums;
const { GT_PUBLIC, GT_BLOCKED, GT_SYM, LK_OPEN } = E;

function install(fab) {
  const { lv, seats, alive, X } = fab;
  const w = fab.w, TICK = () => w.TICK;
  const L = fab.link;
  const api = {};
  fab.NET_ARRIVAL = 'interleaved'; fab.NETMOVEQ = new Map();
  const firstTick = (m) => { let f = Infinity; for (const k of m.keys()) if (k < f) f = k; return f; };
  const gkey = (a, b) => Math.min(a, b) * 1e6 + Math.max(a, b);

  // The side-laws unit reads fabric::NETG.size() through ring.js's hooks.
  try { const ring = require(path.join(M, 'ring.js')); if (ring && ring.hooks) ring.hooks.netgSize = () => fab.NETG.length; } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }

  // C++: mesh_net.inc:grpOf
  const grpOf = api.grpOf = (id) => (id >= 0 && id < fab.SEATGRP.length) ? fab.SEATGRP[id] : -1;
  // C++: mesh_net.inc:grpReach
  const grpReach = (a, b) => {
    if (!lv.NETGRP) return true;
    const ga = grpOf(a), gb = grpOf(b); if (ga < 0 || gb < 0) return true;
    if (ga === gb) return a === b || !fab.NETG[ga].iso;
    const k = gkey(ga, gb);
    if (fab.NETCUT.has(k)) return false;
    if (fab.NETLIFT.has(k)) return true;
    const ta = fab.NETG[ga].type, tb = fab.NETG[gb].type;
    if (ta === GT_BLOCKED || tb === GT_BLOCKED) return false;
    if (ta === GT_SYM && tb === GT_SYM) return false;
    return true;
  };
  // C++: mesh_net.inc:netRefuse
  const netRefuse = (from, to, m) => {
    void m; const both = lv.SEND_SOCK >= 0 ? lv.SEND_SOCK === 1 : (seats[from].socketed() && seats[to].socketed()); if (both) lv.RELAY_REFUSED++; else lv.NET_DROPS++;
  };
  // C++: mesh_net.inc:relayMeter
  const relayMeter = api.relayMeter = (id, frames) => {
    let mt = fab.METER.get(id); if (mt === undefined) { mt = { frames: 600, bytes: 1048576, strikes: 0, at: -1 }; fab.METER.set(id, mt); }
    const door = fab.relayGreeters.has(id);
    const fb = K.RELAY_FRAME_BURST, bb = K.RELAY_BYTE_BURST * (door ? K.RELAY_DOOR_X : 1), br = K.RELAY_BYTES_PER_TICK * (door ? K.RELAY_DOOR_X : 1);
    if (mt.at < 0) { mt.frames = fb; mt.bytes = bb; }
    else { const dt = TICK() - mt.at; mt.frames = Math.min(fb, mt.frames + dt * K.RELAY_FRAMES_PER_TICK); mt.bytes = Math.min(bb, mt.bytes + dt * br); }
    mt.at = TICK();
    const need = frames * K.RELAY_FRAME_BYTES;
    if (mt.bytes < need) return false;
    if (!door && mt.frames < frames) { if (++mt.strikes >= K.RELAY_FRAME_STRIKES) { fab.sockCloseAt.set(id, TICK()); lv.RELAY_CUTS++; } return false; }
    mt.bytes -= need; if (!door) mt.frames -= frames; return true;
  };
  // C++: mesh_net.inc:netKnockOk
  const netKnockOk = (id) => { lv.RELAY_KNOCKS++; if (lv.KNOCK_T !== TICK()) { lv.KNOCK_T = TICK(); lv.KNOCK_N = 0; } if (++lv.KNOCK_N > lv.KNOCK_PEAK) lv.KNOCK_PEAK = lv.KNOCK_N; return relayMeter(id, 1); };
  // C++: mesh_net.inc:netSignal
  const netSignal = (a, b) => {
    if (!lv.NETGRP && !lv.RELAYSTAT) return;
    const sa = seats[a].socketed(), sb = seats[b].socketed(); if (!sa && !sb) return;
    lv.RELAY_SIGNAL++; if (lv.NETGRP) { if (sa) relayMeter(a, 3); if (sb) relayMeter(b, 3); }
  };
  // C++: mesh_net.inc:netPlanArrivals
  const netPlanArrivals = (n) => {
    const pg = fab.planGrp; pg.length = 0; for (let i = 0; i < n; i++) pg.push(-1); if (!lv.NETGRP) return;
    const left = fab.NETG.map((g) => g.size);
    if (fab.NET_ARRIVAL === 'grouped') { let k = 0; for (let g = 0; g < fab.NETG.length && k < n; g++) for (let q = 0; q < fab.NETG[g].size && k < n; q++) pg[k++] = g; }
    else {
      let k = 0; while (k < n) { let any = false; for (let g = 0; g < fab.NETG.length && k < n; g++) if (left[g] > 0) { pg[k++] = g; left[g]--; any = true; } if (!any) break; }
      if (fab.NET_ARRIVAL === 'random') { for (let k2 = n - 1; k2 > 0; k2--) { const j = Math.trunc(fab.grnd() * (k2 + 1)); const t = pg[k2]; pg[k2] = pg[j]; pg[j] = t; } }
    }
    for (let k = 0; k < n; k++) if (pg[k] < 0) pg[k] = 0;
  };
  // C++: mesh_net.inc:netSetGrp
  const netSetGrp = (id, g) => { const sg = fab.SEATGRP; while (sg.length <= id) sg.push(-1); sg[id] = g; };
  // C++: mesh_net.inc:netNoteSpawn
  const netNoteSpawn = (id) => {
    const sp = fab.SPAWNT, fs = fab.FIRSTSEAT; while (sp.length <= id) { sp.push(-1); fs.push(-1); }
    sp[id] = TICK(); fs[id] = -1;
  };
  // C++: mesh_net.inc:netNoteTake
  const netNoteTake = (id) => { if (id < fab.FIRSTSEAT.length && fab.FIRSTSEAT[id] < 0) fab.FIRSTSEAT[id] = TICK(); };

  // C++: mesh_net.inc:netTick
  // netmove: the phone's links all break on the new address (closed 6-25 ticks later, dc close at both ends).
  const netTick = () => {
    const Q = fab.NETMOVEQ;
    while (Q.size && firstTick(Q) <= TICK()) {
      const f = firstTick(Q); const v = Q.get(f); Q.delete(f);
      for (const id of v) {
        if (!lv.LINKMODEL) continue; L.lEnsure(id); const ps = L.LINKPEERS[id].slice();
        for (const p of ps) { const lk = L.linkFind(id, p); if (lk && lk.state === LK_OPEN) L.closeBoth(lk, id, p, false, 'netmove'); }
      }
    }
  };
  // C++: mesh_net.inc:netCutLinks
  // The links a firewall just cut go silent both ways (half-open; their pcs time out).
  const netCutLinks = (ga, gb) => {
    if (!lv.LINKMODEL) return;
    for (let q = 0; q < lv.nextId; q++) {
      if (!alive[q] || grpOf(q) !== ga) continue; L.lEnsure(q); const ps = L.LINKPEERS[q].slice();
      for (const p of ps) { if (grpOf(p) !== gb) continue; const lk = L.linkFind(q, p); if (lk && lk.state === LK_OPEN) L.linkHalf(lk, q, p, 3, false); }
    }
  };

  // ---- the levers (state change only: no printf) --------------------------------------------------------------------
  const atoi = fab.link.atoi;
  // C++: mesh_net.inc:grpByName
  const grpByName = (n) => { for (let g = 0; g < fab.NETG.length; g++) if (fab.NETG[g].name === n) return g; return -1; };
  // C++: mesh_net.inc:parseGroup
  const parseGroup = (t) => {
    const a = t.indexOf(':'); if (a < 0) return null; const b = t.indexOf(':', a + 1); if (b < 0) return null;
    const g = { name: t.slice(0, a), type: 0, size: 0, iso: false }; const ty = t.slice(a + 1, b); let rest = t.slice(b + 1);
    const c = rest.indexOf(':'); if (c >= 0) { g.iso = rest.slice(c + 1) === 'iso'; rest = rest.slice(0, c); }
    g.size = atoi(rest); if (ty !== 'blocked' && ty !== 'symmetric' && ty !== 'sym' && ty !== 'public') return null;
    g.type = ty === 'blocked' ? GT_BLOCKED : (ty === 'symmetric' || ty === 'sym') ? GT_SYM : GT_PUBLIC; return g;
  };
  // C++: mesh_net.inc:netLever
  // tk: the lever's words. The reports (islands, relaystat, netfind) only print and are not here.
  api.lever = (tk) => {
    const op = tk[0];
    if (op === 'netgroups') {
      fab.NETG.length = 0; lv.NETGRP = false;
      for (let z = 1; z < tk.length; z++) {
        const t = tk[z];
        if (t.startsWith('arrival=')) { fab.NET_ARRIVAL = t.slice(8); continue; }
        if (t === 'off') { fab.NETG.length = 0; break; }
        const g = parseGroup(t); if (!g) { fab.NETG.length = 0; return; } fab.NETG.push(g);
      }
      lv.NETGRP = fab.NETG.length > 0; lv.ISLAND_MODE = lv.NETGRP ? lv.ISLAND_PICK : 0;
    } else if (op === 'island') { const a = tk.length > 1 ? tk[1] : 'found'; lv.ISLAND_PICK = a === 'strand' ? 2 : a === 'off' ? 0 : 1; if (lv.NETGRP) lv.ISLAND_MODE = lv.ISLAND_PICK; }
    else if (op === 'netjoin') {
      if (!lv.NETGRP) return;
      const a = tk.length > 1 ? tk[1] : ''; let g = -1, k = 0; const ng = parseGroup(a);
      if (ng) { g = grpByName(ng.name); if (g < 0) { const sz = ng.size; ng.size = 0; fab.NETG.push(ng); g = fab.NETG.length - 1; k = sz; } else k = ng.size; }
      else { g = grpByName(a); k = tk.length > 2 ? atoi(tk[2]) : 1; }
      if (g < 0 || k <= 0) return;
      for (let q = 0; q < k; q++) {
        const id = lv.nextId++; while (seats.length <= id) { seats.push(null); alive.push(0); }
        seats[id] = new Seat(id, w); alive[id] = 1; netSetGrp(id, g); netNoteSpawn(id); fab.NETG[g].size++; seats[id].join();
      }
      lv.N += k;
    } else if (op === 'netmove') {
      const id = tk.length > 1 ? atoi(tk[1]) : -1; const g = tk.length > 2 ? grpByName(tk[2]) : -1;
      if (!lv.NETGRP || id < 0 || id >= lv.nextId || !alive[id] || g < 0) return;
      netSetGrp(id, g);
      if (lv.LINKMODEL) {
        L.lEnsure(id); for (const p of L.LINKPEERS[id]) { const lk = L.linkFind(id, p); if (lk && lk.state === LK_OPEN) L.linkHalf(lk, id, p, 3, false); }
        const at = TICK() + L.ldraw(6, 25, id, g, 0x6d6f7665); let v = fab.NETMOVEQ.get(at); if (!v) { v = []; fab.NETMOVEQ.set(at, v); } v.push(id);
      }
    } else if (op === 'netcut' || op === 'netlift') {
      const a = tk.length > 1 ? grpByName(tk[1]) : -1, b = tk.length > 2 ? grpByName(tk[2]) : -1;
      if (!lv.NETGRP || a < 0 || b < 0 || a === b) return;
      const k = gkey(a, b);
      if (op === 'netcut') { fab.NETLIFT.delete(k); fab.NETCUT.add(k); netCutLinks(a, b); netCutLinks(b, a); }
      else { fab.NETCUT.delete(k); fab.NETLIFT.add(k); }
    }
  };

  fab.net = api;
  fab.plug({ grpReach, netRefuse, netKnockOk, netSetGrp, netNoteSpawn, netNoteTake, netPlanArrivals, netTick, relayMeter, netSignal });
  return api;
}
module.exports = { install };
