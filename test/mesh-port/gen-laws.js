#!/usr/bin/env node
// gen-laws.js <gifos checkout> [--check]
// Writes js/mesh/laws.js with EVERY constant of the sim's laws.json (the port carries every law), in the
// exact form the gifos generator (scripts/gen-laws.mjs renderJs) writes. The gifos generator itself still
// leaves out the constants marked `port: "pending"`; once the sim clears those marks, both write the same file.
//   node test/mesh-port/gen-laws.js ../gifos            write the module
//   node test/mesh-port/gen-laws.js ../gifos --check    exit 1 if the module on disk is stale
'use strict';
const fs = require('fs'), path = require('path'), url = require('url');

(async () => {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const root = args.find(a => a !== '--check');
  if (!root) { console.error('usage: gen-laws.js <gifos checkout> [--check]'); process.exit(2); }
  const gen = await import(url.pathToFileURL(path.resolve(root, 'scripts', 'gen-laws.mjs')).href);
  const laws = gen.loadLaws(path.resolve(root, 'test', 'sim', 'laws.json'));
  const text = gen.renderJs(laws);   // byte for byte the gifos form (node: require it, then read globalThis.GifOS.meshLaws)
  const out = path.join(__dirname, '..', '..', 'js', 'mesh', 'laws.js');
  const have = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
  if (have === text) { console.log('same  ' + out + ' (' + Object.keys(laws).length + ' constants)'); return; }
  if (check) { console.log('STALE ' + out); process.exit(1); }
  fs.writeFileSync(out, text);
  console.log('wrote ' + out + ' (' + Object.keys(laws).length + ' constants)');
})();
