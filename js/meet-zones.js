/*
 * meet-zones.js — 0.9.23b geometry: Stage, Row, Stadium. Pure, no DOM.
 *
 * The Row is always there (you are always in your own row). The Stage and
 * the Stadium only take space when they have someone in them.
 *   Stage:   true aspect (a shared screen stays 16:9), contain-fit.
 *   Row:     squares, the largest centered square of whatever arrives.
 *   Stadium: smaller squares under the Row.
 * Fit puts everyone on one screen. Scroll keeps faces big and lets the
 * people area scroll.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  const GifOS = root.GifOS = root.GifOS || {};
  GifOS.meetZones = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const GAP = 8;
  // Stadium squares are this share of a Row square, and never bigger.
  const STAD_RATIO = 0.5;
  // Scroll keeps faces at least this big (px).
  const SCROLL_ROW_MIN = { desk: 180, phone: 150 };
  const SCROLL_STAD_MIN = { desk: 90, phone: 72 };
  // Fit's floor: below this a face is not readable, so the rest scroll.
  const FIT_ROW_MIN = { desk: 96, phone: 96 };
  const FIT_STAD_MIN = { desk: 40, phone: 40 };

  function lines(n, perLine) { return n > 0 ? Math.ceil(n / Math.max(1, perLine)) : 0; }
  function perLine(w, side, gap) { return Math.max(1, Math.floor((w + gap) / (side + gap))); }

  // The side that fills a line exactly with as many tiles as fit at `side`.
  function snap(w, side, gap) {
    const k = perLine(w, side, gap);
    return Math.min(side * 1.25, (w - (k - 1) * gap) / k);
  }

  // Height the people area needs with Row side s and Stadium side t.
  function peopleH(nr, ns, w, s, t, gap) {
    const lr = lines(nr, perLine(w, s, gap));
    const ls = lines(ns, perLine(w, t, gap));
    let h = 0;
    if (lr) h += lr * s + (lr - 1) * gap;
    if (ls) h += (h ? gap : 0) + ls * t + (ls - 1) * gap;
    return h;
  }

  // Largest Row side that fits (Fit). Stadium follows at STAD_RATIO.
  function fitSide(nr, ns, w, h, gap) {
    let lo = 1, hi = Math.max(1, Math.min(w, h));
    if (!ns && nr === 1) return Math.floor(hi);
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const t = ns ? Math.max(1, mid * STAD_RATIO) : 0;
      if (peopleH(nr, ns, w, mid, t, gap) <= h) lo = mid; else hi = mid;
    }
    return Math.floor(lo);
  }

  // Lay n squares of side `side` in centered lines from y. Returns the rects
  // and the y under the last line.
  function flow(ids, tier, box, side, y, gap) {
    const out = [];
    const per = perLine(box.w, side, gap);
    for (let i = 0; i < ids.length; i += per) {
      const k = Math.min(per, ids.length - i);
      const lineW = k * side + (k - 1) * gap;
      let x = box.x + (box.w - lineW) / 2;
      for (let j = 0; j < k; j++) {
        out.push({ id: ids[i + j], tier: tier, x: x, y: y, w: side, h: side, fit: 'cover' });
        x += side + gap;
      }
      y += side + gap;
    }
    return { rects: out, y: ids.length ? y - gap : y };
  }

  function people(row, stad, box, phone, gallery, gap) {
    const nr = row.length, ns = stad.length;
    let s, t;
    if (gallery === 'scroll') {
      const k = phone ? 'phone' : 'desk';
      // Never below the comfort size, and snapped so a line fills the width.
      s = Math.min(box.w, Math.max(SCROLL_ROW_MIN[k], fitSide(nr, 0, box.w, box.h, gap)));
      // Sideways, filling the width made two faces 329px in a 263px band, cut by the screen's edge.
      s = phone && s <= box.h ? Math.min(box.h, snap(box.w, s, gap)) : snap(box.w, s, gap);
      t = ns ? snap(box.w, Math.min(s, Math.max(SCROLL_STAD_MIN[k], s * STAD_RATIO)), gap) : 0;
    } else {
      s = fitSide(nr, ns, box.w, box.h, gap);
      t = ns ? Math.max(1, Math.floor(s * STAD_RATIO)) : 0;
      // A face is never smaller than FIT_ROW_MIN: when everyone cannot fit
      // at that size, the whole faces that fit show and the rest scroll.
      const k2 = phone ? 'phone' : 'desk';
      const rowMin = Math.min(box.w, FIT_ROW_MIN[k2]);
      if (s < rowMin) {
        s = snap(box.w, rowMin, gap);
        t = ns ? snap(box.w, Math.min(s, Math.max(FIT_STAD_MIN[k2], s * STAD_RATIO)), gap) : 0;
      } else if (ns && t < FIT_STAD_MIN[k2]) {
        // The Row keeps its size; a crowd of small Stadium faces scrolls.
        t = snap(box.w, FIT_STAD_MIN[k2], gap);
      }
    }
    const total = peopleH(nr, ns, box.w, s, t, gap);
    // Fit centers the block; Scroll starts at the top.
    let y = box.y + (gallery === 'scroll' ? 0 : Math.max(0, (box.h - total) / 2));
    const a = flow(row, 'row', box, s, y, gap);
    y = a.y + (a.rects.length && ns ? gap : 0);
    const b = flow(stad, 'stad', box, t, y, gap);
    return { rects: a.rects.concat(b.rects), contentH: Math.max(box.h, total), side: s, stadSide: t, tooSmall: ns > 0 && t < 28 };
  }

  // Stage items at their true aspect, side by side (or stacked when that is
  // bigger), each contain-fit and centered in its cell. A `fill` item (an app
  // in the meeting) has no aspect of its own and takes its whole cell.
  // top: the Stage hugs the top of its band (a phone, where the header sits
  // right above it) instead of centring in it.
  function stageRects(items, box, gap, top) {
    const n = items.length;
    if (!n) return [];
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const cw = (box.w - (cols - 1) * gap) / cols, ch = (box.h - (rows - 1) * gap) / rows;
      if (cw <= 0 || ch <= 0) continue;
      let area = 0;
      for (let i = 0; i < n; i++) {
        if (items[i].fill) { area += cw * ch; continue; }
        const a = items[i].aspect > 0 ? items[i].aspect : 16 / 9;
        const w = Math.min(cw, ch * a);
        area += w * (w / a);
      }
      if (!best || area > best.area) best = { cols: cols, rows: rows, cw: cw, ch: ch, area: area };
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = items[i].aspect > 0 ? items[i].aspect : 16 / 9;
      const r = Math.floor(i / best.cols), c = i % best.cols;
      const inRow = Math.min(best.cols, n - r * best.cols);
      const rowW = inRow * best.cw + (inRow - 1) * gap;
      const x0 = box.x + (box.w - rowW) / 2 + c * (best.cw + gap);
      const y0 = box.y + (top ? 0 : (box.h - (best.rows * best.ch + (best.rows - 1) * gap)) / 2) + r * (best.ch + gap);
      const w = items[i].fill ? best.cw : Math.min(best.cw, best.ch * a);
      const h = items[i].fill ? best.ch : w / a;
      out.push({ id: items[i].id, tier: 'stage', x: x0 + (best.cw - w) / 2, y: y0 + (top ? 0 : (best.ch - h) / 2), w: w, h: h, fit: 'contain' });
    }
    return out;
  }

  // opts: { box:{x,y,w,h}, stage:[{id,aspect,fill}], row:[id], stad:[id], phone, gallery, gap, floor }
  // floor: side by side, the Stage may run down to this y (past box, under
  // the call's buttons, which then wake over it instead of moving it).
  function layout(opts) {
    const box = opts.box;
    const gap = opts.gap != null ? opts.gap : (opts.phone ? 4 : GAP);
    const stage = opts.stage || [], row = opts.row || [], stad = opts.stad || [];
    const gallery = opts.gallery === 'scroll' ? 'scroll' : 'fit';
    const phone = !!opts.phone;
    if (!stage.length) {
      const p = people(row, stad, box, phone, gallery, gap);
      return { rects: p.rects, contentH: p.contentH, regions: { stage: null, people: box }, side: p.side, stadSide: p.stadSide, tooSmall: p.tooSmall && gallery === 'fit', gallery: gallery };
    }
    // With a Stage: side by side when the screen is wide, stacked when tall.
    // The people get a band sized for their squares; the Stage takes the rest.
    const wide = box.w >= box.h * 1.15;
    const n = row.length + stad.length;
    let sb, pb, sr;
    if (wide) {
      // Sideways the Stage is the whole left side and the people stand on
      // the right. A picture narrower than its side moves flush left and the
      // width it leaves goes to the people.
      const frac = n <= 1 ? 0.2 : n <= 4 ? 0.24 : 0.3;
      const pw = Math.round(Math.max(phone ? 110 : 160, Math.min(box.w * frac, phone ? 260 : 440)));
      const sh = opts.floor > box.y + box.h ? opts.floor - box.y : box.h;
      sb = { x: box.x, y: box.y, w: box.w - pw - gap, h: sh };
      sr = stageRects(stage, sb, gap, phone);
      let x0 = Infinity, x1 = -Infinity;
      for (let i = 0; i < sr.length; i++) { x0 = Math.min(x0, sr[i].x); x1 = Math.max(x1, sr[i].x + sr[i].w); }
      const used = Math.round(x1 - x0);
      if (used < sb.w) {
        for (let i = 0; i < sr.length; i++) sr[i].x -= x0 - sb.x;
        sb.w = used;
      }
      pb = { x: sb.x + sb.w + gap, y: box.y, w: box.x + box.w - (sb.x + sb.w + gap), h: box.h };
    } else {
      const fill = stage.length === 1 && !!stage[0].fill;
      const a = stage.length === 1 && stage[0].aspect > 0 ? stage[0].aspect : 16 / 9;
      // The Stage band is the picture's own height (never more than 62% of
      // the screen), so it sits right under the header with no empty band.
      // An app has no picture height: it takes the whole 62%.
      const want = fill ? box.h * 0.62 : Math.min(box.h * 0.62, box.w / a);
      const sh = Math.round(want);
      sb = { x: box.x, y: box.y, w: box.w, h: sh };
      pb = { x: box.x, y: box.y + sh + gap, w: box.w, h: Math.max(1, box.h - sh - gap) };
      sr = stageRects(stage, sb, gap, phone);
    }
    const p = people(row, stad, pb, phone, gallery, gap);
    const rects = sr.concat(p.rects);
    const contentH = (pb.y - box.y) + p.contentH;
    return { rects: rects, contentH: Math.max(box.h, contentH), regions: { stage: sb, people: pb }, side: p.side, stadSide: p.stadSide, tooSmall: p.tooSmall && gallery === 'fit', gallery: gallery };
  }

  // Viewer/sender crop: a square window inside the true frame.
  // crop = { x, y, s } in 0..1 of the frame: center (x, y) and side s as a
  // share of the frame's short side. Returns the video's CSS box inside a
  // square tile of side `side` (px) so that window fills the tile.
  function cropBox(vw, vh, crop, side) {
    if (!(vw > 0) || !(vh > 0) || !(side > 0)) return null;
    const c = normCrop(crop, vw, vh);
    const short = Math.min(vw, vh);
    const winPx = c.s * short;             // window side in source pixels
    const k = side / winPx;                // css px per source px
    const w = vw * k, h = vh * k;
    return { x: side / 2 - c.x * w, y: side / 2 - c.y * h, w: w, h: h };
  }

  // Keep the window inside the frame. Default: the largest centered square.
  function normCrop(crop, vw, vh) {
    const c = crop || {};
    const short = Math.min(vw || 1, vh || 1);
    let s = c.s > 0 ? Math.min(1, Math.max(0.15, c.s)) : 1;
    const hw = (s * short) / (vw || 1) / 2, hh = (s * short) / (vh || 1) / 2;
    const x = Math.min(1 - hw, Math.max(hw, c.x != null ? c.x : 0.5));
    const y = Math.min(1 - hh, Math.max(hh, c.y != null ? c.y : 0.5));
    return { x: x, y: y, s: s };
  }

  // Source-pixel rect of a crop (for the sender's canvas).
  function cropRect(vw, vh, crop) {
    const c = normCrop(crop, vw, vh);
    const side = c.s * Math.min(vw, vh);
    return { sx: c.x * vw - side / 2, sy: c.y * vh - side / 2, side: side };
  }

  function isDefault(crop) { return !crop || (!(crop.s > 0 && crop.s < 0.999) && Math.abs((crop.x != null ? crop.x : 0.5) - 0.5) < 1e-3 && Math.abs((crop.y != null ? crop.y : 0.5) - 0.5) < 1e-3); }

  return { GAP: GAP, STAD_RATIO: STAD_RATIO, layout: layout, people: people, stageRects: stageRects, fitSide: fitSide, cropBox: cropBox, normCrop: normCrop, cropRect: cropRect, isDefault: isDefault };
});
