#!/usr/bin/env node
'use strict';
// state-diff.js <c/state.jsonl> <j/state.jsonl> [max]: the first state lines that differ, field by field (MESH_PROOF_STATE runs).
const fs = require('fs'), rl = require('readline');
(async () => {
  const [a, b, mx] = process.argv.slice(2); let left = +(mx || 1);
  const ia = rl.createInterface({ input: fs.createReadStream(a) })[Symbol.asyncIterator](), ib = rl.createInterface({ input: fs.createReadStream(b) })[Symbol.asyncIterator]();
  for (let n = 1; ; n++) {
    const x = await ia.next(), y = await ib.next();
    if (x.done && y.done) { console.log('state: equal, ' + (n - 1) + ' lines'); return; }
    if (x.done || y.done) { console.log('state: line ' + n + ': ' + (x.done ? 'C++ ends' : 'JS ends')); return; }
    if (x.value === y.value) continue;
    const p = JSON.parse(x.value), q = JSON.parse(y.value);
    const head = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).filter(([k, v]) => typeof v !== 'object' || v === null)));
    console.log('state: line ' + n + ' C++ ' + head(p) + ' JS ' + head(q));
    const ps = p.s || p, qs = q.s || q;
    for (const k of new Set([...Object.keys(ps), ...Object.keys(qs)])) {
      const u = JSON.stringify(ps[k]), v = JSON.stringify(qs[k]);
      if (u !== v) console.log('  ' + k + '\n    C++ ' + String(u).slice(0, 400) + '\n    JS  ' + String(v).slice(0, 400));
    }
    if (--left <= 0) return;
  }
})();
