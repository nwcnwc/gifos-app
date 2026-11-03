'use strict';
/*
 * ops.test.js: the ops unit without the C++ binary (port plan H3).
 *  1. cprintf.js against C's printf (glibc rounding: an exact tie goes to even).
 *  2. main.js --service on the hand-made battery (corpus.js BATTERY), chunk by chunk against the sim's own stdout
 *     for the same lines, saved in fixtures/ops-battery.cxx.out (made by the sim at 37d787b2d with MESH_NOTIME=1).
 *     A chunk the JS reports as "not wired" is skipped; every other chunk must be byte-equal.
 *  4. a settled room (fixtures/ops-layout.cxx.out): the seating the sim converged to, set up in JS, and the reports that read
 *     only the seating (holes dups hist compact compactfix anchors tiercells find where bad check) against the sim's lines.
 *  3. runScript: a scenario with a net block, setup acts and acts, byte-equal to the sim's --script stdout.
 * Run: node test/mesh-port/harness/ops.test.js
 */
const assert = require('assert'), fs = require('fs'), path = require('path'), cp = require('child_process');
const { sprintf } = require('./cprintf.js');
const { batteryInput } = require('./corpus.js');

const PF = [
  ['%.2f', 0.125, '0.12'],
  ['%.2f', 0.375, '0.38'],
  ['%.2f', 0.5, '0.50'],
  ['%+.1f', 2.25, '+2.2'],
  ['%+.1f', -2.25, '-2.2'],
  ['%5.1f', 3.14159, '  3.1'],
  ['%.0f', 0.5, '0'],
  ['%.0f', 1.5, '2'],
  ['%.0f', 2.5, '2'],
  ['%.4f', 0.3333333333333333, '0.3333'],
  ['%7.1f', -0.04, '   -0.0'],
  ['%+7.1f', 0.0, '   +0.0'],
  ['%.1f', 0.05, '0.1'],
  ['%.1f', 0.25, '0.2'],
  ['%.1f', 0.35, '0.3'],
  ['%.3f', 2.0005, '2.001'],
  ['%.2f', 1e-09, '0.00'],
  ['%.2f', 123456.785, '123456.79'],
];
for (const [f, v, want] of PF) assert.strictEqual(sprintf(f, v), want, f + ' of ' + v);
assert.strictEqual(sprintf('%d %u %lld %zu %llx %s %c|%-4d|%03d|%5s', -1, -1, -5, 7, 255, 'x', 65, 3, 4, 'ab'), '-1 4294967295 -5 7 ff x A|3   |004|   ab');

const split = (s) => { const ch = []; let cur = []; for (const l of s.split('\n')) { if (l === 'READY gifos-mesh-sim service') continue; if (l.startsWith('ERR unknown: __m')) { ch.push(cur); cur = []; } else cur.push(l); } return ch; };
const { cut, input } = batteryInput();
const want = split(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'ops-battery.cxx.out'), 'latin1'));
const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'main.js'), '--service', '--tolerant'], { input, env: Object.assign({}, process.env, { MESH_NOTIME: '1', MESH_THREADS: '1' }), encoding: 'latin1', maxBuffer: 1 << 26 });
assert.strictEqual(r.status, 0, r.stderr);
const got = split(r.stdout);
let same = 0, skipped = 0;
for (let i = 0; i < cut.length - 1; i++) {
  const g = (got[i] || []).join('\n'), w = (want[i] || []).join('\n');
  if (g.startsWith('@@SKIP')) { skipped++; continue; }
  assert.strictEqual(g, w, 'battery line ' + i + ': ' + cut[i].join(' '));
  same++;
}
assert(same >= 200, 'only ' + same + ' battery chunks compared');
// 3. --script: the same scenario file, run from its folder (the SCRIPT line names the path as given)
{
  const fx = path.join(__dirname, '..', 'fixtures');
  const rs = cp.spawnSync(process.execPath, [path.join(__dirname, 'main.js'), '--script', 'ops-script.json', '--seed', '9'], { cwd: fx, env: Object.assign({}, process.env, { MESH_NOTIME: '1' }), encoding: 'latin1' });
  assert.strictEqual(rs.status, 0, rs.stderr);
  assert.strictEqual(rs.stdout, fs.readFileSync(path.join(fx, 'ops-script.cxx.out'), 'latin1'));
}
// 4. a settled room: the sim converged N=130 (seed 5), `seatdump` listed every seat and its cell; the same seating is set
//    up in JS (seated seats with coordinates, nothing else) and the reports that read only the seating are compared with
//    the sim's lines. The compact line's trailing counters (cProbes ...) are seat activity, not seating: cut.
{
  const { createFabric } = require('./fabric.js');
  const { createOps } = require('./runop.js');
  const { Seat } = require('../../../js/mesh/seat.js');
  const topo = require('../../../js/mesh/topo.js');
  const lines = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'ops-layout.cxx.out'), 'latin1').split('\n');
  const fab = createFabric({ levers: { NOTIME: true } }); const outL = []; const ops = createOps(fab, { out: (t) => outL.push(t) });
  fab.lv.SEED0 = 5; ops.runOp(['init', '130', '0']);
  let maxId = -1;
  for (const l of lines) {
    const m = /^SEAT (\d+) (\S+)$/.exec(l); if (!m) continue;
    const id = +m[1]; const c = ops.parseCell(m[2]); const s = new Seat(id, fab.w);
    s.state = 3; s.hasCoord = true; s.coord = c; fab.seats[id] = s; fab.alive[id] = 1; if (id > maxId) maxId = id;
  }
  fab.lv.nextId = maxId + 1;
  const verbs = ['holes', 'dups', 'hist', 'compact', 'compactfix', 'anchors 3 40', 'anchors 3 40 room', 'anchors 7 60 nocap', 'tiercells', 'find /0.0', 'find /1.2', 'find /3.4', 'where 7', 'where 500', 'bad', 'check'];
  const start = lines.findIndex((l) => l.startsWith('OK seatdump')) + 1;
  let n = 0;
  for (const v of verbs) {
    outL.length = 0; ops.runOp(v.split(' ')); const got = outL.join('').replace(/\n$/, ''); let want = lines[start + n++];
    if (v === 'compact') { assert(want.includes(' cProbes=')); want = want.slice(0, want.indexOf(' cProbes=')); assert.strictEqual(got.slice(0, got.indexOf(' cProbes=')), want, v); continue; }
    assert.strictEqual(got, want, 'settled room: ' + v);
  }
  assert.strictEqual(n, verbs.length);
}
console.log('ops.test PASS (cprintf ' + PF.length + ' cases; battery ' + same + ' chunks equal, ' + skipped + ' skipped as not wired)');
