/*
 * meet-viewmode.js — the meeting's four views and Follow the speaker. No DOM.
 *
 *   Scroll  the gallery you scroll; tiles keep a readable size.
 *   Fit     everyone on one screen; nothing floats.
 *   Float   the Fit layout, and the stage and the row are panels you can drag.
 *   Focus   one person big, the others in a strip (side when wide, bottom when tall).
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

  const MODES = ['scroll', 'fit', 'float', 'focus'];
  const KEY = 'meet.view.v1.mode';
  const OLD_KEY = 'meet.view.v1.gallery'; // 0.9.25 and before: 'fit' | 'scroll'
  const FOLLOW_KEY = 'meet.view.v1.follow';

  function normalize(m) { return MODES.indexOf(m) >= 0 ? m : 'fit'; }
  function load(store) {
    if (!store || typeof store.getItem !== 'function') return 'fit';
    try {
      const m = store.getItem(KEY);
      if (m) return normalize(m);
      return store.getItem(OLD_KEY) === 'scroll' ? 'scroll' : 'fit';
    } catch (e) { return 'fit'; }
  }
  function save(store, m) {
    m = normalize(m);
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
  // The tile layout each view asks for: Scroll scrolls, the rest fit.
  function gallery(m) { return normalize(m) === 'scroll' ? 'scroll' : 'fit'; }
  // Only Float lets the stage and the row panels move.
  function floats(m) { return normalize(m) === 'float'; }
  function next(m) { const i = MODES.indexOf(normalize(m)); return MODES[(i + 1) % MODES.length]; }
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
    for (const k of loud) {
      if (!live.has(k)) continue;
      const r = runs[k];
      if (r && now - r.last <= t.gap) r.last = now;
      else runs[k] = { since: now, last: now };
    }
    for (const k of Object.keys(runs)) {
      if (!live.has(k) || now - runs[k].last > t.gap) delete runs[k];
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

  const api = {
    MODES: MODES, KEY: KEY, OLD_KEY: OLD_KEY, FOLLOW_KEY: FOLLOW_KEY,
    normalize: normalize, load: load, save: save, loadFollow: loadFollow, saveFollow: saveFollow,
    gallery: gallery, floats: floats, next: next, stripSide: stripSide,
    followState: followState, followStep: followStep, timingsOf: timingsOf,
  };
  GifOS.meetViewMode = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
