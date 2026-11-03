#!/usr/bin/env node
// digroute-check.js <driver output .jsonl>
// L0 proof for digest.js / route.js: recompute every case digroute-driver printed with js/mesh/* and compare.
'use strict';
const fs = require('fs'), path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const { Seat } = require(path.join(M, 'seat.js'));
const digest = require(path.join(M, 'digest.js'));
const route = require(path.join(M, 'route.js'));
const dig = require(path.join(M, 'dig.js'));

const J = JSON.stringify;
const counts = {}, fails = {};
let shown = 0;
function check(kind, name, want, got) {
  counts[kind] = (counts[kind] || 0) + 1;
  if (J(want) !== J(got)) { fails[kind] = (fails[kind] || 0) + 1; if (shown++ < 10) console.log('DIFF ' + kind + '.' + name + '\n  sim ' + J(want) + '\n  js  ' + J(got)); }
}
const cases = {
  l12(c) { check('l12', 'cand', c.out.cand, digest.l12Cand(c.r0, c.col, c.n)); check('l12', 'origin', c.out.origin, digest.l12Origin(c.seeker)); },
  l12s(c) { check('l12s', 'score', c.out, digest.l12Score(c.r, c.c, c.r0, c.col)); },
  kmisc(c) {
    const o = c.out;
    check('kmisc', 'kHash', o.kHash, route.kHash(c.a, c.b, c.c));
    check('kmisc', 'same', o.same, route.kSameVote(c.x, c.y));
    check('kmisc', 'has', o.has, route.kHasVote(c.x));
    check('kmisc', 'taker', o.taker, route.kTakerOf(c.ck));
    check('kmisc', 'cellOk', o.cellOk, route.cellOk(c.ck));
    check('kmisc', 'coordStr', o.coordStr, route.coordStr(require(path.join(M, 'topo.js')).unckey(c.ck)));
  },
  kscope(c) { check('kscope', 'inScope', c.out, route.kInScope(c.v, c.c, c.rowScope)); },
  kover(c) { const on = []; route.kOver(c.R, c.now, c.self, on); check('kover', 'on', c.out, on); },
  nhc(c) { const s = new Seat(0); s.coord = c.c; s.hasCoord = true; check('nhc', 'nextHopCoord', c.out, s.nextHopCoord(c.t)); },
};
for (const l of fs.readFileSync(process.argv[2], 'utf8').split('\n')) {
  if (!l) continue;
  const c = JSON.parse(l); cases[c.k](c);
}
let bad = 0;
for (const k of Object.keys(counts)) { console.log(k + ': ' + counts[k] + ' checks, ' + (fails[k] || 0) + ' diffs'); bad += fails[k] || 0; }
console.log(bad ? 'digroute L0 FAIL (' + bad + ')' : 'digroute L0 PASS');
process.exit(bad ? 1 : 0);
