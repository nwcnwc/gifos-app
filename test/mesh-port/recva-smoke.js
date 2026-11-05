#!/usr/bin/env node
// recva-smoke.js [--write-golden] <proof dir>...
// Smoke and regression guard for js/mesh/recv.js and recv-entry.js (port unit S7a). For sampled seat states of the
// sim's proof runs: restore the seat, give it a recording fabric and no-op stand-ins for the methods other units
// own (only where not loaded), then (a) feed it the recorded frames it took at that tick (frames.jsonl "recv"),
// and (b) call each entry handler with synthetic frames of its type. Everything it did (frames sent, fabric calls,
// seat state after) is folded into one digest per dir, compared with fixtures/recva-smoke.json (written by
// --write-golden from the unmutated port). Proves load + run on real states + no drift; that it matches the C++ is
// proved by the tape replay (X1). RECVA_MESH=<dir> loads the units from another js/mesh dir (e.g. an overlay with
// the other units' files merged), which then fills in what the stubs stand for.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const M = process.env.RECVA_MESH || path.join(__dirname, '..', '..', 'js', 'mesh');
require('./load-all.js');   // every unit, so the callees the unit makes are the real ones
const seatM = require(path.join(M, 'seat.js'));
const { Seat } = seatM;
for (const f of fs.readdirSync(M).sort()) if (/^(entry|heal|digest|route|live|ring|island|instant|roomterm|small|tier|witness|rcleft|rcleft-l25|rcdead|rcfollow|linkset|mltail|farview|gaps|hostile-laws|lguard-seat)\.js$/.test(f)) require(path.join(M, f));
require(path.join(M, 'recv.js'));
const state = require(path.join(M, 'state.js'));
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));
const { lines } = require('./proof-io.js');

// Stand-ins for methods other units own (only where not loaded). Value = what the stand-in answers.
const STUB = {
  l24Take: true, l26Check: true, l10Take: true, routeStep: true, farLearn: undefined, hostileRecv: false, lineNote: undefined,
  l10Digest: undefined, l4Learn: undefined, noteUnp: undefined, linkIs: false, moveEvidence: false, confirmMove: undefined,
  lineAdopt: undefined, islandAsk: undefined, islandFork: undefined, loneGreet: undefined, entNote: undefined, entryTerm: false,
  l16AskOne: undefined, l16Gateway: undefined, l16Anchor: undefined, l16Wave: undefined, l711Reask: undefined, l711Took: undefined,
  serveCompact: undefined, l31Door: false, l31TakeDoor: false, l31Replace: false, l31OnPlaced: undefined, l16Handoff: undefined,
  l16Taken: undefined, l16Busied: undefined, l14Declined: undefined, l14Offer: undefined, l2514Drop: false, findLeaf: undefined,
  l828RingOf: -1, ringName: 0, ppAdm: true, heardAt: false, liveElsewhere: false, hearRook: false, doMove: undefined,
  requeue: undefined, l33ChildGone: undefined, transportLost: undefined, probeAsked: false, holdsCell: false, l13MassHeard: undefined,
  l13Mass: false, kTakePush: undefined, kTakeConf: undefined, kHolderAns: undefined, kAuditAns: undefined, lgRecv: undefined,
  l4OnQ: undefined, l4OnRdy: undefined, l4OnGo: undefined, onUnneeded: undefined, onS1Sync: undefined, onDrain: undefined,
  onChallenge: undefined, l25WitVote: undefined, onConfirm: undefined, onMoved: undefined, onSitXfer: undefined, onSitPing: undefined,
  onSitPong: undefined, onPhone: undefined, onPong: undefined, onRoute: undefined, onWalk: undefined, l13OnMeet: undefined,
  l13OnMeetAck: undefined, onU2: undefined, onE1State: undefined, onHello: undefined, onYield: undefined, onClaim: undefined, onLeave: undefined,
  l13Answer: undefined, ppAdmitter: -1, l710Dial: undefined, rmName: false, l33ChildVouch: undefined, route: undefined, l31Hold: false, l4Hop: false, l31Held: false, l13MateGone: false, l33MateArm: false, l33HeirCalled: false, l31Direct: false, l33RowGate: false, l33NoAdmitter: false, l711Handed: undefined, l33HoldFull: false, ownedLinkCell: false, l1DeepKid: -1, rmRowMaybeLive: false, l1612Keep: false, mergeCalc: false, islandSeen: false, l30Small: false, pickRoster: -1, kDropIn: false, rmWitCell: false,
};
for (const [k, v] of Object.entries(STUB)) if (!(k in Seat.prototype)) Object.defineProperty(Seat.prototype, k, { value: function (...a) { this.__log && this.__log.push(k + ':' + JSON.stringify(a)); return v; }, writable: true, configurable: true });
for (const [k, v] of Object.entries({ l13Ring: () => [], l13Witness: () => null, l13Chain: (s, H) => [H], islandStandM: () => false, kOver: () => [] })) if (!seatM.FREE[k]) Seat.free({ [k]: v });

function world(t, log) {
  const w = seatM.newWorld();
  w.TICK = t;
  w.f = new Proxy({}, { get: (_, n) => (...a) => {
    log.push('F.' + n + ':' + JSON.stringify(a));
    if (n === 'fabricLinkState') return 0;
    if (n === 'fabricDoors') return false;
    if (n === 'fabricFreeCells') return 3;
    if (n === 'l164Of') return false;
    if (n === 'fabricMyTier' || n === 'fabricMyNat' || n === 'fabricMyKnocks') return 0;
    return undefined;
  } });
  return w;
}

const golden = path.join(__dirname, 'fixtures', 'recva-smoke.json');
const write = process.argv.includes('--write-golden');
const dirs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const out = {}; let bad = 0;
for (const dir of dirs) {
  const h = crypto.createHash('sha256'); let n = 0, calls = 0, nfr = 0, k = 0;
  const picks = [];
  for (const raw of lines(path.join(dir, 'state.jsonl'))) { if (k++ % 40) continue; picks.push(JSON.parse(raw)); }
  const want = new Map(); for (const o of picks) want.set(o.t + ':' + o.id, []);
  for (const raw of lines(path.join(dir, 'frames.jsonl'))) {
    if (raw.charCodeAt(6) !== 114) continue;   // {"e":"recv" (not "send")
    const f = JSON.parse(raw); const a = want.get(f.t + ':' + f.to); if (a && a.length < 6) a.push(f.m);
  }
  for (const o of picks) {
    n++;
    const log = [];
    const mk = () => { const s = new Seat(o.id, world(o.t, log)); state.restore(s, o.s); s.__log = log; s.emit = function (to, m) { log.push('E:' + to + ':' + JSON.stringify(msg.clone(m))); }; s.rng = ((x) => () => { x = (x * 1103515245 + 12345) >>> 0; return x / 4294967296; })(o.id + 7); return s; };
    const run = (name, f) => { log.push('== ' + name); try { f(); calls++; } catch (e) { bad++; log.push('THROW ' + name + ' ' + e.message); console.log('THROW', dir, 't=' + o.t, 'id=' + o.id, name, e.stack.split('\n').slice(0, 3).join(' | ')); } };
    const peer = 100000 + o.id;
    const mm = (t, set) => { const m = msg.newMsg(t); m.from = peer; m.id = peer; Object.assign(m, set || {}); return m; };
    const ro = []; for (const [c, v] of Object.entries(o.s.occ || [])) void c, void v;
    const frames = [];
    for (const m of want.get(o.t + ':' + o.id)) { nfr++; frames.push(['rec', () => msg.readMsg(m)]); }
    const cell = { pc: 0, r: 1, i: 1 };
    const kv = [{ k: topo.ckey({ pc: 0, r: 1, i: 1 }), v: 77 }, { k: topo.ckey({ pc: 0, r: 2, i: 2 }), v: peer + 1 }];
    const syn = [
      ['GREETERS-empty', () => mm('GREETERS', { from: -1, id: -1 })],
      ['GREETERS', () => mm('GREETERS', { from: -1, list: [peer, o.id, peer + 1] })],
      ['WHOHOME', () => mm('WHOHOME', { ttl: 5 })], ['WHOHOME-knock', () => mm('WHOHOME', { ttl: 5, knock: true })],
      ['HOME', () => mm('HOME', { roster: kv, byes: [topo.ckey({ pc: 0, r: 3, i: 3 })], gkey: 5 })], ['HOME-knock', () => mm('HOME', { roster: kv, knock: true, byes: [1, 2], mass: true })],
      ['FIND', () => mm('FIND', { nc: peer, ttl: 300, coord: cell })], ['FIND-compact', () => mm('FIND', { nc: peer, ttl: 100, tag: 1, coord: cell })],
      ['FINDACK', () => mm('FINDACK', { nc: o.id })],
      ['FINDLEAF', () => mm('FINDLEAF', { hole: cell, nbrs: kv, ttl: 5 })],
      ['PLACE', () => mm('PLACE', { nc: o.id, owner: peer, coord: cell, nbrs: kv, pp: peer, ppAt: o.t })], ['PLACE-bare', () => mm('PLACE', { nc: o.id, owner: peer, coord: cell })],
      ['PLACE-compact', () => mm('PLACE', { nc: o.id, owner: peer, tag: 1, coord: { pc: 0, r: 0, i: 1 }, nbrs: kv })],
      ['NOROOM', () => mm('NOROOM', { nd: 9 })], ['NOROOM-gwc', () => mm('NOROOM', { gwc: true, split: true })],
      ['RECLAIMED', () => mm('RECLAIMED', { nc: o.id, tag: 1, ck: 3, coord: cell, owner: peer, nbrs: kv })],
      ['RECLAIMNO', () => mm('RECLAIMNO', { nc: o.id, tag: 1, ck: 3 })], ['RECLAIMNO2', () => mm('RECLAIMNO', { nc: o.id })],
      ['PP', () => mm('PP', { id: o.id, coord: o.s.coord, pp: peer, ppAt: o.t })],
      ['TAKEOVER', () => mm('TAKEOVER', { nc: peer })], ['TRANSLOST', () => mm('TRANSLOST', { from: -1, id: peer, hard: true })],
      ['ROUTED', () => mm('ROUTED', { tag: 1, target: cell, pn: 1 })],
      ['LEAVE-sig', () => mm('LEAVE', { sig: true, ck: 9 })],
      ['TX-restamp', () => mm('PHONE', { sig: true, tx: o.t + 3, vAt: 5, sigL: 6, ppL: 7, mpL: 8, foL: 9, l31L: 10, swL: 11, e1At: 12, born: 13 })],
    ];
    for (const [name, f] of [...frames, ...syn]) {
      const s = mk();
      if (name.startsWith('NOROOM') || name.startsWith('PLACE') || name.startsWith('HOME') || name.startsWith('RECLAIM')) { s.oldCell = topo.ckey({ pc: 0, r: 1, i: 1 }); if (!s.hasCoord) s.state = name.startsWith('HOME') ? 1 : 2; }
      run(name, () => { s.recv(f()); log.push('S:' + s.hasCoord + ':' + s.state); log.push(state.dumpState(s)); });
    }
    run('l4Out', () => { const s = mk(); s.l4Out = true; s.recv(mm('HELLO')); log.push('H:' + s.l4Held.length); });
    run('dead', () => { const s = mk(); s.dead = true; s.recv(mm('HELLO')); });
    h.update(log.join('\n')); h.update('\n--\n');
  }
  out[path.basename(dir)] = { seats: n, frames: nfr, calls, digest: h.digest('hex').slice(0, 16) };
  console.log(path.basename(dir) + ': ' + n + ' seat states, ' + nfr + ' recorded frames, ' + calls + ' calls, digest ' + out[path.basename(dir)].digest);
}
if (write) { fs.mkdirSync(path.dirname(golden), { recursive: true }); fs.writeFileSync(golden, JSON.stringify(out, null, 1) + '\n'); console.log('wrote ' + golden); }
else {
  const g = JSON.parse(fs.readFileSync(golden, 'utf8'));
  for (const [d, v] of Object.entries(out)) if (!g[d] || g[d].digest !== v.digest || g[d].calls !== v.calls) { bad++; console.log('DIFF ' + d + ' golden ' + JSON.stringify(g[d]) + ' now ' + JSON.stringify(v)); }
}
console.log(bad ? bad + ' BAD' : 'ok');
process.exit(bad ? 1 : 0);
