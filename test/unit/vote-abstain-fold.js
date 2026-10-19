// vote-abstain-fold.js — ABSTAIN IN THE FOLDED (PAST ONE SECTION) TALLY.
//
// Past C² people the stage tallies are the room fold's (js/mesh.js rollup):
// per-target vote sums plus awayN. An abstain must fold the way the page
// tallies it (run.html stageVoteTallies):
//   - abstaining on every vote ('*') folds as away: out of the bar (awayN),
//     and any vote the same leaf carries is dropped;
//   - abstaining on one target drops that leaf's yes/no on it and counts it
//     in the target's `ab`, which the page takes out of that target's bar;
//   - an author's echo still reproduces its report exactly (G4): no seat
//     refutes an honest aggregator because a report carries `ab`.
// digSane (the wire boundary) keeps `ab` and refuses a malformed one.
//
// Pure Node, no browser. Runs on the gifos mesh harness, which loads this
// checkout's js/mesh.js (GIFOS_REPO, default ../gifos beside gifos-app).
//   node test/unit/vote-abstain-fold.js
// MESH_JS=<path to another mesh.js> runs the same legs against that file (the
// before-fix negative control).
'use strict';
const path = require('path');
const GIFOS = process.env.GIFOS_REPO || path.join(__dirname, '..', '..', '..', 'gifos');
if (process.env.MESH_JS) {
  require(path.join(__dirname, '..', '..', 'js', 'gifos-net.js'));
  require(path.resolve(process.env.MESH_JS));
  const own = require.resolve(path.join(__dirname, '..', '..', 'js', 'mesh.js'));
  require.cache[own] = { id: own, filename: own, loaded: true, exports: {} };
}
const _log = console.log; console.log = () => {};
const H = require(path.join(GIFOS, 'test', 'mesh', 'mesh-harness.js'));
console.log = _log;
const C = H.net.SCALE.C;

let fails = 0;
const check = (n, c, d) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); if (!c) fails++; };
const run = (env, n) => { for (let t = 0; t < n; t++) H.doTick(env); };
const live = (env) => [...env.seats.values()].filter((s) => s.alive && s.state === 3);

const N = C * C + 15; // past one section: the page reads the fold
H.seedRng(20261018);
const env = H.makeFabric();
env.DIGEST = true;
H.spawn(env, N);
H.runJoin(env, N, 20000);
run(env, 1200);
const seats = live(env).sort((a, b) => (a.id < b.id ? -1 : 1));
check('the room is seated past one section', seats.length === N && N > C * C, { seated: seats.length, N });

// Phone is 'devP' (voted up), Sam is 'devS' (voted down).
const facts = [
  { vab: ['*'], vup: ['devP'] },          // the Meeting Bot's page: abstains on everything
  { vup: ['devP'] }, { vup: ['devP'] }, { vup: ['devP'] },
  { vup: ['devP'], vab: ['devP'] },       // abstains on Phone: its yes must not count
  { vab: ['devP'] },
  { vdn: ['devS'] }, { vdn: ['devS'], vab: ['devS'] }, { vab: ['devS'] },
  { away: true, vup: ['devP'] },
];
facts.forEach((f, i) => seats[i].setLeaf(Object.assign({ nm: 'p' + i }, f)));
run(env, 800);

let obs = 0, exact = 0; const seen = [];
for (const s of live(env)) {
  const R = s.rootDig; if (!R || R.at < 0) continue; obs++;
  const P = R.votes.find((v) => v.tgt === 'devP') || {}, S = R.votes.find((v) => v.tgt === 'devS') || {};
  const got = { awayN: R.awayN, P: [P.up, P.dn, P.ab], S: [S.up, S.dn, S.ab] };
  if (got.awayN === 2 && got.P.join() === '3,0,2' && got.S.join() === '0,1,2') exact++;
  else if (seen.length < 3) seen.push(got);
}
check('every observer folds abstain-all as away and per-target abstains as ab, dropping the abstainers\' own votes (awayN 2; Phone 3 up / 2 ab; Sam 1 down / 2 ab)',
  obs === N && exact === obs, { obs, exact, sample: seen });

const mism = live(env).reduce((a, s) => a + s.digMismatch, 0);
check('no author refutes its aggregator over a report carrying ab (G4 echo fidelity)', mism === 0, { refutations: mism });

// The page's bar for a target, from the fold (run.html stageNeed).
const R0 = seats[20].rootDig, roomN = R0.n - R0.awayN, P0 = R0.votes.find((v) => v.tgt === 'devP') || { ab: 0 };
const need = (n) => Math.max(2, Math.floor(n / 2) + 1);
check('Phone\'s folded bar leaves out the abstainers (room ' + N + ', 2 sitting out, 2 abstaining on Phone)',
  roomN === N - 2 && need(roomN - (P0.ab || 0)) === need(N - 4), { roomN, ab: P0.ab, bar: need(roomN - (P0.ab || 0)) });

// Withdrawing every abstain folds back to the plain tally.
facts.forEach((f, i) => seats[i].setLeaf({ vab: [] }));
run(env, 800);
const R1 = seats[20].rootDig, P1 = R1.votes.find((v) => v.tgt === 'devP') || {};
check('withdrawn abstains fold away (awayN 1; Phone 5 up, no ab key)', R1.awayN === 1 && P1.up === 5 && !('ab' in P1), { awayN: R1.awayN, P: P1 });

const ds = H.mesh.digSane;
const base = { n: 3, refuse: 0, at: 1 };
check('digSane keeps a per-target ab', (ds(Object.assign({ votes: [{ tgt: 'd', up: 1, dn: 0, ab: 2 }] }, base)) || { votes: [] }).votes[0].ab === 2);
check('digSane refuses a negative or non-integer ab',
  ds(Object.assign({ votes: [{ tgt: 'd', up: 1, dn: 0, ab: -1 }] }, base)) === null && ds(Object.assign({ votes: [{ tgt: 'd', up: 1, dn: 0, ab: 'x' }] }, base)) === null);
check('digSane keeps a vote without ab exactly as before (no ab key)', !('ab' in ds(Object.assign({ votes: [{ tgt: 'd', up: 1, dn: 0 }] }, base)).votes[0]));

console.log(fails ? 'FAILURES: ' + fails : 'ALL PASS');
process.exit(fails ? 1 : 0);
