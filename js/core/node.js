/*
 * node.js: the GifOS core in Node. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * createMeeting(opts) runs ONE meeting participant with no browser: the core part (meeting.js) and the page
 * libraries it is built on (files.json "core"), linked by host.js with no media part and no view.
 *
 * OPTIONS: url (a meeting link or the page address: routed as the site's router does, pageUrl), site (loadSite(origin):
 * the core's files from the meeting's own site, as a browser loads them; or siteDir(tree)), else appRoot (a site tree on
 * disk), webrtc (the media port, below), storage / session (plain objects backing localStorage / sessionStorage, read
 * at start and written through: the participant's profile), globals (names set on the participant's global before
 * the scripts run, as a page's head script would), log(level, ...args), onClose(context).
 * Returns { context, meeting, agent(), hooks(), standIns(), pageUses(), hostShims(), errors(), close(), kill() }:
 * close() leaves the meeting (its farewell drains first; a promise), kill() vanishes with no goodbye.
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
 * THE MEDIA PLANE (opts.media = { Opus }: an Opus codec constructor, opusscript-shaped; needs a webrtc port with real
 * tracks, werift). The host builds the site's ports/webaudio.js (files.json "nodeMedia".host) in its own realm and puts
 * its AudioContext on the participant's global, then links the site's media/plane-node.js ("nodeMedia".plane) as the
 * media plane: the core's media plan is carried out on werift senders (main senders, the agent's voice), received audio
 * is heard (meters, audio.in), exactly as a page does. Without opts.media the participant carries data only.
 *
 * THE VIEW. A host with no screen links a headless view of its own (see THE HEADLESS VIEW below): the view's names
 * are counted stand-ins, so standIns() counts both what the core asked of the view and of the media plane.
 *
 * THE PAGE IS NOT HERE. The page globals the core part still names (platform.json "page": document, getComputedStyle,
 * requestAnimationFrame, history, innerWidth, HTMLVideoElement, MutationObserver, ...) are present only so that a use
 * fails loudly: any member read, call or conversion THROWS an error naming the global and the member, and is counted
 * by pageUses() first. `window` and `self` are the context's own global (as on a page) and `Event` is the platform's
 * own. A VARIABLE of the view part (an element) throws too (host.js); a view FUNCTION does nothing and returns
 * undefined (the core's one road to the screen). Media stand-ins stay counted placeholders until the media port is
 * narrowed. pageUses() empty is the bar: the core asked the page nothing.
 *
 * HOST SHIMS, each standing in for a page script that is not part of the core (counted by hostShims(), not pageUses()):
 *   document.currentScript  while a library runs, { src } of its URL on the page's origin (libraries find their
 *                   own folder by it, js/gifos-ed.js at load); null after.
 *   document.hidden, document.visibilityState, document.addEventListener/removeEventListener  for the core LIBRARIES'
 *                   typeof-guarded page paths (js/gifos-net.js wakes its socket on visibilitychange/resume): never a
 *                   hidden tab, and no event ever fires. The meeting itself asks GifOS.host.hidden() instead.
 *   GifOS.meshMedia.workerClock  the core's background-proof interval lives in the media library (js/mesh-media.js),
 *                   which a host without the browser media part does not load. The shim is that library's own path
 *                   when there is no Worker: a plain interval, with the same { via, stop() } handle.
 *   GifOS.host      the host's facts (run.html sets them from its document): never a hidden tab, framed by no page,
 *                   always able to hold a meeting, no page scripts to reload (this host loads files.json itself), and no
 *                   screen (a viewport of 0 x 0: nothing is in view).
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
const nodeCrypto = require('crypto');

const HERE = typeof __dirname === 'string' ? __dirname : '';
const scripts = new Map();   // site id + file -> vm.Script (compiled once per process)

// View functions whose result the core takes apart: what each returns in the headless view (all counted placeholders).
const VIEW_RECORDS = {
  makeTile: ['tile', 'video', 'label', 'avatar', 'chips', 'cap', 'modbar', 'voteBtn'],   // a participant's tile and its parts
};

// MEDIA-ACTS:BEGIN (generated by the core28 media-calls tool from meeting.js; do not edit by hand)
const MEDIA_ACTS = new Set([
  'adapt', 'adoptClaim', 'applyBuses', 'applyCcAll', 'applyGrid', 'armAudioKeepAlive', 'attachLocalTracks',
  'bindClaim', 'blurSized', 'ccMixStop', 'ccMixSync', 'clockSample', 'closeCamChooser', 'detachTrack',
  'dropContainer', 'dropEndedRemoteTracks', 'dutyMuteTick', 'headLinkUp', 'holdMainVideo', 'keepAwake',
  'keepMeetingAudio', 'kfEv', 'kickJob', 'kickMainAudio', 'kickMainVideo', 'kickStageMic', 'maybeShowFlip',
  'noteAudioDevices', 'noteReship', 'paintTiming', 'parkSender', 'playTileVideo', 'producerKey', 'quietAtDoor',
  'reactSing', 'recDraw', 'recNoteStruct', 'reconcileMosaic', 'refreshOutbound', 'refreshTrBtn', 'releaseAudio',
  'repaintRedun', 'resumeReload', 'retireMixTracks', 'rowEdge', 'schedClaim', 'schedReconcile', 'startScreenShare',
  'startWhisper', 'stgBeatIn', 'stgCarry', 'stgFoNote', 'stopBlurPipe', 'stopScreenShare', 'stopSpeech',
  'stopWhisper', 'swapPicNote', 'syncAvatarFeed', 'syncSpeech', 'toggleSing', 'unbindClaim', 'warnRecorderNewApp',
  'withScrPipe', 'wkQuietBind', 'wspEnqueue', 'wspRebind', 'wspResume', 'wspStop', 'wspSync',
]);
// MEDIA-ACTS:END

function script(site, rel) {
  const key = site.id + '\n' + rel;
  let s = scripts.get(key);
  if (!s) { s = new vm.Script(site.read(rel), { filename: site.name(rel) }); scripts.set(key, s); }
  return s;
}

// ---- the site --------------------------------------------------------------------------------------------------
// A participant runs the scripts the meeting page loads, from the same site: { id, files, platform, read(rel) -> text,
// name(rel) -> where it came from, root? }. A site tree on disk (a checkout, a test copy) is read in place, and the
// page's own same-origin fetches read that tree too. A site on the web is loaded once, as a browser loads the page:
// files.json, platform.json and the core's scripts from the meeting's origin, and the page's fetches go to that origin.
function siteDir(appRoot) {
  const fs = require('fs'), path = require('path');
  const root = path.resolve(appRoot);
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  return {
    id: 'dir:' + root, root,
    files: JSON.parse(read('js/core/files.json')), platform: JSON.parse(read('js/core/platform.json')),
    nones: JSON.parse(read('js/core/media/nones.json')).nones,
    read, name: (rel) => path.join(root, rel),
  };
}
async function loadSite(origin, opts) {
  opts = opts || {};
  const f = opts.fetch || globalThis.fetch;
  const base = new URL('/', origin).href;
  // a few at a time, each tried again on a dropped connection (a small site server takes a handful of connections at once)
  const get = async (rel) => {
    let last = null;
    for (let i = 0; i < 4; i++) {
      try {
        const r = await f(new URL(rel, base).href, { cache: 'no-store' });
        if (!r.ok) throw new Error('GifOS core: ' + new URL(rel, base).href + ' answered ' + r.status);
        return await r.text();
      } catch (e) { last = e; if (/ answered /.test(String(e && e.message))) throw e; await new Promise((res) => setTimeout(res, 250 * (i + 1))); }
    }
    throw last;
  };
  const files = JSON.parse(await get('js/core/files.json'));
  const platform = JSON.parse(await get('js/core/platform.json'));
  const nones = JSON.parse(await get('js/core/media/nones.json')).nones;
  const text = new Map();
  const todo = files.core.concat(files.apps || [], nodeMediaFiles(files)).slice();
  await Promise.all(Array.from({ length: 6 }, async () => { while (todo.length) { const rel = todo.shift(); text.set(rel, await get(rel)); } }));
  const stamp = (/stamp ([0-9a-f]+)/.exec(text.get('js/core/meeting.js') || '') || [])[1] || '';
  return {
    id: 'web:' + base + '@' + stamp + ':' + nodeCrypto.createHash('sha256').update(files.core.map((r) => text.get(r)).join('\n')).digest('hex').slice(0, 16),
    files, platform, nones, stamp,
    read: (rel) => { if (!text.has(rel)) throw new Error('GifOS core: ' + rel + ' is not a core or app runtime file of ' + base); return text.get(rel); },
    name: (rel) => new URL(rel, base).href,
  };
}

// The meeting page's address for a meeting link, as the site's router (route.html) makes it: /meet/<room>[/<verifier>]
// is a meeting, /join/<code> a self-healing app room, /join/<room>/<verifier>/<secret> an owned one. A link that is
// already the page (run.html#...) is kept.
// The Node media port's files (files.json "nodeMedia"): host = the AudioContext over Opus (this realm), plane = the
// participant's media plane (its realm). Absent in a core that predates them.
function nodeMediaFiles(files) { const m = files && files.nodeMedia; return m && m.host && m.plane ? [m.host, m.plane] : []; }
// A site file that runs in THIS realm, as a CommonJS module (only its exports come out: it sees no require).
function hostModule(site, rel) {
  const mod = { exports: {} };
  vm.compileFunction(site.read(rel), ['module', 'exports'], { filename: site.name(rel) })(mod, mod.exports);
  return mod.exports;
}

function pageUrl(link) {
  const u = new URL(link);
  const m = u.pathname.match(/^\/(?:join|meet|cast)\/([a-z0-9-]{1,64})(?:\/([a-f0-9]{16,64})(?:\/([a-z0-9]{1,64}))?)?\/?$/i);
  if (!m) return u.href;
  const code = m[1], verifier = m[2] ? m[2].toLowerCase() : '', secret = m[3] || '';
  const extra = u.search ? '&' + u.search.slice(1) : '';
  let hash;
  if (/^\/(?:meet|cast)\//i.test(u.pathname)) hash = 'v=' + code + (verifier ? '&av=' + verifier : '') + (/^\/cast\//i.test(u.pathname) ? '&bc=1' : '') + extra;
  else if (verifier && secret) hash = 's=' + code + '.' + verifier + '&k=' + secret + extra;
  else if (!verifier) hash = 'j=' + code + extra;
  else throw new Error('GifOS core: an owned app link needs its secret (' + link + ')');
  const h = u.hash.replace(/^#/, '');
  return u.origin + '/run.html#' + hash + (h ? '&' + h : '');
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
  const fs = appRoot && require('fs'), path = appRoot && require('path');
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
    // Off the site: the page's Origin goes with the ask, as a browser sends it (the relay's /t and door refuse an ask
    // with none). The participant still solves the proof of work like every page.
    const h = new Headers((init && init.headers) || (input && typeof input !== 'string' && input.headers) || undefined);
    if (!h.has('origin')) h.set('origin', location.origin);
    return realFetch(u.href, Object.assign({}, init, { headers: h }));
  };
}

// ---- the participant -----------------------------------------------------------------------------------------
function createMeeting(opts) {
  opts = opts || {};
  if (!opts.url) throw new Error('createMeeting: opts.url is the meeting URL');
  const site = opts.site || siteDir(opts.appRoot || require('path').join(HERE, '..', '..'));
  const appRoot = site.root || null;
  const files = site.files, platform = site.platform;
  const log = typeof opts.log === 'function' ? opts.log : null;

  const pageCounts = new Map(), hostCounts = new Map();
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
    // the page's Origin on the upgrade, as a browser sends it (the relay refuses a socket with none)
    constructor(url, protocols) { super(url, Object.assign(protocols === undefined ? {} : { protocols }, { headers: { Origin: location.origin } })); sockets.add(this); this.addEventListener('close', () => sockets.delete(this)); }
    addEventListener(t, f, o) { return super.addEventListener(t, typeof f === 'function' ? (f.__g || (f.__g = guard('socket ' + t, f))) : f, o); }
    removeEventListener(t, f, o) { return super.removeEventListener(t, (f && f.__g) || f, o); }
  }
  for (const t of ['open', 'message', 'close', 'error']) {
    Object.defineProperty(WebSocketHost.prototype, 'on' + t, {
      get() { return this['__on' + t] || null; },
      set(f) { if (this['__on' + t]) this.removeEventListener(t, this['__on' + t]); this['__on' + t] = f; if (typeof f === 'function') this.addEventListener(t, f); },
    });
  }

  const location = makeLocation(pageUrl(opts.url), {
    use: (what) => count('page:' + what),
    change: (oldHash, newHash) => { if (oldHash !== newHash) setT(() => g.dispatchEvent(new Event('hashchange'))); },
  });

  const subtle = nodeCrypto.webcrypto.subtle;

  Object.assign(g, {
    console: ['log', 'info', 'warn', 'error', 'debug', 'trace'].reduce((c, k) => { c[k] = (...a) => { if (log) log(k, ...a); }; return c; }, { table() {}, group() {}, groupEnd() {}, groupCollapsed() {}, time() {}, timeEnd() {}, assert() {}, count() {} }),
    setTimeout: setT, setInterval: setI, clearTimeout: clearT, clearInterval: clearT,
    queueMicrotask: (fn) => queueMicrotask(() => { try { fn(); } catch (e) { fail('microtask', e); } }),
    fetch: siteFetch(appRoot, location, globalThis.fetch),
    Response: globalThis.Response, Request: globalThis.Request, Headers: globalThis.Headers,
    WebSocket: WebSocketHost, TextDecoder, URL, URLSearchParams, performance, structuredClone, atob, btoa,
    AbortController, AbortSignal, Blob, Event, CustomEvent, EventTarget, MessageChannel, DOMException,
    CompressionStream, DecompressionStream, ReadableStream, WritableStream, TransformStream,
    addEventListener: (t, f, o) => bus.addEventListener(t, typeof f === 'function' ? (f.__g || (f.__g = guard('event ' + t, f))) : f, o),
    removeEventListener: (t, f, o) => bus.removeEventListener(t, (f && f.__g) || f, o),
    dispatchEvent: (e) => bus.dispatchEvent(e),
    // A top-level page posts to itself: delivered later, from its own origin.
    postMessage: (data) => setT(() => { const e = new Event('message'); Object.assign(e, { data, origin: location.origin, source: g }); bus.dispatchEvent(e); }),
    location,
    navigator: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) GifOS-Core/1 Node/' + process.versions.node, vendor: '', onLine: true,
      hardwareConcurrency: require('os').cpus().length, language: 'en-US', languages: ['en-US'], platform: 'Linux' },
    localStorage: makeStorage(opts.storage), sessionStorage: makeStorage(opts.session),
    WEBKIT_ENGINE: false,
  });
  const realmOf = (ctx) => vm.runInContext('({ Uint8Array, ArrayBuffer, Map, Promise, Array, Object, Error })', ctx);

  // every name the core reads off its platform: a Node host without it reads undefined (never a ReferenceError)
  for (const part of ['core']) for (const n of platform[part].platform) if (!(n in g) && n !== 'GifOS') g[n] = undefined;
  // the page globals the core still names: every use throws, naming the global and the member (see THE PAGE IS NOT HERE)
  const noPage = (name, what) => { count('page:' + name, what); throw new Error('GifOS core: the page global ' + name + (what != null ? '.' + String(what) : '') + ' was used, and this host has no page (js/core/node.js)'); };
  const pageGlobal = (name, shims) => new Proxy(function () {}, {
    get(t, k) {
      if (shims && Object.prototype.hasOwnProperty.call(shims, k)) { hostCounts.set(name + '.' + String(k), (hostCounts.get(name + '.' + String(k)) || 0) + 1); return shims[k](); }
      if (k === 'then' || typeof k === 'symbol') return undefined;   // an await or an inspection is not a use
      return noPage(name, k);
    },
    set(t, k) { noPage(name, k); return false; },
    has(t, k) { return noPage(name, k); },
    apply() { return noPage(name, '()'); },
    construct() { return noPage(name, 'new'); },
  });
  let current = null;
  const docShims = {
    currentScript: () => current,
    hidden: () => false,
    visibilityState: () => 'visible',
    addEventListener: () => () => {},
    removeEventListener: () => () => {},
  };
  for (const n of platform.core.page) if (!(n in g) && n !== 'window' && n !== 'Event') g[n] = pageGlobal(n, n === 'document' ? docShims : null);
  if (!g.document) g.document = pageGlobal('document', docShims);   // the core libraries name it even when the meeting does not

  const context = vm.createContext(g, { name: 'gifos participant' });
  g.window = g.self = g.globalThis = g.parent = g.top = context;
  // every peer connection this participant makes is held, so close() ends it as a closed tab does
  const pcs = new Set();
  if (opts.webrtc) {
    const port = typeof opts.webrtc === 'function' ? opts.webrtc(realmOf(context)) : opts.webrtc;
    for (const k of Object.keys(port || {})) g[k] = port[k];
    const PC = g.RTCPeerConnection;
    if (typeof PC === 'function') {
      // THE MESSAGE CEILING. The core cuts a big frame into 100 KB pieces (gifos-net.js FRAG_PART) because every browser
      // takes data channel messages of 256 KB (Chrome, Safari) or more (Firefox). A port that declares less in its SDP is
      // sent nothing bigger: the far browser's send() refuses the piece, the core drops it, and the frame never lands
      // (werift declares 64 KB by default: a core seat got every small frame but never an app's bytes, so Take Turns
      // never mounted there). So the host asks the port for the browsers' ceiling; a port without the option ignores it.
      const BROWSER_MAX_MESSAGE = 262144;
      // ONE MediaStream PER REMOTE STREAM, as a browser gives it: every track a peer sends in one stream (its voice and its
      // camera) arrives in the same object, so the page's claim of that stream holds both. A port that hands a new
      // single-track stream with each track event (werift does) would leave the claim holding the last track only: a
      // browser's camera arrives after its voice, and the voice was lost. The host keeps one object per stream id per
      // connection and hands the page that object, with the new track added to it.
      const ONTRACK = Object.getOwnPropertyDescriptor(PC.prototype, 'ontrack');
      if (opts.media && !(ONTRACK && ONTRACK.get && ONTRACK.set)) throw new Error('GifOS core: the media plane needs a webrtc port whose RTCPeerConnection has an ontrack accessor (one stream per remote stream is kept there)');
      g.RTCPeerConnection = class RTCPeerConnection extends PC {
        constructor(cfg, ...a) { super(Object.assign({ maxMessageSize: BROWSER_MAX_MESSAGE }, cfg || {}), ...a); pcs.add(this); this._gifosStreams = new Map(); this._gifosOnTrack = null; }
        close() { pcs.delete(this); return super.close(); }
        get ontrack() { return ONTRACK && ONTRACK.get ? ONTRACK.get.call(this) : super.ontrack; }   // the port calls the handler through this getter: it must get the wrapped one
        set ontrack(fn) {
          if (!ONTRACK || !ONTRACK.set) { super.ontrack = fn; return; }
          this._gifosOnTrack = typeof fn === 'function' ? fn : null;
          ONTRACK.set.call(this, this._gifosOnTrack ? (ev) => this._gifosOnTrack.call(this, this._gifosTrackEvent(ev)) : null);
        }
        _gifosTrackEvent(ev) {
          const streams = (ev.streams || []).map((st) => {
            const held = this._gifosStreams.get(st.id);
            if (!held) { this._gifosStreams.set(st.id, st); return st; }
            for (const t of st.getTracks()) if (!held.getTracks().includes(t)) held.addTrack(t);
            return held;
          });
          return { type: 'track', track: ev.track, streams, transceiver: ev.transceiver, receiver: ev.receiver, target: this };
        }
      };
      for (const k of Object.getOwnPropertyNames(PC)) if (!(k in g.RTCPeerConnection)) try { g.RTCPeerConnection[k] = PC[k]; } catch (e) {}
    }
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

  // what a page's head scripts set before the meeting's scripts run (a host's own settings, e.g. GIFOS_SCALE)
  const nm = files.nodeMedia;
  const media = opts.media && opts.media.Opus && opts.webrtc && nm && nm.host && nm.plane ? opts.media : null;
  if (opts.media && !media) throw new Error('GifOS core: opts.media needs { Opus }, a webrtc port and a site with a Node media plane (files.json "nodeMedia")');
  let audio = null;
  if (media && !(g.MediaStreamTrack && g.RtpPacket)) throw new Error('GifOS core: the media plane needs a webrtc port with RTP tracks (werift)');
  if (opts.globals) for (const k of Object.keys(opts.globals)) g[k] = opts.globals[k];
  // the core, then the app runtime (files.json "apps": apps' data, signatures and gifos.room, with no app frame)
  for (const rel of files.core.concat(files.apps || [], media ? [nm.plane] : [])) {
    current = { src: new URL(rel, location.href).href };
    try { script(site, rel).runInContext(context); } finally { current = null; }
  }
  const GifOS = context.GifOS;
  // GifOS.meshMedia.workerClock (see HOST SHIMS)
  if (!GifOS.meshMedia) {
    GifOS.meshMedia = { workerClock(ms, fn) { const id = setI(fn, Math.max(1, ms | 0)); return { via: 'interval', stop() { clearT(id); } }; } };
  }
  // GifOS.runtime (see HOST SHIMS)
  if (!GifOS.runtime) GifOS.runtime = { SYSTEM_HEADER: {} };
  // GifOS.host: the host's facts the meeting asks about. A host with no screen is never a hidden tab (the core's
  // background-tab paths are for a browser that hides the page).
  if (!GifOS.host) GifOS.host = {
    hidden: () => false,
    parentOrigin: () => '',
    whenSupported: (f) => f(),
    scriptOrder: () => [],
    loadScript: () => Promise.resolve(false),
    viewport: () => ({ w: 0, h: 0 }),
  };
  // THE HEADLESS VIEW: a view part of this host's own, in place of the page's. Every name the core asks of the view
  // is the linker's counted stand-in (a function does nothing and returns undefined), except the view functions
  // whose result the core takes apart, which return a record of counted placeholders (VIEW_RECORDS).
  const corePart = GifOS.coreParts.core;
  const viewCounts = new Map();
  const viewNames = GifOS.core.standIn('view', (corePart.needs && corePart.needs.view) || {}, viewCounts, true);
  for (const [fn, fields] of Object.entries(VIEW_RECORDS)) {
    if (!Object.prototype.hasOwnProperty.call(viewNames, fn)) continue;
    const vcount = (note, k) => { const key = note + (k != null ? '.' + String(k) : ''); viewCounts.set(key, (viewCounts.get(key) || 0) + 1); };
    const f = function () { vcount('view.' + fn + '()'); const r = {}; for (const k of fields) r[k] = GifOS.core.placeholder('view.' + fn + '().' + k, vcount); return r; };
    Object.defineProperty(viewNames, fn, { get: () => f, enumerable: true, configurable: true });
  }
  // What a host with no screen has for apps: the app runtime's client with no app frame (it takes part through the
  // app's data and gifos.room), and the app-owner library already loaded (files.json "apps").
  const APP_VIEW = {
    appRuntimeClient: (params) => GifOS.runtime.bootClientBus(null, params, null, {}),
    sgaAppOwner: () => (GifOS.appOwner ? Promise.resolve(GifOS.appOwner) : Promise.reject(new Error('no app-owner library'))),
  };
  for (const [fn, f] of Object.entries(APP_VIEW)) {
    if (!Object.prototype.hasOwnProperty.call(viewNames, fn) || !GifOS.runtime || !GifOS.runtime.bootClientBus) continue;
    Object.defineProperty(viewNames, fn, { get: () => f, enumerable: true, configurable: true });
  }
  const headlessView = { name: 'view', stamp: corePart.stamp, needs: {}, run: function* (L) { Object.defineProperties(L.view, Object.getOwnPropertyDescriptors(viewNames)); return L.END; } };
  const meeting = GifOS.core.link({ core: corePart, view: headlessView });
  // NO MEDIA PLANE. A media function the core only acts through (MEDIA_ACTS, below) is a counted no-op. One whose
  // answer the core reads is ABSENT: a call site that guards it (typeof __M.x === 'function') takes the core's own
  // answer, and one that does not fails loudly (a TypeError naming it), never a silent undefined. (Media VARIABLES stay
  // the linker's counted placeholders until the media port narrows them.)
  const mediaNeeds = (corePart.needs && corePart.needs.media) || {};
  for (const name of Object.keys(mediaNeeds)) if (mediaNeeds[name] && !MEDIA_ACTS.has(name)) delete meeting.media[name];
  // A media VARIABLE is its declared none (js/core/media/nones.json): null, false, 0, '', or an empty array, object, Map
  // or Set of this participant's own, made fresh here (never shared between participants). The core may set it later.
  // There are no placeholders: a variable with no declared none stops this participant at start, by name.
  const nones = site.nones || {};
  const R2 = realmOf(context);
  const fresh = (v) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && v.$ === 'Map') return vm.runInContext('new Map()', context);
    if (v && typeof v === 'object' && !Array.isArray(v) && v.$ === 'Set') return vm.runInContext('new Set()', context);
    if (Array.isArray(v)) return new R2.Array();
    if (v && typeof v === 'object') return new R2.Object();
    return v;
  };
  for (const name of Object.keys(mediaNeeds)) {
    if (mediaNeeds[name]) continue;
    if (!Object.prototype.hasOwnProperty.call(nones, name)) throw new Error('GifOS core: the media variable "' + name + '" has no declared none (js/core/media/nones.json); this host has no media plane');
    let held = fresh(nones[name]);
    Object.defineProperty(meeting.media, name, { get: () => held, set: (v) => { held = v; }, enumerable: true, configurable: true });
  }
  let plane = null;
  if (media) {
    // the AudioContext over Opus, on the participant's global before the meeting runs (the libraries read it at use)
    audio = hostModule(site, nm.host).port({ Opus: media.Opus, timings: GifOS.timings,
      werift: { MediaStreamTrack: g.MediaStreamTrack, MediaStream: g.MediaStream, RtpPacket: g.RtpPacket, RtpHeader: g.RtpHeader } });
    audio.AudioContext.onerror = (e) => fail('audio', e);
    g.AudioContext = g.webkitAudioContext = audio.AudioContext;
    if (!GifOS.planeNode) throw new Error('GifOS core: ' + nm.plane + ' did not define the media plane');
    plane = GifOS.planeNode.install(meeting.media, meeting.core);
  }
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

  // close(): leave the meeting (the Leave button: farewell on every channel, the seat's LEAVE), then stop once the
  // farewell has drained (the meeting's own FAREWELL_DRAIN_MS). kill(): vanish with no goodbye, as a device that died:
  // timers, sockets and links just stop.
  let ending = false;
  function stopAll() {
    if (closed) return;
    closed = true;
    for (const h of timers.values()) { clearTimeout(h); clearInterval(h); }
    timers.clear();
    for (const s of sockets) { try { s.close(); } catch (e) {} }
    for (const pc of Array.from(pcs)) { try { pc.close(); } catch (e) {} }
    if (audio) for (const ac of Array.from(audio.AudioContext._live)) { try { ac.close(); } catch (e) {} }
    try { if (typeof opts.onClose === 'function') opts.onClose(context); } catch (e) {}
  }
  function end(polite) {
    if (closed || (ending && polite)) return Promise.resolve();
    if (!polite) { stopAll(); return Promise.resolve(); }
    ending = true;
    try { meeting.core.leaveMeeting(); } catch (e) { fail('leave', e); }
    const drain = (context.GifOS && context.GifOS.timings && context.GifOS.timings.FAREWELL_DRAIN_MS) || 0;
    return new Promise((res) => { const t = setTimeout(() => { stopAll(); res(); }, drain); if (t.unref) t.unref(); });
  }
  const close = () => end(true), kill = () => end(false);

  return {
    context, meeting, ran,
    agent: () => context.gifosAgent,
    plane: () => plane,
    audioStats: () => (audio ? audio.stats() : null),
    hooks: () => context.__gifosVideo,
    standIns: () => meeting.standIns().concat(Array.from(viewCounts)).sort((a, b) => b[1] - a[1]),
    pageUses: () => Array.from(pageCounts).sort((a, b) => b[1] - a[1]),
    hostShims: () => Array.from(hostCounts).sort((a, b) => b[1] - a[1]),
    errors: () => errors.slice(),
    close, kill,
  };
}

module.exports = { createMeeting, makeStorage, loadSite, siteDir, pageUrl };
