/*
 * meet-meters.js — the meeting's audio level meters, for debug mode only.
 *
 * Who hears whom, read at the place the sound is played: every voice this
 * page plays (a person's tile, a voice carried by a friend, the Stadium
 * mix, the Stage) and every mix this page sends on. Each source gets one
 * analyser for its life (keyed by the track or node object, never by an id),
 * and a sample every half second gives its level and, when tones are named,
 * each tone's level against the bins beside it (a voice inside a mix is told
 * apart by its pitch). The page keeps a per-second ring of what it heard, so a
 * person reading the debug log, or a check driving the page, can see a voice
 * that stopped and on which path.
 *
 * The page hands in the sources (sources()), each:
 *   { path, who, name, track | node, g, post }
 *   path  direct | friend | rowmix | stadium | stagefeed | stage | send
 *   who   the person heard on that path, or a mix name
 *   track a MediaStreamTrack to meter (metered in this module's context), or
 *   node  an AudioNode in that same context (a source inside one ear)
 *   g     the gain the page plays it at (0 = not heard), post: the level
 *         already includes it.
 * Nothing here plays sound or changes what the page plays: an analyser is
 * pulled through a gain of 0.
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};

  const FFT = 4096;
  const TONE_DB = -75;      // a tone is heard when its bin is over this
  const TONE_OVER_DB = 15;  // ... and this far over the bins 6-8 away
  const SOUND_DB = -60;     // a source with an RMS level over this carries sound
  const RING_MAX = 600;     // seconds of history kept

  const dbOf = (x) => (x > 1e-6 ? Math.round(20 * Math.log10(x) * 10) / 10 : -120);

  // The level of one tone in a spectrum (dB per bin): its bin (+-1) and the
  // mean of the bins 6-8 away on both sides.
  function toneLevel(buf, hz, f) {
    const b = Math.round(f / hz);
    let top = -200;
    for (let i = b - 1; i <= b + 1; i++) if (i > 0 && i < buf.length && buf[i] > top) top = buf[i];
    let side = 0, c = 0;
    for (const o of [6, 7, 8]) for (const j of [b - o, b + o]) if (j > 0 && j < buf.length && buf[j] > -200) { side += buf[j]; c++; }
    return { top: Math.round(top * 10) / 10, side: c ? Math.round(side / c * 10) / 10 : -200 };
  }
  const toneHeard = (l) => l.top > TONE_DB && l.top - l.side > TONE_OVER_DB;

  function create(o) {
    const getAc = o.ac, sources = o.sources;
    const taps = new Map();   // track or node -> { an, src, tbuf, fbuf, seen }
    let sink = null, sinkAc = null, tones = {}, timer = null, last = null, ring = [], secRow = null, err = null, n = 0;

    function sinkFor(ac) {
      if (sink && sinkAc === ac) return sink;
      sink = ac.createGain(); sink.gain.value = 0; sink.connect(ac.destination); sinkAc = ac;
      return sink;
    }
    function tapOf(ac, s) {
      const obj = s.node || s.track;
      let t = taps.get(obj);
      if (t && t.ac === ac) return t;
      if (t) drop(obj);
      const an = ac.createAnalyser(); an.fftSize = FFT; an.smoothingTimeConstant = 0;
      let src = null;
      if (s.node) s.node.connect(an);
      else { src = ac.createMediaStreamSource(new MediaStream([s.track])); src.connect(an); }
      an.connect(sinkFor(ac));
      t = { ac, an, src, node: s.node || null, tbuf: new Float32Array(FFT), fbuf: new Float32Array(an.frequencyBinCount), seen: 0 };
      taps.set(obj, t);
      return t;
    }
    function drop(obj) {
      const t = taps.get(obj); if (!t) return;
      try { if (t.src) t.src.disconnect(); } catch (e) {}
      try { if (t.node) t.node.disconnect(t.an); } catch (e) {}
      try { t.an.disconnect(); } catch (e) {}
      taps.delete(obj);
    }

    // One reading of every source now.
    function sample() {
      const ac = getAc();
      const at = Date.now();
      const out = { at, ac: ac ? ac.state : null, n: ++n, rows: [] };
      if (!ac) { last = out; return out; }
      let list = [];
      try { list = sources() || []; } catch (e) { err = String(e).slice(0, 120); }
      const names = Object.keys(tones), hz = ac.sampleRate / FFT;
      for (const s of list) {
        const obj = s.node || s.track;
        if (!obj) continue;
        if (s.track && s.track.readyState !== 'live') continue;
        let t = null;
        try { t = tapOf(ac, s); } catch (e) { err = String(e).slice(0, 120); continue; }
        t.seen = at;
        t.an.getFloatTimeDomainData(t.tbuf);
        let e = 0, pk = 0;
        for (let i = 0; i < t.tbuf.length; i++) { const x = t.tbuf[i]; e += x * x; const a = x < 0 ? -x : x; if (a > pk) pk = a; }
        const g = s.g == null ? 1 : +s.g;
        const row = { path: s.path, who: s.who == null ? null : String(s.who), name: s.name || null, on: g > 0, g: Math.round(g * 100) / 100,
          db: dbOf(Math.sqrt(e / t.tbuf.length)), pk: Math.round(pk * 1000) / 1000, post: !!s.post, tn: null, heard: [] };
        if (names.length) {
          t.an.getFloatFrequencyData(t.fbuf);
          row.tn = {};
          for (const nm of names) { const l = toneLevel(t.fbuf, hz, tones[nm]); row.tn[nm] = l; if (row.on && toneHeard(l)) row.heard.push(nm); }
        }
        row.sound = row.on && row.db > SOUND_DB;
        out.rows.push(row);
      }
      // a track that ended or a node no source names for 30 s leaves the graph
      for (const [obj, t] of [...taps]) if ((obj.readyState && obj.readyState !== 'live') || at - t.seen > 30000) drop(obj);
      last = out;
      keepSecond(out);
      return out;
    }

    // The per-second ring: for each path+who, the loudest level and every tone heard in that second.
    function keepSecond(s) {
      const sec = Math.floor(s.at / 1000) * 1000;
      if (!secRow || secRow.t !== sec) {
        secRow = { t: sec, ac: s.ac, r: {} };
        ring.push(secRow);
        if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
      }
      secRow.ac = s.ac;
      for (const r of s.rows) {
        const k = r.path + ':' + (r.who || '-');
        const c = secRow.r[k] || (secRow.r[k] = { db: -120, on: 0, h: [] });
        if (r.db > c.db) c.db = r.db;
        if (r.on) c.on = 1;
        for (const h of r.heard) if (!c.h.includes(h)) c.h.push(h);
      }
    }

    // Who this page hears now: by talker (the person on a direct or friend
    // path; a tone's name on any path) the paths that carry them.
    function hears(s) {
      const h = {};
      const add = (k, p) => { const l = h[k] || (h[k] = []); if (!l.includes(p)) l.push(p); };
      for (const r of (s || last || { rows: [] }).rows) {
        if (r.sound && (r.path === 'direct' || r.path === 'friend') && r.who) add(r.who, r.path);
        for (const nm of r.heard) add(nm, r.path);
      }
      return h;
    }

    return {
      sample,
      start(ms) { if (!timer) timer = setInterval(() => { try { sample(); } catch (e) { err = String(e).slice(0, 120); } }, ms || 500); return true; },
      stop() { if (timer) clearInterval(timer); timer = null; for (const obj of [...taps.keys()]) drop(obj); },
      running: () => !!timer,
      // { name: hz }: the pitches a check plays, one per talker. {} turns the tone read off.
      setTones(t) { tones = {}; for (const [k, v] of Object.entries(t || {})) if (+v > 0) tones[k] = +v; return Object.keys(tones).length; },
      tones: () => Object.assign({}, tones),
      read() { const s = last || sample(); return Object.assign({ err, taps: taps.size, hears: hears(s) }, s); },
      hears: () => hears(last),
      // the ring since a wall time (ms), oldest first
      log: (since) => ring.filter((r) => r.t >= (since || 0)),
      ring: () => ring,
    };
  }

  // A small fixed panel for a person in debug mode: one line per source, its
  // path, the person and a level bar. Pointer events pass through.
  function paint(el, s) {
    if (!el || !s) return;
    const bar = (db) => { const k = Math.max(0, Math.min(10, Math.round((db + 70) / 6))); return '█'.repeat(k) + '·'.repeat(10 - k); };
    const lines = ['audio ' + (s.ac || 'no context')];
    for (const r of s.rows) lines.push((r.on ? '' : '(off) ') + r.path + ' ' + (r.name || r.who || '-') + ' ' + bar(r.db) + ' ' + Math.round(r.db) + ' dB' + (r.heard.length ? ' ♪' + r.heard.join(',') : ''));
    el.textContent = lines.join('\n');
  }

  const api = { create, paint, toneLevel, toneHeard, dbOf, TONE_DB, TONE_OVER_DB, SOUND_DB };
  GifOS.meetMeters = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
