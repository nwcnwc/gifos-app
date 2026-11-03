#!/usr/bin/env node
// gen-seat.js <sim dir> [--check]
// Writes js/mesh/seat-fields.js from the sim's `struct Seat` (mesh.cpp): every data member in declaration
// order with its C++ type and default, the member structs (SoftSit, L31Pend, ...) and the seat-held helper
// structs declared beside it (XPub, DialBook, CallBook, Bucket), and the dump / restore that use them.
// Member functions are skipped here: seat.js and the unit files port them by hand.
// Types are written in the msg.json notation: i32 i64 u8 u16 u32 u64 f64 bool str ptr, a struct name,
// {K:V} a map, <K> a set, [T] a vector or deque, (A,B) a pair, [T;N] a fixed array.
//   node test/mesh-port/gen-seat.js <gifos>/test/sim            write the module
//   node test/mesh-port/gen-seat.js <gifos>/test/sim --check    exit 1 if the module on disk is stale
'use strict';
const fs = require('fs'), path = require('path');

const args = process.argv.slice(2);
const check = args.includes('--check');
const dir = args.find(a => a !== '--check');
if (!dir) { console.error('usage: gen-seat.js <sim dir> [--check]'); process.exit(2); }
const cpp = fs.readFileSync(path.join(dir, 'mesh.cpp'), 'utf8');
const msgSpec = JSON.parse(fs.readFileSync(path.join(dir, 'msg.json'), 'utf8'));
const consts = (() => { require(path.join(__dirname, '..', '..', 'js', 'mesh', 'laws.js')); return require(path.join(__dirname, '..', '..', 'js', 'mesh', 'consts.js')); })();
const K = Object.assign({ NO_CK: require(path.join(__dirname, '..', '..', 'js', 'mesh', 'topo.js')).NO_CK }, consts.consts, consts.levers, consts.enums);

// ---- text helpers ------------------------------------------------------------------------------------------
function stripComments(s) {   // keep line breaks so line numbers survive
  return s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '').replace(/"(?:[^"\\]|\\.)*"/g, m => m);
}
const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

// The body of `struct Name {` .. its matching `}` (first one at or after `from`).
function structBody(text, re, from = 0) {
  const m = re.exec(text.slice(from)); if (!m) throw new Error('gen-seat: no ' + re);
  const open = from + m.index + m[0].length - 1;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) return { body: text.slice(open + 1, i), start: open + 1, end: i }; }
  }
  throw new Error('gen-seat: unbalanced ' + re);
}

// Top-level statements of a struct body: fields end at ';', function definitions at their closing '}'.
function statements(body, base) {
  const out = []; let depth = 0, cur = '', start = 0, sawParen = false, braceAt = -1;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (!cur.trim()) start = i;
    cur += ch;
    if (ch === '(' && depth === 0 && braceAt < 0) sawParen = true;
    if (ch === '(' || ch === '{') { if (ch === '{' && depth === 0 && braceAt < 0) braceAt = cur.length - 1; depth++; }
    else if (ch === ')' || ch === '}') {
      depth--;
      if (ch === '}' && depth === 0) {
        const head = cur.slice(0, braceAt).trim();
        if (sawParen && !/^(struct|enum)\b/.test(head)) { out.push({ text: cur.trim(), at: base + start, fn: true }); cur = ''; sawParen = false; braceAt = -1; }
      }
    } else if (ch === ';' && depth === 0) { out.push({ text: cur.trim().replace(/;$/, ''), at: base + start, fn: sawParen }); cur = ''; sawParen = false; braceAt = -1; }
  }
  return out;
}

// Split at top-level commas (tracking () {} [] <>).
function splitTop(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if ('({[<'.includes(ch)) depth++;
    if (')}]>'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim());
}

// ---- types -------------------------------------------------------------------------------------------------
const SCAL = { 'int': 'i32', 'long long': 'i64', 'uint8_t': 'u8', 'uint16_t': 'u16', 'uint32_t': 'u32', 'unsigned': 'u32',
  'uint64_t': 'u64', 'size_t': 'u64', 'bool': 'bool', 'double': 'f64', 'char': 'i8', 'string': 'str', 'const char*': 'str',
  'IdP': 'idp' };
const MSGS = new Set(['Msg', 'Coord', 'KV', 'LE', 'VE', 'KStmt', 'Dig', 'DigE', 'Ent']);
let localStructs = new Set();
function ty(t) {
  t = t.replace(/\bmutable\b|\bstd::/g, '').replace(/\s+/g, ' ').trim().replace(/ \*/g, '*');
  if (SCAL[t]) return SCAL[t];
  if (/\*$/.test(t)) return 'ptr';
  if (t === 'Occ') return '{u64:i32}';
  let m;
  if ((m = /^(OMap|map)<(.*)>$/.exec(t))) { const [a, b] = splitTop(m[2]); return '{' + ty(a) + ':' + ty(b) + '}'; }
  if ((m = /^(OSet|set)<(.*)>$/.exec(t))) return '<' + ty(m[2]) + '>';
  if ((m = /^(vector|deque)<(.*)>$/.exec(t))) return '[' + ty(m[2]) + ']';
  if ((m = /^pair<(.*)>$/.exec(t))) { const [a, b] = splitTop(m[1]); return '(' + ty(a) + ',' + ty(b) + ')'; }
  if ((m = /^Bucket<(.*)>$/.exec(t))) return 'Bucket<' + ty(m[1]) + '>';
  if (MSGS.has(t) || localStructs.has(t) || ['XPub', 'DialBook', 'CallBook', 'Rec'].includes(t)) return t;
  throw new Error('gen-seat: unknown type ' + t);
}

// A field initializer's value (C++ text after '=' or inside '{}') as a JS literal, for its type.
function initVal(type, init) {
  if (init === undefined || init === '' || init === '{}') return null;   // the type's default
  let e = init.trim();
  if (e === '~0ull') return { lit: '18446744073709551615', note: '~0ull: 2^64-1 has no exact JS number; equality with a cell key is all it is used for' };
  if (e === 'nullptr') return { lit: 'null' };
  if (/^".*"$/.test(e)) return { lit: e };
  if (type === 'Coord') { const p = splitTop(e.replace(/^\{|\}$/g, '')).map(Number); return { lit: '{ pc: ' + p[0] + ', r: ' + p[1] + ', i: ' + p[2] + ' }' }; }
  if (/^Bucket/.test(type)) { const p = splitTop(e.replace(/^\{|\}$/g, '')); return { lit: '[' + p.map(x => evalNum(x)).join(', ') + ']', bucket: true }; }
  if (/^\[.*;\d+\]$/.test(type)) { const p = splitTop(e.replace(/^\{|\}$/g, '')).filter(x => x !== ''); return { lit: '[' + p.map(x => evalNum(x)).join(', ') + ']', fixed: true }; }
  if (type === 'Msg' || type === 'Dig' || type === 'KStmt') return null;
  if (type === 'bool') return { lit: e === 'true' ? 'true' : e === 'false' ? 'false' : String(!!evalNum(e)) };
  return { lit: String(evalNum(e)) };
}
function evalNum(e) {
  const js = e.replace(/\b(\d+)(?:ull|ULL|ll|LL|u|U)\b/g, '$1').replace(/\(\s*(?:long long|int|uint32_t)\s*\)/g, '');
  // eslint-disable-next-line no-new-func
  const v = Function('K', 'with (K) { return (' + js + '); }')(K);
  if (typeof v !== 'number' && typeof v !== 'boolean') throw new Error('gen-seat: initializer ' + e);
  return v;
}

// Parse the data members of a struct body: [{name, type, cpp, init, arr, line}], plus nested structs.
function members(body, base, text, owner) {
  const fields = [], nested = [], statics = [], enums = [];
  for (const st of statements(body, base)) {
    let s = st.text.replace(/^\s*(public|private):/, '').trim();
    if (!s) continue;
    const line = lineOf(text, st.at);
    let m;
    if ((m = /^struct\s+(\w+)\s*\{([\s\S]*)\}\s*(.*)$/.exec(s))) {
      const name = m[1]; localStructs.add(name);
      const inner = s.indexOf('{');
      nested.push({ name, line, ...members(m[2], st.at + inner + 1, text, name) });
      if (m[3].trim()) s = name + ' ' + m[3].trim(); else continue;   // `struct X{...} x;` declares x too
    }
    if (/^enum\b/.test(s)) { enums.push({ text: s, line }); continue; }
    if (/^static\b/.test(s)) { if (!st.fn) statics.push({ text: s, line }); continue; }
    if (/^template\b/.test(s) || /^using\b/.test(s) || /^friend\b/.test(s)) continue;
    if (st.fn) continue;
    if (/^(\w+)\s*\(/.test(s) || /\boperator\b/.test(s)) continue;
    const ds = splitTop(s);
    const first = /^([\s\S]+?)\s*\b([A-Za-z_]\w*)\s*(\[[^\]]*\])?\s*(=[\s\S]*|\{[\s\S]*\})?$/.exec(ds[0]);
    if (!first) throw new Error('gen-seat: cannot read member ' + JSON.stringify(s) + ' at ' + line);
    const cppType = first[1].trim();
    const decls = [{ name: first[2], arr: first[3], init: first[4] }];
    for (const d of ds.slice(1)) {
      const dm = /^\*?\s*([A-Za-z_]\w*)\s*(\[[^\]]*\])?\s*(=[\s\S]*|\{[\s\S]*\})?$/.exec(d);
      if (!dm) throw new Error('gen-seat: cannot read declarator ' + JSON.stringify(d) + ' at ' + line);
      decls.push({ name: dm[1], arr: dm[2], init: dm[3] });
    }
    for (const d of decls) {
      let t = ty(cppType);
      if (d.arr) t = '[' + t + ';' + evalNum(d.arr.slice(1, -1)) + ']';
      const init = d.init === undefined ? undefined : d.init.replace(/^=\s*/, '').trim();
      fields.push({ name: d.name, type: t, cpp: (cppType + (d.arr || '')).replace(/\s+/g, ' '), init, line, owner });
    }
  }
  return { fields, nested, statics, enums };
}

// ---- read the structs ----------------------------------------------------------------------------------------
const text = stripComments(cpp);
const seatB = structBody(text, /^struct Seat \{/m);
const top = {};
for (const [name, re] of [['XPub', /^struct XPub\s*\{/m], ['DialBook', /^struct DialBook \{/m], ['CallBook', /^struct CallBook \{/m], ['Bucket', /^template<class T> struct Bucket \{/m]]) {
  const b = structBody(text, re);
  top[name] = members(b.body.replace(/\bT\b/g, 'double'), b.start, text, name);   // Bucket<T>: T stands in as f64; the type parameter is carried per use
}
localStructs = new Set();
const seat = members(seatB.body, seatB.start, text, 'Seat');

// ---- cross-check against msg.json's seat list (the state the sim hashes) --------------------------------------
const byName = new Map(seat.fields.map(f => [f.name, f]));
const stateBad = [];
const stateFields = require(path.join(__dirname, '..', '..', 'js', 'mesh', 'msg.js')).STATE_FIELDS;   // msg.json's seat list in JS type spelling (gen-msg.js)
if (stateFields.length !== msgSpec.seat.length) throw new Error('gen-seat: js/mesh/msg.js is stale: run gen-msg.js first');
for (const f of stateFields) { const g = byName.get(f.name); if (!g) stateBad.push(f.name + ' missing'); else if (g.type !== f.type) stateBad.push(f.name + ' ' + g.type + ' vs msg.json ' + f.type); }
if (stateBad.length) throw new Error('gen-seat: msg.json seat list disagrees: ' + stateBad.join('; '));

// ---- write the module ----------------------------------------------------------------------------------------
const O = []; const P = (s) => O.push(s);
// The default as a JSON literal (state.js makes a fresh value from it). A Bucket is [tok, at].
function defaultLit(f) {
  const v = initVal(f.type, f.init);
  if (!v) return null;
  if (v.fixed) { const n = +/;(\d+)\]$/.exec(f.type)[1]; const xs = JSON.parse(v.lit); while (xs.length < n) xs.push(0); return JSON.stringify(xs); }
  if (/^\{ pc/.test(v.lit)) return JSON.stringify(Function('return (' + v.lit + ')')());
  return v.lit;
}
const fieldRow = (f) => '[' + JSON.stringify(f.name) + ', ' + JSON.stringify(f.type) + ']';
const structTable = (list) => list.map(f => '      ' + fieldRow(f) + ',   // ' + f.cpp + (f.init !== undefined ? ' = ' + f.init.replace(/\s+/g, ' ') : '') + '  (line ' + f.line + ')').join('\n');

P('/*');
P(' * seat-fields.js: every data member of the sim\'s Seat, in declaration order, with its type and default;');
P(' * the member structs and the seat-held helper structs.');
P(' * GENERATED by test/mesh-port/gen-seat.js from mesh.cpp `struct Seat`: do not edit by hand.');
P(' *');
P(' * Types (msg.json notation): i32 i64 u8 u16 u32 u64 f64 bool str ptr; a struct name; {K:V} a Map;');
P(' * <K> a Set; [T] an Array (vector, deque); (A,B) a pair, held as a 2-array; [T;N] a fixed array.');
P(' * Defaults are JSON literals (a Bucket is [tok, at]); a field with none holds its type\'s zero.');
P(' * state.js builds, dumps and restores seats from these tables.');
P(' */');
P('(function (root) {');
P("  'use strict';");
P('  const GifOS = root.GifOS = root.GifOS || {};');
P("  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;");
P('');
P('  // The member structs of Seat and the helper structs it holds: [name, type] per field, in order.');
P('  const STRUCTS = {');
for (const [name, s] of Object.entries(top)) { P('    ' + name + ': [   // C++: mesh.cpp:' + name); P(structTable(s.fields)); P('    ],'); for (const n of s.nested) { P('    ' + n.name + ': [   // C++: mesh.cpp:' + name + '::' + n.name); P(structTable(n.fields)); P('    ],'); } }
for (const n of seat.nested) { P('    ' + n.name + ': [   // C++: mesh.cpp:Seat::' + n.name); P(structTable(n.fields)); P('    ],'); }
P('  };');
P('  // Defaults that differ from the type\'s zero, per struct field.');
P('  const STRUCT_DEF = {');
for (const s of [...Object.entries(top).flatMap(([n, s]) => [[n, s.fields], ...s.nested.map(x => [x.name, x.fields])]), ...seat.nested.map(x => [x.name, x.fields])]) {
  const defs = s[1].filter(f => initVal(f.type, f.init)).map(f => JSON.stringify(f.name) + ': ' + defaultLit(f));
  if (defs.length) P('    ' + s[0] + ': { ' + defs.join(', ') + ' },');
}
P('  };');
P('');
P('  // Every data member of Seat, in declaration order (C++: mesh.cpp:Seat).');
P('  const FIELDS = [');
for (const f of seat.fields) P('    ' + fieldRow(f) + ',   // ' + f.cpp + (f.init !== undefined ? ' = ' + f.init.replace(/\s+/g, ' ') : '') + '  (line ' + f.line + ')');
P('  ];');
P('');
P('  // Seat members with a default other than the type\'s zero.');
P('  const SEAT_DEF = {');
for (const f of seat.fields) { const v = initVal(f.type, f.init); if (v) P('    ' + f.name + ': ' + defaultLit(f) + ',' + (v.note ? '   // ' + v.note : '')); }
P('  };');
P('');
P('  // Static members (shared by every seat): C++ static const / constexpr inside struct Seat.');
P('  const STATICS = {');
for (const s of seat.statics) { const m = /static\s+(?:const|constexpr)\s+\w+\s+(\w+)\s*=\s*([^;]+)/.exec(s.text); if (m) P('    ' + m[1] + ': ' + evalNum(m[2]) + ',   // C++: mesh.cpp:Seat::' + m[1]); }
for (const e of seat.enums) { const m = /\{([^}]*)\}/.exec(e.text); let next = 0; const env = {}; for (const it of m[1].split(',')) { const im = /^\s*(\w+)\s*(?:=\s*(.+?))?\s*$/.exec(it); if (!im) continue; const v = im[2] !== undefined ? Function('env', 'with (env) { return (' + im[2] + '); }')(env) : next; env[im[1]] = v; next = v + 1; P('    ' + im[1] + ': ' + v + ',   // C++: mesh.cpp:Seat::' + im[1]); } }
P('  };');
P('');
P('  const api = Object.freeze({ STRUCTS, STRUCT_DEF, FIELDS, SEAT_DEF, STATICS });');
P('  GifOS.meshSeatFields = api;');
P('  if (isNode) module.exports = api;');
P("})(typeof window !== 'undefined' ? window : globalThis);");
const out = O.join('\n') + '\n';

const dest = path.join(__dirname, '..', '..', 'js', 'mesh', 'seat-fields.js');
const summary = seat.fields.length + ' seat fields, ' + seat.nested.length + ' member structs, ' + Object.keys(top).length + ' helper structs; msg.json seat list (' + msgSpec.seat.length + ') agrees';
const have = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
if (have === out) { console.log('same  ' + dest + ' (' + summary + ')'); process.exit(0); }
if (check) { console.log('STALE ' + dest); process.exit(1); }
fs.writeFileSync(dest, out);
console.log('wrote ' + dest + ' (' + summary + ')');
