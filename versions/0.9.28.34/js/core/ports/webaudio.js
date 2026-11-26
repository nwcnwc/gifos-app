/*
 * ports/webaudio.js: the audio half of the Node media port. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * A W3C-shaped AudioContext for a host with no browser (js/core/node.js), over Opus RTP on werift tracks, so the core and
 * the page libraries hear and speak through the same names as on a page: the level meters (meterFor), the agent's voice
 * and its ears (meet-agent.js: say, audio.out, audio.in) and any later mix run unchanged. It is the media port's audio
 * machinery, as werift is its transport: plain Web Audio semantics, mono, one render quantum every 20 ms.
 *
 * THE SUBSET. AudioContext({ sampleRate }) with currentTime, sampleRate, state, resume/suspend/close, destination,
 * createGain, createDynamicsCompressor (mono peak limiter: threshold, knee, ratio, attack, release and reduction;
 *   a per-sample envelope, the ratio curve above the threshold, then a hard ceiling under full scale),
 * createAnalyser (getByteTimeDomainData, getFloatTimeDomainData), createScriptProcessor (onaudioprocess),
 * createMediaStreamSource (a remote werift track: its Opus decoded; a track this port made: its samples),
 * createMediaStreamDestination (.stream: a werift MediaStream whose track carries the mix as Opus RTP), createBuffer,
 * createBufferSource (start/stop/onended, linear resampling) and decodeAudioData (PCM WAV, 16-bit or float).
 * Everything else a page might ask (panners, worklets, element sources) is absent: a use is a TypeError. Inert here,
 * by design: AudioParam automation (a ramp lands at once), playbackRate and loop (read, never applied), and the analyser's
 * frequency reads (silence): the core and the agent never use them on this host.
 *
 * THE CLOCK. One 20 ms tick per context, corrected against the wall clock (a late tick renders the quanta it owes, at
 * most 5). Each tick pulls the graph from its sinks (destination, stream destinations, analysers, script processors);
 * a node renders once per quantum however many sinks pull it. A context with no sink connected does no work.
 *
 * THE CODEC comes from the host (opts.Opus: an opusscript-shaped constructor (rate, channels, application) with
 * encode(Buffer int16, frames) and decode(Buffer)): wasm by default, so the participant's sandbox loads no native code.
 *
 * Usage: const wa = require('./ports/webaudio.js').port({ Opus, werift, timings: GifOS.timings }); then wa.AudioContext.
 */
(function (root) {
  'use strict';
  const RTP_RATE = 48000, MAX_CATCHUP = 5, FIFO_MAX = RTP_RATE / 2;   // Opus on the wire is 48 kHz; a source keeps at most 0.5 s queued

  function port(opts) {
    const Opus = opts && opts.Opus, W = opts && opts.werift;
    if (typeof Opus !== 'function') throw new Error('webaudio port: opts.Opus (an Opus codec constructor) is required');
    if (!W || typeof W.MediaStreamTrack !== 'function') throw new Error('webaudio port: opts.werift is required');
    // the render quantum is one Opus frame (timings.json AUDIO_QUANTUM_MS)
    const QUANTUM_MS = opts.timings && +opts.timings.AUDIO_QUANTUM_MS;
    if (!(QUANTUM_MS > 0)) throw new Error('webaudio port: opts.timings.AUDIO_QUANTUM_MS is required');
    const FRAME = Math.round(RTP_RATE * QUANTUM_MS / 1000);
    const made = new WeakMap();   // a track this port made -> its tap (the samples it carries, for a local source)

    // linear resampling of a mono Float32Array
    function resample(x, from, to) {
      if (from === to || !x.length) return x;
      const n = Math.max(1, Math.round(x.length * to / from)), out = new Float32Array(n), k = (x.length - 1) / Math.max(1, n - 1);
      for (let i = 0; i < n; i++) { const p = i * k, j = Math.floor(p), f = p - j; out[i] = x[j] + ((x[j + 1] !== undefined ? x[j + 1] : x[j]) - x[j]) * f; }
      return out;
    }
    // a FIFO of mono samples at one rate
    class Fifo {
      constructor() { this.chunks = []; this.len = 0; }
      push(x) { if (!x.length) return; this.chunks.push(x); this.len += x.length; while (this.len > FIFO_MAX && this.chunks.length > 1) this.len -= this.chunks.shift().length; }
      take(n) {
        const out = new Float32Array(n); let at = 0;
        while (at < n && this.chunks.length) {
          const c = this.chunks[0], m = Math.min(n - at, c.length);
          out.set(c.subarray(0, m), at); at += m;
          if (m === c.length) this.chunks.shift(); else this.chunks[0] = c.subarray(m);
          this.len -= m;
        }
        return out;
      }
    }
    const toI16 = (f) => { const b = Buffer.alloc(f.length * 2); for (let i = 0; i < f.length; i++) { const v = Math.max(-1, Math.min(1, f[i])); b.writeInt16LE(Math.round(v * 32767), i * 2); } return b; };
    const fromI16 = (b) => { const n = b.length >> 1, f = new Float32Array(n); for (let i = 0; i < n; i++) f[i] = b.readInt16LE(i * 2) / 32768; return f; };

    // ---- nodes -----------------------------------------------------------------------------------------------
    class AudioParam { constructor(v) { this.value = v; this.defaultValue = v; } setValueAtTime(v) { this.value = v; return this; } linearRampToValueAtTime(v) { this.value = v; return this; } setTargetAtTime(v) { this.value = v; return this; } cancelScheduledValues() { return this; } }
    class AudioNode {
      constructor(ctx) { this.context = ctx; this.inputs = new Set(); this.outputs = new Set(); this._q = -1; this._out = null; this.channelCount = 1; this.numberOfInputs = 1; this.numberOfOutputs = 1; }
      // a sink (destination, analyser, processor, stream destination) is pulled each quantum only while something feeds it,
      // so a meter or a voice that was let go costs nothing and is collected
      connect(dst) { if (dst instanceof AudioParam) return dst; if (!(dst instanceof AudioNode)) throw new TypeError('connect: not an AudioNode'); this.outputs.add(dst); dst.inputs.add(this); if (dst._sink) dst.context._sinks.add(dst); return dst; }
      disconnect(dst) { for (const d of Array.from(this.outputs)) if (!dst || d === dst) { this.outputs.delete(d); d.inputs.delete(this); if (d._sink && !d.inputs.size) d.context._sinks.delete(d); } }
      _mix(q, n) { const out = new Float32Array(n); for (const i of this.inputs) { const x = i._pull(q, n); for (let k = 0; k < n; k++) out[k] += x[k]; } return out; }
      _pull(q, n) { if (this._q !== q) { this._q = q; this._out = this._render(q, n); } return this._out; }
      _render(q, n) { return this._mix(q, n); }
    }
    class GainNode extends AudioNode {
      constructor(ctx) { super(ctx); this.gain = new AudioParam(1); }
      _render(q, n) { const x = this._mix(q, n), g = +this.gain.value; if (g !== 1) for (let k = 0; k < n; k++) x[k] *= g; return x; }
    }
    // Peak limiter (DynamicsCompressorNode), mono, one quantum at a time like GainNode. The fold
    // (mesh-media createAudioFold) sets threshold, knee, ratio, attack and release; each render reads .value
    // (automation is inert, as on every AudioParam here). A per-sample envelope follows the level: attack while
    // it rises, release while it falls. At and below the threshold the gain is 1; above it the overshoot in dB
    // is divided by the ratio. A knee wider than 0 is a straight line from unity up to that curve. reduction is
    // the curve's gain reduction in dB (0, or negative). The last step is a hard ceiling at the int16 full scale
    // (32767/32768), so a sample never leaves this node at magnitude 1 or more.
    function compCoef(sec, sr) { const s = +sec; return s > 0 && isFinite(s) ? Math.exp(-1 / (sr * s)) : 0; }
    function compGain(level, threshDb, kneeDb, ratio) {
      if (!(level > 0)) return 1;
      const db = 20 * Math.log10(level), half = kneeDb > 0 ? kneeDb / 2 : 0;
      let out = db;
      if (!(kneeDb > 0) || db >= threshDb + half) { if (db > threshDb) out = threshDb + (db - threshDb) / ratio; }
      else if (db > threshDb - half) {
        const x0 = threshDb - half, y1 = threshDb + half / ratio, t = (db - x0) / kneeDb;
        out = x0 + t * (y1 - x0);
      }
      const g = Math.pow(10, (out - db) / 20);
      return g > 0 && g <= 1 ? g : (g > 1 ? 1 : 0);
    }
    class DynamicsCompressorNode extends AudioNode {
      constructor(ctx) {
        super(ctx);
        this.threshold = new AudioParam(-24); this.knee = new AudioParam(30); this.ratio = new AudioParam(12);
        this.attack = new AudioParam(0.003); this.release = new AudioParam(0.25);
        this.reduction = 0; this._env = 0;
      }
      _render(q, n) {
        const x = this._mix(q, n), sr = this.context.sampleRate, CEIL = 32767 / 32768;
        const thresh = +this.threshold.value, knee = Math.max(0, +this.knee.value), ratio = Math.max(1, +this.ratio.value);
        const cA = compCoef(this.attack.value, sr), cR = compCoef(this.release.value, sr);
        let env = this._env, red = 0;
        for (let k = 0; k < n; k++) {
          const a = Math.abs(x[k]), c = a > env ? cA : cR;
          env = c * env + (1 - c) * a;
          const g = compGain(env, thresh, knee, ratio);
          let y = x[k] * g;
          if (y > CEIL) y = CEIL; else if (y < -CEIL) y = -CEIL;
          x[k] = y; red = g < 1 ? 20 * Math.log10(Math.max(g, 1e-8)) : 0;
        }
        this._env = env; this.reduction = red;
        return x;
      }
    }
    class AnalyserNode extends AudioNode {
      constructor(ctx) { super(ctx); this._sink = true; this.fftSize = 2048; this._hist = new Float32Array(2048); this.smoothingTimeConstant = 0.8; this.minDecibels = -100; this.maxDecibels = -30; }
      get frequencyBinCount() { return this.fftSize / 2; }
      _render(q, n) {
        const x = this._mix(q, n);
        if (this._hist.length !== this.fftSize) { const h2 = new Float32Array(this.fftSize); h2.set(this._hist.subarray(Math.max(0, this._hist.length - h2.length)), Math.max(0, h2.length - this._hist.length)); this._hist = h2; }
        const h = this._hist, m = Math.min(n, h.length); h.copyWithin(0, m); h.set(x.subarray(x.length - m), h.length - m); return x;
      }
      getFloatTimeDomainData(a) { const h = this._hist, m = Math.min(a.length, this.fftSize); a.set(h.subarray(h.length - m), 0); }
      getByteTimeDomainData(a) { const h = this._hist, m = Math.min(a.length, this.fftSize), s = h.length - m; for (let i = 0; i < m; i++) a[i] = Math.max(0, Math.min(255, Math.round(128 + h[s + i] * 128))); }
      getByteFrequencyData(a) { a.fill(0); }
      getFloatFrequencyData(a) { a.fill(-Infinity); }
    }
    class ScriptProcessorNode extends AudioNode {
      constructor(ctx, size) { super(ctx); this._sink = true; this.bufferSize = size || 1024; this.onaudioprocess = null; this._acc = new Fifo(); }
      _render(q, n) {
        const x = this._mix(q, n); this._acc.push(x);
        while (this._acc.len >= this.bufferSize) {
          const d = this._acc.take(this.bufferSize), sr = this.context.sampleRate, size = this.bufferSize;
          const buf = (data) => ({ numberOfChannels: 1, length: size, sampleRate: sr, duration: size / sr, getChannelData: () => data });
          const e = { inputBuffer: buf(d), outputBuffer: buf(new Float32Array(size)), playbackTime: this.context.currentTime };
          try { if (typeof this.onaudioprocess === 'function') this.onaudioprocess(e); } catch (err) { this.context._fail(err); }
        }
        return new Float32Array(n);   // a processor's output is silence here (no one plays it)
      }
    }
    class AudioBuffer {
      constructor(o) { this.numberOfChannels = o.numberOfChannels || 1; this.length = o.length | 0; this.sampleRate = o.sampleRate; this._ch = []; for (let c = 0; c < this.numberOfChannels; c++) this._ch.push(o.data && o.data[c] ? o.data[c] : new Float32Array(this.length)); }
      get duration() { return this.length / this.sampleRate; }
      getChannelData(c) { return this._ch[c | 0]; }
      copyToChannel(src, c) { this._ch[c | 0].set(src); }
    }
    class AudioBufferSourceNode extends AudioNode {
      constructor(ctx) { super(ctx); this.buffer = null; this.onended = null; this._at = null; this._pos = 0; this._done = false; this._data = null; this.playbackRate = new AudioParam(1); this.loop = false; }
      start(when) { if (this._at != null) throw new Error('InvalidStateError: start called twice'); this._at = Math.max(+when || 0, this.context.currentTime); this.context._active.add(this); }
      stop() { if (this._done) return; this._end(); }
      _end() { if (this._done) return; this._done = true; this.context._active.delete(this); const f = this.onended; if (typeof f === 'function') Promise.resolve().then(() => { try { f.call(this, { type: 'ended', target: this }); } catch (e) { this.context._fail(e); } }); }
      _render(q, n) {
        const out = new Float32Array(n), ctx = this.context;
        if (this._at == null || this._done || !this.buffer) return out;
        if (!this._data) { const b = this.buffer, mono = new Float32Array(b.length); for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < b.length; i++) mono[i] += d[i] / b.numberOfChannels; } this._data = resample(mono, b.sampleRate, ctx.sampleRate); }
        const t0 = q * n;   // the quantum's first frame, on the context's frame clock
        const startF = Math.round(this._at * ctx.sampleRate);
        let k = Math.max(0, startF - t0);
        while (k < n && this._pos < this._data.length) out[k++] = this._data[this._pos++];
        if (this._pos >= this._data.length) this._end();
        return out;
      }
    }
    // ONE DECODER PER REMOTE TRACK: every source reading a track (the meter, the agent's ears, a mix) shares one Opus
    // decoder and one RTP subscription; the first listener opens them, the last one gone frees them.
    const decoded = new WeakMap();   // a remote track -> its tap
    let decoders = 0;
    function decodedTap(t) {
      let tap = decoded.get(t);
      if (tap) return tap;
      const listeners = new Map();   // listener -> the context it reads for (a decode error is that context's)
      let dec = null, sub = null, said = false;
      const open = () => {
        dec = new Opus(RTP_RATE, 1); decoders++;
        sub = t.onReceiveRtp.subscribe((rtp, ext, info) => {
          if (info && info.type && info.type !== 'media') return;
          if (!rtp || !rtp.payload || !rtp.payload.length) return;
          let x; try { x = fromI16(dec.decode(rtp.payload)); } catch (e) { if (!said) { said = true; const err = new Error('webaudio: an Opus packet did not decode (' + String(e && e.message || e) + ')'); for (const c of new Set(listeners.values())) c._fail(err); } return; }
          for (const f of listeners.keys()) { try { f(x); } catch (e) {} }
        });
      };
      const close = () => { try { sub.unSubscribe(); } catch (e) {} try { if (dec.delete) dec.delete(); } catch (e) {} sub = null; dec = null; decoders--; decoded.delete(t); };
      tap = { listen: (f, c) => { if (!listeners.size) open(); listeners.set(f, c); return () => { if (listeners.delete(f) && !listeners.size) close(); }; } };
      decoded.set(t, tap);
      return tap;
    }
    // a source from a MediaStream: a remote werift track (its Opus RTP decoded) or a track this port made (its samples)
    class MediaStreamAudioSourceNode extends AudioNode {
      constructor(ctx, o) {
        super(ctx); this.numberOfInputs = 0;
        const s = o && o.mediaStream, t = s && s.getAudioTracks && s.getAudioTracks()[0];
        if (!t) throw new Error('InvalidStateError: the MediaStream has no audio track');
        this.mediaStream = s; this._fifo = new Fifo(); this._rate = RTP_RATE;
        const tap = made.get(t);
        if (tap) { this._unsub = tap.listen((x) => this._fifo.push(x)); this._rate = RTP_RATE; }
        else if (t.onReceiveRtp && typeof t.onReceiveRtp.subscribe === 'function') this._unsub = decodedTap(t).listen((x) => this._fifo.push(x), ctx);
        else throw new Error('InvalidStateError: this host cannot read that track');
        ctx._srcs.add(this);
      }
      disconnect(d) { super.disconnect(d); if (!this.outputs.size && this._unsub) { this._unsub(); this._unsub = null; this.context._srcs.delete(this); } }
      _render(q, n) { const want = Math.round(n * this._rate / this.context.sampleRate); return resample(this._fifo.take(want), this._rate, this.context.sampleRate).subarray(0, n); }
    }
    // a sink to a MediaStream: one werift audio track carrying the mix as Opus RTP (and a tap for local sources)
    class MediaStreamAudioDestinationNode extends AudioNode {
      constructor(ctx) {
        super(ctx); this.numberOfOutputs = 0;
        const track = new W.MediaStreamTrack({ kind: 'audio' });
        const listeners = new Set();
        made.set(track, { listen: (f) => { listeners.add(f); return () => listeners.delete(f); } });
        this._listeners = listeners; this._track = track;
        this.stream = new W.MediaStream([track]);
        this._enc = new Opus(RTP_RATE, 1, Opus.Application ? Opus.Application.VOIP : 2048);
        this._seq = Math.floor(Math.random() * 65535); this._ts = Math.floor(Math.random() * 0xffffffff); this._ssrc = 1 + Math.floor(Math.random() * 0x7ffffffe);
        this._pend = new Fifo(); this._sink = true; this._said = false;
        ctx._codecs.add(this);
      }
      _free() { try { if (this._enc && this._enc.delete) this._enc.delete(); } catch (e) {} this._enc = null; }
      _render(q, n) {
        const x = this._mix(q, n), y = resample(x, this.context.sampleRate, RTP_RATE);
        for (const f of this._listeners) { try { f(y); } catch (e) {} }
        if (this._track.stopped || !this._enc) return x;   // a stopped voice encodes nothing
        this._pend.push(y);
        while (this._pend.len >= FRAME) {
          const pcm = this._pend.take(FRAME);
          let payload; try { payload = this._enc.encode(toI16(pcm), FRAME); } catch (e) { if (!this._said) { this._said = true; this.context._fail(e); } continue; }
          const pkt = new W.RtpPacket(new W.RtpHeader({ payloadType: 111, sequenceNumber: this._seq, timestamp: this._ts >>> 0, marker: false, ssrc: this._ssrc }), Buffer.from(payload));
          this._seq = (this._seq + 1) & 0xffff; this._ts = (this._ts + FRAME) >>> 0;
          try { this._track.writeRtp(pkt); } catch (e) { if (!this._said) { this._said = true; this.context._fail(new Error('webaudio: a voice packet could not be sent (' + String(e && e.message || e) + ')')); } }
        }
        return x;
      }
    }
    class AudioDestinationNode extends AudioNode {
      constructor(ctx) { super(ctx); this._sink = true; this.numberOfOutputs = 0; this.maxChannelCount = 2; }
    }

    // ---- the context ------------------------------------------------------------------------------------------
    class AudioContext {
      constructor(o) {
        const r = o && +o.sampleRate;
        this.sampleRate = r >= 8000 && r <= 96000 ? r : RTP_RATE;
        this._sinks = new Set(); this._active = new Set(); this._srcs = new Set(); this._codecs = new Set(); this._q = 0; this.state = 'running'; this.onstatechange = null;
        this._t0 = Date.now(); this.baseLatency = QUANTUM_MS / 1000; this.outputLatency = 0;
        this.destination = new AudioDestinationNode(this);
        this._timer = setInterval(() => this._tick(), QUANTUM_MS); if (this._timer.unref) this._timer.unref();
        AudioContext._live.add(this);
      }
      get currentTime() { return this._q * QUANTUM_MS / 1000; }
      _fail(e) { if (typeof AudioContext.onerror === 'function') try { AudioContext.onerror(e); } catch (x) {} }
      _tick() {
        if (this.state !== 'running') { this._t0 = Date.now() - this._q * QUANTUM_MS; return; }
        const owed = Math.floor((Date.now() - this._t0) / QUANTUM_MS) - this._q;
        if (owed <= 0) return;
        if (owed > MAX_CATCHUP) this._t0 = Date.now() - (this._q + MAX_CATCHUP) * QUANTUM_MS;   // a long stall: render what fits, drop the rest
        const k = Math.min(MAX_CATCHUP, owed);
        const n = Math.round(this.sampleRate * QUANTUM_MS / 1000);
        for (let i = 0; i < k; i++) {
          for (const s of this._sinks) if (s.inputs.size) { try { s._pull(this._q, n); } catch (e) { this._fail(e); } }
          // an unconnected buffer source still plays out its time (its onended must come), and an unconnected stream source drains
          for (const s of Array.from(this._active)) if (!s.outputs.size) s._pull(this._q, n);
          for (const s of this._srcs) if (!s.outputs.size) s._pull(this._q, n);
          this._q++;
        }
      }
      _state(s) { if (this.state === s) return; this.state = s; if (typeof this.onstatechange === 'function') try { this.onstatechange({ type: 'statechange', target: this }); } catch (e) {} }
      resume() { if (this.state !== 'closed') this._state('running'); return Promise.resolve(); }
      suspend() { if (this.state !== 'closed') this._state('suspended'); return Promise.resolve(); }
      close() {
        clearInterval(this._timer);
        for (const s of Array.from(this._srcs)) { try { s.disconnect(); } catch (e) {} }   // frees each source's decoder
        for (const d of this._codecs) d._free();                                           // and each voice's encoder
        this._codecs.clear(); this._sinks.clear(); this._active.clear();
        this._state('closed'); AudioContext._live.delete(this); return Promise.resolve();
      }
      createGain() { return new GainNode(this); }
      createDynamicsCompressor() { return new DynamicsCompressorNode(this); }
      createAnalyser() { return new AnalyserNode(this); }
      createScriptProcessor(size) { return new ScriptProcessorNode(this, size); }
      createMediaStreamSource(stream) { return new MediaStreamAudioSourceNode(this, { mediaStream: stream }); }
      createMediaStreamDestination() { return new MediaStreamAudioDestinationNode(this); }
      createBuffer(ch, len, rate) { return new AudioBuffer({ numberOfChannels: ch, length: len, sampleRate: rate }); }
      createBufferSource() { return new AudioBufferSourceNode(this); }
      decodeAudioData(bytes, ok, bad) {
        const p = new Promise((res, rej) => { try { res(decodeWav(bytes)); } catch (e) { rej(e); } });
        p.then((b) => { if (typeof ok === 'function') ok(b); }, (e) => { if (typeof bad === 'function') bad(e); });
        return p;
      }
    }
    AudioContext._live = new Set();
    // RIFF/WAVE, PCM 8/16/24/32-bit integer or 32-bit float, any channel count
    function decodeWav(bytes) {
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), tag = (o) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
      if (u8.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('EncodingError: not a WAV file');
      let o = 12, fmt = null, data = null;
      while (o + 8 <= u8.length) { const id = tag(o), len = dv.getUint32(o + 4, true); if (id === 'fmt ') fmt = o + 8; else if (id === 'data') data = { at: o + 8, len: Math.min(len, u8.length - o - 8) }; o += 8 + len + (len & 1); }
      if (fmt == null || !data) throw new Error('EncodingError: a WAV file needs fmt and data');
      const format = dv.getUint16(fmt, true), ch = dv.getUint16(fmt + 2, true), rate = dv.getUint32(fmt + 4, true), bits = dv.getUint16(fmt + 14, true);
      const bps = bits / 8, frames = Math.floor(data.len / (bps * ch)), chans = [];
      for (let c = 0; c < ch; c++) chans.push(new Float32Array(frames));
      for (let i = 0; i < frames; i++) for (let c = 0; c < ch; c++) {
        const at = data.at + (i * ch + c) * bps; let v;
        if (format === 3 && bits === 32) v = dv.getFloat32(at, true);
        else if (bits === 16) v = dv.getInt16(at, true) / 32768;
        else if (bits === 8) v = (u8[at] - 128) / 128;
        else if (bits === 24) { let x = u8[at] | (u8[at + 1] << 8) | (u8[at + 2] << 16); if (x & 0x800000) x |= ~0xffffff; v = x / 8388608; }
        else if (bits === 32) v = dv.getInt32(at, true) / 2147483648;
        else throw new Error('EncodingError: WAV sample format not supported');
        chans[c][i] = v;
      }
      return new AudioBuffer({ numberOfChannels: ch, length: frames, sampleRate: rate, data: chans });
    }
    // what is alive (for a host's leak check): open contexts, and across them the sinks pulled, sources reading, voices encoding;
    // decoders: remote tracks being decoded (one per track, however many sources read it)
    const stats = () => { let sinks = 0, sources = 0, codecs = 0; for (const c of AudioContext._live) { sinks += c._sinks.size; sources += c._srcs.size; codecs += c._codecs.size; } return { contexts: AudioContext._live.size, sinks, sources, codecs, decoders }; };
    return { AudioContext, webkitAudioContext: AudioContext, AudioBuffer, AudioNode, GainNode, DynamicsCompressorNode, AnalyserNode, decodeWav, stats, made: (t) => made.has(t) };
  }

  const api = { port, RTP_RATE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;   // a host module: nothing on the host's global
  else { const GifOS = root.GifOS = root.GifOS || {}; GifOS.webaudioPort = api; }
})(typeof window !== 'undefined' ? window : globalThis);
