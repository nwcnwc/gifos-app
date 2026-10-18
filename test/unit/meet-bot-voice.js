// meet-bot-voice.js — a meeting bot's spoken line reaches everyone, whole.
//
// The bot speaks by putting its speech track on its main audio senders. Seated
// once by hand, the next outbound refresh (it runs on every beat and layout
// change) put the bot's muted mic back on those senders a second or two into
// the line: people heard only the start, a pair opened during the line got the
// mic and heard none of it, and with no voice coming in the bot's tile never
// lit. While the bot speaks, every path that seats a main audio sender must
// pick the speech track; when the line ends the mic takes the senders back.
//
//   node test/unit/meet-bot-voice.js
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'run.html'), 'utf8');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}
function slice(startMark, endMark) {
  const a = html.indexOf(startMark);
  const b = a < 0 ? -1 : html.indexOf(endMark, a + startMark.length);
  check('lift: ' + startMark.trim().slice(0, 48), a > 0 && b > a, a + '..' + b);
  return a > 0 && b > a ? html.slice(a, b) : '';
}

const OUTBOUND = slice('    let camIdleT = null;', '    // Stage membership is DERIVED');
const ENABLE = slice('    function enableMedia(p) {', '    function newPcFor(p) {');
const SPEECH = slice('      let botSpeechAudio = null;', '      GifOS.meetSession.install({');

function track(kind, id) {
  return { kind: kind, id: id, enabled: false, readyState: 'live', stop() { this.readyState = 'ended'; } };
}
function sender(tr) {
  return { track: tr, replaceTrack(t) { this.track = t; return Promise.resolve(); } };
}

function world() {
  const mic = track('audio', 'mic');
  const w = {
    mic: mic,
    localStream: { id: 'ls', getAudioTracks: () => [mic], getVideoTracks: () => [], getTracks: () => [mic] },
    myStatus: { bot: true, muted: true, camOff: true },
    peers: new Map(),
    audios: [],
    contexts: [],
    beats: 0,
  };
  w.addPeer = (id, withSender) => {
    const p = { id: id, pc: { addTrack(t) { return sender(t); } }, mediaOn: false };
    if (withSender) { p.mainA = sender(mic); p.mediaOn = true; }
    w.peers.set(id, p);
    return p;
  };
  class FakeAudio {
    constructor() { this.src = ''; this.on = {}; w.audios.push(this); }
    addEventListener(ev, fn) { (this.on[ev] = this.on[ev] || []).push(fn); }
    play() { return Promise.resolve(); }
    pause() {}
    end() { (this.on.ended || []).forEach((fn) => fn()); }
  }
  class FakeCtx {
    constructor() { this.closed = false; w.contexts.push(this); }
    createMediaElementSource() { return { connect() {} }; }
    createMediaStreamDestination() { const t = track('audio', 'voice' + w.contexts.length); return { stream: { getAudioTracks: () => [t] } }; }
    resume() { return Promise.resolve(); }
    close() { this.closed = true; return Promise.resolve(); }
  }
  const env = {
    myStatus: w.myStatus, peers: w.peers, myId: 'k_bot', outgoingHeld: false,
    meTile: null, stageIds: () => [], camPeer: () => true, compKick() {}, renegotiate() {}, adapt() {},
    sentVideoTrack: () => null, stopBlurPipe() {},
    // The merged refreshOutbound asks the Broadcast role first; a meeting bot is in a meeting.
    BROADCAST: false, bcRole: () => 'host',
    // No free-pool anchor in this world: no mix-minus sender ever replaces the voice.
    turnMixSenders: new WeakSet(), turnMixTrack: () => null,
    paintControls() {}, broadcastStatus() { w.beats++; }, rememberBotSpoken() {},
    // refreshOutbound opens the Stage frame on a step-up; a bot is never on the Stage.
    meOnStage: () => false,
    Blob: function () {}, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    Audio: FakeAudio, window: { AudioContext: FakeCtx },
  };
  const names = Object.keys(env);
  const body = 'let localStream = __ls;\n' + OUTBOUND + '\n' + ENABLE + '\n' + SPEECH +
    '\nreturn { refreshOutbound, enableMedia, playBotSpeech, stopBotSpeech, setLocal: (s) => { localStream = s; } };';
  const api = new Function(...names, '__ls', body)(...names.map((n) => env[n]), w.localStream);
  return Object.assign(w, api);
}

const sentOn = (p) => (p.mainA && p.mainA.track && p.mainA.track.id) || 'none';

// 1. The line survives the beats that follow it.
{
  const w = world();
  const a = w.addPeer('k_a', true);
  const b = w.addPeer('k_b', true);
  w.playBotSpeech({ bytes: new Uint8Array([1, 2, 3]), mime: 'audio/wav', text: 'hello' });
  const voice = sentOn(a);
  check('speaking puts the speech track on every main audio sender', /^voice/.test(voice) && sentOn(b) === voice, sentOn(a) + ' / ' + sentOn(b));
  check('the bot reads as unmuted while it speaks', w.myStatus.muted === false);
  for (let i = 0; i < 3; i++) w.refreshOutbound(); // beats, layout passes
  check('an outbound refresh mid-line keeps the speech track (not the muted mic)', sentOn(a) === voice && sentOn(b) === voice, sentOn(a) + ' / ' + sentOn(b));

  // 2. A pair that opens while the bot is talking hears the rest of the line.
  const c = w.addPeer('k_c', false);
  w.enableMedia(c);
  check('a newcomer\'s pair opened mid-line carries the speech track', sentOn(c) === voice, sentOn(c));

  // 3. The line ends: the mic takes the senders back, and the bot reads muted.
  w.audios[w.audios.length - 1].end();
  check('when the line ends the senders go back to the mic', sentOn(a) === 'mic' && sentOn(b) === 'mic' && sentOn(c) === 'mic', [sentOn(a), sentOn(b), sentOn(c)].join(' / '));
  check('…and the bot reads as muted again', w.myStatus.muted === true);
  w.refreshOutbound();
  check('…and a later refresh keeps the mic (the old voice is not resurrected)', sentOn(a) === 'mic');
}

// 4. A second line replaces the first; stop puts the mic back and frees the old audio.
{
  const w = world();
  const a = w.addPeer('k_a', true);
  w.playBotSpeech({ bytes: new Uint8Array([1]), text: 'one' });
  const first = sentOn(a);
  w.playBotSpeech({ bytes: new Uint8Array([2]), text: 'two' });
  const second = sentOn(a);
  check('a new line replaces the old one on the senders', /^voice/.test(second) && second !== first, first + ' → ' + second);
  check('the first line\'s audio context is closed', w.contexts.length >= 2 && w.contexts[0].closed === true);
  w.audios[0].end(); // the stopped first line's late 'ended' must not cut the second
  check('the first line ending late does not cut the second', sentOn(a) === second, sentOn(a));
  w.stopBotSpeech();
  check('stop puts the mic back on the senders', sentOn(a) === 'mic', sentOn(a));
  check('…and the bot reads as muted', w.myStatus.muted === true);
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
