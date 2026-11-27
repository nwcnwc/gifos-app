// Cloudflare Pages takes at most 20,000 files per deployment. The live site serves ONLY the snapshots from the meet
// floor (version.json latestMeetFloor) up to latest, plus the legacy three-part "current" (the hop that pre-0.9.24
// pages read). Every other snapshot (older lines, 0.9.25, hotfixes below the floor) is left out of the site copy and
// its addresses redirect to the same file in the floor's snapshot: a page below the floor cannot meet (the relay refuses it, PAGE_FLOOR)
// and moves itself to the current release. The repo keeps every snapshot (git is the archive).
// The served set only grows by ~470 files per hotfix while the floor stays put, so this script prints the served
// count and FAILS EARLY (before upload) when the site copy would pass the guard: raise latestMeetFloor. It never
// drops a snapshot that can still join a meeting.
// Usage: node .github/scripts/prune-versions.mjs dist
import fs from 'node:fs';
import path from 'node:path';

const GUARD = Number(process.env.PRUNE_GUARD) || 19000;       // Pages refuses more than 20,000 files; this keeps headroom
const dist = process.argv[2] || 'dist';
const vdir = path.join(dist, 'versions');
const vj = JSON.parse(fs.readFileSync(path.join(dist, 'version.json'), 'utf8'));
const V = /^\d+\.\d+\.\d+(\.\d+)?$/;
const latest = vj.latest, floor = vj.latestMeetFloor;
if (!V.test(latest || '')) { console.error('prune-versions: bad latest ' + latest); process.exit(1); }
if (!V.test(floor || '')) { console.error('prune-versions: bad latestMeetFloor ' + floor); process.exit(1); }
const num = (v) => v.split('.').map(Number);
const cmp = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 4; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
const all = fs.readdirSync(vdir).filter((d) => V.test(d) && fs.statSync(path.join(vdir, d)).isDirectory()).sort(cmp);
if (!all.includes(floor)) { console.error('prune-versions: the meet floor ' + floor + ' has no snapshot'); process.exit(1); }
// "current" stays three-part for pre-0.9.24 pages (never removed); latest and the floor are served by definition.
const keep = new Set([vj.current, latest, floor].filter((x) => typeof x === 'string' && V.test(x)));
const served = [], redirects = [], splats = [];  // splats: the snapshots left out
for (const v of all) {
  if (cmp(v, floor) >= 0 || keep.has(v)) { served.push(v); continue; }
  fs.rmSync(path.join(vdir, v), { recursive: true, force: true });
  splats.push(v);
}
// Every snapshot that is not served goes to the floor, file for file, by ONE catch-all rule. Per-snapshot rules do
// not scale: Pages counts every rule after the first splat as dynamic and SKIPS THE REST OF THE FILE past 100, so the
// newest pruned snapshots (the ones still open in tabs) lost their redirect and served 404 (SNAPGAPS, 11-27).
// The served snapshots go first, each rewritten to itself (200: Pages serves the asset as if there were no rule; the
// .html -> clean address 308 and _headers are unchanged), so the catch-all only ever sees an unserved address.
// The rule count is fixed (2 per served snapshot + 2) whatever the number of pruned snapshots.
for (const v of served) {
  redirects.push('/versions/' + v + '/* /versions/' + v + '/:splat 200');
  redirects.push('/versions/' + v + ' /versions/' + v + '/ 308');
}
redirects.push('/versions/:v/* /versions/' + floor + '/:splat 302');
redirects.push('/versions/:v /versions/' + floor + '/ 302');
fs.appendFileSync(path.join(dist, '_redirects'),
  '# Only the meet floor up to latest is served; every other snapshot goes to the floor (.github/scripts/prune-versions.mjs).\n' +
  redirects.join('\n') + '\n');
let files = 0;
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(path.join(d, e.name)); else files++; } };
walk(dist);
console.log('prune-versions: floor ' + floor + ', latest ' + latest + '; served snapshots ' + served.length + ': ' + served.join(' '));
console.log('prune-versions: ' + splats.length + ' snapshots redirect to ' + floor + '; site copy has ' + files + ' files (guard ' + GUARD + ', Pages limit 20000)');
if (files > GUARD) {
  console.error('prune-versions: ERROR the served snapshots (' + served.length + ') make ' + files + ' files, over the ' + GUARD + ' guard: raise latestMeetFloor in version.json (retire the oldest served hotfixes). No snapshot is dropped silently.');
  process.exit(1);
}
