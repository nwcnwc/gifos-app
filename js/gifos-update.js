/*
 * gifos-update.js — "a newer GifOS is out", one implementation for every page.
 *
 * GifOS itself (the Home Screen, the meeting/app runtime, the signer) is
 * versioned as a whole: a release is an immutable /versions/<x.y.z>/ snapshot,
 * and version.json.current names the live one. Releases carry no backward
 * compatibility, so a person on an older build is not merely behind: they are
 * on a build the rest of the room may no longer speak to.
 *
 * ONE UPDATE BEHAVIOUR ON EVERY SURFACE (Home Screen, meetings, broadcasts,
 * solo apps, the signer, the store, About, browser support):
 *
 *   NORMAL release — a header bar says what is new and carries an Update
 *   button that updates right there: same page, same hash, on the new
 *   release. Nobody is sent into Settings to do it. "What's new" unfolds the
 *   release notes in the bar (the Home Screen opens its Updates page).
 *
 *   EMERGENCY release — version.json names a floor: "emergency": "x.y.z".
 *   Every page running a release OLDER than the floor moves to the live
 *   release at once, with no click, mid-meeting and mid-broadcast included.
 *   A person pinned to a release, or on the edge build, is NEVER moved: they
 *   chose their build, and they get the bar instead. ("emergencyNote", if
 *   present, is a short line the moved page shows once it lands.)
 *
 * Timing and data: the first check runs 1 s after load, then every minute.
 * version.json is a plain fetch the browser revalidates (ETag → 304), so a
 * quiet minute costs a few hundred bytes. changelog.json is fetched only when
 * the bar has something to show for a release whose notes this page has not
 * read yet. No check runs while the page is hidden; coming back to it checks
 * at once.
 *
 * A page that must do work before it reloads (run.html: save a recording,
 * write down mic/camera/Stage/blur) passes opts.reload(target); otherwise the
 * page is moved directly.
 *
 * check() also writes gifos_current (the release pointer every channel loader
 * redirects on), so even a dismissed bar takes effect on the next visit.
 *
 * The decision is a pure function (decide) so it can be driven without a
 * browser. The bar's CSS is injected from here, so a page needs this one
 * script and nothing else.
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});

  // Compare dotted versions: >0 if a>b.
  function cmpVer(a, b) {
    const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
    for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
    return 0;
  }

  const VER = /^\d+\.\d+\.\d+$/;

  // What THIS page is running. index.html and boot.html declare
  // GIFOS_VERSION ('edge' at the root, 'x.y.z' in a snapshot); run.html and
  // sign.html do not, but the archive step stamps <base href="/versions/x.y.z/">
  // into every archived page, so a snapshot names itself through baseURI — also
  // after run.html moves its address bar to a root /meet/<room> path, which the
  // pathname alone would read as the edge build (build-badge.js reads it the
  // same way).
  //
  // pinned: the release this computer is pinned to (gifos_pin), or 'edge' when
  // it chose the edge channel. Either way the person chose their build, and an
  // emergency never moves them.
  function running(doc) {
    doc = doc || root.document;
    let version = root.GIFOS_VERSION;
    if (!version) {
      let src = '';
      try { src = (doc && doc.baseURI) || root.location.pathname; } catch (e) {}
      const m = /\/versions\/(\d+\.\d+\.\d+)\//.exec(src);
      version = m ? m[1] : 'edge';
    }
    version = String(version);
    let pinned = null, channel = null;
    try { pinned = root.localStorage.getItem('gifos_pin'); channel = root.localStorage.getItem('gifos_channel'); } catch (e) {}
    return { version, edge: !VER.test(version), pinned: pinned || (channel === 'edge' ? 'edge' : null) };
  }

  // Releases newer than `version`, up to and including `latest`, that the
  // changelog flags critical.
  function criticalSince(changelog, version, latest) {
    if (!Array.isArray(changelog)) return [];
    return changelog.filter((e) => e && e.critical && cmpVer(e.version, version) > 0 && cmpVer(e.version, latest) <= 0);
  }

  // The changelog entry for one release (or null).
  function notesOf(changelog, v) {
    if (!Array.isArray(changelog)) return null;
    return changelog.find((e) => e && e.version === v) || null;
  }

  // Is `version` under the emergency floor version.json names? Only a real
  // floor that the live release has reached counts.
  function underFloor(floor, version, latest) {
    return !!floor && VER.test(String(floor)) && VER.test(String(version)) &&
      cmpVer(version, floor) < 0 && cmpVer(latest, floor) >= 0;
  }

  // null = say nothing. The edge build is AHEAD of the release, never behind,
  // so it is never nagged; only a snapshot older than the live release is.
  // o.meeting: this page is a ROOM. Meetings run the live release whatever
  // the pin (the channel loader's room rule), so a pinned page in a room is
  // told that, not merely what it is pinned to.
  // o.emergency: version.json's floor. d.emergency is true only for a page
  // that is not pinned and runs a release under it: that page moves now.
  function decide(o) {
    if (!o || o.edge || !o.latest || !VER.test(String(o.latest))) return null;
    if (cmpVer(o.latest, o.version) <= 0) return null;
    const critical = criticalSince(o.changelog, o.version, o.latest);
    const urgent = underFloor(o.emergency, o.version, o.latest);
    const entry = notesOf(o.changelog, String(o.latest));
    const headline = entry && entry.headline ? String(entry.headline) : '';
    const text = o.pinned
      ? (o.pinned === 'edge' ? 'You are on the edge build. ' : 'You are pinned to v' + o.version + '. ') +
        (o.meeting ? 'Meetings run on' : 'Latest is') + ' v' + o.latest + '.'
      : (critical.length || urgent)
        ? '⚠ Important update: GifOS v' + o.latest + ' is available.' + (headline ? ' ' + headline + '.' : '')
        : headline
          ? 'What’s new in GifOS v' + o.latest + ': ' + headline + '.'
          : 'A new version of GifOS v' + o.latest + ' is available.';
    return {
      latest: String(o.latest), pinned: !!o.pinned, meeting: !!o.meeting, critical,
      emergency: urgent && !o.pinned, notes: entry, text,
    };
  }

  // Where Update sends a page. Under /versions/<x>/ it is the same page and
  // hash on the live release. Anywhere else — a pretty /meet/<room> address
  // (run.html moves its address bar there even inside a snapshot), or the root
  // — it is null: RELOAD, and the channel loader follows gifos_current, which
  // check() has just written.
  function updateUrl(loc, latest) {
    const m = loc.pathname.match(/^\/versions\/[^/]+(\/.*)?$/);
    if (!m) return null;
    return '/versions/' + latest + (m[1] || '/') + (loc.search || '') + (loc.hash || '');
  }

  // Move THIS page onto `latest` (same path and hash). Used by watch() when the
  // page has no reload of its own, and by pages that run their own step first.
  function go(latest) {
    const url = updateUrl(root.location, latest);
    if (url) root.location.replace(url); else root.location.reload();
  }

  // The release notes, read once per live release per page.
  let notesFor = null, notesCache = null;
  // version.json every time, revalidated by the browser (ETag → 304), never
  // cache-busted. changelog.json only when opts.notes(info) says the bar will
  // show and this page has not read the notes for info.current yet. Resolves
  // null offline or on a bad answer — the bar stays silent. A good answer
  // refreshes gifos_current for the next visit.
  function check(opts) {
    if (typeof fetch !== 'function') return Promise.resolve(null);
    const json = (u) => fetch(u, { cache: 'no-cache' })
      .then((r) => (r && r.ok ? r.json() : null)).catch(() => null);
    return json('/version.json').then((info) => {
      if (!info || !VER.test(String(info.current || ''))) return null;
      try { root.localStorage.setItem('gifos_current', String(info.current)); } catch (e) {}
      const want = !(opts && typeof opts.notes === 'function') || opts.notes(info);
      if (!want || notesFor === info.current) return { info, changelog: notesCache };
      // Release notes are best-effort: the bar still works without them.
      return json('/changelog.json').then((cl) => {
        const entries = cl && Array.isArray(cl.entries) ? cl.entries : null;
        if (entries) { notesFor = info.current; notesCache = entries; }
        return { info, changelog: entries };
      });
    });
  }

  const CSS =
    '.update-bar{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .6rem;padding:.4rem 1rem;' +
    'background:linear-gradient(135deg,rgba(123,92,255,.25),rgba(255,92,170,.25));' +
    'border-bottom:1px solid var(--accent,#7b5cff);font-size:.82rem;position:relative;z-index:6;' +
    'color:var(--text,#e0e0f0)}' +
    '.update-bar #update-msg{flex:1 1 12rem;min-width:0}' +
    '.update-bar button{padding:.25rem .8rem;border-radius:.4rem;border:1px solid var(--accent,#7b5cff);' +
    'background:var(--accent,#7b5cff);color:var(--onaccent,#fff);cursor:pointer;font-size:.78rem}' +
    '.update-bar button.more{background:none;color:var(--text,#e0e0f0)}' +
    '.update-bar .dismiss{background:none;border:0;color:var(--muted,#9a9ab0);padding:.25rem .5rem}' +
    '.update-bar.critical{background-image:linear-gradient(135deg,rgba(255,92,92,.28),rgba(255,150,60,.28));border-bottom-color:#ff6b6b}' +
    '.update-bar .update-notes{flex:1 0 100%;max-height:40vh;overflow:auto;margin:.1rem 0 .2rem;font-size:.8rem}' +
    '.update-bar .update-notes ul{margin:.2rem 0 .4rem;padding-left:1.2rem}' +
    '.update-bar .update-notes b{display:block;margin-top:.3rem}' +
    // Every page but the Home Screen: the bar floats over the top of the page.
    '.update-bar.floating{position:fixed;top:0;left:0;right:0;z-index:2147483000;' +
    'padding-top:calc(.4rem + env(safe-area-inset-top,0px));background-color:var(--bg,#0a0a0f)}';
  function injectCss() {
    const d = root.document;
    if (!d || typeof d.createElement !== 'function' || d.getElementById('gifos-update-css')) return;
    const s = d.createElement('style');
    s.id = 'gifos-update-css';
    s.textContent = CSS;
    (d.head || d.documentElement).appendChild(s);
  }
  injectCss();

  // The bar's markup: index.html and boot.html ship it in the page; watch()
  // builds the same thing for a page that does not.
  function mount() {
    const d = root.document;
    let bar = d.getElementById('update-bar');
    if (bar) return bar;
    bar = d.createElement('div');
    bar.className = 'update-bar floating';
    bar.id = 'update-bar';
    bar.setAttribute('role', 'status');
    bar.style.display = 'none';
    bar.innerHTML = '<span id="update-msg"></span><button id="update-more" class="more" type="button">What’s new</button>' +
      '<button id="update-action" type="button"></button>' +
      '<button class="dismiss" id="update-dismiss" type="button" title="Dismiss" aria-label="Dismiss">✕</button>';
    d.body.appendChild(bar);
    return bar;
  }

  // The notes of one release, as the bar unfolds them.
  function notesHtml(e) {
    if (!e) return '';
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const list = (title, arr) => (Array.isArray(arr) && arr.length)
      ? '<b>' + title + '</b><ul>' + arr.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul>' : '';
    return list('New', e.features) + list('Fixed', e.fixes) + list('Notes', e.notes);
  }
  function hasNotes(e) {
    return !!(e && ['features', 'fixes', 'notes'].some((k) => Array.isArray(e[k]) && e[k].length));
  }

  // Paint a decision into a bar. `action` is { label, run } (the Update
  // button); `more` is { run } for "What's new", or omitted to unfold the
  // notes inside the bar. A null decision hides the bar. Dismiss hides it
  // until a NEWER release is decided.
  function paint(bar, d, action, more) {
    if (!bar) return;
    if (!d || bar.dataset.dismissed === d.latest) { bar.style.display = 'none'; return; }
    bar.style.display = '';
    bar.classList.toggle('critical', d.critical.length > 0 || !!d.emergency);
    bar.querySelector('#update-msg').textContent = d.text;
    const btn = bar.querySelector('#update-action');
    btn.style.display = action ? '' : 'none';
    if (action) { btn.textContent = action.label; btn.onclick = action.run; }
    const mb = bar.querySelector('#update-more');
    if (mb) {
      const own = !more && hasNotes(d.notes);
      mb.style.display = (more || own) ? '' : 'none';
      mb.onclick = () => {
        if (more) { more.run(); return; }
        let box = bar.querySelector('.update-notes');
        if (box) { box.remove(); mb.setAttribute('aria-expanded', 'false'); return; }
        box = root.document.createElement('div');
        box.className = 'update-notes';
        box.innerHTML = notesHtml(d.notes);
        bar.appendChild(box);
        mb.setAttribute('aria-expanded', 'true');
      };
    }
    bar.querySelector('#update-dismiss').onclick = () => { bar.dataset.dismissed = d.latest; bar.style.display = 'none'; };
  }

  // An emergency move happens once per tab per target release. If the page
  // comes back still behind (a cache or loader that did not move it), it
  // shows the bar instead of reloading again and again.
  const TRIED_KEY = 'gifos_update_tried';
  const TRIED_MS = 10 * 60 * 1000;
  function triedRecently(latest) {
    try {
      const o = JSON.parse(root.sessionStorage.getItem(TRIED_KEY) || 'null');
      return !!(o && o.to === latest && Date.now() - (+o.at || 0) < TRIED_MS);
    } catch (e) { return false; }
  }
  function noteTried(latest) {
    try { root.sessionStorage.setItem(TRIED_KEY, JSON.stringify({ to: latest, at: Date.now() })); } catch (e) {}
  }

  // For every page but the Home Screen (desktop.js runs its own bar on the
  // same decide/paint/check). Checks 1 s after load, then every minute while
  // the page is visible, and at once when it becomes visible again.
  //
  // A pinned visitor chose their build on the Home Screen, which is where they
  // are told about releases — EXCEPT in a room. opts.room() says whether this
  // page is one (run.html: anything but a solo app). A pinned person who starts
  // a meeting from their Home Screen opens run.html inside the pinned build,
  // where no loader runs, and everyone they invite lands on the live release;
  // the bar says so and its action moves the room there. The pin is kept.
  //
  // opts.root: a page served only from the site root (the store, About,
  // browser support). It always runs what the site serves, so "behind" means
  // a release went live after this page loaded: the first answer is its
  // baseline, and a later, newer release is what the bar names.
  //
  // opts.reload(target): the page's own way to move ({ latest, url,
  // emergency }); it must end in a navigation. Without it the page is moved
  // directly (go).
  const MINUTE = 60 * 1000;
  function watch(opts) {
    opts = opts || {};
    // A framed page is not the top of anything a person is looking at; the
    // page that framed it speaks for the build.
    try { if (root.top !== root.self) return null; } catch (e) { return null; }
    const doc = root.document;
    let baseline = null, busy = false, moving = false;
    const decideFor = (info, changelog) => {
      const r = running();
      const meeting = !!(opts.room && opts.room());
      let version = r.version, edge = r.edge;
      if (opts.root && r.edge) {
        if (baseline === null) baseline = String(info.current);
        version = baseline; edge = false;
      }
      if (r.pinned && !meeting) return null;
      return decide({
        version, edge, pinned: r.pinned, meeting,
        latest: info.current, changelog, emergency: info.emergency,
      });
    };
    const move = (d) => {
      if (moving) return;
      moving = true;
      const target = { latest: d.latest, url: updateUrl(root.location, d.latest), emergency: !!d.emergency, note: d.note || '' };
      try {
        if (opts.beforeUpdate && opts.beforeUpdate(target) === false) { moving = false; return; }
        if (opts.reload) opts.reload(target); else go(d.latest);
      } catch (e) { moving = false; go(d.latest); }
    };
    const tick = () => {
      if (busy || moving) return Promise.resolve();
      if (doc && doc.hidden) return Promise.resolve();
      busy = true;
      return check({ notes: (info) => { const d = decideFor(info, null); return !!d && !d.emergency; } }).then((got) => {
        if (!got) return;
        const d = decideFor(got.info, got.changelog);
        if (!d) { const b = doc.getElementById('update-bar'); if (b) b.style.display = 'none'; return; }
        if (d.emergency && !triedRecently(d.latest)) {
          noteTried(d.latest);
          d.note = got.info.emergencyNote ? String(got.info.emergencyNote).slice(0, 200) : '';
          move(d);
          return;
        }
        paint(mount(), d, {
          label: d.pinned ? 'Switch to v' + d.latest : 'Update now',
          run: () => move(d),
        });
      }).catch(() => {}).then(() => { busy = false; });
    };
    setTimeout(tick, opts.delay == null ? 1000 : opts.delay);
    const t = setInterval(tick, opts.every || MINUTE);
    const onVis = () => { if (!doc.hidden) tick(); };
    try { doc.addEventListener('visibilitychange', onVis); } catch (e) {}
    return { stop: () => { clearInterval(t); try { doc.removeEventListener('visibilitychange', onVis); } catch (e) {} }, tick };
  }

  GifOS.update = { cmpVer, running, criticalSince, notesOf, underFloor, decide, updateUrl, go, check, mount, paint, watch, MINUTE };
})(typeof window !== 'undefined' ? window : globalThis);
