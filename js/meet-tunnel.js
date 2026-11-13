/*
 * meet-tunnel.js — the web path of a relayed link.
 *
 * Some company networks decrypt and inspect all web traffic. They let only
 * web-shaped traffic out (HTTPS and WebSocket) and cut everything else, the
 * relay protocol of a relayed link included: a browser there cannot hold a
 * media connection to anyone outside its own network.
 *
 * This module carries a relayed link over a WebSocket instead. The meeting
 * keeps an ordinary connection for the pair, exactly as on any other link,
 * but its far end is a second connection INSIDE THIS PAGE (the near end of
 * the tunnel). The two tunnel ends, one in each browser, pass each other
 *   - the pair's data channel messages, untouched and in order (they are
 *     sealed with the room key before they get here),
 *   - the compressed audio and video frames of every track either side
 *     sends, untouched (no decode, no re-encode on the way),
 *   - the list of tracks each side sends, so each end can offer its own
 *     side the same tracks under the same stream ids.
 * Each side's connection negotiates only with its own tunnel end, inside the
 * page, so nothing but the WebSocket ever has to leave the network.
 *
 * The WebSocket server pipes exactly two sockets of one link and asks each
 * for the link's relay credential first; this file only presents it.
 *
 * Video frames are forwarded by putting their bytes into the frames of a
 * tiny template encoder (the technique of mesh-pipe.js): a browser will not
 * send a frame it did not encode, but it sends any payload inside one it did.
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});
  const TM = GifOS.timings || (typeof require === 'function' ? require('./timings.js') : {});   // every wait: js/timings.js, loaded before this file

  // The worker owns the socket and every frame: nothing of the media path runs on the page's thread.
  const WORKER_SRC = `
'use strict';
const ends = new Map();     // end id -> { ws, taps: Map(g -> {t, kind, needKey}), pipes: Map(g -> pipe), st }
const HIGH_VIDEO = 262144;  // socket backlog above which video waits for a key frame
const HIGH_AUDIO = 49152;   // socket backlog above which audio frames are skipped
const QMAX = 40;            // video frames held for one far track
const AQ_MAX = 10, AQ_KEEP = 3;   // audio frames held: past the first, skip down to the second (latency over completeness)
const KEY_FLIP_MS = ${TM.KEY_FLIP_MS}, KEY_ASK_MS = ${TM.TUNNEL_KEY_ASK_MS}, TAP_KEY_MS = ${TM.TUNNEL_TAP_KEY_MS}, MINT_RETRY_MS = ${TM.TUNNEL_MINT_RETRY_MS}, MINT_LOOK_MS = ${TM.TUNNEL_MINT_LOOK_MS};
const nowMs = () => performance.now();
function endOf(id) {
  let e = ends.get(id);
  if (!e) { e = { ws: null, taps: new Map(), pipes: new Map(), st: { txA: 0, txV: 0, txDrop: 0, rxA: 0, rxV: 0, outA: 0, outV: 0, rxDrop: 0, keyAsk: 0, txBytes: 0, rxBytes: 0 } }; ends.set(id, e); }
  return e;
}
function sendText(e, s) { try { if (e.ws && e.ws.readyState === 1) { e.ws.send(s); return true; } } catch (err) {} return false; }
function ctl(e, m) { return sendText(e, 'c' + JSON.stringify(m)); }
function pipeFor(e, g, kind) {
  let p = e.pipes.get(g);
  if (!p) { p = { kind, q: [], needKey: kind === 'video', cw: null, writer: null, wrote: 0, kdrop: 0, askAt: 0, mintAt: 0, flipAt: 0, side: 48, mn: 0, mts: 0 }; e.pipes.set(g, p); }
  return p;
}
function askKey(e, g, p) {
  const t = Date.now();
  if (t - p.askAt < KEY_ASK_MS) return;
  p.askAt = t; e.st.keyAsk++;
  ctl(e, { t: 'key', g });
}
// One template frame for one content frame. A key template is a size change of the template picture.
function mint(p, key) {
  if (!p.cw) return;
  try {
    const t0 = Date.now();
    if (!p.cv) { p.cv = new OffscreenCanvas(48, 48); p.cx = p.cv.getContext('2d'); }
    if (key && t0 - p.flipAt >= KEY_FLIP_MS) { p.flipAt = t0; p.side = p.side === 48 ? 47 : 48; p.cv.width = p.side; p.cv.height = p.side; }
    p.cx.fillStyle = '#000'; p.cx.fillRect(0, 0, p.side, p.side); p.cx.fillStyle = '#111'; p.cx.fillRect(++p.mn % 40, (p.mn >> 3) % 40, 2, 2);
    let ts = Math.round(nowMs() * 1000); if (ts <= p.mts) ts = p.mts + 1; p.mts = ts;
    const vf = new VideoFrame(p.cv, { timestamp: ts });
    p.mintAt = nowMs();
    p.cw.write(vf).catch(() => { try { vf.close(); } catch (e) {} });
  } catch (e) {}
}
setInterval(() => {   // a template that never came back is asked for again
  const t = nowMs();
  for (const e of ends.values()) for (const p of e.pipes.values()) if (p.kind === 'video' && p.q.length && t - p.mintAt > MINT_RETRY_MS) mint(p, p.q[0].key);
}, MINT_LOOK_MS);
function onBinary(e, buf) {
  const u = new Uint8Array(buf);
  if (u.length < 4) return;
  const kind = u[0] === 1 ? 'video' : 'audio', key = (u[1] & 1) === 1, g = (u[2] << 8) | u[3];
  const p = e.pipes.get(g);
  e.st.rxBytes += u.length;
  if (!p) { e.st.rxDrop++; return; }
  const bytes = buf.slice(4);
  if (kind === 'audio') {
    e.st.rxA++;
    p.q.push(bytes);
    if (p.q.length > AQ_MAX) { e.st.rxDrop += p.q.length - AQ_KEEP; p.q.splice(0, p.q.length - AQ_KEEP); }
    return;
  }
  e.st.rxV++;
  if (p.needKey && !key) { e.st.rxDrop++; askKey(e, g, p); return; }
  if (key) { p.needKey = false; p.kdrop = 0; }
  if (p.q.length >= QMAX) {   // nothing drains: start again from the newest key frame, or wait for one
    let ki = -1; for (let i = p.q.length - 1; i >= 0; i--) if (p.q[i].key) { ki = i; break; }
    if (key) p.q.length = 0; else if (ki > 0) p.q.splice(0, ki); else { p.q.length = 0; p.needKey = true; e.st.rxDrop++; askKey(e, g, p); return; }
  }
  p.q.push({ bytes, key });
  mint(p, key);
}
function onPipeFrame(e, g, p, frame, writer) {
  if (p.kind === 'audio') {
    const c = p.q.shift();
    if (!c) return;
    frame.data = c; e.st.outA++; p.wrote++;
    return writer.write(frame);
  }
  const head = p.q[0], tkey = frame.type === 'key';
  if (!head) { if (tkey) { p.kdrop++; if (p.kdrop >= 2) { p.needKey = true; askKey(e, g, p); } } return; }   // the viewer asked for a key frame: pass the ask up
  if (head.key && !tkey) { mint(p, true); return; }
  if (!head.key && tkey) { p.kdrop++; if (p.kdrop >= 3) { p.q.length = 0; p.needKey = true; askKey(e, g, p); } else mint(p, false); return; }
  p.q.shift();
  frame.data = head.bytes; e.st.outV++; p.wrote++;
  if (head.key) p.kdrop = 0;
  const r = writer.write(frame);
  if (p.q.length) mint(p, p.q[0].key);
  return r;
}
function onTapFrame(e, g, tap, frame, writer) {
  const ws = e.ws;
  if (ws && ws.readyState === 1 && tap.on) {
    const key = tap.kind === 'video' && frame.type === 'key';
    const backlog = ws.bufferedAmount;
    let send = true;
    if (tap.kind === 'audio') { if (backlog > HIGH_AUDIO) send = false; }
    else {
      if (backlog > HIGH_VIDEO) { tap.needKey = true; send = false; }
      else if (tap.needKey) { if (key) tap.needKey = false; else { send = false; const t = Date.now(); if (t - (tap.skrAt || 0) > TAP_KEY_MS) { tap.skrAt = t; try { const r = tap.t.sendKeyFrameRequest(); if (r && r.catch) r.catch(() => {}); } catch (err) {} } } }
    }
    if (send) {
      const d = new Uint8Array(frame.data), out = new Uint8Array(d.length + 4);
      out[0] = tap.kind === 'video' ? 1 : 2; out[1] = key ? 1 : 0; out[2] = (g >> 8) & 255; out[3] = g & 255; out.set(d, 4);
      try { ws.send(out); e.st.txBytes += out.length; if (tap.kind === 'video') e.st.txV++; else e.st.txA++; } catch (err) {}
    } else e.st.txDrop++;
  }
  return writer.write(frame);   // on to this end's own decoder, which otherwise asks for key frames without end
}
onrtctransform = (ev) => {
  const t = ev.transformer, o = t.options || {};
  const e = endOf(o.end);
  const reader = t.readable.getReader(), writer = t.writable.getWriter();
  let item;
  if (o.role === 'tap') { item = { t, kind: o.kind, needKey: false, on: true, skrAt: 0 }; e.taps.set(o.g, item); }
  else { item = pipeFor(e, o.g, o.kind); }
  (async () => {
    for (;;) {
      let r; try { r = await reader.read(); } catch (err) { break; }
      if (r.done) break;
      try {
        if (o.role === 'tap') await onTapFrame(e, o.g, item, r.value, writer);
        else await onPipeFrame(e, o.g, item, r.value, writer);
      } catch (err) {}
    }
    if (o.role === 'tap' && e.taps.get(o.g) === item) e.taps.delete(o.g);
  })();
};
onmessage = (ev) => {
  const m = ev.data, e = endOf(m.end);
  if (m.op === 'open') {
    try { if (e.ws) { e.ws.onclose = e.ws.onmessage = null; e.ws.close(); } } catch (err) {}
    let ws;
    try { ws = new WebSocket(m.url); } catch (err) { postMessage({ op: 'sock', end: m.end, ev: 'close', code: 0 }); return; }
    ws.binaryType = 'arraybuffer'; e.ws = ws;
    ws.onopen = () => { if (e.ws !== ws) return; ws.send('s' + JSON.stringify(Object.assign({ t: 'auth' }, m.auth))); postMessage({ op: 'sock', end: m.end, ev: 'open' }); };
    ws.onclose = (c) => { if (e.ws !== ws) return; e.ws = null; postMessage({ op: 'sock', end: m.end, ev: 'close', code: c.code }); };
    ws.onmessage = (x) => {
      if (e.ws !== ws) return;
      if (typeof x.data !== 'string') { onBinary(e, x.data); return; }
      const c0 = x.data.charCodeAt(0);
      if (c0 === 100 /* d */) postMessage({ op: 'dc', end: m.end, data: x.data.slice(1) });
      else if (c0 === 99 /* c */) {
        let c = null; try { c = JSON.parse(x.data.slice(1)); } catch (err) {}
        if (!c) return;
        if (c.t === 'key') { const tap = e.taps.get(c.g); if (tap && tap.t.sendKeyFrameRequest) { try { const r = tap.t.sendKeyFrameRequest(); if (r && r.catch) r.catch(() => {}); } catch (err) {} } return; }
        postMessage({ op: 'ctl', end: m.end, m: c });
      }
      else if (c0 === 115 /* s */) { let c = null; try { c = JSON.parse(x.data.slice(1)); } catch (err) {} if (c) postMessage({ op: 'sock', end: m.end, ev: 'server', m: c }); }
    };
  }
  else if (m.op === 'auth') sendText(e, 's' + JSON.stringify(Object.assign({ t: 'auth' }, m.auth)));
  else if (m.op === 'ctl') ctl(e, m.m);
  else if (m.op === 'dc') sendText(e, 'd' + m.data);
  else if (m.op === 'carrier') { const p = pipeFor(e, m.g, 'video'); try { p.cw = m.writable.getWriter(); } catch (err) { p.cw = null; } p.needKey = true; p.q.length = 0; }
  else if (m.op === 'unpipe') { e.pipes.delete(m.g); }
  else if (m.op === 'fresh') { e.taps.clear(); e.pipes.clear(); }   // this end's connection was rebuilt: its tracks are numbered anew
  else if (m.op === 'close') { try { if (e.ws) { e.ws.onclose = e.ws.onmessage = null; e.ws.close(); } } catch (err) {} ends.delete(m.end); }
  else if (m.op === 'stats') { const out = Object.assign({ backlog: e.ws ? e.ws.bufferedAmount : -1, taps: e.taps.size, pipes: e.pipes.size }, e.st); postMessage({ op: 'stats', end: m.end, id: m.id, st: out }); }
};
`;

  const supported = () => typeof RTCRtpScriptTransform !== 'undefined' && typeof Worker !== 'undefined'
    && typeof WebSocket !== 'undefined' && typeof RTCPeerConnection !== 'undefined';
  const videoOk = () => typeof MediaStreamTrackGenerator !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof VideoFrame !== 'undefined';

  let worker = null, endSeq = 0;
  const live = new Map();   // end id -> end
  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })));
    worker.onmessage = (ev) => { const m = ev.data, E = live.get(m.end); if (E) E._in(m); };
    return worker;
  }

  // The lines of one media section of a description.
  function sections(sdp) {
    const parts = String(sdp || '').split(/\r?\n(?=m=)/), out = [];
    for (let i = 1; i < parts.length; i++) {
      const s = parts[i], mid = (/^a=mid:(\S+)/m.exec(s) || [])[1], kind = (/^m=(\w+)/.exec(s) || [])[1];
      const dir = (/^a=(sendrecv|sendonly|recvonly|inactive)\s*$/m.exec(s) || [])[1] || 'sendrecv';
      const ms = /^a=msid:(\S+)(?: (\S+))?/m.exec(s);
      out.push({ mid, kind, dir, sid: ms ? ms[1] : '', tid: ms ? (ms[2] || '') : '', port0: /^m=\w+ 0 /.test(s) });
    }
    return out;
  }
  // The description this end hands its own side, with each sending section named as the far side named its track.
  function renameStreams(sdp, names) {
    const nl = sdp.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
    const parts = sdp.split(/\r?\n(?=m=)/);
    for (let i = 1; i < parts.length; i++) {
      const mid = (/^a=mid:(\S+)/m.exec(parts[i]) || [])[1], nm = names.get(mid);
      if (!nm) continue;
      parts[i] = parts[i].split(/\r?\n/).map((l) => {
        if (/^a=msid:/.test(l)) return 'a=msid:' + nm.sid + ' ' + nm.tid;
        const m = /^(a=ssrc:\d+ msid:)/.exec(l);
        return m ? m[1] + nm.sid + ' ' + nm.tid : l;
      }).join(nl);
    }
    return parts.join(nl);
  }

  // createEnd(o) → this page's end of one link's tunnel.
  // o = { url, auth: { u, c },          the WebSocket and the link's credential
  //       initiator,                    my side of the pair is the one that offers first
  //       toSignal(msg),                a first-contact signal for my side: { kind: 'offer' | 'answer' | 'ice', ... }
  //       toChannel(msg),               a negotiation message for my side, as it would arrive on the pair's channel
  //       dial(),                       ask my side to dial the pair now (it offers first)
  //       audioContext(),               the page's audio context (the silent template of an audio track)
  //       onState(state), log(line) }
  function createEnd(o) {
    const id = 't' + (++endSeq);
    const w = ensureWorker();
    const log = (s) => { try { if (o.log) o.log(s); } catch (e) {} };
    const E = { id, state: 'connecting', paired: false, farOpen: false, open: false, closed: false };
    let S = null, sdc = null, gen = 0;
    let chain = Promise.resolve();
    const run = (fn) => { chain = chain.then(fn).catch((e) => { log('tunnel step failed: ' + (e && e.name) + ' ' + String((e && e.message) || '').slice(0, 120)); }); return chain; };
    let farSends = [];                 // what the far side sends: [{ g, k, s, t }]
    let assigned = new Map();          // far g -> { tr, sid, tid, track }
    let mySends = '';                  // the last list I told the far end
    let own = null;                    // my offer to my side that is not answered yet: { oid, desc, at }
    let held = null;                   // my side's offer that arrived while mine was out
    let lastAnswered = null;           // { oid, answer }: the same offer again gets the same answer
    let dcQueue = [], farQueue = [], iceWait = [];
    let offerT = null, resendT = null, retryT = null, retryN = 0, statsSeq = 0;
    const statsWait = new Map();
    let audioSrc = null;

    const setState = (s) => { if (E.state === s) return; E.state = s; log('tunnel ' + s); try { if (o.onState) o.onState(s); } catch (e) {} };
    const post = (m, tr) => { m.end = id; try { tr ? w.postMessage(m, tr) : w.postMessage(m); } catch (e) {} };

    function silentTrack() {
      try {
        if (!audioSrc) {
          const ac = (o.audioContext && o.audioContext()) || new (root.AudioContext || root.webkitAudioContext)();
          const osc = ac.createOscillator(), g = ac.createGain(), dst = ac.createMediaStreamDestination();
          g.gain.value = 0.0001; osc.connect(g); g.connect(dst); osc.start();
          audioSrc = dst.stream.getAudioTracks()[0];
        }
        return audioSrc.clone();
      } catch (e) { return null; }
    }
    function carrierFor(f) {
      if (f.k === 'a') return silentTrack();
      if (!videoOk()) return null;
      const g = new MediaStreamTrackGenerator({ kind: 'video' });
      post({ op: 'carrier', g: f.g, writable: g.writable }, [g.writable]);
      return g;
    }
    function dropShadow(why) {
      gen++;
      iceWait = [];
      const old = S; S = null; sdc = null; E.open = false; own = null; held = null; lastAnswered = null;
      clearTimeout(offerT); clearTimeout(resendT); offerT = resendT = null;
      for (const a of assigned.values()) { try { if (a.track) a.track.stop(); } catch (e) {} }
      assigned = new Map(); mySends = ''; dcQueue = [];
      post({ op: 'fresh' });
      if (old) { try { old.close(); } catch (e) {} log('tunnel near end closed (' + why + ')'); }
    }
    function newShadow() {
      dropShadow('fresh');
      const my = gen;
      const pc = new RTCPeerConnection({ iceServers: [], bundlePolicy: 'max-bundle' });
      S = pc;
      pc.onicecandidate = (ev) => {
        if (S !== pc) return;
        const c = ev.candidate ? (ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate) : null;
        if (E.open) { if (c) o.toChannel({ k: 'sig', msg: { kind: 'ice', candidate: c } }); }
        else o.toSignal(c ? { kind: 'ice', candidate: c } : { kind: 'ice', end: true });
      };
      pc.ondatachannel = (ev) => { if (S === pc) wire(ev.channel, my); };
      pc.ontrack = (ev) => {
        if (S !== pc) return;
        const g = pc.getTransceivers().indexOf(ev.transceiver);
        if (g < 0 || ev.receiver.__tun) return;
        ev.receiver.__tun = true;
        try { ev.receiver.transform = new RTCRtpScriptTransform(w, { role: 'tap', end: id, g, kind: ev.track.kind }); } catch (e) { log('tunnel tap failed ' + (e && e.name)); }
      };
      pc.onconnectionstatechange = () => {
        if (S !== pc) return;
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') { dropShadow('my side ' + pc.connectionState); post({ op: 'ctl', m: { t: 'down' } }); }
      };
      return pc;
    }
    function wire(dc, my) {
      sdc = dc;
      dc.onopen = () => {
        if (gen !== my) return;
        E.open = true;
        post({ op: 'ctl', m: { t: 'open' } });
        flushFar();
        syncSends(); needOffer();
        if (E.farOpen) setState('up');
      };
      dc.onmessage = (ev) => {
        if (gen !== my || typeof ev.data !== 'string') return;
        if (E.farOpen && !dcQueue.length) post({ op: 'dc', data: ev.data }); else { dcQueue.push(ev.data); if (dcQueue.length > 4000) dcQueue.shift(); }
      };
      dc.onclose = () => { if (gen === my && S) { dropShadow('channel closed'); post({ op: 'ctl', m: { t: 'down' } }); } };
      if (dc.readyState === 'open') dc.onopen();
    }
    function flushOut() { if (!E.farOpen) return; const q = dcQueue; dcQueue = []; for (const d of q) post({ op: 'dc', data: d }); }
    function flushFar() { if (!sdc || sdc.readyState !== 'open') return; const q = farQueue; farQueue = []; for (const d of q) { try { sdc.send(d); } catch (e) {} } }

    // What my side sends, as my end sees it: every section my end receives on.
    function syncSends() {
      if (!S || !S.remoteDescription) return;
      const secs = sections(S.remoteDescription.sdp), trs = S.getTransceivers(), list = [];
      for (let g = 0; g < trs.length; g++) {
        const tr = trs[g], sec = secs.find((x) => x.mid != null && x.mid === tr.mid);
        if (!sec || sec.port0 || !sec.sid || sec.sid === '-') continue;
        if (sec.dir !== 'sendrecv' && sec.dir !== 'sendonly') continue;
        const cd = tr.currentDirection;
        if (cd && cd !== 'recvonly' && cd !== 'sendrecv') continue;
        list.push({ g, k: sec.kind === 'video' ? 'v' : 'a', s: sec.sid, t: sec.tid });
      }
      const txt = JSON.stringify(list);
      if (txt === mySends) return;
      mySends = txt;
      post({ op: 'ctl', m: { t: 'sends', v: list } });
    }
    // Give every track the far side sends a sender on my end. true: all placed; false: a new section is needed (an offer).
    function place(canAdd) {
      if (!S) return true;
      const want = new Map(); for (const f of farSends) want.set(f.g, f);
      for (const [g, a] of Array.from(assigned.entries())) {
        if (want.has(g) && want.get(g).s === a.sid && want.get(g).t === a.tid) continue;
        assigned.delete(g);
        try { a.tr.sender.replaceTrack(null); } catch (e) {}
        try { if (a.tr.direction === 'sendrecv') a.tr.direction = 'recvonly'; else if (a.tr.direction === 'sendonly') a.tr.direction = 'inactive'; } catch (e) {}
        try { if (a.track) a.track.stop(); } catch (e) {}
        post({ op: 'unpipe', g });
        E._dirty = true;
      }
      let all = true;
      const used = new Set(); for (const a of assigned.values()) used.add(a.tr);
      for (const f of farSends) {
        if (assigned.has(f.g)) continue;
        const kind = f.k === 'v' ? 'video' : 'audio';
        // Always a section of my end's own making: a sender on a section the other side created never runs its frames
        // through the page (measured: the frame hook of such a sender is not called), so nothing could be forwarded on it.
        if (!canAdd) { all = false; continue; }
        const track = carrierFor(f);
        if (!track) continue;   // this browser cannot carry that kind: the track is left out
        const tr = S.addTransceiver(track, { direction: 'sendrecv' });
        // My side may put a track of its own on this section later. A frame hook must be in place before the section is
        // first negotiated (set afterwards it is never called), so the receiving half is hooked now.
        try { const gi = S.getTransceivers().indexOf(tr); tr.receiver.__tun = true; tr.receiver.transform = new RTCRtpScriptTransform(w, { role: 'tap', end: id, g: gi, kind }); } catch (e) { log('tunnel tap failed ' + (e && e.name)); }
        try { tr.sender.transform = new RTCRtpScriptTransform(w, { role: 'pipe', end: id, g: f.g, kind }); } catch (e) { log('tunnel pipe failed ' + (e && e.name)); }
        used.add(tr);
        assigned.set(f.g, { tr, sid: f.s, tid: f.t || ('t' + f.g), track });
        E._dirty = true;
      }
      return all;
    }
    function named(desc) {
      const names = new Map();
      for (const a of assigned.values()) if (a.tr.mid != null) names.set(a.tr.mid, a);
      return { type: desc.type, sdp: renameStreams(desc.sdp, names) };
    }
    function needOffer() {
      if (!S || !E.open || E.closed) return;
      clearTimeout(offerT);
      offerT = setTimeout(() => run(makeOffer), TM.TUNNEL_OFFER_SETTLE_MS);
    }
    async function makeOffer() {
      const pc = S;
      if (!pc || !E.open || own) return;
      if (pc.signalingState !== 'stable') { needOffer(); return; }
      E._dirty = false;
      const all = place(true);
      if (!E._dirty && all) { syncSends(); return; }
      const offer = await pc.createOffer();
      if (S !== pc) return;
      if (pc.signalingState !== 'stable') { needOffer(); return; }
      await pc.setLocalDescription(offer);
      if (S !== pc) return;
      own = { oid: 'w' + Math.random().toString(36).slice(2, 10), desc: named(pc.localDescription) };
      E._dirty = false;
      const send = () => { if (S !== pc || !own) return; o.toChannel({ k: 'roffer', sdp: own.desc, oid: own.oid }); resendT = setTimeout(send, TM.TUNNEL_OFFER_RESEND_MS); };
      clearTimeout(resendT); send();
    }
    async function answerMine(m) {   // my side's offer, on the open channel
      const pc = S;
      if (!pc) return;
      if (lastAnswered && m.oid != null && lastAnswered.oid === m.oid) { o.toChannel({ k: 'ranswer', sdp: lastAnswered.answer, oid: m.oid }); return; }
      if (own) {
        if (!o.initiator) { held = m; return; }          // my side yields to an offer that crosses its own: mine stands
        clearTimeout(resendT); own = null;               // my side's offer stands: mine goes again after it
      }
      await pc.setRemoteDescription(m.sdp);              // (takes back my own unanswered offer, if one was out)
      if (S !== pc) return;
      place(false);
      await pc.setLocalDescription(await pc.createAnswer());
      if (S !== pc) return;
      const ans = named(pc.localDescription);
      lastAnswered = m.oid != null ? { oid: m.oid, answer: ans } : null;
      if (m.viaSig) o.toChannel({ k: 'sig', msg: { kind: 'answer', sdp: ans } });
      else o.toChannel(m.oid != null ? { k: 'ranswer', sdp: ans, oid: m.oid } : { k: 'ranswer', sdp: ans });
      syncSends(); needOffer();
    }
    async function answered(m) {     // my side's answer to my offer
      const pc = S;
      if (!pc || !own || (m.oid != null && m.oid !== own.oid) || pc.signalingState !== 'have-local-offer') return;
      clearTimeout(resendT);
      await pc.setRemoteDescription(m.sdp);
      own = null; held = null;       // an offer of my side that crossed mine was taken back by it; it offers again
      if (S !== pc) return;
      syncSends(); needOffer();
    }
    async function firstOffer() {    // my side answers: my end offers the channel
      const pc = newShadow();
      wire(pc.createDataChannel('gifos'), gen);
      await pc.setLocalDescription(await pc.createOffer());
      if (S !== pc) return;
      o.toSignal({ kind: 'offer', sdp: { type: 'offer', sdp: pc.localDescription.sdp } });
    }
    function hookup() {
      if (E.closed || !E.paired) return;
      setState('paired');
      E.farOpen = false;
      if (o.initiator) { dropShadow('paired'); try { o.dial(); } catch (e) {} }
      else run(firstOffer);
    }

    // My side's candidates wait until my end holds its description.
    async function addIce(pc, list) {
      if (!pc || pc !== S) return;
      for (const c of list) iceWait.push(c);
      if (!pc.remoteDescription) return;
      const q = iceWait; iceWait = [];
      for (const c of q) { try { await pc.addIceCandidate(c); } catch (e) {} }
    }

    // ---- from my side -----------------------------------------------------------
    E.signal = (msg) => {
      if (E.closed || !msg) return;
      if (msg.kind === 'offer') {
        run(async () => {
          if (!E.paired) return;      // no far end yet: the dial is asked for again when there is one
          const pc = newShadow();
          await pc.setRemoteDescription(msg.sdp);
          if (S !== pc) return;
          await pc.setLocalDescription(await pc.createAnswer());
          if (S !== pc) return;
          await addIce(pc, []);
          o.toSignal({ kind: 'answer', sdp: { type: 'answer', sdp: pc.localDescription.sdp } });
        });
      } else if (msg.kind === 'answer') {
        run(async () => { const pc = S; if (pc && pc.signalingState === 'have-local-offer') { await pc.setRemoteDescription(msg.sdp); await addIce(pc, []); } });
      } else if (msg.kind === 'ice') {
        const list = Array.isArray(msg.candidates) ? msg.candidates : (msg.candidate ? [msg.candidate] : []);
        run(() => addIce(S, list));
      }
    };
    // A message my side was about to put on the pair's channel: true when it was the tunnel's to take.
    E.channel = (m) => {
      if (E.closed || !m) return false;
      if (m.k === 'roffer') { run(() => answerMine(m)); return true; }
      if (m.k === 'ranswer') { run(() => answered(m)); return true; }
      if (m.k === 'sig' && m.msg && (m.msg.kind === 'ice' || m.msg.kind === 'offer' || m.msg.kind === 'answer')) {
        if (m.msg.kind === 'ice') E.signal(m.msg);
        else if (m.msg.kind === 'offer') run(() => answerMine({ sdp: m.msg.sdp, oid: null, viaSig: true }));
        else run(() => answered({ sdp: m.msg.sdp, oid: null }));
        return true;
      }
      return false;
    };
    E.auth = (auth) => { o.auth = auth.pool === 'paid' ? o.auth : auth; if (auth.pool === 'paid') E._paid = auth; post({ op: 'auth', auth }); };
    E.up = () => E.state === 'up';
    E.stats = () => new Promise((res) => { const n = ++statsSeq; statsWait.set(n, res); post({ op: 'stats', id: n }); setTimeout(() => { if (statsWait.delete(n)) res(null); }, TM.TUNNEL_STATS_WAIT_MS); });
    E.close = (why) => {
      if (E.closed) return;
      E.closed = true;
      clearTimeout(retryT);
      post({ op: 'ctl', m: { t: 'down' } });
      dropShadow(why || 'closed');
      post({ op: 'close' });
      live.delete(id);
      try { if (audioSrc) audioSrc.stop(); } catch (e) {}
      setState('closed');
    };

    // ---- from the worker ----------------------------------------------------------
    E._in = (m) => {
      if (E.closed) return;
      if (m.op === 'stats') { const r = statsWait.get(m.id); if (r) { statsWait.delete(m.id); r(m.st); } return; }
      if (m.op === 'sock') {
        if (m.ev === 'server') {
          if (m.m.t === 'paired') { retryN = 0; E.paired = true; if (E._paid) post({ op: 'auth', auth: E._paid }); hookup(); }
          else if (m.m.t === 'alone') { E.paired = false; E.farOpen = false; farSends = []; dropShadow('far end left'); setState('waiting'); }
          else if (m.m.t === 'ok') { if (!E.paired) setState('waiting'); }
          return;
        }
        if (m.ev === 'close') {
          E.paired = false; E.farOpen = false; farSends = [];
          dropShadow('socket closed ' + m.code);
          if (m.code === 4401 || m.code === 4403) { setState('refused'); return; }
          setState('connecting');
          const wait = Math.min(TM.TUNNEL_RETRY_MAX_MS, TM.TUNNEL_RETRY_BASE_MS * Math.pow(2, retryN++));
          retryT = setTimeout(() => { if (!E.closed) post({ op: 'open', url: o.url, auth: o.auth }); }, wait);
        }
        return;
      }
      if (m.op === 'dc') { if (sdc && sdc.readyState === 'open' && !farQueue.length) { try { sdc.send(m.data); } catch (e) {} } else { farQueue.push(m.data); if (farQueue.length > 4000) farQueue.shift(); } return; }
      if (m.op === 'ctl') {
        const c = m.m;
        if (c.t === 'open') { E.farOpen = true; flushOut(); if (mySends) { const v = mySends; mySends = ''; post({ op: 'ctl', m: { t: 'sends', v: JSON.parse(v) } }); mySends = v; } if (E.open) setState('up'); }
        else if (c.t === 'down') {      // the far side's connection ended: mine ends with it, and the pair forms again
          E.farOpen = false; farSends = [];
          const had = !!S; dropShadow('far side down');
          if (had && E.paired) { setState('paired'); if (!o.initiator) run(firstOffer); else { try { o.dial(); } catch (e) {} } }
        }
        else if (c.t === 'sends') { farSends = Array.isArray(c.v) ? c.v.filter((f) => f && Number.isInteger(f.g) && (f.k === 'a' || f.k === 'v') && typeof f.s === 'string').slice(0, 64) : []; needOffer(); }
      }
    };

    live.set(id, E);
    post({ op: 'open', url: o.url, auth: o.auth });
    return E;
  }

  const api = { supported, videoOk, createEnd, sections, renameStreams };
  GifOS.meetTunnel = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
