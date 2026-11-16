/*
 * app-update.js — "there's a newer version of this app" at launch.
 *
 * A store install is frozen at install-day code forever: the seeded-app reseed
 * only knows sample apps, and the store's "↑ Update available" badge is only
 * seen by someone who goes back to browse. A player who opens their app from
 * the Home Screen every day never hears that the bug they hit was fixed. So
 * the runtime asks, once per launch, off the boot path, and nudges.
 *
 * THE DECISION IS THE STORE'S, NOT A SECOND ONE. What "installed" and
 * "outdated" mean is settled in store.js: an install records the catalog hash
 * it came from (`storeSha`), the catalog pins every app to a `sha256`, and the
 * two differing is an update. The same floor applies: an app declares the
 * oldest GifOS build it runs on (`minBuild`), and a computer below that floor
 * installing the update gets a dead icon, not a newer app. That case says
 * UPDATE GIFOS FIRST — never "update the app", which would walk the player
 * into the very install the store refuses.
 *
 * Only store installs are ever nudged: no storeSha, no catalog lookup. Stolen,
 * imported and user-built apps are the player's own business. And nothing
 * here may cost the launch anything — one small JSON fetch, after the app is
 * mounted, silent on any failure (offline, catalog gone, app delisted).
 *
 * Exposed as GifOS.appUpdate so the decision is TESTABLE directly (the same
 * reason store.js exports GifOS.storeBuild): check() returns what would be
 * said and why, render() says it. e2e-app-update.js guards both.
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});

  // The words of this module live in i18n/<locale>/update.json. The English given
  // here is what shows before the catalog lands or on a page without the loader.
  const tr = (key, en, p) => {
    const I = GifOS.i18n;
    if (I && I.has(key)) return I.t(key, p);
    return String(en).replace(/\{(\w+)\}/g, (m, k) => (p && p[k] != null ? p[k] : m));
  };
  if (GifOS.i18n && GifOS.i18n.load) GifOS.i18n.load('update');

  // The catalog lives at the ROOT for every build: a frozen snapshot's
  // /versions/x.y.z/run.html asks the same /apps/index.json as edge does.
  const CATALOG = '/apps/index.json';
  const VERSIONS = '/version.json';

  // NO cache-buster in the URL, deliberately. `cache: 'no-store'` already
  // defeats the HTTP cache; a unique `?ts=` defeats the SERVICE WORKER instead,
  // which caches by request — so every launch left another 181 KB copy of the
  // catalog in the shell cache forever, and sw.js's offline fallback (which
  // matches with ignoreSearch) then answered from an arbitrary old one. That is
  // a launch on a slow link comparing against a STALE catalog and saying
  // nothing. store.js has always asked for the catalog under its bare path; so
  // does this. sw.js normalizes both of these paths to one key regardless.
  function fetchJson(url) {
    return fetch(url, { cache: 'no-store' })
      .then((r) => (r && r.ok ? r.json() : null)).catch(() => null);
  }

  // The oldest release that carries a given build — the store's releaseWith,
  // so the two never name different releases for the same floor. null when no
  // release has it yet (the app's floor is only on edge).
  function releaseWith(versions, build) {
    const map = (versions && versions.builds) || {};
    let best = null;
    for (const rel of Object.keys(map)) {
      const b = Number(map[rel]);
      if (b >= build && (best === null || b < best.b)) best = { rel, b };
    }
    return best && best.rel;
  }

  // The build of the computer that is RUNNING the app — build.js, which a
  // snapshot carries stamped with its release's number and edge carries baked
  // at deploy. 0 is a local checkout: unknown, not ancient. Like the store's
  // tooOld(), an unknown build never blocks — we would rather offer an update
  // the store then refuses than hide one because we could not read a number.
  function ownBuild() { return Number(root.GIFOS_BUILD) || 0; }

  const seenKey = (d) => 'gifos_appupd::' + d.appId + '::' + d.sha256 + '::' + d.kind;
  function seen(d) { try { return localStorage.getItem(seenKey(d)) === '1'; } catch (e) { return false; } }
  function markSeen(d) { try { localStorage.setItem(seenKey(d), '1'); } catch (e) {} }

  // What to say about an installed file record, or null for "nothing".
  //   { kind: 'app',   slug, name, sha256, appId }          — go update it
  //   { kind: 'gifos', slug, name, sha256, appId, need, rel } — update GifOS first
  // `opts.catalog` / `opts.versions` / `opts.build` let a test hand in the
  // inputs; the page fetches them.
  async function check(rec, opts) {
    opts = opts || {};
    if (!rec || !rec.isApp || !rec.appId || !rec.storeSha) return null;
    const catalog = opts.catalog !== undefined ? opts.catalog : await fetchJson(CATALOG);
    const app = catalog && Array.isArray(catalog.apps) && catalog.apps.find((a) => a && a.appId === rec.appId);
    if (!app || !app.sha256 || app.sha256 === rec.storeSha) return null;
    const base = { slug: app.slug, name: app.name || rec.appId, sha256: app.sha256, appId: rec.appId };
    const build = opts.build !== undefined ? opts.build : ownBuild();
    const need = Number(app.minBuild) || 0;
    if (build && need > build) {
      const versions = opts.versions !== undefined ? opts.versions : await fetchJson(VERSIONS);
      return Object.assign(base, { kind: 'gifos', need, rel: releaseWith(versions, need) });
    }
    return Object.assign(base, { kind: 'app' });
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ns = (key) => (GifOS.store && GifOS.store.dbName && GifOS.store.dbName !== 'gifos'
    ? key + encodeURIComponent(GifOS.store.dbName) : '');
  const storeUrl = (slug) => '/store/' + encodeURIComponent(slug) + ns('#db=');

  // A translation may carry <b>…</b>; everything else is escaped text.
  const rich = (s) => esc(s).replace(/&lt;(\/?)b&gt;/g, '<$1b>');
  function message(d) {
    if (d.kind === 'gifos') {
      const path = tr('update.app.versionPath', 'GifOS ▾ → Settings → Advanced → Version');
      return rich(tr('update.app.needsBuild', '<b>A newer {name} is in the App Store, but it needs GifOS build {need} or newer.</b>', { name: d.name, need: String(d.need) })) + ' ' +
        (d.rel
          ? rich(tr('update.app.updateGifosFirst', 'Update GifOS first — move to release {release} or later in <b>{path}</b> — then update the app from the store.', { release: d.rel, path }))
          : rich(tr('update.app.edgeOnly', 'No release has it yet — it is only in the unreleased edge build. Pick <b>{edge}</b> in <b>{path}</b> first, or wait for the next release.', { edge: tr('update.app.edgeBuild', 'Edge build'), path })));
    }
    return rich(tr('update.app.available', '<b>Update available for {name}.</b>', { name: d.name })) + ' ' +
      '<a href="' + esc(storeUrl(d.slug)) + '" target="_blank" rel="noopener">' + esc(tr('update.app.link', 'Update — keeps your data')) + '</a>';
  }

  // A small bar under the app bar. Dismiss is ✕ (dismiss, never delete).
  // The bar lands on pages themed by whatever app is running, so every color
  // in it is fixed — nothing may inherit from the page. The link especially:
  // left unstyled it takes the browser's default (visited) purple, which is
  // unreadable on the dark panel.
  function render(d) {
    let el = document.getElementById('appupd');
    if (!el) {
      el = document.createElement('div');
      el.id = 'appupd';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);max-width:min(92vw,560px);' +
        'z-index:9000;padding:.6rem .9rem;border-radius:10px;font:.85rem/1.35 system-ui,sans-serif;' +
        'background:#1c1c28;color:#f2f2f7;border:1px solid #3a3a50;' +
        'box-shadow:0 6px 24px rgba(0,0,0,.35);display:flex;gap:.6rem;align-items:flex-start';
      document.body.appendChild(el);
    }
    el.setAttribute('data-kind', d.kind);
    el.setAttribute('data-slug', d.slug);
    el.innerHTML = '<span class="txt" style="flex:1">' + message(d) + '</span>' +
      '<button class="close" aria-label="' + esc(tr('update.app.dismiss', 'Dismiss')) + '" style="background:none;border:0;color:inherit;font-size:1rem;cursor:pointer;padding:0 .2rem">✕</button>';
    el.querySelectorAll('a').forEach((a) => {
      a.style.cssText = 'color:#a9c7ff;font-weight:600;text-decoration:underline';
    });
    el.querySelector('.close').onclick = () => { el.remove(); };
    return el;
  }

  // The launch hook: decide, say it once per (app, catalog hash, outcome),
  // never throw into the boot.
  async function nudge(rec, opts) {
    let d = null;
    try { d = await check(rec, opts); } catch (e) { d = null; }
    if (!d) return null;
    if (!(opts && opts.always) && seen(d)) return d;
    markSeen(d);
    try { render(d); } catch (e) {}
    return d;
  }

  GifOS.appUpdate = { check, nudge, render, releaseWith, storeUrl, seenKey };
})(typeof window !== 'undefined' ? window : globalThis);
