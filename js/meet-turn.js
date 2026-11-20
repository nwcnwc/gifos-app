/*
 * meet-turn.js — the page side of a TURN link (0.9.26; gifos docs/turn-0926.md).
 *
 * A TURN link is an ordinary mesh link whose path runs through a TURN server.
 * SUBROOMS: each TURN link (a pipe) makes its own subroom, an ordinary room at
 * the relay with its own door, joined to the subroom it hangs from by that one
 * pipe, so a meeting's subrooms and pipes form a tree. A page that reaches no
 * greeter at its door asks the credential service (POST /v1/sub) with the
 * relay's signed list of the meeting's doors. It is shown the subrooms already
 * linked in and knocks each; it joins the first it reaches as an ordinary
 * joiner. Only when none is reachable is it granted a new subroom (or, for a
 * subroom whose pipe is gone, a new pipe for the same one), whose far end the
 * service picks among the meeting's capable row heads. The pure choices are
 * js/mesh/turn.js.
 *
 *   - Last resort. Only after the direct dial and every friend have failed for
 *     TURN_WAIT (the law's ticks), and never while a foreign greeter is reached.
 *   - Never double TURN (TURN.6). The end whose own network blocks direct
 *     connections is the TURN client; if neither is blocked the opener is the
 *     only client. A page that is not a client never puts a TURN server in
 *     that pair's connection settings.
 *   - Both ends, or nothing. A credential is for ONE end of ONE link and only
 *     for two fresh seated vouches from the relay, one per end, naming each
 *     other and the link. The ends swap them over the room's sealed signaling
 *     (relay frames of type `tv`) and each posts both to the credential
 *     service. Renewal needs fresh vouches again, so they are re-made while
 *     the link lives.
 *   - No video unvouched (TURN.11). Free TURN carries everything except
 *     video: the page sends no video track over an unvouched link. Every
 *     subscriber present vouches for X video links (room20 3, unlimited 6,
 *     streamer 20); the links take the pool in the deterministic order of
 *     js/mesh/turn.js turnVouchOrder, and a link that loses its vouch keeps
 *     video for TURN_VOUCH_GRACE. A vouched link moves to the paid pool.
 *   - Heal away (TURN.7). When a friend reaches the far end without TURN the
 *     link closes and friend-hop carries the pair.
 *   - The web path (TURN.18). A network that inspects web traffic lets no relay protocol out, only web-shaped
 *     traffic. A client end whose connection finds no path to its relay server within TURN_WEB_WAIT says so, and the
 *     link runs over a WebSocket to the same server instead (js/meet-tunnel.js), on the same credentials and under
 *     the same rules (no video unvouched, the pool's rate). Tried only after the relay protocol itself has failed.
 *   - Off the join path (TURN.10). Credentials are asked for only by seated
 *     pages, after joining. An error, a refusal (free-off, room-limit) or no
 *     answer means no link: the parts wait as before and ask again later.
 *
 * Everything here runs with its clock, network and page passed in (io), so
 * the same code runs in a page and in Node.
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});
  const isNode = typeof module === 'object' && !!module.exports && typeof require === 'function';
  const meshTurn = () => GifOS.meshTurn || (isNode ? require('./mesh/turn.js') : null);
  const meshConsts = () => GifOS.meshConsts || (isNode ? require('./mesh/consts.js') : null);

  const DEFAULT_WORKER = 'https://turn.gifos.app';
  const WORKER_KEY = 'gifos_turn_worker'; // localStorage override: a self-hosted or test credential service
  const TM = (root.GifOS && root.GifOS.timings) || (isNode ? require('./timings.js') : {});   // every wait: js/timings.js, loaded before this file
  const FETCH_TIMEOUT_MS = TM.TURN_FETCH_TIMEOUT_MS;   // a credential answer slower than this is no answer
  const RETRY_BASE_MS = TM.TURN_RETRY_BASE_MS;         // first retry after about 2 s, doubling
  const RETRY_MAX_MS = TM.TURN_RETRY_MAX_MS;           // never longer than 5 minutes between tries
  const SIDE_MAX = 48;                    // ids per side a link end publishes (a fact rides one gossip frame)
  const STANDBY_SWITCH_MS = TM.TURN_STANDBY_SWITCH_MS;   // TURN.9: a dead server's link is on its standby within this
  const THROTTLE_LOOK_MS = TM.TURN_THROTTLE_LOOK_MS;     // TURN.13: a link end reads its send capacity this often
  const THROTTLE_UP_MS = TM.TURN_THROTTLE_UP_MS;         // TURN.13: capacity holds this long before video steps up again

  // ---- the credential service ------------------------------------------------

  // retryDelayMs(attempt, rand) → wait before try number attempt + 1 (attempt
  // counts failures, from 1): doubling from about 2 s with jitter (rand in
  // [0,1) scales it by 0.5 to 1.5), never above 5 minutes.
  function retryDelayMs(attempt, rand) {
    const n = Math.max(1, Math.floor(attempt || 1));
    const base = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, Math.min(n - 1, 20)));
    const r = typeof rand === 'number' && rand >= 0 && rand < 1 ? rand : 0.5;
    return Math.min(RETRY_MAX_MS, Math.round(base * (0.5 + r)));
  }

  // parseIce(body) → { iceServers, ttl, renewAfter, pool, link } or null. Anything that is not a
  // well-formed grant (a refusal { unavailable }, a pending answer) is null.
  function parseIce(body) {
    if (!body || typeof body !== 'object' || body.unavailable || body.pending) return null;
    const list = body.iceServers;
    if (!Array.isArray(list) || !list.length || list.length > 4) return null;
    const servers = [];
    for (const s of list) {
      if (!s || typeof s.username !== 'string' || typeof s.credential !== 'string') return null;
      const urls = (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => typeof u === 'string' && /^turns?:/i.test(u));
      if (!urls.length) return null;
      servers.push({ urls, username: s.username, credential: s.credential });
    }
    const ttl = Number(body.ttl);
    if (!(ttl > 0)) return null;
    let renewAfter = Number(body.renewAfter);
    if (!(renewAfter >= 0 && renewAfter < ttl)) renewAfter = Math.floor(ttl * 0.9);
    // web: the hosts that carry this link over a WebSocket (TURN.18), when the service runs any. Optional.
    const web = [];
    if (Array.isArray(body.web)) for (const h of body.web.slice(0, 4)) if (typeof h === 'string' && WEB_HOST_RE.test(h)) web.push(h);
    return { iceServers: servers, ttl, renewAfter, pool: body.pool || null, link: body.link || null, web };
  }

  // A web path host: a host name or address, with an optional port. Never a path, a scheme or a user part.
  const WEB_HOST_RE = /^[A-Za-z0-9]([A-Za-z0-9.-]{0,62}[A-Za-z0-9])?(:[0-9]{1,5})?$/;
  // webHostOk(h, mine) → may I connect to the web host the far end named? Only one my own grant lists, or a sibling of
  // one (the same service domain: its last three labels). My credential is shown to that host, so nothing else passes.
  function webHostOk(h, mine) {
    if (typeof h !== 'string' || !WEB_HOST_RE.test(h) || !Array.isArray(mine) || !mine.length) return false;
    if (mine.indexOf(h) >= 0) return true;
    const dom = (x) => { const n = x.split(':')[0]; if (/^[0-9.]+$/.test(n)) return null; const p = n.split('.'); return p.length >= 4 ? p.slice(-3).join('.').toLowerCase() : null; };
    const d = dom(h);
    return !!d && mine.some((m) => dom(m) === d);
  }

  // hasTurnServer(list) → does a connection setting name any TURN server?
  function hasTurnServer(list) {
    for (const s of list || []) {
      const urls = Array.isArray(s && s.urls) ? s.urls : [s && s.urls];
      for (const u of urls) if (/^turns?:/i.test(String(u || ''))) return true;
    }
    return false;
  }

  // workerBase(store) → the credential service's base URL: the override in
  // localStorage (WORKER_KEY) when one is set, else the GifOS service.
  function workerBase(store) {
    try {
      const st = store || root.localStorage;
      const v = String((st && st.getItem(WORKER_KEY)) || '').trim();
      if (v) return v.replace(/\/+$/, '');
    } catch (e) {}
    return DEFAULT_WORKER;
  }

  // askIce(fetchFn, url) → ask(body): the page's network call. JSON sent as
  // plain text is a simple cross-origin request (no preflight); no cookie.
  function askIce(fetchFn, url) {
    return (body) => fetchFn(url || workerBase() + '/v1/ice', {
      method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body),
      credentials: 'omit', cache: 'no-store', mode: 'cors',
    }).then((r) => r.json()).catch(() => null);
  }

  // askSub(fetchFn, url) → (body) → Promise<json>: the subroom ask (POST /v1/sub), the same simple request.
  function askSub(fetchFn, url) { return askIce(fetchFn, url || workerBase() + '/v1/sub'); }

  // createCredentials(o) → the credential client of one link end.
  // o = { ask(body) → Promise<json>, room, pool, now(), setTimer(fn, ms), clearTimer(h), random(),
  //       extra() → the fields of each ask ({vouch, peerVouch}, the paid pool's ticket), or null when
  //                 there is nothing to ask with yet (no fresh vouch from both ends): no ask, a retry;
  //                 may be a promise,
  //       onChange(kind) }
  // onChange kinds: 'ok' (first grant, or a grant after losing one), 'renewed'
  // (a fresh grant replaced a live one: move the link onto it), 'expired' (it
  // ran out with no renewal). state(): idle | pending | ok | down | lost.
  function createCredentials(o) {
    const now = o.now || (() => Date.now());
    const setTimer = o.setTimer || ((fn, ms) => setTimeout(fn, ms));
    const clearTimer = o.clearTimer || ((h) => clearTimeout(h));
    const random = o.random || Math.random;
    const onChange = o.onChange || (() => {});
    let started = false, stopped = false, inFlight = false;
    let grant = null;          // { iceServers, issuedAt, renewAt, expiresAt, pool }
    let everHad = false, failures = 0, answered = false, refusal = null;
    const pool = o.pool || 'free';
    let tNext = null, tExpire = null;
    function clearNext() { if (tNext != null) { clearTimer(tNext); tNext = null; } }
    function schedule(ms) { clearNext(); tNext = setTimer(() => { tNext = null; ask(); }, Math.max(0, ms)); }
    function ask() {
      if (stopped || inFlight) return;
      inFlight = true;
      const renew = !!grant;
      let settled = false, tOut = null;
      const done = (body) => {
        if (settled) return;
        settled = true; inFlight = false;
        if (tOut != null) clearTimer(tOut);
        if (stopped) return;
        answered = true;
        const g = parseIce(body);
        if (!g) {
          refusal = body && typeof body === 'object' && body.unavailable ? String(body.unavailable).slice(0, 40) : (body && body.pending ? 'pending' : null);
          failures++;
          schedule(retryDelayMs(failures, random()));
          return;
        }
        failures = 0; refusal = null;
        const t = now();
        const had = !!grant;
        grant = { iceServers: g.iceServers, issuedAt: t, renewAt: t + g.renewAfter * 1000, expiresAt: t + g.ttl * 1000, pool: g.pool || pool, web: g.web || [] };
        everHad = true;
        schedule(grant.renewAt - t);
        if (tExpire != null) clearTimer(tExpire);
        const mine = grant;
        tExpire = setTimer(() => {
          tExpire = null;
          if (grant !== mine) return;
          grant = null; // the retries keep asking
          onChange('expired');
        }, mine.expiresAt - t);
        onChange(had ? 'renewed' : 'ok');
      };
      tOut = setTimer(() => { tOut = null; done(null); }, FETCH_TIMEOUT_MS);
      let p;
      try {
        const go = (more) => {
          if (more == null || stopped || settled) return null;
          return o.ask(Object.assign({ room: String(o.room), pool }, renew ? { renew: true } : {}, more));
        };
        const more = o.extra ? o.extra() : {};
        p = more && typeof more.then === 'function' ? Promise.resolve(more).then(go) : Promise.resolve(go(more));
      } catch (e) { p = Promise.resolve(null); }
      p.then((b) => done(b), () => done(null));
    }
    return {
      start() { if (started || stopped) return; started = true; ask(); },
      stop() { stopped = true; clearNext(); if (tExpire != null) { clearTimer(tExpire); tExpire = null; } grant = null; },
      servers() { return grant && now() < grant.expiresAt ? grant.iceServers : null; },
      web() { return grant && now() < grant.expiresAt ? grant.web : []; },
      state() {
        if (!started) return 'idle';
        if (grant && now() < grant.expiresAt) return 'ok';
        if (everHad) return 'lost';
        return answered ? 'down' : 'pending';
      },
      grant() { return grant ? Object.assign({}, grant) : null; },
      refusal() { return refusal; },
      pool,
    };
  }

  // ---- the seated vouch, carried in parts ------------------------------------
  // The relay signs tv1.<base64url JSON {k:'v', s, r, d, p, l, e, n}>.<base64url HMAC> (signVouch on the relay). A
  // relay frame holds 128 bytes, too few for the whole token, so an end sends only what the other cannot know: e
  // (base 36), n and the MAC. s is the room's relay session, r the sender's subroom (pipe l<r>'s opener sits in
  // subroom r, its far end in the subroom the service named), d the sender's device tag (from its ask), p the
  // receiver's own: the receiver rebuilds the exact token. JSON.stringify keeps that key order.
  const enc = typeof TextEncoder === 'function' ? new TextEncoder() : null;
  function b64urlText(s) {
    let bin = '';
    for (const b of enc.encode(s)) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function vouchToken(s, r, d, p, l, e, n, m) {
    return 'tv1.' + b64urlText(JSON.stringify({ k: 'v', s, r, d, p, l, e, n })) + '.' + m;
  }
  // vouchParts(tv) → { s, r, d, p, l, e, n, m } of a token, or null.
  function vouchParts(tv) {
    try {
      const x = String(tv).split('.');
      if (x.length !== 3 || x[0] !== 'tv1') return null;
      const t = x[1].replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
      const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
      if (!o || o.k !== 'v') return null;
      return { s: o.s, r: o.r, d: o.d, p: o.p, l: o.l, e: o.e, n: o.n, m: x[2] };
    } catch (e) { return null; }
  }

  // The `tv` relay frame (gifos-net.js RELAY_TYPES): one link's handshake between its two ends.
  //   {k:'tv', q:'a', l, d, b}   ask / answer: the pipe's link name, my device tag, my network blocks direct paths (b 1)
  //   {k:'tv', q:'v', l, e, n, m} my seated vouch for this link (its expiry in base 36, nonce, MAC)
  //   {k:'tv', q:'r', l}          ready: I hold what my end needs (a credential, or none: not a client)
  //   {k:'tv', q:'p', l, b}       paid: my end is on the paid pool (b 1) or back on free (b 0)
  //   {k:'tv', q:'i', l}          move our pc onto new settings: the pair's offerer restarts ICE
  //   {k:'tv', q:'x', l}          the link is closed at my end; b 1: refused, the meeting is at its plan's limit
  //   THE WARM STANDBY of pipe l<r> (its standby s<r>, between other seats of the same two subrooms):
  //   {k:'tv', q:'s', l:'l<r>', d}         the far live end to the opener: my side's standby seat is device d
  //   {k:'tv', q:'s', l:'s<r>', d, e}      a live end to a seat of its own subroom: open the standby toward device d,
  //                                         in subroom e (base 36)
  //   {k:'tv', q:'s', l:'s<r>'}            a live end to a seat of its own subroom: you are this pipe's standby end
  //   {k:'tv', q:'s', l:'s<r>', d}         that seat's answer: my device tag (the live end names it to the far side)
  //   {k:'tv', q:'r', l:'s<r>'} / q 'x'    a standby end to its live end: the standby is up (b 1: on a direct path) / gone
  //   {k:'tv', q:'t', l:'s<r>'}            take the pipe over (the live pipe is gone); b 1: healed (SUB.8: the standby is
  //                                         direct and the pipe on TURN: the two change places, the TURN path stays as s<r>)
  //   {k:'tv', q:'d', l:'s<r>'}            the opener's word: this standby's ends reach each other directly (a plain pc of
  //                                         ours reached 'connected' off TURN), so it is dialled with no TURN server (SUB.5)
  //   SUB.8.1 THE PROBE (how a pair of seats of two subrooms learns it reaches; all on the one `tv` envelope, SUB.9):
  //   {k:'tv', q:'o', l:'l<r>', m}         a pipe end to the other: my side's Section-1 seats (peer ids, comma-joined), once a change
  //   {k:'tv', q:'o', l:'s<r>', m}         the pipe's opener end to a seat of its own subroom: dial the far seat m on a plain
  //                                         connection and tell me; that seat's answer carries b: 1 it came up, 0 no path within
  //                                         the direct verdict, 2 I hold a path of this link to it already (not tried)
  //   {k:'tv', q:'o', l:'l<r>', m, b:1}    the opener end to the far end: stand your side's standby end on your seat m (a
  //                                         seat of mine reaches it directly)
  //   {k:'tv', q:'w', l, m}       TURN.18: this link runs over the web path; m (the opener's word) names its host
  //   {k:'tv', q:'b', l, b}       busy: my end paused its video because the server throttles (b 1), or sends again (b 0)
  const TV_KEYS = 'k,q,l,d,b,e,n,m';
  const PROBE_RE = /^[A-Za-z0-9_]{1,64}(,[A-Za-z0-9_]{1,64}){0,24}$/;   // SUB.8.1: at most a Section 1 of peer ids
  const LINK_RE = /^[ls][0-9]{1,2}$/, DEV_RE = /^[A-Za-z0-9_.-]{1,16}$/, NONCE_RE = /^[0-9a-f]{18}$/, MAC_RE = /^[A-Za-z0-9_-]{43}$/, E36_RE = /^[0-9a-z]{1,11}$/;
  function tvOk(f) {
    if (!f || typeof f !== 'object' || Array.isArray(f) || f.k !== 'tv' || typeof f.l !== 'string' || !LINK_RE.test(f.l)) return false;
    for (const k of Object.keys(f)) if (k !== '_' && TV_KEYS.split(',').indexOf(k) < 0) return false;
    if (f.q === 'a') return typeof f.d === 'string' && DEV_RE.test(f.d) && (f.b === 0 || f.b === 1) && (f.e === undefined || (typeof f.e === 'string' && /^[0-9a-z]{1,2}$/.test(f.e)));
    if (f.q === 'w') return f.m === undefined || (typeof f.m === 'string' && WEB_HOST_RE.test(f.m));
    if (f.q === 'v') return typeof f.e === 'string' && E36_RE.test(f.e) && typeof f.n === 'string' && NONCE_RE.test(f.n) && typeof f.m === 'string' && MAC_RE.test(f.m);
    if (f.q === 'x') return f.b === undefined || f.b === 1;
    if (f.q === 'r' || f.q === 'i' || f.q === 't' || f.q === 'd') return true;
    if (f.q === 's') return (f.d === undefined || (typeof f.d === 'string' && DEV_RE.test(f.d))) && (f.e === undefined || (typeof f.e === 'string' && /^[0-9a-z]{1,2}$/.test(f.e)));
    if (f.q === 'p' || f.q === 'b') return f.b === 0 || f.b === 1;
    if (f.q === 'o') return typeof f.m === 'string' && PROBE_RE.test(f.m) && (f.b === undefined || f.b === 0 || f.b === 1 || f.b === 2);
    if (f.q === 'c') return f.b === undefined || f.b === 1;   // TURN.5.3: a cut probe's question, and its answer (b 1)
    return false;
  }

  function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  // linkId(a, b) → the room-wide name of a link in the gossiped facts.
  function linkId(a, b) { const x = String(a) < String(b) ? a + '|' + b : b + '|' + a; return fnv(x).toString(36); }

  // clientEnd(myBlocked, farBlocked, opener) → is this end a TURN client (TURN.6, js/mesh/turn.js turnClients)?
  function clientEnd(myBlocked, farBlocked, opener) {
    const E = meshConsts().enums, T = meshTurn();
    const mine = myBlocked ? E.GT_BLOCKED : -1, far = farBlocked ? E.GT_BLOCKED : -1;
    const c = opener ? T.turnClients(mine, far) : T.turnClients(far, mine);   // 1 the opener, 2 the target, 3 both
    return c === 3 || (opener ? c === 1 : c === 2);
  }

  // pausedBy(facts, me, pid) → is pid's video to me held at an unvouched TURN link? facts: the gossiped link facts
  // ({ up, v, a, b, va, vb }); me and pid on different sides of an up link with no video.
  function pausedBy(facts, me, pid) {
    for (const f of facts || []) {
      if (!f || !f.up || f.v) continue;
      const sa = f.va || [], sb = f.vb || [];
      const meA = me === f.a || sa.indexOf(me) >= 0, meB = me === f.b || sb.indexOf(me) >= 0;
      const pA = pid === f.a || sa.indexOf(pid) >= 0, pB = pid === f.b || sb.indexOf(pid) >= 0;
      if ((meA && pB && !meB) || (meB && pA && !meA)) return true;
    }
    return false;
  }

  // stripPaused(facts, far) → does the Stadium, which shows the far rooms of the meeting (far: the people my fold counts
  // in them), stand for a room whose pipe carries no video? Any up pipe the room's facts hold that is not vouched holds
  // the far room's picture for every seat that sees it through the Stadium (TURN.11; Nathan 11-14: the note on the strip).
  function stripPaused(facts, far) {
    if (!(far > 0)) return false;
    for (const f of facts || []) if (f && f.up && !f.v && !f.gone) return true;
    return false;
  }

  // ---- a throttled server (TURN.13) -------------------------------------------
  // The steps video takes on a vouched link as the link's measured send capacity drops: resolution first, then frame
  // rate; below the last step video pauses. Everything but video (TURN_BASE_BYTES a tick: voices, data, roster, chat)
  // is served first, video takes what is left (the sim's turnVideoBytes, mesh_turn.inc), in bits a second here.
  const THROTTLE_STEPS = [
    { scale: 1, fps: 30, need: 8 }, { scale: 2, fps: 30, need: 4 }, { scale: 4, fps: 30, need: 2 },
    { scale: 4, fps: 15, need: 1.5 }, { scale: 4, fps: 8, need: 1 },
  ];   // need: the video bits a step needs, in units of TURN_VIDEO_MIN_BYTES a tick
  // throttlePlan(capBps, tickMs) → { step, maxBitrate, scale, fps } or { step: -1 } (paused): the step a link with that
  // send capacity takes. tickMs: the law's tick (500).
  function throttlePlan(capBps, tickMs) {
    const K = meshConsts().consts, perS = 1000 / (tickMs || 500);
    const base = K.TURN_BASE_BYTES * perS * 8, full = K.TURN_VIDEO_BYTES * perS * 8, min = K.TURN_VIDEO_MIN_BYTES * perS * 8;
    let v = Math.min(full, (+capBps || 0) - base);
    if (!(v >= min)) return { step: -1 };
    for (let i = 0; i < THROTTLE_STEPS.length; i++) {
      const st = THROTTLE_STEPS[i];
      if (v >= st.need * min || i === THROTTLE_STEPS.length - 1) return { step: i, maxBitrate: Math.round(v), scale: st.scale, fps: st.fps };
    }
    return { step: -1 };
  }

  // stepOf(i, capBps, tickMs) → the step i's settings: its picture and frame rate, and a bitrate cap of the video budget
  // the capacity leaves (never below the step's own need, never above TURN_VIDEO_BYTES).
  function stepOf(i, capBps, tickMs) {
    const K = meshConsts().consts, perS = 1000 / (tickMs || 500);
    const base = K.TURN_BASE_BYTES * perS * 8, full = K.TURN_VIDEO_BYTES * perS * 8, min = K.TURN_VIDEO_MIN_BYTES * perS * 8;
    const st = THROTTLE_STEPS[Math.max(0, Math.min(THROTTLE_STEPS.length - 1, i))];
    const v = Math.min(full, Math.max(st.need * min, (+capBps || 0) - base));
    return { step: i, maxBitrate: Math.round(i === 0 ? full : Math.min(v, THROTTLE_STEPS[Math.max(0, i - 1)].need * min)), scale: st.scale, fps: st.fps };
  }
  // throttleNext(st, look, now, tickMs): one look of a vouched link end. st = { step, busy, okSince, bad, rttBase,
  // pausedAt } (kept by the caller); look = { bps, loss, rtt, limited, cap } (loss: the far end's fraction lost, 0..1;
  // rtt seconds; limited: my video already sends most of the estimate; cap: the bitrate cap the current step put on my
  // video, bits a second). The estimate alone cannot tell a throttled server from a pc that sends little (an
  // app-limited estimate sits at what is sent: measured 150-300 kbit on links that reached 1.9-3.3 Mbit a minute
  // later), so it counts only while the video fills it AND the estimate is below the step's own cap: a video that fills
  // its cap with the estimate above it is held by the step, not by the path, and climbs (measured 2026-11-12: an end
  // sat at the lowest step for 100+ s on a 2 Mbit path, its encoder held back by that step's own cap). Congestion: loss
  // of TURN_THROTTLE_LOSS or more (the round trip is not used: a pool move changes it on a calm link), or a video held
  // by the path whose estimate leaves room only for a lower step. Two congested looks in a row (one with heavy loss) drop video at least one step, as far as
  // throttlePlan says; on the lowest step two congested looks in a row pause it. With no congestion and no limit
  // for THROTTLE_UP_MS it climbs one step; a pause tries the lowest step again after that long.
  const THROTTLE_LOSS = 0.05;
  // THE VOICE ON A TURN LINK (TURN.13, Nathan 11-14: sound is never lost; its quality may give under a tight cap). Every
  // audio sender of the link has a full rate (the page's own: 64 kbps for forwarded sound) and rides RTP at Opus's 20 ms
  // frames: 50 packets a second, each with IPv4 + UDP + TURN ChannelData + RTP + the SRTP tag in front (54 bytes). On a
  // starved link the voices step down to the law's share: TURN_BASE_BYTES (everything but video) less the packet headers,
  // split over its voices, never under the codec's floor (Opus's 6 kbps in the browsers). The link's data is not taken
  // off: it is elastic (its channel's own congestion control) and gives way before the voice (pk42 11-14: 60-70 kbit of
  // gossip after a kill took the whole share and the voice sat on the floor: static in the far office).
  const VOICE_PPS = 50, VOICE_HDR_BYTES = 54, VOICE_FLOOR_BPS = 6000;
  const voiceHdr = () => VOICE_PPS * VOICE_HDR_BYTES * 8;   // bits a second of headers per audio sender
  // voiceLow(n, tickMs) → the rate each of n audio senders steps down to: the law's base less their headers, split
  function voiceLow(n, tickMs) {
    const K = meshConsts().consts, base = K.TURN_BASE_BYTES * (1000 / (tickMs || 500)) * 8, k = Math.max(1, n | 0);
    return Math.max(VOICE_FLOOR_BPS, Math.floor((base - k * voiceHdr()) / k));
  }
  // the wire the link needs before any video: its voices at full rate with their headers, and its data
  const voiceWire = (look) => (+look.voiceFull || 0) + (look.voiceN | 0) * voiceHdr() + (+look.data || 0);
  // roomFor(i, look, tickMs): the estimate (with THROTTLE_LOSS of headroom: an estimate that much too high is inside the
  // loss a calm link has) carries the voices at full rate, the data, and video step i's own need
  function roomFor(i, look, tickMs) {
    const K = meshConsts().consts, min = K.TURN_VIDEO_MIN_BYTES * (1000 / (tickMs || 500)) * 8;
    return (+look.bps || 0) * (1 - THROTTLE_LOSS) - voiceWire(look) >= THROTTLE_STEPS[i].need * min;
  }
  const PROBE_BACKOFF_MAX = 3;   // a failed probe doubles the next wait, up to 2^3 x TURN_THROTTLE_UP_MS
  const VOICE_BAD = 2;   // lossy reports among the last 3 fresh ones before the voices step down (a path event's own are left out)
  // throttleNext(st, look, now, tickMs): one look of a TURN link end. st = { step, busy, okSince, bad, rttBase, pausedAt,
  // probation, probeN, voice ('full' | 'low'), vOkSince, vProbation, vProbeN } (kept by the caller); look = { bps, loss,
  // rtt, limited, cap, stale, voiceFull, voiceN, data, video, flow, clean } (loss: the far end's fraction lost on ANY of
  // my media, from FRESH receiver reports only; stale: my video went out but no new receiver report came back for it;
  // flow: my video went out since the last look; clean: a fresh video report came back under TURN_THROTTLE_LOSS; rtt
  // seconds; limited: my video already sends most of the estimate; cap: the bitrate cap the current step put on my video;
  // voiceFull: the full rates of my sending audio senders on the link, voiceN how many, data: the bits a second my data
  // channel sent; video: the link carries video).
  // Congestion: loss of TURN_THROTTLE_LOSS or more, reports lost, or a video held by the path whose estimate leaves room
  // only for a lower step (the estimate counts only while the video fills it: a pc that sends little reports what it
  // sends). Two congested looks in a row (one with heavy loss) drop video at least one step, as far as throttlePlan says;
  // on the lowest step two congested looks pause it.
  // THE VOICE FIRST, AND IT GIVES QUALITY, NEVER SOUND: lost packets while video has nothing left to give (paused, or a
  // link with no video) step every audio sender down to voiceLow at once (the caller latches the rate); calm for
  // TURN_THROTTLE_UP_MS (doubled per failed try) tries the full rate again ON PROBATION: one lossy look puts it back down.
  // VIDEO TRIES MORE ONLY ON PROBATION: after TURN_THROTTLE_UP_MS of calm (doubled per failed try, reset by a probe that
  // held) a pause tries the lowest step, only with the voices back at full rate; a step climbs when the estimate carries
  // the next one beside the full voices (roomFor) or when its video is flowing with clean fresh reports (an app-limited
  // estimate sits at what is sent; measured 11-14: a climb gated on the estimate alone took 23 s to start). A step tried
  // on probation goes back at the FIRST congested look, and the next try waits twice as long (measured 11-14: a pause
  // left into an 80 kbit cap, a climb to step 0 with no video sent and no reports read as calm: both ends deaf).
  function throttleNext(st, look, now, tickMs) {
    const last = THROTTLE_STEPS.length - 1, video = look.video !== false;
    const rtt = +look.rtt > 0 ? +look.rtt : 0;
    if (rtt && (!st.rttBase || rtt < st.rttBase)) st.rttBase = rtt;
    if (!st.voice) st.voice = 'full';
    const K = meshConsts().consts, base = K.TURN_BASE_BYTES * (1000 / (tickMs || 500)) * 8, nonVideo = Math.max(base, voiceWire(look));
    const plan = throttlePlan((+look.bps || 0) - nonVideo + base, tickMs);   // the step the estimate carries beside the voices and data
    const capHeld = +look.cap > 0 && (+look.bps || 0) - nonVideo >= +look.cap;   // the estimate leaves video its whole cap
    const held = video && !!look.limited && !capHeld;   // the path, not the step's own cap, holds my video back
    const short = held && (plan.step < 0 || plan.step > st.step);   // the path gives less than this step needs
    // lost reports count while my video is a real load (at least half the lowest step's need): a trickle (a paused
    // sender's keep-alive frames) gets no prompt report, and read as lost reports it held a calm link down (t3/t4 11-14:
    // 'stale' every look while the estimate climbed 0.9 -> 5.9 Mbit)
    const minBps = K.TURN_VIDEO_MIN_BYTES * (1000 / (tickMs || 500)) * 8;
    const lossy = (+look.loss || 0) >= THROTTLE_LOSS || (!!look.stale && (+look.vRate || 0) >= THROTTLE_STEPS[last].need * minBps / 2);
    const congested = lossy || short;
    const wait = (n) => THROTTLE_UP_MS * Math.pow(2, Math.min(PROBE_BACKOFF_MAX, n || 0));
    if (video) videoLook();
    voiceLook();
    return st;
    function videoLook() {
    // video on probation: the first congested look takes the try back
    if (st.probation) {
      if (congested) { if (st.probation.from < 0) { st.busy = true; st.pausedAt = now; } else st.step = st.probation.from; st.probeN = (st.probeN || 0) + 1; st.probation = null; st.okSince = 0; st.bad = 0; return; }
      if (look.fresh !== false && ++st.probation.clean >= 2) { st.probation = null; st.probeN = 0; }   // two clean fresh reports end it
    }
    if (congested) {
      st.okSince = 0; st.bad = (st.bad || 0) + 1;
      if (st.busy) { st.pausedAt = now; return; }   // still congested while paused: the calm wait starts again
      if (st.step >= last) { if (st.bad >= 2) { st.busy = true; st.pausedAt = now; } return; }
      if (st.bad < 2 && (+look.loss || 0) < 4 * THROTTLE_LOSS) return;   // one congested look is a blip; heavy loss acts at once
      st.step = Math.max(st.step + 1, plan.step < 0 ? last : Math.min(last, plan.step));
      st.bad = 0;   // the pause counts congested looks ON the lowest step only
      return;
    }
    if (look.fresh === false) return;   // no fresh report this look: neither calm nor congested (audio reports come seconds apart; a calm read here broke every two-look count, t5 11-14)
    st.bad = 0;
    if (st.busy) { if (st.voice === 'full' && !st.vProbation && now - (st.pausedAt || 0) >= wait(st.probeN)) { st.busy = false; st.step = last; st.okSince = now; st.probation = { from: -1, at: now, clean: 0 }; } return; }
    if (held) { st.okSince = 0; return; }   // held back by the path: no climb
    if (st.step > 0) {
      if (!st.okSince) st.okSince = now;
      else if (now - st.okSince >= wait(st.probeN) && (roomFor(st.step - 1, look, tickMs) || (look.flow && look.clean))) { st.probation = { from: st.step, at: now, clean: 0 }; st.step--; st.okSince = now; }
    }
    }
    // THE VOICES, after the video's look (they read whether video has anything left to give). A starved link loses
    // packets report after report (c81 11-14: every other audio report under an 80 kbit cap); a path change (the link
    // just came up, its path went down and back, a standby took over) loses them in a burst of its own, left out for
    // TURN_THROTTLE_UP_MS (look.settling). The voices step down on VOICE_BAD lossy of the last 3 fresh reports with no
    // video left to give; on probation one lossy report is enough, and two clean fresh ones end it.
    function voiceLook() {
      const noVideoLeft = !video || st.busy || !look.flow;   // a link whose video sends nothing (paused, or no frames from this end) has nothing left to give
      if (look.fresh !== false && !look.settling) st.vHist = (st.vHist || []).concat(lossy ? 1 : 0).slice(-3);   // the last fresh reports (a path event's own losses left out)
      const bad = (st.vHist || []).reduce((a, b) => a + b, 0);
      if (st.voice === 'full') {
        // EVIDENCE OF THE CAP, not just loss: the estimate leaves less than one TURN_BASE_BYTES of room over the voices' own
        // full wire (fin42-1 11-14: one 6% report on a link sending 12 of 24 KB/s with a 178 kbit estimate stepped a forwarded
        // mix to 16k for 13 s, and the far office heard the re-encode as static; capped links read 90-120 kbit)
        const capped = (+look.bps || 0) * (1 - THROTTLE_LOSS) < voiceWire(look) + K.TURN_BASE_BYTES * (1000 / (tickMs || 500)) * 8;
        if (lossy && !look.settling && noVideoLeft && capped && (st.vProbation || bad >= VOICE_BAD)) { st.voice = 'low'; st.vOkSince = 0; st.vHist = []; if (st.vProbation) st.vProbeN = (st.vProbeN || 0) + 1; st.vProbation = 0; }
        else if (st.vProbation && !lossy && look.fresh !== false && ++st.vClean >= 2) { st.vProbation = 0; st.vProbeN = 0; }   // two clean fresh reports end the probation
      } else if (lossy) st.vOkSince = 0;
      else {
        // back to the full rate when the loss stops: at the first clean fresh report the first time (a burst that only looked
        // like starvation costs the forwarded mixes a few seconds, not a re-encoded voice for TURN_THROTTLE_UP_MS: 3+3 freeze
        // rooms 11-14, static on the stadium mixes 10-18 s), after TURN_THROTTLE_UP_MS doubled per failed try once a try failed;
        // only ever into an estimate that carries the full voices (c91: a full-voice try under an 80 kbit cap took the link down)
        if (!st.vOkSince) st.vOkSince = now;
        const calmFor = st.vProbeN ? wait(st.vProbeN - 1) : 0;
        if (look.fresh !== false && now - st.vOkSince >= calmFor && (+look.bps || 0) * (1 - THROTTLE_LOSS) >= voiceWire(look)) { st.voice = 'full'; st.vProbation = now; st.vClean = 0; }
      }
    }
  }

  // subsPresent(subs, now, inRoom, freshMs, me) → [{ key, tier, links, ticket }] the subscribers whose vouch counts now (TURN.11: the
  // pool sums over the subscribers present in the MEETING). subs: Map pid → { tier (display), links (the ticket's signed turnVideoLinks), exp (s), ticket, at (ms, last heard) }.
  // Present: me; a seat of my own room (inRoom(pid)); or, in another room of the meeting (joined by a relayed pipe), one
  // whose statement was heard within freshMs (it restates itself while it stays). Ordered by key alone, so both ends of
  // a link read the same list and pick the same subscriber for it (vouchPayers).
  function subsPresent(subs, now, inRoom, freshMs, me) {
    const out = [];
    for (const [pid, s] of subs || []) {
      if (!s || !(s.exp * 1000 > now)) continue;
      if (pid === me || (inRoom && inRoom(pid)) || now - (s.at || 0) <= freshMs) out.push({ key: pid, tier: s.tier, links: linksOf(s), ticket: s.ticket });
    }
    return out.sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
  }

  // The video links one subscriber present vouches for: its ticket's signed line item (grants.turnVideoLinks).
  const linksOf = (s) => (s && Number.isInteger(s.links) && s.links > 0 ? s.links : 0);
  // vouchRank(links, pool) → the ids that carry video now, in turnVouchOrder: the first `pool` links.
  // links: [{ id, stage, cell, serial }]; pool: the sum of the video links the subscribers present vouch for.
  function vouchRank(links, pool) {
    const T = meshTurn();
    const ix = (links || []).slice();
    const before = (x, y) => T.turnVouchOrder(!!x.stage, x.cell, x.serial, !!y.stage, y.cell, y.serial);
    ix.sort((x, y) => (before(x, y) ? -1 : before(y, x) ? 1 : 0));
    return ix.slice(0, Math.max(0, pool | 0)).map((x) => x.id);
  }
  function vouchPlan(links, pool) { return new Set(vouchRank(links, pool)); }
  // vouchPayers(ids, subs) → Map id → subscriber: whose vouch each vouched link uses. subs in key order (subsPresent),
  // each taking as many links as its ticket vouches for, in the order of ids (vouchRank). A link's paid ask presents that
  // subscriber's ticket, and the service counts the link on that subscriber, so the pool is the sum of what each
  // subscriber may vouch for. Both ends read the same subscribers and link facts, so they pick the same one.
  function vouchPayers(ids, subs) {
    const out = new Map();
    let k = 0;
    for (const s of subs || []) for (let n = linksOf(s); n > 0 && k < ids.length; n--) out.set(ids[k++], s);
    return out;
  }
  // budgetTicket(subs) → the meeting ticket a subroom ask presents: the subscriber whose ticket vouches for the most links
  // (the meeting's pipe budget follows it), the lowest key on a tie; null with no subscriber.
  function budgetTicket(subs) {
    let best = null;
    for (const s of subs || []) if (s && s.ticket && (!best || linksOf(s) > linksOf(best) || (linksOf(s) === linksOf(best) && s.key < best.key))) best = s;
    return best ? best.ticket : null;
  }

  // ---- the links of this page --------------------------------------------------
  // createLinks(io) → the manager run.html drives once a tick. io (all functions):
  //   me() my peer id; dev() my device tag; sid() the room's relay session; now(); tickMs
  //   seat() → { head, greeter, view: [pid], cell } | null   (head: my seat is its part's home cell; greeter: Section 1)
  //   reach(pid) → 'direct' | 'friend' | null   as this page knows them
  //   greeters() → [pid] the door's list as my seat last read it; nid(pid) → a seat's number (the order of rings on a tie);
  //   epoch(pid) → when that greeter's room was founded, as the door's list says (-1: not said); myEpoch() → my room's
  //   doorNet(pid), probed(), friends(), judged(), askedAt(pid): the TURN.4.3 / TURN.18 verdict inputs (optional)
  //   blocked() → my network blocks direct connections (the page's own probe)
  //   alive(pid) → the far page is still in the meeting      pcUp(pid) → the pair's connection is up
  //   sendTv(addr, frame): addr a peer id, or a device tag (a pipe's far end before it answers; the relay routes both)
  //   askVouch(farDev, l); ask(body) → Promise<json> (/v1/ice); askSub(body) → Promise<json> (/v1/sub)
  //   THE SUBROOM ASK: asker() → null | 'joiner' (about to found a room on silence at my door) | 'head' (the head of a
  //     seated room that reaches no older room at door 0) | 'repipe' (SUB.3: a seat of either side of a lost pipe, door 0 too);
  //     tdoors(q) → Promise<{ v: the relay's signed door list (q: device tags it also says live or gone), p: { device tag → peer id } of its listed heads }> (or the
  //     list alone); probeDoor(r, pids) → true | false | 'pending': door r tried by dialling those of its heads (the
  //     ordinary dial and its verdict; my seat never leaves its own door to look); sub() → my door's subroom; meetingFull() → my meeting is at
  //     its plan's limit (a NEW pipe is then refused: room limits apply at entry only)
  //   standbySeat() → { pid, dev } | null: the seat of my subroom that ends a pipe's warm standby on my side (another
  //     capable row head, the fewest pipes and standbys first; with one row head the next seat of its row); null: I am
  //     my subroom's only seat, so I keep that end myself
  //   knownSub(r) → subroom r's people are still in my meeting's count (the mesh's fold): a pipe for r re-links it
  //   dial(pid); reset(pid) (a fresh pc on the new settings, no dial); restart(pid, l) (move a live pc onto new settings)
  //   keep(pid) (the seat holds this pc: an L28 keep); drop(pid, why) (the TURN pc ends)
  //   subs() → [{ key, tier, ticket }] verified subscribers present (subsPresent: key order), each with its meeting ticket
  //   noPc() → this page has no usable pc (it gathers no candidate) and is carried instead (true: it has left the mesh)
  //   web() → this browser can run the web path; turnPath(pid) → { at, relay }: when my connection of that pair began
  //   looking for its relay path (0: not yet) and whether it found one; webOpen(pid, { url, auth }); webAuth(pid, auth);
  //   webUp(pid) → the web path carries end to end; webClose(pid)                                    (TURN.18)
  //   publish(fact); facts() → [fact] (every link fact heard, mine included); log(line); changed(pid)
  function createLinks(io) {
    const K = meshConsts().consts, T = meshTurn();
    const tick = io.tickMs || 500;
    const WAIT_MS = K.TURN_WAIT * tick;                        // TURN.4
    const ASK_MS = K.FHOP_RELAY_ASK * tick;                    // TURN.4.3: one dial's direct verdict
    const MERGE_MS = K.RELAY_TTL * tick;                       // TURN.4.3: an entry ask's verdict holds this long
    const HELD_MS = K.TURN_HELD_TTL * tick;                    // TURN.5.2: a listing's longest life (2 x RELAY_TTL)
    const RETRY_MS = K.TURN_RETRY * tick;                      // TURN.10
    const RESEND_MS = K.TURN_DIAL * tick;                      // a handshake frame the relay lost is sent again
    const DIAL_BUDGET_MS = (K.TURN_DIAL + K.TURN_RETRY) * tick; // an ask that never came up is closed (TURN.8 dialfail)
    const GRACE_MS = K.TURN_VOUCH_GRACE * tick;                // TURN.12
    const WEB_WAIT_MS = K.TURN_WEB_WAIT * tick;                // TURN.18: a client's connection that found no relay path this long takes the web path
    const MOVE_MS = (K.TURN_DIAL + K.LINK_DIAL_ICE) * tick;     // one move of a link's pc onto new settings: its offer and answer over the pair's channel, then the path check through the server
    const FACT_EVERY_MS = K.TURN_DIAL * tick * 2;              // a link end restates its fact
    const FACT_STALE_MS = FACT_EVERY_MS * 4;
    const links = new Map();   // far address (its peer id; a pipe I opened: the far end's device tag until it answers) → link
    // THE SUBROOM ASK. One machine, stepped once a tick while io.asker() names a reason to ask. Its outcome for the page:
    //   { join: r }                        a listed subroom's door reached: reconnect there, an ordinary join
    //   { found: r, sg, far, link }        a new subroom (or a re-pipe, r unchanged): found it with sg; the pipe is opened here
    //   { wait: 1 }                        a door list, an answer or a door probe is on its way, or a subroom is opening
    //   { refused: why, retryAt }          budget, rate, no far end, the meeting full, no service: no pipe, ask again at retryAt
    const sub = { st: 'idle', gen: 0, out: null, retryAt: 0, pipeRetryAt: 0, token: null, list: [], probe: [], found: null, why: '', heads: null, tried: null, mult: 1, lastWhy: '', doorsSig: '', repipe: false, ans: false, ends: [], wantProbe: false, probedSig: null, probeAt: 0 };
    // THE WARM STANDBY (TURN.9 for pipes). Every live pipe l<r> keeps a standby s<r>: a second relayed connection between
    // OTHER seats of the same two subrooms, connected and idle (keep-alives only: no media, no mesh traffic). When a live
    // end leaves (its goodbye) or its connection dies (the pc's own verdict), the standby pair takes the pipe over at once
    // and a new standby is warmed. A seat ends at most SB_PER_SEAT standbys.
    const SB_PER_SEAT = 2;
    const sbExpect = new Map();   // 's<r>' → the live end of my subroom whose standby I am to end (its far side's standby seat)
    const pipeNo = (l) => Number(String(l).slice(1));
    let serialN = 0, lastFactAt = 0;
    const log = (s) => { try { if (io.log) io.log(s); } catch (e) {} };
    const short = (p) => String(p || '').slice(0, 8);

    // newLink(far, l, opener, farDev, farR): a pipe I opened knows its far end's device tag and subroom from the grant and
    // is addressed by that tag until the far end answers (then by its peer id); a pipe I was asked for knows its opener.
    function newLink(far, l, opener, farDev, farR) {
      const L = { far, l, opener, id: linkId(io.me(), far), farDev: farDev || null, farR: farR == null ? Number(l.slice(1)) : farR, farPid: opener ? null : far, own: null,
        farBlocked: false, client: false, mine: null, peer: null,
        state: 'ask', askAt: io.now(), sentAt: 0, vAskAt: 0, readyMe: false, readyFar: false, dialAt: 0, upAt: -1, downSince: 0,
        cred: null, paid: null, paidMe: false, paidFar: false, paidSaid: false, paidAt: 0, mvWant: false, mvAt: 0, mvN: 0, mvWhy: '', video: false, vouched: false, lostAt: -1, side: [],
        thr: null, busy: false, farBusy: false, capAt: 0, upOkSince: 0, standbyAt: 0, standbyN: 0,
        web: false, webHost: '', webOpen: false, webSaidAt: 0, sb: l[0] === 's', liveEnd: null, sbUp: false, sbAt: 0, sbSeat: null, farSb: null, direct: false, directAt: 0 };
      const s = io.seat(); if (s) L.side = s.view.filter((x) => x !== far).slice(0, SIDE_MAX);
      links.set(far, L);
      log('turn-link new ' + short(far) + ' ' + l + (opener ? ' opener' : ' target'));
      return L;
    }
    function close(L, why, quiet) {
      if (L.state === 'closed') return;
      // SUB.5: a direct dial that closes before it came up (its own verdict, or the far end's: 'far-closed') was no direct
      // pair after all, at BOTH ends; else the end that did not judge it dials it direct again on its stale note, forever
      if (L.direct && L.state !== 'up' && io.directForget) { try { io.directForget(L.far); } catch (e) {} }
      L.state = 'closed';
      try { if (L.cred) L.cred.stop(); } catch (e) {}
      try { if (L.paid) L.paid.stop(); } catch (e) {}
      if (L.web) { try { io.webClose(L.far); } catch (e) {} }
      links.delete(L.far);
      if (!quiet) { try { io.sendTv(L.far, { k: 'tv', q: 'x', l: L.l }); } catch (e) {} }
      if (L.sb && L.liveEnd && L.liveEnd !== io.me()) { try { io.sendTv(L.liveEnd, { k: 'tv', q: 'x', l: L.l }); } catch (e) {} }
      if (L.sb && L.liveEnd === io.me()) { const P = livePipe(pipeNo(L.l)); if (P) P.sbUp = false; }
      log('turn-link closed ' + short(L.far) + ' ' + why);
      if (L.upAt > 0) subChanged('a pipe of mine');
      if (!L.sb && L.l[0] === 'l' && L.upAt > 0 && why !== 'standby-took-over' && why !== 'replaced' && why !== 'healed' && why !== 'walked' && (io.sub ? io.sub() : 0) === pipeNo(L.l)) sub.repipe = true;   // SUB.3 (a): an end of my room's pipe that closed with no takeover asks at once
      try { io.drop(L.far, why, { pipe: !L.sb && L.l[0] === 'l' && L.upAt > 0, sub: pipeNo(L.l) }); } catch (e) {}   // pipe l<r> is subroom r's (a pipe that came up: one that never did is asked for again as before)
      if (L.farPid && !L.sb) { try { io.publish({ id: L.id, a: L.opener ? io.me() : L.far, b: L.opener ? L.far : io.me(), up: 0, v: 0, gone: 1 }); } catch (e) {} }
      try { io.changed(L.far); } catch (e) {}
    }
    // THE VOUCH ON DEMAND. A relay vouch is asked for only when a credential ask is about to present it (and while a
    // link has none at all yet), never on a timer: a vouch good for at least one credential answer's wait is usable.
    const usableAt = (e) => e - io.now() > FETCH_TIMEOUT_MS;
    const fresh = (L) => !!(L.mine && L.peer && usableAt(L.mine.e) && usableAt(L.peerE));
    // e: the subroom my end sits in (base 36), so the far end vouches its pipe end toward the right side: pipe l<r> joins r and
    // the subroom it hangs from, and either side may have opened it (SUB.3: a re-pipe asked for a subroom cut off from mine)
    function sendAsk(L) { if (L.direct) return; L.sentAt = io.now(); io.sendTv(L.far, { k: 'tv', q: 'a', l: L.l, d: io.dev(), b: io.blocked() ? 1 : 0, e: mySubFor(L).toString(36) }); }
    // Is pipe l<r> already part of my meeting? Then a handshake for it re-links a subroom the meeting holds (a re-pipe,
    // a standby taking over): no new entry. Judged only from what my own meeting holds, never from the asker's word: a
    // room-wide fact of pipe l<r> heard within its life, a pipe of mine by that name, or subroom r's people still in my
    // meeting's count (io.knownSub, from the mesh's fold).
    function knownPipe(l) {
      const r = pipeNo(l);
      if (io.knownSub && io.knownSub(r)) return true;
      for (const L of links.values()) if (pipeNo(L.l) === r && L.state !== 'closed') return true;
      for (const f of io.facts() || []) if (f && !f.gone && f.l === l) return true;
      return false;
    }
    // My vouch names the subroom my relay socket sits in: a pipe I opened for a NEW subroom waits until my door is that
    // subroom; a re-pipe I opened (my own subroom's, or one cut off from mine) and a standby I opened name my door as it is.
    const mySubFor = (L) => (L.opener ? (L.own != null ? L.own : Number(L.l.slice(1))) : (io.sub ? io.sub() : 0));
    function askMine(L) { if (!L.farDev || L.direct) return; if (io.sub && io.sub() !== mySubFor(L)) return; L.vAskAt = io.now(); io.askVouch(L.farDev, L.l); }
    function credFor(L, pool) {
      return createCredentials({ ask: io.ask, room: io.sid(), pool, now: io.now, setTimer: io.setTimer, clearTimer: io.clearTimer,
        extra: () => {
          if (!fresh(L)) {   // the ask waits (the client retries) for both ends' fresh vouches, each made now
            if ((!L.mine || !usableAt(L.mine.e)) && io.now() - L.vAskAt > RESEND_MS) askMine(L);
            if ((!L.peer || !usableAt(L.peerE)) && io.now() - L.sentAt > RESEND_MS) sendAsk(L);   // an ask is the far end's cue to send its vouch
            return null;
          }
          const b = { vouch: L.mine.v, peerVouch: L.peer };
          if (pool === 'paid') {   // the ticket of the subscriber whose vouch this link uses (vouchPayers)
            const s = (io.subs() || []).find((x) => x.key === L.payer);
            if (!s || !s.ticket) return null;
            b.ticket = s.ticket;
          }
          return b;
        },
        onChange: (k) => onCred(L, pool, k) });
    }
    function onCred(L, pool, k) {
      log('turn-cred ' + short(L.far) + ' ' + pool + ' ' + k);
      if (L.state === 'closed') return;
      if (L.web) {   // TURN.18: the web path shows each fresh credential on its open socket; the connection itself never moves
        if (pool === 'free') {
          if (k === 'expired') { close(L, 'expired'); return; }
          if (!L.readyMe) { L.readyMe = true; io.sendTv(L.far, { k: 'tv', q: 'r', l: L.l }); }
          webGo(L);
        } else {
          const was = L.paidMe; L.paidMe = k !== 'expired';
          if (L.paidMe) webAuth(L, 'paid');
          if (was !== L.paidMe) io.sendTv(L.far, { k: 'tv', q: 'p', l: L.l, b: L.paidMe ? 1 : 0 });
        }
        io.changed(L.far);
        return;
      }
      if (pool === 'free') {
        if (k === 'ok' && !L.readyMe) { L.readyMe = true; io.reset(L.far); io.sendTv(L.far, { k: 'tv', q: 'r', l: L.l }); maybeDial(L); }
        else if (k === 'ok' && L.tookOver) { L.tookOver = false; move(L, 'took-over'); }
        else if (k === 'renewed' && !L.paidMe) move(L, 'renewed');
        else if (k === 'expired' && !L.paidMe) close(L, 'expired');
      } else {
        // 'p' (b 1) waits for the move itself: my pc rides a paid server (onServer), or one move's time has passed (paidSay)
        if (k === 'ok' || k === 'renewed') { const was = L.paidMe; L.paidMe = true; if (!was) { L.paidAt = io.now(); L.paidSaid = false; } move(L, k === 'ok' ? 'paid' : 'paid-renewed'); }
        else if (k === 'expired') { L.paidMe = false; L.paidSaid = false; move(L, 'paid-expired'); io.sendTv(L.far, { k: 'tv', q: 'p', l: L.l, b: 0 }); }
      }
      io.changed(L.far);
    }
    // Both vouches in hand: a client asks for its credential; an end that is no client is ready at once.
    function haveBoth(L) {
      if (L.readyMe || L.state === 'closed') return;
      L.client = clientEnd(io.blocked(), L.farBlocked, L.opener);
      if (L.client) { if (!L.cred) { L.cred = credFor(L, 'free'); L.cred.start(); } }
      else { L.readyMe = true; io.reset(L.far); io.sendTv(L.far, { k: 'tv', q: 'r', l: L.l }); maybeDial(L); }   // both ends dial on a fresh pc: a half-made one from a door knock (still checking, an offer of its own out) ignores the dial ask
      if (L.state === 'ask') L.state = 'swap';
    }
    // SUB.5 THE DIRECT STANDBY (TURN.7, the sim's sweep (1)): a standby whose two ends reach each other without TURN is
    // dialled on a plain pc (no server, no credential, no vouch), and once it is open beside a pipe on TURN it IS the pipe
    // (SUB.8: the two change places, make before break). A direct pipe carries everything, video too, and takes no vouch slot.
    function setDirect(L) {
      if (L.direct || L.state === 'closed') return;
      L.direct = true; L.directAt = io.now(); L.video = true; L.client = false; L.readyMe = true;
      if (L.cred) { try { L.cred.stop(); } catch (e) {} L.cred = null; }
      if (L.state === 'ask') L.state = 'swap';
      if (L.state === 'up') { L.state = 'swap'; L.dialAt = 0; }   // a standby that was up on TURN is dialled again, plain: it is up (and says so, direct) when that connection is
      log('turn-direct ' + short(L.far) + ' ' + L.l);
      io.reset(L.far);   // a pc not yet open, built on relay-only settings, is built again plain
      io.sendTv(L.far, { k: 'tv', q: 'r', l: L.l });
      maybeDial(L);
      io.changed(L.far);
    }
    // ---- TURN.18: the web path -------------------------------------------------------------------------------------
    // webStart: this link leaves the relay protocol for the web path. `mine`: my own connection found no relay path
    // (the far end is told); else the far end said so. Both ends hold a credential on the web path (each shows its own
    // to the server), so an end that was no client asks for one now. The opener names the host; the link's dial
    // budget starts again, since the first one was spent learning that the relay protocol does not pass.
    function webStart(L, mine, host) {
      if (L.state === 'closed' || L.state === 'up') return;
      // no usable pc here (its connection gathers no candidate: the web path's in-page pair could not connect either): the
      // page is carried by a seat instead (run.html carryInstead, docs/turn-carry.md). The link ends with the mesh it left.
      if (io.noPc && io.noPc()) { if (!L.noPc) { L.noPc = true; log('turn-web ' + short(L.far) + ' no usable connection here: carried instead'); } return; }
      if (!io.web || !io.web()) { if (!L.webNo) { L.webNo = true; log('turn-web ' + short(L.far) + ' not in this browser'); } return; }
      if (!L.web) {
        L.web = true; L.webMine = !!mine; L.askAt = io.now();
        log('turn-web ' + short(L.far) + (mine ? ' no relay path from here' : ' the far end has no relay path'));
        if (!L.cred && L.mine && L.peer) { L.cred = credFor(L, 'free'); L.cred.start(); }
        io.changed(L.far);
      }
      if (host && !L.opener && L.webHost !== host) { L.webHost = host; if (L.webOpen) { L.webOpen = false; try { io.webClose(L.far); } catch (e) {} } }
      webGo(L);
    }
    function webSay(L) { if (L.noPc) return; L.webSaidAt = io.now(); const f = { k: 'tv', q: 'w', l: L.l }; if (L.opener && L.webHost) f.m = L.webHost; io.sendTv(L.far, f); }
    // p: the link's id (both ends derive it from their two ids): two links of a room may share a link name, and the
    // server pairs the two ends of THIS one by it
    function webCred(L) { const g = L.cred && L.cred.servers(); return g && g[0] ? { u: g[0].username, c: g[0].credential, p: L.id } : null; }
    function webAuth(L, pool) {
      if (!L.webOpen) return;
      if (pool === 'paid') { const g = L.paid && L.paid.servers(); if (g && g[0]) io.webAuth(L.far, { pool: 'paid', u: g[0].username, c: g[0].credential }); return; }
      const a = webCred(L); if (a) io.webAuth(L.far, a);
    }
    // webGo: open my end once I hold a credential and the host is known; a live end is shown each fresh credential.
    function webGo(L) {
      if (!L.web || L.state === 'closed') return;
      const mine = (L.cred && L.cred.web()) || [];
      if (L.opener && !L.webHost && mine.length) L.webHost = mine[0];
      if (!L.webSaidAt || (L.opener && L.webHost && !L.webSaidHost)) { if (L.opener && L.webHost) L.webSaidHost = true; webSay(L); }
      const a = webCred(L);
      if (!a || !L.webHost) return;
      if (L.webOpen) { webAuth(L, 'free'); if (L.paidMe) webAuth(L, 'paid'); return; }
      if (!webHostOk(L.webHost, mine)) { if (L.webBad !== L.webHost) { L.webBad = L.webHost; log('turn-web ' + short(L.far) + ' host not of my service: ' + L.webHost); } return; }
      L.webOpen = true; L.readyMe = true; L.state = 'dial'; if (!L.dialAt) L.dialAt = io.now();
      log('turn-web open ' + short(L.far) + ' ' + L.webHost);
      io.webOpen(L.far, { url: (io.webScheme ? io.webScheme() : 'wss://') + L.webHost + '/', auth: a });
      if (L.paidMe) webAuth(L, 'paid');
    }
    function maybeDial(L) {
      if (L.web) return;
      if (!L.opener || !L.readyMe || !L.readyFar || L.dialAt || (L.direct && !L.dEcho)) return;   // a direct standby dials once the far end echoed 'd' (its pc is plain too)
      L.dialAt = io.now(); L.state = 'dial';
      log('turn-dial ' + short(L.far) + ' client=' + (L.client ? 1 : 0));
      io.dial(L.far);
    }

    // A `tv` frame from the far end (relay, or the pair's own channel once open).
    function onFrame(from, f) {
      if (!tvOk(f) || from === io.me()) return;
      if (f.q === 'c') { cutHeard(from, f); return; }   // TURN.5.3
      let L = links.get(from);
      if (!L && onSide(from, f)) return;
      if (!L) {   // the first answer of a pipe I opened: from now on it is addressed by the far end's peer id
        for (const x of links.values()) if (x.opener && !x.farPid && x.l === f.l) { L = x; break; }
        if (L) { links.delete(L.far); L.far = from; L.farPid = from; L.id = linkId(io.me(), from); links.set(from, L); }
      }
      if (L) L.heardAt = io.now();
      // SUB.5: the standby's opener knows its far end now; a plain pc of mine reached it off TURN: only a proven direct path
      if (L && L.sb && L.opener && !L.direct && L.farPid && L.l === f.l && f.q !== 'x' && io.directSeen && io.directSeen(L.farPid)) { setDirect(L); L.dSentAt = io.now(); io.sendTv(L.far, { k: 'tv', q: 'd', l: L.l }); }
      if (f.q === 't') { if (L && L.sb && L.l === f.l) takeover(L, f.b === 1 ? 'healed' : 'the far standby end took over'); return; }
      // the far end names its side's standby seat only while it holds no standby up: the opener opens one toward it
      if (f.q === 'o') {   // SUB.8.1, between the two ends of a pipe
        if (!L || L.sb || L.l !== f.l || L.state === 'closed') return;
        if (f.b === undefined) L.farS1 = String(f.m).split(',');
        else if (f.b === 1 && !L.opener && s1List().indexOf(f.m) >= 0) { log('turn-probe stand ' + L.l + ' on my seat ' + short(f.m)); L.sbWant = f.m; restand(L); }
        return;
      }
      if (f.q === 's') { if (L && !L.sb && L.opener && L.l === f.l && f.d) { L.sbUp = false; L.sbAt = 0; if (L.farSb !== f.d) L.farSb = f.d; } return; }   // (sbAt 0: ask my side's seat at once; a standby already up answers 'r' at once, bindStandby)
      if (f.q === 'x') {
        if (L && L.l === f.l) {
          if (f.b === 1 && L.opener) { sub.why = 'full'; log('turn-link refused ' + short(from) + ' ' + L.l + ': the meeting is full'); }
          close(L, f.b === 1 ? 'full' : 'far-closed', true);
        }
        return;
      }
      if (f.q === 'a') {
        if (!L) {
          const s = io.seat();
          if (!s || !s.greeter) return;                       // only a seated greeter can be vouched for: say nothing
          if (s.view.indexOf(from) >= 0 && io.reach(from) === 'direct') return;   // reached already: no link
          // A new pipe is a new entry: refused while my meeting is at its plan's limit (room limits apply at entry
          // only; a pipe re-linking a subroom my meeting already holds is never refused for it: knownPipe).
          if (f.l[0] === 's') {   // a standby: only a seat its own live end named takes it
            if (!sbExpect.has(f.l)) return;
            L = newLink(from, f.l, false); L.heardAt = io.now(); L.liveEnd = sbExpect.get(f.l);
          } else if (io.meetingFull && io.meetingFull() && !knownPipe(f.l)) { log('turn-link refused ' + short(from) + ' ' + f.l + ': the meeting is full'); io.sendTv(from, { k: 'tv', q: 'x', l: f.l, b: 1 }); return; }
          if (!L) { L = newLink(from, f.l, false); L.heardAt = io.now(); }
        }
        if (L.l !== f.l) return;
        const first = !L.farDev;
        L.farDev = f.d; L.farBlocked = f.b === 1;
        if (!L.opener && f.e !== undefined) L.farR = parseInt(f.e, 36);   // the opener's subroom (an older page says none: the pipe's own)
        if (!L.opener && (first || io.now() - L.sentAt > RESEND_MS)) sendAsk(L);   // the target answers with its own device and network
        if (!L.mine || !usableAt(L.mine.e)) { if (io.now() - L.vAskAt > RESEND_MS / 2) askMine(L); }
        else io.sendTv(L.far, { k: 'tv', q: 'v', l: L.l, e: L.mine.e.toString(36), n: L.mine.n, m: L.mine.m });
        return;
      }
      if (!L || L.l !== f.l) return;
      if (f.q === 'v') {
        if (!L.farDev) return;
        const e = parseInt(f.e, 36);
        L.peer = vouchToken(io.sid(), L.farR, L.farDev, io.dev(), L.l, e, f.n, f.m); L.peerE = e;
        if (L.mine) haveBoth(L);
        return;
      }
      if (f.q === 'r') { L.readyFar = true; maybeDial(L); return; }
      if (f.q === 'd') { if (!L.sb) return; if (L.opener) { if (L.direct && !L.dEcho) { L.dEcho = true; maybeDial(L); } } else { setDirect(L); io.sendTv(L.far, { k: 'tv', q: 'd', l: L.l }); } return; }   // the target echoes: the opener dials only then
      if (f.q === 'w') { webStart(L, false, f.m); if (L.opener && io.now() - L.webSaidAt > RESEND_MS / 2) webSay(L); return; }
      // the far end moved its pool: it moves the pc itself (its own restart, or 'i' to the offerer), so no restart here:
      // a second one per move restarted the path again mid-move and the video's estimate with it (vouched one-way, 2026-11-12)
      if (f.q === 'p') { L.paidFar = f.b === 1; io.changed(L.far); return; }
      if (f.q === 'i') { move(L, 'far'); return; }
      if (f.q === 'b') { const was = L.farBusy; L.farBusy = f.b === 1; if (was !== L.farBusy) { log('turn-busy far ' + short(L.far) + ' ' + (L.farBusy ? 'on' : 'off')); io.changed(L.far); } return; }
    }
    // TURN.13: each look at the link pc (every THROTTLE_LOOK_MS while it carries video): the browser's send estimate,
    // the loss and round trip the far end reports. throttleNext decides the step (pure, below).
    // m = { stale, voiceFull, voiceN, data } (run.html turnWatch): the link's reports, its audio senders and its data.
    // Every TURN link's voices are watched (TURN.13); its video steps only while it carries video.
    function onCapacity(pid, bps, loss, rtt, limited, m) {
      const L = links.get(pid); if (!L || L.state !== 'up' || L.direct) return;
      const now = io.now(); L.capAt = now; L.cap = bps;
      const x = m || {};
      if (!L.ts) L.ts = { step: 0, busy: false };
      const was = L.ts.busy ? -1 : L.ts.step, vWas = L.ts.voice || 'full';
      throttleNext(L.ts, { bps, loss, rtt, limited: !!limited, cap: L.thr && L.thr.step >= 0 ? L.thr.maxBitrate : 0, stale: !!x.stale, voiceFull: +x.voiceFull || 0, voiceN: x.voiceN | 0, data: +x.data || 0, video: !!L.video, flow: !!x.flow, clean: !!x.clean, vRate: +x.vRate || 0, settling: now - Math.max(L.upAt || 0, L.pathAt || 0) < THROTTLE_UP_MS, fresh: x.fresh == null ? undefined : !!x.fresh }, now, tick);
      if ((+loss || 0) >= THROTTLE_LOSS || x.stale) log('turn-lossy ' + short(L.far) + ' loss=' + Math.round((+loss || 0) * 100) + '%' + (x.lossKind ? '(' + x.lossKind + ')' : '') + (x.stale ? ' stale ' + Math.round((+x.vRate || 0) / 1000) + 'k' : '') + ' flow=' + (x.flow ? 1 : 0) + ' cap=' + Math.round((bps || 0) / 1000) + 'k voices=' + (x.voiceN | 0) + ' data=' + Math.round((+x.data || 0) / 1000) + 'k');   // what made a look congested (TURN.13)
      if (L.ts.voice !== 'low') L.voiceLow = 0; else if (vWas !== 'low' || !L.voiceLow) L.voiceLow = voiceLow(x.voiceN, tick);   // latched: the step is set once per step down
      if (L.ts.voice !== vWas) { log('turn-voice ' + short(L.far) + ' ' + (L.voiceLow ? 'low ' + Math.round(L.voiceLow / 1000) + 'k' : 'full') + ' cap=' + Math.round((bps || 0) / 1000) + 'k'); io.changed(L.far); }
      if (!L.video) return;
      const st = L.ts.busy ? -1 : L.ts.step;
      if (st !== was || !L.thr) setThrottle(L, st < 0 ? { step: -1 } : stepOf(st, bps, tick));
    }
    // The pc must ride a server of its CURRENT settings: after a pool move (free -> paid, or back) the move is one ICE
    // restart, and a restart lost to glare left the media on the old pool's allocation (measured 2026-11-12: a vouched
    // link on the free server, its video clamped by the free pool's per-allocation limit). server: the selected local
    // candidate's TURN server (host:port). Off its settings for a dial's time: restart again, once a dial's time.
    function onServer(pid, server) {
      const L = links.get(pid); if (!L || L.state !== 'up' || !L.client || !server) return;
      const list = configOf(L).iceServers || [];
      if (!list.length) { L.offSince = 0; return; }   // no credential of this link yet (a takeover's, a refused one): the pc keeps the path it has
      const on = list.some((x) => (Array.isArray(x.urls) ? x.urls : [x.urls]).some((u) => String(u).replace(/^turns?:/, '').split('?')[0] === server));
      const now = io.now();
      if (on) { L.offSince = 0; if (L.paidMe && L.paid && !L.paidSaid) paidSay(L, 'moved'); return; }
      if (L.mvWant || (L.mvAt && now - L.mvAt < MOVE_MS)) { L.offSince = 0; return; }   // a move is waiting or on its way: the old server is where the pc should still be
      if (!L.offSince) { L.offSince = now; return; }
      if (now - L.offSince >= RESEND_MS && now - (L.offFixAt || 0) >= MOVE_MS) { L.offFixAt = now; log('turn-pool off its settings ' + short(L.far) + ' (rides ' + server + '): move again'); move(L, 'off-settings'); }
    }
    // ONE MOVE AT A TIME. A link's pc moves onto new settings (a pool change, a renewed credential) by one ICE restart from
    // its offerer; the other end asks for it ('i'). Every cause used to restart at once: with both ends on blocked networks
    // each end is a client with its own credential, so a pool move was two restarts a moment apart, the off-settings check
    // added a third one dial's time later, and the video the vouch turned on negotiated across all of them. An offer made
    // while the last one was still unanswered met its answer: the media lines of the two ends parted, the pc was rebuilt,
    // and the only path between the two networks carried nothing for 30 to 60 s (two offices of four, joined at once).
    // Rule: a cause only marks the link (mvWant). The move starts when no offer of this pc is still crossing (io.settled)
    // and the last move is MOVE_MS old or has landed; causes that arrive meanwhile are one more move, not one each.
    // The page applies its own settings at once (io.settings), so one move usually carries both ends' new servers.
    function move(L, why) {
      if (L.state === 'closed' || L.web) return;   // the web path's connection never moves (TURN.18)
      if (io.settings) io.settings(L.far);
      L.mvWant = true; L.mvWhy = why;
      pump(L);
    }
    function pump(L) {
      if (!L.mvWant || L.state === 'closed' || L.web) return;
      if (!(configOf(L).iceServers || []).length) return;   // nothing to move onto: the move waits for the link's credential
      const now = io.now(), settled = io.settled ? !!io.settled(L.far) : true;
      if (L.mvAt && now - L.mvAt < MOVE_MS && !(settled && now - L.mvAt >= RESEND_MS)) return;   // the last move is still on its way
      if (!settled) return;   // an offer of this pc (a move, its media lines') is crossing: the move waits for it, never an ICE restart on top
      L.mvWant = false; L.mvAt = now; L.mvN++;
      log('turn-move ' + short(L.far) + ' ' + L.mvWhy + ' #' + L.mvN);
      io.restart(L.far, L.l);
    }
    // VIDEO WAITS FOR THE MOVE. A client end's pc rides the free pool until the move that follows its paid credential
    // lands. Video turned on at the credential, before the move, rode the free allocation's limit and choked the pair's
    // channel, the move's own offer and answer with it. The far end turns video on when I say 'p' (b 1), and so do I:
    // once my pc rides a paid server, or, where the browser names no server, one move's time after the credential.
    function paidSay(L, why) {
      L.paidSaid = true;
      log('turn-pool paid ' + short(L.far) + ' ' + why);
      io.sendTv(L.far, { k: 'tv', q: 'p', l: L.l, b: 1 });
      io.changed(L.far);
    }
    function configOf(L) {
      if (L.web) return { web: true };   // TURN.18: the pair's connection ends inside this page; nothing of it leaves the network
      const g = (L.paidMe && L.paid && L.paid.servers()) || (L.cred && L.cred.servers()) || [];
      return { iceServers: g, iceTransportPolicy: 'relay' };
    }
    function setThrottle(L, next) {
      const busy = !!(next && next.step < 0);
      const changed = !L.thr || !next || L.thr.step !== next.step;
      L.thr = next;
      if (busy !== L.busy) {
        L.busy = busy; if (busy) L.pausedAt = io.now();
        log('turn-busy ' + short(L.far) + ' ' + (busy ? 'on' : 'off') + ' cap=' + Math.round((L.cap || 0) / 1000) + 'k');
        io.sendTv(L.far, { k: 'tv', q: 'b', l: L.l, b: busy ? 1 : 0 });
      }
      if (changed) { log('turn-step ' + short(L.far) + ' ' + (next ? next.step : 'none') + ' cap=' + Math.round((L.cap || 0) / 1000) + 'k'); io.changed(L.far); }
    }
    // TURN.9: the warm standby. The answer names two servers at two providers, and the link pc is built on both
    // (turnPcConfig), so the browser holds an allocation at each and keeps a checked candidate pair through the second
    // one beside the selected pair: pre-dialled, idle (its consent checks only), no media. When the link's server dies
    // the selected pair goes silent and the browser's ICE agent moves the media onto the standby pair by itself, with no
    // signaling: none could cross, the pair's own channel rode the dead path, and a description never fits the relay.
    // This only watches it: the time from the cut to the path carrying again, against STANDBY_SWITCH_MS. A path that
    // stays down is the link's ordinary loss (step: 'lost' after the dial budget, and the head asks again).
    function onPath(pid, st) {
      const L = links.get(pid); if (!L || L.state !== 'up') return;
      const now = io.now();
      if (st !== 'connected' || L.standbyAt) L.pathAt = now;   // a path event: its own losses are not a cap (TURN.13 voices)
      if (st === 'disconnected' || st === 'failed') {   // (checking is an ICE restart of ours: the paid move, a renewal)
        if (!L.standbyAt) { L.standbyAt = now; L.standbyN++; log('turn-standby path down ' + short(L.far) + ' (' + st + ')'); }
      } else if (st === 'connected' && L.standbyAt) {
        L.lastSwitchMs = now - L.standbyAt; L.standbyAt = 0;
        log('turn-standby carried ' + short(L.far) + ' after ' + L.lastSwitchMs + ' ms' + (L.lastSwitchMs > STANDBY_SWITCH_MS ? ' (PAST the bound ' + STANDBY_SWITCH_MS + ')' : ''));
      }
    }
    // The relay's answer to my tvouch ask: {t:'tvouch', to, l, v, e} or {error}.
    function onVouch(m) {
      if (!m) return;
      let L = null;
      for (const x of links.values()) if (x.farDev === m.to && x.l === m.l) { L = x; break; }
      if (!L) return;
      if (!m.v) { log('turn-vouch refused ' + short(L.far) + ' ' + m.error); return; }
      const p = vouchParts(m.v); if (!p) return;
      if (p.r !== mySubFor(L)) { log('turn-vouch ' + short(L.far) + ' names subroom ' + p.r + ', not this pipe\'s end'); return; }
      L.mine = { v: m.v, e: p.e, n: p.n, m: p.m, at: io.now() };
      log('turn-vouch ' + short(L.far) + ' ' + L.l);
      io.sendTv(L.far, { k: 'tv', q: 'v', l: L.l, e: p.e.toString(36), n: p.n, m: p.m });
      if (L.peer) haveBoth(L);
    }

    // The video plan (TURN.11/12) for my own links, from the room's facts and the subscribers present.
    function planVideo(now) {
      const subs = io.subs() || [];
      let pool = 0;
      for (const s of subs) pool += linksOf(s);
      const ups = [];
      for (const f of io.facts() || []) if (f && f.up && !f.gone && !f.dr) ups.push({ id: f.id, stage: !!f.g, cell: f.c, serial: f.s });
      const rank = vouchRank(ups, pool), want = new Set(rank), payers = vouchPayers(rank, subs);
      for (const L of links.values()) {
        if (L.state !== 'up' || L.sb || L.direct) continue;   // a standby carries keep-alives only; a direct pipe needs no vouch
        const yes = want.has(L.id);
        if (yes) { L.vouched = true; L.lostAt = -1; L.payer = payers.get(L.id).key; }
        else if (L.vouched) { if (L.lostAt < 0) L.lostAt = now; if (now - L.lostAt >= GRACE_MS) { L.vouched = false; L.lostAt = -1; } }
        // A vouched client end moves to the paid pool; an end back on free leaves it.
        const cl = L.client || L.web;   // on the web path each end holds its own credential (TURN.18)
        if (L.vouched && cl && !L.paid) { L.paid = credFor(L, 'paid'); L.paid.start(); }
        if (!L.vouched && L.paid) { try { L.paid.stop(); } catch (e) {} L.paid = null; if (L.paidMe) { L.paidMe = false; L.paidSaid = false; if (!L.web) move(L, 'unvouched'); io.sendTv(L.far, { k: 'tv', q: 'p', l: L.l, b: 0 }); } }
        if (L.client && !L.web && L.paidMe && !L.paidSaid && now - L.paidAt >= MOVE_MS) paidSay(L, 'unseen');
        if (L.vouched && !cl && !L.paidMe) { L.paidMe = true; io.sendTv(L.far, { k: 'tv', q: 'p', l: L.l, b: 1 }); }
        if (!L.vouched && !cl && L.paidMe) { L.paidMe = false; io.sendTv(L.far, { k: 'tv', q: 'p', l: L.l, b: 0 }); }
        // the web path's connection never moves (its 'p' goes out at the credential, onCred), so its video waits for no move
        const v = L.vouched && L.paidMe && L.paidFar && (!L.client || L.web || L.paidSaid);
        if (v !== L.video) { L.video = v; L.ts = L.ts ? { step: 0, busy: false, voice: L.ts.voice, vOkSince: L.ts.vOkSince, vProbation: L.ts.vProbation, vProbeN: L.ts.vProbeN, vClean: L.ts.vClean, vHist: L.ts.vHist } : null; log('turn-video ' + short(L.far) + ' ' + (v ? 'on' : 'off')); if (!v) setThrottle(L, null); io.changed(L.far); }
      }
    }
    function factOf(L) {
      const s = io.seat();
      const o = { id: L.id, l: L.l, a: L.opener ? io.me() : L.far, b: L.opener ? L.far : io.me(), up: L.state === 'up' ? 1 : 0, v: L.video ? 1 : 0,
        s: L.serial || 0, c: s ? s.cell : 0, g: 0, [L.opener ? 'va' : 'vb']: L.side.slice(0, SIDE_MAX) };
      if (L.direct) o.dr = 1;   // SUB.5: a direct pipe: video flows, no vouch slot
      return o;
    }

    // ---- THE SEATED HEAD'S ASK (SUB.2 (ii), TURN.4/TURN.5) --------------------------------------------------------------
    // The head of a seated room at door 0 that holds a foreign greeter nothing reaches (neither directly nor through a
    // friend) for TURN_WAIT, of an OLDER room (the door's founding times; on a tie the lower ring), asks for a subroom:
    // the oldest room keeps door 0. TURN.4.3: the wait is kept per greeter; TURN.18: a greeter the door's list tags with a
    // network mine cannot meet is a verdict at once.
    const head = { since: -1, seen: new Map(), want: false, held: new Map() };   // held (TURN.5.2): pid -> when my view last held it, as a Section-1 seat of door 0
    function turnWaited(now, F) {
      if (F.length && io.doorNet && io.probed && io.probed() && !(io.friends ? io.friends() : true) && (io.judged ? io.judged() : false) && F.every((g) => io.doorNet(g) === 0)) return true;
      if (!io.blocked()) return now - head.since >= WAIT_MS;
      const friends = io.friends ? !!io.friends() : true;
      const judged = !friends && !!io.askedAt && (io.judged ? !!io.judged() : true);
      for (const g of Array.from(head.seen.keys())) if (F.indexOf(g) < 0) head.seen.delete(g);
      const due = (g) => { let d = head.seen.get(g) + WAIT_MS; if (judged) { const a = io.askedAt(g); if (a > 0 && now - a <= MERGE_MS) d = Math.min(d, a + ASK_MS); if (io.doorNet && io.doorNet(g) === 0) d = head.seen.get(g); } return d; };
      const epOf = (g) => { const e = io.epoch ? io.epoch(g) : -1; return Number.isInteger(e) ? e : -1; };
      let ok = true; const ep = new Set();
      for (const g of F) { if (!head.seen.has(g)) head.seen.set(g, now); if (now < due(g)) ok = false; else { const e = epOf(g); if (e >= 0) ep.add(e); } }
      if (!ok) { ok = true; for (const g of F) { const e = epOf(g); if (e >= 0 && ep.has(e)) continue; if (now < due(g)) { ok = false; break; } } }
      return ok;
    }
    function headWants(now) {
      const s = io.seat();
      if (s && s.greeter && !(io.sub && io.sub() !== 0)) {   // TURN.5.2: whom my view holds (any Section-1 seat of door 0 may be the head next)
        for (const x of s.view) head.held.set(x, now);
        if (head.held.size > 64) for (const [x, t] of Array.from(head.held)) if (now - t > HELD_MS) head.held.delete(x);
      }
      if (!s || !s.head || !io.greeters || (io.sub && io.sub() !== 0)) { head.since = -1; head.seen.clear(); return false; }
      const view = new Set(s.view), F = [], mine0 = io.myEpoch ? io.myEpoch() : -1;
      for (const g of io.greeters() || []) {
        if (!g || g === io.me() || view.has(g)) continue;
        const r = io.reach(g);
        if (r === 'direct' || r === 'friend') { head.since = -1; head.seen.clear(); return false; }   // something foreign is reachable: merge first
        { const h = head.held.get(g), e = io.epoch ? io.epoch(g) : -1; if (h !== undefined && now - h <= HELD_MS && !(e >= 0 && mine0 >= 0 && e !== mine0)) continue; }   // TURN.5.2: a seat my own view held inside a listing's longest life (its entry outlives its last word by RELAY_TTL, my knock's list is trusted RELAY_TTL more), under my room's epoch, is my room's (frozen, crashed, between cells): no other room (a stopped page answers no probe)
        F.push(g);
      }
      if (!F.length) { head.since = -1; head.seen.clear(); return false; }
      if (head.since < 0) head.since = now;
      if (!turnWaited(now, F)) return false;
      const mine = io.myEpoch ? io.myEpoch() : -1, me = io.nid ? io.nid(io.me()) : -1;
      const older = (g) => { const e = io.epoch ? io.epoch(g) : -1; if ((e >= 0) !== (mine >= 0)) return e >= 0; if (e >= 0 && mine >= 0 && e !== mine) return e < mine; return (io.nid ? io.nid(g) : -1) < me; };
      return F.some(older);
    }

    // ---- THE DOOR RE-GRANT (the relay restarted and forgot my door r > 0: my seat heard tag 3) -------------------------
    // One ask for a fresh grant for my own door; the page hands it to the seat (meshNode.subGo(r, sg)), which re-mints the
    // door. A re-grant still out (another seat of my room asked): ask again after TURN_DIAL; refused: after TURN_RETRY.
    const rg = { want: false, st: 'idle', retryAt: 0, out: null, gen: 0 };
    function regrantStep(now) {
      if (!rg.want || rg.st !== 'idle' || now < rg.retryAt || !io.askSub) return;
      rg.st = 'busy'; const g = ++rg.gen;
      Promise.resolve(io.tdoors ? io.tdoors() : null).then((x) => {
        const d = x && typeof x === 'object' ? x.v : x;
        if (!d) return null;
        return io.askSub({ room: String(io.sid()), doors: d, regrant: 1 });
      }).then((a) => {
        if (g !== rg.gen) return;
        rg.st = 'idle';
        if (a && Number.isInteger(a.r) && a.r > 0 && typeof a.sg === 'string') { rg.want = false; rg.out = { r: a.r, sg: a.sg }; log('turn-sub door ' + a.r + ' re-granted'); }
        else if (a && a.live) { rg.want = false; log('turn-sub door has greeters again'); }
        else if (a && a.pending === 'opening') rg.retryAt = io.now() + RESEND_MS;
        else rg.retryAt = io.now() + RETRY_MS;
      }, () => { if (g === rg.gen) { rg.st = 'idle'; rg.retryAt = io.now() + RETRY_MS; } });
    }

    // ---- THE WARM STANDBY ---------------------------------------------------------------------------------------------
    function livePipe(r) { for (const L of links.values()) if (!L.sb && L.l === 'l' + r && L.state !== 'closed') return L; return null; }
    function standbys() { let n = 0; for (const L of links.values()) if (L.sb) n++; return n; }
    // A live pipe end keeps its standby: the far end names its side's standby seat (and tells that seat), the opener has
    // a seat of its own side open the standby toward it. Asked again after a whole dial budget with no standby up.
    function warmStandby(L, now) {
      if (L.go != null) return;   // SUB.10.4: while my subroom walks its link stands no new standby
      // my side's standby end is gone (up, or named and not answered yet: a seat picked in the tick it left): warm another now
      if (L.sbSeat && L.sbSeat !== io.me() && !io.alive(L.sbSeat)) { L.sbUp = false; L.sbAt = 0; L.sbSeat = null; }
      // SUB.8 (the sim's sweep, `rewarm`): a standby that ends on my own seat, the pipe's, because no other seat of my side
      // could end it, stands on another seat the moment one can, whether it is up, dialling or not asked yet. It MOVES: the
      // end I hold closes first (restand). Warmed again beside it, the pipe held two standbys for good, one of them on the
      // pipe's own seat (two offices of 3: the opener's first colleague sat while the opener's own standby was dialling).
      if (L.sbSelf && !L.sbWant && io.standbySeat && io.standbySeat()) restand(L, true);
      if (L.sbUp) return;
      if (L.sbAt && now - L.sbAt < DIAL_BUDGET_MS) return;
      if (L.sbWant && L.sbWant !== io.me() && !io.alive(L.sbWant)) L.sbWant = null;
      const r = pipeNo(L.l), sl = 's' + r, S = L.sbWant ? (L.sbWant === io.me() ? null : { pid: L.sbWant, dev: '' }) : (io.standbySeat ? io.standbySeat() : null);   // SUB.8.1: the seat a probe found, else TURN.9's
      log('turn-standby warm ' + L.l + (L.opener ? ' opener far-seat=' + (L.farSb || '-') : ' target') + ' my-seat=' + (S ? short(S.pid) + '/' + S.dev : 'self'));
      L.sbSelf = !S;
      sbLeave(L, S ? S.pid : io.me());   // one standby a pipe: a seat I named before and name no more (it never answered within a dial budget) is told
      if (!L.opener) {
        L.sbAt = now; L.sbSeat = S ? S.pid : io.me();
        // my side's standby seat names its own device (its answer, onSide); with none I keep that end myself
        if (S) io.sendTv(S.pid, { k: 'tv', q: 's', l: sl }); else { sbExpect.set(sl, io.me()); io.sendTv(L.far, { k: 'tv', q: 's', l: L.l, d: io.dev() }); }
        return;
      }
      if (!L.farSb) return;   // the far end has not named its side's standby seat yet
      L.sbAt = now; L.sbSeat = S ? S.pid : io.me();
      if (S) { io.sendTv(S.pid, { k: 'tv', q: 's', l: sl, d: L.farSb, e: L.farR.toString(36) }); return; }
      if (L.farSb === L.farDev) return;   // both subrooms are one seat: no other pair exists
      openStandby(sl, L.farSb, L.farR, io.me());
    }
    function openStandby(sl, farDev, farR, liveEnd) {
      for (const M of links.values()) if (M.sb && M.l === sl && M.state !== 'closed') close(M, 'replaced', true);
      const M = newLink(farDev, sl, true, farDev, farR); M.liveEnd = liveEnd; M.own = io.sub ? io.sub() : 0;
      sendAsk(M); askMine(M);
      return M;
    }
    // A frame from a seat of my own subroom about a standby (no link between us): returns true when it was one.
    function onSide(from, f) {
      if (f.l[0] !== 's' || ['s', 'r', 'x', 't', 'o'].indexOf(f.q) < 0) return false;
      const r = pipeNo(f.l);
      if (f.q === 'o') { if (f.b === undefined) probeAsk(from, f.l, f.m); else probeHeard(from, f.l, f.m, f.b); return true; }   // SUB.8.1
      if (f.q === 'x' && !(livePipe(r) && livePipe(r).sbSeat === from)) {   // my live end stands its standby elsewhere: my standby end closes
        const mine = Array.from(links.values()).filter((M) => M.sb && M.l === f.l && M.liveEnd === from); for (const M of mine) close(M, 'replaced');
        if (mine.length) return true;
      }
      if (f.q === 's' && f.d && f.e === undefined) {   // my standby seat's device: name it to the far side
        const P = livePipe(r);
        if (P && !P.opener && P.sbSeat === from) io.sendTv(P.far, { k: 'tv', q: 's', l: P.l, d: f.d });
        return true;
      }
      if (f.q === 's' && f.d) {   // open the standby toward f.d in subroom f.e
        if (standbys() >= SB_PER_SEAT) { io.sendTv(from, { k: 'tv', q: 'x', l: f.l }); return true; }
        let M = null; for (const x of links.values()) if (x.sb && x.l === f.l && x.farDev === f.d && x.state !== 'closed') M = x;
        if (!M) { openStandby(f.l, f.d, parseInt(f.e, 36), from); log('turn-standby open ' + f.l + ' toward ' + f.d); }
        else bindStandby(f.l, from);
        return true;
      }
      if (f.q === 's') { sbExpect.set(f.l, from); bindStandby(f.l, from); io.sendTv(from, { k: 'tv', q: 's', l: f.l, d: io.dev() }); return true; }   // I end this pipe's standby on my side: my device, for the far side
      // the rest come only from a seat of my subroom in its role (else: a frame of a standby link not yet keyed by its peer id)
      const P = livePipe(r);
      if ((f.q === 'r' || f.q === 'x') && P && P.sbSeat === from) { P.sbUp = f.q === 'r'; P.sbDirect = f.q === 'r' && f.b === 1; if (f.q === 'x') P.sbAt = 0; return true; }
      // my standby seat holds the pipe now. Healed (b 1, SUB.8): my pipe on TURN is its standby from now on; else my part ends
      if (f.q === 't' && P && P.sbSeat === from) { if (f.b !== 1) close(P, 'standby-took-over', true); else if (!P.direct) demote(P, from); return true; }
      if (f.q === 't') { const mine = Array.from(links.values()).filter((M) => M.sb && M.l === f.l && M.liveEnd === from); for (const M of mine) takeover(M, f.b === 1 ? 'healed' : 'my live end lost the pipe'); return mine.length > 0; }
      return false;
    }
    // A live end names me its standby seat while a standby of that pipe I end is already open (the pipe was re-made or changed
    // hands): the standby answers to that live end from now on, and tells it the standby is up on every such naming (an 'r'
    // lost, or the live end's own reset when the far side names its seat, heals at the next naming). Without it a re-made
    // pipe's live ends never heard 'r', handed nothing over when their far end froze, and the standby watched a stale live
    // end (3+3 freeze room: 151 s silence). The credential is not asked again here (that restart loop is why 0ed954cd dropped
    // the first version).
    function bindStandby(sl, liveEnd) {
      for (const M of links.values()) {
        if (!M.sb || M.l !== sl || M.state === 'closed') continue;
        if (M.liveEnd !== liveEnd) { M.liveEnd = liveEnd; log('turn-standby ' + sl + ' now answers to ' + short(liveEnd)); }
        if (M.state === 'up') io.sendTv(liveEnd, { k: 'tv', q: 'r', l: sl, b: M.direct ? 1 : 0 });
      }
    }
    // ---- SUB.8.1 THE PROBE (docs/turn-0926.md; the sim's subProbeTick) ---------------------------------------------------
    // No page knows that two seats of two subrooms reach each other until one dialled the other and the connection came
    // up. While my pipe still holds a path a direct pair could replace, I (its opener end) have one seat of my side at a
    // time dial one Section-1 seat of the far side on a plain connection; a hit is where the standby is stood (SUB.8 then
    // moves the pipe there, make before break). Rate: one dial per direct verdict until every seat of the bigger side had
    // a turn, then one per TURN_RETRY, doubling up to TURN_RETRY_MAX_X once every pair left has failed (TURN.10's wait).
    const probes = new Map();   // far peer id -> { from, sl, at }: a dial I make for a pipe end of my subroom
    function s1List() { try { return (io.s1Seats ? io.s1Seats() : []) || []; } catch (e) { return []; } }
    function probeSay(to, sl, y, b) { if (to === io.me()) probeHeard(to, sl, y, b); else io.sendTv(to, { k: 'tv', q: 'o', l: sl, m: y, b }); }
    function probeAsk(from, sl, y) {
      if (links.has(y)) { probeSay(from, sl, y, 2); return; }                          // one connection a pair: a path of this link is not tried
      if (io.directSeen && io.directSeen(y)) { probeSay(from, sl, y, 1); return; }     // a plain connection of mine reached it before
      if (probes.has(y)) return;
      probes.set(y, { from, sl, at: io.now() }); if (probes.size > 16) probes.delete(probes.keys().next().value);
      log('turn-probe dial ' + short(y) + ' ' + sl);
      try { if (io.probeDoor) io.probeDoor(pipeNo(sl), [y]); } catch (e) {}
    }
    function probeStep(now) { for (const [y, p] of Array.from(probes)) { const hit = !!(io.directSeen && io.directSeen(y)); if (hit || now - p.at > ASK_MS) { probes.delete(y); if (!hit && io.probeEnd) { try { io.probeEnd(y); } catch (e) {} } probeSay(p.from, p.sl, y, hit ? 1 : 0); } } }   // a miss ends the probe's connection (SUB.8.1: a probe asks for a direct path only; nothing of it lingers)
    // My standby is to stand elsewhere: its present seat is told, and the warm-up starts again (warmStandby reads sbWant).
    // keepFar: only my side's end moves (the far side's standby seat stays the one it named).
    function restand(L, keepFar) {
      sbLeave(L, L.sbWant);
      L.sbUp = false; L.sbDirect = false; L.sbAt = 0; L.sbSeat = null; if (L.opener && !keepFar) L.farSb = null;
    }
    // My side's standby end goes to seat `next` (null: not picked yet): the seat that ends it now is told, and an end I hold
    // myself closes (its far end is told by the close), unless it stays where it is.
    function sbLeave(L, next) {
      const sl = 's' + pipeNo(L.l);
      if (L.sbSeat && L.sbSeat !== io.me() && L.sbSeat !== next) io.sendTv(L.sbSeat, { k: 'tv', q: 'x', l: sl });
      if (next !== io.me()) for (const M of Array.from(links.values())) if (M.sb && M.l === sl && M.liveEnd === io.me()) close(M, 'replaced');
    }
    function probeHeard(from, sl, y, b) {
      if (walkHeard(from, sl, y, b)) return;   // SUB.10: a dial my walk round asked for
      const L = livePipe(pipeNo(sl)), P = L && L.pr; if (!L || !L.opener || !P || P.q !== from || P.y !== y) return;
      P.q = null;
      if (b === 2) { P.held.add(from + '|' + y); P.n--; P.nextAt = io.now(); return; }   // a pair that holds a path of this link was no dial: the turn is not spent (the sim's rounds skip such a pair, subHolds)
      if (b !== 1) { P.fails++; return; }
      P.ok.add(from + '|' + y); P.fails = 0; P.x = 1;
      log('turn-probe hit ' + short(from) + ' reaches ' + short(y));
      const disjoint = from !== io.me() && y !== L.far;
      if (L.sbUp && L.sbDirect) return;                 // a direct standby stands already
      if (L.direct && !disjoint) return;                // beside a direct pipe only a pair on other seats is a better standby
      L.sbWant = from; io.sendTv(L.far, { k: 'tv', q: 'o', l: L.l, m: y, b: 1 }); restand(L);
    }
    function probeRound(L, now) {
      if ((L.direct && L.sbUp && L.sbDirect) || L.go != null) { L.pr = null; return; }   // two direct paths: nothing left to find (SUB.10: nor while the subroom walks)
      const A = s1List(), Z = L.farS1 || []; if (!A.length || !Z.length) return;
      const sees = A.join() + '|' + Z.join();
      let P = L.pr; if (!P || P.sees !== sees) P = L.pr = { sees, nextAt: now, x: 1, fails: 0, n: 0, seat: P ? P.seat : 0, turn: new Map(), q: null, y: null, sentAt: 0, ok: P ? P.ok : new Set(), held: new Set() };
      if (P.q) { if (now - P.sentAt < ASK_MS + 2 * RESEND_MS) return; P.q = null; P.fails++; }   // no word back: a miss
      if (now < P.nextAt) return;
      let open = 0, pq = null, py = null, ps = -1;
      for (let k = 0; k < A.length; k++) {
        const si = (P.seat + k) % A.length, q = A[si], t0 = P.turn.get(q) || 0;
        for (let j = 0; j < Z.length; j++) { const y = Z[(si + t0 + j) % Z.length], key = q + '|' + y; if ((q === io.me() && y === L.far) || P.ok.has(key) || P.held.has(key)) continue; open++; if (!pq) { pq = q; py = y; ps = si; P.turn.set(q, t0 + j + 1); } }
      }
      if (!pq) return;
      if (P.fails >= open) { P.x = Math.min(2 * P.x, K.TURN_RETRY_MAX_X); P.fails = 0; }
      P.q = pq; P.y = py; P.sentAt = now; P.seat = (ps + 1) % A.length; P.n++;
      P.nextAt = now + (P.n < Math.max(A.length, Z.length) ? ASK_MS : RETRY_MS * P.x);
      const sl = 's' + pipeNo(L.l);
      log('turn-probe ask ' + short(pq) + ' -> ' + short(py) + ' n=' + P.n + ' x=' + P.x);
      if (pq === io.me()) probeAsk(io.me(), sl, py); else io.sendTv(pq, { k: 'tv', q: 'o', l: sl, m: py });
    }
    // ---- TURN.5.3 A CUT IS NOT A CRASH (docs/turn-0926.md 3; the sim's fabricCutProbe) ------------------------------------------
    // My seat asks: does seat x answer at the door, and is there a path to it? I send x a question by the door (the relay; an
    // open channel of ours is a path already) and dial it on a plain connection (no TURN), one dial's verdict long
    // (FHOP_RELAY_ASK). 1: a path came up (the plain pc, or a friend of mine carries x: env.js); 2: x's page answered and no
    // path came up: x is across a cut; 0: no answer yet, or none (a crashed, frozen or departed page: no cut, the room heals
    // it). A verdict is kept one dial long for the seat's next asks; the next question goes out after that.
    // BY THE DOOR, both ways: a firewall that closes drops packets and tells nobody, so the channel I hold to x still reads
    // open for as long as its connection takes to die (tens of seconds), and a question or an answer written to it is
    // lost: every verdict was 0 ("no answer: no cut") until that connection closed and the next question went by the relay
    // (offices room 2026-11-19: a deep seat asked 5 rounds, 70 s, into dead channels; the 6th was answered in 130 ms).
    const cuts = new Map();   // peer id -> { at, ans, v }
    const cutUnsent = new Set();
    const sendDoor = (to, f) => (io.sendTvDoor ? io.sendTvDoor(to, f) : io.sendTv(to, f));
    function cutHeard(from, f) {
      if (f.b === undefined) { sendDoor(from, { k: 'tv', q: 'c', l: 's0', b: 1 }); return; }   // asked: my page runs, I answer by the same way
      const c = cuts.get(from); if (c && !c.ans) { c.ans = true; log('cut-probe answer ' + short(from)); }
    }
    function cutProbe(pid, now) {
      if (!pid || pid === io.me()) return 0;
      if (io.pcUp && io.pcUp(pid)) return 1;
      // A friend's carry is a path only off TURN at both hops (the sim: grpReach0 to the friend and from it to x). A mate that
      // re-entered and holds the new subroom's TURN pipe to x is no path of the room I still sit in: read as one, a deep seat
      // answered "2" by every greeter stayed in its dead cell round after round, deaf (offices room 2026-11-19: 5 rounds, 60 s).
      if (io.plainFriend && io.plainFriend(pid)) return 1;
      let c = cuts.get(pid);
      if (c && c.v >= 0 && now - c.vAt > ASK_MS) { cuts.delete(pid); c = null; }   // a verdict lives one dial: then ask again
      if (!c) {
        c = { at: now, ans: false, v: -1, vAt: 0 }; cuts.set(pid, c); if (cuts.size > 64) cuts.delete(cuts.keys().next().value);
        // a question that never left (my door socket is not there yet) is no dial: asked again the next time the law reads it
        { const r = sendDoor(pid, { k: 'tv', q: 'c', l: 's0' }); if (r && typeof r.then === 'function') r.then((ok) => { if (ok === false && cuts.get(pid) === c && !c.ans) { cuts.delete(pid); if (!cutUnsent.has(pid)) { cutUnsent.add(pid); log('cut-probe unsent ' + short(pid)); } } else cutUnsent.delete(pid); }, () => {}); }
        try { if (io.probeDoor) io.probeDoor(0, [pid]); } catch (e) {}
        if (!cutUnsent.has(pid)) log('cut-probe ask ' + short(pid));   // (an unsent question is said once: its retry is silent)
        return 0;
      }
      if (c.v >= 0) return c.v;
      if (now - c.at < ASK_MS) return 0;
      c.v = (io.pcUp && io.pcUp(pid)) ? 1 : (c.ans ? 2 : 0); c.vAt = now;
      if (c.v !== 1 && io.probeEnd) { try { io.probeEnd(pid); } catch (e) {} }   // a miss ends the probe's connection (SUB.8.1)
      log('cut-probe verdict ' + short(pid) + ' ' + c.v); return c.v;
    }
    // ---- SUB.10 THE MERGE (docs/turn-0926.md 3a; the sim's subProbeTick step 3, fabricSubGo, fabricSubWalk) -----------------
    // With two direct paths (the pipe and its standby both off TURN) the seats keep looking. My subroom (the younger door, the
    // pipe's own number) is not needed once every one of its Section-1 seats is known to reach a Section-1 seat of the far door
    // directly: an end of the pipe or of its standby, or a dial my round asked for (SUB.8.1's dial, one at a time). Only a
    // subroom no other pipe ends in walks (a leaf: my room fold lists no door my pipe does not bring). Then my end says GO
    // (go(): the far door) in my section (Dig.go), the seats walk through the far door as ordinary joiners, the path ends
    // last. Two direct paths START the word; once said it stands on the pipe alone (SUB.10.3, the sim's SUBGO: said while
    // the pipe is up on its direct path), because the walk itself takes the standby away: its seat of my door walks before
    // my end does (path ends last) and ends its standby with its walk. A link whose subroom walks stands no new standby
    // and looks for nothing. A page that walked does not say GO again inside the longest wait (SUB.10.2, TURN.10).
    const WALK_AGAIN_MS = K.TURN_RETRY * K.TURN_RETRY_MAX_X * tick, WALKED_MS = K.RELAY_TTL * tick;
    let walkedAt = -Infinity;
    function walkOff(L, why) { if (L.go != null) log('sub-walk off ' + L.l + ' ' + why); L.go = null; L.wk = null; }
    function walkWait(L, why) { if (L.wkWhy !== why) { L.wkWhy = why; log('sub-walk wait ' + L.l + ' ' + why); } }   // the reason my end does not say GO yet, once a change
    function walkRound(L, now) {
      if (!io.sub || io.sub() !== pipeNo(L.l) || pipeNo(L.l) <= 0) { if (L.go != null || L.wk) walkOff(L, 'not my door'); return; }   // the walking side is the younger door, the pipe's own number
      if (L.go != null) { if (!L.direct) walkOff(L, 'pipe off its direct path'); return; }   // said: the word stands while the pipe is up on its direct path (the standby's seat walks before my end does)
      if (!(L.direct && L.sbUp && L.sbDirect)) { if (L.wk) walkOff(L, 'not two direct paths'); walkWait(L, 'paths pipe=' + (L.direct ? 'direct' : 'turn') + ' standby=' + (L.sbUp ? (L.sbDirect ? 'direct' : 'turn') : 'down')); return; }
      { const lf = io.subLeaf ? io.subLeaf(L.far) : 'no fold'; if (lf !== true) { if (L.wk) walkOff(L, 'no leaf'); walkWait(L, 'no leaf ' + lf); return; } }
      if (now - walkedAt < WALK_AGAIN_MS) { walkWait(L, 'walked lately'); return; }   // SUB.10.2: a walk that failed does not start again inside the longest wait
      const Z = L.farS1 || []; if (!Z.length) { walkWait(L, 'no far seats named'); return; }
      const W = L.wk || (L.wk = { ok: new Set(), q: null, y: null, sentAt: 0, nextAt: now, n: 0, x: 1, fails: 0, seat: 0 });
      const A = s1List().filter((x) => x !== io.me() && x !== L.sbSeat && !W.ok.has(x));
      walkWait(L, 'seats left ' + A.length);
      if (!A.length) { L.go = Number(L.farR); L.wk = null; log('sub-walk go ' + L.l + ' to=' + L.go + ' far=' + short(L.far)); io.changed(L.far); return; }
      if (W.q) { if (now - W.sentAt < ASK_MS + 2 * RESEND_MS) return; W.q = null; W.fails++; }   // no word back: a miss
      if (now < W.nextAt) return;
      if (W.fails >= A.length) { W.x = Math.min(2 * W.x, K.TURN_RETRY_MAX_X); W.fails = 0; }   // every seat left has failed since: the wait doubles (TURN.10)
      const q = A[W.seat % A.length], y = Z[(W.seat + W.n) % Z.length];
      W.q = q; W.y = y; W.sentAt = now; W.seat = (W.seat + 1) % A.length; W.n++;
      W.nextAt = now + (W.n < Math.max(A.length, Z.length) ? ASK_MS : RETRY_MS * W.x);
      log('sub-walk ask ' + short(q) + ' -> ' + short(y));
      io.sendTv(q, { k: 'tv', q: 'o', l: 's' + pipeNo(L.l), m: y });
    }
    function walkHeard(from, sl, y, b) {
      const L = livePipe(pipeNo(sl)), W = L && L.wk; if (!W || W.q !== from || W.y !== y) return false;
      W.q = null; if (b === 1 || b === 2) { W.ok.add(from); W.fails = 0; log('sub-walk hit ' + short(from) + ' reaches ' + short(y)); } else W.fails++;   // 2: it holds a path of this link to it already
      return true;
    }
    // The door my subroom walks to, as my end of its pipe says it (-1: none).
    function walkGo() { for (const L of links.values()) if (!L.sb && L.state === 'up' && L.direct && L.go != null && io.sub && io.sub() === pipeNo(L.l)) return L.go; return -1; }
    // May my seat walk now (its room fold counts n seats and says door p)? An end of the pipe stays until it is alone, an end of
    // its standby while a seat that ends no path is still counted (1 more); every other seat goes at once.
    function walkMay(n, p) {
      let pipeEnd = false, sbEnd = false;
      for (const L of links.values()) { if (L.state === 'closed' || !io.sub || io.sub() !== pipeNo(L.l)) continue; if (L.sb) sbEnd = true; else { pipeEnd = true; if (L.go !== p) return false; } }
      if (pipeEnd && n > 1) return false; if (sbEnd && !pipeEnd && n > 2) return false;
      walkedAt = io.now(); log('sub-walk walk to=' + p + ' n=' + n);
      // a seat that leaves the door ends no path of it: my standby end closes with my walk, and so does the pipe when its
      // end walks, last ("the pipe closes with its end's goodbye", SUB.10.4; the sim drops a path whose end is no Section-1
      // seat of its door, subLost). Kept, a standby took the pipe over from the door I walked to once my pc to the pipe's
      // end closed ("my live end left") and the far side closed the pipe under the end still waiting to walk; and a pipe
      // kept by its end lived on inside the merged room, warming standbys there and failing with the next firewall.
      for (const L of Array.from(links.values())) if (L.state !== 'closed' && io.sub() === pipeNo(L.l)) close(L, 'walked');
      return true;
    }
    // A live end whose pipe is lost, or (SUB.8, 'healed') whose standby is on a better path: its standby seat takes the
    // pipe over. A lost pipe's part ends here; a pipe on TURN that gave way to a direct standby stays, as the standby.
    function handOver(L, why) {
      const sl = 's' + pipeNo(L.l), healed = why === 'healed', seat = L.sbSeat && L.sbSeat !== io.me() ? L.sbSeat : null;
      if (healed) {   // make before break: my pipe stays the pipe until the direct standby has taken it (its seat's word back demotes me, onSide)
        if (io.now() - (L.healAt || 0) < RESEND_MS) return;
        L.healAt = io.now();
        log('turn-standby hand-over ' + L.l + ' (' + why + ')');
        if (seat) { io.sendTv(seat, { k: 'tv', q: 't', l: sl, b: 1 }); return; }
        const M = Array.from(links.values()).find((x) => x.sb && x.l === sl && x !== L && x.direct && x.state === 'up');
        if (M) takeover(M, 'healed');   // I hold both: the two change places here (takeover demotes my pipe)
        return;
      }
      log('turn-standby hand-over ' + L.l + ' (' + why + ')');
      if (seat) io.sendTv(seat, { k: 'tv', q: 't', l: sl });
      if (L.direct && io.directForget) io.directForget(L.far);   // a direct path that died is no direct pair until a plain pc proves it again
      close(L, 'standby-took-over', true);
      if (!seat) for (const M of Array.from(links.values())) if (M.sb && M.l === sl) takeover(M, 'my own pipe died');
    }
    // SUB.8: the pipe gave way to a better path. The path it left is that pipe's standby now: the same connection, s<r>,
    // idle (keep-alives only), answering to the seat of my side that holds the pipe; a credential and vouches under the
    // standby's name (the mirror of takeover). Nothing closes: the meeting holds two paths the whole time.
    function demote(P, liveEnd) {
      if (P.sb || P.state === 'closed') return;
      const r = pipeNo(P.l), sl = 's' + r;
      if (P.farPid) { try { io.publish({ id: P.id, a: P.opener ? io.me() : P.far, b: P.opener ? P.far : io.me(), up: 0, v: 0, gone: 1 }); } catch (e) {} }
      P.sb = true; P.l = sl; P.liveEnd = liveEnd; P.mine = null; P.peer = null; P.vAskAt = 0; P.tookOver = !!P.client;
      P.sbUp = false; P.sbDirect = false; P.sbAt = 0; P.sbSeat = null; P.farSb = null; P.video = false; P.vouched = false; P.lostAt = -1; P.thr = null;
      if (P.paid) { try { P.paid.stop(); } catch (e) {} P.paid = null; } P.paidMe = false; P.paidFar = false; P.paidSaid = false;
      sbExpect.set(sl, liveEnd);
      if (P.cred) { try { P.cred.stop(); } catch (e) {} P.cred = null; }
      if (P.client) { P.cred = credFor(P, 'free'); P.cred.start(); }
      log('turn-standby kept ' + sl + ' with ' + short(P.far) + ': the pipe moved to a direct path');
      askMine(P);
      if (liveEnd !== io.me() && P.state === 'up') io.sendTv(liveEnd, { k: 'tv', q: 'r', l: sl, b: 0 });
      subChanged('a pipe of mine');
      if (io.demoted) { try { io.demoted(P.far); } catch (e) { log('turn-standby kept ' + sl + ': media hand-back failed ' + String(e).slice(0, 80)); } }
      io.changed(P.far);
    }
    // The standby becomes the pipe: the same connection, now l<r>; fresh vouches and a credential for l<r> (the service
    // moves the pipe's ends to this pair), the far standby end told over the standby itself.
    function takeover(M, why) {
      if (!M.sb || M.state === 'closed') return;
      const sl = M.l, r = pipeNo(sl);
      const healed = why === 'healed', t = healed ? { k: 'tv', q: 't', l: sl, b: 1 } : { k: 'tv', q: 't', l: sl };
      if (healed && !M.direct) return;   // SUB.8: healed names a direct path; a standby on TURN is no better path than the pipe's
      const old = livePipe(r), was = M.liveEnd && M.liveEnd !== io.me() ? M.liveEnd : null;
      if (old && old !== M) { if (healed && !old.direct) demote(old, io.me()); else close(old, 'standby-took-over', true); }
      try { io.sendTv(M.far, t); } catch (e) {}
      if (was) { try { io.sendTv(was, t); } catch (e) {} }   // my side's old live end: its part of the pipe ends (healed: its pipe is my standby now)
      M.sb = false; M.l = 'l' + r; M.liveEnd = null; M.mine = null; M.peer = null; M.vAskAt = 0; M.tookOver = !!M.client; M.sbUp = false; M.sbDirect = false; M.sbAt = 0;
      sbExpect.delete(sl);
      if (healed) {   // SUB.8: the path the pipe left is my standby: at my old live end (its 'r' says it is up), or here when I held both
        const kept = Array.from(links.values()).find((x) => x !== M && x.sb && x.l === sl && x.liveEnd === io.me() && x.state !== 'closed');
        M.sbSeat = kept ? io.me() : was; M.sbUp = !!kept && kept.state === 'up'; M.sbAt = io.now();
      }
      if (M.cred) { try { M.cred.stop(); } catch (e) {} M.cred = null; }
      if (M.client && !M.direct) { M.cred = credFor(M, 'free'); M.cred.start(); }
      log('turn-standby took over ' + M.l + ' with ' + short(M.far) + ': ' + why + (M.direct ? ' (direct)' : ''));
      askMine(M);
      io.changed(M.far);
    }

    // ---- THE SUBROOM ASK (header) ------------------------------------------------------------------------------------
    // idle → doors (the relay's signed list) → ask → 202 list: probe each listed door (subroom 0 first, then the list's
    // order; a re-pipe probes none) → none reached: a fresh door list → ask with the list's token → 200: the pipe.
    // An answer that arrives after the machine moved on (a newer generation) is dropped.
    const busyOut = { wait: 1 };
    // SUB.2: A REFUSAL IS THE ANSWER. The founding attempt that follows a refusal founds at door 0 as 0.9.25 (mayAsk is
    // closed once, whatever the wait); the next ask comes from the founded seat when the wait is over.
    // TURN.10: A REFUSED ASK BACKS OFF: the wait doubles from TURN_RETRY up to RETRY_MAX_X times it, and starts over only
    // when something the refusal named changes: the kind of refusal, the subrooms my answers list (their numbers), or a
    // pipe or standby of mine opening or closing. Never the greeters at my own door (who else is knocking), and nothing
    // read from the service for it (a read is a call).
    const RETRY_MAX_X = K.TURN_RETRY_MAX_X;
    function subRefuse(now, why) {
      if (why !== sub.lastWhy) sub.mult = 1;
      sub.lastWhy = why;
      const at = now + RETRY_MS * sub.mult;
      sub.mult = Math.min(RETRY_MAX_X, sub.mult * 2);
      sub.ans = true;
      subIdle(now, { refused: why, retryAt: at }, at);
    }
    // TWO WAITS (the sim's SUBASK[q].w and SUBRP/TURNSB). retryAt is the ASK's own: the Worker refused it, or the pipe it
    // granted never came up. pipeRetryAt is a seated end's: a path it opened was lost or its standby's dial failed, and it
    // asks for a re-pipe after TURN_RETRY. A JOINER reads only the first: a page that left its cell (TURN.5.3: the firewall
    // that cut it also failed its old links) asks at the door as any joiner, not 30 s after a link of the seat it left died
    // (room new-r9, 2026-11-19: 42 s at the door beside the subroom its mates had founded).
    function subChanged(what) { if (sub.mult > 1) { sub.mult = 1; if (sub.st === 'idle' && sub.retryAt > io.now()) sub.retryAt = io.now(); log('turn-sub ' + what + ' changed: ask again now'); } }
    function subIdle(now, out, retryAt) { sub.st = 'idle'; sub.token = null; sub.retryAt = retryAt || 0; sub.out = out; sub.gen++; }
    function subDoors(withToken) {
      const g = ++sub.gen; sub.st = 'doors'; sub.out = busyOut;
      // a re-pipe ask with the list in hand has the relay say which ends on record still hold a socket (SUB.3: a pipe with a dead end is cut)
      const q = withToken && sub.asker === 'repipe' ? (sub.ends || []).slice(0, 16) : null;
      Promise.resolve(io.tdoors ? io.tdoors(q) : null).then((x) => {
        if (g !== sub.gen) return;
        const d = x && typeof x === 'object' ? x.v : x;
        if (d) { sub.devPid = (x && typeof x === 'object' && x.p) || {}; sub.heads = doorHeads(d, sub.devPid, x && typeof x === 'object' ? x.h : null); const sg = doorsSig(d); if (sub.doorsSig && sg !== sub.doorsSig) subChanged('the subrooms'); sub.doorsSig = sg; }
        // JOIN.2 THE PROBE AT THE FIRST STALL: the relay's door list is all it reads. The heads of every other door it names
        // are dialled side by side; a miss asks for nothing (no Worker call, never a new number: TURN stays last).
        if (sub.asker === 'probe') {
          sub.wantProbe = false;
          const mine = io.sub ? io.sub() : 0, rs = d ? Array.from(sub.heads.keys()).filter((r) => r > 0 && r !== mine && (sub.heads.get(r) || []).length) : [];
          const sig = rs.map((r) => r + ':' + sub.heads.get(r).join('+')).join(',');
          if (!rs.length || sig === sub.probedSig) { subIdle(io.now(), null, sub.retryAt); return; }   // no other door, or the same heads as my last probe
          sub.probedSig = sig; sub.list = rs; sub.probe = rs; sub.tried = new Set(); sub.token = null;
          log('turn-sub probe ' + rs.join(',') + ': trying the doors');
          sub.gen++; sub.st = 'probe'; sub.out = busyOut; return;
        }
        if (!d) { subRefuse(io.now(), 'no-doors'); return; }
        // before a new number is asked for: a listed room whose heads this fresh door list names and I have not dialled
        // yet (it opened while I tried the others) is tried first; the service would read its greeters as unreachable
        if (withToken && untried().length) { log('turn-sub a listed room opened: trying its heads'); sub.st = 'probe'; return; }
        subAsk(d, withToken ? sub.token : null);
      }, () => { if (g !== sub.gen) return; if (sub.asker === 'probe') { sub.wantProbe = false; subIdle(io.now(), null, sub.retryAt); } else subRefuse(io.now(), 'no-doors'); });
    }
    function subProbeDoors() {
      const g = ++sub.gen; sub.st = 'doors'; sub.out = busyOut;
      Promise.resolve(io.tdoors ? io.tdoors() : null).then((x) => {
        if (g !== sub.gen) return;
        const d = x && typeof x === 'object' ? x.v : x;
        if (d) { sub.devPid = (x && typeof x === 'object' && x.p) || {}; sub.heads = doorHeads(d, sub.devPid, x && typeof x === 'object' ? x.h : null); }
        sub.gen++; sub.st = 'probe';
      }, () => { if (g === sub.gen) { sub.gen++; sub.st = 'probe'; } });
    }
    function subAsk(doors, token) {
      const g = ++sub.gen; sub.st = 'ask';
      const b = { room: String(io.sid()), doors };
      if (token) b.token = token;
      if (sub.asker === 'repipe') b.rp = 1;   // SUB.3: a re-pipe ask, from either side of the lost pipe
      const t = budgetTicket(io.subs()); if (t) b.ticket = t;   // a plan's meeting ticket raises the meeting's budget to its allowance
      Promise.resolve(io.askSub ? io.askSub(b) : null).then((a) => {
        if (g !== sub.gen) return;
        const now = io.now();
        if (a && Number.isInteger(a.r) && a.r > 0 && typeof a.sg === 'string' && a.far && typeof a.far.d === 'string' && Number.isInteger(a.far.r) && LINK_RE.test(a.link || '')) {
          subFound(a); return;
        }
        if (a && a.pending === 'opening') { log('turn-sub opening: knock its door again'); subIdle(now, busyOut, now + RESEND_MS); return; }
        if (a && (a.root === 1 || a.closed === 1) && sub.asker === 'repipe') {   // SUB.3: nothing to pipe (my room is the tree's root now, or the other side's ask made the pipe): the ask is closed
          sub.repipe = false; log('turn-sub re-pipe closed: ' + (a.root ? 'root' : 'nothing cut off')); subIdle(now, null, 0); return;
        }
        if (a && a.pending === 'subrooms' && typeof a.token === 'string') {
          sub.token = a.token; sub.list = Array.isArray(a.subs) ? a.subs.filter((x) => x && Number.isInteger(x.r) && x.r > 0).map((x) => x.r) : [];
          sub.ends = []; for (const x of a.subs || []) for (const d of (x && Array.isArray(x.e) ? x.e : [])) if (typeof d === 'string' && DEV_RE.test(d) && sub.ends.indexOf(d) < 0) sub.ends.push(d);   // the pipes' ends on record
          // the service names each listed room's heads to dial (device tags of the door list I sent); the relay's answer
          // to that same door list gave their peer ids
          for (const x of a.subs || []) { const pids = (Array.isArray(x && x.heads) ? x.heads : []).map((d) => (sub.devPid || {})[d]).filter((p) => typeof p === 'string' && p).slice(0, PROBE_HEADS); if (pids.length && sub.heads) sub.heads.set(x.r, pids); }
          if (sub.asker === 'repipe') { subDoors(true); return; }   // my own subroom keeps its number: no doors to try
          sub.probe = sub.list.filter((r) => r !== (io.sub ? io.sub() : 0));   // every listed room side by side (door 0 is the one my seat already failed at)
          sub.tried = new Set();
          log('turn-sub list ' + sub.list.join(',') + ': trying the doors');
          // a listed room my door list did not show yet (it opened meanwhile): read the doors once more to know its heads
          if (sub.probe.some((r) => !((sub.heads && sub.heads.get(r)) || []).length)) { subProbeDoors(); return; }
          sub.st = 'probe'; sub.out = busyOut;
          return;
        }
        const why = (a && a.unavailable) ? String(a.unavailable).slice(0, 40) : 'no-answer';
        log('turn-sub refused ' + why);
        subRefuse(now, why);
      }, () => { if (g === sub.gen) subRefuse(io.now(), 'no-answer'); });
    }
    // The heads the relay's door list names per door, as peer ids (the answer's own map; the signed list holds device
    // tags only): at most PROBE_HEADS per door, in the list's order.
    const PROBE_HEADS = 2;
    const PROBE_GAP_MS = K.FHOP_RELAY_ASK * tick;   // JOIN.2: one door-list read per direct verdict at most
    // the subrooms a door list names (their numbers only: who greets at a door is not what a refusal named)
    function doorsSig(td) { try { const t = String(td).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); const o = JSON.parse(atob(t + '='.repeat((4 - (t.length % 4)) % 4))); return (o.doors || []).map((x) => x.r).sort((a, b) => a - b).join(','); } catch (e) { return ''; } }
    function doorHeads(td, peers, dial) {
      const out = new Map();
      try {
        const t = String(td).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const o = JSON.parse(atob(t + '='.repeat((4 - (t.length % 4)) % 4)));
        for (const x of o.doors || []) out.set(x.r, (x.g || []).map((h) => peers[h && h.d]).filter((p) => typeof p === 'string' && p).slice(0, PROBE_HEADS));
        // SUB.2.2: every listed door names a seat to dial. The signed list names capable row heads only (the seats a pipe may
        // end at); the relay's answer adds, per door, greeters to dial whatever their device (h). A room whose head is a
        // phone had no head to try, and a joiner that could reach it was told "no listed door reached".
        if (dial && typeof dial === 'object') for (const x of o.doors || []) {
          const have = out.get(x.r) || [], more = Array.isArray(dial[x.r]) ? dial[x.r] : [];
          for (const p of more) if (have.length < PROBE_HEADS && typeof p === 'string' && p && p.length <= 64 && have.indexOf(p) < 0) have.push(p);
          out.set(x.r, have);
        }
      } catch (e) {}
      return out;
    }
    // the heads of the listed rooms the latest door list names that this round has not dialled
    function untried() { const out = []; for (const r of sub.probe || []) for (const p of (sub.heads && sub.heads.get(r)) || []) if (!(sub.tried && sub.tried.has(p))) out.push(p); return out; }
    function subFound(a) {
      const relink = sub.asker === 'repipe';   // (for the log: the far end judges a re-pipe itself)
      if (relink) sub.repipe = false;
      // own: the subroom my end sits in. A subroom cut off from mine (SUB.3: its own ends are gone, it may hold no seat that
      // asks) is re-piped from my side: I open l<r> toward its far end and my door stays mine (nothing to found)
      const own = Number.isInteger(a.own) ? a.own : a.r, cut = relink && own !== a.r;
      sub.st = 'found'; sub.gen++;
      sub.found = { r: a.r, sg: a.sg, far: { r: a.far.r, d: a.far.d }, link: a.link };
      sub.out = cut ? busyOut : { found: a.r, sg: a.sg, far: sub.found.far, link: a.link };
      log('turn-sub ' + (relink ? 're-pipe ' : 'new ') + a.r + (cut ? ' (cut off, from my subroom ' + own + ')' : '') + ' far ' + a.far.d + '@' + a.far.r + ' ' + a.link);
      for (const L of Array.from(links.values())) if (L.opener && L.l === a.link) close(L, 'replaced', true);   // a re-pipe's old pipe of this subroom
      const L = newLink(a.far.d, a.link, true, a.far.d, a.far.r); L.own = own;
      sendAsk(L); askMine(L);
    }
    function subStep(now) {
      head.want = headWants(now);
      const asker = (io.asker ? io.asker() : null) || (sub.repipe ? 'repipe' : null) || (head.want ? 'head' : null) || ((sub.wantProbe || (sub.asker === 'probe' && sub.st !== 'idle')) && io.sub && io.sub() === 0 ? 'probe' : null);   // JOIN.2: the probe is the last reason (any ask of the Worker's goes first)   // SUB.3: a re-pipe is asked from either side, door 0 too
      if (sub.st === 'found') {
        const live = Array.from(links.values()).some((L) => L.opener && sub.found && L.l === sub.found.link);
        if (live) return;
        sub.found = null;
        if (sub.why === 'full') { sub.why = ''; subRefuse(now, 'full'); return; }
        subIdle(now, null, sub.retryAt);
      }
      if (!asker) { if (sub.st !== 'idle') subIdle(now, null, sub.retryAt); else if (sub.out && sub.out.join != null) sub.out = null; return; }
      sub.asker = asker;
      if (sub.st === 'idle') { if (asker === 'probe') { if (now - sub.probeAt >= PROBE_GAP_MS) { sub.probeAt = now; subDoors(false); } else sub.wantProbe = false; return; } if (now >= Math.max(sub.retryAt, asker === 'joiner' ? 0 : sub.pipeRetryAt)) subDoors(false); return; }   // a probe reads the door list at most once a direct verdict; it is not an ask of the Worker's, so no refusal wait holds it
      if (sub.st === 'probe') {
        let pending = false;
        for (const r of sub.probe) {
          const pids = (sub.heads && sub.heads.get(r)) || [];
          for (const p of pids) sub.tried.add(p);
          const v = pids.length && io.probeDoor ? io.probeDoor(r, pids) : false;
          if (v === true) { log('turn-sub join ' + r); subIdle(now, { join: r }, now + RESEND_MS); return; }   // the page moves its door there; no new ask meanwhile
          if (v !== false) pending = true;
        }
        if (!pending) {
          // a miss ends the dials the probe made (io.probeEnd: never a connected pair, a seat link or a TURN link's pc);
          // left open, each was re-offered off the relay through the pipe for a minute, again every door round
          for (const r of sub.probe) for (const p of (sub.heads && sub.heads.get(r)) || []) { try { if (io.probeEnd) io.probeEnd(p); } catch (e) {} }
          if (asker === 'probe') { log('turn-sub probe: no listed door reached'); subIdle(now, null, sub.retryAt); return; }   // JOIN.2: a miss asks for nothing
          log('turn-sub no listed door reached'); subDoors(true);
        }
      }
    }

    // SUB.3 (c): a pipe I opened that never came up (its dial failed, or its far end went before it did) is a refusal:
    // I ask for a re-pipe after the refused wait (TURN.10). A founder sits at its own door by then, so no other asker
    // of mine would ever ask again.
    function neverUp(L, why, quiet) {
      if (L.opener && !L.sb && L.l[0] === 'l' && !(L.upAt > 0)) {
        if (why !== sub.lastWhy) sub.mult = 1;
        sub.lastWhy = why; sub.retryAt = Math.max(sub.retryAt, io.now() + RETRY_MS * sub.mult); sub.mult = Math.min(RETRY_MAX_X, sub.mult * 2);
        sub.repipe = true;
      } else if (L.opener && why === 'dialfail') sub.pipeRetryAt = io.now() + RETRY_MS;   // (a seated end's wait, see pipeRetryAt)
      close(L, why, quiet);
    }
    function step() {
      const now = io.now();
      for (const L of Array.from(links.values())) {
        // TURN.8: the far page is gone. A far end my seat does not know yet (a foreign greeter, its door entry stale here)
        // is alive while it keeps answering this link's handshake.
        // Once both ends are ready the handshake is over and the far end sends nothing more until the pc is up: that
        // silence is no goodbye, and the dial budget alone judges the dial (TURN.8 dialfail).
        const farGone = !!L.farPid && !io.alive(L.far) && (L.state === 'up' || !(L.readyMe && L.readyFar)) && now - (L.heardAt || L.askAt) > DIAL_BUDGET_MS / 2;
        // SUB.7, ONE PROMOTION PATH: a live pipe whose far end left (its goodbye, the mesh's word) or whose connection died
        // (the pc's own verdict) while its warm standby is up: the standby IS the pipe now, whichever end sees it first
        if (L.state === 'up' && !L.sb && L.sbUp && (farGone || !io.pcUp(L.far))) { handOver(L, farGone ? 'its far end left' : 'the connection died'); continue; }
        // SUB.8, the same path: ...or whose standby is on a better path (direct, beside my pipe on TURN): the two change places
        // (my pipe carries on until the standby has taken it)
        if (L.state === 'up' && !L.sb && L.sbUp && L.sbDirect && !L.direct) { handOver(L, 'healed'); if (L.sb) continue; }
        if (farGone) { if (L.state === 'up') close(L, 'gone', true); else neverUp(L, 'gone', true); continue; }
        // SUB.5: a direct standby that finds no path within a dial's direct verdict was no direct pair after all: forgotten,
        // and warmed again on TURN (one that is up is the pipe when its live end, on TURN, hands over: SUB.8 above)
        if (L.direct && L.opener && !L.dEcho && now - (L.dSentAt || 0) > RESEND_MS) { L.dSentAt = now; io.sendTv(L.far, { k: 'tv', q: 'd', l: L.l }); }   // a lost 'd' is said again
        if (L.direct && L.state !== 'up' && now - L.directAt > ASK_MS) { if (io.directForget) io.directForget(L.far); close(L, 'dialfail'); continue; }
        if (L.state !== 'up' && now - L.askAt > DIAL_BUDGET_MS) { neverUp(L, 'dialfail'); continue; }
        if (L.sb && L.liveEnd && L.liveEnd !== io.me() && !io.alive(L.liveEnd)) { takeover(L, 'my live end left'); }
        if (L.state === 'up' && !io.pcUp(L.far)) { if (!L.downSince) L.downSince = now; if (now - L.downSince > DIAL_BUDGET_MS) { if (L.opener) sub.pipeRetryAt = now + RETRY_MS; close(L, 'lost'); continue; } }
        else L.downSince = 0;
        if ((L.state === 'ask' || (L.state === 'swap' && !L.peer)) && now - L.sentAt > RESEND_MS && (L.opener || L.farDev)) sendAsk(L);
        // a link that holds no vouch of mine yet (its setup, a takeover) asks again until it does; after that only a
        // credential ask asks (the vouch on demand)
        if (L.farDev && !L.mine && !L.direct && now - L.vAskAt > RESEND_MS) askMine(L);
        // TURN.18: a client end's connection has looked for its relay path for TURN_WEB_WAIT and found none
        if (L.state !== 'up' && !L.web && L.client && L.cred && io.turnPath) { const tp = io.turnPath(L.far); if (tp && tp.at > 0 && !tp.relay && now - tp.at >= WEB_WAIT_MS && L.cred.web().length) webStart(L, true); }
        if (L.web && L.state !== 'up') { if (now - L.webSaidAt > RESEND_MS) webSay(L); webGo(L); }
        if (L.state !== 'up' && L.readyMe && (L.readyFar || L.web) && io.pcUp(L.far) && (!L.web || io.webUp(L.far))) {
          L.state = 'up'; L.upAt = now; L.serial = now; log('turn-link up ' + short(L.far) + (L.sb ? ' (standby)' : '')); io.changed(L.far); subChanged('a pipe of mine');
          if (L.sb && L.liveEnd && L.liveEnd !== io.me()) io.sendTv(L.liveEnd, { k: 'tv', q: 'r', l: L.l, b: L.direct ? 1 : 0 });
          if (L.sb && L.liveEnd === io.me()) { const P = livePipe(pipeNo(L.l)); if (P) { P.sbUp = true; P.sbDirect = !!L.direct; } }
        }
        if (L.mine && !L.peer && !L.direct && L.farDev && now - (L.vSentAt || 0) > RESEND_MS) { L.vSentAt = now; io.sendTv(L.far, { k: 'tv', q: 'v', l: L.l, e: L.mine.e.toString(36), n: L.mine.n, m: L.mine.m }); }   // the far end may have missed it (a takeover renames the link)
        if (L.state === 'up' && !L.sb) {   // SUB.8.1: each pipe end names its side's Section-1 seats once a change; the opener end runs the rounds
          const mine = s1List().slice(0, 25).join(','); if (mine && mine !== L.s1Sent && PROBE_RE.test(mine)) { L.s1Sent = mine; io.sendTv(L.far, { k: 'tv', q: 'o', l: L.l, m: mine }); }
          if (L.opener) probeRound(L, now);
          walkRound(L, now);   // SUB.10 (inert unless my end is the younger door's and both paths are direct)
        }
        if (L.state === 'up' && !L.sb) warmStandby(L, now);   // SUB.8: a direct pipe keeps its standby too (the bridging seat may leave)
        if (L.state === 'up' || L.state === 'dial') io.keep(L.far);
        pump(L);
        if (L.state === 'up') {   // my side grows with the people I reach directly
          const s = io.seat();
          if (s) for (const x of s.view) if (x !== L.far && L.side.indexOf(x) < 0 && L.side.length < SIDE_MAX && io.reach(x) === 'direct') L.side.push(x);
        }
      }
      probeStep(now);
      planVideo(now);
      subStep(now);
      regrantStep(now);
      if (now - lastFactAt >= FACT_EVERY_MS) {
        lastFactAt = now;
        for (const L of links.values()) if (L.state === 'up' && !L.sb) io.publish(factOf(L));
      }
    }

    return {
      step, onFrame, onVouch, onCapacity, onPath, onServer,
      // The connection settings of this pair: null for a pair that is no TURN link, or whose end here is no client.
      config(pid) {
        const L = links.get(pid);
        if (!L || (!L.client && !L.web)) return null;
        return configOf(L);
      },
      web(pid) { const L = links.get(pid); return !!L && L.web; },   // TURN.18: this link runs over the web path
      webMine(pid) { const L = links.get(pid); return !!L && L.web && !!L.webMine; },   // ...because MY end found no relay path (the reason a seat shows is its own network's only then)
      factStaleMs: FACT_STALE_MS,
      holds(pid) { const L = links.get(pid); return !!L && L.state !== 'closed'; },
      isLink(pid) { const L = links.get(pid); return !!L && (L.state === 'up' || L.state === 'dial'); },
      linking() { return (sub.st !== 'idle' && sub.st !== 'found') || Array.from(links.values()).some((L) => L.opener && !L.sb && L.state !== 'up'); },   // a subroom ask or my pipe is on its way
      // THE SUBROOM ASK's outcome for the page this tick (header): { join }, { found }, { wait }, { refused, retryAt }, or null
      subAsk() { return sub.out; },
      // the seat's hooks (opts.sub): my room lost a far door (the home-cell seat asks once to re-pipe it); my door's relay
      // forgot it (tag 3: a fresh grant). regrant(): a fresh grant to hand to the seat, once.
      repipe() { sub.repipe = true; },   // SUB.3 (b): my room's fold lost a far door (the home seat of any door, door 0 too)
      doorEmpty() { if (io.sub && io.sub() > 0) rg.want = true; },
      // JOIN.2: the seat's first ask at door 0 stalled: dial the heads of the other doors the relay lists. true: a probe starts or is out
      probe() { if (!(io.sub && io.sub() === 0) || !io.tdoors || !io.probeDoor) return false; if (sub.st === 'probe' && sub.asker === 'probe') return true; if (sub.st !== 'idle' || (sub.out && sub.out.refused) || io.now() - sub.probeAt < PROBE_GAP_MS) return false; sub.wantProbe = true; return true; },
      regrant() { const o = rg.out; rg.out = null; return o; },
      // SUB.10: the door my subroom walks to as my pipe end says it (-1 none); may my seat walk now; did it walk lately (a path beats the tag)
      go() { return walkGo(); },
      walk(n, p) { return walkMay(n, p); },
      walked() { return io.now() - walkedAt <= WALKED_MS; },
      // TURN.5.3: the probe of a cut (0 no answer yet or none, 1 a path, 2 answered and no path)
      cut(pid) { return cutProbe(pid, io.now()); },
      // the seat is about to found on silence: may it ask the Worker first? Closed once after a refusal (that founding attempt
      // founds), and while a refusal's wait runs
      mayAsk() { if (sub.ans) { sub.ans = false; return false; } const o = sub.out; return !(o && o.refused && io.now() < o.retryAt); },
      // The pipes this page holds an end of, for the media plane: the far end's peer id and subroom, the pipe, who opened it.
      pipeEnds() { const out = []; for (const L of links.values()) if (L.farPid) out.push({ peer: L.far, sub: L.farR, pipe: L.l, opener: !!L.opener, video: !!L.video, up: L.state === 'up', standby: !!L.sb, direct: !!L.direct }); return out; },
      standby(pid) { const L = links.get(pid); return !!L && L.sb; },   // a warm standby: keep-alives only, nothing rides it
      videoBlocked(pid) { const L = links.get(pid); return !!L && (L.sb || !L.video || L.busy); },
      // TURN.13: the step my video takes on this link ({ maxBitrate, scale, fps }), null when nothing limits it.
      videoStep(pid) { const L = links.get(pid); return L && L.video && L.thr && L.thr.step >= 0 ? L.thr : null; },
      // TURN.13: the rate each audio sender of the link takes while it is starved (bits a second), or 0: its full rate
      voiceCap(pid) { const L = links.get(pid); return L && L.state === 'up' && L.voiceLow > 0 ? L.voiceLow : 0; },
      busy(pid) { const L = links.get(pid); return !!L && L.busy; },
      farBusy(pid) { const L = links.get(pid); return !!L && L.video && L.farBusy; },
      // the pcs that run through TURN (the page watches their path, server and capacity)
      turnPcs() { const out = []; for (const L of links.values()) if (L.state === 'up' && !L.direct) out.push(L.far); return out; },
      lookMs: THROTTLE_LOOK_MS,
      video(pid) { const L = links.get(pid); return !!L && L.video; },
      // SUB.4 pipe holders: may a second picture (my camera beside the composite) ride this link? Only on a measured estimate
      // that leaves room for two pictures at the law's minimum (TURN_VIDEO_MIN_BYTES) over everything else (TURN_BASE_BYTES):
      // under a paid server's cap the camera sat at the browser's floor beside the composite and the voice was lost (capstep).
      camRoom(pid) { const L = links.get(pid); if (L && L.direct) return L.state === 'up' && !L.sb; if (!L || !L.video || L.busy || !(L.cap > 0)) return false; const K = meshConsts().consts, perS = 1000 / tick; return L.cap - K.TURN_BASE_BYTES * perS * 8 >= 2 * K.TURN_VIDEO_MIN_BYTES * perS * 8; },
      close(pid, why) { const L = links.get(pid); if (L) close(L, why || 'closed'); },
      stopAll(why) { for (const L of Array.from(links.values())) close(L, why || 'stop', true); },
      dump() {
        const out = [];
        for (const L of links.values()) out.push({ far: L.far, l: L.l, opener: L.opener, state: L.state, client: L.client, farDev: L.farDev, farBlocked: L.farBlocked,
          mine: !!L.mine, peer: !!L.peer, readyMe: L.readyMe, readyFar: L.readyFar, cred: L.cred ? L.cred.state() : null, credRefusal: L.cred ? L.cred.refusal() : null,
          pool: L.paidMe ? 'paid' : 'free', paid: L.paid ? L.paid.state() : null, paidRefusal: L.paid ? L.paid.refusal() : null, paidFar: L.paidFar,
          vouched: L.vouched, video: L.video, upAt: L.upAt, side: L.side.length, web: L.web, webHost: L.webHost || null,
          step: L.thr ? L.thr.step : null, cap: L.cap || null, busy: L.busy, farBusy: L.farBusy, standbyN: L.standbyN, lastSwitchMs: L.lastSwitchMs || null, direct: !!L.direct, sb: !!L.sb, sbUp: !!L.sbUp, probes: L.pr ? L.pr.n : 0, probeX: L.pr ? L.pr.x : 0 });
        return { links: out, sub: { st: sub.st, out: sub.out, list: sub.list.slice(), retryAt: sub.retryAt, found: sub.found } };
      },
    };
  }

  // SUB.9 WHAT CROSSES A SUBROOM BRIDGE (Nathan 11-15). Every TURN link joins two subrooms (two offices, or a blocked seat
  // that is a subroom of one), and each subroom runs its own mesh: its upkeep stays home. bridgeHolds(msg) -> true: the
  // frame never goes on a bridge's channel.
  //   UPKEEP (held): a seat frame (MW2) other than the PIPE fold (the far end drops it anyway, SUB.1), section-scoped gossip
  //     (GSPS: the section flood of the status beat among them).
  //   CONTENT (crosses, once per event): room-wide gossip (chat, transcript lines, TURN facts, subscriptions, goodbyes), who
  //     is talking (vtalk), the PIPE fold (the far roster, hands, Stage, talk), the sound announce (mx) and media. Once: a
  //     bridge gets no refan copy and no backlog replay (js/mesh/page/layer.js).
  //   LINK (crosses): the link's own words (tv: handshake, standby, the SUB.8 direct-path probe list), its own
  //     connection's upkeep (renegotiation, ICE, channel auth), and each end's own status beat (SUB.9.3, Nathan 11-19: a TURN
  //     link is an ordinary mesh link, free TURN carries everything but video): mute, camera, hand, name cross as on any
  //     link (the sim's beat rides every open link, the pipe's too), in the bridge form (bridgeForm).
  //   THIRD-SEAT SIGNALLING (held, SUB.9.2): a friend-hop ask for a seat of the far subroom and what it forwards (fsig, fhi,
  //     fmesh) and the carry it sets up (relay-req and its answers). Seats of two subrooms never pair over a bridge: SUB.1
  //     drops their frames, and SUB.8's direct-path probe dials over the relay (pk42 on the tip: 60-80 KB of fsig on a
  //     pipe, the far office's seats asking the link end to carry them, static).
  // A frame of no class named here crosses (a new kind is content until a law says otherwise).
  const THIRD_SEAT = new Set(['fsig', 'fhi', 'fmesh', 'relay-req', 'relay-no', 'relay-stream', 'relay-stop', 'relay-end']);
  function bridgeHolds(msg) {
    if (!msg || typeof msg !== 'object') return false;
    if (THIRD_SEAT.has(msg.k)) return true;
    if (msg.k === 'mesh') { const m = msg.m || {}, t = m.t === 'MW2' && m.f ? m.f.t : m.t; return m.t === 'GSPS' || (m.t === 'MW2' && t !== 'PIPE'); }
    return false;
  }
  // SUB.9.3 THE BRIDGE FORM OF A STATUS BEAT: the beat as it is, without the words that serve my own subroom only: the
  // friend-hop words (conns, tc, nat, nt, cls, ft: who I hold and my networks, read only to ask a carrier for a peer of
  // my own subroom, SUB.9.2) and the room's moderation table (mod, modw: room gossip carries it across once a change).
  // Any other frame goes as it is. The far end takes the beat as any link's; status is section-scoped, so it goes no further.
  const STATUS_HOME = ['conns', 'tc', 'nat', 'nt', 'cls', 'ft', 'mod', 'modw'];
  function bridgeForm(msg) {
    if (!msg || msg.k !== 'sig' || !msg.msg || msg.msg.kind !== 'status') return msg;
    const m = Object.assign({}, msg.msg); for (const k of STATUS_HOME) delete m[k];
    return Object.assign({}, msg, { msg: m });
  }

  const api = {
    DEFAULT_WORKER, WORKER_KEY, FETCH_TIMEOUT_MS, RETRY_BASE_MS, RETRY_MAX_MS, SIDE_MAX, STANDBY_SWITCH_MS, THROTTLE_LOOK_MS, THROTTLE_UP_MS,
    THROTTLE_STEPS, THROTTLE_LOSS, throttlePlan, throttleNext, stepOf, voiceLow,
    retryDelayMs, parseIce, hasTurnServer, webHostOk, workerBase, askIce, askSub, createCredentials,
    vouchToken, vouchParts, tvOk, TV_KEYS, bridgeHolds, bridgeForm, linkId, clientEnd, pausedBy, stripPaused, vouchRank, vouchPlan, vouchPayers, budgetTicket, subsPresent, createLinks,
  };
  GifOS.meetTurn = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
