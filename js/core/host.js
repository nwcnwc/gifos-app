/*
 * host.js: the GifOS core's linker. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * The meeting is three parts that share one program:
 *   core    (meeting.js)              everything a participant is apart from drawing, input and media machinery
 *   media   (media/plane-browser.js)  the media plane on a browser's primitives
 *   view    (view/view.js)            drawing and input
 * A host loads the core and whichever of the other two it has, then links them. A browser page loads all three.
 * A host with no screen loads no view; a host with its own media machinery brings its own media part.
 *
 * LINKING. Each part publishes the names other parts use on its own object (core, media, view) and runs its
 * statements in steps. The linker runs the steps of all parts in the one order the meeting was written in, so a
 * page with all three parts runs the same program as a single script would.
 *
 * A PART THAT IS NOT THERE. Its names are stood in for: a function does nothing and returns undefined. A variable
 * of a missing VIEW throws when it is read (the view's variables are its elements: a core that reads one asks the
 * screen a question it cannot answer, so the read must surface, not be absorbed). A variable of a missing media
 * part reads as a placeholder that accepts any use (property, call, iteration) and does nothing, until the media
 * port is narrowed. Every use of a stand-in is counted (meeting.standIns()), so a host can see what the core asked
 * of a part it did not get.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const END = Object.freeze({ end: true });
  // THE ENGINE, a platform fact the core and the media plane read (platform.json WEBKIT_ENGINE). run.html sets it in a
  // head script and the Node host hands false; any other page (embed.html) gets it here, from the same test.
  if (typeof root.WEBKIT_ENGINE === 'undefined') {
    root.WEBKIT_ENGINE = (() => { try { const nav = root.navigator; if (!nav) return false; const ua = nav.userAgent || ''; if ((nav.vendor || '').indexOf('Apple') === 0) return true; return /AppleWebKit/.test(ua) && !/Chrome|Chromium|CriOS|Edg\/|FxiOS|Android/.test(ua); } catch (e) { return false; } })();
  }

  // ---- placeholders ----------------------------------------------------------------------------------------
  // A value that accepts every use. It is truthy (an object cannot be otherwise): code that branches on a
  // stand-in takes the "present" branch, which is why each use is counted and named.
  function placeholder(note, count) {
    const hit = (k) => { if (count) count(note, k); };
    const target = function () {};
    let self = null;
    self = new Proxy(target, {
      get(t, k) {
        if (k === 'then') return undefined;                       // never a thenable: an await must not hang on it
        if (k === Symbol.toPrimitive) return (hint) => (hint === 'number' ? 0 : '');
        if (k === Symbol.iterator) return function* () {};
        if (k === Symbol.asyncIterator) return async function* () {};
        if (k === 'toString') return () => '';
        if (k === 'valueOf') return () => 0;
        if (k === 'toJSON') return () => null;
        if (k === 'length' || k === 'size') return 0;
        if (typeof k === 'symbol') return undefined;
        hit(k);
        return self;
      },
      set() { return true; },
      has() { return false; },
      deleteProperty() { return true; },
      ownKeys() { return []; },
      getOwnPropertyDescriptor() { return undefined; },
      apply() { return self; },
      construct() { return self; },
    });
    return self;
  }

  // the object that stands for a part that was not loaded: `needs` is { name: 1 function | 0 variable } (the union of
  // what the loaded parts ask of it). strictVars: reading a variable that no part has set throws.
  function standIn(partName, needs, counts, strictVars) {
    const o = {};
    const count = (note, k) => { const key = note + (k != null ? '.' + String(k) : ''); counts.set(key, (counts.get(key) || 0) + 1); };
    for (const n of Object.keys(needs)) {
      if (needs[n]) {
        const f = function () { count(partName + '.' + n + '()'); return undefined; };
        Object.defineProperty(o, n, { get: () => f, enumerable: true, configurable: true });
      } else {
        let held, has = false;
        const ph = placeholder(partName + '.' + n, count);
        const read = () => {
          count(partName + '.' + n);
          if (has) return held;
          if (strictVars) throw new Error('GifOS core: the ' + partName + ' variable "' + n + '" was read, and this host has no ' + partName + ' (the core must not ask the screen)');
          return ph;
        };
        Object.defineProperty(o, n, { get: read, set: (v) => { held = v; has = true; }, enumerable: true, configurable: true });
      }
    }
    return o;
  }

  // ---- link ------------------------------------------------------------------------------------------------
  // parts: { core, media?, view? } as each part file publishes itself (GifOS.coreParts). Returns the meeting:
  //   { core, media, view }  the parts' published names (live: a read reads the meeting's own variable)
  //   run()                  runs the meeting's top level once; true when it ran to its end
  //   standIns()             [[what, count]] uses of names of parts that are not loaded
  function link(parts) {
    if (!parts || !parts.core) throw new Error('GifOS core: link needs the core part');
    const names = ['core', 'media', 'view'];
    const present = names.filter((n) => parts[n]);
    const stamp = parts.core.stamp;
    for (const n of present) if (parts[n].stamp !== stamp) throw new Error('GifOS core: part "' + n + '" is of another build (' + parts[n].stamp + ', core ' + stamp + ')');
    const counts = new Map();
    const L = { END };
    for (const n of names) {
      if (parts[n]) { L[n] = {}; continue; }
      const needs = {};
      for (const p of present) Object.assign(needs, (parts[p].needs && parts[p].needs[n]) || {});
      L[n] = standIn(n, needs, counts, n === 'view');
    }
    let ran = false, ended = false;
    function run() {
      if (ran) throw new Error('GifOS core: a meeting runs once');
      ran = true;
      const gens = present.map((n) => ({ n, g: parts[n].run(L), at: -1 }));
      for (const x of gens) { const r = x.g.next(); x.at = r.done ? -1 : r.value; }   // each part publishes its names; nothing has run
      for (;;) {
        let pick = null;
        for (const x of gens) if (x.at >= 0 && (!pick || x.at < pick.at)) pick = x;
        if (!pick) { ended = true; break; }
        const r = pick.g.next();
        if (r.done) { if (r.value !== END) break; pick.at = -1; } else pick.at = r.value;   // a part that returned early ended the meeting's start, as a return in one script would
      }
      return ended;
    }
    return { core: L.core, media: L.media, view: L.view, parts: present, stamp, run, ended: () => ended, standIns: () => Array.from(counts).sort((a, b) => b[1] - a[1]) };
  }

  // A page: every part the page loaded, linked and run. The meeting is kept at GifOS.core.meeting.
  function startPage() {
    const P = GifOS.coreParts || {};
    const m = link({ core: P.core, media: P.media, view: P.view });
    api.meeting = m;
    m.run();
    return m;
  }

  const api = { version: 1, link, startPage, placeholder, standIn, END, meeting: null };
  GifOS.core = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
