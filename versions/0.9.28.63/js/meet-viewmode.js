/*
 * meet-viewmode.js — the meeting's four views and Follow the speaker. No DOM.
 *
 *   Scroll  the gallery you scroll; tiles keep a readable size.
 *   Fit     everyone on one screen; nothing floats.
 *   Drag    every person tile moves and resizes on its own (with content: the
 *           presentation view). Named Drag, not Float: Float is picture-in-picture.
 *   Focus   one person big, the others in a strip (side when wide, bottom when tall).
 *   Stage   only what is on the Stage, filling the screen: offered while the Stage carries something (a screen,
 *           the app, the agenda, a rebroadcast, Stage faces), one tab each when there are several. It is a view
 *           of this screen only (nothing is sent) and it is never saved: a reload, or a Stage that empties,
 *           goes back to the view before it.
 *
 * Follow the speaker (Focus only) moves the big view to whoever is talking, with
 * two holds read from GifOS.timings (source: gifos timings.json):
 *   FOLLOW_ON_MS    a new talker must talk this long before taking the view
 *   FOLLOW_HOLD_MS  whoever took the view keeps it at least this long
 *   FOLLOW_GAP_MS   a pause shorter than this is still the same turn
 * The person on the big view also keeps it while they are still talking.
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};

  const MODES = ['scroll', 'fit', 'drag', 'focus'];
  const STAGE = 'stage';
  const VIEWS = MODES.concat([STAGE]);   // every view the picker can show; Stage only while the Stage carries something
  const KEY = 'meet.view.v1.mode';
  const OLD_KEY = 'meet.view.v1.gallery'; // 0.9.25 and before: 'fit' | 'scroll'
  const FOLLOW_KEY = 'meet.view.v1.follow';

  // 'float' is the Drag view's name before 2026-11-11 (Float is picture-in-picture): a saved 'float' reads as Drag.
  function normalize(m) { if (m === 'float') return 'drag'; return VIEWS.indexOf(m) >= 0 ? m : 'fit'; }
  function load(store) {
    if (!store || typeof store.getItem !== 'function') return 'fit';
    try {
      const m = store.getItem(KEY);
      if (m && m !== STAGE) return normalize(m);
      return store.getItem(OLD_KEY) === 'scroll' ? 'scroll' : 'fit';
    } catch (e) { return 'fit'; }
  }
  function save(store, m) {
    m = normalize(m);
    if (m === STAGE) return m;   // the Stage view is never the view a meeting opens in
    if (!store || typeof store.setItem !== 'function') return m;
    try {
      store.setItem(KEY, m);
      // Older readers of the gallery key keep reading the right layout.
      store.setItem(OLD_KEY, m === 'scroll' ? 'scroll' : 'fit');
    } catch (e) {}
    return m;
  }
  function loadFollow(store) {
    if (!store || typeof store.getItem !== 'function') return true;
    try { return store.getItem(FOLLOW_KEY) !== '0'; } catch (e) { return true; }
  }
  function saveFollow(store, on) {
    if (!store || typeof store.setItem !== 'function') return !!on;
    try { store.setItem(FOLLOW_KEY, on ? '1' : '0'); } catch (e) {}
    return !!on;
  }
  // What the floating window shows (Settings > Floating window shows): the person's order of app share, screen share
  // and Stage faces, each on or off; follow the speaker is always last and not in the list. Saved on this device.
  const PIP_KEY = 'meet.pip.v1.order', PIP_KINDS = ['app', 'screen', 'stage'];
  function pipNormalize(list) {
    const out = [], seen = {};
    if (Array.isArray(list)) for (const x of list) if (x && PIP_KINDS.indexOf(x.k) >= 0 && !seen[x.k]) { seen[x.k] = 1; out.push({ k: x.k, on: x.on !== false }); }
    for (const k of PIP_KINDS) if (!seen[k]) out.push({ k: k, on: true });
    return out;
  }
  function loadPip(store) {
    let raw = null;
    try { raw = store && typeof store.getItem === 'function' ? JSON.parse(store.getItem(PIP_KEY) || 'null') : null; } catch (e) { raw = null; }
    return pipNormalize(raw);
  }
  function savePip(store, list) {
    const out = pipNormalize(list);
    try { if (store && typeof store.setItem === 'function') store.setItem(PIP_KEY, JSON.stringify(out)); } catch (e) {}
    return out;
  }
  // The tile layout each view asks for: Scroll scrolls, the rest fit.
  function gallery(m) { return normalize(m) === 'scroll' ? 'scroll' : 'fit'; }
  // Only the Drag view lets the tiles move.
  function floats(m) { return normalize(m) === 'drag'; }
  function next(m) { const i = MODES.indexOf(normalize(m)); return MODES[(i + 1) % MODES.length]; }

  // ---- the Stage view (Nathan 2026-11-25): only the Stage, full screen, portrait or landscape ----
  // The things on the Stage are the meeting's content items (screens, the app, the agenda: the content region below)
  // and the Stage's own pictures (the people on it, a rebroadcast; a broadcast's whole Stage). One tab each.
  //   src = { content: [{ key, kind, label }], faces: { n, label } | null }
  //   -> [{ key, kind, label }]   content in its own tab order, then the faces ('stage:faces')
  const FACES = 'stage:faces';
  function stageTabs(src) {
    src = src || {};
    const out = [];
    const seen = {};
    for (const it of (src.content || [])) {
      if (!it || !it.key || seen[it.key]) continue;
      seen[it.key] = 1;
      out.push({ key: String(it.key), kind: it.kind || 'content', label: String(it.label || '') });
    }
    if (src.faces && (+src.faces.n || 0) > 0) out.push({ key: FACES, kind: 'faces', label: String(src.faces.label || '') });
    return out;
  }
  // The view is offered only while the Stage carries something.
  function stageOn(tabs) { return Array.isArray(tabs) && tabs.length > 0; }
  // Which tab fills the screen: the one picked, while it is still there; else the content tab the meeting's own area
  // shows (cur); else the first.
  function stagePick(tabs, sel, cur) {
    const keys = (tabs || []).map((t) => t.key);
    if (!keys.length) return null;
    if (sel && keys.indexOf(sel) >= 0) return sel;
    if (cur && keys.indexOf(cur) >= 0) return cur;
    return keys[0];
  }
  // The screen's plan: a tab strip only when there are several, and the box the picked one fills (the screen under the
  // strip). w, h: the window; top: where the strip starts (under the top bar), barH: the strip's height.
  function stagePlan(tabs, sel, cur, w, h, top, barH) {
    const show = stagePick(tabs, sel, cur);
    const strip = (tabs || []).length > 1;
    const y = strip ? Math.max(0, +top || 0) + Math.max(0, +barH || 0) : 0;
    return { show: show, tabs: strip, bar: strip ? { y: Math.max(0, +top || 0), h: Math.max(0, +barH || 0) } : null,
      box: { x: 0, y: y, w: Math.max(1, +w || 1), h: Math.max(1, (+h || 1) - y) } };
  }
  // A picture in a box at its own aspect: centered, never cropped, never stretched (letterbox or pillarbox).
  function letterbox(box, aspect) {
    const a = +aspect > 0 ? +aspect : 16 / 9;
    let w = box.w, h = box.h;
    if (w / h > a) w = h * a; else h = w / a;
    return { x: Math.round(box.x + (box.w - w) / 2), y: Math.round(box.y + (box.h - h) / 2), w: Math.round(w), h: Math.round(h) };
  }
  // Where the meeting goes back to when it leaves the Stage view: the view it came from (never the Stage itself).
  function stageBack(was) { const m = normalize(was); return m === STAGE ? 'fit' : m; }
  const stage = { KEY: STAGE, FACES: FACES, tabs: stageTabs, on: stageOn, pick: stagePick, plan: stagePlan, letterbox: letterbox, back: stageBack };
  // Where the Focus strip goes: down the side when the screen is wide, across
  // the bottom when it is tall.
  function stripSide(w, h) { return (+w || 0) >= (+h || 0) ? 'side' : 'bottom'; }

  function timingsOf(t) {
    const T = t || (GifOS.timings || {});
    return {
      on: +T.FOLLOW_ON_MS > 0 ? +T.FOLLOW_ON_MS : 0,
      hold: +T.FOLLOW_HOLD_MS > 0 ? +T.FOLLOW_HOLD_MS : 0,
      gap: +T.FOLLOW_GAP_MS > 0 ? +T.FOLLOW_GAP_MS : 0,
    };
  }
  function followState() { return { holder: null, takenAt: 0, runs: {} }; }

  // One step of Follow the speaker.
  //   st      followState(), kept by the caller between steps
  //   talking keys whose voice is loud right now (only people who can be followed)
  //   keys    every key the strip can show now
  //   now     ms
  //   T       optional { FOLLOW_ON_MS, FOLLOW_HOLD_MS, FOLLOW_GAP_MS } (else GifOS.timings)
  // Returns { key, changed, wakeAt }: key is the followed person (null: nobody yet),
  // wakeAt the next time the answer can change with no new sample (0: none).
  function followStep(st, talking, keys, now, T) {
    const t = timingsOf(T);
    const runs = st.runs;
    const live = new Set(keys || []);
    const loud = new Set(talking || []);
    // A turn ends on a pause the meter heard: quiet samples, and the next loud one more than FOLLOW_GAP_MS after the last
    // loud one. Time with no sample at all (a busy page's timer firing late) is not a pause, so a voice loud at every
    // sample stays one turn.
    for (const k of loud) {
      if (!live.has(k)) continue;
      const r = runs[k];
      if (r && !(r.quiet && now - r.last > t.gap)) { r.last = now; r.quiet = false; }
      else runs[k] = { since: now, last: now, quiet: false };
    }
    for (const k of Object.keys(runs)) {
      if (!live.has(k)) { delete runs[k]; continue; }
      if (loud.has(k)) continue;
      runs[k].quiet = true;
      if (now - runs[k].last > t.gap) delete runs[k];
    }
    const talks = (k) => !!runs[k];
    const before = st.holder;
    if (st.holder && !live.has(st.holder)) st.holder = null;
    let wakeAt = 0;
    const wake = (at) => { if (at > now && (!wakeAt || at < wakeAt)) wakeAt = at; };
    for (const k of Object.keys(runs)) wake(runs[k].last + t.gap + 1);
    let keep = false;
    if (st.holder) {
      if (talks(st.holder)) keep = true;
      else if (now - st.takenAt < t.hold) { keep = true; wake(st.takenAt + t.hold); }
    }
    if (!keep) {
      // The longest unbroken talker who has talked long enough. With nobody on
      // the view yet, the first talker takes it at once.
      let best = null;
      for (const k of Object.keys(runs)) {
        if (k === st.holder) continue;
        const r = runs[k];
        // Talk time is the voiced span (first to last loud sample), so the
        // trailing FOLLOW_GAP_MS of a short "yes" never ripens it.
        const ripe = !st.holder || r.last - r.since >= t.on;
        if (!ripe) continue;
        if (!best || r.since < runs[best].since) best = k;
      }
      if (best) { st.holder = best; st.takenAt = now; }
    }
    return { key: st.holder, changed: st.holder !== before, wakeAt: wakeAt };
  }

  // The content region (Nathan 2026-11-11): shared screens, apps and, later,
  // the content tabs (an agenda, a document) are a region of their own that
  // every view places: Scroll lists every item, Fit keeps it large with the
  // stage beside or below, Drag gives it the screen with the people as
  // insets, Focus can put one item on the big view. A feature that shows
  // content registers a provider here; the page asks for the items.
  //   add(fn) -> remove()   fn() returns [{ key, label, stream | v, aspect, kind }]
  //   items()               every provider's items, each key prefixed 'content:'
  const providers = [];
  const content = {
    add(fn) {
      if (typeof fn !== 'function') return function () {};
      providers.push(fn);
      return function () { const i = providers.indexOf(fn); if (i >= 0) providers.splice(i, 1); };
    },
    items() {
      const out = [];
      for (let i = 0; i < providers.length; i++) {
        let list = [];
        try { list = providers[i]() || []; } catch (e) { list = []; }
        for (let j = 0; j < list.length; j++) {
          const it = list[j];
          if (!it || !it.key) continue;
          out.push(Object.assign({}, it, { key: String(it.key).indexOf('content:') === 0 ? it.key : 'content:' + it.key, fit: 'contain' }));
        }
      }
      return out;
    },
  };

  const api = {
    content: content,
    MODES: MODES, VIEWS: VIEWS, STAGE: STAGE, stage: stage, KEY: KEY, OLD_KEY: OLD_KEY, FOLLOW_KEY: FOLLOW_KEY,
    normalize: normalize, load: load, save: save, loadFollow: loadFollow, saveFollow: saveFollow,
    gallery: gallery, floats: floats, next: next, stripSide: stripSide,
    followState: followState, followStep: followStep, timingsOf: timingsOf,
    PIP_KEY: PIP_KEY, loadPip: loadPip, savePip: savePip,
  };
  GifOS.meetViewMode = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
