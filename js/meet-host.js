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
    try { if (sess.eye && sess.eye.parentNode) sess.eye.parentNode.removeChild(sess.eye); } catch (e) {}
  }

  function eyeOf(sess) {
    if (sess.eye) return sess.eye;
    var box = root.document.createElement('section');
    box.setAttribute('data-gifos-bot-eye', sess.id);
    box.style.cssText = 'position:fixed;right:16px;bottom:16px;width:380px;z-index:40;background:#161622;color:#eceef8;border:1px solid #2c2c44;border-radius:12px;overflow:hidden;font:14px/1.4 system-ui,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.5)';
    var head = root.document.createElement('div');
    head.textContent = "Through the bot's eyes";
    head.style.cssText = 'padding:10px 12px 0;font-weight:700';
    var note = root.document.createElement('div');
    note.textContent = 'Watch and listen only';
    note.style.cssText = 'padding:2px 12px 8px;color:#a8adc4;font-size:12px';
    var stage = root.document.createElement('div');
    stage.style.cssText = 'height:220px;background:#0e0e16';
    box.appendChild(head);
    box.appendChild(note);
    box.appendChild(stage);
    sess.eye = box;
    sess.eyeStage = stage;
    return box;
  }

  function placeIdle(iframe) {
    var x = (seq % 8) * 3;
    iframe.style.cssText = 'position:fixed;left:' + x + 'px;bottom:0;width:2px;height:2px;border:0;opacity:0.02;pointer-events:none;z-index:1';
  }

  // The session frame stays in its original parent. Moving an iframe reloads
  // it and drops the meeting. The tile is chrome around a hole, and the frame
  // is only restyled so it covers that hole.
  function placeEye(sess) {
    var frame = sess.iframe;
    var stage = sess.eyeStage;
    var rect = stage && stage.getBoundingClientRect ? stage.getBoundingClientRect() : null;
    if (rect && rect.width) {
      frame.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + rect.top + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px;border:0;opacity:1;pointer-events:none;z-index:41';
    } else {
      frame.style.cssText = 'position:fixed;right:16px;bottom:16px;width:380px;height:220px;border:0;opacity:1;pointer-events:none;z-index:41';
    }
    frame.setAttribute('title', "Meeting through the bot's eyes");
    if (frame.dataset) frame.dataset.eye = '1';
  }

  function syncEyes() {
    sessions.forEach(function (sess) {
      if (!sess.iframe || !sess.eye || !sess.eye.parentNode) return;
      if (!sess.iframe.dataset || sess.iframe.dataset.eye !== '1') return;
      placeEye(sess);
    });
  }
  root.addEventListener('resize', syncEyes);

  function setWatch(id, on) {
    var sess = sessions.get(id);
    if (!sess || !sess.iframe) return Promise.reject(new Error('No such meeting.'));
    var frame = sess.iframe;
    if (on) {
      var box = eyeOf(sess);
      if (!box.parentNode) root.document.body.appendChild(box);
      placeEye(sess);
    } else {
      placeIdle(frame);
      if (frame.dataset) frame.dataset.eye = '0';
      if (sess.eye && sess.eye.parentNode) sess.eye.parentNode.removeChild(sess.eye);
    }
    return call(id, 'watch', { on: !!on }).then(function () {
      return { id: id, watch: !!on, eyes: true };
    }, function () {
      return { id: id, watch: !!on, eyes: true };
    });
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
            name: opts.name || '', bot: sess.bot, control: sess.control
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

  function normLine(t) {
    return String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }
  // A bot's own microphone is never a transcript line. A line that repeats
  // one of the last things the bot spoke is the same voice, whoever it was
  // attributed to. The host still forwards a transcript the session already
  // emitted: the app made that audio and may want the line.
  function suppressBotLine(bot, text, forId, myId, recent) {
    if (!bot) return false;
    if (!forId || forId === myId) return true;
    var n = normLine(text);
    if (!n) return false;
    var list = recent || [];
    for (var i = 0; i < list.length; i++) if (normLine(list[i]) === n) return true;
    return false;
  }
  // Whisper writes silence and room noise as the captions it saw most in
  // training: "you", "you you", "Thank you.", "Thanks for watching!". A line
  // made only of those is not a line. A lowercase "you" after a finished
  // sentence ("Okay. you") is the same noise on the end of a real line.
  // -> the line to keep, or '' for none.
  var WHISPER_SILENCE = /^(?:(?:you )*you|thank you|thanks for watching|thank you for watching)$/;
  function dropWhisperNoise(text) {
    var t = String(text || '').replace(/\[[^\]]*\]|\([^)]*\)|[♪♫*]/g, ' ').replace(/\s+/g, ' ').trim()
      .replace(/([.!?])(?:\s+you)+\s*$/, '$1');
    var n = normLine(t);
    if (!n || WHISPER_SILENCE.test(n)) return '';
    var words = n.split(' ');
    if (words.length && words.every(function (w) { return w === 'you' || w === 'thank'; })) return '';
    return t;
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
    raiseHand: function (id, on) { return call(id, 'raiseHand', { on: !!on }); },
    setMic: function (id, on) { return call(id, 'setMic', { on: !!on }); },
    setCamera: function (id, on) { return call(id, 'setCamera', { on: !!on }); },
    speak: function (id, audio) {
      audio = audio || {};
      return call(id, 'speak', {
        bytes: audio.bytes || null,
        mime: audio.mime ? String(audio.mime) : '',
        text: audio.text == null ? '' : String(audio.text),
        filler: !!audio.filler
      });
    },
    stopSpeaking: function (id) { return call(id, 'stopSpeaking'); },
    thinking: function (id, on) { return call(id, 'thinking', { on: !!on }); },
    watch: function (id, on) { return setWatch(id, !!on); },
    meetingState: function (id) { return call(id, 'meetingState', {}); },
    snapshot: function (id) { return call(id, 'snapshot', {}); },
    suppressBotLine: suppressBotLine,
    dropWhisperNoise: dropWhisperNoise,
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
