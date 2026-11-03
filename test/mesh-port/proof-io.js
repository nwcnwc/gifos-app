'use strict';
// proof-io.js: reads the files a recorded room run leaves in one directory.
//
//   frames.jsonl    every message put on the bus ("send") and every message a seat takes in ("recv")
//   hash.jsonl      per tick, the seats whose state hash changed
//   state.jsonl     optional: the state each hash covered
//   tapes/<id>.jsonl  per seat: every input and every call out, in order
//   summary.json    counts and sizes
//
// Every line is JSON.stringify form. A reader here yields parsed objects one line at
// a time (files are read in chunks, never whole). `strict` re-checks the form of each line.
const fs = require('fs'), path = require('path');
const fnv = require('../../js/mesh/fnv.js');

// FNV-1a 32 of a state object, over the UTF-8 bytes of its JSON.
function stateHash(state) { return fnv.str(JSON.stringify(state)); }

// Yield the lines of a file, without the newline.
function* lines(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.allocUnsafe(1 << 20);
    let rest = Buffer.alloc(0);
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n === 0) break;
      let chunk = rest.length ? Buffer.concat([rest, buf.subarray(0, n)]) : buf.subarray(0, n);
      let from = 0, nl;
      while ((nl = chunk.indexOf(10, from)) >= 0) { yield chunk.toString('utf8', from, nl); from = nl + 1; }
      rest = Buffer.from(chunk.subarray(from));
    }
    if (rest.length) yield rest.toString('utf8');
  } finally { fs.closeSync(fd); }
}

// Yield { n, line, o } for each line (n counts from 1). Missing file: nothing.
function* records(file, opts) {
  if (!fs.existsSync(file)) return;
  const strict = opts && opts.strict;
  let n = 0;
  for (const line of lines(file)) {
    n++;
    const o = JSON.parse(line);
    if (strict && JSON.stringify(o) !== line) throw new Error(path.basename(file) + ':' + n + ' is not in JSON.stringify form');
    yield { n, line, o };
  }
}

// frames.jsonl: { n, e: 'send'|'recv', t, to?, due?, seq?, m }
function* frames(dir, opts) { for (const r of records(path.join(dir, 'frames.jsonl'), opts)) yield Object.assign({ n: r.n }, r.o); }

// hash.jsonl, one entry per seat per change: { t, id, h } (h is null once a seat is gone)
function* hashes(dir, opts) {
  for (const r of records(path.join(dir, 'hash.jsonl'), opts))
    for (const [id, h] of r.o.h) yield { n: r.n, t: r.o.t, id, h };
}

// state.jsonl: { n, t, id, s }
function* states(dir, opts) { for (const r of records(path.join(dir, 'state.jsonl'), opts)) yield Object.assign({ n: r.n }, r.o); }

// The seat ids that have a tape, ascending.
function tapeIds(dir) {
  const td = path.join(dir, 'tapes');
  if (!fs.existsSync(td)) return [];
  return fs.readdirSync(td).filter(f => /^-?\d+\.jsonl$/.test(f)).map(f => parseInt(f, 10)).sort((a, b) => a - b);
}

// One seat's tape: { n, e, t, ... }
function* tape(dir, id, opts) { for (const r of records(path.join(dir, 'tapes', id + '.jsonl'), opts)) yield Object.assign({ n: r.n }, r.o); }

function summary(dir) {
  const f = path.join(dir, 'summary.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

module.exports = { stateHash, lines, records, frames, hashes, states, tapeIds, tape, summary };
