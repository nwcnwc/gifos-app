/*
 * GifOS Core: the shared view library (GifOS.viewKit). Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * A surface page (the embed player, the app runtime's audio view, ...) hosts the same signed core and browser media
 * plane as the meeting page and brings its own small view part. Every such view keeps one contract with the core, and
 * draws from the same few readings of the core's answers. Both live here, once:
 *
 *   viewKit.host(L, opts)   the contract: every name the core and the media plane ask of the view exists. The ones a
 *                           surface has no use for are the linker's counted stand-ins (as the Node host's headless view);
 *                           a view VARIABLE the media plane reads is real (opts.elements, else a detached element);
 *                           a view function whose result the core takes apart returns a record (makeTile).
 *   viewKit.part(stamp, make)  the surface's view part: make(L) -> { names, setup }; names publish at the first step,
 *                           setup() wires input after the core's whole top level.
 *   readings                stageLevel, watchCount, nameOf, present: what the core already decided, read for drawing.
 *   acts                    pip, fullscreen: the browser's own controls over a video element.
 *
 * Nothing here decides a rule of the meeting: who is on the Stage, what it carries, who is hosted, the password and the
 * sound gate are the core's answers.
 */
(function (root) {
  'use strict';
  var GifOS = root.GifOS = root.GifOS || {};
  var own = Object.prototype.hasOwnProperty;

  // a participant's tile and its parts (js/core/node.js VIEW_RECORDS)
  var RECORDS = { makeTile: ['tile', 'video', 'label', 'avatar', 'chips', 'cap', 'modbar', 'voteBtn'] };

  function host(L, opts) {
    opts = opts || {};
    var P = GifOS.coreParts || {};
    var needs = {};
    [P.core, P.media].forEach(function (p) { if (p && p.needs && p.needs.view) Object.assign(needs, p.needs.view); });
    var counts = new Map();
    var names = GifOS.core.standIn('view', needs, counts, true);
    var mine = {};
    function vr(name, v) { Object.defineProperty(names, name, { value: v, writable: true, enumerable: true, configurable: true }); }
    function fn(name, f) { mine[name] = f; }
    var els = opts.elements || {};
    Object.keys(els).forEach(function (n) { vr(n, els[n]); });
    // the media plane draws the blur through two canvases of the view's
    ['A', 'B'].forEach(function (x) {
      if (own.call(els, 'blur' + x)) return;
      var c = document.createElement('canvas'); vr('blur' + x, c); vr('blur' + x + 'ctx', c.getContext('2d'));
    });
    if (!own.call(els, 'paintFaders')) vr('paintFaders', function () {});
    Object.keys(needs).forEach(function (n) {   // any other element a core asks for: a detached stand-in, never a throw at load
      if (needs[n] || own.call(els, n)) return;
      var d = Object.getOwnPropertyDescriptor(names, n);
      if (d && d.get) { try { d.get(); } catch (e) { vr(n, document.createElement(/Btn$/.test(n) ? 'button' : 'div')); } }
    });
    Object.keys(RECORDS).forEach(function (n) {
      if (opts.records && opts.records[n]) { fn(n, opts.records[n]); return; }
      fn(n, function () { var r = {}; RECORDS[n].forEach(function (k) { r[k] = GifOS.core.placeholder('view.' + n + '().' + k); }); return r; });
    });
    return {
      C: L.core, M: L.media, names: names, needs: needs, counts: counts, fn: fn, vr: vr,
      wants: function (n) { return own.call(needs, n); },
      // paint(n...): each named paint call the core makes is this surface's one repaint
      paintsAll: function (list, paint) { list.forEach(function (n) { if (own.call(needs, n)) fn(n, paint); }); },
      finish: function () {
        Object.keys(mine).forEach(function (n) { Object.defineProperty(names, n, { value: mine[n], writable: true, enumerable: true, configurable: true }); });
        names.standInsForTest = function () { return Array.from(counts); };
        return names;
      },
    };
  }

  // THE STEPS. The first step only publishes the view's names (nothing of the core has run yet). The view wires its
  // input after the core's whole top level (a step past every part's last), when the entry is parsed and the join is
  // under way.
  var AFTER_ALL = 1e9;
  function part(make) {
    var P = GifOS.coreParts || {};
    if (!P.core || !GifOS.core) return null;
    var api = {
      name: 'view', stamp: P.core.stamp, needs: {}, count: 0, exports: {},
      run: function* (L) {
        var made = make(L);
        Object.defineProperties(L.view, Object.getOwnPropertyDescriptors(made.names));
        yield AFTER_ALL;
        made.setup();
        return L.END;
      },
    };
    GifOS.coreParts.view = api;
    return api;
  }

  // ---- readings of the core's answers ----
  function stageLevel(C) {   // the core's one Stage blur decision, the same /meet and /cast apply (STAGEBLUR)
    try { return C.blurLevelFor('stage'); } catch (e) { return 2; }
  }
  function watchCount(C) {   // people watching: the room less the stage and the hosts
    var up = new Set();
    try { C.stageIds().forEach(function (id) { up.add(id); }); } catch (e) {}
    try { C.adminsNow().forEach(function (id) { up.add(id); }); } catch (e) {}
    return Math.max(0, C.roomHeadCount() - up.size);
  }
  function nameOf(C, id, label) {
    if (label) return String(label);
    try {
      if (id && id === C.myId && typeof C.myName === 'function') return String(C.myName() || '');
      var p = C.peers && typeof C.peers.get === 'function' ? C.peers.get(id) : null;
      if (p && p.name) return String(p.name);
    } catch (e) {}
    return '';
  }
  // who is here: me first, then everyone the core links to, each with the mute state their status says
  function present(C) {
    var out = [];
    try { out.push({ id: C.myId, name: nameOf(C, C.myId) || 'You', me: true, muted: !!(C.myStatus && C.myStatus.mic === false) }); } catch (e) {}
    try {
      C.peers.forEach(function (p, id) {
        var st = C.statusOf && C.statusOf.get ? C.statusOf.get(id) : null;
        out.push({ id: id, name: (p && p.name) || '', me: false, muted: !!(st && st.mic === false), bot: !!(st && st.bot) });
      });
    } catch (e) {}
    return out;
  }

  // ---- the browser's own controls ----
  var pip = {
    kind: function (v) {
      try { if (document.pictureInPictureEnabled) return 'std'; } catch (e) {}
      try { if (v && typeof v.webkitSupportsPresentationMode === 'function' && v.webkitSupportsPresentationMode('picture-in-picture')) return 'wk'; } catch (e) {}
      return '';
    },
    toggle: function (v) {
      if (!v) return;
      try {
        if (document.pictureInPictureEnabled) {
          if (document.pictureInPictureElement) { var ex = document.exitPictureInPicture(); if (ex && ex.catch) ex.catch(function () {}); }
          else if (typeof v.requestPictureInPicture === 'function') { var pr = v.requestPictureInPicture(); if (pr && pr.catch) pr.catch(function () {}); }
          return;
        }
        if (typeof v.webkitSupportsPresentationMode === 'function' && v.webkitSupportsPresentationMode('picture-in-picture') && typeof v.webkitSetPresentationMode === 'function') {
          v.webkitSetPresentationMode(v.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
        }
      } catch (e) {}
    },
  };
  var fullscreen = {
    // the page, else (iPhone: only a video element goes full screen) the video the surface shows
    toggle: function (video) {
      try {
        if (GifOS.fullscreen && GifOS.fullscreen.supported()) { GifOS.fullscreen.toggle(document.documentElement); return; }
        var d = document, de = d.documentElement;
        if (de.requestFullscreen || de.webkitRequestFullscreen) {
          if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
          else (de.requestFullscreen || de.webkitRequestFullscreen).call(de);
          return;
        }
        var v = typeof video === 'function' ? video() : video;
        if (v && v.webkitEnterFullscreen) v.webkitEnterFullscreen();
      } catch (e) {}
    },
    on: function () { try { return !!(document.fullscreenElement || document.webkitFullscreenElement); } catch (e) { return false; } },
  };

  // The app bar's GIF shows the animation only (the packed app is stripped off it so it paints light), so a
  // browser "Save image as" on it would save a file that does not run. This arms the <img>: the first pointer
  // hover, press, touch or right-click builds a clean WORKING copy (the app, no saved data, gif.stripState) from
  // the full bytes and points the <img> at it, so the browser's own save gets a real app GIF with no data.
  // Built lazily and once per set of bytes: starting the app never pays for it. A tap on the GIF asks the same
  // two-choice question as Save (onTap). `full` is null to disarm.
  function armAppGif(img, full, onTap) {
    if (!img) return;
    img.__agFull = full || null; img.__agClean = null;
    if (img.__agUrl) { try { URL.revokeObjectURL(img.__agUrl); } catch (e) {} img.__agUrl = null; }
    if (!img.__agArmed) {
      img.__agArmed = true;
      var ensure = function () {
        var f = img.__agFull;
        if (!f || img.__agClean || !GifOS.gif || !GifOS.gif.stripState) return;
        var mine = img.__agClean = GifOS.gif.stripState(f).then(function (b) {
          if (img.__agFull !== f) return;
          var url = URL.createObjectURL(new Blob([b], { type: 'image/gif' }));
          if (img.__agUrl) { try { URL.revokeObjectURL(img.__agUrl); } catch (e) {} }
          img.__agUrl = url; img.src = url;
        }).catch(function () { if (img.__agClean === mine) img.__agClean = null; });
      };
      ['pointerenter', 'pointerdown', 'touchstart', 'contextmenu'].forEach(function (ev) { img.addEventListener(ev, ensure, { passive: true, capture: true }); });
      img.addEventListener('click', function () { if (img.__agTap) img.__agTap(); });
    }
    img.__agTap = onTap || null;
    if (onTap) img.style.cursor = 'pointer';
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  GifOS.viewKit = { version: 1, RECORDS: RECORDS, host: host, part: part, stageLevel: stageLevel, watchCount: watchCount, nameOf: nameOf, present: present, pip: pip, fullscreen: fullscreen, armAppGif: armAppGif, esc: esc };
})(typeof window !== 'undefined' ? window : globalThis);
