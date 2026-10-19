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

  // Content box under the top chip and above the dock. opts.bottom is the
  // measured dock band (innerHeight - bar.top) when the page has one; the
  // dock constant stands in otherwise. Phone with the mode pill needs a taller
  // top, and a phone clears Fit even at 200% text.
  function viewBox(vw, vh, opts) {
    opts = opts || {};
    const landscape = vw > vh;
    const short = landscape && vh < 420;
    const phone = opts.phone != null ? !!opts.phone : (!landscape && vw < 700);
    // 64 clears the header pill (it sits at y=14 and is about 40px tall) so
    // the top row's chips are not drawn underneath it. The mode pill is taller.
    // When Fit sits lower (200% text) the page measures and passes opts.top.
    // A portrait phone starts under Fit (120, 140 with the mode pill, qa-meet-mobile);
    // a short landscape phone keeps the band for the strip.
    const top = opts.top != null ? opts.top : (phone ? (vh < 500 ? (opts.pill ? 92 : 64) : (opts.pill ? 140 : 120)) : 64);
    const bottom = Math.max(0, +opts.bottom || 0);
    // Dock: 88px pill + 14px bottom inset on a phone, 104px + 14px on a desk,
    // plus a few pixels so a name chip is not tucked under the bar.
    // A measured band (even 0, when the chrome is tucked away) is the truth;
    // the constants stand in only when nothing was measured.
    const dock = opts.dock != null ? opts.dock : (opts.bottom != null ? bottom : (phone ? 112 : 128));
    const pad = phone ? 2 : 4;
    return {
      x: pad,
      y: top,
      w: Math.max(1, vw - pad * 2),
      h: Math.max(1, vh - top - dock),
      phone: phone,
      dock: dock,
    };
  }

  // Last chosen line count. A 1% score tie keeps it, so a resize does not flip the grid.
  let prevRows = null;

  function aspectOf(t) {
    const a = t && +t.aspect;
    return a > 0 ? a : 16 / 9;
  }

  // Your own video. The default is a gallery tile: same cell as everyone
  // else, first seat, nothing covered. Float, strip, and hidden are explicit.
  // See design/meet-selfview-stage.md.
  const SELF_ARRANGEMENTS = ['tile', 'float', 'strip', 'hidden'];
  const SELF_SIZES = ['s', 'm', 'l'];
  const SELF_ANCHORS = ['tl', 'tr', 'bl', 'br', 'free'];
  const SELF_EDGES = ['auto', 'bottom', 'top', 'left', 'right'];
  const SELF_SCALE = { s: 0.20, m: 0.30, l: 0.42 };
  const SELF_MARGIN = { phone: 10, other: 16 };
  const SELF_LIFT = { phone: 108, other: 128 };
  const SELF_THICK = {
    phone: { s: 76, m: 108, l: 148 },
    other: { s: 96, m: 140, l: 196 },
  };
  const SELF_KEY = 'gifos_self_view_v1';
  const SELF_DEFAULT = { arrangement: 'tile', size: 'm', anchor: 'br', edge: 'auto', x: null, y: null, onStage: false };

  function normalizeSelf(raw) {
    if (raw == null || raw === '') return Object.assign({}, SELF_DEFAULT);
    if (typeof raw === 'string') {
      const arrangement = raw === 'inset' ? 'float' : (SELF_ARRANGEMENTS.indexOf(raw) >= 0 ? raw : 'tile');
      return Object.assign({}, SELF_DEFAULT, { arrangement: arrangement });
    }
    const named = raw.arrangement === 'inset' ? 'float' : raw.arrangement;
    const arrangement = SELF_ARRANGEMENTS.indexOf(named) >= 0 ? named : 'tile';
    const size = SELF_SIZES.indexOf(raw.size) >= 0 ? raw.size : 'm';
    const anchor = SELF_ANCHORS.indexOf(raw.anchor) >= 0 ? raw.anchor : 'br';
    const edge = SELF_EDGES.indexOf(raw.edge) >= 0 ? raw.edge : 'auto';
    const x = Number.isFinite(+raw.x) ? +raw.x : null;
    const y = Number.isFinite(+raw.y) ? +raw.y : null;
    const free = anchor === 'free' || (raw.anchor == null && x != null && y != null);
    return {
      arrangement: arrangement,
      size: size,
      anchor: free ? 'free' : anchor,
      edge: edge,
      x: free ? x : null,
      y: free ? y : null,
      onStage: !!raw.onStage,
    };
  }

  function selfDevice(phone) { return phone ? 'p' : 'd'; }

  function loadSelf(store, phone) {
    if (!store || typeof store.getItem !== 'function') return normalizeSelf(null);
    let o = null;
    try { o = JSON.parse(store.getItem(SELF_KEY) || 'null'); } catch (e) { return normalizeSelf(null); }
    const p = o && o[selfDevice(phone)];
    return normalizeSelf(p || null);
  }

  function saveSelf(store, phone, spec) {
    if (!store || typeof store.setItem !== 'function') return;
    let o = {};
    try { o = JSON.parse(store.getItem(SELF_KEY) || '{}') || {}; } catch (e) { o = {}; }
    if (!o || typeof o !== 'object') o = {};
    const s = normalizeSelf(spec);
    o[selfDevice(phone)] = {
      arrangement: s.arrangement, size: s.size, anchor: s.anchor, edge: s.edge,
      x: s.x, y: s.y, onStage: s.onStage,
    };
    try { store.setItem(SELF_KEY, JSON.stringify(o)); } catch (e) {}
  }

  function cycleArrangement(spec) {
    const s = normalizeSelf(spec);
    const i = SELF_ARRANGEMENTS.indexOf(s.arrangement);
    return normalizeSelf(Object.assign({}, s, { arrangement: SELF_ARRANGEMENTS[(i + 1) % SELF_ARRANGEMENTS.length] }));
  }
  function cycleSize(spec) {
    const s = normalizeSelf(spec);
    const i = Math.max(0, SELF_SIZES.indexOf(s.size));
    return normalizeSelf(Object.assign({}, s, { size: SELF_SIZES[(i + 1) % SELF_SIZES.length] }));
  }
  function cycleEdge(spec) {
    const order = ['bottom', 'right', 'left', 'top'];
    const s = normalizeSelf(spec);
    const cur = s.edge === 'auto' ? 'bottom' : s.edge;
    const i = Math.max(0, order.indexOf(cur));
    return normalizeSelf(Object.assign({}, s, { edge: order[(i + 1) % order.length] }));
  }

  // Phone: bottom. Wide desktop: the trailing edge. A chosen edge wins.
  function selfEdge(spec, phone, box) {
    const s = normalizeSelf(spec);
    if (s.edge !== 'auto') return s.edge;
    if (phone) return 'bottom';
    const w = box && box.w > 0 ? box.w : 1;
    const h = box && box.h > 0 ? box.h : 1;
    return w / h >= 1.15 ? 'right' : 'bottom';
  }

  function floatSelf(box, spec, phone, aspect) {
    const s = normalizeSelf(spec);
    const bw = Math.max(1, box.w || 0), bh = Math.max(1, box.h || 0);
    const short = Math.min(bw, bh);
    let side = short * (SELF_SCALE[s.size] || SELF_SCALE.m);
    side = Math.max(72, Math.min(side, short * 0.5));
    const a = aspect > 0 ? aspect : (phone ? 3 / 4 : 16 / 9);
    let w, h;
    if (a >= 1) { h = side; w = side * a; }
    else { w = side; h = side / a; }
    const fitW = Math.max(48, bw - 8), fitH = Math.max(48, bh - 8);
    if (w > fitW) { const k = fitW / w; w *= k; h *= k; }
    if (h > fitH) { const k = fitH / h; w *= k; h *= k; }
    const margin = phone ? SELF_MARGIN.phone : SELF_MARGIN.other;
    const lift = phone ? SELF_LIFT.phone : SELF_LIFT.other;
    let x, y;
    if (s.anchor === 'free' && s.x != null && s.y != null) {
      x = s.x; y = s.y;
    } else {
      const left = s.anchor === 'tl' || s.anchor === 'bl';
      const top = s.anchor === 'tl' || s.anchor === 'tr';
      const bottomLift = top ? 0 : lift;
      x = left ? box.x + margin : box.x + bw - w - margin;
      y = top ? box.y + margin : box.y + bh - h - margin - bottomLift;
    }
    const minX = box.x, minY = box.y;
    const maxX = box.x + bw - w, maxY = box.y + bh - h;
    x = Math.min(Math.max(minX, x), Math.max(minX, maxX));
    y = Math.min(Math.max(minY, y), Math.max(minY, maxY));
    return { x: x, y: y, w: w, h: h };
  }

  function reserveSelf(box, spec, phone) {
    const s = normalizeSelf(spec);
    const edge = selfEdge(s, phone, box);
    const table = phone ? SELF_THICK.phone : SELF_THICK.other;
    let thick = table[s.size] || table.m;
    const along = (edge === 'left' || edge === 'right') ? box.w : box.h;
    const minRest = Math.min(along * 0.55, phone ? 220 : 320);
    thick = Math.min(thick, Math.max(64, along - minRest));
    thick = Math.max(56, Math.min(thick, along * 0.42));
    let band, rest;
    if (edge === 'top') {
      band = { x: box.x, y: box.y, w: box.w, h: thick };
      rest = { x: box.x, y: box.y + thick, w: box.w, h: box.h - thick };
    } else if (edge === 'left') {
      band = { x: box.x, y: box.y, w: thick, h: box.h };
      rest = { x: box.x + thick, y: box.y, w: box.w - thick, h: box.h };
    } else if (edge === 'right') {
      band = { x: box.x + box.w - thick, y: box.y, w: thick, h: box.h };
      rest = { x: box.x, y: box.y, w: box.w - thick, h: box.h };
    } else {
      band = { x: box.x, y: box.y + box.h - thick, w: box.w, h: thick };
      rest = { x: box.x, y: box.y, w: box.w, h: box.h - thick };
    }
    return { edge: edge, band: band, rest: rest };
  }

  function nudgeSelf(spec, key, step, box, phone, aspect) {
    const s = normalizeSelf(spec);
    if (s.arrangement !== 'float') return s;
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
    if (!dir) return s;
    const cur = floatSelf(box, s, phone, aspect);
    const n = step > 0 ? step : 16;
    const moved = floatSelf(box, Object.assign({}, s, { anchor: 'free', x: cur.x + dir[0] * n, y: cur.y + dir[1] * n }), phone, aspect);
    return normalizeSelf(Object.assign({}, s, { anchor: 'free', x: moved.x, y: moved.y }));
  }

  function attachSelf(g, me, box, spec, phone, meStaged) {
    spec = normalizeSelf(spec);
    g.self = spec;
    if (!me || meStaged || spec.arrangement === 'tile' || spec.arrangement === 'hidden') return g;
    let r = null;
    if (spec.arrangement === 'float') r = floatSelf(box, spec, phone, aspectOf(me));
    else if (spec.arrangement === 'strip' && g.selfBand) r = g.selfBand;
    if (!r) return g;
    g.rects = (g.rects || []).concat([{
      id: me.id, tier: 'self', x: r.x, y: r.y, w: r.w, h: r.h, fit: 'cover', quality: 'hi',
    }]);
    return g;
  }

  function layoutFor(opts) {
    opts = opts || {};
    const Pack = packApi();
    const box = opts.box || viewBox(opts.w || 1, opts.h || 1, opts);
    const phone = !!box.phone || !!opts.phone;
    const modeIn = opts.mode || 'gallery';
    const mode = modeIn === 'auto' ? 'gallery' : modeIn;
    // Input order, not hand/stage rank. A raised hand is a badge. Self is
    // pulled to the front by the packer. A bot is a person in that same
    // grid: a full tile wearing the bot badge, not a smaller box.
    const tiles = opts.tiles || [];
    function withBots(g) { return g; }
    const selfSpec = normalizeSelf(opts.self != null ? opts.self : (opts.selfView != null ? opts.selfView : null));
    const stageSelf = !!(opts.stageSelf || opts.swapSelf || selfSpec.onStage);
    let me = null;
    for (let i = 0; i < tiles.length; i++) if (tiles[i].me) me = tiles[i];
    if (!Pack) {
      const g = galleryIn(tiles, box, phone ? 3 / 4 : 16 / 10, phone);
      g.mode = mode;
      g.box = box;
      g.self = selfSpec;
      return withBots(g);
    }
    // Your tile joins the stage only when you put it there (stageSelf /
    // swapSelf / self.onStage). A stage flag on you is not enough.
    const onStage = (t) => {
      if (t.me) return stageSelf;
      return t.tier === 'stage' || !!t.stage;
    };
    let stage = [];
    if (mode === 'speaker') {
      // A bot is never the focused speaker; you only when you put yourself there.
      const pick = tiles.filter((t) => (stageSelf || !t.me) && !t.bot);
      const speaker = pick.filter((t) => t.speaker)[0] || pick.filter((t) => t.tier !== 'stad')[0] || pick[0];
      if (speaker) stage = [{ id: speaker.id, aspect: aspectOf(speaker), share: !!speaker.share }];
    } else if (mode === 'stageGallery' || mode === 'stageOnly') {
      stage = tiles.filter(onStage).map((t) => ({ id: t.id, aspect: aspectOf(t), share: !!t.share }));
      if (stageSelf && me) {
        const mine = stage.filter((s) => s.id === me.id);
        const rest = stage.filter((s) => s.id !== me.id);
        stage = mine.concat(rest).slice(0, 5);
      }
    }
    const meStaged = !!(stageSelf && me && stage.some((s) => s.id === me.id));
    let packBox = box;
    let selfBand = null;
    if (selfSpec.arrangement === 'strip' && me && !meStaged) {
      const reserved = reserveSelf(box, selfSpec, phone);
      packBox = { x: reserved.rest.x, y: reserved.rest.y, w: reserved.rest.w, h: reserved.rest.h, phone: box.phone };
      selfBand = reserved.band;
    }
    const packSelf = (!meStaged && selfSpec.arrangement !== 'tile') ? 'hidden' : 'tile';
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
      W: packBox.x + packBox.w,
      H: packBox.y + packBox.h,
      box: packBox,
      phone: phone,
      mode: mode === 'stageOnly' ? 'stageOnly' : 'auto',
      order: order,
      myRow: 0,
      gallery: opts.gallery === 'scroll' ? 'scroll' : 'fit',
      selfView: packSelf,
      stageSelf: stageSelf && meStaged,
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
    let contentH = out.contentH || box.h;
    // Scroll adds the dock height as trailing space so the last names can
    // scroll clear of the bar. Fit already ends above the dock.
    if ((out.gallery === 'scroll') && contentH > box.h + 1 && box.dock) contentH += box.dock;
    const laid = {
      mode: mode,
      gallery: out.gallery === 'scroll' ? 'scroll' : 'fit',
      paged: false,
      rects: rects,
      crowd: false,
      band: band,
      tier: out.split != null ? { f: out.split, fellBack: false } : null,
      box: box,
      stage: out.regions && out.regions.stage || null,
      regions: out.regions || null,
      strip: out.strip || null,
      contentH: contentH,
      tooSmall: !!out.tooSmall,
      overflow: out.overflow || 0,
      selfBand: selfBand,
    };
    attachSelf(laid, me, box, selfSpec, phone, meStaged);
    return withBots(laid);
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
  // Share/app, once the first frame has settled, goes to stage+gallery
  // (the other people stay in a strip). Only a manual stageOnly hides them.
  // Otherwise gallery.
  function autoResolve(s) {
    s = s || {};
    const manual = s.manual || 'auto';
    if (manual !== 'auto') return manual;
    if (s.gestureLock) return s.held || 'gallery';
    const sharing = !!(s.share || s.app);
    if (sharing && s.shareSettled === false) return s.held || 'gallery';
    // Sharing opens the stage with the other people still in a strip.
    // Only an explicit manual "stageOnly" (returned above) hides them.
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
    SELF_KEY: SELF_KEY, SELF_DEFAULT: SELF_DEFAULT, normalizeSelf: normalizeSelf,
    loadSelf: loadSelf, saveSelf: saveSelf, cycleArrangement: cycleArrangement,
    cycleSize: cycleSize, cycleEdge: cycleEdge, selfEdge: selfEdge,
    floatSelf: floatSelf, reserveSelf: reserveSelf, nudgeSelf: nudgeSelf,
  };
  GifOS.meetLayout = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
