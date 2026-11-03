#!/usr/bin/env node
// check-cxx-refs.js <sim dir> [--cover <file>[@<from>@<to>] ...] [js files...]
// Every JS function in the port names the C++ it ports: a comment `// C++: <file>:<name>` (a Seat member is
// `mesh.cpp:Seat::name`). This checks each one against the sim tree (a `git archive` of the port's base):
// the file exists and <name> is declared there (a definition, a declaration with an initializer, a struct or
// an enum member). With --cover, every function defined in <file> (between the first line matching the
// regex <from> and the next matching <to>) must be named by some JS ref: nothing in the unit is unmapped.
// Default JS files: js/mesh/*.js. Exit 1 on any bad ref or unmapped function.
'use strict';
const fs = require('fs'), path = require('path');

const argv = process.argv.slice(2);
const sim = argv.shift();
if (!sim) { console.error('usage: check-cxx-refs.js <sim dir> [--cover file[@from@to]] [js files...]'); process.exit(2); }
const covers = [], jsFiles = [];
for (let i = 0; i < argv.length; i++) { if (argv[i] === '--cover') covers.push(argv[++i]); else jsFiles.push(argv[i]); }
const meshDir = path.join(__dirname, '..', '..', 'js', 'mesh');
if (!jsFiles.length) for (const f of fs.readdirSync(meshDir).sort()) if (f.endsWith('.js')) jsFiles.push(path.join(meshDir, f));

const srcCache = new Map();
function src(file) {
  if (!srcCache.has(file)) { const p = path.join(sim, file); srcCache.set(file, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null); }
  return srcCache.get(file);
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// declared: name( ... | name= | name{ | name; | name, | name[ | struct name | enum name | `}` name (a struct type)
function declared(text, name) {
  const n = esc(name);
  return new RegExp('(?:\\b(?:struct|enum|class)\\s+' + n + '\\b)|(?:\\b' + n + '\\s*(?:\\(|=(?!=)|\\{|\\}|;|,|\\[|:(?!:)))').test(text);
}

const refs = [];   // {js, line, file, name}
let bad = 0;
for (const f of jsFiles) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
    for (const m of l.matchAll(/C\+\+:\s*([\w.]+):((?:\w+::)*\w+)/g)) refs.push({ js: path.relative(process.cwd(), f), line: i + 1, file: m[1], name: m[2] });
  });
}
for (const r of refs) {
  const text = src(r.file);
  const parts = r.name.split('::'), name = parts[parts.length - 1];
  let ok = text !== null && declared(text, name);
  if (ok && parts.length > 1 && parts[0] === 'Seat') ok = /\bstruct Seat\s*\{/.test(text) || new RegExp('\\bSeat::' + esc(name) + '\\b').test(text);
  if (!ok) { bad++; console.log('BAD  ' + r.js + ':' + r.line + '  C++: ' + r.file + ':' + r.name + (text === null ? '  (no such file)' : '  (not declared there)')); }
}
const named = new Set(refs.map(r => r.file + ':' + r.name.split('::').pop()));
let unmapped = 0;
for (const c of covers) {
  const [file, from, to] = c.split('@');
  let text = src(file); if (text === null) { console.log('BAD  --cover ' + file + ': no such file'); bad++; continue; }
  if (from) { const lines = text.split('\n'); const a = lines.findIndex(l => new RegExp(from).test(l)); const b = to ? lines.findIndex((l, i) => i > a && new RegExp(to).test(l)) : lines.length; text = lines.slice(a, b < 0 ? lines.length : b).join('\n'); }
  const defs = new Set();
  for (const m of text.matchAll(/^\s*(?:template<[^>]*>\s*)?static\s+(?:inline\s+)?(?:const\s+)?[\w:<>,\s*&]+?\b(\w+)\s*\([^;]*?\)\s*(?:const\s*)?\{/gm)) defs.add(m[1]);
  for (const d of defs) if (!named.has(file + ':' + d)) { unmapped++; console.log('UNMAPPED ' + file + ':' + d); }
  console.log('cover ' + file + (from ? ' [' + from + ' .. ' + (to || 'end') + ']' : '') + ': ' + defs.size + ' functions, ' + [...defs].filter(d => named.has(file + ':' + d)).length + ' mapped');
}
console.log(refs.length + ' refs in ' + jsFiles.length + ' files, ' + bad + ' bad, ' + unmapped + ' unmapped');
process.exit(bad || unmapped ? 1 : 0);
