// page-lguard-s1head.test.js: a Section-1 head's duty on the page (L29.0, 2026-11-04). The room builder is page-lguard.test.js's.
// page-lguard.test.js: the load guard (L29) on real js/mesh/page/env.js and real seats, in a 30-seat room over a fake relay and
// fake pc pairs, in node. Same room as page-env.test.js. The device reading and the inbound watch are the page's hooks (measure).
// Legs, as the sim's lgcase: a deep head throttles and moves to a lighter cell, staying in the room; a stalled seat whose
// receivers starve leaves with its reason and is re-seated; a seat with a fine reading and one complaining mate has nothing happen.
// Run: node test/mesh-port/page-lguard.test.js
'use strict';
const assert = require('assert');
const path = require('path');
const M = path.join(__dirname, '..', '..', 'js', 'mesh');
require('./load-all.js');
require(path.join(M, 'page', 'pclaws-wire.js'));
const envM = require(path.join(M, 'page', 'env.js'));
const msg = require(path.join(M, 'msg.js'));
const shared = require(path.join(M, 'shared.js'));
const topo = require(path.join(M, 'topo.js'));

let failures = 0;
function test(name, fn) {
  if (process.env.ONLY && !name.startsWith(process.env.ONLY)) return;
  try { fn(); console.log('PASS ' + name); } catch (e) { failures++; console.log('FAIL ' + name + ': ' + (e && e.message || e)); }
}
const hex = (n) => 'k_' + n.toString(16).padStart(6, '0') + '0'.repeat(34);
const wire = (m) => (m.t === 'pcbye' ? JSON.parse(JSON.stringify(m)) : msg.readMsg(JSON.parse(JSON.stringify(msg.writeMsg(m)))));

// ---- the fake room ------------------------------------------------------------------------------------------------
function room(opts) {
  opts = opts || {};
  const pages = new Map();      // peer -> page
  const greeters = new Set();   // peers registered with a blob
  const pcs = new Map();        // 'a|b' (sorted) -> {state:'dialing'|'open'|'closed', openAt, by}
  const later = [];             // [atTick, fn]: the fake network's own clock (one step per room tick)
  let T = 0;
  const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const log = [];
  const R = { pages, greeters, pcs, log, relayFrames: [], busySent: [] };

  function makePage(peer) {
    const pg = { peer, seat: null, traces: [], onLeft: null, socket: true };
    const env = envM.create({
      peer, seat: () => pg.seat, strict: true,
      rand: (() => { let s = 7; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 2147483648; }; })(),
      trace: (line) => pg.traces.push(line),
      onLeft: (reload) => { pg.left = reload ? 'reload' : 'leave'; },
      measure: Object.assign({ tier: () => 0, nat: () => 0 }, opts.measure ? opts.measure(pg) : {}),
      relay: {
        knock: (gk, blob) => {
          if (!pg.socket) return;
          const list = [...greeters].filter((g) => g !== peer && pages.get(g).socket);
          if (greeters.size === 0 || blob) greeters.add(peer);   // an empty registry founds; a blob registers
          later.push([T, () => env.relayFrame({ t: 'greeters', list })]);
        },
        unlist: () => { greeters.delete(peer); log.push(['unlist', peer]); },
        busy: (to, body) => { R.busySent.push([peer, to, body]); const q = pages.get(to); if (q) later.push([T, () => q.env.relayFrame({ t: 'peer', from: peer, ty: 'busy', d: JSON.parse(JSON.stringify(body)) })]); },
      },
      pc: {
        ensure: (to, info) => {
          const k = key(peer, to); const p = pcs.get(k);
          if (p && (p.state === 'dialing' || p.state === 'open')) return;
          const q = pages.get(to);
          if (!q || !q.socket || opts.noAnswer) { pcs.set(k, { state: 'dialing', by: peer }); if (q && !q.socket && opts.nosock) later.push([T, () => pg.env.relayFrame({ t: 'nosock', to })]); return; }
          pcs.set(k, { state: 'dialing', by: peer });
          later.push([T, () => {
            const ok = q.env.transport(peer, 'offer', info && info.mark);
            if (!ok) { pcs.delete(k); return; }
            const back = q.env.mark(peer); later.push([T, () => pg.env.transport(to, 'answer', back)]);   // the answer carries the callee's mark
            later.push([T + 1, () => { const c = pcs.get(k); if (!c || c.state !== 'dialing') return; c.state = 'open'; pg.env.transport(to, 'open'); q.env.transport(peer, 'open'); }]);
          }]);
        },
        send: (to, m, dir) => {
          const c = pcs.get(key(peer, to)); if (!c || c.state !== 'open') return false;
          const q = pages.get(to); const f = wire(m); const d = dir ? JSON.parse(JSON.stringify(dir)) : null;
          later.push([T, () => { const c2 = pcs.get(key(peer, to)); if (c2 === c || !c2) q.env.frame(f, peer, d); }]);   // an ordered dc delivers what was sent before its close
          return true;
        },
        state: (to) => { const c = pcs.get(key(peer, to)); return c ? { pc: c.state, dc: c.state === 'open' ? 'open' : 'connecting' } : null; },
        close: (to) => {
          const k = key(peer, to); const c = pcs.get(k); if (!c || c.state === 'closed') return;
          const wasOpen = c.state === 'open'; c.state = 'closed'; pcs.delete(k);
          const q = pages.get(to); if (q && wasOpen) later.push([T, () => q.env.transport(peer, 'close')]);
        },
      },
    });
    pg.env = env;
    pages.set(peer, pg);
    return pg;
  }
  R.join = (peer) => { const pg = makePage(peer); pg.seat = pg.env.newSeat(); pg.seat.join(); return pg; };
  R.step = () => {
    const due = later.filter((x) => x[0] <= T); for (const x of due) later.splice(later.indexOf(x), 1);
    for (const x of due) x[1]();
    for (const pg of pages.values()) pg.env.tick();
    T++;
  };
  R.run = (n, until) => { for (let i = 0; i < n; i++) { R.step(); if (until && until()) return i + 1; } return n; };
  R.seated = () => [...pages.values()].filter((p) => p.seat && p.seat.state === 3 && p.seat.hasCoord);
  R.coords = () => R.seated().map((p) => shared.coordStr(p.seat.coord));
  R.T = () => T;
  return R;
}


const N = +(process.env.N || 30);
const trc = (pg, e) => pg.traces.filter((l) => l.includes('"e":"' + e + '"'));
function build(hooks, n) {
  const R = room({ measure: (pg) => ({ lgHealth: () => (pg.h === undefined ? 1 : pg.h), lgCamOn: () => pg.camOff !== true, lgWoke: () => 0, lgStarve: () => hooks.starve(pg), lgLeave: () => hooks.leave(pg, R) }) });
  for (let i = 1; i <= (n || N); i++) { R.join(hex(0x100000 + i * 0x1111)); R.run(+(process.env.STAGGER || 12)); }
  R.run(+(process.env.SETTLE || 400));
  return R;
}
// the seats at the cells that receive x's own feed (sim lgDuties): a deep row's mates; in Section 1 its rook peers
const receives = (pg, x) => { if (!pg.seat || !pg.seat.hasCoord || !x.seat || !x.seat.hasCoord || pg === x) return false; const a = pg.seat.coord, b = x.seat.coord; if (a.pc !== b.pc) return false; return a.r === b.r || (b.pc === 0 && a.i === b.i); };
const cellOf = (p) => shared.coordStr(p.seat.coord);
const rowOf = (R, x) => R.seated().filter((p) => p !== x && p.seat.coord.pc === x.seat.coord.pc && p.seat.coord.r === x.seat.coord.r);
function deepHead(R) { return R.seated().find((p) => p.seat.coord.pc !== 0 && p.seat.coord.i === 0 && rowOf(R, p).length >= 2); }


// L29.0: a Section-1 head also carries its head duty, charged as
// copies: each row-mate taken in L29_PARK, the row block and the row view L29_HOT each (high), one mix per child branch L29_HOT
// (low). A full Section-1 head reads 52 at level 0 against a mobile budget of 40, so a phone in that cell sheds, goes light and
// asks to swap (L29.3, Section 1 exchanges). The page's reading (env.js lgFabric) must say the same, or a phone head never asks.
test('a Section-1 head with a full row and child rows reads its head duty (the sim counts 52; a mobile budget is 40)', () => {
  const R = build({ starve: () => [], leave: () => {} }, +(process.env.S1_N || 40));
  const K = require(path.join(M, 'consts.js')).consts;
  const s1 = R.seated().filter((p) => p.seat.coord.pc === 0);
  const heads = s1.filter((p) => p.seat.coord.i === 0 && rowOf(R, p).length === 4);
  assert(heads.length, 'no full Section-1 row: ' + R.coords().join(' '));
  const X = heads.reduce((a, b) => (kidsOf(R, b) > kidsOf(R, a) ? b : a));
  const mates = 4, kids = kidsOf(R, X);
  // the sim's lgDuties for this cell: own = 8 receivers (row 4 + column 4), fwd = 8 + down, head duty hd = mates*PARK + 2*HOT, hlow = kids*HOT
  const rx = 8, fwd = rx + (X.seat.occGet(topo.ckey(topo.down(X.seat.coord))) >= 0 ? 1 : 0);
  const simL2 = rx * K.L29_HOT + fwd + (mates * K.L29_PARK + 2 * K.L29_HOT), simL1 = simL2 + fwd + kids * K.L29_HOT;
  console.log('  ' + cellOf(X) + ' kids=' + kids + ' page lgLd=' + JSON.stringify(X.seat.lgLd) + ' sim l2=' + simL2 + ' l1=' + simL1 + ' mobile budget ' + K.L29_BUD_M);
  assert.strictEqual(X.seat.lgLd[2], simL2, 'level-2 load: page ' + X.seat.lgLd[2] + ', sim ' + simL2);
  assert.strictEqual(X.seat.lgLd[1], simL1, 'level-1 load: page ' + X.seat.lgLd[1] + ', sim ' + simL1);
  assert(X.seat.lgLd[0] * 100 > K.L29_BUD_M * K.L29_SHED, 'a mobile in this cell must read over its shed line: ' + X.seat.lgLd[0] + ' vs ' + K.L29_BUD_M * K.L29_SHED / 100);
});
function kidsOf(R, X) { let n = 0; for (let j = 0; j < topo.C; j++) if (X.seat.occGet(topo.ckey(topo.down({ pc: 0, r: X.seat.coord.r, i: j }))) >= 0) n++; return n; }
console.log(failures ? failures + ' FAILED' : 'ALL PASS');
process.exit(failures ? 1 : 0);
