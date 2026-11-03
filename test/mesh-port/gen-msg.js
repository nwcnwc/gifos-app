#!/usr/bin/env node
// gen-msg.js <spec.json> [out.js]
// Turns the message spec (field names, types, defaults, order) into js/mesh/msg.js:
// plain JS factories, a sparse writer and a reader for every message struct.
// Default output: js/mesh/msg.js next to this repo's mesh code.
//   node test/mesh-port/gen-msg.js <spec.json>        write the module
//   node test/mesh-port/gen-msg.js <spec.json> --check   fail if the module on disk is stale
'use strict';
const fs = require('fs'), path = require('path');

const args = process.argv.slice(2);
const check = args.includes('--check');
const pos = args.filter(a => a !== '--check');
if (!pos[0]) { console.error('usage: gen-msg.js <spec.json> [out.js] [--check]'); process.exit(2); }
const spec = JSON.parse(fs.readFileSync(pos[0], 'utf8'));
const out = pos[1] || path.join(__dirname, '..', '..', 'js', 'mesh', 'msg.js');

const SCALAR = new Set(['i32', 'i64', 'u8', 'u16', 'u32', 'u64', 'h64', 'bool', 'f64']);
const MT = new Set(spec.MT);
const sparse = new Set(spec.sparse);
const STRUCTS = Object.keys(spec.structs);
const H64_ZERO = '0x0000000000000000';

function isArr(ty) { return ty.startsWith('[') && ty.endsWith(']'); }
function elem(ty) { return ty.slice(1, -1); }
function known(ty) { return SCALAR.has(ty) || ty === 'MT' || ty === 'Msg' || spec.structs[ty] || (isArr(ty) && known(elem(ty))); }
for (const [n, fs_] of [...Object.entries(spec.structs), ['Msg', spec.msg]])
  for (const f of fs_) if (!known(f.type)) throw new Error('unknown type ' + f.type + ' in ' + n + '.' + f.name);

// The JS literal of a field's default, as a fresh value each call (arrays, structs).
function defExpr(f) {
  const ty = f.type, d = f.default;
  if (isArr(ty)) return '[]';
  if (ty === 'h64') return JSON.stringify(H64_ZERO);
  if (spec.structs[ty]) return 'new' + ty + '()';
  if (ty === 'Msg') return 'null';
  return JSON.stringify(d);
}

// Expression that writes value x of type ty to its JSON form.
function wrExpr(ty, x) {
  if (isArr(ty)) { const e = elem(ty); return SCALAR.has(e) ? x + '.slice()' : x + '.map(write' + e + ')'; }
  if (spec.structs[ty]) return 'write' + ty + '(' + x + ')';
  if (ty === 'Msg') return 'writeMsg(' + x + ')';
  return x;
}
function rdExpr(ty, x) {
  if (isArr(ty)) { const e = elem(ty); return SCALAR.has(e) ? x + '.slice()' : x + '.map(read' + e + ')'; }
  if (spec.structs[ty]) return 'read' + ty + '(' + x + ')';
  if (ty === 'MT') return 'checkMT(' + x + ')';
  return x;
}

const L = [];
const P = s => L.push(s);
P('/*');
P(' * msg.js: the mesh message: type names, field defaults, and the sparse JSON form.');
P(' * GENERATED from the message spec: do not edit by hand.');
P(' *');
P(' * A message is a plain object. Its first field is `t`, the type name (a string');
P(' * from MT_NAMES). Fields hold their default until set. Writing is sparse: `t`');
P(' * first, then only the fields that differ from their default, in field order');
P(' * (the same bytes JSON.stringify gives for the parsed form). Reading fills the');
P(' * defaults back in and rejects unknown fields and unknown type names.');
P(' *');
P(' * Numbers are JS numbers. Every hash, key and token is 32-bit, and every');
P(' * 64-bit field (u64) is a cell key or a tick, always below 2^53.');
P(' */');
P('(function (root) {');
P("  'use strict';");
P('  const GifOS = root.GifOS = root.GifOS || {};');
P('');
P('  const MT_NAMES = Object.freeze(' + JSON.stringify(spec.MT) + ');');
P('  const MT = Object.freeze(Object.fromEntries(MT_NAMES.map(n => [n, n])));');
P('  const MT_SET = new Set(MT_NAMES);');
P('  function checkMT(t) { if (!MT_SET.has(t)) throw new Error("msg: unknown type " + t); return t; }');
P('  function rejectUnknown(o, names, what) {');
P('    for (const k of Object.keys(o)) if (!names.has(k)) throw new Error("msg: " + what + " has unknown field " + k);');
P('  }');
P('');
for (const n of STRUCTS) {
  const fl = spec.structs[n];
  P('  // ' + n + (sparse.has(n) ? ' (written sparse)' : ' (written whole)'));
  P('  const ' + n + '_FIELDS = new Set(' + JSON.stringify(fl.map(f => f.name)) + ');');
  P('  function new' + n + '() { return { ' + fl.map(f => f.name + ': ' + defExpr(f)).join(', ') + ' }; }');
  if (sparse.has(n)) {
    P('  const ' + n + '_DEF = {};');
    P('  function write' + n + '(x) {');
    P('    const o = {};');
    for (const f of fl) {
      const w = wrExpr(f.type, 'x.' + f.name);
      if (SCALAR.has(f.type)) P('    if (x.' + f.name + ' !== ' + defExpr(f) + ') o.' + f.name + ' = x.' + f.name + ';');
      else if (isArr(f.type)) P('    if (x.' + f.name + '.length) o.' + f.name + ' = ' + w + ';');
      else P('    { const v = ' + w + '; if (JSON.stringify(v) !== ' + n + '_DEF.' + f.name + ') o.' + f.name + ' = v; }');
    }
    P('    return o;');
    P('  }');
  } else {
    P('  function write' + n + '(x) { return { ' + fl.map(f => f.name + ': ' + wrExpr(f.type, 'x.' + f.name)).join(', ') + ' }; }');
  }
  P('  function read' + n + '(o) {');
  P('    rejectUnknown(o, ' + n + '_FIELDS, "' + n + '");');
  P('    const x = new' + n + '();');
  for (const f of fl) P('    if (o.' + f.name + ' !== undefined) x.' + f.name + ' = ' + rdExpr(f.type, 'o.' + f.name) + ';');
  P('    return x;');
  P('  }');
  P('');
}
// Sparse structs compare nested struct fields against the written default.
const defInit = [];
for (const n of STRUCTS) if (sparse.has(n))
  for (const f of spec.structs[n]) if (!SCALAR.has(f.type) && !isArr(f.type))
    defInit.push('  ' + n + '_DEF.' + f.name + ' = JSON.stringify(' + wrExpr(f.type, defExpr(f)) + ');');
if (defInit.length) { P('  // the written form of each nested default, computed once'); defInit.forEach(P); P(''); }

const mf = spec.msg.slice(1);
P('  // Msg');
P('  const Msg_FIELDS = new Set(["t", ' + mf.map(f => JSON.stringify(f.name)).join(', ') + ']);');
P('  const Msg_DEF = {};');
P('  function newMsg(t) {');
P('    return { t: checkMT(t), ' + mf.map(f => f.name + ': ' + defExpr(f)).join(', ') + ' };');
P('  }');
P('  function writeMsg(m) {');
P('    const o = { t: m.t };');
for (const f of mf) {
  const w = wrExpr(f.type, 'm.' + f.name);
  if (SCALAR.has(f.type)) P('    if (m.' + f.name + ' !== ' + defExpr(f) + ') o.' + f.name + ' = m.' + f.name + ';');
  else if (isArr(f.type)) P('    if (m.' + f.name + '.length) o.' + f.name + ' = ' + w + ';');
  else P('    { const v = ' + w + '; if (JSON.stringify(v) !== Msg_DEF.' + f.name + ') o.' + f.name + ' = v; }');
}
P('    return o;');
P('  }');
P('  function readMsg(o) {');
P('    rejectUnknown(o, Msg_FIELDS, "Msg");');
P('    const m = newMsg(o.t);');
for (const f of mf) P('    if (o.' + f.name + ' !== undefined) m.' + f.name + ' = ' + rdExpr(f.type, 'o.' + f.name) + ';');
P('    return m;');
P('  }');
for (const f of mf) if (!SCALAR.has(f.type) && !isArr(f.type) && f.type !== 'Msg')
  P('  Msg_DEF.' + f.name + ' = JSON.stringify(' + wrExpr(f.type, defExpr(f)) + ');');
P('  function encode(m) { return JSON.stringify(writeMsg(m)); }');
P('  function decode(s) { return readMsg(JSON.parse(s)); }');
P('  function clone(m) { return readMsg(writeMsg(m)); }');
P('');
P('  // the state fields the per-tick state hash covers, in order');
// msg.json writes seat types in C++ spelling (Seat::X, T[N] with N a number or a laws constant); the JS field
// tables (seat-fields.js) write X and [T;N]. Same type, JS spelling.
const ARRN = { L10_STATE_CLASSES: 7 };   // the one named array bound in the seat list (mesh.cpp L10_STATE_CLASSES)
function jsType(t) {
  t = t.replace(/\b(?:Seat|DialBook)::/g, '');
  return t.replace(/([A-Za-z_][A-Za-z0-9_<>]*)\[([A-Za-z0-9_]+)\]/g, (_, el, n) => '[' + el + ';' + (/^\d+$/.test(n) ? n : ARRN[n]) + ']');
}
P('  const STATE_FIELDS = Object.freeze(' + JSON.stringify((spec.seat || []).map(f => ({ name: f.name, type: jsType(f.type) }))) + ');');
P('');
P('  const api = Object.freeze({');
P('    MT, MT_NAMES, STATE_FIELDS,');
P('    newMsg, writeMsg, readMsg, encode, decode, clone,');
P('    ' + STRUCTS.map(n => 'new' + n + ', write' + n + ', read' + n).join(',\n    '));
P('  });');
P('  GifOS.meshMsg = api;');
P("  if (typeof module !== 'undefined' && module.exports) module.exports = api;");
P("})(typeof window !== 'undefined' ? window : globalThis);");
const text = L.join('\n') + '\n';

if (check) {
  const have = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (have !== text) { console.error('STALE ' + out); process.exit(1); }
  console.log('msg.js is current');
} else {
  fs.writeFileSync(out, text);
  console.log('wrote ' + out + ' (' + text.length + ' bytes, ' + spec.msg.length + ' fields, ' + spec.MT.length + ' types)');
}
