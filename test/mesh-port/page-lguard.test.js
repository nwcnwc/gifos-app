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

test('quiet: ' + N + ' seats, a healthy reading: nothing sheds, nobody leaves or moves', () => {
  let left = 0; const R = build({ starve: () => [], leave: () => { left++; } });
  const c0 = R.coords().sort().join(); assert.strictEqual(R.seated().length, N, 'seated ' + R.seated().length); assert.strictEqual(new Set(R.coords()).size, N, 'doubled cell: ' + c0);
  assert(R.seated().some((p) => p.seat.coord.pc !== 0), 'a room this big has deep seats');
  R.run(300);
  assert.strictEqual(left, 0); assert.strictEqual(R.coords().sort().join(), c0, 'no move');
  for (const p of R.seated()) assert.strictEqual(p.seat.lgLvl, 0, cellOf(p) + ' shed: ld ' + p.seat.lgLd + ' bud ' + p.seat.lgBud);
});

test('throttle: a deep head falls to 15%: it sheds, goes light, trades cells with a mate, and stays; no one leaves', () => {
  let left = 0; const R = build({ starve: () => [], leave: () => { left++; } }, +(process.env.DEEP_N || 70));
  // This room's deep rows hold one or two seats (the sim's rows at this size hold up to five, not chased here): an exchange needs a
  // head and two mates, so one more seat is moved into a row of two by the seat's own doMove, and the row settles first.
  let X = deepHead(R);
  if (!X) {
    const H = R.seated().find((p) => p.seat.coord.pc !== 0 && p.seat.coord.i === 0 && rowOf(R, p).length === 1 && rowOf(R, p)[0].seat.coord.i === 1);
    const Z = R.seated().find((p) => p !== H && p.seat.coord.pc !== 0 && !rowOf(R, H).includes(p) && !p.seat.hasChildren() && p.seat.coord.i !== 0);
    assert(H && Z, 'no row of two and a spare leaf');
    const c = { pc: H.seat.coord.pc, r: H.seat.coord.r, i: 2 };
    const nb = [H, rowOf(R, H)[0]].map((p) => ({ k: topo.ckey(p.seat.coord), v: p.seat.id }));
    Z.seat.doMove(c, -1, nb); R.run(60);
    console.log('  built row ' + [H, ...rowOf(R, H)].map(cellOf).join(' ') + ', mover at ' + cellOf(Z));
    X = H;
  }
  const cell0 = cellOf(X); const n0 = R.seated().length;
  X.h = 0.15; let shed = -1, light = -1, moved = -1;
  for (let t = 0; t < 500 && moved < 0; t++) { R.step(); if (shed < 0 && X.seat.lgLvl >= 1) shed = t; if (light < 0 && X.seat.lgLight) light = t; if (X.seat.hasCoord && cellOf(X) !== cell0) moved = t; }
  console.log('  ' + cell0 + ' -> ' + (X.seat.hasCoord ? cellOf(X) : '-') + ' shed at +' + shed + ', light at +' + light + ', moved at +' + moved + ', traces ' + trc(X, 'LG-LIGHT').length + ' LG-LIGHT');
  assert(shed >= 0, 'never shed'); assert(light >= 0, 'never light'); assert(moved >= 0, 'never moved: LGASK from a head goes to its own pick');
  assert.notStrictEqual(X.seat.coord.i, 0, 'it no longer holds the head cell');
  R.run(100); assert.strictEqual(left, 0, 'someone left'); assert.strictEqual(R.seated().length, n0, 'seated ' + R.seated().length + ' of ' + n0);
  const cs = R.coords(); assert.strictEqual(new Set(cs).size, cs.length, 'doubled cell');
});

test('stall: budget 0, its receivers starve for L29_ACCUSE: it leaves with its reason; the rest stay', () => {
  const left = []; let X = null;
  const R = build({ starve: (pg) => (X && !X.gone && receives(pg, X) ? [X.peer] : []), leave: (pg) => { left.push(pg.peer); pg.gone = true; } });
  X = R.seated().find((p) => p.seat.coord.pc !== 0 && rowOf(R, p).length >= 2 && p.seat.coord.i !== 0) || R.seated().find((p) => p.seat.coord.pc === 0 && p.seat.coord.i > 0);
  assert(X, 'a seat with receivers'); X.h = 0; const n0 = R.seated().length;
  const t0 = R.T(); let at = -1; for (let t = 0; t < 400 && !left.length; t++) { R.step(); if (left.length) at = R.T() - t0; }
  console.log('  ' + cellOf(X) + ' left at +' + at + ', lgQuit ' + X.seat.lgQuit + ', complaints from ' + R.seated().filter((p) => p.seat.lgCompN > 0).length + ' seats');
  assert.deepStrictEqual(left, [X.peer], 'who left'); assert(at >= 116, 'not before L29_ACCUSE from the first starved tick: +' + at);
  assert.strictEqual(R.seated().filter((p) => p !== X).length, n0 - 1, 'nobody else');
});

test('one liar: a mate reports a fine seat starved: one word moves nothing', () => {
  let left = 0, X = null, liar = null;
  const R = build({ starve: (pg) => (pg === liar ? [X.peer] : []), leave: () => { left++; } });
  X = R.seated().find((p) => p.seat.coord.pc !== 0 && rowOf(R, p).length >= 2 && p.seat.coord.i !== 0) || R.seated().find((p) => p.seat.coord.pc === 0 && p.seat.coord.i > 0);
  liar = rowOf(R, X)[0]; const c0 = cellOf(X);
  R.run(300); assert.strictEqual(left, 0); assert.strictEqual(cellOf(X), c0); assert(liar.seat.lgCompN > 0, 'the complaint never went out');
});

test('a refuser: a fine reading while every receiver starves: complaints are refuted (LG-REFUTE); the law keeps it in its cell', () => {
  let left = 0, X = null;
  const R = build({ starve: (pg) => (X && receives(pg, X) ? [X.peer] : []), leave: () => { left++; } });
  X = R.seated().find((p) => p.seat.coord.pc !== 0 && rowOf(R, p).length >= 2 && p.seat.coord.i !== 0) || R.seated().find((p) => p.seat.coord.pc === 0 && p.seat.coord.i > 0);
  const c0 = cellOf(X); R.run(300);
  assert.strictEqual(left, 0, 'it left'); assert.strictEqual(cellOf(X), c0, 'moved'); assert(trc(X, 'LG-REFUTE').length > 0, 'no LG-REFUTE');
  console.log('  refuted ' + trc(X, 'LG-REFUTE').length + ' times');
});

console.log(failures ? failures + ' FAILED' : 'ALL PASS');
process.exit(failures ? 1 : 0);
