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
 *   clear                   the viewer's own unblur (clearButtons) and Report (clearReport) in a hosted room with no
 *                           password whose clear right the core reads (clearNoPwState); every surface draws the same.
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

  // ---- CLEAR WITHOUT A PASSWORD: the viewer's own choice (Nathan 2026-11-24/25) ----
  // The core decides everything (clearNoPwState: mode '' | 'stage' | 'all', tapped; the blur levels follow it). This only
  // draws the viewer's buttons: "Tap to unblur" until this viewer taps (for this room, this session), then "Blur again";
  // and Report, which points to the police / NCMEC and never takes content ("Tell GifOS" sends only the credential id).
  function say(C, k, en) { try { return C.uiText(k, en); } catch (e) { return en; } }
  function clearReport(C, send) {   // send: the core's reportClearHost (default C.reportClearHost)
    var m = document.getElementById('clearnopw-report');
    if (m) { m.style.display = ''; return m; }
    m = document.createElement('div');
    m.id = 'clearnopw-report'; m.className = 'name-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    var box = document.createElement('div'); box.className = 'name-box';
    var p1 = document.createElement('p');
    p1.textContent = say(C, 'clearRepPolice', 'If you see illegal activity, report it to your local police or authorities (US: NCMEC CyberTipline, report.cybertip.org). Please don\'t send us copies.');
    var a = document.createElement('a'); a.href = 'https://report.cybertip.org'; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'report.cybertip.org';
    var p2 = document.createElement('p'); p2.id = 'clearnopw-rep-note';
    p2.textContent = say(C, 'clearRepTell', 'Tell GifOS about this host: this sends only the host\'s plan id, never the room, its link or any picture, so we can review the plan\'s clear-video right.');
    var acts = document.createElement('div'); acts.className = 'blurwhy-acts';
    var tell = document.createElement('button'); tell.type = 'button'; tell.id = 'clearnopw-tell'; tell.textContent = say(C, 'clearRepTellBtn', 'Tell GifOS about this host');
    var close = document.createElement('button'); close.type = 'button'; close.id = 'clearnopw-close'; close.textContent = say(C, 'close', 'Close');
    tell.onclick = function () {
      tell.disabled = true;
      Promise.resolve().then(function () { return send ? send() : C.reportClearHost(); }).catch(function () { return 'failed'; }).then(function (r) {
        p2.textContent = r === 'sent' ? say(C, 'clearRepSent', 'Sent. Thank you.') : say(C, 'clearRepFailed', 'Could not send. Please try again later.');
        tell.disabled = r === 'sent';
      });
    };
    close.onclick = function () { m.style.display = 'none'; };
    acts.append(tell, close); box.append(p1, a, p2, acts); m.appendChild(box); document.body.appendChild(m);
    m.style.display = '';
    return m;
  }
  // clearButtons(C, bar, cls): keep the three buttons in `bar` in step with the core's answer (call on every repaint).
  function clearButtons(C, bar, cls) {
    if (!bar) return;
    var st = { mode: '', tapped: false };
    try { st = C.clearNoPwState() || st; } catch (e) {}
    var ids = ['clear-tap', 'clear-reblur', 'clear-rep'], els = {};
    ids.forEach(function (id) {
      var b = document.getElementById(id);
      if (!b) {
        b = document.createElement('button'); b.type = 'button'; b.id = id; if (cls) b.className = cls; b.hidden = true;
        b.onclick = id === 'clear-tap' ? function () { try { C.tapUnblur(); } catch (e) {} } : id === 'clear-reblur' ? function () { try { C.blurAgain(); } catch (e) {} } : function () { clearReport(C); };
        bar.appendChild(b);
      }
      els[id] = b;
    });
    var on = !!st.mode;
    var words = { 'clear-tap': say(C, 'blurWhyTap', 'Blurred: tap to unblur'), 'clear-reblur': say(C, 'clearBlurAgain', 'Blur again'), 'clear-rep': say(C, 'clearReport', 'Report') };
    var show = { 'clear-tap': on && !st.tapped && st.offer !== false, 'clear-reblur': on && !!st.tapped, 'clear-rep': on };
    ids.forEach(function (id) { var b = els[id]; if (b.textContent !== words[id]) b.textContent = words[id]; if (b.hidden !== !show[id]) b.hidden = !show[id]; });
    if (!on) { var m = document.getElementById('clearnopw-report'); if (m) m.remove(); }
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  GifOS.viewKit = { version: 1, RECORDS: RECORDS, host: host, part: part, stageLevel: stageLevel, watchCount: watchCount, nameOf: nameOf, present: present, pip: pip, fullscreen: fullscreen, clearButtons: clearButtons, clearReport: clearReport, esc: esc };
})(typeof window !== 'undefined' ? window : globalThis);
