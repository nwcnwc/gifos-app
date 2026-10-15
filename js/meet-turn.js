/*
 * meet-turn.js — when a meeting may use a GifOS TURN server, and how little.
 *
 * Most meetings never touch a server: media goes browser to browser (a direct
 * path), and a pair that cannot connect directly is carried by a third person
 * who reaches both (a friend). Only when BOTH have failed for a pair may the
 * page use the free audio pool, and then on the smallest pipe:
 *
 *   - Last resort. A pair tries the direct path, then a friend, before TURN.
 *   - One end only. The page that cannot be reached directly is the TURN
 *     client; a page that can be reached never puts a TURN server in that
 *     pair's connection settings. Both ends use TURN only when neither can be
 *     reached.
 *   - Audio only. A free-pool pair carries no video.
 *   - One anchor. A TURN client sends its voice once, to one anchor, and
 *     receives one stream back: everything the anchor hears, minus the
 *     client's own voice.
 *   - Off the join path. Credentials are asked for after joining; an error, a
 *     timeout or an "unavailable" answer all mean "no TURN", and the meeting
 *     runs as it does without it.
 *
 * Everything here is a pure decision or a small state machine with its clock
 * and network passed in, so it runs the same in a page and in Node.
 */
(function (root) {
  'use strict';

  const ICE_URL = 'https://turn.gifos.app/v1/ice';
  const POOL = 'free';
  const FETCH_TIMEOUT_MS = 3000;      // a credential answer slower than this is no answer
  const RETRY_BASE_MS = 2000;         // first retry after about 2 s, doubling
  const RETRY_MAX_MS = 5 * 60 * 1000; // never wait longer than 5 minutes between tries
  const P0_MS = 12000;                // a direct path gets this long (ICE restart included)
  const P1_MS = 30000;                // a friend gets until here, when one exists
  const MAX_SERVED = 9;               // TURN clients one anchor carries at once

  const reachable = (verdict) => verdict === 'ok';

  // pairStage(f) → 'up' | 'direct' | 'friend' | 'turn'
  // f = { connected, relayed, downMs, friendPath }
  //   up      the pair works, directly or through a friend
  //   direct  still inside the direct path's time
  //   friend  a friend could carry it and still has time
  //   turn    both have failed: TURN is allowed for this pair
  function pairStage(f) {
    if (!f) return 'direct';
    if (f.connected || f.relayed) return 'up';
    const down = Number(f.downMs) || 0;
    if (down < P0_MS) return 'direct';
    if (f.friendPath && down < P1_MS) return 'friend';
    return 'turn';
  }

  // pairUsesTurn(f) → true when this page may put TURN servers in this
  // pair's connection settings. f = { mine, anchor, invited, haveServers }
  //   mine     this page's own reachability verdict ('ok' | 'blocked' | …)
  //   anchor   this pair is the anchor this page chose
  //   invited  the far end dialled this pair through TURN
  // A reachable page answers false whatever else is true: it keeps every
  // pair free of TURN, so a pair is never relayed at both ends when one end
  // could be reached.
  function pairUsesTurn(f) {
    if (!f || !f.haveServers) return false;
    if (f.mine !== 'blocked') return false; // 'ok' is reachable; 'pending' and 'unknown' have no verdict to act on
    return !!(f.anchor || f.invited);
  }

  // iceServersFor(base, turnServers, useTurn) → the list a connection is
  // built with: the direct-path servers always, the TURN servers only when
  // pairUsesTurn said so.
  function iceServersFor(base, turnServers, useTurn) {
    const out = (base || []).slice();
    if (useTurn && Array.isArray(turnServers)) for (const s of turnServers) out.push(s);
    return out;
  }

  // hasTurnServer(list) → does a connection setting name any TURN server?
  function hasTurnServer(list) {
    for (const s of list || []) {
      const urls = Array.isArray(s && s.urls) ? s.urls : [s && s.urls];
      for (const u of urls) if (/^turns?:/i.test(String(u || ''))) return true;
    }
    return false;
  }

  // chooseAnchor(cands, current, now) → peer id or null.
  // cands: [{ id, stage, reachable, links, deadUntil }]
  //   stage      pairStage of this pair
  //   reachable  the far page's own verdict: true, false, or null (unknown)
  //   links      its count of live direct links, or null when unknown
  //   deadUntil  an anchor that failed is not chosen again before this time
  // The current anchor stays while it is still a candidate (a stable anchor
  // keeps one session). Otherwise: a reachable page first, then an unknown
  // one, then a blocked one; more live direct links first; then the
  // smaller id, so every page that applies the rule picks the same seat.
  function chooseAnchor(cands, current, now) {
    const t = now || 0;
    const list = (cands || []).filter((c) => c && c.id != null && !(c.deadUntil && c.deadUntil > t));
    if (current != null && list.some((c) => c.id === current)) return current;
    const pool = list.filter((c) => c.stage === 'turn');
    if (!pool.length) return null;
    const rank = (c) => (c.reachable === true ? 0 : c.reachable == null ? 1 : 2);
    pool.sort((a, b) => rank(a) - rank(b)
      || ((b.links || 0) - (a.links || 0))
      || (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
    return pool[0].id;
  }

  // mixMinus(sources, clientId, direct) → the sources an anchor mixes for one
  // TURN client: everything it hears, minus that client's own voice, and
  // minus anyone the client already hears over a direct path of its own
  // (direct: their ids), so nobody reaches the client twice.
  // sources: [{ key, owner }] (owner is whose voice it is; null for a mix
  // of several people that never contains the client).
  function mixMinus(sources, clientId, direct) {
    const skip = new Set(direct || []);
    return (sources || []).filter((s) => s && s.owner !== clientId && !(s.owner != null && skip.has(s.owner)));
  }

  // mayServe(servedCount, alreadyServing) → may this page become one more
  // TURN client's anchor? One session per person served, at most MAX_SERVED.
  function mayServe(servedCount, alreadyServing) {
    return !!alreadyServing || (servedCount || 0) < MAX_SERVED;
  }

  // ---- credentials ---------------------------------------------------------

  // retryDelayMs(attempt, rand) → wait before try number `attempt + 1`
  // (attempt counts failures so far, from 1). Doubles from about 2 s, with
  // jitter (rand in [0,1) scales it by 0.5 to 1.5) so a room that lost the
  // service together does not ask again together; never above 5 minutes.
  function retryDelayMs(attempt, rand) {
    const n = Math.max(1, Math.floor(attempt || 1));
    const base = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, Math.min(n - 1, 20)));
    const r = typeof rand === 'number' && rand >= 0 && rand < 1 ? rand : 0.5;
    return Math.min(RETRY_MAX_MS, Math.round(base * (0.5 + r)));
  }

  // parseIce(body) → { iceServers, ttl, renewAfter } or null. Anything that is
  // not a well-formed grant (an "unavailable" answer included) is null.
  function parseIce(body) {
    if (!body || typeof body !== 'object' || body.unavailable) return null;
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
    if (!(renewAfter > 0 && renewAfter < ttl)) renewAfter = Math.floor(ttl * 0.9);
    return { iceServers: servers, ttl, renewAfter };
  }

  // createCredentials(o) → the credential client.
  // o = { ask(body) → Promise<json>, room, now(), setTimer(fn, ms) → handle,
  //       clearTimer(handle), random(), onChange(kind) }
  // onChange kinds: 'ok' (first grant, or a grant after losing one), 'renewed'
  // (a fresh grant replaced a live one: restart the TURN pairs on it),
  // 'expired' (the grant ran out with no renewal: TURN pairs fall back).
  // state(): 'idle' (not started), 'pending' (asking, never answered yet),
  // 'ok', 'down' (never got a grant), 'lost' (had one, it expired).
  function createCredentials(o) {
    const now = o.now || (() => Date.now());
    const setTimer = o.setTimer || ((fn, ms) => setTimeout(fn, ms));
    const clearTimer = o.clearTimer || ((h) => clearTimeout(h));
    const random = o.random || Math.random;
    const onChange = o.onChange || (() => {});
    let started = false, stopped = false, inFlight = false;
    let grant = null;          // { iceServers, issuedAt, renewAt, expiresAt }
    let everHad = false, failures = 0, answered = false;
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
        if (!g) { failures++; schedule(retryDelayMs(failures, random())); return; }
        failures = 0;
        const t = now();
        const had = !!grant;
        grant = { iceServers: g.iceServers, issuedAt: t, renewAt: t + g.renewAfter * 1000, expiresAt: t + g.ttl * 1000 };
        everHad = true;
        schedule(grant.renewAt - t);
        if (tExpire != null) clearTimer(tExpire);
        const mine = grant;
        tExpire = setTimer(() => {
          tExpire = null;
          if (grant !== mine) return;
          grant = null; // running sessions end here; the retries below keep asking
          onChange('expired');
        }, mine.expiresAt - t);
        onChange(had ? 'renewed' : 'ok');
      };
      tOut = setTimer(() => { tOut = null; done(null); }, FETCH_TIMEOUT_MS);
      let p;
      try { p = Promise.resolve(o.ask(Object.assign({ room: String(o.room), pool: POOL }, renew ? { renew: true } : {}))); }
      catch (e) { p = Promise.resolve(null); }
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
    };
  }

  // askIce(fetchFn, url) → ask(body): the page's network call. The Origin
  // header is the browser's own; no credential or cookie rides it. The body
  // is JSON sent as plain text, which makes it a simple cross-origin request:
  // no preflight, so one round trip instead of two.
  function askIce(fetchFn, url) {
    return (body) => fetchFn(url || ICE_URL, {
      method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body),
      credentials: 'omit', cache: 'no-store', mode: 'cors',
    }).then((r) => r.json()).catch(() => null);
  }

  const api = {
    ICE_URL, POOL, FETCH_TIMEOUT_MS, RETRY_MAX_MS, P0_MS, P1_MS, MAX_SERVED,
    reachable, pairStage, pairUsesTurn, iceServersFor, hasTurnServer, chooseAnchor, mixMinus, mayServe,
    retryDelayMs, parseIce, createCredentials, askIce,
  };
  const GifOS = (root.GifOS = root.GifOS || {});
  GifOS.meetTurn = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
