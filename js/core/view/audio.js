/*
 * GifOS Core: part "view" for run.html, the app runtime. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * run.html runs apps: an app on its own (#id=), an app room (a link with a code) and an app-first meeting (#app=.. and its room).
 * Its meeting view is audio only: who is here, your mic, Leave, and "Full meeting" (the same meeting on meet.html, with
 * video, the Stage and everything else). No tiles, no Stage, no broadcast. The meeting itself is the same signed core and
 * browser media plane as the meeting page, hosted through the shared view kit (js/core/view/kit.js):
 *   - a person is heard through a real element: makeTile hands the core a hidden tile with a real <video>, and the media
 *     plane plays its sound through that video's companion <audio> (busVolume), exactly as on the meeting page;
 *   - the mic button is a real element the media plane wires itself (micBtn: micTap), so mute is the plane's own;
 *   - Leave is the core's leaveMeeting; who is here and who is muted are the core's roster and status, read for drawing;
 *   - the app pane is the app runtime's (GifOS.runtime on #appmount) with its bar: name, Invite, Save, Help, Steal,
 *     abilities, Talk, Stop/Hide/Lead and full screen.
 * Every other name the core and the plane ask of the view is the kit's counted stand-in. Nothing here decides a rule:
 * who may run an app, who hosts, Talk on or off, the password and who is muted are the core's answers.
 */
(function (root) {
  'use strict';
  var GifOS = root.GifOS = root.GifOS || {};
  var K = GifOS.viewKit;
  if (!K || !GifOS.core || !(GifOS.coreParts || {}).core) return;

  function part(L) {
    var $ = function (id) { return document.getElementById(id); };
    var micBtn = $('mic'), statusEl = $('status'), appMountEl = $('appmount'), ears = $('ears');
    var H = K.host(L, { elements: { micBtn: micBtn } });
    var C = H.C, M = H.M, fn = H.fn;
    var body = document.body;
    var T = function (k, d) { try { return C.uiText(k, d); } catch (e) { return d; } };
    var me = function () { try { return C.model.me.myStatus() || {}; } catch (e) { return {}; } };
    var hasApp = function () { return body.classList.contains('has-app'); };

    // ---- the page this meeting opens in full (same snapshot, same hash, no app) -------------------------------------
    function fullHref() {
      var p = new URLSearchParams(location.hash.replace(/^#/, ''));
      ['app', 'id', 'go'].forEach(function (k) { p.delete(k); });
      // One link grammar (js/core/link.js): the address already names the room the way the meeting page joins it.
      // the name and picture were already chosen here: the meeting page does not ask again (same tab, same session)
      try { if (GifOS.store.identity().name) { sessionStorage.setItem('gifos_appear_ok', '1'); sessionStorage.setItem('gifos_appeared', '1'); } } catch (e) {}
      // the page beside this one: the document base (a snapshot pins it), not the address, which the meeting may move
      var base = new URL('.', document.baseURI);
      var ours = /(^|\.)gifos\.app$/.test(location.hostname) && base.pathname.indexOf('/versions/') !== -1;
      var page = 'meet';   // an app-first meeting's full view is the meeting page (a link names no view)
      return base.pathname + page + (ours ? '' : '.html') + location.search + '#' + p.toString();
    }

    // ---- people ---------------------------------------------------------------------------------------------------
    // A person's tile is real and hidden: its <video> carries their sound (the plane's companion <audio>).
    fn('makeTile', function (id, name, isMe, headless) {
      var tile = document.createElement('div');
      tile.className = 'ear' + (isMe ? ' me' : '');
      tile.hidden = true;
      tile.dataset.peer = id;
      var video = document.createElement('video');
      video.autoplay = true; video.playsInline = true; video.muted = true;
      var mk = function (cls) { var d = document.createElement('div'); d.className = cls; tile.appendChild(d); return d; };
      tile.appendChild(video);
      var label = document.createElement('span'); label.className = 'name'; label.textContent = name || '';
      tile.appendChild(label);
      var rec = { tile: tile, video: video, label: label, avatar: mk('avatar'), chips: mk('chips'), cap: mk('cap'), modbar: mk('modbar'), voteBtn: document.createElement('button') };
      if (!headless) ears.appendChild(tile);
      paintWho();
      return rec;
    });
    fn('paintTileOnGrid', function (t) { if (t && !t.isConnected) ears.appendChild(t); });

    function people() {
      var out = [], seen = new Set();
      var st = me();
      try { out.push({ id: C.myId, name: C.myName() || T('whoYou', 'You'), me: true, muted: !!st.muted }); seen.add(C.myId); } catch (e) {}
      var ids = [];
      try { ids = Array.from(C.rosterIds || []); } catch (e) {}
      try { C.peers.forEach(function (p, id) { ids.push(id); }); } catch (e) {}
      ids.forEach(function (id) {
        if (!id || seen.has(id)) return;
        seen.add(id);
        var p = null, s = null, nm = '';
        try { p = C.peers.get(id); s = C.statusOf.get(id); nm = (p && p.name) || (C.rosterNames && C.rosterNames[id]) || ''; } catch (e) {}
        out.push({ id: id, name: nm || '…', me: false, muted: !!(s && (s.muted || s.mic === false)) });
      });
      return out;
    }
    var whoSig = '';
    function paintWho() {
      var list = people();
      var sig = list.map(function (x) { return x.id + ':' + x.name + ':' + (x.muted ? 1 : 0); }).join('|');
      if (sig === whoSig) return;
      whoSig = sig;
      var ul = $('awho'), n = $('awho-n');
      ul.textContent = '';
      list.forEach(function (x) {
        var li = document.createElement('li');
        li.dataset.peer = x.id;
        li.className = (x.me ? 'me ' : '') + (x.muted ? 'muted' : 'live');
        li.textContent = x.name + (x.me ? ' ' + T('whoYou', '(you)') : '');
        li.title = x.muted ? T('muted', 'Muted') : T('micOn', 'Mic on');
        ul.appendChild(li);
      });
      var word = list.length + ' ' + (list.length === 1 ? T('person', 'person') : T('people', 'people')).toLowerCase();
      if (n.textContent !== word) n.textContent = word;
    }
    // every repaint the core asks of a people list or a control is this view's one people repaint
    H.paintsAll(['paintRoster', 'paintPeopleIfOpen', 'showWhoIfOpen', 'paintRaisedHands', 'paintAwayMark', 'paintTileChrome', 'renderHandq'], function () { paintWho(); });

    // the mic: the plane wires micBtn's tap (micTap); the view paints what the core says
    fn('paintControls', function () {
      var muted = !!me().muted, locked = false;
      try { locked = !!C.amGloballyMuted(); } catch (e) {}
      micBtn.classList.toggle('off', muted);
      micBtn.classList.toggle('locked', locked);
      micBtn.setAttribute('aria-pressed', muted ? 'false' : 'true');
      var w = locked ? T('micHeld', 'Muted') : muted ? T('unmute', 'Unmute') : T('mute', 'Mute');
      micBtn.setAttribute('aria-label', w);
      micBtn.title = muted ? 'You are muted — tap to speak' : 'Your mic is on — tap to mute';
      $('mic-word').textContent = w;
      paintWho();
    });

    // ---- the status line --------------------------------------------------------------------------------------------
    fn('paintStatusLine', function (s) {
      if (!s) return;
      if (statusEl.dataset.state !== s.state) statusEl.dataset.state = s.state || '';
      statusEl.dataset.kind = s.kind || '';
      var t = ((s.count || '') + ' ' + (s.rest || '')).replace(/^\s*·\s*/, '').replace(/\s+/g, ' ').trim();
      if (statusEl.textContent !== t) statusEl.textContent = t;
      statusEl.title = s.title || t;
      statusEl.classList.toggle('alert', !!s.alert);
      paintWho();
    });
    fn('paintStatusNotice', function (m, state, alert) {
      statusEl.textContent = String(m || ''); statusEl.title = String(m || '');
      statusEl.dataset.state = state || '';
      statusEl.classList.toggle('alert', !!alert);
    });
    fn('paintStatusAlert', function (on) { statusEl.classList.toggle('alert', !!on); });
    fn('paintTabTitle', function (t) { document.title = t; });
    fn('replaceAddress', function (url) { try { history.replaceState(null, '', url); } catch (e) {} });

    // ---- leaving, refusals: what a person here reads -------------------------------------------------------------
    fn('showLeftDialog', function () { $('left-modal').style.display = 'flex'; });
    function notice(title, text, full) {
      $('anote-title').textContent = title; $('anote-text').textContent = text;
      $('anote-full').hidden = !full; $('anote').style.display = 'flex';
    }
    // a locked room, a closed door, a refusal: the full meeting page carries the password prompt and the door's words
    fn('showPwModal', function (locked) {
      if (locked) notice(T('pwTitleLocked', 'This room is locked'), T('audioPwFull', 'Enter its password on the full meeting page.'), true);
    });
    fn('showClosedDialog', function () { notice(T('closedTitle', 'This meeting has ended'), '', false); });
    fn('showLoadRefusal', function (msg) { notice(T('stLoadIncompleteTitle', 'This page did not finish loading'), String(msg || ''), false); });

    // ---- the app runtime ------------------------------------------------------------------------------------------
    fn('appRuntimeBoot', function (fileId, withStatus, launch) { return GifOS.runtime.boot(appMountEl, fileId, withStatus ? statusEl : null, launch); });
    fn('appRuntimeClient', function (params) { return GifOS.runtime.bootClientBus(appMountEl, params, null, {}); });
    fn('paintSoloApp', function (on) {
      if (on) body.classList.add('solo-app');
      else { body.classList.remove('solo-app'); document.documentElement.classList.remove('solo-app'); }
      paintBar();
    });
    fn('paintAppWho', function (t) { $('appwho').textContent = t; });
    fn('paintAppRoomBody', function () { body.classList.add('app-room'); paintBar(); paintHelpTip(); });
    fn('paintCallOn', function () { body.classList.add('call-on'); paintBar(); });
    fn('paintCallBanner', function (live) {
      var b = $('callbanner');
      if (live > 0) { $('callbanner-txt').textContent = live + (live === 1 ? ' person is' : ' people are') + ' on the call in this room'; b.hidden = false; }
      else b.hidden = true;
    });
    $('callbanner-join').onclick = function () {
      C.act.surface({ callOn: true }); body.classList.add('call-on');
      $('callbanner').hidden = true;
      M.lateMedia('mic');
    };
    fn('showAppMissing', function (title, text) {
      var el = $('appmissing');
      el.querySelector('h1').textContent = title;
      el.querySelector('p').textContent = text;
      el.querySelector('a').textContent = T('appMissingHome', 'Go to Home Screen');
      el.hidden = false;
      body.classList.add('app-missing');
      document.title = title + ' — GifOS';
    });
    fn('hideAppMissing', function () { $('appmissing').hidden = true; body.classList.remove('app-missing'); });
    fn('setAppFavicon', setAppFavicon);
    function setAppFavicon(href, type) {
      if (!body.classList.contains('solo-app')) return;
      try {
        var link = document.createElement('link');
        link.rel = 'icon'; link.type = type || 'image/svg+xml';
        link.href = href || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E";
        document.querySelectorAll('link[rel~="icon"]').forEach(function (el) { el.remove(); });
        document.head.appendChild(link);
      } catch (e) {}
    }
    var appGifUrl = null;
    function setAppGif(bytes, name) {
      if (!bytes || !bytes.length) return;
      var img = $('appgif'), stripped = false, full = bytes;
      try { if (GifOS.gif && GifOS.gif.stripForDisplay) { bytes = GifOS.gif.stripForDisplay(bytes); stripped = true; } } catch (e) {}
      if (appGifUrl) { try { URL.revokeObjectURL(appGifUrl); } catch (e) {} }
      appGifUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/gif' }));
      img.src = appGifUrl; img.alt = name || 'App'; img.title = name || 'App';
      if (stripped) setAppFavicon(appGifUrl, 'image/gif');
      img.style.display = 'block';
      if (GifOS.viewKit && GifOS.viewKit.armAppGif) GifOS.viewKit.armAppGif(img, full, function () { var b = $('appsave'); if (b && b.style.display !== 'none') b.click(); });
    }
    fn('setAppGif', setAppGif);
    fn('paintAppGifFromLane', function () {
      if (!appGifUrl && C.appClientCtl && C.appClientCtl.gifBytes) {
        try { var b = C.appClientCtl.gifBytes(); if (b) setAppGif(b, $('appname').textContent); } catch (e) {}
      }
    });
    fn('showAppPane', function (name, who) {
      C.act.surface({ appPaneOn: true }); C.act.surface({ appPaneName: name || 'App' });
      body.classList.add('has-app');
      $('appname').textContent = name || 'App';
      $('appwho').textContent = who || '';
      paintInviteSlot();
      if (C.ROOM.appPinned) { $('appstop').style.display = 'none'; $('apphide').style.display = 'none'; }
      if (C.ROOM.kind === 'app') $('appsave').style.display = '';
      refreshStealBtn(); refreshAudioBtn(); paintBar(); paintHelpTip();
    });
    fn('clearAppView', function (why) {
      try { C.appEv('clear', { why: why || 'unstated' }); } catch (e) {}
      C.act.appUnmounted();   // the core stops the mount and drops its handles, mode and key (same intent as view.js)
      try { delete root.__appClientCtl; } catch (e) {}
      refreshStealBtn();
      appMountEl.innerHTML = '';
      C.act.surface({ appPaneOn: false });
      body.classList.remove('has-app');
      var ap = $('appperms'); if (ap) ap.style.display = 'none';
      paintBar(); paintHelpTip();
    });
    fn('updateAppButtons', function () {
      var st = me(), isMine = !!(st.app && C.appKey === st.app.s);
      var hideB = $('apphide'), stopB = $('appstop'), leadB = $('applead');
      hideB.style.display = (C.appKey && C.appMode !== 'watch' && !isMine) ? '' : 'none';
      var admin = false; try { admin = !!C.hasAdminRoom(); } catch (e) {}
      stopB.style.display = (isMine || !admin || C.amAdmin) ? '' : 'none';
      stopB.textContent = isMine ? T('stopApp', 'Stop app') : T('stopAppAll', 'Stop for everyone');
      if (C.ROOM.appPinned) { stopB.style.display = 'none'; hideB.style.display = 'none'; }
      leadB.style.display = (isMine && C.appLeadable) ? '' : 'none';
      leadB.textContent = C.appLeadOn ? T('barLeading', '👑 Leading') : T('barCommunal', 'Communal');
    });
    $('appstop').onclick = function () {
      var st = me();
      if (st.app && C.appKey === st.app.s) { C.stopApp(); return; }
      var want = C.findSharedApp();
      if (!want) return;
      if (C.hasAdminRoom() && !C.amAdmin) { C.setStatus(T('stOnlyThisRoomSAdmins2', '🛡 Only this room’s hosts can stop the shared app.')); return; }
      C.stopRoomApp(want);
    };
    $('apphide').onclick = function () {
      C.act.appHide();
    };
    $('applead').onclick = function () {
      C.act.appLead();
    };
    // TALK: the app host's switch on its app ad (the core's), read by everyone here
    function roomAudioOn() {
      if (!body.classList.contains('app-room')) return false;
      if (C.appMode === 'host') return !!(me().app && me().app.audio);
      var w = C.findSharedApp();
      return !!(w && w.audio);
    }
    fn('roomAudioOn', roomAudioOn);
    function refreshAudioBtn() {
      var b = $('appaudio');
      var show = C.ROOM.kind === 'app' && !C.ROOM.solo && body.classList.contains('app-room') && C.appMode === 'host' && !!me().app;
      b.style.display = show ? '' : 'none';
      var on = roomAudioOn();
      b.textContent = on ? T('barTalkOn', 'Talk: on') : T('barTalkOff', 'Talk: off');
      b.classList.toggle('on', on);
    }
    fn('refreshAudioBtn', refreshAudioBtn);
    fn('applyRoomAudio', function () {
      var on = roomAudioOn(), was = body.classList.contains('audio-on');
      body.classList.toggle('audio-on', on);
      if (!on && C.model.me.localStream()) {
        var tr = C.model.me.localStream().getAudioTracks()[0];
        if (tr && tr.enabled) { tr.enabled = false; me().muted = true; names.paintControls(); C.broadcastStatus(); }
      }
      if (was !== on) { refreshAudioBtn(); if (!on) C.setStatus(T('barTalkHostOff', 'The app host turned Talk off.')); }
      paintBar();
    });
    $('appaudio').onclick = function () {
      if (C.appMode !== 'host' || !me().app) return;
      me().app.audio = !me().app.audio;
      C.broadcastStatus();
      names.applyRoomAudio(); refreshAudioBtn();
    };
    function refreshStealBtn() { $('appsteal').style.display = (C.ROOM.kind === 'app' && C.appMode === 'client') ? '' : 'none'; }
    var savedUrl = '';
    // Save with the room's shared data, or a clean copy: the same two-choice sheet as every download. Nothing
    // shared yet = nothing to choose.
    function askDataChoice() {
      var st = null; try { st = C.appClientCtl.mirrorState && C.appClientCtl.mirrorState(); } catch (e) {}
      var has = !!(st && st.collections && Object.keys(st.collections).length);
      return (has && GifOS.lock && GifOS.lock.showSheet) ? GifOS.lock.showSheet('exportData', $('appname').textContent || 'App') : Promise.resolve('ok');
    }
    $('appsave').onclick = function () {
      if (C.model.apps.soloCtl() && C.ROOM.solo) C.model.apps.soloCtl().save();
      else if (C.appHostCtl) C.appHostCtl.save();
      else if (C.appClientCtl && C.appClientCtl.snapshot) askDataChoice().then(function (act) {
        if (act === 'cancel') return null;
        return C.appClientCtl.snapshot(act === 'alt' ? { clean: true } : undefined);
      }).then(function (bytes) {
        if (!bytes) return;
        // one snapshot link at a time: the previous one is let go when the next is made
        if (savedUrl) { try { URL.revokeObjectURL(savedUrl); } catch (e) {} }
        var a = document.createElement('a');
        a.href = savedUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/gif' }));
        a.download = ($('appname').textContent || 'app') + '-snapshot.gif';
        a.click();
      }).catch(function (e) { C.setStatus(T('barSaveFail', 'Could not save: {err}').split('{err}').join(e && e.message || e)); });
    };
    // Steal is two wants (the game and its scoreboard, or the game alone): the first press asks which, on the button
    // itself; the confirmation stays where the finger is.
    $('appsteal').onclick = function () {
      if (!(C.appClientCtl && C.appClientCtl.stealToDesktop)) return;
      var b = $('appsteal');
      if (b.dataset.armed) return;
      b.dataset.armed = '1';
      var label = b.textContent, picks = [];
      var fold = function () { delete b.dataset.armed; picks.forEach(function (x) { x.remove(); }); b.style.display = ''; };
      var go = function (data, btn) {
        picks.forEach(function (x) { x.disabled = true; });
        btn.textContent = T('stealBusy', 'Stealing…');
        C.appClientCtl.stealToDesktop({ data: data }).then(function () {
          fold();
          b.textContent = T('stealDone', '🥷 Stolen ✓'); b.disabled = true;
          C.setStatus(data === 'none' ? T('stealNone', '🥷 Yours now — a clean copy in your desktop’s Stolen Apps, none of the room’s data.')
            : data === 'connect' ? T('stealConnect', '🥷 Yours now — the room as it stood when you joined, in your Stolen Apps.')
              : T('stealAll', '🥷 Yours now — saved to your desktop’s Stolen Apps, data and all.'));
          setTimeout(function () { b.textContent = label; b.disabled = false; }, GifOS.timings.APP_STEAL_DONE_MS);
        }).catch(function (e) { fold(); C.setStatus(T('stealFail', 'Could not steal: {err}').split('{err}').join(e && e.message || e)); });
      };
      var mk = function (txt, title, data) {
        var x = document.createElement('button');
        x.textContent = txt; x.title = title; x.className = b.className; x.dataset.steal = data; x.style.fontSize = '16px';
        x.onclick = function () { go(data, x); };
        b.parentNode.insertBefore(x, b.nextSibling);
        picks.push(x);
        return x;
      };
      b.style.display = 'none';
      // each lands at b.nextSibling: reads left to right as + data · as I joined · app only
      mk(T('stealApp', 'without data'), T('stealAppTip', 'A clean copy — the app alone, none of the room’s data'), 'none');
      mk(T('stealJoined', 'as I joined'), T('stealJoinedTip', 'The app and the room as it stood when you came in'), 'connect');
      mk(T('stealData', 'with data'), T('stealDataTip', 'The app and everything in it right now'), 'current');
    };
    function openAppHelp() {
      var Hl = GifOS.help;
      var name = ($('appname').textContent || '').trim();
      var md = (Hl && Hl.withOsFooter) ? Hl.withOsFooter(C.currentAppHelpMd(), C.currentAppCredits(), { from: 'app Help window', name: name }) : (C.currentAppHelpMd() || '');
      var parsed = (Hl && Hl.parse) ? Hl.parse(md) : { title: '', html: '' };
      $('apphelp-title').textContent = parsed.title || name || 'Help';
      var bodyEl = $('apphelp-body');
      bodyEl.innerHTML = parsed.html || ((Hl && Hl.render) ? Hl.render(md) : '');
      if (!bodyEl.innerHTML) bodyEl.textContent = md;
      $('apphelp-modal').style.display = 'flex';
    }
    $('apphelp').onclick = function () { if (!(C.model.apps.soloCtl() || C.appHostCtl || C.appClientCtl) && !C.ROOM.solo) $('help-modal').style.display = 'flex'; else openAppHelp(); };
    $('help-close').onclick = function () { $('help-modal').style.display = 'none'; };
    // The room's own explainer (the meeting page's applyRoomHelp, app room): this page's room is an app room or an
    // app-first meeting, voice only, and its view has no chat.
    // Help's line says what this page is: an app room keeps its room story after the app is up; a solo app is the app.
    function paintHelpTip() {
      var el = $('apphelp'); if (!el) return;
      var appRoom = (C.ROOM.kind === 'app' && !C.ROOM.solo) || body.classList.contains('app-room');
      el.title = appRoom ? T('appHelpTitle', 'How this app room works') : hasApp() ? T('appHelpTip', 'How this app works') : T('helpTitle', 'How this meeting works');
    }
    fn('paintHelpTip', paintHelpTip);
    fn('applyRoomHelp', function () {
      paintHelpTip();
      var h3 = document.querySelector('#help-modal h3'), hs = document.querySelector('#help-modal .help-scroll');
      if (C.ROOM.kind === 'app') {
        h3.textContent = T('appHelpTitle', 'How this app room works');
        hs.innerHTML = '<p class="help-lead">This room exists around a <b>shared app</b>: everyone here sees and uses the <b>same live app together</b> — moves, edits and state flow between every phone directly.</p>'
          + '<h4>The app is the show</h4><ul class="help-list">'
          + '<li>The app fills the screen. One person <b>hosts</b> it (their device runs its engine); everyone else interacts live.</li>'
          + '<li>If the host drops off, what happens is the room’s choice at creation: an <b>owned</b> app pauses until its owner returns; a <b>resilient</b> one lets a friend still here take over hosting.</li></ul>'
          + '<h4>No camera</h4><ul class="help-list">'
          + '<li>This room has <b>no camera and no video</b>. Nothing here is blurred, because there is no picture to blur.</li>'
          + '<li><b>Talk</b>, when the host turns it on, is voice only.</li></ul>'
          + '<h4>Invites</h4><ul class="help-list"><li><b>Invite</b> copies the one link that brings a friend straight in. The link is the whole key — share it deliberately.</li></ul>'
          + '<p>Underneath it is the same thing as a GifOS Meeting: everything goes straight between the people here, no accounts, no limit on how many.</p>';
      } else {
        h3.textContent = T('helpTitle', 'How this meeting works');
        hs.innerHTML = '<p class="help-lead">This is a <b>voice</b> view of the meeting, beside the app you are running. <b>Full meeting</b> opens the same meeting with video, the Stage and chat.</p>';
      }
    });
    // ---- THE EMPTY APP ROOM (#appwait), as on the meeting page: a guest opening an app invite gets the app from
    // whoever in the room holds it. Seated with no app: a spinner, then which piece is missing (the invite is dormant,
    // or its host is away). Never for a founder, never over a live call.
    var appWaitEl = null, appWaitSince = 0;
    function appWaitTick() {
      var kill = function () { appWaitSince = 0; if (appWaitEl) { appWaitEl.remove(); appWaitEl = null; } };
      if (!C.ROOM.appPinned || C.ROOM.solo || !C.model.room.sessId()) return kill();
      if (body.classList.contains('has-app') || C.appKey || me().app || body.classList.contains('call-on')) return kill();
      var now = Date.now();
      if (!appWaitSince) { appWaitSince = now; return; }
      if (now - appWaitSince < GifOS.timings.APP_WAIT_SHOW_MS) return;
      if (!appWaitEl) {
        appWaitEl = document.createElement('div');
        appWaitEl.id = 'appwait';
        appWaitEl.innerHTML = '<div class="jv-box"><div class="jv-spin"></div><h3 id="aw-t">Looking for the app…</h3><p id="aw-p">You’re in the room. The app comes over from whoever is sharing it.</p></div>';
        body.appendChild(appWaitEl);
      }
      if (now - appWaitSince < GifOS.timings.APP_WAIT_SAY_MS) return;
      var spin = appWaitEl.querySelector('.jv-spin'); if (spin) spin.remove();
      var others = 0;
      C.model.roster.statusOf().forEach(function (st, pid) { if (String(pid) !== String(C.model.me.myId())) others++; });
      if (appWaitEl.dataset.said === String(others)) return;
      appWaitEl.dataset.said = String(others);
      if (others > 0) {
        appWaitEl.querySelector('#aw-t').textContent = 'The app’s host isn’t here';
        appWaitEl.querySelector('#aw-p').textContent = (others === 1 ? 'One other person is' : others + ' other people are')
          + ' waiting here too, but the friend who hosts the app isn’t right now. The app appears the moment they open it again — this link stays good.';
      } else {
        appWaitEl.querySelector('#aw-t').textContent = 'This invite isn’t live right now';
        appWaitEl.querySelector('#aw-p').innerHTML = 'An app invite works while the friend who shared it has the app open — the app comes from their device, not from a server. Nobody is in the room, so the link has gone quiet. Ask them to open the app and share it again: the same link comes back to life.'
          + '<a class="aw-home" href="/" target="_blank" rel="noopener">Meanwhile, get GifOS — and apps of your own</a>';
      }
    }
    $('apphelp-close').onclick = function () { $('apphelp-modal').style.display = 'none'; };
    (function wireAppFull() {
      var fb = $('appfull'), FS = GifOS.fullscreen;
      if (FS && FS.supported()) {
        var repaint = FS.attach(fb, document.documentElement, { fill: 'app-full', fillIf: hasApp, words: true, enterLabel: T('fullScreen', 'Full screen'), exitLabel: T('leaveFullScreen', 'Leave full screen') });
        // the app bar keeps the glyph while an app is up: repaint on every body class change, as the meeting page does
        if (repaint && root.MutationObserver) { try { new MutationObserver(function () { try { repaint(); } catch (e) {} }).observe(body, { attributes: true, attributeFilter: ['class'] }); } catch (e) {} }
        return;
      }
      fb.style.display = 'none';
    })();
    if (GifOS.perms) GifOS.perms.attach($('appperms'), { onLeave: function () { C.stopApp(); }, skipCaps: function () { return C.appMode === 'client' ? ['stage'] : []; } });
    // An app may ask to put you on the Stage; this page has none, so it asks nothing and the core keeps you off it.
    fn('appStageAsk', function () {});
    fn('appStageAskClose', function () {});
    fn('foldBarForApp', function () {});
    fn('appCopyPaint', function () {
      var el = $('appcopy'), cp = C.model.apps.appCopy();
      cp.paintedAt = Date.now();
      var done = appMountEl.querySelector('iframe') || C.appMode !== 'client';
      var big = null;
      // the core's defrag sweeps a stream that stopped; the largest one still coming is the one shown
      if (!done) cp.streams.forEach(function (s) { if (!big || s.n > big.n) big = s; });
      if (done || !big) { if (el) el.remove(); if (done) { cp.streams.clear(); cp.fid = null; } cp.shown = 0; return; }
      var box = el || (function () { var d = document.createElement('div'); d.id = 'appcopy'; appMountEl.appendChild(d); return d; })();
      var pct = Math.max(1, Math.min(99, Math.round((big.got / big.n) * 100)));
      box.textContent = big.got >= big.n ? 'Opening ' + ($('appname').textContent || 'the app') + '…' : 'Copying ' + ($('appname').textContent || 'the app') + ' — ' + pct + '%';
    });
    var scriptOnce = {};
    fn('loadScriptOnce', function (src) {
      if (!scriptOnce[src]) scriptOnce[src] = new Promise(function (res, rej) { var el = document.createElement('script'); el.src = src; el.onload = function () { res(); }; el.onerror = function () { delete scriptOnce[src]; rej(new Error('load ' + src)); }; document.head.appendChild(el); });
      return scriptOnce[src];
    });
    var aop = null;   // the app-owner module, loaded once, from this page's js/ folder
    fn('sgaAppOwner', function () {
      if (GifOS.appOwner) return Promise.resolve(GifOS.appOwner);
      if (!aop) aop = names.loadScriptOnce('js/app-owner.js').then(function () { if (GifOS.appOwner) return GifOS.appOwner; throw new Error('app-owner.js empty'); }, function (e) { aop = null; throw e; });
      return aop;
    });
    fn('newCanvas', function () { return document.createElement('canvas'); });
    fn('chatPanelOpen', function () { return false; });
    // the media plane's popovers (its microphone chooser) open above the control they belong to
    fn('placeDockPopover', function (el, anchor) {
      if (!el || !anchor || !el.getClientRects().length) return null;
      var a = anchor.getBoundingClientRect(), pad = 8, w = el.offsetWidth, h = el.offsetHeight;
      var left = Math.max(pad, Math.min(window.innerWidth - w - pad, a.left + a.width / 2 - w / 2));
      var top = a.top - h - pad >= pad ? a.top - h - pad : Math.min(window.innerHeight - h - pad, a.bottom + pad);
      el.style.left = Math.round(left) + 'px'; el.style.top = Math.round(Math.max(pad, top)) + 'px';
      el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.transform = 'none'; el.style.margin = '0';
      return top < a.top ? 'above' : 'below';
    });

    // ---- Invite: the room's link ------------------------------------------------------------------------------------
    var shareLink = '';
    fn('paintShareUrl', function (link) { shareLink = String(link || ''); $('share-url').value = shareLink; });
    fn('inviteLinkForModal', function () {
      if (C.ROOM.kind !== 'app' && !body.classList.contains('app-room')) { try { var v = C.viewerShareUrl(); if (v) return v; } catch (e) {} }
      return shareLink;
    });
    function showInvite() {
      var link = names.inviteLinkForModal();
      $('share-url').value = link;
      $('inv-modal').style.display = link ? 'flex' : 'none';
    }
    fn('showInviteModal', showInvite);
    fn('showShareLink', function () { if (C.ROOM.kind === 'app') showInvite(); });
    function paintInviteSlot() {
      var btn = $('appinvite'), show = false;
      if (C.ROOM.solo) show = C.model.chat.soloShare() === true;
      else if (C.ROOM.kind === 'app' && C.ROOM.founder) show = true;
      else if (!body.classList.contains('app-room')) show = true;
      btn.style.display = show ? '' : 'none';
    }
    fn('paintInviteSlot', paintInviteSlot);
    $('appinvite').onclick = function () {
      if (C.ROOM.solo) {
        var P = root.GifOSPreflight;
        if (P && typeof P.requireMeeting === 'function') P.requireMeeting(C.inviteFromSolo); else C.inviteFromSolo();
        return;
      }
      showInvite();
    };
    // "Share <app> live" (Invite from a solo app): who may host it while I am away and, for an app that already has a
    // link, keep that link or start a fresh one. The choice goes to the core's go(owned, fresh).
    fn('openShareLiveModal', function (nm, saved, go) {
      var esc = K.esc;
      var bg = document.createElement('div'); bg.className = 'name-modal'; bg.id = 'sharelive';
      bg.innerHTML = '<div class="name-box" style="max-width:440px;text-align:left"><h3>Share ' + esc(nm) + ' live</h3>' +
        '<p>Friends join you with one link. If you drop off (close the tab, lose battery)…</p>' +
        '<label class="perm-row"><input type="radio" name="rmcls" value="owned"' + (!saved || saved.owned ? ' checked' : '') + '><span><b>Only I can host it</b> — the app pauses for everyone until I return. Safest for private data.</span></label>' +
        '<label class="perm-row"><input type="radio" name="rmcls" value="heal"' + (saved && !saved.owned ? ' checked' : '') + '><span><b>Let a friend keep it going</b> — someone still connected takes over hosting. Best for casual shared apps and games.</span></label>' +
        (saved
          ? '<p style="margin-top:.9rem"><b>This app already has a link</b> — friends you invited before may still hold it.</p>' +
            '<label class="perm-row"><input type="radio" name="rmlink" value="same" checked><span><b>Keep the same link</b> — everyone you already invited can come right back.</span></label>' +
            '<label class="perm-row"><input type="radio" name="rmlink" value="fresh"><span><b>Start a fresh link</b> — the old link goes dead for good. For when it reached someone it shouldn’t have.</span></label>'
          : '') +
        '<div style="display:flex;gap:.6rem;justify-content:flex-end;margin-top:1rem"><button id="inv-cancel" type="button">Cancel</button><button id="inv-go" type="button">Create link</button></div></div>';
      bg.style.display = 'flex';
      body.appendChild(bg);
      bg.querySelector('#inv-cancel').onclick = function () { bg.remove(); };
      bg.querySelector('#inv-go').onclick = function () {
        var owned = bg.querySelector('input[name="rmcls"]:checked').value === 'owned';
        var fresh = !!(saved && bg.querySelector('input[name="rmlink"][value="fresh"]').checked);
        bg.remove();
        go(owned, fresh);
      };
    });
    $('inv-copy').onclick = function () {
      var v = $('share-url').value;
      try { navigator.clipboard.writeText(v).then(function () { $('inv-copy').textContent = T('invCopied', 'Copied'); }, function () {}); } catch (e) {}
    };
    $('inv-done').onclick = function () { $('inv-modal').style.display = 'none'; };

    // ---- the audio bar ------------------------------------------------------------------------------------------------
    // It shows while this page is in a meeting: an app-first meeting always, an app room once its call is on or Talk is.
    function inMeeting() {
      if (C.ROOM.solo) return false;
      // an app room's call is the host's Talk switch: with Talk off every mic is quiet and the control folds away
      if (C.ROOM.kind === 'app') return body.classList.contains('audio-on');
      return true;
    }
    function paintBar() {
      var on = inMeeting();
      $('abar').hidden = !on;
      $('afull').hidden = C.ROOM.kind === 'app';
      body.classList.toggle('abar-on', on);
      paintAbarH();
    }
    // the version label sits just above the bar, bottom-left (css/run.css), so it never lies on the app's own top bar buttons
    var abarH = '';
    function paintAbarH() {
      var h = $('abar').hidden ? 0 : $('abar').offsetHeight, v = h + 'px';
      if (v !== abarH) { abarH = v; document.documentElement.style.setProperty('--abar-h', v); }
    }
    try { new ResizeObserver(paintAbarH).observe($('abar')); } catch (e) { root.addEventListener('resize', paintAbarH); }
    $('afull').onclick = function (e) { e.preventDefault(); location.href = fullHref(); };
    $('anote-full').onclick = function (e) { e.preventDefault(); location.href = fullHref(); };
    $('anote-close').onclick = function () { $('anote').style.display = 'none'; };
    $('awho-btn').onclick = function () { var w = $('awho'); w.hidden = !w.hidden; $('awho-btn').setAttribute('aria-expanded', w.hidden ? 'false' : 'true'); };
    $('leavebtn').onclick = function () { C.leaveMeeting(); };
    $('left-rejoin').onclick = function () { location.reload(); };
    $('left-close').onclick = function () { location.href = C.homeHref(); };

    var names = H.finish();
    return {
      names: names,
      setup: function () {
        paintBar(); paintWho();
        try { names.paintControls(); } catch (e) {}
        try { names.applyRoomHelp(); } catch (e) {}
        setInterval(appWaitTick, GifOS.timings.APP_ROOM_BEAT_MS);   // the app room's beat
        root.__gifosAudioView = { people: people, fullHref: fullHref, standIns: names.standInsForTest };
      },
    };
  }

  K.part(part);
})(typeof window !== 'undefined' ? window : globalThis);
