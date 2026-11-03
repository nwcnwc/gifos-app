#!/usr/bin/env node
// gen-consts.js <sim dir> [--check]
// Writes js/mesh/consts.js: every file-scope scalar the sim declares with an initializer, in mesh.cpp and the
// .inc files it includes (source order), as two tables:
//   consts   `static const` / `static constexpr`: frozen (a LAW_X initializer reads laws.js)
//   levers   plain `static`: the sim's globals a stream op may set (levers, mode switches); their C++ defaults.
//            The harness sets them; a page keeps the defaults.
// Measurement counters (a `static long long X=0` nobody reads in a decision) land in levers too: a port keeps
// the C++ globals one for one and decides nothing here.
//   node test/mesh-port/gen-consts.js <gifos>/test/sim            write the module
//   node test/mesh-port/gen-consts.js <gifos>/test/sim --check    exit 1 if the module on disk is stale
'use strict';
const fs = require('fs'), path = require('path');

const args = process.argv.slice(2);
const check = args.includes('--check');
const dir = args.find(a => a !== '--check');
if (!dir) { console.error('usage: gen-consts.js <sim dir> [--check]'); process.exit(2); }

// The source in compile order: mesh.cpp with each local #include "x.inc" spliced in where it stands.
function files(file, seen = new Set()) {
  if (seen.has(file)) return [];
  seen.add(file);
  const out = [];
  const text = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
  text.forEach((line, i) => {
    out.push({ file, line: i + 1, text: line });
    const m = /^\s*#include "([^"]+\.inc)"/.exec(line);
    if (m && fs.existsSync(path.join(dir, m[1]))) out.push(...files(m[1], seen));
  });
  return out;
}
const lines = files('mesh.cpp');
const LAWS = (() => { const j = JSON.parse(fs.readFileSync(path.join(dir, 'laws.json'), 'utf8')).laws; return j; })();
const C = 5;

const SCALAR = '(?:unsigned |signed )?(?:bool|int|long long|unsigned long long|double|float|uint8_t|uint16_t|uint32_t|uint64_t|int64_t|size_t|unsigned)';
const DECL = new RegExp('^\\s*static\\s+(thread_local\\s+)?(const\\s+|constexpr\\s+|inline\\s+)*(' + SCALAR + ')\\s+(.*)$');

// Split a declarator list at top-level commas, stopping at the ';' that ends it.
function declarators(s) {
  let depth = 0, cur = '', out = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '/' && (s[i + 1] === '/' || s[i + 1] === '*')) break;
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    if (ch === ')' || ch === '}' || ch === ']') depth--;
    if (depth === 0 && ch === ',') { out.push(cur); cur = ''; continue; }
    if (depth === 0 && ch === ';') { out.push(cur); return out; }
    cur += ch;
  }
  return null;   // no ';' on this line: not a plain declaration
}

const env = {};       // name -> value, as declared so far (C++ reads earlier names)
const entries = [];   // {name, value, isConst, type, file, line}
const skipped = [];
const enums = [];      // {name, value, file, group}
// The statements of one source line: top-level ';' splits, comments dropped, a `namespace x {` opener ignored.
function statements(text) {
  const t = text.replace(/\/\*.*?\*\//g, ' ').replace(/^\s*namespace\s+\w+\s*\{/, '');
  const out = []; let depth = 0, cur = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '/' && t[i + 1] === '/') break;
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    if (ch === ')' || ch === '}' || ch === ']') depth--;
    cur += ch;
    if (depth === 0 && ch === ';') { out.push(cur.trim()); cur = ''; }
  }
  return out;
}

for (const L0 of lines) for (const st of statements(L0.text)) {
  const L = { file: L0.file, line: L0.line, text: st };
  const en = /^(?:static\s+)?enum\s*(\w+)?\s*(?::\s*\w+)?\s*\{([^}]*)\}/.exec(L.text);
  if (en && en[1] !== 'MT') {   // MT: msg.js names the frame types
    let next = 0;
    for (const item of en[2].split(',')) {
      const im = /^\s*([A-Za-z_]\w*)\s*(?:=\s*(.+?))?\s*$/s.exec(item); if (!im) continue;
      let v = next;
      if (im[2] !== undefined) {
        try { v = Function('env', 'with (env) { return (' + im[2] + '); }')(env); } catch (e) { skipped.push(L.file + ':' + L.line + ' enum ' + im[1] + ' = ' + im[2]); continue; }
      }
      enums.push({ name: im[1], value: v, file: L.file, group: en[1] || '' }); env[im[1]] = v; next = v + 1;
    }
    continue;
  }
  const m = DECL.exec(L.text);
  if (!m) continue;
  const isConst = /const|constexpr/.test(m[2] || '');
  const type = m[3];
  const rest = m[4];
  if (/^[A-Za-z_]\w*\s*\(/.test(rest)) continue;   // a function
  const ds = declarators(rest);
  if (!ds) continue;
  for (const d0 of ds) {
    const d = d0.trim();
    const dm = /^([A-Za-z_]\w*)\s*(?:=\s*(.+))?$/s.exec(d);
    if (!dm) { skipped.push(L.file + ':' + L.line + ' ' + d); continue; }   // arrays, struct initializers
    const name = dm[1];
    if (dm[2] === undefined) { if (!isConst) { entries.push({ name, value: 0, isConst, type, file: L.file, line: L.line }); env[name] = 0; } continue; }
    let expr = dm[2].trim();
    // C++ literals and names to JS
    let js = expr
      .replace(/\b(\d+)(?:ull|ULL|ll|LL|u|U|l|L)\b/g, '$1')
      .replace(/\b(0x[0-9a-fA-F]+)(?:ull|ULL|ll|LL|u|U|l|L)\b/g, '$1')
      .replace(/\(\s*(?:long long|int|uint32_t|uint64_t|size_t|double)\s*\)/g, '')
      .replace(/\bLAW_([A-Z0-9_]+?)_PER_C\b/g, (_, n) => 'LAWS.' + n + '.perC')
      .replace(/\bLAW_([A-Z0-9_]+)\b/g, (_, n) => 'LAWS.' + n + '.value');
    let value;
    try {
      // eslint-disable-next-line no-new-func
      value = Function('LAWS', 'C', 'env', 'with (env) { return (' + js + '); }')(LAWS, C, env);
    } catch (e) { skipped.push(L.file + ':' + L.line + ' ' + name + ' = ' + expr); continue; }
    if (typeof value === 'boolean') { /* keep */ }
    else if (typeof value !== 'number' || !Number.isFinite(value)) { skipped.push(L.file + ':' + L.line + ' ' + name + ' = ' + expr); continue; }
    else if (/int|long|size_t|unsigned/.test(type) && !/double|float/.test(type)) value = Math.trunc(value);
    if (/^uint32_t|^unsigned$/.test(type)) value = value >>> 0;
    entries.push({ name, value, isConst, type, file: L.file, line: L.line, expr: expr.replace(/\s+/g, ' ') });
    env[name] = value;
  }
}

// One entry per name: the C++ allows a name once per scope; a second declaration (another namespace) is reported.
const byName = new Map();
const dups = [];
for (const e of entries) { if (byName.has(e.name)) dups.push(e.name); else byName.set(e.name, e); }

const OUT = [];
const P = (x) => OUT.push(x);
P('/*');
P(' * consts.js: the sim\'s file-scope constants and globals, one for one (C++ name, C++ default).');
P(' * GENERATED by test/mesh-port/gen-consts.js from the sim source: do not edit by hand.');
P(' *');
P(' *   consts  `static const` / `constexpr` scalars: frozen. A law constant reads laws.js.');
P(' *   levers  plain `static` scalars: globals a stream op sets (levers, modes) and measurement');
P(' *           counters. Shared by every seat, as the C++ globals are. The harness sets them;');
P(' *           a page keeps the defaults.');
P(' *   enums   the C++ enum names (MT aside: msg.js names the frame types).');
P(' */');
P('(function (root) {');
P("  'use strict';");
P('  const GifOS = root.GifOS = root.GifOS || {};');
P('');
P('  const consts = Object.freeze({');
for (const e of byName.values()) if (e.isConst) P('    ' + e.name + ': ' + JSON.stringify(e.value) + ',   // C++: ' + e.file + ':' + e.name + (e.expr && e.expr !== String(e.value) ? '  (' + e.expr.replace(/\*\//g, '* /') + ')' : ''));
P('  });');
P('');
P('  // Mutable: the harness writes these before (or during) a run.');
P('  const levers = {');
for (const e of byName.values()) if (!e.isConst) P('    ' + e.name + ': ' + JSON.stringify(e.value) + ',   // C++: ' + e.file + ':' + e.name);
P('  };');
P('');
P('  // The C++ enums (MT aside: msg.js names the frame types).');
P('  const enums = Object.freeze({');
for (const e of enums) P('    ' + e.name + ': ' + JSON.stringify(e.value) + ',   // C++: ' + e.file + ':' + e.name);
P('  });');
P('');
P('  const api = { consts, levers, enums };');
P('  GifOS.meshConsts = api;');
P("  if (typeof module !== 'undefined' && module.exports) module.exports = api;");
P("})(typeof window !== 'undefined' ? window : globalThis);");
const text = OUT.join('\n') + '\n';

const out = path.join(__dirname, '..', '..', 'js', 'mesh', 'consts.js');
const nC = [...byName.values()].filter(e => e.isConst).length, nL = byName.size - nC;
const summary = nC + ' consts, ' + nL + ' levers, ' + enums.length + ' enum names' + (dups.length ? ', duplicate names kept first: ' + dups.join(' ') : '') + ', not scalar (skipped): ' + skipped.length;
const have = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
if (process.env.GEN_CONSTS_SKIPPED) for (const s of skipped) console.log('skip ' + s);
if (have === text) { console.log('same  ' + out + ' (' + summary + ')'); process.exit(0); }
if (check) { console.log('STALE ' + out); process.exit(1); }
fs.writeFileSync(out, text);
console.log('wrote ' + out + ' (' + summary + ')');
