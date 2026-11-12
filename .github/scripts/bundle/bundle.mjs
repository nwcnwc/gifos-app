// Build the meeting page's script bundle.
//
//   node .github/scripts/bundle/bundle.mjs <site dir> [--sw]
//
// run.html loads about a hundred small scripts with `defer`. On a phone, fetching and compiling them one by one
// costs seconds before the lobby shows, so a published copy of the site loads them as ONE minified file instead:
// js/run.bundle.js, with a source map beside it. The files in the repo stay as they are (development and tests use
// them directly); this runs on a staged copy only: at deploy (dist/) and when a release snapshot is cut
// (versions/<x.y.z>/).
//
// The bundle keeps what the separate files had:
//  - the same order. All of them are deferred, so they ran in page order after parsing; the bundle is one deferred
//    script and runs them in that order at the same point.
//  - the same globals. Each file is minified on its own (no names are shared or renamed across files), and every
//    file is checked to declare nothing at its top level (each is a closure that writes its globals explicitly).
//  - the same isolation. A file that throws stops only itself: each one runs in its own try block and its error is
//    reported to the page as a normal error event.
//  - document.currentScript. The bundle sits in js/ beside the files, so a file that resolves paths from its own
//    address still finds them.
//
// Debugging: a page opened with ?unbundled=1 (or #unbundled=1) loads every file on its own instead, so the browser
// shows the real file names; the source map does the same for the bundle.
//
// --sw also lists the bundle in sw.js's offline shell, so a computer that has the shell can open a meeting offline.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const acorn = require('acorn');

const args = process.argv.slice(2);
const SITE = path.resolve(args.find((a) => !a.startsWith('--')) || '.');
const PAGE = 'run.html';
const NAME = 'run.bundle.js';
// The minifier must not write newer syntax than the source files use (ES2017): shorter forms it likes, such as
// ?. ?? ||= and catch without a binding, would quietly raise the browser floor in browser-support.json.
const TARGET = 'es2017';
const TAG = /<script src="(js\/[A-Za-z0-9_\-/.]+\.js)" defer><\/script>/g;

const pagePath = path.join(SITE, PAGE);
const html = fs.readFileSync(pagePath, 'utf8');
if (html.includes('js/' + NAME)) throw new Error(PAGE + ' is already bundled');
const files = [...html.matchAll(TAG)].map((m) => m[1]);
if (files.length < 2) throw new Error('no deferred scripts found in ' + PAGE);

// A file may be joined only if it declares nothing at its top level and is not a strict-mode file: inside the
// bundle a top-level let/const/class/function would change scope and a 'use strict' prologue would stop being one.
function check(file, src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' });
  const bad = [];
  for (const s of ast.body) {
    if (s.directive === 'use strict') bad.push("a top-level 'use strict'");
    else if (s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') bad.push('top-level ' + s.type + ' ' + s.id.name);
    else if (s.type === 'VariableDeclaration' && s.kind !== 'var') bad.push('top-level ' + s.kind);
  }
  if (bad.length) throw new Error(file + ' cannot be bundled: ' + bad.join(', ') + '. Wrap the file in a closure.');
}

let out = 'if(!self.__gifosUnbundled){\n';
let line = 1;
const sections = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(SITE, f), 'utf8');
  check(f, src);
  const r = esbuild.transformSync(src, { loader: 'js', minify: true, sourcemap: 'external', sourcefile: path.posix.relative('js', f), target: TARGET, legalComments: 'none' });
  const map = JSON.parse(r.map);
  delete map.sourcesContent;   // the source files are published beside the bundle
  // A raw control character inside a string is legal JavaScript but invisible to text tools: write it as an escape.
  const code = r.code.replace(/\n+$/, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  out += 'try{\n';
  line += 1;
  sections.push({ offset: { line, column: 0 }, map });
  out += code + '\n}catch(e){self.reportError?reportError(e):setTimeout(function(){throw e})}\n';
  line += code.split('\n').length + 1;
}
out += '}\n//# sourceMappingURL=' + NAME + '.map\n';
fs.writeFileSync(path.join(SITE, 'js', NAME), out);
fs.writeFileSync(path.join(SITE, 'js', NAME + '.map'), JSON.stringify({ version: 3, file: NAME, sections }));

// The page: the first deferred tag becomes the debug switch and the bundle; the others go.
// (The tag text is split so nothing that scans the page for script tags mistakes the string for one.)
const loader = '<script>/* ?unbundled=1 loads each script on its own (debugging); the bundle below then does nothing */' +
  '(function(){try{if(!/[?&#]unbundled=1(&|$)/.test(location.href))return;self.__gifosUnbundled=1;var l=' + JSON.stringify(files) +
  ';for(var i=0;i<l.length;i++)document.write(\'<scr\'+\'ipt src="\'+l[i]+\'" defer></scr\'+\'ipt>\');}catch(e){}})();</script>\n' +
  '<script src="js/' + NAME + '" defer></script>';
let first = true;
fs.writeFileSync(pagePath, html.replace(TAG, () => { if (first) { first = false; return loader; } return ''; }));

if (args.includes('--sw')) {
  const swPath = path.join(SITE, 'sw.js');
  const sw = fs.readFileSync(swPath, 'utf8');
  const at = "'/run.html',";
  if (!sw.includes(at)) throw new Error('sw.js: the offline shell does not list /run.html');
  fs.writeFileSync(swPath, sw.replace(at, at + " '/js/" + NAME + "',"));
}
console.log(`${PAGE}: ${files.length} scripts -> js/${NAME} (${out.length} bytes)`);
