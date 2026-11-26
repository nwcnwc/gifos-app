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
 *   acts                    pip, fullscreen: the browser's own controls over a video element (fullscreen.enterStage /
 *                           leaveStage: the Stage view's full screen on every surface).
 *   stageNames, calm        the Stage's names over the picture, and the watching surfaces' one idle fade.
 *   cellCards               a camera-off person's card (avatar or initial) over their cell of a received picture.
 *   clear                   the viewer's own unblur (clearButtons) and Report (clearReport, from the info panel / More menu) in a hosted room with no
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
    // The Stage view's full screen (every surface's one rule). The page takes the screen where the browser allows it:
    // the Stage view is the page's own layout, so its tabs, the captions, the version label and the floating bar stay
    // with it. A browser that lets only a video go full screen (iPhone) gets the one video the view shows, and only
    // while this viewer sees that picture clear: the browser's own player draws a video without the page's blur, so a
    // blurred picture stays in the page's full-height layout. Nothing else changes: the orientation is never locked.
    // Returns 'page', 'video', 'already' (the page held the screen before) or '' (the page's own full-height layout).
    enterStage: function (video, clear) {
      try {
        var d = document, de = d.documentElement;
        if (d.fullscreenElement || d.webkitFullscreenElement) return 'already';
        if (GifOS.fullscreen && GifOS.fullscreen.supported()) { GifOS.fullscreen.enter(de); return 'page'; }
        if ((d.fullscreenEnabled && de.requestFullscreen) || (d.webkitFullscreenEnabled && de.webkitRequestFullscreen)) {
          var p = de.requestFullscreen ? de.requestFullscreen() : de.webkitRequestFullscreen();
          if (p && p.catch) p.catch(function () {});
          return 'page';
        }
        var v = typeof video === 'function' ? video() : video;
        if (v && clear && typeof v.webkitEnterFullscreen === 'function' && v.readyState >= 1) { v.webkitEnterFullscreen(); return 'video'; }
      } catch (e) {}
      return '';
    },
    // Leave the full screen the Stage view took (the page's, or the video's own player).
    leaveStage: function (video) {
      try {
        var d = document;
        if (d.fullscreenElement || d.webkitFullscreenElement) {
          var p = d.exitFullscreen ? d.exitFullscreen() : (d.webkitExitFullscreen ? d.webkitExitFullscreen() : null);
          if (p && p.catch) p.catch(function () {});
          return;
        }
        var v = typeof video === 'function' ? video() : video;
        if (v && v.webkitDisplayingFullscreen && typeof v.webkitExitFullscreen === 'function') v.webkitExitFullscreen();
      } catch (e) {}
    },
  };

  // ---- CLEAR WITHOUT A PASSWORD: the viewer's own choice (Nathan 2026-11-24/25) ----
  // The core decides everything (clearNoPwState: mode '' | 'stage' | 'all', tapped; the blur levels follow it). This only
  // draws the viewer's buttons: "Tap to unblur" until this viewer taps (for this room, this session), then "Blur".
  // Report is NOT on the main control row (Nathan 2026-11-26: a crowd would press it): it lives in the embed's info
  // panel and the meeting's More menu (clearReportButton), behind a confirm sheet that points to the police / NCMEC and
  // sends GifOS only the host's credential id. One report per device per room, kept here (local).
  function say(C, k, en) { try { return C.uiText(k, en); } catch (e) { return en; } }
  function reportKey() { return 'gifos.clearrep:' + location.pathname + location.hash; }
  function reportedHere() { try { return localStorage.getItem(reportKey()) === '1'; } catch (e) { return !!reportedHere.mem; } }
  function markReported() { reportedHere.mem = true; try { localStorage.setItem(reportKey(), '1'); } catch (e) {} }
  // The page this report comes from: the embedding site for an embed (document.referrer), else the page we were reached from;
  // never this page's own address (it names the room) and no query or hash.
  function pageRef() {
    try { var u = new URL(document.referrer || ''); if (/^https?:$/.test(u.protocol)) return u.origin + u.pathname; } catch (e) {}
    return '';
  }
  function clearReport(C, send) {   // send: the core's reportClearHost (default C.reportClearHost)
    var m = document.getElementById('clearnopw-report');
    if (m) m.remove();
    m = document.createElement('div');
    m.id = 'clearnopw-report'; m.className = 'name-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'clearnopw-title');
    var box = document.createElement('div'); box.className = 'name-box dlg'; box.style.cssText = 'text-align:left;width:min(92vw,28rem);max-width:min(92vw,28rem)';
    var head = document.createElement('div'); head.className = 'dlg-head';
    var h = document.createElement('h3'); h.id = 'clearnopw-title'; h.textContent = say(C, 'clearRepTitle', 'Report illegal content'); head.appendChild(h);
    var body = document.createElement('div'); body.className = 'dlg-body';
    // 1. the message about going to the authorities first; 2. the choice; 3. Report / Cancel (Nathan 2026-11-26)
    var p1 = document.createElement('p');
    p1.textContent = say(C, 'clearRepPolice', 'If you saw something illegal, contact the police or NCMEC.');
    var a = document.createElement('a'); a.href = 'https://report.cybertip.org'; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'report.cybertip.org';
    var p2 = document.createElement('p'); p2.id = 'clearnopw-rep-note';
    p2.textContent = say(C, 'clearRepTell', 'GifOS can only see which license this room used, so we can stop it.');
    var fs = document.createElement('fieldset'); fs.className = 'clearnopw-cats'; fs.style.cssText = 'border:0;margin:8px 0 0;padding:0';
    var lg = document.createElement('legend'); lg.textContent = say(C, 'clearRepCat', 'What are you reporting?'); lg.style.cssText = 'padding:0;margin:0 0 4px;font-weight:600';
    fs.appendChild(lg);
    var cats = [['illegal', 'clearRepIllegal', 'Illegal'], ['offensive', 'clearRepOffensive', 'Offensive'], ['other', 'clearRepOther', 'Other']];
    cats.forEach(function (c, i) {
      var l = document.createElement('label'); l.style.cssText = 'display:flex;align-items:center;gap:8px;min-height:32px;cursor:pointer';
      var r = document.createElement('input'); r.type = 'radio'; r.name = 'clearnopw-cat'; r.value = c[0]; r.checked = i === 0; r.style.cssText = 'width:auto;margin:0';
      l.append(r, document.createTextNode(say(C, c[1], c[2]))); fs.appendChild(l);
    });
    var p3 = document.createElement('p'); p3.id = 'clearnopw-share'; p3.style.marginTop = '10px';
    p3.textContent = say(C, 'clearRepShare', 'Sending a report shares your IP address and this page\'s address with GifOS, along with the room\'s license, so we can review it.');
    body.append(p1, a, p2, fs, p3);
    var acts = document.createElement('div'); acts.className = 'dlg-actions';
    var tell = document.createElement('button'); tell.type = 'button'; tell.id = 'clearnopw-tell'; tell.textContent = say(C, 'clearReport', 'Report');
    var close = document.createElement('button'); close.type = 'button'; close.id = 'clearnopw-close'; close.textContent = say(C, 'clearRepCancel', 'Cancel');
    if (reportedHere()) { p2.textContent = say(C, 'clearRepSent', 'Sent. Thank you.'); tell.disabled = true; fs.hidden = true; p3.hidden = true; }
    tell.onclick = function () {
      if (reportedHere()) return;
      tell.disabled = true;
      var pick = m.querySelector('input[name="clearnopw-cat"]:checked'), cat = pick ? pick.value : 'illegal', ref = pageRef();
      Promise.resolve().then(function () { return send ? send(cat, ref) : C.reportClearHost(cat, ref); }).catch(function () { return 'failed'; }).then(function (r) {
        if (r === 'sent') markReported();
        p2.textContent = r === 'sent' ? say(C, 'clearRepSent', 'Sent. Thank you.') : say(C, 'clearRepFailed', 'Could not send. Please try again later.');
        tell.disabled = r === 'sent';
        if (r === 'sent') close.textContent = say(C, 'close', 'Close');
      });
    };
    close.onclick = function () { m.remove(); };
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    acts.append(tell, close); box.append(head, body, acts); m.appendChild(box); document.body.appendChild(m);
    m.style.display = 'flex';
    return m;
  }
  // clearReportButton(C, parent, id, cls): a Report entry (embed info panel, the meeting's More menu): made once in
  // `parent`, shown only while the core says a clear right is in this room (call on every repaint).
  function clearReportButton(C, parent, id, cls, send) {
    if (!parent) return null;
    var st = { mode: '' };
    try { st = C.clearNoPwState() || st; } catch (e) {}
    var b = document.getElementById(id);
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.id = id; if (cls) b.className = cls; b.hidden = true;
      b.onclick = function () { clearReport(C, send); };
      parent.appendChild(b);
    }
    var w = say(C, 'clearReport', 'Report');
    if (b.textContent !== w) b.textContent = w;
    var on = !!st.mode;
    if (b.hidden !== !on) b.hidden = !on;
    if (!on) { var m = document.getElementById('clearnopw-report'); if (m) m.remove(); }
    return b;
  }
  // clearButtons(C, bar, cls, before): keep the two buttons in `bar` in step with the core's answer (call on every repaint);
  // made in front of `before` when given (the embed keeps its text buttons left of its icon row), else at the end.
  function clearButtons(C, bar, cls, before) {
    if (!bar) return;
    var st = { mode: '', tapped: false };
    try { st = C.clearNoPwState() || st; } catch (e) {}
    var ids = ['clear-tap', 'clear-reblur'], els = {};
    ids.forEach(function (id) {
      var b = document.getElementById(id);
      if (!b) {
        b = document.createElement('button'); b.type = 'button'; b.id = id; if (cls) b.className = cls; b.hidden = true;
        b.onclick = id === 'clear-tap' ? function () { try { C.tapUnblur(); } catch (e) {} } : function () { try { C.blurAgain(); } catch (e) {} };
        if (before && before.parentNode === bar) bar.insertBefore(b, before); else bar.appendChild(b);
      }
      els[id] = b;
    });
    var on = !!st.mode;
    var words = { 'clear-tap': say(C, 'clearUnblur', 'Unblur'), 'clear-reblur': say(C, 'clearBlurAgain', 'Blur') };
    var show = { 'clear-tap': on && !st.tapped && st.offer !== false, 'clear-reblur': on && !!st.tapped };
    ids.forEach(function (id) { var b = els[id]; if (b.textContent !== words[id]) b.textContent = words[id]; if (b.hidden !== !show[id]) b.hidden = !show[id]; });
  }

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

  // ---- the Stage's names: every viewer draws them over its own Stage picture ----
  // The Stage strip carries faces only (no names baked into the pixels), so a name stays sharp over a blurred
  // picture, a viewer can hide the names (body.names-off) and a calm surface fades them (body.view-calm), all on
  // this screen alone. The strip packs the stagers left to right in Stage order in equal cells; one stager fills
  // the frame. A shared screen on the Stage carries its own label (the strip's .rlabel), so no names go on it.
  function stageNames(C, M) {
    var el = document.querySelector('#stagefeed [data-row="sgs"]');
    if (!el) return;
    var v = el.querySelector('video');
    var box = el.querySelector(':scope > .stgnames');
    if (!box) {
      box = document.createElement('div'); box.className = 'stgnames'; box.setAttribute('aria-hidden', 'true');
      el.appendChild(box);
      var again = function () { try { stageNames(C, M); } catch (e) {} };
      if (v) { v.addEventListener('resize', again); v.addEventListener('loadedmetadata', again); }
      if (root.ResizeObserver) new root.ResizeObserver(function () { requestAnimationFrame(again); }).observe(el);
    }
    var view = M ? M.stageViewNow : null, ids = [];
    try {
      if (view === 'self') ids = [C.myId];
      else if (view !== 'screen') ids = C.stageIds().slice();
    } catch (e) { ids = []; }
    var vw = v ? v.videoWidth : 0, vh = v ? v.videoHeight : 0, W = el.clientWidth, H = el.clientHeight;
    var want = (vw > 0 && vh > 0 && W > 0 && H > 0) ? ids : [];
    while (box.children.length > want.length) box.removeChild(box.lastChild);
    if (!want.length) { cellCards(C, el, [], 'stage'); return; }
    // the picture inside its box (object-fit: contain, centred)
    var k = Math.min(W / vw, H / vh), pw = vw * k, ph = vh * k, ox = (W - pw) / 2, oy = (H - ph) / 2;
    var n = want.length, cw = pw / n;
    var cards = [];
    for (var ci = 0; ci < n; ci++) cards.push({ pid: want[ci], x: ox + ci * cw, y: oy, w: cw, h: ph });
    cellCards(C, el, cards, 'stage');
    // one stager: a caption sized from the picture's long side; several: a bar across each cell's foot
    var lw = n === 1 ? Math.min(pw, Math.max(pw, ph) * 0.25) : cw;
    var fs = Math.max(11, Math.round(lw * 0.11));
    for (var i = 0; i < n; i++) {
      var t = box.children[i];
      if (!t) { t = document.createElement('span'); t.className = 'stgname'; box.appendChild(t); }
      var nm = nameOf(C, want[i]);
      try { if (!nm && C.displayName) nm = String(C.displayName(want[i]) || ''); } catch (e) {}
      if (t.textContent !== nm) t.textContent = nm;
      t.hidden = !nm;
      t.style.left = Math.round(ox + i * cw) + 'px';
      t.style.bottom = Math.round(H - (oy + ph)) + 'px';
      t.style.width = Math.round(lw) + 'px';
      t.style.fontSize = fs + 'px';
    }
  }

  // ---- cards: a camera-off person's cell in a received picture, drawn by this viewer ----
  // A seat with its camera off sends no video, and a packer paints its cell plain (no letter, no avatar): a picture can
  // be blurred downstream and an initial must never be. Each viewer draws the card over the cell itself: the person's
  // avatar still (as it arrived, at the sender's blur) under this viewer's blur for that person, or the initial, crisp.
  // cells: [{ pid, x, y, w, h }] in host pixels. where: 'stage' for the Stage picture (its own blur rule).
  function cellCards(C, host, cells, where) {
    if (!host || !host.ownerDocument) return;
    var doc = host.ownerDocument;
    var box = host.querySelector(':scope > .cellcards');
    var want = [];
    for (var i = 0; i < (cells || []).length; i++) {
      var c = cells[i]; if (!c || !c.pid || !(c.w > 2) || !(c.h > 2)) continue;
      var card = false; try { card = typeof C.cardFor === 'function' && !!C.cardFor(c.pid); } catch (e) { card = false; }
      if (card) want.push(c);
    }
    if (!want.length) { if (box) box.remove(); return; }
    if (!box) {
      box = doc.createElement('div'); box.className = 'cellcards'; box.setAttribute('aria-hidden', 'true');
      var nm = host.querySelector(':scope > .stgnames, :scope > .name');
      if (nm) host.insertBefore(box, nm); else host.appendChild(box);
    }
    while (box.children.length > want.length) box.removeChild(box.lastChild);
    var me = ''; try { me = String(C.myId || ''); } catch (e) {}
    for (var j = 0; j < want.length; j++) {
      var w = want[j], el = box.children[j];
      if (!el) { el = doc.createElement('div'); el.className = 'cellcard'; el.appendChild(doc.createElement('span')); box.appendChild(el); }
      var isMe = me && String(w.pid) === me;
      var url = '', hash = '';
      try {
        if (isMe) { var a = GifOS.store && GifOS.store.identity().avatar; if (a) { url = a.url || ''; hash = a.hash || ''; } }
        else { var q = C.model.roster.peers().get(w.pid); if (q && q.avatarUrl) { url = q.avatarUrl; hash = q.avatarHash || ''; } }
      } catch (e) {}
      var name = nameOf(C, w.pid); try { if (!name && C.displayName) name = String(C.displayName(w.pid) || ''); } catch (e) {}
      var ini = ''; try { ini = C.nameInitial ? String(C.nameInitial(name)) : String(name || '').slice(0, 1).toUpperCase(); } catch (e) {}
      var lvl = 0;
      try { lvl = isMe ? (C.blurLevelFor('me') | 0) : (where === 'stage' ? (C.blurLevelFor(w.pid, false, false, 'stage') | 0) : (C.blurLevelFor(w.pid, true) | 0)); } catch (e) { lvl = 2; }
      el.dataset.pid = String(w.pid);
      el.style.left = Math.round(w.x) + 'px'; el.style.top = Math.round(w.y) + 'px';
      // A packed Stadium cell carries its name in its foot band (burned by the packer, over the plain fill): the card
      // leaves that band showing. The Stage's names are drawn above the card by this viewer.
      var ch = where === 'stage' ? w.h : w.h * 0.8;
      el.style.width = Math.round(w.w) + 'px'; el.style.height = Math.round(ch) + 'px';
      el.style.setProperty('--bw', Math.round(Math.max(w.w, w.h)) + 'px');
      var sp = el.firstChild;
      if (sp.textContent !== ini) sp.textContent = ini;
      sp.style.fontSize = Math.max(10, Math.round(Math.min(w.w, ch) * 0.45)) + 'px';
      var img = el.querySelector('img');
      if (url) {
        if (!img) { img = doc.createElement('img'); img.alt = ''; el.appendChild(img); }
        if (img.getAttribute('data-hash') !== hash) { img.src = url; img.setAttribute('data-hash', hash); }
        img.className = isMe ? '' : (lvl >= 2 ? 'blur2' : lvl === 1 ? 'blur1' : '');
      } else if (img) img.remove();
      el.classList.toggle('has-img', !!url);
    }
  }

  // ---- calm: the one idle rule of the watching surfaces ----
  // After the surface's idle clock (no pointer, touch or key), a watching surface (the embed, a /cast viewer, the
  // Stage view, full screen) takes every control and label off the picture: the bar, the top buttons, Blur, the
  // Prerecorded pill and the Stage names. Only the version label stays. Each surface decides when it is calm (its
  // panels, menus and prompts hold it up); this is the one switch they all throw.
  function calm(on) {
    var b = document.body; if (!b) return;
    if (b.classList.contains('view-calm') !== !!on) b.classList.toggle('view-calm', !!on);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  GifOS.viewKit = { version: 1, RECORDS: RECORDS, host: host, part: part, stageLevel: stageLevel, watchCount: watchCount, nameOf: nameOf, present: present, pip: pip, fullscreen: fullscreen, armAppGif: armAppGif, clearButtons: clearButtons, clearReport: clearReport, clearReportButton: clearReportButton, stageNames: stageNames, cellCards: cellCards, calm: calm, esc: esc };
})(typeof window !== 'undefined' ? window : globalThis);
