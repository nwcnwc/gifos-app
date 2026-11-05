#!/usr/bin/env node
// live-smoke.js <proof dir>... [--stride N] [--mutate]
// Load js/mesh/live.js and call each liveness method on seats restored from the L1 state lines.
// Callees owned by other units (not yet ported) are stubbed with neutral values and listed.
// Per call: the method runs twice from the same state (determinism: equal dumps and equal emitted frames)
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
require(path.join(M, 'live.js'));
const { lines } = require('./proof-io.js');

const args = process.argv.slice(2);
let stride = 7; const dirs = [];
for (let i = 0; i < args.length; i++) { if (args[i] === '--stride') stride = +args[++i]; else dirs.push(args[i]); }

// stub every this.<name>( the unit calls that no unit has defined yet
const src = fs.readFileSync(path.join(M, 'live.js'), 'utf8');
const fields = new Set(SF.FIELDS.map((f) => f[0]));
const stubbed = new Set();
const STUBV = { kVerify: () => 0, pubDig: (d) => msgM.newDig(), l1DeepKid: () => -1, l211Stamp: () => 0, ringName: () => 0, l165Have: () => null, bornOf: () => null,
  ownedLinkCell(k) { return this.hasCoord && topo.ownedLinks(this.coord).some((c) => topo.ckey(c) === k); } };
if (!('islandSeen' in Seat.prototype)) { Seat.unit('smoke stub islandSeen', { islandSeen: () => false }); stubbed.add('islandSeen'); }
for (const m of src.matchAll(/this\.(\w+)\(/g)) {
  const n = m[1];
  if (n in Seat.prototype || fields.has(n)) continue;
  Seat.unit('smoke stub ' + n, { [n]: STUBV[n] || function () { return false; } }); stubbed.add(n);
}
for (const n of ['l1HasMover', 'l1MoverCell', 'l1RowEmpty']) FREE[n] = () => (n === 'l1MoverCell' ? 0 : false);
FREE.l13Ring = () => []; FREE.islandStandM = () => false;

function world(t, log) {
  const w = sm.newWorld({});
  w.TICK = t; w.lv.RSEQ = 0; w.lv.TN_SEQ = 0; w.lv.PN_SEQ = 0;   // the sim's global counters: same start for the twin run
  for (const n of FABRIC_CALLS) w.f[n] = (...a) => { log.push([n, a]); return n === 'fabricOpenPeers' ? [] : n === 'fabricLinkState' ? 0 : (n === 'fabricDialFails' ? 0 : false); };
  w.f.fabricSend = (from, to, m) => { log.push(['send', from, to, JSON.stringify(msgM.writeMsg ? msgM.writeMsg(m) : m)]); };
  return w;
}
function seatFrom(o, log) { const s = new Seat(o.id, world(o.t, log)); state.restore(s, o.s); return s; }

const stats = {}, errs = {};
const fp = require('crypto').createHash('sha1');   // fingerprint of every output: a changed behaviour changes it
let n = 0, bad = 0;
function run(name, o, fn) {
  const l1 = [], l2 = [];
  let d1, d2, rv;
  try {
    for (let tries = 0; ; tries++) {
      l1.length = 0;
      try { const s = seatFrom(o, l1); rv = fn(s); d1 = state.dump(s) + JSON.stringify(rv === undefined ? null : rv); break; } catch (e) {
        const mm = /\.(\w+) is not a function/.exec(e.message);
        if (!mm || tries > 30 || (mm[1] in Seat.prototype)) throw e;
        Seat.unit('smoke stub ' + mm[1], { [mm[1]]: function () { return false; } }); stubbed.add(mm[1]);
      }
    }
  } catch (e) { errs[name + ': ' + e.message.slice(0, 90)] = (errs[name + ': ' + e.message.slice(0, 90)] || 0) + 1; bad++; return; }
  const s2 = seatFrom(o, l2); const r2 = fn(s2); d2 = state.dump(s2) + JSON.stringify(r2 === undefined ? null : r2);
  if (d1 !== d2 || JSON.stringify(l1) !== JSON.stringify(l2)) { bad++; errs[name + ': nondeterministic'] = (errs[name + ': nondeterministic'] || 0) + 1; }
  fp.update(name + d1 + JSON.stringify(l1));
  stats[name] = (stats[name] || 0) + 1; n++;
  if (l1.length) stats[name + ' (fabric/emit calls)'] = (stats[name + ' (fabric/emit calls)'] || 0) + l1.length;
}

for (const dir of dirs) {
  let i = 0;
  for (const raw of lines(path.join(dir, 'state.jsonl'))) {
    if (i++ % stride) continue;
    const o = JSON.parse(raw);
    if (!o.s.hasCoord) continue;
    for (const nm of ['darkSeat', 'retireDead', 'd6Lease', 'islanded', 'islandSince', 'rowSweep', 'childSweep', 'tlSweep', 's1Heartbeat', 's1Sync', 'l10Digs', 'phoneHome', 'transportLost', 'requeue', 'leave'])
      run(nm, o, (s) => { if (nm === 'transportLost') { const ol = topo.ownedLinks(s.coord); const x = s.occGet(topo.ckey(ol[0])); s.transportLost(x >= 0 ? x : 1, true); s.transportLost(x >= 0 ? x : 1, false); } else if (nm === 'requeue') s.requeue('smoke'); else if (nm === 'leave') { s.leave(false); } else return s[nm](); });
    run('noteUnp', o, (s) => { const r = []; for (const c of topo.ownedLinks(s.coord)) { const x = s.occGet(topo.ckey(c)); if (x < 0 || x === s.id) continue; for (const lk of [x, -1, -1]) { const m = msgM.newMsg('PHONE'); m.id = x; m.coord = topo.cc(c); m.lk = lk; s.noteUnp(m); s.w.TICK += 9; } } return r; });
    run('pongDig', o, (s) => { for (const c of topo.ownedLinks(s.coord)) { const x = s.occGet(topo.ckey(c)); if (x < 0) continue; const m = msgM.newMsg('PONG'); m.id = x; m.coord = topo.cc(c); m.dgRoot.at = s.TICK - 2; m.dgRoot.n = 3; m.dgPub.at = s.TICK - 1; s.pongDig(m, x); s.pongDig(m, x); } });
    run('phoneHome(early)', o, (s) => s.phoneHome(true));
    run('s1Heartbeat(early)', o, (s) => s.s1Heartbeat(true));
    run('s1Sync(early)', o, (s) => s.s1Sync(true));
    run('ringConfirmDead+translostConfirmed+goodbyeHeal', o, (s) => { const ol = topo.ownedLinks(s.coord); for (const c of ol) { s.ringConfirmDead(c); s.translostConfirmed(topo.ckey(c)); } s.goodbyeHeal(topo.ckey(ol[0]), false); s.goodbyeHeal(topo.ckey(ol[0]), true); });
    // onPhone: a PHONE from the occupant of each owned link, as the transport would name it
    run('onPhone', o, (s) => {
      for (const c of topo.ownedLinks(s.coord)) {
        const x = s.occGet(topo.ckey(c)); if (x < 0 || x === s.id) continue;
        for (const sure of [true, false]) {
          const m = msgM.newMsg('PHONE'); m.id = x; m.coord = topo.cc(c); m.tock = topo.ckey(s.coord); m.lk = sure ? x : -1; m.arr = 3; m.row = [{ k: topo.ckey(c), v: x, age: -1, ch: -1, ba: -1, tn: 0 }]; m.rg = 1;
          s.onPhone(m);
        }
      }
    });
  }
}
console.log('calls ok: ' + n + ', bad: ' + bad + ' (stride ' + stride + ')');
for (const k of Object.keys(stats).sort()) console.log('  ' + k + ': ' + stats[k]);
for (const k of Object.keys(errs).sort()) console.log('  ERR ' + k + ' x' + errs[k]);
console.log('fingerprint ' + fp.digest('hex').slice(0, 16));
console.log('stubbed callees (other units): ' + Array.from(stubbed).sort().join(' '));
process.exit(bad ? 1 : 0);
