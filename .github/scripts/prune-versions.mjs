// Cloudflare Pages takes at most 20,000 files per deployment, and every release adds a
// ~450-file snapshot under versions/. The site copy (dist/) therefore keeps, for every
// release line older than the live one, only its x.y.z base and its last hotfix; the
// superseded hotfixes in between redirect to that last hotfix of the same line. The
// repo keeps every snapshot (git is the archive); only the deployed copy is thinned.
// The live line (the x.y.z of version.json "latest") is never thinned, nor any snapshot version.json names.
// Usage: node .github/scripts/prune-versions.mjs dist
import fs from 'node:fs';
import path from 'node:path';

const dist = process.argv[2] || 'dist';
const vdir = path.join(dist, 'versions');
const vj = JSON.parse(fs.readFileSync(path.join(dist, 'version.json'), 'utf8'));
const latest = vj.latest;
// Every snapshot version.json names (current, emergency, latestEmergency, the meet floor, ...) is always served.
const named = new Set(Object.values(vj).filter((x) => typeof x === 'string' && /^\d+\.\d+\.\d+(\.\d+)?$/.test(x)));
if (!/^\d+\.\d+\.\d+(\.\d+)?$/.test(latest || '')) { console.error('prune-versions: bad latest ' + latest); process.exit(1); }
const line = (v) => v.split('.').slice(0, 3).join('.');
const num = (v) => v.split('.').map(Number);
const cmp = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 4; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
const liveLine = line(latest);

const groups = {};
for (const d of fs.readdirSync(vdir)) {
  if (!/^\d+\.\d+\.\d+(\.\d+)?$/.test(d) || !fs.statSync(path.join(vdir, d)).isDirectory()) continue;
  (groups[line(d)] = groups[line(d)] || []).push(d);
}
const redirects = [];
let removed = 0;
for (const [l, vs] of Object.entries(groups)) {
  if (cmp(l, liveLine) >= 0) continue;
  const hot = vs.filter((v) => v.split('.').length === 4).sort(cmp);
  if (hot.length < 2) continue;
  const keep = hot[hot.length - 1];
  for (const v of hot.slice(0, -1)) {
    if (named.has(v)) continue;
    fs.rmSync(path.join(vdir, v), { recursive: true, force: true });
    redirects.push('/versions/' + v + '/* /versions/' + keep + '/:splat 302');
    removed++;
  }
}
if (redirects.length) {
  fs.appendFileSync(path.join(dist, '_redirects'),
    '# Superseded hotfix snapshots of older release lines are not deployed (Pages file limit); they go to the last hotfix of their line (.github/scripts/prune-versions.mjs).\n' +
    redirects.join('\n') + '\n');
}
console.log('prune-versions: live line ' + liveLine + ', ' + removed + ' superseded snapshots left out of the site copy');
