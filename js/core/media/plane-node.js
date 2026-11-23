/*
 * GifOS Core: the media plane for a host with no browser (Node). Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * The browser plane (media/plane-browser.js) carries out the core's media plan on a browser's primitives; this file
 * carries out the SAME plan on the Node media port: werift tracks and senders (the transport) and ports/webaudio.js
 * (a W3C-shaped AudioContext over Opus, which the host puts on the participant's global). The laws stay in the core
 * (outboundPlan, mainVideoChoice): this plane only reconciles the senders the plan names and reports what it did, as
 * plain data (planReported), exactly as the browser plane does. docs/media-plane.md "The media plan".
 *
 * WHAT IT CARRIES (plan v1): the main senders per link (cam/mic slots, parks, the viewer park, hold), my voice (the
 * agent's voice track, botVoiceTrack, made by meet-agent through the port's AudioContext; else a microphone track
 * the host gave me), and my camera when the host gave me one and no blur applies. Received tracks reach the core
 * through the pc's ontrack as on a page (claims, meters through the port's AudioContext, the agent's audio.in).
 * WHAT IT CANNOT MAKE YET: a picture of its own (avatar, blur, screen, rebroadcast) needs a video encoder: those
 * sources report no-track (never the raw camera in place of a blur). The mosaic, Stage and row-mix duties are plan
 * slots still to be cut from the browser plane; until then those acts do nothing here.
 *
 * Install: the host links the core with no media part, hands the declared nones, then calls
 * GifOS.planeNode.install(meeting.media, meeting.core) before meeting.run(). Each name below replaces its stand-in.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};

  function install(M, C) {
    const def = (name, value) => Object.defineProperty(M, name, { value, writable: true, configurable: true, enumerable: true });
    const live = (t) => !!t && t.readyState !== 'ended' && !t.stopped;

    // THE VOICE MY MAIN AUDIO SENDERS CARRY: the agent's voice while it speaks, else my microphone (if the host gave one).
    function mainAudioTrack() {
      const b = M.botVoiceTrack;
      if (live(b)) return b;
      const c = M.carryVoiceTrack;
      if (live(c)) return c;
      const ls = C.localStream;
      return (ls && ls.getAudioTracks()[0]) || null;
    }
    // MY MAIN PICTURE, as the core chose it (mainVideoChoice). Only a camera track the host gave me, unblurred, can be
    // sent as is; any made picture (avatar, blur, screen, rebroadcast) needs an encoder this plane does not have yet.
    function sentVideoTrack() {
      const c = C.mainVideoChoice();
      if (c.src !== 'own-cam' || c.blur > 0 || c.rowShare) return null;
      const ls = C.localStream, t = ls && ls.getVideoTracks()[0];
      return live(t) ? t : null;
    }
    function stageVideoTrack() {
      const c = C.stageVideoChoice();
      return c && c.src === 'main' ? sentVideoTrack() : null;
    }
    function mainGone(pc, sd) {
      try {
        const tx = pc.getTransceivers().find((t) => t.sender === sd);
        return !tx || tx.stopped === true || tx.currentDirection === 'stopped' || tx.direction === 'stopped';
      } catch (e) { return false; }
    }
    function kick(p) {
      if (p.dc && p.dc.readyState === 'open') { C.dcSend(p, { k: 'rkick' }); if (C.hasPendingTx(p)) C.renegotiate(p); }
      else C.renegotiate(p);
    }
    // THE PLANE'S SIDE OF THE MEDIA PLAN: the same reconcile as the browser plane's refreshOutbound, on werift senders.
    function refreshOutbound() {
      if (C.outgoingHeld) return;
      const plan = C.outboundPlan();
      if (plan.hold) return;
      if (plan.park === 'viewer') {
        for (const p of C.peers.values()) {
          if (p.mainV && p.mainV.track) p.mainV.replaceTrack(null).catch(() => {});
          if (p.mainA && p.mainA.track) p.mainA.replaceTrack(null).catch(() => {});
        }
        return;
      }
      const vt = M.sentVideoTrack(), at = M.mainAudioTrack();   // through the published names (a test may stand a builder in)
      const want = new Map(plan.links);
      const report = [];
      for (const p of C.peers.values()) {
        const slots = want.get(String(p.id));
        if (!slots) continue;
        const cam = slots.cam.source !== 'none', mic = slots.mic.source !== 'none';
        if (p.pc && p.mainV && mainGone(p.pc, p.mainV)) { C.clog('main-gone ' + String(p.id).slice(0, 6) + ' video: re-add'); p.mainV = null; }
        if (p.pc && p.mainA && mainGone(p.pc, p.mainA)) { C.clog('main-gone ' + String(p.id).slice(0, 6) + ' audio: re-add'); p.mainA = null; }
        if (cam && C.localStream && p.pc && !p.headless && (!p.mainV || (!p.mainA && mic))) {
          let added = false;
          try {
            if (!p.mainA && at && mic) { p.mainA = C.addMainTrack(p.pc, at, C.localStream); added = true; }
            if (!p.mainV && vt) { p.mainV = C.addMainTrack(p.pc, vt, C.localStream); added = true; }
          } catch (e) {}
          if (added) kick(p);
        }
        const r = { cam: 'absent', mic: 'absent' };
        if (p.mainV) {
          if (!cam || !vt || slots.cam.park) { r.cam = 'park'; if (p.mainV.track) p.mainV.replaceTrack(null).catch(() => {}); }
          else { r.cam = 'seat'; if (p.mainV.track !== vt) p.mainV.replaceTrack(vt).catch(() => {}); }
        }
        if (p.mainA) {
          if (!mic || slots.mic.park) { r.mic = 'park'; if (p.mainA.track) p.mainA.replaceTrack(null).catch(() => {}); }
          else if (at) { r.mic = 'seat'; if (p.mainA.track !== at) p.mainA.replaceTrack(at).catch(() => {}); }
          else r.mic = 'no-track';
        }
        report.push([String(p.id), r]);
      }
      C.planReported({ links: report });
    }
    // A late track (a voice that starts, a camera the host hands over): seat it on every camera link, as the browser does.
    function attachLocalTracks() {
      if (!C.localStream || (C.BROADCAST && !C.bcMayPublishAv())) return;
      for (const [pid, p] of C.peers) {
        if (!p.pc || !C.camPeer(pid) || p.headless) continue;
        let added = false;
        for (const tr of C.localStream.getTracks()) {
          if (tr.kind === 'video' ? p.mainV : (p.mainA || !C.micPeer(pid))) continue;
          const t = tr.kind === 'audio' ? (M.mainAudioTrack() || tr) : M.sentVideoTrack();
          if (!t) continue;
          try { const x = p.pc.addTransceiver(t, { streams: [C.localStream] }); if (tr.kind === 'video') p.mainV = x.sender; else p.mainA = x.sender; added = true; } catch (e) {}
        }
        if (added) kick(p);
      }
    }
    // A RECEIVED STREAM: a copy that comes back lands in the stream it left, so its old, ended track goes first.
    function dropEndedRemoteTracks(stream, track) {
      if (!stream || !track) return;
      for (const t of stream.getTracks()) if (t !== track && t.kind === track.kind && !live(t)) { try { stream.removeTrack(t); } catch (e) {} }
    }
    function peerAudioTracks(p) {
      const out = [];
      for (const s of [p && p.stream].concat((p && p.incoming) || [])) for (const t of (s && s.getAudioTracks ? s.getAudioTracks() : [])) if (out.indexOf(t) < 0) out.push(t);
      return out;
    }

    def('mainAudioTrack', mainAudioTrack);
    def('sentVideoTrack', sentVideoTrack);
    def('stageVideoTrack', stageVideoTrack);
    def('mainGone', mainGone);
    def('refreshOutbound', refreshOutbound);
    def('attachLocalTracks', attachLocalTracks);
    def('dropEndedRemoteTracks', dropEndedRemoteTracks);
    def('peerAudioTracks', peerAudioTracks);
    def('retireMixTracks', () => {});   // no fold mixes here yet (mix-minus is a later plan slot)
    def('adapt', () => {});             // no encoder of my own to tune: forwarded and Opus tracks keep their own rate
    def('tileHolds', () => false);      // no tiles: no screen holds a stream
    return { names: ['mainAudioTrack', 'sentVideoTrack', 'stageVideoTrack', 'mainGone', 'refreshOutbound', 'attachLocalTracks', 'dropEndedRemoteTracks', 'peerAudioTracks', 'retireMixTracks', 'adapt', 'tileHolds'] };
  }

  GifOS.planeNode = { install };
})(typeof window !== 'undefined' ? window : globalThis);
