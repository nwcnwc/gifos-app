#!/usr/bin/env node
// ondevice-files.mjs: the on-device captions files, from their published
// upstream archives to what GifOS serves.
//
//   node .github/scripts/ondevice-files.mjs fetch <work-dir>
//       Downloads each upstream archive named in js/ondevice/models.json once
//       into <work-dir>, extracts the pinned members, checks every one against
//       its SHA-256, and leaves the files for the model host at
//       <work-dir>/out/<key> (the key the page fetches). Prints one line per
//       file: key sha256 bytes content-type.
//   node .github/scripts/ondevice-files.mjs runtime <work-dir>
//       As fetch, then writes the two runtime loaders and the recognizer API
//       into js/ondevice/: the upstream loader with its bundled data-package
//       load taken out (the page gives the runtime its model files itself),
//       and the API file as published. The upstream bytes are checked first.
//   node .github/scripts/ondevice-files.mjs list
//       Prints key sha256 bytes content-type src member, one file per line,
//       without downloading (what r2-models.sh reads).
//
// Needs node 18+, tar and bzip2.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(APP, 'js', 'ondevice');
const M = JSON.parse(fs.readFileSync(path.join(DIR, 'models.json'), 'utf8'));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const die = (m) => { console.error('::error::' + m); process.exit(1); };

// Every file the model host serves, with where it comes from.
export function files() {
  const out = [];
  for (const [, rt] of Object.entries(M.runtimes)) {
    const w = rt.wasm;
    out.push({ key: w.key, sha256: w.sha256, bytes: w.bytes, type: w.contentType || 'application/octet-stream', src: w.src, member: w.member });
  }
  for (const [id, m] of Object.entries(M.models)) {
    for (const f of m.files) out.push({ key: id + '/' + f.sha256 + '/' + f.name, sha256: f.sha256, bytes: f.bytes, type: 'application/octet-stream', src: m.src, member: f.member });
  }
  return out;
}

function archive(work, url) {
  const file = path.join(work, 'src', sha(url).slice(0, 24) + '.tar.bz2');
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    console.error('# downloading ' + url);
    execFileSync('curl', ['-fsSL', '--retry', '3', '-o', file + '.part', url], { stdio: 'inherit' });
    fs.renameSync(file + '.part', file);
  }
  return file;
}

function member(work, url, name) {
  const dir = path.join(work, 'x', sha(url).slice(0, 24));
  // Some archives name their members './x/…', some 'x/…': unpack the whole
  // archive once and read the member by its path either way.
  if (!fs.existsSync(path.join(dir, '.unpacked'))) {
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('tar', ['-xjf', archive(work, url), '-C', dir], { stdio: 'inherit' });
    fs.writeFileSync(path.join(dir, '.unpacked'), '');
  }
  return fs.readFileSync(path.join(dir, name.replace(/^\.\//, '')));
}

function fetchAll(work) {
  for (const f of files()) {
    const b = member(work, f.src, f.member);
    if (sha(b) !== f.sha256 || b.length !== f.bytes) die(f.key + ': upstream bytes do not match the pin');
    const out = path.join(work, 'out', f.key);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, b);
    console.log([f.key, f.sha256, f.bytes, f.type].join(' '));
  }
}

// The loader's bundled data package (an example model) is one call; without
// it the runtime starts empty and waits for the page's files.
const PACKAGE_CALL = /loadPackage\(\{"?files"?:\[[^\]]*\],"?remote_package_size"?:\d+\}\)/g;
export function patchLoader(src) {
  const hits = src.match(PACKAGE_CALL) || [];
  if (hits.length !== 1) throw new Error('expected one data-package load, found ' + hits.length);
  return '// sherpa-onnx WebAssembly loader (Apache-2.0, https://github.com/k2-fsa/sherpa-onnx), its bundled data-package load removed.\n' + src.replace(PACKAGE_CALL, 'void 0');
}

function runtime(work) {
  fetchAll(work);
  let apiDone = false;
  for (const [, rt] of Object.entries(M.runtimes)) {
    const up = member(work, rt.wasm.src, rt.upstreamJs.member);
    if (sha(up) !== rt.upstreamJs.sha256) die(rt.js + ': upstream loader does not match its pin');
    fs.writeFileSync(path.join(DIR, rt.js), patchLoader(up.toString('utf8')));
    console.error('# wrote js/ondevice/' + rt.js);
    if (!apiDone) {
      const api = member(work, rt.wasm.src, path.posix.join(path.posix.dirname(rt.upstreamJs.member), M.api.js));
      if (sha(api) !== M.api.sha256) die(M.api.js + ': upstream API does not match its pin');
      fs.writeFileSync(path.join(DIR, M.api.js), api);
      apiDone = true;
    }
  }
}

const [mode, work] = process.argv.slice(2);
if (import.meta.url === 'file://' + process.argv[1]) {
  if (mode === 'list') for (const f of files()) console.log([f.key, f.sha256, f.bytes, f.type, f.src, f.member].join(' '));
  else if (mode === 'fetch' && work) fetchAll(path.resolve(work));
  else if (mode === 'runtime' && work) runtime(path.resolve(work));
  else { console.error('usage: ondevice-files.mjs fetch|runtime <work-dir> | list'); process.exit(2); }
}
