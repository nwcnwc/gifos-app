/*
 * meet-layout.js — pure packing for Meet view modes. No DOM.
 *
 * layoutFor uses meet-pack.js (balanced lines, per-tile aspect, two tiers,
 * stage rail). pack/place/tiered stay as the old column oracle for tests
 * that still name that helper. The live gallery does not call them.
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};

  function packApi() {
    if (GifOS.meetPack && GifOS.meetPack.layout) return GifOS.meetPack;
    if (typeof require === 'function') {
      try { return require('./meet-pack.js'); } catch (e) { return null; }
    }
    return null;
  }

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
  // A short landscape keeps the title chip's band. With the controls put
  // away (body.chrome-away) the face takes the dock's band. While the
  // controls are up, that band stays reserved so a face is not a strip under Hang up.
  function viewBox(vw, vh, opts) {
    opts = opts || {};
    const landscape = vw > vh;
    const short = landscape && vh < 420;
    const phone = opts.phone != null ? !!opts.phone : (!landscape && vw < 700);
    let away = false;
    try { away = document.body.classList.contains('chrome-away'); } catch (e) {}
    // 64 clears the header pill (it sits at y=14 and is about 40px tall) so
    // the top row's chips are not drawn underneath it. The mode pill is taller.
    // 56 is the short-landscape chip band.
    const top = opts.top != null ? opts.top : (short ? 56 : (phone && opts.pill ? 92 : 64));
    const bottom = opts.bottom != null ? opts.bottom : (short && !away ? 72 : 0);
    const pad = phone ? 2 : 4;
    return {
      x: pad,
      y: top,
      w: Math.max(1, vw - pad * 2),
      h: Math.max(1, vh - top - bottom),
      phone: phone,
      bottom: bottom,
    };
  }

  // Last chosen line count. A 1% score tie keeps it, so a resize does not flip the grid.
  let prevRows = null;

  function aspectOf(t) {
    const a = t && +t.aspect;
    return a > 0 ? a : 16 / 9;
  }

  function layoutFor(opts) {
    opts = opts || {};
    const Pack = packApi();
    const box = opts.box || viewBox(opts.w || 1, opts.h || 1, opts);
    const phone = !!box.phone || !!opts.phone;
    const modeIn = opts.mode || 'gallery';
    const mode = modeIn === 'auto' ? 'gallery' : modeIn;
    // Input order, not hand/stage rank. A raised hand is a badge. Self is
    // pulled to the front by the packer. Bots are a small corner tile.
    const ordered = opts.tiles || [];
    const bots = ordered.filter((t) => t.bot);
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
    if (!Pack) {
      const g = galleryIn(tiles, box, phone ? 3 / 4 : 16 / 10, phone);
      g.mode = mode;
      g.box = box;
      return withBots(g);
    }
    const onStage = (t) => (t.tier === 'stage' || !!t.stage) && (opts.swapSelf || !t.me);
    let stage = [];
    if (mode === 'speaker') {
      const pick = tiles.filter((t) => opts.swapSelf || !t.me);
      const speaker = pick.filter((t) => t.speaker)[0] || pick.filter((t) => t.tier !== 'stad')[0] || pick[0];
      if (speaker) stage = [{ id: speaker.id, aspect: aspectOf(speaker), share: !!speaker.share }];
    } else if (mode === 'stageGallery' || mode === 'stageOnly') {
      stage = tiles.filter(onStage).map((t) => ({ id: t.id, aspect: aspectOf(t), share: !!t.share }));
    }
    const people = tiles.map((t) => ({
      id: t.id,
      aspect: aspectOf(t),
      me: !!t.me,
      row: t.tier === 'stad' ? 1 : 0,
    }));
    const order = new Pack.Order();
    for (let i = 0; i < tiles.length; i++) if (!tiles[i].me) order.join(tiles[i].id);
    for (let i = 0; i < tiles.length; i++) if (tiles[i].me) order.join(tiles[i].id);
    const out = Pack.layout(people, mode === 'gallery' ? [] : stage, {
      W: box.x + box.w,
      H: box.y + box.h,
      box: box,
      phone: phone,
      mode: mode === 'stageOnly' ? 'stageOnly' : 'auto',
      order: order,
      myRow: 0,
      gallery: opts.gallery === 'scroll' ? 'scroll' : 'fit',
      selfView: opts.selfView || 'tile',
      prevRows: opts.prevRows != null ? opts.prevRows : prevRows,
    });
    if (typeof out.rows === 'number') prevRows = out.rows;
    const rects = (out.tiles || []).map((t) => ({
      id: t.id,
      tier: t.region === 'stage' ? 'stage' : (t.tier || 'row'),
      x: t.x, y: t.y, w: t.w, h: t.h,
      fit: t.fit || 'cover',
      quality: t.quality || (t.tier === 'stad' ? 'lo' : 'hi'),
    }));
    let band = null;
    if (mode === 'stageOnly' && out.overflow > 0) {
      band = { text: '+' + out.overflow + ' more · tap to show', x: box.x + 4, y: box.y + 4 };
    } else if (out.tooSmall && opts.gallery !== 'scroll') {
      band = { text: 'faces tiny · Scroll is in ▦', x: box.x + 6, y: box.y + 6 };
    }
    return withBots({
      mode: mode,
      rects: rects,
      crowd: false,
      band: band,
      tier: out.split != null ? { f: out.split, fellBack: false } : null,
      box: box,
      stage: out.regions && out.regions.stage || null,
      contentH: out.contentH || box.h,
      tooSmall: !!out.tooSmall,
    });
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
