#!/usr/bin/env node
'use strict';
// trace-diff.js <dirA> <dirB> [--all] [--limit N]
//
// Compares two recorded runs of the same room (say the reference run and the JS run)
// and prints, for each seat, where the two first differ: the tick, the stream, and the
// first differing field. Exit 0 when identical, 1 when anything differs, 2 on usage.
//
// Streams compared per seat:
//   send   messages the seat put on the bus (frames.jsonl, by `from`; `from` -1 is the bus itself)
//   recv   messages delivered to the seat (frames.jsonl, by `to`)
//   hash   the seat's state-hash changes, per tick (hash.jsonl); with state.jsonl in both
//          dirs, the first differing state field is named
//   tape   the seat's tape, line by line (tapes/<id>.jsonl), when both dirs have it
//
// By default one line per diverging seat (its earliest divergence); --all lists every
// diverging stream. The seats are ordered by the tick of their first divergence.
const path = require('path');
const io = require('./proof-io.js');

// First differing path between two parsed JSON values, or null when equal.
// Returns { path, a, b }; a missing side is `undefined`.
function firstDiff(a, b, p) {
  p = p || '';
  if (a === b) return null;
  const ta = typeOf(a), tb = typeOf(b);
  if (ta !== tb || (ta !== 'object' && ta !== 'array')) return { path: p || '(value)', a, b };
  if (ta === 'array') {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (i >= a.length || i >= b.length) return { path: p + '[' + i + ']', a: a[i], b: b[i] };
      const d = firstDiff(a[i], b[i], p + '[' + i + ']'); if (d) return d;
    }
    return null;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  // keys in order: the first position where the key lists part, then values
  const n = Math.max(ka.length, kb.length);
  for (let i = 0; i < n; i++) {
    if (ka[i] !== kb[i]) {
      const k = ka[i] !== undefined && !(ka[i] in b) ? ka[i] : (kb[i] !== undefined && !(kb[i] in a) ? kb[i] : ka[i]);
      return { path: (p ? p + '.' : '') + k, a: a[k], b: b[k] };
    }
    const d = firstDiff(a[ka[i]], b[ka[i]], (p ? p + '.' : '') + ka[i]); if (d) return d;
  }
  return null;
}
function typeOf(v) { return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v; }

function push(map, key, v) { let a = map.get(key); if (!a) map.set(key, a = []); a.push(v); }

// Compare two sequences of { t, o } entries. Returns null or { index, t, diff, tapeEnd }.
function firstSeqDiff(A, B) {
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) {
    if (i >= A.length || i >= B.length) {
      const x = i >= A.length ? B[i] : A[i];
      return { index: i, t: x.t, diff: { path: i >= A.length ? '(A ends here)' : '(B ends here)', a: A[i] && A[i].o, b: B[i] && B[i].o } };
    }
    if (A[i].s === B[i].s) continue;
    const d = firstDiff(A[i].o, B[i].o);
    if (d) return { index: i, t: Math.min(A[i].t, B[i].t), diff: d };
  }
  return null;
}

function loadFrames(dir) {
  const send = new Map(), recv = new Map();
  for (const f of io.frames(dir)) {
    const m = f.m;
    if (f.e === 'send') push(send, m.from === undefined ? -1 : m.from, { t: f.t, o: f, s: JSON.stringify(f) });
    else push(recv, f.to, { t: f.t, o: f, s: JSON.stringify(f) });
  }
  return { send, recv };
}
function loadHash(dir) {
  const h = new Map();
  for (const e of io.hashes(dir)) push(h, e.id, { t: e.t, o: { t: e.t, h: e.h }, s: e.t + '/' + e.h });
  return h;
}
function loadStates(dir) {
  const m = new Map();
  for (const s of io.states(dir)) m.set(s.t + '/' + s.id, s.s);
  return m;
}

function diffDirs(dirA, dirB) {
  const out = [];     // { seat, stream, t, index, diff }
  const note = (seat, stream, r, extra) => out.push(Object.assign({ seat, stream, t: r.t, index: r.index, diff: r.diff }, extra));
  const fa = loadFrames(dirA), fb = loadFrames(dirB);
  for (const stream of ['send', 'recv']) {
    const A = fa[stream], B = fb[stream];
    for (const seat of new Set([...A.keys(), ...B.keys()])) {
      const r = firstSeqDiff(A.get(seat) || [], B.get(seat) || []);
      if (r) note(seat, stream, r);
    }
  }
  const ha = loadHash(dirA), hb = loadHash(dirB);
  let sa = null, sb = null;
  const haveStates = () => {
    if (sa === null) { sa = loadStates(dirA); sb = loadStates(dirB); }
    return sa.size > 0 && sb.size > 0;
  };
  for (const seat of new Set([...ha.keys(), ...hb.keys()])) {
    const r = firstSeqDiff(ha.get(seat) || [], hb.get(seat) || []);
    if (!r) continue;
    // name the first differing state field when both sides kept the states
    if (haveStates()) {
      const A = ha.get(seat) || [], B = hb.get(seat) || [];
      const a = A[r.index], b = B[r.index];
      // the state at the first tick either side shows a different hash
      const t = Math.min(a ? a.t : Infinity, b ? b.t : Infinity);
      const xa = sa.get(t + '/' + seat), xb = sb.get(t + '/' + seat);
      if (xa && xb) { const d = firstDiff(xa, xb, 'state'); if (d) r.diff = d; }
    }
    note(seat, 'hash', r);
  }
  const ta = new Set(io.tapeIds(dirA)), tb = new Set(io.tapeIds(dirB));
  for (const seat of [...ta].filter(x => tb.has(x))) {
    // calls out carry no tick of their own: they take the tick of the input before them
    const load = (d) => { const L = []; let t = 0; for (const e of io.tape(d, seat)) { if (typeof e.t === 'number') t = e.t; L.push({ t, o: e, s: JSON.stringify(e) }); } return L; };
    const A = load(dirA), B = load(dirB);
    const r = firstSeqDiff(A, B);
    if (r) note(seat, 'tape', r);
  }
  return out;
}

function show(v) { const s = v === undefined ? '(absent)' : JSON.stringify(v); return s.length > 120 ? s.slice(0, 117) + '...' : s; }

function report(rows, all, limit) {
  // per seat: earliest divergence first
  const bySeat = new Map();
  for (const r of rows) push(bySeat, r.seat, r);
  const seats = [...bySeat.entries()].map(([seat, rs]) => {
    rs.sort((x, y) => x.t - y.t || x.index - y.index);
    return { seat, rs };
  }).sort((x, y) => x.rs[0].t - y.rs[0].t || x.seat - y.seat);
  const lines = [];
  for (const { seat, rs } of seats.slice(0, limit)) {
    for (const r of (all ? rs : rs.slice(0, 1)))
      lines.push('seat ' + seat + ' ' + r.stream + ' tick ' + r.t + ' #' + r.index + ' field ' + r.diff.path + ': A=' + show(r.diff.a) + ' B=' + show(r.diff.b));
  }
  if (seats.length > limit) lines.push('... ' + (seats.length - limit) + ' more diverging seats');
  return { seats, lines };
}

module.exports = { firstDiff, diffDirs, report };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const all = argv.includes('--all');
  const li = argv.indexOf('--limit');
  const limit = li >= 0 ? parseInt(argv[li + 1], 10) : 50;
  const dirs = argv.filter((a, i) => !a.startsWith('--') && (li < 0 || i !== li + 1));
  if (dirs.length !== 2) { console.error('usage: trace-diff.js <dirA> <dirB> [--all] [--limit N]'); process.exit(2); }
  const rows = diffDirs(dirs[0], dirs[1]);
  if (!rows.length) { console.log('IDENTICAL ' + path.basename(dirs[0]) + ' ' + path.basename(dirs[1])); process.exit(0); }
  const { seats, lines } = report(rows, all, limit);
  console.log(lines.join('\n'));
  const first = seats[0].rs[0];
  console.log('DIFFERENT seats=' + seats.length + ' first: seat ' + first.seat + ' tick ' + first.t + ' ' + first.stream + ' ' + first.diff.path);
  process.exit(1);
}
