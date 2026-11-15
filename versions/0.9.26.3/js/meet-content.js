/*
 * meet-content.js — the meeting's one content area. Pure, no DOM.
 *
 * Nathan 2026-11-11: only video takes a Stage seat (people, screen shares).
 * Everything the room shares is CONTENT and lives in one area with tabs: one
 * tab per screen share, the app, the agenda. Each viewer picks their own tab.
 * A presenter can bring everyone to a tab (a request, the viewer can leave
 * again). A tab that changed while you were on another one wears a badge.
 * Any screen can switch from tabs to "see everything" side by side.
 *
 * Per view:
 *   scroll  every item is shown, stacked; no tabs (the page scrolls).
 *   fit     the area is large, the stage strip beside (wide) or below (tall).
 *   float   the area fills the screen; every people tile floats over it.
 *   focus   the area is one of the things the big view can show.
 *   phone   the area fills the screen, tab bar on top, faces a hideable strip.
 *
 * Keys: 'scr:<peer id>' a screen share, 'app' the shared app, 'agenda'.
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};

  const ORDER = { scr: 0, app: 1, agenda: 2 };
  function kindOf(key) { return key === 'app' ? 'app' : key === 'agenda' ? 'agenda' : (String(key || '').indexOf('scr:') === 0 ? 'screen' : null); }

  // The items now, in tab order: screens in the order they started, the app,
  // the agenda.
  //   src = { screens: [{ sid, name, at }], app: { on, name, by } | null, agenda: { on, title } | null }
  function items(src) {
    src = src || {};
    const out = [];
    const scr = (src.screens || []).filter((s) => s && s.sid).slice().sort((a, b) => ((+a.at || 0) - (+b.at || 0)) || (a.sid < b.sid ? -1 : a.sid > b.sid ? 1 : 0));
    const seen = new Set();
    for (const s of scr) {
      if (seen.has(s.sid)) continue;
      seen.add(s.sid);
      out.push({ key: 'scr:' + s.sid, kind: 'screen', sid: s.sid, name: String(s.name || ''), mine: !!s.mine });
    }
    if (src.app && src.app.on) out.push({ key: 'app', kind: 'app', name: String(src.app.name || ''), by: src.app.by || null, mine: !!src.app.mine });
    if (src.agenda && src.agenda.on) out.push({ key: 'agenda', kind: 'agenda', name: String(src.agenda.title || ''), mine: !!src.agenda.mine });
    return out;
  }

  // One viewer's tab state.
  //   sel     the tab I picked (null: none yet, the first tab shows)
  //   ver     key -> how many times that item changed (bumped by the page)
  //   seen    key -> the version I last saw
  //   all     true: see everything side by side
  //   brought the newest bring-everyone request taken { key, at, by }
  function state() { return { sel: null, ver: {}, seen: {}, all: false, brought: null, known: [] }; }

  // Reconcile with the items now. A new item that arrives while I am on
  // another tab wears a badge; the first item ever is simply selected. An
  // item that went away leaves no selection behind it.
  function sync(st, list) {
    const keys = list.map((i) => i.key);
    const known = new Set(st.known || []);
    for (const k of keys) {
      if (known.has(k)) continue;
      if (!(k in st.ver)) st.ver[k] = 1;
      else st.ver[k]++;
      // The first thing shared is what you look at: no badge, no tap.
      if (!st.sel || keys.indexOf(st.sel) < 0) { st.sel = k; st.seen[k] = st.ver[k]; }
    }
    for (const k of Object.keys(st.ver)) if (keys.indexOf(k) < 0) { delete st.ver[k]; delete st.seen[k]; }
    if (st.sel && keys.indexOf(st.sel) < 0) st.sel = null;
    if (!st.sel && keys.length) { st.sel = keys[0]; st.seen[keys[0]] = st.ver[keys[0]]; }
    st.known = keys;
    // Whatever is on screen is seen.
    if (st.sel) st.seen[st.sel] = st.ver[st.sel];
    if (st.all) for (const k of keys) st.seen[k] = st.ver[k];
    return st;
  }

  function select(st, key) {
    if ((st.known || []).indexOf(key) < 0) return false;
    st.sel = key;
    st.seen[key] = st.ver[key] || 0;
    return true;
  }

  // An item changed (the agenda moved on, a new screen replaced an old one).
  // visibleAll: every item is on screen now (Scroll, or see everything), so
  // nothing needs a badge.
  function bump(st, key, visibleAll) {
    if ((st.known || []).indexOf(key) < 0) return false;
    st.ver[key] = (st.ver[key] || 0) + 1;
    if (key === st.sel || visibleAll || st.all) st.seen[key] = st.ver[key];
    return true;
  }

  function badged(st, key) {
    if (key === st.sel || st.all) return false;
    return (st.ver[key] || 0) > (st.seen[key] || 0);
  }
  function badges(st) { return (st.known || []).filter((k) => badged(st, k)); }

  // Bring everyone to this tab: take it when it is newer than the last one
  // taken and the item exists here. Returns true when the selection moved.
  //   req = { key, at, by }   at: the sender's clock, compared only with
  //   other requests from the same room (a newer request wins).
  function bring(st, req) {
    if (!req || typeof req.key !== 'string' || !(+req.at > 0)) return false;
    if (st.brought && st.brought.at >= +req.at) return false;
    st.brought = { key: req.key, at: +req.at, by: req.by || null };
    if ((st.known || []).indexOf(req.key) < 0) return false;
    const was = st.sel;
    st.all = false;
    select(st, req.key);
    return was !== req.key;
  }

  // Who may bring the room to a tab: the person whose screen it is, whoever
  // runs the app, an agenda editor, and the host in an admin room.
  //   who: peer id; it: the item; ctx: { adminRoom, isAdmin, agendaEditor }
  function canBring(who, it, ctx) {
    ctx = ctx || {};
    if (!who || !it) return false;
    if (ctx.adminRoom && ctx.isAdmin) return true;
    if (it.kind === 'screen') return it.sid === who;
    if (it.kind === 'app') return it.by === who;
    if (it.kind === 'agenda') return !!ctx.agendaEditor;
    return false;
  }

  // What the area shows in a view.
  //   o = { view: 'scroll'|'fit'|'float'|'focus', phone, n, all, sel, keys }
  // Returns { tabs, show: [keys], stack }.
  function plan(o) {
    o = o || {};
    const keys = o.keys || [];
    if (!keys.length) return { tabs: false, show: [], stack: false };
    if (o.view === 'scroll') return { tabs: false, show: keys.slice(), stack: true };
    const sel = keys.indexOf(o.sel) >= 0 ? o.sel : keys[0];
    if (o.all && keys.length > 1) return { tabs: true, show: keys.slice(), stack: false };
    return { tabs: true, show: [sel], stack: false };
  }

  // See everything: split the area among n items, each kept at its own
  // aspect inside its cell, choosing the grid that gives the smallest item
  // the most room. aspects[i] > 0 is item i's width/height (an app or the
  // agenda passes 0: it fills its cell).
  function grid(box, aspects, gap) {
    const n = aspects.length;
    gap = gap != null ? gap : 8;
    if (!n || !(box.w > 0) || !(box.h > 0)) return [];
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const cw = (box.w - gap * (cols - 1)) / cols, ch = (box.h - gap * (rows - 1)) / rows;
      if (!(cw > 0) || !(ch > 0)) continue;
      let minA = Infinity;
      for (let i = 0; i < n; i++) {
        const a = aspects[i] > 0 ? aspects[i] : 0;
        let w = cw, h = ch;
        if (a) { if (w / h > a) w = h * a; else h = w / a; }
        minA = Math.min(minA, w * h);
      }
      if (!best || minA > best.minA + 0.5) best = { cols, rows, cw, ch, minA };
    }
    if (!best) return [];
    const out = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / best.cols), c = i % best.cols;
      // A short last row is centered.
      const inRow = r === best.rows - 1 ? n - r * best.cols : best.cols;
      const off = (best.cols - inRow) * (best.cw + gap) / 2;
      const cx = box.x + off + c * (best.cw + gap), cy = box.y + r * (best.ch + gap);
      const a = aspects[i] > 0 ? aspects[i] : 0;
      let w = best.cw, h = best.ch;
      if (a) { if (w / h > a) w = h * a; else h = w / a; }
      out.push({ x: Math.round(cx + (best.cw - w) / 2), y: Math.round(cy + (best.ch - h) / 2), w: Math.round(w), h: Math.round(h) });
    }
    return out;
  }

  // Scroll: one band per item, full width, each no taller than the screen.
  // Returns the bands and the total height.
  function stack(box, aspects, gap) {
    gap = gap != null ? gap : 8;
    const out = [];
    let y = box.y;
    for (let i = 0; i < aspects.length; i++) {
      const a = aspects[i] > 0 ? aspects[i] : 16 / 9;
      let w = box.w, h = w / a;
      if (h > box.h) { h = box.h; w = h * a; }
      out.push({ x: Math.round(box.x + (box.w - w) / 2), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
      y += h + gap;
    }
    return { rects: out, h: Math.max(0, y - box.y - (aspects.length ? gap : 0)) };
  }

  // Presentation view: the item fills the screen at its own aspect; the
  // speaker sits inset in a corner, a fixed share of the short side, never
  // over more than a quarter of the width.
  function presentRects(vw, vh, aspect, insetOn) {
    const a = aspect > 0 ? aspect : 16 / 9;
    let w = vw, h = vw / a;
    if (h > vh) { h = vh; w = vh * a; }
    const main = { x: Math.round((vw - w) / 2), y: Math.round((vh - h) / 2), w: Math.round(w), h: Math.round(h) };
    if (!insetOn) return { main, inset: null };
    const iw = Math.round(Math.min(vw * 0.25, Math.max(96, Math.min(vw, vh) * 0.3)));
    const ih = Math.round(iw * 9 / 16);
    const pad = 12;
    return { main, inset: { x: vw - iw - pad, y: vh - ih - pad, w: iw, h: ih } };
  }

  const api = { kindOf, items, state, sync, select, bump, badged, badges, bring, canBring, plan, grid, stack, presentRects, ORDER };
  GifOS.meetContent = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
