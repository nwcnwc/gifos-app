/*
 * meet-layout.js — the content box, the self view spec and the control bar spot. No DOM.
 * Tile placement is meet-zones.js.
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};

  // The content box is the whole screen. The dock and the header float
  // over the tiles, so they do not inset this box and a wake cannot move a
  // face. opts.top and opts.bottom are ignored on purpose.
  function viewBox(vw, vh, opts) {
    opts = opts || {};
    const landscape = vw > vh;
    const phone = opts.phone != null ? !!opts.phone : (!landscape && vw < 700);
    return {
      x: 0,
      y: 0,
      w: Math.max(1, vw),
      h: Math.max(1, vh),
      phone: phone,
      dock: 0,
    };
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
    viewBox: viewBox,
    BAR_KEY: BAR_KEY, clampBar: clampBar, defaultBar: defaultBar, nudgeBar: nudgeBar,
    loadBar: loadBar, saveBar: saveBar,
    SELF_KEY: SELF_KEY, SELF_DEFAULT: SELF_DEFAULT, normalizeSelf: normalizeSelf,
    loadSelf: loadSelf, saveSelf: saveSelf, selfEdge: selfEdge,
    floatSelf: floatSelf, nudgeSelf: nudgeSelf,
  };
  GifOS.meetLayout = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
