/*
 * meet-agent.js — window.gifosAgent v1: the meeting page's own API for AI agents.
 * Active under ?agent=1 (forced, cannot be untagged) or bot=1 (the lobby's "I'm an AI assistant" switch sets it).
 *
 * The page keeps every rule: this module only reads what the page already holds
 * and asks the page to act through the host it is given (run.html builds it).
 * Every action answers { ok: true, ... } or { ok: false, error: '<a sentence a
 * person can read>' }, as gifos.room does.
 *
 * Events (agent <- page): joined, progress, password, people, speaking, line,
 * stage, agenda, hand, video, app, host, left, mode, plus port traffic
 * (say.done, audio.in.frame, video.in.frame, port.closed).
 *
 * Events are found by looking, once per AGENT_TICK_MS, at the stores the page
 * already keeps (transcript, chat, statuses), so no hot path of the page calls
 * into this file. Nothing here opens a camera or a microphone by itself: the
 * agent's own say / audio.out / video.out calls are the only way in.
 *
 * Video is pulled on demand. With no video.in open the page asks every row mate
 * to park the camera it sends here (the 'vis' park the page already speaks), so
 * nothing is decoded; video.in.open lifts the park on that one link. Frames given
 * out pass through the same receiver-side blur the page draws on tiles.
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};
  const VERSION = 1;
  const KINDS = { speech: 1, chat: 1, spoken: 1, system: 1 };

  // ---- pure helpers (unit-tested) --------------------------------------------

  // How far to trust a line's words. Captions are self-reported, so a line is a claim:
  //   own        the speaker's own engine wrote it (or my own words), and my ears have not doubted it
  //   trusted    a source my page's caption trust has checked against its own ears (or my ears wrote it)
  //   unchecked  someone else's ears wrote it and my page has no verdict
  //   distrusted my page's ears found that source wrong
  // stateOf(voice, writer) is the page's capTrust.stateOf: 'trusted' | 'distrusted' | 'unknown'.
  function lineTrust(m, me, stateOf) {
    if (!m) return 'unchecked';
    const by = m.byId, w = m.w || m.byId;
    const st = typeof stateOf === 'function' ? (stateOf(by, w) || 'unknown') : 'unknown';
    if (by === me) return 'own';
    if (st === 'distrusted') return 'distrusted';
    if (w === me) return 'trusted';
    if (w === by) return st === 'trusted' ? 'trusted' : 'own';
    return st === 'trusted' ? 'trusted' : 'unchecked';
  }

  // Is a line addressed to this agent? Its name (the part before any "(owner's ...)"),
  // an @mention, a reply to one of my chat lines, or the room's wake words.
  const WAKE_RE = /^(?:hey |ok |hi |hello )?(?:bot|bart|bott|bots|assistant)\b/i;
  function shortName(name) { return String(name || '').replace(/\([^)]*\)\s*$/, '').trim(); }
  function toMe(line, me) {
    if (!line || !me) return false;
    if (line.byId && line.byId === me.id) return false;
    if (line.reply && (line.reply.byId === me.id || (me.chatIds && me.chatIds.has(line.reply.id)))) return true;
    const t = String(line.text || '');
    const n = shortName(me.name).toLowerCase();
    if (n.length >= 2) {
      const tl = t.toLowerCase();
      let at = tl.indexOf(n);
      while (at >= 0) {
        const pre = at === 0 ? '' : tl[at - 1], post = tl[at + n.length] || '';
        if (!/[\p{L}\p{N}]/u.test(pre) && !/[\p{L}\p{N}]/u.test(post)) return true;
        at = tl.indexOf(n, at + 1);
      }
    }
    return WAKE_RE.test(t.trim());
  }

  // One page store row -> one contract line.
  function normLine(kind, m, ctx) {
    const me = ctx.me || {};
    const mine = m.byId === me.id;
    const k = kind === 'speech' && mine && ctx.isBot ? 'spoken' : kind;
    const line = {
      seq: 0, ts: +m.at || 0, kind: KINDS[k] ? k : 'system', id: m.byId || '', name: String(m.by || ''),
      text: String(m.text || ''), final: true, mine: mine,
      src: kind === 'chat' ? 'chat' : (m.src || 'mic'), eng: m.eng || '', w: m.w || m.byId || '',
      trust: kind === 'chat' ? 'own' : lineTrust(m, me.id, ctx.stateOf),
      toMe: false, fromAdmin: !!(ctx.isAdmin && ctx.isAdmin(m.byId)),
    };
    if (m.reply) line.reply = { id: m.reply.id, by: m.reply.by };
    line.toMe = !mine && toMe({ byId: m.byId, text: line.text, reply: m.reply ? { id: m.reply.id, byId: m.reply.byId } : null }, me);
    return line;
  }

  // Should this page ask peer `pid` to park the camera it sends here?
  // ctx: { botView, watching:Set, recording, cell:{i}|null, hidden, floatPid }
  // A head (cell 0) or heir (cell 1) composes its row's faces, so it never parks for the
  // bot view: the room's picture must not depend on what an agent wants to see.
  function wantsPark(pid, ctx) {
    if (!ctx || ctx.recording) return false;
    if (ctx.hidden && pid !== ctx.floatPid) return true;
    if (!ctx.botView) return false;
    if (ctx.cell && (ctx.cell.i === 0 || ctx.cell.i === 1)) return false;
    return !(ctx.watching && ctx.watching.has(pid));
  }

  // The host room setting "AI notes". allowed (default) | ask | off. Open rooms have no host: allowed.
  function notesRule(setting, hostRoom, grantedToMe) {
    if (!hostRoom) return { ok: true };
    const s = setting === 'off' || setting === 'ask' ? setting : 'allowed';
    if (s === 'off') return { ok: false, error: 'The host has turned AI notes off in this meeting.' };
    if (s === 'ask' && !grantedToMe) return { ok: false, error: 'The host asks AI assistants to wait for an OK before taking notes. Ask the host to allow AI notes for you.' };
    return { ok: true };
  }

  const fail = (error) => ({ ok: false, error: String(error) });
  const ok = (x) => Object.assign({ ok: true }, x || {});
  const sig = (x) => { try { return JSON.stringify(x); } catch (e) { return String(Math.random()); } };

  function b64ToBytes(s) {
    const bin = atob(String(s || ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToB64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }

  // ---- the agent ---------------------------------------------------------------
  // host: the page's closures (run.html). T: { AGENT_TICK_MS, AGENT_VOICE_TAIL_MS }.
  function make(host) {
    const T = host.T || {};
    const handlers = new Map();
    const ports = new Map();
    const watching = new Map();   // pid -> count of open video.in ports on it
    const seenLines = new Set();
    const chatIds = new Set();
    let seq = 0, primed = false, tickT = null, active = false, lastSig = {}, joinedSent = false, leftSent = false;
    let notesSubscribed = false;
    let voice = null;             // { ctx, dest, track, sources:Set, sayId, interrupt, tailT, pcmAt, rate }
    let portSeq = 0;

    function emit(type, data) {
      for (const fn of Array.from(handlers.get(type) || [])) { try { fn(data); } catch (e) {} }
      for (const fn of Array.from(handlers.get('*') || [])) { try { fn({ type: type, data: data }); } catch (e) {} }
    }
    function on(type, fn) {
      if (typeof fn !== 'function') return () => {};
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      if (type === 'line' || type === '*') noteSubscribe();
      return () => off(type, fn);
    }
    function off(type, fn) { const s = handlers.get(type); if (s) s.delete(fn); }

    // Subscribing to lines or audio.in is taking notes: the agent's tile shows it from that moment.
    // The mark: 1 taking notes, 2 asks the host first (AI notes: ask), 0 none (AI notes off: nothing kept).
    let notesMark = -1;
    function noteSubscribe() { notesSubscribed = true; paintNotes(); }
    function paintNotes() {
      if (!notesSubscribed) return;
      const r = notesOk();
      const v = r.ok ? 1 : (host.aiNotes() === 'ask' ? 2 : 0);
      if (v === notesMark) return;
      notesMark = v;
      try { host.setNotesMark(v); } catch (e) {}
    }
    function notesOk() { try { return notesRule(host.aiNotes(), host.hostRoom(), host.notesGranted()); } catch (e) { return ok(); } }

    function me() { return { id: host.myId(), name: host.myName(), chatIds: chatIds }; }

    // ---- the look, once per tick -------------------------------------------------
    function changed(key, val) { const s = sig(val); if (lastSig[key] === s) return false; lastSig[key] = s; return true; }
    function lineCtx() { return { me: me(), isBot: host.isBot(), stateOf: host.capState, isAdmin: host.isAdminId }; }
    function scanLines(emitThem) {
      const ctx = lineCtx();
      const fresh = [];
      for (const m of host.chatLines()) {
        if (!m || !m.id || seenLines.has(m.id)) continue;
        seenLines.add(m.id);
        if (m.byId === ctx.me.id) chatIds.add(m.id);
        if (/^gb1 /.test(String(m.text || ''))) continue;   // a bot control line is not words
        fresh.push(normLine('chat', m, ctx));
      }
      for (const m of host.trLines()) {
        if (!m || !m.id || seenLines.has(m.id)) continue;
        seenLines.add(m.id);
        fresh.push(normLine('speech', m, ctx));
      }
      fresh.sort((a, b) => a.ts - b.ts);
      if (!emitThem) return;
      const rule = notesOk();
      for (const l of fresh) {
        l.seq = ++seq;
        // AI notes off (or ask, not yet allowed): the agent hears nothing of the room's words but its own.
        if (!rule.ok && !l.mine) continue;
        emit('line', l);
      }
    }
    function tick() {
      if (!active) return;
      let st;
      try { st = snapshot(); } catch (e) { return; }
      if (st.joined && !joinedSent) { joinedSent = true; emit('joined', { me: st.me, room: st.room, placement: 'seat' }); }
      if (st.progress && changed('progress', st.progress)) emit('progress', st.progress);
      if (st.password && changed('password', st.password)) emit('password', {});
      if (changed('people', st.people)) emit('people', st.people);
      const spk = host.speaking();
      for (const s of spk) if (changed('spk:' + s.id, !!s.on)) { emit('speaking', s); if (s.on && !s.bot && s.id !== st.me.id) bargeIn(); }
      for (const p of st.people) { const k = 'hand:' + p.id, had = k in lastSig; if (changed(k, !!p.hand) && had) emit('hand', { id: p.id, up: !!p.hand }); }
      if (changed('stage', st.stage)) emit('stage', st.stage);
      if (changed('agenda', st.agenda)) emit('agenda', st.agenda);
      if (changed('video', st.video)) emit('video', st.video);
      if (changed('app', st.app)) emit('app', st.app);
      if (changed('host', st.host)) { const h = st.host; if (h.muted || h.camOff || h.removed) emit('host', { action: h.removed ? 'remove' : h.muted ? 'mute' : 'camera-off', by: h.by || '' }); }
      // The first look takes what the page already held as history (the lines action reads it); later looks raise lines.
      scanLines(joinedSent && primed); if (joinedSent) primed = true;
      paintNotes();
      try { host.renderBotView(st); } catch (e) {}
      try { host.reaim(); } catch (e) {}   // the parks follow what is watched now
      if (st.left && !leftSent) { leftSent = true; emit('left', { reason: st.left }); stopAll(); }
    }
    function start() {
      if (active) return;
      active = true;
      tickT = setInterval(tick, T.AGENT_TICK_MS);
      tick();
    }
    function stop() { active = false; if (tickT) clearInterval(tickT); tickT = null; }

    function snapshot() {
      const s = host.state();
      s.version = VERSION;
      s.watching = Array.from(watching.keys());
      return s;
    }

    // ---- voice: say and audio.out share one track ---------------------------------
    function voiceOpen(rate) {
      if (voice && (!rate || voice.rate === rate)) return voice;
      if (voice) voiceClose();
      const Ctx = root.AudioContext || root.webkitAudioContext;
      if (!Ctx) return null;
      const ctx = rate ? new Ctx({ sampleRate: rate }) : new Ctx();
      const dest = ctx.createMediaStreamDestination();
      voice = { ctx: ctx, dest: dest, track: dest.stream.getAudioTracks()[0], sources: new Set(), rate: rate || ctx.sampleRate, pcmAt: 0, sayId: '', interrupt: 'never', tailT: null };
      try { if (ctx.resume) ctx.resume(); } catch (e) {}
      return voice;
    }
    function voiceLive() {
      if (!voice) return;
      clearTimeout(voice.tailT); voice.tailT = null;
      host.playVoice(voice.track);   // the page unmutes my senders only while I speak
    }
    function voiceIdleSoon() {
      if (!voice) return;
      clearTimeout(voice.tailT);
      voice.tailT = setTimeout(() => {
        if (!voice || voice.sources.size) return;
        host.playVoice(null);
        if (voice.sayId) { const id = voice.sayId; voice.sayId = ''; emit('say.done', { id: id, stopped: false }); }
      }, T.AGENT_VOICE_TAIL_MS);
    }
    function voiceStop(why) {
      if (!voice) return;
      for (const s of Array.from(voice.sources)) { try { s.stop(); } catch (e) {} }
      voice.sources.clear();
      voice.pcmAt = 0;
      clearTimeout(voice.tailT); voice.tailT = null;
      host.playVoice(null);
      if (voice.sayId) { const id = voice.sayId; voice.sayId = ''; emit('say.done', { id: id, stopped: why || 'stop' }); }
    }
    function voiceClose() { voiceStop('closed'); if (voice) { try { voice.ctx.close(); } catch (e) {} } voice = null; }
    function bargeIn() { if (voice && voice.sayId && voice.interrupt === 'stop') voiceStop('interrupted'); }
    function playBuffer(buf) {
      const v = voice;
      const src = v.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(v.dest);
      const at = Math.max(v.ctx.currentTime, v.pcmAt || 0);
      v.pcmAt = at + buf.duration;
      v.sources.add(src);
      src.onended = () => { v.sources.delete(src); if (!v.sources.size) voiceIdleSoon(); };
      voiceLive();
      src.start(at);
    }
    function hostVoiceGate() {
      if (host.hostMuted()) return fail('The host has muted you, so the agent cannot speak.');
      if (!host.joined()) return fail('Not in the meeting yet.');
      return null;
    }

    async function say(a) {
      const text = String((a && a.text) || '').replace(/\s+/g, ' ').trim();
      if (!text) return fail('Nothing to say.');
      const gate = hostVoiceGate(); if (gate) return gate;
      if (!a.wav) return fail('Say needs the speech audio (a WAV file): the agent SDK makes it with its text-to-speech.');
      const v = voiceOpen(0);
      if (!v) return fail('This browser cannot play the agent’s voice.');
      let buf;
      try {
        const bytes = a.wav instanceof ArrayBuffer ? a.wav : b64ToBytes(a.wav).buffer;
        buf = await v.ctx.decodeAudioData(bytes.slice(0));
      } catch (e) { return fail('That speech audio could not be read.'); }
      if (a.interrupt !== 'never') voiceStop('replaced');
      const id = 'say' + (++portSeq);
      v.sayId = id;
      v.interrupt = a.interrupt === 'never' ? 'never' : 'stop';
      playBuffer(buf);
      // The room's transcript gets the agent's words from the text: no speech-to-text of its own voice.
      try { host.writeSpoken(text); } catch (e) {}
      return ok({ id: id, ms: Math.round(buf.duration * 1000) });
    }

    // ---- ports -------------------------------------------------------------------
    function newPort(kind, extra) { const id = kind + ':' + (++portSeq); ports.set(id, Object.assign({ id: id, kind: kind }, extra || {})); return id; }
    function portOf(a, kind) { const p = a && ports.get(a.port); return p && p.kind === kind ? p : null; }
    function closePort(id, why) {
      const p = ports.get(id);
      if (!p) return false;
      ports.delete(id);
      try { if (p.close) p.close(); } catch (e) {}
      if (p.kind === 'video.in' && p.who) {
        const n = (watching.get(p.who) || 1) - 1;
        if (n > 0) watching.set(p.who, n); else watching.delete(p.who);
        try { host.reaim(); } catch (e) {}
      }
      emit('port.closed', { port: id, why: why || 'closed' });
      return true;
    }

    function audioOutOpen(a) {
      const rate = [16000, 24000, 48000].indexOf(+a.rate) >= 0 ? +a.rate : 24000;
      const gate = hostVoiceGate(); if (gate) return gate;
      const v = voiceOpen(rate);
      if (!v) return fail('This browser cannot play the agent’s voice.');
      return ok({ port: newPort('audio.out', { rate: rate }) });
    }
    function audioOutWrite(a) {
      const p = portOf(a, 'audio.out');
      if (!p) return fail('That audio port is closed.');
      const gate = hostVoiceGate(); if (gate) return gate;
      const v = voiceOpen(p.rate);
      const raw = a.pcm instanceof Int16Array ? a.pcm : new Int16Array(b64ToBytes(a.pcm).buffer);
      if (!raw.length) return ok();
      const buf = v.ctx.createBuffer(1, raw.length, p.rate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < raw.length; i++) ch[i] = raw[i] / 32768;
      playBuffer(buf);
      return ok();
    }

    // audio.in: the room as this page plays it (who:'room'), or one person where this page holds their own track.
    function audioInOpen(a) {
      const rule = notesOk(); if (!rule.ok) return rule;
      const rate = [16000, 24000, 48000].indexOf(+a.rate) >= 0 ? +a.rate : 16000;
      const who = a.who || 'room';
      const tracks = host.audioTracks(who);
      if (!tracks.length) return fail(who === 'room' ? 'No one is heard yet.' : 'This seat does not hold that person’s own voice; open who:"room".');
      const Ctx = root.AudioContext || root.webkitAudioContext;
      if (!Ctx) return fail('This browser cannot hear for the agent.');
      noteSubscribe();
      const ctx = new Ctx({ sampleRate: rate });
      const mixIn = ctx.createGain();
      const srcs = tracks.map((t) => { const s = ctx.createMediaStreamSource(new MediaStream([t])); s.connect(mixIn); return s; });
      const frame = Math.round(rate / 50);   // 20 ms of samples
      const proc = ctx.createScriptProcessor(1024, 1, 1);
      const sink = ctx.createGain(); sink.gain.value = 0;   // keeps the processor pulled, plays nothing
      let held = new Int16Array(0);
      const id = newPort('audio.in', { close: () => { try { proc.disconnect(); mixIn.disconnect(); srcs.forEach((s) => s.disconnect()); ctx.close(); } catch (e) {} } });
      proc.onaudioprocess = (e) => {
        const f = e.inputBuffer.getChannelData(0);
        const out = new Int16Array(held.length + f.length);
        out.set(held);
        for (let i = 0; i < f.length; i++) out[held.length + i] = Math.max(-32768, Math.min(32767, Math.round(f[i] * 32767)));
        let at = 0;
        for (; at + frame <= out.length; at += frame) {
          const pcm = out.subarray(at, at + frame);
          emit('audio.in.frame', { port: id, rate: rate, ts: Date.now(), pcm: bytesToB64(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)), samples: pcm });
        }
        held = out.slice(at);
      };
      mixIn.connect(proc); proc.connect(sink); sink.connect(ctx.destination);
      return ok({ port: id, rate: rate, who: who });
    }

    // video.in: one face (a row mate's own camera), the Stage, or the Stadium. Pulled on demand: opening
    // lifts this page's park on that link; closing parks it again. Frames are blurred here exactly as the
    // page blurs that tile (receiver side), whatever the sender did.
    function videoInOpen(a) {
      const who = a.who;
      if (!who) return fail('Say whose video: a person’s id, "stage" or "stadium".');
      const as = ['track', 'frames', 'jpeg', 'rgb'].indexOf(a.as) >= 0 ? a.as : 'jpeg';
      const src = host.videoSource(who);
      if (!src) return fail('That video is not reachable from this seat: watch the Stage, the Stadium, or a person in your row.');
      watching.set(src.pid || who, (watching.get(src.pid || who) || 0) + 1);
      try { host.reaim(); } catch (e) {}
      const fps = Math.max(0.2, Math.min(30, +a.fps || (as === 'track' ? 15 : 2)));
      const want = Math.max(16, Math.min(1920, +a.width || 384));
      const canvas = host.makeCanvas();
      const g = canvas.getContext('2d');
      let timer = null, sending = false, lastTrack = null;
      const id = newPort('video.in', { who: src.pid || who, close: () => { clearInterval(timer); if (lastTrack) { try { lastTrack.stop(); } catch (e) {} } } });
      function draw() {
        const s = host.videoSource(who);
        const el = s && s.el;
        if (!el || !(el.videoWidth > 0)) return null;
        const w = want, h = Math.max(2, Math.round(want * el.videoHeight / el.videoWidth));
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const frac = host.blurFrac(s.pid || who);
        if (frac > 0) host.blurDraw(g, el, 0, 0, w, h, frac); else g.drawImage(el, 0, 0, w, h);
        return { w: w, h: h, blurred: frac > 0 };
      }
      let info = { blurred: host.blurFrac(src.pid || who) > 0 };
      // The timer runs only while the port is open: no port, no draw, no copy.
      timer = setInterval(() => {
        if (!ports.has(id) || sending) return;
        const d = draw();
        if (!d) return;
        info = d;
        if (as === 'frames' && typeof root.VideoFrame === 'function') {
          const p = ports.get(id); if (p && p.onFrame) { const vf = new root.VideoFrame(canvas, { timestamp: Math.round(performance.now() * 1000) }); try { p.onFrame(vf, d); } catch (e) { try { vf.close(); } catch (x) {} } }
          return;
        }
        if (as === 'jpeg') {
          sending = true;
          canvas.toBlob((b) => {
            if (!b || !ports.has(id)) { sending = false; return; }
            b.arrayBuffer().then((ab) => { sending = false; emit('video.in.frame', { port: id, w: d.w, h: d.h, blurred: d.blurred, ts: Date.now(), jpeg: bytesToB64(new Uint8Array(ab)) }); }, () => { sending = false; });
          }, 'image/jpeg', 0.8);
        } else if (as === 'rgb') {
          const px = g.getImageData(0, 0, d.w, d.h).data;
          const rgb = new Uint8Array(d.w * d.h * 3);
          for (let i = 0, j = 0; i < px.length; i += 4) { rgb[j++] = px[i]; rgb[j++] = px[i + 1]; rgb[j++] = px[i + 2]; }
          emit('video.in.frame', { port: id, w: d.w, h: d.h, blurred: d.blurred, ts: Date.now(), rgb: bytesToB64(rgb) });
        }
      }, 1000 / fps);
      const out = { port: id, who: who, source: src.source, as: as, blurred: info.blurred };
      if (as === 'track' && canvas.captureStream) { const ms = canvas.captureStream(fps); lastTrack = ms.getVideoTracks()[0]; out.track = lastTrack; }
      if (as === 'frames') out.onFrame = (fn) => { const p = ports.get(id); if (p) p.onFrame = fn; };
      return ok(out);
    }

    // video.out: the agent's camera. A track, a canvas, or frames written in. The page treats it as a
    // camera: blurred by every receiver under the room's rules; the agent picks its own blur (Max by
    // default), and clear video still needs everyone's consent and a password, as for anyone.
    function videoOutOpen(a) {
      if (host.camForcedOff()) return fail('The host has turned your camera off.');
      if (!host.joined()) return fail('Not in the meeting yet.');
      for (const p of ports.values()) if (p.kind === 'video.out') closePort(p.id, 'replaced');
      const blur = a.blur === 0 || a.blur === 1 || a.blur === 2 ? a.blur : 2;
      let track = a.track || null, canvas = a.canvas || null, g = null;
      const fps = Math.max(1, Math.min(30, +a.fps || 15));
      if (!track) {
        if (!canvas) { canvas = host.makeCanvas(); canvas.width = Math.max(16, Math.min(1920, +a.width || 640)); canvas.height = Math.max(16, Math.min(1080, +a.height || 360)); }
        if (!canvas.captureStream) return fail('This browser cannot make a camera from a canvas.');
        track = canvas.captureStream(fps).getVideoTracks()[0];
        g = canvas.getContext('2d');
      }
      const r = host.setCamera(track, blur);
      if (!r || r.ok === false) { try { if (!a.track) track.stop(); } catch (e) {} return r || fail('The camera could not start.'); }
      const id = newPort('video.out', { canvas: canvas, g: g, close: () => { host.setCamera(null); if (!a.track) { try { track.stop(); } catch (e) {} } } });
      return ok({ port: id, blur: blur, width: canvas ? canvas.width : 0, height: canvas ? canvas.height : 0 });
    }
    async function videoOutWrite(a) {
      const p = portOf(a, 'video.out');
      if (!p || !p.g) return fail('That camera port takes no frames (it was opened with a track).');
      const c = p.canvas;
      if (a.jpeg) {
        const blob = new Blob([b64ToBytes(a.jpeg)], { type: 'image/jpeg' });
        let bmp; try { bmp = await createImageBitmap(blob); } catch (e) { return fail('That frame is not a JPEG.'); }
        p.g.drawImage(bmp, 0, 0, c.width, c.height);
        try { bmp.close(); } catch (e) {}
        return ok();
      }
      if (a.rgba) {
        const w = +a.w, h = +a.h, px = b64ToBytes(a.rgba);
        if (!(w > 0 && h > 0) || px.length !== w * h * 4) return fail('An RGBA frame needs w*h*4 bytes.');
        const img = new ImageData(new Uint8ClampedArray(px.buffer), w, h);
        if (w === c.width && h === c.height) p.g.putImageData(img, 0, 0);
        else { const bmp = await createImageBitmap(img); p.g.drawImage(bmp, 0, 0, c.width, c.height); try { bmp.close(); } catch (e) {} }
        return ok();
      }
      return fail('Write a JPEG or an RGBA frame.');
    }

    // ---- actions -----------------------------------------------------------------
    const actions = {
      state: () => ok({ state: snapshot() }),
      people: () => ok({ people: host.state().people }),
      // What this seat may do: the signed line items it holds now (GifOS.rights(): plain JSON; label is display only).
      rights: async () => ok({ rights: typeof GifOS.rights === 'function' ? await GifOS.rights() : null }),
      // Use a credentials GIF (a subscription file or a pass) in this seat: {gif_b64}. Then rights() reads what it grants.
      credentials: async (a) => {
        const M = GifOS.meetSubs;
        if (!M || typeof M.useFile !== 'function') return fail('This page takes no credentials file (it has no subscription code).');
        let bytes; try { bytes = Uint8Array.from(root.atob(String((a && a.gif_b64) || '')), (c) => c.charCodeAt(0)); } catch (e) { return fail('That is not a file in base64.'); }
        let st; try { st = await M.useFile(bytes); } catch (e) { return fail(String((e && e.message) || e)); }
        return ok({ took: st && st.took ? st.took : null, rights: typeof GifOS.rights === 'function' ? await GifOS.rights() : null });
      },
      lines: (a) => {
        // Lines so far (the transcript and chat this page holds), for an agent that joins late or polls.
        const rule = notesOk(); if (!rule.ok) return rule;
        noteSubscribe();
        const ctx = lineCtx();
        const all = [];
        for (const m of host.chatLines()) if (m && m.id && !/^gb1 /.test(String(m.text || ''))) all.push(normLine('chat', m, ctx));
        for (const m of host.trLines()) if (m && m.id) all.push(normLine('speech', m, ctx));
        all.sort((x, y) => x.ts - y.ts);
        const since = +(a && a.since) || 0;
        return ok({ lines: all.filter((l) => l.ts > since).slice(-500) });
      },
      say: say,
      'say.stop': () => { voiceStop('stop'); return ok(); },
      chat: (a) => host.chat(String((a && a.text) || '')),
      hand: (a) => host.hand(!!(a && a.up)),
      mic: (a) => host.mic(!!(a && a.on)),
      'stage.ask': () => host.stage(true),
      'stage.leave': () => host.stage(false),
      'app.run': (a) => host.appRun(a && a.id),
      'app.stop': () => host.appStop(),
      'app.room': (a) => host.appRoom(a && a.op, a && a.args),
      'app.data': (a) => (host.appData ? host.appData(a && a.op, a && a.collection, a && a.key, a && a.value) : fail('This page has no app data road.')),
      'agenda.next': () => host.agendaNext(),
      // The room features a guard bot uses, as one action: { op, args } -> { ok, v } (the agenda, an app, the Stage, host
      // sign-in, guard.*). The same ops and answers as the browser Meeting Bot's (gifos-mcp-core src/room.js), on the
      // meeting's own state, so a seat with no browser can do them. op lists them: host.roomOps.
      room: (a) => {
        if (typeof host.roomOp !== 'function') return fail('This page has no room actions.');
        const op = String((a && a.op) || '');
        if ((host.roomOps || []).indexOf(op) < 0) return fail('Unknown room op.');
        return host.roomOp(op, (a && a.args) || {});
      },
      'agenda.set': (a) => host.agendaSet(a && a.items),
      profile: (a) => host.profile(a || {}),
      leave: () => { stopAll(); return host.leave(); },
      'audio.out.open': audioOutOpen,
      'audio.out.write': audioOutWrite,
      'audio.out.clear': (a) => { if (!portOf(a, 'audio.out')) return fail('That audio port is closed.'); voiceStop('cleared'); return ok(); },
      'audio.out.close': (a) => { if (!portOf(a, 'audio.out')) return fail('That audio port is closed.'); closePort(a.port); voiceStop('closed'); return ok(); },
      'audio.in.open': audioInOpen,
      'audio.in.close': (a) => closePort(a && a.port) ? ok() : fail('That port is closed.'),
      'video.in.open': videoInOpen,
      'video.in.close': (a) => closePort(a && a.port) ? ok() : fail('That port is closed.'),
      'video.out.open': videoOutOpen,
      'video.out.write': videoOutWrite,
      'video.out.close': (a) => closePort(a && a.port) ? ok() : fail('That port is closed.'),
    };
    async function call(name, args) {
      const fn = actions[name];
      if (!fn) return fail('No such action: ' + name + '.');
      // Back in the normal view the agent's open ports keep running, so closing or feeding them still works.
      if (!active && name !== 'state' && !/\.(close|write|clear)$|^say\.stop$/.test(name)) return fail('Agent mode is off on this page.');
      try { const r = await fn(args || {}); return r && typeof r === 'object' && 'ok' in r ? r : ok(r); }
      catch (e) { return fail((e && e.message) || e); }
    }
    function stopAll() {
      for (const id of Array.from(ports.keys())) closePort(id, 'left');
      voiceClose();
    }

    const api = {
      version: VERSION,
      on: on, off: off, call: call,
      state: () => snapshot(),
      people: () => host.state().people,
      rights: () => call('rights'),
      credentials: (gifB64) => call('credentials', { gif_b64: gifB64 }),
      lines: (a) => call('lines', a),
      say: (text, o) => call('say', Object.assign({ text: text }, o || {})),
      chat: (text) => call('chat', { text: text }),
      hand: (up) => call('hand', { up: up !== false }),
      mic: (on2) => call('mic', { on: on2 }),
      stage: { ask: () => call('stage.ask'), leave: () => call('stage.leave') },
      app: { run: (id) => call('app.run', { id: id }), stop: () => call('app.stop'), room: (op, args) => call('app.room', { op: op, args: args }),
        data: (op, collection, key, value) => call('app.data', { op: op, collection: collection, key: key, value: value }) },
      agenda: { next: () => call('agenda.next'), set: (items) => call('agenda.set', { items: items }) },
      room: (op, args) => call('room', { op: op, args: args }),
      profile: (p) => call('profile', p),
      leave: () => call('leave'),
      audio: {
        out: { open: async (o) => { const r = await call('audio.out.open', o); if (!r.ok) return r; const port = r.port; return ok({ port: port, write: (pcm) => call('audio.out.write', { port: port, pcm: pcm }), clear: () => call('audio.out.clear', { port: port }), close: () => call('audio.out.close', { port: port }) }); } },
        in: { open: (o) => call('audio.in.open', o), close: (port) => call('audio.in.close', { port: port }) },
      },
      video: {
        in: { open: (o) => call('video.in.open', o), close: (port) => call('video.in.close', { port: port }) },
        out: { open: (o) => call('video.out.open', o), write: (port, f) => call('video.out.write', Object.assign({ port: port }, f)), close: (port) => call('video.out.close', { port: port }) },
      },
    };
    return {
      api: api,
      start: start, stop: stop, tick: tick,
      isActive: () => active,
      watching: () => new Set(watching.keys()),
      emit: emit,
      // test seams
      _ports: ports,
    };
  }

  // postMessage: a parent (an embedder) or an opener drives the same contract. Requests come as
  // { gifosAgent: 1, id, call, args }; answers go back to that window and origin only. A window
  // that sent { gifosAgent: 1, call: 'subscribe' } gets every event as { gifosAgent: 1, event }.
  function postMessageBridge(agent, win) {
    const subs = [];
    win.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || d.gifosAgent !== 1 || !e.source || (e.source !== win.parent && e.source !== win.opener) || e.source === win) return;
      const reply = (msg) => { try { e.source.postMessage(Object.assign({ gifosAgent: 1 }, msg), e.origin === 'null' ? '*' : e.origin); } catch (x) {} };
      if (d.call === 'subscribe') {
        if (!subs.some((s) => s.src === e.source)) subs.push({ src: e.source, origin: e.origin });
        reply({ id: d.id, result: { ok: true, version: VERSION } });
        return;
      }
      agent.api.call(String(d.call || ''), d.args || {}).then((result) => {
        if (result && result.track) delete result.track;   // a live track cannot cross windows
        reply({ id: d.id, result: result });
      });
    });
    agent.api.on('*', (ev) => {
      for (const s of subs) {
        const data = ev.data && ev.data.samples ? Object.assign({}, ev.data, { samples: undefined }) : ev.data;
        try { s.src.postMessage({ gifosAgent: 1, event: { type: ev.type, data: data } }, s.origin === 'null' ? '*' : s.origin); } catch (x) {}
      }
    });
  }

  // ---- the bot-mode view: text first, for machines -----------------------------------
  // Rebuilds only what changed. words(key, en) is the page's uiText.
  function renderBotView(rootEl, st, words) {
    if (!rootEl) return;
    const doc = rootEl.ownerDocument;
    const put = (sel, s) => { const el = rootEl.querySelector(sel); if (el && el.textContent !== s) el.textContent = s; };
    put('[data-agent="bot-status"]', st.status || '');
    put('[data-agent="bot-version"]', 'gifosAgent v' + VERSION);
    const tbody = rootEl.querySelector('[data-agent="bot-people"] tbody');
    if (tbody) {
      const yes = words('botYes', 'yes');
      const rowsSig = sig(st.people);
      if (tbody.dataset.sig !== rowsSig) {
        tbody.dataset.sig = rowsSig;
        tbody.textContent = '';
        for (const p of st.people) {
          const tr = doc.createElement('tr');
          tr.dataset.id = p.id;
          for (const v of [p.name + (p.me ? ' (' + words('botYou', 'you') + ')' : ''), p.bot ? yes : '', p.admin ? yes : '', p.muted ? yes : '', p.hand ? yes : '', p.speaking ? yes : '', p.onStage ? yes : '']) {
            const td = doc.createElement('td'); td.textContent = v; tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
      }
    }
    const list = (sel, rows) => {
      const ol = rootEl.querySelector(sel);
      if (!ol) return;
      const have = ol.children.length;
      if (have > rows.length) { ol.textContent = ''; }
      for (let i = ol.children.length; i < rows.length; i++) {
        const li = doc.createElement('li');
        li.textContent = rows[i].name + ': ' + rows[i].text;
        ol.appendChild(li);
      }
    };
    list('[data-agent="bot-transcript"]', st.transcript || []);
    list('[data-agent="bot-chat"]', st.chat || []);
    const js = rootEl.querySelector('#gifos-agent-state');
    if (js) {
      const body = JSON.stringify({ version: VERSION, me: st.me, room: st.room, joined: st.joined, people: st.people, stage: st.stage, agenda: st.agenda, app: st.app, video: st.video, botView: true });
      if (js.textContent !== body) js.textContent = body;
    }
    const hand = rootEl.querySelector('[data-agent="bot-hand"]');
    if (hand) { const up = !!(st.me && st.me.hand); const t = up ? words('botLowerHand', 'Lower hand') : words('botRaiseHand', 'Raise hand'); if (hand.textContent !== t) hand.textContent = t; hand.setAttribute('aria-pressed', up ? 'true' : 'false'); }
  }

  GifOS.meetAgent = { VERSION: VERSION, make: make, lineTrust: lineTrust, toMe: toMe, normLine: normLine, wantsPark: wantsPark, notesRule: notesRule, postMessageBridge: postMessageBridge, renderBotView: renderBotView, shortName: shortName };
})(typeof window !== 'undefined' ? window : globalThis);
