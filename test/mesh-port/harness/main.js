#!/usr/bin/env node
'use strict';
/*
 * main.js: the JS twin of the sim's `main` (port plan H3): the same command line, the same stdin stream, the same
 * stdout and MESH_PROOF files. Harness code, never shipped.
 *
 *   node main.js --service [--threads=W] [--det] [--allow-teleport] [--trace out.jsonl]   reads ops on stdin
 *   node main.js --script f.json [--seed s] [--trace out.jsonl]
 *   node main.js N [leaveFrac]                                                           batch: JOIN N, report
 *
 * Environment (as the sim): MESH_NOTIME (no wall-clock numbers), MESH_THREADS (read, ignored: the JS tick is
 * serial), MESH_SKEW, MESH_CLKOFF, MESH_PROOF=<dir> (frames.jsonl, hash.jsonl, summary.json), MESH_PROOF_STATE.
 * MESH_PROOF_TAPES (the per-seat tapes) is not ported. Stderr diagnostics keep their C++ names.
 *
 * `--tolerant`: a verb that needs a unit nobody plugged ("not wired") or that is not ported prints no line and the
 * run goes on; each such verb prints `@@SKIP <verb>: <why>` on stdout instead of its lines. The corpus diff uses it.
 * Not a flag of the sim.
 */
const fs = require('fs'), path = require('path');
const { createFabric } = require('./fabric.js');
const { createOps } = require('./runop.js');
const { installPcLaws } = require('./pclaws-fab.js');
const { installFhop, installFhopLever } = require('./fhop.js');
const { installMedia } = require('./media.js');
const { runScript } = require('./script.js');
const msg = require(path.join(__dirname, '..', '..', '..', 'js', 'mesh', 'msg.js'));
const topo = require(path.join(__dirname, '..', '..', '..', 'js', 'mesh', 'topo.js'));

const atoi = (s) => (parseInt(s, 10) | 0) || 0;

// stdout: buffered, written with fs.writeSync (a pipe closed early ends the run quietly)
function makeOut() {
  let buf = [], n = 0;
  const flush = () => { if (!buf.length) return; const s = buf.join(''); buf = []; n = 0; let b = Buffer.from(s, 'utf8'), off = 0; while (off < b.length) { try { off += fs.writeSync(1, b, off); } catch (e) { if (e.code === 'EAGAIN') continue; if (e.code === 'EPIPE') return; throw e; } } };
  const out = (s) => { buf.push(s); n += s.length; if (n > 65536) flush(); };
  return { out, flush };
}

// C++: mesh.cpp:main
async function main(argv, env) {
  const opts_noUnits = env.MESH_PORT_NOUNITS !== undefined;   // test switch: the fabric alone (the units of the merged tree not loaded)
  let service = false, wthreads = 0, scriptPath = null, tracePath = null, haveSeed = false, scriptSeed = 0, tolerant = false, allowTeleport = false;
  const levers = {};
  if (env.MESH_SKEW !== undefined) levers.NET_SKEW = Math.max(0, atoi(env.MESH_SKEW));
  if (env.MESH_CLKOFF !== undefined) levers.CLK_OFF = Math.max(0, parseInt(env.MESH_CLKOFF, 10) || 0);   // a random clock offset per seat for a WHOLE suite (same as `net clkoff=` before init)
  for (let a = 0; a < argv.length; a++) {
    const s = argv[a];
    if (s === '--service') service = true;
    else if (s.startsWith('--threads=')) wthreads = Math.max(1, atoi(s.slice(10)));
    else if (s === '--det') { /* accepted: the threaded tick is always deterministic */ }
    else if (s === '--allow-teleport') allowTeleport = true;   // A/B only: revert to the old perfect-bus (teleports counted, not fatal)
    else if (s === '--tolerant') tolerant = true;
    else if (s === '--script' && a + 1 < argv.length) scriptPath = argv[++a];
    else if (s === '--seed' && a + 1 < argv.length) { haveSeed = true; scriptSeed = (parseInt(argv[++a], 10) >>> 0); }
    else if (s === '--trace' && a + 1 < argv.length) tracePath = argv[++a];
  }
  let T = wthreads; if (T <= 0) { if (env.MESH_THREADS !== undefined) T = Math.max(1, atoi(env.MESH_THREADS)); else T = 1; }
  levers.NOTIME = env.MESH_NOTIME !== undefined; levers.NTHREADS = Math.max(1, T);
  if (allowTeleport) levers.ROUTE_ENFORCE = false;
  const o = makeOut();
  const err = (s) => process.stderr.write(s);
  if (tracePath) { try { fs.closeSync(fs.openSync(tracePath, 'w')); } catch (e) { err('ERR cannot write trace ' + tracePath + '\n'); return 2; } }
  const fab = createFabric({ levers, proofDir: env.MESH_PROOF || null, proofState: !!env.MESH_PROOF_STATE, traceFile: tracePath });
  // the whole port: every seat unit, the link / time / net physics, the pc laws and friend-hop (the merged tree)
  if (!opts_noUnits) {
    const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
    require(path.join(M, 'seat.js'));
    for (const f of fs.readdirSync(M).sort()) if (f.endsWith('.js') && f !== 'seat.js') require(path.join(M, f));
    fab.pcl = installPcLaws(fab); installFhop(fab); require('./dialsig.js').install(fab); installMedia(fab);
  }
  const ops = createOps(fab, { out: o.out });
  if (!opts_noUnits) {   // the measurement units and their levers (l18, instant join, realcheck, the friend-hop lever)
    require('./l18.js').install(fab); require('./ij.js').install(fab); require('./realcheck.js').install(fab); installFhopLever(fab, ops.runOp);
    const shared = require(path.join(__dirname, '..', '..', '..', 'js', 'mesh', 'shared.js'));
    fab.plug({ fabricToken: (id) => shared.fabricToken(fab.lv, id) });   // C++: mesh.cpp:fabricToken
  }
  let rc = 0;
  const lv = fab.lv;
  try {
    if (scriptPath) rc = runScript(fab, ops, scriptPath, haveSeed, scriptSeed, err, o.out);
    else if (!service) {
      const n = argv.length > 0 && /^-?\d/.test(argv[0]) ? atoi(argv[0]) : 10000; const lvl = argv.length > 1 ? (parseFloat(argv[1]) || 0) : 0;
      fab.initSim(n, lvl); const t0 = process.hrtime.bigint(); const conv = fab.converge(lv.MAXP); let secs = Number(process.hrtime.bigint() - t0) / 1e9;
      let { seated, s1c } = fab.counts();
      fab.printf('  after JOIN: %s [seated=%lld/%d, s1=%lld, converged@%lld, %lld ticks, %.2fs, %.0fk ticks/s]\n', (seated === n && s1c === Math.min(topo.C * topo.C, n)) ? 'OK' : 'INCOMPLETE', seated, n, s1c, conv, fab.w.TICK, lv.NOTIME ? 0.0 : secs, lv.NOTIME ? 0.0 : fab.w.TICK / secs / 1000.0);
      if (lvl > 0) {   // REAL churn: kill lv-fraction, then heal
        const killed = fab.killFraction(lvl, ''); const h0 = process.hrtime.bigint(); const hconv = fab.converge(lv.MAXP); const hsecs = Number(process.hrtime.bigint() - h0) / 1e9;
        ({ seated, s1c } = fab.counts());
        fab.printf('  after HEAL: %s [killed=%lld, seated=%lld/%d, s1=%lld, healed@%lld, %.2fs]\n', (seated === lv.N && s1c === Math.min(topo.C * topo.C, lv.N) && lv.DUPS_G === 0) ? 'OK' : 'INCOMPLETE', killed, seated, lv.N, s1c, hconv, lv.NOTIME ? 0.0 : hsecs);
      }
      const tot = lv.EMIT_NEIGHBOR + lv.EMIT_TELEPORT + lv.EMIT_BOOTSTRAP + lv.EMIT_RELAY;
      fab.printf('  EMIT TRANSPORT: neighbor=%lld (%.1f%%)  relay(socketed pair)=%lld (%.1f%%)  TELEPORT(faked)=%lld (%.1f%%)  bootstrap=%lld (%.1f%%)  [total=%lld]\n',
        lv.EMIT_NEIGHBOR, tot ? 100.0 * lv.EMIT_NEIGHBOR / tot : 0, lv.EMIT_RELAY, tot ? 100.0 * lv.EMIT_RELAY / tot : 0, lv.EMIT_TELEPORT, tot ? 100.0 * lv.EMIT_TELEPORT / tot : 0, lv.EMIT_BOOTSTRAP, tot ? 100.0 * lv.EMIT_BOOTSTRAP / tot : 0, tot);
      { fab.printf('  TELEPORTS BY TYPE:'); for (let i = 0; i < 23; i++) if (fab.TELE_BY_T[i]) fab.printf(' %s=%lld', msg.MT_NAMES[i], fab.TELE_BY_T[i]); fab.printf('\n'); }
      fab.printf('  TELEPORT SOURCE: plain=%lld direct(handoff)=%lld routing=%lld direct+routing=%lld\n', fab.TELE_SRC[0], fab.TELE_SRC[1], fab.TELE_SRC[2], fab.TELE_SRC[3]);
    } else {
      // ---- SERVICE: read commands on stdin, answer on stdout ----
      fab.printf('READY gifos-mesh-sim service\n');
      const rd = require('readline').createInterface({ input: process.stdin, crlfDelay: Infinity });
      // getline: a whole line of any length is one command
      const pieces = function* (line) { yield line; };
      let stop = false;
      for await (const raw of rd) {
        for (let cmd of pieces(raw)) {
          while (cmd.endsWith('\n') || cmd.endsWith('\r')) cmd = cmd.slice(0, -1);
          const tk = cmd.split(' ').filter((x) => x.length);   // tokenize on ' ' only
          if (!tk.length) continue;
          let cont;
          try { cont = ops.runOp(tk); } catch (e) {
            if (tolerant && (e.notPorted || /is not wired/.test(e.message))) { fab.printf('@@SKIP %s: %s\n', tk[0], e.message); continue; }
            throw e;
          }
          if (!cont) { stop = true; break; }
        }
        if (stop) break;
      }
      rd.close();
    }
  } finally { o.flush(); fab.close(); }
  return rc;
}

if (require.main === module) main(process.argv.slice(2), process.env).then((rc) => { process.exitCode = rc; }, (e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exitCode = 1; });
module.exports = { main };
