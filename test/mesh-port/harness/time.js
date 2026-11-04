'use strict';
/*
 * time.js: freezes, slow clocks, hidden tabs and reloads (port plan H2), a line-for-line port of the sim's
 * mesh_time.inc at 37d787b2d. Harness code: never shipped. install(fab) needs link.js installed first.
 *
 * NOT PORTED: the lever words' printf lines, the observers (twocells, linked, allsee, verdicts show), the
 * MESH_VERDICTLOG stderr print. The `reload` lever calls Seat::leave (a seat unit): the lever's own steps
 * are reload(); the caller makes the seat leave first. Seat methods used: absence, recv, join; Seat construction.
 */
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const topo = require(path.join(M, 'topo.js'));
const seatM = require(path.join(M, 'seat.js'));
const C_ = require(path.join(M, 'consts.js'));
const { Seat } = seatM;
const K = C_.consts, E = C_.enums;
const { ckey, unckey } = topo;
const { LK_OPEN, LS_OPEN } = E;

function install(fab) {
  const { lv, seats, alive, X } = fab;
  const w = fab.w, TICK = () => w.TICK;
  const trace = fab.trace;
  const L = fab.link;
  const api = {};
  const firstTick = (m) => { let f = Infinity; for (const k of m.keys()) if (k < f) f = k; return f; };

  // C++: mesh_time.inc:spawnOne
  const spawnOne = () => {
    const id = lv.nextId++; while (seats.length <= id) { seats.push(null); alive.push(0); }
    seats[id] = new Seat(id, w); alive[id] = 1; seats[id].join(); lv.N += 1;
  };

  // C++: mesh_time.inc:freezeHold
  // A frame from a peer reaching a stopped renderer is lost; a fabric event for it waits for the thaw (64 at most).
  const freezeHold = (m) => { if (m.from >= 0) return; const it = fab.FROZEN.get(m.to); if (it !== undefined && it.q.length < 64) it.q.push(m); };

  // C++: mesh_time.inc:linkFreeze
  const linkFreeze = (id) => {
    if (!lv.LINKMODEL) return; L.lEnsure(id);
    for (const p of L.LINKPEERS[id]) { const lk = L.linkFind(id, p); if (lk && lk.state === LK_OPEN) L.linkHalf(lk, id, p, 3, false); }
  };
  // C++: mesh_time.inc:linkThaw
  const linkThaw = (id) => {
    if (!lv.LINKMODEL) return; L.lEnsure(id); L.LRX[id] = TICK();
    for (const p of L.LINKPEERS[id]) {
      const lk = L.linkFind(id, p); if (!lk || lk.state !== LK_OPEN || lk.half !== 3 || lk.leverHalf || L.radioOff(id) || L.radioOff(p) || fab.isFrozen(p)) continue;
      lk.half = 0; lk.halfAt = -1; lk.backAt[0] = lk.backAt[1] = TICK(); L.levPush(TICK() + L.ldraw(3, 4, id, p, 0x6672), E.EV_FRESH, id, p, lk.epoch, 'fresh');
    }
  };

  // C++: mesh_time.inc:fabricReloadBye
  const fabricReloadBye = (id) => {
    alive[id] = 0; fab.active.delete(id); fab.sockCloseAt.set(id, TICK() + K.RELOAD_CLOSE_LAG);
    let v = fab.RELCLOSEQ.get(TICK() + K.RELOAD_CLOSE_LAG); if (!v) { v = []; fab.RELCLOSEQ.set(TICK() + K.RELOAD_CLOSE_LAG, v); } v.push(id);
  };

  // C++: mesh_time.inc:timeTick
  // The start of a tick while a lever is armed: thaws, slow clocks, reloads.
  const timeTick = () => {
    const { RELCLOSEQ, FROZEN, SLOW, RESUMEQ, RELOADQ } = fab;
    while (RELCLOSEQ.size && firstTick(RELCLOSEQ) <= TICK()) {
      const f = firstTick(RELCLOSEQ); const v = RELCLOSEQ.get(f); RELCLOSEQ.delete(f);
      for (const id of v) { if (lv.LINKMODEL) X.linkOnLeave(id); else fab.fireTranslost(id); }
    }
    for (const id of [...FROZEN.keys()].sort((a, b) => a - b)) {   // a std::map: thaws run in id order
      const f = FROZEN.get(id); if (f === undefined) continue;
      if (f.until > TICK()) continue;
      FROZEN.delete(id);
      if (id >= lv.nextId || !alive[id]) continue;
      const s = seats[id]; const gap = TICK() - f.at;
      s.clkHeld += gap;
      trace('THAW', id, s.hasCoord ? s.coord : null, 'gap=%lld extra=%d held=%zu', gap, f.extra, f.q.length);
      s.absence(gap + f.extra);
      linkThaw(id);
      for (const m of f.q) s.recv(m);
      fab.wake(id);
    }
    for (const [id, sw] of SLOW) {
      if (sw.until >= 0 && TICK() >= sw.until) { SLOW.delete(id); continue; }
      if (sw.clock && id < lv.nextId && alive[id] && (TICK() - sw.from) % sw.k !== 0) seats[id].clkHeld++;
    }
    while (RESUMEQ.size && firstTick(RESUMEQ) <= TICK()) {
      const f = firstTick(RESUMEQ); const v = RESUMEQ.get(f); RESUMEQ.delete(f);
      for (const e of v) {
        const id = e[0]; seats[id] = new Seat(id, w); alive[id] = 1; seats[id].oldCell = e[1]; seats[id].join(); lv.N += 1;
        trace('RESUME-KNOCK', id, null, 'old=%s', e[1] ? fab.coordStr(unckey(e[1] - 1)) : '-');
      }
    }
    while (RELOADQ.size && firstTick(RELOADQ) <= TICK()) {
      const f = firstTick(RELOADQ); const n = RELOADQ.get(f); RELOADQ.delete(f);
      for (let q = 0; q < n; q++) { spawnOne(); trace('RELOAD-KNOCK', lv.nextId - 1, null, 'new id'); }
    }
  };
  // C++: mesh_time.inc:slowSkip
  // tick() skipped this tick (tickslow / hide)?
  const slowSkip = (id) => {
    if (fab.SLOW.size === 0) return false; const it = fab.SLOW.get(id); if (it === undefined) return false;
    return (TICK() - it.from) % it.k !== 0;
  };
  // C++: mesh_time.inc:fabricVerdict
  const fabricVerdict = (me, k, x, why) => {
    if (!lv.VERDICTS || x < 0 || x >= lv.nextId) return;
    if (!seatM.deathWhy(why)) return;
    lv.VALL++;
    const o = alive[x] ? seats[x] : null; const c = unckey(k);
    if (!o || !o.hasCoord || o.state !== 3 || ckey(o.coord) !== k) { trace('GONE-VERDICT', me, c, 'occ=%d why=%s alive=%d', x, why, o ? 1 : 0); return; }
    if (fab.isFrozen(x)) { lv.VFROZEN++; trace('FROZEN-DEAD', me, c, 'occ=%d why=%s', x, why); }
    else { lv.VFALSE++; trace('FALSE-DEAD', me, c, 'occ=%d why=%s', x, why); }
  };

  // ---- the levers (state change only: no printf) --------------------------------------------------------------------
  const atoi = fab.link.atoi;
  // C++: mesh_time.inc:timeLever
  // tk: the lever's words. `reload` calls Seat::leave (a seat unit) and is not here; the observers (twocells, linked,
  // allsee) only print.
  api.lever = (tk) => {
    const op = tk[0];
    const liveId = (i) => { const id = tk.length > i ? atoi(tk[i]) : -1; return (id >= 0 && id < lv.nextId && alive[id]) ? id : -1; };
    if (op === 'freeze') {
      const id = liveId(1); const t = tk.length > 2 ? atoi(tk[2]) : 40; const extra = tk.length > 3 ? atoi(tk[3]) : 0;
      if (id < 0 || t <= 0 || extra < 0) return;
      if (fab.isFrozen(id)) return;
      fab.FROZEN.set(id, { until: TICK() + t, at: TICK(), extra, q: [] }); fab.active.delete(id); fab.nextActive.delete(id); linkFreeze(id);
      trace('FREEZE', id, seats[id].hasCoord ? seats[id].coord : null, 'ticks=%lld gap=%d', t, extra);
    } else if (op === 'tickslow') {
      const id = liveId(1); const k = tk.length > 2 ? atoi(tk[2]) : 2; const t = tk.length > 3 ? atoi(tk[3]) : -1;
      if (id < 0 || k < 1) return;
      if (k === 1) { fab.SLOW.delete(id); return; }
      fab.SLOW.set(id, { k, from: TICK(), until: t > 0 ? TICK() + t : -1, clock: true });
    } else if (op === 'hide') {
      const id = liveId(1); const t = tk.length > 2 ? atoi(tk[2]) : 120; const k = tk.length > 3 ? atoi(tk[3]) : 24;
      if (id < 0 || t <= 0 || k < 1) return;
      fab.SLOW.set(id, { k, from: TICK(), until: TICK() + t, clock: false });
    } else if (op === 'reloadnew') {
      const id = liveId(1); const d = tk.length > 2 ? atoi(tk[2]) : 4;
      if (id < 0 || d < 1) return;
      fab.FROZEN.delete(id); fab.SLOW.delete(id);
      fab.fabricKill(id, TICK() + K.SOCK_CLOSE_CRASH); if (lv.LINKMODEL) X.linkOnLeave(id); else X.crashTransport(id); lv.N -= 1; fab.RELOADQ.set(TICK() + d, (fab.RELOADQ.get(TICK() + d) || 0) + 1);
    } else if (op === 'resume') {
      const id = liveId(1); const d = tk.length > 2 ? atoi(tk[2]) : 2;
      if (id < 0 || d < 1) return;
      fab.FROZEN.delete(id); fab.SLOW.delete(id); const oc = seats[id].hasCoord ? ckey(seats[id].coord) + 1 : 0;
      fab.fabricKill(id, TICK() + K.SOCK_CLOSE_CRASH); X.crashTransport(id); if (lv.LINKMODEL) L.linkResume(id); lv.N -= 1;
      fab.RESUMEQ.set(TICK() + d, (fab.RESUMEQ.get(TICK() + d) || []).concat([[id, oc]]));
      trace('RESUME', id, oc ? seats[id].coord : null, 'knocks at %lld', TICK() + d);
    } else if (op === 'doordark') { const t = tk.length > 1 ? atoi(tk[1]) : 40; lv.DOORDARK = TICK() + t; }
    else if (op === 'verdicts') { const a = tk.length > 1 ? tk[1] : 'show'; if (a === 'on') lv.VERDICTS = true; else if (a === 'off') lv.VERDICTS = false; else if (a === 'reset') { lv.VALL = lv.VFALSE = lv.VFROZEN = 0; } }
  };

  fab.time = api;
  fab.plug({ freezeHold, timeTick, slowSkip, fabricReloadBye, fabricVerdict });
  return api;
}
module.exports = { install };
