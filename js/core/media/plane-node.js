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
 * Duty slots (sdm / sub / sgs) are read off the jobs this plane actually holds; this plane still composites no strip
 * and no row mix, so an owed duty with no job reads 'no-track'.
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
    // arriving when the RTP packets the port counted on its stream's tracks (werift onReceiveRtp) moved since my last
    // sample. Arrival, never level; nothing announced or delivered reads not arriving.
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
    // No picture consumer on this plane yet: a claim's element stays empty.
    function bindClaim(rk, claim) { if (claim) claim.el = null; }
    function unbindClaim(rk, claim) { if (claim) claim.el = null; }
    function adoptClaim(rk, neu, old) { if (neu) neu.el = null; }
    function picRead(claim) { return { w: 0, frames: 0 }; }
    // The fail-back hold is plane-browser only for now.
    function iActAsHead() {
      const c = C.meshCoord();
      if (!c) return false;
      const h = C.actingHead(c); return c.i === 0 || (h != null && String(h) === String(C.myId));
    }
    function rowHeadPid(c) { return C.actingHead(c); }
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
    const fwdStreams = new Map();
    function streamFor(e) {
      if (!e) return null;
      if (e.own === 'stage') return ownStageStream();
      const want = [];
      const a = e.audio && shipKind(e.audio.own === 'stage' ? ownStageStream() : claimStream(e.audio), 'audio');
      const v = e.video && shipKind(e.video.own === 'stage' ? ownStageStream() : claimStream(e.video), 'video');
      if (a) want.push(a);
      if (v) want.push(v);
      if (!want.length) return null;
      const jk = e.key + '>' + e.to;
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
    // Questions carryIn asks that the browser plane answers inside its own sweep. Node does not run that sweep, so
    // these are the same answers here. A throw inside carryIn drops the whole plan.
    let mosBeyondAt = 0;
    function beyondRowNow() {
      const s = typeof C.meshSeat === 'function' ? C.meshSeat() : null;
      const c = typeof C.meshCoord === 'function' ? C.meshCoord() : null;
      const raw = (() => {
        if (!s || !c || C.BROADCAST) return false;
        try { if (typeof C.pipePeers === 'function' && C.pipePeers().length) return true; } catch (e) {}
        try { if (C.meshNode && typeof C.meshNode.meetingFar === 'function' && C.meshNode.meetingFar() > 0) return true; } catch (e) {}
        if (s.occ && C.net && C.net.topo) for (const [k, v] of s.occ) {
          if (v === C.myId) continue;
          const cc = C.net.topo.unck(k);
          if (cc.pc !== c.pc || cc.r !== c.r) return true;
        }
        const kids = s.childOf, n = C.SCALE && C.SCALE.C;
        if (kids && kids.size && n && C.net && C.net.topo) for (let j = 0; j < n; j++) {
          const v = kids.get(C.net.topo.ckey({ pc: c.pc, r: c.r, i: j }));
          if (v && v !== C.myId) return true;
        }
        return false;
      })();
      if (raw) mosBeyondAt = Date.now();
      const grace = GifOS.timings.MOS_GRACE;
      return !!(raw || (mosBeyondAt && Date.now() - mosBeyondAt < grace && s && c));
    }
    function l14DownHeads(sv, beyondRow, ownChild) {
      if (!sv || !beyondRow || typeof sv.l14Served !== 'function') return [];
      return sv.l14Served().filter((h) => h !== ownChild);
    }
    const vpId = (pid) => String(pid || '').slice(0, 10);
    const stgHop = (f) => ((f && f.meta && typeof f.meta.h === 'number') ? f.meta.h : 998) + 1 + ((f && f.meta && f.meta.sb === 1) ? 1 : 0);
    const stgPath = (f) => ((f && f.meta && Array.isArray(f.meta.vp)) ? f.meta.vp : []).concat(vpId(C.myId)).slice(-(C.STG_VP_MAX || 0));
    function stgSecondRoot(f, sb) {
      if (!f || !sb || !sb.stream || sb.stream === f.stream || !sb.meta || sb.meta.ao) return null;
      const sv = Array.isArray(sb.meta.vp) ? sb.meta.vp : null; if (!sv || !sv.length) return null;
      const pv = f.meta && Array.isArray(f.meta.vp) ? f.meta.vp : [];
      return sv.some((s) => pv.indexOf(s) >= 0) ? null : sb;
    }
    function stgLost(rk) {
      const f = C.mosIn && C.mosIn.get(rk); if (!f) return true;
      const fb = M.mosFb && typeof M.mosFb.get === 'function' ? M.mosFb.get(rk) : null;
      let stale = false; try { stale = typeof C.stgStale === 'function' && C.stgStale(rk); } catch (e) {}
      return !!(f.deadAt || (fb && fb.dark) || stale);
    }
    function stgRootKey(key) { return typeof key === 'string' && key.indexOf('stg:') === 0 && key.slice(-2) === '^r'; }
    function stgFedBy(job, ent) {
      const trs = ent && ent.stream && typeof ent.stream.getTracks === 'function' ? ent.stream.getTracks() : [];
      return !!(job && job.srcTracks && job.srcTracks.some((t) => trs.indexOf(t) >= 0));
    }
    function jobVideoAt(job, i) { return !!(job && job.trackList && job.trackList[i] && job.trackList[i].kind === 'video'); }
    // A dark stage claim stops the copies it feeds. No pipe lane on this plane.
    function stgCarry(rk, on, pri, onlyTo) {
      if (!C.mosJobs) return;
      for (const job of C.mosJobs.values()) {
        if (job.upKey !== rk || !job.active || !job.senders) continue;
        if (on ? !job.carryOff : !(pri && stgFedBy(job, pri))) continue;
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
    function repaintRedun() {}
    function swapPicNote() {}
    function stgFoNote() {}
    function rowMixHold() { return false; }
    function rowMixHeadArrives() { return -1; }
    function x2Target(cell) { try { return typeof C.occPid === 'function' ? C.occPid(cell) : null; } catch (e) { return null; } }
    function mosHeld(e) { return !!(e && e.el && e.el._mosHold); }
    // claimMos, then every carry entry, then the reaper, then the duty lever. The browser does this inside reconcileMosaic.
    function sweepJobs() {
      try { C.claimMos(); } catch (e) {}
      const wanted = new Set();
      let plan = [];
      try { plan = C.carryIn() || []; } catch (e) { plan = []; }
      for (const e of plan) {
        if (!e || !e.key || !e.to) continue;
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
    def('retireMixTracks', () => {});   // no fold mixes here yet (mix-minus is a later plan slot)
    def('adapt', () => {});             // no encoder of my own to tune: forwarded and Opus tracks keep their own rate
    def('tileHolds', () => false);      // no tiles: no screen holds a stream
    def('stubDuties', stubDuties);
    def('bindClaim', bindClaim);
    def('unbindClaim', unbindClaim);
    def('adoptClaim', adoptClaim);
    def('picRead', picRead);
    def('iActAsHead', iActAsHead);
    def('rowHeadPid', rowHeadPid);
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
    def('beyondRowNow', beyondRowNow);
    def('l14DownHeads', l14DownHeads);
    def('vpId', vpId);
    def('stgHop', stgHop);
    def('stgPath', stgPath);
    def('stgSecondRoot', stgSecondRoot);
    def('stgLost', stgLost);
    def('mySelfStream', mySelfStream);
    def('stgRootKey', stgRootKey);
    def('stgFedBy', stgFedBy);
    def('jobVideoAt', jobVideoAt);
    def('stgCarry', stgCarry);
    def('repaintRedun', repaintRedun);
    def('swapPicNote', swapPicNote);
    def('stgFoNote', stgFoNote);
    def('rowMixHold', rowMixHold);
    def('rowMixHeadArrives', rowMixHeadArrives);
    def('x2Target', x2Target);
    def('mosHeld', mosHeld);
    // The browser's mosaic sweep is workerClock(2000): FHOP_SWEEP ticks times tickMs. Announces refresh on that beat.
    // The host's setInterval returns a number, so unref runs only when the timer object itself is what came back.
    const sweepT = setInterval(() => { try { M.schedReconcile(); } catch (e) {} }, GifOS.meshLaws.FHOP_SWEEP * GifOS.timings.tickMs);
    if (sweepT && typeof sweepT.unref === 'function') sweepT.unref();
    return { names: ['mainAudioTrack', 'sentVideoTrack', 'stageVideoTrack', 'refreshOutbound', 'attachLocalTracks', 'dropEndedRemoteTracks', 'peerAudioTracks', 'retireMixTracks', 'adapt', 'tileHolds', 'stubDuties', 'bindClaim', 'unbindClaim', 'adoptClaim', 'picRead', 'iActAsHead', 'rowHeadPid', 'keyUp', 'producerKey', 'kfEv', 'attachTrack', 'detachTrack', 'parkSender', 'kickJob', 'noteReship', 'dropContainer', 'orphaned', 'attachFailed', 'containerFor', 'jobPinned', 'swapTrack', 'dutyJob', 'dutyMuteTick', 'schedClaim', 'schedReconcile', 'beyondRowNow', 'l14DownHeads', 'vpId', 'stgHop', 'stgPath', 'stgSecondRoot', 'stgLost', 'mySelfStream', 'stgRootKey', 'stgFedBy', 'jobVideoAt', 'stgCarry', 'repaintRedun', 'swapPicNote', 'stgFoNote', 'rowMixHold', 'rowMixHeadArrives', 'x2Target', 'mosHeld'] };
  }

  GifOS.planeNode = { install };
})(typeof window !== 'undefined' ? window : globalThis);
