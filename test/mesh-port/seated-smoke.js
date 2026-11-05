#!/usr/bin/env node
// seated-smoke.js <proof dir>... [--stride N]
// Load js/mesh/recv-seated.js (plus every other unit that is present) and call each seated-frame handler on
// seats restored from the L1 state lines, with frames built from each seat's own view (the occupant of each
// owned link speaking as itself, as a rival, as a leaver ...). Callees no unit has defined yet are stubbed
// with neutral values and listed. Each call runs twice from the same state (equal dump, equal emitted frames)
// and must not throw. This does not prove equality with the C++ (that needs the X1 tape replay).
'use strict';
const fs = require('fs'), path = require('path');
const M = path.join(__dirname, '..', '..', 'js', 'mesh');
require('./load-all.js');   // every unit, so the callees the unit makes are the real ones
const sm = require(path.join(M, 'seat.js'));
const { Seat, FREE, FABRIC_CALLS } = sm;
const state = require(path.join(M, 'state.js'));
const msgM = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));
const SF = require(path.join(M, 'seat-fields.js'));
for (const f of fs.readdirSync(M).sort()) if (f.endsWith('.js') && !/^(seat|recv-seated)\.js$/.test(f)) { try { require(path.join(M, f)); } catch (e) { /* a unit that clashes with another: skip */ } }
require(path.join(M, 'recv-seated.js'));
const { lines } = require('./proof-io.js');

const args = process.argv.slice(2);
let stride = 7; const dirs = [];
for (let i = 0; i < args.length; i++) { if (args[i] === '--stride') stride = +args[++i]; else dirs.push(args[i]); }

const src = fs.readFileSync(path.join(M, 'recv-seated.js'), 'utf8');
const fields = new Set(SF.FIELDS.map((f) => f[0]));
const stubbed = new Set();
const STUBV = { ownedLinkCell(k) { return this.hasCoord && topo.ownedLinks(this.coord).some((c) => topo.ckey(c) === k); }, arbCellOf: () => null,
  claimRel: () => true, hearRook: () => true, liveElsewhere: () => false, liveElsewhereSinceReturn: () => false, mvdOk: () => true };
for (const m of src.matchAll(/this\.(\w+)\(/g)) {
  const n = m[1];
  if (n in Seat.prototype || fields.has(n)) continue;
  Seat.unit('smoke stub ' + n, { [n]: STUBV[n] || function () { return false; } }); stubbed.add(n);
}
for (const n of ['l1HasMover', 'l1MoverCell', 'l1RowEmpty']) if (!(n in FREE)) FREE[n] = () => (n === 'l1MoverCell' ? 0 : false);
if (!FREE.ownerCoordOf) FREE.ownerCoordOf = (c) => (c.pc === 0 ? null : topo.up({ pc: c.pc, r: c.r, i: 0 }));
if (!FREE.bumpMoves) FREE.bumpMoves = () => {};
if (!FREE.cellOk) FREE.cellOk = () => true;
if (!FREE.l13Ring) FREE.l13Ring = () => []; if (!FREE.islandStandM) FREE.islandStandM = () => false;

function world(t, log) {
  const w = sm.newWorld({});
  w.TICK = t; w.lv.RSEQ = 0; w.lv.TN_SEQ = 0; w.lv.PN_SEQ = 0;   // the sim's global counters: same start for the twin run
  for (const n of FABRIC_CALLS) w.f[n] = (...a) => { log.push([n, a.map((x) => (x && typeof x === 'object' && x.t ? x.t : x))]); return n === 'fabricLinkState' ? 2 : (n === 'fabricDialFails' ? 0 : false); };
  w.f.fabricSend = (from, to, m) => { log.push(['send', from, to, JSON.stringify(msgM.writeMsg(m))]); };
  return w;
}
function seatFrom(o, log) { const s = new Seat(o.id, world(o.t, log)); state.restore(s, o.s); return s; }

const stats = {}, errs = {};
const fp = require('crypto').createHash('sha1');
let n = 0, bad = 0;
function run(name, o, fn) {
  const l1 = [], l2 = [];
  let d1, d2;
  try {
    for (let tries = 0; ; tries++) {
      l1.length = 0;
      try { const s = seatFrom(o, l1); fn(s); d1 = state.dump(s); break; } catch (e) {
        const mm = /\.(\w+) is not a function/.exec(e.message);
        if (!mm || tries > 30 || (mm[1] in Seat.prototype)) throw e;
        Seat.unit('smoke stub ' + mm[1], { [mm[1]]: function () { return false; } }); stubbed.add(mm[1]);
      }
    }
  } catch (e) { const k = name + ': ' + e.message.slice(0, 90); errs[k] = (errs[k] || 0) + 1; bad++; return; }
  const s2 = seatFrom(o, l2); fn(s2); d2 = state.dump(s2);
  if (d1 !== d2 || JSON.stringify(l1) !== JSON.stringify(l2)) { bad++; errs[name + ': nondeterministic'] = (errs[name + ': nondeterministic'] || 0) + 1; }
  fp.update(name + d1 + JSON.stringify(l1));
  stats[name] = (stats[name] || 0) + 1; n++;
  if (l1.length) stats[name + ' (fabric/emit calls)'] = (stats[name + ' (fabric/emit calls)'] || 0) + l1.length;
}

const ck = topo.ckey;
const mk = (t, f) => { const m = msgM.newMsg(t); f(m); return m; };
for (const dir of dirs) {
  let i = 0;
  for (const raw of lines(path.join(dir, 'state.jsonl'))) {
    if (i++ % stride) continue;
    const o = JSON.parse(raw);
    if (!o.s.hasCoord) continue;
    // each handler gets the frames the occupant x of each owned link could send
    const each = (s, fn) => { for (const c of topo.ownedLinks(s.coord)) { const x = s.occGet(ck(c)); if (x < 0 || x === s.id) continue; fn(c, x); } };
    run('onHello', o, (s) => each(s, (c, x) => { for (const sure of [true, false]) { for (const cell of [ck(c), ck(s.coord), ck(topo.rowMates(s.coord)[0])]) { s.onHello(mk('HELLO', (m) => { m.id = x; m.ck = cell; m.lk = sure ? x : -1; m.arr = 3; m.tn = 5; })); s.w.TICK += 3; } } }));
    run('onYield', o, (s) => each(s, (c, x) => { for (const nc of [-1, x + 1]) { s.onYield(mk('YIELD', (m) => { m.id = x; m.ck = ck(s.coord); m.lk = x; m.sig = true; m.nc = nc; m.tag = 2842; })); } }));
    run('onClaim', o, (s) => each(s, (c, x) => { for (const sure of [true, false]) s.onClaim(mk('CLAIM', (m) => { m.id = x; m.ck = ck(c); m.lk = sure ? x : -1; })); }));
    run('onLeave', o, (s) => each(s, (c, x) => {
      for (const v of [{ bye: true }, { mv: true, nc: x + 1 }, { rel: true }, { bye: true, rl: true }, { rl: true, yl: true }, { bye: true, mvd: ck(topo.rowMates(s.coord)[0]) }])
        s.onLeave(mk('LEAVE', (m) => { m.id = x; m.ck = ck(c); m.lk = x; m.sig = true; m.sigAt = s.TICK; m.sigL = s.TICK; m.tn = 3; m.from = x; Object.assign(m, v); }));
    }));
    // a goodbye signed 30 ticks ago (inside the 60-tick window of the law, outside a shorter one), on a fresh seat each
    for (const v of [{ bye: true }, { bye: true, rl: true }]) run('onLeave(signed 30 ago)', o, (s) => each(s, (c, x) => { s.onLeave(mk('LEAVE', (m) => { m.id = x; m.ck = ck(c); m.lk = x; m.sig = true; m.sigAt = s.TICK - 30; m.sigL = s.TICK - 30; m.tn = 3; m.from = x; Object.assign(m, v); })); }));
    run('onUnneeded', o, (s) => each(s, (c, x) => { for (const tag of [0, 1, 3, 4]) s.onUnneeded(mk('UNNEEDED', (m) => { m.from = x; m.id = x; m.tag = tag; })); }));
    run('onS1Sync', o, (s) => each(s, (c, x) => { s.onS1Sync(mk('S1SYNC', (m) => { m.from = x; m.id = x; m.ent = [{ k: ck({ pc: 0, r: 1, i: 2 }), v: x, age: 3, ch: -1, ba: 5, tn: 0 }, { k: ck({ pc: 0, r: 2, i: 2 }), v: 99, age: 1, ch: 7, ba: -1, tn: 0 }]; })); }));
    run('onDrain', o, (s) => each(s, (c, x) => { s.onDrain(mk('DRAIN', (m) => { m.id = x; m.tag = 1; m.roster = [{ k: ck(c), v: x }]; })); }));
    run('onChallenge', o, (s) => each(s, (c, x) => { for (const tag of [0, 25, 26, 27]) s.onChallenge(mk('CHALLENGE', (m) => { m.from = x; m.ck = ck(s.coord); m.tag = tag; m.via = x; m.asker = x + 1; })); }));
    run('onConfirm', o, (s) => each(s, (c, x) => { s.l25Nc = x; s.l25Ck = ck(s.coord); s.l25At = s.TICK; s.challToId = x; s.challToCk = ck(s.coord); s.challToAt = s.TICK; for (const sg of [true]) s.onConfirm(mk('CONFIRM', (m) => { m.id = x; m.ck = ck(s.coord); m.sig = sg; m.pp = x + 2; m.ppAt = 3; m.ppL = 4; })); }));
    run('onMoved', o, (s) => each(s, (c, x) => { s.onMoved(mk('MOVED', (m) => { m.id = x; m.ck = ck(c); m.sig = true; m.mvd = ck(topo.rowMates(s.coord)[0]); })); }));
    run('onSitXfer/Ping/Pong', o, (s) => each(s, (c, x) => { s.placer = x; s.rowLedger = false; s.onSitXfer(mk('SITXFER', (m) => { m.from = x; m.id = s.id; m.ck = ck(s.coord); m.nbrs = [{ k: ck(topo.rowMates(s.coord)[0]), v: 77 }]; m.row = [{ k: ck(topo.rowMates(s.coord)[1]), v: 78 }]; })); s.onSitPing(mk('SITPING', (m) => { m.from = x; m.id = s.id; m.ck = ck(s.coord); })); s.markSitting(ck(c), x); for (const tag of [0, 1]) s.onSitPong(mk('SITPONG', (m) => { m.id = x; m.ck = ck(c); m.tag = tag; })); }));
    run('onPong', o, (s) => each(s, (c, x) => { for (const sure of [true, false]) s.onPong(mk('PONG', (m) => { m.id = x; m.coord = topo.cc(c); m.lk = sure ? x : -1; m.tn = 2; m.tag = 0; m.owner = x + 1; m.oCk = ck(c); m.row = [{ k: ck(c), v: x, age: -1, ch: -1, ba: -1, tn: 0 }]; m.nbrs = [{ k: ck(c), v: x }]; m.dgPub.at = 1; })); s.pendYBy = x; s.pendYAt = s.TICK; s.pendYCk = ck(s.coord); s.onPong(mk('PONG', (m) => { m.id = x; m.coord = topo.cc(c); m.lk = x; })); }));
    run('onRoute', o, (s) => each(s, (c, x) => { for (const [tgt, tag] of [[s.coord, 1], [s.coord, 2], [s.coord, 3], [c, 1], [c, 0]]) s.onRoute(mk('ROUTE', (m) => { m.target = topo.cc(tgt); m.asker = x; m.tag = tag; m.ttl = 5; m.via = x; m.ck = ck(c); m.nc = x; m.pn = 1; m.coord = topo.cc(c); })); }));
    run('onWalk', o, (s) => each(s, (c, x) => { for (const tgt of [s.coord, c]) s.onWalk(mk('WALK', (m) => { m.target = topo.cc(tgt); m.asker = x; m.ttl = 4; m.via = x; })); }));
    run('onE1State', o, (s) => each(s, (c, x) => { for (const tag of [0, 1, 2, 3]) s.onE1State(mk('E1STATE', (m) => { m.id = x; m.tag = tag; m.coord = topo.cc(c); m.oCk = ck(c); m.owner = tag === 3 ? s.id : x; m.ck = ck(s.coord); m.nc = x + 1; m.e1dn = true; })); }));
    run('onU2', o, (s) => each(s, (c, x) => { for (const [t, tag] of [['U2BEAT', 0], ['U2BEAT', 3], ['U2ACK', 0]]) s.onU2(mk(t, (m) => { m.id = x; m.tag = tag; m.coord = topo.cc(c); m.e1dn = true; })); s.u2Id = x; s.onU2(mk('U2ACK', (m) => { m.id = x; m.e1dn = true; m.hard = true; m.oCk = ck(c); m.owner = x; })); }));
    run('byeRelay', o, (s) => each(s, (c, x) => { s.byeRelay(mk('LEAVE', (m) => { m.id = x; m.ck = ck(c); m.sig = true; m.tn = 1; m.from = x; })); }));
  }
}
console.log('calls ok: ' + n + ', bad: ' + bad + ' (stride ' + stride + ')');
for (const k of Object.keys(stats).sort()) console.log('  ' + k + ': ' + stats[k]);
for (const k of Object.keys(errs).sort()) console.log('  ERR ' + k + ' x' + errs[k]);
console.log('fingerprint ' + fp.digest('hex').slice(0, 16));
console.log('stubbed callees (other units): ' + Array.from(stubbed).sort().join(' '));
process.exit(bad ? 1 : 0);
