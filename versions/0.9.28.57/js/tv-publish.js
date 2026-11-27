/*
 * GifOS: "Publish to GifOS.tv" on the broadcast page (cast.html; meet.html loads it too and it stays idle there). Copyright (c) 2026 Crowd Concepts, Inc.
 * All rights reserved.
 *
 * gifos.tv is the public directory of live GifOS broadcasts. A hosted room's admin presses "Publish to GifOS.tv" in
 * the Stream link card, fills in a public title, a public description and a thumbnail (an upload, or a still taken
 * from the Stage), and confirms. The page then, with each step shown as it happens:
 *   1. makes the thumbnail: a 640x360 JPEG drawn on a canvas on this device (so nothing but pixels leaves it);
 *   2. earns a proof-of-work token from gifos.tv (the same person check as joining a room);
 *   3. signs the thumbnail, the listing and the "on air" note with the room's admin key (the key never leaves this
 *      device; gifos.tv checks that the key's hash is the room's verifier, so only the room's admins can list it);
 *   4. uploads the thumbnail, publishes the listing, goes on air;
 *   5. reads the listing back from gifos.tv to check that it shows live.
 * It ends with "Listed on gifos.tv" and the listing's link, and the button reads "Listed: stop listing".
 *
 * ONLY A ROOM THIS DEVICE LISTED EVER TALKS TO GIFOS.TV. "Listed" is remembered on this device per room
 * (localStorage gifos_tv:<room>); until the admin presses Publish, and after they stop listing, this file makes no
 * request of any kind. While the admin of a listed room is in it, the page sends:
 *   - an "on air" note when it joins (signed, with proof of work);
 *   - a signed keep-alive every period gifos.tv names in its answer (3 minutes): a listing shows live only while its
 *     keep-alive is fresh, so a page that crashes drops off by itself within minutes;
 *   - an "off air" note when it leaves (signed in advance with each keep-alive, so it can go out as the page closes).
 * Passwords, the room key, chat and media never go to gifos.tv: only the room's name and verifier (which the listing
 * page needs to show the embed), the public title, description, thumbnail and optional tip address.
 *
 *   GifOS.tvPublish.paint(ctx)   the view calls it on each paint of the Stream link card. ctx:
 *     show()        is this the admin of a hosted room, on the broadcast page, with the card up
 *     admin()       does this page hold the room's admin key right now
 *     inMeeting()   is this page in the meeting
 *     room()        the room's name; roomKey() "<name>.<verifier>"
 *     sign(act, x)  Promise<{sp, sig, pub}>: an order signed with the room's admin key
 *     text(k, en)   a translated string (English fallback)
 *     hasPassword() does the room have a password now (prefills "Password needed"; the password never leaves)
 */
(function (root) {
  'use strict';
  var GifOS = root.GifOS = root.GifOS || {};
  if (GifOS.tvPublish) return;

  var API = String(root.GIFOS_TV_API || 'https://gifos.tv').replace(/\/+$/, '');
  var TITLE_MAX = 80, DESC_MAX = 500, THUMB_W = 640, THUMB_H = 360, THUMB_MAX = 240 * 1024;
  var ctx = null, onAirFor = '', keepTimer = 0, keepDue = 0, offNote = null, busy = false, dlg = null, ticket = null;
  var dev = Array.from(root.crypto.getRandomValues(new Uint8Array(6))).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');

  function T(k, en) { try { return (ctx && ctx.text && ctx.text(k, en)) || en; } catch (e) { return en; } }
  function storeKey() { return 'gifos_tv:' + ctx.roomKey(); }
  function listed() {
    try { var v = JSON.parse(root.localStorage.getItem(storeKey()) || 'null'); return v && v.url ? v : null; } catch (e) { return null; }
  }
  function setListed(v) {
    try { if (v) root.localStorage.setItem(storeKey(), JSON.stringify(v)); else root.localStorage.removeItem(storeKey()); } catch (e) {}
  }
  function hosted() {
    var rk = ctx && ctx.roomKey && ctx.roomKey();
    return !!(rk && /^[a-z0-9-]{1,64}\.[a-f0-9]{24,64}$/.test(rk));
  }

  // ---- the wire ----------------------------------------------------------------
  function tokenFor() {
    if (!ticket) ticket = GifOS.net.relayTicket({ relayBase: API + '/api', sid: 'tv' });
    return ticket.prepare(dev).then(function () { return ticket.token(dev); });
  }
  function postOrder(w, withToken) {
    return (withToken ? tokenFor() : Promise.resolve('')).then(function (jt) {
      return root.fetch(API + '/api/order', { method: 'POST', credentials: 'omit', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ w: w, jt: jt || undefined }) });
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; return j; }); });
  }
  function sha256hex(buf) {
    return root.crypto.subtle.digest('SHA-256', buf).then(function (d) { return Array.from(new Uint8Array(d)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''); });
  }

  // ---- on air, keep-alive, off air (listed rooms only) -----------------------------
  function signOff() {
    return ctx.sign('tvair', { on: 0 }).then(function (w) { offNote = w; }).catch(function () {});
  }
  function sendOff(beacon) {
    var w = offNote; offNote = null;
    stopKeep();
    if (!w) return;
    var body = JSON.stringify({ w: w });
    try {
      if (beacon && root.navigator.sendBeacon) { root.navigator.sendBeacon(API + '/api/order', new Blob([body], { type: 'text/plain' })); return; }
    } catch (e) {}
    try { root.fetch(API + '/api/order', { method: 'POST', credentials: 'omit', keepalive: true, headers: { 'content-type': 'text/plain' }, body: body }).catch(function () {}); } catch (e) {}
  }
  function stopKeep() { if (keepTimer) clearTimeout(keepTimer); keepTimer = 0; keepDue = 0; onAirFor = ''; }
  function schedule(ms) {
    if (keepTimer) clearTimeout(keepTimer);
    var wait = Math.max(30000, Number(ms) || 0);   // gifos.tv names the period; never faster than every 30 s
    keepDue = Date.now() + wait;
    keepTimer = setTimeout(keepAlive, wait);
  }
  function goOnAir() {
    var rk = ctx.roomKey();
    onAirFor = rk;
    return ctx.sign('tvair', { on: 1 }).then(function (w) {
      return postOrder(w, true);
    }).then(function (j) {
      if (onAirFor !== rk) return j;
      if (j.status === 403 && j.pow && ticket) { ticket.drop(); onAirFor = ''; return j; }
      if (j.status === 404) { setListed(null); stopKeep(); paint(); return j; }   // no longer listed (stopped elsewhere)
      if (!j.ok) { onAirFor = ''; return j; }
      if (j.delisted) { var l = listed(); if (l) { l.delisted = true; setListed(l); } }
      schedule(j.next);
      return signOff().then(function () { return j; });
    }).catch(function (e) { onAirFor = ''; return { ok: false, error: String(e && e.message || e) }; });
  }
  function keepAlive() {
    keepTimer = 0;
    if (!ctx || !listed() || !ctx.inMeeting() || !ctx.admin()) { if (onAirFor) sendOff(false); return; }
    ctx.sign('tvkeep', {}).then(function (w) { return postOrder(w, false); }).then(function (j) {
      if (j.ok) { schedule(j.next); return signOff(); }
      if (j.status === 404) { onAirFor = ''; return goOnAir(); }   // the listing went off air (an off note, or it lapsed): say on air again
      schedule(60000);
    }).catch(function () { schedule(60000); });
  }
  function tick() {
    // Called on every paint: start or stop the on-air cycle for a listed room. Nothing at all for an unlisted one.
    if (!ctx || busy) return;
    var on = hosted() && !!listed() && ctx.inMeeting() && ctx.admin();
    if (on && onAirFor !== ctx.roomKey()) goOnAir();
    else if (!on && onAirFor) sendOff(false);
    else if (on && keepDue && Date.now() > keepDue + 5000) keepAlive();   // a timer the browser held back (a background tab)
  }
  root.addEventListener('pagehide', function () { if (onAirFor) sendOff(true); });
  root.document.addEventListener('visibilitychange', function () { if (!root.document.hidden) tick(); });

  // ---- the thumbnail ----------------------------------------------------------------
  function drawCover(src, sw, sh) {
    var c = root.document.createElement('canvas');
    c.width = THUMB_W; c.height = THUMB_H;
    var g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, THUMB_W, THUMB_H);
    var s = Math.max(THUMB_W / sw, THUMB_H / sh), w = sw * s, h = sh * s;
    g.drawImage(src, (THUMB_W - w) / 2, (THUMB_H - h) / 2, w, h);
    return c;
  }
  function toJpeg(canvas) {
    var q = [0.85, 0.75, 0.6, 0.45];
    function at(i) {
      return new Promise(function (res) { canvas.toBlob(res, 'image/jpeg', q[i]); }).then(function (b) {
        if (!b) throw new Error(T('tvPicFail', 'This browser could not make the picture.'));
        return b.size <= THUMB_MAX || i === q.length - 1 ? b : at(i + 1);
      });
    }
    return at(0);
  }
  function stageVideo() {
    var best = null, area = 0;
    Array.prototype.forEach.call(root.document.querySelectorAll('video'), function (v) {
      if (!v.videoWidth || v.readyState < 2) return;
      var r = v.getBoundingClientRect(), a = r.width * r.height;
      if (a > area) { area = a; best = v; }
    });
    return best;
  }

  // ---- the dialog --------------------------------------------------------------------
  var CSS = '' +
    '#tv-pub{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:16px;box-sizing:border-box}' +
    '#tv-pub .tvp{background:var(--c-white,#fff);color:var(--c-ink,#111);border-radius:16px;width:100%;max-width:520px;max-height:100%;display:flex;flex-direction:column;box-shadow:0 16px 40px rgba(0,0,0,.4);overflow:hidden;font-size:.95rem}' +
    '#tv-pub header,#tv-pub footer{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:12px 16px;background:inherit}' +
    '#tv-pub header{border-bottom:1px solid rgba(0,0,0,.08)}#tv-pub footer{border-top:1px solid rgba(0,0,0,.08);justify-content:flex-end;flex-wrap:wrap}' +
    '#tv-pub header h2{margin:0;font-size:1.05rem;flex:1}' +
    '#tv-pub .body{flex:1 1 auto;overflow:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px}' +
    '#tv-pub label{display:flex;flex-direction:column;gap:4px;font-weight:600;font-size:.85rem}' +
    '#tv-pub input[type=text],#tv-pub textarea{font:inherit;font-weight:400;border:1.5px solid var(--c-gray,#bbb);border-radius:10px;padding:8px 10px;color:inherit;background:inherit;box-sizing:border-box;width:100%}' +
    '#tv-pub textarea{min-height:72px;resize:vertical}' +
    '#tv-pub label.chk{flex-direction:row;align-items:flex-start;gap:8px;font-weight:400}#tv-pub label.chk input{margin-top:3px;width:18px;height:18px;flex:0 0 auto}' +
    '#tv-pub .cnt{font-weight:400;opacity:.6;font-size:.75rem;align-self:flex-end}' +
    '#tv-pub .thumb{position:relative;width:100%;aspect-ratio:16/9;background:#111;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:.85rem}' +
    '#tv-pub .thumb canvas{width:100%;height:100%;display:block}' +
    '#tv-pub .row{display:flex;gap:8px;flex-wrap:wrap}' +
    '#tv-pub button{font:inherit;min-height:44px;border-radius:12px;border:none;padding:0 16px;font-weight:700;cursor:pointer;background:var(--c-gray-l,#e8e8ee);color:inherit}' +
    '#tv-pub button.go{background:var(--c-blue,#2a5bd7);color:#fff}#tv-pub button.stop{background:#b3261e;color:#fff}' +
    '#tv-pub button:disabled{opacity:.5;cursor:default}' +
    '#tv-pub .note{font-size:.8rem;opacity:.75;margin:0}' +
    '#tv-pub ol.steps{margin:0;padding-left:22px;display:flex;flex-direction:column;gap:4px}' +
    '#tv-pub ol.steps li{opacity:.45}#tv-pub ol.steps li.now{opacity:1;font-weight:700}#tv-pub ol.steps li.done{opacity:1}' +
    '#tv-pub ol.steps li.done::after{content:" \\2713";color:#1b873f}#tv-pub ol.steps li.bad{opacity:1;color:#b3261e}' +
    '#tv-pub .err{color:#b3261e;font-weight:600;margin:0}' +
    '#tv-pub .ok{font-weight:700;font-size:1.05rem;margin:0}#tv-pub a{color:var(--c-blue,#2a5bd7);word-break:break-all}' +
    '#bc-tv{background:transparent !important;color:var(--c-blue,#2a5bd7) !important;border:1.5px solid currentColor !important;white-space:nowrap}' +
    '#bc-tv.listed{color:#1b873f !important}' +
    '@media (prefers-color-scheme:dark){#tv-pub .tvp{background:#1c1c22;color:#eee}#tv-pub header,#tv-pub footer{border-color:rgba(255,255,255,.1)}#tv-pub button{background:#2c2c36}}';
  function el(tag, attrs, kids) {
    var e = root.document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'cls') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (k) { if (k) e.appendChild(k); });
    return e;
  }
  function close() { if (dlg) { dlg.remove(); dlg = null; } busy = false; paint(); }
  function openDialog() {
    if (dlg) return;
    if (!root.document.getElementById('tv-pub-css')) root.document.head.appendChild(el('style', { id: 'tv-pub-css', text: CSS }));
    var l = listed();
    var closeBtn = el('button', { type: 'button', text: T('tvClose', 'Close') });
    var box = el('div', { cls: 'tvp', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tv-pub-h' });
    dlg = el('div', { id: 'tv-pub' }, [box]);
    closeBtn.onclick = function () { if (!busy) close(); };
    dlg.addEventListener('click', function (e) { if (e.target === dlg && !busy) close(); });
    box.appendChild(el('header', {}, [el('h2', { id: 'tv-pub-h', text: T('tvPublishTitle', 'Publish to GifOS.tv') }), closeBtn]));
    var body = el('div', { cls: 'body' }); box.appendChild(body);
    var foot = el('footer'); box.appendChild(foot);
    root.document.body.appendChild(dlg);
    if (l) return showListed(body, foot, l);
    showForm(body, foot);
  }
  function showListed(body, foot, l) {
    body.textContent = ''; foot.textContent = '';
    body.appendChild(el('p', { cls: 'ok', text: T('tvListedOn', 'Listed on gifos.tv') }));
    var a = el('a', { href: l.url, target: '_blank', rel: 'noopener', text: l.url });
    body.appendChild(el('p', {}, [a]));
    body.appendChild(el('p', { cls: 'note', text: l.delisted ? T('tvDelisted', 'GifOS has removed this listing after a report. It is not shown on gifos.tv.') : T('tvListedNote', 'It shows on gifos.tv while you are here. When you leave, it goes off air.') }));
    var stop = el('button', { type: 'button', cls: 'stop', text: T('tvStop', 'Stop listing') });
    stop.onclick = function () { doStop(body, foot, stop); };
    foot.appendChild(stop);
    var done = el('button', { type: 'button', cls: 'go', text: T('tvDone', 'Done') });
    done.onclick = close;
    foot.appendChild(done);
  }
  function showForm(body, foot) {
    body.textContent = ''; foot.textContent = '';
    var title = el('input', { type: 'text', maxlength: String(TITLE_MAX), autocomplete: 'off', id: 'tv-title' });
    title.value = (ctx.room() || '').replace(/-/g, ' ').slice(0, TITLE_MAX);
    var desc = el('textarea', { maxlength: String(DESC_MAX), id: 'tv-desc' });
    var tip = el('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: '0x…', id: 'tv-tip' });
    var pw = el('input', { type: 'checkbox', id: 'tv-pw' });
    try { pw.checked = !!(ctx.hasPassword && ctx.hasPassword()); } catch (e) {}
    var cnt = el('span', { cls: 'cnt', text: '0/' + DESC_MAX });
    desc.oninput = function () { cnt.textContent = desc.value.length + '/' + DESC_MAX; };
    var thumbBox = el('div', { cls: 'thumb', text: T('tvNoPic', 'No picture yet') });
    var canvas = null;
    function setCanvas(c) { canvas = c; thumbBox.textContent = ''; thumbBox.appendChild(c); }
    var file = el('input', { type: 'file', accept: 'image/*', style: 'display:none', id: 'tv-file' });
    file.onchange = function () {
      var f = file.files && file.files[0]; if (!f) return;
      var img = new Image(), u = URL.createObjectURL(f);
      img.onload = function () { setCanvas(drawCover(img, img.naturalWidth, img.naturalHeight)); URL.revokeObjectURL(u); };
      img.onerror = function () { URL.revokeObjectURL(u); err.textContent = T('tvPicBad', 'That file is not a picture this browser can read.'); };
      img.src = u;
    };
    var up = el('button', { type: 'button', text: T('tvUpload', 'Upload a picture'), id: 'tv-up' });
    up.onclick = function () { file.click(); };
    var snap = el('button', { type: 'button', text: T('tvFromStage', 'Take it from the Stage'), id: 'tv-snap' });
    snap.onclick = function () {
      var v = stageVideo();
      if (!v) { err.textContent = T('tvNoStage', 'Nothing is showing on the Stage yet.'); return; }
      try { setCanvas(drawCover(v, v.videoWidth, v.videoHeight)); err.textContent = ''; } catch (e) { err.textContent = T('tvPicFail', 'This browser could not make the picture.'); }
    };
    var err = el('p', { cls: 'err', role: 'alert' });
    body.appendChild(el('label', {}, [document.createTextNode(T('tvFTitle', 'Public title')), title]));
    body.appendChild(el('label', {}, [document.createTextNode(T('tvFDesc', 'Public description')), desc, cnt]));
    body.appendChild(el('div', { cls: 'thumbwrap' }, [el('label', { text: T('tvFPic', 'Thumbnail') }), thumbBox]));
    body.appendChild(el('div', { cls: 'row' }, [up, snap, file]));
    body.appendChild(el('label', { cls: 'chk' }, [pw, document.createTextNode(T('tvFPw', 'Password needed to watch (shown as a badge; put the password in the description or give it out yourself)'))]));
    body.appendChild(el('label', {}, [document.createTextNode(T('tvFTip', 'Base address for tips (optional, public; not shown yet)')), tip]));
    body.appendChild(el('p', { cls: 'note', text: T('tvFNote', 'Everything here is public. Your room password is never listed: a room with a password still asks for it.') }));
    body.appendChild(err);
    var go = el('button', { type: 'button', cls: 'go', text: T('tvPublish', 'Publish'), id: 'tv-go' });
    foot.appendChild(go);
    go.onclick = function () {
      err.textContent = '';
      var t = title.value.trim(), d = desc.value.trim(), a = tip.value.trim();
      if (!t) { err.textContent = T('tvNeedTitle', 'Give it a title.'); return; }
      if (a && !/^0x[0-9a-fA-F]{40}$/.test(a)) { err.textContent = T('tvBadTip', 'A Base address is 0x followed by 40 letters and digits.'); return; }
      publish(body, foot, { title: t, desc: d, tip: a, pw: pw.checked ? 1 : 0, canvas: canvas });
    };
  }
  function stepsUi(body, names) {
    var ol = el('ol', { cls: 'steps' });
    var lis = names.map(function (n) { var li = el('li', { text: n }); ol.appendChild(li); return li; });
    var status = el('p', { cls: 'note', role: 'status', 'aria-live': 'polite' });
    body.textContent = '';
    body.appendChild(status); body.appendChild(ol);
    var err = el('p', { cls: 'err', role: 'alert' }); body.appendChild(err);
    var i = -1;
    return {
      next: function () {
        if (i >= 0) { lis[i].className = 'done'; }
        i++;
        if (i < lis.length) { lis[i].className = 'now'; status.textContent = T('tvStepOf', 'Step {n} of {total}').replace('{n}', i + 1).replace('{total}', lis.length) + ': ' + names[i]; }
      },
      fail: function (m) { if (i >= 0 && i < lis.length) lis[i].className = 'bad'; err.textContent = m; },
    };
  }
  function check(j, what) {
    if (j && j.ok) return j;
    var m = (j && (j.error || (j.busy && T('tvBusy', 'gifos.tv is very busy right now, please try again later')))) || what;
    throw new Error(m);
  }
  function publish(body, foot, f) {
    busy = true;
    foot.textContent = '';
    var names = [T('tvS1', 'Making the thumbnail'), T('tvS2', 'Person check'), T('tvS3', 'Proving it’s your room'), T('tvS4', 'Uploading the thumbnail'), T('tvS5', 'Publishing the listing'), T('tvS6', 'Going on air'), T('tvS7', 'Checking gifos.tv')];
    var ui = stepsUi(body, names), thumb = '', url = '', blob = null, bytes = null, w = null;
    ui.next();
    (f.canvas ? toJpeg(f.canvas) : Promise.resolve(null)).then(function (b) {
      blob = b;
      ui.next();
      return tokenFor();
    }).then(function (jt) {
      if (!jt && !(ticket && ticket.mode() === 'off')) throw new Error(T('tvPowFail', 'The person check did not finish. Try again.'));
      ui.next();
      return (blob ? blob.arrayBuffer().then(function (ab) { bytes = ab; return sha256hex(ab); }).then(function (sha) { return ctx.sign('tvthumb', { sha: sha }); }) : Promise.resolve(null));
    }).then(function (tw) {
      w = tw;
      ui.next();
      if (!bytes) return null;
      return tokenFor().then(function (jt) {
        return root.fetch(API + '/api/thumb', { method: 'POST', credentials: 'omit', headers: { 'content-type': 'image/jpeg', 'x-gifos-jt': jt, 'x-gifos-order': JSON.stringify(w) }, body: bytes });
      }).then(function (r) { return r.json().catch(function () { return {}; }); }).then(function (j) { thumb = check(j, T('tvThumbFail', 'The thumbnail did not upload.')).thumb; });
    }).then(function () {
      ui.next();
      return ctx.sign('tvlist', { title: f.title, desc: f.desc, thumb: thumb, tip: f.tip, pw: f.pw }).then(function (lw) { return postOrder(lw, true); });
    }).then(function (j) {
      check(j, T('tvListFail', 'The listing was not published.'));
      url = j.url;
      setListed({ url: url, at: Date.now(), delisted: !!j.delisted });
      ui.next();
      onAirFor = '';
      return goOnAir().then(function (a) { check(a, T('tvAirFail', 'Could not go on air.')); });
    }).then(function () {
      ui.next();
      var p = url.replace(/^https?:\/\/[^/]+/, '');
      return root.fetch(API + '/api/l' + p, { credentials: 'omit', cache: 'no-store' }).then(function (r) { return r.json(); });
    }).then(function (j) {
      ui.next();
      busy = false;
      if (!j || !j.listing) throw new Error(T('tvCheckFail', 'Published, but gifos.tv does not show it yet.'));
      showListed(body, foot, listed());
      paint();
    }).catch(function (e) {
      busy = false;
      ui.fail(String(e && e.message || e));
      var back = el('button', { type: 'button', text: T('tvBack', 'Back'), id: 'tv-back' });
      back.onclick = function () { listed() ? showListed(body, foot, listed()) : showForm(body, foot); };
      foot.textContent = ''; foot.appendChild(back);
      paint();
    });
  }
  function doStop(body, foot, btn) {
    busy = true; btn.disabled = true;
    ctx.sign('tvunlist', {}).then(function (w) { return postOrder(w, false); }).then(function (j) {
      busy = false;
      if (!j.ok) throw new Error(j.error || T('tvStopFail', 'Could not stop listing. Try again.'));
      setListed(null); stopKeep(); offNote = null;
      body.textContent = ''; foot.textContent = '';
      body.appendChild(el('p', { cls: 'ok', text: T('tvStopped', 'No longer listed on gifos.tv.') }));
      var done = el('button', { type: 'button', cls: 'go', text: T('tvDone', 'Done') }); done.onclick = close; foot.appendChild(done);
      paint();
    }).catch(function (e) { busy = false; btn.disabled = false; body.appendChild(el('p', { cls: 'err', text: String(e && e.message || e) })); });
  }

  // ---- the button in the Stream link card -----------------------------------------------
  function paint(c) {
    if (c) ctx = c;
    if (!ctx) return;
    if (!root.document.getElementById('tv-pub-css') && root.document.head) root.document.head.appendChild(el('style', { id: 'tv-pub-css', text: CSS }));
    var card = root.document.getElementById('bc-link');
    var btn = root.document.getElementById('bc-tv');
    var show = false;
    try { show = !!(ctx.show() && hosted()); } catch (e) { show = false; }
    if (btn) {
      btn.hidden = !show;
      if (show) {
        var l = listed();
        btn.textContent = l ? T('tvListedBtn', 'Listed: stop listing') : T('tvPublishBtn', 'Publish to GifOS.tv');
        btn.classList.toggle('listed', !!l);
        if (!btn.__tv) { btn.__tv = 1; btn.addEventListener('click', openDialog); }
      }
    }
    try { tick(); } catch (e) {}
    return card;
  }
  GifOS.tvPublish = { paint: paint, api: API, _state: function () { return { onAirFor: onAirFor, keepDue: keepDue, listed: ctx ? listed() : null, hasOff: !!offNote }; } };
})(typeof window !== 'undefined' ? window : globalThis);
