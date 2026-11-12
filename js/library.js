/*
 * library.js — the My library page (library.html).
 *
 * Lists the recordings and transcripts a Streamer subscriber saved to the
 * cloud library and lets them play, download, rename, share and delete them.
 * It is a client of GifOS.library (js/gifos-library.js); every word shown
 * comes from i18n/<locale>/library.json. File names are always set with
 * textContent, never as markup.
 */
(function () {
  'use strict';
  var GifOS = window.GifOS = window.GifOS || {};
  var i18n = GifOS.i18n;
  var $ = function (id) { return document.getElementById(id); };
  var lib = function () { return GifOS.library; };
  var files = [];          // last list() answer, newest first
  var busy = {};           // file id -> true while a request for it runs

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function btn(label, onclick, cls) {
    var b = el('button', cls || 'link', label);
    b.type = 'button';
    b.addEventListener('click', onclick);
    return b;
  }
  function say(e) {
    var s = $('status');
    s.textContent = e ? ((e && e.message) || i18n.t('library.failed')) : '';
    s.hidden = !e;
  }
  function dateText(sec) { return i18n.fmt.date(new Date(sec * 1000)); }

  // ---- dialogs: a sticky header with Close, a sticky footer for actions ----
  function modal(title, body, actions) {
    var d = el('dialog', 'modal');
    var head = el('div', 'modal-head');
    head.appendChild(el('h2', null, title));
    var close = btn(i18n.t('library.close'), function () { d.close(); }, 'link');
    head.appendChild(close);
    d.appendChild(head);
    var main = el('div', 'modal-body');
    main.appendChild(body);
    d.appendChild(main);
    var foot = el('div', 'modal-foot');
    (actions || []).forEach(function (a) { foot.appendChild(a); });
    if (!actions || !actions.length) foot.hidden = true;
    d.appendChild(foot);
    d.addEventListener('close', function () {
      var v = d.querySelector('video'); if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* closing */ } }
      d.remove();
    });
    document.body.appendChild(d);
    d.showModal();
    return d;
  }

  // ---- what each button does ----
  function guard(f, fn) {
    return function () {
      if (busy[f.id]) return;
      busy[f.id] = true; say(null);
      Promise.resolve().then(fn).catch(say).then(function () { busy[f.id] = false; });
    };
  }
  // Files are opened (decrypted) in this browser. Normally the service
  // worker streams them (any size, seeking works, flat memory); a browser
  // without one opens small files whole.
  var WHOLE_MAX = 256 * 1000 * 1000;   // bytes a page may hold to open a file whole
  var playUrl = null;
  function player(title, type, src, sid) {
    var box = el('div');
    if (/^video\/|^audio\//.test(type || '')) {
      var v = el(/^audio\//.test(type) ? 'audio' : 'video');
      v.controls = true; v.setAttribute('playsinline', ''); v.preload = 'metadata'; v.src = src;
      var notice = el('p', 'quiet');
      v.addEventListener('error', function () { notice.textContent = i18n.t('library.unsupported'); });
      box.appendChild(v); box.appendChild(notice);
    } else {
      var pre = el('pre', 'text');
      fetch(src).then(function (r) { return r.text(); }).then(function (t) { pre.textContent = t; });
      box.appendChild(pre);
    }
    var d = modal(title, box);
    d.addEventListener('close', function () { if (sid) lib().endStream(sid); });
    return d;
  }
  function showBlob(title, blob, type) {
    if (playUrl) { URL.revokeObjectURL(playUrl); playUrl = null; }
    playUrl = URL.createObjectURL(blob);
    return player(title, type, playUrl, null);
  }
  function saveUrl(url, name) {
    var a = el('a'); a.href = url; a.download = name || 'recording'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function opening(f) {
    return function (x) { say({ message: i18n.t('library.opening', { pct: Math.round(x * 100) }) }); };
  }
  // Stream, or open whole when this browser cannot stream and the file is small.
  function viaStream(start, whole, size) {
    return start().catch(function (e) {
      if (e && e.code === 'no-stream') {
        if (size > WHOLE_MAX) throw { message: i18n.t('library.noStream') };
        return whole();
      }
      throw e;
    });
  }
  function play(f) {
    return viaStream(function () {
      return lib().stream(f).then(function (s) { player(f.name, f.type, s.url, s.sid); });
    }, function () {
      return lib().openFile(f, opening(f)).then(function (blob) { say(null); showBlob(f.name, blob, f.type); });
    }, f.plainSize);
  }
  function download(f) {
    return viaStream(function () {
      return lib().stream(f, { download: true }).then(function (s) { saveUrl(s.url, f.name); });
    }, function () {
      return lib().download(f, opening(f)).then(function () { say(null); });
    }, f.plainSize);
  }
  function startRename(f, nameEl) {
    var input = el('input', 'rename'); input.type = 'text'; input.value = f.name; input.maxLength = 200;
    input.setAttribute('aria-label', i18n.t('library.renameLabel'));
    var done = false;
    function finish(save) {
      if (done) return; done = true;
      var v = input.value.trim();
      if (!save || !v || v === f.name) { load(); return; }
      guard(f, function () { return lib().rename(f.id, v).then(load); })();
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', function () { finish(false); });
    nameEl.replaceWith(input); input.focus(); input.select();
  }
  function confirmDelete(f) {
    var tr = files.filter(function (x) { return x.kind === 'transcript' && x.of === f.id; })[0];
    var body = el('div');
    body.appendChild(el('p', null, i18n.t('library.deleteBody')));
    var box = null;
    if (tr) {
      var lab = el('label', 'check'); box = el('input'); box.type = 'checkbox'; box.checked = true;
      lab.appendChild(box); lab.appendChild(el('span', null, i18n.t('library.deleteTranscript')));
      body.appendChild(lab);
    }
    var d;
    var go = btn(i18n.t('library.delete'), function () {
      var both = !!(box && box.checked);
      d.close();
      guard(f, function () {
        return lib().remove(f.id).then(function () { return both ? lib().remove(tr.id) : null; }).then(load);
      })();
    }, 'primary');
    var no = btn(i18n.t('library.cancel'), function () { d.close(); });
    d = modal(i18n.t('library.deleteTitle', { name: f.name || i18n.t('library.locked') }), body, [no, go]);
  }
  function shareDialog(f, existing) {
    return (existing ? lib().shareUrl(f, existing).then(function (u) { return { url: u }; }) : lib().share(f)).then(function (r) {
      var body = el('div');
      body.appendChild(el('p', 'quiet', i18n.t('library.shareNote')));
      var row = el('div', 'row');
      var url = el('input', 'url'); url.type = 'text'; url.readOnly = true; url.value = r.url;
      url.setAttribute('aria-label', i18n.t('library.share'));
      var copy = btn(i18n.t('library.copy'), function () {
        var ok = function () { copy.textContent = i18n.t('library.copied'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(r.url).then(ok, function () { url.select(); });
        else { url.select(); try { document.execCommand('copy'); ok(); } catch (e) { /* the link stays selected */ } }
      }, 'primary');
      row.appendChild(url); body.appendChild(row);
      var d = modal(i18n.t('library.shareTitle', { name: f.name }), body, [copy]);
      d.addEventListener('close', load);
    });
  }
  function turnOff(f, s) {
    return lib().unshare(s.id).then(load);
  }

  // ---- the page ----
  function row(f, kids) {
    var li = el('li', 'file');
    var main = el('div', 'main');
    if (f.locked) {
      // Sealed with another subscription file: it can only be deleted here.
      main.appendChild(el('span', 'name', i18n.t('library.locked')));
      main.appendChild(el('span', 'meta', dateText(f.created) + ' · ' + lib().sizeText(f.size)));
      li.appendChild(main);
      var la = el('div', 'acts');
      la.appendChild(btn(i18n.t('library.delete'), function () { confirmDelete(f); }));
      li.appendChild(la);
      return li;
    }
    var name = el('span', 'name', f.name);
    main.appendChild(name);
    main.appendChild(el('span', 'meta', dateText(f.created) + ' · ' + lib().sizeText(f.plainSize || f.size)));
    li.appendChild(main);
    var acts = el('div', 'acts');
    acts.appendChild(btn(i18n.t('library.play'), guard(f, function () { return play(f); })));
    acts.appendChild(btn(i18n.t('library.download'), guard(f, function () { return download(f); })));
    acts.appendChild(btn(i18n.t('library.rename'), function () { startRename(f, name); }));
    acts.appendChild(btn(i18n.t('library.share'), guard(f, function () { return shareDialog(f); })));
    acts.appendChild(btn(i18n.t('library.delete'), function () { confirmDelete(f); }));
    li.appendChild(acts);
    (f.shares || []).forEach(function (s) {
      var r = el('div', 'share');
      r.appendChild(el('span', 'meta', i18n.t('library.shareExisting') + ' · ' + dateText(s.created)));
      if (s.url) r.appendChild(btn(i18n.t('library.copyLink'), guard(f, function () { return shareDialog(f, s); })));
      r.appendChild(btn(i18n.t('library.shareTurnOff'), guard(f, function () { return turnOff(f, s); })));
      li.appendChild(r);
    });
    if (kids && kids.length) {
      var ul = el('ul', 'sub');
      kids.forEach(function (k) { ul.appendChild(row(k)); });
      li.appendChild(ul);
    }
    return li;
  }
  function render(data) {
    files = data.files || [];
    var u = data.usage || {};
    var total = (u.used || 0) + (u.reserved || 0), cap = u.cap || 0;
    var pct = cap ? Math.min(100, Math.floor(total * 100 / cap)) : 0;
    var bar = $('bar');
    bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(cap));
    bar.setAttribute('aria-valuenow', String(total));
    bar.firstElementChild.style.width = pct + '%';
    $('usage-text').textContent = i18n.t('library.usage', { used: lib().sizeText(total), cap: lib().sizeText(cap) });
    var warn = $('warn');
    warn.hidden = !u.warn;
    if (u.warn) warn.textContent = i18n.t('library.warn', { pct: u.percent != null ? u.percent : pct, gb: u.gb != null ? u.gb : Math.round(cap / 1e9) });
    var kept = $('kept');
    kept.hidden = u.state !== 'kept';
    if (u.state === 'kept') kept.textContent = i18n.t('library.kept', { date: dateText(u.keptUntil) });

    var byOf = {};
    files.forEach(function (f) { if (f.kind === 'transcript' && f.of) (byOf[f.of] = byOf[f.of] || []).push(f); });
    var ids = {}; files.forEach(function (f) { ids[f.id] = true; });
    var list = $('files'); list.textContent = '';
    files.forEach(function (f) {
      if (f.kind === 'transcript' && f.of && ids[f.of]) return;   // shown under its recording
      list.appendChild(row(f, byOf[f.id]));
    });
    $('empty').hidden = files.length > 0;
    uploads(data.uploads || []);
  }

  // ---- uploads in progress ----
  var bars = {};            // upload id -> {li, fill, label}
  function uploadRow(id, name) {
    if (bars[id]) return bars[id];
    var li = el('li', 'file');
    var label = el('span', 'name', name || '');
    var track = el('div', 'track'); track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', '100'); track.setAttribute('aria-valuenow', '0');
    track.setAttribute('aria-label', name || i18n.t('library.uploadsTitle'));
    var fill = el('div', 'fill'); track.appendChild(fill);
    var main = el('div', 'main'); main.appendChild(label); li.appendChild(main); li.appendChild(track);
    var acts = el('div', 'acts');
    acts.appendChild(btn(i18n.t('library.uploadCancel'), function () {
      say(null);
      lib().abort(id).then(function () { delete bars[id]; li.remove(); showUploads(); }).catch(say);
    }));
    li.appendChild(acts);
    $('uploads-list').appendChild(li);
    bars[id] = { li: li, fill: fill, track: track, label: label, name: name };
    showUploads();
    return bars[id];
  }
  function showUploads() { $('uploads').hidden = !$('uploads-list').children.length; }
  function setProgress(id, name, x) {
    var b = uploadRow(id, name), p = Math.round(Math.max(0, Math.min(1, x)) * 100);
    b.fill.style.width = p + '%'; b.track.setAttribute('aria-valuenow', String(p));
    b.label.textContent = i18n.t('library.uploadProgress', { name: name || '', pct: p });
  }
  function uploads(fromServer) {
    var local = {}; lib().pending().forEach(function (p) { local[p.id] = p; });
    fromServer.forEach(function (u) {
      var p = u.parts ? u.done / u.parts : 0;
      setProgress(u.id, u.name, p);
    });
    Object.keys(local).forEach(function (id) { if (!bars[id]) setProgress(id, local[id].name, 0); });
    // an upload neither side knows any more is gone
    var known = {}; fromServer.forEach(function (u) { known[u.id] = 1; }); Object.keys(local).forEach(function (id) { known[id] = 1; });
    Object.keys(bars).forEach(function (id) { if (!known[id] && !resumingNow) { bars[id].li.remove(); delete bars[id]; } });
    showUploads();
  }
  var resumingNow = false;

  function load() {
    return lib().list().then(render).catch(function (e) {
      say(e && e.message ? e : new Error(i18n.t('library.loadFailed')));
    });
  }

  // Someone opened a share link: the key is in the #fragment, which never
  // leaves this browser. No subscription is needed to watch.
  function startShared() {
    $('shared').hidden = false;
    var s = lib().parseShare(location.hash);
    $('shared-name').textContent = (s && s.n) || i18n.t('library.sharedTitle');
    var go = function (dl) {
      return function () {
        say(null);
        var sh = lib().parseShare(location.hash) || {};
        viaStream(function () {
          return lib().streamShare(location.hash, { download: dl }).then(function (x) {
            if (dl) saveUrl(x.url, sh.n); else player(sh.n || i18n.t('library.sharedTitle'), sh.t, x.url, x.sid);
          });
        }, function () {
          return lib().openShare(location.hash, function (x) { say({ message: i18n.t('library.opening', { pct: Math.round(x * 100) }) }); }).then(function (r) {
            say(null);
            if (dl) saveUrl(URL.createObjectURL(r.blob), r.name);
            else showBlob(r.name || i18n.t('library.sharedTitle'), r.blob, r.type);
          });
        }, sh.s).catch(function (e) {
          say({ message: e.code === 'wrong-key' ? i18n.t('library.wrongKey') : e.code === 'share-key' ? i18n.t('library.shareNoKey') : e.code === 'share-gone' ? i18n.t('library.shareGone') : (e.message || i18n.t('library.failed')) });
        });
      };
    };
    var acts = $('shared-acts'); acts.textContent = '';
    acts.appendChild(btn(i18n.t('library.play'), go(false)));
    acts.appendChild(btn(i18n.t('library.download'), go(true)));
  }
  function start() {
    document.title = i18n.t('library.titleTab');
    document.querySelectorAll('[data-t]').forEach(function (n) { n.textContent = i18n.t(n.getAttribute('data-t')); });
    if (lib().parseShare(location.hash)) { startShared(); return; }
    $('loading').hidden = false;
    lib().status().then(function (st) {
      $('loading').hidden = true;
      if (st !== 'streamer') {
        $('noplan').hidden = false;
        $('noplan-hint').hidden = !lib().enabled() || st !== 'none';
        return;
      }
      $('library').hidden = false;
      resumingNow = true;
      var resumed = lib().pending().length
        ? lib().resumePending(function (p, x) { setProgress(p.id, p.name, x); }).catch(function () { return []; })
        : Promise.resolve([]);
      load().then(function () { return resumed; }).then(function () { resumingNow = false; return load(); });
    }).catch(function (e) { $('loading').hidden = true; say(e); });
  }

  function boot() {
    if (!i18n) return;
    i18n.load('library').then(start, start);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
