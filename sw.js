/*
 * sw.js — the GifOS offline layer.
 *
 * GifOS is already a local-first computer: all the logic ships as static files,
 * and every app + file you own lives in IndexedDB on the device. The one thing
 * that still needed the network was FETCHING THOSE STATIC FILES on each load —
 * so a fresh open in airplane mode never even reached the desktop. This service
 * worker precaches the whole shell (the HTML pages, CSS, every js/ module and
 * the base theme) so the desktop boots with no connection at all. Your saved
 * apps then run straight from IndexedDB, exactly as they do online.
 *
 * What still needs a connection (and degrades on its own, unchanged): Meetings
 * (the relay), the web-reading apps like Bible Browser and Fortune (the CORS
 * proxy), and Ask AI. Those are CROSS-ORIGIN requests — the fetch handler never
 * touches them, so they fail the same friendly way they always did offline.
 *
 * Update path — TWO policies, split by channel (the fetch handler decides by URL:
 * /versions/ is a release, everything else is the edge root):
 *
 *  - RELEASE / pinned users live entirely under /versions/<x.y.z>/, which are
 *    IMMUTABLE snapshots: cache-first forever, NO background revalidation. Updates
 *    are OPT-IN and never happen behind their back — a plain (or hard) refresh
 *    serves the SAME installed shell. The desktop learns a release exists
 *    by fetching version.json + changelog.json network-first, and shows it in
 *    Settings → Advanced → Version with a changelog (critical items called out).
 *    "Upgrade this computer" sends 'gifos-refresh-shell' to re-fetch the ENTIRE
 *    shell fresh (the computer is far more than index.html) and reloads.
 *
 * THIS WORKER ITSELF is not a build, so it never waits. A new sw.js takes over
 * as soon as it has installed (skipWaiting + clients.claim), and no page is
 * reloaded for it: a running page keeps the code it loaded, and only its later
 * requests go through the new worker. A worker that waits for every GifOS tab
 * to close never takes over on a device that keeps its Home Screen open, and
 * that device then runs an old worker, with old bugs, indefinitely. Taking over
 * changes nothing the user chose: which build runs is decided by the pages
 * (/versions/<x.y.z>/ is still served cache-first), and activate carries every
 * copy the old worker had saved into the new cache, so offline keeps working.
 *
 *  - EDGE users (localStorage gifos_channel='edge') are served from the site ROOT
 *    and have asked to track the newest build on GitHub Pages. Root assets are
 *    therefore NETWORK-FIRST with revalidation: every load issues a conditional GET
 *    (If-None-Match / If-Modified-Since), so a changed file is regrabbed and an
 *    unchanged one comes back 304 and reuses the cached bytes (no re-download —
 *    "caching is fine if the files haven't changed"). Offline or a stalled socket
 *    falls back to cache, so edge still boots and still works in airplane mode.
 *    sw-register.js lets a freshly-installed worker take over on its own for edge
 *    (no forced reload, so a live meeting is never interrupted) so this strategy
 *    itself reaches existing edge users without a manual upgrade step.
 */
'use strict';

var SHELL_VERSION = 'v37'; // v37: 0.9.28.63 merge: both v36 changes below. v36: js/ring-standby.js (Ring me on this device, standing by while GifOS is open) joins the shell. v35: the Home views (js/home-view.js, css/home-view.css) join the shell. v34: the My identity words (i18n/<locale>/identity.json) join the shell. v33: My identity (js/gifos-identity.js, js/gifos-identity-ui.js) joins the shell. v32: the subscription's cards (js/core/view/subs.js) join the shell beside js/meet-subs.js, which is now logic only. v31: js/core/link.js (the one room-link grammar) joins the shell: every page reads its address with it. v30: the embed player's words (i18n/<locale>/embed.json) join the shell. v29: the meeting and broadcast pages (meet.html, cast.html) and their surfaces join the shell; run.html is the app runtime with its audio view (js/core/view/audio.js, css/run.css). v28: embed.html (gifos.app/embed, the broadcast player page) and its view part, and welcome.html (gifos.app/welcome), join the shell. v27: the subscription page's words join the shell; pages are kept under the clean address the host serves them at (/store, not only /store.html), never with a redirect mark, and an offline .html address is redirected to it; (v26: the meeting page runs from js/core (core, media plane, view, linker; in the page bundle when published); (v25: My library streams sealed recordings through this worker; (v24: My library (the /library page and its client); (v23: js/timings.js joins the shell (the meeting page's waits and timeouts) (v22: css/meet-polish.css joins the shell (v21: css/meet.css joins the shell (the meeting styles moved out of run.html) (v20: js/dialog.js joins the shell (the dialogs' scroll frame, parsed by every page) (v19: 0.9.25 cut (shell now holds every en catalog and the new version.json/changelog) (v18: every surface's en catalog joins the shell, plus meet.json and the built-in apps (v17: gifos-i18n.js and the en catalogs join the shell (v16: 0.9.24 hotfix, gifos-update.js reads a four-part `latest`; v15: gifos-charge.js joins the shell) v36: the looks registry, widgets, Clock and Calendar words (js/home-widgets.js, js/home-looks/*.js, i18n/en/home.json, apps/clock.json, apps/calendar.json) join the shell. (v36 main) v35: the Home views (js/home-view.js, css/home-view.css) join the shell. v34: the My identity words (i18n/<locale>/identity.json) join the shell. v33: My identity (js/gifos-identity.js, js/gifos-identity-ui.js) joins the shell. v32: the subscription's cards (js/core/view/subs.js) join the shell beside js/meet-subs.js, which is now logic only. v31: js/core/link.js (the one room-link grammar) joins the shell: every page reads its address with it. v30: the embed player's words (i18n/<locale>/embed.json) join the shell. v29: the meeting and broadcast pages (meet.html, cast.html) and their surfaces join the shell; run.html is the app runtime with its audio view (js/core/view/audio.js, css/run.css). v28: embed.html (gifos.app/embed, the broadcast player page) and its view part, and welcome.html (gifos.app/welcome), join the shell. v27: the subscription page's words join the shell; pages are kept under the clean address the host serves them at (/store, not only /store.html), never with a redirect mark, and an offline .html address is redirected to it; (v26: the meeting page runs from js/core (core, media plane, view, linker; in the page bundle when published); (v25: My library streams sealed recordings through this worker; (v24: My library (the /library page and its client); (v23: js/timings.js joins the shell (the meeting page's waits and timeouts) (v22: css/meet-polish.css joins the shell (v21: css/meet.css joins the shell (the meeting styles moved out of run.html) (v20: js/dialog.js joins the shell (the dialogs' scroll frame, parsed by every page) (v19: 0.9.25 cut (shell now holds every en catalog and the new version.json/changelog) (v18: every surface's en catalog joins the shell, plus meet.json and the built-in apps (v17: gifos-i18n.js and the en catalogs join the shell (v16: 0.9.24 hotfix, gifos-update.js reads a four-part `latest`; v15: gifos-charge.js joins the shell)
var CACHE = 'gifos-shell-' + SHELL_VERSION;

// ONE CACHE KEY PER FILE. pages.yml stamps `?v=<sha>` onto every local css/js
// reference in the published HTML, so each deploy asks for the same file under
// a new URL. Caching by full URL (the Cache API default) therefore minted a new
// entry per deploy and never evicted one — and the offline fallback, matching
// with ignoreSearch, answered from the FIRST entry it found: the precache from
// the day the worker installed. An edge computer that had run build 2237 all
// week booted in airplane mode as build 1845, and every app whose minBuild was
// newer refused to run. The key is the PATHNAME: a successful fetch overwrites
// the one entry, so offline always serves the newest copy this device has
// actually run, and the cache is bounded by the number of files, not deploys.
function keyOf(url) { return url.pathname; }

// A response the browser reached by FOLLOWING a redirect carries redirected:true.
// The host 308s every .html URL to its clean form (/run.html -> /run), so a fetch
// of 'run.html' (meet-host.js reads the page that way, and install() precaches
// '/run.html') comes back redirected. Kept as it is under the asked key, it was
// later handed to a NAVIGATION, whose redirect mode is 'manual': the browser
// refuses a redirected response there and the page fails to load
// (net::ERR_FAILED), every time after, because a /versions/ snapshot is served
// cache-first. plain() is the same bytes without the redirect mark, so the
// cached copy can answer any request, a navigation included.
function plain(res) {
  if (!res || !res.redirected) return Promise.resolve(res);
  return res.blob().then(function (body) {
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  });
}
function keep(cache, key, res) {
  return plain(res).then(function (r) { return cache.put(key, r); });
}
// A cached copy that still carries the mark (install()'s cache.add follows the
// same 308s, and an older worker kept such copies too): serve it plain, and put
// the plain copy back so the cache heals on first use.
function fromCache(cache, key, res) {
  if (!res || !res.redirected) return Promise.resolve(res);
  return plain(res).then(function (r) { cache.put(key, r.clone()).catch(function () {}); return r; });
}

// Put one shell file in the cache, fresh from the network. The host 308s a
// page's .html address to its clean path (/store.html -> /store, /index.html
// -> /), and every link and navigation uses the clean path, so the page is
// kept under the address the host actually served it at (res.url) as well as
// under the asked name (a page's own fetch('run.html') still finds it). Both
// copies are plain: a copy with the redirect mark is refused by a navigation.
// On a host with no clean paths nothing is redirected and only the asked name
// is kept.
function shelve(cache, u) {
  return fetch(new Request(u, { cache: 'reload' })).then(function (res) {
    if (!res || !res.ok) throw new Error(u + ' answered ' + (res && res.status));
    var at = '';
    try { at = new URL(res.url).pathname; } catch (e) { at = ''; }
    return plain(res).then(function (r) {
      var puts = [];
      if (at && at !== new URL(u, self.location.href).pathname) puts.push(cache.put(at, r.clone()));
      puts.push(cache.put(u, r));
      return Promise.all(puts);
    });
  });
}

// The universal shell — identical on gifos.app and every theme subdomain. Per-
// computer extras (archived builds under /versions/) are runtime-cached on first
// visit, so a computer you have actually opened keeps working offline too.
// The store PAGE is shell (it opens offline and says so); the CATALOG and the
// App GIFs are not — /apps/index.json, the covers and an 8 MB app are content
// that must never be dragged into a precache on someone's phone.
var CORE = [
  '/', '/index.html', '/boot.html', '/run.html', '/meet.html', '/cast.html', '/sign.html', '/about.html', '/welcome.html', '/store.html', '/library.html', '/embed.html', '/css/meet-embed.css', '/js/core/link.js', '/js/core/view/kit.js', '/js/core/view/embed.js',
  '/css/run.css', '/js/core/view/meet.js', '/js/core/view/cast.js', '/js/core/view/audio.js', '/js/core/view/subs.js',
  '/css/desktop.css', '/css/home-view.css', '/css/meet.css', '/css/meet-polish.css',
  '/js/gifos-gif.js', '/js/gifos-help.js', '/js/gifos-charge.js', '/js/gifos-sign.js', '/js/gifos-ed.js', '/js/gifos-lock.js', '/js/gifos-identity.js', '/js/gifos-identity-ui.js', '/js/gifos-zip.js', '/js/gifos-icons.js',
  '/js/gifos-themes.js', '/js/gifos-avatar.js', '/js/gifos-store.js', '/js/gifos-install.js', '/js/gifos-fullscreen.js', '/js/irl-apps.js', '/js/sample-apps.js', '/js/store.js', '/js/gifos-cash.js',
  '/js/dialog.js', '/js/desktop.js', '/js/home-widgets.js', '/js/home-view.js', '/js/calendar-app.js', '/js/calendar-remind.js', '/js/calendar-bridge.js', '/js/calendar/ical.js', '/js/calendar/app.html', '/js/calendar/widget.html', '/js/home-looks/glass.js', '/js/home-looks/orbit.js', '/js/home-looks/pulse.js', '/js/runtime.js', '/js/meet-host.js', '/js/camera-studio.js', '/js/relay-config.js', '/js/sw-register.js', '/js/build.js', '/js/build-badge.js', '/js/gifos-update.js', '/js/timings.js', '/js/ring-standby.js',
  '/js/gifos-i18n.js', '/js/gifos-library.js', '/js/library.js', '/i18n/en/library.json', '/i18n/en/common.json', '/i18n/en/settings.json', '/i18n/en/desktop.json', '/i18n/en/store.json', '/i18n/en/runtime.json',
  '/i18n/en/boot.json', '/i18n/en/sign.json', '/i18n/en/help.json', '/i18n/en/update.json', '/i18n/en/charge.json', '/i18n/en/identity.json', '/i18n/en/home.json', '/i18n/en/install.json', '/i18n/en/subscription.json',
  '/i18n/en/meet.json', '/i18n/en/embed.json',
  '/i18n/en/apps/appstore.json', '/i18n/en/apps/clock.json', '/i18n/en/apps/calendar.json', '/i18n/en/apps/askai.json', '/i18n/en/apps/bible.json', '/i18n/en/apps/broadcast.json', '/i18n/en/apps/calc.json', '/i18n/en/apps/camera.json', '/i18n/en/apps/chat.json', '/i18n/en/apps/chess.json', '/i18n/en/apps/connect4.json', '/i18n/en/apps/dial.json', '/i18n/en/apps/fakefacts.json', '/i18n/en/apps/fortune.json', '/i18n/en/apps/guestbook.json', '/i18n/en/apps/imposter.json', '/i18n/en/apps/meet.json', '/i18n/en/apps/minesweeper.json', '/i18n/en/apps/mymedia.json', '/i18n/en/apps/notes.json', '/i18n/en/apps/oneclue.json', '/i18n/en/apps/paint.json', '/i18n/en/apps/reader.json', '/i18n/en/apps/roulette.json', '/i18n/en/apps/samebrain.json', '/i18n/en/apps/speechcoach.json', '/i18n/en/apps/spy.json', '/i18n/en/apps/taketurns.json', '/i18n/en/apps/tictactoe.json', '/i18n/en/apps/tilt.json', '/i18n/en/apps/timer.json', '/i18n/en/apps/welcome.json', '/i18n/en/apps/wolves.json',
  '/themes/theme.js', '/themes/icons.js', '/themes/eggs.js',
  '/gifos.key', '/version.json', '/changelog.json', '/og.png', '/manifest.webmanifest', '/icon.svg', '/themes/call-icon-192.png', '/themes/call-badge-96.png',
];

// A meeting join installs this worker too. These three are the desktop, not
// the call: the pretty-link page, the store payer, and the build guide the
// packer copies into an app GIF. install() adds them only when the client
// is the desktop, so a clean join does not fetch them. An explicit shell
// refresh still does, and the fetch handler caches each one on first use.
var DESKTOP_SHELL = ['/route.html', '/js/pay.js', '/llms.txt'];

function desktopClient(url) {
  var path = '';
  try { path = new URL(url).pathname; } catch (e) { return false; }
  if (path.length > 1 && path.charAt(path.length - 1) === '/') path = path.slice(0, -1);
  return path === '' || path === '/' || path === '/index.html' || path === '/boot.html'
    || path === '/sign.html' || path === '/about.html' || path === '/store.html' || path === '/store';
}

// THIS computer's theme override files. The theme cascade (gifos-themes.js)
// derives the folder from the SUBDOMAIN label and parser-blocking-loads
// themes/<label>/{theme,icons,eggs,wallpaper}.js on the desktop AND on run.html.
// If any weren't cached, opening an app offline would stall on the blocked
// <script>. Precaching them (same label logic as the cascade) makes a themed
// computer — orrery.gifos.app and friends — fully self-contained offline.
function themeOverride() {
  var parts = (self.location.hostname || '').split('.');
  // Same label rule as gifos-themes.js: an IPv4 host, and a dashed
  // four-number label (203-0-113-10.example.test), are numeric hosts.
  var ipv4 = parts.length === 4 && parts.every(function (p) { return /^\d{1,3}$/.test(p); });
  var dashedQuad = /^\d{1,3}-\d{1,3}-\d{1,3}-\d{1,3}$/.test(parts[0] || '');
  var label = (!ipv4 && !dashedQuad && parts.length >= 3 && parts[0] !== 'www') ? parts[0] : '';
  if (label === 'home' || label === 'default') label = '';
  if (!label || !/^[a-z0-9-]{1,32}$/i.test(label)) return [];
  var dir = '/themes/' + label + '/';
  return [dir + 'theme.js', dir + 'icons.js', dir + 'eggs.js', dir + 'wallpaper.js'];
}

// Install list: the meeting shell, this computer's theme, and the desktop
// extras only when a desktop page is what installed the worker.
async function installUrls() {
  var list = CORE.concat(themeOverride());
  var open = [];
  try { open = await self.clients.matchAll({ includeUncontrolled: true }); } catch (e) { open = []; }
  if (open.some(function (c) { return desktopClient(c && c.url); })) list = list.concat(DESKTOP_SHELL);
  return list;
}

self.addEventListener('install', function (e) {
  e.waitUntil((async function () {
    var cache = await caches.open(CACHE);
    var urls = await installUrls();
    // allSettled + per-file shelve: one missing/renamed asset can't abort the
    // whole precache (a half-cached shell is still better than none).
    await Promise.allSettled(urls.map(function (u) { return shelve(cache, u); }));
    // Take over at once, first install and update alike (see the note at the top).
    await self.skipWaiting();
  })());
});

// The desktop drives the opt-in update from Settings → Advanced → Version:
//  - 'gifos-apply-update'  : take over now, for a worker an older page finds
//                            waiting (an older worker could wait).
//  - 'gifos-refresh-shell' : re-fetch EVERY shell asset fresh into the cache,
//                            even under the same worker (covers a deploy that
//                            changed js/css/html but not sw.js). Acks each client
//                            so the page can reload into the whole new build.
self.addEventListener('message', function (e) {
  var data = e.data || {};
  if (data.type === 'gifos-apply-update') { self.skipWaiting(); return; }
  if (data.type === 'gifos-refresh-shell') {
    e.waitUntil((async function () {
      var cache = await caches.open(CACHE);
      await Promise.allSettled(CORE.concat(DESKTOP_SHELL).concat(themeOverride()).map(function (u) { return shelve(cache, u); }));
      var cs = await self.clients.matchAll();
      cs.forEach(function (c) { c.postMessage({ type: 'gifos-shell-refreshed' }); });
    })());
  }
});

// Resolve a fetch, but never hang: if the network hasn't answered in `ms`, give
// up and resolve null (a stalled airplane-mode socket must not block a parser-
// blocking <script> request forever). Successful responses are cached; failures
// and timeouts resolve null so the caller can fall back.
function raceNetwork(req, cache, ms, key) {
  return new Promise(function (resolve) {
    var settled = false;
    var t = setTimeout(function () { if (!settled) { settled = true; resolve(null); } }, ms);
    fetch(req).then(function (res) {
      if (res && res.ok && (res.type === 'basic' || res.type === 'default')) {
        keep(cache, key || req, res.clone()).catch(function () {});
      }
      if (!settled) { settled = true; clearTimeout(t); resolve(res); }
    }, function () { if (!settled) { settled = true; clearTimeout(t); resolve(null); } });
  });
}

// Network-FIRST with conditional revalidation, bounded by a timeout — the edge
// channel's strategy. cache:'no-cache' forces the browser to check the server
// every time (If-None-Match / If-Modified-Since): a 304 returns the cached bytes
// with no download, a changed asset downloads fresh. Fresh OK responses are put
// back in the cache for offline. Resolves null on non-OK, error, or timeout so
// the caller falls back to the cache — a stalled socket must never hang a parser-
// blocking <script>, and a transient 5xx should serve the last good build.
// `passRouted` — a NAVIGATION whose server answer is not 200 but IS still the
// answer must be delivered as-is, never papered over. Two shapes qualify, and
// falling back to the cached shell for either one breaks a pretty link:
//
//  - 404. On GitHub Pages the 404 body IS 404.html: the pretty-link router that
//    turns /meet/<room> and /join/<code> into a real page. Resolving null for it
//    sent the caller to the cached shell instead, whose channel loader then
//    rewrote the pretty path to /versions/<v>/meet/<room> — a path that exists
//    nowhere — and every invite link landed on the desktop with the meeting
//    silently dropped.
//  - A REDIRECT. Pages 301s every directory URL typed without its trailing slash
//    (/go/<slug> → /go/<slug>/, and likewise /store, /themes/<x>). A navigation
//    Request carries redirect:'manual', which the clone below PRESERVES, so that
//    301 arrives here as an OPAQUEREDIRECT: type 'opaqueredirect', status 0, ok
//    false. It reads as a failure and is not one. Swallowing it walked the exact
//    same path as the 404 bug — cached shell → /versions/<v>/go/<slug> → nowhere
//    → bare desktop, app silently dropped — while the slashed form worked, which
//    is what made it look like the LINK was broken. Handing the opaqueredirect
//    back lets the browser follow it (that is what manual redirects are for);
//    respondWith accepts one precisely because this is a navigation.
//
// Only those pass through, so a transient 5xx still falls back to the last good
// build as intended.
//
// A 404 for an ASSET is also the answer, and it is delivered as one. The server
// said the file is gone; turning that into the cached copy would serve a
// deleted file forever, and turning it into degrade()'s empty 200 (which used
// to happen ONLINE, for any missing script or stylesheet) told a fetch() caller
// "ok" with nothing in it. The cached copy is dropped at the same time. The
// empty 200 remains what an offline, uncached STYLESHEET gets (a script gets a network error) — that
// is a stall averted, not a lie about the server.
function revalidate(req, cache, ms, passRouted, key) {
  return new Promise(function (resolve) {
    var settled = false;
    var t = setTimeout(function () { if (!settled) { settled = true; resolve(null); } }, ms);
    var rr;
    try { rr = new Request(req, { cache: 'no-cache' }); } catch (e) { rr = req; }
    fetch(rr).then(function (res) {
      var ok = res && res.ok && (res.type === 'basic' || res.type === 'default');
      if (ok) keep(cache, key || req, res.clone()).catch(function () {});
      var redirected = res && (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400));
      var gone = !ok && res && res.status === 404;
      if (gone && key) cache.delete(key).catch(function () {});
      var routed = !ok && res && (redirected ? passRouted : gone);
      if (!settled) { settled = true; clearTimeout(t); resolve(ok || routed ? res : null); }
    }, function () { if (!settled) { settled = true; clearTimeout(t); resolve(null); } });
  });
}

// The honest answer when a PINNED build is not on this device and the network
// cannot supply it. It is deliberately NOT the edge shell (see degrade).
function notInstalled(v) {
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Offline</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:12vh auto;max-width:34rem;padding:0 1.5rem}</style>'
    + '<h1>This computer is offline</h1><p>It is pinned to build <b>' + v + '</b>, and that build is not saved on this device yet.</p>'
    + '<p>Connect once and reopen — after that it works with no connection at all.</p>',
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// Last-resort response when nothing is cached AND the network didn't answer
// (offline / stalled), so a request can NEVER hang the page:
//  - a navigation → the app shell FOR THAT CHANNEL (its scripts boot from
//    cache/IndexedDB);
//  - a script → a network error (the error event resolves a parser-blocking
//    <script> at once, and the caller learns it is missing; an empty 200 hid
//    that); a style → an EMPTY 200 so the sheet resolves; a missing override
//    simply falls back to the base;
//  - anything else → a clean error the caller can handle.
//
// A DEGRADE NEVER CROSSES THE CHANNEL BOUNDARY (bug ledger #3, 2026-08-06).

// The host answers /x/run.html with a 308 to /x/run, and a navigation follows
// that itself, so the page is cached only under the clean path. Offline, the
// .html address finds nothing under its own key; Chromium still gets by on its
// HTTP cache's copy of the 308, Firefox and WebKit landed on the Offline page.
// Same answer the host gives: the redirect, to the copy this device has.
function cleanOf(path) {
  if (!/\.html$/.test(path)) return '';
  return /\/index\.html$/.test(path) ? path.slice(0, -10) : path.slice(0, -5);
}

// This used to answer EVERY navigation with the ROOT /index.html — including a
// navigation to /versions/<x.y.z>/…, which hands a pinned visitor the EDGE
// shell. That shell then runs ITS channel loader, which re-routes by whatever
// page map it was frozen with; when the page names have since moved, the
// redirect lands on a path that exists nowhere. site/versions/0.9.1/run.html is
// a hard 404 reachable exactly this way, and it looks like a broken site rather
// than a device that is offline. A snapshot degrades to ITS OWN index.html or
// it says plainly that the build is not installed; the root degrades to the
// root's. Nothing substitutes one channel's shell for the other's.
//
// What this deliberately does NOT claim: that the shell it serves is CURRENT.
// The cache is keyed by SHELL_VERSION and activate() purges every other
// generation, so a cached page is always from this worker's own shell — but a
// deploy that changes pages without bumping SHELL_VERSION leaves the previous
// build's copies in place until a revalidate replaces them. That staleness is
// the update policy working as designed (an edge revalidate or an opt-in
// upgrade fixes it); serving it to the WRONG CHANNEL was the bug.
async function degrade(req, url, cache) {
  if (req.mode === 'navigate') {
    var pin = url.pathname.match(/^\/versions\/([0-9]+\.[0-9]+\.[0-9]+(?:\.[0-9]+)?)\//);   // x.y.z or x.y.z.w
    // The Home Screen's clean address (the build's directory) first, then its
    // .html name; either copy is served plain.
    var dir = pin ? '/versions/' + pin[1] + '/' : '/';
    var idx = await fromCache(cache, dir, await cache.match(dir))
      || await fromCache(cache, dir + 'index.html', await cache.match(dir + 'index.html'));
    if (idx) return idx;
    if (pin) return notInstalled(pin[1]);
  }
  if (req.destination === 'script' || /\.m?js(\?|$)/.test(url.pathname)) {
    // A network error, never an empty 200: an empty script "loads", runs nothing and fires no error event, so a unit
    // silently never exists (mesh seat without rcfollow.js). An error fires the script's error event at once, so a
    // parser-blocking tag still does not stall, and the page's load gate (run.html unitsGate) sees it and retries.
    return Response.error();
  }
  if (req.destination === 'style' || /\.css(\?|$)/.test(url.pathname)) {
    return new Response('', { status: 200, headers: { 'Content-Type': 'text/css' } });
  }
  return Response.error();
}

// Everything an older worker saved moves into this worker's cache before its
// cache is dropped: a pinned build's pages and files, apps' assets, the last
// catalog. Without this, taking over from a running computer would leave it
// unable to start offline until each file was fetched again. Copies this
// worker already holds (its fresh precache) win; every copy is moved plain.
async function adopt(from, into) {
  var old = await caches.open(from);
  var reqs = await old.keys();
  for (var i = 0; i < reqs.length; i++) {
    var u; try { u = new URL(reqs[i].url); } catch (err) { continue; }
    if (u.search || await into.match(keyOf(u))) continue;
    var res = await old.match(reqs[i]);
    if (res) await keep(into, keyOf(u), res).catch(function () {});
  }
}

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    var keys = await caches.keys();
    var mine = await caches.open(CACHE);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf('gifos-shell-') !== 0 || keys[i] === CACHE) continue;
      try { await adopt(keys[i], mine); } catch (err) { /* keep what moved */ }
      await caches.delete(keys[i]);
    }
    // Sweep any entry keyed with a query string. Every key is a bare pathname
    // now (keyOf); a queried key is a twin left by a caller or a worker that
    // cached by full URL — the shape that answered offline from the oldest
    // copy — and the bare key beside it is the one that is kept current.
    try {
      var shell = await caches.open(CACHE);
      var reqs = await shell.keys();
      await Promise.all(reqs.map(function (r) {
        var u; try { u = new URL(r.url); } catch (err) { return; }
        if (u.search) return shell.delete(r);
      }));
    } catch (err) { /* a cache that won't open just keeps its twins */ }
    await self.clients.claim();
  })());
});

// ---- My library: decrypted streams --------------------------------------------
// A library file is sealed part by part (js/gifos-library.js). To play or save
// a recording of any size without holding it in memory, the page hands this
// worker a STREAM SESSION (where the sealed bytes are, the file key, the part
// layout) and points <video> or a download at /library-stream/<sid>/<name>.
// Each request is answered by fetching only the sealed parts that cover the
// asked byte range, opening them one at a time and passing the plain bytes on:
// Range requests (seeking) work and memory stays at about one part.
// Sessions live in memory and, so a paused video survives this worker being
// stopped, in IndexedDB with the key as a non-extractable CryptoKey; a
// session ends when the page says so or when its sealed-byte link runs out.
var LIB_SESSIONS = new Map();
var LIB_RE = /^\/library-stream\/([A-Za-z0-9_-]{16,64})(?:\/[^/]*)?$/;
var LIB_DB = 'gifos-library-streams';
function libDb() {
  return new Promise(function (ok, no) {
    var r = indexedDB.open(LIB_DB, 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('s'); };
    r.onsuccess = function () { ok(r.result); };
    r.onerror = function () { no(r.error); };
  });
}
function libIdb(mode, fn) {
  return libDb().then(function (db) {
    return new Promise(function (ok, no) {
      var t = db.transaction('s', mode), st = t.objectStore('s'), out = fn(st);
      t.oncomplete = function () { db.close(); ok(out && out.result); };
      t.onerror = function () { db.close(); no(t.error); };
    });
  });
}
async function libSession(sid) {
  var s = LIB_SESSIONS.get(sid);
  if (!s) { try { s = await libIdb('readonly', function (st) { return st.get(sid); }); } catch (err) { s = null; } if (s) LIB_SESSIONS.set(sid, s); }
  if (s && s.exp && Date.now() / 1000 > s.exp) { libEnd(sid); return null; }
  return s || null;
}
function libEnd(sid) {
  LIB_SESSIONS.delete(sid);
  return libIdb('readwrite', function (st) { return st.delete(sid); }).catch(function () {});
}
async function libStart(d) {
  var key = await crypto.subtle.importKey('raw', d.key, { name: 'AES-GCM' }, false, ['decrypt']);
  var s = { src: String(d.src), key: key, parts: d.parts, size: d.size, type: String(d.mime || 'application/octet-stream'), name: String(d.name || 'recording'), partBytes: d.partBytes, plainPart: d.plainPart, exp: d.exp || 0 };
  LIB_SESSIONS.set(d.sid, s);
  try { await libIdb('readwrite', function (st) { return st.put(s, d.sid); }); } catch (err) { /* memory only: a stopped worker ends the stream */ }
  // Sessions past their link's end are dropped whenever a new one starts.
  try {
    var all = await libIdb('readonly', function (st) { return st.getAllKeys(); });
    for (var i = 0; i < (all || []).length; i++) await libSession(all[i]);   // drops the ones past their end
  } catch (err) { /* nothing to prune */ }
}
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type === 'gifos-library-stream' && typeof d.sid === 'string') {
    e.waitUntil(libStart(d).then(function () { if (e.ports[0]) e.ports[0].postMessage({ ok: true }); }, function (err) { if (e.ports[0]) e.ports[0].postMessage({ ok: false, error: String(err && err.message || err) }); }));
  } else if (d.type === 'gifos-library-stream-end' && typeof d.sid === 'string') {
    e.waitUntil(libEnd(d.sid));
  }
});
function libPartAd(n, parts) { return new TextEncoder().encode('gifos-library-part-v1\x00' + n + '\x00' + parts); }
async function libStream(req, sid, url) {
  var s = await libSession(sid);
  var text = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' };
  if (!s) return new Response('This file was closed. Open it again from My library.', { status: 410, headers: text });
  var size = s.size, a = 0, b = size - 1, ranged = false;
  var m = /^bytes=(\d*)-(\d*)$/.exec((req.headers.get('Range') || '').trim());
  if (m && (m[1] !== '' || m[2] !== '')) {
    ranged = true;
    if (m[1] === '') a = Math.max(0, size - Number(m[2]));
    else { a = Number(m[1]); if (m[2] !== '') b = Math.min(Number(m[2]), size - 1); }
    if (!(a <= b) || a >= size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  }
  var n = Math.floor(a / s.plainPart) + 1, last = Math.floor(b / s.plainPart) + 1;
  var body = new ReadableStream({
    // One sealed part is fetched and opened per pull: the stream holds about
    // one part, and a cancelled request (a seek) stops fetching at once.
    pull: async function (ctl) {
      if (n > last) { ctl.close(); return; }
      var from = (n - 1) * s.partBytes;
      var r = await fetch(s.src, { headers: { Range: 'bytes=' + from + '-' + (from + s.partBytes - 1) }, cache: 'no-store' });
      if (!r.ok) { ctl.error(new Error('the library answered ' + r.status)); return; }
      var ct = new Uint8Array(await r.arrayBuffer());
      var pt;
      try { pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ct.subarray(0, 12), additionalData: libPartAd(n, s.parts) }, s.key, ct.subarray(12))); }
      catch (err) { ctl.error(new Error('this part did not open with its key')); return; }
      var base = (n - 1) * s.plainPart;
      ctl.enqueue(pt.subarray(Math.max(a, base) - base, Math.min(b, base + pt.length - 1) - base + 1));
      n++;
    },
  }, { highWaterMark: 1 });
  var h = {
    'Content-Type': s.type, 'Content-Length': String(b - a + 1), 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store',
    'Content-Disposition': (url.searchParams.get('dl') === '1' ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(s.name),
  };
  if (ranged) h['Content-Range'] = 'bytes ' + a + '-' + b + '/' + size;
  return new Response(body, { status: ranged ? 206 : 200, headers: h });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  // Cross-origin (relay wss handled elsewhere, CORS proxy, AI, GitHub, key
  // servers): never intercept. They behave exactly as before — working online,
  // failing offline with the app's own messaging.
  if (url.origin !== self.location.origin) return;
  // My library: a decrypted stream of a sealed file (see libStream above).
  if (url.pathname === '/library-stream/ping') { e.respondWith(new Response(null, { status: 204, headers: { 'X-Gifos-Library-Stream': '1', 'Cache-Control': 'no-store' } })); return; }
  var lm = LIB_RE.exec(url.pathname);
  if (lm) { e.respondWith(libStream(req, lm[1], url)); return; }

  // version.json + changelog.json drive the OPT-IN update flow: always try the
  // network so a reconnected device can SEE that a new release (and its notes)
  // exist; fall back to cache offline. These are data the desktop reads to decide
  // whether to OFFER an update — they never change the running shell themselves.
  if (url.pathname === '/version.json' || url.pathname === '/changelog.json') {
    e.respondWith(fetch(req).then(function (r) {
      if (r && r.ok) { var c = r.clone(); caches.open(CACHE).then(function (ch) { ch.put(url.pathname, c); }); }
      return r;
    }).catch(function () { return caches.match(url.pathname); }));
    return;
  }

  // The App Store catalog is the same KIND of data — read to decide whether to
  // OFFER an update, never to change the running shell — with one difference
  // that earns it its own rule: it is fetched at every app LAUNCH
  // (app-update.js), not only when someone browses the store. So it gets ONE
  // normalized cache key, whatever query string a caller carries.
  //
  // The catch-all below caches by full URL. A launch fetch carrying a `?ts=`
  // cache-buster is therefore a NEW key every time, and left another 181 KB
  // copy of the catalog in the shell cache, forever, on a phone (measured
  // 2026-08-25: 543 KB after three launches, growing without bound). Worse, the
  // offline/slow fallback matches with ignoreSearch, so it then answered from an
  // ARBITRARY one of those copies: a launch on a link too slow for the 4 s race
  // compared against a STALE catalog and said nothing about an update that was
  // really there. One key is bounded, and its fallback is the LAST GOOD catalog.
  if (url.pathname === '/apps/index.json') {
    e.respondWith((async function () {
      var cache = await caches.open(CACHE);
      var fresh = await revalidate(url.pathname, cache, 4000);
      if (fresh) return fresh;
      var cached = await cache.match(url.pathname);
      if (cached) return cached;                   // offline → the last catalog we saw
      return degrade(req, url, cache);
    })());
    return;
  }

  // Archived release builds under /versions/<x.y.z>/ are IMMUTABLE snapshots:
  // CACHE-FIRST with NO background revalidation. A pinned/release user lives
  // entirely under /versions/, so a refresh or hard-refresh serves the SAME build
  // every time — the computer is never updated behind their back; the opt-in flow
  // (Settings → Advanced → Version) is the only thing that moves it. (Only a build
  // never cached before — e.g. an archived version opened for the first time —
  // reaches the network here, and gets cached for offline.)
  if (url.pathname.lastIndexOf('/versions/', 0) === 0) {
    e.respondWith((async function () {
      var cache = await caches.open(CACHE);
      var cached = await fromCache(cache, keyOf(url), await cache.match(keyOf(url)));
      if (cached) return cached;                   // immutable snapshot wins; no silent refresh
      // A page load still gives up after 4 s, so an offline device sees the
      // "not installed" page instead of a hang. A script or stylesheet waits
      // for the network: on a slow phone a late file is NOT a missing file,
      // and degrade()'s empty stand-in would leave the page unstyled with a
      // dead menu. Only a real network failure (offline) gets the stand-in.
      if (req.mode === 'navigate') {
        var fresh = await raceNetwork(req, cache, 4000, keyOf(url));
        if (fresh) return fresh;
        var clean = cleanOf(url.pathname);
        if (clean && await cache.match(clean)) return Response.redirect(url.origin + clean + url.search, 308);
        return degrade(req, url, cache);
      }
      try {
        // A redirected answer is handed on plain as well as kept plain: Firefox
        // never settles a page's fetch that the worker answers with the
        // redirected response itself (the page's fetch('run.html') hung).
        var res = await plain(await fetch(req));
        if (res && res.ok && (res.type === 'basic' || res.type === 'default')) {
          keep(cache, keyOf(url), res.clone()).catch(function () {});
        }
        return res;
      } catch (err) {
        return degrade(req, url, cache);
      }
    })());
    return;
  }

  // An App Store download is a one-shot transfer, not shell. Chess Grandmaster
  // is 8 MB; the catch-all below would put every installed app permanently into
  // the shell cache, on a phone, duplicating bytes that are already saved in
  // IndexedDB by the time the store is done with them. Straight to the network,
  // cached nowhere. (The catalog JSON and the covers are small and DO fall
  // through to the normal revalidate path — that is what makes the store's
  // browse view fast on a second visit.)
  if (/^\/apps\/[a-z0-9-]+\/[^/]+\.gif$/i.test(url.pathname)) return;

  // Everything else is the EDGE (site-root) shell. A visitor on the edge channel
  // is served from the root (release users are redirected to /versions/), and edge
  // means "track the newest build on GitHub Pages." So NETWORK-FIRST with
  // revalidation: a conditional GET checks the server every load — an unchanged
  // asset comes back 304 and reuses the cache (no re-download), a changed one is
  // regrabbed fresh. Fall back to the cache when offline or too slow, so the shell
  // still boots and airplane mode still works.
  e.respondWith((async function () {
    var cache = await caches.open(CACHE);
    // Navigations let a redirect through: on Pages a directory URL without
    // its slash is a 301, and pretty links are rewritten (200) to route.html, the pretty-link
    // router. See revalidate()'s note. The key is the bare path — see keyOf.
    var fresh = await revalidate(req, cache, 4000, req.mode === 'navigate', keyOf(url));
    if (fresh) return fresh;
    // An offline .html address gets the host's own answer, a redirect to the
    // clean path, whenever this device has the page there (as /versions/ does).
    var clean = req.mode === 'navigate' ? cleanOf(url.pathname) : '';
    if (clean && await cache.match(clean)) return Response.redirect(url.origin + clean + url.search, 308);
    var cached = await fromCache(cache, keyOf(url), await cache.match(keyOf(url)));
    if (cached) return cached;                      // offline / stalled → the newest copy this device ran
    return degrade(req, url, cache);
  })());
});

// ---- THE DOORBELL (js/meet-bell.js; docs: My Room). A ring pushed by bell.gifos.app wakes this worker with the
// page closed. The push says which handle rang (i), the call (c), the Doorbell's time (ts) and the note (n), sealed by
// the caller with that handle's ring secret. The page keeps in IndexedDB 'gifos-bell' what this worker needs: the
// master secret the ring secrets come from, handle id -> {url (the room's address), key, label}, and how long a ring rings. A note
// that opens is shown as "<label> is calling" (or a missed call when it arrives after the ring would have ended); the
// tap opens the room that handle belongs to. Every push shows a notification (browsers require it), except while a
// visible GifOS page already has that room open: it rings there.
function bellDb() {
  return new Promise(function (resolve, reject) {
    var q = indexedDB.open('gifos-bell', 1);
    q.onupgradeneeded = function () { q.result.createObjectStore('kv'); };
    q.onsuccess = function () { resolve(q.result); };
    q.onerror = function () { reject(q.error); };
  });
}
function bellGet(db, k) { return new Promise(function (res) { var q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = function () { res(q.result); }; q.onerror = function () { res(undefined); }; }); }
function bellPut(db, k, v) { return new Promise(function (res) { var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = function () { res(true); }; t.onerror = function () { res(false); }; }); }
function bellB64u(t) { var s = String(t).replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - (s.length % 4)) % 4); var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
async function bellOpen(masterB64u, i, k, note) {
  var te = new TextEncoder();
  var mk = await crypto.subtle.importKey('raw', bellB64u(masterB64u), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  var s = new Uint8Array(await crypto.subtle.sign('HMAC', mk, te.encode('gifos-bell-handle|' + i + '|' + k)));
  var k = await crypto.subtle.importKey('raw', s, 'AES-GCM', false, ['decrypt']);
  var u = bellB64u(note);
  var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12), additionalData: te.encode('gifos-bell-note') }, k, u.slice(12));
  return JSON.parse(new TextDecoder().decode(pt));
}
function bellTime(at) { try { return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
// ONE NOTIFICATION PER CALLER, UPDATED IN PLACE (tag gifos-call-<handle>): the ring; unanswered, the same notification is
// the record of the call (a tap calls back) and turns into "Missed call" at the next ring; that person's next call replaces it. Chrome on Android judges every notification it shows:
// an on-device model reads the title, the body and the button texts and swaps one it finds spammy for "Possible spam", and a
// site that shows many notifications nobody opens loses its permission. Measured on a phone: call words on buttons
// ("Answer", "Pick up", "Join") and phrases like "X is calling" or "Incoming call" trip it for common contact names
// ("Dad", "Mom"); the contact's name with its ✓ over the time is clean for all of them, and so is "Missed call: X ✓" with
// Call back. So the ring is the name and the time, a tap answers it, a swipe turns it down, and a call shows once.
var BELL_ICON = '/themes/call-icon-192.png', BELL_BADGE = '/themes/call-badge-96.png';
var BELL_TXT = { ring: 'GifOS call', missed: 'Missed call', back: 'Call back' };
function bellTag(i) { return 'gifos-call-' + String(i || 'x'); }
function bellMissed(label, when, url, i, r, c) {
  return self.registration.showNotification(BELL_TXT.missed + ': ' + label, {
    body: bellTime(when), tag: bellTag(i), renotify: false, silent: true, icon: BELL_ICON, badge: BELL_BADGE, timestamp: when,
    actions: [{ action: 'back', title: BELL_TXT.back }],
    data: { kind: 'missed', url: url, r: r, c: c, i: i },
  });
}
async function bellPush(e) {
  var m = null; try { m = e.data ? e.data.json() : null; } catch (err) { m = null; }
  if (m && m.t === 'test') return self.registration.showNotification('GifOS doorbell', { body: 'Rings reach this device.', tag: 'gifos-bell-test', icon: BELL_ICON, badge: BELL_BADGE });
  var db = await bellDb(), st = (await bellGet(db, 'state')) || {}, at = (st.map || {})[m && m.i] || null;
  var note = null;
  if (m && m.t === 'ring' && at && st.master) { try { note = await bellOpen(st.master, m.i, at.k, m.n); } catch (err) { note = null; } }
  if (!note || note.c !== m.c) {
    // A push this device cannot open (a handle it does not know): still shown, with no name, and it opens the lobby.
    return self.registration.showNotification('GifOS doorbell', { body: 'Someone rang your doorbell.', tag: 'gifos-bell-unknown', data: { url: '/meet' }, icon: BELL_ICON, badge: BELL_BADGE });
  }
  // A name is the owner's own label, else the caller's: one short line of plain text either way. The ✓: only a contact
  // who proved a member key of our private room holds a handle, so every ring that opens is from someone I know.
  var label = String(at.label || note.n || 'Someone').replace(/[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩✓✔]/g, '').trim().slice(0, 40) || 'Someone';
  label += ' ✓';
  var when = +m.ts || Date.now(), ringMs = st.ringMs || 30000;
  var rings = (await bellGet(db, 'rings')) || [];
  rings.unshift({ i: m.i, c: m.c, at: when, label: label, url: at.url, done: false });
  await bellPut(db, 'rings', rings.slice(0, 50));
  var url = String(at.url || '/meet'), r = String(at.r || '');
  if (Date.now() - when > ringMs) { await bellStale(ringMs, bellTag(m.i)); return bellMissed(label, when, url, m.i, r, m.c); }   // it came after the ring would have ended (Doze)
  var wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (var w = 0; w < wins.length; w++) {
    try { if (wins[w].visibilityState === 'visible' && new URL(wins[w].url).hash === new URL(url, self.location.origin).hash) return; } catch (err) {}
  }
  var tag = bellTag(m.i);
  await bellStale(ringMs, tag);
  // The push event ends with the ring on screen. (Held open until the ring ends, a ring the person swiped away left the
  // event with nothing on screen, and Chrome then shows its own "updated in the background" notice.) An unanswered ring
  // stays as the record of the call (the name, the time); a tap on it later calls back.
  return self.registration.showNotification(label, {
    body: bellTime(when) + ' \u00b7 ' + BELL_TXT.ring,
    tag: tag, renotify: true, requireInteraction: true, timestamp: when,
    vibrate: [800, 400, 800, 400, 800, 400, 800],
    data: { kind: 'ring', url: url, r: r, c: m.c, i: m.i, label: label, at: when, ms: ringMs },
    icon: BELL_ICON, badge: BELL_BADGE,
  });
}
// Rings still on screen whose time has passed (nobody answered, nobody swiped) become missed calls, in place and silent,
// whenever this worker next runs for a ring. Not the one the new ring replaces anyway (skip): Android drops an update that
// comes right on top of another to the same notification, and that would be the new ring.
async function bellStale(ringMs, skip) {
  var open = []; try { open = await self.registration.getNotifications(); } catch (err) { open = []; }
  for (var n = 0; n < open.length; n++) {
    var d = open[n].data || {};
    if (d.kind === 'ring' && open[n].tag !== skip && Date.now() - (+d.at || 0) > ringMs) await bellMissed(d.label || open[n].title, d.at, d.url, d.i, d.r, d.c);
  }
}
self.addEventListener('push', function (e) { e.waitUntil(bellPush(e).catch(function () {})); });
// Answer (or Call back) goes straight into the private room: a tab already there comes to the front; a GifOS tab that is
// not in a meeting (Home, Rooms, the lobby) goes there; else a new tab. The note in IndexedDB 'answer' tells that page the
// tap was its person's Answer (js/meet-bell.js takeAnswer): the mic opens, the camera stays off, no card in the way.
async function bellGo(url, r, c) {
  var to = new URL(url, self.location.origin);
  try { var db = await bellDb(); await bellPut(db, 'answer', { r: r, c: c, at: Date.now() }); } catch (err) {}
  var wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  var same = function (u) { try { var x = new URL(u); return x.origin === to.origin && x.pathname.replace(/\.html$/, '') === to.pathname && x.hash === to.hash; } catch (err) { return false; } };
  var inMeeting = function (u) { try { var x = new URL(u); return /^\/(meet|cast|join)(\.html)?\/?$/.test(x.pathname) && /(^#|&)room=/.test(x.hash); } catch (err) { return true; } };
  for (var a = 0; a < wins.length; a++) if (same(wins[a].url)) { try { return await wins[a].focus(); } catch (err) {} }
  for (var b = 0; b < wins.length; b++) {
    if (inMeeting(wins[b].url) || typeof wins[b].navigate !== 'function') continue;
    try { var f = await wins[b].focus(); var nv = await (f || wins[b]).navigate(to.href); if (nv) return nv; } catch (err) {}
  }
  return self.clients.openWindow(to.href);
}
async function bellMark(c, how) {
  try { var db = await bellDb(), rings = (await bellGet(db, 'rings')) || []; await bellPut(db, 'rings', rings.map(function (x) { return x.c === c ? Object.assign({}, x, { done: true, how: how }) : x; })); } catch (err) {}
}
// A ring swiped away is a call turned down: no missed call follows it.
self.addEventListener('notificationclose', function (e) {
  var d = (e.notification && e.notification.data) || {};
  if (d.kind === 'ring') e.waitUntil(bellMark(d.c, 'declined'));
});
self.addEventListener('notificationclick', function (e) {
  var d = (e.notification && e.notification.data) || {}, act = e.action || '';
  e.notification.close();
  if (!d.url) return;
  e.waitUntil((async function () {
    if (d.kind === 'ring') {
      await bellMark(d.c, Date.now() - (+d.at || 0) > (+d.ms || 0) ? 'called back' : 'answered');   // a tap on the ring is its Answer (later: a call back)
      return bellGo(d.url, d.r, d.c);
    }
    if (d.kind === 'missed') {
      if (act === 'back') return bellGo(d.url, d.r, d.c);   // a call back: our private room, mic on as for an Answer
      return self.clients.openWindow('/rooms');             // the missed call itself: the Rooms page, which lists it
    }
    return self.clients.openWindow(d.url);
  })());
});
