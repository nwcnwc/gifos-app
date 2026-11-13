// Build the published meeting page: its scripts bundled and minified.
//
//   node .github/scripts/bundle/bundle.mjs <site dir> [--sw] [--keep-inline]
//
// run.html loads about a hundred small scripts with `defer`, and most of the page itself is inline script. On a
// phone on a slow link the lobby waited on all of it. A published copy of the site therefore ships:
//  - js/run.bundle.js: every deferred script, joined and minified, in page order. A visit with a room in its address
//    (a meeting link, an app) loads just this, with the page.
//  - js/run.lobby.js: the scripts the lobby needs (run.html lists them first), joined and minified. A bare visit
//    (/meet: run.html with no room in its address) loads this with the page, and run.bundle.js right after the
//    lobby has started; the bundle then skips the scripts the lobby bundle already ran. "Start a call" opens the
//    meeting's address, which finds run.bundle.js already in the cache.
//  - run.html's own inline scripts minified in place (unless --keep-inline).
// Each file gets a source map. The files in the repo stay as they are (development and tests use them directly);
// this runs on a staged copy only: at deploy (dist/) and when a release snapshot is cut (versions/<x.y.z>/).
//
// The bundles keep what the separate files had:
//  - the same order. All of them are deferred, so they ran in page order after parsing; the bundle runs them in
//    page order, all in one go. The lobby's scripts come first in run.html, so lobby bundle + bundle is page order too.
//  - the same globals. Each file is minified on its own (no names are shared or renamed across files), and every
//    file is checked to declare nothing at its top level (each is a closure that writes its globals explicitly).
//    Inline scripts keep their top-level names (a classic script's top level is never renamed).
//  - the same isolation. A file that throws stops only itself: each runs in its own try block and its error is
//    reported to the page as a normal error event.
//  - document.currentScript. The bundles sit in js/ beside the files, so a file that resolves paths from its own
//    address still finds them.
//  - the browser floor. A file written in ES5 (the preflight, which must run on browsers too old to meet) stays
//    ES5; everything else is never written in newer syntax than ES2017, the language the files use.
//  - the load-completeness gate. Both bundles are this site's own scripts, so a failed one is a missing unit and
//    is loaded again (a script that already ran is never run twice); on a bare visit the gate holds any join until
//    the bundle has run (__gifosLoadGate.pending).
//
// There is one published page path: the bundles (no unbundled switch since 2026-11-13; the loader's comment lists the bundled
// files, in page order, for the gate's page checks: gifos test/gate2/node/lib/page-scripts.js).
// --sw also lists both bundles in sw.js's offline shell.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const acorn = require('acorn');

const args = process.argv.slice(2);
const SITE = path.resolve(args.find((a) => !a.startsWith('--')) || '.');
const PAGE = 'run.html';
const TAG = /<script src="(js\/[A-Za-z0-9_\-/.]+\.js)" defer><\/script>/g;
// run.html lists the lobby's scripts first and marks where they end: everything the meeting reads from the moment it
// starts until the lobby is on screen (measured by recording every module the page reads before the lobby shows),
// the scripts those read while they load, and the small ones that only set page-wide values. A script below the
// mark is only late for the lobby, never missing: a join waits for the rest bundle. The order is the page's own,
// so the bundles run the scripts in exactly the order the repo page does.
const MARK = "<!-- the lobby's scripts end here -->";

const pagePath = path.join(SITE, PAGE);
const html = fs.readFileSync(pagePath, 'utf8');
if (html.includes('js/run.lobby.js')) throw new Error(PAGE + ' is already bundled');
const files = [...html.matchAll(TAG)].map((m) => m[1]);
if (files.length < 2) throw new Error('no deferred scripts found in ' + PAGE);
const markAt = html.indexOf(MARK);
if (markAt < 0 || html.indexOf(MARK, markAt + 1) >= 0) throw new Error(PAGE + ' needs exactly one mark: ' + MARK);
const LOBBY = [...html.slice(0, markAt).matchAll(TAG)].map((m) => m[1]);
if (LOBBY.length < 1 || files.slice(0, LOBBY.length).join() !== LOBBY.join()) throw new Error(PAGE + ': the lobby scripts must be the first deferred scripts');

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

// Minify one script. ES5 source stays ES5 (the minifier would otherwise use template strings and the like); other
// source is written as ES2017 at most (shorter forms such as ?. ?? ||= would quietly raise the browser floor).
// A raw control character inside a string is legal but invisible to text tools: it is written as an escape.
function minify(src, sourcefile) {
  let r;
  try { r = esbuild.transformSync(src, { loader: 'js', minify: true, sourcemap: 'external', sourcefile, target: 'es5', legalComments: 'none' }); }
  catch (e) { r = esbuild.transformSync(src, { loader: 'js', minify: true, sourcemap: 'external', sourcefile, target: 'es2017', legalComments: 'none' }); }
  const code = r.code.replace(/\n+$/, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return { code, map: JSON.parse(r.map) };
}

function build(name, list) {
  let out = 'var G=self.__gifosRan=self.__gifosRan||{};\n';
  let line = 1;
  const sections = [];
  for (const f of list) {
    const src = fs.readFileSync(path.join(SITE, f), 'utf8');
    check(f, src);
    const { code, map } = minify(src, path.posix.relative('js', f));
    delete map.sourcesContent;   // the source files are published beside the bundle
    // each script runs once, whichever bundle (or retry) reaches it first
    out += 'if(!G[' + JSON.stringify(f) + ']){G[' + JSON.stringify(f) + ']=1;try{\n';
    line += 1;
    sections.push({ offset: { line, column: 0 }, map });
    out += code + '\n}catch(e){self.reportError?reportError(e):setTimeout(function(){throw e})}}\n';
    line += code.split('\n').length + 1;
  }
  out += '//# sourceMappingURL=' + name + '.map\n';
  fs.writeFileSync(path.join(SITE, 'js', name), out);
  fs.writeFileSync(path.join(SITE, 'js', name + '.map'), JSON.stringify({ version: 3, file: name, sections }));
  // the address carries the content's hash, so a changed bundle is never answered from an old cache entry
  return 'js/' + name + '?h=' + crypto.createHash('sha256').update(out).digest('hex').slice(0, 10);
}
const lobbyUrl = build('run.lobby.js', LOBBY);
const bundleUrl = build('run.bundle.js', files);

// run.html's inline scripts, minified in place, each with a source map back to the lines of the readable run.html
// (the map carries that text). Small ones are left as they are.
let page = html, n = 0, before = 0, after = 0;
if (!args.includes('--keep-inline')) {
  page = html.replace(/<script(\s+id="[A-Za-z0-9_-]+")?>([\s\S]*?)<\/script>/g, (all, id, code, at) => {
    if (code.length < 1024) return all;
    const startLine = html.slice(0, at).split('\n').length - 1;
    const mapName = 'run.inline-' + n + '.js.map';
    const { code: mini, map } = minify('\n'.repeat(startLine) + code, '../run.html');
    if (/<\/script/i.test(mini) || /<!--/.test(mini)) throw new Error('inline script ' + n + ': its minified text would end the script early');
    fs.writeFileSync(path.join(SITE, 'js', mapName), JSON.stringify(map));
    before += code.length; after += mini.length; n++;
    return '<script' + (id || '') + '>' + mini + '\n//# sourceMappingURL=js/' + mapName + '\n</script>';
  });
}

// The page: the first deferred tag becomes the loader, which writes the bundle tags for this visit; the other tags go.
// (Tag text inside the loader is split so nothing that scans the page for script tags mistakes it for one.)
const loader = '<script>/* gifos bundles: ' + JSON.stringify(files) + ' */(function(){try{' +
  'function w(s){document.write(\'<scr\'+\'ipt src="\'+s+\'" defer></scr\'+\'ipt>\');}' +
  'var B=' + JSON.stringify(bundleUrl) + ';if(location.hash.length>1){w(B);return;}w(' + JSON.stringify(lobbyUrl) + ');' +
  'var g=self.__gifosLoadGate,done;var p=new Promise(function(r){done=r;});if(g)g.pending=p;' +
  'document.addEventListener("DOMContentLoaded",function(){var s=document.createElement("script");s.src=B;s.async=false;' +
  's.onload=s.onerror=function(){if(g&&g.pending===p)g.pending=null;done();};document.head.appendChild(s);});' +
  '}catch(e){}})();</script>';
let first = true;
fs.writeFileSync(pagePath, page.replace(TAG, () => { if (first) { first = false; return loader; } return ''; }));

if (args.includes('--sw')) {
  const swPath = path.join(SITE, 'sw.js');
  const sw = fs.readFileSync(swPath, 'utf8');
  const at = "'/run.html',";
  if (!sw.includes(at)) throw new Error('sw.js: the offline shell does not list /run.html');
  fs.writeFileSync(swPath, sw.replace(at, at + " '/js/run.lobby.js', '/js/run.bundle.js',"));
}
console.log(`${PAGE}: ${files.length} scripts -> js/run.bundle.js (${LOBBY.length} of them also in js/run.lobby.js); ${n} inline scripts ${before} -> ${after} bytes`);
