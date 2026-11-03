#!/usr/bin/env node
'use strict';
/*
 * corpus.js: the proofs of the ops unit (port plan H3) against the simq cache.
 *
 *   node corpus.js scan <cache v1 dir> [--cxx <mesh binary>]
 *       Parse every cached stream (<dir>/*\/stream) the way the sim's service loop does, count the verbs, and say
 *       for each one what the JS runOp does with it: PORTED (a handler), EXTERNAL (a handler that calls a unit
 *       another job ports, via fab.X), NOT-PORTED (listed on purpose), or SIM-UNKNOWN (the sim itself answers
 *       "ERR unknown: <verb>"; with --cxx each such verb is run through the sim to prove it). Exit 1 if any verb
 *       is none of these.
 *   node corpus.js battery <mesh binary>
 *       The hand-made battery (BATTERY below): argument parsing, lever toggles and every report on an empty room, same lines to both, compared chunk by chunk.
 *   node corpus.js diff <cache v1 dir> <mesh binary> [--max-n N] [--limit K]
 *       For each distinct stream prefix (a cached stream cut at its first verb that advances time or makes a
 *       seat; a marker verb after every line), run the sim and `main.js --service --tolerant` and compare stdout
 *       chunk by chunk (one chunk per stream line). A chunk the JS skips as "not wired" / "not ported" is counted
 *       apart. Exit 1 on any difference.
 */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { createFabric } = require('./fabric.js');
const { createOps, NOT_PORTED, EXTERNAL_VERBS } = require('./runop.js');

// the verbs that run seat code (advance the tick, or make a seat that joins): the cut of the diff
const TIMED = new Set(['tick', 'converge', 'until', 'watch', 'stagewait', 'stagerun', 'kickuntil', 'kickwatch', 'sitxfer', 'doorwatch', 'spawn', 'evilknock', 'lgcase', 'tierwatch', 'feedcase', 'reload', 'reloadnew', 'resume', 'twocells', 'hostile']);

function streams(dir) {
  const out = [];
  for (const d of fs.readdirSync(dir)) { const f = path.join(dir, d, 'stream'); if (fs.existsSync(f)) out.push(f); }
  return out;
}
const tokenize = (line) => { line = line.replace(/[\r\n]+$/, ''); return line.split(' ').filter((x) => x.length); };   // the service loop: split on ' ' only

function classify(ops, verb) {
  if (verb in ops.verbs) return (verb in EXTERNAL_VERBS || ['mgap', 'media', 'lguard', 'lgcase', 'pcs', 'realcheck', 'joinstat', 'up2stat'].includes(verb)) ? 'EXTERNAL' : 'PORTED';
  if (NOT_PORTED.has(verb)) return 'NOT-PORTED';
  return 'SIM-UNKNOWN';
}

function scan(dir, cxx) {
  const fab = createFabric({}); const ops = createOps(fab, { out: () => {} });
  const count = new Map(); let nStreams = 0, nLines = 0, bad = 0;
  for (const f of streams(dir)) {
    let txt; try { txt = fs.readFileSync(f, 'latin1'); } catch (e) { bad++; console.log('UNREADABLE ' + f); continue; }
    nStreams++;
    for (const line of txt.split('\n')) { const tk = tokenize(line); if (!tk.length) continue; nLines++; count.set(tk[0], (count.get(tk[0]) || 0) + 1); }
  }
  const rows = [...count.entries()].sort((a, b) => b[1] - a[1]);
  const by = { PORTED: [], EXTERNAL: [], 'NOT-PORTED': [], 'SIM-UNKNOWN': [] };
  for (const [v, n] of rows) by[classify(ops, v)].push([v, n]);
  if (cxx) {   // prove each SIM-UNKNOWN verb is unknown to the sim too
    const vs = by['SIM-UNKNOWN'].map((x) => x[0]);
    const r = cp.spawnSync(cxx, ['--service'], { input: vs.join('\n') + '\nquit\n', env: Object.assign({}, process.env, { MESH_NOTIME: '1', MESH_THREADS: '1' }), encoding: 'latin1' });
    const lines = r.stdout.split('\n').filter((l) => l && !l.startsWith('READY') && l !== 'BYE');
    vs.forEach((v, i) => { if (lines[i] !== 'ERR unknown: ' + v) { bad++; console.log('SIM KNOWS ' + v + ' -> ' + lines[i]); } });
  }
  console.log(`streams=${nStreams} lines=${nLines} verbs=${rows.length} unreadable/unknown-to-both-sides problems=${bad}`);
  for (const k of Object.keys(by)) console.log(`${k}: ${by[k].length} verbs, ${by[k].reduce((s, x) => s + x[1], 0)} lines${by[k].length ? '\n  ' + by[k].map((x) => x[0] + ':' + x[1]).join(' ') : ''}`);
  return bad ? 1 : 0;
}

function diff(dir, cxx, opt) {
  const maxN = opt.maxN || 20000, limit = opt.limit || 1e9;
  const seen = new Set(); const cases = [];
  for (const f of streams(dir)) {
    const lines = fs.readFileSync(f, 'latin1').split('\n').map(tokenize).filter((t) => t.length);
    const cut = []; let bigN = false;
    for (const tk of lines) {
      if (TIMED.has(tk[0]) || tk[0] === 'quit') break;
      if (tk[0] === 'init' && atoi(tk[1]) > maxN) bigN = true;
      cut.push(tk);
    }
    if (bigN || cut.length === 0) continue;
    const key = cut.map((t) => t.join(' ')).join('\n'); if (seen.has(key)) continue; seen.add(key); cases.push(cut);
  }
  cases.sort((a, b) => a.length - b.length);
  let nCase = 0, nChunk = 0, nSkip = 0, nSame = 0, nDiff = 0; const perVerb = new Map(); const skipVerb = new Map(); const diffs = [];
  const env = Object.assign({}, process.env, { MESH_NOTIME: '1', MESH_THREADS: '1' });
  for (const cut of cases.slice(0, limit)) {
    nCase++;
    const input = cut.map((t, i) => t.join(' ') + '\n__m' + i + '\n').join('') + 'quit\n';
    const c = cp.spawnSync(cxx, ['--service'], { input, env, encoding: 'latin1', maxBuffer: 1 << 28 });
    const j = cp.spawnSync(process.execPath, [path.join(__dirname, 'main.js'), '--service', '--tolerant'], { input, env, encoding: 'latin1', maxBuffer: 1 << 28 });
    const split = (s) => { const ch = []; let cur = []; for (const l of s.split('\n')) { if (l === 'READY gifos-mesh-sim service') continue; if (l.startsWith('ERR unknown: __m')) { ch.push(cur); cur = []; } else cur.push(l); } return ch; };
    const cc = split(c.stdout), jc = split(j.stdout);
    if (j.status !== 0 && jc.length < cut.length) { diffs.push({ cut, why: 'JS died: ' + (j.stderr || '').split('\n').slice(0, 3).join(' | ') }); nDiff++; continue; }
    for (let i = 0; i < cut.length; i++) {
      nChunk++; const verb = cut[i][0]; const a = (cc[i] || []).join('\n'), b = (jc[i] || []).join('\n');
      if (b.startsWith('@@SKIP')) { nSkip++; skipVerb.set(verb, (skipVerb.get(verb) || 0) + 1); continue; }
      if (verb === 'rss') { nSame++; perVerb.set(verb, (perVerb.get(verb) || 0) + 1); continue; }   // process memory: never equal
      if (a === b) { nSame++; perVerb.set(verb, (perVerb.get(verb) || 0) + 1); } else { nDiff++; diffs.push({ cut: cut.slice(0, i + 1), why: 'C++:\n' + a + '\nJS:\n' + b }); break; }
    }
  }
  console.log(`cases=${nCase} chunks=${nChunk} same=${nSame} skipped(not wired/ported)=${nSkip} diff=${nDiff}`);
  console.log('compared per verb: ' + [...perVerb.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0] + ':' + x[1]).join(' '));
  console.log('skipped per verb: ' + [...skipVerb.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0] + ':' + x[1]).join(' '));
  for (const d of diffs.slice(0, 5)) console.log('DIFF after:\n' + d.cut.map((t) => '  ' + t.join(' ')).slice(-6).join('\n') + '\n' + d.why);
  return nDiff ? 1 : 0;
}

// A hand-made battery for the verbs that read a room before any seat has run (zero seats): argument parsing, the
// lever toggles, every report's text on an empty room. The same lines go to the sim and to the JS.
const BATTERY = [
  'seed 7', 'seed', 'seed 4294967295', 'joinmode burst', 'joinmode batch 3 2', 'joinmode serial 4', 'joinmode window 12', 'joinmode', 'net', 'net loss=0.1 lat=3 sever=0.05 subnets=3 density=0.5 qual=0.75 spine=1 relayk=2 skew=4 clkoff=9',
  'net subnets=0 skew=-3 clkoff=-5 bogus=1 loss', 'net loss=0.125', 'linkmodel 0', 'linkmodel', 'threads 4', 'threads', 'threads 0', 'det', 'sigdedupe', 'sigdedupe 0', 'compacton 0', 'compacton', 'problvl 3', 'problvl', 'probeon 0', 'probeon', 'spreadon 0', 'spreadon',
  'spreaddepth 2', 'spreaddepth', 'digabs 0', 'digabs', 'digeston 0', 'digeston', 'l10bucket 0', 'l10bucket', 'kickhold 99', 'kickhold', 'doorcap 7 3', 'doorcap', 'doorcap_mobile 5 2', 'doorcap_mobile', 'mobrate 9', 'mobrate', 'l16pick random', 'l16pick random-drop', 'l16pick',
  'l16backoff 4 40', 'l16backoff', 'l16hoload 6', 'l16hoload', 'l16mobkeep 2', 'l16mobkeep', 'l16hedge 3', 'l16hedge', 'l16fan 2', 'l16fan', 'l15settle 7', 'l15settle', 'tierquiet 11', 'tierquiet', 'tierperiod 900', 'tierperiod', 'tierlead 5', 'tierlead', 'tierhops 3', 'tierhops',
  'tiermix 0.3', 'tiermix', 'tiermix 0.125', 'realcheck on', 'realcheck off', 'realcheck', 'losefirst FIND 8', 'losefirst PLACE', 'losefirst NOPE 3', 'losefirst',
  'init 30 0', 'init', 'init 12 0.25', 'init 30 0',
  'state', 'bad', 'dups', 'holes', 'hist', 'transit', 'relay', 'darkstat', 'where 3', 'where', 'where -1', 'find /0.0', 'find /1.2', 'find /01.2', 'find nonsense', 'find', 'isactive 3', 'occ 3 /0.0', 'seat 3', 'seat', 'seat -1',
  'check', 'splitstate', 'split 0.5', 'splitstate', 'heal_net', 'join_net', 'seatdump', 'tiercells', 'tierstat', 'natstat', 'viewcheck', 'lineage', 'compact', 'compactfix', 'lists', 'digest', 'digest reset', 'digest', 'digcount 5', 'digcount conn', 'digcount 3 2', 'digstale', 'digstale 10',
  'freemap', 'seathash', 'l10', 'l10 reset', 'l10 seat 2', 'l10spam 2 1', 'l10spam', 'noroomhist', 'noroomhist reset', 'descstat', 'descstat reset', 'movemark', 'movestat', 'stageset', 'joinslow', 'joinslow 3 last', 'joinstat',
  'kickstat 2', 'kvotes 2', 'kaudit 2', 'kroles 1', 'kroles deep', 'kfake 2 owner', 'kevil 2 badsig 5', 'kforge 1 ok 2', 'kleave 2', 'kickignore 1', 'kickknock 1', 'kickknock 99', 'kvote first:3 yes 4', 'kvote 2 clear', 'kvote 2 bogus 1',
  'refuse all 1', 'refuse frac 0.05', 'refuse 3 1', 'hand all 1', 'hand frac 0.5 1', 'stage all 1 4', 'app 3 1', 'away all 1', 'vote all dn pool 3', 'vote 2 up 3', 'vote clear', 'talk all on', 'talk 3 off', 'pin 3', 'pin 3 0',
  'lie 2 1', 'lie /0.0 2', 'lie 2 tier mobile', 'lie 2 nat', 'lie 99 tier', 'tier 2 mobile', 'tier 2 purple', 'tierhold 2 1', 'evil 0.05', 'evil 0.5 reclaim', 'anchors 5 30', 'anchors 9 60 room', 'anchors 9 60 room nocap', 'anchors',
  'kill 0.2', 'kill 0.2 deep', 'kill 0.2 s1row', 'kill 0.5 s1all', 'kill 0.1 silent', 'kill 0.1 crash', 'killat /0.0', 'killat /0.0 silent', 'killat /0.0 crash', 'killat zzz', 'crash 3', 'crash 3 quiet', 'crash', 'killspread 0.5 30', 'killspread 0.5 30 crash', 'killspread',
  'dark 3', 'darkat /0.0', 'darkat zz', 'sever 1 2 50', 'sever 1 2', 'sitxfer /0.0 self', 'sitxfer /0.0', 'sitxfer', 'pcstrack', 'rss', 'lawoff L9', 'lawon L27.8', 'l2variant A', 'darklaws 0', 'l28stat', '#', 'bogusverb 1 2', 'mgap', 'mgap bogus', 'media bogus', 'media stage',
  'quit',
];
// the battery as stdin text (a marker verb after every line) and as token lines
function batteryInput() {
  const lines = BATTERY.filter((l) => !/^(rss|sitxfer|tierwatch)/.test(l));   // a line that moves time or makes a seat is left out (the seats are another job)
  const cut = lines.map((l) => l.split(' ').filter((x) => x.length));
  const input = cut.map((t, i) => (t[0] === 'quit' ? 'quit\n' : t.join(' ') + '\n__m' + i + '\n')).join('');
  return { cut, input };
}
function battery(cxx) {
  const env = Object.assign({}, process.env, { MESH_NOTIME: '1', MESH_THREADS: '1' });
  const { cut, input } = batteryInput();
  const c = cp.spawnSync(cxx, ['--service'], { input, env, encoding: 'latin1', maxBuffer: 1 << 28 });
  const j = cp.spawnSync(process.execPath, [path.join(__dirname, 'main.js'), '--service', '--tolerant'], { input, env, encoding: 'latin1', maxBuffer: 1 << 28 });
  const split = (s) => { const ch = []; let cur = []; for (const l of s.split('\n')) { if (l === 'READY gifos-mesh-sim service') continue; if (l.startsWith('ERR unknown: __m')) { ch.push(cur); cur = []; } else cur.push(l); } return ch; };
  const cc = split(c.stdout), jc = split(j.stdout);
  if (j.status !== 0) console.log('JS exit ' + j.status + ': ' + (j.stderr || '').split('\n').slice(0, 4).join(' | '));
  let same = 0, skip = 0, nd = 0; const skipped = [];
  for (let i = 0; i < cut.length - 1; i++) {
    const a = (cc[i] || []).join('\n'), b = (jc[i] || []).join('\n');
    if (b.startsWith('@@SKIP')) { skip++; skipped.push(cut[i].join(' ')); continue; }
    if (a === b) same++; else { nd++; console.log('DIFF at `' + cut[i].join(' ') + '`\n  C++: ' + a.replace(/\n/g, '\n       ') + '\n  JS:  ' + b.replace(/\n/g, '\n       ')); }
  }
  console.log(`battery lines=${cut.length - 1} same=${same} skipped=${skip} diff=${nd}`);
  if (skipped.length) console.log('skipped: ' + skipped.join(' ; '));
  return nd ? 1 : 0;
}
function atoi(s) { const v = parseInt(s, 10); return Number.isNaN(v) ? 0 : v | 0; }

if (require.main === module) {
  const [cmd, dir, ...rest] = process.argv.slice(2);
  const opt = {}; let cxx = null;
  for (let i = 0; i < rest.length; i++) { if (rest[i] === '--cxx') cxx = rest[++i]; else if (rest[i] === '--max-n') opt.maxN = +rest[++i]; else if (rest[i] === '--limit') opt.limit = +rest[++i]; else if (!cxx && cmd === 'diff') cxx = rest[i]; }
  if (cmd === 'scan') process.exit(scan(dir, cxx));
  else if (cmd === 'diff') process.exit(diff(dir, cxx, opt));
  else if (cmd === 'battery') process.exit(battery(dir));
  else { console.error('usage: corpus.js scan <v1 dir> [--cxx bin] | diff <v1 dir> <bin> [--max-n N] [--limit K]'); process.exit(2); }
}
module.exports = { scan, diff, battery, batteryInput, tokenize };
