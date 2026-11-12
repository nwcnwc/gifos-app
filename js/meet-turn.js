/*
 * meet-turn.js — the page side of a TURN link (0.9.26; gifos docs/turn-0926.md).
 *
 * A TURN link is an ordinary mesh link whose path runs through a TURN server.
 * When two parts of one meeting cannot reach each other (no direct path and
 * no friend who reaches both), the head of the part with the higher ids asks
 * for ONE link to the lowest listed greeter it cannot reach (TURN.1-5). Once
 * that pair's connection is up the mesh's own laws merge the two parts and
 * friend-hop carries everyone else through the link's two ends. The page
 * follows the sim (test/sim/mesh_turn.inc); the pure choices are
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
    return { iceServers: servers, ttl, renewAfter, pool: body.pool || null, link: body.link || null };
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
        grant = { iceServers: g.iceServers, issuedAt: t, renewAt: t + g.renewAfter * 1000, expiresAt: t + g.ttl * 1000, pool: g.pool || pool };
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
  // The relay signs tv1.<base64url JSON {k:'v', s, d, p, l, e, n}>.<base64url HMAC> (gifos shared/turn-ticket.js
  // signVouch). A relay frame holds 128 bytes, too few for the whole token, so an end sends only what the other
  // cannot know: e (base 36), n and the MAC. s is the room's relay session, d the sender's device tag (from its
  // ask), p the receiver's own: the receiver rebuilds the exact token. JSON.stringify keeps that key order.
  const enc = typeof TextEncoder === 'function' ? new TextEncoder() : null;
  function b64urlText(s) {
    let bin = '';
    for (const b of enc.encode(s)) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function vouchToken(s, d, p, l, e, n, m) {
    return 'tv1.' + b64urlText(JSON.stringify({ k: 'v', s, d, p, l, e, n })) + '.' + m;
  }
  // vouchParts(tv) → { s, d, p, l, e, n, m } of a token, or null.
  function vouchParts(tv) {
    try {
      const x = String(tv).split('.');
      if (x.length !== 3 || x[0] !== 'tv1') return null;
      const t = x[1].replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
      const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
      if (!o || o.k !== 'v') return null;
      return { s: o.s, d: o.d, p: o.p, l: o.l, e: o.e, n: o.n, m: x[2] };
    } catch (e) { return null; }
  }

  // The `tv` relay frame (gifos-net.js RELAY_TYPES): one link's handshake between its two ends.
  //   {k:'tv', q:'a', l, d, b}   ask / answer: the link name, my device tag, my network blocks direct paths (b 1)
  //   {k:'tv', q:'v', l, e, n, m} my seated vouch for this link (its expiry in base 36, nonce, MAC)
  //   {k:'tv', q:'r', l}          ready: I hold what my end needs (a credential, or none: not a client)
  //   {k:'tv', q:'p', l, b}       paid: my end is on the paid pool (b 1) or back on free (b 0)
  //   {k:'tv', q:'i', l}          move our pc onto new settings: the pair's offerer restarts ICE
  //   {k:'tv', q:'x', l}          the link is closed at my end
  //   {k:'tv', q:'b', l, b}       busy: my end paused its video because the server throttles (b 1), or sends again (b 0)
  const TV_KEYS = 'k,q,l,d,b,e,n,m';
  const LINK_RE = /^[ls][0-9]{1,2}$/, DEV_RE = /^[A-Za-z0-9_.-]{1,16}$/, NONCE_RE = /^[0-9a-f]{18}$/, MAC_RE = /^[A-Za-z0-9_-]{43}$/, E36_RE = /^[0-9a-z]{1,11}$/;
  function tvOk(f) {
    if (!f || typeof f !== 'object' || Array.isArray(f) || f.k !== 'tv' || typeof f.l !== 'string' || !LINK_RE.test(f.l)) return false;
    for (const k of Object.keys(f)) if (k !== '_' && TV_KEYS.split(',').indexOf(k) < 0) return false;
    if (f.q === 'a') return typeof f.d === 'string' && DEV_RE.test(f.d) && (f.b === 0 || f.b === 1);
    if (f.q === 'v') return typeof f.e === 'string' && E36_RE.test(f.e) && typeof f.n === 'string' && NONCE_RE.test(f.n) && typeof f.m === 'string' && MAC_RE.test(f.m);
    if (f.q === 'r' || f.q === 'x' || f.q === 'i') return true;
    if (f.q === 'p' || f.q === 'b') return f.b === 0 || f.b === 1;
    return false;
  }

  // linkName(a, b, n) → 'l<k>': the free pool's link name of the pair (k < n, the room's TURN_FREE_LINKS). Both ends
  // compute the same one; two links of a room may share a name (they then share its allocation quota).
  function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function linkName(a, b, n) { const x = String(a) < String(b) ? a + '|' + b : b + '|' + a; return 'l' + (fnv(x) % Math.max(1, n | 0)); }
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
  //   greeters() → [pid]   the door's list as my seat last read it (fresh only)
  //   nid(pid) → the seat's number for a peer id (the order turnPick compares)
  //   epoch(pid) → when that greeter's part was founded, as the door's list says (-1: not said); myEpoch() → my part's (-1: unknown)
  //   reach(pid) → 'direct' | 'friend' | null   TURN.2 / TURN.3 as this page knows them
  //   blocked() → my network blocks direct connections (the page's own probe)
  //   alive(pid) → the far page is still in the meeting      pcUp(pid) → the pair's connection is up
  //   sendTv(pid, frame); askVouch(farDev, l); ask(body) → Promise<json>
  //   dial(pid); reset(pid) (a fresh pc on the new settings, no dial); restart(pid, l) (move a live pc onto new settings)
  //   keep(pid) (the seat holds this pc: an L28 keep); drop(pid, why) (the TURN pc ends)
  //   subs() → [{ key, tier }] verified subscribers present; ticket() → a meeting ticket for a paid ask, or null
  //   publish(fact); facts() → [fact] (every link fact heard, mine included); log(line); changed(pid)
  function createLinks(io) {
    const K = meshConsts().consts, T = meshTurn();
    const tick = io.tickMs || 500;
    const WAIT_MS = K.TURN_WAIT * tick;                        // TURN.4
    const ASK_MS = K.FHOP_RELAY_ASK * tick;                    // TURN.4.3: one dial's direct verdict; TURN.4.4: the hold after the link came up
    const MERGE_MS = K.RELAY_TTL * tick;                       // TURN.15.2: the span of one merge
    const RETRY_MS = K.TURN_RETRY * tick;                      // TURN.10
    const RESEND_MS = K.TURN_DIAL * tick;                      // a handshake frame the relay lost is sent again
    const DIAL_BUDGET_MS = (K.TURN_DIAL + K.TURN_RETRY) * tick; // an ask that never came up is closed (TURN.8 dialfail)
    const GRACE_MS = K.TURN_VOUCH_GRACE * tick;                // TURN.12
    const FACT_EVERY_MS = K.TURN_DIAL * tick * 2;              // a link end restates its fact
    const FACT_STALE_MS = FACT_EVERY_MS * 4;
    const links = new Map();   // far pid → link
    // TURN.4.3 (C++: mesh_turn.inc:turnWaited): the wait is kept per greeter. A foreign greeter I asked at my entry has
    // its direct verdict FHOP_RELAY_ASK after that ask (my own dial to it stayed silent); one I never asked has it
    // TURN_WAIT after I first held it as foreign. The entry's credit counts only with no connected peer of my own (a
    // friend's probe starts when I first hold the greeter) and once the door has answered my seating knock.
    // TURN.4.5: one verdict per room: a greeter of a room (the door's founding epoch) that already has a verdict does
    // not hold the ask.
    function turnWaited(now, F) {
      const friends = io.friends ? !!io.friends() : true;
      const judged = !friends && !!io.askedAt && (io.judged ? !!io.judged() : true);
      for (const g of Array.from(head.seen.keys())) if (F.indexOf(g) < 0) head.seen.delete(g);
      const due = (g) => { let d = head.seen.get(g) + WAIT_MS; if (judged) { const a = io.askedAt(g); if (a > 0 && now - a <= MERGE_MS) d = Math.min(d, a + ASK_MS); } return d; };
      const epOf = (g) => { const e = io.epoch ? io.epoch(g) : -1; return Number.isInteger(e) ? e : -1; };
      let ok = true; const ep = new Set();
      for (const g of F) { if (!head.seen.has(g)) head.seen.set(g, now); if (now < due(g)) ok = false; else { const e = epOf(g); if (e >= 0) ep.add(e); } }
      if (!ok) { ok = true; for (const g of F) { const e = epOf(g); if (e >= 0 && ep.has(e)) continue; if (now < due(g)) { ok = false; break; } } }
      return ok;
    }
    // TURN.4.4 (C++: mesh_turn.inc:fabricTurnHold): the link I opened is dialling, or came up inside FHOP_RELAY_ASK.
    function holding(now) {
      for (const L of links.values()) if (L.opener && (L.state !== 'up' || !(L.upAt > 0) || now - L.upAt < ASK_MS)) return true;
      return false;
    }
    const head = { since: -1, retryAt: -1, skip: '', seen: new Map() };   // seen: foreign greeter → when I first held it as foreign (TURN.4.3)
    let serialN = 0, lastFactAt = 0;
    const log = (s) => { try { if (io.log) io.log(s); } catch (e) {} };
    const short = (p) => String(p || '').slice(0, 8);

    function newLink(far, l, opener) {
      const L = { far, l, opener, id: linkId(io.me(), far), farDev: null, farBlocked: false, client: false, mine: null, peer: null,
        state: 'ask', askAt: io.now(), sentAt: 0, vAskAt: 0, readyMe: false, readyFar: false, dialAt: 0, upAt: -1, downSince: 0,
        cred: null, paid: null, paidMe: false, paidFar: false, video: false, vouched: false, lostAt: -1, side: [],
        thr: null, busy: false, farBusy: false, capAt: 0, upOkSince: 0, standbyAt: 0, standbyN: 0 };
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
      links.delete(L.far);
      if (!quiet) { try { io.sendTv(L.far, { k: 'tv', q: 'x', l: L.l }); } catch (e) {} }
      log('turn-link closed ' + short(L.far) + ' ' + why);
      try { io.drop(L.far, why); } catch (e) {}
      try { io.publish({ id: L.id, a: L.opener ? io.me() : L.far, b: L.opener ? L.far : io.me(), up: 0, v: 0, gone: 1 }); } catch (e) {}
      try { io.changed(L.far); } catch (e) {}
    }
    const fresh = (L) => !!(L.mine && L.peer && L.mine.e - io.now() > 0 && L.peerE - io.now() > 0);
    function sendAsk(L) { L.sentAt = io.now(); io.sendTv(L.far, { k: 'tv', q: 'a', l: L.l, d: io.dev(), b: io.blocked() ? 1 : 0 }); }
    function askMine(L) { if (!L.farDev) return; L.vAskAt = io.now(); io.askVouch(L.farDev, L.l); }
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
      if (pool === 'free') {
        if (k === 'ok' && !L.readyMe) { L.readyMe = true; io.reset(L.far); io.sendTv(L.far, { k: 'tv', q: 'r', l: L.l }); maybeDial(L); }
        else if (k === 'renewed' && !L.paidMe) io.restart(L.far, L.l);
        else if (k === 'expired' && !L.paidMe) close(L, 'expired');
      } else {
        if (k === 'ok' || k === 'renewed') { const was = L.paidMe; L.paidMe = true; io.restart(L.far, L.l); if (!was) io.sendTv(L.far, { k: 'tv', q: 'p', l: L.l, b: 1 }); }
        else if (k === 'expired') { L.paidMe = false; io.restart(L.far, L.l); io.sendTv(L.far, { k: 'tv', q: 'p', l: L.l, b: 0 }); }
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
    function maybeDial(L) {
      if (!L.opener || !L.readyMe || !L.readyFar || L.dialAt) return;
      L.dialAt = io.now(); L.state = 'dial';
      log('turn-dial ' + short(L.far) + ' client=' + (L.client ? 1 : 0));
      io.dial(L.far);
    }

    // A `tv` frame from the far end (relay, or the pair's own channel once open).
    function onFrame(from, f) {
      if (!tvOk(f) || from === io.me()) return;
      let L = links.get(from);
      if (L) L.heardAt = io.now();
      if (f.q === 'x') { if (L && L.l === f.l) close(L, 'far-closed', true); return; }
      if (f.q === 'a') {
        if (!L) {
          const s = io.seat();
          if (!s || !s.greeter) return;                       // only a seated greeter can be vouched for: say nothing
          if (s.view.indexOf(from) >= 0 && io.reach(from) === 'direct') return;   // reached already: no link
          L = newLink(from, f.l, false); L.heardAt = io.now();
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
        L.peer = vouchToken(io.sid(), L.farDev, io.dev(), L.l, e, f.n, f.m); L.peerE = e;
        if (L.mine) haveBoth(L);
        return;
      }
      if (f.q === 'r') { L.readyFar = true; maybeDial(L); return; }
      // the far end moved its pool: it moves the pc itself (its own restart, or 'i' to the offerer), so no restart here:
      // a second one per move restarted the path again mid-move and the video's estimate with it (vouched one-way, 2026-11-12)
      if (f.q === 'p') { L.paidFar = f.b === 1; io.changed(L.far); return; }
      if (f.q === 'i') { io.restart(L.far, L.l); return; }
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
      if (on) { L.offSince = 0; return; }
      if (!L.offSince) { L.offSince = now; return; }
      if (now - L.offSince >= RESEND_MS && now - (L.offFixAt || 0) >= RESEND_MS) { L.offFixAt = now; log('turn-pool off its settings ' + short(L.far) + ' (rides ' + server + '): restart'); io.restart(L.far, L.l); }
    }
    function configOf(L) {
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
        if (L.state !== 'up') continue;
        const yes = want.has(L.id);
        if (yes) { L.vouched = true; L.lostAt = -1; }
        else if (L.vouched) { if (L.lostAt < 0) L.lostAt = now; if (now - L.lostAt >= GRACE_MS) { L.vouched = false; L.lostAt = -1; } }
        // A vouched client end moves to the paid pool; an end back on free leaves it.
        if (L.vouched && L.client && !L.paid) { L.paid = credFor(L, 'paid'); L.paid.start(); }
        if (!L.vouched && L.paid) { try { L.paid.stop(); } catch (e) {} L.paid = null; if (L.paidMe) { L.paidMe = false; io.restart(L.far, L.l); io.sendTv(L.far, { k: 'tv', q: 'p', l: L.l, b: 0 }); } }
        if (L.vouched && !L.client && !L.paidMe) { L.paidMe = true; io.sendTv(L.far, { k: 'tv', q: 'p', l: L.l, b: 1 }); }
        if (!L.vouched && !L.client && L.paidMe) { L.paidMe = false; io.sendTv(L.far, { k: 'tv', q: 'p', l: L.l, b: 0 }); }
        const v = L.vouched && L.paidMe && L.paidFar;
        if (v !== L.video) { L.video = v; L.ts = null; log('turn-video ' + short(L.far) + ' ' + (v ? 'on' : 'off')); if (!v) setThrottle(L, null); io.changed(L.far); }
      }
    }
    function factOf(L) {
      const s = io.seat();
      return { id: L.id, a: L.opener ? io.me() : L.far, b: L.opener ? L.far : io.me(), up: L.state === 'up' ? 1 : 0, v: L.video ? 1 : 0,
        s: L.serial || 0, c: s ? s.cell : 0, g: 0, [L.opener ? 'va' : 'vb']: L.side.slice(0, SIDE_MAX) };
    }

    function step() {
      const now = io.now();
      for (const L of Array.from(links.values())) {
        // TURN.8: the far page is gone. A far end my seat does not know yet (a foreign greeter, its door entry stale here)
        // is alive while it keeps answering this link's handshake.
        if (!io.alive(L.far) && now - (L.heardAt || L.askAt) > DIAL_BUDGET_MS / 2) { close(L, 'gone', true); continue; }
        if (L.state === 'up' && io.reach(L.far) === 'friend') { close(L, 'healed'); continue; }          // TURN.7
        if (L.state !== 'up' && now - L.askAt > DIAL_BUDGET_MS) { if (L.opener) head.retryAt = now + RETRY_MS; close(L, 'dialfail'); continue; }
        if (L.state === 'up' && !io.pcUp(L.far)) { if (!L.downSince) L.downSince = now; if (now - L.downSince > DIAL_BUDGET_MS) { if (L.opener) head.retryAt = now + RETRY_MS; close(L, 'lost'); continue; } }
        else L.downSince = 0;
        if ((L.state === 'ask' || (L.state === 'swap' && !L.peer)) && now - L.sentAt > RESEND_MS && (L.opener || L.farDev)) sendAsk(L);
        // my vouch is re-made once half its life is gone (the far end does the same), so a renewal always has fresh ones
        if (L.farDev && now - L.vAskAt > RESEND_MS && (!L.mine || now - L.mine.at > (L.mine.e - L.mine.at) / 2)) askMine(L);
        if (L.state !== 'up' && L.readyMe && L.readyFar && io.pcUp(L.far)) { L.state = 'up'; L.upAt = now; L.serial = now; log('turn-link up ' + short(L.far)); io.changed(L.far); }
        if (L.state === 'up' || L.state === 'dial') io.keep(L.far);
        if (L.state === 'up') {   // my side grows with the people I reach directly
          const s = io.seat();
          if (s) for (const x of s.view) if (x !== L.far && L.side.indexOf(x) < 0 && L.side.length < SIDE_MAX && io.reach(x) === 'direct') L.side.push(x);
        }
      }
      planVideo(now);
      // THE HEAD (TURN.1-5): one link per part, toward the lower part, after TURN_WAIT.
      const s = io.seat();
      if (s && s.head) {
        const view = new Set(s.view);
        const F = []; let direct = false, fr = false;
        for (const g of io.greeters() || []) {
          if (!g || g === io.me() || view.has(g)) continue;
          const r = io.reach(g);
          if (r === 'direct') { direct = true; continue; }
          if (r === 'friend') { fr = true; continue; }
          F.push(g);
        }
        // TURN.15.4: no second link between two parts. A link whose far end is me or sits in my view already joins
        // its opener's part to mine: I never ask its opener, nor anyone its opener reaches directly (its side).
        if (F.length) {
          const theirs = new Set();
          for (const L of links.values()) if (!L.opener) theirs.add(L.far);
          for (const f of io.facts() || []) if (f && !f.gone && (f.b === io.me() || view.has(f.b))) { theirs.add(f.a); for (const x of f.va || []) theirs.add(x); }
          if (theirs.size) for (let i = F.length - 1; i >= 0; i--) if (theirs.has(F[i])) F.splice(i, 1);
        }
        head.F = F.map(short); head.n = (io.greeters() || []).length;
        if (direct || fr) { head.skip = direct ? 'direct' : 'friend'; head.since = -1; head.seen.clear(); }
        else if (!F.length) { head.since = -1; head.seen.clear(); }
        else {
          head.skip = '';
          if (head.since < 0) head.since = now;
          // TURN.15.2: a link up for the span of one merge whose two ends both sit in my part joins nothing new: it is
          // not this part's link out, and a third part of the meeting may still need one.
          const mine = (x) => x === io.me() || view.has(x);
          const inside = (a, b, upAt) => upAt > 0 && now - upAt >= MERGE_MS && mine(a) && mine(b);
          let has = false;
          for (const L of links.values()) if ((L.opener || view.has(L.far)) && !inside(io.me(), L.far, L.state === 'up' ? L.upAt : -1)) { has = true; break; }
          for (const f of io.facts() || []) if (f && !f.gone && f.up && mine(f.a) && !inside(f.a, f.b, f.s || -1)) { has = true; break; }
          if (!has && turnWaited(now, F) && now >= head.retryAt) {
            // TURN.15.1: which part is "the lower" must read the same from both sides, so a part's place in the order is
            // its lowest greeter on the door's list (the one thing both heads read), or me: never the lowest id of my view.
            let myMin = io.nid(io.me()); for (const g of io.greeters() || []) { if (!g || g === io.me() || !view.has(g)) continue; const n = io.nid(g); if (n >= 0 && n < myMin) myMin = n; }
            const byNid = new Map(); for (const g of F) byNid.set(io.nid(g), g);
            // The older part stays: I ask toward the oldest part I cannot reach, and only if it is older than mine. The
            // door's list says when each greeter's part was founded; with no such word the lower id decides, as before.
            const epOf = (n) => { const g = byNid.get(n), e = (g && io.epoch) ? io.epoch(g) : -1; return Number.isInteger(e) ? e : -1; };
            const pick = T.turnPick52(Array.from(byNid.keys()), epOf, myMin, io.myEpoch ? io.myEpoch() : -1);
            if (pick >= 0) {
              const g = byNid.get(pick);
              const L = newLink(g, linkName(io.me(), g, K.TURN_FREE_LINKS), true);
              head.retryAt = now + RETRY_MS;
              sendAsk(L);
            }
          }
        }
      }
      if (now - lastFactAt >= FACT_EVERY_MS) {
        lastFactAt = now;
        for (const L of links.values()) if (L.state === 'up') io.publish(factOf(L));
      }
    }

    return {
      step, onFrame, onVouch, onCapacity, onPath, onServer,
      // The connection settings of this pair: null for a pair that is no TURN link, or whose end here is no client.
      config(pid) {
        const L = links.get(pid);
        if (!L || !L.client) return null;
        return configOf(L);
      },
      factStaleMs: FACT_STALE_MS,
      holds(pid) { const L = links.get(pid); return !!L && L.state !== 'closed'; },
      isLink(pid) { const L = links.get(pid); return !!L && (L.state === 'up' || L.state === 'dial'); },
      holding() { return holding(io.now()); },   // TURN.4.4
      videoBlocked(pid) { const L = links.get(pid); return !!L && (!L.video || L.busy); },
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
          vouched: L.vouched, video: L.video, upAt: L.upAt, side: L.side.length,
          step: L.thr ? L.thr.step : null, cap: L.cap || null, busy: L.busy, farBusy: L.farBusy, standbyN: L.standbyN, lastSwitchMs: L.lastSwitchMs || null });
        return { links: out, head: Object.assign({}, head, { seen: Array.from(head.seen.entries()).map(([g, t]) => [short(g), t]) }) };
      },
    };
  }

  const api = {
    DEFAULT_WORKER, WORKER_KEY, FETCH_TIMEOUT_MS, RETRY_BASE_MS, RETRY_MAX_MS, SIDE_MAX, STANDBY_SWITCH_MS, THROTTLE_LOOK_MS, THROTTLE_UP_MS,
    THROTTLE_STEPS, throttlePlan, throttleNext, stepOf,
    retryDelayMs, parseIce, hasTurnServer, workerBase, askIce, createCredentials,
    vouchToken, vouchParts, tvOk, TV_KEYS, linkName, linkId, clientEnd, pausedBy, vouchPlan, createLinks,
  };
  GifOS.meetTurn = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
