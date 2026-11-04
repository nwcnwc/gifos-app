#!/usr/bin/env node
'use strict';
/*
 * port-diff.js: L3 whole-room proof (port plan 3.4). Each stream runs through the sim and through main.js with
 * MESH_NOTIME=1 MESH_THREADS=1 MESH_PROOF=<dir> --trace; stdout, the trace, frames.jsonl and hash.jsonl must be
 * byte-equal. Harness code, never shipped.
 *
 *   node port-diff.js <list> <mesh binary> --out <dir> [-j N] [--max-sec S] [--js-sec S] [--keep K] [--state]
 *
 * <list>: stream files, one per line, or JSON lines with an `f` field (and `n`, `h`, and `c`: the room's C, given to
 * the JS as GIFOS_C; the binary must then be a -DGIFOS_C=<c> build). Results go to
 * <dir>/results.jsonl (one line per case: PASS, DIFF with the first differing file and line, JSCRASH, CXXSLOW,
 * JSSLOW, SKIP when the JS skipped a verb as not wired). Every case's run dir is deleted once compared, except the
 * first K non-PASS ones (--keep, default 0: rerun a case alone to look at it). Stops below 3 GB free.
 * --state adds MESH_PROOF_STATE=1 (state.jsonl, the JSON each hash hashed) to both sides.
 */
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');

const FILES = ['stdout', 'trace', 'frames.jsonl', 'hash.jsonl'];
// The only stdout text not compared (process memory, not sim state): the `rss` verb's hwm_kb= and rss_kb= values.
const MASKS = [[/^(RSS tick=\d+ N=\d+ alive=\d+) hwm_kb=-?\d+ rss_kb=-?\d+$/gm, '$1 hwm_kb=* rss_kb=*']];
const mask = (buf) => { let s = buf.toString('latin1'); for (const [re, to] of MASKS) s = s.replace(re, to); return Buffer.from(s, 'latin1'); };

function parseArgs(argv) {
  const o = { j: Math.max(1, os.cpus().length - 2), maxSec: 60, jsSec: 1800, keep: 0, state: false };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i]; else if (a === '-j') o.j = +argv[++i]; else if (a === '--max-sec') o.maxSec = +argv[++i];
    else if (a === '--js-sec') o.jsSec = +argv[++i]; else if (a === '--keep') o.keep = +argv[++i]; else if (a === '--state') o.state = true;
    else pos.push(a);
  }
  [o.list, o.bin] = pos; if (o.bin) o.bin = path.resolve(o.bin);
  return o;
}

function readList(f) {
  return fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).map((l) => (l.trim().startsWith('{') ? JSON.parse(l) : { f: l.trim() }));
}

function run(cmd, args, input, env, secs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const p = cp.spawn(cmd, args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [], err = []; let errLen = 0, timedOut = false;
    p.stdout.on('data', (b) => out.push(b));
    p.stderr.on('data', (b) => { if (errLen < 65536) { err.push(b); errLen += b.length; } });
    const tm = setTimeout(() => { timedOut = true; p.kill('SIGKILL'); }, secs * 1000);
    p.on('close', (code, sig) => { clearTimeout(tm); resolve({ code, sig, timedOut, ms: Date.now() - t0, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString('latin1') }); });
    p.stdin.on('error', () => {});
    p.stdin.end(input);
  });
}

// first differing line of two files: {line, c, j} or null when equal (cmp finds the byte; the lines are read around it)
function firstDiff(a, b) {
  const ea = fs.existsSync(a), eb = fs.existsSync(b);
  if (!ea && !eb) return null;
  if (ea !== eb) return { line: 0, c: ea ? 'present' : 'missing', j: eb ? 'present' : 'missing' };
  const r = cp.spawnSync('cmp', [a, b], { encoding: 'latin1' });
  if (r.status === 0) return null;
  const m = /byte (\d+), line (\d+)/.exec(r.stdout);
  if (!m) { const eof = /EOF on (\S+)/.exec(r.stderr + r.stdout); return { line: -1, c: 'EOF ' + (eof ? path.basename(eof[1]) : '?'), j: (r.stderr + r.stdout).slice(0, 200) }; }
  const line = +m[2];
  const get = (f) => { const s = cp.spawnSync('sed', ['-n', line + 'p;' + line + 'q', f], { encoding: 'latin1', maxBuffer: 1 << 26 }); return s.stdout.replace(/\n$/, ''); };
  return { line, c: get(a).slice(0, 800), j: get(b).slice(0, 800) };
}

async function oneCase(c, o, idx) {
  const id = c.h ? c.h.slice(0, 12) : path.basename(path.dirname(c.f));
  const dir = path.join(o.out, 'run', id);
  fs.mkdirSync(path.join(dir, 'c'), { recursive: true }); fs.mkdirSync(path.join(dir, 'j'), { recursive: true });
  const input = fs.readFileSync(c.f);
  const base = Object.assign({}, process.env, { MESH_NOTIME: '1', MESH_THREADS: '1', MESH_PROOF_TAPES: 'none' });
  if (o.state) base.MESH_PROOF_STATE = '1';
  if (c.c) base.GIFOS_C = String(c.c);   // the room's C for the JS side; the sim binary must be the -DGIFOS_C=<c> build
  const cr = await run(o.bin, ['--service', '--trace', path.join(dir, 'c', 'trace')], input, Object.assign({}, base, { MESH_PROOF: path.join(dir, 'c') }), o.maxSec);
  const res = { id, f: c.f, n: c.n, cms: cr.ms };
  if (cr.timedOut) { res.status = 'CXXSLOW'; fs.rmSync(dir, { recursive: true, force: true }); return res; }
  fs.writeFileSync(path.join(dir, 'c', 'stdout'), mask(cr.stdout));
  const jr = await run(process.execPath, [path.join(__dirname, 'main.js'), '--service', '--tolerant', '--trace', path.join(dir, 'j', 'trace')], input, Object.assign({}, base, { MESH_PROOF: path.join(dir, 'j') }), o.jsSec);
  fs.writeFileSync(path.join(dir, 'j', 'stdout'), mask(jr.stdout));
  res.jms = jr.ms;
  const skip = /^@@SKIP ([^:]*): (.*)$/m.exec(jr.stdout.toString('latin1'));
  const firsts = {};
  for (const f of FILES) { const d = firstDiff(path.join(dir, 'c', f), path.join(dir, 'j', f)); if (d) firsts[f] = d; }
  if (jr.timedOut) res.status = 'JSSLOW';
  else if (jr.code !== 0) { res.status = 'JSCRASH'; res.why = jr.stderr.split('\n').filter((l) => l.trim()).slice(0, 4).join(' | ').slice(0, 600); }
  else if (skip) { res.status = 'SKIP'; res.skip = skip[1]; res.why = skip[2].slice(0, 200); }
  else res.status = Object.keys(firsts).length ? 'DIFF' : 'PASS';
  if (Object.keys(firsts).length) res.first = firsts;
  if (res.status === 'PASS' || o.kept >= o.keep) fs.rmSync(dir, { recursive: true, force: true });
  else o.kept++;
  return res;
}

// stop writing below 3 GB free (a shared box)
function lowDisk(dir) { try { const st = fs.statfsSync(dir); return st.bavail * st.bsize < 3 * 2 ** 30; } catch (e) { return false; } }

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.list || !o.bin || !o.out) { console.error('usage: port-diff.js <list> <mesh binary> --out <dir> [-j N] [--max-sec S] [--js-sec S] [--keep K] [--state]'); process.exit(2); }
  fs.mkdirSync(o.out, { recursive: true }); o.kept = 0;
  const cases = readList(o.list);
  const resF = fs.openSync(path.join(o.out, 'results.jsonl'), 'a');
  const count = {}; let next = 0, done = 0;
  const worker = async () => {
    while (next < cases.length) {
      if (lowDisk(o.out)) { if (!o.stopped) { o.stopped = true; process.stderr.write('port-diff: under 3G free on the out disk: stopped\n'); } return; }
      const i = next++;
      let r;
      try { r = await oneCase(cases[i], o, i); } catch (e) { r = { f: cases[i].f, status: 'ERROR', why: String(e && e.stack || e).slice(0, 400) }; }
      fs.writeSync(resF, JSON.stringify(r) + '\n');
      count[r.status] = (count[r.status] || 0) + 1; done++;
      if (done % 20 === 0 || done === cases.length) process.stderr.write(`[${done}/${cases.length}] ` + JSON.stringify(count) + '\n');
    }
  };
  await Promise.all(Array.from({ length: o.j }, worker));
  fs.closeSync(resF);
  console.log('port-diff: ' + cases.length + ' cases ' + JSON.stringify(count));
}

if (require.main === module) main();
