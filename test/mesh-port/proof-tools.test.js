'use strict';
// Checks for the message module, the random stream, the proof readers and the trace diff.
//
//   node test/mesh-port/proof-tools.test.js <proof dir> [message spec json]
//
// <proof dir> is a recorded room run; a run that kept its states and a few seat tapes
// exercises everything. The spec is needed only for the "module is current" check
// (or set MSG_SPEC).
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
const M = require('../../js/mesh/msg.js');
const rng = require('../../js/mesh/rng.js');
const fnv = require('../../js/mesh/fnv.js');
const io = require('./proof-io.js');
const td = require('./trace-diff.js');

const dir = process.argv[2];
const specPath = process.argv[3] || process.env.MSG_SPEC;
if (!dir) { console.error('usage: proof-tools.test.js <proof dir> [spec.json]'); process.exit(2); }
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' : ' + detail : '')); }
}

// ---- fnv
check('fnv: empty string is the offset basis', fnv.str('') === 2166136261);
check('fnv: "a" = 0xe40c292c', fnv.str('a') === 0xe40c292c);
check('fnv: UTF-8 bytes', fnv.str('é') === fnv.bytes(Buffer.from([0xc3, 0xa9])));

// ---- message module
if (specPath) {
  const g = spawnSync(process.execPath, [path.join(__dirname, 'gen-msg.js'), specPath, '--check'], { encoding: 'utf8' });
  check('msg.js is current with the spec', g.status === 0, (g.stderr || '').trim());
}
{
  let n = 0, bad = null;
  const seen = (m, where) => {
    n++;
    if (bad) return;
    const line = JSON.stringify(m), back = M.encode(M.readMsg(m));
    if (back !== line) bad = where + '\n  in  ' + line.slice(0, 200) + '\n  out ' + back.slice(0, 200);
    const c = M.clone(M.readMsg(m));
    if (M.encode(c) !== line) bad = where + ' (clone)';
  };
  for (const f of io.frames(dir)) seen(f.m, 'frames:' + f.n);
  for (const id of io.tapeIds(dir)) for (const e of io.tape(dir, id)) {
    if (e.m) seen(e.m, 'tape ' + id + ':' + e.n);
    if (e.a) for (const x of e.a) if (x && typeof x === 'object' && !Array.isArray(x) && 't' in x) seen(x, 'tape ' + id + ':' + e.n + ' arg');
  }
  check('msg: read then write gives the same bytes for ' + n + ' messages', !bad && n > 0, bad);
}
{
  const m = M.newMsg('HOME');
  check('msg: a new message writes as its type only', M.encode(m) === '{"t":"HOME"}');
  const a = M.newMsg('FIND'), b = M.newMsg('FIND');
  a.list.push(1); a.dgUp.n = 3; a.coord.pc = 5;
  check('msg: defaults are not shared between messages', b.list.length === 0 && b.dgUp.n === 0 && b.coord.pc === 0);
  check('msg: sparse write keeps field order', M.encode(a) === '{"t":"FIND","coord":{"pc":5,"r":0,"i":0},"list":[1],"dgUp":{"n":3}}', M.encode(a));
  let threw = false; try { M.readMsg({ t: 'NOPE' }); } catch (e) { threw = true; }
  check('msg: unknown type name is rejected', threw);
  threw = false; try { M.readMsg({ t: 'HOME', nosuch: 1 }); } catch (e) { threw = true; }
  check('msg: unknown field is rejected', threw);
  check('msg: a default written out is read back as the default', M.encode(M.readMsg({ t: 'HOME', to: -1, list: [] })) === '{"t":"HOME"}');
}

// ---- proof readers
{
  const hs = io.summary(dir);
  let nf = 0, ns = 0, nh = 0;
  for (const f of io.frames(dir, { strict: true })) nf++;
  for (const f of io.hashes(dir, { strict: true })) nh++;
  const hash = new Map();
  for (const h of io.hashes(dir)) if (h.h !== null) hash.set(h.t + '/' + h.id, h.h);
  let wrong = 0, total = 0;
  for (const s of io.states(dir, { strict: true })) { total++; ns++; if (hash.get(s.t + '/' + s.id) !== io.stateHash(s.s)) wrong++; }
  check('readers: frame lines in strict form (' + nf + ')', nf > 0);
  check('readers: frames match the summary counts', !hs || nf === hs.sends + hs.recvs, hs && (nf + ' vs ' + (hs.sends + hs.recvs)));
  check('readers: hash entries read (' + nh + ')', nh > 0);
  if (total) check('state hash recomputed for ' + total + ' states', wrong === 0, wrong + ' differ');
  else console.log('SKIP state hash (no state.jsonl in the run)');
  const ids = io.tapeIds(dir);
  if (ids.length) {
    let tl = 0; for (const id of ids) for (const e of io.tape(dir, id, { strict: true })) tl++;
    check('readers: tapes of seats ' + ids.join(',') + ' read (' + tl + ' lines)', !hs || tl === hs.tapeLines, hs && (tl + ' vs ' + hs.tapeLines));
  } else console.log('SKIP tapes (none in the run)');
}

// ---- random stream
{
  const ref = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'rng-ref.json'), 'utf8'));
  let ok = true, why = '';
  for (const [id, r] of Object.entries(ref)) {
    const seed = rng.seedFor(parseInt(id, 10));
    if (seed !== r.seed) { ok = false; why = 'seed of ' + id + ': ' + seed + ' vs ' + r.seed; break; }
    const g = rng.create(seed);
    for (let k = 0; k < r.draws.length; k++) { const v = g.next(); if (v !== r.draws[k]) { ok = false; why = 'seat ' + id + ' draw ' + k + ': ' + v + ' vs ' + r.draws[k]; break; } }
    if (!ok) break;
  }
  check('rng: seeds and 300 draws for 6 ids match the reference values bit for bit', ok, why);
  // the stream position recorded in the states: state = seed + k * STEP, so k stays small and never goes back
  const inv = Number(BigInt.asUintN(32, (() => { let x = BigInt(rng.STEP); let y = x; for (let i = 0; i < 5; i++) y = (y * (2n - x * y)) & 0xffffffffn; return y; })()));
  const last = new Map(); let n = 0, bad = '';
  for (const s of io.states(dir)) {
    const k = Math.imul((s.s.rs - rng.seedFor(s.id)) >>> 0, inv) >>> 0; n++;
    if (k > 1e6 || k < (last.get(s.id) || 0)) { bad = 'seat ' + s.id + ' tick ' + s.t + ' draws=' + k; break; }
    last.set(s.id, k);
  }
  if (n) check('rng: ' + n + ' recorded seat states are seed + k draws, k never goes back', !bad, bad);
  else console.log('SKIP rng position check (no state.jsonl)');
  const a = rng.create(rng.seedFor(9)), b = rng.create(rng.seedFor(9));
  const x = [1, 2, 3, 4, 5, 6, 7], y = [1, 2, 3, 4, 5, 6, 7];
  a.shuffle(x); for (let k = y.length - 1; k > 0; k--) { const j = Math.floor(b.next() * (k + 1)); [y[k], y[j]] = [y[j], y[k]]; }
  check('rng: shuffle draws once per swap, from the end', x.join() === y.join() && a.state === b.state);
  check('rng: pick of an empty list makes no draw', (() => { const g = rng.create(5); const s = g.state; return g.pick([]) === null && g.state === s; })());
}

// ---- trace diff
{
  check('diff: a run against itself is identical', td.diffDirs(dir, dir).length === 0);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-diff-'));
  try {
    for (const f of ['frames.jsonl', 'hash.jsonl', 'state.jsonl', 'summary.json']) if (fs.existsSync(path.join(dir, f))) fs.copyFileSync(path.join(dir, f), path.join(tmp, f));
    if (fs.existsSync(path.join(dir, 'tapes'))) fs.cpSync(path.join(dir, 'tapes'), path.join(tmp, 'tapes'), { recursive: true });
    check('diff: a copy is identical', td.diffDirs(dir, tmp).length === 0);

    // 1. change one field of one received message
    const fl = fs.readFileSync(path.join(tmp, 'frames.jsonl'), 'utf8').split('\n');
    let at = -1; for (let i = 100; i < fl.length; i++) { if (fl[i].startsWith('{"e":"recv"') && fl[i].includes('"from":')) { at = i; break; } }
    const o = JSON.parse(fl[at]); const was = o.m.from; o.m.from = was + 1000; fl[at] = JSON.stringify(o);
    // 2. drop the last frame sent by some seat
    fs.writeFileSync(path.join(tmp, 'frames.jsonl'), fl.join('\n'));
    // 3. change one hash
    const hl = fs.readFileSync(path.join(tmp, 'hash.jsonl'), 'utf8').split('\n');
    const ho = JSON.parse(hl[10]); const hseat = ho.h[0][0], hold = ho.h[0][1]; ho.h[0][1] = hold ^ 1; hl[10] = JSON.stringify(ho);
    fs.writeFileSync(path.join(tmp, 'hash.jsonl'), hl.join('\n'));
    // 4. change a tape call answer
    const ids = io.tapeIds(tmp);
    let tapeWant = null;
    if (ids.length) {
      const tf = path.join(tmp, 'tapes', ids[0] + '.jsonl'); const tl = fs.readFileSync(tf, 'utf8').split('\n');
      const ti = tl.findIndex(l => l.includes('"r":')); const to = JSON.parse(tl[ti]); to.r = typeof to.r === 'number' ? to.r + 7 : !to.r; tl[ti] = JSON.stringify(to);
      fs.writeFileSync(tf, tl.join('\n')); tapeWant = { seat: ids[0], idx: ti };
    }
    const rows = td.diffDirs(dir, tmp);
    const frame = rows.find(r => r.stream === 'recv' && r.seat === o.to);
    check('diff: changed message field found, seat ' + o.to + ' recv tick ' + o.t, frame && frame.t === o.t && frame.diff.path === 'm.from' && frame.diff.a === was && frame.diff.b === was + 1000, JSON.stringify(frame));
    const hrow = rows.find(r => r.stream === 'hash' && r.seat === hseat);
    check('diff: changed hash found, seat ' + hseat + ' tick ' + ho.t, hrow && hrow.t === ho.t, JSON.stringify(hrow));
    if (hrow) check('diff: with states kept, the hash row names a state field or the hash', /^(state|h$)|\bh\b/.test(hrow.diff.path) || hrow.diff.path.startsWith('state'), hrow.diff.path);
    if (tapeWant) {
      const trow = rows.find(r => r.stream === 'tape' && r.seat === tapeWant.seat);
      check('diff: changed tape answer found at line ' + tapeWant.idx, trow && trow.index === tapeWant.idx && trow.diff.path === 'r', JSON.stringify(trow));
    }
    // 5. a run that stops early
    const cut = fl.slice(0, 400); fs.writeFileSync(path.join(tmp, 'frames.jsonl'), cut.join('\n') + '\n');
    const rows2 = td.diffDirs(dir, tmp);
    check('diff: a shorter run reports where it ends', rows2.some(r => r.stream === 'send' && /ends here/.test(r.diff.path)));
    const rep = td.report(rows, false, 50);
    check('diff: report prints one line per diverging seat, earliest first', rep.lines.length === rep.seats.length && rep.seats.every((s, i) => i === 0 || s.rs[0].t >= rep.seats[i - 1].rs[0].t));
    const cli = spawnSync(process.execPath, [path.join(__dirname, 'trace-diff.js'), dir, tmp], { encoding: 'utf8' });
    check('diff: command exits 1 and prints a summary line', cli.status === 1 && /DIFFERENT seats=\d+ first: seat \d+ tick \d+/.test(cli.stdout), cli.stdout.slice(-200));
    console.log(cli.stdout.split('\n').slice(0, 6).join('\n'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

console.log((fail ? 'FAILED ' : 'ALL PASS ') + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
