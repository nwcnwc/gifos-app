/*
 * ports/loopback.js: an in-process media port. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * W3C-shaped RTCPeerConnection, RTCSessionDescription, RTCIceCandidate and MediaStream for a host that has no WebRTC
 * (js/core/node.js), with which participants in ONE process reach each other. It carries DATA CHANNELS ONLY: tracks and
 * transceivers are accepted and kept, and no media flows. It is the bring-up port and the template a real Node or
 * native port follows: the same surface, with a transport underneath.
 *
 * HOW TWO ENDS MEET. Every connection has a token, written into the SDP it generates as its ICE user fragment
 * (a=ice-ufrag). The SDP travels through the meeting's own signalling like any other. When an end holds both
 * descriptions it looks the other token up in the process-wide hub; the pair connects once both ends have applied the
 * other's description, and each side walks the usual states (new, checking/connecting, connected).
 *
 * DATA CHANNELS. A channel made before the connection opens with it; one made after reaches the other end through
 * ondatachannel, as over SCTP. A negotiated channel pairs with the other end's channel of the same id. Messages arrive
 * in order, each in its own task. Binary data is copied into the receiving participant's realm.
 *
 * Its own fields are named _lb*: the page keeps fields of its own on connections and channels.
 *
 * Usage (Node): const port = require('./ports/loopback.js').port(); createMeeting({ url, webrtc: port }).
 * port() returns a function (realm) -> constructors, as node.js accepts; port.hub is the hub (all ports share one).
 */
(function (root) {
  'use strict';
  const HUB = new Map();                 // token -> RTCPeerConnection
  let seq = 0;
  const later = (fn) => setTimeout(fn, 0);
  const rid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

  // ---- events: addEventListener + on<type> ---------------------------------------------------------------------
  class Emitter {
    constructor() { this._lbl = new Map(); }
    addEventListener(t, f) { if (typeof f !== 'function' && !(f && f.handleEvent)) return; if (!this._lbl.has(t)) this._lbl.set(t, new Set()); this._lbl.get(t).add(f); }
    removeEventListener(t, f) { const s = this._lbl.get(t); if (s) s.delete(f); }
    dispatchEvent(e) {
      if (!e.target) try { e.target = this; e.currentTarget = this; } catch (x) {}
      const h = this['on' + e.type];
      const run = (f) => { try { if (typeof f === 'function') f.call(this, e); else f.handleEvent(e); } catch (x) { setTimeout(() => { throw x; }, 0); } };
      if (typeof h === 'function') run(h);
      for (const f of Array.from(this._lbl.get(e.type) || [])) run(f);
      return true;
    }
    emit(type, extra) { return this.dispatchEvent(Object.assign({ type }, extra || {})); }
  }

  function makePort(realm) {
    const R = realm || { Uint8Array, ArrayBuffer, Map, Promise };
    const P = (v) => R.Promise.resolve(v);
    const fail = (name, msg) => { const e = new Error(msg); e.name = name; return R.Promise.reject(e); };
    const ownBytes = (d) => {
      if (d instanceof ArrayBuffer || (d && d.constructor && d.constructor.name === 'ArrayBuffer')) return new Uint8Array(d.slice(0));
      if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength));
      return null;
    };

    // ---- tracks and streams (kept, never carried) ---------------------------------------------------------------
    class MediaStreamTrack extends Emitter {
      constructor(kind) { super(); this.kind = kind; this.id = rid(); this.label = ''; this.enabled = true; this.muted = true; this.readyState = 'live'; this.contentHint = ''; }
      stop() { this.readyState = 'ended'; }
      clone() { return new MediaStreamTrack(this.kind); }
      getSettings() { return {}; } getConstraints() { return {}; } getCapabilities() { return {}; }
      applyConstraints() { return P(); }
    }
    class MediaStream extends Emitter {
      constructor(tracks) { super(); this.id = rid(); this._lbt = []; const src = tracks && tracks.getTracks ? tracks.getTracks() : (tracks || []); for (const t of src) this._lbt.push(t); }
      get active() { return this._lbt.some((t) => t.readyState === 'live'); }
      getTracks() { return this._lbt.slice(); }
      getAudioTracks() { return this._lbt.filter((t) => t.kind === 'audio'); }
      getVideoTracks() { return this._lbt.filter((t) => t.kind === 'video'); }
      getTrackById(id) { return this._lbt.find((t) => t.id === id) || null; }
      addTrack(t) { if (!this._lbt.includes(t)) this._lbt.push(t); }
      removeTrack(t) { this._lbt = this._lbt.filter((x) => x !== t); }
      clone() { return new MediaStream(this._lbt.map((t) => t.clone())); }
    }
    const stats = () => P(new R.Map());
    class RTCRtpSender {
      constructor(track, kind) { this.track = track || null; this.kind = kind; this.transport = null; this._lbp = { encodings: [{ active: true }], codecs: [], headerExtensions: [], rtcp: {} }; }
      replaceTrack(t) { this.track = t || null; return P(); }
      getParameters() { return JSON.parse(JSON.stringify(this._lbp)); }
      setParameters(p) { if (p) this._lbp = p; return P(); }
      setStreams() {}
      getStats() { return stats(); }
      static getCapabilities(kind) { return { codecs: kind === 'audio' ? [{ mimeType: 'audio/opus', clockRate: 48000, channels: 2 }] : [{ mimeType: 'video/VP8', clockRate: 90000 }], headerExtensions: [] }; }
    }
    class RTCRtpReceiver {
      constructor(kind) { this.track = new MediaStreamTrack(kind); this.transport = null; }
      getParameters() { return { codecs: [], headerExtensions: [] }; }
      getStats() { return stats(); }
      getContributingSources() { return []; } getSynchronizationSources() { return []; }
      static getCapabilities(kind) { return RTCRtpSender.getCapabilities(kind); }
    }
    class RTCRtpTransceiver {
      constructor(kind, track, init) {
        this.kind = kind; this.mid = null; this.sender = new RTCRtpSender(track, kind); this.receiver = new RTCRtpReceiver(kind);
        this.direction = (init && init.direction) || 'sendrecv'; this.currentDirection = null; this.stopped = false;
      }
      stop() { this.stopped = true; this.direction = 'stopped'; this.currentDirection = 'stopped'; }
      setCodecPreferences() {}
    }

    class RTCSessionDescription {
      constructor(init) { this.type = (init && init.type) || ''; this.sdp = (init && init.sdp) || ''; }
      toJSON() { return { type: this.type, sdp: this.sdp }; }
    }
    class RTCIceCandidate {
      constructor(init) {
        init = init || {};
        this.candidate = init.candidate || ''; this.sdpMid = init.sdpMid != null ? init.sdpMid : null;
        this.sdpMLineIndex = init.sdpMLineIndex != null ? init.sdpMLineIndex : null; this.usernameFragment = init.usernameFragment || null;
        const m = /^candidate:(\S+) (\d) (\S+) (\d+) (\S+) (\d+) typ (\S+)/.exec(this.candidate.replace(/^a=/, ''));
        this.foundation = m ? m[1] : ''; this.component = m ? 'rtp' : null; this.protocol = m ? m[3].toLowerCase() : null;
        this.priority = m ? +m[4] : null; this.address = m ? m[5] : null; this.port = m ? +m[6] : null; this.type = m ? m[7] : null;
      }
      toJSON() { return { candidate: this.candidate, sdpMid: this.sdpMid, sdpMLineIndex: this.sdpMLineIndex, usernameFragment: this.usernameFragment }; }
    }

    // ---- data channels --------------------------------------------------------------------------------------------
    class RTCDataChannel extends Emitter {
      constructor(pc, label, init) {
        super();
        init = init || {};
        this._lbpc = pc; this.label = String(label); this.ordered = init.ordered !== false; this.protocol = init.protocol || '';
        this.negotiated = !!init.negotiated; this.id = init.id != null ? init.id : null;
        this.maxRetransmits = init.maxRetransmits != null ? init.maxRetransmits : null; this.maxPacketLifeTime = init.maxPacketLifeTime != null ? init.maxPacketLifeTime : null;
        this.readyState = 'connecting'; this.bufferedAmount = 0; this.bufferedAmountLowThreshold = 0; this.binaryType = 'arraybuffer'; this._lbfar = null;
      }
      send(data) {
        if (this.readyState !== 'open') { const e = new Error("Failed to execute 'send' on 'RTCDataChannel': RTCDataChannel.readyState is not 'open'"); e.name = 'InvalidStateError'; throw e; }
        const far = this._lbfar;
        let payload = data;
        if (typeof data !== 'string') {
          const b = ownBytes(data);
          if (!b) { if (data && typeof data.arrayBuffer === 'function') { data.arrayBuffer().then((ab) => { if (this.readyState === 'open') this.send(ab); }); return; } payload = String(data); } else payload = b;
        }
        later(() => {
          if (!far || far.readyState !== 'open') return;
          let d = payload;
          if (typeof d !== 'string') d = new R.Uint8Array(d).buffer;
          far.emit('message', { data: d, origin: '', lastEventId: '', ports: [] });
        });
      }
      close() {
        if (this.readyState === 'closed' || this.readyState === 'closing') return;
        this.readyState = 'closing';
        const far = this._lbfar;
        later(() => { this.readyState = 'closed'; this.emit('close'); if (far && far.readyState !== 'closed') { far.readyState = 'closed'; far.emit('close'); } });
      }
      _lbopen() { if (this.readyState !== 'connecting') return; this.readyState = 'open'; this.emit('open'); }
    }

    // ---- SDP --------------------------------------------------------------------------------------------------------
    function sdpOf(pc, type) {
      const nl = '\r\n';
      const lines = ['v=0', 'o=- ' + pc._lbsess + ' ' + (++pc._lbver) + ' IN IP4 127.0.0.1', 's=-', 't=0 0'];
      const sections = [];
      pc._lbtx.forEach((t, i) => { if (t.mid == null) t.mid = String(i); sections.push({ kind: t.kind, mid: t.mid, t }); });
      if (pc._lbwantsData) sections.push({ kind: 'application', mid: pc._lbdataMid || (pc._lbdataMid = String(pc._lbtx.length)) });
      lines.push('a=group:BUNDLE ' + sections.map((s) => s.mid).join(' '), 'a=extmap-allow-mixed', 'a=msid-semantic: WMS *');
      const setup = type === 'offer' ? 'actpass' : 'active';
      sections.forEach((s, i) => {
        if (s.kind === 'application') lines.push('m=application 9 UDP/DTLS/SCTP webrtc-datachannel');
        else if (s.kind === 'audio') lines.push('m=audio 9 UDP/TLS/RTP/SAVPF 111');
        else lines.push('m=video 9 UDP/TLS/RTP/SAVPF 96');
        lines.push('c=IN IP4 0.0.0.0', 'a=ice-ufrag:' + pc._lbtoken, 'a=ice-pwd:' + pc._lbpwd, 'a=ice-options:trickle',
          'a=fingerprint:sha-256 ' + pc._lbfp, 'a=setup:' + setup, 'a=mid:' + s.mid);
        if (i === 0 && pc._lbgathered) lines.push('a=candidate:1 1 udp 2122260223 127.0.0.1 9 typ host generation 0 ufrag ' + pc._lbtoken);
        if (s.kind === 'application') lines.push('a=sctp-port:5000', 'a=max-message-size:262144');
        else {
          const dir = s.t.direction === 'stopped' ? 'inactive' : s.t.direction;
          lines.push('a=' + dir, 'a=rtcp-mux');
          if (s.kind === 'audio') lines.push('a=rtpmap:111 opus/48000/2', 'a=fmtp:111 minptime=10;useinbandfec=1');
          else lines.push('a=rtpmap:96 VP8/90000', 'a=rtcp-fb:96 nack', 'a=rtcp-fb:96 nack pli');
          if (s.t.sender.track) lines.push('a=msid:- ' + s.t.sender.track.id);
        }
      });
      return lines.join(nl) + nl;
    }
    const tokenOf = (sdp) => { const m = /a=ice-ufrag:(\S+)/.exec(String(sdp || '')); return m ? m[1] : null; };
    function adoptSections(pc, sdp) {   // the far end's m-lines become mine (transceivers for its media, the data line)
      const secs = String(sdp).split(/\r?\n(?=m=)/).slice(1);
      secs.forEach((sec) => {
        const kind = /^m=(\w+)/.exec(sec)[1];
        const mm = /a=mid:(\S+)/.exec(sec); const mid = mm ? mm[1] : null;
        if (kind === 'application') { pc._lbwantsData = true; pc._lbdataMid = mid; return; }
        if (!pc._lbtx.some((t) => t.mid === mid)) {
          const free = pc._lbtx.find((t) => t.mid == null && t.kind === kind);
          if (free) free.mid = mid; else { const t = new RTCRtpTransceiver(kind, null, { direction: 'recvonly' }); t.mid = mid; pc._lbtx.push(t); }
        }
      });
    }

    // ---- the connection -----------------------------------------------------------------------------------------
    class RTCPeerConnection extends Emitter {
      constructor(config) {
        super();
        this._lbcfg = config || {}; this._lbtoken = 'lb' + (++seq) + rid().slice(0, 10); this._lbpwd = rid() + rid();
        this._lbfp = Array.from({ length: 32 }, () => ('0' + Math.floor(Math.random() * 256).toString(16)).slice(-2).toUpperCase()).join(':');
        this._lbsess = String(Date.now()) + String(seq); this._lbver = 1; this._lbtx = []; this._lbdcs = []; this._lbwantsData = false; this._lbgathered = false;
        this._lbfar = null; this._lbfarToken = null; this._lbnextId = 0; this._lbnegPending = false;
        this.signalingState = 'stable'; this.iceConnectionState = 'new'; this.connectionState = 'new'; this.iceGatheringState = 'new';
        this.localDescription = null; this.remoteDescription = null; this.currentLocalDescription = null; this.currentRemoteDescription = null;
        this.pendingLocalDescription = null; this.pendingRemoteDescription = null; this.canTrickleIceCandidates = true; this.sctp = null;
        this._lblastOffer = null; this._lblastAnswer = null;
        HUB.set(this._lbtoken, this);
      }
      getConfiguration() { return this._lbcfg; }
      setConfiguration(c) { this._lbcfg = c || {}; }
      _lbnegotiate() {
        if (this._lbnegPending || this.signalingState === 'closed') return;
        this._lbnegPending = true;
        later(() => { this._lbnegPending = false; if (this.signalingState === 'stable') this.emit('negotiationneeded'); });
      }
      _lbset(k, v, ev) { if (this[k] === v) return; this[k] = v; this.emit(ev); }
      createOffer() { if (this.signalingState === 'closed') return fail('InvalidStateError', 'closed'); return P(new RTCSessionDescription({ type: 'offer', sdp: sdpOf(this, 'offer') })); }
      createAnswer() {
        if (this.signalingState !== 'have-remote-offer' && this.signalingState !== 'have-local-pranswer') return fail('InvalidStateError', 'createAnswer in state ' + this.signalingState);
        return P(new RTCSessionDescription({ type: 'answer', sdp: sdpOf(this, 'answer') }));
      }
      setLocalDescription(d) {
        if (this.signalingState === 'closed') return fail('InvalidStateError', 'closed');
        if (!d || !d.type) d = { type: (this.signalingState === 'have-remote-offer' || this.signalingState === 'have-local-pranswer') ? 'answer' : 'offer' };
        if (d.type === 'rollback') { this.pendingLocalDescription = null; this.localDescription = this.currentLocalDescription; this._lbset('signalingState', 'stable', 'signalingstatechange'); return P(); }
        const sdp = d.sdp || sdpOf(this, d.type);
        const desc = new RTCSessionDescription({ type: d.type, sdp });
        if (d.type === 'offer') {
          if (this.signalingState !== 'stable' && this.signalingState !== 'have-local-offer') return fail('InvalidStateError', 'offer in state ' + this.signalingState);
          this.pendingLocalDescription = desc; this.localDescription = desc;
          this._lbset('signalingState', 'have-local-offer', 'signalingstatechange');
        } else {
          if (this.signalingState !== 'have-remote-offer' && this.signalingState !== 'have-local-pranswer') return fail('InvalidStateError', 'answer in state ' + this.signalingState);
          this.currentLocalDescription = desc; this.localDescription = desc; this.pendingLocalDescription = null;
          this.currentRemoteDescription = this.pendingRemoteDescription || this.remoteDescription; this.pendingRemoteDescription = null;
          this._lbset('signalingState', 'stable', 'signalingstatechange');
          this._lbtryConnect();
        }
        this._lbgather();
        return P();
      }
      setRemoteDescription(d) {
        if (this.signalingState === 'closed') return fail('InvalidStateError', 'closed');
        if (!d || !d.type) return fail('TypeError', 'no description');
        if (d.type === 'rollback') { this.pendingRemoteDescription = null; this.remoteDescription = this.currentRemoteDescription; this._lbset('signalingState', 'stable', 'signalingstatechange'); return P(); }
        const tok = tokenOf(d.sdp);
        if (!tok) return fail('OperationError', 'Failed to set remote description: no ice-ufrag');
        const desc = new RTCSessionDescription({ type: d.type, sdp: d.sdp });
        if (this._lbfarToken && this._lbfarToken !== tok && this._lbfar) this._lbdrop();   // another end: a new transport
        this._lbfarToken = tok;
        adoptSections(this, d.sdp);
        if (d.type === 'offer') {
          if (this.signalingState !== 'stable' && this.signalingState !== 'have-remote-offer') return fail('InvalidStateError', 'Failed to set remote offer in state ' + this.signalingState);
          this.pendingRemoteDescription = desc; this.remoteDescription = desc;
          this._lbset('signalingState', 'have-remote-offer', 'signalingstatechange');
        } else {
          if (this.signalingState !== 'have-local-offer' && this.signalingState !== 'have-remote-pranswer') return fail('InvalidStateError', 'Failed to set remote answer in state ' + this.signalingState);
          this.currentRemoteDescription = desc; this.remoteDescription = desc; this.pendingRemoteDescription = null;
          this.currentLocalDescription = this.pendingLocalDescription || this.localDescription; this.pendingLocalDescription = null;
          this._lbset('signalingState', 'stable', 'signalingstatechange');
          this._lbtryConnect();
        }
        return P();
      }
      addIceCandidate(c) {
        if (this.signalingState === 'closed') return fail('InvalidStateError', 'closed');
        if (c && c.candidate && !this.remoteDescription) return fail('InvalidStateError', 'Failed to add ICE candidate: no remote description');
        return P();
      }
      _lbgather() {
        if (this._lbgathered) return;
        this._lbgathered = true;
        later(() => {
          if (this.signalingState === 'closed') return;
          this._lbset('iceGatheringState', 'gathering', 'icegatheringstatechange');
          const cand = new RTCIceCandidate({ candidate: 'candidate:1 1 udp 2122260223 127.0.0.1 9 typ host generation 0 ufrag ' + this._lbtoken, sdpMid: '0', sdpMLineIndex: 0, usernameFragment: this._lbtoken });
          this.emit('icecandidate', { candidate: cand });
          this._lbset('iceGatheringState', 'complete', 'icegatheringstatechange');
          this.emit('icecandidate', { candidate: null });
        });
      }
      // Both ends hold both descriptions: connect, once.
      _lbtryConnect() {
        if (this._lbfar || !this._lbfarToken) return;
        const far = HUB.get(this._lbfarToken);
        if (!far || far === this || far._lbfarToken !== this._lbtoken || far.signalingState === 'closed') return;
        if (!far.currentRemoteDescription || !this.currentRemoteDescription) return;
        this._lbfar = far; far._lbfar = this;
        for (const pc of [this, far]) later(() => {
          if (pc.signalingState === 'closed') return;
          pc._lbset('iceConnectionState', 'checking', 'iceconnectionstatechange');
          pc._lbset('connectionState', 'connecting', 'connectionstatechange');
          later(() => {
            if (pc.signalingState === 'closed' || !pc._lbfar) return;
            pc.sctp = { maxMessageSize: 262144, maxChannels: 65535, state: 'connected', transport: { state: 'connected', iceTransport: { state: 'connected', getSelectedCandidatePair: () => null } } };
            pc._lbset('iceConnectionState', 'connected', 'iceconnectionstatechange');
            pc._lbset('connectionState', 'connected', 'connectionstatechange');
            pc._lbpairChannels();
            if (pc._lbfar) pc._lbfar._lbpairChannels();   // whichever end is connected second pairs both ends' channels
          });
        });
      }
      _lbpairChannels() {
        const far = this._lbfar;
        if (!far || this.connectionState !== 'connected' || far.connectionState !== 'connected') return;
        for (const ch of this._lbdcs) {
          if (ch._lbfar || ch.readyState !== 'connecting') continue;
          if (ch.negotiated) {
            const twin = far._lbdcs.find((x) => x.negotiated && x.id === ch.id && !x._lbfar);
            if (!twin) continue;
            ch._lbfar = twin; twin._lbfar = ch; ch._lbopen(); twin._lbopen();
          } else {
            const twin = new RTCDataChannel(far, ch.label, { ordered: ch.ordered, protocol: ch.protocol, id: ch.id, maxRetransmits: ch.maxRetransmits, maxPacketLifeTime: ch.maxPacketLifeTime });
            far._lbdcs.push(twin);
            ch._lbfar = twin; twin._lbfar = ch;
            twin.readyState = 'open';
            far.emit('datachannel', { channel: twin });
            ch._lbopen(); twin.emit('open');
          }
        }
      }
      createDataChannel(label, init) {
        if (this.signalingState === 'closed') { const e = new Error('closed'); e.name = 'InvalidStateError'; throw e; }
        const ch = new RTCDataChannel(this, label, init);
        if (ch.id == null) { ch.id = this._lbnextId; this._lbnextId += 2; }
        this._lbdcs.push(ch);
        if (!this._lbwantsData) { this._lbwantsData = true; this._lbnegotiate(); }
        later(() => this._lbpairChannels());
        return ch;
      }
      addTransceiver(trackOrKind, init) {
        const track = typeof trackOrKind === 'string' ? null : trackOrKind;
        const t = new RTCRtpTransceiver(track ? track.kind : trackOrKind, track, init);
        this._lbtx.push(t); this._lbnegotiate();
        return t;
      }
      addTrack(track) {
        const free = this._lbtx.find((t) => t.kind === track.kind && !t.sender.track && !t.stopped);
        if (free) { free.sender.track = track; if (free.direction === 'recvonly') free.direction = 'sendrecv'; this._lbnegotiate(); return free.sender; }
        return this.addTransceiver(track, { direction: 'sendrecv' }).sender;
      }
      removeTrack(sender) { if (sender) sender.track = null; this._lbnegotiate(); }
      getTransceivers() { return this._lbtx.slice(); }
      getSenders() { return this._lbtx.map((t) => t.sender); }
      getReceivers() { return this._lbtx.map((t) => t.receiver); }
      getStats() { return stats(); }
      restartIce() { this._lbnegotiate(); }
      _lbdrop() {   // the far end went away: its channels close, the transport fails
        const far = this._lbfar; this._lbfar = null;
        if (far && far._lbfar === this) far._lbfar = null;
        for (const ch of this._lbdcs) if (ch.readyState !== 'closed') { ch.readyState = 'closed'; ch.emit('close'); }
        this._lbdcs = this._lbdcs.filter((c) => c.readyState !== 'closed');
        if (this.signalingState === 'closed') return;
        this._lbset('iceConnectionState', 'disconnected', 'iceconnectionstatechange');
        this._lbset('connectionState', 'disconnected', 'connectionstatechange');
        later(() => {
          if (this.signalingState === 'closed' || this._lbfar) return;
          this._lbset('iceConnectionState', 'failed', 'iceconnectionstatechange');
          this._lbset('connectionState', 'failed', 'connectionstatechange');
        });
      }
      close() {
        if (this.signalingState === 'closed') return;
        const far = this._lbfar;
        this.signalingState = 'closed'; this.iceConnectionState = 'closed'; this.connectionState = 'closed';
        for (const ch of this._lbdcs) if (ch.readyState !== 'closed') ch.readyState = 'closed';
        this._lbfar = null;
        HUB.delete(this._lbtoken);
        if (far && far._lbfar === this) later(() => far._lbdrop());
      }
      static generateCertificate() { return P({ expires: Date.now() + 864e5, getFingerprints: () => [] }); }
    }

    return { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, RTCDataChannel, RTCRtpSender, RTCRtpReceiver, RTCRtpTransceiver, MediaStream, MediaStreamTrack };
  }

  function port() { const f = (realm) => makePort(realm); f.hub = HUB; return f; }
  const api = { port, makePort, hub: HUB };
  const GifOS = root.GifOS = root.GifOS || {};
  (GifOS.ports = GifOS.ports || {}).loopback = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
