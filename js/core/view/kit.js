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
 *   readings                watchCount, nameOf, present: what the core already decided, read for drawing.
 *   acts                    pip, fullscreen: the browser's own controls over a video element (fullscreen.enterStage /
 *                           leaveStage: the Stage view's full screen on every surface).
 *   stageNames, calm        the Stage's names over the picture, and the watching surfaces' one idle fade.
 *   cellCards               a camera-off person's card (avatar or initial) over their cell of a received picture.
 *   cellNames, cellNamesOnCanvas  the name of each named cell of a received picture (the Stadium), drawn by the viewer.
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
  // draws the viewer's buttons: "Tap to unblur" until this viewer taps (for this room, this session), then "Blur" -- only while
  // the Stage carries a picture blur applies to (clearNoPwState.pic: a camera, a share, an avatar image; initials alone: none).
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
    var h = document.createElement('h3'); h.id = 'clearnopw-title'; h.textContent = say(C, 'clearRepTitle', 'Report content'); head.appendChild(h);
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
    var cats = [['illegal', 'clearRepIllegal', 'Illegal'], ['sexual', 'clearRepSexual', 'Sexually explicit'], ['offensive', 'clearRepOffensive', 'Offensive'], ['copyright', 'clearRepCopyright', 'Copyright or trademark'], ['other', 'clearRepOther', 'Other']];
    cats.forEach(function (c, i) {
      var l = document.createElement('label'); l.style.cssText = 'display:flex;align-items:center;gap:8px;min-height:32px;cursor:pointer';
      var r = document.createElement('input'); r.type = 'radio'; r.name = 'clearnopw-cat'; r.value = c[0]; r.checked = i === 0; r.style.cssText = 'width:auto;margin:0';
      l.append(r, document.createTextNode(say(C, c[1], c[2]))); fs.appendChild(l);
    });
    var p3 = document.createElement('p'); p3.id = 'clearnopw-share'; p3.style.marginTop = '10px';
    p3.textContent = say(C, 'clearRepShare', 'Sending a report shares your IP address and this page\'s address with GifOS, along with the room\'s license, so we can review it.');
    // COPYRIGHT (2026-11-27): choosing it asks for the elements of a copyright notice (the work, where it appears, contact email,
    // the good-faith and accuracy statements, a typed signature); the page's own address is prefilled. Sent as `notice`.
    var cp = document.createElement('div'); cp.id = 'clearnopw-cp'; cp.hidden = true; cp.style.cssText = 'margin-top:8px';
    var cpi = document.createElement('p'); cpi.textContent = say(C, 'clearRepCpIntro', 'To send a copyright notice, fill in everything below. GifOS may pass it to the person it is about.'); cp.appendChild(cpi);
    function field(id, key, dflt, area, val) {
      var l = document.createElement('label'); l.style.cssText = 'display:block;margin-top:6px'; l.appendChild(document.createTextNode(say(C, key, dflt)));
      var i = document.createElement(area ? 'textarea' : 'input'); i.id = id; i.style.cssText = 'display:block;width:100%;box-sizing:border-box;margin-top:2px';
      if (area) i.rows = 2; else i.type = id === 'clearnopw-cp-email' ? 'email' : 'text';
      i.maxLength = area ? 1000 : id === 'clearnopw-cp-email' ? 254 : id === 'clearnopw-cp-where' ? 500 : 120;
      if (val) i.value = val;
      l.appendChild(i); cp.appendChild(l); return i;
    }
    var cpWork = field('clearnopw-cp-work', 'clearRepCpWork', 'The work you own (what was copied)', true);
    var here = ''; try { here = (location.origin + location.pathname + location.search + location.hash).slice(0, 500); } catch (e) {}
    var cpWhere = field('clearnopw-cp-where', 'clearRepCpWhere', 'Where it appears (link)', false, here);
    var cpEmail = field('clearnopw-cp-email', 'clearRepCpEmail', 'Your email address', false);
    function tick(id, key, dflt) {
      var l = document.createElement('label'); l.style.cssText = 'display:flex;align-items:flex-start;gap:8px;margin-top:6px;cursor:pointer';
      var c = document.createElement('input'); c.type = 'checkbox'; c.id = id; c.style.cssText = 'width:auto;margin:3px 0 0';
      l.append(c, document.createTextNode(say(C, key, dflt))); cp.appendChild(l); return c;
    }
    var cpGood = tick('clearnopw-cp-good', 'clearRepCpGood', 'I have a good-faith belief that this use is not authorized by the copyright owner, its agent, or the law.');
    var cpTrue = tick('clearnopw-cp-true', 'clearRepCpTrue', 'The information in this notice is accurate, and under penalty of perjury I am the owner or authorized to act for the owner.');
    var cpName = field('clearnopw-cp-name', 'clearRepCpName', 'Your full name, typed as your signature', false);
    var cpNeed = document.createElement('p'); cpNeed.id = 'clearnopw-cp-need'; cpNeed.hidden = true; cpNeed.setAttribute('role', 'alert');
    cpNeed.textContent = say(C, 'clearRepCpNeed', 'Please fill in every field and tick both boxes.'); cp.appendChild(cpNeed);
    function showCp() { var pk = m.querySelector('input[name="clearnopw-cat"]:checked'); cp.hidden = !(pk && pk.value === 'copyright'); cpNeed.hidden = true; }
    fs.addEventListener('change', showCp);
    body.append(p1, a, p2, fs, cp, p3);
    var acts = document.createElement('div'); acts.className = 'dlg-actions';
    var tell = document.createElement('button'); tell.type = 'button'; tell.id = 'clearnopw-tell'; tell.textContent = say(C, 'clearReport', 'Report');
    var close = document.createElement('button'); close.type = 'button'; close.id = 'clearnopw-close'; close.textContent = say(C, 'clearRepCancel', 'Cancel');
    if (reportedHere()) { p2.textContent = say(C, 'clearRepSent', 'Sent. Thank you.'); tell.disabled = true; fs.hidden = true; p3.hidden = true; }
    tell.onclick = function () {
      if (reportedHere()) return;
      var pick = m.querySelector('input[name="clearnopw-cat"]:checked'), cat = pick ? pick.value : 'illegal', ref = pageRef(), notice;
      if (cat === 'copyright') {
        notice = { work: cpWork.value.trim(), where: cpWhere.value.trim(), email: cpEmail.value.trim(), name: cpName.value.trim(), good: cpGood.checked, accurate: cpTrue.checked };
        if (!notice.work || !notice.where || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notice.email) || !notice.name || !notice.good || !notice.accurate) { cpNeed.hidden = false; return; }
      }
      tell.disabled = true;
      Promise.resolve().then(function () { return send ? send(cat, ref, notice) : C.reportClearHost(cat, ref, notice); }).catch(function () { return 'failed'; }).then(function (r) {
        if (r === 'sent' && cat !== 'copyright') markReported();   // a copyright notice is deliberate: it never locks the sheet
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
    // only while a picture is there to (un)blur (st.pic); the viewer's tap stays remembered for the room either way
    var pic = !!st.pic;
    var show = { 'clear-tap': on && pic && !st.tapped && st.offer !== false, 'clear-reblur': on && pic && !!st.tapped };
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
    if (!want.length) { cellCards(C, M, el, [], 'stage'); return; }
    // the picture inside its box (object-fit: contain, centred)
    var k = Math.min(W / vw, H / vh), pw = vw * k, ph = vh * k, ox = (W - pw) / 2, oy = (H - ph) / 2;
    var n = want.length, cw = pw / n;
    var cards = [];
    for (var ci = 0; ci < n; ci++) cards.push({ pid: want[ci], x: ox + ci * cw, y: oy, w: cw, h: ph });
    cellCards(C, M, el, cards, 'stage');
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
  function cellCards(C, M, host, cells, where) {
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
      el.dataset.pid = String(w.pid);
      el.style.left = Math.round(w.x) + 'px'; el.style.top = Math.round(w.y) + 'px';
      // The whole cell: no pack burns a name, so there is no band to leave showing; the names go above the card
      // (stageNames on the Stage, cellNames on the Stadium).
      var ch = w.h;
      el.style.width = Math.round(w.w) + 'px'; el.style.height = Math.round(ch) + 'px';
      el.style.setProperty('--bw', Math.round(Math.max(w.w, w.h)) + 'px');
      var sp = el.firstChild;
      if (sp.textContent !== ini) sp.textContent = ini;
      sp.style.fontSize = Math.max(10, Math.round(Math.min(w.w, ch) * 0.45)) + 'px';
      var img = el.querySelector('img');
      if (url) {
        if (!img) { img = doc.createElement('img'); img.alt = ''; el.appendChild(img); }
        if (img.getAttribute('data-hash') !== hash) { img.src = url; img.setAttribute('data-hash', hash); }
        // the avatar at this viewer's level for that person, the one face rule's (my own avatar: none); no rule: the
        // initial alone, never an avatar unblurred
        var lv = null; try { lv = M.facePaint(img, isMe ? { pic: 'none' } : { id: w.pid, where: where, pic: 'avatar' }, 'pic'); } catch (e) { lv = null; }
        img.hidden = typeof lv !== 'number';
      } else if (img) img.remove();
      el.classList.toggle('has-img', !!url);
    }
  }

  // ---- names: the people in a received picture's cells, drawn by this viewer ----
  // No pack carries a name in its pixels (mesh-media drawOverlay burns marks only): a name burned in blurred with the
  // face it sat on (an open room blurs the whole Stadium) and a Node seat could only draw it in a block font. The pack
  // names its cells (their ids ride with the picture), so each viewer draws every named cell's name itself, crisp over
  // the face, from its own roster, or the fold's name for a person past it. A viewer's Show names off hides them
  // (body.names-off) and a calm surface fades them (body.view-calm), like tile names. A cell too small to read a name
  // in shows none, as the packer's tapestry did. cells: [{ pid, x, y, w, h }] in host pixels, the cellCards geometry.
  var CELL_NAME_MIN_PX = 48;
  function cellName(C, pid) {
    var nm = '';
    try { nm = String((C.displayName ? C.displayName(pid) : nameOf(C, pid)) || ''); } catch (e) { nm = ''; }
    if (nm && nm !== '\u2026') return nm;
    try {
      var mn = C.model && C.model.net && C.model.net.meshNode ? C.model.net.meshNode() : null;
      var far = mn && typeof mn.meetingPeople === 'function' ? (mn.meetingPeople() || []) : [];
      for (var i = 0; i < far.length; i++) for (var j = 0; j < ((far[i] && far[i].people) || []).length; j++) {
        var x = far[i].people[j];
        if (x && x.id === pid && x.nm) return String(x.nm);
      }
    } catch (e) {}
    return '';
  }
  // The font a cell's name is drawn at: the packer's proportion (0.11 of the cell), held to what a tile name reads at.
  function cellNameFont(w) { return Math.max(10, Math.min(16, Math.round(w * 0.11))); }
  function cellNames(C, host, cells) {
    if (!host || !host.ownerDocument) return;
    var doc = host.ownerDocument;
    var box = host.querySelector(':scope > .cellnames');
    var want = [];
    for (var i = 0; i < (cells || []).length; i++) {
      var c = cells[i]; if (!c || !c.pid || !(c.w >= CELL_NAME_MIN_PX) || !(c.h > 2)) continue;
      var nm = cellName(C, c.pid);
      if (nm) want.push({ c: c, nm: nm });
    }
    if (!want.length) { if (box) box.remove(); return; }
    if (!box) { box = doc.createElement('div'); box.className = 'cellnames'; box.setAttribute('aria-hidden', 'true'); }
    if (box.parentNode !== host || host.lastElementChild !== box) host.appendChild(box);   // above the picture and its cards
    while (box.children.length > want.length) box.removeChild(box.lastChild);
    for (var k = 0; k < want.length; k++) {
      var w = want[k].c, el = box.children[k];
      if (!el) { el = doc.createElement('span'); el.className = 'cellname'; box.appendChild(el); }
      if (el.textContent !== want[k].nm) el.textContent = want[k].nm;
      el.dataset.pid = String(w.pid);
      var l = Math.round(w.x) + 'px', t = Math.round(w.y + w.h) + 'px', wd = Math.round(w.w) + 'px', fs = cellNameFont(w.w) + 'px';
      if (el.style.left !== l) el.style.left = l;
      if (el.style.top !== t) el.style.top = t;
      if (el.style.width !== wd) el.style.width = wd;
      if (el.style.fontSize !== fs) el.style.fontSize = fs;
    }
  }
  // The names over a <video> that plays a pack's own frame (the full screen Stadium): the pack's cells (cellIds, cols,
  // its canvas size) through the video's contain fit and its transform as drawn (a Follow zoom, a blur class's scale),
  // into host, which holds the video at the video's own offset; a cell partly off the host names the part on it.
  // pack null: no names.
  function cellNamesOver(C, host, video, pack) {
    var cells = [];
    try {
      var cv = pack && pack.canvas, ids = pack && pack.cellIds ? pack.cellIds() : null;
      var vw = video.videoWidth || (cv ? cv.width : 0), vh = video.videoHeight || (cv ? cv.height : 0);
      var ew = video.clientWidth, eh = video.clientHeight;
      if (ids && cv && cv.width > 2 && cv.height > 2 && vw && vh && ew && eh) {
        var G = Math.max(1, pack.cols() | 0), cell = cv.width / G, kx = vw / cv.width, ky = vh / cv.height;
        var s0 = Math.min(ew / vw, eh / vh), ox = (ew - vw * s0) / 2, oy = (eh - vh * s0) / 2;   // object-fit: contain
        // A zoom (class fszoom) moves the cells; a blur class's small scale-up only hides the blur's soft rim past the
        // edge, so the names keep to the laid-out picture there.
        var cs = root.getComputedStyle(video), mm = video.classList.contains('fszoom') ? /^matrix\(([^)]*)\)/.exec(cs.transform || '') : null, m = mm ? mm[1].split(',').map(parseFloat) : null;
        var og = String(cs.transformOrigin || '0 0').split(' ').map(parseFloat), gx = og[0] || 0, gy = og[1] || 0;
        var z = m ? m[0] : 1, tx = m ? m[4] + gx - gx * m[0] : 0, ty = m ? m[5] + gy - gy * m[3] : 0;
        var bx = video.offsetLeft || 0, by = video.offsetTop || 0;
        for (var j = 0; j < ids.length; j++) {
          var x = (j % G) * cell, y = Math.floor(j / G) * cell;
          if (!ids[j] || y + cell > cv.height + 0.5) continue;
          var X = bx + tx + (ox + x * kx * s0) * z, Y = by + ty + (oy + y * ky * s0) * z, Wd = cell * kx * s0 * z, Hd = cell * ky * s0 * z;
          var x0 = Math.max(0, X), x1 = Math.min(host.clientWidth || X + Wd, X + Wd), y1 = Math.min(host.clientHeight || Y + Hd, Y + Hd);
          if (x1 - x0 > 2 && y1 - Math.max(0, Y) > 2) cells.push({ pid: String(ids[j]), x: x0, y: Y, w: x1 - x0, h: y1 - Y });
        }
      }
      // a zoom eases in: the names follow where it lands
      if (!video.__cellNamesTe) { video.__cellNamesTe = true; video.addEventListener('transitionend', function () { var a = video.__cellNamesArgs; if (a) cellNamesOver(a[0], a[1], video, a[2]); }); }
      video.__cellNamesArgs = pack ? [C, host, pack] : null;
    } catch (e) {}
    cellNames(C, host, cells);
  }
  // The same names on a canvas (the floating window draws its picture on one): a dark band at each cell's foot and the
  // name, measured and ellipsised to the cell. Drawn after the picture, so the name is never under its blur.
  function cellNamesOnCanvas(C, ctx, cells) {
    for (var i = 0; i < (cells || []).length; i++) {
      var c = cells[i]; if (!c || !c.pid || !(c.w >= CELL_NAME_MIN_PX)) continue;
      var nm = cellName(C, c.pid); if (!nm) continue;
      var fs = cellNameFont(c.w), pad = Math.max(3, Math.round(fs * 0.4)), bh = Math.round(fs * 1.25 + pad);
      ctx.save();
      ctx.filter = 'none';
      ctx.fillStyle = 'rgba(10,10,15,0.62)'; ctx.fillRect(c.x, c.y + c.h - bh, c.w, bh);
      ctx.fillStyle = '#eef'; ctx.font = '600 ' + fs + 'px system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      var s = nm, lim = c.w - pad * 2;
      if (ctx.measureText(s).width > lim) { while (s.length > 1 && ctx.measureText(s + '\u2026').width > lim) s = s.slice(0, -1); s += '\u2026'; }
      ctx.fillText(s, c.x + pad, c.y + c.h - bh / 2);
      ctx.restore();
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

  // ---- TRANSCRIPT DOWNLOAD: the meeting's Download button and the embed's are this one path (Nathan 2026-11-26) ----
  // The plain .txt as the media plane writes it; with this device's screenshots (js/core/view/shareshots.js) it is the
  // .zip instead: transcript.txt (pictures as markers), transcript.md, a self-contained transcript.html and shots/.
  // f is the media plane's transcriptFile() result; who(shot) names a screenshot's screen. Resolves when the file was handed to the browser.
  function trDownload(C, f, who) {
    var blob = f.blob, name = f.name, SS = null, zipped = Promise.resolve();
    try { SS = GifOS.shareShots; } catch (e) {}
    if (SS && SS.list().length) {
      var mine = C.trLang();
      var lines = C.trBlocks().map(function (l) { return { at: l.at, text: '[' + new Date(l.at).toLocaleTimeString() + '] ' + l.by + (l.lang && l.lang !== mine ? ' (' + l.lang + ')' : '') + ': ' + C.trNote(l) + l.text }; });
      zipped = SS.exportZip(lines, name.replace(/\.txt$/, '').replace(/_/g, ' '), who).then(function (z) { blob = z; name = name.replace(/\.txt$/, '.zip'); }, function () {});
    }
    return zipped.then(function () {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, GifOS.timings.TRANSCRIPT_DL_REVOKE_MS);
    });
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  GifOS.viewKit = { version: 1, RECORDS: RECORDS, host: host, part: part, watchCount: watchCount, nameOf: nameOf, present: present, pip: pip, fullscreen: fullscreen, armAppGif: armAppGif, clearButtons: clearButtons, clearReport: clearReport, clearReportButton: clearReportButton, stageNames: stageNames, cellCards: cellCards, cellNames: cellNames, cellNamesOver: cellNamesOver, cellNamesOnCanvas: cellNamesOnCanvas, cellName: cellName, calm: calm, trDownload: trDownload, esc: esc };
})(typeof window !== 'undefined' ? window : globalThis);
