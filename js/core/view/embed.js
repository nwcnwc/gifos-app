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
    // The gear menu is presentation only. It never changes what the core decides (who is hosted, the password, the sound gate).
    // Keys come from the hash the embedder wrote. The core rebuilds C.params from its own whitelist and drops this one.
    var CONTROL_KEYS = ['volume', 'captions', 'tabs', 'inset', 'fullscreen', 'pip', 'watch'];
    function controlsFromHash(hash) {
      var set = new Set();
      var has = false, raw = '';
      try {
        var q = new URLSearchParams(String(hash || '').slice(1));
        has = q.has('controls');
        raw = has ? String(q.get('controls') || '') : '';
      } catch (e) { has = false; }
      // The password card (#emb-card), the Enter password button (#emb-lock) and the not-hosted / no-broadcast / not-live message (#emb-msg) are never controls: they always show, whatever this list says.
      if (!has) { set.add('volume'); set.add('fullscreen'); return set; }
      var tokens = raw.toLowerCase().split(',').map(function (t) { return t.replace(/[^a-z]/g, ''); }).filter(Boolean);
      if (!tokens.length || tokens.every(function (t) { return t === 'none'; })) return set;
      if (tokens.indexOf('all') >= 0) { CONTROL_KEYS.forEach(function (k) { set.add(k); }); return set; }
      CONTROL_KEYS.forEach(function (k) { if (tokens.indexOf(k) >= 0) set.add(k); });
      return set;
    }
    var controls = controlsFromHash(location.hash);
    root.__gifosEmbedControls = function () {
      var out = [];
      CONTROL_KEYS.forEach(function (k) { if (controls.has(k)) out.push(k); });
      return out;
    };
    var ccOn = false, ccAvail = false, ccText = '', ccUntil = 0, ccTimer = 0;
    try { ccOn = localStorage.getItem('gifos.embed.cc') === '1'; } catch (e) {}
    document.body.classList.toggle('emb-inset-lock', !controls.has('inset'));
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
      if (why === 'ok') {
        var w = $('emb-watch');
        w.href = location.origin + '/cast#room=' + encodeURIComponent(room) + (av ? '&v=' + av : '');
        var showWatch = controls.has('watch');
        w.hidden = !showWatch;
        var wr = $('emb-m-watch'); if (wr) wr.hidden = !showWatch;
        $('emb-mute').hidden = false;
      }
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
    // HOSTED RIGHT NOW: the core's live answer from the room's signed host state (an admin room's host, or an open
    // room's captor, present). Not hosted: the card, no picture, no sound (the media plane gates the sound on the same
    // check); hosted again: the picture comes back by itself, muted until a tap.
    function hostedNow() { try { return why === 'ok' && !!C.embedHosted(); } catch (e) { return false; } }
    var wasHosted = null;
    function paint() {
      entry();
      var hosted = hostedNow();
      if (hosted !== wasHosted) {
        wasHosted = hosted;
        document.body.classList.toggle('emb-unhosted', !hosted);
        if (!hosted && C.serviceHeard) { C.serviceHeard = false; try { M.applyBuses(); } catch (e) {} }
        else { try { M.applyBuses(); } catch (e) {} }
      }
      paintShares();
      var v = stageVideo();
      var picture = hosted && !!(v && v.srcObject);
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
      var mt = why !== 'ok' ? 'This embed does not name a GifOS broadcast.'
        : !hosted ? 'This meeting isn’t hosted right now. The live view starts when a host takes charge.'
        : quiet.text ? quiet.text
        : (!picture && C.pwBlocked) ? 'This broadcast has a room password.'
        : !picture ? 'Not live right now.' : '';
      var msg = $('emb-msg');
      if (msg.textContent !== mt) msg.textContent = mt;
      msg.hidden = !mt || !card.hidden;
      $('emb-lock').hidden = !(C.pwBlocked && card.hidden);
      paintInsetRow();
      syncRows();
    }

    // What the core asks of the view that a player answers.
    // The Stage picture: the media part's own paintStageStrip (shared with the meeting page) draws it into #stagefeed
    // and asks the view to lay out again (layout, paintStagePlate), which repaints the player.
    // ---- SHARES: screen, app and agenda as tabs; the selected one fills the player and the Stage floats in one inset --
    // The core keeps the list and the choice (ctRefresh, GifOS.meetContent); this view only draws them. Viewers receive.
    fn('ctInit', function () {
      if (C.CT) return C.CT;
      if (!GifOS.meetContent || !GifOS.meetAgenda) return null;
      C.CT = { el: $('emb-share'), panes: new Map(), st: GifOS.meetContent.state(), items: [], plan: null,
        ag: null, agW: null, agStart: 0, agLocal: false, agEdit: false, agTick: 0, present: false, presentFs: false,
        facesHidden: false, speaker: null, speakerAt: 0, lastSig: '', phone: false, rect: null };
      return C.CT;
    });
    fn('ctAppInfo', function () {   // an app someone in the room shares (this player runs no apps: it names it)
      var by = null, nm = '';
      try { C.statusOf.forEach(function (st, pid) { if (!by && st && st.app && st.app.s) { by = pid; nm = String(st.app.n || st.app.name || ''); } }); } catch (e) {}
      return by ? { on: true, name: nm, by: by, mine: false } : null;
    });
    var shareSig = '';
    function shareItems() { try { return hostedNow() ? (C.ctRefresh() || []) : []; } catch (e) { return []; } }
    function shareLabel(it) { try { return C.ctLabel(it); } catch (e) { return it.kind; } }
    function paintShares() {
      var items = shareItems(), CT = C.CT;
      var sel = CT && CT.st ? CT.st.sel : null;
      if (items.length && !items.some(function (it) { return it.key === sel; })) { try { GifOS.meetContent.select(CT.st, items[0].key); } catch (e) {} sel = CT.st.sel; }
      var on = items.length > 0;
      document.body.classList.toggle('emb-has-share', on);
      var sig = items.map(function (it) { return it.key + '=' + shareLabel(it); }).join('|') + '#' + sel;
      if (sig !== shareSig) {
        shareSig = sig;
        var tabs = $('emb-tabs'), menu = $('emb-tabmenu');
        tabs.textContent = ''; menu.textContent = '';
        items.forEach(function (it) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'emb-tab'; b.setAttribute('role', 'tab');
          b.dataset.key = it.key; b.textContent = shareLabel(it); b.setAttribute('aria-selected', it.key === sel ? 'true' : 'false');
          b.onclick = function () { pick(it.key); };
          tabs.appendChild(b);
          var o = document.createElement('option'); o.value = it.key; o.textContent = shareLabel(it); o.selected = it.key === sel; menu.appendChild(o);
        });
      }
      $('emb-tabbar').hidden = !on || !controls.has('tabs');
      var cur = items.filter(function (it) { return it.key === sel; })[0] || null;
      paintPane(cur);
    }
    function pick(key) { try { C.ctSelect(key, 'embed'); } catch (e) {} shareSig = ''; paint(); }
    function paintPane(it) {
      var vid = $('emb-share-video'), box = $('emb-share-box');
      if (!it) { if (vid.srcObject) { try { vid.srcObject = null; } catch (e) {} } vid.hidden = true; box.hidden = true; return; }
      if (it.kind === 'screen') {
        var src = null; try { src = M.ctScreenTrack(it.sid); } catch (e) {}
        var tr = src && src.track;
        var have = vid.srcObject && vid.srcObject.getVideoTracks()[0];
        if (tr && have !== tr) { vid.srcObject = new MediaStream([tr]); try { var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} }
        vid.hidden = !tr; box.hidden = !!tr;
        if (!tr) box.textContent = shareLabel(it) + ': the picture is on its way.';
        return;
      }
      vid.hidden = true; box.hidden = false;
      if (it.kind === 'agenda') {
        var ag = C.CT && C.CT.ag, list = (ag && ag.items) || [];
        var html = '<h4>Agenda</h4><ol>' + list.map(function (x) {
          var t = String((x && (x.title || x.text || x.t)) || '').replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; });
          var m = x && (x.min || x.mins || x.m); return '<li>' + t + (m ? ' <span>' + (m | 0) + ' min</span>' : '') + '</li>';
        }).join('') + '</ol>';
        if (box.dataset.sig !== html) { box.innerHTML = html; box.dataset.sig = html; }
        return;
      }
      var name = it.name || 'An app';
      var w = name + ' is open in this meeting. Watch on GifOS to see it.';
      if (box.textContent !== w) { box.textContent = w; box.dataset.sig = ''; }
    }
    // The Stage inset: one squarish floating box with every Stage face (the media part's one Stage picture). Drag it;
    // it settles in the nearest corner and remembers it (this browser only); the minimize button folds it to a chip.
    var INSET_KEY = 'gifos.embed.inset';
    var inset = { corner: 'br', min: false };
    try {
      var sv = JSON.parse(localStorage.getItem(INSET_KEY) || 'null');
      if (sv && /^(t|b)(l|r)$/.test(sv.corner)) {
        inset.corner = sv.corner;                 // saved corner, default br
        if (controls.has('inset')) inset.min = !!sv.min;   // without inset, a saved min=true is ignored
      }
    } catch (e) {}
    function saveInset() { try { localStorage.setItem(INSET_KEY, JSON.stringify(inset)); } catch (e) {} }
    function placeInset() {
      document.body.dataset.inset = inset.corner;
      document.body.classList.toggle('emb-stage-folded', controls.has('inset') && inset.min);
      var mb = $('emb-inset-min');
      if (mb) {
        mb.hidden = !controls.has('inset');
        mb.setAttribute('aria-pressed', inset.min ? 'true' : 'false');
        mb.textContent = inset.min ? 'Stage' : '–';
        mb.title = inset.min ? 'Show the Stage' : 'Minimize the Stage';
      }
      paintInsetRow();
    }
    placeInset();
    root.__gifosEmbedInset = names.embedInsetForTest = function () {   // test read (the page's own state only)
      return insetState();
    };
    function insetState() { return { corner: inset.corner, min: inset.min, share: document.body.classList.contains('emb-has-share') }; };
    function toggleInset() {
      if (!controls.has('inset')) return;
      if (!document.body.classList.contains('emb-has-share')) return;
      inset.min = !inset.min;
      saveInset();
      placeInset();
    }
    function paintInsetRow() {
      var row = $('emb-m-inset');
      if (!row) return;
      var share = document.body.classList.contains('emb-has-share');
      row.disabled = !share;
      row.setAttribute('aria-pressed', share && !inset.min ? 'true' : 'false');
      var st = row.querySelector('.emb-mstate');
      if (st) st.textContent = !share ? '' : (inset.min ? 'Hidden' : 'Shown');
    }
    function visibleVideo() {
      if (document.body.classList.contains('emb-has-share')) return $('emb-share-video');
      return stageVideo();
    }
    function pipOn() {
      try { if (document.pictureInPictureEnabled) return 'std'; } catch (e) {}
      var v = visibleVideo();
      try { if (v && typeof v.webkitSupportsPresentationMode === 'function' && v.webkitSupportsPresentationMode('picture-in-picture')) return 'wk'; } catch (e) {}
      return '';
    }
    function paintPip() {
      var row = $('emb-m-pip');
      if (!row) return;
      row.hidden = !(controls.has('pip') && pipOn());
    }
    function togglePip() {
      var v = visibleVideo();
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
    }
    function toggleFull() {   // the same three paths the old bar button used
      try {
        if (GifOS.fullscreen && GifOS.fullscreen.supported()) { GifOS.fullscreen.toggle(document.documentElement); return; }
        var d = document, de = d.documentElement;
        if (de.requestFullscreen || de.webkitRequestFullscreen) {
          if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
          else (de.requestFullscreen || de.webkitRequestFullscreen).call(de);
          return;
        }
        var v = visibleVideo();   // iPhone: only a video element goes full screen
        if (v && v.webkitEnterFullscreen) v.webkitEnterFullscreen();
      } catch (e) {}
    }
    function paintFull() {
      var b = $('emb-m-fullscreen');
      if (!b) return;
      var on = false;
      try { on = !!(document.fullscreenElement || document.webkitFullscreenElement); } catch (e) {}
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    function capWho(byId, label) {
      if (label) return String(label);
      try {
        if (byId && byId === C.myId && typeof C.myName === 'function') return String(C.myName() || '');
        var p = C.peers && typeof C.peers.get === 'function' ? C.peers.get(byId) : null;
        if (p && p.name) return String(p.name);
      } catch (e) {}
      return '';
    }
    function paintCapBar() {
      var bar = $('emb-cap');
      if (!bar) return;
      if (!controls.has('captions') || !ccOn || !ccText) { bar.hidden = true; return; }
      bar.textContent = ccText;
      bar.hidden = false;
    }
    function armCap() {
      clearTimeout(ccTimer);
      var left = ccUntil - Date.now();
      if (!(left > 0) || !ccText) { ccText = ''; paintCapBar(); return; }
      paintCapBar();
      ccTimer = setTimeout(function () { ccText = ''; paintCapBar(); }, left);
    }
    function paintCcRow() {
      var b = $('emb-m-captions');
      if (!b) return;
      b.hidden = !(controls.has('captions') && ccAvail);
      b.setAttribute('aria-pressed', ccOn ? 'true' : 'false');
      var st = b.querySelector('.emb-mstate');
      if (st) st.textContent = ccOn ? 'On' : 'Off';
    }
    function readVol() {
      try {
        var raw = localStorage.getItem('gifos.embed.vol');
        if (raw == null || raw === '') return null;
        var v = Number(raw);
        if (!isFinite(v)) return null;
        return Math.max(0, Math.min(1, v));
      } catch (e) { return null; }
    }
    function applyVol(v, save) {   // the embed's own knob. Never write localStorage 'gifos_mix' (the meeting page's fader memory).
      v = Math.max(0, Math.min(1, Number(v)));
      if (!isFinite(v)) return;
      try { M.mix.stage = v; } catch (e) {}
      try { M.applyBuses(); } catch (e) {}
      if (save) { try { localStorage.setItem('gifos.embed.vol', String(v)); } catch (e) {} }
    }
    function menuItems() {
      var menu = $('emb-menu'), out = [];
      if (!menu) return out;
      Array.prototype.forEach.call(menu.children, function (row) {
        if (row.hidden) return;
        var el = (row.matches && row.matches('button, a, input')) ? row : row.querySelector('button, a, input');
        if (!el || el.hidden || el.disabled) return;
        out.push(el);
      });
      return out;
    }
    var menuOn = false;
    function setMenu(on) {
      var gear = $('emb-gear');
      menuOn = !!on && !(gear && gear.hidden);
      var menu = $('emb-menu');
      if (menu) menu.hidden = !menuOn;
      if (gear) gear.setAttribute('aria-expanded', menuOn ? 'true' : 'false');
      if (!menuOn) return;
      var items = menuItems();
      if (items[0]) { try { items[0].focus(); } catch (e) {} }
    }
    function syncRows() {
      var vol = $('emb-m-volume'); if (vol) vol.hidden = !controls.has('volume');
      var ins = $('emb-m-inset'); if (ins) ins.hidden = !controls.has('inset');
      var fs = $('emb-m-fullscreen'); if (fs) fs.hidden = !controls.has('fullscreen');
      paintCcRow();
      paintPip();
      // The gear shows only when its menu has a row to show (captions not yet arrived, or PiP unsupported, is no row).
      var on = false, menu = $('emb-menu');
      if (menu) Array.prototype.forEach.call(menu.children, function (row) { if (!row.hidden) on = true; });
      if (controls.has('watch') && why === 'ok') on = true;
      var gear = $('emb-gear'); if (gear) { gear.hidden = !on; if (!on && menuOn) setMenu(false); }
    }
    syncRows();

    fn('showCaption', function (byId, text, label) {   // the core and the media plane call this. The embed keeps its own on/off.
      ccAvail = true;
      syncRows();
      var who = capWho(byId, label);
      ccText = (who ? who + '. ' : '') + String(text == null ? '' : text);
      ccUntil = Date.now() + 6000;
      armCap();
    });
    fn('hideCaptions', function () {
      clearTimeout(ccTimer);
      ccText = '';
      ccUntil = 0;
      var bar = $('emb-cap');
      if (bar) { bar.textContent = ''; bar.hidden = true; }
    });
    fn('paintBcQuiet', function (bq) { quiet = bq || { text: '' }; paint(); });
    fn('showPwModal', function () {   // the door wants the room password: the card, inside this frame only
      $('emb-card-hint').textContent = tried ? 'That password did not work. Try again.' : 'Enter the password to watch clearly.';
      $('emb-pw').value = '';
      $('emb-card').hidden = false;
      paint();
    });
    fn('hideJoinPwModal', function () { $('emb-card').hidden = true; paint(); });
    fn('replaceAddress', function () {});     // an embed keeps its address (a framed /cast is refused)
    ['paintLiveBadge', 'paintRoomTrust', 'paintControls', 'paintStagePlate', 'paintStatusLine', 'paintBroadcastRole', 'capPaint', 'applyAdminUi', 'layout'].forEach(function (n) {
      if (Object.prototype.hasOwnProperty.call(needs, n)) fn(n, paint);
    });
    Object.keys(own).forEach(function (n) { Object.defineProperty(names, n, { value: own[n], writable: true, enumerable: true, configurable: true }); });

    names.standInsForTest = function () { return Array.from(counts); };
    // The player paints once the linker's run returns, even when the meeting's start stops early (an embed that names
    // no hosted broadcast joins nothing, and says why).
    queueMicrotask(function () { try { paint(); } catch (e) {} });
    return { names: names, setup: setup };
    // Input: unmute, mute, the password, and the gear menu. Runs after the core's top level.
    function setup() {
    $('emb-play').onclick = function () { if (hostedNow()) hear(true); };
    setInterval(function () { try { paint(); } catch (e) {} }, GifOS.timings.EMBED_HOSTED_MS);   // re-read the live host state
    $('emb-mute').onclick = function () { if (hostedNow() || C.serviceHeard) hear(!C.serviceHeard); };
    $('emb-lock').onclick = function () { names.showPwModal(true); };
    $('emb-tabmenu').onchange = function () { pick(this.value); };
    $('emb-inset-min').onclick = function (e) { e.stopPropagation(); toggleInset(); };
    $('emb-m-inset').onclick = function () { toggleInset(); };
    (function drag() {   // pointer drag of the inset; on release it snaps to the nearest corner
      var sf = stagefeedEl, start = null;
      sf.addEventListener('pointerdown', function (e) {
        if (!controls.has('inset')) return;   // without inset the picture stays put
        if (e.target && e.target.closest && e.target.closest('#emb-inset-min')) return;   // the minimize button is a tap, not a drag
        if (!document.body.classList.contains('emb-has-share') || inset.min) return;
        var r = sf.getBoundingClientRect(); start = { x: e.clientX, y: e.clientY, l: r.left, t: r.top, moved: false };
        try { sf.setPointerCapture(e.pointerId); } catch (x) {}
      });
      sf.addEventListener('pointermove', function (e) {
        if (!start) return;
        var dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!start.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
        start.moved = true; document.body.classList.add('emb-dragging');
        sf.style.left = (start.l + dx) + 'px'; sf.style.top = (start.t + dy) + 'px'; sf.style.right = 'auto'; sf.style.bottom = 'auto';
      });
      var end = function () {
        if (!start) return;
        if (start.moved) {
          var r = sf.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          inset.corner = (cy < innerHeight / 2 ? 't' : 'b') + (cx < innerWidth / 2 ? 'l' : 'r');
          saveInset();
        }
        start = null; sf.style.left = sf.style.top = sf.style.right = sf.style.bottom = '';
        document.body.classList.remove('emb-dragging'); placeInset();
      };
      sf.addEventListener('pointerup', end); sf.addEventListener('pointercancel', end);
    })();
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
    if (controls.has('volume')) {
      var slider = $('emb-m-volume').querySelector('input');
      var saved = readVol();
      var start = saved;
      if (start == null) { try { start = Number(M.mix.stage); } catch (e) { start = 1; } }
      if (!isFinite(start)) start = 1;
      slider.value = String(Math.max(0, Math.min(1, start)));
      if (saved != null) applyVol(saved, false);
      slider.oninput = function () { applyVol(this.value, true); };
    }
    $('emb-m-captions').onclick = function () {
      if (!controls.has('captions')) return;
      ccOn = !ccOn;
      try { localStorage.setItem('gifos.embed.cc', ccOn ? '1' : '0'); } catch (e) {}
      paintCcRow();
      if (ccOn) armCap(); else paintCapBar();
    };
    $('emb-m-fullscreen').onclick = function () { toggleFull(); };
    $('emb-m-pip').onclick = function () { togglePip(); };
    $('emb-gear').onclick = function () { setMenu(!menuOn); };
    document.addEventListener('pointerdown', function (e) {
      if (!menuOn) return;
      var t = e.target;
      if (t && t.closest && (t.closest('#emb-menu') || t.closest('#emb-gear'))) return;
      setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (!menuOn) return;
      if (e.key === 'Escape') { setMenu(false); var g = $('emb-gear'); if (g && !g.hidden) g.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var menu = $('emb-menu'), ae = document.activeElement;
      if (!menu || (ae !== $('emb-gear') && !menu.contains(ae))) return;
      var items = menuItems();
      if (!items.length) return;
      var i = items.indexOf(ae);
      var n = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
      items[n].focus();
      e.preventDefault();
    });
    document.addEventListener('fullscreenchange', paintFull);
    document.addEventListener('webkitfullscreenchange', paintFull);
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
