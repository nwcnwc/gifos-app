/*
 * GifOS Core: part "view" for embed.html (gifos.app/embed). Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * The broadcast viewer as a video player in someone else's page. The meeting is the same signed core and browser
 * media plane as the meeting page; this file is the only view: a player, not the meeting's screen.
 *
 * HOW A SECOND PAGE HOSTS THE CORE: the shared view library keeps the contract (js/core/view/kit.js, GifOS.viewKit.host):
 *   - every name the core and the media plane ask of the view exists. The ones a player has no use for are the
 *     linker's counted stand-ins (GifOS.core.standIn, as the Node host's headless view), and the view's VARIABLES the
 *     media plane reads (its elements) are real: the stage feed this page shows, detached stand-ins for controls a
 *     player does not have;
 *   - a view function whose result the core takes apart returns a record (makeTile, as js/core/node.js VIEW_RECORDS);
 *   - the player draws what the core already decides: the stage picture the media plane hands paintStageStrip, the
 *     blur level blurLevelFor gives each face on the stage, the not-live line paintBcQuiet carries, the door's
 *     password prompt showPwModal raises, the count the room keeps, the chat lines and the host's chat and reaction
 *     switches. Nothing here decides a rule.
 *
 * THE BAR (bottom right): chat, reactions, info, float, full screen, then the gear. The gear holds the rows a viewer
 * sets and forgets (volume, mute, captions, audio only, the Stage picture, Watch on GifOS). The page owner picks which
 * of them a viewer gets (CONTROL_KEYS, data-controls); the info button and its GifOS line always show. Every bar
 * control fades after the meeting's own CHROME_IDLE_MS of no pointer, touch or key, and comes back on any of them;
 * an open panel, the unmute prompt and the password button never fade.
 */
(function (root) {
  'use strict';
  var GifOS = root.GifOS = root.GifOS || {};
  var K = GifOS.viewKit;
  if (!K || !GifOS.core || !(GifOS.coreParts || {}).core) return;

  function part(L) {
    var $ = function (id) { return document.getElementById(id); };
    // the elements the media plane reads: the stage feed this page shows; the rest are the kit's detached stand-ins
    var stagefeedEl = $('stagefeed');
    var H = K.host(L, { elements: { stagefeedEl: stagefeedEl } });
    var C = H.C, M = H.M, names = H.names, fn = H.fn;

    // ---- words -------------------------------------------------------------------------------------------------
    // The embed catalog (i18n/<locale>/embed.json). English stays beside each call and in the markup: English never
    // waits for a catalog, and a key a language lacks reads in English.
    var I18 = null;
    function tr(key, en, args) {
      if (I18 && I18.ui() !== 'en' && I18.has('embed.' + key)) { try { return I18.t('embed.' + key, args || {}); } catch (e) {} }
      return args ? String(en).replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(args, k) ? String(args[k]) : m; }) : en;
    }

    // ---- the player ------------------------------------------------------------------------------------------
    // The controls are presentation only. They never change what the core decides (who is hosted, the password, the
    // sound gate, what the room sends this seat). Keys come from the hash the embedder wrote. The core rebuilds its
    // params from its own whitelist and drops this one.
    var CONTROL_KEYS = ['volume', 'mute', 'captions', 'audioonly', 'tabs', 'inset', 'fullscreen', 'pip', 'chat', 'transcript', 'reactions', 'names', 'watch'];
    var CONTROL_DEFAULT = ['volume', 'audioonly', 'fullscreen', 'pip', 'chat', 'transcript', 'reactions', 'names', 'watch'];
    function controlsFromHash(hash) {
      var set = new Set();
      var has = false, raw = '';
      try {
        var q = new URLSearchParams(String(hash || '').slice(1));
        has = q.has('controls');
        raw = has ? String(q.get('controls') || '') : '';
      } catch (e) { has = false; }
      // The password card (#emb-card), the Enter password button (#emb-lock), the not-hosted / no-broadcast / not-live
      // message (#emb-msg) and the info button with its GifOS line are never controls: they always show.
      if (!has) { CONTROL_DEFAULT.forEach(function (k) { set.add(k); }); return set; }
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
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    var ccOn = lsGet('gifos.embed.cc') === '1', ccAvail = false, ccText = '', ccUntil = 0, ccTimer = 0;
    // Audio only: this viewer's screen stops drawing the pictures (CSS hides the video elements). It is never a
    // subscription change: the seat keeps receiving and forwarding video for the room exactly as before.
    // Show names: the names this player draws over the Stage picture (viewKit.stageNames); on by default, this viewer's
    // choice, kept in this browser. Nothing sent changes: the Stage picture never carries the names.
    var showNames = !(controls.has('names') && lsGet('gifos.embed.names') === '0');
    document.body.classList.toggle('names-off', !showNames);
    var audioOnly = controls.has('audioonly') && lsGet('gifos.embed.audioonly') === '1';
    document.body.classList.toggle('emb-inset-lock', !controls.has('inset'));
    // The entry the core parsed (its EMBED whitelist): read when first asked, after the core's first steps ran.
    var why = 'name', room = '', av = '', title = '', ready = false;
    function entry() {
      if (ready) return;
      ready = true;
      var params = C.model.room.params();   // the core's room model (0.9.28 thin page: params is no longer a bare core export)
      why = params.get('embed') || 'name';
      var link = C.model.room.LINK();   // the room this embed names (js/core/link.js)
      room = link.room || '';
      av = link.v || '';
      title = params.get('title') || '';
      paintTitle();
      if (why === 'ok') {
        var w = $('emb-watch');
        w.href = location.origin + '/cast#' + GifOS.link.hash({ room: room, v: av });
        var showWatch = controls.has('watch');
        w.hidden = !showWatch;
        var wr = $('emb-m-watch'); if (wr) wr.hidden = !showWatch;
        $('emb-mute').hidden = false;
      }
    }
    // The title is the one the embedder wrote (data-title, up to 80 characters), else the room's name. The top bar
    // cuts it to fit; the info panel shows it whole. A room has no public description yet, so the panel has none.
    function paintTitle() {
      var t = title || room || tr('defaultTitle', 'GifOS Broadcast');
      $('emb-title').textContent = t;
      $('emb-info-title').textContent = t;
    }
    var quiet = { text: '' };
    var tried = false;

    function stageVideo() { return stagefeedEl.querySelector('.rowtile video'); }
    function stageLevel() { return K.stageLevel(C); }
    function watchCount() { return K.watchCount(C); }
    function hear(on) {
      M.setServiceHeard(!!on);   // the plane holds the person's stage sound and mixes by it
      paint();
    }
    // HOSTED RIGHT NOW: the core's live answer from the room's signed host state (an admin room's host, or an open
    // room's captor, present). Not hosted: the card, no picture, no sound (the media plane gates the sound on the same
    // check); hosted again: the picture comes back by itself, muted until a tap.
    function hostedNow() { try { return why === 'ok' && !!C.embedHosted(); } catch (e) { return false; } }
    // WHAT THE PLAYER MAY SAY. "Not live" and "isn't hosted" are the room's answer, said only once this page KNOWS it:
    // it is in (seated, and no relayed link still being made), and the host's signed state has had its beat to arrive, or
    // the host WAS here and left. Until then it says Connecting. A page that cannot reach GifOS or the room at all (offline,
    // the relay socket never up, the way in stuck) says it could not connect and keeps trying: that is not a claim about the room.
    //   'connecting' | 'offline' (this device's network is gone) | 'noconn' (cannot reach GifOS or the room) | 'room' (the room's answer)
    var T0 = Date.now(), relayDownAt = 0, settledAt = 0, hostedEver = false, hostedAt = 0;
    function verdict(hosted, seated) {
      if (why !== 'ok') return 'room';
      var now = Date.now(), es = { settled: false, relay: true, everUp: true, offline: false };
      try { es = C.embedState(); } catch (e) { es.settled = seated; }
      if (hosted) { hostedEver = true; if (!hostedAt) hostedAt = now; } else hostedAt = 0;
      if (es.relay) relayDownAt = 0; else if (!relayDownAt) relayDownAt = now;
      if (es.settled && !settledAt) settledAt = now;
      var T = GifOS.timings;
      if (es.offline) return 'offline';
      if (!es.relay && now - relayDownAt >= T.EMBED_UNREACHED_MS) return 'noconn';
      if (!es.relay) return 'connecting';
      if (hosted) {   // the host is here: the picture is on its way (a password, or the host's own quiet line, speak for themselves)
        // a password, or the broadcast's own schedule line, speaks for itself; "has not started" is not said while the host's picture is still on its way
        if (C.pwBlocked || (quiet.text && quiet.sched && (quiet.sched.phase === 'future' || quiet.sched.phase === 'soon'))) return 'room';
        return now - hostedAt >= T.EMBED_MEDIA_WAIT_MS ? 'room' : 'connecting';
      }
      if (hostedEver) return 'room';   // we were connected and the host left
      if (es.settled) return now - settledAt >= T.EMBED_SYNC_MS ? 'room' : 'connecting';
      return now - T0 >= T.EMBED_STUCK_MS ? 'noconn' : 'connecting';
    }
    var wasHosted = null;
    function paint() {
      entry();
      var hosted = hostedNow();
      if (hosted !== wasHosted) {
        wasHosted = hosted;
        document.body.classList.toggle('emb-unhosted', !hosted);
        if (!hosted && M.serviceHeard) M.setServiceHeard(false);
        else { try { M.applyBuses(); } catch (e) {} }
      }
      paintShares();
      var v = stageVideo();
      var picture = hosted && !!(v && v.srcObject);
      // Still at the door (no seat yet): the host's signed state has not been heard, which says nothing about the room.
      // A viewer on a TURN-only network waits here longest (hotel Wi-Fi, 0.9.28.30 field): "not hosted" was a false claim then.
      var seated = true;
      try { var ms = C.meshSeat(); seated = !!(ms && ms.hasCoord); } catch (e) {}
      var know = verdict(hosted, seated);
      if (picture) know = 'room';   // a picture is playing: nothing to wait on
      var lv = stageLevel();
      if (v) {
        try { C.fsBlurClass(v, lv); } catch (e) {}
        v.disablePictureInPicture = lv > 0;   // the browser's own float paints raw frames: a blurred picture floats only through the lens
      }
      var pre = false;
      try { pre = picture && !!C.bcPreInRoom(); } catch (e) {}
      // The core's off-air line can trail the picture by a beat (the host's stage seat is signed a little after its first frame):
      // a picture that is playing outranks the plain "has not started" line, a schedule line (starts at / about to start) stands.
      var qtext = quiet.text;
      if (picture && !(quiet.sched && (quiet.sched.phase === 'future' || quiet.sched.phase === 'soon'))) qtext = '';
      var st = why !== 'ok' ? 'off' : pre ? 'pre' : (picture && !qtext) ? 'watching' : 'off';
      var live = $('emb-live');
      if (live.dataset.state !== st) live.dataset.state = st;
      var word = st === 'watching' ? tr('live', 'LIVE') : st === 'pre' ? tr('pre', 'PRERECORDED')
        : why !== 'ok' ? tr('offline', 'OFFLINE')
        : know === 'connecting' ? tr('connecting', 'CONNECTING')
        : (know === 'noconn' || know === 'offline') ? tr('noConn', 'NO CONNECTION') : tr('offline', 'OFFLINE');
      if ($('emb-live-txt').textContent !== word) $('emb-live-txt').textContent = word;
      var cw = st === 'off' ? '' : tr('watching', '{n} watching', { n: watchCount() });
      if ($('emb-count').textContent !== cw) $('emb-count').textContent = cw;
      var heard = !!M.serviceHeard;
      $('emb-play').hidden = heard || st === 'off';
      // Second prompt, after the unmute one (never both): sound is on, the Stage is blurred and this viewer may unblur it
      // (offer is false while a host's blur order wins).
      var cst = { mode: '', tapped: false, offer: false };
      try { cst = C.clearNoPwState() || cst; } catch (e) {}
      $('emb-unblur').hidden = !(heard && st !== 'off' && !!cst.mode && !cst.tapped && cst.offer !== false);
      var mw = heard ? tr('mute', 'Mute') : tr('unmute', 'Unmute');
      if ($('emb-mute').textContent !== mw) { $('emb-mute').textContent = mw; $('emb-mute').setAttribute('aria-pressed', heard ? 'false' : 'true'); }
      var card = $('emb-card');
      var mt = why !== 'ok' ? tr('msgName', 'This embed does not name a GifOS broadcast.')
        : know === 'connecting' ? tr('msgConnecting', 'Connecting to the meeting… The live view starts as soon as this page is in.')
        : know === 'offline' ? tr('msgOffline', 'You appear to be offline. Trying again…')
        : know === 'noconn' ? tr('msgNoConn', 'Couldn’t connect to the broadcast. Trying again…')
        : !hosted ? tr('msgUnhosted', 'This meeting isn’t hosted right now. The live view starts when a host takes charge.')
        : qtext ? qtext
        : (!picture && C.pwBlocked) ? tr('msgPw', 'This broadcast has a room password.')
        : !picture ? tr('msgNotLive', 'Not live right now.') : '';
      var msg = $('emb-msg');
      if (msg.textContent !== mt) msg.textContent = mt;
      msg.hidden = !mt || !card.hidden;
      $('emb-lock').hidden = !(C.pwBlocked && card.hidden);
      K.clearButtons(C, document.querySelector('.emb-bar'), 'emb-btn', document.querySelector('.emb-bar .emb-fill'));
      K.clearReportButton(C, document.querySelector('#emb-info-panel .emb-info-body'), 'clear-rep', 'emb-btn emb-rep');   // Report lives in the info panel, never on the control row
      measureBar();   // a hosted room with a clear right: the viewer's own tap, as on /meet; text buttons beside Unmute, before the icons and the gear
      document.body.classList.toggle('emb-audioonly', audioOnly);
      $('emb-audionote').hidden = !(audioOnly && hosted && why === 'ok');
      paintInsetRow();
      syncRows();
      aimFloat();
      try { K.stageNames(C, M); } catch (e) {}
      calmSoon();
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
    function shareLevel(sid) {   // the viewer's blur for a share: the core's Stage rule for its sharer (shareShotsSource reads the same)
      if (!sid) return 2;
      try { return Math.max(C.blurLevelFor(sid, false, false, 'stage') | 0, C.modBlurOn(sid) ? 1 : 0); } catch (e) { return 2; }
    }
    function pick(key) { try { C.ctSelect(key, 'embed'); } catch (e) {} shareSig = ''; paint(); }
    function paintPane(it) {
      var vid = $('emb-share-video'), box = $('emb-share-box');
      if (!it) { if (vid.srcObject) { try { vid.srcObject = null; } catch (e) {} } vid.hidden = true; box.hidden = true; return; }
      if (it.kind === 'screen') {
        var src = null; try { src = M.ctScreenTrack(it.sid); } catch (e) {}
        var track = src && src.track;
        var have = vid.srcObject && vid.srcObject.getVideoTracks()[0];
        if (track && have !== track) { vid.srcObject = new MediaStream([track]); try { var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} }
        vid.hidden = !track; box.hidden = !!track;
        // The share wears this viewer's blur for its sharer, as on /meet (ctPaintScreen): a sender that ships clear pixels
        // where the room blurs them stays blurred here.
        var lv = shareLevel(it.sid), had = vid.classList.contains('blur2') ? 2 : vid.classList.contains('blur1') ? 1 : 0;
        if (had !== lv) { try { C.fsBlurClass(vid, lv); } catch (e) {} }
        vid.dataset.sid = it.sid || '';
        if (!track) box.textContent = tr('pictureOnWay', '{label}: the picture is on its way.', { label: shareLabel(it) });
        return;
      }
      vid.hidden = true; box.hidden = false;
      if (it.kind === 'agenda') {
        var ag = C.CT && C.CT.ag, list = (ag && ag.items) || [];
        var html = '<h4>' + K.esc(tr('agenda', 'Agenda')) + '</h4><ol>' + list.map(function (x) {
          var t = K.esc(String((x && (x.title || x.text || x.t)) || ''));
          var m = x && (x.min || x.mins || x.m); return '<li>' + t + (m ? ' <span>' + K.esc(tr('minutes', '{n} min', { n: m | 0 })) + '</span>' : '') + '</li>';
        }).join('') + '</ol>';
        if (box.dataset.sig !== html) { box.innerHTML = html; box.dataset.sig = html; }
        return;
      }
      var w = tr('appOpen', '{name} is open in this meeting. Watch on GifOS to see it.', { name: it.name || tr('anApp', 'An app') });
      if (box.textContent !== w) { box.textContent = w; box.dataset.sig = ''; }
    }
    // The Stage inset: one squarish floating box with every Stage face (the media part's one Stage picture). Drag it;
    // it settles in the nearest corner and remembers it (this browser only); the minimize button folds it to a chip.
    var INSET_KEY = 'gifos.embed.inset';
    var inset = { corner: 'br', min: false };
    try {
      var sv = JSON.parse(lsGet(INSET_KEY) || 'null');
      if (sv && /^(t|b)(l|r)$/.test(sv.corner)) {
        inset.corner = sv.corner;                 // saved corner, default br
        if (controls.has('inset')) inset.min = !!sv.min;   // without inset, a saved min=true is ignored
      }
    } catch (e) {}
    function saveInset() { lsSet(INSET_KEY, JSON.stringify(inset)); }
    function placeInset() {
      document.body.dataset.inset = inset.corner;
      document.body.classList.toggle('emb-stage-folded', controls.has('inset') && inset.min);
      var mb = $('emb-inset-min');
      if (mb) {
        mb.hidden = !controls.has('inset');
        mb.setAttribute('aria-pressed', inset.min ? 'true' : 'false');
        mb.textContent = inset.min ? tr('stage', 'Stage') : '–';
        mb.title = inset.min ? tr('showStage', 'Show the Stage') : tr('minStage', 'Minimize the Stage');
      }
      paintInsetRow();
    }
    placeInset();
    root.__gifosEmbedInset = names.embedInsetForTest = function () {   // test read (the page's own state only)
      return insetState();
    };
    function insetState() { return { corner: inset.corner, min: inset.min, share: document.body.classList.contains('emb-has-share') }; }
    function toggleInset() {
      if (!controls.has('inset')) return;
      if (!document.body.classList.contains('emb-has-share')) return;
      inset.min = !inset.min;
      saveInset();
      placeInset();
    }
    function setToggle(row, on, onWord, offWord) {
      row.setAttribute('aria-checked', on ? 'true' : 'false');
      var st = row.querySelector('.emb-mstate');
      var w = on ? (onWord || tr('on', 'On')) : (offWord || tr('off', 'Off'));
      if (st && st.textContent !== w) st.textContent = w;
    }
    function paintInsetRow() {
      var row = $('emb-m-inset');
      if (!row) return;
      var share = document.body.classList.contains('emb-has-share');
      row.disabled = !share;
      if (!share) { row.setAttribute('aria-checked', 'false'); var s0 = row.querySelector('.emb-mstate'); if (s0) s0.textContent = ''; return; }
      setToggle(row, !inset.min, tr('shown', 'Shown'), tr('hiddenWord', 'Hidden'));
    }
    function visibleVideo() {
      if (document.body.classList.contains('emb-has-share')) return $('emb-share-video');
      return stageVideo();
    }

    // ---- FLOAT (picture in picture) --------------------------------------------------------------------------------
    // An element float paints a <video>'s raw frames (no CSS). A picture this viewer sees blurred floats only through
    // the LENS: a canvas redrawn through the media plane's blurDraw at the same strength as the Stage's CSS blur,
    // captured into a hidden <video> (the meeting's PIPBLUR rule, view.js pipFloatEl). A clear picture floats itself.
    // While anything floats, the float follows the level: a raw float whose picture turns blurred moves to the lens.
    function levelOf(v) {
      if (!v) return 2;
      if (v === $('emb-share-video')) return shareLevel(v.dataset.sid);   // a share wears its sharer's blur (paintPane)
      return stageLevel();
    }
    function floatEl() { try { return document.pictureInPictureElement || null; } catch (e) { return null; } }
    function wkFloating(v) { return !!(v && v.webkitPresentationMode === 'picture-in-picture'); }
    function floating() { return !!floatEl() || wkFloating(visibleVideo()) || !!(lens && wkFloating(lens.video)); }
    function floatSupported() { return !!K.pip.kind(visibleVideo() || document.createElement('video')) && !!(window.HTMLCanvasElement && HTMLCanvasElement.prototype.captureStream); }
    var lens = null;
    function lensMake() {
      if (lens) return lens;
      try {
        var canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
        var ctx = canvas.getContext('2d');
        var stream = canvas.captureStream(0), track = stream && stream.getVideoTracks()[0];
        if (!ctx || !track) return null;
        var video = document.createElement('video');
        video.id = 'emb-lens';
        video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.setAttribute('aria-hidden', 'true');
        video.style.cssText = 'position:fixed;right:0;bottom:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1';
        video.srcObject = stream;
        document.body.appendChild(video);
        var pr = video.play(); if (pr && pr.catch) pr.catch(function () {});
        lens = { canvas: canvas, ctx: ctx, stream: stream, track: track, video: video, src: null, timer: 0, rd: null, clone: null, frame: null, srcTrack: null };
        video.addEventListener('enterpictureinpicture', function () { lensRun(true); paintFloat(); });
        video.addEventListener('leavepictureinpicture', function () { lensRun(false); paintFloat(); });
        return lens;
      } catch (e) { return null; }
    }
    function lensFrac(level) {
      var rs = document.documentElement.style, T = GifOS.timings;
      return level >= 2 ? (parseFloat(rs.getPropertyValue('--blur-view-max')) || T.BLUR_VIEW_MAX_FRAC)
        : level >= 1 ? (parseFloat(rs.getPropertyValue('--blur-view-min')) || T.BLUR_VIEW_MIN_FRAC) : 0;
    }
    function lensPaint() {
      var Z = lens;
      if (!Z) return;
      var src = visibleVideo(), level = levelOf(src);
      var f = Z.frame, from = f || src;
      var sw = f ? f.displayWidth : (src && src.videoWidth), sh = f ? f.displayHeight : (src && src.videoHeight);
      if (!from || !(sw > 0 && sh > 0) || !hostedNow() || audioOnly) {
        Z.ctx.fillStyle = '#000'; Z.ctx.fillRect(0, 0, Z.canvas.width, Z.canvas.height);
      } else {
        var k = Math.min(1, 480 / Math.max(sw, sh));   // a float is small: 480 px on the long side is plenty
        var w = Math.max(2, Math.round(sw * k)), h = Math.max(2, Math.round(sh * k));
        if (Z.canvas.width !== w || Z.canvas.height !== h) { Z.canvas.width = w; Z.canvas.height = h; }
        var frac = lensFrac(level);
        try {
          if (frac > 0) {
            // Drawn 15% over size, as the Stage's CSS scales up its blur, so the blur's soft rim falls outside the float.
            var dw = w * 1.15, dh = h * 1.15;
            M.blurDraw(Z.ctx, from, (w - dw) / 2, (h - dh) / 2, dw, dh, frac);
          } else Z.ctx.drawImage(from, 0, 0, w, h);
        } catch (e) { Z.ctx.fillStyle = '#000'; Z.ctx.fillRect(0, 0, w, h); }   // a picture that cannot be blurred is never drawn clear
      }
      try { if (typeof Z.track.requestFrame === 'function') Z.track.requestFrame(); } catch (e) {}
    }
    // Frames come from the source track where the browser can read one (a hidden tab may stop painting the element),
    // else from the element itself.
    function lensPump() {
      var Z = lens;
      if (!Z) return;
      var src = visibleVideo(), tk = null;
      try { tk = src && src.srcObject && src.srcObject.getVideoTracks()[0]; } catch (e) { tk = null; }
      if (Z.srcTrack === tk && (Z.rd || typeof window.MediaStreamTrackProcessor !== 'function')) return;
      lensPumpStop();
      Z.srcTrack = tk;
      if (!tk || tk.readyState !== 'live' || typeof window.MediaStreamTrackProcessor !== 'function') return;
      var rd = null;
      try { Z.clone = tk.clone(); rd = new window.MediaStreamTrackProcessor({ track: Z.clone }).readable.getReader(); } catch (e) { if (Z.clone) { try { Z.clone.stop(); } catch (x) {} Z.clone = null; } return; }
      Z.rd = rd;
      (function next() {
        rd.read().then(function (r) {
          if (r.done || Z.rd !== rd) { if (r.value) { try { r.value.close(); } catch (e) {} } return; }
          if (Z.frame) { try { Z.frame.close(); } catch (e) {} }
          Z.frame = r.value;   // only the newest frame is kept: a held frame pins a decoder buffer
          next();
        }, function () {});
      })();
    }
    function lensPumpStop() {
      var Z = lens;
      if (!Z) return;
      if (Z.rd) { var r = Z.rd; Z.rd = null; try { r.cancel(); } catch (e) {} }
      if (Z.clone) { try { Z.clone.stop(); } catch (e) {} Z.clone = null; }
      if (Z.frame) { try { Z.frame.close(); } catch (e) {} Z.frame = null; }
      Z.srcTrack = null;
    }
    function lensRun(on) {
      var Z = lens;
      if (!Z) return;
      clearInterval(Z.timer); Z.timer = 0;
      if (!on) { lensPumpStop(); return; }
      lensPump();
      lensPaint();
      Z.timer = setInterval(function () { lensPump(); lensPaint(); }, lensMs());
    }
    function lensMs() { return Math.round(1e3 / GifOS.timings.PIP_LENS_FPS); }   // one paint per lens frame
    function lensUp() { return !!lens && (floatEl() === lens.video || wkFloating(lens.video)); }
    function request(el) {
      try {
        if (typeof el.requestPictureInPicture === 'function' && document.pictureInPictureEnabled) return Promise.resolve(el.requestPictureInPicture());
        if (typeof el.webkitSetPresentationMode === 'function') { el.webkitSetPresentationMode('picture-in-picture'); return Promise.resolve(); }
      } catch (e) { return Promise.reject(e); }
      return Promise.reject(new Error('no float'));
    }
    function exitFloat() {
      try { if (document.pictureInPictureElement) { var ex = document.exitPictureInPicture(); if (ex && ex.catch) ex.catch(function () {}); } } catch (e) {}
      [visibleVideo(), lens && lens.video].forEach(function (v) { if (wkFloating(v)) { try { v.webkitSetPresentationMode('inline'); } catch (e) {} } });
    }
    function lensReady() {
      var Z = lensMake();
      if (!Z) return Promise.resolve(null);
      lensPump(); lensPaint();
      if (Z.video.readyState >= 1) return Promise.resolve(Z.video);
      return new Promise(function (res) {
        var done = false, fin = function () { if (done) return; done = true; res(Z.video.readyState >= 1 ? Z.video : null); };
        Z.video.addEventListener('loadedmetadata', fin, { once: true });
        setTimeout(fin, GifOS.timings.PIP_CARD_READY_MS);
        var tick = setInterval(function () { if (done) { clearInterval(tick); return; } lensPaint(); }, lensMs());
      });
    }
    function toggleFloat() {
      if (floating()) { exitFloat(); return; }
      var v = visibleVideo();
      if (!v || audioOnly) return;
      if (levelOf(v) === 0) { request(v).then(paintFloat, function () {}); return; }
      lensReady().then(function (el) { if (el) request(el).then(paintFloat, function () {}); });
    }
    // While something floats: a raw float whose picture is now blurred moves to the lens (a float may change its
    // element with no tap while one is up), or closes when no lens can be made. Audio only closes the float.
    function aimFloat() {
      var up = floatEl();
      if (!up) { paintFloat(); return; }
      if (audioOnly) { exitFloat(); return; }
      if (lensUp()) { paintFloat(); return; }
      if (levelOf(up) > 0) {
        var Z = lensMake();
        if (!Z) { exitFloat(); return; }
        lensPaint();
        request(Z.video).then(paintFloat, function () { exitFloat(); });
      }
      paintFloat();
    }
    function paintFloat() {
      var b = $('emb-float');
      if (!b) return;
      b.hidden = !(controls.has('pip') && floatSupported() && !audioOnly && hostedNow());
      var on = floating();
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      var w = on ? tr('floatStop', 'Stop floating') : tr('float', 'Float');
      if (b.getAttribute('aria-label') !== w) { b.setAttribute('aria-label', w); b.title = w; }
    }
    root.__gifosEmbedFloat = function () {   // test read (the page's own state only)
      var up = floatEl();
      return { supported: floatSupported(), floating: floating(), lens: lensUp(), el: up ? (up.id || up.tagName) : null, level: levelOf(visibleVideo()) };
    };

    // ---- FULL SCREEN: the whole player (the document) takes the screen; iPhone, which has no element full screen,
    // gives the visible video its own. The owner's snippet must allow it (allow="fullscreen", allowfullscreen).
    function fullSupported() {
      try { if (GifOS.fullscreen && GifOS.fullscreen.supported()) return true; } catch (e) {}
      var v = visibleVideo();
      return !!(v && typeof v.webkitEnterFullscreen === 'function' && document.fullscreenEnabled !== false && !document.documentElement.requestFullscreen);
    }
    function toggleFull() { K.fullscreen.toggle(visibleVideo); }
    function paintFull() {
      var b = $('emb-full');
      if (!b) return;
      b.hidden = !(controls.has('fullscreen') && fullSupported());
      var on = K.fullscreen.on();
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      var w = on ? tr('fullExit', 'Exit full screen') : tr('full', 'Full screen');
      if (b.getAttribute('aria-label') !== w) { b.setAttribute('aria-label', w); b.title = w; }
    }

    // ---- captions, volume ------------------------------------------------------------------------------------------
    function capWho(byId, label) { return K.nameOf(C, byId, label); }
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
      setToggle(b, ccOn);
    }
    function readVol() {
      var raw = lsGet('gifos.embed.vol');
      if (raw == null || raw === '') return null;
      var v = Number(raw);
      if (!isFinite(v)) return null;
      return Math.max(0, Math.min(1, v));
    }
    function applyVol(v, save) {   // the embed's own knob. Never write localStorage 'gifos_mix' (the meeting page's fader memory).
      v = Math.max(0, Math.min(1, Number(v)));
      if (!isFinite(v)) return;
      try { M.mix.stage = v; } catch (e) {}
      try { M.applyBuses(); } catch (e) {}
      if (save) lsSet('gifos.embed.vol', String(v));
    }
    function paintMuteRow() {
      var b = $('emb-m-mute');
      if (!b) return;
      b.hidden = !(controls.has('mute') && why === 'ok');
      var heard = !!M.serviceHeard;
      b.disabled = !heard && !hostedNow();
      setToggle(b, !heard);
    }
    function paintAudioRow() {
      var b = $('emb-m-audioonly');
      if (!b) return;
      b.hidden = !controls.has('audioonly');
      setToggle(b, audioOnly);
    }
    function setAudioOnly(on) {
      if (!controls.has('audioonly')) return;
      audioOnly = !!on;
      lsSet('gifos.embed.audioonly', audioOnly ? '1' : '0');
      if (audioOnly && floating()) exitFloat();
      paint();
    }
    root.__gifosEmbedAudioOnly = function () { return audioOnly; };   // test read

    // ---- CHAT: the room's chat, read and posted from this seat (a seat like any other). Shown while the host leaves
    // chat on (the core's signed chat switch); the core posts and checks every line (slow mode, the rate, chat off).
    function chatOff() { try { return !!C.model.chat.off() && !C.amAdmin; } catch (e) { return true; } }
    function chatShows() { return controls.has('chat') && why === 'ok' && hostedNow() && !chatOff(); }
    var chatSeen = 0, chatSig = '';
    function chatLines() {
      var out = [];
      try {
        var tombs = C.model.chat.tombs();
        C.model.chat.lines().forEach(function (m) { if (m && m.text && !(tombs && tombs.has && tombs.has(m.id))) out.push(m); });
      } catch (e) {}
      out.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
      return out;
    }
    function renderChatPanel() {
      var lines = chatLines();
      var open = panel === 'chat';
      if (open) chatSeen = lines.length;
      var dot = $('emb-chat-dot');
      if (dot) dot.hidden = open || lines.length <= chatSeen;
      if (!open) return;
      var me = '';
      try { me = C.model.me.myId(); } catch (e) {}
      var sig = lines.length + ':' + (lines.length ? lines[lines.length - 1].id : '') + ':' + me;
      if (sig === chatSig) return;
      chatSig = sig;
      var log = $('emb-chat-log');
      var near = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
      log.textContent = '';
      if (!lines.length) {
        var e0 = document.createElement('li'); e0.className = 'emb-chat-empty'; e0.textContent = tr('chatEmpty', 'No messages yet.'); log.appendChild(e0);
      }
      lines.slice(-200).forEach(function (m) {
        var li = document.createElement('li');
        if (m.byId && m.byId === me) li.className = 'mine';
        var who = document.createElement('b'); who.textContent = String(m.by || tr('someone', 'Someone')).slice(0, 40);
        var tx = document.createElement('span'); tx.textContent = String(m.text).slice(0, 2000);
        li.appendChild(who); li.appendChild(document.createTextNode(' ')); li.appendChild(tx);
        log.appendChild(li);
      });
      if (near || chatSeen === lines.length) log.scrollTop = log.scrollHeight;
    }
    fn('renderChat', function () { renderChatPanel(); });
    // A viewer arrives with a quiet guest name (the core's, "Guest 1234"). The first line they post asks once for the name
    // the room sees, the guest name filled in; after that (this browser) it posts straight away.
    var NAMED_KEY = 'gifos.embed.named';
    function myNameSet() { return lsGet(NAMED_KEY) === '1'; }
    function myName() { try { return String((GifOS.store.identity() || {}).name || '').trim(); } catch (e) { return ''; } }
    var chatNote = '';
    function sayChatNote(t) {
      chatNote = t || '';
      var n = $('emb-chat-note');
      n.textContent = chatNote; n.hidden = !chatNote;
    }
    function sendChat() {
      var inp = $('emb-chat-in');
      var text = inp.value.trim();
      if (!text) return;
      if (chatOff()) { sayChatNote(tr('chatOff', 'The host has turned chat off.')); return; }
      // The first line from this seat asks for the name it goes out under (the meeting's name, this browser only).
      if (!myNameSet()) { showNameCard(true); return; }
      var m = { id: C.uid('m'), by: C.myName(), byId: C.model.me.myId(), at: Date.now(), text: text.slice(0, 2000) };
      var r = false;
      try { r = C.act.postChat(m); } catch (e) { r = false; }
      if (!r) { sayChatNote(tr('chatWait', 'Slow mode: wait a few seconds before posting again.')); return; }
      sayChatNote(r === 'held' ? tr('chatHeld', 'Slow mode: your message goes out in a few seconds.') : '');
      inp.value = '';
      renderChatPanel();
    }
    function showNameCard(on) {
      var c = $('emb-name-card');
      c.hidden = !on;
      $('emb-chat-form').hidden = !!on;
      if (on) { var ni = $('emb-name-in'); ni.value = myName(); try { ni.focus(); ni.select(); } catch (e) {} }
      else { try { $('emb-chat-in').focus(); } catch (e) {} }
    }
    function saveName() {
      var n = $('emb-name-in').value.replace(/\s+/g, ' ').trim().slice(0, 40);
      if (!n) return;
      try { GifOS.store.setName(n); } catch (e) {}
      lsSet(NAMED_KEY, '1');
      try { C.broadcastStatus(); } catch (e) {}   // the room learns the name with this seat's next status
      showNameCard(false);
      sendChat();
    }
    function paintChatBtn() {
      var b = $('emb-chat');
      var on = chatShows();
      b.hidden = !on;
      if (!on && panel === 'chat') setPanel(null);
      b.setAttribute('aria-expanded', panel === 'chat' ? 'true' : 'false');
    }

    // ---- TRANSCRIPT: the lines the room's speakers caption for themselves, read here. This page runs no speech engine
    // (EMBEDMIC): the core keeps the caption lines it is sent, like chat (trBlocks), and this panel draws them, with the same
    // Download the meeting has (viewKit.trDownload: the plain .txt, or the .zip when screenshots exist). Auto screenshots: this
    // device's own pictures of the screens it is shown (shareshots.js, the meeting's rules); UNTICKED until the person ticks
    // it (a page left open for hours must not fill the browser's memory unseen), remembered in this browser.
    var TR_SHOTS_KEY = 'gifos.embed.trshots';
    function trKept() { try { return !!C.trKeeps(); } catch (e) { return false; } }
    function trShows() { return controls.has('transcript') && why === 'ok' && hostedNow() && trKept(); }
    function shotsOn() { return lsGet(TR_SHOTS_KEY) === 'on'; }   // default off
    function shotWho(s) { return tr('trShotWho', '{name}\'s screen', { name: s.name || '?' }); }   // this page shows other people's screens only
    function shotWords(s) {
      var time = ''; try { time = C.model.chat.when(s.at); } catch (e) { time = new Date(s.at).toLocaleTimeString(); }
      return tr('trShotOf', '{name}\'s screen, {time}', { name: s.name || '?', time: time });
    }
    var shotsArmed = false;
    function armShots() {   // the library's sampler starts only once the box has been ticked (nothing runs for a page that never asks)
      if (shotsArmed || !shotsOn() || !GifOS.shareShots) return;
      shotsArmed = true;
      try {
        GifOS.shareShots.attach({
          keep: function () { return trKept(); },
          on: function () { return trKept() && shotsOn() && hostedNow(); },
          shares: function () {
            var out = [];
            (C.screenSharers() || []).forEach(function (sid) {
              if ((C.blurLevelFor(sid, false, false, 'stage') | 0) > 0 || C.modBlurOn(sid)) return;   // a share seen blurred is never taken
              var src = M.ctScreenTrack(sid);
              if (!src || !src.track || src.from === 'strip') return;
              out.push({ sid: sid, mine: false, name: C.displayName(sid), track: src.track });
            });
            return out;
          },
          changed: function () { renderTrPanel(); },
          always: function () { return false; }
        });
      } catch (e) { shotsArmed = false; }
    }
    var trSig = '';
    function trItems() {
      var lines = [], shots = [];
      try { lines = C.trBlocks(); } catch (e) {}
      try { shots = GifOS.shareShots ? GifOS.shareShots.list() : []; } catch (e) {}
      if (!shots.length) return lines;
      return lines.concat(shots.map(function (s) { return { at: s.at, shot: s }; })).sort(function (a, b) { return a.at - b.at; });
    }
    function renderTrPanel() {
      if (panel !== 'tr') return;
      var items = trItems(), mine = '';
      try { mine = C.trLang(); } catch (e) {}
      var last = items[items.length - 1];
      var sig = items.length + ':' + (last ? (last.shot ? last.shot.id : last.end + ':' + last.text.length) : '') + ':' + lsGet(TR_SHOTS_KEY);
      if (sig === trSig) return;
      trSig = sig;
      var log = $('emb-tr-log');
      var near = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
      log.textContent = '';
      if (!items.length) {
        var e0 = document.createElement('li'); e0.className = 'emb-chat-empty'; e0.textContent = tr('trEmpty', 'Lines appear here as people speak.'); log.appendChild(e0);
      }
      items.slice(-300).forEach(function (l) {
        var li = document.createElement('li');
        if (l.shot) {
          var w = shotWords(l.shot);
          try { GifOS.shareShots.label(l.shot.id, w); } catch (e) {}
          li.className = 'emb-tr-shot';
          var cap = document.createElement('b'); cap.textContent = w;
          var img = document.createElement('img'); img.setAttribute('data-shot', l.shot.id); img.src = l.shot.url; img.width = l.shot.w; img.height = l.shot.h; img.alt = w; img.loading = 'lazy';
          li.appendChild(cap); li.appendChild(img);
        } else {
          var who = document.createElement('b'); who.textContent = String(l.by || tr('someone', 'Someone')).slice(0, 40);
          var tx = document.createElement('span'); tx.textContent = String(C.trNote(l) + l.text).slice(0, 4000);
          li.appendChild(who); li.appendChild(tx);
          if (l.lang && l.lang !== mine) { var lg = document.createElement('small'); lg.textContent = ' (' + l.lang + ')'; li.appendChild(lg); }
        }
        log.appendChild(li);
      });
      if (near || !log.scrollTop) log.scrollTop = log.scrollHeight;
    }
    fn('renderTranscript', function () { renderTrPanel(); });
    function paintTrBtn() {
      var b = $('emb-tr');
      var on = trShows();
      b.hidden = !on;
      if (!on && panel === 'tr') setPanel(null);
      b.setAttribute('aria-expanded', panel === 'tr' ? 'true' : 'false');
      var box = $('emb-tr-shots'); if (box && box.checked !== shotsOn()) box.checked = shotsOn();
    }

    // ---- REACTIONS: the meeting's audience reactions, sent the same way. Shown while the host lets guests react.
    function reactShows() { var ok = false; try { ok = !!C.viewerMayReact(); } catch (e) { ok = false; } return controls.has('reactions') && why === 'ok' && hostedNow() && ok; }
    var reactSig = '';
    function paintReactBtn() {
      var b = $('emb-react');
      var on = reactShows();
      b.hidden = !on;
      if (!on && panel === 'react') setPanel(null);
      b.setAttribute('aria-expanded', panel === 'react' ? 'true' : 'false');
      var list = []; try { list = C.model.consts.AUDIENCE_REACTS() || []; } catch (e) {}
      var sig = list.join('');
      if (sig === reactSig) return;
      reactSig = sig;
      var tray = $('emb-react-tray');
      tray.textContent = '';
      list.forEach(function (e) {
        var x = document.createElement('button'); x.type = 'button'; x.className = 'emb-react-b'; x.textContent = e;
        x.setAttribute('aria-label', e);
        x.onclick = function () { sendReact(e, x); };
        tray.appendChild(x);
      });
    }
    function sendReact(e, from) {
      if (!reactShows()) return;
      try { C.sendAudienceReact(e); } catch (x) { return; }
      var fly = document.createElement('span'); fly.className = 'emb-react-fly'; fly.textContent = e; fly.setAttribute('aria-hidden', 'true');
      var r = from.getBoundingClientRect();
      fly.style.left = Math.round(r.left + r.width / 2) + 'px'; fly.style.top = Math.round(r.top) + 'px';
      fly.addEventListener('animationend', function () { fly.remove(); });
      document.body.appendChild(fly);
    }

    // ---- the panels: the gear menu, the info panel, chat and the reaction tray. One is open at a time. Each closes on
    // Esc, on a tap outside it, or on its own button, and gives the focus back to that button.
    var PANELS = { menu: ['emb-menu', 'emb-gear'], info: ['emb-info-panel', 'emb-info'], chat: ['emb-chat-panel', 'emb-chat'], tr: ['emb-tr-panel', 'emb-tr'], react: ['emb-react-tray', 'emb-react'] };
    var panel = null;
    function setPanel(name, focusBack) {
      if (name && !PANELS[name]) name = null;
      if (name && $(PANELS[name][1]).hidden) name = null;
      var was = panel;
      panel = name;
      Object.keys(PANELS).forEach(function (k) {
        var on = k === name;
        $(PANELS[k][0]).hidden = !on;
        $(PANELS[k][1]).setAttribute('aria-expanded', on ? 'true' : 'false');
      });
      if (name === 'menu') { var items = menuItems(); if (items[0]) { try { items[0].focus(); } catch (e) {} } }
      if (name === 'info') { try { $('emb-info-close').focus(); } catch (e) {} }
      if (name === 'chat') { chatSig = ''; renderChatPanel(); showNameCard(false); sayChatNote(''); }
      if (name === 'tr') { trSig = ''; renderTrPanel(); try { $('emb-tr-close').focus(); } catch (e) {} }
      if (name === 'react') { var f = $('emb-react-tray').querySelector('button'); if (f) { try { f.focus(); } catch (e) {} } }
      if (!name && was && focusBack) { var b = $(PANELS[was][1]); if (b && !b.hidden) { try { b.focus(); } catch (e) {} } }
      wake();
    }
    root.__gifosEmbedPanel = function () { return panel; };   // test read
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
    function syncRows() {
      var vol = $('emb-m-volume'); if (vol) vol.hidden = !controls.has('volume');
      var ins = $('emb-m-inset'); if (ins) ins.hidden = !controls.has('inset');
      var nm = $('emb-m-names'); if (nm) { nm.hidden = !controls.has('names'); setToggle(nm, showNames); }
      paintMuteRow();
      paintCcRow();
      paintAudioRow();
      paintFloat();
      paintFull();
      paintChatBtn();
      paintTrBtn();
      paintReactBtn();
      // The gear shows only when its menu has a row to show (captions not yet arrived is no row).
      var on = false, menu = $('emb-menu');
      if (menu) Array.prototype.forEach.call(menu.children, function (row) { if (!row.hidden) on = true; });
      if (controls.has('watch') && why === 'ok') on = true;
      var gear = $('emb-gear'); if (gear) { gear.hidden = !on; if (!on && panel === 'menu') setPanel(null); }
    }
    // (No paint at this first step: the core's own names are not set yet. The first paint runs once the linker's run returns.)

    // The bar can wrap to two rows on a narrow player; the picture (its burned-in name too) stops above it, never under it.
    var barH = -1;
    function measureBar() {
      var bar = document.querySelector('#embedui .emb-bar'); if (!bar) return;
      var cs = getComputedStyle(bar), h = Math.max(0, Math.round(bar.offsetHeight - (parseFloat(cs.paddingTop) || 0)));
      if (h === barH) return;
      barH = h; document.documentElement.style.setProperty('--emb-bar-h', h + 'px');
    }
    try { if (root.ResizeObserver) new root.ResizeObserver(measureBar).observe(document.querySelector('#embedui .emb-bar')); } catch (e) {}
    root.addEventListener('resize', measureBar);

    // ---- CALM: the bar fades after CHROME_IDLE_MS (the meeting's own chrome clock) with no pointer, touch or key, and
    // comes back on any of them. Never while a panel or the password card is open,
    // the password button shows, or a key-driven focus is in it. The unmute and unblur prompts are not in the bar: they never fade.
    var calmT = 0, calm = false;
    function mayCalm() {
      // A pointer that merely rests on the bar does not hold it up (every move wakes it): after a click on the full-screen button the pointer rests there.
      if (panel || !$('emb-card').hidden || !$('emb-lock').hidden) return false;
      var ae = document.activeElement, bar = document.querySelector('#embedui .emb-bar');
      // Only a KEY-driven focus holds the bar up. A button the viewer clicked or tapped (full screen, info, mute) keeps focus
      // without being used from the keyboard; counting that held the bar up for good after a tap (worst in full screen, where
      // the full-screen button is the last thing touched).
      var kb = false; try { kb = !!(ae && ae.matches && ae.matches(':focus-visible')); } catch (e) { kb = true; }
      if (ae && bar && bar.contains(ae) && ae !== document.body && kb) return false;
      return true;
    }
    function setCalm(on) {
      calm = !!on;
      document.body.classList.toggle('emb-calm', calm);
      K.calm(calm);   // the watching surfaces' one idle fade: the top line and the Stage names go with the bar
    }
    function calmSoon() {
      if (!mayCalm()) { if (calm) setCalm(false); clearTimeout(calmT); calmT = 0; return; }
      if (calm || calmT) return;
      calmT = setTimeout(function () { calmT = 0; if (mayCalm()) setCalm(true); }, GifOS.timings.CHROME_IDLE_MS);
    }
    function wake() {
      clearTimeout(calmT); calmT = 0;
      if (calm) setCalm(false);
      calmSoon();
    }
    root.__gifosEmbedCalm = function () { return { calm: calm, ms: GifOS.timings.CHROME_IDLE_MS }; };   // test read

    // ---- words in the markup: set once the catalog is in (English is already there) ---------------------------------
    function applyWords() {
      try { document.documentElement.lang = I18 ? I18.ui() : 'en'; } catch (e) {}
      var set = function (id, key, en, attr) {
        var el = $(id); if (!el) return;
        var w = tr(key, en);
        if (attr) el.setAttribute(attr, w); else el.textContent = w;
      };
      var row = function (id, key, en) { var el = $(id); var s = el && el.querySelector('span'); if (s) s.textContent = tr(key, en); };
      set('emb-play', 'unmute', 'Unmute', 'aria-label');
      var ps = $('emb-play').querySelector('span'); if (ps) ps.textContent = tr('tapUnmute', 'Tap to unmute');
      set('emb-unblur', 'unblur', 'Unblur', 'aria-label');
      var us = $('emb-unblur').querySelector('span'); if (us) us.textContent = tr('tapUnblur', 'Tap to unblur');
      set('emb-lock', 'enterPw', 'Enter password');
      ['emb-gear', 'emb-menu'].forEach(function (id) { set(id, 'settings', 'Settings', 'aria-label'); });
      set('emb-info', 'info', 'About this broadcast', 'aria-label'); set('emb-info', 'info', 'About this broadcast', 'title');
      set('emb-info-h', 'info', 'About this broadcast');
      set('emb-info-close', 'close', 'Close');
      set('emb-info-blurb', 'blurb', 'GifOS — low-cost, AI-friendly live streaming.');
      set('emb-chat', 'chat', 'Chat', 'aria-label'); set('emb-chat', 'chat', 'Chat', 'title');
      set('emb-chat-h', 'chat', 'Chat');
      set('emb-chat-close', 'close', 'Close');
      set('emb-chat-in', 'chatPh', 'Say something', 'placeholder'); set('emb-chat-in', 'chatPh', 'Say something', 'aria-label');
      set('emb-chat-send', 'send', 'Send');
      set('emb-name-lbl', 'nameAsk', 'Your name in the chat');
      set('emb-name-in', 'namePh', 'Name', 'placeholder');
      set('emb-name-go', 'nameGo', 'Post');
      set('emb-name-x', 'notNow', 'Not now');
      set('emb-tr', 'transcript', 'Transcript', 'aria-label'); set('emb-tr', 'transcript', 'Transcript', 'title');
      set('emb-tr-h', 'transcript', 'Transcript');
      set('emb-tr-close', 'close', 'Close');
      set('emb-tr-dl', 'trDownload', 'Download');
      set('emb-tr-shots-txt', 'trShots', 'Auto screenshots');
      set('emb-tr-shots-row', 'trShotsTip', 'When a shared screen changes and holds still, like a new slide, the transcript keeps one screenshot of it. Taken on this device from what you see: nothing is sent, and a screen you see blurred is never taken.', 'title');
      trSig = ''; renderTrPanel();
      set('emb-react', 'react', 'React', 'aria-label'); set('emb-react', 'react', 'React', 'title');
      set('emb-react-tray', 'react', 'React', 'aria-label');
      var vl = $('emb-m-volume'); if (vl) { vl.querySelector('span').textContent = tr('volume', 'Volume'); vl.querySelector('input').setAttribute('aria-label', tr('volume', 'Volume')); }
      row('emb-m-mute', 'mute', 'Mute');
      row('emb-m-captions', 'captions', 'Captions');
      row('emb-m-audioonly', 'audioOnly', 'Audio only');
      row('emb-m-inset', 'stagePic', 'Stage picture');
      row('emb-m-names', 'showNames', 'Show names');
      set('emb-watch', 'viewOn', 'View on gifos.app');
      set('emb-audionote-txt', 'audioOnly', 'Audio only');
      set('emb-card-title', 'cardTitle', 'Watch clearly');
      set('emb-pw', 'pwPh', 'Password', 'placeholder'); set('emb-pw', 'pwAria', 'Room password', 'aria-label');
      set('emb-pw-go', 'watch', 'Watch');
      set('emb-pw-later', 'notNow', 'Not now');
      ['emb-tabs', 'emb-tabmenu'].forEach(function (id) { set(id, 'sharedNow', 'Shared now', 'aria-label'); });
      if ($('emb-card').hidden) $('emb-card-hint').textContent = tr('cardHint', 'Enter the password to watch clearly.');
      paintTitle(); placeInset(); paint();
    }

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
      $('emb-card-hint').textContent = tried ? tr('cardRetry', 'That password did not work. Try again.') : tr('cardHint', 'Enter the password to watch clearly.');
      $('emb-pw').value = '';
      $('emb-card').hidden = false;
      paint();
    });
    fn('hideJoinPwModal', function () { $('emb-card').hidden = true; paint(); });
    fn('replaceAddress', function () {});     // an embed keeps its address (a framed /cast is refused)
    H.paintsAll(['paintLiveBadge', 'paintRoomTrust', 'paintControls', 'paintStagePlate', 'paintStatusLine', 'paintBroadcastRole', 'capPaint', 'applyAdminUi', 'layout', 'paintChatGate', 'paintChatBtn'], paint);
    H.finish();

    // The player paints once the linker's run returns, even when the meeting's start stops early (an embed that names
    // no hosted broadcast joins nothing, and says why).
    queueMicrotask(function () { try { paint(); } catch (e) {} });
    return { names: names, setup: setup };
    // Input: unmute, mute, the password, the bar and its panels. Runs after the core's top level.
    function setup() {
    $('emb-play').onclick = function () { if (hostedNow()) hear(true); };
    // UPDATE: a player never stays on an old release (an old page is refused by the room's relay and would sit on
    // CONNECTING). A framed page has no update bar, so the player reads version.json itself, now, then every
    // UPDATE_CHECK_MS and when it is shown again; a newer release reloads this frame onto it, the room link kept.
    (function watchRelease() {
      var m = /^\/versions\/(\d+(?:\.\d+){2,3})\//.exec(location.pathname);
      if (!m) return;   // the edge build follows its own deploys
      var mine = m[1], moving = false;
      var newer = function (a, b) {
        var x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
        for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; }
        return false;
      };
      var tick = function () {
        if (moving || document.hidden) return;
        fetch('/version.json', { cache: 'no-cache', credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
          var latest = v && typeof v.latest === 'string' && /^\d+(\.\d+){2,3}$/.test(v.latest) ? v.latest : '';
          if (!latest || !newer(latest, mine) || moving) return;
          moving = true;
          location.replace('/versions/' + latest + '/embed' + location.hash);
        }).catch(function () {});
      };
      setTimeout(tick, GifOS.timings.EMBED_HOSTED_MS);
      setInterval(tick, GifOS.timings.UPDATE_CHECK_MS);
      document.addEventListener('visibilitychange', tick);
    })();
    $('emb-unblur').onclick = function () { try { C.tapUnblur(); } catch (e) {} paint(); };
    setInterval(function () { try { paint(); } catch (e) {} }, GifOS.timings.EMBED_HOSTED_MS);   // re-read the live host state
    $('emb-mute').onclick = function () { if (hostedNow() || M.serviceHeard) hear(!M.serviceHeard); };
    $('emb-lock').onclick = function () { names.showPwModal(true); };
    $('emb-tabmenu').onchange = function () { pick(this.value); };
    $('emb-inset-min').onclick = function (e) { e.stopPropagation(); toggleInset(); };
    $('emb-m-inset').onclick = function () { toggleInset(); };
    $('emb-m-names').onclick = function () { showNames = !showNames; document.body.classList.toggle('names-off', !showNames); lsSet('gifos.embed.names', showNames ? '1' : '0'); syncRows(); };
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
    $('emb-m-mute').onclick = function () { if (hostedNow() || M.serviceHeard) hear(!M.serviceHeard); };
    $('emb-m-captions').onclick = function () {
      if (!controls.has('captions')) return;
      ccOn = !ccOn;
      lsSet('gifos.embed.cc', ccOn ? '1' : '0');
      paintCcRow();
      if (ccOn) armCap(); else paintCapBar();
    };
    $('emb-m-audioonly').onclick = function () { setAudioOnly(!audioOnly); };
    $('emb-full').onclick = function () { toggleFull(); };
    $('emb-float').onclick = function () { toggleFloat(); };
    $('emb-gear').onclick = function () { setPanel(panel === 'menu' ? null : 'menu'); };
    $('emb-info').onclick = function () { setPanel(panel === 'info' ? null : 'info'); };
    $('emb-info-close').onclick = function () { setPanel(null, true); };
    $('emb-chat').onclick = function () { setPanel(panel === 'chat' ? null : 'chat'); if (panel === 'chat') { try { $('emb-chat-in').focus(); } catch (e) {} } };
    $('emb-chat-close').onclick = function () { setPanel(null, true); };
    $('emb-chat-form').onsubmit = function (e) { e.preventDefault(); sendChat(); };
    $('emb-name-card').onsubmit = function (e) { e.preventDefault(); saveName(); };
    $('emb-name-x').onclick = function () { showNameCard(false); };
    $('emb-tr').onclick = function () { setPanel(panel === 'tr' ? null : 'tr'); };
    $('emb-tr-close').onclick = function () { setPanel(null, true); };
    $('emb-tr-dl').onclick = function () { try { K.trDownload(C, M.transcriptFile(), shotWho); } catch (e) {} };
    $('emb-tr-shots').checked = shotsOn();
    $('emb-tr-shots').onchange = function () { lsSet(TR_SHOTS_KEY, this.checked ? 'on' : 'off'); armShots(); trSig = ''; renderTrPanel(); };
    armShots();
    $('emb-react').onclick = function () { setPanel(panel === 'react' ? null : 'react'); };
    document.addEventListener('pointerdown', function (e) {
      if (!panel) return;
      var t = e.target, p = PANELS[panel];
      if (t && t.closest && (t.closest('#' + p[0]) || t.closest('#' + p[1]))) return;
      setPanel(null);
    });
    document.addEventListener('keydown', function (e) {
      if (!panel) return;
      if (e.key === 'Escape') { e.preventDefault(); setPanel(null, true); return; }
      if (panel === 'info' && e.key === 'Tab') {   // the info panel is a dialog: Tab stays inside it
        var f = Array.prototype.filter.call($('emb-info-panel').querySelectorAll('button, a[href]'), function (x) { return !x.hidden; });
        if (!f.length) return;
        var i = f.indexOf(document.activeElement);
        var n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i < 0 || i === f.length - 1 ? 0 : i + 1);
        f[n].focus(); e.preventDefault();
        return;
      }
      if (panel !== 'menu' || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      var menu = $('emb-menu'), ae = document.activeElement;
      if (!menu || (ae !== $('emb-gear') && !menu.contains(ae))) return;
      var items = menuItems();
      if (!items.length) return;
      var k = items.indexOf(ae);
      var nx = e.key === 'ArrowDown' ? (k + 1) % items.length : (k <= 0 ? items.length - 1 : k - 1);
      items[nx].focus();
      e.preventDefault();
    });
    ['pointermove', 'pointerdown', 'keydown', 'focusin', 'touchstart', 'wheel'].forEach(function (ev) {
      document.addEventListener(ev, wake, { capture: true, passive: true });
    });
    var bar = document.querySelector('#embedui .emb-bar');
    // Entering or leaving full screen re-lays the page out and the page's idle clock starts again here, so the same fade runs in full screen as out of it.
    function fsChanged() { paintFull(); wake(); }
    document.addEventListener('fullscreenchange', fsChanged);
    document.addEventListener('webkitfullscreenchange', fsChanged);
    document.addEventListener('enterpictureinpicture', paintFloat, true);
    document.addEventListener('leavepictureinpicture', paintFloat, true);
    // The words: the system's i18n library and this page's catalog, loaded after the core started (English first).
    (function words() {
      var go = function () {
        if (!GifOS.i18n) return;
        GifOS.i18n.load('embed').then(function () { I18 = GifOS.i18n; applyWords(); }, function () {});
      };
      if (GifOS.i18n) go(); else if (GifOS.host && GifOS.host.loadScript) GifOS.host.loadScript('js/gifos-i18n.js').then(go, function () {});
    })();
    paint();
    wake();
    }
  }

  K.part(part);   // names at the first step; setup after the core's whole top level
})(typeof window !== 'undefined' ? window : globalThis);
