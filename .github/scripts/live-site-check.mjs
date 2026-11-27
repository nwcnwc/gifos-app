// After the upload: every file of the site copy is served by the deployment, and every unserved snapshot redirects
// to the floor (SNAPGAPS, 11-27). HEAD requests, at most 8 at a time, each with a query that no cache has seen.
// Usage: node .github/scripts/live-site-check.mjs dist https://gifos-pq5.pages.dev [tag]
import fs from 'node:fs';
import path from 'node:path';

const dist = process.argv[2] || 'dist';
const base = (process.argv[3] || 'https://gifos-pq5.pages.dev').replace(/\/$/, '');
const tag = process.argv[4] || String(Date.now());
const V = /^\d+\.\d+\.\d+(\.\d+)?$/;
const vj = JSON.parse(fs.readFileSync(path.join(dist, 'version.json'), 'utf8'));
const floor = vj.latestMeetFloor;
const SKIP = new Set(['_redirects', '_headers', '_routes.json']);

const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(path.relative(dist, p).split(path.sep).join('/')); } };
walk(dist);
const served = new Set(fs.readdirSync(path.join(dist, 'versions')).filter((d) => V.test(d)));
const unserved = (vj.versions || []).filter((v) => V.test(v) && !served.has(v));
for (const v of ['0.9.19', '0.9.27']) if (!served.has(v) && !unserved.includes(v)) unserved.push(v);

const bad = [];
const head = async (u, redirect) => {
  for (let i = 0; i < 3; i++) {
    try { return await fetch(u, { method: 'HEAD', redirect, headers: { 'Cache-Control': 'no-cache' } }); }
    catch (e) { if (i === 2) throw e; await new Promise((r) => setTimeout(r, 1000 * (i + 1))); }
  }
};
const jobs = [];
for (const f of files) {
  if (SKIP.has(f)) continue;
  jobs.push(async () => {
    const r = await head(base + '/' + encodeURI(f) + '?sitecheck=' + tag, 'follow');
    const m = /^versions\/([^/]+)\//.exec(f);
    const landed = new URL(r.url).pathname;
    if (!r.ok) bad.push(r.status + ' ' + f);
    else if (m && !landed.startsWith('/versions/' + m[1] + '/')) bad.push('served file left its snapshot: ' + f + ' -> ' + landed);
  });
}
for (const v of unserved) {
  jobs.push(async () => {
    const r = await head(base + '/versions/' + v + '/i18n/en/settings.json?sitecheck=' + tag, 'manual');
    const loc = r.headers.get('location') || '';
    if (r.status < 300 || r.status > 308 || !new URL(loc, base).pathname.startsWith('/versions/' + floor + '/i18n/en/settings.json')) bad.push('unserved ' + v + ': ' + r.status + ' ' + loc);
  });
}
let next = 0;
await Promise.all(Array.from({ length: 8 }, async () => { while (next < jobs.length) { const j = jobs[next++]; try { await j(); } catch (e) { bad.push('error ' + e.message); } } }));
console.log('live-site-check ' + base + ': ' + (jobs.length - unserved.length) + ' files, ' + unserved.length + ' unserved snapshots -> ' + floor + '; ' + bad.length + ' problems');
if (bad.length) { for (const b of bad.slice(0, 50)) console.error('live-site-check: ' + b); process.exit(1); }
