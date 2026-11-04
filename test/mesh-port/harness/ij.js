'use strict';
/*
 * harness/ij.js: the L31 instant-join measurement and the gate's levers (`ijmeasure on|off|reset`, `ijstat [each]`,
 * `ijvia <seeker> <greeter>`, `ijforge <seeker> signer|held`), a line-for-line port of the sim's mesh_instant_fab.inc.
 * ijTick reads the truth once per tick and never changes the trajectory. Harness code, never shipped.
 *
 *   require('./ij.js').install(fab);   // plugs ijLever and ijTick
 *
 * `ijvia` writes the seats' lever w.L31_VIA (a Map, read by js/mesh/recv-entry.js); `ijforge` the levers
 * L31_FORGE_MODE / L31_FORGE_SEEKER (read by js/mesh/instant.js). std::map IJ is walked by sorted key.
 */
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const C_ = require(path.join(M, 'consts.js'));
const topo = require(path.join(M, 'topo.js'));

const E = C_.enums;
const { ckey, ownedLinks } = topo;
const atoi = (s) => { const v = parseInt(s, 10); return Number.isNaN(v) ? 0 : (v | 0); };
const lEnd = (me, x) => (me < x ? 0 : 1);
const sortedKeys = (m) => [...m.keys()].sort((a, b) => a - b);

function install(fab) {
  const { lv, seats, alive, X, w } = fab;
  const P = (...a) => fab.printf(...a);
  const TICK = () => w.TICK;
  const S = { IJMEAS: false, IJ_FROM: 0, IJ_DUPCELLS: 0, IJ_DUPFIRST: -1, IJ_DUPLAST: -1, IJ_DUPMAX: 0 };
  const IJ = new Map();     // seat -> IjRec (std::map: walked by sorted key)
  const IJDUP = new Map();  // cell -> since when two live seats hold it
  // C++: mesh_instant_fab.inc:IjRec
  const newIjRec = () => ({ knock: -1, placed: -1, seated: -1, media: -1, links: -1, cell: -1, ck: 0 });

  // C++: mesh_instant_fab.inc:ijFlow
  function ijFlow(a, b) {   // a stream crosses the pair a->b right now (link model, or the parent's paths)
    if (a < 0 || b < 0 || a >= lv.nextId || b >= lv.nextId || !alive[a] || !alive[b]) return false;
    if (fab.isFrozen(a) || fab.isFrozen(b)) return false;
    if (!lv.LINKMODEL) return fab.link.pathOk(a, b) && !fab.cutBetween(a, b);
    const L = X.linkFind(a, b); if (!L || L.state !== E.LK_OPEN) return false;
    return !(L.half & (1 << lEnd(a, b)));
  }

  // C++: mesh_instant_fab.inc:ijTick
  function ijTick() {
    if (!S.IJMEAS) return;
    const cell = new Map(), cnt = new Map();
    for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q] && seats[q].state === 3 && seats[q].hasCoord) { const k = ckey(seats[q].coord); cnt.set(k, (cnt.get(k) || 0) + 1); if (!cell.has(k)) cell.set(k, q); }
    // the race census (Section 1 only: the instant-join cells)
    for (const [k, n] of cnt) { if (Math.floor(k / 65536) !== 0) continue; if (n > 1) { if (!IJDUP.has(k)) { IJDUP.set(k, TICK()); S.IJ_DUPCELLS++; if (S.IJ_DUPFIRST < 0) S.IJ_DUPFIRST = TICK(); } S.IJ_DUPLAST = TICK(); } }
    for (const [k, since] of [...IJDUP]) { const c = cnt.get(k); if (c === undefined || c < 2) { S.IJ_DUPMAX = Math.max(S.IJ_DUPMAX, TICK() - since); IJDUP.delete(k); } }
    const SP = fab.SPAWNT, FS = fab.FIRSTSEAT;
    for (let q = 0; q < lv.nextId && q < SP.length; q++) if (SP[q] >= S.IJ_FROM && !IJ.has(q)) { const r = newIjRec(); r.knock = SP[q]; IJ.set(q, r); }
    for (const q of sortedKeys(IJ)) {
      const r = IJ.get(q); if (q >= lv.nextId || !alive[q] || !seats[q]) continue; const s = seats[q];
      if (r.placed < 0 && q < FS.length && FS[q] >= 0) r.placed = FS[q];
      if (!(s.state === 3 && s.hasCoord)) continue;
      const k = ckey(s.coord); const ol = ownedLinks(s.coord), n = ol.length;
      let all = true, allLinks = true, media = false, peers = 0;
      for (let i = 0; i < n; i++) {
        const p = cell.get(ckey(ol[i])); if (p === undefined) continue; if (p === q) continue; peers++;
        const names = seats[p].occGet(k) === q;
        if (!names) all = false;
        if (!(ijFlow(p, q) && ijFlow(q, p))) allLinks = false;
        if (names && ijFlow(p, q)) media = true;
      }
      if (!media && s.l31Bridge >= 0 && s.l31BridgeCk === k) { const p = s.l31Bridge; if (p < lv.nextId && alive[p] && seats[p].state === 3 && seats[p].hasCoord && ijFlow(p, q)) media = true; }   // L31.3: the door pc to my placer, while it stands
      if (r.ck !== k) { r.ck = k; r.seated = -1; r.links = -1; }   // a move starts the neighbourhood over (the race's loser)
      if (r.seated < 0 && all && peers > 0) r.seated = TICK();
      if (r.links < 0 && allLinks && peers > 0) r.links = TICK();
      if (r.media < 0 && media) r.media = TICK();
    }
  }

  // C++: mesh_instant_fab.inc:ijPct
  function ijPct(v, p) { if (!v.length) return -1; v = v.slice().sort((a, b) => a - b); const i = Math.floor((p * (v.length - 1) + 50) / 100); return v[Math.min(i, v.length - 1)]; }
  // C++: mesh_instant_fab.inc:ijStat
  function ijStat(each) {
    const pl = [], se = [], me = [], li = []; let unp = 0, uns = 0, unm = 0, n = 0;
    for (const q of sortedKeys(IJ)) {
      const r = IJ.get(q); if (q >= lv.nextId || !alive[q]) continue; n++;
      const d = (t) => (t < 0 ? -1 : t - r.knock);
      if (each) P('IJ seat=%d placed=%lld seated=%lld media=%lld links=%lld coord=%s placer=%d\n', q, d(r.placed), d(r.seated), d(r.media), d(r.links), seats[q].hasCoord ? fab.coordStr(seats[q].coord) : '-', seats[q].myPlacer);
      if (r.placed >= 0) pl.push(r.placed - r.knock); else unp++;
      if (r.seated >= 0) se.push(r.seated - r.knock); else uns++;
      if (r.media >= 0) me.push(r.media - r.knock); else unm++;
      if (r.links >= 0) li.push(r.links - r.knock);
    }
    const mx = (v) => (v.length ? Math.max(...v) : -1);
    P('IJSTAT n=%d placed_p50=%lld placed_max=%lld seated_p50=%lld seated_max=%lld media_p50=%lld media_max=%lld links_p50=%lld links_max=%lld unplaced=%d unseated=%d nomedia=%d dupCells=%lld dupFirst=%lld dupLast=%lld dupMax=%lld dupNow=%zu l31=%d\n',
      n, ijPct(pl, 50), mx(pl), ijPct(se, 50), mx(se), ijPct(me, 50), mx(me), ijPct(li, 50), mx(li), unp, uns, unm, S.IJ_DUPCELLS, S.IJ_DUPFIRST, S.IJ_DUPLAST, S.IJ_DUPMAX, IJDUP.size, 1);
    P('IJL31 door=%lld direct=%lld replaced=%lld lost=%lld noAssent=%lld refused=%lld forged=%lld forgeAccepted=%lld forgeRefused=%lld\n', lv.L31_DOOR, lv.L31_HANDOFF, lv.L31_REPLACED, lv.L31_LOST, lv.L31_NOACK, lv.L31_REFUSED, lv.L31_FORGED, lv.L31_FORGE_OK, lv.L31_FORGE_NO);
    P('IJL44 stay=%lld liveWithdrawn=%lld reask=%lld closedWait=%lld\n', lv.L44_STAY, lv.L44_LIVEW, lv.L44_REASK, lv.L44_CLOSEDW);
  }
  // C++: mesh_instant_fab.inc:ijLever
  function ijLever(tk) {
    if (tk[0] === 'ijstat') { ijStat(tk.length > 1 && tk[1] === 'each'); return; }
    if (tk[0] === 'ijvia') { const q = tk.length > 1 ? atoi(tk[1]) : -1, g = tk.length > 2 ? atoi(tk[2]) : -1; if (q >= 0 && g >= 0) { if (!(w.L31_VIA instanceof Map)) w.L31_VIA = new Map(); w.L31_VIA.set(q, g); P('OK ijvia %d %d\n', q, g); } else P('ERR\n'); return; }
    if (tk[0] === 'ijforge') { const q = tk.length > 1 ? atoi(tk[1]) : -1; const md = tk.length > 2 ? tk[2] : 'signer'; if (md !== 'signer' && md !== 'held') { P('ERR ijforge mode signer|held\n'); return; } lv.L31_FORGE_MODE = (md === 'held') ? 2 : 1; lv.L31_FORGE_SEEKER = q; P('OK ijforge %d %s\n', q, md); return; }
    const wd = tk.length > 1 ? tk[1] : 'on';
    if (wd === 'reset') { IJ.clear(); S.IJ_FROM = TICK(); IJDUP.clear(); S.IJ_DUPCELLS = 0; S.IJ_DUPFIRST = S.IJ_DUPLAST = -1; S.IJ_DUPMAX = 0; }
    else { if (!S.IJMEAS && wd !== 'off') S.IJ_FROM = TICK(); S.IJMEAS = (wd !== 'off'); }
    P('OK ijmeasure %s\n', wd);
  }

  fab.plug({ ijLever, ijTick });
  return { ijLever, ijTick, ijStat };
}

module.exports = { install };
