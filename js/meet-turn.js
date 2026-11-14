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
  //                               (an opener's ask carries f:1 when it re-links a subroom that is already in the meeting)
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
  //   {k:'tv', q:'r', l:'s<r>'} / q 'x'    a standby end to its live end: the standby is up / gone
  //   {k:'tv', q:'t', l:'s<r>'}            take the pipe over (the live pipe is gone)
  //   {k:'tv', q:'w', l, m}       TURN.18: this link runs over the web path; m (the opener's word) names its host
  //   {k:'tv', q:'b', l, b}       busy: my end paused its video because the server throttles (b 1), or sends again (b 0)
  const TV_KEYS = 'k,q,l,d,b,e,n,m,f';
  const LINK_RE = /^[ls][0-9]{1,2}$/, DEV_RE = /^[A-Za-z0-9_.-]{1,16}$/, NONCE_RE = /^[0-9a-f]{18}$/, MAC_RE = /^[A-Za-z0-9_-]{43}$/, E36_RE = /^[0-9a-z]{1,11}$/;
  function tvOk(f) {
    if (!f || typeof f !== 'object' || Array.isArray(f) || f.k !== 'tv' || typeof f.l !== 'string' || !LINK_RE.test(f.l)) return false;
    for (const k of Object.keys(f)) if (k !== '_' && TV_KEYS.split(',').indexOf(k) < 0) return false;
    if (f.q === 'a') return typeof f.d === 'string' && DEV_RE.test(f.d) && (f.b === 0 || f.b === 1) && (f.f === undefined || f.f === 1);
    if (f.q === 'w') return f.m === undefined || (typeof f.m === 'string' && WEB_HOST_RE.test(f.m));
    if (f.q === 'v') return typeof f.e === 'string' && E36_RE.test(f.e) && typeof f.n === 'string' && NONCE_RE.test(f.n) && typeof f.m === 'string' && MAC_RE.test(f.m);
    if (f.q === 'x') return f.b === undefined || f.b === 1;
    if (f.q === 'r' || f.q === 'i' || f.q === 't') return true;
    if (f.q === 's') return (f.d === undefined || (typeof f.d === 'string' && DEV_RE.test(f.d))) && (f.e === undefined || (typeof f.e === 'string' && /^[0-9a-z]{1,2}$/.test(f.e)));
    if (f.q === 'p' || f.q === 'b') return f.b === 0 || f.b === 1;
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
  function throttleNext(st, look, now, tickMs) {
    const last = THROTTLE_STEPS.length - 1;
    const rtt = +look.rtt > 0 ? +look.rtt : 0;
    if (rtt && (!st.rttBase || rtt < st.rttBase)) st.rttBase = rtt;
    const plan = throttlePlan(look.bps, tickMs);
    const K = meshConsts().consts, base = K.TURN_BASE_BYTES * (1000 / (tickMs || 500)) * 8;
    const capHeld = +look.cap > 0 && (+look.bps || 0) - base >= +look.cap;   // the estimate leaves video its whole cap
    const held = !!look.limited && !capHeld;   // the path, not the step's own cap, holds my video back
    const short = held && (plan.step < 0 || plan.step > st.step);   // the path gives less than this step needs
    // (the round trip is kept for the record only: a pool move or a renewal changes the relayed path's round trip
    // under a link that is not congested, measured as false pauses right after the move)
    const congested = (+look.loss || 0) >= THROTTLE_LOSS || short;
    if (congested) {
      st.okSince = 0; st.bad = (st.bad || 0) + 1;
      if (st.busy) return st;
      if (st.step >= last) { if (st.bad >= 2) { st.busy = true; st.pausedAt = now; } return st; }
      if (st.bad < 2 && (+look.loss || 0) < 4 * THROTTLE_LOSS) return st;   // one congested look is a blip; heavy loss acts at once
      st.step = Math.max(st.step + 1, plan.step < 0 ? last : Math.min(last, plan.step));
      st.bad = 0;   // the pause counts congested looks ON the lowest step only
      return st;
    }
    st.bad = 0;
    if (st.busy) { if (now - (st.pausedAt || 0) >= THROTTLE_UP_MS) { st.busy = false; st.step = last; st.okSince = now; } return st; }
    if (held) { st.okSince = 0; return st; }   // held back by the path: no climb
    if (st.step > 0) { if (!st.okSince) st.okSince = now; else if (now - st.okSince >= THROTTLE_UP_MS) { st.step--; st.okSince = now; } }
    return st;
  }

  // vouchPlan(links, pool) → the ids that carry video now: links in turnVouchOrder, the first `pool` of them.
  // links: [{ id, stage, cell, serial }]; pool: the sum of the tiers' video links over the subscribers present.
  function vouchPlan(links, pool) {
    const T = meshTurn();
    const ix = (links || []).slice();
    const before = (x, y) => T.turnVouchOrder(!!x.stage, x.cell, x.serial, !!y.stage, y.cell, y.serial);
    ix.sort((x, y) => (before(x, y) ? -1 : before(y, x) ? 1 : 0));
    return new Set(ix.slice(0, Math.max(0, pool | 0)).map((x) => x.id));
  }

  // ---- the links of this page --------------------------------------------------
  // createLinks(io) → the manager run.html drives once a tick. io (all functions):
  //   me() my peer id; dev() my device tag; sid() the room's relay session; now(); tickMs
  //   seat() → { head, greeter, view: [pid], cell } | null   (head: my seat is its part's home cell; greeter: Section 1)
  //   reach(pid) → 'direct' | 'friend' | null   as this page knows them
  //   blocked() → my network blocks direct connections (the page's own probe)
  //   alive(pid) → the far page is still in the meeting      pcUp(pid) → the pair's connection is up
  //   sendTv(addr, frame): addr a peer id, or a device tag (a pipe's far end before it answers; the relay routes both)
  //   askVouch(farDev, l); ask(body) → Promise<json> (/v1/ice); askSub(body) → Promise<json> (/v1/sub)
  //   THE SUBROOM ASK: asker() → null | 'joiner' (about to found a room on silence at my door) | 'head' (the head of a
  //     seated room that reaches no older room at door 0) | 'repipe' (a head of my subroom, whose pipe is gone);
  //     tdoors() → Promise<the relay's signed door list> ; probeDoor(r) → true | false | 'pending' (knock door r
  //     without registering and dial its listed heads); sub() → my door's subroom; meetingFull() → my meeting is at
  //     its plan's limit (a NEW pipe is then refused: room limits apply at entry only)
  //   standbySeat() → { pid, dev } | null: the seat of my subroom that ends a pipe's warm standby on my side (another
  //     capable row head, the fewest pipes and standbys first; with one row head the next seat of its row); null: I am
  //     my subroom's only seat, so I keep that end myself
  //   dial(pid); reset(pid) (a fresh pc on the new settings, no dial); restart(pid, l) (move a live pc onto new settings)
  //   keep(pid) (the seat holds this pc: an L28 keep); drop(pid, why) (the TURN pc ends)
  //   subs() → [{ key, tier }] verified subscribers present; ticket() → a meeting ticket for a paid ask, or null
  //   web() → this browser can run the web path; turnPath(pid) → { at, relay }: when my connection of that pair began
  //   looking for its relay path (0: not yet) and whether it found one; webOpen(pid, { url, auth }); webAuth(pid, auth);
  //   webUp(pid) → the web path carries end to end; webClose(pid)                                    (TURN.18)
  //   publish(fact); facts() → [fact] (every link fact heard, mine included); log(line); changed(pid)
  function createLinks(io) {
    const K = meshConsts().consts, T = meshTurn();
    const tick = io.tickMs || 500;
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
    const sub = { st: 'idle', gen: 0, out: null, retryAt: 0, token: null, list: [], probe: [], found: null, why: '' };
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
      const L = { far, l, opener, id: linkId(io.me(), far), farDev: farDev || null, farR: farR == null ? Number(l.slice(1)) : farR, farPid: opener ? null : far,
        farBlocked: false, client: false, mine: null, peer: null,
        state: 'ask', askAt: io.now(), sentAt: 0, vAskAt: 0, readyMe: false, readyFar: false, dialAt: 0, upAt: -1, downSince: 0,
        cred: null, paid: null, paidMe: false, paidFar: false, paidSaid: false, paidAt: 0, mvWant: false, mvAt: 0, mvHeldAt: 0, mvN: 0, mvWhy: '', video: false, vouched: false, lostAt: -1, side: [],
        thr: null, busy: false, farBusy: false, capAt: 0, upOkSince: 0, standbyAt: 0, standbyN: 0,
        web: false, webHost: '', webOpen: false, webSaidAt: 0, sb: l[0] === 's', liveEnd: null, sbUp: false, sbAt: 0, sbSeat: null, farSb: null };
      const s = io.seat(); if (s) L.side = s.view.filter((x) => x !== far).slice(0, SIDE_MAX);
      links.set(far, L);
      log('turn-link new ' + short(far) + ' ' + l + (opener ? ' opener' : ' target'));
      return L;
    }
    function close(L, why, quiet) {
      if (L.state === 'closed') return;
      L.state = 'closed';
      try { if (L.cred) L.cred.stop(); } catch (e) {}
      try { if (L.paid) L.paid.stop(); } catch (e) {}
      if (L.web) { try { io.webClose(L.far); } catch (e) {} }
      links.delete(L.far);
      if (!quiet) { try { io.sendTv(L.far, { k: 'tv', q: 'x', l: L.l }); } catch (e) {} }
      if (L.sb && L.liveEnd && L.liveEnd !== io.me()) { try { io.sendTv(L.liveEnd, { k: 'tv', q: 'x', l: L.l }); } catch (e) {} }
      if (L.sb && L.liveEnd === io.me()) { const P = livePipe(pipeNo(L.l)); if (P) P.sbUp = false; }
      log('turn-link closed ' + short(L.far) + ' ' + why);
      try { io.drop(L.far, why); } catch (e) {}
      if (L.farPid && !L.sb) { try { io.publish({ id: L.id, a: L.opener ? io.me() : L.far, b: L.opener ? L.far : io.me(), up: 0, v: 0, gone: 1 }); } catch (e) {} }
      try { io.changed(L.far); } catch (e) {}
    }
    const fresh = (L) => !!(L.mine && L.peer && L.mine.e - io.now() > 0 && L.peerE - io.now() > 0);
    function sendAsk(L) { L.sentAt = io.now(); const a = { k: 'tv', q: 'a', l: L.l, d: io.dev(), b: io.blocked() ? 1 : 0 }; if (L.relink) a.f = 1; io.sendTv(L.far, a); }
    // My vouch names the subroom my relay socket sits in: a pipe I opened waits until my door is its new subroom.
    const mySubFor = (L) => (L.opener ? Number(L.l.slice(1)) : (io.sub ? io.sub() : 0));
    function askMine(L) { if (!L.farDev) return; if (io.sub && io.sub() !== mySubFor(L)) return; L.vAskAt = io.now(); io.askVouch(L.farDev, L.l); }
    function credFor(L, pool) {
      return createCredentials({ ask: io.ask, room: io.sid(), pool, now: io.now, setTimer: io.setTimer, clearTimer: io.clearTimer,
        extra: () => {
          if (!fresh(L)) { askMine(L); return null; }
          const b = { vouch: L.mine.v, peerVouch: L.peer };
          if (pool === 'paid') { const t = io.ticket(); if (!t) return null; b.ticket = t; }
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
      else { L.readyMe = true; io.sendTv(L.far, { k: 'tv', q: 'r', l: L.l }); maybeDial(L); }
      if (L.state === 'ask') L.state = 'swap';
    }
    // ---- TURN.18: the web path -------------------------------------------------------------------------------------
    // webStart: this link leaves the relay protocol for the web path. `mine`: my own connection found no relay path
    // (the far end is told); else the far end said so. Both ends hold a credential on the web path (each shows its own
    // to the server), so an end that was no client asks for one now. The opener names the host; the link's dial
    // budget starts again, since the first one was spent learning that the relay protocol does not pass.
    function webStart(L, mine, host) {
      if (L.state === 'closed' || L.state === 'up') return;
      if (!io.web || !io.web()) { if (!L.webNo) { L.webNo = true; log('turn-web ' + short(L.far) + ' not in this browser'); } return; }
      if (!L.web) {
        L.web = true; L.askAt = io.now();
        log('turn-web ' + short(L.far) + (mine ? ' no relay path from here' : ' the far end has no relay path'));
        if (!L.cred && L.mine && L.peer) { L.cred = credFor(L, 'free'); L.cred.start(); }
        io.changed(L.far);
      }
      if (host && !L.opener && L.webHost !== host) { L.webHost = host; if (L.webOpen) { L.webOpen = false; try { io.webClose(L.far); } catch (e) {} } }
      webGo(L);
    }
    function webSay(L) { L.webSaidAt = io.now(); const f = { k: 'tv', q: 'w', l: L.l }; if (L.opener && L.webHost) f.m = L.webHost; io.sendTv(L.far, f); }
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
      if (!L.opener || !L.readyMe || !L.readyFar || L.dialAt) return;
      L.dialAt = io.now(); L.state = 'dial';
      log('turn-dial ' + short(L.far) + ' client=' + (L.client ? 1 : 0));
      io.dial(L.far);
    }

    // A `tv` frame from the far end (relay, or the pair's own channel once open).
    function onFrame(from, f) {
      if (!tvOk(f) || from === io.me()) return;
      let L = links.get(from);
      if (!L && onSide(from, f)) return;
      if (!L) {   // the first answer of a pipe I opened: from now on it is addressed by the far end's peer id
        for (const x of links.values()) if (x.opener && !x.farPid && x.l === f.l) { L = x; break; }
        if (L) { links.delete(L.far); L.far = from; L.farPid = from; L.id = linkId(io.me(), from); links.set(from, L); }
      }
      if (L) L.heardAt = io.now();
      if (f.q === 't') { if (L && L.sb && L.l === f.l) takeover(L, 'the far standby end took over'); return; }
      if (f.q === 's') { if (L && !L.sb && L.opener && L.l === f.l && f.d) { if (L.farSb !== f.d) { L.farSb = f.d; L.sbAt = 0; } } return; }
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
          // only; a pipe re-linking a subroom already in the meeting, f 1, is never refused for it).
          if (f.l[0] === 's') {   // a standby: only a seat its own live end named takes it
            if (!sbExpect.has(f.l)) return;
            L = newLink(from, f.l, false); L.heardAt = io.now(); L.liveEnd = sbExpect.get(f.l);
          } else if (f.f !== 1 && io.meetingFull && io.meetingFull()) { log('turn-link refused ' + short(from) + ' ' + f.l + ': the meeting is full'); io.sendTv(from, { k: 'tv', q: 'x', l: f.l, b: 1 }); return; }
          if (!L) { L = newLink(from, f.l, false); L.heardAt = io.now(); }
        }
        if (L.l !== f.l) return;
        const first = !L.farDev;
        L.farDev = f.d; L.farBlocked = f.b === 1;
        if (!L.opener && (first || io.now() - L.sentAt > RESEND_MS)) sendAsk(L);   // the target answers with its own device and network
        if (!L.mine || L.mine.e - io.now() < 0) askMine(L);
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
      if (f.q === 'w') { webStart(L, false, f.m); if (L.opener && io.now() - L.webSaidAt > RESEND_MS / 2) webSay(L); return; }
      // the far end moved its pool: it moves the pc itself (its own restart, or 'i' to the offerer), so no restart here:
      // a second one per move restarted the path again mid-move and the video's estimate with it (vouched one-way, 2026-11-12)
      if (f.q === 'p') { L.paidFar = f.b === 1; io.changed(L.far); return; }
      if (f.q === 'i') { move(L, 'far'); return; }
      if (f.q === 'b') { const was = L.farBusy; L.farBusy = f.b === 1; if (was !== L.farBusy) { log('turn-busy far ' + short(L.far) + ' ' + (L.farBusy ? 'on' : 'off')); io.changed(L.far); } return; }
    }
    // TURN.13: each look at the link pc (every THROTTLE_LOOK_MS while it carries video): the browser's send estimate,
    // the loss and round trip the far end reports. throttleNext decides the step (pure, below).
    function onCapacity(pid, bps, loss, rtt, limited) {
      const L = links.get(pid); if (!L || L.state !== 'up' || !L.video) return;
      const now = io.now(); L.capAt = now; L.cap = bps;
      if (!L.ts) L.ts = { step: 0, busy: false };
      const was = L.ts.busy ? -1 : L.ts.step;
      throttleNext(L.ts, { bps, loss, rtt, limited: !!limited, cap: L.thr && L.thr.step >= 0 ? L.thr.maxBitrate : 0 }, now, tick);
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
      const now = io.now(), settled = io.settled ? !!io.settled(L.far) : true;
      if (L.mvAt && now - L.mvAt < MOVE_MS && !(settled && now - L.mvAt >= RESEND_MS)) return;   // the last move is still on its way
      if (!settled) { if (!L.mvHeldAt) L.mvHeldAt = now; if (now - L.mvHeldAt < MOVE_MS) return; }   // an offer of this pc (a move, the video's) is crossing: never a second one on top
      L.mvHeldAt = 0; L.mvWant = false; L.mvAt = now; L.mvN++;
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
      let pool = 0;
      for (const s of io.subs() || []) pool += T.turnTierLinks(s.tier);
      const ups = [];
      for (const f of io.facts() || []) if (f && f.up && !f.gone) ups.push({ id: f.id, stage: !!f.g, cell: f.c, serial: f.s });
      const want = vouchPlan(ups, pool);
      for (const L of links.values()) {
        if (L.state !== 'up' || L.sb) continue;   // a standby carries keep-alives only
        const yes = want.has(L.id);
        if (yes) { L.vouched = true; L.lostAt = -1; }
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
        if (v !== L.video) { L.video = v; L.ts = null; log('turn-video ' + short(L.far) + ' ' + (v ? 'on' : 'off')); if (!v) setThrottle(L, null); io.changed(L.far); }
      }
    }
    function factOf(L) {
      const s = io.seat();
      return { id: L.id, a: L.opener ? io.me() : L.far, b: L.opener ? L.far : io.me(), up: L.state === 'up' ? 1 : 0, v: L.video ? 1 : 0,
        s: L.serial || 0, c: s ? s.cell : 0, g: 0, [L.opener ? 'va' : 'vb']: L.side.slice(0, SIDE_MAX) };
    }

    // ---- THE WARM STANDBY ---------------------------------------------------------------------------------------------
    function livePipe(r) { for (const L of links.values()) if (!L.sb && L.l === 'l' + r && L.state !== 'closed') return L; return null; }
    function standbys() { let n = 0; for (const L of links.values()) if (L.sb) n++; return n; }
    // A live pipe end keeps its standby: the far end names its side's standby seat (and tells that seat), the opener has
    // a seat of its own side open the standby toward it. Asked again after a whole dial budget with no standby up.
    function warmStandby(L, now) {
      if (L.sbUp || (L.sbAt && now - L.sbAt < DIAL_BUDGET_MS)) return;
      if (L.tookOver) return;   // a pipe just taken over warms its next standby once the service has moved the pipe to it (its first l<r> grant)
      const r = pipeNo(L.l), sl = 's' + r, S = io.standbySeat ? io.standbySeat() : null;
      if (!L.opener) {
        L.sbAt = now; L.sbSeat = S ? S.pid : io.me();
        if (S) io.sendTv(S.pid, { k: 'tv', q: 's', l: sl }); else sbExpect.set(sl, io.me());
        io.sendTv(L.far, { k: 'tv', q: 's', l: L.l, d: S ? S.dev : io.dev() });
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
      const M = newLink(farDev, sl, true, farDev, farR); M.liveEnd = liveEnd;
      sendAsk(M); askMine(M);
      return M;
    }
    // A frame from a seat of my own subroom about a standby (no link between us): returns true when it was one.
    function onSide(from, f) {
      if (f.l[0] !== 's' || ['s', 'r', 'x', 't'].indexOf(f.q) < 0) return false;
      const r = pipeNo(f.l);
      if (f.q === 's' && f.d) {   // open the standby toward f.d in subroom f.e
        if (standbys() >= SB_PER_SEAT) { io.sendTv(from, { k: 'tv', q: 'x', l: f.l }); return true; }
        let M = null; for (const x of links.values()) if (x.sb && x.l === f.l && x.farDev === f.d && x.state !== 'closed') M = x;
        if (!M) { openStandby(f.l, f.d, parseInt(f.e, 36), from); log('turn-standby open ' + f.l + ' toward ' + f.d); }
        return true;
      }
      if (f.q === 's') { sbExpect.set(f.l, from); return true; }   // I end this pipe's standby on my side
      // the rest come only from a seat of my subroom in its role (else: a frame of a standby link not yet keyed by its peer id)
      const P = livePipe(r);
      if ((f.q === 'r' || f.q === 'x') && P && P.sbSeat === from) { P.sbUp = f.q === 'r'; if (f.q === 'x') P.sbAt = 0; return true; }
      if (f.q === 't' && P && P.sbSeat === from) { close(P, 'standby-took-over', true); return true; }   // my standby seat holds the pipe now: my part ends
      if (f.q === 't') { const mine = Array.from(links.values()).filter((M) => M.sb && M.l === f.l && M.liveEnd === from); for (const M of mine) takeover(M, 'my live end lost the pipe'); return mine.length > 0; }
      return false;
    }
    // A live end whose pipe connection died: its standby seat takes the pipe over; this end's part ends with it.
    function handOver(L) {
      const sl = 's' + pipeNo(L.l);
      log('turn-standby hand-over ' + L.l + ' (the connection died)');
      if (L.sbSeat && L.sbSeat !== io.me()) io.sendTv(L.sbSeat, { k: 'tv', q: 't', l: sl });
      close(L, 'standby-took-over', true);
      if (!L.sbSeat || L.sbSeat === io.me()) for (const M of Array.from(links.values())) if (M.sb && M.l === sl) takeover(M, 'my own pipe died');
    }
    // The standby becomes the pipe: the same connection, now l<r>; fresh vouches and a credential for l<r> (the service
    // moves the pipe's ends to this pair), the far standby end told over the standby itself.
    function takeover(M, why) {
      if (!M.sb || M.state === 'closed') return;
      const sl = M.l, r = pipeNo(sl);
      const old = livePipe(r); if (old && old !== M) close(old, 'standby-took-over', true);
      try { io.sendTv(M.far, { k: 'tv', q: 't', l: sl }); } catch (e) {}
      if (M.liveEnd && M.liveEnd !== io.me()) { try { io.sendTv(M.liveEnd, { k: 'tv', q: 't', l: sl }); } catch (e) {} }   // my side's old live end: its part of the pipe ends
      M.sb = false; M.l = 'l' + r; M.liveEnd = null; M.mine = null; M.peer = null; M.vAskAt = 0; M.tookOver = !!M.client; M.sbUp = false; M.sbAt = 0;
      sbExpect.delete(sl);
      if (M.cred) { try { M.cred.stop(); } catch (e) {} M.cred = null; }
      if (M.client) { M.cred = credFor(M, 'free'); M.cred.start(); }
      log('turn-standby took over ' + M.l + ' with ' + short(M.far) + ': ' + why);
      askMine(M);
      io.changed(M.far);
    }

    // ---- THE SUBROOM ASK (header) ------------------------------------------------------------------------------------
    // idle → doors (the relay's signed list) → ask → 202 list: probe each listed door (subroom 0 first, then the list's
    // order; a re-pipe probes none) → none reached: a fresh door list → ask with the list's token → 200: the pipe.
    // An answer that arrives after the machine moved on (a newer generation) is dropped.
    const busyOut = { wait: 1 };
    function subIdle(now, out, retryAt) { sub.st = 'idle'; sub.token = null; sub.retryAt = retryAt || 0; sub.out = out; sub.gen++; }
    function subDoors(withToken) {
      const g = ++sub.gen; sub.st = 'doors'; sub.out = busyOut;
      Promise.resolve(io.tdoors ? io.tdoors() : null).then((d) => {
        if (g !== sub.gen) return;
        if (!d) { subIdle(io.now(), { refused: 'no-doors', retryAt: io.now() + RETRY_MS }, io.now() + RETRY_MS); return; }
        subAsk(d, withToken ? sub.token : null);
      }, () => { if (g === sub.gen) subIdle(io.now(), { refused: 'no-doors', retryAt: io.now() + RETRY_MS }, io.now() + RETRY_MS); });
    }
    function subAsk(doors, token) {
      const g = ++sub.gen; sub.st = 'ask';
      const b = { room: String(io.sid()), doors };
      if (token) b.token = token;
      const t = io.ticket ? io.ticket() : null; if (t) b.ticket = t;   // a plan's meeting ticket raises the meeting's budget to its allowance
      Promise.resolve(io.askSub ? io.askSub(b) : null).then((a) => {
        if (g !== sub.gen) return;
        const now = io.now();
        if (a && Number.isInteger(a.r) && a.r > 0 && typeof a.sg === 'string' && a.far && typeof a.far.d === 'string' && Number.isInteger(a.far.r) && LINK_RE.test(a.link || '')) {
          subFound(a); return;
        }
        if (a && a.pending === 'opening') { log('turn-sub opening: knock its door again'); subIdle(now, busyOut, now + RESEND_MS); return; }
        if (a && a.pending === 'subrooms' && typeof a.token === 'string') {
          sub.token = a.token; sub.list = Array.isArray(a.subs) ? a.subs.filter((x) => x && Number.isInteger(x.r) && x.r > 0).map((x) => x.r) : [];
          if (io.asker && io.asker() === 'repipe') { subDoors(true); return; }   // my own subroom keeps its number: no doors to try
          sub.probe = [0].concat(sub.list.filter((r) => r !== (io.sub ? io.sub() : 0)));
          sub.st = 'probe'; sub.out = busyOut;
          log('turn-sub list ' + sub.list.join(',') + ': trying the doors');
          return;
        }
        const why = (a && a.unavailable) ? String(a.unavailable).slice(0, 40) : 'no-answer';
        log('turn-sub refused ' + why);
        subIdle(now, { refused: why, retryAt: now + RETRY_MS }, now + RETRY_MS);
      }, () => { if (g === sub.gen) subIdle(io.now(), { refused: 'no-answer', retryAt: io.now() + RETRY_MS }, io.now() + RETRY_MS); });
    }
    function subFound(a) {
      const relink = io.asker && io.asker() === 'repipe';
      sub.st = 'found'; sub.gen++;
      sub.found = { r: a.r, sg: a.sg, far: { r: a.far.r, d: a.far.d }, link: a.link };
      sub.out = { found: a.r, sg: a.sg, far: sub.found.far, link: a.link };
      log('turn-sub ' + (relink ? 're-pipe ' : 'new ') + a.r + ' far ' + a.far.d + '@' + a.far.r + ' ' + a.link);
      for (const L of Array.from(links.values())) if (L.opener && L.l === a.link) close(L, 'replaced', true);   // a re-pipe's old pipe of this subroom
      const L = newLink(a.far.d, a.link, true, a.far.d, a.far.r);
      L.relink = relink;
      sendAsk(L); askMine(L);
    }
    function subStep(now) {
      const asker = io.asker ? io.asker() : null;
      if (sub.st === 'found') {
        const live = Array.from(links.values()).some((L) => L.opener && sub.found && L.l === sub.found.link);
        if (live) return;
        sub.found = null;
        if (sub.why === 'full') { sub.why = ''; subIdle(now, { refused: 'full', retryAt: now + RETRY_MS }, now + RETRY_MS); return; }
        subIdle(now, null, sub.retryAt);
      }
      if (!asker) { if (sub.st !== 'idle') subIdle(now, null, sub.retryAt); else if (sub.out && sub.out.join != null) sub.out = null; return; }
      if (sub.st === 'idle') { if (now >= sub.retryAt) subDoors(false); return; }
      if (sub.st === 'probe') {
        let pending = false;
        for (const r of sub.probe) {
          const v = io.probeDoor ? io.probeDoor(r) : false;
          if (v === true) { log('turn-sub join ' + r); subIdle(now, { join: r }, now + RESEND_MS); return; }   // the page moves its door there; no new ask meanwhile
          if (v !== false) pending = true;
        }
        if (!pending) { log('turn-sub no listed door reached'); subDoors(true); }
      }
    }

    function step() {
      const now = io.now();
      for (const L of Array.from(links.values())) {
        // TURN.8: the far page is gone. A far end my seat does not know yet (a foreign greeter, its door entry stale here)
        // is alive while it keeps answering this link's handshake.
        if (L.farPid && !io.alive(L.far) && now - (L.heardAt || L.askAt) > DIAL_BUDGET_MS / 2) { close(L, 'gone', true); continue; }
        if (L.state === 'up' && io.reach(L.far) === 'friend') { close(L, 'healed'); continue; }          // TURN.7
        if (L.state !== 'up' && now - L.askAt > DIAL_BUDGET_MS) { if (L.opener) sub.retryAt = now + RETRY_MS; close(L, 'dialfail'); continue; }
        if (L.state === 'up' && !io.pcUp(L.far) && !L.sb && L.sbUp) { handOver(L); continue; }   // the pipe's connection died: its warm standby takes over
        if (L.sb && L.liveEnd && L.liveEnd !== io.me() && !io.alive(L.liveEnd)) { takeover(L, 'my live end left'); }
        if (L.state === 'up' && !io.pcUp(L.far)) { if (!L.downSince) L.downSince = now; if (now - L.downSince > DIAL_BUDGET_MS) { if (L.opener) sub.retryAt = now + RETRY_MS; close(L, 'lost'); continue; } }
        else L.downSince = 0;
        if ((L.state === 'ask' || (L.state === 'swap' && !L.peer)) && now - L.sentAt > RESEND_MS && (L.opener || L.farDev)) sendAsk(L);
        // my vouch is re-made once half its life is gone (the far end does the same), so a renewal always has fresh ones
        if (L.farDev && now - L.vAskAt > RESEND_MS && (!L.mine || now - L.mine.at > (L.mine.e - L.mine.at) / 2)) askMine(L);
        // TURN.18: a client end's connection has looked for its relay path for TURN_WEB_WAIT and found none
        if (L.state !== 'up' && !L.web && L.client && L.cred && io.turnPath) { const tp = io.turnPath(L.far); if (tp && tp.at > 0 && !tp.relay && now - tp.at >= WEB_WAIT_MS && L.cred.web().length) webStart(L, true); }
        if (L.web && L.state !== 'up') { if (now - L.webSaidAt > RESEND_MS) webSay(L); webGo(L); }
        if (L.state !== 'up' && L.readyMe && (L.readyFar || L.web) && io.pcUp(L.far) && (!L.web || io.webUp(L.far))) {
          L.state = 'up'; L.upAt = now; L.serial = now; log('turn-link up ' + short(L.far) + (L.sb ? ' (standby)' : '')); io.changed(L.far);
          if (L.sb && L.liveEnd && L.liveEnd !== io.me()) io.sendTv(L.liveEnd, { k: 'tv', q: 'r', l: L.l });
          if (L.sb && L.liveEnd === io.me()) { const P = livePipe(pipeNo(L.l)); if (P) P.sbUp = true; }
        }
        if (L.mine && !L.peer && L.farDev && now - (L.vSentAt || 0) > RESEND_MS) { L.vSentAt = now; io.sendTv(L.far, { k: 'tv', q: 'v', l: L.l, e: L.mine.e.toString(36), n: L.mine.n, m: L.mine.m }); }   // the far end may have missed it (a takeover renames the link)
        if (L.state === 'up' && !L.sb) warmStandby(L, now);
        if (L.state === 'up' || L.state === 'dial') io.keep(L.far);
        pump(L);
        if (L.state === 'up') {   // my side grows with the people I reach directly
          const s = io.seat();
          if (s) for (const x of s.view) if (x !== L.far && L.side.indexOf(x) < 0 && L.side.length < SIDE_MAX && io.reach(x) === 'direct') L.side.push(x);
        }
      }
      planVideo(now);
      subStep(now);
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
      factStaleMs: FACT_STALE_MS,
      holds(pid) { const L = links.get(pid); return !!L && L.state !== 'closed'; },
      isLink(pid) { const L = links.get(pid); return !!L && (L.state === 'up' || L.state === 'dial'); },
      holding() { return (sub.st !== 'idle' && sub.st !== 'found') || Array.from(links.values()).some((L) => L.opener && L.state !== 'up'); },   // a subroom ask or my pipe is on its way
      // THE SUBROOM ASK's outcome for the page this tick (header): { join }, { found }, { wait }, { refused, retryAt }, or null
      subAsk() { return sub.out; },
      // The pipes this page holds an end of, for the media plane: the far end's peer id and subroom, the pipe, who opened it.
      pipeEnds() { const out = []; for (const L of links.values()) if (L.farPid) out.push({ peer: L.far, sub: L.opener ? L.farR : Number(L.l.slice(1)), pipe: L.l, opener: !!L.opener, video: !!L.video, up: L.state === 'up', standby: !!L.sb }); return out; },
      standby(pid) { const L = links.get(pid); return !!L && L.sb; },   // a warm standby: keep-alives only, nothing rides it
      videoBlocked(pid) { const L = links.get(pid); return !!L && (L.sb || !L.video || L.busy); },
      // TURN.13: the step my video takes on this link ({ maxBitrate, scale, fps }), null when nothing limits it.
      videoStep(pid) { const L = links.get(pid); return L && L.video && L.thr && L.thr.step >= 0 ? L.thr : null; },
      busy(pid) { const L = links.get(pid); return !!L && L.busy; },
      farBusy(pid) { const L = links.get(pid); return !!L && L.video && L.farBusy; },
      // TURN.14 hooks for the twin (the pcs that run through TURN: fabricTurnAcross reads them).
      turnPcs() { const out = []; for (const L of links.values()) if (L.state === 'up') out.push(L.far); return out; },
      opened(pid) { const L = links.get(pid); return !!L && L.state === 'up' && !!L.opener; },   // TURN.14.13 / L8.5.9: I opened this up link
      anyHeld() { for (const L of links.values()) if (L.state !== 'closed') return true; return false; },   // TURN.14.13: I hold a TURN link in any state
      lookMs: THROTTLE_LOOK_MS,
      video(pid) { const L = links.get(pid); return !!L && L.video; },
      close(pid, why) { const L = links.get(pid); if (L) close(L, why || 'closed'); },
      stopAll(why) { for (const L of Array.from(links.values())) close(L, why || 'stop', true); },
      dump() {
        const out = [];
        for (const L of links.values()) out.push({ far: L.far, l: L.l, opener: L.opener, state: L.state, client: L.client, farDev: L.farDev, farBlocked: L.farBlocked,
          mine: !!L.mine, peer: !!L.peer, readyMe: L.readyMe, readyFar: L.readyFar, cred: L.cred ? L.cred.state() : null, credRefusal: L.cred ? L.cred.refusal() : null,
          pool: L.paidMe ? 'paid' : 'free', paid: L.paid ? L.paid.state() : null, paidRefusal: L.paid ? L.paid.refusal() : null, paidFar: L.paidFar,
          vouched: L.vouched, video: L.video, upAt: L.upAt, side: L.side.length, web: L.web, webHost: L.webHost || null,
          step: L.thr ? L.thr.step : null, cap: L.cap || null, busy: L.busy, farBusy: L.farBusy, standbyN: L.standbyN, lastSwitchMs: L.lastSwitchMs || null });
        return { links: out, sub: { st: sub.st, out: sub.out, list: sub.list.slice(), retryAt: sub.retryAt, found: sub.found } };
      },
    };
  }

  const api = {
    DEFAULT_WORKER, WORKER_KEY, FETCH_TIMEOUT_MS, RETRY_BASE_MS, RETRY_MAX_MS, SIDE_MAX, STANDBY_SWITCH_MS, THROTTLE_LOOK_MS, THROTTLE_UP_MS,
    THROTTLE_STEPS, throttlePlan, throttleNext, stepOf,
    retryDelayMs, parseIce, hasTurnServer, webHostOk, workerBase, askIce, askSub, createCredentials,
    vouchToken, vouchParts, tvOk, TV_KEYS, linkId, clientEnd, pausedBy, vouchPlan, createLinks,
  };
  GifOS.meetTurn = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
