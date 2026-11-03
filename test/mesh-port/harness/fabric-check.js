#!/usr/bin/env node
'use strict';
// fabric-check.js <driver binary> <work dir> [cases] [first seed]
// Differential check of harness/fabric.js against the sim's own fabric. For each seed it makes a random script
// (fabric-gen below), runs it through the C++ driver (l0/fabric-driver.cpp: mesh.cpp included whole) and through
// fabric.js with the real JS seats, and compares, byte for byte:
//   - the driver's counters line after every op (the random streams, SEQ, L10SEQ, bus size, relay list, ...)
//   - frames.jsonl (every push on the bus, with its due tick and SEQ)
//   - hash.jsonl (the per-tick seat state hashes)
//   - the --trace file
// Exit 1 on the first difference.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { createFabric } = require('./fabric.js');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const { Seat } = require(path.join(M, 'seat.js'));
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));

// ---- stand-ins for the island unit (S9) until it lands: with no island lever a seat sees no merge --------------------
// (C++: mesh_ring.inc:islandStandM, mergeCalc). The check never sets the island lever, so these are the sim's answers.
const { FREE } = require(path.join(M, 'seat.js'));
if (!('mergeCalc' in Seat.prototype)) Seat.unit('fabric-check stand-in', { mergeCalc() { return false; } });
// (C++: mesh_linkset.inc:linkRole, the owned-link arm only: the check seats hold no E2, L4, uplink or owner role)
if (!('linkRole' in Seat.prototype)) Seat.unit('fabric-check stand-in 2', { linkRole(x, want) { if ((want & 1) && this.hasCoord) { for (const c of topo.ownedLinks(this.coord)) if (this.occGet(topo.ckey(c)) === x) return true; } return false; } });
if (!FREE.islandStandM) Seat.free({ islandStandM: (merge, law) => (law === 0 || law === 1 || law === 4 || law === 5) ? merge : false });

// ---- the script generator --------------------------------------------------------------------------------------
function genScript(seed) {
  let s = (seed * 2654435761 + 12345) >>> 0;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (a) => a[ri(0, a.length - 1)];
  const L = [];
  L.push('lever SEED0 ' + ri(1, 1e9));
  const jm = pick(['window', 'window', 'burst', 'batch', 'serial']);
  L.push('lever JOINMODE ' + jm);
  if (jm === 'batch') { L.push('lever JM_A ' + ri(1, 5)); L.push('lever JM_B ' + ri(1, 4)); }
  if (jm === 'serial') L.push('lever JM_A ' + ri(1, 3));
  if (jm === 'window' && r() < 0.4) L.push('lever JM_A ' + ri(3, 40));
  const cond = r() < 0.6;
  if (cond) {
    L.push('lever NUM_SUBNETS ' + ri(1, 4)); L.push('lever NET_LOSS ' + pick([0, 0, 0.1, 0.3])); L.push('lever NET_LAT ' + ri(1, 6));
    L.push('lever NET_SEVER ' + pick([0, 0, 0.05, 0.2])); L.push('lever NET_QUAL_MIN ' + pick([1, 0.5, 0.75])); L.push('lever REACH_DENSITY ' + pick([0.3, 0.7, 1]));
    L.push('lever NET_SPINE ' + ri(0, 1));
  }
  const N = ri(4, 40);
  L.push('init ' + N + ' 0');
  const manual = r() < 0.5;   // seats made by hand all knock with one key, so the relay's list grows and its shuffle is drawn
  if (manual) for (let q = 0; q < N; q++) L.push('mk ' + q); else L.push('spawnall');
  const coord = new Map();   // id -> [pc,r,i] for seats given a coordinate
  let t = 30;
  const ids = () => ri(0, N - 1);
  const noCoord = (a, b) => !coord.has(a) || !coord.has(b);
  for (let k = 0; k < 120; k++) {
    if (r() < 0.25) { t += ri(1, 40); L.push('tick ' + t); }
    const x = r();
    if (x < 0.12) { const id = ids(); if (!coord.has(id)) { const c = [ri(0, 40), ri(0, 4), ri(0, 4)]; coord.set(id, c); L.push('setc ' + id + ' ' + pick([2, 3, 3, 3]) + ' ' + c.join(' ')); } }
    else if (x < 0.20 && coord.size) { const id = pick([...coord.keys()]); const c = coord.get(id); L.push('occ ' + id + ' ' + c[0] + ' ' + c[1] + ' ' + ri(0, 4) + ' ' + ids()); }
    else if (x < 0.50) {
      const a = ids(), b = ids(); const mt = pick(['PHONE', 'PONG', 'HELLO', 'FIND', 'PLACE', 'WHOHOME', 'S1SYNC', 'UNNEEDED']);
      const f = []; if (r() < 0.3) f.push('rvia=' + pick([-1, 3])); if (r() < 0.2) f.push('l10E=1'); if (r() < 0.2) f.push('dgOnly=1'); if (r() < 0.3) f.push('sigAt=' + ri(0, 50), 'id=' + a); if (r() < 0.3) f.push('pp=' + a, 'ppAt=' + ri(0, 50)); if (r() < 0.3) f.push('tag=' + ri(0, 3));
      if (r() < 0.2) f.push('nc=' + ids());
      const cls = noCoord(a, b) ? pick([-1, 0, 1, 2]) : pick([0, 1, 2]);
      L.push(['sched', a, b, mt, cls, ...f].join(' '));
    }
    else if (x < 0.58) { const a = ids(), b = ids(); L.push('send ' + a + ' ' + b + ' ' + pick(['PHONE', 'PONG']) + ' ' + pick(['l10E=1', 'dgOnly=1'])); }
    else if (x < 0.64) { const a = ids(), b = ids(); if (noCoord(a, b)) L.push('send ' + a + ' ' + b + ' HELLO routing=1'); }
    else if (x < 0.76) L.push('knock ' + ids() + ' ' + (manual && r() < 0.9 ? 12345 : ri(0, 1e9)) + ' ' + (r() < 0.8 ? 1 : 0));
    else if (x < 0.80) L.push('force ' + ids() + ' ' + ids() + ' ' + (t + ri(0, 60)));
    else if (x < 0.83) L.push('sever ' + ids() + ' ' + ids() + ' ' + (t + ri(0, 60)));
    else if (x < 0.86) { L.push('cut ' + ids() + ' ' + ri(0, 1)); L.push('part ' + ri(0, 1)); }
    else if (x < 0.88) L.push('dark ' + ids());
    else if (x < 0.90) L.push('lose ' + pick([3, 5]) + ' ' + ids());
    else if (x < 0.91) L.push('doordark ' + (t + ri(-5, 30)));
    else if (x < 0.94) L.push('crash ' + ids());
    else if (x < 0.95) L.push('silent ' + pick([0.05, 0.2]));
    else if (x < 0.97) L.push('counts');
    else if (x < 0.985) L.push('coord ' + ri(0, 1e6) + ' ' + ri(0, 4) + ' ' + ri(0, 4));
    else if (x < 0.995) { const a = ids(), b = ids(); L.push('linkopen ' + a + ' ' + b); }
    else L.push('end');
  }
  L.push('end');
  return L.join('\n') + '\n';
}

// ---- the JS twin of the driver -----------------------------------------------------------------------------------
function runJs(script, dir) {
  const fab = createFabric({ proofDir: path.join(dir, 'js'), traceFile: path.join(dir, 'js.trace') });
  const { lv } = fab; const outLines = [];
  const stateLine = (op, extra) => {
    const e = [lv.EMIT_NEIGHBOR, lv.EMIT_TELEPORT, lv.EMIT_BOOTSTRAP, lv.EMIT_RELAY];
    outLines.push('{"op":"' + op + '","TICK":' + fab.w.TICK + ',"GSEED":' + lv.GSEED + ',"FSEED":' + lv.FSEED + ',"SEQ":' + lv.SEQ + ',"L10SEQ":' + lv.L10SEQ + ',"L22SEQ":' + lv.L22SEQ +
      ',"nextId":' + lv.nextId + ',"bus":' + fab.bus.size + ',"open":' + fab.openPairs.size + ',"relay":' + fab.relayGreeters.size + ',"gen":' + lv.relayGenesisKey + ',"emit":[' + e.join(',') + ']' + (extra || '') + '}');
  };
  const mkSeat = (id) => { while (fab.seats.length <= id) { fab.seats.push(null); fab.alive.push(0); } fab.seats[id] = new Seat(id, fab.w); fab.alive[id] = 1; if (id >= lv.nextId) lv.nextId = id + 1; return fab.seats[id]; };
  const tickEnd = () => fab.proofTickEnd();
  for (const raw of script.split('\n')) {
    const tk = raw.trim().split(/\s+/).filter(Boolean); if (!tk.length || tk[0][0] === '#') continue;
    const op = tk[0], I = (k) => Number(tk[k] || 0);
    if (op === 'lever') {
      const n = tk[1];
      if (n === 'JOINMODE') fab.JOINMODE = tk[2]; else lv[n] = Number(tk[2]);
      stateLine('lever');
    } else if (op === 'init') {
      fab.initSim(I(1), Number(tk[2]));
      let x = ',"N":' + lv.N + ',"win":' + lv.joinWindow + ',"maxp":' + lv.MAXP + ',"plan":[';
      const parts = []; fab.spawnPlan.forEach((p, t) => { if (p.length) parts.push('[' + t + ',' + p.join(',') + ']'); });
      x += parts.join(',') + '],"reach":[' + fab.reachMx.map((rr) => '"' + rr.join('') + '"').join(',') + ']';
      stateLine('init', x);
    } else if (op === 'spawnall' || op === 'spawn') {
      const ts = op === 'spawn' ? [I(1)] : Array.from({ length: fab.spawnPlan.length }, (_, i) => i);
      for (const t of ts) { fab.w.TICK = t; fab.spawnDue(); fab.proofTickEnd(); }
      if (op === 'spawn') {
        const sn = [], q = []; for (let i = 0; i < lv.nextId; i++) if (fab.seats[i]) { sn.push(fab.seats[i].subnet); q.push(fab.seats[i].netQual); }
        stateLine(op, ',"subnets":[' + sn.join(',') + '],"qual":[' + q.join(',') + ']');
      } else stateLine(op);
    } else if (op === 'mk') { mkSeat(I(1)); stateLine('mk'); }
    else if (op === 'setc') { const s = fab.seats[I(1)]; s.state = I(2); s.hasCoord = true; s.coord = { pc: I(3), r: I(4), i: I(5) }; stateLine('setc'); }
    else if (op === 'occ') { const s = fab.seats[I(1)]; s.occ.set(topo.ckey({ pc: I(2), r: I(3), i: I(4) }), I(5)); stateLine('occ'); }
    else if (op === 'tick') { fab.w.TICK = I(1); stateLine('tick'); }
    else if (op === 'sched' || op === 'send') {
      const m = msg.newMsg(tk[3]); let a = 4, cls = -1; if (op === 'sched') { cls = I(4); a = 5; }
      for (; a < tk.length; a++) { const e = tk[a].indexOf('='); const k = tk[a].slice(0, e), v = Number(tk[a].slice(e + 1)); m[k] = (k === 'l10E' || k === 'dgOnly' || k === 'direct' || k === 'routing') ? !!v : v; }
      if (op === 'sched') fab.schedule(I(1), I(2), m, cls); else fab.fabricSend(I(1), I(2), m);
      stateLine(op);
    } else if (op === 'knock') { fab.relayKnock(I(1), I(2) >>> 0, I(3) !== 0); stateLine('knock'); }
    else if (op === 'force') { fab.forcedSever.set(fab.pairKey(I(1), I(2)), I(3)); stateLine('force'); }
    else if (op === 'sever') { fab.severedUntil.set(fab.pairKey(I(1), I(2)), I(3)); stateLine('sever'); }
    else if (op === 'part') { lv.PARTITIONED = I(1) !== 0; stateLine('part'); }
    else if (op === 'cut') { const id = I(1); while (fab.partSide.length <= id) fab.partSide.push(0); fab.partSide[id] = I(2); stateLine('cut'); }
    else if (op === 'dark') { fab.DARK.add(I(1)); stateLine('dark'); }
    else if (op === 'lose') { lv.LOSE_T = I(1); lv.LOSE_NC = I(2); stateLine('lose'); }
    else if (op === 'doordark') { lv.DOORDARK = I(1); stateLine('doordark'); }
    else if (op === 'crash') { const id = I(1); fab.fabricKill(id, fab.w.TICK + fab.K.SOCK_CLOSE_CRASH); fab.X.crashTransport(id); stateLine('crash'); }
    else if (op === 'silent') { const k = fab.killFraction(Number(tk[1]), 'silent'); stateLine('silent', ',"killed":' + k + ',"N":' + lv.N); }
    else if (op === 'counts') { const c = fab.counts(); stateLine('counts', ',"seated":' + c.seated + ',"s1c":' + c.s1c + ',"dups":' + lv.DUPS_G); }
    else if (op === 'coord') { stateLine('coord', ',"s":"' + fab.coordStr({ pc: I(1), r: I(2), i: I(3) }) + '"'); }
    else if (op === 'linkopen') { stateLine('linkopen', ',"r":' + (fab.fabricLinkOpen(I(1), I(2)) ? 'true' : 'false')); }
    else if (op === 'end') { fab.proofTickEnd(); stateLine('end'); }
    else throw new Error('bad op ' + op);
  }
  fab.close();
  return outLines.join('\n') + '\n';
}

// ---- compare ----------------------------------------------------------------------------------------------------
function firstDiff(a, b) {
  const x = a.split('\n'), y = b.split('\n');
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return { line: i + 1, sim: x[i], js: y[i] };
  return null;
}
function readOr(f) { return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; }

function checkSeed(bin, work, seed, script) {
  const dir = path.join(work, 'case' + seed); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const text = script || genScript(seed);
  fs.writeFileSync(path.join(dir, 'script.txt'), text);
  const env = Object.assign({}, process.env, { MESH_PROOF: path.join(dir, 'sim'), MESH_PROOF_TAPES: 'none', MESH_TRACE_FILE: path.join(dir, 'sim.trace') });
  const r = cp.spawnSync(bin, [], { input: text, env, maxBuffer: 1 << 28 });
  if (r.status !== 0) return { bad: 'driver exit ' + r.status + ' ' + String(r.stderr).slice(0, 300) };
  const simOut = r.stdout.toString();
  const jsOut = runJs(text, dir);
  const checks = [
    ['counters', simOut, jsOut],
    ['frames.jsonl', readOr(path.join(dir, 'sim', 'frames.jsonl')), readOr(path.join(dir, 'js', 'frames.jsonl'))],
    ['hash.jsonl', readOr(path.join(dir, 'sim', 'hash.jsonl')), readOr(path.join(dir, 'js', 'hash.jsonl'))],
    ['trace', readOr(path.join(dir, 'sim.trace')), readOr(path.join(dir, 'js.trace'))],
  ];
  const sizes = {};
  for (const [name, a, b] of checks) {
    sizes[name] = a.split('\n').length - 1;
    const d = firstDiff(a, b);
    if (d) return { bad: name + ' line ' + d.line + '\n  sim ' + String(d.sim).slice(0, 500) + '\n  js  ' + String(d.js).slice(0, 500), dir };
  }
  return { ok: true, sizes };
}

if (require.main === module) {
  const [bin, work, nStr, firstStr] = process.argv.slice(2);
  if (!bin || !work) { console.error('usage: fabric-check.js <driver> <work dir> [cases] [first seed]'); process.exit(2); }
  fs.mkdirSync(work, { recursive: true });
  const n = Number(nStr || 20), first = Number(firstStr || 1);
  const tot = { counters: 0, 'frames.jsonl': 0, 'hash.jsonl': 0, trace: 0 }; let fails = 0;
  for (let s = first; s < first + n; s++) {
    const r = checkSeed(bin, work, s);
    if (r.bad) { fails++; console.log('seed ' + s + ' DIFF ' + r.bad); if (fails >= 3) break; continue; }
    for (const k of Object.keys(tot)) tot[k] += r.sizes[k];
  }
  console.log((n - fails) + '/' + n + ' cases equal; lines compared: ' + JSON.stringify(tot));
  console.log(fails ? 'fabric check FAIL' : 'fabric check PASS');
  process.exit(fails ? 1 : 0);
}
module.exports = { genScript, runJs, checkSeed };
