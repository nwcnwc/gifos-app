/*
 * gifos-update.js — "a newer GifOS is out", one implementation for every page.
 *
 * GifOS itself (the Home Screen, the meeting/app runtime, the signer) is
 * versioned as a whole: a release is an immutable /versions/<x.y.z>/ snapshot,
 * and version.json.current names the live one. The update bar used to live in
 * desktop.js alone, so a person who only ever opened meeting links — run.html,
 * never the Home Screen — was never told a release existed. Releases carry no
 * backward compatibility, so that person is not merely behind: they are on a
 * build the rest of the room may no longer speak to.
 *
 * So the check, the decision and the bar are here, once, and every page that
 * follows releases uses them:
 *   - desktop.js (index.html, boot.html) keeps its own "What's new" action,
 *     which opens Settings → Advanced → Version with the release notes.
 *   - run.html and sign.html call watch(): the bar floats over the page and its
 *     action moves THIS page — same path, same hash — onto the live release.
 *
 * check() also writes gifos_current (the release pointer every channel loader
 * redirects on), so even a dismissed bar takes effect on the next visit.
 *
 * The decision is a pure function (decide) so test/unit/gifos-update.js can
 * drive it without a browser. The bar's CSS is injected from here, so a page
 * needs this one script and nothing else.
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
  // sign.html do not, but archive-version.sh stamps <base href="/versions/x.y.z/">
  // into every archived page, so a snapshot names itself through baseURI — also
  // after run.html moves its address bar to a root /meet/<room> path, which the
  // pathname alone would read as the edge build (build-badge.js reads it the
  // same way).
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
    let pinned = null;
    try { pinned = root.localStorage.getItem('gifos_pin'); } catch (e) {}
    return { version, edge: !VER.test(version), pinned };
  }

  // Releases newer than `version`, up to and including `latest`, that the
  // changelog flags critical.
  function criticalSince(changelog, version, latest) {
    if (!Array.isArray(changelog)) return [];
    return changelog.filter((e) => e && e.critical && cmpVer(e.version, version) > 0 && cmpVer(e.version, latest) <= 0);
  }

  // null = say nothing. The edge build is AHEAD of the release, never behind,
  // so it is never nagged; only a snapshot older than the live release is.
  // o.meeting: this page is a ROOM. Meetings run the live release whatever
  // the pin (the channel loader's room rule), so a pinned page in a room is
  // told that, not merely what it is pinned to.
  function decide(o) {
    if (!o || o.edge || !o.latest || !VER.test(String(o.latest))) return null;
    if (cmpVer(o.latest, o.version) <= 0) return null;
    const critical = criticalSince(o.changelog, o.version, o.latest);
    const text = o.pinned
      ? 'You are pinned to v' + o.version + '. ' + (o.meeting ? 'Meetings run on' : 'Latest is') + ' v' + o.latest + '.'
      : (critical.length ? '⚠ Important update: ' : 'A new version of ') + 'GifOS v' + o.latest + ' is available.';
    return { latest: String(o.latest), pinned: !!o.pinned, meeting: !!o.meeting, critical, text };
  }

  // Where "Update now" sends a page. Under /versions/<x>/ it is the same page
  // and hash on the live release. Anywhere else — a pretty /meet/<room> address
  // (run.html moves its address bar there even inside a snapshot), or the root
  // — it is null: RELOAD, and the channel loader follows gifos_current, which
  // check() has just written.
  function updateUrl(loc, latest) {
    const m = loc.pathname.match(/^\/versions\/[^/]+(\/.*)?$/);
    if (!m) return null;
    return '/versions/' + latest + (m[1] || '/') + (loc.search || '') + (loc.hash || '');
  }

  // version.json + changelog.json, both network-first in sw.js. Resolves null
  // offline or on a bad answer — the bar stays silent. A good answer refreshes
  // gifos_current for the next visit.
  function check() {
    if (typeof fetch !== 'function') return Promise.resolve(null);
    const json = (u) => fetch(u + '?ts=' + Date.now(), { cache: 'no-store' })
      .then((r) => (r && r.ok ? r.json() : null)).catch(() => null);
    return json('/version.json').then((info) => {
      if (!info || !VER.test(String(info.current || ''))) return null;
      try { root.localStorage.setItem('gifos_current', String(info.current)); } catch (e) {}
      // Release notes are best-effort: the bar still works without them.
      return json('/changelog.json').then((cl) => ({
        info, changelog: cl && Array.isArray(cl.entries) ? cl.entries : null,
      }));
    });
  }

  const CSS =
    '.update-bar{display:flex;align-items:center;gap:.6rem;padding:.4rem 1rem;' +
    'background:linear-gradient(135deg,rgba(123,92,255,.25),rgba(255,92,170,.25));' +
    'border-bottom:1px solid var(--accent,#7b5cff);font-size:.82rem;position:relative;z-index:6;' +
    'color:var(--text,#e0e0f0)}' +
    '.update-bar button{padding:.25rem .8rem;border-radius:.4rem;border:1px solid var(--accent,#7b5cff);' +
    'background:var(--accent,#7b5cff);color:var(--onaccent,#fff);cursor:pointer;font-size:.78rem}' +
    '.update-bar .dismiss{margin-left:auto;background:none;border:0;color:var(--muted,#9a9ab0);padding:.25rem .5rem}' +
    // run.html and sign.html: floating over the page, not in its flow.
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
    bar.innerHTML = '<span id="update-msg"></span><button id="update-action"></button>' +
      '<button class="dismiss" id="update-dismiss" title="Dismiss">✕</button>';
    d.body.appendChild(bar);
    return bar;
  }

  // Paint a decision into a bar. `action` is { label, run }; a null decision
  // hides the bar. Dismiss hides it until a NEWER release is decided.
  function paint(bar, d, action) {
    if (!bar) return;
    if (!d || bar.dataset.dismissed === d.latest) { bar.style.display = 'none'; return; }
    bar.style.display = '';
    bar.classList.toggle('critical', d.critical.length > 0);
    bar.querySelector('#update-msg').textContent = d.text;
    const btn = bar.querySelector('#update-action');
    btn.style.display = action ? '' : 'none';
    if (action) { btn.textContent = action.label; btn.onclick = action.run; }
    bar.querySelector('#update-dismiss').onclick = () => { bar.dataset.dismissed = d.latest; bar.style.display = 'none'; };
  }

  // For a page that is not the Home Screen. Checks off the boot path, then
  // again every hour: a meeting tab can stay open across a release.
  //
  // A pinned visitor chose their build on the Home Screen, which is where they
  // are told about releases — EXCEPT in a room. opts.room() says whether this
  // page is one (run.html: anything but a solo app). A pinned person who starts
  // a meeting from their Home Screen opens run.html inside the pinned build,
  // where no loader runs, and everyone they invite lands on the live release;
  // the bar says so and its action moves the room there. The pin is kept.
  const HOUR = 60 * 60 * 1000;
  function watch(opts) {
    opts = opts || {};
    // A framed page is not the top of anything a person is looking at; the
    // page that framed it speaks for the build.
    try { if (root.top !== root.self) return null; } catch (e) { return null; }
    const tick = () => check().then((got) => {
      if (!got) return;
      const r = running();
      const meeting = !!(opts.room && opts.room());
      const d = (r.pinned && !meeting) ? null : decide({
        version: r.version, edge: r.edge, pinned: r.pinned, meeting,
        latest: got.info.current, changelog: got.changelog,
      });
      if (!d) { const b = root.document.getElementById('update-bar'); if (b) b.style.display = 'none'; return; }
      paint(mount(), d, {
        label: d.pinned ? 'Switch to v' + d.latest : 'Update now',
        run: () => {
          if (opts.beforeUpdate && opts.beforeUpdate() === false) return;
          const url = updateUrl(root.location, d.latest);
          if (url) root.location.replace(url); else root.location.reload();
        },
      });
    }).catch(() => {});
    setTimeout(tick, opts.delay == null ? 1000 : opts.delay);
    const t = setInterval(tick, opts.every || HOUR);
    return { stop: () => clearInterval(t), tick };
  }

  GifOS.update = { cmpVer, running, criticalSince, decide, updateUrl, check, mount, paint, watch };
})(typeof window !== 'undefined' ? window : globalThis);
