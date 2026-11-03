#!/usr/bin/env node
// tick-smoke.js <proof dir>... [--stride N] [--deep-stride N] [--units a,b,c]
// Load js/mesh/tick.js (and the other ported units named by --units, default every unit file present) and call the
// tick, its steps and the L2 up-edge functions on seats restored from the L1 state lines, at several clock offsets,
// with the fabric's links open and closed, and with the seat's anchor cell dropped from its view (to reach the heal
// and drain branches). Callees no unit has defined yet are stubbed with neutral values and listed.
// Per call: the method runs twice from the same state (determinism: equal dumps and equal emitted frames) and must
// not throw. This does not prove equality with the C++ (that needs the X1 tape replay).
'use strict';
const fs = require('fs'), path = require('path');
const M = path.join(__dirname, '..', '..', 'js', 'mesh');
const sm = require(path.join(M, 'seat.js'));
const { Seat, FREE, FABRIC_CALLS } = sm;
const state = require(path.join(M, 'state.js'));
const msgM = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));
const roles = require(path.join(M, 'roles.js'));
const SF = require(path.join(M, 'seat-fields.js'));
const { lines } = require('./proof-io.js');

const args = process.argv.slice(2);
let stride = 7, dstride = 0, units = null; const dirs = [];
for (let i = 0; i < args.length; i++) { if (args[i] === '--stride') stride = +args[++i]; else if (args[i] === '--deep-stride') dstride = +args[++i]; else if (args[i] === '--units') units = args[++i].split(','); else dirs.push(args[i]); }
const loaded = [];
for (const f of (units || fs.readdirSync(M).filter((x) => x.endsWith('.js')).map((x) => x.replace(/\.js$/, '')))) {
  if (['tick', 'seat'].includes(f)) continue;
  try { require(path.join(M, f + '.js')); loaded.push(f); } catch (e) { if (units) throw e; }   // a file that is not a unit (no dependencies met) is skipped
}
const tickM = require(path.join(M, 'tick.js')); loaded.push('tick');

// the C++ free functions a unit needs and none owns yet (port integration notes)
if (!FREE.ownerCoordOf) FREE.ownerCoordOf = (c) => (c.pc === 0 ? null : topo.up({ pc: c.pc, r: c.r, i: 0 }));
if (!FREE.cellOk) FREE.cellOk = () => true;
if (!FREE.coordStr) FREE.coordStr = () => '';
if (!FREE.bumpMoves) FREE.bumpMoves = () => {};
for (const n of ['l1HasMover', 'l1MoverCell', 'l1RowEmpty', 'l13Ring', 'l13Witness', 'islandStandM', 'l35HandOn', 'l35Hinted', 'c7Goodbye'])
  if (!FREE[n]) FREE[n] = n === 'l13Ring' ? () => [] : n === 'l1MoverCell' ? () => 0 : () => false;

// stub every this.<name>( the unit calls that no unit has defined yet
const src = fs.readFileSync(path.join(M, 'tick.js'), 'utf8');
const fields = new Set(SF.FIELDS.map((f) => f[0]));
const stubbed = new Set();
const STUBV = {};
for (const m of src.matchAll(/this\.(\w+)\(/g)) {
  const n = m[1];
  if (n in Seat.prototype || fields.has(n)) continue;
  Seat.unit('smoke stub ' + n, { [n]: STUBV[n] || function () { return false; } }); stubbed.add(n);
}

let linkMode = 0;   // 0: fabricLinkState says LS_OPEN, 1: LS_CLOSED
function world(t, log) {
  const w = sm.newWorld({ levers: Object.assign({}, require(path.join(M, 'consts.js')).levers) });   // own levers: RSEQ is a counter
  w.TICK = t;
  for (const n of FABRIC_CALLS) w.f[n] = (...a) => { log.push([n, a]); return n === 'fabricLinkState' ? (linkMode ? 3 : 2) : (n === 'fabricDialFails' ? 0 : n === 'fabricDoors' ? true : false); };
  w.f.fabricSend = (from, to, m) => { log.push(['send', from, to, JSON.stringify(msgM.writeMsg ? msgM.writeMsg(m) : m)]); };
  return w;
}
function seatFrom(o, log, dt, drop) {
  const s = new Seat(o.id, world(o.t + dt, log)); state.restore(s, o.s);
  if (drop && s.hasCoord) {   // the cell my anchor holds is gone in my view, by goodbye
    const anc = s.coord.i !== 0 ? { pc: s.coord.pc, r: s.coord.r, i: 0 } : s.ownerCoord();
    if (anc) { const k = topo.ckey(anc); s.occ.delete(k); s.byeAt.set(k, s.TICK - 3); s.lastAck = s.TICK - 90; }
  }
  return s;
}

const stats = {}, errs = {};
const fp = require('crypto').createHash('sha1');
let n = 0, bad = 0;
function run(name, o, dt, drop, fn) {
  const l1 = [], l2 = [];
  let d1, d2;
  try {
    for (let tries = 0; ; tries++) {
      l1.length = 0;
      try { const s = seatFrom(o, l1, dt, drop); const rv = fn(s); d1 = state.dump(s) + JSON.stringify(rv === undefined ? null : rv); break; } catch (e) {
        const mm = /\.(\w+) is not a function/.exec(e.message);
        if (!mm || tries > 30 || (mm[1] in Seat.prototype)) throw e;
        Seat.unit('smoke stub ' + mm[1], { [mm[1]]: function () { return false; } }); stubbed.add(mm[1]);
      }
    }
  } catch (e) { const key = name + ': ' + e.message.slice(0, 90); errs[key] = (errs[key] || 0) + 1; bad++; return; }
  const s2 = seatFrom(o, l2, dt, drop); const r2 = fn(s2); d2 = state.dump(s2) + JSON.stringify(r2 === undefined ? null : r2);
  if (d1 !== d2 || JSON.stringify(l1) !== JSON.stringify(l2)) { bad++; errs[name + ': nondeterministic'] = (errs[name + ': nondeterministic'] || 0) + 1; }
  fp.update(name + dt + drop + linkMode + d1 + JSON.stringify(l1));
  stats[name] = (stats[name] || 0) + 1; n++;
  if (l1.length) stats[name + ' (fabric/emit calls)'] = (stats[name + ' (fabric/emit calls)'] || 0) + l1.length;
}


// Pokes: field settings that reach the held / entry / transit branches the sampled states rarely sit in.
const R2 = (s) => [{ k: 1, v: s.id + 1 }, { k: 2, v: s.id + 2 }];
const POKES = [
  ['dHold due', (s) => { s.dHoldCol = 0; s.dHoldDue = s.TICK - 1; s.dHoldMsg = msgM.newMsg('FIND'); }],
  ['dHold wait', (s) => { s.dHoldCol = 0; s.dHoldDue = s.TICK + 5; }],
  ['movedOn seated', (s) => { s.movedOnFrom = topo.ckey({ pc: 0, r: 1, i: 1 }); }],
  ['movedOn greeter', (s) => { s.state = 1; s.hasCoord = false; s.rcGreeter = s.id + 1; s.movedOnFrom = topo.ckey({ pc: 0, r: 1, i: 1 }); }],
  ['reclaim round2', (s) => { s.state = 1; s.rcPendAt = s.TICK - 100; s.oldCell = topo.ckey({ pc: 0, r: 1, i: 1 }); s.rcPendWait = K.RC_WAIT + 10; s.rcRound2 = false; }],
  ['reclaim take', (s) => { s.state = 1; s.rcPendAt = s.TICK - 100; s.oldCell = topo.ckey({ pc: 0, r: 1, i: 1 }); s.rcPendWait = 5; s.rcPend = Object.assign(msgM.newMsg('PLACE'), { coord: { pc: 0, r: 1, i: 1 }, owner: s.id + 1, pp: -1, ppAt: -1, ppL: -1 }); }],
  ['reclaim r2 over', (s) => { s.state = 1; s.rcRound2 = true; s.rcRound2At = s.TICK - 1000; s.oldCell = topo.ckey({ pc: 0, r: 1, i: 1 }); s.rcPendAt = -1; }],
  ['evilDoor', (s) => { s.evilDoor = true; s.hostile = true; }],
  ['stranded', (s) => { s.state = 0; s.hasCoord = false; s.stranded = true; s.strandedAt = s.TICK - 100000; }],
  ['reAsk roster', (s) => { s.state = 0; s.hasCoord = false; s.reAsk = true; s.haveRoster = true; s.roster = R2(s); }],
  ['reJoin', (s) => { s.state = 0; s.hasCoord = false; s.reJoin = true; }],
  ['retry 0', (s) => { s.state = 0; s.hasCoord = false; s.retryAt = s.TICK - 50; }],
  ['retry 1 pend', (s) => { s.state = 1; s.hasCoord = false; s.retryAt = s.TICK - 50; s.rcPendAt = s.TICK; s.oldCell = 5; }],
  ['asking roster', (s) => { s.state = 2; s.hasCoord = false; s.retryAt = s.TICK - 100; s.haveRoster = true; s.roster = R2(s); s.lastAsked = s.id + 1; s.seatTries = 0; }],
  ['asking seatTries', (s) => { s.state = 2; s.hasCoord = false; s.retryAt = s.TICK - 100; s.haveRoster = true; s.roster = R2(s); s.seatTries = 9; }],
  ['asking empty', (s) => { s.state = 2; s.hasCoord = false; s.retryAt = s.TICK - 100; s.haveRoster = false; }],
  ['l815', (s) => { s.l815N = 2; s.l815At = [s.TICK - 10, s.TICK - 1, 0, 0, 0, 0, 0, 0]; s.l815Ck = [topo.ckey({ pc: 0, r: 0, i: 1 }), 2, 0, 0, 0, 0, 0, 0]; s.l815To = [s.id + 1, s.id + 2, 0, 0, 0, 0, 0, 0]; s.l815Prev = [s.id + 1, 1, 0, 0, 0, 0, 0, 0]; }],
  ['rcHanded', (s) => { s.rcHanded.set(topo.ckey(s.coord), [s.id + 1, s.TICK - 5]); s.rcHanded.set(7, [s.id + 1, s.TICK - 500]); s.leaseUntil = s.TICK + 20; s.leaseCk = 99; }],
  ['moving', (s) => { s.moving = true; s.moveAt = s.TICK - 100; s.rmNeedWit = true; }],
  ['moving nowit', (s) => { s.moving = true; s.moveAt = s.TICK - 100; s.rmNeedWit = false; s.leaseUntil = s.TICK - 1; }],
  ['movedClaim', (s) => { s.movedClaimId = s.id + 1; s.movedClaimAt = s.TICK - 5; s.movedClaimK = topo.ckey({ pc: 0, r: 1, i: 1 }); s.translost.set(s.movedClaimK, s.TICK - 40); s.rosterAskAt = -100; s.movedClaimMsg = Object.assign(msgM.newMsg('HELLO'), { id: s.id + 1, ck: s.hasCoord ? topo.ckey(s.coord) : 0 }); }],
  ['pendY', (s) => { s.pendYBy = s.id + 1; s.pendYAt = s.TICK - 2; s.pendYCk = s.hasCoord ? topo.ckey(s.coord) : 0; s.pendYNc = s.id + 2; s.pendYPp = 5; s.pendYPpL = 5; s.pp = 3; s.ppL = 3; s.ppCk = s.pendYCk; }],
  ['pendY expired', (s) => { s.pendYBy = s.id + 1; s.pendYAt = s.TICK - 1000; }],
  ['rival+lastPhone', (s) => { s.rivalId = s.id + 1; s.lastPhone = s.TICK - 20; s.xlinkAt = 0; s.s1CheckAt = -1; }],
  ['s1Check due', (s) => { s.s1CheckAt = s.TICK - 1; }],
  ['lone ask', (s) => { s.seatedAt = s.TICK - 500; s.l9LoneAt = s.TICK - 500; s.lastAck = s.TICK - 500; s.lastGreeters = [s.id + 1, s.id + 2, s.id + 3]; s.roster = R2(s); s.occ.delete(topo.ckey({ pc: s.coord.pc, r: s.coord.r, i: 0 })); }],
  ['anchor crash', (s) => { const a = s.coord.i !== 0 ? { pc: s.coord.pc, r: s.coord.r, i: 0 } : s.ownerCoord(); if (a) { const x = s.id + 1; s.occ.set(topo.ckey(a), x); s.live.delete(topo.ckey(a)); s.l13DownPeer = [x]; s.l13DownAt = [s.TICK - 5]; s.l13DownCrash = [1]; } }],
  ['left-pack', (s) => { s.healAt = -100; s.translost.set(topo.ckey({ pc: 0, r: s.coord.r, i: 0 }), s.TICK - 60); s.occ.delete(topo.ckey({ pc: 0, r: s.coord.r, i: 0 })); s.byeAt.set(topo.ckey({ pc: 0, r: s.coord.r, i: 0 }), s.TICK - 40); }],
  ['head heal', (s) => { s.healAt = -100; s.lastAck = s.TICK - 100; s.headAckAt = s.TICK - 200; s.occ.delete(topo.ckey({ pc: s.coord.pc, r: s.coord.r, i: 0 })); }],
  ['owner early', (s) => { const o = s.ownerCoord(); if (o) { const k = topo.ckey(o); s.healAt = -100; s.lastAck = s.TICK - 300; s.occ.delete(k); s.translost.set(k, s.TICK - 80); s.healTry.delete(k); s.ownDeadCk = k; s.ownDeadAt = s.TICK - 3; s.ownDeadId = -1; s.ownVouchAt = -100; s.lastGreeters = [s.id + 1]; } }],
  ['owner dead cousins', (s) => { const o = s.ownerCoord(); if (o) { const k = topo.ckey(o); s.healAt = -100; s.lastAck = s.TICK - 300; s.occ.delete(k); s.healTry.delete(k); s.cousins.set(topo.ckey(s.coord), s.id); s.bkId = s.id + 1; s.bkCk = topo.ckey({ pc: o.pc, r: o.r, i: 1 }); } }],
  ['drain', (s) => { s.lastAck = s.TICK - 400; s.u2UpAt = -1; }],
  ['l816', (s) => { s.lastAck = s.TICK - 10; const hk = topo.ckey({ pc: s.coord.pc, r: s.coord.r, i: 0 }); s.occ.clear(); s.translost.set(hk, s.TICK - 300); s.lastAck = s.TICK - 5; }],
  ['u2 hot', (s) => { s.e1Dn = true; s.e1DnAt = s.TICK - 3; s.u2Hot = true; s.u2AckAt = s.TICK - 40; s.bkId = s.id + 1; s.sbId = s.id + 2; s.u2BeatAt = -100; s.u3BeatAt = -100; s.u2SrcAt = 0; }],
  ['u2 headE1Dn', (s) => { s.headE1Dn = true; s.headE1At = s.TICK - 4; s.u2OkSince = -1; s.u2Hot = true; s.ownDeadCk = 1; s.ownDeadAt = s.TICK - 2; s.u2Row = s.hasCoord ? topo.ckey({ pc: s.coord.pc, r: s.coord.r, i: 0 }) : 0; }],
];
const K = require(path.join(M, 'consts.js')).consts;

const DTS = [0, 9, 25, 61, 130, 260];
for (const dir of dirs) {
  let i = 0, j = 0;
  for (const raw of lines(path.join(dir, 'state.jsonl'))) {
    const deep = dstride && /"coord":\{"pc":[1-9]/.test(raw);   // deep seats are sampled on their own stride
    if (deep ? j++ % dstride : i++ % stride) continue;
    const o = JSON.parse(raw);
    for (const lm of [0, 1]) {
      linkMode = lm;
      for (const dt of DTS) for (const drop of [false, true]) {
        if (drop && (!o.s.hasCoord || o.s.coord.pc === 0)) continue;
        run('tick', o, dt, drop, (s) => s.tick());
        if (!o.s.hasCoord) continue;
        run('drainOrReenter', o, dt, drop, (s) => s.drainOrReenter());
        run('drainOrReenter roster', o, dt, drop, (s) => { s.haveRoster = true; s.roster = [{ k: 1, v: s.id + 1 }, { k: 2, v: s.id + 2 }]; s.lastAck = s.TICK - 100; s.drainAt = 0; s.w.f.l164Of = () => true; return s.drainOrReenter(); });
        run('l21Relay+relStake', o, dt, drop, (s) => {
          const r = []; for (const c of topo.ownedLinks(s.coord)) {
            const k = topo.ckey(c); r.push(s.relStake(k));
            for (const sig of [false, true]) for (const l13 of [false, true]) { const m = msgM.newMsg('LEAVE'); m.ck = k; m.id = s.id + 7; m.tn = 3; m.sig = sig; m.sigAt = 5; m.sigL = 2; m.from = -1; s.l21Relay(m); m.tn++; s.l21Relay(m); }
          }
          s.byeRly.clear(); for (let i = 0; i < 300; i++) s.byeRly.set('k' + i, s.TICK - (i % 2 ? 200 : 1)); const m = msgM.newMsg('LEAVE'); m.ck = topo.ckey(s.coord); m.sig = true; m.id = 99; s.l21Relay(m); r.push(s.byeRly.size);
          return r;
        });
        run('up2Tick', o, dt, drop, (s) => s.up2Tick());
        run('redialTick', o, dt, drop, (s) => s.redialTick());
        if (o.s.coord.pc !== 0) {
          run('healOwner', o, dt, drop, (s) => s.healOwner());
          run('drainOrCompact(false)', o, dt, drop, (s) => s.drainOrCompact(false));
          run('drainOrCompact(true)', o, dt, drop, (s) => s.drainOrCompact(true));
          run('tickDeep', o, dt, drop, (s) => { s.w.L13CUR = s; s.tickDeep(); });
        } else run('tickSection1', o, dt, drop, (s) => { s.w.L13CUR = s; s.tickSection1(); });
        run('tickHeld', o, dt, drop, (s) => s.tickHeld());
        run('tickEntry', o, dt, drop, (s) => s.tickEntry());
        run('tickCommon', o, dt, drop, (s) => { s.w.L13CUR = s; return s.tickCommon(); });
        for (const [pn, pf] of POKES) for (const nm of ['tickHeld', 'tickEntry', 'tickCommon', 'tick', o.s.coord.pc === 0 ? 'tickSection1' : 'tickDeep', 'up2Tick', 'healOwner', 'drainOrCompact'])
          run(nm + ' +' + pn, o, dt, drop, (s) => { pf(s); s.w.L13CUR = s; return nm === 'drainOrCompact' ? s.drainOrCompact(false) : s[nm](); });
        run('L2 predicates', o, dt, drop, (s) => {
          const r = [s.e1Down(), s.headGone(), s.l2E2Up(), s.l2RowE2Down()];
          for (const c of topo.ownedLinks(s.coord)) { const k = topo.ckey(c); r.push(s.l2OwnerHold(k), s.l3QuietLoss(k), s.l2Peer(s.occGet(k)), s.l2Around(c, -1, false), s.l2Around(c, s.occGet(k), true)); }
          return r;
        });
        run('u2Rows+l2Around', o, dt, drop, (s) => {   // a served row, as onU2 would leave it
          const r = []; for (const c of topo.ownedLinks(s.coord)) {
            const x = s.occGet(topo.ckey(c)); if (x < 0 || x === s.id) continue;
            const row = { pc: topo.down(s.coord).pc, r: s.coord.r, i: 0 };
            for (const t3 of [false, true]) s.u2Rows.set(tickM.u2RowKey(topo.ckey(row), t3), Object.assign(state.newStruct('U2Row'), { heir: x, at: s.TICK - 5, hot: false }));
            r.push(s.l2Around(topo.down(s.coord), -1, true), s.l2Around({ pc: row.pc, r: row.r, i: 1 }, x, false), s.l2Peer(x));
          }
          return r;
        });
      }
    }
  }
}
console.log('units loaded: ' + loaded.join(' '));
console.log('calls ok: ' + n + ', bad: ' + bad + ' (stride ' + stride + ')');
for (const k of Object.keys(stats).sort()) console.log('  ' + k + ': ' + stats[k]);
for (const k of Object.keys(errs).sort()) console.log('  ERR ' + k + ' x' + errs[k]);
console.log('fingerprint ' + fp.digest('hex').slice(0, 16));
console.log('stubbed callees (other units): ' + Array.from(stubbed).sort().join(' '));
process.exit(bad ? 1 : 0);
