#!/usr/bin/env node
// l0-check.js <driver output .jsonl>
// L0 proof: for every case the sim's driver printed, recompute the answer with js/mesh/* from the inputs alone
// and compare. Integers and structs compare as JSON text; the random streams' floats compare as numbers
// (the driver prints %.17g, which reads back to the same double). Prints per-kind counts; exit 1 on any diff.
'use strict';
const fs = require('fs'), path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const hash = require(path.join(M, 'hash.js'));
const topo = require(path.join(M, 'topo.js'));
const roles = require(path.join(M, 'roles.js'));
const rng = require(path.join(M, 'rng.js'));
const dig = require(path.join(M, 'dig.js'));

const file = process.argv[2];
if (!file) { console.error('usage: l0-check.js <driver output>'); process.exit(2); }
const J = JSON.stringify;
const counts = {}, fails = {};
let shown = 0;

function check(kind, name, want, got, eq) {
  const ok = eq ? eq(want, got) : J(want) === J(got);
  counts[kind] = counts[kind] || { cases: 0, checks: 0 };
  counts[kind].checks++;
  if (!ok) { fails[kind] = (fails[kind] || 0) + 1; if (shown++ < 10) console.log('DIFF ' + kind + '.' + name + '\n  sim ' + J(want) + '\n  js  ' + J(got)); }
}
const numsEq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

const cases = {
  hash(c) {
    const o = c.out;
    check('hash', 'fmix32', o.fmix32, hash.fmix32(c.x));
    check('hash', 'hmix', o.hmix, hash.hmix(c.h, c.x));
    check('hash', 'hmix64', o.hmix64, hash.hmix64(c.h, c.w));
    check('hash', 'idPair', o.idPair, hash.idPair(c.a, c.b));
  },
  topo(c) {
    const o = c.out, s = c.s;
    check('topo', 'ckey', o.ckey, topo.ckey(s));
    check('topo', 'unckey', s, topo.unckey(topo.ckey(s)));
    check('topo', 'childPath', o.childPath, topo.childPath(s.pc, c.d));
    check('topo', 'parentPath', o.parentPath, topo.parentPath(s.pc));
    check('topo', 'pcDepth', o.pcDepth, topo.pcDepth(s.pc));
    check('topo', 'lastDigit', o.lastDigit, topo.lastDigit(s.pc));
    check('topo', 'up', o.up, topo.up(s));
    check('topo', 'down', o.down, topo.down(s));
    check('topo', 'crossLink', o.crossLink, topo.crossLink(s));
    check('topo', 'rowMates', o.rowMates, topo.rowMates(s));
    check('topo', 'colMates', o.colMates, topo.colMates(s));
    check('topo', 'ownedLinks', o.ownedLinks, topo.ownedLinks(s));
  },
  roles(c) {
    const o = c.out;
    const occ = (x) => hash.fmix32((topo.ckey(x) >>> 0) ^ c.salt) % 100 < c.dens;
    check('roles', 'ownerOf', o.ownerOf, roles.ownerOf(c.row));
    check('roles', 'heirOf', o.heirOf, roles.heirOf(c.row, occ));
    check('roles', 'backupOwnerOf', o.backupOwnerOf, roles.backupOwnerOf(c.row, occ));
    check('roles', 'standbyOf', o.standbyOf, roles.standbyOf(c.row, occ));
    check('roles', 'e2SrcOf', o.e2SrcOf, roles.e2SrcOf(c.row, occ));
    check('roles', 'ownedLinksE0', o.ownedLinksE0, roles.ownedLinksE(c.s, false));
    check('roles', 'ownedLinksE1', o.ownedLinksE1, roles.ownedLinksE(c.s, true));
  },
  rng(c) {
    const o = c.out;
    check('rng', 'seed', o.seed, rng.seedFor(c.id));
    const s = rng.create(rng.seedFor(c.id)); const seat = []; for (let j = 0; j < c.n; j++) seat.push(s.next());
    check('rng', 'seat', o.seat, seat, numsEq);
    const g = rng.lcg(c.g0); const lcg = []; for (let j = 0; j < c.n; j++) lcg.push(g.next());
    check('rng', 'lcg', o.lcg, lcg, numsEq);
    const m = rng.mt19937(c.m0); const mt = []; for (let j = 0; j < o.mt.length; j++) mt.push(m.next());
    check('rng', 'mt19937', o.mt, mt, numsEq);
  },
  dig(c) {
    const o = c.out;
    const dst = dig.cloneDig(c.dst), inn = c.in.map(dig.cloneDig);
    c.held.forEach((h, j) => { if (h) dig.digFoldHeld(dst, inn[j]); else dig.digFold(dst, inn[j]); });
    check('dig', 'inputsUntouched', c.in, inn);
    check('dig', 'fold', o.fold, dst);
    dig.digTrim(dst);
    check('dig', 'trim', o.trim, dst);
    check('dig', 'listHash', o.listHash, dig.digListHash(dst));
    check('dig', 'sig', o.sig, dig.digSig(dst));
    check('dig', 'holdsH', o.holdsH, dig.listHolds(dst.hands, inn[0].hands, dig.K_HAND, true));
    check('dig', 'holdsA', o.holdsA, dig.listHolds(dst.apps, inn[0].apps, dig.K_APP, false));
    check('dig', 'votesHold', o.votesHold, dig.votesHold(dst.votes, inn[0].votes));
    const t = inn[0].talk.map(dig.cloneLE); dig.talkMerge(t, dst.talk);
    check('dig', 'talkMerge', o.talkMerge, t);
    const va = inn[0].votes.map(dig.cloneVE); dig.voteAdd(va, dst.votes);
    check('dig', 'voteAdd', o.voteAdd, va);
  },
};

for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
  if (!l) continue;
  const c = JSON.parse(l);
  if (!cases[c.k]) throw new Error('l0-check: unknown kind ' + c.k);
  cases[c.k](c);
  counts[c.k] = counts[c.k] || { cases: 0, checks: 0 };
  counts[c.k].cases++;
}
let bad = 0;
for (const [k, v] of Object.entries(counts)) { const f = fails[k] || 0; bad += f; console.log((f ? 'FAIL ' : 'PASS ') + k + ': ' + v.cases + ' cases, ' + v.checks + ' checks, ' + f + ' diffs'); }
console.log(bad ? 'L0 FAIL (' + bad + ' diffs)' : 'L0 PASS');
process.exit(bad ? 1 : 0);
