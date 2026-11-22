/*
 * node.js: the GifOS core in Node. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * createMeeting(opts) runs ONE meeting participant with no browser: the core part (meeting.js) and the page
 * libraries it is built on (files.json "core"), linked by host.js with no media part and no view.
 *
 * ONE CONTEXT PER PARTICIPANT. The libraries keep their state on `GifOS`, and `location`, `localStorage` and the
 * timers belong to one page, so every participant gets its own vm context. The scripts are compiled once per process
 * and run in each context.
 *
 * WHAT THE HOST SUPPLIES (js/core/platform.json "platform"): what a browser gives a page and Node has too (timers,
 * console, crypto, fetch, WebSocket, TextEncoder/TextDecoder, URL, performance, atob/btoa, Blob, AbortController, events
 * on the global), plus a `location` parsed from opts.url, a `navigator`, and Map-backed `localStorage`/`sessionStorage`.
 * A platform name Node does not have (Audio, Worker, MediaMetadata, ...) reads as undefined, as in a browser without
 * that feature; the page has a path for each (a Worker clock falls back to setInterval, for one).
 *
 * THE MEDIA PORT (opts.webrtc): W3C-shaped constructors (RTCPeerConnection, RTCSessionDescription, RTCIceCandidate,
 * MediaStream, ...), or a function (realm) -> those constructors, called once per participant with the context's own
 * builtins so a port can hand the page values of its own realm. ports/loopback.js is an in-process port that carries
 * data channels only. With no port the participant has no peer connections.
 *
 * THE VIEW. A host with no screen links a headless view of its own (see THE HEADLESS VIEW below): the view's names
 * are counted stand-ins, so standIns() counts both what the core asked of the view and of the media plane.
 *
 * WHAT THE CORE STILL ASKS OF THE PAGE (platform.json "page": document, getComputedStyle, requestAnimationFrame, ...)
 * reads as a counted placeholder (host.js): every use runs and does nothing, and is counted by pageUses(). `window`
 * and `self` are the context's own global (as on a page) and `Event` is the platform's own. A name of the view part,
 * which a host with no screen does not load, is stood in for by the linker and counted by standIns(). The two lists
 * together are what stands between the core and a core with no page in it.
 *
 * HOST SHIMS, each standing in for a page script that is not part of the core:
 *   document.currentScript  while a library runs, { src } of its URL on the page's origin (libraries find their
 *                   own folder by it); null after.
 *   document.hidden, document.visibilityState  a host with no screen is never a hidden tab: false and 'visible'
 *                   (the core's background-tab paths are for a browser that hides the page). Counted all the same.
 *   GifOS.meshMedia.workerClock  the core's background-proof interval lives in the media library (js/mesh-media.js),
 *                   which a host without the browser media part does not load. The shim is that library's own path
 *                   when there is no Worker: a plain interval, with the same { via, stop() } handle.
 *   GifOS.runtime   the app runtime (js/runtime.js) is a page library. At start the core reads its page-header table
 *                   only to hand the choice to the view; the shim is an empty table, so the (absent) view gets none.
 *   WEBKIT_ENGINE   the page sets it in a head script from navigator.vendor; a Node host is not WebKit: false.
 *   gifosAgent      the page publishes the agent contract (js/meet-agent.js) from a view function; with agent=1 or
 *                   bot=1 in the URL this host makes and starts it the same way, from the core's own agent host.
 *
 * Errors thrown by a timer, socket or channel callback are kept per participant (errors()) and do not stop the
 * process, as a browser reports them to the console and runs on.
 */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');

const HERE = __dirname;
const scripts = new Map();   // absolute path -> vm.Script (compiled once per process)

// View functions whose result the core takes apart: what each returns in the headless view (all counted placeholders).
const VIEW_RECORDS = {
  makeTile: ['tile', 'video', 'label', 'avatar', 'chips', 'cap', 'modbar', 'voteBtn'],   // a participant's tile and its parts
};

function script(file) {
  let s = scripts.get(file);
  if (!s) { s = new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file }); scripts.set(file, s); }
  return s;
}

// ---- storage -------------------------------------------------------------------------------------------------
// The Storage shape over a Map. `backing` (optional, a plain object) is read at start and written through.
function makeStorage(backing) {
  const m = new Map();
  if (backing) for (const k of Object.keys(backing)) m.set(k, String(backing[k]));
  const put = (k, v) => { if (backing) { if (v === null) delete backing[k]; else backing[k] = v; } };
  const s = {
    getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); put(String(k), String(v)); },
    removeItem: (k) => { m.delete(String(k)); put(String(k), null); },
    clear: () => { for (const k of m.keys()) put(k, null); m.clear(); },
    key: (i) => Array.from(m.keys())[i] ?? null,
  };
  Object.defineProperty(s, 'length', { get: () => m.size });
  return s;
}

// ---- location ------------------------------------------------------------------------------------------------
function makeLocation(href, note) {
  let u = new URL(href);
  const loc = {};
  for (const k of ['href', 'origin', 'protocol', 'host', 'hostname', 'port', 'pathname', 'search', 'hash']) {
    Object.defineProperty(loc, k, {
      get: () => u[k],
      set: k === 'origin' ? undefined : (v) => { const old = u.hash; u[k] = v; note.change(old, u.hash); },
      enumerable: true,
    });
  }
  // A host cannot load another document: these are counted as page uses and change only the URL it holds.
  loc.assign = (v) => { note.use('location.assign'); u = new URL(v, u); };
  loc.replace = (v) => { note.use('location.replace'); u = new URL(v, u); };
  loc.reload = () => { note.use('location.reload'); };
  loc.toString = () => u.href;
  return loc;
}

// The site's own files: a fetch of the page's origin reads the app tree (the files a site server would serve).
function siteFetch(appRoot, location, realFetch) {
  return function fetch(input, init) {
    const raw = typeof input === 'string' ? input : (input && input.url) || String(input);
    const u = new URL(raw, location.href);
    if (u.origin === location.origin && appRoot) {
      const file = path.join(appRoot, decodeURIComponent(u.pathname));
      if (!file.startsWith(appRoot)) return Promise.resolve(new Response('', { status: 403 }));
      return fs.promises.readFile(file).then(
        (b) => new Response(b, { status: 200, headers: { 'content-type': /\.json$/.test(file) ? 'application/json' : 'application/octet-stream' } }),
        () => new Response('not found', { status: 404 }));
    }
    return realFetch(u.href, init);
  };
}

// ---- the participant -----------------------------------------------------------------------------------------
function createMeeting(opts) {
  opts = opts || {};
  if (!opts.url) throw new Error('createMeeting: opts.url is the meeting URL');
  const appRoot = path.resolve(opts.appRoot || path.join(HERE, '..', '..'));
  const files = JSON.parse(fs.readFileSync(path.join(appRoot, 'js', 'core', 'files.json'), 'utf8'));
  const platform = JSON.parse(fs.readFileSync(path.join(appRoot, 'js', 'core', 'platform.json'), 'utf8'));
  const log = typeof opts.log === 'function' ? opts.log : null;

  const pageCounts = new Map();
  const count = (note, k) => { const key = note + (k != null ? '.' + String(k) : ''); pageCounts.set(key, (pageCounts.get(key) || 0) + 1); };
  const errors = [];
  const fail = (where, e) => { errors.push({ where, at: Date.now(), error: String((e && e.stack) || e) }); if (log) log('error', where, e); };
  const guard = (where, fn) => function () { try { return fn.apply(this, arguments); } catch (e) { fail(where, e); } };

  // events on the global (window.addEventListener ...)
  const bus = new EventTarget();
  const g = {};
  let closed = false;

  // timers: browser-shaped numeric ids, every one held so close() can stop the participant
  const timers = new Map();
  let nextTimer = 1;
  const setT = (fn, ms, ...a) => {
    if (closed) return 0;
    const id = nextTimer++;
    timers.set(id, setTimeout(() => { timers.delete(id); try { if (typeof fn === 'function') fn(...a); } catch (e) { fail('timer', e); } }, ms));
    return id;
  };
  const setI = (fn, ms, ...a) => {
    if (closed) return 0;
    const id = nextTimer++;
    timers.set(id, setInterval(() => { try { if (typeof fn === 'function') fn(...a); } catch (e) { fail('interval', e); } }, Math.max(1, +ms || 0)));
    return id;
  };
  const clearT = (id) => { const h = timers.get(id); if (h) { clearTimeout(h); clearInterval(h); timers.delete(id); } };

  // sockets: the platform's WebSocket, with callback errors kept and every socket closed by close()
  const sockets = new Set();
  const RealWS = globalThis.WebSocket;
  class WebSocketHost extends RealWS {
    constructor(url, protocols) { super(url, protocols); sockets.add(this); this.addEventListener('close', () => sockets.delete(this)); }
    addEventListener(t, f, o) { return super.addEventListener(t, typeof f === 'function' ? (f.__g || (f.__g = guard('socket ' + t, f))) : f, o); }
    removeEventListener(t, f, o) { return super.removeEventListener(t, (f && f.__g) || f, o); }
  }
  for (const t of ['open', 'message', 'close', 'error']) {
    Object.defineProperty(WebSocketHost.prototype, 'on' + t, {
      get() { return this['__on' + t] || null; },
      set(f) { if (this['__on' + t]) this.removeEventListener(t, this['__on' + t]); this['__on' + t] = f; if (typeof f === 'function') this.addEventListener(t, f); },
    });
  }

  const location = makeLocation(opts.url, {
    use: (what) => count('page:' + what),
    change: (oldHash, newHash) => { if (oldHash !== newHash) setT(() => g.dispatchEvent(new Event('hashchange'))); },
  });

  const place = (note) => require('./host.js').placeholder(note, count);
  const subtle = nodeCrypto.webcrypto.subtle;

  Object.assign(g, {
    console: ['log', 'info', 'warn', 'error', 'debug', 'trace'].reduce((c, k) => { c[k] = (...a) => { if (log) log(k, ...a); }; return c; }, { table() {}, group() {}, groupEnd() {}, groupCollapsed() {}, time() {}, timeEnd() {}, assert() {}, count() {} }),
    setTimeout: setT, setInterval: setI, clearTimeout: clearT, clearInterval: clearT,
    queueMicrotask: (fn) => queueMicrotask(() => { try { fn(); } catch (e) { fail('microtask', e); } }),
    fetch: siteFetch(appRoot, location, globalThis.fetch),
    Response: globalThis.Response, Request: globalThis.Request, Headers: globalThis.Headers,
    WebSocket: WebSocketHost, TextDecoder, URL, URLSearchParams, performance, structuredClone, atob, btoa,
    AbortController, AbortSignal, Blob, Event, CustomEvent, EventTarget, MessageChannel, DOMException,
    addEventListener: (t, f, o) => bus.addEventListener(t, typeof f === 'function' ? (f.__g || (f.__g = guard('event ' + t, f))) : f, o),
    removeEventListener: (t, f, o) => bus.removeEventListener(t, (f && f.__g) || f, o),
    dispatchEvent: (e) => bus.dispatchEvent(e),
    // A top-level page posts to itself: delivered later, from its own origin.
    postMessage: (data) => setT(() => { const e = new Event('message'); Object.assign(e, { data, origin: location.origin, source: g }); bus.dispatchEvent(e); }),
    location,
    navigator: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) GifOS-Core/1 Node/' + process.versions.node, vendor: '', onLine: true,
      hardwareConcurrency: require('os').cpus().length, language: 'en-US', languages: ['en-US'], platform: 'Linux' },
    localStorage: makeStorage(opts.storage), sessionStorage: makeStorage(null),
    WEBKIT_ENGINE: false,
  });
  const realmOf = (ctx) => vm.runInContext('({ Uint8Array, ArrayBuffer, Map, Promise, Array, Object, Error })', ctx);

  // every name the core reads off its platform: a Node host without it reads undefined (never a ReferenceError)
  for (const part of ['core']) for (const n of platform[part].platform) if (!(n in g) && n !== 'GifOS') g[n] = undefined;
  // what the core still asks of the page: counted placeholders
  for (const n of platform.core.page) if (!(n in g) && n !== 'window' && n !== 'Event') g[n] = place('page:' + n);
  // document.currentScript: the host knows which library it is running (the libraries find their own folder by it)
  let current = null;
  if (g.document) {
    const docPh = g.document;
    const known = { hidden: () => false, visibilityState: () => 'visible', currentScript: () => current };
    g.document = new Proxy(docPh, { get: (t, k) => (Object.prototype.hasOwnProperty.call(known, k) ? (count('page:document', k), known[k]()) : docPh[k]) });
  }

  const context = vm.createContext(g, { name: 'gifos participant' });
  g.window = g.self = g.globalThis = g.parent = g.top = context;
  if (opts.webrtc) {
    const port = typeof opts.webrtc === 'function' ? opts.webrtc(realmOf(context)) : opts.webrtc;
    for (const k of Object.keys(port || {})) g[k] = port[k];
  }
  // crypto.subtle results are this realm's ArrayBuffers in the page's own realm
  const R = realmOf(context);
  const own = (v) => (v instanceof ArrayBuffer ? new R.Uint8Array(new Uint8Array(v)).buffer : v);
  const csub = {};
  for (const k of ['digest', 'encrypt', 'decrypt', 'sign', 'verify', 'importKey', 'exportKey', 'generateKey', 'deriveKey', 'deriveBits', 'wrapKey', 'unwrapKey']) {
    csub[k] = (...a) => new R.Promise((res, rej) => subtle[k](...a).then((v) => res(own(v)), rej));
  }
  g.crypto = { subtle: csub, getRandomValues: (a) => nodeCrypto.webcrypto.getRandomValues(a), randomUUID: () => nodeCrypto.randomUUID() };
  const te = new TextEncoder();
  g.TextEncoder = class TextEncoder { get encoding() { return 'utf-8'; } encode(s) { return new R.Uint8Array(te.encode(s)); } };

  for (const rel of files.core) {
    current = { src: new URL(rel, location.href).href };
    try { script(path.join(appRoot, rel)).runInContext(context); } finally { current = null; }
  }
  const GifOS = context.GifOS;
  // GifOS.meshMedia.workerClock (see HOST SHIMS)
  if (!GifOS.meshMedia) {
    GifOS.meshMedia = { workerClock(ms, fn) { const id = setI(fn, Math.max(1, ms | 0)); return { via: 'interval', stop() { clearT(id); } }; } };
  }
  // GifOS.runtime (see HOST SHIMS)
  if (!GifOS.runtime) GifOS.runtime = { SYSTEM_HEADER: {} };
  // THE HEADLESS VIEW: a view part of this host's own, in place of the page's. Every name the core asks of the view
  // is the linker's counted stand-in (a function does nothing and returns undefined), except the view functions
  // whose result the core takes apart, which return a record of counted placeholders (VIEW_RECORDS).
  const corePart = GifOS.coreParts.core;
  const viewCounts = new Map();
  const viewNames = GifOS.core.standIn('view', (corePart.needs && corePart.needs.view) || {}, viewCounts);
  for (const [fn, fields] of Object.entries(VIEW_RECORDS)) {
    if (!Object.prototype.hasOwnProperty.call(viewNames, fn)) continue;
    const vcount = (note, k) => { const key = note + (k != null ? '.' + String(k) : ''); viewCounts.set(key, (viewCounts.get(key) || 0) + 1); };
    const f = function () { vcount('view.' + fn + '()'); const r = {}; for (const k of fields) r[k] = GifOS.core.placeholder('view.' + fn + '().' + k, vcount); return r; };
    Object.defineProperty(viewNames, fn, { get: () => f, enumerable: true, configurable: true });
  }
  const headlessView = { name: 'view', stamp: corePart.stamp, needs: {}, run: function* (L) { Object.defineProperties(L.view, Object.getOwnPropertyDescriptors(viewNames)); return L.END; } };
  const meeting = GifOS.core.link({ core: corePart, view: headlessView });
  GifOS.core.meeting = meeting;
  let ran = false;
  try { ran = meeting.run(); } catch (e) { fail('run', e); }

  // gifosAgent (see HOST SHIMS)
  const q = new URLSearchParams(location.hash.slice(1) + '&' + location.search.slice(1));
  if ((q.get('agent') === '1' || q.get('bot') === '1') && !context.gifosAgent) {
    try {
      const C = meeting.core;
      if (!C.agentCore && GifOS.meetAgent && typeof C.agentHost === 'function') C.agentCore = GifOS.meetAgent.make(C.agentHost());
      if (C.agentCore) { context.gifosAgent = C.agentCore.api; C.agentCore.start(); }
    } catch (e) { fail('agent', e); }
  }

  function close() {
    if (closed) return;
    try { const v = context.__gifosVideo; if (v && typeof v.leave === 'function') v.leave(); } catch (e) {}
    closed = true;
    for (const h of timers.values()) { clearTimeout(h); clearInterval(h); }
    timers.clear();
    for (const s of sockets) { try { s.close(); } catch (e) {} }
    try { if (typeof opts.onClose === 'function') opts.onClose(context); } catch (e) {}
  }

  return {
    context, meeting, ran,
    agent: () => context.gifosAgent,
    hooks: () => context.__gifosVideo,
    standIns: () => meeting.standIns().concat(Array.from(viewCounts)).sort((a, b) => b[1] - a[1]),
    pageUses: () => Array.from(pageCounts).sort((a, b) => b[1] - a[1]),
    errors: () => errors.slice(),
    close,
  };
}

module.exports = { createMeeting, makeStorage };
