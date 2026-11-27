/*
 * GifOS Core: the meeting, part "view". Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 * Lifted from the meeting page by the core lift (stamp d49d42da).
 * The statements below are the meeting page's own, in the page's order. A name another part owns is read
 * through that part (__C the core, __M the media plane, __V the view). The linker is host.js.
 */
(function (root) {
  var GifOS = root.GifOS = root.GifOS || {};
  function* part(__L) {
    var __C = __L.core, __M = __L.media, __V = __L.view;
    Object.defineProperties(__L.view, {
      "appCopyPaint": { get: function () { return appCopyPaint; }, enumerable: true, configurable: true },
      "appRuntimeBoot": { get: function () { return appRuntimeBoot; }, enumerable: true, configurable: true },
      "appRuntimeClient": { get: function () { return appRuntimeClient; }, enumerable: true, configurable: true },
      "appStageAsk": { get: function () { return appStageAsk; }, enumerable: true, configurable: true },
      "appStageAskClose": { get: function () { return appStageAskClose; }, enumerable: true, configurable: true },
      "applyAdminUi": { get: function () { return applyAdminUi; }, enumerable: true, configurable: true },
      "applyChrome": { get: function () { return applyChrome; }, enumerable: true, configurable: true },
      "applyHeaderChoice": { get: function () { return applyHeaderChoice; }, enumerable: true, configurable: true },
      "applyRoomAudio": { get: function () { return applyRoomAudio; }, enumerable: true, configurable: true },
      "applyRoomHelp": { get: function () { return applyRoomHelp; }, enumerable: true, configurable: true },
      "applyViewerCrops": { get: function () { return applyViewerCrops; }, enumerable: true, configurable: true },
      "armMeetDialogs": { get: function () { return armMeetDialogs; }, enumerable: true, configurable: true },
      "atPwPrompt": { get: function () { return atPwPrompt; }, enumerable: true, configurable: true },
      "audioDump": { get: function () { return audioDump; }, enumerable: true, configurable: true },
      "awayFull": { get: function () { return awayFull; }, enumerable: true, configurable: true },
      "backGuardDrop": { get: function () { return backGuardDrop; }, enumerable: true, configurable: true },
      "blurA": { get: function () { return blurA; }, set: function (v) { blurA = v; }, enumerable: true, configurable: true },
      "blurActx": { get: function () { return blurActx; }, set: function (v) { blurActx = v; }, enumerable: true, configurable: true },
      "blurB": { get: function () { return blurB; }, set: function (v) { blurB = v; }, enumerable: true, configurable: true },
      "blurBctx": { get: function () { return blurBctx; }, set: function (v) { blurBctx = v; }, enumerable: true, configurable: true },
      "blurNote": { get: function () { return blurNote; }, enumerable: true, configurable: true },
      "bootMeetSession": { get: function () { return bootMeetSession; }, enumerable: true, configurable: true },
      "bridgeAgentToPage": { get: function () { return bridgeAgentToPage; }, enumerable: true, configurable: true },
      "camBtn": { get: function () { return camBtn; }, enumerable: true, configurable: true },
      "capCardRefresh": { get: function () { return capCardRefresh; }, enumerable: true, configurable: true },
      "capLangAsk": { get: function () { return capLangAsk; }, enumerable: true, configurable: true },
      "capPaint": { get: function () { return capPaint; }, enumerable: true, configurable: true },
      "capSourceOpen": { get: function () { return capSourceOpen; }, enumerable: true, configurable: true },
      "carryIo": { get: function () { return carryIo; }, enumerable: true, configurable: true },
      "ccDockBtn": { get: function () { return ccDockBtn; }, enumerable: true, configurable: true },
      "chatPanel": { get: function () { return chatPanel; }, enumerable: true, configurable: true },
      "chatPanelOpen": { get: function () { return chatPanelOpen; }, enumerable: true, configurable: true },
      "chatTrace": { get: function () { return chatTrace; }, enumerable: true, configurable: true },
      "clearAdminClose": { get: function () { return clearAdminClose; }, enumerable: true, configurable: true },
      "clearAppView": { get: function () { return clearAppView; }, enumerable: true, configurable: true },
      "closeFsView": { get: function () { return closeFsView; }, enumerable: true, configurable: true },
      "closeMoreForWait": { get: function () { return closeMoreForWait; }, enumerable: true, configurable: true },
      "closeTileWin": { get: function () { return closeTileWin; }, enumerable: true, configurable: true },
      "comfyStadMeta": { get: function () { return comfyStadMeta; }, enumerable: true, configurable: true },
      "comfyStadRoster": { get: function () { return comfyStadRoster; }, enumerable: true, configurable: true },
      "countClosedChat": { get: function () { return countClosedChat; }, enumerable: true, configurable: true },
      "ctAgendaOpen": { get: function () { return ctAgendaOpen; }, enumerable: true, configurable: true },
      "ctAppInfo": { get: function () { return ctAppInfo; }, enumerable: true, configurable: true },
      "ctInit": { get: function () { return ctInit; }, enumerable: true, configurable: true },
      "ctPaintAgendaBtn": { get: function () { return ctPaintAgendaBtn; }, enumerable: true, configurable: true },
      "ctPaintBar": { get: function () { return ctPaintBar; }, enumerable: true, configurable: true },
      "ctPresent": { get: function () { return ctPresent; }, enumerable: true, configurable: true },
      "dbgMeterShow": { get: function () { return dbgMeterShow; }, enumerable: true, configurable: true },
      "dbgMeters": { get: function () { return dbgMeters; }, enumerable: true, configurable: true },
      "dropStaleShareWin": { get: function () { return dropStaleShareWin; }, enumerable: true, configurable: true },
      "emitLiveTranscript": { get: function () { return emitLiveTranscript; }, enumerable: true, configurable: true },
      "enterPip": { get: function () { return enterPip; }, enumerable: true, configurable: true },
      "explainHeldVideo": { get: function () { return explainHeldVideo; }, enumerable: true, configurable: true },
      "foldBarForApp": { get: function () { return foldBarForApp; }, enumerable: true, configurable: true },
      "frozenTileSkip": { get: function () { return frozenTileSkip; }, enumerable: true, configurable: true },
      "fsFitPaint": { get: function () { return fsFitPaint; }, enumerable: true, configurable: true },
      "fsFollowTalk": { get: function () { return fsFollowTalk; }, enumerable: true, configurable: true },
      "fsRefreshIfOpen": { get: function () { return fsRefreshIfOpen; }, enumerable: true, configurable: true },
      "handBtn": { get: function () { return handBtn; }, enumerable: true, configurable: true },
      "hideAppMissing": { get: function () { return hideAppMissing; }, enumerable: true, configurable: true },
      "hideCaptions": { get: function () { return hideCaptions; }, enumerable: true, configurable: true },
      "hideDialogs": { get: function () { return hideDialogs; }, enumerable: true, configurable: true },
      "hideJoinPwModal": { get: function () { return hideJoinPwModal; }, enumerable: true, configurable: true },
      "hideResharePrompt": { get: function () { return hideResharePrompt; }, enumerable: true, configurable: true },
      "hostBotCard": { get: function () { return hostBotCard; }, enumerable: true, configurable: true },
      "inviteLinkForModal": { get: function () { return inviteLinkForModal; }, enumerable: true, configurable: true },
      "islandNoteTick": { get: function () { return islandNoteTick; }, enumerable: true, configurable: true },
      "keysModal": { get: function () { return keysModal; }, enumerable: true, configurable: true },
      "layout": { get: function () { return layout; }, enumerable: true, configurable: true },
      "lgLeave": { get: function () { return lgLeave; }, enumerable: true, configurable: true },
      "loadScriptOnce": { get: function () { return loadScriptOnce; }, enumerable: true, configurable: true },
      "lobbyPwOpenRoom": { get: function () { return lobbyPwOpenRoom; }, enumerable: true, configurable: true },
      "makeTile": { get: function () { return makeTile; }, enumerable: true, configurable: true },
      "massBannerTick": { get: function () { return massBannerTick; }, enumerable: true, configurable: true },
      "micBtn": { get: function () { return micBtn; }, enumerable: true, configurable: true },
      "newCanvas": { get: function () { return newCanvas; }, enumerable: true, configurable: true },
      "openBlurWhy": { get: function () { return openBlurWhy; }, enumerable: true, configurable: true },
      "openFsView": { get: function () { return openFsView; }, enumerable: true, configurable: true },
      "openShareLiveModal": { get: function () { return openShareLiveModal; }, enumerable: true, configurable: true },
      "openStageAdjust": { get: function () { return openStageAdjust; }, enumerable: true, configurable: true },
      "openTileWin": { get: function () { return openTileWin; }, enumerable: true, configurable: true },
      "paintAirKind": { get: function () { return paintAirKind; }, enumerable: true, configurable: true },
      "paintAloneCard": { get: function () { return paintAloneCard; }, enumerable: true, configurable: true },
      "paintAppGifFromLane": { get: function () { return paintAppGifFromLane; }, enumerable: true, configurable: true },
      "paintAppRoomBody": { get: function () { return paintAppRoomBody; }, enumerable: true, configurable: true },
      "paintAppWho": { get: function () { return paintAppWho; }, enumerable: true, configurable: true },
      "paintAssistant": { get: function () { return paintAssistant; }, enumerable: true, configurable: true },
      "paintAudienceReacts": { get: function () { return paintAudienceReacts; }, enumerable: true, configurable: true },
      "paintAvatarImg": { get: function () { return paintAvatarImg; }, enumerable: true, configurable: true },
      "paintAwayMark": { get: function () { return paintAwayMark; }, enumerable: true, configurable: true },
      "paintBcQuiet": { get: function () { return paintBcQuiet; }, enumerable: true, configurable: true },
      "paintBlurWhy": { get: function () { return paintBlurWhy; }, enumerable: true, configurable: true },
      "paintBotEyes": { get: function () { return paintBotEyes; }, enumerable: true, configurable: true },
      "paintBotView": { get: function () { return paintBotView; }, enumerable: true, configurable: true },
      "paintBroadcastChrome": { get: function () { return paintBroadcastChrome; }, enumerable: true, configurable: true },
      "paintBroadcastIdent": { get: function () { return paintBroadcastIdent; }, enumerable: true, configurable: true },
      "paintBroadcastJoinNote": { get: function () { return paintBroadcastJoinNote; }, enumerable: true, configurable: true },
      "paintBroadcastRole": { get: function () { return paintBroadcastRole; }, enumerable: true, configurable: true },
      "paintBroadcastSeats": { get: function () { return paintBroadcastSeats; }, enumerable: true, configurable: true },
      "paintCallBanner": { get: function () { return paintCallBanner; }, enumerable: true, configurable: true },
      "paintCallOn": { get: function () { return paintCallOn; }, enumerable: true, configurable: true },
      "paintCallState": { get: function () { return paintCallState; }, enumerable: true, configurable: true },
      "paintCcLocal": { get: function () { return paintCcLocal; }, enumerable: true, configurable: true },
      "paintCcState": { get: function () { return paintCcState; }, enumerable: true, configurable: true },
      "paintCcView": { get: function () { return paintCcView; }, enumerable: true, configurable: true },
      "paintChatBadge": { get: function () { return paintChatBadge; }, enumerable: true, configurable: true },
      "paintChatBtn": { get: function () { return paintChatBtn; }, enumerable: true, configurable: true },
      "paintChatCount": { get: function () { return paintChatCount; }, enumerable: true, configurable: true },
      "paintChatGate": { get: function () { return paintChatGate; }, enumerable: true, configurable: true },
      "paintChatNew": { get: function () { return paintChatNew; }, enumerable: true, configurable: true },
      "paintChipBottom": { get: function () { return paintChipBottom; }, enumerable: true, configurable: true },
      "paintControls": { get: function () { return paintControls; }, enumerable: true, configurable: true },
      "paintFaders": { get: function () { return paintFaders; }, enumerable: true, configurable: true },
      "paintFit": { get: function () { return paintFit; }, enumerable: true, configurable: true },
      "paintHand": { get: function () { return paintHand; }, enumerable: true, configurable: true },
      "paintHelpTip": { get: function () { return paintHelpTip; }, enumerable: true, configurable: true },
      "paintInviteSlot": { get: function () { return paintInviteSlot; }, enumerable: true, configurable: true },
      "paintJoinVeil": { get: function () { return paintJoinVeil; }, enumerable: true, configurable: true },
      "paintLiveBadge": { get: function () { return paintLiveBadge; }, enumerable: true, configurable: true },
      "paintMyAvatarPreview": { get: function () { return paintMyAvatarPreview; }, enumerable: true, configurable: true },
      "paintOnAirBadge": { get: function () { return paintOnAirBadge; }, enumerable: true, configurable: true },
      "paintOnAirSide": { get: function () { return paintOnAirSide; }, enumerable: true, configurable: true },
      "paintPeopleIfOpen": { get: function () { return paintPeopleIfOpen; }, enumerable: true, configurable: true },
      "paintProgressSteps": { get: function () { return paintProgressSteps; }, enumerable: true, configurable: true },
      "paintQaBand": { get: function () { return paintQaBand; }, enumerable: true, configurable: true },
      "paintRaisedHands": { get: function () { return paintRaisedHands; }, enumerable: true, configurable: true },
      "paintRb": { get: function () { return paintRb; }, enumerable: true, configurable: true },
      "paintRbNow": { get: function () { return paintRbNow; }, enumerable: true, configurable: true },
      "paintRoomTitle": { get: function () { return paintRoomTitle; }, enumerable: true, configurable: true },
      "paintRoomTrust": { get: function () { return paintRoomTrust; }, enumerable: true, configurable: true },
      "paintRoster": { get: function () { return paintRoster; }, enumerable: true, configurable: true },
      "paintShare": { get: function () { return paintShare; }, enumerable: true, configurable: true },
      "paintShareUrl": { get: function () { return paintShareUrl; }, enumerable: true, configurable: true },
      "paintSoloApp": { get: function () { return paintSoloApp; }, enumerable: true, configurable: true },
      "paintSpkBtn": { get: function () { return paintSpkBtn; }, enumerable: true, configurable: true },
      "paintStadiumTile": { get: function () { return paintStadiumTile; }, enumerable: true, configurable: true },
      "paintStage": { get: function () { return paintStage; }, enumerable: true, configurable: true },
      "paintStageBlurWhy": { get: function () { return paintStageBlurWhy; }, enumerable: true, configurable: true },
      "paintStageMod": { get: function () { return paintStageMod; }, enumerable: true, configurable: true },
      "paintStagePlate": { get: function () { return paintStagePlate; }, enumerable: true, configurable: true },
      "paintStageVoteTargets": { get: function () { return paintStageVoteTargets; }, enumerable: true, configurable: true },
      "paintStatusAlert": { get: function () { return paintStatusAlert; }, enumerable: true, configurable: true },
      "paintStatusLine": { get: function () { return paintStatusLine; }, enumerable: true, configurable: true },
      "paintStatusNotice": { get: function () { return paintStatusNotice; }, enumerable: true, configurable: true },
      "paintStatusSheet": { get: function () { return paintStatusSheet; }, enumerable: true, configurable: true },
      "paintStatusWhy": { get: function () { return paintStatusWhy; }, enumerable: true, configurable: true },
      "paintStreamLink": { get: function () { return paintStreamLink; }, enumerable: true, configurable: true },
      "paintTabTitle": { get: function () { return paintTabTitle; }, enumerable: true, configurable: true },
      "paintTileChrome": { get: function () { return paintTileChrome; }, enumerable: true, configurable: true },
      "paintTileOnGrid": { get: function () { return paintTileOnGrid; }, enumerable: true, configurable: true },
      "paintTranscriptControls": { get: function () { return paintTranscriptControls; }, enumerable: true, configurable: true },
      "paintTxMark": { get: function () { return paintTxMark; }, enumerable: true, configurable: true },
      "paintVq": { get: function () { return paintVq; }, enumerable: true, configurable: true },
      "paintWaitDoor": { get: function () { return paintWaitDoor; }, enumerable: true, configurable: true },
      "paintWaitingSelf": { get: function () { return paintWaitingSelf; }, enumerable: true, configurable: true },
      "paintWspChip": { get: function () { return paintWspChip; }, enumerable: true, configurable: true },
      "paintWspStatus": { get: function () { return paintWspStatus; }, enumerable: true, configurable: true },
      "pauseNote": { get: function () { return pauseNote; }, enumerable: true, configurable: true },
      "phoneLayout": { get: function () { return phoneLayout; }, enumerable: true, configurable: true },
      "pipNote": { get: function () { return pipNote; }, enumerable: true, configurable: true },
      "pipReaim": { get: function () { return pipReaim; }, enumerable: true, configurable: true },
      "pipReturn": { get: function () { return pipReturn; }, enumerable: true, configurable: true },
      "pipSource": { get: function () { return pipSource; }, enumerable: true, configurable: true },
      "placeClearLine": { get: function () { return placeClearLine; }, enumerable: true, configurable: true },
      "placeDeskName": { get: function () { return placeDeskName; }, enumerable: true, configurable: true },
      "placeDockForWidth": { get: function () { return placeDockForWidth; }, enumerable: true, configurable: true },
      "placeDockPopover": { get: function () { return placeDockPopover; }, enumerable: true, configurable: true },
      "placeFit": { get: function () { return placeFit; }, enumerable: true, configurable: true },
      "placeHandq": { get: function () { return placeHandq; }, enumerable: true, configurable: true },
      "placeQaBand": { get: function () { return placeQaBand; }, enumerable: true, configurable: true },
      "rbCanvas": { get: function () { return rbCanvas; }, enumerable: true, configurable: true },
      "reassertVisLift": { get: function () { return reassertVisLift; }, enumerable: true, configurable: true },
      "recBtn": { get: function () { return recBtn; }, enumerable: true, configurable: true },
      "refreshAudioBtn": { get: function () { return refreshAudioBtn; }, enumerable: true, configurable: true },
      "refreshAvatarSurfaces": { get: function () { return refreshAvatarSurfaces; }, enumerable: true, configurable: true },
      "releaseHeld": { get: function () { return releaseHeld; }, enumerable: true, configurable: true },
      "renderChat": { get: function () { return renderChat; }, enumerable: true, configurable: true },
      "renderFiles": { get: function () { return renderFiles; }, enumerable: true, configurable: true },
      "renderHandq": { get: function () { return renderHandq; }, enumerable: true, configurable: true },
      "renderLobbyList": { get: function () { return renderLobbyList; }, enumerable: true, configurable: true },
      "renderQa": { get: function () { return renderQa; }, enumerable: true, configurable: true },
      "renderTranscript": { get: function () { return renderTranscript; }, enumerable: true, configurable: true },
      "replaceAddress": { get: function () { return replaceAddress; }, enumerable: true, configurable: true },
      "roomAudioOn": { get: function () { return roomAudioOn; }, enumerable: true, configurable: true },
      "setAppFavicon": { get: function () { return setAppFavicon; }, enumerable: true, configurable: true },
      "setAppGif": { get: function () { return setAppGif; }, enumerable: true, configurable: true },
      "setBotView": { get: function () { return setBotView; }, enumerable: true, configurable: true },
      "setTileLetter": { get: function () { return setTileLetter; }, enumerable: true, configurable: true },
      "sgaAppOwner": { get: function () { return sgaAppOwner; }, enumerable: true, configurable: true },
      "showAppMissing": { get: function () { return showAppMissing; }, enumerable: true, configurable: true },
      "showAppPane": { get: function () { return showAppPane; }, enumerable: true, configurable: true },
      "showAppearCard": { get: function () { return showAppearCard; }, enumerable: true, configurable: true },
      "showAvatarTrack": { get: function () { return showAvatarTrack; }, enumerable: true, configurable: true },
      "showBlurNoteUnlessDialog": { get: function () { return showBlurNoteUnlessDialog; }, enumerable: true, configurable: true },
      "showCamBack": { get: function () { return showCamBack; }, enumerable: true, configurable: true },
      "showCaption": { get: function () { return showCaption; }, enumerable: true, configurable: true },
      "showClosedDialog": { get: function () { return showClosedDialog; }, enumerable: true, configurable: true },
      "showFlipButton": { get: function () { return showFlipButton; }, enumerable: true, configurable: true },
      "showForkPick": { get: function () { return showForkPick; }, enumerable: true, configurable: true },
      "showHeldScreen": { get: function () { return showHeldScreen; }, enumerable: true, configurable: true },
      "showInviteModal": { get: function () { return showInviteModal; }, enumerable: true, configurable: true },
      "showLeftDialog": { get: function () { return showLeftDialog; }, enumerable: true, configurable: true },
      "showLoadRefusal": { get: function () { return showLoadRefusal; }, enumerable: true, configurable: true },
      "showLobby": { get: function () { return showLobby; }, enumerable: true, configurable: true },
      "showPwModal": { get: function () { return showPwModal; }, enumerable: true, configurable: true },
      "showRecOptions": { get: function () { return showRecOptions; }, enumerable: true, configurable: true },
      "showRecReplay": { get: function () { return showRecReplay; }, enumerable: true, configurable: true },
      "showRelayBusy": { get: function () { return showRelayBusy; }, enumerable: true, configurable: true },
      "showResharePrompt": { get: function () { return showResharePrompt; }, enumerable: true, configurable: true },
      "showServiceEnded": { get: function () { return showServiceEnded; }, enumerable: true, configurable: true },
      "showShareLink": { get: function () { return showShareLink; }, enumerable: true, configurable: true },
      "showWhoIfOpen": { get: function () { return showWhoIfOpen; }, enumerable: true, configurable: true },
      "stadiumEl": { get: function () { return stadiumEl; }, enumerable: true, configurable: true },
      "stagefeedEl": { get: function () { return stagefeedEl; }, enumerable: true, configurable: true },
      "stopLobbyPreview": { get: function () { return stopLobbyPreview; }, enumerable: true, configurable: true },
      "syncModalFocus": { get: function () { return syncModalFocus; }, enumerable: true, configurable: true },
      "takeFaceReact": { get: function () { return takeFaceReact; }, enumerable: true, configurable: true },
      "tickAdminClose": { get: function () { return tickAdminClose; }, enumerable: true, configurable: true },
      "tileNote": { get: function () { return tileNote; }, enumerable: true, configurable: true },
      "timingRow": { get: function () { return timingRow; }, enumerable: true, configurable: true },
      "topNameModal": { get: function () { return topNameModal; }, enumerable: true, configurable: true },
      "turnPaint": { get: function () { return turnPaint; }, enumerable: true, configurable: true },
      "twButton": { get: function () { return twButton; }, enumerable: true, configurable: true },
      "unmuteBtn": { get: function () { return unmuteBtn; }, enumerable: true, configurable: true },
      "updateAppButtons": { get: function () { return updateAppButtons; }, enumerable: true, configurable: true },
      "updateBlurAllBtn": { get: function () { return updateBlurAllBtn; }, enumerable: true, configurable: true },
      "updateCamAllBtn": { get: function () { return updateCamAllBtn; }, enumerable: true, configurable: true },
      "updateMuteAllBtn": { get: function () { return updateMuteAllBtn; }, enumerable: true, configurable: true },
      "updateReload": { get: function () { return updateReload; }, enumerable: true, configurable: true },
      "updateShareAllBtn": { get: function () { return updateShareAllBtn; }, enumerable: true, configurable: true },
      "viewTestHooks": { get: function () { return viewTestHooks; }, enumerable: true, configurable: true },
      "waitPaint": { get: function () { return waitPaint; }, enumerable: true, configurable: true },
      "wakeMeet": { get: function () { return wakeMeet; }, enumerable: true, configurable: true },
      "whoRepaint": { get: function () { return whoRepaint; }, enumerable: true, configurable: true },
      "wireFsResize": { get: function () { return wireFsResize; }, enumerable: true, configurable: true },
      "wireMediaSession": { get: function () { return wireMediaSession; }, enumerable: true, configurable: true }
    });
    yield 7;

    // Catalog text with a little markup (<b>, <i>, <kbd>, <p>, <h4>, <ul>, <li>,
    // <br>, a class) is allowed back in; everything else becomes plain text.
    function richHtml(str) {
      const tpl = document.createElement('template');
      tpl.innerHTML = String(str);
      const ok = { P: 1, H4: 1, UL: 1, LI: 1, B: 1, I: 1, KBD: 1, BR: 1, SMALL: 1 };
      (function walk(n) {
        Array.from(n.childNodes).forEach((c) => {
          if (c.nodeType === 1) {
            if (!ok[c.tagName]) { c.replaceWith(document.createTextNode(c.textContent)); return; }
            Array.from(c.attributes).forEach((a) => { if (!(a.name === 'class' && /^[\w -]+$/.test(a.value))) c.removeAttribute(a.name); });
            walk(c);
          } else if (c.nodeType !== 3) c.remove();
        });
      })(tpl.content);
      return tpl.innerHTML;
    }
    yield 20;
    function paintVq() {
      for (const b of document.querySelectorAll('#vqrow button')) b.classList.toggle('sel', (b.dataset.vq || '') === __C.vqManual);
    }
    yield 31;
    const BC_WATCH_COPY = 'Watching the broadcast. You stay off camera. Your name and picture are only seen if you raise a hand and the host promotes you to the stage.';
    if (__C.model.room.BROADCAST()) document.body.classList.add('broadcast');
    yield 35;
    function paintServiceSound() {
      const btn = document.getElementById('airsound');
      if (!btn) return;
      let bc = false;
      try { bc = !!__C.model.room.BROADCAST(); } catch (e) { bc = false; }
      btn.hidden = !bc;
      if (!bc) return;
      const muted = !__M.serviceHeard;
      btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
      btn.textContent = muted ? 'Muted' : 'Sound on';
      btn.title = muted
        ? 'The stage is muted on this device. Tap to hear it. Everyone else still hears it.'
        : 'You can hear the stage. Tap to mute it on this device. Everyone else still hears it.';
      btn.setAttribute('aria-label', muted ? 'Stage muted on this device' : 'Mute the stage on this device');
    }
    // A service counts the people watching. The host and everyone on the
    // stage are not watching, so a host alone reads 0. null off a service.
    function serviceWatchCount() {
      let bc = false;
      try { bc = !!__C.model.room.BROADCAST(); } catch (e) { bc = false; }
      if (!bc) return null;
      const up = new Set();
      try { (0, /*()*/__C.stageIds)().forEach((id) => up.add(id)); } catch (e) {}
      try { (0, /*()*/__C.adminsNow)().forEach((id) => up.add(id)); } catch (e) {}
      try {
        if ((typeof __C.bcHostStored === 'function' && (0, /*()*/__C.bcHostStored)()) || document.body.classList.contains('amadmin')) up.add(__C.model.me.myId() || 'me');
      } catch (e) {}
      return Math.max(0, (0, /*()*/__C.roomHeadCount)() - up.size);
    }
    function paintRoomTrust() {
      const rec = document.getElementById('barrec');
      const who = document.getElementById('airwho');
      const on = __C.model.rec.someone();
      // Not recording is the normal state and says nothing. Recording shows
      // REC on the floating bar for every seat (the recorder's tile says who).
      if (rec) {
        rec.hidden = !on;
        rec.title = on ? __C.model.rec.title() : '';
        rec.setAttribute('aria-label', on ? __C.model.rec.title() : '');
      }
      if (who) {
        // Not joined yet, so there is nobody to count.
        who.hidden = !!(serviceWatchCount() !== null && document.getElementById('appear-modal'));
        const watch = serviceWatchCount();
        const n = watch === null ? (0, /*()*/__C.roomHeadCount)() : watch;
        const word = watch === null ? 'here' : 'watching';
        who.textContent = n + ' ' + word;
        who.title = 'Who is ' + word;
        who.setAttribute('aria-label', 'Who is ' + word + ', ' + n);
      }
      paintServiceSound();
      maybeShowRecNotice();
    }
    yield 44;
    function maybeShowRecNotice() {
      const on = __C.model.rec.someone();
      const existing = document.getElementById('rec-notice');
      if (!on) {
        try { sessionStorage.removeItem('gifos_rec_seen'); } catch (e) {}
        if (existing) existing.remove();
        return;
      }
      // A host's recording order is its own notice: a new order (or a bot ordered after another
      // recording was seen) asks again, and a late joiner sees it on arrival.
      const order = __C.model.rec.order();
      const seenVal = order ? 'o:' + order.tok : '1';
      let seen = false;
      try { seen = sessionStorage.getItem('gifos_rec_seen') === seenVal; } catch (e) {}
      if (seen) { if (existing) existing.remove(); return; }
      if ((0, /*()*/__C.leftDialogUp)()) { if (existing) existing.remove(); return; }
      if (existing) {
        // The recorder's name can land after their status.
        const t = existing.querySelector('#rec-notice-title');
        if (t && t.textContent !== __C.model.rec.title()) t.textContent = __C.model.rec.title();
        return;
      }
      // Someone else is recording you (Zoom and Teams ask the same): staying
      // is consent, and Leave is right there. The recorder, and a viewer who
      // is not in a service recording, only read it.
      let mine = false, onStage = false, host = false;
      try { mine = !!(typeof __C.model.me.myStatus() !== 'undefined' && __C.model.me.myStatus() && __C.model.me.myStatus().rec); } catch (e) {}
      try { onStage = typeof __C.model.me.myStatus() !== 'undefined' && !!__C.model.me.myStatus().stg; } catch (e) {}
      try { host = (typeof __C.bcHostStored === 'function' && !!(0, /*()*/__C.bcHostStored)()) || document.body.classList.contains('amadmin'); } catch (e) {}
      const service = __C.model.room.BROADCAST();
      const hostOrdered = !!(order && (__C.amAdmin || order.byId === __C.model.me.myId()));
      const ask = !mine && !hostOrdered && (!service || (onStage && !host));
      // A broadcast keeps its own service recording from the host's Go live:
      // the host who started it and a viewer who sends nothing read the REC mark
      // on the floating bar, not a card to dismiss. Someone on the stage is asked.
      if (service && !ask) { if (existing) existing.remove(); return; }
      const bg = document.createElement('div');
      bg.id = 'rec-notice';
      bg.className = 'name-modal';
      bg.setAttribute('role', 'dialog');
      bg.setAttribute('aria-modal', 'true');
      bg.setAttribute('aria-labelledby', 'rec-notice-title');
      const botLine = order
        ? '<p id="rec-notice-bot"></p><p>The audio is deleted after the transcript is made. The control bar shows REC until it stops.</p>' +
          (hostOrdered ? '<p class="rec-note">You\'re responsible for getting consent to record where the law requires it.</p>' : '')
        : '<p>Saved on a device in this room. The control bar shows REC until it stops.</p>';
      bg.innerHTML = '<div class="name-box appear-box"><h3 id="rec-notice-title"></h3>' + botLine +
        (hostOrdered
          ? '<div class="appear-actions"><button id="rec-notice-stop" type="button" class="appear-secondary">Stop the bot</button>' +
            '<button id="rec-notice-ok" type="button" class="appear-primary">OK</button></div></div>'
          : ask
          ? '<p>Staying means you agree to be recorded.</p><div class="appear-actions">' +
            '<button id="rec-notice-leave" type="button" class="appear-secondary">Leave</button>' +
            '<button id="rec-notice-ok" type="button" class="appear-primary">Stay</button></div></div>'
          : '<button id="rec-notice-ok" type="button" class="appear-primary">OK</button></div>');
      bg.querySelector('#rec-notice-title').textContent = __C.model.rec.title();
      const botP = bg.querySelector('#rec-notice-bot');
      if (botP) botP.textContent = 'The host\'s bot, ' + order.bot + ', records each speaker in this ' + (__C.model.room.BROADCAST() ? 'broadcast' : 'meeting') + ' to make a transcript.';
      const stopBot = bg.querySelector('#rec-notice-stop');
      if (stopBot) stopBot.onclick = () => { bg.remove(); (0, /*()*/__C.hostBotStop)(); };
      const leave = bg.querySelector('#rec-notice-leave');
      if (leave) leave.onclick = () => {
        bg.remove();
        const btn = document.getElementById('leavebtn');
        if (btn) btn.click();
      };
      bg.querySelector('#rec-notice-ok').onclick = () => {
        try { sessionStorage.setItem('gifos_rec_seen', seenVal); } catch (e) {}
        bg.remove();
      };
      document.body.appendChild(bg);
    }
    // The host's bot could not be opened without a tap (the browser blocks a new tab nobody
    // asked for): one card for the host, Start opens it, Not this time withdraws the order.
    function hostBotCard(res) {
      const old = document.getElementById('hostbot-card');
      if (old) old.remove();
      const bg = document.createElement('div');
      bg.id = 'hostbot-card';
      bg.className = 'name-modal';
      bg.setAttribute('role', 'dialog');
      bg.setAttribute('aria-modal', 'true');
      bg.setAttribute('aria-labelledby', 'hostbot-card-title');
      bg.innerHTML = '<div class="name-box appear-box"><h3 id="hostbot-card-title"></h3>' +
        '<p>Your browser needs a tap to open it.</p><div class="appear-actions">' +
        '<button id="hostbot-card-no" type="button" class="appear-secondary">Not this time</button>' +
        '<button id="hostbot-card-go" type="button" class="appear-primary">Start</button></div></div>';
      bg.querySelector('#hostbot-card-title').textContent = (res.name || 'Your meeting bot') + ' is set to transcribe meetings you host';
      bg.querySelector('#hostbot-card-no').onclick = () => { bg.remove(); (0, /*()*/__C.hostBotStop)(); };
      bg.querySelector('#hostbot-card-go').onclick = () => { bg.remove(); if (!res.open || !res.open()) (0, /*()*/__C.hostBotStop)(); };
      document.body.appendChild(bg);
    }
    function paintAirKind(cls, text) {
      const air = document.getElementById('airbar');
      const kind = document.getElementById('airkind');
      if (!air || !kind) return;
      air.hidden = false;
      air.className = 'on ' + cls;
      kind.textContent = text;
      paintRoomTrust();
    }
    yield 49;
    function paintWatchingSeat() {
      document.body.classList.toggle('bc-watching', (0, /*()*/__C.bcWatchingViewer)());
    }
    // A phone dock holds Video, Mic, React, More and Leave (qa-meet-mobile):
    // the desktop's Invite, Chat and Share move into the More rows there, and
    // the dock's CC button hides (CC stays in More).
    function phoneLayout() {
      try { return window.matchMedia('(max-width: 700px), (max-height: 500px)').matches; } catch (e) { return false; }
    }
    // The row of a More group (data-group in the sheet's markup). A control
    // that leaves the dock goes back to its group, never the sheet's root.
    function moreRow(group) {
      return document.querySelector('#barmore .moregroup[data-group="' + group + '"] > .morerow');
    }
    yield 57;
    // Camera and Mic for a seat that may not publish; Reactions in an app room.
    function paintBarIdle() {
      const b = document.body.classList;
      let watching = false;
      if (__C.model.room.BROADCAST()) {
        let pub = (0, /*()*/__C.barKind)() === 'bc-host';
        try { pub = (0, /*()*/__C.bcMayPublishAv)(); } catch (e) {}
        watching = !pub;
      }
      const why = watching ? 'You are watching. The host can invite you on stage.' : '';
      (0, /*()*/__C.idleDock)(document.getElementById('cam'), why);
      (0, /*()*/__C.idleDock)(document.getElementById('mic'), why);
      (0, /*()*/__C.idleDock)(document.getElementById('reactbtn'), b.contains('app-room') ? 'Reactions are off while an app has the room.' : '');
    }
    let barPlanKey = '';
    function placeDockForWidth() {
      const bar = document.querySelector('.bar');
      const more = document.getElementById('barmore');
      const toggle = document.getElementById('bartoggle');
      if (!bar || !more || !toggle) return;
      const phone = phoneLayout();
      const kind = (0, /*()*/__C.barKind)();
      const narrowKey = __C.model.room.BROADCAST() && window.innerWidth < 1100;
      const key = kind + '|' + (phone ? 'phone' : 'wide') + '|' + (narrowKey ? 'narrow' : 'full');
      if (!bar.dataset.idleGuard) {
        bar.dataset.idleGuard = '1';
        // A grayed slot is not clickable: a tap, Enter or a shortcut's
        // .click() stops here, before the button's own handler.
        bar.addEventListener('click', (e) => {
          const b = e.target && e.target.closest ? e.target.closest('button') : null;
          if (!b || b.parentElement !== bar || b.getAttribute('aria-disabled') !== 'true') return;
          e.preventDefault();
          e.stopImmediatePropagation();
        }, true);
      }
      if (key !== barPlanKey) {
        barPlanKey = key;
        const plan = (0, /*()*/__C.barPlan)({ phone: phone, kind: kind });
        const byId = (id) => document.getElementById(id);
        let anchor = toggle;
        for (let i = plan.dock.length - 1; i >= 0; i--) {
          const el = byId(plan.dock[i]);
          if (!el) continue;
          if (el.parentElement !== bar || el.nextElementSibling !== anchor) bar.insertBefore(el, anchor);
          anchor = el;
        }
        const seat = (group, ids) => {
          const row = moreRow(group);
          if (!row) return;
          ids.forEach((id) => { const el = byId(id); if (el && plan.dock.indexOf(id) < 0) row.appendChild(el); });
        };
        seat('use', plan.use);
        seat('video', plan.video);
        const stage = byId('stagebtn');
        if (stage && plan.dock.indexOf('stagebtn') < 0 && stage.parentElement === bar) {
          const room = moreRow('room'), app = byId('appbtn');
          if (room) room.insertBefore(stage, app && app.parentElement === room ? app : null);
        }
        const faces = [
          ['stagebtn', '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="7" r="2.4"/><path d="M8.2 13.2c.5-1.5 1.9-2.4 3.8-2.4s3.3.9 3.8 2.4"/><path d="M4 17.5h16"/></svg><span class="docklab dockword"></span>', 'Step on the stage', 'Stage'],
          ['hand', '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 12.5V6a1.5 1.5 0 0 1 3 0v5"/><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M14 11V6a1.5 1.5 0 0 1 3 0v6"/><path d="M17 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.8a6 6 0 0 1-4.6-2.2l-3.2-3.9a1.5 1.5 0 0 1 2.3-1.9L8 14.5"/></svg><span class="docklab dockword"></span>', 'Raise hand', 'Hand'],
        ];
        faces.forEach(([id, face, aria, word]) => {
          const el = byId(id);
          if (!el) return;
          if (el.parentElement === bar) {
            if (!el.querySelector('.docklab')) { el.classList.add('iconbtn'); el.innerHTML = face; el.setAttribute('aria-label', aria); }
          } else if (el.querySelector('.docklab')) {
            el.classList.remove('iconbtn'); el.textContent = word; el.removeAttribute('aria-label');
          }
        });
        const share = byId('sharebtn');
        if (share && share.parentElement === bar) share.style.display = '';
      }
      // Plain words a volunteer knows (qa-meet-mobile) on a phone; People on
      // every width (the same word the phone already used).
      const words = phone
        ? { whobtn: (0, /*()*/__C.uiText)('people', 'People'), pwbtn: 'Room password', votebtn: 'Vote on someone' }
        : { whobtn: (0, /*()*/__C.uiText)('people', 'People'), pwbtn: (0, /*()*/__C.uiText)('password', 'Password'), votebtn: (0, /*()*/__C.uiText)('vote', 'Vote') };
      Object.keys(words).forEach((id) => { const el = document.getElementById(id); if (el && el.textContent !== words[id]) el.textContent = words[id]; });
      // Dock words: one set per screen (dockLabelSet). Short on a phone (five
      // buttons in 320px) and on a service window under 1100px; whole words
      // on a wide window where older eyes read them at 16px (qa-meet-desktop).
      const narrowService = __C.model.room.BROADCAST() && window.innerWidth < 1100;
      const labelSet = (0, /*()*/__C.dockLabelSet)({ short: phone || narrowService, end: (0, /*()*/__C.barKind)() === 'bc-host', t: __C.uiText });
      Object.keys(labelSet).forEach((id) => {
        const el = document.querySelector('#' + id + ' .docklab');
        if (!el) return;
        const inSheet = el.closest && el.closest('#barmore');
        const word = (inSheet && id === 'sharebtn') ? (0, /*()*/__C.uiText)('shareScreen', 'Share screen') : labelSet[id];
        if (el.textContent !== word) el.textContent = word;
      });
      try { paintBarIdle(); } catch (e) {}
      try { paintStage(); } catch (e) {}
      try { paintHand(); } catch (e) {}
      try { paintShare(); } catch (e) {}
    }
    yield 61;
    function paintBroadcastChrome() {
      try { placeDockForWidth(); } catch (e) {}
      // A hosted room has a License item; an open meeting has none (no people limit).
      try { const lic = document.getElementById('licbtn'); if (lic && GifOS.licenseView) lic.hidden = !GifOS.licenseView.hosted(); } catch (e) {}
      // An open room (no av=) has no files and no Chat options. The desk
      // preview paints before the mesh joins, so the paperclip is hidden here
      // too; paintChatGate repeats it once the call is up.
      // A private meeting is known by its verifier, not by the hash: on
      // gifos.app joinRoom moves the address to /meet#room=<room>&v=<verifier>,
      // and applyAdminUi runs this paint; the link module reads every form.
      // hasAdminRoom also counts an open-floor meeting someone took charge of.
      // Before the admin state exists (the desk preview), touching it throws
      // and the address decides.
      let hasHost = !!GifOS.link.read(location.pathname, '', location.hash).v;
      try { if ((0, /*()*/__C.hasAdminRoom)()) hasHost = true; } catch (e) {}
      if (!hasHost) {
        const pinEarly = document.getElementById('cattach');
        if (pinEarly) pinEarly.hidden = true;
        const chatSec = document.getElementById('adm-chat');
        if (chatSec) chatSec.hidden = true;
      }
      const pill = document.getElementById('onair');
      const say = (id, text) => { const el = document.getElementById(id); if (el && text) el.textContent = text; };
      const bar = document.querySelector('.bar');
      const english = (typeof __C.uiLang === 'function') ? (0, /*()*/__C.uiLang)() === 'en' : true;
      // A host ends the service for everyone watching. A viewer only leaves.
      // The room does not cut at once: admin-absence runs a silent grace, then
      // the five-minute countdown in #admcount, then closeRoomNoHost().
      const paintLeave = (mode) => {
        const leave = document.getElementById('leavebtn');
        const lab = leave && leave.querySelector('.docklab');
        const go = document.getElementById('leave-go');
        const note = document.getElementById('leave-ask-note');
        const end = mode === 'end';
        // The "left" dialog on screen keeps its words: a door that turned this person away ("This meeting is full")
        // wrote them, and this paint runs again on every admin-state change.
        const leftShown = (0, /*()*/__C.leftDialogUp)();
        const sayLeft = (id, text) => { if (!leftShown) say(id, text); };
        if (leave) {
          if (end) {
            leave.title = 'End the broadcast. Everyone watching sees it close after you leave.';
            leave.setAttribute('aria-label', 'End the broadcast');
          } else if (mode === 'watch') {
            leave.title = 'Leave the broadcast. Your camera and microphone stop.';
            leave.setAttribute('aria-label', 'Leave the broadcast');
          } else {
            leave.title = 'Leave the meeting. Your camera and microphone stop.';
            leave.setAttribute('aria-label', 'Leave the meeting');
          }
        }
        // The dock word is the screen's (dockLabelSet: End only for a host at load); the mode lives in aria-label and title.
        void lab;
        if (go) go.textContent = end ? 'End' : 'Leave';
        if (note) {
          note.hidden = !end;
          note.textContent = end ? 'Everyone watching sees a five-minute countdown after you leave, and then the room closes.' : '';
        }
        if (end) {
          say('leave-ask-title', 'End the broadcast?');
          sayLeft('left-title', 'You ended the broadcast');
          sayLeft('left-note', 'Everyone watching sees a five-minute countdown, and then the room closes. Rejoin to keep it open.');
        } else if (mode === 'watch') {
          say('leave-ask-title', 'Leave the broadcast?');
          sayLeft('left-title', 'You left the broadcast');
          sayLeft('left-note', 'Your camera and microphone are off. Rejoin to come back.');
        } else {
          say('leave-ask-title', 'Leave the meeting?');
          sayLeft('left-title', 'You left the meeting');
          sayLeft('left-note', 'Your camera and microphone are off. Rejoin to come back.');
        }
      };
      if (!__C.model.room.BROADCAST()) {
        if (!english) {
          // A German or Spanish device keeps the translated room name (applyChrome).
          paintAirKind('group', (0, /*()*/__C.uiText)('lobTitle', 'Meeting'));
          if (bar) bar.setAttribute('aria-label', (0, /*()*/__C.uiText)('lobTitle', 'Meeting'));
          paintWatchingSeat();
          return;
        }
        document.title = 'Meeting — GifOS';
        if (pill) { pill.hidden = true; pill.className = ''; }
        paintAirKind('group', 'Meeting');
        const whoMeet = document.getElementById('whobtn');
        if (whoMeet) whoMeet.title = 'People — names and internet addresses';
        const whoMeetH = document.querySelector('#who-modal h3');
        if (whoMeetH) whoMeetH.textContent = 'People';
        if (bar) bar.setAttribute('aria-label', 'Meeting controls');
        const curTitle = document.getElementById('paneltitle');
        if (curTitle && curTitle.textContent !== 'Transcript') curTitle.textContent = 'Meeting chat';
        // A search keeps its sign: the room join repaints this after Find is in use.
        try { paintChatFind(); } catch (e) {}
        const leave = document.getElementById('leavebtn');
        if (leave) {
          leave.title = 'Leave the meeting. Your camera and microphone stop.';
          leave.setAttribute('aria-label', 'Leave the meeting');
        }
        say('chatprivacy', 'Private. Gone when everyone leaves.'); // English here; applyChrome() runs later and the data-t on the element localises it
        const chatMeet = document.getElementById('chatbtn');
        if (chatMeet) chatMeet.title = 'Chat and share files — stays between the people on this meeting, not on a server';
        const setMeet = document.getElementById('setbtn');
        if (setMeet) setMeet.title = 'Meeting settings — your sound mix, timing, and the video quality your camera records';
        const pinMeet = document.getElementById('cattach');
        if (pinMeet) { pinMeet.title = 'Pin a file to the meeting'; pinMeet.setAttribute('aria-label', pinMeet.title); }
        const appMeet = document.getElementById('appbtn');
        if (appMeet) appMeet.title = 'Run an app inside this meeting — everyone here shares and interacts with it live';
        const appTitle = document.getElementById('app-title');
        if (appTitle) appTitle.textContent = 'Run an app in this meeting';
        const appNote = document.getElementById('app-note');
        if (appNote) appNote.innerHTML = 'Pick one of your apps. It runs live for <b>everyone here</b> — same state, same moves — with the meeting\'s audio, video and recording around it. Anyone can interact.';
        const pipMeet = document.getElementById('pipbtn');
        if (pipMeet) {
          pipMeet.title = 'Float the meeting in a mini window — it stays on screen while you use other apps';
          pipMeet.setAttribute('aria-label', 'Float the meeting');
        }
        paintLeave('group');
        // An app room keeps its own Help (applyRoomHelp); only a meeting is a small group.
        const nameLead = document.getElementById('set-name-lead');
        if (nameLead) nameLead.textContent = 'What everyone sees on your tile:';
        const helpH = __C.ROOM.kind === 'app' ? null : document.querySelector('#help-modal h3');
        if (helpH) helpH.textContent = 'How this meeting works';
        paintWatchingSeat();
        return;
      }
      document.title = 'Broadcast — GifOS';
      const svcTitle = document.getElementById('paneltitle');
      if (svcTitle && svcTitle.textContent !== 'Transcript') svcTitle.textContent = 'Broadcast chat';
      try { paintChatFind(); } catch (e) {}
      const leaveSvc = document.getElementById('leavebtn');
      if (leaveSvc) {
        leaveSvc.title = 'Leave the broadcast. Your camera and microphone stop.';
        leaveSvc.setAttribute('aria-label', 'Leave the broadcast');
      }
      say('leave-ask-title', 'Leave the broadcast?');
      say('left-title', 'You left the broadcast');
      say('left-note', 'Your camera and microphone are off. Rejoin to come back.');
      say('chatprivacy', 'Private to this broadcast, gone when everyone leaves');
      const nameLead = document.getElementById('set-name-lead');
      if (nameLead) nameLead.textContent = 'What everyone sees on the stage:';
      const setBtn = document.getElementById('setbtn');
      if (setBtn) setBtn.title = 'Broadcast settings — the picture you send, and the name people see on the stage.';
      const helpH = document.querySelector('#help-modal h3');
      if (helpH) helpH.textContent = 'How this broadcast works';
      const who = document.getElementById('whobtn');
      if (who) who.title = 'Who is watching — names and internet addresses';
      const whoH = document.querySelector('#who-modal h3');
      if (whoH) whoH.textContent = 'Who is watching';
      const whoP = document.querySelector('#who-modal .name-box p');
      if (whoP) whoP.textContent = 'There is no server in the middle storing this broadcast. The phones and computers of the people in it are the servers: they connect straight to each other. That is also why everyone here can see everyone\u2019s internet address \u2014 nobody is anonymous. \u2713 marks an address the GifOS relay verified or this device saw directly; anything else is only what that person\u2019s device reported. People who left stay on the list. To report illegal activity to law enforcement, download this list and include it.';
      const chat = document.getElementById('chatbtn');
      if (chat) chat.title = 'Chat with everyone watching — stays between the people here, not on a server';
      const rec = document.getElementById('recbtn');
      if (rec) rec.title = 'Record this broadcast ON YOUR DEVICE (everyone sees that you are recording)';
      const inv = document.querySelector('#inv-modal h3');
      if (inv) inv.textContent = 'Share this broadcast';
      const pw = document.getElementById('pwbtn');
      if (pw) pw.title = 'Room password. Optional.';
      const files = document.querySelector('#cfiles h4');
      if (files) files.textContent = 'Files pinned to this broadcast';
      const pin = document.getElementById('cattach');
      if (pin) { pin.title = 'Pin a file to this broadcast'; pin.setAttribute('aria-label', pin.title); }
      const appBtn = document.getElementById('appbtn');
      if (appBtn) appBtn.title = 'Run an app on this broadcast — everyone watching shares it and can use it.';
      const appTitle = document.getElementById('app-title');
      if (appTitle) appTitle.textContent = 'Run an app on this broadcast';
      const appNote = document.getElementById('app-note');
      if (appNote) appNote.innerHTML = 'Pick one of your apps. It runs live for <b>everyone watching</b> — same state, same moves — around the stage. Anyone can interact.';
      const pipBtn = document.getElementById('pipbtn');
      if (pipBtn) {
        pipBtn.title = 'Float the stage in a mini window. It stays on screen while you use other apps.';
        pipBtn.setAttribute('aria-label', 'Float the stage');
      }
      const appHide = document.getElementById('apphide');
      if (appHide) appHide.title = 'Hide this app on my screen only. The broadcast keeps sharing it.';
      const appStop = document.getElementById('appstop');
      if (appStop && appStop.title.indexOf('meeting') !== -1) appStop.title = 'Stop sharing this app with the broadcast';
      if (bar) bar.setAttribute('aria-label', 'Broadcast controls');
      const host = (0, /*()*/__C.bcHostStored)() || document.body.classList.contains('amadmin');
      // A viewer is known at boot; their Camera and Mic stay in their slots, grayed (paintBarIdle).
      if (!host) document.body.classList.add('notadmin');
      paintLeave(host ? 'end' : 'watch');
      // Share, Step on and Hand keep the slots barPlan gave this screen
      // (Nathan 2026-11-09): a role learned at the join does not move them.
      // A service host has no hand to raise, so H is not theirs.
      if (host) for (const id of ['hand', 'react-hand']) { const h = document.getElementById(id); if (h) h.removeAttribute('aria-keyshortcuts'); }
      try { paintBarIdle(); } catch (e) {}
      (0, /*()*/__C.paintBroadcastAir)();
      const plate = document.getElementById('bc-stage');
      if (plate) plate.hidden = false;
      const stageWatch = document.getElementById('stagefeed');
      if (stageWatch && window.MutationObserver) {
        // The card too, not only the plate: when the feed lands after the
        // host's camera-off status, nothing else repaints it, and the stage
        // stayed a bare frame (Q87). paintBroadcastIdent ends in the plate.
        new MutationObserver(() => { if (typeof paintBroadcastIdent === 'function') paintBroadcastIdent(); }).observe(stageWatch, { childList: true });
      }
      paintWatchingSeat();
    }
    yield 74; // setCamLiveForTest: a camera the test says is sending
    if (__C.model.room.BROADCAST()) document.body.classList.add((0, /*()*/__C.bcHostStored)() ? 'bc-host' : 'bc-viewer');
    yield 77;
    function paintBroadcastRole() {
      if (!__C.model.room.BROADCAST()) return;
      const role = (0, /*()*/__C.bcRole)();
      document.body.classList.toggle('bc-viewer', role === 'viewer');
      document.body.classList.toggle('bc-stage', role === 'stage');
      document.body.classList.toggle('bc-host', role === 'host');
      document.body.classList.toggle('stage-granted', role === 'stage');
      document.body.classList.toggle('bc-watching', role === 'viewer');
      try { paintHand(); } catch (e) {}
      try { (0, /*()*/__C.paintOnAir)(); } catch (e) {}
      try { paintBroadcastJoinNote(role); } catch (e) {}
      try { paintBarIdle(); } catch (e) {}
    }
    yield 82;
    // The service's ON AIR badge (#onair): kind 'off' | 'watch' | 'live' and its words; none when this is no service.
    function paintOnAirBadge(kind, words) {
      const el = document.getElementById('onair');
      if (!el) return;
      if (!kind) { el.hidden = true; return; }
      el.hidden = false;
      el.className = kind;
      el.setAttribute('role', 'status');
      const w = el.querySelector('.words');
      if (w && w.textContent !== words) w.textContent = words;
      el.setAttribute('aria-label', words);
    }
    function paintBroadcastJoinNote(role) {
      const note = document.getElementById('bc-join-note');
      if (!note) return;
      if (!__C.model.room.BROADCAST() || role !== 'viewer') { note.hidden = true; return; }
      if (note.textContent !== BC_WATCH_COPY) note.textContent = BC_WATCH_COPY;
      note.hidden = false;
    }
    yield 86;
    const grid = document.getElementById('grid');
    const statusEl = document.getElementById('status');
    yield 90;
    const share = document.getElementById('share');
    const shareUrl = document.getElementById('share-url');
    yield 93;
    function paintShareUrl(link) { shareUrl.value = link; }
    // The address bar follows the meeting's canonical address (a host with no address bar has none to change).
    function replaceAddress(url) { history.replaceState(null, '', url); }
    yield 101;
    // A notice on the status line (setStatus's words, its state and whether it stopped someone).
    function paintStatusNotice(m, state, alert) {
      const countEl = document.getElementById('statuscount');
      const restEl = document.getElementById('statusrest');
      // #status is the phone's line, #statusrest the wide window's. Write
      // both: a phone hides #statusrest, and a refusal there went unread.
      // The count and the rest are children of #status: writing the span's own
      // text would delete them (and Invite) for good.
      if (countEl && restEl) { countEl.textContent = ''; countEl.hidden = true; restEl.textContent = m; }
      else statusEl.textContent = m;
      if (statusEl.title !== String(m)) statusEl.title = String(m);
      // Why this line is on screen is state (data-why / data-link / data-back), not words: the live badge reads these, never the sentence.
      if (statusEl.dataset) { statusEl.dataset.why = ''; statusEl.dataset.link = ''; statusEl.dataset.back = ''; statusEl.dataset.state = state; }
      statusEl.classList.toggle('alert', alert);
    }
    yield 104;
    // The chip is one line. The title holds the whole sentence (a refusal,
    // "No blur picked…", or "4 in the meeting · 180p …"). A tap opens it.
    function statusMessage() {
      const title = (statusEl.getAttribute('title') || '').trim();
      const text = (statusEl.textContent || '').trim();
      return (title && title.length >= text.length) ? title : (text || title);
    }
    function paintStatusSheet() {
      const el = document.getElementById('status-full');
      const p = document.getElementById('status-full-text');
      if (!el || !p || el.style.display === 'none') return;
      p.textContent = statusMessage();
    }
    function openStatusSheet() {
      const el = document.getElementById('status-full');
      const p = document.getElementById('status-full-text');
      if (!el || !p) return;
      p.textContent = statusMessage();
      el.style.display = 'flex';
      statusEl.setAttribute('aria-expanded', 'true');
    }
    function closeStatusSheet() {
      const el = document.getElementById('status-full');
      if (el) el.style.display = 'none';
      statusEl.setAttribute('aria-expanded', 'false');
    }
    // The count opens the roster; the rest of the line opens the full status
    // sheet (qa-meet-mobile). Invite is the header's button, not this line.
    statusEl.addEventListener('click', (e) => {
      // On a wide screen the count opens the roster; on a phone the whole chip opens the sheet.
      if (!phoneLayout() && e.target && e.target.closest && e.target.closest('#statuscount')) return;
      e.preventDefault(); openStatusSheet();
    });
    const statusFullClose = document.getElementById('status-full-close');
    if (statusFullClose) statusFullClose.onclick = () => closeStatusSheet();
    const statusFullPeople = document.getElementById('status-full-people');
    if (statusFullPeople) statusFullPeople.onclick = () => { closeStatusSheet(); toggleRoster(true); };
    yield 133; // BACKSTOP ONLY: roster-absent AND link-down this long → tile drops. Announced (D2) and probe-confirmed (D5) departures remove the tile event-driven, within a beat (see departSweep/confirmGone).

    function applyChrome() {
      document.documentElement.lang = (0, /*()*/__C.uiLang)();
      document.querySelectorAll('[data-t]').forEach((el) => {
        const v = (0, /*()*/__C.uiText)(el.getAttribute('data-t'), '');
        if (!v) return;
        if (/<[a-z]/i.test(v)) el.innerHTML = richHtml(v);
        else if (el.children.length) { // keep an icon: only the words change
          let tn = null;
          el.childNodes.forEach((n) => { if (n.nodeType === 3 && n.textContent.trim()) tn = n; });
          if (tn) tn.textContent = v; else el.appendChild(document.createTextNode(v));
        } else el.textContent = v;
        const btn = el.closest('button');
        if (btn && el.classList.contains('dockword')) btn.setAttribute('aria-label', v);
      });
      document.querySelectorAll('[data-ph]').forEach((el) => {
        const v = (0, /*()*/__C.uiText)(el.getAttribute('data-ph'), '');
        if (v) el.setAttribute('placeholder', v);
      });
      document.querySelectorAll('[data-al]').forEach((el) => {
        const v = (0, /*()*/__C.uiText)(el.getAttribute('data-al'), '');
        if (v) el.setAttribute('aria-label', v);
      });
      document.querySelectorAll('[data-ti]').forEach((el) => {
        const v = (0, /*()*/__C.uiText)(el.getAttribute('data-ti'), '');
        if (v) el.setAttribute('title', v);
      });
      applyHelp();
    }
    function applyHelp() {
      const html = (0, /*()*/__C.uiText)('helpMeetBody', '');
      const hs = document.querySelector('#help-modal .help-scroll');
      if (html && hs) hs.innerHTML = richHtml(html);
    }
    yield 136;

    // The knock waits for this preview. A stored GifOS name and picture are
    // filled in, and the person can change both before they join. Save keeps
    // what is shown. Clear blanks the name and the picture.
    function paintAppearFace(el, name, avatar) {
      if (!el) return;
      el.textContent = '';
      if (avatar && avatar.url) {
        const img = document.createElement('img');
        img.alt = '';
        img.src = avatar.url;
        el.appendChild(img);
        return;
      }
      const ch = Array.from(String(name || ''))[0];
      el.textContent = ch ? ch.toUpperCase() : '\u2022';
    }
    yield 139;
    // "This is how you'll appear": the name card (ensureName), seeded with the name the knock already carries.
    function showAppearCard(seed) {
      const bg = document.createElement('div'); bg.className = 'name-modal';
      bg.id = 'appear-modal';
      bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true');
      bg.setAttribute('aria-labelledby', 'appear-title');
      const viewerJoin = (__C.model.room.BROADCAST()) && !(typeof __C.bcHostStored === 'function' && (0, /*()*/__C.bcHostStored)());
      if (viewerJoin) bg.setAttribute('aria-describedby', 'appear-note');
      bg.innerHTML = '<div class="name-box appear-box"><h3 id="appear-title">' + (viewerJoin ? 'Watching the broadcast' : (0, /*()*/__C.uiText)('appearTitle', 'This is how you\'ll appear')) + '</h3>' +
        (viewerJoin ? '<p id="appear-note">You stay off camera. Your name and picture are only seen if you raise a hand and the host promotes you to the stage.</p>' : '') +
        '<div class="appear-face" id="appear-face"></div>' +
        '<div class="appear-name" id="appear-name"></div>' +
        '<input id="nm" data-agent="name-input" name="nickname" maxlength="40" autocomplete="nickname" aria-label="Your name">' +
        '<label class="appear-file">' + (0, /*()*/__C.uiText)('changePic', 'Change picture') + '<input id="appear-file" type="file" accept="image/gif,image/png,image/jpeg,image/webp" hidden></label>' +
        '<div class="appear-actions"><button id="nmcancel" type="button" class="appear-secondary">' + (0, /*()*/__C.uiText)('appearClear', 'Clear') + '</button>' +
        '<button id="nmok" data-agent="name-save" type="button" class="appear-primary">' + (0, /*()*/__C.uiText)('appearSave', 'Save') + '</button></div></div>';
      document.body.appendChild(bg);
      const input = bg.querySelector('#nm');
      input.value = seed;
      const face = bg.querySelector('#appear-face');
      const nameEl = bg.querySelector('#appear-name');
      const paint = () => {
        paintAppearFace(face, input.value.trim(), GifOS.store.identity().avatar);
        if (nameEl) nameEl.textContent = input.value.trim();
      };
      paint();
      input.addEventListener('input', paint);
      bg.querySelector('#appear-file').addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        (0, /*()*/__C.applyAvatarFile)(file).then(() => paint());
      });
      input.focus();
      {
        const save = () => {
          GifOS.store.setName(input.value.trim());
          try { sessionStorage.setItem('gifos_appear_ok', '1'); sessionStorage.setItem('gifos_appeared', '1'); } catch (e) {}
          bg.remove();
          try { (0, /*()*/__C.refreshAllTiles)(); (0, /*()*/__C.broadcastStatus)(); (0, /*()*/__C.pushLeaf)(); } catch (e) {}
        };
        bg.querySelector('#nmok').onclick = save;
        // Clear blanks the name and the picture, then closes (qa-meet-desktop).
        bg.querySelector('#nmcancel').onclick = () => {
          input.value = '';
          try { GifOS.store.setName(''); GifOS.store.setAvatar(null); } catch (e) {}
          paint();
          try { sessionStorage.setItem('gifos_appear_ok', '1'); sessionStorage.setItem('gifos_appeared', '1'); } catch (e) {}
          bg.remove();
          try { (0, /*()*/__C.refreshAllTiles)(); (0, /*()*/__C.broadcastStatus)(); (0, /*()*/__C.pushLeaf)(); } catch (e) {}
        };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
      }
    }

    // Broadcast glance state. The status sentence still carries the detail.
    // The badge is the one word a volunteer, a late viewer, or someone on a
    // bad link can read without parsing that sentence.
    function paintLiveBadge() {
      const b = document.getElementById('livebadge');
      if (!b) return;
      if (!document.body.classList.contains('broadcast')) { b.dataset.state = ''; return; }
      const sd = statusEl.dataset || {};
      const kind = (statusEl.dataset && statusEl.dataset.kind) || '';
      const reachDown = !!(statusEl.dataset && statusEl.dataset.reach && statusEl.dataset.reach !== 'partial');
      // A viewer who is still arriving, or who is alone because the service
      // has not started, is off air. RECONNECTING is a link that dropped, a
      // door they are knocking on again, or a network that cannot get through.
      const joining = sd.why === 'joining';
      const alone = kind === 'alone';
      const linkDown = sd.link === '1' || sd.back === '1' || !!sd.why || reachDown;
      const host = typeof __C.bcHostStored === 'function' && (0, /*()*/__C.bcHostStored)();
      const picture = __C.model.me.myStatus() && !__C.model.me.myStatus().camOff;
      // A rebroadcast is never LIVE (Q77): the host's own, or one on the
      // stage this viewer is watching.
      const pre = host ? !!(__C.model.room.rbNow() && __C.model.room.rbNow().v) : (!joining && !alone && (0, /*()*/__C.bcPreInRoom)());
      let state, label, aria;
      if (pre) { state = 'pre'; label = 'PRERECORDED'; aria = 'Prerecorded, not live'; }
      else if (host && picture && linkDown) { state = 'reconnecting'; label = 'RECONNECTING'; aria = 'Reconnecting'; }
      else if (host && picture) { state = 'live'; label = 'LIVE'; aria = 'You are live'; }
      else if (host) { state = 'off'; label = 'OFF AIR'; aria = 'You are off air'; }
      else if (document.body.classList.contains('bc-reconn')) { state = 'reconnecting'; label = 'RECONNECTING'; aria = 'Reconnecting'; }
      else if (joining) { state = 'reconnecting'; label = 'CONNECTING'; aria = 'Connecting'; }   // still on the way in: nothing is known about the broadcast yet
      else if (alone || document.body.classList.contains('bc-quiet')) { state = 'off'; label = 'OFF AIR'; aria = 'The broadcast is off air'; }
      else if (linkDown || kind === 'door') { state = 'reconnecting'; label = 'RECONNECTING'; aria = 'Reconnecting'; }
      else { state = 'watching'; label = 'WATCHING'; aria = 'You are watching'; }
      b.dataset.state = state;
      const t = document.getElementById('livebadge-txt');
      if (t && t.textContent !== label) t.textContent = label;
      if (b.getAttribute('aria-label') !== aria) b.setAttribute('aria-label', aria);
      const pe = document.getElementById('bc-pre');
      if (pe) {
        const on = !!(pre && !host && document.querySelector('#stagefeed .rowtile'));
        if (pe.hidden === on) pe.hidden = !on;
        // Under the chip, which wraps to two lines on a narrow phone.
        const chip = on && statusEl.closest('.topchip');
        const top = chip && chip.getClientRects().length ? Math.round(chip.getBoundingClientRect().bottom + 8) + 'px' : '';
        if (pe.style.top !== top) pe.style.top = top;
      }
      paintStreamLink();
    }
    yield 142;
    // The host's stage carries the friend link. Off air it sits under the
    // title. On air it is a row above the dock, so the picture stays the stage.
    // Viewers never see it.
    function bcLinkOnStage() {
      const card = document.getElementById('bc-link');
      return !!(card && card.classList.contains('on') && window.matchMedia && window.matchMedia('(max-width: 700px), (max-height: 500px)').matches);
    }
    function paintStreamLink() {
      const card = document.getElementById('bc-link');
      if (!card) return;
      const host = __C.model.room.BROADCAST() && typeof __C.bcHostStored === 'function' && (0, /*()*/__C.bcHostStored)();
      const onAir = __C.model.me.myStatus() && __C.model.me.myStatus().camOff === false;
      const url = (typeof shareUrl !== 'undefined' && shareUrl && shareUrl.value) || '';
      const show = !!(host && url);
      card.classList.toggle('on', show);
      card.classList.toggle('live', show && onAir);
      if (!show) return;
      const input = document.getElementById('bc-link-url');
      if (input && input.value !== url) input.value = url;
      // A phone puts the link on the off-air stage, in the camera-off card's
      // place. A wider screen keeps the card under the link: clearing it on
      // every paint there made the host's card blink on and off.
      const ident = document.getElementById('bc-ident');
      if (ident && bcLinkOnStage()) ident.classList.remove('on');
      const chip = document.querySelector('.topchip');
      const bar = document.querySelector('.bar');
      const chipBottom = chip ? chip.getBoundingClientRect().bottom : 0;
      let top = Math.ceil(chipBottom + 8);
      const hands = document.getElementById('handq');
      if (hands && hands.classList.contains('on')) {
        const hr = hands.getBoundingClientRect();
        if (hr.height > 0 && hr.bottom + 8 > top) top = Math.ceil(hr.bottom + 8);
      }
      const barTop = bar ? bar.getBoundingClientRect().top : window.innerHeight;
      const limit = (barTop > top + 48 && barTop < window.innerHeight) ? barTop : window.innerHeight;
      // A phone keeps the link under the title on air too: the band above
      // the dock is Live / Record.
      const narrow = window.matchMedia && window.matchMedia('(max-width: 700px), (max-height: 500px)').matches;
      document.documentElement.style.setProperty('--bclinktop', top + 'px');
      if (onAir && !narrow) {
        card.style.top = 'auto';
        card.style.maxHeight = 'none';
        card.style.bottom = Math.ceil(window.innerHeight - limit + 8) + 'px';
      } else {
        card.style.bottom = '';
        card.style.top = top + 'px';
        card.style.maxHeight = Math.max(96, Math.floor(limit - top - 8)) + 'px';
      }
    }
    yield 152;
    function paintAssistant(on) {
      const b = document.getElementById('ai-assist');
      if (b) {
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        const st = b.querySelector('.ai-sw-state');
        if (st) {
          st.setAttribute('data-t', on ? 'imAiSwOn' : 'imAiOff');
          st.textContent = on ? (0, /*()*/__C.uiText)('imAiSwOn', 'On') : (0, /*()*/__C.uiText)('imAiOff', 'Off');
        }
      }
      const note = document.getElementById('ai-assist-note');
      if (note) note.textContent = on ? (0, /*()*/__C.uiText)('imAiOn', 'Assistant mode is on. Your camera and microphone stay off.') : '';
    }
    yield 154;
    {
      const b = document.getElementById('ai-assist');
      if (b) b.addEventListener('click', () => (0, /*()*/__C.becomeAssistant)(b.getAttribute('aria-checked') !== 'true'));
      let on0 = false;
      try { on0 = sessionStorage.getItem('gifos_bot') === '1'; } catch (e) {}
      if (on0) paintAssistant(true);   // a bot=1 page shows the lobby switch On
    }
    yield 202;
    function waitPaint() {
      const list = document.getElementById('waitlist');
      const btn = document.getElementById('waitbtn');
      let held = false; try { held = !!__C.holdDoor && (0, /*()*/__C.hasAdminRoom)(); } catch (e) { held = false; }   // an open room has no waiting room
      if (btn) btn.setAttribute('aria-pressed', held ? 'true' : 'false');
      // The waiting room is for admin rooms only, and only its admin works the switch. An open room has none:
      // an old stored hold paints as none here, and the core drops it at the join.
      let mayHold = false; try { mayHold = (0, /*()*/__C.hasAdminRoom)() && __C.amAdmin; } catch (e) { mayHold = false; }
      if (btn) btn.style.display = mayHold ? '' : 'none';
      document.body.classList.toggle('hold-door', held);
      if (!list) return;
      list.textContent = '';
      if (!__C.model.door.waitQueue().size) { list.hidden = true; return; }
      list.hidden = false;
      const head = document.createElement('div');
      head.className = 'wait-head';
      head.textContent = __C.model.door.waitQueue().size === 1 ? '1 person waiting' : (__C.model.door.waitQueue().size + ' people waiting');
      list.appendChild(head);
      for (const [id, name] of __C.model.door.waitQueue()) {
        const row = document.createElement('div');
        row.className = 'wait-row';
        const nm = document.createElement('span');
        nm.className = 'wait-name';
        nm.textContent = name || 'Someone waiting';
        const admit = document.createElement('button');
        admit.type = 'button';
        admit.className = 'wait-admit';
        admit.textContent = 'Admit';
        admit.addEventListener('click', () => { try { __C.model.door.meetWait().admit(id); } catch (e) {} });
        const no = document.createElement('button');
        no.type = 'button';
        no.className = 'wait-no';
        no.textContent = 'Not now';
        no.addEventListener('click', () => { try { __C.model.door.meetWait().decline(id); } catch (e) {} });
        row.appendChild(nm);
        row.appendChild(admit);
        row.appendChild(no);
        list.appendChild(row);
      }
    }
    function closeMoreForWait() {
      const bar = document.querySelector('.bar');
      const toggle = document.getElementById('bartoggle');
      if (bar) bar.classList.add('collapsed');
      if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'More');
        toggle.title = 'More';
        const word = toggle.querySelector('.docklab');
        if (word) word.textContent = (0, /*()*/__C.uiText)('more', 'More');
      }
    }
    yield 211;
    function showHeldScreen() {
      __C.model.door.meetWait().waiting(true);
      const h = document.querySelector('#waitdoor h1'), p = document.querySelector('#waitdoor p');
      if (h) h.textContent = (0, /*()*/__C.statusWords)('waitingHost') || (0, /*()*/__C.uiText)('waitingForTheHost', 'Waiting for the host');
      if (p) p.textContent = (0, /*()*/__C.uiText)('youLlJoinWhen', 'You\u2019ll join when the host lets you in. This meeting can\u2019t see or hear you yet.');
      (0, /*()*/__C.sayState)('waitingHost');
    }
    yield 213;
    // The waiting-room door on the page (#waitdoor and body.wait-door) follows meetWait's atWaitDoor.
    function paintWaitDoor(on) {
      const el = document.getElementById('waitdoor');
      if (el) el.hidden = !on;
      document.body.classList.toggle('wait-door', on);
    }
    yield 293;
    // Tell the room when this phone steps away (screen off / another app) —
    // the browser fires visibilitychange before it freezes us, so the last
    // thing we say is an honest "away", and the first thing back is "here".
    let stillTimer = 0;
    yield 295;
    function showStill() {
      const el = document.getElementById('still');
      if (!el) return;
      if (!(0, /*()*/__C.liveInCall)()) { el.classList.remove('on'); return; }
      const word = (0, /*()*/__C.uiText)('stillHere', 'Still in the call');
      if (el.textContent !== word) el.textContent = word;
      el.classList.add('on');
      clearTimeout(stillTimer);
      stillTimer = setTimeout(() => { el.classList.remove('on'); }, 8000);
    }
    function paintAwayMark(t, on, word) {
      if (!t || !t.tile) return;
      t.tile.classList.toggle('away', !!on);
      let mark = t.tile.querySelector('.awaymark');
      if (!on) { if (mark) mark.remove(); return; }
      if (!mark) {
        mark = document.createElement('div');
        mark.className = 'awaymark';
        t.tile.appendChild(mark);
      }
      const w = word || (0, /*()*/__C.uiText)('away', 'Away');
      if (mark.textContent !== w) mark.textContent = w;
    }
    // The blur note (tileBlurWhy): a face its sender wants clear, kept soft by
    // the room, says why in a few words. CSS shows it only while the meeting
    // controls are up, never on a resting screen.
    function paintBlurWhy(t, why) {
      if (!t || !t.tile || typeof t.tile.querySelector !== 'function') return;
      let el = t.tile.querySelector(':scope > .blurwhy');
      // Only the element the selector named counts: a blur note is .blurwhy,
      // and the free-link sentence is .tpause, not the busy line.
      if (el && !/(^|\s)blurwhy(\s|$)/.test(String(el.className || ''))) el = null;
      const held = t.tile.querySelector(':scope > .tpause:not(.tpause-busy)');
      const heldOn = !!(held && /(^|\s)tpause(\s|$)/.test(String(held.className || '')) && !/(^|\s)tpause-busy(\s|$)/.test(String(held.className || '')));
      // The pause sentence fills the middle of this host (a tile, a Stage
      // view, or the stadium strip). The video is not flowing, so a blur
      // reason there would cover the sentence and explain nothing.
      if (!why || heldOn) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement('span');
        el.className = 'blurwhy';
        t.tile.appendChild(el);
      }
      const words = (0, /*()*/__C.blurWhyWords)(why, 'tile');
      if (el.textContent !== words) el.textContent = words;
      if (el.dataset.why !== why) el.dataset.why = why;
      // "Tap to unblur" is the viewer's own button (a no-password room whose host's signed plan allows it).
      if (why === 'tap') {
        if (el.getAttribute('role') !== 'button') { el.setAttribute('role', 'button'); el.tabIndex = 0; }
        el.onclick = (e) => { e.stopPropagation(); (0, /*()*/__C.tapUnblur)(); };
        el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (0, /*()*/__C.tapUnblur)(); } };
      } else if (el.getAttribute('role') === 'button') { el.removeAttribute('role'); el.removeAttribute('tabindex'); el.onclick = null; el.onkeydown = null; }
    }
    // The Stage's composite is one picture of every stager: it carries the note when every
    // face on it would be clear and the room holds them all for one reason
    // (no password, no admin here, Blur guests). Two
    // reasons, or one clear face, and the faces' own tiles say it instead.
    function paintStageBlurWhy() {
      const ids = (0, /*()*/__C.stageIds)();
      const reasons = ids.map((pid) => (pid === __C.model.me.myId() ? (0, /*()*/__C.tileBlurWhy)('me', __C.model.me.myStatus(), 'stage') : (0, /*()*/__C.tileBlurWhy)(pid, __C.model.roster.statusOf().get(pid), 'stage')));
      const why = reasons.length && reasons.every((r) => r && r === reasons[0]) ? reasons[0] : '';
      for (const el of document.querySelectorAll('#stagefeed > .rowtile')) paintBlurWhy({ tile: el }, why);
      // The strip's own blur: the core's one Stage decision (blurLevelFor 'stage'), the same the embed applies.
      try {
        const lv = (0, /*()*/__C.blurLevelFor)('stage') | 0;
        for (const sv of stagefeedEl.querySelectorAll('.rowtile video')) {
          if (sv.classList.contains('stageface')) continue;
          const had = sv.classList.contains('blur2') ? 2 : sv.classList.contains('blur1') ? 1 : 0;
          if (had !== lv) (0, /*()*/__C.fsBlurClass)(sv, lv);
        }
      } catch (e) {}
      // A stager's own Stage view (ensureStageView: one picture per person) says that person's reason.
      const views = (typeof applyComfy !== 'undefined' && applyComfy.views) || null;
      if (views) for (const [pid, el] of views) { paintBlurWhy({ tile: el }, pid === __C.model.me.myId() ? (0, /*()*/__C.tileBlurWhy)('me', __C.model.me.myStatus(), 'stage') : (0, /*()*/__C.tileBlurWhy)(pid, __C.model.roster.statusOf().get(pid), 'stage')); if (typeof ensureStageView.paintBlur === 'function') ensureStageView.paintBlur(el, pid); }
    }
    const stillBtn = document.getElementById('still');
    if (stillBtn) stillBtn.onclick = () => { stillBtn.classList.remove('on'); clearTimeout(stillTimer); };
    document.addEventListener('visibilitychange', () => {
      __C.model.me.myStatus().away = !!document.hidden;
      (0, /*()*/__C.broadcastStatus)();
      if (document.hidden) return;
      showStill();
      // RESUME-AFTER-FREEZE SELF-HEAL (2026-07-26): Android freezes a
      // backgrounded tab COMPLETELY after ~5min — workers included — so a
      // long app-switch comes back with a stale world: every status expired,
      // our seat healed away, the view says "everyone left" while the room
      // hums along without us. The page can PROVE it was frozen (the worker
      // beat clock shows a gap no live page can produce) — so do what the
      // user's manual refresh does, automatically: a clean re-entry.
      // 150s ≫ the worst honest beat gap (4s clock, worker-held), ≪ any
      // freeze that actually stales the room (statuses die at 60s holdover).
      // frozeGap: the beat handler may have measured (and latched) the gap
      // before this event fired — see the flush-order note at the clock.
      const wallGap = Date.now() - __C.model.roster.hbLastAt();
      const monoNow = (typeof performance !== 'undefined' && performance.now) ? performance.now() : (__C.model.roster.hbLastMono() + wallGap);
      if ((__C.model.roster.frozeGap() || (0, /*()*/__C.frozeThisBeat)(wallGap, monoNow - __C.model.roster.hbLastMono(), __C.model.roster.peers().size)) && __C.model.roster.peers().size) { (0, /*()*/__M.resumeReload)(); return; }
      (0, /*()*/__C.reactRoomState)();
      // Android freezes <video> elements consuming canvas-capture streams
      // while the tab is hidden — the TRACK stays live (others keep seeing
      // you) but the local display never resumes. Re-kick every tile's
      // element on return so the local view catches back up.
      function kickFrozenVideo(v, isMobile, framesNow, framesThen) {
        if (!isMobile || !v || !v.srcObject) return false;
        return !(framesThen > framesNow);
      }
      const armKick = (v) => {
        // Desktop keeps a live element. Re-attaching srcObject flashes black.
        // A phone kicks only when frames have not moved 500 ms after return.
        if (!v || !v.srcObject || !__C.model.consts.IS_MOBILE()) return;
        let q0 = 0;
        try { q0 = v.getVideoPlaybackQuality().totalVideoFrames || 0; } catch (e) { q0 = 0; }
        setTimeout(() => {
          if (document.hidden || !v.srcObject) return;
          let q1 = 0;
          try { q1 = v.getVideoPlaybackQuality().totalVideoFrames || 0; } catch (e) { q1 = 0; }
          if (!kickFrozenVideo(v, true, q0, q1)) return;
          const s = v.srcObject;
          try { v.srcObject = null; v.srcObject = s; } catch (e) {}
          const pr = v.play(); if (pr && pr.catch) pr.catch(() => {});
        }, 500);
      };
      if (__C.model.me.meTile()) armKick(__C.model.me.meTile().video);
      for (const p of __C.model.roster.peers().values()) armKick(p.video);
    });
    // ---- Picture-in-Picture: stepping out to another app must not mean
    // leaving the room — a floating overlay keeps the meeting's best face on
    // screen, the way every native call app does. Video only: audio already
    // survives backgrounding (the live mic capture keeps the audio graph
    // running). Three AUTO entry paths, best-effort each: Chrome and Edge
    // fire the MediaSession 'enterpictureinpicture' action when the user
    // leaves a tab that is capturing cam/mic (permission + site-engagement
    // gated), and that action opens the document window; iOS Safari honors
    // autoPictureInPicture on the aimed candidate; anything else gets the
    // video element's own float a moment after the hide. A hide never asks
    // for the document window itself. That call can fail to return, and the
    // tab would never finish going away. Plus one MANUAL path that works
    // wherever the API exists: the #pipbtn Float button (a tap is a gesture).
    // On Android the only unconditional AUTO path is the native
    // fullscreen-video one, hence the button. Returning to the tab
    // dismisses the float. Side-benefit: a page with an open PiP window is
    // exempt from Chrome's intensive timer throttling, so the float also
    // keeps our status heartbeat inside the 15s freshness window (see G1).
    const pipReady = (v) => !!(v && v.srcObject && v.videoWidth > 0);
    // pipManual: the float was asked for with the Float button while the tab
    // was in view. Only then may it stay up while the meeting is on screen.
    let pipManual = false;
    // pipByBrowser: when the browser's own auto-float action ran last
    // ('enterpictureinpicture' on the media session). Chrome sends it as
    // the tab leaves the tab strip, on its own channel, so it can land
    // BEFORE this page reads hidden. A float the browser asked for is the
    // browser's: Chrome closes it itself when the tab comes back (and the
    // visible branch below does too), so the visible-state settle that
    // guards the page's own late requests must never close it. Reading
    // "still visible" at that instant was the 1-in-3 on a tab switch.
    let pipByBrowser = 0;
    const pipBrowserAsked = () => !!pipByBrowser && Date.now() - pipByBrowser < 3000;
    // A hide must not call requestWindow. On some builds that call never
    // returns, so the visibility handler would never finish. Chrome and Edge
    // open the document window themselves, from the enterpictureinpicture
    // action below. This is only how long a hide waits for that action
    // before the video element's own float. The handler arms the timer and
    // returns; it does not wait.
    const PIP_AUTO_FALLBACK_MS = GifOS.timings.PIP_AUTO_FALLBACK_MS;
    // How long a return waits for the browser to close its own float (see pipReturn).
    const PIP_RETURN_WAIT_MS = GifOS.timings.PIP_RETURN_WAIT_MS;
    let pipAutoT = 0;
    // Bumped when a float is cancelled. A document window that answers after
    // that is closed instead of left over a tab the person is looking at.
    let pipEpoch = 0;
    yield 312;
    // The float's own trace (a 200-line ring, in the debug record as 'pip'):
    // every leave and return, the browser's action, each ask and its answer,
    // each close and why. Read it from Settings > Debug > Export after a few
    // real switches on the device the trouble is on.
    const pipTrace = (window.__pipTrace = window.__pipTrace || []);
    function pipNote(k, x) {
      const e = Object.assign({ t: Date.now(), k, vis: document.visibilityState, f: document.hasFocus(), up: !!(docPip || document.pictureInPictureElement) }, x || {});
      pipTrace.push(e); if (pipTrace.length > 200) pipTrace.shift();
      const tb = document.getElementById('appfloat');   // the top bar's Float reads pressed while a float is up
      if (tb) tb.setAttribute('aria-pressed', e.up ? 'true' : 'false');
    }
    const pageFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
    // A phone browser floats a full-screen page as it is when you switch
    // apps (Android Chrome, Nathan 2026-10-18). Its float shows the page, so
    // the dock and the call buttons leave it while the page is away.
    function awayFull(on) {
      const next = !!on && __C.model.consts.IS_MOBILE() && pageFull();
      if (document.body.classList.contains('away-full') === next) return;
      document.body.classList.toggle('away-full', next);
      // The header band is 0 while the browser is floating this page, so the
      // face is laid out in the float and not in the band it just hid.
      try { layout(); } catch (e) {}
    }
    yield 317;
    let pipCard = null;
    yield 319;
    function pipCardOk() {
      try {
        return !!(document.pictureInPictureEnabled && typeof HTMLVideoElement.prototype.requestPictureInPicture === 'function'
          && typeof HTMLCanvasElement.prototype.captureStream === 'function');
      } catch (e) { return false; }
    }
    function pipCardModel() {
      const words = { you: (0, /*()*/__C.uiText)('you', 'you'), on: (0, /*()*/__C.uiText)('micOn', 'Mic on'), off: (0, /*()*/__C.uiText)('micOff', 'Mic off'), more: (0, /*()*/__C.uiText)('more', 'more') };
      const room = String(document.title || '').replace(/\s*\u2014\s*GifOS\s*$/, '') || (0, /*()*/__C.uiText)('meeting', 'Meeting');
      const me = { name: String((0, /*()*/__C.myName)() || ''), you: 1, muted: __C.model.me.myStatus().muted ? 1 : 0, talk: __C.model.roster.speakingOf().get('me') ? 1 : 0 };
      const talk = [], rest = [];
      let total = 1;
      for (const pid of __C.model.roster.peers().keys()) {
        total++;
        const talking = !!__C.model.roster.speakingOf().get(pid);
        if ((talking ? talk : rest).length >= __C.model.consts.PIP_CARD_ROWS()) continue;
        const st = __C.model.roster.statusOf().get(pid) || {};
        (talking ? talk : rest).push({ name: String((0, /*()*/__C.displayName)(pid) || ''), muted: st.muted ? 1 : 0, talk: talking ? 1 : 0 });
      }
      return { room, words, me, others: talk.concat(rest).slice(0, __C.model.consts.PIP_CARD_ROWS() - 1), total };
    }
    function pipCardPaint(force) {
      const c = pipCard; if (!c || !c.ctx) return false;
      const m = pipCardModel();
      const sig = JSON.stringify(m);
      if (!force && sig === c.sig) return false;
      c.sig = sig;
      const x = c.ctx, W = __C.PIP_CARD_W, H = __C.PIP_CARD_H;
      const fit = (s, max) => { s = String(s); if (x.measureText(s).width <= max) return s; while (s.length > 1 && x.measureText(s + '\u2026').width > max) s = s.slice(0, -1); return s + '\u2026'; };
      x.fillStyle = '#0d0f14'; x.fillRect(0, 0, W, H);
      x.textBaseline = 'middle'; x.textAlign = 'left';
      x.font = '600 22px system-ui, sans-serif'; x.fillStyle = '#9aa3b2';
      x.fillText(fit(m.room, W - 40), 20, 28);
      const people = [m.me].concat(m.others);
      for (let i = 0; i < people.length; i++) {
        const p = people[i], y = 74 + i * 44;
        x.beginPath(); x.arc(40, y, 17, 0, Math.PI * 2);
        x.fillStyle = p.talk ? '#2fbf71' : '#2b303b'; x.fill();
        x.font = '800 18px system-ui, sans-serif'; x.textAlign = 'center'; x.fillStyle = '#fff';
        x.fillText((0, /*()*/__C.nameInitial)(p.name), 40, y + 1);
        x.font = '600 16px system-ui, sans-serif'; x.textAlign = 'right';
        x.fillStyle = p.muted ? '#ff8a80' : '#7ee2a8';
        x.fillText(p.muted ? m.words.off : m.words.on, W - 20, y);
        x.font = '500 22px system-ui, sans-serif'; x.textAlign = 'left'; x.fillStyle = p.talk ? '#fff' : '#d6dae2';
        x.fillText(fit(p.you ? p.name + ' (' + m.words.you + ')' : p.name, W - 190), 68, y);
      }
      if (m.total > people.length) {
        x.font = '500 18px system-ui, sans-serif'; x.textAlign = 'left'; x.fillStyle = '#9aa3b2';
        x.fillText('+' + (m.total - people.length) + ' ' + m.words.more, 68, 74 + __C.PIP_CARD_ROWS * 44 - 6);
      }
      if (c.track && typeof c.track.requestFrame === 'function') { try { c.track.requestFrame(); } catch (e) {} }
      return true;
    }
    function pipCardEnsure() {
      if (pipCard) return pipCard;
      if (!pipCardOk()) return null;
      const canvas = document.createElement('canvas');
      canvas.width = __C.model.consts.PIP_CARD_W(); canvas.height = __C.model.consts.PIP_CARD_H();
      const ctx = canvas.getContext('2d');
      let stream = null;
      try { stream = canvas.captureStream(0); } catch (e) { return null; }
      const track = stream && stream.getVideoTracks()[0];
      if (!ctx || !track) return null;
      const video = document.createElement('video');
      video.id = 'pipcard';
      video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.setAttribute('aria-hidden', 'true');
      video.style.cssText = 'position:fixed;right:0;bottom:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1';
      video.srcObject = stream;
      document.body.appendChild(video);
      pipCard = { canvas, ctx, stream, track, video, sig: '', stop: null };
      pipCardPaint(true);
      const pr = video.play(); if (pr && pr.catch) pr.catch(() => {});
      return pipCard;
    }
    yield 324;
    function pipCardRun(on) {
      const c = pipCard; if (!c) return;
      if (on && !c.stop) {
        const ms = Math.round(1000 / __C.PIP_CARD_FPS);
        const tick = () => { try { pipCardPaint(false); } catch (e) {} };
        const clk = GifOS.meshMedia && GifOS.meshMedia.workerClock;
        if (typeof clk === 'function') { const h = clk(ms, tick); c.stop = () => h.stop(); }
        else { const iv = setInterval(tick, ms); c.stop = () => clearInterval(iv); }
        pipCardPaint(true);
      } else if (!on && c.stop) { const s = c.stop; c.stop = null; s(); pipNote('card-stop'); }
    }
    function pipCardDrop() {
      const c = pipCard; if (!c || document.pictureInPictureElement === c.video) return;
      pipCardRun(false); pipCard = null;
      try { c.track.stop(); } catch (e) {}
      try { c.video.srcObject = null; c.video.remove(); } catch (e) {}
    }
    // Asks in the caller's turn when the card already has a frame (a tap's or
    // the browser action's grant is for that turn); waits, bounded, only when not.
    async function pipCardFloat(manual, byBrowser) {
      const c = pipCardEnsure();
      if (!c) return false;
      if (document.pictureInPictureElement === c.video) { pipCardRun(true); return true; }
      pipCardPaint(true);
      pipManual = !!manual;
      pipNote('card-ask', { rs: c.video.readyState });
      if (c.video.readyState < 1 && !(await (0, /*()*/__C.pipCardReady)(c))) { pipNote('card-unready'); if (manual) pipManual = false; return false; }
      try { await c.video.requestPictureInPicture(); }
      catch (e) { pipNote('el-refused', { err: e && e.name, card: 1 }); if (manual) pipManual = false; return false; }
      pipCardRun(true);
      pipNote('card-open');
      if (!byBrowser && !document.hidden && !pipManual && !(pipAwayAt && !document.hasFocus())) exitPip('settle-visible');
      return true;
    }
    function clearPipAuto() {
      if (!pipAutoT) return;
      clearTimeout(pipAutoT);
      pipAutoT = 0;
    }
    // Hide and blur land here with neither flag. They must return without
    // calling requestWindow: that call can sit forever inside the visibility
    // handler. The document window is asked only from a tap or from the
    // browser's own action, both of which grant it in this same turn.
    async function enterPip(manual, byBrowser) {
      if (byBrowser) pipByBrowser = Date.now();
      if (manual || byBrowser) clearPipAuto();
      pipNote('enter', { manual: !!manual, browser: !!byBrowser, src: (() => { try { const R = pipPick(); return R ? (R.key === 'me' ? 'me' : 'peer') : null; } catch (e) { return '?'; } })(), kind: (() => { try { const R = pipPick(); return R ? R.t.kind : null; } catch (e) { return '?'; } })() });
      // A tile floated from that page only paints "Playing in
      // picture-in-picture" into the browser's float, and leaves the tile
      // black when you come back.
      if (!manual && __C.model.consts.IS_MOBILE() && pageFull()) return;
      if (docPip) { docPipAim(); return; }
      // The action's grant is this turn only. Ask before any await.
      if (byBrowser && docPipOk()) {
        const opened = openDocPip();
        Promise.resolve(opened).then(() => {}, () => {});
        return;
      }
      const v = pipFloatEl(pipPick());   // a source this viewer sees blurred floats blurred (the lens)
      if (v && document.pictureInPictureElement === v) return;
      if (!v) {
        // No live picture (every camera off): the document window where the
        // browser has one and this ask may open it, else the meeting card.
        // Auto-float on leaving stays quiet when neither can open.
        const plan = (0, /*()*/__C.pipFallback)({ hasVideo: false, docOk: docPipOk(), manual: !!manual, byBrowser: !!byBrowser, cardOk: pipCardOk() });
        pipNote('fallback', { plan });
        if (plan === 'doc') {
          pipManual = !!manual;
          if (await openDocPip()) {
            if (!byBrowser && !document.hidden && !pipManual && !(pipAwayAt && !document.hasFocus())) exitPip('settle-visible');
            return;
          }
          pipManual = false;
        } else if (plan === 'card' && await pipCardFloat(manual, byBrowser)) return;
        if (manual) (0, /*()*/__C.setStatus)((__C.model.room.BROADCAST()) ? 'Nothing on the stage to float yet.' : 'Nothing to float yet.');
        return;
      }
      if (!manual && !byBrowser) { armPipAuto(); return; }
      pipManual = !!manual;
      if (manual && docPipOk() && await openDocPip()) {
        if (!document.hidden && !pipManual && !(pipAwayAt && !document.hasFocus())) exitPip('settle-visible');
        return;
      }
      const epoch = pipEpoch;
      if (v.id === 'piplens' && v.readyState < 1 && !(await (0, /*()*/__C.pipCardReady)(pipFloatEl.lens))) { pipNote('lens-unready'); if (manual) await pipCardFloat(manual, byBrowser); return; }
      try {
        if (v.requestPictureInPicture) await v.requestPictureInPicture();
        else if (v.webkitSupportsPresentationMode && v.webkitSupportsPresentationMode('picture-in-picture')) v.webkitSetPresentationMode('picture-in-picture');
      } catch (e) { pipNote('el-refused', { err: e && e.name }); /* no gesture grace here — the browser's own auto paths still apply */ return; }
      // The request is async: a quick flip away and back runs exitPip while it
      // is still pending, and the float then opens over a visible tab with
      // nothing left to close it. Settle against the tab as it is NOW. Not
      // for a float the browser asked for: that one is the browser's to
      // close, and the page may still read visible when it opens.
      if (docPip) return;
      if (epoch !== pipEpoch || (!byBrowser && !document.hidden && !pipManual && !(pipAwayAt && !document.hasFocus()))) exitPip('settle-visible');
    }
    function armPipAuto() {
      if (pipAutoT || docPip || docPipReq || pipFloating()) return;
      pipNote('auto-arm');
      pipAutoT = setTimeout(() => { pipAutoT = 0; elementFloat(); }, PIP_AUTO_FALLBACK_MS);
    }
    async function elementFloat() {
      if (docPip || docPipReq || pipFloating()) return;
      const away = document.hidden || (!!pipAwayAt && !document.hasFocus());
      if (!away) return;
      const v = pipFloatEl(pipPick());
      if (!v || document.pictureInPictureElement === v) return;
      const epoch = pipEpoch;
      if (v.id === 'piplens' && v.readyState < 1 && !(await (0, /*()*/__C.pipCardReady)(pipFloatEl.lens))) { pipNote('lens-unready'); return; }
      pipNote('el-ask', { lens: v.id === 'piplens' });
      try {
        if (v.requestPictureInPicture) await v.requestPictureInPicture();
        else if (v.webkitSupportsPresentationMode && v.webkitSupportsPresentationMode('picture-in-picture')) v.webkitSetPresentationMode('picture-in-picture');
        else return;
      } catch (e) { pipNote('el-refused', { err: e && e.name }); return; }
      if (docPip) return;
      if (epoch !== pipEpoch || (!document.hidden && !pipManual && !(pipAwayAt && !document.hasFocus()))) exitPip('settle-visible');
    }
    const pipFloating = () => !!(docPip || document.pictureInPictureElement
      || Array.from(document.querySelectorAll('video')).some((v) => v.webkitPresentationMode === 'picture-in-picture'));
    // ---- The desktop float (Document Picture-in-Picture: Chrome, Edge). A
    // small always-on-top window with the talker or the stage, your mic and
    // Leave. It plays its OWN <video> on the same stream, so the tile in the
    // room keeps its picture, and it shows only what pipSource() allows
    // (moderation included); it never turns a camera or microphone on.
    // Phones keep the video element's float (no document float there).
    let docPip = null;
    const docPipOk = () => !__C.model.consts.IS_MOBILE() && !!(window.documentPictureInPicture && typeof window.documentPictureInPicture.requestWindow === 'function');
    function docPipPaint() {
      if (!docPip) return;
      const micBtn = document.getElementById('mic');
      const muted = !micBtn || micBtn.classList.contains('off');
      docPip.mic.textContent = muted ? (0, /*()*/__C.uiText)('unmute', 'Unmute') : (0, /*()*/__C.uiText)('mute', 'Mute');
      docPip.mic.classList.toggle('off', muted);
      docPip.mic.disabled = !micBtn || micBtn.disabled || micBtn.getAttribute('aria-disabled') === 'true' || micBtn.style.display === 'none';
    }
    // Re-aimed when the talker or the stage changes (the heartbeat), and when
    // a float is asked for again while one is up.
    function docPipAim() {
      if (!docPip) return;
      const R = pipPick();
      // The float plays the lens: every target is drawn there at the blur this viewer gives it, so a new target swaps
      // what the lens draws and the window itself stays (pipFloatEl).
      let f = null; try { f = R ? pipFloatEl(R) : null; } catch (e) { f = null; }
      const src = f ? f.srcObject : null;
      if (docPip.video.srcObject !== src) {
        docPip.video.srcObject = src;
        if (src) { const pr = docPip.video.play(); if (pr && pr.catch) pr.catch(() => {}); }
        if (f && f.id === 'piplens') { try { pipFloatEl(R); } catch (e) {} }   // the lens paints on now that a float shows it
      }
      docPip.name.textContent = R ? R.label : (0, /*()*/__C.uiText)('nothingToFloatShort', 'Nobody on screen yet');
      docPip.root.classList.toggle('empty', !src);
      docPipPaint();
    }
    // Each call asks at once, inside the caller's task: the browser allows the
    // window only there (a tap, or its own auto-float action). A request the
    // browser is still answering is shared with the next caller, so a tap and
    // the action landing together do not open two windows. A refused ask
    // settles at once and is never shared. A newer window replaces an older.
    // A window that arrives after the person has come back is closed.
    let docPipReq = null;
    function openDocPip() {
      if (docPip) return Promise.resolve(true);
      if (docPipReq) return docPipReq;
      const epoch = pipEpoch;
      let req;
      try { req = window.documentPictureInPicture.requestWindow({ width: 360, height: 250 }); } catch (e) { pipNote('doc-refused', { err: e && e.name }); return Promise.resolve(false); }
      pipNote('doc-ask');
      docPipReq = Promise.resolve(req).then((win) => {
        docPipReq = null;
        if (epoch !== pipEpoch) { try { win.close(); } catch (e) {} pipNote('doc-late'); return false; }
        pipNote('doc-open');
        return docPipOpened(win);
      }, (e) => { docPipReq = null; pipNote('doc-refused', { err: e && e.name }); return false; });
      return docPipReq;
    }
    function docPipOpened(win) {
      if (docPip && docPip.win !== win) { const w = docPip.win; docPip = null; __C.act.surface({ floatOn: false }); try { w.close(); } catch (e) {} }
      // The element float may have won the wait. One float, the document one.
      const el = document.pictureInPictureElement;
      if (el) { const pr = document.exitPictureInPicture(); if (pr && pr.catch) pr.catch(() => {}); }
      const d = win.document;
      const st = d.createElement('style');
      st.textContent = 'html,body{margin:0;height:100%;background:#0d0f14;color:#fff;font:14px system-ui,sans-serif;overflow:hidden}'
        + '.pf{position:relative;height:100%;display:flex;flex-direction:column}'
        + '.pf video{flex:1;min-height:0;width:100%;object-fit:cover;background:#000}'
        + '.pf.empty video{visibility:hidden}'
        + '.pf .nm{position:absolute;left:8px;top:8px;max-width:calc(100% - 16px);padding:2px 8px;border-radius:6px;background:rgba(0,0,0,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '.pf .row{display:flex;gap:8px;padding:8px;justify-content:center;background:#171a21}'
        + '.pf button{min-height:36px;padding:0 16px;border:0;border-radius:18px;font:inherit;font-weight:600;cursor:pointer;background:#2b303b;color:#fff}'
        + '.pf button.off{background:#b3261e}.pf button.leave{background:#b3261e}.pf button:disabled{opacity:.5;cursor:default}';
      d.head.appendChild(st);
      d.title = document.title;
      const root = d.createElement('div'); root.className = 'pf';
      const video = d.createElement('video');
      video.autoplay = true; video.muted = true; video.playsInline = true; // the picture only: the voices keep playing in the meeting
      const name = d.createElement('div'); name.className = 'nm';
      const row = d.createElement('div'); row.className = 'row';
      const mic = d.createElement('button'); mic.type = 'button'; mic.id = 'pf-mic';
      const leave = d.createElement('button'); leave.type = 'button'; leave.className = 'leave'; leave.id = 'pf-leave';
      leave.textContent = (0, /*()*/__C.uiText)('leave', 'Leave');
      mic.onclick = () => { const b = document.getElementById('mic'); if (b && !b.disabled) (0, /*()*/__M.micTap)(false); docPipPaint(); };   // no chooser: it would open in the meeting page, out of sight
      // A broadcast asks before leaving: that question is in the meeting
      // page, so the float closes to show it.
      leave.onclick = () => { const b = document.getElementById('leavebtn'); if (b) b.click(); exitPip(); };
      row.append(mic, leave);
      root.append(video, name, row);
      d.body.appendChild(root);
      const micEl = document.getElementById('mic');
      const mo = micEl ? new MutationObserver(docPipPaint) : null;
      if (mo) mo.observe(micEl, { attributes: true, attributeFilter: ['class', 'disabled', 'style'] });
      win.addEventListener('pagehide', () => {
        if (mo) mo.disconnect();
        if (docPip && docPip.win === win) { docPip = null; __C.act.surface({ floatOn: false }); pipManual = false; pipNote('doc-gone'); }
      });
      docPip = { win, root, video, name, mic };
      __C.act.surface({ floatOn: true });
      docPipAim();
      return true;
    }
    // The OS can tear the float's window down without firing leavepictureinpicture.
    // exitPictureInPicture then rejects, or finishes while this element is still
    // the picture-in-picture element, and the tile stays on the browser's
    // stand-in. Clearing that element's player drops the binding when the
    // window is already gone. Only while the tab is visible: a float the
    // person is still away in keeps its player. A refusal is recorded either
    // way; an exit that already cleared the element must not reset it.
    function pipRecover(v, refused) {
      if (document.hidden || !v || document.pictureInPictureElement !== v) return;
      let src = null; try { src = v.srcObject; } catch (e) { src = null; }
      if (!src) return;
      try { v.srcObject = null; } catch (e) {}
      try { v.load(); } catch (e) {}
      try { v.srcObject = src; } catch (e) {}
      const pr = v.play(); if (pr && pr.catch) pr.catch(() => {});
      pipNote('el-recover', { err: refused || '' });
    }
    // Coming back to the meeting. The browser closes its own float on the
    // way back and says so (leavepictureinpicture); its word goes first. An
    // exit asked at the same moment can cancel that word: Android Chrome,
    // back through the float's expand control, then never answers the exit
    // and never says the float left, and the tile stayed black with a float
    // nobody could close. The page closes the float itself only when it is
    // still up after PIP_RETURN_WAIT_MS. A document window has no such word
    // and closes at once.
    let pipReturnT = 0;
    function pipReturn(why) {
      if (pipReturnT) { clearTimeout(pipReturnT); pipReturnT = 0; }
      if (docPip || !document.pictureInPictureElement) { exitPip(why); return; }
      clearPipAuto();
      pipEpoch++;   // a float still being asked for is cancelled now, as exitPip does
      pipCardRun(false);
      pipNote('return-wait', { why });
      pipReturnT = setTimeout(() => {
        pipReturnT = 0;
        if (document.hidden || !document.pictureInPictureElement) return;
        exitPip(why + '-late');
      }, PIP_RETURN_WAIT_MS);
    }
    async function exitPip(why) {
      clearPipAuto();
      pipEpoch++;
      pipNote('exit', { why: why || '' });
      pipCardRun(false); // coming back stops the card's painting
      if (docPip) { const w = docPip.win; docPip = null; __C.act.surface({ floatOn: false }); try { w.close(); } catch (e) {} }
      const v = document.pictureInPictureElement;
      let refused = '';
      try {
        if (v) {
          try { await document.exitPictureInPicture(); }
          catch (e) { refused = (e && e.name) || 'Error'; pipNote('exit-refused', { err: refused }); }
        } else for (const el of document.querySelectorAll('video')) if (el.webkitPresentationMode === 'picture-in-picture') el.webkitSetPresentationMode('inline');
      } catch (e) {
        refused = (e && e.name) || 'Error';
        pipNote('exit-refused', { err: refused });
      }
      try { pipRecover(v, refused); } catch (e) {}
    }
    yield 344;
    // The FLOAT button: Chrome's AUTO PiP on tab-leave is chrome-gated (the
    // per-site "Automatic picture-in-picture" permission plus site-engagement
    // heuristics — a first-visit phone often gets nothing), and on Android
    // the only unconditional auto path is native fullscreen-video PiP. A TAP
    // is a user gesture, and gesture-backed requestPictureInPicture is
    // allowed everywhere the API exists: tap Float, the mini window opens,
    // then switch apps and it rides along. Hidden where no PiP API exists
    // (Firefox, some WebViews) — those only have the browser's own UI.
    (() => {
      const btn = document.getElementById('pipbtn');
      const testV = document.createElement('video');
      const capable = !!(document.pictureInPictureEnabled || typeof testV.webkitSetPresentationMode === 'function' || window.documentPictureInPicture);
      if (!capable) return;
      btn.style.display = '';
      btn.onclick = () => { if (pipFloating()) exitPip(); else enterPip(true); };
      // The top bar's Float is the same button's twin: it clicks this one, so there is one path
      // (built here, not in the page: the pages stay thin; same words and glyph as the More menu's)
      const full = document.getElementById('appfull');
      if (full && full.parentNode) {
        const top = document.createElement('button');
        top.type = 'button'; top.id = 'appfloat'; top.setAttribute('aria-pressed', 'false');
        top.title = btn.title; top.setAttribute('aria-label', btn.getAttribute('aria-label'));
        const ic = btn.querySelector('svg').cloneNode(true);
        ic.setAttribute('width', '16'); ic.setAttribute('height', '16'); ic.setAttribute('aria-hidden', 'true'); ic.style.cssText = 'flex:none;margin-right:5px';
        const word = document.createElement('span'); word.setAttribute('data-t', 'float'); word.textContent = (0, /*()*/__C.uiText)('float', 'Float');
        top.append(ic, word);
        top.onclick = () => { btn.click(); };
        full.parentNode.insertBefore(top, full);
      }
    })();
    // BACK KEEPS THE MEETING (Nathan, 2026-11-15: "back key should float the
    // meeting"). Android Chrome's Back walked the page history and left the
    // meeting. In a meeting a CloseWatcher (Chrome's own API for Back: no
    // history entries, so nothing piles up on a reload or a rejoin) catches it
    // and the meeting stays; Leave is the only way out. A float needs a tap on
    // Android Chrome (Back carries none: requestPictureInPicture is refused,
    // measured on a Moto), so Back opens More, where Float is one tap away. With
    // a float up Back adds nothing. The native app floats on Back itself, and a
    // desktop's Esc stays Esc: Android Chrome only. Re-armed after each Back and
    // on the heartbeat; dropped where the room's clocks stop (the meeting is
    // left), so Back then behaves as usual. Chrome spends a Back on leaving full screen first, by itself.
    let backWatch = null;
    yield 347;
    function backGuardSync() {
      let want = false;   // IS_ANDROID is declared further down: a beat before it would throw, and the float's re-aim must not
      try { want = __C.model.consts.IS_ANDROID() && __C.model.consts.IS_MOBILE() && typeof window.CloseWatcher === 'function' && !window.__gifosNativeBoot && (0, /*()*/__C.inMeetingNow)(); } catch (e) {}
      if (want && !backWatch) {
        try {
          const w = new window.CloseWatcher();
          w.onclose = () => { if (backWatch === w) backWatch = null; onMeetingBack(); backGuardSync(); };
          backWatch = w;
        } catch (e) { backWatch = null; }
      } else if (!want) backGuardDrop();
    }
    function backGuardDrop() {
      if (!backWatch) return;
      const w = backWatch; backWatch = null;
      try { w.destroy(); } catch (e) {}
    }
    function onMeetingBack() {
      const up = pipFloating();
      pipNote('back', { floating: up });
      if (up || !(0, /*()*/__C.inMeetingNow)()) return;
      const bar = document.querySelector('.bar'), t = document.getElementById('bartoggle');
      if (bar && t && bar.classList.contains('collapsed')) t.click();
    }
    // Safari's auto-PiP flag rides the current best candidate; re-aimed on the
    // heartbeat since who's on stage / who's talking drifts.
    let pipAimed = null;
    function pipReaim() {
      backGuardSync();
      const R = pipPick();
      // A picture this viewer sees blurred never floats raw: not through the browser's own float controls
      // (disablePictureInPicture), and a raw float already up whose level rose (the password went, a moderator blurred
      // it, a clear tap ended) is closed.
      try {
        for (const x of document.querySelectorAll('.tile video, #stagefeed video, #stadium video')) x.disablePictureInPicture = pipBlurLevel(x) > 0;
        const up = document.pictureInPictureElement || Array.from(document.querySelectorAll('video')).find((x) => x.webkitPresentationMode === 'picture-in-picture');
        if (up && up.id !== 'piplens' && up.id !== 'pipcard' && pipBlurLevel(up) > 0) exitPip('blur-rose');
      } catch (e) {}
      (0, /*()*/__C.sendVisPark)(); // hidden-viewer dormancy re-aims with the float (and catches mates that connected while hidden)
      docPipAim();
      // No picture and no document float: keep the meeting card ready (one
      // frame on change, no clock) so the next ask can open it at once.
      let aim = null;
      try { aim = pipFloatEl(R); } catch (e) { aim = null; }   // every target aims the lens (iOS floats the aimed one by itself)
      try {
        if (aim) pipCardDrop();
        else if (__C.model.me.meTile() && !docPipOk() && pipCardEnsure()) { pipCardPaint(false); aim = pipCard.video; }
      } catch (e) {}
      if (typeof __C.botViewOn !== 'undefined' && __C.botViewOn) aim = null;   // the bot view draws no tile, so nothing floats by itself
      if (aim === pipAimed) return;
      try { if (pipAimed) pipAimed.autoPictureInPicture = false; } catch (e) {}
      try { if (aim) aim.autoPictureInPicture = true; } catch (e) {}
      pipAimed = aim;
    }
    yield 354;
    // A visible tab never wants a mate's main parked. Re-send the lift to
    // one mate (idempotent on the far side: no park, nothing changes).
    function reassertVisLift(pid) {
      const p = __C.model.roster.peers().get(pid);
      if (!p || !p.dc || p.dc.readyState !== 'open' || document.hidden) return;
      if (typeof __C.botParks === 'function' && (0, /*()*/__C.botParks)(pid, false)) return;   // the bot view keeps its parks
      (0, /*()*/__C.dcSend)(p, { k: 'vis', park: false });
      __C.model.me.visParkSent().set(pid, false);
    }
    // A phone grid does not float on its own. Full screen can: Android floats
    // a page that holds the screen (FULL SCREEN ON THE FIRST TAP). Someone
    // who left with no float, while one was there to show, is told once where
    // Float is when they come back.
    let pipHintArmed = false, pipHintDone = false;
    const pipBtnShown = () => { const b = document.getElementById('pipbtn'); return !!b && b.style.display !== 'none'; };
    document.addEventListener('visibilitychange', () => {
      pipNote(document.hidden ? 'hidden' : 'visible');
      awayFull(document.hidden);
      if (document.hidden) {
        pipHintArmed = __C.model.consts.IS_MOBILE() && !pipHintDone && !pipFloating() && pipBtnShown() && !!(pipPick() || (pipCard && pipCardOk()));
        enterPip();
      } else {
        pipReturn('visible');
        if (pipHintArmed) {
          pipHintDone = true;
          (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('floatHint', 'Before you switch apps, tap More › Float.'), 9000);
        }
        pipHintArmed = false;
      }
      (0, /*()*/__C.sendVisPark)();
    });
    document.addEventListener('fullscreenchange', () => { if (!pageFull()) awayFull(false); });
    // On a phone a float is for when you are away. A touch on the meeting
    // means you are back, and your tile must not stay black under the
    // label. Float itself (and the tile window's Float) toggles on click.
    // Not a float the person asked for with Float: Android Chrome keeps the
    // meeting tab in front under that float, and the touch on the way out
    // (reaching for the system bars, Home or another app) landed here and
    // closed it (reported 2026-11-15). That float ends like the desktop's: a
    // real return (hidden -> visible), Float again, the floated tile, or the
    // float's own close.
    document.addEventListener('pointerdown', (e) => {
      if (!__C.model.consts.IS_MOBILE()) return;
      awayFull(false);
      if (pipManual) return;
      const t = e.target;
      if (t && t.closest && t.closest('#pipbtn, #appfloat, [data-pip]')) return;
      if (document.pictureInPictureElement
        || Array.from(document.querySelectorAll('video')).some((v) => v.webkitPresentationMode === 'picture-in-picture')) exitPip();
    }, true);
    yield 365;
    const AUTO_FS_SKIP = '#appfull, #appfloat, #pipbtn, [data-pip], #cam, #mic, [id^="campick"], #sharebtn, a[href], input, textarea, select, [contenteditable="true"]';
    // Never under a float: the float means the person is on the way out, and
    // full screen would hide the system bars they leave by.
    function autoFsWanted() {
      if (!__C.model.consts.IS_ANDROID() || !__C.model.consts.IS_MOBILE() || __C.autoFsOff || __C.ROOM.solo || __C.model.me.leaving() || pageFull() || pipFloating()) return false;
      if (__C.model.me.mediaAskPending() > 0) return false;
      const FS = window.GifOS && GifOS.fullscreen;
      return !!(FS && FS.supported());
    }
    document.addEventListener('click', (e) => {
      if (!__C.model.consts.IS_ANDROID() || !__C.model.consts.IS_MOBILE()) return;
      const t = e.target;
      const fb = t && t.closest ? t.closest('#appfull') : null;
      if (fb) {
        // The quiet full screen the first tap took: this tap asks for the
        // filmstrip, and the control's own toggle must not leave. A person's
        // tap is one on the control or on its item in the header menu (the
        // menu relays the choice with click(), which is never isTrusted).
        if ((e.isTrusted || fb.__byPerson === true) && fsQuiet()) { e.preventDefault(); e.stopPropagation(); openFsView('auto'); return; }
        fsStripAsk = !pageFull() && fsStripOk();   // a deliberate full screen brings the filmstrip with it
        (0, /*()*/__C.setAutoFsOff)(pageFull()); return;   // a tap that leaves full screen turns this off; one that enters turns it back on
      }
      if (!e.isTrusted || !autoFsWanted()) return;
      if (t && t.closest && t.closest(AUTO_FS_SKIP)) return;
      fsStripAsk = false;   // the first tap takes the screen only; the filmstrip waits for a tap on Full screen
      pipNote('autofs');
      GifOS.fullscreen.enter(document.documentElement).then(() => pipNote('autofs-' + (pageFull() ? 'on' : 'refused')));
    }, true);
    // The floated element can die mid-background (a stage strip teardown pulls
    // its tile). Element gone from the doc = not a user close — re-aim at the
    // next candidate. A float the USER dismissed stays dismissed.
    document.addEventListener('leavepictureinpicture', (e) => {
      pipManual = false;
      if (pipCard && e.target === pipCard.video) pipCardRun(false);
      if (document.hidden && e.target && !e.target.isConnected) enterPip();
      // Closing the float with its ✕ PAUSES the element (Chrome), and a paused
      // live feed is a frozen or black tile back in the room. A meeting video
      // is never meant to be paused: play it again.
      else if (e.target && e.target.isConnected && e.target.paused && e.target.srcObject) {
        const pr = e.target.play(); if (pr && pr.catch) pr.catch(() => {});
      }
    }, true);
    // Any float that opens over a visible tab without the Float button — the
    // page's own request resolving late included — goes straight back. Not
    // one the browser just asked for (pipByBrowser): the browser closes
    // that one when the tab is back, and the page may still read visible as
    // it opens.
    document.addEventListener('enterpictureinpicture', () => {
      if (!document.hidden && !pipManual && pipAwayAt === 0 && !pipBrowserAsked()) exitPip('el-visible');
    }, true);
    // Switching to another window (the tab stays visible) uses the same
    // auto path as a hide: the browser's own action where it sends one,
    // otherwise the video element's float. Coming back closes it. Desktop
    // only: a phone's app switch hides the page, and
    // its blur alone means a prompt, a picker or the float's own opening.
    // A float the person asked for, or the browser asked for, is never
    // closed by a blur or a focus: only a real return closes it, which is
    // hidden -> visible (above), a touch on the meeting (a phone, above; never
    // for a Float-button float), or the browser's own close. The focus-return
    // close of a Float-button
    // float (0.9.23-0.9.25) is gone: on Android the float's own opening
    // blurs the window and gives the focus back 0.2-0.6 s later, in either
    // order against the float coming up, and that rule closed the float the
    // tap had just opened in 13 of 24 trials on two phones (tests
    // evidence/pip-0925/phones-matrix). A real trip Home hides the page, so
    // the visible return still closes the float.
    let pipAwayAt = 0, pipAwayT = 0;
    window.addEventListener('blur', () => {
      if (pipAwayT) clearTimeout(pipAwayT);
      pipAwayT = setTimeout(() => {
        pipAwayT = 0;
        if (document.hidden || document.hasFocus()) return;
        // An iframe inside the page (an app) takes focus without leaving.
        const ae = document.activeElement;
        if (ae && ae.tagName === 'IFRAME') return;
        awayFull(true);
        if (pipManual || __C.model.consts.IS_MOBILE() || __C.model.me.mediaAskPending()) { pipNote('blur-skip', { manual: pipManual, ask: __C.model.me.mediaAskPending() }); return; }
        pipAwayAt = Date.now();
        pipNote('blur-away');
        enterPip();
      }, 250);
    });
    window.addEventListener('focus', () => {
      if (pipAwayT) { clearTimeout(pipAwayT); pipAwayT = 0; }
      awayFull(false);
      if (!pipAwayAt) return;
      pipAwayAt = 0;
      if (!document.hidden && !pipManual && !pipBrowserAsked()) exitPip('focus-back');
    });
    // The tile left behind reads "Playing in picture-in-picture": tapping it
    // brings the video back into the page.
    document.addEventListener('click', (e) => {
      const v = document.pictureInPictureElement;
      if (v && e.target === v) exitPip();
    }, true);
    yield 428;
    const fmtLeft = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    function clearAdminClose() {
      const el = document.getElementById('admcount');   // the core stopped its clocks (adminCloseOff)
      if (el) el.style.display = 'none';
    }
    function tickAdminClose() {
      const el = document.getElementById('admcount'); if (!el) return;
      const left = __C.admDeadline - Date.now();
      el.textContent = '🛡 No host present — this room closes in ' + fmtLeft(left);
      el.style.display = '';
      if (left <= 0) (0, /*()*/__C.closeRoomNoHost)();
    }
    yield 438;
    function updateReload(target) {
      target = target || {};
      __C.act.updating();   // a reload for an update: the core keeps this seat's resume note
      try {
        const onAir = (0, /*()*/__C.bcOnAir)();
        // A live broadcast survives an update reload: the host comes back on
        // the air with the camera and mic exactly as they were sending.
        const air = onAir ? { cam: !__C.model.me.myStatus().camOff, mic: !__C.model.me.myStatus().muted } : null;
        const wait = (__C.holdDoor || __C.model.admin.waitAdmitted().size || __C.model.door.waitDeclined().size || __C.model.door.waitQueue().size)
          ? { hold: __C.holdDoor, admitted: Array.from(__C.model.admin.waitAdmitted()), declined: Array.from(__C.model.door.waitDeclined()), queue: Array.from(__C.model.door.waitQueue().entries()) }
          : null;
        sessionStorage.setItem(__C.model.consts.UPDATE_RESUME_KEY(), JSON.stringify({
          v: 1, at: Date.now(), room: (0, /*()*/__C.updateRoomKey)(), to: String(target.latest || ''),
          emergency: !!target.emergency, note: String(target.note || '').slice(0, 200),
          blur: (0, /*()*/__C.blurLevel)(__C.model.me.myStatus().blur), stg: +__C.model.me.myStatus().stg || 0, onAir, air, wait,
          sharing: !!__C.model.me.myStatus().scr, seed: __C.model.me.myIdentitySeed() || '',
          pwOk: !!__C.model.door.roomPw() && !__C.model.door.pwProvisional(), // this page holds the password as the room's (typed at the door, granted, or vouched by it)
        }));
      } catch (e) {}
      try { (0, /*()*/__M.stashRecoverMedia)(); } catch (e) {}
      // The update is a wait like any join: its steps carry across the reload (js/meet-progress.js flow 'update').
      let upStep = '';
      try { if (typeof __C.progressStart === 'function' && (0, /*()*/__C.progressStart)('update')) { (0, /*()*/__C.progressTick)(); const w = (0, /*()*/__C.progressWords)(); if (w) upStep = w.head + ' '; } } catch (e) {}
      try { (0, /*()*/__C.setStatus)(upStep + (target.emergency ? 'An important GifOS update is out. ' : '') + 'Updating to GifOS v' + target.latest + ' — you stay in this meeting.', 0, 'note', 'progress'); } catch (e) {}
      if (target.url) { try { history.replaceState(history.state, '', target.url); } catch (e) {} }
      (0, /*()*/__M.resumeReload)();
    }
    yield 444;
    document.querySelectorAll('a.title[href="./"], a.brand[href="./"]').forEach((a) => { a.setAttribute('href', (0, /*()*/__C.homeHref)()); });
    // The "meeting closed" screen (closeRoomNoHost).
    function showClosedDialog() { const cm = document.getElementById('closed-modal'); if (cm) cm.style.display = 'flex'; }
    yield 448;

    // ---- FULLSCREEN VIEW with a filmstrip (standard call UX) ------------------
    // One fullscreen surface: the chosen feed big,
    // every other live feed (stage, row-mates, stadium, my preview) as
    // floating thumbs on the right (landscape) or bottom (portrait); tapping
    // a thumb swaps the big view. Pure DISPLAY layer — srcObjects are
    // borrowed, no app/mesh state is touched, and the extra thumb sinks are
    // torn down the moment the view closes.
    const fsview = document.createElement('div'); fsview.id = 'fsview';
    const fsmain = document.createElement('video'); fsmain.id = 'fsmain';
    fsmain.autoplay = true; fsmain.muted = true; fsmain.setAttribute('playsinline', ''); fsmain.setAttribute('muted', '');
    const fsstrip = document.createElement('div'); fsstrip.id = 'fsstrip';
    const fsclose = document.createElement('button'); fsclose.id = 'fsclose'; fsclose.textContent = '✕'; fsclose.title = 'Exit full screen'; fsclose.setAttribute('aria-label', 'Exit full screen');
    const fsname = document.createElement('div'); fsname.id = 'fsname';
    fsname.innerHTML = '<img class="fspic" alt=""><span class="fsinitial"></span><span class="fsnm"></span><span class="fsnote">Camera off</span>';
    fsview.appendChild(fsmain); fsview.appendChild(fsname); fsview.appendChild(fsstrip); fsview.appendChild(fsclose);
    document.body.appendChild(fsview);
    let fsSel = null, fsTick = null, fsAutoPid = null;
    // Cross-row Follow: fsAutoKey is the followed key ('peer:<pid>', or 'sd:<pid>' for a face in my Stadium); fsZoomIds the
    // far talkers the big view zooms to while it shows the Stadium, fsZoomBox their box in Stadium picture pixels.
    let fsAutoKey = null, fsZoomIds = null, fsZoomBox = null;
    yield 474;
    let fsFollow = null, fsFollowT = 0;
    yield 477;
    // What the Focus view shows, for the debug dump and the room tests.
    window.__meetFocusState = () => ({
      view: window.__meetView || 'fit', on: fsview.classList.contains('on'), inline: __C.fsInline,
      follow: fsSel === 'auto', main: fsmain.dataset.key || '', auto: fsAutoPid || '',
      strip: fsstrip.dataset.set || '', zoom: fsZoomBox ? (fsZoomIds || []).slice() : [], zbox: fsZoomBox ? fsZoomBox.slice() : null,
      far: (0, /*()*/__C.fsFarTalkers)((0, /*()*/__C.fsFarCells)()),
    });
    yield 480;
    // A FACE IN THE BIG VIEW IS CROPPED A LITTLE, NEVER A LOT (Nathan 2026-11-18). A full crop to fill showed a portrait
    // phone in a landscape pane as the top of a head; a whole fit leaves wide bars when the shapes are close. The big
    // view scales a camera face so that at most FS_CROP_MAX of its picture is cut (on the side that overflows), and the
    // rest of the pane is thin bars. Shapes close enough that a full fill cuts no more than that just fill the pane.
    // Shared screens, content and the Stadium stay whole. #fsmain's box is the part shown, centred in the pane, and
    // meet.css crops inside it (cover, 50% 40%). Repainted on every refresh, a pane resize and a picture size change.
    const FS_CROP_MAX = 0.25;
    yield 482;
    function fsFitPaint() {
      const box = fsmain._fit === 'cover' ? (0, /*()*/__C.fsCropBox)(fsmain.videoWidth, fsmain.videoHeight, fsview.clientWidth, fsview.clientHeight, FS_CROP_MAX) : null;
      const px = (n) => n.toFixed(1) + 'px';
      const want = box ? { left: px(box.x), top: px(box.y), width: px(box.w), height: px(box.h), right: 'auto', bottom: 'auto' }
        : { left: '', top: '', width: '', height: '', right: '', bottom: '' };
      for (const k in want) if (fsmain.style[k] !== want[k]) fsmain.style[k] = want[k];
      if (box) fsmain.dataset.fit = 'cover'; else delete fsmain.dataset.fit;
    }
    fsmain.addEventListener('loadedmetadata', fsFitPaint);
    fsmain.addEventListener('resize', fsFitPaint);
    yield 486;
    if (typeof ResizeObserver === 'function') new ResizeObserver(fsFitPaint).observe(fsview);
    // The big view's zoom onto Stadium cells: a CSS transform on #fsmain, the picture itself unchanged. The box of the
    // cells, padded, fills the view as far as FS_ZOOM_MAX allows, and the picture never slides off its own edge.
    const FS_ZOOM_MAX = 8, FS_ZOOM_PAD = 0.1;
    function fsZoomPaint(ids) {
      let box = null;
      const cv = __M.sdView && __M.sdView.canvas;
      const cells = ids && ids.length ? (0, /*()*/__C.fsFarCells)() : null;
      if (cells && cv && cv.width > 2 && cv.height > 2) {
        const G = Math.max(1, __M.sdView.cols() | 0), cell = cv.width / G;
        for (const id of ids) {
          const j = cells.get(id); if (j == null) continue;
          const x = (j % G) * cell, y = Math.floor(j / G) * cell;
          if (!box) { box = [x, y, x + cell, y + cell]; continue; }
          box = [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x + cell), Math.max(box[3], y + cell)];
        }
      }
      const vw = fsmain.videoWidth || (cv ? cv.width : 0), vh = fsmain.videoHeight || (cv ? cv.height : 0);
      const ew = fsmain.clientWidth, eh = fsmain.clientHeight;
      const was = fsZoomBox ? fsZoomBox.join(',') : '';
      if (!box || !vw || !vh || !ew || !eh) {
        fsZoomBox = null;
        if (fsmain.classList.contains('fszoom')) { fsmain.classList.remove('fszoom'); fsmain.style.transform = ''; }
        if (was) (0, /*()*/__C.viewNote)('zoom', { ids: [] });
        return;
      }
      const kx = vw / cv.width, ky = vh / cv.height;   // canvas px to frame px (equal unless a frame lags a resize)
      let bx = box[0] * kx, by = box[1] * ky, bw = (box[2] - box[0]) * kx, bh = (box[3] - box[1]) * ky;
      const pad = FS_ZOOM_PAD * Math.max(bw, bh);
      bx = Math.max(0, bx - pad); by = Math.max(0, by - pad); bw = Math.min(vw - bx, bw + 2 * pad); bh = Math.min(vh - by, bh + 2 * pad);
      const s0 = Math.min(ew / vw, eh / vh), ox = (ew - vw * s0) / 2, oy = (eh - vh * s0) / 2;   // object-fit: contain
      const z = Math.max(1, Math.min(FS_ZOOM_MAX, ew / (bw * s0), eh / (bh * s0)));
      const fit = (c, e, o, span) => {   // the translate on one axis: centre the box, then keep the picture over the view
        let t = e / 2 - c * z;
        const lo = o * z + t, hi = (o + span) * z + t;
        if (span * z >= e) { if (lo > 0) t -= lo; else if (hi < e) t += e - hi; }
        else t = (e - span * z) / 2 - o * z;
        return t;
      };
      const tx = fit(ox + (bx + bw / 2) * s0, ew, ox, vw * s0), ty = fit(oy + (by + bh / 2) * s0, eh, oy, vh * s0);
      fsZoomBox = [Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh)];
      fsmain.classList.add('fszoom');
      const tf = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + z.toFixed(3) + ')';
      if (fsmain.style.transform !== tf) fsmain.style.transform = tf;
      if (fsZoomBox.join(',') !== was) (0, /*()*/__C.viewNote)('zoom', { ids: ids.slice(), box: fsZoomBox.slice(), z: +z.toFixed(2) });
    }
    // The grid videos stay attached while #fsview is open; body.fsopen only
    // hides their paint. busVolume, the row head's packer, selfStageStream
    // and the recorder all read those elements, so detaching them would
    // silence row-mates and darken a head's whole section.
    // FOLLOW THE SPEAKER (fsSel === 'auto'): the big view rides whoever is
    // talking. Hysteresis by memory — the last speaker HOLDS the view while
    // nobody (or the same person) talks, so two voices trading lines don't
    // strobe the screen; any explicit thumb tap pins again.
    function fsPickAuto(src) {
      // The person already on the big view keeps it while they are still
      // talking. A silent moment keeps that same person. A new talker takes
      // the view only when the holder has stopped. A dark peer is in src as
      // a name card, so a camera-off talker is picked the same way.
      const speakingKey = (key) => key.indexOf('peer:') === 0 && __C.speakingOf.get(key.slice(5));
      const VM = window.GifOS && GifOS.meetViewMode;
      if (VM && VM.followStep) {
        // The holds (FOLLOW_ON_MS, FOLLOW_HOLD_MS, FOLLOW_GAP_MS) come from the
        // timings table: a new talker must hold the floor a moment before the
        // view moves, and whoever took it keeps it a while.
        if (!fsFollow) fsFollow = VM.followState();
        // Far faces join as 'sd:<pid>' while my Stadium is a source (CROSS-ROW FOLLOW above).
        const sd = src.find((s) => s.key === 'sd');
        const cells = sd ? (0, /*()*/__C.fsFarCells)() : null;
        const far = (0, /*()*/__C.fsFarTalkers)(cells);
        const keys = src.filter((s) => s.key.indexOf('peer:') === 0).map((s) => s.key);
        const near = keys.filter(speakingKey);
        if (cells) for (const id of cells.keys()) if (!(0, /*()*/__C.isRowMate)(id)) keys.push('sd:' + id);
        const talking = near.concat(far.map((id) => 'sd:' + id));
        const step = VM.followStep(fsFollow, talking, keys, Date.now());
        fsAutoKey = step.key || null;
        fsAutoPid = fsAutoKey ? fsAutoKey.slice(fsAutoKey.indexOf(':') + 1) : null;
        if (step.changed) (0, /*()*/__C.viewNote)('follow', { to: fsAutoPid, key: fsAutoKey, talking: talking });
        if (fsFollowT) { clearTimeout(fsFollowT); fsFollowT = 0; }
        if (step.wakeAt) fsFollowT = setTimeout(() => { fsFollowT = 0; if (fsSel === 'auto' && __C.fsOpen) fsRefresh(); }, Math.max(0, step.wakeAt - Date.now()));
      } else if (!(fsAutoPid && speakingKey('peer:' + fsAutoPid))) {
        for (const s of src) if (speakingKey(s.key)) { fsAutoPid = s.key.slice(5); break; }
        fsAutoKey = fsAutoPid ? 'peer:' + fsAutoPid : null;
      }
      fsZoomIds = null;
      if (fsAutoKey && fsAutoKey.indexOf('sd:') === 0) {
        const sd = src.find((s) => s.key === 'sd');
        if (sd) {
          // While the followed far person talks, the zoom fits every far talker; a quiet holder keeps their own tile.
          const far = (0, /*()*/__C.fsFarTalkers)((0, /*()*/__C.fsFarCells)());
          fsZoomIds = far.indexOf(fsAutoPid) >= 0 ? far : [fsAutoPid];
          return sd;
        }
      }
      return (fsAutoKey && fsAutoKey.indexOf('peer:') === 0 && src.find((s) => s.key === fsAutoKey))
        || src.find((s) => s.key.indexOf('stage:') === 0) || src[0] || null;
    }
    yield 491;
    function fsSources() {
      const out = [];
      // The content region first (content tabs, js/meet-viewmode.js content):
      // in Focus the big view can be a content item as well as a person.
      try {
        const VMc = window.GifOS && GifOS.meetViewMode && GifOS.meetViewMode.content;
        // A screen there is someone's share: it wears that share's blur, as the content pane does (ctPaintScreen).
        if (VMc && !__C.model.room.BROADCAST()) for (const it of VMc.items()) if (it.stream || it.v) out.push({ key: it.key, label: it.label || '', v: it.v || null, stream: it.stream || null, fit: 'contain', content: true, bl: it.sid && !it.mine ? Math.max((0, /*()*/__C.blurLevelFor)(it.sid, false, false, 'stage') | 0, (0, /*()*/__C.modBlurOn)(it.sid) ? 1 : 0) : 0, share: it.sid && !it.mine ? it.sid : null });
      } catch (e) {}
      let stageFit = null;
      for (const v of stagefeedEl.querySelectorAll('.rowtile video')) {
        if (v.classList.contains('stageface')) continue;
        // The Stage strip is a hidden element now that shares show in the
        // content area, and WebKit never starts a hidden video: a live,
        // unmuted feed counts, and the view's own big video plays it.
        if (!pipReady(v) && !(0, /*()*/__C.fsFeedLive)(v)) continue;
        if (!stageFit) stageFit = (__C.model.room.BROADCAST() || (0, /*()*/__C.screenSharers)().length || (0, /*()*/__C.stageIds)().length !== 1) ? 'contain' : 'cover';
        out.push({ key: 'stage:' + ((v.closest('.rowtile') || {}).dataset || {}).row, label: 'On stage', v, fit: stageFit, bl: (0, /*()*/__C.blurLevelFor)('stage') | 0 });   // the strip's one Stage decision (STAGEBLUR)
      }
      if (__C.model.room.BROADCAST()) return out;
      // Focus has every tile, camera on or off (Nathan 2026-11-18): a camera-off person is a card with their Settings
      // picture (the one their grid tile shows) or their initial, so Focus is never a black screen.
      const picOf = (pid, p) => {
        try {
          if (pid === 'me') { const a = (GifOS.store.identity() || {}).avatar; return (a && a.url) || ''; }
          return (GifOS.meetViews && GifOS.meetViews.avatarUrl && GifOS.meetViews.avatarUrl(__C.model.roster.statusOf().get(pid), p)) || '';
        } catch (e) { return ''; }
      };
      for (const [pid, p] of __C.model.roster.peers()) {
        // Every peer the grid shows is listed: a live link, or a tile on the grid while the link is still coming up
        // (applyComfy's own rule for a tile that takes a slot).
        const onGrid = !!(p && p.tile && !p.headless && !p.held && p.tile.parentNode && !(p.tile.style && p.tile.style.display === 'none'));
        if (!p.connected && !onGrid) continue;
        // A dark one (camera off, admin video-off, blocked share, or no ready
        // picture) is a name card: v stays null so the raw frames are never
        // painted. Its picture wears the same blur as the tile's avatar. A live
        // peer still carries the receiver blur level.
        const label = (0, /*()*/__C.displayName)(pid);
        const blocked = (0, /*()*/__C.forcedCamOff)(pid) || (typeof __C.shareBlocked === 'function' && (0, /*()*/__C.shareBlocked)(pid));
        const dark = !pipReady(p.video) || (0, /*()*/__C.seatDark)(__C.model.roster.statusOf().get(pid)) || blocked;
        if (dark) out.push({ key: 'peer:' + pid, label: label, v: null, dark: true, pic: picOf(pid, p), pbl: (0, /*()*/__C.blurLevelFor)(pid, true) });
        else out.push({ key: 'peer:' + pid, label: label, v: p.video, bl: (0, /*()*/__C.blurLevelFor)(pid), share: (0, /*()*/__C.sharingScreen)(pid) && !(0, /*()*/__C.shareOnlyStage)(pid) ? pid : null, fit: (0, /*()*/__C.sharingScreen)(pid) ? 'contain' : 'cover' });
      }
      const sd = stadiumEl.querySelector('[data-row="sd"] video');
      if (pipReady(sd)) out.push({ key: 'sd', label: (0, /*()*/__C.uiText)('setStadium', 'The stadium'), v: sd, fit: 'contain' });
      // My tile shows my screen only when I share from the Stage; a share from the Row keeps my camera there.
      // With my camera off it is my card (my picture, or my initial).
      if (__C.model.me.meTile()) {
        const you = (0, /*()*/__C.uiText)('lobPreviewName', 'You');
        if (!(0, /*()*/__C.seatDark)(__C.model.me.myStatus()) && pipReady(__C.model.me.meTile().video)) out.push({ key: 'me', label: you, v: __C.model.me.meTile().video, fit: (__C.model.me.myStatus().scr && !(0, /*()*/__C.shareOnlyStage)('me')) ? 'contain' : 'cover' });
        else out.push({ key: 'me', label: you, v: null, dark: true, pic: picOf('me'), initial: (() => { try { return (0, /*()*/__C.nameInitial)((0, /*()*/__C.myName)()); } catch (e) { return ''; } })() });
      }
      return out;
    }
    function fsPaintSel() { for (const th of fsstrip.children) th.classList.toggle('sel', th.dataset.key === fsSel); }
    function fsRefresh() {
      const src = fsSources();
      // Read the live stream every refresh, so a renegotiated feed follows.
      // One visible sink per feed: #fsmain or a thumb, never both. A dark
      // source has no stream, even if its grid <video> still holds frames.
      for (const s of src) s.stream = s.dark ? null : (s.content && s.stream ? s.stream : (s.v ? s.v.srcObject : null));
      const main = fsSel === 'auto' ? fsPickAuto(src) : (src.find((s) => s.key === fsSel) || src[0] || null);
      const showName = (on, label) => {
        const nameEl = (typeof document !== 'undefined' && typeof document.getElementById === 'function') ? document.getElementById('fsname') : null;
        if (!nameEl) return;
        nameEl.classList.toggle('on', !!on);
        const letter = nameEl.querySelector('.fsinitial');
        const nm = nameEl.querySelector('.fsnm');
        if (!on) { if (letter) letter.textContent = ''; if (nm) nm.textContent = ''; return; }
        const text = label || '';
        const ch = Array.from(String(text))[0];
        if (letter) letter.textContent = ch ? ch.toUpperCase() : '\u2022';
        if (nm) nm.textContent = text;
      };
      const broadcastFs = __C.model.room.BROADCAST();
      // A service stage with the camera off wears its card (#bc-ident:
      // picture or initial, name, Camera off). Full screen shows that card,
      // not the black frame under it.
      const ident = broadcastFs ? document.getElementById('bc-ident') : null;
      const identOn = !!(ident && ident.classList.contains('on'));
      const identCard = () => {
        if (fsmain.srcObject) fsmain.srcObject = null;
        fsmain.classList.add('dark');
        (0, /*()*/__C.fsBlurClass)(fsmain, 0);
        showName(true, (document.getElementById('bc-ident-name') || {}).textContent || '');
        const img = document.getElementById('bc-ident-img');
        const pic = fsname.querySelector('.fspic');
        const url = ident.classList.contains('pic') && img ? img.getAttribute('src') : '';
        if (pic) { if (url) { if (pic.getAttribute('src') !== url) pic.setAttribute('src', url); } else pic.removeAttribute('src'); }
        fsname.classList.add('ident');
        fsname.classList.toggle('pic', !!url);
      };
      fsname.classList.remove('ident', 'pic');
      if (main) {
        if (fsSel !== 'auto') fsSel = main.key; // a pin re-anchors; auto stays auto
        if (identOn) identCard();
        else if (main.content) {
          // The content area is drawn over the big view (contentPlace).
          if (fsmain.srcObject) fsmain.srcObject = null;
          fsmain._from = null;
          fsmain.classList.remove('dark');
          (0, /*()*/__C.fsBlurClass)(fsmain, 0);
          showName(false);
        } else if (main.dark) {
          if (fsmain.srcObject) fsmain.srcObject = null;
          fsmain.classList.add('dark');
          (0, /*()*/__C.fsBlurClass)(fsmain, 0);
          showName(true, main.label);
          if (main.initial) { const letter = fsname.querySelector('.fsinitial'); if (letter) letter.textContent = main.initial; }
          // A camera-off card shows the person's picture when they set one (its blur is the tile avatar's).
          const pic = fsname.querySelector('.fspic');
          if (pic) {
            if (main.pic) { if (pic.getAttribute('src') !== main.pic) pic.setAttribute('src', main.pic); } else pic.removeAttribute('src');
            (0, /*()*/__C.fsBlurClass)(pic, main.pic ? (main.pbl | 0) : 0);
          }
          fsname.classList.toggle('pic', !!main.pic);
        } else {
          const st = main.stream;
          // The view borrows the tile's stream. A <video> that never started
          // on its bind (WebKit leaves one on a canvas stream now and then)
          // is bound again with a fresh wrapper of the same tracks, once its
          // tile shows frames (or its feed is live: a hidden Stage strip never
          // starts in WebKit) and it has had a moment, at most every refresh.
          const unstarted = !!(st && fsmain._from === st && fsmain.srcObject && !fsmain.videoWidth && main.v && (main.v.videoWidth > 0 || (0, /*()*/__C.fsFeedLive)(main.v))
            && Date.now() - (fsmain._boundAt || 0) >= 1500 && typeof st.getVideoTracks === 'function');
          if (fsmain._from !== st || !fsmain.srcObject || unstarted) {
            fsmain._from = st; fsmain._boundAt = Date.now();
            fsmain.srcObject = unstarted ? new MediaStream(st.getVideoTracks()) : st;
            const pr = fsmain.play(); if (pr && pr.catch) pr.catch(() => {});
          }
          fsmain.classList.remove('dark');
          (0, /*()*/__C.fsBlurClass)(fsmain, main.bl, main.share);
          showName(false);
        }
        fsmain.dataset.key = main.key;
        // A face is cropped by at most FS_CROP_MAX, the rest bars (fsFitPaint); anything else shows whole.
        fsmain._fit = main.fit === 'cover' ? 'cover' : null;
        fsFitPaint();
        fsZoomPaint(fsSel === 'auto' && main.key === 'sd' ? fsZoomIds : null);
      } else {
        fsZoomPaint(null);
        fsmain.srcObject = null; fsmain.dataset.key = ''; fsmain.classList.remove('dark'); (0, /*()*/__C.fsBlurClass)(fsmain, 0); fsmain._fit = null; fsFitPaint();
        if (identOn) identCard();
        else if (broadcastFs) {
          const lineEl = document.getElementById('bc-stage-line');
          showName(true, (lineEl && lineEl.textContent) || 'The stage is clear.');
          const letter = fsname.querySelector('.fsinitial');
          if (letter) letter.textContent = '';
        } else showName(false);
      }
      // Thumbs are kept BY KEY: a refresh moves and updates a playing thumb
      // and never tears one down while its feed stays. The big feed is not
      // also a thumb (one live sink per feed), and every thumb is a keyboard
      // button with a name a screen reader can say.
      const thumbs = src.filter((s) => !main || s.key !== main.key);
      const have = new Map();
      for (const th of Array.from(fsstrip.children)) have.set(th.dataset.key, th);
      const asButton = (el, label, act) => {
        el.setAttribute('role', 'button'); el.tabIndex = 0;
        if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
        el.onclick = act;
        el.onkeydown = (e) => { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); act(); };
      };
      let auto = have.get('auto');
      if (!broadcastFs && !auto) {
        auto = document.createElement('div');
        auto.className = 'fsthumb fsauto'; auto.dataset.key = 'auto';
        auto.innerHTML = '<span class="fsautoglyph"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M17 6.5c1 .9 1.5 2 1.5 3.2s-.5 2.3-1.5 3.2M19.5 4c1.7 1.5 2.5 3.5 2.5 5.7s-.8 4.2-2.5 5.7"/></svg></span><span class="fslbl">' + (0, /*()*/__C.uiText)('viewFollow', 'Follow the speaker') + '</span>';
        asButton(auto, (0, /*()*/__C.uiText)('viewFollow', 'Follow the speaker'), () => { fsSel = 'auto'; fsAutoPid = null; fsAutoKey = null; fsFollow = null; fsRefresh(); fsFollowChanged(); });
      }
      const keep = new Set(broadcastFs ? [] : ['auto']);
      const place = (th, pos) => { if (fsstrip.children[pos] !== th) fsstrip.insertBefore(th, fsstrip.children[pos] || null); };
      let pos = 0;
      if (!broadcastFs && auto) { place(auto, 0); pos = 1; }
      for (const s of thumbs) {
        keep.add(s.key);
        let th = have.get(s.key);
        let tv;
        const paintThumbCard = (el) => {
          el.classList.toggle('dark', !!s.dark);
          let ini = el.querySelector('.fsinitial');
          if (!ini) { ini = document.createElement('span'); ini.className = 'fsinitial'; el.appendChild(ini); }
          if (s.dark) {
            const ch = s.initial || Array.from(String(s.label || ''))[0];
            ini.textContent = ch ? ch.toUpperCase() : '\u2022';
          }
          // a camera-off card with a picture shows the picture (blurred like the tile's avatar)
          let pic = el.querySelector('.fspic');
          const url = s.dark ? (s.pic || '') : '';
          if (url && !pic) { pic = document.createElement('img'); pic.className = 'fspic'; pic.setAttribute('alt', ''); el.appendChild(pic); }
          if (pic) {
            if (url) { if (pic.getAttribute('src') !== url) pic.setAttribute('src', url); } else pic.removeAttribute('src');
            (0, /*()*/__C.fsBlurClass)(pic, url ? (s.pbl | 0) : 0);
          }
          el.classList.toggle('pic', !!url);
        };
        if (!th) {
          th = document.createElement('div'); th.className = 'fsthumb'; th.dataset.key = s.key;
          tv = document.createElement('video'); tv.autoplay = true; tv.muted = true; tv.setAttribute('playsinline', ''); tv.setAttribute('muted', '');
          tv.srcObject = s.stream; if (s.stream) { const pr = tv.play(); if (pr && pr.catch) pr.catch(() => {}); }
          (0, /*()*/__C.fsBlurClass)(tv, s.dark ? 0 : s.bl, s.share);
          const lb = document.createElement('span'); lb.className = 'fslbl'; lb.textContent = s.label;
          th.appendChild(tv); th.appendChild(lb);
          paintThumbCard(th);
        } else {
          // the same feed — re-borrow in place (a renegotiated stream swaps
          // identity) and follow its blur level and name. A dark card keeps
          // the node and drops the stream.
          tv = th.querySelector('video');
          if (tv && tv.srcObject !== s.stream) {
            tv.srcObject = s.stream;
            if (s.stream) { const pr = tv.play(); if (pr && pr.catch) pr.catch(() => {}); }
          }
          if (tv) (0, /*()*/__C.fsBlurClass)(tv, s.dark ? 0 : s.bl, s.share);
          const lb = th.querySelector('.fslbl');
          if (lb && lb.textContent !== s.label) lb.textContent = s.label;
          paintThumbCard(th);
        }
        const key = s.key;
        asButton(th, s.label || 'Show this feed', () => { fsSel = key; fsRefresh(); fsFollowChanged(); });
        place(th, pos);
        pos++;
      }
      for (const [k, th] of have) {
        if (keep.has(k)) continue;
        const tv = th.querySelector('video');
        if (tv) tv.srcObject = null;
        th.remove();
      }
      fsstrip.dataset.set = thumbs.map((s) => s.key).join('|');
      fsPaintSel();
      try { ctFocusSync(); } catch (e) {}
    }
    function fsRefreshIfOpen() {
      if (fsview.classList.contains('on')) fsRefresh();
    }
    yield 496;
    let fsOwnExit = false; // an exit closeFsView asked for is on its way
    let fsFull = false; // the view was the full-screen element at the last change
    let fsAskAt = 0; // when the view last asked the browser for full screen
    let fsOverlay = false; // the filmstrip is painted inside a document that already holds the screen
    let fsStripAsk = false; // a tap on Full screen asked for the document; the filmstrip opens when it lands
    // A phone meeting's full screen shows the filmstrip over the meeting, so
    // leaving the app can float it. An app or a broadcast keeps its own
    // picture.
    function fsStripOk() {
      return __C.model.consts.IS_MOBILE() && !document.body.classList.contains('has-app') && !__C.model.room.BROADCAST();
    }
    // Android's first tap takes the screen with no filmstrip. Full screen
    // then offers the filmstrip, and the filmstrip's close leaves.
    function fsQuiet() {
      return __C.model.consts.IS_ANDROID() && fsStripOk() && pageFull() && !fsview.classList.contains('on');
    }
    // A tap on a thumb pins a person and the Follow chip follows again: the
    // view picker's switch shows the same choice.
    function fsFollowTalk() { if (fsSel === 'auto') fsRefresh(); }   // the core heard a new voice
    function fsFollowChanged() {
      if (!__C.fsInline) return;
      const on = fsSel === 'auto';
      try { if (window.GifOS && GifOS.meetViewMode) GifOS.meetViewMode.saveFollow(localStorage, on); } catch (e) {}
      if (typeof window.__meetPaintView === 'function') window.__meetPaintView();
    }
    function openFsView(key, inline) {
      fsSel = key || null;
      fsFollow = null;
      __C.act.surface({ fsInline: !!inline });
      document.body.classList.toggle('view-focus', __C.fsInline);
      fsview.classList.add('on'); __C.act.surface({ fsOpen: true });
      document.body.classList.add('fsopen');
      fsRefresh();
      if (!fsTick) fsTick = setInterval(fsRefresh, 2000);
      // The document already holds the screen on a phone. Asking again would
      // put this view in the top layer and bury every sheet. The Focus view
      // never asks: it is a view of the meeting, under its controls.
      const own = !document.fullscreenElement && !__C.fsInline;
      fsOverlay = !own && !__C.fsInline;
      if (own && fsview.requestFullscreen) {
        fsAskAt = Date.now();
        fsview.requestFullscreen().catch(() => {});
      } else fsAskAt = 0;
      try { fsclose.focus(); } catch (e) {} // the keyboard goes where the picture is
      paintInPageFull();
    }
    function closeFsView(fromPicker) {
      if (fsTick) { clearInterval(fsTick); fsTick = null; }
      if (fsFollowT) { clearTimeout(fsFollowT); fsFollowT = 0; }
      fsFollow = null;
      fsZoomIds = null; fsZoomPaint(null);
      const wasInline = __C.fsInline;
      __C.act.surface({ fsInline: false });
      document.body.classList.remove('view-focus');
      // Something other than the view picker closed the Focus view (the
      // in-page Full screen toggle): the meeting goes back to the last view.
      if (wasInline && !fromPicker && typeof window.__meetLeaveFocus === 'function') { try { window.__meetLeaveFocus(); } catch (e) {} }
      fsview.classList.remove('on'); __C.act.surface({ fsOpen: false });
      try { ctFocusSync(); } catch (e) {}
      document.body.classList.remove('fsopen');
      fsmain.srcObject = null;
      fsmain.classList.remove('dark');
      fsmain._fit = null; fsFitPaint();
      fsname.classList.remove('on', 'ident', 'pic');
      for (const tv of fsstrip.querySelectorAll('video')) tv.srcObject = null; // no leftover sinks — decode work ends with the view
      fsstrip.textContent = ''; fsstrip.dataset.set = '';
      // Back to the controls. While the view is still the full-screen
      // element the rest of the page is inert, so focus moves once the exit
      // lands.
      const lost = !document.activeElement || document.activeElement === document.body || fsview.contains(document.activeElement);
      const refocus = () => {
        if (!lost) return;
        const back = document.getElementById('bartoggle');
        if (back && back.offsetParent !== null) try { back.focus(); } catch (e) {}
      };
      const overlay = fsOverlay;
      fsOverlay = false;
      if (document.fullscreenElement === fsview) { fsOwnExit = true; document.exitFullscreen().then(refocus, () => { fsOwnExit = false; refocus(); }); }
      else if (overlay && document.fullscreenElement === document.documentElement) {
        if (__C.model.consts.IS_ANDROID()) (0, /*()*/__C.setAutoFsOff)(true);   // leaving here is the person's choice, as with the Full screen button
        fsOwnExit = true; document.exitFullscreen().then(refocus, () => { fsOwnExit = false; refocus(); });
      }
      else refocus();
      paintInPageFull();
    }
    // iPhone Safari has no element fullscreen. The OS header button opens this
    // in-page view there; paintInPageFull is a no-op until that path arms it.
    function paintInPageFull() {
      const fb = document.getElementById('appfull');
      if (!fb || fb.dataset.fsMode !== 'inpage') return;
      const on = fsview.classList.contains('on');
      const word = on ? (0, /*()*/__C.uiText)('leaveFullScreen', 'Leave full screen') : (0, /*()*/__C.uiText)('fullScreen', 'Full screen');
      if (window.GifOS && GifOS.fullscreen && GifOS.fullscreen.glyph) fb.innerHTML = GifOS.fullscreen.glyph(on);
      fb.title = word;
      fb.setAttribute('aria-label', word);
      fb.setAttribute('aria-pressed', on ? 'true' : 'false');
      fb.classList.toggle('on', on);
    }
    fsclose.onclick = () => closeFsView();
    // Only the browser's own exit (its Escape, a swipe) closes the view
    // here. The exit closeFsView asked for can land after F opened the view
    // again, and used to close it a moment later. A full screen that lands
    // after the view closed (F twice, quickly) is let go at once, or the
    // page sat in full screen with nothing on it. Firefox fires the change
    // twice per exit, so only a real change of state counts.
    document.addEventListener('fullscreenchange', () => {
      const el = document.fullscreenElement;
      if (el === fsview) {
        if (fsFull) return;
        fsFull = true;
        if (!fsview.classList.contains('on')) { fsOwnExit = true; document.exitFullscreen().catch(() => {}); }
        return;
      }
      if (!el && !fsFull && fsAskAt && Date.now() - fsAskAt < 1000 && fsview.classList.contains('on') && fsview.requestFullscreen) {
        // Firefox drops a request made while its last exit was still
        // finishing; ask once more while the key press still counts.
        fsAskAt = 0;
        fsview.requestFullscreen().catch(() => {});
        return;
      }
      if (el === document.documentElement && fsStripAsk) {
        fsStripAsk = false;
        if (!fsview.classList.contains('on')) openFsView('auto');
        return;
      }
      if (!el) fsStripAsk = false;
      if (!el && fsOverlay && fsview.classList.contains('on')) {
        closeFsView();
        return;
      }
      if (!el && fsOwnExit && !fsFull) { fsOwnExit = false; return; }
      if (el || !fsFull) return;
      fsFull = false;
      if (fsOwnExit) { fsOwnExit = false; return; }
      if (fsview.classList.contains('on')) closeFsView();
    });
    document.addEventListener('fullscreenerror', () => { fsStripAsk = false; });
    yield 512;
    // Keep the letter as text. A fake avatar from a unit test has no querySelector;
    // setting textContent there is the whole job. A live tile may already hold an <img>.
    function setTileLetter(avatar, letter) {
      if (!avatar) return;
      if (typeof avatar.querySelector !== 'function') { avatar.textContent = letter; return; }
      const img = avatar.querySelector('img.avatar-img');
      if (!img) { avatar.textContent = letter; return; }
      const drop = [];
      for (let i = 0; i < avatar.childNodes.length; i++) if (avatar.childNodes[i].nodeType === 3) drop.push(avatar.childNodes[i]);
      drop.forEach((n) => n.remove());
      avatar.insertBefore(document.createTextNode(letter), avatar.firstChild);
    }
    function paintAvatarImg(avatar, url, hash) {
      if (!avatar || typeof avatar.querySelector !== 'function') return;
      let img = avatar.querySelector('img.avatar-img');
      if (!url) {
        if (img) img.remove();
        avatar.classList.remove('has-img');
        return;
      }
      if (!img) {
        img = document.createElement('img');
        img.className = 'avatar-img';
        img.alt = '';
        avatar.appendChild(img);
      }
      if (img.getAttribute('data-hash') !== (hash || '')) {
        img.src = url;
        img.setAttribute('data-hash', hash || '');
      }
      avatar.classList.add('has-img');
    }
    yield 515;
    // A host's per-person controls say "for all" (hostWords, below).
    const MODBAR_HTML = '<button data-mod="mute" aria-label="Mute for all">Mute for all</button><button data-mod="blur" aria-label="Blur for all">Blur for all</button>'
      + '<button class="grantbtn" data-mod="app" title="Let this person run and lead apps in your room" aria-label="Allow apps & stage">Allow apps & stage</button>'
      + '<button class="grantbtn" data-mod="share" title="Let this person share their screen" aria-label="Allow screen share">Allow screen share</button>'
      + '<button class="banbtn" data-adm="ban" title="Ban this person from the room" aria-label="Ban this person">Ban</button>';
    yield 522;
    function paintStageMod() {
      const el = document.getElementById('stagemod');
      if (!el) return;
      const broadcast = __C.model.room.BROADCAST();
      const host = broadcast && ((typeof __C.bcHostStored === 'function' && (0, /*()*/__C.bcHostStored)()) || document.body.classList.contains('amadmin'));
      const blocked = document.body.classList.contains('admroom') && document.body.classList.contains('notadmin');
      const ids = (!broadcast || !host || blocked) ? [] : (0, /*()*/__C.stageModList)();
      if (!ids.length) {
        el.classList.remove('on');
        el.hidden = true;
        for (const card of el.querySelectorAll('.stagecard')) card.remove();
        return;
      }
      el.hidden = false;
      el.classList.add('on');
      if (!el.querySelector('.stagekicker')) {
        const k = document.createElement('span');
        k.className = 'stagekicker';
        k.textContent = 'On stage';
        el.appendChild(k);
      }
      const keep = new Set(ids);
      for (const card of el.querySelectorAll('.stagecard')) if (!keep.has(card.dataset.peer)) card.remove();
      for (const id of ids) {
        let card = null;
        for (const c of el.querySelectorAll('.stagecard')) if (c.dataset.peer === id) card = c;
        if (!card) {
          card = document.createElement('div');
          card.className = 'stagecard';
          card.dataset.peer = id;
          card.tabIndex = 0;
          card.setAttribute('role', 'group');
          const name = document.createElement('span');
          name.className = 'stagename';
          const bar = document.createElement('div');
          bar.className = 'modbar';
          bar.innerHTML = MODBAR_HTML;
          if (broadcast) {
            const demote = document.createElement('button');
            demote.type = 'button';
            demote.dataset.adm = 'demote';
            demote.textContent = 'Demote';
            demote.setAttribute('aria-label', 'Send back to watching');
            bar.appendChild(demote);
          }
          (0, /*()*/__C.wireModbar)(bar, id);
          card.appendChild(name);
          card.appendChild(bar);
          el.appendChild(card);
        }
        const nm = __C.model.roster.rosterNames()[id] || (__C.model.roster.peers().get(id) || {}).name || 'Guest';
        const nameEl = card.querySelector('.stagename');
        if (nameEl && nameEl.textContent !== nm) nameEl.textContent = nm;
        const aria = nm + '. Guest controls.';
        if (card.getAttribute('aria-label') !== aria) card.setAttribute('aria-label', aria);
        (0, /*()*/__C.paintModbarButtons)(card.querySelector('.modbar'), id);
      }
    }
    yield 524;
    function paintRaisedHands() {
      const el = document.getElementById('handraise');
      if (!el) return;
      const broadcast = __C.model.room.BROADCAST();
      const host = broadcast && ((typeof __C.bcHostStored === 'function' && (0, /*()*/__C.bcHostStored)()) || document.body.classList.contains('amadmin'));
      const watching = document.body.classList.contains('bc-watching');
      const rows = (!broadcast || !host || watching) ? [] : __C.model.hands.rows();
      if (!rows.length) {
        el.classList.remove('on');
        el.hidden = true;
        for (const row of el.querySelectorAll('.raiserow')) row.remove();
        return;
      }
      el.hidden = false;
      el.classList.add('on');
      if (!el.querySelector('.raisekicker')) {
        const k = document.createElement('span');
        k.className = 'raisekicker';
        k.textContent = 'Raised hands';
        el.insertBefore(k, el.firstChild);
      }
      const keep = new Set(rows.map((r) => r.id));
      for (const row of el.querySelectorAll('.raiserow')) if (!keep.has(row.dataset.peer)) row.remove();
      for (const r of rows) {
        let row = null;
        for (const c of el.querySelectorAll('.raiserow')) if (c.dataset.peer === r.id) row = c;
        if (!row) {
          row = document.createElement('div');
          row.className = 'raiserow';
          row.dataset.peer = r.id;
          row.setAttribute('role', 'group');
          const name = document.createElement('span');
          name.className = 'raisename';
          const acts = document.createElement('div');
          acts.className = 'raiseacts';
          acts.innerHTML = '<button type="button" data-raise="promote">Promote</button>'
            + '<button type="button" data-raise="mute">Mute</button>'
            + '<button type="button" data-raise="blur">Blur</button>'
            + '<button type="button" data-raise="ban">Ban</button>';
          row.appendChild(name);
          row.appendChild(acts);
          el.appendChild(row);
        }
        const nameEl = row.querySelector('.raisename');
        if (nameEl && nameEl.textContent !== r.name) nameEl.textContent = r.name;
        const aria = r.name + '. Raised hand.';
        if (row.getAttribute('aria-label') !== aria) row.setAttribute('aria-label', aria);
        try {
          const mod = (0, /*()*/__C.modOf)(r.id);
          const mute = row.querySelector('[data-raise="mute"]');
          const blur = row.querySelector('[data-raise="blur"]');
          if (mute) mute.textContent = (mod.mute && mod.mute.on) ? 'Unmute' : 'Mute';
          if (blur) blur.textContent = (mod.blur && mod.blur.on) ? 'Unblur' : 'Blur';
        } catch (e) {}
      }
    }
    yield 526;
    (function () {
      const el = document.getElementById('handraise');
      if (!el) return;
      el.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('button') : null;
        const row = btn && btn.closest('.raiserow');
        if (!btn || !row) return;
        e.stopPropagation();
        __C.act.handAct(row.dataset.peer, btn.dataset.raise);
      });
    })();
    function makeTile(id, name, isMe, headless) {
      const tile = document.createElement('div');
      tile.className = 'tile' + (isMe ? ' me' : '');
      tile.dataset.peer = id;
      tile.dataset.pzkey = 'peer:' + id;
      if (!isMe) {
        tile.tabIndex = 0;
        tile.setAttribute('role', 'group');
        tile.setAttribute('aria-label', (name || (0, /*()*/__C.uiText)('rosterPerson', 'Participant')) + '. ' + (0, /*()*/__C.uiText)('tileControls', 'Controls for this person.'));
      }
      const video = document.createElement('video');
      video.autoplay = true; video.playsInline = true;
      if (isMe) video.muted = true;
      const avatar = document.createElement('div');
      avatar.className = 'avatar'; avatar.textContent = (0, /*()*/__C.nameInitial)(name);
      const label = document.createElement('span');
      label.className = 'name'; label.textContent = name || '…';
      const chips = document.createElement('div');
      chips.className = 'chips';
      const cap = document.createElement('div');
      cap.className = 'cap';
      tile.appendChild(video); tile.appendChild(avatar); tile.appendChild(label); tile.appendChild(chips); tile.appendChild(cap);
      // Full screen opens the filmstrip view (#fsview): this feed big, every
      // other live feed as tappable floating thumbs. Esc / ✕ exits. iOS
      // Safari can only fullscreen a <video>, so it gets the native one.
      if (window.ResizeObserver) {
        if (!makeTile.slimObs) {
          makeTile.slimObs = new ResizeObserver((list) => list.forEach((en) => {
            // A removed tile reports 0x0 once; let it go.
            if (!en.target.isConnected) { makeTile.slimObs.unobserve(en.target); return; }
            const w = en.contentRect.width;
            const h = en.contentRect.height;
            if (w > 0) { en.target.classList.toggle('slim', w < 200); en.target.classList.toggle('thin', w < 116); en.target.classList.toggle('short', w < 200 && h > 0 && h < 130); }
            if (h > 0) en.target.style.setProperty('--th', Math.round(h) + 'px'); // sizes a short tile's initial
            if (w > 0) en.target.style.setProperty('--bw', Math.round(Math.max(w, h)) + 'px'); // the receiver blur's size: the long side (blurSized)
          }));
        }
        try { makeTile.slimObs.observe(tile); } catch (e) {}
      }
      let modbar = null, voteBtn = null;
      if (!isMe) {
        // The vote TARGET (non-admin rooms): hidden until the bar's Vote menu
        // arms a mode — then it's the green dot / red ✕ centered on the tile.
        voteBtn = document.createElement('button');
        voteBtn.className = 'votedot';
        voteBtn.setAttribute('aria-label', 'Vote');
        voteBtn.addEventListener('click', (e) => { e.stopPropagation(); __C.act.castVote(id); });
        tile.appendChild(voteBtn);
        modbar = document.createElement('div');
        modbar.className = 'modbar';
        modbar.innerHTML = MODBAR_HTML;
        (0, /*()*/__C.wireModbar)(modbar, id);
        tile.appendChild(modbar);
        tile.addEventListener('click', () => {
          // A sideways phone opens the menu away from the tile; it names whose it is.
          modbar.dataset.who = label.textContent;
          modbar.setAttribute('aria-label', label.textContent);
          tile.classList.toggle('menu'); // tap = menu on phones
        });
        // On a slim phone tile the open menu fills the tile, so a second tap
        // there lands on Mute for everyone. A tap anywhere else closes it.
        if (!makeTile.menuOff && typeof document.addEventListener === 'function') {
          makeTile.menuOff = true;
          document.addEventListener('click', (e) => {
            document.querySelectorAll('.tile.menu').forEach((t) => { if (!t.contains(e.target)) t.classList.remove('menu'); });
          }, true);
        }
      }
      // Headless (uplink-only) peers keep the full tile machinery — video
      // element, meters, chips — but never enter the grid: a fellow delegate
      // is plumbing, not a face on your wall.
      if (!headless) grid.appendChild(tile);
      stampTileOpen(tile);
      return { tile, video, label, avatar, chips, cap, modbar, voteBtn };
    }
    // The sheet opens from this corner only. A tap on the picture does not.
    function stampTileOpen(el) {
      if (!el || !el.classList) return;
      if (el.querySelector(':scope > .tile-open')) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tile-open';
      b.textContent = 'Open';
      b.setAttribute('aria-label', 'Open');
      b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openTileWin(el);
      });
      el.appendChild(b);
    }
    yield 533;
    function paintTileChrome(t, id, isMe, st) {
      if (!t || !t.tile || typeof t.tile.querySelector !== 'function') return;
      if (typeof document === 'undefined' || !document || typeof document.createElement !== 'function') return;
      const tile = t.tile;
      if (st && st.bot) {
        let mark = tile.querySelector(':scope > .botbadge');
        if (!mark) { mark = document.createElement('span'); mark.className = 'botbadge'; tile.appendChild(mark); }
        // nts: the agent keeps notes (1), or asks the host first (2): js/meet-agent.js, from the moment it subscribes
        const nm = st.nts === 1 ? 'notes' : st.nts === 2 ? 'ask' : 'note';
        if (mark.getAttribute('data-mark') !== nm) {
          mark.setAttribute('data-mark', nm);
          if (nm === 'note') {
            mark.title = 'Note bot';
            mark.innerHTML = __C.model.consts.AI_SPARK_SVG() + 'bot';
          } else {
            mark.title = '';
            mark.innerHTML = __C.model.consts.AI_SPARK_SVG();
            mark.appendChild(document.createTextNode(nm === 'notes' ? (0, /*()*/__C.uiText)('botTakingNotes', 'bot \u00b7 taking notes') : (0, /*()*/__C.uiText)('botNotesAsk', 'bot \u00b7 asks to take notes')));
          }
        }
      } else {
        const mark = tile.querySelector(':scope > .botbadge');
        if (mark && mark.remove) mark.remove();
      }
      let bubble = tile.querySelector(':scope > .thinkbubble');
      if (st && st.bot && st.think) {
        if (!bubble) {
          bubble = document.createElement('div');
          bubble.className = 'thinkbubble';
          bubble.setAttribute('role', 'img');
          bubble.innerHTML = '<i></i><i></i><i></i>';
          tile.appendChild(bubble);
        }
        const thinking = (0, /*()*/__C.uiText)('botThinking', 'Thinking…');
        if (bubble.getAttribute('aria-label') !== thinking) { bubble.setAttribute('aria-label', thinking); bubble.title = thinking; }
      } else if (bubble && bubble.remove) bubble.remove();
      let box = tile.querySelector(':scope > .blurbox');
      const power = !isMe && (0, /*()*/__C.localBlurPower)();
      if (!power) {
        if (box && box.remove) box.remove();
        return;
      }
      if (!box) {
        box = document.createElement('button');
        box.type = 'button';
        box.className = 'blurbox';
        box.addEventListener('click', (e) => {
          e.stopPropagation();
          if (e.preventDefault) e.preventDefault();
          try {
            const cur = (0, /*()*/__C.modOf)(id).blur;
            (0, /*()*/__C.setMod)(id, 'blur', !(cur && cur.on));
          } catch (err) {}
        });
        tile.appendChild(box);
      }
      let on = false, by = '', offer = '';
      try { const m = (0, /*()*/__C.modOf)(id).blur; on = !!(m && m.on); by = (m && m.by) || ''; offer = (0, /*()*/__C.blurOffer)(id); } catch (e) {}
      // One wording for this control everywhere: the menu says the same.
      const words = (0, /*()*/__C.hostWords)('blur', on);
      // Two lines on a phone's 64px square ("Blur" / "for all"); whole words on a wide window.
      const label = phoneLayout() ? words.replace(/ /g, '\n') : words;
      box.className = offer ? 'blurbox on' : 'blurbox';
      if (box.textContent !== label) box.textContent = label;
      box.setAttribute('aria-label', words);
      box.setAttribute('aria-pressed', on ? 'true' : 'false');
      const tip = words + (on && by ? ' (blurred by ' + by + ')' : '');
      if (box.title !== tip) box.title = tip;
    }
    yield 538;
    function layout() {
      __C.model.roster.reactStats().layouts++;
      // One order: the banner's queue (handQueue), so a tile and the banner never disagree.
      const rank = new Map(__C.model.hands.queue().map((e, i) => [e.i === __C.model.me.myId() ? 'me' : e.i, i]));
      const stg = (0, /*()*/__C.stageIds)(); // the Stage floats first, in step-up order
      const apply = (id, t) => {
        const focused = __C.focusId === id;
        t.tile.classList.toggle('focus', focused);
        const si = stg.indexOf(id === 'me' ? __C.model.me.myId() : id);
        t.tile.classList.toggle('onstage', si >= 0);
        let o = rank.has(id) ? -5000 + rank.get(id) : 0;
        if (si >= 0) o = -60000 + si;             // the stage outranks raised hands
        if (id !== 'me' && t.noRoute) o = 100000; // unreachable → gracefully sink to the bottom
        if (focused) o = -100000;                 // …unless you chose to focus them anyway
        t.tile.style.order = o;
      };
      if (__C.model.me.meTile()) apply('me', __C.model.me.meTile());
      for (const [pid, p] of __C.model.roster.peers()) apply(pid, p);
      // Once someone else is here, you leave the grid and float. The count
      // is the other people, so one other person fills the stage.
      // A person held in the waiting room is off this screen: no space for them.
      const remoteTiles = [];
      for (const [, p] of __C.model.roster.peers()) if (p && p.tile && !p.held) remoteTiles.push(p.tile);
      remoteTiles.sort((a, b) => (parseFloat(a.style.order) || 0) - (parseFloat(b.style.order) || 0));
      let nRemote = 0;
      for (const [, p] of __C.model.roster.peers()) if (!(p && p.held)) nRemote++;
      if (typeof __C.model.roster.rosterTiles() === 'object' && __C.model.roster.rosterTiles()) for (const t of __C.model.roster.rosterTiles().values()) if (t && t.parentNode) { remoteTiles.push(t); nRemote++; } // held "Reconnecting…" faces take their place in the row
      document.body.classList.toggle('has-peers', nRemote > 0);
      if (grid) grid.setAttribute('data-remotes', String(nRemote));
      remoteTiles.forEach((t, i) => {
        t.classList.toggle('lead', nRemote === 3 && i === 0);
        t.classList.toggle('span-bottom', nRemote === 5 && i === remoteTiles.length - 1);
      });
      try { applyComfy(); } catch (e) {}
      try { svPlace(); } catch (e) {}
    }

    // Members hidden from the row are the stadium. Stagers stay in the row
    // while comfy is on (their direct tile is the face; the strip is not).
    function comfyStadRoster() {
      // While I wait I see no one; a held person is no one's face here.
      if ((0, /*()*/__C.iAmWaiting)()) return [];
      const shown = {};
      if (__C.model.me.myId()) shown[__C.model.me.myId()] = true;
      for (const [pid, p] of __C.model.roster.peers()) {
        if (p && p.held) { shown[pid] = true; continue; }
        if (!p || p.headless || !p.tile) continue;
        if (p.tile.style.display !== 'none') shown[pid] = true;
      }
      if (typeof __C.model.roster.rosterTiles() === 'object' && __C.model.roster.rosterTiles()) for (const [pid, t] of __C.model.roster.rosterTiles()) if (t && t.parentNode) shown[pid] = true;   // a held face is on screen: not a stadium face too
      const out = [], seen = {};
      const push = (id) => {
        if (!id || seen[id] || shown[id]) return;
        seen[id] = true;
        out.push(id);
      };
      // STADIUM.ROSTER: the faces are the members the count reads (rosterIds), never a pc object. A pair outlives its
      // person (a crashed or departed page parks disconnected until the ring lets it go, and the tile of a pair outside my
      // row is hidden), so reading `peers` drew "Stadium \u00b7 N" over an empty box beside a header that had already let
      // them go. A page gone whose cell is held (byeIsHeld) is no face, as it is no head in the header.
      for (const id of (Array.isArray(__C.model.roster.rosterIds()) ? __C.model.roster.rosterIds() : [])) {
        if (__C.model.net.meshNode() && __C.model.net.meshNode().byeIsHeld && __C.model.net.meshNode().byeIsHeld(id)) continue;
        push(id);
      }
      return out;
    }
    function comfyStadMeta() {
      let n = 0, cols = 0, video = null, srcEl = null, ids = null, w = 0, h = 0;
      try {
        srcEl = document.querySelector('#stadium [data-row="sd"]');
        video = srcEl ? srcEl.querySelector('video') : null;
      } catch (e) {}
      try {
        if (__M.sdView && __M.sdView.count && __M.sdView.count() > 0) {
          n = __M.sdView.count(); cols = __M.sdView.cols() || 0; const ci = __M.sdView.cellIds ? __M.sdView.cellIds() : null; if (ci && ci.length === n) ids = ci;
          // The composite's own canvas is the frame size (the hidden source
          // <video> lies on an engine that never loads it, or stops following
          // its growth: chaos-1019, the lone row-3 letters).
          if (video && __M.sdView.canvas && video.srcObject && video.srcObject.getVideoTracks()[0] === __M.sdView.track) { w = __M.sdView.canvas.width | 0; h = __M.sdView.canvas.height | 0; }
        }
      } catch (e) {}
      try {
        if (!(n > 0) && __C.mosIn) {
          const m = __C.mosIn.get('sdm') || __C.mosIn.get('sd');
          if (m && m.meta) { if (m.meta.n) n = m.meta.n; if (m.meta.cols) cols = m.meta.cols; if (Array.isArray(m.meta.ids) && m.meta.ids.length === m.meta.n) ids = m.meta.ids.slice(); }
        }
      } catch (e) {}
      return { n: n | 0, cols: cols | 0, ids: ids, video: video, srcEl: srcEl, w: w > 2 ? w : 0, h: h > 2 ? h : 0 };
    }
    let comfyBusy = false;
    yield 543;
    function ensureStageView(feed, id, track) {
      // A Stage view wears the receiver's blur for that person on the Stage (blurLevelFor with where 'stage'), as a
      // grid tile does: a sender that sends clear pixels where the room keeps them blurred stays blurred here. My own
      // view shows my own track, which already carries my blur.
      function paintStageViewBlur(el, id) {
        const vid = el && el.querySelector && el.querySelector('video');
        if (!vid) return;
        let bl = 0;
        try {
          if (id !== __C.model.me.myId()) { bl = (0, /*()*/__C.blurLevelFor)(id, false, false, 'stage') | 0; if ((0, /*()*/__C.modBlurOn)(id)) bl = Math.max(1, bl); }
        } catch (e) { bl = 2; }
        vid.classList.toggle('blur1', bl === 1);
        vid.classList.toggle('blur2', bl >= 2);
        // A stager's share shown here keeps its text clear under that blur (fsBlurClass's rule), unless a host blurs them.
        let tc = false;
        try { tc = !!(bl && id !== __C.model.me.myId() && (0, /*()*/__C.sharingScreen)(id) && !(0, /*()*/__C.modBlurOn)(id) && !(0, /*()*/__C.forcedCamOff)(id) && !(typeof __C.shareBlocked === 'function' && (0, /*()*/__C.shareBlocked)(id))); } catch (e) { tc = false; }
        try { if (GifOS.textClear) GifOS.textClear.view(vid, tc); } catch (e) {}
      }
      ensureStageView.paintBlur = paintStageViewBlur;   // paintStageBlurWhy repaints the views' blur too
      if (!applyComfy.views) applyComfy.views = new Map();
      let el = applyComfy.views.get(id);
      if (!el || (el.isConnected === false)) {
        el = document.createElement('div');
        el.className = 'tile';
        el.dataset.stageview = id;
        const vid = document.createElement('video');
        vid.muted = true; vid.autoplay = true; vid.playsInline = true;
        vid.setAttribute('playsinline', '');
        const nm = document.createElement('div');
        nm.className = 'name';
        el.appendChild(vid);
        el.appendChild(nm);
        feed.appendChild(el);
        applyComfy.views.set(id, el);
        __C.model.roster.stageViewEls().set(id, el);   // the meter frames it while this person talks
      }
      const vid = el.querySelector('video');
      if (vid && vid._vt !== track) {
        vid._vt = track;
        try { vid.srcObject = new MediaStream([track]); } catch (e) { try { vid.srcObject = null; } catch (e2) {} }
        const pr = vid.play(); if (pr && pr.catch) pr.catch(function () {});
      }
      const nm = el.querySelector('.name');
      let label = '';
      try { label = (0, /*()*/__C.displayName)(id) || ''; } catch (e) {}
      if (nm && nm.textContent !== label) nm.textContent = label;
      try { paintBlurWhy({ tile: el }, id === __C.model.me.myId() ? (0, /*()*/__C.tileBlurWhy)('me', __C.model.me.myStatus(), 'stage') : (0, /*()*/__C.tileBlurWhy)(id, __C.model.roster.statusOf().get(id), 'stage')); } catch (e) {}
      paintStageViewBlur(el, id);
      return el;
    }
    function dropStageViews(keep) {
      if (!applyComfy.views) return;
      for (const [id, el] of [...applyComfy.views]) {
        if (keep && keep.has(id)) continue;
        const vid = el.querySelector && el.querySelector('video');
        if (vid) { try { vid.srcObject = null; } catch (e) {} }
        try { if (el.remove) el.remove(); } catch (e) {}
        applyComfy.views.delete(id);
        __C.model.roster.stageViewEls().delete(id);
      }
    }
    function applyComfy() {
      if (comfyBusy) return;
      const MV = (typeof GifOS !== 'undefined' && GifOS.meetViews) || null;
      if (!MV || !MV.apply) return;
      const feed = document.getElementById('feed');
      const allowed = !!__C.model.me.meTile() && MV.comfyAllowed(document.body);
      document.body.classList.toggle('comfy', allowed);
      if (!allowed || !feed) {
        try { MV.clearRoot(feed); } catch (e) {}
        try { dropStageViews(null); } catch (e) {}
        return;
      }
      comfyBusy = true;
      try {
        const tiles = [];
        const stg = (0, /*()*/__C.stageIds)();
        if (__C.model.me.meTile() && __C.model.me.meTile().tile && __C.model.me.meTile().tile.style.display !== 'none') {
          const selfPin = !!(window.__meetSwapSelf || (window.__meetSelf && window.__meetSelf.onStage));
          tiles.push({ id: 'me', el: __C.model.me.meTile().tile, tier: __C.model.me.myStatus().bot ? 'bot' : 'row', me: true, bot: !!__C.model.me.myStatus().bot, shade: (0, /*()*/__C.shadeKey)('me'),
            hand: !!__C.model.me.myStatus().hand, handOrd: __C.model.me.myStatus().hand || 0,
            // A self-view pin can place your tile on your own stage. It is not room membership.
            stage: selfPin,
            shareFace: !__C.model.me.myStatus().bot && !!__C.model.me.myStatus().scr,
            stageOrd: Math.max(0, stg.indexOf(__C.model.me.myId())),
            speaker: !__C.model.me.myStatus().bot && !!(__C.model.roster.speakingOf() && __C.model.roster.speakingOf().get && __C.model.roster.speakingOf().get('me')), pz: 'peer:me' });
        }
        for (const [pid, p] of __C.model.roster.peers()) {
          if (!p || !p.tile || p.headless || p.held || !p.tile.parentNode || p.tile.style.display === 'none') continue;   // a tile off the grid takes no slot
          const st = __C.model.roster.statusOf().get(pid) || {};
          const si = stg.indexOf(pid);
          const bot = !!st.bot;
          tiles.push({ id: pid, el: p.tile, tier: bot ? 'bot' : 'row', bot: bot, shade: (0, /*()*/__C.shadeKey)(pid),
            hand: !!st.hand, handOrd: st.hand || 0,
            stage: si >= 0, stageOrd: Math.max(0, si),
            // A sharer's screen is the Stage (the sgs strip below); their face stays in the Row.
            shareFace: !bot && (() => { try { return !!(0, /*()*/__C.sharingScreen)(pid); } catch (e) { return false; } })(),
            speaker: !bot && !!(__C.model.roster.speakingOf() && __C.model.roster.speakingOf().get && __C.model.roster.speakingOf().get(pid)), pz: 'peer:' + pid });
        }
        // A held face is on the grid too: it takes a slot of its own in the pack, or it keeps the box of the pass before
        // and the next face is drawn over it (two names in one slot).
        if (typeof __C.model.roster.rosterTiles() === 'object' && __C.model.roster.rosterTiles()) for (const [pid, el] of __C.model.roster.rosterTiles()) {
          if (!el || !el.parentNode || tiles.some((x) => x.id === pid)) continue;
          tiles.push({ id: pid, el: el, tier: 'row', bot: false, shade: (0, /*()*/__C.shadeKey)(pid), hand: false, handOrd: 0, stage: false, stageOrd: 0, shareFace: false, speaker: false, pz: 'peer:' + pid });
        }
        for (const t of tiles) if (t.shareFace) t.stage = false;
        // Pin (the tile window) puts that person on my Stage only.
        for (const t of tiles) if (__C.focusId && t.id === __C.focusId) t.stage = true;
        // The Stage strip (a shared screen, or the stage composite) at its true aspect.
        const sgs = document.querySelector('#stagefeed [data-row="sgs"]');
        const sgsV = sgs && sgs.querySelector('video');
        const sgsOn = !!(sgsV && sgsV.srcObject);
        for (let i = 0; i < tiles.length; i++) {
          tiles[i].seatHeld = false;
          try { if (tiles[i].el) tiles[i].el.classList.remove('seat-held'); } catch (e) {}
        }
        let stagersNow = [];
        try { stagersNow = (0, /*()*/__C.stageIds)(); } catch (e) {}
        let sharersNow = [];
        try { sharersNow = (0, /*()*/__C.screenSharers)(); } catch (e) {}
        const screenOn = !!(sgsOn && sharersNow.length);
        // People on stage, in stage order, excluding whoever is sharing
        // (their camera stays in the row; the screen is the share).
        const packIds = [];
        for (let i = 0; i < stagersNow.length; i++) {
          if (sharersNow.indexOf(stagersNow[i]) >= 0) continue;
          packIds.push(stagersNow[i]);
        }
        let packSources = [];
        let packOn = packIds.length > 0;
        if (packOn) {
          for (let i = 0; i < packIds.length; i++) {
            const src = (0, /*()*/__C.stageFeedVideo)(packIds[i]);
            if (!src) { packOn = false; packSources = []; break; }
            packSources.push({ id: packIds[i], track: src.track, aspect: src.aspect });
          }
        }
        if (sgsV && !sgsV._packMeta) {
          sgsV._packMeta = true;
          const again = () => { try { layout(); } catch (e) {} };
          sgsV.addEventListener('loadedmetadata', again);
          sgsV.addEventListener('resize', again);
        }
        let sgsAspect = 16 / 9;
        if (sgsV && sgsV.videoWidth > 0 && sgsV.videoHeight > 0) sgsAspect = sgsV.videoWidth / sgsV.videoHeight;
        // The strip is placed when it is the picture: a screen share, or the
        // people bar because a per-person feed is not ready yet. A per-person
        // pack parks the strip (show-stage off) unless the strip element is
        // the screen itself.
        let placeStrip = false;
        if (sgsOn && packOn) {
          const row = [];
          const keepViews = new Set();
          for (let i = 0; i < tiles.length; i++) {
            const t = tiles[i];
            const sid = t.me ? __C.model.me.myId() : t.id;
            const onStrip = !!(sid && packIds.indexOf(sid) >= 0 && !t.shareFace && !(__C.focusId && t.id === __C.focusId));
            t.seatHeld = onStrip;
            try {
              if (t.el) {
                t.el.classList.toggle('seat-held', onStrip);
                if (onStrip) t.el.classList.add('comfy-off');
              }
            } catch (e) {}
            if (onStrip) { t.stage = false; continue; }
            row.push(t);
          }
          tiles.length = 0;
          const views = [];
          for (let i = 0; i < packSources.length; i++) {
            const src = packSources[i];
            // A focused row tile is already in the list. Do not draw them twice.
            if (__C.focusId && src.id === __C.focusId) continue;
            keepViews.add(src.id);
            const el = ensureStageView(feed, src.id, src.track);
            views.push({ id: 'stg:' + src.id, el: el, tier: 'row', stage: true, kind: 'person', aspect: src.aspect, shade: (0, /*()*/__C.shadeKey)(src.id), pz: 'stage:' + src.id });
          }
          for (let i = 0; i < views.length; i++) tiles.push(views[i]);
          for (let i = 0; i < row.length; i++) tiles.push(row[i]);
          dropStageViews(keepViews);
          svFaces(views.map((x) => ({ el: x.el, aspect: x.aspect })));
          // A shared screen is content (Nathan 2026-11-11): it shows in the
          // content area's tab, from its own stage feed, not as this strip.
          if (sgs && sgs.dataset) sgs.dataset.pack = '1';
        } else if (sgsOn) {
          // The strip is this person's picture. Their row tile leaves the
          // layout so the others close up. A sharer keeps their face (their
          // camera is not the stage picture). A Pin keeps its tile.
          // comfy-off hides the element without setting style.display, so the
          // stadium roster still counts a row-mate as already shown.
          const row = [];
          for (let i = 0; i < tiles.length; i++) {
            const t = tiles[i];
            const sid = t.me ? __C.model.me.myId() : t.id;
            const onStrip = !!(sid && stagersNow.indexOf(sid) >= 0 && !t.shareFace && !(__C.focusId && t.id === __C.focusId));
            t.seatHeld = onStrip;
            try {
              if (t.el) {
                t.el.classList.toggle('seat-held', onStrip);
                if (onStrip) t.el.classList.add('comfy-off');
              }
            } catch (e) {}
            if (onStrip) { t.stage = false; continue; }
            row.push(t);
          }
          tiles.length = 0;
          for (let i = 0; i < row.length; i++) tiles.push(row[i]);
          // Screens are content (their tabs). The strip stays the stage
          // picture only while it carries faces: people on stage whose own
          // feeds are not here yet.
          if (packIds.length || !screenOn) {
            placeStrip = true;
            tiles.unshift({ id: 'stage:sgs', el: sgs, tier: 'row', stage: true, share: true, kind: 'strip', aspect: sgsAspect, pz: 'stage:sgs' });
            svFaces([{ el: sgs, aspect: sgsAspect }]);
          } else svFaces([]);
          dropStageViews(null);
          if (sgs && sgs.dataset) delete sgs.dataset.pack;
        } else {
          for (let i = 0; i < tiles.length; i++) {
            tiles[i].seatHeld = false;
            try { if (tiles[i].el) tiles[i].el.classList.remove('seat-held'); } catch (e) {}
          }
          svFaces([]);
          dropStageViews(null);
          if (sgs && sgs.dataset) delete sgs.dataset.pack;
        }
        // An app in the meeting takes the seat a shared screen takes. Its
        // pane stays where it is in the page (moving an iframe reloads it):
        // a stand-in holds the seat in the layout and the pane is pinned on it.
        const appSeat = document.getElementById('appseat');
        const appOn = !!appSeat && document.body.classList.contains('has-app');
        // Screens, the app and the agenda are one content area with tabs
        // (contentTile, below): none of them takes a stage seat.
        const ctOn = (0, /*()*/__C.contentHas)();
        // A share, or an app in that seat, fills the left side. Show me on
        // stage keeps your tile with the people until that share ends.
        // A people strip does not: those faces are the stage.
        if (screenOn || appOn || ctOn) {
          for (let i = 0; i < tiles.length; i++) if (tiles[i].me) tiles[i].stage = false;
        }
        document.body.classList.toggle('show-stage', placeStrip);
        const meta = comfyStadMeta();
        const roster = comfyStadRoster();
        // Faces are the people not already on screen. The packer's count
        // only drives the crop, and only when it names this same set.
        const faces = [];
        // Once per pass, not once per face (a 240 roster called it 240 times).
        let stagersFace = [];
        try { stagersFace = (0, /*()*/__C.stageIds)(); } catch (e) {}
        for (let j = 0; j < roster.length; j++) {
          const id = roster[j];
          let name = '\u2026';
          try { name = (0, /*()*/__C.displayName)(id) || name; } catch (e) {}
          // A camera-off face (or one we have not heard from yet) shows
          // initials. The composite cell for that person is black. A share
          // does not change that: the screen is the stage strip, and the
          // parked camera sender would paint this cell black over the letter.
          const st = __C.model.roster.statusOf().get(id) || null;
          const off = !st || (!!st.camOff && !st.rb);
          let avatar = '';
          try { avatar = (MV.avatarUrl && MV.avatarUrl(st || {}, null)) || ''; } catch (e2) {}
          // A camera on the Stage is left out of this drawing. A screen
          // share whose camera is not on stage is unchanged.
          let held = false;
          try {
            const sharing = id === __C.model.me.myId() ? !!__C.model.me.myStatus().scr : (typeof __C.sharingScreen === 'function' && !!(0, /*()*/__C.sharingScreen)(id));
            held = stagersFace.indexOf(id) >= 0 && !sharing;
          } catch (e3) { held = false; }
          faces.push({ id: id, name: name, initials: held ? '' : (0, /*()*/__C.nameInitial)(name), off: off || held, avatar: held ? '' : avatar, shade: (0, /*()*/__C.shadeKey)(id), held: held });
        }
        // A camera on the Stage is not a stadium face here. Nothing is sent
        // back. When this browser's picture already has one cell per person
        // still in the stadium, the box is that count. A cell it still names
        // is left out of the drawing. A picture this page cannot cut stays
        // whole, so the box is not a slit around a larger frame.
        let cellOf = null;
        if (Array.isArray(meta.ids) && meta.ids.length === meta.n && meta.n > 0) {
          const at = new Map();
          for (let k = meta.ids.length - 1; k >= 0; k--) {
            if (meta.ids[k] == null || meta.ids[k] === '') continue;
            at.set(meta.ids[k], k); // first cell wins, as indexOf did
          }
          cellOf = faces.map((f) => (at.has(f.id) ? at.get(f.id) : -1));
        }
        const shownFaces = [];
        const skipCells = [];
        const restIx = [];
        const heldIx = [];
        // A picture that names its cells holds exactly those people: a face with no cell in it (a watcher with no
        // camera, a seat another picture carries) is not drawn by this box, and a count match never puts it there.
        for (let fi = 0; fi < faces.length; fi++) { if (faces[fi].held) heldIx.push(fi); else if (!cellOf || cellOf[fi] >= 0) restIx.push(fi); }
        const nPic = meta.n | 0;
        let pictureCells = 0;
        let cut = false;
        if (restIx.length === 0) {
          // Everyone past the row is on the stage. No stadium box.
        } else if (nPic === restIx.length || nPic === 0) {
          for (let ri = 0; ri < restIx.length; ri++) shownFaces.push(faces[restIx[ri]]);
        } else if (cellOf && nPic > restIx.length) {
          const skip = [];
          const seen = {};
          let unnamedHeld = 0;
          for (let hi = 0; hi < heldIx.length; hi++) {
            const ix = cellOf[heldIx[hi]];
            if (ix >= 0) { if (!seen[ix]) { seen[ix] = true; skip.push(ix); } }
            else unnamedHeld++;
          }
          const nulls = [];
          if (Array.isArray(meta.ids)) {
            for (let ni = 0; ni < meta.ids.length; ni++) if ((meta.ids[ni] == null || meta.ids[ni] === '') && !seen[ni]) nulls.push(ni);
          }
          const namedOk = unnamedHeld === 0 && skip.length + restIx.length === nPic;
          const paired = unnamedHeld > 0 && unnamedHeld === nulls.length && skip.length + nulls.length + restIx.length === nPic;
          if (paired) for (let ni = 0; ni < nulls.length; ni++) skip.push(nulls[ni]);
          let restFound = restIx.length > 0;
          for (let ri = 0; ri < restIx.length; ri++) if (!(cellOf[restIx[ri]] >= 0)) restFound = false;
          const MM = (typeof GifOS !== 'undefined' && GifOS.meshMedia) || null;
          let square = false;
          if (MM && typeof MM.faceSrcRect === 'function' && (meta.cols | 0) > 0 && meta.w > 2 && meta.h > 2) {
            const s = MM.faceSrcRect(0, nPic, meta.cols | 0, meta.w, meta.h);
            square = !!(s && s.sw > 0 && Math.abs(s.sw - s.sh) <= 0.08 * s.sw);
          }
          if (restFound && square && (paired || namedOk) && skip.length > 0) {
            for (let si = 0; si < skip.length; si++) skipCells.push(skip[si]);
            for (let ri = 0; ri < restIx.length; ri++) shownFaces.push(faces[restIx[ri]]);
            cut = true;
          }
        }
        if (!cut && restIx.length > 0 && shownFaces.length === 0) {
          if (nPic === faces.length) {
            for (let fi = 0; fi < faces.length; fi++) shownFaces.push(faces[fi]);
          } else if (nPic > restIx.length) {
            // The frame still has more cells than the people left. Size the
            // box to the frame. Do not squeeze it down to the shorter count.
            for (let ri = 0; ri < restIx.length; ri++) shownFaces.push(faces[restIx[ri]]);
            pictureCells = nPic;
          }
        }
        // FAR PEOPLE (the far room of a joining connection, SUB.4, TURN.11) are in no roster of mine: only the Stadium
        // picture carries them. When that picture is on (not quiet) and holds people who are not on my screen, it is the
        // stadium box, whole. Before (0.9.28.30, hotel): it had no box, so its source strip drew itself unplaced at full
        // width over the Stage and the row, a giant blurred letter behind the tiles. The people it holds: the cells it
        // names that are not on screen; a picture that names none counts them (the meeting's count past my faces on screen).
        if (!shownFaces.length && !heldIx.length && meta.srcEl && meta.srcEl.style.display !== 'none' && (nPic > 0 || meta.srcEl.querySelector(':scope > .tpause'))) {
          let far = [];
          const onScr = {};
          if (__C.model.me.myId()) onScr[__C.model.me.myId()] = true;
          for (const [pid, p] of __C.model.roster.peers()) if (p && (p.held || (p.tile && !p.headless && p.tile.style.display !== 'none'))) onScr[pid] = true;
          for (const id of stagersFace) onScr[id] = true;
          if (Array.isArray(meta.ids)) far = meta.ids.filter((id) => id && !onScr[id]);
          // The head count stands in only for a picture that names no cells, or no picture (its paused note): a picture
          // that names its cells is exactly those people, so a count gap (a tile-less watcher) never opens a box over it.
          if (!far.length && !(Array.isArray(meta.ids) && nPic > 0)) {   // unnamed cells, or a far room whose pipe carries no picture (its paused note, TURN.11)
            let mc = null, fs = 0;
            try { const mn = __C.model.net.meshNode(); mc = mn && typeof mn.meetingCount === 'function' ? mn.meetingCount() : null; fs = Object.keys(onScr).length; } catch (e) { mc = null; }
            if (mc != null && mc > fs) far = new Array(Math.max(1, Math.min(mc - fs, nPic || mc - fs))).fill('');
          }
          for (const id of far) {
            let name = '…';
            try { if (id) name = (0, /*()*/__C.displayName)(id) || name; } catch (e) {}
            shownFaces.push({ id: id, name: name, initials: '', off: false, avatar: '', shade: (0, /*()*/__C.shadeKey)(id || 'stad'), held: false });
          }
          if (far.length && nPic > 0) pictureCells = nPic;
        }
        const cols = (skipCells.length && (meta.cols | 0) > 0) ? (meta.cols | 0) : cellOf ? (meta.cols || 0) : (meta.n === roster.length) ? (meta.cols || 0) : 0;
        if (meta.video && !meta.video._comfyRz) {
          meta.video._comfyRz = true;
          meta.video.addEventListener('resize', () => { try { layout(); } catch (e) {} });
        }
        const vwNow = window.innerWidth, vhNow = window.innerHeight;
        // A sideways phone is short whatever its width (a Pixel 7 is 915x412);
        // a short desktop window under 900px wide is treated like one too.
        const shortLand = vhNow < 500 && vwNow > vhNow && (vwNow < 900 || !document.body.classList.contains('desk-ptr'));
        const phone = vwNow < 600 || shortLand;
        let holdMs = 2500;
        try { holdMs = __M.STAGE_FACE_SETTLE_MS; } catch (e) {}
        // The dock and the header float over the tiles. Passing a measured
        // band here used to reserve that band in the gallery, so the tiles
        // stopped short of the screen and a wake could resize them.
        let floor = 0;
        // An app is something you work, not a face. On an upright phone its
        // pane starts under the meeting's header chip, so the chip never sits
        // on the app's own header (Invite, Help, Stop app). The faces keep the
        // full screen (the layout ignores insets); the chip does not move when
        // the controls wake or tuck, so this never resizes on a wake.
        let topInset = 0;
        if (phone && !shortLand && appOn) {
          const chipEl = document.querySelector('.topchip');
          if (chipEl && chipEl.getClientRects().length && getComputedStyle(chipEl).display !== 'none') {
            topInset = Math.ceil(chipEl.getBoundingClientRect().bottom + 8);
          }
        }
        const ctTile = contentTile(phone);
        if (ctTile) tiles.unshift(ctTile);
        window.__comfyLast = MV.apply({
          feed: feed, tiles: tiles, faces: shownFaces, video: meta.video, srcW: meta.w, srcH: meta.h, cols: cols, cellN: cellOf ? meta.n : 0, ids: meta.ids, cellOf: cellOf, skipCells: skipCells, pictureCells: pictureCells,
          holdMs: holdMs, floor: floor,
          vw: window.innerWidth, vh: window.innerHeight, phone: phone, selfId: (0, /*()*/__C.shadeKey)('me'),
          pill: document.body.classList.contains('has-pill'), bottom: 0, holdBottom: 0, top: 0,
          mode: window.__meetViewMode || 'gallery',
          swapSelf: !!(window.__meetSwapSelf || (window.__meetSelf && window.__meetSelf.onStage)),
          self: window.__meetSelf || 'tile',
          gallery: window.__meetGallery || 'fit', float: window.__meetView === 'drag', now: Date.now(),
          content: ctTile ? contentOpts(phone) : null,
          // Scroll only: the Row and the Stadium carry a label (S7). The words are display text; the code keeps row and stadium.
          heads: window.__meetGallery === 'scroll' ? { row: (0, /*()*/__C.uiText)('zoneRowHead', 'Direct connections'), stad: (0, /*()*/__C.uiText)('zoneStadHead', 'Stadium connections') } : null,
          onSettle: () => { try { layout(); } catch (e) {} },
        });
        // The local Stadium view paints the columns this layout just chose.
        try {
          const sc = window.__comfyLast && window.__comfyLast.stadCols | 0;
          if (sc > 0 && __M.sdView && typeof __M.sdView.setCols === 'function') __M.sdView.setCols(sc);
        } catch (e) {}
        // Content on screen (a shared screen now; the content tabs later):
        // the one-step presentation button shows only then.
        const hasContent = !!(window.__comfyLast && window.__comfyLast.content);
        if (document.body.classList.contains('has-content') !== hasContent) document.body.classList.toggle('has-content', hasContent);
        try { contentPlace(phone); } catch (e) { (0, /*()*/__C.ctNote)('place-err', { e: String(e && e.message || e).slice(0, 120) }); }
        const pane = document.getElementById('apppane');
        if (pane) {
          for (const [k, v] of [['--seat-x', 'left'], ['--seat-y', 'top'], ['--seat-w', 'width'], ['--seat-h', 'height']]) {
            if (appOn && appSeat.style[v]) pane.style.setProperty(k, appSeat.style[v]);
            else pane.style.removeProperty(k);
          }
          if (appOn && topInset > 0) {
            const sy = parseFloat(appSeat.style.top) || 0, sh = parseFloat(appSeat.style.height) || 0;
            if (sh > 0 && sy < topInset) {
              pane.style.setProperty('--seat-y', topInset + 'px');
              pane.style.setProperty('--seat-h', Math.max(1, Math.round(sh - (topInset - sy))) + 'px');
            }
          }
        }
        // Park the source while the feed shows the stadium, and while the
        // only people past the row are on stage (the strip must not pop back).
        // The source strip never shows itself here: the stadium box (#stadwhole) is the only place its picture goes,
        // so with no box (everyone it holds is on screen) it takes no place at all.
        if (meta.srcEl) meta.srcEl.classList.add('stad-src');
        try { applyViewerCrops(); } catch (e) {}
      } finally { comfyBusy = false; }
    }
    yield 548;
    // Outline glyphs, one stroke, currentColor: the same family as the bar's icons.
    const VIEW_ICONS = {
      scroll: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="6" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="3" y="11" width="8" height="6" rx="1.5"/><rect x="13" y="11" width="8" height="6" rx="1.5"/><path d="M9 20.5l3 1.5 3-1.5"/></svg>',
      fit: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/></svg>',
      drag: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="3" width="11" height="8" rx="1.5"/><path d="M11 21l-2.6-3.6a1.3 1.3 0 0 1 2-1.6l1.1 1.1V10.5a1.3 1.3 0 0 1 2.6 0v4.2l3.3.6a1.7 1.7 0 0 1 1.4 1.9L18.3 21"/></svg>',
      focus: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="14" height="16" rx="2"/><rect x="18.5" y="4" width="3" height="4" rx="1"/><rect x="18.5" y="10" width="3" height="4" rx="1"/><rect x="18.5" y="16" width="3" height="4" rx="1"/></svg>',
      stage: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8"/><path d="M10.2 8.3l4.6 2.2-4.6 2.2z"/></svg>',
    };
    yield 555; // where Focus goes back to
    const fitbtn = document.getElementById('fitbtn');
    const viewpick = document.getElementById('viewpick');
    const vpFollow = document.getElementById('vp-follow');
    yield 559;
    function paintFit() {
      const m = window.__meetView;
      const scroll = m === 'scroll';
      document.body.classList.toggle('gallery-scroll', scroll);
      for (const k of (__C.VMODE ? __C.VMODE.VIEWS : ['scroll', 'fit', 'drag', 'focus', 'stage'])) document.body.classList.toggle('view-' + k, m === k);
      if (m !== 'stage') svLeft();
      if (!scroll) {
        const feed = document.getElementById('feed');
        if (feed) feed.scrollTop = 0;
      }
      if (fitbtn) {
        const ic = fitbtn.querySelector('.vb-ic'), wd = fitbtn.querySelector('.vb-word');
        if (ic && ic.dataset.view !== m) { ic.innerHTML = VIEW_ICONS[m] || VIEW_ICONS.fit; ic.dataset.view = m; }
        if (wd) wd.textContent = (0, /*()*/__C.viewWord)(m);
        fitbtn.dataset.view = m;
        fitbtn.setAttribute('aria-label', (0, /*()*/__C.uiText)('viewPick', 'View') + ': ' + (0, /*()*/__C.viewWord)(m));
        fitbtn.title = (0, /*()*/__C.uiText)('viewPickTip', 'Change the view (Alt+F)');
      }
      // More's View row says the view it opens on.
      const vmb = document.getElementById('viewmorebtn');
      if (vmb) vmb.textContent = (0, /*()*/__C.uiText)('viewPick', 'View') + ': ' + (0, /*()*/__C.viewWord)(m);
      if (viewpick) {
        const bc = document.body.classList.contains('broadcast');
        // The Stage radio comes after Focus, made here like its siblings (the page's markup stays as it is).
        const vpModes = viewpick.querySelector('.vp-modes');
        if (vpModes && !vpModes.querySelector('.vp-mode[data-view="stage"]')) {
          const sb = document.createElement('button');
          sb.type = 'button'; sb.className = 'vp-mode'; sb.dataset.view = 'stage'; sb.hidden = true;
          sb.setAttribute('role', 'radio'); sb.setAttribute('aria-checked', 'false');
          sb.innerHTML = '<span class="vp-ic" aria-hidden="true"></span><span class="vp-word"></span>';
          vpModes.appendChild(sb);
        }
        for (const b of viewpick.querySelectorAll('.vp-mode')) {
          const k = b.dataset.view;
          // Stage only while the Stage carries something; a broadcast has its own layout, so it offers Fit and Stage.
          b.hidden = k === 'stage' ? !(svSt().avail || m === 'stage') : (bc && k !== 'fit');
          const ic = b.querySelector('.vp-ic'), wd = b.querySelector('.vp-word');
          if (ic && !ic.firstChild) ic.innerHTML = VIEW_ICONS[k] || '';
          if (wd) wd.textContent = (0, /*()*/__C.viewWord)(k);
          b.setAttribute('aria-checked', k === m ? 'true' : 'false');
          b.tabIndex = k === m ? 0 : -1;
        }
        viewpick.setAttribute('aria-label', (0, /*()*/__C.uiText)('viewPick', 'View'));
      }
      if (vpFollow) {
        vpFollow.hidden = m !== 'focus';
        const on = fsview.classList.contains('on') ? fsSel === 'auto' : (!__C.VMODE || __C.VMODE.loadFollow(__C.model.apps.viewStore()));
        vpFollow.setAttribute('aria-checked', on ? 'true' : 'false');
        const wd = vpFollow.querySelector('.vp-word');
        if (wd) wd.textContent = (0, /*()*/__C.uiText)('viewFollow', 'Follow the speaker');
      }
    }
    yield 567;
    function closePick(refocus) {
      if (!viewpick || viewpick.hidden) return;
      viewpick.hidden = true;
      if (fitbtn) fitbtn.setAttribute('aria-expanded', 'false');
      if (refocus && fitbtn) try { fitbtn.focus(); } catch (e) {}
    }
    function openPick() {
      if (!viewpick) return;
      paintFit();
      // Under the button, its right edge on the button's. Opened from More while the button is not on the screen:
      // in the middle of the window.
      const r = fitbtn.getBoundingClientRect();
      const onScreen = r.width > 0 && r.height > 0 && getComputedStyle(fitbtn).visibility !== 'hidden';
      viewpick.style.top = Math.round(onScreen ? r.bottom + 8 : window.innerHeight * 0.28) + 'px';
      viewpick.style.right = Math.round(Math.max(8, window.innerWidth - r.right)) + 'px';
      viewpick.hidden = false;
      delete viewpick.dataset.picked;
      if (!onScreen) viewpick.style.right = Math.round(Math.max(8, (window.innerWidth - viewpick.offsetWidth) / 2)) + 'px';
      // Never past the left edge: on a phone the picker is wider than the space left of the button.
      else if (window.innerWidth - parseFloat(viewpick.style.right) - viewpick.offsetWidth < 8) viewpick.style.right = Math.round(Math.max(8, window.innerWidth - viewpick.offsetWidth - 8)) + 'px';
      fitbtn.setAttribute('aria-expanded', 'true');
      const cur = viewpick.querySelector('.vp-mode[aria-checked="true"]');
      if (cur) try { cur.focus(); } catch (e) {}
    }
    if (fitbtn) {
      fitbtn.addEventListener('click', (e) => {
        // Manual only. A crowded Fit grid never changes the view on its own.
        if (viewpick && viewpick.hidden) openPick(); else closePick(false);
      });
      // The same picker from More (View, beside Agenda), for whoever looks for it there; it opens once More has folded.
      const ag = document.getElementById('agendabtn');
      if (ag && !document.getElementById('viewmorebtn')) {
        const vb = document.createElement('button');
        vb.type = 'button'; vb.id = 'viewmorebtn';
        vb.setAttribute('aria-haspopup', 'dialog'); vb.setAttribute('aria-controls', 'viewpick');
        vb.title = (0, /*()*/__C.uiText)('viewPickTip', 'Change the view (Alt+F)');
        vb.textContent = (0, /*()*/__C.uiText)('viewPick', 'View') + ': ' + (0, /*()*/__C.viewWord)(window.__meetView || 'fit');
        vb.addEventListener('click', () => { requestAnimationFrame(() => { if (viewpick && viewpick.hidden) openPick(); }); });
        ag.after(vb);
      }
    }
    if (viewpick) {
      viewpick.addEventListener('click', (e) => {
        const b = e.target && e.target.closest && e.target.closest('.vp-mode');
        if (!b) return;
        (0, /*()*/__C.setView)(b.dataset.view, 'pick');
        viewpick.dataset.picked = '1';
        // The Stage view takes the screen in the same tap (a browser asks for the tap's own gesture).
        if (b.dataset.view === 'stage' && window.__meetView === 'stage') svFullscreen();
        // Focus keeps the picker up so Follow the speaker is one more tap.
        if (b.dataset.view !== 'focus') closePick(true);
      });
      viewpick.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); closePick(true); return; }
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        const list = Array.from(viewpick.querySelectorAll('.vp-mode')).filter((x) => !x.hidden);
        const i = list.indexOf(document.activeElement);
        if (i < 0) return;
        e.preventDefault();
        const n = list[(i + ((e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : list.length - 1)) % list.length];
        try { n.focus(); } catch (err) {}
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !viewpick.hidden) closePick(false); });
      // A turned phone closes it (its place was the old button's). Only a turn: a phone's first tap goes full screen,
      // a resize of its own, and the picker that tap opened must stay.
      let vpLand = window.innerWidth > window.innerHeight;
      window.addEventListener('resize', () => { const land = window.innerWidth > window.innerHeight; if (land !== vpLand && !viewpick.hidden) closePick(false); vpLand = land; });
      document.addEventListener('pointerdown', (e) => {
        if (viewpick.hidden) return;
        const t = e.target;
        if (t && t.closest && (t.closest('#viewpick') || t.closest('#fitbtn'))) return;
        closePick(false);
      }, true);
    }
    // ONE step to the presentation view on every screen (Nathan 2026-11-11):
    // the content takes the screen in Drag with the speaker inset, the page
    // goes full screen and a phone turns sideways where the browser lets it.
    const presentbtn = document.getElementById('presentbtn');
    if (presentbtn) {
      const pw = presentbtn.querySelector('.vb-word');
      if (pw) pw.textContent = (0, /*()*/__C.uiText)('viewPresent', 'Present');
      presentbtn.addEventListener('click', () => {
        (0, /*()*/__C.setView)('drag', 'present');
        const de = document.documentElement;
        const full = !!(document.fullscreenElement || document.webkitFullscreenElement);
        const turn = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} };
        if (!full && de.requestFullscreen) de.requestFullscreen().then(turn, () => {}); else turn();
      });
    }
    if (vpFollow) vpFollow.addEventListener('click', () => {
      const on = vpFollow.getAttribute('aria-checked') !== 'true';
      if (__C.VMODE) __C.VMODE.saveFollow(__C.model.apps.viewStore(), on);
      if (fsview.classList.contains('on') && __C.fsInline) {
        if (on) { fsSel = 'auto'; fsAutoPid = null; fsAutoKey = null; fsFollow = null; }
        else fsSel = fsmain.dataset.key || null; // pin whoever is on the big view now
        fsRefresh();
      }
      paintFit();
    });
    // An app or a broadcast that starts or stops while Focus is chosen.
    try { new MutationObserver(() => { try { (0, /*()*/__C.syncFocus)(); } catch (e) {} }).observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
    yield 580;
    const CT_ICONS = {
      present: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="13" rx="2"/><rect x="14" y="11" width="5.5" height="4.5" rx="1"/><path d="M8 21h8"/></svg>',
      all: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="8.5" height="6" rx="1.2"/><rect x="13" y="5" width="8.5" height="6" rx="1.2"/><rect x="2.5" y="13" width="8.5" height="6" rx="1.2"/><rect x="13" y="13" width="8.5" height="6" rx="1.2"/></svg>',
      tabs: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 8h7l1.5-3h10.5"/><rect x="2.5" y="8" width="19" height="11" rx="1.5"/></svg>',
      bring: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7" cy="8" r="2.5"/><circle cx="17" cy="8" r="2.5"/><path d="M2.5 18c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4M12.5 18c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4"/></svg>',
      faces: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="14" width="5.5" height="5.5" rx="1.2"/><rect x="9.25" y="14" width="5.5" height="5.5" rx="1.2"/><rect x="16" y="14" width="5.5" height="5.5" rx="1.2"/><path d="M4 10l8-5 8 5"/></svg>',
      exit: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    };
    yield 582;
    function ctInit() {
      if (__C.CT) return __C.CT;
      const feed = document.getElementById('feed');
      if (!feed || !window.GifOS || !GifOS.meetContent || !GifOS.meetAgenda) return null;
      const el = document.createElement('div');
      el.id = 'ctarea'; el.className = 'ctarea'; el.hidden = true;
      const bar = document.createElement('div'); bar.className = 'ct-bar';
      const tabs = document.createElement('div'); tabs.className = 'ct-tabs'; tabs.setAttribute('role', 'tablist');
      const tools = document.createElement('div'); tools.className = 'ct-tools';
      bar.appendChild(tabs); bar.appendChild(tools);
      const body = document.createElement('div'); body.className = 'ct-body';
      const inset = document.createElement('div'); inset.className = 'ct-inset'; inset.hidden = true;
      inset.innerHTML = '<video muted autoplay playsinline></video><span class="ct-inset-nm"></span>';
      const exit = document.createElement('button'); exit.type = 'button'; exit.className = 'ct-exit'; exit.hidden = true; exit.innerHTML = CT_ICONS.exit;
      exit.addEventListener('click', () => ctPresent(false, 'exit'));
      el.appendChild(bar); el.appendChild(body); el.appendChild(inset); el.appendChild(exit);
      feed.appendChild(el);
      __C.CT = {
        el, bar, tabs, tools, body, inset, exit,
        panes: new Map(), st: GifOS.meetContent.state(), items: [], plan: null,
        ag: null, agW: null, agStart: 0, agLocal: false, agEdit: false, agTick: 0,
        present: false, presentFs: false, facesHidden: false, speaker: null, speakerAt: 0,
        lastSig: '', phone: false, rect: null,
      };
      try { __C.CT.facesHidden = localStorage.getItem('meet.content.v1.faces') === 'off'; } catch (e) {}
      // Scroll moves the area with the page; the app pane is fixed and follows it.
      feed.addEventListener('scroll', () => { if (__C.CT && __C.CT.items.length && window.__meetGallery === 'scroll') { try { contentPlace(__C.CT.phone); ctPinApp(); } catch (e) {} } }, { passive: true });
      document.addEventListener('keydown', (e) => {
        if (!__C.CT) return;
        if (e.key === 'Escape' && __C.CT.present) { e.preventDefault(); ctPresent(false, 'esc'); }
      });
      document.addEventListener('fullscreenchange', () => {
        if (__C.CT && __C.CT.present && __C.CT.presentFs && !document.fullscreenElement) ctPresent(false, 'fs-exit');
      });
      // Double-click (or double-tap) the content: presentation view, and back.
      body.addEventListener('dblclick', (e) => {
        if (e.target && e.target.closest && e.target.closest('input,button,textarea,select,.ag-list')) return;
        ctPresent(!(__C.CT.present || (document.getElementById('presentbtn') && window.__meetView === 'drag')), 'dblclick');
      });
      return __C.CT;
    }

    // ---- what is shared now ----
    function ctAppInfo() {
      if (!document.body.classList.contains('has-app') || !__C.appKey) return null;
      const mine = !!(__C.model.me.myStatus().app && __C.appKey === __C.model.me.myStatus().app.s);
      let by = mine ? __C.model.me.myId() : null;
      if (!by) for (const [pid, st] of __C.model.roster.statusOf()) if (st && st.app && st.app.s === __C.appKey) { by = pid; break; }
      const nm = document.getElementById('appname');
      return { on: true, name: (nm && nm.textContent) || '', by: by, mine: mine };
    }
    yield 588;
    function ctPaintAgendaBtn() {
      const ab = document.getElementById('agendabtn');
      if (!ab) return;
      const show = (0, /*()*/__C.ctAgHidden)() && !!(__C.CT.ag && __C.CT.ag.items.length);
      const word = show ? (0, /*()*/__C.ctText)('agShow', 'Show agenda') : (0, /*()*/__C.ctText)('agendaBtn', 'Agenda');
      if (ab.textContent !== word) ab.textContent = word;
    }
    yield 595;
    function ctFocusOnContent() {
      return !!(__C.CT && window.__meetView === 'focus' && fsview.classList.contains('on') && __C.fsInline && String(fsmain.dataset.key || '').indexOf('content:') === 0);
    }
    yield 597;
    function contentTile(phone) {
      if (!__C.CT || !__C.CT.items.length) { if (__C.CT) { __C.CT.el.hidden = true; document.body.classList.remove('ct-on', 'ct-app-off', 'ct-present'); } return null; }
      __C.CT.phone = !!phone;
      // Presentation view, Focus and the Stage view place the area themselves:
      // it takes no share slot in the gallery under them.
      if (__C.CT.present || ctFocusOnContent() || svOn()) return null;
      const scroll = window.__meetGallery === 'scroll';
      const t = { id: 'stage:content', el: __C.CT.el, tier: 'row', stage: true, share: true, kind: 'app', fill: true, content: true, pz: 'stage:content' };
      if (scroll) {
        t.stackH = (w, maxH) => {
          const asp = __C.CT.items.map((it) => (0, /*()*/__C.ctAspect)(it, w) || GifOS.meetContent.stackAspect(it, w, window.innerHeight));
          return GifOS.meetContent.stack({ x: 0, y: 0, w: w, h: maxH }, asp, 8).h;
        };
      }
      return t;
    }
    function contentOpts(phone) {
      const v = window.__meetView || 'fit';
      // A phone editing the agenda gives it the screen (the faces come back with Done): with the keyboard up, the
      // faces left the form no room and covered Add item.
      const it0IsAgenda = () => { try { const sel = __C.CT.items.find((i) => i.key === __C.CT.st.sel); return !!sel && sel.kind === 'agenda'; } catch (e) { return false; } };
      // Drag is the meeting's own layout (the content takes the screen, the
      // people inset); a phone's Fit is the content full with a face strip.
      // R2: an agenda needs only its list (and the tab row); a screen or an
      // app is sized by its aspect in the zones. The rest goes to the faces.
      let needH = 0;
      try {
        const it = __C.CT && __C.CT.st && !__C.CT.st.all ? __C.CT.items.find((i) => i.key === __C.CT.st.sel) : null;
        if (it && it.kind === 'agenda') needH = Math.round(1000 / (0, /*()*/__C.ctAspect)(it, 1000)); // the list's own height (ctAspect)
      } catch (e) {}
      // Beside the faces (a wide screen) a list reads well at a column's width; the faces take the rest.
      const needW = needH ? 640 : 0;
      return { phone: !!phone && v !== 'scroll' && v !== 'drag', hideFaces: !!(__C.CT && (__C.CT.facesHidden || (__C.CT.agEdit && it0IsAgenda())) && phone), needH: needH > 40 ? needH : 0, needW: needW };
    }

    // ---- panes ----
    function ctPane(it) {
      let p = __C.CT.panes.get(it.key);
      if (p) return p;
      p = document.createElement('div');
      p.className = 'ct-pane'; p.dataset.key = it.key; p.dataset.kind = it.kind;
      p.setAttribute('role', 'tabpanel');
      if (it.kind === 'screen') {
        const v = document.createElement('video');
        v.muted = true; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline', '');
        v.addEventListener('loadedmetadata', () => { try { layout(); } catch (e) {} });
        v.addEventListener('resize', () => { try { layout(); } catch (e) {} });
        const cap = document.createElement('div'); cap.className = 'ct-cap';
        p.appendChild(v); p.appendChild(cap);
      } else if (it.kind === 'agenda') {
        p.classList.add('ag');
      } else {
        // The app's own pane is pinned over this box (moving an iframe reloads it).
        p.classList.add('ct-appbox');
      }
      __C.CT.body.appendChild(p);
      __C.CT.panes.set(it.key, p);
      return p;
    }
    yield 601;
    function ctPaintScreen(p, it) {
      const v = p.querySelector('video');
      const src = (0, /*()*/__M.ctScreenTrack)(it.sid);
      const tr = src ? src.track : null;
      if (v && v._vt !== tr) {
        v._vt = tr;
        try { v.srcObject = tr ? new MediaStream([tr]) : null; } catch (e) { v.srcObject = null; }
        if (tr) { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }
        (0, /*()*/__C.ctNote)('screen-src', { sid: String(it.sid).slice(0, 8), from: src ? src.from : 'none' });
      }
      // RECEIVER-SIDE BLUR ON THE CONTENT PANE: the share wears the room's blur for its sharer here as on a tile, so a
      // sender that ships clear pixels where the room blurs them stays blurred. Mine is my own capture.
      if (v) { const bl = it.mine ? 0 : Math.max((0, /*()*/__C.blurLevelFor)(it.sid, false, false, 'stage') | 0, (0, /*()*/__C.modBlurOn)(it.sid) ? 1 : 0); const had = v.classList.contains('blur2') ? 2 : v.classList.contains('blur1') ? 1 : 0; if (had !== bl || !!v.__tcOv !== !!(bl && !(0, /*()*/__C.modBlurOn)(it.sid))) (0, /*()*/__C.fsBlurClass)(v, bl, it.sid); }
      p.dataset.src = src ? src.from : 'none';
      try { const held = !it.mine && (0, /*()*/__C.turnHeld)(it.sid); pauseNote(p, held, held ? (0, /*()*/__C.shareFirewallWords)(it.name) : ''); } catch (e) {}
      const cap = p.querySelector('.ct-cap');
      if (cap) {
        const want = (0, /*()*/__C.ctLabel)(it);
        let lb = cap.querySelector('.ct-capnm');
        if (!lb) { lb = document.createElement('span'); lb.className = 'ct-capnm'; cap.appendChild(lb); }
        if (lb.textContent !== want) lb.textContent = want;
        let stop = cap.querySelector('.ct-stop');
        if (it.mine && !stop) {
          stop = document.createElement('button'); stop.type = 'button'; stop.className = 'ct-stop';
          stop.addEventListener('click', () => { try { (0, /*()*/__M.stopScreenShare)((0, /*()*/__C.ctText)('ctStopShare', 'Stop sharing')); } catch (e) {} });
          cap.appendChild(stop);
        } else if (!it.mine && stop) stop.remove();
        if (stop) stop.textContent = (0, /*()*/__C.ctText)('ctStopShare', 'Stop sharing');
      }
    }

    // ---- the tab bar ----
    function ctPaintBar(plan) {
      const MC = GifOS.meetContent;
      const st = __C.CT.st;
      const have = new Map();
      for (const b of Array.from(__C.CT.tabs.children)) have.set(b.dataset.key, b);
      let pos = 0;
      const sv = svOn() ? svSt().plan : null;
      const FACES = GifOS.meetViewMode.stage.FACES;
      const list = sv ? __C.CT.items.concat(sv.list.some((t) => t.key === FACES) ? [{ key: FACES, kind: 'faces' }] : []) : __C.CT.items;
      for (const it of list) {
        let b = have.get(it.key);
        if (!b) {
          b = document.createElement('button');
          b.type = 'button'; b.className = 'ct-tab'; b.dataset.key = it.key; b.setAttribute('role', 'tab');
          b.innerHTML = '<span class="ct-tabnm"></span><span class="ct-tabtime"></span><span class="ct-dot" aria-hidden="true"></span>';
          const key = it.key;
          b.addEventListener('click', () => svTab(key, 'tab'));
          b.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            const list = Array.from(__C.CT.tabs.children);
            const i = list.indexOf(b);
            const n = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
            if (n) { e.preventDefault(); n.focus(); svTab(n.dataset.key, 'key'); }
          });
        }
        have.delete(it.key);
        if (__C.CT.tabs.children[pos] !== b) __C.CT.tabs.insertBefore(b, __C.CT.tabs.children[pos] || null);
        pos++;
        const label = it.kind === 'faces' ? svFacesWord() : (0, /*()*/__C.ctLabel)(it);
        const nm = b.querySelector('.ct-tabnm');
        if (nm.textContent !== label) nm.textContent = label;
        const sel = sv ? it.key === sv.show : plan.show.indexOf(it.key) >= 0 && (plan.show.length === 1 || st.all);
        const on = sv ? it.key === sv.show : st.all ? plan.show.indexOf(it.key) >= 0 : it.key === st.sel;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = (sv ? it.key === sv.show : it.key === st.sel) ? 0 : -1;
        const dot = it.kind !== 'faces' && !on && MC.badged(st, it.key);
        b.classList.toggle('changed', dot);
        b.setAttribute('aria-label', dot ? (0, /*()*/__C.ctText)('ctChanged', '{tab}, changed', { tab: label }) : label);
        b.dataset.sel = sel ? '1' : '0';
        const tm = b.querySelector('.ct-tabtime');
        const t = it.kind === 'agenda' ? (0, /*()*/__C.ctAgendaShortTime)() : '';
        if (tm.textContent !== t) tm.textContent = t;
        tm.classList.toggle('over', it.kind === 'agenda' && (0, /*()*/__C.ctAgendaOver)());
      }
      for (const b of have.values()) b.remove();
      // Tools: bring everyone, see everything, faces (phone), presentation view.
      const selIt = (sv && sv.show === FACES) ? null : (__C.CT.items.find((i) => i.key === st.sel) || null);
      const mayBring = !!(selIt && __C.model.me.myId() && MC.canBring(__C.model.me.myId(), selIt, { adminRoom: (0, /*()*/__C.hasAdminRoom)(), isAdmin: !!__C.amAdmin, agendaEditor: (0, /*()*/__C.ctCanEditAgenda)() }));
      ctTool('bring', mayBring && !st.all, CT_ICONS.bring, (0, /*()*/__C.ctText)('ctBring', 'Bring everyone here'), (0, /*()*/__C.ctText)('ctBringTip', 'Everyone in the meeting switches to this tab. They can switch back.'), () => (0, /*()*/__C.ctBring)(st.sel));
      ctTool('all', __C.CT.items.length > 1 && !sv, st.all ? CT_ICONS.tabs : CT_ICONS.all, st.all ? (0, /*()*/__C.ctText)('ctTabs', 'One at a time') : (0, /*()*/__C.ctText)('ctSeeAll', 'See everything'), st.all ? (0, /*()*/__C.ctText)('ctTabsTip', 'Show one tab at a time') : (0, /*()*/__C.ctText)('ctSeeAllTip', 'Show every tab side by side'), () => { st.all = !st.all; (0, /*()*/__C.ctNote)('all', { on: st.all }); GifOS.meetContent.sync(st, __C.CT.items); try { layout(); } catch (e) {} });
      ctTool('faces', __C.CT.phone && window.__meetView !== 'drag' && !sv, CT_ICONS.faces, __C.CT.facesHidden ? (0, /*()*/__C.ctText)('ctShowFaces', 'Show faces') : (0, /*()*/__C.ctText)('ctHideFaces', 'Hide faces'), '', () => {
        __C.CT.facesHidden = !__C.CT.facesHidden;
        try { localStorage.setItem('meet.content.v1.faces', __C.CT.facesHidden ? 'off' : 'on'); } catch (e) {}
        (0, /*()*/__C.ctNote)('faces', { hidden: __C.CT.facesHidden });
        try { layout(); } catch (e) {}
      }, __C.CT.facesHidden);
      ctTool('present', !sv, CT_ICONS.present, (0, /*()*/__C.ctText)('ctPresent', 'Presentation view'), (0, /*()*/__C.ctText)('ctPresentTip', 'Fill the screen with this tab and the speaker in the corner (double-click works too)'), () => ctPresent(true, 'button'));
    }
    function ctTool(id, show, icon, word, tip, act, pressed) {
      let b = __C.CT.tools.querySelector('[data-tool="' + id + '"]');
      if (!b) {
        b = document.createElement('button'); b.type = 'button'; b.className = 'ct-tool'; b.dataset.tool = id;
        b.innerHTML = '<span class="ct-ic"></span><span class="ct-word"></span>';
        b.addEventListener('click', () => { if (b._act) b._act(); });
        __C.CT.tools.appendChild(b);
      }
      b._act = act;
      b.hidden = !show;
      const ic = b.querySelector('.ct-ic');
      if (ic.dataset.icon !== icon) { ic.innerHTML = icon; ic.dataset.icon = icon; }
      const wd = b.querySelector('.ct-word');
      if (wd.textContent !== word) wd.textContent = word;
      b.setAttribute('aria-label', word);
      if (tip) b.title = tip; else b.removeAttribute('title');
      if (pressed != null) b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    }
    yield 605;

    // ---- placing the area and its panes (after the layout placed the tile) ----
    function ctPinApp() {
      const pane = document.getElementById('apppane');
      const seat = document.getElementById('appseat');
      if (!pane || !seat) return;
      for (const [k, v] of [['--seat-x', 'left'], ['--seat-y', 'top'], ['--seat-w', 'width'], ['--seat-h', 'height']]) {
        if (seat.style[v]) pane.style.setProperty(k, seat.style[v]);
      }
    }
    function contentPlace(phone) {
      if (!__C.CT) return;
      const MC = GifOS.meetContent;
      const el = __C.CT.el;
      const body = document.body;
      if (!__C.CT.items.length) {
        el.hidden = true;
        body.classList.remove('ct-on', 'ct-app-off', 'ct-present', 'ct-tabs');
        for (const p of __C.CT.panes.values()) { const v = p.querySelector('video'); if (v) { v.srcObject = null; v._vt = null; } p.remove(); }
        __C.CT.panes.clear();
        ctInset(false);
        return;
      }
      body.classList.add('ct-on');
      // Panes for the items now; drop the ones whose item ended.
      const keys = new Set(__C.CT.items.map((i) => i.key));
      for (const [k, p] of __C.CT.panes) if (!keys.has(k)) { const v = p.querySelector('video'); if (v) { v.srcObject = null; v._vt = null; } p.remove(); __C.CT.panes.delete(k); }
      for (const it of __C.CT.items) ctPane(it);
      // The box: the tile the layout placed, the whole screen in
      // presentation view, or the big view of Focus.
      const feed = document.getElementById('feed');
      const fr = feed ? feed.getBoundingClientRect() : { left: 0, top: 0 };
      let box = null, fixed = false;
      const focusC = ctFocusOnContent();
      const sv = svOn() ? svPlan() : null;
      if (sv) {
        // The Stage view: the whole screen; with the faces picked only the tab strip is the area's.
        if (sv.show === GifOS.meetViewMode.stage.FACES) box = sv.tabs ? { x: 0, y: 0, w: window.innerWidth, h: sv.bar.y + sv.bar.h } : null;
        else box = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
        fixed = true;
      } else if (__C.CT.present) {
        box = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight }; fixed = true;
      } else if (focusC) {
        // R4: Focus keeps everyone. The item takes the big view and stops at
        // the face strip (down the side when wide, across the bottom when tall).
        const r = fsmain.getBoundingClientRect();
        box = { x: r.left, y: r.top, w: r.width, h: r.height }; fixed = true;
        const st = document.getElementById('fsstrip');
        if (st && st.getClientRects().length && getComputedStyle(st).display !== 'none' && st.children.length) {
          const sr = st.getBoundingClientRect();
          if (sr.width >= r.width - 1) box.h = Math.max(1, Math.round(sr.top - r.top));
          else box.w = Math.max(1, Math.round(sr.left - r.left));
        }
      } else if (!el.classList.contains('comfy-off') && el.style.width) {
        box = { x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0, w: parseFloat(el.style.width) || 0, h: parseFloat(el.style.height) || 0 };
      }
      if (!box || !(box.w > 0) || !(box.h > 0)) {
        el.hidden = true;
        body.classList.add('ct-app-off');
        ctInset(false);
        return;
      }
      el.hidden = false;
      el.classList.toggle('ct-fixed', fixed);
      // Fixed (presentation view, Focus) the area lives on the body, above
      // every layer of the meeting; in the gallery it lives in the feed.
      const home = fixed ? document.body : feed;
      if (home && el.parentNode !== home) home.appendChild(el);
      body.classList.toggle('ct-present', !!__C.CT.present);
      if (fixed) {
        el.style.position = 'fixed';
        el.style.left = box.x + 'px'; el.style.top = box.y + 'px'; el.style.width = box.w + 'px'; el.style.height = box.h + 'px';
        el.classList.remove('comfy-off');
      }
      const view = sv ? 'stage' : __C.CT.present ? 'present' : (focusC ? 'focus' : (window.__meetGallery === 'scroll' ? 'scroll' : (window.__meetView || 'fit')));
      let plan;
      if (sv) plan = { tabs: sv.tabs, show: sv.show && sv.show !== GifOS.meetViewMode.stage.FACES ? [sv.show] : [], stack: false };
      else if (__C.CT.present) plan = { tabs: false, show: [__C.CT.st.sel || __C.CT.items[0].key], stack: false };
      else if (focusC) plan = { tabs: false, show: [String(fsmain.dataset.key).slice(8)], stack: false };
      else plan = MC.plan({ view: view, keys: __C.CT.items.map((i) => i.key), sel: __C.CT.st.sel, all: __C.CT.st.all });
      __C.CT.plan = plan;
      body.classList.toggle('ct-tabs', !!plan.tabs);
      __C.CT.bar.hidden = !plan.tabs;
      // The tab bar starts under the meeting's header chip when the area
      // runs up under it (a phone: the feed starts at the top edge).
      let barTop = sv && sv.bar ? sv.bar.y : 0;
      if (plan.tabs && !fixed) {
        const chip = document.querySelector('.topchip');
        if (chip && chip.getClientRects().length && getComputedStyle(chip).display !== 'none') {
          const cr = chip.getBoundingClientRect();
          const top = fr.top + box.y - (feed ? feed.scrollTop : 0);
          if (cr.bottom > top && cr.top < top + 60) barTop = Math.min(Math.round(box.h / 3), Math.ceil(cr.bottom - top + 4));
        }
      }
      __C.CT.bar.style.top = barTop + 'px';
      const barH = plan.tabs ? barTop + (sv ? sv.bar.h : (phone ? 44 : 48)) : 0;
      const inner = { x: 0, y: barH, w: box.w, h: Math.max(1, box.h - barH) };
      const shown = plan.show.map((k) => __C.CT.items.find((i) => i.key === k)).filter(Boolean);
      const asp = shown.map((it) => (0, /*()*/__C.ctAspect)(it, inner.w));
      let rects;
      if (plan.stack) rects = MC.stack(inner, asp.map((a, i) => a || MC.stackAspect(shown[i], inner.w, window.innerHeight)), 8).rects;
      else if (shown.length > 1) rects = MC.grid(inner, asp, 8);
      else rects = [inner];
      // The app's box in screen terms (the pane is fixed).
      const toScreen = (r) => fixed ? { x: box.x + r.x, y: box.y + r.y, w: r.w, h: r.h }
        : { x: fr.left + box.x + r.x - (feed ? feed.scrollLeft : 0), y: fr.top + box.y + r.y - (feed ? feed.scrollTop : 0), w: r.w, h: r.h };
      let appShown = false;
      for (const it of __C.CT.items) {
        const p = __C.CT.panes.get(it.key);
        const i = shown.indexOf(it);
        if (i < 0) { p.hidden = true; continue; }
        const r = rects[i];
        p.hidden = false;
        p.style.left = r.x + 'px'; p.style.top = r.y + 'px'; p.style.width = r.w + 'px'; p.style.height = r.h + 'px';
        // With no tab bar (Scroll, Focus) each item carries its own
        // presentation view button: still one tap from anywhere.
        let pv = p.querySelector(':scope > .ct-pview');
        if (!plan.tabs && !__C.CT.present && !sv) {
          if (!pv) {
            pv = document.createElement('button'); pv.type = 'button'; pv.className = 'ct-pview'; pv.innerHTML = CT_ICONS.present;
            const key = it.key;
            pv.addEventListener('click', () => { GifOS.meetContent.select(__C.CT.st, key); ctPresent(true, 'pane'); });
            p.appendChild(pv);
          }
          pv.setAttribute('aria-label', (0, /*()*/__C.ctText)('ctPresent', 'Presentation view')); pv.title = (0, /*()*/__C.ctText)('ctPresent', 'Presentation view');
          pv.hidden = false;
        } else if (pv) pv.hidden = true;
        if (it.kind === 'screen') ctPaintScreen(p, it);
        else if (it.kind === 'agenda') ctPaintAgenda(p);
        else if (it.kind === 'app') {
          appShown = true;
          const seat = document.getElementById('appseat');
          const s = toScreen(r);
          if (seat) {
            seat.style.position = 'absolute';
            seat.style.left = s.x + 'px'; seat.style.top = s.y + 'px'; seat.style.width = s.w + 'px'; seat.style.height = s.h + 'px';
          }
        }
      }
      // Screens that are not shown let go of their picture (one sink less).
      for (const it of __C.CT.items) {
        if (it.kind !== 'screen' || shown.indexOf(it) >= 0) continue;
        const p = __C.CT.panes.get(it.key); const v = p && p.querySelector('video');
        if (v && v._vt) { v.srcObject = null; v._vt = null; }
      }
      body.classList.toggle('ct-app-off', !appShown);
      if (appShown) ctPinApp();
      if (plan.tabs) ctPaintBar(plan);
      __C.CT.exit.hidden = !__C.CT.present;
      if (__C.CT.present) { __C.CT.exit.setAttribute('aria-label', (0, /*()*/__C.ctText)('ctExitPresent', 'Exit presentation view')); __C.CT.exit.title = (0, /*()*/__C.ctText)('ctExitPresent', 'Exit presentation view'); }
      ctInset(!!__C.CT.present, shown[0]);
      const sig = view + '|' + plan.show.join(',') + '|' + Math.round(box.w) + 'x' + Math.round(box.h) + '|' + (__C.CT.st.all ? 'all' : 'one');
      if (sig !== __C.CT.lastSig) { __C.CT.lastSig = sig; (0, /*()*/__C.ctNote)('place', { view: view, show: plan.show.slice(), tabs: !!plan.tabs, box: [Math.round(box.x), Math.round(box.y), Math.round(box.w), Math.round(box.h)] }); }
      (0, /*()*/__C.ctAgendaTickArm)();
    }
    yield 608;
    // Focus moved on or off a content tab: the area goes back to the gallery,
    // or onto the big view.
    function ctFocusSync() {
      if (!__C.CT) return;
      const on = ctFocusOnContent();
      if (on) {
        const k = String(fsmain.dataset.key).slice(8);
        if (__C.CT.st.sel !== k) GifOS.meetContent.select(__C.CT.st, k);
        if (!__C.CT.focusC) { __C.CT.focusC = true; (0, /*()*/__C.ctNote)('focus-content', { key: k }); try { layout(); } catch (e) {} }
        else contentPlace(__C.CT.phone);
      } else if (__C.CT.focusC) {
        __C.CT.focusC = false;
        (0, /*()*/__C.ctNote)('focus-content', { key: null });
        if (!__C.CT.present) { __C.CT.el.classList.remove('ct-fixed'); __C.CT.el.style.position = ''; }
        try { layout(); } catch (e) {}
      }
    }

    // ---- presentation view: one tap, the item fills the screen, the speaker inset ----
    function ctPresent(on, why) {
      // The meeting's Present is the one presentation view (Drag: the content
      // takes the screen, the people inset; full screen; sideways where the
      // browser allows). The tab bar's button and a double-click take it.
      const pb = document.getElementById('presentbtn');
      if (pb) {
        if (on) { (0, /*()*/__C.ctNote)('present', { on: true, why: why || '', key: __C.CT && __C.CT.st.sel }); pb.click(); }
        else if (window.__meetView === 'drag' && typeof window.__meetSetView === 'function') {
          try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) {}
          window.__meetSetView('fit', 'present-exit');
        }
        return;
      }
      if (!__C.CT || !__C.CT.items.length) on = false;
      if (!__C.CT || !!__C.CT.present === !!on) return;
      __C.CT.present = !!on;
      (0, /*()*/__C.ctNote)('present', { on: __C.CT.present, why: why || '', key: __C.CT.st.sel });
      if (on) {
        // The document holds the screen (never the area itself: the app's pane
        // and the sheets live outside it). A phone turns sideways where the
        // browser allows it.
        const own = !document.fullscreenElement && document.documentElement.requestFullscreen;
        __C.CT.presentFs = false;
        if (own) {
          try {
            document.documentElement.requestFullscreen().then(() => {
              __C.CT.presentFs = true;
              try { if (screen.orientation && screen.orientation.lock && __C.CT.phone) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
            }).catch(() => {});
          } catch (e) {}
        }
      } else {
        try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
        if (__C.CT.presentFs && document.fullscreenElement && document.exitFullscreen) { try { document.exitFullscreen().catch(() => {}); } catch (e) {} }
        __C.CT.presentFs = false;
        __C.CT.el.classList.remove('ct-fixed');
        __C.CT.el.style.position = '';
      }
      document.body.classList.toggle('ct-present', __C.CT.present);
      try { layout(); } catch (e) {}
      if (on) { try { __C.CT.exit.focus(); } catch (e) {} }
    }
    yield 611;
    function ctInset(on, selIt) {
      const box = __C.CT && __C.CT.inset;
      if (!box) return;
      const v = box.querySelector('video');
      const pid = on ? (0, /*()*/__C.ctSpeakerPick)(selIt) : null;
      const p = pid ? __C.model.roster.peers().get(pid) : null;
      // A person on stage sends their camera on the stage feed; their row
      // picture is parked. Take the stage feed first, the tile second.
      let vt = null;
      if (pid) {
        try {
          const m = __C.mosIn && __C.mosIn.get('stg:' + pid);
          const t = m && m.stream && m.stream.getVideoTracks && m.stream.getVideoTracks()[0];
          if (t && t.readyState !== 'ended') vt = t;
        } catch (e) {}
      }
      if (!vt) {
        const st = p && p.video && p.video.srcObject;
        vt = (st && st.getVideoTracks && st.getVideoTracks()[0]) || null;
      }
      if (!on || !vt) { box.hidden = true; if (v.srcObject) { v.srcObject = null; v._vt = null; } return; }
      if (v._vt !== vt) { v._vt = vt; v.srcObject = new MediaStream([vt]); const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }
      const nm = box.querySelector('.ct-inset-nm');
      const want = (0, /*()*/__C.displayName)(pid);
      if (nm.textContent !== want) nm.textContent = want;
      const r = GifOS.meetContent.presentRects(window.innerWidth, window.innerHeight, 16 / 9, true).inset;
      box.style.left = r.x + 'px'; box.style.top = r.y + 'px'; box.style.width = r.w + 'px'; box.style.height = r.h + 'px';
      box.hidden = false;
      box.dataset.pid = pid;
    }
    yield 628;
    // ---- the Stage view (Nathan 2026-11-25): only the Stage, full screen, portrait or landscape ----
    // Picked next to Scroll, Fit, Drag and Focus while the Stage carries something: the content items (screens, the
    // app, the agenda) and the Stage's own pictures (the people on it, a rebroadcast; a broadcast's whole Stage). One
    // fills the screen at its own aspect; several get a tab strip under the top bar. The view moves the pictures this
    // page already draws (the same elements): nothing is sent, and each picture keeps its blur, its name and its talking
    // frame. The top bar, the captions and the floating bar stay over it and reserve nothing. The rules (which tabs,
    // which one shows, the box) are GifOS.meetViewMode.stage; the full screen is the view kit's.
    function svSt() {
      return svSt.o || (svSt.o = { avail: false, faces: [], sel: null, plan: null, drawn: false, fs: '', on: new Set(), rz: 0, sig: '' });
    }
    function svOn() { return window.__meetView === 'stage'; }
    // The gallery pass names the Stage's own pictures it drew (per-person Stage views, or the Stage strip).
    function svFaces(list) { svSt().faces = list; }
    function svFacesWord() { return (0, /*()*/__C.uiText)('svFaces', 'Faces'); }
    // People on the Stage who are pictures here: a screen sharer's picture is the screen's own tab. A broadcast's
    // Stage is one picture (its strip), whoever is on it.
    function svFacesN() {
      let stg = [];
      try { stg = (0, /*()*/__C.stageIds)() || []; } catch (e) { stg = []; }
      if (document.body.classList.contains('broadcast')) return stg.length;
      let shr = [];
      try { shr = (0, /*()*/__C.screenSharers)() || []; } catch (e) { shr = []; }
      return stg.filter((id) => shr.indexOf(id) < 0).length;
    }
    function svTabs() {
      const body = document.body;
      const bc = body.classList.contains('broadcast');
      if (!bc && !body.classList.contains('comfy')) return [];
      const content = [];
      if (!bc && __C.CT) for (const it of __C.CT.items) content.push({ key: it.key, kind: it.kind, label: '' });
      return GifOS.meetViewMode.stage.tabs({ content: content, faces: { n: svFacesN(), label: svFacesWord() } });
    }
    function svPlan() {
      const S = svSt();
      const list = svTabs();
      let top = 0;
      const th = document.getElementById('tophead');
      if (th && th.getClientRects().length) top = Math.max(0, Math.ceil(th.getBoundingClientRect().bottom));
      const phone = window.innerWidth < 600 || window.innerHeight < 500;
      const cur = __C.CT && __C.CT.st ? __C.CT.st.sel : null;
      const p = GifOS.meetViewMode.stage.plan(list, S.sel, cur, window.innerWidth, window.innerHeight, top, phone ? 44 : 48);
      p.list = list;
      S.plan = p;
      return p;
    }
    // A tab of the Stage view's strip (a content tab outside it picks the content area's tab as before).
    function svTab(key, why) {
      const FACES = GifOS.meetViewMode.stage.FACES;
      if (!svOn()) { if (key !== FACES) (0, /*()*/__C.ctSelect)(key, why); return; }
      const S = svSt();
      S.sel = key === FACES ? FACES : null;
      (0, /*()*/__C.ctNote)('stage-tab', { key: key, why: why || '' });
      if (key !== FACES) (0, /*()*/__C.ctSelect)(key, why);
      try { layout(); } catch (e) {}
    }
    // The one video the view shows (the full screen a phone that only lets a video go full screen can take).
    function svFsVideo() {
      const S = svSt();
      if (document.body.classList.contains('broadcast')) return document.querySelector('#stagefeed .rowtile video');
      const p = S.plan;
      if (!p || !p.show) return null;
      if (p.show === GifOS.meetViewMode.stage.FACES) {
        const fs = S.faces.filter((f) => f.el && f.el.isConnected);
        return fs.length === 1 ? fs[0].el.querySelector('video') : null;
      }
      const pane = __C.CT && __C.CT.panes.get(p.show);
      return pane ? pane.querySelector('video') : null;
    }
    // Clear to this viewer: no blur class and no filter on the picture or the boxes around it.
    function svClear(v) {
      if (!v) return false;
      for (let el = v, i = 0; el && i < 4; el = el.parentElement, i++) {
        if (el.classList && (el.classList.contains('blur1') || el.classList.contains('blur2'))) return false;
        try { const f = getComputedStyle(el).filter; if (f && f !== 'none') return false; } catch (e) { return false; }
      }
      return true;
    }
    function svFullscreen() {
      const S = svSt();
      const v = svFsVideo();
      S.fs = (GifOS.viewKit && GifOS.viewKit.fullscreen.enterStage) ? GifOS.viewKit.fullscreen.enterStage(v, svClear(v)) : '';
      (0, /*()*/__C.ctNote)('stage', { on: true, fs: S.fs || 'layout', show: S.plan ? S.plan.show : null });
    }
    // Left the Stage view (picked another view, or the Stage emptied): the pictures go back to the gallery's layout,
    // and a full screen the view took is given back.
    function svLeft() {
      const S = svSt();
      if (!S.drawn) return;
      S.drawn = false; S.sel = null; S.sig = '';
      document.body.classList.remove('sv-live', 'sv-tabs', 'sv-faces');
      for (const el of S.on) el.classList.remove('sv-on');
      S.on = new Set();
      const fs = S.fs; S.fs = '';
      if ((fs === 'page' || fs === 'video') && GifOS.viewKit && GifOS.viewKit.fullscreen.leaveStage) GifOS.viewKit.fullscreen.leaveStage(svFsVideo);
      (0, /*()*/__C.ctNote)('stage', { on: false });
    }
    // After every layout: is the view offered, and, while it is on, what fills the screen.
    function svPlace() {
      const S = svSt();
      const body = document.body;
      const FACES = GifOS.meetViewMode.stage.FACES;
      const list = svTabs();
      const avail = GifOS.meetViewMode.stage.on(list);
      if (avail !== S.avail) { S.avail = avail; body.classList.toggle('sv-avail', avail); try { paintFit(); } catch (e) {} }
      if (!svOn()) return;
      if (!avail) { if (typeof window.__meetLeaveStage === 'function') window.__meetLeaveStage('stage-empty'); return; }
      const p = svPlan();
      S.drawn = true;
      body.classList.add('sv-live');
      body.classList.toggle('sv-tabs', !!p.tabs);
      const facesShown = p.show === FACES;
      body.classList.toggle('sv-faces', facesShown);
      const want = new Set();
      const rects = [];
      if (facesShown && !body.classList.contains('broadcast')) {
        const feed = document.getElementById('feed');
        const fr = feed ? feed.getBoundingClientRect() : { left: 0, top: 0 };
        const fs = S.faces.filter((f) => f.el && f.el.isConnected);
        const asp = fs.map((f) => { const v = f.el.querySelector && f.el.querySelector('video'); return (v && v.videoWidth > 0 && v.videoHeight > 0) ? v.videoWidth / v.videoHeight : (f.aspect || 16 / 9); });
        const rs = GifOS.meetContent.grid(p.box, asp, fs.length > 1 ? 8 : 0);
        fs.forEach((f, i) => {
          const r = rs[i];
          if (!r) return;
          const st = f.el.style;
          st.position = 'absolute'; st.right = 'auto'; st.bottom = 'auto'; st.margin = '0'; st.display = '';
          st.left = Math.round(r.x - fr.left + (feed ? feed.scrollLeft : 0)) + 'px'; st.top = Math.round(r.y - fr.top + (feed ? feed.scrollTop : 0)) + 'px';
          st.width = r.w + 'px'; st.height = r.h + 'px';
          f.el.classList.remove('comfy-off');
          want.add(f.el);
          if (f.el.parentNode && f.el.parentNode.id === 'stagefeed') want.add(f.el.parentNode);
          rects.push([r.x, r.y, r.w, r.h]);
        });
      }
      for (const el of S.on) if (!want.has(el)) el.classList.remove('sv-on');
      for (const el of want) el.classList.add('sv-on');
      S.on = want;
      const sig = p.show + '|' + p.list.map((t) => t.key).join(',') + '|' + window.innerWidth + 'x' + window.innerHeight + '|' + JSON.stringify(rects);
      if (sig !== S.sig) { S.sig = sig; (0, /*()*/__C.ctNote)('stage-place', { show: p.show, tabs: p.list.map((t) => t.key), box: [p.box.x, p.box.y, p.box.w, p.box.h], faces: rects }); }
    }
    // The meeting's one-second clock (through islandNoteTick): a Stage that filled or emptied with no repaint of its own (a step-down seen only in
    // the Stage strip) still offers, or leaves, the view within a beat.
    function svTick() {
      const S = svSt();
      const sig = svTabs().map((t) => t.key).join(',');
      if (sig === S.tick) return;
      S.tick = sig;
      if ((sig !== '') !== S.avail || svOn()) { try { layout(); } catch (e) {} }
    }
    // A turn of the phone or a new window size lays the view out again at once (the gallery waits for its own settle).
    function svResize() {
      if (!svOn()) return;
      const S = svSt();
      if (S.rz) return;
      S.rz = requestAnimationFrame(() => { S.rz = 0; try { layout(); } catch (e) {} });
    }
    window.addEventListener('resize', svResize);
    window.addEventListener('orientationchange', svResize);
    // DEBUG and tests: what the Stage view shows now.
    window.__meetStage = () => {
      const S = svSt(), p = S.plan, b = document.body;
      let fsEl = null;
      try { fsEl = document.fullscreenElement || document.webkitFullscreenElement || null; } catch (e) {}
      return { view: window.__meetView, avail: S.avail, on: svOn() && b.classList.contains('sv-live'), tabs: svTabs().map((t) => t.key), show: svOn() && p ? p.show : null,
        strip: !!(svOn() && p && p.tabs), box: p ? [p.box.x, p.box.y, p.box.w, p.box.h] : null, fs: S.fs, fullscreen: fsEl ? (fsEl.id || fsEl.tagName) : null,
        faces: Array.from(S.on).filter((el) => el.id !== 'stagefeed').map((el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }) };
    };
    // An agenda title: its own name, a counter, and a warning at 120 characters.
    // The limit stays 120. A paste that would pass it is kept to the limit and
    // the warning shows, so the cut is not silent.
    function ctAgWords(label, value) {
      const MA = GifOS.meetAgenda;
      const t = document.createElement('input');
      t.type = 'text'; t.className = 'ag-in-t'; t.maxLength = MA.MAX_T;
      t.value = value || '';
      t.setAttribute('aria-label', label);
      const count = document.createElement('span');
      count.className = 'ag-count';
      count.setAttribute('aria-live', 'polite');
      const warn = document.createElement('span');
      warn.className = 'ag-limit';
      warn.hidden = true;
      const paint = () => {
        const n = t.value.length;
        count.textContent = n + '/' + MA.MAX_T;
        const at = n >= MA.MAX_T;
        count.classList.toggle('at', at);
        warn.hidden = !at;
        if (at) warn.textContent = (0, /*()*/__C.ctText)('agAtLimit', '120 characters is the most an item can hold.');
      };
      t.addEventListener('beforeinput', (e) => {
        const data = e.data || '';
        if (!data) return;
        const start = t.selectionStart || 0, end = t.selectionEnd || 0;
        if (t.value.length - (end - start) + data.length > MA.MAX_T) {
          e.preventDefault();
          const room = MA.MAX_T - (t.value.length - (end - start));
          t.setRangeText(data.slice(0, Math.max(0, room)), start, end, 'end');
          paint();
        }
      });
      t.addEventListener('input', paint);
      paint();
      return { t, count, warn };
    }
    function ctAgBtn(cls, word, act, title) {
      const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = word;
      if (title) b.title = title;
      b.addEventListener('click', act);
      return b;
    }
    // The agenda pane, painted again whenever its version, its rights or the
    // edit switch change (a clock tick only touches the clock).
    function ctPaintAgenda(p) {
      const MA = GifOS.meetAgenda;
      const a = __C.CT.ag || MA.empty(__C.model.me.myId());
      const may = (0, /*()*/__C.ctCanEditAgenda)();
      const isOwner = !!(__C.CT.ag && __C.CT.ag.owner === __C.model.me.myId() && __C.CT.ag.items.length);
      const mayHand = MA.canHand(__C.CT.ag, __C.model.me.myId(), (0, /*()*/__C.ctAgCtx)(__C.model.me.myId()));
      if (!may && __C.CT.agEdit) __C.CT.agEdit = false;
      const sig = [MA.body(a), may ? 1 : 0, __C.CT.agEdit ? 1 : 0, mayHand ? 1 : 0, (0, /*()*/__C.uiLang)(), mayHand ? __C.model.roster.rosterIds().join(',') : ''].join('|');
      if (p._sig === sig) { (0, /*()*/__C.ctPaintAgendaClock)(p); return; }
      p._sig = sig;
      const keepPv = p.querySelector(':scope > .ct-pview');
      p.textContent = '';
      if (keepPv) p.appendChild(keepPv);
      const head = document.createElement('div'); head.className = 'ag-head';
      const h = document.createElement('h3'); h.className = 'ag-title'; h.textContent = (0, /*()*/__C.ctText)('ctAgenda', 'Agenda');
      head.appendChild(h);
      if (a.items.length) {
        const pos = document.createElement('span'); pos.className = 'ag-pos';
        const tot = MA.totalMin(a);
        pos.textContent = (a.cur >= 0 ? (0, /*()*/__C.ctText)('agPos', '{i} of {n}', { i: a.cur + 1, n: a.items.length }) : (0, /*()*/__C.ctText)('agNotStarted', 'Not started')) + (tot ? ' · ' + (0, /*()*/__C.ctText)('agTotal', '{n} min in all', { n: tot }) : '');
        head.appendChild(pos);
      }
      const tools = document.createElement('div'); tools.className = 'ag-tools';
      // Open-floor rooms: anyone but its owner may stop it for everyone, as with a shared app (the owner's own Stop is in Edit).
      // Stop for everyone is a room-wide act, so it sits under the list, away from Hide (this screen only).
      let stopAll = null;
      if (a.items.length && !__C.CT.agEdit && !isOwner && MA.canStop(__C.CT.ag, __C.model.me.myId(), (0, /*()*/__C.ctAgCtx)(__C.model.me.myId())) && !(0, /*()*/__C.hasAdminRoom)()) stopAll = ctAgBtn('ag-btn ag-stopall', (0, /*()*/__C.ctText)('agStopAll', 'Stop for everyone'), () => { (0, /*()*/__C.ctAgendaPublish)(MA.clear(__C.CT.ag, __C.model.me.myId()), 'stop-all').then((ok) => { if (ok) (0, /*()*/__C.setStatus)((0, /*()*/__C.ctText)('agYouStopped', 'You stopped the agenda for everyone.')); }); }, (0, /*()*/__C.ctText)('agStopAllTip', 'Take the agenda off everyone\u2019s screen. Everyone sees that you did. Anyone can then share a new one.'));
      if (a.items.length && !__C.CT.agEdit) tools.appendChild(ctAgBtn('ag-btn ag-hide', (0, /*()*/__C.ctText)('agHide', 'Hide agenda'), () => (0, /*()*/__C.ctAgendaHide)(true), (0, /*()*/__C.ctText)('agHideTip', 'Hide the agenda on your screen only. Nothing is deleted, and everyone else still sees it.')));
      if (may && a.items.length && !__C.CT.agEdit) {
        if (a.cur > 0) tools.appendChild(ctAgBtn('ag-btn ag-back', (0, /*()*/__C.ctText)('agBack', 'Back'), () => (0, /*()*/__C.ctAgendaPublish)(MA.prev(__C.CT.ag, __C.model.me.myId()), 'back')));
        const last = a.cur >= a.items.length - 1;
        if (!last || a.cur < 0) tools.appendChild(ctAgBtn('ag-btn ag-next', a.cur < 0 ? (0, /*()*/__C.ctText)('agStart', 'Start') : (0, /*()*/__C.ctText)('agNext', 'Next'), () => (0, /*()*/__C.ctAgendaPublish)(MA.next(__C.CT.ag, __C.model.me.myId()), 'next')));
      }
      if (may) tools.appendChild(ctAgBtn('ag-btn ag-edit', __C.CT.agEdit ? (0, /*()*/__C.ctText)('agDone', 'Done') : (0, /*()*/__C.ctText)('agEdit', 'Edit'), () => {
        __C.CT.agEdit = !__C.CT.agEdit;
        if (!__C.CT.agEdit && !(__C.CT.ag && __C.CT.ag.items.length)) __C.CT.agLocal = false;
        (0, /*()*/__C.ctNote)('agenda-edit', { on: __C.CT.agEdit });
        try { (0, /*()*/__C.ctRefresh)(); layout(); } catch (e) {}
      }));
      head.appendChild(tools);
      p.appendChild(head);
      // Now: the current item, its bar, time left or over.
      const now = document.createElement('div'); now.className = 'ag-now'; now.hidden = true;
      now.innerHTML = '<div class="ag-nowt"></div><div class="ag-bar"><div class="ag-fill"></div></div><div class="ag-left"></div>';
      p.appendChild(now);
      const list = document.createElement('ol'); list.className = 'ag-list';
      a.items.forEach((it, i) => {
        const li = document.createElement('li'); li.className = 'ag-item'; li.dataset.id = it.id;
        if (i === a.cur) { li.classList.add('cur'); li.setAttribute('aria-current', 'step'); }
        else if (a.cur >= 0 && i < a.cur) li.classList.add('done');
        if (__C.CT.agEdit) {
          const words = ctAgWords((0, /*()*/__C.ctText)('agItemTitle', 'Item {n} title', { n: i + 1 }), it.t);
          const t = words.t;
          const mn = document.createElement('input'); mn.type = 'number'; mn.className = 'ag-in-min'; mn.min = '0'; mn.max = String(MA.MAX_MIN); mn.value = it.min ? String(it.min) : '';
          mn.placeholder = (0, /*()*/__C.ctText)('agMinPh', 'min'); mn.setAttribute('aria-label', (0, /*()*/__C.ctText)('agItemMinutes', 'Item {n} minutes', { n: i + 1 }));
          const commit = () => { if (t.value.trim() !== it.t || (+mn.value || 0) !== it.min) (0, /*()*/__C.ctAgendaPublish)(MA.edit(__C.CT.ag, __C.model.me.myId(), it.id, t.value, +mn.value || 0), 'edit'); };
          t.addEventListener('change', commit); mn.addEventListener('change', commit);
          li.appendChild(t); li.appendChild(words.count); li.appendChild(mn); li.appendChild(words.warn);
          const up = ctAgBtn('ag-mini', '↑', () => (0, /*()*/__C.ctAgendaPublish)(MA.move(__C.CT.ag, __C.model.me.myId(), it.id, -1), 'move'), (0, /*()*/__C.ctText)('agMoveUp', 'Move up'));
          const dn = ctAgBtn('ag-mini', '↓', () => (0, /*()*/__C.ctAgendaPublish)(MA.move(__C.CT.ag, __C.model.me.myId(), it.id, 1), 'move'), (0, /*()*/__C.ctText)('agMoveDown', 'Move down'));
          const rm = ctAgBtn('ag-mini', '✕', () => (0, /*()*/__C.ctAgendaPublish)(MA.remove(__C.CT.ag, __C.model.me.myId(), it.id), 'remove'), (0, /*()*/__C.ctText)('agRemove', 'Remove'));
          for (const b of [up, dn, rm]) b.setAttribute('aria-label', b.title);
          li.appendChild(up); li.appendChild(dn); li.appendChild(rm);
        } else {
          const t = document.createElement('span'); t.className = 'ag-t'; t.textContent = it.t;
          li.appendChild(t);
          if (it.min) { const mn = document.createElement('span'); mn.className = 'ag-min'; mn.textContent = (0, /*()*/__C.ctText)('agMin', '{n} min', { n: it.min }); li.appendChild(mn); }
          if (may) {
            li.tabIndex = 0;
            li.title = (0, /*()*/__C.ctText)('agGoTip', 'Make this the current item');
            const go = () => { if (i !== __C.CT.ag.cur) (0, /*()*/__C.ctAgendaPublish)(MA.go(__C.CT.ag, __C.model.me.myId(), i), 'go'); };
            li.addEventListener('click', go);
            li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
          }
        }
        list.appendChild(li);
      });
      p.appendChild(list);
      if (stopAll) p.appendChild(stopAll);
      if (!a.items.length && !__C.CT.agEdit) {
        const e = document.createElement('p'); e.className = 'ag-empty'; e.textContent = (0, /*()*/__C.ctText)('agNoItems', 'No items yet.'); p.appendChild(e);
      }
      if (__C.CT.agEdit) {
        const add = document.createElement('form'); add.className = 'ag-add';
        const words = ctAgWords((0, /*()*/__C.ctText)('agNewTitle', 'New item title'), '');
        const t = words.t;
        t.placeholder = (0, /*()*/__C.ctText)('agItemPh', 'What is this item?');
        const mn = document.createElement('input'); mn.type = 'number'; mn.className = 'ag-in-min'; mn.min = '0'; mn.max = String(MA.MAX_MIN); mn.placeholder = (0, /*()*/__C.ctText)('agMinPh', 'min');
        mn.setAttribute('aria-label', (0, /*()*/__C.ctText)('agNewMinutes', 'New item minutes'));
        const b = document.createElement('button'); b.type = 'submit'; b.className = 'ag-btn'; b.textContent = (0, /*()*/__C.ctText)('agAddItem', 'Add item');
        add.appendChild(t); add.appendChild(words.count); add.appendChild(mn); add.appendChild(b); add.appendChild(words.warn);
        add.addEventListener('submit', (e) => {
          e.preventDefault();
          if (!t.value.trim()) return;
          (0, /*()*/__C.ctAgendaPublish)(MA.add(__C.CT.ag, __C.model.me.myId(), t.value, +mn.value || 0), 'add').then((ok) => {
            if (!ok) return;
            const f = __C.CT.panes.get('agenda'); const nt = f && f.querySelector('.ag-add .ag-in-t'); if (nt) try { nt.focus(); } catch (err) {}
          });
        });
        p.appendChild(add);
        if (mayHand) {
          const who = document.createElement('div'); who.className = 'ag-who';
          const lb = document.createElement('div'); lb.className = 'ag-wholb'; lb.textContent = (0, /*()*/__C.ctText)('agWhoEdits', 'Who else can edit');
          who.appendChild(lb);
          const row = document.createElement('div'); row.className = 'ag-chips';
          const ids = Array.from(new Set(__C.model.roster.rosterIds())).filter((x) => x && x !== __C.model.me.myId()).slice(0, 24);
          for (const pid of ids) {
            const on = __C.CT.ag.ed.indexOf(pid) >= 0;
            const c = ctAgBtn('ag-chip', (0, /*()*/__C.displayName)(pid), () => (0, /*()*/__C.ctAgendaPublish)(MA.hand(__C.CT.ag, __C.model.me.myId(), pid, !on), on ? 'unhand' : 'hand'));
            c.setAttribute('aria-pressed', on ? 'true' : 'false');
            row.appendChild(c);
          }
          who.appendChild(row);
          p.appendChild(who);
        }
        if (__C.CT.ag && __C.CT.ag.items.length && (isOwner || ((0, /*()*/__C.hasAdminRoom)() && __C.amAdmin))) {
          p.appendChild(ctAgBtn('ag-btn ag-stop', (0, /*()*/__C.ctText)('agStop', 'Stop sharing the agenda'), () => { __C.CT.agEdit = false; (0, /*()*/__C.ctAgendaPublish)(MA.clear(__C.CT.ag, __C.model.me.myId()), 'clear'); }));
        }
      }
      if (!may) {
        const n = document.createElement('p'); n.className = 'ag-note'; n.textContent = (0, /*()*/__C.ctAgendaWhoText)(); p.appendChild(n);
      }
      (0, /*()*/__C.ctPaintAgendaClock)(p);
    }
    // The More sheet's Agenda button: open the agenda (start one if you may).
    function ctAgendaOpen() {
      if (!ctInit()) return;
      if ((0, /*()*/__C.ctAgHidden)()) { __C.CT.agHide = false; (0, /*()*/__C.ctAgendaHide)(false); }   // the button is Show agenda while it is hidden
      if (__C.CT.ag && __C.CT.ag.items.length) { (0, /*()*/__C.ctRefresh)(); (0, /*()*/__C.ctSelect)('agenda', 'button'); return; }
      if (!(0, /*()*/__C.ctCanEditAgenda)()) { (0, /*()*/__C.setStatus)((0, /*()*/__C.hasAdminRoom)() ? (0, /*()*/__C.ctText)('agHostOnlyTip', 'Only the host can share an agenda in this room.') : (0, /*()*/__C.ctAgendaWhoText)()); return; }
      __C.CT.agLocal = true; __C.CT.agEdit = true;
      (0, /*()*/__C.ctRefresh)();
      (0, /*()*/__C.ctSelect)('agenda', 'start');
      try { layout(); } catch (e) {}
      requestAnimationFrame(() => { const p = __C.CT.panes.get('agenda'); const t = p && p.querySelector('.ag-add .ag-in-t'); if (t) try { t.focus(); } catch (e) {} });
    }
    {
      const ab = document.getElementById('agendabtn');
      if (ab) ab.addEventListener('click', () => ctAgendaOpen());
      // The content tabs are the meeting's content region: Focus lists them.
      try { if (window.GifOS && GifOS.meetViewMode && GifOS.meetViewMode.content) GifOS.meetViewMode.content.add(() => (__C.fsInline ? (0, /*()*/__C.ctFocusSources)() : [])); } catch (e) {}
    }
    // For the room tests and the debug dump: what the area shows.
    window.__meetContent = () => {
      if (!__C.CT) return { on: false };
      const MC = GifOS.meetContent;
      const r = __C.CT.el.getBoundingClientRect();
      const panes = {};
      for (const [k, p] of __C.CT.panes) {
        const pr = p.getBoundingClientRect();
        const v = p.querySelector('video');
        panes[k] = { shown: !p.hidden && pr.width > 0, box: [Math.round(pr.left), Math.round(pr.top), Math.round(pr.width), Math.round(pr.height)], src: p.dataset.src || '', vw: v ? v.videoWidth : 0, vh: v ? v.videoHeight : 0 };
      }
      const ap = document.getElementById('apppane');
      const apr = ap ? ap.getBoundingClientRect() : null;
      return {
        on: __C.CT.items.length > 0, keys: __C.CT.items.map((i) => i.key), sel: __C.CT.st.sel, all: __C.CT.st.all, badges: MC.badges(__C.CT.st),
        tabs: !!(__C.CT.plan && __C.CT.plan.tabs), show: __C.CT.plan ? __C.CT.plan.show.slice() : [], view: window.__meetView || 'fit', present: !!__C.CT.present,
        facesHidden: !!__C.CT.facesHidden, box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], hidden: __C.CT.el.hidden,
        panes: panes, app: apr ? { box: [Math.round(apr.left), Math.round(apr.top), Math.round(apr.width), Math.round(apr.height)], off: document.body.classList.contains('ct-app-off'), vis: getComputedStyle(ap).visibility } : null,
        inset: __C.CT.inset.hidden ? null : { pid: __C.CT.inset.dataset.pid || '', box: [__C.CT.inset.offsetLeft, __C.CT.inset.offsetTop, __C.CT.inset.offsetWidth, __C.CT.inset.offsetHeight], vw: (__C.CT.inset.querySelector('video') || {}).videoWidth || 0 },
        agenda: __C.CT.ag ? { v: __C.CT.ag.v, cur: __C.CT.ag.cur, n: __C.CT.ag.items.length, owner: __C.CT.ag.owner, ed: __C.CT.ag.ed.slice(), items: __C.CT.ag.items.map((i) => i.t), clock: (0, /*()*/__C.ctAgendaShortTime)(), canEdit: (0, /*()*/__C.ctCanEditAgenda)() } : (__C.CT.agLocal ? { local: true, canEdit: (0, /*()*/__C.ctCanEditAgenda)() } : null),
      };
    };
    yield 653;
    // ---- 0.9.23b: calm by default, tap a tile for its controls, viewer crop ----
    // Calm: tiles show only the name and the green speaking frame. Any touch,
    // scroll, mouse move or key wakes the info (body.meet-awake) for 3 s.
    const AWAKE_MS = GifOS.timings.AWAKE_MS;
    let awakeT = 0;
    function wakeMeet() {
      document.body.classList.add('meet-awake');
      if (awakeT) clearTimeout(awakeT);
      awakeT = setTimeout(() => {
        awakeT = 0;
        if (__C.model.roster.tileWin().el) return; // an open control window keeps the info up
        document.body.classList.remove('meet-awake');
      }, AWAKE_MS);
    }
    yield 657;
    try { const fe = document.getElementById('feed'); if (fe) fe.addEventListener('scroll', wakeMeet, { passive: true }); } catch (e) {}
    yield 664;
    function applyViewerCrops() {
      document.querySelectorAll('#feed .tile[data-comfy="1"]').forEach((t) => { try { (0, /*()*/__C.applyViewerCrop)(t); } catch (e) {} });
    }
    yield 668;
    function twName(el, id) {
      if (el.id === 'stadwhole' && id) return (0, /*()*/__C.displayName)(id) || id;
      if (el.id === 'bc-ident') { const n = document.getElementById('bc-ident-name'); return (n && n.textContent) || (0, /*()*/__C.uiText)('stageLabel', 'On stage'); }
      if (el.classList.contains('rowtile')) { const lb = el.querySelector('.rlabel'); return (lb && lb.textContent) || (0, /*()*/__C.uiText)('stageLabel', 'On stage'); }
      if (el.classList.contains('me')) { try { return (0, /*()*/__C.myName)() + ' ' + (0, /*()*/__C.uiText)('youParen', '(you)'); } catch (e) { return 'You'; } }
      const nm = el.querySelector('.name');
      return (nm && nm.textContent) || (id && (0, /*()*/__C.displayName)(id)) || '';
    }
    yield 671;
    function twButton(label, on, fn, extra) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tw-btn' + (on ? ' on' : '') + (extra ? ' ' + extra : '');
      b.textContent = label;
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(b); });
      return b;
    }
    // The preview fills the card beside the control column. A 72px cap made
    // it a postage stamp. On a short landscape screen the card is the full
    // height, so the preview takes that leftover height and the card widens
    // to match. Portrait still sizes from the card's width.
    function twSizePad(pad, vw, vh) {
      const split = pad.closest ? pad.closest('.tw-split') : null;
      const sideEl = split ? split.querySelector('.tw-side') : null;
      const sideW = sideEl && sideEl.offsetWidth ? sideEl.offsetWidth : 0;
      const win = pad.closest ? pad.closest('#tilewin') : null;
      const shortLand = !!(window.matchMedia && matchMedia('(max-height: 500px) and (orientation: landscape)').matches);
      if (shortLand && win && split && win.clientHeight > 80) {
        const cs = getComputedStyle(win);
        const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
        const padB = parseFloat(cs.paddingBottom) || 0;
        // The window grows out of the tile with a scale transform for .28 s,
        // and this runs inside it (rAF, loadedmetadata). A screen-px measure
        // then reads the head and help lines short and the pad overflows the
        // card (UI-1052, 353 vs 344). Measure in layout px: undo the scale.
        const wr = win.getBoundingClientRect();
        const sy = win.offsetHeight > 0 && wr.height > 0 ? wr.height / win.offsetHeight : 1;
        const above = Math.max(0, (split.getBoundingClientRect().top - wr.top) / sy);
        // A few pixels of slack: the help line can wrap after this measure, and
        // a pad that ends in the padding makes the card report a scroll.
        const maxH = Math.max(80, Math.floor(win.clientHeight - above - padB - 8));
        const side = sideW > 40 ? sideW : 112;
        const maxW = Math.max(80, Math.floor((window.innerWidth || 800) - 24 - padX - side - 8));
        let w = maxW;
        let h = vw > 0 ? w * vh / vw : w * 9 / 16;
        if (h > maxH && h > 0) { h = maxH; w = vw > 0 ? h * vw / vh : w; }
        if (w > maxW && w > 0) { w = maxW; h = vw > 0 ? w * vh / vw : h; }
        pad.style.aspectRatio = (vw || 16) + ' / ' + (vh || 9);
        pad.style.width = Math.round(Math.max(1, w)) + 'px';
        pad.style.height = Math.round(Math.max(1, h)) + 'px';
        const want = Math.ceil(w + 8 + side + padX);
        win.style.width = Math.min(want, Math.floor((window.innerWidth || 800) - 24)) + 'px';
        return;
      }
      if (win && win.style.width) win.style.width = '';
      const splitW = (split && split.clientWidth) || (pad.parentElement && pad.parentElement.clientWidth) || 360;
      const maxW = Math.max(80, splitW - sideW - (sideW ? 8 : 0));
      const maxH = Math.min(Math.round((window.innerHeight || 800) * 0.42), 420);
      let w = maxW;
      let h = vw > 0 ? w * vh / vw : w * 9 / 16;
      if (h > maxH && h > 0) { h = maxH; w = vw > 0 ? h * vw / vh : w; }
      pad.style.aspectRatio = (vw || 16) + ' / ' + (vh || 9);
      pad.style.width = Math.round(Math.max(1, w)) + 'px';
      pad.style.height = Math.round(Math.max(1, h)) + 'px';
    }
    function twCropSection(win, el, isMe) {
      const MZ = GifOS.meetZones;
      const tv = el.querySelector(':scope > video');
      let stream = null;
      if (isMe) stream = __C.model.me.localStream() && __C.model.me.localStream().getVideoTracks()[0] ? new MediaStream([__C.model.me.localStream().getVideoTracks()[0]]) : null;
      else stream = tv && tv.srcObject;
      if (!MZ || !stream || el.classList.contains('cam-off')) return;
      const sec = document.createElement('div'); sec.className = 'tw-sec';
      sec.innerHTML = '<b></b><p class="tw-help"></p><div class="tw-split"><div class="tw-pad"><video muted playsinline autoplay></video><div class="tw-win"></div></div>'
        + '<div class="tw-side"><div class="tw-zoom"><span aria-hidden="true">−</span><input type="range" min="30" max="100" step="1"><span aria-hidden="true">+</span></div><div class="tw-row"></div></div></div>';
      sec.querySelector('b').textContent = isMe ? 'Crop what everyone sees' : 'Pan, zoom and crop';
      sec.querySelector('.tw-help').textContent = isMe
        ? 'Drag the square. Everyone gets exactly this part of your camera.'
        : 'Drag the square. Only your screen changes; it costs no bandwidth.';
      const pad = sec.querySelector('.tw-pad'), pv = pad.querySelector('video'), win2 = pad.querySelector('.tw-win');
      const zoom = sec.querySelector('input');
      zoom.setAttribute('aria-label', 'Zoom');
      pv.muted = true; pv.srcObject = stream; const pr = pv.play(); if (pr && pr.catch) pr.catch(() => {});
      let crop = Object.assign({ x: 0.5, y: 0.5, s: 1 }, isMe ? (window.__senderCrop.get() || {}) : ((0, /*()*/__C.viewerCropOf)(el.dataset.pzkey) || {}));
      let pushT = 0;
      const push = () => {
        if (isMe) {
          if (pushT) clearTimeout(pushT);
          pushT = setTimeout(() => { pushT = 0; window.__senderCrop.set(crop); }, 120);
        } else {
          if (MZ.isDefault(crop)) delete __C.model.roster.vcrops()[el.dataset.pzkey]; else __C.model.roster.vcrops()[el.dataset.pzkey] = { x: crop.x, y: crop.y, s: crop.s };
          (0, /*()*/__C.saveVcrops)();
          (0, /*()*/__C.applyViewerCrop)(el);
        }
      };
      const paint = () => {
        // The preview never shows more than the tile does: same blur.
        if (!isMe && tv) { try { const f = getComputedStyle(tv).filter; pv.style.filter = f && f !== 'none' ? f : ''; } catch (e) {} }
        const vw = pv.videoWidth || (tv && tv.videoWidth) || 16, vh = pv.videoHeight || (tv && tv.videoHeight) || 9;
        twSizePad(pad, vw, vh);
        crop = MZ.normCrop(crop, vw, vh);
        const pw = pad.clientWidth || 300, ph = pw * vh / vw;
        const side = crop.s * Math.min(vw, vh) * (pw / vw);
        win2.style.width = side + 'px'; win2.style.height = side + 'px';
        win2.style.left = (crop.x * pw - side / 2) + 'px'; win2.style.top = (crop.y * ph - side / 2) + 'px';
        zoom.value = String(Math.round(crop.s * 100));
      };
      pv.addEventListener('loadedmetadata', paint); pv.addEventListener('resize', paint);
      let drag = null;
      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        try { pad.setPointerCapture(e.pointerId); } catch (err) {}
        drag = { x: e.clientX, y: e.clientY, cx: crop.x, cy: crop.y };
      });
      pad.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const r = pad.getBoundingClientRect();
        crop.x = drag.cx + (e.clientX - drag.x) / Math.max(1, r.width);
        crop.y = drag.cy + (e.clientY - drag.y) / Math.max(1, r.height);
        paint(); push();
      });
      const end = () => { drag = null; };
      pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
      zoom.addEventListener('input', () => { crop.s = (+zoom.value || 100) / 100; paint(); push(); });
      sec.querySelector('.tw-row').appendChild(twButton('Reset', false, () => { crop = { x: 0.5, y: 0.5, s: 1 }; paint(); push(); }));
      win.appendChild(sec);
      requestAnimationFrame(paint);
    }
    // On the Stage: frame what the Stage shows, any shape. Drag the frame to
    // move it, drag its corner to resize it; Whole picture sends it all.
    function twStageFrameSection(win) {
      const cam = __C.model.me.localStream() && __C.model.me.localStream().getVideoTracks()[0];
      if (!cam || __C.model.me.myStatus().camOff) return;
      const sec = document.createElement('div'); sec.className = 'tw-sec tw-stageframe';
      sec.innerHTML = '<b>Frame what the Stage shows</b><p class="tw-help">On the Stage everyone sees your whole camera at its own shape. Drag the frame to show less, or its corner to change its size and shape.</p>'
        + '<div class="tw-split"><div class="tw-pad"><video muted playsinline autoplay></video><div class="tw-win tw-rect"><i class="tw-grip" aria-hidden="true"></i></div></div><div class="tw-side"><div class="tw-row"></div></div></div>';
      const pad = sec.querySelector('.tw-pad'), pv = pad.querySelector('video'), box = pad.querySelector('.tw-rect');
      pv.muted = true; pv.srcObject = new MediaStream([cam]); const pr = pv.play(); if (pr && pr.catch) pr.catch(() => {});
      let f = Object.assign({ x: 0.5, y: 0.5, w: 1, h: 1 }, __M.stageFrameVal || {});
      let pushT = 0;
      const push = () => { if (pushT) clearTimeout(pushT); pushT = setTimeout(() => { pushT = 0; (0, /*()*/__M.setStageFrame)(f); }, 120); };
      const paint = () => {
        const vw = pv.videoWidth || 16, vh = pv.videoHeight || 9;
        twSizePad(pad, vw, vh);
        const n = (0, /*()*/__M.normStageFrame)(f) || { x: 0.5, y: 0.5, w: 1, h: 1 };
        f = n;
        box.style.left = ((n.x - n.w / 2) * 100) + '%'; box.style.top = ((n.y - n.h / 2) * 100) + '%';
        box.style.width = (n.w * 100) + '%'; box.style.height = (n.h * 100) + '%';
      };
      pv.addEventListener('loadedmetadata', paint); pv.addEventListener('resize', paint);
      let drag = null;
      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        try { pad.setPointerCapture(e.pointerId); } catch (err) {}
        const br = box.getBoundingClientRect();
        const corner = Math.abs(e.clientX - br.right) < 28 && Math.abs(e.clientY - br.bottom) < 28;
        drag = { corner: corner, x: e.clientX, y: e.clientY, f: Object.assign({}, f) };
      });
      pad.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const r = pad.getBoundingClientRect();
        const dx = (e.clientX - drag.x) / Math.max(1, r.width), dy = (e.clientY - drag.y) / Math.max(1, r.height);
        if (drag.corner) {
          // The top-left corner stays put; the frame grows or shrinks.
          const l = drag.f.x - drag.f.w / 2, t = drag.f.y - drag.f.h / 2;
          const w = Math.min(1 - l, Math.max(0.2, drag.f.w + dx)), h = Math.min(1 - t, Math.max(0.2, drag.f.h + dy));
          f = { x: l + w / 2, y: t + h / 2, w: w, h: h };
        } else f = { x: drag.f.x + dx, y: drag.f.y + dy, w: drag.f.w, h: drag.f.h };
        paint(); push();
      });
      const end = () => { drag = null; };
      pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
      sec.querySelector('.tw-row').appendChild(twButton('Whole picture', !__M.stageFrameVal, () => { f = { x: 0.5, y: 0.5, w: 1, h: 1 }; paint(); push(); }));
      win.appendChild(sec);
      requestAnimationFrame(paint);
    }
    function twFill(win, el) {
      win.textContent = '';
      const id = (0, /*()*/__C.twIdOf)(el);
      const isMe = el.classList.contains('me');
      const isStage = el.classList.contains('rowtile');
      const head = document.createElement('div'); head.className = 'tw-head';
      const nm = document.createElement('div'); nm.className = 'tw-name'; nm.id = 'tilewin-title'; nm.textContent = twName(el, id);
      const x = document.createElement('button'); x.type = 'button'; x.className = 'tw-close'; x.textContent = '✕';
      x.setAttribute('aria-label', 'Close'); x.addEventListener('click', (e) => { e.stopPropagation(); closeTileWin(); });
      head.appendChild(nm); head.appendChild(x); win.appendChild(head);
      // Info: the badges the tile no longer wears.
      const info = document.createElement('div'); info.className = 'tw-info';
      el.querySelectorAll(':scope > .chips span, :scope > .botbadge').forEach((c) => {
        let t = (c.getAttribute('aria-label') || c.title || c.textContent || '').trim();
        // The tile's sentence wraps into a tall pill. The sheet shows one short word.
        if (/recording/i.test(t)) t = 'recording';
        if (t) { const sp = document.createElement('span'); sp.textContent = t; info.appendChild(sp); }
      });
      if ((isMe || isStage) && (0, /*()*/__C.meOnStage)() && !__C.model.me.myStatus().scr) twStageFrameSection(win);
      else if (!isStage && (el.dataset.tier === 'row' || isMe)) twCropSection(win, el, isMe);
      if (!isStage && !win.querySelector('.tw-pad')) {
        // No live picture to show (camera off, or a Stadium face): the
        // person's picture or initial stands in.
        const face = document.createElement('div'); face.className = 'tw-face';
        const av = el.querySelector('.avatar');
        if (av) { const c = av.cloneNode(true); c.removeAttribute('style'); c.className = 'tw-face-av'; face.appendChild(c); }
        else if (id && el.id === 'stadwhole') { const c = document.createElement('div'); c.className = 'tw-face-av'; try { c.textContent = (0, /*()*/__C.nameInitial)(twName(el, id)); } catch (e) {} face.appendChild(c); }
        win.appendChild(face);
      }
      const side = win.querySelector('.tw-side');
      const sec = document.createElement('div'); sec.className = 'tw-sec';
      const lab = document.createElement('b'); lab.textContent = isMe ? 'You' : isStage ? 'Stage' : 'Person';
      sec.appendChild(lab);
      const row = document.createElement('div'); row.className = 'tw-row';
      if (isMe) {
        const mic = document.getElementById('mic'), cam = document.getElementById('cam');
        if (mic) row.appendChild(twButton(__C.model.me.myStatus().muted ? 'Unmute' : 'Mute', !__C.model.me.myStatus().muted, () => { mic.click(); closeTileWin(); }));
        if (cam) row.appendChild(twButton(__C.model.me.myStatus().camOff ? 'Cam on' : 'Cam off', !__C.model.me.myStatus().camOff, () => { cam.click(); closeTileWin(); }));
        if (__C.model.me.myStatus().scr) row.appendChild(twButton((0, /*()*/__C.uiText)('stopShare', 'Stop sharing'), false, () => { try { (0, /*()*/__M.stopScreenShare)(); } catch (e) {} closeTileWin(); }, 'danger'));
      } else if (isStage) {
        if (__C.model.me.myStatus().scr) row.appendChild(twButton((0, /*()*/__C.uiText)('stopShare', 'Stop sharing'), false, () => { try { (0, /*()*/__M.stopScreenShare)(); } catch (e) {} closeTileWin(); }, 'danger'));
        else if ((0, /*()*/__C.meOnStage)()) {
          const sb = document.getElementById('stagebtn');
          if (sb) row.appendChild(twButton('Step off the stage', false, () => { sb.click(); closeTileWin(); }));
        }
      } else if (id) {
        // Pin puts a person's own tile on my Stage. A Stadium face has no tile of its own here, so it offers none.
        const pinnable = el.id !== 'stadwhole' || !!((0, /*()*/__C.twPeer)(id) && (0, /*()*/__C.twPeer)(id).tile && (0, /*()*/__C.twPeer)(id).tile.style.display !== 'none');
        if (pinnable) row.appendChild(twButton(__C.focusId === id ? 'Unpin' : 'Pin', __C.focusId === id, () => {
          __C.act.surface({ focusId: __C.focusId === id ? null : id });
          closeTileWin();
          try { layout(); } catch (e) {}
        }));
        // Whose captions this page shows for this person: the same card as the caption warning, any time.
        // A Stadium face always offers it (the caption bar is only a shortcut to whoever is speaking).
        const cb = (0, /*()*/__C.twCaptionsButton)(id, el.id === 'stadwhole');
        if (cb) row.appendChild(cb);
      }
      // Beside a preview, Mute, Camera and the recording pill stay in the
      // narrow column. They used to be full-width rows under a 72px frame.
      if (row.childNodes.length) (side || sec).appendChild(row);
      if (info.childNodes.length) (side || win).appendChild(info);
      // The tile's own per-person controls (role-aware, painted by updateTile).
      const p = (0, /*()*/__C.twPeer)(id);
      if (!isMe && p && p.modbar) {
        __C.model.roster.tileWin().modbar = p.modbar; __C.model.roster.tileWin().home = p.tile;
        try { (0, /*()*/__C.updateTile)(id); } catch (e) {}
        (side || sec).appendChild(p.modbar);
      }
      if (!side && sec.childNodes.length > 1) win.appendChild(sec);
      // The Stage strip is one picture of several people: the window lists them, each with their own Captions.
      if (isStage) {
        let on = []; try { on = (0, /*()*/__C.stageIds)().filter((x) => x && x !== __C.model.me.myId()); } catch (e) {}
        const who = on.map((x) => ({ x, b: (0, /*()*/__C.twCaptionsButton)(x, true) })).filter((r) => r.b);
        if (who.length) {
          const cs = document.createElement('div'); cs.className = 'tw-sec tw-stagecap';
          const cl = document.createElement('b'); cl.textContent = (0, /*()*/__C.uiText)('twStageCaptions', 'Captions on stage'); cs.appendChild(cl);
          for (const r of who) {
            const line = document.createElement('div'); line.className = 'tw-cap';
            const nm = document.createElement('span'); nm.className = 'tw-cap-name'; nm.textContent = (0, /*()*/__C.displayName)(r.x) || r.x;
            line.appendChild(nm); line.appendChild(r.b); cs.appendChild(line);
          }
          win.appendChild(cs);
        }
      }
      // Broadcast: what a watcher can do with the Stage.
      if (document.body.classList.contains('broadcast')) {
        const w = document.createElement('div'); w.className = 'tw-sec';
        const wb = document.createElement('b'); wb.textContent = 'Watch'; w.appendChild(wb);
        const wr = document.createElement('div'); wr.className = 'tw-row';
        const shown = (id2) => { const b = document.getElementById(id2); return b && b.offsetParent !== null ? b : null; };
        const pip = document.getElementById('pipbtn');
        if (pip && pip.style.display !== 'none') {
          const fb = twButton(document.pictureInPictureElement ? 'Stop floating' : 'Float', !!document.pictureInPictureElement, () => { pip.click(); closeTileWin(); });
          fb.dataset.pip = '1';
          wr.appendChild(fb);
        }
        const snd = shown('airsound');
        if (snd) wr.appendChild(twButton(snd.textContent || 'Sound', snd.getAttribute('aria-pressed') === 'true', () => { snd.click(); closeTileWin(); }));
        const cc = shown('bc-cap-btn');
        if (cc) wr.appendChild(twButton(cc.getAttribute('aria-pressed') === 'false' ? 'Show captions' : 'Hide captions', cc.getAttribute('aria-pressed') !== 'false', () => { cc.click(); closeTileWin(); }));
        if (wr.childNodes.length) { w.appendChild(wr); win.appendChild(w); }
      }
    }
    function placeTileWin(win, big) {
      const vw = window.innerWidth, vh = window.innerHeight;
      if (phoneLayout()) { win.style.left = win.style.top = ''; return; }
      const ww = win.offsetWidth || 380, wh = win.offsetHeight || 300;
      // Centred on the tile it grew out of, kept on screen.
      const left = Math.max(12, Math.min(vw - ww - 12, big.x + big.w / 2 - ww / 2));
      const top = Math.max(12, Math.min(vh - wh - 12, big.y + big.h / 2 - wh / 2));
      win.style.left = left + 'px'; win.style.top = top + 'px';
    }
    function openTileWin(el) {
      if (__C.model.roster.tileWin().el === el) return;
      if (__C.model.roster.tileWin().el) closeTileWin();
      const chrome = ensureTileChrome();
      const veil = chrome.veil, win = chrome.win;
      __C.model.roster.tileWin().el = el;
      const vw = window.innerWidth, vh = window.innerHeight;
      // A broadcast Stage already fills the screen: its window opens beside
      // it without growing anything.
      if (!document.body.classList.contains('comfy')) {
        const r = el.getBoundingClientRect();
        veil.hidden = false;
        document.body.classList.add('tw-open', 'meet-awake');
        twFill(win, el);
        win.hidden = false;
        placeTileWin(win, { x: r.left, y: r.top, w: Math.min(r.width, vw - 380), h: r.height });
        return;
      }
      // The tile expands into the window: the window grows out of the
      // tile's own rectangle. The tile stays as it is behind the veil.
      const r = el.getBoundingClientRect();
      veil.hidden = false;
      document.body.classList.add('tw-open', 'meet-awake');
      twFill(win, el);
      win.hidden = false;
      placeTileWin(win, { x: r.left, y: r.top, w: r.width, h: r.height });
      const wr = win.getBoundingClientRect();
      if (wr.width > 0 && wr.height > 0 && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
        win.style.transition = 'none';
        win.style.transformOrigin = '0 0';
        win.style.transform = 'translate(' + (r.left - wr.left) + 'px,' + (r.top - wr.top) + 'px) scale(' + (r.width / wr.width) + ',' + (r.height / wr.height) + ')';
        win.style.opacity = '0.6';
        void win.offsetWidth;
        win.style.transition = 'transform .28s cubic-bezier(.2,.8,.2,1), opacity .2s ease';
        win.style.transform = '';
        win.style.opacity = '';
      }
      const first = win.querySelector('.tw-close'); if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
    }
    function closeTileWin() {
      const el = __C.model.roster.tileWin().el;
      if (!el) return;
      __C.model.roster.tileWin().el = null; __C.model.roster.tileWin().faceId = '';
      if (__C.model.roster.tileWin().winT) { clearTimeout(__C.model.roster.tileWin().winT); __C.model.roster.tileWin().winT = 0; }
      const win = document.getElementById('tilewin'), veil = document.getElementById('tilewin-veil');
      if (__C.model.roster.tileWin().modbar && __C.model.roster.tileWin().home) { try { __C.model.roster.tileWin().home.appendChild(__C.model.roster.tileWin().modbar); } catch (e) {} }
      __C.model.roster.tileWin().modbar = __C.model.roster.tileWin().home = null;
      if (win) { win.querySelectorAll('video').forEach((v) => { try { v.srcObject = null; } catch (e) {} }); win.hidden = true; win.textContent = ''; win.style.width = ''; }
      if (veil) veil.hidden = true;
      document.body.classList.remove('tw-open');
      try { if (el.classList.contains('tile')) (0, /*()*/__C.applyViewerCrop)(el); } catch (e) {}
      wakeMeet();
      try { el.focus({ preventScroll: true }); } catch (e) {}
    }
    // The stage window is a snapshot taken while the share is up. Stopping
    // from the dock or the browser's own bar removes the slide and used to
    // leave "Your screen — on stage / Stop sharing" on screen. A copy of
    // stopScreenShare lifted into a unit sandbox has no window, so the call
    // there is a no-op.
    function dropStaleShareWin() {
      if (!__C.model.roster.tileWin().el || __C.model.me.myStatus().scr) return;
      const el = __C.model.roster.tileWin().el;
      const strip = el.classList && el.classList.contains('rowtile') && el.dataset && el.dataset.row === 'sgs';
      if (!el.isConnected || strip) { closeTileWin(); return; }
      const win = document.getElementById('tilewin');
      if (!win || win.hidden) return;
      const word = (0, /*()*/__C.uiText)('stopShare', 'Stop sharing');
      let stale = false;
      win.querySelectorAll('button').forEach((b) => { if ((b.textContent || '').trim() === word) stale = true; });
      if (stale) twFill(win, el);
    }
    function ensureTileChrome() {
      let veil = document.getElementById('tilewin-veil'), win = document.getElementById('tilewin');
      if (!veil) {
        veil = document.createElement('div'); veil.id = 'tilewin-veil'; veil.hidden = true;
        veil.addEventListener('click', (e) => { e.stopPropagation(); closeTileWin(); });
        document.body.appendChild(veil);
      }
      if (!win) {
        win = document.createElement('div'); win.id = 'tilewin'; win.hidden = true;
        win.setAttribute('role', 'dialog'); win.setAttribute('aria-modal', 'true'); win.setAttribute('aria-labelledby', 'tilewin-title');
        win.addEventListener('click', (e) => e.stopPropagation());
        document.body.appendChild(win);
      }
      return { veil: veil, win: win };
    }
    // Settings → Adjust stage video. Same Stage frame as a step-up, and no
    // step-up: does not call setStage and does not pin the local self-view.
    function openStageAdjust() {
      const modal = document.getElementById('set-modal');
      if (modal) modal.style.display = 'none';
      if (__C.model.roster.tileWin().el) closeTileWin();
      const chrome = ensureTileChrome();
      const veil = chrome.veil, win = chrome.win;
      const anchor = (__C.model.me.meTile() && __C.model.me.meTile().tile) || document.getElementById('feed') || document.body;
      __C.model.roster.tileWin().el = anchor;
      veil.hidden = false;
      document.body.classList.add('tw-open', 'meet-awake');
      win.textContent = '';
      const head = document.createElement('div'); head.className = 'tw-head';
      const nm = document.createElement('div'); nm.className = 'tw-name'; nm.id = 'tilewin-title';
      nm.textContent = (__C.model.me.meTile() && __C.model.me.meTile().tile) ? twName(__C.model.me.meTile().tile, 'me') : 'Stage video';
      const x = document.createElement('button'); x.type = 'button'; x.className = 'tw-close'; x.textContent = '✕';
      x.setAttribute('aria-label', 'Close'); x.addEventListener('click', (e) => { e.stopPropagation(); closeTileWin(); });
      head.appendChild(nm); head.appendChild(x); win.appendChild(head);
      twStageFrameSection(win);
      if (!win.querySelector('.tw-stageframe')) {
        const p = document.createElement('p'); p.className = 'tw-help';
        p.textContent = 'Turn your camera on to preview what the stage would show.';
        win.appendChild(p);
      }
      win.hidden = false;
      const vw = window.innerWidth, vh = window.innerHeight;
      placeTileWin(win, { x: vw / 2, y: vh / 2, w: 0, h: 0 });
      const first = win.querySelector('.tw-close'); if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
    }
    yield 683;
    (function () {
      const feed = document.getElementById('feed');
      if (!feed) return;
      feed.addEventListener('click', (e) => {
        const bc = document.body.classList.contains('broadcast');
        if (!document.body.classList.contains('comfy') && !bc) return;
        const t = e.target;
        if (!t || !t.closest) return;
        // Open is the only control that opens the sheet. Its own listener does.
        if (t.closest('.tile-open')) return;
        // A control inside a tile keeps its own click: a real button, or a chip that acts as one (role=button, the
        // self tile's Stop sharing chip), which this capture listener would otherwise swallow before its handler.
        if (t.closest('button, a, input, select, textarea, label, [role="button"]')) return;
        const bcStage = () => {
          const id = document.getElementById('bc-ident');
          if (id && id.offsetParent !== null) return id;
          return document.querySelector('#stagefeed > .rowtile') || document.querySelector('#feed .tile.onstage');
        };
        const el = bc ? (t.closest('#feed .tile, #stagefeed > .rowtile, #bc-ident') || bcStage())
          : t.closest('.tile[data-comfy="1"], #stagefeed > .rowtile[data-comfy="1"]');
        if (!el) return;
        e.stopPropagation();
      }, true);
      // A tap on a Stadium face opens that person's small window (Captions). The Stadium is one picture: the tap's place
      // in it names the person (meetViews.stadFaceAt).
      feed.addEventListener('click', (e) => {
        if (!document.body.classList.contains('comfy')) return;
        const t = e.target, w = t && t.closest ? t.closest('#stadwhole') : null;
        if (!w || t.closest('button, a, input, select, textarea, label, [role="button"]')) return;
        const id = (0, /*()*/__C.stadFaceIdAt)(w, e.clientX, e.clientY);
        if (!id || id === __C.model.me.myId()) return;
        e.stopPropagation();
        if (__C.model.roster.tileWin().el) closeTileWin();
        __C.model.roster.tileWin().faceId = String(id);
        openTileWin(w);
      });
      const stampFeedOpens = () => {
        feed.querySelectorAll('.tile, #stagefeed > .rowtile').forEach(stampTileOpen);
      };
      stampFeedOpens();
      if (window.MutationObserver) {
        try { new MutationObserver(stampFeedOpens).observe(feed, { childList: true, subtree: true }); } catch (e) {}
      }
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && __C.model.roster.tileWin().el) { e.stopPropagation(); closeTileWin(); } }, true);
    })();
    // The build label's width changes with the build, so Fit sits just left of it.
    function placeFit() {
      if (!fitbtn) return;
      // In the top bar nothing is placed by hand: flex lays the row out.
      if (fitbtn.parentNode && fitbtn.parentNode.id === 'tophead') { fitbtn.style.right = ''; const c = document.querySelector('.topchip'); if (c) c.style.maxWidth = ''; return; }
      const bf = document.getElementById('gifos-build-float');
      const r = bf && bf.getClientRects().length ? bf.getBoundingClientRect() : null;
      const desk = window.matchMedia('(min-width: 601px) and (min-height: 501px)').matches;
      fitbtn.style.right = desk && r ? Math.round(window.innerWidth - r.left + 8) + 'px' : '';
      // The header line ends before Fit, however long its status gets.
      const chip = document.querySelector('.topchip');
      if (chip) {
        const fr = desk && fitbtn.getClientRects().length ? fitbtn.getBoundingClientRect() : null;
        const cl = chip.getBoundingClientRect().left;
        let end = fr ? fr.left : 0;
        // A desktop's hand line sits left of Fit in the same row.
        const hq = document.getElementById('handq');
        if (desk && hq && hq.classList.contains('on') && document.body.classList.contains('desk-ptr') && hq.getClientRects().length) {
          const hr = hq.getBoundingClientRect();
          if (hr.top < 80) end = end ? Math.min(end, hr.left) : hr.left;
        }
        chip.style.maxWidth = end > cl ? Math.max(160, Math.floor(end - cl - 8)) + 'px' : '';
      }
    }
    // The top bar (R1): adopt the top controls once, keep the meeting's own
    // Invite / Help / Full screen row in it outside an app (an app shows its
    // own bar at the top of its pane), and publish the bar's bottom edge as
    // --headh: the one number the meeting box starts from.
    (function topHead() {
      const head = document.getElementById('tophead');
      if (!head) return;
      const put = (el) => { if (el && el.parentNode !== head) head.appendChild(el); };
      const ver = () => { const v = document.getElementById('gifos-build-float'); if (v && v.parentNode !== head) head.insertBefore(v, head.firstChild); return !!v; };
      put(document.querySelector('.topchip'));
      put(document.getElementById('unmute'));
      put(document.getElementById('showcam'));
      put(fitbtn);
      put(document.getElementById('admcount'));   // its own full-width row under the controls (css .admcount)
      const appbar = document.getElementById('appbar'), pane = document.getElementById('apppane');
      const appOwn = () => document.body.classList.contains('has-app') || document.body.classList.contains('solo-app') || document.body.classList.contains('app-room');
      let headH = -1;
      const measure = () => {
        const r = head.getBoundingClientRect();
        const h = head.getClientRects().length && getComputedStyle(head).display !== 'none' ? Math.ceil(r.bottom) : 0;
        if (h === headH) return;
        headH = h;
        document.documentElement.style.setProperty('--headh', h + 'px');
        try { layout(); } catch (e) {}
      };
      const sync = () => {
        if (appbar && pane) {
          if (appOwn()) { if (appbar.parentNode !== pane) pane.insertBefore(appbar, pane.firstChild); }
          else put(appbar);
        }
        ver();
        measure();
      };
      // A small phone keeps the bar to one row: the meeting's Invite / Help /
      // Full screen go behind one "…" button that opens them as a short menu.
      const more = document.createElement('button');
      more.type = 'button'; more.id = 'topmore'; more.className = 'topmore';
      more.setAttribute('aria-haspopup', 'menu'); more.setAttribute('aria-expanded', 'false');
      more.setAttribute('aria-label', (0, /*()*/__C.uiText)('more', 'More')); more.title = (0, /*()*/__C.uiText)('more', 'More');
      more.textContent = '\u22ef';
      head.appendChild(more);
      const menu = document.createElement('div');
      menu.id = 'topmenu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
      document.body.appendChild(menu);
      const closeMenu = () => { if (menu.hidden) return; menu.hidden = true; more.setAttribute('aria-expanded', 'false'); };
      more.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!menu.hidden) { closeMenu(); return; }
        menu.textContent = '';
        for (const id of ['appinvite', 'apphelp', 'appfloat', 'appfull']) {
          const src = document.getElementById(id);
          if (!src || src.style.display === 'none' || src.hidden) continue;
          const b = document.createElement('button');
          b.type = 'button'; b.setAttribute('role', 'menuitem');
          b.textContent = (src.textContent || '').trim() || src.getAttribute('aria-label') || src.title || id;
          // the person's choice goes on to the control as theirs (src.__byPerson while its click runs)
          b.addEventListener('click', (ev) => { closeMenu(); src.__byPerson = ev.isTrusted === true; try { src.click(); } finally { src.__byPerson = false; } });
          menu.appendChild(b);
        }
        const r = more.getBoundingClientRect();
        menu.style.top = Math.round(r.bottom + 6) + 'px';
        menu.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
        menu.hidden = false; more.setAttribute('aria-expanded', 'true');
      });
      document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); }, true);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
      window.addEventListener('resize', closeMenu);
      window.__meetHeadH = () => (headH > 0 ? headH : 0);
      sync();
      if (!ver() && window.MutationObserver) {
        const mo = new MutationObserver(() => { if (ver()) { mo.disconnect(); measure(); } });
        try { mo.observe(document.body, { childList: true }); } catch (e) {}
      }
      if (window.MutationObserver) { try { new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch (e) {} }
      if (window.ResizeObserver) { try { new ResizeObserver(measure).observe(head); } catch (e) {} }
      window.addEventListener('resize', measure);
    })();
    yield 691;
    // The "new version" bar (js/gifos-update.js) floats over the top of the
    // page. While it shows, --updh holds its height, so the header, Fit and
    // the faces move down under it (--gtop in the CSS), and back up once it
    // is dismissed. The bar is added to <body> on the first check.
    (function () {
      let updWas = -1, updSeen = null;
      const sync = () => {
        const bar = document.getElementById('update-bar');
        if (bar && bar !== updSeen) {
          updSeen = bar;
          new MutationObserver(sync).observe(bar, { attributes: true, attributeFilter: ['style', 'class'] });
          if (window.ResizeObserver) new ResizeObserver(sync).observe(bar);
        }
        const h = bar && bar.style.display !== 'none' ? Math.ceil(bar.getBoundingClientRect().height) : 0;
        if (h === updWas) return;
        updWas = h;
        document.documentElement.style.setProperty('--updh', h + 'px');
        try { layout(); } catch (e) {}
      };
      const watchBody = new MutationObserver(() => { if (document.getElementById('update-bar')) { watchBody.disconnect(); sync(); } });
      watchBody.observe(document.body, { childList: true });
      sync();
    })();
    yield 703;
    document.addEventListener('pointerdown', () => (0, /*()*/__C.ensureAc)());
    yield 713;
    function tileNote(t, msg) {
      t.video.style.display = 'none';
      let n = t.tile.querySelector('.note');
      if (!n) { n = document.createElement('div'); n.className = 'note'; t.tile.appendChild(n); }
      n.textContent = msg;
    }
    yield 737;
    // Two ping-pong scratch canvases for the iOS fallback's progressive scaling.
    let blurA = document.createElement('canvas'), blurActx = blurA.getContext('2d');
    let blurB = document.createElement('canvas'), blurBctx = blurB.getContext('2d');
    yield 753;
    function paintAvatarCanvas(canvas, name, level) {
      const w = __M.AVATAR_W, h = __M.AVATAR_H, lvl = level | 0;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const mark = (0, /*()*/__C.nameInitial)(name);
      const drawSharp = (c) => {
        const x = c.getContext('2d');
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.filter = 'none';
        x.fillStyle = '#14141f';
        x.fillRect(0, 0, w, h);
        x.fillStyle = '#3a3a55';
        x.font = '800 168px system-ui, sans-serif';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(mark, w / 2, h / 2);
      };
      if (lvl <= 0) { drawSharp(canvas); return; }
      if (!__M.avatarSharp) __M.avatarSharp = document.createElement('canvas');
      __M.avatarSharp.width = w; __M.avatarSharp.height = h;
      drawSharp(__M.avatarSharp);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.filter = 'none';
      ctx.clearRect(0, 0, w, h);
      // One blur() leaves a readable rim on a high-contrast letter. Max
      // blur on a camera destroys that rim; the avatar is baked the same
      // way, ping-ponged so a pass never reads the canvas it is clearing.
      const frac = (0, /*()*/__M.blurSenderFrac)(lvl);
      const passes = lvl >= 2 ? 2 : 1;
      const bufs = [document.createElement('canvas'), document.createElement('canvas')];
      let src = __M.avatarSharp;
      for (let i = 0; i < passes; i++) {
        const dest = i === passes - 1 ? canvas : bufs[i];
        dest.width = w; dest.height = h;
        const dx = dest.getContext('2d');
        (0, /*()*/__M.blurDraw)(dx, src, 0, 0, w, h, frac * Math.max(w, h) / Math.max(1, w));
        src = dest;
      }
    }
    yield 755;
    // stream may be a function that makes it: called only when the tile needs a new one. Every MediaStream built on a track
    // lives as long as that track (the track keeps each stream that holds it), so a stream made per repaint and thrown away is kept.
    function showAvatarTrack(video, stream, track) {
      if (!video || !track) return;
      const cur = video.srcObject && video.srcObject.getVideoTracks()[0];
      if (cur !== track) {
        video.srcObject = typeof stream === 'function' ? stream() : stream;
        const pr = video.play();
        if (pr && pr.catch) pr.catch(() => {});
        (0, /*()*/__M.startLocalView)(video, track, 0);
      }
      if (track.requestFrame) {
        try { track.requestFrame(); } catch (e) {}
        requestAnimationFrame(() => { try { if (track.readyState === 'live') track.requestFrame(); } catch (e) {} });
      }
    }
    yield 841;
    function paintBcQuiet(bq) {
      const quiet = document.getElementById('bc-ended');
      if (!quiet) return;
      const on = !!bq.text;
      if (quiet.hidden === on) quiet.hidden = !on;
      document.body.classList.toggle('bc-quiet', on);
      document.body.classList.toggle('bc-reconn', on && !!bq.reconnecting);
      const qt = document.getElementById('bc-ended-txt');
      if (qt && on && qt.textContent !== bq.text) qt.textContent = bq.text;
      try { paintBcCalendar(on && bq.viewer && !!bq.sched && bq.sched.phase === 'future'); } catch (e) {}
      try { if (typeof paintStagePlate === 'function') paintStagePlate(); } catch (e) {}
    }
    // The "you left" screen on the page (leaveMeeting).
    function showLeftDialog() { const lm = document.getElementById('left-modal'); if (lm) lm.style.display = 'flex'; }
    yield 844;
    // At the password prompt the prompt is the whole story: a network line under it would send the person looking for the wrong fault.
    function atPwPrompt() { try { const m = document.getElementById('pw-modal'); return !!(__C.pwBlocked && m && m.style.display !== 'none' && m.dataset.mode === 'join'); } catch (e) { return false; } }
    yield 846;
    function paintStatusAlert(on) { statusEl.classList.toggle('alert', on); }
    // SUB.11: the People panel and the status count read one fold, so an open panel follows it too. (A far person's name
    // can arrive after the panel was painted: the row said "Guest" until something else repainted it.)
    function paintPeopleIfOpen() {
      const rEl = document.getElementById('roster');
      if (rEl && rEl.classList.contains('open')) {
        const all = (0, /*()*/__C.rosterRows)();
        const sig = all.map((x) => x.id + '\t' + x.name + '\t' + (x.muted ? 1 : 0) + (x.camOff ? 1 : 0) + (x.hand ? 1 : 0)).join('\n') + '\n' + (all.more || 0);
        if (sig !== __C.updateStatus.peopleSig) { __C.updateStatus.peopleSig = sig; (0, /*()*/__C.paintRosterSoon)(); }
      } else __C.updateStatus.peopleSig = null;
    }
    // The status line as updateStatus composed it (statusLine's fields).
    function paintStatusLine(s) {
      if (statusEl.dataset) {
        if (statusEl.dataset.kind !== s.kind) statusEl.dataset.kind = s.kind;
        if (statusEl.dataset.reach !== s.reach) statusEl.dataset.reach = s.reach;
        statusEl.dataset.why = s.why;
        statusEl.dataset.link = s.link;
        statusEl.dataset.back = s.back;
        if (statusEl.dataset.state !== s.state) statusEl.dataset.state = s.state;
        if (statusEl.dataset.flow !== s.flow) statusEl.dataset.flow = s.flow;
        if (statusEl.dataset.step !== s.step) statusEl.dataset.step = s.step;
        if (statusEl.dataset.progress !== s.progress) statusEl.dataset.progress = s.progress;
        if (statusEl.dataset.unreached !== s.unreached) statusEl.dataset.unreached = s.unreached;
      }
      if (s.alert) statusEl.classList.add('alert');
      if (statusEl.title !== s.title) statusEl.title = s.title;
      const countEl = document.getElementById('statuscount');
      const restEl = document.getElementById('statusrest');
      if (countEl && restEl) {
        if (countEl.textContent !== s.count) countEl.textContent = s.count;
        // An empty count is no button: Tab must not stop on nothing.
        if (countEl.hidden !== !s.count) countEl.hidden = !s.count;
        if (restEl.textContent !== s.rest) restEl.textContent = s.rest;
        // Fitting the line to its row is layout only: it must never stop the
        // status line from being written.
        try { if (s.fit) fitStatusRest(s.rest, s.fit[0], s.fit[1]); } catch (e) {}
      }
    }
    // A service's top chip: the room below it starts where it ends.
    function paintChipBottom() {
      const chip = document.querySelector('body.broadcast .topchip');
      if (chip) document.documentElement.style.setProperty('--chip-bottom', Math.ceil(chip.getBoundingClientRect().bottom) + 'px');
    }
    yield 851;
    // A wide window's header line never shows a sentence cut in half (the
    // same rule as the You-left line, 97854e1). The OS buttons take the
    // right of the row (UI-0010), so when the line is longer than the room:
    // the transcribing mark keeps only its icon, then the resolution drops,
    // and then the sentence leaves the row. The whole line stays the
    // header's title and a phone's status sheet.
    let statusRestFull = '', statusRestShort = '', statusRestTiny = '';
    // tinyText: the last form before the line leaves the row (a wait's bare "Step 5 of 10": the step is never cut off)
    function fitStatusRest(fullText, shortText, tinyText) {
      if (typeof fullText === 'string') { statusRestFull = fullText; statusRestShort = shortText || ''; statusRestTiny = tinyText || ''; }
      const restEl = document.getElementById('statusrest');
      if (!restEl) return;
      const b = document.body.classList;
      const over = () => restEl.scrollWidth > restEl.clientWidth + 1;
      const full = statusRestFull;
      if (restEl.textContent !== full) restEl.textContent = full;
      b.remove('tx-tight');
      b.remove('status-small');
      restEl.classList.remove('rest-off');
      if (!full || (typeof phoneLayout === 'function' && phoneLayout()) || !restEl.getClientRects().length) return;
      const tiny = statusRestTiny;
      const tryTiny = () => { if (!tiny) return false; restEl.textContent = tiny; if (!over()) return true; restEl.textContent = full; return false; };
      if (b.contains('hq-tight')) { if (tryTiny()) return; restEl.classList.add('rest-off'); return; }
      if (!over()) return;
      b.add('tx-tight');
      if (!over()) return;
      const short = statusRestShort;
      if (short) {
        restEl.textContent = short;
        if (!over()) return;
        restEl.textContent = full;
      }
      if (tryTiny()) return;
      restEl.classList.add('rest-off');
      // The count is never cut off: if it and the tap still overflow the
      // line, the line steps down to 16px.
      const stEl = document.getElementById('status');
      const cntEl = document.getElementById('statuscount');
      const cut = () => (stEl && stEl.scrollWidth > stEl.clientWidth + 1) || (cntEl && cntEl.scrollWidth > cntEl.clientWidth + 1);
      if (cut()) b.add('status-small');
    }
    let fitRestFrame = 0;
    window.addEventListener('resize', () => {
      if (!fitRestFrame) fitRestFrame = requestAnimationFrame(() => { fitRestFrame = 0; try { fitStatusRest(); } catch (e) {} });
    });
    try {
      const hdrMq = window.matchMedia('(max-width: 700px), (max-height: 500px)');
      if (hdrMq.addEventListener) hdrMq.addEventListener('change', () => { try { (0, /*()*/__C.updateStatus)(); } catch (e) {} });
    } catch (e) {}
    yield 857;
    // The lamp itself is painted by paintOnAir (confirmed design, above).
    // An open roster repaints with it.
    function paintOnAirSide() {
      try { if (document.getElementById('roster').classList.contains('open')) paintRoster(); } catch (e) {}
    }
    yield 872;
    function releaseHeld(p) {
      if (!p) return;
      if (p.held) (0, /*()*/__C.paintRosterSoon)();
      p.held = false;
      if (p.tile && !p.headless && !p.tile.parentNode && typeof grid !== 'undefined' && grid) grid.appendChild(p.tile);
      if (p.video) { const pr = p.video.play(); if (pr && pr.catch) pr.catch(function () {}); }
    }
    function paintWaitingSelf() {
      const el = document.getElementById('waitself');
      if (!el) return;
      const on = (0, /*()*/__C.iAmWaiting)();
      el.classList.toggle('on', on);
      const h = el.querySelector('h3');
      const p = el.querySelector('p');
      if (h) h.textContent = (0, /*()*/__C.uiText)('waitSelf', 'The host will let you in');
      if (p) p.textContent = (0, /*()*/__C.uiText)('waitSelfNote', 'You can see this meeting when someone admits you.');
    }
    yield 880;
    let renameEditId = null;
    yield 885;
    function paintRoster() {
      const el = document.getElementById('roster');
      if (!el) return;
      const find = document.getElementById('roster-find');
      const q = (find && find.value || '').trim().toLowerCase();
      const all = (0, /*()*/__C.rosterRows)();
      const rows = all.filter((r) => !q || String(r.name).toLowerCase().indexOf(q) >= 0);
      const title = document.getElementById('roster-title');
      const allN = all.length + (all.more || 0);   // the named rows and the far people the fold only counts
      if (title) title.textContent = allN + ' ' + (allN === 1 ? (0, /*()*/__C.uiText)('rosterPersonOne', 'person') : (0, /*()*/__C.uiText)('rosterPeople', 'people'));
      const close = document.getElementById('roster-close');
      if (close) close.textContent = (0, /*()*/__C.uiText)('rosterClose', 'Close');
      if (find) {
        const ph = (0, /*()*/__C.uiText)('rosterFind', 'Find a name');
        if (find.getAttribute('placeholder') !== ph) find.setAttribute('placeholder', ph);
      }
      const host = document.getElementById('roster-host');
      if (host) {
        host.hidden = !(0, /*()*/__C.mayHost)();
        host.textContent = '';
        if ((0, /*()*/__C.mayHost)()) {
          const lab = document.createElement('span');
          lab.textContent = (0, /*()*/__C.uiText)('waitRoom', 'Waiting room');
          const tog = document.createElement('button');
          tog.type = 'button';
          tog.id = 'roster-wait-toggle';
          const on = !!(0, /*()*/__C.waitingSince)();
          tog.className = on ? 'on' : '';
          tog.textContent = on ? (0, /*()*/__C.uiText)('waitOn', 'On') : (0, /*()*/__C.uiText)('waitOff', 'Off');
          tog.setAttribute('aria-pressed', on ? 'true' : 'false');
          tog.onclick = () => (0, /*()*/__C.setWaitingRoom)(!(0, /*()*/__C.waitingSince)());
          host.appendChild(lab);
          host.appendChild(tog);
        }
      }
      const waitlist = document.getElementById('roster-waitlist');
      if (waitlist) {
        waitlist.textContent = '';
        if ((0, /*()*/__C.mayHost)() && (0, /*()*/__C.waitingSince)()) {
          const head = document.createElement('div');
          head.className = 'roster-waithead';
          head.id = 'roster-wait-head';
          const waiting = (0, /*()*/__C.waitingRows)().filter((r) => !q || String(r.name).toLowerCase().indexOf(q) >= 0);
          head.textContent = (0, /*()*/__C.uiText)('waitHeading', 'Waiting');
          waitlist.appendChild(head);
          if (!waiting.length) {
            const empty = document.createElement('div');
            empty.className = 'roster-empty';
            empty.id = 'roster-wait-empty';
            empty.textContent = (0, /*()*/__C.uiText)('nobodyWaiting', 'No one is waiting');
            waitlist.appendChild(empty);
          }
          for (const w of waiting) {
            const row = document.createElement('div');
            row.className = 'roster-row';
            row.dataset.wait = w.id;
            const nm = document.createElement('span');
            nm.className = 'nm';
            nm.textContent = w.name;
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'admitbtn';
            b.textContent = (0, /*()*/__C.uiText)('admit', 'Admit');
            b.setAttribute('aria-label', (0, /*()*/__C.uiText)('admit', 'Admit') + ' ' + w.name);
            b.onclick = () => __C.act.admitGuest(w.id);
            row.appendChild(nm);
            row.appendChild(b);
            waitlist.appendChild(row);
          }
        }
      }
      const list = document.getElementById('roster-list');
      if (!list) return;
      list.textContent = '';
      for (const r of rows) {
        const row = document.createElement('div');
        row.className = 'roster-row';
        const nm = document.createElement('span');
        nm.className = 'nm';
        nm.textContent = r.name + (r.me ? ' (' + (0, /*()*/__C.uiText)('you', 'you') + ')' : '');
        row.appendChild(nm);
        const flags = [];
        if (r.stage) flags.push((0, /*()*/__C.uiText)('onAir', 'On air'));
        if (r.hand) flags.push((0, /*()*/__C.uiText)('hand', 'Hand'));
        if (r.roomMute) flags.push((0, /*()*/__C.uiText)('forEveryone', 'For all'));
        else if (r.muted) flags.push((0, /*()*/__C.uiText)('muted', 'Muted'));
        if (r.camOff) flags.push((0, /*()*/__C.uiText)('camOffChip', 'Camera off'));
        if (!r.me && !(0, /*()*/__C.hasAdminRoom)() && (0, /*()*/__C.hostRename)(r.id) === __C.model.consts.RENAME_RESET()) { const rn = (__C.model.door.modTable()[r.id] || {}).rename; flags.push((0, /*()*/__C.uiText)('nameResetBy', 'Name reset by {name}').replace('{name}', String((rn && rn.by) || 'someone').slice(0, 40))); }   // attributed, like every open-room order
        if (flags.length) {
          const f = document.createElement('span');
          f.className = 'flags';
          f.textContent = flags.join(' · ');
          row.appendChild(f);
        }
        // As on the tile: no Mute for someone already muted by their own hand.
        const mayMute = !r.me && !r.fold && !(r.muted && !r.roomMute) && !(typeof __C.hasAdminRoom === 'function' && (0, /*()*/__C.hasAdminRoom)() && !__C.amAdmin);
        if (mayMute) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'mutebtn' + (r.roomMute ? ' on' : '');
          const words = (0, /*()*/__C.hostWords)('mute', r.roomMute);
          b.textContent = words;
          b.setAttribute('aria-label', words + ': ' + r.name);
          b.onclick = () => {
            let on = false;
            try { const cur = (0, /*()*/__C.modOf)(r.id).mute; on = !(cur && cur.on); } catch (e) { on = true; }
            (0, /*()*/__C.setMod)(r.id, 'mute', on);
            paintRoster();
          };
          row.appendChild(b);
        }
        if ((0, /*()*/__C.mayHost)() && !r.me && !r.fold) {
          const acts = document.createElement('div');
          acts.className = 'acts';
          if (!(0, /*()*/__C.hasAdminRoom)()) {
            // An open-floor room: a name can only be reset to the neutral default, and nobody is spotlit.
            if ((0, /*()*/__C.hostRename)(r.id) !== __C.model.consts.RENAME_RESET()) {
              const reset = document.createElement('button');
              reset.type = 'button';
              reset.className = 'renamebtn';
              reset.textContent = (0, /*()*/__C.uiText)('resetName', 'Reset name');
              reset.title = (0, /*()*/__C.uiText)('resetNameTip', 'Show this person as Guest for everyone here. Everyone sees that you did it.');   // the roster says who (nameResetBy)
              reset.setAttribute('aria-label', (0, /*()*/__C.uiText)('resetName', 'Reset name') + ' ' + r.name);
              reset.onclick = () => { __C.act.renameGuest(r.id, __C.model.consts.RENAME_RESET()); };
              acts.appendChild(reset);
            }
          } else if (renameEditId === r.id) {
            const input = document.createElement('input');
            input.className = 'renamebox';
            input.value = r.name;
            input.setAttribute('aria-label', (0, /*()*/__C.uiText)('rename', 'Rename') + ' ' + r.name);
            const save = document.createElement('button');
            save.type = 'button';
            save.className = 'renamesave';
            save.textContent = (0, /*()*/__C.uiText)('saveName', 'Save');
            const commit = () => { renameEditId = null; __C.act.renameGuest(r.id, input.value); };
            save.onclick = commit;
            input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); commit(); } });
            acts.appendChild(input);
            acts.appendChild(save);
          } else {
            const ren = document.createElement('button');
            ren.type = 'button';
            ren.className = 'renamebtn';
            ren.textContent = (0, /*()*/__C.uiText)('rename', 'Rename');
            ren.setAttribute('aria-label', (0, /*()*/__C.uiText)('rename', 'Rename') + ' ' + r.name);
            ren.onclick = () => { renameEditId = r.id; paintRoster(); const box = document.querySelector('.renamebox'); if (box) { try { box.focus(); box.select(); } catch (e) {} } };
            const spot = document.createElement('button');
            spot.type = 'button';
            spot.className = 'spotbtn' + ((0, /*()*/__C.hostSpot)(r.id) ? ' on' : '');
            spot.textContent = (0, /*()*/__C.hostSpot)(r.id) ? (0, /*()*/__C.uiText)('inView', 'In view') : (0, /*()*/__C.uiText)('spotlight', 'Spotlight');
            spot.setAttribute('aria-label', ((0, /*()*/__C.hostSpot)(r.id) ? (0, /*()*/__C.uiText)('inView', 'In view') : (0, /*()*/__C.uiText)('spotlight', 'Spotlight')) + ' ' + r.name);
            spot.onclick = () => __C.act.spotlightGuest(r.id, !(0, /*()*/__C.hostSpot)(r.id));
            acts.appendChild(ren);
            acts.appendChild(spot);
          }
          row.appendChild(acts);
        }
        list.appendChild(row);
      }
      if (all.more && !q) {   // SUB.11: far people the fold counts and does not name (a big room, or names still on their way)
        const row = document.createElement('div');
        row.className = 'roster-row roster-more';
        row.id = 'roster-more';
        const nm = document.createElement('span');
        nm.className = 'nm';
        nm.textContent = (0, /*()*/__C.uiText)('rosterAndMore', 'and {n} more').replace('{n}', String(all.more));
        row.appendChild(nm);
        list.appendChild(row);
      }
    }
    function toggleRoster(force) {
      const el = document.getElementById('roster');
      if (!el) return;
      const open = typeof force === 'boolean' ? force : !el.classList.contains('open');
      el.classList.toggle('open', open);
      const btn = document.getElementById('statuscount');
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) paintRoster();
    }
    const statusCountBtn = document.getElementById('statuscount');
    if (statusCountBtn) statusCountBtn.onclick = () => { if (!phoneLayout()) toggleRoster(); };
    const rosterClose = document.getElementById('roster-close');
    if (rosterClose) rosterClose.onclick = () => toggleRoster(false);
    const rosterFind = document.getElementById('roster-find');
    if (rosterFind) rosterFind.addEventListener('input', () => paintRoster());
    yield 1000;
    function refreshAvatarSurfaces() {
      try { paintBroadcastIdent(); } catch (e) {}
      try { if (chatPanelOpen()) renderChat(); } catch (e) {}
      try { if (transcriptShown()) renderTranscript(); } catch (e) {}
      try { if (whoModal && whoModal.style.display === 'flex') showWhoModal(); } catch (e) {}
    }
    yield 1002;
    const STAGE_HEAR_MS = GifOS.timings.STAGE_HEAR_MS;
    let platePaintT = 0;
    function paintStagePlate() {
      try { paintStageBlurWhy(); } catch (e) {}   // a strip just bound wears its blur at once (STAGEBLUR)
      try { GifOS.viewKit.stageNames(__C, __M); } catch (e) {}   // the stagers' names over the Stage picture
      const el = document.getElementById('bc-stage');
      const line = document.getElementById('bc-stage-line');
      if (!el || !line) return;
      if (!__C.model.room.BROADCAST()) { el.hidden = true; return; }
      const ident = document.getElementById('bc-ident');
      const picture = !!document.querySelector('#stagefeed .rowtile') || !!(ident && ident.classList.contains('on'));
      el.hidden = picture;
      if (picture) return;
      let on = false;
      try { on = typeof __C.model.me.myStatus() !== 'undefined' && !!__C.model.me.myStatus().stg; } catch (e) { on = false; }
      if (on) { line.textContent = 'You are on stage. Your camera is off.'; return; }
      // An ended service has one sentence, the plate. The overlay stays off.
      if (typeof __C.bcEndedInRoom === 'function' && (0, /*()*/__C.bcEndedInRoom)()) {
        line.textContent = 'The stage is clear.';
        return;
      }
      // "The stage is clear." only once it is known. Someone else on stage
      // with no picture yet: their feed is on its way. Nobody heard from yet,
      // before and just after joining: still joining (a silent room reads clear
      // STAGE_HEAR_MS after joinRoom, so the line never hangs on joining).
      const nameOf = (id) => ((__C.model.roster.peers().get(id) || {}).name || __C.model.roster.rosterNames()[id] || '').trim();
      // A host whose live status says on stage counts before the roster
      // lists them (it lags their first status by a beat or more).
      const others = (0, /*()*/__C.stageIds)().filter((id) => id !== __C.model.me.myId())
        .concat(__C.model.door.admins().filter((id) => id !== __C.model.me.myId() && (0, /*()*/__C.stageClaimOf)(id)));
      if (others.length) {
        const nm = others.map(nameOf).find((x) => x);
        line.textContent = nm ? 'Connecting to ' + nm + '…' : 'Connecting to the stage…';
        return;
      }
      // Heard means the host is known (a hosted room's first status from
      // them can land before their host proof, when they are not yet on the
      // stage), or in an open room anyone's status. The host knows its stage.
      const meHost = (typeof __C.bcHostStored === 'function' && (0, /*()*/__C.bcHostStored)()) || document.body.classList.contains('amadmin');
      const heard = meHost || ((0, /*()*/__C.hasAdminRoom)() ? __C.model.door.admins().some((id) => id !== __C.model.me.myId()) : Array.from(__C.model.roster.statusOf().keys()).some((id) => id !== __C.model.me.myId()));
      const wait = __C.model.room.roomJoinedAt() ? __C.model.room.roomJoinedAt() + STAGE_HEAR_MS - Date.now() : 1;
      if (!heard && wait > 0) {
        line.textContent = 'Joining the broadcast…';
        clearTimeout(platePaintT);
        if (__C.model.room.roomJoinedAt()) platePaintT = setTimeout(paintStagePlate, wait + 50);
        return;
      }
      line.textContent = 'The stage is clear.';
    }
    function paintBroadcastIdent() {
      const el = document.getElementById('bc-ident');
      if (!el) return;
      if (!__C.model.room.BROADCAST()) { el.classList.remove('on'); return; }
      const stage = (typeof __C.stageIds === 'function') ? (0, /*()*/__C.stageIds)() : [];
      let pid = stage.length ? stage[0] : null;
      if (!pid && typeof __C.amAdmin !== 'undefined' && __C.amAdmin) pid = __C.model.me.myId();
      if (!pid) { const it = __C.model.roster.peers().values().next(); pid = it && it.value ? it.value.id : null; }
      if (!pid) { el.classList.remove('on'); return; }
      const isMe = pid === __C.model.me.myId();
      const st = isMe ? __C.model.me.myStatus() : (__C.model.roster.statusOf().get(pid) || {});
      const camOn = isMe ? __C.model.me.myStatus().camOff === false : st.camOff === false;
      // A screen share is a picture too, camera or not, and so is a rebroadcast (the clip is the picture).
      if (camOn || st.scr || st.rb) { el.classList.remove('on'); if (typeof paintStagePlate === 'function') paintStagePlate(); return; }
      let url = '', hash = '', name = '';
      if (isMe) {
        const a = (GifOS.store.identity() || {}).avatar;
        if (a && a.url) { url = a.url; hash = a.hash || ''; }
        name = (0, /*()*/__C.myName)();
      } else {
        const prefer = __C.model.roster.peers().get(pid);
        const pick = (prefer && prefer.avatarUrl) ? prefer : Array.from(__C.model.roster.peers().values()).find((q) => q.avatarUrl);
        if (pick && pick.avatarUrl) { url = pick.avatarUrl; hash = pick.avatarHash || ''; name = pick.name || __C.model.roster.rosterNames()[pick.id] || ''; }
        else name = (prefer && prefer.name) || __C.model.roster.rosterNames()[pid] || '';
      }
      const img = document.getElementById('bc-ident-img');
      const nm = document.getElementById('bc-ident-name');
      if (nm) nm.textContent = name || '';
      if (img) {
        if (url) {
          if (img.getAttribute('data-hash') !== hash) { img.src = url; img.setAttribute('data-hash', hash); }
        } else img.removeAttribute('src');
      }
      const init = document.getElementById('bc-ident-init');
      if (init) init.textContent = (name.trim()[0] || '').toUpperCase();
      // No picture is still someone: on a stage frame that is black, the
      // initial and the name stand in for it.
      el.classList.toggle('pic', !!url);
      el.classList.toggle('me', isMe);
      el.classList.toggle('on', !!(url || (name && document.querySelector('#stagefeed .rowtile'))) && !(isMe && typeof bcLinkOnStage === 'function' && bcLinkOnStage()));
      if (typeof paintStagePlate === 'function') paintStagePlate();
    }
    yield 1080;
    function turnPaint() {
      const facts = __C.model.room.turnLinks() ? Array.from(__C.model.room.turnFacts().values()) : [];
      // every person tile, a pair's or a carried one (a person whose media a friend brings has no pair here)
      for (const tile of document.querySelectorAll('.tile[data-peer]')) {
        const pid = tile.dataset.peer; if (!pid || pid === __C.model.me.myId()) continue;
        const p = { id: pid, tile };
        const show = (0, /*()*/__C.turnHeld)(p.id, facts);
        // TURN.13: the far end paused its video because the server throttles (vouched: nothing to subscribe to)
        const busy = !show && !!__C.model.room.turnLinks() && __C.model.room.turnLinks().farBusy(p.id);
        let bel = p.tile.querySelector(':scope > .tpause-busy');
        if (busy && !bel) {
          bel = document.createElement('div'); bel.className = 'tpause tpause-busy'; bel.setAttribute('role', 'note');
          const t = document.createElement('span'); t.textContent = (0, /*()*/__C.uiText)('turnBusy', 'Video is paused: the connection is busy. It comes back by itself.'); bel.appendChild(t);
          p.tile.appendChild(bel);
        } else if (!busy && bel) bel.remove();
        // the note says WHY video is held, naming only a network the page knows (meet-turn netWhy) and the person by name
        let say;
        if (show) { const nm = ((__C.model.roster.peers().get(pid) || {}).name || __C.model.roster.rosterNames()[pid] || '').trim(); const tl = __C.model.room.turnLinks(); const why = tl && tl.netWhy ? tl.netWhy(pid) : ''; say = (0, /*()*/__C.statusWords)(why === 'mine' ? 'videoPausedRelayMine' : why === 'far' && nm ? 'videoPausedRelayFar' : 'videoPausedRelay', { name: nm }); }
        pauseNote(p.tile, show, say);
        if ((p.tile.dataset.tpHeld === '1') !== show) { p.tile.dataset.tpHeld = show ? '1' : ''; try { (0, /*()*/__C.updateTile)(pid); } catch (e) {} }   // the face card follows the hold (syncAvatarFeed)
      }
      // SUB.4 + TURN.11 for every seat: the Stadium that shows a far room over a pipe with no video says so, with the same
      // note and Subscribe as a tile (Nathan 11-14: the note goes on the strip, not only on the pipe holders' tiles)
      const sd = document.querySelector('#stadium [data-row="sd"]');
      if (sd) { let far = 0; try { far = __C.model.net.meshNode() && typeof __C.model.net.meshNode().meetingFar === 'function' ? __C.model.net.meshNode().meetingFar() : 0; } catch (e) {} const sp = !!__C.model.room.turnLinks() && GifOS.meetTurn.stripPaused(facts, far); pauseNote(sd, sp);
        // the gallery shows the Stadium through its box (#stadwhole), never the parked strip: the note goes there too
        const whole = document.getElementById('stadwhole'); if (whole) pauseNote(whole, sp); }
      try { (0, /*()*/__C.ctTurnPaint)(facts); } catch (e) {}
    }
    yield 1083;
    // THE PAUSED NOTE on a host: a person's tile (pausedBy), or the Stadium strip that stands for a far room whose pipe
    // carries no video (stripPaused): the named state's sentence and one tap to subscribe or buy the pass.
    // say: the sentence, when the host is not a person (a shared screen's pane, S6); else the named state's.
    function pauseNote(host, show, say) {
      let el = host.querySelector(':scope > .tpause:not(.tpause-busy)');
      if (show && el && say && el.dataset.say !== say) { el.remove(); el = null; }   // a new sharer name: the note is built again with its words
      if (show && !el) {
        // VIDEO IS PAUSED: the named state's sentence (meet-status videoPausedRelay*: why, outside GifOS's control) over the
        // dark tile, and one small link to subscribe ($2 monthly, PayPal). A subscription's vouch turns this link's video on where it is:
        // the next paint finds the link carrying video and takes the note away.
        el = document.createElement('div'); el.className = 'tpause'; el.setAttribute('role', 'note');
        const t = document.createElement('span'); t.className = 'tpause-say';
        const said = say || (0, /*()*/__C.statusWords)('videoPausedRelay');
        if (say) el.dataset.say = say;
        t.textContent = said; el.appendChild(t);
        // Subscribe is offered on every paused tile.
        if (window.GifOS && GifOS.meetSubs && GifOS.sub) {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'tpause-sub';
          b.textContent = (0, /*()*/__C.uiText)('turnSubscribeLink', 'Subscribe');
          b.addEventListener('click', async (e) => {
            e.stopPropagation(); b.disabled = true;
            try {
              const r = await GifOS.meetSubs.subscribe('room20', 'monthly', (w) => { t.textContent = w; });
              if (!(r && r.licenseJson)) { t.textContent = said; b.disabled = false; }
            } catch (x) { t.textContent = said; b.disabled = false; }
          });
          el.appendChild(b);
          // or the four-hour pass: $1 once through PayPal, Unlimited for the next 4 hours (never a subscription)
          const b4 = document.createElement('button'); b4.type = 'button'; b4.className = 'tpause-pass';
          b4.textContent = (0, /*()*/__C.uiText)('turnPass4hLink', 'or $1 for 4 hours');
          b4.addEventListener('click', async (e) => {
            e.stopPropagation(); b4.disabled = true; b.disabled = true;
            try {
              const r = await GifOS.meetSubs.buyPass((w) => { t.textContent = w; });
              if (!(r && r.passJson)) { t.textContent = said; b4.disabled = false; b.disabled = false; }
            } catch (x) { t.textContent = said; b4.disabled = false; b.disabled = false; }
          });
          el.appendChild(b4);
        }
        host.appendChild(el);
        // The sentence takes the middle. Drop a blur reason that was already
        // painted there; paintBlurWhy will not put it back while this note shows.
        const why = host.querySelector(':scope > .blurwhy');
        if (why && /(^|\s)blurwhy(\s|$)/.test(String(why.className || ''))) why.remove();
      } else if (!show && el) el.remove();
    }
    yield 1102;
    // A tile back on the grid (it is not there now).
    function paintTileOnGrid(tile) { if (!tile.parentNode) grid.appendChild(tile); }
    yield 1105;
    // A full-screen view that is open follows a new picture's size (rebuildPc).
    function wireFsResize(p) { if (p.video && fsview.classList.contains('on')) p.video.addEventListener('resize', () => fsRefreshIfOpen(), { once: true }); }
    yield 1233;
    // The joining veil, drawn from the meeting's model: null takes it down; else { w, vw, refusal } (the progress beat,
    // its words, the relay's refusal).
    let joinVeilEl = null;
    function paintJoinVeil(m) {
      if (!m) { if (joinVeilEl) { joinVeilEl.remove(); joinVeilEl = null; } return; }
      if (!joinVeilEl) {
        joinVeilEl = document.createElement('div');
        joinVeilEl.id = 'joinveil';
        joinVeilEl.innerHTML = '<div class="jv-box" role="status" aria-live="polite"><div class="jv-spin"></div><p class="pg-step" id="jv-s"></p><h3 id="jv-t"></h3><p id="jv-p"></p></div>';
        document.body.appendChild(joinVeilEl);
      }
      const w = m.w, vw = m.vw, refusal = m.refusal;
      const veilSay = (step, title, body) => {
        const hs = joinVeilEl.querySelector('#jv-s');
        const ht = joinVeilEl.querySelector('#jv-t');
        const hp = joinVeilEl.querySelector('#jv-p');
        if (hs && hs.textContent !== step) hs.textContent = step;
        if (ht && ht.textContent !== title) ht.textContent = title;
        if (hp && hp.textContent !== body) hp.textContent = body;
      };
      if (w) {
        joinVeilEl.dataset.flow = w.flow; joinVeilEl.dataset.step = w.step; joinVeilEl.dataset.x = String(w.x); joinVeilEl.dataset.y = String(w.y);
      }
      joinVeilEl.dataset.refused = refusal ? String(refusal.code) : '';
      const spin = joinVeilEl.querySelector('.jv-spin');
      if (spin && spin.hidden !== !vw.spin) spin.hidden = !vw.spin;
      veilSay(vw.step, vw.title, vw.body);
    }
    yield 1236;
    // The step line in the places a wait shows that are not the status line:
    // the password prompt and the waiting room screen.
    function paintProgressSteps(w) {
      const put = (id, show) => {
        const el = document.getElementById(id);
        if (!el) return;
        const t = show && w ? w.stepOnly + (w.secs ? ' · ' + w.secs : '') : '';
        if (el.textContent !== t) el.textContent = t;
        if (el.hidden !== !t) el.hidden = !t;
      };
      put('pw-step', !!(w && w.step === 'password'));
      put('waitdoor-step', !!(w && w.step === 'admit'));
    }

    // ---- THE EMPTY APP ROOM (#appwait) ---------------------------------------
    // A guest opening an app invite gets the app from WHOEVER IS IN THE ROOM
    // holding it — there is no server copy. So an invite opened after the
    // friend closed the app lands in an empty room: seated fine, no ad ever
    // comes, and until this panel existed the page just sat BLANK, explaining
    // nothing (reported from a day-old invite link, 2026-08-25). The panel is
    // the app-room counterpart of the join veil above and yields to it (z 30
    // vs 35): the veil answers "am I in?", this answers "I'm in — where's the
    // app?". Two honest escalations, decided each tick so a returning host
    // dissolves it the moment their ad lands (mountClientApp → has-app):
    //   < 12s   spinner — the ad normally lands in the first status beats
    //   ≥ 12s   no ad + nobody else here  → the invite is dormant, say why
    //           no ad + others waiting too → the HOST is the missing piece
    // It never shows for a founder (their own runApp mounts has-app) and
    // never over the call layer (call-on: the room is visibly alive).
    let appWaitEl = null, appWaitSince = 0;
    setInterval(() => {
      const kill = () => { appWaitSince = 0; if (appWaitEl) { appWaitEl.remove(); appWaitEl = null; } };
      if (!__C.ROOM.appPinned || __C.ROOM.solo || !__C.model.room.sessId()) return kill();
      if (document.body.classList.contains('has-app') || __C.appKey || __C.model.me.myStatus().app
        || document.body.classList.contains('call-on')) return kill();
      const now = Date.now();
      if (!appWaitSince) { appWaitSince = now; return; }
      if (now - appWaitSince < GifOS.timings.APP_WAIT_SHOW_MS) return; // instant mounts never see it
      if (!appWaitEl) {
        appWaitEl = document.createElement('div');
        appWaitEl.id = 'appwait';
        appWaitEl.innerHTML = '<div class="jv-box"><div class="jv-spin"></div><h3 id="aw-t">Looking for the app…</h3><p id="aw-p">You’re in the room. The app comes over from whoever is sharing it.</p></div>';
        document.body.appendChild(appWaitEl);
      }
      if (now - appWaitSince < GifOS.timings.APP_WAIT_SAY_MS) return;
      // Long enough: the ad rides the first status beats, and 12s is past
      // every join+gossip horizon. Nothing is coming — say which piece is
      // missing. (No spinner from here on: nothing is spinning.)
      const spin = appWaitEl.querySelector('.jv-spin');
      if (spin) spin.remove();
      let others = 0;
      for (const [pid] of __C.model.roster.statusOf()) if (String(pid) !== String(__C.model.me.myId())) others++;
      if (appWaitEl.dataset.said === String(others)) return; // same story — don't rewrite it every tick
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
    }, 1000);
    yield 1302;   // the hold's deadline; 0 = no hold armed
    const PW_GRANT_HOLD_MS = GifOS.timings.PW_GRANT_HOLD_MS;
    yield 1383;
    function capPaint() {
      const b = document.getElementById('capbtn'), n = document.getElementById('capnote');
      const show = !__C.model.me.av() && !(0, /*()*/__C.capOn)() && (0, /*()*/__C.subsOn)() && GifOS.meetSubs.canCapture((0, /*()*/__C.subsMeetId)());
      if (b) { b.style.display = show ? '' : 'none'; b.disabled = __C.model.chat.capBusy(); }
      if (n) { n.style.display = (0, /*()*/__C.capOn)() ? '' : 'none'; n.textContent = __C.amAdmin ? (0, /*()*/__C.uiText)('capYou', 'You have taken charge of this meeting') : (0, /*()*/__C.uiText)('capNote', 'Someone has taken charge of this meeting'); }
      try { applyAdminUi(); } catch (e) {}
    }
    { const b = document.getElementById('capbtn'); if (b) b.onclick = () => (0, /*()*/__C.capTry)(); }
    yield 1412;
    function applyAdminUi() {
      const hasAdmin = (0, /*()*/__C.hasAdminRoom)();
      document.body.classList.toggle('admroom', hasAdmin);
      document.body.classList.toggle('notadmin', hasAdmin && !__C.amAdmin);
      __C.act.surface({ adminFace: __C.amAdmin });
      document.body.classList.toggle('amadmin', __C.amAdmin);
      const ab = document.getElementById('admbtn');
      // The Admin button only exists INSIDE an admin room now — it's sign-in +
      // ban management. Creating an admin room lives in Invite. A plain room has
      // no admin and never can, so there's nothing for this button to do there.
      ab.style.display = __C.model.me.av() ? '' : 'none';   // sign-in to a room with a verifier (a captor is admin by its capture)
      ab.textContent = __C.amAdmin ? (0, /*()*/__C.uiText)('admBtn', 'Host') : (0, /*()*/__C.uiText)('admSignIn', 'Host password');
      ab.title = __C.amAdmin ? (0, /*()*/__C.uiText)('admTipOn', 'Host controls: room password, chat and waiting room')
        : (0, /*()*/__C.uiText)('admTipOff', 'This room has a host — enter the host password to get the host controls');
      const pwb = document.getElementById('pwbtn');
      const pwLocked = hasAdmin && !__C.amAdmin;   // a captured open room too: its admin's
      pwb.disabled = pwLocked;
      pwb.title = pwLocked
        ? (0, /*()*/__C.uiText)('pwTipAdmin', 'This room\'s password is managed by its host (or by whoever took charge of it)')
        : (0, /*()*/__C.uiText)('pwTip', 'Lock this room with a password');
      // Vote-off only exists where there is no admin to ban bad actors.
      document.body.classList.toggle('canvote', !hasAdmin);
      if (typeof updateMuteAllBtn === 'function') updateMuteAllBtn();
      if (typeof updateBlurAllBtn === 'function') updateBlurAllBtn();
      if (typeof updateCamAllBtn === 'function') updateCamAllBtn();
      paintChatGate(); renderChat(); // signing in as admin grows the chat toggle + per-line deletes
      try { waitPaint(); } catch (e) {}
      try { paintBroadcastRole(); } catch (e) {}
      (0, /*()*/__M.refreshOutbound)(); // admin presence changes what clears
      if (typeof paintBroadcastChrome === 'function') paintBroadcastChrome();
    }
    yield 1459;
    function showLoadRefusal(msg) { const d = document.createElement('div'); d.id = 'load-gate-msg'; d.setAttribute('role', 'alert'); d.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483647;padding:14px 16px;background:#b00020;color:#fff;font:16px system-ui,sans-serif;text-align:center'; d.textContent = msg; document.body.appendChild(d); }
    yield 1463;   // var: the join veil (above) reads it before this line runs
    function showRelayBusy() {
      (0, /*()*/__C.setStatus)('\u23f3 ' + __C.model.net.net().BUSY_TEXT, GifOS.timings.RELAY_BUSY_SHOW_MS);
      try { const el = document.getElementById('status'); if (el && el.dataset) el.dataset.kind = 'busy'; } catch (e) {}
    }
    yield 1465;
    // The steady socket kicks itself on visibility/online; only the camera
    // still needs a manual revive when the tab comes back.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) (0, /*()*/__M.reviveCamera)(); });

    // The sweeper heals what it can and buries what's really gone:
    //  - absent + link down past grace → tile removed
    //  - present + link down → the initiator side re-offers with an ICE restart
    // Why the frozen-tile check is NOT watching this pair ('' = watching):
    // only a visible row-mate tile that has painted, whose camera is meant
    // to be on and reaching me directly, can be judged frozen.
    function frozenTileSkip(pid, p) {
      const fst = __C.model.roster.statusOf().get(pid);
      const vtr = p.stream && p.stream.getVideoTracks()[0];
      if (!p.connected || p.relayed) return 'link';
      if (document.hidden) return 'hidden';
      if (typeof __C.botParks === 'function' && __C.model.me.visParkSent().get(pid) === true) return 'hidden';   // parked for the bot view: no frames is the ask
      if (document.pictureInPictureElement && document.pictureInPictureElement === p.video) return 'pip'; // a floated tile paints in the float, not in the room: no frame count to judge here
      if (!vtr || vtr.readyState !== 'live') return 'track';
      if (!p.video || !(0, /*()*/__M.tileHolds)(p.video, p.stream) || p.video.paused || p.video.readyState === 0) return 'element';
      if (!p.dc || p.dc.readyState !== 'open') return 'dc';
      if (!(0, /*()*/__C.camPeer)(pid) || (0, /*()*/__C.mediaOk)(pid) === false) return 'mate';
      // Only a row-mate my seat names can be judged: rebuilding any other pair closes a link the seat may be standing on.
      if ((0, /*()*/__C.meshCoord)() && (0, /*()*/__C.meshSeat)() && !Array.from((0, /*()*/__C.meshSeat)().occ.values()).includes(pid)) return 'mate';
      if (!fst || fst.camOff || fst.scr || (0, /*()*/__C.forcedCamOff)(pid)) return 'cam';
      if ((0, /*()*/__C.peerAway)(pid)) return 'away';
      if ((0, /*()*/__C.personOnStage)(pid)) return 'staged';
      return '';
    }
    yield 1484;
    // L29.4: my receivers and my own reading agree: leave with the reason and knock again as a newcomer (sim: lguard rejoin 40).
    let lgNoteEl = null;
    function lgLeave() {
      if (typeof __C.clog === 'function') (0, /*()*/__C.clog)('lg-leave device-overload');
      if (!lgNoteEl) { lgNoteEl = document.createElement('div'); lgNoteEl.id = 'massbanner'; lgNoteEl.setAttribute('role', 'status'); lgNoteEl.textContent = (0, /*()*/__C.uiText)('deviceOverload', 'Your device is refusing or unable to carry meeting traffic.'); document.body.appendChild(lgNoteEl); }
      try { __C.model.net.meshNode() && __C.model.net.meshNode().leave(false); } catch (e) {}
      setTimeout(() => {
        for (const pid of Array.from(__C.model.roster.peers().keys())) { try { (0, /*()*/__C.dropPeer)(pid); } catch (e) {} } if (typeof __C.clearRosterTiles === 'function') (0, /*()*/__C.clearRosterTiles)();
        if (typeof __C.clog === 'function') (0, /*()*/__C.clog)('lg-rejoin');
        (0, /*()*/__C.startMesh)();
        setTimeout(() => { if (lgNoteEl) { lgNoteEl.remove(); lgNoteEl = null; } }, 30000);
      }, 20000);
    }
    // A picture that stops says so, never a silent frozen tile. A Stage strip or Stadium that had frames and has shown none
    // for STALL_MS while the tab is in view gets a plain line; a shared screen may rightly stand still. The banner adds why,
    // and only when both hold: this seat's picture stalled, and its own mass-leave sense names many people gone. Two goodbyes
    // arm that sense for the seat's healing; ordinary churn does that, so the banner wants MASS_MANY of them.
    const STALL_MS = GifOS.timings.STALL_MS, MASS_MANY = GifOS.timings.MASS_MANY;
    const stallOf = new WeakMap();
    let massMany = false, massBannerEl = null, massBannerAt = 0;
    const BANNER_HOLD = GifOS.timings.BANNER_HOLD;
    function stallSweep() {
      const now = Date.now(); let n = 0;
      for (const el of document.querySelectorAll('#stagefeed .rowtile, #stadium .rowtile')) {
        const v = el.querySelector('video'); if (!v) continue;
        const q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : null, fr = q ? q.totalVideoFrames : -1;
        let st = stallOf.get(v); if (!st) { st = { fr, at: now, had: false }; stallOf.set(v, st); }   // keyed on the element: a new stream that brings no frame is still a stall
        if (fr !== st.fr) { st.had = st.had || fr > 0; st.fr = fr; st.at = now; }
        if (document.hidden) st.at = now;   // a hidden tab presents nothing, so its count says nothing
        const stalled = st.had && now - st.at >= STALL_MS && !el.querySelector('.sharelabel');
        let note = el.querySelector('.stallnote');
        if (stalled && !note) { note = document.createElement('div'); note.className = 'stallnote'; note.setAttribute('role', 'status'); note.textContent = (0, /*()*/__C.uiText)('mediaReconnecting', '⟳ Reconnecting…'); el.appendChild(note); if (typeof __C.clog === 'function') (0, /*()*/__C.clog)('media-stall on ' + el.dataset.row); }
        else if (!stalled && note) { note.remove(); if (typeof __C.clog === 'function') (0, /*()*/__C.clog)('media-stall off ' + el.dataset.row); }
        if (stalled) n++;
      }
      return n;
    }
    function massBannerTick() {
      const stalled = stallSweep(), r = __C.model.net.meshNode() && __C.model.net.meshNode().raw;
      if (!r || !r.l13MassV) massMany = false;
      else if (!massMany) {
        let gone = 0; for (const at of r.byeIds.values()) if (r.TICK - at <= GifOS.meshConsts.consts.LEASE_T) gone++;
        const down = new Set(); for (let q = 0; q < r.l13DownAt.length; q++) if (r.TICK - r.l13DownAt[q] <= GifOS.meshConsts.consts.LEASE_T) down.add(q < r.l13DownPeer.length ? r.l13DownPeer[q] : -1 - q);
        massMany = Math.max(gone, down.size) >= MASS_MANY;
      }
      // held BANNER_HOLD past the last stalled beat, so a picture that comes and goes does not make it flicker
      if (massMany && stalled > 0) massBannerAt = Date.now();
      const on = massMany && Date.now() - massBannerAt < BANNER_HOLD;
      if (on === !!massBannerEl) return;
      if (typeof __C.clog === 'function') (0, /*()*/__C.clog)('mass-banner ' + (on ? 'on' : 'off'));
      if (on) { massBannerEl = document.createElement('div'); massBannerEl.id = 'massbanner'; massBannerEl.setAttribute('role', 'status'); massBannerEl.setAttribute('aria-live', 'polite'); massBannerEl.textContent = (0, /*()*/__C.uiText)('massLeaveBanner', 'Many people just left. Reconnecting the meeting, expect a short delay.'); document.body.appendChild(massBannerEl); }
      else { massBannerEl.remove(); massBannerEl = null; }
    }
    yield 1493;
    let islandNoteEl = null;
    function islandNoteTick() {
      try { svTick(); } catch (e) {}   // the same one-second clock keeps the Stage view's offer current
      const on = (0, /*()*/__C.islandApart)();
      if (on === !!islandNoteEl) return;
      if (typeof __C.clog === 'function') (0, /*()*/__C.clog)('island-note ' + (on ? 'on' : 'off'));
      if (on) { islandNoteEl = document.createElement('div'); islandNoteEl.id = 'islandnote'; islandNoteEl.setAttribute('role', 'status'); islandNoteEl.textContent = (0, /*()*/__C.uiText)('islandLabel', "You're in a separate part of this meeting: some people can't reach your network yet. It joins up by itself when they can."); document.body.appendChild(islandNoteEl); }
      else { islandNoteEl.remove(); islandNoteEl = null; }
    }
    yield 1500;
    const handqEl = document.getElementById('handq');
    // The banner repaints ONLY when the derived line actually changed — the
    // 2s beat costs one string compare, never idle DOM churn.
    let handqHtml = '';
    yield 1506;
    function paintBroadcastSeats() {
      const el = document.getElementById('bc-seats');
      if (!el) return;
      if (!__C.model.room.BROADCAST() || !__C.amAdmin) { if (el.innerHTML) el.innerHTML = ''; el.classList.remove('on'); return; }
      const ids = (0, /*()*/__C.stageIds)().filter((id) => id && id !== __C.model.me.myId());
      if (!ids.length) { if (el.innerHTML) el.innerHTML = ''; el.classList.remove('on'); return; }
      const html = '<div class="bc-hands-h">On stage</div>' + ids.map((id) => {
        return '<div class="bc-seat" data-id="' + (0, /*()*/__C.esc)(id) + '"><span class="bc-seat-name">' + (0, /*()*/__C.esc)((0, /*()*/__C.displayName)(id)) + '</span>'
          + (0, /*()*/__C.bcActButtons)(id, { demote: true, mute: true, blur: true, ban: true }) + '</div>';
      }).join('');
      if (el.innerHTML !== html) el.innerHTML = html;
      el.classList.add('on');
    }
    function showWhoIfOpen() { if (whoModal && whoModal.style.display === 'flex') showWhoModal(); }
    yield 1509;
    function renderHandq() {
      (0, /*()*/__C.learnFoldedNames)();
      try { paintRaisedHands(); } catch (e) {}
      const q = __C.model.hands.queue();
      handqEl.classList.toggle('on', q.length > 0);
      const stageFull = __C.amAdmin && (0, /*()*/__C.stageIds)().length >= __C.model.consts.SCALE().C;
      const tot = __C.model.hands.total(q), shown = Math.min(q.length, 8);
      paintHandBtn(q, tot);
      let html;
      if (__C.model.room.BROADCAST()) {
        const rows = q.slice(0, 8).map((e) => {
          const actions = (__C.amAdmin && e.i !== __C.model.me.myId()) ? (0, /*()*/__C.bcActButtons)(e.i, { promote: true, mute: true, blur: true, ban: true }) : '';
          return '<div class="bc-hand" data-id="' + (0, /*()*/__C.esc)(e.i) + '"><span class="hq" data-id="' + (0, /*()*/__C.esc)(e.i) + '">' + (0, /*()*/__C.esc)(e.n) + '</span>' + actions + '</div>';
        }).join('');
        html = !q.length ? ''
          : '<div class="bc-hands-h">Raised hands (' + tot + ')' + (stageFull ? ' · stage full' : '') + '</div>' + rows
            + (tot > shown ? '<div class="bc-hands-h">+' + (tot - shown) + '</div>' : '');
      } else {
        const seg = (e, i) => '<span class="hq" data-id="' + (0, /*()*/__C.esc)(e.i) + '">'
          + (i === 0 ? '<b>' + (0, /*()*/__C.esc)(e.n) + '</b>' : (0, /*()*/__C.esc)(e.n)) + '</span>';
        // The full stage is a fact about the queue, said once after the count.
        // "Hands up", not "waiting": the waiting room is people not yet in.
        html = !q.length ? ''
          : '✋ ' + tot + ' ' + (tot === 1 ? (0, /*()*/__C.uiText)('handUpOne', 'hand up') : (0, /*()*/__C.uiText)('handUpMany', 'hands up'))
            + (stageFull ? ' (' + (0, /*()*/__C.uiText)('stageFull', 'stage full') + ')' : '') + ': ' + q.slice(0, 8).map(seg).join(', ') + (tot > shown ? ', +' + (tot - shown) : '');
      }
      if (html === handqHtml) return;
      handqHtml = html;
      handqEl.innerHTML = html;
      try { paintBroadcastSeats(); } catch (e) {}
      placeHandq();
    }
    // Desktop: the queue sits just left of Fit (or of the build label while a
    // screen is shared and Fit is gone); --hq-room tells the header line how
    // much of the row it takes.
    function placeHandq() {
      if (!document.body.classList.contains('desk-ptr') || !handqEl.classList.contains('on')) {
        handqEl.style.right = '';
        handqEl.style.maxWidth = '';
        handqEl.classList.remove('hq-tight');
        document.body.classList.remove('hq-tight');
        document.body.style.removeProperty('--hq-room');
        try { placeFit(); } catch (e) {}
        return;
      }
      let edge = window.innerWidth - 14 - (parseFloat(getComputedStyle(document.body).getPropertyValue('--osw')) || 0);
      // Only what sits right of the header line limits it: a short window
      // puts the build mark at the top left, which pushed the line off screen.
      const lineEl = document.getElementById('status');
      const lineLeft = lineEl && lineEl.getClientRects().length ? lineEl.getBoundingClientRect().left : 0;
      for (const id of ['fitbtn', 'gifos-build-float']) {
        const el = document.getElementById(id);
        if (!el || !el.getClientRects().length) continue;
        const l = el.getBoundingClientRect().left;
        if (l < lineLeft) continue;
        edge = Math.min(edge, l - 10);
      }
      const right = Math.max(14, Math.round(window.innerWidth - edge));
      handqEl.style.right = right + 'px';
      // The header chip yields to the line (--hq-room) down to its logo and
      // mark; the count already shrinks to an unreadable sliver there. When
      // the line is wider than what is left of the row beside the logo and
      // mark, the count steps out and the line wraps to that width (hq-tight)
      // instead of covering the chip. People is still in More.
      handqEl.classList.remove('hq-tight');
      document.body.classList.remove('hq-tight');
      handqEl.style.maxWidth = '';
      const chipEl = document.querySelector('.topchip');
      if (chipEl && chipEl.getClientRects().length) {
        const cr = chipEl.getBoundingClientRect();
        const stEl = document.getElementById('status');
        // The logo, the mark, and the line's " · …" (it opens the status sheet).
        const fixedRight = stEl && stEl.getClientRects().length ? stEl.getBoundingClientRect().left + 40 + 12 : cr.right;
        const natural = handqEl.getBoundingClientRect().width;
        if (natural > Math.floor(window.innerWidth - right - cr.right - 10)) {
          const room = Math.floor(window.innerWidth - right - fixedRight - 10);
          if (natural > room) {
            handqEl.classList.add('hq-tight');
            document.body.classList.add('hq-tight');
            handqEl.style.maxWidth = Math.max(120, room) + 'px';
          }
        }
      }
      try { if (typeof fitStatusRest === 'function') fitStatusRest(); } catch (e) {}
      document.body.style.setProperty('--hq-room', Math.round(right + handqEl.getBoundingClientRect().width + 10) + 'px');
      try { placeFit(); } catch (e) {}
    }
    yield 1512;
    if (window.ResizeObserver) {
      // In the next frame, not in the callback: placeHandq resizes the header
      // line, which another observer watches; a resize in the same frame is
      // left undelivered and the page reports a ResizeObserver loop.
      let handqFrame = 0;
      const ro = new ResizeObserver(() => {
        if (!handqFrame) handqFrame = requestAnimationFrame(() => { handqFrame = 0; placeHandq(); });
      });
      ro.observe(handqEl);
      const fb = document.getElementById('fitbtn');
      if (fb) ro.observe(fb);
    }
    // The header's "✋ 1" stands for the line where the call covers it.
    const hdrHandEl = document.getElementById('hdrhand');
    let hdrHandSays = '';
    function paintHandBtn(q, tot) {
      hdrHandEl.classList.toggle('on', q.length > 0);
      if (!q.length) setHandqOpen(false);
      const says = q.length ? tot + '|' + q[0].n : '';
      if (says === hdrHandSays) return;
      hdrHandSays = says;
      hdrHandEl.innerHTML = q.length ? '✋ ' + tot + '<span class="hw">waiting</span>' : '';
      hdrHandEl.setAttribute('aria-label', q.length ? tot + ' waiting with a hand up: ' + q.slice(0, 8).map((e) => e.n).join(', ') : '');
    }
    function setHandqOpen(on) {
      handqEl.classList.toggle('open', !!on);
      hdrHandEl.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    hdrHandEl.addEventListener('click', () => setHandqOpen(!handqEl.classList.contains('open')));
    // A tap anywhere else puts the line away (names inside stay tappable).
    document.addEventListener('pointerdown', (e) => {
      if (!handqEl.classList.contains('open')) return;
      if (handqEl.contains(e.target) || hdrHandEl.contains(e.target)) return;
      setHandqOpen(false);
    }, true);
    // ADMIN rooms, signed-in admins only: tapping a queued name CALLS THEM UP —
    // the tap issues the same individually-signed mod-table 'app' grant that
    // gates apps and the Stage (§SIG; setMod refuses non-admins locally, and
    // every RECEIVER verifies the signature, so a forged tap changes nothing
    // anywhere). Open rooms: the queue stays informational — self step-up is
    // the only stage entry. One delegated listener; it survives repaints.
    handqEl.addEventListener('click', (e) => {
      const act = e.target.closest && e.target.closest('[data-bc-act]');
      if (act) {
        e.preventDefault();
        e.stopPropagation();
        (0, /*()*/__C.applyBcAct)(act.dataset.pid, act.dataset.bcAct);
        return;
      }
      const el = e.target.closest('.hq');
      if (!el || !(0, /*()*/__C.hasAdminRoom)() || !__C.amAdmin) return;
      const id = el.dataset.id;
      if (!id || id === __C.model.me.myId()) return;
      (0, /*()*/__C.setMod)(id, 'app', true);
    });
    const bcSeatsEl = document.getElementById('bc-seats');
    if (bcSeatsEl) bcSeatsEl.addEventListener('click', (e) => {
      const act = e.target.closest && e.target.closest('[data-bc-act]');
      if (!act) return;
      e.preventDefault();
      e.stopPropagation();
      (0, /*()*/__C.applyBcAct)(act.dataset.pid, act.dataset.bcAct);
    });
    yield 1529;
    function showFlipButton() {
      document.body.classList.add('has-flip');
      const b = document.getElementById('flipcam');
      if (b) b.style.display = '';
    }
    yield 1533;
    // If the tab was backgrounded long enough for the OS to kill the camera,
    // grab it again and swap the fresh tracks into every live link.
    function showCamBack(on) {
      if (!__C.model.me.meTile() || !__C.model.me.meTile().tile) return;
      __C.model.me.meTile().tile.classList.toggle('camback', !!on);
      let el = __C.model.me.meTile().tile.querySelector('.cambackmark');
      if (on && !el) {
        el = document.createElement('div');
        el.className = 'cambackmark';
        __C.model.me.meTile().tile.appendChild(el);
      }
      if (!el) return;
      const word = on === 'fail'
        ? (0, /*()*/__C.uiText)('camFail', 'Camera didn’t come back. Tap Camera.')
        : (0, /*()*/__C.uiText)('camBack', 'Camera stopped — bringing it back');
      if (el.textContent !== word) el.textContent = word;
    }
    yield 1566;

    // Join (or create) the room. The room id lives in the URL from the very
    // first moment — a reload, a bookmark, or a share all land in the SAME
    // room, and the room outlives everyone in it.
    // ---- R5 / E5§2: pick ONE of two+ meetings under this URL ----------------
    const forkModal = document.getElementById('fork-modal');
    const forkChoices = document.getElementById('fork-choices');
    function showForkPick(opts) {
      if (!forkModal || !forkChoices || !opts || !opts.length) return;
      forkChoices.innerHTML = '';
      opts.forEach((o, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = 'text-align:left;padding:.7rem .85rem;border-radius:.6rem;border:1px solid var(--border,#2a2a3f);background:var(--surface,#1c1c2b);color:var(--text,#e0e0f0);cursor:pointer';
        // Prefer Stage faces; fall back to Stadium (then raw faces).
        let tier = o.tier || 'roster';
        let faces = o.faces || [];
        if ((!faces.length || tier === 'roster') && o.stage && o.stage.length) { faces = o.stage; tier = 'stage'; }
        if ((!faces.length || tier === 'roster') && o.stadium && o.stadium.length) { faces = o.stadium; tier = 'stadium'; }
        const tierLbl = tier === 'stage' ? 'Stage' : tier === 'stadium' ? 'Stadium' : 'Door';
        const faceStr = faces.slice(0, 6).map((f) => String(f).slice(0, 10)).join(', ') || '(no faces yet)';
        btn.innerHTML = '<b>Meeting ' + String.fromCharCode(65 + i) + '</b>'
          + ' <span style="opacity:.65;font-size:.82rem">· ' + tierLbl + ' · ~' + (o.n || faces.length || '?') + ' people</span>'
          + '<small style="display:block;margin-top:.25rem;opacity:.7;font-family:ui-monospace,monospace;font-size:.75rem">' + faceStr + '</small>';
        btn.onclick = () => {
          forkModal.style.display = 'none';
          // Prefer option id (same-gkey clusters); fall back to gkey.
          const key = o.id || o.gkey;
          try { if (__C.model.net.meshNode() && __C.model.net.meshNode().chooseFork) __C.model.net.meshNode().chooseFork(key); } catch (e) {}
          (0, /*()*/__C.sayState)('joining');
        };
        forkChoices.appendChild(btn);
      });
      forkModal.style.display = 'flex';
      (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stThisLinkReachesMoreThan', 'This link reaches more than one room — pick one.'));
    }
    yield 1570;

    // ---- the password-reveal EYE (every password field wears one) ------------
    // Typing a password you cannot see is how typos mint wrong rooms. Tap to
    // show, tap to hide; a revealed field re-hides when its modal reopens
    // (pwEyeHide). The focusin delegate catches dynamically built fields
    // (the Invite modal's mint) with no per-site wiring.
    const PWEYE_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/><line class="slash" x1="3" y1="3" x2="21" y2="21" style="display:none"/></svg>';
    function pwEye(inp) {
      if (!inp || inp.__pwEye || inp.type !== 'password') return;
      inp.__pwEye = true;
      const wrap = document.createElement('span');
      wrap.style.cssText = 'position:relative;display:block;flex:1 1 auto';
      wrap.style.marginBottom = getComputedStyle(inp).marginBottom;
      inp.parentNode.insertBefore(wrap, inp);
      wrap.appendChild(inp);
      inp.style.marginBottom = '0';
      inp.style.paddingRight = '2rem';
      inp.style.width = '100%';
      inp.style.boxSizing = 'border-box';
      const b = document.createElement('button');
      b.type = 'button';
      if (inp.id) b.id = 'pweye-' + inp.id;
      b.title = (0, /*()*/__C.uiText)('pwShow', 'Show password'); b.setAttribute('aria-label', b.title);
      b.style.cssText = 'position:absolute;right:0;top:0;width:48px;height:48px;min-width:48px;min-height:48px;background:none;border:none;padding:0;margin:0;color:#3a3a3f;cursor:pointer;line-height:0;display:inline-flex;align-items:center;justify-content:center';
      inp.style.minHeight = '48px';
      inp.style.paddingRight = '52px';
      b.innerHTML = PWEYE_SVG;
      b.onclick = () => {
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        b.querySelector('.slash').style.display = show ? '' : 'none';
        b.title = show ? (0, /*()*/__C.uiText)('pwHide', 'Hide password') : (0, /*()*/__C.uiText)('pwShow', 'Show password');
        b.setAttribute('aria-label', b.title);
      };
      wrap.appendChild(b);
    }
    function pwEyeHide(inp) { // re-hide on modal reopen: the field + its eye reset together
      if (!inp) return;
      inp.type = 'password';
      const b = inp.id && document.getElementById('pweye-' + inp.id);
      if (b) { b.querySelector('.slash').style.display = 'none'; b.title = (0, /*()*/__C.uiText)('pwShow', 'Show password'); b.setAttribute('aria-label', b.title); }
    }
    for (const i of document.querySelectorAll('input[type=password]')) pwEye(i);
    document.addEventListener('focusin', (e) => {
      const t = e.target;
      if (t && t.type === 'password' && !t.__pwEye) { pwEye(t); t.focus(); } // re-focus: the wrap reparents (and so blurs) the field
    });

    // ---- room password UI: one modal, two moods -------------------------------
    const pwModal = document.getElementById('pw-modal');
    function hideJoinPwModal() { if (pwModal.dataset.mode === 'join') pwModal.style.display = 'none'; }
    yield 1579;
    let lobbyPw = (() => {
      let o = null;
      try { o = JSON.parse(sessionStorage.getItem(__C.model.consts.LOB_PW_KEY()) || 'null'); sessionStorage.removeItem(__C.model.consts.LOB_PW_KEY()); } catch (e) { o = null; }
      if (!o || typeof o.pw !== 'string' || !o.pw) return null;
      return { kind: o.kind, room: String(o.room || ''), av: String(o.av || ''), pw: o.pw };
    })();
    const lobbyPwFor = (kind) => !!(lobbyPw && lobbyPw.kind === kind && lobbyPw.room === __C.model.room.room() && lobbyPw.av === (__C.model.me.av() || ''));
    function lobbyPwOpenRoom() {
      if (!lobbyPw || lobbyPw.kind !== 'open') return;
      if (!lobbyPwFor('open') || __C.model.me.av() || __C.model.me.leaving() || __C.model.room.bannedOut() || __C.pwBlocked) { lobbyPw = null; return; }
      const ms = (0, /*()*/__C.meshSeat)();
      if (!(ms && ms.hasCoord && ms.state === 3)) return;   // not seated yet: the seat tick calls again
      const v = lobbyPw.pw; lobbyPw = null;
      pwModal.dataset.mode = 'manage';
      document.getElementById('pw-new').value = v;
      document.getElementById('pw-save').onclick();
      if (!pwSaveWaited) document.getElementById('pw-new').value = '';
    }
    function showPwModal(locked, why) {
      const service = __C.model.room.BROADCAST();
      document.getElementById('pw-title').textContent = service ? (0, /*()*/__C.uiText)('pwTitle', 'Room password') : (locked ? (0, /*()*/__C.uiText)('pwTitleLocked', 'This room is locked') : (0, /*()*/__C.uiText)('pwTitle', 'Room password'));
      document.getElementById('pw-hint').textContent = service
        ? (locked
          ? 'Enter the room password to see the stage clearly.'
          : 'Optional. People can still watch, and the stage stays blurred until it is set.')
        : why === 'banned' ? (0, /*()*/__C.uiText)('pwHintBanned', 'They are out, and this is the room\'s new password. Everyone still here already has it. Anyone joining later needs it, so copy it and send it to them yourself. To let a banned person back in, tell them this password.')
        : (locked
          ? (why === 'changed'
            ? (0, /*()*/__C.uiText)('pwHintChanged', 'The host changed the room password. Enter the new password to rejoin the meeting.')
            : (0, /*()*/__C.uiText)('pwHintLocked', 'Enter the room password to join the meeting.'))
          : !!__C.model.me.av()
            ? (0, /*()*/__C.uiText)('pwHintAdmin', 'Only the host can set or change it. When it is set or changed, everyone else here goes back to the door and must enter it to rejoin. Leave empty to remove the lock.')
            : (0, /*()*/__C.uiText)('pwHint', 'Anyone in the meeting can set or change it. It reaches everyone here instantly, and new joiners must enter it. Leave empty to remove the lock.'));
      document.getElementById('pw-cur-row').style.display = locked ? 'none' : 'flex';
      document.getElementById('pw-cur').value = __C.model.door.roomPw();
      pwEyeHide(document.getElementById('pw-cur')); // every open starts hidden — the eye reveals on demand
      pwEyeHide(document.getElementById('pw-new'));
      if (why === 'banned') { const cur = document.getElementById('pw-cur'), eye = document.getElementById('pweye-pw-cur'); if (eye) eye.click(); else cur.type = 'text'; }   // the admin needs to read it: nobody told them yet
      const inp = document.getElementById('pw-new');
      inp.value = ''; inp.placeholder = locked ? (0, /*()*/__C.uiText)('pwWord', 'Password') : (0, /*()*/__C.uiText)('pwNew', 'New password');
      document.getElementById('pw-save').textContent = locked ? (0, /*()*/__C.uiText)('join', 'Join') : (0, /*()*/__C.uiText)('pwSave', 'Save');
      const cancel = document.getElementById('pw-cancel');
      cancel.style.display = '';
      cancel.textContent = locked ? (0, /*()*/__C.uiText)('pwLeave', 'Leave') : (0, /*()*/__C.uiText)('pwClose', 'Close');
      pwModal.dataset.mode = locked ? 'join' : 'manage';
      pwModal.style.display = 'flex';
      if (locked && lobbyPwFor('join')) {
        const typed = lobbyPw.pw; lobbyPw = null;
        inp.value = typed;
        Promise.resolve().then(() => { if (pwModal.style.display !== 'none' && pwModal.dataset.mode === 'join' && inp.value === typed) document.getElementById('pw-save').onclick(); });
        return;
      }
      if (why === 'banned') { const cur = document.getElementById('pw-cur'); cur.focus(); cur.select(); } else inp.focus();
    }
    document.getElementById('pwbtn').onclick = () => showPwModal(false);
    document.getElementById('waitbtn').onclick = () => {
      if (!(0, /*()*/__C.hasAdminRoom)()) return;
      if (!__C.amAdmin) { (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stOnlyAnAdminCanTurn', 'Only a host can turn the waiting room on.')); return; }
      __C.model.door.meetWait().hold(!__C.holdDoor);
    };
    document.getElementById('waitdoor-leave').onclick = () => { location.href = __C.model.consts.MEET_PATH(); };
    document.getElementById('pw-cancel').onclick = () => {
      if (pwModal.dataset.mode === 'join') { location.href = __C.model.consts.MEET_PATH(); return; }
      pwModal.style.display = 'none';
    };
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || pwModal.style.display === 'none') return;
      if (pwModal.dataset.mode === 'join') { location.href = __C.model.consts.MEET_PATH(); return; }
      pwModal.style.display = 'none';
    });
    yield 1589;
    let pwSaveWaited = false;
    document.getElementById('pw-save').onclick = () => {
      const v = document.getElementById('pw-new').value.trim();
      if (pwModal.dataset.mode === 'join') {
        if (!v) return;
        pwModal.style.display = 'none';
        (0, /*()*/__C.joinWithPw)(v);   // the core knocks again with it (embed.html's card calls the same)
      } else {
        // A page still at the door (a reload a moment ago) re-keys only once seated: a re-key now seals its entry frames
        // under a key the room lacks, and a seated page holds a door's password frame until it is a member, so neither
        // side ever moves. The wait is bounded; a room with nobody to admit me seats at once.
        { const ms0 = (0, /*()*/__C.meshSeat)(); if (__C.model.net.meshNode() && !(ms0 && ms0.hasCoord && ms0.state === 3) && !pwSaveWaited) {
          pwSaveWaited = true; pwModal.style.display = 'none'; const t0 = Date.now();
          const again = () => { const ms1 = (0, /*()*/__C.meshSeat)(); if ((ms1 && ms1.hasCoord && ms1.state === 3) || Date.now() - t0 > 6000) { document.getElementById('pw-save').onclick(); pwSaveWaited = false; } else setTimeout(again, 200); };
          setTimeout(again, 200); return;
        } }
        // Clearing the password opens the room — warn that it also deletes any
        // shared files, then purge them for everyone.
        // A ROOM I CANNOT RE-KEY MUST NOT RE-KEY *ME* (2026-07-29). In an
        // admin room the relay refuses a non-admin's setpw — correctly — but
        // this handler used to store the new password and rotate the local
        // key REGARDLESS, so the refused member sealed everything under a
        // password nobody else had: unreadable to the room, the room
        // unreadable to her, her pair dead, and both sides compacted to
        // their own solo seat. A self-inflicted fork on a REJECTED order.
        // (Reachable only past the disabled button — the e2e admin suite
        // does exactly that to prove the relay refuses — but a client must
        // never eject itself on an order it knows it cannot issue.)
        if ((0, /*()*/__C.hasAdminRoom)() && !__C.amAdmin) {
          (0, /*()*/__C.setStatus)(__C.model.consts.PW_ADMIN_ONLY()); // the same sentence the door's refusal shows — one message for one rule
          pwModal.style.display = 'none';
          return;
        }
        // Clearing the password opens the room. The purge stays BELOW the
        // admin refusal: a guest's rejected setpw used to tombstone every pin
        // for the room and then learn the relay would not take the order.
        if (!v && __C.model.door.roomPw() && __C.model.room.files().size > 0) {
          const n = __C.model.room.files().size;
          if (!confirm('Clearing the password opens this room to anyone — and DELETES the ' + n + ' file' + (n > 1 ? 's' : '') + ' shared here, for everyone. Continue?')) return;
          (0, /*()*/__C.purgeAllFiles)(true);
        }
        (0, /*()*/__C.pwSetRoom)(v);
        pwModal.style.display = 'none';
      }
    };
    document.getElementById('pw-new').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('pw-save').click(); });

    // ---- admin UI --------------------------------------------------------------
    const admModal = document.getElementById('adm-modal');
    function showAdmModal() {
      const setup = document.getElementById('adm-setup'), panel = document.getElementById('adm-panel');
      const btn = document.getElementById('adm-enable');
      document.getElementById('adm-pass').value = '';
      // The Admin button only appears INSIDE an admin room now (a room minting
      // moved to Invite), so there are just two moods: sign in, or manage.
      if (__C.amAdmin) {
        setup.style.display = 'none'; panel.style.display = '';
        paintChatOptions();
        paintHostPw();
        document.getElementById('adm-hint').textContent = (0, /*()*/__C.uiText)('admHintOn', 'You are a host of this room. Hosts can lock the room with a room password (the key to clear video), mute or blur someone for everyone, and ban people. Anyone who knows the host password can open Host and use it too.');
      } else {
        setup.style.display = ''; panel.style.display = 'none';
        btn.textContent = (0, /*()*/__C.uiText)('admEnable', 'Use host password');
        document.getElementById('adm-hint').textContent = (0, /*()*/__C.uiText)('admHintOff', 'This room has a host. If you know the host password, enter it here to get the host controls. Your password stays on this device.');
      }
      admModal.style.display = 'flex';
    }
    document.getElementById('admbtn').onclick = showAdmModal;
    // Show host password (a private meeting's host only). The password is the
    // one this device kept (gifos_vhpw_<room>.<verifier>) when it created the
    // meeting or signed in as host. It is never logged, mirrored or put in a
    // link, and it leaves the page again whenever the popup closes. It cannot
    // change: the meeting's link carries the verifier made from it.
    const hostPwKey = () => 'gifos_vhpw_' + (0, /*()*/__C.roomKey)();
    function hostPwShown() { return !document.getElementById('adm-hpw-box').hidden || !document.getElementById('adm-hpw-none').hidden; }
    function paintHostPw(show) {
      const sec = document.getElementById('adm-hpw');
      const btn = document.getElementById('adm-hpw-show');
      const box = document.getElementById('adm-hpw-box');
      const val = document.getElementById('adm-hpw-val');
      const none = document.getElementById('adm-hpw-none');
      const copy = document.getElementById('adm-hpw-copy');
      // A public open-floor meeting has no host password, even for whoever took charge of it.
      sec.hidden = !(__C.amAdmin && __C.model.me.av());
      let pw = '';
      if (show && !sec.hidden) { try { pw = localStorage.getItem(hostPwKey()) || ''; } catch (e) { pw = ''; } }
      val.value = pw;
      box.hidden = !(show && pw);
      none.hidden = !(show && !pw && !sec.hidden);
      copy.textContent = (0, /*()*/__C.uiText)('admHpwCopy', 'Copy');
      btn.textContent = show ? (0, /*()*/__C.uiText)('admHpwHide', 'Hide host password') : (0, /*()*/__C.uiText)('admHpwShow', 'Show host password');
      btn.setAttribute('aria-expanded', show ? 'true' : 'false');
    }
    document.getElementById('adm-hpw-show').onclick = () => paintHostPw(!hostPwShown());
    document.getElementById('adm-hpw-copy').onclick = () => {
      const val = document.getElementById('adm-hpw-val'), copy = document.getElementById('adm-hpw-copy');
      if (!val.value) return;
      const done = () => { copy.textContent = (0, /*()*/__C.uiText)('admHpwCopied', 'Copied'); };   // back to Copy on the next paint (Hide, Show, reopening)
      const fallback = () => { try { val.select(); if (document.execCommand('copy')) done(); } catch (e) {} };
      try { navigator.clipboard.writeText(val.value).then(done, fallback); } catch (e) { fallback(); }
    };
    // Every way the popup closes takes the password off the page.
    new MutationObserver(() => { if (admModal.style.display === 'none' && document.getElementById('adm-hpw-val').value) paintHostPw(false); })
      .observe(admModal, { attributes: true, attributeFilter: ['style'] });
    document.getElementById('adm-close').onclick = () => { admModal.style.display = 'none'; };
    document.getElementById('adm-enable').onclick = async () => {
      // Sign in only: prove knowledge of THIS room's password (salt = this room).
      // Minting a room lives in Invite now, so this button is never a creator.
      const v = document.getElementById('adm-pass').value.trim();
      if (!v) return;
      const btn = document.getElementById('adm-enable');
      const hint = document.getElementById('adm-hint');
      btn.disabled = true;
      btn.textContent = (0, /*()*/__C.uiText)('admChecking', 'Checking…');
      (0, /*()*/__C.sayState)('adminChecking');
      let K;
      try { K = await (0, /*()*/__C.deriveAdminKey)(__C.model.room.room(), v); }
      catch (err) {
        btn.disabled = false;
        btn.textContent = (0, /*()*/__C.uiText)('admEnable', 'Use host password');
        hint.textContent = (0, /*()*/__C.uiText)('admCheckFail', 'Could not check the password ({err}).').split('{err}').join((err && err.name) || 'Error');
        return;
      }
      // V commits to the PUBLIC KEY of the keypair K seeds (§9) — the check
      // is local, instant, and needs no relay round-trip.
      if (!(await (0, /*()*/__C.adoptAdmKey)(K))) {
        btn.disabled = false;
        btn.textContent = (0, /*()*/__C.uiText)('admEnable', 'Use host password');
        hint.textContent = (0, /*()*/__C.uiText)('admWrong', 'Wrong host password.');
        (0, /*()*/__C.sayState)('adminWrong');
        return;
      }
      btn.disabled = false;
      document.getElementById('adm-pass').value = '';
      try { localStorage.setItem((0, /*()*/__C.admStoreKey)(), __C.model.door.admKey()); } catch (e2) {}
      try { localStorage.setItem(hostPwKey(), v); } catch (e2) {}   // Show host password (never mirrored)
      (0, /*()*/__C.mirrorRoomState)({ admin: true });
      admModal.style.display = 'none';
      (0, /*()*/__C.sayState)('adminSignedIn');
      applyAdminUi();
      (0, /*()*/__C.broadcastStatus)(); // the next signed heartbeat announces my adminship to every peer
    };

    // ---- who is on this meeting (names + addresses) -------------------------------
    // P2P meetings are direct connections: everyone can already learn everyone's
    // network address, so GifOS makes it VISIBLE — nobody here is anonymous,
    // and a downloadable record deters the worst behavior.
    const whoModal = document.getElementById('who-modal');
    yield 1613;
    function showWhoModal() {
      const opening = whoModal.style.display !== 'flex';
      const list = document.getElementById('who-list');
      list.innerHTML = '';
      const rows = (0, /*()*/__C.whoRows)();
      if (phoneLayout() && !__C.model.room.BROADCAST()) {
        // A phone opens People as a list of names and what each one is doing
        // (qa-meet-mobile). The address list stays on a wide screen, where the
        // download for the police lives too.
        const h3 = whoModal.querySelector('h3'); if (h3) h3.textContent = 'People';
        const lead = whoModal.querySelector('.who-lead'); if (lead) lead.textContent = 'Everyone on this call.';
        for (const r of rows.filter((x) => x.here && !x.ejected)) {
          const row = document.createElement('div'); row.className = 'brow';
          const nm = document.createElement('span'); nm.className = 'who-name'; nm.textContent = r.name; // whoRows already marks the own row "(you)"
          const state = document.createElement('span'); state.className = 'who-state';
          try { state.textContent = (0, /*()*/__C.whoFaceState)(r); } catch (e) { state.textContent = ''; }
          row.appendChild(nm); row.appendChild(state); list.appendChild(row);
        }
        whoModal.style.display = 'flex';
        if (opening) (0, /*()*/__C.whoObserve)().then(() => whoRepaint());
        return;
      }
      const bcHere = (r) => !r.me && r.here && !r.ejected;
      const groups = __C.model.room.BROADCAST() ? [
        { k: 'me', test: (r) => r.me },
        { k: 'stage', title: 'On stage', note: 'On the stage the room is watching.', test: (r) => bcHere(r) && (0, /*()*/__C.stageIds)().indexOf(r.pid) >= 0 },
        { k: 'hands', title: 'Raised hands', note: 'Asked to come on stage.', test: (r) => bcHere(r) && (0, /*()*/__C.stageIds)().indexOf(r.pid) < 0 && !!((__C.model.roster.statusOf().get(r.pid) || {}).hand) },
        { k: 'watching', title: 'Watching', note: 'In the audience. A name and picture show up here only after a hand and a promotion.', test: (r) => bcHere(r) && (0, /*()*/__C.stageIds)().indexOf(r.pid) < 0 && !((__C.model.roster.statusOf().get(r.pid) || {}).hand) },
        __C.model.consts.WHO_GROUPS()[3],
        __C.model.consts.WHO_GROUPS()[4],
      ] : __C.model.consts.WHO_GROUPS();
      const groupOf = (r) => groups.find((g) => g.test(r)).k;
      for (const g of groups) {
        const inG = rows.filter((r) => groupOf(r) === g.k);
        if (!inG.length) continue;
        if (g.title) {
          const h = document.createElement('div'); h.className = 'who-h'; h.dataset.group = g.k;
          h.style.cssText = 'margin-top:.7rem;font-weight:700;font-size:16px;line-height:1.3';
          h.textContent = (0, /*()*/__C.uiText)(g.titleKey, g.title) + ' (' + inG.length + ')';
          if (g.note) { const n = document.createElement('div'); n.style.cssText = 'font-weight:500;font-size:15px;line-height:1.35;color:#3a3a3f'; n.textContent = (0, /*()*/__C.uiText)(g.noteKey, g.note); h.appendChild(n); }
          list.appendChild(h);
        }
        for (const r of inG) {
          const row = document.createElement('div'); row.className = 'brow'; row.dataset.group = g.k;
          if (!r.here) row.style.opacity = '.65';
          const nm = document.createElement('span'); nm.className = 'who-name'; nm.textContent = r.name;
          const whoAv = r.me ? (GifOS.store.identity().avatar) : ((__C.model.roster.peers().get(r.pid) && __C.model.roster.peers().get(r.pid).avatarUrl) ? { url: __C.model.roster.peers().get(r.pid).avatarUrl, hash: __C.model.roster.peers().get(r.pid).avatarHash } : null);
          if (whoAv && whoAv.url) {
            const img = document.createElement('img');
            img.className = 'avchip'; img.alt = ''; img.src = whoAv.url;
            if (whoAv.hash) img.setAttribute('data-hash', whoAv.hash);
            nm.appendChild(img);
          }
          const ip = document.createElement('span'); ip.style.color = '#889'; ip.style.textAlign = 'right';
          (0, /*()*/__C.whoAddrLines)(r).forEach((t, i) => {
            if (i) ip.appendChild(document.createElement('br'));
            if (r.forged && !i) { const w = document.createElement('b'); w.className = 'who-forged'; w.style.color = '#e5484d'; w.textContent = t; ip.appendChild(w); }
            else ip.appendChild(document.createTextNode(t));
          });
          row.appendChild(nm); row.appendChild(ip);
          if (__C.model.room.BROADCAST() && __C.amAdmin && r.here && !r.me) {
            row.style.flexWrap = 'wrap';
            const mods = document.createElement('div');
            mods.className = 'bc-mods';
            const onStage = !!((0, /*()*/__C.modOf)(r.pid).app && (0, /*()*/__C.modOf)(r.pid).app.on);
            const muted = !!((0, /*()*/__C.modOf)(r.pid).mute && (0, /*()*/__C.modOf)(r.pid).mute.on);
            const blurred = !!((0, /*()*/__C.modOf)(r.pid).blur && (0, /*()*/__C.modOf)(r.pid).blur.on);
            const add = (act, label) => {
              const b = document.createElement('button');
              b.type = 'button';
              b.dataset.bcMod = act;
              b.dataset.pid = r.pid;
              b.textContent = label;
              mods.appendChild(b);
            };
            add('stage', onStage ? 'Demote' : 'Promote');
            add('mute', muted ? 'Unmute' : 'Mute');
            add('blur', blurred ? 'Unblur' : 'Blur');
            add('ban', 'Ban');
            row.appendChild(mods);
          } else if (!__C.model.room.BROADCAST() && (0, /*()*/__C.hasAdminRoom)() && __C.amAdmin && r.here && !r.me) {
            // Most of a big room has no tile on the admin's screen: this list is where she can reach them.
            row.style.flexWrap = 'wrap';
            const mods = document.createElement('div');
            mods.className = 'bc-mods';
            const b = document.createElement('button');
            b.type = 'button'; b.dataset.bcMod = 'ban'; b.dataset.pid = r.pid; b.textContent = (0, /*()*/__C.uiText)('admBan', 'Ban');
            mods.appendChild(b); row.appendChild(mods);
          }
          list.appendChild(row);
        }
      };
      whoModal.style.display = 'flex';
      if (opening) (0, /*()*/__C.whoObserve)().then(() => whoRepaint()); // what my links see right now, not 15 s ago
    }
    function whoRepaint() { if (whoModal.style.display === 'flex') showWhoModal(); }   // the core asks after a change
    document.getElementById('who-list').addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('[data-bc-mod]');
      if (!b || !__C.amAdmin) return;
      e.stopPropagation();
      const id = b.dataset.pid;
      const act = b.dataset.bcMod;
      if (!id) return;
      if (act === 'ban') {
        (0, /*()*/__C.pwBan)(id);
        return;
      }
      if (act === 'stage') (0, /*()*/__C.setMod)(id, 'app', !((0, /*()*/__C.modOf)(id).app && (0, /*()*/__C.modOf)(id).app.on));
      else if (act === 'mute') (0, /*()*/__C.setMod)(id, 'mute', !((0, /*()*/__C.modOf)(id).mute && (0, /*()*/__C.modOf)(id).mute.on));
      else if (act === 'blur') (0, /*()*/__C.setMod)(id, 'blur', !((0, /*()*/__C.modOf)(id).blur && (0, /*()*/__C.modOf)(id).blur.on));
      else return;
      showWhoModal();
    });
    document.getElementById('who-close').onclick = () => { whoModal.style.display = 'none'; };
    whoModal.onclick = (e) => { if (e.target === whoModal) whoModal.style.display = 'none'; }; // tap the backdrop to dismiss

    // Help: the stadium vocabulary, the four-bus mix, the non-obvious buttons,
    // and the dream — a whole-Earth meeting. Static content; the OS header's
    // Help opens it while no app is running (openAppHelp).
    const helpModal = document.getElementById('help-modal');
    function openMeetHelp() { helpModal.style.display = 'flex'; helpModal.querySelector('.help-scroll').scrollTop = 0; }
    function paintHelpTip() {
      const el = document.getElementById('apphelp');
      if (!el) return;
      // An app room keeps its own Help line after the app is on screen.
      // has-app is also true there; it must not replace the room's story.
      // A solo app (no room yet) is just the app: it says "app" until Invite makes the room.
      const appRoom = (__C.ROOM.kind === 'app' && !__C.ROOM.solo) || document.body.classList.contains('app-room');
      el.title = appRoom ? ((0, /*()*/__C.uiLang)() === 'en' ? 'How this app room works' : (0, /*()*/__C.uiText)('appHelpTitle', 'How this app room works'))
        : document.body.classList.contains('has-app') ? (0, /*()*/__C.uiText)('appHelpTip', 'How this app works')
        : __C.model.room.BROADCAST() ? 'How this broadcast works' : 'How this meeting works';
    }
    document.getElementById('help-close').onclick = () => { helpModal.style.display = 'none'; };
    // The Help screen matches WHAT THIS PAGE IS: a meeting keeps the authored
    // stadium explainer in the markup; a BROADCAST and an APP ROOM each swap
    // in their own story (one page, three products — the traits decide).
    function applyRoomHelp() {
      const h3 = document.querySelector('#help-modal h3');
      const hs = document.querySelector('#help-modal .help-scroll');
      paintHelpTip();
      // Two columns fit the meeting list. A broadcast or app story is longer
      // and keeps the vertical scroller; columns there spill sideways.
      hs.classList.toggle('help-meet', !__C.model.room.BROADCAST() && __C.ROOM.kind !== 'app');
      if (__C.model.room.BROADCAST()) {
        h3.textContent = 'How this broadcast works';
        hs.innerHTML =
          '<p class="help-lead">This is a <b>broadcast</b>: one host (and anyone they call up) on the <b>Stage</b>, and everyone else watching. Two people or a full room, it runs the same — every phone talks only to a handful of neighbors, and the broadcast reaches everyone.</p>'
          + '<h4>Watching</h4>'
          + '<ul class="help-list">'
          + '<li>The link is all you need. Your <b>camera and microphone are not used</b> — watching asks no permissions at all.</li>'
          + '<li>The video stays <b>blurred</b> until the host sets a <b>room password</b>. If you’re asked for one, the host shares it separately — it’s the ticket, and it does not ride the link.</li>'
          + '<li><b>Chat</b> is live to everyone here, is not stored on any server, and is gone when the broadcast ends.</li>'
          + '<li><b>Sound on</b> on the room bar mutes the stage on this device. Everyone else still hears it.</li>'
          + '</ul>'
          + '<h4>Speaking up</h4>'
          + '<ul class="help-list">'
          + '<li>Tap <b>Raise hand</b> to ask for the Stage. The host can call you up — your own phone then asks for your camera and mic (your choice to grant), and you join the host on Stage for the whole room.</li>'
          + '<li><b>Step off</b> is yours to do at any time; the host can also take the Stage back.</li>'
          + '<li><b>Stepping away?</b> Tap <b>Float</b> before you pocket your phone or switch apps, so the broadcast keeps running in a small window and you keep your place on the Stage.</li>'
          + '</ul>'
          + '<h4>For the host</h4>'
          + '<ul class="help-list">'
          + '<li>Your <b>host password</b> is yours alone — it IS your control of this broadcast. Do not send it to viewers.</li>'
          + '<li>The <b>Password</b> button sets or changes the <b>room password</b>: without one the broadcast stays blurred; with one, whoever you give it to sees you clear.</li>'
          + '<li>The hand queue floats to the top — tap a name to call them up on Stage. Revoking their grant pulls them back down.</li>'
          + '<li>Chat has a <b>Turn chat off</b> switch (your messages still land) and per-message delete. Ban lives on each tile’s controls.</li>'
          + '<li>A broadcast lives while its host is present. <b>End</b> it, and everyone watching sees a five-minute countdown, then the room closes.</li>'
          + '</ul>'
          + '<p>Underneath it is the same thing as a GifOS Meeting: everything goes straight between the people here, no accounts, no company keeping your video.</p>';
      } else if (__C.ROOM.kind === 'app') {
        h3.textContent = 'How this app room works';
        hs.innerHTML =
          '<p class="help-lead">This room exists around a <b>shared app</b>: everyone here sees and uses the <b>same live app together</b> — moves, edits and state flow between every phone directly.</p>'
          + '<h4>The app is the show</h4>'
          + '<ul class="help-list">'
          + '<li>The app fills the screen. One person <b>hosts</b> it (their device runs its engine); everyone else interacts live.</li>'
          + '<li>If the host drops off, what happens is the room’s choice at creation: an <b>owned</b> app pauses until its owner returns; a <b>resilient</b> one lets a friend still here take over hosting.</li>'
          + '</ul>'
          + '<h4>No camera</h4>'
          + '<ul class="help-list">'
          + '<li>This room has <b>no camera and no video</b>. Nothing here is blurred, because there is no picture to blur.</li>'
          + '<li><b>Talk</b>, when the host turns it on, is voice only. You can use the app and chat without joining it.</li>'
          + '</ul>'
          + '<h4>Chat, files, invites</h4>'
          + '<ul class="help-list">'
          + '<li><b>Chat</b> stays between the people here — no server ever sees it; it’s gone when the room empties.</li>'
          + '<li><b>Files</b> can be pinned once the room has a password.</li>'
          + '<li><b>Invite</b> copies the one link that brings a friend straight in. The link is the whole key — share it deliberately.</li>'
          + '</ul>'
          + '<p>Underneath it is the same thing as a GifOS Meeting: everything goes straight between the people here, no accounts, no limit on how many.</p>';
      }
      if ((0, /*()*/__C.uiLang)() === 'en') return;
      if (__C.model.room.BROADCAST()) {
        h3.textContent = (0, /*()*/__C.uiText)('bcHelpTitle', 'How this broadcast works');
        hs.innerHTML = richHtml((0, /*()*/__C.uiText)('helpBcBody', hs.innerHTML));
      } else if (__C.ROOM.kind === 'app') {
        h3.textContent = (0, /*()*/__C.uiText)('appHelpTitle', 'How this app room works');
        hs.innerHTML = richHtml((0, /*()*/__C.uiText)('helpAppBody', hs.innerHTML));
      }
    }
    yield 1627;
    helpModal.onclick = (e) => { if (e.target === helpModal) helpModal.style.display = 'none'; };
    yield 1630;
    document.getElementById('who-dl').onclick = async () => {
      try { await (0, /*()*/__C.whoObserve)(); } catch (e) {}
      const stamp = new Date().toISOString();
      const blob = new Blob([(0, /*()*/__C.whoFileText)()], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'gifos-meeting-' + __C.model.room.room() + '-' + stamp.replace(/[:.]/g, '-') + '.txt';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    };
    document.getElementById('whobtn').onclick = showWhoModal;
    const airWho = document.getElementById('airwho');
    if (airWho) airWho.onclick = showWhoModal;
    const airSound = document.getElementById('airsound');
    if (airSound) airSound.onclick = () => {
      if (!__C.model.room.BROADCAST()) return;
      (0, /*()*/__M.setServiceHeard)(!__M.serviceHeard);
      try { paintServiceSound(); } catch (e) {}
      try {
        (0, /*()*/__C.setStatus)(__M.serviceHeard
          ? 'You can hear the stage.'
          : 'The stage is muted on this device. Everyone else still hears it.');
      } catch (e) {}
    };
    yield 1653;
    function renderLobbyList() {
      // Filtered by surface as well as read from the surface's own key: the list
      // you are looking at can NEVER show the other one's links, whatever ends up
      // in storage.
      const mine = (e) => e && e.url && (0, /*()*/__C.isCastEntry)(e) === __C.model.consts.CAST_SURFACE();
      const marks = (0, /*()*/__C.loadList)(__C.model.consts.MEET_MARKS()).filter(mine);
      const markSet = new Set(marks.map((m) => m.url));
      const recents = (0, /*()*/__C.loadList)(__C.model.consts.MEET_HIST()).filter((e) => mine(e) && !markSet.has(e.url));
      const html = marks.map((m) => (0, /*()*/__C.lobRow)(m, true)).join('') + recents.map((e) => (0, /*()*/__C.lobRow)(e, false)).join('');
      document.getElementById('lob-list').innerHTML = html;
      document.getElementById('lob-empty').style.display = html ? 'none' : '';
    }
    yield 1657;
    let lobbyCamGen = 0;
    function stopLobbyPreview() {
      lobbyCamGen++;
      const vid = document.getElementById('lob-preview-vid');
      // The preview may show the background effect's composite: stop it and the camera under it.
      if (vid && vid.__bgfx) { try { vid.__bgfx.stop(); } catch (e) {} vid.__bgfx = null; }
      if (vid && vid.__raw) { try { vid.__raw.getTracks().forEach((t) => t.stop()); } catch (e) {} vid.__raw = null; }
      if (!vid || !vid.srcObject) return;
      try { vid.srcObject.getTracks().forEach((t) => t.stop()); } catch (e) {}
      vid.srcObject = null;
    }
    function paintLobbyAv() {
      const pv = document.getElementById('lob-preview');
      if (!pv) return;
      pv.dataset.cam = __C.model.me.joinAv().cam ? 'on' : 'off';
      pv.dataset.mic = __C.model.me.joinAv().mic ? 'on' : 'off';
      const word = (el, key, en) => { if (!el) return; el.setAttribute('data-t', key); el.textContent = (0, /*()*/__C.uiText)(key, en); };
      const btn = (id, on, onKey, onEn, offKey, offEn) => {
        const b = document.getElementById(id);
        if (!b) return;
        b.dataset.on = on ? '1' : '0';
        word(b.querySelector('.lob-avtxt'), on ? onKey : offKey, on ? onEn : offEn);
      };
      let lvl = 2;
      try { lvl = (0, /*()*/__C.blurLevel)(__C.model.me.myStatus().blur); } catch (e) {}
      if (__C.model.me.joinAv().cam) {
        const onSpec = lvl === 2 ? ['camMaxBlur', 'Max blur'] : lvl === 1 ? ['camMinBlur', 'Min blur'] : ['lobCamOn', 'Camera on'];
        btn('lob-cam', true, onSpec[0], onSpec[1], 'camOffChip', 'Camera off');
      } else btn('lob-cam', false, 'lobCamOn', 'Camera on', 'camOffChip', 'Camera off');
      btn('lob-mic', __C.model.me.joinAv().mic, 'lobMicOn', 'Mic on', 'lobMicOff', 'Mic off');
      const quiet = __C.model.me.joinAv().cam || __C.model.me.joinAv().mic;
      const clearPick = !!(__C.model.me.joinAv().cam && lvl === 0);
      const note = document.getElementById('lob-pv-note');
      word(note, !quiet ? 'youJoinMutedWith' : clearPick ? 'lobClearIf' : 'appearTitle',
        !quiet ? 'You join muted, with the camera off' : clearPick ? 'This is how you\'ll appear if the meeting you join allows clear video.' : 'This is how you\'ll appear');
      if (note) note.classList.toggle('lob-pv-clear', clearPick);
      const lobEl = document.getElementById('lobby');
      if (lobEl) lobEl.classList.toggle('lob-clear', clearPick);
      try { placeClearLine(); } catch (e) {}
      let joinKey = 'lobJoinOff', joinEn = "You'll join with your camera and microphone off.";
      if (__C.model.me.joinAv().cam && __C.model.me.joinAv().mic) { joinKey = 'lobJoinBoth'; joinEn = "You'll join with your camera and microphone on."; }
      else if (__C.model.me.joinAv().cam) { joinKey = 'lobJoinCam'; joinEn = "You'll join with your camera on and your microphone off."; }
      else if (__C.model.me.joinAv().mic) { joinKey = 'lobJoinMic'; joinEn = "You'll join with your camera off and your microphone on."; }
      if (!__C.model.consts.BC_INTENT()) word(document.getElementById('lob-quiet'), joinKey, joinEn);
      const face = document.getElementById('lob-pv-face');
      if (face) { const me = GifOS.store.identity(); paintAppearFace(face, me.name, me.avatar); }
      const vid = document.getElementById('lob-preview-vid');
      if (vid) {
        const bl = __C.model.me.joinAv().cam ? lvl : 0;
        vid.classList.toggle('blur1', bl === 1);
        vid.classList.toggle('blur2', bl === 2);
        if (bl) { try { (0, /*()*/__M.blurSized)(vid); } catch (e) {} }
        vid.dataset.blur = String(bl);
      }
    }
    function setLobbyCam(on) {
      if (!on) { __C.model.me.joinAv().cam = false; stopLobbyPreview(); paintLobbyAv(); return; }
      const md = navigator.mediaDevices;
      if (!md || !md.getUserMedia) return;
      const gen = ++lobbyCamGen;
      md.getUserMedia({ video: true, audio: false }).then((stream) => {
        const lob = document.getElementById('lobby');
        const vid = document.getElementById('lob-preview-vid');
        if (gen !== lobbyCamGen || !vid || !lob || !lob.classList.contains('show')) {
          try { stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
          return;
        }
        // The chosen background (js/meet-bgfx.js) shows here as the room will see it.
        const fx = GifOS.meetBgfx ? GifOS.meetBgfx.preview(stream.getVideoTracks()[0]) : null;
        if (fx) { vid.__bgfx = fx; vid.__raw = stream; vid.srcObject = new MediaStream([fx.track]); }
        else vid.srcObject = stream;
        __C.model.me.joinAv().cam = true;
        paintLobbyAv();
      }).catch(() => { if (gen === lobbyCamGen) { __C.model.me.joinAv().cam = false; paintLobbyAv(); } });
    }
    yield 1663;
    function enterMeeting(hashOrUrl) {
      if (document.getElementById('lobby').classList.contains('show')) (0, /*()*/__C.stashJoinAv)();
      stopLobbyPreview();
      try {
        const typed = document.getElementById('lob-name-in');
        if (typed && typed.value.trim()) GifOS.store.setName(typed.value.trim());
        if (document.getElementById('lobby').classList.contains('show')) sessionStorage.setItem('gifos_appear_ok', '1');
      } catch (e) {}
      // Accept a '#…' hash (minted here) or a full URL (a saved entry). A
      // hash-only change never re-runs boot on its own, so it needs an explicit
      // reload — but ONLY then: reloading while navigating to a DIFFERENT path
      // (a saved pretty /meet/<room> link) races the navigation and cancels it,
      // which left the Recent list dead on production.
      const url = hashOrUrl.charAt(0) === '#' ? (__C.model.consts.MEET_PATH() + hashOrUrl) : hashOrUrl;
      let samePage = false;
      try {
        const to = new URL(url, location.href);
        samePage = to.origin === location.origin && to.pathname === location.pathname && to.search === location.search;
      } catch (e) { /* unparsable — treat as a normal navigation */ }
      location.href = url;
      if (samePage) location.reload();
    }
    function renameFlow(after) {
      const cur = (GifOS.store.identity().name) || '';
      const bg = document.createElement('div'); bg.className = 'name-modal';
      bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true');
      bg.innerHTML = '<div class="name-box"><h3>' + (0, /*()*/__C.uiText)('screenNameTitle', 'Your screen name') + '</h3><p>' + (0, /*()*/__C.uiText)('screenNameNote', 'Other people in the meeting see this.') + '</p>' +
        '<input id="nm2" maxlength="40" autocomplete="off"><button id="nm2cancel" type="button">' + (0, /*()*/__C.uiText)('lobCancel', 'Cancel') + '</button><button id="nm2ok">' + (0, /*()*/__C.uiText)('save', 'Save') + '</button></div>';
      document.body.appendChild(bg);
      const input = bg.querySelector('#nm2'); input.value = cur; input.focus();
      const done = () => { const v = input.value.trim(); if (v) GifOS.store.setName(v); bg.remove(); if (typeof paintLobbyAppear === 'function') paintLobbyAppear(); if (after) after(); };
      bg.querySelector('#nm2ok').onclick = done;
      bg.querySelector('#nm2cancel').onclick = () => bg.remove();
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
    }
    yield 1666;
    function wireLobby() {
      const lob = document.getElementById('lobby');
      const toggle = (id) => { const el = document.getElementById(id); el.style.display = el.style.display === 'none' ? '' : 'none'; };
      const selectLob = (which) => {
        const modes = [['lob-join-btn', 'lob-join'], ['lob-admin-btn', 'lob-admin'], ['lob-open-seg', 'lob-open-panel']];
        for (let i = 0; i < modes.length; i++) {
          const on = modes[i][0] === which;
          const b = document.getElementById(modes[i][0]);
          const p = document.getElementById(modes[i][1]);
          if (b) {
            b.classList.toggle('sel', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
            if (on) b.setAttribute('aria-describedby', 'lob-seg-note');
            else b.removeAttribute('aria-describedby');
          }
          if (p) p.style.display = on ? '' : 'none';
        }
        const note = document.getElementById('lob-seg-note');
        if (note) {
          if (which === 'lob-join-btn') {
            note.setAttribute('data-t', 'lobJoinSub');
            note.textContent = (0, /*()*/__C.uiText)('lobJoinSub', 'Paste a link or type a room name.');
          } else if (which === 'lob-admin-btn') {
            note.setAttribute('data-t', 'lobAdminSub');
            note.textContent = (0, /*()*/__C.uiText)('lobAdminSub', 'You control everything in the meeting.');
          } else if (which === 'lob-open-seg') {
            note.setAttribute('data-t', 'lobStartSub');
            note.textContent = (0, /*()*/__C.uiText)('lobStartSub', 'Majority rules: vote people off the stage or out of the meeting.');
          }
        }
        const adminErr = document.getElementById('lob-admin-err');
        const joinErr = document.getElementById('lob-join-err');
        if (adminErr) adminErr.hidden = which !== 'lob-admin-btn';
        if (joinErr) joinErr.hidden = which !== 'lob-join-btn';
        const goBtn = document.getElementById('lob-go');
        if (goBtn && !__C.model.consts.BC_INTENT()) {
          if (which === 'lob-join-btn') {
            goBtn.setAttribute('data-t', 'join');
            goBtn.textContent = (0, /*()*/__C.uiText)('join', 'Join');
          } else if (which === 'lob-admin-btn') {
            goBtn.setAttribute('data-t', 'lobAdminGo');
            goBtn.textContent = (0, /*()*/__C.uiText)('lobAdminGo', 'Start');
          } else if (which === 'lob-open-seg') {
            goBtn.setAttribute('data-t', 'lobOpenGo');
            goBtn.textContent = (0, /*()*/__C.uiText)('lobOpenGo', 'Open');
          }
        }
        if (which === 'lob-admin-btn') {
          const n = document.getElementById('lob-admin-name');
          const key = document.getElementById('lob-admin-pass');
          if (key && !key.value) key.value = (0, /*()*/__C.mintHostKey)();
          if (n) n.focus();
        } else if (which === 'lob-join-btn') {
          const j = document.getElementById('lob-join-in');
          if (j) j.focus();
        }
      };
      const doOpen = () => {
        let code = (0, /*()*/__C.shortCode)();
        const named = document.getElementById('lob-open-name');
        const raw = named ? (named.value || '') : '';
        if (/[A-Za-z0-9]/.test(raw)) { const chosen = (0, /*()*/__C.slugRoom)(raw, ''); if (chosen) code = chosen; }
        (0, /*()*/__C.lobbyPwHandOver)('open', code, '', document.getElementById('lob-open-pass'));
        enterMeeting('#' + GifOS.link.hash({ room: code }));
      };
      document.getElementById('lob-open-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doOpen(); });
      const openName = document.getElementById('lob-open-name');
      if (openName) openName.addEventListener('keydown', (e) => { if (e.key === 'Enter') doOpen(); });
      const openSeg = document.getElementById('lob-open-seg');
      if (openSeg) openSeg.onclick = () => { if (!__C.model.consts.BC_INTENT()) selectLob('lob-open-seg'); };
      const lobCam = document.getElementById('lob-cam');
      if (lobCam) lobCam.onclick = () => {
        if (__C.model.me.joinAv().cam) { setLobbyCam(false); return; }
        (0, /*()*/__M.openCamChooser)(lobCam, (level) => {
          try { (0, /*()*/__C.setPersonalBlur)(level); } catch (e) {}
          setLobbyCam(true);
        });
      };
      const lobMic = document.getElementById('lob-mic');
      if (lobMic) lobMic.onclick = () => { __C.model.me.joinAv().mic = !__C.model.me.joinAv().mic; paintLobbyAv(); };
      // Host a private meeting mints the host key when that segment opens.
      document.getElementById('lob-admin-btn').onclick = () => {
        if (__C.model.consts.BC_INTENT()) {
          toggle('lob-admin');
          document.getElementById('lob-join').style.display = 'none';
          const open = document.getElementById('lob-admin').style.display !== 'none';
          document.getElementById('lobby').classList.toggle('form-open', open);
          const n = document.getElementById('lob-admin-name');
          const key = document.getElementById('lob-admin-pass');
          if (open && key && !key.value) key.value = (0, /*()*/__C.mintHostKey)();
          if (open) {
            document.getElementById('lob-key-block').hidden = true;
            document.getElementById('lob-key-reveal').hidden = false;
          }
          if (open) n.focus();
          return;
        }
        selectLob('lob-admin-btn');
      };
      document.getElementById('lob-key-reveal').onclick = () => {
        document.getElementById('lob-key-block').hidden = false;
        document.getElementById('lob-key-reveal').hidden = true;
        const key = document.getElementById('lob-admin-pass');
        key.focus();
        key.select();
        const gen = document.getElementById('lob-keygen');
        if (gen && gen.scrollIntoView) gen.scrollIntoView({ block: 'nearest' });
        placeDeskName();
      };
      const more = document.getElementById('lob-desk-more');
      if (more) more.onclick = () => {
        const open = lob.classList.toggle('desk-more');
        more.setAttribute('aria-pressed', open ? 'true' : 'false');
        more.textContent = open ? 'Done' : 'More';
        more.setAttribute('aria-label', open ? 'Back to Go live' : 'Watch a link, or see the host password');
        if (!open) {
          document.getElementById('lob-join').style.display = 'none';
          if (__C.model.consts.BC_INTENT()) {
            document.getElementById('lob-admin').style.display = '';
            lob.classList.add('form-open', 'service-ready');
          }
        }
        placeDeskName();
      };
      const preview = document.getElementById('lob-preview');
      if (preview) preview.addEventListener('click', (e) => {
        if (!__C.model.consts.BC_INTENT() || !lob.classList.contains('service-ready') || lob.classList.contains('desk-more')) return;
        if (e.target.closest('#lob-desk-more, button, a, input, textarea, select')) return;
        if (!window.matchMedia('(max-width: 700px) and (min-height: 421px)').matches) return;
        const go = document.getElementById('lob-go');
        if (!go || go.disabled || go.getClientRects().length === 0) return;
        go.click();
      });
      document.getElementById('lob-keygen').onclick = () => {
        const key = document.getElementById('lob-admin-pass');
        key.value = (0, /*()*/__C.mintHostKey)();
        key.focus();
        key.select();
      };
      // Schedule swaps the one button's word. A room password, when one is
      // typed, locks the door. A blank one leaves the link open.
      let bcLater = false;
      const bcNextHour = () => {
        const d = new Date(Date.now() + 3600000); d.setMinutes(0, 0, 0);
        const z = (n) => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes());
      };
      document.getElementById('lob-bc-sched').onclick = () => {
        const go = document.getElementById('lob-go');
        const when = document.getElementById('lob-bc-when');
        const at = document.getElementById('lob-bc-at');
        if (!bcLater) {
          // First tap: show the time, ready at the next full hour.
          bcLater = true;
          when.hidden = false;
          if (!at.value) at.value = bcNextHour();
          document.getElementById('lob-bc-sched').textContent = (0, /*()*/__C.uiText)('bcGoNowShort', 'Go live now');
          go.setAttribute('data-t', 'bcSchedule');
          go.textContent = (0, /*()*/__C.uiText)('bcSchedule', 'Schedule');
          lob.classList.add('bc-later');
          return;
        }
        bcLater = false;
        when.hidden = true;
        document.getElementById('lob-bc-sched').textContent = (0, /*()*/__C.uiText)('bcSchedule', 'Schedule');
        go.setAttribute('data-t', 'bcGoLive');
        go.textContent = (0, /*()*/__C.uiText)('bcGoLive', 'Go live');
        lob.classList.remove('bc-later');
      };
      let goLiveBlurPick = null;
      const doHost = async () => {
        const err = document.getElementById('lob-admin-err');
        let rawName = document.getElementById('lob-admin-name').value || '';
        // A broadcast's name is optional: a blank one is "broadcast" (the
        // host key makes the room its own). A call still needs a name.
        if (__C.model.consts.BC_INTENT() && !/[A-Za-z0-9]/.test(rawName)) rawName = 'broadcast';
        // slugRoom turns a blank into "room", so the empty check has to
        // happen on what was typed. A name with no letter or digit is blank.
        if (!/[A-Za-z0-9]/.test(rawName)) { err.textContent = (0, /*()*/__C.uiText)('needName', 'Give your room a name.'); return; }
        const chosen = (0, /*()*/__C.slugRoom)(rawName, '');
        const pass = (document.getElementById('lob-admin-pass').value || '').trim();
        if (!chosen) { err.textContent = (0, /*()*/__C.uiText)('needName', 'Give your room a name.'); return; }
        if (!pass) { err.textContent = (0, /*()*/__C.uiText)('needPass', 'A host password is required.'); document.getElementById('lob-admin-pass').focus(); return; }
        let atSecs = '';
        if (__C.model.consts.BC_INTENT() && bcLater) {
          const ms = new Date(document.getElementById('lob-bc-at').value || '').getTime();
          if (!Number.isFinite(ms) || ms < Date.now()) { err.textContent = (0, /*()*/__C.uiText)('bcNeedTime', 'Pick a start time that is still ahead.'); return; }
          atSecs = String(Math.floor(ms / 1000));
        }
        const go = document.getElementById('lob-go');
        // Go live is turning the camera on: the same blur choices as the
        // camera button, and that pick is the consent. A typed room password
        // locks the door. A blank one leaves the link open.
        if (__C.model.consts.BC_INTENT() && !atSecs && goLiveBlurPick == null) {
          if (typeof __M.camChooserOpen === 'function' && (0, /*()*/__M.camChooserOpen)()) { (0, /*()*/__M.dismissCamChooser)(); return; }
          (0, /*()*/__M.openCamChooser)(go, (level) => {
            goLiveBlurPick = (0, /*()*/__C.blurLevel)(level);
            try { (0, /*()*/__C.setPersonalBlur)(level); } catch (e) {}
            try { __C.model.me.joinAv().cam = true; paintLobbyAv(); } catch (e) {}
            setLobbyCam(true);
            go.click();
          });
          return;
        }
        const picked = goLiveBlurPick;
        goLiveBlurPick = null;
        go.dataset.label = go.textContent;
        go.disabled = true; go.textContent = (0, /*()*/__C.uiText)('creating', 'Creating…');
        try {
          const K = await (0, /*()*/__C.deriveAdminKey)(chosen, pass);
          const V = (await __C.model.net.net().edKeysFromSeedHex(K)).verifier; // V commits to the PUBLIC key (§9)
          try { localStorage.setItem('gifos_vadm_' + chosen + '.' + V, K); } catch (e) {}
          try { localStorage.setItem('gifos_vhpw_' + chosen + '.' + V, pass); } catch (e) {}   // Show host password (this device only, never mirrored)
          (0, /*()*/__C.mirrorRoomState)({ admin: true }, chosen + '.' + V);
          // The ROOM password (optional): pre-seed the room-password store —
          // exactly what the Password button writes — and the admin's normal
          // §LOCK re-assert locks the door + seals the key the moment they
          // arrive. It rides the SESSION, never the link (the whole point of
          // the two separate fields: the admin password must never reach a
          // guest, the room password is the one you send them). A password
          // typed in the field locks the door, including on a broadcast.
          const guest = (document.getElementById('lob-guest-pass').value || '').trim();
          if (guest) { try { localStorage.setItem('gifos_vpw_' + chosen + '.' + V, guest); localStorage.setItem('gifos_vpwat_' + chosen + '.' + V, String(Date.now())); } catch (e) {} } // stamp the store's clock (§LOCK expiry)
          // Go live now is the deliberate tap: the stream boots with the
          // camera on. A scheduled one (and the host link opened later)
          // lands off air, with the start time riding the link.
          if (__C.model.consts.BC_INTENT() && !atSecs) { try { sessionStorage.setItem('gifos_bc_golive_' + chosen + '.' + V, 'b' + (0, /*()*/__C.blurLevel)(picked)); } catch (e) {} }
          if (atSecs) { try { localStorage.setItem('gifos_bcat_' + chosen + '.' + V, atSecs); } catch (e) {} }
          const bc = __C.model.consts.BC_INTENT();
          enterMeeting('#' + GifOS.link.hash({ room: chosen, v: V, rest: { at: bc ? atSecs : '' } }));
        } catch (e) { err.textContent = 'Could not create the room. Try again.'; go.disabled = false; go.textContent = go.dataset.label || 'Start'; }
      };
      document.getElementById('lob-join-btn').onclick = () => {
        if (__C.model.consts.BC_INTENT()) { toggle('lob-join'); document.getElementById('lob-admin').style.display = 'none'; const i = document.getElementById('lob-join-in'); if (document.getElementById('lob-join').style.display !== 'none') i.focus(); return; }
        selectLob('lob-join-btn');
      };
      const nameIn = document.getElementById('lob-name-in');
      if (nameIn) nameIn.addEventListener('change', () => {
        const v = nameIn.value.trim();
        if (v) GifOS.store.setName(v);
        paintLobbyAppear();
      });
      const faceBtn = document.getElementById('lob-face');
      const faceFile = document.getElementById('lob-face-file');
      if (faceBtn && faceFile) {
        faceBtn.onclick = () => faceFile.click();
        faceFile.addEventListener('change', () => {
          const file = faceFile.files && faceFile.files[0];
          (0, /*()*/__C.applyAvatarFile)(file).then(() => paintLobbyAppear());
        });
      }
      const doJoin = () => {
        const err = document.getElementById('lob-join-err');
        const p = (0, /*()*/__C.parseMeetInput)(document.getElementById('lob-join-in').value);
        if (!p) { err.textContent = (0, /*()*/__C.uiText)('badLink', 'Couldn’t read that — paste a meeting link or its id.'); return; }
        (0, /*()*/__C.lobbyPwHandOver)('join', p.room, p.av || '', document.getElementById('lob-join-pass'));
        // A broadcast link (its page is /cast or cast.html) opens on the broadcast page; anything else on this one.
        const h = '#' + GifOS.link.hash({ room: p.room, v: p.av, rest: { relay: p.relay } });
        enterMeeting(p.bc && !__C.model.consts.BC_INTENT() ? GifOS.link.pageFor(__C.model.consts.MEET_PATH(), 'cast') + h : h);
      };
      document.getElementById('lob-go').onclick = () => {
        if (__C.model.consts.BC_INTENT()) { doHost(); return; }
        const sel = document.querySelector('#lobby .lob-segs .seg.sel');
        const id = sel ? sel.id : '';
        if (id === 'lob-join-btn') doJoin();
        else if (id === 'lob-admin-btn') doHost();
        else doOpen();
      };
      document.getElementById('lob-join-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
      document.getElementById('lob-join-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
      document.getElementById('lob-admin-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('lob-go').click(); });
      document.getElementById('lob-guest-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('lob-go').click(); });
      document.getElementById('lob-list').addEventListener('click', (e) => {
        const star = e.target.closest('[data-star]');
        if (star) { e.stopPropagation(); (0, /*()*/__C.toggleBookmark)(star.getAttribute('data-star')); return; }
        const del = e.target.closest('[data-del]');
        if (del) {
          e.stopPropagation();
          const url = del.getAttribute('data-del');
          (0, /*()*/__C.saveList)(__C.model.consts.MEET_HIST(), (0, /*()*/__C.loadList)(__C.model.consts.MEET_HIST()).filter((x) => !x || x.url !== url));
          (0, /*()*/__C.saveList)(__C.model.consts.MEET_MARKS(), (0, /*()*/__C.loadList)(__C.model.consts.MEET_MARKS()).filter((x) => !x || x.url !== url));
          renderLobbyList();
          return;
        }
        const item = e.target.closest('.lob-item');
        if (item) enterMeeting(item.getAttribute('data-url'));
      });
    }
    function paintLobbyAppear() {
      const me = GifOS.store.identity();
      const input = document.getElementById('lob-name-in');
      if (input && document.activeElement !== input) input.value = me.name || '';
      paintAppearFace(document.getElementById('lob-face'), input ? input.value : me.name, me.avatar);
      const pvFace = document.getElementById('lob-pv-face');
      if (pvFace) paintAppearFace(pvFace, input ? input.value : me.name, me.avatar);
      const legacy = document.getElementById('lob-name');
      if (legacy) legacy.textContent = me.name || '…';
    }
    function showLobby() {
      document.title = (__C.model.consts.BC_INTENT() ? 'Broadcast' : 'Meeting') + ' — GifOS';
      // The Broadcast app opens the broadcast page with no room: same lobby,
      // reworded. Creating one mints the same admin room on the broadcast page,
      // whose address is the link. A blank room password leaves the link open. Schedule is later.
      // The host password is minted and kept on this device; More shows it.
      if (__C.model.consts.BC_INTENT()) {
        document.querySelector('#lobby h1').textContent = (0, /*()*/__C.uiText)('bcTitle', 'Broadcast');
        const quiet = document.getElementById('lob-quiet');
        if (quiet) {
          quiet.setAttribute('data-t', 'bcLobbyQuiet');
          quiet.textContent = (0, /*()*/__C.uiText)('bcLobbyQuiet', 'Name your broadcast, then go live.');
        }
        document.getElementById('lob-admin-btn').style.display = 'none';
        const openPanel = document.getElementById('lob-open-panel');
        if (openPanel) openPanel.style.display = 'none';
        const openSegEl = document.getElementById('lob-open-seg');
        if (openSegEl) openSegEl.style.display = 'none';
        const welcome = document.getElementById('lob-welcome');
        if (welcome) welcome.style.display = 'none';
        const segNote = document.getElementById('lob-seg-note');
        if (segNote) segNote.hidden = true;
        const nm = document.getElementById('lob-admin-name');
        nm.placeholder = (0, /*()*/__C.uiText)('bcNamePh', 'Name (optional)');
        const passNote = document.getElementById('lob-guest-pass-note');
        if (passNote) {
          passNote.setAttribute('data-t', 'bcRoomPwNote');
          passNote.textContent = (0, /*()*/__C.uiText)('bcRoomPwNote', 'Leave blank and anyone with the link can watch.');
        }
        const goLive = document.getElementById('lob-go');
        if (goLive) {
          goLive.setAttribute('data-t', 'bcGoLive');
          goLive.textContent = (0, /*()*/__C.uiText)('bcGoLive', 'Go live');
        }
        document.getElementById('lob-bc').hidden = false;
        document.getElementById('lob-bc-sched').hidden = false;
        const watch = document.getElementById('lob-join-btn');
        watch.textContent = (0, /*()*/__C.uiText)('bcWatchLink', 'Watch a link');
        document.getElementById('lob-empty').textContent = (0, /*()*/__C.uiText)('bcLobbyEmpty', 'Broadcasts you start or watch show up here.');
        const watchNote = document.getElementById('lob-watch-note');
        if (watchNote) { watchNote.hidden = false; watchNote.textContent = BC_WATCH_COPY; }
        // More on the picture opens Watch and the host password (Q49).
        const deskMore = document.getElementById('lob-desk-more');
        if (deskMore) deskMore.hidden = false;
      }
      paintLobbyAppear();
      renderLobbyList();
      wireLobby();
      if (__C.model.consts.BC_INTENT()) {
        document.getElementById('lob-admin').style.display = '';
        document.getElementById('lobby').classList.add('form-open', 'service-ready');
        const key = document.getElementById('lob-admin-pass');
        if (key && !key.value) key.value = (0, /*()*/__C.mintHostKey)();
      }
      document.getElementById('lobby').classList.add('show');
      // No camera until a tap asks for it: the preview paints the join (off).
      const pvName = document.getElementById('lob-preview-name');
      if (pvName) pvName.textContent = (0, /*()*/__C.myName)();
      // Go live is the broadcast's camera choice; its lobby has no switches.
      const avRow = document.getElementById('lob-av');
      if (avRow) avRow.hidden = !!__C.model.consts.BC_INTENT();
      paintLobbyAv();
      placeDeskName();
    }
    // On a phone Go live the form covers the picture. Sit the sentence in
    // that form, just above Go live. Go live lives in the tab panel.
    function placeClearLine() {
      const note = document.getElementById('lob-pv-note');
      const preview = document.getElementById('lob-preview');
      if (!note || !preview) return;
      const putBack = () => { if (note.parentElement !== preview) preview.appendChild(note); };
      if (!note.classList.contains('lob-pv-clear')) { putBack(); return; }
      let bc = false;
      try { bc = !!__C.model.consts.BC_INTENT(); } catch (e) {}
      const go = document.getElementById('lob-go');
      const parent = go && go.parentElement;
      if (!bc || !parent) { putBack(); return; }
      const gr = go.getBoundingClientRect();
      const pr = preview.getBoundingClientRect();
      const over = gr.height > 1 && gr.left < pr.right - 8 && gr.right > pr.left + 8 && gr.top < pr.bottom && gr.bottom > pr.top;
      if (!over) { putBack(); return; }
      if (note.parentElement !== parent) parent.insertBefore(note, go);
    }
    function placeDeskName() {
      const lob = document.getElementById('lobby');
      if (!lob || !lob.classList.contains('service-ready')) return;
      const name = document.getElementById('lob-admin-name');
      const preview = document.getElementById('lob-preview');
      if (!name || !preview) return;
      const face = preview.getBoundingClientRect();
      const screen = lob.getBoundingClientRect();
      if (face.height >= screen.height - 2 && face.top <= screen.top + 1) {
        name.style.top = '';
        return;
      }
      const card = lob.querySelector('.lobby-card');
      if (!card) return;
      const next = Math.round(card.getBoundingClientRect().top - name.offsetHeight - 12);
      if (next > 88) name.style.top = next + 'px';
      else name.style.top = '';
    }
    yield 1672;

    // ---- boot ------------------------------------------------------------------
    // Camera trouble must never lock anyone out of the room: no permission →
    // join view-only. The room doesn't care what you bring.
    //
    // THE KNOCK WAITS FOR NOBODY (2026-08-05). getUserMedia used to gate
    // joinRoom(): on a desktop the prompt settles in seconds either way, so
    // the ordering looked harmless — but a permission prompt is allowed to
    // NEVER settle. iOS leaves it pending until a human decides, and a link
    // opened inside another app's in-app viewer can hang it indefinitely — and
    // a joiner wedged there never sends the FIRST entry frame. The monitor
    // bot watched three straight hours of demo-night join attempts in which
    // not one knock reached the room (door counters frozen end to end) while
    // phones sat on a page that looked like it was connecting. View-only join
    // is already a fully supported state — a denied camera lands there — so
    // the entry dance and the camera have no ordering dependency at all:
    // knock NOW, and media attaches whenever it lands, through the same
    // transceiver path lateMedia uses for a camera granted mid-call.
    // The tab's title, and a service's share words, once the page is in its room (bootIntoRoom).
    function paintRoomTitle() {
      document.title = __C.model.room.BROADCAST() ? 'Broadcast — GifOS' : 'Meeting — GifOS';
      if (__C.model.room.BROADCAST()) {
        const hint = document.querySelector('.share .hint');
        if (hint) hint.textContent = 'Share this link — anyone who opens it is watching:';
      }
    }
    // Why the status line is up (data-why: the live badge reads it).
    function paintStatusWhy(why) { statusEl.dataset.why = why; }
    function showShareLink() { share.classList.add('show'); }
    yield 1682;
    // A solo link names a file in THIS browser's store. Opened anywhere else
    // (another phone, another browser, another host) there is nothing to run,
    // and the solo chrome hides the status line — so say it on a page of its
    // own, with the way Home. Never a room: this page opens no socket.
    function showAppMissing(title, body) {
      const el = document.getElementById('appmissing');
      el.querySelector('h1').textContent = title;
      el.querySelector('p').textContent = body;
      el.querySelector('a').textContent = (0, /*()*/__C.uiText)('appMissingHome', 'Go to Home Screen');
      el.hidden = false;
      document.body.classList.add('app-missing');
      document.title = title + ' — GifOS';
      try { el.querySelector('a').focus(); } catch (e) {}
    }
    function hideAppMissing() {
      document.getElementById('appmissing').hidden = true;
      document.body.classList.remove('app-missing');
    }
    yield 1689; // only an app room runs it
    function paintAppRoomBody() { document.body.classList.add('app-room'); }
    yield 1693;
    // Solo → shared: mint the room (stable per file — re-inviting reuses the
    // same link), flip the page's traits in place, and host the app on the
    // room's lane. The owned/resilient choice IS the succession class:
    // owned rooms freeze when the owner leaves; resilient rooms heal.
    // "Share <app> live": who may host it while I am away and, for an app that already has a link, keep that link or
    // start a fresh one. The choice goes to go(owned, fresh).
    function openShareLiveModal(nm, saved, go) {
      const bg = document.createElement('div'); bg.className = 'name-modal';
      bg.innerHTML = '<div class="name-box" style="max-width:440px;text-align:left"><h3>Share ' + (0, /*()*/__C.esc)(nm) + ' live</h3>' +
        '<p>Friends join you with one link. If you drop off (close the tab, lose battery)…</p>' +
        '<label class="perm-row"><input type="radio" name="rmcls" value="owned"' + (!saved || saved.owned ? ' checked' : '') + '><span><b>Only I can host it</b> — the app pauses for everyone until I return. Safest for private data.</span></label>' +
        '<label class="perm-row"><input type="radio" name="rmcls" value="heal"' + (saved && !saved.owned ? ' checked' : '') + '><span><b>Let a friend keep it going</b> — someone still connected takes over hosting. Best for casual shared apps and games.</span></label>' +
        (saved
          ? '<p style="margin-top:.9rem"><b>This app already has a link</b> — friends you invited before may still hold it.</p>' +
            '<label class="perm-row"><input type="radio" name="rmlink" value="same" checked><span><b>Keep the same link</b> — everyone you already invited can come right back.</span></label>' +
            '<label class="perm-row"><input type="radio" name="rmlink" value="fresh"><span><b>Start a fresh link</b> — the old link goes dead for good. For when it reached someone it shouldn’t have.</span></label>'
          : '') +
        '<div style="display:flex;gap:.6rem;justify-content:flex-end;margin-top:1rem"><button id="inv-cancel">Cancel</button><button id="inv-go">Create link</button></div></div>';
      document.body.appendChild(bg);
      bg.querySelector('#inv-cancel').onclick = () => bg.remove();
      bg.querySelector('#inv-go').onclick = () => {
        const owned = bg.querySelector('input[name="rmcls"]:checked').value === 'owned';
        const fresh = !!(saved && bg.querySelector('input[name="rmlink"][value="fresh"]').checked);
        bg.remove();
        go(owned, fresh);
      };
    }
    yield 1695;
    // THE HEADER'S INVITE is the same slot in every app. Solo: mint the
    // room, unless this app set capabilities.multiplayer to false: then
    // the button stays hidden and inviteFromSolo refuses. App room: only
    // its owner has Invite (the stored <fileId>::room owner, which survives
    // a reload), and it reopens that room's link.
    // An app-room guest has no Invite. Meeting, including an app running
    // inside one: the meeting's link, for everyone here. An app inside a
    // meeting never mints a room.
    // ALONE IN A MEETING (the line's named state 'alone', seated): a card says
    // so and offers one action, Invite people (the header's Invite sheet). It
    // leaves the moment someone else is here. A broadcast, an app room and a
    // solo app have their own first screens.
    function paintAloneCard() {
      const card = document.getElementById('alonecard');
      if (!card) return;
      const inv = document.getElementById('appinvite');
      const seat = (0, /*()*/__C.meshSeat)();
      const on = !__C.aloneCardShut && !!(statusEl.dataset && statusEl.dataset.state === 'alone') && !!(seat && seat.state === 3)
        && !__C.model.room.BROADCAST() && !__C.ROOM.solo && __C.ROOM.kind !== 'app' && !document.body.classList.contains('app-room')
        && !!inv && inv.style.display !== 'none' && !(0, /*()*/__C.leftDialogUp)();
      if (card.hidden === on) card.hidden = !on;
    }
    (function () {
      const go = document.getElementById('alonecard-go');
      const x = document.getElementById('alonecard-x');
      if (go) go.onclick = () => { const inv = document.getElementById('appinvite'); if (inv) inv.click(); };
      if (x) x.onclick = () => {
        __C.act.surface({ aloneCardShut: true });
        try { sessionStorage.setItem('gifos_alone_card', 'shut'); } catch (e) {}
        paintAloneCard();
      };
    })();
    function paintInviteSlot() {
      const btn = document.getElementById('appinvite');
      if (!btn) return;
      let show = false;
      if (__C.ROOM.solo) show = __C.model.chat.soloShare() === true;
      else if (__C.ROOM.kind === 'app' && __C.ROOM.founder) show = true;
      else if (!document.body.classList.contains('app-room')) {
        const kind = (statusEl && statusEl.dataset && statusEl.dataset.kind) || '';
        const hostHere = __C.model.room.BROADCAST()
          && (((typeof __C.bcHostStored === 'function' && (0, /*()*/__C.bcHostStored)()) || document.body.classList.contains('amadmin')));
        const hostAlone = !!(hostHere && kind === 'alone');
        const phoneAlone = kind === 'alone' && phoneLayout();
        // A meeting keeps Invite while an app is shared. Hiding it here
        // replaced the OS slot with the app bar (Help / Hide / Stop) and
        // left guests with no way to share the meeting link.
        if (__C.model.room.BROADCAST()) show = !document.body.classList.contains('has-app') && (hostAlone || phoneAlone);
        else show = true;
        // A person held in the waiting room is not in the meeting yet: no
        // Invite until they are admitted (the line says "In the waiting room").
        if (show && typeof __C.iAmWaiting === 'function' && (0, /*()*/__C.iAmWaiting)()) show = false;
      }
      btn.style.display = show ? '' : 'none';
      const tip = (__C.ROOM.kind === 'app' || document.body.classList.contains('app-room'))
        ? 'barInviteTip'
        : (__C.model.room.BROADCAST())
          ? 'Invite someone to this broadcast — one link'
          : 'invTip';
      if (tip === 'invTip' || tip === 'barInviteTip') {
        btn.setAttribute('data-ti', tip);
        const words = (0, /*()*/__C.uiText)(tip, tip === 'invTip' ? 'Friends join you live with one link' : 'Share this app live — friends join with one link');
        if (words) btn.title = words;
      } else btn.title = tip;
      const label = (0, /*()*/__C.uiText)('invite', 'Invite');
      if (show && btn.textContent !== label && !btn.dataset.copied) btn.textContent = label;
    }
    // Header chrome from the foreground app's manifest. Meet's page wears
    // the choice Meet declares (capabilities.header = auto-hide). A running
    // app's manifest replaces it until the app stops. Not a setting.
    function applyHeaderChoice(choice) {
      const bar = document.getElementById('appbar');
      if (!bar || !GifOS.runtime || !GifOS.runtime.headerChoice) return;
      const picked = GifOS.runtime.headerChoice({ capabilities: { header: choice } });
      if (picked === 'auto-hide') { bar.dataset.hide = 'auto'; delete bar.dataset.header; }
      else if (picked === 'larger') { delete bar.dataset.hide; bar.dataset.header = 'larger'; }
      else { delete bar.dataset.hide; delete bar.dataset.header; }
    }
    yield 1703;
    document.getElementById('appinvite').onclick = () => {
      if (__C.ROOM.solo) {
        // THE deferred preflight gate (see the top of this file): a solo app
        // never saw the too-old wall at load, so the Share-live button — the
        // solo entry's first and only network act — is where a browser that
        // cannot meet finds out, over a still-working app.
        const P = window.GifOSPreflight;
        if (P && typeof P.requireMeeting === 'function') P.requireMeeting(__C.inviteFromSolo);
        else (0, /*()*/__C.inviteFromSolo)();
        return;
      }
      // App room, a meeting (alone or with people), and an app inside a
      // meeting: the same Invite sheet. showInviteModal keeps "a room you
      // run" off an app room and off a room that already has a host.
      share.classList.add('show');
      showInviteModal();
    };
    yield 1705;
    function paintAppGifFromLane() {
      if (!appGifUrl && __C.appClientCtl && __C.appClientCtl.gifBytes) {
        try { const b = __C.appClientCtl.gifBytes(); if (b) setAppGif(b, document.getElementById('appname').textContent); } catch (e) {}
      }
    }
    function paintCallOn() { document.body.classList.add('call-on'); }
    // The banner over a quiet app room: how many people are on its call (0 hides it).
    function paintCallBanner(live) {
      const b = document.getElementById('callbanner');
      if (live > 0) {
        document.getElementById('callbanner-txt').textContent = live + (live === 1 ? ' person is' : ' people are') + ' on the call in this room';
        b.style.display = 'flex';
      } else b.style.display = 'none';
    }
    document.getElementById('callbanner-join').onclick = () => {
      __C.act.surface({ callOn: true }); paintCallOn();
      document.getElementById('callbanner').style.display = 'none';
      (0, /*()*/__M.lateMedia)('mic'); // asks for mic+cam permission; joins quiet-camera, live mic
    };
    yield 1710;
    function bootMeetSession() {
      // A session frame waits for its parent. The lobby would open a camera
      // preview, and a hash with no room would too. Neither may run here.
      document.body.classList.add('meet-session');
      window.__gifosMeetBoot = true;
    }
    yield 1720; // byId -> receiver clock when their next line is due (slowBlocks)
    // What happened to my lines and to the lines slow mode kept out, in the
    // debug record (Settings → Debug logging): sent, held for slow mode,
    // refused, or dropped on arrival. Ids and authors only, never the text.
    function chatTrace(ev, m) {
      if (!__C.DEBUG_ON || typeof window === 'undefined') return;
      const r = window.__chatTrace || (window.__chatTrace = []);
      r.push({ t: Date.now(), ev: ev, id: m && m.id ? String(m.id).slice(0, 24) : null, by: m && m.byId ? String(m.byId).slice(0, 12) : null });
      if (r.length > 300) r.splice(0, r.length - 300);
    }
    yield 1743;
    let lastChatLine = null;
    let mentionAlert = null;
    yield 1746;
    let pendingReply = null;
    yield 1757;
    function paintReply() {
      const bar = document.getElementById('chatreply');
      if (!bar) return;
      bar.hidden = !pendingReply;
      const by = document.getElementById('chatreply-by');
      const txt = document.getElementById('chatreply-txt');
      if (by) by.textContent = pendingReply ? pendingReply.by : '';
      if (txt) txt.textContent = pendingReply ? pendingReply.text : '';
    }
    yield 1759;
    function paintChatBadge() {
      const b = document.getElementById('chatbadge');
      const note = document.getElementById('chatnote');
      const by = document.getElementById('chatpreview-by');
      const txt = document.getElementById('chatpreview-txt');
      const preview = document.getElementById('chatpreview');
      if (!b || !note) return;
      const lob = document.getElementById('lobby');
      const inCall = !(lob && lob.classList.contains('show'));
      const open = !!(chatPanel && chatPanel.classList.contains('open'));
      const show = inCall && (__C.unread > 0 || !!__C.reactAlert) && !open;
      const mention = !!(mentionAlert && !open);
      if (preview) preview.classList.toggle('mention', mention);
      if (preview) preview.classList.toggle('reacted', !mention && !!__C.reactAlert && !open);
      if (mention) {
        if (by) by.textContent = mentionAlert.by + ' mentioned you';
        if (txt) txt.textContent = mentionAlert.text;
        if (preview) preview.setAttribute('aria-label', mentionAlert.by + ' mentioned you. ' + mentionAlert.text + '. Open chat.');
      } else if (__C.reactAlert && !open) {
        if (by) by.textContent = __C.reactAlert.e + ' ' + __C.reactAlert.short;
        if (txt) txt.textContent = __C.reactAlert.text;
        if (preview) preview.setAttribute('aria-label', __C.reactAlert.by + ' reacted ' + __C.reactAlert.e + ' to ' + __C.reactAlert.text + '. Open chat.');
      } else {
        if (by) by.textContent = lastChatLine ? lastChatLine.by : '';
        if (txt) txt.textContent = lastChatLine ? lastChatLine.text : '';
        if (preview && lastChatLine) preview.setAttribute('aria-label', lastChatLine.by + ' said ' + lastChatLine.text + '. Open chat.');
      }
      b.textContent = __C.unread > 99 ? '99+' : String(Math.max(0, __C.unread));
      b.setAttribute('aria-label', 'Chat, ' + __C.unread + (__C.unread === 1 ? ' new message' : ' new messages'));
      b.hidden = !show || __C.unread < 1;
      note.hidden = !show;
      const key = (note.hidden ? '0' : '1') + ':' + note.offsetWidth + ':' + note.offsetHeight;
      if (key !== paintChatBadge.key) {
        paintChatBadge.key = key;
        try { layout(); } catch (e) {}
      }
    }
    function countClosedChat(m) {
      if (m) { lastChatLine = { by: String(m.by || 'Someone').slice(0, 40), text: String(m.text || '').slice(0, 160) }; }
      const open = !!(chatPanel && chatPanel.classList.contains('open'));
      // A mention of this person stays on the call until they open chat.
      // A later line must not hide it. Naming someone else is an ordinary preview.
      if (m && !open && m.byId !== __C.model.me.myId() && (0, /*()*/__C.messageMentionsMe)(m.text)) {
        mentionAlert = { by: lastChatLine.by, text: lastChatLine.text };
      }
      if (open) return;
      paintChatBadge();   // the core counted it (chatUnseen)
    }

    const chatPanel = document.getElementById('chatpanel');
    const chatBtn = document.getElementById('chatbtn');
    function paintChatBtn() {
      if (!chatBtn) return;
      const open = !!(chatPanel && chatPanel.classList.contains('open'));
      chatBtn.classList.toggle('on', open);
      // The word stays Chat; the unread count is the badge (paintChatCount).
      const label = (0, /*()*/__C.uiText)('chat', 'Chat');
      const word = chatBtn.querySelector('.docklab');
      if (word && word.textContent !== label) word.textContent = label;
      try { paintChatCount(); } catch (e) {}
    }
    const fmtSize = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n > 1024 ? (n / 1024 | 0) + ' KB' : n + ' B';
    yield 1802;
    // A reader who scrolled up stays there. The log used to jump to the bottom
    // on every line. A hidden panel is not rebuilt; opening it paints once.
    function paintChatNew(stick) {
      const b = document.getElementById('chatnew');
      if (b) b.hidden = !!stick;
    }
    yield 1804;
    function chatPanelOpen() { return !!(chatPanel && chatPanel.classList.contains('open')); }
    function transcriptShown() {
      const w = document.getElementById('trwrap');
      return !!(w && w.classList.contains('show'));
    }
    yield 1811;
    function paintMentions() {
      const box = document.getElementById('chatmentions');
      const inp = document.getElementById('chat-in');
      if (!box || !inp) return;
      const caret = inp.selectionStart == null ? inp.value.length : inp.selectionStart;
      const tok = (0, /*()*/__C.mentionToken)(inp.value, caret);
      if (!tok) { box.hidden = true; box.textContent = ''; return; }
      const people = __C.model.chat.people().filter((n) => n.toLowerCase().indexOf(tok.query) >= 0).slice(0, 6);
      if (!people.length) { box.hidden = true; box.textContent = ''; return; }
      box.hidden = false;
      box.textContent = '';
      for (const name of people) {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'option');
        b.textContent = name;
        box.appendChild(b);
      }
    }
    function chatQuery() {
      const q = document.getElementById('chatq');
      return q ? String(q.value || '').trim().toLowerCase() : '';
    }
    function paintChatFind() {
      const q = document.getElementById('chatq');
      const clear = document.getElementById('chatqclear');
      const text = q ? String(q.value || '').trim() : '';
      if (clear) clear.hidden = !text;
      // Sideways, Find steps aside while the keyboard is up. The title is
      // still on screen, so it says the log is cut down.
      const title = document.getElementById('paneltitle');
      if (title && !transcriptShown()) title.textContent = text ? 'Lines with “' + text + '”' : (__C.model.room.BROADCAST() ? 'Broadcast chat' : (0, /*()*/__C.uiText)('chatTitle', 'Meeting chat'));
    }
    function renderChat() {
      if (!chatPanelOpen() || transcriptShown()) return;
      const log = document.getElementById('chatlog');
      const q = chatQuery();
      const all = Array.from(__C.model.chat.lines().values()).sort((a, b) => a.at - b.at);
      // With nothing typed, the newest 200 are the log. A search looks
      // through the lines this browser still holds, not only the ones on screen.
      const ms = (q
        ? all.filter((m) => (String(m.text || '') + ' ' + String(m.by || '')).toLowerCase().indexOf(q) >= 0)
        : all).slice(-200);
      let html = ms.map((m) => {
        const allowLinks = (0, /*()*/__C.linksAllowed)(m.byId);
        const showReact = (0, /*()*/__C.viewerMayReact)();
        const body = (allowLinks && m.link)
          ? (0, /*()*/__C.withMentions)(m.text, true) + ' <a href="' + (0, /*()*/__C.esc)(m.link) + '" style="color:inherit;font-weight:700;text-decoration:underline">Join →</a>'
          : (0, /*()*/__C.withMentions)(m.text, allowLinks);
        // The signed-in admin moderates line by line: the standard row-delete
        // glyph mints a signed 'cdel' (see the #chatlog click delegate).
        const del = __C.amAdmin ? '<button class="row-del" data-cdel="' + (0, /*()*/__C.esc)(m.id) + '" title="Delete this message for everyone">' + __C.model.consts.DEL_ICON() + '</button>' : '';
        const when = __C.model.chat.when(m.at);
        const stamp = when ? '<small class="cwhen">' + (0, /*()*/__C.esc)(when) + '</small>' : '';
        const who = '<span class="cwho"><b>' + (typeof __C.avatarChip === 'function' ? ((0, /*()*/__C.avatarChip)(m.byId) || '') : '') + (0, /*()*/__C.esc)(m.by) + (m.prayer ? ' <span class="praytag">Prayer</span>' : '') + '</b>' + stamp + '</span>';
        const quote = (m.reply && m.reply.text)
          ? '<blockquote class="cquote"><b>' + (0, /*()*/__C.esc)(m.reply.by || '') + '</b><span>' + (0, /*()*/__C.esc)(m.reply.text) + '</span></blockquote>'
          : '';
        const attr = String(m.id).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const replyBtn = '<button type="button" class="creply" data-reply="' + attr + '">Reply</button>';
        const ownDel = m.byId === __C.model.me.myId() ? '<button type="button" class="cdel" data-own-del="' + attr + '">Delete</button>' : '';
        const per = __C.model.chat.reacts().get(m.id);
        const chips = per && per.size
          ? '<div class="cchips">' + __C.model.consts.REACTS().filter((e) => per.has(e)).map((e) => {
            const who = per.get(e);
            const mineR = who.has(__C.model.me.myId());
            return '<button type="button" class="cchip" data-react-chip="' + e + '" data-react-id="' + attr + '" aria-pressed="' + mineR + '" aria-label="' + e + ' ' + who.size + ': ' + (0, /*()*/__C.esc)((0, /*()*/__C.reactorNames)(who)) + '">' + e + '<span>' + who.size + '</span></button>';
          }).join('') + '</div>'
          : '';
        // Your own line takes a reaction too ("👍 if Tuesday works").
        const reactBtn = showReact ? '<button type="button" class="creact" data-react-open="' + attr + '" aria-expanded="' + (__C.reactOpen === m.id) + '">React</button>' : '';
        const open = __C.lineOpen === m.id || __C.reactOpen === m.id;
        const whoR = open && per && per.size
          ? '<div class="cwhorx">' + __C.model.consts.REACTS().filter((e) => per.has(e)).map((e) => '<span>' + e + ' ' + (0, /*()*/__C.esc)((0, /*()*/__C.reactorNames)(per.get(e))) + '</span>').join('') + '</div>'
          : '';
        const acts = open ? '<div class="cacts">' + replyBtn + reactBtn + ownDel + '</div>' : '';
        const picks = showReact && __C.reactOpen === m.id
          ? '<div class="cpicks">' + __C.model.consts.REACTS().map((e) => '<button type="button" class="cpick" data-react-pick="' + e + '" data-react-id="' + attr + '" aria-label="React ' + e + '">' + e + '</button>').join('') + '</div>'
          : '';
        return '<div class="cmsg' + (m.byId === __C.model.me.myId() ? ' mine' : '') + (m.prayer ? ' prayer' : '') + '" data-line="' + attr + '" tabindex="0" aria-expanded="' + open + '" title="Tap for Reply and React">' + who + quote + '<span class="cbody">' + body + '</span>' + chips + whoR + acts + del + picks + '</div>';
      }).join('');
      const co = __C.model.chat.off();
      if (q && !ms.length) html = '<div class="cempty" id="chatnomatch">No matches</div>';
      else if (co && !q) {
        const line = co.by
          ? (0, /*()*/__C.uiText)('chatWasOffBy', 'Chat was turned off by {name}.').split('{name}').join((0, /*()*/__C.esc)(co.by))
          : (0, /*()*/__C.uiText)('chatWasOff', 'Chat was turned off.');
        const tail = __C.amAdmin ? '' : (' ' + (0, /*()*/__C.uiText)('chatHostOnly', 'Only the host can post.'));
        html += '<div class="cmsg" style="opacity:.65"><b>🔇</b>' + line + tail + '</div>';
      }
      paintChatFind();
      (0, /*()*/__C.paintLog)(log, html);
      // A tapped last line grows by its buttons; keep them in the log.
      if (__C.lineOpen) {
        const el = Array.from(log.querySelectorAll('.cmsg[data-line]')).find((x) => x.getAttribute('data-line') === __C.lineOpen);
        if (el && el.scrollIntoView) try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {}
      }
    }
    yield 1816;
    (function () {
      const q = document.getElementById('chatq');
      const clear = document.getElementById('chatqclear');
      if (!q || !clear) return;
      q.addEventListener('input', () => renderChat());
      // The Search key ends the search and drops the keyboard; the filter stays.
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); q.blur(); } });
      clear.onclick = () => { q.value = ''; renderChat(); try { q.focus(); } catch (e) {} };
    })();
    // The chat gate: repainted on every mod merge and admin-state flip. The
    // admin keeps a live input while chat is off (announcements still flow);
    // everyone else's composer locks, with the reason in the placeholder.
    let chatGateOverride = null; // chatGateForTest: { off, admin } stands in for the signed switch
    function paintChatGate() {
      const off = chatGateOverride ? !!chatGateOverride.off : !!__C.model.chat.off();
      const locked = off && !(chatGateOverride ? chatGateOverride.admin : __C.amAdmin);
      const inp = document.getElementById('chat-in');
      inp.disabled = locked;
      const pb = document.getElementById('pray');
      if (pb) {
        pb.hidden = !(0, /*()*/__C.prayOn)();
        if (pb.hidden) pb.setAttribute('aria-pressed', 'false');
      }
      const praying = !!pb && !pb.hidden && pb.getAttribute('aria-pressed') === 'true';
      // Short enough to read whole in the box beside Send.
      inp.placeholder = locked ? (0, /*()*/__C.uiText)('chatOff', 'Chat is off for now')
        : (off ? (0, /*()*/__C.uiText)('chatOffHost', 'Chat is off for guests') : (praying ? 'Prayer request…' : (0, /*()*/__C.uiText)('chatPlaceholder', 'Message everyone…')));
      document.querySelector('#chatform button[type="submit"]').disabled = locked;
      const attach = document.getElementById('cattach');
      if (attach) {
        // Open rooms have no files. An admin room keeps the button so a click can say why.
        attach.hidden = !(0, /*()*/__C.hasAdminRoom)();
        attach.disabled = locked;
      }
      document.body.classList.toggle('chat-qa-on', __C.model.chat.qaOn() && (0, /*()*/__C.hasAdminRoom)() && !__C.model.room.BROADCAST());
      document.body.classList.toggle('qa-chat-off', (0, /*()*/__C.hasAdminRoom)() && __C.model.room.BROADCAST() && !__C.model.chat.qaOn());
      const b = document.getElementById('chatmod');
      b.style.display = ((0, /*()*/__C.hasAdminRoom)() && __C.amAdmin) ? '' : 'none';
      b.textContent = off ? (0, /*()*/__C.uiText)('chatModOn', 'Turn chat on') : (0, /*()*/__C.uiText)('chatModOff', 'Turn chat off');
      b.title = off ? (0, /*()*/__C.uiText)('chatModTipOn', 'Let everyone post in chat again') : (0, /*()*/__C.uiText)('chatModTipOff', 'Silence the chat for everyone but you');
      paintChatOptions();
    }
    // Room admin → Chat options: the room's chat switches in one place.
    function paintChatOptions() {
      const sec = document.getElementById('adm-chat');
      const g = document.getElementById('adm-chat-guests');
      if (sec) sec.hidden = !(0, /*()*/__C.hasAdminRoom)();
      if (!g || !(0, /*()*/__C.hasAdminRoom)()) return;
      g.checked = !__C.model.chat.off();
      document.getElementById('adm-chat-pray').checked = (0, /*()*/__C.prayOn)();
      document.getElementById('adm-chat-files-sub').textContent = __C.model.door.roomPw()
        ? (0, /*()*/__C.uiText)('admChatFilesOn', 'Allowed: this room has a password.')
        : (0, /*()*/__C.uiText)('admChatFilesOff', 'Only once the room has a password.');
      document.getElementById('adm-chat-pw').disabled = !__C.amAdmin;
      const gf = document.getElementById('adm-chat-gfile');
      if (gf) { gf.checked = (0, /*()*/__C.modStarOn)('gfile', false); gf.disabled = !__C.model.door.roomPw(); }
      const gr = document.getElementById('adm-chat-greact');
      if (gr) gr.checked = __C.model.chat.mayReact();
      const qa = document.getElementById('adm-chat-qa');
      if (qa) qa.checked = __C.model.chat.qaOn();
      const hi = document.getElementById('adm-chat-chist');
      if (hi) hi.checked = (0, /*()*/__C.lateJoinerSeesHistory)();
      const sl = document.getElementById('adm-chat-slow');
      if (sl) sl.checked = (0, /*()*/__C.slowModeOn)();
      const lk = document.getElementById('adm-chat-clink');
      if (lk) lk.checked = (0, /*()*/__C.chatLinksOn)();
      try { paintAiNotesAdmin(); } catch (e) {}
    }
    document.getElementById('chatmod').onclick = () => {
      (0, /*()*/__C.setMod)('*', 'chat', !__C.model.chat.off());
      paintChatGate(); renderChat();
    };
    document.getElementById('adm-chat-guests').onchange = (e) => {
      (0, /*()*/__C.setMod)('*', 'chat', !e.target.checked);
      paintChatGate(); renderChat();
    };
    document.getElementById('adm-chat-pray').onchange = (e) => {
      (0, /*()*/__C.setMod)('*', 'pray', !!e.target.checked);
      paintChatGate();
    };
    document.getElementById('adm-chat-pw').onclick = () => {
      document.getElementById('adm-modal').style.display = 'none';
      document.getElementById('pwbtn').click();
    };
    document.getElementById('adm-chat-gfile').onchange = (e) => { (0, /*()*/__C.setMod)('*', 'gfile', !!e.target.checked); paintChatGate(); };
    document.getElementById('adm-chat-greact').onchange = (e) => { (0, /*()*/__C.setMod)('*', 'greact', !!e.target.checked); paintChatGate(); renderChat(); };
    document.getElementById('adm-chat-qa').onchange = (e) => { (0, /*()*/__C.setMod)('*', 'qa', !!e.target.checked); paintChatGate(); };
    document.getElementById('adm-chat-chist').onchange = (e) => { (0, /*()*/__C.setMod)('*', 'chist', !!e.target.checked); };
    document.getElementById('adm-chat-slow').onchange = (e) => { (0, /*()*/__C.setMod)('*', 'slow', !!e.target.checked); };
    document.getElementById('adm-chat-clink').onchange = (e) => { (0, /*()*/__C.setMod)('*', 'clink', !!e.target.checked); renderChat(); };
    document.getElementById('adm-ai-notes').onchange = (e) => { (0, /*()*/__C.setMod)('*', 'ain', e.target.value === 'off' || e.target.value === 'ask' ? e.target.value : 'allowed'); paintAiNotesAdmin(); };
    document.getElementById('chatlog').addEventListener('scroll', () => {
      const log = document.getElementById('chatlog');
      if ((0, /*()*/__C.logNearBottom)(log)) paintChatNew(true);
    });
    document.getElementById('chatlog').addEventListener('keydown', (e) => {
      if ((e.key !== 'Enter' && e.key !== ' ') || !e.target.matches || !e.target.matches('.cmsg[data-line]')) return;
      e.preventDefault();
      const id = e.target.getAttribute('data-line');
      (0, /*()*/__C.toggleLine)(id);
      const el = Array.from(document.querySelectorAll('#chatlog .cmsg[data-line]')).find((x) => x.getAttribute('data-line') === id);
      if (el) try { el.focus(); } catch (err) {}
    });
    document.getElementById('chatnew').onclick = () => {
      const log = document.getElementById('chatlog');
      log.scrollTop = log.scrollHeight;
      paintChatNew(true);
    };
    document.getElementById('chatlog').addEventListener('click', (e) => {
      const replyBtn = e.target.closest('[data-reply]');
      if (replyBtn) {
        const id = replyBtn.getAttribute('data-reply');
        const src = id ? __C.model.chat.lines().get(id) : null;
        if (!src) return;
        pendingReply = { id: String(src.id).slice(0, 80), by: String(src.by || '').slice(0, 40), text: String(src.text || '').slice(0, 160) };
        paintReply();
        const inp = document.getElementById('chat-in');
        if (inp && inp.focus) inp.focus();
        return;
      }
      const rOpen = e.target.closest('[data-react-open]');
      if (rOpen) {
        const id = rOpen.getAttribute('data-react-open');
        __C.act.surface({ reactOpen: __C.reactOpen === id ? null : id });
        renderChat();
        return;
      }
      const rTap = e.target.closest('[data-react-pick], [data-react-chip]');
      if (rTap) {
        const id = rTap.getAttribute('data-react-id');
        const em = rTap.getAttribute('data-react-pick') || rTap.getAttribute('data-react-chip');
        if (!id || !__C.model.chat.lines().has(id)) return;
        if (!(0, /*()*/__C.viewerMayReact)()) return;
        const per = __C.model.chat.reacts().get(id);
        const on = !(per && per.get(em) && per.get(em).has(__C.model.me.myId()));
        __C.act.surface({ reactOpen: null });
        __C.act.surface({ lineOpen: null });
        if ((0, /*()*/__C.takeReact)(id, em, __C.model.me.myId(), on)) (0, /*()*/__C.sendAll)({ k: 'creact', id: id, e: em, on: on, by: __C.model.me.myId() });
        renderChat();
        return;
      }
      const ownDel = e.target.closest('[data-own-del]');
      if (ownDel) {
        const id = ownDel.getAttribute('data-own-del');
        const src = id ? __C.model.chat.lines().get(id) : null;
        if (!src || src.byId !== __C.model.me.myId()) return;
        if ((0, /*()*/__C.applyOwnDelete)(id, __C.model.me.myId())) {
          (0, /*()*/__C.sendAll)({ k: 'cdel', id: id, own: __C.model.me.myId() });
          renderChat();
        }
        return;
      }
      const b = e.target.closest('[data-cdel]');
      if (!b) {
        // A tap on the words (not a link) shows or hides that line's buttons.
        const line = e.target.closest('.cmsg[data-line]');
        if (line && !e.target.closest('a, button')) (0, /*()*/__C.toggleLine)(line.getAttribute('data-line'));
        return;
      }
      const id = b.getAttribute('data-cdel');
      if (!__C.amAdmin || __C.model.chat.tombs().has(id)) return;
      (0, /*()*/__C.admSigned)('cdel', { id }).then((w) => {
        if (!w) return;
        (0, /*()*/__C.applyCdel)(id, w);
        (0, /*()*/__C.sendAll)({ k: 'cdel', id, w });
        renderChat();
      });
    });
    function renderFiles() {
      const wrap = document.getElementById('cfiles');
      const el = document.getElementById('cfilelist');
      // Files are only allowed in a PASSWORD-PROTECTED meeting. The attach
      // button says so. An empty list does not sit between the messages and Send.
      const fs = Array.from(__C.model.room.files().values()).sort((a, b) => a.at - b.at);
      if (!fs.length) { wrap.hidden = true; el.innerHTML = ''; return; }
      wrap.hidden = false;
      el.innerHTML = fs.map((f) => {
        const mine = (f.byId && f.byId === __C.model.me.myId()) || (!f.byId && f.by === (0, /*()*/__C.myName)());
        // The button follows the receive rule (fdelAllowed): an open room takes
        // anyone's unpin (attributed); an admin room takes the owner's or an admin's.
        const unpin = (!(0, /*()*/__C.hasAdminRoom)() || __C.amAdmin || mine) ? '<button class="row-del" data-del="' + (0, /*()*/__C.esc)(f.id) + '" title="Unpin for everyone">' + __C.model.consts.DEL_ICON() + '</button>' : '';
        return '<div class="cfile" data-f="' + (0, /*()*/__C.esc)(f.id) + '"><span class="nm">' + (0, /*()*/__C.esc)(f.name) + '</span><small>' + fmtSize(f.size) + ' · ' + (0, /*()*/__C.esc)(f.by || '?') + '</small>'
          + (f.bytes ? '<button data-dl="' + (0, /*()*/__C.esc)(f.id) + '">⬇</button>' : '<small>receiving…</small>')
          + unpin + '</div>';
      }).join('');
    }
    document.getElementById('cfilelist').addEventListener('click', (e) => {
      const dl = e.target.dataset.dl, del = e.target.dataset.del;
      if (dl) {
        const f = __C.model.room.files().get(dl); if (!f || !f.bytes) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([f.bytes], { type: f.mime || 'application/octet-stream' }));
        a.download = f.name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      } else if (del) {
        const f = __C.model.room.files().get(del);
        if (!f) return;
        const mine = (f.byId && f.byId === __C.model.me.myId()) || (!f.byId && f.by === (0, /*()*/__C.myName)());
        if ((0, /*()*/__C.hasAdminRoom)() && !(__C.amAdmin || mine)) return; // the same rule as the button and fdelAllowed
        const emit = (w) => {
          const t = { by: (0, /*()*/__C.myName)(), at: Date.now() };
          (0, /*()*/__C.takeTomb)(del, t);
          const msg = { k: 'fdel', id: del, by: t.by, at: t.at };
          if (w) msg.w = w;
          (0, /*()*/__C.sendAll)(msg);
          renderFiles();
        };
        // An admin room's delete is a signed order, same as cdel. The owner
        // of the pin may still unpin their own file without being an admin;
        // receivers accept that only when the frame author is the file's byId.
        if ((0, /*()*/__C.hasAdminRoom)() && __C.amAdmin) (0, /*()*/__C.admSigned)('fdel', { id: del }).then((w) => { if (w) emit(w); });
        else emit(null);
      }
    });
    (function () {
      const row = document.getElementById('emojirow');
      const btn = document.getElementById('cemoji');
      const inp = document.getElementById('chat-in');
      if (!row || !btn || !inp) return;
      let caret = { start: 0, end: 0 };
      const remember = () => {
        caret = {
          start: inp.selectionStart == null ? inp.value.length : inp.selectionStart,
          end: inp.selectionEnd == null ? inp.value.length : inp.selectionEnd,
        };
      };
      inp.addEventListener('input', remember);
      inp.addEventListener('keyup', remember);
      inp.addEventListener('mouseup', remember);
      inp.addEventListener('select', remember);
      inp.addEventListener('focusout', remember);
      btn.onclick = () => {
        const open = row.hidden;
        row.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      row.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || inp.disabled) return;
        const emoji = b.getAttribute('data-emoji');
        if (!emoji) return;
        const start = Math.max(0, Math.min(caret.start, inp.value.length));
        const end = Math.max(start, Math.min(caret.end, inp.value.length));
        inp.value = inp.value.slice(0, start) + emoji + inp.value.slice(end);
        const pos = start + emoji.length;
        caret = { start: pos, end: pos };
        inp.focus();
        try { inp.setSelectionRange(pos, pos); } catch (err) {}
      });
    })();
    yield 1845;
    document.getElementById('chatform').addEventListener('submit', (e) => {
      e.preventDefault();
      if (__C.model.chat.off() && !__C.amAdmin) { (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stTheHostHasTurnedChat', 'The host has turned chat off.')); return; }
      const inp = document.getElementById('chat-in');
      const text = inp.value.trim();
      if (!text) return;
      const prayBtn = document.getElementById('pray');
      const m = { id: (0, /*()*/__C.uid)('m'), by: (0, /*()*/__C.myName)(), byId: __C.model.me.myId(), at: Date.now(), text };
      if ((0, /*()*/__C.prayOn)() && prayBtn && prayBtn.getAttribute('aria-pressed') === 'true') m.prayer = 1;
      if (pendingReply) m.reply = { id: pendingReply.id, by: pendingReply.by, text: pendingReply.text };
      if (!__C.act.postChat(m)) return;   // slow mode already holds as many lines as it keeps: this one stays in the box
      inp.value = '';
      // A search would hide the line you just sent.
      const q = document.getElementById('chatq');
      if (q) q.value = '';
      pendingReply = null;
      paintReply();
      paintMentions();
      renderChat();
    });
    document.getElementById('chatreply-x').onclick = () => {
      pendingReply = null;
      paintReply();
    };
    (function () {
      const inp = document.getElementById('chat-in');
      const box = document.getElementById('chatmentions');
      if (!inp || !box) return;
      const refresh = () => paintMentions();
      inp.addEventListener('input', refresh);
      inp.addEventListener('keyup', refresh);
      inp.addEventListener('click', refresh);
      box.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || inp.disabled) return;
        const name = b.textContent || '';
        const caret = inp.selectionStart == null ? inp.value.length : inp.selectionStart;
        const tok = (0, /*()*/__C.mentionToken)(inp.value, caret);
        if (!tok || !name) return;
        inp.value = inp.value.slice(0, tok.start) + '@' + name + ' ' + inp.value.slice(caret);
        const pos = tok.start + name.length + 2;
        try { inp.focus(); inp.setSelectionRange(pos, pos); } catch (err) {}
        paintMentions();
      });
    })();
    document.getElementById('cattach').onclick = () => {
      if (!(0, /*()*/__C.mayPinFiles)()) { (0, /*()*/__C.setStatus)((0, /*()*/__C.hasAdminRoom)() ? 'Guests cannot send files in this room.' : 'Files are not allowed in this meeting.'); return; }
      document.getElementById('cfile-in').click();
    };
    document.getElementById('cfile-in').addEventListener('change', (e) => {
      if (!(0, /*()*/__C.mayPinFiles)()) { (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stFilesAreNotAllowedHere', 'Files are not allowed here.')); e.target.value = ''; return; }
      for (const file of e.target.files) {
        if (file.size > __C.model.consts.MAX_FILE()) { (0, /*()*/__C.setStatus)(file.name + ' is over the 25 MB pin limit.'); continue; }
        const reader = new FileReader();
        reader.onload = () => {
          const f = { id: (0, /*()*/__C.uid)('f'), name: file.name, size: file.size, mime: file.type, by: (0, /*()*/__C.myName)(), byId: __C.model.me.myId(), at: Date.now(), bytes: new Uint8Array(reader.result) };
          __C.model.room.files().set(f.id, f);
          (0, /*()*/__C.sendAll)({ k: 'fmeta', f: { id: f.id, name: f.name, size: f.size, mime: f.mime, by: f.by, byId: f.byId, at: f.at } });
          renderFiles();
        };
        reader.readAsArrayBuffer(file);
      }
      e.target.value = '';
    });
    function paintChatCount() {
      const n = chatBtn.querySelector('.chatcount');
      // The badge rides the dock button; in More (a phone) the count is #chatbadge.
      const docked = !!(chatBtn.parentElement && chatBtn.parentElement.classList.contains('bar'));
      if (n) {
        if (__C.unread > 0 && docked) { n.hidden = false; n.textContent = __C.unread > 9 ? '9+' : String(__C.unread); }
        else { n.hidden = true; n.textContent = ''; }
      }
      chatBtn.setAttribute('aria-label', __C.unread ? 'Chat, ' + __C.unread + ' new' : 'Chat');
    }
    const prayBtn = document.getElementById('pray');
    if (prayBtn) prayBtn.onclick = () => {
      const on = prayBtn.getAttribute('aria-pressed') !== 'true';
      prayBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      paintChatGate();
    };
    // aria-expanded follows the panel, however it opened or closed.
    chatBtn.setAttribute('aria-controls', 'chatpanel');
    new MutationObserver(() => {
      chatBtn.setAttribute('aria-expanded', chatPanelOpen() ? 'true' : 'false');
      document.body.classList.toggle('chatside', chatPanelOpen());
      if (window.__gifosDock) window.__gifosDock.place();
      // The header's right end moved with the panel: Fit and the hand line follow it.
      try { placeHandq(); } catch (e) {}
    }).observe(chatPanel, { attributes: true, attributeFilter: ['class'] });
    // A log the reader keeps at its newest line stays there when it changes size (the panel docking as a sheet or a
    // column, the keyboard, a turn of the phone). A reader who scrolled up keeps their place.
    if (window.ResizeObserver) {
      try {
        const keep = new ResizeObserver((entries) => {
          let pinned = false;
          for (const en of entries) { const lg = en.target; if (lg._atNewest !== false) { lg.scrollTop = lg.scrollHeight; if (lg.id === 'chatlog') pinned = true; } }
          if (pinned) paintChatNew(true);
        });
        for (const id of ['chatlog', 'trlog']) {
          const lg = document.getElementById(id);
          if (!lg) continue;
          keep.observe(lg);
          lg.addEventListener('scroll', () => { lg._atNewest = (0, /*()*/__C.logNearBottom)(lg); }, { passive: true });
        }
      } catch (e) {}
    }
    chatBtn.setAttribute('aria-expanded', chatPanelOpen() ? 'true' : 'false');
    chatBtn.onclick = () => {
      __C.act.surface({ chatOpen: chatPanel.classList.toggle('open') });
      try { paintChatBtn(); } catch (e) {}
      // renderChat skips while the transcript tab is shown, and the transcript
      // is not painted while the panel is closed: paint the tab that shows.
      if (chatPanel.classList.contains('open')) {
        // the core zeroed unread on the chatOpen fact
        paintChatCount(); if (transcriptShown()) renderTranscript(); else renderChat(); renderFiles();
        // Opening the panel shows the newest lines: nothing is unread once it is open.
        const toNewest = () => { for (const id of ['chatlog', 'trlog']) { const lg = document.getElementById(id); if (lg) lg.scrollTop = lg.scrollHeight; } paintChatNew(true); };
        toNewest(); requestAnimationFrame(toNewest); // again once the opened panel has its height
        try { mentionAlert = null; paintChatBadge(); } catch (e) {}
        try { paintChatBtn(); } catch (e) {}
        // The More sheet floats above the chat (the dock's stacking context).
        // Leave it open and the conversation is hidden behind a grid of buttons.
        // Fold the sheet without rewriting the saved preference.
        const barEl = document.querySelector('.bar');
        const toggle = document.getElementById('bartoggle');
        if (barEl && toggle && !barEl.classList.contains('collapsed')) {
          barEl.classList.add('collapsed');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.setAttribute('aria-label', (0, /*()*/__C.uiText)('more', 'More'));
          toggle.title = (0, /*()*/__C.uiText)('more', 'More');
          const word = toggle.querySelector('.docklab');
          if (word) word.textContent = (0, /*()*/__C.uiText)('more', 'More');
        }
      }
    };
    // ✕ closes like Escape does: the dock refits and the keyboard lands back on Chat.
    document.getElementById('chatclose').onclick = () => closeChatToButton();
    // Closing the chat refits the dock first: beside the open chat Chat may
    // sit in More (placeDock), and focus on a hidden button is dropped.
    function closeChatToButton() {
      chatPanel.classList.remove('open'); __C.act.surface({ chatOpen: false });
      document.body.classList.remove('chatside');
      if (window.__gifosDock) window.__gifosDock.place();
      try { paintChatBtn(); } catch (e) {}
      try { chatBtn.focus(); } catch (err) {}
    }
    document.getElementById('chatbadge').onclick = () => { if (chatBtn) chatBtn.click(); };
    document.getElementById('chatpreview').onclick = () => { if (chatBtn) chatBtn.click(); };
    yield 1863;

    // ---- questions: ask, vote, and the host shows one on the picture --------
    // A hundred people watching can't all raise a hand, and chat buries the
    // question everybody wants asked. Anyone asks; everyone votes; the most
    // votes sit on top; the host (the room's admin) puts one on every
    // viewer's picture with a signed order, so nobody else can.
    const qaPanel = document.getElementById('qa');
    const qaBtn = document.getElementById('qabtn');
    yield 1870;
    function placeQaBand() {
      const band = document.getElementById('bc-q');
      if (!band || band.hidden) return;
      // Under the chip, above the dock and the captions, and around
      // Fit (wherever it sits on this phone): the text wraps beside Fit, and
      // at large type on a small phone it steps down to 18px to fit.
      const rectOf = (sel) => {
        const el = document.querySelector(sel);
        if (!el || el.hidden || !el.getClientRects().length) return null;
        const r = el.getBoundingClientRect();
        return r.width && r.height ? r : null;
      };
      let top = 12;
      for (const sel of ['.topchip', '#livebadge', '#bc-link']) { const r = rectOf(sel); if (r && r.top < innerHeight / 2) top = Math.max(top, Math.ceil(r.bottom) + 8); }
      let floor = innerHeight; // the dock's own top, not --dock-clear: that lags a type-size change by a frame
      for (const sel of ['.bar', '#bc-cap-txt', '#bc-cap-btn']) { const r = rectOf(sel); if (r && r.top > top) floor = Math.min(floor, r.top); }
      floor -= 8;
      const fit = rectOf('#fitbtn');
      const pad = document.getElementById('bc-q-pad'), gap = document.getElementById('bc-q-fit'), txt = document.getElementById('bc-q-txt');
      band.style.top = top + 'px';
      band.style.removeProperty('--qfs'); txt.style.maxHeight = '';
      pad.style.height = gap.style.height = gap.style.width = '0px';
      const wrapFit = () => {
        if (!fit) return;
        const b = band.getBoundingClientRect();
        if (fit.left >= b.right || fit.right <= b.left || fit.top >= b.bottom || fit.bottom <= b.top) return;
        const inTop = b.top + parseFloat(getComputedStyle(band).paddingTop);
        pad.style.height = Math.max(0, Math.floor(fit.top - inTop) - 4) + 'px';
        gap.style.height = Math.ceil(fit.bottom - Math.max(fit.top, inTop) + 8) + 'px';
        gap.style.width = Math.ceil(b.right - fit.left + 8 - parseFloat(getComputedStyle(band).paddingRight)) + 'px';
      };
      wrapFit();
      for (const fs of ['22px', '20px', '18px']) {
        if (band.getBoundingClientRect().bottom <= floor) break;
        band.style.setProperty('--qfs', fs);
        pad.style.height = gap.style.height = gap.style.width = '0px';
        wrapFit();
      }
      const over = band.getBoundingClientRect().bottom - floor;
      if (over > 0) txt.style.maxHeight = Math.max(24, txt.getBoundingClientRect().height - over) + 'px';
      // Cut short (or capped at five lines): the words fade out, and a tap
      // opens Questions, where the whole question reads.
      band.classList.toggle('clip', txt.scrollHeight > txt.clientHeight + 1);
    }
    function paintQaBand() {
      const band = document.getElementById('bc-q');
      if (!band) return;
      const qid = __C.model.chat.qaShownId(), m = qid && __C.model.chat.lines().get(qid);
      if (!m || !m.q || !__C.model.room.BROADCAST()) { band.hidden = true; return; }
      document.getElementById('bc-q-by').textContent = m.by + ' asks';
      document.getElementById('bc-q-txt').textContent = m.text;
      band.hidden = false;
      placeQaBand();
    }
    yield 1873;
    if (window.ResizeObserver) {
      try {
        const ro = new ResizeObserver(() => { try { placeQaBand(); } catch (e) {} });
        for (const sel of ['.topchip', '#fitbtn', '.bar']) { const el = document.querySelector(sel); if (el) ro.observe(el); }
      } catch (e) {}
    }
    function renderQa() {
      const n = __C.model.chat.qaList().length;
      if (qaBtn) qaBtn.textContent = n ? 'Questions (' + n + ')' : 'Questions';
      if (!qaPanel || qaPanel.hidden) return;
      const list = document.getElementById('qa-list');
      const shown = __C.model.chat.qaShownId();
      const qs = __C.model.chat.qaList();
      list.innerHTML = qs.length ? qs.map((q) => {
        const on = q.id === shown;
        return '<div class="qrow' + (on ? ' shown' : '') + '" data-q="' + (0, /*()*/__C.esc)(q.id) + '">'
          + '<button type="button" class="qvote" aria-pressed="' + (q.mine ? 'true' : 'false') + '" aria-label="Vote for this question, ' + q.votes + ' votes" title="Vote this up">▲ <span>' + q.votes + '</span></button>'
          + '<div class="qbody"><p>' + (0, /*()*/__C.esc)(q.text) + '</p><small>' + (0, /*()*/__C.esc)(q.by) + (on ? ' · on the picture' : '') + '</small></div>'
          + (__C.amAdmin ? '<button type="button" class="qshow" aria-pressed="' + (on ? 'true' : 'false') + '" title="' + (on ? 'Take it off the picture' : 'Put it on every viewer\'s picture') + '">' + (on ? 'Hide' : 'Show') + '</button>'
            + '<button type="button" class="row-del qdel" title="Remove this question for everyone">' + __C.model.consts.DEL_ICON() + '</button>' : '')
          + '</div>';
      }).join('') : '<p class="qempty">No questions yet. Ask one below, and vote up the ones you want answered.</p>';
    }
    yield 1876;
    function qaOpen(open) {
      if (!qaPanel) return;
      qaPanel.hidden = !open;
      if (open) {
        const bar = document.querySelector('.bar');
        if (bar && !bar.classList.contains('collapsed')) { const t = document.getElementById('bartoggle'); if (t) t.click(); }
        chatPanel.classList.remove('open'); __C.act.surface({ chatOpen: false });
        renderQa();
      }
    }
    if (qaBtn) qaBtn.onclick = () => qaOpen(qaPanel.hidden);
    document.getElementById('bc-q').onclick = () => qaOpen(true);
    document.getElementById('qa-close').onclick = () => qaOpen(false);
    document.getElementById('qa-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = document.getElementById('qa-in');
      const text = inp.value.trim().slice(0, 280);
      if (!text) return;
      __C.act.qaSend({ id: (0, /*()*/__C.uid)('m'), by: (0, /*()*/__C.myName)(), byId: __C.model.me.myId(), at: Date.now(), text, q: 1 });
      inp.value = '';
    });
    document.getElementById('qa-list').addEventListener('click', (e) => {
      const row = e.target.closest('.qrow'); if (!row) return;
      const qid = row.getAttribute('data-q');
      if (e.target.closest('.qvote')) {
        const q = __C.model.chat.qaList().find((x) => x.id === qid); if (!q) return;
        const v = { id: (0, /*()*/__C.uid)('m'), by: (0, /*()*/__C.myName)(), byId: __C.model.me.myId(), at: Date.now(), text: '', qv: qid };
        if (q.mine) v.qx = 1;
        __C.act.qaSend(v);
      } else if (e.target.closest('.qshow') && __C.amAdmin) {
        const next = __C.model.chat.qaShownId() === qid ? '' : qid;
        (0, /*()*/__C.admSigned)('qshow', { qid: next }).then((w) => {
          if (!w) return;
          const m = { id: (0, /*()*/__C.uid)('m'), by: (0, /*()*/__C.myName)(), byId: __C.model.me.myId(), at: Date.now(), text: '', qs: next, w };
          __C.model.chat.qaShowOk().set(m.id, { qid: next, ts: JSON.parse(w.sp).ts });
          __C.act.qaSend(m);
        });
      } else if (e.target.closest('.qdel') && __C.amAdmin && !__C.model.chat.tombs().has(qid)) {
        (0, /*()*/__C.admSigned)('cdel', { id: qid }).then((w) => {
          if (!w) return;
          (0, /*()*/__C.applyCdel)(qid, w);
          (0, /*()*/__C.sendAll)({ k: 'cdel', id: qid, w });
        });
      }
    });
    yield 1945;

    // ========== STADIUM MEDIA (docs/media-plane.md) ============================
    // Bounded-degree media. A seat holds DIRECT links only to seat.linkPeers()
    // (row-mates + up/down + E2), NOT a section mesh. Everything past the row
    // arrives COMPOSITED, never as direct links: the Stage is a composited \u2264C strip; the
    // Stadium is the nested mosaic (product up \u2192 S1 exchange \u2192 fan down). reconcile-
    // Mosaic (below) wires all four channels; the compOf store holds the feed
    // tiles those composites produce.
    const stadiumEl = document.getElementById('stadium');
    const stagefeedEl = document.getElementById('stagefeed');
    yield 2007;
    const multiSection = () => { const s = (0, /*()*/__C.meshSeat)(); if (!s || !s.hasCoord) return false; for (const k of s.occ.keys()) if (!(k.charCodeAt(0) === 48 && k.charCodeAt(1) === 95)) return true; return false; };
    yield 2236;
    // The stadium tile (one, keyed 'sd') in the stadium strip.
    function paintStadiumTile(stream, quiet) {
      let el = stadiumEl.querySelector('[data-row="sd"]');
      // The mosaic sweep calls this every couple of seconds with the same
      // stream. The gallery is laid out again only when the Stadium tile
      // actually changes (it appears, goes, gets a new stream or a new
      // count), so a quiet room does not lay out once a sweep.
      if (!stream) {
        const had = !!el;
        if (el) { for (const v of el.querySelectorAll('video')) { try { v.pause(); v.srcObject = null; } catch (e) {} (0, /*()*/__M.releaseAudio)(v); } el.remove(); }
        stadiumEl.classList.toggle('on', !!stadiumEl.querySelector('.rowtile')); __M.compOf.delete('sd'); __C.act.recSourcesChanged();
        if (had) { try { layout(); } catch (e) {} }
        return;
      }
      const prevSd = __M.compOf.get('sd');
      let changed = !el || !stadiumEl.classList.contains('on');
      if (!el) {
        el = document.createElement('div'); el.className = 'rowtile'; el.dataset.row = 'sd';
        const v = document.createElement('video'); v.muted = true; v.autoplay = true; v.setAttribute('playsinline', '');
        const lb = document.createElement('div'); lb.className = 'rlabel'; lb.textContent = (0, /*()*/__C.uiText)('setStadium', 'The stadium');
        el.appendChild(v); el.appendChild(lb); stadiumEl.appendChild(el); (0, /*()*/__M.trackAspect)(el, v);
        try { turnPaint(); } catch (e) {}   // a new strip takes the paused note at once (TURN.11)
      }
      const v = el.querySelector('video');
      if (!(typeof __M.wkHolds === 'function' ? (0, /*()*/__M.wkHolds)(v, stream) : v.srcObject === stream)) { if (typeof __M.wkBindVideo === 'function') (0, /*()*/__M.wkBindVideo)(v, stream); else v.srcObject = stream; const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); changed = true; }
      // quiet: its sound plays, and it takes no place on screen (paintRoomView)
      const wasQuiet = el.style.display === 'none';
      if (!!quiet !== wasQuiet) { el.style.display = quiet ? 'none' : ''; changed = true; }
      stadiumEl.classList.toggle('on', !quiet || !!stadiumEl.querySelector('.rowtile:not([data-row="sd"])'));
      const cnt = (0, /*()*/__C.roomPastSection)() ? (0, /*()*/__C.displayCount)() : (0, /*()*/__C.knownTotal)();
      if (!prevSd || prevSd.streamId !== stream.id || prevSd.cnt !== cnt || prevSd.el !== v) changed = true;
      __M.compOf.set('sd', { via: 'mosaic', streamId: stream.id, stream, names: [], cnt, el: v });
      __C.act.recSourcesChanged();
      if (changed) { try { layout(); } catch (e) {} }
    }
    yield 2332; // sid -> { pk, ver } (one pin per sid and ad key)
    // Anchor the lane's on-demand load to the page's own js/ folder, captured now, while this script is evaluating and the
    // document base is still this page. joinRoom() later rewrites the address to /meet/<room> or /join/… (history.replaceState)
    // and moves the base; a bare 'js/app-owner.js' then resolves to /meet/js/app-owner.js (or /join/js/…) and 404s, the
    // verifier never builds, and the lane does not retain the app frame. Reading a script's src inside sgaAppOwner is too
    // late: the reflected URL re-resolves the relative attribute against the new base. The anchor is a script of this page
    // in js/: runtime.js on the repo page, or the bundle that carries it on the published page (js/run.bundle.js,
    // js/run.lobby.js, beside the files). With neither, this page's own address now. appOwnerLib in runtime.js anchors the
    // same way from its own currentScript, at static-load time.
    const _runtimeSrc = (() => {
      const nodes = document.getElementsByTagName('script');
      for (let i = 0; i < nodes.length; i++) {
        const raw = nodes[i].getAttribute('src') || '';
        if (/(^|\/)(runtime|run\.bundle|run\.lobby)\.js(?:[?#]|$)/.test(raw)) return nodes[i].src || '';
      }
      try { return new URL('js/runtime.js', document.baseURI).href; } catch (e) { return ''; }
    })();
    let sgaAOP = null;           // the app-owner module, loaded once, from this page's js/ folder
    function sgaAppOwner() {
      if (window.GifOS && GifOS.appOwner) return Promise.resolve(GifOS.appOwner);
      if (sgaAOP) return sgaAOP;
      sgaAOP = new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = _runtimeSrc ? new URL('app-owner.js', _runtimeSrc).href : 'js/app-owner.js';
        el.onload = () => (window.GifOS && GifOS.appOwner) ? resolve(GifOS.appOwner) : reject(new Error('app-owner.js empty'));
        el.onerror = () => { sgaAOP = null; reject(new Error('app-owner.js failed')); };
        document.head.appendChild(el);
      });
      return sgaAOP;
    }

    // ---- hand raise: float to the top in the order hands went up --------------
    const handBtn = document.getElementById('hand');
    yield 2337;
    try {
      const handMq = window.matchMedia('(max-width: 700px), (max-height: 500px)');
      if (handMq.addEventListener) handMq.addEventListener('change', () => { try { __C.act.placeViewerHand(); } catch (e) {} });
    } catch (e) {}
    function paintHand() {
      const up = !!__C.model.me.myStatus().hand;
      const docked = handBtn.parentElement && handBtn.parentElement.classList.contains('bar');
      const lab = handBtn.querySelector('.docklab');
      if (docked && lab) {
        // The dock word stays the screen's ("Hand"); up or down is colour, aria-pressed and aria-label.
        handBtn.classList.toggle('on', up);
        handBtn.setAttribute('aria-label', up ? 'Lower hand' : 'Raise hand');
        handBtn.setAttribute('aria-pressed', up ? 'true' : 'false');
      } else {
        handBtn.classList.toggle('off', up);
        handBtn.textContent = up ? 'Lower hand' : 'Hand';
      }
      // A broadcast viewer's hand asks the host for the stage (confirmed design).
      let ask = false;
      try { ask = __C.model.room.BROADCAST() && (0, /*()*/__C.bcRole)() === 'viewer'; } catch (e) { ask = false; }
      if (ask) handBtn.title = 'Ask the host to invite you on stage';
      else if (!up) handBtn.title = 'Raise your hand — raised hands float to the top';
      const rh = document.getElementById('react-hand');
      if (rh) {
        rh.textContent = '✋';
        rh.setAttribute('aria-label', __C.model.me.myStatus().hand ? 'Lower hand' : 'Raise hand');
        rh.classList.toggle('on', !!__C.model.me.myStatus().hand);
        rh.setAttribute('aria-pressed', __C.model.me.myStatus().hand ? 'true' : 'false');
      }
    }
    handBtn.onclick = () => {
      __C.model.me.myStatus().hand = __C.model.me.myStatus().hand ? null : Date.now();
      paintHand();
      (0, /*()*/__C.broadcastStatus)();
      layout();
      renderHandq();
    };
    yield 2343;

    // ---- the stage: step up / step down (docs/media-plane.md, Channel St) ------
    // Open room: anyone, while seats remain — attributed, like everything.
    // Admin room: admins + grantees (the same grant that gates apps). Stepping
    // down is everyone's right, always. The button only VOICES the rule; the
    // enforcement lives in every receiver's stageIds() filter.
    const stageBtn = document.getElementById('stagebtn');
    function paintStage() {
      const claimed = !!__C.model.me.myStatus().stg;
      const seated = claimed && (0, /*()*/__C.stageIds)().includes(__C.model.me.myId());
      const on = (__C.model.room.BROADCAST()) ? claimed : seated;
      stageBtn.classList.toggle('on', on);
      const hostHere = (__C.model.room.BROADCAST()) && ((typeof __C.bcHostStored === 'function' && (0, /*()*/__C.bcHostStored)()) || __C.amAdmin);
      // Stage keeps the slot barPlan gave it and the word dockLabelSet gave
      // it. A seat change only colours it, re-labels it for a screen reader,
      // and grays it when it cannot be used (Nathan 2026-11-09).
      const dockedNow = stageBtn.parentElement && stageBtn.parentElement.classList.contains('bar');
      const mayStage = !!(!(0, /*()*/__C.hasAdminRoom)() || __C.amAdmin || hostHere || ((0, /*()*/__C.modOf)(__C.model.me.myId()).app && (0, /*()*/__C.modOf)(__C.model.me.myId()).app.on) || (0, /*()*/__C.stageGrantLive)(__C.model.me.myId()) || __C.model.me.myStatus().stg);
      if (dockedNow) {
        stageBtn.setAttribute('aria-label', on ? 'Step off the stage' : 'Step on the stage');
        stageBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        stageBtn.title = on ? 'Step off the stage. The room stops seeing you.' : 'Step onto the stage. The room sees and hears you.';
        stageBtn.style.display = '';
        if (typeof __C.idleDock === 'function') (0, /*()*/__C.idleDock)(stageBtn, mayStage ? '' : 'Only the host and the people they invite can step on the stage.');
      } else {
        stageBtn.textContent = phoneLayout() ? (on ? 'Step off stage' : 'Step on stage') : (on ? 'Step down' : 'Stage');
        stageBtn.style.display = mayStage ? '' : 'none';
      }
      if (typeof paintStagePlate === 'function') paintStagePlate();
      if (typeof __C.paintBroadcastAir === 'function') (0, /*()*/__C.paintBroadcastAir)();
      // Broadcast roles own the seat class. Meet still marks a stage grant
      // the old way; a broadcast viewer must not inherit it.
      if (__C.model.room.BROADCAST()) {
        paintBroadcastRole();
        if ((0, /*()*/__C.bcRole)() === 'viewer') (0, /*()*/__C.enforceBroadcastSeat)();
        try { paintBroadcastSeats(); } catch (e) {}
      } else document.body.classList.toggle('stage-granted', (0, /*()*/__C.canStage)(__C.model.me.myId()));
      try { paintWatchingSeat(); } catch (e) {}
      try { paintBarIdle(); } catch (e) {}
    }
    yield 2349;
    stageBtn.onclick = () => {
      if ((0, /*()*/__C.bcWatchingViewer)()) return;
      if (__C.model.me.myStatus().stg) {
        __C.act.stepDown();   // the core remembers a declined vote-up and leaves the Stage
        return;
      }
      if (!(0, /*()*/__C.canStage)(__C.model.me.myId())) { (0, /*()*/__C.sayState)('stageNotAllowed'); return; }
      if ((0, /*()*/__C.stageIds)().length >= __C.model.consts.SCALE().C) { (0, /*()*/__C.sayState)('stageFull', { n: __C.model.consts.SCALE().C }); return; }
      (0, /*()*/__C.setStage)(true);
    };
    yield 2351;
    const shareBtn = document.getElementById('sharebtn');
    yield 2353;
    function paintShare() {
      if (!shareBtn) return;
      const on = !!__C.model.me.myStatus().scr;
      shareBtn.classList.toggle('on', on);
      // The word is the screen's (dockLabelSet); sharing shows in colour, aria-label and title.
      const sharingLabel = on ? 'Stop sharing' : 'Share screen';
      shareBtn.setAttribute('aria-label', sharingLabel);
      shareBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      shareBtn.title = (__C.model.room.BROADCAST())
        ? (on ? 'You are sharing your screen on the stage. Tap to stop.' : 'Show the stage a window, a tab, or your desktop.')
        : (on
          ? (0, /*()*/__C.uiText)('shareTipOn', 'You are sharing your screen with the meeting — tap to stop')
          : (0, /*()*/__C.uiText)('shareTip', 'Show the whole room a window, a tab or your desktop. (To share a GifOS app, use Run app — everyone runs it themselves.)'));
      // FEATURE DETECTION, NEVER A UA CHECK (the preflight's rule). Where the
      // browser has no getDisplayMedia the control is hidden (STEERING 2105).
      // A greyed button whose only explanation was a clipped banner read as
      // broken. Where capture exists, Share screen stays in the first group.
      shareBtn.classList.remove('dim');
      // On the dock Share is never hidden: when it cannot be used it is
      // grayed in place and the tooltip says why (Nathan 2026-11-09). In
      // More it stays out of the way for a browser or a role that cannot share.
      const shareDocked = !!(shareBtn.parentElement && shareBtn.parentElement.classList && shareBtn.parentElement.classList.contains('bar'));
      const shareRoleOff = !!(__C.model.room.BROADCAST() && (0, /*()*/__C.bcRole)() !== 'host');
      let shareWhy = '';
      if (!(0, /*()*/__M.canScreenShare)()) shareWhy = (0, /*()*/__C.uiText)('shareNoGdm', 'This browser cannot share a screen.');
      else if (document.body.classList.contains('app-room')) shareWhy = 'Screen share is off while an app has the room.';
      else if (shareRoleOff) shareWhy = 'Only the host shares to the stage.';
      else if (!on && !(0, /*()*/__C.mayShareScreen)(__C.model.me.myId())) shareWhy = (0, /*()*/__C.uiText)('shareNotAllowed', 'The host has not allowed you to share yet.');
      // Several people may share at once (Nathan 2026-11-11): each screen is a
      // tab of the content area. Only a full stage stops one more.
      else if (!on && !__C.model.me.myStatus().stg && (0, /*()*/__C.stageIds)().length >= __C.model.consts.SCALE().C) shareWhy = (0, /*()*/__C.uiText)('shareStageFull', 'The stage is full. Someone has to step down first.');
      shareBtn.style.display = (!shareDocked && (!(0, /*()*/__M.canScreenShare)() || shareRoleOff)) ? 'none' : '';
      if (typeof __C.idleDock === 'function') (0, /*()*/__C.idleDock)(shareBtn, shareDocked ? shareWhy : '');
      // A screen on the Stage wants height. This does not rebuild the layout —
      // it lets the strip grow the way the broadcast skin already does.
      document.body.classList.toggle('screen-on', (0, /*()*/__C.screenSharers)().length > 0);
      // A broadcast viewer has no share button until an admin allows them.
      document.body.classList.toggle('share-granted', (0, /*()*/__C.mayShareScreen)(__C.model.me.myId()));
    }
    yield 2367;
    function showResharePrompt() {
      __M.shareRecoverMode = false;
      const back = document.getElementById('reshare-back');
      if (back && back.classList) back.classList.add('show');
      (0, /*()*/__C.sayState)('shareStopped');
    }
    function hideResharePrompt() {
      const back = document.getElementById('reshare-back');
      if (back && back.classList) back.classList.remove('show');
    }
    yield 2374;
    if (shareBtn) shareBtn.onclick = () => {
      if (__C.model.room.BROADCAST() && (0, /*()*/__C.bcRole)() !== 'host') return;
      if (__C.model.me.myStatus().scr) { (0, /*()*/__M.stopScreenShare)(); return; }
      if (!(0, /*()*/__M.canScreenShare)()) {
        const app = document.getElementById('appbtn');
        if (app) app.click();
        return;
      }
      // One click on the dock opens the browser's own picker. The explanatory
      // sheet is not on this path. Run app stays in More.
      (0, /*()*/__M.startScreenShare)();
    };
    // The self-tile's chip is the always-visible stop (see updateTile). One
    // delegated listener, because the chips are re-rendered from a string on
    // every repaint and per-element handlers would be re-bound forever.
    document.addEventListener('click', (e) => {
      const t = e.target && e.target.closest && e.target.closest('.stopshare');
      if (t) { e.preventDefault(); (0, /*()*/__M.stopScreenShare)(); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const t = document.activeElement;
      if (t && t.classList && t.classList.contains('stopshare')) { e.preventDefault(); (0, /*()*/__M.stopScreenShare)(); }
    });
    // ---- REBROADCAST (Q77) ----------------------------------------------
    // No mid-service catch-up, and nobody pulls a file off a phone (Q76).
    // The host plays the last service, or any video, INTO the stage feed: a
    // source swap like a screen share (sentVideoTrack, mySelfStream), so it
    // rides the same fan-out down the relay tree as the live picture and the
    // host's upload does not grow with the audience. Viewers see whatever is
    // playing now, marked Prerecorded, with nothing to seek or save.
    //
    // One <video> feeds both tracks, so they stay together. Its own capture
    // carries picture and sound where the browser has one: measured on
    // Chromium, its sound lands with the picture, while the same sound sent
    // through Web Audio arrived ~90 ms late. Without a capture (Safari) a
    // canvas draws the picture and Web Audio takes the sound. The tracks are made once at start
    // and kept until Stop: a new track mints a new stage stream id and
    // re-ships down every relayer (see selfShipMemo). Pause holds the same
    // tracks; the picture just stops changing.
    const rbBtn = document.getElementById('rbbtn');
    yield 2384;
    // Without a capture: a canvas drawn from the element frame by frame.
    function rbCanvas(r) {
      const vid = r.vid;
      const cv = document.createElement('canvas');
      cv.width = vid.videoWidth || 640; cv.height = vid.videoHeight || 360;
      const g = cv.getContext('2d');
      if (!g || !cv.captureStream) return null;
      const step = () => {
        if (__C.model.room.rbNow() !== r) return;
        try { g.drawImage(vid, 0, 0, cv.width, cv.height); } catch (e) {}
        if (vid.requestVideoFrameCallback) vid.requestVideoFrameCallback(step); else requestAnimationFrame(step);
      };
      step();
      return cv.captureStream(30).getVideoTracks()[0] || null;
    }
    yield 2390;
    function paintRbNow() {
      const r = __C.model.room.rbNow();
      const t = document.getElementById('rb-now-txt');
      if (!r || !t) return;
      const len = isFinite(r.vid.duration) ? ' / ' + (0, /*()*/__C.rbFmt)(r.vid.duration) : '';
      const line = 'Prerecorded · ' + r.title + ' · ' + (r.starting ? 'starting…' : (0, /*()*/__C.rbFmt)(r.vid.currentTime) + len);
      if (t.textContent !== line) t.textContent = line;
      const pb = document.getElementById('rb-pause');
      const w = (r.vid.paused && !r.starting) ? 'Resume' : 'Pause';
      if (pb && pb.textContent !== w) pb.textContent = w;
      // THE REBROADCASTER'S OWN NO BLUR PICK. In a room with no password whose clear right lets viewers tap to unblur, a
      // rebroadcast leaves clear only after its host picks No blur once the right is on (blurHold 'repick'), the same
      // explicit pick the camera chooser makes. A host rebroadcasting with the camera off has no chooser to reach, so the
      // pick sits here, beside Pause and Stop: shown only while such a right is on, offered again when the right moves.
      const bar = document.getElementById('rb-now');
      let bb = document.getElementById('rb-blur');
      let hold = '', mode = '';
      try { mode = (0, /*()*/__C.clearNoPwState)().mode; hold = mode ? (0, /*()*/__C.blurHold)('me', 'stage') : ''; } catch (e) { mode = ''; }
      if (!mode || !bar) { if (bb) bb.remove(); return; }
      if (!bb) {
        bb = document.createElement('button');
        bb.type = 'button';
        bb.id = 'rb-blur';
        bar.insertBefore(bb, pb);
        bb.onclick = () => {
          const clear = bb.getAttribute('aria-pressed') === 'true';
          try { (0, /*()*/__C.setPersonalBlur)(clear ? 2 : 0, true); } catch (e) {}
          paintRbNow();
        };
      }
      const clear = hold !== 'repick';
      const bw = clear ? 'Blur' : 'No blur';
      if (bb.textContent !== bw) bb.textContent = bw;
      bb.setAttribute('aria-pressed', String(clear));
      bb.title = clear ? 'Viewers may tap to unblur this video. Blur it for everyone.' : 'Let viewers tap to unblur this video.';
    }
    function paintRb() {
      document.body.classList.toggle('rb-on', !!__C.model.room.rbNow());
      let bar = document.getElementById('rb-now');
      if (!__C.model.room.rbNow()) { if (bar) bar.remove(); }
      else if (!bar) {
        bar = document.createElement('div');
        bar.id = 'rb-now';
        bar.setAttribute('role', 'region');
        bar.setAttribute('aria-label', 'Rebroadcast');
        bar.innerHTML = '<p id="rb-now-txt"></p><button type="button" id="rb-pause">Pause</button><button type="button" id="rb-stop">Stop</button>';
        document.body.appendChild(bar);
        bar.querySelector('#rb-pause').onclick = __C.rbToggle;
        bar.querySelector('#rb-stop').onclick = () => (0, /*()*/__C.rbStop)();
      }
      paintRbNow();
      if (window.__gifosBarAvoid) window.__gifosBarAvoid();
      try { paintLiveBadge(); } catch (e) {}
    }
    // The host's choice: the service that just ended, or a file.
    function openRbSheet() {
      if (__C.model.room.rbNow()) return;
      const old = document.getElementById('rb-sheet');
      if (old) old.remove();
      const bg = document.createElement('div');
      bg.id = 'rb-sheet';
      bg.className = 'rb-sheet';
      bg.setAttribute('role', 'dialog');
      bg.setAttribute('aria-modal', 'true');
      bg.setAttribute('aria-label', 'Rebroadcast');
      bg.innerHTML = '<div class="rb-card"><p class="rb-title">Rebroadcast</p>' +
        '<p class="rb-why">Plays a video into the broadcast for everyone watching. Viewers see Prerecorded and can’t skip or save it.</p>' +
        (__C.model.room.bcLastService() ? '<button type="button" id="rb-last">Last ' + (0, /*()*/__C.rbNoun)() + '</button>' : '') +
        '<label id="rb-file-btn">Choose a video<input type="file" id="rb-file" accept="video/*"></label>' +
        '<button type="button" id="rb-cancel">Cancel</button></div>';
      document.body.appendChild(bg);
      const close = () => bg.remove();
      bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
      bg.querySelector('#rb-cancel').onclick = close;
      const last = bg.querySelector('#rb-last');
      if (last) last.onclick = () => { close(); (0, /*()*/__M.rbStart)({ blob: __C.model.room.bcLastService().blob, title: 'Last ' + (0, /*()*/__C.rbNoun)(), last: true }); };
      const file = bg.querySelector('#rb-file');
      file.onchange = () => {
        const f = file.files && file.files[0];
        if (!f) return;
        close();
        (0, /*()*/__M.rbStart)({ blob: f, title: (0, /*()*/__C.rbTitle)(f.name) });
      };
    }
    if (rbBtn) rbBtn.onclick = () => {
      const bt = document.getElementById('bartoggle');
      if (bt && bt.getAttribute('aria-expanded') === 'true') bt.click();
      if (__C.model.room.rbNow()) { (0, /*()*/__C.rbStop)(); return; }
      openRbSheet();
    };
    // THE SHEET THAT PREFERS THE APP PIN. It is not a nag screen: it is the
    // one moment where the person can still be told that the thing they are
    // about to do the expensive way has a better way, before a picker opens.
    // It always names Run app; when an app is ALREADY running in this room it
    // says so first, by name, because then the answer is simply "you already
    // have it".
    function openShareSheet() {
      const modal = document.getElementById('share-modal');
      const note = document.getElementById('share-appnote');
      const running = (typeof __C.findSharedApp === 'function') ? (0, /*()*/__C.findSharedApp)() : null;
      const runnable = (typeof __C.canIRunApp === 'function') ? (0, /*()*/__C.canIRunApp)() : false;
      note.className = running ? 'share-note running' : 'share-note';
      note.innerHTML = running
        ? '<b>🧩 ' + (0, /*()*/__C.esc)(running.name || (0, /*()*/__C.uiText)('anApp', 'An app')) + (0, /*()*/__C.uiText)('shareRunning', ' is already running in this meeting.</b> Everyone here runs it on their own device and stays in sync — you do <b>not</b> need to share your screen to show it.')
        : (0, /*()*/__C.uiText)('shareAppNote', '<b>🧩 Sharing a GifOS app? Use “Run app” instead.</b> A pinned app runs on everyone’s own device off a small shared data stream — crisp, interactive, readable on a phone. A screen share is a <i>video of your window</i>: one-way, one resolution, and paid for in pixels at every hop.');
      const go = document.getElementById('share-runapp');
      go.style.display = (runnable && !__C.ROOM.appPinned) ? '' : 'none';
      go.textContent = running ? (0, /*()*/__C.uiText)('showMeApp', 'Show me the app') : (0, /*()*/__C.uiText)('runAppInstead', 'Run app instead');
      // THE REFUSAL LIVES IN THE SHEET. A guest who may not share used to get
      // the picker button, then a 4s grey line in the bar — which she missed,
      // twice, while the sheet had already closed. The sheet itself now says
      // no, says who can fix it, and does not offer a picker that will refuse.
      const blocked = !__C.model.me.myStatus().scr && !(0, /*()*/__C.mayShareScreen)(__C.model.me.myId());
      document.getElementById('share-go').style.display = blocked ? 'none' : '';
      document.getElementById('share-denied').style.display = blocked ? '' : 'none';
      // From a key, focus goes back to Share, or to More when Share sits
      // folded under it (a viewer's, or a dock squeezed beside the chat).
      const shareShown = shareBtn && shareBtn.getClientRects().length;
      shareSheetOpener = (document.activeElement && document.activeElement !== document.body) ? document.activeElement
        : (shareShown ? shareBtn : (document.getElementById('bartoggle') || shareBtn));
      modal.style.display = 'flex';
      const focusEl = document.getElementById((0, /*()*/__C.shareSheetFocusId)(blocked));
      if (focusEl && focusEl.focus) { try { focusEl.focus(); } catch (e) {} }
    }
    let shareSheetOpener = null;
    yield 2397;
    function closeShareSheet() {
      const modal = document.getElementById('share-modal');
      if (!modal || modal.style.display === 'none') return;
      modal.style.display = 'none';
      const back = shareSheetOpener;
      shareSheetOpener = null;
      if (back && back.focus) { try { back.focus(); } catch (e) {} }
    }
    (function wireShareSheet() {
      const modal = document.getElementById('share-modal');
      if (!modal) return;
      document.getElementById('share-cancel').onclick = () => { closeShareSheet(); };
      document.getElementById('share-go').onclick = () => { closeShareSheet(); (0, /*()*/__M.startScreenShare)(); };
      const again = document.getElementById('reshare-go');
      if (again) again.onclick = () => {
        __M.shareRecoverMode = false;
        if (__M.recoverShareTimer) { clearTimeout(__M.recoverShareTimer); __M.recoverShareTimer = 0; }
        hideResharePrompt();
        (0, /*()*/__M.startScreenShare)();
      };
      document.getElementById('share-runapp').onclick = () => {
        closeShareSheet();
        const want = (typeof __C.findSharedApp === 'function') ? (0, /*()*/__C.findSharedApp)() : null;
        if (want && __C.appHiddenSid === want.s) { __C.act.appShow(); return; }
        if (want) { (0, /*()*/__C.setStatus)('🧩 ' + (want.name || 'The app') + ' is running here — it is on your screen already.'); return; }
        openAppPicker();
      };
      modal.addEventListener('click', (e) => { if (e.target === modal) closeShareSheet(); });
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (modal.style.display === 'none') return;
        e.preventDefault();
        e.stopPropagation();
        closeShareSheet();
      }, true);
    })();
    yield 2461;
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') (0, /*()*/__C.dlogOut)(); });
    function paintDebugLog() {
      const sw = document.getElementById('dbglog-on'), st = document.getElementById('dbglog-state');
      const sz = document.getElementById('dbglog-size'), ex = document.getElementById('dbglog-export');
      const grp = document.getElementById('set-g-debug');
      if (!__C.model.net.DLOG()) { if (grp) grp.hidden = true; return; }
      let saved = ''; try { saved = __C.model.net.DLOG().readSetting(localStorage); } catch (e) {}
      const rec = !!(__C.model.net.dlogRec() && __C.model.net.dlogRec().live());
      if (sw) sw.checked = rec || saved === 'on';
      if (st) st.textContent = rec ? (saved === 'on' ? (0, /*()*/__C.uiText)('setDbgRec', 'Recording on this page.') : (0, /*()*/__C.uiText)('setDbgUrl', 'Recording on this page, because its link turned debug on.'))
        : (saved === 'on' ? (0, /*()*/__C.uiText)('setDbgNext', 'Recording starts the next time a meeting page opens.') : '');
      const s = (0, /*()*/__C.dlogStoreGet)();
      if (!s) { if (sz) sz.textContent = ''; return; }
      s.bytes().then((b) => {
        if (sz) sz.textContent = (0, /*()*/__C.uiText)('setDbgSize', 'Debug log: {size}').split('{size}').join(__C.model.net.DLOG().fmtSize(b));
        if (ex) ex.disabled = !(b > 0);
        const cl = document.getElementById('dbglog-clear'); if (cl) cl.disabled = !(b > 0);
      }).catch(() => { if (sz) sz.textContent = (0, /*()*/__C.uiText)('setDbgSize', 'Debug log: {size}').split('{size}').join('?'); });
    }
    {
      const sw = document.getElementById('dbglog-on');
      if (sw) sw.addEventListener('change', () => {
        if (!__C.model.net.DLOG()) return;
        if (sw.checked) { __C.model.net.DLOG().saveSetting(localStorage, true); (0, /*()*/__C.dlogRecStart)(); if (__C.model.net.dlogRec()) __C.model.net.dlogRec().flush(true); }
        else { __C.model.net.DLOG().turnOff(window); if (__C.model.net.dlogRec()) { __C.model.net.dlogRec().flush(true); __C.model.net.dlogRec().stop(); } }
        paintDebugLog();
      });
      const ex = document.getElementById('dbglog-export');
      if (ex) ex.addEventListener('click', async () => {
        const s = (0, /*()*/__C.dlogStoreGet)(); if (!s || !__C.model.net.DLOG()) return;
        const st = document.getElementById('dbglog-state');
        ex.disabled = true;
        try {
          if (__C.model.net.dlogRec() && __C.model.net.dlogRec().live()) await __C.model.net.dlogRec().flush(true);
          let ver = ''; try { ver = String(window.GIFOS_VERSION || 'edge') + ' build ' + String(window.GIFOS_BUILD || 0); } catch (e) {}
          const out = await __C.model.net.DLOG().exportBlob(s, { ver: ver, ua: navigator.userAgent });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(out.blob);
          a.download = __C.model.net.DLOG().fileName(Date.now()) + (out.gzip ? '.gz' : '');
          a.style.display = 'none';
          document.body.appendChild(a); a.click();
          // release the file's memory once the browser has taken the download
          setTimeout(() => { try { URL.revokeObjectURL(a.href); a.remove(); } catch (e) {} }, 60000);
        } catch (e) { if (st) st.textContent = (0, /*()*/__C.uiText)('setDbgExportFail', 'Could not export the debug log.'); }
        ex.disabled = false;
        paintDebugLog();
      });
      const cl = document.getElementById('dbglog-clear'), cf = document.getElementById('dbglog-confirm');
      const ask = (on) => { if (cf) cf.hidden = !on; if (cl) cl.hidden = !!on; };
      if (cl) cl.addEventListener('click', () => ask(true));
      const no = document.getElementById('dbglog-clear-no'); if (no) no.addEventListener('click', () => ask(false));
      const yes = document.getElementById('dbglog-clear-yes');
      if (yes) yes.addEventListener('click', async () => {
        ask(false);
        const s = (0, /*()*/__C.dlogStoreGet)(); if (s) { try { await s.clear(); } catch (e) {} }
        paintDebugLog();
      });
    }
    const setModal = document.getElementById('set-modal');
    document.getElementById('setbtn').onclick = () => {
      paintVq();
      paintDebugLog();
      (0, /*()*/__M.applyBuses)(); // refresh which faders show
      const nc = document.getElementById('set-name-cur'); if (nc) nc.textContent = (0, /*()*/__C.myName)();
      const car = document.getElementById('ccall-row'); if (car) car.style.display = ((0, /*()*/__C.hasAdminRoom)() && __C.amAdmin) ? '' : 'none';
      const ccNote = document.getElementById('ccall-note');
      if (ccNote) ccNote.textContent = __C.model.room.BROADCAST()
        ? 'In a broadcast only this host\u2019s device writes captions. Viewers and stage guests do not.'
        : (0, /*()*/__C.uiText)('ccallNoteDev', 'Hosts only — every device starts writing down the voices it hears. Anyone can tap CC to opt out.');
      if (typeof __M.applyCcAll === 'function') (0, /*()*/__M.applyCcAll)();
      setModal.style.display = 'flex';
    };
    const adjustStageBtn = document.getElementById('adjust-stage');
    if (adjustStageBtn) adjustStageBtn.onclick = () => { setModal.style.display = 'none'; openStageAdjust(); };
    // Your name, changeable mid-meeting: a guest who typed the room password
    // into the name box was "Password1" for the whole call with no way out.
    document.getElementById('set-rename').onclick = () => renameFlow(() => {
      const nc = document.getElementById('set-name-cur'); if (nc) nc.textContent = (0, /*()*/__C.myName)();
      try { (0, /*()*/__C.refreshAllTiles)(); (0, /*()*/__C.broadcastStatus)(); if (typeof __C.pushLeaf === 'function') (0, /*()*/__C.pushLeaf)(); } catch (e) {}
    });
    function paintMyAvatarPreview() {
      const img = document.getElementById('set-avatar-preview');
      if (!img) return;
      const a = (GifOS.store.identity() || {}).avatar;
      if (a && a.url) { img.src = a.url; img.hidden = false; }
      else { img.removeAttribute('src'); img.hidden = true; }
    }
    yield 2471;
    const avatarFile = document.getElementById('set-avatar-file');
    const avatarErr = document.getElementById('set-avatar-err');
    if (avatarFile) avatarFile.addEventListener('change', () => {
      const f = avatarFile.files && avatarFile.files[0];
      avatarFile.value = '';
      if (!f || !GifOS.avatar) return;
      if (avatarErr) avatarErr.textContent = '';
      GifOS.avatar.prepareFile(f).then((res) => {
        if (!res || !res.ok) { if (avatarErr) avatarErr.textContent = (res && res.error) || 'Choose a GIF, PNG, JPG, or WebP.'; return; }
        GifOS.store.setAvatar({ mime: res.mime, hash: res.hash, b64: res.b64 });
      }).catch(() => { if (avatarErr) avatarErr.textContent = 'Choose a GIF, PNG, JPG, or WebP.'; });
    });
    const avatarRemove = document.getElementById('set-avatar-remove');
    if (avatarRemove) avatarRemove.onclick = () => {
      if (avatarErr) avatarErr.textContent = '';
      GifOS.store.setAvatar(null);
    };
    // Name and picture changes (this page, or the home screen in another tab)
    // repaint locally and go out to peers. setAvatar/setName notify; this does not write back.
    if (GifOS.store.onIdentity) GifOS.store.onIdentity(() => {
      try { paintMyAvatarPreview(); } catch (e) {}
      try { paintLobbyAppear(); } catch (e) {}
      const nc = document.getElementById('set-name-cur'); if (nc) nc.textContent = (0, /*()*/__C.myName)();
      try { (0, /*()*/__C.refreshAllTiles)(); } catch (e) {}
      try { if (__C.model.me.myId()) { (0, /*()*/__C.broadcastStatus)(); (0, /*()*/__C.pushLeaf)(); } } catch (e) {}
      try { for (const p of __C.model.roster.peers().values()) (0, /*()*/__C.sendAvatarTo)(p); } catch (e) {}
      try { paintBroadcastIdent(); } catch (e) {}
    });
    document.getElementById('set-close').onclick = () => { setModal.style.display = 'none'; };
    setModal.addEventListener('click', (e) => { if (e.target === setModal) setModal.style.display = 'none'; });
    document.getElementById('vqrow').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-vq]'); if (!b) return;
      (0, /*()*/__C.setVq)(b.dataset.vq || '');
    });
    for (const bus of ['stage', 'row', 'stadium']) {
      const inp = document.getElementById('mix-' + bus);
      inp.value = Math.round(__M.mix[bus] * 100);
      inp.addEventListener('input', () => {
        __M.mix[bus] = Math.max(0, Math.min(1, inp.value / 100));
        (0, /*()*/__M.rememberMix)(bus);
        (0, /*()*/__M.applyBuses)();
      });
    }
    const paintFaders = () => { for (const b of ['stage', 'row', 'stadium']) { const i = document.getElementById('mix-' + b); if (i) i.value = Math.round(__M.mix[b] * 100); } };
    yield 2500;

    // The Timing pills (in the mix panel): Conversation | Unison | 🎵 Song.
    // Song doubles as the way to LEAD one — singing is loved but rare, so it
    // lives here rather than spending a toolbar seat. Tap it to step onto the
    // stage as the leader (music-grade mic and all); tap again to end the
    // song. While someone else leads, the pill just glows — one leader keeps
    // the timing anchor unambiguous.
    const timingRow = document.getElementById('timingrow');
    yield 2504;
    timingRow.addEventListener('click', (e) => {
      const t = e.target && e.target.dataset ? e.target.dataset.timing : null;
      if (t === 'song') { (0, /*()*/__M.toggleSing)(); (0, /*()*/__M.paintTiming)(); return; }
      if (t !== 'chat' && t !== 'unison') return;
      __C.act.chooseTiming(t);
      (0, /*()*/__M.paintTiming)();
    });
    yield 2545;
    // A line arrives here from the wire ('tr' frame, or a 'hi' replay = backfill)
    // and from this page's own engine (addTranscriptLine). The device that wrote
    // it emits it to the bot; everyone else emits here. A replay is history.
    function emitLiveTranscript(line) {
      if (!line) return;
      // The bot's own voice is not news. Another person's line still is,
      // which is the whole reason a bot listens to takeTr.
      if (__C.model.me.myStatus().bot && (!line.byId || line.byId === __C.model.me.myId())) return;
      if (typeof window !== 'undefined' && typeof window.__gifosMeetEmit === 'function') window.__gifosMeetEmit({ type: 'transcript', line: { by: line.by, byId: line.byId, text: line.text, at: line.at, w: line.w, src: line.src, lang: line.lang || '' } });
    }
    yield 2554; // this screen's own choice (qa-meet-mobile)
    function hideCaptions() {
      const nodes = document.querySelectorAll('.tile .cap.show');
      for (let i = 0; i < nodes.length; i++) nodes[i].classList.remove('show');
    }
    function showCaption(byId, text, label) {
      if (!__C.model.chat.ccShow()) return;
      const bar = document.getElementById('livecap');
      if (bar) {
        let name = label || '';
        try {
          if (!name) { if (byId === __C.model.me.myId()) name = (0, /*()*/__C.myName)(); else { const p = __C.model.roster.peers().get(byId); name = (p && p.name) || ''; } }
        } catch (e) {}
        bar.textContent = (name ? name + '. ' : '') + String(text || '');
        if (bar.dataset) bar.dataset.voice = byId || '';
        if (!bar.onclick) bar.onclick = () => capSourceOpen(bar.dataset.voice);   // a tap: whose captions to show for this person
        bar.classList.add('show');
        bar.scrollTop = 0;
        clearTimeout(bar._hide);
        bar._hide = setTimeout(() => bar.classList.remove('show'), 6000);
      }
      const t = byId === __C.model.me.myId() ? __C.model.me.meTile() : __C.model.roster.peers().get(byId);
      if (!t || !t.cap) return;
      t.cap.textContent = text;
      t.cap.classList.add('show');
      clearTimeout(t.capT);
      t.capT = setTimeout(() => t.cap.classList.remove('show'), 6000);
    }
    function renderTranscript() {
      if (!chatPanelOpen() || !transcriptShown()) return; // rebuilt when the transcript is next shown
      const log = document.getElementById('trlog');
      const lines = (0, /*()*/__C.trBlocks)();
      const mine = (0, /*()*/__C.trLang)();
      const row = (l) => l.shot ? shotRow(l.shot) : '<div class="trline"><b>' + (typeof __C.avatarChip === 'function' ? ((0, /*()*/__C.avatarChip)(l.byId) || '') : '') + (0, /*()*/__C.esc)(l.by) + '</b>' + (0, /*()*/__C.esc)((0, /*()*/__C.trNote)(l) + l.text) + (l.lang && l.lang !== mine ? ' <small style="color:var(--muted,#8888aa)">' + (0, /*()*/__C.esc)(l.lang) + '</small>' : '') + '</div>';
      const all = shotsInline(lines);
      const html = all.length
        ? all.map(row).join('')
        : '<small data-t="trEmpty" style="color:#667">' + (0, /*()*/__C.esc)((0, /*()*/__C.uiText)('trEmpty', 'This meeting is being written down. Lines gather here under each speaker\'s name. Anyone here can open this and download it.')) + '</small>';
      (0, /*()*/__C.paintLog)(log, html);
    }
    // SCREEN SHOTS IN THE TRANSCRIPT (js/core/view/shareshots.js): this device's own screenshots of the screens it is shown,
    // placed among the lines at the time each change began. They are this device's alone: never sent, never in another
    // person's transcript (each device that keeps a transcript takes its own). What may be taken is decided here:
    //   on    the "Auto screenshots" box on the transcript window is ticked (shotsDefault until the person picks; then
    //         remembered in this browser). The transcript is kept unless the person picked Transcript: Off in Settings,
    //         which keeps no lines and so no screenshots either.
    //   which every screen shared to this room that this page shows CLEAR: a share this viewer sees blurred (the room's
    //         blur rules, a host's blur order) is never taken; my own screen is mine. The Stage strip (a composite of
    //         faces) is never a source: only the share's own picture.
    // Transcript: Off forgets every screenshot with its lines (setTrMode clears trs; keep() goes false).
    function shotsKey() { return 'gifos_tr_shots'; }
    // Ticked by default only in a meeting; a broadcast (/cast, a broadcast room) starts unticked. A remembered pick wins (shotsOn).
    // The embed runs no view part and takes no screenshots at all.
    function shotsDefault() { let bc = true; try { bc = !!__C.model.room.BROADCAST() || !!(GifOS.viewSurface && GifOS.viewSurface.name === 'cast'); } catch (e) {} return !bc; }
    function shotsOn() { const v = (0, /*()*/__C.lsGet)(shotsKey()); return v === 'on' ? true : v === 'off' ? false : shotsDefault(); }
    function shotWords(s) {
      const time = __C.model.chat.when(s.at);
      return s.mine ? (0, /*()*/__C.uiText)('trShotMine', '\u{1F4F7} Your screen, {time}').replace('{time}', time)
        : (0, /*()*/__C.uiText)('trShotOf', '\u{1F4F7} {name}\'s screen, {time}').replace('{name}', s.name || '?').replace('{time}', time);
    }
    function shotWho(s) {
      return s.mine ? (0, /*()*/__C.uiText)('trShotWhoMine', 'Your screen') : (0, /*()*/__C.uiText)('trShotWho', '{name}\'s screen').replace('{name}', s.name || '?');
    }
    function shotRow(s) {
      const w = shotWords(s);
      try { GifOS.shareShots.label(s.id, w); } catch (e) {}
      return '<div class="trline trshot"><b>' + (0, /*()*/__C.esc)(w) + '</b><img data-shot="' + (0, /*()*/__C.esc)(s.id) + '" src="' + (0, /*()*/__C.esc)(s.url) + '" width="' + s.w + '" height="' + s.h + '" alt="' + (0, /*()*/__C.esc)(w) + '" loading="lazy"></div>';
    }
    function shotsInline(lines) {
      let shots = [];
      try { shots = GifOS.shareShots.list(); } catch (e) {}   // a surface without the library: lines only
      if (!shots.length) return lines;
      return lines.concat(shots.map((s) => ({ at: s.at, shot: s }))).sort((a, b) => a.at - b.at);
    }
    function shareShotsSource() {
      return {
        keep: () => !!(0, /*()*/__C.trKeeps)(),
        on: () => !!(0, /*()*/__C.trKeeps)() && shotsOn(),
        shares: () => {
          const out = [];
          for (const sid of __C.screenSharers()) {
            const mine = sid === __C.myId;
            if (!mine && (((0, /*()*/__C.blurLevelFor)(sid, false, false, 'stage') | 0) > 0 || __C.modBlurOn(sid))) continue;
            const src = (0, /*()*/__M.ctScreenTrack)(sid);
            if (!src || !src.track || src.from === 'strip') continue;
            out.push({ sid, mine, name: mine ? '' : (0, /*()*/__C.displayName)(sid), track: src.track });
          }
          return out;
        },
        changed: () => { if (transcriptShown()) renderTranscript(); },
        always: () => !!window.__gifosRecBot   // a recording bot seat (its session's speakers op) keeps sampling in a background tab
      };
    }
    yield 2571;
    // THE WARNING CARD and THE SOURCE CHOOSER: one small card over the call, one tap per source.
    // ex: { theirs, ours, by } from capTrust.evidence(v): shown side by side so the person can judge who is right.
    function capCard(id, v, title, note, rows, ex) {
      let c = document.getElementById(id);
      if (!c) {
        c = document.createElement('div'); c.id = id; c.className = 'capcard'; c.setAttribute('role', 'dialog');
        document.body.appendChild(c);
      }
      c.dataset.voice = v;
      c.innerHTML = '<div class="capcard-t"></div><div class="capcard-body"><div class="capcard-n"></div><div class="capcard-ex"></div><div class="capcard-w"></div><div class="capcard-h"></div></div><div class="capcard-b dlg-actions"></div>';
      c.querySelector('.capcard-t').textContent = title;
      c.querySelector('.capcard-w').textContent = (0, /*()*/__C.uiText)('capWhich', 'Which is right?');
      c.querySelector('.capcard-n').textContent = note || '';
      const exEl = c.querySelector('.capcard-ex');
      if (ex && (ex.theirs || ex.ours)) {
        const heardBy = !ex.by || ex.by === __C.model.me.myId() ? (0, /*()*/__C.uiText)('capExMine', 'This device heard') : (0, /*()*/__C.uiText)('capExTheirs', '{name}\'s device heard').replace('{name}', (0, /*()*/__C.capName)(ex.by));
        for (const [cls, lab, txt] of [['theirs', (0, /*()*/__C.uiText)('capExSaid', '{name}\'s captions said').replace('{name}', (0, /*()*/__C.capName)(v)), ex.theirs], ['ours', heardBy, ex.ours]]) {
          const q = document.createElement('div'); q.className = 'capcard-q capcard-q-' + cls;
          const l = document.createElement('b'); l.textContent = lab;
          const t = document.createElement('span'); t.textContent = '\u201c' + (txt || '\u2026') + '\u201d';
          q.appendChild(l); q.appendChild(t); exEl.appendChild(q);
        }
      }
      c.querySelector('.capcard-h').textContent = (0, /*()*/__C.uiText)('capLater', 'You can change this any time: tap {name}\'s tile or face, then Captions.').replace('{name}', (0, /*()*/__C.capName)(v));
      const b = c.querySelector('.capcard-b');
      for (const r of rows) {
        const x = document.createElement('button'); x.type = 'button'; x.textContent = r.t; x.dataset.src = r.src;
        if (r.on) x.setAttribute('aria-pressed', 'true');
        x.onclick = () => { c.hidden = true; (0, /*()*/__C.capPick)(v, r.src); };
        b.appendChild(x);
      }
      const done = document.createElement('button'); done.type = 'button'; done.className = 'capcard-x'; done.textContent = (0, /*()*/__C.uiText)('capClose', 'Close');
      done.onclick = () => { c.hidden = true; };
      b.appendChild(done);
      c.hidden = false;
      if (window.__gifosBarAvoid) window.__gifosBarAvoid();   // made lazily: lift it over the floating bar now
      return c;
    }
    yield 2577;
    // ONE CARD for a person's captions. The warning (info set: this page just stopped trusting their captions) and the
    // chooser (opened from their tile or the caption bar) are the same card: what was said vs what was heard, what is
    // shown now, and one tap per choice.
    function capSourceOpen(v, info) {
      if (!__C.model.chat.capTrust() || !v || v === __C.model.me.myId()) return;
      const name = (0, /*()*/__C.capName)(v), ex = __C.model.chat.capTrust().evidence(v);
      const ear = ex && ex.by && ex.by !== __C.model.me.myId() ? (0, /*()*/__C.capName)(ex.by) : (info && info.by && info.by !== 'me' && info.by !== __C.model.me.myId() ? (0, /*()*/__C.capName)(info.by) : '');
      let title;
      if (info || __C.model.chat.capTrust().stateOf(v, v) === 'distrusted') {
        title = ear ? (0, /*()*/__C.uiText)('capWarnEarPlain', '{name}\'s captions don\'t match what {ear}\'s device hears. Which should you see?').replace('{name}', name).replace('{ear}', ear)
          : (0, /*()*/__C.uiText)('capWarnPlain', '{name}\'s captions don\'t match what your device hears. Which should you see?').replace('{name}', name);
      } else title = (0, /*()*/__C.uiText)('capSrcTitle', 'Captions for {name}').replace('{name}', name);
      const rows = (0, /*()*/__C.capRows)(v);
      if (!info) rows.push({ src: 'flag', t: (0, /*()*/__C.uiText)('capFlag', 'These captions are wrong') });
      if (info && __C.clog) (0, /*()*/__C.clog)('captrust warn', String(v).slice(0, 6), info.why, String(__C.model.chat.capTrust().choice(v).show).slice(0, 6));
      const other = document.getElementById(info ? 'capsrc' : 'capwarn'); if (other) other.hidden = true;
      capCard(info ? 'capwarn' : 'capsrc', v, title, (0, /*()*/__C.capNowNote)(v), rows, ex);
    }
    // An open card says what the evidence did since the pick, live: it is painted again when that note changes.
    function capCardRefresh() {
      const c = document.getElementById('capsrc');
      if (!c || c.hidden || !c.dataset.voice || !__C.model.chat.capTrust()) return;
      const n = c.querySelector('.capcard-n'), v = c.dataset.voice, now = (0, /*()*/__C.capNowNote)(v);
      if (n && n.textContent !== now) capSourceOpen(v);
    }
    yield 2584;
    (function wireCcLang() {
      const sel = document.getElementById('cclang'); if (!sel) return;
      let saved = ''; try { saved = localStorage.getItem(__C.model.consts.CC_LANG_KEY()) || ''; } catch (e) {}
      sel.innerHTML = __C.model.consts.CC_LANGS().map(([v, l]) => '<option value="' + v + '">' + l + '</option>').join('');
      if (saved && !__C.model.consts.CC_LANGS().some(([v]) => v === saved)) sel.insertAdjacentHTML('beforeend', '<option value="' + (0, /*()*/__C.esc)(saved) + '">' + (0, /*()*/__C.esc)(saved) + '</option>');
      sel.value = saved;
      sel.onchange = () => ccLangSet(sel.value);
    })();
    // Settings > Captions language, picked there or by the speaker's suggestion (one path): the engine restarts in it,
    // the room is told.
    function ccLangSet(v) {
      v = String(v || '');
      try { if (v) localStorage.setItem(__C.model.consts.CC_LANG_KEY(), v); else localStorage.removeItem(__C.model.consts.CC_LANG_KEY()); } catch (e) {}
      const sel = document.getElementById('cclang');
      if (sel && sel.value !== v) {
        if (v && !__C.model.consts.CC_LANGS().some(([x]) => x === v)) sel.insertAdjacentHTML('beforeend', '<option value="' + (0, /*()*/__C.esc)(v) + '">' + (0, /*()*/__C.esc)(v) + '</option>');
        sel.value = v;
      }
      if ((0, /*()*/__M.speechRunning)()) { (0, /*()*/__M.stopSpeech)(); (0, /*()*/__M.syncSpeech)(); }
      if ((0, /*()*/__M.ccEngine)() === 'local') (0, /*()*/__M.syncSpeech)(); // the next clip opens this language's model
      (0, /*()*/__C.capPublish)();
      (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stCaptionsNowListenFor', 'Captions now listen for {lang}.').replace('{lang}', (0, /*()*/__C.ccLangLabel)()));
      try { capLangAsk(); } catch (e) {}
    }
    yield 2590;
    function capLangAsk() {
      if (!__C.model.chat.capLang()) return;
      const s = __C.model.chat.capLang().suggestion();
      let c = document.getElementById('caplang');
      if (c && !c.hidden) { if (!s || s.lang !== c.dataset.lang) c.hidden = true; return; }   // asking already, or no longer true
      if (!s) return;
      const heard = (0, /*()*/__C.capLangName)(s.lang), mine = (0, /*()*/__C.capLangName)((0, /*()*/__C.capLangMine)());
      if (!c) { c = document.createElement('div'); c.id = 'caplang'; c.className = 'capcard'; c.setAttribute('role', 'dialog'); document.body.appendChild(c); }
      c.dataset.lang = s.lang;
      c.innerHTML = '<div class="capcard-t"></div><div class="capcard-body"><div class="capcard-h"></div></div><div class="capcard-b dlg-actions"></div>';
      c.querySelector('.capcard-t').textContent = (0, /*()*/__C.uiText)('capLangAsk', 'Others hear you speaking {heard}, but your captions listen for {mine}. Switch your captions to {heard}?').split('{heard}').join(heard).split('{mine}').join(mine);
      c.querySelector('.capcard-h').textContent = (0, /*()*/__C.uiText)('capLangLater', 'You can change this any time: Settings, then Captions language.');
      const b = c.querySelector('.capcard-b');
      const btn = (src, t, fn) => { const x = document.createElement('button'); x.type = 'button'; x.dataset.src = src; x.textContent = t; x.onclick = () => { c.hidden = true; fn(); }; b.appendChild(x); };
      btn('switch', (0, /*()*/__C.uiText)('capLangSwitch', 'Switch to {heard}').split('{heard}').join(heard), () => { if (__C.clog) (0, /*()*/__C.clog)('caplang switch', s.lang); ccLangSet((0, /*()*/__C.capLangTag)(s.lang)); });
      btn('keep', (0, /*()*/__C.uiText)('capLangKeep', 'Keep {mine}').split('{mine}').join(mine), () => { if (__C.clog) (0, /*()*/__C.clog)('caplang keep', s.lang); __C.model.chat.capLang().keep(s.lang); });
      c.hidden = false;
      if (window.__gifosBarAvoid) window.__gifosBarAvoid();   // above the floating bar, like the captions card
      if (__C.clog) (0, /*()*/__C.clog)('caplang ask', s.lang, s.n, s.need, (0, /*()*/__C.trLangOf)((0, /*()*/__C.capLangMine)()));
    }
    yield 2604;
    function paintCcLocal() {
      const el = document.getElementById('cclocal-st'); if (!el) return;
      const blocked = (0, /*()*/__C.ccLocalBlocked)();
      let t;
      if (blocked) t = '⚠ ' + blocked;
      else if (__C.model.chat.ccLocal().state === 'ready') t = '✅ ' + (0, /*()*/__C.uiText)('setCcLocalReady', 'Ready. The speech model is on this phone.');
      else if (__C.model.chat.ccLocal().state === 'loading') t = __C.model.chat.ccLocal().cached ? (0, /*()*/__C.uiText)('setCcLocalStarting', 'Starting the speech model…') : (0, /*()*/__C.uiText)('setCcLocalLoading', 'Downloading the speech model: {pct}% of {mb} MB, once.').replace('{pct}', String(__C.model.chat.ccLocal().total ? Math.floor(100 * __C.model.chat.ccLocal().loaded / __C.model.chat.ccLocal().total) : 0)).replace('{mb}', String((0, /*()*/__C.ccMB)(__C.model.chat.ccLocal().total)));
      else t = (0, /*()*/__C.uiText)('setCcLocalIdle', 'The speech model downloads once from gifos.app the first time your microphone is on, and stays on this phone.');
      if (el.textContent !== t) el.textContent = t;
    }
    yield 2670;
    function paintPhoneCaptions() {
      const row = document.querySelector('input[name="ccengine"][value="browser"]');
      const lab = row && row.closest('label'); if (!lab) return;
      const b = lab.querySelector('b'), sm = lab.querySelector('small');
      if (b) { b.removeAttribute('data-t'); b.textContent = (0, /*()*/__C.uiText)('setCcPhone', 'On this phone'); }
      if (sm) { sm.removeAttribute('data-t'); sm.textContent = (0, /*()*/__C.uiText)('setCcPhoneHelp', 'Captions are made on this phone. No voice is ever sent to any server: only the caption text goes to the meeting. The first time a language is used, the phone may download its speech model once.'); }
      for (const id of ['ccwhisper-st', 'ccwhisper-weak', 'ccwhisper', 'cctranslate-row', 'cctranslate-no', 'cctranslate-need', 'ccears-row']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
      const w = document.querySelector('input[name="ccengine"][value="whisper"]'), wl = w && w.closest('label'); if (wl) wl.style.display = 'none';
    }
    function paintCcState() {
      // The Meet app's own on-device engine first (GifosNative), then the browser's on-phone model (CC_ON_PHONE).
      const lrow = document.getElementById('cclocal-row'), erow = document.getElementById('ccengine-row');
      const ccLocalShown = __C.model.consts.CC_ON_PHONE() && !(0, /*()*/__M.phoneCaptions)();
      if (lrow) lrow.style.display = ccLocalShown ? '' : 'none';
      if (erow) erow.style.display = ccLocalShown ? 'none' : '';
      if ((0, /*()*/__M.phoneCaptions)()) { const r = document.querySelector('input[name="ccengine"][value="browser"]'); if (r) r.checked = true; paintPhoneCaptions(); return; }
      if (__C.model.consts.CC_ON_PHONE()) { __C.model.chat.ccLocalQ().paint(); return; }
      const radios = Array.from(document.querySelectorAll('input[name="ccengine"]')); if (!radios.length) return;
      const box = document.getElementById('ccwhisper'), state = document.getElementById('ccwhisper-state');
      const on = (0, /*()*/__M.ccEngine)() === 'whisper';
      for (const r of radios) r.checked = (r.value === 'whisper') === on;
      box.style.display = on ? '' : 'none';
      // A weak device: the Whisper row is not selectable; a plain warning and
      // an explicit "use it anyway" stand in for it.
      const allowed = (0, /*()*/__M.whisperAllowed)();
      for (const r of radios) if (r.value === 'whisper') r.disabled = !allowed;
      paintTrEnBox();
      { const ce = document.getElementById('ccears'), cr = document.getElementById('ccears-row'); if (ce) { const ok = (0, /*()*/__M.whisperSupported)(); ce.disabled = !ok; ce.checked = ok && (0, /*()*/__C.lsGet)(__M.CC_EARS_KEY) === '1'; if (cr) cr.style.opacity = ok ? '' : '.5'; } }
      (0, /*()*/__M.wspPaintSafe)();
      const weak = document.getElementById('ccwhisper-weak');
      if (weak) {
        if (allowed) { weak.style.display = 'none'; weak.innerHTML = ''; }
        else {
          weak.style.display = '';
          const where = __M.WSP_WEAK === 'phone' ? (0, /*()*/__C.uiText)('setCcWeakPhone', 'a phone') : __M.WSP_WEAK === 'cores' ? (0, /*()*/__C.uiText)('setCcWeakCores', 'a device with this few processor cores') : (0, /*()*/__C.uiText)('setCcWeakMem', 'a device with this little memory');
          weak.innerHTML = '<span style="color:#ffd23c">⚠ ' + (0, /*()*/__C.uiText)('setCcWeak', 'Not offered on {where}.').replace('{where}', where)
            + '</span> ' + (0, /*()*/__C.uiText)('setCcWeakWhy', 'Whisper runs on the processor: it slows the call for you and everyone you talk to, and it drains the battery. Browser captions stay instant.')
            + ' <button id="ccwhisper-anyway" class="seg" style="border:1px solid #ffd23c;border-radius:.4rem">' + (0, /*()*/__C.uiText)('setCcAnyway', 'Use Whisper anyway') + '</button>';
          document.getElementById('ccwhisper-anyway').onclick = () => {
            (0, /*()*/__C.lsSet)(__M.CC_WHISPER_ANYWAY_KEY, '1');
            (0, /*()*/__C.lsSet)(__M.CC_ENGINE_KEY, 'whisper');
            (0, /*()*/__M.wspResume)();
            (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stWhisperIsOnByYour', 'Whisper is on by your choice. If the call gets slow, pick Browser captions in Settings → Captions; Whisper also steps back by itself.'), 12000);
            paintCcState();
            (0, /*()*/__M.syncSpeech)();
          };
        }
      }
      if (!on) return;
      const a = (0, /*()*/__C.whisperReady)() ? GifOS.providers.assigned('stt') : null;
      if (a) {
        state.innerHTML = '✅ ' + (0, /*()*/__C.uiText)('setCcReady', 'Ready:') + ' <b>' + (0, /*()*/__C.esc)(a.appName || 'your speech-to-text app') + '</b> ' + (0, /*()*/__C.uiText)('setCcReadyTail', 'answers on this device.')
          + (__C.model.consts.IS_MOBILE() ? ' <span style="color:#ffd23c">' + (0, /*()*/__C.uiText)('setCcPhoneSlow', 'On a phone a sentence can take 5 to 10 seconds to appear, and it uses battery.') + '</span>' : '');
        return;
      }
      // A failed install offers Retry on the status line above; one button, not two.
      const failed = !__M.whisperInstalling && !!__M.wspInst.err;
      state.innerHTML = (0, /*()*/__C.uiText)('setCcNeed', 'Needs the <b>Offline Captions (Whisper)</b> app — 13 MB, once per computer; the model itself downloads once from gifos.app the first time captions run, and stays on this device.')
        + (failed ? ' ' : ' <button id="ccwhisper-install" class="seg" style="border:1px solid var(--accent,#7b5cff);border-radius:.4rem;color:#fff;background:var(--accent,#7b5cff)"' + (__M.whisperInstalling ? ' disabled' : '') + '>' + (0, /*()*/__C.uiText)('setCcInstall', 'Install it now') + '</button> ')
        + '<span id="ccwhisper-prog">' + (__M.whisperInstalling ? (0, /*()*/__C.esc)(__M.wspInst.note) : '') + '</span> <a href="/store#app=' + __M.WHISPER_APP_ID + '" target="_blank" rel="noopener" style="color:var(--accent2,#ff5caa);font-size:.8rem">' + (0, /*()*/__C.uiText)('setCcStore', 'or from the App Store') + '</a>';
      const ib = document.getElementById('ccwhisper-install');
      if (ib) ib.onclick = () => { (0, /*()*/__M.installWhisper)(true).catch(() => {}); paintCcState(); };
      (0, /*()*/__M.armWhisperRescan)();
    }
    // Translate everything to English: greyed, with the reason, where this
    // browser cannot run Whisper; otherwise it shows the saved choice.
    function paintTrEnBox() {
      const tr = document.getElementById('cctranslate'), no = document.getElementById('cctranslate-no'), row = document.getElementById('cctranslate-row');
      if (!tr) return;
      const ok = (0, /*()*/__M.whisperSupported)();
      tr.disabled = !ok;
      tr.checked = ok && (0, /*()*/__C.lsGet)(__M.CC_TRANSLATE_KEY) === '1';
      if (row) row.style.opacity = ok ? '' : '.5';
      if (no) no.style.display = ok ? 'none' : '';
      // Whisper can run here but is not installed: the box stays live (ticking
      // it picks Whisper) and says that nothing is translated until it is.
      const need = document.getElementById('cctranslate-need');
      if (need) need.style.display = ok && !(0, /*()*/__C.whisperReady)() ? '' : 'none';
    }
    yield 2681;
    function paintWspStatus() {
      const chosen = (0, /*()*/__M.whisperChosen)();
      const s = chosen ? (0, /*()*/__M.wspState)() : { k: '' };
      const run = chosen && !(0, /*()*/__M.wspWorking)(s.k) ? (0, /*()*/__M.capsRunningNow)() : '';
      const label = chosen ? (0, /*()*/__M.wspStateText)(s) : '';
      const retry = s.k === 'failed';
      const sig = [s.k, label, run, chosen && s.k === 'installing' ? __M.wspInst.note : ''].join('|');
      if (sig === __M.wspStSig) return;
      __M.wspStSig = sig;
      const el = document.getElementById('ccwhisper-st');
      if (el) {
        el.style.display = chosen ? '' : 'none';
        el.dataset.st = s.k;
        const now = run === 'browser' ? (0, /*()*/__C.uiText)('wspRunBrowser', 'Browser captions are running now.') : run === 'none' ? (0, /*()*/__C.uiText)('wspRunNone', 'No captions are running from this device.') : '';
        el.innerHTML = chosen ? '<b>' + (0, /*()*/__C.esc)(label) + '</b>'
          + (retry ? ' <button id="ccwhisper-retry" class="seg" style="border:1px solid #ffd23c;border-radius:.4rem">' + (0, /*()*/__C.esc)((0, /*()*/__C.uiText)('wspRetry', 'Retry')) + '</button>' : '')
          + (s.k === 'installing' && __M.wspInst.note ? ' <small>' + (0, /*()*/__C.esc)(__M.wspInst.note) + '</small>' : '')
          + (now ? ' ' + (0, /*()*/__C.esc)(now) : '') : '';
        const rb = document.getElementById('ccwhisper-retry'); if (rb) rb.onclick = __M.wspRetry;
      }
      // The meeting's own place: the captions mark in the header. It shows only
      // while this page sends or receives captions (paintTxMark), so this adds
      // to it and never shows it by itself.
      const tx = document.getElementById('txwsp');
      if (tx) {
        tx.dataset.st = s.k;
        tx.textContent = chosen ? ' · ' + label + (run === 'browser' ? (0, /*()*/__C.uiText)('wspRunBrowserShort', ', browser captions on') : run === 'none' ? (0, /*()*/__C.uiText)('wspRunNoneShort', ', no captions from you') : '') : '';
      }
    }
    yield 2688;
    function paintWspChip() {
      const chip = document.getElementById('ccwsp-off'); if (!chip) return;
      if (__C.model.consts.CC_ON_PHONE()) { if (chip.style.display !== 'none') chip.style.display = 'none'; return; }
      if (!(0, /*()*/__M.wspPaintSafe)()) return;
      let show = false;
      if (__C.model.me.myId() && (0, /*()*/__M.whisperChosen)() && ((0, /*()*/__C.capSend)() || (0, /*()*/__C.trWrites)()) && !(0, /*()*/__M.wspChipGone)()) {
        const k = (0, /*()*/__M.wspState)().k;
        if (k === 'missing' || k === 'failed' || k === 'unsupported') {
          if (__M.wspChip.k !== k) { __M.wspChip.k = k; __M.wspChip.at = Date.now(); }
          show = Date.now() - __M.wspChip.at < __M.WSP_CHIP_MS;
        } else __M.wspChip.k = '';
      }
      const want = show ? '' : 'none';
      if (chip.style.display !== want) chip.style.display = want;
    }
    yield 2691;
    setInterval(() => {
      paintWspChip();
      const now = Date.now();
      const late = __M.wspTickAt ? now - __M.wspTickAt - __M.WSP_TICK_MS : 0;
      // A hidden tab's timers are throttled on purpose; that is not a stall.
      if (document.visibilityState !== 'visible' || !(__M.wspCaps.size || __M.wspQ.busy) || (0, /*()*/__M.ccEngine)() === 'local') { __M.wspTickAt = document.visibilityState === 'visible' ? now : 0; __M.wspStarved.length = 0; return; }
      __M.wspTickAt = now;
      if (late < __M.WSP_STARVE_MS) return;
      __M.wspStarved = __M.wspStarved.filter((t) => now - t < __M.WSP_STARVE_WIN);
      __M.wspStarved.push(now);
      if (__M.wspStarved.length < __M.WSP_STARVE_N) return;
      __M.wspStarved.length = 0;
      (0, /*()*/__M.wspToBrowser)('Whisper was slowing this device and the call down — browser captions are on. Settings → Captions to try it again.');
    }, __M.WSP_TICK_MS);
    (function wireCcEngine() {
      const radios = Array.from(document.querySelectorAll('input[name="ccengine"]')); if (!radios.length) return;
      const tr = document.getElementById('cctranslate'), words = document.getElementById('ccwords');
      words.value = (0, /*()*/__C.lsGet)(__M.CC_WORDS_KEY);
      // Only Whisper translates: ticking the box picks Whisper as the engine
      // (one tap, the same as picking it above). Unticking leaves the engine.
      tr.onchange = () => {
        if (tr.checked && !(0, /*()*/__M.whisperSupported)()) { paintTrEnBox(); return; }
        (0, /*()*/__C.lsSet)(__M.CC_TRANSLATE_KEY, tr.checked ? '1' : '');
        const wr = radios.find((r) => r.value === 'whisper');
        if (tr.checked && (0, /*()*/__M.ccEngine)() !== 'whisper' && wr) { wr.checked = true; wr.onchange(); }
        try { (0, /*()*/__M.trEnSync)(); (0, /*()*/__M.wspSync)(); } catch (e) {}
        paintCcState();
      };
      // Whisper checks other people's captions only when this box is ticked (a person who picked Browser captions never gets it by itself).
      const ears = document.getElementById('ccears');
      if (ears) ears.onchange = () => {
        (0, /*()*/__C.lsSet)(__M.CC_EARS_KEY, ears.checked ? '1' : '');
        try { (0, /*()*/__M.wspSync)(); } catch (e) {}
        paintCcState();
      };
      words.onchange = () => (0, /*()*/__C.lsSet)(__M.CC_WORDS_KEY, words.value.replace(/\s+/g, ' ').trim().slice(0, 400));
      wireTranscriptControls();
      for (const r of radios) r.onchange = () => {
        if (!r.checked) return;
        if (r.value === 'whisper' && !(0, /*()*/__M.whisperAllowed)()) { paintCcState(); return; } // only the explicit override turns it on here
        (0, /*()*/__C.lsSet)(__M.CC_ENGINE_KEY, r.value === 'whisper' ? 'whisper' : '');
        if (r.value !== 'whisper') {
          __M.speechGaveUp = false;
          // Picking Browser is the way back while a model is loading or answering:
          // stop the capture and unload the provider, same as the meeting chip.
          (0, /*()*/__M.stopWhisper)();
          (0, /*()*/__M.wspRelease)();
        }
        if (r.value === 'whisper') (0, /*()*/__M.wspResume)(); // a deliberate re-pick retries a stalled Whisper and forgets why it last stopped
        if (r.value === 'whisper' && __C.model.consts.IS_MOBILE()) (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stOnAPhoneWhisperRuns', 'On a phone, Whisper runs on the processor: a sentence can take 5 to 10 seconds to appear, and it uses battery. Browser captions stay instant.'), 12000);
        paintCcState();
        (0, /*()*/__M.syncSpeech)();
      };
      paintCcState();
      document.getElementById('setbtn').addEventListener('click', () => { paintCcState(); paintTranscriptControls(); });
      document.getElementById('ccwsp-use').onclick = () => { (0, /*()*/__M.wspToBrowser)((0, /*()*/__C.uiText)('stBrowserCaptionsOnWhisperOff', 'Browser captions are on. Whisper is off on this device.')); paintWspChip(); };
      document.getElementById('ccwsp-x').onclick = () => {
        __M.wspChip.gone = true;
        try { sessionStorage.setItem('gifos_wsp_chip_gone', (0, /*()*/__M.wspChipRoom)()); } catch (e) {}
        paintWspChip();
      };
      // The quiet seed: 20 s into a meeting, on an unmetered computer, once. Idle, so it
      // does not compete with the call. A phone or a cellular link never starts it.
      setTimeout(() => {
        const run = () => {
          const seeded = (0, /*()*/__C.lsGet)(__M.WHISPER_SEED_KEY);
          const triedAt = /^tried:(\d+)$/.test(seeded) ? Number(seeded.slice(6)) : 0;
          if (seeded === 'done' || (triedAt && Date.now() - triedAt < 86400000)) return;
          if ((0, /*()*/__M.whisperSeedBlocked)()) return;
          if (!navigator.onLine || (0, /*()*/__C.whisperReady)() || !window.GifOS || !GifOS.providers || !__C.model.me.myId() || document.body.classList.contains('app-room')) return;
          (0, /*()*/__M.installWhisper)(false).catch(() => {});
        };
        if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 8000 });
        else run();
      }, 20000);
    })();
    yield 2698;
    function paintTxMark() {
      const el = document.getElementById('txmark'); if (!el) return;
      const why = (0, /*()*/__C.txMarkWhy)();
      const words = why === 'sending' ? (0, /*()*/__C.uiText)('sendingCaptions', 'Sending captions') : why === 'paused' ? (0, /*()*/__C.uiText)('stCaptionsPaused', 'Captions paused') : why === 'receiving' ? (0, /*()*/__C.uiText)('receivingCaptions', 'Receiving captions') : '';
      const want = why ? '' : 'none';
      if (el.style.display !== want) el.style.display = want;
      if (el.dataset.why !== why) {
        el.dataset.why = why;
        const w = el.querySelector('span'); if (w) w.textContent = words;
        el.setAttribute('aria-label', words);
      }
    }
    yield 2701;
    function paintTranscriptControls() {
      const send = document.getElementById('ccsend'); if (send) send.checked = (0, /*()*/__C.capSend)();
      const shots = document.getElementById('trshots'); if (shots) { try { shots.checked = shotsOn(); shots.disabled = !(0, /*()*/__C.trKeeps)(); } catch (e) {} }
      const mode = (0, /*()*/__C.trMode)();
      for (const r of document.querySelectorAll('input[name="trmode"]')) r.checked = (r.value || '') === (mode || 'off') || (r.value === 'off' && !mode);
      const can = document.getElementById('ccsend-can');
      if (can) {
        const ok = __C.model.consts.CC_ON_PHONE() ? !__C.model.chat.ccLocalQ().blocked() : (!(typeof __M.browserCaptionsMissing === 'function' && (0, /*()*/__M.browserCaptionsMissing)()) || ((0, /*()*/__M.ccEngine)() === 'whisper' && (0, /*()*/__C.whisperReady)()));
        can.style.display = ok ? 'none' : '';
      }
    }
    function wireTranscriptControls() {
      const send = document.getElementById('ccsend');
      if (send) send.onchange = () => { (0, /*()*/__C.setCapSend)(send.checked); (0, /*()*/__C.setStatus)(send.checked ? (0, /*()*/__C.uiText)('stSendingCaptionsOn', 'Sending your captions to the meeting.') : (0, /*()*/__C.uiText)('stSendingCaptionsOff', 'Your captions are off. The others may still write you down.'), 6000); };
      for (const r of document.querySelectorAll('input[name="trmode"]')) r.onchange = () => {
        if (!r.checked) return;
        (0, /*()*/__C.setTrMode)(r.value === 'off' ? '' : r.value);
        (0, /*()*/__C.setStatus)(r.value === 'share' ? (0, /*()*/__C.uiText)('stTranscriptShare', 'You keep a transcript and share the voices you write down with the room.') : r.value === 'keep' ? (0, /*()*/__C.uiText)('stTranscriptKeep', 'You keep a transcript on this device.') : (0, /*()*/__C.uiText)('stTranscriptOff', 'No transcript is kept on this device.'), 6000);
      };
      const shots = document.getElementById('trshots');
      if (shots) shots.onchange = () => {
        (0, /*()*/__C.lsSet)(shotsKey(), shots.checked ? 'on' : 'off');
        (0, /*()*/__C.setStatus)(shots.checked ? (0, /*()*/__C.uiText)('stTrShotsOn', 'Your transcript keeps a screenshot of each new screen that is shared.') : (0, /*()*/__C.uiText)('stTrShotsOff', 'No screenshots of shared screens are taken.'), 6000);
      };
      paintTranscriptControls();
      try { GifOS.shareShots.attach(shareShotsSource()); } catch (e) {}   // a surface without the library takes none
    }
    yield 2738;
    // CC only shows or hides captions on this screen. The More button and the
    // dock button are one switch.
    function paintCcView() {
      const on = !!__C.model.chat.ccShow();
      const ccBtn = document.getElementById('ccbtn');
      const ccDock = document.getElementById('ccdock');
      if (ccBtn) {
        ccBtn.classList.toggle('on', on);
        ccBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      if (ccDock) {
        ccDock.classList.toggle('on', on);
        ccDock.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      if (!on) {
        const bar = document.getElementById('livecap');
        if (bar) bar.classList.remove('show');
        const caps = document.querySelectorAll('.tile .cap.show');
        for (let i = 0; i < caps.length; i++) caps[i].classList.remove('show');
      }
    }
    yield 2741;
    const ccDockBtn = document.getElementById('ccdock');
    yield 2754;
    // The same download the embed's Transcript panel runs (js/core/view/kit.js trDownload).
    document.getElementById('trdl').onclick = () => GifOS.viewKit.trDownload(__C, (0, /*()*/__M.transcriptFile)(), shotWho);
    yield 2759;
    const recBtn = document.getElementById('recbtn');
    yield 2773;
    function showRecReplay(saved) {
      const old = document.getElementById('rec-replay');
      if (old) old.remove();
      const already = !!(saved && saved.saved);
      const bg = document.createElement('div');
      bg.id = 'rec-replay';
      bg.className = 'rec-replay';
      bg.setAttribute('role', 'dialog');
      bg.setAttribute('aria-modal', 'true');
      bg.setAttribute('aria-label', 'Replay');
      bg.innerHTML = '<p class="rec-replay-title">Replay</p>' +
        '<video id="rec-replay-vid" playsinline></video>' +
        '<div class="rec-replay-bar">' +
        (saved && saved.seed ? '<p id="rec-replay-seed" class="rec-replay-seed">The broadcast has ended.</p>' : '') +
        '<input id="rec-replay-scrub" type="range" min="0" max="1000" value="0" aria-label="Replay position">' +
        '<div class="rec-replay-actions">' +
        '<button type="button" id="rec-replay-share" hidden>Share</button>' +
        '<button type="button" id="rec-replay-save">Save</button>' +
        '<button type="button" id="rec-replay-rebroadcast" hidden>Rebroadcast</button>' +
        '<button type="button" id="rec-replay-close">Close</button>' +
        '</div></div>';
      document.body.appendChild(bg);
      const vid = bg.querySelector('video');
      const scrub = bg.querySelector('#rec-replay-scrub');
      const saveBtn = bg.querySelector('#rec-replay-save');
      vid.src = saved.href;
      let kept = already;
      const keep = () => { if (kept) return; kept = true; (0, /*()*/__M.recDownload)(saved); };
      // The file is ready before the tap: a share sheet only opens inside
      // the tap, and Safari's tap does not outlast a fetch.
      const shareBtn = bg.querySelector('#rec-replay-share');
      let shareFile = null;
      let sent = false;
      if (navigator.share && navigator.canShare) {
        fetch(saved.href).then((r) => r.blob()).then((blob) => {
          if (!bg.isConnected || !blob.size) return;
          const name = saved.name || (0, /*()*/__M.recFileName)();
          const f = new File([blob], name, { type: String(blob.type || 'video/webm').split(';')[0] });
          let ok = false;
          try { ok = navigator.canShare({ files: [f] }); } catch (e) {}
          if (!ok) return;
          shareFile = f;
          shareBtn.hidden = false;
          shareBtn.parentNode.classList.add('can-share');
        }).catch(() => {});
      }
      shareBtn.onclick = () => {
        if (!shareFile) return;
        Promise.resolve(navigator.share({ files: [shareFile], title: 'Replay' })).then(() => {
          // Sent is kept: Close does not download a second copy.
          sent = true;
        }).catch((e) => {
          if (e && e.name === 'AbortError') return;
          keep();
        });
      };
      vid.addEventListener('timeupdate', () => {
        if (!vid.duration || !isFinite(vid.duration)) return;
        scrub.value = String(Math.round(vid.currentTime / vid.duration * 1000));
      });
      scrub.addEventListener('input', () => {
        if (!vid.duration || !isFinite(vid.duration)) return;
        vid.currentTime = (Number(scrub.value) / 1000) * vid.duration;
      });
      vid.addEventListener('click', () => {
        if (vid.paused) { const p = vid.play(); if (p && p.catch) p.catch(() => {}); }
        else vid.pause();
      });
      if (already) saveBtn.hidden = true;
      else saveBtn.onclick = () => keep();
      // The host plays it into the room again (Q77). The sheet comes back
      // when the rebroadcast stops, so Save and Close still wait here.
      const rbB = bg.querySelector('#rec-replay-rebroadcast');
      if (__C.model.room.BROADCAST() && (0, /*()*/__C.bcHostStored)()) {
        rbB.hidden = false;
        rbB.onclick = () => {
          const blob = fetch(saved.href).then((r) => r.blob());
          try { vid.pause(); } catch (e) {}
          vid.removeAttribute('src');
          try { vid.load(); } catch (e) {}
          bg.remove();
          (0, /*()*/__M.rbStart)({ blob: blob, title: 'Last ' + (0, /*()*/__C.rbNoun)(), last: true, saved: saved });
        };
      }
      bg.querySelector('#rec-replay-close').onclick = () => {
        if (!sent) keep();
        try { vid.pause(); } catch (e) {}
        vid.removeAttribute('src');
        try { vid.load(); } catch (e) {}
        bg.remove();
        (0, /*()*/__M.recRelease)(saved);
        if (saved && saved.seed) (0, /*()*/__C.leaveSeededService)();
      };
      const play = vid.play();
      if (play && play.catch) play.catch(() => {});
    }
    function showServiceEnded(saved) {
      const old = document.getElementById('rb-sheet');
      if (old) old.remove();
      const noun = 'broadcast';
      const bg = document.createElement('div');
      bg.id = 'rb-sheet'; bg.className = 'rb-sheet';
      bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-label', 'The ' + noun + ' has ended');
      bg.innerHTML = '<div class="rb-card"><p class="rb-title">The ' + noun + ' has ended.</p>' +
        '<p class="rb-why">Anyone who opens the link now reads that it ended. You can play the recording again live into this room; viewers see Prerecorded.</p>' +
        '<button type="button" id="se-rebroadcast">Rebroadcast it live</button>' +
        '<button type="button" id="se-save">Save the recording</button>' +
        '<button type="button" id="se-leave">Leave</button></div>';
      document.body.appendChild(bg);
      let kept = !!saved.saved;
      bg.querySelector('#se-save').onclick = () => { if (!kept) { kept = true; (0, /*()*/__M.recDownload)(saved); } bg.querySelector('#se-save').textContent = 'Saved'; };
      bg.querySelector('#se-rebroadcast').onclick = () => {
        bg.remove();
        // Back on air: the ended seat's outgoing hold lifts (camera and mic
        // stay off; the recording is the picture).
        try { __C.act.backOnAir(); } catch (e) {}
        (0, /*()*/__M.rbStart)({ blob: fetch(saved.href).then((r) => r.blob()), title: 'Last ' + noun, last: true });
      };
      bg.querySelector('#se-leave').onclick = () => { bg.remove(); (0, /*()*/__M.recRelease)(saved); (0, /*()*/__C.leaveSeededService)(); };
    }
    yield 2804;
    function showRecOptions() {
      if (__M.recStarting) return;
      if (document.getElementById('rec-options')) return;
      const hasApp = (0, /*()*/__C.findSharedApp)() && (0, /*()*/__M.canScreenRecord)();
      const bg = document.createElement('div'); bg.className = 'name-modal'; bg.id = 'rec-options';
      // Stage when someone is on it. Otherwise the widest scope that still
      // has people: the stadium needs "everything", a row records the row,
      // and an empty stage is never the default — Start used to pick it,
      // bail, and close the sheet before anyone could read why.
      const service = __C.model.room.BROADCAST();
      const srcNow = (0, /*()*/__M.recSources)();
      const scopeDefault = service ? 'stage' : (srcNow.stage.length ? 'stage' : (srcNow.stadium.length ? 'all' : (srcNow.row.length ? 'row' : 'stage')));
      const stageSub = srcNow.stage.length
        ? 'Just the front — the reader or speaker, verbatim. One clean feed.'
        : 'Nobody is on the stage yet.';
      const opt = (val, name, ttl, sub) => '<label class="rec-opt"><input type="radio" name="' + name + '" value="' + val + '"' + (val === scopeDefault ? ' checked' : '') + '> <span><b>' + ttl + '</b><small>' + sub + '</small></span></label>';
      const qDef = (0, /*()*/__C.recDefaultQuality)(__C.model.consts.IS_MOBILE());
      const qRadio = (val, label) => '<label class="rec-opt inline"><input type="radio" name="rec-q" value="' + val + '"' + (qDef === val ? ' checked' : '') + '> ' + label + '</label>';
      const scopeLine = (v) => v === 'stage' ? 'This records the stage.'
        : v === 'row' ? 'This records you and the people with you.'
        : v === 'app' ? 'This records the shared app as well.'
        : 'This records everyone you can see.';
      bg.innerHTML = '<div class="name-box rec-box">' +
        '<h3>Record this ' + (__C.model.room.BROADCAST() ? 'broadcast' : 'meeting') + '</h3>' +
        '<p class="rec-note">Saved on this device only. Everyone here will see that this ' + (__C.model.room.BROADCAST() ? 'broadcast' : 'meeting') + ' is being recorded.</p>' +
        '<p id="rec-now">' + scopeLine(scopeDefault) + '</p>' +
        '<div class="rec-scroll">' +
        '<div class="rec-sec"><b>What to capture</b>' +
        opt('stage', 'rec-scope', 'The stage', stageSub) +
        opt('row', 'rec-scope', 'Stage + my row', 'The stage plus the people right around you.') +
        opt('all', 'rec-scope', 'Everything I see', 'The whole screen — stage, your row, the stadium. The crowd is folded, as shown.') +
        (hasApp ? opt('app', 'rec-scope', 'With the shared app', 'Capture this tab so the app and tiles record together.') : '') +
        '</div>' +
        '<div class="rec-sec"><b>Quality</b>' +
        qRadio('low', 'Low · 720p') +
        qRadio('std', 'Standard · 1080p') +
        qRadio('high', 'High · 1080p') +
        (__C.model.consts.IS_MOBILE() ? '<p>On a phone, 720p is the default. 1080p is drawn on the processor and fills memory fast.</p>' : '') +
        '</div>' +
        '<label class="rec-opt inline" style="margin-top:.3rem"><input type="checkbox" id="rec-matchmix" checked> Match my sound mix (record what I hear)</label>' +
        '<div id="rec-lib"></div>' +
        '</div>' +
        '<p id="rec-err" hidden></p>' +
        '<div class="rec-actions">' +
        '<button id="ro-start" class="appear-primary" type="button">Start recording</button>' +
        '<button id="ro-cancel" class="appear-secondary" type="button">Cancel</button></div></div>';
      document.body.appendChild(bg);
      (0, /*()*/__M.recLibraryOption)(bg);
      const paintScope = () => {
        const picked = bg.querySelector('input[name=rec-scope]:checked');
        const line = bg.querySelector('#rec-now');
        if (line && picked) line.textContent = scopeLine(picked.value);
      };
      bg.querySelectorAll('input[name=rec-scope]').forEach((el) => { el.addEventListener('change', paintScope); });
      const close = (0, /*()*/__M.openModal)(bg, () => { if (bg.parentNode) bg.remove(); });
      bg.querySelector('#ro-cancel').onclick = () => close();
      bg.querySelector('#ro-start').onclick = async () => {
        if (__M.recStarting) return;
        const scope = bg.querySelector('input[name=rec-scope]:checked').value;
        const quality = bg.querySelector('input[name=rec-q]:checked').value;
        const matchMix = bg.querySelector('#rec-matchmix').checked;
        const lib = bg.querySelector('#rec-tolib');
        const err = await (0, /*()*/__M.startRec)({ scope, quality, matchMix, toLibrary: !!(lib && lib.checked) });
        if (typeof err === 'string' && err) {
          const el = bg.querySelector('#rec-err');
          if (el) { el.hidden = false; el.textContent = err; }
          return;
        }
        close();
      };
    }
    yield 2808;
    // A sideways phone puts Live and Record in a column left of the dock
    // and steps the dock right if the column needs the room. Live (a
    // broadcast) makes the column taller than the dock, and a dragged dock
    // is where its owner put it; both keep the row, as does a screen too
    // narrow for column and dock. Measured from offset boxes, which ignore
    // the slide of a tucking dock. Returns how far the column rises above
    // the dock's top, or -1 for the row.
    function placeCallState(row) {
      const root = document.documentElement;
      const bar = document.querySelector('.bar');
      const vw = window.innerWidth, vh = window.innerHeight;
      const want = !!bar && vh < 500 && vw > vh && bar.dataset.barfree !== '1'
        && !document.body.classList.contains('broadcast');
      const fall = () => {
        row.classList.remove('beside');
        if (root.style.getPropertyValue('--dockshift') !== '0px') root.style.setProperty('--dockshift', '0px');
        return -1;
      };
      if (!want) return fall();
      row.classList.add('beside');
      const barW = bar.offsetWidth, barH = bar.offsetHeight;
      const barBottom = vh - (bar.offsetTop + barH);
      // Centered: the dock's own left before any shift.
      const barLeft = (vw - barW) / 2;
      const colRight = row.offsetLeft + row.offsetWidth;
      const shift = Math.max(0, Math.ceil(colRight + 8 - barLeft));
      if (barLeft + shift + barW > vw - 8) return fall();
      root.style.setProperty('--dockshift', shift + 'px');
      root.style.setProperty('--csb', Math.max(0, Math.round(barBottom)) + 'px');
      return Math.max(0, row.offsetHeight - barH);
    }
    // Record never rises into the header (Invite, Help, Full screen, Fit):
    // the row's bottom stays at least its own height under the header's
    // lowest edge, whatever the dock measured.
    function capCallState(row) {
      let hb = 0;
      for (const el of document.querySelectorAll('#appbar, .topchip, #fitbtn')) {
        if (!el.getClientRects().length) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.height < 2 || r.top > window.innerHeight / 2) continue;
        hb = Math.max(hb, r.bottom);
      }
      const cap = Math.max(0, Math.floor(window.innerHeight - hb - row.offsetHeight - 8)) + 'px';
      const root = document.documentElement;
      if (root.style.getPropertyValue('--cs-cap') !== cap) root.style.setProperty('--cs-cap', cap);
      return cap;
    }
    function paintCallState() {
      const row = document.getElementById('callstate');
      const rec = document.getElementById('call-rec');
      const lob = document.getElementById('lobby');
      if (!row || !rec) return;
      const inCall = !(lob && lob.classList.contains('show'));
      const away = document.body.classList.contains('chrome-away');
      row.hidden = !inCall;
      const bar = document.querySelector('.bar');
      // More hides this row (display:none). Captions repaints before the
      // sheet folds, and a 0 height then parks the caption on Live.
      const covered = !!(bar && !bar.classList.contains('collapsed'));
      let over = -1, cap = '', stateH = 0;
      if (!covered) {
        over = inCall ? placeCallState(row) : -1;
        cap = inCall ? capCallState(row) : '';
        // Beside the dock, only the part above the dock's top stacks under
        // captions and the chat line.
        stateH = (!away && inCall && row.offsetHeight) ? (over >= 0 ? over : row.offsetHeight) : 0;
        document.documentElement.style.setProperty('--stateh', stateH + 'px');
      }
      if (!inCall) return;
      const recOn = recBtn.classList.contains('on') || (recBtn.textContent || '').indexOf('Stop') === 0;
      rec.classList.toggle('on', recOn);
      rec.setAttribute('aria-pressed', recOn ? 'true' : 'false');
      rec.textContent = recOn ? 'Recording' : 'Record';
      if (typeof paintCcView === 'function') paintCcView();
      try { if (typeof __M.refreshTrBtn === 'function') (0, /*()*/__M.refreshTrBtn)(); } catch (e) {}
      if (covered) return;
      const key = row.offsetHeight + ':' + (row.hidden ? '0' : '1') + ':' + over + ':' + cap;
      if (key !== __M.callStateBox) {
        __M.callStateBox = key;
        try { layout(); } catch (e) {}
      }
    }
    document.getElementById('call-rec').onclick = () => { try { recBtn.click(); } catch (e) {} };
    const callStateWatch = new MutationObserver(() => { try { paintCallState(); } catch (e) {} });
    callStateWatch.observe(recBtn, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true, characterData: true });
    const ccWatch = document.getElementById('ccbtn');
    if (ccWatch) callStateWatch.observe(ccWatch, { attributes: true, attributeFilter: ['class'] });
    const lobWatch = document.getElementById('lobby');
    if (lobWatch) callStateWatch.observe(lobWatch, { attributes: true, attributeFilter: ['class'] });
    yield 2819;

    // ---- popovers that hang off the dock (More, Reactions) ---------------------
    // The dock can be dragged anywhere, so a popover is placed from where the
    // dock really is, never at a fixed offset: above the dock when it fits
    // there, else below it when it fits there, else on the larger side with its
    // height capped to that side (it scrolls inside). Sideways it centres on
    // the dock and is kept inside the window. The window is the visual
    // viewport, so an on-screen keyboard counts as covered. Width and the
    // design's own height cap come from the stylesheet.
    function placeDockPopover(el, anchor) {
      if (!el || !anchor || !el.getClientRects().length) return null;
      const s = el.style;
      s.maxHeight = ''; s.bottom = 'auto'; s.right = 'auto'; s.transform = 'none'; s.margin = '0';
      s.top = '0px'; s.left = '0px';
      const o = el.getBoundingClientRect(); // the origin of the box that holds it
      const cap = parseFloat(getComputedStyle(el).maxHeight);
      const want = Math.min(el.scrollHeight + (el.offsetHeight - el.clientHeight), isFinite(cap) ? cap : Infinity);
      const vv = window.visualViewport;
      const vl = vv ? vv.offsetLeft : 0, vt = vv ? vv.offsetTop : 0;
      const vw = vv ? vv.width : window.innerWidth, vh = vv ? vv.height : window.innerHeight;
      const pad = 8, gap = 8;
      const a = anchor.getBoundingClientRect();
      const above = Math.floor(a.top - gap - (vt + pad));
      const below = Math.floor((vt + vh - pad) - (a.bottom + gap));
      const side = want <= above ? 'above' : (want <= below ? 'below' : (above >= below ? 'above' : 'below'));
      const room = Math.max(0, side === 'above' ? above : below);
      const h = Math.min(want, room);
      const w = o.width;
      const y = side === 'above' ? a.top - gap - h : a.bottom + gap;
      const x = w >= vw - 2 * pad ? vl + (vw - w) / 2
        : Math.max(vl + pad, Math.min(vl + vw - pad - w, a.left + a.width / 2 - w / 2));
      s.maxHeight = Math.floor(Math.min(room, isFinite(cap) ? cap : room)) + 'px';
      s.left = Math.round(x - o.left) + 'px';
      s.top = Math.round(y - o.top) + 'px';
      el.dataset.side = side;
      return side;
    }
    // Every open popover of the dock, placed again: on open, on a drag, on a
    // resize or rotation, and when the keyboard comes or goes.
    // Columns for each group of the More sheet: the fewest lines that fit
    // the sheet's width, with the items spread evenly over them, so a group
    // never leaves one item alone on its last line (6 items are 3 and 3,
    // not 5 and 1). The grid itself is in css/meet-23b.css (--mcols).
    function layoutSheet() {
      const sheet = document.getElementById('barmore');
      if (!sheet || !sheet.getClientRects().length) return;
      const phone = phoneLayout();
      const minW = phone ? 76 : 150, gap = 6;
      for (const row of sheet.querySelectorAll('.moregroup > .morerow')) {
        let n = 0;
        for (const el of row.children) if (el.tagName === 'BUTTON' && el.getClientRects().length) n++;
        if (!n) continue;
        const most = Math.max(1, Math.floor((row.clientWidth + gap) / (minW + gap)));
        const lines = Math.ceil(n / most);
        let cols = Math.ceil(n / lines);
        for (let c = cols; c <= most; c++) {
          if (n <= c || n % c !== 1) { cols = c; break; }
        }
        const v = String(Math.min(cols, most));
        if (row.style.getPropertyValue('--mcols') !== v) row.style.setProperty('--mcols', v);
        if (row.style.getPropertyValue('--mmax') !== String(most)) row.style.setProperty('--mmax', String(most));
      }
    }
    function placeDockPopovers() {
      const bar = document.querySelector('.bar');
      if (!bar) return;
      if (!bar.classList.contains('collapsed')) {
        try { layoutSheet(); } catch (e) {}
        placeDockPopover(document.getElementById('barmore'), bar);
      }
      const tray = document.getElementById('reacttray');
      if (tray && !tray.hasAttribute('hidden')) placeDockPopover(tray, bar);
      const chooser = document.getElementById('camchooser');
      if (chooser && !chooser.hidden) {
        const anchor = document.getElementById(chooser.dataset.anchor || '') || document.getElementById('cam');
        if (anchor) placeDockPopover(chooser, anchor);
      }
      const micCh = document.getElementById('micchooser');
      if (micCh && !micCh.hidden) placeDockPopover(micCh, document.getElementById('mic'));
    }
    {
      let popFrame = 0;
      const later = () => {
        if (popFrame) return;
        popFrame = requestAnimationFrame(() => { popFrame = 0; try { placeDockPopovers(); } catch (e) {} });
      };
      window.addEventListener('resize', later);
      window.addEventListener('orientationchange', later);
      if (window.visualViewport) {
        visualViewport.addEventListener('resize', later);
        visualViewport.addEventListener('scroll', later);
      }
    }

    // ---- no band for the floating bar (Nathan 2026-11-09) ----------------------
    // The bar can stand anywhere, so nothing reserves a band for it on any
    // screen. Whatever must not sit under the bar measures the bar's CURRENT box
    // (a drag included), never its home band. Each rule keeps the bottom safe
    // area (--inset-bottom) in its own CSS.
    // Floaters rest at the bottom: their CSS bottom is their own gap, plus the
    // safe area, plus var(--barlift). A floater whose resting box would meet the
    // bar rises to 8px above the bar's top. One that would not stays down. A
    // floater stacked on a base (the Record row) rises at least as far as
    // its base, so it never lands on it. The Record row beside a sideways dock
    // keeps its own place (placeCallState).
    // Panels run to the bottom and pad or end by var(--barclear). When the bar,
    // together with an open reaction tray, stands over a panel's lower half,
    // the panel clears the bar's top plus 12px, capped at half the panel.
    // Otherwise it clears nothing.
    // A tucked or faded bar keeps the last values, so nothing jumps when it wakes.
    function placeBarAvoiders() {
      const FLOATERS = [['callstate', ''], ['chatnote', 'callstate'], ['livecap', 'callstate'], 
        ['waitlist', ''], ['rb-now', ''], ['bc-cap', ''], ['bc-reacts', ''],
        ['capwarn', ''], ['capsrc', ''], ['caplang', '']];   // the captions cards: every button above the floating bar
      const PANELS = [['chatpanel', 'pad'], ['qa', 'pad'], ['bc-ended', 'bottom'], ['bc-ident', 'bottom'], ['fsstrip', 'strip']];
      const bar = document.querySelector('.bar');
      if (!bar || bar.classList.contains('tucked') || document.body.classList.contains('chrome-away')) return;
      const shown = (el) => {
        if (!el || el.hidden) return null;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 ? r : null;
      };
      const meet = (a, b) => a.right > b.left + 4 && a.left < b.right - 4 && a.bottom > b.top + 4 && a.top < b.bottom - 4;
      const read = (el, name) => parseFloat(el.style.getPropertyValue(name)) || 0;
      const write = (el, name, v) => {
        const s = Math.max(0, Math.round(v)) + 'px';
        if (el.style.getPropertyValue(name) !== s) el.style.setProperty(name, s);
      };
      const br = shown(bar);
      let ob = br ? { left: br.left, right: br.right, top: br.top, bottom: br.bottom } : null;
      const lifts = {}, risen = [];
      for (const [id, baseId] of FLOATERS) {
        const el = document.getElementById(id);
        const r = shown(el);
        if (!r) continue;
        const cur = read(el, '--barlift');
        let lift = baseId && lifts[baseId] !== undefined ? lifts[baseId] : 0;
        if (el.classList.contains('beside')) lift = 0;
        else if (ob) {
          const restBottom = r.bottom + cur;
          const at = { left: r.left, right: r.right, top: r.top + cur - lift, bottom: restBottom - lift };
          if (meet(ob, at)) lift = Math.max(lift, restBottom - ob.top + 8);
        }
        write(el, '--barlift', lift);
        lifts[id] = lift;
        // a floater lifted onto the bar's top (Record, a caption) is part of what the Focus strip clears
        if (lift > 0) risen.push({ left: r.left, right: r.right, top: r.top + cur - lift, bottom: r.bottom + cur - lift });
      }
      const tray = shown(document.getElementById('reacttray'));
      if (ob && tray) ob = { left: Math.min(ob.left, tray.left), right: Math.max(ob.right, tray.right), top: Math.min(ob.top, tray.top), bottom: Math.max(ob.bottom, tray.bottom) };
      for (const [id, mode] of PANELS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = shown(el);
        let clear = 0;
        if (r && ob && mode === 'strip') {
          // The Focus strip's thumbs are controls: every one stays above the
          // bar, so the strip pads by the bar's whole reach, not half its height.
          const overX = ob.right > r.left + 4 && ob.left < r.right - 4;
          if (overX && ob.bottom > r.top + 4 && ob.top < r.bottom) {
            let top = ob.top;
            for (const f of risen) if (f.right > r.left + 4 && f.left < r.right - 4 && f.bottom > top - 12) top = Math.min(top, f.top);
            clear = r.bottom - top + 8;
          }
        } else if (r && ob) {
          const bottom = r.bottom + (mode === 'bottom' ? read(el, '--barclear') : 0);
          const h = bottom - r.top;
          const overX = ob.right > r.left + 4 && ob.left < r.right - 4;
          if (overX && ob.bottom > r.top + h / 2) clear = Math.min(bottom - ob.top + 12, h / 2);
        }
        write(el, '--barclear', clear);
      }
    }
    {
      let avoidFrame = 0;
      const later = () => {
        if (avoidFrame) return;
        avoidFrame = requestAnimationFrame(() => { avoidFrame = 0; try { placeBarAvoiders(); } catch (e) {} });
      };
      window.__gifosBarAvoid = later;
      // Showing, hiding or opening one of them can newly put it under the bar.
      const ids = ['callstate', 'chatnote', 'livecap', 'waitlist', 'bc-cap', 'bc-reacts', 'chatpanel', 'qa', 'bc-ended', 'bc-ident', 'reacttray', 'fsview'];
      if (window.MutationObserver) {
        const mo = new MutationObserver(later);
        for (const id of ids) { const el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['class', 'hidden'] }); }
      }
      // A caption or a chat line that grows a line can newly meet the bar.
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(later);
        for (const id of ['callstate', 'chatnote', 'livecap', 'bc-cap']) { const el = document.getElementById(id); if (el) ro.observe(el); }
      }
      window.addEventListener('resize', later);
      window.addEventListener('orientationchange', later);
    }

    // ---- controls: mic + camera. Blur is chosen when the camera turns on. -----
    const micBtn = document.getElementById('mic');
    const unmuteBtn = document.getElementById('unmute');
    const camBtn = document.getElementById('cam');

    // Collapsible header — keep it to a single row (mic / camera / blur) and
    // fold the rest behind "More". More always starts closed. A stored open
    // used to come back after a reload, including after No blur.
    (function () {
      const bar = document.querySelector('.bar'), toggle = document.getElementById('bartoggle');
      // LM-44: the More sheet is fixed inside the dock's transform, so it
      // rides wherever the dock goes. A dock tucked by the idle timer stands
      // 128px under the screen; a sheet opened over it (an automation or
      // accessibility click, not a finger: the tucked dock takes no taps)
      // ran off the bottom and cut Settings and Keys. Opening More wakes
      // the dock first (set below, once wakeDock exists).
      let wakeForSheet = null;
      function apply(collapsed) {
        if (!collapsed && wakeForSheet) wakeForSheet();
        bar.classList.toggle('collapsed', collapsed);
        toggle.setAttribute('aria-expanded', String(!collapsed));
        const service = __C.model.room.BROADCAST();
        const surface = service ? 'broadcast' : 'meeting';
        bar.setAttribute('aria-label', service ? 'Broadcast controls' : 'Meeting controls');
        toggle.setAttribute('aria-label', collapsed ? 'More' : 'Hide ' + surface + ' controls');
        toggle.title = collapsed ? 'More' : 'Hide ' + surface + ' controls';
        // The word stays the screen's ("More"); open or shut is aria-expanded, aria-label and title.
        // An upright phone shows the whole sheet when it fits above the
        // dock (a guest's 577px sheet, Settings and Keys included: LM-44).
        // A host's longer sheet would reach the top of the call, so it
        // keeps two rows on the first screen and the rest scrolls.
        if (!collapsed) {
          const sheet = document.getElementById('barmore');
          bar.classList.remove('more-rows');
          const upright = window.matchMedia && matchMedia('(max-width: 700px) and (orientation: portrait)').matches;
          if (sheet && upright && sheet.scrollHeight > sheet.clientHeight + 2) bar.classList.add('more-rows');
        }
        // The fold is what shows Live again. Measure it after the class
        // changes, not while More still hides the row.
        try { paintCallState(); } catch (e) {}
        if (!collapsed) { try { paintStandIns(); } catch (e) {} }
        if (!collapsed) placeDockPopovers();
      }
      toggle.onclick = function () {
        const next = !bar.classList.contains('collapsed'); apply(next);
        try { localStorage.setItem('gifos_meet_bar', next ? '1' : '0'); } catch (e) {}
      };
      // 0 meant "leave More open". A reload must not bring the sheet back.
      try { if (localStorage.getItem('gifos_meet_bar') === '0') localStorage.setItem('gifos_meet_bar', '1'); } catch (e) {}
      apply(true);
      const grip = document.getElementById('bargrip');
      let dockx = 0, docky = 0, tucked = false, idleTimer = 0, idleMs = 8000;
      // A small group tucks the dock once the call sits quiet. A service keeps
      // it: volunteers need the large controls without hunting for them.
      // A small group tucks the dock once the call sits quiet (qa-meet-mobile);
      // a wide window also fades it sooner (dock-calm, qa-meet-desktop). A service
      // keeps it: volunteers need the large controls without hunting for them.
      const personalCall = () => !(__C.model.room.BROADCAST());
      const dockShown = () => bar.getClientRects().length > 0;
      const dockBusy = () => {
        if (!bar.classList.contains('collapsed')) return true;
        const tray = document.getElementById('reacttray');
        if (tray && !tray.hasAttribute('hidden')) return true;
        const chooser = document.getElementById('camchooser');
        if (chooser && !chooser.hidden) return true;
        const micCh = document.getElementById('micchooser');
        if (micCh && !micCh.hidden) return true;
        const vpk = document.getElementById('viewpick');
        if (vpk && !vpk.hidden && !vpk.dataset.picked) return true;
        const ae = document.activeElement;
        if (ae && ae !== document.body && ae !== document.documentElement) {
          if (bar.contains(ae)) return true;
          const tag = (ae.tagName || '').toLowerCase();
          if (tag === 'input' || tag === 'textarea' || tag === 'select' || ae.isContentEditable) return true;
        }
        for (const el of document.querySelectorAll('.name-modal')) {
          if (el.style.display !== 'none') return true;
        }
        return false;
      };
      // Two translates, not one calc() and not left/bottom. Mixing a % and a
      // length inside translateX() is dropped. Setting left and bottom is
      // serialized as the inset shorthand, which also pins top, so the dock
      // cannot move upward. A tuck is an extra downward shift in the same
      // translate, including when the grip is still centered.
      // The bar floats over the call (z 32) and reserves no band. An open
      // chat or transcript panel (body.chatside) never squishes it: no phone
      // sizes, no button moved into More, no re-centring on the call. The bar
      // keeps its size, its buttons and its spot, over the panel if that is
      // where it stands, and its owner can drag it (Nathan 2026-11-09). The
      // panel's composer moves up by its own --barclear only where the bar
      // really stands over it (placeBarAvoiders).
      // Only the screen sends a button to More (fitWindow, Nathan 2026-11-09).
      // When the bar at home still runs past the window, these move one at a
      // time. More shows a stand-in that presses the real button.
      const fitOrder = ['sharebtn', 'reactbtn', 'stagebtn'];
      let fitKey = '';
      // Words are fixed per screen (dockLabelSet); only a state class can
      // still change a slot's CSS width (a phone camera at Max or Min blur).
      // Each slot is locked at its widest state when the screen is fitted.
      const dockStateClasses = (id) => (id === 'cam' ? ['cam-max', 'cam-min'] : []);
      const lockDockWidths = () => {
        for (const b of bar.children) {
          if (!b || !b.style || b.id === 'barmore' || b.id === 'reacttray' || b.id === 'bargrip' || b.id === 'barrec') continue;
          b.style.width = ''; b.style.minWidth = '';
          let w = b.offsetWidth || 0;
          for (const cls of dockStateClasses(b.id)) {
            const had = b.classList.contains(cls);
            b.classList.add(cls);
            w = Math.max(w, b.offsetWidth || 0);
            if (!had) b.classList.remove(cls);
          }
          if (w > 0) { b.style.boxSizing = 'border-box'; b.style.width = w + 'px'; b.style.minWidth = w + 'px'; }
        }
      };
      // The width the dock's own buttons need, even when the dock is capped
      // to the window and they run past its edge. More's panel is not counted.
      // The reaction tray is a popover on the bar, not a slot: counting it
      // made the row look too wide the moment React opened, and React's slot
      // collapsed under the finger.
      const dockNeed = () => {
        let lo = Infinity, hi = -Infinity;
        for (const el of bar.children) {
          if (el.id === 'barmore' || el.id === 'reacttray' || el.id === 'barrec') continue;
          for (const r of el.getClientRects()) { if (r.width) { lo = Math.min(lo, r.left); hi = Math.max(hi, r.right); } }
        }
        if (hi < lo) return bar.offsetWidth;
        const cs = getComputedStyle(bar);
        return hi - lo + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
      };
      const paintStandIns = () => {
        // The stand-ins and their row carry [hidden] in the markup; a
        // display style alone never showed them, so a moved button was
        // on neither the dock nor More.
        let any = false;
        for (const p of bar.querySelectorAll('#barmore .dockmore')) {
          const b = document.getElementById(p.dataset.dock);
          const on = !!(b && b.parentElement === bar && b.classList.contains('inmore'));
          p.style.display = on ? '' : 'none';
          p.hidden = !on;
          any = any || on;
          if (!on) continue;
          const lab = b.querySelector('.docklab');
          p.textContent = lab ? lab.textContent : (b.getAttribute('aria-label') || p.textContent);
          p.title = b.title;
        }
        const row = document.getElementById('dockrow');
        if (row) row.hidden = !any;
      };
      // The fit is worked out only when the window's size changes (fitKey),
      // with every slot at its widest state and the bar measured at home: a
      // drag, a tuck, an open panel or More, a share, the stage, a hand, a
      // grayed button or a host flag never sends a button to More or back.
      // A dock past the window moves Share, then Reactions, then Step off
      // into More; the right edge decides (a 390px host rounded the span to
      // the window while Leave still stuck out).
      const fitWindow = () => {
        if (!bar.offsetWidth) return; // not on screen yet: its first paint fits it
        const key = window.innerWidth + 'x' + window.innerHeight;
        if (key !== fitKey) {
          fitKey = key;
          for (const id of fitOrder) { const b = document.getElementById(id); if (b) b.classList.remove('inmore'); }
          lockDockWidths();
          const room = window.innerWidth;
          const st = bar.style;
          const keep = [st.left, st.top, st.right, st.bottom, st.transform];
          st.left = ''; st.top = ''; st.right = ''; st.bottom = ''; st.transform = '';
          const rowPast = () => {
            if (dockNeed() > room + 0.5) return true;
            let hi = -Infinity, lo = Infinity;
            for (const el of bar.children) {
              if (el.id === 'barmore' || el.id === 'reacttray' || el.classList.contains('inmore')) continue;
              for (const r of el.getClientRects()) {
                if (r.width) { lo = Math.min(lo, r.left); hi = Math.max(hi, r.right); }
              }
            }
            return hi > room + 0.5 || lo < -0.5;
          };
          try {
            for (const id of fitOrder) {
              if (!rowPast()) break;
              const b = document.getElementById(id);
              if (b && b.parentElement === bar && !b.classList.contains('inmore') && b.getClientRects().length) b.classList.add('inmore');
            }
          } finally {
            st.left = keep[0]; st.top = keep[1]; st.right = keep[2]; st.bottom = keep[3]; st.transform = keep[4];
          }
        }
        paintStandIns();
      };
      for (const p of bar.querySelectorAll('#barmore .dockmore')) {
        p.addEventListener('click', () => {
          const b = document.getElementById(p.dataset.dock);
          toggle.click(); // close More first, as its own items do
          if (b) b.click();
        });
      }
      // A free position (left/top from the bar drag) is read whenever it is
      // set, so a tuck or a resize keeps that spot instead of an older offset.
      const adoptFree = () => {
        if (bar.dataset.barfree !== '1' || !bar.style.left) return;
        const r = bar.getBoundingClientRect();
        const st = bar.style, keep = { l: st.left, t: st.top, r: st.right, b: st.bottom, tr: st.transform };
        st.left = ''; st.top = ''; st.right = ''; st.bottom = ''; st.transform = '';
        const d = bar.getBoundingClientRect(); // where the centred dock stands
        st.left = keep.l; st.top = keep.t; st.right = keep.r; st.bottom = keep.b; st.transform = keep.tr;
        dockx = r.left - d.left; docky = d.top - r.top;
      };
      // Width from the bar's left through the grab tab. The tab is the left control.
      const tabSpan = () => {
        if (!grip) return 0;
        const br = bar.getBoundingClientRect();
        const gr = grip.getBoundingClientRect();
        if (!(gr.width > 0) || !(br.width > 0)) return 0;
        return gr.right - br.left;
      };
      // Home is the window's centre. An open panel changes nothing here: the
      // spot is the owner's (dockx, docky), clamped only to the window and the tab.
      const placeDock = () => {
        adoptFree();
        fitWindow();
        const w = bar.offsetWidth, h = bar.offsetHeight;
        const maxX = Math.max(0, (window.innerWidth - w) / 2 - 8);
        const maxY = Math.max(0, window.innerHeight - h - 22);
        const left0 = window.innerWidth / 2 - w / 2;
        const span = tabSpan();
        if (window.GifOS && GifOS.meetLayout && typeof GifOS.meetLayout.clampBar === 'function' && span > 0) {
          const abs = GifOS.meetLayout.clampBar({ x: left0 + dockx, y: 0 }, { w: w, h: h, tab: span }, { w: window.innerWidth, h: window.innerHeight });
          dockx = Math.max(-maxX, abs.x - left0);
        } else {
          dockx = Math.max(-maxX, Math.min(maxX, dockx));
        }
        docky = Math.max(-6, Math.min(maxY, docky));
        bar.style.left = '';
        bar.style.right = '';
        bar.style.top = '';
        bar.style.bottom = '';
        const extra = tucked ? (h + Math.max(0, docky) + 40) : 0;
        if (!extra && dockx === 0 && docky === 0) bar.style.transform = '';
        else bar.style.transform = 'translateX(-50%) translate(' + dockx + 'px, ' + (-docky + extra) + 'px)';
        // The open sheet and tray follow the dock to wherever it now stands.
        placeDockPopovers();
        // What must not sit under the bar follows where it now stands.
        try { placeBarAvoiders(); } catch (e) {}
      };
      const markTuck = (on) => {
        tucked = !!on;
        bar.classList.toggle('tucked', tucked);
        document.body.classList.toggle('dock-idle', tucked);
        if (tucked) bar.setAttribute('aria-hidden', 'true');
        else bar.removeAttribute('aria-hidden');
        placeDock();
      };
      // Someone coming in or leaving is not a quiet call: the dock waits a
      // whole quiet spell with the count still. It tucked on the first
      // person while the next ones were still loading, before Video was used.
      const roomCount = () => { try { return (0, /*()*/__C.participantCount)(); } catch (e) { return 0; } };
      const scheduleIdle = () => {
        clearTimeout(idleTimer);
        if (!personalCall()) return;
        const seen = roomCount();
        idleTimer = setTimeout(() => {
          if (!personalCall() || dockBusy() || roomCount() !== seen || !dockShown()) { scheduleIdle(); return; }
          markTuck(true);
        }, idleMs);
      };
      const wakeDock = () => {
        if (tucked) markTuck(false);
        scheduleIdle();
      };
      // A dock nobody can see (an app room before room audio) is not a quiet
      // call: it never tucks, and when it appears it starts a whole quiet
      // spell, so its controls come up where the person can reach them.
      let dockWasShown = dockShown();
      // The first time the bar is on screen is when its fit can be measured.
      if (window.ResizeObserver) new ResizeObserver(() => {
        const shown = dockShown();
        if (shown && !dockWasShown) { wakeDock(); try { placeDock(); } catch (e) {} }
        dockWasShown = shown;
      }).observe(bar);
      wakeForSheet = wakeDock;
      window.addEventListener('pointerdown', wakeDock, true);
      window.addEventListener('pointermove', wakeDock, true);
      window.addEventListener('keydown', wakeDock, true);
      window.addEventListener('focusin', wakeDock, true);
      scheduleIdle();
      window.__gifosDock = {
        get idleMs() { return idleMs; },
        setIdle(ms) { idleMs = ms; scheduleIdle(); },
        tuck() {
          if (!personalCall() || dockBusy() || !dockShown()) return false;
          clearTimeout(idleTimer);
          markTuck(true);
          return true;
        },
        wake() { wakeDock(); return !tucked; },
        place: placeDock,
        refit() { fitKey = ''; placeDock(); },
      };
      const nudge = (dx, dy) => { try { (0, /*()*/__M.dismissCamChooser)(); } catch (e) {} dockx += dx; docky += dy; placeDock(); };
      const resetDock = () => { try { (0, /*()*/__M.dismissCamChooser)(); } catch (e) {} dockx = 0; docky = 0; placeDock(); };
      window.addEventListener('resize', () => { try { (0, /*()*/__M.dismissCamChooser)(); } catch (e) {} placeDock(); });
      // Nothing the call does refits the bar (Nathan 2026-11-09): no observer
      // on its buttons, no refit beside the chat panel. A new window size
      // does (resize above), and so does the first paint of the dock's font.
      try {
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitKey = ''; try { placeDock(); } catch (e) {} });
      } catch (e) {}
      if (grip) {
        grip.addEventListener('keydown', (e) => {
          const step = e.shiftKey ? 48 : 24;
          if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-step, 0); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(step, 0); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); nudge(0, step); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); nudge(0, -step); }
        });
        grip.addEventListener('dblclick', (e) => { e.preventDefault(); resetDock(); });
        let drag = null, lastTap = 0;
        grip.addEventListener('pointerdown', (e) => {
          if (e.button != null && e.button !== 0) return;
          try { (0, /*()*/__M.dismissCamChooser)(); } catch (err) {}
          try { grip.setPointerCapture(e.pointerId); } catch (err) {}
          drag = { x: e.clientX, y: e.clientY, dockx: dockx, docky: docky, moved: false };
        });
        grip.addEventListener('pointermove', (e) => {
          if (!drag) return;
          const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
          dockx = drag.dockx; docky = drag.docky;
          nudge(dx, -dy);
        });
        grip.addEventListener('pointerup', () => {
          if (!drag) return;
          const moved = drag.moved;
          drag = null;
          const now = Date.now();
          if (!moved && now - lastTap < 400) { resetDock(); lastTap = 0; }
          else if (!moved) lastTap = now;
        });
        grip.addEventListener('pointercancel', () => { drag = null; });
      }
      // A pick in More folds the sheet once the button has acted, so nobody
      // has to press Hide after it. Blur, your video, and the host switches
      // fold too. A text field is not a button, so typing a start time never
      // folds it. The fold is saved closed, so a reload cannot open More.
      const moreSheet = document.getElementById('barmore');
      if (moreSheet) moreSheet.addEventListener('click', (e) => {
        if (!e.isTrusted || bar.classList.contains('collapsed')) return;
        const btn = e.target && e.target.closest ? e.target.closest('button') : null;
        if (!btn || !moreSheet.contains(btn)) return;
        // Hiding the sheet blurs a focused control inside it, so remember
        // that first and put the keyboard back on More.
        const returnFocus = moreSheet.contains(document.activeElement);
        apply(true);
        try { localStorage.setItem('gifos_meet_bar', '1'); } catch (err) {}
        if (returnFocus) toggle.focus();
      });
      // More closes the way a menu does: the toggle again, Escape (the
      // modal keydown handler), or a tap anywhere outside the sheet and the
      // bar. The tap still reaches what it landed on. A tap on the bar is
      // the bar's own (the toggle folds).
      const foldSheet = () => {
        if (bar.classList.contains('collapsed')) return false;
        const returnFocus = !!(moreSheet && moreSheet.contains(document.activeElement));
        apply(true);
        try { localStorage.setItem('gifos_meet_bar', '1'); } catch (err) {}
        if (returnFocus) toggle.focus();
        return true;
      };
      document.addEventListener('pointerdown', (e) => {
        if (bar.classList.contains('collapsed') || !e.isTrusted) return;
        const t = e.target;
        if (t && t.closest && (bar.contains(t) || t.closest('#reacttray'))) return;
        foldSheet();
      }, true);
      // Publish the bar's own height so the fixed overlays that hang from the
      // top (the chat panel) can start BELOW it instead of on top of it. It has
      // to be measured, not assumed: the bar wraps, and collapsing it changes
      // the height too. Observed rather than computed at open time, so a wrap
      // caused by a window resize or a button appearing mid-meeting (Admin,
      // Transcript, Share screen) moves it as well. Where ResizeObserver is
      // missing the variable stays unset and everything behaves exactly as it
      // did before — the fallback is the old bug, not a broken layout.
      // The dock sits at the bottom, so a panel that used to clear a top bar
      // starts at the top of the page instead.
      let lastDock = -1;
      function safeBottomPx() {
        let probe = document.getElementById('gifos-safe-b');
        if (!probe) {
          probe = document.createElement('div');
          probe.id = 'gifos-safe-b';
          probe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden';
          document.body.appendChild(probe);
        }
        return probe.offsetHeight || 0;
      }
      const setBarH = () => {
        try {
          document.documentElement.style.setProperty('--barh', '0px');
          const away = document.body.classList.contains('chrome-away');
          let dock;
          if (away) {
            dock = safeBottomPx();
          } else {
            // Where the dock RESTS: a fixed box's offsetTop skips the slide
            // transform, so there is nothing to wait out. Measured fresh each
            // time. Keeping the largest height ever seen let one stale reading
            // around a picture-in-picture float pin Record and Captions over
            // the system header and shrink the solo tile until a reload
            // (Nathan, 2026-10-19).
            // Home, not where a drag left it: installBar's left/top moves offsetTop too.
            const MV = window.GifOS && GifOS.meetViews;
            const home = MV && typeof MV.dockRest === 'function' ? MV.dockRest(document).top : 0;
            const rest = home > 0 ? home : (getComputedStyle(bar).position === 'fixed' ? bar.offsetTop : bar.getBoundingClientRect().top);
            dock = Math.max(0, Math.min(window.innerHeight, Math.round(window.innerHeight - rest)));
          }
          document.documentElement.style.setProperty('--dockh', dock + 'px');
          if (dock !== lastDock) {
            lastDock = dock;
            // Record hangs off the dock: its header cap follows the new height.
            try { paintCallState(); } catch (e2) {}
          }
          placeBarAvoiders();
        } catch (e) {}
      };
      // iOS keeps the layout viewport tall and overlays the keyboard.
      // visualViewport is the part still visible. --kb is that covered band.
      const syncKb = () => {
        try {
          const vv = window.visualViewport;
          const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
          document.documentElement.style.setProperty('--kb', kb + 'px');
          document.documentElement.classList.toggle('kb-up', kb > 0);
        } catch (e) {}
      };
      window.__gifosKb = { sync: syncKb };
      // A wider dock can push Record/Captions back into their row (placeCallState).
      if (window.ResizeObserver) { try { new ResizeObserver(() => { setBarH(); try { paintCallState(); } catch (e2) {} }).observe(bar); } catch (e) {} }
      // A phone can hand over the new size before its layout has caught up
      // (around a float). Measure again once the frame after it has laid out.
      let barReT = 0;
      const barRemeasure = () => {
        if (barReT) cancelAnimationFrame(barReT);
        barReT = requestAnimationFrame(() => { barReT = requestAnimationFrame(() => { barReT = 0; setBarH(); try { paintCallState(); } catch (e) {} }); });
      };
      window.addEventListener('resize', () => { setBarH(); syncKb(); try { paintCallState(); } catch (e) {} barRemeasure(); });
      window.addEventListener('focus', barRemeasure);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) barRemeasure(); });
      if (window.visualViewport) {
        visualViewport.addEventListener('resize', () => { setBarH(); syncKb(); });
        visualViewport.addEventListener('scroll', syncKb);
      }
      const chatPanelEl2 = document.getElementById('chatpanel');
      if (chatPanelEl2 && window.MutationObserver) {
        try { new MutationObserver(setBarH).observe(chatPanelEl2, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
      }
      setBarH();
      syncKb();

      // FaceTime-style quiet. The power idle (IDLE_MS) is the camera, not the
      // controls. This one only tucks Live, Record, Captions, and the dock on
      // a phone, and a tap brings them back. More, chat, a tray, a waiting
      // list, or a dialog holds them up.
      const CHROME_IDLE_MS = GifOS.timings.CHROME_IDLE_MS; // 0.9.23b: calm after 3 s
      // Dialogs and sheets that sit over the call (dialog.js shapes the same set).
      const CHROME_DIALOGS = '.name-modal, .modal-bg, .rb-sheet, .lock-modal, .perm-modal, .rec-replay';
      let chromeTimer = 0;
      let swallowClick = false;
      function phoneCall() {
        return window.matchMedia('(max-width: 700px), (max-height: 500px)').matches;
      }
      function callOpen() {
        const lob = document.getElementById('lobby');
        return !(lob && lob.classList.contains('show'));
      }
      function chromeHeld() {
        if (!callOpen() || !phoneCall()) return true;
        // A service host alone keeps the link and the dock up to invite
        // people, as the desktop dock does (busy(): alone needs Invite).
        if (__C.model.room.BROADCAST() && document.body.classList.contains('bc-host') && (0, /*()*/__C.participantCount)() < 2) return true;
        if (bar && !bar.classList.contains('collapsed')) return true;
        const chat = document.getElementById('chatpanel');
        if (chat && chat.classList.contains('open')) return true;
        const tray = document.getElementById('reacttray');
        if (tray && !tray.hasAttribute('hidden')) return true;
        const chooser = document.getElementById('camchooser');
        if (chooser && !chooser.hidden) return true;
        const micCh = document.getElementById('micchooser');
        if (micCh && !micCh.hidden) return true;
        const wait = document.getElementById('waitlist');
        if (wait && !wait.hasAttribute('hidden') && wait.getClientRects().length) return true;
        // The view picker is open: its choices stay until one is picked or it is closed.
        const vpk = document.getElementById('viewpick');
        if (vpk && !vpk.hidden && !vpk.dataset.picked) return true;
        // A tile's window is open: its controls are the screen, not chrome.
        if (window.__tileWin && window.__tileWin.isOpen()) return true;
        const modals = document.querySelectorAll('.name-modal');
        for (let i = 0; i < modals.length; i++) {
          if (modals[i].style.display === 'none') continue;
          const cs = getComputedStyle(modals[i]);
          if (cs.display !== 'none' && cs.visibility !== 'hidden') return true;
        }
        return false;
      }
      function showChrome() {
        const was = document.body.classList.contains('chrome-away');
        document.body.classList.remove('chrome-away');
        if (was) {
          try { paintCallState(); } catch (e) {}
          setBarH();
        }
        armChrome();
      }
      function hideChrome() {
        if (chromeTimer) clearTimeout(chromeTimer);
        chromeTimer = 0;
        if (chromeHeld() || document.body.classList.contains('chrome-away')) return;
        document.body.classList.add('chrome-away');
        // A view picker left open after its pick goes with the chrome.
        { const vpk = document.getElementById('viewpick'); if (vpk && !vpk.hidden && vpk.dataset.picked) { vpk.hidden = true; const fb = document.getElementById('fitbtn'); if (fb) fb.setAttribute('aria-expanded', 'false'); } }
        try { paintCallState(); } catch (e) {}
        setBarH();
      }
      function armChrome() {
        if (chromeTimer) clearTimeout(chromeTimer);
        chromeTimer = 0;
        if (chromeHeld() || document.body.classList.contains('chrome-away')) return;
        chromeTimer = setTimeout(hideChrome, CHROME_IDLE_MS);
      }
      // soft: a watched element changed, not a hand. It may end a hold, but
      // it does not restart a running quiet: a service host's dock rewrites
      // its class every 2 s (placeDock), so a phone host never went calm.
      function syncChrome(soft) {
        if (chromeHeld()) {
          if (chromeTimer) clearTimeout(chromeTimer);
          chromeTimer = 0;
          if (document.body.classList.contains('chrome-away')) showChrome();
          return;
        }
        if (soft && chromeTimer) return;
        if (!document.body.classList.contains('chrome-away')) armChrome();
      }
      // Waking on pointerdown reflows the header before pointerup. The click
      // is then aimed at .topchip (the gap the count button just left), so a
      // tap on the status chip never reaches it and the sheet stays shut.
      // Wake from the click instead: the target is already the control.
      let wakeOnClick = false;
      document.addEventListener('pointerdown', (e) => {
        // Every gesture starts clean: a swipe, a long press or a pinch ends with no click, so a flag
        // left by its pointerdown swallowed the next real tap anywhere.
        swallowClick = false; wakeOnClick = false;
        if (!callOpen() || !phoneCall()) return;
        if (!document.body.classList.contains('chrome-away')) return;
        const t = e.target;
        // #appbar never tucks while an app is up, so its tap is a press, not
        // a wake: swallowing it left Help and Abilities dead on a solo app.
        // A dialog (an app's abilities card, a sheet) is a press too: its
        // buttons were dead to every tap that came after a quiet spell.
        // The content bar never tucks, so its tabs and tools, its exit and the view menu are presses too.
        if (t && t.closest && t.closest('.fitbtn, .topchip, #unmute, #showcam, #chatnote, #chatpanel, #chatbadge, #chatpreview, .name-modal, #waitlist, #tilewin, .tile-open, #appbar, .ct-bar, .ct-exit, #viewpick, .ctarea button, ' + CHROME_DIALOGS)) {
          wakeOnClick = true;
          return;
        }
        swallowClick = true;
        showChrome();
        try { e.preventDefault(); e.stopPropagation(); } catch (err) {}
      }, true);
      document.addEventListener('click', (e) => {
        if (wakeOnClick) { wakeOnClick = false; showChrome(); }
        if (swallowClick) {
          swallowClick = false;
          try { e.preventDefault(); e.stopPropagation(); } catch (err) {}
          return;
        }
        // A phone's second tap on empty screen hides at once. A control,
        // and Open, keep the chrome. A desktop hides only on the timeout,
        // including a short window (IS_MOBILE is false there).
        if (!__C.model.consts.IS_MOBILE() || !callOpen() || !phoneCall()) return;
        if (document.body.classList.contains('chrome-away') || chromeHeld()) return;
        const t = e.target;
        if (t && t.closest && t.closest('button, a, input, select, textarea, label, .bar, #appbar, .fitbtn, .topchip, .tile-open, .name-modal, #tilewin, #tilewin-veil, #waitlist, #chatpanel, #chatnote, #unmute, #showcam, #callstate, ' + CHROME_DIALOGS)) return;
        hideChrome();
      }, true);
      document.addEventListener('click', () => { try { syncChrome(); } catch (e) {} });
      document.addEventListener('keydown', () => {
        if (document.body.classList.contains('chrome-away')) showChrome();
        else syncChrome();
      });
      // A short desktop window matches the phone query too. Its mouse wakes
      // the dock on a move, as dock-calm does; a phone's touch still needs a tap.
      document.addEventListener('pointermove', (e) => {
        if (__C.model.consts.IS_MOBILE() || e.pointerType !== 'mouse' || !callOpen() || !phoneCall()) return;
        if (document.body.classList.contains('chrome-away')) showChrome();
        else if (chromeTimer) armChrome();
      }, { capture: true, passive: true });
      bar.addEventListener('transitionend', (e) => {
        if (e.propertyName !== 'transform' && e.propertyName !== 'opacity') return;
        if (!document.body.classList.contains('chrome-away')) setBarH();
      });
      const watchChrome = (el, filter) => {
        if (!el || !window.MutationObserver) return;
        new MutationObserver(() => { try { syncChrome(true); } catch (e) {} }).observe(el, { attributes: true, attributeFilter: filter });
      };
      watchChrome(document.getElementById('lobby'), ['class']);
      watchChrome(bar, ['class']);
      watchChrome(document.getElementById('chatpanel'), ['class']);
      watchChrome(document.getElementById('reacttray'), ['hidden']);
      watchChrome(document.getElementById('camchooser'), ['hidden']);
      watchChrome(document.getElementById('micchooser'), ['hidden']);
      watchChrome(document.getElementById('waitlist'), ['hidden']);
      window.__gifosChrome = { ms: CHROME_IDLE_MS, idle: hideChrome, show: showChrome, safeBottom: safeBottomPx };
      syncChrome();
      // A hold no watched element reports (a host's first viewer comes in, a
      // dialog closes) still ends: look once a second, softly.
      setInterval(() => { try { syncChrome(true); } catch (e) {} }, 1000);
    })();
    yield 2830; // 0.9.23b: calm after 3 s
    (function () {
      document.body.classList.toggle('desk-ptr', !__C.model.consts.IS_MOBILE());
      (0, /*()*/__C.applyPageHeader)(); // Meet's manifest says auto-hide; an app's manifest can say otherwise
      const bar = document.querySelector('.bar');
      let lastInput = Date.now();
      const wake = () => {
        lastInput = Date.now();
        document.body.classList.remove('dock-calm');
        try { GifOS.viewKit.calm(false); } catch (e) {}
      };
      // A WATCHING SURFACE (a /cast viewer, the Stage view, full screen) goes calm with the dock (a phone: with the
      // chrome tuck): every control and label leaves the picture, the version label stays (viewKit.calm). An unmute
      // prompt holds it; the tap-to-unblur note is never faded.
      function watchCalm(calm) {
        const b = document.body.classList;
        if (!calm && !b.contains('chrome-away')) return false;
        const castView = !!(GifOS.viewSurface && GifOS.viewSurface.name === 'cast') || b.contains('broadcast');
        const watching = (castView && !b.contains('bc-host')) || b.contains('view-stage') || !!document.fullscreenElement;
        if (!watching) return false;
        const um = document.getElementById('unmute');
        if (um && um.getClientRects().length && getComputedStyle(um).display !== 'none' && getComputedStyle(um).visibility !== 'hidden') return false;
        return true;
      }
      for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'focusin']) {
        window.addEventListener(ev, wake, { capture: true, passive: true });
      }
      function busy() {
        if (__C.model.consts.IS_MOBILE() || document.hidden) return true; // a touch laptop wakes it on touchstart
        const n = (0, /*()*/__C.participantCount)();
        if (n < 2) return true; // alone needs Invite (0.9.23b: every larger room is calm too)
        if (joinVeilEl) return true;
        const b = document.body.classList;
        // 0.9.23b: a shared screen and a broadcast are calm too.
        for (const c of ['app-room', 'solo-app']) if (b.contains(c)) return true;
        if (!bar.classList.contains('collapsed')) return true; // More is open
        const vpk = document.getElementById('viewpick');
        if (vpk && !vpk.hidden && !vpk.dataset.picked) return true; // the view picker is open
        // A clicked button keeps focus, so only keyboard focus holds the dock.
        if (bar.matches(':hover') || bar.querySelector(':focus-visible')) return true;
        // Keyboard focus on a tile or its buttons keeps them (calm hides tile buttons too).
        if (document.querySelector('#feed :focus-visible, #feed .tile.menu')) return true;
        // A pressed state inside the folded More (Record on through a whole
        // service, Captions) is not something open; it never held the calm.
        if (bar.querySelector('[aria-expanded="true"], .on:not(#ccdock):not(#sharebtn):not(#stagebtn):not(#barmore .on)')) return true;
        const chat = document.getElementById('chatpanel');
        if (chat && chat.classList.contains('open')) return true;
        for (const d of document.querySelectorAll('[role="dialog"][aria-modal="true"]')) {
          if (d.style.display !== 'none' && d.getClientRects().length) return true;
        }
        return false;
      }
      setInterval(() => {
        let calm = false;
        try { calm = Date.now() - lastInput >= __C.model.door.dockCalmMs() && !busy(); } catch (e) {}
        if (calm !== document.body.classList.contains('dock-calm')) {
          document.body.classList.toggle('dock-calm', calm);
          const vpk = document.getElementById('viewpick');
          if (calm && vpk && !vpk.hidden && vpk.dataset.picked) { vpk.hidden = true; const fb = document.getElementById('fitbtn'); if (fb) fb.setAttribute('aria-expanded', 'false'); }
        }
        try { GifOS.viewKit.calm(watchCalm(calm)); } catch (e) {}
        // The header only goes while it is the plain count line.
        let head = calm;
        if (head) {
          const st = document.getElementById('status');
          head = !!st && st.dataset.kind === 'meeting' && !st.classList.contains('alert') && Date.now() >= __C.model.door.statusHoldUntil();
        }
        // A bot page has nobody to wake the header. The logo and the count
        // stay, or the page looks like it has only the transcribing mark.
        if (head && typeof __C.model.me.myStatus() !== 'undefined' && __C.model.me.myStatus().bot) head = false;
        if (head !== document.body.classList.contains('head-calm')) document.body.classList.toggle('head-calm', head);
      }, 250);
    })();
    yield 2832;
    const AUDIENCE_REACT_NAME = { '👏': 'claps', '👍': 'yes', '👎': 'no', '😂': 'laughs', '❤️': 'hearts' };
    yield 2835;
    let audienceReactFade = 0;
    yield 2837;
    // The burst over a tile (or the service stage). The stylesheet owns the
    // 1.6 s fade, so a second tap starts it again without a timer here.
    function flashReactBurst(parent, label) {
      if (!parent) return;
      let burst = parent.querySelector('.reactburst');
      if (!burst) { burst = document.createElement('div'); burst.className = 'reactburst'; parent.appendChild(burst); }
      burst.textContent = label;
      burst.classList.remove('show');
      void burst.offsetWidth;
      burst.classList.add('show');
    }
    // A REACTION IN A MEETING IS SEEN LIKE A RAISED HAND: by the whole room,
    // wherever the person's face is drawn. It flashes on their tile, and the
    // packers that draw their face burn it on (labelFor): their row's Stadium
    // product and, for a stager, the Stage. The Stadium picture carries that
    // mark to every other row and section, so the frame itself goes only as
    // far as the seats that draw the face: the person's own section (their row,
    // its packer, the section's tiles), and for a stager also its own links
    // (the Stage roots). Never a room-wide flood: half of a huge room reacting
    // at once costs each seat only its own section's reactions. At most 6 in
    // 10 s count from one person, sent or taken.
    const FACE_REACT_MS = GifOS.timings.FACE_REACT_MS;
    yield 2844;
    function takeFaceReact(emoji, fromId) {
      emoji = String(emoji || '');
      if (__C.model.consts.AUDIENCE_REACTS().indexOf(emoji) < 0) return false;
      const who = String(fromId || '');
      if (!who || !(0, /*()*/__C.reactRateOk)(who)) return false;
      const now = Date.now();
      if (who !== __C.model.me.myId()) { __C.model.roster.faceReactRx().set(who, (__C.model.roster.faceReactRx().get(who) || 0) + 1); if (__C.model.roster.faceReactRx().size > 400) __C.model.roster.faceReactRx().clear(); }
      __C.model.roster.faceReacts().set(who, { e: emoji, until: now + FACE_REACT_MS });
      if (__C.model.roster.faceReacts().size > 400) for (const [k, v] of __C.model.roster.faceReacts()) if (now >= v.until) __C.model.roster.faceReacts().delete(k);
      const mine = who === __C.model.me.myId();
      flashReactBurst(mine ? document.querySelector('.tile.me') : document.querySelector('.tile[data-peer="' + (window.CSS && CSS.escape ? CSS.escape(who) : who) + '"]'), emoji);
      if ((0, /*()*/__C.faceDrawnHere)(who) && typeof __M.schedReconcile === 'function') { (0, /*()*/__M.schedReconcile)(); setTimeout(__M.schedReconcile, FACE_REACT_MS + 60); }
      return true;
    }
    yield 2847;
    function sendFaceReact(emoji) {
      if (__C.model.me.myId() && takeFaceReact(emoji, __C.model.me.myId())) (0, /*()*/__C.sendFaceFrame)(emoji);
      else flashReactBurst(document.querySelector('.tile.me'), emoji);
    }
    yield 2849;
    function paintAudienceReacts() {
      const host = document.getElementById('bc-reacts');
      if (!host) return;
      const now = Date.now();
      host.textContent = '';
      let any = false;
      let soon = Infinity;
      for (let i = 0; i < __C.model.consts.AUDIENCE_REACTS().length; i++) {
        const emoji = __C.model.consts.AUDIENCE_REACTS()[i];
        const row = __C.model.roster.audienceReactCounts().get(emoji);
        if (!row || row.n < 1 || now > row.until) continue;
        any = true;
        if (row.until < soon) soon = row.until;
        const slot = document.createElement('span');
        slot.className = 'bcslot';
        const pill = document.createElement('span');
        pill.className = 'bcreact';
        const n = row.n > 999 ? '999+' : String(row.n);
        pill.textContent = emoji + ' ' + n;
        const names = (row.who || []).map((x) => x.name);
        let label = n + ' ' + AUDIENCE_REACT_NAME[emoji];
        if (names.length) {
          const more = names.length - 2;
          label += ' from ' + (names.length === 1 ? names[0] : more > 0 ? names.slice(0, 2).join(', ') + ' and ' + more + ' other' + (more === 1 ? '' : 's') : names.join(' and '));
        }
        pill.setAttribute('aria-label', label);
        slot.appendChild(pill);
        if (names.length) {
          const line = document.createElement('span');
          line.className = 'bcwho';
          line.setAttribute('aria-hidden', 'true');
          line.textContent = names.slice(0, 2).join(', ') + (names.length > 2 ? ' +' + (names.length - 2) : '');
          slot.appendChild(line);
        }
        host.appendChild(slot);
      }
      host.hidden = !any;
      clearTimeout(audienceReactFade);
      if (soon < Infinity) audienceReactFade = setTimeout(paintAudienceReacts, Math.max(0, soon - now) + 40);
    }
    yield 2853;
    (function () {
      const btn = document.getElementById('reactbtn');
      const tray = document.getElementById('reacttray');
      if (!btn || !tray) return;
      const bar = document.querySelector('.bar');
      const more = document.getElementById('bartoggle');
      const shut = () => {
        tray.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-pressed', 'false');
        btn.classList.remove('on');
      };
      // Both popovers share the same slot above the dock. Opening one closes the other.
      if (more && more.onclick) {
        const openMore = more.onclick;
        more.onclick = function (ev) {
          if (bar && bar.classList.contains('collapsed')) shut();
          return openMore.call(this, ev);
        };
      }
      btn.onclick = () => {
        if (tray.hasAttribute('hidden')) {
          if (bar && more && !bar.classList.contains('collapsed')) more.click();
          // A service host answers hands and has none to raise (no dock hand,
          // no H), so the tray leaves ✋ out for them too.
          const rh = document.getElementById('react-hand');
          if (rh) rh.hidden = !(0, /*()*/__M.canRaiseHand)();
          tray.removeAttribute('hidden');
          placeDockPopovers();
          btn.setAttribute('aria-expanded', 'true');
          btn.setAttribute('aria-pressed', 'true');
          btn.classList.add('on');
        } else shut();
      };
      tray.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.id === 'react-hand') {
          if (!(0, /*()*/__M.canRaiseHand)()) return;
          const hand = document.getElementById('hand');
          if (hand) hand.click();
          return;
        }
        const label = b.getAttribute('data-burst');
        if (!label) return;
        // A service hides the gallery, so the same clap has to land on the
        // stage or the person who sent it never sees it. The count is what
        // everyone else sees: one pill per emoji, not one burst per person.
        if (__C.model.room.BROADCAST()) {
          flashReactBurst(document.querySelector('.tile.me'), label);
          flashReactBurst(document.getElementById('bc-react'), label);
          (0, /*()*/__C.sendAudienceReact)(label);
        } else sendFaceReact(label);
      });
    })();
    yield 2857;
    function armMeetDialogs() {
      const modals = document.querySelectorAll('.name-modal');
      for (const el of modals) {
        if (el.getAttribute('role') !== 'alertdialog') el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        const h = el.querySelector('h2, h3, h4');
        if (h) {
          if (!h.id) h.id = (el.id || 'dlg') + '-title';
          if (!el.getAttribute('aria-labelledby')) el.setAttribute('aria-labelledby', h.id);
        }
      }
      // Dismissal is NOT armed here. The page-wide handler (modalDismissBtn)
      // closes a dialog only through its own cancel/close button, so each
      // dialog's close logic runs, and a dialog with no such button (the
      // locked-room password prompt, the first-run name prompt) cannot be
      // dismissed into a stranded page.
      const obs = new MutationObserver((recs) => {
        for (const r of recs) {
          const el = r.target;
          if (!el.classList || !el.classList.contains('name-modal')) continue;
          const on = el.style.display === 'flex';
          if (on && !el._dlgOn) {
            el._dlgOn = true;
            const opener = document.activeElement;
            if (opener && opener !== document.body && !el.contains(opener)) el._opener = opener;
            if (!el.contains(document.activeElement)) {
              const f = (0, /*()*/__C.focusOf)(el);
              if (f && f.focus) f.focus();
            }
          } else if (!on && el._dlgOn) {
            el._dlgOn = false;
            const back = el._opener;
            el._opener = null;
            const a = document.activeElement;
            if (back && back.focus && (!a || a === document.body || el.contains(a))) back.focus();
          }
        }
      });
      for (const el of modals) obs.observe(el, { attributes: true, attributeFilter: ['style'] });
    }
    yield 2859;

    function paintControls() {
      // mic — one labeled control. The word is the action. There is no header Unmute pill.
      const muted = __C.model.me.myStatus().muted, micLocked = (0, /*()*/__C.amGloballyMuted)();
      micBtn.classList.toggle('off', muted);
      micBtn.classList.toggle('locked', micLocked);
      micBtn.setAttribute('aria-pressed', muted ? 'false' : 'true');
      const micWord = micLocked ? (0, /*()*/__C.uiText)('micHeld', 'Muted') : (muted ? (0, /*()*/__C.uiText)('unmute', 'Unmute') : (0, /*()*/__C.uiText)('mute', 'Mute'));
      micBtn.setAttribute('aria-label', micWord);
      // The dock word stays the screen's ("Mic"); the action is aria-label and title, the state is the colour.
      micBtn.title = micLocked
        ? ((0, /*()*/__C.modOf)('me').mute.wait ? (0, /*()*/__C.micLockWords)() : 'Muted for all' + ((0, /*()*/__C.modOf)('me').mute.by ? ' by ' + (0, /*()*/__C.modOf)('me').mute.by : '') + ' — someone else has to lift it')
        : (muted ? 'You are muted — tap to speak. Shortcut: Alt+A' : 'Your mic is on — tap to mute. Shortcut: Alt+A');
      if (unmuteBtn) {
        const lob = document.getElementById('lobby');
        const inCall = !(lob && lob.classList.contains('show'));
        unmuteBtn.hidden = !inCall || !muted;
      }
      // camera — the colour and the word are this person's consent (myStatus.blur),
      // never the blur the room is actually sending. A password or a viewer who
      // has not consented can keep the picture soft while the button stays on
      // the green they picked.
      camBtn.classList.toggle('off', __C.model.me.myStatus().camOff);
      camBtn.classList.remove('cam-max', 'cam-min');
      const lvl = (0, /*()*/__C.blurLevel)(__C.model.me.myStatus().blur);
      if (!__C.model.me.myStatus().camOff && lvl === 2) camBtn.classList.add('cam-max');
      if (!__C.model.me.myStatus().camOff && lvl === 1) camBtn.classList.add('cam-min');
      // The dock word stays the screen's (Video/Camera); the blur choice is the colour, aria-label and title.
      const choosing = typeof __M.camChooserOpen === 'function' && (0, /*()*/__M.camChooserOpen)();
      camBtn.setAttribute('aria-pressed', __C.model.me.myStatus().camOff ? 'false' : 'true');
      camBtn.setAttribute('aria-expanded', choosing ? 'true' : 'false');
      camBtn.setAttribute('aria-label', __C.model.me.myStatus().camOff
        ? (choosing ? (0, /*()*/__C.uiText)('camChooseAria', 'Choose how you appear') : 'Start video')
        : (lvl === 2 ? (0, /*()*/__C.uiText)('camMaxBlur', 'Max blur') : lvl === 1 ? (0, /*()*/__C.uiText)('camMinBlur', 'Min blur') : 'Stop video'));
      camBtn.title = __C.model.me.myStatus().camOff ? 'Camera off — tap to choose Max blur, Min blur, or No blur. Shortcut: Alt+V' : 'Camera on — tap to turn off. Shortcut: Alt+V';
      paintShare();
      try { paintBarIdle(); } catch (e) {}
      if (typeof paintLiveBadge === 'function') paintLiveBadge();
      try { (0, /*()*/__C.paintOnAir)(); } catch (e) {}
      try { (0, /*()*/__C.paintBroadcastAir)(); } catch (e) {}
      try { paintClearNoPw(); } catch (e) {}
      paintAvState();
      // A no-password room whose host's signed plan lets viewers unblur: "Blur" (after this viewer tapped), and Report in
      // the More menu. Report asks first, points to the police / NCMEC and never takes content; it sends only the host's
      // credential id (reportClearHost), once per device per room.
      function paintClearNoPw() {
        const st = (0, /*()*/__C.clearNoPwState)();
        // Composite pictures (rows, the stadium, the Stage strip) carry many faces in one stream, so they are veiled
        // whole at the sender's Max: the Stage until this viewer taps, rows and the stadium until a tap under the full item.
        document.body.classList.toggle('cnp-veil-stage', !!st.mode && !st.tapped);
        document.body.classList.toggle('cnp-veil-rows', !!st.mode && !(st.mode === 'all' && st.tapped));
        let bar = document.getElementById('clearnopw-bar');
        // Report is in the More menu (beside License), never on this bar: only the viewer's own Blur is here.
        try { GifOS.viewKit.clearReportButton(__C, moreRow('room'), 'reportbtn', '', (cat, ref) => (0, /*()*/__C.reportClearHost)(cat, ref)); } catch (e) {}
        if (!st.mode) { if (bar) bar.remove(); return; }
        const T = (k, en) => (0, /*()*/__C.uiText)(k, en);
        // Blur sits inside the picture it clears (the Stage, else the largest face tile), at its top right and below the
        // top bar's measured bottom (--headh), so it never lands on a top-bar control.
        const host = clearBlurHost();
        if (!host) { if (bar) bar.remove(); return; }
        if (!bar) {
          bar = document.createElement('div');
          bar.id = 'clearnopw-bar';
          bar.innerHTML = '<button type="button" id="clearnopw-reblur"></button>';
          bar.querySelector('#clearnopw-reblur').onclick = (e) => { e.stopPropagation(); (0, /*()*/__C.blurAgain)(); };
        }
        if (bar.parentNode !== host) host.appendChild(bar);
        if (!paintClearNoPw.onResize) {
          paintClearNoPw.onResize = () => {
            const b = document.getElementById('clearnopw-bar'), h = b && clearBlurHost();
            if (!h) return;
            if (b.parentNode !== h) h.appendChild(b);
            placeClearBlur(b, h);
          };
          window.addEventListener('resize', paintClearNoPw.onResize);
        }
        const rb = bar.querySelector('#clearnopw-reblur');
        const w = T('clearBlurAgain', 'Blur');
        if (rb.textContent !== w) rb.textContent = w;
        rb.style.display = st.tapped ? '' : 'none';
        placeClearBlur(bar, host);
      }
      // The picture a viewer's Blur belongs to: the biggest Stage picture on top at its own centre (a Stage picture can be
      // laid out under another view), else the biggest face tile on the grid.
      function clearBlurHost() {
        const area = (el) => { if (!el.getClientRects().length) return 0; const r = el.getBoundingClientRect(); return r.width > 40 && r.height > 40 ? r.width * r.height : 0; };
        // On top: some point of it is hit (a dialog or a note can cover its middle for a moment).
        const onTop = (el) => {
          const r = el.getBoundingClientRect();
          for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
            const at = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
            if (at && el.contains(at)) return true;
          }
          return false;
        };
        const pick = (sel, top) => {
          let best = null, most = 0;
          for (const el of document.querySelectorAll(sel)) { const a = area(el); if (a > most && (!top || onTop(el))) { best = el; most = a; } }
          return best;
        };
        const STAGE = '#stagefeed > .rowtile, [data-stageview], #grid > .tile.onstage';
        return pick(STAGE, true) || pick('#grid > .tile', true) || pick('[data-stageview], #grid > .tile.onstage', false) || pick(STAGE, false) || pick('#grid > .tile', false);
      }
      function placeClearBlur(bar, host) {
        const top = host.getBoundingClientRect().top;
        const headh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--headh')) || 0;
        const v = Math.max(8, Math.ceil(headh - top) + 8) + 'px';
        if (bar.style.top !== v) bar.style.top = v;
      }
    }
    function paintAvState() {
      const bar = document.getElementById('avstate');
      const mic = document.getElementById('avmic');
      const cam = document.getElementById('avcam');
      if (!bar || !mic || !cam) return;
      const watching = __C.model.room.BROADCAST() && !((0, /*()*/__C.bcHostStored)() || document.body.classList.contains('amadmin'));
      let muted = false, camOff = false, locked = false;
      try {
        if (!watching && typeof __C.model.me.myStatus() !== 'undefined' && __C.model.me.myStatus()) {
          muted = !!__C.model.me.myStatus().muted;
          camOff = !!__C.model.me.myStatus().camOff;
          if (typeof __C.amGloballyMuted === 'function' && (0, /*()*/__C.amGloballyMuted)()) { muted = true; locked = true; }
        }
      } catch (e) {}
      mic.hidden = !muted;
      cam.hidden = !camOff;
      mic.textContent = locked ? 'Muted for everyone' : 'Microphone off';
      cam.textContent = 'Camera off';
      const show = muted || camOff;
      bar.hidden = !show;
      bar.className = show ? 'on' : '';
    }
    yield 2882;
    // THE SPEAKER CHOICE in More: only where a page can move the sound
    // (speakerChoices: setSinkId and more than one output). It opens the mic
    // pop-up's own element with the speaker rows alone. Where there is no
    // choice (no setSinkId, or one output: iOS) a line in its place says the
    // device's speaker plays.
    function paintSpkBtn() {
      const b = document.getElementById('spkbtn');
      const none = !(0, /*()*/__M.speakerChoices)().length;
      if (b) b.hidden = none;
      // Where no speaker can be chosen, the same place says where the sound plays.
      const n = document.getElementById('spknote');
      if (n) n.hidden = !none;
    }
    yield 2913;
    // ? lists the keys that work for this person right now (a viewer has
    // no mic or camera on the dock, so M and V are left out).
    const keysModal = document.getElementById('keys-modal');
    yield 2915;
    document.getElementById('keys-close').onclick = () => { keysModal.style.display = 'none'; };
    // One shortcut list: ? and Help's Keys open the same localized sheet
    // (toggleShortcutSheet); this older list stays for a caller that asks.
    document.getElementById('help-keys').onclick = () => {
      document.getElementById('help-modal').style.display = 'none';
      try { toggleShortcutSheet(true); } catch (e) { (0, /*()*/__M.openKeys)(); }
    };
    // Flip front/back camera (mobile convention). regrabCamera does the whole
    // swap: same MediaStream identity, senders re-fed, blur pipe rebuilt.
    document.getElementById('flipcam').onclick = () => {
      if (__C.model.room.BROADCAST() && !(0, /*()*/__C.bcMayPublishAv)()) return;
      if (!__C.model.me.localStream()) return;
      __M.camFacing = __M.camFacing === 'user' ? 'environment' : 'user';
      __M.camDeviceId = '';
      (0, /*()*/__M.regrabCamera)('flip');
    };
    yield 2919;
    function wireMediaSession() {
      const ms = navigator.mediaSession; if (!ms || !ms.setActionHandler) return;
      const wire = (action, fn) => { try { ms.setActionHandler(action, fn); } catch (e) { /* action unsupported here */ } };
      wire('togglemicrophone', () => (0, /*()*/__M.micTap)(false));   // the OS control: no chooser out of sight
      wire('togglecamera', () => {
        if (!__C.model.me.myStatus().camOff) { camBtn.onclick(); return; }
        if (GifOS.host.hidden()) return;
        camBtn.onclick();
      });
      // The OS hang-up is the Leave button: a recording in flight is flushed
      // and handed over first, and the page stays on the card for it.
      wire('hangup', () => { if (!(0, /*()*/__C.leaveMeeting)()) location.replace((0, /*()*/__C.homeHref)()); });
      // Chrome auto-enters picture-in-picture for call sites that handle this —
      // flip away and the stage follows you as a floating tile. MUST route
      // through enterPip(): registering a second handler here used to CLOBBER
      // the ranked source picker (last setActionHandler wins) with a dumb
      // tile query that could float a black camOff tile.
      wire('enterpictureinpicture', () => { pipNote('ms-action'); awayFull(true); enterPip(false, true); });
      (0, /*()*/__C.updateMediaSession)();
    }
    yield 2921;
    // The blur slider: pick Max / Min / No blur directly. It records YOUR choice;
    // whether a tile actually goes clear is the room rule's meeting — when your
    // No blur can't show yet, the status line says exactly why.
    // A note under the blur buttons that goes away on its own.
    const BLUR_NOTE_MS = GifOS.timings.BLUR_NOTE_MS;
    let blurNoteTimer = 0;
    function blurNote(text) {
      const el = document.getElementById('blurnote');
      if (!el) return;
      clearTimeout(blurNoteTimer);
      el.textContent = text;
      el.hidden = !text;
      if (text) blurNoteTimer = setTimeout(() => { el.hidden = true; el.textContent = ''; }, BLUR_NOTE_MS);
    }
    yield 2926;
    // THE NO BLUR EXPLAINER. A No blur pick that a room rule still keeps blurred
    // opens a dialog the person closes, instead of a note that faded before it
    // was read. It says why (BLUR_WHY's words, the same as the tile note) and
    // what to do. For a room with no password: a Set room password button when
    // this person can set it (the Password button is theirs), otherwise who can.
    // The blur rule itself (blurHold) is unchanged. One show per room in this
    // tab: a reload of the same meeting does not open it again. The lobby
    // preview carries its own line, so the dialog waits until the meeting.
    const BLUR_WHY_ASK = { nopw: 1, guests: 1, forall: 1, noadmin: 1 };
    yield 2930;
    function canSetRoomPw() {
      const pwb = document.getElementById('pwbtn');
      return !!pwb && !pwb.disabled;
    }
    function openBlurWhy(why) {
      const m = document.getElementById('blurwhy-modal');
      const lob = document.getElementById('lobby');
      if (lob && lob.classList.contains('show')) return false;
      if (!m || !BLUR_WHY_ASK[why]) return false;
      if ((0, /*()*/__C.heldNoteSeen)()) return false;
      const setPw = why === 'nopw' && canSetRoomPw();
      const todo = why === 'nopw'
        ? (setPw ? (0, /*()*/__C.uiText)('blurWhyDoSetPw', 'Set a room password to lift this.')
          : (0, /*()*/__C.uiText)('blurWhyDoAskAdmin', 'Ask the meeting host to set the room password, which will require everyone to re-enter the meeting with that password.'))
        : why === 'guests' ? (0, /*()*/__C.uiText)('blurWhyDoGuests', 'Ask the meeting host to lift it.')
        : why === 'forall' ? (0, /*()*/__C.uiText)('blurWhyDoForAll', 'Ask the person who blurred you to lift it.')
        : (0, /*()*/__C.uiText)('blurWhyDoNoAdmin', 'It clears when a host joins.');
      document.getElementById('blurwhy-text').textContent = (0, /*()*/__C.blurWhyWords)(why, 'says');
      document.getElementById('blurwhy-do').textContent = todo;
      const pwBtn = document.getElementById('blurwhy-pw');
      pwBtn.style.display = setPw ? '' : 'none';
      m.dataset.why = why;
      m.style.display = 'flex';
      (0, /*()*/__C.markHeldNote)();
      const first = setPw ? pwBtn : document.getElementById('blurwhy-ok');
      try { first.focus(); } catch (e) {}
      return true;
    }
    function explainHeldVideo() {
      const lob = document.getElementById('lobby');
      if (lob && lob.classList.contains('show')) return;
      if (!__C.model.me.myStatus() || __C.model.me.myStatus().blur !== 0) return;
      if (__C.model.me.myStatus().bot && __C.model.me.myStatus().camOff) return;   // an assistant with no camera shows no face: nothing is held
      let hold = '';
      try { hold = (0, /*()*/__C.blurHold)('me'); } catch (e) { return; }
      if (!hold) return;
      openBlurWhy(hold);
    }
    function closeBlurWhy() {
      const m = document.getElementById('blurwhy-modal');
      if (m) m.style.display = 'none';
      try { if (camBtn && camBtn.focus) camBtn.focus(); } catch (e) {}
    }
    (function () {
      const ok = document.getElementById('blurwhy-ok');
      if (ok) ok.onclick = closeBlurWhy;
      const pw = document.getElementById('blurwhy-pw');
      if (pw) pw.onclick = () => { closeBlurWhy(); if (canSetRoomPw()) document.getElementById('pwbtn').click(); };
    })();
    // asked: the person picked this level themselves (the camera button's
    // chooser), so a hold on No blur is explained in the dialog.
    // The blur note fades in over the picture, unless the blur dialog already says it (it stays until dismissed).
    function showBlurNoteUnlessDialog(why) {
      const whyDlg = document.getElementById('blurwhy-modal');
      if (!(whyDlg && whyDlg.style.display !== 'none')) blurNote(why);
    }
    yield 2937;
    // Each choice is an explicit pick. A lobby or Go live opener supplies
    // then(); the dock pick turns the camera on at that level.
    const camChooserEl = document.getElementById('camchooser');
    const camPicks = camChooserEl ? Array.from(camChooserEl.querySelectorAll('button')) : [];
    for (const pick of camPicks) {
      pick.onclick = () => {
        const lvl = +pick.dataset.camBlur;
        const then = __M.camPickThen;
        const back = __M.camChooserAnchor || camBtn;
        (0, /*()*/__M.closeCamChooser)();
        if (then) { then(lvl); try { if (back && back.focus) back.focus(); } catch (e) {} return; }
        (0, /*()*/__M.pickCamera)(lvl);
      };
    }
    if (camChooserEl) camChooserEl.addEventListener('keydown', (e) => {
      const buttons = Array.from(camChooserEl.querySelectorAll('button')).filter((b) => !b.disabled && !b.hidden && !(b.parentElement && b.parentElement.hidden));
      if (!buttons.length) return;
      const i = buttons.indexOf(document.activeElement);
      let next = -1;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % buttons.length;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + buttons.length) % buttons.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = buttons.length - 1;
      if (next < 0) return;
      e.preventDefault();
      try { buttons[next].focus(); } catch (err) {}
    });
    document.addEventListener('pointerdown', (e) => {
      if (!(0, /*()*/__M.camChooserOpen)()) return;
      const t = e.target;
      if (t && t.closest && t.closest('#camchooser, #cam, #lob-cam, #lob-go')) return;
      (0, /*()*/__M.dismissCamChooser)();
    }, true);
    // "Blur guests" (admin) — ONE room-wide order, modTable['*'].blur, on the
    // same signed table as the per-tile block (see modOf). It binds every
    // non-admin in the room, linked to me or not, and everyone who joins while
    // it stands; turning it off lifts it for all of them at once.
    const blurAllBtn = document.getElementById('blurall');
    yield 2945;
    function updateBlurAllBtn() {
      blurAllBtn.style.display = __C.amAdmin ? '' : 'none';
      for (const li of document.querySelectorAll('#shortcutsheet .hostkey')) li.hidden = !__C.amAdmin; // the host keys are listed for a host only
      if (!__C.amAdmin) return;
      const on = __C.model.admin.guestsBlocked();
      blurAllBtn.classList.toggle('on', on);
      blurAllBtn.textContent = on ? (0, /*()*/__C.uiText)('unblurGuests', 'Unblur guests') : (0, /*()*/__C.uiText)('blurGuests', 'Blur guests');
    }
    blurAllBtn.onclick = () => {
      if (!__C.amAdmin) return;
      const on = !__C.model.admin.guestsBlocked(); // flip: block all, or unblock all
      (0, /*()*/__C.setMod)('*', 'blur', on);       // one entry, one flood, whatever the room's size
      updateBlurAllBtn();
      (0, /*()*/__C.setStatus)(on ? 'Blurred every guest.' : 'Unblurred every guest.');
    };
    // "Video off" (admin) — the harder hammer: kills every guest's camera
    // room-wide, not just blurs it. The same one room-wide order, modTable['*'].cam.
    const camAllBtn = document.getElementById('camall');
    yield 2949;
    function updateCamAllBtn() {
      camAllBtn.style.display = __C.amAdmin ? '' : 'none';
      if (!__C.amAdmin) return;
      const on = __C.model.admin.guestsCamOff();
      camAllBtn.classList.toggle('on', on);
      camAllBtn.textContent = on ? (0, /*()*/__C.uiText)('videoOn', 'Turn video on') : (0, /*()*/__C.uiText)('videoOff', 'Turn video off');
    }
    camAllBtn.onclick = () => {
      if (!__C.amAdmin) return;
      const on = !__C.model.admin.guestsCamOff(); // flip: video off for all, or allow all
      (0, /*()*/__C.setMod)('*', 'cam', on);        // one entry, one flood, whatever the room's size
      updateCamAllBtn();
      (0, /*()*/__C.setStatus)(on ? 'Turned every guest\'s video off.' : 'Guests may turn their video back on.');
    };
    // "Mute guests" (admin) — ONE room-wide order, modTable['*'].mute. Every
    // receiver drops a muted guest's voice (modOf), and an honest guest's mic
    // locks until an admin lifts it, for one guest from the tile or for all here.
    const muteAllBtn = document.getElementById('muteall');
    yield 2953;
    function updateMuteAllBtn() {
      muteAllBtn.style.display = __C.amAdmin ? '' : 'none';
      if (!__C.amAdmin) return;
      const on = __C.model.admin.guestsMuted();
      muteAllBtn.classList.toggle('on', on);
      muteAllBtn.textContent = on ? (0, /*()*/__C.uiText)('unmuteGuests', 'Unmute guests') : (0, /*()*/__C.uiText)('muteGuests', 'Mute guests');
    }
    muteAllBtn.onclick = () => {
      if (!__C.amAdmin) return;
      const on = !__C.model.admin.guestsMuted();
      (0, /*()*/__C.setMod)('*', 'mute', on);       // one entry, one flood, whatever the room's size
      updateMuteAllBtn();
      (0, /*()*/__C.setStatus)(on ? 'Muted every guest.' : 'Guests may unmute again.');
    };
    // "Allow screen share" (admin) — ONE room-wide grant, modTable['*'].share.
    // Off until the admin turns it on. A per-tile share order still wins when
    // it is later, so one guest can be stopped while the room is allowed, or
    // allowed while the room is not.
    const shareAllBtn = document.getElementById('shareall');
    yield 2957;
    function updateShareAllBtn() {
      if (!shareAllBtn) return;
      shareAllBtn.style.display = __C.amAdmin ? '' : 'none';
      if (!__C.amAdmin) return;
      const on = __C.model.admin.guestsMayShare();
      shareAllBtn.classList.toggle('on', on);
      shareAllBtn.textContent = on ? (0, /*()*/__C.uiText)('stopShares', 'Stop guest shares') : (0, /*()*/__C.uiText)('allowShare', 'Allow screen share');
    }
    if (shareAllBtn) shareAllBtn.onclick = () => {
      if (!__C.amAdmin) return;
      const on = !__C.model.admin.guestsMayShare();
      (0, /*()*/__C.setMod)('*', 'share', on);
      updateShareAllBtn();
      (0, /*()*/__C.setStatus)(on ? 'Guests may share their screen.' : 'Guests can no longer share their screen.');
    };
    yield 2973; // null | 'up' | 'down' | 'kick'
    function setVoteMode(m) {
      __C.act.setVoteMode(m);
      for (const k of ['up', 'down', 'kick']) document.body.classList.toggle('vm-' + k, __C.model.votes.mode() === k);
      // The sheet is how you got here. Leaving it up paints an opaque grid
      // over the faces you are about to tap. Fold it without changing the
      // saved "keep More open" preference.
      if (m) {
        const barEl = document.querySelector('.bar');
        const toggle = document.getElementById('bartoggle');
        if (barEl && toggle && !barEl.classList.contains('collapsed')) {
          barEl.classList.add('collapsed');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.setAttribute('aria-label', (0, /*()*/__C.uiText)('more', 'More'));
          toggle.title = (0, /*()*/__C.uiText)('more', 'More');
          const word = toggle.querySelector('.dockword');
          if (word) word.textContent = (0, /*()*/__C.uiText)('more', 'More');
        }
      }
      const b = document.getElementById('votebanner');
      b.style.display = m ? 'flex' : 'none';
      if (m) {
        const need = __C.model.votes.tallies().need;
        const bannerKey = m === 'up' ? 'voteBannerUp' : m === 'down' ? 'voteBannerDown' : 'voteBannerKick';
        const bannerEn = m === 'up'
          ? 'Tap the green dot to vote someone ONTO the stage — at {n} votes they take it. Tap again to withdraw.'
          : m === 'down'
            ? 'Tap the ✕ on a stage panel to vote them OFF — at {n} votes they step down. Tap again to withdraw.'
            : 'Tap the ✕ to vote someone OUT of the room — a majority removes them. Tap again to withdraw.';
        document.getElementById('votebanner-text').textContent = (0, /*()*/__C.uiText)(bannerKey, bannerEn).replace('{n}', String(need));
      }
      (0, /*()*/__C.refreshAllTiles)();
      paintStageVoteTargets();
    }
    // The row tile is gone while the strip shows them, so the same vote-off
    // mark sits on the stage picture. It still calls castVote.
    function paintStageVoteTargets() {
      for (const host of document.querySelectorAll('#stagefeed .rowtile')) {
        let box = host.querySelector('.stgvotes');
        if (__C.model.votes.mode() !== 'down' || (0, /*()*/__C.hasAdminRoom)()) { if (box) box.remove(); continue; }
        if (!box) { box = document.createElement('div'); box.className = 'stgvotes'; host.appendChild(box); }
        const stg = (0, /*()*/__C.stageIds)().filter((id) => id !== __C.model.me.myId());
        const want = stg.map((id) => id + '|' + (__C.model.roster.rosterNames()[id] || '…') + '|' + (__C.model.roster.devOf()[id] && __C.model.votes.mine().down.has(__C.model.roster.devOf()[id]) ? 1 : 0)).join(',');
        if (box.dataset.sig === want) continue;
        box.dataset.sig = want;
        box.innerHTML = '';
        for (const id of stg) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'votedot';
          b.setAttribute('aria-label', 'Vote ' + (__C.model.roster.rosterNames()[id] || 'them') + ' off the stage');
          if (__C.model.roster.devOf()[id] && __C.model.votes.mine().down.has(__C.model.roster.devOf()[id])) b.classList.add('voted');
          b.addEventListener('click', (e) => { e.stopPropagation(); __C.act.castVote(id); paintStageVoteTargets(); });
          box.appendChild(b);
        }
      }
    }
    yield 2977;
    let closeVoteModal = () => { const m = document.getElementById('vote-modal'); if (m) m.style.display = 'none'; };
    document.getElementById('votebtn').onclick = () => {
      const m = document.getElementById('vote-modal');
      try { closeVoteModal(); } catch (e) {}
      m.style.display = 'flex';
      closeVoteModal = (0, /*()*/__M.openModal)(m, () => { m.style.display = 'none'; });
    };
    document.getElementById('vote-cancel').onclick = () => closeVoteModal();
    document.getElementById('vote-done').onclick = () => setVoteMode(null);
    for (const el of document.querySelectorAll('#vote-modal .voteopt')) {
      el.onclick = () => { closeVoteModal(); setVoteMode(el.dataset.vm); };
    }
    yield 2983;
    function topNameModal() {
      let top = null;
      for (const el of document.querySelectorAll('.name-modal')) {
        if (!el.isConnected || el.style.display === 'none') continue;
        top = el;
      }
      return top;
    }
    yield 2985;
    let modalTracked = null, modalOpener = null, modalOutside = null;
    function syncModalFocus() {
      const top = topNameModal();
      if (top && top !== modalTracked) {
        if (top.getAttribute('role') !== 'alertdialog') top.setAttribute('role', 'dialog');
        top.setAttribute('aria-modal', 'true');
        modalOpener = modalOutside;
        modalTracked = top;
        if (!top.contains(document.activeElement)) {
          const f = (0, /*()*/__C.modalFocusables)(top)[0];
          if (f) { try { f.focus(); } catch (e) {} }
        }
      } else if (!top && modalTracked) {
        const back = modalOpener;
        modalTracked = null; modalOpener = null;
        if (back && back.isConnected) { try { back.focus(); } catch (e) {} }
      }
    }
    document.addEventListener('focusin', (e) => {
      const t = e.target;
      if (t && t.closest && !t.closest('.name-modal')) modalOutside = t;
    });
    document.addEventListener('click', (e) => {
      const top = topNameModal();
      if (top && e.target === top) {
        const b = (0, /*()*/__C.modalDismissBtn)(top);
        if (b) b.click();
      }
      queueMicrotask(syncModalFocus);
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' && e.key !== 'Tab') return;
      syncModalFocus();
      const top = topNameModal();
      if (e.key === 'Escape') {
        // The full-screen view sits over everything (z 60). When the
        // browser kept it out of real full screen, Escape reaches the page
        // and must close the view, not fold More beneath it.
        const fsv = document.getElementById('fsview');
        if (fsv && fsv.classList.contains('on')) {
          const x = document.getElementById('fsclose');
          if (x) { e.preventDefault(); x.click(); }
          return;
        }
        if (top) {
          const b = (0, /*()*/__C.modalDismissBtn)(top);
          if (b) { e.preventDefault(); b.click(); queueMicrotask(syncModalFocus); }
          return;
        }
        if (typeof __M.camChooserOpen === 'function' && (0, /*()*/__M.camChooserOpen)()) {
          e.preventDefault();
          (0, /*()*/__M.dismissCamChooser)();
          return;
        }
        if (typeof __M.micChooserOpen === 'function' && (0, /*()*/__M.micChooserOpen)()) {
          e.preventDefault();
          (0, /*()*/__M.closeMicChooser)(true);
          return;
        }
        const tray = document.getElementById('reacttray');
        if (tray && !tray.hasAttribute('hidden')) {
          e.preventDefault();
          tray.setAttribute('hidden', '');
          const rb = document.getElementById('reactbtn');
          if (rb) { rb.setAttribute('aria-expanded', 'false'); rb.setAttribute('aria-pressed', 'false'); rb.classList.remove('on'); try { rb.focus(); } catch (err) {} }
          return;
        }
        // An open More sheet is the top layer: it folds first, so Escape
        // always closes the menu the person just opened, and the dock does
        // not move under the pointer. Then an open chat closes, as a side
        // panel does in Meet and Zoom, and the keyboard lands back on Chat.
        const barEl = document.querySelector('.bar');
        if (barEl && !barEl.classList.contains('collapsed')) {
          const toggle = document.getElementById('bartoggle');
          if (toggle) { e.preventDefault(); toggle.click(); }
          return;
        }
        if (chatPanelOpen()) {
          e.preventDefault();
          closeChatToButton();
          return;
        }
        if (__C.model.votes.mode()) setVoteMode(null);
        return;
      }
      if (!top) {
        if (e.key !== 'Tab') return;
        const barEl = document.querySelector('.bar');
        const tray = document.getElementById('reacttray');
        if (!barEl) return;
        const trayOpen = !!(tray && !tray.hasAttribute('hidden'));
        const sheetOpen = !barEl.classList.contains('collapsed');
        const chooser = document.getElementById('camchooser');
        const chooserOpen = !!(chooser && !chooser.hidden);
        if (!trayOpen && !sheetOpen && !chooserOpen) return;
        const nodes = [];
        for (const n of barEl.querySelectorAll('button, a[href], input, select, textarea')) {
          if (n.disabled || n.hidden) continue;
          if (n.style && n.style.display === 'none') continue;
          if (n.hidden || (n.classList && n.classList.contains('inmore'))) continue;
          if (!sheetOpen && n.closest && n.closest('#barmore')) continue;
          if (!trayOpen && n.closest && n.closest('#reacttray')) continue;
          let hide = false, p = n.parentElement;
          while (p) {
            if ((p.hasAttribute && p.hasAttribute('hidden')) || (p.style && p.style.display === 'none')) { hide = true; break; }
            p = p.parentElement;
          }
          if (!hide) nodes.push(n);
        }
        if (chooserOpen) {
          for (const n of chooser.querySelectorAll('button')) {
            if (n.disabled || n.hidden) continue;
            nodes.push(n);
          }
        }
        if (nodes.length < 2) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        const inside = barEl.contains(document.activeElement) || (chooserOpen && chooser.contains(document.activeElement));
        if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); try { last.focus(); } catch (err) {} }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); try { first.focus(); } catch (err) {} }
        return;
      }
      const nodes = (0, /*()*/__C.modalFocusables)(top);
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || !top.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });
    for (const el of document.querySelectorAll('.name-modal')) {
      if (el.getAttribute('role') !== 'alertdialog') el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
    }
    yield 2993;
    // ---- Invite: the one place every meeting link is made ----------------------
    // A meeting's room IS its URL and is host-less, so "sharing" is handing out
    // the link you already hold. The ONE governance choice is open vs a room you
    // run (admin). An admin room is a DIFFERENT room (its verifier is welded into
    // the address), so creating one is honestly a MOVE — we never yank you
    // silently (the old footgun where renaming stranded you), we explain it, and
    // if people are here with you we offer to drop the new link into this room's
    // chat so they can follow. Admin-room MINTING lives only here; the Admin
    // button is now sign-in + bans, and shows only inside an admin room.
    const invModal = document.getElementById('inv-modal');
    let closeInvModal = () => { invModal.style.display = 'none'; };
    yield 2996;
    // A meeting shares the viewer link (password stays off it). An app room
    // shares the room link it already holds.
    function inviteLinkForModal() {
      const isApp = __C.ROOM.kind === 'app' || document.body.classList.contains('app-room');
      if (!isApp) {
        const v = (0, /*()*/__C.viewerShareUrl)();
        if (v) return v;
      }
      return (shareUrl && shareUrl.value) || '';
    }
    yield 2998;
    function showInviteModal() {
      const body = document.getElementById('inv-body');
      const others = Math.max(0, (0, /*()*/__C.displayCount)() - 1);
      const ppl = others > 1 ? 'people' : 'person';
      // Same copy modal everywhere you can mint a link. An APP room gets its own
      // copy: a room you run is a meeting idea, so an app does not offer it.
      const isApp = __C.ROOM.kind === 'app' || document.body.classList.contains('app-room');
      document.querySelector('#inv-modal h3').textContent =
        isApp ? (0, /*()*/__C.uiText)('invTitleApp', 'Share this app') : __C.model.room.BROADCAST() ? 'Share this broadcast' : (0, /*()*/__C.uiText)('invTitle', 'Share this meeting');
      // Close is the dialog's action: it stays on screen below the body, outside its scroll.
      document.getElementById('inv-actions').innerHTML = '<button id="inv-done" type="button" class="appear-secondary">' + (0, /*()*/__C.esc)((0, /*()*/__C.uiText)('invClose', 'Close')) + '</button>';
      if (isApp) {
        body.innerHTML = '<p>' + (0, /*()*/__C.uiText)('invApp', 'Send this link. They join you live inside this app.') + '</p>' + (0, /*()*/__C.linkRowHtml)();
      } else if ((0, /*()*/__C.hasAdminRoom)() || __C.model.room.BROADCAST()) {
        // The link never carries the host password. Say that only to a reader
        // who holds the key. An open room has no verifier and no host password,
        // even while a capture makes hasAdminRoom() true. A member is told the
        // host admits people only while the waiting room is holding the door:
        // dhold is on and an admin is here (meetWait.blocks).
        const roomAv = (typeof __C.model.me.av() === 'undefined') ? null : __C.model.me.av();
        const holdsKey = document.body.classList.contains('amadmin')
          || (typeof __C.amAdmin !== 'undefined' && !!__C.amAdmin)
          || (typeof __C.bcHostStored === 'function' && (0, /*()*/__C.bcHostStored)());
        let doorHolds = false;
        if (roomAv) {
          try {
            const table = (typeof __C.model.door.modTable() !== 'undefined' && __C.model.door.modTable()) || {};
            const h = (table['*'] || {}).dhold;
            const here = (typeof __C.model.door.admins() !== 'undefined' && __C.model.door.admins() && __C.model.door.admins().length) || 0;
            doorHolds = !!(h && h.on && here);
          } catch (e) { doorHolds = false; }
        }
        const line = !roomAv
          ? (__C.model.room.BROADCAST()
            ? (0, /*()*/__C.uiText)('invBcWatch', 'Send this link. People who open it are watching.')
            : (0, /*()*/__C.uiText)('invOpen', 'Send this link. Anyone who opens it can join this public majority-rules meeting.'))
          : __C.model.room.BROADCAST()
            ? (holdsKey
              ? (0, /*()*/__C.uiText)('invBcHost', 'Send this link. People who open it are watching. The host password stays with you.')
              : doorHolds
                ? (0, /*()*/__C.uiText)('invBcWait', 'Send this link. People who open it are watching. The host admits them.')
                : (0, /*()*/__C.uiText)('invBcWatch', 'Send this link. People who open it are watching.'))
            : (holdsKey
              ? (0, /*()*/__C.uiText)('invAdmHost', 'Send this link. People who open it can join this private meeting. The host password stays with you.')
              : doorHolds
                ? (0, /*()*/__C.uiText)('invAdmWait', 'Send this link. People who open it can ask to join this private meeting. The host admits them.')
                : (0, /*()*/__C.uiText)('invAdmJoin', 'Send this link. People who open it can join this private meeting.'));
        body.innerHTML = '<p>' + line + '</p>' + (0, /*()*/__C.linkRowHtml)();
      } else {
        body.innerHTML =
          '<p>' + (0, /*()*/__C.uiText)('invOpen', 'Send this link. Anyone who opens it can join this public majority-rules meeting.') + '</p>' +
          (0, /*()*/__C.linkRowHtml)() +
          '<button id="inv-mkadm" type="button" class="inv-more">' + (0, /*()*/__C.esc)((0, /*()*/__C.uiText)('invMk', 'Host a private meeting')) + '</button>' +
          '<div id="inv-adm-open" style="display:none">' +
            '<p>This makes a new room that you run. Name it, then set a host password only you know.</p>' +
            (others
              ? '<p>' + (0, /*()*/__C.uiText)('invWarnHere', 'The {n} people here stay in this room. Leave the box ticked to drop the new link in chat so they can follow.').replace('{n}', others) + '</p>'
              : '<p>' + (0, /*()*/__C.uiText)('invWarnSolo', 'You will switch to it now.') + '</p>') +
            '<input id="inv-adm-room" maxlength="40" placeholder="' + (0, /*()*/__C.esc)((0, /*()*/__C.uiText)('invRoomPh', 'Name this room')) + '" autocomplete="off" value="' + (0, /*()*/__C.esc)(__C.model.room.room()) + '">' +
            '<label class="lob-pwlab"><b>Host password</b><small>Only you. People who join do not need it.</small></label>' +
            '<input id="inv-adm-pass" type="password" maxlength="64" placeholder="' + (0, /*()*/__C.esc)((0, /*()*/__C.uiText)('invAdminPh', 'Host password')) + '" autocomplete="new-password">' +
            '<label class="lob-pwlab"><b>Room password</b><small>Optional.</small></label>' +
            '<input id="inv-adm-guest" type="password" maxlength="64" placeholder="' + (0, /*()*/__C.esc)((0, /*()*/__C.uiText)('invGuestPh', 'Room password (optional)')) + '" autocomplete="new-password">' +
            (others ? '<label class="inv-check"><input type="checkbox" id="inv-adm-post" checked><span>Drop the new link in chat so they can follow.</span></label>' : '') +
            '<div class="appear-actions"><button id="inv-adm-back" type="button" class="appear-secondary">' + (0, /*()*/__C.esc)((0, /*()*/__C.uiText)('invBack', 'Back')) + '</button><button id="inv-adm-go" type="button" class="appear-primary">' + (0, /*()*/__C.esc)((0, /*()*/__C.uiText)('invGo', 'Create and switch')) + '</button></div>' +
          '</div>';
      }
      const copyBtn = document.getElementById('inv-copy');
      const shareInviteBtn = document.getElementById('inv-share');
      const inviteSharePayload = () => {
        const field = document.getElementById('inv-url');
        const url = (field && field.value) || inviteLinkForModal();
        return { title: isApp ? 'Join me on GifOS' : __C.model.room.BROADCAST() ? 'Watch my GifOS broadcast' : 'Join my GifOS meeting', text: 'Tap this link and you’re in:', url: url };
      };
      if (shareInviteBtn && navigator.share) {
        shareInviteBtn.style.display = '';
        shareInviteBtn.onclick = () => { navigator.share(inviteSharePayload()).catch(() => {}); };
      }
      if (copyBtn) copyBtn.onclick = () => {
        const u = document.getElementById('inv-url'); u.select();
        const text = u.value;
        try { document.execCommand('copy'); } catch (e) {}
        if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
        (0, /*()*/__C.armCopiedLabel)(copyBtn, setTimeout);
      };
      const done = document.getElementById('inv-done');
      if (done) done.onclick = () => closeInvModal();
      const mk = document.getElementById('inv-mkadm');
      const copyLooksPrimary = (on) => {
        if (!copyBtn) return;
        copyBtn.classList.toggle('appear-primary', on);
        copyBtn.classList.toggle('appear-secondary', !on);
      };
      if (mk) mk.onclick = () => {
        mk.style.display = 'none';
        if (done) done.style.display = 'none';
        document.getElementById('inv-adm-open').style.display = '';
        copyLooksPrimary(false);
        document.getElementById('inv-adm-pass').focus();
      };
      const back = document.getElementById('inv-adm-back');
      if (back) back.onclick = () => {
        document.getElementById('inv-adm-open').style.display = 'none';
        if (mk) mk.style.display = '';
        if (done) done.style.display = '';
        copyLooksPrimary(true);
      };
      const go = document.getElementById('inv-adm-go');
      if (go) go.onclick = async () => {
        const name = (document.getElementById('inv-adm-room').value || '');
        const pass = (document.getElementById('inv-adm-pass').value || '').trim();
        const chosen = (0, /*()*/__C.slugRoom)(name, __C.model.room.room());
        if (!chosen) { document.getElementById('inv-adm-room').focus(); return; }
        if (!pass) { document.getElementById('inv-adm-pass').focus(); return; }
        const post = !!(document.getElementById('inv-adm-post') && document.getElementById('inv-adm-post').checked);
        const guest = (document.getElementById('inv-adm-guest').value || '').trim();
        // Subscriptions: an admin room needs a plan.
        if (window.GifOS && GifOS.meetSubs && !(await GifOS.meetSubs.mayCreateAdminRoom(__C.setStatus))) { invModal.style.display = 'none'; return; }
        go.disabled = true; go.textContent = 'Creating…';
        invModal.style.display = 'none';
        try {
          await (0, /*()*/__C.createAdminRoom)(chosen, pass, post, guest);
        } catch (err) {
          go.disabled = false; go.textContent = 'Create and switch';
          invModal.style.display = 'flex';
          (0, /*()*/__C.setStatus)('Could not create the room (' + ((err && err.name) || 'Error') + ').');
        }
      };
      for (const i of body.querySelectorAll('input[type=password]')) pwEye(i); // the mint's two fields get their eyes before first focus
      try { closeInvModal(); } catch (e) {}
      invModal.style.display = 'flex';
      // A tap (and the focus openModal gives the field) selects the whole link.
      const invField = document.getElementById('inv-url');
      if (invField && !invField.__selAll && typeof invField.addEventListener === 'function') {
        invField.__selAll = true;
        const selectAll = () => {
          try { if (typeof invField.select === 'function') invField.select(); } catch (e) {}
          try { if (typeof invField.setSelectionRange === 'function') invField.setSelectionRange(0, (invField.value || '').length); } catch (e) {}
        };
        invField.addEventListener('focus', selectAll);
        invField.addEventListener('mouseup', (e) => { try { e.preventDefault(); } catch (err) {} selectAll(); });
        invField.addEventListener('click', selectAll);
      }
      // Grow to the wrapped text. A hidden field reports no height, so this
      // runs after the card is shown, and again on the next frame and on resize.
      const fitInv = () => {
        const u = document.getElementById('inv-url');
        if (!u || typeof u.scrollHeight !== 'number') return;
        u.style.height = 'auto';
        u.style.height = u.scrollHeight + 'px';
      };
      fitInv();
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fitInv);
      if (typeof window !== 'undefined' && !window.__invLinkFitOn && typeof window.addEventListener === 'function') {
        window.__invLinkFitOn = true;
        window.addEventListener('resize', () => {
          const m = document.getElementById('inv-modal');
          if (m && m.style.display !== 'none') fitInv();
        });
      }
      closeInvModal = (0, /*()*/__M.openModal)(invModal, () => { invModal.style.display = 'none'; });
    }
    yield 3008;   // the subscription code is loaded (always on)
    // The Subscription entry in More (Settings and help): opens the Subscription dialog.
    {
      const sb = document.getElementById('subbtn'); if (sb) sb.addEventListener('click', () => { if (window.GifOS && GifOS.meetSubs && GifOS.meetSubs.openSubscribe) GifOS.meetSubs.openSubscribe(); });
      // THE LICENSE (docs/relay-lockdown.md "Meeting size: who decides"): anyone in a hosted room can read the room's
      // permissions. The relay is the source (joined.acl and the answer to {t:'aclq'}). A seat at the door asks when
      // this opens; a deep seat shows the last value it saw, with how old that value is. No push, no timer.
      GifOS.licenseView = (function () {
        function licenseAcl(a) { return GifOS.sub && GifOS.sub.aclFromSay ? GifOS.sub.aclFromSay(a) : null; }
        function licenseWords(view, o) {
          o = o || {};
          const t = o.t || function (k, en) { return en; };
          const fill = (s, map) => String(s).replace(/\{(\w+)\}/g, function (_, k) { return map[k] == null ? '' : String(map[k]); });
          if (o.open) return [t('licOpen', 'No people limit: open meetings have none')];
          const lines = [];
          if (!view || view.none) lines.push(fill(t('licNone', 'No permissions yet: up to {n} people'), { n: view && view.limit != null ? view.limit : 5 }));
          else if (view.limit == null) lines.push(t('licNoLimit', 'No people limit'));
          else lines.push(fill(t('licUpTo', 'Up to {n} people'), { n: view.limit }));
          if (view && view.clearStage) lines.push(t('licClearStage', 'Clear Stage video (hosted meetings)'));
          if (view && view.since) lines.push(fill(t('licSince', 'since {time}'), { time: typeof o.time === 'function' ? o.time(view.since) : String(view.since) }));
          return lines;
        }
        function licenseAge(at, now, t) {
          t = t || function (k, en) { return en; };
          const fill = (s, map) => String(s).replace(/\{(\w+)\}/g, function (_, k) { return map[k] == null ? '' : String(map[k]); });
          const s = Math.max(0, ((now || Date.now()) - at) / 1000);
          let when;
          if (!(at > 0) || s < 45) when = t('licAgoNow', 'just now');
          else if (s < 3600) when = fill(t('licAgoMin', '{n} min ago'), { n: Math.max(1, Math.round(s / 60)) });
          else if (s < 86400) when = fill(t('licAgoHour', '{n} h ago'), { n: Math.max(1, Math.round(s / 3600)) });
          else when = fill(t('licAgoDay', '{n} d ago'), { n: Math.max(1, Math.round(s / 86400)) });
          return fill(t('licAsOf', 'as of {when}'), { when: when });
        }
        function licenseShow(view, o) {
          const lines = licenseWords(view, o);
          if (o && o.open) return lines;
          if (o && o.socketed === false && o.at) lines.push(licenseAge(o.at, o.now, o.t));
          return lines;
        }
        function hosted() {
          try {
            return !!GifOS.link.read(location.pathname, '', location.hash).v;
          } catch (e) { return false; }
        }
        let last = null;
        const say = (k, en) => { try { return (0, /*()*/__C.uiText)(k, en); } catch (e) { return en; } };
        const clock = (ms) => { const d = new Date(ms), z = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); };
        function lines(socketed) {
          const S = GifOS.sub;
          const view = S && S.aclView ? S.aclView(licenseAcl(last)) : { limit: 5, none: true, since: null };
          return licenseShow(view, { t: say, time: clock, socketed: !!socketed, at: last && last.at, now: Date.now() });
        }
        function paint(socketed) {
          const body = document.getElementById('lic-body');
          if (!body) return;
          body.textContent = '';
          for (const line of lines(socketed)) { const p = document.createElement('p'); p.textContent = line; body.appendChild(p); }
        }
        function heard(a) {
          if (!a || !Number.isInteger(a.l)) return;
          last = { l: a.l, s: Number.isInteger(a.s) && a.s > 0 ? a.s : null, f: Number.isInteger(a.f) ? a.f : 0, at: Date.now() };
          const m = document.getElementById('lic-modal');
          if (m && m.style.display === 'flex') paint(true);
        }
        function nodeNow() {
          try { const n = __C.model.net.meshNode(); return n || null; } catch (e) { return null; }
        }
        function socketedNow() {
          const node = nodeNow();
          return !!(node && typeof node.socketed === 'function' && node.socketed() && typeof node.relayUp === 'function' && node.relayUp());
        }
        function open() {
          if (!hosted()) return false;
          const node = nodeNow();
          const up = socketedNow();
          if (up && typeof node.READ_THE_ROOM_LICENSE === 'function') { try { node.READ_THE_ROOM_LICENSE(); } catch (e) {} }
          paint(up);
          const m = document.getElementById('lic-modal');
          if (m) m.style.display = 'flex';
          return true;
        }
        function close() { const m = document.getElementById('lic-modal'); if (m) m.style.display = 'none'; }
        const row = moreRow('room');
        if (row && !document.getElementById('licbtn')) {
          const b = document.createElement('button');
          b.type = 'button'; b.id = 'licbtn';
          b.textContent = say('licItem', 'License');
          b.title = say('licItem', 'License');
          b.hidden = !hosted();
          b.addEventListener('click', () => { try { open(); } catch (e) {} });
          row.appendChild(b);
        }
        if (!document.getElementById('lic-modal')) {
          const m = document.createElement('div');
          // The same dialog as the page's others (run.html #sub-modal: name-modal > name-box with head, body and actions;
          // dialog.js keeps the Close button outside the scroll), so Close wears the page's own button, not the browser's.
          m.id = 'lic-modal'; m.className = 'name-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'lic-title');
          m.style.display = 'none';
          const card = document.createElement('div'); card.className = 'name-box dlg';
          card.style.cssText = 'text-align:left;width:min(92vw,28rem);max-width:min(92vw,28rem)';
          const head = document.createElement('div'); head.className = 'dlg-head';
          const h = document.createElement('h3'); h.id = 'lic-title'; h.textContent = say('licItem', 'License');
          head.appendChild(h);
          const body = document.createElement('div'); body.id = 'lic-body'; body.className = 'dlg-body';
          const acts = document.createElement('div'); acts.className = 'dlg-actions';
          const x = document.createElement('button'); x.type = 'button'; x.id = 'lic-close'; x.textContent = say('subUpClose', 'Close');
          x.style.cssText = 'background:var(--surface,#1c1c2b);border:1px solid var(--border,#2a2a3f);color:var(--text,#e0e0f0)';
          x.addEventListener('click', close);
          acts.appendChild(x);
          card.appendChild(head); card.appendChild(body); card.appendChild(acts);
          m.appendChild(card);
          m.addEventListener('click', (e) => { if (e.target === m) close(); });
          document.body.appendChild(m);
        }
        return { hosted: hosted, heard: heard, open: open, words: licenseWords, age: licenseAge, acl: licenseAcl, show: licenseShow };
      })();
    }
    yield 3026;   // DEBUG=on only: a test reads the re-knock state
    function hideDialogs(ids) { for (const id of ids) { const d = document.getElementById(id); if (d) d.style.display = 'none'; } }
    yield 3031;
    // A viewer early for a scheduled service gets Add to calendar: a one-event
    // .ics with the viewer link, which a phone opens in its calendar.
    let bcCalUrl = null, bcCalFor = '';
    function paintBcCalendar(show) {
      const a = document.getElementById('bc-cal');
      if (!a) return;
      a.hidden = !show;
      if (!show) return;
      const at = (0, /*()*/__C.bcStartAt)(), link = (0, /*()*/__C.viewerShareUrl)();
      if (bcCalFor === at + link) return;
      bcCalFor = at + link;
      const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
      const esc = (s) => String(s).replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n');
      const noun = 'broadcast';
      const name = String(__C.model.room.LINK().room || '').trim();
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GifOS//Broadcast//EN', 'BEGIN:VEVENT',
        'UID:' + at + '-' + name.replace(/[^a-z0-9]/gi, '') + '@gifos.app', 'DTSTAMP:' + stamp(Date.now()),
        'DTSTART:' + stamp(at), 'DTEND:' + stamp(at + 90 * 60000),
        'SUMMARY:' + esc((name ? name + ' · ' : '') + 'live ' + noun),
        'DESCRIPTION:' + esc('Watch here: ' + link), 'URL:' + link,
        'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc('The ' + noun + ' starts in 15 minutes'), 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
      if (bcCalUrl) { try { URL.revokeObjectURL(bcCalUrl); } catch (e) {} }
      bcCalUrl = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      a.href = bcCalUrl;
      a.download = (name || noun).replace(/[^\w.-]+/g, '-') + '.ics';
    }
    // The host's start time. The phone's own picker gives local time; the
    // link carries it as unix seconds, so every viewer reads it in theirs.
    const bcWhenIn = document.getElementById('bcwhen');
    function paintBcWhen() {
      const lbl = document.getElementById('bcwhen-lbl');
      const at = (0, /*()*/__C.bcStartAt)();
      if (lbl) lbl.textContent = at ? 'Starts ' + (0, /*()*/__C.bcWhenWords)(at, Date.now()) : 'Start time';
      if (bcWhenIn && at && document.activeElement !== bcWhenIn) {
        const d = new Date(at), z = (n) => String(n).padStart(2, '0');
        bcWhenIn.value = d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes());
      }
    }
    if (bcWhenIn && __C.model.room.BROADCAST()) {
      bcWhenIn.onchange = () => {
        const ms = bcWhenIn.value ? new Date(bcWhenIn.value).getTime() : NaN;
        const secs = Number.isFinite(ms) ? String(Math.floor(ms / 1000)) : '';
        if (secs) __C.model.room.params().set('at', secs); else __C.model.room.params().delete('at');
        try { secs ? localStorage.setItem(__C.model.consts.BC_AT_KEY(), secs) : localStorage.removeItem(__C.model.consts.BC_AT_KEY()); } catch (e) {}
        paintBcWhen();
        try { (0, /*()*/__C.updateStatus)(); } catch (e) {}
      };
      paintBcWhen();
    }
    document.getElementById('copy').onclick = () => {
      shareUrl.select(); try { document.execCommand('copy'); } catch (e) {}
      if (navigator.clipboard) navigator.clipboard.writeText(shareUrl.value).catch(() => {});
    };
    document.getElementById('bc-link-copy').onclick = () => {
      const input = document.getElementById('bc-link-url');
      const btn = document.getElementById('bc-link-copy');
      if (input) { input.focus(); input.select(); try { document.execCommand('copy'); } catch (e) {} }
      if (navigator.clipboard && shareUrl.value) navigator.clipboard.writeText(shareUrl.value).catch(() => {});
      btn.textContent = 'Copied';
      setTimeout(() => { if (btn.textContent === 'Copied') btn.textContent = 'Copy'; }, 1600);
    };
    document.getElementById('closed-reload').onclick = () => location.reload();
    yield 3058;
    const leaveBtn = document.getElementById('leavebtn');
    const leaveAsk = document.getElementById('leave-ask');
    // A small group leaves on the red button. leaveMeeting() is already
    // immediate, which is what a hang-up and the test hook use. A service
    // still asks: you are live, and Stay puts the microphone back.
    if (leaveBtn) leaveBtn.onclick = () => {
      if (__C.model.room.BROADCAST()) {
        try { (0, /*()*/__C.holdLeaveAsk)(); } catch (e) {}
        if (leaveAsk) leaveAsk.style.display = 'flex';
        return;
      }
      (0, /*()*/__C.leaveMeeting)();
    };
    const leaveCancel = document.getElementById('leave-cancel');
    if (leaveCancel) leaveCancel.onclick = () => { if (leaveAsk) leaveAsk.style.display = 'none'; try { (0, /*()*/__C.releaseLeaveAsk)(); } catch (e) {} };
    const leaveGo = document.getElementById('leave-go');
    if (leaveGo) leaveGo.onclick = () => { if (leaveAsk) leaveAsk.style.display = 'none'; (0, /*()*/__C.leaveMeeting)(); };
    yield 3066;
    function shortcutBlocked() {
      for (const el of document.querySelectorAll('.name-modal')) {
        if (!el.isConnected || el.style.display === 'none') continue;
        return true;
      }
      return false;
    }
    const SHORTCUT_IDS = { KeyA: 'mic', KeyV: 'cam', KeyS: 'sharebtn', KeyC: 'chatbtn', KeyK: 'ccdock', KeyH: 'hand', KeyF: 'fitbtn', KeyQ: 'leavebtn', KeyW: 'whobtn', KeyI: 'appinvite', KeyY: 'appbtn', KeyU: 'votebtn', KeyL: 'pwbtn', KeyG: 'stagebtn', KeyR: 'recbtn', Comma: 'setbtn', KeyT: 'trbtn', KeyJ: 'agendabtn', Slash: 'apphelp', KeyM: 'muteall', KeyB: 'blurall', KeyX: 'camall', KeyP: 'shareall' };
    // The control an Alt chord presses, or null when that chord does nothing
    // for this person right now.
    function shortcutTarget(id) {
      const btn = document.getElementById(id);
      // A control inside More is still a shortcut while the sheet is folded
      // (a folded sheet hides its rows, not the button's own display). A
      // button hidden on its own (a viewer who cannot share, a host tool a
      // service hides) stays quiet, in More or not.
      if (!btn || (getComputedStyle(btn).display === 'none' && !btn.classList.contains('inmore'))) return null;
      // The host's room-wide tools are hidden for a guest, and their keys with them.
      if (/^(muteall|blurall|camall|shareall)$/.test(id) && btn.style.display === 'none') return null;
      return btn;
    }
    // The sheet lists only the keys that work for this person: a viewer
    // with no microphone or camera on the dock is not offered their keys.
    function paintShortcutSheet(el) {
      const codeOf = { '/': 'Slash', ',': 'Comma' };
      for (const li of el.querySelectorAll('li')) {
        const k = (li.querySelector('kbd') || {}).textContent || '';
        const m = /^Alt\+(.)$/.exec(k);
        let ok = true;
        if (m) {
          const id = SHORTCUT_IDS[codeOf[m[1]] || ('Key' + m[1].toUpperCase())];
          ok = !!(id && shortcutTarget(id));
        } else if (k === 'F') {
          const fb = document.getElementById('appfull');
          ok = !!(fb && getComputedStyle(fb).display !== 'none');
        }
        li.hidden = !ok;
      }
    }
    function toggleShortcutSheet(force) {
      const el = document.getElementById('shortcutsheet');
      if (!el) return;
      const open = el.style.display !== 'none';
      const show = force === true ? true : force === false ? false : !open;
      if (show) paintShortcutSheet(el);
      el.style.display = show ? 'flex' : 'none';
      if (show) {
        const b = document.getElementById('shortcut-cancel');
        if (b) { try { b.focus(); } catch (err) {} }
      }
    }
    const keysBtn = document.getElementById('keysbtn');
    if (keysBtn) keysBtn.onclick = () => toggleShortcutSheet(true);
    const shortcutCancel = document.getElementById('shortcut-cancel');
    if (shortcutCancel) shortcutCancel.onclick = () => toggleShortcutSheet(false);
    document.addEventListener('keydown', (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey) return;
      if (e.key === '?' || (e.shiftKey && !e.altKey && e.code === 'Slash')) {
        if ((0, /*()*/__C.shortcutTyping)(e)) return;
        e.preventDefault();
        toggleShortcutSheet();
        return;
      }
      if (!e.altKey && !e.shiftKey && e.code === 'KeyF' && !(0, /*()*/__C.shortcutTyping)(e) && !shortcutBlocked()) {
        // Full screen, as Zoom and YouTube give it a key; F again closes.
        // It is the OS header's button, so it is the same key in every app.
        const lob = document.getElementById('lobby');
        const fb = document.getElementById('appfull');
        if (!fb || getComputedStyle(fb).display === 'none' || (lob && lob.classList.contains('show'))) return;
        e.preventDefault();
        fb.click();
        return;
      }
      if (!e.altKey || e.shiftKey || (0, /*()*/__C.shortcutTyping)(e) || shortcutBlocked()) return;
      const id = SHORTCUT_IDS[e.code];
      if (!id) return;
      const btn = shortcutTarget(id);
      if (!btn) return;
      e.preventDefault();
      btn.click();
    });
    yield 3078;
    const leftRejoin = document.getElementById('left-rejoin');
    if (leftRejoin) leftRejoin.onclick = () => {
      let to = null;
      try { to = __C.model.room.rejoinHref() ? new URL(__C.model.room.rejoinHref(), location.href) : null; } catch (e) {}
      const here = location.pathname + location.search + location.hash;
      if (!to || to.origin !== location.origin || to.pathname + to.search + to.hash === here) { location.reload(); return; }
      // A hash-only change is not a load: reload after it (enterMeeting's rule).
      const samePage = to.pathname === location.pathname && to.search === location.search;
      location.replace(to.href);
      if (samePage) location.reload();
    };
    const leftClose = document.getElementById('left-close'); if (leftClose) leftClose.onclick = () => { location.href = (0, /*()*/__C.homeHref)(); };

    // ================= App-in-meeting =================
    // Any app can run INSIDE the meeting: one participant hosts it through the
    // app runtime and, unless that app set capabilities.multiplayer to false,
    // everyone else mounts it live (shared multiplayer state). An opted-out
    // app stays on the host's screen; other people watch, and their copy
    // does not sync or send actions. The meeting's audio/video/recording
    // stays wrapped around it. The app's
    // join info rides the SAME status heartbeat that keeps the room converged,
    // so late joiners pick it up automatically. This is the second entry point
    // to the exact same place as an app tab's "Meeting" toggle.
    //
    // GOVERNANCE (the room principle: anarchy is unavoidable in open rooms —
    // so DOM hackers get no edge over the honest buttons — and complete
    // control in admin rooms):
    //   run    open: anyone · admin: admins + people they granted ('app' mod)
    //   winner ONE app, deterministically: newest authorized ad (ts, then
    //          peer-id) that isn't tombstoned — the room can never split
    //   stop   open: anyone, attributed + reversible (sharer just re-shares)
    //          admin: sharer or a signed admin order (§SIG)
    //   hide   everyone, always — personal opt-out, commandeers nobody
    //   lead   the sharer's toggle over the app's manifest-declared ledRecords,
    //          enforced in the SHARER'S OWN runtime (host-authoritative — the
    //          one place no remote DOM hack can reach). Open rooms default
    //          communal; admin rooms default leading.
    const appMountEl = document.getElementById('appmount');
    // The app runtime (js/runtime.js, a page script) mounts an app in the page's app pane: as its host (the status line
    // takes the runtime's words when withStatus), or as a client of the host's Stage data lane. The meeting asks only
    // where the runtime is loaded, and gets the runtime's controller back.
    function appRuntimeBoot(fileId, withStatus, launch) { return GifOS.runtime.boot(appMountEl, fileId, withStatus ? statusEl : null, launch); }
    function appRuntimeClient(params) { return GifOS.runtime.bootClientBus(appMountEl, params, null, {}); }
    function paintSoloApp(on) { if (on) document.body.classList.add('solo-app'); else { document.body.classList.remove('solo-app'); document.documentElement.classList.remove('solo-app'); } }
    function paintTabTitle(t) { document.title = t; }
    function paintAppWho(t) { document.getElementById('appwho').textContent = t; }
    // Run app lives in the More sheet; left open it is a grid of buttons over the app. Fold it without rewriting the
    // saved preference.
    function foldBarForApp() {
      const barEl = document.querySelector('.bar');
      const toggle = document.getElementById('bartoggle');
      if (barEl && toggle && !barEl.classList.contains('collapsed')) {
        barEl.classList.add('collapsed');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', (0, /*()*/__C.uiText)('more', 'More'));
        toggle.title = (0, /*()*/__C.uiText)('more', 'More');
        const word = toggle.querySelector('.dockword');
        if (word) word.textContent = (0, /*()*/__C.uiText)('more', 'More');
      }
    }
    // The runtime calls window.__gifosPermissions on every app mount (host or
    // client). Wire it to the in-meeting Abilities chip so an app running inside
    // a meeting gets the SAME acknowledgement + per-app opt-out panel it gets in
    // its own tab — including when you JOIN a meeting where someone shares an app.
    // Closing a REQUIRED-setup gate here stops the shared app rather than the tab.
    if (window.GifOS && GifOS.perms) GifOS.perms.attach(document.getElementById('appperms'), { onLeave: function () { (0, /*()*/__C.stopApp)(); }, skipCaps: function () { return __C.appMode === 'client' ? ['stage'] : []; } });
    yield 3094;
    // Also driven by the app-room beat below, so a copy that STOPS (the holder
    // left mid-transfer) stops claiming to be in progress.
    function appCopyPaint() {
      __C.model.apps.appCopy().paintedAt = Date.now();
      const el = document.getElementById('appcopy');
      const done = !appMountEl || appMountEl.querySelector('iframe') || __C.appMode !== 'client';
      if (done) { if (el) el.remove(); __C.model.apps.appCopy().streams.clear(); __C.model.apps.appCopy().fid = null; __C.model.apps.appCopy().shown = 0; return; }
      let big = null, bigFid = null;
      for (const [fid, s] of __C.model.apps.appCopy().streams) {
        if (__C.model.apps.appCopy().paintedAt - s.at > 30000) { __C.model.apps.appCopy().streams.delete(fid); continue; } // matches defrag's own sweep
        if (!big || s.n > big.n) { big = s; bigFid = fid; }
      }
      if (!big) { if (el) el.remove(); __C.model.apps.appCopy().fid = null; __C.model.apps.appCopy().shown = 0; return; }
      if (bigFid !== __C.model.apps.appCopy().fid) { __C.model.apps.appCopy().fid = bigFid; __C.model.apps.appCopy().shown = 0; }
      const got = big.got, n = big.n;
      const box = el || (() => {
        const d = document.createElement('div');
        d.id = 'appcopy';
        d.innerHTML = '<div class="appcopy-t"></div><div class="appcopy-bar"><i class="appcopy-b"></i></div><div class="appcopy-h"></div>';
        appMountEl.appendChild(d);
        return d;
      })();
      const name = document.getElementById('appname').textContent || 'the app';
      // Every fragment is in, but b64decode + GIF decode still run (1.8s of the
      // 8.9s measured above). Saying 100% and then sitting there is the same
      // lie as saying nothing, so the last phase gets its own word.
      const whole = got >= n;
      __C.model.apps.appCopy().shown = Math.max(__C.model.apps.appCopy().shown, Math.max(1, Math.min(99, Math.round((got / n) * 100))));
      const pct = __C.model.apps.appCopy().shown;
      // n × FRAG_PART is the SEALED wire size (the app's base64 is ciphertext-
      // base64'd again on top), so it reads larger than the App GIF on disk.
      // Say "crossing", not the app's size — the wire cost is the honest number
      // here, and the decoded size is not knowable until the bytes land.
      const mb = (n * __C.model.net.net().FRAG_PART) / (1024 * 1024);
      box.querySelector('.appcopy-t').textContent = whole
        ? 'Opening ' + name + '…'
        : 'Copying ' + name + ' — ' + pct + '%';
      box.querySelector('.appcopy-b').style.width = (whole ? 100 : pct) + '%';
      box.querySelector('.appcopy-h').textContent = whole
        ? 'Unpacking it on this device.'
        : 'About ' + mb.toFixed(1) + ' MB crossing from someone already in the room — it comes over once, then it is yours.';
    }
    yield 3101;

    // ---- THE TAB'S ICON ------------------------------------------------
    // This page is the MEETING page wearing the runner's hat, so its <head>
    // link is the meeting's video camera — right for a room, wrong for a solo
    // app whose title already reads "<app> — GifOS". A solo entry wears the
    // app's own ornament: the SAME stripForDisplay bytes the app bar paints.
    // The ornament rule holds here — the picture is never the file — so an
    // unstripped GIF falls back to the package glyph rather than hand the tab
    // a packed archive to fetch and decode for 16 pixels.
    // Solo ONLY: in a meeting the tab IS the room, camera and all.
    function setAppFavicon(href, type) {
      if (!document.body.classList.contains('solo-app')) return;
      try {
        // Replace the node instead of assigning .href — a browser re-reads the
        // icon on insertion, and an in-place href change is not always noticed.
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = type || 'image/svg+xml';
        link.href = href || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E";
        document.querySelectorAll('link[rel~="icon"]').forEach((el) => el.remove());
        document.head.appendChild(link);
      } catch (e) {}
    }

    // The bar shows the app's GIF beside its name — the file IS the app, and
    // on a guest's screen the thumbnail doubles as proof the bytes have
    // arrived (they are the exact bytes Steal copies). The host and every
    // guest read the same name.
    let appGifUrl = null;
    function setAppGif(bytes, name) {
      if (!bytes || !bytes.length) return;
      const img = document.getElementById('appgif');
      // Display-only <img>: strip the packed filesystem (gifos-gif.js
      // stripForDisplay — sanctioned for exactly this) so the app-bar icon
      // blobs the animation, not a 20 MB archive the decoder must step over.
      let stripped = false;
      const full = bytes;
      try { if (GifOS.gif && GifOS.gif.stripForDisplay) { bytes = GifOS.gif.stripForDisplay(bytes); stripped = true; } } catch (e) {}
      if (appGifUrl) { try { URL.revokeObjectURL(appGifUrl); } catch (e) {} }
      appGifUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/gif' }));
      img.src = appGifUrl; img.alt = name || 'App'; img.title = name || 'App';
      // The tab takes the same blob: one object URL, revoked and re-pointed
      // together above. Only ever the STRIPPED bytes.
      if (stripped) setAppFavicon(appGifUrl, 'image/gif');
      img.style.display = 'block';
      if (GifOS.viewKit && GifOS.viewKit.armAppGif) GifOS.viewKit.armAppGif(img, full, () => { const b = document.getElementById('appsave'); if (b && b.style.display !== 'none') b.click(); });
    }
    function showAppPane(name, who) {
      __C.act.surface({ appPaneOn: true }); __C.act.surface({ appPaneName: name || 'App' });
      document.body.classList.add('has-app');
      try { window.__meetRelayout(); } catch (e) {}
      document.getElementById('appname').textContent = name || 'App';
      document.getElementById('appwho').textContent = who || '';
      paintInviteSlot();
      paintHelpTip();
      // ONE RUNTIME: app-PINNED rooms never show unmount affordances — the room
      // IS the app (belt for updateAppButtons' braces; that runs on beats).
      if (__C.ROOM.appPinned) { document.getElementById('appstop').style.display = 'none'; document.getElementById('apphide').style.display = 'none'; }
      // Data-ownership chrome (migrated from run.html): Save for every app
      // posture in an app context; Steal for guests (your own copy is already
      // yours when you're the owner).
      if (__C.ROOM.kind === 'app') document.getElementById('appsave').style.display = '';
      refreshStealBtn();
      refreshAudioBtn();
    }
    // TALK — the app host's switch, a piece of DATA on the data channel. (Named
    // Talk, not Audio: an app has its own sounds; this is about people talking.)
    // An app-pinned room starts dark: no call layer, the meeting bar hidden.
    // Nothing in the UI ever opened that loop (0.9.12): the plumbing was all
    // there and the only test drove #cam with a programmatic click, which a
    // hidden button answers. The switch is `audio` on the host's app ad
    // (myStatus.app, the same status beat that carries the share itself), so
    // guests read it from the ad that won findSharedApp() — the host's word,
    // by construction, with no new identity plumbing. On: the bar shows and
    // everyone controls their OWN mic (lateMedia asks for audio only here —
    // an app room never touches a camera). Off: every mic goes quiet and the
    // bar folds away; a guest cannot unmute. An app room has no video.
    function roomAudioOn() {
      if (!document.body.classList.contains('app-room')) return false;
      if (__C.appMode === 'host') return !!(__C.model.me.myStatus().app && __C.model.me.myStatus().app.audio);
      const w = (0, /*()*/__C.findSharedApp)();
      return !!(w && w.audio);
    }
    function refreshAudioBtn() {
      const b = document.getElementById('appaudio');
      // Only once the host's ad EXISTS: the switch is a flag on that ad, and
      // appMode turns 'host' a beat before the ad is minted — a tap in that
      // window would be silently lost. The mint below refreshes right away.
      const show = __C.ROOM.kind === 'app' && !__C.ROOM.solo && document.body.classList.contains('app-room') && __C.appMode === 'host' && !!__C.model.me.myStatus().app;
      b.style.display = show ? '' : 'none';
      paintTalkBtn();
    }
    function paintTalkBtn() {
      const b = document.getElementById('appaudio');
      const on = roomAudioOn();
      b.textContent = on ? (0, /*()*/__C.uiText)('barTalkOn', 'Talk: on') : (0, /*()*/__C.uiText)('barTalkOff', 'Talk: off');
      b.title = (0, /*()*/__C.uiText)('barTalkTip', 'Talk with the people in this app — when on, everyone here gets their own mic control (host only)');
      b.classList.toggle('on', on);
    }
    function applyRoomAudio() {
      const on = roomAudioOn();
      const was = document.body.classList.contains('audio-on');
      document.body.classList.toggle('audio-on', on);
      if (!on && __C.model.me.localStream()) {
        // Host turned the room quiet: my mic goes with it, and stays off
        // until the host opens the room again (micBtn refuses meanwhile).
        const tr = __C.model.me.localStream().getAudioTracks()[0];
        if (tr && tr.enabled) { tr.enabled = false; __C.model.me.myStatus().muted = true; paintControls(); (0, /*()*/__C.broadcastStatus)(); }
      }
      if (was !== on) { refreshAudioBtn(); if (!on) (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('barTalkHostOff', 'The app host turned Talk off.')); }
    }
    document.getElementById('appaudio').onclick = () => {
      if (__C.appMode !== 'host' || !__C.model.me.myStatus().app) return;
      __C.model.me.myStatus().app.audio = !__C.model.me.myStatus().app.audio;
      (0, /*()*/__C.broadcastStatus)();
      applyRoomAudio(); refreshAudioBtn();
      (0, /*()*/__C.setStatus)(__C.model.me.myStatus().app.audio ? (0, /*()*/__C.uiText)('barTalkOnStatus', 'Talk is on — everyone here can turn on their mic.') : (0, /*()*/__C.uiText)('barTalkOffStatus', 'Talk is off — every mic is quiet.'));
    };
    function refreshStealBtn() {
      document.getElementById('appsteal').style.display = (__C.ROOM.kind === 'app' && __C.appMode === 'client') ? '' : 'none';
    }
    yield 3113;
    function openAppHelp() {
      if (!(__C.model.apps.soloCtl() || __C.appHostCtl || __C.appClientCtl) && !__C.ROOM.solo) { openMeetHelp(); return; }
      const H = window.GifOS && GifOS.help;
      const ctxName = (document.getElementById('appname').textContent || '').trim();
      const md = (H && H.withOsFooter) ? H.withOsFooter((0, /*()*/__C.currentAppHelpMd)(), (0, /*()*/__C.currentAppCredits)(), { from: 'app Help window', name: ctxName }) : ((0, /*()*/__C.currentAppHelpMd)() || '');
      const parsed = (H && H.parse) ? H.parse(md) : { title: '', html: '' };
      const titleEl = document.getElementById('apphelp-title');
      const bodyEl = document.getElementById('apphelp-body');
      const name = (document.getElementById('appname').textContent || '').trim();
      titleEl.textContent = parsed.title || name || 'Help';
      bodyEl.innerHTML = parsed.html || ((H && H.render) ? H.render(md) : '');
      if (!bodyEl.innerHTML) bodyEl.textContent = md;
      const modal = document.getElementById('apphelp-modal');
      modal.style.display = 'flex';
      bodyEl.scrollTop = 0;
    }
    document.getElementById('apphelp').onclick = openAppHelp;
    // The DOCUMENT takes the screen and body.app-full gives the pane the glass —
    // fullscreening the pane itself banished every modal on this page into the
    // dark behind the top layer (see #appbar .fs-btn above). Where the browser
    // has no element fullscreen (iPhone Safari), this same button opens the
    // in-page filmstrip, which is what the old dock button did.
    (function wireAppFull() {
      const fb = document.getElementById('appfull');
      const FS = window.GifOS && GifOS.fullscreen;
      if (FS && FS.supported()) {
        const repaint = FS.attach(fb, document.documentElement, {
          // app-full is an APP filling the glass: a meeting with no app that takes the screen keeps its own layout (Scroll scrolls)
          // (the Stage view places the app itself, as one of its tabs: it never hands the app the glass)
          fill: 'app-full', fillIf: () => document.body.classList.contains('has-app') && window.__meetView !== 'stage', words: true,
          on: () => FS.active() === document.documentElement && !fsQuiet(),   // the quiet full screen still offers Full screen (the filmstrip)
          enterLabel: (0, /*()*/__C.uiText)('fullScreen', 'Full screen'), exitLabel: (0, /*()*/__C.uiText)('leaveFullScreen', 'Leave full screen') });
        // An app bar is nine buttons: the glyph comes back while an app is up.
        if (repaint && window.MutationObserver && document.body) {
          try { new MutationObserver(() => { try { repaint(); } catch (err) {} }).observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
        }
        return;
      }
      if (!fb) return;
      fb.dataset.fsMode = 'inpage';
      fb.style.display = '';
      fb.addEventListener('click', (e) => {
        e.preventDefault();
        if (fsview.classList.contains('on')) closeFsView();
        else openFsView('auto');
      });
      paintInPageFull();
    })();
    // ONE-ROW APP BAR ON A PHONE (0.9.24 hotfix). 0.9.23's bar grew to three
    // rows at 390 px (16 px buttons, the app's name, a full-width "on this
    // device" line). Where the app bar is the page's only bar (solo app, app
    // room) and it is narrow, the GifOS link, the app, Invite and the OS
    // header's own Help and Full screen keep the row; the rest moves into a
    // "⋯" menu: the same buttons, same handlers.
    (function wireAppMore() {
      const abar = document.getElementById('appbar');
      if (!abar) return;
      const orig = Array.from(abar.children);
      const more = document.createElement('button');
      more.type = 'button'; more.id = 'appmore'; more.textContent = '⋯';
      more.title = (0, /*()*/__C.uiText)('more', 'More'); more.setAttribute('aria-label', more.title);
      more.setAttribute('aria-haspopup', 'menu'); more.setAttribute('aria-expanded', 'false');
      const menu = document.createElement('div');
      menu.id = 'appmenu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
      // A phone's app covers the meeting's top row, view button and all: the folded bar carries its own view button.
      const view = document.createElement('button');
      view.type = 'button'; view.id = 'appview'; view.className = 'appview';
      view.title = (0, /*()*/__C.uiText)('viewPickTip', 'Change the view (Alt+F)'); view.setAttribute('aria-label', (0, /*()*/__C.uiText)('viewPick', 'View'));
      view.setAttribute('aria-haspopup', 'dialog'); view.setAttribute('aria-controls', 'viewpick');
      view.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>';
      view.addEventListener('click', (e) => { e.stopPropagation(); const fb = document.getElementById('fitbtn'); if (fb) fb.click(); });
      abar.appendChild(view); abar.appendChild(more); abar.appendChild(menu);
      // An app shared in a meeting keeps only its name, Help and Full screen on the row: the meeting has its own
      // Invite, and Hide, Stop and the rest are one tap away in the menu, each a full-size target.
      const inMeeting = () => { const b = document.body.classList; return b.contains('has-app') && !b.contains('solo-app') && !b.contains('app-room'); };
      const keep = (el) => el.classList.contains('brand') || (inMeeting() ? ['appgif', 'appname', 'apphelp', 'appfull'] : ['appgif', 'appname', 'appinvite', 'apphelp', 'appfloat', 'appfull']).includes(el.id);
      const placeMenu = () => {
        const r = more.getBoundingClientRect();
        menu.style.top = Math.round(r.bottom + 6) + 'px';
        menu.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
        menu.style.left = 'auto';
      };
      const setOpen = (on) => {
        menu.hidden = !on; more.setAttribute('aria-expanded', on ? 'true' : 'false');
        if (on) placeMenu();
      };
      function fit() {
        const b = document.body.classList;
        // A phone folds a meeting's app bar at every width (on its side too): one row, the view button on it.
        const fold = abar.clientWidth > 0 && (((b.contains('solo-app') || b.contains('app-room')) && abar.clientWidth <= 720) || (inMeeting() && __C.model.consts.IS_MOBILE()));
        const how = fold ? (inMeeting() ? 'm' : 's') : '';
        if (how === (abar.dataset.foldHow || '')) return;
        for (const el of orig) abar.insertBefore(el, more);
        delete abar.dataset.fold; delete abar.dataset.foldHow; setOpen(false);
        if (fold) abar.insertBefore(view, more);
        if (fold) { for (const el of orig) if (!keep(el)) menu.appendChild(el); abar.dataset.fold = '1'; abar.dataset.foldHow = how; }
      }
      more.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.hidden); });
      // A pick runs its own handler first, then the menu closes.
      menu.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('button')) setTimeout(() => setOpen(false), 0); });
      document.addEventListener('click', (e) => { if (!menu.hidden && !(e.target && e.target.closest && e.target.closest('#appmenu, #appmore'))) setOpen(false); }, true);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) setOpen(false); });
      window.addEventListener('resize', () => { if (!menu.hidden) placeMenu(); });
      try { new ResizeObserver(() => { try { fit(); if (!menu.hidden) placeMenu(); } catch (e) {} }).observe(abar); } catch (e) {}
      try { new MutationObserver(() => { try { fit(); } catch (e) {} }).observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
      fit();
    })();
    document.getElementById('apphelp-close').onclick = () => { document.getElementById('apphelp-modal').style.display = 'none'; };
    document.getElementById('apphelp-modal').onclick = (e) => {
      if (e.target && e.target.id === 'apphelp-modal') e.target.style.display = 'none';
    };
    document.getElementById('appsave').onclick = () => {
      const dl = (p) => p.then((bytes) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([bytes], { type: 'image/gif' }));
        a.download = (document.getElementById('appname').textContent || 'app') + '-snapshot.gif';
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }).catch((e) => (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('barSaveFail', 'Could not save: {err}').split('{err}').join(e && e.message || e)));
      if (__C.model.apps.soloCtl() && __C.ROOM.solo) __C.model.apps.soloCtl().save();
      else if (__C.appHostCtl) __C.appHostCtl.save();
      else if (__C.appClientCtl && __C.appClientCtl.snapshot) {
        // the room's shared data, or a clean copy: the same two-choice sheet as every download
        let st = null; try { st = __C.appClientCtl.mirrorState && __C.appClientCtl.mirrorState(); } catch (e) {}
        const has = !!(st && st.collections && Object.keys(st.collections).length);
        (has && GifOS.lock && GifOS.lock.showSheet ? GifOS.lock.showSheet('exportData', document.getElementById('appname').textContent || 'App') : Promise.resolve('ok'))
          .then((act) => { if (act !== 'cancel') dl(__C.appClientCtl.snapshot(act === 'alt' ? { clean: true } : undefined)); });
      }
    };
    // Steal is TWO different wants — take the game AND the scoreboard, or
    // take just the game — so the first press asks which, right where the
    // finger already is: the button splits into the two choices, and Esc-like
    // second thoughts (clicking anything else) fold it back.
    document.getElementById('appsteal').onclick = () => {
      if (!(__C.appClientCtl && __C.appClientCtl.stealToDesktop)) return;
      const b = document.getElementById('appsteal');
      if (b.dataset.armed) return;
      b.dataset.armed = '1';
      const label = b.textContent;
      const fold = () => {
        delete b.dataset.armed;
        [d1, d2, d3].forEach((x) => x.remove());
        b.style.display = '';
      };
      // The confirmation lives ON THE BUTTON. The status line is a span at
      // the far end of the top bar, and a successful steal read as SILENCE
      // at the point of click (reported 2026-08-08: the copy was saved,
      // nothing said so where the user was looking). The button is where
      // their eyes already are — morph it, hold it, restore it.
      const go = (data, btn) => {
        [d1, d2, d3].forEach((x) => { x.disabled = true; });
        btn.textContent = (0, /*()*/__C.uiText)('stealBusy', 'Stealing…');
        __C.appClientCtl.stealToDesktop({ data })
          .then(() => {
            fold();
            b.textContent = (0, /*()*/__C.uiText)('stealDone', '🥷 Stolen ✓');
            b.disabled = true;
            (0, /*()*/__C.setStatus)(data === 'none'
              ? (0, /*()*/__C.uiText)('stealNone', '🥷 Yours now — a clean copy in your desktop’s Stolen Apps, none of the room’s data.')
              : data === 'connect'
                ? (0, /*()*/__C.uiText)('stealConnect', '🥷 Yours now — the room as it stood when you joined, in your Stolen Apps.')
                : (0, /*()*/__C.uiText)('stealAll', '🥷 Yours now — saved to your desktop’s Stolen Apps, data and all.'));
            setTimeout(() => { b.textContent = label; b.disabled = false; }, GifOS.timings.APP_STEAL_DONE_MS);
          })
          .catch((e) => { fold(); (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stealFail', 'Could not steal: {err}').split('{err}').join(e && e.message || e)); });
      };
      const mk = (txt, title, data) => {
        const x = document.createElement('button');
        x.textContent = txt; x.title = title; x.className = b.className; x.dataset.steal = data; x.style.fontSize = '16px';
        x.onclick = () => go(data, x);
        b.parentNode.insertBefore(x, b.nextSibling);
        return x;
      };
      b.style.display = 'none';
      // Insertion order: reversed, since each lands at b.nextSibling —
      // reads left-to-right as: + data · as I joined · app only.
      const d3 = mk((0, /*()*/__C.uiText)('stealApp', 'without data'), (0, /*()*/__C.uiText)('stealAppTip', 'A clean copy — the app alone, none of the room’s data'), 'none');
      const d2 = mk((0, /*()*/__C.uiText)('stealJoined', 'as I joined'), (0, /*()*/__C.uiText)('stealJoinedTip', 'The app and the room as it stood when you came in'), 'connect');
      const d1 = mk((0, /*()*/__C.uiText)('stealData', 'with data'), (0, /*()*/__C.uiText)('stealDataTip', 'The app and everything in it right now'), 'current');
    };
    yield 3125;
    function clearAppView(why) {
      (0, /*()*/__C.appEv)('clear', { why: why || 'unstated' });
      __C.act.appUnmounted();   // the core stops the mount and drops its handles, mode and key
      try { delete window.__appClientCtl; } catch (e) {}
      refreshStealBtn();
      appMountEl.innerHTML = '';
      __C.act.surface({ appPaneOn: false });
      document.body.classList.remove('has-app');
      window.__gifosHeaderApp = '';
      try { (0, /*()*/__C.applyPageHeader)(); } catch (e) {}
      paintHelpTip();
      try { window.__meetRelayout(); } catch (e) {}
      const ap = document.getElementById('appperms'); if (ap) ap.style.display = 'none';
    }
    yield 3134;
    // Converge THIS phone's app view onto whatever the room is sharing. Runs on
    // every status tick and on peer departure, so it self-heals like the mesh.
    function paintAppWho(text) { document.getElementById('appwho').textContent = text; }
    yield 3145;
    // Keep the app buttons honest about what a tap will do.
    function updateAppButtons(want) {
      const isMine = !!(__C.model.me.myStatus().app && __C.appKey === __C.model.me.myStatus().app.s);
      const btn = document.getElementById('appbtn');
      if (want && want.s === __C.appHiddenSid && !isMine) {
        btn.textContent = (0, /*()*/__C.uiText)('showApp', 'Show app');
        btn.title = (0, /*()*/__C.uiText)('appHidden', 'An app is shared here ({name}) — you hid it. Tap to bring it back.').replace('{name}', want.name || 'App');
      } else {
        btn.textContent = (0, /*()*/__C.uiText)('runApp', 'Run app');
        btn.title = (0, /*()*/__C.canIRunApp)()
          ? (0, /*()*/__C.uiText)('appTip', 'Run an app inside this meeting. Most stay in sync. One that turns multiplayer off stays on the host\'s screen.')
          : (0, /*()*/__C.uiText)('appDeniedTip', 'Only this room\u2019s hosts — or people they allow — can run an app here').replace(/^🛡\s*/, '');
      }
      const hideB = document.getElementById('apphide');
      hideB.style.display = (__C.appKey && __C.appMode !== 'watch' && !isMine) ? '' : 'none';
      const stopB = document.getElementById('appstop');
      stopB.style.display = (isMine || !(0, /*()*/__C.hasAdminRoom)() || __C.amAdmin) ? '' : 'none';
      stopB.textContent = isMine ? (0, /*()*/__C.uiText)('stopApp', 'Stop app') : (0, /*()*/__C.uiText)('stopAppAll', 'Stop for everyone');
      stopB.title = isMine ? (0, /*()*/__C.uiText)('stopAppTip', 'Stop sharing this app with the meeting')
        : ((0, /*()*/__C.hasAdminRoom)() ? (0, /*()*/__C.uiText)('stopAppTipAdmin', 'Host: stop this app for the whole room')
          : (0, /*()*/__C.uiText)('stopAppTipRoom', 'Stop this app for the whole room — everyone sees it was you, and the sharer can re-share'));
      // ONE RUNTIME: in an app-PINNED room the app cannot be unmounted, hidden
      // or swapped — the room's whole identity is this app (docs/one-runtime.md).
      if (__C.ROOM.appPinned) { stopB.style.display = 'none'; hideB.style.display = 'none'; }
      const leadB = document.getElementById('applead');
      leadB.style.display = (isMine && __C.appLeadable) ? '' : 'none';
      leadB.textContent = __C.appLeadOn ? (0, /*()*/__C.uiText)('barLeading', '👑 Leading') : (0, /*()*/__C.uiText)('barCommunal', 'Communal');
      leadB.title = __C.appLeadOn
        ? (0, /*()*/__C.uiText)('barLeadingTip', 'You lead this app — only your page-turns move the room. Tap for communal control.')
        : (0, /*()*/__C.uiText)('barCommunalTip', 'Communal — anyone here can drive the shared app\u2019s controls. Tap to lead.');
    }
    document.getElementById('appbtn').onclick = () => {
      const want = (0, /*()*/__C.findSharedApp)();
      if (want && want.s === __C.appHiddenSid && (!__C.model.me.myStatus().app || __C.model.me.myStatus().app.s !== want.s)) {
        __C.act.appShow(); return; // Show app (un-hide)
      }
      if (__C.model.me.myStatus().app) { (0, /*()*/__C.stopApp)(); return; } // toggle my own share off
      if (!(0, /*()*/__C.canIRunApp)()) { (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('appDenied', '🛡 Only this room\u2019s hosts — or people they allow — can run an app here.')); return; }
      openAppPicker();
    };
    document.getElementById('appstop').onclick = () => {
      if (__C.model.me.myStatus().app && __C.appKey === __C.model.me.myStatus().app.s) { (0, /*()*/__C.stopApp)(); return; }
      const want = (0, /*()*/__C.findSharedApp)();
      if (!want) return;
      if ((0, /*()*/__C.hasAdminRoom)() && !__C.amAdmin) { (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stOnlyThisRoomSAdmins2', '🛡 Only this room\u2019s hosts can stop the shared app.')); return; }
      (0, /*()*/__C.stopRoomApp)(want);
    };
    document.getElementById('apphide').onclick = () => {
      if (!__C.act.appHide()) return;
      (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('barHideStatus', '🧩 App hidden on your screen only — the meeting still shares it. \u201CShow app\u201D brings it back.'));
      (0, /*()*/__C.reconcileApp)();
    };
    document.getElementById('applead').onclick = () => {
      if (__C.act.appLead() === null) return;
      updateAppButtons((0, /*()*/__C.findSharedApp)());
      (0, /*()*/__C.setStatus)(__C.appLeadOn ? (0, /*()*/__C.uiText)('barLeadingStatus', '🧩 You lead the app — only your changes to its shared controls stick.')
        : (0, /*()*/__C.uiText)('barCommunalStatus', '🧩 Communal control — anyone here can drive the shared app.'));
    };
    document.getElementById('app-cancel').onclick = () => { document.getElementById('app-modal').style.display = 'none'; };
    yield 3155;
    function appStageAskClose() { const el = document.getElementById('appstage-ask'); if (el) el.remove(); }
    function appStageAsk() {
      if (__C.appStageConsent !== null || document.getElementById('appstage-ask')) return;
      const el = document.createElement('div');
      el.id = 'appstage-ask'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-live', 'polite');
      el.style.cssText = 'position:fixed;left:50%;bottom:calc(88px + var(--inset-bottom,0px));transform:translateX(-50%);z-index:40;width:max-content;max-width:min(92vw,520px);background:var(--c-scrim);color:var(--c-paper);border:1px solid var(--c-gray);border-radius:var(--r-lg);padding:10px 12px;display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;font:15px/1.35 system-ui,sans-serif';
      const name = ((typeof __C.findSharedApp === 'function' && (0, /*()*/__C.findSharedApp)()) || {}).name || (0, /*()*/__C.uiText)('appStageThisApp', 'This app');
      const t = document.createElement('span'); t.style.cssText = 'flex:1 1 220px';
      t.textContent = (0, /*()*/__C.uiText)('appStageAsk', '{app} may put you on stage when it’s your turn.').split('{app}').join(name);
      const btn = (label, primary) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = 'min-height:44px;padding:8px 16px;border-radius:var(--r-pill);border:1px solid var(--c-gray);font:inherit;font-weight:700;cursor:pointer;' + (primary ? 'background:var(--c-white);color:var(--c-ink)' : 'background:transparent;color:var(--c-paper)'); return b; };
      const ok = btn((0, /*()*/__C.uiText)('appStageOk', 'OK'), true), no = btn((0, /*()*/__C.uiText)('appStageNo', 'Not me'), false);
      ok.id = 'appstage-ok'; no.id = 'appstage-no';
      ok.onclick = () => { appStageAskClose(); __C.act.appConsent(true); };
      no.onclick = () => { appStageAskClose(); __C.act.appConsent(false); };
      el.append(t, ok, no);
      document.body.appendChild(el);
    }
    yield 3161;
    window.appStagePlanForTest = __C.appStagePlan;
    yield 3163;
    // ---- run a GIF app that isn't on this computer (file or link) ----
    function showAddErr(msg) { const el = document.getElementById('app-add-err'); if (!el) return; el.textContent = msg || ''; el.style.display = msg ? '' : 'none'; }
    yield 3165;
    async function importAndRunGif(bytes, rawName) {
      showAddErr('');
      const r = await (0, /*()*/__C.importGif)(bytes, rawName);
      if (r.error) { showAddErr(r.error); return; }
      document.getElementById('app-modal').style.display = 'none';
      (0, /*()*/__C.runApp)(r.fileId, r.name);
    }
    yield 3169;
    const scriptOnce = {};
    function loadScriptOnce(src) {
      if (!scriptOnce[src]) scriptOnce[src] = new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = () => res(); el.onerror = () => { delete scriptOnce[src]; rej(new Error('load ' + src)); }; document.head.appendChild(el); });
      return scriptOnce[src];
    }
    yield 3173;
    async function runChoice(c, say) {
      if (c.fileId) { document.getElementById('app-modal').style.display = 'none'; (0, /*()*/__C.runApp)(c.fileId, c.name); return true; }
      say((0, /*()*/__C.uiText)('appInstalling', 'Getting {name}…').split('{name}').join(c.name));
      let r; try { r = await (0, /*()*/__C.installRunApp)(c.install); } catch (e) { r = { error: String(e && e.message || e) }; }
      if (!r || r.error) { say((0, /*()*/__C.uiText)('appInstallFail', 'Couldn’t get {name}. Check the connection and try again.').split('{name}').join(c.name), true); return false; }
      document.getElementById('app-modal').style.display = 'none';
      (0, /*()*/__C.runApp)(r.fileId, r.name);
      return true;
    }
    yield 3176;
    document.getElementById('app-file').onclick = () => document.getElementById('app-file-input').click();
    document.getElementById('app-file-input').onchange = async (e) => {
      const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
      try { await importAndRunGif(new Uint8Array(await f.arrayBuffer()), f.name); } catch (err) { showAddErr((0, /*()*/__C.uiText)('appReadFail', 'Could not read that file.')); }
    };
    document.getElementById('app-url-go').onclick = async () => {
      const raw = (document.getElementById('app-url').value || '').trim();
      if (!raw) { showAddErr((0, /*()*/__C.uiText)('appNeedLink', 'Paste a GIF link first.')); return; }
      const go = document.getElementById('app-url-go'); go.disabled = true; const was = go.textContent; go.textContent = '…'; showAddErr('');
      try {
        const run = (0, /*()*/__C.runLinkTarget)(raw);
        if (run && run.slug) {
          // the app named by an official run link: the copy already on this device, else the same install the picker does
          let files = []; try { files = await GifOS.store.allFileMeta(); } catch (e) {}
          const have = (files || []).find((f) => f && f.isApp && f.appId === run.slug);
          const def = __C.model.consts.RUN_DEFAULTS().find((d) => d.appId === run.slug);
          if (have || def) { await runChoice(have ? { name: (have.name || run.slug).replace(/\.gif$/i, ''), fileId: have.id } : { name: def.name, install: def }, (w, bad) => showAddErr(bad ? w : '')); return; }
        }
        let r = await (0, /*()*/__C.fetchGifFromUrl)(run ? run.url : raw);
        if (r.error && run && run.official && run.official !== run.url) r = await (0, /*()*/__C.fetchGifFromUrl)(run.official);
        if (r.error) { showAddErr(r.error); return; }
        await importAndRunGif(r.bytes, r.name);
      }
      finally { go.disabled = false; go.textContent = was; }
    };
    document.getElementById('app-url').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('app-url-go').click(); } });
    async function openAppPicker() {
      const modal = document.getElementById('app-modal');
      const list = document.getElementById('app-list');
      showAddErr(''); const urlIn = document.getElementById('app-url'); if (urlIn) urlIn.value = '';
      list.innerHTML = '<small style="color:#667">' + (0, /*()*/__C.uiText)('appLoading', 'Loading your apps…') + '</small>';
      modal.style.display = 'flex';
      let files = [];
      try { files = await GifOS.store.allFileMeta(); } catch (e) {} // names and flags — never the bytes of every app to fill a list
      // System launchers are OUT, all four of them. Running one routes through
      // the runtime's SYSTEM_PAGES whitelist, which is a location.replace() —
      // picking Broadcast or App Store from inside a meeting navigated the
      // WHOLE MEETING away. Same set as desktop.js SYSTEM_LAUNCHERS.
      const SYSTEM_APPS = { meet: 1, video: 1, broadcast: 1, appstore: 1 };
      const apps = (files || []).filter((f) => f.isApp && !SYSTEM_APPS[f.appId]);
      // S5: a dropdown of real apps, the defaults first, on every device (a fresh one too); Run installs a missing one, then runs it.
      list.textContent = '';
      const choices = (0, /*()*/__C.runChoices)(apps);
      const row = document.createElement('div'); row.className = 'app-pickrow';
      const sel = document.createElement('select'); sel.id = 'app-pick'; sel.setAttribute('aria-label', (0, /*()*/__C.uiText)('appPickAria', 'App to run'));
      choices.forEach((c, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = c.name; o.dataset.name = c.name; if (c.install) o.dataset.install = '1'; sel.appendChild(o); });
      const go = document.createElement('button'); go.type = 'button'; go.id = 'app-pick-go'; go.textContent = (0, /*()*/__C.uiText)('appSheetRun', 'Run');
      const note = document.createElement('small'); note.id = 'app-pick-note'; note.className = 'app-pick-note';
      const noteFor = () => { const c = choices[+sel.value]; note.textContent = c && c.install ? (0, /*()*/__C.uiText)('appPickMissing', 'Not on this device yet. Run puts it here first, then starts it.') : ''; note.classList.remove('bad'); };
      sel.addEventListener('change', noteFor);
      go.addEventListener('click', async () => {
        const c = choices[+sel.value]; if (!c) return;
        go.disabled = true; sel.disabled = true;
        try { await runChoice(c, (w, bad) => { note.textContent = w; note.classList.toggle('bad', !!bad); }); }
        finally { go.disabled = false; sel.disabled = false; }
      });
      row.appendChild(sel); row.appendChild(go);
      list.appendChild(row); list.appendChild(note);
      noteFor();
      // More apps: the App Store, in a new tab (the meeting stays open; Run app lists what it adds).
      const more = document.createElement('a'); more.className = 'app-empty-link app-empty-store'; more.href = '/store'; more.target = '_blank'; more.rel = 'noopener';
      more.textContent = (0, /*()*/__C.uiText)('appEmptyStore', 'Find more apps in the App Store'); list.appendChild(more);
    }
    yield 3184;

    // The bot's eyes (the agent's watch): the page marks itself watched.
    function paintBotEyes(on) { document.body.classList.toggle('bot-eyes', on); }
    yield 3193;
    function paintAiNotesAdmin() {
      const sel = document.getElementById('adm-ai-notes');
      if (sel) { sel.value = (0, /*()*/__C.aiNotesSetting)(); sel.disabled = !((0, /*()*/__C.hasAdminRoom)() && __C.amAdmin); }
      const box = document.getElementById('adm-ai-wait');
      const ul = box && box.querySelector('ul');
      if (!ul) return;
      ul.textContent = '';
      let n = 0;
      if ((0, /*()*/__C.aiNotesSetting)() === 'ask' && __C.amAdmin) {
        for (const pid of __C.model.roster.rosterIds()) {
          const st = __C.model.roster.statusOf().get(pid);
          if (!st || !st.bot || st.nts !== 2) continue;
          n++;
          const li = document.createElement('li');
          li.textContent = (__C.model.roster.rosterNames()[pid] || (__C.model.roster.peers().get(pid) || {}).name || '…') + ' ';
          const b = document.createElement('button'); b.type = 'button'; b.textContent = (0, /*()*/__C.uiText)('admAiAllow', 'Allow notes');
          b.onclick = () => { (0, /*()*/__C.setMod)(pid, 'ain', true); paintAiNotesAdmin(); };
          li.appendChild(b); ul.appendChild(li);
        }
      }
      box.hidden = !n;
    }
    yield 3208;
    // A canvas for the agent's picture (the page's; a host with no screen has none).
    function newCanvas() { return document.createElement('canvas'); }
    // The bot's own view (#botview): its state, the transcript and the chat.
    function paintBotView(st) {
      const rows = (m) => Array.from(m.values()).filter((l) => l && !/^gb1 /.test(String(l.text || ''))).sort((x, y) => (x.at || 0) - (y.at || 0)).map((l) => ({ name: l.by || '', text: l.text || '' }));
      GifOS.meetAgent.renderBotView(document.getElementById('botview'), Object.assign({}, st, { transcript: rows(__C.model.chat.trs()), chat: rows(__C.model.chat.lines()) }), __C.uiText);
    }
    yield 3211;
    // The agent contract over the page's postMessage (a host page or extension talks to it); a host with no page has none.
    function bridgeAgentToPage(core) { GifOS.meetAgent.postMessageBridge(core, window); }
    yield 3213;
    function setBotView(on) {
      on = !!on;
      if (__C.act.botView(on) !== true) return;   // the core decides (lobby: kept for the boot; unchanged: nothing to paint)
      document.body.classList.toggle('bot-view', on);
      const bv = document.getElementById('botview'); if (bv) bv.hidden = !on;
      const back = document.getElementById('bot-back'), forced = document.getElementById('bot-forced');
      if (back) back.hidden = __C.model.consts.AGENT_FORCED();
      if (forced) forced.hidden = !__C.model.consts.AGENT_FORCED();
      if (on && !__C.model.consts.AGENT_FORCED()) {
        let seen = false;
        try { seen = sessionStorage.getItem('gifos_bot_seen') === '1'; sessionStorage.setItem('gifos_bot_seen', '1'); } catch (e) {}
        if (!seen) (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('botFirstNote', 'This view is for AI assistants. Tap Back to normal view to return.'));
      }
      try { if (pipAimed) { pipAimed.autoPictureInPicture = false; pipAimed = null; } } catch (e) {}
      try { (0, /*()*/__C.sendVisPark)(); } catch (e) {}
    }
    yield 3215;
    (function wireBotView() {
      const back = document.getElementById('bot-back');
      let hideBotsT = null;   // the Hide bots repaint tick (the view's own clock)
      if (back) back.onclick = () => (0, /*()*/__C.backToNormalView)();
      const sayF = document.getElementById('bot-say-form'), chatF = document.getElementById('bot-chat-form');
      if (sayF) sayF.addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = document.getElementById('bot-say'); const text = inp.value.trim(); if (!text) return;
        inp.value = '';
        // A voice needs speech audio. An embedder (or an extension) that makes it sets window.gifosAgentVoice(text) -> WAV
        // bytes (base64); with none, the words go to chat and the status says so, never silently.
        const tts = window.gifosAgentVoice;
        if (typeof tts === 'function' && __C.model.apps.agentCore()) Promise.resolve(tts(text)).then((wav) => __C.model.apps.agentCore().api.say(text, { wav: wav }));
        else { (0, /*()*/__C.agentChat)(text); (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('botNoVoice', 'No voice on this page, so it went to chat.')); }
      });
      if (chatF) chatF.addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = document.getElementById('bot-chat-in'); const r = (0, /*()*/__C.agentChat)(inp.value);
        if (r.ok) inp.value = ''; else (0, /*()*/__C.setStatus)(r.error);
      });
      const hand = document.getElementById('bot-hand');
      if (hand) hand.onclick = () => __C.act.raiseHand(!__C.model.me.myStatus().hand);
      const lv = document.getElementById('bot-leave');
      if (lv) lv.onclick = () => { try { (0, /*()*/__C.leaveMeeting)(); } catch (e) {} };
      // HIDE BOTS (Settings, this device only): bot tiles off the grid, their own voices muted.
      const hb = document.getElementById('hidebots');
      const applyHideBots = () => {
        let moved = false;
        for (const [pid, p] of __C.model.roster.peers()) {
          if (!p.tile) continue;
          const hide = (0, /*()*/__C.botHidden)(pid);
          if (hide && p.tile.style.display !== 'none') { p.tile.style.display = 'none'; p.tile.dataset.bothide = '1'; moved = true; }
          else if (!hide && p.tile.dataset.bothide) { delete p.tile.dataset.bothide; p.tile.style.display = ''; moved = true; }
        }
        if (moved) { try { layout(); (0, /*()*/__M.applyBuses)(); } catch (e) {} }
      };
      const setHide = (on) => {
        __C.act.surface({ hideBotsOn: !!on });
        try { localStorage.setItem('gifos_hide_bots', on ? '1' : '0'); } catch (e) {}
        clearInterval(hideBotsT); hideBotsT = null;
        if (on) hideBotsT = setInterval(applyHideBots, GifOS.timings.AGENT_TICK_MS);
        applyHideBots();
        try { (0, /*()*/__M.applyBuses)(); } catch (e) {}
      };
      let saved = false; try { saved = localStorage.getItem('gifos_hide_bots') === '1'; } catch (e) {}
      if (hb) { hb.checked = saved; hb.onchange = () => setHide(hb.checked); }
      if (saved) setHide(true);
    })();
    yield 3221;

    // Test hook: lets the e2e suite observe mesh + quality state.
    // AUDIO-OUT FORENSICS (debugDump audio, read-only): where each voice should leave the page. Every media
    // element (the DOM ones and the detached companions on tile videos), the meeting context and its clock, the
    // WebKit one ear, the stage ear, my Stadium's sound, every fold a head builds (sources and the bus's level now)
    // and the composite streams' audio tracks. A deaf page (penguin, 2026-11-07) had none of this in its dump.
    function audioDump() {
      const tr = (t) => (t ? t.readyState[0] + (t.muted ? 'M' : '') + (t.enabled ? '' : 'X') + ':' + String(t.id).slice(0, 6) : null);
      const trs = (st) => (st && st.getAudioTracks ? st.getAudioTracks().map(tr) : null);
      const el = (e) => (e ? { p: !!e.paused, m: !!e.muted, v: +(+e.volume || 0).toFixed(2), rs: e.readyState, sink: e.sinkId === undefined ? null : String(e.sinkId), a: trs(e.srcObject), bl: __M.blockedAudio.has(e) } : null);
      const els = [];
      for (const v of document.querySelectorAll('video, audio')) {
        if (els.length >= 40) break;
        const t = v.closest && v.closest('[data-peer],[data-row]');
        els.push(Object.assign({ who: t ? String(t.dataset.peer || ('row:' + t.dataset.row)).slice(0, 10) : (v.id || v.tagName.toLowerCase()), tag: v.tagName[0] }, el(v), { aud: v._aud ? el(v._aud) : undefined }));
      }
      const foldOf = (f) => (f ? { pk: f.peakNow ? f.peakNow() : null, src: f.info ? f.info() : (f.keys ? f.keys() : null), out: tr(f.track ? f.track() : null) } : null);
      const folds = {}; for (const [k, f] of __M.downFolds) folds[k] = foldOf(f);
      const comp = {}; for (const [k, m] of __C.mosIn) comp[k] = { via: String(m.via || '').slice(0, 8), a: trs(m.stream), el: m.el ? { p: !!m.el.paused, rs: m.el.readyState } : null };
      const sb = {}; for (const [k, m] of __C.mosStandby) sb[k] = { via: String(m.via || '').slice(0, 8), a: trs(m.stream) };
      let sink = null; try { sink = __C.model.net.ac() && __C.model.net.ac().sinkId !== undefined ? (typeof __C.model.net.ac().sinkId === 'object' ? ((__C.model.net.ac().sinkId && __C.model.net.ac().sinkId.type) || 'obj') : String(__C.model.net.ac().sinkId)) : null; } catch (e) {}
      return {
        ac: __C.model.net.ac() ? { st: __C.model.net.ac().state, sink, t: +(+__C.model.net.ac().currentTime || 0).toFixed(2), clock: (0, /*()*/__M.acClockInfo)() } : null,
        act: { sticky: !!(navigator.userActivation && navigator.userActivation.hasBeenActive), kickArmed: !!__M.audioKickArmed, blocked: __M.blockedAudio.size, held: (0, /*()*/__M.soundHeld)(), vis: document.visibilityState },
        mix: (() => { try { return Object.assign({}, __M.mix); } catch (e) { return null; } })(), waiting: (typeof __C.iAmWaiting === 'function') ? (0, /*()*/__C.iAmWaiting)() : null,
        mic: __C.model.me.localStream() ? trs(__C.model.me.localStream()) : null,
        els, wkEar: (typeof __M.wkEar !== 'undefined' && __M.wkEar) ? { el: el(__M.wkEar.el), fold: foldOf(__M.wkEar.fold) } : null, hear: (0, /*()*/__M.hearState)(),
        stageEar: __M.stageEar ? { el: el(__M.stageEar.el), fold: foldOf(__M.stageEar.fold) } : null,
        stadium: __M.sdViewSt ? { a: trs(__M.sdViewSt) } : null,
        prod: __M.prodPack && __M.prodPack.stream ? { a: trs(__M.prodPack.stream), pk: __M.prodPack.peakNow ? __M.prodPack.peakNow() : null, fold: __M.prodPack.foldInfo ? __M.prodPack.foldInfo() : null } : null,
        relay: { via: [...__C.model.net.relayVia()].map(([t, r]) => ({ t: String(t).slice(0, 8), via: String(r.via).slice(0, 8), st: r.stream ? trs(r.stream) : null })), jobs: [...__C.model.net.relayJobs().keys()].map((k) => k.split('>').map((x) => String(x).slice(0, 8)).join('>')) },
        folds, comp, standby: sb,
      };
    }
    yield 3223; // var: the debug log's ring reader (above) may ask for it before this line runs
    let dbgMeterPanel = null;
    yield 3228;   // chat line ids I posted for the page I carry: never sent back to it
    function carryIo(far, l, sendTv, askVouch, guest) {
      return { guest, me: __C.model.me.myId(), far, l, dev: () => __C.model.me.myDevHash(), sub: () => (__C.model.net.meshNode() && __C.model.net.meshNode().sub) | 0, sid: () => __C.model.room.sessId(), sendTv, askVouch,
        ask: GifOS.meetTurn.askIce(window.fetch.bind(window)), webScheme: () => 'wss://', log: __C.turnNote,
        seal: (obj) => __C.model.net.net().seal(__C.model.room.roomE2E(), obj),
        open: (env) => __C.model.net.net().open(__C.model.room.roomE2E(), env).then((m) => m || (__C.model.room.prevRoomE2E() ? __C.model.net.net().open(__C.model.room.prevRoomE2E(), env) : null)),
        sign: (text) => __C.model.net.net().edSign(__C.model.me.myIdentity().priv, text).then((sig) => ({ sig, pub: __C.model.me.myIdentity().pubB64 })),
        verify: (id, pub, sig, text) => GifOS.meshIdentity.peerIdOf(pub).then((got) => (got === id ? __C.model.net.net().edVerify(pub, sig, text) : false)) };
    }
    yield 3247;
    function dbgMeters() {
      if (!__C.DEBUG_ON || !GifOS.meetMeters) return null;
      if (!__C.dbgMeterKit) {
        __C.dbgMeterKit = GifOS.meetMeters.create({ ac: () => __C.ac, sources: __M.dbgMeterSources });
        __C.dbgMeterKit.start(500);
        setInterval(() => { if (dbgMeterPanel) GifOS.meetMeters.paint(dbgMeterPanel, __C.dbgMeterKit.read()); }, 1000);
        if (__C.dbgMeterAsked) dbgMeterShow(true);
      }
      return __C.dbgMeterKit;
    }
    function dbgMeterShow(on) {
      if (!on) { if (dbgMeterPanel) dbgMeterPanel.remove(); dbgMeterPanel = null; return false; }
      if (!dbgMeterPanel) {
        dbgMeterPanel = document.createElement('pre'); dbgMeterPanel.id = 'dbgmeters';
        dbgMeterPanel.style.cssText = 'position:fixed;left:4px;top:40px;z-index:99999;margin:0;padding:4px 6px;font:11px/1.25 monospace;color:#9f9;background:rgba(0,0,0,.72);pointer-events:none;white-space:pre;max-height:60vh;overflow:hidden';
        document.body.appendChild(dbgMeterPanel);
      }
      return true;
    }
    yield 3252;
    function viewTestHooks(v) {
      Object.assign(v, {
      stadFaceAtForTest: (x, y) => { const w = document.getElementById('stadwhole'); return w ? (0, /*()*/__C.stadFaceIdAt)(w, x, y) : null; },
      // What my Stadium shows, by the cell ids it carries, and my row.
      stadIdsForTest: () => {
        const c = (0, /*()*/__C.meshCoord)(), m = comfyStadMeta(), v = m.video;
        const row = []; if (c) for (let j = 0; j < __C.model.consts.SCALE().C; j++) { const pid = j === c.i ? __C.model.me.myId() : (0, /*()*/__C.occPid)({ pc: c.pc, r: c.r, i: j }); if (pid) row.push(String(pid)); }
        return { coord: c, me: String(__C.model.me.myId() || ''), n: m.n, ids: m.ids, live: !!(v && v.videoWidth > 0), w: v ? v.videoWidth : 0, h: v ? v.videoHeight : 0, row, stagers: (0, /*()*/__C.stageIds)().map(String), hold: (typeof __M.avHold !== 'undefined' && __M.avHold) ? __M.avHold.ms : 0 };
      },
      fsSourcesForTest: () => fsSources().map((s) => ({ key: s.key, bl: s.bl || 0 })),
      setTabHiddenForTest: (hidden) => {
        try { Object.defineProperty(document, 'hidden', { configurable: true, get: () => !!hidden }); } catch (e) {}
        document.dispatchEvent(new Event('visibilitychange'));
        const el = document.getElementById('still');
        return { ok: true, away: !!__C.model.me.myStatus().away, still: !!(el && el.classList.contains('on')) };
      },
      timingForTest: (t) => { const b = timingRow.querySelector('[data-timing="' + t + '"]'); if (b) b.click(); },
      appName: () => document.getElementById('appname').textContent,
      // The Stage (Channel St) — inspect + drive it from the meeting CLI.
      stageInfo: () => ({
        stagers: (0, /*()*/__C.stageIds)().map((id) => ({ id: String(id).slice(0, 12), name: id === __C.model.me.myId() ? (0, /*()*/__C.myName)() : (__C.model.roster.rosterNames()[id] || null), me: id === __C.model.me.myId() })),
        myStg: __C.model.me.myStatus().stg || 0, canStage: (0, /*()*/__C.canStage)(__C.model.me.myId()), cap: __C.model.consts.SCALE().C,
        held: [...__C.mosIn.keys()].filter((k) => k.indexOf('stg:') === 0),
        strip: (typeof __M.stripPack !== 'undefined' && __M.stripPack) ? __M.stripPack.stats() : null,
        stripPainted: !!document.querySelector('[data-row="sgs"] video'),
      }),
      // SCREEN SHARE (docs/media-plane.md Channel St). Read the state a
      // receiver can actually act on: who the room believes is sharing, and —
      // for the sharer — what is really on the outbound sender right now. The
      // track's `label`/`displaySurface` is the only place the browser admits
      // a track came from getDisplayMedia rather than a camera, which is what
      // makes "the screen really is what is being published" provable at all.
      screenInfo: () => {
        const vt = (typeof __M.sentVideoTrack === 'function') ? (0, /*()*/__M.sentVideoTrack)() : null;
        let surface = null; try { surface = vt && vt.getSettings ? (vt.getSettings().displaySurface || null) : null; } catch (e) {}
        const mainTracks = [];
        for (const p of __C.model.roster.peers().values()) if (p.mainV && p.mainV.track) mainTracks.push(p.mainV.track.id);
        return {
          sharing: !!__C.model.me.myStatus().scr, sharers: (0, /*()*/__C.screenSharers)(),
          capable: (0, /*()*/__M.canScreenShare)(),
          steppedUp: __C.model.me.screenSteppedUp(),
          onStage: (0, /*()*/__C.stageIds)().includes(__C.model.me.myId()),
          sentTrackId: vt ? vt.id : null,
          sentLabel: vt ? String(vt.label || '') : null,
          surface,
          mainTrackIds: mainTracks,
          // THE RESOLUTION SURFACE. A share that arrives unreadable fails none
          // of the checks above — it is on the stage, it is a display capture,
          // it is letterboxed — so the numbers that decide legibility are
          // published here rather than inferred from pixels (a composited
          // canvas cannot tell a downscale from a blurry desktop).
          sentHint: vt ? String(vt.contentHint || '') : '',
          // What the Stage element is ACTUALLY painting. The strip's canvas is
          // square (one screen tile ⇒ cell x cell); the direct feed keeps the
          // shared display's own shape. So the aspect alone says which one the
          // viewer is looking at, and the width says at what cost.
          stagePaint: (() => {
            const v = stagefeedEl && stagefeedEl.querySelector('[data-row="sgs"] video');
            return v ? { w: v.videoWidth, h: v.videoHeight } : null;
          })(),
          // Every outbound video sender's lane, as adapt() last left it.
          senders: (() => {
            const out = [];
            for (const p of __C.model.roster.peers().values()) for (const sd of p.pc.getSenders()) {
              if (!sd.track || sd.track.kind !== 'video') continue;
              let prm = null; try { prm = sd.getParameters(); } catch (e) {}
              const e0 = prm && prm.encodings && prm.encodings[0];
              out.push({
                stage: __C.model.net.stageSenders().has(sd), aux: __C.model.net.auxSenders().has(sd),
                kbps: e0 && e0.maxBitrate ? Math.round(e0.maxBitrate / 1000) : 0,
                deg: __M.degOf.get(sd) || (prm && prm.degradationPreference) || '',
              });
            }
            return out;
          })(),
          shareBtnShown: !!(shareBtn && shareBtn.offsetParent !== null),
          bodyScreenOn: document.body.classList.contains('screen-on'),
        };
      },
      stageFacesForTest: () => {
        const host = stagefeedEl && stagefeedEl.querySelector('[data-row="sgs"]');
        const out = { view: __M.stageViewNow, stagers: (0, /*()*/__C.stageIds)().slice(), screenSid: null, faces: [] };
        for (const id of out.stagers) if ((0, /*()*/__C.sharingScreen)(id)) { out.screenSid = out.screenSid ? 'many' : id; }
        // Same 24x24 mean the overlay uses. A pack tile is the raw track, so it is not cropped.
        const lumaOf = (v, cell) => {
          try {
            if (!v.videoWidth) return null;
            const cv = document.createElement('canvas'); cv.width = 24; cv.height = 24;
            const x = cv.getContext('2d');
            const k = v.videoWidth / (parseFloat(v.style.width) || __M.STAGE_FACE_PX);
            const sx = cell ? -(parseFloat(v.style.left) || 0) * k : 0, sy = cell ? -(parseFloat(v.style.top) || 0) * k : 0;
            const sw = cell ? __M.STAGE_FACE_PX * k : v.videoWidth, sh = cell ? __M.STAGE_FACE_PX * k : v.videoHeight;
            x.drawImage(v, sx, sy, sw, sh, 0, 0, 24, 24);
            const d = x.getImageData(0, 0, 24, 24).data; let sum = 0;
            for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
            return +(sum / (d.length / 4) / 765).toFixed(4);
          } catch (e) { return null; }
        };
        const pushFace = (id, v, cell, named, name, pack) => {
          const face = { id, cell: !!cell, live: v.videoWidth > 0, w: v.videoWidth, h: v.videoHeight,
            named: !!named, name: name || '',
            bl: v.classList.contains('blur2') ? 2 : v.classList.contains('blur1') ? 1 : 0, luma: lumaOf(v, !!cell) };
          if (pack) face.pack = true;
          out.faces.push(face);
        };
        const box = host && host.querySelector('.stagefaces');
        if (box) {
          for (const w of box.children) {
            const v = w.querySelector('video');
            if (!v) continue;
            // named=true: the box shows the name on dark, no picture (camera
            // off, admin video-off, or a crop the current frame does not fit).
            const nm = w.querySelector('.stagefacename');
            pushFace(w.dataset.face, v, v.dataset.cell, nm && nm.style.display !== 'none', nm ? nm.textContent : '', false);
          }
        }
        // The per-person pack draws each co-presenter as its own tile and
        // removes the overlay, so the face is not painted twice. It is still
        // on screen: read that tile.
        if (host && host.dataset.pack === '1') {
          const seen = new Set(out.faces.map((f) => f.id));
          const feed = document.getElementById('feed');
          if (feed) for (const el of feed.querySelectorAll('[data-stageview]')) {
            const id = el.dataset.stageview;
            if (!id || seen.has(id)) continue;
            const v = el.querySelector('video');
            if (!v) continue;
            seen.add(id);
            pushFace(id, v, false, false, '', true);
          }
        }
        return out;
      },
      // The sheet's copy, as rendered — the app-pin preference is a PROMISE the
      // product makes in words, so the guard reads the words.
      shareSheetForTest: () => {
        openShareSheet();
        const m = document.getElementById('share-modal');
        const n = document.getElementById('share-appnote');
        const r = document.getElementById('share-runapp');
        // Not `style.display !== "none"`: that is TRUE for a sheet that was
        // never shown at all, so a broken openShareSheet would still "pass".
        // And not offsetParent either — it is null for ANY position:fixed
        // element, which the sheet is, so that reads every open sheet as
        // closed. The honest test is a real box on screen plus a computed
        // display: both are false only when the thing genuinely is not there.
        const shown = (el) => {
          const r2 = el.getBoundingClientRect();
          return r2.width > 0 && r2.height > 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
        };
        const denied = document.getElementById('share-denied');
        const go = document.getElementById('share-go');
        return { open: shown(m), note: n.textContent || '',
          runAppShown: shown(r), runAppLabel: r.textContent || '',
          denied: shown(denied), goShown: shown(go) };
      },
      closeShareSheetForTest: () => { document.getElementById('share-modal').style.display = 'none'; return true; },
      // PRIVACY PROBE (test-only): what this page actually receives as VIDEO from one stager's stage feed, read off the track itself
      // (not the roster, not a status): { feed, track, state, w, luma }. luma is the mean brightness (0..1) of up to 4 decoded frames,
      // the max seen; null when the track is live but no frame decoded in the window. A camera-off stager must read dark (<= 0.05) or no track.
      stageVideoProbeForTest: async (idPrefix) => {
        const pre = String(idPrefix || '').slice(0, 8); let f = null;
        for (const [k, v] of __C.mosIn) { if (k.indexOf('stg:' + pre) === 0 && k !== 'stg:' + __C.model.me.myId() && v.stream) { f = v; break; } }
        if (!f) return { feed: false, track: false };
        const vt = f.stream.getVideoTracks()[0];
        if (!vt) return { feed: true, track: false };
        const out = { feed: true, track: true, state: vt.readyState, enabled: vt.enabled, w: 0, luma: null };
        if (vt.readyState !== 'live') return out;
        const el = document.createElement('video'); el.muted = true; el.playsInline = true; el.srcObject = new MediaStream([vt]);
        try { await el.play(); } catch (e) {}
        const cv = document.createElement('canvas'); cv.width = 24; cv.height = 24; const x = cv.getContext('2d');
        for (let i = 0; i < 12 && (out.luma === null || i < 6); i++) {
          await new Promise((r) => setTimeout(r, 250));
          if (!el.videoWidth) continue;
          out.w = el.videoWidth;
          try { x.drawImage(el, 0, 0, 24, 24); const d = x.getImageData(0, 0, 24, 24).data; let sum = 0; for (let j = 0; j < d.length; j += 4) sum += d[j] + d[j + 1] + d[j + 2];
            out.luma = Math.max(out.luma || 0, +(sum / (d.length / 4) / 765).toFixed(4)); } catch (e) {}
        }
        try { el.srcObject = null; } catch (e) {}
        return out;
      },
      mosaic: () => { const c = (0, /*()*/__C.meshCoord)(); const T = __C.model.net.net().topo; const tgt = (co) => { if (!co) return null; const pid = (0, /*()*/__C.occPid)(co); const p = pid && __C.model.roster.peers().get(pid); return { pid: (pid||'').slice(0,6), has: !!p, conn: p && p.connected, dc: !!(p && p.dc && p.dc.readyState === 'open') }; };
        return { multi: multiSection(), coord: c, head: c && c.i === 0, s1: c && c.pc === 0,
        // WHO AM I, in the same 8-char form feedsInfo() reports `via` in. A
        // receiver can see which peer it is claiming FROM, but nothing let an
        // observer turn that back into a seat — so a stall could never be
        // followed one hop upstream to ask what the sender was doing. Needed to
        // resolve pipeStats() across seats (the stg-freeze hunt,
        // docs/bug-pipe-stg-freeze-2026-08-05.md).
        me: String(__C.model.me.myId() || '').slice(0, 8),
        up: c ? tgt(T.up(c)) : null, down: c ? tgt(T.down(c)) : null,
        prodStream: !!(__M.prodPack && __M.prodPack.stream), sdStream: !!(__M.sdView && __M.sdView.stream), roomStream: !!(__M.roomPack && __M.roomPack.stream), loop: !!(__M.packLoop && __M.packLoop.rx),
        restarts: [...__C.mosIn.entries(), ...__C.mosStandby.entries()].filter(([, e]) => e && e.el).map(([rk, e]) => ({ key: rk, sid: e.el.srcObject ? String(e.el.srcObject.id).slice(0, 8) : null, vw: e.el.videoWidth, rs: e.el.readyState, n: e.el._mosRestarts || 0, held: !!e.el._mosHold })), // decoders restarted (parked, re-bound, resumed) because they showed no picture while the feed flowed (WebKit)
        jobs: [...__C.mosJobs.keys()], claims: [...__C.mosIn.keys()], ann: [...__C.mosAnn.keys()],
        claimMeta: [...__C.mosIn.entries()].map(([rk, e]) => rk.slice(-12) + ' n' + (e.meta ? e.meta.n : '-') + ' ids' + (e.meta && e.meta.ids ? e.meta.ids.map((x) => String(x).slice(2, 6)).join(',') : '-') + ' el' + (e.el ? (e.el.videoWidth || 0) : 'x') + ' a' + (e.stream ? e.stream.getAudioTracks().map((t) => t.readyState[0] + (t.muted ? 'M' : '')).join('') : '-')),   // what each claim says it holds: cells, named ids, picture width, sound tracks
        view: { hasView: !!__M.sdView, n: __M.sdView ? __M.sdView.count() : null, sound: (typeof __M.sdViewSt !== 'undefined' && __M.sdViewSt) ? __M.sdViewSt.getAudioTracks().length : null },   // my own Stadium view: its faces after hiding my row, and whether it holds a sound track
        // An announcer is only a CANDIDATE if its announced streamId resolves
        // to one of that peer's incoming streams (claimRedun's `live`). The
        // keys alone cannot show a MISMATCH — an announce whose stream never
        // arrives, or a stale id re-announced after a transport swap — which
        // is exactly the state that silently blocks failback, so surface the id.
        // Every re-ship of an ALREADY-ESTABLISHED job, with the reason — see
        // the note in shipMos. A receiver can only observe that the id changed;
        // this says why it changed, on the side that changed it.
        reship: (window.__mosReship || []).slice(-12),
        // Why my OWN outbound stg stream changed identity — the root event the
        // reship cascade above hangs off. See mySelfStream.
        selfMemo: (window.__selfMemoLog || []).slice(-8),
        regrab: (window.__regrabLog || []).slice(-8),
        annSid: [...__C.mosAnn.entries()].map(([k, v]) => k.slice(0, 14) + '|' + k.slice(k.indexOf('|') + 1) + '=' + String(v && v.streamId).slice(0, 8)
          // mt = the mirror's TRANSIT ROW. A carrier recomputes the route from
          // it, and slotFor/the forwarder both bail SILENTLY when it is absent
          // (`if (t == null) return null`), so an announce that lost mt looks
          // exactly like one that was never sent. Surface it.
          + (v && v.mt != null ? ' mt=' + v.mt : ' mt=MISSING')),
        // multi-subscribe forensics: hot standby slots, outbound jobs' active/dormant
        // state, and the last want/idle demand I sent per announcer.
        standby: [...__C.mosStandby.keys()],
        jobsActive: [...__C.mosJobs.entries()].map(([k, j]) => k + (j.active ? '+' : '·')),
        // per-job IDENTITY: sig = the SOURCE stream this job ships, streamId =
        // the container minted for it. A changing sig means the producer
        // handed us a new stream; a changing container with a STABLE sig means
        // the job was reaped and re-created. (2026-07-29 stage re-ship churn.)
        jobSig: [...__C.mosJobs.entries()].map(([k, j]) => k.slice(0, 18) + '|s' + String(j.sig).slice(0, 6) + '|c' + String(j.streamId).slice(0, 6)),
        demand: [...__C.model.net.subWant().entries()].map(([k, v]) => k + '=' + v.st),
        // per-slot primary/standby VIA (peer id) — lets a probe kill the exact
        // feeding peer and watch the hot standby promote with no black-out.
        claimVia: [...__C.mosIn.entries()].map(([rk, c]) => ({ rk, via: c.via, sid: c.streamId })),
        // WHY AN ANNOUNCER IS NOT A CANDIDATE. claimRedun only claims from an
        // announcer whose announced streamId resolves to one of that peer's
        // INCOMING streams (`live`), and when nothing resolves it claims
        // NOTHING — the seat holds announcers, has no feed, and every seat
        // below it starves with no announcer of its own to explain why.
        // Measured 2026-08-10 (e2e-mosaic): a mid-tree seat sat on TWO stg
        // announcers with an empty claim list, and nothing anywhere could say
        // which half of the resolution failed. This recomputes it and reports
        // the comparison itself: what was announced, against the stream ids
        // that peer actually has.
        cands: [...__C.mosAnn.entries()].map(([k, v]) => {
          const bar = k.indexOf('|'), from = k.slice(0, bar), key = k.slice(bar + 1);
          const p = __C.model.roster.peers().get(from);
          const inc = (p && p.incoming) ? p.incoming.map((s) => String(s.id).slice(0, 8)) : null;
          const want = String(v && v.streamId).slice(0, 8);
          return { key, from: from.slice(0, 8), want,
            peer: !!p, conn: !!(p && p.connected), own: String(p && p.ownSid).slice(0, 8),
            incoming: inc, h: v ? v.h : undefined, sb: v ? v.sb : undefined, vp: v ? v.vp : undefined, at: v ? v.at : undefined,
            live: !!(p && p.incoming && p.incoming.find((s) => s.id === (v && v.streamId) && s.id !== p.ownSid)) };
        }),
        standbyVia: [...__C.mosStandby.entries()].map(([rk, c]) => ({ rk, via: c.via, sid: c.streamId })),
        // wake/failback forensics: per-slot wake-in-progress + settle stamps
        fb: [...__M.mosFb.entries()].map(([rk, f]) => ({ rk, wakeAt: f.wakeAt, prefSince: f.prefSince, lastSwitch: f.lastSwitch, dark: !!f.dark, lastAdvanceAt: f.lastAdvanceAt || 0, lastBytes: f.lastBytes != null ? f.lastBytes : -1, d0: f.d0 != null ? f.d0 : -1, stdFdec: f.stdFdec != null ? f.stdFdec : -1, flowSince: f.flowSince || 0, q: f.q || 0, fp: f.fp || 0 })),
        prod: __M.prodPack && __M.prodPack.stats(), sd: __M.sdView && __M.sdView.stats(), room: __M.roomPack && __M.roomPack.stats(),
        rowFaces: __M.dbgRowFaces.slice(), // which pid the packer drew at each of my row's seats (test observability, 2026-07-29 stale-seat dup)
        // w/h: the hidden source <video>'s own size; pack: the local composite's canvas; src: what the face cut used (chaos-1019: the two disagreed, 330 against 440)
        tile: (() => { const v = stadiumEl.querySelector('[data-row="sd"] video'); const cl = window.__comfyLast; return v ? { live: v.videoWidth > 0, w: v.videoWidth, h: v.videoHeight, pack: (__M.sdView && __M.sdView.canvas) ? [__M.sdView.canvas.width, __M.sdView.canvas.height] : null, src: cl && cl.src ? cl.src : null } : null; })(),
        strip: (() => { const v = stagefeedEl.querySelector('[data-row="sgs"] video'); return v ? { live: v.videoWidth > 0 } : null; })(), stagers: (0, /*()*/__C.stageIds)().length }; },
      stadiumShown: () => stadiumEl.classList.contains('on'),
      stadiumVideoLive: (row) => { const el = stadiumEl.querySelector('[data-row="' + row + '"] video'); return !!(el && el.srcObject && el.videoWidth > 0); },
      // PiP forensics: what the overlay would float right now, and whether one is up.
      pip: () => ({
        target: (() => { try { const R = pipPick(); return R ? { kind: R.t.kind, pid: R.t.pid || null, key: R.key, label: R.label } : null; } catch (e) { return { err: String(e).slice(0, 80) }; } })(),
        aimed: (() => { const v = pipSource(); if (!v) return null; const t = v.closest('[data-peer]'); if (t) return 'peer:' + t.dataset.peer; const r = v.closest('.rowtile'); return r ? 'row:' + r.dataset.row : 'other'; })(),
        active: pipFloating(),
        byBrowser: pipByBrowser,
        trace: pipTrace.slice(-40),
        doc: docPip ? { name: docPip.name.textContent, live: !!docPip.video.srcObject, frames: (() => { try { return docPip.video.getVideoPlaybackQuality().totalVideoFrames; } catch (e) { return -1; } })(), mic: docPip.mic.textContent } : null,
        // capability forensics: which PiP doors exist on THIS browser
        caps: {
          api: !!document.pictureInPictureEnabled,
          req: typeof HTMLVideoElement.prototype.requestPictureInPicture === 'function',
          webkit: typeof document.createElement('video').webkitSetPresentationMode === 'function',
          autoAttr: 'autoPictureInPicture' in HTMLVideoElement.prototype,
          doc: !!window.documentPictureInPicture,
        },
        btnShown: (() => { const b = document.getElementById('pipbtn'); return !!b && b.style.display !== 'none'; })(),
      }),
      // a joined peer by name whose fresh status has a hand up, as the host's queue line reads it
      handPeerForTest: (id, name) => { id = String(id); if (!__C.model.roster.peers().has(id)) __C.model.roster.peers().set(id, { id, connected: false, dc: { readyState: 'open', label: 'test' }, testTx: [], neg: (0, /*()*/__C.newNeg)() }); __C.model.roster.peers().get(id).name = name; __C.model.roster.rosterNames()[id] = name; if (!__C.model.roster.rosterIds().includes(id)) __C.model.roster.rosterIds().push(id); const t = Date.now(); __C.model.roster.statusOf().set(id, { camOff: true, muted: true, hand: t, at: t, rx: t }); renderHandq(); return handqEl.textContent; },
      chatGateForTest: (off, admin) => { chatGateOverride = { off: !!off, admin: !!admin }; paintChatGate(); return document.getElementById('chat-in').placeholder; },
      fsMain: () => ({ key: fsmain.dataset.key || null, bl: fsmain.classList.contains('blur2') ? 2 : fsmain.classList.contains('blur1') ? 1 : 0, fit: getComputedStyle(fsmain).objectFit }),
      fsThumbBlur: (key) => { const th = Array.from(fsstrip.children).find((t) => t.dataset.key === key); const tv = th && th.querySelector('video'); if (!tv) return null; return tv.classList.contains('blur2') ? 2 : tv.classList.contains('blur1') ? 1 : 0; },
      // The blob Rebroadcast plays: the file saved when the host left the air.
      lastServiceForTest: async () => {
        if (!__C.model.room.bcLastService() || !__C.model.room.bcLastService().blob) return null;
        const b = await __C.model.room.bcLastService().blob;
        const url = URL.createObjectURL(b);
        const sec = await new Promise((res) => {
          const v = document.createElement('video');
          let done = false;
          const finish = (n) => { if (done) return; done = true; try { v.removeAttribute('src'); v.load(); } catch (e) {} res(n); };
          v.preload = 'metadata';
          v.onloadedmetadata = () => {
            if (isFinite(v.duration) && v.duration > 0 && v.duration < 1e6) finish(v.duration);
            else { try { v.currentTime = 1e10; } catch (e) {} }
          };
          v.ontimeupdate = () => { if (isFinite(v.duration) && v.duration > 0 && v.duration < 1e6) finish(v.duration); };
          v.onerror = () => finish(0);
          setTimeout(() => finish(isFinite(v.duration) && v.duration < 1e6 ? v.duration : 0), 4000);
          v.src = url;
        });
        try { URL.revokeObjectURL(url); } catch (e) {}
        return { bytes: b.size, sec: sec };
      },
      // THE STATUS PLANE, as this seat sees it.
      statusPlane: () => { const d = (0, /*()*/__C.roomDig)(); return { id: __C.model.me.myId(), mode: (0, /*()*/__C.digestMode)(), past: (0, /*()*/__C.roomPastSection)(), n: d ? d.n : null, age: d ? d.age : null,
        refuse: d ? d.refuse : null, part: d ? !!d.part : null, handN: d ? d.handN : null, hands: d ? d.hands.map((e) => e.id) : [], stage: d ? d.stage.map((e) => e.id) : [],
        apps: d ? d.apps.map((e) => e.id) : [], votes: d ? d.votes.length : 0, display: (0, /*()*/__C.displayCount)(), consentIds: (0, /*()*/__C.roomConsentIds)().length,
        fresh: Array.from(__C.model.roster.statusOf().keys()).filter((id) => id !== __C.model.me.myId() && (0, /*()*/__C.freshSt)(id)), coord: (0, /*()*/__C.meshCoord)(), label: statusEl.textContent,
        statusN: __C.model.roster.statusOf().size, dcLinks: Array.from(__C.model.roster.peers().values()).filter((p) => p.dc && p.dc.readyState === 'open').length }; },
      handqShown: () => handqEl.classList.contains('on'),
      handqText: () => handqEl.textContent,
      armBroadcastHostForTest: () => {
        v.fixtureForTest({ amAdmin: true });
        document.body.classList.remove('notadmin');
        if (__C.model.me.myId() && __C.model.door.admins().indexOf(__C.model.me.myId()) < 0) __C.model.door.admins().push(__C.model.me.myId());
        __C.model.me.myStatus().camOff = true;
        try { (0, /*()*/__C.setStage)(true); } catch (e) { __C.model.me.myStatus().stg = Date.now(); }
        (0, /*()*/__C.paintOnAir)();
        return { ok: !!__C.model.me.myStatus().stg };
      },
      statusText: () => statusEl.textContent,
      appStopForTest: (mine) => {
        if (mine) { v.fixtureForTest({ appKey: 'qa-stop' }); __C.model.me.myStatus().app = { s: 'qa-stop', name: 'Notes' }; }
        else { v.fixtureForTest({ appKey: null }); __C.model.me.myStatus().app = null; }
        showAppPane('Notes', '');
        updateAppButtons(__C.model.me.myStatus().app);
        const b = document.getElementById('appstop');
        return { text: b.textContent, title: b.title, font: parseFloat(getComputedStyle(b).fontSize), display: getComputedStyle(b).display };
      },
      appBarForTest: (talkOn) => {
        __C.act.surface({ appPaneOn: true });
        document.body.classList.add('has-app');
        if (talkOn) {
          (0, /*()*/__C.armAppRoomTick)();
          __C.act.surface({ appRoomOn: true });
          document.body.classList.add('app-room');
          v.fixtureForTest({ appMode: 'host' });
          __C.model.me.myStatus().app = Object.assign(__C.model.me.myStatus().app || { s: 'qa-talk' }, { audio: true });
        } else if (__C.model.me.myStatus().app) {
          __C.model.me.myStatus().app.audio = false;
        }
        paintTalkBtn();
        ['appsave', 'appsteal', 'apphide', 'appaudio'].forEach((id) => { document.getElementById(id).style.display = ''; });
        const read = (id) => {
          const b = document.getElementById(id);
          return { text: b.textContent, title: b.title, font: parseFloat(getComputedStyle(b).fontSize) };
        };
        return { save: read('appsave'), steal: read('appsteal'), hide: read('apphide'), talk: read('appaudio') };
      },
      // The sharer's own app bar: Invite, the lead switch (tapped once when
      // tap is set), and Full screen, as the sharer reads them.
      appWordsForTest: (tap) => {
        document.body.classList.add('has-app');
        v.fixtureForTest({ appKey: 'qa-words' }); __C.model.me.myStatus().app = { s: 'qa-words' };
        showAppPane('Notes', '');
        v.fixtureForTest({ appLeadable: true, appLeadOn: false, appLeadSet: () => {} });
        updateAppButtons(__C.model.me.myStatus().app);
        // Invite follows the room (paintInviteSlot). A meeting must not force it on.
        if (tap) document.getElementById('applead').click();
        const read = (id) => {
          const b = document.getElementById(id);
          return { text: b.textContent.trim(), title: b.title, label: b.getAttribute('aria-label') || '', font: parseFloat(getComputedStyle(b).fontSize), display: getComputedStyle(b).display };
        };
        return { invite: read('appinvite'), lead: read('applead'), full: read('appfull'), status: document.getElementById('status').textContent };
      },
      stealChoicesForTest: () => {
        if (!__C.appClientCtl) v.fixtureForTest({ appClientCtl: { stealToDesktop: () => new Promise(() => {}) } });
        const b = document.getElementById('appsteal');
        b.style.display = '';
        if (b.dataset.armed) delete b.dataset.armed;
        document.querySelectorAll('#appbar [data-steal]').forEach((el) => el.remove());
        b.click();
        return [...document.querySelectorAll('#appbar [data-steal]')].map((el) => ({ text: el.textContent, title: el.title, data: el.dataset.steal }));
      },
      chatModForTest: (off) => {
        v.fixtureForTest({ amAdmin: true });
        if (off) __C.model.door.modTable()['*'] = { chat: { on: true, by: 'Pastor Kim' } };
        else delete __C.model.door.modTable()['*'];
        applyAdminUi();
        try { renderChat(); } catch (e) {}
        document.getElementById('chatpanel').classList.add('open');
        const b = document.getElementById('chatmod');
        const row = document.querySelector('#chatlog .cmsg');
        return {
          text: b.textContent, title: b.title,
          font: parseFloat(getComputedStyle(b).fontSize),
          display: getComputedStyle(b).display,
          line: row ? row.textContent : '',
        };
      },
      // PAINT ONLY: the dock's words and icon for a mic state. It never turns
      // the mic track on or off, so it is no way to unmute a seat in a test
      // (tap #mic, and pick a row when the chooser opens). With a live mic
      // track that says otherwise it refuses, so no test reads a painted
      // "on" over a mic that sends nothing (0.9.26.19 phone runs).
      setOwnMicForTest: (live) => {
        const tr = __C.model.me.localStream() && __C.model.me.localStream().getAudioTracks()[0];
        if (tr && tr.readyState === 'live' && tr.enabled !== !!live) return { refused: 'the live mic track is ' + (tr.enabled ? 'on' : 'off') + ': setOwnMicForTest only paints; tap #mic to change it', muted: !!__C.model.me.myStatus().muted, trackEnabled: tr.enabled };
        __C.model.me.myStatus().muted = !live;
        paintControls();
        const word = micBtn.querySelector('.dockword');
        return {
          muted: !!__C.model.me.myStatus().muted,
          word: word ? word.textContent : '',
          label: micBtn.getAttribute('aria-label'),
          svg: !!micBtn.querySelector('svg'),
          headerUnmute: !!document.getElementById('unmute'),
          headerCam: !!document.getElementById('showcam'),
        };
      },
      comfyForTest: () => {
        const feed = document.getElementById('feed');
        const nodes = [];
        const take = (el) => {
          if (!el || el.classList.contains('stad-src')) return;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return;
          nodes.push({
            id: el.dataset.peer || el.dataset.stad || el.id || '',
            tier: el.dataset.tier || '',
            x: r.x, y: r.y, w: r.width, h: r.height,
          });
        };
        document.querySelectorAll('#feed .tile').forEach(take);
        document.querySelectorAll('#stadwhole').forEach(take);
        const bar = document.querySelector('.bar');
        const br = bar ? bar.getBoundingClientRect() : null;
        let box = null;
        try {
          const landscape = window.innerWidth > window.innerHeight;
          box = GifOS.meetLayout.viewBox(window.innerWidth, window.innerHeight, { phone: !landscape && window.innerWidth < 700, pill: document.body.classList.contains('has-pill') });
        } catch (e) {}
        return {
          on: document.body.classList.contains('comfy'),
          mode: window.__meetViewMode || 'gallery',
          last: window.__comfyLast || null,
          box: box,
          nodes: nodes,
          scroll: feed ? feed.scrollHeight - feed.clientHeight : null,
          overflow: feed ? getComputedStyle(feed).overflow : null,
          bar: br ? { x: br.x, y: br.y, w: br.width, h: br.height, free: bar.dataset.barfree || '', barx: bar.dataset.barx || '', bary: bar.dataset.bary || '' } : null,
        };
      },
      countdownShown: () => { const el = document.getElementById('admcount'); return !!el && el.style.display !== 'none'; },
      // A camera-off seat with no transport, so the gate can watch per-tile
      // blur and blur-all land on the avatar's video. The tile is the real
      // one (makeTile + updateTile); nothing here is a second painter.
      avatarSeatForTest: (opts) => {
        opts = opts || {};
        const id = String(opts.id || 'avatar_seat');
        const name = String(opts.name || 'Ada').slice(0, 40);
        let p = __C.model.roster.peers().get(id);
        if (!p) {
          const tile = makeTile(id, name, false);
          p = { id, pc: null, neg: (0, /*()*/__C.newNeg)(), tile: tile.tile, video: tile.video, label: tile.label, avatar: tile.avatar, chips: tile.chips, cap: tile.cap, modbar: tile.modbar, voteBtn: tile.voteBtn,
            name, headless: false, connected: true, pendingIce: [], absentSince: 0, lastKick: 0, lastHeard: Date.now(), bornAt: Date.now(), incoming: [], neverUp: false, stream: null };
          __C.model.roster.peers().set(id, p);
        }
        p.name = name;
        if (p.label) p.label.textContent = name;
        if (p.avatar) p.avatar.textContent = (0, /*()*/__C.nameInitial)(name);
        __C.model.roster.rosterNames()[id] = name;
        __C.model.roster.statusOf().set(id, { muted: true, camOff: opts.camOff !== false, blur: opts.blur == null ? 0 : (opts.blur | 0), at: Date.now(), rx: Date.now(), scr: 0 });
        if (opts.useWire) {
          const canvas = document.createElement('canvas');
          paintAvatarCanvas(canvas, name, 0);
          const stream = canvas.captureStream(0);
          const track = stream.getVideoTracks()[0];
          if (track && track.requestFrame) { try { track.requestFrame(); } catch (e) {} }
          p.stream = stream;
          p._wireHold = { canvas, stream, track };
        }
        if (opts.perTileBlur) (0, /*()*/__C.setMod)(id, 'blur', true);
        if (opts.blurAll) (0, /*()*/__C.setMod)('*', 'blur', true);
        (0, /*()*/__C.updateTile)(id);
        const mod = (0, /*()*/__C.modOf)(id);
        return { id, blur: (0, /*()*/__C.blurLevelFor)(id), blocked: !!(mod.blur && mod.blur.on) };
      },
      // read-only blur-pipe forensics (e2e-pipe-freeze): how often the canvas
      // that IS the outbound camera was painted, by which driver, at what cost
      blurPipeForTest: () => (__M.blurPipe ? { painted: __M.blurPipe.painted || 0, rvfcN: __M.blurPipe.rvfcN || 0, metroN: __M.blurPipe.metroN || 0,
        cost: Math.round(__M.blurPipe.cost || 0), sinceMs: __M.blurPipe.lastPaintAt ? Date.now() - __M.blurPipe.lastPaintAt : null,
        w: __M.blurPipe.canvas.width, h: __M.blurPipe.canvas.height, srcW: __M.blurPipe.src.videoWidth, srcState: __M.blurPipe.srcTrack && __M.blurPipe.srcTrack.readyState,
        srcMuted: !!(__M.blurPipe.srcTrack && __M.blurPipe.srcTrack.muted), hidden: document.hidden } : null),
      // ---- A/V feed monitor hooks (READ-ONLY — test/meet.js `mon`) ----------
      // monInfo(): one synchronous snapshot of everything the flap monitor
      // diffs: the Stadium/Stage tiles' paint state (present/src/dims/frame
      // counter), every claimed mosaic slot's element health, the standby set,
      // outbound job active/dormant states, the demand map, packer stats and
      // the stage ear's input set. No side effects.
      monInfo: () => {
        const vidInfo = (v) => v ? { sid: v.srcObject ? String(v.srcObject.id) : null,
          w: v.videoWidth, h: v.videoHeight, paused: v.paused, ready: v.readyState,
          frames: v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality().totalVideoFrames : -1 } : null;
        const c = (0, /*()*/__C.meshCoord)();
        return {
          t: Date.now(), coord: c ? (c.pc + '/' + c.r + '.' + c.i) : null, head: !!(c && c.i === 0), s1: !!(c && c.pc === 0),
          tiles: { sd: vidInfo(stadiumEl.querySelector('[data-row="sd"] video')), sgs: vidInfo(stagefeedEl.querySelector('[data-row="sgs"] video')) },
          claims: [...__C.mosIn.entries()].map(([rk, f]) => ({ rk, via: String(f.via).slice(0, 8), sid: String(f.streamId).slice(0, 8),
            vw: f.el ? f.el.videoWidth : -1, vh: f.el ? f.el.videoHeight : -1,
            frames: (f.el && f.el.getVideoPlaybackQuality) ? f.el.getVideoPlaybackQuality().totalVideoFrames : -1,
            aTrk: f.stream ? f.stream.getAudioTracks().length : 0,
            vMuted: f.stream && f.stream.getVideoTracks()[0] ? f.stream.getVideoTracks()[0].muted : null })),
          standby: [...__C.mosStandby.entries()].map(([rk, f]) => ({ rk, via: String(f.via).slice(0, 8), sid: String(f.streamId).slice(0, 8) })),
          jobs: [...__C.mosJobs.entries()].map(([jk, j]) => ({ jk: j.key + '>' + String(j.to).slice(0, 8), active: !!j.active })),
          demand: [...__C.model.net.subWant().entries()].map(([k, v]) => { const a = k.split('|'); return { k: String(a[0]).slice(0, 8) + '|' + a[1], v: v.st }; }),
          ear: (typeof __M.stageEar !== 'undefined' && __M.stageEar) ? [...__M.stageEar.sids.keys()] : [],
          packs: { prod: __M.prodPack ? Object.assign({ w: __M.prodPack.canvas.width, h: __M.prodPack.canvas.height }, __M.prodPack.stats()) : null,
                   sd: __M.sdView ? Object.assign({ w: __M.sdView.canvas.width, h: __M.sdView.canvas.height }, __M.sdView.stats()) : null,
                   room: __M.roomPack ? __M.roomPack.stats() : null, folds: __M.downFolds.size, strip: __M.stripPack ? __M.stripPack.stats() : null },
          stagers: (0, /*()*/__C.stageIds)().length, peers: __C.model.roster.peers().size,
        };
      },
      });
    }
    yield 3267;
    // THE FLOAT WEARS THE TILE'S BLUR (PIPBLUR, 2026-11-24). Every float paints a <video>'s RAW frames: an element float
    // has no CSS, and the document float's <video> is a new element. In an open room every remote picture is blurred
    // here (receiver-side blur), so a sender forced to send clear floated clear. pipBlurLevel is the level this viewer
    // gives the floated source where it shows it: a face or a share at its grid tile's level, the Stage strip at the
    // Stage's level for the people on it, my own picture none (it is my pre-blurred outbound), the Stadium none (the
    // room shows that composite unblurred; a veiled one is never picked). Anything else counts as blurred.
    function pipBlurLevel(v) {
      if (!v) return 0;
      const mt = __C.model.me.meTile();
      if (mt && v === mt.video) return 0;
      const bl = (id, where) => { let b = (0, /*()*/__C.blurLevelFor)(id, false, false, where) | 0; if ((0, /*()*/__C.modBlurOn)(id)) b = Math.max(1, b); return b; };
      try {
        for (const [pid, p] of __C.model.roster.peers()) if (p.video === v) return bl(pid);
        if (stagefeedEl.contains(v)) {
          const me = __C.model.me.myId(), ids = (0, /*()*/__C.stageIds)().filter((id) => id !== me);
          if (!ids.length) return 2;   // the strip's pixels come from its carrier: with nobody else known on it, blurred
          let lv = 0;
          for (const id of ids) lv = Math.max(lv, bl(id, 'stage'));
          return lv;
        }
        if (stadiumEl.contains(v)) return 0;
      } catch (e) {}
      return 2;
    }
    // The blur level the float gives a target: a picture at the level this viewer gives it where it shows it
    // (pipBlurLevel); a screen at its sharer's Stage level (mine none); the shared app, a name card and a face cut
    // from my Stadium picture none (the Stadium shows unblurred; a veiled one is never picked).
    function pipLevel(R) {
      if (!R || R.app || R.card || R.cell) return 0;
      if (R.track && !R.v) {
        const t = R.t || {};
        if (t.mine) return 0;
        let b = (0, /*()*/__C.blurLevelFor)(t.pid, false, false, 'stage') | 0; if ((0, /*()*/__C.modBlurOn)(t.pid)) b = Math.max(1, b);
        return b;
      }
      return pipBlurLevel(R.v);
    }
    // pipFloatEl(R): the element a float shows for the target R (pipPick) - the LENS: a canvas that redraws the target
    // through blurDraw at the tile's own strength (--blur-view-min/max), captured into a hidden <video>; the document
    // float plays the lens's stream. One lens, every float, every target: a new target changes what the lens draws,
    // never which element floats, so the floating window stays up through a swap. It paints at PIP_LENS_FPS only while
    // the tab is hidden or the lens floats, from the track itself where the browser can read one
    // (MediaStreamTrackProcessor: a hidden page may pause the tile), else from the element; in view it keeps one fresh
    // frame per re-aim so a tap can float it at once. A browser with no canvas capture floats a clear picture itself.
    // null: nothing to float.
    function pipFloatEl(R) {
      const L = pipFloatEl.lens;
      const elUp = () => { const X = pipFloatEl.lens; return !!X && (document.pictureInPictureElement === X.video || X.video.webkitPresentationMode === 'picture-in-picture'); };
      if (!R) {
        if (!elUp()) return null;
        // Nothing may float now (the seat went dark, was turned off...): the floating lens goes black, never a stale source.
        L.R = null; L.src = null; pipLensPump(L, false);
        try { L.ctx.fillStyle = '#000'; L.ctx.fillRect(0, 0, L.canvas.width, L.canvas.height); if (typeof L.track.requestFrame === 'function') L.track.requestFrame(); } catch (e) {}
        return L.video;
      }
      const lv = pipLevel(R);
      const M = pipFloatEl.lens || pipLensMake();
      if (!M) return lv > 0 || !R.v || R.cell ? null : R.v;
      if (!M.R || M.R.key !== R.key || M.R.v !== R.v || M.R.track !== R.track) {
        M.src = R.v || (R.track ? pipLensAux(M, R.track) : null);
        pipLensPump(M, false);
      }
      M.R = R;
      M.level = lv;
      if (document.hidden || elUp() || (docPip && docPip.video.srcObject === M.stream)) pipLensRun(M, true);
      pipLensPaint(M);
      return M.video;
      // A picture with no element of its own (a screen track) plays in the lens's own hidden <video>, so a browser
      // that cannot read the track still has frames to draw.
      function pipLensAux(M2, track) {
        if (!M2.aux) {
          const v = document.createElement('video');
          v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
          v.style.cssText = 'position:fixed;right:0;bottom:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1';
          document.body.appendChild(v);
          M2.aux = v;
        }
        const cur = M2.aux.srcObject && M2.aux.srcObject.getVideoTracks()[0];
        if (cur !== track) { M2.aux.srcObject = new MediaStream([track]); const pr = M2.aux.play(); if (pr && pr.catch) pr.catch(() => {}); }
        return M2.aux;
      }
      function pipLensMake() {
        try {
          if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') return null;
          const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
          const ctx = canvas.getContext('2d');
          const stream = canvas.captureStream(0), track = stream && stream.getVideoTracks()[0];
          if (!ctx || !track) return null;
          const video = document.createElement('video');
          video.id = 'piplens';
          video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.setAttribute('aria-hidden', 'true');
          video.style.cssText = 'position:fixed;right:0;bottom:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1';
          video.srcObject = stream;
          // Floating starts the paint clock at once (a Float tap in a tab still in view would else wait for the next re-aim).
          const up = () => { const X = pipFloatEl.lens; if (X && X.video === video) pipLensRun(X, true); };
          video.addEventListener('enterpictureinpicture', up);
          video.addEventListener('webkitpresentationmodechanged', up);
          document.body.appendChild(video);
          const pr = video.play(); if (pr && pr.catch) pr.catch(() => {});
          return (pipFloatEl.lens = { canvas, ctx, stream, track, video, R: null, src: null, aux: null, level: 2, stop: null, rd: null, clone: null, frame: null, appAt: 0, cardSig: '' });
        } catch (e) { return null; }
      }
      function pipLensPump(M2, on) {
        if (M2.rd) { const r = M2.rd; M2.rd = null; try { r.cancel(); } catch (e) {} }
        if (M2.clone) { try { M2.clone.stop(); } catch (e) {} M2.clone = null; }
        if (M2.frame) { try { M2.frame.close(); } catch (e) {} M2.frame = null; }
        if (!on || typeof window.MediaStreamTrackProcessor !== 'function') return;
        let tr = null; try { tr = (M2.R && M2.R.track) || (M2.src && M2.src.srcObject && M2.src.srcObject.getVideoTracks()[0]); } catch (e) { tr = null; }
        M2.srcTrack = tr;
        if (!tr || tr.readyState !== 'live') return;
        let rd = null;
        try { M2.clone = tr.clone(); rd = new window.MediaStreamTrackProcessor({ track: M2.clone }).readable.getReader(); } catch (e) { if (M2.clone) { try { M2.clone.stop(); } catch (e2) {} M2.clone = null; } return; }
        M2.rd = rd;
        (async () => {
          for (;;) {
            let r; try { r = await rd.read(); } catch (e) { r = { done: true }; }
            if (r.done || M2.rd !== rd) {
              if (r.value) { try { r.value.close(); } catch (e) {} }
              if (M2.rd === rd) pipLensPump(M2, false);   // the track ended: the next tick reads the tile's current one
              return;
            }
            if (M2.frame) { try { M2.frame.close(); } catch (e) {} }
            M2.frame = r.value;   // only the newest frame is kept: a held frame pins a decoder buffer
          }
        })();
      }
      function pipLensRun(M2, on) {
        if (on && !M2.stop) {
          const tick = () => {
            // Hidden with no float yet: only for the grace in which a hide's own float can still open (the element
            // float waits PIP_AUTO_FALLBACK_MS, then a bounded ready wait); a float that opens later restarts the clock.
            if (!document.hidden) M2.hidAt = 0; else if (!M2.hidAt) M2.hidAt = Date.now();
            const grace = 2 * (GifOS.timings.PIP_AUTO_FALLBACK_MS + GifOS.timings.PIP_CARD_READY_MS);
            const want = elUp() || (docPip && docPip.video.srcObject === M2.stream) || (document.hidden && Date.now() - M2.hidAt < grace);
            if (!want) { pipLensRun(M2, false); return; }
            // a floating window asks again what it should show (a share, the Stage), not only on the heartbeat's re-aim
            const nowT = Date.now();
            if (nowT - (M2.pickAt || 0) >= GifOS.timings.PIP_REPICK_MS) { M2.pickAt = nowT; try { if (docPip) docPipAim(); else if (elUp()) pipFloatEl(pipPick()); } catch (e) {} }
            if (!M2.R) return;
            M2.level = pipLevel(M2.R);   // a level that rises while floating blurs on the next frame, not the next re-aim
            if (M2.src) {
              let cur = null; try { cur = M2.R.track || (M2.src.srcObject && M2.src.srcObject.getVideoTracks()[0]); } catch (e) { cur = null; }
              if (!M2.rd || cur !== M2.srcTrack) pipLensPump(M2, true);   // a tile that changed its track is read anew
            }
            try { pipLensPaint(M2); } catch (e) {}
          };
          const ms = Math.round(1000 / GifOS.timings.PIP_LENS_FPS);
          const clk = GifOS.meshMedia && GifOS.meshMedia.workerClock;
          if (typeof clk === 'function') { const h = clk(ms, tick); M2.stop = () => h.stop(); }
          else { const iv = setInterval(tick, ms); M2.stop = () => clearInterval(iv); }
          pipLensPump(M2, true);
        } else if (!on && M2.stop) { const s = M2.stop; M2.stop = null; s(); pipLensPump(M2, false); }
      }
      function pipLensPaint(M2) {
        const R = M2.R;
        if (!R) return;
        if (R.card) return pipLensCard(M2, R.card, null);
        if (R.app) return pipLensApp(M2, R);
        const f = M2.frame, src = f || M2.src;
        if (!src) return;
        const sw = f ? f.displayWidth : src.videoWidth, sh = f ? f.displayHeight : src.videoHeight;
        if (!(sw > 0 && sh > 0)) return;
        // A far talker: their face, cut from my Stadium picture where the composite placed it.
        let cut = null;
        if (R.cell) {
          try {
            const m = comfyStadMeta(), j = m.ids ? m.ids.indexOf(R.cell) : -1, MM = GifOS.meshMedia;
            if (j >= 0 && m.n > 0 && m.cols > 0 && MM && MM.faceSrcRect) cut = MM.faceSrcRect(j, m.n, m.cols, sw, sh);
          } catch (e) { cut = null; }
        }
        const cw = cut ? cut.sw : sw, ch = cut ? cut.sh : sh;
        if (!(cw > 0 && ch > 0)) return;
        const k = Math.min(1, 480 / Math.max(cw, ch));   // a float is small: 480 px on the long side is plenty
        const w = Math.max(2, Math.round(cw * k)), h = Math.max(2, Math.round(ch * k));
        if (M2.canvas.width !== w || M2.canvas.height !== h) { M2.canvas.width = w; M2.canvas.height = h; }
        if (cut) { M2.ctx.drawImage(src, cut.sx, cut.sy, cut.sw, cut.sh, 0, 0, w, h); M2.cardSig = ''; pipLensFrame(M2); return; }
        // The tile's own numbers: its CSS blur reads --blur-view-min/max on the root (the Max is the sender's Max in a
        // room with a clear right), so the float blurs exactly as hard as the tile it comes from.
        const rs = document.documentElement.style, T = GifOS.timings;
        const frac = M2.level >= 2 ? (parseFloat(rs.getPropertyValue('--blur-view-max')) || T.BLUR_VIEW_MAX_FRAC)
          : M2.level >= 1 ? (parseFloat(rs.getPropertyValue('--blur-view-min')) || T.BLUR_VIEW_MIN_FRAC) : 0;
        if (frac > 0) {
          // Drawn 15% over size, as the tile's CSS scales up its blur, so the blur's soft rim falls outside the float.
          const dw = w * 1.15, dh = h * 1.15;
          (0, /*()*/__M.blurDraw)(M2.ctx, src, (w - dw) / 2, (h - dh) / 2, dw, dh, frac * Math.max(w, h) / dw);
        } else M2.ctx.drawImage(src, 0, 0, w, h);
        M2.cardSig = '';
        pipLensFrame(M2);
      }
      function pipLensFrame(M2) { if (typeof M2.track.requestFrame === 'function') { try { M2.track.requestFrame(); } catch (e) {} } }
      // A seat with no picture (camera off) floats its name card: the letter its tile shows, and the name. Redrawn on
      // a change, and once a second so a float that opens later still gets a frame.
      function pipLensCard(M2, name, sub) {
        const sig = name + '|' + (sub || '') + '|' + Math.floor(Date.now() / 1000);
        if (M2.cardSig === sig) return;
        M2.cardSig = sig;
        const w = 480, h = 270, x = M2.ctx;
        if (M2.canvas.width !== w || M2.canvas.height !== h) { M2.canvas.width = w; M2.canvas.height = h; }
        x.filter = 'none';
        x.fillStyle = '#14141f'; x.fillRect(0, 0, w, h);
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillStyle = '#3a3a55'; x.font = '800 120px system-ui, sans-serif';
        x.fillText((0, /*()*/__C.nameInitial)(name) || '?', w / 2, h / 2 - 18);
        x.fillStyle = '#e8e8f0'; x.font = '600 26px system-ui, sans-serif';
        x.fillText(String(name || '').slice(0, 28), w / 2, h - 46);
        if (sub) { x.fillStyle = '#9a9ab0'; x.font = '500 18px system-ui, sans-serif'; x.fillText(String(sub).slice(0, 36), w / 2, h - 18); }
        pipLensFrame(M2);
      }
      // The shared app is no video: its frame is asked for one picture of the app's own drawing at PIP_APP_FPS
      // (runtime 'pipframe'), drawn here whole; an app that draws no canvas floats its name card.
      function pipLensApp(M2, R) {
        const now = Date.now(), every = Math.round(1000 / GifOS.timings.PIP_APP_FPS);
        if (now - M2.appAt >= every) { M2.appAt = now; pipAppAsk(); }
        const b = pipAppBmp.bmp;
        const stale = every * 8;   // eight asks unanswered: the app has stopped drawing
        if (!b || now - pipAppBmp.at > stale) return pipLensCard(M2, R.label, (0, /*()*/__C.uiText)('pipApp', 'App share'));
        if (M2.appDrawn === b) return;
        M2.appDrawn = b;
        const w = Math.max(2, b.width), h = Math.max(2, b.height);
        if (M2.canvas.width !== w || M2.canvas.height !== h) { M2.canvas.width = w; M2.canvas.height = h; }
        M2.ctx.filter = 'none';
        try { M2.ctx.drawImage(b, 0, 0, w, h); } catch (e) { return; }
        M2.cardSig = '';
        pipLensFrame(M2);
      }
    }
    // Settings > Floating window shows: the person's list for pipTarget, saved on this device. Each item has a
    // checkbox and Up/Down; Follow the speaker is the fixed last line.
    function paintPipOrder() {
      const ol = document.getElementById('piporder');
      if (!ol) return;
      const words = { app: (0, /*()*/__C.uiText)('pipApp', 'App share'), screen: (0, /*()*/__C.uiText)('pipScreen', 'Screen share'), stage: (0, /*()*/__C.uiText)('pipStage', 'Stage faces') };
      const up = (0, /*()*/__C.uiText)('pipUp', 'Move up'), down = (0, /*()*/__C.uiText)('pipDown', 'Move down');
      const list = GifOS.meetViewMode.loadPip(localStorage);
      ol.textContent = '';
      list.forEach((it, i) => {
        const li = document.createElement('li'); li.dataset.k = it.k;
        const lab = document.createElement('label');
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = it.on; cb.dataset.pipOn = it.k;
        const nm = document.createElement('span'); nm.textContent = words[it.k];
        lab.appendChild(cb); lab.appendChild(nm);
        li.appendChild(lab);
        for (const [dir, word, glyph] of [[-1, up, '\u2191'], [1, down, '\u2193']]) {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'seg pip-mv'; b.textContent = glyph;
          b.title = word; b.setAttribute('aria-label', word + ': ' + words[it.k]); b.dataset.pipMove = it.k + ':' + dir;
          b.disabled = (dir < 0 && i === 0) || (dir > 0 && i === list.length - 1);
          li.appendChild(b);
        }
        ol.appendChild(li);
      });
      const last = document.createElement('li'); last.className = 'pip-last';
      last.textContent = (0, /*()*/__C.uiText)('pipSpeaker', 'Then: follow the speaker (always)');
      ol.appendChild(last);
    }
    (() => {
      const after = document.getElementById('set-stage-video');
      if (!after || document.getElementById('set-pip')) return;
      const row = document.createElement('div'); row.className = 'set-sec set-row'; row.id = 'set-pip';
      const h = document.createElement('b'); h.textContent = (0, /*()*/__C.uiText)('setPip', 'Floating window shows');
      const ctl = document.createElement('div'); ctl.className = 'set-ctl';
      const ol = document.createElement('ol'); ol.id = 'piporder'; ol.className = 'piporder';
      const help = document.createElement('p'); help.className = 'set-help';
      help.textContent = (0, /*()*/__C.uiText)('setPipHelp', 'When you leave the meeting\u2019s tab, the floating window shows the first of these that is live. Follow the speaker is always last.');
      ctl.appendChild(ol); ctl.appendChild(help); row.appendChild(h); row.appendChild(ctl);
      after.insertAdjacentElement('afterend', row);
      ol.addEventListener('change', (e) => {
        const k = e.target && e.target.dataset && e.target.dataset.pipOn;
        if (!k) return;
        GifOS.meetViewMode.savePip(localStorage, GifOS.meetViewMode.loadPip(localStorage).map((x) => x.k === k ? { k, on: !!e.target.checked } : x));
        paintPipOrder(); pipReaim();
      });
      ol.addEventListener('click', (e) => {
        const b = e.target && e.target.closest && e.target.closest('[data-pip-move]');
        if (!b) return;
        const [k, d] = b.dataset.pipMove.split(':');
        const list = GifOS.meetViewMode.loadPip(localStorage), i = list.findIndex((x) => x.k === k), j = i + (+d);
        if (i < 0 || j < 0 || j >= list.length) return;
        const t = list[i]; list[i] = list[j]; list[j] = t;
        GifOS.meetViewMode.savePip(localStorage, list);
        paintPipOrder(); pipReaim();
        const again = ol.querySelector('[data-pip-move="' + k + ':' + d + '"]');
        if (again && !again.disabled) again.focus();
      });
      paintPipOrder();
    })();
    // The shared app's latest picture (an ImageBitmap from its own frame, runtime 'pipframe'). Only the mounted app's
    // frame is believed, and only a bitmap: a frame cannot hand the float anything else.
    const pipAppBmp = { bmp: null, at: 0 };
    function pipAppAsk() {
      const f = document.querySelector('#appmount iframe');
      if (f && f.contentWindow) { try { f.contentWindow.postMessage({ ns: 'gifos', type: 'pipframe' }, '*'); } catch (e) {} }
    }
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || d.ns !== 'gifos' || d.type !== 'pipframe') return;
      const f = document.querySelector('#appmount iframe');
      if (!f || e.source !== f.contentWindow) return;
      const old = pipAppBmp.bmp;
      if (d.bmp && typeof d.bmp.close === 'function' && d.bmp.width > 0 && d.bmp.height > 0) { pipAppBmp.bmp = d.bmp; pipAppBmp.at = Date.now(); }
      else if (d.none) { pipAppBmp.bmp = null; pipAppBmp.at = 0; }
      if (old && old !== pipAppBmp.bmp) { try { old.close(); } catch (e2) {} }
    });
  
    // THE FLOATING WINDOW'S TARGET (PIPPICK, 2026-11-24): the core picks it from the person's list (pipTarget: app
    // share, screen share, Stage faces in their order, then follow the speaker); this makes the pick drawable for the
    // lens. R = { t, key, v, track, cell, card, app, label }: v a <video> to draw, track a picture with no element of
    // its own (a screen), cell a far talker's face cut from my Stadium picture, card a name to draw for a seat with no
    // picture, app the shared app's own drawing. Moderation and the clear-without-password veils are the core's.
    function pipPick() {
      const sd = stadiumEl.querySelector('[data-row="sd"] video');
      let t = null;
      try { t = (0, /*()*/__C.pipTarget)({ stadium: pipReady(sd) }); } catch (e) { t = null; }
      if (!t) return null;
      const nm = (pid) => String((0, /*()*/__C.displayName)(pid) || '');
      if (t.kind === 'app') return { t, key: 'app', app: true, label: t.name || (0, /*()*/__C.uiText)('pipApp', 'App share') };
      if (t.kind === 'screen') return { t, key: 'scr:' + t.pid + ':' + t.track.id, track: t.track, label: t.name };
      if (t.kind === 'stage') {
        for (const v of stagefeedEl.querySelectorAll('.rowtile video')) if (pipReady(v) && !v.classList.contains('stageface')) return { t, key: 'stage', v, label: (0, /*()*/__C.uiText)('pipStage', 'Stage') };
        const id = t.ids[0], p = __C.model.roster.peers().get(id);
        if (p && pipReady(p.video) && !(0, /*()*/__C.seatDark)(__C.model.roster.statusOf().get(id))) return { t, key: 'peer:' + id, v: p.video, label: nm(id) };
        return { t, key: 'card:' + id, card: nm(id), label: nm(id) };
      }
      if (t.kind === 'speaker') {
        if (t.far) return pipReady(sd) ? { t, key: 'cell:' + t.pid, v: sd, cell: t.pid, label: nm(t.pid) } : { t, key: 'card:' + t.pid, card: nm(t.pid), label: nm(t.pid) };
        const p = __C.model.roster.peers().get(t.pid);
        if (!t.dark && p && pipReady(p.video)) return { t, key: 'peer:' + t.pid, v: p.video, label: nm(t.pid) };
        return { t, key: 'card:' + t.pid, card: nm(t.pid), label: nm(t.pid) };
      }
      if (t.kind === 'stadium') return pipReady(sd) ? { t, key: 'stadium', v: sd, label: (0, /*()*/__C.uiText)('setStadium', 'The stadium') } : null;
      const mt = __C.model.me.meTile();
      if (t.kind === 'me' && mt && pipReady(mt.video)) return { t, key: 'me', v: mt.video, label: (0, /*()*/__C.uiText)('you', 'You') };
      return null;
    }
    // The picture element of the target, where it has one (the parking of hidden mates and the test hooks read it).
    function pipSource() { const R = pipPick(); return R ? (R.v || null) : null; }
    return __L.END;
  }
  var api = { name: "view", run: part, count: 769, exports: {"appCopyPaint":1,"appRuntimeBoot":1,"appRuntimeClient":1,"appStageAsk":1,"appStageAskClose":1,"applyAdminUi":1,"applyChrome":1,"applyHeaderChoice":1,"applyRoomAudio":1,"applyRoomHelp":1,"applyViewerCrops":1,"armMeetDialogs":1,"atPwPrompt":1,"audioDump":1,"awayFull":1,"backGuardDrop":1,"blurA":0,"blurActx":0,"blurB":0,"blurBctx":0,"blurNote":1,"bootMeetSession":1,"bridgeAgentToPage":1,"camBtn":0,"capCardRefresh":1,"capLangAsk":1,"capPaint":1,"capSourceOpen":1,"carryIo":1,"ccDockBtn":0,"chatPanel":0,"chatPanelOpen":1,"chatTrace":1,"clearAdminClose":1,"clearAppView":1,"closeFsView":1,"closeMoreForWait":1,"closeTileWin":1,"comfyStadMeta":1,"comfyStadRoster":1,"countClosedChat":1,"ctAgendaOpen":1,"ctAppInfo":1,"ctInit":1,"ctPaintAgendaBtn":1,"ctPaintBar":1,"ctPresent":1,"dbgMeterShow":1,"dbgMeters":1,"dropStaleShareWin":1,"emitLiveTranscript":1,"enterPip":1,"explainHeldVideo":1,"foldBarForApp":1,"frozenTileSkip":1,"fsFitPaint":1,"fsFollowTalk":1,"fsRefreshIfOpen":1,"handBtn":0,"hideAppMissing":1,"hideCaptions":1,"hideDialogs":1,"hideJoinPwModal":1,"hideResharePrompt":1,"hostBotCard":1,"inviteLinkForModal":1,"islandNoteTick":1,"keysModal":0,"layout":1,"lgLeave":1,"loadScriptOnce":1,"lobbyPwOpenRoom":1,"makeTile":1,"massBannerTick":1,"micBtn":0,"newCanvas":1,"openBlurWhy":1,"openFsView":1,"openShareLiveModal":1,"openStageAdjust":1,"openTileWin":1,"paintAirKind":1,"paintAloneCard":1,"paintAppGifFromLane":1,"paintAppRoomBody":1,"paintAppWho":1,"paintAssistant":1,"paintAudienceReacts":1,"paintAvatarImg":1,"paintAwayMark":1,"paintBcQuiet":1,"paintBlurWhy":1,"paintBotEyes":1,"paintBotView":1,"paintBroadcastChrome":1,"paintBroadcastIdent":1,"paintBroadcastJoinNote":1,"paintBroadcastRole":1,"paintBroadcastSeats":1,"paintCallBanner":1,"paintCallOn":1,"paintCallState":1,"paintCcLocal":1,"paintCcState":1,"paintCcView":1,"paintChatBadge":1,"paintChatBtn":1,"paintChatCount":1,"paintChatGate":1,"paintChatNew":1,"paintChipBottom":1,"paintControls":1,"paintFaders":0,"paintFit":1,"paintHand":1,"paintHelpTip":1,"paintInviteSlot":1,"paintJoinVeil":1,"paintLiveBadge":1,"paintMyAvatarPreview":1,"paintOnAirBadge":1,"paintOnAirSide":1,"paintPeopleIfOpen":1,"paintProgressSteps":1,"paintQaBand":1,"paintRaisedHands":1,"paintRb":1,"paintRbNow":1,"paintRoomTitle":1,"paintRoomTrust":1,"paintRoster":1,"paintShare":1,"paintShareUrl":1,"paintSoloApp":1,"paintSpkBtn":1,"paintStadiumTile":1,"paintStage":1,"paintStageBlurWhy":1,"paintStageMod":1,"paintStagePlate":1,"paintStageVoteTargets":1,"paintStatusAlert":1,"paintStatusLine":1,"paintStatusNotice":1,"paintStatusSheet":1,"paintStatusWhy":1,"paintStreamLink":1,"paintTabTitle":1,"paintTileChrome":1,"paintTileOnGrid":1,"paintTranscriptControls":1,"paintTxMark":1,"paintVq":1,"paintWaitDoor":1,"paintWaitingSelf":1,"paintWspChip":1,"paintWspStatus":1,"pauseNote":1,"phoneLayout":1,"pipNote":1,"pipReaim":1,"pipReturn":1,"pipSource":1,"placeClearLine":1,"placeDeskName":1,"placeDockForWidth":1,"placeDockPopover":1,"placeFit":1,"placeHandq":1,"placeQaBand":1,"rbCanvas":1,"reassertVisLift":1,"recBtn":0,"refreshAudioBtn":1,"refreshAvatarSurfaces":1,"releaseHeld":1,"renderChat":1,"renderFiles":1,"renderHandq":1,"renderLobbyList":1,"renderQa":1,"renderTranscript":1,"replaceAddress":1,"roomAudioOn":1,"setAppFavicon":1,"setAppGif":1,"setBotView":1,"setTileLetter":1,"sgaAppOwner":1,"showAppMissing":1,"showAppPane":1,"showAppearCard":1,"showAvatarTrack":1,"showBlurNoteUnlessDialog":1,"showCamBack":1,"showCaption":1,"showClosedDialog":1,"showFlipButton":1,"showForkPick":1,"showHeldScreen":1,"showInviteModal":1,"showLeftDialog":1,"showLoadRefusal":1,"showLobby":1,"showPwModal":1,"showRecOptions":1,"showRecReplay":1,"showRelayBusy":1,"showResharePrompt":1,"showServiceEnded":1,"showShareLink":1,"showWhoIfOpen":1,"stadiumEl":0,"stagefeedEl":0,"stopLobbyPreview":1,"syncModalFocus":1,"takeFaceReact":1,"tickAdminClose":1,"tileNote":1,"timingRow":0,"topNameModal":1,"turnPaint":1,"twButton":1,"unmuteBtn":0,"updateAppButtons":1,"updateBlurAllBtn":1,"updateCamAllBtn":1,"updateMuteAllBtn":1,"updateReload":1,"updateShareAllBtn":1,"viewTestHooks":1,"waitPaint":1,"wakeMeet":1,"whoRepaint":1,"wireFsResize":1,"wireMediaSession":1}, needs: {"core":{"pipTarget":1,"vqManual":0,"stageIds":0,"adminsNow":0,"bcHostStored":0,"roomHeadCount":1,"leftDialogUp":1,"bcWatchingViewer":1,"barKind":1,"bcMayPublishAv":1,"idleDock":1,"barPlan":1,"uiText":1,"dockLabelSet":1,"hasAdminRoom":0,"uiLang":1,"ROOM":0,"paintBroadcastAir":1,"bcRole":1,"paintOnAir":1,"applyAvatarFile":1,"refreshAllTiles":1,"broadcastStatus":1,"pushLeaf":1,"bcPreInRoom":1,"becomeAssistant":1,"holdDoor":0,"amAdmin":0,"statusWords":0,"sayState":0,"liveInCall":1,"blurWhyWords":1,"tileBlurWhy":1,"frozeThisBeat":1,"reactRoomState":1,"seatDark":0,"forcedCamOff":0,"modBlurOn":0,"shareBlocked":0,"myName":0,"displayName":1,"pipCardReady":1,"pipFallback":1,"setStatus":0,"inMeetingNow":1,"sendVisPark":1,"botViewOn":0,"botParks":1,"dcSend":0,"autoFsOff":0,"setAutoFsOff":1,"admDeadline":0,"closeRoomNoHost":1,"bcOnAir":1,"updateRoomKey":0,"blurLevel":0,"progressStart":1,"progressTick":1,"progressWords":1,"homeHref":1,"fsInline":0,"fsFarTalkers":1,"fsFarCells":1,"fsCropBox":1,"viewNote":1,"fsFeedLive":1,"blurLevelFor":1,"sharingScreen":0,"nameInitial":1,"fsBlurClass":1,"stageModList":1,"wireModbar":1,"paintModbarButtons":1,"modOf":1,"localBlurPower":1,"setMod":1,"blurOffer":1,"hostWords":1,"focusId":0,"iAmWaiting":1,"shadeKey":1,"stageFeedVideo":1,"contentHas":1,"ctNote":1,"VMODE":0,"viewWord":1,"setView":1,"syncFocus":1,"CT":0,"appKey":0,"ctAgHidden":1,"ctText":1,"ctAspect":1,"turnHeld":1,"shareFirewallWords":1,"ctLabel":1,"ctSelect":1,"ctAgendaShortTime":1,"ctAgendaOver":1,"ctCanEditAgenda":1,"ctBring":1,"ctAgendaTickArm":1,"ctSpeakerPick":1,"ctAgCtx":1,"ctPaintAgendaClock":1,"ctAgendaPublish":1,"ctAgendaHide":1,"ctRefresh":1,"ctAgendaWhoText":1,"ctFocusSources":1,"applyViewerCrop":1,"viewerCropOf":1,"saveVcrops":1,"twIdOf":1,"twPeer":1,"twCaptionsButton":1,"updateTile":1,"stadFaceIdAt":1,"ensureAc":1,"pwBlocked":0,"rosterRows":1,"updateStatus":1,"paintRosterSoon":1,"mayHost":1,"waitingSince":1,"setWaitingRoom":1,"waitingRows":1,"hostRename":1,"hostSpot":1,"bcEndedInRoom":1,"stageClaimOf":0,"ctTurnPaint":1,"capOn":0,"subsOn":0,"subsMeetId":0,"capTry":1,"camPeer":0,"mediaOk":0,"meshCoord":0,"meshSeat":0,"peerAway":0,"clog":0,"dropPeer":1,"clearRosterTiles":1,"startMesh":1,"islandApart":1,"esc":0,"bcActButtons":1,"learnFoldedNames":1,"applyBcAct":1,"purgeAllFiles":1,"pwSetRoom":1,"deriveAdminKey":1,"adoptAdmKey":1,"admStoreKey":0,"mirrorRoomState":1,"whoRows":1,"whoFaceState":1,"whoObserve":1,"whoAddrLines":1,"pwBan":1,"whoFileText":1,"isCastEntry":1,"loadList":1,"lobRow":1,"stashJoinAv":1,"mintHostKey":1,"shortCode":0,"slugRoom":1,"lobbyPwHandOver":1,"setPersonalBlur":1,"parseMeetInput":1,"toggleBookmark":1,"saveList":1,"aloneCardShut":0,"inviteFromSolo":1,"appClientCtl":0,"DEBUG_ON":0,"unread":0,"reactAlert":0,"messageMentionsMe":1,"mentionToken":1,"linksAllowed":1,"viewerMayReact":1,"withMentions":1,"avatarChip":1,"reactorNames":1,"reactOpen":0,"lineOpen":0,"paintLog":1,"prayOn":0,"modStarOn":1,"lateJoinerSeesHistory":0,"slowModeOn":0,"chatLinksOn":0,"logNearBottom":1,"toggleLine":1,"takeReact":1,"sendAll":1,"applyOwnDelete":1,"admSigned":1,"applyCdel":1,"takeTomb":1,"uid":0,"mayPinFiles":1,"roomPastSection":0,"knownTotal":1,"stageGrantLive":0,"enforceBroadcastSeat":1,"canStage":0,"setStage":1,"mayShareScreen":0,"rbFmt":1,"rbToggle":1,"rbStop":1,"rbNoun":0,"rbTitle":1,"findSharedApp":1,"canIRunApp":0,"shareSheetFocusId":1,"appHiddenSid":0,"reconcileApp":1,"dlogOut":0,"dlogStoreGet":1,"dlogRecStart":1,"sendAvatarTo":1,"setVq":1,"trBlocks":1,"trLang":1,"trNote":1,"capName":1,"capPick":1,"capRows":1,"capNowNote":1,"capPublish":1,"ccLangLabel":0,"capLangName":1,"capLangMine":1,"capLangTag":1,"trLangOf":0,"ccLocalBlocked":1,"ccMB":0,"lsSet":0,"lsGet":0,"capSend":1,"txMarkWhy":1,"trMode":1,"setCapSend":1,"setTrMode":1,"leaveSeededService":1,"releaseLeaveAsk":1,"applyPageHeader":1,"reactRateOk":1,"faceDrawnHere":1,"sendFaceFrame":1,"sendAudienceReact":1,"focusOf":1,"amGloballyMuted":1,"micLockWords":1,"leaveMeeting":1,"updateMediaSession":1,"heldNoteSeen":1,"markHeldNote":1,"blurHold":1,"modalFocusables":1,"modalDismissBtn":1,"viewerShareUrl":1,"bcStartAt":1,"bcWhenWords":1,"armCopiedLabel":1,"linkRowHtml":1,"createAdminRoom":1,"holdLeaveAsk":1,"shortcutTyping":1,"stopApp":1,"appMode":0,"appHostCtl":0,"currentAppHelpMd":1,"currentAppCredits":1,"appEv":0,"appLeadable":0,"appLeadOn":0,"stopRoomApp":1,"appStageConsent":0,"appStagePlan":1,"importGif":1,"runApp":1,"installRunApp":1,"runLinkTarget":1,"fetchGifFromUrl":1,"runChoices":1,"aiNotesSetting":1,"backToNormalView":1,"agentChat":1,"botHidden":1,"turnNote":1,"occPid":0,"newNeg":0,"roomDig":1,"digestMode":0,"roomConsentIds":0,"freshSt":0,"armAppRoomTick":0,"shareOnlyStage":1,"meOnStage":1,"personOnStage":1,"screenSharers":0,"trWrites":1,"participantCount":1,"whisperReady":0,"roomKey":0,"model":0,"act":0,"tapUnblur":1,"clearNoPwState":1,"blurAgain":1,"joinWithPw":1,"mosIn":0,"mosStandby":0,"mosJobs":0,"mosAnn":0,"trKeeps":1,"myId":0,"hostBotStop":1,"PIP_CARD_W":0,"PIP_CARD_H":0,"PIP_CARD_ROWS":0,"PIP_CARD_FPS":0,"speakingOf":0,"isRowMate":1,"fsOpen":0,"displayCount":1,"recDefaultQuality":1,"dbgMeterKit":0,"ac":0,"dbgMeterAsked":0,"reportClearHost":1},"media":{"resumeReload":1,"micTap":1,"stashRecoverMedia":1,"sdView":0,"STAGE_FACE_SETTLE_MS":0,"stopScreenShare":1,"stageFrameVal":0,"setStageFrame":1,"normStageFrame":1,"AVATAR_W":0,"AVATAR_H":0,"avatarSharp":0,"blurSenderFrac":1,"blurDraw":1,"startLocalView":1,"refreshOutbound":1,"reviveCamera":1,"tileHolds":1,"applyBuses":1,"blurSized":1,"openCamChooser":1,"camChooserOpen":1,"dismissCamChooser":1,"lateMedia":1,"releaseAudio":1,"compOf":0,"trackAspect":1,"wkHolds":1,"wkBindVideo":1,"canScreenShare":0,"shareRecoverMode":0,"startScreenShare":1,"rbStart":1,"recoverShareTimer":0,"applyCcAll":1,"mix":0,"rememberMix":1,"toggleSing":1,"paintTiming":1,"speechRunning":1,"stopSpeech":1,"syncSpeech":1,"ccEngine":1,"phoneCaptions":1,"whisperAllowed":0,"wspPaintSafe":1,"WSP_WEAK":0,"CC_WHISPER_ANYWAY_KEY":0,"CC_ENGINE_KEY":0,"wspResume":1,"whisperInstalling":0,"wspInst":0,"WHISPER_APP_ID":0,"installWhisper":1,"armWhisperRescan":1,"whisperSupported":1,"CC_TRANSLATE_KEY":0,"whisperChosen":0,"wspState":1,"wspWorking":0,"capsRunningNow":1,"wspStateText":1,"wspStSig":0,"wspRetry":1,"wspChipGone":1,"wspChip":0,"WSP_CHIP_MS":0,"wspTickAt":0,"WSP_TICK_MS":0,"wspCaps":0,"wspQ":0,"wspStarved":0,"WSP_STARVE_MS":0,"WSP_STARVE_WIN":0,"WSP_STARVE_N":0,"wspToBrowser":1,"CC_WORDS_KEY":0,"trEnSync":1,"wspSync":1,"speechGaveUp":0,"stopWhisper":1,"wspRelease":1,"wspChipRoom":0,"WHISPER_SEED_KEY":0,"whisperSeedBlocked":1,"browserCaptionsMissing":1,"transcriptFile":1,"recDownload":1,"recFileName":1,"recRelease":1,"recStarting":0,"canScreenRecord":0,"recSources":1,"recLibraryOption":1,"openModal":1,"startRec":1,"refreshTrBtn":1,"callStateBox":0,"schedReconcile":1,"canRaiseHand":1,"speakerChoices":1,"openKeys":1,"camFacing":0,"camDeviceId":0,"regrabCamera":1,"camPickThen":0,"camChooserAnchor":0,"closeCamChooser":1,"pickCamera":1,"micChooserOpen":1,"closeMicChooser":1,"blockedAudio":0,"downFolds":0,"acClockInfo":1,"audioKickArmed":0,"wkEar":0,"stageEar":0,"sdViewSt":0,"prodPack":0,"avHold":0,"stripPack":0,"sentVideoTrack":1,"degOf":0,"STAGE_FACE_PX":0,"roomPack":0,"packLoop":0,"mosFb":0,"dbgRowFaces":0,"blurPipe":0,"ctScreenTrack":1,"soundHeld":1,"hearState":1,"stageViewNow":0,"CC_EARS_KEY":0,"serviceHeard":0,"setServiceHeard":1,"dbgMeterSources":1}}, stamp: "d49d42da" };
  (GifOS.coreParts = GifOS.coreParts || {})["view"] = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
