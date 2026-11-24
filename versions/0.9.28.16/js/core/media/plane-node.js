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
 * sources report no-track (never the raw camera in place of a blur). The mosaic, Stage and row-mix duties (the plan's
 * duty slots sdm / sub / sgs) are not carried here yet: the reconcile reports each owed one 'no-track', this seat's own
 * word that it does not carry it.
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
    function kick(p) {
      if (p.dc && p.dc.readyState === 'open') { C.dcSend(p, { k: 'rkick' }); if (C.hasPendingTx(p)) C.renegotiate(p); }
      else C.renegotiate(p);
    }
    // MY DUTY SENDERS (the plan's sdm / sub / sgs slots): this plane forwards none yet, so no duty slot carries a track.
    function dutyTrack(pid, slot) { return null; }
    // DEBUG LEVER (owed-duty evidence): while on, my duties are stubbed: forwarding, when this plane has it, sends nothing
    // on a duty slot. Today nothing is forwarded, so only the flag changes; the report stays 'no-track' either way.
    function stubDuties(on) { stubDuties.on = !!on; refreshOutbound(); return stubDuties.on; }
    // THE PLANE'S SIDE OF THE MEDIA PLAN: the core's one reconcile (reconcileMain, as the browser plane), on werift senders.
    function refreshOutbound() {
      const plan = C.outboundPlan();   // a held plan or a viewer's park is the reconcile's too
      C.reconcileMain(plan, M.sentVideoTrack(), M.mainAudioTrack(), kick, dutyTrack);   // through the published names (a test may stand a builder in)
    }
    // A late track (a voice that starts, a camera the host hands over): the plan's reconcile opens the missing main senders.
    function attachLocalTracks() { refreshOutbound(); }
    // A RECEIVED STREAM: a copy that comes back lands in the stream it left, so its old, ended track goes first.
    function dropEndedRemoteTracks(stream, track) {
      if (!stream || !track) return;
      for (const t of stream.getTracks()) if (t !== track && t.kind === track.kind && !live(t)) { try { stream.removeTrack(t); } catch (e) {} }
    }
    // THE OWED SLOTS, MEASURED (L29.5), as the browser plane does: per owed inbound duty slot of the core's inboundPlan,
    // arriving when the RTP packets the port counted on its stream's tracks (werift onReceiveRtp) moved since my last
    // sample. Arrival, never level; nothing announced or delivered reads not arriving.
    const rtpN = new WeakMap(), owedPk = new Map();
    function rtpCount(t) {
      if (!t) return 0;
      let c = rtpN.get(t);
      if (!c) { c = { n: 0 }; rtpN.set(t, c); try { if (t.onReceiveRtp && typeof t.onReceiveRtp.subscribe === 'function') t.onReceiveRtp.subscribe(() => { c.n++; }); } catch (e) {} }
      return c.n;
    }
    function owedMeasure() {
      if (typeof C.inboundPlan !== 'function' || typeof C.planMeasured !== 'function') return;
      const out = [], seen = new Set();
      for (const [pid, slot] of C.inboundPlan()) {
        const k = pid + '|' + slot, st = C.owedStream(pid, slot); seen.add(k);
        let n = -1; if (st) { n = 0; for (const t of st.getTracks()) n += rtpCount(t); }
        const was = owedPk.get(k), sid = st ? st.id : null; owedPk.set(k, { sid, n });
        out.push([pid, slot, n > 0 && !!was && was.sid === sid && n > was.n]);
      }
      for (const k of Array.from(owedPk.keys())) if (!seen.has(k)) owedPk.delete(k);
      C.planMeasured('owed', out);
    }
    const owedT = setInterval(() => { try { owedMeasure(); } catch (e) {} }, GifOS.timings.OWED_SAMPLE_MS);
    if (owedT && typeof owedT.unref === 'function') owedT.unref();   // a measurement never keeps the host alive
    function peerAudioTracks(p) {
      const out = [];
      for (const s of [p && p.stream].concat((p && p.incoming) || [])) for (const t of (s && s.getAudioTracks ? s.getAudioTracks() : [])) if (out.indexOf(t) < 0) out.push(t);
      return out;
    }

    def('mainAudioTrack', mainAudioTrack);
    def('sentVideoTrack', sentVideoTrack);
    def('stageVideoTrack', stageVideoTrack);
    def('refreshOutbound', refreshOutbound);
    def('attachLocalTracks', attachLocalTracks);
    def('dropEndedRemoteTracks', dropEndedRemoteTracks);
    def('peerAudioTracks', peerAudioTracks);
    def('retireMixTracks', () => {});   // no fold mixes here yet (mix-minus is a later plan slot)
    def('adapt', () => {});             // no encoder of my own to tune: forwarded and Opus tracks keep their own rate
    def('tileHolds', () => false);      // no tiles: no screen holds a stream
    def('stubDuties', stubDuties);
    return { names: ['mainAudioTrack', 'sentVideoTrack', 'stageVideoTrack', 'refreshOutbound', 'attachLocalTracks', 'dropEndedRemoteTracks', 'peerAudioTracks', 'retireMixTracks', 'adapt', 'tileHolds', 'stubDuties'] };
  }

  GifOS.planeNode = { install };
})(typeof window !== 'undefined' ? window : globalThis);
