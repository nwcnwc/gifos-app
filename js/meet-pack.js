/*
 * meet-pack.js — GifOS Meet v0.9.23 tile packer.
 * The algorithm is design/meet-views-0923/layout-algo/layout.js (rev 3) on
 * layout-algo-0923. One packer for every region. No per-count tables.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  const GifOS = root.GifOS = root.GifOS || {};
  GifOS.meetPack = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
'use strict';
const MIN_SIDE = { phone: 96, other: 80 };   // smallest short side we allow in a gallery
// Orientation conversion tuning (rev 2). keep = share of the source kept on the cropped axis.
//   keep >= FREE       : free (faces are tracked/centred)
//   KMIN <= keep < FREE: allowed conversion (16:9 -> 3:5 portrait keeps 0.34), value falls linearly to FLOOR_Q
//   keep < KMIN        : full picture on a blurred copy (contain); value = keep (true letterboxed picture)
const TUNE = { FREE: 0.8, KMIN: 0.3, GAMMA: 0.5 };
const TUNE_REV2 = { FREE: 0.8, KMIN: 0.3, GAMMA: 0.5, legacyRows: true }; // rev 2 packer, for before/after only
const TUNE_V1 = { FREE: 0.8, KMIN: 0.6, FLOOR_Q: 0.75, v1: true }; // the approved-for-now rev 1 behaviour (for before/after)
let T = TUNE;
function setTune(t) { T = t || TUNE; }
const CROP_KEEP_MIN = 0.6; // kept for API compat; live threshold is T.KMIN
const TIE = 0.01;                            // scores within 1% are a tie
const PORTRAIT_SPLIT = 1.15;                 // box W/H >= this -> stage left + side rail, else stage top + strip

const CROP_FREE = 0.8;                       // cover-crop that keeps >=80% on the cropped axis costs nothing (faces are centred)
// Smallest keep that still holds a default face (s=0.3, grown 1.8x) — the packer and
// the renderer use the same rule, so the packer never plans a crop the renderer must undo.
function keepNeeded(t, a) {
  if (T.v1) return T.KMIN;
  const f = 0.3, m = 1.8;
  return Math.max(T.KMIN, t > a ? f * m : f * 0.8 * m / a); // cropping height: face height; cropping width: face width
}
function fitArea(cw, ch, a) { // useful face area of an a-aspect picture shown in a cw x ch tile
  const t = cw / ch, keep = Math.min(t / a, a / t);
  if (T.v1) return cw * ch * Math.min(1, keep / T.FREE);
  // rev 2: a cover-crop makes the face bigger (by 1/keep in height) while it
  // throws picture away (keep). Net value ~ keep^GAMMA: GAMMA=1 is rev 1's pure
  // picture-area rule; GAMMA=0.5 is the geometric mean of picture area and
  // face size, which lets the packer choose converted (rotated-shape) tiles.
  if (keep < keepNeeded(t, a)) return cw * ch * keep;      // full picture over blur (same rule cropFor uses)
  return cw * ch * Math.min(1, Math.pow(keep / T.FREE, T.GAMMA));
}
// Tile shape limits (rev 3, Nathan 11:38 PM: "this skinny slice would be annoying").
// 0.44 not 0.5: a single person filling a portrait phone (408x911 = 0.448) must stay legal.
// On a phone, a tile also must not be a wide squash. 1.05 keeps a 2x2
// (about 0.88) and a big tile beside smaller ones, and drops the 1-1-2
// strip whose bottom row was 73px. Desktop keeps the wider limit.
const ASPECT_MIN = 0.44, ASPECT_MAX = 2.4, PHONE_ASPECT_MAX = 1.05;
function aspectMax(phone) { return phone ? PHONE_ASPECT_MAX : ASPECT_MAX; }
// Lines are dealt as evenly as possible, SHORTER lines first, so a lone tile
// (usually you / the first person) leads: 5 in 3 rows = 1-2-2.
function rowCounts(N, r) {
  const q = Math.floor(N / r), rem = N % r, out = [];
  for (let i = 0; i < r; i++) out.push(q + ((T.legacyRows ? i < rem : i >= r - rem) ? 1 : 0));
  return out;
}
// A candidate = lines (rows, or columns when dir='cols') x sizing.
// sizing 'equal': every line the same thickness (rev 1/2 behaviour).
// sizing 'aspect': line thickness proportional to 1/k (k = tiles in that line),
// so every tile has the same shape -> 1-2-2 = one big tile over a 2x2,
// or with dir='cols' a big tile beside a 2x2. Nothing per count.
function cellsFor(box, N, dir, r, sizing) {
  const counts = rowCounts(N, r), along = dir === 'rows' ? box.h : box.w, across = dir === 'rows' ? box.w : box.h;
  const wts = counts.map(k => sizing === 'aspect' ? 1 / k : 1), tot = wts.reduce((x, y) => x + y, 0);
  const cells = []; let off = 0;
  counts.forEach((k, li) => {
    const th = li === counts.length - 1 ? along - off : along * wts[li] / tot;
    for (let j = 0; j < k; j++) {
      const a0 = across * j / k, a1 = j === k - 1 ? across : across * (j + 1) / k;
      cells.push(dir === 'rows'
        ? { x: box.x + a0, y: box.y + off, w: a1 - a0, h: th, row: li, col: j }
        : { x: box.x + off, y: box.y + a0, w: th, h: a1 - a0, row: j, col: li });
    }
    off += th;
  });
  return { counts, cells };
}
function candidates(box, aspects, all, phone) {
  const N = aspects.length, out = [], maxA = aspectMax(phone);
  for (const dir of ['rows', 'cols']) for (let r = 1; r <= N; r++) for (const sizing of ['equal', 'aspect']) {
    // prune: lines whose typical tile is >3x outside the shape limits can never be valid
    const along = dir === 'rows' ? box.h : box.w, across = dir === 'rows' ? box.w : box.h;
    const tt = dir === 'rows' ? (across / Math.ceil(N / r)) / (along / r) : (along / r) / (across / Math.ceil(N / r));
    if (!all && !T.legacyRows && (tt < ASPECT_MIN / 3 || tt > maxA * 3)) continue;
    const uniform = rowCounts(N, r).every((k, _, c) => k === c[0]);
    if (sizing === 'aspect' && uniform) continue;          // identical to 'equal'
    if (T.legacyRows && (dir === 'cols' || sizing === 'aspect')) continue; // rev 2 (before/after only)
    const { counts, cells } = cellsFor(box, N, dir, r, sizing);
    let score = 0, minShort = Infinity, viol = 0;
    cells.forEach((c, i) => {
      score += fitArea(c.w, c.h, aspects[i]); minShort = Math.min(minShort, c.w, c.h);
      const t = c.w / c.h; viol = Math.max(viol, t < ASPECT_MIN ? ASPECT_MIN / t : t > maxA ? t / maxA : 1);
    });
    out.push({ dir, r, sizing, counts, cells, score, minShort, viol });
  }
  return out;
}
function median(xs) { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 16 / 9; }

// Pick: only candidates whose every tile is inside [ASPECT_MIN, ASPECT_MAX]
// (if none, the least-violating ones), then minSide, then best score.
// Ties (within TIE): prevRows, plain rows over columns, equal over aspect
// sizing, tile shape closest to the median source, fewer lines.
function chooseRows(box, aspects, prevRows, minSide, phone) {
  const N = aspects.length; if (!N || box.w <= 0 || box.h <= 0) return null;
  const med = median(aspects);
  let cands = candidates(box, aspects, false, phone);
  if (!cands.length) cands = candidates(box, aspects, true, phone);
  const vmin = T.legacyRows ? Infinity : Math.min(...cands.map(c => c.viol));
  cands = cands.filter(c => c.viol <= Math.max(1, vmin) + 1e-9);
  if (minSide && cands.some(c => c.minShort >= minSide)) cands = cands.filter(c => c.minShort >= minSide);
  const best = Math.max(...cands.map(c => c.score));
  cands = cands.filter(c => c.score >= best * (1 - TIE));
  const dev = c => Math.abs(Math.log(c.cells[0].w / c.cells[0].h / med));
  cands.sort((a, b) => ((b.r === prevRows && b.dir === 'rows') - (a.r === prevRows && a.dir === 'rows')) ||
    ((a.dir === 'cols') - (b.dir === 'cols')) || ((a.sizing === 'aspect') - (b.sizing === 'aspect')) || (dev(a) - dev(b)) || (a.r - b.r));
  return cands[0];
}

function packRegion(box, aspects, opts = {}) {
  const pick = chooseRows(box, aspects, opts.prevRows, opts.minSide, opts.phone);
  if (!pick) return { rows: 0, rects: [] };
  const rects = pick.cells.map((c, i) => {
    const a = aspects[i], t = c.w / c.h, keep = Math.min(t / a, a / t);
    return { ...c, fit: keep >= keepNeeded(t, a) ? 'cover' : 'contain', keep, objPos: a < t ? '50% 40%' : '50% 50%' };
  });
  return { rows: pick.r, dir: pick.dir, sizing: pick.sizing, counts: pick.counts, minShort: pick.minShort, viol: pick.viol, rects };
}

// Largest n that still keeps every tile's short side >= minSide (uniform aspect a).
function capacity(box, a, minSide) {
  let lo = 0, hi = 1;
  const ok = n => { const p = chooseRows(box, Array(n).fill(a), null, minSide); return p && p.minShort >= minSide; };
  if (!ok(1)) return 1;
  while (ok(hi) && hi < 4096) { lo = hi; hi *= 2; }
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ok(m)) lo = m; else hi = m; }
  return Math.max(1, lo);
}

// ---------- Order: one stable per-viewer sequence ----------
// rank: Map id -> number. Join = max+1 (end). Leave = delete (tail shifts by
// one slot, order kept). Drag-reorder = midpoint of neighbours. Seat/row
// changes never touch it. Self (if a tile) and pinned get negative ranks.
class Order {
  constructor() { this.rank = new Map(); this.next = 1; }
  join(id) { if (!this.rank.has(id)) this.rank.set(id, this.next++); return this; }
  leave(id) { this.rank.delete(id); return this; }
  pin(id, r) { this.rank.set(id, r); return this; }
  moveBetween(id, before, after) {
    const lo = before != null ? this.rank.get(before) : (after != null ? this.rank.get(after) - 1 : 0);
    const hi = after != null ? this.rank.get(after) : lo + 2;
    this.rank.set(id, (lo + hi) / 2); return this;
  }
  sort(ids) { return ids.slice().sort((a, b) => (this.rank.get(a) ?? Infinity) - (this.rank.get(b) ?? Infinity) || (a < b ? -1 : 1)); }
}

// ---------- Full view ----------
// people: [{id, aspect, me?, row?}]  (row = mesh row, only drives quality)
// stage:  [{id, aspect, share?}] up to 5 (people ids or 'share:<id>')
// opts: {W, H, phone?, mode:'auto'|'gallery'|'stageOnly', order:Order,
//        myRow, selfView:'tile'|'inset'|'hidden', page, prevRows}
function layout(people, stage, opts) {
  const W = opts.W, H = opts.H;
  const phone = opts.phone != null ? opts.phone : Math.min(W, H) < 600;
  const pad = phone ? 2 : 4;
  // The app passes viewBox (header already inset). Design tests omit box and use W/H.
  const box = opts.box || { x: pad, y: pad, w: W - 2 * pad, h: H - 2 * pad };
  const minSide = phone ? MIN_SIDE.phone : MIN_SIDE.other;
  const order = opts.order;
  stage = (stage || []).slice(0, 5);
  const stageIds = new Set(stage.map(s => s.id));
  const selfView = opts.selfView || 'tile';
  // Gallery = everyone not on stage. Self is a tile unless inset/hidden; self is never auto-staged.
  const me = people.find(p => p.me);
  let gallery = people.filter(p => !stageIds.has(p.id) && !(p.me && selfView !== 'tile'));
  const byId = new Map(people.map(p => [p.id, p]));
  gallery = order.sort(gallery.map(p => p.id)).map(id => byId.get(id));
  if (me && selfView === 'tile') { gallery = [me, ...gallery.filter(p => p !== me)]; }
  const out = { W, H, box, tiles: [], regions: {}, overflow: 0 };
  const quality = id => { const p = byId.get(id); return p && opts.myRow != null && p.row === opts.myRow ? 'hi' : 'lo'; };

  let galBox = box, stageBox = null;
  const mode = opts.mode || 'auto';
  if (stage.length) {
    const side = box.w / box.h >= PORTRAIT_SPLIT;
    if (mode === 'stageOnly' || !gallery.length) stageBox = box, galBox = null;
    else {
      // split fraction f: same scorer. Stage tiles weigh 4x (share 8x); the
      // gallery must keep minSide or it pages. Search 50..85%.
      const sA = stage.map(s => s.aspect), gA = gallery.map(p => p.aspect);
      let best = null;
      for (let i = 35; i <= 85; i++) {
        const f = i / 100;
        const sb = side ? { x: box.x, y: box.y, w: box.w * f, h: box.h } : { x: box.x, y: box.y, w: box.w, h: box.h * f };
        const gb = side ? { x: box.x + sb.w, y: box.y, w: box.w - sb.w, h: box.h } : { x: box.x, y: box.y + sb.h, w: box.w, h: box.h - sb.h };
        const st = stageScore(sb, stage, phone);
        const g = chooseRows(gb, gA, null, null, phone);
        // stage weighs 4x (8x with a share); everyone stays in the rail, but a
        // rail whose tiles fall under the Fit floor is penalised
        const sv = stageViol(sb, stage, phone), bad = Math.max(sv, g.viol);
        const val = st * (stage.some(s => s.share) ? 8 : 4) + g.score - (g.minShort < (phone ? FIT_FLOOR.phone : FIT_FLOOR.other) ? 1e15 : 0) - (bad > 1 ? 1e18 * bad : 0);
        if (!best || val > best.val * (1 + 1e-9)) best = { val, sb, gb };
      }
      stageBox = best.sb; galBox = best.gb;
    }
    out.regions.stage = stageBox;
    for (const t of placeStage(stageBox, stage, phone)) out.tiles.push({ ...t, region: 'stage', quality: 'hi' });
  }
  if (mode === 'stageOnly' && stage.length) { out.overflow = gallery.length; return out; }
  if (galBox && gallery.length) {
    out.regions.gallery = galBox;
    const g = twoTier(galBox, gallery, me, opts, phone);
    Object.assign(out, { rows: g.rows, split: g.split, contentH: g.contentH, minShort: g.minShort, tooSmall: g.tooSmall, gallery: opts.gallery || 'fit' });
    for (const t of g.tiles) out.tiles.push({ ...t, region: 'gallery', me: !!(byId.get(t.id) || {}).me, quality: t.tier === 'row' ? 'hi' : 'lo' });
  }
  return out;
}

// Two tiers. "row" = you + your mesh row (high-quality streams) -> bigger
// tiles. "stad" = everyone else, sliced from the one stadium feed -> smaller
// tiles. Both tiers use packRegion. Fit: row band on top, stadium below;
// the split f is searched (20..85%) maximising rowScore*ROW_W + stadScore,
// keeping row tiles between 1.5x and 2.5x the stadium tile's short side
// ("a bit smaller"); if no split can, the one closest to that band wins.
// Scroll: row band fills one screen-height share, the stadium below grows
// downward at a comfortable size (SCROLL_MIN). Nobody is ever hidden.
const ROW_W = 1, TIER_RATIO = 1.5, TIER_MAX = 2.5, SCROLL_MIN = { phone: 96, other: 128 }, FIT_FLOOR = { phone: 28, other: 36 };
function twoTier(box, gallery, me, opts, phone) {
  const inRow = p => p === me || (opts.myRow != null && p.row === opts.myRow);
  const row = gallery.filter(inRow), stad = gallery.filter(p => !inRow(p));
  const wide = false; // bands stack vertically in every box (row on top), simplest to read and to scroll
  const emit = (list, rects, tier) => list.map((p, i) => ({ id: p.id, ...rects[i], tier }));
  const mode = opts.gallery || 'fit';
  if (mode === 'scroll') { // Scroll never makes tiles smaller than Fit: if Fit is already comfortable, Scroll == Fit
    const fit = twoTier(box, gallery, me, { ...opts, gallery: 'fit' }, phone);
    const stadMin = Math.min(...fit.tiles.filter(t => t.tier === 'stad').map(t => Math.min(t.w, t.h)));
    if (stadMin >= (phone ? SCROLL_MIN.phone : SCROLL_MIN.other)) return fit;
  }
  if (!stad.length || !row.length) {
    const list = row.length ? row : stad, tier = row.length ? 'row' : 'stad';
    if (mode === 'scroll' && tier === 'stad') return scrollStad(box, list, [], phone, box.y);
    const p = packRegion(box, list.map(t => t.aspect), { prevRows: opts.prevRows, phone: phone });
    // A short landscape phone cannot hold a legal tile if the grid is stretched
    // across the whole box. Cap the shape and let a later row scroll.
    if (phone && box.w > box.h && p && (p.viol > 1 || p.minShort < MIN_SIDE.phone)) return phoneFit(box, list, tier);
    return { tiles: emit(list, p.rects, tier), rows: p.rows, split: tier === 'row' ? 1 : 0, contentH: box.h, minShort: p.minShort, tooSmall: p.minShort < (phone ? FIT_FLOOR.phone : FIT_FLOOR.other) };
  }
  if (mode === 'scroll') {
    // row band: 50% of the first screen, or the nearest height whose row tiles are legal shapes
    const okH = h => chooseRows({ x: box.x, y: box.y, w: box.w, h }, row.map(t => t.aspect), null, null, phone).viol <= 1;
    let rh = box.h * 0.5;
    for (let d = 0; d <= 0.45 && !okH(rh); d += 0.05) { if (okH(box.h * (0.5 + d))) { rh = box.h * (0.5 + d); break; } if (okH(box.h * (0.5 - d))) { rh = box.h * (0.5 - d); break; } }
    const rp = packRegion({ x: box.x, y: box.y, w: box.w, h: rh }, row.map(t => t.aspect), { phone: phone });
    return scrollStad(box, stad, emit(row, rp.rects, 'row'), phone, box.y + rh, rp.rows);
  }
  let best = null;
  for (let i = 20; i <= 85; i++) {
    const f = i / 100, rb = { x: box.x, y: box.y, w: box.w, h: box.h * f }, sb = { x: box.x, y: box.y + rb.h, w: box.w, h: box.h - rb.h };
    const rc = chooseRows(rb, row.map(t => t.aspect), null, null, phone), sc = chooseRows(sb, stad.map(t => t.aspect), null, null, phone);
    if (!rc || !sc) continue;
    // tier ratio = row short side / stadium short side; must sit in [1.5, 2.5]
    const ratio = rc.minShort / Math.max(1e-9, sc.minShort);
    const miss = ratio < TIER_RATIO ? TIER_RATIO / ratio : ratio > TIER_MAX ? ratio / TIER_MAX : 1;
    const bad = Math.max(rc.viol, sc.viol); // a band too thin for legal tile shapes is out
    const val = (bad > 1 ? -1e18 * bad : 0) + (miss > 1 ? -1e15 * miss : rc.score * ROW_W + sc.score);
    if (!best || val > best.val) best = { val, f, rb, sb };
  }
  if (best.val < -1e17) { // no band split gives legal tile shapes: one shared grid (row first), quality still differs
    const all = [...row, ...stad], p = packRegion(box, all.map(t => t.aspect), { prevRows: opts.prevRows, phone: phone });
    if (phone && box.w > box.h && p && (p.viol > 1 || p.minShort < MIN_SIDE.phone)) {
      const laid = phoneFit(box, all, 'row');
      laid.tiles.forEach((t, i) => { t.tier = i < row.length ? 'row' : 'stad'; });
      laid.merged = true;
      return laid;
    }
    return { tiles: all.map((q, i) => ({ id: q.id, ...p.rects[i], tier: i < row.length ? 'row' : 'stad' })), rows: p.rows, split: null, merged: true, contentH: box.h, minShort: p.minShort, tooSmall: p.minShort < (phone ? FIT_FLOOR.phone : FIT_FLOOR.other) };
  }
  const rp = packRegion(best.rb, row.map(t => t.aspect), { prevRows: opts.prevRows, phone: phone });
  const sp = packRegion(best.sb, stad.map(t => t.aspect), { phone: phone });
  const minShort = Math.min(rp.minShort, sp.minShort);
  return { tiles: [...emit(row, rp.rects, 'row'), ...emit(stad, sp.rects, 'stad')], rows: rp.rows + '+' + sp.rows, split: best.f, contentH: box.h, minShort, tooSmall: minShort < (phone ? FIT_FLOOR.phone : FIT_FLOOR.other) };
}
// A short phone box cannot be stretched into a strip. Prefer a legal grid
// that keeps every face on this screen. Scroll only when the minimum tile
// cannot hold them all.
function phoneFit(box, list, tier) {
  const n = list.length;
  const maxA = aspectMax(true);
  const minSide = MIN_SIDE.phone;
  let pick = null;
  for (let rows = 1; rows <= n; rows++) {
    const cols = Math.ceil(n / rows);
    const h = box.h / rows;
    if (h + 0.5 < minSide) continue;
    const maxW = h * maxA;
    const minW = Math.min(maxW, h * ASPECT_MIN);
    const equalW = box.w / cols;
    let tileW = 0;
    if (equalW >= minW && equalW <= maxW) tileW = equalW;
    else if (equalW > maxW && cols * maxW <= box.w + 0.5) tileW = maxW;
    else continue;
    if (Math.min(tileW, h) + 0.5 < minSide) continue;
    const area = tileW * h;
    if (!pick || area > pick.area) pick = { rows: rows, cols: cols, h: h, tileW: tileW, area: area };
  }
  let h = box.h, cols = 1, tileW = box.w, rows = n;
  if (pick) { h = pick.h; cols = pick.cols; tileW = pick.tileW; rows = pick.rows; }
  else {
    if (!(h >= minSide)) h = minSide;
    const maxW = h * maxA;
    // As many faces across as a legal tile allows, not the widest tiles: a
    // sideways SE's 148px band holds five 109px faces, not three 155px ones.
    const minW = Math.max(minSide, h * ASPECT_MIN);
    cols = Math.max(1, Math.min(n, Math.floor(box.w / Math.max(1, Math.min(minW, box.w)))));
    tileW = Math.min(maxW, box.w / cols);
    rows = Math.ceil(n / cols);
  }
  const tiles = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const x0 = box.x + (box.w - inRow * tileW) / 2;
    const a = list[i].aspect || (16 / 9), t = tileW / h, keep = Math.min(t / a, a / t);
    tiles.push({
      id: list[i].id, x: x0 + c * tileW, y: box.y + r * h, w: tileW, h: h, tier: tier,
      fit: keep >= keepNeeded(t, a) ? 'cover' : 'contain', objPos: a < t ? '50% 40%' : '50% 50%',
    });
  }
  const minShort = Math.min(tileW, h);
  return { tiles, rows: rows, split: tier === 'row' ? 1 : 0, contentH: rows * h, minShort: minShort, tooSmall: minShort < FIT_FLOOR.phone };
}
// Scroll: columns = most that keep the short side >= SCROLL_MIN at the
// median aspect; the region is as tall as it needs to be.
function scrollStad(box, stad, rowTiles, phone, y0, rowRows) {
  const min = phone ? SCROLL_MIN.phone : SCROLL_MIN.other, a = median(stad.map(t => t.aspect));
  // tile h = (W/c)/a must be >= min and W/c >= min
  const c = Math.max(1, Math.min(stad.length, Math.floor(box.w / Math.max(min, min * a))));
  const r = Math.ceil(stad.length / c), ta = Math.max(ASPECT_MIN, Math.min(aspectMax(phone), a));
  // every scroll row keeps the same tile shape: a shorter row gets taller tiles
  const counts = rowCounts(stad.length, r);
  const tiles = rowTiles.slice(); let i = 0, y = y0;
  counts.forEach((k) => { const w = box.w / k, h = w / ta; for (let j = 0; j < k; j++, i++) {
    const sa = stad[i].aspect, keep = Math.min(ta / sa, sa / ta);
    tiles.push({ id: stad[i].id, x: box.x + j * w, y, w, h, tier: 'stad', fit: keep >= T.KMIN ? 'cover' : 'contain', objPos: '50% 40%' }); } y += h; });
  const rb = { h: y - y0 };
  return { tiles, rows: (rowRows || 0) + '+' + r, split: null, contentH: y0 - box.y + rb.h, minShort: Math.min(...tiles.map(t => Math.min(t.w, t.h))), tooSmall: false };
}

// Stage: screen share gets priority. Share alone -> whole stage. Share + k
// videos -> share takes 75% along the long axis, the videos pack the rest.
// No share -> pack all stage videos.
function stageParts(sb, stage, phone) {
  const share = stage.find(s => s.share), vids = stage.filter(s => !s.share);
  if (!share || !vids.length) return [[sb, share ? [share] : vids]];
  const wide = sb.w >= sb.h;
  // share gets 75%, or the closest fraction in 60..85% that leaves legal tile shapes for the videos
  const rest = f => wide ? { x: 0, y: 0, w: sb.w * (1 - f), h: sb.h } : { x: 0, y: 0, w: sb.w, h: sb.h * (1 - f) };
  let f = 0.75;
  for (const g of [0.75, 0.7, 0.8, 0.65, 0.85, 0.6]) { const c = chooseRows(rest(g), vids.map(v => v.aspect), null, null, phone); if (c && c.viol <= 1) { f = g; break; } }
  const a = wide ? { x: sb.x, y: sb.y, w: sb.w * f, h: sb.h } : { x: sb.x, y: sb.y, w: sb.w, h: sb.h * f };
  const b = wide ? { x: sb.x + a.w, y: sb.y, w: sb.w - a.w, h: sb.h } : { x: sb.x, y: sb.y + a.h, w: sb.w, h: sb.h - a.h };
  return [[a, [share]], [b, vids]];
}
function placeStage(sb, stage, phone) {
  const out = [];
  for (const [bx, items] of stageParts(sb, stage, phone)) {
    const p = packRegion(bx, items.map(s => s.aspect), { phone: phone });
    items.forEach((s, i) => out.push({ id: s.id, share: !!s.share, ...p.rects[i], fit: s.share ? 'contain' : p.rects[i].fit }));
  }
  return out;
}
function stageViol(sb, stage, phone) {
  let v = 1;
  for (const [bx, items] of stageParts(sb, stage, phone)) { if (items.length === 1 && items[0].share) continue; const c = chooseRows(bx, items.map(i => i.aspect), null, null, phone); if (c) v = Math.max(v, c.viol); }
  return v;
}
function stageScore(sb, stage, phone) {
  let s = 0;
  for (const [bx, items] of stageParts(sb, stage, phone)) {
    if (items.length === 1 && items[0].share) { // a share is shown whole (contain): score only the pixels it really uses
      const a = items[0].aspect, t = bx.w / bx.h; s += bx.w * bx.h * Math.min(t / a, a / t); continue;
    }
    const c = chooseRows(bx, items.map(i => i.aspect), null, null, phone); s += c ? c.score : 0;
  }
  return s;
}

// ---------- Face-aware crop (orientation conversion) ----------
// Sender-side: each client runs a face detector on ITS OWN camera at ~2 Hz
// (FaceDetector API when present, else MediaPipe face_detector in a worker,
// else none) and gossips face = {cx, cy, s} (normalised centre + face height)
// in the status heartbeat. Receivers do no ML: they only crop.
// Receiver smoothing: exponential, half-life 600 ms, 4% dead-band, so a
// 2 Hz box glides instead of jumping. Fallback: centre-top bias (0.5, 0.38).
const FACE_DEFAULT = { cx: 0.5, cy: 0.38, s: 0.3 };
const FACE_MARGIN = 1.8; // crop must contain the face box grown 1.8x (head + some shoulders)
function smoothFace(prev, meas, dtMs) {
  if (!meas) return prev || null;
  if (!prev) return { ...meas };
  const k = 1 - Math.pow(0.5, dtMs / 600);
  const step = (a, b) => Math.abs(b - a) < 0.04 ? a : a + (b - a) * k;
  return { cx: step(prev.cx, meas.cx), cy: step(prev.cy, meas.cy), s: step(prev.s, meas.s) };
}
// Source-normalised crop window for a tile of aspect t from a source of aspect a.
// Returns {x,y,w,h} in 0..1 of the source, or {contain:true} when even the
// best-placed crop would cut the (grown) face box or keep < KMIN.
function cropFor(a, t, face) {
  const f = face || FACE_DEFAULT;
  const keep = Math.min(t / a, a / t);
  let w = 1, h = 1;
  if (t < a) w = t / a; else h = a / t;            // cover window
  if (keep < keepNeeded(t, a)) return { contain: true, keep };
  const fh = Math.min(1, f.s * FACE_MARGIN);
  const fwN = Math.min(1, f.s * 0.8 * FACE_MARGIN / a); // width in normalised source units
  if (fwN > w + 1e-9 || fh > h + 1e-9) return { contain: true, keep, reason: 'face' };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const x = clamp(f.cx - w / 2, 0, 1 - w), y = clamp(f.cy - h * 0.45, 0, 1 - h); // face sits slightly above centre
  return { x, y, w, h, keep };
}

// ---------- Pinch-zoom & pan (your own row only) ----------
// State per tile key in a Map; survives re-layout/mode switches, reset on leave.
// Zoom composes ON TOP of the face crop: the view is a sub-window of the crop.
const ZOOM = { MIN: 1, MAX: 4, DOUBLE_TAP: 2.5 };
function canZoom(tile) { return !!tile && tile.tier === 'row' && tile.quality === 'hi' && !tile.more; }
class ZoomStore {
  constructor() { this.m = new Map(); }
  get(id) { return this.m.get(id) || { s: 1, x: 0.5, y: 0.5 }; } // x,y = view centre in crop units
  // pinch/wheel: scale by factor around focal point (fx,fy in 0..1 of the tile)
  zoom(tile, factor, fx = 0.5, fy = 0.5) {
    if (!canZoom(tile)) return null;
    const z = this.get(tile.id), s2 = Math.max(ZOOM.MIN, Math.min(ZOOM.MAX, z.s * factor));
    // keep the focal point fixed on screen
    const px = z.x + (fx - 0.5) / z.s, py = z.y + (fy - 0.5) / z.s;
    const n = clampView({ s: s2, x: px - (fx - 0.5) / s2, y: py - (fy - 0.5) / s2 });
    this.set(tile.id, n); return n;
  }
  pan(tile, dxTile, dyTile) { // drag in tile fractions; only when zoomed
    if (!canZoom(tile)) return null;
    const z = this.get(tile.id); if (z.s <= 1) return z;
    const n = clampView({ s: z.s, x: z.x - dxTile / z.s, y: z.y - dyTile / z.s }); this.set(tile.id, n); return n;
  }
  doubleTap(tile, fx = 0.5, fy = 0.5) {
    if (!canZoom(tile)) return null;
    const z = this.get(tile.id);
    if (z.s > 1) { this.m.delete(tile.id); return this.get(tile.id); }
    return this.zoom(tile, ZOOM.DOUBLE_TAP, fx, fy);
  }
  set(id, z) { if (z.s <= 1.0001) this.m.delete(id); else this.m.set(id, z); }
  leave(id) { this.m.delete(id); }
}
function clampView(z) { const h = 0.5 / z.s; return { s: z.s, x: Math.max(h, Math.min(1 - h, z.x)), y: Math.max(h, Math.min(1 - h, z.y)) }; }
// Final source window = crop window, then the zoom sub-window inside it.
function viewWindow(crop, z) {
  if (!crop || crop.contain || !z || z.s <= 1) return crop;
  const w = crop.w / z.s, h = crop.h / z.s;
  return { x: crop.x + (z.x - 0.5 / z.s) * crop.w, y: crop.y + (z.y - 0.5 / z.s) * crop.h, w, h, keep: crop.keep };
}

return { TUNE_REV2, ASPECT_MIN, ASPECT_MAX, candidates, cellsFor, setTune, TUNE, TUNE_V1, smoothFace, cropFor, FACE_DEFAULT, ZoomStore, canZoom, viewWindow, ZOOM, twoTier, SCROLL_MIN, FIT_FLOOR, TIER_RATIO, fitArea, rowCounts, chooseRows, packRegion, capacity, Order, layout, MIN_SIDE, CROP_KEEP_MIN };

});
