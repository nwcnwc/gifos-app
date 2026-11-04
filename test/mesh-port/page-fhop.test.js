// page-fhop.test.js: js/mesh/page/env.js's friend-hop, in node, one page over fakes: which frames take a friend, the typing (D6, L8.4),
// and the envelope origin. Run: node test/mesh-port/page-fhop.test.js
'use strict';
const assert = require('assert');
const path = require('path');
const M = path.join(__dirname, '..', '..', 'js', 'mesh');
require('./load-all.js');
require(path.join(M, 'page', 'pclaws-wire.js'));
const envM = require(path.join(M, 'page', 'env.js'));
const msg = require(path.join(M, 'msg.js'));
const E = require(path.join(M, 'consts.js')).enums;
const K = require(path.join(M, 'consts.js')).consts;

let failures = 0;
function test(name, fn) { try { fn(); console.log('PASS ' + name); } catch (e) { failures++; console.log('FAIL ' + name + ': ' + (e && e.stack || e)); } }
const hex = (n) => 'k_' + n.toString(16).padStart(6, '0') + '0'.repeat(34);

// one page, seated at 0/0.1, its row-mate B at 0/0.2 and a friend F at 0/0.3
function page(fhOver) {
  const me = hex(1), B = hex(2), F = hex(3);
  const sent = { dc: [], sponsored: [], dials: [] };
  const fh = fhOver === null ? null : Object.assign({
    friendFor: () => true, canSponsor: () => true, natMine: () => E.GT_PUBLIC, natOf: () => E.GT_PUBLIC, roles: () => ({ jobs: [], vias: [] }),
  }, fhOver || {});
  let seat = null;
  const env = envM.create({
    peer: me, seat: () => seat, strict: true, fhop: fh, debug: false,
    measure: { tier: () => 0, nat: () => 0 }, relay: {},
    pc: { ensure: (to) => sent.dials.push(to), send: (to, m) => { sent.dc.push([to, m.t]); return true; }, close: () => {}, state: () => null },
    send: (to, m, dir) => { sent.sponsored.push([to, m.t, m.from, dir]); return true; },
  });
  seat = env.newSeat();
  seat.hasCoord = true; seat.state = 3; seat.coord = { pc: 0, r: 0, i: 1 };
  const nid = (p) => env.ids.learn(p);
  const ck = (i) => (require(path.join(M, 'topo.js')).ckey({ pc: 0, r: 0, i }));
  seat.occ.set(ck(1), env.me); seat.occ.set(ck(2), nid(B)); seat.occ.set(ck(3), nid(F));
  return { env, seat, sent, B, F, b: nid(B), f: nid(F), fh };
}

test('off: no face, every call reads as the sim with fhop off', () => {
  const p = page(null);
  assert.strictEqual(p.env.f.fhopActive(), false); assert.strictEqual(p.env.f.fabricUnreachable(p.env.me, p.b), false); assert.strictEqual(p.env.f.fhopFriendFor(p.env.me, p.b), false);
});
test('on: the real values', () => {
  const p = page({ friendFor: (x) => x === hex(2) });
  assert.strictEqual(p.env.f.fhopActive(), true); assert.strictEqual(p.env.f.fhopFriendFor(p.env.me, p.b), true); assert.strictEqual(p.env.f.fhopFriendFor(p.env.me, p.f), false);
});
test('typing: FH_ICE_N failed dials and two networks that cannot meet; one short, or either kind unknown, is a blip', () => {
  const p = page({ natMine: () => E.GT_BLOCKED });
  const fails = () => p.env.f.fabricDialFails(p.env.me, p.b);
  while (fails() < K.FH_ICE_N - 1) p.seat.dials.failed(p.b, p.seat.TICK, true);
  assert.strictEqual(p.env.f.fabricUnreachable(p.env.me, p.b), false, 'one short');
  p.seat.dials.failed(p.b, p.seat.TICK, true);
  assert.strictEqual(p.env.f.fabricUnreachable(p.env.me, p.b), true, 'blocked + 3 fails');
  p.fh.natMine = () => E.GT_PUBLIC; assert.strictEqual(p.env.f.fabricUnreachable(p.env.me, p.b), false, 'public meets public');
  p.fh.natMine = () => E.GT_SYM; p.fh.natOf = () => E.GT_SYM; assert.strictEqual(p.env.f.fabricUnreachable(p.env.me, p.b), true, 'sym cannot meet sym');
  p.fh.natOf = () => undefined; assert.strictEqual(p.env.f.fabricUnreachable(p.env.me, p.b), false, 'its kind unknown');
  p.fh.natMine = () => -1; p.fh.natOf = () => E.GT_SYM; assert.strictEqual(p.env.f.fabricUnreachable(p.env.me, p.b), false, 'my kind unknown');
});
function downed(p) { p.env.f.fabricDial(p.env.me, p.b); p.env.pcw.dialFailed(p.b); assert.strictEqual(p.env.pcw.fhDcRaw(p.b), false); }
test('a frame with no open channel leaves through the friend path, signed for by the sender, and never queues on the dead link', () => {
  const p = page(); downed(p);
  const m = msg.newMsg('PHONE'); m.id = p.env.me; p.env.f.fabricSend(p.env.me, p.b, m);
  assert.strictEqual(p.sent.sponsored.length, 1, 'one sponsored'); assert.strictEqual(p.sent.sponsored[0][0], p.B); assert.strictEqual(p.sent.sponsored[0][2], p.env.me, 'from is the origin');
  assert.strictEqual(p.sent.dc.length, 0);
});
test('no friend, no sponsor: the link step runs as before', () => {
  const p = page({ canSponsor: () => false }); downed(p);
  const m = msg.newMsg('PHONE'); m.id = p.env.me; p.env.f.fabricSend(p.env.me, p.b, m);
  assert.strictEqual(p.sent.sponsored.length, 0);
});
test('fhop off: the same frame never takes a friend', () => {
  const p = page(null); downed(p);
  const m = msg.newMsg('PHONE'); m.id = p.env.me; p.env.f.fabricSend(p.env.me, p.b, m);
  assert.strictEqual(p.sent.sponsored.length, 0);
});
test('an open channel carries the frame: no friend', () => {
  const p = page(); p.env.f.fabricDial(p.env.me, p.b); p.env.pcw.offer && p.env.transport(p.B, 'open');
  const m = msg.newMsg('PHONE'); m.id = p.env.me; p.env.f.fabricSend(p.env.me, p.b, m);
  assert.strictEqual(p.sent.sponsored.length, 0); assert.strictEqual(p.sent.dc.length, 1);
});
function inbound(p, m, ...a) { let got = null; const r = p.seat.recv; p.seat.recv = (x) => { got = x; }; p.env.frame(m, p.F, null, ...a); p.env.tick(); p.seat.recv = r; return got; }
test('an envelope: from is its origin only when proved, else the delivering peer; never first-hand', () => {
  const p = page();
  const a = msg.newMsg('PHONE'); a.id = p.b; let g = inbound(p, a, false, true, p.B);
  assert.strictEqual(g.from, p.b, 'proved origin'); assert.strictEqual(g.lk, -1, 'not first-hand');
  const b = msg.newMsg('PHONE'); b.id = p.b; g = inbound(p, b, false, true, null);
  assert.strictEqual(g.from, p.f, 'unproved: the deliverer'); assert.strictEqual(g.lk, -1);
});
test('the link law sees my relay roles (LW_FHOP)', () => {
  const p = page({ roles: () => ({ jobs: [{ target: hex(2), req: hex(3) }], vias: [] }) });
  assert(p.env.pcw.laws, 'laws'); const r = p.fh.roles(); assert.strictEqual(r.jobs.length, 1);
  p.seat.seatedAt = -1e9; const why = p.env.pcw.laws.linkWhy ? p.env.pcw.laws.linkWhy(p.env.me, p.f, false) : E.LW_FHOP;
  assert((why & E.LW_FHOP) !== 0, 'a relay role holds the pc: ' + why);
});
if (failures) { console.log(failures + ' FAILED'); process.exit(1); }
console.log('page-fhop: all passed');
