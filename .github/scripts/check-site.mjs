// The site copy is whole before it is uploaded (SNAPGAPS, 11-27). Run after prune-versions.mjs and again right before
// the upload. It fails when:
//  - a served snapshot (version.json floor..latest, plus "current") is missing any file the repo has for it;
//  - a root file the repo tracks is missing (minus what the deploy leaves out on purpose);
//  - a snapshot that is not served still has files in the copy (a snapshot is served whole or left out whole);
//  - _redirects would lose a rule on Pages: Pages counts every rule AFTER the first splat/placeholder as dynamic and
//    skips the rest of the file past 100 dynamic (and past 2,000 static, and any line over 1,000 characters);
//  - an unserved snapshot is not caught by the catch-all /versions/:v/* rule after every served snapshot's own rule;
//  - the copy nears the Pages limit of 20,000 files (guard 19,000).
// Usage: node .github/scripts/check-site.mjs dist [repo]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dist = process.argv[2] || 'dist';
const repo = process.argv[3] || '.';
const GUARD = Number(process.env.PRUNE_GUARD) || 19000;
const V = /^\d+\.\d+\.\d+(\.\d+)?$/;
const bad = [];
const vj = JSON.parse(fs.readFileSync(path.join(dist, 'version.json'), 'utf8'));
const num = (v) => v.split('.').map(Number);
const cmp = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 4; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
const floor = vj.latestMeetFloor, latest = vj.latest;
const servedWant = (v) => cmp(v, floor) >= 0 || v === vj.current || v === latest;

// What the deploy leaves out on purpose (deploy.yml rsync excludes, and the one file too big for Pages).
// rsync's unanchored excludes (.git, .github, worker, dist, README.md, NOTICE) match at any depth.
const LEFT_OUT = [/(^|\/)\.git(hub)?(\/|$)/, /(^|\/)(worker|dist)\//, /(^|\/)(README\.md|NOTICE)$/, /^(test|qa|proof|evidence|docs|design)\//, /^wt\//,
  /^(BENCHMARK\.md|QUIRKS\.md|RELEASE-0\.9\.23-MERGE\.md|package\.json)$/,
  /^apps\/pdf-tables-ocr\/pdf-tables-ocr\.gif$/];
const tracked = execFileSync('git', ['-C', repo, 'ls-files', '-z'], { maxBuffer: 1 << 28 }).toString().split('\0').filter(Boolean);

const repoVersions = new Set();
let checked = 0;
for (const f of tracked) {
  if (LEFT_OUT.some((re) => re.test(f))) continue;
  const m = /^versions\/([^/]+)\//.exec(f);
  if (m && V.test(m[1])) {
    repoVersions.add(m[1]);
    if (!servedWant(m[1])) continue;
  }
  checked++;
  if (!fs.existsSync(path.join(dist, f))) bad.push('missing from the site copy: ' + f);
}

// A snapshot is served whole or not at all.
const distVersions = fs.readdirSync(path.join(dist, 'versions')).filter((d) => V.test(d));
for (const v of distVersions) if (!servedWant(v)) bad.push('unserved snapshot still in the site copy: versions/' + v);
const served = [...repoVersions].filter(servedWant).sort(cmp);
const unserved = [...repoVersions].filter((v) => !servedWant(v)).sort(cmp);
for (const v of served) if (!distVersions.includes(v)) bad.push('served snapshot missing: versions/' + v);

// _redirects as Pages reads it (workers-shared parseRedirects).
const lines = fs.readFileSync(path.join(dist, '_redirects'), 'utf8').split('\n');
const rules = [];
let st = 0, dyn = 0, canStatic = true, stopped = false;
lines.forEach((raw, i) => {
  const line = raw.trim();
  if (stopped || !line || line.startsWith('#')) return;
  if (line.length > 1000) { bad.push('_redirects line ' + (i + 1) + ' is over 1,000 characters (Pages ignores it)'); return; }
  const t = line.replace(/\s+#.*$/, '').split(/\s+/);
  if (t.length < 2 || t.length > 3) { bad.push('_redirects line ' + (i + 1) + ' needs 2 or 3 tokens'); return; }
  const isDyn = /\*/.test(t[0]) || /:\w+/.test(t[0]);
  if (canStatic && !isDyn) st++; else { dyn++; canStatic = false; }
  if (dyn > 100) { stopped = true; return; }   // Pages drops this line and every line after it
  if (st > 2000) return;
  rules.push({ from: t[0], to: t[1], status: t[2] || '302', line: i + 1 });
});
if (stopped) bad.push('_redirects has over 100 rules counted as dynamic (every rule after the first splat counts): Pages skips the rest of the file');
if (st > 2000) bad.push('_redirects has ' + st + ' static rules: Pages skips past 2,000');

// First matching rule wins: an unserved snapshot must reach the floor, a served one must reach itself.
const match = (from, p) => {
  const re = new RegExp('^' + from.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/:\w+/g, '[^/]+') + '$');
  return re.test(p);
};
const first = (p) => rules.find((r) => match(r.from, p));
for (const v of served) {
  const r = first('/versions/' + v + '/run.html');
  if (r && !(r.status === '200' && r.to.startsWith('/versions/' + v + '/'))) bad.push('served versions/' + v + ' is redirected away by line ' + r.line);
}
for (const v of unserved) {
  const r = first('/versions/' + v + '/i18n/en/settings.json');
  if (!r || r.status === '200' || !r.to.startsWith('/versions/' + floor + '/')) bad.push('unserved versions/' + v + ' does not redirect to the floor ' + floor);
}

let files = 0;
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(path.join(d, e.name)); else files++; } };
walk(dist);
if (files > GUARD) bad.push('site copy has ' + files + ' files, over the ' + GUARD + ' guard (Pages limit 20,000): raise latestMeetFloor');

console.log('check-site: ' + checked + ' tracked files checked; served ' + served.join(' ') + '; ' + unserved.length + ' unserved snapshots redirect to ' + floor +
  '; _redirects ' + st + ' static + ' + dyn + ' dynamic; ' + files + ' files (guard ' + GUARD + ')');
if (bad.length) {
  for (const b of bad.slice(0, 50)) console.error('check-site: ERROR ' + b);
  if (bad.length > 50) console.error('check-site: ... and ' + (bad.length - 50) + ' more');
  process.exit(1);
}
