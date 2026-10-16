/*
 * meet-layout.js — pure packing for Meet view modes. No DOM.
 *
 * Tiles touch edge to edge (gap 0) and cover the box exactly: every row is
 * the same height, a full row splits the width evenly, and the last partial
 * row stretches across the width so no hole remains. object-fit: cover on
 * the tile absorbs the aspect wobble. Ties in column choice keep fewer
 * columns. See spec/DESIGN.md §3 and spec/mock/m.html.
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};

  // Best column count. Score is the largest tile that still fits at aspect
  // a (width/height) with gap 0. A higher score wins; a tie keeps the
  // earlier (fewer) column count.
  function pack(N, w, h, a) {
    if (!(N > 0) || !(w > 0) || !(h > 0)) return { c: 1, r: 1, tw: 0, th: 0 };
    const aspect = a > 0 ? a : 1;
    let best = null;
    for (let c = 1; c <= N; c++) {
      const r = Math.ceil(N / c);
      const tw = Math.min(w / c, (h / r) * aspect);
      const th = tw / aspect;
      if (!best || tw > best.tw) best = { c: c, r: r, tw: tw, th: th };
    }
    return best;
  }

  // Exact cover. The last tile of every row and the last row snap to the
  // box edge so float division cannot leave a hairline gap.
  function place(N, x, y, w, h, a) {
    if (!(N > 0) || !(w > 0) || !(h > 0)) return [];
    const b = pack(N, w, h, a);
    const out = [];
    for (let i = 0; i < N; i++) {
      const row = Math.floor(i / b.c);
      const inRow = row === b.r - 1 ? N - row * b.c : b.c;
      const k = i - row * b.c;
      const y0 = y + (h * row) / b.r;
      const y1 = row === b.r - 1 ? y + h : y + (h * (row + 1)) / b.r;
      const x0 = x + (w * k) / inRow;
      const x1 = k === inRow - 1 ? x + w : x + (w * (k + 1)) / inRow;
      out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
    return out;
  }

  // Two bands, no gutter. f runs 30%..85% in 1% steps. Keep splits whose
  // row best-fit tile is at least 1.5× the stadium's, and take the one with
  // the largest total best-fit face area. Fallback is 60/40.
  function tiered(nr, ns, x, y, w, h, a) {
    let best = null;
    if (nr > 0 && ns > 0 && h > 0 && w > 0) {
      for (let i = 30; i <= 85; i++) {
        const f = i / 100;
        const hr = h * f;
        const hs = h - hr;
        if (!(hr > 0) || !(hs > 0)) continue;
        const br = pack(nr, w, hr, a);
        const bs = pack(ns, w, hs, a);
        if (!(br.tw >= bs.tw * 1.5)) continue;
        const area = nr * br.tw * br.th + ns * bs.tw * bs.th;
        if (!best || area > best.area) best = { f: f, hr: hr, hs: hs, area: area, rowFit: br.tw, stadFit: bs.tw, fellBack: false };
      }
    }
    if (!best) {
      const hr = h * 0.6, hs = h - hr;
      const br = nr > 0 ? pack(nr, w, hr, a) : { tw: 0 };
      const bs = ns > 0 ? pack(ns, w, hs, a) : { tw: 0 };
      best = { f: 0.6, hr: hr, hs: hs, area: 0, rowFit: br.tw, stadFit: bs.tw, fellBack: true };
    }
    return {
      f: best.f,
      hr: best.hr,
      hs: best.hs,
      rowFit: best.rowFit,
      stadFit: best.stadFit,
      fellBack: best.fellBack,
      bandY: y + best.hr,
      row: nr > 0 ? place(nr, x, y, w, best.hr, a) : [],
      stad: ns > 0 ? place(ns, x, y + best.hr, w, best.hs, a) : [],
    };
  }

  // You, then stagers, then raised hands, then the order the caller gave.
  // Equal keys keep that order (stable).
  function orderTiles(tiles) {
    const indexed = (tiles || []).map((t, i) => ({ t: t, i: i }));
    indexed.sort((a, b) => {
      // A bot is never "you", never a stager, and never the focused speaker.
      const rank = (t) => t.bot ? 4 : t.me ? 0 : t.stage ? 1 : t.hand ? 2 : 3;
      const ra = rank(a.t);
      const rb = rank(b.t);
      if (ra !== rb) return ra - rb;
      const oa = ra === 1 ? (a.t.stageOrd || 0) : ra === 2 ? (a.t.handOrd || 0) : (a.t.ord || 0);
      const ob = rb === 1 ? (b.t.stageOrd || 0) : rb === 2 ? (b.t.handOrd || 0) : (b.t.ord || 0);
      if (oa !== ob) return oa - ob;
      return a.i - b.i;
    });
    return indexed.map((x) => x.t);
  }

  function emit(list, rects, tier) {
    const out = [];
    for (let i = 0; i < list.length && i < rects.length; i++) {
      const r = rects[i];
      out.push({ id: list[i].id, tier: list[i].tier || tier, x: r.x, y: r.y, w: r.w, h: r.h });
    }
    return out;
  }

  function unionOf(rects) {
    if (!rects.length) return { x: 0, y: 0, w: 0, h: 0 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of rects) {
      if (r.x < x0) x0 = r.x;
      if (r.y < y0) y0 = r.y;
      if (r.x + r.w > x1) x1 = r.x + r.w;
      if (r.y + r.h > y1) y1 = r.y + r.h;
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // Gallery (and the gallery half of a stage mode) inside box b.
  function galleryIn(tiles, b, aspect, phone) {
    const row = tiles.filter((t) => (t.tier || 'row') !== 'stad' && t.tier !== 'stage');
    const stad = tiles.filter((t) => t.tier === 'stad');
    const minSide = phone ? 44 : 56;
    if (!stad.length) {
      return { rects: emit(row, place(row.length, b.x, b.y, b.w, b.h, aspect), 'row'), crowd: false, band: null, tier: null };
    }
    if (!row.length) {
      const rects = place(stad.length, b.x, b.y, b.w, b.h, aspect);
      return finishStad(stad, rects, b, minSide, null);
    }
    const td = tiered(row.length, stad.length, b.x, b.y, b.w, b.h, aspect);
    const band = { text: 'Stadium · ' + stad.length, x: b.x + 6, y: td.bandY + 6 };
    const done = finishStad(stad, td.stad, b, minSide, band);
    done.rects = emit(row, td.row, 'row').concat(done.rects);
    done.tier = { f: td.f, rowFit: td.rowFit, stadFit: td.stadFit, fellBack: td.fellBack };
    return done;
  }

  function finishStad(stad, rects, b, minSide, band) {
    let crowd = false;
    let list = stad;
    let use = rects;
    if (use.length && use.some((r) => Math.min(r.w, r.h) < minSide)) {
      crowd = true;
      use = [unionOf(use)];
      list = [{ id: 'crowd', tier: 'stad' }];
    }
    return { rects: emit(list, use, 'stad'), crowd: crowd, band: crowd ? { text: 'Stadium · ' + stad.length, x: (use[0] ? use[0].x : b.x) + 6, y: (use[0] ? use[0].y : b.y) + 6 } : band, tier: null };
  }

  // Content box under the top chip. The dock floats over the tiles, so it
  // does not reserve a band. Phone with the mode pill needs a taller inset.
  function viewBox(vw, vh, opts) {
    opts = opts || {};
    const phone = opts.phone != null ? !!opts.phone : vw < 600;
    // 64 clears the header pill (it sits at y=14 and is about 40px tall) so
    // the top row's chips are not drawn underneath it. The mode pill is taller.
    const top = opts.top != null ? opts.top : (phone && opts.pill ? 92 : 64);
    const pad = phone ? 2 : 4;
    return {
      x: pad,
      y: top,
      w: Math.max(1, vw - pad * 2),
      h: Math.max(1, vh - top),
      phone: phone,
    };
  }

  function layoutFor(opts) {
    opts = opts || {};
    const box = opts.box || viewBox(opts.w || 1, opts.h || 1, opts);
    const phone = !!box.phone || !!opts.phone;
    const modeIn = opts.mode || 'gallery';
    const mode = modeIn === 'auto' ? 'gallery' : modeIn;
    const aMain = phone ? 3 / 4 : 16 / 10;
    const aSide = 4 / 3;
    const ordered = orderTiles(opts.tiles || []);
    const bots = ordered.filter((t) => t.bot);
    // Your own picture is a gallery tile on your screen unless you swapped
    // yourself onto the stage. A bot is never the stage and never the speaker.
    const tiles = ordered.filter((t) => !t.bot);
    function withBots(g) {
      if (!g || !bots.length) return g;
      const bw = phone ? 72 : 96;
      const bh = 72;
      const extra = bots.map((b, i) => ({
        id: b.id, tier: 'bot',
        x: box.x + Math.max(0, box.w - bw),
        y: Math.max(box.y, box.y + box.h - bh - i * bh),
        w: Math.min(bw, box.w), h: Math.min(bh, box.h),
      }));
      g.rects = (g.rects || []).concat(extra);
      return g;
    }
    if (mode === 'gallery') {
      const g = galleryIn(tiles, box, aMain, phone);
      g.mode = 'gallery';
      g.box = box;
      return withBots(g);
    }
    if (mode === 'stageGallery' || mode === 'stageOnly') {
      let stageBox, side;
      if (phone) {
        const sh = mode === 'stageOnly' ? box.h : Math.min(box.w * 9 / 16 * 1.25, box.h * 0.48);
        stageBox = { x: box.x, y: box.y, w: box.w, h: sh };
        side = { x: box.x, y: box.y + sh, w: box.w, h: Math.max(0, box.h - sh) };
      } else {
        const sw = mode === 'stageOnly' ? Math.max(0, box.w - 200) : box.w * 0.72;
        stageBox = { x: box.x, y: box.y, w: sw, h: box.h };
        side = { x: box.x + sw, y: box.y, w: Math.max(0, box.w - sw), h: box.h };
      }
      // stage:true and tier 'stage' are the same fact. Your own picture stays
      // off this rect unless you swapped. Bots never reach this list.
      const onStage = (t) => (t.tier === 'stage' || !!t.stage) && (opts.swapSelf || !t.me);
      const stageTiles = tiles.filter(onStage);
      const stageId = (stageTiles[0] && stageTiles[0].id) || 'stage';
      const rects = [{ id: stageId, tier: 'stage', x: stageBox.x, y: stageBox.y, w: stageBox.w, h: stageBox.h }];
      if (mode === 'stageOnly') {
        const speaker = tiles.filter((t) => t.speaker && t.tier !== 'stage')[0] || tiles.filter((t) => !t.me && t.tier !== 'stage')[0];
        const me = tiles.filter((t) => t.me)[0];
        const floats = [speaker, me].filter(Boolean);
        if (phone) {
          floats.forEach((p, i) => {
            rects.push({ id: p.id, tier: 'float', x: box.x + box.w - 96 - 8, y: stageBox.y + stageBox.h - 110 - i * 102, w: 96, h: 96 });
          });
        } else if (side.w > 0 && floats.length) {
          const placed = place(floats.length, side.x, side.y, side.w, side.h, aSide);
          floats.forEach((p, i) => rects.push({ id: p.id, tier: 'float', x: placed[i].x, y: placed[i].y, w: placed[i].w, h: placed[i].h }));
        }
        const others = tiles.filter((t) => t.tier !== 'stage' && floats.indexOf(t) < 0).length;
        return withBots({
          mode: mode, rects: rects, crowd: false, box: box, tier: null,
          band: others > 0 ? { text: '+' + others + ' more · tap to show', x: side.x + 4, y: side.y + 4 } : null,
          stage: stageBox,
        });
      }
      const rest = tiles.filter((t) => !onStage(t));
      const g = galleryIn(rest, side.h > 0 && side.w > 0 ? side : box, aSide, phone);
      return withBots({ mode: mode, rects: rects.concat(g.rects), crowd: g.crowd, band: g.band, tier: g.tier, box: box, stage: stageBox });
    }
    if (mode === 'speaker') {
      const pick = tiles.filter((t) => opts.swapSelf || !t.me);
      const speaker = pick.filter((t) => t.speaker)[0] || pick.filter((t) => t.tier !== 'stad')[0] || pick[0];
      const fh = phone ? box.h * 0.62 : Math.max(1, box.h - 150);
      const rects = [];
      if (speaker) rects.push({ id: speaker.id, tier: 'stage', x: box.x, y: box.y, w: box.w, h: Math.min(fh, box.h) });
      const others = tiles.filter((t) => t !== speaker);
      const stripH = box.h - fh;
      if (others.length && stripH > 0) {
        rects.push.apply(rects, emit(others, place(others.length, box.x, box.y + fh, box.w, stripH, aMain), 'row'));
      }
      return withBots({ mode: mode, rects: rects, crowd: false, band: null, tier: null, box: box });
    }
    const g = galleryIn(tiles, box, aMain, phone);
    g.mode = 'gallery';
    g.box = box;
    return withBots(g);
  }

  // Slice a stadium composite into per-face crops. cellCrop refuses a frame
  // whose cells are not square, and the packer pads the canvas height to a
  // 4-row step past 2 rows. When that tail is the only mismatch, ask cellCrop
  // for the square grid and stretch the CSS height to the real frame so the
  // top-aligned faces are not squashed.
  function stadiumSlices(T, vw, vh, box, gridFn, cropFn) {
    T = T | 0;
    const cells = [];
    if (!(T > 0) || typeof gridFn !== 'function' || typeof cropFn !== 'function') {
      return { cols: 1, rows: 1, cells: cells };
    }
    const g = gridFn(T);
    const cols = g.cols || 1;
    const rows = Math.ceil(T / cols);
    for (let j = 0; j < T; j++) {
      let crop = cropFn(j, T, cols, vw, vh, box);
      let tail = false;
      if (!crop && vw > 0 && vh > 0 && cols > 0) {
        const cw = vw / cols;
        const squareH = rows * cw;
        if (vh + 0.5 >= squareH - 0.5 && Math.abs(cw - vh / rows) > 0.08 * cw) {
          const sq = cropFn(j, T, cols, vw, squareH, box);
          if (sq && vw) {
            const k = sq.w / vw;
            crop = { x: sq.x, y: sq.y, w: sq.w, h: vh * k };
            tail = true;
          }
        }
      }
      cells.push(crop ? { j: j, x: crop.x, y: crop.y, w: crop.w, h: crop.h, tail: tail } : null);
    }
    return { cols: cols, rows: rows, cells: cells };
  }

  // Auto is sticky: a manual pick wins until the person chooses Auto again.
  // A gesture lock (pinch in progress, or the 2s after) holds the mode.
  // Share/app, once the first frame has settled, goes to stage+gallery,
  // or stage-only when a phone is landscape. Otherwise gallery.
  function autoResolve(s) {
    s = s || {};
    const manual = s.manual || 'auto';
    if (manual !== 'auto') return manual;
    if (s.gestureLock) return s.held || 'gallery';
    const sharing = !!(s.share || s.app);
    if (sharing && s.shareSettled === false) return s.held || 'gallery';
    if (sharing && s.phoneLandscape) return 'stageOnly';
    if (sharing) return 'stageGallery';
    return 'gallery';
  }

  // Floating control bar. Free placement: the only adjustment is clamping
  // the bar inside the viewport. No edge or centre snap.
  const BAR_KEY = 'gifos_bar_pos_v1';
  function barDevice(phone) { return phone ? 'p' : 'd'; }
  function clampBar(pos, bar, view) {
    const bw = Math.max(0, bar.w || 0), bh = Math.max(0, bar.h || 0);
    const maxX = Math.max(0, (view.w || 0) - bw);
    const maxY = Math.max(0, (view.h || 0) - bh);
    const x = pos && Number.isFinite(pos.x) ? pos.x : 0;
    const y = pos && Number.isFinite(pos.y) ? pos.y : 0;
    return { x: Math.min(maxX, Math.max(0, x)), y: Math.min(maxY, Math.max(0, y)) };
  }
  function defaultBar(bar, view, phone) {
    const bottom = phone ? 16 : 18;
    return clampBar({ x: ((view.w || 0) - (bar.w || 0)) / 2, y: (view.h || 0) - (bar.h || 0) - bottom }, bar, view);
  }
  function nudgeBar(pos, key, step, bar, view) {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
    if (!dir) return clampBar(pos, bar, view);
    const n = step > 0 ? step : 16;
    return clampBar({ x: pos.x + dir[0] * n, y: pos.y + dir[1] * n }, bar, view);
  }
  function loadBar(store, phone) {
    if (!store || typeof store.getItem !== 'function') return null;
    let o = null;
    try { o = JSON.parse(store.getItem(BAR_KEY) || 'null'); } catch (e) { return null; }
    const p = o && o[barDevice(phone)];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    return { x: p.x, y: p.y };
  }
  function saveBar(store, phone, pos) {
    if (!store || typeof store.setItem !== 'function' || !pos) return;
    let o = {};
    try { o = JSON.parse(store.getItem(BAR_KEY) || '{}') || {}; } catch (e) { o = {}; }
    if (!o || typeof o !== 'object') o = {};
    o[barDevice(phone)] = { x: pos.x, y: pos.y };
    try { store.setItem(BAR_KEY, JSON.stringify(o)); } catch (e) {}
  }

  const api = {
    pack: pack, place: place, tiered: tiered, orderTiles: orderTiles, viewBox: viewBox,
    layoutFor: layoutFor, stadiumSlices: stadiumSlices, autoResolve: autoResolve,
    BAR_KEY: BAR_KEY, clampBar: clampBar, defaultBar: defaultBar, nudgeBar: nudgeBar,
    loadBar: loadBar, saveBar: saveBar,
  };
  GifOS.meetLayout = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
