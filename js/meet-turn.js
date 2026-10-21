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
 *   - One bridge per blocked network (networkBridge). People on one network
 *     reach each other directly; only one of them uses the pool for the
 *     whole network and sends its anchor the network's voices, and the
 *     others hear the room through it. A room of S networks that cannot
 *     reach each other holds at most S-1 TURN links.
 *   - Off the join path. Credentials are asked for after joining, and only
 *     once a pair has failed its direct path (poolNeeded); an error, a
 *     timeout or an "unavailable" answer all mean "no TURN", and the meeting
 *     runs as it does without it.
 *
 * Everything here is a pure decision or a small state machine with its clock
 * and network passed in, so it runs the same in a page and in Node.
 */
(function (root) {
  'use strict';

  const ICE_URL = 'https://turn.gifos.app/v1/ice';
  const DEFAULT_WORKER = 'https://turn.gifos.app';
  const WORKER_KEY = 'gifos_turn_worker'; // localStorage override: a self-hosted or local credential service
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

  // poolNeeded(stages, invited) → may a blocked page ask the pool now?
  // stages: pairStage of each pair it links to; invited: a peer dialled it
  // through TURN. Only once a pair has failed its direct path (stage
  // 'friend' or 'turn'): people on one blocked network reach each other
  // directly, so a meeting held inside it (S = 1, an all-hands of 1,000 in
  // one company) asks for no credential at all.
  function poolNeeded(stages, invited) {
    if (invited) return true;
    for (const s of stages || []) if (s === 'friend' || s === 'turn') return true;
    return false;
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

  // networkBridge(f) → { bridge, bridges } for a page whose own network
  // blocks direct connections: bridge is the one page on my network (the
  // blocked pages I reach directly, through each other) that may use the
  // free pool for it; bridges holds the bridge of every blocked network this
  // page knows of. f = { me, ids, blocked(id), conns(id), turn(id), holds(id) }
  //   ids      every page this page knows (me included)
  //   blocked  that page's own network blocks direct connections
  //   conns    the pages it is connected to (gossiped; TURN pairs included)
  //   turn     the pages it holds a TURN pair with (gossiped), whose link is
  //            not a direct one and so does not join two networks
  //   holds    that page bridges its network now (gossiped)
  // The bridge is the lowest id among the network's pages that bridge it
  // now, else its lowest id: a page joining later never takes the role from
  // a working bridge, and when the bridge leaves the next one takes over on
  // its own, with no message.
  // bridgeOf maps every blocked page this view knows to that page's bridge,
  // so one pass answers every page that shares the view.
  function bridgeComponents(f) {
    const ids = (f && f.ids) || [];
    const blocked = (id) => !!(f.blocked && f.blocked(id));
    const list = (fn, id) => { const v = fn ? fn(id) : null; return Array.isArray(v) ? v : []; };
    const known = new Set(ids.filter(blocked));
    const turnOf = new Map(); for (const id of known) turnOf.set(id, new Set(list(f.turn, id)));
    const nbrs = new Map(); for (const id of known) nbrs.set(id, new Set());
    for (const a of known) for (const b of list(f.conns, a)) {
      if (b === a || !known.has(b)) continue;
      if (turnOf.get(a).has(b) || turnOf.get(b).has(a)) continue; // a TURN pair joins no networks
      nbrs.get(a).add(b); nbrs.get(b).add(a);
    }
    const lower = (a, b) => (String(a) < String(b) ? a : b);
    const seen = new Set(), bridges = new Set(), bridgeOf = new Map();
    let bridge = null;
    for (const start of known) {
      if (seen.has(start)) continue;
      const group = [start]; seen.add(start);
      for (let i = 0; i < group.length; i++) for (const nb of nbrs.get(group[i])) if (!seen.has(nb)) { seen.add(nb); group.push(nb); }
      let low = null, lowLinked = null;
      for (const id of group) { low = low == null ? id : lower(low, id); if (f.holds && f.holds(id)) lowLinked = lowLinked == null ? id : lower(lowLinked, id); }
      const b = lowLinked != null ? lowLinked : low;
      bridges.add(b);
      for (const id of group) bridgeOf.set(id, b);
      if (bridge == null && group.includes(f.me)) bridge = b;
    }
    return { bridge, bridges, bridgeOf };
  }

  function networkBridge(f) {
    const all = bridgeComponents(f);
    return { bridge: all.bridge, bridges: all.bridges };
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

  // mixGain(held, mutedFor, carries) → a source's gain in a mix the page
  // sends: 0 for a voice held for everyone, and 0 for a person whose own
  // status says muted once MUTE_TAIL_MS has passed (their last words still
  // play out). A muted microphone can still carry a floor of noise one step
  // above zero; mixed in, that floor keeps the encoder from ever seeing
  // silence, so DTX never starts. mutedFor is how long (ms) the person has
  // been muted, or null. A source that carries other people's voices
  // (carries: see carriesMix) is not silenced by its carrier's own mute: the
  // carrier's muted microphone is already silence in the mix it sends, and
  // the voices it carries are not muted.
  const MUTE_TAIL_MS = 1000;
  function mixGain(held, mutedFor, carries) {
    if (held) return 0;
    if (carries) return 1;
    return mutedFor != null && mutedFor >= MUTE_TAIL_MS ? 0 : 1;
  }

  // carriesMix(me, o) → does the one audio stream a person sends me carry
  // other people's voices, not only their microphone? It does when they are
  // my anchor (my mix-minus), my client with anyone else on its network (its
  // network's uplink), or hold a TURN link to anyone but me (a bridge end's
  // feed of the far network to its row). o: { myAnchor, myClient, conns
  // (their direct pairs), tl (their TURN links, from their status) }.
  function carriesMix(me, o) {
    if (!o) return false;
    if (o.myAnchor) return true;
    if ((o.tl || []).some((x) => x !== me)) return true;
    return !!o.myClient && (o.conns || []).some((x) => x !== me);
  }

  // mayServe(servedCount, alreadyServing) → may this page become one more
  // TURN client's anchor? One session per person served, at most MAX_SERVED.
  function mayServe(servedCount, alreadyServing) {
    return !!alreadyServing || (servedCount || 0) < MAX_SERVED;
  }

  // ---- the smallest pipe: codec settings for a free-pool voice stream -----
  // Opus, mono, 16 kbps target, DTX (silence suppression) on, 60 ms packets
  // where the browser allows it (else its 20 ms): fewer packets, less header
  // overhead. Free-pool pairs only: never a direct pair, never a paid Video
  // Anywhere pair (the page decides which).
  const T_AUDIO = { bitrate: 16000, ptime: 60 };

  // turnAudioSdp(sdp) → the description with every Opus line in an audio
  // section set to the free-pool settings. The fmtp a browser receives sets its
  // own encoder: stereo=0 (mono), usedtx=1 (DTX), maxaveragebitrate (the
  // target); a=ptime asks for 60 ms packets. Other codecs, other sections and
  // the description's line ending are kept. Applying it twice changes nothing.
  function turnAudioSdp(sdp) {
    if (typeof sdp !== 'string' || !sdp) return sdp;
    const eol = sdp.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
    const parts = sdp.split(eol === '\r\n' ? /(?=\r\nm=)/ : /(?=\nm=)/);
    return parts.map((sec) => {
      if (!/^(\r?\n)?m=audio /.test(sec)) return sec;
      const lines = sec.split(eol);
      const pts = [];
      for (const l of lines) { const m = /^a=rtpmap:(\d+) opus\/48000/i.exec(l); if (m) pts.push(m[1]); }
      if (!pts.length) return sec;
      const want = { stereo: '0', 'sprop-stereo': '0', usedtx: '1', maxaveragebitrate: String(T_AUDIO.bitrate) };
      const out = [];
      for (const l of lines) {
        if (/^a=(max)?ptime:/.test(l)) continue;
        const f = /^a=fmtp:(\d+) (.*)$/.exec(l);
        if (f && pts.includes(f[1])) {
          const kv = []; const seen = new Set();
          for (const it of f[2].split(';')) {
            const t = it.trim(); if (!t) continue;
            const i = t.indexOf('='); const k = (i < 0 ? t : t.slice(0, i)).trim();
            if (Object.prototype.hasOwnProperty.call(want, k)) { kv.push(k + '=' + want[k]); seen.add(k); } else kv.push(t);
          }
          for (const k of Object.keys(want)) if (!seen.has(k)) kv.push(k + '=' + want[k]);
          out.push('a=fmtp:' + f[1] + ' ' + kv.join(';'));
          continue;
        }
        out.push(l);
        const r = /^a=rtpmap:(\d+) opus\/48000/i.exec(l);
        if (r && !lines.some((x) => x.indexOf('a=fmtp:' + r[1] + ' ') === 0)) out.push('a=fmtp:' + r[1] + ' ' + Object.keys(want).map((k) => k + '=' + want[k]).join(';'));
      }
      // a=ptime goes last in the section's attributes (before a trailing empty line)
      let end = out.length; while (end > 0 && out[end - 1] === '') end--;
      out.splice(end, 0, 'a=ptime:' + T_AUDIO.ptime);
      return out.join(eol);
    }).join('');
  }

  // turnVoiceParams(prm, on) → the sender parameters to set on a pair's voice
  // sender, or null when nothing must change: on a free-pool pair the one
  // encoding is capped at the target; off it, a cap this rule set is lifted.
  // A sender with no negotiated encoding is left alone (setting one then
  // crashes Chromium's renderer; the next pass catches it).
  function turnVoiceParams(prm, on) {
    if (!prm || !prm.encodings || !prm.encodings.length) return null;
    const e0 = prm.encodings[0];
    if (on) { if (e0.maxBitrate === T_AUDIO.bitrate) return null; e0.maxBitrate = T_AUDIO.bitrate; return prm; }
    if (e0.maxBitrate !== T_AUDIO.bitrate) return null;
    delete e0.maxBitrate;
    return prm;
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

  // createCredentials(o) → the credential client.
  // o = { ask(body) → Promise<json>, room, now(), setTimer(fn, ms) → handle,
  //       clearTimer(handle), random(), onChange(kind),
  //       pool, extra(), halts(reason) }
  // pool    the pool asked for ('free' when absent).
  // extra   () → more fields for every ask (the paid pool's receipt, room
  //         ticket and bridge; the free pool's TURN ticket, freeTicket), read
  //         at each ask so a re-signed ticket rides the next renewal; null
  //         means "nothing to ask with": no grant. May be a promise.
  // granted (fields) → called on each grant with the extra fields its ask
  //         carried (freeTicket counts a ticket's slots with it).
  // halts   (reason) → true when an "unavailable" answer with that reason
  //         means asking again cannot help. The client then stops asking;
  //         a grant in hand still runs to its expiry.
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
    let halted = false, refusal = null;
    const pool = o.pool || POOL;
    let tNext = null, tExpire = null;
    function clearNext() { if (tNext != null) { clearTimer(tNext); tNext = null; } }
    function schedule(ms) { clearNext(); tNext = setTimer(() => { tNext = null; ask(); }, Math.max(0, ms)); }
    function ask() {
      if (stopped || inFlight || halted) return;
      inFlight = true;
      const renew = !!grant;
      let settled = false, tOut = null, asked = null;
      const done = (body) => {
        if (settled) return;
        settled = true; inFlight = false;
        if (tOut != null) clearTimer(tOut);
        if (stopped) return;
        answered = true;
        const g = parseIce(body);
        if (!g) {
          refusal = body && typeof body === 'object' && body.unavailable ? String(body.unavailable).slice(0, 40) : null;
          failures++;
          if (refusal && o.halts && o.halts(refusal)) { halted = true; clearNext(); return; }
          schedule(retryDelayMs(failures, random()));
          return;
        }
        failures = 0; refusal = null;
        const t = now();
        const had = !!grant;
        grant = { iceServers: g.iceServers, issuedAt: t, renewAt: t + g.renewAfter * 1000, expiresAt: t + g.ttl * 1000 };
        everHad = true;
        if (o.granted) { try { o.granted(asked); } catch (e) {} }
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
      try {
        const go = (more) => {
          if (more == null || stopped || settled) return null;
          asked = more;
          return o.ask(Object.assign({ room: String(o.room), pool }, renew ? { renew: true } : {}, more));
        };
        const more = o.extra ? o.extra() : {};
        // A plain answer asks at once; a promise (a ticket being fetched) first.
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
      refusal() { return refusal; },  // the last "unavailable" reason, cleared by a grant
      halted() { return halted; },    // stopped asking after a refusal that asking again cannot help
    };
  }

  // THE FREE POOL'S TICKET (workers turnstile; gifos docs/relay-lockdown.md
  // "Free TURN tickets"). The credential service hands free credentials only
  // to a ticket from the relay's person check: the tt the relay's /t mint
  // returned beside the join token, or, once the room handed a rejoin token,
  // a fresh one from the relay's GET /tt (a reload, a renewal). A ticket has
  // TICKET_CREDS slots and each slot names ONE credential (asking a slot
  // again returns the same one), so the page spends them one grant at a
  // time: slot 0 first, the next slot after each grant on that ticket, and
  // no ask once they are spent (a /tt ticket keeps its slots for an hour).
  // freeTicket(getTicket) → { extra, granted } for createCredentials;
  // getTicket() → the ticket (or a promise of it), '' when the relay has
  // none: then the ask goes without one, as before tickets.
  const TICKET_CREDS = 3;
  function ticketNonce(tt) {
    try {
      const p = String(tt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return String(JSON.parse(atob(p + '='.repeat((4 - (p.length % 4)) % 4))).n || '');
    } catch (e) { return ''; }
  }
  function freeTicket(getTicket) {
    const used = new Map(); // ticket nonce → slots granted on it
    return {
      extra() {
        return Promise.resolve().then(() => (getTicket ? getTicket() : '')).catch(() => '').then((tt) => {
          if (!tt || typeof tt !== 'string') return {};
          const slot = used.get(ticketNonce(tt)) || 0;
          return slot >= TICKET_CREDS ? null : { tt, slot };
        });
      },
      granted(more) {
        if (!more || !more.tt) return;
        const n = ticketNonce(more.tt), had = used.get(n) || 0;
        used.delete(n); // re-insert: the newest nonce is last, the oldest goes first
        used.set(n, Math.max(had, (more.slot | 0) + 1));
        while (used.size > 8) used.delete(used.keys().next().value);
      },
    };
  }

  // askIce(fetchFn, url) → ask(body): the page's network call. The Origin
  // header is the browser's own; no credential or cookie rides it. The body
  // is JSON sent as plain text, which makes it a simple cross-origin request:
  // no preflight, so one round trip instead of two.
  function askIce(fetchFn, url) {
    return (body) => fetchFn(url || workerBase() + '/v1/ice', {
      method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body),
      credentials: 'omit', cache: 'no-store', mode: 'cors',
    }).then((r) => r.json()).catch(() => null);
  }

  const api = {
    ICE_URL, DEFAULT_WORKER, WORKER_KEY, workerBase, POOL, FETCH_TIMEOUT_MS, RETRY_MAX_MS, P0_MS, P1_MS, MAX_SERVED,
    T_AUDIO, turnAudioSdp, turnVoiceParams,
    reachable, pairStage, poolNeeded, pairUsesTurn, iceServersFor, hasTurnServer, chooseAnchor, mixMinus, MUTE_TAIL_MS, mixGain, carriesMix, mayServe, networkBridge, bridgeComponents,
    retryDelayMs, parseIce, createCredentials, askIce, freeTicket, TICKET_CREDS,
  };
  const GifOS = (root.GifOS = root.GifOS || {});
  GifOS.meetTurn = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
