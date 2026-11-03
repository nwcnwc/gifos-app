// The page layer over the ported seat: ids, view, gossip flood + dedup, leaf fold. Run: node test/mesh-port/page/layer.test.js
'use strict';
const assert = require('assert');
const L = require('../../../js/mesh/page/layer.js');
const ckey = (c) => String(c.pc * 65536 + c.r * 256 + c.i);
const ownedLinks = (c) => [0, 1, 2, 3, 4].filter((i) => i !== c.i).map((i) => ({ pc: c.pc, r: c.r, i }));
// ids: 21 bits, same order as the string compare, reversible
{
  const ids = L.makeIds();
  const a = 'k_' + '0a1b2c' + '0'.repeat(34), b = 'k_' + '0a1b4c' + '0'.repeat(34);
  const na = ids.nid(a), nb = ids.nid(b);
  assert(na >= 0 && na < 2 ** 21 && nb < 2 ** 21, 'ids < 2^21');
  assert(na < nb, 'order kept');
  assert.strictEqual(ids.pid(na), a); assert.strictEqual(ids.pid(nb), b);
}
// a 3-seat row: gossip reaches everyone once; leaf folds
const peers = ['k_100000' + '0'.repeat(34), 'k_200000' + '0'.repeat(34), 'k_300000' + '0'.repeat(34)];
const layers = [], seats = [], got = [];
const bus = [];
for (let i = 0; i < 3; i++) {
  const seat = { TICK: 0, state: 3, hasCoord: true, coord: { pc: 0, r: 0, i }, occ: new Map(), keeps: [], seatedAt: 0, genKey: 7,
    linkPeers(out) { out.length = 0; for (const [, v] of this.occ) if (v !== this.me) out.push(v); } };
  seats.push(seat);
  const ly = L.create({ peer: peers[i], raw: () => seat, emit: (to, f) => bus.push([to, JSON.parse(JSON.stringify(Object.assign({ from: peers[i] }, f)))]), onGossip: (src, m) => { got.push([i, src, m.x]); }, ckey, ownedLinks });
  layers.push(ly);
}
for (let i = 0; i < 3; i++) { const ids = layers[i].ids; peers.forEach((p) => ids.learn(p)); seats[i].me = ids.nid(peers[i]); for (let j = 0; j < 3; j++) seats[i].occ.set(j, ids.nid(peers[j])); }
const pump = () => { while (bus.length) { const [to, f] = bus.shift(); const j = peers.indexOf(to); f.s4ok = true; layers[j].gossipRecv(f); } };
assert.deepStrictEqual(Array.from(layers[0].view.linkPeers()).sort(), [peers[1], peers[2]]);
assert.strictEqual(layers[0].view.occ.get('1'), peers[1]);
assert.deepStrictEqual(layers[0].view.coord, { pc: 0, r: 0, i: 0 });
layers[0].gossip({ x: 1 }); pump();
assert.deepStrictEqual(got.map((g) => g[0]).sort(), [1, 2], 'each other seat took it once: ' + JSON.stringify(got));
for (const s of seats) s.TICK++; for (const l of layers) l.afterTick(); pump();
assert.strictEqual(got.length, 2, 're-fan is deduplicated');
layers[1].setLeaf({ hand: 5, nm: 'Bo', vdn: ['dev1'] }); layers[2].setLeaf({ vdn: ['dev1'] });
for (let t = 0; t < 3; t++) { for (const s of seats) s.TICK++; for (const l of layers) l.afterTick(); pump(); }
const d = layers[0].roomDigest();
assert.strictEqual(d.n, 3); assert.strictEqual(d.handN, 1); assert.strictEqual(d.hands[0].nm, 'Bo');
assert.deepStrictEqual(d.votes, [{ tgt: 'dev1', up: 0, dn: 2 }]);
assert.strictEqual(got.length, 2, 'leaf gossip never reaches the app');
// a forged gid (names another author) is refused
layers[0].gossipRecv({ t: 'GSP', gid: peers[2] + ':99', src: peers[1], m: {}, s4ok: true });
assert.strictEqual(layers[0].view.gspForged, 1);
console.log('layer.test: ok');
