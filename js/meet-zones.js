/*
 * meet-zones.js — 0.9.23b geometry: Stage, Row, Stadium. Pure, no DOM.
 *
 * The Row is always there (you are always in your own row). The Stage and
 * the Stadium only take space when they have someone in them.
 *   Stage:   true aspect (a shared screen stays 16:9), contain-fit.
 *   Row:     squares, the largest centered square of whatever arrives.
 *   Stadium: one composite. With no Stage, Fit gives it a share of the
 *            screen that follows stadCount: about half when the stadium and
 *            the row hold the same number, more as the stadium grows, and
 *            never past about two thirds. A missing count is treated as
 *            equal to the row. An implied person inside the composite stays
 *            near a row tile, in Fit and in Scroll. Scroll is a full-width
 *            square until that cap, then a smaller centered square. Beside
 *            a Stage the stadium stays the small square.
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

  function perLine(w, side, gap) { return Math.max(1, Math.floor((w + gap) / (side + gap))); }
  function lastCount(n, per) { const r = n % per; return r === 0 ? per : r; }
  // Beside a share, do not leave one face on a line of its own (2/2/1, or
  // five then one) when another count fills every line. Fewer across keeps
  // the square; one more across shrinks it so the extra column fits.
  function choosePer(n, w, side, gap, avoidLone) {
    const fit = Math.max(1, perLine(w, Math.max(1, side), gap));
    const per = Math.min(fit, Math.max(1, n));
    // One across is a column: every line holds one face, none is left alone.
    if (!avoidLone || !(n > 1) || per === 1 || lastCount(n, per) !== 1) return { per: per, side: side };
    for (let p = per - 1; p >= 2; p--) {
      if (lastCount(n, p) !== 1) return { per: p, side: side };
    }
    for (let p = per + 1; p <= n; p++) {
      if (lastCount(n, p) === 1) continue;
      const shrunk = Math.floor((w - (p - 1) * gap) / p);
      if (shrunk >= 1) return { per: p, side: shrunk };
    }
    return { per: per, side: side };
  }

  // The side that fills a line exactly with as many tiles as fit at `side`.
  function snap(w, side, gap) {
    const k = perLine(w, side, gap);
    return Math.min(side * 1.25, (w - (k - 1) * gap) / k);
  }

  // Height the people area needs with Row side s and Stadium side t.
  function peopleH(nr, ns, w, s, t, gap, avoidLone) {
    const rs = nr ? choosePer(nr, w, s, gap, avoidLone) : null;
    const ts = ns ? choosePer(ns, w, t, gap, avoidLone) : null;
    const lr = rs ? Math.ceil(nr / rs.per) : 0;
    const ls = ts ? Math.ceil(ns / ts.per) : 0;
    const sh = rs ? rs.side : 0, th = ts ? ts.side : 0;
    let h = 0;
    if (lr) h += lr * sh + (lr - 1) * gap;
    if (ls) h += (h ? gap : 0) + ls * th + (ls - 1) * gap;
    return h;
  }

  // Largest Row side that fits (Fit). Stadium follows at STAD_RATIO.
  function fitSide(nr, ns, w, h, gap, avoidLone) {
    let lo = 1, hi = Math.max(1, Math.min(w, h));
    if (!ns && nr === 1) return Math.floor(hi);
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const t = ns ? Math.max(1, mid * STAD_RATIO) : 0;
      if (peopleH(nr, ns, w, mid, t, gap, avoidLone) <= h) lo = mid; else hi = mid;
    }
    return Math.floor(lo);
  }

  // Lay n squares of side `side` in centered lines from y. Returns the rects
  // and the y under the last line.
  function flow(ids, tier, box, side, y, gap, avoidLone) {
    const out = [];
    const picked = choosePer(ids.length, box.w, side, gap, avoidLone);
    side = picked.side;
    const per = picked.per;
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

  // Group rects into rows that share a y.
  function rowsOf(rects) {
    const rows = [];
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      let row = null;
      for (let k = 0; k < rows.length; k++) if (Math.abs(rows[k].y - r.y) < 0.5) row = rows[k];
      if (!row) { row = { y: r.y, items: [] }; rows.push(row); }
      row.items.push(r);
    }
    rows.sort((a, b) => a.y - b.y);
    return rows;
  }

  // Fit leaves no empty band under the last row. Leftover height goes into
  // the rows, so the dock floats over the bottom faces instead of sitting
  // past them. Width stays, so a square that already fills the height stays
  // a square. Scroll is unchanged.
  function fillBand(rects, box, gap) {
    if (!rects.length) return;
    const rows = rowsOf(rects);
    let bottom = box.y;
    for (let i = 0; i < rects.length; i++) bottom = Math.max(bottom, rects[i].y + rects[i].h);
    const slack = box.y + box.h - bottom;
    if (slack <= 1) return;
    const extra = slack / rows.length;
    let y = box.y;
    for (let i = 0; i < rows.length; i++) {
      const h = rows[i].items[0].h + extra;
      for (let j = 0; j < rows[i].items.length; j++) {
        rows[i].items[j].y = y;
        rows[i].items[j].h = h;
      }
      y += h + gap;
    }
  }

  // A people column beside a share is centered, which left a strip past the
  // last face. Shift each row so it ends on the box edge. The share already
  // meets the other edge, so the tiles together reach both sides.
  function pinEnd(rects, box) {
    const rows = rowsOf(rects);
    const edge = box.x + box.w;
    for (let k = 0; k < rows.length; k++) {
      let right = -Infinity;
      for (let j = 0; j < rows[k].items.length; j++) {
        const r = rows[k].items[j];
        right = Math.max(right, r.x + r.w);
      }
      const shift = edge - right;
      if (shift > 0.5) for (let j = 0; j < rows[k].items.length; j++) rows[k].items[j].x += shift;
    }
  }

  // Squares of `side`, `per` across, short lines centered. Does not go back
  // through perLine: a side that fills the width lands on n.999 and floors
  // to one fewer column.
  function placeRows(ids, box, side, per, y, gap) {
    const out = [];
    const n = Math.max(1, per | 0);
    for (let i = 0; i < ids.length; i += n) {
      const k = Math.min(n, ids.length - i);
      const lineW = k * side + (k - 1) * gap;
      let x = box.x + (box.w - lineW) / 2;
      for (let j = 0; j < k; j++) {
        out.push({ id: ids[i + j], tier: 'row', x: x, y: y, w: side, h: side, fit: 'cover' });
        x += side + gap;
      }
      y += side + gap;
    }
    return { rects: out, y: ids.length ? y - gap : y };
  }

  // A forgotten count shares the screen about in half. It does not
  // postage-stamp, and it does not take the rest of the screen.
  function faceCount(stadCount, rowN) {
    return stadCount > 0 ? stadCount | 0 : Math.max(1, rowN);
  }

  // Equal counts are half. A larger stadium grows toward two thirds.
  // A smaller one falls toward 0.28.
  function stadShare(rowN, stadN) {
    const ratio = stadN / Math.max(1, rowN);
    let share = ratio >= 1 ? 0.5 + (1 / 6) * (1 - 1 / ratio) : 0.28 + 0.22 * ratio;
    if (share > 2 / 3) share = 2 / 3;
    if (share < 0.28) share = 0.28;
    return share;
  }

  function gridOf(n) {
    const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, n))));
    const rows = Math.max(1, Math.ceil(Math.max(1, n) / cols));
    return { cols: cols, rows: rows };
  }

  // Estimated cell if the one video were a grid. The video is not cut.
  function cellOf(w, h, n) {
    const g = gridOf(n);
    return Math.min(w / g.cols, h / g.rows);
  }

  // Shrink the side that sets the cell, once, so a person in the composite
  // is not past a row tile. 1.15 keeps a 4% gap from thrashing five and five.
  function capBox(w, h, faces, rowSide) {
    const limit = rowSide * 1.15;
    const g = gridOf(faces);
    const cw = w / g.cols, ch = h / g.rows;
    if (Math.min(cw, ch) <= limit + 0.5) return { w: w, h: h };
    if (cw <= ch) return { w: Math.min(w, limit * g.cols), h: h };
    return { w: w, h: Math.min(h, limit * g.rows) };
  }

  // The row keeps a readable band before the stadium takes its share.
  function minRowBand(n, w, gap) {
    const floor = 64;
    let per = Math.floor((w + gap) / (floor + gap));
    if (!(per >= 1)) per = 1;
    if (per > n) per = n;
    const side = Math.min(floor, (w - (per - 1) * gap) / per);
    const lines = Math.ceil(n / per);
    return lines * Math.max(1, side) + (lines - 1) * gap;
  }

  // Squares that fit in maxH. A full last line wins, then a larger face.
  // If nothing fits, the side shrinks so the line stays inside the band.
  function packChoice(n, w, maxH, gap) {
    let best = null;
    for (let per = 1; per <= n; per++) {
      const side = (w - (per - 1) * gap) / per;
      if (!(side > 1)) continue;
      const lines = Math.ceil(n / per);
      const rowH = lines * side + (lines - 1) * gap;
      const fits = rowH <= maxH + 0.5;
      if (!fits && per !== n) continue;
      const last = n % per || per;
      const slack = (w - (last * side + (last - 1) * gap)) / Math.max(1, w);
      const score = (fits ? 1000 : 0) + (1 - Math.max(0, Math.min(1, slack))) * 400 + side;
      if (!best || score > best.score) best = { per: per, side: side, slack: slack, last: last, fits: fits, lines: lines, score: score };
    }
    if (!best) {
      const side = Math.max(1, (w - (Math.max(1, n) - 1) * gap) / Math.max(1, n));
      best = { per: Math.max(1, n), side: side, slack: 0, last: n, fits: false, lines: 1 };
    }
    if (!best.fits) {
      const maxSide = (maxH - (best.lines - 1) * gap) / best.lines;
      if (maxSide > 1 && maxSide < best.side) best = { per: best.per, side: maxSide, slack: best.slack, last: best.last, fits: true, lines: best.lines };
    }
    return best;
  }

  // A packing the person cap already allows keeps five and five near half.
  // A line of one face is not that packing. Otherwise the slack-first
  // packing stands and the stadium shrinks once.
  function packFor(n, w, maxH, gap, stadW, stadH, faces) {
    const natural = packChoice(n, w, maxH, gap);
    if (cellOf(stadW, stadH, faces) <= natural.side * 1.15 + 0.5) return natural;
    let alt = null;
    for (let per = 1; per <= n; per++) {
      const side = (w - (per - 1) * gap) / per;
      if (!(side > 1)) continue;
      const lines = Math.ceil(n / per);
      const rowH = lines * side + (lines - 1) * gap;
      if (rowH > maxH + 0.5) continue;
      const last = n % per || per;
      if (last === 1 && n > 1) continue;
      const slack = (w - (last * side + (last - 1) * gap)) / Math.max(1, w);
      if (slack > 0.45) continue;
      if (cellOf(stadW, stadH, faces) > side * 1.15 + 0.5) continue;
      const score = (1 - Math.max(0, slack)) * 400 + side;
      if (!alt || score > alt.score) alt = { per: per, side: side, slack: slack, last: last, fits: true, lines: lines };
    }
    return alt || natural;
  }

  // One composite, and no Stage. Fit's share follows the face count. Scroll
  // keeps the row size it already had and starts from a full-width square,
  // then both stop when a person inside the composite would be larger than
  // a row tile. The row is repacked once into the band that shrink frees.
  function compositePeople(row, stad, box, phone, gallery, gap, stadCount) {
    const nr = row.length;
    const id = stad[0];
    const faces = faceCount(stadCount, nr);
    if (gallery === 'scroll') {
      const k = phone ? 'phone' : 'desk';
      let s = nr ? Math.min(box.w, Math.max(SCROLL_ROW_MIN[k], fitSide(nr, 0, box.w, box.h, gap))) : 0;
      if (nr) s = phone && s <= box.h ? Math.min(box.h, snap(box.w, s, gap)) : snap(box.w, s, gap);
      const a = nr ? flow(row, 'row', box, s, box.y, gap, false) : { rects: [], y: box.y };
      const y = a.rects.length ? a.y + gap : box.y;
      let side = box.w;
      if (nr) {
        const g = gridOf(faces);
        const span = Math.max(g.cols, g.rows);
        const limit = s * 1.15;
        if (side / span > limit) side = Math.min(box.w, limit * span);
      }
      const x = box.x + (box.w - side) / 2;
      const st = { id: id, tier: 'stad', x: x, y: y, w: side, h: side, fit: 'contain' };
      const total = (y - box.y) + side;
      return { rects: a.rects.concat([st]), contentH: Math.max(box.h, total), side: s, stadSide: side, tooSmall: side < 28 };
    }
    if (!nr) {
      const st = { id: id, tier: 'stad', x: box.x, y: box.y, w: box.w, h: box.h, fit: 'contain' };
      return { rects: [st], contentH: box.h, side: 0, stadSide: Math.min(box.w, box.h), tooSmall: Math.min(box.w, box.h) < 28 };
    }
    const share = stadShare(nr, faces);
    const wide = box.w >= box.h * 1.05;
    if (!wide) {
      let stadH = box.h * share;
      const room = box.h - gap - minRowBand(nr, box.w, gap);
      if (stadH > room) stadH = Math.max(box.h * 0.28, room);
      let rowH = Math.max(1, box.h - stadH - gap);
      let picked = packFor(nr, box.w, rowH, gap, box.w, stadH, faces);
      let stadW = box.w;
      const capped = capBox(stadW, stadH, faces, picked.side);
      const changed = Math.abs(capped.w - stadW) > 0.5 || Math.abs(capped.h - stadH) > 0.5;
      stadW = capped.w;
      stadH = capped.h;
      if (changed) {
        rowH = Math.max(1, box.h - stadH - gap);
        picked = packChoice(nr, box.w, rowH, gap);
      }
      const rowBox = { x: box.x, y: box.y, w: box.w, h: rowH };
      const a = placeRows(row, rowBox, picked.side, picked.per, rowBox.y, gap);
      fillBand(a.rects, rowBox, gap);
      const st = { id: id, tier: 'stad', x: box.x + (box.w - stadW) / 2, y: box.y + rowH + gap, w: stadW, h: stadH, fit: 'contain' };
      return { rects: a.rects.concat([st]), contentH: box.h, side: picked.side, stadSide: Math.min(st.w, st.h), tooSmall: Math.min(st.w, st.h) < 28 };
    }
    let stadW = Math.min(box.w * share, box.w * 2 / 3);
    if (box.w - stadW - gap < 72) stadW = Math.max(1, box.w - gap - 72);
    let colW = box.w - stadW - gap;
    let stadH = box.h;
    let picked = packFor(nr, colW, box.h, gap, stadW, stadH, faces);
    const capped = capBox(stadW, stadH, faces, picked.side);
    const changed = Math.abs(capped.w - stadW) > 0.5 || Math.abs(capped.h - stadH) > 0.5;
    stadW = capped.w;
    stadH = capped.h;
    colW = box.w - stadW - gap;
    if (changed) picked = packChoice(nr, colW, box.h, gap);
    const col = { x: box.x, y: box.y, w: colW, h: box.h };
    const a = placeRows(row, col, picked.side, picked.per, col.y, gap);
    fillBand(a.rects, col, gap);
    const st = { id: id, tier: 'stad', x: box.x + box.w - stadW, y: box.y, w: stadW, h: stadH, fit: 'contain' };
    return { rects: a.rects.concat([st]), contentH: box.h, side: picked.side, stadSide: Math.min(st.w, st.h), tooSmall: Math.min(st.w, st.h) < 28 };
  }

  function people(row, stad, box, phone, gallery, gap, avoidLone, stadCount) {
    // A Stage keeps the small stadium. One composite with no Stage does not.
    if (stad.length === 1 && !avoidLone) return compositePeople(row, stad, box, phone, gallery, gap, stadCount);
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
      // Grow toward FIT_ROW_MIN when the larger faces still fit. If they
      // would scroll off a screen the fitted faces already fill, keep the
      // fitted side so the dock floats over the last row instead.
      const k2 = phone ? 'phone' : 'desk';
      const rowMin = Math.min(box.w, FIT_ROW_MIN[k2]);
      if (s < rowMin) {
        const bumped = snap(box.w, rowMin, gap);
        const tBump = ns ? snap(box.w, Math.min(bumped, Math.max(FIT_STAD_MIN[k2], bumped * STAD_RATIO)), gap) : 0;
        if (peopleH(nr, ns, box.w, bumped, tBump, gap, avoidLone) <= box.h + 1) {
          s = bumped;
          t = tBump;
        }
      } else if (ns && t < FIT_STAD_MIN[k2]) {
        // The Row keeps its size; a crowd of small Stadium faces scrolls.
        t = snap(box.w, FIT_STAD_MIN[k2], gap);
      }
    }
    if (avoidLone) {
      s = choosePer(nr, box.w, s, gap, true).side;
      if (ns) {
        const cap = Math.max(1, Math.floor(s * STAD_RATIO));
        t = Math.min(t, cap);
        t = choosePer(ns, box.w, t, gap, true).side;
        if (t > cap) t = cap;
      }
    }
    const total = peopleH(nr, ns, box.w, s, t, gap, avoidLone);
    // Both modes start at the top of the band. Fit then absorbs leftover
    // height so the block meets the bottom edge.
    let y = box.y;
    const a = flow(row, 'row', box, s, y, gap, avoidLone);
    y = a.y + (a.rects.length && ns ? gap : 0);
    const b = flow(stad, 'stad', box, t, y, gap, avoidLone);
    const rects = a.rects.concat(b.rects);
    if (gallery !== 'scroll') fillBand(rects, box, gap);
    return { rects: rects, contentH: Math.max(box.h, total), side: s, stadSide: t, tooSmall: ns > 0 && t < 28 };
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

  // opts: { box:{x,y,w,h}, stage:[{id,aspect,fill}], row:[id], stad:[id], phone, gallery, gap, floor, stadCount }
  // stadCount is how many people are inside the one composite. Omit it and
  // Fit shares the screen about in half with the row.
  // floor: side by side, the Stage may run down to this y (past box, under
  // the call's buttons, which then wake over it instead of moving it).
  function layout(opts) {
    const box = opts.box;
    const gap = opts.gap != null ? opts.gap : (opts.phone ? 4 : GAP);
    const stage = opts.stage || [], row = opts.row || [], stad = opts.stad || [];
    const gallery = opts.gallery === 'scroll' ? 'scroll' : 'fit';
    const phone = !!opts.phone;
    if (!stage.length) {
      const p = people(row, stad, box, phone, gallery, gap, false, opts.stadCount);
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
    const p = people(row, stad, pb, phone, gallery, gap, true);
    if (wide && gallery !== 'scroll') pinEnd(p.rects, pb);
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
