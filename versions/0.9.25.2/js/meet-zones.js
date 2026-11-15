/*
 * meet-zones.js — 0.9.23b geometry: Stage, Row, Stadium. Pure, no DOM.
 *
 * The Row is always there (you are always in your own row). The Stage and
 * the Stadium only take space when they have someone in them.
 *   Stage:   people pack by count (1 true aspect, 2 squares, 3 hero+2
 *            squares, 4 a 2x2, 5 hero+2x2). A screen or an app is separate.
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
  function placeRows(ids, box, side, per, y, gap, width) {
    const out = [];
    const n = Math.max(1, per | 0);
    const tw = width > 0 ? width : side;
    for (let i = 0; i < ids.length; i += n) {
      const k = Math.min(n, ids.length - i);
      const lineW = k * tw + (k - 1) * gap;
      let x = box.x + (box.w - lineW) / 2;
      for (let j = 0; j < k; j++) {
        out.push({ id: ids[i + j], tier: 'row', x: x, y: y, w: tw, h: side, fit: 'cover' });
        x += tw + gap;
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

  // A row packing is judged by the tile it really draws. fillBand gives each
  // line the band's leftover height, so a square with height to spare is
  // drawn taller than wide: five squares on one line in a tall band became
  // five slivers a quarter as wide as tall (a real meeting in full screen, 0.9.25).
  // The face is the largest square inside the drawn tile, min(w, h). A
  // packing whose tile keeps a sane shape (SHAPE_MIN) beats one that does
  // not, then the larger face wins, and a full last line breaks near-ties.
  // A packing limited by height draws its tiles as wide as the line's cells
  // (up to 16:9, cover), so the lines still fill the width.
  const SHAPE_MIN = 0.5;
  const SHAPE_MAX = 16 / 9;
  const SLACK_WEIGHT = 40;
  function packings(n, w, maxH, gap) {
    const out = [];
    for (let per = 1; per <= n; per++) {
      const cw = (w - (per - 1) * gap) / per;
      if (!(cw > 1)) continue;
      const lines = Math.ceil(n / per);
      const ch = (maxH - (lines - 1) * gap) / lines;
      if (!(ch > 1)) continue;
      const side = Math.min(cw, ch);
      const tw = Math.min(cw, side * SHAPE_MAX); // drawn width
      const shape = tw / ch; // drawn width over drawn height after the fill
      const last = n % per || per;
      const slack = (w - (last * tw + (last - 1) * gap)) / Math.max(1, w);
      const score = (shape >= SHAPE_MIN - 1e-9 ? 100000 : 0) + side + (1 - Math.max(0, Math.min(1, slack))) * SLACK_WEIGHT;
      out.push({ per: per, side: side, w: tw, slack: slack, last: last, fits: true, lines: lines, shape: shape, score: score });
    }
    return out;
  }
  function packChoice(n, w, maxH, gap) {
    let best = null;
    for (const c of packings(n, w, maxH, gap)) if (!best || c.score > best.score) best = c;
    if (!best) {
      const per = Math.max(1, n);
      best = { per: per, side: Math.max(1, Math.min((w - (per - 1) * gap) / per, maxH)), slack: 0, last: n, fits: false, lines: 1 };
    }
    return best;
  }

  // A packing the person cap already allows keeps five and five near half.
  // A line of one face is not that packing. Otherwise the natural packing
  // stands and the stadium shrinks once.
  function packFor(n, w, maxH, gap, stadW, stadH, faces) {
    const natural = packChoice(n, w, maxH, gap);
    if (cellOf(stadW, stadH, faces) <= natural.side * 1.15 + 0.5) return natural;
    let alt = null;
    for (const c of packings(n, w, maxH, gap)) {
      if (c.last === 1 && n > 1) continue;
      if (c.slack > 0.45) continue;
      if (cellOf(stadW, stadH, faces) > c.side * 1.15 + 0.5) continue;
      if (!alt || c.score > alt.score) alt = c;
    }
    return alt || natural;
  }

  // One composite, and no Stage. Fit's share follows the face count. Scroll
  // keeps the row size it already had and starts from a full-width square,
  // then both stop when a person inside the composite would be larger than
  // a row tile. The row is repacked once into the band that shrink frees.
  // forceStack: Fit with no share keeps the stadium in a bottom band on a
  // wide screen too (the row floats above it).
  function compositePeople(row, stad, box, phone, gallery, gap, stadCount, forceStack) {
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
    const wide = !forceStack && box.w >= box.h * 1.05;
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
      const a = placeRows(row, rowBox, picked.side, picked.per, rowBox.y, gap, picked.w);
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
    const a = placeRows(row, col, picked.side, picked.per, col.y, gap, picked.w);
    fillBand(a.rects, col, gap);
    const st = { id: id, tier: 'stad', x: box.x + box.w - stadW, y: box.y, w: stadW, h: stadH, fit: 'contain' };
    return { rects: a.rects.concat([st]), contentH: box.h, side: picked.side, stadSide: Math.min(st.w, st.h), tooSmall: Math.min(st.w, st.h) < 28 };
  }

  function people(row, stad, box, phone, gallery, gap, avoidLone, stadCount, forceStack) {
    // A Stage keeps the small stadium. One composite with no Stage does not.
    if (stad.length === 1 && !avoidLone) return compositePeople(row, stad, box, phone, gallery, gap, stadCount, forceStack);
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
    // Beside a share the band is a tall strip. Stretching it makes slivers.
    // Squares stay squares; pinEnd still meets the outer edge.
    if (gallery !== 'scroll' && !avoidLone) fillBand(rects, box, gap);
    return { rects: rects, contentH: Math.max(box.h, total), side: s, stadSide: t, tooSmall: ns > 0 && t < 28 };
  }

  // A share (one screen, or an app) at its true aspect, contain-fit in its
  // cell. A `fill` item (an app) has no aspect of its own and takes the cell.
  // top: the picture hugs the top of its band instead of centring in it.
  // People on stage do not use this. They use stagePack.
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

  // People on stage, by count. Squares are cover. The first person in a
  // 1 / 3 / 5 pack keeps the aspect they sent (contain). A row of squares is
  // capped at maxH so Scroll never draws one row taller than the screen; a
  // 2x2 may still be taller, and the page scrolls. bandH scales the whole
  // pack down to fit a Fit band. It does not scale up.
  function stagePack(items, box, gap, opts) {
    opts = opts || {};
    const list = items || [];
    const n = list.length;
    const W = box.w;
    if (!n || !(W > 1)) return { rects: [], h: 0 };
    const g = gap > 0 ? gap : 0;
    const maxH = opts.maxH > 0 ? opts.maxH : 1e9;
    const bandH = opts.bandH > 0 ? opts.bandH : 1e9;
    function aspect(it) { return it.aspect > 0 ? it.aspect : 16 / 9; }
    function contain(a, mw, mh) {
      let w = mw, h = w / a;
      if (h > mh) { h = mh; w = h * a; }
      if (w > mw) { w = mw; h = w / a; }
      return { w: w, h: h };
    }
    function squareSide(cols) {
      let side = (W - (cols - 1) * g) / cols;
      if (side > maxH) side = maxH;
      if (!(side > 1)) side = 1;
      return side;
    }
    const raw = [];
    let y = box.y;
    function addHero(it) {
      const c = contain(aspect(it), W, maxH);
      raw.push({ id: it.id, tier: 'stage', x: box.x + (W - c.w) / 2, y: y, w: c.w, h: c.h, fit: 'contain' });
      y += c.h;
    }
    function addSquares(from, cols) {
      const side = squareSide(cols);
      const count = list.length - from;
      const rows = Math.ceil(count / cols);
      for (let r = 0; r < rows; r++) {
        const k = Math.min(cols, count - r * cols);
        const lineW = k * side + (k - 1) * g;
        let x = box.x + (W - lineW) / 2;
        for (let j = 0; j < k; j++) {
          const it = list[from + r * cols + j];
          raw.push({ id: it.id, tier: 'stage', x: x, y: y, w: side, h: side, fit: 'cover' });
          x += side + g;
        }
        y += side + (r + 1 < rows ? g : 0);
      }
    }
    if (n === 1) addHero(list[0]);
    else if (n === 2) addSquares(0, 2);
    else if (n === 3) { addHero(list[0]); y += g; addSquares(1, 2); }
    else if (n === 4) addSquares(0, 2);
    else if (n === 5) { addHero(list[0]); y += g; addSquares(1, 2); }
    else addSquares(0, 2);
    const naturalH = raw.length ? (y - box.y) : 0;
    let k = 1;
    if (naturalH > bandH && naturalH > 0) k = bandH / naturalH;
    const out = [];
    for (let i = 0; i < raw.length; i++) {
      const r = raw[i];
      out.push({
        id: r.id, tier: 'stage', fit: r.fit,
        x: box.x + (r.x - box.x) * k,
        y: box.y + (r.y - box.y) * k,
        w: r.w * k, h: r.h * k,
      });
    }
    if (out.length) {
      let x0 = Infinity, x1 = -Infinity;
      for (let i = 0; i < out.length; i++) { x0 = Math.min(x0, out[i].x); x1 = Math.max(x1, out[i].x + out[i].w); }
      const shift = box.x + (box.w - (x1 - x0)) / 2 - x0;
      if (Math.abs(shift) > 0.5) for (let i = 0; i < out.length; i++) out[i].x += shift;
    }
    return { rects: out, h: naturalH * k };
  }

  function aspectOf(it) { return it && it.aspect > 0 ? it.aspect : 16 / 9; }

  // A screen or an app is the share. Everyone else on stage is a person.
  function classifyStage(stage, share) {
    const shares = [];
    const peopleOn = [];
    for (let i = 0; i < (share || []).length; i++) if (share[i]) shares.push(share[i]);
    for (let i = 0; i < (stage || []).length; i++) {
      const it = stage[i];
      if (!it) continue;
      if (it.fill || it.kind === 'screen' || it.kind === 'app') shares.push(it);
      else peopleOn.push(it);
    }
    return { share: shares[0] || null, people: peopleOn };
  }

  function tagRows(rects) {
    for (let i = 0; i < rects.length; i++) if (rects[i].tier === 'row') rects[i].float = 'row';
  }

  function laid(rects, contentH, regions, extra, gallery) {
    return {
      rects: rects,
      contentH: contentH,
      regions: regions,
      side: extra && extra.side || 0,
      stadSide: extra && extra.stadSide || 0,
      tooSmall: !!(extra && extra.tooSmall) && gallery === 'fit',
      gallery: gallery,
    };
  }

  // Scroll: one share band, full width, never taller than the screen.
  function shareScrollRect(it, x, y, w, maxH) {
    if (it.fill || it.kind === 'app') {
      const h = Math.min(maxH, w * 9 / 16);
      return { id: it.id, tier: 'stage', x: x, y: y, w: w, h: h, fit: 'cover' };
    }
    const a = aspectOf(it);
    let ww = w, h = ww / a;
    if (h > maxH) { h = maxH; ww = h * a; }
    if (ww > w) { ww = w; h = ww / a; }
    return { id: it.id, tier: 'stage', x: x + (w - ww) / 2, y: y, w: ww, h: h, fit: 'contain' };
  }

  // opts: { box:{x,y,w,h}, stage:[{id,aspect,kind,fill}], share:[...], row:[id], stad:[id], phone, gallery, gap, floor, stadCount }
  // kind 'screen' or 'app' (or fill) is the share. Other stage items are people.
  // stadCount is how many people are inside the one composite. Omit it and
  // Fit shares the screen about in half with the row.
  // floor: beside a share, the share may run down to this y (past box, under
  // the call's buttons, which then wake over it instead of moving it).
  function layout(opts) {
    opts = opts || {};
    const box = opts.box;
    const gap = opts.gap != null ? opts.gap : (opts.phone ? 4 : GAP);
    const row = opts.row || [], stad = opts.stad || [];
    const gallery = opts.gallery === 'scroll' ? 'scroll' : 'fit';
    const phone = !!opts.phone;
    const split = classifyStage(opts.stage, opts.share);
    const shareItem = split.share;
    const onStage = split.people;
    if (!shareItem && !onStage.length) {
      // No share and no one on stage. Fit still stacks the stadium under the
      // row on a wide screen, and the row is the floating panel.
      const p = people(row, stad, box, phone, gallery, gap, false, opts.stadCount, gallery === 'fit');
      if (gallery === 'fit') tagRows(p.rects);
      return laid(p.rects, p.contentH, { stage: null, share: null, people: box }, p, gallery);
    }
    if (gallery === 'scroll') return layoutScroll(opts, box, gap, phone, row, stad, shareItem, onStage);
    if (shareItem) return layoutFitShare(opts, box, gap, phone, row, stad, shareItem, onStage);
    return layoutFitStage(opts, box, gap, phone, row, stad, onStage);
  }

  function layoutScroll(opts, box, gap, phone, row, stad, shareItem, onStage) {
    let y = box.y;
    const rects = [];
    let shareBox = null, stageBox = null;
    if (shareItem) {
      const r = shareScrollRect(shareItem, box.x, y, box.w, box.h);
      rects.push(r);
      shareBox = { x: box.x, y: y, w: box.w, h: r.h };
      y += r.h + gap;
    }
    if (onStage.length) {
      const pk = stagePack(onStage, { x: box.x, y: y, w: box.w, h: box.h }, gap, { maxH: box.h, bandH: 1e9 });
      for (let i = 0; i < pk.rects.length; i++) rects.push(pk.rects[i]);
      stageBox = { x: box.x, y: y, w: box.w, h: pk.h };
      y += pk.h + gap;
    }
    const pb = { x: box.x, y: y, w: box.w, h: Math.max(1, box.y + box.h - y) };
    let extra = { side: 0, stadSide: 0, tooSmall: false };
    let contentH = y - box.y;
    if (row.length || stad.length) {
      const p = people(row, stad, pb, phone, 'scroll', gap, false, opts.stadCount);
      for (let i = 0; i < p.rects.length; i++) rects.push(p.rects[i]);
      extra = p;
      contentH = (pb.y - box.y) + p.contentH;
    } else if (shareItem || onStage.length) {
      contentH = Math.max(0, y - box.y - gap);
    }
    const peopleBox = (row.length || stad.length) ? pb : null;
    return laid(rects, Math.max(box.h, contentH), { stage: stageBox, share: shareBox, people: peopleBox }, extra, 'scroll');
  }

  // Fit, no share: stage fixed on top, stadium fixed at the bottom, row in
  // the gap (the floating panel). A pack taller than its band scales down.
  function layoutFitStage(opts, box, gap, phone, row, stad, onStage) {
    const hasStad = stad.length > 0;
    const hasRow = row.length > 0;
    const stageH = Math.max(1, Math.round(box.h * (hasStad ? 0.42 : 0.62)));
    let stadH = 0;
    const below = Math.max(1, box.h - stageH - gap);
    if (hasStad && hasRow) {
      const faces = faceCount(opts.stadCount, row.length);
      const share = stad.length === 1 ? stadShare(Math.max(1, row.length), faces) : 0.34;
      stadH = Math.round(below * share);
      const minRow = Math.min(96, Math.max(48, below * 0.28));
      if (below - stadH - gap < minRow) stadH = Math.max(1, Math.round(below - gap - minRow));
    } else if (hasStad) stadH = below;
    const stageBox = { x: box.x, y: box.y, w: box.w, h: stageH };
    const pk = stagePack(onStage, stageBox, gap, { maxH: stageH, bandH: stageH });
    let rects = pk.rects.slice();
    let rowBox = null;
    let extra = { side: 0, stadSide: 0, tooSmall: false };
    if (hasRow) {
      const rowH = hasStad ? Math.max(1, box.h - stageH - gap - stadH - gap) : Math.max(1, box.h - stageH - gap);
      rowBox = { x: box.x, y: box.y + stageH + gap, w: box.w, h: rowH };
      const pr = people(row, [], rowBox, phone, 'fit', gap, false, 0);
      tagRows(pr.rects);
      for (let i = 0; i < pr.rects.length; i++) rects.push(pr.rects[i]);
      extra = pr;
    }
    let stadBox = null;
    if (hasStad) {
      stadBox = { x: box.x, y: box.y + box.h - stadH, w: box.w, h: stadH };
      const sr = people([], stad, stadBox, phone, 'fit', gap, false, opts.stadCount);
      for (let i = 0; i < sr.rects.length; i++) rects.push(sr.rects[i]);
    }
    return laid(rects, box.h, { stage: stageBox, share: null, people: rowBox || stadBox || stageBox }, extra, 'fit');
  }

  // Fit with a share: the share takes the left (wide) or the top (tall).
  // Row and stadium fit in the remaining band. Stage people float over the
  // share, shrunk to about a third of its short side.
  function layoutFitShare(opts, box, gap, phone, row, stad, shareItem, onStage) {
    const wide = box.w >= box.h * 1.15;
    let sb, pb, sr;
    if (wide) {
      const pw = Math.round(Math.max(phone ? 110 : 160, Math.min(box.w * 0.28, phone ? 260 : 440)));
      const sh = opts.floor > box.y + box.h ? opts.floor - box.y : box.h;
      sb = { x: box.x, y: box.y, w: Math.max(1, box.w - pw - gap), h: sh };
      sr = stageRects([shareItem], sb, gap, phone);
      let x0 = Infinity, x1 = -Infinity;
      for (let i = 0; i < sr.length; i++) { x0 = Math.min(x0, sr[i].x); x1 = Math.max(x1, sr[i].x + sr[i].w); }
      const used = Math.round(x1 - x0);
      if (used > 0 && used < sb.w) {
        for (let i = 0; i < sr.length; i++) sr[i].x -= x0 - sb.x;
        sb = { x: sb.x, y: sb.y, w: used, h: sb.h };
      }
      pb = { x: sb.x + sb.w + gap, y: box.y, w: Math.max(1, box.x + box.w - (sb.x + sb.w + gap)), h: box.h };
    } else {
      const ph = Math.round(Math.max(phone ? 110 : 160, Math.min(box.h * 0.28, box.h * 0.62)));
      const sh = Math.max(1, box.h - ph - gap);
      sb = { x: box.x, y: box.y, w: box.w, h: sh };
      pb = { x: box.x, y: box.y + sh + gap, w: box.w, h: Math.max(1, ph) };
      sr = stageRects([shareItem], sb, gap, phone);
    }
    const p = people(row, stad, pb, phone, 'fit', gap, true, opts.stadCount);
    if (wide) pinEnd(p.rects, pb);
    const rects = sr.concat(p.rects);
    let stageBox = null;
    if (onStage.length) {
      const short = Math.min(sb.w, sb.h);
      let panelW = Math.max(96, Math.round(short * 0.36));
      panelW = Math.min(panelW, Math.max(48, sb.w - 16));
      const maxPH = Math.max(48, sb.h - 16);
      const floatBox = { x: sb.x + 8, y: sb.y + 8, w: panelW, h: maxPH };
      const pk = stagePack(onStage, floatBox, gap, { maxH: maxPH, bandH: maxPH });
      for (let i = 0; i < pk.rects.length; i++) {
        pk.rects[i].float = 'stage';
        rects.push(pk.rects[i]);
      }
      stageBox = { x: floatBox.x, y: floatBox.y, w: panelW, h: pk.h };
    }
    return laid(rects, box.h, { stage: stageBox, share: sb, people: pb }, p, 'fit');
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

  return { GAP: GAP, STAD_RATIO: STAD_RATIO, layout: layout, people: people, stageRects: stageRects, stagePack: stagePack, fitSide: fitSide, cropBox: cropBox, normCrop: normCrop, cropRect: cropRect, isDefault: isDefault };
});
