/*
 * meet-carry.js — the carried seat (docs/turn-carry.md).
 *
 * A page with no RTCPeerConnection cannot hold a link of the mesh. One seat of
 * the room carries it instead, as a second person at that seat's device: the
 * carried page's voice is in its carrier's voice, and it hears what its
 * carrier hears. The mesh never sees it.
 *
 * Carrier and carried page are the two ends of ONE link of the kind c<k>:
 *   - the handshake rides the relay's `tv` frames (sealed under the room key,
 *     one fixed size, like every relay frame): q 'c' ask and answer, q 'v' the
 *     parts of each end's seated vouch (as js/meet-turn.js sends them);
 *   - each end shows both vouches to the credential service and gets its end's
 *     credential, which names the pipe host (the TURN.18 web path);
 *   - both ends open the pipe (js/meet-tunnel.js createRawEnd: the TURN.18
 *     worker, socket, pairing, key agreement and seal) and pass each other
 *     Opus packets (WebCodecs) and must-arrive JSON (chat lines).
 *
 * This file holds the link (createLink), the voice (createVoice: encode,
 * decode and the jitter buffer) and the carried page's door socket
 * (createDoor). run.html wires them: the carried page in carryGuest*, the
 * carrier in carryHost*.
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});

  const CARRY_MAX = 1;              // pages one seat carries at once (its load never grows with the room)
  const LINKS = 6;                  // c0..c5: the credential service's free link names per room (turn/worker link.js FREE_LINKS_DEFAULT)
  const OPUS_FRAME = 20;            // ms of sound in one Opus packet: a codec frame size, not a wait
  const BITRATE = 24000;            // Opus voice, bits a second
  const JB_START = 3, JB_MAX = 15, JB_SLACK = 2;   // the jitter buffer, in frames: start, most, held over the target before skipping
  const TM = () => GifOS.timings || {};   // every wait: js/timings.js (CARRY_ASK_MS, CARRY_LOOK_MS, TUNNEL_RETRY_*)
  const LINK_RE = /^c[0-9]$/, DEV_RE = /^[A-Za-z0-9_.-]{1,16}$/, NONCE_RE = /^[0-9a-f]{18}$/, MAC_RE = /^[A-Za-z0-9_-]{43}$/, E36_RE = /^[0-9a-z]{1,11}$/;
  const MT = () => GifOS.meetTurn, TUN = () => GifOS.meetTunnel;

  function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  // linkName(guestId) → the carried page's link name: c<k>, k from its own id (two carried pages of a room rarely share one;
  // when they do, the pipe still pairs each by its pair tag)
  const linkName = (guestId) => 'c' + (fnv(String(guestId)) % LINKS);
  // supported() → can this browser carry or be carried (an Opus encoder and decoder, an AudioWorklet, a Worker)?
  const supported = () => typeof AudioEncoder !== 'undefined' && typeof AudioDecoder !== 'undefined' && typeof AudioData !== 'undefined'
    && typeof AudioWorkletNode !== 'undefined' && typeof Worker !== 'undefined' && typeof WebSocket !== 'undefined' && !!(root.crypto && root.crypto.subtle);

  // tvOk(f) → is this a carry handshake frame? {k:'tv', q:'c', l, d, b, e} ask/answer (b 1: busy; e: the sender's subroom, base 36),
  // {k:'tv', q:'v', l, e, n, m} a vouch's parts (as js/meet-turn.js sends them: they fill the relay's 128 bytes), {k:'tv', q:'x', l} the link is over.
  function tvOk(f) {
    if (!f || typeof f !== 'object' || Array.isArray(f) || f.k !== 'tv' || typeof f.l !== 'string' || !LINK_RE.test(f.l)) return false;
    for (const k of Object.keys(f)) if (k !== '_' && 'k,q,l,d,b,e,n,m'.split(',').indexOf(k) < 0) return false;
    if (f.q === 'c') return typeof f.d === 'string' && DEV_RE.test(f.d) && (f.b === undefined || f.b === 0 || f.b === 1) && (f.e === undefined || (typeof f.e === 'string' && /^[0-9a-z]{1,2}$/.test(f.e)));
    if (f.q === 'v') return typeof f.e === 'string' && E36_RE.test(f.e) && typeof f.n === 'string' && NONCE_RE.test(f.n) && typeof f.m === 'string' && MAC_RE.test(f.m);
    if (f.q === 'x') return true;
    return false;
  }

  // ---- the link ---------------------------------------------------------------------------------------------------
  // createLink(o) → one end of a carry link.
  // o = { guest: true on the carried page, me, far (peer ids), l, dev() my device tag, sub() my subroom, sid() the room's
  //       relay session, sendTv(f), askVouch(farDev, l), ask (the credential service call), webScheme(), seal, open,
  //       sign, verify, log, now(), onUp(), onDown(why), onText(obj), onAudio(packet ArrayBuffer) }
  function createLink(o) {
    const now = o.now || (() => Date.now());
    const log = (s) => { try { if (o.log) o.log('carry ' + String(o.far).slice(0, 8) + ' ' + s); } catch (e) {} };
    const L = { l: o.l, far: o.far, farDev: '', farSub: 0, mine: null, peer: null, peerV: null, cred: null, end: null, state: 'ask', closed: false, askedAt: 0, vAskAt: 0, upAt: 0, host: '', moveTo: '' };
    // a vouch is used while three quarters of its life (from when I got it to its expiry) is left to run
    const usable = (v) => !!v && v.e - now() > (v.e - v.at) / 4;
    function sendAsk(b) { L.askedAt = now(); o.sendTv({ k: 'tv', q: 'c', l: L.l, d: o.dev(), b: b ? 1 : 0, e: ((o.sub ? o.sub() : 0) | 0).toString(36) }); }
    function askMine() { if (!L.farDev) return; L.vAskAt = now(); o.askVouch(L.farDev, L.l); }
    function credStart() {
      if (L.cred || L.closed) return;
      L.cred = MT().createCredentials({ ask: o.ask, room: o.sid(), pool: 'free', now,
        extra: () => {
          const again = TM().CARRY_ASK_MS;
          if (!usable(L.mine)) { if (now() - L.vAskAt > again) askMine(); return null; }
          if (!L.peer || !usable(L.peerV)) { if (now() - L.askedAt > again) sendAsk(0); return null; }   // an ask is the far end's cue to vouch again
          return { vouch: L.mine.v, peerVouch: L.peer };
        },
        onChange: (k) => {
          log('cred ' + k);
          if (L.closed) return;
          if (k === 'expired') { close('credential expired'); return; }
          const g = L.cred.servers(), web = L.cred.web();
          if (!g || !g[0] || !web.length) { if (k === 'ok') log('no web host in the grant'); return; }
          const auth = { u: g[0].username, c: g[0].credential, p: MT().linkId(o.me, o.far) };
          if (L.end) { L.end.auth(auth); follow(web); return; }
          const url = urlOf(web[0]);
          log('pipe open ' + web[0]);
          L.state = 'dial'; L.host = web[0];
          L.end = TUN().createRawEnd({ url, auth, me: o.me, peer: o.far, seal: o.seal, open: o.open, sign: o.sign, verify: o.verify, log: o.log,
            onState: (s) => {
              if (s === 'up') { L.state = 'up'; L.upAt = now(); log('up'); try { o.onUp && o.onUp(); } catch (e) {} }
              else if (L.state === 'up' && s !== 'up') { L.state = 'dial'; try { o.onDown && o.onDown(s); } catch (e) {} }
              if (s === 'refused') close('pipe refused');
            },
            onMedia: (g2, kind, key, data) => { if (kind === 'audio' && o.onAudio) o.onAudio(data); },
            onText: (s) => { let m = null; try { m = JSON.parse(s); } catch (e) {} if (m && typeof m === 'object' && m.k === 'mv') { onMv(m); return; } if (m && typeof m === 'object' && o.onText) o.onText(m); },
            onMoved: (ok) => { if (!ok) { log('pipe move not done'); return; } L.host = L.moveTo || L.host; L.moveTo = ''; log('pipe moved ' + L.host); },
          });
        } });
      L.cred.start();
    }
    // THE LINK FOLLOWS ITS GRANT (as a web link does, TURN.22.2). The pipe holds one socket on one server. When the
    // carrier's renewed grant no longer lists that host (the server is leaving for an update), the carrier names the
    // grant's first host on the pipe itself ({k:'mv', h}) and both ends move there, make before break: a second socket,
    // the same sealed session (meet-tunnel.js move). An end moves only to a host its own grant allows; the carried page
    // says the same word back once its own renewal allows it, and the carrier moves again to meet it.
    const urlOf = (h) => (o.webScheme ? o.webScheme() : 'wss://') + h + '/';
    function moveTo(h, say) {
      log('pipe move ' + L.host + ' to ' + h);
      L.moveTo = h;
      if (say) L.end.sendText(JSON.stringify({ k: 'mv', h }));
      L.end.move(urlOf(h));
    }
    function follow(web) {
      if (!L.end || L.state !== 'up' || !web.length) return;
      if (!o.guest) { if (web.indexOf(L.host) < 0) moveTo(web[0], true); return; }
      if (L.moveTo && L.moveTo !== L.host && MT().webHostOk(L.moveTo, web)) moveTo(L.moveTo, true);
    }
    function onMv(m) {
      if (L.closed || !L.end || typeof m.h !== 'string' || m.h === L.host) return;
      if (MT().webHostOk(m.h, L.cred ? L.cred.web() : [])) moveTo(m.h, false);
      else if (o.guest) L.moveTo = m.h;   // not a host of my grant yet: my next renewal decides
    }
    function haveBoth() { if (L.mine && L.peer) credStart(); }
    function close(why, quiet) {
      if (L.closed) return;
      L.closed = true; L.state = 'closed';
      log('closed ' + why);
      if (!quiet) { try { o.sendTv({ k: 'tv', q: 'x', l: L.l }); } catch (e) {} }
      try { if (L.cred) L.cred.stop(); } catch (e) {}
      try { if (L.end) L.end.close(why); } catch (e) {}
      try { if (o.onDown) o.onDown('closed'); } catch (e) {}
    }
    return {
      get state() { return L.state; }, get l() { return L.l; }, get far() { return L.far; },
      start() { if (o.guest) sendAsk(0); },
      // a handshake frame from the far end (already checked with tvOk)
      onTv(f) {
        if (L.closed) return;
        if (f.q === 'x') { close('the far end ended it', true); return; }
        if (f.q === 'c') {
          if (f.b === 1) { close('busy', true); return; }
          if (L.farDev && L.farDev !== f.d) return;
          const first = !L.farDev; L.farDev = f.d; L.farSub = f.e ? parseInt(f.e, 36) : 0;
          if (!o.guest) sendAsk(0);       // the carrier answers every ask: the guest's cue, and its own vouch follows
          if (first || !usable(L.mine)) askMine();
          else if (L.mine) o.sendTv(L.mine.frame);
          return;
        }
        if (f.q === 'v') {
          if (!L.farDev) return;
          const e = parseInt(f.e, 36);
          L.peer = MT().vouchToken(o.sid(), L.farSub, L.farDev, o.dev(), L.l, e, f.n, f.m); L.peerV = { e, at: now() };
          haveBoth();
        }
      },
      // the relay's answer to my vouch ask: {t:'tvouch', to, l, v, e} or {error}
      onVouch(m) {
        if (L.closed || m.to !== L.farDev || m.l !== L.l) return;
        if (!m.v) { log('vouch refused: ' + m.error); return; }
        const p = MT().vouchParts(m.v); if (!p) return;
        const frame = { k: 'tv', q: 'v', l: L.l, e: Number(p.e).toString(36), n: p.n, m: p.m };
        L.mine = { v: m.v, e: Number(p.e), at: now(), frame };
        o.sendTv(frame);
        haveBoth();
      },
      sendAudio(buf) { if (L.end && L.state === 'up') L.end.sendMedia(0, 'audio', false, buf); },
      sendText(obj) { return !!(L.end && L.state === 'up' && L.end.sendText(JSON.stringify(obj))); },
      stats() { return L.end ? L.end.stats() : Promise.resolve(null); },
      info() { return { l: L.l, far: L.far, farDev: L.farDev, state: L.state, mine: !!L.mine, peer: !!L.peer, cred: L.cred ? L.cred.state() : 'none', refusal: L.cred ? L.cred.refusal() : null, upAt: L.upAt, host: L.host }; },
      askedAt: () => L.askedAt,
      close,
    };
  }

  // ---- the voice --------------------------------------------------------------------------------------------------
  // The two AudioWorklet processors: carry-cap cuts its input into 20 ms frames for the encoder; carry-play is the jitter
  // buffer (see docs/turn-carry.md "Known costs"): it plays decoded frames at its context's rate, holding a target of
  // JB_START..JB_MAX frames that follows the arrival jitter, and skips the oldest frames when it holds more than the
  // target and JB_SLACK, so a stall of the TCP pipe costs one gap, never a growing delay.
  const WORKLET_SRC = `
class CarryCap extends AudioWorkletProcessor {
  constructor(o) { super(); this.n = Math.round(sampleRate * ${OPUS_FRAME} / 1000); this.buf = new Float32Array(this.n); this.k = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) for (let i = 0; i < ch.length; i++) { this.buf[this.k++] = ch[i]; if (this.k === this.n) { this.port.postMessage(this.buf, [this.buf.buffer]); this.buf = new Float32Array(this.n); this.k = 0; } }
    return true;
  }
}
class CarryPlay extends AudioWorkletProcessor {
  constructor() {
    super(); this.q = []; this.cur = null; this.pos = 0; this.target = ${JB_START}; this.started = false; this.lastAt = 0; this.jit = 0;
    this.st = { in: 0, played: 0, skipped: 0, under: 0 };
    this.port.onmessage = (ev) => {
      const m = ev.data;
      if (m && m.stats) { this.port.postMessage({ stats: Object.assign({ held: this.q.length, target: this.target }, this.st) }); return; }
      const now = currentTime * 1000;
      if (this.lastAt) { const gap = Math.abs(now - this.lastAt - ${OPUS_FRAME}); this.jit = this.jit * 0.95 + gap * 0.05; }
      this.lastAt = now;
      this.target = Math.max(${JB_START}, Math.min(${JB_MAX}, Math.ceil(${JB_START} + 2 * this.jit / ${OPUS_FRAME})));
      this.q.push(m); this.st.in++;
      if (this.q.length > this.target + ${JB_SLACK}) { const drop = this.q.length - this.target; this.q.splice(0, drop); this.st.skipped += drop; }
    };
  }
  process(inputs, outputs) {
    const out = outputs[0][0];
    if (!this.started) { if (this.q.length >= this.target) this.started = true; else { out.fill(0); return true; } }
    for (let i = 0; i < out.length; i++) {
      if (!this.cur || this.pos >= this.cur.pcm.length) {
        this.cur = this.q.shift() || null; this.pos = 0;
        if (this.cur) this.st.played++;
        else { this.st.under++; this.started = false; out.fill(0, i); return true; }
      }
      out[i] = this.cur.pcm[Math.floor(this.pos)];
      this.pos += this.cur.rate / sampleRate;   // a frame made at another rate is stepped through at its own pace
    }
    return true;
  }
}
registerProcessor('carry-cap', CarryCap);
registerProcessor('carry-play', CarryPlay);
`;
  const workletReady = new WeakMap();   // AudioContext -> Promise
  function ensureWorklet(ac) {
    let p = workletReady.get(ac);
    if (!p) { p = ac.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'text/javascript' }))); workletReady.set(ac, p); }
    return p;
  }

  // createVoice(ac, o) → { input, output, send(source), stop(), stats() }: one end's voice.
  //   input   an AudioNode: whatever is connected to it is encoded and handed to o.onPacket(ArrayBuffer) every 20 ms
  //   output  an AudioNode: the far end's decoded voice, through the jitter buffer (connect it where it is to be heard)
  //   take(buf) an Opus packet from the far end
  //   o.ear     an AudioContext that plays to the speaker: the far end's voice is HEARD there, through a jitter buffer of
  //             its own on that context's clock (ac may play to no device)
  function createVoice(ac, o) {
    const V = { input: null, output: null, ready: null, st: { enc: 0, dec: 0, encErr: 0, decErr: 0 } };
    let enc = null, dec = null, cap = null, play = null, ear = null, ts = 0, stopped = false, statsWait = null;
    V.ready = ensureWorklet(ac).then(() => {
      if (stopped) return;
      V.input = ac.createGain();
      cap = new AudioWorkletNode(ac, 'carry-cap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' });
      V.input.connect(cap);
      const sink = ac.createGain(); sink.gain.value = 0; cap.connect(sink); sink.connect(ac.destination);   // pulled, never heard
      play = new AudioWorkletNode(ac, 'carry-play', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
      V.output = ac.createGain(); play.connect(V.output);
      return o.ear ? ensureWorklet(o.ear).then(() => {   // the ear: a jitter buffer of its own on the speaker context's clock
        if (stopped) return;
        ear = new AudioWorkletNode(o.ear, 'carry-play', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
        ear.connect(o.ear.destination);
      }).catch(() => { ear = null; }) : null;   // no ear: the room still hears this voice
    }).then(() => {
      if (stopped) return;
      play.port.onmessage = (ev) => { if (ev.data && ev.data.stats && statsWait) { const r = statsWait; statsWait = null; r(ev.data.stats); } };
      enc = new AudioEncoder({
        output: (chunk) => { const b = new ArrayBuffer(chunk.byteLength); chunk.copyTo(b); V.st.enc++; try { o.onPacket(b); } catch (e) {} },
        error: () => { V.st.encErr++; },
      });
      enc.configure({ codec: 'opus', sampleRate: ac.sampleRate, numberOfChannels: 1, bitrate: BITRATE, opus: { frameDuration: OPUS_FRAME * 1000 } });
      dec = new AudioDecoder({
        output: (ad) => {
          try { const pcm = new Float32Array(ad.numberOfFrames); ad.copyTo(pcm, { planeIndex: 0, format: 'f32-planar' }); V.st.dec++; if (ear) ear.port.postMessage({ pcm: pcm.slice(), rate: ad.sampleRate }); play.port.postMessage({ pcm, rate: ad.sampleRate }, [pcm.buffer]); } catch (e) { V.st.decErr++; }
          try { ad.close(); } catch (e) {}
        },
        error: () => { V.st.decErr++; },
      });
      dec.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 1 });
      cap.port.onmessage = (ev) => {
        if (stopped || !enc || enc.state !== 'configured') return;
        const pcm = ev.data;
        try { const ad = new AudioData({ format: 'f32-planar', sampleRate: ac.sampleRate, numberOfFrames: pcm.length, numberOfChannels: 1, timestamp: ts, data: pcm }); ts += Math.round(pcm.length * 1e6 / ac.sampleRate); enc.encode(ad); ad.close(); } catch (e) { V.st.encErr++; }
      };
      return V;
    });
    let dts = 0;
    V.take = (buf) => {
      if (stopped || !dec || dec.state !== 'configured') return;
      try { dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: dts, data: buf })); dts += OPUS_FRAME * 1000; } catch (e) { V.st.decErr++; }
    };
    V.stats = () => new Promise((res) => { if (!play) return res(Object.assign({}, V.st)); statsWait = (s) => res(Object.assign({}, V.st, s)); play.port.postMessage({ stats: 1 }); setTimeout(() => { if (statsWait) { statsWait = null; res(Object.assign({}, V.st)); } }, TM().TUNNEL_STATS_WAIT_MS); });
    V.stop = () => {
      stopped = true;
      for (const n of [V.input, cap, play, V.output, ear]) { try { if (n) n.disconnect(); } catch (e) {} }
      try { if (enc && enc.state !== 'closed') enc.close(); } catch (e) {}
      try { if (dec && dec.state !== 'closed') dec.close(); } catch (e) {}
    };
    return V;
  }

  // ---- the carried page's door socket -----------------------------------------------------------------------------
  // createDoor(o) → the carried page's one relay socket: it knocks without a blob (admitted, never a greeter), reads the
  // sealed greeter list, and passes the relay's frames on. It is the door client the mesh's own socket is, minus the
  // seat: no registration, no mesh frame.
  // o = { url() → the socket URL, gk, key (the room key the list is sealed under), net (gifos-net), onList(ids),
  //       onFrame(m), onOpen(), onClose(code), log }
  function createDoor(o) {
    let ws = null, stopped = false, tries = 0, knockT = null;
    const log = (s) => { try { if (o.log) o.log('carry door ' + s); } catch (e) {} };
    function knock() { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'knock', gk: o.gk })); }
    function open() {
      if (stopped) return;
      Promise.resolve(o.url()).then((url) => {
        if (stopped) return;
        try { ws = new WebSocket(url); } catch (e) { retry(); return; }
        ws.onopen = () => { tries = 0; log('open'); try { o.onOpen && o.onOpen(); } catch (e) {} knock(); };
        ws.onclose = (c) => { log('closed ' + c.code); try { o.onClose && o.onClose(c.code); } catch (e) {} retry(); };
        ws.onmessage = async (ev) => {
          let m = null; try { m = JSON.parse(ev.data); } catch (e) { return; }
          if (!m || typeof m !== 'object') return;
          if (m.t === 'greeters') {
            const ids = [];
            for (const s of (m.list || [])) { try { const b = await o.net.open(o.key, JSON.parse(s)); if (b && b.p) ids.push(String(b.p)); } catch (e) {} }
            log('greeters ' + ids.length + (m.admitted === false ? ' (not admitted)' : ''));
            try { o.onList(ids, m); } catch (e) {}
            return;
          }
          try { o.onFrame(m); } catch (e) {}
        };
      });
    }
    function retry() { ws = null; if (stopped) return; const wait = Math.min(TM().TUNNEL_RETRY_MAX_MS, TM().TUNNEL_RETRY_BASE_MS * Math.pow(2, tries++)); setTimeout(open, wait); }
    open();
    return {
      send(obj) { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(obj)); return true; } return false; },
      knock,
      up: () => !!(ws && ws.readyState === 1),
      stop() { stopped = true; clearTimeout(knockT); try { if (ws) ws.close(); } catch (e) {} },
    };
  }

  const api = { CARRY_MAX, LINKS, OPUS_FRAME, BITRATE, JB_START, JB_MAX, linkName, supported, tvOk, createLink, createVoice, createDoor };
  GifOS.meetCarry = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
