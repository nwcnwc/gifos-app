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
 * sources report no-track (never the raw camera in place of a blur). A stager's own stage feed ships voice only.
 * Duty slots (sdm / sub / sgs) are read off the jobs this plane actually holds. This plane folds a mix row's audio on
 * the port's AudioContext and ships that fold with a claimed picture when the row has one. It still composites no
 * strip and no picture pack: a row whose picture is {pack} ships only when packFor already returned a live track,
 * and then the fold rides with it. With no pack track the row ships nothing, so an owed duty stays 'no-track'.
 *
 * Install: the host links the core with no media part, hands the declared nones, then calls
 * GifOS.planeNode.install(meeting.media, meeting.core) before meeting.run(). Each name below replaces its stand-in.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};

  function install(M, C) {
    const def = (name, value) => Object.defineProperty(M, name, { value, writable: true, configurable: true, enumerable: true });
    // The browser plane assigns these from GifOS.timings. A null none makes a core `>` true on the next pass.
    M.MOS_GRACE = GifOS.timings.MOS_GRACE;
    M.MOS_SETTLE = GifOS.timings.MOS_SETTLE;
    M.STG_PIC_LIVE_MS = GifOS.timings.STG_PIC_LIVE_MS;
    M.STG_ZERO_MS = GifOS.timings.STG_ZERO_MS;
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
    // THE DUTY SENDERS, READ FOR THE PLAN'S REPORT: the track my job for that duty slot ('sdm' | 'sub' | 'sgs') to that peer
    // carries now, or null (no job, a parked job, a sender with no live track).
    function dutyTrack(pid, slot) {
      const job = C.mosJobs && C.mosJobs.get(slot + '>' + pid);
      if (!job || !job.active) return null;
      for (const sd of job.senders || []) { const t = sd && sd.track; if (t && t.readyState !== 'ended') return t; }
      return null;
    }
    function dutyJob(jk) {
      const k = String(jk).slice(0, String(jk).indexOf('>'));
      return k === 'sdm' || k === 'sub' || k === 'sgs';
    }
    // DEBUG LEVER (owed-duty evidence): while on, every duty job is parked and its wakes are refused. A stage copy is
    // not a duty, so a stubbed seat still forwards the stage feed.
    function dutyMuteTick() {
      if (!stubDuties.on || !C.mosJobs) return;
      stubDuties.parked = stubDuties.parked || [];
      for (const [jk, job] of C.mosJobs) if (job.active && dutyJob(jk)) {
        if (stubDuties.parked.indexOf(jk) < 0) stubDuties.parked.push(jk);
        C.setJobActive(jk, false);
      }
    }
    function stubDuties(on) {
      if (!C.DEBUG_ON) return false;
      stubDuties.on = !!on;
      if (stubDuties.on) dutyMuteTick();
      else { const was = stubDuties.parked || []; stubDuties.parked = []; for (const jk of was) C.setJobActive(jk, true); }
      try { refreshOutbound(); } catch (e) {}
      return stubDuties.on;
    }
    function dutyTick() {
      dutyMuteTick();
      let sig = '';
      if (C.mosJobs) for (const [jk, job] of C.mosJobs) if (dutyJob(jk)) sig += jk + (dutyTrack(job.to, job.key) ? '+' : '-') + ',';
      if (sig !== dutyTick.sig) { dutyTick.sig = sig; refreshOutbound(); }
    }
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
    // {video, audio} each true when the RTP packets the port counted on that kind (werift onReceiveRtp) moved since my
    // last sample. Arrival, never level; nothing announced or delivered reads not arriving.
    const rtpN = new WeakMap(), owedPk = new Map();
    function rtpCount(t) {
      if (!t) return 0;
      let c = rtpN.get(t);
      if (!c) { c = { n: 0 }; rtpN.set(t, c); try { if (t.onReceiveRtp && typeof t.onReceiveRtp.subscribe === 'function') t.onReceiveRtp.subscribe(() => { c.n++; }); } catch (e) {} }
      return c.n;
    }
    // Packets on a job's source track. The receiver's own count is the track's; this is the sender's.
    function countOnto(job, tr) {
      if (!job || !tr) return;
      if (!job.rtpN) job.rtpN = { n: 0 };
      const seen = countOnto.seen || (countOnto.seen = new WeakMap());
      let set = seen.get(job);
      if (!set) { set = new Set(); seen.set(job, set); }
      if (set.has(tr)) return;
      set.add(tr);
      try { if (tr.onReceiveRtp && typeof tr.onReceiveRtp.subscribe === 'function') tr.onReceiveRtp.subscribe(() => { job.rtpN.n++; }); } catch (e) {}
    }
    function owedMeasure() {
      if (typeof C.inboundPlan !== 'function' || typeof C.planMeasured !== 'function') return;
      const out = [], seen = new Set();
      for (const [pid, slot] of C.inboundPlan()) {
        const k = pid + '|' + slot, st = C.owedStream(pid, slot); seen.add(k);
        const n = { video: -1, audio: -1 };   // per kind (L29.5): the core keeps a tick for each
        if (st) for (const t of st.getTracks()) if (t && t.kind in n) { if (n[t.kind] < 0) n[t.kind] = 0; n[t.kind] += rtpCount(t); }
        const was = owedPk.get(k), sid = st ? st.id : null; owedPk.set(k, { sid, n });
        const moved = (kd) => n[kd] > 0 && !!was && was.sid === sid && n[kd] > was.n[kd];
        out.push([pid, slot, { video: moved('video'), audio: moved('audio') }]);
      }
      for (const k of Array.from(owedPk.keys())) if (!seen.has(k)) owedPk.delete(k);
      C.planMeasured('owed', out);
    }
    // The claim watchdog's map. The host's none is an empty Map; this replaces it so the core and this plane share one.
    const mosFb = new Map();
    def('mosFb', mosFb);
    // The row verdict and the dark rail sample on this same clock. A second timer would be a new bare wait, and a
    // test that stretches OWED_SAMPLE_MS (so this measurement never runs) must not grow a faster loop beside it.
    const owedT = setInterval(() => {
      try { owedMeasure(); } catch (e) {}
      try { rowAndWatch(); } catch (e) {}
    }, GifOS.timings.OWED_SAMPLE_MS);
    if (owedT && typeof owedT.unref === 'function') owedT.unref();   // a measurement never keeps the host alive
    function peerAudioTracks(p) {
      const out = [];
      for (const s of [p && p.stream].concat((p && p.incoming) || [])) for (const t of (s && s.getAudioTracks ? s.getAudioTracks() : [])) if (out.indexOf(t) < 0) out.push(t);
      return out;
    }
    // No picture consumer on this plane yet: a claim's element stays empty.
    function bindClaim(rk, claim) { if (claim) claim.el = null; }
    function unbindClaim(rk, claim) { if (claim) claim.el = null; }
    function adoptClaim(rk, neu, old) { if (neu) neu.el = null; }
    function picRead(claim) { return { w: 0, frames: 0 }; }
    // An edge of my row's acting head (the core's rowActing, which also keeps the fail-back hold). The browser sets the
    // dark rail on the head's copy whenever the edge is not the way back, then re-sweeps. No tiles.
    function rowEdge(why) {
      if (why !== 'back') { const fb = mosFb.get('sdm'); if (fb) fb.dark = true; }
      schedReconcile();
    }
    // PLI upstream. True only when this claim's video receiver is allowed to send one; a refusal lets kfNeed fall through.
    function keyUp(claim, key) {
      void key;
      if (!claim || !claim.stream || typeof claim.stream.getVideoTracks !== 'function' || !claim.via) return false;
      const tr = claim.stream.getVideoTracks().filter((t) => t && t.readyState !== 'ended')[0];
      if (!tr) return false;
      const peer = C.peers && C.peers.get(claim.via);
      const pc = peer && peer.pc;
      if (!pc || typeof pc.getTransceivers !== 'function') return false;
      let rx = null;
      for (const tx of pc.getTransceivers()) if (tx && tx.receiver && tx.receiver.track === tr) { rx = tx.receiver; break; }
      if (!rx || typeof rx.pliNegotiation !== 'function' || typeof rx.sendRtcpPLI !== 'function') return false;
      let neg = null;
      try { neg = rx.pliNegotiation(tr.ssrc); } catch (e) { return false; }
      if (!neg || !neg.allowed) return false;
      try { const pr = rx.sendRtcpPLI(tr.ssrc); if (pr && typeof pr.catch === 'function') pr.catch(() => {}); } catch (e) { return false; }
      return true;
    }
    function producerKey(key, fromPid) { void key; void fromPid; }
    // One MediaStream for this seat's own stage feed. Tracks are replaced on it; a new object would change every container.
    let ownStageSt = null;
    // The browser's self picture. Node has no picture encoder, so this is the same voice stream the own-stage
    // entries ship. carryIn marks its id (emit false) so a later claim of that id is not a second entry.
    function mySelfStream() { return ownStageStream(); }
    function ownStageStream() {
      const want = [mainAudioTrack(), sentVideoTrack()].filter(live);
      if (!want.length) return null;
      if (!ownStageSt) ownStageSt = new MediaStream();
      syncTracks(ownStageSt, want);
      return ownStageSt.getTracks().length ? ownStageSt : null;
    }
    function syncTracks(st, want) {
      for (const t of st.getTracks()) if (want.indexOf(t) < 0) { try { st.removeTrack(t); } catch (e) {} }
      const have = st.getTracks();
      for (const t of want) if (have.indexOf(t) < 0) { try { st.addTrack(t); } catch (e) {} }
    }
    // shipTracks' pick, for one kind: unmuted first, the newest among equals.
    function shipKind(stream, kind) {
      if (!stream || typeof stream.getTracks !== 'function') return null;
      const c = stream.getTracks().filter((t) => t && t.kind === kind && t.readyState !== 'ended');
      if (!c.length) return null;
      const hot = c.filter((t) => !t.muted);
      const pick = hot.length ? hot : c;
      return pick[pick.length - 1];
    }
    function claimStream(side) {
      if (!side || side.own) return null;
      const box = side.sb ? C.mosStandby : C.mosIn;
      const ent = box && typeof box.get === 'function' ? box.get(side.in) : null;
      return ent && ent.stream;
    }
    // One source stream per job. A new id every sweep would reconcile the ship forever.
    // Ended track objects name a route but are not added: an empty memo keeps an established trackless job wanted.
    const fwdStreams = new Map();
    function trackObject(side, kind) {
      if (!side || side.own === 'stage') return false;
      const st = claimStream(side);
      if (!st) return false;
      try {
        const fn = kind === 'video' ? st.getVideoTracks : st.getAudioTracks;
        if (typeof fn === 'function') {
          const ts = fn.call(st);
          return !!(ts && ts[0]);
        }
        if (typeof st.getTracks === 'function') {
          for (const t of st.getTracks()) if (t && t.kind === kind) return true;
        }
      } catch (e) {}
      return false;
    }
    function streamFor(e) {
      if (!e) return null;
      if (e.own === 'stage') return ownStageStream();
      const want = [];
      try {
        // A picture pack this plane did not make: the fold must not leave without it, and the pack must not leave
        // without the fold. packFor null (this plane, until a later step) answers neither, so the row ships nothing.
        if (e.video && e.video.pack) {
          const v = packVideo(e.video);
          let a = null;
          if (e.audio && e.audio.mix) a = mixAudioTrack(e);
          else if (e.audio && e.audio.own === 'mic') a = live(mainAudioTrack()) ? mainAudioTrack() : null;
          else if (e.audio) a = shipKind(e.audio.own === 'stage' ? ownStageStream() : claimStream(e.audio), 'audio');
          if (!v || (e.audio && !a)) return null;
          if (a) want.push(a);
          want.push(v);
        } else {
          let a = null;
          if (e.audio && e.audio.mix) a = mixAudioTrack(e);
          else if (e.audio && e.audio.own === 'mic') a = live(mainAudioTrack()) ? mainAudioTrack() : null;
          else if (e.audio) a = shipKind(e.audio.own === 'stage' ? ownStageStream() : claimStream(e.audio), 'audio');
          const v = e.video && shipKind(e.video.own === 'stage' ? ownStageStream() : claimStream(e.video), 'video');
          if (a) want.push(a);
          if (v) want.push(v);
        }
      } catch (e1) {}
      const jk = e.key + '>' + e.to;
      if (!want.length) {
        if (!trackObject(e.audio, 'audio') && !trackObject(e.video, 'video')) return null;
        let st = fwdStreams.get(jk);
        if (!st) { st = new MediaStream(); fwdStreams.set(jk, st); }
        return st;
      }
      let st = fwdStreams.get(jk);
      if (!st) { st = new MediaStream(); fwdStreams.set(jk, st); }
      syncTracks(st, want);
      return st.getTracks().length ? st : null;
    }
    function watchPli(sd, key) {
      if (!sd) return;
      const ask = () => { try { C.kfNeed(key); } catch (e) {} };
      try { if (sd.onPictureLossIndication && typeof sd.onPictureLossIndication.subscribe === 'function') sd.onPictureLossIndication.subscribe(ask); } catch (e) {}
      try { if (sd.onKeyFrameRequest && typeof sd.onKeyFrameRequest.subscribe === 'function') sd.onKeyFrameRequest.subscribe(ask); } catch (e) {}
    }
    function attachTrack(job, jk, p, tr) {
      void jk;
      try {
        if (tr.kind === 'audio' && !C.isStageJob(job.key)) { try { job.container.__solo = true; } catch (e) {} }
        const sd = C.addAux(p.pc, tr, job.container);
        if (!sd) { job.attachErr = 'error'; return null; }
        job.senders.push(sd); job.trackList.push(tr); job.srcTracks.push(tr);
        if (C.isStageJob(job.key)) C.stageSenders.add(sd); else C.lowSenders.add(sd);
        const held = typeof C.outgoingHeld !== 'undefined' && C.outgoingHeld;
        if (!job.active || (job.vParked && tr.kind === 'video') || held) {
          try { const pr = sd.replaceTrack(null); if (pr && typeof pr.catch === 'function') pr.catch(() => {}); } catch (e) {}
        }
        if (tr.kind === 'video') watchPli(sd, job.key);
        countOnto(job, tr);
        job.attachErr = null;
        return sd;
      } catch (e) { job.attachErr = (e && e.name) || 'error'; }
      return null;
    }
    function detachTrack(job, jk, p, idx) {
      void jk;
      const sd = job.senders[idx];
      C.auxSenders.delete(sd); C.stageSenders.delete(sd);
      if (p && p.pc) { C.auxDrop(p.pc, sd); C.stopAuxTx(p.pc, sd, job.key); }
      job.senders.splice(idx, 1); job.trackList.splice(idx, 1); job.srcTracks.splice(idx, 1);
    }
    function parkSender(sd, trackOrNull) {
      try { if (sd && typeof sd.replaceTrack === 'function') { const pr = sd.replaceTrack(trackOrNull); if (pr && typeof pr.catch === 'function') pr.catch(() => {}); } } catch (e) {}
    }
    function kickJob(pid) { const p = C.peers && C.peers.get(pid); if (p) kick(p); }
    function noteReship(row) {
      try {
        const w = typeof window !== 'undefined' ? window : globalThis;
        if (!w.__mosReship) w.__mosReship = [];
        w.__mosReship.push(row);
        if (w.__mosReship.length > 40) w.__mosReship.shift();
      } catch (e) {}
    }
    const shipContainers = new Map();
    function containerFor(jk) {
      let st = shipContainers.get(jk);
      if (!st) { st = new MediaStream(); shipContainers.set(jk, st); }
      return st;
    }
    function dropContainer(jk) { shipContainers.delete(jk); }
    function orphaned(job, p) {
      return !!(job && job.senders && job.senders.length && p && p.pc && typeof p.pc.getSenders === 'function' && !p.pc.getSenders().includes(job.senders[0]));
    }
    const attachFailAt = new Map();
    function attachFailed(to, gen) { return attachFailAt.get(to) === gen; }
    attachFailed.set = function (to, gen) { if (gen == null) attachFailAt.delete(to); else attachFailAt.set(to, gen); };
    function jobPinned(jk) {
      let held = 0;
      try { held = (typeof window !== 'undefined' && window.__parkedJobs && window.__parkedJobs.get(jk)) || 0; } catch (e) { held = 0; }
      return !!(C.DEBUG_ON && (held > Date.now() || (stubDuties.on && dutyJob(jk))));
    }
    function swapTrack(job, jk, p, idx, track) {
      void jk; void p;
      const send = job.active && !job.carryOff && !(job.vParked && track && track.kind === 'video') && !(typeof C.outgoingHeld !== 'undefined' && C.outgoingHeld);
      if (send && job.senders[idx] && typeof job.senders[idx].replaceTrack === 'function') {
        try { const pr = job.senders[idx].replaceTrack(track); if (pr && typeof pr.catch === 'function') pr.catch(() => {}); } catch (e) {}
      }
      job.trackList[idx] = track; job.srcTracks[idx] = track;
      countOnto(job, track);
      return 'swap';
    }
    // Questions carryIn asks that the browser plane answers inside its own sweep. The pure routing answers live in
    // the core, including whether the room extends past my row. What remains here is Node machinery. A throw inside
    // carryIn drops the whole plan.
    // Lost is a missing claim, deadAt, the arrival watchdog's dark bit, or a stale beat.
    function stgLost(rk) {
      const f = C.mosIn && C.mosIn.get(rk); if (!f) return true;
      const fb = M.mosFb && typeof M.mosFb.get === 'function' ? M.mosFb.get(rk) : null;
      let stale = false; try { stale = typeof C.stgStale === 'function' && C.stgStale(rk); } catch (e) {}
      return !!(f.deadAt || (fb && fb.dark) || stale);
    }
    // No tiles: a null-safe kind check for parkSender. The browser reads trackList on a painted job.
    function jobVideoAt(job, i) { return !!(job && job.trackList && job.trackList[i] && job.trackList[i].kind === 'video'); }
    // No pipe lane and no tiles: replaceTrack on the job only. The browser also pauses the picture pipe.
    function stgCarry(rk, on, pri, onlyTo) {
      if (!C.mosJobs) return;
      for (const job of C.mosJobs.values()) {
        if (job.upKey !== rk || !job.active || !job.senders) continue;
        if (on ? !job.carryOff : !(pri && C.stgFedBy(job, pri))) continue;
        if (!on && onlyTo && job.to !== onlyTo) {
          if (job.carryOff) {
            job.carryOff = false;
            for (let i = 0; i < job.senders.length; i++) { const t = job.trackList[i], sd = job.senders[i]; if (t && sd && typeof sd.replaceTrack === 'function') { try { const pr = sd.replaceTrack(t); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {} } }
          }
          continue;
        }
        job.carryOff = !on;
        for (let i = 0; i < job.senders.length; i++) {
          const t = job.trackList[i], sd = job.senders[i];
          if (!t || !sd || typeof sd.replaceTrack !== 'function') continue;
          try { const pr = sd.replaceTrack(on ? t : null); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {}
        }
      }
    }
    // No tiles: nothing to repaint.
    function repaintRedun() {}
    // No tiles: the dark rail records itself on mosFb. Nothing else to note.
    function swapPicNote() {}
    function stgFoNote() {}
    // No row mix: there is no hold map.
    function rowMixHold() { return false; }
    // No row mix: there is no arrival sample.
    function rowMixHeadArrives() { return -1; }
    // The browser remembers a carrier for 15 s after its cell empties (rowX2To / x2Kept). No named timing is that
    // window, and this file may not grow a bare millisecond literal, so the memory stays out until one is named.
    function x2Target(cell) { try { return typeof C.occPid === 'function' ? C.occPid(cell) : null; } catch (e) { return null; } }
    // Mix-minus questions. A throw inside carryIn drops the whole plan, so each answer stays inside its own try.
    // MY MIC AS A FOLD SOURCE. Cached by track identity: a fresh stream id would re-fold every sweep. Waiting
    // still asks iAmWaiting, and answers null until the voice exists.
    let micFoldSt = null, micFoldTr = null;
    function micFoldStream() {
      let waiting = false;
      try { waiting = typeof C.iAmWaiting === 'function' && C.iAmWaiting(); } catch (e) { waiting = false; }
      if (waiting) return null;
      const at = mainAudioTrack();
      if (!live(at)) { micFoldSt = null; micFoldTr = null; return null; }
      if (!micFoldSt || micFoldTr !== at) { micFoldSt = new MediaStream([at]); micFoldTr = at; }
      return micFoldSt;
    }
    function stageVoiceStream() {
      const st = mySelfStream();
      if (!st || typeof st.getAudioTracks !== 'function') return null;
      for (const t of st.getAudioTracks()) if (live(t)) return st;
      return null;
    }
    function partStream(ref) {
      if (!ref) return null;
      try {
        if (ref.own === 'mic') return micFoldStream();
        if (ref.own === 'stage') return stageVoiceStream();
        if (ref.seat) {
          if (typeof C.peerWaits === 'function' && C.peerWaits(ref.seat)) return null;
          const p = C.peers && typeof C.peers.get === 'function' ? C.peers.get(ref.seat) : null;
          if (!p) return null;
          let carried = null;
          try { carried = C.relayVia && typeof C.relayVia.get === 'function' ? C.relayVia.get(ref.seat) : null; } catch (e1) {}
          if (p.relayed) return (carried && carried.stream) || (p.video && p.video.srcObject) || null;
          return p.stream || (p.video && p.video.srcObject) || null;
        }
        if (ref.in) {
          const ent = C.mosIn && typeof C.mosIn.get === 'function' ? C.mosIn.get(ref.in) : null;
          return ent && ent.stream ? ent.stream : null;
        }
      } catch (e) {}
      return null;
    }
    function slotDark(rk) { try { const fb = mosFb.get(rk); return !!(fb && fb.dark); } catch (e) { return false; } }
    // A carried sdrow:q (not the head's own pipe) is hot while its audio packets moved inside the stall window.
    // Arrival, never a level: a quiet head still sends packets (2026-11-13).
    function carriedHot(q) {
      try {
        if (q == null || q === '') return false;
        const key = 'sdrow:' + q;
        const f = C.mosIn && typeof C.mosIn.get === 'function' ? C.mosIn.get(key) : null;
        if (!f || !f.stream) return false;
        let head = null;
        try { head = typeof C.occPid === 'function' ? C.occPid({ pc: 0, r: +q, i: 0 }) : null; } catch (e) { head = null; }
        if (head && String(f.via) === String(head)) return false;
        const n = kindCount(f.stream, 'audio');
        if (!(n >= 0)) return false;
        const now = Date.now();
        let slot = carriedSeen.get(key);
        if (!slot || slot.sid !== (f.stream.id || null)) { slot = { sid: f.stream.id || null, n: n, at: 0 }; carriedSeen.set(key, slot); return false; }
        if (n > slot.n) slot.at = now;
        slot.n = n;
        const stall = rowStall();
        return !!(slot.at && stall > 0 && now - slot.at <= stall);
      } catch (e) { return false; }
    }
    // One Opus quantum, plus the samples still sitting in the port source that reads this slot's audio track.
    // No source for that track: one more quantum. The port keeps the depth on the source node, not on stats().
    function hopMs(slot) {
      const q = (GifOS.timings && GifOS.timings.AUDIO_QUANTUM_MS) || 20;
      const fallback = q + q;
      try {
        const ent = C.mosIn && typeof C.mosIn.get === 'function' ? C.mosIn.get(slot) : null;
        const st = ent && ent.stream;
        const tr = st && typeof st.getAudioTracks === 'function' ? st.getAudioTracks()[0] : null;
        if (!tr) return fallback;
        const contexts = [];
        if (C.ac) contexts.push(C.ac);
        const liveSet = root.AudioContext && root.AudioContext._live;
        if (liveSet) for (const ctx of liveSet) if (contexts.indexOf(ctx) < 0) contexts.push(ctx);
        for (const ctx of contexts) {
          if (!ctx || !ctx._srcs) continue;
          for (const src of ctx._srcs) {
            const ms = src && src.mediaStream;
            if (!ms || typeof ms.getAudioTracks !== 'function' || !src._fifo || typeof src._fifo.len !== 'number') continue;
            let hit = false;
            for (const t of ms.getAudioTracks()) if (t === tr) hit = true;
            if (!hit) continue;
            const rate = src._rate || ctx.sampleRate || 0;
            if (!(rate > 0)) continue;
            return q + Math.max(0, Math.round(src._fifo.len / rate * 1000));
          }
        }
      } catch (e) {}
      return fallback;
    }
    function packFor() { return null; }
    function blockOf(rk) {
      try {
        const f = C.mosIn && typeof C.mosIn.get === 'function' ? C.mosIn.get(rk) : null;
        if (!(f && f.meta && f.meta.n)) return {};
        const m = { n: f.meta.n, cols: f.meta.cols || f.meta.n };
        if (Array.isArray(f.meta.ids) && f.meta.ids.length === m.n) m.ids = f.meta.ids.slice();
        if (typeof f.meta.alag === 'number') m.alag = f.meta.alag;
        return m;
      } catch (e) { return {}; }
    }
    function rowMixOpen() { try { return rowMixShipUntil > Date.now(); } catch (e) { return false; } }
    // The meeting context, already open. Asking here must not create one: a fold that needs a context calls ensureAc.
    function mixReady() {
      try { return !!(C.ac && C.ac.state !== 'closed'); } catch (e) { return false; }
    }
    // ONE FOLD PER foldKey, on the meeting context. Sync matches the browser's foldSync: add a new part, follow a
    // changed stream id, drop a part that left. f._sid is partKey -> stream.id. The ear fold is built and not shipped.
    const downFolds = new Map();
    function foldAc() {
      try { if (!C.ac && typeof C.ensureAc === 'function') C.ensureAc(); } catch (e) {}
      try { return (C.ac && C.ac.state !== 'closed') ? C.ac : null; } catch (e) { return null; }
    }
    function foldAlive(f) {
      try { const c = f && f.dest && f.dest.context; return !!(c && c.state !== 'closed'); } catch (e) { return false; }
    }
    function foldSync(f, parts) {
      const sid = f._sid || (f._sid = new Map());
      for (const k of [...sid.keys()]) if (!parts.has(k)) { f.remove(k); sid.delete(k); }
      for (const [k, st] of parts) {
        if (!st || st.id == null) continue;
        if (sid.get(k) !== st.id) { f.remove(k); sid.set(k, st.id); }
        if (!f.has(k)) f.add(k, st, 1); else f.follow(k, st);
      }
      if (f.scrub) f.scrub();
      if (f.dedupeTracks) f.dedupeTracks();
    }
    function foldFor(foldKey, parts) {
      if (foldKey == null) return null;
      const ac = foldAc();
      if (!ac || !GifOS.meshMedia || typeof GifOS.meshMedia.createAudioFold !== 'function') return null;
      let f = downFolds.get(foldKey);
      if (f && !foldAlive(f)) {
        try { f.clear(); } catch (e) {}
        downFolds.delete(foldKey);
        f = null;
      }
      if (!f) {
        try { f = GifOS.meshMedia.createAudioFold(ac); } catch (e) { return null; }
        if (!f) return null;
        downFolds.set(foldKey, f);
      }
      try { foldSync(f, parts || new Map()); } catch (e) {}
      try { const t = f.track(); return live(t) ? t : null; } catch (e) { return null; }
    }
    function foldsKeep(keep) {
      for (const [k, f] of [...downFolds]) {
        if (keep && keep.has(k)) continue;
        let tr = null;
        try { tr = f.track && f.track(); } catch (e) {}
        try { f.clear(); } catch (e) {}
        if (tr && GifOS.meshMedia && typeof GifOS.meshMedia.retireAudioTracks === 'function') {
          try { GifOS.meshMedia.retireAudioTracks([tr]); } catch (e) {}
        }
        downFolds.delete(k);
      }
    }
    function foldParts() {
      const o = {};
      for (const [k, f] of downFolds) {
        const sid = f && f._sid;
        o[k] = sid ? [...sid.keys()].sort() : [];
      }
      return o;
    }
    function mixParts(e) {
      const parts = new Map();
      const list = e && e.audio && Array.isArray(e.audio.parts) ? e.audio.parts : [];
      const ask = typeof M.partStream === 'function' ? M.partStream : partStream;
      for (let i = 0; i < list.length; i++) {
        const pair = list[i];
        if (!pair || pair[0] == null) continue;
        const st = ask(pair[1]);
        if (st) parts.set(pair[0], st);
      }
      return parts;
    }
    function mixAudioTrack(e) {
      if (!e || !e.audio || !e.audio.mix) return null;
      const f = downFolds.get(e.audio.mix);
      if (!f || typeof f.track !== 'function') return null;
      const t = f.track();
      return live(t) ? t : null;
    }
    function packVideo(video) {
      if (!video || !video.pack) return null;
      let pk = null;
      try {
        const fn = M.packFor;
        pk = typeof fn === 'function' ? fn(video.pack, video.skip) : null;
      } catch (e) { return null; }
      const t = pk && pk.track;
      return live(t) ? t : null;
    }
    function rowMixViaPeek() {
      try {
        const c = typeof C.meshCoord === 'function' ? C.meshCoord() : null;
        if (!c || c.pc !== 0) return null;
        const dest = (c.i === c.r) ? 0 : c.i;
        return typeof C.occPid === 'function' ? C.occPid({ pc: 0, r: dest, i: c.i }) : null;
      } catch (e) { return null; }
    }
    // No elements: a claim never carries a hold on a tile.
    function mosHeld(e) { return !!(e && e.el && e.el._mosHold); }
    // THE ROW MEASURE AND THE DARK RAIL. Both read the port's per-track RTP count (rtpCount), the same arrival signal
    // the owed sample uses. Thresholds are the named timings. The browser's dog cadence (300/900/3000) and its
    // false-fire decay stay in that file: copying them here would be a new bare wait.
    const ROW_MIX_MS = GifOS.timings.ROW_MIX_MS, ROW_MIX_PULL = GifOS.timings.ROW_MIX_PULL, ROW_MIX_TTL = GifOS.timings.ROW_MIX_TTL;
    const MOS_DARK_MS = GifOS.timings.MOS_DARK_MS, MOS_FLOWED_RECENT = GifOS.timings.MOS_FLOWED_RECENT, MOS_QUALIFY = GifOS.timings.MOS_QUALIFY;
    const HOT_VOID_MS = GifOS.timings.HOT_VOID_MS;
    const rowStall = () => (ROW_MIX_MS > 0 ? (2 * ROW_MIX_MS + ROW_MIX_MS / 2) : 0);
    const carriedSeen = new Map();
    let rowLv = null, rowDeaf = null, rowMixDeaf = false, rowMixDeadN = 0, rowMixArmed = false, rowMixShipUntil = 0;
    function kindCount(stream, kind) {
      if (!stream || typeof stream.getTracks !== 'function') return -1;
      let n = -1;
      for (const t of stream.getTracks()) {
        if (!t || t.kind !== kind || t.readyState === 'ended') continue;
        if (n < 0) n = 0;
        n += rtpCount(t);
      }
      return n;
    }
    // 1 = the sdm audio moved since the last sample, 0 = the picture moved and the audio did not, -1 = nothing to judge.
    function rowLevel(ent, fromHead) {
      const st = ent && ent.stream;
      const sid = st && st.id || null;
      const a = kindCount(st, 'audio'), v = kindCount(st, 'video');
      const prev = rowLv;
      rowLv = { sid: sid, a: a, v: v };
      if (!fromHead || !prev || prev.sid !== sid || !(a >= 0)) return -1;
      const aMoved = a > prev.a, vMoved = v >= 0 && v > prev.v;
      if (aMoved) return 1;
      if (vMoved) return 0;
      return -1;
    }
    function rowMeasure() {
      let pri = null;
      try { pri = C.mosIn && typeof C.mosIn.get === 'function' ? C.mosIn.get('sdm') : null; } catch (e) { pri = null; }
      const fb = mosFb.get('sdm'), str = (v) => (v == null ? null : String(v));
      return {
        sdm: pri ? { via: str(pri.via), sid: str(pri.streamId), dead: !!pri.deadAt } : null,
        deaf: !!rowMixDeaf, dark: !!(fb && fb.dark), deafOut: rowDeaf ? str(rowDeaf.pid) : null,
      };
    }
    // L49 on the owed clock: a non-head who holds the head's sdm. Armed once the audio has arrived. ROW_MIX_PULL
    // samples with the picture still moving and the audio still are the verdict (deafOut) and the mic-pull window.
    function judgeRow(now) {
      let c = null;
      try { c = typeof C.meshCoord === 'function' ? C.meshCoord() : null; } catch (e) { c = null; }
      if (!c || c.i === 0) {
        rowMixDeadN = 0;
        if (c && c.i === 0 && (rowMixDeaf || rowDeaf)) { rowMixDeaf = false; rowDeaf = null; }
        return;
      }
      let head = null, ent = null;
      try { head = typeof C.occPid === 'function' ? C.occPid({ pc: c.pc, r: c.r, i: 0 }) : null; } catch (e) { head = null; }
      try { ent = C.mosIn && C.mosIn.get('sdm'); } catch (e) { ent = null; }
      const fromHead = !!(ent && !ent.deadAt && head && String(ent.via) === String(head));
      const level = rowLevel(ent, fromHead);
      if (level === 1) { rowMixArmed = true; rowMixDeaf = false; rowMixDeadN = 0; }
      else if (rowMixArmed && level === 0) { rowMixDeadN++; rowMixDeaf = true; }
      else rowMixDeadN = 0;
      if (ROW_MIX_PULL > 0 && rowMixDeadN >= ROW_MIX_PULL && head) {
        if (rowMixDeaf && ROW_MIX_TTL > 0 && ROW_MIX_MS > 0) rowMixShipUntil = now + ROW_MIX_TTL + ROW_MIX_MS;
        rowDeaf = { pid: head };
      }
      if (rowDeaf && !rowMixDeaf) rowDeaf = null;
    }
    function pipeCount(ent, voice) {
      try {
        if (!ent || !ent.stream) return -1;
        // The last live track of a kind: a renegotiated pair keeps the ended one first (the browser's liveOf).
        const lastLive = (kind) => {
          const fn = kind === 'audio' ? ent.stream.getAudioTracks : ent.stream.getVideoTracks;
          if (typeof fn !== 'function') return null;
          const all = fn.call(ent.stream) || [];
          let t = null;
          for (const x of all) if (x && x.readyState !== 'ended') t = x;
          return t;
        };
        const audio = lastLive('audio'), video = lastLive('video');
        const track = (voice && audio) ? audio : (video || audio);
        if (!track) return -1;
        const n = rtpCount(track);
        return { b: n, d: n };
      } catch (e) { return -1; }
    }
    function wakeStd(std) {
      try { if (std && std.key && typeof C.demand === 'function') C.demand(std.via, std.key, std.streamId, true); } catch (e) {}
    }
    function stdOf(rk) { try { return C.mosStandby && typeof C.mosStandby.get === 'function' ? C.mosStandby.get(rk) : null; } catch (e) { return null; } }
    // The standby's packet count, so a dark swap can see that the other pipe moved. Same re-baseline as the browser.
    function sampleStandby(rk, fb) {
      if (!(fb.dark || fb.wakeAt)) {
        if (fb.d0 !== -1 || fb.stdFdec !== -1) { fb.d0 = -1; fb.stdFdec = -1; fb.stdB = -1; }
        return;
      }
      const s = pipeCount(stdOf(rk), rk.indexOf('stg:') === 0);
      if (s === -1 || !(s.d >= 0)) return;
      if (fb.d0 === -1 || s.d < fb.d0) { fb.d0 = s.d; fb.b0 = s.b; fb.stdAdvAt = 0; }
      if (fb.stdFdec >= 0 && s.d > fb.stdFdec) fb.stdAdvAt = Date.now();
      let pri = null;
      try { pri = C.mosIn && C.mosIn.get(rk); } catch (e) { pri = null; }
      // No schedReconcile here. The mosaic sweep applies a dark bit. An extra one lands inside a receiver's idle
      // window and wakes the pipe it just parked (the forward flat check).
      fb.stdFdec = s.d; fb.stdB = s.b;
    }
    function watchOne(rk, pri, now) {
      if (!pri || typeof C.isRedun !== 'function' || !C.isRedun(rk)) return;
      const fb = mosFb.get(rk);
      if (!fb) return;
      if (typeof M.mosHeld === 'function' && M.mosHeld(pri)) return;
      if (pri.stream && typeof pri.stream.getTracks === 'function' && !pri.stream.getTracks().length) { sampleStandby(rk, fb); return; }
      const stage = rk.indexOf('stg:') === 0;
      const bytes = pipeCount(pri, stage);
      if (stage && pri.stream && typeof pri.stream.getVideoTracks === 'function' && pri.stream.getVideoTracks().length) {
        const pv = pipeCount(pri, false);
        if (pv !== -1 && pv.b > 0 && pv.b > (fb.pvB > 0 ? fb.pvB : 0)) { fb.pvAt = now; fb.pvB = pv.b; }
        else if (pv !== -1 && fb.pvB !== pv.b) fb.pvB = pv.b;
        const own = pri.via === rk.slice(4).split('^')[0] && String(pri.key || '').indexOf('^') < 0;
        // No element on Node: video packets moving are the picture that is still arriving.
        if (own && fb.pvAt && M.STG_PIC_LIVE_MS > 0 && now - fb.pvAt < M.STG_PIC_LIVE_MS) {
          if (fb.dark) { fb.dark = false; fb.suspect = false; }
          if (bytes !== -1 && bytes.b > (fb.lastBytes > 0 ? fb.lastBytes : 0)) fb.lastAdvanceAt = now;
          if (bytes !== -1) fb.lastBytes = bytes.b;
          fb.q = 0; fb.flowSince = 0;
          sampleStandby(rk, fb);
          return;
        }
      } else if (fb.pvB !== -1) { fb.pvB = -1; fb.pvAt = 0; }
      if (bytes < 0) {
        const std0 = stdOf(rk);
        if (!fb.dark && fb.claimAt && HOT_VOID_MS > 0 && now - fb.claimAt > HOT_VOID_MS && std0 && std0.key) {
          fb.dark = true; wakeStd(std0);
        }
        sampleStandby(rk, fb);
        return;
      }
      // A first sample of zero is a baseline, not flow: rtpCount starts at 0, and calling that an advance would arm a stage that never sent.
      if (fb.lastBytes === -1 && !(bytes.b > 0)) fb.lastBytes = bytes.b;
      else if (!fb.dark && fb.lastBytes !== -1 && bytes.b < fb.lastBytes) {
        fb.lastBytes = bytes.b; fb.lastAdvanceAt = now; fb.q = 0; fb.flowSince = 0;
      } else if (fb.lastBytes === -1 || bytes.b > fb.lastBytes) {
        if (!fb.flowSince) fb.flowSince = now;
        fb.lastBytes = bytes.b; fb.lastAdvanceAt = now;
        fb.q = Math.min(64, (fb.q || 0) + 1);
        if (fb.suspect) fb.suspect = false;
        if (fb.dark) {
          fb.dark = false; fb.suspect = false; fb.q = 0; fb.flowSince = 0;
          fb.fp = Math.min(3, (fb.fp || 0) + 1); fb.fpDecayAt = now;
        }
      } else if (!fb.dark && ((fb.q || 0) >= (MOS_QUALIFY << Math.min(3, fb.fp || 0)) || (stage && (fb.q || 0) > 0))) {
        // The browser also requires a standby before it sets dark on a non-stage slot, because its only act is the wake.
        // slotDark has to answer a pipe whose packets stopped, so the bit is set on the flat window either way; the wake still needs a standby.
        // The sweep applies the bit. Reconciling here wakes a pipe a receiver just parked.
        const std = stdOf(rk);
        if (!fb.suspect && fb.lastAdvanceAt && now - fb.lastAdvanceAt > MOS_DARK_MS && now - fb.lastAdvanceAt < MOS_FLOWED_RECENT) {
          fb.dark = true; if (std && std.key) wakeStd(std);
        }
      } else if (!fb.dark && fb.lastAdvanceAt && now - fb.lastAdvanceAt > MOS_FLOWED_RECENT && (fb.q || fb.flowSince)) {
        fb.q = 0; fb.flowSince = 0;
      } else if (!fb.dark && !(fb.q || 0) && fb.claimAt && HOT_VOID_MS > 0
          && now - fb.claimAt > HOT_VOID_MS && now - Math.max(fb.lastAdvanceAt || 0, fb.claimAt) > HOT_VOID_MS) {
        const std = stdOf(rk);
        if (!fb.suspect && std && std.key) { fb.dark = true; wakeStd(std); }
      }
      if (stage && !fb.dark && !fb.suspect && bytes.b <= 0 && !(fb.lastBytes > 0) && fb.claimAt && M.STG_ZERO_MS > 0 && now - fb.claimAt > M.STG_ZERO_MS) {
        const std = stdOf(rk);
        if (std && std.key) { fb.dark = true; wakeStd(std); }
      }
      sampleStandby(rk, fb);
    }
    function watchClaims(now) {
      if (!(MOS_DARK_MS > 0) || !(MOS_QUALIFY > 0) || !(MOS_FLOWED_RECENT > 0)) return;
      if (!C.mosIn || typeof C.mosIn.entries !== 'function') return;
      for (const [rk, pri] of C.mosIn) {
        try { watchOne(rk, pri, now); } catch (e) {}
      }
    }
    function rowAndWatch() {
      const now = Date.now();
      try { watchClaims(now); } catch (e) {}
      try { judgeRow(now); } catch (e) {}
      try { if (typeof C.planMeasured === 'function') C.planMeasured('row', rowMeasure()); } catch (e) {}
      try {
        if (typeof C.rowActing === 'function' && typeof C.meshCoord === 'function') C.rowActing(C.meshCoord());
      } catch (e) {}
    }
    // A played second-root copy keeps its source. carryIn decides who receives ^r; this ends a played copy whose
    // source I no longer hold, so the ship that follows mints a new id instead of re-pointing the one a receiver plays.
    function stgRootHold(jk, slot, to) {
      const jobs = C.mosJobs;
      if (!jobs || typeof jobs.get !== 'function' || !to) return null;
      const job = jobs.get(jk);
      if (!job || !job.active || !job.srcTracks || !job.srcTracks.length) return null;
      let ent = null;
      for (const e of [C.mosIn && C.mosIn.get(slot), C.mosStandby && C.mosStandby.get(slot)]) {
        if (e && e.stream && typeof C.stgFedBy === 'function' && C.stgFedBy(job, e)) { ent = e; break; }
      }
      let path = [];
      try { path = ent && typeof C.stgPath === 'function' ? (C.stgPath(ent) || []) : []; } catch (e) { path = []; }
      if (!Array.isArray(path)) path = [];
      let hop = null;
      try { hop = typeof C.vpId === 'function' ? C.vpId(to) : null; } catch (e) { hop = null; }
      if (ent && path.indexOf(hop) < 0) return ent;
      try { if (typeof C.unshipJob === 'function') C.unshipJob(jk, true); } catch (e) {}
      dropContainer(jk);
      return false;
    }
    function stagePipeSkip(owner, key, t) {
      try {
        if (!owner || !t || typeof C.pipePeers !== 'function') return false;
        if (C.pipePeers().indexOf(t) < 0) return false;
        if (C.pipeStg && typeof C.pipeStg.get === 'function' && C.pipeStg.get(owner) === t) return true;
        if (C.mosAnn && typeof C.mosAnn.has === 'function' && C.mosAnn.has(t + '|' + key)) return true;
        if (typeof C.pipeVideo === 'function' && !C.pipeVideo(t)) return true;
        return false;
      } catch (e) { return false; }
    }
    // The browser's test levers (a held relay, one root). Absent on a normal seat, so this is a no-op there.
    function stageDebugSkip(owner, key, t, list) {
      try {
        if (!C.DEBUG_ON) return false;
        const w = typeof globalThis !== 'undefined' ? globalThis : null;
        if (!w) return false;
        if (owner !== C.myId && w.__relayHoldUntil > Date.now() && C.mosJobs && !C.mosJobs.has(key + '>' + t)) return true;
        const first = (list || []).filter(Boolean)[0];
        if (owner === C.myId && w.__stgOneRootForTest && t !== first) return true;
        return false;
      } catch (e) { return false; }
    }
    function seatList(s, name) {
      try {
        const fn = s && s[name];
        const v = typeof fn === 'function' ? fn.call(s) : [];
        return Array.isArray(v) ? v : [];
      } catch (e) { return []; }
    }
    function holdSecondRoots() {
      let c = null;
      try { c = typeof C.meshCoord === 'function' ? C.meshCoord() : null; } catch (e) { c = null; }
      if (!c || c.pc !== 0) return;
      const T = C.net && C.net.topo;
      if (!T || typeof T.rowMates !== 'function' || typeof T.colMates !== 'function' || typeof C.occPid !== 'function') return;
      let s = null;
      try { s = typeof C.meshSeat === 'function' ? C.meshSeat() : null; } catch (e) { s = null; }
      const list = [];
      const add = (t) => { if (t && list.indexOf(t) < 0) list.push(t); };
      try { for (const m of T.rowMates(c) || []) add(C.occPid(m)); } catch (e) {}
      try { for (const m of T.colMates(c) || []) add(C.occPid(m)); } catch (e) {}
      for (const t of seatList(s, 's1Bridges')) add(t);
      try { if (typeof C.pipePeers === 'function') for (const t of C.pipePeers() || []) add(t); } catch (e) {}
      let held = [];
      try {
        held = [...C.mosIn.keys()].filter((k) => k.indexOf('stg:') === 0 && !(typeof C.stgEnded === 'function' && C.stgEnded(k)));
      } catch (e) { held = []; }
      for (const k of held) {
        const suffix = C.STG_ROOT2 || '^r';
        const key = k + suffix;
        const owner = key.slice(4).split('^')[0];
        const hold = (t) => { if (t) stgRootHold(key + '>' + t, k, t); };
        for (const t of list) {
          if (stagePipeSkip(owner, key, t) || stageDebugSkip(owner, key, t, list)) continue;
          hold(t);
        }
        try { const dn = typeof T.down === 'function' ? C.occPid(T.down(c)) : null; if (dn) hold(dn); } catch (e) {}
        for (const t of seatList(s, 'u2Heirs').concat(seatList(s, 'l14Served'))) if (t) hold(t);
      }
    }
    // claimMos, then every carry entry, then the reaper, then the duty lever. The browser does this inside reconcileMosaic.
    function sweepJobs() {
      try { C.claimMos(); } catch (e) {}
      const wanted = new Set();
      let plan = [];
      try { C.roomBeyondRow(true); } catch (e) {}
      try { plan = C.carryIn() || []; } catch (e) { plan = []; }
      // carryIn already chose the ^r routes. Hold a played second root on its source before this sweep ships, so a
      // copy whose source is gone ends here and the next ship mints a fresh id (the browser's holdSecondRoots).
      try { holdSecondRoots(); } catch (e) {}
      const keep = new Set();
      for (const e of plan) {
        if (!e || !e.audio || !e.audio.mix) continue;
        try { foldFor(e.audio.mix, mixParts(e)); keep.add(e.audio.mix); } catch (err) {}
      }
      try { foldsKeep(keep); } catch (e) {}
      for (const e of plan) {
        if (!e || !e.key || !e.to) continue;
        // No pack track: do not ship the audio half. streamFor refuses the same row if asked on its own.
        if (e.video && e.video.pack && !packVideo(e.video)) continue;
        let jk = null;
        try { jk = C.shipJob(e.key, e.to, streamFor(e), e.meta, e.upKey); } catch (err) { jk = null; }
        if (jk) wanted.add(jk);
      }
      try { if (typeof C.meshCoord === 'function' && C.meshCoord()) C.reapJobs(wanted); } catch (e) {}
      try { dutyTick(); } catch (e) {}
    }
    // The browser plane debounces at 60 ms, a bare literal already counted in that file. The named 60 ms timing keeps
    // a new bare literal out of this one.
    let reconT = 0;
    function schedReconcile() {
      if (reconT) return;
      reconT = setTimeout(() => { reconT = 0; sweepJobs(); }, GifOS.timings.TUNNEL_MINT_RETRY_MS);
    }
    let claimT = 0;
    function schedClaim() {
      if (claimT) return;
      claimT = setTimeout(() => { claimT = 0; try { C.claimMos(); } catch (e) {} }, GifOS.timings.TUNNEL_MINT_RETRY_MS);
    }

    def('mainAudioTrack', mainAudioTrack);
    def('sentVideoTrack', sentVideoTrack);
    def('stageVideoTrack', stageVideoTrack);
    def('refreshOutbound', refreshOutbound);
    def('attachLocalTracks', attachLocalTracks);
    def('dropEndedRemoteTracks', dropEndedRemoteTracks);
    def('peerAudioTracks', peerAudioTracks);
    // A leaving peer's tracks leave every live fold now. The output track stays: another fold may still be shipping it.
    function retireMixTracks(tracks) {
      if (!tracks || !tracks.length) return;
      try { if (GifOS.meshMedia && GifOS.meshMedia.retireAudioTracks) GifOS.meshMedia.retireAudioTracks(tracks); } catch (e) {}
      try {
        for (const f of downFolds.values()) {
          if (f && f.dropTracks) f.dropTracks(tracks);
          if (f && f.scrub) f.scrub();
        }
      } catch (e) {}
    }
    def('retireMixTracks', retireMixTracks);
    def('adapt', () => {});             // no encoder of my own to tune: forwarded and Opus tracks keep their own rate
    def('tileHolds', () => false);      // no tiles: no screen holds a stream
    def('stubDuties', stubDuties);
    def('bindClaim', bindClaim);
    def('unbindClaim', unbindClaim);
    def('adoptClaim', adoptClaim);
    def('picRead', picRead);
    def('rowEdge', rowEdge);
    def('keyUp', keyUp);
    def('producerKey', producerKey);
    def('kfEv', () => {});   // keyframe forensics: the browser plane logs them (window.__kfLog); nothing to log here
    def('attachTrack', attachTrack);
    def('detachTrack', detachTrack);
    def('parkSender', parkSender);
    def('kickJob', kickJob);
    def('noteReship', noteReship);
    def('dropContainer', dropContainer);
    def('orphaned', orphaned);
    def('attachFailed', attachFailed);
    def('containerFor', containerFor);
    def('jobPinned', jobPinned);
    def('swapTrack', swapTrack);
    def('dutyJob', dutyJob);
    def('dutyMuteTick', dutyMuteTick);
    def('schedClaim', schedClaim);
    def('schedReconcile', schedReconcile);
    def('stgLost', stgLost);
    def('mySelfStream', mySelfStream);
    def('jobVideoAt', jobVideoAt);
    def('stgCarry', stgCarry);
    def('repaintRedun', repaintRedun);
    def('swapPicNote', swapPicNote);
    def('stgFoNote', stgFoNote);
    def('rowMixHold', rowMixHold);
    def('rowMixHeadArrives', rowMixHeadArrives);
    def('x2Target', x2Target);
    def('partStream', partStream);
    def('slotDark', slotDark);
    def('carriedHot', carriedHot);
    def('hopMs', hopMs);
    def('packFor', packFor);
    def('blockOf', blockOf);
    def('rowMixOpen', rowMixOpen);
    def('mixReady', mixReady);
    def('rowMixViaPeek', rowMixViaPeek);
    def('mosHeld', mosHeld);
    // The browser's mosaic sweep is workerClock(2000): FHOP_SWEEP ticks times tickMs. Announces refresh on that beat.
    // The host's setInterval returns a number, so unref runs only when the timer object itself is what came back.
    const sweepT = setInterval(() => { try { M.schedReconcile(); } catch (e) {} }, GifOS.meshLaws.FHOP_SWEEP * GifOS.timings.tickMs);
    if (sweepT && typeof sweepT.unref === 'function') sweepT.unref();
    return { folds: foldParts, names: ['mainAudioTrack', 'sentVideoTrack', 'stageVideoTrack', 'refreshOutbound', 'attachLocalTracks', 'dropEndedRemoteTracks', 'peerAudioTracks', 'retireMixTracks', 'adapt', 'tileHolds', 'stubDuties', 'bindClaim', 'unbindClaim', 'adoptClaim', 'picRead', 'rowEdge', 'keyUp', 'producerKey', 'kfEv', 'attachTrack', 'detachTrack', 'parkSender', 'kickJob', 'noteReship', 'dropContainer', 'orphaned', 'attachFailed', 'containerFor', 'jobPinned', 'swapTrack', 'dutyJob', 'dutyMuteTick', 'schedClaim', 'schedReconcile', 'stgLost', 'mySelfStream', 'jobVideoAt', 'stgCarry', 'repaintRedun', 'swapPicNote', 'stgFoNote', 'rowMixHold', 'rowMixHeadArrives', 'x2Target', 'partStream', 'slotDark', 'carriedHot', 'hopMs', 'packFor', 'blockOf', 'rowMixOpen', 'mixReady', 'rowMixViaPeek', 'mosHeld'] };
  }

  GifOS.planeNode = { install };
})(typeof window !== 'undefined' ? window : globalThis);
