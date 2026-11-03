// page-env.test.js: js/mesh/page/env.js (the seat's world on a page) over a fake relay and fake pc pairs, in node.
// Each "page" is one env + one ported Seat; the fake relay keeps the greeter list (founding, blobs, unlist, busy,
// nosock); a fake pc pair carries msg.js frames as JSON (the wire), opens a tick after the offer, and closes both
// ends. Run: node test/mesh-port/page-env.test.js   (needs js/mesh/page/pclaws-wire.js, A2's, in the tree)
'use strict';
const assert = require('assert');
const path = require('path');
const M = path.join(__dirname, '..', '..', 'js', 'mesh');
require('./load-all.js');
require(path.join(M, 'page', 'pclaws-wire.js'));
const envM = require(path.join(M, 'page', 'env.js'));
const msg = require(path.join(M, 'msg.js'));
const shared = require(path.join(M, 'shared.js'));

let failures = 0;
function test(name, fn) {
  try { fn(); console.log('PASS ' + name); } catch (e) { failures++; console.log('FAIL ' + name + ': ' + (e && e.stack || e)); }
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
      measure: { tier: () => 0, nat: () => 0 },
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

// ---- unit: ids ----------------------------------------------------------------------------------------------------
test('ids: k_ ids keep the string order and take 52 bits; ids that share their first 21 bits stay apart', () => {
  const I = envM.ids();
  const a = I.learn(hex(0x100000)), b = I.learn(hex(0x200000)), c = I.learn(hex(0xffffff) + 'f');
  assert(a < b && b < c, 'order'); assert(Number.isSafeInteger(c) && c < 2 ** 52, '52 bits');
  assert.strictEqual(I.pid(b), hex(0x200000));
  const x = 'k_abcdef1' + '0'.repeat(33), y = 'k_abcdef9' + '0'.repeat(33);   // same first 21 bits (and 24)
  const nx = I.learn(x), ny = I.learn(y);
  assert(nx >= 0 && ny >= 0 && nx !== ny, 'distinct ints ' + nx + ' ' + ny);
  assert.strictEqual(I.pid(nx), x); assert.strictEqual(I.pid(ny), y);
  assert.strictEqual(Math.floor(nx / 2 ** 31), Math.floor(ny / 2 ** 31), 'the old 21-bit rule would have given both one int');
  const t = I.learn('test-peer'); assert(Number.isSafeInteger(t) && t >= 0 && t < 2 ** 52);
  assert.strictEqual(envM.nidOf(x), nx);
});

test('dir: a frame carries the peers of the ints it names; a forged entry is ignored', () => {
  const R = room();
  const A = R.join(hex(0x111111)), B = R.join(hex(0x222222));
  const m = msg.newMsg('HELLO'); m.id = A.env.me; const d = A.env.dirFor(m);
  assert.strictEqual(d[A.env.me], hex(0x111111));
  B.env.learnDir({ [A.env.me]: hex(0x333333) });   // forged: the int is not that peer's
  assert.strictEqual(B.env.ids.pid(A.env.me), null);
  B.env.learnDir(d); assert.strictEqual(B.env.ids.pid(A.env.me), hex(0x111111));
});

// ---- unit: relay mapping ----------------------------------------------------------------------------------------
test('relay: greeters list -> GREETERS next tick (me left out); nosock pairs with the seat ask either order', () => {
  const R = room();
  const A = R.join(hex(0x123456));
  const got = []; const s = A.seat; const orig = s.recv.bind(s); s.recv = (m) => { got.push(m); return orig(m); };
  A.env.relayFrame({ t: 'greeters', list: [hex(0x123456), hex(0x654321), hex(0x777777)] });
  A.env.tick();
  const g = got.find((m) => m.t === 'GREETERS'); assert(g, 'GREETERS delivered');
  assert.strictEqual(g.list.length, 2); assert(!g.list.includes(A.env.me));
  got.length = 0;
  const gid = A.env.ids.nid(hex(0x654321));
  A.env.f.fabricNoSock(A.env.me, gid); A.env.relayFrame({ t: 'nosock', to: hex(0x654321) });
  A.env.tick(); A.env.tick();
  const b = got.find((m) => m.t === 'BUSY'); assert(b && b.nosock && b.id === gid && b.from === -1, 'BUSY{nosock} (ask first)');
  got.length = 0;
  A.env.relayFrame({ t: 'nosock', to: hex(0x777777) }); A.env.f.fabricNoSock(A.env.me, A.env.ids.nid(hex(0x777777)));
  A.env.tick(); A.env.tick();
  assert(got.find((m) => m.t === 'BUSY' && m.nosock), 'BUSY{nosock} (relay first)');
  got.length = 0;
  A.env.relayFrame({ t: 'nosock', to: hex(0x888888) }); A.env.tick(); A.env.tick();
  assert(!got.find((m) => m.t === 'BUSY'), 'a nosock nobody asked about is not a BUSY');
});

test('relay: a referral list goes one id per sealed frame and is rebuilt into one BUSY tag 14', () => {
  const R = room();
  const A = R.join(hex(0x100000)), B = R.join(hex(0x200000));
  const refs = [hex(0x300000), hex(0x400000), hex(0x500000)];
  for (const p of refs) A.env.ids.learn(p);
  A.env.ids.learn(B.peer);
  A.env.relayBusyList(A.env.ids.nid(B.peer), 14, refs.map((p) => A.env.ids.nid(p)));
  assert.strictEqual(R.busySent.length, 3, 'three frames');
  for (const [, , body] of R.busySent) assert.strictEqual(body.ref.length, 1, 'one id each');
  const got = []; const orig = B.seat.recv.bind(B.seat); B.seat.recv = (m) => { got.push(m); return orig(m); };
  R.step(); R.step();
  const d = got.find((m) => m.t === 'BUSY' && m.tag === 14); assert(d, 'BUSY tag 14 delivered');
  assert.deepStrictEqual(d.list, refs.map((p) => B.env.ids.nid(p))); assert.strictEqual(d.id, A.env.me);
});

test('relay: knock sends a blob only for a Section-1 seated seat (L16.4); unlist goes out when the seat asks', () => {
  const R = room();
  const A = R.join(hex(0x100000));
  const calls = []; const pg = A; const env = pg.env;
  // knock as an unseated seat: blob refused at my end
  const save = R.greeters.size; R.greeters.clear();
  R.pages.get(A.peer).env.f.relayKnock(env.me, 0, true);
  void calls; void save;
  assert(R.greeters.has(A.peer), 'empty registry founds');
  R.greeters.clear(); R.greeters.add(hex(0x999999)); R.pages.set(hex(0x999999), { socket: true, env: { relayFrame() {} } });
  env.f.relayKnock(env.me, 0, true);
  assert(!R.greeters.has(A.peer), 'unseated: no blob');
  env.f.relayUnlist(env.me);
  assert(R.log.some((x) => x[0] === 'unlist'), 'unlist sent');
});

// ---- integration: rooms seat through the env -----------------------------------------------------------------------
function seatRoom(n, maxTicks, opts) {
  const R = room(opts);
  const ps = []; for (let i = 0; i < n; i++) ps.push(hex(0x100000 + i * 0x1357));
  let k = 0; R.join(ps[k++]);
  const t = R.run(maxTicks, () => { if (k < n && R.T() % 6 === 0) R.join(ps[k++]); return k === n && R.seated().length === n; });
  R.run(20);   // let the last dials open
  return { R, t };
}
// two people whose identities share their first 28 bits (one int under the old 21-bit rule): both sit, apart
test('room of 2 and 4 with ids that share their first 21 bits: every seat sits, ints distinct, cells distinct, links open', () => {
  for (const n of [2, 4]) {
    const R = room();
    const ps = []; for (let i = 0; i < n; i++) ps.push('k_abcdef' + (0x1 + i * 0x3).toString(16) + '0'.repeat(33));
    let k = 0; R.join(ps[k++]);
    R.run(1200, () => { if (k < n && R.T() % 6 === 0) R.join(ps[k++]); return k === n && R.seated().length === n; });
    R.run(20);
    const ints = ps.map((p) => R.pages.get(p).env.me);
    assert.strictEqual(new Set(ints).size, n, 'ints ' + ints);
    assert(ints.every((x) => x >= 2 ** 31), 'ints past 2^31: ' + ints);
    const errs = [...R.pages.values()].map((p) => p.env.stats().lawErr).filter((e) => Object.keys(e).length);
    assert.strictEqual(errs.length, 0, 'law errors: ' + JSON.stringify(errs));
    assert.strictEqual(R.seated().length, n, 'seated ' + R.seated().length + '/' + n);
    assert.strictEqual(new Set(R.coords()).size, n, 'distinct cells ' + R.coords());
    let named = 0, open = 0;
    for (const p of R.pages.values()) for (const q of p.env.links()) { named++; const c = R.pcs.get(p.peer < q ? p.peer + '|' + q : q + '|' + p.peer); if (c && c.state === 'open') open++; }
    assert(open === named, 'links named but not open: ' + open + '/' + named);
    console.log('  n=' + n + ' ints ' + ints.join(' ') + ' cells ' + R.coords().join(' ') + ' links ' + open + '/' + named);
  }
});

for (const n of [2, 3, 4, 6]) {
  test('room of ' + n + ': every seat sits, cells distinct, links open, no law error', () => {
    const { R, t } = seatRoom(n, 1200);
    const seated = R.seated(); const cs = R.coords();
    const errs = [...R.pages.values()].map((p) => p.env.stats().lawErr).filter((e) => Object.keys(e).length);
    assert.strictEqual(errs.length, 0, 'law errors: ' + JSON.stringify(errs));
    assert.strictEqual(seated.length, n, 'seated ' + seated.length + '/' + n + ' by tick ' + R.T() + ' ' + JSON.stringify([...R.pages.values()].map((p) => [p.seat.state, p.seat.hasCoord])));
    assert.strictEqual(new Set(cs).size, n, 'distinct cells ' + cs);
    // every owned-link peer a seat names has an open pc
    let named = 0, open = 0;
    for (const p of R.pages.values()) for (const q of p.env.links()) { named++; const c = R.pcs.get(p.peer < q ? p.peer + '|' + q : q + '|' + p.peer); if (c && c.state === 'open') open++; }
    console.log('  n=' + n + ' seated by tick ' + t + ' cells ' + cs.join(' ') + ' links ' + open + '/' + named + ' open');
    assert(open === named, 'links named but not open: ' + open + '/' + named);
  });
}

test('room of 3: one leaves; the others keep their seats and log LINK-DOWN or a goodbye, no law error', () => {
  const { R } = seatRoom(3, 1200);
  assert.strictEqual(R.seated().length, 3);
  const [A, B, C] = [...R.pages.values()];
  C.env.leave(false); C.env.tick = () => {};   // the page stops its clock right after leave (mesh-wire node.stop)
  R.run(200);
  const byes = [A, B].map((p) => p.traces.filter((l) => l.includes('PC-BYE-IN')).length), downs = [A, B].map((p) => p.traces.filter((l) => l.includes('"LINK-DOWN"')).length);
  console.log('  leave: goodbyes heard ' + byes.join(',') + ', LINK-DOWN ' + downs.join(','));
  assert(byes.every((n) => n >= 1), 'each survivor hears the pcbye');
  assert(downs.every((n) => n === 0), 'a goodbye is no loss');
  assert.strictEqual(C.left, 'leave', 'onLeft called');
  assert(A.seat.state === 3 && B.seat.state === 3, 'survivors seated');
  const errs = [A, B].map((p) => p.env.stats().lawErr).filter((e) => Object.keys(e).length);
  assert.strictEqual(errs.length, 0, JSON.stringify(errs));
  const occ = (p) => [...p.seat.occ.values()];
  assert(!occ(A).includes(C.env.me) && !occ(B).includes(C.env.me), 'the leaver is out of both views');
});

test('room of 4: one crashes (pcs die without a goodbye, socket gone); survivors hear a hard loss and free its cell', () => {
  const { R } = seatRoom(4, 1200);
  assert.strictEqual(R.seated().length, 4);
  const all = [...R.pages.values()]; const C = all[3]; const rest = all.slice(0, 3);
  C.socket = false; R.greeters.delete(C.peer); C.env.tick = () => {};   // the tab is gone: no ticks, no frames
  for (const q of rest) { const k = C.peer < q.peer ? C.peer + '|' + q.peer : q.peer + '|' + C.peer; const c = R.pcs.get(k); if (c) { R.pcs.delete(k); q.env.transport(C.peer, 'close'); } }
  const t = R.run(1500, () => rest.every((p) => ![...p.seat.occ.values()].includes(C.env.me)));
  const down = rest.map((p) => p.traces.filter((l) => l.includes('"LINK-DOWN"') || l.includes('TRANSLOST')).length);
  console.log('  crash: freed in ' + t + ' ticks; loss trace lines per survivor ' + down.join(','));
  assert(rest.every((p) => p.seat.state === 3), 'survivors seated');
  assert(rest.every((p) => ![...p.seat.occ.values()].includes(C.env.me)), 'the crashed seat is out of every view');
});

test('room of 3: the page drops a pc without telling the env; the next failed send closes my end (no frames into a dead dc)', () => {
  const { R } = seatRoom(3, 1200);
  const [A, B] = [...R.pages.values()];
  const k = A.peer < B.peer ? A.peer + '|' + B.peer : B.peer + '|' + A.peer;
  R.pcs.delete(k);   // the page's own dropPeer: no transport event to either env
  R.run(60);
  const sa = A.env.stats().drops['send-closed'] || 0, sb = B.env.stats().drops['send-closed'] || 0;
  console.log('  silent drop: send-closed ' + sa + '/' + sb + ', ENV-SENDCLOSED lines ' + A.traces.filter((l) => l.includes('ENV-SENDCLOSED')).length);
  assert(sa + sb > 0 && sa <= 2 && sb <= 2, 'each end notices within a send or two: ' + sa + '/' + sb);
  assert(R.seated().length === 3, 'all still seated');
});

test('tick shape: every dc frame is delivered at the first tick boundary after it arrived (never later, never mid-tick)', () => {
  const { R } = seatRoom(3, 1200);
  R.run(50);
  for (const p of R.pages.values()) { const d = p.env.stats().delay; assert(d[0] > 0 && d[1] === 0 && d[2] === 0, JSON.stringify(d)); }   // delay[0]: delivered at the first boundary after arrival
});

if (failures) { console.log(failures + ' FAILED'); process.exit(1); }
console.log('page-env: all passed');
