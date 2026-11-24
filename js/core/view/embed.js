/*
 * GifOS Core: part "view" for embed.html (gifos.app/embed). Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * The broadcast viewer as a video player in someone else's page. The meeting is the same signed core and browser
 * media plane as the meeting page; this file is the only view: a player, not the meeting's screen.
 *
 * HOW A SECOND PAGE HOSTS THE CORE (the contract this file keeps):
 *   - every name the core and the media plane ask of the view exists. The ones a player has no use for are the
 *     linker's counted stand-ins (GifOS.core.standIn, as the Node host's headless view), and the view's VARIABLES the
 *     media plane reads (its elements) are real: the stage feed this page shows, detached stand-ins for controls a
 *     player does not have;
 *   - a view function whose result the core takes apart returns a record (makeTile, as js/core/node.js VIEW_RECORDS);
 *   - the player draws what the core already decides: the stage picture the media plane hands paintStageStrip, the
 *     blur level blurLevelFor gives each face on the stage, the not-live line paintBcQuiet carries, the door's
 *     password prompt showPwModal raises, and the count the room keeps. Nothing here decides a rule.
 */
(function (root) {
  'use strict';
  var GifOS = root.GifOS = root.GifOS || {};
  var P = GifOS.coreParts || {};
  if (!P.core || !GifOS.core) return;
  var RECORDS = { makeTile: ['tile', 'video', 'label', 'avatar', 'chips', 'cap', 'modbar', 'voteBtn'] };

  function part(L) {
    var C = L.core, M = L.media;
    var needs = {};
    [P.core, P.media].forEach(function (p) { if (p && p.needs && p.needs.view) Object.assign(needs, p.needs.view); });
    var counts = new Map();
    var names = GifOS.core.standIn('view', needs, counts, true);
    var $ = function (id) { return document.getElementById(id); };
    var own = {};
    function fn(name, f) { own[name] = f; }
    function vr(name, v) { Object.defineProperty(names, name, { value: v, writable: true, enumerable: true, configurable: true }); }

    // ---- the elements the media plane reads ----------------------------------------------------------------
    var stagefeedEl = $('stagefeed');
    vr('stagefeedEl', stagefeedEl);
    vr('stadiumEl', document.createElement('div'));          // the audience mosaic: a player does not show it
    var cv = function () { return document.createElement('canvas'); };
    var ca = cv(), cb = cv();
    vr('blurA', ca); vr('blurActx', ca.getContext('2d'));
    vr('blurB', cb); vr('blurBctx', cb.getContext('2d'));
    ['timingRow', 'ccDockBtn', 'chatPanel', 'recBtn', 'micBtn', 'unmuteBtn', 'camBtn', 'handBtn', 'keysModal'].forEach(function (n) {
      if (Object.prototype.hasOwnProperty.call(needs, n) && !needs[n]) vr(n, document.createElement(n === 'chatPanel' || n === 'keysModal' || n === 'timingRow' ? 'div' : 'button'));
    });
    vr('paintFaders', function () {});
    Object.keys(needs).forEach(function (n) {   // any other element a later core asks for: a detached stand-in, never a throw at load
      if (!needs[n] && !Object.prototype.hasOwnProperty.call(own, n)) {
        var d = Object.getOwnPropertyDescriptor(names, n);
        if (d && d.get) { try { d.get(); } catch (e) { vr(n, document.createElement('div')); } }
      }
    });
    Object.keys(RECORDS).forEach(function (n) {
      fn(n, function () { var r = {}; RECORDS[n].forEach(function (k) { r[k] = GifOS.core.placeholder('view.' + n + '().' + k); }); return r; });
    });

    // ---- the player ------------------------------------------------------------------------------------------
    // The entry the core parsed (its EMBED whitelist): read when first asked, after the core's first steps ran.
    var why = 'name', room = '', av = '', ready = false;
    function entry() {
      if (ready) return;
      ready = true;
      var params = C.params;
      why = params.get('embed') || 'name';
      room = params.get('v') || params.get('room') || '';
      av = params.get('av') || '';
      $('emb-title').textContent = params.get('title') || room || 'GifOS Broadcast';
      if (why === 'ok') { var w = $('emb-watch'); w.href = location.origin + '/cast/' + room + '/' + av; w.hidden = false; $('emb-mute').hidden = false; }
    }
    var quiet = { text: '' };
    var tried = false;

    function stageVideo() { return stagefeedEl.querySelector('.rowtile video'); }
    function stageLevel() {   // the strictest blur the room's rule gives anyone on the stage
      var lv = 0;
      try { C.stageIds().forEach(function (id) { lv = Math.max(lv, C.blurLevelFor(id) || 0); }); } catch (e) { lv = 2; }
      return lv;
    }
    function watchCount() {
      var up = new Set();
      try { C.stageIds().forEach(function (id) { up.add(id); }); } catch (e) {}
      try { C.adminsNow().forEach(function (id) { up.add(id); }); } catch (e) {}
      return Math.max(0, C.roomHeadCount() - up.size);
    }
    function hear(on) {
      C.serviceHeard = !!on;
      try { M.applyBuses(); } catch (e) {}
      paint();
    }
    function paint() {
      entry();
      var v = stageVideo();
      var picture = !!(v && v.srcObject);
      if (v) { try { C.fsBlurClass(v, stageLevel()); } catch (e) {} }
      var pre = false;
      try { pre = picture && !!C.bcPreInRoom(); } catch (e) {}
      var st = why !== 'ok' ? 'off' : pre ? 'pre' : (picture && !quiet.text) ? 'watching' : 'off';
      var live = $('emb-live');
      if (live.dataset.state !== st) live.dataset.state = st;
      var word = { watching: 'LIVE', pre: 'PRERECORDED' }[st] || 'OFFLINE';
      if ($('emb-live-txt').textContent !== word) $('emb-live-txt').textContent = word;
      var cw = st === 'off' ? '' : watchCount() + ' watching';
      if ($('emb-count').textContent !== cw) $('emb-count').textContent = cw;
      var heard = !!C.serviceHeard;
      $('emb-play').hidden = heard || st === 'off';
      var mw = heard ? 'Mute' : 'Unmute';
      if ($('emb-mute').textContent !== mw) { $('emb-mute').textContent = mw; $('emb-mute').setAttribute('aria-pressed', heard ? 'false' : 'true'); }
      var card = $('emb-card');
      var mt = why === 'open' ? 'This broadcast can’t be embedded: only hosted broadcasts can be embedded.'
        : why !== 'ok' ? 'This embed does not name a GifOS broadcast.'
        : quiet.text ? quiet.text
        : (!picture && C.pwBlocked) ? 'This broadcast has a room password.'
        : !picture ? 'Not live right now.' : '';
      var msg = $('emb-msg');
      if (msg.textContent !== mt) msg.textContent = mt;
      msg.hidden = !mt || !card.hidden;
      $('emb-lock').hidden = !(C.pwBlocked && card.hidden);
    }

    // What the core asks of the view that a player answers.
    fn('paintStageStrip', function (stream) {   // the media plane's stage picture
      var el = stagefeedEl.querySelector('[data-row="sgs"]');
      if (!stream) {
        if (el) { Array.prototype.forEach.call(el.querySelectorAll('video'), function (x) { try { x.pause(); x.srcObject = null; } catch (e) {} try { M.releaseAudio(x); } catch (e) {} }); el.remove(); }
        try { M.compOf.delete('sgs'); } catch (e) {}
        paint();
        return;
      }
      if (!el) {
        el = document.createElement('div'); el.className = 'rowtile'; el.dataset.row = 'sgs';
        var nv = document.createElement('video'); nv.muted = true; nv.autoplay = true; nv.setAttribute('playsinline', '');
        el.appendChild(nv); stagefeedEl.appendChild(el);
        try { M.trackAspect(el, nv); } catch (e) {}
      }
      var v = el.querySelector('video');
      var holds = typeof M.wkHolds === 'function' ? M.wkHolds(v, stream) : v.srcObject === stream;
      if (!holds) { if (typeof M.wkBindVideo === 'function') M.wkBindVideo(v, stream); else v.srcObject = stream; }
      try { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
      try { M.compOf.set('sgs', { via: 'mosaic', streamId: stream.id, stream: stream, names: [], cnt: 0, el: v }); } catch (e) {}
      paint();
    });
    fn('paintBcQuiet', function (bq) { quiet = bq || { text: '' }; paint(); });
    fn('stageFeedShows', function () { return !!stagefeedEl.querySelector('.rowtile'); });   // the core's not-started line asks whether a picture shows
    fn('showPwModal', function () {   // the door wants the room password: the card, inside this frame only
      $('emb-card-hint').textContent = tried ? 'That password did not work. Try again.' : 'Enter the password to watch clearly.';
      $('emb-pw').value = '';
      $('emb-card').hidden = false;
      paint();
    });
    fn('hideJoinPwModal', function () { $('emb-card').hidden = true; paint(); });
    fn('replaceAddress', function () {});     // an embed keeps its address (a framed /cast is refused)
    ['paintLiveBadge', 'paintRoomTrust', 'paintControls', 'paintStagePlate', 'paintStatusLine', 'paintBroadcastRole'].forEach(function (n) {
      if (Object.prototype.hasOwnProperty.call(needs, n)) fn(n, paint);
    });
    Object.keys(own).forEach(function (n) { Object.defineProperty(names, n, { value: own[n], writable: true, enumerable: true, configurable: true }); });

    names.standInsForTest = function () { return Array.from(counts); };
    // The player paints once the linker's run returns, even when the meeting's start stops early (an embed that names
    // no hosted broadcast joins nothing, and says why).
    queueMicrotask(function () { try { paint(); } catch (e) {} });
    return { names: names, setup: setup };
    // Input: unmute, mute, the password, full screen. No other control exists. Runs after the core's top level.
    function setup() {
    $('emb-play').onclick = function () { hear(true); };
    $('emb-mute').onclick = function () { hear(!C.serviceHeard); };
    $('emb-lock').onclick = function () { names.showPwModal(true); };
    $('emb-pw-later').onclick = function () { $('emb-card').hidden = true; paint(); };
    $('emb-card').onsubmit = function (e) {
      e.preventDefault();
      var pw = $('emb-pw').value.trim();
      if (!pw) return;
      tried = true;
      $('emb-pw').value = '';
      $('emb-card').hidden = true;
      C.joinWithPw(pw);
      paint();
    };
    var full = $('emb-full');
    try {
      if (GifOS.fullscreen && GifOS.fullscreen.supported()) { full.hidden = false; GifOS.fullscreen.attach(full, document.documentElement, {}); }
      else if (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) {
        full.hidden = false;
        full.textContent = '⛶';
        full.onclick = function () {
          var d = document, de = d.documentElement;
          if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
          else (de.requestFullscreen || de.webkitRequestFullscreen).call(de);
        };
      } else {
        var vv = function () { return stageVideo(); };   // iPhone: only a video element goes full screen
        full.hidden = false; full.textContent = '⛶';
        full.onclick = function () { var v = vv(); if (v && v.webkitEnterFullscreen) v.webkitEnterFullscreen(); };
      }
    } catch (e) {}
    paint();
    }
  }

  // THE STEPS. The first step only publishes the player's names (nothing of the core has run yet: its variables are
  // not set). The player wires its input after the core's whole top level (a step past every part's last), when the
  // entry is parsed and the join is under way.
  var AFTER_ALL = 1e9;
  var api = {
    name: 'view', stamp: P.core.stamp, needs: {}, count: 0, exports: {},
    run: function* (L) {
      var made = part(L);
      Object.defineProperties(L.view, Object.getOwnPropertyDescriptors(made.names));
      yield AFTER_ALL;
      made.setup();
      return L.END;
    },
  };
  (GifOS.coreParts = GifOS.coreParts || {}).view = api;
})(typeof window !== 'undefined' ? window : globalThis);
