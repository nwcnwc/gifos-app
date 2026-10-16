/*
 * meet-host.js — N meeting sessions on one GifOS page.
 *
 * A store app cannot hold a meeting: its frame has no WebRTC, no network and
 * no workers. The host page (this origin) already knows how. Each session is
 * one ordinary run.html document in a same-origin iframe. The host page's
 * frame-src is about: only, so the session is srcdoc, not a navigation, and
 * the app sandbox is unchanged. The document stamps window.__gifosMb.
 *
 * The iframe stays a couple of pixels in the viewport so the browser does not
 * freeze its timers, and it is not sandboxed. A session frame does not start
 * further sessions: its map stays empty and it only answers its parent.
 */
(function (root) {
  var NS = 'gifos-meet';
  var sessions = new Map();
  var seq = 0;
  var appWin = null;
  var remoteOk = true;

  function postApp(event) {
    if (!appWin) return;
    try { appWin.postMessage({ ns: 'gifos', type: 'meet-event', event: event }, '*'); } catch (e) {}
  }

  var sessionDoc = null;
  function sessionHtml() {
    if (sessionDoc) return sessionDoc;
    sessionDoc = fetch('run.html', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('Could not load the meeting page.');
      return r.text();
    }).then(function (html) {
      var mark = '<head>';
      var at = html.indexOf(mark);
      if (at < 0) throw new Error('Meeting page has no head.');
      return html.slice(0, at) + '<head><script>window.__gifosMb="1";</script>' + html.slice(at + mark.length);
    });
    return sessionDoc;
  }

  function drop(id) {
    var sess = sessions.get(id);
    if (!sess) return;
    sessions.delete(id);
    if (sess.onMsg) root.removeEventListener('message', sess.onMsg);
    if (sess.timer) clearTimeout(sess.timer);
    try { sess.iframe.remove(); } catch (e) {}
  }

  function join(opts) {
    opts = opts || {};
    var id = 'mt_' + (++seq);
    return new Promise(function (resolve, reject) {
      var iframe = root.document.createElement('iframe');
      iframe.setAttribute('data-gifos-meet', id);
      iframe.setAttribute('title', 'Meeting session');
      iframe.setAttribute('allow', 'microphone; camera; autoplay');
      var x = (seq % 8) * 3;
      iframe.style.cssText = 'position:fixed;left:' + x + 'px;bottom:0;width:2px;height:2px;border:0;opacity:0.02;pointer-events:none;z-index:1';
      var sess = {
        id: id, iframe: iframe, control: !!opts.control, bot: opts.bot !== false,
        ready: false, joined: false, wait: new Map(), link: '', room: ''
      };
      sessions.set(id, sess);
      sess.timer = setTimeout(function () {
        if (!sess.joined) { drop(id); reject(new Error('Meeting session did not start.')); }
      }, 20000);
      sess.onMsg = function (e) {
        if (!iframe.contentWindow || e.source !== iframe.contentWindow) return;
        var d = e.data;
        if (!d || d.ns !== NS) return;
        if (d.op === 'ready' && !sess.ready) {
          sess.ready = true;
          iframe.contentWindow.postMessage({
            ns: NS, op: 'join', id: id,
            room: opts.room || '', link: opts.link || '', password: opts.password || '',
            name: opts.name || '', bot: sess.bot, control: sess.control,
            stt: sttHeld || ''
          }, '*');
          return;
        }
        if (d.op === 'joined' && !sess.joined) {
          sess.joined = true;
          if (sess.timer) { clearTimeout(sess.timer); sess.timer = null; }
          sess.room = d.room || '';
          sess.link = d.link || '';
          resolve({ meetingId: id, room: sess.room, link: sess.link });
          return;
        }
        if (d.op === 'error') {
          var w = d.ref && sess.wait.get(d.ref);
          if (w) { sess.wait.delete(d.ref); w.reject(new Error(d.error || 'meet error')); }
          else if (!sess.joined) { drop(id); reject(new Error(d.error || 'Could not join.')); }
          return;
        }
        if (d.op === 'result') {
          var pending = d.ref && sess.wait.get(d.ref);
          if (pending) { sess.wait.delete(d.ref); pending.resolve(d.result); }
          return;
        }
        if (d.op === 'event') {
          var ev = Object.assign({}, d.event || {});
          ev.meetingId = id;
          if (ev.type === 'chat') ev.control = !!(sess.control && remoteOk);
          if (ev.type === 'transcript' && suppressTranscript(ev.line || ev)) return;
          postApp(ev);
        }
      };
      root.addEventListener('message', sess.onMsg);
      root.document.body.appendChild(iframe);
      sessionHtml().then(function (html) {
        if (!sessions.has(id)) return;
        iframe.srcdoc = html;
      }, function (err) {
        if (!sess.joined) { drop(id); reject(err); }
      });
    });
  }

  function call(id, op, extra) {
    var sess = sessions.get(id);
    if (!sess || !sess.iframe || !sess.iframe.contentWindow) return Promise.reject(new Error('No such meeting.'));
    var ref = 'c' + Math.random().toString(36).slice(2);
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { sess.wait.delete(ref); reject(new Error('Meeting call timed out.')); }, 30000);
      sess.wait.set(ref, {
        resolve: function (r) { clearTimeout(t); resolve(r); },
        reject: function (e) { clearTimeout(t); reject(e); }
      });
      try {
        sess.iframe.contentWindow.postMessage(Object.assign({ ns: NS, op: op, ref: ref, id: id }, extra || {}), '*');
      } catch (e) {
        clearTimeout(t); sess.wait.delete(ref); reject(e);
      }
    });
  }

  var xferDone = new Set();
  var xferBags = new Map();

  // Voice settings live on this page. The app frame cannot fetch, so the key
  // and the stand-in URLs stay here. Replies and events never carry them.
  var sttHeld = '';
  var secrets = [];
  var spoken = [];
  var speechId = '';
  var voice = null;

  function normLine(t) {
    return String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }
  function rememberSpoken(text) {
    var t = String(text || '').trim();
    if (!t) return;
    spoken.push(t);
    if (spoken.length > 20) spoken.splice(0, spoken.length - 20);
  }
  function noteSecrets(settings) {
    if (!settings) return;
    if (settings.llm && settings.llm.key) secrets.push(String(settings.llm.key));
    if (settings.tts && settings.tts.url) secrets.push(String(settings.tts.url));
    if (settings.stt && settings.stt.url) secrets.push(String(settings.stt.url));
    if (secrets.length > 8) secrets.splice(0, secrets.length - 8);
  }
  function scrub(text) {
    var s = String(text == null ? '' : text);
    for (var i = 0; i < secrets.length; i++) {
      if (secrets[i]) s = s.split(secrets[i]).join('[redacted]');
    }
    return s;
  }
  function scrubValue(v) {
    if (typeof v === 'string') return scrub(v);
    if (Array.isArray(v)) return v.map(scrubValue);
    if (v && typeof v === 'object') {
      if (typeof ArrayBuffer !== 'undefined' && (v instanceof ArrayBuffer || ArrayBuffer.isView(v))) return v;
      var out = {};
      for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) out[k] = scrubValue(v[k]);
      return out;
    }
    return v;
  }
  // A bot's own microphone is never a transcript line. A line that repeats
  // one of the last 20 things the bot spoke is the same voice, whoever it
  // was attributed to.
  function suppressBotLine(bot, text, forId, myId, recent) {
    if (!bot) return false;
    if (!forId || forId === myId) return true;
    var n = normLine(text);
    if (!n) return false;
    var list = recent || [];
    for (var i = 0; i < list.length; i++) if (normLine(list[i]) === n) return true;
    return false;
  }
  function suppressTranscript(line) {
    if (!line) return false;
    if (line.self || line.bot || line.me) return true;
    var n = normLine(line.text);
    if (!n) return false;
    for (var i = 0; i < spoken.length; i++) if (normLine(spoken[i]) === n) return true;
    return false;
  }
  function hostFetch(url, opts) {
    var init = Object.assign({}, opts || {}, { redirect: 'error', credentials: 'omit' });
    if (typeof root.fetch !== 'function') return Promise.reject(new Error('This page cannot reach the network.'));
    return root.fetch(url, init);
  }
  function kokoro(req) {
    var g = root.GifOS && root.GifOS.providers;
    if (!g || typeof g.call !== 'function' || !g.assigned || !g.assigned('tts')) {
      return Promise.reject(new Error('Kokoro is not available on this computer.'));
    }
    return g.call('tts', {
      text: req && req.text || '',
      voice: (req && req.voice) || 'af_heart',
      app: (req && req.app) || 'offline-tts-kokoro'
    });
  }
  function playSession(id, audio, clause) {
    if (!id) return Promise.reject(new Error('No meeting to speak in.'));
    rememberSpoken(clause);
    var bytes = audio && (audio.bytes != null ? audio.bytes : audio);
    var mime = (audio && audio.mime) || 'audio/wav';
    return call(id, 'playMic', { bytes: bytes, mime: mime, text: clause == null ? '' : String(clause) });
  }
  function stopSession(id) {
    if (!id || !sessions.has(id)) return Promise.resolve();
    return call(id, 'stopMic', {}).then(function () {}, function () {});
  }
  function engine() {
    if (voice) return voice;
    if (!root.HostVoice || typeof root.HostVoice.create !== 'function') return null;
    voice = root.HostVoice.create({
      fetch: hostFetch,
      tts: kokoro,
      play: function (audio, clause) { return playSession(speechId, audio, clause); },
      stop: function () { return stopSession(speechId); },
      grok: function (text) {
        rememberSpoken(text);
        return call(speechId, 'speakText', { text: text == null ? '' : String(text) }).then(function (r) {
          if (!r || r.spoken === false) throw new Error('Grok Voice is not available on this meeting page.');
          return r;
        });
      }
    });
    return voice;
  }
  function needVoice() {
    var eng = engine();
    if (!eng) return Promise.reject(new Error('Voice is not available on this page.'));
    return eng;
  }
  function pushStt(id) {
    if (!sessions.has(id)) return Promise.resolve();
    return call(id, 'setStt', { url: sttHeld }).then(function () {}, function () {});
  }
  function applyVoice(eng, settings) {
    var pub;
    try { pub = eng.setVoice(settings || {}); }
    catch (e) { return Promise.reject(new Error(scrub(e && e.message || e))); }
    pub = scrubValue(pub);
    if (settings && Object.prototype.hasOwnProperty.call(settings, 'stt')) {
      sttHeld = settings.stt && settings.stt.url ? String(settings.stt.url) : '';
      var ids = Array.from(sessions.keys());
      var chain = Promise.resolve();
      ids.forEach(function (sid) {
        chain = chain.then(function () { return pushStt(sid); });
      });
      return chain.then(function () { return pub; });
    }
    return Promise.resolve(pub);
  }

  root.GifOS = root.GifOS || {};
  root.GifOS.meetHost = {
    join: join,
    leave: function (id) {
      return call(id, 'leave').then(function (r) { drop(id); return r; }, function (e) { drop(id); throw e; });
    },
    startRecording: function (id) { return call(id, 'startRecording'); },
    stopRecording: function (id) { return call(id, 'stopRecording'); },
    getRecording: function (id) { return call(id, 'getRecording'); },
    sendChat: function (id, text) { return call(id, 'sendChat', { text: text == null ? '' : String(text) }); },
    setTranscribe: function (id, on) { return call(id, 'transcribe', { on: !!on }); },
    sendXfer: function (id, xfer) { return call(id, 'sendXfer', { xfer: xfer || {} }); },
    list: function () {
      return Array.from(sessions.values()).map(function (s) {
        return { meetingId: s.id, room: s.room || '', link: s.link || '', control: !!s.control, bot: !!s.bot };
      });
    },
    setControl: function (id) {
      sessions.forEach(function (s) { s.control = s.id === id; });
    },
    setRemoteAllowed: function (on) { remoteOk = !!on; },
    scrub: scrub,
    scrubValue: scrubValue,
    suppressBotLine: suppressBotLine,
    setVoice: function (settings) {
      noteSecrets(settings);
      var eng;
      try { eng = needVoice(); }
      catch (e) { return Promise.reject(new Error(scrub(e && e.message || e))); }
      if (eng && typeof eng.then === 'function') {
        return eng.then(function (ready) { return applyVoice(ready, settings); }, function (e) {
          return Promise.reject(new Error(scrub(e && e.message || e)));
        });
      }
      return applyVoice(eng, settings);
    },
    interject: function (id, text) {
      if (!sessions.has(id)) return Promise.reject(new Error('No such meeting.'));
      var line = String(text == null ? '' : text).trim();
      if (!line) return Promise.reject(new Error('Nothing to say.'));
      if (line.length > 2000) line = line.slice(0, 2000);
      speechId = id;
      rememberSpoken(line);
      var eng;
      try { eng = needVoice(); }
      catch (e) { return Promise.reject(new Error(scrub(e && e.message || e))); }
      var run = function (ready) {
        return ready.interject(line).then(function (r) {
          if (r && r.text) rememberSpoken(r.text);
          return { id: id, spoken: !!(r && r.spoken), stopped: !!(r && r.stopped), text: (r && r.text) || line };
        });
      };
      if (eng && typeof eng.then === 'function') return eng.then(run).catch(function (e) { throw new Error(scrub(e && e.message || e)); });
      return run(eng).catch(function (e) { throw new Error(scrub(e && e.message || e)); });
    },
    converse: function (id, prompt) {
      if (!sessions.has(id)) return Promise.reject(new Error('No such meeting.'));
      prompt = prompt || {};
      var text = (prompt.by ? String(prompt.by) + ': ' : '') + String(prompt.text || '');
      speechId = id;
      var eng;
      try { eng = needVoice(); }
      catch (e) { return Promise.reject(new Error(scrub(e && e.message || e))); }
      var run = function (ready) {
        return ready.converse(text).then(function (r) {
          if (r && r.text) rememberSpoken(r.text);
          return r || { spoken: false };
        });
      };
      if (eng && typeof eng.then === 'function') return eng.then(run).catch(function (e) { throw new Error(scrub(e && e.message || e)); });
      return run(eng).catch(function (e) { throw new Error(scrub(e && e.message || e)); });
    },
    stopSpeaking: function (id) {
      var target = id || speechId;
      speechId = target;
      var eng = engine();
      var stop = eng ? eng.interrupt() : Promise.resolve();
      return Promise.resolve(stop).then(function () {
        return target ? stopSession(target) : null;
      }).then(function () { return { id: target || '', stopped: true }; });
    },
    raiseHand: function (id, on) { return call(id, 'raiseHand', { on: !!on }); },
    setMic: function (id, on) { return call(id, 'setMic', { on: !!on }); },
    setCamera: function (id, on) { return call(id, 'setCamera', { on: !!on }); },
    meetingState: function (id) { return call(id, 'meetingState', {}); },
    snapshot: function (id) { return call(id, 'snapshot', {}); },
    onApp: function (win) { appWin = win || null; },
    clearApp: function () { appWin = null; },
    leaveAll: function () {
      var ids = Array.from(sessions.keys());
      return Promise.all(ids.map(function (id) {
        return call(id, 'leave').then(function () { drop(id); }, function () { drop(id); });
      }));
    }
  };

  // Child side. The parent installs nothing here; run.html calls install()
  // only when the hash says this document is a session.
  root.GifOS.meetSession = {
    install: function (ops) {
      if (root.__gifosMeetSessOn) return;
      root.__gifosMeetSessOn = true;
      ops = ops || {};
      root.addEventListener('message', function (e) {
        if (e.source !== root.parent) return;
        var d = e.data;
        if (!d || d.ns !== NS || typeof d.op !== 'string') return;
        var fn = ops[d.op];
        var reply = function (op, extra) {
          try { root.parent.postMessage(Object.assign({ ns: NS, op: op, ref: d.ref || '' }, extra || {}), '*'); } catch (err) {}
        };
        if (typeof fn !== 'function') { reply('error', { error: 'Unknown session op.' }); return; }
        Promise.resolve().then(function () { return fn(d); }).then(function (result) {
          if (d.op === 'join') reply('joined', result || {});
          else reply('result', { result: result });
        }, function (err) {
          reply('error', { error: String(err && err.message || err) });
        });
      });
      try { root.parent.postMessage({ ns: NS, op: 'ready' }, '*'); } catch (e) {}
    },
    emit: function (event) {
      try { root.parent.postMessage({ ns: NS, op: 'event', event: event }, '*'); } catch (e) {}
    },
    // Reassemble a data-channel transfer. Callers send ordered chunks; a
    // repeat of a finished id is ignored so a second path cannot double-fire.
    takeXfer: function (m, emit) {
      if (!m || typeof m.id !== 'string' || xferDone.has(m.id)) return;
      var n = m.n | 0;
      if (n < 1 || n > 8000) return;
      var i = m.i | 0;
      if (i < 0 || i >= n || typeof m.b64 !== 'string') return;
      var bag = xferBags.get(m.id);
      if (!bag) {
        bag = { n: n, parts: new Array(n), got: 0, name: m.name || 'download', mime: m.mime || 'application/octet-stream' };
        xferBags.set(m.id, bag);
      }
      if (bag.parts[i] == null) { bag.parts[i] = m.b64; bag.got++; }
      if (bag.got < bag.n) return;
      var chunks = [];
      var total = 0;
      for (var p = 0; p < bag.n; p++) {
        var bin = '';
        try { bin = atob(bag.parts[p] || ''); } catch (e) { bin = ''; }
        var u = new Uint8Array(bin.length);
        for (var j = 0; j < bin.length; j++) u[j] = bin.charCodeAt(j);
        chunks.push(u);
        total += u.length;
      }
      var out = new Uint8Array(total);
      var o = 0;
      for (var c = 0; c < chunks.length; c++) { out.set(chunks[c], o); o += chunks[c].length; }
      xferBags.delete(m.id);
      xferDone.add(m.id);
      if (xferDone.size > 200) xferDone.clear();
      if (typeof emit === 'function') emit({ type: 'xfer', id: m.id, name: bag.name, mime: bag.mime, bytes: out.buffer });
    }
  };
})(window);
