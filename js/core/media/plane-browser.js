/*
 * GifOS Core: the meeting, part "media". Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 * Lifted from the meeting page by the core lift (stamp d49d42da).
 * The statements below are the meeting page's own, in the page's order. A name another part owns is read
 * through that part (__C the core, __M the media plane, __V the view). The linker is host.js.
 */
(function (root) {
  var GifOS = root.GifOS = root.GifOS || {};
  function* part(__L) {
    var __C = __L.core, __M = __L.media, __V = __L.view;
    Object.defineProperties(__L.media, {
      "AVATAR_H": { get: function () { return AVATAR_H; }, enumerable: true, configurable: true },
      "AVATAR_W": { get: function () { return AVATAR_W; }, enumerable: true, configurable: true },
      "CC_EARS_KEY": { get: function () { return CC_EARS_KEY; }, enumerable: true, configurable: true },
      "CC_ENGINE_KEY": { get: function () { return CC_ENGINE_KEY; }, enumerable: true, configurable: true },
      "CC_TRANSLATE_KEY": { get: function () { return CC_TRANSLATE_KEY; }, enumerable: true, configurable: true },
      "CC_WHISPER_ANYWAY_KEY": { get: function () { return CC_WHISPER_ANYWAY_KEY; }, enumerable: true, configurable: true },
      "CC_WORDS_KEY": { get: function () { return CC_WORDS_KEY; }, enumerable: true, configurable: true },
      "MOS_GRACE": { get: function () { return MOS_GRACE; }, enumerable: true, configurable: true },
      "MOS_SETTLE": { get: function () { return MOS_SETTLE; }, enumerable: true, configurable: true },
      "STAGE_FACE_PX": { get: function () { return STAGE_FACE_PX; }, enumerable: true, configurable: true },
      "STAGE_FACE_SETTLE_MS": { get: function () { return STAGE_FACE_SETTLE_MS; }, enumerable: true, configurable: true },
      "STG_PIC_LIVE_MS": { get: function () { return STG_PIC_LIVE_MS; }, enumerable: true, configurable: true },
      "STG_ZERO_MS": { get: function () { return STG_ZERO_MS; }, enumerable: true, configurable: true },
      "WEBKIT_TILE": { get: function () { return WEBKIT_TILE; }, enumerable: true, configurable: true },
      "WHISPER_APP_ID": { get: function () { return WHISPER_APP_ID; }, enumerable: true, configurable: true },
      "WHISPER_SEED_KEY": { get: function () { return WHISPER_SEED_KEY; }, enumerable: true, configurable: true },
      "WSP_CHIP_MS": { get: function () { return WSP_CHIP_MS; }, enumerable: true, configurable: true },
      "WSP_STARVE_MS": { get: function () { return WSP_STARVE_MS; }, enumerable: true, configurable: true },
      "WSP_STARVE_N": { get: function () { return WSP_STARVE_N; }, enumerable: true, configurable: true },
      "WSP_STARVE_WIN": { get: function () { return WSP_STARVE_WIN; }, enumerable: true, configurable: true },
      "WSP_TICK_MS": { get: function () { return WSP_TICK_MS; }, enumerable: true, configurable: true },
      "WSP_WEAK": { get: function () { return WSP_WEAK; }, enumerable: true, configurable: true },
      "acClockInfo": { get: function () { return acClockInfo; }, enumerable: true, configurable: true },
      "adapt": { get: function () { return adapt; }, enumerable: true, configurable: true },
      "adoptClaim": { get: function () { return adoptClaim; }, enumerable: true, configurable: true },
      "applyBuses": { get: function () { return applyBuses; }, enumerable: true, configurable: true },
      "applyCcAll": { get: function () { return applyCcAll; }, enumerable: true, configurable: true },
      "applyGrid": { get: function () { return applyGrid; }, enumerable: true, configurable: true },
      "applyRecoverMedia": { get: function () { return applyRecoverMedia; }, enumerable: true, configurable: true },
      "armAudioKeepAlive": { get: function () { return armAudioKeepAlive; }, enumerable: true, configurable: true },
      "armWhisperRescan": { get: function () { return armWhisperRescan; }, enumerable: true, configurable: true },
      "attachFailed": { get: function () { return attachFailed; }, enumerable: true, configurable: true },
      "attachLocalTracks": { get: function () { return attachLocalTracks; }, enumerable: true, configurable: true },
      "attachTrack": { get: function () { return attachTrack; }, enumerable: true, configurable: true },
      "audioKickArmed": { get: function () { return audioKickArmed; }, set: function (v) { audioKickArmed = v; }, enumerable: true, configurable: true },
      "avHold": { get: function () { return avHold; }, set: function (v) { avHold = v; }, enumerable: true, configurable: true },
      "avatarSharp": { get: function () { return avatarSharp; }, set: function (v) { avatarSharp = v; }, enumerable: true, configurable: true },
      "bindClaim": { get: function () { return bindClaim; }, enumerable: true, configurable: true },
      "blockLive": { get: function () { return blockLive; }, enumerable: true, configurable: true },
      "blockOf": { get: function () { return blockOf; }, enumerable: true, configurable: true },
      "blockPicture": { get: function () { return blockPicture; }, enumerable: true, configurable: true },
      "blockedAudio": { get: function () { return blockedAudio; }, enumerable: true, configurable: true },
      "blurDraw": { get: function () { return blurDraw; }, enumerable: true, configurable: true },
      "blurPipe": { get: function () { return blurPipe; }, set: function (v) { blurPipe = v; }, enumerable: true, configurable: true },
      "blurSenderFrac": { get: function () { return blurSenderFrac; }, enumerable: true, configurable: true },
      "blurViewFrac": { get: function () { return blurViewFrac; }, enumerable: true, configurable: true },
      "botVoiceTrack": { get: function () { return botVoiceTrack; }, set: function (v) { botVoiceTrack = v; }, enumerable: true, configurable: true },
      "browserCaptionsMissing": { get: function () { return browserCaptionsMissing; }, enumerable: true, configurable: true },
      "callStateBox": { get: function () { return callStateBox; }, set: function (v) { callStateBox = v; }, enumerable: true, configurable: true },
      "camChooserAnchor": { get: function () { return camChooserAnchor; }, set: function (v) { camChooserAnchor = v; }, enumerable: true, configurable: true },
      "camChooserOpen": { get: function () { return camChooserOpen; }, enumerable: true, configurable: true },
      "camDeviceId": { get: function () { return camDeviceId; }, set: function (v) { camDeviceId = v; }, enumerable: true, configurable: true },
      "camFacing": { get: function () { return camFacing; }, set: function (v) { camFacing = v; }, enumerable: true, configurable: true },
      "camIdleT": { get: function () { return camIdleT; }, set: function (v) { camIdleT = v; }, enumerable: true, configurable: true },
      "camPickThen": { get: function () { return camPickThen; }, set: function (v) { camPickThen = v; }, enumerable: true, configurable: true },
      "camTrackForTest": { get: function () { return camTrackForTest; }, enumerable: true, configurable: true },
      "camVideoConstraints": { get: function () { return camVideoConstraints; }, enumerable: true, configurable: true },
      "canRaiseHand": { get: function () { return canRaiseHand; }, enumerable: true, configurable: true },
      "canScreenRecord": { get: function () { return canScreenRecord; }, enumerable: true, configurable: true },
      "canScreenShare": { get: function () { return canScreenShare; }, enumerable: true, configurable: true },
      "capsRunningNow": { get: function () { return capsRunningNow; }, enumerable: true, configurable: true },
      "carriedHot": { get: function () { return carriedHot; }, enumerable: true, configurable: true },
      "carryEarAc": { get: function () { return carryEarAc; }, enumerable: true, configurable: true },
      "carryVoiceTrack": { get: function () { return carryVoiceTrack; }, set: function (v) { carryVoiceTrack = v; }, enumerable: true, configurable: true },
      "ccDefGroup": { get: function () { return ccDefGroup; }, set: function (v) { ccDefGroup = v; }, enumerable: true, configurable: true },
      "ccEngine": { get: function () { return ccEngine; }, enumerable: true, configurable: true },
      "ccMix": { get: function () { return ccMix; }, enumerable: true, configurable: true },
      "ccMixStop": { get: function () { return ccMixStop; }, enumerable: true, configurable: true },
      "ccMixSync": { get: function () { return ccMixSync; }, enumerable: true, configurable: true },
      "clk": { get: function () { return clk; }, enumerable: true, configurable: true },
      "clockSample": { get: function () { return clockSample; }, enumerable: true, configurable: true },
      "closeCamChooser": { get: function () { return closeCamChooser; }, enumerable: true, configurable: true },
      "closeMicChooser": { get: function () { return closeMicChooser; }, enumerable: true, configurable: true },
      "compOf": { get: function () { return compOf; }, enumerable: true, configurable: true },
      "containerFor": { get: function () { return containerFor; }, enumerable: true, configurable: true },
      "ctScreenTrack": { get: function () { return ctScreenTrack; }, enumerable: true, configurable: true },
      "dbgMeterSources": { get: function () { return dbgMeterSources; }, enumerable: true, configurable: true },
      "dbgRowFaces": { get: function () { return dbgRowFaces; }, set: function (v) { dbgRowFaces = v; }, enumerable: true, configurable: true },
      "degOf": { get: function () { return degOf; }, enumerable: true, configurable: true },
      "detachTrack": { get: function () { return detachTrack; }, enumerable: true, configurable: true },
      "dismissCamChooser": { get: function () { return dismissCamChooser; }, enumerable: true, configurable: true },
      "downFolds": { get: function () { return downFolds; }, enumerable: true, configurable: true },
      "downStreams": { get: function () { return downStreams; }, enumerable: true, configurable: true },
      "dropContainer": { get: function () { return dropContainer; }, enumerable: true, configurable: true },
      "dropEndedRemoteTracks": { get: function () { return dropEndedRemoteTracks; }, enumerable: true, configurable: true },
      "dutyMuteTick": { get: function () { return dutyMuteTick; }, enumerable: true, configurable: true },
      "earState": { get: function () { return earState; }, enumerable: true, configurable: true },
      "endSongOnStepDown": { get: function () { return endSongOnStepDown; }, enumerable: true, configurable: true },
      "faceLive": { get: function () { return faceLive; }, enumerable: true, configurable: true },
      "facePaint": { get: function () { return facePaint; }, enumerable: true, configurable: true },
      "facesOnScreen": { get: function () { return facesOnScreen; }, enumerable: true, configurable: true },
      "gdOverride": { get: function () { return gdOverride; }, set: function (v) { gdOverride = v; }, enumerable: true, configurable: true },
      "gridApplied": { get: function () { return gridApplied; }, enumerable: true, configurable: true },
      "gumRefused": { get: function () { return gumRefused; }, enumerable: true, configurable: true },
      "gumWithMicFallback": { get: function () { return gumWithMicFallback; }, enumerable: true, configurable: true },
      "headLinkUp": { get: function () { return headLinkUp; }, enumerable: true, configurable: true },
      "headSendsStale": { get: function () { return headSendsStale; }, enumerable: true, configurable: true },
      "hearState": { get: function () { return hearState; }, enumerable: true, configurable: true },
      "heardStage": { get: function () { return heardStage; }, enumerable: true, configurable: true },
      "holdMainVideo": { get: function () { return holdMainVideo; }, enumerable: true, configurable: true },
      "hopMs": { get: function () { return hopMs; }, enumerable: true, configurable: true },
      "installWhisper": { get: function () { return installWhisper; }, enumerable: true, configurable: true },
      "jobPinned": { get: function () { return jobPinned; }, enumerable: true, configurable: true },
      "jobVideoAt": { get: function () { return jobVideoAt; }, enumerable: true, configurable: true },
      "keepAwake": { get: function () { return keepAwake; }, enumerable: true, configurable: true },
      "keepMeetingAudio": { get: function () { return keepMeetingAudio; }, enumerable: true, configurable: true },
      "keyUp": { get: function () { return keyUp; }, enumerable: true, configurable: true },
      "kfEv": { get: function () { return kfEv; }, enumerable: true, configurable: true },
      "kickJob": { get: function () { return kickJob; }, enumerable: true, configurable: true },
      "kickMainAudio": { get: function () { return kickMainAudio; }, enumerable: true, configurable: true },
      "kickMainVideo": { get: function () { return kickMainVideo; }, enumerable: true, configurable: true },
      "kickStageMic": { get: function () { return kickStageMic; }, enumerable: true, configurable: true },
      "l14Packs": { get: function () { return l14Packs; }, enumerable: true, configurable: true },
      "lateMedia": { get: function () { return lateMedia; }, enumerable: true, configurable: true },
      "mainAudioTrack": { get: function () { return mainAudioTrack; }, enumerable: true, configurable: true },
      "maybeShowFlip": { get: function () { return maybeShowFlip; }, enumerable: true, configurable: true },
      "mediaElCensus": { get: function () { return mediaElCensus; }, enumerable: true, configurable: true },
      "micChooserOpen": { get: function () { return micChooserOpen; }, enumerable: true, configurable: true },
      "micHold": { get: function () { return micHold; }, enumerable: true, configurable: true },
      "micTap": { get: function () { return micTap; }, enumerable: true, configurable: true },
      "mix": { get: function () { return mix; }, enumerable: true, configurable: true },
      "mixAc": { get: function () { return mixAc; }, set: function (v) { mixAc = v; }, enumerable: true, configurable: true },
      "mixReady": { get: function () { return mixReady; }, enumerable: true, configurable: true },
      "mosFb": { get: function () { return mosFb; }, enumerable: true, configurable: true },
      "mosHeld": { get: function () { return mosHeld; }, enumerable: true, configurable: true },
      "mySelfStream": { get: function () { return mySelfStream; }, enumerable: true, configurable: true },
      "normStageFrame": { get: function () { return normStageFrame; }, enumerable: true, configurable: true },
      "noteAudioDevices": { get: function () { return noteAudioDevices; }, enumerable: true, configurable: true },
      "noteReship": { get: function () { return noteReship; }, enumerable: true, configurable: true },
      "onMeetDeviceChange": { get: function () { return onMeetDeviceChange; }, enumerable: true, configurable: true },
      "openCamChooser": { get: function () { return openCamChooser; }, enumerable: true, configurable: true },
      "openKeys": { get: function () { return openKeys; }, enumerable: true, configurable: true },
      "openModal": { get: function () { return openModal; }, enumerable: true, configurable: true },
      "orphaned": { get: function () { return orphaned; }, enumerable: true, configurable: true },
      "overlayTiny": { get: function () { return overlayTiny; }, enumerable: true, configurable: true },
      "packFor": { get: function () { return packFor; }, enumerable: true, configurable: true },
      "packLoop": { get: function () { return packLoop; }, set: function (v) { packLoop = v; }, enumerable: true, configurable: true },
      "paintStageStrip": { get: function () { return paintStageStrip; }, enumerable: true, configurable: true },
      "paintTiming": { get: function () { return paintTiming; }, enumerable: true, configurable: true },
      "parkSender": { get: function () { return parkSender; }, enumerable: true, configurable: true },
      "partStream": { get: function () { return partStream; }, enumerable: true, configurable: true },
      "peerAudioTracks": { get: function () { return peerAudioTracks; }, enumerable: true, configurable: true },
      "phoneCaptions": { get: function () { return phoneCaptions; }, enumerable: true, configurable: true },
      "picRead": { get: function () { return picRead; }, enumerable: true, configurable: true },
      "pickCamera": { get: function () { return pickCamera; }, enumerable: true, configurable: true },
      "pipeDeny": { get: function () { return pipeDeny; }, enumerable: true, configurable: true },
      "pipeJobs": { get: function () { return pipeJobs; }, enumerable: true, configurable: true },
      "playTileVideo": { get: function () { return playTileVideo; }, enumerable: true, configurable: true },
      "poke": { get: function () { return poke; }, enumerable: true, configurable: true },
      "prodPack": { get: function () { return prodPack; }, set: function (v) { prodPack = v; }, enumerable: true, configurable: true },
      "producerKey": { get: function () { return producerKey; }, enumerable: true, configurable: true },
      "qaStageSt": { get: function () { return qaStageSt; }, set: function (v) { qaStageSt = v; }, enumerable: true, configurable: true },
      "quietAtDoor": { get: function () { return quietAtDoor; }, enumerable: true, configurable: true },
      "rbStart": { get: function () { return rbStart; }, enumerable: true, configurable: true },
      "reactSing": { get: function () { return reactSing; }, enumerable: true, configurable: true },
      "recDownload": { get: function () { return recDownload; }, enumerable: true, configurable: true },
      "recDraw": { get: function () { return recDraw; }, set: function (v) { recDraw = v; }, enumerable: true, configurable: true },
      "recFileName": { get: function () { return recFileName; }, enumerable: true, configurable: true },
      "recLibraryOption": { get: function () { return recLibraryOption; }, enumerable: true, configurable: true },
      "recMatchMix": { get: function () { return recMatchMix; }, set: function (v) { recMatchMix = v; }, enumerable: true, configurable: true },
      "recMode": { get: function () { return recMode; }, set: function (v) { recMode = v; }, enumerable: true, configurable: true },
      "recNoteStruct": { get: function () { return recNoteStruct; }, enumerable: true, configurable: true },
      "recQuality": { get: function () { return recQuality; }, set: function (v) { recQuality = v; }, enumerable: true, configurable: true },
      "recRec": { get: function () { return recRec; }, set: function (v) { recRec = v; }, enumerable: true, configurable: true },
      "recRelease": { get: function () { return recRelease; }, enumerable: true, configurable: true },
      "recScopeSources": { get: function () { return recScopeSources; }, enumerable: true, configurable: true },
      "recSources": { get: function () { return recSources; }, enumerable: true, configurable: true },
      "recStarting": { get: function () { return recStarting; }, set: function (v) { recStarting = v; }, enumerable: true, configurable: true },
      "reconcileMosaic": { get: function () { return reconcileMosaic; }, enumerable: true, configurable: true },
      "recoverShareTimer": { get: function () { return recoverShareTimer; }, set: function (v) { recoverShareTimer = v; }, enumerable: true, configurable: true },
      "refreshOutbound": { get: function () { return refreshOutbound; }, enumerable: true, configurable: true },
      "refreshTrBtn": { get: function () { return refreshTrBtn; }, enumerable: true, configurable: true },
      "regrabCamera": { get: function () { return regrabCamera; }, enumerable: true, configurable: true },
      "releaseAudio": { get: function () { return releaseAudio; }, enumerable: true, configurable: true },
      "rememberMix": { get: function () { return rememberMix; }, enumerable: true, configurable: true },
      "repaintRedun": { get: function () { return repaintRedun; }, enumerable: true, configurable: true },
      "resumeReload": { get: function () { return resumeReload; }, enumerable: true, configurable: true },
      "retireMixTracks": { get: function () { return retireMixTracks; }, enumerable: true, configurable: true },
      "reviveCamera": { get: function () { return reviveCamera; }, enumerable: true, configurable: true },
      "roomPack": { get: function () { return roomPack; }, set: function (v) { roomPack = v; }, enumerable: true, configurable: true },
      "rowEdge": { get: function () { return rowEdge; }, enumerable: true, configurable: true },
      "rowMixHeadArrives": { get: function () { return rowMixHeadArrives; }, enumerable: true, configurable: true },
      "rowMixHold": { get: function () { return rowMixHold; }, enumerable: true, configurable: true },
      "rowMixOpen": { get: function () { return rowMixOpen; }, enumerable: true, configurable: true },
      "rowMixViaPeek": { get: function () { return rowMixViaPeek; }, enumerable: true, configurable: true },
      "schedClaim": { get: function () { return schedClaim; }, enumerable: true, configurable: true },
      "schedReconcile": { get: function () { return schedReconcile; }, enumerable: true, configurable: true },
      "sdView": { get: function () { return sdView; }, set: function (v) { sdView = v; }, enumerable: true, configurable: true },
      "sdViewSt": { get: function () { return sdViewSt; }, set: function (v) { sdViewSt = v; }, enumerable: true, configurable: true },
      "sentVideoTrack": { get: function () { return sentVideoTrack; }, enumerable: true, configurable: true },
      "serviceHeard": { get: function () { return serviceHeard; }, set: function (v) { serviceHeard = v; }, enumerable: true, configurable: true },
      "setServiceHeard": { get: function () { return setServiceHeard; }, enumerable: true, configurable: true },
      "setStageFrame": { get: function () { return setStageFrame; }, enumerable: true, configurable: true },
      "shareRecoverMode": { get: function () { return shareRecoverMode; }, set: function (v) { shareRecoverMode = v; }, enumerable: true, configurable: true },
      "shipContainers": { get: function () { return shipContainers; }, enumerable: true, configurable: true },
      "shownPeerCount": { get: function () { return shownPeerCount; }, enumerable: true, configurable: true },
      "slotDark": { get: function () { return slotDark; }, enumerable: true, configurable: true },
      "soundHeld": { get: function () { return soundHeld; }, enumerable: true, configurable: true },
      "speakerChoices": { get: function () { return speakerChoices; }, enumerable: true, configurable: true },
      "speech": { get: function () { return speech; }, set: function (v) { speech = v; }, enumerable: true, configurable: true },
      "speechGaveUp": { get: function () { return speechGaveUp; }, set: function (v) { speechGaveUp = v; }, enumerable: true, configurable: true },
      "speechProved": { get: function () { return speechProved; }, set: function (v) { speechProved = v; }, enumerable: true, configurable: true },
      "speechRunning": { get: function () { return speechRunning; }, enumerable: true, configurable: true },
      "stageAudible": { get: function () { return stageAudible; }, enumerable: true, configurable: true },
      "stageEar": { get: function () { return stageEar; }, set: function (v) { stageEar = v; }, enumerable: true, configurable: true },
      "stageEarFoldPeak": { get: function () { return stageEarFoldPeak; }, enumerable: true, configurable: true },
      "stageEarLiveTrack": { get: function () { return stageEarLiveTrack; }, enumerable: true, configurable: true },
      "stageEarRawPeak": { get: function () { return stageEarRawPeak; }, enumerable: true, configurable: true },
      "stageFeedShows": { get: function () { return stageFeedShows; }, enumerable: true, configurable: true },
      "stageFrameVal": { get: function () { return stageFrameVal; }, set: function (v) { stageFrameVal = v; }, enumerable: true, configurable: true },
      "stageViewNow": { get: function () { return stageViewNow; }, set: function (v) { stageViewNow = v; }, enumerable: true, configurable: true },
      "stagedSelfWas": { get: function () { return stagedSelfWas; }, set: function (v) { stagedSelfWas = v; }, enumerable: true, configurable: true },
      "startLocalView": { get: function () { return startLocalView; }, enumerable: true, configurable: true },
      "startRec": { get: function () { return startRec; }, enumerable: true, configurable: true },
      "startScreenShare": { get: function () { return startScreenShare; }, enumerable: true, configurable: true },
      "startWhisper": { get: function () { return startWhisper; }, enumerable: true, configurable: true },
      "stashRecoverMedia": { get: function () { return stashRecoverMedia; }, enumerable: true, configurable: true },
      "stgBeatIn": { get: function () { return stgBeatIn; }, enumerable: true, configurable: true },
      "stgCarry": { get: function () { return stgCarry; }, enumerable: true, configurable: true },
      "stgFoNote": { get: function () { return stgFoNote; }, enumerable: true, configurable: true },
      "stgLost": { get: function () { return stgLost; }, enumerable: true, configurable: true },
      "stopBlurPipe": { get: function () { return stopBlurPipe; }, enumerable: true, configurable: true },
      "stopScreenShare": { get: function () { return stopScreenShare; }, enumerable: true, configurable: true },
      "stopSpeech": { get: function () { return stopSpeech; }, enumerable: true, configurable: true },
      "stopWhisper": { get: function () { return stopWhisper; }, enumerable: true, configurable: true },
      "stripPack": { get: function () { return stripPack; }, set: function (v) { stripPack = v; }, enumerable: true, configurable: true },
      "stubDuties": { get: function () { return stubDuties; }, enumerable: true, configurable: true },
      "swapPicNote": { get: function () { return swapPicNote; }, enumerable: true, configurable: true },
      "swapTrack": { get: function () { return swapTrack; }, enumerable: true, configurable: true },
      "syncAvatarFeed": { get: function () { return syncAvatarFeed; }, enumerable: true, configurable: true },
      "syncSpeech": { get: function () { return syncSpeech; }, enumerable: true, configurable: true },
      "tileHolds": { get: function () { return tileHolds; }, enumerable: true, configurable: true },
      "toggleSing": { get: function () { return toggleSing; }, enumerable: true, configurable: true },
      "trEnSync": { get: function () { return trEnSync; }, enumerable: true, configurable: true },
      "trackAspect": { get: function () { return trackAspect; }, enumerable: true, configurable: true },
      "trackQ": { get: function () { return trackQ; }, enumerable: true, configurable: true },
      "transcriptFile": { get: function () { return transcriptFile; }, enumerable: true, configurable: true },
      "tuneCfg": { get: function () { return tuneCfg; }, enumerable: true, configurable: true },
      "unbindClaim": { get: function () { return unbindClaim; }, enumerable: true, configurable: true },
      "wakeLock": { get: function () { return wakeLock; }, set: function (v) { wakeLock = v; }, enumerable: true, configurable: true },
      "warnRecorderNewApp": { get: function () { return warnRecorderNewApp; }, enumerable: true, configurable: true },
      "whisperAllowed": { get: function () { return whisperAllowed; }, enumerable: true, configurable: true },
      "whisperChosen": { get: function () { return whisperChosen; }, enumerable: true, configurable: true },
      "whisperInstalling": { get: function () { return whisperInstalling; }, set: function (v) { whisperInstalling = v; }, enumerable: true, configurable: true },
      "whisperRescan": { get: function () { return whisperRescan; }, set: function (v) { whisperRescan = v; }, enumerable: true, configurable: true },
      "whisperSeedBlocked": { get: function () { return whisperSeedBlocked; }, enumerable: true, configurable: true },
      "whisperSupported": { get: function () { return whisperSupported; }, enumerable: true, configurable: true },
      "withScrPipe": { get: function () { return withScrPipe; }, enumerable: true, configurable: true },
      "wkBindVideo": { get: function () { return wkBindVideo; }, enumerable: true, configurable: true },
      "wkEar": { get: function () { return wkEar; }, set: function (v) { wkEar = v; }, enumerable: true, configurable: true },
      "wkFwdCopies": { get: function () { return wkFwdCopies; }, enumerable: true, configurable: true },
      "wkFwdNeeded": { get: function () { return wkFwdNeeded; }, enumerable: true, configurable: true },
      "wkHolds": { get: function () { return wkHolds; }, enumerable: true, configurable: true },
      "wkQuietBind": { get: function () { return wkQuietBind; }, enumerable: true, configurable: true },
      "wkRemoteTrack": { get: function () { return wkRemoteTrack; }, enumerable: true, configurable: true },
      "wsp": { get: function () { return wsp; }, set: function (v) { wsp = v; }, enumerable: true, configurable: true },
      "wspCaps": { get: function () { return wspCaps; }, enumerable: true, configurable: true },
      "wspChip": { get: function () { return wspChip; }, enumerable: true, configurable: true },
      "wspChipGone": { get: function () { return wspChipGone; }, enumerable: true, configurable: true },
      "wspChipRoom": { get: function () { return wspChipRoom; }, enumerable: true, configurable: true },
      "wspEnqueue": { get: function () { return wspEnqueue; }, enumerable: true, configurable: true },
      "wspInst": { get: function () { return wspInst; }, enumerable: true, configurable: true },
      "wspModel": { get: function () { return wspModel; }, enumerable: true, configurable: true },
      "wspPaintSafe": { get: function () { return wspPaintSafe; }, enumerable: true, configurable: true },
      "wspPaused": { get: function () { return wspPaused; }, set: function (v) { wspPaused = v; }, enumerable: true, configurable: true },
      "wspQ": { get: function () { return wspQ; }, enumerable: true, configurable: true },
      "wspRebind": { get: function () { return wspRebind; }, enumerable: true, configurable: true },
      "wspRelease": { get: function () { return wspRelease; }, enumerable: true, configurable: true },
      "wspResume": { get: function () { return wspResume; }, enumerable: true, configurable: true },
      "wspRetry": { get: function () { return wspRetry; }, enumerable: true, configurable: true },
      "wspStSig": { get: function () { return wspStSig; }, set: function (v) { wspStSig = v; }, enumerable: true, configurable: true },
      "wspStarved": { get: function () { return wspStarved; }, set: function (v) { wspStarved = v; }, enumerable: true, configurable: true },
      "wspState": { get: function () { return wspState; }, enumerable: true, configurable: true },
      "wspStateText": { get: function () { return wspStateText; }, enumerable: true, configurable: true },
      "wspStop": { get: function () { return wspStop; }, enumerable: true, configurable: true },
      "wspSync": { get: function () { return wspSync; }, enumerable: true, configurable: true },
      "wspTickAt": { get: function () { return wspTickAt; }, set: function (v) { wspTickAt = v; }, enumerable: true, configurable: true },
      "wspToBrowser": { get: function () { return wspToBrowser; }, enumerable: true, configurable: true },
      "wspWorking": { get: function () { return wspWorking; }, enumerable: true, configurable: true },
      "x2Target": { get: function () { return x2Target; }, enumerable: true, configurable: true }
    });
    yield 30;
    // A service mute is this device only. It does not write the shared mix,
    // so a small group still opens at the fader the person last set.
    // An embed opens muted: browsers only autoplay muted, and the page around it decides nothing for the viewer.
    let serviceHeard = !__C.EMBED;
    yield 604;
    // A screen's picture: my own capture, else the sharer's stage feed, else
    // the stage strip (a seat that does not hold the feed paints the strip).
    function ctScreenTrack(sid) {
      if (sid === __C.myId) {
        const t = typeof __C.screenStream !== 'undefined' && __C.screenStream && __C.screenStream.getVideoTracks()[0];
        if (t && t.readyState !== 'ended') return { track: t, from: 'own' };
      }
      const f = (0, /*()*/__C.stageFeedVideo)(sid);
      if (f && f.track) return { track: f.track, from: 'stg' };
      // The sharer's own stage feed, held here but not yet painted by its
      // hidden element (a browser that never decodes a hidden video): the
      // track is live, so the tab plays it itself.
      try {
        const m = __C.mosIn && __C.mosIn.get('stg:' + sid);
        const t = m && m.stream && m.stream.getVideoTracks && m.stream.getVideoTracks()[0];
        if (t && t.readyState !== 'ended') return { track: t, from: 'stg' };
      } catch (e) {}
      const sgs = document.querySelector('#stagefeed [data-row="sgs"] video');
      const st = sgs && sgs.srcObject;
      const t = st && st.getVideoTracks && st.getVideoTracks()[0];
      if (t && t.readyState !== 'ended') return { track: t, from: 'strip' };
      return null;
    }
    yield 706;
    // Where a carried voice is HEARD (docs/turn-carry.md). Every other voice plays through an element; a carried voice is
    // decoded in the page, so it plays from an AudioContext. The meeting context plays to no device where the browser allows
    // that, so there the voice gets a context of its own that plays to the speaker (and follows the speaker pick:
    // applySpeaker). Its own jitter buffer runs on that context's clock: no resampler between the two clocks, no pitch drift.
    // Elsewhere the meeting context is the speaker's already.
    let carryOutAc = null;
    function carryEarAc() {
      const m = (0, /*()*/__C.ensureAc)(); if (!m) return null;
      let none = false; try { none = !!(m.sinkId && typeof m.sinkId === 'object' && m.sinkId.type === 'none'); } catch (e) {}
      if (!none) return m;
      if (!carryOutAc) {
        try { carryOutAc = (0, /*()*/__C.newMeetAudioContext)(true); } catch (e) { carryOutAc = null; }
        if (!carryOutAc) return null;
        const wake = () => { if (carryOutAc && (carryOutAc.state === 'suspended' || carryOutAc.state === 'interrupted')) carryOutAc.resume().catch(() => {}); };
        carryOutAc.onstatechange = wake; document.addEventListener('pointerdown', wake); wake();
        if (spkDeviceId && typeof carryOutAc.setSinkId === 'function') carryOutAc.setSinkId(spkDeviceId).catch(() => {});
      }
      return carryOutAc;
    }
    yield 716;


    // ---- sender-side blur: broadcast blurred pixels, not just CSS ------------
    // When YOU blur yourself, your browser draws the camera through a blur
    // canvas and sends THAT track. A receiver who deletes the CSS blur from
    // their DOM still only has blurred pixels — there is no clear image to
    // recover. (Group/guest blur stays receiver-side: an uncooperative bad
    // actor can't be made to blur at source, but every receiver blurs them.)
    // ========================= BACKGROUND KEEPALIVE ==========================
    // There is no single "keep working when unfocused" API — what keeps a meeting
    // alive in the background is the combination browsers exempt from
    // throttling: an ACTIVE WebRTC connection (we have one), a screen WAKE
    // LOCK while someone is actually using the phone (a PARKED phone — minutes
    // with no touch and no speech — deliberately RELEASES it and lets the
    // screen rest: a pinned-on screen out-drank a charger overnight; audio,
    // presence, and worker-clocked beats carry the meeting on), and
    // WORKER-driven timers for our canvas pipelines — a hidden tab clamps
    // main-thread timers to ≥1s (which froze the blurred broadcast and
    // recordings), but a Web Worker's metronome keeps ticking.
    let wakeLock = null;
    yield 718;
    async function keepAwake() {
      if (__C.idleNow) return; // a parked phone's screen is allowed to rest
      // Leave and the hostless close set leaving; stopLocalCapture released
      // the lock then, and a later visibilitychange must not take it back.
      if (__C.leaving) return;
      try { if (navigator.wakeLock && !document.hidden) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { __C.lastActive = Date.now(); if (__C.idleNow) setParked(false); keepAwake(); } });
    keepAwake();
    // One blob URL for the life of the page. The worker is terminated when
    // the last subscriber leaves and minted again on the next subscribe (a
    // visible tab drops the blur subscription). Creating the URL inside that
    // transition leaked one blob per hide/show.
    const METRO_SRC = URL.createObjectURL(new Blob(['setInterval(function(){postMessage(1)},66)'], { type: 'text/javascript' }));
    let metro = null;
    const metroSubs = new Set(); // callbacks ticked ~15x/s, background included
    let pageUnloading = false;
    window.addEventListener('pagehide', () => { pageUnloading = true; });
    window.addEventListener('pageshow', () => { pageUnloading = false; });
    function metroSub(fn) {
      // An unloading page needs no clock. The hidden flip of an unload lands
      // after pagehide, and WebKit refuses a Worker started from a blob in a
      // document that is unloading (a page error on every reload with blur on).
      if (pageUnloading) return () => {};
      if (!metro) {
        try {
          metro = new Worker(METRO_SRC);
          metro.onmessage = () => { for (const f of Array.from(metroSubs)) { try { f(); } catch (e) {} } };
        } catch (e) { metro = null; }
      }
      metroSubs.add(fn);
      return () => {
        metroSubs.delete(fn);
        // Last subscriber gone (blur off, recording stopped): kill the worker.
        // A subscriber-less 15Hz tick would otherwise spin forever, denying
        // the SoC its deep-idle states — pure battery loss for zero work.
        if (!metroSubs.size && metro) { try { metro.terminate(); } catch (e) {} metro = null; }
      };
    }

    // BLUR STRENGTH IS A FRACTION OF THE PICTURE'S SIZE (Nathan, 2026-11-15:
    // a fixed radius in pixels read strong on a phone tile and nearly clear on
    // a big one, and Min was too clear). The sender's blur is the privacy blur:
    // Min leaves a soft person, Max hides the face. The viewer's blur is only a
    // backstop against a sender that ships clear video when the rule says blur,
    // so it is lighter and barely changes an honest, already blurred picture.
    // The numbers and their derivations live in the global timings table.
    // SIZE IS THE LONG SIDE, not the width: a face is about the same share of
    // a picture's long side held either way (a portrait phone camera's face is
    // half its width, a landscape webcam's a quarter), so a width fraction
    // blurred a portrait picture about half as much (room proof, 2026-11-15).
    const BLUR_MIN_FRAC = GifOS.timings.BLUR_MIN_FRAC, BLUR_MAX_FRAC = GifOS.timings.BLUR_MAX_FRAC;
    const BLUR_VIEW_MIN_FRAC = GifOS.timings.BLUR_VIEW_MIN_FRAC, BLUR_VIEW_MAX_FRAC = GifOS.timings.BLUR_VIEW_MAX_FRAC;
    const BLUR_PYRAMID_K = GifOS.timings.BLUR_PYRAMID_K;
    function blurSenderFrac(level) { return level >= 2 ? BLUR_MAX_FRAC : level >= 1 ? BLUR_MIN_FRAC : 0; }
    // In a no-password room with a clear right, honest senders may send clear pixels on purpose, so a viewer's Max blur
    // is the sender's own Max (BLUR_MAX_FRAC), not the backstop's half (blurViewFrac.strong, set in refreshOutbound).
    function blurViewFrac(level) { return level >= 2 ? (blurViewFrac.strong ? BLUR_MAX_FRAC : BLUR_VIEW_MAX_FRAC) : level >= 1 ? BLUR_VIEW_MIN_FRAC : 0; }
    // The filter's sigma in pixels for a picture w wide (two decimals: a
    // sub-pixel radius still blurs, and a whole-pixel floor would change the look on small pictures).
    function blurPx(frac, w) { return Math.max(0, Math.round(frac * w * 100) / 100); }
    // The mip pyramid's bottom width for the same sigma (at least 2 columns).
    function blurPyramidBottom(frac) { return Math.max(2, Math.round(BLUR_PYRAMID_K / Math.max(1e-6, frac))); }
    // The receiver's CSS blur reads the element's own rendered width (--bw)
    // times the fraction (--blur-view-min/max on the root): one observer keeps
    // --bw on every element that wears a blur class.
    try {
      const rs = document.documentElement.style;
      rs.setProperty('--blur-view-min', String(BLUR_VIEW_MIN_FRAC));
      rs.setProperty('--blur-view-max', String(BLUR_VIEW_MAX_FRAC));
      rs.setProperty('--blur-min', String(BLUR_MIN_FRAC)); // the lobby preview shows the sender's own look
      rs.setProperty('--blur-max', String(BLUR_MAX_FRAC));
    } catch (e) {}
    const blurSizeObs = (typeof ResizeObserver === 'function') ? new ResizeObserver((list) => list.forEach((en) => {
      if (!en.target.isConnected) { blurSizeObs.unobserve(en.target); en.target.__bwObs = false; return; }
      const w = Math.round(Math.max(en.contentRect.width, en.contentRect.height));
      if (w > 0) en.target.style.setProperty('--bw', w + 'px');
    })) : null;
    // A blurred element outside a grid tile (full screen, a face on a shared
    // screen, the lobby preview) gets its own --bw; a grid tile's comes from
    // makeTile's observer and is inherited by its video and letter.
    function blurSized(el) {
      if (!el || !blurSizeObs || el.__bwObs) return;
      el.__bwObs = true;
      try { blurSizeObs.observe(el); } catch (e) {}
    }
    // FACE-BEGIN (page-guards one-face: the only block of the page that writes a face's blur)
    // ONEFACE: the one writer of a face's blur. lv = { bl, text } (the core's faceLevel). kind: 'tile' (a tile's video:
    // --bw comes from makeTile's observer, the float rule from the PiP sweep), 'pic' (a picture layer: the class only),
    // 'box' (a co-presenter's box on a shared screen, the lobby preview: the class, sized on its own resize), or none (any other face: --bw
    // now and on resize, no raw browser float). A blurred picture is at full strength from its first frame; a share keeps
    // its text clear through the viewer's own filter (textclear.js) when lv.text. A face already at its level is left
    // alone (no class churn, no layout read on a repaint).
    function faceApply(el, lv, kind) {
      if (!el || !el.classList) return 0;
      const bl = (lv && lv.bl) | 0, tc = kind !== 'pic' && kind !== 'box' && !!(bl && lv.text);
      const had = el.classList.contains('blur2') ? 2 : el.classList.contains('blur1') ? 1 : 0;
      const own = kind !== 'pic' && kind !== 'box';   // the kinds that carry the text overlay
      if (had === bl && (!own || el.classList.contains('tcx') === tc) && (kind || el.disablePictureInPicture === !!bl)) return bl;
      if (own) { try { if (GifOS.textClear) GifOS.textClear.view(el, tc); } catch (e) {} }
      if (had !== bl) { el.classList.remove('blur1', 'blur2'); if (bl) el.classList.add('blur' + bl); }
      if (kind === 'box' && bl) { try { blurSized(el); } catch (e) {} }
      if (kind) return bl;
      if (bl) {
        try { const bw = Math.round(Math.max(el.offsetWidth || 0, el.offsetHeight || 0)); if (bw > 0) el.style.setProperty('--bw', bw + 'px'); } catch (e) {}
        try { blurSized(el); } catch (e) {}
      }
      try { el.disablePictureInPicture = !!bl; } catch (e) {}
      return bl;
    }
    // A face drawn from its subject: the level is the core's (faceLevel), never the caller's. Returns the level drawn.
    function facePaint(el, subj, kind) { return faceApply(el, (0, /*()*/__C.faceLevel)(subj), kind); }
    // FACE-END
    // Canvas blur that works EVERYWHERE. ctx.filter='blur()' is unsupported in
    // Safari/WebKit (iOS), where it silently no-ops — so the baked-in self-blur
    // canvas drew the RAW camera and your self-view was never blurry. Detect it
    // once; where it's missing, approximate the blur by downscaling to a tiny
    // scratch canvas and scaling back up (bilinear interpolation ≈ blur).
    const ctxFilterOK = (() => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 12;
        const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 12, 12);
        x.filter = 'blur(3px)'; x.fillStyle = '#fff'; x.fillRect(4, 4, 4, 4); x.filter = 'none';
        return x.getImageData(2, 2, 1, 1).data[0] > 8; // white bled outward → filter applies
      } catch (e) { return false; }
    })();
    yield 743;
    // frac: the blur's Gaussian sigma as a fraction of the drawn width dw, so
    // the look is the same at every picture size and on every engine (Nathan,
    // 2026-11-15: blur depends on picture size). blurSenderFrac and
    // blurViewFrac hold the room's numbers (GifOS.timings).
    function blurDraw(ctx, src, dx, dy, dw, dh, frac) {
      if (ctxFilterOK) { ctx.filter = 'blur(' + blurPx(frac, dw) + 'px)'; ctx.drawImage(src, dx, dy, dw, dh); ctx.filter = 'none'; return; }
      // iOS/WebKit has no ctx.filter. A single big downscale→upscale looks BLOCKY
      // (like a bad connection). Build a mip pyramid instead: halve the image
      // repeatedly (each bilinear step averages neighbours ≈ one Gaussian pass)
      // down to a tiny bottom, then double back up. Because every step is
      // bilinear and the final stretch expands an already-smooth gradient, the
      // result reads as a real Gaussian blur, not fat pixels. The bottom width
      // 'tPx' is the master knob: smaller bottom = stronger AND smoother blur.
      // It is set from the same fraction as the filter path: measured, the
      // pyramid's sigma is BLUR_PYRAMID_K / tPx of the width (blurPyramidBottom).
      const tPx = blurPyramidBottom(frac), rPx = 96; // bottom width; resume width for final stretch
      const asp = dh / dw;
      const tW = Math.max(2, Math.round(tPx)), tH = Math.max(2, Math.round(tPx * asp));
      const rW = Math.max(tW, Math.round(rPx)), rH = Math.max(tH, Math.round(rPx * asp));
      let a = __V.blurA, actx = __V.blurActx, b = __V.blurB, bctx = __V.blurBctx;
      let w = Math.max(tW, dw >> 1), h = Math.max(tH, dh >> 1);
      a.width = w; a.height = h; actx.imageSmoothingEnabled = true; actx.drawImage(src, 0, 0, w, h);
      while (w > tW || h > tH) {                     // halve down to the tiny bottom
        const nw = Math.max(tW, Math.round(w / 2)), nh = Math.max(tH, Math.round(h / 2));
        b.width = nw; b.height = nh; bctx.imageSmoothingEnabled = true; bctx.drawImage(a, 0, 0, w, h, 0, 0, nw, nh);
        const tc = a; a = b; b = tc; const tx = actx; actx = bctx; bctx = tx; // swap ping-pong
        w = nw; h = nh;
      }
      while (w < rW || h < rH) {                     // double back up to the resume width
        const nw = Math.min(rW, w * 2), nh = Math.min(rH, h * 2);
        b.width = nw; b.height = nh; bctx.imageSmoothingEnabled = true; bctx.drawImage(a, 0, 0, w, h, 0, 0, nw, nh);
        const tc = a; a = b; b = tc; const tx = actx; actx = bctx; bctx = tx;
        w = nw; h = nh;
      }
      ctx.imageSmoothingEnabled = true; ctx.drawImage(a, 0, 0, w, h, dx, dy, dw, dh);
    }

    // STAGE-BLUR-GOVERNOR
    // THE PAINT GOVERNOR, as a rule of its own. A paint may start when the
    // rung's frame budget has passed since the last one STARTED and the
    // painter has rested twice the AVERAGE paint cost since the last one
    // ENDED — so painting never takes more than about a third of the main
    // thread, the reason the governor exists (a 4-minute wedge, 95% drawImage).
    // Two things it no longer does. It read the LAST paint's cost, so one slow
    // paint ruled alone: on a loaded ARM stager one drawImage took 7.8 s, the
    // governor then dropped every frame for 3 x 7.8 = 23 s, the canvas that IS
    // the outbound camera went still, its encoder ran at 0 fps and every
    // receiver of the Stage froze (e2e-pipe-freeze, 2026-10-07: 12.8-15 s
    // without a paint while frame callbacks kept arriving). And the rest is
    // capped at BLUR_REST_MAX_MS: however slow the box, the canvas gets a new
    // frame about once a second, well inside the 12 s freeze bound. For a
    // steady paint cost under 500 ms the schedule is the one it always was.
    const BLUR_REST_MAX_MS = GifOS.timings.BLUR_REST_MAX_MS;
    function blurPaintDue(gov, now, budget) {
      if (now - gov.start < budget) return false;
      return now - gov.end >= Math.min(2 * gov.avg, BLUR_REST_MAX_MS);
    }
    function blurPaintDone(gov, start, end) {
      const cost = Math.max(0, end - start);
      // A stall longer than the rest cap counts as the cap: one 7.8 s paint
      // must not keep the painter at one frame a second for the next ten.
      const c = Math.min(cost, BLUR_REST_MAX_MS);
      gov.avg = gov.n ? gov.avg * 0.7 + c * 0.3 : c;
      gov.n = (gov.n || 0) + 1; gov.start = start; gov.end = end; gov.cost = cost;
    }
    // END-STAGE-BLUR-GOVERNOR
    // STAGE-BLUR-FRAME
    function noteBlurFrame(pipe, drew) {
      if (!pipe) return null;
      if (drew) { pipe.painted = (pipe.painted || 0) + 1; pipe.failed = 0; return null; }
      pipe.failed = (pipe.failed || 0) + 1;
      return pipe.failed === 3 ? 'blurpipe:draw-failed' : null;
    }
    // END-STAGE-BLUR-FRAME
    let blurPipe = null; // { level, src(video), canvas, ctx, track, unsub, rvfc }
    function stopBlurPipe() {
      if (!blurPipe) return;
      if (blurPipe.unsub) blurPipe.unsub();
      if (blurPipe.rvfc && blurPipe.src.cancelVideoFrameCallback) { try { blurPipe.src.cancelVideoFrameCallback(blurPipe.rvfc); } catch (e) {} }
      try { blurPipe.src.srcObject = null; } catch (e) {}
      try { blurPipe.src.remove(); } catch (e) {}
      // Stop the pipe's PRIVATE clone only — never the shared camera track.
      if (blurPipe.cloned && blurPipe.srcTrack) { try { blurPipe.srcTrack.stop(); } catch (e) {} }
      if (blurPipe.tc) { try { blurPipe.tc.stop(); } catch (e) {} }
      try { blurPipe.track.stop(); } catch (e) {}
      if (!blurPipe.screen && GifOS.meetBgfx) GifOS.meetBgfx.release();   // the background model hands the processor back
      blurPipe.dead = true; // its paint loop and callbacks end with it (a pipe checks its own flag, never which slot is current)
      blurPipe = null;
    }
    // A SHARE FROM THE ROW KEEPS THE CAMERA, so the screen and the camera can
    // both need the blur canvas at once. The screen gets a pipe of its own in
    // this slot: startBlurPipe and stopBlurPipe run on it while it is swapped
    // into blurPipe, and everything else that reads blurPipe keeps the camera's.
    let scrPipe = null;
    function withScrPipe(fn) {
      const cam = blurPipe; blurPipe = scrPipe;
      try { return fn(); } finally { scrPipe = blurPipe; blurPipe = cam; }
    }
    function blurPipeTune(level) {
      // Level 0 runs only for a sender crop or stage frame on a clear camera.
      return { level: level, frac: blurSenderFrac(level), capW: level >= 2 ? 320 : level === 1 ? 480 : 640 };
    }
    function blurPipeCanReuse(pipe, camId) {
      return !!(pipe && pipe.camId === camId && pipe.track && pipe.track.readyState === 'live');
    }
    // source: a screen share's track. A share is blurred by the same rule as a
    // camera (blurLevelFor), through this same pipe; it takes no sender crop.
    // text: TEXT STAYS CLEAR (Nathan 2026-11-26), a share's blur that keeps plain text readable: the shipped canvas is the
    // blurred frame plus an overlay of cells the filter checked and re-inked itself (js/core/media/textclear.js, its
    // sender()), never the raw frame. A share under any blur (text or full) ships about 2 frames a second.
    function startBlurPipe(level, source, text) {
      const cam = source || (__C.localStream && __C.localStream.getVideoTracks()[0]);
      if (!cam) return null;
      const tcOn = !!(source && text && GifOS.textClear);
      if (blurPipeCanReuse(blurPipe, cam.id) && !!blurPipe.text === tcOn) {
        const tune = blurPipeTune(level);
        blurPipe.level = tune.level;
        blurPipe.frac = tune.frac;
        blurPipe.capW = tune.capW;
        return blurPipe.track;
      }
      stopBlurPipe();
      // Feed the pipe its OWN clone of the camera track. Safari (iOS especially)
      // will not render the same MediaStreamTrack in two <video> elements at
      // once — the self-preview already holds the original, so sharing it makes
      // one of the two go black. A clone is an independent sink of the same
      // camera.
      let srcTrack = cam, cloned = false;
      try { srcTrack = (0, /*()*/__C.capClone)(cam); cloned = true; } catch (e) { srcTrack = cam; }
      const src = document.createElement('video');
      src.muted = true; src.defaultMuted = true; src.autoplay = true;
      src.setAttribute('muted', ''); src.setAttribute('playsinline', ''); src.setAttribute('autoplay', '');
      // iOS Safari will NOT decode/advance a <video> that is outside the render
      // tree (a detached element, or display:none) — it paints one frame and
      // freezes, so the captured canvas broadcasts a still image to everyone.
      // Keep the source in the DOM but effectively invisible.
      src.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';
      src.srcObject = new MediaStream([srcTrack]);
      document.body.appendChild(src);
      startLocalView(src, srcTrack, 0); // the pipe paints from this element: it must start too
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const tune = blurPipeTune(level);
      const pipe = { level: tune.level, frac: tune.frac, capW: tune.capW, camId: cam.id, screen: !!source, text: tcOn, src, srcTrack, cloned, canvas, ctx, track: null, unsub: null, rvfc: 0, painted: 0 };
      if (tcOn) {
        pipe.tc = GifOS.textClear.sender({ src: src, canvas: canvas, ctx: ctx, capLong: GifOS.textClear.SIZES[0], blurCap: () => pipe.capW, track: () => pipe.track,
          align: typeof __C.WK_H264_BLIND !== 'undefined' && !!__C.WK_H264_BLIND,
          blur: (x, s, w, h) => blurDraw(x, s, 0, 0, w, h, pipe.frac) });
      }
      // ADAPTIVE FRAME-DROP: paint is driven by BOTH the metronome and rVFC,
      // and on a software-rendered / overloaded device one filtered drawImage
      // can cost 100ms+. Without a governor the paint tasks queue FASTER than
      // they complete and the main thread's task queue grows into a MINUTES-
      // long backlog — everything (offers, mesh ticks, UI) stalls behind it
      // (found by CPU profile: 95% drawImage during a 4-minute wedge). So:
      // never spend more than ~1/3 of wall time painting — the AVERAGE paint
      // cost sets the rest after each paint, capped at a second so one slow
      // paint cannot still the camera (blurPaintDue, STAGE-BLUR-GOVERNOR).
      const gov = { start: -1e9, end: -1e9, avg: 0, n: 0, cost: 0 };
      // Blur DESTROYS detail — painting and encoding it at capture size is
      // pure heat. Cap the canvas at 480w (light) / 320w (heavy); receivers
      // stretch the tile and a stretched blur is indistinguishable from a
      // full-size one, while paint cost drops ~4-9x and the encoder's input
      // pixels ~4x. The blur radius scales with the downscale so the LOOK is
      // unchanged. Matters doubly because blurred-by-default is the privacy
      // steady state: outside a fully-consented password room this pipe IS
      // the camera path (a phone died on its charger running it full-size).
      const paint = () => {
        const now = performance.now();
        // PAINT NO FASTER THAN WE SEND (2026-07-30 power work). The floor was a
        // flat 66ms (15fps) regardless of what the encoder was actually
        // allowed to emit — but adapt() caps the sender at the rung's fps, now
        // as low as 10 (144p) or 12 (180p), so on a phone we were running an
        // expensive canvas FILTER on frames that were then dropped before they
        // ever reached the wire. Blur is the DEFAULT on phones, so this is the
        // camera path, not an edge case. Track the live rung; never go faster
        // than 15fps, never slower than 8 (a visibly stuttery self-view is its
        // own bug), and the cost-based governor below still rules on a weak
        // device.
        if (pipe.tc) {   // text stays clear: the filter's own tick paints (and ships) the frame
          let drew = false; try { drew = pipe.tc.tick(); } catch (e) { drew = false; }
          if (drew) { pipe.painted = (pipe.painted || 0) + 1; pipe.failed = 0; pipe.lastPaintAt = Date.now(); }
          return;
        }
        const rf = (__C.lastQ && __C.lastQ.fps) || 15;
        // A blurred share ships at the text filter's tick (about 2 a second), whatever blur it wears (Nathan 2026-11-26).
        const budget = pipe.screen ? GifOS.timings.TEXTCLEAR_TICK_MS : Math.max(66, 1000 / Math.min(15, Math.max(8, rf)));
        if (!blurPaintDue(gov, now, budget)) return; // drop the frame
        // The frame ships at the CAMERA'S OWN shape — no crop, no transpose
        // (the 2026-08-01 canvas center-crop was reverted: stacked on the
        // camera pipeline's own cropping it double-zoomed a face; the camera
        // already rotates with the device on every phone).
        // A WEBKIT SENDER SHIPS ALIGNED FRAMES OF ONE SIZE (WK_H264_BLIND, the
        // WebKit that sends VP8). Measured 2026-10-22 between two such seats:
        // a receiver decoding a 261-wide VP8 picture crashed its web process
        // (4/4; 256-wide 0/4), and an encoder whose canvas changed size after
        // the first frame never encoded again. So this pipe paints nothing
        // until the camera's own shape is known (no placeholder-sized first
        // frame) and rounds the canvas to 16 columns and 2 rows.
        const wkAlign = typeof __C.WK_H264_BLIND !== 'undefined' && __C.WK_H264_BLIND;
        if (wkAlign && !(src.videoWidth > 0 && src.videoHeight > 0)) return;
        const sw = src.videoWidth || 640, sh = src.videoHeight || 480;
        // CAP THE LONG SIDE, NOT THE WIDTH (2026-07-31, measured). capW was
        // applied to width alone, which silently assumed a landscape source.
        // A phone held upright hands this pipe 320x568, width is already <=
        // capW, nothing is scaled, and the canvas we blur, captureStream and
        // ENCODE is 181,760 px — 3.2x the 57,600 the rung budgeted. The
        // encoder census caught it: res "320x568@6" while sitting on 180p.
        // Because this canvas IS the outbound track whenever blur is on — and
        // blur is the privacy steady state on phones — adapt()'s camera
        // constraints never reach the encoder at all; THIS is the size that
        // ships. Scaling by the long side gives 180x320: same pixel budget the
        // rung always meant, ~3.2x less to blur, paint, encode and send.
        const long = Math.max(sw, sh), sc = Math.min(1, pipe.capW / Math.max(1, long));
        let w = Math.max(2, Math.round(sw * sc)), h = Math.max(2, Math.round(sh * sc));
        // Sender crop: the canvas is the chosen square; the whole frame is
        // drawn offset and scaled so that square lands on it.
        let ox = 0, oy = 0, dw = w, dh = h;
        const sCrop = pipe.screen ? null : senderCrop(), sFrame = pipe.screen ? null : stageFrame();
        if (sFrame) {
          // The Stage frame: any aspect, the long side capped like the rest.
          const rw = sFrame.w * sw, rh = sFrame.h * sh;
          const k = Math.min(1, pipe.capW / Math.max(1, rw, rh));
          w = Math.max(2, Math.round(rw * k)); h = Math.max(2, Math.round(rh * k));
          ox = -(sFrame.x * sw - rw / 2) * k; oy = -(sFrame.y * sh - rh / 2) * k; dw = sw * k; dh = sh * k;
        } else if (sCrop && GifOS.meetZones) {
          const r = GifOS.meetZones.cropRect(sw, sh, sCrop);
          const side = Math.max(2, Math.round(Math.min(r.side, pipe.capW)));
          const k = side / Math.max(1, r.side);
          w = h = side; ox = -r.sx * k; oy = -r.sy * k; dw = sw * k; dh = sh * k;
        }
        if (wkAlign) { w = Math.max(16, Math.round(w / 16) * 16); h = Math.max(2, Math.round(h / 2) * 2); }
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        let drew = false;
        // A BACKGROUND EFFECT (js/meet-bgfx.js) paints the camera frame over the chosen
        // background, and the privacy blur then covers the whole composite exactly as it
        // covers a plain frame (the same sigma on the shipped picture's long side).
        if (!pipe.screen && GifOS.meetBgfx) {
          try { drew = GifOS.meetBgfx.paint(ctx, src, { ox: ox, oy: oy, dw: dw, dh: dh, w: w, h: h, privacyFrac: pipe.level > 0 ? pipe.frac * Math.max(w, h) / Math.max(1, w) : 0, blurDraw: blurDraw }); } catch (e) { drew = false; }
        }
        if (!drew) try {
          // The fraction is of the SHIPPED picture's long side: a crop or a
          // stage frame draws the camera wider than the canvas (dw).
          if (pipe.level > 0) blurDraw(ctx, src, ox, oy, dw, dh, pipe.frac * Math.max(w, h) / Math.max(1, dw));
          else ctx.drawImage(src, ox, oy, dw, dh);
          drew = true;
        } catch (e) {}
        // painted counts a frame that was DRAWN. A throw used to increment
        // first, so blackCamWatch read a dead pipe as frames flowing.
        const why = noteBlurFrame(pipe, drew);
        if (why && !pipe.screen) regrabCamera(why);
        blurPaintDone(gov, now, performance.now());
        pipe.cost = gov.cost; pipe.lastPaintAt = Date.now();
      };
      // Draw on every DECODED camera frame when the browser supports it (the
      // correct, smooth path on iOS/Safari) — and ALSO on the worker metronome,
      // which keeps ticking when the tab is hidden and main-thread timers are
      // clamped (a backgrounded phone used to broadcast a near-frozen blur).
      const onFrame = () => { if (pipe.dead) return; pipe.rvfcN = (pipe.rvfcN || 0) + 1; paint(); if (src.requestVideoFrameCallback) pipe.rvfc = src.requestVideoFrameCallback(onFrame); };
      // The source never stays paused. Chrome pauses every playing <video>
      // when it resumes a tab it froze in the background (a phone after an
      // app switch). A paused source brings no frame callbacks, and while the
      // tab is visible nothing else paints, so the room would get the last
      // frame for good while the camera runs.
      const keepPlaying = () => { if (!pipe.dead && src.paused && src.srcObject) src.play().catch(() => {}); };
      src.addEventListener('pause', keepPlaying);
      src.play().catch(() => {});
      let stream = canvas.captureStream(pipe.tc ? 0 : 15);
      pipe.track = stream.getVideoTracks()[0];
      // The text filter ships exactly the frames it paints (requestFrame); a browser without it gets the tick's rate.
      if (pipe.tc && !(pipe.track && typeof pipe.track.requestFrame === 'function')) {
        try { pipe.track.stop(); } catch (e) {}
        stream = canvas.captureStream(1000 / GifOS.timings.TEXTCLEAR_TICK_MS); pipe.track = stream.getVideoTracks()[0];
      }
      blurPipe = pipe;
      if (src.requestVideoFrameCallback) pipe.rvfc = src.requestVideoFrameCallback(onFrame);
      // DON'T PAY FOR THE SECOND DRIVER WHILE THE FIRST ONE WORKS (2026-07-31).
      // The metronome is here for ONE reason: a hidden tab's main-thread timers
      // are clamped and rVFC stops delivering, so a backgrounded phone would
      // broadcast a near-frozen blur. While the tab is VISIBLE and rVFC is
      // driving, every metronome tick is a redundant wakeup into a paint() that
      // the frame governor almost always drops on entry — 15 wakeups/sec on the
      // camera path, which on a phone IS the default path because blur is the
      // privacy steady state. Keep the subscription (re-subscribing on every
      // visibility flip is its own churn) and make the callback cheap instead.
      // Where rVFC is absent (older WebKit) the metronome is the ONLY driver
      // and must keep painting unconditionally.
      // …and UNSUBSCRIBE, not just return early. metroSub's own teardown
      // terminates the Worker once the last subscriber leaves, precisely
      // because "a subscriber-less 15Hz tick would otherwise spin forever,
      // denying the SoC its deep-idle states". Staying subscribed and
      // returning early keeps that Worker alive and ticking 15x/s — it saves
      // the paint but not the WAKEUP, and the wakeup is the part that blocks
      // deep idle. While visible with rVFC driving we drop the subscription
      // entirely, so with blur on and no recording the Worker is GONE. It
      // comes back on the visibility flip, which is a human action — rare
      // enough that the churn is free.
      // A still screen (a slide, a document) brings rVFC no new frames, so the
      // metronome keeps painting a shared screen whatever the tab state.
      const rvfcDrives = !!src.requestVideoFrameCallback && !pipe.screen;
      const tick = () => { if (!pipe.dead) { pipe.metroN = (pipe.metroN || 0) + 1; paint(); } };
      let metroOff = null;
      const syncMetro = () => {
        if (pipe.dead) return;
        keepPlaying();
        if (!rvfcDrives || document.hidden) { if (!metroOff) metroOff = metroSub(tick); }
        else if (metroOff) { metroOff(); metroOff = null; }
      };
      syncMetro();
      document.addEventListener('visibilitychange', syncMetro);
      pipe.unsub = () => {
        document.removeEventListener('visibilitychange', syncMetro);
        src.removeEventListener('pause', keepPlaying);
        if (metroOff) { metroOff(); metroOff = null; }
      };
      // A camera grabbed again feeds this same canvas, so the track the room
      // receives never ends (and a staged feed keeps its id). Until the new
      // camera paints, the canvas holds the last frame.
      pipe.swapSource = (cam2) => {
        if (pipe.dead) return false;
        let t2 = cam2, c2 = false;
        try { t2 = (0, /*()*/__C.capClone)(cam2); c2 = true; } catch (e) { t2 = cam2; }
        if (pipe.rvfc && src.cancelVideoFrameCallback) { try { src.cancelVideoFrameCallback(pipe.rvfc); } catch (e) {} }
        if (pipe.cloned && pipe.srcTrack) { try { pipe.srcTrack.stop(); } catch (e) {} }
        pipe.srcTrack = t2; pipe.cloned = c2; pipe.camId = cam2.id; pipe.failed = 0;
        src.srcObject = new MediaStream([t2]);
        src.play().catch(() => {});
        if (src.requestVideoFrameCallback) pipe.rvfc = src.requestVideoFrameCallback(onFrame);
        return true;
      };
      paint();
      return pipe.track;
    }
    // CAMERA OFF SENDS NO VIDEO. A seat whose camera is off is a card: every viewer draws it itself, the person's
    // avatar still (sent once on the data channel at the sender's blur, painted under the room's blur) or the initial,
    // crisp. AVATAR_W/H and avatarSharp size the local letter canvas a QA peer and the picture-in-picture card still use.
    const AVATAR_W = 640, AVATAR_H = 360;
    let avatarSharp = null;
    yield 758;
    // A LOCAL PICTURE MUST START. These tracks are canvas streams made on this
    // page (my sent picture, the letter cards). WebKit now and then leaves a
    // muted <video> on a canvas stream at readyState 0 for good, whether it was
    // bound before the canvas painted or after: a black self view, and the
    // black-camera watch then restarted a working camera. A fresh wrapper of
    // the same track starts it. Look again shortly after each bind, a few
    // times, while the element still shows that track and has no frames.
    function startLocalView(video, track, n) {
      setTimeout(() => {
        const s = video.srcObject;
        if (!s || typeof s.getVideoTracks !== 'function' || s.getVideoTracks()[0] !== track) return; // rebound since
        if (video.videoWidth > 0 || track.readyState !== 'live') return;
        video.srcObject = new MediaStream([track]);
        const pr = video.play(); if (pr && pr.catch) pr.catch(() => {});
        if (track.requestFrame) { try { track.requestFrame(); } catch (e) {} }
        if (n < 3) startLocalView(video, track, n + 1);
      }, 700 * (n + 1));
    }
    yield 760;
    // A dark seat's tile shows no video: its card (the .avatar layer: the avatar still under the receiver's blur, or
    // the initial, never blurred) is the picture, on my own tile too. A seat with a picture plays its own stream: the
    // direct one, or the one a friend carries while the direct pair is down (relayVia); the dead direct stream must
    // never replace a carried picture. Held (not verified, or ejected) shows no stream at all (who-attest).
    function syncAvatarFeed(id, t, isMe, st, gCam) {
      if (!t || !t.video) return;
      const blockedShare = !isMe && typeof __C.shareBlocked === 'function' && !!(0, /*()*/__C.shareBlocked)(id);
      const held = !isMe && !!__C.turnLinks && (GifOS.meetTurn.pausedBy(Array.from(__C.turnFacts.values()), __C.myId, id) || (__C.turnLinks.isLink(id) && !__C.turnLinks.standby(id) && !__C.turnLinks.video(id)));   // the same test as turnPaint's note
      const dark = !!((0, /*()*/__C.rowFaceDark)(st) || gCam || blockedShare || held);
      if (isMe) {
        let vt = null;
        try { vt = sentVideoTrack(); } catch (e) {}
        if (vt && !dark) (0, /*()*/__V.showAvatarTrack)(t.video, () => new MediaStream([vt]), vt);
        else if (t.video.srcObject) t.video.srcObject = null;
        return;
      }
      const unverified = typeof __C.mediaOk === 'function' && (0, /*()*/__C.mediaOk)(id) === false;
      if (dark || unverified) { if (t.video.srcObject) t.video.srcObject = null; return; }
      const own = (t.relayed && (__C.relayVia.get(id) || {}).stream) || t.stream;
      const tr = own && own.getVideoTracks && own.getVideoTracks()[0];
      if (tr && !tileHolds(t.video, own)) playTileVideo(t.video, own);
    }
    // The video track to actually SEND: the strongest blur that applies to me
    // — my own setting, a group-blur targeted at me, or the room's guest blur
    // — is baked into the broadcast pixels at the source. "Blurred" is never
    // viewer-side cosmetics alone: what leaves this browser is already blurry.
    // 0.9.23b sender crop: { x, y, s } in the camera frame (meet-zones.js),
    // or null for the default centered square. Kept per device.
    const SENDER_CROP_KEY = 'meet.crop.v1.self';
    let senderCropVal = null;
    try { const c = JSON.parse(localStorage.getItem(SENDER_CROP_KEY) || 'null'); if (c && typeof c === 'object') senderCropVal = c; } catch (e) {}
    yield 767;
    function senderCrop() {
      const MZ = typeof GifOS !== 'undefined' && GifOS.meetZones;
      if (!senderCropVal || !MZ || MZ.isDefault(senderCropVal)) return null;
      if ((0, /*()*/__C.meOnStage)()) return null;
      return senderCropVal;
    }
    // { x, y, w, h }: the centre and the size of the Stage frame as shares
    // of the camera's width and height. null = the whole frame.
    const STAGE_FRAME_KEY = 'meet.frame.v1.stage';
    let stageFrameVal = null;
    try { const f = JSON.parse(localStorage.getItem(STAGE_FRAME_KEY) || 'null'); if (f && typeof f === 'object') stageFrameVal = f; } catch (e) {}
    function normStageFrame(f) {
      if (!f) return null;
      const w = Math.min(1, Math.max(0.2, +f.w || 1)), h = Math.min(1, Math.max(0.2, +f.h || 1));
      const x = Math.min(1 - w / 2, Math.max(w / 2, f.x != null ? +f.x : 0.5));
      const y = Math.min(1 - h / 2, Math.max(h / 2, f.y != null ? +f.y : 0.5));
      return (w > 0.995 && h > 0.995) ? null : { x: x, y: y, w: w, h: h };
    }
    function stageFrame() { return (0, /*()*/__C.meOnStage)() ? normStageFrame(stageFrameVal) : null; }
    function setStageFrame(f) {
      stageFrameVal = normStageFrame(f);
      try { if (stageFrameVal) localStorage.setItem(STAGE_FRAME_KEY, JSON.stringify(stageFrameVal)); else localStorage.removeItem(STAGE_FRAME_KEY); } catch (e) {}
      try { refreshOutbound(); } catch (e) {}
    }
    window.__stageFrame = { get: () => stageFrameVal, set: setStageFrame, onStage: __C.meOnStage };
    function setSenderCrop(c) {
      const MZ = typeof GifOS !== 'undefined' && GifOS.meetZones;
      senderCropVal = c && MZ && !MZ.isDefault(c) ? { x: +c.x, y: +c.y, s: +c.s } : null;
      try { if (senderCropVal) localStorage.setItem(SENDER_CROP_KEY, JSON.stringify(senderCropVal)); else localStorage.removeItem(SENDER_CROP_KEY); } catch (e) {}
      try { refreshOutbound(); } catch (e) {}
    }
    window.__senderCrop = { get: () => senderCropVal, set: setSenderCrop };
    function sentVideoTrack() {
      // The source is the core's choice (mainVideoChoice: the media plan's capture section); this builds that track:
      // the raw track, the blur pipe over it, or the avatar. A pipe that cannot run returns null: nothing leaves,
      // never the raw clip or screen.
      const c = (0, /*()*/__C.mainVideoChoice)();
      if (c.src === 'none') { try { stopBlurPipe(); } catch (e) {} return null; }
      if (c.src === 'rebroadcast') {
        const rbv = __C.rbNow.v;
        if (c.blur > 0) return startBlurPipe(c.blur, rbv);
        stopBlurPipe();
        return rbv;
      }
      if (!c.rowShare) withScrPipe(stopBlurPipe);
      if (c.src === 'own-screen') {
        const scr = __C.screenStream.getVideoTracks()[0];
        if (c.blur > 0) return startBlurPipe(c.blur, scr, c.text);
        stopBlurPipe();
        return scr;
      }
      if (c.src === 'card') { stopBlurPipe(); return null; }   // camera off: no picture leaves
      const cam = __C.localStream.getVideoTracks()[0];
      // A background effect (js/meet-bgfx.js) rides the same canvas; the camera's own
      // background blur, where the platform has one, needs no canvas.
      const BG = GifOS.meetBgfx;
      if (BG && !sentVideoTrack.bgfx) {
        sentVideoTrack.bgfx = true;
        BG.configure({ power: () => __C.powNow, shed: () => (__C.meshNode && __C.meshNode.raw ? __C.meshNode.raw.lgLvl : 0) });
        BG.onChange(() => { try { refreshOutbound(); } catch (e) {} });
      }
      if (BG) BG.nativeSync(cam);
      const fx = !!(BG && BG.wants());
      // A sender crop (0.9.23b) rides the same canvas: everyone gets the square I chose.
      if ((c.blur > 0 || !!senderCrop() || !!stageFrame() || fx) && !__C.myStatus.camOff) return startBlurPipe(c.blur) || cam;
      stopBlurPipe();
      return cam;
    }
    // What my Stage feed shows. A share from the Row sends the screen there
    // (blurred by the same rule as any share, through its own pipe) while
    // sentVideoTrack keeps the camera on the Row; otherwise the two are one.
    function stageVideoTrack() {
      const c = (0, /*()*/__C.stageVideoChoice)();   // the core's choice (the media plan's capture section)
      if (c.src === 'main') return sentVideoTrack();
      if (c.src === 'none') return null;
      const scr = __C.screenStream.getVideoTracks()[0];
      if (c.blur > 0) return withScrPipe(() => startBlurPipe(c.blur, scr, c.text)); // null if the pipe cannot run: never the raw screen
      withScrPipe(stopBlurPipe);
      return scr;
    }
    // CAMERA OFF STOPS THE CAMERA. A merely-disabled track keeps the sensor
    // open: the camera light stays on while the page says camera off (a
    // privacy fault), and the ISP keeps capturing black frames (a few hundred
    // mW on a phone). As soon as camOff holds, stop the hardware track and REMOVE it from
    // localStream (removal — not just stop — keeps reviveCamera's ended-track
    // check from re-grabbing on tab return). The Camera button's lateMedia
    // path re-grabs on demand (~half a second); the blur pipe dies with its
    // source and rebuilds on regrab. Armed/disarmed via refreshOutbound, which
    // every camOff transition already runs through.
    let camIdleT = null;
    function reactCamIdle() {
      if (!__C.myStatus.camOff) { if (camIdleT) { clearTimeout(camIdleT); camIdleT = null; } return; }
      if (camIdleT) return;
      // A timer of 0, not a stop inside this call: a step that turns the camera
      // back on in the same task (a boot restoring its choice, a joined tap)
      // lands first, and then camOff no longer holds.
      camIdleT = setTimeout(() => {
        camIdleT = null;
        if (!__C.myStatus.camOff || !__C.localStream) return;
        const vt = __C.localStream.getVideoTracks()[0];
        if (!vt) return;
        try { vt.stop(); } catch (e) {}
        try { __C.localStream.removeTrack(vt); } catch (e) {}
        stopBlurPipe();
        refreshOutbound(); // mains park on the now-null track; senders stay negotiated
      }, 0);
    }
    // THE VOICE MY MAIN AUDIO SENDERS CARRY. Normally the mic. While a meeting
    // bot speaks it is the speech track instead, and every path that seats a
    // main audio sender (this refresh, a new pair, a late attach, a re-seat
    // after a rollback) reads it here. Seated once by hand, the next refresh
    // put the muted mic back a second or two into the line: everyone heard
    // the start of what the bot said, a newcomer heard none of it, and the
    // bot's tile never lit.
    var botVoiceTrack = null; // var: refreshOutbound is hoisted and may run before this line
    var carryVoiceTrack = null; // var, as above: my mic and the voice of the page I carry, mixed (docs/turn-carry.md)
    function mainAudioTrack() {
      if (botVoiceTrack && botVoiceTrack.readyState === 'live') return botVoiceTrack;
      if (typeof carryVoiceTrack !== 'undefined' && carryVoiceTrack && carryVoiceTrack.readyState === 'live') return carryVoiceTrack;
      return (__C.localStream && __C.localStream.getAudioTracks()[0]) || null;
    }
    yield 785;
    // THE DUTY SENDERS, READ FOR THE PLAN'S REPORT: the track my job for that duty slot ('sdm' | 'sub' | 'sgs') to that peer
    // carries now, or null (no job, a parked job, a sender with no live track). Read only: the jobs stay reconcileMosaic's.
    function dutyTrack(pid, slot) {
      const job = __C.mosJobs.get(slot + '>' + pid);
      if (!job || !job.active) return null;
      for (const sd of job.senders || []) { const t = sd && sd.track; if (t && t.readyState !== 'ended') return t; }
      return null;
    }
    // THE PLANE'S SIDE OF THE MEDIA PLAN (outboundPlan in the core decides; this carries it out on the browser's senders).
    function refreshOutbound() {
      // The viewer's Max blur follows the room's clear right (blurViewFrac); CSS reads the same number.
      let strong = false; try { strong = !!(0, /*()*/__C.clearNoPwMode)(); } catch (e) { strong = false; }
      if (strong !== !!blurViewFrac.strong) {
        blurViewFrac.strong = strong;
        try { document.documentElement.style.setProperty('--blur-view-max', String(strong ? BLUR_MAX_FRAC : BLUR_VIEW_MAX_FRAC)); } catch (e) {}
      }
      if (typeof __C.outgoingHeld !== 'undefined' && __C.outgoingHeld) return;
      const plan = (0, /*()*/__C.outboundPlan)();
      if (plan.hold) return;
      // Viewers do not ride the row. Stepping off the stage in Meet restores
      // the main senders; in a broadcast that restore would publish a person
      // the host just demoted. Park and leave.
      const kick = (p) => { if (p.dc && p.dc.readyState === 'open') compKick(p.id); else (0, /*()*/__C.renegotiate)(p); };
      if (plan.park === 'viewer') {
        if (camIdleT) { clearTimeout(camIdleT); camIdleT = null; }
        (0, /*()*/__C.reconcileMain)(plan, null, null, kick, dutyTrack);   // parks every main sender, opens none
        return;
      }
      reactCamIdle();
      // Promoted to the Stage: open my window on the Stage frame, once per step-up.
      // The frame is the camera's. A screen share also puts its sharer on the
      // Stage, and that step-up opens nothing: the slide already carries Stop
      // sharing, and a window over it hid what was being shared.
      const stagedNow = (0, /*()*/__C.meOnStage)();
      if (stagedNow && !refreshOutbound.wasStaged && refreshOutbound.seatedAt && Date.now() - refreshOutbound.seatedAt > 3000 && __C.meTile && __C.meTile.tile && !__C.myStatus.camOff && !__C.myStatus.scr) {
        setTimeout(() => {
          try {
            if (!window.__tileWin || window.__tileWin.isOpen() || __C.myStatus.scr || __C.screenStream) return;
            const st = document.querySelector('#stagefeed [data-row="sgs"]');
            window.__tileWin.open(st && st.getClientRects().length ? st : __C.meTile.tile);
          } catch (e) {}
        }, 1200);
      }
      if (!refreshOutbound.seatedAt && __C.myId) refreshOutbound.seatedAt = Date.now();
      refreshOutbound.wasStaged = stagedNow;
      const vt = sentVideoTrack();
      // Your self-view shows EXACTLY the track you broadcast (raw or blurred).
      // One WYSIWYG source means the preview never becomes a second <video>
      // element fighting the camera track — the mobile-browser failure that
      // froze/blanked either the preview or the outbound when they diverged.
      // 0.9.23b: my shared screen is on the Stage, so my Row tile shows my
      // face on top of it: a local-only <video class="selfcam">. meTile.video
      // stays the broadcast track, because the Stage composite reads it.
      if (__C.meTile && __C.meTile.tile) {
        let camT = null;
        if (__C.myStatus.scr && !__C.myStatus.camOff && __C.localStream && !(0, /*()*/__C.shareOnlyStage)('me')) {
          const c = __C.localStream.getVideoTracks()[0];
          if (c && c.readyState === 'live' && c !== vt) camT = c;
        }
        let sc = __C.meTile.tile.querySelector(':scope > video.selfcam');
        if (camT) {
          if (!sc) {
            sc = document.createElement('video');
            sc.className = 'selfcam'; sc.muted = true; sc.autoplay = true; sc.playsInline = true;
            __C.meTile.video.insertAdjacentElement('afterend', sc);
          }
          if (!sc.srcObject || sc.srcObject.getVideoTracks()[0] !== camT) {
            sc.srcObject = new MediaStream([camT]);
            const pr = sc.play(); if (pr && pr.catch) pr.catch(() => {});
          }
        } else if (sc) { try { sc.srcObject = null; } catch (e) {} sc.remove(); }
      }
      if (__C.meTile && vt) {
        const cur = __C.meTile.video.srcObject;
        if (!cur || cur.getVideoTracks()[0] !== vt) {
          __C.meTile.video.srcObject = new MediaStream([vt]);
          const pr = __C.meTile.video.play(); if (pr && pr.catch) pr.catch(() => {});
          startLocalView(__C.meTile.video, vt, 0);
        }
      }
      // MAIN senders only (p.mainV / p.mainA: aux senders carry other people's media and are never touched here), by
      // the core's one reconcile (reconcileMain): this plane gives it the picture and voice it made and its kick.
      (0, /*()*/__C.reconcileMain)(plan, vt, mainAudioTrack(), kick, dutyTrack);   // duty slots: read off my mosaic jobs
      adapt(); // re-apply bitrate/resolution to the (possibly new) sender track
    }
    // Stage membership is DERIVED (the gossiped stageIds set), so the
    // sender-side reaction rides the same 2s beat as everything else — and the
    // step-up/step-down click for immediacy. Idempotent: it only acts when the
    // staged bit actually flips.
    let stagedSelfWas = false;
    yield 795;
    function shownPeerCount() {
      // A tile is not a person until a frame arrives. The birth stamp on
      // lastHeard does not count. A heard peer who goes quiet keeps the
      // stamp, so the tile stays in the count until it leaves.
      const frameHeard = (q) => {
        if (!q) return false;
        const stq = __C.statusOf.get(q.id);
        if (stq && stq.rx && stq.rx > (q.bornAt || 0)) return true; // a status heard before this pair was born is not a frame on it
        if (q.meshRxAt || q.dcRxAt) return true;
        const born = q.bornAt || 0, lh = q.lastHeard || 0;
        return born ? lh > born : lh > 0;
      };
      let n = 0;
      for (const p of __C.peers.values()) if (p && !p.headless && p.tile && p.tile.parentNode && frameHeard(p)) n++;
      if (typeof __C.rosterTiles === 'object' && __C.rosterTiles) for (const t of __C.rosterTiles.values()) if (t && t.parentNode) n++; // a held "Reconnecting…" face was heard before the hold
      return n;
    }
    yield 800;
    // Faces the page itself has put on screen (me, plus each real peer tile).
    // A cloned tile is not a person and is not in this set. The header uses
    // this so the count matches the room you can see; it never gates quality.
    function facesOnScreen() {
      let n = 0;
      const seen = new Set();
      // Same hearing rule as shownPeerCount: a visible tile of a seat that
      // never sent a frame is not a face. Hiding is not the rule.
      const frameHeard = (q) => {
        if (!q) return false;
        const stq = __C.statusOf.get(q.id);
        if (stq && stq.rx && stq.rx > (q.bornAt || 0)) return true; // a status heard before this pair was born is not a frame on it
        if (q.meshRxAt || q.dcRxAt) return true;
        const born = q.bornAt || 0, lh = q.lastHeard || 0;
        return born ? lh > born : lh > 0;
      };
      const take = (id, el) => {
        if (!id || seen.has(id) || !el || !el.isConnected || el.style.display === 'none') return;
        seen.add(id);
        n++;
      };
      try { if (__C.meTile && __C.meTile.tile) take('me', __C.meTile.tile); } catch (e) {}
      for (const [pid, p] of __C.peers) {
        if (p && !p.headless && !frameHeard(p)) continue;
        take(pid, p && p.tile);
      }
      if (typeof __C.rosterTiles === 'object' && __C.rosterTiles) for (const [pid, t] of __C.rosterTiles) take(pid, t); // a held "Reconnecting…" face is on screen
      return n;
    }
    yield 805; // { charging, level } from the Battery API, or null where there is none
    const drainState = { losing: false, last: null, falls: 0, trip: null };
    yield 807;
    function powerUpdate() {
      const was = __C.powNow.level;
      __C.powNow = __C.MP.level({ mobile: __C.IS_MOBILE, battery: __C.battNow, losing: drainState.losing, parked: __C.idleNow });
      __C.powDials = __C.MP.dials(__C.powNow.level);
      return was !== __C.powNow.level;
    }
    if (navigator.getBattery) navigator.getBattery().then((b) => {
      const upd = () => {
        const tripped = __C.MP.drainStep(drainState, !!b.charging, b.level);
        const wasCharging = __C.battNow ? __C.battNow.charging : null;
        __C.battNow = { charging: !!b.charging, level: b.level };
        powerUpdate();
        adapt();
        if (tripped) (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stPluggedInButTheBattery', '🔋 Plugged in, but the battery is falling. Sending lighter video.'));
        else if (wasCharging !== __C.battNow.charging && !(wasCharging === null && __C.battNow.charging)) (0, /*()*/__C.setStatus)(__C.battNow.charging ? '🔌 On power — full video quality restored.'
          : '🔋 On battery — sending lighter video to stretch it (' + Math.round(b.level * 100) + '%).');
      };
      b.onchargingchange = upd; b.onlevelchange = upd; upd();
    }).catch(() => {});
    powerUpdate();
    function setParked(on) { __C.idleNow = !!on; powerUpdate(); adapt(); }
    // PARKED PHONE: minutes with no touch and no speech means nobody is
    // holding this phone — release the wake lock (the pinned-on screen is
    // 1-2W, the single biggest burner of a parked phone's night) and floor
    // the send quality. Any touch, word, or return restores everything.
    const IDLE_MS = GifOS.timings.IDLE_MS; // (lastActive/idleNow live beside wakeLock — keepAwake runs before this block)
    function poke() {
      __C.lastActive = Date.now();
      if (__C.idleNow) { setParked(false); keepAwake(); }
    }
    addEventListener('pointerdown', poke, { passive: true });
    addEventListener('keydown', poke);
    // A PLAYER'S THUMB IS INSIDE THE APP, AND THIS PAGE CANNOT SEE IT.
    // DOM events do not cross a document boundary, so every touch on a running
    // app lands in the app's own iframe and none of it reaches the two
    // listeners above. Three minutes of that and the clock below calls a phone
    // PARKED — "nobody is holding this phone" — while somebody is holding it
    // and playing. Measured 2026-08-17, mid-deathmatch on a real phone: "😴
    // Phone looks parked — letting the screen rest", wake lock released and
    // send quality floored, on a device whose owner had not put it down.
    //
    // The shim already pings us on interaction (runtime.js, `uiactive` — it
    // exists so the Back trap can arm under fresh activation); it just had
    // nobody listening for it here. It is throttled to one message per 20s at
    // the source, so this is cheap.
    //
    // TRUSTED, WITH THE LIMIT STATED: an app that lied — pinging with nobody
    // there — could hold a phone out of its parked state. That is a smaller
    // power than the one it already has (an app that renders every frame burns
    // the same battery), and the ping only counts while this document is
    // VISIBLE, so it cannot reach through a screen that has gone off. Only the
    // MOUNTED app's frame is believed; any other window posting this is ignored.
    addEventListener('message', (e) => {
      if (!e.data || e.data.ns !== 'gifos' || e.data.type !== 'uiactive') return;
      if (document.hidden) return;
      const mount = document.getElementById('appmount');
      if (!mount) return;
      for (const f of mount.querySelectorAll('iframe')) {
        if (f.contentWindow === e.source) { poke(); return; }
      }
    });
    function videoIsPlaying(v) {
      return !!(v && v.srcObject && !v.paused && v.readyState >= 2 && (v.videoWidth || 0) > 0);
    }
    // THE COMPOSITES ARE CANVAS STREAMS. The stage strip and the stadium
    // mosaic are painted by a packer (MM.createPacker) at compFps whether or
    // not any camera inside them is on, so their <video> reads as playing
    // while every face in them is a camera-off black. Within one section
    // every seat's status reaches me (the same gossip roomConsentIds trusts),
    // so a composite is watchable only while some other seat reports a
    // camera on or a screen share. Past one section statuses reach only
    // section-mates and the frames are the only evidence, so there a playing
    // composite is believed.
    function compositeShowsLiveFace() {
      if ((0, /*()*/__C.roomPastSection)()) return true;
      for (const [pid, st] of __C.statusOf) {
        if (pid === __C.myId || !(0, /*()*/__C.stHold)(pid)) continue;
        if ((0, /*()*/__C.seatDark)(st) || (0, /*()*/__C.forcedCamOff)(pid) || (typeof __C.shareBlocked === 'function' && (0, /*()*/__C.shareBlocked)(pid))) continue;
        return true;
      }
      return false;
    }
    function viewerWatching() {
      if (document.hidden) return false;
      try {
        let comp = false;
        if (typeof __V.stagefeedEl !== 'undefined' && __V.stagefeedEl) {
          for (const v of __V.stagefeedEl.querySelectorAll('video')) if (videoIsPlaying(v)) { comp = true; break; }
        }
        if (!comp && typeof __V.stadiumEl !== 'undefined' && __V.stadiumEl) {
          const sd = __V.stadiumEl.querySelector('video');
          if (videoIsPlaying(sd)) comp = true;
        }
        if (comp && compositeShowsLiveFace()) return true;
      } catch (e) {}
      if (typeof __C.peers === 'undefined' || !__C.peers) return false;
      for (const p of __C.peers.values()) {
        if (!p || !p.video) continue;
        if (p.tile && (p.tile.style.display === 'none' || (p.tile.classList && p.tile.classList.contains('cam-off')))) continue;
        if (p.video.style && p.video.style.display === 'none') continue;
        if (videoIsPlaying(p.video)) return true;
      }
      return false;
    }
    setInterval(() => {
      // A playing stage, stadium, or remote tile means someone is watching.
      // Do not park under that. A cam-off tile does not count: audio-only
      // is the default, and a live audio track would never release the lock.
      const idle = __C.IS_MOBILE && !viewerWatching() && Date.now() - __C.lastActive > IDLE_MS;
      if (idle === __C.idleNow) return;
      setParked(idle);
      if (idle) {
        try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {}
        (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stPhoneLooksParkedLettingThe', '😴 Phone looks parked — letting the screen rest. Tap for full quality.'));
      } else keepAwake();
    }, 10000);
    // (No orientation listener, deliberately — nothing here reacts to rotation.
    // The camera pipeline rotates the capture itself; reacting on top of it is
    // how the 2026-08-01 flip-cycling regression happened. See adapt().)
    // TUNE overrides (the phone power-tuning sweep, 2026-07-29): knob sets the
    // harness applies per run — localStorage gifos_tune = '{"shift":1,
    // "fps":15,"aux":500,"kbps":300}' (or window.GIFOS_TUNE). Absent = exactly
    // the shipped behavior. A measurement surface, not product policy:
    // findings graduate into LADDER/tier law with power JSONL attached.
    function tuneCfg() {
      try { const t = window.GIFOS_TUNE || JSON.parse(localStorage.getItem('gifos_tune') || 'null'); return t && typeof t === 'object' ? t : null; } catch (e) { return null; }
    }
    function adapt() {
      const n = Math.max(2, 1 + __C.peers.size);
      // A MANUAL video-quality choice (Settings) replaces the auto selection —
      // room size, power level and tune all step aside; blur caps still apply.
      const manual = (0, /*()*/__C.vqRung)();
      let q = manual || (0, /*()*/__C.rung)(n);
      const tune = tuneCfg();
      // The power level's camera dial: steps down the ladder (each rung has its own fps).
      // A phone saves even on its charger: a phone's meeting load is close to
      // what a USB charger gives, so full-rung video loses to it plugged in.
      if (!manual && __C.powDials.rungShift) q = __C.LADDER[Math.min(__C.LADDER.indexOf(q) + __C.powDials.rungShift, __C.LADDER.length - 1)];
      // BLUR IS ALREADY A BLUR — DON'T PAY FOR FRAMES (Nathan, 2026-07-30).
      // A blurred feed has deliberately destroyed its spatial detail, so
      // spending 15-30 fps preserving TEMPORAL detail is paying to transmit
      // information the user chose to hide. Low frame rate is itself a kind of
      // blur, and it is the honest one: it costs less on the encoder, the
      // radio, and every receiver's decoder. This also makes the privacy model
      // coherent — "No blur" stops being only a consent to reveal your face
      // and becomes, visibly, a choice to spend more power.
      // Applies to what we SEND; the blur pipe's own paint budget follows the
      // rung's fps, so the expensive canvas filter slows down with it.
      const myBlurLvl = (() => { try { return __C.myStatus.camOff ? 0 : ((0, /*()*/__C.blurLevelFor)('me') | 0); } catch (e) { return 0; } })();
      if (myBlurLvl > 0) {
        const cap = myBlurLvl >= 2 ? 8 : 12;   // Max blur ⇒ 8fps, Min blur ⇒ 12fps
        if (q.fps > cap) q = Object.assign({}, q, { fps: cap });
      }
      if (tune && !manual) {
        if (tune.shift) q = __C.LADDER[Math.min(__C.LADDER.indexOf(q) + (+tune.shift || 0), __C.LADDER.length - 1)];
        if (tune.fps && q.fps > +tune.fps) q = Object.assign({}, q, { fps: +tune.fps });
        if (tune.kbps && q.kbps > +tune.kbps) q = Object.assign({}, q, { kbps: +tune.kbps });
      }
      const track = __C.localStream && __C.localStream.getVideoTracks()[0];
      // SKIP-IF-UNCHANGED, and this one is not a micro-optimisation: re-applying
      // constraints can make the browser RECONFIGURE THE CAPTURE PIPELINE —
      // sensor mode, ISP scaler, buffer pool — and the sender-side maxBitrate
      // below has skipped no-ops for exactly this kind of reason since the
      // renderer-killing CHECK. adapt() runs on every connect, every sweep,
      // every battery/visibility/idle event, and in a settled room asks for the
      // rung it is already on every single time. Only touch the camera when the
      // numbers actually move; `trackQ` follows the TRACK, so a regrab (flip
      // camera, revive) clears it and the next adapt() re-applies in full.
      // ASK THE RUNG LITERALLY. NEVER TRANSPOSE. NEVER REACT TO ORIENTATION.
      // (2026-08-01, after a three-round regression — the full story:)
      // The 2026-07-31 pixel-budget work added a transpose here — ask 180x320
      // on a portrait device — because a portrait camera answers a literal
      // landscape ask with its own portrait frame (320x568) and blows the rung
      // budget 3.2x. The transpose was read back from track.getSettings(): a
      // feedback loop — the self-view flipped orientation every ~2s. Three
      // fixes were layered on (viewport-sourced transpose; a transposed
      // getUserMedia ask + corrective re-grab; a canvas center-crop), and each
      // broke a different device: Chromium satisfies a TRANSPOSED constraint on
      // a landscape capture BY CENTER-CROPPING — a zoomed-in face; some
      // cameras answer a transposed gUM ask with UNROTATED sensor frames — a
      // sideways room; mid-call re-grabs froze the self-view for seconds; and
      // stacking our crop on the camera's own crop double-zoomed. Meanwhile
      // the pre-07-31 behavior had worked on every device, because EVERY
      // phone's camera pipeline already rotates the capture with the device.
      // The frame's shape belongs to the camera. We only size it.
      // So: literal rung ask (soft ideals — a portrait pipeline answers with
      // its portrait shape at full FOV, exactly what the user expects), and
      // the pixel budget is enforced where it always truly mattered: the blur
      // pipe caps by the LONG side (the 07-31 fix that stands), and blur is
      // the phone's steady state. The raw path may spend up to ~3.2x the rung
      // on a portrait phone — the accepted price of never fighting the camera.
      const ckey = q.w + 'x' + q.h + '@' + q.fps;
      // A rejected applyConstraints used to clear trackQ.t, so the next
      // adapt() asked again. Back off 30s. A rung change retries at once.
      // OverconstrainedError drops the frameRate cap and tries once more.
      if (track && constraintDue(trackQ, track, ckey, Date.now())) {
        trackQ.t = track;
        trackQ.k = ckey;
        trackQ.failK = ckey;
        trackQ.failedAt = Date.now();
        const fpsAsk = { width: { ideal: q.w }, height: { ideal: q.h }, frameRate: { max: q.fps } };
        const whAsk = { width: { ideal: q.w }, height: { ideal: q.h } };
        const ask = trackQ.noFps === ckey ? whAsk : fpsAsk;
        let pending;
        try { pending = track.applyConstraints(ask); } catch (e) { pending = Promise.reject(e); }
        Promise.resolve(pending).then(() => {
          if (trackQ.t !== track || trackQ.k !== ckey) return;
          trackQ.failK = '';
          trackQ.failedAt = 0;
          if (ask === fpsAsk) trackQ.noFps = '';
        }, (err) => {
          if (trackQ.t !== track || trackQ.k !== ckey) return;
          if (err && err.name === 'OverconstrainedError' && trackQ.noFps !== ckey) {
            trackQ.noFps = ckey;
            let again;
            try { again = track.applyConstraints(whAsk); } catch (e2) { again = Promise.reject(e2); }
            Promise.resolve(again).then(() => {
              if (trackQ.t !== track || trackQ.k !== ckey) return;
              trackQ.failK = '';
              trackQ.failedAt = 0;
            }, () => {
              if (trackQ.t !== track || trackQ.k !== ckey) return;
              trackQ.failK = ckey;
              trackQ.failedAt = Date.now();
            });
            return;
          }
          trackQ.failK = ckey;
          trackQ.failedAt = Date.now();
        });
      }
      // ONCE per sweep, not once per sender: stageCeilingKbps walks the roster
      // through participantCount(), and adapt() runs on every connect and every
      // sweep — evaluating it inside the sender loop is quadratic in a big room.
      const stageBudget = Math.round((0, /*()*/__C.stageCeilingKbps)() * __C.powDials.stageKbps) * 1000;   // the power level's Stage/screen budget dial
      try { encTune(); } catch (e) {}   // my Stage's one encoder takes the same lane budget
      // MY OWN screen rides the MAIN row-mesh senders, because a share is a
      // source swap and not a second channel (sentVideoTrack) — so those
      // senders are carrying a document while still being budgeted from `q`,
      // MY CAMERA'S rung. That is the whole bug: a 1080p desktop handed a
      // 3-person room's 450k face budget is scaled to mush by the encoder
      // before it ever leaves. Screens get the screen lane.
      const myScreen = !!(__C.myStatus.scr && __C.screenStream && __C.screenStream.getVideoTracks()[0]);
      const screenBudget = Math.round((0, /*()*/__C.screenCeilingKbps)() * __C.powDials.stageKbps) * 1000;
      // And the same question one hop out: is the thing this node is FORWARDING
      // on the Stage a screen? Gossip already says so on every heartbeat (`scr`),
      // so a forwarder does not have to inspect pixels to know not to squeeze it.
      const screenOnStage = (0, /*()*/__C.stageIds)().some(__C.sharingScreen);
      for (const p of __C.peers.values()) {
        for (const sender of p.pc.getSenders()) {
          if (!sender.track || sender.track.kind !== 'video') continue;
          const prm = sender.getParameters();
          // A sender whose media channel isn't (or is no longer) negotiated
          // reports ZERO encodings. Fabricating one and calling setParameters
          // hits a Chromium FATAL (rtp_sender.cc CHECK: current_parameters >=
          // init_parameters) that kills the WHOLE renderer — reproduced by a
          // blur toggle while staged (the stg re-ship renegotiates aux
          // m-lines right as adapt() sweeps). Skip it; the next adapt() (every
          // connect + every sweep) catches it once negotiation lands.
          if (!prm.encodings || !prm.encodings.length) continue;
          // Carried media (folds, forwards, relay jobs) is budgeted by the
          // FOLD constants, not the per-face rung — a million-pixel fold at
          // the rung's floor would be soup.
          // Composite ships are packed low-detail — 0.9Mbps not 2.5; and a
          // BLURRED main feed has no detail at all — 250kbps paints it fully
          // (the rung's 800k+ on blur was pure radio+encoder waste).
          // (keyed on the sender IDENTITY, not sender.track — replaceTrack is
          // async, so the track pointer lags the toggle by a beat)
          const blurred = !!blurPipe && sender === p.mainV;
          const auxBudget = (tune && tune.aux ? +tune.aux * 1000 : 900000);
          // THE STAGE HAS ITS OWN LANE, and it is deliberately NOT budgeted from
          // `q` — q is MY camera rung, which says what my own face is worth on
          // this device, and has nothing whatever to do with the picture I am
          // FORWARDING for someone else. Budgeting a forward from q is how one
          // 144p phone in the middle of the tree would starve every seat below
          // it. The ceiling is the room's; the stager's own choice then flows
          // through it untouched, because maxBitrate is a CAP, not a target —
          // a stager who picks 720p simply never reaches a 3500k ceiling, while
          // one who deliberately picked 1080p is no longer squeezed to 900k.
          // That is "stage quality follows the person on the stage", with the
          // room type as the "within reason".
          // The low power level still trims it: a phone forwarding the stage is
          // still a phone, and low is the state where it has already decided
          // that frames and pixels are what it is spending.
          const isStageSd = __C.stageSenders.has(sender), isAuxSd = __C.auxSenders.has(sender);
          let want = isStageSd ? (screenOnStage ? Math.max(stageBudget, screenBudget) : stageBudget)
            : isAuxSd ? auxBudget
            : (myScreen ? screenBudget : blurred ? Math.min(q.kbps, 250) * 1000 : q.kbps * 1000);
          // A BUDGET ALONE DOES NOT KEEP THE PIXELS. Under the platform default
          // ('balanced') an encoder that cannot hold the frame rate buys it by
          // scaling the frame down — correct for a face, fatal for text. The
          // track's contentHint says this at the source, but only the sharer's
          // own senders ever see that track: every forwarded copy is a fresh
          // carrier track with no hint on it, so the preference is set here,
          // per sender, where the room already knows from `scr` what it is
          // carrying. Restored to 'balanced' the moment the share ends.
          const carriesScreen = isStageSd ? screenOnStage : (!isAuxSd && myScreen);
          const wantDeg = carriesScreen ? 'maintain-resolution' : 'balanced';
          const degNow = degOf.has(sender) ? degOf.get(sender) : (prm.degradationPreference || 'balanced');
          const lowOn = !(__C.lowSenders.has(sender) && __C.meshNode && __C.meshNode.raw && __C.meshNode.raw.lgLvl >= 2);   // L29.1: level 2 stops the low-priority forwards' pictures
          // TURN.13: on a TURN link whose server throttles, video takes the step the link's measured capacity leaves
          // (js/meet-turn.js throttlePlan): a lower cap, then a smaller picture, then fewer frames (the pause is the gate).
          const tst = __C.turnLinks ? __C.turnLinks.videoStep(p.id) : null;
          // the step is the LINK's: the pictures on its pc (a pipe's composite and my camera) share it
          if (tst) { let nv = 0; for (const x of p.pc.getSenders()) if (x.track && x.track.kind === 'video') nv++; want = Math.min(want, Math.round(tst.maxBitrate / Math.max(1, nv))); }
          const wantScale = tst ? tst.scale : (turnScaled.has(sender) ? 1 : null), wantFps = tst ? tst.fps : null;
          const enc0 = prm.encodings[0];
          const stepSame = wantScale == null || ((enc0.scaleResolutionDownBy || 1) === wantScale && (wantFps == null ? !turnScaled.has(sender) || enc0.maxFramerate == null : enc0.maxFramerate === wantFps));
          if (enc0.maxBitrate === want && degNow === wantDeg && enc0.active !== false === lowOn && stepSame) continue; // already set — and a no-op setParameters can still race a sender teardown into the renderer-killing CHECK above, so only touch what must change
          prm.encodings[0].maxBitrate = want;
          prm.encodings[0].active = lowOn;
          if (wantScale != null) {
            enc0.scaleResolutionDownBy = wantScale;
            if (wantFps != null) enc0.maxFramerate = wantFps; else delete enc0.maxFramerate;
            if (tst) turnScaled.add(sender); else turnScaled.delete(sender);
          }
          prm.degradationPreference = wantDeg;
          degOf.set(sender, wantDeg);
          sender.setParameters(prm).catch(() => {});
        }
      }
      (0, /*()*/__C.updateStatus)();
      __C.lastQ = q;
      return q;
    }
    yield 823; // the rung adapt() last applied — harness verification surface
    // The degradationPreference adapt() last applied per sender. Read back from
    // getParameters is not dependable (a browser may simply not echo it), and a
    // value that always looks unset would re-write every sender every sweep —
    // the setParameters storm the skip-if-unchanged rule above exists to avoid.
    const degOf = new WeakMap();
    const turnScaled = new WeakSet();   // senders a TURN.13 step resized: set back to full size once the step lifts
    function constraintDue(q, track, ckey, now) {
      if (!track) return false;
      const same = q.t === track && q.k === ckey;
      if (q.failK === ckey && q.t === track && (now - (q.failedAt || 0) < 30000)) return false;
      if (same && q.failK !== ckey) return false;
      return true;
    }
    const trackQ = { t: null, k: '', failK: '', failedAt: 0, noFps: '' };
    yield 843;
    // A broadcast viewer with nothing on air: the
    // Stage says whether it has not started, when it starts (with a
    // countdown), or that it has ended. "Ended" is the host's one gossiped
    // flag, the schedule, or this tab having seen company and now alone.
    // The stage feed shows a picture (a row tile on #stagefeed).
    function stageFeedShows() { return !!document.querySelector('#stagefeed .rowtile'); }
    yield 1305;   // read at load: the boot rewrites the hash later
    // MEM SAMPLES (DEBUG only): every 30 s one small record of what this page holds, so a long room shows what only grows.
    // JS heap (performance.memory where it exists), mesh/pc maps, pipe-worker queues, media element tracks, pcs by state.
    // It never calls into a live RTCPeerConnection (no getSenders/getReceivers) and never wraps Worker: suspected in a 40-page room whose renderers crashed (rtp_sender CHECK).
    // Own ring (window.__memSamples, 240 records = 2 h), plus one MEM line in the mesh trace so it rides the participant's trace file. Numbers only: no ids, no names.
    // The page's media elements, counted for the DEBUG memory sample: how many, how many hold a stream, their tracks
    // and the live ones.
    function mediaElCensus() {
      const els = document.querySelectorAll('video,audio'); let withStream = 0, tracks = 0, liveTracks = 0;
      for (const el of els) { const ms = el.srcObject; if (ms && ms.getTracks) { withStream++; for (const t of ms.getTracks()) { tracks++; if (t.readyState === 'live') liveTracks++; } } }
      return { mediaEls: els.length, elStreams: withStream, elTracks: tracks, elLiveTracks: liveTracks };
    }
    yield 1526;

    // ---- which camera: front or back (the standard mobile flip) -------------
    // facingMode is an IDEAL, so desktops with one webcam are unaffected.
    // Every join starts on the front camera (0.9.26.21): a flip lasts for the
    // meeting it was made in and is not kept (a back camera at the next join
    // surprised people). The flip button only appears when the hardware
    // actually has a second camera (see maybeShowFlip).
    let camFacing = 'user';
    // THE CAMERA PICKER's state: this device's cameras (one row each) and the
    // person's pick ('' = the facing choice above decides). A pick asks for
    // that camera exactly; the flip button goes back to facing.
    let camInputs = [], camDeviceId = '';
    // A PHONE'S CAMERAS ARE FRONT AND BACK, NOT A LIST (0.9.26.21). A phone
    // lists every lens as its own camera (both Motos: 'camera 1, facing front',
    // 'camera 3, facing front', 'camera 2, facing back', 'camera 0, facing
    // back'), which means nothing to the person holding it. Where any camera
    // says which way it faces (getCapabilities().facingMode, or a label that
    // names front or back), the camera pop-up has no camera list: video opens
    // on the facing choice above (the front camera) and Flip in More switches.
    // A computer's webcams name no facing, so two of them stay a list.
    let camPhone = false;
    const CAM_FACING_LABEL = /\bfacing (front|back)\b|\b(front|back|rear)\b.*\bcamera\b|\bcamera\b.*\b(front|back|rear)\b/i;
    function camsHaveFacing(list) {
      for (const d of list || []) {
        if (!d || d.kind !== 'videoinput') continue;
        let caps = null;
        try { caps = typeof d.getCapabilities === 'function' ? d.getCapabilities() : null; } catch (e) {}
        const fm = caps && caps.facingMode;
        if ((Array.isArray(fm) ? fm : (fm ? [fm] : [])).some((f) => f === 'user' || f === 'environment')) return true;
        if (CAM_FACING_LABEL.test(String(d.label || ''))) return true;
      }
      return false;
    }
    // DO NOT COMMAND THE CAMERA'S ORIENTATION (2026-08-01, learned twice).
    // A transposed getUserMedia ask (720x1280 on an upright phone) was tried
    // and REVERTED same-day: some devices satisfy a portrait ask by delivering
    // UNROTATED sensor frames — the room shows up sideways (seen live on a
    // 3-device room), which is strictly worse than a wrong-shaped frame. And a
    // mid-call corrective re-grab restarts the sensor — multi-second self-view
    // freezes. The universally-safe ask is the plain landscape 16:9 every
    // WebRTC app uses; browsers that rotate for the device do it themselves.
    // The frame SHAPE is normalized where we own the pixels instead: the
    // canvas pipe center-crops to the device orientation (see paint()/
    // sentVideoTrack) — no camera reconfiguration, no device quirks, ever.
    function camVideoConstraints() {
      // A manual video-quality rung (Settings) shapes the CAPTURE ask too —
      // 1080p can only come out of a camera that was asked for 1080p.
      const m = (0, /*()*/__C.vqRung)();
      const c = { width: { ideal: m ? m.w : 1280 }, height: { ideal: m ? m.h : 720 }, facingMode: { ideal: camFacing } };
      if (camDeviceId) c.deviceId = { exact: camDeviceId };
      return c;
    }
    let flipChecked = false;
    yield 1534;
    // A phone should offer flip before the camera permission dialog. Desktops
    // still wait until enumerateDevices reports a second camera.
    function phoneWantsFlip() {
      try {
        return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 900px)').matches;
      } catch (e) { return false; }
    }
    function maybeShowFlip() {
      if (phoneWantsFlip()) (0, /*()*/__V.showFlipButton)();
      if (flipChecked || !__C.localStream || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      flipChecked = true; // device labels are readable now that a stream was granted
      navigator.mediaDevices.enumerateDevices().then((ds) => {
        if (ds.filter((d) => d.kind === 'videoinput').length > 1) (0, /*()*/__V.showFlipButton)();
      }).catch(() => {});
    }
    maybeShowFlip();
    yield 1538;
    // One grab at a time. The watchdog and a return-to-the-tab can both notice
    // the same dead track; a second getUserMedia would mint a new stage id.
    let camGrabbing = false;
    function reviveCamera() {
      if (!__C.localStream || camGrabbing) return;
      const vt = __C.localStream.getVideoTracks()[0], at = __C.localStream.getAudioTracks()[0];
      if ((!vt || vt.readyState !== 'ended') && (!at || at.readyState !== 'ended')) return;
      const videoDead = !__C.myStatus.camOff && (!vt || vt.readyState === 'ended');
      if (videoDead) (0, /*()*/__V.showCamBack)(true);
      regrabCamera('reviveCamera:ended-track');
    }
    function regrabCamera(reason) {
      if (typeof __C.outgoingHeld !== 'undefined' && __C.outgoingHeld) return;
      if (__C.BC_SEAT && !(0, /*()*/__C.bcMayPublishAv)()) return;
      const death = !!(reason && (String(reason).indexOf('reviveCamera') === 0 || String(reason).indexOf('blackCamWatch') === 0));
      if (death) (0, /*()*/__V.showCamBack)(true);
      // A re-grab replaces BOTH tracks in localStream, which restarts the blur
      // pipe and so changes sentVideoTrack — which rebuilds mySelfStream's memo,
      // mints a new stg stream id, and re-ships the stage feed to everyone (and
      // cascades down the relay tree). It is therefore never cheap, and WHO asked
      // for it is the first question when the stage feed churns.
      try {
        if (!window.__regrabLog) window.__regrabLog = [];
        window.__regrabLog.push({ t: Date.now(), reason: reason || 'unknown', staged: (typeof __C.stageIds === 'function' ? (0, /*()*/__C.stageIds)().indexOf(__C.myId) >= 0 : null) });
        if (window.__regrabLog.length > 20) window.__regrabLog.shift();
      } catch (e) {}
      camGrabbing = true;
      const picked = reason === 'pickCam';
      // FLIP: many phones open one camera at a time (both Motos refuse the back
      // camera with NotReadableError while the front one is open, and the grab
      // below then fell back to sound only: no picture at all). So a flip lets
      // go of the current camera FIRST, and a facing that will not open goes
      // back to the front camera ('flipBack').
      const flip = reason === 'flip' || reason === 'flipBack';
      if (flip && __C.localStream) for (const old of __C.localStream.getVideoTracks()) { try { old.stop(); } catch (e) {} }
      // The blur pipe paints from its own clone of the camera, and a clone keeps
      // the camera open after the original stops: let go of that one too.
      if (flip && blurPipe && blurPipe.cloned && !blurPipe.screen && blurPipe.srcTrack) { try { blurPipe.srcTrack.stop(); } catch (e) {} }
      const flipFailed = () => {
        if (reason !== 'flip') return false;
        camFacing = 'user';
        camGrabbing = false;
        (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stCamPickFailed', 'That camera could not be opened. Your camera did not change.'));
        regrabCamera('flipBack');
        return true;
      };
      // The fresh mic is the person's picked one (ideal: an unplugged pick
      // must not cost the camera).
      gumWithMicFallback(navigator.mediaDevices, { video: camVideoConstraints(), audio: micDeviceId ? { deviceId: { ideal: micDeviceId } } : true })
        .then(({ stream: s }) => {
          if (flip && !s.getVideoTracks()[0] && reason === 'flip') { for (const t of s.getTracks()) { try { t.stop(); } catch (e) {} } flipFailed(); return; }
          camGrabbing = false;
          const nv = s.getVideoTracks()[0], na = s.getAudioTracks()[0];
          if (picked && nv) (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stCamOnNamed', 'Camera on: {name}').replace('{name}', camLabelOf(nv)));
          // fresh tracks come back live — restore the user's actual choices
          if (nv) nv.enabled = !__C.myStatus.camOff;
          if (na) na.enabled = !__C.myStatus.muted;
          // MAIN mic senders only: aux senders carry OTHER people's audio
          // (relay jobs, fold mixes) — never overwrite those with my mic. And
          // a PARKED sender (track null — I'm on stage) stays parked: the
          // fresh mic reaches the room via the 'stg:' aux feed instead
          // (mySelfStream picks it up on the next sweep).
          for (const p of __C.peers.values()) for (const sender of p.pc.getSenders()) {
            if (__C.auxSenders.has(sender)) continue;
            if (sender.track && sender.track.kind === 'audio' && na) sender.replaceTrack(na).catch(() => {});
          }
          // Mutate the SAME MediaStream rather than swapping it: its id is
          // what we announce as "our" stream (peers use it to tell own media
          // from friend-relayed media), so it must never change mid-meeting.
          for (const old of __C.localStream.getTracks()) { try { old.stop(); } catch (e) {} __C.localStream.removeTrack(old); }
          if (nv) __C.localStream.addTrack(nv);
          if (na) __C.localStream.addTrack(na);
          (0, /*()*/__C.meterFor)('me', __C.localStream);
          // The blur canvas reads the new camera in place; without one, fall
          // back to a fresh pipe.
          if (!(nv && blurPipe && blurPipe.track && blurPipe.track.readyState === 'live' && blurPipe.swapSource && blurPipe.swapSource(nv))) stopBlurPipe();
          refreshOutbound(); // rebuild the (blurred or raw) sender AND the WYSIWYG self-view
          if (death) (0, /*()*/__V.showCamBack)(false);
        }).catch(() => {
          if (flipFailed()) return;
          camGrabbing = false;
          if (death) (0, /*()*/__V.showCamBack)('fail');
          // A picked camera that would not open: back to the one that worked.
          if (picked) { camDeviceId = camPickPrev; (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stCamPickFailed', 'That camera could not be opened. Your camera did not change.')); }
        });
    }

    // Live-but-BLACK camera (iOS mostly: another app held the hardware, or
    // WebKit resumed the capture session wrong): the track stays 'live' but
    // reports muted (no frames) or delivers pure black pixels. Watch the
    // self-view while the camera is ON; if nothing comes through for ~3s,
    // re-grab — the exact fix people discover by hand ("close the tab and
    // come back in"), done automatically. Capped so a genuinely dark room
    // never loops the camera; a single bright frame refills the budget.
    (function blackCamWatch() {
      const probe = document.createElement('canvas');
      probe.width = 32; probe.height = 18;
      const pctx = probe.getContext('2d', { willReadFrequently: true });
      let darkTicks = 0, revives = 0, lastPainted = 0, endedTries = 0, tick = 0, viewKickAt = -99;
      // 0 = picture, 1 = dark, 2 = pure black, 3 = no frames. A dark room
      // still has sensor noise above 2; a camera that lost its frames paints
      // exact zeros.
      const dark = () => {
        const v = __C.meTile && __C.meTile.video;
        if (!v || !v.videoWidth) return 3; // no frames yet IS the symptom
        try {
          pctx.drawImage(v, 0, 0, 32, 18);
          const d = pctx.getImageData(0, 0, 32, 18).data;
          let top = 0;
          for (let i = 0; i < d.length; i += 4) {
            const m = Math.max(d[i], d[i + 1], d[i + 2]);
            if (m > 12) return 0;
            if (m > top) top = m;
          }
          return top <= 2 ? 2 : 1;
        } catch (e) { return 0; } // can't sample — assume fine, never loop
      };
      // Sample every second (a 32x18 read). An ended track is still tried on
      // the old 3s beat so three failed grabs take ~9s, not 3.
      setInterval(() => {
        if (!__C.localStream || __C.myStatus.camOff || document.hidden) return;
        const vt = __C.localStream.getVideoTracks()[0];
        tick++;
        // A phone can end the camera while this page stays in front: a call,
        // or another app that takes the lens. visibilitychange never fires,
        // so the return-to-the-tab path never runs. Say so on the next sample
        // and grab again. Three tries, then the fail line stays. A grab
        // already in flight is left alone.
        if (!vt || vt.readyState === 'ended') {
          if (vt && vt.readyState === 'ended' && !camGrabbing && endedTries < 3 && tick % 3 === 1) {
            endedTries++;
            reviveCamera();
          }
          return;
        }
        endedTries = 0;
        // JUDGE THE TRACK THAT ACTUALLY LEAVES THIS DEVICE. While the blur pipe
        // runs it feeds on its own CLONE of the camera (startBlurPipe clones so
        // the self-view can keep the original — Safari won't render one track in
        // two elements), and the original in localStream can then sit `muted`
        // simply because nothing consumes it. That is normal, not a black
        // camera. Reading `vt.muted` here made the watchdog "repair" a perfectly
        // healthy camera: measured on the stage lane, a stager re-grabbed ~12s
        // after stepping up with reason `blackCamWatch:track-muted` while
        // staged:true. A re-grab replaces BOTH tracks, which restarts the pipe,
        // changes sentVideoTrack, rebuilds mySelfStream's memo and mints a NEW
        // stg stream id — so every receiver's stage feed re-shipped and each
        // relayer cascaded the same change downstream, up to the 3-revive cap.
        // That is e2e-stage-onerow's "keeps ONE stream id" red, and it predates
        // 0.9.0 (0.8.8 fails it at the same rate).
        const judge = (blurPipe && blurPipe.srcTrack && blurPipe.srcTrack.readyState === 'live') ? blurPipe.srcTrack : vt;
        const painting = !!(blurPipe && blurPipe.painted > lastPainted);
        lastPainted = blurPipe ? blurPipe.painted : 0;
        // A phone that keeps the track "live" but sends no frames is the
        // common kill, and one that paints exact black is the other. Say so
        // on the tile at the first such sample. The re-grab waits until it
        // has lasted three more seconds, so a one-second hiccup is left
        // alone, and a dark room that is still painting does not flash the
        // line. A dim room that is still sending frames is a room, not a
        // dead camera: it never counts toward a re-grab.
        const silent = window.__gifosForceBlackCamHold === true || (judge.muted && !painting);
        // THE VIEW, NOT THE CAMERA. While the blur pipe paints from a camera
        // that has frames, a self view with no frames is a <video> that never
        // started on its bind, not a dead camera. WebKit leaves a muted
        // <video> on a canvas stream unstarted now and then, and a fresh bind
        // starts it. Re-bind the view (once every two seconds at most) and
        // never re-grab a working camera for it.
        const v = __C.meTile && __C.meTile.video;
        if (!silent && painting && blurPipe && blurPipe.src && blurPipe.src.videoWidth > 0 && v && v.srcObject && !v.videoWidth) {
          if (tick - viewKickAt >= 2) {
            viewKickAt = tick;
            const tracks = v.srcObject.getVideoTracks();
            if (tracks.length) { v.srcObject = new MediaStream(tracks); const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }
          }
          return;
        }
        const shade = silent ? 0 : dark();
        if (silent || shade >= 2) {
          if (silent || shade === 2) (0, /*()*/__V.showCamBack)(true);
          if (++darkTicks >= 4 && revives < 3) {
            darkTicks = 0; revives++;
            (0, /*()*/__C.sayState)('camRestart');
            regrabCamera('blackCamWatch:' + (silent ? 'track-muted' : 'dark-pixels'));
          }
        } else {
          if (darkTicks > 0) (0, /*()*/__V.showCamBack)(false);
          darkTicks = 0;
          if (!shade) revives = 0;
        }
      }, 1000);
    })();
    yield 1543;
    // devicechange also fires for a camera plug and for the label refresh
    // after the first grant. Neither is a new audio route. The mic restarts
    // only when an audioinput or audiooutput id appears or disappears, so
    // that refresh cannot drop a sing-mode request that lands during the grab.
    let audioDevKey = null;
    function audioDevKeyOf(list) {
      const ids = [];
      for (const d of list || []) {
        if (!d || (d.kind !== 'audioinput' && d.kind !== 'audiooutput')) continue;
        ids.push(d.kind + ':' + String(d.deviceId || ''));
      }
      ids.sort();
      return ids.join('\n');
    }
    // THE MIC PICKER's list: the microphones this device has, one row per
    // real input. Chromium also lists 'default' and 'communications', which
    // are other names for one of the same inputs, so they are not counted: a
    // computer with one mic has one row, and its mic button works as before.
    // micDeviceId is the person's pick ('' = the browser's own choice); a
    // pick that is unplugged is forgotten, so the next re-grab takes the
    // browser's choice again instead of failing on a missing device.
    let micInputs = [], micDeviceId = '';
    function devRowsOf(list, kind) {
      const out = [];
      for (const d of list || []) {
        if (!d || d.kind !== kind) continue;
        const id = String(d.deviceId || '');
        if (!id || id === 'default' || id === 'communications') continue;
        out.push({ id, label: String(d.label || ''), group: String(d.groupId || '') });
      }
      return out;
    }
    // THE MIC BUTTON WORKS LIKE THE CAMERA BUTTON: a tap while talking mutes
    // at once; a tap while muted asks which microphone only when there is a
    // REAL choice (more than one microphone), else it unmutes. So the count
    // must never be too high: a picker in the way of an unmute is the
    // 0.9.26.19 bug (both Motorolas stayed muted, no one heard them).
    // Counted as microphones: the listed inputs less 'default' and
    // 'communications' (devRowsOf). Chrome on Android lists the phone's ONE
    // built-in microphone as the call's sound routes ('Speakerphone',
    // 'Headset earpiece'); a plugged or paired mic shows as 'Wired headset',
    // 'Bluetooth headset' or 'USB audio' (Chromium's own English route names,
    // not translated, not documented). So on Android only a row named wired,
    // Bluetooth or USB is a separate microphone; every other row (the two
    // built-in routes, and any name we cannot tell) folds into one built-in
    // row. Elsewhere a row with no name (no permission yet) cannot be told
    // apart, so it counts as the same mic. When in doubt: one mic, unmute.
    // (groupId does not help on Android: the routes do not share one.)
    const MIC_SEPARATE = /wired|bluetooth|usb/i;
    function micInputsOf(list) {
      const rows = devRowsOf(list, 'audioinput');
      if (__C.IS_ANDROID) {
        const sep = rows.filter((r) => MIC_SEPARATE.test(r.label));
        const own = rows.filter((r) => !MIC_SEPARATE.test(r.label));
        const one = own.find((r) => r.label === 'Speakerphone') || own[0];
        return (one ? [one] : []).concat(sep);
      }
      const named = rows.filter((r) => r.label);
      return named.length ? named : rows.slice(0, 1);
    }
    // The picker's rows, the last-used microphone first (and checked), so one
    // more tap turns it on.
    function micOrderOf(rows, last) {
      const i = rows.findIndex((m) => m.id === last);
      return i > 0 ? [rows[i]].concat(rows.slice(0, i), rows.slice(i + 1)) : rows.slice();
    }
    // THE SPEAKER PICKER: only where a page may choose where sound plays
    // (setSinkId on media elements) and the device has more than one output.
    // spkDeviceId '' = the system's own output; spkDefGroup marks that row.
    const SINK_OK = !!(window.HTMLMediaElement && window.HTMLMediaElement.prototype && typeof window.HTMLMediaElement.prototype.setSinkId === 'function');
    let spkOutputs = [], spkDeviceId = '', spkDefGroup = '';
    function speakerChoices() { return SINK_OK && spkOutputs.length > 1 ? spkOutputs : []; }
    // The system default input's group: what a browser speech engine on the
    // raw microphone hears (Chrome lists it as 'default'; other browsers list
    // the default first). The caption export compares it with the call's mic.
    let ccDefGroup = '';
    function ccDefGroupOf(list) {
      const ins = (list || []).filter((d) => d && d.kind === 'audioinput');
      const d = ins.find((x) => x.deviceId === 'default') || ins[0];
      return d ? String(d.groupId || '') : '';
    }
    function noteAudioDevices() {
      const md = navigator.mediaDevices;
      if (!md || typeof md.enumerateDevices !== 'function') return Promise.resolve();
      return md.enumerateDevices().then((list) => {
        audioDevKey = audioDevKeyOf(list); ccDefGroup = ccDefGroupOf(list);
        micInputs = micInputsOf(list);
        if (micDeviceId && !micInputs.some((m) => m.id === micDeviceId)) micDeviceId = '';
        camInputs = devRowsOf(list, 'videoinput');
        camPhone = camsHaveFacing(list);
        if (camDeviceId && (camPhone || !camInputs.some((m) => m.id === camDeviceId))) camDeviceId = '';
        spkOutputs = devRowsOf(list, 'audiooutput');
        const sd = (list || []).find((d) => d && d.kind === 'audiooutput' && d.deviceId === 'default');
        spkDefGroup = sd ? String(sd.groupId || '') : '';
        if (spkDeviceId && !spkOutputs.some((m) => m.id === spkDeviceId)) { spkDeviceId = ''; applySpeaker(); }
        (0, /*()*/__V.paintSpkBtn)();
      }, () => {});
    }
    // A MUTED PHONE HOLDS NO MICROPHONE. An Android phone's browser runs a page that holds a microphone, even a
    // switched-off one, on the CALL audio path: the volume buttons move the in-call volume, sound routes like a call, and after an
    // interruption (a phone call) the meeting plays at the in-call volume. So on a phone a mute lets the microphone go:
    // every sender that carried it takes a silent stand-in (the same m-line, nothing renegotiated; a sender that also
    // carries the row's sound stays), and the microphone is stopped. An unmute opens it again with the same settings
    // (the permission is already given, so nothing is asked) and puts it back on the same senders. A desktop keeps its
    // switched-off microphone: a desktop browser floats a meeting into picture-in-picture only while it captures.
    // The mic is let go MIC_LETGO_GRACE after a mute, at once when the page is hidden (a phone call, another app): a
    // quick mute and unmute in a conversation stays a plain switch, with no reopened microphone and no first word lost.
    const micLetsGo = () => !!(__C.IS_MOBILE && __C.IS_ANDROID);
    let quietMic = null;      // the stand-in track, and the graph that keeps it alive
    let micOpening = false;   // an unmute is opening the microphone: the tap already counts as on
    let micLetGoT = 0, micLetGoWatch = false;
    // A MIC IS LET GO ONLY UNDER A GRANT THAT STAYS. Opening it again on an unmute asks for the microphone, and a one-time grant
    // ("Allow this time", Chrome) is gone after the site was out of sight for a while: the sheet would then rise in the middle of
    // a meeting. permissions.query says "granted" for both kinds, so a page cannot read which one it has. What it can know: a
    // one-time grant does not outlive MIC_GRANT_AWAY (measured: alive after 40 s on the Home screen, gone after 400 s), so a grant
    // read at page start, after the page had been out of sight longer than that, is a grant that stays. A grant first seen in this
    // page's own life, or with no such away time on record, is not proven: the switched-off microphone stays held (as on a
    // desktop) and the phone keeps the call audio path rather than risk the sheet. The proof is kept (localStorage) while the
    // state reads "granted" and dropped the moment it reads anything else.
    const GRANT_AWAY_KEY = 'gifos_site_hidden_at', GRANT_SURE_KEY = 'gifos_mic_grant_sure';
    let micGrantSure = false, micGrantWatch = false;
    function micGrantInit() {
      if (micGrantWatch || !micLetsGo()) return;
      micGrantWatch = true;
      // its own localStorage pair: this runs at page start, before the core part has declared lsGet / lsSet
      const micLsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
      const micLsSet = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
      const away = +micLsGet(GRANT_AWAY_KEY) || 0, t0 = Date.now();   // when the last page of this site went out of sight (0: one is in sight, or none on record)
      const mark = () => micLsSet(GRANT_AWAY_KEY, document.hidden ? String(Date.now()) : '0');
      document.addEventListener('visibilitychange', mark);
      try { window.addEventListener('pagehide', () => micLsSet(GRANT_AWAY_KEY, String(Date.now()))); } catch (e) {}
      mark();
      const pm = (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) ? navigator.permissions : null;
      if (!pm) return;
      pm.query({ name: 'microphone' }).then((st) => {
        const read = (atStart) => {
          if (st.state !== 'granted') { micGrantSure = false; micLsSet(GRANT_SURE_KEY, null); return; }
          if (!atStart) return;   // a grant that changed in this page's life is not the proven one
          if (micLsGet(GRANT_SURE_KEY) === '1') micGrantSure = true;
          else if (away && t0 - away > GifOS.timings.MIC_GRANT_AWAY) { micGrantSure = true; micLsSet(GRANT_SURE_KEY, '1'); }
        };
        read(true);
        st.onchange = () => read(false);
      }).catch(() => {});
    }
    function micLetGoSoon() {
      clearTimeout(micLetGoT); micLetGoT = 0;
      if (!micLetsGo()) return;
      if (!micLetGoWatch) {
        micLetGoWatch = true;
        document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(micLetGoT); micLetGoT = 0; micLetGo(); } });
      }
      if (document.hidden) { micLetGo(); return; }
      micLetGoT = setTimeout(() => { micLetGoT = 0; micLetGo(); }, GifOS.timings.MIC_LETGO_GRACE);
    }
    function quietMicTrack() {
      if (quietMic && quietMic.track.readyState === 'live') return quietMic.track;
      let ctx = null; try { ctx = (0, /*()*/__C.ensureAc)(); } catch (e) { ctx = null; }
      if (!ctx || typeof ctx.createMediaStreamDestination !== 'function') return null;
      try {
        const dest = ctx.createMediaStreamDestination(), gain = ctx.createGain(), osc = ctx.createOscillator();
        gain.gain.value = 0; osc.connect(gain); gain.connect(dest);
        try { osc.start(); } catch (e) {}
        const track = dest.stream && dest.stream.getAudioTracks()[0];
        if (!track) return null;
        track.enabled = false;
        try { track._gifosQuiet = true; } catch (e) {}
        quietMic = { track, dest, gain, osc };
        return track;
      } catch (e) { return null; }
    }
    function isQuietMic(t) { return !!t && !!quietMic && t === quietMic.track; }
    // A new audio track in the mic's place: on every main sender that carried the old one (never an aux sender; a
    // PARKED main sender, track null while on stage, stays parked and the stage feed's reconcile follows the stream),
    // then in the stream itself. The old microphone is stopped; the stand-in is kept for the next mute.
    function swapMicTrack(na) {
      const old = __C.localStream.getAudioTracks()[0] || null;
      for (const p of __C.peers.values()) for (const sender of p.pc.getSenders()) {
        if (__C.auxSenders.has(sender)) continue;
        if (sender.track && sender.track.kind === 'audio' && (!old || sender.track === old)) sender.replaceTrack(na).catch(() => {});
      }
      if (old) { if (!isQuietMic(old)) { try { old.stop(); } catch (e) {} } __C.localStream.removeTrack(old); }
      __C.localStream.addTrack(na);
      (0, /*()*/__C.meterFor)('me', __C.localStream);
    }
    // A phone lets a switched-off microphone go. True when it did.
    function micLetGo() {
      if (!micLetsGo() || !micGrantSure || !__C.localStream || __C.micGrabbing || micOpening) return false;   // no grant that stays: the switched-off mic stays held
      const cur = __C.localStream.getAudioTracks()[0];
      if (!cur || cur.enabled || cur._gifosQuiet || cur.readyState !== 'live') return false;
      const q = quietMicTrack();
      if (!q) return false;   // no audio context: the switched-off microphone stays, as on a desktop
      q.enabled = false;
      if (typeof __C.avWhy === 'function') (0, /*()*/__C.avWhy)('mic let go');
      swapMicTrack(q);
      schedReconcile();
      return true;
    }
    // The core's two asks: on false a phone lets a switched-off microphone go (a room mute, an assistant); on true a
    // let-go microphone opens again, as a Mic tap does (true when that started).
    function micHold(on) {
      const t = __C.localStream && __C.localStream.getAudioTracks()[0];
      if (!on) return micLetGo();
      if (!isQuietMic(t)) return false;
      setMicOn(t, true);
      return true;
    }
    micGrantInit();   // at page start: the proof reads the away time before this page changes it
    function setMicMode(mode, force) {
      if (typeof __C.outgoingHeld !== 'undefined' && __C.outgoingHeld) return;
      if (!__C.localStream) return;
      // A request that lands while a grab is in flight is KEPT, never dropped:
      // every caller fires once (song start, song end, a device change), so a
      // dropped request is a mode that never applies — a follower suppressed
      // through the whole song, or a leader left in music mode (no echo
      // cancellation) for the rest of the meeting. The last request wins and
      // runs the moment the grab settles; at most one grab is ever in flight.
      if (__C.micGrabbing) { __C.micWant = { mode, force: !!force }; return; }
      // A let-go microphone opens in this mode at the next unmute: a song, a headset or a device change opens nothing
      // while the person is muted.
      if (isQuietMic(__C.localStream.getAudioTracks()[0]) && !__C.micUnmuteAfter) { __C.micMode = mode; return; }
      if (mode === __C.micMode && !force) return;
      // 'music' (the song leader): the whole speech pipeline off. 'sing' (a
      // follower): suppression and auto-gain off — they treat a held note as
      // noise and a crescendo as a fault — but echo cancellation stays, since a
      // follower may well be on speaker. 'voice': the ordinary call pipeline.
      const want = mode === 'music'
        ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        : mode === 'sing'
          ? { echoCancellation: true, noiseSuppression: false, autoGainControl: false }
          : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
      __C.micGrabbing = true;
      const ask = micDeviceId ? Object.assign({ deviceId: { exact: micDeviceId } }, want) : want;
      // micUnmuteAfter: true after a pick in the chooser (it says which mic is on), 'tap' after a plain unmute of a
      // let-go microphone (the button already shows on; nothing more is said).
      const unmute = __C.micUnmuteAfter || false; __C.micUnmuteAfter = false;
      const tapped = unmute === 'tap' || (unmute === true && micOpening);   // a let-go microphone opening (a tap, or a pick in the chooser)
      let retry = false;
      navigator.mediaDevices.getUserMedia({ audio: ask }).then((s) => {
        const na = s.getAudioTracks()[0];
        if (!na) return;
        __C.micMode = mode;
        try { na.contentHint = mode === 'voice' ? '' : 'music'; } catch (e) {} // tell the encoder it is carrying a song, not speech
        na.enabled = !__C.myStatus.muted; // the swap must never un-mute anyone
        // Same discipline as regrabCamera: never an aux sender, and a PARKED
        // main sender (track null — on stage) stays parked; the stg aux feed
        // carries the fresh mic to the room instead.
        const wasQuiet = isQuietMic(__C.localStream.getAudioTracks()[0]);
        swapMicTrack(na);
        if (wasQuiet) schedReconcile();   // the stage feed follows the stream to the opened microphone
        noteAudioDevices();
        const locked = unmute && (0, /*()*/__C.amGloballyMuted)();   // a room mute that landed while the mic opened wins
        if (locked) { na.enabled = false; __C.myStatus.muted = true; (0, /*()*/__V.paintControls)(); }
        else if (tapped) { if (!__C.myStatus.muted) setMicOn(na, true); }   // muted again while it opened: it is let go below
        else if (unmute && !na.enabled) setMicOn(na, true);
        else if (unmute) kickStageMic(na);
        if (unmute === true && !locked) (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stMicOnNamed', 'Mic on: {name}').replace('{name}', micLabelOf(na)));
      }).catch(() => {
        // mic re-grab refused — keep the current mode. A pick that could not
        // be opened says so, and the mic that was working stays: the pick is
        // forgotten too (micPickPrev), or every later re-grab (a headset
        // plugged in, a song) asked for the mic that would not open, failed,
        // and left the old route in place.
        if (unmute === true) micDeviceId = __C.micPickPrev;
        else if (tapped && micDeviceId) { micDeviceId = ''; retry = true; }   // the mic picked before is gone (unplugged while muted): the browser's own choice, once
        if (retry) return;
        if (tapped && isQuietMic(__C.localStream && __C.localStream.getAudioTracks()[0])) { __C.myStatus.muted = true; (0, /*()*/__V.paintControls)(); }   // the unmute did not open a mic: muted, as the person sees
        if (unmute) (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stMicPickFailed', 'That microphone could not be opened. Your mic did not change.'));
      })
        .finally(() => {
          __C.micGrabbing = false;
          if (retry) { __C.micUnmuteAfter = 'tap'; setMicMode(mode, true); return; }
          if (tapped) micOpening = false;
          const w = __C.micWant; __C.micWant = null;
          if (w) setMicMode(w.mode, w.force); // the request kept during the grab
          else micLetGo();   // muted again while it opened (or a re-grab while muted): a phone lets it go
        });
    }

    // Headphones plugged in (or pulled out) MID-MEETING: with an active mic,
    // mobile browsers run a phone-call-style audio session whose output route
    // is chosen when the capture STARTS — plugging in earbuds later does
    // nothing until the mic restarts. So restart it when the audio route
    // changed: re-grab in the CURRENT mode, which makes the browser re-open
    // the audio session and route both your mic and the room's sound to the
    // headset. A camera plug, or a label refresh with the same device ids,
    // is not a route change and does not restart the mic.
    // (This is exactly the moment sing mode tells people to plug in earbuds.)
    let devT = 0;
    function onMeetDeviceChange() {
      if (!__C.localStream) return;
      clearTimeout(devT);
      devT = setTimeout(() => {
        const kick = () => {
          // A route change can pause background audio elements — re-kick them.
          for (const el of document.querySelectorAll('.tile video, .rowtile video')) {
            if (el._aud && el._aud.srcObject) {
              let pr = null; try { pr = el._aud.play(); } catch (e) { audioBlocked(el._aud, e); }
              if (pr && pr.then) pr.then(() => { if (typeof audioUnblocked === 'function') audioUnblocked(el._aud); }).catch((e) => audioBlocked(el._aud, e));
            }
          }
        };
        const md = navigator.mediaDevices;
        if (!md || typeof md.enumerateDevices !== 'function') { setMicMode(__C.micMode, true); kick(); return; }
        md.enumerateDevices().then((list) => {
          const key = audioDevKeyOf(list);
          // First reading is the baseline. A later one re-grabs only when an
          // audio id was added or removed. The key moves on the quiet path.
          // A re-grab stores it from noteAudioDevices after the capture
          // succeeds, so a failed grab is tried on the next change.
          if (audioDevKey !== null && key !== audioDevKey) setMicMode(__C.micMode, true);
          else audioDevKey = key;
          kick();
        }, () => { setMicMode(__C.micMode, true); kick(); });
      }, 400); // devices settle in a burst — act once
    }
    yield 1918;
    // Picture-only. Sound is the companion Audio (busVolume); the element has
    // to be muted BEFORE play or a late claim (no user gesture left) stays
    // paused and videoWidth never moves.
    function playTileVideo(video, stream) {
      if (!video || !stream) return;
      // The verification hold wins over a late play. The tile's peer is who
      // the element was built for; a self-view has no such hold.
      const tile = video.closest && video.closest('[data-peer]');
      const pid = tile && tile.dataset && tile.dataset.peer;
      if (pid && pid !== __C.myId && typeof __C.mediaOk === 'function' && (0, /*()*/__C.mediaOk)(pid) === false) return;
      try { video.muted = true; } catch (e) {}
      if (WEBKIT_TILE) { wkPlayTile(video, stream); return; }
      if (video.srcObject !== stream) video.srcObject = stream;
      const pr = video.play(); if (pr && pr.catch) pr.catch(() => {});
    }
    // A WEBKIT TILE IS A PICTURE BOUND WHILE NOTHING FLOWS (Safari and the
    // Playwright WebKit shell; measured 2026-10-21, out/gate-1812/webkit-fix/t2).
    // A row-mate's camera arrives in a stream that also carries their mic
    // track, and that track is usually MUTED at the receiver (a parked or
    // silent sender: no RTP). WebKit's player waits for every track of a
    // stream before it starts, so the tile sat at readyState 0 / videoWidth 0
    // for the whole call while its receiver decoded hundreds of frames; the
    // dead-sink watchdog then rebuilt the pair every 30 s, every rebuild bound
    // the element again on a FLOWING track, and that bind stalls WebKit's main
    // thread for 20-30 s or for good (every HUNG seat in the rowmate gate).
    // Two rules, both measured in the two-seat harness: (1) the element plays
    // a video-only MediaStream of the camera track (the companion Audio still
    // plays the whole stream, so the voice is unchanged); (2) it is bound only
    // while the track is quiet. When the track already flows, the sender is
    // asked for a HELD re-seat ({k:'vkick', hold}: park the camera, resume
    // after the hold) and the bind lands inside that quiet window, so the first
    // frame reaches a settled player, as on a normal first claim. Chromium and
    // Firefox keep the plain srcObject = stream path. tileHolds() is how the
    // rest of the page asks "is this tile showing that stream" either way.
    // The ENGINE, not the UA string: a WebKit shell can wear an Android Chrome
    // UA (meet.js --profile phone does), and WebKit keeps navigator.vendor
    // 'Apple Computer, Inc.' under any UA. Chromium says 'Google Inc.',
    // Firefox ''. The UA test is the fallback for an engine that hides it.
    // localStorage gifos_wk_tile=off bypasses the WebKit tile path (a bisect switch for the harness).
    const WEBKIT_TILE = WEBKIT_ENGINE && (() => { try { return localStorage.getItem('gifos_wk_tile') !== 'off'; } catch (e) { return true; } })();
    const WK_TILE_HOLD = GifOS.timings.WK_TILE_HOLD;    // ms the sender keeps the camera parked for a held re-seat
    const WK_TILE_BIND_AT = GifOS.timings.WK_TILE_BIND_AT; // ms into the hold when the tile is bound (frames have stopped by then)
    // A COPY THAT COMES BACK LANDS IN THE STREAM IT LEFT. A sender keeps one stream id per copy for the life of the page
    // (the container law), and the browser hands a track whose stream id it already knows to the SAME remote MediaStream.
    // When the copy's old m-line was stopped, WebKit (and Firefox) leave its ended track in that stream beside the new
    // one (Chromium takes it out): the copy read [ended video, live video] (feedsInfo vTracks 2). An ended track carries
    // nothing more, so it leaves the stream before anything binds or relays it. Never a live track.
    function dropEndedRemoteTracks(stream, keep) {
      if (!stream || !keep || typeof stream.getTracks !== 'function') return;
      for (const t of stream.getTracks()) {
        if (t !== keep && t.kind === keep.kind && t.readyState === 'ended') { try { stream.removeTrack(t); } catch (e) {} }
      }
    }
    function tileHolds(video, stream) {
      return !!video && !!stream && (video.srcObject === stream || (video._wrapOf === stream && !!video._pic && video.srcObject === video._pic));
    }
    function liveVideoTrack(stream) {
      const ts = stream && stream.getVideoTracks ? stream.getVideoTracks() : [];
      for (const t of ts) if (t.readyState !== 'ended') return t;
      return ts[0] || null;
    }
    // EVERY MUTED <video> ON WEBKIT BINDS A PICTURE, NEVER A STREAM THAT CARRIES
    // A MIC. Measured 2026-10-22 (gate-1812 webkit-fix/root, alsalog.so, the
    // Playwright WebKit shell): each bind of a stream with an audio track —
    // muted element or not — opens the ALSA device on the web process MAIN
    // thread (snd_pcm_open -> the PipeWire plugin -> pw_thread_loop_stop ->
    // pthread_join), 41 opens for 40 binds; a video-only stream opens nothing.
    // On a box where that open fails (no PipeWire session for the process)
    // the join blocks the page for seconds, and once in ~3 rounds of 40 binds
    // for good: every "W1 HUNG" of the row-mate gate, every 20-80 s stall at
    // pair formation (3/3 stack snapshots). A pair forming is a burst of such
    // binds (companions, decoders, strips, the self view, each new pc), so
    // on WebKit they all bind the stream's picture, cached on the stream and
    // following its live video track; the voice rides the one ear (wkEar).
    function wkPicOf(stream) {
      if (!stream || typeof stream.getVideoTracks !== 'function') return stream;
      const tr = liveVideoTrack(stream), tid = tr ? tr.id : '';
      if (stream._wkPic && stream._wkPicTid === tid) return stream._wkPic;
      const pic = new MediaStream(tr ? [tr] : []);
      stream._wkPic = pic; stream._wkPicTid = tid;
      if (!stream._wkPicFollow) {
        stream._wkPicFollow = true;
        stream.addEventListener('addtrack', (ev) => { // the camera track landed after the mic: the picture takes it
          const t = ev && ev.track; const cur = stream._wkPic;
          if (t && t.kind === 'video' && cur && !cur.getVideoTracks().length) { try { cur.addTrack(t); stream._wkPicTid = t.id; } catch (e) {} }
        });
      }
      return pic;
    }
    // Bind a stream to a muted <video>: the plain stream on Chromium and
    // Firefox, its picture on WebKit (tileHolds() answers "is it bound").
    // A WEBKIT PLAYER STARTS ONLY IN AN ELEMENT THAT HAS BEEN LAID OUT. On WebKit a <video> that is made, attached
    // and bound in one task never starts (readyState 0, videoWidth 0, whether or not frames are flowing, while the
    // track itself carries frames); with one layout read between the attach and the bind it starts every time, and
    // a bind before the attach starts only now and then. The Stage strip is made and bound in one call, so the
    // Stage of an embedded player stayed black on WebKit on most joins. So an attached element is laid out once
    // before its first picture is bound. Chromium and Firefox start either way and never come here.
    function wkBindVideo(video, stream) {
      if (!WEBKIT_ENGINE || !stream) { video.srcObject = stream; return; }
      if (!video._wkLaid && video.isConnected) { video._wkLaid = true; void video.clientWidth; }
      const pic = wkPicOf(stream);
      video._wrapOf = stream; video._pic = pic;
      if (video.srcObject !== pic) video.srcObject = pic;
    }
    // Is this muted <video> showing that stream's CURRENT picture: the plain
    // stream, or (WebKit) the picture of its live video track. A picture
    // whose track ended (a rebuilt pair hands the same container a new
    // track) is stale, and the caller binds again.
    function wkHolds(video, stream) {
      if (!tileHolds(video, stream)) return false;
      return !WEBKIT_ENGINE || !video._pic || video._pic === wkPicOf(stream);
    }
    function wkBindPic(video, stream, why) {
      const tr = liveVideoTrack(stream);
      if (!tr) {
        // The mic track came first; bind when the camera track lands.
        if (!stream._wkAddTrack) {
          stream._wkAddTrack = true;
          stream.addEventListener('addtrack', () => { for (const q of __C.peers.values()) if (q.stream === stream && q.video && !q.relayed) playTileVideo(q.video, stream); });
        }
        return;
      }
      if (tileHolds(video, stream) && video._followId === tr.id) {
        if (video.paused || video.readyState === 0) { const pr = video.play(); if (pr && pr.catch) pr.catch(() => {}); }
        return;
      }
      const pic = new MediaStream([tr]);
      video._wrapOf = stream; video._pic = pic; video._followId = tr.id; video._wkAsks = 0;
      if (!video._wkErrHook) {
        // The engine's own player can fail on a picture the page cannot
        // see into: an ARM WebKit (wk0056 a3j2/a3cb) picks the host's
        // nvv4l2decoder, which rejects every VP8/H264 caps, and the element
        // ends in error 4 while inbound-rtp framesDecoded keeps climbing.
        // That is not a dead sink to re-seat: every held re-seat parks the
        // sender's camera for ALL its viewers and cures nothing here. Log
        // the error once per picture; the dead-sink watchdog and wkQuietBind
        // leave an errored element alone until a new picture is bound (a
        // new srcObject resets video.error).
        video._wkErrHook = true;
        video.addEventListener('error', () => {
          const e = video.error, s = video._wrapOf;
          if (!e || video._wkErrPic === video._pic) return;
          video._wkErrPic = video._pic;
          if (typeof __C.clog === 'function') (0, /*()*/__C.clog)('wk-tile player error ' + e.code + ' ' + String(s && s.id).slice(0, 8) + ' ' + String(e.message || '').slice(0, 60));
        });
      }
      video.srcObject = pic;
      const pr = video.play(); if (pr && pr.catch) pr.catch(() => {});
      if (typeof __C.clog === 'function') (0, /*()*/__C.clog)('wk-tile bind ' + why + ' ' + String(stream.id).slice(0, 8) + (tr.muted ? ' quiet' : ' flowing'));
    }
    // Ask the sender for a held re-seat and bind inside the quiet window: from
    // 0.9 s in, once two inbound-rtp samples 300 ms apart show the same
    // framesDecoded (or the track reads muted). A window that never goes
    // quiet (the sender did not park) binds nothing — a bind on a flowing
    // track is the stall this whole path exists to avoid.
    function wkQuietBind(video, stream, p) {
      if (video.error && video._wrapOf === stream) return; // the player failed on this picture: a re-seat cannot cure it
      if (typeof __C.botParks === 'function' && (0, /*()*/__C.botParks)(p.id, false)) return;   // parked for the bot view
      const t = Date.now();
      // One re-seat in flight; a sender that never goes quiet (an old client
      // re-seats at once) is asked again on a doubling backoff, 60 s at most.
      const nAsk = video._wkAsks || 0;
      if (video._wkQuietAt && t - video._wkQuietAt < Math.min(60000, (WK_TILE_HOLD + 500) * Math.pow(2, Math.max(0, nAsk - 1)))) return;
      video._wkQuietAt = t; video._wkAsks = nAsk + 1; video._wkPending = null;
      __C.visParkSent.set(p.id, false);
      (0, /*()*/__C.dcSend)(p, { k: 'vis', park: false });
      (0, /*()*/__C.dcSend)(p, { k: 'vkick', hold: WK_TILE_HOLD });
      if (typeof __C.clog === 'function') (0, /*()*/__C.clog)('wk-tile ' + String(p.id).slice(0, 6) + ' held re-seat asked');
      const tr = liveVideoTrack(stream);
      let rx = null; try { rx = tr && p.pc && p.pc.getReceivers().find((r) => r.track === tr); } catch (e) {}
      let last = null, acked = 0;
      const attempt = () => {
        if (p.video !== video || p.stream !== stream || p.relayed || p.wkHeldAck !== onAck) return;
        if (typeof __C.mediaOk === 'function' && (0, /*()*/__C.mediaOk)(p.id) === false) return;
        const go = () => { p.wkHeldAck = null; video._followId = ''; wkBindPic(video, stream, 'held'); }; // a fresh bind even on the same track
        if (!tr || tr.readyState !== 'live' || !rx || !rx.getStats) { go(); return; }
        rx.getStats().then((st) => {
          let fd = 0; st.forEach((x) => { if (x.type === 'inbound-rtp' && x.kind === 'video') fd = Math.max(fd, x.framesDecoded || 0); });
          if (last !== null && fd === last) { go(); return; }
          last = fd;
          if (Date.now() - acked > WK_TILE_HOLD - 900) { p.wkHeldAck = null; if (typeof __C.clog === 'function') (0, /*()*/__C.clog)('wk-tile ' + String(p.id).slice(0, 6) + ' never quiet after the ack, no bind'); return; }
          setTimeout(attempt, 300);
        }).catch(go);
      };
      // The bind waits for the sender's ack (vkick-held): the park has taken
      // and frames in flight drain in 400 ms; then two inbound-rtp samples
      // 300 ms apart must agree. No ack within the hold: no bind (an old
      // sender re-seated at once; the dead-sink backoff asks again later).
      const onAck = () => { if (acked) return; acked = Date.now(); setTimeout(attempt, 400); };
      p.wkHeldAck = onAck;
      setTimeout(() => { if (p.wkHeldAck === onAck && !acked) { p.wkHeldAck = null; if (typeof __C.clog === 'function') (0, /*()*/__C.clog)('wk-tile ' + String(p.id).slice(0, 6) + ' no hold ack, no bind'); } }, WK_TILE_HOLD);
    }
    function wkPlayTile(video, stream) {
      // A hidden tile (a non-mate, reconcileGrid) is never bound: reconcileGrid
      // binds it when it is shown again.
      const tileEl = video.closest && video.closest('.tile');
      if (tileEl && tileEl.style.display === 'none') { video._wkPending = null; return; }
      const tr = liveVideoTrack(stream);
      if (tr && tileHolds(video, stream) && video._followId === tr.id) {
        if (video.paused || video.readyState === 0) { const pr = video.play(); if (pr && pr.catch) pr.catch(() => {}); }
        return;
      }
      let p = null;
      for (const q of __C.peers.values()) if (q.video === video) { p = q; break; }
      const flowing = !!tr && tr.readyState === 'live' && !tr.muted;
      if (!flowing) { video._wkPending = null; wkBindPic(video, stream, 'first'); return; }
      if (p && !p.relayed && p.stream === stream && p.dc && p.dc.readyState === 'open') { wkQuietBind(video, stream, p); return; }
      // Flowing and nobody to ask yet (the channel is not open): hold the bind.
      // The sweep asks once the channel opens; a track that goes quiet first
      // (the sender parked) is bound on its 'mute'.
      if (video._wkPending !== stream) {
        video._wkPending = stream;
        if (typeof __C.clog === 'function') (0, /*()*/__C.clog)('wk-tile bind pending ' + String(stream.id).slice(0, 8) + ' (flowing, no channel)');
        if (tr) tr.addEventListener('mute', () => { if (video._wkPending === stream) { video._wkPending = null; wkBindPic(video, stream, 'muted'); } }, { once: true });
      }
    }
    // A mic that was off when its stage sender was built keeps sending
    // silence after it is switched on. Dropping that track and seating
    // it again restarts the encoder, the same way a quiet camera is
    // restarted. Parked senders stay parked: they have no track.
    function kickStageMic(track) {
      if (!track || track.kind !== 'audio' || track.readyState !== 'live' || !track.enabled) return;
      for (const sd of __C.stageSenders) {
        if (!sd || sd.track !== track) continue;
        const seat = () => sd.replaceTrack(track).catch(() => {});
        sd.replaceTrack(null).then(seat).catch(() => {});
      }
    }
    // A glare rollback can leave the main video sender negotiated sendrecv,
    // track still attached, and emitting nothing. Seating the live camera
    // again (drop, then the same track) restarts the encoder. Never touches
    // a parked, staged, or cam-off sender — those are supposed to be quiet.
    function kickMainVideo(p) {
      if (typeof __C.outgoingHeld !== 'undefined' && __C.outgoingHeld) return;
      if (p && p.mainHoldUntil && p.mainHoldUntil > Date.now()) return; // a held re-seat owns this quiet window
      if (!p || !p.mainV || p.remoteParkMain || __C.myStatus.camOff || (0, /*()*/__C.personOnStage)(__C.myId) || !(0, /*()*/__C.camPeer)(p.id)) return;
      let vt = null; try { vt = sentVideoTrack(); } catch (e) {}
      if (!vt || vt.readyState !== 'live') return;
      const sender = p.mainV;
      const seat = () => sender.replaceTrack(vt).catch(() => {});
      if (sender.track !== vt) { seat(); return; }
      sender.replaceTrack(null).then(seat).catch(() => {});
    }
    // A HELD re-seat (WEBKIT_TILE): park the camera toward this peer for ms,
    // then seat it again through refreshOutbound (which keeps the park while
    // mainHoldUntil stands). Same guards as kickMainVideo: never a parked,
    // staged or cam-off sender, never a non-mate.
    // EVERY ENGINE PARKS AND RE-SEATS THROUGH replaceTrack, WEBKIT INCLUDED.
    // A WebKit sender parked through encodings[0].active = false never
    // encodes again after active = true, and a replaceTrack after that does
    // not revive it either (measured 2026-10-22, two WebKit seats and WebKit
    // with Chromium: framesEncoded frozen for the rest of the call); a
    // replaceTrack(null) park resumes on replaceTrack(track) at once. The
    // pair-formation stalls that once argued against replaceTrack on WebKit
    // were the audio device open behind every stream bind (wkPicOf).
    function holdMainVideo(p, ms) {
      if (typeof __C.outgoingHeld !== 'undefined' && __C.outgoingHeld) return;
      if (!p || !p.mainV || p.remoteParkMain || __C.myStatus.camOff || (0, /*()*/__C.personOnStage)(__C.myId) || !(0, /*()*/__C.camPeer)(p.id)) return;
      const t = Date.now();
      p.mainHoldUntil = t + ms;
      // The ack rides the channel once the park has taken (replaceTrack or
      // setParameters resolved): the far side binds on it, never on a guess.
      const ack = () => { if (p.dc && p.dc.readyState === 'open') (0, /*()*/__C.dcSend)(p, { k: 'vkick-held', hold: ms }); };
      if (p.mainV.track) p.mainV.replaceTrack(null).then(ack, ack); else ack();
      if (typeof __C.clog === 'function') (0, /*()*/__C.clog)('held re-seat ' + String(p.id).slice(0, 6) + ' park ' + ms + 'ms');
      setTimeout(() => {
        if (p.mainHoldUntil && p.mainHoldUntil > Date.now() + 250) return; // a later hold lengthened the window
        p.mainHoldUntil = 0;
        try { refreshOutbound(); } catch (e) {}
      }, ms + 50);
    }
    // The same rollback silences the main AUDIO sender the same way: the mic
    // stays attached and enabled, the link stays sendrecv, and no packet
    // leaves, so a person in my row stops hearing me while still seeing me.
    // Seat the mic again the same way. A staged sender is parked on purpose
    // and stays parked; mute is the track's enabled flag, so it carries over.
    function kickMainAudio(p) {
      if (typeof __C.outgoingHeld !== 'undefined' && __C.outgoingHeld) return;
      if (!p || !p.mainA || (0, /*()*/__C.stageIds)().includes(__C.myId)) return;
      const at = mainAudioTrack();
      if (!at || at.readyState !== 'live') return;
      const sender = p.mainA;
      const seat = () => sender.replaceTrack(at).catch(() => {});
      if (sender.track !== at) { seat(); return; }
      sender.replaceTrack(null).then(seat).catch(() => {});
    }
    yield 1953;
    // feed tiles: key -> { via, streamId, ids, names, stream } (3b)
    const compOf = new Map();
    // Ask the far side to re-offer when a mapped stream's m-lines never made it
    // into a negotiation (rolled back / raced) \u2014 used by the aux-track paths.
    function compKick(pid) {
      const p = __C.peers.get(pid);
      if (!p || !p.dc || p.dc.readyState !== 'open') return;
      (0, /*()*/__C.dcSend)(p, { k: 'rkick' });
      if ((0, /*()*/__C.hasPendingTx)(p)) (0, /*()*/__C.renegotiate)(p);
    }

    function kickJob(pid) {
      const p = __C.peers.get(pid);
      if (!p || !p.dc || p.dc.readyState !== 'open') return;
      (0, /*()*/__C.dcSend)(p, { k: 'rkick' });
      if ((0, /*()*/__C.hasPendingTx)(p)) (0, /*()*/__C.renegotiate)(p);
    }

    // ================== THE NESTED MOSAIC (3b, docs/media-plane.md) =========
    // The Stadium channel, distributed: every ROW HEAD composites its PRODUCT
    // — its row's camera band (H) + the up-to-C sub-products its row's
    // down-links deliver (stacked V) — and ships it up. Section 1 is the 5×5
    // ROOK'S GRAPH (healing-laws W7): every S1 seat — heads included — links
    // its whole row AND its whole column, so S1 heads exchange products
    // DIRECTLY over the head column (1 hop), with a fully link-disjoint
    // backup relayed through the row+column fabric (x1 → column carrier →
    // sdrow). Each head stacks all C products into THE STADIUM and fans it
    // back down every down-link. Only Section-1 routing is rook-wired. One
    // mechanism carries every hop: a keyed aux-stream ship ({k:'mx'})
    // announced by streamId, claimed on ontrack — the exact friend-relay
    // discipline. All of it gates on beyondRow: a room that IS just my row
    // renders everyone directly on Channel R and pays nothing here.
    const MM = GifOS.meshMedia;
    yield 1962;  // key + '>' + to -> { senders, trackList, active, sig, to, key, meta } (outbound ships)
    const pipePacks = new Map();   // SUB.4: pipe peer -> the room pack without that pipe's part (a vouched pipe only)
    const pipePacksStop = (keep) => { for (const [h, pk] of [...pipePacks]) if (!keep || !keep(h)) { try { pk.stop(); } catch (e) {} pipePacks.delete(h); } };
    let prodPack = null, roomPack = null, sdView = null, stripPack = null; // GAPLESS packers (approach A); roomPack: Section 1's whole-room pack; sdView: my Stadium (the room less my row), painted here only
    // MY VOICE IN MY OWN CELL. A head's composites (its row's product, the
    // down-mixes for its children) fold each cell's audio from the cell's
    // stream. My self-view is picture-only (refreshOutbound gives it the sent
    // video track alone), so folding it carried no voice: every seat beyond
    // my row saw me and never heard me — and a head alone on its row shipped
    // a silent band. The fold gets the mic track the main senders carry, so
    // mute (track.enabled) and a mic re-grab (a new track) reach it the same
    // way. Cached by track identity: a fresh stream id would re-fold every
    // sweep.
    let selfFoldSt = null;
    function selfFoldStream() {
      const at = mainAudioTrack();   // the voice the main senders carry: my mic, or my mic with the page I carry (docs/turn-carry.md)
      const vs = __C.meTile && __C.meTile.video ? __C.meTile.video.srcObject : null;
      if (!at || at.readyState === 'ended') { selfFoldSt = null; return vs || __C.localStream; }
      if (!selfFoldSt || selfFoldSt.getAudioTracks()[0] !== at) selfFoldSt = new MediaStream([at]);
      return selfFoldSt;
    }
    // test observability: {i, pid8} the head drew this sweep (stale-seat dup guard)
    let dbgRowFaces = [];
    yield 1969;
    let sdEmptyAt = 0;   // since when my Stadium view has been EMPTY (blank-tile grace)
    const downFolds = new Map();   // receiver key -> audio fold: the sound that rides the room pack to it, its own voices left out
    const downStreams = new Map(); // receiver key -> MediaStream [room picture, that receiver's sound], kept while the tracks stand
    // THE MIX CLOCK. A head's folds are the only road its row's voices take to the rest of the room (the row
    // product up, the mix-minus to its mates and children), so a head whose audio graph stops silences everyone
    // beyond its row while its pictures and links still flow, and no other seat has a path to those voices
    // (2026-11-07: a Safari row head kept its seat with a stopped context; the Section-1 head heard nobody in row 1
    // until that page was killed). A slow device must never break the room: every few seconds the clock of the
    // context the folds run in is read, and one that has not moved for MIX_STALL_MS (resume() tried first) is
    // replaced. The downward folds are cleared and the next sweep rebuilds them on the fresh context. The row
    // product (and an L14 pack) folds inside its packer, and that product is the mix the rest of the room hears,
    // so those packers move onto the fresh context too. The meters, the stage ear and Whisper stay where they were.
    const MIX_STALL_MS = GifOS.timings.MIX_STALL_MS, MIX_REBUILD_GAP_MS = GifOS.timings.MIX_REBUILD_GAP_MS;
    let mixAc = null; // the fresh context the folds moved to after a stall (null: they run in the meeting context)
    const mixClock = { ctx: null, t: -1, stuckSince: 0, rebuilds: 0, lastAt: 0, fails: 0 };
    function mixCtx() { if (mixAc && mixAc.state !== 'closed') return mixAc; (0, /*()*/__C.ensureAc)(); return __C.ac; }
    function acClockInfo() { return { mix: mixAc ? 'fresh' : 'meeting', mixSt: mixAc ? mixAc.state : null, stuckMs: mixClock.stuckSince ? Date.now() - mixClock.stuckSince : 0, rebuilds: mixClock.rebuilds, fails: mixClock.fails, agoMs: mixClock.lastAt ? Date.now() - mixClock.lastAt : null }; }
    function mixClockCheck() {
      if (!downFolds.size && !prodPack && !l14Packs.size) { mixClock.ctx = null; mixClock.stuckSince = 0; return; }
      const c = mixCtx(); if (!c) return;
      const now = Date.now(), t = +c.currentTime || 0;
      if (mixClock.ctx !== c || t > mixClock.t) { mixClock.ctx = c; mixClock.t = t; mixClock.stuckSince = 0; return; }
      if (!mixClock.stuckSince) { mixClock.stuckSince = now; try { const pr = c.resume(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {} return; }
      if (now - mixClock.stuckSince < MIX_STALL_MS || now - mixClock.lastAt < MIX_REBUILD_GAP_MS) return;
      let nc = null; try { nc = (0, /*()*/__C.newMeetAudioContext)(); } catch (e) { nc = null; }
      mixClock.lastAt = now;
      if (!nc) { mixClock.fails++; return; }
      try { const pr = nc.resume(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {}
      const old = mixAc; mixAc = nc;
      // The product's fold is not one of downFolds. Leave it and the row mix stays on the stopped context.
      try { if (prodPack && prodPack.reseatAudio) prodPack.reseatAudio(nc); } catch (e) {}
      try { for (const pk of l14Packs.values()) if (pk && pk.reseatAudio) pk.reseatAudio(nc); } catch (e) {}
      for (const f of downFolds.values()) { try { f.clear(); } catch (e) {} }
      downFolds.clear(); downStreams.clear();
      if (old) { try { old.close(); } catch (e) {} }
      mixClock.rebuilds++; mixClock.ctx = null; mixClock.stuckSince = 0;
      if (__C.clog) (0, /*()*/__C.clog)('mix-ac-rebuild', 'n=' + mixClock.rebuilds, 'old=' + (old ? old.state : (__C.ac ? __C.ac.state : '-')), 'new=' + nc.state);
      schedReconcile();
    }
    // A receiver's stream: the room picture and that receiver's sound, one
    // container while both tracks stand (either may be absent).
    function downStream(key, v, a) {
      if (!v && !a) { downStreams.delete(key); return null; }
      const cur = downStreams.get(key);
      if (cur && (cur.getVideoTracks()[0] || null) === (v || null) && (cur.getAudioTracks()[0] || null) === (a || null)) return cur;
      const st = new MediaStream([v, a].filter(Boolean)); downStreams.set(key, st); return st;
    }
    // Audio tracks this pair is still holding. A rebuild or a leave retires
    // them so a fold cannot keep the old session after the peer key comes back.
    function peerAudioTracks(p) {
      const out = [];
      if (!p) return out;
      const pushStream = (s) => { try { if (s && s.getAudioTracks) for (const t of s.getAudioTracks()) if (t) out.push(t); } catch (e) {} };
      try { if (p.pc && p.pc.getReceivers) for (const r of p.pc.getReceivers()) if (r.track && r.track.kind === 'audio') out.push(r.track); } catch (e) {}
      // The tile can show a stream a FRIEND carries for this person (claimRelayStreams): that stream rides the friend's connection,
      // not this person's. A retry of the dead direct connection to them (every few seconds across a cut) retired the carried
      // voice for good, and every fold refused it from then on: the row's product went out without that person's voice.
      let carried = null; try { carried = __C.relayVia.get(p.id) || null; } catch (e) {}
      if (p.video && !(carried && carried.stream && carried.stream === p.video.srcObject)) pushStream(p.video.srcObject);
      for (const s of p.incoming || []) pushStream(s);
      return out;
    }
    function retireMixTracks(tracks) {
      if (!tracks || !tracks.length) return;
      try { if (MM && MM.retireAudioTracks) MM.retireAudioTracks(tracks); } catch (e) {}
      try { if (prodPack && prodPack.dropTracks) prodPack.dropTracks(tracks); } catch (e) {}
      try { for (const pk of l14Packs.values()) if (pk && pk.dropTracks) pk.dropTracks(tracks); } catch (e) {}
      try { for (const f of downFolds.values()) { if (f && f.dropTracks) f.dropTracks(tracks); if (f && f.scrub) f.scrub(); } } catch (e) {}
    }
    // Keep a fold summing exactly `parts` (key -> stream). A key whose stream
    // changed is folded again; the same stream follows its live audio track.
    function foldSync(f, parts) {
      const sid = f._sid || (f._sid = new Map());
      for (const k of [...sid.keys()]) if (!parts.has(k)) { f.remove(k); sid.delete(k); }
      for (const [k, st] of parts) {
        if (sid.get(k) !== st.id) { f.remove(k); sid.set(k, st.id); }
        if (!f.has(k)) f.add(k, st, 1); else f.follow(k, st);
      }
      // A source whose track ended, or the same track summed twice, is out.
      if (f.scrub) f.scrub();
      if (f.dedupeTracks) f.dedupeTracks();
    }
    // LIP SYNC. The picture is forwarded as encoded frames the moment they
    // arrive (nothing gates it), while the sound is re-mixed at every head on
    // the way down, so the sound reaches a deep seat later than the picture.
    // Each pack carries `alag`: how far its sound trails its picture (ms),
    // summed hop by hop. A seat that re-mixes or relays the sound adds its own
    // audio hop (its inbound jitter buffer, the mixing graph, one Opus frame);
    // the receiver holds its drawn Stadium by `alag`, so the faces line up with
    // the voices. The forward itself never waits for any of this.
    const audioHop = new Map(); // audio track -> { ms, jb, n, at }
    function audioHopMs(track) {
      if (!track) return 0;
      let h = audioHop.get(track);
      if (!h) { if (audioHop.size > 32) for (const t of [...audioHop.keys()]) if (t.readyState === 'ended') audioHop.delete(t); h = { ms: 0, jb: 0, n: 0, at: 0 }; audioHop.set(track, h); }
      const now = Date.now();
      if (now - h.at > 3000) {
        h.at = now;
        let rcv = null; for (const pc of pipePcs()) { try { for (const r of pc.getReceivers()) if (r.track === track) rcv = r; } catch (e) {} }
        if (rcv && rcv.getStats) rcv.getStats().then((rep) => rep.forEach((r) => {
          if (r.type !== 'inbound-rtp' || r.kind !== 'audio') return;
          const jb = r.jitterBufferDelay || 0, n = r.jitterBufferEmittedCount || 0;
          if (n > h.n && h.n) h.ms = Math.round((jb - h.jb) / (n - h.n) * 1000);
          h.jb = jb; h.n = n;
        })).catch(() => {});
      }
      const graph = __C.ac ? Math.round(((__C.ac.baseLatency || 0) + (__C.ac.outputLatency || 0)) * 1000) : 0;
      return Math.max(0, h.ms) + graph + 20;   // 20: one Opus frame before the re-mixed sound leaves
    }
    // The drawn Stadium, held `ms` behind its source: a short ring of copies.
    let avHold = null; // { src, ms, ring, free, out, stop }
    // Off by default: measured, the forwarded picture still reaches a seat after its sound, so holding it would widen the gap. gifos_av_hold=on turns it on.
    const avHoldOff = () => { try { return localStorage.getItem('gifos_av_hold') !== 'on'; } catch (e) { return true; } };
    function avHoldStop() { const H = avHold; avHold = null; if (H && H.stop) { try { H.stop(); } catch (e) {} } }
    function heldEl(src, ms) {
      ms = Math.max(0, Math.min(800, Math.round(ms || 0)));
      if (!src || ms < 15 || avHoldOff()) { avHoldStop(); return src; }
      if (avHold && avHold.src === src) { avHold.ms = ms; return avHold.out; }
      avHoldStop();
      const out = document.createElement('canvas'); out.width = 0; out.height = 0;
      const H = avHold = { src, ms, ring: [], free: [], out, stop: null };
      const tick = () => {
        const w = src.videoWidth || src.width || 0, h = src.videoHeight || src.height || 0;
        if (!w || !h || (src.videoWidth === undefined && w <= 2)) return;
        const now = performance.now();
        const cv = H.free.pop() || document.createElement('canvas');
        if (cv.width !== w) cv.width = w; if (cv.height !== h) cv.height = h;
        try { cv.getContext('2d').drawImage(src, 0, 0); } catch (e) { H.free.push(cv); return; }
        H.ring.push({ cv, at: now });
        let pick = null;
        while (H.ring.length && now - H.ring[0].at >= H.ms) { if (pick) H.free.push(pick.cv); pick = H.ring.shift(); }
        while (H.ring.length > 40) H.free.push(H.ring.shift().cv);   // a bounded ring: 800 ms at the 20 ms beat
        if (pick) { if (out.width !== w) out.width = w; if (out.height !== h) out.height = h; try { out.getContext('2d').drawImage(pick.cv, 0, 0); } catch (e) {} H.free.push(pick.cv); }
      };
      const clk = MM.workerClock(20, tick); H.stop = clk && clk.stop ? clk.stop : null;
      return out;
    }
    // MY STADIUM: the room pack less my own row, hidden here by the cell ids
    // the pack carries (a pack that names no cells, past the dense threshold,
    // shows whole: never a blank where someone else is). Painted locally, never
    // encoded. `sound` is the stream whose audio I hear with it.
    let sdViewSrc = null, sdViewSt = null;
    const VIEW_FPS = GifOS.timings.VIEW_FPS;
    function paintRoomView(src, meta, sound, c, lagMs) {
      if (src && typeof __C.roomViewShown === 'function' && !(0, /*()*/__C.roomViewShown)()) src = null;   // a page that shows the Stage alone paints no room view
      const el = src ? heldEl(src, lagMs) : (avHoldStop(), null);
      if (el && meta && meta.n) {
        // Own-row hiding stops at section size (Nathan): a Stadium of more than C×C people shows everyone and hides nothing.
        const hide = [];
        if (c && meta.n <= __C.SCALE.C * __C.SCALE.C) for (let j = 0; j < __C.SCALE.C; j++) { const pid = j === c.i ? __C.myId : (0, /*()*/__C.occPid)({ pc: c.pc, r: c.r, i: j }); if (pid) hide.push(String(pid)); }
        // SUB.4 PIPE HOLDERS: the two ends of a vouched pipe see each other on a full tile (my camera crosses to my pipe peer,
        // camPeer), so each leaves the other out of its own Stadium; everyone else sees the far room in the Stadium only.
        // (only while its tile shows its own live camera: under a TURN step the camera gives way and the composite shows it again)
        for (const h of (0, /*()*/__C.pipePeers)()) { const q = __C.peers.get(h), vt = q && q.stream && q.stream.getVideoTracks ? q.stream.getVideoTracks()[0] : null; if (__C.turnLinks && __C.turnLinks.video(h) && vt && vt.readyState === 'live' && !vt.muted && hide.indexOf(String(h)) < 0) hide.push(String(h)); }
        // A camera on the Stage is left out of this browser's stadium only.
        // The pack that arrived is unchanged, and a share stays in the grid.
        try {
          const stgHide = (0, /*()*/__C.stageIds)();
          for (let si = 0; si < stgHide.length; si++) {
            const sid = String(stgHide[si]);
            let sharing = false;
            try { sharing = sid === String(__C.myId) ? !!__C.myStatus.scr : (typeof __C.sharingScreen === 'function' && !!(0, /*()*/__C.sharingScreen)(sid)); } catch (e2) {}
            if (sharing || hide.indexOf(sid) >= 0) continue;
            hide.push(sid);
          }
        } catch (e) {}
        if (!sdView) {
          sdView = MM.createPacker({ shape: 'stad', fps: VIEW_FPS, view: true }).start();   // a local paint, never encoded: draw at display rate so the view adds little delay
          let layCols = 0;
          try { const MV = (typeof GifOS !== 'undefined' && GifOS.meetViews) || null; if (MV && typeof MV.lastStadCols === 'function') layCols = MV.lastStadCols() | 0; } catch (e) {}
          if (layCols > 0 && sdView.setCols) sdView.setCols(layCols);
        }
        // The shipped pack names every cell or none. This drawing still has
        // the local list, nulls included, and does not write it back.
        let viewMeta = meta;
        try {
          if (meta && roomPack && roomPack.canvas && src === roomPack.canvas && roomPack.cellIds &&
              !(Array.isArray(meta.ids) && meta.ids.length === meta.n)) {
            const localIds = roomPack.cellIds();
            if (localIds && localIds.length === meta.n) viewMeta = Object.assign({}, meta, { ids: localIds });
          }
        } catch (e) {}
        sdView.setTile('v', 0, el, null, Object.assign({}, viewMeta, { hide }));
        sdViewSrc = src;
      } else if (sdView) sdView.delTile('v');
      if (sdView && sdView.count() > 0 && sdView.track) {
        sdEmptyAt = 0;
        // The sound's LIVE track: a renegotiated pair can leave its ended track first in the same stream, and a Stadium bound to
        // the ended one is silent for good (WebKit folds this voice into its one ear by that track).
        const vt = sdView.track, at = stageEarLiveTrack(sound);
        if (!sdViewSt || sdViewSt.getVideoTracks()[0] !== vt || (sdViewSt.getAudioTracks()[0] || null) !== at) sdViewSt = new MediaStream(at ? [vt, at] : [vt]);
        (0, /*()*/__V.paintStadiumTile)(sdViewSt);
        return;
      }
      // SOUND NEVER DEPENDS ON A PICTURE: a room pack with no face to draw (a one-row room whose pipe is unvouched: its own
      // cells are hidden, the pipe's part is sound only) still carries the room's ear, and the Stadium tile is its only player.
      const sndOnly = stageEarLiveTrack(sound);
      if (sndOnly) {
        sdEmptyAt = 0;
        if (sdView) { sdView.stop(); sdView = null; }
        sdViewSrc = null; avHoldStop();
        if (!sdViewSt || sdViewSt.getVideoTracks().length || (sdViewSt.getAudioTracks()[0] || null) !== sndOnly) sdViewSt = new MediaStream([sndOnly]);
        // A sound-only Stadium that stands for nobody I cannot already see (a 1:1 over a pipe: the far person is on a full tile,
        // SUB.4 pipe holders) plays its sound and takes no place on screen.
        let quiet = false;
        try { const mc = __C.meshNode && typeof __C.meshNode.meetingCount === 'function' ? __C.meshNode.meetingCount() : null; quiet = mc != null && mc <= facesOnScreen(); } catch (e) {}
        (0, /*()*/__V.paintStadiumTile)(sdViewSt, quiet);
        return;
      }
      // Nothing to show: a tile already on screen lingers MOS_GRACE, so a
      // transient empty beat never flaps it; none is ever created empty.
      if (!sdEmptyAt) sdEmptyAt = Date.now();
      const shown = !!__V.stadiumEl.querySelector('[data-row="sd"]');
      if (!shown || Date.now() - sdEmptyAt > MOS_GRACE) {
        (0, /*()*/__V.paintStadiumTile)(null);
        if (sdView) { sdView.stop(); sdView = null; }
        sdViewSrc = null; sdViewSt = null; avHoldStop();
      }
    }
    // ENCODE ONCE. A canvas track added to N peer connections runs N encoders.
    // Section 1's room pack is encoded once over a loopback pair inside the
    // page, and the received copy rides the pipe lane (mesh-pipe.js): every
    // ship of it forwards those encoded bytes, and a far end's key request
    // reaches this one encoder over RTCP. Where the pipe lane is off, the
    // canvas track ships as before.
    let packLoop = null; // { a, b, src, sender, rx, dead, at }
    function packLoopStop() { const L = packLoop; packLoop = null; if (!L) return; try { L.a.close(); } catch (e) {} try { L.b.close(); } catch (e) {} }
    function packLoopTrack(track) {
      if (!track || !(0, /*()*/__C.pipeEnabled)()) { packLoopStop(); return null; }
      if (packLoop && packLoop.src === track) {
        if (!packLoop.dead) return packLoop.rx && packLoop.rx.readyState !== 'ended' ? packLoop.rx : null;
        if (Date.now() - packLoop.at < 10000) return null; // a failed loop is retried after a pause; the canvas ships meanwhile
      }
      packLoopStop();
      let a = null, b = null;
      try { a = new RTCPeerConnection(); b = new RTCPeerConnection(); } catch (e) { try { if (a) a.close(); } catch (e2) {} return null; }
      const L = packLoop = { a, b, src: track, sender: null, rx: null, dead: false, at: Date.now() };
      const fail = () => { if (packLoop === L) { L.dead = true; L.rx = null; L.at = Date.now(); schedReconcile(); } };
      a.onicecandidate = (e) => { if (e.candidate) b.addIceCandidate(e.candidate).catch(() => {}); };
      b.onicecandidate = (e) => { if (e.candidate) a.addIceCandidate(e.candidate).catch(() => {}); };
      a.onconnectionstatechange = () => { if (a.connectionState === 'failed' || a.connectionState === 'closed') fail(); };
      b.ontrack = (e) => {
        if (packLoop !== L || !e.track || e.track.kind !== 'video') return;
        if (!__C.MPipe.tapReceiver(e.receiver, 'rx:' + e.track.id)) { fail(); return; }
        L.rx = e.track; L.rcv = e.receiver; schedReconcile();
      };
      try {
        L.sender = a.addTrack(track, new MediaStream([track]));
        (0, /*()*/__C.preferHwVideo)(a);   // the same codec order every peer link prefers, so the forwarded bytes match the far ends' templates
        const prm = L.sender.getParameters();
        if (prm.encodings && prm.encodings[0]) { prm.encodings[0].maxBitrate = 900000; L.sender.setParameters(prm).catch(() => {}); }   // the composite budget (auxBudget)
      } catch (e) { fail(); return null; }
      (async () => {
        const o = await a.createOffer(); await a.setLocalDescription(o); await b.setRemoteDescription(o);
        const an = await b.createAnswer(); await b.setLocalDescription(an); await a.setRemoteDescription(an);
      })().catch(fail);
      return null;
    }
    // Every pc a forwarded track can arrive on: the peer links, and the loop.
    const pipePcs = () => { const out = [...__C.peers.values()].map((q) => q.pc).filter(Boolean); if (packLoop && packLoop.b) out.push(packLoop.b); return out; };
    const l14Packs = new Map();
    yield 1997;
    // STAGE AUDIO folds AT THE EAR (mix-minus): the strip is video-only; every
    // device sums the per-stager feeds it holds, skipping its OWN — a stager
    // never hears their own voice come back.
    let stageEar = null;
    function ensureStageEar() {
      (0, /*()*/__C.ensureAc)();
      if (stageEar) return;
      if (!__C.ac) return;
      const fold = MM.createAudioFold(__C.ac);
      // On WebKit the stage fold feeds the ONE ear (wkEar): a second <audio>
      // bound to the fold's stream is one more audio device open on the web
      // process main thread, at the moment the share starts (wk0056 fr2: W2
      // HUNG at phase B dt=2), the same open 7f84dfa took out of every tile.
      const sink = (typeof WEBKIT_ENGINE !== 'undefined' && WEBKIT_ENGINE && typeof wkStageSink === 'function') ? wkStageSink(fold) : null;
      if (sink) { stageEar = { fold, el: sink, sids: new Map() }; return; }
      // Heard through its parts (createFoldPlayer), not as the fold's WebAudio track in an element: Chromium
      // resamples that track to catch up after a hiccup and the stage voices go up in pitch.
      let el = null;
      if (typeof MM.createFoldPlayer === 'function') { try { el = MM.createFoldPlayer(fold, { onBlocked: audioBlocked }); } catch (e) { el = null; } }
      if (!el) { el = new Audio(); el.autoplay = true; el.srcObject = fold.dest.stream; }
      stageEar = { fold, el, sids: new Map() };
      const pr = el.play(); if (pr && pr.catch) pr.catch((e) => audioBlocked(el, e)); // the stage ear is the one element a sharer's voice rides
    }
    // What the ear folds, re-derived every sweep from the stg claims I hold.
    // THE EAR IS MEMBERSHIP, NOT A PIPE (same law as the strip, 2026-08-05):
    // only a key whose owner is in the gossiped stage set is folded. A
    // stepped-down stager's claim lingers for the pipe grace (MOS_GRACE, then
    // claimRedun) while its MAIN senders are already back on the row, so an
    // ear gated on the claim played that voice twice for ~5 s.
    // "Mute for everyone" is enforced here at the receiver, as on the direct
    // tiles (updateTile): a muted owner's feed stays held at gain 0 — the
    // stage lane gives a client that ignores the moderator no second mouth.
    function syncStageEar(stagers) {
      if (!stageEar) return;
      const onStage = new Set(stagers);
      const want2 = new Map();
      for (const [k2, f2] of __C.mosIn) {
        if (k2.indexOf('stg:') !== 0 || k2 === 'stg:' + __C.myId || !f2.stream) continue;
        if (!onStage.has(k2.slice(4).split('^')[0])) continue;
        want2.set(k2, f2.stream);
      }
      if (!stageEar.bound) stageEar.bound = new Map();
      for (const [k2, sid] of [...stageEar.sids]) { const st2 = want2.get(k2); if (!st2 || st2.id !== sid) { stageEar.fold.remove(k2); stageEar.sids.delete(k2); stageEar.bound.delete(k2); if (stageEar.watch) stageEar.watch.delete(k2); } }
      for (const [k2, st2] of want2) {
        // Same announced id, new MediaStream object: a video m-line leaving
        // (camera idle-stop) renegotiates, and the receiver follows the new
        // object. The ear must follow too. The id did not change, so the
        // check above keeps the source that is bound to the ended track.
        const swapped = stageEar.sids.has(k2) && stageEar.bound.get(k2) !== st2;
        if (!stageEar.sids.has(k2) || swapped) {
          if (swapped) { stageEar.fold.remove(k2); stageEar.sids.delete(k2); if (stageEar.watch) stageEar.watch.delete(k2); }
          stageEar.fold.add(k2, st2, 1); stageEar.sids.set(k2, st2.id); stageEar.bound.set(k2, st2); if (typeof armStageEar === 'function') armStageEar(k2);
        } else if (typeof stageEar.fold.has === 'function' && typeof stageEar.fold.follow === 'function') {
          // Same container object, NEW audio track: the stager's sound left the feed and came back (a stage feed whose
          // sound stopped and started on a new m-line). The old receiver track has ended and the new one sits in the
          // same stream, so neither check above sees it. Follow the container's live track; a key the fold let go
          // (no live track at that moment) is added again every sweep until a live track is there to bind.
          if (stageEar.fold.has(k2)) { if (stageEar.fold.follow(k2, st2) && typeof armStageEar === 'function') armStageEar(k2); }
          if (!stageEar.fold.has(k2)) { stageEar.fold.add(k2, st2, 1); if (stageEar.fold.has(k2) && typeof armStageEar === 'function') armStageEar(k2); }
        }
        const gm = (0, /*()*/__C.modOf)(k2.slice(4).split('^')[0]).mute;
        if (stageEar.fold.setGain) stageEar.fold.setGain(k2, (gm && gm.on) ? 0 : 1); // a cached older fold lacks it: held at 1, as before
      }
      setStageEarLevel();
    }
    // A stage source built while the sender was muted latches that silence.
    // The track often never fires `unmute` (silence frames, not a mute edge),
    // so a fresh source is the only way to hear the samples. Probe the raw
    // track with a NEW node: one born during silence stays quiet, one born
    // after the samples does not. Rebuild the fold only while the wire is
    // loud and the fold is still quiet, then leave a loud fold alone.
    let stageEarWatchT = 0, stageEarWatchBusy = false; // ONE watch chain: a key armed while a tick is out joins that tick's next round
    function stageEarLiveTrack(stream) {
      const ts = stream && stream.getAudioTracks ? stream.getAudioTracks() : [];
      let held = null;
      for (let i = 0; i < ts.length; i++) {
        const t = ts[i];
        if (!t || t.readyState === 'ended') continue;
        if (!t.muted) return t;
        if (!held) held = t;
      }
      return held;
    }
    // THE WIRE'S LEVEL, read from the receiver's own stats: the peak sample of the decoded audio (inbound-rtp
    // audioLevel, 0..1), before Web Audio, so a source node latched silent cannot hide it. A read makes no audio
    // node: a MediaStreamAudioSourceNode lives as long as its running context and keeps pulling its track, so a
    // fresh node per read (as this was) grew memory and CPU for as long as anyone stood on the stage.
    // null: no stats for this track (no pc, or an engine without the field): the caller treats it as unknown.
    function stageEarRawPeak(track, ms, f) {
      const p = f ? __C.peers.get(f.via) : null, pc = p && p.pc;
      const read = async () => {
        if (!pc || !track) return null;
        let lv = null;
        try { (await pc.getStats()).forEach((s) => { if (s.type === 'inbound-rtp' && s.kind === 'audio' && s.trackIdentifier === track.id && typeof s.audioLevel === 'number') lv = Math.max(lv || 0, s.audioLevel); }); } catch (e) {}
        return lv;
      };
      return (async () => {
        const a = await read();
        await new Promise((r) => setTimeout(r, ms));
        const b = await read();
        return a == null && b == null ? null : Math.max(a || 0, b || 0);
      })();
    }
    // THE EAR'S LEVEL: what the fold sends to the ear, from the fold's one tap (a node made once with the fold;
    // it sits after the source nodes, so it reads a latched source as the silence the person hears).
    function stageEarFoldPeak(ms) {
      if (!stageEar || !stageEar.fold || typeof stageEar.fold.peak !== 'function' || !__C.ac) return Promise.resolve(0);
      if (__C.ac.state !== 'running') { try { __C.ac.resume(); } catch (e) {} }
      return stageEar.fold.peak(ms);
    }
    function scheduleStageEarWatch() {
      if (stageEarWatchT || stageEarWatchBusy) return;
      const tick = async () => {
        stageEarWatchT = 0;
        if (!stageEar || !stageEar.watch || !stageEar.watch.size || !__C.ac) return;
        stageEarWatchBusy = true;
        let delay = 2000;
        try {
          for (const k2 of [...stageEar.watch.keys()]) {
            if (!stageEar.sids.has(k2)) { stageEar.watch.delete(k2); continue; }
            const f = __C.mosIn.get(k2);
            const sid = stageEar.sids.get(k2);
            if (!f || !f.stream || f.stream.id !== sid) { delay = 700; continue; }
            const owner = k2.slice(4).split('^')[0];
            let gm = null; try { gm = (0, /*()*/__C.modOf)(owner).mute; } catch (e) { gm = null; }
            if (gm && gm.on) continue; // moderator mute is gain 0; the ear is supposed to be quiet
            const t = stageEarLiveTrack(f.stream);
            if (!t) continue;
            const w = stageEar.watch.get(k2);
            if (w.trackId !== t.id) { w.trackId = t.id; w.tries = 0; w.settleUntil = 0; }
            if (w.settleUntil && Date.now() < w.settleUntil) continue;
            // A sample spans two awaits, and a sweep can move the slot meanwhile (a failback onto another copy re-binds the
            // ear to that copy's stream). A verdict on the copy the slot left must touch nothing: rebinding the ear to its track
            // pointed the fold, and the player that follows it, at a copy just parked, and the listener stayed deaf for good
            // (long-soak 02c: the stale tick crossed noor's failback onto the relay, and the relay's track was never played).
            // A moderator mute that lands meanwhile holds too: the repair below re-adds the source at gain 1.
            const still = () => {
              if (!stageEar || !stageEar.watch || stageEar.watch.get(k2) !== w || stageEar.sids.get(k2) !== sid) return false;
              if (__C.mosIn.get(k2) !== f || !stageEar.bound || stageEar.bound.get(k2) !== f.stream) return false;
              let m = null; try { m = (0, /*()*/__C.modOf)(owner).mute; } catch (e) { m = null; }
              return !(m && m.on);
            };
            const raw = await stageEarRawPeak(t, 180, f);
            if (!still()) { delay = 700; continue; }
            w.rawPeak = raw; w.foldPeak = null; w.peakAt = Date.now(); // earState reads the watch's last sample: it makes no audio nodes of its own
            if (raw > 0.02) {
              const fold = await stageEarFoldPeak(180);
              if (!still()) { delay = 700; continue; }
              w.foldPeak = fold;
              if (fold > 0.02) { w.tries = 0; w.settleUntil = Date.now() + 2500; }
              else if (w.tries < 12) {
                let ok = false;
                try { ok = !!(stageEar.fold.rebind && stageEar.fold.rebind(k2, t)); } catch (e) { ok = false; }
                if (!ok) {
                  try { stageEar.fold.remove(k2); stageEar.fold.add(k2, f.stream, 1); } catch (e) {}
                }
                w.tries++;
                delay = 500;
              }
            } else { w.tries = 0; delay = Math.min(delay, 1000); }
          }
        } catch (e) { delay = 700; }
        stageEarWatchBusy = false;
        if (stageEar && stageEar.watch && stageEar.watch.size) stageEarWatchT = setTimeout(tick, delay);
      };
      stageEarWatchT = setTimeout(tick, 400);
    }
    function armStageEar(k2) {
      if (!stageEar) return;
      if (!stageEar.watch) stageEar.watch = new Map();
      if (!stageEar.watch.has(k2)) stageEar.watch.set(k2, { tries: 0, settleUntil: 0 });
      scheduleStageEarWatch();
    }
    // ONE READ OF A STAGE SEAT: every record the page keeps about this person being on stage, in
    // one object, and whether I can hear them. Read-only, and it starts no audio node: the peaks
    // are the watch's last sample (null when the watch has not sampled). A listing is not sound, so
    // `audible` is the listing AND a feed that moves bytes (stgLost, the byte watchdog and the
    // stager's beat) AND a sink bound to that very stream, with no moderator mute, my ear open and
    // the fold not latched silent under a loud wire. A quiet stager with a live feed is audible:
    // the moment they speak, I hear them. For myself it says whether my voice goes out.
    function earState(id, listing) {
      const listed = (listing || (0, /*()*/__C.stageSeats)()).includes(id);
      const st = id === __C.myId ? __C.myStatus : __C.statusOf.get(id);
      const dg = (0, /*()*/__C.digLists)(), entry = dg ? dg.stage.find((e) => e.id === id) : null;
      const beat = __C.stgBeats.get('stg:' + id);
      let mute = null; try { mute = (0, /*()*/__C.modOf)(id).mute; } catch (e) {}
      const out = { id, me: id === __C.myId, listed, audible: false,
        said: (st && st.stg) || 0, fold: !!entry, foldAge: dg ? dg.age : null,
        held: __C.stageHeldAt.has(id), feedAt: __C.stageFeedAt.get(id) || 0, beatAge: beat ? Date.now() - beat.at : null,
        claim: null, lost: true, bound: false, trackLive: false, modMuted: !!(mute && mute.on), earOpen: false,
        rawPeak: null, foldPeak: null, peakAge: null, tries: 0, lapsed: false,
        strip: !!(compOf.get('sgs') && (compOf.get('sgs').names || []).includes(id)), view: stageViewNow };
      if (out.me) {
        const t = (__C.rbNow && __C.rbNow.v) ? (__C.rbNow.a || null) : ((__C.localStream && __C.localStream.getAudioTracks()[0]) || null);
        out.trackLive = !!t && t.readyState === 'live' && t.enabled !== false;
        out.audible = listed && out.trackLive && !__C.myStatus.muted && !out.modMuted;
        return out;
      }
      const keys = [...__C.mosIn.keys()].filter((k) => k.indexOf('stg:') === 0 && k.slice(4).split('^')[0] === id);
      const ear = stageEar;
      const k2 = keys.find((k) => ear && ear.sids.has(k)) || keys[0];
      const f = k2 ? __C.mosIn.get(k2) : null;
      if (!f) return out;
      const fb = mosFb.get(k2);
      out.claim = { key: k2, via: String(f.via).slice(0, 8), dead: !!f.deadAt, dark: !!(fb && fb.dark), hop: f.meta ? f.meta.h : null };
      out.lost = stgLost(k2);
      out.bound = !!(ear && ear.sids.has(k2) && ear.bound && f.stream && ear.bound.get(k2) === f.stream);
      // ...and the fold sums a track of that very stream: an ear bound to one copy while its source reads another is deaf
      const fd = ear ? ear.fold : null; // parts() reads the fold's bookkeeping: no audio node
      if (out.bound && fd && typeof fd.parts === 'function') {
        const part = fd.parts().find((x) => x.k === k2);
        out.bound = !!part && f.stream.getAudioTracks().indexOf(part.track) >= 0;
      }
      if (f.stream) { const t = stageEarLiveTrack(f.stream); out.trackLive = !!t && t.readyState === 'live'; }
      if (ear) out.earOpen = !ear.el.muted && !ear.el.paused;
      const w = ear && ear.watch ? ear.watch.get(k2) : null;
      if (w) {
        out.rawPeak = w.rawPeak == null ? null : w.rawPeak; out.foldPeak = w.foldPeak == null ? null : w.foldPeak;
        out.peakAge = w.peakAt ? Date.now() - w.peakAt : null; out.tries = w.tries; out.lapsed = w.tries >= 12;
      }
      const latched = out.rawPeak != null && out.rawPeak > 0.02 && out.foldPeak != null && out.foldPeak <= 0.02;
      out.audible = listed && out.bound && !out.lost && out.trackLive && !out.modMuted && out.earOpen && !latched;
      return out;
    }
    function stageAudible(id) { return earState(id).audible; }
    // DEBUG trace: each time a listed stager goes in or out of earshot, with why.
    const earNoted = new Map();
    function earNote(stagers) {
      if (typeof __C.clog !== 'function') return;
      try {
        for (const id of stagers) {
          if (id === __C.myId) continue;
          const e = earState(id, stagers);
          if (earNoted.get(id) === e.audible) continue;
          earNoted.set(id, e.audible);
          (0, /*()*/__C.clog)('stage-ear', String(id).slice(0, 8), e.audible ? 'audible' : 'silent', 'lost=' + e.lost, 'bound=' + e.bound, 'track=' + e.trackLive, 'open=' + e.earOpen, 'mute=' + e.modMuted, 'raw=' + e.rawPeak, 'fold=' + e.foldPeak);
        }
        for (const id of [...earNoted.keys()]) if (!stagers.includes(id)) earNoted.delete(id);
      } catch (e) {} // a trace line must never stop the sweep
    }
    // My own outbound feed as a STABLE MediaStream (what I broadcast — the
    // blurred/raw video plus my mic). While staged this aux feed is the ONLY
    // way my face and voice leave this device (the main senders are parked —
    // refreshOutbound), so it must carry audio: every ear folds it via
    // stageEar, skipping its own. MEMOIZED per track pair: the stream id only
    // changes when a track actually changes (blur-pipe swap, mic-mode/camera
    // re-grab) — which is exactly when shipMos must re-ship. A fresh
    // MediaStream every sweep used to churn the stg ships with an
    // unship+reship (renegotiation) every 2s.
    //
    // A STAGE FEED IS NOT A VIDEO FEED — it is whatever I am broadcasting, and
    // for most of a meeting that is a VOICE. This function used to bail on
    // `if (!v) return null`, throwing the audio track it fetched on the very
    // next line away with it, and the consequence was the worst kind of
    // meeting bug: a staged member with the camera off went SILENT to the
    // whole room ~20 seconds in. Join-quiet is the default (`myStatus =
    // { muted: true, camOff: true }`), the camera idle-stop then STOPS AND
    // REMOVES the video track as soon as the camera is off (reactCamIdle), so
    // sentVideoTrack() goes null — and while staged this aux stream is the
    // ONLY way anything leaves the device, because refreshOutbound parks the
    // main senders ("stagers live on the Stage ONLY"). Measured 2026-08-06,
    // three seats, stager unmuted with the camera off: at +10s every listener
    // held the stg feed and heard it (stageEarLevel 1); at +20s the stager's
    // stg jobs were 0 and the ear was silent; at +30s the listeners had
    // dropped the claim. The camera-on arm was steady throughout.
    //
    // So: ship what exists. Video+audio, audio-only, or video-only — nothing
    // to broadcast at all is the ONLY case that returns null.
    let selfShipMemo = null;
    const mySelfStream = () => {
      if (__C.BC_SEAT && !(0, /*()*/__C.bcMayPublishAv)()) return null;
      const v = stageVideoTrack();
      // A rebroadcast's sound comes from the same element as its picture. A
      // clip with no sound sends none, not the host's mic.
      const a = (__C.rbNow && __C.rbNow.v) ? (__C.rbNow.a || null) : mainAudioTrack();   // the voice my main senders carry
      if (!v && !a) return null;   // nothing to broadcast — no feed to ship
      if (!selfShipMemo || selfShipMemo.v !== v || selfShipMemo.a !== a) {
        // WHICH track moved? Rebuilding this memo mints a new MediaStream id,
        // which re-ships every stg job and cascades down the relay tree (each
        // relayer sees its incoming sig change and re-ships in turn). So the
        // one thing worth knowing is whether the VIDEO or the AUDIO track
        // swapped underneath us, and what it swapped from.
        try {
          if (!window.__selfMemoLog) window.__selfMemoLog = [];
          const cam = __C.localStream && __C.localStream.getVideoTracks()[0];
          window.__selfMemoLog.push({
            t: Date.now(),
            why: !selfShipMemo ? 'first'
              : (selfShipMemo.v !== v
                ? (!v ? 'video-track-GONE (camera off / idle-stop) — audio-only feed'
                  : !selfShipMemo.v ? 'video-track-BACK' : 'video-track-swapped')
                : 'audio-track-swapped'),
            oldV: selfShipMemo && selfShipMemo.v ? String(selfShipMemo.v.id).slice(0, 8) : null,
            newV: v ? String(v.id).slice(0, 8) : null,
            oldA: selfShipMemo && selfShipMemo.a ? String(selfShipMemo.a.id).slice(0, 8) : null,
            newA: a ? String(a.id).slice(0, 8) : null,
            blur: (typeof __C.blurLevelFor === 'function' ? (0, /*()*/__C.blurLevelFor)('me') : -1),
            pipeTrack: (typeof blurPipe !== 'undefined' && blurPipe && blurPipe.track) ? String(blurPipe.track.id).slice(0, 8) : null,
            pipeCamId: (typeof blurPipe !== 'undefined' && blurPipe) ? String(blurPipe.camId).slice(0, 8) : null,
            camId: cam ? String(cam.id).slice(0, 8) : null,
            camEnded: cam ? (cam.readyState === 'ended') : null,
          });
          if (window.__selfMemoLog.length > 40) window.__selfMemoLog.shift();
        } catch (e) {}
        // The memo is still keyed on the TRACK PAIR, so the stream id changes
        // only when a track really changes — losing the camera is exactly such
        // a change (the container goes from two m-lines to one), and it costs
        // ONE re-ship, not the per-sweep churn the memo exists to prevent.
        selfShipMemo = { v, a, stream: new MediaStream([v, a].filter(Boolean)) };
      }
      return selfShipMemo.stream;
    };
    yield 2015;
    // END-STAGE-MOS-EL
    function mosVideo(stream) {
      const v = document.createElement('video');
      v.muted = true; v.autoplay = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
      v.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';
      document.body.appendChild(v);   // attached before the bind: a WebKit player starts only in a laid-out element (wkBindVideo)
      if (typeof wkBindVideo === 'function') wkBindVideo(v, stream); else v.srcObject = stream;
      const pr = v.play(); if (pr && pr.catch) pr.catch(() => {});
      v._mosFlowAt = 0; v._mosRestarts = 0;
      return v;
    }
    // The claim's consumer. A new claim gets today's hidden <video>; a claim that already has one is re-bound in place.
    function bindClaim(rk, claim) {
      if (!claim) return;
      if (!claim.el) { claim.el = mosVideo(claim.stream); return; }
      try { wkBindVideo(claim.el, claim.stream); const pr = claim.el.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {}
    }
    function unbindClaim(rk, claim) {
      const el = claim && claim.el;
      try { releaseAudio(el); el.srcObject = null; el.remove(); } catch (e) {}
    }
    // The same consumer follows a new claim object (make-before-break re-park). A fresh bind would rebuild the decoder.
    function adoptClaim(rk, neu, old) {
      neu.el = old.el;
    }
    // Picture read for the choice. w is the element's videoWidth, or 0. frames is the playback count, or the videoWidth fallback the choice used.
    function picRead(claim) {
      const el = claim && claim.el;
      return { w: (el && el.videoWidth) || 0, frames: (el && el.getVideoPlaybackQuality) ? el.getVideoPlaybackQuality().totalVideoFrames : (el && el.videoWidth > 0 ? 1 : 0) };
    }
    // A DECODER THAT SHOWS NO PICTURE WHILE ITS FEED FLOWS IS RESTARTED
    // THROUGH THE SENDER. WebKit starts a newly bound stream <video> only
    // most of the time: a head's incoming row feed can decode normally
    // (inbound frames climbing, no keyframe asks) into an element that stays
    // at readyState 0 / videoWidth 0 for the whole meeting, and that row of
    // the stadium then packs black. Nothing done to the ELEMENT cures it once
    // the remote track is flowing: re-binding srcObject, a new MediaStream,
    // cloned tracks, load(), a fresh element and an enabled toggle all stay
    // dark (binding an already-flowing remote track into any element is dead
    // on that engine). What does start it is the mesh's own demand flip: the
    // sender PARKS the feed (mx-idle, a replaceTrack(null)), the decoder is
    // re-bound while nothing flows, and 1.5 s later the sender RESUMES it
    // (mx-want), so the first frame lands in a settled player, as on a normal
    // first claim. The restart waits for FLOW (the video track live and
    // unmuted, which a remote track becomes on its first RTP), judges on
    // PICTURE (videoWidth) not readyState, and repeats on a doubling backoff
    // (1.5, 3, 6 ... s, eight tries) while the picture is missing. While a
    // feed is held the claim sweep does not demand it hot and the pipe
    // watchdog does not read its byte silence as death (it is re-baselined
    // when the feed resumes). A claim with no announcer key (nothing to
    // demand) gets a plain re-bind. Chromium starts first time, so this never
    // fires there outside a feed that truly delivers nothing to an unmuted
    // track, where the demand flip starts a fresh GOP and the re-bind is a
    // no-op on the wire. debugDump().mosaic.restarts lists the decoders and
    // their counts.
    const MOS_RESTART_HOLD = GifOS.timings.MOS_RESTART_HOLD;   // ms the feed stays parked: re-bind at 1 s, resume at 2.5 s
    const mosHeld = (e) => !!(e && e.el && e.el._mosHold);
    // THE FEED'S SINKS. A mosaic feed plays in more than its 2x2 decoder: every
    // stadium face plays the composite stream, the Stage strip plays the
    // sharer's stg feed through a video-only wrapper (stageDirect). On WebKit
    // each is bound AFTER the feed flows, and a player bound to a flowing remote
    // track never starts: the decoder paints while the share stays black. The
    // park cures any element re-bound while nothing flows, so the sweep judges
    // and re-binds all of a feed's sinks, found by track identity. A sink is the
    // decoder or an element on screen at 16 px or more: the 4x4 .stad-src source
    // never loads on WebKit and is nobody's picture.
    function mosSinks(ent, vt) {
      const out = [ent.el];
      let all = null; try { all = document.querySelectorAll('video'); } catch (e) {}
      if (!all) return out;
      for (const x of all) {
        if (x === ent.el || !x.isConnected) continue;
        const so = x.srcObject; const t = so && so.getVideoTracks ? so.getVideoTracks()[0] : null;
        if (!t || t !== vt) continue;
        if (!(x.clientWidth >= 16 && x.clientHeight >= 16)) continue;
        out.push(x);
      }
      return out;
    }
    function mosDecoderSweep() {
      const now = Date.now();
      const ents = [...__C.mosIn.entries(), ...__C.mosStandby.entries()];
      for (const [rk, ent] of ents) {
        const v = ent && ent.el, st = v && (ent.stream || v.srcObject);
        if (!st || !v.isConnected) continue;
        if (ent.rest) { v._mosFlowAt = 0; continue; }   // a copy asked to rest shows nothing by design: no restart, no want
        const vt = st.getVideoTracks ? st.getVideoTracks()[0] : null;
        // Every sink is re-bound: the decoder to the entry's stream, each other sink to the stream it holds.
        const rebind = () => { for (const x of (vt ? mosSinks(ent, vt) : [v])) { const own = x === v ? st : x.srcObject; try { x.srcObject = null; if (typeof wkBindVideo === 'function') wkBindVideo(x, own); else x.srcObject = own; const pr = x.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {} } };
        const dmd = (want) => { if (ent.key && ent.via) { try { (0, /*()*/__C.demand)(ent.via, ent.key, ent.streamId, want, false, !want); } catch (e) {} } }; // the park stops the picture only
        if (v._mosHold) {
          const age = now - v._mosHold;
          if (!v._mosRebound && age >= 1000) { rebind(); v._mosRebound = true; }
          if (age >= MOS_RESTART_HOLD) {
            v._mosHold = 0; v._mosRebound = false; v._mosFlowAt = 0;
            // The silence was ours, not the pipe's: only the held pipe's clock moves. A primary that never
            // delivered a byte is credited the hold, not a fresh void window, or each restart restarts the void.
            const fb = __C.mosIn.get(rk) === ent ? mosFb.get(rk) : null;
            if (fb) { fb.lastAdvanceAt = fb.lastBytes > 0 ? now : Math.min(now, (fb.lastAdvanceAt || now) + MOS_RESTART_HOLD); fb.q = 0; }
            dmd(true);
          }
          continue;
        }
        if (!vt || vt.readyState !== 'live' || vt.muted) { v._mosFlowAt = 0; continue; } // nothing arriving: nothing to restart
        const sinks = mosSinks(ent, vt);
        const dead = sinks.filter((x) => !(x.videoWidth > 0));
        if (!dead.length) { v._mosFlowAt = 0; continue; }                                    // every sink paints
        if (!v._mosFlowAt) { v._mosFlowAt = now; continue; }
        if (v._mosRestarts >= 8 || now - v._mosFlowAt < 1500 * Math.pow(2, v._mosRestarts)) continue;
        v._mosRestarts++; v._mosFlowAt = now;
        if (ent.key && ent.via) { v._mosHold = now; v._mosRebound = false; dmd(false); }
        else rebind();
        if (window.__mosRestartLog) window.__mosRestartLog.push({ t: now, n: v._mosRestarts, key: rk, sid: String(st.id).slice(0, 8), park: !!v._mosHold, sinks: sinks.length, dead: dead.length });
      }
    }
    setInterval(mosDecoderSweep, 1000);
    yield 2026;
    const pipeJobs = new Map(); // jk -> { srcId, carrier, srcTrack, w0, stale }
    const pipeDeny = new Set(); // jobs that must use the transcode path (mismatch / dead pipe)
    const pipeDenyUntil = new Map(); // jk -> ms when the deny lapses
    const pipeDenyN = new Map();     // jk -> how many times denied (backoff)
    const attachFailAt = new Map(); // peer id -> rebuiltAt that already failed addTrack
    // Keyed by the source stream and only read by key, so a WeakMap: a feed
    // that churns out of the mosaic takes its audio-only copy with it.
    let stgAudioMemo = new WeakMap(); // source stream -> audio-only copy for a down hop
    // STAGE-PIPE-DENY
    function pipeDenyWait(hits) {
      const k = Math.max(1, hits | 0);
      const ms = 60000 * Math.pow(2, k - 1);
      return ms > 600000 ? 600000 : ms;
    }
    function pipeDenyStamp(jk) {
      const hits = (pipeDenyN.get(jk) || 0) + 1;
      pipeDenyN.set(jk, hits);
      pipeDenyUntil.set(jk, Date.now() + pipeDenyWait(hits));
    }
    function pipeDenyCurrent(jk) {
      if (!pipeDeny.has(jk)) return false;
      const until = pipeDenyUntil.get(jk) || 0;
      if (until && Date.now() >= until) { pipeDeny.delete(jk); pipeDenyUntil.delete(jk); return false; }
      return true;
    }
    yield 2038;
    if (__C.MPipe) __C.MPipe.on('codec-mismatch', (m) => {
      const jk = m.pipeId;
      const pj0 = pipeJobs.get(jk), job0 = __C.mosJobs.get(jk);
      // my one encode is VP8: a link that agreed on VP8 as well sends it on this sender (encCodec); only one that cannot keeps its own encoder
      if (pj0 && pj0.enc && !pj0.mis && job0) { pj0.mis = 1; let ok = false; for (let i = 0; i < job0.senders.length; i++) if (job0.trackList[i] === pj0.carrier.track) ok = encCodec(job0.senders[i]); if (ok) return; }
      if (pipeJobs.has(jk)) { if (__C.clog) (0, /*()*/__C.clog)('pipe-mismatch', jk, 'content=' + m.mime, 'link=' + m.tmplMime); pipeDenyStamp(jk); pipeDeny.add(jk); (0, /*()*/__C.unshipJob)(jk, true); } // next sweep re-ships transcoded
    }); // mx-kf sets this for the duration of kfNeed(key)
    const jiggleState = new WeakMap(); // sender -> { base, busy }
    function noteJiggleBase(sd, base) {
      const st = jiggleState.get(sd);
      if (st) st.base = base; else jiggleState.set(sd, { base: base, busy: false });
    }
    // A STARVED ENCODER GETS ONE FORCED KEY PER STARVED_KEY_MS, FROM ANY
    // LEVER. The pulse already stood down on a stalled or cpu-limited
    // encoder (2026-09-03), but every receiver's PLI still reached the
    // producer as a kfNeed jiggle: two encoder re-inits and a forced key per
    // hit, on EVERY sender of the key at once. On a starved stager that was
    // the freeze's engine (e2e-pipe-freeze reds, 2026-10-07: a stager on a
    // loaded ARM box at 7.5 fps, already stepped down to 240x135, 20% of its
    // frames keys, 46 jiggles in one run; every receiver bright-froze 15-20 s).
    // The pulse timer reads each stage sender's own row every 3 s and records
    // here whether it is starved; armJiggle then lets one forced key through
    // per STARVED_KEY_MS per sender (a waiting receiver still gets a key well
    // inside the 12 s freeze bound), and kfNeed stops fanning a key out to
    // every sender of a starved key.
    const STARVED_KEY_MS = GifOS.timings.STARVED_KEY_MS;
    const encHealth = new WeakMap();   // sender -> { starved, at } from the pulse timer
    const keyForcedAt = new WeakMap(); // sender -> ms of the last forced key (pulse or jiggle)
    function senderStarved(sd) {
      const h = encHealth.get(sd);
      return !!(h && h.starved && Date.now() - h.at < 10000);
    }
    // One jiggle at a time per sender. Restore to the stored base, never to
    // the scale read at entry: a pulse and a kfNeed used to each restore the
    // 1.25 they had just written, and the encoder stayed shrunk.
    function armJiggle(sd, key, act) {
      const st0 = jiggleState.get(sd);
      if (st0 && st0.busy) { kfEv(key, act + '-skip', { why: 'jiggling' }); return false; }
      if (senderStarved(sd) && Date.now() - (keyForcedAt.get(sd) || 0) < STARVED_KEY_MS) { kfEv(key, act + '-skip', { why: 'starved' }); return false; }
      keyForcedAt.set(sd, Date.now());
      try {
        const prm = sd.getParameters();
        if (!prm.encodings || !prm.encodings.length) return false;
        const sr0 = (st0 && st0.base) || prm.encodings[0].scaleResolutionDownBy || 1;
        jiggleState.set(sd, { base: sr0, busy: true });
        kfEv(key, act, { sr0 });
        prm.encodings[0].scaleResolutionDownBy = sr0 * 1.25;
        const done = () => { const cur = jiggleState.get(sd); if (cur) cur.busy = false; };
        sd.setParameters(prm).then(() => setTimeout(() => {
          try {
            const p2 = sd.getParameters();
            const cur = jiggleState.get(sd);
            const back = (cur && cur.base) || sr0;
            if (p2.encodings && p2.encodings.length) { p2.encodings[0].scaleResolutionDownBy = back; sd.setParameters(p2).catch(() => {}); }
          } catch (e) {}
          done();
        }, 250)).catch(done);
        return true;
      } catch (e) { const cur = jiggleState.get(sd); if (cur) cur.busy = false; return false; }
    }
    // STAGE-KF-TARGETS
    function kfTargets(entries, key, fromPid) {
      const pref = fromPid ? (key + '>' + fromPid) : '';
      const hit = [], rest = [];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (!e || e.piped || e.key !== key) continue;
        if (pref && e.jk === pref) hit.push(e.jk); else rest.push(e.jk);
      }
      return hit.length ? hit : rest;
    }
    // END-STAGE-KF-TARGETS
    // Forensics: every kfNeed decision, ring-buffered (window.__kfLog — the
    // trail that caught the blur-canvas nudge stalling the self encoder)
    const kfLog = (window.__kfLog = []);
    const kfEv = (key, act, x) => { kfLog.push(Object.assign({ t: Date.now(), key: String(key).slice(0, 18), act }, x || {})); if (kfLog.length > 300) kfLog.shift(); };
    // True only after this key left on the claim's open channel. A closed channel falls through to the producer.
    function keyUp(claim, key) {
      const vp = __C.peers.get(claim.via);
      if (vp && vp.dc && vp.dc.readyState === 'open') { kfEv(key, 'relay', { via: String(claim.via).slice(0, 6) }); (0, /*()*/__C.dcSend)(vp, { k: 'mx-kf', key }); return true; }
      return false;
    }
    // The producer's video senders for this key. The asker's sender is first; a starved key stops after one.
    function producerKey(key, fromPid) {
      const entries = [];
      for (const [jk2, job2] of __C.mosJobs) entries.push({ jk: jk2, key: job2.key, piped: pipeJobs.has(jk2) });
      const order = kfTargets(entries, key, fromPid);
      const one = !!(fromPid && order.length === 1 && order[0] === key + '>' + fromPid);
      for (const jk2 of order) {
        const job2 = __C.mosJobs.get(jk2); if (!job2) continue;
        for (const sd of job2.senders || []) {
          if (!sd || !sd.track || sd.track.kind !== 'video') continue;
          if (armJiggle(sd, key, 'jiggle') && (one || senderStarved(sd))) return;
        }
      }
    }
    yield 2052;
    if (__C.MPipe) __C.MPipe.on('kf-need', (m) => { const job = __C.mosJobs.get(m.pipeId), pj = pipeJobs.get(m.pipeId); if (job && pj && !pj.enc) (0, /*()*/__C.kfNeed)(job.key); });
    // THE STRIP'S ENCODERS ARE JUDGED TOO. The composited Stage strip
    // ('sgs') has no pulse, but kfNeed jiggles its senders exactly like a
    // stager's whenever a deep receiver starves for a key — and a strip
    // compositor on a busy box starves the same way (e2e-pipe-freeze red,
    // 2026-10-07: a deep forwarder's own 'sgs' inbound froze 23 s, and the
    // seat below it 27 s). Sample each sgs sender every 3 s so armJiggle's
    // starved-encoder rule covers the strip as well as the stage.
    const sgsSeen = new WeakMap(); // sender -> framesEncoded at the last sample
    setInterval(() => {
      for (const [jk2, job2] of __C.mosJobs) {
        if (job2.key !== 'sgs' || pipeJobs.has(jk2) || !job2.active) continue;
        const sd = (job2.senders || []).find((x) => x && x.track && x.track.kind === 'video');
        if (!sd || !sd.getStats) continue;
        sd.getStats().then((rep) => {
          let fenc = null, qlim = null, fps = null;
          rep.forEach((r) => { if (r.type === 'outbound-rtp' && r.kind === 'video') { fenc = r.framesEncoded || 0; qlim = r.qualityLimitationReason || null; fps = r.framesPerSecond != null ? r.framesPerSecond : null; } });
          const was = sgsSeen.get(sd);
          if (fenc != null) sgsSeen.set(sd, fenc);
          encHealth.set(sd, { at: Date.now(), starved: (fenc != null && was != null && fenc === was) || qlim === 'cpu' || (fps != null && fps < 5) });
        }).catch(() => {});
      }
    }, 3000);
    // THE STG KEY PULSE (frza20, closing the lane). REACTIVE key recovery
    // measured 14-20s at healthy fps across piped chains: SKR dies at the
    // first demand-minted carrier (Chromium doesn't latch PLIs into it), and
    // the mx-kf walk pays a 2s-per-hop rate limit — a consumer that misses a
    // key is bright-frozen the whole wait. While MY camera is on the Stage
    // its keys are PULSED instead: a sender-side jiggle every 3s bounds any
    // consumer's worst-case key wait to one pulse — roadmap §9a's "pulse a
    // keyframe and delete the back-channel", scoped to the one lane whose
    // producer has no cheap demand lever (packer canvases keep the 1px
    // demand resize). Cost: a key is ~5-10x a delta, so ~+30% stg bitrate
    // while staged — stage-grade budgets absorb it (§9a's own calibration).
    // …AND NEVER ON AN ENCODER THAT IS ALREADY DOWN. A scaleResolutionDownBy
    // change is an encoder re-init. On a healthy encoder that costs a frame;
    // on one that is CPU-limited or has stopped producing frames it is a
    // re-init stacked on a stall every three seconds — and the 0.9.14 cut's
    // two fleet reds (docs/bug-pipe-stg-freeze-2026-08-05.md's shape: every
    // receiver frozen at the same instant, PLIs answered by nothing) both had
    // the stager on the busiest box in the room. So each pulse first reads
    // the sender's own outbound row: framesEncoded flat since the last pulse
    // means the encoder is stalled and the pulse is skipped (the stall is
    // logged); qualityLimitationReason 'cpu' means it is starved and the
    // pulse is skipped too. A consumer's worst-case key wait is unchanged
    // when the encoder is healthy — that is the only case a pulse ever helped.
    const pulseSeen = new WeakMap(); // sender -> framesEncoded at the last pulse
    setInterval(() => {
      if (!__C.myStatus.stg) return;
      const tn = tuneCfg(); if (tn && tn.pulse === 0) return;   // harness lever (measurement only): pulse OFF to attribute a freeze
      for (const [jk2, job2] of __C.mosJobs) {
        if (job2.key.indexOf('stg:' + __C.myId) !== 0 || pipeJobs.has(jk2) || !job2.active) continue;
        for (const sd of job2.senders || []) {
          if (!sd || !sd.track || sd.track.kind !== 'video') continue;
          const key2 = job2.key;
          Promise.resolve(sd.getStats ? sd.getStats() : null).then((rep) => {
            let fenc = null, qlim = null;
            if (rep) rep.forEach((r) => { if (r.type === 'outbound-rtp' && r.kind === 'video') { fenc = r.framesEncoded || 0; qlim = r.qualityLimitationReason || null; } });
            let fps = null, fw = 0;
            if (rep) rep.forEach((r) => { if (r.type === 'outbound-rtp' && r.kind === 'video') { fps = r.framesPerSecond != null ? r.framesPerSecond : null; fw = r.frameWidth || 0; } });
            const was = pulseSeen.get(sd);
            if (fenc != null) pulseSeen.set(sd, fenc);
            // Starved: stalled, cpu-limited, under 5 fps, or stepped down and
            // not yet back over the 12 fps the step-up needs.
            let srNow = 1; try { const pe = sd.getParameters().encodings; srNow = (pe && pe[0] && pe[0].scaleResolutionDownBy) || 1; } catch (e) {}
            const stalledNow = fenc != null && was != null && fenc === was;
            encHealth.set(sd, { at: Date.now(), starved: stalledNow || qlim === 'cpu' || (fps != null && fps < 5) || (srNow >= 2 && fps != null && fps <= 12) });
            if (stalledNow) { kfEv(key2, 'pulse-skip', { why: 'stalled', fenc, qlim }); return; }
            if (qlim === 'cpu') { kfEv(key2, 'pulse-skip', { why: 'cpu', fenc }); return; }
            try {
              const prm = sd.getParameters();
              if (!prm.encodings || !prm.encodings.length) return;
              // A STARVING ENCODER GETS A SMALLER PICTURE BEFORE IT GETS
              // ANOTHER KEY. Measured on a loaded 6-core stager (freeze series
              // D6, E6, 2026-09-03): the stg encoder crawled at 1-3 fps and at
              // that rate every forced key — pulses, PLIs, jiggles — was most
              // of the stream (143 frames, 64 keys); its direct receiver froze
              // 38 s and a seat two hops down decoded ONE frame in 124 s.
              // Chromium's own quality limiter never said 'cpu'. So the pulse
              // timer, which already holds the sender's row, halves the picture
              // while the encoder is below 5 fps at more than 240 px wide and
              // gives it back above 12 fps. The first attempt at this froze a
              // room (E2) — not because of the step-down but because the pulse
              // below still flipped a halved encoder to FULL size every 3 s;
              // the jiggle is relative now.
              const enc0 = prm.encodings[0];
              const sr = enc0.scaleResolutionDownBy || 1;
              // NOT FOR A SCREEN. A shared screen's frame rate is the content's,
              // not the encoder's — a still desktop encodes a frame a second
              // and that is health, not starvation — and its pixels are the
              // whole point (40668d49: a shared screen keeps its pixels). The
              // first cut of the step-down halved a share to 640x360
              // (e2e-screen-share, 0.9.15 gate). The step-down is for a camera
              // on the Stage; a screen keeps its size whatever its rate.
              const sharingScreen = !!(__C.myStatus.scr && __C.screenStream && __C.screenStream.getVideoTracks()[0]);
              if (!sharingScreen && fps != null && fps < 5 && fw > 240 && sr < 2) {
                enc0.scaleResolutionDownBy = 2; noteJiggleBase(sd, 2); kfEv(key2, 'shrink', { fps, fw }); sd.setParameters(prm).catch(() => {}); return;
              }
              if (!sharingScreen && fps != null && fps > 12 && sr >= 2) {
                enc0.scaleResolutionDownBy = 1; noteJiggleBase(sd, 1); kfEv(key2, 'unshrink', { fps }); sd.setParameters(prm).catch(() => {}); return;
              }
              // A screen's rate is its content. The 1.25 jiggle re-inits the
              // encoder. Hop-local PLIs cover a share; the pulse does not.
              if (sharingScreen) { kfEv(key2, 'pulse-skip', { why: 'screen' }); return; }
              armJiggle(sd, key2, 'pulse');
            } catch (e) {}
          }).catch(() => {});
          break; // one video sender carries the job
        }
      }
    }, 3000);
    // DEAD-PIPE WATCHDOG. A pipe that writes nothing while its SOURCE is
    // flowing is broken plumbing, not a quiet room — fall back to transcode.
    // "Flowing" reads the remote track's muted flag: still-frame skip upstream
    // mutes the track within a beat, so legitimate quiet never trips this.
    setInterval(() => {
      if (!pipeJobs.size || !__C.MPipe) return;
      __C.MPipe.stats().then((st) => {
        for (const [jk, pj] of [...pipeJobs]) {
          const job = __C.mosJobs.get(jk);
          if (!job || !job.active) { pj.w0 = null; continue; }
          const s = st[jk];
          const wrote = s ? (s.wrote + (s.primed || 0)) : 0;
          if (pj.w0 == null) { pj.w0 = wrote; pj.stale = 0; continue; }
          const advanced = wrote > pj.w0; pj.w0 = wrote;
          // my own encode-once picture flows while its encoder gives out frames (a paused film, a still screen: quiet, not broken)
          const encMoved = pj.enc && encOut > (pj.o0 == null ? encOut : pj.o0); if (pj.enc) pj.o0 = encOut;
          const flowing = pj.enc ? encMoved : pj.srcTrack && pj.srcTrack.readyState === 'live' && pj.srcTrack.muted === false;
          if (!advanced && flowing) { if (++pj.stale >= 3) { if (__C.clog) (0, /*()*/__C.clog)('pipe-dead', jk, pj.enc ? 'enc' : 'fwd', 'wrote=' + wrote); pipeDenyStamp(jk); pipeDeny.add(jk); (0, /*()*/__C.unshipJob)(jk, true); continue; } }
          else pj.stale = 0;
          // THE PLI TUNNEL, PAGE-SIDE (frza18). A consumer that missed a
          // pipe's birth key PLIs forever and Chromium never latches those
          // PLIs into the demand-minted carrier encoder (measured: 1305
          // PLIs, zero key templates), so the stream stays keyless while
          // bytes flow — invisible to every byte rail. The sender CAN see
          // them: outbound-rtp pliCount. A rise on this beat = the consumer
          // wants a key = kick (ask upstream for key content + mint the key
          // template that pairs with it).
          // The job's VIDEO sender: senders are added in getTracks() order,
          // audio first, so senders[0] read the audio row, found no video
          // outbound-rtp, and the tunnel never fired (chaos-1019: 8 of 8
          // reads on the forwarder hit the audio sender while the viewer
          // sent 200 PLIs).
          const sd = (job.senders || []).find((x) => x && x.track && x.track.kind === 'video') || (job.senders && job.senders[0]);
          if (sd && sd.getStats) {
            sd.getStats().then((rep) => {
              let pli = -1;
              rep.forEach((r) => { if (r.type === 'outbound-rtp' && r.kind === 'video') pli = r.pliCount || 0; });
              if (pli >= 0) {
                if (pj.pli != null && pli > pj.pli) { try { __C.MPipe.keyKick(jk); } catch (e) {} }
                pj.pli = pli;
              }
            }).catch(() => {});
          }
        }
      }).catch(() => {});
    }, 5000);

    // THE CONTAINER-IDENTITY LAW (2026-08-08 — the sender-side campaign the
    // FAILOVER-WAKE graveyard entry names). A job's announced container id is
    // minted ONCE per (key,to) per page life and NEVER changes. Before this,
    // ANY source change — the camera idle-stop re-minting mySelfStream, a
    // blur flip, an upstream carrier's own re-ship arriving as a fresh
    // p.incoming stream, a pipe codec failback, the MOS_GRACE unship/re-want
    // cycle — tore the job down and re-shipped a brand-new MediaStream.
    // Every downstream seat then saw the feed's stream id change under it:
    // its decoder reset, its claim raced the 5s grace (the stage-voice
    // 20.23s claim drop), demand-wakes aimed at the pre-reship sid were
    // silently ignored by the mx-want sid check (the ZOMBIE PARKED PIPE),
    // and each carrier re-shipped in turn — the RESHIP STORM (~6s room
    // renegotiation after every kill). Now the container is a per-job
    // constant (shipContainers, kept across unship) and a source change
    // RECONCILES tracks in place inside shipMos: a same-kind swap is a pure
    // replaceTrack (no renegotiation — the receiver's track object persists
    // and it never even sees the swap) or a pipe re-route (worker repoints
    // the route; sender, carrier and m-line never move); a kind appearing/
    // vanishing adds/removes ONE m-line inside the same container, so the
    // announced sid — and every claim, standby and demand keyed on it —
    // survives. regrabCamera has mutated localStream in place for exactly
    // this reason ("its id is what we announce... must never change
    // mid-meeting"); this generalizes that law to every outbound ship.
    const shipContainers = new Map(); // jk -> the job's forever-container (an id holder; costs nothing)
    // THE PICTURE WAITS FOR ITS SOUND (forwarded Stage feeds). A Stage feed's picture leaves this seat as the bytes it
    // received (the pipe lane, no buffer), but its sound is decoded, held in this seat's jitter buffer and encoded again,
    // so it leaves later, and both are stamped with the time they leave: every seat this copy reaches would see the
    // picture early by this seat's sound buffer (measured: over a second at the start of a file, settling to a fifth of
    // a second; lip sync downstream cannot see it). Each beat reads how long the feed's sound waits here (the jitter
    // buffer's delay over the samples it gave out since the last beat) and holds the pipe's picture that long, so the
    // two leave together. Only the Stage: other forwarded sound is solo (its picture never waits for it, soloSdp).
    const pipeHoldPrev = new WeakMap();   // audio receiver -> { d, n, b, ms, quiet }: its jitter buffer totals at beat b, and the hold read then
    let pipeHoldBeat = 0;
    function pipeHoldSend(jk, pj, ms) {
      // one frame of change is not worth a message (the reading's own noise); the worker glides to the figure
      if (pj.hold != null && Math.abs(ms - pj.hold) / 1000 * GifOS.timings.STAGE_FPS < 1) return;
      pj.hold = ms;
      // the queue's extra room: every frame that arrives while one waits, at up to twice the Stage rate
      __C.MPipe.holdPipe(jk, ms, Math.ceil(ms / 1000 * GifOS.timings.STAGE_FPS * 2));
    }
    function pipeHoldTick() {
      if (!pipeJobs.size || !__C.MPipe || typeof __C.MPipe.holdPipe !== 'function') return;
      // One feed's sound can be forwarded to several seats: read each receiver once a beat, then hold every pipe it feeds.
      const byRcv = new Map();   // audio receiver -> [[jk, pj]]
      for (const [jk, pj] of pipeJobs) {
        const job = __C.mosJobs.get(jk);
        if (!job || pj.enc || !(0, /*()*/__C.isStageJob)(job.key)) continue;   // an encode-once pipe waits for its encoder, the worker's own figure
        const at = (job.srcTracks || []).find((t) => t && t.kind === 'audio' && t.readyState === 'live');
        let rcv = null; try { rcv = at ? __C.MPipe.receiverForTrack(at, pipePcs()) : null; } catch (e) {}
        if (!rcv || typeof rcv.getStats !== 'function') { if (pj.hold) pipeHoldSend(jk, pj, 0); continue; }
        // a new pipe of a sound already read takes that reading now, not two beats later (a file's start is when it is largest)
        const known = pipeHoldPrev.get(rcv);
        if (pj.hold == null && known && known.ms != null) pipeHoldSend(jk, pj, known.ms);
        if (!byRcv.has(rcv)) byRcv.set(rcv, []);
        byRcv.get(rcv).push([jk, pj]);
      }
      const b = ++pipeHoldBeat;
      for (const [rcv, jobs] of byRcv) {
        rcv.getStats().then((rep) => {
          let d = null, n = 0;
          rep.forEach((r) => { if (r.type === 'inbound-rtp' && r.kind === 'audio') { d = r.jitterBufferDelay; n = r.jitterBufferEmittedCount || 0; } });
          if (d == null) return;
          const was = pipeHoldPrev.get(rcv);
          const cur = { d, n, b, ms: was ? was.ms : null, quiet: was ? was.quiet : 0 };
          pipeHoldPrev.set(rcv, cur);
          let ms = null;
          // a reading spans one beat: an older one averages over a gap and says nothing about now
          if (was && b - was.b <= 2) {
            if (n > was.n) { cur.quiet = 0; ms = Math.max(0, Math.min(GifOS.timings.PIPE_HOLD_MAX_MS, Math.round(1000 * (d - was.d) / (n - was.n)))); }
            // the sound gave out nothing for two beats (muted, parked, silent): no sound to wait for
            else if (++cur.quiet >= 2) ms = 0;
          }
          if (ms == null) return;
          cur.ms = ms;
          for (const [jk, pj] of jobs) if (pipeJobs.get(jk) === pj) pipeHoldSend(jk, pj, ms);
        }).catch(() => {});
      }
    }
    setInterval(pipeHoldTick, GifOS.timings.PIPE_HOLD_EVERY_MS);

    // MY STAGE PICTURE IS ENCODED ONCE (mesh-pipe.js, ENCODE ONCE). Each link that carried my Stage picture ran its own
    // encoder of the same track: N direct viewers, N encoders. Where the browser can, the picture is encoded once in
    // the pipe worker and every link carries those bytes on the pipe lane, as a forwarded feed's links do. A link
    // that cannot take them keeps its own encoder: a TURN link whose server throttles (its smaller picture and fewer
    // frames are made by its own encoder), and a link whose codec differs or whose pipe fails (pipeDeny). A phone
    // keeps one encoder per link too: those are its hardware's, and the one encoder here would run in software.
    //   THE SOUND WAITS WITH THE PICTURE. The one encoder's frames leave a steady dt after their capture (the worker's
    //   figure, 'enc-stat'); the links that carry them get my Stage sound through one delay of the same dt, so
    //   picture and sound leave together. The other links keep the sound as it is.
    const ENC_STG = 'enc:stg';
    let encSnd = null;   // { src, ctx, delay, out }: my Stage sound, delayed by the encoder's dt
    let encDt = null, encSyncT = 0, encOut = 0;   // encOut: frames the one encoder has given out (the dead-pipe watchdog's "flowing")
    const encBps = () => {
      const kb = (0, /*()*/__C.sharingScreen)(__C.myId) ? Math.max((0, /*()*/__C.stageCeilingKbps)(), (0, /*()*/__C.screenCeilingKbps)()) : (0, /*()*/__C.stageCeilingKbps)();
      return Math.round(kb * __C.powDials.stageKbps) * 1000;
    };
    // The delay's own audio context (it plays nothing: no output device). Until it runs (a page no one has touched
    // yet), the sound goes out undelayed, early by the encoder's dt, and the next beat tries again.
    let encAc = null;
    const encCtx = () => {
      if (!encAc || encAc.state === 'closed') { try { encAc = (0, /*()*/__C.newMeetAudioContext)(); } catch (e) { encAc = null; } }
      if (encAc && encAc.state !== 'running') { try { const pr = encAc.resume(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {} }
      return encAc && encAc.state === 'running' ? encAc : null;
    };
    const encLinkOk = (p) => !(p && __C.turnLinks && __C.turnLinks.videoStep(p.id));
    function encWanted(job, p, tr) {
      return !!(tr && tr.kind === 'video' && job && typeof job.key === 'string' && job.key.indexOf('stg:' + __C.myId) === 0
        && !__C.IS_MOBILE && __C.MPipe && typeof __C.MPipe.encOk === 'function' && __C.MPipe.encOk() && encLinkOk(p));
    }
    // THE ONE ENCODE IS VP8. Links prefer H.264 between them; a sender that carries the one encode picks VP8 out of the
    // codecs its link agreed on (no new offer: the far end already takes VP8 on that line). True once VP8 is asked for
    // or already set; false where the link has no VP8 or the browser cannot pick a codec per sender.
    function encCodec(sd) {
      try {
        const prm = sd.getParameters();
        if (!prm || !prm.encodings || !prm.encodings.length || !prm.codecs) return false;
        const vp8 = prm.codecs.find((c) => /video\/vp8/i.test(c.mimeType));
        if (!vp8) return false;
        const cur = prm.encodings[0].codec;
        if (cur && /video\/vp8/i.test(cur.mimeType)) return true;
        prm.encodings[0].codec = vp8;
        sd.setParameters(prm).catch(() => {});
        return true;
      } catch (e) { return false; }
    }
    function encCodecWhenStable(pc, sd) {
      if (encCodec(sd)) return;
      const on = () => { try { if (pc.signalingState !== 'stable') return; if (encCodec(sd) || pc.signalingState === 'closed') pc.removeEventListener('signalingstatechange', on); } catch (e) {} };
      try { pc.addEventListener('signalingstatechange', on); } catch (e) {}
    }
    const encFeed = (tr) => __C.MPipe.encSource(ENC_STG, tr, { bps: encBps(), fps: (0, /*()*/__C.stageFps)() });
    function encTune() { const t = __C.MPipe && __C.MPipe.encTrack ? __C.MPipe.encTrack(ENC_STG) : null; if (t) encFeed(t); }
    function encSoundStop() { const S = encSnd; encSnd = null; if (!S) return; try { S.srcN.disconnect(); S.delay.disconnect(); } catch (e) {} try { S.out.stop(); } catch (e) {} }
    function encSoundSet() {
      if (!encSnd || encDt == null) return;
      const want = Math.max(0, Math.min(1, (encDt + GifOS.timings.ENC_SOUND_TRIM_MS) / 1000));
      try { if (Math.abs(encSnd.delay.delayTime.value - want) > 0.004) encSnd.delay.delayTime.setTargetAtTime(want, encSnd.ctx.currentTime, 0.2); } catch (e) {}
    }
    // The delayed copy of my Stage sound at; null where it cannot be made (the link then keeps the sound as it is).
    function encSoundFor(at) {
      const ctx = at && at.readyState === 'live' ? encCtx() : null;
      if (!ctx) return null;
      if (encSnd && (encSnd.src !== at || encSnd.ctx !== ctx || encSnd.out.readyState === 'ended')) encSoundStop();
      if (!encSnd) {
        try {
          const delay = ctx.createDelay(1), dst = ctx.createMediaStreamDestination(), srcN = ctx.createMediaStreamSource(new MediaStream([at]));
          srcN.connect(delay); delay.connect(dst);
          encSnd = { src: at, ctx, delay, srcN, out: dst.stream.getAudioTracks()[0] };
          if (encDt != null) { try { delay.delayTime.value = Math.max(0, Math.min(1, (encDt + GifOS.timings.ENC_SOUND_TRIM_MS) / 1000)); } catch (e) {} }
        } catch (e) { encSnd = null; return null; }
      }
      return encSnd.out;
    }
    // One place decides, for every Stage job of mine: an encode-once picture goes with the delayed sound, any other
    // with the sound as it is; a link that may no longer carry the one encode goes back to its own encoder; and the
    // encoder stops when no link is left to carry it.
    function encSync() {
      encSyncT = 0;
      if (!__C.MPipe || typeof __C.MPipe.encOk !== 'function') return;
      let any = false;
      for (const [jk, pj] of [...pipeJobs]) {
        if (!pj.enc) continue;
        const job = __C.mosJobs.get(jk), p = job ? __C.peers.get(job.to) : null;
        if (job && !encLinkOk(p)) { if (__C.clog) (0, /*()*/__C.clog)('enc-turn-step', jk); pipeDenyStamp(jk); pipeDeny.add(jk); (0, /*()*/__C.unshipJob)(jk, true); continue; }   // the next sweep ships it with its own encoder
        any = true;
        if (job) for (let i = 0; i < job.senders.length; i++) if (job.trackList[i] === pj.carrier.track) encCodec(job.senders[i]);
      }
      const mine = 'stg:' + __C.myId;
      for (const [jk, job] of __C.mosJobs) {
        if (typeof job.key !== 'string' || job.key.indexOf(mine) !== 0 || !job.senders || !job.srcTracks) continue;
        const pj = pipeJobs.get(jk);
        for (let i = 0; i < job.srcTracks.length; i++) {
          const at = job.srcTracks[i];
          if (!at || at.kind !== 'audio' || !job.senders[i]) continue;
          const want = (pj && pj.enc && encSoundFor(at)) || at;
          if (job.trackList[i] === want) continue;
          if (job.active && !job.carryOff && !(typeof __C.outgoingHeld !== 'undefined' && __C.outgoingHeld)) { try { const pr = job.senders[i].replaceTrack(want); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {} }
          job.trackList[i] = want;
        }
      }
      if (!any && __C.MPipe.encTrack(ENC_STG)) { if (__C.clog) (0, /*()*/__C.clog)('enc-stop'); __C.MPipe.encStop(ENC_STG); encSoundStop(); encDt = null; }
    }
    function encSyncSoon() { if (encSyncT) return; encSyncT = 1; Promise.resolve().then(() => { try { encSync(); } catch (e) {} }); }
    setInterval(() => { try { encSync(); } catch (e) {} }, GifOS.timings.PIPE_HOLD_EVERY_MS);
    if (__C.MPipe && typeof __C.MPipe.encOk === 'function') {
      __C.MPipe.on('enc-stat', (m) => { if (m.srcId !== ENC_STG) return; encOut = m.out || 0; if (m.dt == null) return; encDt = m.dt; encSoundSet(); });
      // the one encoder failed: every link takes its own encoder again
      __C.MPipe.on('enc-dead', (m) => { if (m.srcId !== ENC_STG) return; if (__C.clog) (0, /*()*/__C.clog)('enc-dead', String(m.err || '')); for (const [jk, pj] of [...pipeJobs]) if (pj.enc) { pipeDenyStamp(jk); pipeDeny.add(jk); (0, /*()*/__C.unshipJob)(jk, true); } try { __C.MPipe.encStop(ENC_STG); } catch (e) {} });
    }
    // Attach ONE source track to a job — the pipe lane first (remote-receiver
    // video only, the one rule), transcode otherwise. The single place a
    // job's sender is born: the fresh-ship loop and the reconcile path both
    // come through here, so the lane decision can never fork between them.
    // trackList holds the CARRIER for a piped slot — dormancy (setJobActive)
    // replaceTracks it back on wake; re-attaching the remote track would
    // re-enter the transcode path with the pipe transform still on the
    // sender. stg:* (CAMERA-origin) rides the pipe lane too — RE-SCOPED
    // 2026-08-04 after the freeze was decomposed across devices
    // (pipe-freeze-probe, frza runs; the 9bf885d scope-out records the
    // original observation). What the freeze actually was: WebRTC emits NO
    // periodic keyframes, so a pipe going hot mid-GOP starved for key
    // content; the mx-kf DC walk answered by NUDGING THE PRODUCER'S CAPTURE,
    // and when the producer was a blur pipe (the self stream's privacy
    // steady state) the 1px canvas resize stalled its encoder 10-20s —
    // freezing every receiver of every copy at once, recurring as each
    // starving hop re-fired the walk. Camera-origin content only ever
    // surfaced it because stg is the one lane whose producer isn't a
    // self-restoring packer canvas. The fix is structural, not stg-specific:
    // keyframe recovery is hop-local RTCP (the tap's sendKeyFrameRequest,
    // chaining hop-by-hop to the producer's real encoder — mesh-pipe.js
    // header), and the fallback mx-kf producer lever is a sender-side
    // scaleResolutionDownBy jiggle that never touches capture.
    function attachTrack(job, jk, p, tr) {
      pipeDenyCurrent(jk); // a lapsed deny is not a deny
      if (tr.kind === 'video' && (0, /*()*/__C.pipeEnabled)() && !pipeDeny.has(jk) && !pipeJobs.has(jk)) {
        try {
          const rcv = __C.MPipe.receiverForTrack(tr, pipePcs());
          const enc = !rcv && encWanted(job, p, tr) && encFeed(tr);   // my own Stage picture: encoded once for every link (encode once, below)
          const srcId = enc ? ENC_STG : rcv && 'rx:' + tr.id;
          if (enc || (rcv && __C.MPipe.tapReceiver(rcv, srcId))) {
            const carrier = __C.MPipe.makeCarrier();
            const sd = (0, /*()*/__C.addAux)(p.pc, carrier.track, job.container);
            if (enc) encCodecWhenStable(p.pc, sd);   // this sender carries the one encode: it sends VP8
            if (__C.MPipe.pipeSender(sd, srcId, jk, carrier)) {
              pipeJobs.set(jk, { srcId, carrier, srcTrack: tr, w0: null, stale: 0, enc });
              if (enc) { if (__C.clog) (0, /*()*/__C.clog)('enc-attach', jk); encSyncSoon(); }
              job.senders.push(sd); job.trackList.push(carrier.track); job.srcTracks.push(tr);
              if ((0, /*()*/__C.isStageJob)(job.key)) __C.stageSenders.add(sd); else __C.lowSenders.add(sd);
              if (!job.active || job.vParked) { try { sd.replaceTrack(null); } catch (e) {} try { __C.MPipe.pausePipe(jk, true); } catch (e) {} }
              else if (typeof __C.outgoingHeld !== 'undefined' && __C.outgoingHeld) { try { sd.replaceTrack(null); } catch (e) {} }
              job.attachErr = null;
              return sd;
            }
            // the carrier's m-line must not stay in the container beside the transcode one below (a second video track at the receiver)
            __C.auxSenders.delete(sd); (0, /*()*/__C.auxDrop)(p.pc, sd); (0, /*()*/__C.stopAuxTx)(p.pc, sd, job.key);
            carrier.stop();
          }
        } catch (e) {}
      }
      try {
        const st = wkFwdSrc(tr, job.key);   // WebKit: a fixed-size copy of a received picture
        if (tr.kind === 'audio' && !(0, /*()*/__C.isStageJob)(job.key)) { try { job.container.__solo = true; } catch (e) {} }   // a block's sound: its picture does not wait for it (soloSdp)
        const sd = (0, /*()*/__C.addAux)(p.pc, st, job.container);
        job.senders.push(sd); job.trackList.push(st); job.srcTracks.push(tr);
        if ((0, /*()*/__C.isStageJob)(job.key)) __C.stageSenders.add(sd); else __C.lowSenders.add(sd);
        if (!job.active || (job.vParked && tr.kind === 'video')) { try { sd.replaceTrack(null); } catch (e) {} }
        else if (typeof __C.outgoingHeld !== 'undefined' && __C.outgoingHeld) { try { sd.replaceTrack(null); } catch (e) {} }
        job.attachErr = null;
        return sd;
      } catch (e) { job.attachErr = (e && e.name) || 'error'; }
      return null;
    }
    // Detach ONE sender from a job — the m-line stops (bounded SDP, same as
    // unshipMos) but the job and its container live on.
    function detachTrack(job, jk, p, idx) {
      const sd = job.senders[idx];
      __C.auxSenders.delete(sd); __C.stageSenders.delete(sd);
      const pj = pipeJobs.get(jk);
      if (pj && job.trackList[idx] === pj.carrier.track) { pipeJobs.delete(jk); try { __C.MPipe.unpipe(pj.srcId, jk); } catch (e) {} }
      if (p && p.pc) {
        (0, /*()*/__C.auxDrop)(p.pc, sd);
        (0, /*()*/__C.stopAuxTx)(p.pc, sd, job.key);
      }
      job.senders.splice(idx, 1); job.trackList.splice(idx, 1); job.srcTracks.splice(idx, 1);
    }
    // A WEBKIT FORWARD SHIPS A FIXED-SIZE COPY OF THE PICTURE IT RECEIVED.
    // Measured 2026-11-07 on the Playwright WebKit shell (no
    // RTCRtpScriptTransform, so no pipe lane: a received video is re-encoded):
    // a video sender encodes nothing more, for good, once its source changes
    // size (a pack that gains a face, a share that starts). replaceTrack, a
    // null-then-track kick and a new track of a new size on the same sender all
    // stay dead (bare probes bare5-bare8: Chromium source 320x240 -> 220x110);
    // a new transceiver revives it, but re-laning that way killed the web
    // process in 4 of 4 rooms. So the forward never changes size: the received
    // video is drawn into a canvas of one fixed size, and that canvas's track is
    // what ships, on one sender, for the life of the forward. A pack is drawn
    // width-fit from the top (cells stay square; the black below is the row-step
    // tail faceSrcRect already ignores); a stage or shared screen is drawn
    // contain-fit, centred. Audio ships as received. Chromium and Firefox, real Safari (it has
    // RTCRtpScriptTransform) and a WebKit slot on the pipe lane never take this path.
    const WK_FWD_PACK = { w: 320, h: 1280, fps: 20 };   // a Stadium column: 5 wide x 20 rows fits
    const WK_FWD_STAGE = { w: 640, h: 360, fps: 30 };
    const wkFwdCopies = new Map(); // `${profile}|${track.id}` -> { src, track, stop }
    let wkFwdClock = null;
    // Only a WebKit with no RTCRtpScriptTransform (the Linux shell). Real Safari has it, and there a received
    // track forwards as is through every size change (2026-11-07, Safari 27 on macOS: video, Stadium, stage and
    // share reach two seats whose only uplink is the Safari seat, release code), so it never takes this path.
    function wkFwdNeeded() { return typeof WEBKIT_ENGINE !== 'undefined' && !!WEBKIT_ENGINE && typeof RTCRtpScriptTransform === 'undefined'; }
    function wkFwdSrc(tr, key) {
      if (!wkFwdNeeded() || !tr || tr.kind !== 'video' || typeof wkRemoteTrack !== 'function' || !wkRemoteTrack(tr)) return tr;
      const stage = (0, /*()*/__C.isStageJob)(key), prof = stage ? WK_FWD_STAGE : WK_FWD_PACK, ck = (stage ? 's' : 'p') + '|' + tr.id;
      const have = wkFwdCopies.get(ck);
      if (have && have.track.readyState !== 'ended') return have.track;
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.autoplay = true;
      v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
      v.srcObject = new MediaStream([tr]);   // video only: no audio device opens on this bind
      try { document.body.appendChild(v); } catch (e) {}   // a detached <video> never starts on this WebKit
      const pr = v.play(); if (pr && pr.catch) pr.catch(() => {});
      const cv = document.createElement('canvas'); cv.width = prof.w; cv.height = prof.h;
      const g = cv.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, prof.w, prof.h);
      const out = cv.captureStream(prof.fps).getVideoTracks()[0];
      let kickAt = Date.now();
      const paint = () => {
        const w = v.videoWidth, h = v.videoHeight;
        if (!w || !h) {
          // This WebKit can leave a fresh <video> at readyState 0 on its first bind; a re-bind with a new stream starts it (webkit-media 2026-11-06).
          if (v.readyState === 0 && Date.now() - kickAt > 2000 && tr.readyState !== 'ended') { kickAt = Date.now(); try { v.srcObject = new MediaStream([tr]); const p2 = v.play(); if (p2 && p2.catch) p2.catch(() => {}); } catch (e) {} }
          return;
        }
        let dw = prof.w, dh = Math.round(h * prof.w / w), dx = 0, dy = 0;
        if (stage) { const k = Math.min(prof.w / w, prof.h / h); dw = Math.round(w * k); dh = Math.round(h * k); dx = (prof.w - dw) >> 1; dy = (prof.h - dh) >> 1; }
        else if (dh > prof.h) { dh = prof.h; dw = Math.round(w * prof.h / h); }   // taller than the column: shrink (cells stay square, a strip on the right stays black)
        g.fillRect(0, 0, prof.w, prof.h);
        try { g.drawImage(v, dx, dy, dw, dh); } catch (e) {}
      };
      const clk = MM.workerClock(Math.round(1000 / prof.fps), paint);
      const c = { src: tr, v, track: out, stop: () => { try { clk && clk.stop && clk.stop(); } catch (e) {} try { out.stop(); } catch (e) {} try { v.srcObject = null; v.remove(); } catch (e) {} } };
      wkFwdCopies.set(ck, c);
      try { tr.addEventListener('ended', () => { if (wkFwdCopies.get(ck) === c) { wkFwdCopies.delete(ck); c.stop(); } }); } catch (e) {}
      if (!wkFwdClock) wkFwdClock = setInterval(wkFwdGc, 5000);
      try { (window.__wkFwd = window.__wkFwd || []).push({ t: Date.now(), key: String(key).slice(0, 24), prof: stage ? 'stage' : 'pack' }); if (window.__wkFwd.length > 40) window.__wkFwd.shift(); } catch (e) {}
      return out;
    }
    // A copy no job ships any more is stopped (its paint clock and encoder source go with it).
    function wkFwdGc() {
      if (!wkFwdCopies.size) return;
      const used = new Set();
      for (const job of __C.mosJobs.values()) for (const t of job.trackList) used.add(t);
      for (const [ck, c] of [...wkFwdCopies]) if (!used.has(c.track)) { wkFwdCopies.delete(ck); c.stop(); }
    }
    yield 2095;
    function orphaned(job, p) {
      return !!(job && job.senders && job.senders.length && p && p.pc
        && typeof p.pc.getSenders === 'function' && !p.pc.getSenders().includes(job.senders[0]));
    }
    function containerFor(jk) {
      const container = shipContainers.get(jk) || new MediaStream();
      shipContainers.set(jk, container);
      return container;
    }
    function dropContainer(jk) { shipContainers.delete(jk); }
    function attachFailed(to, gen) { return attachFailAt.get(to) === gen; }
    attachFailed.set = function (to, gen) { if (gen == null) attachFailAt.delete(to); else attachFailAt.set(to, gen); };
    function noteReship(row) {
      try {
        if (!window.__mosReship) window.__mosReship = [];
        window.__mosReship.push(row);
        if (window.__mosReship.length > 40) window.__mosReship.shift();
      } catch (e) {}
    }
    // One slot of a live job. Returns 'swap', 'reroute' or 'relane'. The caller's loop owns ops and haveIdx.
    // nt.kind stands in for the loop's kind: wantK is already that kind. cur/i/nt keep the replaceTrack line.
    function swapTrack(job, jk, p, idx, track) {
      const cur = job, i = idx, nt = track;
      const pj = pipeJobs.get(jk);
      if (pj && cur.trackList[i] === pj.carrier.track) {
        // piped slot: repoint the worker's route at the new source's tap
        // — sender, carrier and m-line never move. (Every inbound video
        // receiver is tapped at ontrack already; a codec change surfaces
        // as the ordinary mismatch -> pipeDeny -> transcode re-lane.)
        let rr = false;
        try {
          pipeDenyCurrent(jk);
          const rcv = (0, /*()*/__C.pipeEnabled)() && !pipeDeny.has(jk) && __C.MPipe.receiverForTrack(nt, pipePcs());
          const srcId = rcv && 'rx:' + nt.id;
          // my own next picture (the next film, a camera or blur change) goes into the same encoder: the links never move
          if (pj.enc && !rcv && !pipeDeny.has(jk) && encWanted(cur, p, nt) && encFeed(nt)) { pj.srcTrack = nt; pj.w0 = null; pj.stale = 0; cur.srcTracks[i] = nt; encSyncSoon(); return 'reroute'; }
          if (pj.enc) { /* no longer mine to encode once: re-lane below */ }
          else if (rcv && __C.MPipe.tapReceiver(rcv, srcId)) {
            __C.MPipe.reroute(jk, pj.srcId, srcId);
            pj.srcId = srcId; pj.srcTrack = nt; pj.w0 = null; pj.stale = 0;
            cur.srcTracks[i] = nt; rr = true;
          }
        } catch (e) {}
        if (!rr) { detachTrack(cur, jk, p, i); attachTrack(cur, jk, p, nt); return 'relane'; }
        return 'reroute';
      }
      // transcode slot. If the NEW source belongs on the pipe lane
      // (remote-receiver video), re-lane it; otherwise a pure
      // replaceTrack — no renegotiation, invisible to the receiver
      // (its track object persists and only the content changes).
      pipeDenyCurrent(jk);
      const wantsPipe = nt.kind === 'video' && (0, /*()*/__C.pipeEnabled)() && !pipeDeny.has(jk) && !pipeJobs.has(jk)
        && (() => { try { return !!__C.MPipe.receiverForTrack(nt, pipePcs()) || encWanted(cur, p, nt); } catch (e) { return false; } })();
      if (wantsPipe) { detachTrack(cur, jk, p, i); attachTrack(cur, jk, p, nt); return 'relane'; }
      const st = wkFwdSrc(nt, cur.key);   // WebKit: the new source's fixed-size copy, the same size the sender already encodes
      if (cur.active && !cur.carryOff && jobSendsAt(cur, i) && !(typeof __C.outgoingHeld !== 'undefined' && __C.outgoingHeld)) { try { cur.senders[i].replaceTrack(st); } catch (e) {} }
      cur.trackList[i] = st; cur.srcTracks[i] = nt;
      if (nt.kind === 'audio' && pj && pj.enc) encSyncSoon();
      return 'swap';
    }
    // replaceTrack, and one pausePipe for the job when this sender is the pipe's deciding sender.
    // Audio runs before video (shipTracks); it remembers the job and the video call pauses once.
    // _wake distinguishes a vParked-wake (skip pause while carryOff) from the main-path unpause,
    // which calls with the same null track on a video-only job.
    function parkSender(sd, trackOrNull) {
      try { if (sd) sd.replaceTrack(trackOrNull); } catch (e) {}
      if (!sd || !__C.MPipe) return;
      let found = null;
      for (const [jk, job] of __C.mosJobs) {
        if (!job.senders || !pipeJobs.has(jk)) continue;
        const i = job.senders.indexOf(sd);
        if (i < 0) continue;
        found = { jk, job, i };
        break;
      }
      if (!found) return;
      const jk = found.jk, job = found.job, i = found.i;
      const kind = job.trackList[i] && job.trackList[i].kind;
      let video = false;
      for (let k = 0; k < job.senders.length; k++) if (job.trackList[k] && job.trackList[k].kind === 'video') video = true;
      if (kind === 'audio' && video) { (parkSender._aud || (parkSender._aud = {}))[jk] = 1; return; }
      const heard = parkSender._aud && parkSender._aud[jk];
      if (parkSender._aud) delete parkSender._aud[jk];
      try {
        if (job.vParked) __C.MPipe.pausePipe(jk, true);
        else if (!job.active) __C.MPipe.pausePipe(jk, true);
        else if (parkSender._wake && job.carryOff && !heard) return;
        else __C.MPipe.pausePipe(jk, false);
      } catch (e) {}
    }
    yield 2107;
    // END-CHAIN-PARK
    // A slow relay, for tests: while held, this seat starts no NEW relay of a
    // stage feed (a copy it already ships keeps going). DEBUG only.
    const relayHeldForTest = (key, to) => __C.DEBUG_ON && (window.__relayHoldUntil || 0) > Date.now() && !__C.mosJobs.has(key + '>' + to);
    // DEBUG (e2e-mute-leak MUTE_ONE_ROOT): my own stage feed enters Section 1 at ONE seat, the first of my row and column mates,
    // as it does for a stager with a single mate, so the whole room hangs off that seat's claim.
    const oneRootSkipForTest = (owner, t, list) => __C.DEBUG_ON && owner === __C.myId && !!window.__stgOneRootForTest && t !== list.filter(Boolean)[0];
    const jobPinned = (jk) => __C.DEBUG_ON && ((window.__parkedJobs && (window.__parkedJobs.get(jk) || 0) > Date.now()) || (stubDuties.on && (0, /*()*/__C.dutyJob)(jk)));
    yield 2111;
    // DEBUG LEVER (owed-duty evidence, the core's dutyMuteForTest): while on, every duty job of mine is parked like a
    // self-lease (replaceTrack(null), m-lines kept) and its wakes are refused, so its receivers get nothing while the
    // links, beats and every other job run on; the report says 'no-track'. Off wakes the jobs it parked.
    function stubDuties(on) {
      if (!__C.DEBUG_ON) return false;
      stubDuties.on = !!on;
      if (stubDuties.on) dutyMuteTick();
      else { const was = stubDuties.parked || []; stubDuties.parked = []; for (const jk of was) (0, /*()*/__C.setJobActive)(jk, true); }
      try { refreshOutbound(); } catch (e) {}
      return stubDuties.on;
    }
    function dutyMuteTick() {
      if (!stubDuties.on) return;
      stubDuties.parked = stubDuties.parked || [];
      for (const [jk, job] of __C.mosJobs) if (job.active && (0, /*()*/__C.dutyJob)(jk)) { if (stubDuties.parked.indexOf(jk) < 0) stubDuties.parked.push(jk); (0, /*()*/__C.setJobActive)(jk, false); }
    }
    // After a mosaic reconcile and on the 1 s clock: the lever re-applied, and a change in which duty jobs carry (to whom)
    // re-runs refreshOutbound, so the plan's report reads the jobs as they are, not as the last plan change left them.
    function dutyTick() {
      dutyMuteTick();
      let sig = ''; for (const [jk, job] of __C.mosJobs) if ((0, /*()*/__C.dutyJob)(jk)) sig += jk + (dutyTrack(job.to, job.key) ? '+' : '-') + ',';
      if (sig !== dutyTick.sig) { dutyTick.sig = sig; refreshOutbound(); }
    }
    yield 2115;
    let leaseShown = false; const leaseJobs = new Set();
    function selfLeaseTick() {
      const on = (0, /*()*/__C.seatSelfLeased)(); if (on === leaseShown) return;
      leaseShown = on; if (typeof __C.clog === 'function') (0, /*()*/__C.clog)('self-lease ' + (on ? 'on' : 'off'));
      if (on) { for (const [jk, job] of __C.mosJobs) if (job.active) { leaseJobs.add(jk); (0, /*()*/__C.setJobActive)(jk, false); } }
      else { for (const jk of leaseJobs) (0, /*()*/__C.setJobActive)(jk, true); leaseJobs.clear(); }
      try { refreshOutbound(); } catch (e) {}
    }
    GifOS.meshMedia.workerClock(1000, () => { try { selfLeaseTick(); } catch (e) {} try { dutyTick(); } catch (e) {} });
    yield 2120;
    // PICTURE-ONLY PARK (mx-idle v:1): the receiver restarts its decoder. Only the job's video stops (a piped picture at
    // the worker too); the job stays active, so its voice keeps flowing and the next want is no wake of a parked copy.
    const jobVideoAt = (job, i) => !!(job.trackList[i] && job.trackList[i].kind === 'video');
    const jobSendsAt = (job, i) => !(job.vParked && jobVideoAt(job, i));
    yield 2124;
    // STAGE-DOWN-SHIP
    // Below Section 1 the strip already carries the picture. A down hop ships
    // the stager's audio unless that stager is sharing a screen.
    function stgDownShip(key, stream, screenOn, memo) {
      if (!stream) return null;
      const owner = typeof key === 'string' && key.indexOf('stg:') === 0 ? key.slice(4).split('^')[0] : null;
      if (owner && screenOn) return stream;
      const tracks = typeof stream.getAudioTracks === 'function' ? stream.getAudioTracks() : [];
      const aud = [];
      for (let i = 0; i < tracks.length; i++) {
        const tr = tracks[i];
        if (tr && tr.readyState !== 'ended') aud.push(tr);
      }
      if (!aud.length) return null;
      const a0 = aud[0];
      const prev = memo && memo.get(stream);
      if (prev && prev.a === a0 && prev.n === aud.length) return prev.stream;
      const out = new MediaStream(aud);
      if (memo) memo.set(stream, { a: a0, n: aud.length, stream: out });
      return out;
    }
    // An audio-only down copy is announced ao:1. It carries no face, so the
    // receiver must never relay it up or across toward Section 1, where it
    // would sit as a standby for the strip and win a failover with no video.
    function stgDownMeta(meta, sent, src) {
      return sent === src ? meta : Object.assign({}, meta, { ao: 1 });
    }
    // The claim stream a carry entry ships. OWN rows stay in the plane. A split sdn is the memoized fwd pair.
    // An audio-only stage down is stgDownShip. Every other passthrough is the claim stream itself.
    function streamFor(e) {
      if (!e || e.own) return null;
      if ((e.video && e.video.own === 'stage') || (e.audio && e.audio.own === 'stage')) return null;
      if (e.audio && e.audio.own === 'mic') {
        const mic = selfFoldStream();
        const tr = mic && typeof mic.getAudioTracks === 'function' ? mic.getAudioTracks()[0] : null;
        if (!tr || tr.readyState === 'ended') return null;
        return mic;
      }
      if (e.audio && e.audio.mix) {
        const f = downFolds.get(e.audio.mix);
        const t = f && typeof f.track === 'function' ? f.track() : null;
        const a = t && t.readyState !== 'ended' ? t : null;
        if (e.video && e.video.pack) {
          const pk = packFor(e.video.pack, e.video.skip);
          let v = pk && pk.track;
          if (v && e.video.pack === 'room') v = packLoopTrack(v) || v;
          if (!v || !a) return null;
          return downStream(e.audio.mix, v, a);
        }
        let v = null;
        if (e.video && e.video.in) {
          const ent = __C.mosIn.get(e.video.in);
          const vts = ent && ent.stream && typeof ent.stream.getVideoTracks === 'function' ? ent.stream.getVideoTracks() : [];
          const v0 = vts[0] || null;
          if (v0 && v0.readyState !== 'ended') v = v0;
        }
        return downStream(e.audio.mix, v, a);
      }
      // A product row has no mix fold. The ship is the packer's own stream (picture plus the fold it was born with).
      if (e.video && e.video.pack && !e.audio) {
        const kind = e.video.pack, skip = e.video.skip;
        let pk = null;
        if (kind === 'prod') pk = prodPack;
        else if (kind === 'room') pk = roomPack;
        else if (kind === 'pipe') pk = pipePacks.get(skip);
        else if (kind === 'l14') pk = l14Packs.get(skip);
        if (!pk || !(pk.count() > 0) || !pk.track || !pk.stream) return null;
        return pk.stream;
      }
      if (e.key === 'sdn' && e.video && e.video.in === 'sdm' && (!e.audio || e.audio.in === 'sdx')) {
        const sdmF = __C.mosIn.get('sdm');
        const sdx = __C.mosIn.get('sdx');
        const vts = sdmF && sdmF.stream && typeof sdmF.stream.getVideoTracks === 'function' ? sdmF.stream.getVideoTracks() : [];
        const fwdV = vts[0] || null;
        if (!fwdV) return null;
        const ats = sdx && sdx.stream && typeof sdx.stream.getAudioTracks === 'function' ? sdx.stream.getAudioTracks() : [];
        return downStream('fwd', fwdV, ats[0] || null);
      }
      const ao = (e.meta && e.meta.ao) || (!e.video && e.key && e.key.indexOf('stg:') === 0);
      if (ao) {
        if (!e.audio || !e.audio.in) return null;
        const box = e.audio.sb ? __C.mosStandby : __C.mosIn;
        const ent = box && box.get(e.audio.in);
        if (!ent || !ent.stream) return null;
        const owner = e.key.indexOf('stg:') === 0 ? e.key.slice(4).split('^')[0] : null;
        return stgDownShip(e.key, ent.stream, !!(owner && (0, /*()*/__C.sharingScreen)(owner)), stgAudioMemo);
      }
      const side = e.video || e.audio;
      if (!side || !side.in) return null;
      if (e.video && e.audio && (e.video.in !== e.audio.in || !!e.video.sb !== !!e.audio.sb)) return null;
      const box = side.sb ? __C.mosStandby : __C.mosIn;
      const ent = box && box.get(side.in);
      return ent && ent.stream ? ent.stream : null;
    }
    // Section 1 neighbours floodOne builds: row mates, column mates, bridges, pipe peers. Not the down child, not the heirs.
    function s1PeersNow() {
      const c = (0, /*()*/__C.meshCoord)();
      if (!c || c.pc !== 0) return [];
      const T = __C.net.topo;
      const s = (0, /*()*/__C.meshSeat)();
      const peers = [...T.rowMates(c), ...T.colMates(c)].map((m) => (0, /*()*/__C.occPid)(m)).filter(Boolean);
      for (const t of (s && s.s1Bridges ? s.s1Bridges() : [])) if (peers.indexOf(t) < 0) peers.push(t);
      for (const t of (0, /*()*/__C.pipePeers)()) if (peers.indexOf(t) < 0) peers.push(t);
      return peers;
    }
    function stagePipeSkip(owner, key, t) {
      if (!owner || !t) return false;
      return (0, /*()*/__C.pipePeers)().indexOf(t) >= 0 && (__C.pipeStg.get(owner) === t || __C.mosAnn.has(t + '|' + key) || !(0, /*()*/__C.pipeVideo)(t));
    }
    function stageDebugSkip(owner, key, t, list) {
      if (owner !== __C.myId && relayHeldForTest(key, t)) return true;
      if (oneRootSkipForTest(owner, t, list)) return true;
      return false;
    }
    // ^r of every held stage slot, before any ship this sweep. A hold after a ship unships a job this sweep will not mint again.
    function holdSecondRoots() {
      const c = (0, /*()*/__C.meshCoord)();
      if (!c || c.pc !== 0) return;
      const T = __C.net.topo;
      const s = (0, /*()*/__C.meshSeat)();
      const list = s1PeersNow();
      const held = [...__C.mosIn.keys()].filter((k) => k.indexOf('stg:') === 0 && !(0, /*()*/__C.stgEnded)(k));
      for (const k of held) {
        const key = k + __C.STG_ROOT2;
        const owner = key.slice(4).split('^')[0];
        const hold = (t) => { if (t) stgRootHold(key + '>' + t, k, t); };
        for (const t of list) {
          if (stagePipeSkip(owner, key, t) || stageDebugSkip(owner, key, t, list)) continue;
          hold(t);
        }
        const dn = (0, /*()*/__C.occPid)(T.down(c));
        if (dn) hold(dn);
        const heirs = s ? s.u2Heirs().concat(s.l14Served()) : [];
        for (const t of heirs) if (t) hold(t);
      }
    }
    function section1Neighbour(e) {
      const c = (0, /*()*/__C.meshCoord)();
      if (!c || c.pc !== 0 || !e || !e.key || e.key.indexOf('stg:') !== 0) return false;
      return s1PeersNow().indexOf(e.to) >= 0;
    }
    function debugSkip(e) {
      const owner = e.key.slice(4).split('^')[0];
      return stageDebugSkip(owner, e.key, e.to, s1PeersNow());
    }
    // e.meta, except the split sdn: its alag is this seat's audio hop. The picture does not wait.
    function sdnAlag(e) {
      if (!e || e.key !== 'sdn' || !e.video || e.video.in !== 'sdm' || (e.audio && e.audio.in !== 'sdx')) return e.meta;
      const sdx = __C.mosIn.get('sdx'), sdmF = __C.mosIn.get('sdm');
      // The [0] video read stays: a stream that cannot list its tracks throws here, as the old plane ship did. The hop is the sound only.
      const fwdV = sdmF && !sdmF.deadAt && sdmF.stream ? sdmF.stream.getVideoTracks()[0] || null : null;
      const fwdA = sdx && sdx.stream ? sdx.stream.getAudioTracks()[0] || null : null;
      void fwdV;
      const base = (sdx && sdx.meta && typeof sdx.meta.alag === 'number') ? sdx.meta.alag : ((sdmF && sdmF.meta && sdmF.meta.alag) || 0);
      const meta = Object.assign({}, e.meta);
      meta.alag = Math.round(base + (fwdA ? audioHopMs(fwdA) : 0));
      return meta;
    }
    // END-STAGE-DOWN-SHIP
    // STAGE-FACES
    // ONE SHARED SCREEN BESIDE OTHER FACES. When the stage element shows the
    // shared screen itself (stageDirect, myScreenBeside), the co-presenters'
    // faces sit on it in small boxes, or they vanish. A face comes from what
    // this seat already holds:
    //   - for me, my own broadcast track (my blur is already in it);
    //   - the SAME source the Section 1 strip compositor packs (srcFor): the
    //     stg feed when one is held, else the direct peer's own <video>. Every
    //     Section 1 seat holds every stage feed (the S1 flood), and a relay
    //     holds the ones it carries up;
    //   - below Section 1 a co-presenter's stage feed arrives AUDIO-ONLY
    //     (stgDownShip), so the face is cut out of the strip this seat already
    //     receives. The strip is a packed row-major grid of square cells, cell
    //     j holds the j-th id the compositing seat packed (meta.ids, or the
    //     stage order when an older relay dropped them and the counts agree),
    //     and a fixed box shows cell j of the strip's own <video>, scaled and
    //     shifted (MM.cellCrop). Same decoded track, zero extra bandwidth.
    // When a deep seat cannot place a face (no meta, order unknown or just
    // changed, counts or frame disagree, an id the order lacks), it shows the
    // strip itself: never a screen with people missing. Section 1 always keeps
    // the screen, so a co-presenter it holds no live picture of (camera off, a
    // feed not here yet) gets a named dark box, as the strip gets a named dark
    // cell: nobody is missing there either.
    // MODERATION REACHES THESE SINKS like the grid tile (meet-moderation-sinks):
    // an admin's video-off shows the named dark box and no pixel; every remote
    // face wears the grid tile's receiver blur (blurLevelFor: the room rule,
    // and at least Min blur under a moderator's block).
    const STAGE_FACE_PX = 96;
    // A strip whose cell order (or count, or grid, or track) just changed is
    // not trusted until this long has passed: the announce that carries the
    // order can reach a seat before the re-packed frame does, and a crop then
    // shows the cell of whoever sat there before.
    const STAGE_FACE_SETTLE_MS = GifOS.timings.STAGE_FACE_SETTLE_MS;
    let stageStripSeen = { key: '', at: 0 };
    function stageStripOrder(meta, stagers) {
      if (!meta || !(meta.n > 0)) return null;
      if (Array.isArray(meta.ids)) return meta.ids.length === meta.n ? meta.ids.slice() : null;
      return meta.n === stagers.length ? stagers.slice() : null;
    }
    // A face's own video track, or null. A held stg feed decides (an
    // audio-only copy has no face). At Section 1 (s1) the strip compositor's
    // own source rule (srcFor) goes on: with no stg feed held, the direct
    // peer's <video>, the same pixels its strip cell packs. A deeper seat
    // cuts that face out of its strip instead.
    function stageRawFace(id, s1) {
      let st = null;
      if (id === __C.myId) st = __C.meTile && __C.meTile.video ? __C.meTile.video.srcObject : null;
      else {
        const f = __C.mosIn.get('stg:' + id);
        if (f) { if (f.meta && f.meta.ao) return null; st = f.stream; }
        else if (s1) { const p = __C.peers.get(id); st = p && p.video ? p.video.srcObject : null; }
      }
      // Only a real stream holds a face. A host with no screen (embed.html,
      // the Node host) hands the core counted placeholders for a tile's
      // elements (host.js placeholder), and one answers every question: a
      // duck-typed read took its srcObject for a stream and painted the
      // placeholder as a track (new MediaStream threw in paintStageFaces).
      const vt = (typeof MediaStream === 'function' && st instanceof MediaStream) ? st.getVideoTracks()[0] : null;
      return vt && vt.readyState !== 'ended' ? vt : null;
    }
    // The faces to put on screenSid's shared screen: [{ id, vt, crop, cell }] (each box paints its own blur: facePaint, the Stage rule).
    // vt null is a named dark box. strip is the received 'sgs' claim at a deep
    // seat, null at Section 1. null means this seat must show the strip.
    function stageFaceSet(screenSid, stagers, strip, now) {
      const faces = [];
      let order, svt = null, cols = 0;
      if (now === undefined) now = Date.now();
      for (const id of stagers) {
        if (id === screenSid) continue;
        if ((0, /*()*/__C.forcedCamOff)(id) || (typeof __C.shareBlocked === 'function' && (0, /*()*/__C.shareBlocked)(id))) { faces.push({ id, vt: null, crop: null, cell: null }); continue; }
        const vt = stageRawFace(id, !strip);
        if (vt) { faces.push({ id, vt, crop: null, cell: null }); continue; }
        if (!strip) { faces.push({ id, vt: null, crop: null, cell: null }); continue; }
        if (order === undefined) {
          order = stageStripOrder(strip.meta, stagers);
          if (!order) return null;
          const t = strip.stream && typeof strip.stream.getVideoTracks === 'function' ? strip.stream.getVideoTracks()[0] : null;
          if (!t || t.readyState === 'ended') return null;
          svt = t;
          cols = (strip.meta.cols | 0) || order.length;
          // The seat's own stage list is in the key too: when the stage
          // changes here, the hold starts even if the strip's new order has
          // not reached this seat yet (it travels hop by hop, behind frames).
          const key = order.join(',') + '|' + order.length + 'x' + cols + '|' + (t.id || '') + '|' + stagers.join(',');
          if (key !== stageStripSeen.key) stageStripSeen = { key, at: now };
          if (now - stageStripSeen.at < STAGE_FACE_SETTLE_MS) return null;
        }
        const j = order.indexOf(id);
        if (j < 0) return null;
        const el = strip.el;
        const crop = MM.cellCrop(j, order.length, cols, el ? el.videoWidth : 0, el ? el.videoHeight : 0, STAGE_FACE_PX);
        if (!crop) return null;
        faces.push({ id, vt: svt, crop, cell: { j, n: order.length, cols } });
      }
      return faces;
    }
    // Place one face box's <video>. A raw face fills the box. A strip cell is
    // re-cut from the frame this <video> is showing right now (it plays the
    // strip's own track), so a frame that changed shape since the sweep never
    // shows the wrong cell: no fit, no pixels, the name instead. No track:
    // the name alone.
    function stageFaceCss(v) {
      const wrap = v.parentNode;
      const nm = wrap && wrap.querySelector ? wrap.querySelector('.stagefacename') : null;
      let css = null;
      if (v._vt && !v._cell) css = 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;background:#000';
      else if (v._vt && v._cell) {
        const c = MM.cellCrop(v._cell.j, v._cell.n, v._cell.cols, v.videoWidth, v.videoHeight, STAGE_FACE_PX);
        // No decoded frame yet: hold the box dark until the first one sizes it.
        if (c) css = 'position:absolute;left:' + c.x.toFixed(1) + 'px;top:' + c.y.toFixed(1) + 'px;width:' + c.w.toFixed(1) + 'px;height:' + c.h.toFixed(1) + 'px;max-width:none;max-height:none;object-fit:fill;background:#000';
      }
      const show = css || 'display:none';
      if (v._css !== show) { v._css = show; v.style.cssText = show; }
      v.dataset.cell = css && v._cell ? '1' : '';
      if (nm) nm.style.display = css ? 'none' : 'flex';
      return !!css;
    }
    yield 2143;
    // Claim announced streams off the announcing peer's incoming list, and
    // RESOLVE each to its routing slot (the mosaic's whole routing table):
    //   sub (+col from a relaying row-mate) -> a head's stack slot
    //   sub (no col, from my down-child)    -> head: slot 0 / non-head: relay it
    //   x1 -> carry it down my column (W7); x2:q -> hand to my head as sdrow:q
    //   sdrow:q -> a head's stadium slot q (direct from head q, or relayed)
    //   sd -> THE STADIUM (render + fan down)
    // L2.7 + L29.5 in the page: who heads my row now is the core's actingHead (the head, or the heir while my seat reads the
    // head out: gone, or an owed slot of its mute in my own reading, or my L49 verdict holds its row mix deaf). Here only
    // its edges: logged (__rowViewLog 'out:gone' / 'out:mute' / 'out:deaf', 'back'), the dark rail set on the head's copy
    // when it goes out, and the heir's copy held while the row fails back.
    let rowActed = false, rowDeaf = null;
    // The core's rowActing noticed an edge of my row's acting head: log it, set the dark rail on the head's copy when it goes
    // out, and re-sweep (the fail-back hold itself is the core's).
    function rowEdge(why) {
      dbgRowHead(why);
      if (why !== 'back') { const fb = mosFb.get('sdm'); if (fb) fb.dark = true; }
      schedReconcile();
    }
    // L49's verdict, up to the core (actingHead reads it): the head whose row mix I hold deaf, or nobody.
    function setRowDeaf(pid) {
      const was = rowDeaf ? rowDeaf.pid : null; rowDeaf = pid == null ? null : { pid };
      if (was !== pid) { try { (0, /*()*/__C.planMeasured)('row', rowMeasure()); } catch (e) {} }
    }
    // THE OWED SLOTS, MEASURED (L29.5): every owed inbound duty slot of the core's inboundPlan, read on the receivers of the
    // stream its sender announced for it (owedStream): {video, audio}, each kind true when that kind's packets moved since
    // my last sample. Arrival, never level (L49.1); a slot with nothing announced or delivered reads not arriving.
    const owedPk = new Map(); let owedBusy = false;
    GifOS.meshMedia.workerClock(GifOS.timings.OWED_SAMPLE_MS, async () => {   // the worker clock: a hidden tab keeps sampling
      try { (0, /*()*/__C.planMeasured)('row', rowMeasure()); } catch (e) {}   // up to the core, as data (rowMeasure)
      try { (0, /*()*/__C.rowActing)((0, /*()*/__C.meshCoord)()); } catch (e) {}   // an out or back edge acts now, not at the next sweep
      if (owedBusy) return; owedBusy = true;
      try {
        const out = [], seen = new Set();
        for (const [pid, slot] of (0, /*()*/__C.inboundPlan)()) {
          const k = pid + '|' + slot, p = __C.peers.get(pid), st = (0, /*()*/__C.owedStream)(pid, slot); seen.add(k);
          const n = { video: -1, audio: -1 };   // per kind (L29.5): the core keeps a tick for each
          if (p && p.pc && st) {
            const tr = st.getTracks();
            for (const r of p.pc.getReceivers()) {
              if (!r.track || tr.indexOf(r.track) < 0 || !(r.track.kind in n)) continue;
              const kd = r.track.kind; if (n[kd] < 0) n[kd] = 0;
              (await r.getStats()).forEach((x) => { if (x.type === 'inbound-rtp') n[kd] += x.packetsReceived || 0; });
            }
          }
          const was = owedPk.get(k), sid = st ? st.id : null; owedPk.set(k, { sid, n });
          const moved = (kd) => n[kd] > 0 && !!was && was.sid === sid && n[kd] > was.n[kd];
          out.push([pid, slot, { video: moved('video'), audio: moved('audio') }]);
        }
        for (const k of Array.from(owedPk.keys())) if (!seen.has(k)) owedPk.delete(k);
        (0, /*()*/__C.planMeasured)('owed', out);
      } catch (e) {} finally { owedBusy = false; }
    });
    let rowMixDeaf = false; // L49: the mix's sound is not arriving. A live head still sends picture bytes, so heard:feed must not clear this out.
    // UP FROM THE PLANE (media port v1): my row-view claim as this plane holds it, as plain data for the core (no stream,
    // track or element): who carries it, which stream, dead or not; whether the row mix's sound is missing; whether the
    // watchdog holds the claim dark; and L49's verdict (deafOut: the head whose row mix I hold deaf, or null).
    function rowMeasure() {
      const pri = __C.mosIn.get('sdm'), fb = mosFb.get('sdm'), str = (v) => (v == null ? null : String(v));
      return {
        sdm: pri ? { via: str(pri.via), sid: str(pri.streamId), dead: !!pri.deadAt } : null,
        deaf: !!rowMixDeaf, dark: !!(fb && fb.dark), deafOut: rowDeaf ? str(rowDeaf.pid) : null,
      };
    }
    // A carrier whose target just moved up to its row's head cell keeps handing it the row's product (L28 at both ends), so the
    // new head's view does not go dark between the carried copy and the direct one.
    let rowX2To = null;
    function x2Target(cell) {
      const pid = (0, /*()*/__C.occPid)(cell), now = Date.now(), ck = __C.net.topo.ckey(cell);
      if (pid) { rowX2To = { pid, ck, at: now }; return pid; }
      const kept = x2Kept(ck, now); if (!kept) return null;
      const s = (0, /*()*/__C.meshSeat)(); if (s && s.keepAdd) s.keepAdd(kept, 16);
      return kept;
    }
    // The remembered carrier target for cell key ck, still connected, or null (read only: x2Target and rowMixViaPeek).
    function x2Kept(ck, now) {
      if (!rowX2To || rowX2To.ck !== ck || now - rowX2To.at > GifOS.timings.X2_KEEP_MS) return null;
      const p = __C.peers.get(rowX2To.pid); return p && p.connected ? rowX2To.pid : null;
    }
    const dbgRowHead = (e) => { const l = (window.__rowViewLog = window.__rowViewLog || []); l.push({ t: Date.now(), e }); if (l.length > 100) l.shift(); };
    // L49. One sim tick is 500 ms. The seat that PLAYS a row mix (a Section-1 head) counts while that mix's SOUND IS NOT
    // ARRIVING though its picture is (rowMixArrives: packets, never a level), after it has arrived, and a seat in the row
    // flags its own mic on a path that does not go through the row head. A quiet mix arrives all the same (a live mixer
    // sends 50 packets a second of silence), so a quiet row, a pause or a short word is never a dead head. The heir's x1
    // copy of the same product is born parked: no picture, so nothing to judge. 8 ticks: the listener asks the talker to
    // ship the mic, audio only. 16 ticks: the heir stands in. Section 1 only.
    const ROW_MIX_MS = GifOS.timings.ROW_MIX_MS, ROW_MIX_PULL = GifOS.timings.ROW_MIX_PULL, ROW_MIX_ELECT = GifOS.timings.ROW_MIX_ELECT, ROW_MIX_TTL = GifOS.timings.ROW_MIX_TTL;
    const ROW_MIX_TALK = GifOS.timings.ROW_MIX_TALK; // a breath inside one utterance, shorter than the pull window
    const ROW_MIX_LOUD = 5; // a carried copy at this level holds a voice (rowMixTick, the listener: never used to judge a head)
    const vtalkSeen = new Map();
    const rowSdLv = new Map(), rowSdDead = new Map(), rowSdHold = new Map();
    let rowMixDeadN = 0, rowMixPull = false, rowMixHeard = false, rowMixElected = false, rowMixShipUntil = 0, rowMixArmed = false, rowMixSent = 0;
    let rowMixAn = null, rowMixWhy = '';
    // Is this row mix's sound ARRIVING? Read from the receivers' own counters: 1 = sound packets came inside the last two
    // ticks; 0 = none did while the picture beside it kept coming (the head runs, its mixer does not: a stopped
    // AudioContext sends nothing, a silent one sends silence); -1 = nothing to judge (no track, no counter yet, a parked
    // copy, a stopped picture: other rails own those). Never a level: people are quiet most of the time, and a meter
    // sample between two words read a live head as deaf (2026-11-13: a stand-in, a second pack, faces missing).
    const ROW_MIX_STALL = 2 * ROW_MIX_MS + ROW_MIX_MS / 2;
    function rowMixArrives(slot, ent) {
      const now = Date.now(), p = ent ? __C.peers.get(ent.via) : null, st = ent ? ent.stream : null;
      if (!p || !p.pc || !st || !st.getAudioTracks) return -1;
      const liveOf = (l) => { const a = l.filter((t) => t.readyState === 'live'); return a[a.length - 1] || null; };   // WebKit keeps the ended track of a renegotiated pair first
      const at = liveOf(st.getAudioTracks()), vt = liveOf(st.getVideoTracks());
      if (!at) return -1;
      if (slot.at !== at || slot.pcOf !== p.pc) { slot.at = at; slot.pcOf = p.pc; slot.ap = -1; slot.vb = -1; slot.aAt = 0; slot.vAt = 0; slot.t0 = now; }
      if (!slot.busy) {
        slot.busy = true;
        (async () => {
          try {
            const rs = p.pc.getReceivers(), ar = rs.find((r) => r.track === at), vr = vt ? rs.find((r) => r.track === vt) : null;
            let ap = -1, vb = -1;
            if (ar) (await ar.getStats()).forEach((x) => { if (x.type === 'inbound-rtp' && x.kind === 'audio') ap = x.packetsReceived || 0; });
            if (vr) (await vr.getStats()).forEach((x) => { if (x.type === 'inbound-rtp' && x.kind === 'video') vb = x.bytesReceived || 0; });
            if (slot.at !== at || slot.pcOf !== p.pc) return;
            const t = Date.now();
            if (ap >= 0) { if (slot.ap >= 0 && ap > slot.ap) slot.aAt = t; slot.ap = ap; }
            if (vb >= 0) { if (slot.vb >= 0 && vb > slot.vb) slot.vAt = t; slot.vb = vb; }
          } catch (e) {} finally { slot.busy = false; }
        })();
      }
      if (slot.aAt && now - slot.aAt <= ROW_MIX_STALL) return 1;
      if (slot.ap >= 0 && slot.vAt && now - slot.vAt <= ROW_MIX_STALL && now - Math.max(slot.aAt, slot.t0) > ROW_MIX_STALL) return 0;
      return -1;
    }
    function rowMixRms(slot, stream) {
      const track = stream && stream.getAudioTracks ? stream.getAudioTracks()[0] : null;
      if (!track || track.readyState === 'ended' || !(0, /*()*/__C.ensureAc)()) return -1;
      // Keyed by the track OBJECT, never its id: a transport rebuild resolves the same (via, sid) to a NEW track with the
      // SAME id (claimRedun re-binds the claim in place), and a meter left on the ended object reads 0 for a mix that plays.
      if (!slot.an || slot.track !== track) {
        try {
          if (slot.src) slot.src.disconnect();
          const src = __C.ac.createMediaStreamSource(new MediaStream([track]));
          const an = __C.ac.createAnalyser(); an.fftSize = 256; src.connect(an);
          slot.an = an; slot.src = src; slot.data = new Uint8Array(an.fftSize); slot.track = track;
        } catch (e) { return -1; }
      }
      try {
        slot.an.getByteTimeDomainData(slot.data);
        let dev = 0; for (let i = 0; i < slot.data.length; i++) { const d = slot.data[i] - 128; dev += d * d; }
        return Math.sqrt(dev / slot.data.length);
      } catch (e) { return -1; }
    }
    function rowMixFresh(row, pc) {
      const now = Date.now();
      for (const v of vtalkSeen.values()) { if (v.row === row && v.pc === pc && now - v.at <= ROW_MIX_TTL) return true; }
      return false;
    }
    function rowMixHold(q) { return rowSdHold.get(q) === 1; }
    function rowMixVia() {
      const c = (0, /*()*/__C.meshCoord)(); if (!c || c.pc !== 0) return null;
      const dest = (c.i === c.r) ? 0 : c.i;
      return x2Target({ pc: 0, r: dest, i: c.i });
    }
    function rowMixNote() {
      const c = (0, /*()*/__C.meshCoord)(), vias = {}, rms = {}, hot = [], nC = __C.SCALE.C;
      let rap = 0, rapRms = -1;
      if (c && c.i === 0) {
        for (let q = 0; q < nC; q++) {
          const f = __C.mosIn.get('sdrow:' + q);
          if (f && f.via) vias[q] = String(f.via).slice(0, 8);
          const slot = rowSdLv.get(q);
          if (slot && typeof slot.rx === 'number') rms[q] = slot.rx;
          if (slot && slot.hot) hot.push(q);
        }
        for (const [mk, rf] of __C.mosIn) {
          if (String(mk).indexOf('rap:') !== 0 || !rf || !rf.stream) continue;
          rap++;
          const ps = rowSdLv.get('p' + mk) || {}; rowSdLv.set('p' + mk, ps);
          const lv = rowMixRms(ps, rf.stream);
          if (lv > rapRms) rapRms = Math.round(lv * 10) / 10;
        }
      }
      const sv = rowMixVia();
      window.__rowMix = { dead: rowMixDeadN, pulls: rowMixPull ? 1 : 0, heard: rowMixHeard ? 1 : 0, elected: rowMixElected ? 1 : 0, deaf: rowMixDeaf ? 1 : 0, ship: rowMixShipUntil > Date.now() ? 1 : 0, hold: [...rowSdHold.keys()], vias, arm: rowMixArmed ? 1 : 0, spk: __C.speakingOf.get('me') ? 1 : 0, why: rowMixWhy, rap, rapRms, rms, hot, sent: rowMixSent, shipVia: sv ? String(sv).slice(0, 8) : '' };
    }
    function rowMixOnVtalk(p, m) {
      if (!p || !m || m.row == null) return;
      const row = m.row | 0, pc = m.pc | 0, head = (0, /*()*/__C.occPid)({ pc, r: row, i: 0 });
      if (p.id === head) return;
      if (m.elect === 1 || m.elect === 0) {
        const c = (0, /*()*/__C.meshCoord)(), s = (0, /*()*/__C.meshSeat)();
        const mine = c && s && c.pc === pc && c.r === row && s.rowHeir && s.rowHeir() === __C.myId;
        if (mine) {
          if (m.elect === 0) { if (rowDeaf) { rowMixDeaf = false; setRowDeaf(null); dbgRowHead('heard:level'); schedReconcile(); } return; }
          const headPid = (0, /*()*/__C.occPid)({ pc: c.pc, r: c.r, i: 0 });
          rowMixElected = true; rowMixDeaf = true; rowMixShipUntil = 0;
          if (!rowDeaf) { setRowDeaf(headPid); (0, /*()*/__C.rowActing)(c); }   // the out edge ('out:deaf') is rowActing's
          return;
        }
        if ((m.hop | 0) !== 0) return; // one hop: the listener is not a peer of the heir
        const msg = { k: 'vtalk', elect: m.elect, row, pc, hop: 1 };
        for (const [id, q] of __C.peers) { if (id === head || id === p.id) continue; (0, /*()*/__C.dcSend)(q, msg); }
        return;
      }
      if (m.pull === 1) {
        if (m.src === __C.myId) { rowMixPull = true; rowMixHeard = true; rowMixShipUntil = Date.now() + ROW_MIX_TTL + ROW_MIX_MS; schedReconcile(); return; }
        if ((m.hop | 0) !== 0) return;
        const msg = { k: 'vtalk', pull: 1, src: m.src, row, pc, hop: 1 };
        // src is the talker. The hop that reaches them is a peer of src, so this forward includes src.
        for (const [id, q] of __C.peers) { if (id === head || id === p.id) continue; (0, /*()*/__C.dcSend)(q, msg); }
        return;
      }
      if (m.src == null || m.src === head) return;
      const hop = m.hop === 0 ? 0 : 1, src = String(m.src);
      vtalkSeen.set(src, { at: Date.now(), hop, via: p.id, row, pc });
      if (hop !== 0) return;
      const msg = { k: 'vtalk', on: 1, src, hop: 1, row, pc };
      for (const [id, q] of __C.peers) { if (id === head || id === src || id === p.id) continue; (0, /*()*/__C.dcSend)(q, msg); }
    }
    window.__rowMixOn = rowMixOnVtalk;
    function rowMixHeadArrives(q) {
      const head = (0, /*()*/__C.occPid)({ pc: 0, r: q, i: 0 });
      const pri = __C.mosIn.get('sdrow:' + q), std = __C.mosStandby.get('sdrow:' + q);
      const src = pri && pri.via === head ? pri : (std && std.via === head ? std : null);
      if (!src || !src.stream) return -1;
      const slot = rowSdLv.get('h' + q) || {}; rowSdLv.set('h' + q, slot);
      return rowMixArrives(slot, src);
    }
    function rowMixTick() {
      const now = Date.now();
      for (const [src, v] of vtalkSeen) if (now - v.at > ROW_MIX_TTL) vtalkSeen.delete(src);
      const c = (0, /*()*/__C.meshCoord)(), s = (0, /*()*/__C.meshSeat)();
      // One 180 ms sample misses a breath inside an utterance (over a second, under the 4 s pull).
      // Refresh the flag while a recent hot sample still says this seat is talking. Silence stays silent.
      if (c && (__C.speakingOf.get('me') || (__C.rowMixTalkAt && now - __C.rowMixTalkAt <= ROW_MIX_TALK))) {
        const head = (0, /*()*/__C.occPid)({ pc: c.pc, r: c.r, i: 0 });
        vtalkSeen.set(__C.myId, { at: now, hop: 0, via: __C.myId, row: c.r, pc: c.pc });
        const msg = { k: 'vtalk', on: 1, src: __C.myId, hop: 0, row: c.r, pc: c.pc };
        for (const [id, p] of __C.peers) { if (id === head) continue; (0, /*()*/__C.dcSend)(p, msg); }
      }
      if (c && s && c.i !== 0 && c.pc === 0 && s.rowHeir && s.rowHeir() === __C.myId) {
        const head = (0, /*()*/__C.occPid)({ pc: c.pc, r: c.r, i: 0 });
        const x1 = __C.mosIn.get('x1');
        const level = (x1 && !x1.deadAt && x1.via === head && x1.stream) ? rowMixArrives(rowMixAn || (rowMixAn = {}), x1) : -1;   // 1 arrives, 0 the picture comes and the sound does not, -1 nothing to judge
        const flagged = rowMixFresh(c.r, c.pc);
        rowMixWhy = (x1 ? (x1.deadAt ? 'xdead' : (x1.via === head ? 'xhead' : 'xvia')) : 'nox1') + ' rx=' + level + (rowMixArmed ? ' arm' : ' warm') + (flagged ? ' flag' : ' noflag');
        if (level === 1) rowMixArmed = true; // a mix that has arrived: its sound stopping later is this fault, not "not connected yet"
        if (level === 1) { rowMixDeaf = false; rowMixDeadN = 0; }
        else if (rowMixArmed && level === 0 && flagged) { rowMixDeadN++; rowMixDeaf = true; }
        else rowMixDeadN = 0;
        if (rowMixDeadN >= ROW_MIX_PULL && !rowMixPull) {
          const via = rowMixVia();
          if (via) { rowMixPull = true; rowMixHeard = true; dbgRowHead('pull'); schedReconcile(); }
        }
        if (rowMixPull && !rowMixElected && rowMixDeaf) {
          let n = 0;
          for (const [src, v] of vtalkSeen) {
            if (v.pc !== c.pc || v.row !== c.r || now - v.at > ROW_MIX_TTL) continue;
            if (n >= 2) break; n++;
            if (src === __C.myId) rowMixShipUntil = now + ROW_MIX_TTL + ROW_MIX_MS;
            else { const p = __C.peers.get(src); if (p) (0, /*()*/__C.dcSend)(p, { k: 'vtalk', pull: 1, src, row: c.r, pc: c.pc }); }
          }
        }
        if (rowMixDeadN >= ROW_MIX_ELECT && rowMixHeard && !rowMixElected && rowMixPull && rowMixVia() && flagged && level === 0) {
          rowMixElected = true; rowMixShipUntil = 0;
          setRowDeaf(head); (0, /*()*/__C.rowActing)(c);   // the out edge ('out:deaf') is rowActing's
        }
        if (rowDeaf && !rowMixDeaf) { setRowDeaf(null); dbgRowHead('heard:level'); (0, /*()*/__C.rowActing)(c); }
      }
      if (c && c.i === 0 && c.pc === 0) {
        const nC = __C.SCALE.C;
        for (let q = 0; q < nC; q++) {
          if (q === c.r) continue;
          const f = __C.mosIn.get('sdrow:' + q);
          const slot = rowSdLv.get(q) || {}; rowSdLv.set(q, slot);
          const level = (f && f.stream) ? rowMixArrives(slot, f) : -1;
          slot.rx = level;
          const head = (0, /*()*/__C.occPid)({ pc: 0, r: q, i: 0 });
          // A CARRIED COPY'S PACKETS ARE NOT ITS SOUND. Arrival is evidence on the mixer's own pipe only: a seat that
          // carries a copy encodes what it received, silence included, so the copy of a stopped mix arrives at 50
          // packets a second with nothing in it. Read as "arrives", it ended the pull, dropped the pulled mic and
          // never asked the heir, and the row was silent to this seat until it failed back. Whether a carried copy
          // holds the row's voice is its level, kept for one breath. That is asked only under a hold (the head's own
          // pipe proved its sound gone) while a talker flags, so a quiet row is still never a dead head.
          const carried = !!(f && f.stream && (!head || f.via !== head));   // no head known: whatever plays is not the head's own pipe
          const cs = rowSdLv.get('c' + q) || {}; rowSdLv.set('c' + q, cs);
          if (carried) {
            const lv = rowMixRms(cs, f.stream);
            if (cs.hotOf !== cs.track) { cs.hotOf = cs.track; cs.hotAt = 0; }
            if (lv >= ROW_MIX_LOUD) cs.hotAt = now;
          }
          const hot = level === 1 && (!carried || (!!cs.hotAt && now - cs.hotAt <= ROW_MIX_TALK));
          slot.hot = hot;
          const headLv = rowMixHeadArrives(q);
          if (headLv === 1) {
            if (rowSdHold.get(q) === 1 || rowSdLv.get('el' + q)) { for (const [id, p] of __C.peers) { if (id === head) continue; (0, /*()*/__C.dcSend)(p, { k: 'vtalk', elect: 0, row: q, pc: 0, hop: 0 }); } }
            rowSdHold.delete(q); rowSdDead.set('e' + q, 0); rowSdLv.delete('el' + q); rowSdLv.set('arm' + q, 1);
          } else if (level === 1) rowSdLv.set('arm' + q, 1);
          const armed = rowSdLv.get('arm' + q) === 1;
          // level 0 holds the picture still arriving: the head's renderer is running. A freeze stops it, and that is not this pull.
          const quiet = armed && level === 0 && rowMixFresh(q, 0) && f && f.via === head;
          const n = quiet ? (rowSdDead.get(q) || 0) + 1 : 0;
          rowSdDead.set(q, n);
          if (n >= ROW_MIX_PULL && !rowSdHold.get(q)) { rowSdHold.set(q, 1); dbgRowHead('sdrow-hold:' + q); schedReconcile(); }
          // x1 at the heir is born parked, so the listener is who hears the mix die. Ask the talker for the mic now,
          // and the heir to stand in if the playing copy stays quiet.
          if (rowSdHold.get(q) === 1 && !hot) {
            let pn = 0;
            for (const [src, v] of vtalkSeen) {
              if (v.pc !== 0 || v.row !== q || now - v.at > ROW_MIX_TTL) continue;
              if (pn >= 2) break; pn++;
              for (const [id, p] of __C.peers) { if (id === head) continue; (0, /*()*/__C.dcSend)(p, { k: 'vtalk', pull: 1, src, row: q, pc: 0, hop: 0 }); }
            }
            const en = (rowSdDead.get('e' + q) || 0) + 1;
            rowSdDead.set('e' + q, en);
            if (en >= ROW_MIX_ELECT && now - (rowSdLv.get('el' + q) || 0) > 2000) {
              rowSdLv.set('el' + q, now);
              for (const [id, p] of __C.peers) { if (id === head) continue; (0, /*()*/__C.dcSend)(p, { k: 'vtalk', elect: 1, row: q, pc: 0, hop: 0 }); }
              dbgRowHead('ask-elect:' + q);
            }
          }
        }
      }
      rowMixNote();
    }
    setInterval(() => { try { rowMixTick(); } catch (e) { window.__rowMix = { err: String(e && e.message || e) }; } }, ROW_MIX_MS);
    // A NEW HEAD IN MY ROW: my jobs to my row's head ('sub', 'sdrow') follow rowHeadPid, which stays on the heir until my
    // seat hears the head cell's new occupant first-hand. Re-route them the moment that target moves (checked each mesh
    // tick) or the link to the head comes up, not at the next 2 s sweep: one coalesced reconcile per such event.
    let headShipTo = null;   // the head my last reconcile shipped to
    function headSendsStale() { const c = (0, /*()*/__C.meshCoord)(); return !!c && c.i !== 0 && (0, /*()*/__C.rowHeadPid)(c) !== headShipTo; }
    function headLinkUp(pid) {
      const c = (0, /*()*/__C.meshCoord)(); if (!c || c.i === 0 || !pid) return;
      if (pid === (0, /*()*/__C.occPid)({ pc: c.pc, r: c.r, i: 0 }) || pid === (0, /*()*/__C.rowHeadPid)(c)) schedReconcile();
    }
    yield 2191;
    function repaintRedun(rk, stream) {
      // Respect the same position guards reconcileMosaic paints under, so an
      // instant-failover repaint never clobbers a locally-ORIGINATED composite:
      // every Stadium is a local view of the room pack (sdView, rebuilt on the
      // sweep); every S1 seat owns its own Stage strip (stripPack).
      const c = (0, /*()*/__C.meshCoord)();
      if (rk === 'sdm') { if (c && c.i === 0) return; schedReconcile(); }
      else if (rk === 'sgs') { if (c && c.pc === 0) return; schedReconcile(); }
      // stg:* has no <video> of its own, but the Stage paints from it: the
      // strip compositor re-reads mosIn on the sweep, and a shared screen is
      // shown as the stg track itself (stageDirect). A swap made outside the
      // sweep (an announce, a track, a departure) parks the old path at once,
      // so waiting for the next beat leaves the Stage on a frozen frame; on a
      // throttled clock that beat is many seconds away. Repaint now.
      else if (rk.indexOf('stg:') === 0) schedReconcile();
      // 'sdn'/'sdx' feed this head's packers, which re-read mosIn on the sweep;
      // schedule a fast off-stack sweep so a failover swap repaints in ~60ms
      // instead of waiting out the 2s reconcile beat.
      else if (rk === 'sdn' || rk === 'sdx') schedReconcile();
    }
    // A one-shot, coalesced, off-stack reconcile — safe to call from inside
    // claimRedun (which itself runs inside reconcileMosaic).
    let reconT = 0;
    function schedReconcile() {
      if (reconT) return;
      reconT = setTimeout(() => {
        reconT = 0;
        try { reconcileMosaic(); } catch (e) {}
        try { dutyTick(); } catch (e) {}
      }, 60);
    }
    let claimT = 0;
    function schedClaim() {
      if (claimT) return;
      claimT = setTimeout(() => { claimT = 0; try { (0, /*()*/__C.claimMos)(); } catch (e) {} }, 60);
    }
    // THE PIPE WATCHDOG v2 (task #3; v1 0d9c530 reverted 80856f0): the receiver
    // measures its own hot pipes on a ~300ms loop, but on BYTES — the inbound-rtp
    // bytesReceived counter off the primary's own RTCRtpReceiver — never on
    // rendered-frame counters. v1's lesson written in a revert: frame counters
    // ride the RENDER path, which Chrome throttles on 2px/hidden/occluded
    // elements, so the signal went mushy exactly where the mosaic parks small
    // tiles. bytesReceived is the NETWORK path: it advances as long as the pipe
    // delivers, hidden tab or not — which also retires v1's hidden-tab
    // re-baseline hack (a throttled background timer can't false-fire: an
    // advance between two late samples still reads as an advance).
    // The rails, unchanged from v1, each load-bearing:
    // - dark WAKES the standby, never tears down: only transport death starts
    //   the grace clock. A camOff stager keeps its tile.
    // - never fires on a pipe that never flowed (forming, audio-only: no video
    //   receiver ⇒ never sampled), via the flowed-recently horizon.
    // - touches ONLY the wake path of claimed redundant slots — no
    //   claim-liveness changes, no claimMos kicks from transport handlers.
    // The receiver lookup is by track OBJECT (the avStats lesson, fc7496f): a
    // forwarded track keeps its trackIdentifier through every re-ship, so only
    // object identity names ONE pipe. A rebuilt transport simply misses the
    // lookup and skips — the rebuilt pipe re-baselines when it flows again.
    let dogBusy = false, dogU2Hot = false, dogPass = 0;
    let dogVoiceFast = false;
    const stgVoiceClaim = (rk, pri) => rk.indexOf('stg:') === 0 && !!pri.stream && !pri.stream.getVideoTracks().length && !!pri.stream.getAudioTracks().length;
    function stgFoNote(rk, e, via, why) { // failover forensics, read by test hooks
      if (rk.indexOf('stg:') !== 0 && rk !== 'sdm') return;
      const l = (window.__stgFoLog = window.__stgFoLog || []);
      l.push({ t: Date.now(), k: rk.slice(4, 12), e, via: via ? String(via).slice(0, 8) : undefined });
      if (l.length > 200) l.shift();
      if (__C.DEBUG_ON && rk.indexOf('stg:') === 0) swapPicNote(rk, e, why || '');
    }
    yield 2201;
    function stgPicOf(ent) {
      if (!ent) return null;
      const el = ent.el, st = ent.stream || (el && el.srcObject) || null, o = { via: String(ent.via || '').slice(0, 8) };
      try {
        if (el) {
          const q = el.getVideoPlaybackQuality ? el.getVideoPlaybackQuality() : null, tf = q ? q.totalVideoFrames : null;
          o.rs = el.readyState; o.vw = el.videoWidth; o.vh = el.videoHeight; o.pa = !!el.paused; o.ct = Math.round(el.currentTime * 100) / 100;
          o.tf = tf; o.df = q ? q.droppedVideoFrames : null;
          const lk = __C.swapPicLast.get(el); o.dtf = (lk != null && tf != null) ? tf - lk : null; // frames drawn since the last record of this element
          if (tf != null) { if (__C.swapPicLast.size > 64) __C.swapPicLast.delete(__C.swapPicLast.keys().next().value); __C.swapPicLast.set(el, tf); }
        } else o.noEl = 1;
        if (st) {
          const v = st.getVideoTracks(), a = st.getAudioTracks();
          o.vt = v.map((x) => [x.readyState, x.muted ? 1 : 0]); o.at = a.map((x) => [x.readyState, x.muted ? 1 : 0]);
        }
      } catch (err) { o.err = String(err).slice(0, 40); }
      return o;
    }
    function swapPicNote(rk, e, why, follow) {
      try {
        if (!__C.DEBUG_ON) return;
        const now = Date.now();
        if (e === 'want' || e === 'hold') { const hk = e + rk; if (now - (__C.swapPicHoldAt.get(hk) || 0) < 3000) return; if (__C.swapPicHoldAt.size > 64) __C.swapPicHoldAt.delete(__C.swapPicHoldAt.keys().next().value); __C.swapPicHoldAt.set(hk, now); }
        const fb = mosFb.get(rk) || {};
        const r = { t: now, k: rk.slice(4, 12), e: e === 'want' ? 'wake' : e, why: String(why || '').slice(0, 90), p: stgPicOf(__C.mosIn.get(rk)), s: stgPicOf(__C.mosStandby.get(rk)),
          lb: fb.lastBytes, sb: fb.stdB, fd: fb.stdFdec, d0: fb.d0, dark: fb.dark ? 1 : 0, sus: fb.suspect ? 1 : 0, pd: fb.picDead ? 1 : 0 };
        // np: no picture is owed. A camera-off sender keeps a live, unmuted video track that sends only black frames, so a still
        // or empty picture from its slot is the one promised. Set only when the owner's own status says camera off and no screen share.
        { const own = String(rk).slice(4).split('^')[0], st = own === __C.myId ? __C.myStatus : __C.statusOf.get(own); if (st && st.camOff && !(0, /*()*/__C.sharingScreen)(own)) r.np = 1; }
        __C.swapPicRing.push(r); if (__C.swapPicRing.length > 40) __C.swapPicRing.shift();
        if (e === 'swap' && !follow) for (const ms of [1500, 3000]) setTimeout(() => swapPicNote(rk, 'after' + ms, 'swap +' + ms + 'ms', true), ms);
      } catch (err) {}
    }
    async function sampleStandby(rk, fb) {
      if (fb.dark || fb.wakeAt) {
        const std = __C.mosStandby.get(rk);
        const s = std ? await pipeBytes(std, rk.indexOf('stg:') === 0) : -1;
        if (s !== -1 && s.d >= 0) {
          // First post-wake sample IS the baseline; a sample BELOW the
          // baseline means the standby's receiver was renegotiated and its
          // counters restarted — re-baseline, or the advance test can
          // never pass and the dark swap wedges (seen live: d0=16, fdec=13).
          if (fb.d0 === -1 || s.d < fb.d0) { fb.d0 = s.d; fb.b0 = s.b; fb.stdAdvAt = 0; }
          if (fb.stdFdec >= 0 && s.d > fb.stdFdec) fb.stdAdvAt = Date.now(); // the last decode-side advance (the failback gate reads it)
          const pg = __C.mosIn.get(rk); // a gone primary (deadAt) swaps on the first flow as a dark one does
          if ((fb.dark || (pg && pg.deadAt)) && s.d > fb.d0 && fb.stdFdec <= fb.d0) { stgFoNote(rk, 'first'); schedReconcile(); } // the swap waits for no sweep
          fb.stdFdec = s.d; fb.stdB = s.b;
        }
      } else if (fb.d0 !== -1 || fb.stdFdec !== -1) { fb.d0 = -1; fb.stdFdec = -1; fb.stdB = -1; }
    }
    async function mosWatchdog() {
      if (dogBusy) return; // single flight — stats are async, the loop must not stack
      dogBusy = true;
      try {
        const now = Date.now();
        { const sv = (0, /*()*/__C.meshSeat)(), hot = !!(sv && sv.u2Hot); if (hot !== dogU2Hot) { dogU2Hot = hot; schedReconcile(); } } // L2.7
        dogPass++;
        for (const [rk, pri] of __C.mosIn) {
          if (!(0, /*()*/__C.isRedun)(rk)) continue;
          const fb = mosFb.get(rk); if (!fb) continue; // claimRedun mints it; no claim, no watch
          // Stage audio sets the fast beat; every other slot keeps its own, one pass in three.
          if (dogEvery === 300 && dogVoiceFast && dogPass % 3 && !fb.dark && !fb.wakeAt && !stgVoiceClaim(rk, pri)) continue;
          // A voice-only claim is judged on its own audio packets (pipeBytes). A
          // muted stager still sends silence frames, so a live voice pipe advances.
          // A claim with no track at all has no pipe to judge: -1 would read as a
          // hot void and wake the standby for nothing.
          if (pri.stream && !pri.stream.getTracks().length) { await sampleStandby(rk, fb); continue; }
          if (mosHeld(pri)) continue; // parked on purpose while its decoder restarts (mosDecoderSweep): this silence is not death
          if (fb.rest) continue; // asked to rest (nobody here takes it): this silence is not death either
          if (rk.indexOf('stg:') === 0) await stgPicCheck(rk, pri, fb, now);
          const bytes = await pipeBytes(pri, rk.indexOf('stg:') === 0);
          // THE PRIMARY'S PICTURE ON THE WIRE: when its video bytes last advanced (claimRedun reads it too). A stage slot is
          // judged on its voice, and a stager can send no voice packets at all while it stays on stage (a microphone the
          // device has paused, a page with no running audio source). The stager's OWN copy carries every packet of voice the
          // stager sends; no relay can carry more (a relay sends silence frames of its own). So while the stager's own
          // copy's picture still arrives and shows, its silent voice is no death: no dark, no wake, no failover off it.
          if (rk.indexOf('stg:') === 0 && pri.stream && pri.stream.getVideoTracks().length) {
            const pv = await pipeBytes(pri, false);
            if (pv !== -1) { if (pv.b > 0 && pv.b > fb.pvB) fb.pvAt = Date.now(); fb.pvB = pv.b; }   // the first sample counts once bytes have come: the dark rail can fire inside the first second
            const ownCopy = pri.via === rk.slice(4).split('^')[0] && String(pri.key || '').indexOf('^') < 0;
            if (ownCopy && pri.el && pri.el.videoWidth > 0 && fb.pvAt && Date.now() - fb.pvAt < STG_PIC_LIVE_MS) {   // bytes alone are no picture: an element on the wrong track shows none
              if (fb.dark) { fb.dark = false; fb.suspect = false; schedReconcile(); }   // the picture says it is alive: re-park the woken standby
              if (bytes !== -1 && bytes.b > (fb.lastBytes || 0)) fb.lastAdvanceAt = now;
              if (bytes !== -1) fb.lastBytes = bytes.b;
              fb.q = 0; fb.flowSince = 0;   // the voice rails re-earn from zero once the picture stops
              await sampleStandby(rk, fb);
              continue;
            }
          } else if (fb.pvB !== -1) { fb.pvB = -1; fb.pvAt = 0; }
          // Forensics ring (frza17: a husk claim's standby was never woken and
          // no theory survived — record what each sample actually SAW). Widened
          // 2026-08-07 from stg/sgs to EVERY redundant key, and records the
          // continuity clock: the strict-bound tail hunt needed to know whether
          // a pipe was QUALIFIED at kill time, and only this ring can say.
          {
            const dl = (window.__dogLog = window.__dogLog || []);
            dl.push({ t: now, rk: rk.slice(0, 14), b: (bytes < 0 ? -1 : bytes.b), q: fb.q || 0,
              la: fb.lastAdvanceAt ? now - fb.lastAdvanceAt : -1, ca: fb.claimAt ? now - fb.claimAt : -1,
              fs: fb.flowSince ? now - fb.flowSince : -1, fp: fb.fp || 0,
              dark: !!fb.dark, wk: !!fb.wakeAt, std: !!__C.mosStandby.get(rk) });
            if (dl.length > 400) dl.shift();
          }
          if (bytes < 0) {
            // NO STATS ROW AT ALL: an inbound-rtp row only exists after the
            // FIRST packet, so a hot primary that has never delivered even
            // one packet is invisible to every rail below — frza12: a seat
            // sat 4+ minutes on such a husk (fdec 0, 786 PLIs) with a parked
            // standby, because this bail skipped the void rail. A claim this
            // old with NO stats row is the deepest void there is.
            if (!fb.dark && fb.claimAt && now - fb.claimAt > HOT_VOID_MS) {
              const std0 = __C.mosStandby.get(rk);
              if (std0 && std0.key) { fb.dark = true; (0, /*()*/__C.demand)(std0.via, std0.key, std0.streamId, true); schedReconcile(); }
            }
            // A primary whose transport closed (its seat died) has no stats row either. Its woken standby is still
            // measured: without that evidence the swap never comes and the slot waits out MOS_GRACE in silence.
            await sampleStandby(rk, fb);
            if (rk.indexOf('stg:') === 0 && fb.wakeAt && now - fb.wakeAt > STG_ZERO_MS && fb.d0 >= 0 && !(fb.stdB > fb.b0)) schedReconcile();
            continue;
          }
          if (!fb.dark && fb.lastBytes !== -1 && bytes.b < fb.lastBytes) {
            // COUNTER REGRESSION: a renegotiated/rebuilt receiver restarts
            // bytesReceived near zero — the standby sampler below learned this
            // (the d0 re-baseline); the primary rail lacked it, so a qualified
            // pipe read "no advance" until the counter re-crossed the old
            // high-water mark: a FALSE dark inside 700ms, then an fp penalty
            // charged for the "recovery". Re-baseline: no advance credit, no
            // fire, no penalty — continuity restarts from here.
            fb.lastBytes = bytes.b; fb.lastAdvanceAt = now; fb.q = 0; fb.flowSince = 0;
          } else if (fb.lastBytes === -1 || bytes.b > fb.lastBytes) {
            // flowSince = start of the current flow epoch (first advance since
            // reset/horizon) — FORENSICS ONLY (__dogLog fs, the drills' at-kill
            // dumps); the qualification gate below is the advance COUNT (see
            // its 2026-08-08 note for why the wall-clock version was pulled).
            if (!fb.flowSince) fb.flowSince = now;
            fb.lastBytes = bytes.b; fb.lastAdvanceAt = now;
            fb.q = Math.min(64, (fb.q || 0) + 1);
            // A clean qualified minute earns one penalty step back: a slot that
            // false-fired long ago must not stay half-armed forever (fp=4 used
            // to out-bar the q cap — 128 > 64 — permanent inertness, no decay).
            if ((fb.fp || 0) > 0 && now - (fb.fpDecayAt || fb.flowSince) > 60000) { fb.fp--; fb.fpDecayAt = now; }
            if (fb.suspect) fb.suspect = false; // a fresh advance re-arms dark
            if (fb.dark) {
              // Primary recovered — the freeze was a FALSE fire, not a death.
              // The sweep re-parks the woken standby; the pipe pays a penalty:
              // it must re-earn the watchdog from zero, at a doubled bar. A
              // chronically freeze-cycling pipe goes inert in a few rounds; a
              // killed pipe never recovers, so real failovers never pay.
              fb.dark = false; fb.suspect = false; fb.q = 0; fb.flowSince = 0; fb.fp = Math.min(3, (fb.fp || 0) + 1); fb.fpDecayAt = now;
              schedReconcile();
            }
          // A STAGE PRIMARY THAT FLOWED AND STOPPED IS DARK, QUALIFIED OR NOT. A stage claim is judged on its voice, and a
          // live voice pipe sends packets even when muted, so bytes flat for MOS_DARK_MS after any advance are not a routine
          // freeze. The count (and its doubling after a false fire) earns the watchdog for every other pipe; on a stage claim
          // whose receiver had just been rebuilt (count back near zero) it kept the standby parked for 5 s of silence.
          } else if (!fb.dark && ((fb.q || 0) >= (MOS_QUALIFY << Math.min(3, fb.fp || 0)) || (rk.indexOf('stg:') === 0 && (fb.q || 0) > 0))) {
            // QUALIFICATION (v2b — the gate-box bench conviction): some healthy
            // pipes freeze bytes for SECONDS while alive (a throttled
            // producer's canvas repack, a carrier copy, low-fps shares) —
            // byte-freeze is only death evidence on a pipe that ADVANCED
            // MOS_QUALIFY samples (doubled per false fire). Without this the
            // watchdog itself woke standbys in steady state — a chronic
            // one-pipe violation (redun-drill stdHot 2/2, v2 bench).
            // (2026-08-08: a wall-clock gate was tried here TWICE — 2400ms,
            // then 7200ms "parity" — and pulled back the same night: elapsed
            // time qualifies rarely-advancing pipes the advance COUNT never
            // would, dark then fires on their routine freezes, and the extra
            // wake/park cycling raised the mirror zombie rate (ABAB: old 3/3
            // green at loadavg 10-12, wall-clock build 4/6). The fresh-claim
            // protection gap the wall-clock version fixed is graveyard
            // territory (known-unfixed.sh FAILOVER-WAKE) and moves to the
            // sender-side campaign. flowSince stays as pure forensics.)
            const std = __C.mosStandby.get(rk);
            if (!fb.suspect && ((std && std.key) || rk.indexOf('stg:') === 0) && fb.lastAdvanceAt
                && now - fb.lastAdvanceAt > MOS_DARK_MS
                && now - fb.lastAdvanceAt < MOS_FLOWED_RECENT) {
              fb.dark = true; stgFoNote(rk, 'dark', std && std.via, 'bytes flat ' + (now - fb.lastAdvanceAt) + 'ms');
              if (std && std.key) (0, /*()*/__C.demand)(std.via, std.key, std.streamId, true); // wake NOW — don't wait for the sweep
              schedReconcile();
            }
          // (A "born dark" rail lived here for one night — 2026-07-29 — on the
          // theory that the black stage was pipes stalling after a frame or
          // two. That diagnosis was WRONG: the cause was a stager claiming an
          // ECHO of its own feed, which re-shipped the job every 2s sweep (see
          // mosResolve/floodOne). The heuristic outlived its premise and cost
          // real damage — under load a merely-STARVED primary reads as dead,
          // so a second pipe wakes, which adds load, which starves more pipes.
          // redun-drill caught it as a hot standby (ONE-PIPE violation) at
          // loadavg 22. A slow pipe is not a dead pipe; only qualification-
          // backed darkness or a dead transport may move a claim.)
          } else if (!fb.dark && now - fb.lastAdvanceAt > MOS_FLOWED_RECENT && (fb.q || fb.flowSince)) {
            fb.q = 0; fb.flowSince = 0; // frozen past the horizon without a fire — re-earn from zero
          } else if (!fb.dark && !(fb.q || 0) && fb.claimAt
              && now - fb.claimAt > HOT_VOID_MS
              && now - Math.max(fb.lastAdvanceAt || 0, fb.claimAt) > HOT_VOID_MS) {
            // HOT-AND-VOID (frza5: p16 sat 262s on a husk that delivered 6
            // frames then nothing — never qualified, so the dark rail above
            // could never arm, and the standby stayed parked forever). This
            // is NOT the 2026-07-29 "born dark" rail returning: that one
            // fired on SLOW pipes under load and spiraled. A merely-starved
            // pipe ships SOMETHING inside 12s; a piped husk is RTP-silent —
            // zero bytes for HOT_VOID_MS with a live standby is death.
            const std = __C.mosStandby.get(rk);
            if (!fb.suspect && std && std.key) {
              fb.dark = true; stgFoNote(rk, 'dark', std.via, 'void: zero bytes HOT_VOID');
              (0, /*()*/__C.demand)(std.via, std.key, std.streamId, true); // wake NOW — don't wait for the sweep
              schedReconcile();
            }
          }
          // A stage copy that has not delivered one byte STG_ZERO_MS after its claim is dead, not slow: a live
          // stager's copy carries packets (silence frames too) within a second. Only a copy that never
          // delivered: a primary that flowed and froze is judged by the qualified dark rail above.
          if (rk.indexOf('stg:') === 0 && !fb.dark && !fb.suspect && bytes.b <= 0 && !(fb.lastBytes > 0)
              && fb.claimAt && now - fb.claimAt > STG_ZERO_MS) {
            const std = __C.mosStandby.get(rk);
            if (std && std.key) {
              fb.dark = true; stgFoNote(rk, 'dark', std.via, 'zero-byte dead rule');
              (0, /*()*/__C.demand)(std.via, std.key, std.streamId, true); // wake NOW — don't wait for the sweep
              schedReconcile();
            }
          }
          // While a wake/failback overlap runs, sample the STANDBY too: its
          // framesDecoded (decode path — render throttling can't touch it) is
          // the strict "demonstrably FLOWS" evidence a dark-initiated swap
          // requires. v1's re-park break lived here: the videoWidth>0 swap
          // fallback read a camOff standby's STALE last frame as flowing.
          await sampleStandby(rk, fb);
          // A stage standby woken for a dark primary with no byte STG_ZERO_MS later: the claim pass parks it
          // (standbyStaysHot) and picks the next candidate now, not at the next sweep.
          if (rk.indexOf('stg:') === 0 && (fb.dark || pri.deadAt) && fb.wakeAt && now - fb.wakeAt > STG_ZERO_MS && fb.d0 >= 0 && !(fb.stdB > fb.b0)) schedReconcile();
        }
        // ADAPTIVE CADENCE (2026-07-30 power work). This loop was a flat
        // 300ms getStats() sweep, forever, on every device — 3.3 wakeups/sec
        // even in a 2-person room with no mosaic at all, and getStats() is one
        // of the more expensive things a WebRTC page can do. CPU cycles are
        // watts on a phone, so pay 300ms ONLY where it buys something:
        //   - a slot is dark, or a wake/failback overlap is running → the
        //     moment speed matters, keep the fast beat
        //   - a claim exists WITH a standby that could take over → 900ms is
        //     still far inside MOS_GRACE (5s), so detection is unaffected
        //   - nothing watchable (no redundant claim, or no standby to fail
        //     over TO — the watchdog's only action is waking one) → 3s, which
        //     is really just "notice when that changes"
        // The guarantee is unchanged: darkness is still declared on byte
        // silence, and the fast path still exists exactly when it can act.
        let urgent = false, watchable = false; dogVoiceFast = false;
        for (const [rk, pv] of __C.mosIn) {
          if (!(0, /*()*/__C.isRedun)(rk)) continue;
          const fb = mosFb.get(rk); if (!fb) continue;
          if (stgVoiceClaim(rk, pv)) dogVoiceFast = true;
          if ((fb.dark || fb.wakeAt) && !fb.suspect) { urgent = true; break; }
          if (fb.suspect || __C.mosStandby.get(rk) || rk.indexOf('stg:') === 0) watchable = true;
        }
        dogEvery = (urgent || dogVoiceFast) ? 300 : (watchable ? 900 : 3000);
      } catch (e) {}
      dogBusy = false;
      dogT = setTimeout(mosWatchdog, dogEvery);
    }
    let dogEvery = 300;
    // One pipe's inbound counters, by receiver-track OBJECT identity: video
    // (bytes, framesDecoded) for a feed that has video, audio (bytes,
    // packetsReceived) for a voice-only feed. Returns -1 when the pipe has no
    // receiver for that track (forming, or a rebuilt transport whose
    // receivers no longer carry it).
    async function pipeBytes(ent, voice) {
      try {
        const p = __C.peers.get(ent.via); if (!p || !p.pc || !ent.stream) return -1;
        // A stage feed is judged on its voice: a share's picture can flow on its own pipe
        // while the voice beside it has stopped.
        if (voice && ent.stream.getAudioTracks()[0]) return pipeAudioBytes(p, ent.stream.getAudioTracks()[0]);
        const vt = ent.stream.getVideoTracks()[0];
        if (!vt) return pipeAudioBytes(p, ent.stream.getAudioTracks()[0]);
        const rcv = p.pc.getReceivers().find((r) => r.track === vt); if (!rcv) return -1;
        const rep = await rcv.getStats();
        // A receiver with NO inbound-rtp row yet has received NOTHING — that
        // is a judgeable ZERO, not an unjudgeable absence. Returning -1 here
        // made the watchdog skip never-delivered pipes entirely, so a seat
        // claiming a husk ship sat hot-and-blind forever: every rail
        // (hot-void included) lived behind the -1 skip (frza14/16: single
        // seats frozen 4.5min with 1000+ unanswered PLIs and a live parked
        // standby that was never woken).
        let out = { b: 0, d: 0 };
        rep.forEach((s) => { if (s.type === 'inbound-rtp' && s.kind === 'video') out = { b: s.bytesReceived || 0, d: s.framesDecoded || 0 }; });
        return out;
      } catch (e) { return -1; }
    }
    // A voice-only feed's pipe: packets received stand in for decoded frames.
    // A muted stager still sends (silence frames), so a live voice pipe always
    // advances.
    async function pipeAudioBytes(p, at) {
      try {
        if (!at) return -1;
        const rcv = p.pc.getReceivers().find((r) => r.track === at); if (!rcv) return -1;
        const rep = await rcv.getStats();
        let out = { b: 0, d: 0 };
        rep.forEach((s) => { if (s.type === 'inbound-rtp' && s.kind === 'audio') out = { b: s.bytesReceived || 0, d: s.packetsReceived || 0 }; });
        return out;
      } catch (e) { return -1; }
    }
    let dogT = setTimeout(mosWatchdog, 300);
    yield 2212;
    // END-STAGE-DARK-HOLD
    const MOS_GRACE = GifOS.timings.MOS_GRACE;
    const MOS_SETTLE = GifOS.timings.MOS_SETTLE; // failback hysteresis: preferred must be back this long
    // Watchdog thresholds (see mosWatchdog above): video RTP at even 15fps
    // lands packets every ~70ms, so 700ms of a frozen bytesReceived on a
    // previously-flowing hot pipe is DARK beyond doubt — that is what turns
    // the 3-13s ICE-detection lottery into a sub-second wake.
    const MOS_DARK_MS = GifOS.timings.MOS_DARK_MS;   // no byte advance on a previously-flowing hot pipe = dark
    const MOS_FLOWED_RECENT = GifOS.timings.MOS_FLOWED_RECENT; // "previously flowing" horizon — never fires on a pipe that never delivered
    const MOS_QUALIFY = GifOS.timings.MOS_QUALIFY;     // consecutive advancing samples before a pipe earns the watchdog (~2.4s at the 300ms loop, 7.2s at the watchable 900ms cadence — see the 2026-08-08 note in mosWatchdog for why this stays a COUNT, not a clock)
    const STG_PIC_LIVE_MS = GifOS.timings.STG_PIC_LIVE_MS; // a stage primary's picture still arrives: its video bytes advanced this recently
    const STG_ZERO_MS = GifOS.timings.STG_ZERO_MS;  // stage audio gets no grace: a stage copy with zero bytes this long after its claim, or after its wake, is dead
    const HOT_VOID_MS = GifOS.timings.HOT_VOID_MS; // hot-and-VOID: a hot primary with ZERO bytes this long is a husk, not a slow pipe (frza5)
    const mosFb = new Map();
    yield 2229;
    // A SECOND-ROOT COPY A RECEIVER PLAYS KEEPS ITS SOURCE. My parked standby is re-picked as paths come and go, and a
    // failover makes it my primary. Re-pointing a played copy at whatever I hold parked next changed its root under the
    // same stream id: the receiver kept playing what it took for the root it had chosen and heard a parked chain that
    // never woke, or a copy from the seat that had just died. So while a receiver plays it (the job is active), the copy
    // stays on its source as long as I hold that source (primary or standby) and the source does not come through the
    // receiver; once I hold it no more, the copy ends and the receiver fails over by its own rules. A parked copy
    // follows my standby: nobody plays it, and its announce carries the new path.
    // Returns the held entry to ship, false when the played copy just ended, null when the job is not played.
    function stgRootHold(jk, slot, to) {
      const job = __C.mosJobs.get(jk);
      if (!job || !job.active || !job.srcTracks || !job.srcTracks.length) return null;
      const ent = [__C.mosIn.get(slot), __C.mosStandby.get(slot)].find((e) => !!(e && e.stream && (0, /*()*/__C.stgFedBy)(job, e)));
      if (ent && (0, /*()*/__C.stgPath)(ent).indexOf((0, /*()*/__C.vpId)(to)) < 0) return ent;
      (0, /*()*/__C.unshipJob)(jk, true); shipContainers.delete(jk); // the next copy gets a fresh id, never the one the receiver played
      return false;
    }
    // A copy flows only while its sender holds the feed (mesh_media.inc: the feed is a search
    // from a live source). Every copy I relay from this claim stops while the claim is dark or
    // gone, and starts again the moment it flows. Without this, Section 1's rook flood keeps a
    // dead stager's feed circling as silence, as a ring the path list cannot see past 12 seats.
    function stgCarry(rk, on, pri, onlyTo) {
      for (const job of __C.mosJobs.values()) {
        if (job.upKey !== rk || !job.active || !job.senders) continue;
        if (on ? !job.carryOff : !(pri && (0, /*()*/__C.stgFedBy)(job, pri))) continue; // a copy fed by my parked standby is the way out: never stop it
        if (!on && onlyTo && job.to !== onlyTo) { if (job.carryOff) { job.carryOff = false; job.senders.forEach((sd, i) => { const t = job.trackList[i]; if (t && jobSendsAt(job, i)) { try { sd.replaceTrack(t); } catch (e) {} } }); } continue; }
        job.carryOff = !on;
        job.senders.forEach((sd, i) => { const t = job.trackList[i]; if (t) { try { sd.replaceTrack(on && jobSendsAt(job, i) ? t : null); } catch (e) {} } });
        const jk = job.key + '>' + job.to; if (pipeJobs.has(jk) && __C.MPipe) { try { __C.MPipe.pausePipe(jk, !on || !!job.vParked); } catch (e) {} } // a piped picture stops at the worker too
      }
    }
    // Is my claim on this stage feed one I may relay or count as a feed? Not while it is dark or
    // gone. A dark claim that kept announcing let a whole Section 1 row keep "live" claims on a
    // dead stager, with no media at all, for as long as the fold listed it (room v3ring).
    function stgLost(rk) {
      const f = __C.mosIn.get(rk); if (!f) return true;
      const fb = mosFb.get(rk);
      return !!(f.deadAt || (fb && fb.dark) || (0, /*()*/__C.stgStale)(rk));
    }
    yield 2233;
    function stgBeatSeen(key, b) { const e = __C.stgBeats.get(key); return !!e && e.seen.indexOf(b) >= 0; }
    const stgBeatT = (b) => (b >= STG_PIC_MIN_B ? Math.floor(b / STG_PIC_WORD) : b); // the stager's clock, from either form of the value (stgPicNote)
    // The mark holds only while the stager is heard (a beat accepted within the stale window). A stager whose clock
    // stepped back sends values behind its own mark for good; once its feed has gone stale here, the next verified
    // beat re-bases the mark wherever it is, and the feed resumes. A page draining old beats after its own stall is
    // stale too, so it passes each one on once, in order, and its live peers drop them: bounded, never a flood.
    const stgBeatLive = (e) => e.at > 0 && Date.now() - e.at < __C.STG_BEAT_STALE_MS;
    function stgBeatOld(key, b) { const e = __C.stgBeats.get(key); return !!e && e.newest > 0 && stgBeatLive(e) && stgBeatT(b) < e.newest - __C.STG_BEAT_STALE_MS; }
    function stgBeatNew(key, b) {
      let e = __C.stgBeats.get(key); if (!e) { e = { seen: [], at: 0, newest: 0 }; __C.stgBeats.set(key, e); }
      if (e.seen.indexOf(b) >= 0 || stgBeatOld(key, b)) return false;
      const live = stgBeatLive(e);
      e.seen.push(b); if (e.seen.length > __C.STG_BEAT_SEEN) e.seen.shift();
      e.at = Date.now();
      const t = stgBeatT(b); if (t > e.newest || !live) e.newest = t;
      stgPicNote(e, b);
      return true;
    }
    // THE PICTURE KEEPALIVE. A stage feed is judged on its voice, because a still share legitimately sends no frames: frozen picture and still picture read the same at a
    // receiver. So the stager's beat says how many frames it encoded: low 12 bits of the signed value (old pages treat b as opaque). Frames made at the source while my decoder
    // stands still is a dead picture on my path; no new frames at the source is a still picture, and no verdict.
    const STG_PIC_WORD = 4096, STG_PIC_MIN_B = Math.pow(2, 44), STG_PIC_FRAMES = GifOS.timings.STG_PIC_FRAMES, STG_PIC_DEAD_MS = GifOS.timings.STG_PIC_DEAD_MS, STG_PIC_RETRY_MS = GifOS.timings.STG_PIC_RETRY_MS;
    function stgPicNote(e, b) {
      if (b < STG_PIC_MIN_B) return;   // a beat with no count: a page that has no video job, or an older page
      const t = Math.floor(b / STG_PIC_WORD), n = b % STG_PIC_WORD;
      if (e.pfT !== undefined && t <= e.pfT) return;   // the flood can reorder
      e.pfN = e.pfN === undefined ? 0 : e.pfN + ((n - e.pf + STG_PIC_WORD) % STG_PIC_WORD);
      e.pf = n; e.pfT = t; e.pfAt = Date.now();
    }
    let stgPicCount = 0, stgPicSd = null, stgPicEnc = 0, stgPicKnown = false;
    function stgPicSample() {   // my own frames encoded, on one active stage job (its sender; a new sender re-baselines)
      let sd = null;
      for (const job of __C.mosJobs.values()) { if (job.active && job.key === 'stg:' + __C.myId) { sd = (job.senders || []).find((x) => x && x.track && x.track.kind === 'video') || null; if (sd) break; } }
      if (!sd) { stgPicKnown = false; stgPicSd = null; return; }
      sd.getStats().then((rep) => {
        let enc = -1; rep.forEach((r) => { if (r.type === 'outbound-rtp' && r.kind === 'video') enc = r.framesEncoded || 0; });
        if (enc < 0) return;
        if (stgPicSd === sd && enc > stgPicEnc) stgPicCount = (stgPicCount + enc - stgPicEnc) % STG_PIC_WORD;
        stgPicSd = sd; stgPicEnc = enc; stgPicKnown = true;
      }).catch(() => {});
    }
    // My copy's decoder against the source's count. One getStats a second, only for a feed whose stager tells its count.
    async function stgPicCheck(rk, pri, fb, now) {
      const e = __C.stgBeats.get(rk), vt = pri.stream && pri.stream.getVideoTracks()[0];
      if (!vt || !e || e.pfN === undefined || now - e.pfAt > __C.STG_BEAT_STALE_MS) { if (fb.picDead) { fb.picDead = false; schedReconcile(); } fb.picRef = null; return; }
      if (fb.picCheckAt && now - fb.picCheckAt < 900) return;
      fb.picCheckAt = now;
      const v = await pipeBytes(pri, false); if (v === -1) return;
      if (fb.picRef !== pri || v.d !== fb.picD) {
        if (fb.picDead) { fb.picDead = false; fb.picStdOk = false; fb.picStd0 = null; schedReconcile(); }   // it came back by itself
        fb.picRef = pri; fb.picD = v.d; fb.picN = e.pfN; fb.picAt = now; return;
      }
      if (!fb.picDead && e.pfN - fb.picN >= STG_PIC_FRAMES && now - fb.picAt >= STG_PIC_DEAD_MS) {
        fb.picDead = true; fb.picDeadAt = now; fb.picStdOk = false; fb.picStd0 = null; stgFoNote(rk, 'pic-dead', pri.via, 'frames flat');
        try { (0, /*()*/__C.kfNeed)(rk); } catch (err) {}   // a lost key looks the same: ask first
        schedReconcile();
      }
      if (fb.picDead) {
        const std = __C.mosStandby.get(rk);
        if (std) { const sv = await pipeBytes(std, false); if (sv !== -1) { if (fb.picStd0 == null || sv.d < fb.picStd0) fb.picStd0 = sv.d; else if (sv.d > fb.picStd0 && !fb.picStdOk) { fb.picStdOk = true; schedReconcile(); } } }
        if (now - fb.picDeadAt > STG_PIC_RETRY_MS) { fb.picDead = false; fb.picRef = null; schedReconcile(); }   // no copy showed a picture: judge afresh
      }
    }
    // THE BEAT IS SIGNED by the stager's identity key, the key that names it (the pid is derived from the
    // public key). A page passes on only a beat whose signature checks, so nobody else can make one: a
    // forger could otherwise hold a dead stager on stage with made-up values until its lease ran out.
    // The seen list drops a replay before any check; the derivation of pid from key is kept per key.
    const stgBeatSp = (key, b) => 'mx-beat|' + key + '|' + b;
    const stgBeatPids = new Map();
    function stgBeatPid(pub) { let q = stgBeatPids.get(pub); if (!q) { q = Promise.resolve(GifOS.meshIdentity.peerIdOf(pub)).catch(() => null); stgBeatPids.set(pub, q); if (stgBeatPids.size > 64) stgBeatPids.delete(stgBeatPids.keys().next().value); } return q; }
    function stgBeatFlood(key, b, from, sig, pub) {
      for (const [pid, p] of __C.peers) if (pid !== from && p.dc && p.dc.readyState === 'open') { (0, /*()*/__C.dcSend)(p, { k: 'mx-beat', key, b, sig, pub }); if (__C.stgBeatCost) __C.stgBeatCost.out++; }
    }
    yield 2251;
    function stgBeatIn(p, m) {
      const t0 = __C.stgBeatCost ? performance.now() : 0;
      if (__C.stgBeatCost) __C.stgBeatCost.in++;
      if (typeof m.key !== 'string' || m.key.indexOf('stg:') !== 0 || m.key.length > 128 || !Number.isFinite(m.b) || typeof m.sig !== 'string' || m.sig.length > 256 || typeof m.pub !== 'string' || m.pub.length > 128) return;
      if (m.key === 'stg:' + __C.myId || (0, /*()*/__C.mediaOk)(p.id) === false || stgBeatSeen(m.key, m.b) || stgBeatOld(m.key, m.b)) { if (__C.stgBeatCost) __C.stgBeatCost.ms += performance.now() - t0; return; }
      const key = m.key, b = m.b, sig = m.sig, pub = m.pub, from = p.id;
      stgBeatPid(pub).then((pid) => (pid && pid === key.slice(4) ? __C.net.edVerify(pub, sig, stgBeatSp(key, b)) : false))
        .then((ok) => { const t1 = __C.stgBeatCost ? performance.now() : 0; if (ok && stgBeatNew(key, b)) stgBeatFlood(key, b, from, sig, pub); if (__C.stgBeatCost) __C.stgBeatCost.ms += performance.now() - t1; })
        .catch(() => {});
      if (__C.stgBeatCost) __C.stgBeatCost.ms += performance.now() - t0;
    }
    yield 2262;
    // On the worker clock: a stale beat stops relayed media and delists the stager, so a hidden stager's throttled page timer must not reach it.
    GifOS.meshMedia.workerClock(__C.STG_BEAT_MS, () => {
      try {
        const t0 = __C.stgBeatCost ? performance.now() : 0;
        if ((0, /*()*/__C.stageIds)().includes(__C.myId) && __C.myIdentity) { stgPicSample(); const key = 'stg:' + __C.myId, b = stgPicKnown ? Date.now() * STG_PIC_WORD + stgPicCount : Date.now(); stgBeatNew(key, b); const pub = __C.myIdentity.pubB64; __C.net.edSign(__C.myIdentity.priv, stgBeatSp(key, b)).then((sig) => stgBeatFlood(key, b, null, sig, pub)).catch(() => {}); }
        if (__C.stgBeatCost) __C.stgBeatCost.ms += performance.now() - t0;
        for (const [k, e] of __C.stgBeats) if (Date.now() - e.at > 300000) __C.stgBeats.delete(k);
      } catch (e) {}
    });
    // A packed mosaic's tile takes the SHAPE of its content: the packer sizes
    // its canvas to the gapless grid (k×1 bar, near-square frame), so the tile
    // just mirrors the stream's real dimensions — no fixed 5×5, no letterbox.
    function trackAspect(el, v) {
      const set = () => { if (v.videoWidth && v.videoHeight) el.style.aspectRatio = (v.videoWidth / v.videoHeight).toFixed(4); };
      v.addEventListener('resize', set); v.addEventListener('loadedmetadata', set); set();
    }
    yield 2266;
    // A STAGER NEVER WATCHES ITSELF THROUGH ITS OWN COMPOSITE.
    //
    // When the Stage holds exactly ONE member and that member is me, the strip
    // I would paint is a canvas copy of a track I am already holding: the same
    // pixels, one packer hop and one stageFps() gate later (measured solo,
    // headless: the strip 94ms behind capture against 31ms for the direct
    // track — test/tools/stage-solo-lag.js). At a DEEP seat it is worse still,
    // because that copy travelled up the tree to Section 1 and back down. The
    // composite is still BUILT and SHIPPED whenever someone is there to receive
    // it — what changes is only what I look at.
    //
    // The track is meTile's, which refreshOutbound keeps identical to the
    // outbound one ("your self-view shows EXACTLY the track you broadcast"), so
    // this shows the BROADCAST — blur baked in — never a private clear copy.
    let selfStageSt = null, stageDirectSt = null;
    let stageViewNow = null; // what the stage element shows: 'self' | 'screen' | 'strip' (stageFacesForTest)
    function selfStageStream() {
      const st = __C.meTile && __C.meTile.video && __C.meTile.video.srcObject;
      // A share from the Row: my Row tile is the camera, my Stage is the screen.
      const vt = (0, /*()*/__C.shareOnlyStage)('me') ? stageVideoTrack() : (st && st.getVideoTracks()[0]);
      if (!vt || vt.readyState === 'ended') { selfStageSt = null; return null; }
      // CACHED BY TRACK IDENTITY: paintStageStrip re-assigns srcObject whenever
      // the stream differs and the mosaic sweep runs every 2s, so minting a
      // fresh MediaStream per sweep would restart the element forever.
      if (!selfStageSt || selfStageSt.getVideoTracks()[0] !== vt) selfStageSt = new MediaStream([vt]);
      return selfStageSt;
    }
    // On a phone, keep the share line and Stop sharing off the slide: in the
    // side bars when the slide leaves them wide enough, else in a row under
    // the picture. Bigger screens keep them on the slide's edge.
    const stageMarksMq = window.matchMedia('(max-width: 700px), (max-height: 500px)');
    function placeStageMarks(el) {
      if (!el || !el.isConnected) return;
      const v = el.querySelector('video'), lb = el.querySelector('.rlabel'), stop = el.querySelector('.stagestop');
      const want = stageMarksMq.matches && document.body.classList.contains('screen-on') &&
        lb && lb.classList.contains('sharelabel') && v && v.videoWidth > 0 && v.videoHeight > 0;
      el.classList.remove('mk-side', 'mk-bar');
      if (!want) return;
      const W = el.clientWidth, H = el.clientHeight;
      if (W < 40 || H < 40) return;
      const side = (W - H * (v.videoWidth / v.videoHeight)) / 2;
      if (side >= 96) {
        el.style.setProperty('--mkw', Math.floor(side) + 'px');
        el.classList.add('mk-side');
        const fits = lb.scrollWidth <= lb.clientWidth + 1 && lb.offsetHeight <= H - (stop ? 0 : 4) &&
          (!stop || (stop.offsetWidth + 10 <= side && stop.offsetTop + stop.offsetHeight <= H - lb.offsetHeight));
        if (fits) return;
        el.classList.remove('mk-side');
      }
      el.classList.add('mk-bar');
    }
    // A guest's share as a viewer sees it (debug only; remoteShareForTest).
    let qaStageSt = null;
    // The Stage strip: one wide tile at the top of the stage feed.
    function paintStageStrip(stream) {
      if (qaStageSt) stream = qaStageSt;
      let el = __V.stagefeedEl.querySelector('[data-row="sgs"]');
      // The Row drops whoever the Stage strip shows (and takes them back when
      // it goes), so the gallery is laid out again when the strip appears,
      // goes, gets a new stream or shows a different set of people. The
      // Stadium sweep no longer lays out on every pass to catch it.
      if (!stream) {
        const had = !!el;
        if (el) { for (const v of el.querySelectorAll('video')) { try { v.pause(); v.srcObject = null; } catch (e) {} releaseAudio(v); } el.remove(); }
        stageViewNow = null;
        compOf.delete('sgs'); __C.recSrcDirty = true;
        if (typeof __V.paintStagePlate === 'function') (0, /*()*/__V.paintStagePlate)();
        if (had) { try { (0, /*()*/__V.layout)(); } catch (e) {} }
        return;
      }
      const prevSgs = compOf.get('sgs');
      let stripChanged = !el;
      if (!el) {
        el = document.createElement('div'); el.className = 'rowtile'; el.dataset.row = 'sgs';
        const v = document.createElement('video'); v.muted = true; v.autoplay = true; v.setAttribute('playsinline', '');
        const lb = document.createElement('div'); lb.className = 'rlabel'; lb.textContent = (0, /*()*/__C.uiText)('stageLabel', 'On stage');
        el.appendChild(v); el.appendChild(lb); __V.stagefeedEl.appendChild(el); trackAspect(el, v);
        const again = () => placeStageMarks(el);
        v.addEventListener('resize', again); v.addEventListener('loadedmetadata', again);
        if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(again)).observe(el);
      }
      const v = el.querySelector('video');
      if (!(typeof wkHolds === 'function' ? wkHolds(v, stream) : v.srcObject === stream)) { if (typeof wkBindVideo === 'function') wkBindVideo(v, stream); else v.srcObject = stream; const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); stripChanged = true; }
      // NAME THE SHARE. A composited strip carries no attribution of its own —
      // the burned overlay names each face, but a shared screen's pixels are
      // somebody's spreadsheet, with nothing on them to say whose window this
      // is or that it is a window at all. The label says it, from gossip, the
      // same on every device.
      const shr = (0, /*()*/__C.screenSharers)();
      const lbEl = el.querySelector('.rlabel');
      if (lbEl) {
        const guest = (0, /*()*/__C.uiText)('aGuest', 'A guest');
        const join = (0, /*()*/__C.uiText)('nameJoin', ' & ');
        const others = shr.filter((id) => id !== __C.myId).map((id) => __C.rosterNames[id] || (__C.peers.get(id) || {}).name || guest);
        const mine = shr.indexOf(__C.myId) !== -1;
        lbEl.textContent = shr.length
          ? '🖥 ' + (mine && !others.length
            ? (0, /*()*/__C.uiText)('shareMineStage', 'Your screen — on stage')
            : !mine
              ? (0, /*()*/__C.uiText)('shareTheirStage', '{names}’s screen — on stage').replace('{names}', others.join(join))
              : (0, /*()*/__C.uiText)('shareBothStage', 'Your screen & {names}’s — on stage').replace('{names}', others.join(join)))
          : (0, /*()*/__C.uiText)('stageLabel', 'On stage');
        lbEl.classList.toggle('sharelabel', shr.length > 0);
      }
      // STOP ON THE SLIDE. The More row also says Stop sharing, and the
      // thumbnail has a small chip, but a client demo is looking at the
      // stage. The button is only mine to press.
      let stop = el.querySelector('.stagestop');
      if (__C.myStatus.scr) {
        if (!stop) {
          stop = document.createElement('button');
          stop.type = 'button';
          stop.className = 'stagestop';
          stop.addEventListener('click', () => stopScreenShare());
          el.appendChild(stop);
        }
        const word = (0, /*()*/__C.uiText)('stopShare', 'Stop sharing');
        if (stop.textContent !== word) stop.textContent = word;
      } else if (stop) stop.remove();
      placeStageMarks(el);
      const sgsNames = (0, /*()*/__C.stageIds)();
      if (!prevSgs || prevSgs.streamId !== stream.id || prevSgs.el !== v || String(prevSgs.names) !== String(sgsNames)) stripChanged = true;
      compOf.set('sgs', { via: 'stage', streamId: stream.id, stream, names: sgsNames, el: v });
      __C.recSrcDirty = true;
      if (typeof __V.paintStagePlate === 'function') (0, /*()*/__V.paintStagePlate)();
      if (stripChanged) { try { (0, /*()*/__V.layout)(); } catch (e) {} }
    }
    function stopMosaic() {
      __C.mosBeyondAt = 0;
      for (const jk of [...__C.mosJobs.keys()]) (0, /*()*/__C.unshipJob)(jk, true);
      for (const rk of [...__C.mosIn.keys()]) (0, /*()*/__C.dropMosIn)(rk);
      for (const rk of [...__C.mosStandby.keys()]) (0, /*()*/__C.dropStandby)(rk);
      __C.subWant.clear();
      __C.mosAnn.clear();
      mosFb.clear();
      pipeDeny.clear(); pipeDenyUntil.clear(); pipeDenyN.clear();
      attachFailAt.clear(); stgAudioMemo = new WeakMap();
      if (prodPack) { prodPack.stop(); prodPack = null; }
      if (roomPack) { roomPack.stop(); roomPack = null; }
      pipePacksStop();
      if (sdView) { sdView.stop(); sdView = null; }
      packLoopStop();
      for (const f of downFolds.values()) f.clear();
      downFolds.clear(); downStreams.clear();
      for (const pk of l14Packs.values()) pk.stop();
      l14Packs.clear();
      if (stripPack) { stripPack.stop(); stripPack = null; }
      if (stageEar) { stageEar.fold.clear(); stageEar.sids.clear(); }
      (0, /*()*/__V.paintStadiumTile)(null); paintStageStrip(null);
    }
    yield 2275;
    // Questions mixIn asks. The element stays in this plane. packFor only reads a pack that already exists.
    function partStream(ref) {
      if (!ref) return null;
      if (ref.own === 'mic') return (0, /*()*/__C.iAmWaiting)() ? null : selfFoldStream();
      if (ref.own === 'stage') return mySelfStream();
      if (ref.seat) {
        const pid = ref.seat;
        if ((0, /*()*/__C.peerWaits)(pid)) return null;
        const p = __C.peers.get(pid);
        if (!p) return null;
        const voice = p.relayed ? ((__C.relayVia.get(pid) || {}).stream || null) : (p.stream || null);
        return voice || (p.video && p.video.srcObject) || null;
      }
      if (ref.in) { const ent = __C.mosIn.get(ref.in); return ent && ent.stream ? ent.stream : null; }
      return null;
    }
    function slotDark(rk) { const fb = mosFb.get(rk); return !!(fb && fb.dark); }
    function carriedHot(q) { const slot = rowSdLv.get(q); return !!(slot && slot.hot); }
    function hopMs(slot) {
      const ent = __C.mosIn.get(slot);
      const tr = ent && ent.stream && ent.stream.getAudioTracks ? ent.stream.getAudioTracks()[0] : null;
      return tr ? audioHopMs(tr) : 0;
    }
    function packFor(kind, skip) {
      const metaOf = (pk) => { const m = { n: pk.count(), cols: pk.cols() }; const ids = pk.cellIds ? pk.cellIds() : null; if (ids && ids.length === m.n && ids.every((x) => typeof x === 'string' && x)) m.ids = ids; return m; };
      if (kind === 'room') { if (!roomPack || !(roomPack.count() > 0) || !roomPack.track) return null; return { track: roomPack.track, meta: metaOf(roomPack) }; }
      if (kind === 'pipe') { const pk = pipePacks.get(skip); if (!pk || !(pk.count() > 0) || !pk.track) return null; return { track: pk.track, meta: metaOf(pk) }; }
      if (kind === 'prod') { if (!prodPack || !(prodPack.count() > 0) || !prodPack.track) return null; return { track: prodPack.track, meta: metaOf(prodPack) }; }
      if (kind === 'l14') { const pk = l14Packs.get(skip); if (!pk || !(pk.count() > 0) || !pk.track) return null; return { track: pk.track, meta: metaOf(pk) }; }
      return null;
    }
    function blockOf(rk) {
      const f = __C.mosIn.get(rk);
      if (f && f.meta && f.meta.n) { const m = { n: f.meta.n, cols: f.meta.cols || f.meta.n }; if (Array.isArray(f.meta.ids) && f.meta.ids.length === m.n) m.ids = f.meta.ids.slice(); if (typeof f.meta.alag === 'number') m.alag = f.meta.alag; return m; }
      const w = f && f.el ? (f.el.videoWidth || 0) : 0, h = f && f.el ? (f.el.videoHeight || 0) : 0;
      const k = (w && h) ? Math.max(1, Math.round(Math.max(w, h) / Math.min(w, h))) : 1;
      return { n: k, cols: k };
    }
    function rowMixOpen() { return rowMixShipUntil > Date.now(); }
    function mixReady() { if (mixAc && mixAc.state !== 'closed') return true; return !!(__C.ac && __C.ac.state !== 'closed'); }
    // The same answer as rowMixVia, without writing rowX2To and without keepAdd.
    function rowMixViaPeek() {
      const c = (0, /*()*/__C.meshCoord)(); if (!c || c.pc !== 0) return null;
      const dest = (c.i === c.r) ? 0 : c.i, cell = { pc: 0, r: dest, i: c.i };
      const pid = (0, /*()*/__C.occPid)(cell); if (pid) return pid;
      return x2Kept(__C.net.topo.ckey(cell), Date.now());
    }
    // Questions packIn asks. The element stays in this plane. None of these writes.
    function faceLive(pid) {
      if (!pid) return false;
      if (pid === __C.myId) return (0, /*()*/__C.iAmWaiting)() ? false : !!(__C.meTile && __C.meTile.video);
      if ((0, /*()*/__C.peerWaits)(pid)) return false;
      const p = __C.peers.get(pid);
      return !!(p && p.video);
    }
    function blockPicture(mosKey) {
      const f = __C.mosIn.get(mosKey);
      return !!(f && f.stream && f.stream.getVideoTracks().some((t) => t.readyState !== 'ended'));
    }
    function blockLive(mosKey) {
      const f = __C.mosIn.get(mosKey);
      return !!(f && f.el);
    }
    function overlayTiny() {
      return MM.stadiumTiny((0, /*()*/__C.roomPastSection)() ? (0, /*()*/__C.displayCount)() : (0, /*()*/__C.knownTotal)());
    }
    function reconcileMosaic() {
      // Every face a packer burns reads its talking frame from the one verdict (speakingOf), live at paint (mesh-media
      // setTalkSource): never a copy taken at this 2 s sweep.
      if (MM.setTalkSource) MM.setTalkSource((pid) => { try { return !!__C.speakingOf.get(pid === __C.myId ? 'me' : pid); } catch (e) { return false; } });
      const s = (0, /*()*/__C.meshSeat)(), c = (0, /*()*/__C.meshCoord)();
      headShipTo = c && c.i !== 0 ? (0, /*()*/__C.rowHeadPid)(c) : null;
      // Container-registry hygiene: a job key's forever-container survives
      // unship ON PURPOSE (same sid on re-ship), but a container whose PEER
      // has left the room can never be shipped again — reap those, bounded
      // by churn. (An id holder costs ~nothing; this is tidiness, not memory
      // pressure.)
      for (const cjk of shipContainers.keys()) {
        if (__C.mosJobs.has(cjk)) continue;
        if (!__C.peers.has(cjk.slice(cjk.lastIndexOf('>') + 1))) shipContainers.delete(cjk);
      }
      // ACTIVE whenever the room extends beyond my row: section-mates in other
      // rows (Section channel), deep members (Stadium), or stagers (Stage).
      // A room that IS just my row costs nothing here — the row mesh shows it.
      // A BROADCAST never renders the row grid or the stadium (see the
      // body.broadcast CSS), so its row bands are upload nobody watches: past
      // one row the host shipped its band (a fold + composite) over a direct
      // link to each late arrival. Only the Stage lane below runs there; it
      // rides the relay tree (Q78).
      const beyondRow = (0, /*()*/__C.roomBeyondRow)(true);
      // Tile-residue cleanup (2026-07-29): a claim dropped through any other
      // path (husk drop, mx-end) leaves the collections EMPTY while the
      // stadium/strip tile is still PAINTED with its last (black) frame — the
      // sweep then skipped stopMosaic forever and a shrunk-to-one-row room
      // kept a permanent dead stadium square (seen live, prod room, monitor).
      // The residue case clears ONLY the paint — running full stopMosaic here
      // (with its mosAnn.clear) on the strength of a painted tile alone tore
      // down live announce state during convergence (e2e-mosaic run6: no
      // receiver ever accumulated a stage claim).
      if (!s || !c || (!beyondRow && !(0, /*()*/__C.stageIds)().length)) {
        // A local share has pixels before this seat exists. Clearing the
        // strip here left the stage blank until the mesh caught up (or
        // forever, with no seat). Keep the slide.
        const localShare = !!(__C.myStatus.scr && __C.screenStream);
        if (__C.mosJobs.size || __C.mosIn.size || __C.mosStandby.size || prodPack || roomPack || sdView || downFolds.size || l14Packs.size || stripPack) stopMosaic();
        else if (compOf.size && !localShare) { (0, /*()*/__V.paintStadiumTile)(null); paintStageStrip(null); }
        if (localShare) paintStageStrip(selfStageStream());
        return;
      }
      (0, /*()*/__C.claimMos)();
      const C = __C.SCALE.C, iAmHead = c.i === 0, wanted = new Set();
      const T = __C.net.topo;
      // L2.7: the heir of a row whose head is gone makes the row's Stadium product in its place; head geometry from the head's cell
      const actHead = !iAmHead && (0, /*()*/__C.iActAsHead)(); if (actHead !== rowActed) { rowActed = actHead; dbgRowHead(actHead ? 'acting' : 'stood-down'); }
      const carryPlan = (0, /*()*/__C.carryIn)();
      holdSecondRoots();
      for (const e of carryPlan) {
        if (!e || !e.key || !e.to || e.own) continue;
        if (section1Neighbour(e) && debugSkip(e)) continue;
        const meta = sdnAlag(e);
        const jk = (0, /*()*/__C.shipJob)(e.key, e.to, streamFor(e), meta, e.upKey);
        if (jk) wanted.add(jk);
      }
      const stagers = (0, /*()*/__C.stageIds)();               // gossiped, ordered, <=C
      const amStager = stagers.includes(__C.myId);
      // The Stage is me and nobody else ⇒ every strip in this sweep is a
      // composite of my own face, and I must not WATCH it (selfStageStream).
      const soloSelf = amStager && stagers.length === 1;
      // { el, stream } for a cell: my own live view, a claimed mosaic feed, or a
      // directly-linked peer. Stream carries the audio the fold sums; el is the
      // drawImage source (a <video> or a nested composite's <canvas>).
      // feedOnly: the claimed feed or nothing, never the row <video>.
      const srcFor = (pid, feedKey, feedOnly) => {
        // Someone in the waiting room is in no composite: no face, no voice.
        if (pid === __C.myId) return (0, /*()*/__C.iAmWaiting)() ? { el: null, stream: null } : { el: __C.meTile.video, stream: selfFoldStream() };
        const f = feedKey ? __C.mosIn.get(feedKey) : null;
        if (f) return { el: f.el, stream: f.stream };
        if (feedOnly) return { el: null, stream: null };
        if ((0, /*()*/__C.peerWaits)(pid)) return { el: null, stream: null };
        const p = __C.peers.get(pid);
        if (!p) return { el: null, stream: null };
        // The picture is whatever the tile shows; the VOICE is the person's own
        // stream (direct, or the one a friend carries), never the tile's
        // element. A camera-off tile whose picture is not arriving shows a
        // letter drawn here, and that element holds no sound: the row's
        // Stadium mix would drop the person while every row-mate still hears
        // them on the direct link.
        const voice = p.relayed ? ((__C.relayVia.get(pid) || {}).stream || null) : (p.stream || null);
        return { el: p.video, stream: voice || p.video.srcObject };
      };
      // A SHARED SCREEN PAINTED THROUGH THE STRIP IS A SHARED SCREEN NOBODY CAN
      // READ. The strip's cells are SQUARE (mesh-media cellSize) and a screen is
      // letterboxed into one (fitFor ⇒ 'contain'), so a 1920×1080 desktop lands
      // in 480×270 with black bars down the sides — a 4× downscale applied by
      // the VIEWER to a full-resolution feed it is already holding in memory.
      // That is the 110px strip's mistake surviving at 480 (see "THE STAGE IS
      // NOT A SECONDARY TILE"): raising the cell made faces fine, and text is
      // not a face.
      //   So when the Stage is ONE screen and this seat holds that feed, paint
      // the feed. The strip is still built and still shipped down — deeper
      // subtrees have nothing else — so this changes only what the LOCAL
      // element points at, exactly as soloSelf already does for my own face.
      // Every Section 1 seat holds every stage feed (the S1 flood), and a
      // relaying seat holds the ones it carries, so this reaches far past the
      // 25 seats of a full section.
      //   VIDEO TRACK ONLY, and that is not cosmetic: the strip is video-only
      // because Stage audio folds at each ear (mix-minus), so handing the
      // element a stream that ALSO carries the stager's audio would play it a
      // second time. Cached by track identity — paintStageStrip re-assigns
      // srcObject whenever the stream differs, and this sweep runs every 2s.
      // One shared screen fills the stage even when other people are up
      // there with it. Two screens have no single picture to feature, and a
      // face-only stage stays on the strip. Seats that do not hold the feed
      // still paint the composite.
      const stageScreenSid = () => {
        let sid = null;
        for (const id of stagers) {
          if (!(0, /*()*/__C.sharingScreen)(id)) continue;
          if (sid) return null;
          sid = id;
        }
        return sid;
      };
      // stageDirect refuses the self seat. soloSelf already covers "only me".
      // This is the sharer beside other faces.
      const myScreenBeside = () => {
        if (stagers.length < 2) return null;
        if (stageScreenSid() !== __C.myId) return null;
        return selfStageStream();
      };
      const stageDirect = () => {
        const sid = stageScreenSid();
        if (!sid) return null;
        // My own screen is selfStageStream's job; a FACE stays on the strip,
        // whose square crop is a deliberate choice about what a face is.
        if (sid === __C.myId || !(0, /*()*/__C.sharingScreen)(sid)) return null;
        // An admin turned this sharer's video off. An honest sharer has already
        // stopped (enforceForcedCam); a defiant one is shown by nobody honest.
        // The strip stands, and its compositor paints that cell dark.
        if ((0, /*()*/__C.forcedCamOff)(sid) || (typeof __C.shareBlocked === 'function' && (0, /*()*/__C.shareBlocked)(sid))) return null;
        // A moderator blurred this sharer. The raw feed would show it clear,
        // and the share bit is the sender's own claim; the strip stands, with
        // the blur baked into that cell.
        if ((0, /*()*/__C.modBlurOn)(sid)) return null;
        // THE STG FEED OR THE STRIP, NEVER THE ROW VIDEO. A stager's row
        // senders park (refreshOutbound), so their row <video> holds the last
        // camera frame and never the screen. The share's status can arrive
        // before the stg feed does, and in that gap a viewer's Stage showed
        // the sharer's frozen camera picture labelled as their screen. The
        // stg feed is the one that carries the screen.
        const sc = srcFor(sid, 'stg:' + sid, true);
        // A HELD decoder keeps the direct screen: the sweep parks the feed to restart a sink that never started (this strip), and the decoder has no pixels while parked. Falling back to the composite re-bound the strip mid-park and back after the resume, after flow both times, so the park could never cure it.
        if (!sc || !sc.el || !sc.stream || (!sc.el.videoWidth && !sc.el._mosHold)) return null; // no pixels yet — the strip stands, the next sweep switches
        const vt = sc.stream.getVideoTracks ? sc.stream.getVideoTracks()[0] : null;
        if (!vt || vt.readyState === 'ended') return null;
        if (!stageDirectSt || stageDirectSt.getVideoTracks()[0] !== vt) stageDirectSt = new MediaStream([vt]);
        return stageDirectSt;
      };
      // Grid tiles of stagers are hidden. When the stage element is the raw
      // screen, the other faces have to sit on it or they vanish. faces comes
      // from stageFaceSet (STAGE-FACES): a raw face fills its box; a strip
      // cell is the strip's own track, scaled and shifted inside the box. Video
      // only: their audio is already in the stage ear.
      const paintStageFaces = (faces) => {
        const host = __V.stagefeedEl.querySelector('[data-row="sgs"]');
        if (!host) return;
        // The per-person pack is showing these faces itself. An overlay here
        // would draw them a second time on the share.
        if (host.dataset && host.dataset.pack === '1') {
          const oldBox = host.querySelector('.stagefaces');
          if (oldBox) oldBox.remove();
          return;
        }
        let box = host.querySelector('.stagefaces');
        if (!faces || !faces.length) { if (box) box.remove(); return; }
        if (!box) {
          box = document.createElement('div');
          box.className = 'stagefaces';
          box.style.cssText = 'position:absolute;top:6px;right:6px;display:flex;flex-direction:column;gap:4px;z-index:2;max-height:80%;overflow:hidden;pointer-events:none';
          host.appendChild(box);
        }
        const keep = new Set();
        for (const fc of faces) {
          keep.add(fc.id);
          let wrap = null;
          for (const ch of box.children) if (ch.dataset.face === fc.id) wrap = ch;
          if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'stagefacebox';
            wrap.dataset.face = fc.id;
            wrap.style.cssText = 'position:relative;flex:none;width:' + STAGE_FACE_PX + 'px;height:' + STAGE_FACE_PX + 'px;overflow:hidden;border-radius:8px;background:#000';
            const v = document.createElement('video');
            v.className = 'stageface';
            v.muted = true;
            v.autoplay = true;
            v.playsInline = true;
            v.setAttribute('playsinline', '');
            // A strip frame that changes shape re-places the crop at once,
            // not at the next sweep; a frame the crop no longer fits shows
            // the named dark box, never a slice of a neighbour's cell.
            v.addEventListener('resize', () => stageFaceCss(v));
            wrap.appendChild(v);
            // The named dark box: a co-presenter with no picture here.
            const nm = document.createElement('div');
            nm.className = 'stagefacename';
            nm.style.cssText = 'position:absolute;top:0;right:0;bottom:0;left:0;display:none;align-items:center;justify-content:center;text-align:center;padding:4px;color:#ddd;font:12px/1.2 system-ui,sans-serif;overflow:hidden;word-break:break-word';
            wrap.appendChild(nm);
            box.appendChild(wrap);
          }
          const face = wrap.querySelector('video');
          const nm = wrap.querySelector('.stagefacename');
          const name = (0, /*()*/__C.displayName)(fc.id) || '';
          if (nm.textContent !== name) nm.textContent = name;
          if (face._vt !== fc.vt) {
            face._vt = fc.vt;
            if (fc.vt) {
              face.srcObject = new MediaStream([fc.vt]);
              const pr = face.play(); if (pr && pr.catch) pr.catch(() => {});
            } else { try { face.srcObject = null; } catch (e) {} }
          }
          face._cell = fc.cell || null;
          stageFaceCss(face);
          facePaint(face, { id: fc.id, where: 'stage', pic: 'face' }, 'box');
        }
        for (const ch of [...box.children]) {
          if (keep.has(ch.dataset.face)) continue;
          const v = ch.querySelector('video'); if (v) { try { v.srcObject = null; } catch (e) {} }
          ch.remove();
        }
        if (!box.children.length) box.remove();
      };
      // ---- GAPLESS PACKING (approach A — docs/media-plane.md) ----------------
      // Every shipped mosaic is a row-major PACKED grid of square faces with NO
      // internal holes; the announce meta carries {n, cols} so any receiver can
      // blit faces out by sub-rect and repack. Empty seats are never drawn.
      const blockMeta = (f) => {
        if (f && f.meta && f.meta.n) { const m = { n: f.meta.n, cols: f.meta.cols || f.meta.n }; if (Array.isArray(f.meta.ids) && f.meta.ids.length === m.n) m.ids = f.meta.ids.slice(); if (typeof f.meta.alag === 'number') m.alag = f.meta.alag; return m; } // ids: who sits in each cell (STADIUM-FACES), relayed as the strip's are
        const w = f && f.el ? (f.el.videoWidth || 0) : 0, h = f && f.el ? (f.el.videoHeight || 0) : 0;
        const k = (w && h) ? Math.max(1, Math.round(Math.max(w, h) / Math.min(w, h))) : 1;
        return { n: k, cols: k }; // legacy bar self-describes via aspect (5 − max/min = free)
      };
      const setBlock = (pk, id, ord, f) => { const m = blockMeta(f); pk.setTile(id, ord, f.el, f.stream, m); };
      const pipes = beyondRow ? (0, /*()*/__C.pipePeers)() : [];
      const rowMatePid = (pid) => { if (!pid) return false; for (let j = 0; j < C; j++) { if (j === c.i) continue; if ((0, /*()*/__C.occPid)({ pc: c.pc, r: c.r, i: j }) === pid) return true; } return false; };
      let roomEl = null, roomMeta = null, alag = 0;
      if (iAmHead || actHead) {
        if (beyondRow) {
          // SUB.4: the pipes of my row-mates (Section-1 seats that are not the head): each mate relays its pipe's product to me
          // marked {pipe, pv}, and I build that pipe's send (the sound and, while vouched, the pack without its block) as for
          // my own pipes; the mate hands it on ('sdxu:<pipe peer>').
          const matePipes = [];
          for (const [mk, uf] of __C.mosIn) { if (mk.indexOf('subu:') !== 0 || !uf || !uf.meta || uf.meta.pipe !== 1) continue; const h = mk.slice(5); if (uf.via !== h && rowMatePid(uf.via) && pipes.indexOf(h) < 0) matePipes.push(h); }
          const pipeKids = pipes.concat(matePipes);
          const kidVideo = (h) => (pipes.indexOf(h) >= 0 ? (0, /*()*/__C.pipeVideo)(h) : ((__C.mosIn.get('subu:' + h) || {}).meta || {}).pv === 1);
          if (c.pc === 0) {
            pipePacksStop((h) => pipeKids.indexOf(h) >= 0 && kidVideo(h));
          } else {
            if (roomPack) { roomPack.stop(); roomPack = null; }
            pipePacksStop();
            packLoopStop();
            const dn = __C.mosIn.get('sdn');
            const dv = dn && dn.stream ? dn.stream.getVideoTracks()[0] : null;
            if (dv && dv.readyState !== 'ended') { roomEl = dn.el; roomMeta = blockMeta(dn); }
            // Deeper, the picture passes through and the sound is re-mixed here: my audio hop adds to what came down.
            alag = Math.round(((dn && dn.meta && dn.meta.alag) || 0) + audioHopMs(dn && dn.stream ? dn.stream.getAudioTracks()[0] : null));
            if (roomMeta) roomMeta = Object.assign({}, roomMeta, { alag });
          }
        } else {
          if (roomPack) { roomPack.stop(); roomPack = null; }
          pipePacksStop();
          packLoopStop();
          for (const f of downFolds.values()) f.clear();
          downFolds.clear(); downStreams.clear();
          paintRoomView(null, null, null, c, 0);
        }
      } else {
        // A seat that left the head must not keep the head packers. Receivers re-claim the new head's mixes.
        if (prodPack) { prodPack.stop(); prodPack = null; }
        if (roomPack) { roomPack.stop(); roomPack = null; }
        pipePacksStop();
        packLoopStop();
        for (const f of downFolds.values()) f.clear();
        downFolds.clear();
        for (const k of [...downStreams.keys()]) if (k !== 'fwd') downStreams.delete(k);
      }
      // The plan names every packer this sweep fills. A key that left the plan is stopped. keepAdd stays here: it is this plane's side effect for a carried sdrow copy, not a plan decision.
      const ensurePack = (key, shape) => {
        if (key === 'prod') {
          if (!prodPack) prodPack = MM.createPacker({ shape: shape, fps: (0, /*()*/__C.compFps)(), ac: mixCtx() }).start();
          return prodPack;
        }
        if (key === 'room') {
          if (!roomPack) roomPack = MM.createPacker({ shape: shape, fps: (0, /*()*/__C.compFps)() }).start();   // video only
          return roomPack;
        }
        if (key.indexOf('pipe:') === 0) {
          const h = key.slice(5);
          let pk = pipePacks.get(h);
          if (!pk) { pk = MM.createPacker({ shape: shape, fps: (0, /*()*/__C.compFps)() }).start(); pipePacks.set(h, pk); }
          return pk;
        }
        if (key.indexOf('l14:') === 0) {
          const h = key.slice(4);
          let pk = l14Packs.get(h);
          if (!pk) { pk = MM.createPacker({ shape: shape, fps: (0, /*()*/__C.compFps)(), ac: mixCtx() }).start(); l14Packs.set(h, pk); }
          return pk;
        }
        return null;
      };
      const applyTiles = (pk, tiles) => {
        const pics = new Set(), sounds = new Set();
        const list = tiles || [];
        for (let i = 0; i < list.length; i++) {
          const t = list[i];
          if (!t || t.id == null || t.sound) continue;
          pics.add(t.id);
          const ref = t.ref || {};
          if (ref.face != null) {
            const sc = srcFor(ref.face);
            if (!sc || !sc.el) { pk.delTile(t.id); continue; }
            pk.setTile(t.id, t.ord, sc.el, t.mute ? null : sc.stream, { n: t.n, cols: t.cols, ids: t.ids, lbl: t.lbl, fit: t.fit, pid: t.pid, card: !!t.card });
          } else if (ref.in) {
            const ent = __C.mosIn.get(ref.in);
            if (!ent || !ent.el) { pk.delTile(t.id); continue; }
            setBlock(pk, t.id, t.ord, ent);
          } else pk.delTile(t.id);
        }
        if (pk.ids) for (const id of pk.ids()) if (!pics.has(id)) pk.delTile(id);
        for (let i = 0; i < list.length; i++) {
          const t = list[i];
          if (!t || t.id == null || !t.sound) continue;
          sounds.add(t.id);
          const ent = t.ref && t.ref.in ? __C.mosIn.get(t.ref.in) : null;
          if (ent && ent.stream && pk.setSound) pk.setSound(t.id, ent.stream);
          else if (pk.delSound) pk.delSound(t.id);
        }
        if (pk.soundIds) for (const id of pk.soundIds()) if (!sounds.has(id)) pk.delSound(id);
      };
      const plan = (0, /*()*/__C.packIn)() || [];
      const want = new Set();
      let sawProd = false;
      for (let pi = 0; pi < plan.length; pi++) {
        const pack = plan[pi];
        if (!pack || !pack.key) continue;
        want.add(pack.key);
        const pk = ensurePack(pack.key, pack.shape);
        if (!pk) continue;
        if (pack.key === 'prod' && !sawProd) {
          sawProd = true;
          dbgRowFaces = [];
          const tiles = pack.tiles || [];
          for (let i = 0; i < tiles.length; i++) {
            const t = tiles[i];
            if (!t || t.sound || t.id == null || String(t.id).charAt(0) !== 'r') continue;
            const pid = t.ref && t.ref.face;
            if (!pid) continue;
            const sc = srcFor(pid);
            if (sc && sc.el) dbgRowFaces.push({ i: Number(String(t.id).slice(1)), pid: String(pid).slice(0, 8) });
          }
        }
        if (pack.key === 'room') {
          for (let q = 0; q < C; q++) {
            if (q === c.r) continue;
            const rowIn = __C.mosIn.get('sdrow:' + q);
            if (rowIn && rowIn.via !== (0, /*()*/__C.occPid)({ pc: 0, r: q, i: 0 })) { const sk = (0, /*()*/__C.meshSeat)(); if (sk && sk.keepAdd) sk.keepAdd(rowIn.via, 16); } // L28: a carried copy stays until the direct one lands
          }
        }
        applyTiles(pk, pack.tiles);
      }
      if (prodPack && !want.has('prod')) { try { prodPack.stop(); } catch (e) {} prodPack = null; }
      if (roomPack && !want.has('room')) { try { roomPack.stop(); } catch (e) {} roomPack = null; }
      for (const [h, pk] of [...pipePacks]) if (!want.has('pipe:' + h)) { try { pk.stop(); } catch (e) {} pipePacks.delete(h); }
      for (const [h, pk] of [...l14Packs]) if (!want.has('l14:' + h)) { try { pk.stop(); } catch (e) {} l14Packs.delete(h); }
      // Section 1 re-makes the picture and the sound, so its pack starts level (alag 0). The encode-once loop runs only while the room pack has a tile.
      if ((iAmHead || actHead) && beyondRow && c.pc === 0) {
        if (roomPack && roomPack.count() > 0) {
          roomEl = roomPack.canvas;
          const m = { n: roomPack.count(), cols: roomPack.cols() };
          const ids = roomPack.cellIds ? roomPack.cellIds() : null;
          if (ids && ids.length === m.n && ids.every((x) => typeof x === 'string' && x)) m.ids = ids;
          roomMeta = m;
          packLoopTrack(roomPack.track);
        }
        alag = 0;
        if (roomMeta) roomMeta = Object.assign({}, roomMeta, { alag });
      }
      // One mixIn per sweep, after the packs exist. The early loop shipped passthrough only.
      function foldAlive(f) {
        try { const ctx = f && f.dest && f.dest.context; return !!(ctx && ctx.state !== 'closed'); } catch (e) { return false; }
      }
      function foldFor(foldKey, parts) {
        if (foldKey == null) return null;
        const ac = mixCtx();
        if (!ac || !MM || typeof MM.createAudioFold !== 'function') return null;
        let f = downFolds.get(foldKey);
        if (f && !foldAlive(f)) {
          try { f.clear(); } catch (e) {}
          downFolds.delete(foldKey);
          downStreams.delete(foldKey);
          if (foldKey === 'ear') downStreams.delete('earView');
          f = null;
        }
        if (!f) {
          f = MM.createAudioFold(ac);
          if (!f) return null;
          downFolds.set(foldKey, f);
        }
        foldSync(f, parts || new Map());
        const tr = f.track ? f.track() : null;
        return tr && tr.readyState !== 'ended' ? tr : null;
      }
      function foldsKeep(keep) {
        for (const [k, f] of [...downFolds]) {
          if (keep && keep.has(k)) continue;
          let tr = null;
          try { tr = f.track && f.track(); } catch (e) {}
          try { f.clear(); } catch (e) {}
          if (tr && MM && typeof MM.retireAudioTracks === 'function') {
            try { MM.retireAudioTracks([tr]); } catch (e) {}
          }
          downFolds.delete(k);
          downStreams.delete(k);
          if (k === 'ear') downStreams.delete('earView');
        }
      }
      function mixParts(e) {
        const parts = new Map();
        const list = e && e.audio && Array.isArray(e.audio.parts) ? e.audio.parts : [];
        for (let i = 0; i < list.length; i++) {
          const pair = list[i];
          if (!pair || pair[0] == null) continue;
          const st = partStream(pair[1]);
          if (st) parts.set(pair[0], st);
        }
        return parts;
      }
      if (c.pc === 0 && rowMixOpen()) rowMixVia(); // the 15s stamp, once; mixIn peeks and does not stamp
      const mixPlan = (0, /*()*/__C.mixIn)() || [];
      const keep = new Set();
      for (const e of mixPlan) {
        if (!e || !e.audio || !e.audio.mix) continue;
        foldFor(e.audio.mix, mixParts(e));
        keep.add(e.audio.mix);
      }
      foldsKeep(keep);
      const earF = downFolds.get('ear');
      const earTr = earF && earF.track ? earF.track() : null;
      // Paint memo is earView, not the fold key. sdm ships downStream('ear', picture, audio); the same key here would mint a new MediaStream every sweep.
      const earSt = earTr ? downStream('earView', null, earTr) : null;
      if ((iAmHead || actHead) && beyondRow) {
        const headView = actHead ? __C.mosIn.get('sdm') : null, headFlows = !!headView && !(mosFb.get('sdm') || {}).dark && !headView.deadAt; // a false alarm must not take the heir's own ears off its head's view
        if (headFlows) paintRoomView(headView.el, blockMeta(headView), headView.stream, c, (headView.meta && headView.meta.alag) || 0);
        else paintRoomView(roomEl, roomMeta, earSt, c, alag);
      }
      for (const e of mixPlan) {
        if (!e || !e.key || !e.to) continue; // the ear is folded and not shipped
        if (e.video && e.video.pack && !(packFor(e.video.pack, e.video.skip) || {}).track) continue;
        const jk = (0, /*()*/__C.shipJob)(e.key, e.to, streamFor(e), e.meta, e.upKey);
        if (!jk) continue;
        wanted.add(jk);
        if (e.key === 'ra') rowMixSent++;
      }
      // ---- STAGE lane: chosen <=C feeds -> S1 -> composited strip -> fan down --
      // Individual stager feeds ride UP to Section 1 (uncomposited passthrough,
      // per-stager key); at S1 they FLOOD the row+cross mesh (dedup by streamId,
      // exactly like mesh gossip) so every S1 seat holds every stager; each S1
      // seat composites the strip itself and fans it down the SAME tree as 'sd'.
      if (c.pc !== 0 && stripPack) { stripPack.stop(); stripPack = null; } // role-change hygiene: left Section 1
      if (c.pc !== 0) {
        // relay every stage feed I hold (and my own) UP toward Section 1. E2 is the
        // second path; the S1 flood dedups by streamId, so it never double-composites.
        const upTgt = iAmHead ? (T.up(c) ? (0, /*()*/__C.occPid)(T.up(c)) : null) : (0, /*()*/__C.occPid)({ pc: c.pc, r: c.r, i: 0 });
        const seatE2 = (0, /*()*/__C.meshSeat)();
        const e2Up = seatE2 ? [seatE2.u2Id, seatE2.u3Id, seatE2.l14Up].filter(Boolean) : []; // L2.3, L2.6: I am my row's E2 source; L14: my branch's uplink
        const e2Fan = (seatE2 && (seatE2.u2Id || (seatE2.l14Up && !iAmHead))) ? T.rowMates(c).map((m) => (0, /*()*/__C.occPid)(m)).filter((t) => t && t !== __C.myId) : []; // L14: a mate holds an uplink only as the first live mate of a headless row
        const e2Kids = seatE2 ? seatE2.u2Heirs().concat(seatE2.l14Served()) : []; // the rows I back up (E2), the heads whose uplink I took (L14)
        // Same owner rule as the S1 flood: a stager already HAS its own face —
        // shipping it back is waste at best, and (before the mosResolve guard)
        // the echo that thrashed the whole lane.
        // ao: the held copy is an audio-only down copy (stgDownMeta). It came
        // from above and has no face, so it goes down only; up or across it
        // would become a Section 1 standby that fails over to no picture.
        const relayStg = (key, stream, via, h, ao, vp) => {
          const owner = key.indexOf('stg:') === 0 ? key.slice(4).split('^')[0] : null;
          const skip = (t) => !t || t === via || (owner && t === owner);
          const hm = vp ? { h, vp } : { h }; // hop count from the producer — claims prefer min-h (see prefCand); vp: the seats this copy came through
          if (!ao && upTgt && !skip(upTgt)) { const jk = (0, /*()*/__C.shipJob)(key, upTgt, stream, hm, key); if (jk) wanted.add(jk); }
          // E2: one more target each way. Same key; the far end keeps it parked (one-pipe law).
          if (!ao) for (const t of e2Up) if (!skip(t) && t !== upTgt) { const jk = (0, /*()*/__C.shipJob)(key, t, stream, hm, key); if (jk) wanted.add(jk); }
          for (const t of e2Kids.concat(e2Fan)) {
            if (!t || (owner && t === owner) || (!ao && t === upTgt)) continue;
            const dnSt = stgDownShip(key, stream, !!(owner && (0, /*()*/__C.sharingScreen)(owner)), stgAudioMemo);
            if (dnSt) { const jk = (0, /*()*/__C.shipJob)(key, t, dnSt, stgDownMeta(hm, dnSt, stream), key); if (jk) wanted.add(jk); }
          }
          // and DOWN: the strip is video-only — the per-stager feeds must
          // reach EVERY subtree so Stage audio can fold at each ear.
          const dnP = (0, /*()*/__C.occPid)(T.down(c));
          if (dnP && !skip(dnP) && dnP !== upTgt) {
            const dnSt = stgDownShip(key, stream, !!(owner && (0, /*()*/__C.sharingScreen)(owner)), stgAudioMemo);
            if (dnSt) { const jk = (0, /*()*/__C.shipJob)(key, dnP, dnSt, stgDownMeta(hm, dnSt, stream), key); if (jk) wanted.add(jk); }
          }
        };
        if (amStager) { const st = mySelfStream(); if (st) relayStg('stg:' + __C.myId, st, null, 0); }
        // E2 up holds a stager's full feed: a stager gives its row's source a parked copy,
        // and a source that hears the voice-only copy climbs with that parked one.
        if (amStager && seatE2 && !seatE2.u2Id) {
          const src2 = seatE2.e2Src(), st = mySelfStream();
          if (st && src2 && src2 !== __C.myId) { const jk = (0, /*()*/__C.shipJob)('stg:' + __C.myId, src2, st, { h: 0, sb: 1 }, 'stg:' + __C.myId); if (jk) wanted.add(jk); }
        }
      } else {
        // SECTION 1 (W7 rook): flood each stage feed across the FULL row+column
        // fabric ONCE per streamId — 8 independent neighbours, heads included,
        // so any single dead S1 seat cannot starve the spread. Receivers keep
        // ONE hot pipe + a parked standby + dormant spares (ONE-PIPE
        // multi-subscribe), so the extra announces cost nothing until demanded.
        const s1peers = [...T.rowMates(c), ...T.colMates(c)].map((m) => (0, /*()*/__C.occPid)(m)).filter(Boolean);
        { const sb = (0, /*()*/__C.meshSeat)(); for (const t of (sb && sb.s1Bridges ? sb.s1Bridges() : [])) if (s1peers.indexOf(t) < 0) s1peers.push(t); }   // L2.15: an empty Section-1 cell's bridge carries the flood around a silent corner (parked at the receiver by the one-pipe law, as E2)
        for (const t of (0, /*()*/__C.pipePeers)()) if (s1peers.indexOf(t) < 0) s1peers.push(t);   // SUB.4: every stager's own feed crosses my pipes, both ways (split horizon in floodOne)
        const flooded = new Set(); // PER-SWEEP dedup (one feed may resolve via two keys). The old
        // persistent stgSpread let the sweep-end reaper kill flood jobs after one sweep.
        // NEVER FLOOD A FEED BACK TO ITS OWNER. The owner already has the
        // original, and re-shipping its own face to it is what thrashed the
        // whole lane (see mosResolve).
        // The SENDER is deliberately NOT skipped: when a mate re-floods to the
        // peer that handed it over, that is a second ANNOUNCER for the slot —
        // the parked standby the ONE-PIPE law wants, not a wasted copy.
        // Skipping it silently deleted the stage lane's redundancy, and
        // redun-drill caught it as "no receiver holding a relayed stg primary
        // + standby".
        // upKey: the slot a second-root copy is fed from (its parked standby); such a copy skips the seats on its path.
        // A second-root copy is visited with no stream too, so a copy a receiver plays is kept (stgRootHold).
        const floodOne = (key, stream, via, h, vp, upKey) => {
          if (stream) { if (flooded.has(stream.id)) return; flooded.add(stream.id); } else if (!upKey) return;
          const owner = key.indexOf('stg:') === 0 ? key.slice(4).split('^')[0] : null;
          const pipesNow = (0, /*()*/__C.pipePeers)();   // SUB.4: a feed from a pipe's side never goes back over that pipe (below)
          const skip = (t) => !t || (owner && t === owner) || (!!upKey && !!vp && vp.indexOf((0, /*()*/__C.vpId)(t)) >= 0);
          const up = upKey || key;
          const hm = vp ? { h, vp } : { h }; // hop count from the producer — claims prefer min-h (see prefCand); vp: the seats this copy came through
          // What goes to t: a played second-root copy's own source, else this stream.
          const pick = (t) => {
            const held = upKey && t ? stgRootHold(key + '>' + t, upKey, t) : null;
            if (held) return { st: held.stream, m: { h: (0, /*()*/__C.stgHop)(held), vp: (0, /*()*/__C.stgPath)(held) } };
            return stream && !skip(t) ? { st: stream, m: hm } : null;
          };
          // My OWN feed: two neighbours watch it directly, the rest get an
          // sb:1 copy they keep parked (STG-DIRECT).
          const direct = owner === __C.myId ? (0, /*()*/__C.stgDirectSet)(T.rowMates(c).map((m) => (0, /*()*/__C.occPid)(m)), T.colMates(c).map((m) => (0, /*()*/__C.occPid)(m)),
            (t) => { const q = __C.peers.get(t); return !!(q && q.pc && q.connected); }) : null;
          const hmSb = { h, sb: 1 };
          // SUB.4.1: a free pipe hears the Stage inside its one mix (the pipes loop above), so no stage feed is shipped to it
          for (const t of s1peers) { if (owner && pipesNow.indexOf(t) >= 0 && (__C.pipeStg.get(owner) === t || __C.mosAnn.has(t + '|' + key) || !(0, /*()*/__C.pipeVideo)(t))) continue; if (owner !== __C.myId && relayHeldForTest(key, t)) continue; if (oneRootSkipForTest(owner, t, s1peers)) continue; const s = pick(t); if (!s) continue; const jk = (0, /*()*/__C.shipJob)(key, t, s.st, (direct && !direct.has(t)) ? hmSb : s.m, up); if (jk) wanted.add(jk); }
          const dnP = (0, /*()*/__C.occPid)(T.down(c)); // and DOWN — Stage audio folds at every ear
          const sd = pick(dnP);
          if (sd) {
            const dnSt = stgDownShip(key, sd.st, !!(owner && (0, /*()*/__C.sharingScreen)(owner)), stgAudioMemo);
            if (dnSt) { const jk = (0, /*()*/__C.shipJob)(key, dnP, dnSt, stgDownMeta(sd.m, dnSt, sd.st), up); if (jk) wanted.add(jk); }
          }
          // E2: the rows I back up hold a parked copy.
          for (const t of ((0, /*()*/__C.meshSeat)() ? (0, /*()*/__C.meshSeat)().u2Heirs().concat((0, /*()*/__C.meshSeat)().l14Served()) : [])) {
            const s = pick(t); if (!s) continue;
            const dnSt = stgDownShip(key, s.st, !!(owner && (0, /*()*/__C.sharingScreen)(owner)), stgAudioMemo);
            if (dnSt) { const jk = (0, /*()*/__C.shipJob)(key, t, dnSt, stgDownMeta(s.m, dnSt, s.st), up); if (jk) wanted.add(jk); }
          }
        };
        if (amStager) { const st = mySelfStream(); if (st) floodOne('stg:' + __C.myId, st, null, 0); }
        // composite the strip in stage order; fan 'sgs' down my subtree
        const selfSt = soloSelf ? selfStageStream() : null;
        if (!stagers.length) { paintStageStrip(null); }
        else if (soloSelf && !__C.peers.size) {
          // NOBODY TO SHIP IT TO, AND NOBODY BUT ME ON IT. The strip has no
          // consumer at all: no peer to fan it down to, and I must not watch
          // myself through it — so building one composites, captureStreams and
          // paints the room's broadcast for an audience of nobody (measured in
          // a room of one: mosaic().jobs === []). peers.size is the honest
          // receiver test — a strip can only leave this device over a peer
          // connection — and unlike an occ lookup it cannot flicker with
          // gossip. The sweep rebuilds within 2s of anyone arriving.
          if (stripPack) { stripPack.stop(); stripPack = null; }
          paintStageStrip(selfSt);
        }
        else {
        if (!stripPack) stripPack = MM.createPacker({ shape: 'bar', fps: __C.STAGE_FPS, cell: (0, /*()*/__C.stageCell)(), maxW: __C.STAGE_MAXW, native: true }).start(); // VIDEO-ONLY: Stage audio folds at the ear (mix-minus). NOT the secondary-tile defaults — see "THE STAGE IS NOT A SECONDARY TILE"
        // The power level moves under a long-lived strip; track it without a
        // teardown (a rebuild would mint a new stream id and re-ship to
        // everyone). Both dials, every sweep — setCell/setFps no-op unchanged.
        stripPack.setCell((0, /*()*/__C.stageCell)()); stripPack.setFps((0, /*()*/__C.stageFps)());
        const stgKeep = new Set();
        // MODERATION REACHES THE STRIP. This seat's pixels are what every seat
        // below sees, so the room's moderation table is applied here, the same
        // on every Section 1 seat: an admin's video-off paints the cell dark
        // (name kept, place kept), and a moderator's blur is baked into the
        // cell, a shared screen included: the share bit is the sender's own
        // claim, so it cannot lift the hammer (a sender that claims a share
        // while sending its camera stays blurred). The grid tile blurs a
        // blocked sharer the same way. My own cell already carries my blur.
        stagers.forEach((sid, j) => {
          const sc = srcFor(sid, 'stg:' + sid);
          // Camera off (the core's card rule: no picture, not sharing): the cell stays, empty; each viewer draws the card.
          let card = false;
          try { card = sid === __C.myId ? (0, /*()*/__C.mainVideoChoice)().src === 'card' : (!!(0, /*()*/__C.rowFaceDark)(__C.statusOf.get(sid)) && !(0, /*()*/__C.sharingScreen)(sid)); } catch (e) { card = false; }
          if ((sc && sc.el) || card) {
            const dark = ((0, /*()*/__C.forcedCamOff)(sid) || (typeof __C.shareBlocked === 'function' && (0, /*()*/__C.shareBlocked)(sid))) ? 1 : 0;
            const blur = (!dark && sid !== __C.myId && (0, /*()*/__C.modBlurOn)(sid)) ? Math.max(1, (0, /*()*/__C.blurLevelFor)(sid)) : 0;
            // The Stage strip carries no names (no pack does): every viewer draws them over its own Stage picture
            // (viewKit.stageNames), sharp over a blurred picture, hidden by a viewer's Show names off, faded on a calm
            // screen. The talking frame, a raised hand and a reaction stay in the picture.
            const lb = (0, /*()*/__C.labelFor)(sid);
            stripPack.setTile(sid, j, sc && sc.el ? sc.el : null, sc ? sc.stream : null, { n: 1, cols: 1, lbl: lb, fit: (0, /*()*/__C.fitFor)(sid), dark, blur, card, talkPid: sid, pid: sid });
            stgKeep.add(sid);
          }
        });
        for (const id of stripPack.ids()) if (!stgKeep.has(id)) stripPack.delTile(id);
        const stripIds = stagers.filter((sid) => stgKeep.has(sid)); // the cell order, as packed (ord = stage index)
        const scrSt = selfSt ? null : (myScreenBeside() || stageDirect());
        const s1Faces = scrSt ? stageFaceSet(stageScreenSid(), stagers, null) : null;
        stageViewNow = selfSt ? 'self' : (s1Faces ? 'screen' : 'strip');
        paintStageStrip(selfSt || (s1Faces ? scrSt : null) || stripPack.stream);
        paintStageFaces(s1Faces);
        // Fan the strip DOWN only: every S1 seat composites its OWN strip from
        // the flooded stg feeds, so sideways sgs ships between S1 seats were
        // dead weight (receivers own stripPack and never paint them) — gone.
        const jgs = (0, /*()*/__C.shipJob)('sgs', (0, /*()*/__C.occPid)(T.down(c)), stripPack.stream, { n: stripPack.count(), cols: stripPack.cols(), ids: stripIds }); if (jgs) wanted.add(jgs);
        for (const t of ((0, /*()*/__C.meshSeat)() ? (0, /*()*/__C.meshSeat)().u2Heirs().concat((0, /*()*/__C.meshSeat)().l14Served()) : [])) { const j2 = (0, /*()*/__C.shipJob)('sgs', t, stripPack.stream, { n: stripPack.count(), cols: stripPack.cols(), ids: stripIds }); if (j2) wanted.add(j2); } // E2
        }
      }
      // Every seat: render the received strip and fan it down (heads -> row-mates).
      const sgs = __C.mosIn.get('sgs');
      if (sgs && c.pc !== 0 && stagers.length) {
        // Relay it regardless (my subtree needs it) — but if the only face in
        // it is mine, look at the local track instead of at my own pixels
        // after a round trip up to Section 1 and back down.
        // A shared screen is shown only with every co-presenter on it; the
        // faces are cut out of this very strip (stageFaceSet), else the strip.
        const deepSelf = soloSelf && selfStageStream();
        const scrSt = deepSelf ? null : (myScreenBeside() || stageDirect());
        const deepFaces = scrSt ? stageFaceSet(stageScreenSid(), stagers, sgs) : null;
        stageViewNow = deepSelf ? 'self' : (deepFaces ? 'screen' : 'strip');
        paintStageStrip((soloSelf && selfStageStream()) || (deepFaces ? scrSt : null) || sgs.stream);
        paintStageFaces(deepFaces);
      } else if (c.pc !== 0 && stagers.length === 0) {
        // THE STAGE IS MEMBERSHIP, NOT A PIPE. A deep seat used to paint (and
        // re-fan) the composited strip for as long as its inbound 'sgs' pipe
        // lived — gated only on the PIPE, so after a step-down the last strip
        // frames kept a live tile up for 20s+ on whichever seat's pipe
        // drained slowest (e2e-mosaic "step-down clears the strip everywhere"
        // 5/6-cleared, gate red 2026-08-05 — forensics: ids=[] with a
        // readyState-4 sgs video still playing). Membership empty ⇒ clear NOW
        // and stop re-fanning, exactly as the S1 branch above already does;
        // the pipe then dies quietly on its own. The S1 seats' own clear is
        // untouched (they composite locally and clear on membership).
        paintStageStrip(null);
      }

      // Non-heads: my head's finished row view ('sdm') IS my Stadium — it
      // already excludes my row. Per-branch mixes are single-producer by
      // construction (a neighbour's mix would contain MY row), so the old
      // verbatim re-fan of the shared 'sd' is gone with the shared 'sd'.
      // Non-heads: my head's room pack ('sdm') is my Stadium, less my row (hidden here, by the ids it carries).
      if (!iAmHead && !actHead) { const sdm = __C.mosIn.get('sdm'); paintRoomView(sdm ? sdm.el : null, sdm ? blockMeta(sdm) : null, sdm ? sdm.stream : null, c, sdm && sdm.meta ? (sdm.meta.alag || 0) : 0); }
      // STAGE EAR: sum the per-stager feeds I hold, skipping my own.
      if (stagers.length) ensureStageEar();
      syncStageEar(stagers);
      earNote(stagers);
      // DEBOUNCED UNSHIP: the wanted set is rebuilt from occ every sweep, and
      // occ flickers during gossip churn (a seat transiently unknown, a heal in
      // flight). Ripping a live pipe on ONE missed sweep sends mx-end + a
      // renegotiation — a visible outage on that branch — and then rebuilds the
      // same pipe two seconds later. A job must stay unwanted for MOS_GRACE
      // before it is really unshipped. (A job to a DEPARTED peer drops at once;
      // dropPeer already cleaned the far side.)
      // MY OWN MOVE IS NO FLICKER. A Stadium-lane job carries what my cell
      // makes (my row's product, a view, a mix, a relay of my head's), and
      // those streams keep their objects when I move: a deep head that moves
      // up to a Section 1 head cell keeps one product pack, which now packs its
      // NEW row. Its old 'sub' up-ship, kept for the grace, carried that row's
      // own voices to its old up seat, which mixed them into the row view it
      // made as heir: the row heard itself on row and Stadium at once for the
      // whole grace. A job last wanted from another cell of mine is unshipped
      // at once. Stage copies carry their stager whatever my cell, so they keep
      // the grace.
      (0, /*()*/__C.reapJobs)(wanted);
      if (__C.DEBUG_ON && __C.clog) {
        const mk = Array.from(__C.mosJobs.keys()).sort().join(' ');
        if (mk !== reconcileMosaic.lastKeys) { reconcileMosaic.lastKeys = mk; (0, /*()*/__C.clog)('mos-keys ' + mk); }
        // Live packer tiles (ord=id, sorted by id; a null ord is "=id") and the product jobs this sweep still holds.
        // Product jobs are sub, x1, x2, sdrow:*, and an sdn whose tracks are an l14 packer's (a mix sdn is not).
        const tileTok = (pk) => {
          const rows = pk && pk.tilesForTest ? pk.tilesForTest().slice() : [];
          rows.sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
          return rows.map((t) => (t.ord == null ? '' : t.ord) + '=' + t.id).join(',');
        };
        const pkParts = [];
        if (prodPack) pkParts.push('prod:' + tileTok(prodPack));
        if (roomPack) pkParts.push('room:' + tileTok(roomPack));
        for (const h of [...pipePacks.keys()].sort()) pkParts.push('pipe:' + h + ':' + tileTok(pipePacks.get(h)));
        for (const h of [...l14Packs.keys()].sort()) pkParts.push('l14:' + h + ':' + tileTok(l14Packs.get(h)));
        const l14Tr = new Set();
        for (const pk of l14Packs.values()) {
          if (!pk) continue;
          if (pk.track) l14Tr.add(pk.track);
          const trs = pk.stream && pk.stream.getTracks ? pk.stream.getTracks() : [];
          for (let ti = 0; ti < trs.length; ti++) l14Tr.add(trs[ti]);
        }
        const prodJobs = [];
        for (const [jk, job] of __C.mosJobs) {
          const k = job && job.key;
          if (k === 'sub' || k === 'x1' || k === 'x2' || (k && k.indexOf('sdrow:') === 0)) prodJobs.push(jk);
          else if (k === 'sdn' && job.srcTracks && job.srcTracks.some((t) => l14Tr.has(t))) prodJobs.push(jk);
        }
        prodJobs.sort();
        const psig = pkParts.join('|') + ' ' + prodJobs.join(' ');
        if (psig !== reconcileMosaic.lastPackKeys) { reconcileMosaic.lastPackKeys = psig; (0, /*()*/__C.clog)('pack-keys ' + psig); }
      }   // DEBUG: job keys and packer tiles on each change (pre/post flip room diff)
      // ---- DEMAND GATE: a composite nobody ships and nobody looks at ---------
      // createPacker has carried setActive since the day it was written ("a
      // composite that has no consumer (not shipped, not displayed) isn't
      // painted (static canvas ⇒ ~0 encode too)") and NOTHING has ever called
      // it. The gap is real work, not theory: prodPack is built the moment a
      // seat is a head, and a seat alone on Stage IS a head — with an empty
      // row, no up-link ship and no stadium tile, painting and capturing for
      // nobody. Same for a strip kept for a subtree that has gone.
      //
      // Consumers are READ from the two authorities, never guessed: mosJobs
      // (every ship is born there, and a PARKED standby counts — its whole job
      // is to be able to wake with live pixels) and compOf (every painted
      // composite registers there, which is also what the recorder reads). Both
      // are recomputed each sweep, so a pack wakes on the sweep its first
      // consumer appears — and setActive(false) only skips PAINT: the canvas
      // keeps its last frame and captureStream emits nothing, so the worst a
      // late wake costs is one frame, never a black tile.
      const shippedTracks = new Set();
      for (const job of __C.mosJobs.values()) { if (job.rest) continue; for (const t of job.srcTracks) shippedTracks.add(t); }   // a copy its receiver asked to rest (it ends there unused) takes nothing; a parked standby still counts: it must wake with live pixels
      const paintedSids = new Set(); for (const cv of compOf.values()) if (cv.streamId) paintedSids.add(cv.streamId);
      const gatePack = (pk) => {
        if (!pk || !pk.setActive) return;
        pk.setActive(!!(pk.track && shippedTracks.has(pk.track)) || !!(pk.stream && paintedSids.has(pk.stream.id)));
      };
      if (sdView && sdView.setActive) sdView.setActive(!!(sdViewSt && paintedSids.has(sdViewSt.id)));   // my Stadium paints while it is on screen
      gatePack(stripPack);
      // The room pack paints while anyone takes it: a ship of its own track or of its encode-once copy, or my own view.
      if (roomPack && roomPack.setActive) roomPack.setActive(!!(roomPack.track && shippedTracks.has(roomPack.track)) || !!(packLoop && packLoop.rx && shippedTracks.has(packLoop.rx)) || !!(sdView && sdView.stats().active && roomPack.canvas && sdViewSrc === roomPack.canvas));
      gatePack(prodPack);
      for (const pk of l14Packs.values()) gatePack(pk);
      for (const pk of pipePacks.values()) gatePack(pk);
    }
    yield 2379;

    // ---- SCREEN SHARING (docs/media-plane.md Channel St; roadmap §4g) ---------
    //
    // WHAT THIS IS NOT: it is not how you share an APP. GifOS can PIN an app
    // into a meeting — everyone runs the same app locally off a small shared
    // data stream and stays in sync (docs/app-mesh.md, "Run app"), which is
    // crisp, interactive, readable on a phone, and costs the room a data
    // stream instead of a video one. A screen share is a VIDEO OF SOMEONE
    // ELSE'S WINDOW: one-way, one resolution, unclickable, and priced in
    // pixels at every hop. Where the two overlap the app pin wins, so the
    // share sheet below always names it, an app-pinned room does not offer
    // this control at all (the CSS beside #appbtn), and a room that already
    // has an app running says so before anything is captured. Screen share is
    // for what an app cannot be: a deck on your disk, a third-party tool, a
    // window from outside GifOS.
    //
    // WHERE IT RIDES: nowhere new. Sharing swaps sentVideoTrack()'s answer from
    // the camera to the display capture and steps onto the Stage — the existing
    // chosen-≤C broadcast tier, which is exactly "the thing the whole room is
    // looking at". Collect up the tree to Section 1, composite, fan down: the
    // Stage path, unchanged, including its E2 redundancy and its
    // one-pipe/parked-standby law. The only screen-specific bit anywhere is the
    // gossiped `scr` bit telling the strip compositor to letterbox the cell
    // instead of cropping it square (mesh-media fitBox).
    //
    // WHY THIS PAGE MAY SIMPLY ASK. Meeting and Broadcast are SYSTEM apps, and
    // a system app is not a sandboxed App GIF: `runtime.js` boot() sees
    // `manifest.system` in its SYSTEM_PAGES whitelist and does
    // `location.replace('run.html')` — a real navigation to a first-party page
    // on the GifOS origin — instead of mounting anything in an iframe. Its own
    // comment says why: "System apps run as trusted first-party pages, not in
    // the sandbox — live media (camera/mic + WebRTC) is impossible from an
    // opaque origin." So this page has a real origin and the ordinary web
    // platform, and it already calls getUserMedia directly for camera and mic
    // and getDisplayMedia directly for the local recorder. The gate on a screen
    // share here is the BROWSER's — its own picker, its own gesture
    // requirement, its own stop bar — plus the room's rules below (in an admin
    // room, mayShareScreen; an admin video-off ends it) and the same rule on
    // every receiver, which will not show a share the sender was not allowed
    // to start. There is no capability to declare, and the App-GIF
    // capability model (capabilities.pointer / .fullscreen) is the wrong shape
    // here: it exists to hand narrow powers to UNTRUSTED code in a sandbox.
    // (It also could not deliver this one — see runtime.js on why a
    // capabilities.screen cannot be built at all.)
    //
    // NO SYSTEM AUDIO, DELIBERATELY, FOR NOW: getDisplayMedia can capture tab
    // audio, but the outbound audio track is the mic — mySelfStream and every
    // mainA sender read localStream's audio track directly — so carrying it
    // would mean a WebAudio fold in front of all of them plus a mute button
    // that mutes the mic and not the tab. That is a real feature and a real
    // refactor; asking for `audio: true` and then dropping it would put a
    // "share tab audio" checkbox in the picker that does nothing, which is
    // worse than not offering it. So: `audio: false`, and the sheet says so.
    const canScreenShare = () => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    yield 2383;
    // A freeze reloads the tab. The note written here lets the next boot know the
    // person had joined and whether a screen share was up (one tap to share again).
    // It carries NO mic or camera state: a reload of any kind comes back camera off
    // and mic muted, stagers too (Nathan 2026-11-08: privacy first, always).
    let shareRecoverMode = false;
    let recoverShareTimer = 0;
    yield 2387;
    const RECOVER_MEDIA_TTL = GifOS.timings.RECOVER_MEDIA_TTL;
    function stashRecoverMedia(away) {
      // Only a person past the door leaves a note, whichever way out of the page wrote it. The note says
      // "this tab had joined" and whether a screen share was up. It never names the mic or the camera: a
      // reload of any kind comes back camera off and mic muted (Nathan 2026-11-08, privacy first, stagers too).
      if (__C.pwBlocked || __C.bannedOut || !(__C.mediaJoined || (0, /*()*/__C.onStageNow)())) {
        try { sessionStorage.removeItem(__C.RECOVER_MEDIA_KEY); } catch (e) {}
        return;
      }
      try {
        sessionStorage.setItem(__C.RECOVER_MEDIA_KEY, JSON.stringify({
          v: 2, // a v1 note (older build) carried the devices; the v2 reader does not take it
          // A share does not ride a discard: coming back must not re-ask for
          // the screen. A freeze or update reload (away false) still does.
          sharing: !away && !!(__C.myStatus && __C.myStatus.scr),
          at: Date.now(),
          away: !!away,
          room: typeof __C.updateRoomKey === 'function' ? (0, /*()*/__C.updateRoomKey)() : '',
        }));
      } catch (e) {}
    }
    // Chrome can discard a phone tab in the background and load it again on
    // the return. freeze fires before the discard; sessionStorage survives.
    // Write the same note a freeze reload writes (joined, share), so the page
    // that comes back knows it was past the door. It brings no device back:
    // camera off and mic muted after a discard too. Drop it only when THIS
    // page comes back on its own. A fresh load has no stream yet and must
    // keep the note for boot.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (typeof __C.localStream !== 'undefined' && __C.localStream && !__C.leaving) stashRecoverMedia(true);
        return;
      }
      if (typeof __C.localStream === 'undefined' || !__C.localStream) return;
      try {
        const raw = sessionStorage.getItem(__C.RECOVER_MEDIA_KEY);
        if (raw && JSON.parse(raw).away === true) sessionStorage.removeItem(__C.RECOVER_MEDIA_KEY);
      } catch (e) {}
    });
    document.addEventListener('freeze', () => {
      if (typeof __C.localStream !== 'undefined' && __C.localStream && !__C.leaving) stashRecoverMedia(true);
    });
    yield 2394;
    // peek: read the note without taking it.
    function takeRecoverMedia(peek) {
      let raw = null;
      try {
        raw = sessionStorage.getItem(__C.RECOVER_MEDIA_KEY);
        if (!peek) sessionStorage.removeItem(__C.RECOVER_MEDIA_KEY);
      } catch (e) { return null; }
      if (!raw) return null;
      let o = null;
      try { o = JSON.parse(raw); } catch (e) { return null; }
      if (!o || o.v !== 2 || typeof o.at !== 'number') return null;
      if (Date.now() - o.at > RECOVER_MEDIA_TTL) return null;
      // An empty room is only an older build's freeze or update note, in the reload that replaces it.
      if ((o.away || o.room) && typeof __C.updateRoomKey === 'function' && o.room !== (0, /*()*/__C.updateRoomKey)()) return null;
      return o;
    }
    // A door ends the membership: the old 'on' belonged to the seat just lost. Quiet now, nothing left to
    // restore, and on again only by a tap. Runs for a page that came back on its note and then found the door shut.
    function quietAtDoor() {
      __C.mediaJoined = false;
      try { sessionStorage.removeItem(__C.RECOVER_MEDIA_KEY); } catch (e) {}
      if (!__C.localStream) return;
      for (const tr of __C.localStream.getTracks()) tr.enabled = false;
      __C.myStatus.muted = true;
      __C.myStatus.camOff = true;
      micLetGo();
      try { (0, /*()*/__V.paintControls)(); (0, /*()*/__C.paintOnAir)(); refreshOutbound(); (0, /*()*/__C.broadcastStatus)(); syncSpeech(); (0, /*()*/__C.updateMediaSession)(); } catch (e) {}
    }
    yield 2398;
    function recoverScreenShare() {
      if (typeof __C.mayShareScreen === 'function' && !(0, /*()*/__C.mayShareScreen)(__C.myId)) return;
      if (typeof __C.forcedCamOff === 'function' && (0, /*()*/__C.forcedCamOff)('me')) return;
      shareRecoverMode = true;
      if (typeof canScreenShare === 'function' && !canScreenShare()) { (0, /*()*/__V.showResharePrompt)(); return; }
      if (recoverShareTimer) clearTimeout(recoverShareTimer);
      // If the browser never answers the capture ask, the prompt still appears.
      recoverShareTimer = setTimeout(() => {
        recoverShareTimer = 0;
        if (shareRecoverMode && !(__C.myStatus && __C.myStatus.scr)) (0, /*()*/__V.showResharePrompt)();
      }, 1200);
      startScreenShare();
    }
    function applyRecoverMedia() {
      const o = takeRecoverMedia();
      if (!o) return false;
      __C.mediaJoined = true; // the page that wrote it had joined; the door still has its say (quietAtDoor)
      // Mic and camera stay as the quiet boot left them: off. Only a tap (the chooser) turns them on.
      try { (0, /*()*/__V.paintControls)(); } catch (e) {}
      if (o.sharing) { try { recoverScreenShare(); } catch (e) {} }
      return true;
    }
    function startScreenShare() {
      if (__C.myStatus.scr) return;
      if (typeof __C.avWhy === 'function') (0, /*()*/__C.avWhy)('tap');
      // No browser NAMES here (browser support is data — site/browser-support.json
       // — and a name in a string rots the same way a version number does). This
      // line is nearly unreachable anyway: paintShare hides the control where
      // the API is absent. A scripted call returns without a status line.
      if (!canScreenShare()) return;
      if ((0, /*()*/__C.forcedCamOff)('me')) { (0, /*()*/__C.sayState)('shareVideoOff'); return; }
      // Already being on stage does not waive this. The stage grant and the
      // screen grant are different orders.
      if (!(0, /*()*/__C.mayShareScreen)(__C.myId)) { (0, /*()*/__C.sayState)('shareNotAllowed'); return; }
      if (!__C.myStatus.stg && (0, /*()*/__C.stageIds)().length >= __C.SCALE.C) { (0, /*()*/__C.sayState)('stageFull', { n: __C.SCALE.C }); return; }
      (0, /*()*/__C.sayState)(shareRecoverMode ? 'shareBack' : 'shareChoose');
      navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false })
        .then((s) => {
          const vt = s.getVideoTracks()[0];
          if (!vt) { try { s.getTracks().forEach((t) => t.stop()); } catch (e) {} shareRecoverMode = false; return; }
          // The grant can be revoked while the browser's picker is open.
          if (!(0, /*()*/__C.mayShareScreen)('me') || (0, /*()*/__C.forcedCamOff)('me')) {
            try { s.getTracks().forEach((t) => t.stop()); } catch (e) {}
            shareRecoverMode = false;
            (0, /*()*/__C.sayState)('shareTurnedOff');
            return;
          }
          // TELL THE ENCODER IT IS LOOKING AT TEXT. Without a contentHint a
          // track is encoded under the default 'balanced' degradation, which
          // buys frame rate by throwing RESOLUTION away — the one thing a
          // shared screen cannot spare. A 1080p desktop under a face-sized
          // budget was arriving scaled to roughly 640x360, which is legible as
          // a picture of a window and useless as a document. 'text' asks for
          // the opposite trade (hold the pixels, drop frames), and it also
          // switches the codec into its screen-content path, where an
          // unchanged region costs almost nothing. The frame rate we asked for
          // is 15 and a slide does not move, so there is nothing to lose.
          try { vt.contentHint = 'text'; } catch (e) {}
          shareRecoverMode = false;
          if (typeof __V.hideResharePrompt === 'function') (0, /*()*/__V.hideResharePrompt)();
          __C.screenStream = s;
          __C.myStatus.scr = Date.now();
          // THE BROWSER'S OWN "Stop sharing" BAR IS THE MOST-USED STOP BUTTON
          // and it does not tell the page anything except this event. Without
          // it the room keeps a frozen last frame of a share that ended, the
          // sharer's camera never comes back, and the only cure is a reload.
          vt.onended = () => stopScreenShare((0, /*()*/__C.uiText)('shareEndedByBrowser', 'the browser ended the share'));
          // A share is a broadcast, so it takes a Stage seat — the tier whose
          // whole job is "what the room is looking at". Someone already up
          // there keeps their seat and simply changes what they broadcast.
          // scr is already set, so setStage's broadcast carries the share.
          // A second broadcast and a second tile pass painted the room twice.
          // A share from the Row marks its Stage seat sso: the person stays in the Row.
          if (!__C.myStatus.stg) { __C.screenSteppedUp = true; __C.myStatus.sso = 1; (0, /*()*/__C.setStage)(true); } else { __C.screenSteppedUp = false; delete __C.myStatus.sso; }
          (0, /*()*/__V.paintShare)(); (0, /*()*/__V.paintControls)();
          refreshOutbound();   // republish: self-view, row-mates, the stg: feed
          showLocalScreen();   // the slide, now — the mosaic sweep can be seconds later
          if (!__C.screenSteppedUp) (0, /*()*/__C.broadcastStatus)(); // setStage already told the room
          (0, /*()*/__C.refreshAllTiles)();
          // The More sheet is how the share started. Leaving it up paints a
          // grid over the slide the room is looking at. Fold it without
          // rewriting the saved preference — Stop sharing is on the slide,
          // and the thumbnail chip is the other way out.
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
          (0, /*()*/__C.sayState)('sharing');
        })
        .catch((err) => {
          if (shareRecoverMode) {
            if (typeof __V.showResharePrompt === 'function') (0, /*()*/__V.showResharePrompt)();
            else shareRecoverMode = false;
            return;
          }
          const denied = err && (err.name === 'NotAllowedError' || err.name === 'AbortError');
          if (denied) (0, /*()*/__C.sayState)('shareCancelled');
          else (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('shareFailed', 'Couldn’t share the screen ({err}).').replace('{err}', (err && err.name) || 'error'));
        });
    }
    function stopScreenShare(why) {
      if (!__C.screenStream && !__C.myStatus.scr) return;
      if (typeof __C.avWhy === 'function') (0, /*()*/__C.avWhy)('share ended' + (why ? ': ' + String(why).slice(0, 60) : ''));
      const s = __C.screenStream;
      __C.screenStream = null;
      __C.myStatus.scr = 0;
      if (s) for (const t of s.getTracks()) { try { t.onended = null; t.stop(); } catch (e) {} }
      // Step back down only if THIS share is what brought me up. Someone who
      // was already on stage stays on stage, now showing their camera again.
      const steppedDown = !!__C.screenSteppedUp;
      delete __C.myStatus.sso;
      withScrPipe(stopBlurPipe);
      if (__C.screenSteppedUp) { __C.screenSteppedUp = false; (0, /*()*/__C.setStage)(false); }
      (0, /*()*/__V.paintShare)(); (0, /*()*/__V.paintControls)();
      refreshOutbound();   // the camera (or nothing) becomes the source again
      if (!steppedDown) (0, /*()*/__C.broadcastStatus)(); // setStage already told the room
      (0, /*()*/__C.refreshAllTiles)();
      if (!(0, /*()*/__C.screenSharers)().length) paintStageStrip(null);
      if (typeof __V.dropStaleShareWin === 'function') (0, /*()*/__V.dropStaleShareWin)();
      (0, /*()*/__C.setStatus)(why
        ? (0, /*()*/__C.uiText)('shareStoppedWhy', 'Screen share stopped — {why}.').replace('{why}', why)
        : (0, /*()*/__C.uiText)('shareStopped', 'Screen share stopped.'));
    }
    // The stage element is a second <video>. Headless camera failure hides
    // the self tile (tileNote), and refreshOutbound never puts that display
    // back. A share is the picture, so the tile shows it, and the stage
    // paints the same track without waiting on a mesh seat.
    function showLocalScreen() {
      if (!(__C.myStatus.scr && __C.screenStream)) return;
      if (__C.meTile && __C.meTile.video) {
        __C.meTile.video.style.display = '';
        const note = __C.meTile.tile && __C.meTile.tile.querySelector('.note');
        if (note) note.remove();
      }
      const st = selfStageStream();
      if (st) paintStageStrip(st);
    }
    yield 2418;
    // o: { blob (or a promise of one), title, last, saved }. Called inside
    // the tap, so the sound can start without another one.
    // -> { ok, dur } once the film is on the stage, or { err, text }. The button ignores it; an app's rebroadcast
    // (a meeting session, js/meet-host.js) reads it. o.at: start there (seconds), to go on after a reload.
    async function rbStart(o) {
      if (!__C.BROADCAST) return { err: 'not-broadcast', text: 'Only a broadcast can rebroadcast.' };
      if (!(0, /*()*/__C.bcHostStored)()) return { err: 'not-host', text: 'Only the host can rebroadcast.' };
      if (__C.rbNow) return { err: 'busy', text: 'A rebroadcast is already playing.' };
      if (__C.myStatus.scr) stopScreenShare('a rebroadcast is starting');
      const vid = document.createElement('video');
      vid.playsInline = true; vid.preload = 'auto';
      const r = __C.rbNow = { vid, title: o.title, last: !!o.last, saved: o.saved || null, v: null, a: null, actx: null, url: '', starting: true };
      // The capture still carries the sound of a muted element, so the
      // host's phone stays quiet and its mic hears nothing back.
      if ((0, /*()*/__C.rbCap)(vid)) vid.muted = true;
      else try {
        // Plays nothing (it only routes the clip into a stream): no output device.
        r.actx = (0, /*()*/__C.newMeetAudioContext)();
        const dst = r.actx.createMediaStreamDestination();
        r.actx.createMediaElementSource(vid).connect(dst);
        r.a = dst.stream.getAudioTracks()[0] || null;
        const pr = r.actx.resume(); if (pr && pr.catch) pr.catch(() => {});
      } catch (e) {}
      (0, /*()*/__V.paintRb)();
      try {
        const blob = await o.blob;
        if (__C.rbNow !== r) return { err: 'stopped', text: 'The rebroadcast was stopped.' };
        r.url = URL.createObjectURL(blob);
        vid.src = r.url;
        await new Promise((ok, no) => {
          vid.addEventListener('loadedmetadata', ok, { once: true });
          vid.addEventListener('error', () => no(new Error('unplayable')), { once: true });
        });
        await (0, /*()*/__C.rbLength)(vid);
        if (o.at > 0 && isFinite(vid.duration)) { try { vid.currentTime = Math.min(o.at, Math.max(0, vid.duration - 2)); } catch (e) {} }
        await vid.play();
        if (__C.rbNow !== r) return { err: 'stopped', text: 'The rebroadcast was stopped.' };
        if ((0, /*()*/__C.rbCap)(vid)) (0, /*()*/__C.rbTracks)(r); else r.v = (0, /*()*/__V.rbCanvas)(r);
        if (!r.v) throw new Error('no picture');
      } catch (e) {
        if (__C.rbNow === r) { __C.rbNow = null; (0, /*()*/__C.rbDrop)(r); (0, /*()*/__V.paintRb)(); }
        (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stThatVideoCanTBe', 'That video can’t be played here. Pick another file.'), 8000);
        return { err: 'unplayable', text: 'That video can’t be played here.' };
      }
      // From the ended screen (Q72): lift the hold the Leave left, without
      // the mic or camera, and put the seat back on the stage.
      r.wasEnded = !!(__C.bcSeeding && __C.myStatus.bcend);
      if (__C.outgoingHeld) (0, /*()*/__C.releaseLeaveAsk)();
      __C.myStatus.bcend = 0;
      __C.myStatus.rb = Date.now();
      r.starting = false;
      // An app's rebroadcast says its blur pick up front (o.blur: 0 No blur, 1 Min, 2 Max), the pick a person makes
      // on the rebroadcast bar; it stands for this film (the bar's pick is offered again and taken: view paintRbNow).
      if (o.blur === 0 || o.blur === 1 || o.blur === 2) { r.blur = o.blur; try { (0, /*()*/__C.setPersonalBlur)(o.blur, true); } catch (e) {} }
      // A FALSE END. A browser may raise 'ended' well before the film's length (seen on Chromium on a Raspberry Pi:
      // a quarter of 40-minute films, at random places, files intact): the demuxer gave up on one spot. That is not
      // the end: play on a step past the spot (one step more each time it repeats there). Only a film that cannot get
      // past it in RB_SKIP_TRIES steps stops (stalled). An unknown length trusts the 'ended'.
      vid.addEventListener('ended', () => {
        if (__C.rbNow !== r) return;
        const d = vid.duration, p = vid.currentTime, T = GifOS.timings;
        if (!(isFinite(d) && d > 0 && p < d - T.RB_END_SLACK_MS / 1000)) { (0, /*()*/__C.rbStop)('ended'); return; }
        r.skips = (r.skipAt != null && p < r.skipAt + T.RB_SKIP_MS / 1000 * (r.skips + 1)) ? r.skips + 1 : 1;
        r.skipAt = p;
        if (r.skips > T.RB_SKIP_TRIES) { (0, /*()*/__C.rbStop)('stalled'); return; }
        try { vid.currentTime = Math.min(p + T.RB_SKIP_MS / 1000 * r.skips, d - 1); const pr = vid.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {}
        // The jump breaks the captured sound on its way out (the senders keep a track whose clock jumped): the stage
        // feed takes a fresh capture of the same element, and the old tracks stop.
        if ((0, /*()*/__C.rbCap)(vid)) {
          const ov = r.v, oa = r.a;
          (0, /*()*/__C.rbTracks)(r);
          refreshOutbound();
          try { if (oa && oa !== r.a) oa.stop(); if (ov && ov !== r.v) ov.stop(); } catch (e) {}
        }
      });
      vid.addEventListener('timeupdate', __V.paintRbNow);
      vid.addEventListener('pause', __V.paintRbNow);
      vid.addEventListener('play', __V.paintRbNow);
      if (!__C.myStatus.stg) { r.steppedUp = true; (0, /*()*/__C.setStage)(true); }
      refreshOutbound();
      if (!r.steppedUp) (0, /*()*/__C.broadcastStatus)();
      (0, /*()*/__C.refreshAllTiles)();
      (0, /*()*/__V.paintRb)();
      (0, /*()*/__C.setStatus)('Rebroadcasting ' + (r.last ? 'the last ' + (0, /*()*/__C.rbNoun)() : r.title) + '. Viewers see Prerecorded.', 6000);
      if (typeof window.__gifosMeetEmit === 'function') { try { window.__gifosMeetEmit({ type: 'rebroadcast', state: 'started', title: r.title || '', pos: vid.currentTime || 0, dur: vid.duration || 0 }); } catch (e) {} }
      return { ok: true, dur: vid.duration || 0, pos: vid.currentTime || 0 };
    }
    yield 2428;

    // ---- audio: three buses, receiver-side (docs/media-plane.md) --------------
    // Stage / My row / The stadium are a grouping by LINK CLASS, not a sender
    // tag: your faders are your own volume knobs, as ungovernable as any.
    // Degenerate by arithmetic: a room that is just your row has no stadium
    // sources, so that fader doesn't even show (progressive disclosure below).
    // The faders grow in as the room does. Section-mates fold into the Stadium.
    const MIX_KEY = 'gifos_mix';
    const mix = Object.assign({ stage: 1, row: 1, stadium: 1 }, (() => {
      try { return JSON.parse(localStorage.getItem(MIX_KEY) || '{}'); } catch (e) { return {}; }
    })());
    // Three buses, grouped by link CLASS (receiver-side volume only):
    //   Stage       — the stage strip / per-stager feeds, verbatim everywhere
    //   My row      — my direct row-mate links, the people I converse with
    //   The stadium — the composited far room (the 'sd' mosaic + row views):
    //                 the roar of everyone beyond my row
    // A one-row room has no stadium sources, so that fader simply doesn't show.
    // Audio playout is SPLIT from the video tiles. Mobile browsers PAUSE hidden
    // <video> elements — flipping to another tab used to silence the whole
    // meeting — but audio-only playback keeps going in the background, like
    // music. So every sounding tile feeds a companion Audio element carrying
    // the same stream; the tile's <video> is muted and carries only the
    // picture, and the faders drive the companions. (Elements, not WebAudio:
    // element playout is what the phone's echo canceller uses as its
    // reference, and what background-audio policy exempts.)
    // A REFUSED play() IS A SILENT PERSON, NOT A NON-EVENT (2026-10-02: in the
    // first customer meeting one phone lost one voice for a minute while the
    // call itself was fine, and it "came back by itself" — on the next tap).
    // A browser may refuse to start a NEW audio element (phone autoplay
    // policy, an audio-session interruption, a route change). Every companion
    // element's play() now lands here on failure: the element is remembered,
    // retried on a beat, retried on the next tap or key anywhere on the page,
    // and the person is told. A separate sweep re-kicks any companion the
    // platform merely PAUSED (an interruption that ends without a rejection).
    const blockedAudio = new Set();
    let audioKickArmed = false, audioNoteQueued = false;
    function audioUnblocked(el) {
      blockedAudio.delete(el);
      soundHeldCheck();
    }
    // SOUND THE DEVICE HOLDS BACK. A page can be deaf with every voice arriving in two ways: an element the
    // browser refused to start (blockedAudio), or a stopped context the voices are folded in (on WebKit every
    // voice plays through the one ear on the meeting context, and the stage ear's fold lives there too). A
    // phone starts neither without a tap, and a context that is not running rejects nothing, so it counts as
    // held here once two keep-alive sweeps in a row have found it stopped (a resume in flight is not a hold).
    // While anything is held the line asks for a tap and stays up (each sweep says it again); every tap or key
    // anywhere resumes the contexts and replays the elements inside that gesture; the line goes when the last
    // hold does.
    let ctxHeldSweeps = 0, soundHeldSaid = false;
    const ctxStopped = (c) => !!(c && c.state !== 'running' && c.state !== 'closed');
    function earCtxStopped() {
      const ears = (typeof wkEar !== 'undefined' && wkEar) || (stageEar && stageEar.fold);
      return !!(ears && ctxStopped(__C.ac));
    }
    function watchCtx(c) {
      if (!c || c._gifosHeldWatch) return;
      c._gifosHeldWatch = true;
      c.addEventListener('statechange', () => { if (!ctxStopped(c)) { ctxHeldSweeps = 0; soundHeldCheck(); } });
    }
    function soundHeld() { return blockedAudio.size > 0 || (ctxHeldSweeps >= 2 && earCtxStopped()); }
    function soundHeldCheck() {
      watchCtx(__C.ac);
      if (soundHeld() && !__C.leaving) {
        armAudioKick();
        if (document.visibilityState !== 'visible') return;
        (0, /*()*/__C.sayState)('soundHeld');
        soundHeldSaid = true;
        return;
      }
      disarmAudioKick();
      if (soundHeldSaid) { soundHeldSaid = false; (0, /*()*/__C.sayState)('soundBack'); }
    }
    function soundHeldSweep() { ctxHeldSweeps = earCtxStopped() ? ctxHeldSweeps + 1 : 0; soundHeldCheck(); }
    function armAudioKick() {
      if (audioKickArmed) return;
      audioKickArmed = true;
      document.addEventListener('pointerdown', audioKick, true);
      document.addEventListener('keydown', audioKick, true);
      document.addEventListener('click', audioKick, true); // a control's click() does not fire pointerdown, and that click is what retries play()
    }
    function disarmAudioKick() {
      if (!audioKickArmed) return;
      audioKickArmed = false;
      document.removeEventListener('pointerdown', audioKick, true);
      document.removeEventListener('keydown', audioKick, true);
      document.removeEventListener('click', audioKick, true);
    }
    // Drop the companion. A removed tile used to leave el._aud playing the
    // stream with no picture. Safe to call before blockedAudio exists.
    function releaseAudio(el) {
      if (el && el._wkVoice && typeof wkEar !== 'undefined' && wkEar) { try { wkEar.fold.remove(wkEarKey(el)); } catch (e) {} el._wkVoice = null; }
      if (!el || !el._aud) return;
      const a = el._aud;
      try { a.pause(); } catch (e) {}
      try { a.srcObject = null; } catch (e) {}
      el._aud = null;
      try { blockedAudio.delete(a); } catch (e) {}
    }
    function audioRetry(el) {
      let pr = null; try { pr = el.play(); } catch (e) {}
      if (pr && pr.then) pr.then(() => audioUnblocked(el)).catch(() => {});
    }
    // Runs inside the person's tap or key: a resume() or play() outside a gesture is what a phone refuses.
    function audioKick() {
      for (const c of [__C.ac, mixAc]) {
        if (!ctxStopped(c)) continue;
        try { const pr = c.resume(); if (pr && pr.then) pr.then(() => soundHeldCheck(), () => {}); } catch (e) {}
      }
      for (const el of Array.from(blockedAudio)) audioRetry(el);
      kickPausedAudio();
    }
    function audioBlocked(el, err) {
      if (!el || !el.srcObject) return;
      // AbortError is not a refusal: a new stream replaced the one this play()
      // was loading (Firefox, a companion re-pointed mid-load). Telling the
      // person "refused ... tap" and then "Sound is back" was a false alarm
      // that also covered the header line. Retry once, quietly.
      if (err && err.name === 'AbortError') {
        setTimeout(() => {
          if (!el.srcObject || !el.paused || blockedAudio.has(el)) return;
          let pr = null; try { pr = el.play(); } catch (e) {}
          if (pr && pr.catch) pr.catch((e2) => { if (e2 && e2.name !== 'AbortError') audioBlocked(el, e2); });
        }, 1500);
        return;
      }
      blockedAudio.add(el);
      // One check per burst: companions (stage, stadium, row) reject in the same turn.
      if (!audioNoteQueued) {
        audioNoteQueued = true;
        queueMicrotask(() => { audioNoteQueued = false; soundHeldCheck(); });
      }
      setTimeout(() => { if (blockedAudio.has(el)) audioRetry(el); }, 1500);
    }
    function kickPausedAudio() { // a companion that is paused but not refused is restarted
      for (const v of document.querySelectorAll('.tile video, .rowtile video')) {
        if (v.classList && v.classList.contains('stageface')) continue;
        const a = v._aud; if (!a || !a.srcObject || !a.paused || blockedAudio.has(a)) continue;
        let pr = null; try { pr = a.play(); } catch (e) {}
        if (pr && pr.then) pr.then(() => { if (typeof audioUnblocked === 'function') audioUnblocked(a); }).catch((e) => audioBlocked(a, e));
      }
      if (stageEar && stageEar.el && stageEar.el.srcObject && stageEar.el.paused && !blockedAudio.has(stageEar.el)) {
        let pr = null; try { pr = stageEar.el.play(); } catch (e) {}
        if (pr && pr.then) pr.then(() => { if (typeof audioUnblocked === 'function') audioUnblocked(stageEar.el); }).catch((e) => audioBlocked(stageEar.el, e));
      }
      if (typeof wkEar !== 'undefined' && wkEar && wkEar.el && wkEar.el.srcObject && wkEar.el.paused && !blockedAudio.has(wkEar.el)) {
        let pr = null; try { pr = wkEar.el.play(); } catch (e) {}
        if (pr && pr.then) pr.then(() => { if (typeof audioUnblocked === 'function') audioUnblocked(wkEar.el); }).catch((e) => audioBlocked(wkEar.el, e));
      }
    }
    // CAN THIS DEVICE HEAR? The one ear sums every voice in WebAudio. Some browsers take a received track into
    // WebAudio and hand back silence (older iPhone and iPad Safari did), or freeze the context's clock while it says
    // 'running'. Neither rejects anything, so nothing asks for a tap: the person hears nobody while everyone hears
    // them. Every keep-alive sweep, while the page is visible and the context runs, reads over ONE window of
    // HEAR_WIN_MS both what the receivers took in (inbound-rtp totalAudioEnergy of each voice the ear sums at a gain
    // of HEAR_MIN_GAIN or more) and what the mix plays (the fold's tap, before the limiter). Sound in and an all but
    // exact zero out is suspect: the first such sweep binds every source again (a node bound to a track while it was
    // still silent can stay silent), and HEAR_SWEEPS of them in a row retire the ear. So does a context clock that
    // moves less than a quarter of the wall time over HEAR_SWEEPS sweeps while sound arrives. With the ear retired,
    // every voice plays in its own element (busVolume's companion path, the one every other engine uses), mixed or
    // not, so the person hears. The verdict and its numbers are in debugDump().audio.hear and the debug trace.
    let wkEarOff = null; // why the one ear was retired on this page; null while it stands
    let hearBusy = false;
    const HEAR_WIN_MS = GifOS.timings.HEAR_WIN_MS, HEAR_STATS_MS = GifOS.timings.HEAR_STATS_WAIT_MS, HEAR_RX_ENERGY = 0.0003, HEAR_MIX_ZERO = 0.00001, HEAR_MIN_GAIN = 0.1, HEAR_SWEEPS = 3;
    const hearSt = { state: 'idle', silent: 0, frozen: 0, rx: null, mix: null, acT: null, wallT: 0, at: 0, n: 0, rebound: 0, retired: null };
    function hearReset(state) { hearSt.state = state; hearSt.silent = 0; hearSt.frozen = 0; hearSt.acT = null; hearSt.wallT = 0; }
    // The receivers that carry these tracks, on any pair (a relayed voice arrives on the friend's pair).
    function hearReceivers(tracks) {
      const want = new Set(tracks), out = [];
      for (const q of __C.peers.values()) {
        const pc = q && q.pc; if (!pc || typeof pc.getReceivers !== 'function') continue;
        let rs = []; try { rs = pc.getReceivers(); } catch (e) {}
        for (const r of rs) if (r.track && want.has(r.track)) out.push(r);
      }
      return out;
    }
    // Total inbound audio energy over these receivers, or null when this browser's stats do not report it.
    async function hearEnergy(rcvs) {
      let sum = 0, known = false;
      for (const r of rcvs) {
        let st = null;
        try { st = await Promise.race([r.getStats(), new Promise((res) => setTimeout(() => res(null), HEAR_STATS_MS))]); } catch (e) {}
        if (!st) continue;
        st.forEach((s) => { if (s.type === 'inbound-rtp' && typeof s.totalAudioEnergy === 'number') { known = true; sum += s.totalAudioEnergy; } });
      }
      return known ? sum : null;
    }
    function hearCheck() {
      if (hearBusy || __C.leaving || wkEarOff || !wkEar) return;
      const ac = __C.ac, ear = wkEar;
      if (!ac || ac.state !== 'running') { hearReset('held'); return; }
      if (document.visibilityState !== 'visible') { hearReset('hidden'); return; }
      hearBusy = true;
      (async () => {
        hearSt.n++; hearSt.at = Date.now();
        const parts = ear.fold.parts().filter((p) => p.gain >= HEAR_MIN_GAIN);
        const rcvs = hearReceivers(parts.map((p) => p.track));
        if (!rcvs.length) { hearReset('quiet'); hearSt.rx = null; return; }
        const t0 = ac.currentTime, w0 = Date.now();
        const e0 = await hearEnergy(rcvs);
        const mix = await ear.fold.peak(HEAR_WIN_MS);
        const e1 = await hearEnergy(rcvs);
        if (wkEar !== ear || wkEarOff) return;
        if (e0 == null || e1 == null || mix == null) { hearReset('unknown'); return; }
        const rx = e1 - e0;
        hearSt.rx = +rx.toFixed(5); hearSt.mix = +mix.toFixed(6);
        if (!(rx > HEAR_RX_ENERGY)) { hearSt.state = 'quiet'; hearSt.silent = 0; hearSt.frozen = 0; return; }
        // the clock: judged against the wall time of this same window, so a sweep that comes early is no evidence
        const wall = (Date.now() - w0) / 1000, adv = ac.currentTime - t0;
        hearSt.frozen = (wall > 0.3 && adv < wall / 4) ? hearSt.frozen + 1 : 0;
        hearSt.silent = mix < HEAR_MIX_ZERO ? hearSt.silent + 1 : 0;
        hearSt.state = (hearSt.silent || hearSt.frozen) ? 'suspect' : 'hears';
        if (hearSt.silent === 1) { for (const p of parts) { try { ear.fold.rebind(p.k); } catch (e) {} } hearSt.rebound++; }
        if (hearSt.frozen >= HEAR_SWEEPS) wkEarRetire('clock-stopped');
        else if (hearSt.silent >= HEAR_SWEEPS) wkEarRetire('silent-mix');
      })().catch(() => {}).then(() => { hearBusy = false; });
    }
    // The one ear goes; every voice plays in its own element from here on (busVolume's companion path).
    function wkEarRetire(why) {
      if (!wkEar || wkEarOff) return;
      wkEarOff = why;
      const ear = wkEar;
      wkEar = null;
      for (const el of document.querySelectorAll('video, audio')) if (el._wkVoice) el._wkVoice = null;
      try { ear.fold.clear(); } catch (e) {}
      try { ear.el.pause(); ear.el.srcObject = null; } catch (e) {}
      blockedAudio.delete(ear.el);
      // The stage ear played into the one ear (wkStageSink): built again on its own player, the next sweep refills it.
      if (stageEar && !(stageEar.el instanceof HTMLMediaElement)) {
        const old = stageEar; stageEar = null;
        try { if (old.el && typeof old.el.stop === 'function') old.el.stop(); } catch (e) {}
        try { old.fold.clear(); } catch (e) {}
        try { ensureStageEar(); } catch (e) {}
      }
      hearSt.state = 'elements'; hearSt.retired = { why, at: Date.now(), rx: hearSt.rx, mix: hearSt.mix };
      const line = 'hear: the meeting mix plays nothing on this device (' + why + ', rx ' + hearSt.rx + ' mix ' + hearSt.mix + '): every voice now plays in its own element';
      if (typeof __C.clog === 'function') (0, /*()*/__C.clog)(line);
      try { console.log('[hear] ' + line); } catch (e) {}
      try { applyBuses(); } catch (e) {}
      soundHeldCheck();
    }
    // debugDump().audio.hear: the self-check's verdict and the numbers behind it.
    function hearState() {
      return { state: hearSt.state, ear: wkEarOff ? 'elements' : (wkEar ? 'mix' : (WEBKIT_ENGINE ? 'none' : 'elements')), off: wkEarOff, silent: hearSt.silent,
        frozen: hearSt.frozen, rx: hearSt.rx, mix: hearSt.mix, n: hearSt.n, rebound: hearSt.rebound, agoMs: hearSt.at ? Date.now() - hearSt.at : null, retired: hearSt.retired };
    }
    // ONE EAR ON WEBKIT. A companion <audio> per tile is a device open per
    // voice change on that engine (see wkPicOf: a muted picture plus a mic
    // stream in any media element opens the ALSA device on the main thread,
    // and a pair forming re-points every companion once per fresh pc). So on
    // WebKit every voice is folded into one AudioContext graph (createAudioFold,
    // the same fold the stage ear rides) and ONE <audio> element bound once to
    // the fold's stream: one open for the meeting. Per-voice volume and the
    // group mute drive the fold's gains. Chromium and Firefox keep their
    // companions. If the context cannot be made the companion path stands.
    let wkEar = null, wkEarSeq = 0;
    function wkEarGet() {
      if (!WEBKIT_ENGINE || wkEarOff) return null;
      if (wkEar) return wkEar;
      try { (0, /*()*/__C.ensureAc)(); } catch (e) { return null; }
      if (!__C.ac || !GifOS.meshMedia || typeof GifOS.meshMedia.createAudioFold !== 'function') return null;
      let fold = null;
      try { fold = GifOS.meshMedia.createAudioFold(__C.ac); } catch (e) { return null; }
      const el = new Audio(); el.autoplay = true;
      el.srcObject = fold.dest.stream;
      let pr = null; try { pr = el.play(); } catch (e) { audioBlocked(el, e); }
      if (pr && pr.then) pr.then(() => { if (typeof audioUnblocked === 'function') audioUnblocked(el); }).catch((e) => audioBlocked(el, e));
      wkEar = { fold, el };
      return wkEar;
    }
    const wkEarKey = (el) => { if (!el._wkKey) el._wkKey = 'wkear' + (++wkEarSeq); return el._wkKey; };
    // The element's voice in the ear: src (or none) at vol. false = no ear.
    function wkEarSet(el, src, vol) {
      const ear = wkEarGet();
      if (!ear) return false;
      const key = wkEarKey(el);
      const g = (el._gmute || !(vol > 0)) ? 0 : vol;
      if (!src) { if (el._wkVoice) { ear.fold.remove(key); el._wkVoice = null; } return true; }
      if (el._wkVoice !== src) { if (el._wkVoice) ear.fold.remove(key); el._wkVoice = src; ear.fold.add(key, src, g); }
      else ear.fold.follow(key, src); // the same container came back with a new track (a rebuilt pair)
      ear.fold.setGain(key, g);
      return true;
    }
    // The stage ear's output on WebKit: the stage fold's stream is one more
    // source in the one ear, never an <audio> of its own. The sink wears the
    // element surface the stage code drives (volume, muted, srcObject,
    // paused, play) and maps volume/muted onto the ear's gain for the stage
    // key, so the Stage fader and the waiting-room mute still land; the
    // analysers read srcObject (the fold's stream) as before.
    const WK_STAGE_KEY = 'wkstage';
    function wkStageSink(fold) {
      const ear = wkEarGet();
      if (!ear || !fold || !fold.dest || !fold.dest.stream) return null;
      const sink = { _vol: 1, _muted: false, paused: false, srcObject: fold.dest.stream, play() { return Promise.resolve(); } };
      const apply = () => { try { ear.fold.setGain(WK_STAGE_KEY, (sink._muted || !(sink._vol > 0)) ? 0 : sink._vol); } catch (e) {} };
      Object.defineProperty(sink, 'volume', { get: () => sink._vol, set: (v) => { sink._vol = +v; apply(); } });
      Object.defineProperty(sink, 'muted', { get: () => sink._muted, set: (v) => { sink._muted = !!v; apply(); } });
      try { ear.fold.remove(WK_STAGE_KEY); ear.fold.add(WK_STAGE_KEY, fold.dest.stream, 1); } catch (e) { return null; }
      if (!ear.fold.has(WK_STAGE_KEY)) return null; // the graph refused the fold's track: the element path stands
      return sink;
    }
    // Is this track one a pair DELIVERED to me (a receiver's track on one of
    // my transports)? Only asked on WebKit, where such a video is forwarded as a
    // fixed-size copy (wkFwdSrc). (2026-10-22 it read as a deadlock on
    // forward, out/wk0440; 2026-11-07 the same shell forwards received audio and
    // video by addTrack, addTransceiver and replaceTrack, muted or flowing, to 4
    // pcs at once, no hang in 3/3: bare probes bare.js, bare2.js.)
    function wkRemoteTrack(tr) {
      if (typeof WEBKIT_ENGINE === 'undefined' || !WEBKIT_ENGINE || !tr) return false;
      for (const q of __C.peers.values()) {
        const pc = q && q.pc; if (!pc || typeof pc.getReceivers !== 'function') continue;
        try { for (const r of pc.getReceivers()) if (r.track === tr) return true; } catch (e) {}
      }
      return false;
    }
    // voice: the stream whose sound this element's companion plays. A peer's
    // tile with the camera off shows no video (its card is drawn over it),
    // so the caller hands the peer's own stream.
    function busVolume(el, vol, voice) {
      const src = voice || (el._pic && el.srcObject === el._pic && el._wrapOf) || el.srcObject; // a WebKit tile plays a picture-only stream; its voice is the wrapped one
      if (typeof WEBKIT_ENGINE !== 'undefined' && WEBKIT_ENGINE && typeof wkEarSet === 'function' && wkEarSet(el, src, vol)) {
        el.muted = true;
        if (el._aud) { try { el._aud.pause(); el._aud.srcObject = null; } catch (e) {} el._aud = null; }
        if (!src) return;
        const heldTile = el.closest && el.closest('[data-peer]');
        const heldPid = heldTile && heldTile.dataset && heldTile.dataset.peer;
        const held = heldPid && heldPid !== __C.myId && typeof __C.mediaOk === 'function' && (0, /*()*/__C.mediaOk)(heldPid) === false;
        if (!held && el.srcObject && (el.paused || el.readyState === 0)) { const pr = el.play(); if (pr && pr.catch) pr.catch(() => {}); }
        return;
      }
      if (!src) { if (el._aud) el._aud.srcObject = null; el.volume = vol; return; }
      // A sound made here by a fold (a Section-1 head's Stadium ear) is heard through its parts, never as a WebAudio
      // track in an element: Chromium resamples such a track to catch up after a hiccup and the voices go up in
      // pitch (createFoldPlayer). A remote track keeps its plain companion.
      const fd = foldOfStream(src);
      if (el._aud && (fd ? el._aud.fold !== fd : !!el._aud.direct)) releaseAudio(el);
      if (!el._aud) { if (fd) el._aud = fd.player(audioBlocked); else { el._aud = new Audio(); el._aud.autoplay = true; } }
      el.muted = true; // the <video> is picture-only, always — sound lives in the companion
      // Muting is what makes a late srcObject legal to play. The element is
      // often still paused from the unmuted autoplay attempt at claim time,
      // and a paused picture reports videoWidth 0 even after frames arrive.
      // A held person stays paused: playing here would show a picture the
      // claim is required to keep off the tile.
      const heldTile = el.closest && el.closest('[data-peer]');
      const heldPid = heldTile && heldTile.dataset && heldTile.dataset.peer;
      const held = heldPid && heldPid !== __C.myId && typeof __C.mediaOk === 'function' && (0, /*()*/__C.mediaOk)(heldPid) === false;
      if (!held && el.srcObject && (el.paused || el.readyState === 0)) { const pr = el.play(); if (pr && pr.catch) pr.catch(() => {}); }
      if (el._aud.srcObject !== src) {
        el._aud.srcObject = src;
        let pr = null; try { pr = el._aud.play(); } catch (e) { audioBlocked(el._aud, e); }
        if (pr && pr.then) pr.then(() => { if (typeof audioUnblocked === 'function') audioUnblocked(el._aud); }).catch((e) => audioBlocked(el._aud, e));
      }
      el._aud.volume = vol;
      // A bus at 0 is MUTED, not merely volume 0: iOS Safari ignores the
      // HTMLMediaElement volume setter (sound stays under the hardware
      // buttons), so a structural link's raw mic and a stager's direct track
      // played at full level there — ghost voices, doubled stagers. `muted`
      // is honoured everywhere; the fader range above 0 still rides volume.
      el._aud.muted = !!el._gmute || !(vol > 0); // group mute rides the same pipe as the faders
    }
    // The audio fold whose output this stream carries (it was made on this page), or null.
    function foldOfStream(st) {
      const MMx = typeof GifOS !== 'undefined' ? GifOS.meshMedia : null;
      if (!st || !st.getAudioTracks || !MMx || typeof MMx.foldOfTrack !== 'function' || typeof MMx.createFoldPlayer !== 'function') return null;
      const t = st.getAudioTracks()[0];
      return t ? MMx.foldOfTrack(t) : null;
    }
    // Service mute is a local gate on the stage bus. The saved fader stays put.
    // The one writer of the stage ear's level: a viewer's sound off and the waiting room hold through every reconcile (iOS ignores volume; 0 must be `muted`).
    function setStageEarLevel() {
      if (!stageEar) return;
      const v = heardStage();
      stageEar.el.volume = v;
      stageEar.el.muted = (0, /*()*/__C.iAmWaiting)() || !(v > 0);
    }
    // The person's own stage sound on this device (a broadcast viewer's Sound on / Muted): the plane holds it and mixes by it.
    function setServiceHeard(on) { serviceHeard = !!on; try { applyBuses(); } catch (e) {} return serviceHeard; }
    function heardStage() {
      let base = 1;
      try { base = mix.stage; } catch (e) { base = 1; }
      try {
        if (__C.BC_SEAT && !serviceHeard) return 0;
        if (__C.EMBED && !(0, /*()*/__C.embedHosted)()) return 0;   // an embed plays nothing while the room is not hosted
      } catch (e) {}
      return base;
    }
    function applyBuses() {
      const sealed = (0, /*()*/__C.iAmWaiting)() || !!__C.EMBED; // a person in the waiting room hears no one; an embed hears only the Stage
      const stg = new Set((0, /*()*/__C.stageIds)());
      const mates = new Set((0, /*()*/__C.rowMates)());
      let hasStadium = false;
      for (const [pid, p] of __C.peers) {
        // Stage first (a staged row mate is Stage); then MY ROW (the direct
        // conversation tier). Any OTHER direct link is STRUCTURAL — an up/down/
        // cross carrier whose tile Channel R hides. Its raw mic must NOT play:
        // that person's audio reaches me properly SUMMED inside the stadium
        // composites. Letting the raw track through gave a
        // disembodied "ghost voice" with no tile (and double-audio once the
        // composite carried them too).
        // Stagers' direct tracks are muted too: their voice arrives via the
        // per-stager feeds folded at the ear — the direct link would double it.
        const bus = stg.has(pid) ? null : mates.has(pid) ? 'row' : null;
        // The voice is the person's own stream: the direct one, or the one a
        // friend carries (relayVia). The tile's element can hold a painted
        // picture instead (camera off), which has no sound.
        const voice = p.relayed ? ((__C.relayVia.get(pid) || {}).stream || null) : (p.stream || null);
        busVolume(p.video, (bus && !sealed && !(0, /*()*/__C.isHeld)(pid) && !(typeof __C.botHidden === 'function' && (0, /*()*/__C.botHidden)(pid))) ? mix[bus] : 0, voice);
      }
      // feed tiles (the nested mosaics): stage strip is Stage; stadium tiles
      // are The stadium.
      const stageVol = heardStage();
      for (const el of __V.stagefeedEl.querySelectorAll('.rowtile video')) { if (el.classList.contains('stageface')) continue; busVolume(el, stageVol); }
      for (const el of __V.stadiumEl.querySelectorAll('.rowtile')) {
        const v = el.querySelector('video'); if (!v) continue;
        busVolume(v, sealed ? 0 : mix.stadium); hasStadium = true; // the only stadium-area tile now is the Stadium composite
      }
      // Section A/V + audio are dropped; section-mates fold into the Stadium.
      // Progressive disclosure for the stadium fader.
      const stadLab = document.getElementById('mixlab-stadium');
      const stadMark = hasStadium ? '1' : '0';
      if (stadLab && stadLab.dataset.on !== stadMark) { stadLab.dataset.on = stadMark; stadLab.style.display = hasStadium ? '' : 'none'; }
      setStageEarLevel(); // the Stage fader drives the ear fold
      kickPausedAudio();
      applySpeaker(); // a voice that just arrived plays on the picked speaker
    }
    // The Settings modal: the sound mix's new home (same fader ids as when it
    // floated as its own Mix panel) plus the video-quality picker.
    // BEGIN-AUDIO-KEEPALIVE
    // A hidden or pocketed page still has to hear. These listeners are not
    // the freeze-reload visibility handler: that one reloads, this one only
    // restarts sound. A light 3s watchdog covers a pause that no event
    // announces, so a paused voice never waits for a tap or a volume change.
    function keepMeetingAudio() {
      try {
        if (typeof __C.ac !== 'undefined' && __C.ac && typeof __C.ensureAc === 'function') (0, /*()*/__C.ensureAc)();
      } catch (e) {}
      try { if (typeof kickPausedAudio === 'function') kickPausedAudio(); } catch (e) {}
      try { applySpeaker(); } catch (e) {}
      try { mixClockCheck(); } catch (e) {}
      try { soundHeldSweep(); } catch (e) {}
      try { hearCheck(); } catch (e) {}
    }
    function armAudioKeepAlive() {
      try { (0, /*()*/__V.paintSpkBtn)(); } catch (e) {}
      const kick = () => { try { keepMeetingAudio(); } catch (e) {} };
      document.addEventListener('visibilitychange', kick);
      window.addEventListener('pageshow', kick);
      window.addEventListener('resume', kick);
      window.addEventListener('focus', kick);
      setInterval(kick, 3000);
    }
    yield 2513;

    // ---- the grid: clock sync + per-stream delay alignment --------------------
    // Voices over the internet don't smear because they're LATE — they smear
    // because each one is late by a DIFFERENT amount. The grid removes the
    // difference: clocks sync continuously over the DataChannels (NTP-style),
    // and every incoming audio stream gets a per-receiver jitterBufferTarget so
    // its total capture-to-ear delay lands on its BUS's tier. Always on: while
    // people TALK, the near field (stage + your row) simply aligns to its
    // slowest mate, capped — so shared laughter, "Amen"s and responsive
    // readings land together instead of smearing. When someone leads a SONG
    // the tiers stretch into cathedral acoustics: the stage plays at the same
    // synced instant on every device (the room sings in true unison), your row
    // swells a uniform beat behind your own voice, and the far units a beat
    // behind that — each tier internally coherent, receding in time the way a
    // real room recedes in space. Composition is free: the fold pipes tap
    // tracks AFTER the jitter buffer, so a deacon's aligned row folds into an
    // internally coherent composite that downstream rooms align as ONE stream.
    const GRID = {
      JB_BASE: 60,      // assumed decode+playout floor (ms); identical across streams, so it cancels where coherence matters
      TALK_ROW: 280,    // talk: the near field aligns to its slowest mate, capped so one bad link can't drag the pew
      SONG_STAGE: 280,  // song: the stage lands everywhere at capture+this — the true-unison anchor
      SONG_ROW: 560,    // row voices land uniformly this far behind their capture — the pew around you
      SONG_FAR: 840,    // section/stadium units — the far bank of the congregation
      SONG_CAP: 3000,   // the deepest relayed stage anchor a row will wait for (the browser knob tops out at 4000)
      HOP_ENC: 40,      // what a relay hop adds beyond its own playout: decode → re-encode + one Opus frame
      CK_EVERY: 5000, APPLY_EVERY: 3000,
    };
    try { const t = localStorage.getItem(__C.TIMING_KEY); if (t === 'chat' || t === 'unison') __C.timing = t; } catch (e) {}
    let gdOverride = 0; // test hook: pretend this device needs a slower grid
    const clk = new Map(); // pid -> { rtt, off, n } — the best (min-rtt) sample, slowly decayed
    function clockSample(pid, t0, t1, t2) {
      const rtt = Math.max(0, t2 - t0), off = t1 - (t0 + t2) / 2;
      const c = clk.get(pid) || { rtt: Infinity, off: 0, n: 0 };
      c.n++;
      // Min-rtt filter: the least-queued sample is the most honest clock. The
      // stored best inflates a little each round so one lucky sample from an
      // hour ago can't pin the estimate after the network changes.
      if (c.rtt !== Infinity) c.rtt = c.rtt * 1.15 + 2;
      if (rtt <= c.rtt) { c.rtt = rtt; c.off = off; }
      clk.set(pid, c);
    }
    setInterval(() => {
      // ONLY CLOCK-SYNC THE PEERS WHOSE DELAY WE ACTUALLY SET (2026-07-31).
      // applyGrid gives the stadium bus D = 0 ⇒ jbt = 0 while people TALK, so a
      // structural peer's RTT changes nothing — we were waking the radio for
      // every peer every CK_EVERY to compute a number that multiplied by zero.
      // Radio wakeups are their own power cost, separate from the bytes. SINGING
      // is the exception and it is a real one: the song tiers give the far bank
      // SONG_FAR, so every peer's clock matters again — the sing state flips
      // this back on within one tick, and the grid re-converges on the next.
      const ckSing = (0, /*()*/__C.roomSingOn)();
      const ckNear = ckSing ? null : new Set([].concat((0, /*()*/__C.stageIds)(), (0, /*()*/__C.rowMates)()));
      for (const p of __C.peers.values()) {
        // A TRACK THAT NEVER NEGOTIATED MUST NOT BE STRANDED (2026-07-31).
        // Adding a sender mid-call — lateMedia(), the camera granted after a
        // denied join — creates a transceiver and asks for a re-offer. That ask
        // can be LOST: renegotiate() defers while the pc is mid-negotiation by
        // setting p.renegAgain, and renegAgain is only ever consumed when a
        // subsequent roffer/ranswer arrives for that pair. If none does, the pc
        // settles back to `stable` holding a sender whose m-line was never
        // negotiated, and it stays that way forever. Measured, e2e-media-recovery
        // ~60% of runs:
        //   mia  tx ["0:audio:sendrecv:sendrecv", "?:video:sendrecv:?"]  sig stable
        //   ada  tx ["0:audio:sendrecv:sendrecv"]
        // — mid null, currentDirection null, nothing in flight, and the far side
        // never saw a video m-line at all. For a real user that is: you fix your
        // camera permission, your own preview lights up, and NOBODY EVER SEES YOU.
        // `hasPendingTx` is exactly the detector; it was only ever consulted at
        // the moment of the kick. Consult it here too — stable + pending is an
        // impossible resting state, so re-offer. Idempotent: it is a no-op the
        // instant the m-line negotiates.
        if (p.pc && p.pc.signalingState === 'stable' && (0, /*()*/__C.hasPendingTx)(p)) {
          p.renegAgain = false;
          if (typeof __C.clog === 'function') (0, /*()*/__C.clog)('stranded-tx heal → ' + String(p.id).slice(0, 6));
          (0, /*()*/__C.renegotiate)(p);
        }
        if (ckNear && !ckNear.has(p.id)) continue;
        if (p.dc && p.dc.readyState === 'open') (0, /*()*/__C.dcSend)(p, { k: 'ck', t0: performance.now() });
      }
    }, GRID.CK_EVERY);
    yield 2521;
    const singLeaderName = () => {
      const pid = (0, /*()*/__C.stageIds)().find(__C.singOf);
      if (!pid || pid === __C.myId) return (0, /*()*/__C.myName)();
      if ((0, /*()*/__C.freshSt)(pid)) return (__C.peers.get(pid) || {}).name || __C.rosterNames[pid] || 'Someone';
      const e = (0, /*()*/__C.digStageEntry)(pid);
      if (e && e.nm) return (0, /*()*/__C.foldName)(e.nm, (__C.peers.get(pid) || {}).name || __C.rosterNames[pid]);
      return (__C.peers.get(pid) || {}).name || __C.rosterNames[pid] || 'Someone';
    };

    // Apply the tiers: one jitterBufferTarget per incoming audio receiver so
    // (network/2 + buffer) is EQUAL within a bus. Folds arrive as single
    // streams on their carrier link and get aligned as units — exactly one
    // knob per bus member, whether it's a neighbor or a thousand-voice fold.
    const gridApplied = new Map(); // pid -> { bus, D, jbt, set } — inspection + tests
    function applyGrid() {
      const sing = (0, /*()*/__C.roomSingOn)();
      const stg = new Set((0, /*()*/__C.stageIds)());
      const mates = new Set((0, /*()*/__C.rowMates)());
      const rttOf = (pid) => { const c = clk.get(pid); return c && c.n ? c.rtt : 200; }; // no sample yet → assume mid-pack
      // My near-field NEED: the slowest voice I have to wait for anyway.
      // Gossiped (uncapped) so unison rooms can meet their slowest ear.
      let rowD = 0;
      for (const pid of __C.peers.keys()) if (stg.has(pid) || mates.has(pid)) rowD = Math.max(rowD, rttOf(pid) / 2 + GRID.JB_BASE);
      __C.myStatus.gd = Math.ceil(gdOverride || rowD);
      // UNISON widens the target from MY need to the ROOM's: the max of every
      // near-field member's gossiped need — so all of us land each voice at the
      // same synced instant. CHAT keeps just my own. Both capped: one terrible
      // link slows itself, never the whole pew.
      let nearD = rowD;
      if (__C.timing === 'unison') {
        for (const pid of __C.peers.keys()) if (stg.has(pid) || mates.has(pid)) {
          const st = __C.statusOf.get(pid);
          if (st && st.gd) nearD = Math.max(nearD, st.gd);
        }
      }
      nearD = Math.min(GRID.TALK_ROW, Math.ceil(nearD));
      // STAGE FEEDS ARE KEYED BY FEED, NOT BY CARRIER (2026-09-18). The tier
      // used to be chosen per PEER and applied to every audio track on that
      // link — but a stager's voice reaches most of the room as a per-stager
      // 'stg:' feed relayed over the tree (stage lane), so anyone not directly
      // linked to the leader got the anchor on their CARRIER's tier: 560 via a
      // row-mate, 840 via an up-link, i.e. the leader arriving BEHIND the row
      // and the whole cathedral model inverted. Now every 'stg:' audio track
      // gets the stage tier wherever it rides, and a relayed copy accounts for
      // what the relay already spent: a relay re-encodes its own PLAYOUT, so
      // the copy has incurred the relay's stage playout delay (gossiped as
      // `sp`) plus a hop's encode cost plus half our link's rtt. My NEED (`sn`)
      // is the deepest copy I hold; the row's target is the max need across
      // the near field (same idea as UNISON's `gd`), so row-mates who hear the
      // leader via different paths still land him at one instant and sing to
      // the same beat. Capped: a pathological path slows itself, not the pew.
      // `sp` is PER FEED ({ stagerId: ms }) and counts only the copies I
      // actually relay (mosIn primaries, never a parked standby): one number
      // per node fed back through the S1 flood's standby copies — A's standby
      // via B, B's standby via A — and ran away past the cap within a minute.
      // Per feed, the copies I relay form a chain back to the producer, so the
      // recursion terminates at the direct receiver.
      const stgTracks = new Map(); // audio track id -> { via, owner, direct }
      let stageT = GRID.SONG_STAGE, stageNeed = GRID.SONG_STAGE;
      if (sing) {
        const feedNeed = {};
        for (const [k, f] of __C.mosIn) {
          if (k.indexOf('stg:') !== 0 || !f || !f.stream || !f.via) continue;
          const owner = k.slice(4).split('^')[0];
          for (const t of f.stream.getAudioTracks()) stgTracks.set(t.id, { via: f.via, owner, direct: f.via === owner });
        }
        for (const si of stgTracks.values()) {
          const need = Math.min(GRID.SONG_CAP, Math.ceil(stgIncurred(si) + GRID.JB_BASE));
          feedNeed[si.owner] = Math.max(feedNeed[si.owner] || 0, need);
          stageNeed = Math.max(stageNeed, need);
        }
        stageT = stageNeed;
        for (const pid of __C.peers.keys()) if (stg.has(pid) || mates.has(pid)) {
          const st = __C.statusOf.get(pid);
          if (st && st.sn) stageT = Math.max(stageT, st.sn);
        }
        stageT = Math.min(GRID.SONG_CAP, Math.ceil(stageT));
        __C.myStatus.sn = stageNeed;
        const sp = {}; // what a copy relayed from me will have incurred at the next hop, per feed
        for (const owner of Object.keys(feedNeed).slice(0, __C.SCALE.C)) sp[owner] = Math.max(stageT, feedNeed[owner]);
        __C.myStatus.sp = sp;
      } else { delete __C.myStatus.sn; delete __C.myStatus.sp; }
      function stgIncurred(si) {
        if (si.direct) return rttOf(si.via) / 2;
        const viaSp = (__C.statusOf.get(si.via) || {}).sp;
        const relayPlay = Math.max(GRID.SONG_STAGE, (viaSp && viaSp[si.owner]) || 0); // the relay plays it no sooner than the floor
        return relayPlay + GRID.HOP_ENC + rttOf(si.via) / 2;
      }
      // SKIP-IF-UNCHANGED (2026-07-31 power work). This runs every
      // GRID.APPLY_EVERY (3s) and walked getReceivers() for EVERY peer to
      // rewrite a jitter target that, in a settled room, is the value already
      // there — a steady meeting changes bus/jbt only when someone moves seat,
      // steps on stage, or the clock drifts. Keep the previous verdict and
      // re-apply only where it actually differs. Anything not applied last time
      // (set:false — a receiver caught mid-teardown) is always retried.
      const prevGrid = new Map(gridApplied);
      gridApplied.clear();
      for (const [pid, p] of __C.peers) {
        const bus = stg.has(pid) ? 'stage' : mates.has(pid) ? 'row' : 'stadium';
        const D = sing ? (bus === 'stage' ? GRID.SONG_STAGE : bus === 'row' ? GRID.SONG_ROW : GRID.SONG_FAR)
          : (bus === 'stage' || bus === 'row') ? nearD : 0; // far units play natural — they're a murmur, not a conversation
        const jbt = D > 0 ? Math.max(0, Math.round(D - rttOf(pid) / 2 - GRID.JB_BASE)) : 0;
        // Per-track overrides on this link: the stage feeds it carries.
        const stgOn = {};
        for (const [tid, si] of stgTracks) if (si.via === pid) stgOn[tid] = Math.max(0, Math.round(stageT - stgIncurred(si) - GRID.JB_BASE));
        const stgSig = JSON.stringify(stgOn);
        const was = prevGrid.get(pid);
        // The skipped link still reports THIS tick's stage target: a link
        // that carries no stage track keeps its bus and jbt when my stage
        // path changes, and used to report the old target from then on.
        if (was && was.set && was.bus === bus && was.jbt === jbt && was.stgSig === stgSig) { was.stageT = stageT; gridApplied.set(pid, was); continue; }
        let set = false;
        try {
          for (const r of p.pc.getReceivers()) {
            if (!r.track || r.track.kind !== 'audio') continue;
            const want = Object.prototype.hasOwnProperty.call(stgOn, r.track.id) ? stgOn[r.track.id] : jbt;
            if ('jitterBufferTarget' in r) { r.jitterBufferTarget = want; set = true; }
            else if ('playoutDelayHint' in r) { r.playoutDelayHint = want / 1000; set = true; } // older spelling, in seconds
          }
        } catch (e) { /* a receiver mid-teardown — next tick catches it */ }
        gridApplied.set(pid, { bus, D, jbt, set, stg: stgOn, stgSig, stageT });
      }
    }

    // Song-mode reactions: fader preset (remembered and restored), the leader's
    // music-grade mic, and a nudge for everyone else. All derived from
    // roomSingOn(), so a leader vanishing mid-hymn unwinds everything.
    let singWas = false, singPrevMix = null, singSteppedUp = false;
    // Any path off the stage, not only the Song pill. The flag used to stay
    // gossiped, so the next step-up restarted the song.
    function endSongOnStepDown() {
      if (!__C.myStatus.sing && !singSteppedUp) return false;
      __C.myStatus.sing = 0;
      singSteppedUp = false;
      return true;
    }
    // While a song is on, mix holds the preset. Persist the user's mix:
    // the bus they moved is remembered, the untouched preset buses are not.
    function rememberMix(bus) {
      if (singPrevMix && bus) singPrevMix[bus] = mix[bus];
      try { localStorage.setItem(MIX_KEY, JSON.stringify(singPrevMix || mix)); } catch (e) {}
    }
    function reactSing() {
      const on = (0, /*()*/__C.roomSingOn)();
      if (on !== singWas) {
        singWas = on;
        if (on) {
          singPrevMix = Object.assign({}, mix);
          Object.assign(mix, { stage: 1, row: 0.55, stadium: 0.3 }); // feature the leader; the room sings around you
          (0, /*()*/__V.paintFaders)(); applyBuses();
          if (__C.myStatus.sing && (0, /*()*/__C.stageIds)().includes(__C.myId)) setMicMode('music');
          else {
            // Followers sing too: drop the noise suppression and auto-gain
            // that erase a held note, but KEEP echo cancellation — a phone on
            // speaker without it would feed the leader straight back in.
            setMicMode('sing');
            const knob = (typeof RTCRtpReceiver !== 'undefined') && (('jitterBufferTarget' in RTCRtpReceiver.prototype) || ('playoutDelayHint' in RTCRtpReceiver.prototype));
            (0, /*()*/__C.setStatus)('🎵 ' + singLeaderName() + ' is leading a song — sing along! (earbuds make your voice part of the choir)'
              + (knob ? '' : ' This browser can\'t line voices up in time, so they may stagger.'));
          }
        } else {
          if (singPrevMix) { Object.assign(mix, singPrevMix); singPrevMix = null; rememberMix(null); (0, /*()*/__V.paintFaders)(); applyBuses(); }
          setMicMode('voice'); // leader and followers alike
          (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stTheSongEnded', '🎵 The song ended.'));
        }
        paintTiming(); // the Song pill lights (and stays tappable for its leader)
        applyGrid(); // retune the tiers now, not on the next tick
      }
    }
    setInterval(() => {
      reactSing(); applyGrid();
      // Buses ride the 2s beat and the events that change membership. A
      // swapped stream re-feeds its companion there. This tick is the grid.
      if (typeof __C.updateMediaSession === 'function') (0, /*()*/__C.updateMediaSession)(); // keep the OS call card's count fresh
    }, GRID.APPLY_EVERY);
    yield 2530;
    const SONG_PILL_TITLE = 'Lead the room in song — steps you onto the stage with a music-grade mic and lines everyone\'s sound up to you; tap again to end (earbuds recommended for singers)';
    function paintTiming() {
      const sing = (0, /*()*/__C.roomSingOn)();
      const mine = !!(__C.myStatus.sing && (0, /*()*/__C.stageIds)().includes(__C.myId));
      for (const btn of __V.timingRow.querySelectorAll('button')) {
        btn.classList.toggle('on', sing ? btn.dataset.timing === 'song' : btn.dataset.timing === __C.timing);
        if (btn.dataset.timing !== 'song') continue;
        const blocked = sing && !mine;
        btn.setAttribute('aria-disabled', blocked ? 'true' : 'false');
        btn.title = blocked
          ? (0, /*()*/__C.uiText)('setSongWait', '{name} is leading; wait for the song to end.').replace('{name}', singLeaderName())
          : (0, /*()*/__C.uiText)('setSongTip', SONG_PILL_TITLE);
      }
    }
    function toggleSing() {
      if (__C.myStatus.sing) {
        __C.myStatus.sing = 0;
        if (singSteppedUp) { singSteppedUp = false; (0, /*()*/__C.setStage)(false); } else (0, /*()*/__C.broadcastStatus)();
        reactSing();
        return;
      }
      if ((0, /*()*/__C.roomSingOn)()) { (0, /*()*/__C.setStatus)(singLeaderName() + ' is leading; wait for the song to end.'); return; }
      if (!(0, /*()*/__C.stageIds)().includes(__C.myId)) {
        if (!(0, /*()*/__C.canStage)(__C.myId)) { (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stOnlyRoomAdminsAndPeople2', 'Only room hosts — and people they allow — can lead a song here.')); return; }
        if ((0, /*()*/__C.stageIds)().length >= __C.SCALE.C) { (0, /*()*/__C.sayState)('stageFull', { n: __C.SCALE.C }); return; }
        __C.myStatus.sing = Date.now();
        singSteppedUp = true; // we stepped up FOR the song — step back down with it
        (0, /*()*/__C.setStage)(true);       // broadcasts
      } else {
        __C.myStatus.sing = Date.now();
        (0, /*()*/__C.broadcastStatus)();
      }
      reactSing();
    }
    yield 2637;
    // ---- WHISPER CAPTIONS: the OS's speech-to-text provider, fed my own mic ----
    // (2026-10-02, the first customer meeting.) The browser engine listens in
    // ONE fixed language and cannot detect it, writes two-word fragments,
    // cannot learn a company's names and cannot translate. Whisper — the
    // Offline Captions provider app, through GifOS.providers — does all four,
    // and it is fed the ECHO-CANCELLED track the call already sends, so a
    // laptop on speakers no longer writes down the room (the browser engine
    // hears the raw microphone; see the gate in startSpeech).
    // Utterances are cut by the same meter that paints the talking ring:
    // voice → open (with 400 ms of pre-roll); 700 ms of silence → close and
    // hand the clip to the provider; 15 s → close and reopen at once. One
    // clip is in the provider at a time; a backlog past three drops the
    // oldest and says so.
    const CC_ENGINE_KEY = 'gifos_cc_engine', CC_TRANSLATE_KEY = 'gifos_cc_translate', CC_WORDS_KEY = 'gifos_cc_words', CC_EARS_KEY = 'gifos_cc_ears';
    // WHO MAY RUN WHISPER. Whisper runs on the processor that also encodes the
    // call and answers its heartbeats. On a phone, or a computer with few cores
    // or little memory, it starves the meeting and drains the battery, so such
    // a device is not offered Whisper: it runs only after an explicit "use it
    // anyway" on this browser. A choice stored before that does not count.
    const CC_WHISPER_ANYWAY_KEY = 'gifos_cc_whisper_anyway';
    function whisperWeakWhy(nav) {
      nav = nav || {};
      if (__C.MP.mobileDevice(nav)) return 'phone';
      const cores = Number(nav.hardwareConcurrency) || 0, mem = Number(nav.deviceMemory) || 0;
      if (cores && cores < 4) return 'cores';
      if (mem && mem < 4) return 'memory';
      return '';
    }
    const WSP_WEAK = whisperWeakWhy(navigator);
    const whisperAllowed = () => !WSP_WEAK || (0, /*()*/__C.lsGet)(CC_WHISPER_ANYWAY_KEY) === '1';
    function ccEngine() { return (phoneCaptions() ? 'browser' : (__C.CC_ON_PHONE ? 'local' : ((0, /*()*/__C.lsGet)(CC_ENGINE_KEY) === 'whisper' && whisperAllowed() ? 'whisper' : 'browser'))); }
    const WHISPER_APP_ID = 'offline-stt-whisper';
    yield 2645;
    // Can this browser run Whisper at all: allowed on this device, and an
    // audio graph to cut the voices from.
    function whisperSupported() { return whisperAllowed() && !!(window.AudioContext || window.webkitAudioContext); }
    const WSP_PRE_MS = GifOS.timings.WSP_PRE_MS, WSP_GAP_MS = GifOS.timings.WSP_GAP_MS, WSP_MAX_S = GifOS.timings.WSP_MAX_S, WSP_MIN_S = GifOS.timings.WSP_MIN_S, WSP_BACKLOG = 3, WSP_SCRIBE_MAX = 8;
    const WHISPER_SEED_KEY = 'gifos_store_default_' + 'offline-stt-whisper'; // the same stamp the Home Screen's lazy seed writes (gifos-install.js)
    // One capture per VOICE: 'me' (my own echo-cancelled track) and, for a
    // keep/share page, each direct-link neighbour whose audio already feeds a meter.
    // Every capture cuts its own utterances; one shared queue hands them to
    // the provider one at a time.
    const wspCaps = new Map(); // 'me' | pid -> capture
    const wspQ = { items: [], busy: false, sent: 0, dropped: 0, behind: false, lastLatencyMs: 0 };
    // A loopback http(s) address names a server on this device; anything else is ''.
    function wspLocalUrl(raw) {
      let u; try { u = new URL(String(raw || '')); } catch (e) { return ''; }
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      const h = u.hostname.toLowerCase();
      const loop = h === 'localhost' || h === '[::1]' || h === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
      return loop && !u.username && !u.password ? u.href : '';
    }
    let wsp = null; // my own capture, by the name the older call sites use
    let wspPaused = false; // Whisper stood down (no browser speech engine to fall back to) until re-picked or CC is turned on
    // One way back into Whisper. Every caller (Retry, re-picking it, the
    // phone override, turning captions on, the bot) forgets the whole
    // stand-down, not only the sentence that explained it. It sits with the
    // pause flag, which is what those callers clear.
    function wspResume() {
      wspPaused = false;
      wspFailWhy = '';
      wspQ.stalls = 0;
      wspQ.behind = false;
      if (__C.myStatus.ccst === 'behind' || __C.myStatus.ccst === 'paused') delete __C.myStatus.ccst;
    }
    // The worklet posts 4096-sample chunks off the main thread. A ScriptProcessor
    // is the fallback when this context has no AudioWorklet yet, or the module failed.
    const WSP_WORKLET_JS = [
      'class WspCaptureProcessor extends AudioWorkletProcessor {',
      '  constructor() { super(); this.buf = new Float32Array(4096); this.n = 0; }',
      '  process(inputs) {',
      '    const ins = inputs[0] || [];',
      '    let ch = ins[0];',
      '    if (ch && ins.length > 1) { const m = new Float32Array(ch.length); for (const c of ins) for (let k = 0; k < m.length; k++) m[k] += c[k] / ins.length; ch = m; }',
      '    if (ch && ch.length) {',
      '      let i = 0;',
      '      while (i < ch.length) {',
      '        const take = Math.min(ch.length - i, 4096 - this.n);',
      '        this.buf.set(ch.subarray(i, i + take), this.n);',
      '        this.n += take; i += take;',
      '        if (this.n === 4096) {',
      '          const out = this.buf;',
      '          this.buf = new Float32Array(4096);',
      '          this.n = 0;',
      '          this.port.postMessage(out, [out.buffer]);',
      '        }',
      '      }',
      '    }',
      '    return true;',
      '  }',
      '}',
      "registerProcessor('wsp-capture', WspCaptureProcessor);"
    ].join('\n');
    let wspWorkletUrl = null;
    yield 2657;
    // The stage aux feed (mosIn 'stg:<id>') is the only audio a non-neighbour
    // stager still sends. Direct main audio is parked while they are on stage.
    function wspStageStream(id) {
      if (typeof __C.mosIn === 'undefined' || !__C.mosIn || !__C.mosIn.get) return null;
      const c = __C.mosIn.get('stg:' + id);
      const tr = c && c.stream && c.stream.getAudioTracks && c.stream.getAudioTracks()[0];
      return tr ? c.stream : null;
    }
    function wspStageSid(id) { const st = wspStageStream(id); return st ? (st.id || 'stg') : null; }
    // THE FAR-ROW MIX. A voice from another row reaches me
    // only inside the stadium mix. A keep/share page that has no source of its own for
    // a present person captures that mix as one more voice ('fold'), and its
    // lines are labelled by the CHANNEL they came on: "Stadium". Naming the
    // speaker inside a mix is later work (Nathan 2026-10-22 22:58).
    function wspFoldTracks() {
      const out = [], seen = new Set();
      if (typeof __V.stadiumEl === 'undefined' || !__V.stadiumEl || !__V.stadiumEl.querySelectorAll) return out;
      for (const v of __V.stadiumEl.querySelectorAll('.rowtile video')) {
        const st = (v._aud && v._aud.srcObject) || v.srcObject;
        const trs = (st && st.getAudioTracks) ? st.getAudioTracks() : [];
        for (const t of trs) if (t && t.readyState === 'live' && !seen.has(t.id)) { seen.add(t.id); out.push(t); }
      }
      return out;
    }
    function wspFoldSig() { return wspFoldTracks().map((t) => t.id).sort().join(','); }
    // Is anyone present that I hold no source for (a far-row voice)? all: a
    // voice someone else captions counts too (this page translates them all).
    function wspFoldNeeded(queued, all) {
      const now = Date.now();
      if (typeof __C.statusOf === 'undefined' || typeof __C.peers === 'undefined' || typeof __C.capCovered !== 'function') return false;
      for (const [pid, st] of __C.statusOf) {
        if (!st || (typeof __C.myId !== 'undefined' && pid === __C.myId) || st.muted || st.bot || queued.indexOf(pid) >= 0) continue;
        if (now - (st.rx || st.at || 0) > 15000) continue;
        const p = __C.peers.get(pid);
        if (p && p.connected && (0, /*()*/__C.wspSource)(pid)) continue;
        if (!all && (0, /*()*/__C.capCovered)(pid)) continue;
        return true;
      }
      return false;
    }
    function wspOnChunk(w, chunk) {
      const ms = chunk.length / w.rate * 1000, now = Date.now();
      // A stager's direct meter watches the parked main track, which is
      // silence. A capture on the stage feed gates on its own samples; a
      // row-mate keeps the meter verdict.
      let talking;
      if (w.stageSid || w.fold) {
        let acc = 0, n = 0;
        for (let i = 0; i < chunk.length; i += 8) { const x = chunk[i]; acc += x * x; n++; }
        talking = n > 0 && Math.sqrt(acc / n) > 0.04;
      } else talking = !!__C.speakingOf.get(w.id) || (w.id === 'me' && now - __C.myVoiceAt < 250);
      if (w.utt) {
        w.utt.push(chunk);
        if (talking) w.lastVoice = now;
        const secs = (now - w.uttStart) / 1000;
        if ((!talking && now - w.lastVoice > WSP_GAP_MS) || secs >= WSP_MAX_S) {
          const done = w.utt, at = w.uttStart; w.utt = null;
          if (secs >= WSP_MIN_S) wspEnqueue(w, done, at);
          if (secs >= WSP_MAX_S && talking) { w.utt = []; w.uttStart = now; w.lastVoice = now; }
        }
      } else if (talking) {
        w.utt = w.pre; w.pre = [];
        w.utt.push(chunk); w.uttStart = now - w.preMs; w.lastVoice = now; w.preMs = 0;
      } else {
        w.pre.push(chunk); w.preMs += ms;
        while (w.preMs > WSP_PRE_MS && w.pre.length > 1) { w.preMs -= w.pre[0].length / w.rate * 1000; w.pre.shift(); }
      }
    }
    function wspAttach(id, w, node, viaWorklet) {
      const prev = w.node;
      if (prev) {
        try { w.src.disconnect(prev); } catch (e) {}
        try { prev.disconnect(); } catch (e) {}
        prev.onaudioprocess = null;
        if (prev.port) prev.port.onmessage = null;
      }
      w.node = node;
      w.worklet = !!viaWorklet;
      if (viaWorklet) {
        node.port.onmessage = (ev) => {
          if (wspCaps.get(id) !== w || !(ev.data instanceof Float32Array)) return;
          wspOnChunk(w, ev.data);
        };
      } else {
        node.onaudioprocess = (e) => {
          if (wspCaps.get(id) !== w) return;
          const ib = e.inputBuffer, nc = ib.numberOfChannels || 1;
          const out = new Float32Array(ib.getChannelData(0)); // the browser reuses its buffer
          for (let c = 1; c < nc; c++) { const d = ib.getChannelData(c); for (let k = 0; k < out.length; k++) out[k] += d[k]; }
          if (nc > 1) for (let k = 0; k < out.length; k++) out[k] /= nc; // every channel, averaged
          wspOnChunk(w, out);
        };
      }
      w.src.connect(node);
      node.connect(__C.ac.destination); // the node only ticks while connected onward; both paths output silence
      wspCaps.set(id, w);
      if (id === 'me') wsp = w;
      (0, /*()*/__V.paintWspChip)(); // the way back is on screen the moment Whisper runs, not a tick later
    }
    function wspWorkletPending(ctx) {
      if (!ctx || ctx._wspWorkletBad || !ctx.audioWorklet || typeof ctx.audioWorklet.addModule !== 'function') return null;
      if (typeof AudioWorkletNode !== 'function') return null;
      if (ctx._wspWorklet) return ctx._wspWorklet;
      try {
        if (!wspWorkletUrl) wspWorkletUrl = URL.createObjectURL(new Blob([WSP_WORKLET_JS], { type: 'application/javascript' }));
        ctx._wspWorklet = ctx.audioWorklet.addModule(wspWorkletUrl).then(() => { ctx._wspWorkletOk = true; return true; }, () => false);
      } catch (e) { return null; }
      return ctx._wspWorklet;
    }
    function wspUseWorklet(id, w) {
      if (!__C.ac._wspWorkletOk || __C.ac._wspWorkletBad || typeof AudioWorkletNode !== 'function') return false;
      try {
        wspAttach(id, w, new AudioWorkletNode(__C.ac, 'wsp-capture'), true);
        return true;
      } catch (e) { __C.ac._wspWorkletBad = true; return false; }
    }
    function wspStart(id) {
      if (wspCaps.has(id)) return true;
      if (ccEngine() !== 'local' && !(0, /*()*/__C.whisperReady)()) { if (id === 'me') (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stWhisperCaptionsNeedTheOffline', 'Whisper captions need the Offline Captions app — open Settings → Captions to install it. Browser captions are on meanwhile.'), 10000); return false; }
      if (!(0, /*()*/__C.ensureAc)()) return false;
      let src = null, own = false, stageSid = null;
      const stg = wspStageStream(id);
      if (stg) {
        try {
          src = __C.ac.createMediaStreamSource(new MediaStream([stg.getAudioTracks()[0]]));
          own = true; stageSid = stg.id || 'stg';
        } catch (e) { src = null; stageSid = null; }
      }
      if (id === 'fold') {
        const trs = wspFoldTracks(); if (!trs.length) return false;
        try { const g = __C.ac.createGain(); for (const t of trs) __C.ac.createMediaStreamSource(new MediaStream([t])).connect(g); src = g; own = true; } catch (e) { return false; }
      }
      if (!src) src = (0, /*()*/__C.wspSource)(id);
      if (!src && id === 'me' && __C.localStream && __C.localStream.getAudioTracks()[0]) {
        try { src = __C.ac.createMediaStreamSource(new MediaStream([__C.localStream.getAudioTracks()[0]])); own = true; } catch (e) { return false; }
      }
      // The bot's microphone is muted silence. The words it speaks go out on
      // botVoiceTrack. A capture that kept the mic would write Whisper's
      // silence phrases ("you", "I'm sorry.", "BEEP") over the whole line.
      if (id === 'me' && botVoiceTrack && botVoiceTrack.readyState === 'live') {
        try { src = __C.ac.createMediaStreamSource(new MediaStream([botVoiceTrack])); own = true; stageSid = null; } catch (e) { /* keep the mic */ }
      }
      if (!src) return false;
      const w = { id, src, node: null, own, rate: __C.ac.sampleRate, stageSid, pre: [], preMs: 0, utt: null, uttStart: 0, lastVoice: 0, worklet: false };
      if (id === 'fold') { w.fold = true; w.foldSig = wspFoldSig(); }
      if (wspUseWorklet(id, w)) return true;
      let node;
      try { node = __C.ac.createScriptProcessor(4096, 1, 1); } catch (e) { return false; }
      wspAttach(id, w, node, false);
      const pending = wspWorkletPending(__C.ac);
      if (pending && typeof pending.then === 'function') {
        pending.then((ok) => {
          if (!ok || __C.ac._wspWorkletBad || wspCaps.get(id) !== w || w.worklet) return;
          wspUseWorklet(id, w);
        });
      }
      return true;
    }
    function wspStop(id) {
      const w = wspCaps.get(id); if (!w) return;
      wspCaps.delete(id); if (id === 'me') wsp = null;
      (0, /*()*/__V.paintWspChip)();
      if (w.node) {
        w.node.onaudioprocess = null;
        if (w.node.port) w.node.port.onmessage = null;
        try { w.src.disconnect(w.node); } catch (e) {}
        try { w.node.disconnect(); } catch (e) {}
      }
      if (w.own) { try { w.src.disconnect(); } catch (e) {} }
    }
    // A meter was rebuilt (camera flip, mic mode, a peer's stream re-claimed):
    // the capture on it holds a disconnected source and never ticks again.
    // Stop it and let the want set re-start it on the fresh node.
    function wspRebind(id) {
      if (!wspCaps.has(id)) return;
      wspStop(id);
      wspSync();
    }
    function startWhisper() { return !wspPaused && wspStart('me'); }
    function stopWhisper() { for (const id of Array.from(wspCaps.keys())) wspStop(id); wspQ.items.length = 0; }
    // How much VOICE a clip holds: 20 ms frames at speech level (an RMS above
    // WSP_VOICE_RMS on the 16 kHz samples). Whisper asked about a clip with no
    // voice in it invents words ("Amen.", "Thank you."); the clip's own
    // samples, never the words, say whether anyone spoke.
    const WSP_VOICE_RMS = 0.01, WSP_VOICE_FRAMES = 5;
    function wspVoiceFrames(pcm, rate) {
      const n = Math.max(1, Math.round((rate || 16000) / 50));
      let frames = 0;
      for (let i = 0; i + n <= pcm.length; i += n) {
        let acc = 0; for (let j = i; j < i + n; j++) acc += pcm[j] * pcm[j];
        if (Math.sqrt(acc / n) > WSP_VOICE_RMS) frames++;
      }
      return frames;
    }
    function wspPcm16k(chunks, rate) { // concatenate, then a box-filter resample to 16 kHz
      let n = 0; for (const c of chunks) n += c.length;
      const all = new Float32Array(n); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
      if (rate === 16000) return all;
      const ratio = rate / 16000, outN = Math.floor(n / ratio), out = new Float32Array(outN);
      for (let i = 0; i < outN; i++) { const a = Math.floor(i * ratio), b = Math.max(a + 1, Math.floor((i + 1) * ratio)); let sum = 0; for (let j = a; j < b; j++) sum += all[j]; out[i] = sum / (b - a); }
      return out;
    }
    // 'tiny' on a phone, a weak device, or 4 cores or fewer (a Pi running base
    // falls behind and the queue used to give up). gifos_cc_whisper_model
    // ('tiny'|'base'|'small') wins. typeof: a lifted queue has no WSP_WEAK.
    function wspModel() {
      let pick = '';
      try { pick = String((0, /*()*/__C.lsGet)('gifos_cc_whisper_model') || ''); } catch (e) {}
      if (pick === 'tiny' || pick === 'base' || pick === 'small') return pick;
      if (typeof WSP_WEAK !== 'undefined' && WSP_WEAK) return 'tiny';
      if (typeof whisperWeakWhy === 'function') {
        try { if (whisperWeakWhy(typeof navigator !== 'undefined' ? navigator : {})) return 'tiny'; } catch (e) {}
      }
      const cores = (typeof navigator !== 'undefined' && navigator) ? (Number(navigator.hardwareConcurrency) || 0) : 0;
      if (cores > 0 && cores <= 4) return 'tiny';
      return 'base';
    }
    // Real utterances are stamped Date.now() (~1e12). A unit lift's placeholder
    // (at: 1234) is not wall-clock and must not be treated as half an hour old.
    function wspAged(job, now) {
      const at = job && job.at;
      return typeof at === 'number' && at > 1e12 && (now || Date.now()) - at > 30000;
    }
    function wspMarkBehind() {
      wspQ.behind = true;
      if (typeof __C.myStatus !== 'undefined' && __C.myStatus && __C.myStatus.ccst !== 'paused') __C.myStatus.ccst = 'behind';
      try { if (typeof __C.updateTile === 'function') (0, /*()*/__C.updateTile)('me'); } catch (e) {}
      try { if (typeof __C.broadcastStatus === 'function') (0, /*()*/__C.broadcastStatus)(); } catch (e) {}
    }
    function wspEnqueue(w, chunks, at, rate, keep) {
      const now = Date.now();
      for (let i = wspQ.items.length - 1; i >= 0; i--) {
        // wspAged is a no-op in a lift that cut this function out on its own.
        if (typeof wspAged === 'function' && wspAged(wspQ.items[i], now)) {
          wspQ.items.splice(i, 1);
          wspQ.dropped++;
          if (typeof wspMarkBehind === 'function') wspMarkBehind();
          (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stCaptionsBehindSkippingOldAudio', 'Captions behind, skipping old audio'), 8000);
        }
      }
      const cap = WSP_BACKLOG + 2 * Math.max(0, wspCaps.size - 1);
      if (wspQ.items.length >= cap) {
        const i = wspQ.items.findIndex((j) => !j.keep); // the oldest ordinary clip goes; a kept one (a test feed) never does
        if (i >= 0) {
          wspQ.items.splice(i, 1);
          wspQ.dropped++;
          if (typeof wspMarkBehind === 'function') wspMarkBehind();
          (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stCaptionsBehindSkippingOldAudio', 'Captions behind, skipping old audio'), 8000);
        }
      }
      // A clip at a rate no microphone runs at (8 to 192 kHz) would be
      // resampled into nonsense: dropped at the input, never transcribed.
      const jr = rate || w.rate;
      if (!(jr >= 8000 && jr <= 192000)) { wspQ.dropped++; if (__C.clog) (0, /*()*/__C.clog)('wsp bad rate', w.id, jr); return; }
      const job = { id: w.id, chunks, at, rate: jr, keep: !!keep, stage: !!w.stageSid };
      if (keep) wspQ.items.unshift(job); else wspQ.items.push(job);
      wspDrain();
    }
    // A missing app stays missing: drop the stale stt assignment and the engine
    // choice once, then let the browser engine carry the meeting.
    // The cleanup is one-shot; the fallback runs every time, so a later call
    // that finds the app gone still hands captions to the browser engine.
    function wspProviderGone() {
      if (!wspQ.providerGone) {
        wspQ.providerGone = true;
        try {
          const cfg = JSON.parse(localStorage.getItem('gifos_ai_config') || '{}') || {};
          if (cfg && typeof cfg === 'object' && cfg.stt) {
            delete cfg.stt;
            localStorage.setItem('gifos_ai_config', JSON.stringify(cfg));
          }
        } catch (e) {}
        try { (0, /*()*/__C.lsSet)(CC_ENGINE_KEY, ''); } catch (e) {}
        (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stWhisperAppMissingBrowserCaptions', 'Whisper app missing — browser captions on'), 10000);
      }
      try { stopWhisper(); } catch (e) {}
      try { syncSpeech(); } catch (e) {}
      try { (0, /*()*/__V.paintCcState)(); } catch (e) {}
    }
    // msg / pausedMsg: what the status line says when the browser engine takes
    // over, or when there is none (defaults: Whisper stalled, Captions paused).
    function wspStallGiveUp(msg, pausedMsg) {
      if (wspPaused) return;
      wspPaused = true;
      wspQ.behind = false;
      if (typeof __C.myStatus !== 'undefined' && __C.myStatus) __C.myStatus.ccst = 'paused';
      try { stopWhisper(); } catch (e) {}
      wspRelease();
      // A headless bot has a window and no SpeechRecognition. Falling through
      // to the browser engine leaves the chip saying "transcribing" while
      // nothing is written. Stay paused and say so.
      const hasWindow = typeof window === 'object' && !!window;
      const hasSr = hasWindow && (window.SpeechRecognition || window.webkitSpeechRecognition);
      try { if (typeof __C.updateTile === 'function') (0, /*()*/__C.updateTile)('me'); } catch (e) {}
      try { if (typeof __C.broadcastStatus === 'function') (0, /*()*/__C.broadcastStatus)(); } catch (e) {}
      if (hasWindow && !hasSr) { (0, /*()*/__C.setStatus)(pausedMsg || (0, /*()*/__C.uiText)('stCaptionsPaused', 'Captions paused'), 10000); return; }
      try { syncSpeech(); } catch (e) {}
      (0, /*()*/__C.setStatus)(msg || (0, /*()*/__C.uiText)('stWhisperCaptionsStalledBrowserCaptions', 'Whisper captions stalled — browser captions are on.'), 10000);
    }
    // Unload the speech-to-text provider: a clip it is still working on, or a
    // model it is still loading, stops now instead of finishing for nobody.
    // GifOS is in scope on the page and in the queue lift; window.GifOS is the
    // same object when this runs in the browser.
    function wspRelease() {
      if (ccEngine() === 'local') __C.ccLocalQ.close();
      try {
        const g = (typeof GifOS !== 'undefined' && GifOS && GifOS.providers) ? GifOS
          : (typeof window === 'object' && window && window.GifOS && window.GifOS.providers ? window.GifOS : null);
        if (g && typeof g.providers.stop === 'function') g.providers.stop('stt');
      } catch (e) {}
    }
    // THE WAY BACK. One tap, from the meeting itself or from the guard below:
    // browser captions take over at once, Whisper stops listening and its
    // provider is unloaded. The choice is saved, so the next meeting starts
    // with browser captions too.
    function wspToBrowser(say) {
      (0, /*()*/__C.lsSet)(CC_ENGINE_KEY, '');
      speechGaveUp = false;
      try { stopWhisper(); } catch (e) {}
      wspRelease();
      try { (0, /*()*/__V.paintCcState)(); } catch (e) {}
      try { syncSpeech(); } catch (e) {}
      if (say) (0, /*()*/__C.setStatus)(say, 10000);
    }
    function wspDrain() {
      if (wspQ.busy || !wspQ.items.length) return;
      const job = wspQ.items.shift();
      if (!wspCaps.has(job.id)) { wspDrain(); return; } // its voice left while it waited
      wspQ.busy = true;
      const pcm = wspPcm16k(job.chunks, job.rate);
      job.voiced = wspVoiceFrames(pcm, 16000);
      // My own voice: the picker (auto = let Whisper find it). Another voice:
      // the language its page advertises, else found by Whisper. A mix: found.
      // Whisper finds the language itself: a person may switch languages, and
      // detection is what Whisper is here for. Only the picker tells it one
      // (my own voice). A cut that continues the previous cut of the same
      // capture (under 1.5 s of gap) keeps that cut's language: nobody
      // switches language mid-sentence, and a short tail detected on its own
      // comes out as anything, translated.
      // A second pass of a clip (this page's English translation of my own
      // words, after they went to the room) is told the language the first found.
      const told = job.told || '';
      const cap0 = wspCaps.get(job.id);
      const cont = (!told && cap0 && cap0.lastLang && cap0.lastEnd && job.at - cap0.lastEnd < 1500) ? cap0.lastLang : '';
      const contFound = told ? !!job.found : !!(cont && cap0.lastFound); // the inherited language was found by Whisper on the previous cut
      const local = ccEngine() === 'local';
      const lang = local ? __C.ccLocalQ.lang() : (told || cont || (job.id === 'me' ? ((0, /*()*/__C.lsGet)(__C.CC_LANG_KEY) || 'auto') : 'auto'));
      // Translating, my own voice is transcribed first while I send my captions
      // (the room's line goes out as soon as it would without translating),
      // and every other voice is translated.
      // The on-device engine only transcribes: its line is in the language it heard, never a translation.
      const task = local ? 'transcribe' : (job.task || (__C.trEnOn && !(job.id === 'me' && (0, /*()*/__C.capSend)()) ? 'translate' : 'transcribe'));
      let model = 'base';
      if (typeof wspModel === 'function') {
        const picked = wspModel();
        if (picked === 'tiny' || picked === 'base' || picked === 'small') model = picked;
      }
      const req = { bytes: pcm.buffer, mime: 'audio/pcm;rate=16000;bits=32', language: lang === 'auto' ? 'auto' : lang,
        task: task, prompt: (0, /*()*/__C.lsGet)(CC_WORDS_KEY).slice(0, 400), model: model };
      wspQ.sent++;
      let done = false, abandoned = false;
      const t0 = Date.now();
      // Busy stays true until THIS call answers, errors, or hits the hard cap.
      // A soft timeout must not clear it: the provider runs one call at a time,
      // and starting the next one makes that call time out too.
      const release = () => {
        if (done) return;
        done = true;
        if (softTimer) clearTimeout(softTimer);
        if (hardTimer) clearTimeout(hardTimer);
        // A device that runs Whisper only by override rests as long as the clip
        // took before the next one, so inference holds at most half its processor.
        const rest = (typeof WSP_WEAK !== 'undefined' && WSP_WEAK && !local) ? Math.min(10000, Date.now() - t0) : 0;
        const go = () => {
          wspQ.busy = false;
          if (!wspQ.items.length && !wspPaused) {
            wspQ.behind = false;
            if (typeof __C.myStatus !== 'undefined' && __C.myStatus && __C.myStatus.ccst === 'behind') delete __C.myStatus.ccst;
          }
          wspDrain();
        };
        if (rest < 50) go();
        else setTimeout(go, rest);
      };
      const clipMs = pcm.length / 16; // 16 kHz samples → milliseconds
      // Until the provider first answers, a call can carry the one-time model
      // download (tens of MB): the soft budget and the hard cap both allow 180 s.
      const warm = !!wspQ.answered;
      const softMs = warm ? clipMs * 4 + 10000 : Math.max(clipMs * 4 + 10000, 180000);
      const hardMs = Math.max(clipMs * 8, 120000, warm ? 0 : 180000);
      // A speech server the person runs themselves answers in place of the
      // provider app, but only on THIS device (a loopback address): Whisper
      // is offered as keeping the voice here, so the clip is never posted to
      // another machine. Any other address is ignored and the app answers.
      let url = '';
      try { url = wspLocalUrl((0, /*()*/__C.lsGet)('gifos_cc_stt_url')); } catch (e) {}
      const remote = !!url && typeof fetch === 'function' && !local;
      let pending;
      if (local) {
        // On a phone: the on-device engine in this browser (opened, and the
        // first time downloaded, on demand).
        pending = __C.ccLocalQ.run(pcm, lang);
      } else if (remote) {
        const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
        pending = fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'audio/pcm;rate=16000;bits=32' },
          body: pcm,
          signal: ctrl ? ctrl.signal : undefined,
        }).then((res) => (res && typeof res.json === 'function' ? res.json() : {})).then((j) => ({ text: j && j.text ? String(j.text) : '' }));
        pending.abort = () => { try { if (ctrl) ctrl.abort(); } catch (e) {} };
      } else {
        pending = GifOS.providers.call('stt', req);
      }
      let softTimer = setTimeout(() => {
        softTimer = null;
        if (done) return;
        // Behind, not paused: drop audio that is already too old to be worth
        // transcribing, and say so. The in-flight call keeps the queue.
        const now = Date.now();
        for (let i = wspQ.items.length - 1; i >= 0; i--) {
          if (typeof wspAged === 'function' && wspAged(wspQ.items[i], now)) {
            wspQ.items.splice(i, 1);
            wspQ.dropped++;
          }
        }
        const cap = (typeof WSP_BACKLOG === 'number' ? WSP_BACKLOG : 3) + 2 * Math.max(0, wspCaps.size - 1);
        while (wspQ.items.length > cap) {
          const i = wspQ.items.findIndex((j) => !j.keep);
          if (i < 0) break;
          wspQ.items.splice(i, 1);
          wspQ.dropped++;
        }
        if (typeof wspMarkBehind === 'function') wspMarkBehind();
        else wspQ.behind = true;
        (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stCaptionsBehindSkippingOldAudio', 'Captions behind, skipping old audio'), 8000);
      }, softMs);
      let hardTimer = setTimeout(() => {
        hardTimer = null;
        if (done) return;
        abandoned = true;
        // The provider never answered. Unload it so the next clip starts clean.
        wspRelease();
        try { if (pending && typeof pending.abort === 'function') pending.abort(); } catch (e) {}
        release();
      }, hardMs);
      pending.then((r) => {
        if (abandoned) return;
        wspQ.answered = true; // a late answer still proves the model is loaded
        if (done) return;
        wspQ.stalls = 0;
        wspQ.lastLatencyMs = Math.max(0, Date.now() - t0);
        let text = r && r.text ? String(r.text).trim() : '';
        if (text && GifOS.meetHost && typeof GifOS.meetHost.dropWhisperNoise === 'function') text = GifOS.meetHost.dropWhisperNoise(text);
        // Words answered for a clip that held no voice are Whisper's own: dropped
        // by the audio, never by what the words are (a real "Thank you." stays).
        if (text && (job.voiced || 0) < WSP_VOICE_FRAMES) { if (__C.clog) (0, /*()*/__C.clog)('wsp hallucination', job.id, job.voiced, text.slice(0, 30)); text = ''; }
        if (text && wspCaps.has(job.id)) {
          // ld only when Whisper was asked to FIND the language: told a
          // language, it echoes it back, and told the wrong one for the
          // audio it writes a translation; neither is a detection.
          // ld only when Whisper was asked to FIND the language, or this cut
          // continues one where it did: told a language, it echoes it back,
          // and told the wrong one for the audio it writes a translation.
          const found = (lang === 'auto' && !told) || contFound;
          const wEng = ccEngine() === 'local' ? 'local' : 'whisper'; // the engine this clip ran on (the phone model, or Whisper)
          const rl = lang === 'auto' ? ((r && r.language) ? String(r.language) : '') : lang;
          const capNow = wspCaps.get(job.id);
          if (capNow) { capNow.lastEnd = job.at + clipMs; if (rl) { capNow.lastLang = rl; capNow.lastFound = found; } }
          const end = job.at + clipMs; // the clip's span: a mix clip opens with the first voice in it, so its start says little
          // A translate answer is English. Spoken in English, it is the
          // speaker's own words; otherwise it is a translation (tl), and the
          // language Whisper found is the speaker's, not the line's.
          const translated = task === 'translate';
          const own = !translated || (0, /*()*/__C.trLangOf)(rl) === 'en';
          const ll = translated ? 'en' : rl, lf = own && found, how = own ? '' : 'tl';
          if (job.id === 'me') {
            if (job.lo || (translated && !own)) (0, /*()*/__C.addTranscriptLine)(text, job.at, null, null, 'mic', 'en', false, end, 'lo', { eng: wEng, inp: 'track' }); // my words in English, for this page only
            else if (!__C.trEnOn || local || (0, /*()*/__C.trLangOf)(rl) === 'en') (0, /*()*/__C.addTranscriptLine)(text, job.at, null, null, 'mic', ll, lf, end, '', { eng: wEng, inp: 'track' }); // the on-device engine cannot translate: one line, in the language heard
            else {
              // My own words go to the room in my language; this page shows
              // them in English: the same clip once more, told the language
              // just found, translated. It goes first.
              (0, /*()*/__C.addTranscriptLine)(text, job.at, null, null, 'mic', rl, found, end, 'out', { eng: wEng, inp: 'track' });
              wspQ.items.unshift({ id: 'me', chunks: job.chunks, at: job.at, rate: job.rate, keep: job.keep, task: 'translate', lo: true, told: rl || '', found: found });
            }
          }
          else if (job.id === 'fold') { if ((0, /*()*/__C.trWrites)() || __C.trEnOn) (0, /*()*/__C.addTranscriptLine)(text, job.at, 'stadium', 'Stadium', 'mix', ll, lf, end, how, { eng: wEng, inp: 'rx' }); }   // a far-row line, labelled by its channel
          else if ((0, /*()*/__C.capEarsOnly)() && (__C.peers.has(job.id) || job.stage) && __C.capTrust.stateOf(job.id, job.id) !== 'distrusted' && __C.capTrust.choice(job.id).lean !== 'me') {
            // ears only: a sample for the trust check, not a line
            __C.capTrust.observe({ byId: job.id, w: __C.myId, src: 'ear', eng: wEng, at: job.at, end, text, tl: how === 'tl' ? 1 : 0 });
          }
          else if (((0, /*()*/__C.trWrites)() || __C.trEnOn || (0, /*()*/__C.capEarsOnly)()) && (__C.peers.has(job.id) || job.stage)) (0, /*()*/__C.addTranscriptLine)(text, job.at, job.id, null, 'ear', ll, lf, end, how, { eng: wEng, inp: 'rx' });
        }
        if (!wspQ.items.length && __C.myStatus && __C.myStatus.ccst === 'behind') {
          wspQ.behind = false;
          delete __C.myStatus.ccst;
        }
      }).catch((e) => {
        if (done || abandoned) return;
        const msg = (e && e.message) || String(e);
        if (/PROVIDER_STOPPED|AbortError/.test(msg)) return; // unloaded on purpose
        if (local) { __C.ccLocalQ.failed(msg); return; }
        if (/NOT_CONFIGURED|PROVIDER_MISSING|PROVIDER_NOT_IN_FOLDER/.test(msg)) { wspProviderGone(); return; }
        // The model could not be downloaded (its host is down, or this device
        // is offline): browser captions take over for this meeting. The choice
        // stays Whisper, so picking it again, or the next meeting, tries again.
        if (/could not be downloaded|Asset not available|download failed/i.test(msg)) {
          wspFailWhy = (0, /*()*/__C.uiText)('wspErrModel', 'its model could not be downloaded');
          wspStallGiveUp((0, /*()*/__C.uiText)('stWhisperModelFailedBrowserCaptions', 'Whisper couldn’t load its model — browser captions are on.'),
            (0, /*()*/__C.uiText)('stWhisperModelFailedPaused', 'Whisper couldn’t load its model — captions paused.'));
          return;
        }
        (0, /*()*/__C.setStatus)('Whisper captions failed: ' + msg.slice(0, 160), 10000);
      }).then(() => { if (!done) release(); });
    }
    yield 2687;
    // Translating everything to English, the page hears EVERY voice through
    // its own Whisper: my own (even with Send off, for my own captions),
    // every first-hand voice whether captioned or not, and the Stadium mix
    // whenever a present voice reaches me only there. No cap: a capture costs
    // only while its voice speaks; the one queue carries the real work.
    // TRANSLATE EVERYTHING TO ENGLISH (Settings → Captions). Only Whisper
    // translates, so the setting is live while Whisper is this page's engine
    // and running. Then this page translates every voice it hears, and its
    // captions and transcript hold English lines only: lines sent in English,
    // and its own translations. What it sends stays in the speaker's language.
    function trEn() { return (0, /*()*/__C.lsGet)(CC_TRANSLATE_KEY) === '1' && ccEngine() === 'whisper' && (0, /*()*/__C.whisperReady)() && !wspPaused; }
    function trEnSync() {
      const on = trEn();
      if (on && !__C.trEnOn) { __C.trEnOn = true; (0, /*()*/__C.trEnOnlyEnglish)(); }
      __C.trEnOn = on;
      return on;
    }
    function wspSync() {
      const want = new Set();
      const en = __C.trEnOn;
      const me = ((0, /*()*/__C.capSend)() || en) && ((ccEngine() === 'whisper' && (0, /*()*/__C.whisperReady)()) || (ccEngine() === 'local' && !__C.ccLocalQ.blocked())) && !__C.myStatus.muted;
      if (!wspPaused && me) want.add('me');
      // The on-device engine (an Android phone) writes the voices nobody
      // captions, as the browser engine's room ear does on other devices: one
      // model, one language, so a voice its own page captions is left to it.
      const localEar = ccEngine() === 'local' && !__C.ccLocalQ.blocked() && (0, /*()*/__C.trWrites)();
      const earsOnly = (0, /*()*/__C.capEarsOnly)();
      if (!wspPaused && ((((0, /*()*/__C.trWrites)() || en) && ccEngine() === 'whisper' && (0, /*()*/__C.whisperReady)()) || localEar || earsOnly)) {
        const stagers = (typeof __C.stageIds === 'function') ? (0, /*()*/__C.stageIds)() : [];
        const stageSet = new Set(stagers);
        const talking = (pid) => (typeof __C.speakingOf !== 'undefined' && __C.speakingOf && __C.speakingOf.get(pid));
        const queued = [];
        const consider = (pid) => {
          if (!pid || (typeof __C.myId !== 'undefined' && pid === __C.myId) || queued.indexOf(pid) >= 0) return;
          const st = __C.statusOf.get(pid) || {};
          if (st.muted || st.bot || ((0, /*()*/__C.modOf)(pid).mute && (0, /*()*/__C.modOf)(pid).mute.on)) return;
          // The on-device ears leave a voice its own page captions (cap 1) to that page, except a voice whose own
          // captions this page distrusts, or that its user put on this device's ears: those
          // are heard full time, so the page shows what was really said and sees
          // when the speaker's captions come right again (then trust returns and the page goes back to them).
          if (localEar && (0, /*()*/__C.capCovered)(pid) && !(__C.capTrust && (__C.capTrust.stateOf(pid, pid) === 'distrusted' || __C.capTrust.choice(pid).lean === 'me'))) return;
          // Ears only listen to voices someone else captions (that is what they check), and a voice whose own
          // captions are trusted only during a spot check.
          if (earsOnly && !(0, /*()*/__C.capCovered)(pid) && !(__C.capTrust && __C.capTrust.choice(pid).lean === 'me')) return;
          if (__C.capTrust && !en && !__C.capTrust.earWanted(pid)) return;
          const p = __C.peers.get(pid);
          const onStage = stageSet.has(pid) && !!wspStageSid(pid);
          if (!onStage && !(p && p.connected && (0, /*()*/__C.wspSource)(pid))) return;
          queued.push(pid);
        };
        for (const pid of stagers) consider(pid);
        for (const [pid, p] of __C.peers) if (p && p.connected) consider(pid);
        // A voice nobody captions first, then the Stage, then a talking voice
        // ahead of a silent one. The cap used to keep whoever was inserted
        // into peers first, so eight silent row-mates filled it.
        const key = (a) => ((0, /*()*/__C.capCovered)(a) ? 4 : 0) + (stageSet.has(a) ? 0 : 2) + (talking(a) ? 0 : 1);
        queued.sort((a, b) => key(a) - key(b));
        if (earsOnly && __C.capTrust) (0, /*()*/__C.capSpotQueue)(queued, talking);
        const max = en ? Infinity : WSP_SCRIBE_MAX;
        let others = 0; // WSP_SCRIBE_MAX other voices, with or without my own capture
        for (const pid of queued) {
          if (others >= max) break;
          want.add(pid); others++;
        }
        if (!earsOnly && others < max && wspFoldNeeded(queued, en) && wspFoldTracks().length) want.add('fold');
      }
      for (const id of Array.from(wspCaps.keys())) if (!want.has(id)) wspStop(id);
      for (const id of want) {
        const cap = wspCaps.get(id);
        const sid = wspStageSid(id);
        if (cap && (cap.stageSid || null) !== (sid || null)) wspStop(id);
        else if (cap && cap.fold && cap.foldSig !== wspFoldSig()) wspStop(id);   // the mix's tracks changed: capture the new ones
        if (!wspCaps.has(id)) wspStart(id);
      }
      (0, /*()*/__C.capPublish)();
    }
    // The 2 s tick keeps the captures and the room ear in step with who is
    // here, muted, on the Stage or captioned, and the mark with the engine.
    // The room ear follows the voices: it stops when the mix empties and
    // starts when a voice appears (syncSpeech decides on the mix's size).
    function earTick() {
      if (ccEngine() === 'local') return;
      if (ccMix.dest) { ccMixSync(); if (!ccMix.ins.size) syncSpeech(); return; }
      if ((0, /*()*/__C.trWrites)() && !(ccEngine() === 'whisper' && (0, /*()*/__C.whisperReady)()) && !(speech && speech.input) && ccEarMayRun() && ccMixVoices().size) syncSpeech();
    }
    setInterval(() => { trEnSync(); if (wspCaps.size || __C.trEnOn || (0, /*()*/__C.capEarsOnly)() || ((0, /*()*/__C.trWrites)() && ((ccEngine() === 'whisper' && (0, /*()*/__C.whisperReady)()) || ccEngine() === 'local'))) wspSync(); earTick(); (0, /*()*/__C.trForget)(); (0, /*()*/__V.paintTxMark)(); if (__C.capTrust) { __C.capTrust.tick(); (0, /*()*/__V.capCardRefresh)(); } }, 2000);
    // ONE TAP TO INSTALL. The provider is a signed 13 MB GIF on this very site:
    // GifOS.providers.install downloads, checks the catalog hash and the
    // gifos.app signature, files it into the Providers folder and we assign it
    // — no store tab, no Home Screen visit. The same path runs by itself,
    // quietly, the first time a meeting is up on a computer that lacks it
    // (WHISPER_SEED_KEY), so the app is simply there when someone picks it.
    let whisperInstalling = null;
    // The install's progress and its last failure, kept so every repaint shows
    // them (a note written into the panel was wiped by the next paint, and a
    // 404 reached nobody but the console).
    const wspInst = { note: '', frac: null, err: '' };
    function installWhisper(say) {
      if (whisperInstalling) return whisperInstalling;
      const st = (typeof wspInst === 'object' && wspInst) || {};
      st.err = ''; st.note = ''; st.frac = null;
      const note = (t, f) => {
        st.note = t || ''; st.frac = typeof f === 'number' && isFinite(f) ? f : null;
        const el = document.getElementById('ccwhisper-prog'); if (el) el.textContent = t || '';
      };
      whisperInstalling = GifOS.providers.install(WHISPER_APP_ID, (t, f) => note(t, f)).then((p) => {
        if (!GifOS.providers.assigned('stt')) GifOS.providers.assign('stt', p);
        (0, /*()*/__C.lsSet)(WHISPER_SEED_KEY, 'done');
        if (say) (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stOfflineCaptionsWhisperIsInstalled', '✅ Offline Captions (Whisper) is installed and ready — the model itself downloads once from gifos.app the first time captions run.'), 10000);
        return p;
      }).catch((e) => {
        const msg = (e && e.message) || String(e);
        note('⚠ ' + msg); (0, /*()*/__C.lsSet)(WHISPER_SEED_KEY, 'tried:' + Date.now());
        // A fetch that never reached the server says "Failed to fetch": name it.
        st.err = /failed to fetch|networkerror|load failed|network/i.test(msg) ? (0, /*()*/__C.uiText)('wspErrNetwork', 'network error, check the connection') : msg.slice(0, 160);
        if (say) (0, /*()*/__C.setStatus)('Could not install Whisper captions: ' + msg.slice(0, 160), 10000);
        throw e;
      }).then((p) => { whisperInstalling = null; (0, /*()*/__V.paintCcState)(); syncSpeech(); return p; }, (e) => { whisperInstalling = null; (0, /*()*/__V.paintCcState)(); throw e; });
      return whisperInstalling;
    }
    let whisperRescan = null;
    const WSP_RESCAN_MAX = GifOS.timings.WSP_RESCAN_MAX; // a missing app is not a reason to scan the folder for the whole meeting
    function armWhisperRescan() { // opening Settings arms another bounded look; the install button has its own promise
      if (whisperRescan) return;
      let attempts = 0;
      whisperRescan = setInterval(() => {
        if (++attempts > WSP_RESCAN_MAX || (0, /*()*/__C.whisperReady)() || ccEngine() !== 'whisper' || !window.GifOS || !GifOS.providers) { clearInterval(whisperRescan); whisperRescan = null; return; }
        GifOS.providers.scan().then((list) => {
          const hit = list.find((p) => p.roles.indexOf('stt') >= 0 && p.appId === WHISPER_APP_ID) || list.find((p) => p.roles.indexOf('stt') >= 0);
          if (!hit) return;
          GifOS.providers.assign('stt', hit);
          clearInterval(whisperRescan); whisperRescan = null;
          (0, /*()*/__V.paintCcState)(); syncSpeech();
          (0, /*()*/__C.setStatus)('✅ ' + hit.name + ' found in your Providers folder — Whisper captions are ready.', 8000);
        }).catch(() => {});
      }, 4000);
    }
    // The GifOS Meet apps (Android, iPhone) run captions on the phone itself (its own speech engine stands in for the
    // browser's): that is the only engine, it sends no voice anywhere, and Whisper is not offered.
    function phoneCaptions() {
      try { const N = window.GifosNative; return !!(N && N.info && N.info().captions === 'device'); } catch (e) { return false; }
    }
    yield 2702;
    function whisperSeedBlocked() {
      // A phone or a weak computer, a data-saver flag, or a cellular link does not fetch the 13 MB app on its own.
      if (__C.IS_MOBILE || WSP_WEAK) return true;
      const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (c && (c.saveData || c.type === 'cellular' || c.type === 'wimax')) return true;
      return false;
    }
    // WHISPER'S STATE, said plainly: a person must be able to tell whether
    // Whisper runs on this browser, and if not, why. Exactly one of: missing, installing,
    // downloading (its model), ready, unsupported, failed (the install, or the
    // model / a stall in this meeting, with Retry). Whisper is "chosen" by the
    // saved choice, so a device where it cannot run still says why.
    let wspFailWhy = ''; // why Whisper stood down in this meeting
    const whisperChosen = () => (0, /*()*/__C.lsGet)(CC_ENGINE_KEY) === 'whisper';
    function wspState() {
      if (!whisperSupported()) return { k: 'unsupported' };
      if (whisperInstalling) return { k: 'installing', frac: wspInst.frac };
      if (!(0, /*()*/__C.whisperReady)()) return wspInst.err ? { k: 'failed', at: 'install', why: wspInst.err } : { k: 'missing' };
      if (wspPaused) return { k: 'failed', at: 'run', why: wspFailWhy || (0, /*()*/__C.uiText)('wspErrStalled', 'it fell behind the call') };
      const b = wspCaps.size && !wspQ.answered && window.GifOS && GifOS.providerBusy ? GifOS.providerBusy.state : null;
      if (b) return { k: 'downloading', frac: b.frac };
      return { k: 'ready' };
    }
    function wspStateText(s) {
      if (s.k === 'unsupported') return (0, /*()*/__C.uiText)('wspStUnsupported', 'Whisper: not supported on this browser');
      if (s.k === 'installing') return (0, /*()*/__C.uiText)('wspStInstalling', 'Whisper: installing…') + (s.frac != null ? ' (' + Math.round(s.frac * 100) + '%)' : '');
      if (s.k === 'downloading') return s.frac != null ? (0, /*()*/__C.uiText)('wspStDownloading', 'Whisper: downloading model ({n}%)').replace('{n}', Math.round(s.frac * 100)) : (0, /*()*/__C.uiText)('wspStLoading', 'Whisper: downloading model…');
      if (s.k === 'ready') return (0, /*()*/__C.uiText)('wspStReady', 'Whisper: ready');
      if (s.k === 'failed') return (s.at === 'install' ? (0, /*()*/__C.uiText)('wspStInstallFailed', 'Whisper: install failed: {why}') : (0, /*()*/__C.uiText)('wspStStopped', 'Whisper stopped: {why}')).replace('{why}', s.why);
      return (0, /*()*/__C.uiText)('wspStMissing', 'Whisper not installed');
    }
    // Which captions this device writes right now: Whisper, the browser's, or none.
    function capsRunningNow() {
      if (wspCaps.size) return 'whisper';
      if (speechRunning()) return 'browser';
      if (browserCaptionsMissing()) return 'none';
      return (((0, /*()*/__C.capSend)() && !__C.myStatus.muted) || (0, /*()*/__C.trWrites)()) ? 'browser' : 'none';
    }
    const wspWorking = (k) => k === 'ready' || k === 'downloading';
    let wspStSig = '';
    yield 2711;
    // The page boots in steps, and the captions engines it reads are declared
    // further down: until they exist the status waits for the next tick.
    function wspPaintSafe() {
      try { (0, /*()*/__V.paintWspStatus)(); return true; } catch (e) { if (e instanceof ReferenceError) return false; throw e; }
    }
    // Retry: the install again, or Whisper again after it stood down.
    function wspRetry() {
      if (!(0, /*()*/__C.whisperReady)()) { wspInst.err = ''; installWhisper(true).catch(() => {}); }
      else { wspResume(); syncSpeech(); }
      (0, /*()*/__V.paintCcState)();
    }
    // THE WAY BACK, only while Whisper is chosen and NOT working (not
    // installed, failed, not supported here); never while it is ready or
    // loading its model. It says the fact first, hides itself after
    // WSP_CHIP_MS, comes back only when the state changes to another bad one,
    // and once closed with ✕ stays closed for this meeting.
    const WSP_CHIP_MS = GifOS.timings.WSP_CHIP_MS;
    const wspChip = { k: '', at: 0, gone: false };
    const wspChipRoom = () => { try { return GifOS.link.read(location.pathname, '', location.hash).room || '-'; } catch (e) { return '-'; } };
    function wspChipGone() {
      if (wspChip.gone) return true;
      try { if (sessionStorage.getItem('gifos_wsp_chip_gone') === wspChipRoom()) wspChip.gone = true; } catch (e) {}
      return wspChip.gone;
    }
    yield 2718;
    // THE MEETING COMES FIRST. A 250 ms tick that lands more than a second late
    // means the page missed its heartbeats and media work; on a phone the
    // provider runs on this very thread. Two such stalls within 30 s while
    // Whisper is working, and it stands down for browser captions. The same
    // tick keeps the chip in step with the engine.
    const WSP_TICK_MS = GifOS.timings.WSP_TICK_MS, WSP_STARVE_MS = GifOS.timings.WSP_STARVE_MS, WSP_STARVE_N = GifOS.timings.WSP_STARVE_N, WSP_STARVE_WIN = GifOS.timings.WSP_STARVE_WIN;
    let wspTickAt = 0, wspStarved = [];
    yield 2732;
    // ---- THE ROOM EAR: one browser engine hears every voice ------------------
    // A browser runs ONE speech session at a time (a second start aborts the
    // first), so CC cannot open an engine per voice. Where start() takes a
    // MediaStreamTrack, the engine is fed one MIX instead: my own echo-cancelled
    // microphone (when unmuted) plus every voice this device hears first-hand —
    // each direct link's audio and the Stage feeds. Each input keeps its own
    // level meter, and a final line is written down under the voice that talked
    // most since the previous line; with nobody talking it is dropped. A
    // browser without track input keeps the old engine: the raw microphone,
    // my own voice only, behind the echo gate (see startSpeech).
    // Track input and processLocally arrived together in Chrome's engine; an
    // engine without them would ignore the track and listen to the microphone.
    // But the interface is not the engine. Every Chromium-based browser shows
    // start(track) and processLocally, and each brings its own speech engine:
    // Microsoft Edge's writes words nobody said from a track that Chrome's
    // writes correctly (measured 2026-11-18, Edge 157 and Chrome 158, the same
    // audio; Edge's engine is right on its plain microphone). The fault was the
    // RATE: Edge's engine reads a 48 kHz track as 16 kHz. Fed the same audio
    // through a 16 kHz AudioContext it wrote 0.965 of the script, Chrome's
    // 0.70-0.77 on every input (test/tools/cc-track-ab.js, leg mix16). And the
    // plain microphone is the system's DEFAULT device, not the one this meeting
    // uses: on a real Windows Edge (2026-11-22) a meeting whose mic carried
    // sound got 'audio-capture' from it at every unmute, so Captions paused.
    // So the engines measured to hear a track get one: Google Chrome's as the
    // meeting's context makes it, Microsoft Edge's at the rate it reads
    // (ccTrackRate, used by ccMixStart). Every other browser keeps the plain
    // microphone, and never claims the voice (cap 0).
    const CC_EDGE_TRACK_RATE = 16000;
    function ccTrackBrand() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!(SR && SR.prototype && 'processLocally' in SR.prototype)) return '';
      const brands = (typeof navigator !== 'undefined' && navigator.userAgentData && navigator.userAgentData.brands) || [];
      for (let i = 0; i < brands.length; i++) { const m = /^(Google Chrome|Microsoft Edge)\b/.exec(String(brands[i] && brands[i].brand)); if (m) return m[1]; }
      return '';
    }
    function ccTrackInput() { return !!ccTrackBrand(); }
    // THE ROOM EAR RUNS ONLY WHERE A MICROPHONE IS ALREADY OPEN. The browser's speech engine is a microphone use: the
    // browser runs each session under this site's microphone permission and lights the system's microphone indicator
    // for it, even a session handed a track. So it runs only on a page that holds a microphone of its own (live, and not
    // a phone's let-go stand-in). A listener (an embed, a broadcast viewer, a guest who never opened the mic) starts
    // none: it shows the lines the room sends.
    function ccEarMayRun() {
      if (!ccTrackInput()) return false;
      const t = __C.localStream && __C.localStream.getAudioTracks()[0];
      return !!(t && t.readyState === 'live' && !isQuietMic(t));
    }
    // The sample rate the engine must be handed, 0 = the meeting context's own.
    function ccTrackRate() { return ccTrackBrand() === 'Microsoft Edge' ? CC_EDGE_TRACK_RATE : 0; }
    // mine / wrote: my own voice in the mix (ms) and the letters the engine wrote, since the last check (ccMixHears)
    // dest: the mix in the meeting's context; out: the track the engine gets (dest's own, or through ac16 at ccTrackRate)
    const ccMix = { dest: null, ac16: null, out: null, ins: new Map(), talk: new Map(), tick: null, at: 0, last: null, lastAt: 0, mine: 0, wrote: 0 };
    const CC_TALK_RMS = 5 / 128; // the talking ring's threshold (meter loop), on float samples
    function ccMixVoices() { // id ('me' | pid) -> a source node in ac
      const out = new Map();
      const meM = __C.meters.get('me');
      if (!__C.myStatus.muted && meM && meM.src && (0, /*()*/__C.capSend)()) out.set('me', { node: meM.src });
      if (!(0, /*()*/__C.trWrites)()) return out; // only my own voice: the mix carries me alone
      const stagers = (typeof __C.stageIds === 'function') ? (0, /*()*/__C.stageIds)() : [];
      for (const pid of stagers) {
        if (pid === __C.myId) continue;
        const stg = wspStageStream(pid);
        if (stg) out.set(pid, { stage: stg });
      }
      for (const [pid, p] of __C.peers) {
        if (out.has(pid) || !p || !p.connected) continue;
        const st = __C.statusOf.get(pid) || {};
        if (st.muted || ((0, /*()*/__C.modOf)(pid).mute && (0, /*()*/__C.modOf)(pid).mute.on)) continue;
        const m = __C.meters.get(pid);
        if (m && m.src) out.set(pid, { node: m.src });
      }
      // One engine, one language: a voice its own page captions is left to
      // that page, and a voice in another language would come out as nonsense.
      // A voice in another language stays in (2026-11-17, Nathan: a wrong
      // caption marked [wrong language?] beats none); its lines carry the note.
      for (const id of Array.from(out.keys())) if (id !== 'me' && (0, /*()*/__C.capCovered)(id)) out.delete(id);
      return out;
    }
    function ccMixDrop(id) {
      const i = ccMix.ins.get(id); if (!i) return;
      // ccMix.last stays: who spoke last is a fact about the burst, not the mix. A voice
      // that leaves the mix mid-burst (its own page now captions it) still said those
      // finals, and forgetting it threw them away. A doubled line beats a lost one.
      ccMix.ins.delete(id); ccMix.talk.delete(id);
      try { i.node.disconnect(i.an); } catch (e) {}
      try { i.node.disconnect(i.g); } catch (e) {}
      try { i.g.disconnect(); } catch (e) {}
      if (i.own) { try { i.node.disconnect(); } catch (e) {} }
    }
    function ccMixSync() {
      if (!ccMix.dest) return;
      const want = ccMixVoices();
      for (const [id, i] of Array.from(ccMix.ins)) {
        const w = want.get(id);
        if (!w || (w.node && w.node !== i.node) || (w.stage && w.stage.id !== i.sid)) ccMixDrop(id);
      }
      for (const [id, w] of want) {
        if (ccMix.ins.has(id)) continue;
        let node = w.node, own = false;
        if (!node) {
          try { node = __C.ac.createMediaStreamSource(new MediaStream([w.stage.getAudioTracks()[0]])); own = true; } catch (e) { continue; }
        }
        try {
          const an = __C.ac.createAnalyser(); an.fftSize = 512;
          const g = __C.ac.createGain();
          node.connect(an); node.connect(g); g.connect(ccMix.dest);
          ccMix.ins.set(id, { node, an, g, own, sid: w.stage ? w.stage.id : null, buf: new Float32Array(an.fftSize) });
        } catch (e) { if (own) { try { node.disconnect(); } catch (x) {} } }
      }
      (0, /*()*/__C.capPublish)();
    }
    function ccMixStart() {
      if (ccMix.dest) return ccMix.out;
      if (!ccTrackInput() || !(0, /*()*/__C.ensureAc)()) return null;
      try { ccMix.dest = __C.ac.createMediaStreamDestination(); } catch (e) { ccMix.dest = null; return null; }
      // An engine that reads one rate (ccTrackRate) hears the mix through a context of its own at that rate, with no
      // output (like the meeting's). No such context, no track: no room ear (null), never a track the engine misreads.
      const rate = ccTrackRate();
      if (!rate) ccMix.out = ccMix.dest.stream.getAudioTracks()[0] || null;
      else {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          const sink = AC.prototype && typeof AC.prototype.setSinkId === 'function';
          try { ccMix.ac16 = new AC(sink ? { sampleRate: rate, sinkId: { type: 'none' } } : { sampleRate: rate }); } catch (e) { ccMix.ac16 = new AC({ sampleRate: rate }); }
          const dst = ccMix.ac16.createMediaStreamDestination();
          ccMix.ac16.createMediaStreamSource(ccMix.dest.stream).connect(dst);
          ccMix.ac16.resume().catch(() => {});
          ccMix.out = dst.stream.getAudioTracks()[0] || null;
        } catch (e) { ccMix.out = null; }
      }
      if (!ccMix.out) { if (ccMix.ac16) { try { ccMix.ac16.close(); } catch (e) {} } ccMix.ac16 = null; ccMix.dest = null; return null; }
      ccMix.at = Date.now();
      ccMixSync();
      ccMix.tick = setInterval(() => {
        const now = Date.now(), dt = now - ccMix.at; ccMix.at = now;
        if (ccMix.ac16 && ccMix.ac16.state !== 'running' && ccMix.ac16.state !== 'closed') ccMix.ac16.resume().catch(() => {});   // a suspended context hands the engine silence
        for (const [id, i] of ccMix.ins) {
          i.an.getFloatTimeDomainData(i.buf);
          let acc = 0; for (let k = 0; k < i.buf.length; k++) acc += i.buf[k] * i.buf[k];
          if (Math.sqrt(acc / i.buf.length) > CC_TALK_RMS) {
            ccMix.talk.set(id, (ccMix.talk.get(id) || 0) + dt);
            if (id === 'me') ccMix.mine += Math.min(dt, CC_GATE_TAIL_MS); // one reading stands for one meter tick at most (a throttled tab)
          }
        }
        ccMixHears();
      }, 150);
      return ccMix.out;
    }
    function ccMixStop() {
      if (!ccMix.dest) return;
      for (const id of Array.from(ccMix.ins.keys())) ccMixDrop(id);
      clearInterval(ccMix.tick); ccMix.tick = null;
      if (ccMix.ac16) { try { ccMix.ac16.close(); } catch (e) {} }
      ccMix.dest = null; ccMix.ac16 = null; ccMix.out = null; ccMix.talk.clear(); ccMix.last = null;
      ccMix.mine = 0; ccMix.wrote = 0;
      (0, /*()*/__C.capPublish)();
    }
    // THE SPOT CHECK: does the engine hear what it is fed? This page knows one
    // thing for sure: when its own microphone carried voice. Every CC_DEAF_MS of
    // my own voice the engine must have written something: at least a letter
    // per second of it, in lines under any name (I may only have said "yes"
    // while someone else talked). An engine that wrote less is deaf or dead
    // (a session that ended without telling, an input it cannot read): this
    // page stops claiming my voice (cap 0: the pages that hear my call audio
    // write me) and starts a fresh session, which earns the claim back with a
    // line of its own.
    function ccMixHears() {
      if (ccMix.mine < CC_DEAF_MS) return;
      const wrote = ccMix.wrote, mine = ccMix.mine;
      ccMix.mine = 0; ccMix.wrote = 0;
      if (wrote >= mine / 1000 || !(speech && speech.input)) return;
      if (__C.clog) (0, /*()*/__C.clog)('cc deaf', wrote, mine);
      stopSpeech();
      try { syncSpeech(); } catch (e) {}
    }
    // Who said the line the engine just finished: the voice that talked most
    // since the previous line. An engine also hands over one long utterance
    // as several finals in a burst; a final with no talk of its own within
    // 2 s of the previous one continues that speaker. null: nobody talked
    // (noise, or a voice now gone).
    const CC_BURST_MS = GifOS.timings.CC_BURST_MS;
    // [hard to hear] from the engine's confidence: OFF. Measured 2026-11-17
    // (Chrome on-device engine, en-US, the gate2 speech fixture clips):
    // clean English 0.955; English under noise 0.90-0.95 with only 6-11 of 13
    // words right; German heard as English 0.83-0.97 with none right. The
    // number does not tell a wrong line from a right one, so no threshold.
    const CC_HARD_CONF = 0;
    const CC_GATE_TAIL_MS = GifOS.timings.CC_GATE_TAIL_MS; // the own-voice gate's one grace: the meter's slowest tick
    const CC_DEAF_MS = GifOS.timings.CC_DEAF_MS; // this much of my own voice with next to nothing written: the engine does not hear
    function ccMixSpeaker() {
      let best = null, ms = 0;
      for (const [id, t] of ccMix.talk) if (t > ms) { ms = t; best = id; }
      const now = Date.now();
      if (!best && ccMix.last && now - ccMix.lastAt < CC_BURST_MS) best = ccMix.last;
      if (__C.clog) (0, /*()*/__C.clog)('cc line by', String(best).slice(0, 6), Array.from(ccMix.talk).map(([id, t]) => String(id).slice(0, 6) + ':' + t).join(' '));
      ccMix.talk.clear();
      if (best) { ccMix.last = best; ccMix.lastAt = now; }
      return best;
    }
    let speech = null, speechFails = 0, speechRetry = null, speechGaveUp = false, speechProved = false;
    // Starts the engine refused in a row (start() threw: a session the browser still holds, a track no
    // longer live). Only a written line resets it: a start() that returns has not proved the engine hears.
    let speechThrew = 0;
    // A start() that throws leaves no session at all: no result, no error and no end will ever come. So
    // nothing is left pointing at it (no engine, no proof, cap 0: the pages that hear my call audio write
    // me), and the engine is started again from the settings, backing off; after three in a row this page
    // also says Captions paused. The first written line takes that back.
    function speechStartThrew(err) {
      speechThrew++;
      if (__C.clog) (0, /*()*/__C.clog)('cc start threw', String((err && err.name) || err), speechThrew);
      stopSpeech();
      if (speechThrew >= 3) speechEngineDown();
      speechRetry = setTimeout(() => { speechRetry = null; try { syncSpeech(); } catch (e) {} }, speechRetryDelay(speechThrew));
    }
    // A browser whose speech engine cannot run tells the room so (ccst
    // 'paused'): it sends no captions, and a keep/share page writes that
    // voice instead. The first line it writes again takes the word back.
    let speechSaidPaused = false;
    function speechEngineDown() {
      speechProved = false;
      if (typeof __C.myStatus === 'undefined' || !__C.myStatus || __C.myStatus.ccst === 'paused') return;
      __C.myStatus.ccst = 'paused'; speechSaidPaused = true;
      try { (0, /*()*/__C.capPublish)(); } catch (e) {}
      try { if (typeof __C.updateTile === 'function') (0, /*()*/__C.updateTile)('me'); } catch (e) {}
      try { if (typeof __C.broadcastStatus === 'function') (0, /*()*/__C.broadcastStatus)(); } catch (e) {}
    }
    function speechEngineUp() {
      if (!speechSaidPaused) return;
      speechSaidPaused = false;
      if (__C.myStatus && __C.myStatus.ccst === 'paused') {
        delete __C.myStatus.ccst;
        try { if (typeof __C.updateTile === 'function') (0, /*()*/__C.updateTile)('me'); } catch (e) {}
        try { if (typeof __C.broadcastStatus === 'function') (0, /*()*/__C.broadcastStatus)(); } catch (e) {}
      }
    }
    // Does this engine still have a job: my own voice (sending, unmuted), or
    // the room ear (a keep/share page).
    function speechKeep(rec) {
      if (!rec) return false;
      if (rec.input) return !!((0, /*()*/__C.trWrites)() || ((0, /*()*/__C.capSend)() && !__C.myStatus.muted));
      return (0, /*()*/__C.capSend)() && !__C.myStatus.muted;
    }
    function speechRunning() { return !!speech; }
    function speechRetryDelay(n) { return Math.min(30000, 1000 * Math.pow(2, Math.max(0, n - 1))); }
    // The language the browser engine is asked for: the picker, else the
    // device's language (the room's suggestion changes the picker, on a tap).
    function speechLangFor() {
      const v = (0, /*()*/__C.ccLang)();
      return v === 'auto' ? (navigator.language || 'en-US') : v;
    }
    // [wrong language?]: my engine listened in langTag, the speaker said (or
    // their device says) another language.
    function ccEarLangNote(pid, langTag) {
      const st = __C.statusOf.get(pid); const l = st && (0, /*()*/__C.trLangOf)(st.lang || st.dl);
      return l && langTag && l !== (0, /*()*/__C.trLangOf)(langTag) ? 'lang' : '';
    }
    // [hard to hear]: the engine's own confidence, where it gives one, under
    // CC_HARD_CONF (0 = off: see timings for the measured numbers).
    function ccHardNote(alt) {
      const c = alt && typeof alt.confidence === 'number' ? alt.confidence : 0;
      return c > 0 && c < CC_HARD_CONF ? 'hard' : '';
    }
    function startSpeech(input) { // input: the room-ear mix; none = the raw microphone
      if (ccEngine() === 'local') return false;
      if (speechGaveUp) return false;
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stThisBrowserCannotWriteDown', 'This browser cannot write down what people say.')); return false; }
      speechFails = 0;
      try {
        speech = new SR();
        const rec = speech;
        rec.input = input || null;
        const go = () => { if (rec.input) rec.start(rec.input); else rec.start(); };
        const restart = () => { try { go(); } catch (err) { if (speech === rec) speechStartThrew(err); } };
        speech.continuous = true;
        speech.interimResults = false;
        speech.lang = speechLangFor();
        rec.langTag = (0, /*()*/__C.trLangOf)(speech.lang);
        rec.eng = typeof phoneCaptions === 'function' && phoneCaptions() ? 'native' : 'browser'; // the Meet app's own engine stands in for the browser's
        speech.onresult = (e) => {
          // A line while I am muted is never mine to send (privacy: muted means
          // not in the meeting). A stopped session's late final while I am NOT
          // muted is the tail of words I said: it is kept (2026-11-17, Nathan:
          // a real line is never thrown away).
          if (__C.myStatus.muted && (!rec.input || speech !== rec)) {
            for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { __C.trDrops++; if (typeof __C.capTraceGate === 'function') (0, /*()*/__C.capTraceGate)(rec.eng, rec.langTag, __C.myVoiceFrom || 0, speech !== rec ? 'late' : 'muted', rec.input ? 'mix' : 'mic'); }
            return;
          }
          speechFails = 0;
          // Proof is a line with words in it: an engine that cannot read its input still hands over finals, empty ones.
          let words = false;
          for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal && String(e.results[i][0].transcript || '').trim()) words = true;
          if (words) {
            speechThrew = 0;
            if (speech === rec) speechProved = true; // a stopped session's late line proves nothing about the engine now running
            speechEngineUp();
          }
          try { (0, /*()*/__C.capPublish)(); } catch (err) {}
          if (rec.input) {
            for (let i = e.resultIndex; i < e.results.length; i++) {
              if (!e.results[i].isFinal) continue;
              ccMix.wrote += String(e.results[i][0].transcript || '').trim().length;
              const who = ccMixSpeaker();
              if (!who) { __C.trDrops++; continue; }
              if (who === 'me') (0, /*()*/__C.addTranscriptLine)(e.results[i][0].transcript, __C.myVoiceFrom || 0, null, null, 'mic', rec.langTag, rec.langTag === (0, /*()*/__C.trLangKnown)(), Date.now(), '', { eng: rec.eng, inp: 'mix' }, ccHardNote(e.results[i][0]));
              else (0, /*()*/__C.addTranscriptLine)(e.results[i][0].transcript, 0, who, null, 'ear', rec.langTag, false, 0, '', { eng: rec.eng, inp: 'mix' }, ccEarLangNote(who, rec.langTag) || ccHardNote(e.results[i][0]));
            }
            return;
          }
          // THE GATE: the raw microphone hears the speakers too. A line goes
          // out only if my own echo-cancelled mic carried voice during its
          // span: since the previous final (an engine hands a long utterance's
          // final over seconds after the voice stopped, and that line is kept).
          // Voice that belonged to the previous line is not this one's
          // (2026-11-17: the old 3 s grace passed a line heard right after I
          // stopped). The meter's own resolution is the one grace: voice in
          // its last tick (CC_GATE_TAIL_MS; a hidden tab reads every 900 ms)
          // may not have set the flag yet. No meter yet (AudioContext not
          // born) ⇒ no verdict ⇒ let it through.
          const sinceVoice = Date.now() - __C.myVoiceAt;
          const heard = !__C.meters.has('me') || __C.myVoiceSinceFinal || sinceVoice < CC_GATE_TAIL_MS;
          if (typeof __C.ccDevNotice === 'function') (0, /*()*/__C.ccDevNotice)();
          let mine = false;
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (!e.results[i].isFinal) continue;
            // The echo of a line I already hold from someone else: dropped
            // here, never sent, and it does not use up my voice: the final
            // that follows may be my own sentence.
            const echo = typeof __C.trEchoHeld === 'function' ? (0, /*()*/__C.trEchoHeld)(e.results[i][0].transcript, __C.myVoiceFrom || 0, !heard) : 0;
            if (echo === 2) { __C.trDrops++; if (typeof __C.capTraceGate === 'function') (0, /*()*/__C.capTraceGate)(rec.eng, rec.langTag, __C.myVoiceFrom || 0, 'echo'); continue; }
            mine = true;
            // No voice on my call track for this line: kept, marked [not sure
            // who spoke] (2026-11-17, Nathan: a marked line beats a lost one).
            if (!heard && __C.clog) (0, /*()*/__C.clog)('tr own mark', 'gate', sinceVoice);
            const nt = !heard ? 'who' : echo === 1 ? 'echo' : ccHardNote(e.results[i][0]);
            // the line spans from when this stretch of my voice began to now; its language is as good as
            // detected when it is the one this page knows (picked, or learned from the room's Whisper pages)
            (0, /*()*/__C.addTranscriptLine)(e.results[i][0].transcript, __C.myVoiceFrom || 0, null, null, 'mic', rec.langTag, rec.langTag === (0, /*()*/__C.trLangKnown)(), Date.now(), '', { eng: rec.eng, inp: 'mic' }, nt);
          }
          if (mine) __C.myVoiceSinceFinal = false;
        };
        speech.onend = () => {
          if (!(speech === rec && speechKeep(rec))) return;
          if (speechFails > 0) {
            const wait = speechRetryDelay(speechFails);
            speechRetry = setTimeout(() => {
              speechRetry = null;
              if (speech === rec && speechKeep(rec)) restart();
            }, wait);
            return;
          }
          restart();
        };
        speech.onerror = (e) => {
          if (speech !== rec) return;
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'language-not-supported') {
            stopSpeech();
            speechEngineDown();
            (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stCaptionsPaused', 'Captions paused'));
            return;
          }
          if (e.error === 'network' || e.error === 'audio-capture' || e.error === 'aborted') {
            speechFails++;
            if (speechFails >= 3) {
              // CC only hides captions on this screen, so a dead speech
              // service must not turn that button off. Retry on its own.
              speechGaveUp = true;
              stopSpeech();
              speechEngineDown();
              (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stCaptionsPaused', 'Captions paused'), 15000);
              setTimeout(() => { speechGaveUp = false; speechFails = 0; try { syncSpeech(); } catch (err) {} }, 20000);
            }
          }
        };
        try { go(); } catch (err) { speechStartThrew(err); return false; }
        return true;
      } catch (e) { speech = null; speechProved = false; return false; }
    }
    function stopSpeech() {
      const sp = speech;
      speech = null; // onend sees null → no restart
      speechProved = false; // the next session earns the cap bit with a line of its own
      if (speechRetry) { clearTimeout(speechRetry); speechRetry = null; }
      if (sp) { try { sp.stop(); } catch (e) {} }
      ccMixStop();
      (0, /*()*/__C.capPublish)(); // a stopped engine sends nothing: the keep/share pages take my voice on
    }
    // A real page has a window object. A lifted test has no window, or a
    // stand-in that is not an object, and must still be allowed to call
    // startSpeech. Headless bots have a window and no SpeechRecognition.
    function browserCaptionsMissing() {
      return typeof window === 'object' && !!window && !(window.SpeechRecognition || window.webkitSpeechRecognition);
    }
    function noteNoBrowserSpeech() {
      if (typeof __C.myStatus !== 'undefined' && __C.myStatus && !wspPaused) __C.myStatus.ccst = 'paused';
      try { if (typeof __C.updateTile === 'function') (0, /*()*/__C.updateTile)('me'); } catch (e) {}
      try { if (typeof __C.broadcastStatus === 'function') (0, /*()*/__C.broadcastStatus)(); } catch (e) {}
      try { (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stCaptionsPaused', 'Captions paused')); } catch (e) {}
    }
    // THE ENGINES FOLLOW THE SETTINGS. "Send my captions" on and unmuted: my
    // own voice is written (Whisper's mic capture, or the browser engine).
    // Transcript keep/share: the voices nobody captions too (Whisper captures
    // per voice; the browser engine's room ear where start() takes a track).
    // Neither: no engine runs, and this page only receives.
    function syncSpeech() {
      (0, /*()*/__V.paintWspChip)(); // the way back shows the moment Whisper is chosen; the 250 ms tick keeps it in step
      const mine = (0, /*()*/__C.capSend)() && !__C.myStatus.muted;
      const hearRoom = (0, /*()*/__C.trWrites)();
      if (ccEngine() === 'local') { __C.ccLocalQ.sync(mine); return; }
      if ((mine || hearRoom) && ccEngine() === 'whisper' && !wspPaused && (0, /*()*/__C.whisperReady)()) {
        if (!mine || wspCaps.has('me') || startWhisper()) {
          if (speechRunning()) stopSpeech();
          ccMixStop();
          if (!mine) wspStop('me');
          if (__C.myStatus && __C.myStatus.ccst === 'paused') delete __C.myStatus.ccst;
          wspSync();
          return;
        }
        // Whisper is chosen but cannot run here (no provider yet, no mic
        // track): the browser engine carries on, when this browser has one.
      }
      wspStop('me'); wspSync();
      if (!mine && !hearRoom) { if (speechRunning()) stopSpeech(); (0, /*()*/__C.capPublish)(); (0, /*()*/__V.paintTxMark)(); return; }
      if (typeof browserCaptionsMissing === 'function' && browserCaptionsMissing()) {
        if (speechRunning()) stopSpeech();
        noteNoBrowserSpeech();
        (0, /*()*/__C.capPublish)();
        return;
      }
      // The room ear runs only while there is a voice to hear: an engine on an
      // empty mix is a speech session open over silence.
      // My own voice too: wherever the engine takes a track, it hears the
      // call's echo-cancelled mic, never the raw default device.
      if ((hearRoom || mine) && ccEarMayRun() && ccMixVoices().size) {
        if (speechRunning() && !speech.input) stopSpeech(); // a raw-microphone engine hands over to the room ear
        const input = ccMixStart();
        if (input) {
          ccMixSync();
          if (!speechRunning()) startSpeech(input);
          return;
        }
      }
      // No track input: my microphone (the system default device).
      if (speechRunning() && speech.input) stopSpeech(); // the room ear stands down to the plain microphone
      if (mine && !speechRunning()) startSpeech();
      if (!mine && speechRunning()) stopSpeech();
      (0, /*()*/__C.capPublish)();
    }
    yield 2768;
    function paintCcButtons() { (0, /*()*/__V.paintCcView)(); }
    document.getElementById('ccbtn').onclick = () => {
      __C.ccShow = !__C.ccShow;
      ccByOrder = false;
      if (!__C.ccShow && typeof ccAllInfo === 'function' && ccAllInfo()) ccOptOutAt = Date.now();
      try { localStorage.setItem('gifos_cc_view', __C.ccShow ? '1' : '0'); } catch (e) {}
      (0, /*()*/__V.paintCcView)();
      if (!__C.ccShow) return;
      // Turning captions on is the way back from a Whisper give-up: the pause
      // holds until Whisper is re-picked or CC is turned on.
      if (wspPaused) {
        wspResume();
        try { syncSpeech(); } catch (e) {}
        try { (0, /*()*/__V.paintCcState)(); } catch (e) {}
      }
      const lines = (0, /*()*/__C.trBlocks)();
      const last = lines.length ? lines[lines.length - 1] : null;
      if (last) (0, /*()*/__V.showCaption)(last.byId, (0, /*()*/__C.trNote)(last) + last.text);
    };
    yield 2771;
    if (__V.ccDockBtn) __V.ccDockBtn.onclick = () => document.getElementById('ccbtn').click();
    // CAPTIONS FOR EVERYONE. Each person had to find CC alone, and one never
    // did. An admin's room-wide 'cc' order (pseudo-target '*', the same signed
    // table as the chat switch) turns captions on for every unmuted device at
    // once. It is a request, not a hammer: tapping CC off afterwards opts that
    // device out until the admin issues a NEW order; turning the order off
    // stops only the devices the order started.
    var ccOptOutAt = 0, ccByOrder = false;
    function ccAllInfo() { const m = __C.modTable['*'] && __C.modTable['*'].cc; return (m && m.on) ? m : null; }
    function applyCcAll() {
      const m = ccAllInfo();
      const btn = document.getElementById('ccall');
      if (btn) btn.textContent = (0, /*()*/__C.uiText)(m ? 'setCcAllOn' : 'setCcAllOff', 'Captions for everyone: ' + (m ? 'on' : 'off'));
      if (!m) {
        if (ccByOrder && __C.ccShow) { ccByOrder = false; __C.ccShow = false; paintCcButtons(); (0, /*()*/__V.hideCaptions)(); (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stCaptionsForEveryoneWereTurned', 'Captions for everyone were turned off.')); }
        return;
      }
      if (__C.ccShow || ccOptOutAt >= (m.at || 0)) return;
      __C.ccShow = true; ccByOrder = true;
      paintCcButtons();
      (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('ccOnBy', '{by} turned captions on for your screen. Tap Captions to hide them.').replace('{by}', m.by || (0, /*()*/__C.uiText)('ccOnByHost', 'A host')), 8000);
    }
    (function wireCcAll() {
      const btn = document.getElementById('ccall'); if (!btn) return;
      // The order is the admin's signed room-wide 'cc' switch (the same table as
      // the chat switch): every screen shows captions until someone taps CC off.
      btn.onclick = () => { (0, /*()*/__C.setMod)('*', 'cc', !ccAllInfo()); applyCcAll(); };
    })();
    function setPanelView(showTr) {
      const w = document.getElementById('trwrap'), c = document.getElementById('chatlog');
      w.classList.toggle('show', showTr);
      c.style.display = showTr ? 'none' : '';
      document.getElementById('paneltitle').innerHTML = showTr ? (__C.AI_SPARK_SVG + 'Transcript') : (__C.BROADCAST ? 'Broadcast chat' : 'Meeting chat');
      document.getElementById('trtab').innerHTML = showTr ? 'Chat' : (__C.AI_SPARK_SVG + 'Transcript');
      const find = document.getElementById('chatfind');
      if (find) find.hidden = !!showTr;
      if (showTr) (0, /*()*/__V.renderTranscript)(); else (0, /*()*/__V.renderChat)();
    }
    document.getElementById('trtab').onclick = () => {
      setPanelView(!document.getElementById('trwrap').classList.contains('show'));
    };
    // The Transcript button in the top bar appears once captions are in play
    // anywhere in the meeting — the transcript must not hide behind Chat.
    document.getElementById('trbtn').onclick = () => {
      __V.chatPanel.classList.add('open'); __C.chatOpen = true;
      setPanelView(true);
      (0, /*()*/__V.paintChatBtn)();
    };
    function refreshTrBtn() {
      // The Transcript window exists only on a page that keeps one.
      const btn = document.getElementById('trbtn');
      if (btn) btn.style.display = (0, /*()*/__C.trKeeps)() ? '' : 'none';
      if (!(0, /*()*/__C.trKeeps)()) { const w = document.getElementById('trwrap'); if (w && w.classList.contains('show')) setPanelView(false); }
    }
    refreshTrBtn();
    // Every meeting download (transcript, recording) is filed as
    // <YYYY_MM_DD>_<Room>_gifos_<Kind>.<ext>: the LOCAL date the meeting (or
    // recording) started, then the room's name. Only the name is passed in —
    // the admin verifier and the password never reach a file name. The name is
    // cut to [A-Za-z0-9._-] so it saves on every filesystem; with nothing left
    // the file is <YYYY_MM_DD>_gifos_<Kind>.<ext>.
    function meetDownloadName(kind, roomName, date, ext) {
      let d = new Date(date || Date.now());
      if (isNaN(d.getTime())) d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const day = d.getFullYear() + '_' + pad(d.getMonth() + 1) + '_' + pad(d.getDate());
      let name = String(roomName || '');
      try { name = decodeURIComponent(name); } catch (e) {}
      name = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_').replace(/^[._-]+|[._-]+$/g, '')
        .slice(0, 80).replace(/[._-]+$/, '');
      const dot = String(ext || 'txt').replace(/^\.+/, '').replace(/[^A-Za-z0-9]/g, '').toLowerCase() || 'txt';
      return day + (name ? '_' + name : '') + '_gifos_' + kind + '.' + dot;
    }
    // The transcript as a text file: {blob, name, lines} (lines 0 = empty).
    function transcriptFile() {
      const blocks = (0, /*()*/__C.trBlocks)();
      const mine = (0, /*()*/__C.trLang)();
      const lines = blocks.map((l) => '[' + new Date(l.at).toLocaleTimeString() + '] ' + l.by + (l.lang && l.lang !== mine ? ' (' + l.lang + ')' : '') + ': ' + (0, /*()*/__C.trNote)(l) + l.text);
      return { blob: new Blob([lines.join('\n') + '\n'], { type: 'text/plain' }), name: meetDownloadName('Transcript', __C.room, blocks.length ? blocks[0].at : 0, 'txt'), lines: lines.length };
    }
    yield 2784;

    // ---- recording: this meeting, composited ON YOUR DEVICE ---------------------
    // A popup asks WHAT to capture (scope) and at what QUALITY. Tiles are drawn
    // to a canvas (blur baked in — a blurred feed records blurred), audio is
    // mixed honoring your four faders + consent, and MediaRecorder writes a
    // .webm that never leaves your device. Everyone sees the ⏺ chip while you
    // record.
    //
    // The recorder is STADIUM-AWARE: sources are what you actually RECEIVE — the
    // stage (verbatim), your row (direct links), and the FOLDS of your section
    // and the crowd (compOf). You can't record a million faces; the crowd
    // records as the same folded mosaic you see. Scope picks which tiers ride
    // along; "match my mix" scales each bus's audio by your own fader.
    let recRec = null, recTimer = null, recDraw = null, recStart = 0, recSrcs = new Map(), recDest = null, recSink = null;
    let recMode = null, recRestart = null, recMatchMix = true, recQuality = 'std', recType = 'video/webm'; // recType = the container MediaRecorder writes; recMode = scope; recRestart = opts after a stop
    let recToLib = false;   // this recording goes to My library (Streamer) when it stops
    let recStarting = false, recReloadAfterStop = false, recIndWatch = null;
    yield 2790;
    const REC_QUALITY = { low: { w: 1280, h: 720, v: 1000000 }, std: { w: 1920, h: 1080, v: 3000000 }, high: { w: 1920, h: 1080, v: 6000000 } };
    function recStadiumLabel(c) {
      const n = c && (c.cnt | 0);
      if (n > 0) return 'The stadium (' + n + (n === 1 ? ' person' : ' people') + ')';
      return 'The stadium';
    }
    function recFoldLabel(key, c) {
      if (key === 'sd' || (c && c.via === 'mosaic')) return recStadiumLabel(c);
      if (key === 'sgs' || (c && c.via === 'stage') || (typeof key === 'string' && key.indexOf('s:') === 0)) return 'On stage';
      return 'Rows ' + (((c && c.rws) || []).join(', ') || '…');
    }
    function recFoldBus(key, c) {
      if (key === 'sgs' || (c && c.via === 'stage') || (typeof key === 'string' && key.indexOf('s:') === 0)) return 'stage';
      return 'stadium';
    }
    // Freeze self-heal: save an in-flight recording before the reload, and
    // do not start a second save if one is already flushing.
    function recResumePlan(recording, alreadySaving) {
      if (alreadySaving) return 'wait';
      if (recording) return 'save';
      return 'reload';
    }
    function recStreamSink(kind, writable, finishMeta) {
      let chain = Promise.resolve();
      return {
        kind: kind,
        write(blob) {
          const step = chain.then(() => writable.write(blob));
          chain = step.then(() => {}, () => {});
          return step;
        },
        finish() {
          return chain.then(() => writable.close()).then(() => finishMeta());
        },
        abort() {
          const end = writable.abort ? (() => writable.abort()) : (() => writable.close());
          return chain.then(end, end);
        },
      };
    }
    function recordingIndicatorsOk() {
      try { (0, /*()*/__C.updateTile)('me'); } catch (e) {}
      try { (0, /*()*/__V.paintRoomTrust)(); } catch (e) {}
      const recMark = document.getElementById('barrec');
      if (!recMark || recMark.hidden || recMark.offsetParent === null) return false;
      const tile = __C.meTile && __C.meTile.tile;
      const chips = tile && tile.querySelector('.chips');
      const text = chips ? (chips.textContent || '') : '';
      if (text.indexOf('recording this ' + (0, /*()*/__C.recRoomWord)()) < 0) return false;
      // A bot's badge sits on its tile beside the chips (paintTileChrome).
      if (__C.myStatus.bot && !(tile && tile.querySelector(':scope > .botbadge')) && text.indexOf('bot') < 0) return false;
      return true;
    }
    async function recOpenSink(name, quiet) {
      // A bot session is the meeting page itself, stamped before boot. It keeps
      // the bytes on the page. A normal meeting has no stamp and opens the picker.
      if (window.__gifosMb === '1') {
        const chunks = [];
        return {
          kind: 'ram',
          write(blob) { chunks.push(blob); return Promise.resolve(); },
          finish() {
            const blob = new Blob(chunks, { type: String(recType || 'video/webm').split(';')[0] });
            chunks.length = 0;
            return blob.arrayBuffer().then((bytes) => {
              window.__gifosRecHeld = { bytes: bytes, mime: blob.type, name: name };
              return { href: URL.createObjectURL(blob), name: name, held: true };
            });
          },
          abort() { chunks.length = 0; return Promise.resolve(); },
        };
      }
      // quiet: a kept service starts without a tap, so no picker can open.
      if (!quiet && typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: name,
            types: String(recType).indexOf('mp4') >= 0 ? [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }] : [{ description: 'WebM video', accept: { 'video/webm': ['.webm'] } }],
          });
          const writable = await handle.createWritable();
          return recStreamSink('file', writable, async () => ({ saved: true, name: handle.name || name }));
        } catch (e) {
          if (e && e.name === 'AbortError') return { kind: 'cancel' };
        }
      }
      try {
        const storage = navigator.storage;
        if (storage && typeof storage.getDirectory === 'function') {
          const root = await storage.getDirectory();
          const handle = await root.getFileHandle(name, { create: true });
          const writable = await handle.createWritable();
          // drop: the OPFS file is origin storage the person never sees, so
          // recDeliver deletes it once the download has had its minute.
          return recStreamSink('opfs', writable, async () => {
            const file = await handle.getFile();
            return { href: URL.createObjectURL(file), name: name, drop: () => root.removeEntry(name) };
          });
        }
      } catch (e) {}
      const chunks = [];
      return {
        kind: 'ram',
        write(blob) { chunks.push(blob); return Promise.resolve(); },
        finish() {
          const blob = new Blob(chunks, { type: String(recType || 'video/webm').split(';')[0] });
          chunks.length = 0;
          return Promise.resolve({ href: URL.createObjectURL(blob), name: name });
        },
        abort() { chunks.length = 0; return Promise.resolve(); },
      };
    }
    function recFileName() {
      return meetDownloadName('Recording', __C.room, Date.now(), String(recType).indexOf('mp4') >= 0 ? 'mp4' : 'webm');
    }
    function recOnPhone() {
      return window.matchMedia('(max-width: 700px), (max-height: 500px)').matches;
    }
    function recDownload(saved) {
      const a = document.createElement('a');
      a.href = saved.href;
      a.download = saved.name || recFileName();
      a.click();
    }
    function recRelease(saved) {
      setTimeout(() => {
        try { URL.revokeObjectURL(saved.href); } catch (e) {}
        if (typeof saved.drop === 'function') { try { Promise.resolve(saved.drop()).catch(() => {}); } catch (e) {} }
      }, 60000);
    }
    yield 2804;
    // ---- My library (Streamer): the finished recording is uploaded, with the
    // transcript beside it. If the library refuses it (full, plan ended) or
    // the upload cannot be kept to finish later, the file is saved on this
    // device instead, so a recording is never lost.
    let recLibLast = -1;
    function recLibNote(text) { recLibLast = -1; (0, /*()*/__C.setStatus)(text); }
    function recLibProgress(x) {
      const pct = Math.floor(x * 100);
      if (pct === recLibLast) return;
      recLibLast = pct;
      (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stLibSaving', 'Saving to My library…') + ' ' + pct + '%');
    }
    function recToLibrary(saved) {
      const name = saved.name || recFileName();
      const tr = transcriptFile();
      const L = window.GifOS && GifOS.library;
      if (!L) return recDeliver(saved);
      const onDevice = (blob, why) => {
        const href = URL.createObjectURL(blob);
        recDownload({ href, name });
        recRelease({ href, drop: saved.drop });
        recLibNote((why ? why + ' ' : '') + (0, /*()*/__C.uiText)('stLibDevice', 'Saved on this device instead.'));
      };
      (async () => {
        let blob;
        try { blob = await fetch(saved.href).then((r) => r.blob()); } catch (e) { recDeliver(saved); return; }
        // A broadcast host's recording stays what Rebroadcast > Last service plays, as recDeliver keeps it.
        try { if (__C.BROADCAST && (0, /*()*/__C.bcHostStored)()) __C.bcLastService = { blob: Promise.resolve(blob), name: saved.name || '' }; } catch (e) {}
        try { URL.revokeObjectURL(saved.href); } catch (e) {}
        recLibProgress(0);
        let file;
        try {
          file = await L.save(blob, { name, type: blob.type || recType, kind: 'recording' }, recLibProgress);
        } catch (e) {
          const kept = e && e.uploadId && L.pending().some((p) => p.id === e.uploadId);
          if (kept) {
            recLibNote((0, /*()*/__C.uiText)('stLibPaused', 'The upload paused. It finishes the next time you open GifOS.'));
            if (typeof saved.drop === 'function') { try { await saved.drop(); } catch (x) {} }
          } else onDevice(blob, e && e.message);
          return;
        }
        if (typeof saved.drop === 'function') { try { await saved.drop(); } catch (e) {} }
        if (tr && tr.lines) { try { await L.save(tr.blob, { name: tr.name, type: 'text/plain', kind: 'transcript', of: file.id }); } catch (e) {} }
        recLibNote((0, /*()*/__C.uiText)('stLibSaved', 'Saved to My library.'));
        if (typeof window.__gifosLibSaved === 'function') { try { window.__gifosLibSaved(file); } catch (e) {} }
      })();
      return 'library';
    }
    // The Record sheet's library choice: Streamer gets the box (on by
    // default); other people see one quiet line while subscriptions are on.
    // BROADCAST APP ONLY (Nathan 2026-11-13): the Meet app has no file
    // management and never offers the Streamer library; the native apps
    // never reach it either.
    async function recLibraryOption(bg) {
      const slot = bg.querySelector('#rec-lib');
      const L = window.GifOS && GifOS.library;
      if (!slot || !L || !L.enabled() || !__C.BC_INTENT || (window.GifOS && GifOS.storeRail && GifOS.storeRail.present())) return;
      let st = 'none';
      try { st = await L.status(); } catch (e) {}
      if (!slot.isConnected) return;
      if (st !== 'storage') {
        const p = document.createElement('p');
        p.className = 'rec-upsell';
        p.style.cssText = 'margin:.4rem 0 0;font-size:13px;color:var(--c-gray)';
        p.textContent = (0, /*()*/__C.uiText)('recLibUpsell', 'Streamer subscribers can save recordings to their GifOS library.');
        slot.appendChild(p);
        return;
      }
      const lab = document.createElement('label');
      lab.className = 'rec-opt';
      lab.innerHTML = '<input type="checkbox" id="rec-tolib" checked><span><b></b><small></small></span>';
      lab.querySelector('b').textContent = (0, /*()*/__C.uiText)('recToLib', 'Save to my GifOS library');
      lab.querySelector('small').textContent = (0, /*()*/__C.uiText)('recToLibHelp', 'Encrypted in this browser and uploaded to your library when the recording stops, with the transcript. Only you can open it, unless you share it.');
      slot.appendChild(lab);
      const note = bg.querySelector('.rec-note');
      const devText = note ? note.textContent : '';
      const box = lab.querySelector('input');
      const paint = () => { if (note) note.textContent = box.checked ? (0, /*()*/__C.uiText)('recNoteLib', 'Saved to your GifOS library. Everyone here will see that this meeting is being recorded.') : devText; };
      box.addEventListener('change', paint);
      paint();
    }
    // An upload a reload interrupted finishes once the page has loaded.
    // Broadcast app only, like the choice that starts one.
    window.addEventListener('load', () => {
      const L = window.GifOS && GifOS.library;
      if (!__C.BC_INTENT || !L || !L.enabled() || !L.pending().length) return;
      L.resumePending().then((done) => { if (done && done.length) recLibNote((0, /*()*/__C.uiText)('stLibSaved', 'Saved to My library.')); }).catch(() => {});
    });
    function recDeliver(saved) {
      if (saved && saved.held) return 'held';
      // The host's kept service is what Rebroadcast > Last service plays.
      if (saved && saved.href && __C.BROADCAST && (0, /*()*/__C.bcHostStored)()) {
        const blob = fetch(saved.href).then((r) => r.blob());
        blob.catch(() => {});
        __C.bcLastService = { blob: blob, name: saved.name || '' };
      }
      if (saved && saved.href && __C.bcSeeding) {
        // A service is never replayed on demand. The host's choices are to
        // play it again live into this room (the normal fan-out; viewers see
        // Prerecorded), keep the file, or leave.
        saved.seed = true;
        (0, /*()*/__V.showServiceEnded)(saved);
        return 'ended';
      }
      if (saved && saved.href && recOnPhone()) {
        (0, /*()*/__V.showRecReplay)(saved);
        return saved.saved ? 'saved' : 'replay';
      }
      if (saved && saved.saved) { (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stRecordingSaved', 'Recording saved.')); return 'saved'; }
      if (saved && saved.href) {
        recDownload(saved);
        recRelease(saved);
        return 'download';
      }
      return '';
    }
    function resumeReload() {
      const REC_SAVE_MAX_MS = GifOS.timings.REC_SAVE_MAX_MS;
      // Stash before the reload, then drop the share so peers are not left
      // on a dead tile. The fallback timer must still reload on this turn.
      function reloadNow() {
        try { if (typeof stashRecoverMedia === 'function') stashRecoverMedia(); } catch (e) {}
        try {
          if (typeof stopScreenShare === 'function' && typeof __C.myStatus !== 'undefined' && __C.myStatus && __C.myStatus.scr) stopScreenShare('rejoining');
        } catch (e2) {}
        location.reload();
      }
      try {
        const recording = !!(recRec && recRec.state !== 'inactive');
        const plan = recResumePlan(recording, recReloadAfterStop);
        if (plan === 'wait') return;
        if (plan === 'save') {
          recRestart = null;
          recReloadAfterStop = true;
          try {
            if (typeof recDraw === 'function') { try { recDraw(); } catch (e2) {} }
            (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stSavingYourRecordingThenRejoining', 'Saving your recording, then rejoining the meeting.'));
            // onstop reloads after the file is finished. If onstop or the
            // sink's finish never settles, the latch above would make every
            // later freeze wait forever, so the page still reloads by itself.
            setTimeout(() => reloadNow(), REC_SAVE_MAX_MS);
            recRec.stop();
            return;
          } catch (e3) { recReloadAfterStop = false; }
        }
      } catch (e) {}
      reloadNow();
    }
    // One dialog behaviour for the sheets that had none: focus moves in,
    // Escape and the backdrop close, focus returns to whatever opened it.
    let modalSeq = 0;
    const modalStack = [];
    function openModal(el, hide) {
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      const heading = el.querySelector('h3');
      if (heading) {
        if (!heading.id) heading.id = 'dlg-h-' + (++modalSeq);
        el.setAttribute('aria-labelledby', heading.id);
      }
      const prev = (document.activeElement && document.activeElement !== document.body) ? document.activeElement : null;
      let closed = false;
      const finish = () => {
        if (closed) return;
        closed = true;
        const at = modalStack.indexOf(finish);
        if (at >= 0) modalStack.splice(at, 1);
        try { hide(); } catch (e) {}
        if (prev && typeof prev.focus === 'function') { try { prev.focus(); } catch (e) {} }
      };
      if (!el.__modalBackdrop) {
        el.__modalBackdrop = true;
        el.addEventListener('click', (e) => { if (e.target === el) finishFromEl(el); });
      }
      el.__modalFinish = finish;
      modalStack.push(finish);
      const first = el.querySelector('button, [href], input, select, textarea');
      if (first && typeof first.focus === 'function') { try { first.focus(); } catch (e) {} }
      return finish;
    }
    function finishFromEl(el) {
      const fn = el && el.__modalFinish;
      if (typeof fn === 'function') fn();
    }
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !modalStack.length) return;
      e.preventDefault();
      e.stopPropagation();
      modalStack[modalStack.length - 1]();
    }, true);
    function recTouchSource(src) {
      if (src.fold) {
        const c = compOf.get(src.foldKey);
        if (!c) return;
        src.video = c.el || null;
        src.stream = c.stream || null;
        src.label = recFoldLabel(src.foldKey, c);
        return;
      }
      if (src.me) {
        src.camOff = (0, /*()*/__C.seatDark)(__C.myStatus);
        src.label = (0, /*()*/__C.myName)() + ' (you)';
        src.video = __C.meTile && __C.meTile.video;
        src.stream = __C.localStream;
        return;
      }
      const pid = src.key;
      const p = __C.peers.get(pid);
      const st = __C.statusOf.get(pid) || {};
      src.blur = (0, /*()*/__C.blurLevelFor)(pid);
      src.mute = !!((0, /*()*/__C.modOf)(pid).mute && (0, /*()*/__C.modOf)(pid).mute.on);
      src.camOff = (0, /*()*/__C.seatDark)(st) || !!((0, /*()*/__C.modOf)(pid).cam && (0, /*()*/__C.modOf)(pid).cam.on) || (typeof __C.shareBlocked === 'function' && !!(0, /*()*/__C.shareBlocked)(pid)); // an admin's video-off, and an unpermitted screen claim, hold in the recording too, whatever the sender claims
      if (p) {
        src.label = p.name || '…';
        src.video = p.video;
        src.stream = p.video ? p.video.srcObject : null;
      }
      if (src.bus === 'stage') {
        const f = __C.mosIn.get('stg:' + pid);
        if (f && f.stream) { src.video = recStageVideo(f); src.stream = f.stream; }
      }
    }
    // Below Section 1 a stg:X feed arrives audio-only (stgDownShip): the face
    // rides in the received stage strip. Its audio still feeds the mix; the
    // picture falls back to the strip so the tile is not an empty letter.
    function recStageVideo(f) {
      const vts = (f.stream && typeof f.stream.getVideoTracks === 'function') ? f.stream.getVideoTracks() : [];
      for (let i = 0; i < vts.length; i++) if (vts[i] && vts[i].readyState !== 'ended') return f.el;
      const strip = compOf.get('sgs');
      return (strip && strip.el) || f.el;
    }
    let recSrcCache = null;
    function recSources() {
      // Roster and stage changes set recSrcDirty. A frame that is not one of
      // those only refreshes blur, mute and the fold element already stored
      // on the composite — no querySelector, no stageIds walk.
      if (!__C.recSrcDirty && recSrcCache) {
        for (let i = 0; i < recSrcCache.all.length; i++) recTouchSource(recSrcCache.all[i]);
        return recSrcCache.g;
      }
      const stg = new Set((0, /*()*/__C.stageIds)()), mates = new Set((0, /*()*/__C.rowMates)());
      const g = { stage: [], row: [], stadium: [] };
      if (__C.meTile && __C.meTile.video) g.row.push({ key: 'me', video: __C.meTile.video, label: (0, /*()*/__C.myName)() + ' (you)', bus: 'row', blur: 0, stream: __C.localStream, me: true, camOff: (0, /*()*/__C.seatDark)(__C.myStatus) });
      for (const [pid, p] of __C.peers) {
        const st = __C.statusOf.get(pid) || {};
        const src = { key: pid, video: p.video, label: p.name || '…', blur: (0, /*()*/__C.blurLevelFor)(pid), stream: p.stream || p.video.srcObject,
          mute: !!((0, /*()*/__C.modOf)(pid).mute && (0, /*()*/__C.modOf)(pid).mute.on), camOff: (0, /*()*/__C.seatDark)(st) || (typeof __C.shareBlocked === 'function' && !!(0, /*()*/__C.shareBlocked)(pid)) };
        if (stg.has(pid)) {
          const f = __C.mosIn.get('stg:' + pid);
          if (f && f.stream) { src.video = recStageVideo(f); src.stream = f.stream; }
          src.bus = 'stage'; g.stage.push(src);
        } else if (mates.has(pid)) { src.bus = 'row'; g.row.push(src); }
        else { src.bus = 'stadium'; g.stadium.push(src); }
      }
      for (const [key, c] of compOf) {
        if (!c.stream) continue;
        const bus = recFoldBus(key, c);
        const src = { key: 'f:' + key, foldKey: key, video: c.el || null, stream: c.stream, blur: 0, fold: true,
          label: recFoldLabel(key, c), bus: bus };
        if (bus === 'stage') g.stage.push(src);
        else g.stadium.push(src);
      }
      recSrcCache = { g: g, all: g.stage.concat(g.row, g.stadium) };
      __C.recSrcDirty = false;
      return g;
    }
    // Called from the mesh tick, not from the 15 fps draw. A changed roster,
    // seat, digest stage or fold is what makes the next frame rebuild.
    function recNoteStruct() {
      // Only a running recorder reads the source cache each frame. With none,
      // the tick does not walk the roster; it marks the cache stale so the
      // next start builds it fresh.
      if (!recRec || recRec.state === 'inactive') { __C.recSrcDirty = true; return; }
      try {
        const parts = [String(__C.rosterIds.length), String(__C.peers.size), String(__C.myStatus.stg || 0)];
        for (let i = 0; i < __C.rosterIds.length; i++) {
          const id = __C.rosterIds[i];
          const st = __C.statusOf.get(id);
          parts.push(id + ':' + ((st && st.stg) || 0));
        }
        const c = (0, /*()*/__C.meshCoord)();
        parts.push(c ? (String(c.pc) + '/' + c.r + '/' + c.i) : '');
        const dg = (0, /*()*/__C.digLists)();
        const far = dg && dg.stage;
        if (far) for (let i = 0; i < far.length; i++) parts.push('d' + (far[i].id || '') + ':' + (far[i].k || 0));
        const votes = dg && dg.votes;
        if (votes) for (let i = 0; i < votes.length; i++) parts.push('v' + (votes[i].tgt || '') + ':' + (votes[i].up || 0) + ':' + (votes[i].dn || 0));
        for (const [k, fold] of compOf) parts.push('f' + k + ':' + ((fold && fold.streamId) || '') + ':' + ((fold && fold.cnt) || 0));
        const sig = parts.join('|');
        if (sig !== __C.recStructSig) { __C.recStructSig = sig; __C.recSrcDirty = true; }
      } catch (e) { __C.recSrcDirty = true; }
    }
    // Scope → { stage banner sources, grid sources }.
    function recScopeSources(scope) {
      const g = recSources();
      if (scope === 'stage') return { stage: g.stage, grid: [] };
      // 'program' is what a kept service records: the stage, or the host
      // alone on it before the strip exists. The strip is video only, so the
      // host's own voice is mixed in as an ear.
      if (scope === 'program') {
        const me = __C.myStatus.stg ? g.row.find((x) => x.me) : null;
        if (g.stage.length) return { stage: g.stage, grid: [], ear: me ? [me] : [] };
        return { stage: me ? [me] : [], grid: [] };
      }
      if (scope === 'row') return { stage: g.stage, grid: g.row };
      return { stage: g.stage, grid: [...g.row, ...g.stadium] }; // 'all' / 'app'
    }
    // Wire one source's audio into the record mix once; created lazily.
    function recMixIn(src) {
      if (!recDest || !src.stream || recSrcs.has(src.key)) return;
      const track = src.stream.getAudioTracks && src.stream.getAudioTracks()[0];
      if (!track) return;
      try {
        const node = __C.ac.createMediaStreamSource(new MediaStream([track]));
        const gain = __C.ac.createGain();
        node.connect(gain); gain.connect(recDest);
        recSrcs.set(src.key, { node, gain });
      } catch (e) {}
    }
    // Every tick: fold in new sources, set each gain by its bus fader (when
    // "match my mix") × consent, and drop sources that left the recorded scope.
    function recSetGains(sources) {
      const live = new Set();
      for (const s of sources) {
        live.add(s.key);
        if (!recSrcs.has(s.key)) recMixIn(s);
        const node = recSrcs.get(s.key);
        if (!node) continue;
        const busGain = recMatchMix ? (mix[s.bus] != null ? mix[s.bus] : 1) : 1;
        node.gain.gain.value = s.mute ? 0 : (s.me ? 1 : busGain); // my own voice always full
      }
      for (const [k, node] of recSrcs) if (!live.has(k)) { try { node.node.disconnect(); } catch (e) {} recSrcs.delete(k); }
    }
    const canScreenRecord = () => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    // mode 'tiles' = on-device grid composite (blur/mute baked in; NO shared app).
    // mode 'app'  = capture this tab via getDisplayMedia so the app AND tiles are
    // recorded as shown; audio still comes from the same mix (your mic included,
    // mute honored) rather than tab audio, so nothing is doubled or missed.
    // Draw one source tile with blur baked in (or an initial-letter placeholder).
    function recDrawTile(ctx, src, x, y, w, h) {
      const v = src.video;
      if (!src.camOff && v && v.videoWidth) {
        const s = Math.min(w / v.videoWidth, h / v.videoHeight);
        const dw = v.videoWidth * s, dh = v.videoHeight * s;
        const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
        const bl = src.me ? 0 : src.blur; // ME is already the pre-blurred outbound; folds are consent-baked
        // On iOS ctx.filter is a no-op, so a blurred guest would record clear
        // without blurDraw, which handles both paths.
        if (bl) blurDraw(ctx, v, dx, dy, dw, dh, blurViewFrac(bl) * Math.max(dw, dh) / Math.max(1, dw)); // a guest's blur, as a receiver's tile shows it
        else ctx.drawImage(v, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = '#14141f'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.fillStyle = '#3a3a55'; ctx.font = 'bold ' + (Math.min(w, h) * .4 | 0) + 'px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((src.label || '•')[0].toUpperCase(), x + w / 2, y + h / 2);
      }
      const lbl = (src.label || '').slice(0, 48);
      ctx.fillStyle = 'rgba(10,10,15,.75)';
      ctx.fillRect(x + 6, y + h - 26, Math.min(w - 12, 12 + lbl.length * 8), 20);
      ctx.fillStyle = '#e0e0f0'; ctx.font = '13px system-ui';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(lbl, x + 10, y + h - 16);
      // PROVENANCE, burned in: the recorder's OWN panel carries the Recording
      // badge inside the recorded pixels — a circulated file always shows who
      // made it. (The live chip everyone sees is DOM; this is the baked copy.)
      if (src.me) recBadge(ctx, x + w / 2, y + 9, w);
    }
    function recBadge(ctx, cx, top, maxW) {
      const txt = '⏺ Recording — ' + ((0, /*()*/__C.myName)() || 'me').slice(0, 32);
      ctx.font = 'bold 13px system-ui';
      const tw = Math.min(ctx.measureText(txt).width, maxW - 24);
      ctx.fillStyle = 'rgba(190,30,40,.88)';
      ctx.fillRect(cx - tw / 2 - 9, top, tw + 18, 22);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, cx, top + 11, maxW - 24);
      ctx.textAlign = 'left';
    }
    function recGrid(ctx, srcs, x, y, w, h) {
      if (!srcs.length) return;
      const cols = Math.ceil(Math.sqrt(srcs.length)), rows = Math.ceil(srcs.length / cols);
      const cw = w / cols, ch = h / rows;
      srcs.forEach((src, i) => recDrawTile(ctx, src, x + (i % cols) * cw, y + ((i / cols) | 0) * ch, cw, ch));
    }
    // opts = { scope:'stage'|'row'|'all'|'app', quality:'low'|'std'|'high', matchMix:bool }.
    // scope 'app' captures this tab via getDisplayMedia so a shared app rides
    // along; the others composite the received tiers on a canvas.
    function pickRecMime() {
      const ladder = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
      try {
        if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
          for (const m of ladder) if (MediaRecorder.isTypeSupported(m)) return m;
        }
      } catch (e) {}
      return '';
    }
    async function startRec(opts) {
      if (recStarting || (recRec && recRec.state !== 'inactive')) return;
      recStarting = true;
      let armed = false;
      let videoTrack = null;
      let stopVideo = () => {};
      let armDraw = null;   // the compositor's metronome subscription, armed only once MediaRecorder took the stream
      let made = null;      // the MediaRecorder this attempt built (unstarted until armed)
      // A failed start returns the sentence the sheet keeps on screen. The
      // status line is rewritten by the meeting census, so it cannot be the
      // only place an error lives.
      const fail = (msg) => { (0, /*()*/__C.setStatus)(msg); return msg; };
      try {
        opts = opts || { scope: 'all', quality: (0, /*()*/__C.recDefaultQuality)(__C.IS_MOBILE), matchMix: true };
        if (!(0, /*()*/__C.ensureAc)()) return fail('This browser cannot record sound.');
        let scope = opts.scope || 'all';
        // A service is the stage. The row and the stadium are not on screen,
        // so a recording of them would be a picture nobody is watching.
        // 'program' (a kept service) is the stage too, with the host alone on
        // it before the strip exists; turning it into 'stage' failed the
        // first try and put "nothing to record" on the live host's line.
        if (__C.BROADCAST && scope !== 'app' && scope !== 'program') scope = 'stage';
        recMatchMix = opts.matchMix !== false;
        recQuality = REC_QUALITY[opts.quality] ? opts.quality : (0, /*()*/__C.recDefaultQuality)(__C.IS_MOBILE);
        recToLib = !!opts.toLibrary;
        const q = REC_QUALITY[recQuality];
        recMode = scope;
        recDest = __C.ac.createMediaStreamDestination();
        recSrcs = new Map();
        if ((scope === 'stage' || scope === 'program') && !recScopeSources(scope).stage.length) {
          recDest = null; recMode = null;
          return fail('No one is on the stage yet — nothing to record.');
        }
        // The container decides the file name and the save picker's type, so
        // it is chosen before either. Safari records mp4 only; an empty answer
        // lets the browser pick and is filed as webm.
        const askMime = pickRecMime();
        recType = askMime || 'video/webm';
        let disp = null;
        if (scope === 'app') {
          // The display picker has to run before the save picker: both want
          // the click, and the tab capture is the one that cannot fall back.
          try {
            disp = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false, preferCurrentTab: true });
          } catch (e) {
            recDest = null; recMode = null;
            return fail('Screen share was cancelled — recording not started.');
          }
          stopVideo = () => { for (const t of disp.getTracks()) { try { t.stop(); } catch (e) {} } };
        }
        const opened = await recOpenSink(recFileName(), !!opts.keep || recToLib);
        if (!opened || opened.kind === 'cancel') {
          if (opened && opened.abort) { try { opened.abort(); } catch (e) {} }
          recDest = null; recMode = null;
          return fail('Recording not started.');
        }
        recSink = opened;
        // The chip is the consent. Paint it and refuse to construct a
        // MediaRecorder unless that paint is actually in the tile. A bot
        // also needs its badge, and an already-on caption needs its chip.
        __C.myStatus.rec = true;
        try { (0, /*()*/__C.updateTile)('me'); (0, /*()*/__C.broadcastStatus)(); } catch (e) {}
        if (!recordingIndicatorsOk()) {
          __C.myStatus.rec = false;
          try { (0, /*()*/__C.updateTile)('me'); (0, /*()*/__C.broadcastStatus)(); (0, /*()*/__V.paintRoomTrust)(); } catch (e) {}
          return fail('Recording stays off until the recording indicator is on screen.');
        }
        if (scope === 'app') {
          videoTrack = disp.getVideoTracks()[0];
          if (videoTrack) videoTrack.onended = () => { if (recRec && recRec.state !== 'inactive') { try { recRec.stop(); } catch (e) {} } };
          // The tab is captured visually; audio still comes from the full mix
          // (everything you hear, your mic included), honoring your faders.
          const pump = () => { const s = recSources(); recSetGains([...s.stage, ...s.row, ...s.stadium]); };
          pump(); armDraw = () => metroSub(pump);
        } else {
          const canvas = document.createElement('canvas');
          canvas.width = q.w; canvas.height = q.h;
          const ctx = canvas.getContext('2d');
          const draw = () => {
            const { stage, grid, ear } = recScopeSources(scope);
            recSetGains([...stage, ...grid, ...(ear || [])]);
            ctx.filter = 'none';
            ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (stage.length && grid.length) {
              const bh = Math.round(canvas.height * 0.42); // the stage banners the top, verbatim
              recGrid(ctx, stage, 0, 0, canvas.width, bh);
              recGrid(ctx, grid, 0, bh, canvas.width, canvas.height - bh);
            } else {
              recGrid(ctx, stage.concat(grid), 0, 0, canvas.width, canvas.height); // one tier fills the frame
            }
            if (![...stage, ...grid].some((s) => s.me)) recBadge(ctx, canvas.width - 130, canvas.height - 34, 236);
          };
          draw();
          // The worker metronome (~15 fps) keeps compositing while the tab is
          // hidden. It is subscribed only once MediaRecorder has accepted the
          // stream: Safari throws on a webm mime, and a subscribe before that
          // throw left the compositor and the audio graph running.
          armDraw = () => metroSub(draw);
          videoTrack = canvas.captureStream(15).getVideoTracks()[0];
        }
        // A silent floor under the mix. A MediaStreamDestination with nothing
        // connected carries no audio frames at all (Chromium), and the webm
        // muxer holds every video frame until the first audio frame: a meeting
        // where nobody in scope has a mic track (all muted, or a camera-only
        // room) recorded a 0-byte file. A zero-offset source keeps frames coming.
        try { recFloor = __C.ac.createConstantSource(); recFloor.offset.value = 0; recFloor.connect(recDest); recFloor.start(); } catch (e) { recFloor = null; }
        const stream = new MediaStream();
        if (videoTrack) stream.addTrack(videoTrack);
        for (const tr of recDest.stream.getAudioTracks()) stream.addTrack(tr);
        const recOpts = { videoBitsPerSecond: q.v, audioBitsPerSecond: 96000 };
        if (askMime) recOpts.mimeType = askMime;
        try { made = new MediaRecorder(stream, recOpts); }
        catch (e) { return fail('This browser cannot record the meeting.'); }
        recRec = made;
        recDraw = armDraw ? armDraw() : null;
        recRec.ondataavailable = (e) => { if (e.data && e.data.size && recSink) recSink.write(e.data); };
        recRec.onstop = async () => {
          // Detach this session before the first await. onstop used to be
          // synchronous, so a second start could not land in the middle of it.
          const sink = recSink;
          recSink = null;
          const drawOff = recDraw;
          recDraw = null;
          if (typeof drawOff === 'function') drawOff();
          clearInterval(recTimer);
          recTimer = null;
          stopVideo();
          const srcs = recSrcs;
          recSrcs = new Map();
          recStopFloor();
          recDest = null;
          recMode = null;
          for (const m of srcs.values()) { try { m.node.disconnect(); } catch (e) {} }
          let saved = null;
          try { if (sink) saved = await sink.finish(); } catch (e) { saved = null; }
          let how = '';
          const toLib = recToLib;
          recToLib = false;
          try { how = toLib && saved && saved.href && !saved.held && !__C.bcSeeding ? recToLibrary(saved) : recDeliver(saved); } catch (e) { how = ''; }
          if (typeof window !== 'undefined' && typeof window.__gifosRecStopped === 'function') {
            const cb = window.__gifosRecStopped;
            window.__gifosRecStopped = null;
            try { cb(how); } catch (e) {}
          }
          const replaced = recStarting || (recRec && recRec.state !== 'inactive');
          if (!replaced) {
            __V.recBtn.classList.remove('on');
            __V.recBtn.textContent = (0, /*()*/__C.uiText)('record', 'Record');
            __C.myStatus.rec = false;
            try { (0, /*()*/__C.broadcastStatus)(); (0, /*()*/__V.paintRoomTrust)(); } catch (e) {}
          }
          if (recReloadAfterStop) {
            recReloadAfterStop = false;
            if (how === 'download') setTimeout(() => location.reload(), 500);
            else location.reload();
            return;
          }
          if (recRestart) { const o = recRestart; recRestart = null; startRec(o); }
        };
        try { recRec.start(1000); }
        catch (e) { return fail('This browser cannot record the meeting.'); }
        armed = true;
        recStart = Date.now();
        __V.recBtn.classList.add('on');
        recTimer = setInterval(() => {
          const sec = ((Date.now() - recStart) / 1000) | 0;
          __V.recBtn.textContent = 'Stop ' + ((sec / 60) | 0) + ':' + ('0' + sec % 60).slice(-2);
        }, 1000);
        __V.recBtn.textContent = 'Stop 0:00';
        __C.myStatus.rec = true;
        (0, /*()*/__C.broadcastStatus)();
        try { (0, /*()*/__V.paintRoomTrust)(); } catch (e) {}
        if (recIndWatch) clearInterval(recIndWatch);
        recIndWatch = setInterval(() => {
          if (!recRec || recRec.state === 'inactive') { clearInterval(recIndWatch); recIndWatch = null; return; }
          if (!recordingIndicatorsOk()) { try { recRec.stop(); } catch (e) {} }
        }, 1000);
      } finally {
        if (!armed) {
          // Nothing is recording: release everything this attempt took — the
          // metronome, the tab capture, the canvas track, the file, and the
          // audio graph recSetGains wired into recDest.
          if (typeof recDraw === 'function') { try { const u = recDraw; recDraw = null; u(); } catch (e) {} }
          try { stopVideo(); } catch (e) {}
          if (videoTrack) { try { videoTrack.stop(); } catch (e) {} }
          const s = recSink; recSink = null;
          if (s && s.abort) { try { s.abort(); } catch (e) {} }
          for (const m of recSrcs.values()) { try { m.node.disconnect(); } catch (e) {} }
          recSrcs = new Map();
          recStopFloor();
          if (made && recRec === made) { try { made.onstop = null; made.ondataavailable = null; } catch (e) {} recRec = null; }
          recDest = null; recMode = null;
          if (__C.myStatus.rec) {
            __C.myStatus.rec = false;
            try { (0, /*()*/__C.updateTile)('me'); (0, /*()*/__C.broadcastStatus)(); (0, /*()*/__V.paintRoomTrust)(); } catch (e) {}
          }
        }
        recStarting = false;
      }
    }
    let recFloor = null;   // the silent source under the record mix (startRec)
    function recStopFloor() { const f = recFloor; recFloor = null; if (f) { try { f.stop(); } catch (e) {} try { f.disconnect(); } catch (e) {} } }
    yield 2834;
    function warnRecorderNewApp() {
      if (!(recRec && recRec.state !== 'inactive')) return;
      if (recMode === 'app' || !canScreenRecord()) return;
      if (document.getElementById('rec-warn')) return;
      const bg = document.createElement('div'); bg.className = 'name-modal'; bg.id = 'rec-warn';
      bg.innerHTML = '<div class="name-box" style="max-width:420px;text-align:left">' +
        '<h3>An app is now on stage</h3>' +
        '<p style="color:#aab">Your recording is capturing the video tiles only, so it won’t include the shared app. To capture it, restart the recording and choose “Record with the app”.</p>' +
        '<div style="display:flex;gap:.5rem;justify-content:flex-end">' +
        '<button id="rw-keep" class="lob-ghost">Keep recording tiles</button>' +
        '<button id="rw-restart">Restart with the app</button></div></div>';
      document.body.appendChild(bg);
      const close = openModal(bg, () => { if (bg.parentNode) bg.remove(); });
      bg.querySelector('#rw-keep').onclick = () => close();
      bg.querySelector('#rw-restart').onclick = () => {
        close(); recRestart = { scope: 'app', quality: recQuality, matchMix: recMatchMix, toLibrary: recToLib };
        if (recRec && recRec.state !== 'inactive') { try { recRec.stop(); } catch (e) {} }
      };
    }
    __V.recBtn.onclick = () => {
      if (__C.BROADCAST && (0, /*()*/__C.bcRole)() !== 'host') return;
      if (recStarting) return;
      if (recRec && recRec.state !== 'inactive') {
        if (__C.BROADCAST && (0, /*()*/__C.bcHostStored)()) __C.bcKeepUserStop = true;
        // Halt the 15fps compositor BEFORE stop(): stop() makes the encoder
        // flush its backlog, and on a weak/software-rendered device the
        // still-running composite loop starves that flush — onstop (and the
        // download) can stall for minutes. Unsubscribing here is idempotent
        // (metroSub returns a Set.delete), so onstop's own cleanup stays safe.
        if (typeof recDraw === 'function') { try { recDraw(); } catch (e) {} }
        try { recRec.stop(); } catch (e) {} recRec = null; return;
      }
      (0, /*()*/__V.showRecOptions)();
    };
    let callStateBox = '';
    yield 2895; // knock-first: the boot's own getUserMedia while it is in flight — THE one ask; lateMedia must join it, never race it
    // NO CAMERA IS NOT NO MICROPHONE. A combined camera+mic ask rejects as a
    // whole when the camera is missing, disabled by policy or held by another
    // app (NotFoundError / NotReadableError / OverconstrainedError), and the
    // microphone was lost with it: every webcam-less desktop joined view-only
    // for life and was told to close an app that did not exist. So a combined
    // ask that fails for any reason but a REFUSAL is asked again for audio
    // alone. A refusal (NotAllowedError / SecurityError) is the user's answer
    // and is never re-asked: one prompt per tap, never two.
    // Resolves { stream, camErr }: camErr is the camera's error when the
    // stream is the audio-only fallback, else null.
    function gumRefused(e) { return !!(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')); }
    function gumWithMicFallback(md, constraints) {
      return md.getUserMedia(constraints).then((stream) => ({ stream, camErr: null }), (e) => {
        if (!constraints.video || !constraints.audio || gumRefused(e)) throw e;
        return md.getUserMedia({ audio: true }).then((stream) => ({ stream, camErr: e }));
      });
    }
    // The mesh may have been built recvonly (we had nothing to offer when the
    // pc was born) — add our tracks to every live pc and re-offer; perfect
    // negotiation absorbs it, and the fresh m-lines guarantee an ontrack on
    // the far side. Tracks register as MAIN senders (p.mainV/p.mainA), the set
    // refreshOutbound owns — a late-added track obeys the same rules
    // (row-mates only; parked while staged) as a join-time one. Shared by
    // lateMedia (a camera granted mid-call by a tap) and the boot path (a
    // camera granted AFTER the knock — the knock never waits on the prompt).
    function attachLocalTracks() {
      if (!__C.localStream || (__C.BC_SEAT && !(0, /*()*/__C.bcMayPublishAv)())) return;
      for (const [pid, p] of __C.peers) {
        if (!p.pc || !(0, /*()*/__C.camPeer)(pid) || p.headless) continue;   // camPeer: row-mates and vouched pipe peers; never a standby's pc
        let added = false;
        for (const tr of __C.localStream.getTracks()) {
          if (tr.kind === 'video' ? p.mainV : (p.mainA || !(0, /*()*/__C.micPeer)(pid))) continue;   // the mic: row-mates only
          try {
            const t = p.pc.addTransceiver(tr.kind === 'audio' ? (mainAudioTrack() || tr) : tr, { streams: [__C.localStream] });
            if (tr.kind === 'video') p.mainV = t.sender; else p.mainA = t.sender;
            added = true;
          } catch (e) {}
        }
        if (added) { if (p.dc && p.dc.readyState === 'open') compKick(pid); else (0, /*()*/__C.renegotiate)(p); }
      }
    }
    // A late grant must honour the room's orders exactly as the buttons do: an
    // admin's video-off keeps the camera off, and a room-wide mute keeps the
    // microphone off, even when the permission is answered after the order.
    function lateRefusal(kind) {
      if (kind === 'cam' && (0, /*()*/__C.forcedCamOff)('me')) return '📷 A host turned your video off for the room — only they can turn it back on.';
      if (kind === 'mic' && (0, /*()*/__C.amGloballyMuted)()) return (0, /*()*/__C.micLockWords)();
      return null;
    }
    // Test hooks only: the held camera track, opened (disabled) when none is held.
    function camTrackForTest() {
      const held = __C.localStream && __C.localStream.getVideoTracks()[0];
      if (held) return Promise.resolve(held);
      const md = navigator.mediaDevices;
      if (!md || !md.getUserMedia) return Promise.resolve(null);
      return md.getUserMedia({ video: camVideoConstraints() }).then((s) => {
        const t = s.getVideoTracks()[0];
        if (!t) return null;
        t.enabled = false;
        if (!__C.localStream) __C.localStream = s; else __C.localStream.addTrack(t);
        attachLocalTracks();
        return t;
      }, () => null);
    }
    // A control tapped while an ask was open joined that ask (lateWant). When
    // the ask lands without that kind (a Camera tap during a Mic tap's
    // mic-only ask), the joined tap is asked for now, on its own: a tap is
    // never dropped. An app room never opens a camera.
    function askJoinedLeft(want, kind, appRoom) {
      for (const k of want) {
        if (k === kind || (appRoom && k === 'cam')) continue;
        const held = __C.localStream && (k === 'cam' ? __C.localStream.getVideoTracks() : __C.localStream.getAudioTracks())[0];
        if (isQuietMic(held) && !lateRefusal(k)) setMicOn(held, true);   // a phone's stand-in: open the microphone
        else if (!held && !lateRefusal(k)) lateMedia(k);
      }
    }
    // pick: a microphone chosen in the mic chooser before any mic was open
    // (a quiet join holds none): the ask names that device.
    function lateMedia(kind, pick) {
      if (__C.capClosed) return;   // the meeting has ended for this page (left, or turned away at a full door): ask nothing, say nothing
      if ((0, /*()*/__C.bcWatchingViewer)()) return;
      if (__C.myStatus.bot) { (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stABotDoesNotUse', 'A bot does not use a camera or speak.')); return; }
      if (__C.BC_SEAT && !(0, /*()*/__C.bcMayPublishAv)()) { (0, /*()*/__C.enforceBroadcastSeat)(); return; }
      if (lateRefusal(kind)) { (0, /*()*/__C.setStatus)(lateRefusal(kind)); return; }
      if (__C.lateAsk) { if (__C.lateWant) __C.lateWant.add(kind); (0, /*()*/__C.sayState)('stillAsking'); return; }
      // THE BOOT ASK IS THE ONLY ASK (knock-first, 2026-08-05): the knock no
      // longer waits on getUserMedia, so "page live, localStream still null"
      // is a NORMAL window on every boot — and a cam/mic tap in that window
      // used to start a SECOND gUM racing the boot's own (behavior 24a: the
      // broadcast host stuck blurred >30s — two streams tangled, the enable
      // landed on tracks that were then thrown away). Join the pending ask:
      // when it lands, enabling the tapped kind is a plain track flip; if it
      // failed (denied/hung), fall through to the fresh re-prompt below.
      if (__C.bootGumPending) {
        const p = __C.bootGumPending;
        (0, /*()*/__C.sayState)('askingMedia');
        p.then(() => {
          if (__C.BC_SEAT && !(0, /*()*/__C.bcMayPublishAv)()) { (0, /*()*/__C.enforceBroadcastSeat)(); return; }
          if ((0, /*()*/__C.bcWatchingViewer)()) return;
          const tr = __C.localStream && (kind === 'cam' ? __C.localStream.getVideoTracks() : __C.localStream.getAudioTracks())[0];
          if (!tr) return lateMedia(kind);
          if (lateRefusal(kind)) { (0, /*()*/__C.setStatus)(lateRefusal(kind)); return; }
          if (isQuietMic(tr)) { setMicOn(tr, true); return; }   // a phone's stand-in: the tap opens the microphone
          tr.enabled = true;
          if (kind === 'mic') __C.myStatus.muted = false; else __C.myStatus.camOff = false;
          (0, /*()*/__V.paintControls)(); refreshOutbound(); (0, /*()*/__C.broadcastStatus)(); (0, /*()*/__C.reactRoomState)(); (0, /*()*/__C.updateMediaSession)();
          if (kind === 'cam') (0, /*()*/__C.setStatus)(typeof __C.camOnWords === 'function' ? (0, /*()*/__C.camOnWords)() : (0, /*()*/__C.statusWords)('camOn')); else (0, /*()*/__C.sayState)('micOn');
          if (typeof syncSpeech === 'function') syncSpeech();   // after the status: a caption notice it says stays on screen
        }, () => lateMedia(kind));
        return;
      }
      const md = navigator.mediaDevices;
      if (!md || !md.getUserMedia) {
        (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stThisBrowserCanTShare', 'This browser can’t share a camera or microphone here. Open this meeting link in Safari or Chrome — the Invite button copies it.'));
        return;
      }
      __C.lateAsk = true;
      const want = __C.lateWant = new Set([kind]);
      // An app-pinned room is audio-only (0.9.12): never prompt for a camera
      // there — the browser's permission sheet would say "camera" to a person
      // who was promised none, and a granted-but-disabled track is still a
      // camera we took.
      const appRoom = document.body.classList.contains('app-room');
      (0, /*()*/__C.sayState)((appRoom || kind === 'mic') ? 'askingMic' : 'askingMedia');   // name only what is asked for
      // A camera tap while the mic is already held asks for video alone: the
      // held mic is never re-taken, and a missing camera then fails on its own.
      const haveMic = !!(__C.localStream && __C.localStream.getAudioTracks()[0]);
      // A Mic tap asks for the microphone alone. A camera taken with it would be
      // held as a disabled, live track: a camera light over a page that says
      // camera off (A CAMERA THAT IS OFF IS NOT OPEN). Since a quiet join opens
      // nothing, this tap is how most people's mic opens.
      const micAsk = pick ? { deviceId: { exact: pick } } : true;
      const ask = (appRoom || kind === 'mic') ? { audio: micAsk } : haveMic ? { video: camVideoConstraints() } : { video: camVideoConstraints(), audio: true };
      const gen = ++__C.lateGen, won0 = __C.lateWon;
      __C.lateTimer = setTimeout(() => {
        if (gen !== __C.lateGen || !__C.lateAsk) return;
        __C.lateAsk = false;
        (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stTheBrowserHasNotAnswered', 'The browser has not answered the camera and microphone ask. Check this site\u2019s permissions in the browser settings \u2014 or open this meeting link in Safari or Chrome.'));
      }, __C.LATE_ASK_MS);
      gumWithMicFallback(md, ask)
        .then(({ stream: s, camErr }) => {
          if (__C.BC_SEAT && !(0, /*()*/__C.bcMayPublishAv)()) {
            try { for (const tr of s.getTracks()) tr.stop(); } catch (e) {}
            if (gen === __C.lateGen) __C.lateAsk = false;
            (0, /*()*/__C.enforceBroadcastSeat)();
            return;
          }
          if (__C.lateWon !== won0) {
            // A grant already landed: keep that stream, release this one.
            try { for (const tr of s.getTracks()) tr.stop(); } catch (e) {}
            if (gen === __C.lateGen) __C.lateAsk = false;
            let flipped = false;
            for (const k of want) {
              const held = __C.localStream && (k === 'cam' ? __C.localStream.getVideoTracks() : __C.localStream.getAudioTracks())[0];
              if (isQuietMic(held) && !lateRefusal(k)) { setMicOn(held, true); continue; }   // a phone's stand-in: open the microphone
              if (held && !held.enabled && !lateRefusal(k)) {
                held.enabled = true;
                if (k === 'mic') __C.myStatus.muted = false; else __C.myStatus.camOff = false;
                flipped = true;
              }
            }
            if (flipped) {
              (0, /*()*/__V.paintControls)(); refreshOutbound(); (0, /*()*/__C.broadcastStatus)(); (0, /*()*/__C.reactRoomState)(); (0, /*()*/__C.updateMediaSession)();
              if (kind === 'cam') (0, /*()*/__C.setStatus)(typeof __C.camOnWords === 'function' ? (0, /*()*/__C.camOnWords)() : (0, /*()*/__C.statusWords)('camOn')); else (0, /*()*/__C.sayState)('micOn');
              if (typeof syncSpeech === 'function') syncSpeech();   // after the status: a caption notice it says stays on screen
            }
            askJoinedLeft(want, kind, appRoom);
            return;
          }
          __C.lateWon++;
          clearTimeout(__C.lateTimer);
          __C.lateAsk = false;
          if (pick) micDeviceId = pick;   // the chooser's pick is the mic in use
          // Quiet-join discipline still holds: only the tapped controls go on
          // (this tap and any joined while the ask was open), and not one a
          // room order arrived for during the ask.
          const refused = lateRefusal(kind);
          const goesOn = (k) => want.has(k) && !lateRefusal(k);
          for (const tr of s.getTracks()) tr.enabled = goesOn(tr.kind === 'video' ? 'cam' : 'mic');
          if (!__C.localStream) {
            __C.localStream = s;
            maybeShowFlip();
            const n = __C.meTile.tile.querySelector('.note'); if (n) n.remove();
            __C.meTile.video.style.display = '';
            // The self tile is bound by refreshOutbound below, to the picture this page sends.
            (0, /*()*/__C.meterFor)('me', __C.localStream);
          } else {
            // partial stream (mic-only / cam-only): merge the missing kinds
            // into the SAME stream — its id is our announced identity.
            for (const tr of s.getTracks()) {
              if (__C.localStream.getTracks().some((t) => t.kind === tr.kind)) { try { tr.stop(); } catch (e) {} }
              else __C.localStream.addTrack(tr);
            }
            // A joined control whose track was already held goes on as a plain flip.
            for (const k of want) {
              const held = k !== kind && (k === 'cam' ? __C.localStream.getVideoTracks() : __C.localStream.getAudioTracks())[0];
              if (isQuietMic(held) && goesOn(k)) setMicOn(held, true);
              else if (held && !held.enabled && goesOn(k)) held.enabled = true;
            }
          }
          // The camera goes on only when a video track was actually taken:
          // the audio-only fallback lands the mic (quiet) and says why.
          const gotCam = !!__C.localStream.getVideoTracks()[0];
          // A camera tap while the person is already talking must not mark that
          // live mic muted. Quiet join still holds when this tap brought the mic:
          // that new audio track was left disabled above.
          const micTr = __C.localStream && __C.localStream.getAudioTracks()[0];
          if (kind === 'mic') __C.myStatus.muted = !!refused || !(micTr && micTr.enabled);
          else __C.myStatus.muted = micTr ? !micTr.enabled : true;
          __C.myStatus.camOff = !want.has('cam') || !gotCam || !!lateRefusal('cam');
          attachLocalTracks();
          micLetGo();   // a phone's Camera tap took the microphone with the camera, switched off: let it go at once
          (0, /*()*/__V.paintControls)();
          refreshOutbound();
          (0, /*()*/__C.broadcastStatus)();
          (0, /*()*/__C.reactRoomState)();
          (0, /*()*/__C.updateMediaSession)();
          if (refused) (0, /*()*/__C.setStatus)(refused);
          else (0, /*()*/__C.setStatus)(kind === 'cam'
            ? (gotCam ? (typeof __C.camOnWords === 'function' ? (0, /*()*/__C.camOnWords)() : 'Camera on.') : 'No camera on this device (' + ((camErr && camErr.name) || 'error') + '). Your microphone is ready — tap the mic button to talk.')
            : 'Mic on.');
          // After the status: a notice syncSpeech says (captions unavailable on
          // this phone) must not be overwritten by "Mic on." in the same task.
          if (typeof syncSpeech === 'function') syncSpeech();
          if (typeof noteAudioDevices === 'function') noteAudioDevices();
          askJoinedLeft(want, kind, appRoom);
        })
        .catch((err) => {
          if (gen !== __C.lateGen || __C.lateWon !== won0) return;
          clearTimeout(__C.lateTimer);
          __C.lateAsk = false;
          if (typeof __C.avEvent === 'function') (0, /*()*/__C.avEvent)(gumRefused(err) ? 'denied' : 'failed', { kind: kind, name: String((err && err.name) || 'error') });
          if (pick && !gumRefused(err)) { (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stMicPickFailed', 'That microphone could not be opened. Your mic did not change.')); return; }
          const name = (err && err.name) || 'error';
          const what = ask.audio ? (ask.video ? 'camera or microphone' : 'microphone') : 'camera'; // name only what was asked for
          (0, /*()*/__C.setStatus)(gumRefused(err)
            ? 'The browser refused the camera & microphone. Check this site’s permissions in the browser settings — or open this meeting link in Safari or Chrome (some browsers, and links opened inside another app, block calls).'
            : name === 'NotFoundError'
              ? 'No ' + what + ' was found on this device (NotFoundError). Plug one in and tap again.'
              : 'No usable ' + what + ' (' + name + '). Another app may be holding it — close it and tap again.');
        });
    }

    // ONE MIC TAP. chooser: the tap came from the dock's Mic button, beside
    // the chooser it opens. The float's mic button and the OS mic toggle pass
    // false: the chooser is drawn in the meeting page, which the person cannot
    // see from there, so a muted tap there unmutes at once with the mic in use
    // or the one picked before (the browser's own choice when none was).
    // Only a microphone is ever asked for: the camera stays as it is.
    function micTap(chooser) {
      if (__C.capClosed) return;   // no meeting here now (left, or turned away): no device ask, no device words
      if (typeof __C.avWhy === 'function') (0, /*()*/__C.avWhy)('tap');
      if ((0, /*()*/__C.bcWatchingViewer)()) return;
      if (typeof __C.outgoingHeld !== 'undefined' && __C.outgoingHeld) return;
      if (__C.BC_SEAT && !(0, /*()*/__C.bcMayPublishAv)()) { (0, /*()*/__C.enforceBroadcastSeat)(); return; }
      if (document.body.classList.contains('app-room') && !(0, /*()*/__V.roomAudioOn)()) { (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stTalkIsOffOnlyThe', 'Talk is off — only the app host can turn it on.')); return; }
      const track = __C.localStream && __C.localStream.getAudioTracks()[0];
      if (!track) {
        // No mic open yet (a quiet join opens none): with two or more known
        // microphones the tap asks which one, as it does over a held mic.
        if (!chooser) { if (micChooserOpen()) closeMicChooser(false); return lateMedia('mic', micInputs.some((m) => m.id === micDeviceId) ? micDeviceId : undefined); }
        if (micChooserOpen()) { closeMicChooser(true); return; }
        if (micInputs.length > 1 && !__C.bootGumPending && !__C.lateAsk) { openMicChooser(null); return; }
        return lateMedia('mic');
      }
      const on = track.enabled || (isQuietMic(track) && micOpening);   // an unmute still opening the microphone is on
      if (!on && (0, /*()*/__C.amGloballyMuted)()) { (0, /*()*/__C.sayState)((0, /*()*/__C.modOf)('me').mute && (0, /*()*/__C.modOf)('me').mute.wait ? 'micWaitRoom' : 'mutedByHost', { by: ((0, /*()*/__C.modOf)('me').mute || {}).by }); return; }
      if (micChooserOpen()) { closeMicChooser(chooser); if (chooser) return; }
      // More than one microphone: a tap while muted asks which one (the camera
      // button's chooser, for the mic). A tap while talking mutes at once. One
      // microphone: the tap toggles, as it always has.
      if (chooser && !on && micInputs.length > 1) { openMicChooser(track); return; }   // one mic: the tap unmutes, as it always has
      setMicOn(track, !on);
    }
    __V.micBtn.onclick = () => micTap(true);
    function setMicOn(track, on) {
      if (isQuietMic(track)) {
        // A phone's let-go microphone. On: open it again (it goes on the senders when it opens; the button shows on
        // at once). Off while it is still opening: it lands switched off and is let go again.
        __C.myStatus.muted = !on;
        (0, /*()*/__V.paintControls)();
        if (on && !micOpening) {
          micOpening = true; __C.micUnmuteAfter = 'tap';
          setMicMode(__C.micMode, true);
          if (!__C.micGrabbing) { micOpening = false; __C.micUnmuteAfter = false; __C.myStatus.muted = true; (0, /*()*/__V.paintControls)(); }   // nothing could be opened here (held, or no stream)
        }
        return;
      }
      track.enabled = !!on;
      __C.myStatus.muted = !track.enabled;
      (0, /*()*/__V.paintControls)();
      syncSpeech(); // my own voice leaves the captions while muted; the others' voices stay
      (0, /*()*/__C.broadcastStatus)();
      (0, /*()*/__C.updateMediaSession)();
      // shipMos treats an enabled-flip as the same track set and does not
      // replaceTrack. A stage sender born on a disabled mic keeps sending
      // silence until it is seated again. Same kick as a camera that is
      // attached and emitting nothing (kickMainVideo), audio side.
      if (track.enabled) { clearTimeout(micLetGoT); micLetGoT = 0; kickStageMic(track); }
      else micLetGoSoon();
    }
    // The mic in use: its device id as the track reports it, and a name for it.
    // The row of the mic this track came from. A track opened on the
    // browser's own choice reports Chromium's 'default' alias, which has no
    // row of its own: the row with the same groupId (the same physical
    // device) is that mic.
    function micIdOf(track) {
      let st = null; try { st = track && track.getSettings ? track.getSettings() : null; } catch (e) {}
      const id = String((st && st.deviceId) || '');
      if (id && micInputs.some((m) => m.id === id)) return id;
      const g = String((st && st.groupId) || '');
      const m = g ? micInputs.find((x) => x.group === g) : null;
      return m ? m.id : (micDeviceId || (micInputs.length === 1 ? micInputs[0].id : id));   // a device that names no row: the person's own pick is what it opened (with one mic, that mic)
    }
    function micLabelOf(track) {
      const id = micIdOf(track);
      const m = micInputs.find((x) => x.id === id);
      return (m && m.label) || (track && track.label) || (0, /*()*/__C.uiText)('micUnnamed', 'Microphone');
    }
    function micChooserOpen() {
      const el = document.getElementById('micchooser');
      return !!(el && !el.hidden);
    }
    function closeMicChooser(refocus) {
      const el = document.getElementById('micchooser');
      const from = (el && el.dataset.from === 'spk') ? document.getElementById('spkbtn') : __V.micBtn;
      if (el) { el.hidden = true; delete el.dataset.from; }
      try { __V.micBtn.setAttribute('aria-expanded', 'false'); } catch (e) {}
      try { const sb = document.getElementById('spkbtn'); if (sb) sb.setAttribute('aria-expanded', 'false'); } catch (e) {}
      if (refocus && from) { try { from.focus(); } catch (e) {} }
    }
    yield 2910;
    { const sb = document.getElementById('spkbtn'); if (sb) sb.onclick = () => { if (micChooserOpen()) closeMicChooser(true); else openSpkChooser(); }; }
    function openSpkChooser() {
      const el = document.getElementById('micchooser'), sb = document.getElementById('spkbtn');
      const spk = speakerChoices();
      if (!el || !sb || !spk.length) return;
      try { if (camChooserOpen()) closeCamChooser(); } catch (e) {}
      el.textContent = '';
      el.dataset.from = 'spk';
      el.setAttribute('aria-label', (0, /*()*/__C.uiText)('spkChooseAria', 'Choose a speaker'));
      const on = spkDeviceId || ((spk.find((x) => spkDefGroup && x.group === spkDefGroup) || spk[0]).id);
      spk.forEach((m, i) => {
        const b = devRow(m.label || (0, /*()*/__C.uiText)('spkNumbered', 'Speaker {n}').replace('{n}', String(i + 1)), m.id === on, () => pickSpeaker(m.id));
        b.dataset.spkId = m.id;
        el.appendChild(b);
      });
      el.hidden = false;
      sb.setAttribute('aria-expanded', 'true');
      (0, /*()*/__V.placeDockPopover)(el, sb);
      const first = el.querySelector('[aria-checked="true"]') || el.querySelector('button');
      if (first) { try { first.focus(); } catch (e) {} }
    }
    function openMicChooser(track) {
      const el = document.getElementById('micchooser');
      if (!el) { if (track) setMicOn(track, true); else lateMedia('mic'); return; }
      try { if (camChooserOpen()) closeCamChooser(); } catch (e) {}
      const cur = micIdOf(track);
      const spk = speakerChoices();
      el.textContent = '';
      el.setAttribute('aria-label', spk.length ? (0, /*()*/__C.uiText)('micSpkChooseAria', 'Choose a microphone or speaker') : (0, /*()*/__C.uiText)('micChooseAria', 'Choose a microphone'));
      if (spk.length) devHead(el, (0, /*()*/__C.uiText)('micHead', 'Microphone'));
      const last = micInputs.some((m) => m.id === cur) ? cur : (micInputs.some((m) => m.id === micDeviceId) ? micDeviceId : (micInputs[0] || {}).id);
      micOrderOf(micInputs, last).forEach((m, i) => {
        const b = devRow(m.label || (0, /*()*/__C.uiText)('micNumbered', 'Microphone {n}').replace('{n}', String(i + 1)), m.id === last, () => pickMic(m.id));
        b.dataset.micId = m.id;
        el.appendChild(b);
      });
      if (spk.length) {
        devHead(el, (0, /*()*/__C.uiText)('spkHead', 'Speaker'));
        const on = spkDeviceId || ((spk.find((x) => spkDefGroup && x.group === spkDefGroup) || spk[0]).id);
        spk.forEach((m, i) => {
          const b = devRow(m.label || (0, /*()*/__C.uiText)('spkNumbered', 'Speaker {n}').replace('{n}', String(i + 1)), m.id === on, () => pickSpeaker(m.id));
          b.dataset.spkId = m.id;
          el.appendChild(b);
        });
      }
      el.hidden = false;
      __V.micBtn.setAttribute('aria-expanded', 'true');
      (0, /*()*/__V.placeDockPopover)(el, __V.micBtn);
      const first = el.querySelector('[aria-checked="true"]') || el.querySelector('button');
      if (first) { try { first.focus(); } catch (e) {} }
    }
    // A pick turns the mic on with that microphone. The same mic only unmutes;
    // another one is opened in place of the current one (setMicMode's re-grab,
    // which swaps the track on every sender), then unmutes, so the others go on
    // hearing this person through the switch.
    function pickMic(id) {
      closeMicChooser(true);
      const track = __C.localStream && __C.localStream.getAudioTracks()[0];
      if (!track) { lateMedia('mic', id); return; }   // no mic open yet: open the picked one (a refusal says so, nothing changes)
      if ((0, /*()*/__C.amGloballyMuted)()) { (0, /*()*/__C.sayState)((0, /*()*/__C.modOf)('me').mute && (0, /*()*/__C.modOf)('me').mute.wait ? 'micWaitRoom' : 'mutedByHost', { by: ((0, /*()*/__C.modOf)('me').mute || {}).by }); return; }
      if (id === micIdOf(track)) { setMicOn(track, true); return; }
      __C.micPickPrev = micDeviceId;   // a pick that will not open goes back to this one (the camera's camPickPrev)
      micDeviceId = id;
      if (isQuietMic(track)) { micOpening = true; __C.myStatus.muted = false; (0, /*()*/__V.paintControls)(); }   // a phone's let-go mic: on at once, as a tap
      __C.micUnmuteAfter = true;
      setMicMode(__C.micMode, true);
    }
    // One row of a device pop-up, and a section name over rows.
    function devRow(text, checked, onPick) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitemradio');
      b.setAttribute('aria-checked', String(!!checked));
      b.textContent = text;
      b.onclick = onPick;
      return b;
    }
    function devHead(el, text) {
      const h = document.createElement('div');
      h.className = 'devhead';
      h.setAttribute('role', 'presentation');
      h.textContent = text;
      el.appendChild(h);
    }
    // A speaker pick moves every element that plays the meeting; the mic
    // stays as it was. applySpeaker also runs on the audio sweeps, so a voice
    // that joins later plays on the same speaker.
    function pickSpeaker(id) {
      closeMicChooser(true);
      const def = speakerChoices().find((x) => spkDefGroup && x.group === spkDefGroup);
      spkDeviceId = (def && def.id === id) ? '' : id;
      const row = spkOutputs.find((x) => x.id === id);
      const name = (row && row.label) || (0, /*()*/__C.uiText)('spkUnnamed', 'Speaker');
      applySpeaker().then((ok) => {
        (0, /*()*/__C.setStatus)(ok ? (0, /*()*/__C.uiText)('stSpkNamed', 'Sound now plays on: {name}').replace('{name}', name) : (0, /*()*/__C.uiText)('stSpkPickFailed', 'That speaker could not be used. Sound stays where it was.'));
      });
    }
    function audioCarriers() {
      const out = new Set();
      for (const a of document.querySelectorAll('audio')) out.add(a);
      for (const v of document.querySelectorAll('video')) if (v._aud) out.add(v._aud);
      try { if (stageEar && stageEar.el) out.add(stageEar.el); } catch (e) {}
      try { if (typeof wkEar !== 'undefined' && wkEar && wkEar.el) out.add(wkEar.el); } catch (e) {}
      try { for (const m of __C.mosIn.values()) if (m && m.el && !m.el.muted) out.add(m.el); } catch (e) {}
      return out;
    }
    window.__meetSpeaker = () => { const els = [...audioCarriers()]; return { want: spkDeviceId, sinks: els.map((e) => String(e.sinkId || '')), voice: els.map((e) => { try { const st = e.srcObject; return !!(st && st.getAudioTracks && st.getAudioTracks().some((t) => t.readyState === 'live')); } catch (x) { return false; } }) }; };   // read-only: where each playing element sends sound, and whether it carries a voice at all
    function applySpeaker() {
      if (!SINK_OK) return Promise.resolve(true);
      const jobs = [];
      for (const el of audioCarriers()) {
        if (!el || typeof el.setSinkId !== 'function' || String(el.sinkId || '') === spkDeviceId) continue;
        jobs.push(el.setSinkId(spkDeviceId).then(() => true, () => false));
      }
      if (typeof carryOutAc !== 'undefined' && carryOutAc && typeof carryOutAc.setSinkId === 'function') jobs.push(carryOutAc.setSinkId(spkDeviceId).then(() => true, () => false));   // the carried voice's speaker
      return Promise.all(jobs).then((r) => r.every(Boolean));
    }
    {
      const el = document.getElementById('micchooser');
      if (el) el.addEventListener('keydown', (e) => {
        const buttons = Array.from(el.querySelectorAll('button'));
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
        if (!micChooserOpen()) return;
        const t = e.target;
        if (t && t.closest && t.closest('#micchooser, #mic, #spkbtn')) return;
        closeMicChooser(false);
      }, true);
    }
    if (__V.unmuteBtn) __V.unmuteBtn.onclick = () => __V.micBtn.onclick();
    function kickStageMic(track) {
      if (typeof __C.outgoingHeld !== 'undefined' && __C.outgoingHeld) return;
      if (!track || track.kind !== 'audio' || track.readyState !== 'live' || !track.enabled) return;
      for (const sd of __C.stageSenders) {
        if (!sd || sd.track !== track) continue;
        const seat = () => sd.replaceTrack(track).catch(() => {});
        sd.replaceTrack(null).then(seat).catch(() => {});
      }
    }
    // The chooser is the only way on. A tap while the camera is off leaves it
    // off and asks Max blur / Min blur / No blur. A tap while it is on turns
    // it off at once. Dismissing the chooser turns nothing on.
    let camPickThen = null, camChooserAnchor = null;
    function camChooserOpen() {
      const el = document.getElementById('camchooser');
      return !!(el && !el.hidden);
    }
    function closeCamChooser() {
      camPickThen = null;
      try {
        const el = document.getElementById('camchooser');
        if (el) el.hidden = true;
      } catch (e) {}
      if (__V.camBtn) { try { __V.camBtn.setAttribute('aria-expanded', 'false'); } catch (e) {} }
    }
    function dismissCamChooser() {
      // Only when it is open: the bar nudge, reset, resize and drag call this, and refocusing #cam
      // with no chooser open stole the keyboard from the bar grip.
      if (typeof camChooserOpen === "function" && !camChooserOpen()) return;
      const back = (camChooserAnchor && camChooserAnchor.isConnected) ? camChooserAnchor : __V.camBtn;
      closeCamChooser();
      if (back && back.focus) { try { back.focus(); } catch (e) {} }
    }
    function openCamChooser(anchor, thenPick) {
      const el = document.getElementById('camchooser');
      if (!el) return;
      const tray = document.getElementById('reacttray');
      if (tray && !tray.hidden) {
        tray.hidden = true;
        const rb = document.getElementById('reactbtn');
        if (rb) { rb.setAttribute('aria-expanded', 'false'); rb.setAttribute('aria-pressed', 'false'); rb.classList.remove('on'); }
      }
      const bar = document.querySelector('.bar');
      const more = document.getElementById('bartoggle');
      if (bar && more && !bar.classList.contains('collapsed') && anchor === __V.camBtn) more.click();
      camPickThen = typeof thenPick === 'function' ? thenPick : null;
      camChooserAnchor = anchor || __V.camBtn;
      el.dataset.anchor = (camChooserAnchor && camChooserAnchor.id) || 'cam';
      el.setAttribute('aria-label', (0, /*()*/__C.uiText)('camChooseAria', 'Choose how you appear'));
      const wish = (0, /*()*/__C.blurLevel)(__C.myStatus.blur);
      for (const b of el.querySelectorAll('button[data-cam-blur]')) b.setAttribute('aria-checked', String(+b.dataset.camBlur === wish));
      fillCamDevices();
      if (GifOS.meetBgfx) {
        if (!sentVideoTrack.bgfx) {   // a pick before the first send still rebuilds the pipe
          sentVideoTrack.bgfx = true;
          GifOS.meetBgfx.configure({ power: () => __C.powNow, shed: () => (__C.meshNode && __C.meshNode.raw ? __C.meshNode.raw.lgLvl : 0) });
          GifOS.meetBgfx.onChange(() => { try { refreshOutbound(); } catch (e) {} });
        }
        GifOS.meetBgfx.fillPicker(el, (k, en) => (0, /*()*/__C.uiText)(k, en));
      }
      // The cameras are named only once one was allowed: read the list again,
      // and show the rows if it changed while the pop-up is open.
      const camKey = camInputs.map((m) => m.id).join();
      if (typeof noteAudioDevices === 'function') noteAudioDevices().then(() => { if (camChooserOpen() && camInputs.map((m) => m.id).join() !== camKey) fillCamDevices(); });
      el.hidden = false;
      if (anchor === __V.camBtn && __V.camBtn) __V.camBtn.setAttribute('aria-expanded', 'true');
      (0, /*()*/__V.placeDockPopover)(el, camChooserAnchor);
      const first = el.querySelector('#campick-max') || el.querySelector('button');
      if (first) { try { first.focus(); } catch (e) {} }
    }
    // THE CAMERA PICKER: with more than one camera, the camera pop-up lists
    // them under the blur choices. A pick opens that camera in place of the
    // current one (regrabCamera: same stream, every sender re-fed, blur pipe
    // kept) and turns the camera on with the blur already chosen.
    let camPickPrev = '';
    function camIdOf(track) {
      let st = null; try { st = track && track.getSettings ? track.getSettings() : null; } catch (e) {}
      const id = String((st && st.deviceId) || '');
      if (id && camInputs.some((m) => m.id === id)) return id;
      if (camDeviceId) return camDeviceId;
      // A track that names no row (some browsers hide the id): its label.
      const byLabel = track && track.label ? camInputs.filter((m) => m.label === track.label) : [];
      return byLabel.length === 1 ? byLabel[0].id : id;
    }
    function camLabelOf(track) {
      const m = camInputs.find((x) => x.id === camIdOf(track));
      return (m && m.label) || (track && track.label) || (0, /*()*/__C.uiText)('camUnnamed', 'Camera');
    }
    function fillCamDevices() {
      const box = document.getElementById('camdevs');
      if (!box) return;
      box.textContent = '';
      box.hidden = !(!camPhone && camInputs.length > 1 && camChooserAnchor === __V.camBtn);
      if (box.hidden) return;
      box.setAttribute('aria-label', (0, /*()*/__C.uiText)('camDevAria', 'Camera'));
      devHead(box, (0, /*()*/__C.uiText)('camHead', 'Camera'));
      const cur = camIdOf(__C.localStream && __C.localStream.getVideoTracks()[0]);
      camInputs.forEach((m, i) => {
        const b = devRow(m.label || (0, /*()*/__C.uiText)('camNumbered', 'Camera {n}').replace('{n}', String(i + 1)), m.id === cur, () => pickCamDevice(m.id));
        b.dataset.camId = m.id;
        box.appendChild(b);
      });
    }
    function pickCamDevice(id) {
      closeCamChooser();
      if (typeof __C.forcedCamOff === 'function' && (0, /*()*/__C.forcedCamOff)('me')) { (0, /*()*/__C.sayState)('videoOffByHost'); return; }
      const track = __C.localStream && __C.localStream.getVideoTracks()[0];
      camPickPrev = camDeviceId;
      if (!track) { camDeviceId = id; turnCameraOn(); return; }   // no camera yet: the first grab asks for this one
      if (__C.myStatus.camOff) turnCameraOn();
      if (id === camIdOf(track)) return;
      camDeviceId = id;
      regrabCamera('pickCam');
      if (__V.camBtn && __V.camBtn.focus) { try { __V.camBtn.focus(); } catch (e) {} }
    }
    function turnCameraOff() {
      const cam = __C.localStream && __C.localStream.getVideoTracks()[0];
      if (cam) cam.enabled = false;
      __C.myStatus.camOff = true;
      try { (0, /*()*/__C.sayState)('camOff'); } catch (e) {}
      try { (0, /*()*/__V.paintControls)(); } catch (e) {}
      try { (0, /*()*/__C.paintOnAir)(); } catch (e) {}
      try { refreshOutbound(); } catch (e) {}
      try { (0, /*()*/__C.broadcastStatus)(); } catch (e) {}
      try { (0, /*()*/__C.reactRoomState)(); } catch (e) {}
      try { (0, /*()*/__C.updateMediaSession)(); } catch (e) {}
    }
    function turnCameraOn() {
      if (typeof __C.forcedCamOff === 'function' && (0, /*()*/__C.forcedCamOff)('me')) {
        (0, /*()*/__C.sayState)('videoOffByHost');
        return;
      }
      if (!__C.localStream) return lateMedia('cam');
      const track = __C.localStream.getVideoTracks()[0];
      if (!track) return lateMedia('cam');
      track.enabled = true;
      __C.myStatus.camOff = false;
      try { (0, /*()*/__C.setStatus)(typeof __C.camOnWords === 'function' ? (0, /*()*/__C.camOnWords)() : (0, /*()*/__C.statusWords)('camOn'), 0, 'note', 'camOn'); } catch (e) {}
      try { (0, /*()*/__V.paintControls)(); } catch (e) {}
      try { (0, /*()*/__C.paintOnAir)(); } catch (e) {}
      try { refreshOutbound(); } catch (e) {}
      try { (0, /*()*/__C.broadcastStatus)(); } catch (e) {}
      try { (0, /*()*/__C.reactRoomState)(); } catch (e) {}
      try { (0, /*()*/__C.updateMediaSession)(); } catch (e) {}
    }
    function pickCamera(level) {
      if (typeof __C.avWhy === 'function') (0, /*()*/__C.avWhy)('tap');
      const lvl = (0, /*()*/__C.blurLevel)(level);
      closeCamChooser();
      (0, /*()*/__C.setPersonalBlur)(lvl, true); // still off: the refresh before the track enables is the avatar
      if (__C.myStatus.camOff) turnCameraOn();
      if (__V.camBtn && __V.camBtn.focus) { try { __V.camBtn.focus(); } catch (e) {} }
    }
    __V.camBtn.onclick = () => {
      if (__C.capClosed) return;   // no meeting here now (left, or turned away): no device ask, no device words
      if (typeof __C.avWhy === 'function') (0, /*()*/__C.avWhy)('tap');
      if ((0, /*()*/__C.bcWatchingViewer)()) return;
      if (typeof __C.outgoingHeld !== 'undefined' && __C.outgoingHeld) return;
      if (__C.BC_SEAT && !(0, /*()*/__C.bcMayPublishAv)()) { (0, /*()*/__C.enforceBroadcastSeat)(); return; }
      if (document.body.classList.contains('app-room')) { (0, /*()*/__C.setStatus)((0, /*()*/__C.uiText)('stVideoIsNotAvailableIn', 'Video is not available in an app room yet — start a meeting and run the app from there.')); return; }
      if (!__C.myStatus.camOff) { closeCamChooser(); turnCameraOff(); return; }
      if (camChooserOpen()) { dismissCamChooser(); return; }
      if (typeof __C.forcedCamOff === 'function' && (0, /*()*/__C.forcedCamOff)('me')) {
        (0, /*()*/__C.sayState)('videoOffByHost');
        return;
      }
      openCamChooser(__V.camBtn);
    };
    // M and V match the desktop habit (Meet uses different chords; the letter
    // under a thumb is what a volunteer remembers). Never while typing.
    document.addEventListener('keydown', (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
      const k = (e.key || '').toLowerCase();
      // F (Full screen) has one handler, with the shortcut sheet's keys
      // below; a second one here toggled it open and shut on one press.
      if (k === 's') {
        // Share, as Zoom gives it a key: wherever this person has Share (the
        // dock, More, or More's stand-in beside the chat), never for a viewer
        // who has not been allowed to share.
        if (!document.querySelector('.bar') || document.querySelector('#lobby.show') || (0, /*()*/__V.topNameModal)()) return;
        if (!shareOffered()) return;
        e.preventDefault();
        document.getElementById('sharebtn').click();
        return;
      }
      if (k === 'c' || k === 'r' || k === 'h') {
        // Chat, Reactions and the hand, as Zoom and Meet give them keys.
        if (!document.querySelector('.bar') || document.querySelector('#lobby.show') || (0, /*()*/__V.topNameModal)()) return;
        if (k === 'h') {
          if (!canRaiseHand()) return;
          e.preventDefault();
          __V.handBtn.click();
          return;
        }
        const btn = document.getElementById(k === 'c' ? 'chatbtn' : 'reactbtn');
        if (!btn || btn.offsetParent === null) return;
        e.preventDefault();
        btn.click();
        // Land where the next key does something: the message box, or the
        // first reaction (Escape closes either and comes back).
        if (k === 'c' && (0, /*()*/__V.chatPanelOpen)()) { const box = document.getElementById('chat-in'); if (box) box.focus(); }
        if (k === 'r') {
          const tray = document.getElementById('reacttray');
          const first = tray && !tray.hasAttribute('hidden') && tray.querySelector('button:not([hidden])');
          if (first) first.focus();
        }
        return;
      }
      if (k !== 'm' && k !== 'v') return;
      const btn = k === 'm' ? __V.micBtn : __V.camBtn;
      if (!btn || btn.offsetParent === null) return;
      e.preventDefault();
      btn.click();
    });
    // A service host has no hand to raise (theirs is hidden in More); a
    // viewer has it on the dock, and anyone in a small group can raise one.
    function canRaiseHand() {
      if (!__V.handBtn || __V.handBtn.style.display === 'none') return false;
      const svc = __C.BROADCAST;
      return !svc || !!(__V.handBtn.parentElement && __V.handBtn.parentElement.classList.contains('bar'));
    }
    // Share is offered when its button is not hidden by the room's rules;
    // folded under More (or moved there beside the chat) still counts.
    function shareOffered() {
      const b = document.getElementById('sharebtn');
      if (!b || document.body.classList.contains('app-room')) return false;
      if (b.getAttribute('aria-disabled') === 'true') return false;
      return b.classList.contains('inmore') || getComputedStyle(b).display !== 'none';
    }
    yield 2941;
    function openKeys() {
      const rows = [];
      // A grayed slot is shown but not usable, so its key is not listed.
      const usable = (b) => !!(b && b.offsetParent !== null && b.getAttribute('aria-disabled') !== 'true');
      if (usable(__V.micBtn)) rows.push(['M', 'Mute or unmute']);
      if (usable(__V.camBtn)) rows.push(['V', 'Choose Max blur, Min blur, or No blur, or turn video off']);
      const chatB = document.getElementById('chatbtn'), reactB = document.getElementById('reactbtn');
      if (usable(chatB)) rows.push(['C', 'Open or close the chat']);
      if (usable(reactB)) rows.push(['R', 'Open Reactions']);
      if (canRaiseHand()) rows.push(['H', 'Raise or lower your hand']);
      const fsB = document.getElementById('appfull');
      if (fsB && fsB.offsetParent !== null) rows.push(['F', 'Open or close Full screen']);
      if (shareOffered()) rows.push(['S', 'Share your screen, or stop sharing']);
      rows.push(['Esc', 'Close a sheet or the chat, then fold More']);
      rows.push(['Tab', 'Move through the controls, top to bottom']);
      rows.push(['Arrows', 'On the grip: move the controls']);
      rows.push(['?', 'Show this list']);
      const dl = document.getElementById('keys-list');
      dl.textContent = '';
      for (const [k, what] of rows) {
        const dt = document.createElement('dt'), kb = document.createElement('kbd'), dd = document.createElement('dd');
        kb.textContent = k; dt.appendChild(kb); dd.textContent = what;
        dl.appendChild(dt); dl.appendChild(dd);
      }
      __V.keysModal.style.display = 'flex';
      queueMicrotask(__V.syncModalFocus);
    }
    yield 3274;
    function dbgMeterSources() {
      const out = [];
      const nm = (id) => (id ? (__C.rosterNames[id] || String(id).slice(0, 8)) : null);
      const live = (st) => { const ts = st && st.getAudioTracks ? st.getAudioTracks().filter((t) => t.readyState === 'live') : []; return ts.length ? ts[ts.length - 1] : null; };
      const wk = (typeof wkEar !== 'undefined' && wkEar && wkEar.fold && wkEar.fold.gainOf) ? wkEar : null;
      for (const v of document.querySelectorAll('video')) {
        const t = v.closest && v.closest('[data-peer],[data-row]');
        if (!t) continue;
        const pid = t.dataset.peer || null;
        let path = v.closest('#stadium') ? 'stadium' : v.closest('#stagefeed') ? 'stagefeed' : t.dataset.row != null && !pid ? 'rowmix' : 'direct';
        if (path === 'direct' && (!pid || pid === __C.myId)) continue;
        const p = pid ? __C.peers.get(pid) : null;
        if (path === 'direct' && p && p.relayed) path = 'friend';
        const who = pid ? String(pid).slice(0, 8) : (t.dataset.row != null ? 'row' + t.dataset.row : path);
        if (wk && v._wkVoice && v._wkKey) { const g = wk.fold.gainOf(v._wkKey); if (g) out.push({ path, who, name: nm(pid), node: g, g: g.gain.value, post: true }); continue; }
        const a = v._aud; const tr = a && a.srcObject ? live(a.srcObject) : null;
        if (tr) out.push({ path, who, name: nm(pid), track: tr, g: (a.muted || a.paused) ? 0 : a.volume });
      }
      if (stageEar && stageEar.el) {
        const g = wk && wk.fold.has(WK_STAGE_KEY) ? wk.fold.gainOf(WK_STAGE_KEY) : null;
        if (g) out.push({ path: 'stage', who: 'stage', node: g, g: g.gain.value, post: true });
        else { const tr = live(stageEar.el.srcObject); if (tr) out.push({ path: 'stage', who: 'stage', track: tr, g: (stageEar.el.muted || stageEar.el.paused) ? 0 : stageEar.el.volume }); }
      }
      for (const c of __C.carryHosts.values()) if (c.voice && c.voice.output) out.push({ path: 'carry', who: String(c.far).slice(0, 8), name: c.name || 'carried', node: c.voice.output, g: 1 });   // the page I carry
      if (__C.carryG && __C.carryG.voice && __C.carryG.voice.output) out.push({ path: 'carry', who: String(__C.carryG.far || 'carrier').slice(0, 8), name: 'carrier', node: __C.carryG.voice.output, g: 1 });   // what my carrier hears, carried to me
      for (const [k, f] of downFolds) { const tr = f && f.track ? f.track() : null; if (tr) out.push({ path: 'send', who: String(k), track: tr, g: 1 }); }
      { const tr = prodPack && prodPack.stream && prodPack.stream.getAudioTracks ? prodPack.stream.getAudioTracks()[0] : null; if (tr) out.push({ path: 'send', who: 'prod', track: tr, g: 1 }); }   // my row's product, as it leaves
      return out;
    }
    return __L.END;
  }
  var api = { name: "media", run: part, count: 706, exports: {"AVATAR_H":0,"AVATAR_W":0,"CC_EARS_KEY":0,"CC_ENGINE_KEY":0,"CC_TRANSLATE_KEY":0,"CC_WHISPER_ANYWAY_KEY":0,"CC_WORDS_KEY":0,"MOS_GRACE":0,"MOS_SETTLE":0,"STAGE_FACE_PX":0,"STAGE_FACE_SETTLE_MS":0,"STG_PIC_LIVE_MS":0,"STG_ZERO_MS":0,"WEBKIT_TILE":0,"WHISPER_APP_ID":0,"WHISPER_SEED_KEY":0,"WSP_CHIP_MS":0,"WSP_STARVE_MS":0,"WSP_STARVE_N":0,"WSP_STARVE_WIN":0,"WSP_TICK_MS":0,"WSP_WEAK":0,"acClockInfo":1,"adapt":1,"adoptClaim":1,"applyBuses":1,"applyCcAll":1,"applyGrid":1,"applyRecoverMedia":1,"armAudioKeepAlive":1,"armWhisperRescan":1,"attachFailed":1,"attachLocalTracks":1,"attachTrack":1,"audioKickArmed":0,"avHold":0,"avatarSharp":0,"bindClaim":1,"blockLive":1,"blockOf":1,"blockPicture":1,"blockedAudio":0,"blurDraw":1,"blurPipe":0,"blurSenderFrac":1,"blurViewFrac":1,"botVoiceTrack":0,"browserCaptionsMissing":1,"callStateBox":0,"camChooserAnchor":0,"camChooserOpen":1,"camDeviceId":0,"camFacing":0,"camIdleT":0,"camPickThen":0,"camTrackForTest":1,"camVideoConstraints":1,"canRaiseHand":1,"canScreenRecord":0,"canScreenShare":0,"capsRunningNow":1,"carriedHot":1,"carryEarAc":1,"carryVoiceTrack":0,"ccDefGroup":0,"ccEngine":1,"ccMix":0,"ccMixStop":1,"ccMixSync":1,"clk":0,"clockSample":1,"closeCamChooser":1,"closeMicChooser":1,"compOf":0,"containerFor":1,"ctScreenTrack":1,"dbgMeterSources":1,"dbgRowFaces":0,"degOf":0,"detachTrack":1,"dismissCamChooser":1,"downFolds":0,"downStreams":0,"dropContainer":1,"dropEndedRemoteTracks":1,"dutyMuteTick":1,"earState":1,"endSongOnStepDown":1,"faceLive":1,"facePaint":1,"facesOnScreen":1,"gdOverride":0,"gridApplied":0,"gumRefused":1,"gumWithMicFallback":1,"headLinkUp":1,"headSendsStale":1,"hearState":1,"heardStage":1,"holdMainVideo":1,"hopMs":1,"installWhisper":1,"jobPinned":0,"jobVideoAt":0,"keepAwake":1,"keepMeetingAudio":1,"keyUp":1,"kfEv":0,"kickJob":1,"kickMainAudio":1,"kickMainVideo":1,"kickStageMic":1,"l14Packs":0,"lateMedia":1,"mainAudioTrack":1,"maybeShowFlip":1,"mediaElCensus":1,"micChooserOpen":1,"micHold":1,"micTap":1,"mix":0,"mixAc":0,"mixReady":1,"mosFb":0,"mosHeld":0,"mySelfStream":0,"normStageFrame":1,"noteAudioDevices":1,"noteReship":1,"onMeetDeviceChange":1,"openCamChooser":1,"openKeys":1,"openModal":1,"orphaned":1,"overlayTiny":1,"packFor":1,"packLoop":0,"paintStageStrip":1,"paintTiming":1,"parkSender":1,"partStream":1,"peerAudioTracks":1,"phoneCaptions":1,"picRead":1,"pickCamera":1,"pipeDeny":0,"pipeJobs":0,"playTileVideo":1,"poke":1,"prodPack":0,"producerKey":1,"qaStageSt":0,"quietAtDoor":1,"rbStart":1,"reactSing":1,"recDownload":1,"recDraw":0,"recFileName":1,"recLibraryOption":1,"recMatchMix":0,"recMode":0,"recNoteStruct":1,"recQuality":0,"recRec":0,"recRelease":1,"recScopeSources":1,"recSources":1,"recStarting":0,"reconcileMosaic":1,"recoverShareTimer":0,"refreshOutbound":1,"refreshTrBtn":1,"regrabCamera":1,"releaseAudio":1,"rememberMix":1,"repaintRedun":1,"resumeReload":1,"retireMixTracks":1,"reviveCamera":1,"roomPack":0,"rowEdge":1,"rowMixHeadArrives":1,"rowMixHold":1,"rowMixOpen":1,"rowMixViaPeek":1,"schedClaim":1,"schedReconcile":1,"sdView":0,"sdViewSt":0,"sentVideoTrack":1,"serviceHeard":0,"setServiceHeard":1,"setStageFrame":1,"shareRecoverMode":0,"shipContainers":0,"shownPeerCount":1,"slotDark":1,"soundHeld":1,"speakerChoices":1,"speech":0,"speechGaveUp":0,"speechProved":0,"speechRunning":1,"stageAudible":1,"stageEar":0,"stageEarFoldPeak":1,"stageEarLiveTrack":1,"stageEarRawPeak":1,"stageFeedShows":1,"stageFrameVal":0,"stageViewNow":0,"stagedSelfWas":0,"startLocalView":1,"startRec":1,"startScreenShare":1,"startWhisper":1,"stashRecoverMedia":1,"stgBeatIn":1,"stgCarry":1,"stgFoNote":1,"stgLost":1,"stopBlurPipe":1,"stopScreenShare":1,"stopSpeech":1,"stopWhisper":1,"stripPack":0,"stubDuties":1,"swapPicNote":1,"swapTrack":1,"syncAvatarFeed":1,"syncSpeech":1,"tileHolds":1,"toggleSing":1,"trEnSync":1,"trackAspect":1,"trackQ":0,"transcriptFile":1,"tuneCfg":1,"unbindClaim":1,"wakeLock":0,"warnRecorderNewApp":1,"whisperAllowed":0,"whisperChosen":0,"whisperInstalling":0,"whisperRescan":0,"whisperSeedBlocked":1,"whisperSupported":1,"withScrPipe":1,"wkBindVideo":1,"wkEar":0,"wkFwdCopies":0,"wkFwdNeeded":1,"wkHolds":1,"wkQuietBind":1,"wkRemoteTrack":1,"wsp":0,"wspCaps":0,"wspChip":0,"wspChipGone":1,"wspChipRoom":0,"wspEnqueue":1,"wspInst":0,"wspModel":1,"wspPaintSafe":1,"wspPaused":0,"wspQ":0,"wspRebind":1,"wspRelease":1,"wspResume":1,"wspRetry":1,"wspStSig":0,"wspStarved":0,"wspState":1,"wspStateText":1,"wspStop":1,"wspSync":1,"wspTickAt":0,"wspToBrowser":1,"wspWorking":0,"x2Target":1}, needs: {"core":{"leaving":0,"localStream":0,"capClone":1,"WK_H264_BLIND":0,"shareBlocked":0,"turnLinks":0,"turnFacts":0,"myId":0,"rowFaceDark":0,"myName":0,"blurLevelFor":1,"mediaOk":0,"relayVia":0,"displayName":1,"myStatus":0,"stageIds":0,"statusOf":0,"screenStream":0,"sharingScreen":0,"BROADCAST":0,"bcMayPublishAv":1,"rbNow":0,"mayShareScreen":0,"outgoingHeld":0,"bcRole":1,"peers":0,"meTile":0,"camPeer":0,"clog":0,"micPeer":0,"renegotiate":1,"rosterIds":0,"knownTotal":1,"rosterTiles":0,"updateTile":1,"updateStatus":1,"meshSeat":0,"meshNode":0,"roomPastSection":0,"SCALE":0,"powNow":0,"IS_MOBILE":0,"powDials":0,"setStatus":0,"uiText":1,"stHold":0,"seatDark":0,"forcedCamOff":0,"vqRung":0,"rung":0,"LADDER":0,"stageCeilingKbps":1,"screenCeilingKbps":1,"stageSenders":0,"auxSenders":0,"lowSenders":0,"net":0,"meterFor":1,"sayState":0,"IS_ANDROID":0,"botParks":1,"visParkSent":0,"dcSend":0,"hasPendingTx":0,"ensureAc":1,"ac":0,"newMeetAudioContext":1,"occPid":0,"pipePeers":1,"preferHwVideo":1,"modOf":1,"stageSeats":0,"digLists":0,"stageHeldAt":0,"stageFeedAt":0,"addAux":0,"isStageJob":0,"auxDrop":1,"stopAuxTx":1,"DEBUG_ON":0,"modBlurOn":0,"meshCoord":0,"speakingOf":0,"rowMixTalkAt":0,"subWant":0,"myIdentity":0,"labelFor":0,"iAmWaiting":1,"peerWaits":1,"fitFor":0,"pipeVideo":0,"pipeStg":0,"STAGE_FPS":0,"stageCell":1,"STAGE_MAXW":0,"stageFps":1,"freshSt":0,"pwBlocked":0,"bannedOut":0,"mediaJoined":0,"RECOVER_MEDIA_KEY":0,"updateRoomKey":0,"bcHostStored":0,"paintOnAir":1,"broadcastStatus":1,"updateMediaSession":1,"screenSteppedUp":0,"setStage":1,"refreshAllTiles":1,"rbCap":0,"rbLength":1,"rbTracks":1,"rbDrop":1,"bcSeeding":0,"releaseLeaveAsk":1,"rbStop":1,"rbNoun":0,"rowMates":0,"isHeld":1,"botHidden":1,"TIMING_KEY":0,"digStageEntry":0,"rosterNames":0,"foldName":1,"canStage":0,"lsGet":0,"CC_ON_PHONE":0,"meters":0,"myVoiceAt":0,"lsSet":0,"ccLocalQ":0,"CC_LANG_KEY":0,"trEnOn":0,"capSend":1,"trLangOf":0,"addTranscriptLine":1,"capEarsOnly":1,"capTrust":0,"trLang":1,"trKeeps":1,"trEnOnlyEnglish":1,"capSpotQueue":1,"capPublish":1,"trForget":1,"ccLang":0,"trDrops":0,"capTraceGate":1,"myVoiceFrom":0,"trLangKnown":1,"myVoiceSinceFinal":0,"ccDevNotice":1,"trEchoHeld":1,"ccShow":0,"trBlocks":1,"trNote":1,"modTable":0,"setMod":1,"AI_SPARK_SVG":0,"chatOpen":0,"room":0,"recRoomWord":1,"bcLastService":0,"BC_INTENT":0,"recSrcDirty":0,"recStructSig":0,"bcKeepUserStop":0,"amGloballyMuted":1,"micLockWords":1,"capClosed":0,"bcWatchingViewer":1,"enforceBroadcastSeat":1,"lateAsk":0,"lateWant":0,"bootGumPending":0,"reactRoomState":1,"camOnWords":1,"statusWords":0,"lateGen":0,"lateWon":0,"lateTimer":0,"LATE_ASK_MS":0,"blurLevel":0,"setPersonalBlur":1,"carryHosts":0,"carryG":0,"meOnStage":1,"shareOnlyStage":1,"personOnStage":1,"seatSelfLeased":0,"mainVideoChoice":1,"outboundPlan":1,"stageFeedVideo":1,"stageVideoChoice":1,"isRedun":0,"onStageNow":1,"screenSharers":0,"roomSingOn":0,"singOf":0,"capCovered":1,"trWrites":1,"idleNow":0,"lastActive":0,"lastQ":0,"MP":0,"battNow":0,"micGrabbing":0,"micWant":0,"micMode":0,"micUnmuteAfter":0,"micPickPrev":0,"pipeEnabled":0,"MPipe":0,"stgBeats":0,"swapPicLast":0,"swapPicHoldAt":0,"swapPicRing":0,"STG_BEAT_STALE_MS":0,"STG_BEAT_SEEN":0,"stgBeatCost":0,"STG_BEAT_MS":0,"timing":0,"whisperReady":0,"planMeasured":1,"reconcileMain":1,"inboundPlan":1,"owedStream":1,"BC_SEAT":0,"EMBED":0,"embedHosted":0,"clearNoPwMode":1,"mosIn":0,"mosJobs":0,"mosStandby":0,"demand":1,"unshipJob":1,"kfNeed":1,"setJobActive":1,"mosAnn":0,"stgEnded":1,"STG_ROOT2":0,"rowActing":1,"rowHeadPid":1,"claimMos":1,"stgFedBy":1,"stgPath":0,"vpId":0,"stgStale":1,"mosBeyondAt":0,"dropMosIn":1,"dropStandby":1,"roomBeyondRow":1,"iActAsHead":1,"carryIn":1,"shipJob":1,"packIn":1,"mixIn":1,"stgHop":0,"stgDirectSet":1,"reapJobs":1,"avWhy":1,"avEvent":1,"dutyJob":1,"displayCount":1,"compFps":1,"wspSource":1,"recDefaultQuality":1,"faceLevel":1,"roomViewShown":1},"view":{"blurA":0,"blurActx":0,"blurB":0,"blurBctx":0,"showAvatarTrack":1,"stagefeedEl":0,"stadiumEl":0,"showFlipButton":1,"showCamBack":1,"paintSpkBtn":1,"paintStadiumTile":1,"paintControls":1,"showResharePrompt":1,"hideResharePrompt":1,"paintShare":1,"dropStaleShareWin":1,"paintRb":1,"rbCanvas":1,"paintRbNow":1,"paintFaders":0,"timingRow":0,"paintWspChip":1,"paintCcState":1,"paintTxMark":1,"capCardRefresh":1,"paintWspStatus":1,"paintCcView":1,"showCaption":1,"ccDockBtn":0,"hideCaptions":1,"renderTranscript":1,"renderChat":1,"chatPanel":0,"paintChatBtn":1,"paintRoomTrust":1,"showServiceEnded":1,"showRecReplay":1,"recBtn":0,"showRecOptions":1,"roomAudioOn":1,"micBtn":0,"placeDockPopover":1,"unmuteBtn":0,"camBtn":0,"topNameModal":1,"handBtn":0,"chatPanelOpen":1,"keysModal":0,"syncModalFocus":1,"paintStagePlate":1,"layout":1}}, stamp: "d49d42da" };
  (GifOS.coreParts = GifOS.coreParts || {})["media"] = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
