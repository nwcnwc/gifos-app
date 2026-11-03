#!/usr/bin/env node
// entry-smoke.js [--write-golden] <proof dir>...
// Smoke and regression guard for js/mesh/entry.js (port unit S3). For sampled seat states of the sim's
// proof runs (state.jsonl): restore the seat, give it a recording fabric and no-op stand-ins for the methods
// other units own, call every entry method on it, and fold everything it did (frames sent, fabric calls,
// seat state after) into one digest per dir. The digest is compared with test/mesh-port/fixtures/entry-smoke.json
// (written by --write-golden from the unmutated port). This proves the unit loads, runs on real states and
// does not drift; that it matches the C++ is proved by the tape replay (X1), not here.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const M = path.join(__dirname, '..', '..', 'js', 'mesh');
const seatM = require(path.join(M, 'seat.js'));
const { Seat } = seatM;
require(path.join(M, 'entry.js'));
const state = require(path.join(M, 'state.js'));
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));
const { lines } = require('./proof-io.js');

// Stand-ins for methods other units own (only where the real one is not loaded yet).
const STUB = { rmWitCell: false, l13Answer: undefined, ppAdmitter: -1, l710Dial: undefined, rmName: false, l33ChildVouch: undefined, route: undefined, l31Hold: false, l4Hop: false, l31Held: false, l13MateGone: false, l33MateArm: false, l33HeirCalled: false, l31Direct: false, liveElsewhere: false, l33RowGate: false, l33NoAdmitter: false, l711Handed: undefined, l33HoldFull: false, ownedLinkCell: false, l1DeepKid: -1, islandSeen: false, rmRowMaybeLive: false, mergeCalc: false, l1612Keep: false, };
for (const [k, v] of Object.entries(STUB)) if (!(k in Seat.prototype)) Object.defineProperty(Seat.prototype, k, { value: function (...a) { this.__log && this.__log.push(k + ':' + JSON.stringify(a)); return v; }, writable: true, configurable: true });
for (const [k, v] of Object.entries({ l13Ring: () => [], l13Witness: () => null, islandStandM: () => false })) if (!seatM.FREE[k]) Seat.free({ [k]: v });

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

const golden = path.join(__dirname, 'fixtures', 'entry-smoke.json');
const write = process.argv.includes('--write-golden');
const dirs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const out = {}; let bad = 0;
for (const dir of dirs) {
  const h = crypto.createHash('sha256'); let n = 0, calls = 0, k = 0;
  for (const raw of lines(path.join(dir, 'state.jsonl'))) {
    if (k++ % 40) continue;
    const o = JSON.parse(raw); n++;
    const log = [];
    const mk = () => { const s = new Seat(o.id, world(o.t, log)); state.restore(s, o.s); s.__log = log; s.emit = function (to, m) { log.push('E:' + to + ':' + JSON.stringify(msg.clone(m))); }; s.rng = ((x) => () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 2147483648; })(o.id + o.t); return s; };
    const run = (name, f) => { log.push('== ' + name); try { f(); calls++; } catch (e) { bad++; log.push('THROW ' + name + ' ' + e.message); console.log('THROW', dir, 't=' + o.t, 'id=' + o.id, name, e.stack.split('\n').slice(0, 3).join(' | ')); } };
    let s = mk();
    const seeker = 100000 + o.id;
    const find = (ttl, tag) => { const m = msg.newMsg('FIND'); m.nc = seeker; m.from = seeker; m.ttl = ttl; m.tag = tag || 0; m.coord = { pc: 0, r: 1, i: 1 }; return m; };
    run('announce', () => { if (s.hasCoord) s.announce(); });
    run('recheckSitting', () => {
      // synthetic vouches of every age (and one foreign promise), so every branch of the check-back runs
      const K = require(path.join(M, 'consts.js')).consts; let q = 0;
      for (const age of [0, K.PLACE_REPLAY, K.SIT_RECHECK, K.SIT_RECHECK + 1, K.SIT_RECHECK + K.SIT_PING_WAIT + 2, K.SIT_TTL, K.SIT_TTL + 1]) for (const mine of [true, false]) {
        const e = state.newStruct('SoftSit'); e.joiner = 5000 + q; e.assigner = mine ? s.id : s.id + 1; e.at = s.TICK - age; if (mine && age % 2) { e.pl = msg.newMsg('PLACE'); e.pl.nc = e.joiner; } s.sitting.set(65536 * 7 + q++, e);
      }
      for (let pass = 0; pass < 3; pass++) { s.recheckSitting(); log.push('SIT' + pass + ':' + JSON.stringify([...s.sitting.keys()])); s.w.TICK += 20; } s.w.TICK -= 60;
      log.push('SIT:' + JSON.stringify([...s.sitting]));
    });
    run('serveFind', () => s.serveFind(find(200)));
    run('serveFind-ttl0', () => s.serveFind(find(0)));
    run('serveFindS1', () => { if (s.hasCoord && s.coord.pc === 0) s.serveFindS1(find(150), { v: false }); });
    run('serveFindSpread', () => { if (s.hasCoord) s.serveFindSpread(find(150), false); });
    run('serveFindDescend', () => { if (s.hasCoord) s.serveFindDescend(find(150)); });
    run('holdFind', () => { s.holdFind(find(100), false, false); s.holdFind(find(100), true, true); });
    run('serveHeld', () => { s.serveHeld(); s.TICK; });
    run('answerDoor', () => { s.answerDoor(-1, seeker, msg.newMsg('NOROOM')); s.answerDoor(3, seeker, msg.newMsg('PLACE')); });
    run('tryReclaim', () => { s.oldCell = s.hasCoord ? topo.ckey(s.coord) : 65536; const ro = []; for (const [c, v] of s.occ) ro.push({ k: c, v }); log.push('R:' + s.tryReclaim(ro, 7)); });
    run('serveReclaim', () => { const m = msg.newMsg('RECLAIM'); m.id = seeker; m.ck = s.hasCoord ? topo.ckey(s.coord) : 0; m.tok = 1; s.serveReclaim(m); const m2 = msg.newMsg('RECLAIM'); m2.id = seeker; m2.ck = [...s.occ.keys()][0] || 0; m2.tok = 1; s.serveReclaim(m2); });
    run('rcBeside', () => { if (s.hasCoord) s.rcBeside(seeker, topo.ckey(s.coord), topo.ckey({ pc: 0, r: 2, i: 2 })); });
    run('admit', () => { if (s.hasCoord) { s.w.ADMIT_SITE = 'smoke'; s.admit({ pc: 0, r: 4, i: 4 }, find(190)); s.admit({ pc: 0, r: 4, i: 3 }, find(190, 1)); } });
    run('take', () => { const c = { pc: 0, r: 3, i: 2 }; const nb = [{ k: topo.ckey({ pc: 0, r: 3, i: 3 }), v: 77 }, { k: topo.ckey({ pc: 0, r: 2, i: 2 }), v: -1 }]; s.take(c, 5, nb, 5, o.t, [], -1); log.push(state.dumpState(s)); s.take({ pc: 1, r: 2, i: 0 }, 6, [{ k: topo.ckey({ pc: 0, r: 2, i: 1 }), v: 78 }], 6, o.t, [{ k: topo.ckey({ pc: 1, r: 2, i: 1 }), v: 79, age: 0, ch: -1, ba: -1, tn: 0 }], -1); log.push('T:' + s.state + ':' + topo.ckey(s.coord) + ':' + s.tn); });
    run('reseatViaRoster', () => { s.reseatViaRoster(); log.push('S:' + s.hasCoord + ':' + s.state); });
    run('stateAfter', () => log.push(state.dumpState(s)));
    h.update(log.join('\n')); h.update('\n--\n');
  }
  out[path.basename(dir)] = { seats: n, calls, digest: h.digest('hex').slice(0, 16) };
  console.log(path.basename(dir) + ': ' + n + ' seat states, ' + calls + ' calls, digest ' + out[path.basename(dir)].digest);
}
if (write) { fs.mkdirSync(path.dirname(golden), { recursive: true }); fs.writeFileSync(golden, JSON.stringify(out, null, 1) + '\n'); console.log('wrote ' + golden); }
else {
  const g = JSON.parse(fs.readFileSync(golden, 'utf8'));
  for (const [d, v] of Object.entries(out)) if (!g[d] || g[d].digest !== v.digest || g[d].calls !== v.calls) { bad++; console.log('DIFF ' + d + ' golden ' + JSON.stringify(g[d]) + ' now ' + JSON.stringify(v)); }
}
console.log(bad ? bad + ' BAD' : 'ok');
process.exit(bad ? 1 : 0);
