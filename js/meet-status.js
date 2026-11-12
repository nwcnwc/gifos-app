/*
 * meet-status.js — the meeting's status line speaks in named states.
 *
 * The line at the top of a meeting says one thing at a time, in the same
 * words every time. Each state below has one fixed sentence and a tone:
 *
 *   place   where you are (connecting, at the door, alone, in the meeting).
 *           The line rests on it; nothing holds it.
 *   note    something just happened (camera on, sharing). It shows for a
 *           short beat, then the line goes back to where you are.
 *   stop    something stopped you or needs you (muted by the host, the room
 *           is full). It wears the alert colour and stays longer.
 *
 * The page writes a state with say(id, vars): the sentence, the tone and the
 * state's name (data-state on the line) come from this one table, so a test
 * or a style reads the state, never the sentence. {name} style holes are
 * filled from vars; a hole with no value is dropped with the words around it
 * marked by [ ] (for example "[ by {by}]").
 *
 * Each sentence carries its catalog key: a translated meeting reads the key,
 * English reads the sentence beside it.
 */
(function (root) {
  'use strict';

  const STATES = {
    // ---- where you are ----------------------------------------------------
    connecting:     { tone: 'place', key: 'sttConnecting', en: 'Connecting…' },
    joining:        { tone: 'place', key: 'stJoiningTheMeetingYouPicked', en: 'Joining the meeting…' },
    joiningBroadcast: { tone: 'place', key: 'bcStageLine', en: 'Joining the broadcast…' },
    reconnecting:   { tone: 'place', key: 'sttReconnecting', en: 'Reconnecting…' },
    backIn:         { tone: 'place', key: 'backIn', en: 'Getting you back in' },
    waitingRoom:    { tone: 'place', key: 'waitHere', en: 'In the waiting room' },
    waitingHost:    { tone: 'place', key: 'waitingForTheHost', en: 'Waiting for the host' },
    alone:          { tone: 'place', key: 'justYou', en: 'Just you' },
    passwordDoor:   { tone: 'place', key: 'pwHintLocked', en: 'Enter the room password to join the meeting.' },
    roomFull:       { tone: 'stop', key: 'sttRoomFull', en: 'This meeting is full. Any GifOS subscription lets you join.' },
    roomEnded:      { tone: 'place', key: 'sttRoomEnded', en: 'The meeting has ended.' },

    // ---- your picture and sound ------------------------------------------
    askingMedia:    { tone: 'note', key: 'stAskingForCameraMicrophone', en: 'Asking for camera and microphone…' },
    askingMic:      { tone: 'note', key: 'sttAskingMic', en: 'Asking for your microphone…' },
    stillAsking:    { tone: 'note', key: 'stStillAskingForTheCamera', en: 'Still asking for the camera and microphone…' },
    camOn:          { tone: 'note', key: 'sttCamOn', en: 'Camera on.' },
    camOff:         { tone: 'note', key: 'sttCamOff', en: 'Camera off.' },
    micOn:          { tone: 'note', key: 'sttMicOn', en: 'Mic on.' },
    camRestart:     { tone: 'note', key: 'camBlack', en: 'Your camera was sending black video. Restarting it…' },
    mutedByHost:    { tone: 'stop', key: 'sttMutedByHost', en: 'You were muted for everyone[ by {by}]. Someone else has to lift it.' },
    micWaitRoom:    { tone: 'stop', key: 'waitMic', en: 'You are in the waiting room. Your mic opens when the host lets you in.' },
    videoOffByHost: { tone: 'stop', key: 'stAnAdminTurnedYourVideo2', en: 'An admin turned your video off for the room. Only an admin can turn it back on.' },
    videoPausedRelay: { tone: 'stop', key: 'sttVideoPausedRelay', en: 'Video is paused on this connection. Sound still works. A subscriber in the meeting can turn video on.' },
    soundBack:      { tone: 'note', key: 'stSoundIsBack', en: 'Sound is back.' },

    // ---- the stage -------------------------------------------------------
    onStage:        { tone: 'note', key: 'sttOnStage', en: 'You are on stage.' },
    stageVotedOn:   { tone: 'note', key: 'stTheRoomVotedYouOnto', en: 'The room voted you onto the stage. Step down whenever you like.' },
    stageVotedOff:  { tone: 'stop', key: 'stTheRoomVotedYouOff', en: 'The room voted you off the stage.' },
    stageCalled:    { tone: 'note', key: 'stCalledToTheStageA', en: 'You were called to the stage. A place opens when someone steps down.' },
    stageFull:      { tone: 'stop', key: 'sttStageFull', en: 'The stage is full ({n} people). Someone has to step down first.' },
    stageNoStep:    { tone: 'stop', key: 'stCouldNotStepOntoThe', en: 'Could not step onto the stage. Tap Step on to try again.' },
    turnUnmute:     { tone: 'note', key: 'stTurnUnmute', en: 'It’s your turn. Unmute to speak?' },
    stageNotAllowed: { tone: 'stop', key: 'stOnlyRoomAdminsAndPeople', en: 'Only room admins, and people they allow, can take the stage here.' },

    // ---- sharing your screen ---------------------------------------------
    shareChoose:    { tone: 'note', key: 'sttShareChoose', en: 'Choose what to share…' },
    shareBack:      { tone: 'note', key: 'sttShareBack', en: 'Bringing your screen share back…' },
    sharing:        { tone: 'note', key: 'shareLive', en: 'Sharing your screen. Sound from the shared tab does not travel, so talk over it.' },
    shareCancelled: { tone: 'note', key: 'shareCancelled', en: 'Screen share cancelled. Nothing was shared.' },
    shareStopped:   { tone: 'note', key: 'reshareNote', en: 'Your screen share stopped when you came back.' },
    shareNotAllowed: { tone: 'stop', key: 'stOnlyThisRoomSAdmins', en: 'Only this room’s admins, and people they allow, can share a screen here.' },
    shareTurnedOff: { tone: 'stop', key: 'stScreenSharingWasTurnedOff', en: 'Screen sharing was turned off before it started.' },
    shareVideoOff:  { tone: 'stop', key: 'stAnAdminTurnedYourVideo', en: 'An admin turned your video off for the room, so screen sharing is off too until they lift it.' },

    // ---- the room's keys -------------------------------------------------
    adminChecking:  { tone: 'note', key: 'admCheckingStatus', en: 'Checking the password… (takes a few seconds)' },
    adminWrong:     { tone: 'stop', key: 'admWrongStatus', en: 'Wrong admin password.' },
    adminSignedIn:  { tone: 'note', key: 'admSignedIn', en: 'You are signed in as admin.' },
    passwordChanged: { tone: 'stop', key: 'pwChangedStatus', en: 'The admin changed the room password. Enter the new password to rejoin.' },
    passwordTrying: { tone: 'note', key: 'pwTrying', en: 'Trying the password…' },
  };

  const TONES = { place: 1, note: 1, stop: 1 };

  function has(id) { return Object.prototype.hasOwnProperty.call(STATES, id); }
  function state(id) { return has(id) ? STATES[id] : null; }

  // fill(text, vars): {name} holes from vars; an optional part [ ... {x} ... ]
  // stays only when every hole in it has a value.
  function fill(text, vars) {
    const v = vars || {};
    const val = (k) => (v[k] === undefined || v[k] === null || v[k] === '') ? null : String(v[k]);
    let out = String(text).replace(/\[([^\]]*)\]/g, (m, part) => {
      let ok = true;
      part.replace(/\{(\w+)\}/g, (h, k) => { if (val(k) === null) ok = false; return h; });
      return ok ? part : '';
    });
    out = out.replace(/\{(\w+)\}/g, (h, k) => (val(k) === null ? '' : val(k)));
    return out;
  }

  // words(id, vars, uiText): the sentence for a state, in the page's language
  // when a catalog has the key (uiText(key, english) is the page's lookup).
  function words(id, vars, uiText) {
    const s = state(id);
    if (!s) return '';
    const base = typeof uiText === 'function' ? (uiText(s.key, s.en) || s.en) : s.en;
    return fill(base, vars);
  }

  const api = { STATES, TONES, has, state, fill, words, ids: () => Object.keys(STATES) };
  if (typeof module === 'object' && module.exports) module.exports = api;
  const GifOS = root.GifOS = root.GifOS || {};
  GifOS.meetStatus = api;
})(typeof window !== 'undefined' ? window : globalThis);
