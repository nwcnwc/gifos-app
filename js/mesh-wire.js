/*
 * mesh-wire.js — binds the mesh control plane (js/mesh/: the ported 0.9.25 sim seat, behind
 * js/mesh/page/env.js, the seat's world on a page) to the REAL transports.
 * (Below: the relay socket and S4 notes; the seat itself is js/mesh/seat.js.)
 *
 * Formerly: binds the mesh control plane (mesh.js, the ported sim brain)
 * to the REAL transports. This is the layer run.html consumes: it owns the
 * relay socket (knock/greeters + sealed peer-message fallback) and prefers the
 * caller's DataChannel layer for seat-to-seat control traffic.
 *
 * The canonical TIME mapping: 1 tick = 500ms. All of mesh.js's timers are in
 * ticks, so phone-home = 8 ticks = the 4s HB pulse, heal fires at ~20s,
 * drain at ~40s, R6 strand at 250s. Tests shrink tickMs to run fast.
 *
 * Everything seat-to-seat is SEALED under the room key (deriveMeetKey — the
 * password is mixed in). The greeter address blob a Section-1 seat registers
 * is a real Seal(key, address) — address = {p: peerId, c: coord} — so a knocker
 * that opens it learns WHERE the greeter sits, not just who; a knocker that
 * can't decrypt any blob has the wrong password (R6) — surfaced via onLocked,
 * never sent to the relay.
 *
 * FOUNDING is decided by the relay's `founded` flag, not list emptiness: a
 * founder is admitted to the registry at KNOCK time but registers its sealed
 * address a beat later (sealing is async), so a second knocker in that gap
 * sees an EMPTY list with founded:false. Delivering that to the seat would
 * mint a SECOND founder — instead the wire holds it and the join loop retries.
 * (The sim's registry listed knocker IDS, so identity WAS the address and the
 * gap didn't exist; production separates them, so the flag closes it.)
 *
 * SOCKET LIFECYCLE (user decision): a seat holds a relay socket only while it
 * NEEDS the relay — joining (knock/greeters), or seated in Section 1 (E3
 * re-knock keeps it in the greeter pool). A DEEP-seated seat drops its socket
 * after a grace period (the relay session cap is C²+C: the greeter pool plus
 * knock churn, not the room); it is recreated on demand the moment the seat
 * needs the relay again (a knock, or a control send with no DataChannel).
 *
 * ── S4 PER-PARTICIPANT IDENTITY (healing-laws.md S4/S5, mesh-identity.js) ──────
 * The keypair is minted HERE, once, at join. Ed25519 verification is async
 * (WebCrypto) but mesh.js's verifyFill seam is synchronous and transport-
 * agnostic, so the wire is exactly where identity belongs — the same boundary
 * that already owns all sealing/transport:
 *   - MINT: on createMeshNode we mint a per-participant identity (unless the
 *     caller supplies opts.identity, or a legacy client-set opts.peer). The
 *     peer id is peer-id = H(pubkey) — retiring the client-set-id hole.
 * S4 is MANDATORY — there is no off switch: mesh-identity.js must be loaded
 * (hard fail otherwise), every node mints (or is handed) an identity, and
 * signing + verification are unconditional.
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};
  const TM = GifOS.timings || require('./timings.js');   // every wait and timeout: js/timings.js, loaded before this file (required where there is no page)
  const net = GifOS.net;

  // SIGNATURES (K1b, page-adapter.md 1.6): the SEAT says which frames are claimed (`sig`, `fsig`, `fo`); this table says
  // who signs each and what the signature covers. A forwarding seat rebuilds the Msg as the sim does, so a signature
  // covers only what the claimant authors and EVERY forwarder preserves; the wire carries the author's block with the
  // rebuilt frame (sigOf, by signed core). On receipt a claim stands only if the signature is good and its key's peer
  // id maps to the claimant; otherwise the claim is cleared and the frame still reaches the seat (the sim's receivers
  // decide what an unsigned frame may do).
  //   by    the field naming the signer
  //   only  rebuilt at every hop: sign only these
  //   relay rebuilt by a relaying seat (m.rl): the author signs the whole frame AND this form; a rebuilt frame verifies
  //         against this form and reaches the seat with nothing else the author could have said (RELAY_KEEP)
  //   none of these: forwarders clone it, so everything but the per-hop STAMPS is signed
  const CLAIMS = {
    HELLO: { by: 'id', stamps: ['c7Min', 'c7Held'] },   // emit's L8.5 stamps a HELLO at any hop
    CLAIM: { by: 'id' }, PHONE: { by: 'id' }, PONG: { by: 'id' }, TAKEN: { by: 'id' }, MOVED: { by: 'id' },
    YIELD: { by: 'id' }, CONFIRM: { by: 'id' }, WITNESS: { by: 'id' }, LGCOMP: { by: 'id' },
    PLACED: { by: 'l31By' },   // names the newcomer in id; signed by its placer (L31.4)
    LEAVE: { by: 'id', relay: ['ck', 'id', 'tn', 'mvd', 'bye', 'sigAt'] },   // byeRelay, l21Relay: only a plain goodbye (mvd 0) is relayed
    FIND: { by: 'nc', flag: 'fsig', only: ['nc'] },   // sh, sgw, gwc, spread, dk, ttl, late change per hop (L24)
    FINDLEAF: { by: 'fo', flag: 'fo', only: ['fo', 'foAt', 'hole'] },   // the decider's order (L25.7); ttl, nbrs, tag change down the cascade
    RECLAIM: { by: 'id', flag: 't' },   // L3.10: always claimed: the signature under m.id is the proof of identity (the seat's tok is the sim's stand-in, anyone can compute it)
  };
  const WIRE_VERSION = '0.9.25';   // sent as ?pv= on every relay socket (makeUrl): the relay's flag-day floor
  const FILL_WINDOW_MS = TM.FILL_WINDOW_MS;   // mesh-identity.js: a signature's time must lie this close to mine
  const REPLAY_MS = TM.REPLAY_MS;   // the seat's own goodbye window: 60 ticks (recv-seated.js)
  const BY_ID = { by: 'id' };   // a type no seat signs today: a claim on it still has to verify as m.id's whole frame
  // Per-hop fields, never signed: addressing, each holder's clock (recv.js CLOCKS moves vAt, born, e1At and the *L ticks),
  // the link's door bit, the route's own state and FARVIEW's first-emitter stamp.
  const STAMPS = ['to', 'from', 'ttl', 'rttl', 'rvia', 'lk', 'lkEp', 'tx', 'sigL', 'ppL', 'mpL', 'foL', 'l31L', 'swL', 'vAt', 'born', 'e1At',
    'direct', 'rl', 'yl', 'fhTo', 'fhOrig', 'fhTtl', 'fhId', 'fhTc', 'routing', 'rfinal', 'rdst', 'adoor', 'gwc', 'l18', 'dsat', 'aId', 'aCk', 'sgw', 'sgwCk'];
  // What a relayed goodbye may hold past its signed form: the relay's own marks and the heir hint byeRelay copies (L13.7),
  // which l21Relay drops and so no signature can cover. Anything else on an m.rl frame was not said by the leaver.
  const RELAY_KEEP = ['t', 'sig', 'rl', 'yl', 'child', 'kids', ...STAMPS];
  function claimRule(m) {
    if (m.sig) return CLAIMS[m.t] && !CLAIMS[m.t].flag ? CLAIMS[m.t] : BY_ID;
    const r = CLAIMS[m.t]; return r && r.flag && (r.flag === 'fo' ? m.fo >= 0 : m[r.flag]) ? r : null;
  }
  // -1: no claim. A frame that claims and names no signer is a failed claim (NOSIGNER), never a passed one.
  const NOSIGNER = -2;
  function claimOf(m) { const r = claimRule(m); if (!r) return -1; const c = m[r.by]; return c >= 0 ? c : NOSIGNER; }
  const pick = (o, keys) => { const out = { t: o.t }; for (const k of keys) if (o[k] !== undefined) out[k] = o[k]; return JSON.stringify(out); };
  function coreOf(msgM, m) {
    const r = claimRule(m), o = msgM.writeMsg(m);
    if (r && r.only) return pick(o, r.only);
    if (r && r.relay && m.rl) return pick(o, r.relay);
    for (const k of STAMPS) delete o[k];
    if (r && r.stamps) for (const k of r.stamps) delete o[k];
    return JSON.stringify(o);
  }
  // The form a relay would sign, for the author's second signature (null: this frame has none).
  function relayCoreOf(msgM, m) { const r = claimRule(m); return r && r.relay && !m.rl ? pick(msgM.writeMsg(m), r.relay) : null; }
  function relayForm(msgM, m) {
    const r = claimRule(m); if (!r || !r.relay || !m.rl) return m;
    const g = msgM.newMsg(m.t); for (const k of r.relay) g[k] = m[k]; for (const k of RELAY_KEEP) g[k] = m[k];
    return g;
  }
  // A GOODBYE SAID NOW (mesh.js LEAVE heals on m.s4live when no link told the
  // receiver the leaver's stay). The pre-signed LEAVE is up to PRELEAVE_MS old
  // when it is sent, and the two clocks may differ: `off` is my estimate of
  // (my clock - the signer's clock) from its other verified frames. With an
  // estimate, the goodbye's age on the SIGNER's clock must be under 45 s;
  // without one, its ts must lie within 2 minutes of mine (round 2: a fixed
  // 30 s window refused every goodbye at a receiver whose clock ran more
  // than ~10 s ahead of the leaver's).
  const PRELEAVE_MS = TM.PRELEAVE_MS;
  const RELOAD_HOLD_MS = TM.RELOAD_HOLD_MS;   // a closed tab's goodbye waits this long; with PRELEAVE_MS it must stay inside REPLAY_MS or its relay reads stale
  function goodbyeLive(nowMs, tsMs, off) {
    if (!Number.isFinite(tsMs) || tsMs <= 0) return false;
    if (off == null || !Number.isFinite(off)) return Math.abs(nowMs - tsMs) <= 120000;
    const age = nowMs - tsMs - off;
    return age >= -15000 && age <= PRELEAVE_MS + 35000;
  }

  // createMeshNode(opts):
  //   relayUrl        ws(s)://host:port of the relay (no path)
  //   sid, tok        relay session id + token (net.deriveMeet)
  //   key             room E2E key (net.deriveMeetKey — pw mixed in)
  //   excluded        (optional) pid => bool: mesh frames and doors naming such a pid are dropped
  //   identity        (S4) a pre-minted per-participant identity {priv,pubB64,peerId};
  //                   peer id = its peerId = H(pubkey). Overrides opts.peer.
  //   peer            LEGACY client-set peer id — S4 stays OFF (structural/compat).
  //                   Default when neither identity nor peer is given: mint a
  //                   fresh S4 identity and use peer-id = H(pubkey).
  //   tickMs          logical tick (default 500 — the canonical mapping)
  //   dropDeepSocket  drop the relay socket when seated deep (default true)
  //   sendDC(to, m)   the path: deliver control object m to peer `to` over
  //                   an existing DataChannel (or a forward over the mesh's
  //                   channels); return false if there is no path. Nothing
  //                   falls back to the relay.
  //   dial(to)        a knocker has an entry ask for `to` and no channel to
  //                   it: open one (the app's bootstrap over the relay)
  //   onUpdate(node)  per-tick UI hook
  //   onLocked()      R6: greeters exist but none decrypt — wrong password
  //   onBehind(list)  door blobs a key I REPLACED opens: [{p, key}] — their
  //                   writers missed a password change (§LOCK door-side heal)
  //   onStranded()    R6: meeting is live but unreachable a full TTL
  //   onFork(opts)    R5/E5§2: two+ door clusters — human pick-one
  //                   (multi-genesis OR same-key torn greeter halves).
  //                   opts = [{id, gkey, gateway, faces, tier, n}, …];
  //                   call node.chooseFork(id). Faces: Stage, else Stadium.
  //   homeFaces()     optional: greeter attaches {stage:[pid], stadium:[pid]}
  //                   on HOME for the pick-one UI
  //   onGossip(src,m,ageMs) room-wide app traffic delivery (exact-once); ageMs = time held by relays
  //   onRelayMsg(m)   every relay frame the wire does not consume — 'whoami',
  //                   'joined', 'greeter-gone', 'error', and 'peer' frames of the
  //                   law's shape (boot / ice / name / password, one fixed
  //                   size; the rest are refused here) — so the app keeps its
  //                   existing handlers while the wire OWNS the one socket.
  function createMeshNode(opts) {
    const tickMs = opts.tickMs || 500;
    const myKey = net.mintGenesisKey();
    // The relay's genesis key: the seat's genKey (u32) once it has one, else the key it knocks with, its linkKey, as the
    // sim's emitRelay(linkKey) presents it (the meeting key under island mode, its own key otherwise). A founder takes
    // genKey = linkKey (recv-entry genesis), so its knock and its later registrations present one string. Presenting
    // myKey here while the founder registered under linkKey (= URL_KEY in island mode) made the relay refuse every
    // registration of the room's first seat until its genesis lapsed: the second joiner heard no greeter for ~60 s.
    const gkStr = () => (raw ? 'g' + ((raw.genKey || raw.linkKey || raw.myKey) >>> 0).toString(16) : myKey);
    const dropDeep = opts.dropDeepSocket !== false;
    const ident = GifOS.meshIdentity || null;
    let stopped = false, lockedFired = false, doorFired = false, strandedFired = false, rejFired = false;
    let sock = null, deepSince = -1, dcWas = false, wasNetDark = false, netDarkAt = 0;   // dcWas: FHOP.8, I stood at the door last tick   // netDarkAt: wall clock of the offline edge (the dark span is an absence — see tick())
    let lastTickAt = 0, workerClock = false;   // wall clock of the last tick run; workerClock: the tick timer is a Worker (the wall-time clock applies: see tick())
    // Wire-level greeter registration health (production only — the sim has no
    // sockets, so none of this is mesh law). The relay's greeter pool is pure
    // socket-attachment state: an entry dies WITH its socket, and the E3
    // re-knock that would restore it is 100-200s away. Without these three
    // timestamps a single relay blip empties the pool for minutes — joiners
    // stall at a dead door (hold-mint-gap) or, knocking before any old member
    // reconnects, FOUND a second meeting (the production room tear).
    let lastRelayRx = 0;   // last frame heard from the relay on the live socket
    let lastRegAt = 0;     // last time we sent a greeter registration
    let doorAheadN = 0;    // blobs in my latest door reply that no key of mine (current or replaced) opens (doorAhead)
    let regPendingAt = 0;  // a registration awaiting its greeters reply (zombie detector)
    let subGrant = null;   // the grant that founds my door's room, as the page handed it with the answer to its ask (node.subGo)
    let recountOut = false; // a door count asked for (node.recountDoor) and not answered yet: one ask at a time
    // SHRANK-TO-SOLO (the 2-person fork fix, 2026-07-29): a room that WAS
    // populated and collapsed to one is a fragment SUSPECT the moment it
    // happens — a fresh founder is legitimately alone, but nobody legitimately
    // BECOMES alone without either a LEAVE or a confirm, and the confirm case
    // is exactly where two survivors fork (caught live: creator left, the
    // survivors' young pair died, each confirmed the other, one compacted
    // onto the other's seat — two solo rooms at the same coord, no heal for
    // 40s+ because the solo-probe and fragment-rescue both sat behind the
    // 90-tick founder-grace). The shrink event bypasses that grace in BOTH
    // gates and fires one immediate door probe; the door's greeter list is
    // ground truth, and a genuinely-emptied room costs one no-op probe.
    let sealedSoloRuns = 0; // consecutive sealed-only door replies while a fragment suspect (key-divergence evidence)
    let everPopulated = false; // this PAGE-LIFE saw a room of >=2 — a reseat/requeue cannot launder it
    let everLinked = false, cutSince = 0; // a seated seat that held links and now holds none (wall clock of the cut, 0 = not cut)
    let shrankSolo = false; // armed while everPopulated && solo; disarmed by a door reply proving we are truly alone, or by repopulation
    // Greeter-list forensics (fragment founding): every greeters reply we
    // handle is stamped here — list length, how many blobs opened under our
    // room key, the relay's founded flag, and which branch we took. R3/R6
    // take-over mints a second room only on empty+founded; greeter-pool
    // expiry alone is disproven (test/mesh/greeter-expiry.js). Cap keeps
    // memory bounded; drills dump this via node.greeterTrace().
    const greeterTrace = [];
    const GREETER_TRACE_CAP = 32;
    // The ROOM KEY the wire seals/opens with (greeter blobs, sealed relay
    // fallback). MUTABLE: a password change re-keys the room (§LOCK), and the
    // wire must follow — a greeter that kept sealing its registry blob under
    // the OLD key would lock every new-password newcomer out (R6 false
    // "wrong password") until it reloaded. See node.setKey below.
    let roomKey = opts.key;
    let keySetAt = 0;   // when setKey last changed my key (Date.now ms)
    const oldKeys = (Array.isArray(opts.oldKeys) ? opts.oldKeys.filter(Boolean) : []).slice(0, 4);   // keys this room used before mine (the app's, then each setKey's; newest first, at most 4): a door blob one of them opens is OLDER than mine (R6 below)

    // S4 identity is MANDATORY — there is NO "off". No mesh-identity.js loaded ⇒
    // hard fail (never a silent legacy-id degrade); no legacy client-set peer id
    // path. Every participant mints (or is handed) a per-participant keypair and
    // its peer id is H(pubkey). Signing + verification are unconditional.
    if (!ident) throw new Error('mesh-wire: js/mesh-identity.js is REQUIRED (S4 is mandatory) — load it before mesh-wire.js');
    let identity = opts.identity || null;   // else minted below (async, existing flow)
    const wantMint = !identity;             // ALWAYS mint when none is supplied
    let peer = identity ? identity.peerId : null;   // set post-mint
    const gossipChain = net.makeChain();   // gossip has its own lane: a chat burst must never queue a newcomer's seating frame behind it
    const verifyChain = net.makeChain();   // one inbound chain for every signed seat frame (order kept)
    const fillPins = ident.newPins();      // the exact-replay sets for claimed frames, bounded as 0.9.24's (mesh-identity SEEN_MAX)
    const signerTs = new Map();            // claimant -> {ts: its newest verified signature time, off: my clock - its clock then}
    function staleGoodbye(ts, nowMs, seen) {
      if (seen) return ts < seen.ts - REPLAY_MS;
      const offs = Array.from(signerTs.values(), (v) => v.off).sort((a, b) => a - b);
      if (!offs.length) return !goodbyeLive(nowMs, ts, null);
      return nowMs - ts - offs[offs.length >> 1] > REPLAY_MS;
    }
    const sigOf = new Map();               // signed core -> s4 block (my own and verified ones, for forwards)
    const pubPeer = new Map();             // pub -> peer id (H(pub)), cached
    const outq = new Map();                // peer -> tail promise: one outbound FIFO per peer (a signed frame never overtaken)
    const gpending = new Set();            // gids whose verification is in flight — the copies that arrive meanwhile are not verified again
    const gsig = new Map(); // gid -> Promise<s4> for gossip I authored (signed once, sent many times)
    const gflight = new Set(); // deliveries of gossip I authored whose signature is still in flight (flushed())

    let seat = null, raw = null, penv = null, layer = null, timer = null;   // seat: the page view (layer.view); raw: the ported Seat; penv: its world (env.js)
    let readyResolve; const ready = new Promise((r) => { readyResolve = r; });

    const relayBase = String(opts.relayUrl || '').replace(/\/+$/, '');
    // gk rides the URL so the CONNECT knock (and every reconnect) presents the
    // freshest key: the genesis key once learned, the throwaway before that.
    // opts.urlParams() (optional) appends app params — pw proof, device tag —
    // re-evaluated per reconnect so rotated credentials ride the next attempt.
    // The RECONNECT SECRET (relay.js `rs`): a per-device token, kept in this
    // browser, hashed with the room so the relay cannot correlate a device
    // across rooms. A socket holding my peer id or device tag may be replaced
    // only by a socket that presents the same value — a reload or a second
    // tab of mine can, a link holder who read my ids off the roster cannot.
    // No storage (a private window, Node) → empty → the relay's older
    // behaviour, replaceable by anyone naming the id.
    // The DEVICE TAG the relay keys bans, vote-offs and one-slot-per-device
    // on. run.html supplies its own room-salted tag through urlParams; every
    // other caller (app rooms) gets one here from the same device secret,
    // hashed with the room so the relay cannot correlate a device across
    // rooms. With no storage at all it is ephemeral — one per page load —
    // because the relay refuses a socket without one (4012).
    let rs = '', devTag = '';
    const rsFor = () => {
      let sec = null;
      try {
        const st = root.localStorage;
        if (st) {
          sec = st.getItem('gifos_rs_secret');
          if (!sec || !/^[0-9a-f]{32}$/.test(sec)) { sec = net.randHex(16); st.setItem('gifos_rs_secret', sec); }
        }
      } catch (e) { sec = null; }
      if (!sec) { devTag = net.randHex(8); return Promise.resolve(''); }
      return Promise.all([net.sha256hex(sec + '|' + opts.sid), net.sha256hex(sec + '|dev|' + opts.sid)])
        .then(([h, d]) => { rs = String(h || '').slice(0, 24); devTag = String(d || '').slice(0, 16) || net.randHex(8); })
        .catch(() => { devTag = devTag || net.randHex(8); });
    };
    // ADDRESS ATTESTATION (the relay's signed statement of my address):
    // my S4 key signs {v:1, act:'ipatt', sid, peer}, proving to the relay that
    // I hold the key behind my peer id, so its whoami can carry a signed
    // statement of the address it sees me connect from. Signed once per
    // identity, before the first connect; a relay that does not attest
    // ignores the two params.
    let ipp = '';
    const ipProofFor = () => (identity && net.edSign
      ? net.edSign(identity.priv, JSON.stringify({ v: 1, act: 'ipatt', sid: opts.sid, peer: identity.peerId })).then((s) => { ipp = s || ''; }, () => {})
      : Promise.resolve());
    // pv: the page's wire version. 0.9.25 was a flag day: the relay refuses a page that does not name
    // 0.9.25 or newer with 4010, which every older page shows as "reload to update" and stops knocking.
    // SUBROOMS: the door this socket uses: my door's room number (the seat's sr; 0 is the first room) and the TURN
    // service's grant that founds it (any member of that room may hold one; the relay ignores it at a live door).
    const doorNow = () => (raw && raw.sr > 0 && raw.sr < 100 ? raw.sr : 0);
    const doorParams = () => {
      const r = doorNow();
      if (!r) return '';
      return '&sr=' + r + (subGrant ? '&sg=' + encodeURIComponent(subGrant) : '');
    };
    const makeUrl = () => {
      const extra = opts.urlParams ? String(opts.urlParams() || '') : '';
      return relayBase + '/s/' + opts.sid
        + '?role=mesh&pv=' + WIRE_VERSION + '&token=' + encodeURIComponent(opts.tok || '')
        + '&peer=' + encodeURIComponent(peer)
        + '&gk=' + encodeURIComponent(gkStr()) + (hadAtConnect() ? '&had=1' : '')
        + doorParams()
        + (rs ? '&rs=' + rs : '')
        + (/[&?]dev=/.test(extra) ? '' : '&dev=' + encodeURIComponent(devTag || net.randHex(8)))
        + (ipp && identity ? '&pk=' + encodeURIComponent(identity.pubB64) + '&ipp=' + encodeURIComponent(ipp) : '')
        + extra;
    };

    // deliver(to, m): the raw transport step — DataChannel first, sealed relay
    // {t:'peer'} fallback. (Signing, when S4 is on, happens in env.send before
    // this is reached.)
    // ─────────────────────────────────────────────────────────────────────────
    // THE RELAY IS A DOOR, NOT A TRANSPORT. NEVER ADD A FALLBACK HERE AGAIN.
    //
    // A blanket `else -> send it over the relay` used to sit on this line. It
    // was never a design decision; it crept in, and it did real damage:
    //
    //  1. IT LIED ABOUT LIVENESS. D1's heartbeat is how a seat learns who it
    //     can reach FIRST-HAND (E2). Delivering a PHONE over the relay
    //     manufactures liveness for a peer link that is dead, so the seat
    //     believes in a neighbour it cannot actually talk to, and healing
    //     (H1/H2/E2) — which exists to notice exactly that — is blinded.
    //  2. IT HID A REAL BUG FOR AS LONG AS IT EXISTED. Column links were not
    //     being dialled at all (see run.html renderFromOcc: a peer was only
    //     dialled once it was already `alive`, which a column mate never is
    //     until it is dialled). The fallback carried their heartbeats, so the
    //     room limped instead of failing, and nobody saw the broken link layer.
    //  3. IT INVERTED THE ECONOMICS. Every unbuilt link parked ~0.5 frames/s of
    //     heartbeat per neighbour onto one relay socket. A room whose links
    //     were mostly unbuilt pushed ~4/s through a budget a HEALTHY room uses
    //     0.3/s of — so the relay was billed for the consequences of its own
    //     splint, and the rate guard then cut the very signalling that would
    //     have built the links.
    //
    // If there is no peer path, the honest answer is SILENCE: the peer is not
    // reachable, healing must be allowed to see that, and the link layer must
    // be fixed rather than bypassed. The relay carries the door verbs
    // (knock/greeters) and the bootstrap of a pair (run.html, the law) and
    // NOTHING else, ever: no mesh frame, the entry handshake included.
    // ─────────────────────────────────────────────────────────────────────────
    function deliver(to, m) {
      if (typeof opts.excluded === 'function') { try { if (opts.excluded(String(to))) return; } catch (e) {} } // an excluded peer is told nothing either
      try { if (typeof window !== 'undefined') { const t = (window.__mwTx = window.__mwTx || {}); t[m.t] = (t[m.t] || 0) + 1; } } catch (e) {} // DEBUG-TREE: per-type deliver counter
      if (opts.sendDC && opts.sendDC(to, m, peer)) return;   // DataChannel, else sponsor-forward through the mesh (peer: the sender, for in-process buses)
      // Anything else has no path: the peer is NOT REACHABLE. Say nothing and
      // let healing (H1/H2/E2) see the truth — a back channel that lies about
      // reachability is worse than silence.
    }
    const env = { TICK: 0 };   // legacy face (stats, debug): TICK mirrors the seat world's
    function keepSig(core, blk) { sigOf.delete(core); sigOf.set(core, blk); if (sigOf.size > 1024) sigOf.delete(sigOf.keys().next().value); }
    function clearClaim(f) { f.sig = false; f.fsig = false; f.fo = -1; }
    // L25.7 A MOVE'S ORDER (the sim's L25ORD is one registry every seat reads; a page's holds only its own): the mover
    // shows the decider's signature on (fo, foAt, hole) beside its frame, and a good one enters the receiver's registry.
    // Without it a row-mate names a healed head on its bare word, and L23 closes that link every 26 ticks.
    const ordSig = new Map();
    function keepOrd(core, blk) { ordSig.delete(core); ordSig.set(core, blk); if (ordSig.size > 64) ordSig.delete(ordSig.keys().next().value); }
    // L25.7 THE ORDER NAMES ITS MOVER. The decider's signature covers (fo, foAt, hole) and nothing more, so on its own it
    // is a bearer token: every hop of the cascade and every neighbour a mover shows it to could move into the hole with
    // it. So each seat that sends the order on also signs (order, the seat it sends it to), and that chain of namings
    // rides with the order down the cascade. A mover shows the chain ending at itself; a receiver enters the order in its
    // registry for that mover alone. A page that only overheard the order holds no naming of itself and cannot use it.
    const ordChain = new Map();   // order core -> the namings that came with the order (the last names this page)
    function keepChain(core, ch) { ordChain.delete(core); ordChain.set(core, ch); if (ordChain.size > 64) ordChain.delete(ordChain.keys().next().value); }
    const nameCore = (core, to) => core + '|to=' + to;
    function nameLink(core, to) { const ts = Date.now(); return net.edSign(identity.priv, JSON.stringify({ v: 3, c: nameCore(core, to), ts })).then((sig) => ({ ts, sig, pub: identity.pubB64, to })); }
    async function signerOf(pub) { let who = pubPeer.get(pub); if (!who) { who = 'k_' + (await net.keyId(pub)).slice(0, 40); pubPeer.set(pub, who); if (pubPeer.size > 4096) pubPeer.delete(pubPeer.keys().next().value); } return who; }
    // sound: link 0 signed by the decider `fo`, each next link by the seat the one before named, the last naming `end`
    async function chainOk(core, ch, fo, end) {
      if (!Array.isArray(ch) || !ch.length || ch.length > 16) return false;
      let prev = fo; const now = Date.now();
      for (const l of ch) {
        if (!l || typeof l.sig !== 'string' || typeof l.pub !== 'string' || !Number.isFinite(l.ts) || !Number.isFinite(l.to) || l.to < 0 || Math.abs(l.ts - now) > FILL_WINDOW_MS) return false;
        if (layer.ids.nid(await signerOf(l.pub)) !== prev || !await net.edVerify(l.pub, l.sig, JSON.stringify({ v: 3, c: nameCore(core, l.to), ts: l.ts }))) return false;
        prev = l.to;
      }
      return prev === end;
    }
    function orderCore(msgM, m) {
      if (m.mpK !== 1 || m.mpBy < 0 || m.mpAt < 0 || !m.ck) return null;
      const o = msgM.newMsg('FINDLEAF'); o.fo = m.mpBy; o.foAt = m.mpAt; o.hole = GifOS.meshTopo.unckey(m.ck); return coreOf(msgM, o);
    }
    async function takeOrder(msgM, f, b, ch) {
      const core = orderCore(msgM, f); if (!core || !b || typeof b.sig !== 'string' || typeof b.pub !== 'string' || !Number.isFinite(b.ts) || Math.abs(b.ts - Date.now()) > FILL_WINDOW_MS) return;
      if (layer.ids.nid(await signerOf(b.pub)) !== f.mpBy || !await net.edVerify(b.pub, b.sig, JSON.stringify({ v: 3, c: core, ts: b.ts }))) return;
      if (!await chainOk(core, ch, f.mpBy, f.id)) return;   // the order reached this mover by name, or it is not its order
      keepOrd(core, Promise.resolve({ ts: b.ts, sig: b.sig, pub: b.pub }));
      raw.w.L25ORD.add(GifOS.meshSeat.l25OrdKey(f.mpBy, f.ck, f.mpAt, f.id));
    }
    function sendFrameTo(to, m, dir, sponsored) {   // a seat frame for peer `to`: encode, sign if mine, keep per-peer order (sponsored: it leaves in a friend's envelope, FHOP)
      const msgM = GifOS.meshMsg;
      // My goodbye goes on the pre-signed signature, now: this page may not live to finish a signature, and
      // the pcbye right behind it must not overtake it (a frame after the far end's pcbye is dropped there).
      if (m.t === 'LEAVE' && m.bye && preLeave && m.id === layer.ids.nid(peer)) {
        const at = m.sigAt, atL = m.sigL; m.sigAt = preLeave.at; if (m.sigL >= 0) m.sigL = preLeave.at;
        const s4 = preLeave.s4.get(coreOf(msgM, m));
        if (s4) { try { const out = { t: 'MW2', f: msgM.writeMsg(m), s4 }; if (dir && typeof dir === 'object') out.dir = dir; deliver(to, out); return true; } catch (e) { return false; } }
        m.sigAt = at; m.sigL = atL;
      }
      let f; try { f = msgM.writeMsg(m); } catch (e) { return false; }
      let claim = claimOf(m); const core = claim >= 0 ? coreOf(msgM, m) : null;
      let blk = null;
      if (claim >= 0 && claim === layer.ids.nid(peer)) {
        blk = sigOf.get(core);
        // One signature per tick: a later re-send of the same words (a seeker's next FIND) mints a new time, so only a replay is ever an exact copy.
        if (!blk || blk.tick !== raw.TICK) {
          const ts = Date.now(), rc = relayCoreOf(msgM, m), sign = (c) => net.edSign(identity.priv, JSON.stringify({ v: 3, c, ts }));
          blk = Promise.all([sign(core), rc ? sign(rc) : null]).then(([sig, r]) => { const b = { ts, sig, pub: identity.pubB64 }; if (r) b.r = r; return b; });
          blk.tick = raw.TICK; keepSig(core, blk); if (m.t === 'FINDLEAF') keepOrd(core, blk);
        }
      } else if (claim >= 0) {
        blk = sigOf.get(core) || null;
        // I hold no signature for this claim (the author's frame reached me unverified, or a seat's stamp has no author
        // word behind it): hand it on unclaimed, as a receiver would have to read it, and say so.
        if (!blk) {
          if (opts.trace) { try { opts.trace('{"t":' + (env.TICK | 0) + ',"s":' + layer.ids.nid(peer) + ',"e":"SIG-NOCARRY","c":null,"d":"mt=' + String(m.t).replace(/[^A-Z0-9_]/g, '') + ' claim=' + claim + '"}'); } catch (e) {} }
          const u = msgM.clone(m); clearClaim(u); f = msgM.writeMsg(u); claim = -1;
        }
      }
      const pd = layer.sideOut(to, m);   // the page's display digest beside the seat's frame (layer.js; outside f and its signature)
      const oc = orderCore(msgM, m), ordP = oc ? ordSig.get(oc) : null;
      let ocP = oc ? (ordChain.get(oc) || null) : null;   // a mover's claim: the namings that brought it the order
      if (m.t === 'FINDLEAF' && m.fo >= 0 && claim >= 0 && identity) {   // the order on its way: name the seat it goes to
        const me = layer.ids.nid(peer), dst = m.routing && m.rfinal >= 0 ? m.rfinal : layer.ids.nid(to), had = ordChain.get(core);
        if (m.fo === me) ocP = nameLink(core, dst).then((l) => [l]);
        else if (had && had[had.length - 1].to === me) ocP = nameLink(core, dst).then((l) => had.concat([l]));
        else ocP = had || null;   // (a router: the chain passes as it came)
      }
      const prev = outq.get(to) || Promise.resolve();
      // An envelope's origin is its sender's word (any friend could write it): a frame I did not sign as its author carries my word that I am its origin.
      const os = (sponsored && claim !== layer.ids.nid(peer) && identity) ? originSign(to, f) : null;
      const q = prev.then(() => blk).then((s4) => Promise.all([os, ordP, ocP]).then(([o, ord, ocl]) => { if (stopped && m.t !== 'LEAVE') return; const out = { t: 'MW2', f }; if (s4) out.s4 = s4; if (o) out.o = o; if (ord) out.ord = ord; if (ocl) out.oc = ocl; if (dir && typeof dir === 'object') out.dir = dir; if (pd) out.pd = pd; deliver(to, out); })).catch(() => {});
      outq.set(to, q); q.then(() => { if (outq.get(to) === q) outq.delete(to); });
      return true;
    }
    // THE PRE-SIGNED GOODBYE (0.9.24 preLeave): leave() runs in pagehide / beforeunload and the node stops in the
    // same tick, so a goodbye signed only then may never leave. Kept current: signed once per change of what the
    // goodbye says, or per PRELEAVE_MS, in both CLAIMS forms (whole frame, relay form). What it says comes from the
    // seat's own leave() and emit(), run on a throwaway view of the seat (their writes land on the view, their frames
    // are caught), so it cannot drift from the seat.
    let preLeave = null, preLeaveBusy = false;
    function goodbyeFrames(reload) {
      const out = [], v = Object.create(raw), f = Object.create(raw.f);
      f.fabricLeft = f.fabricReloadBye = () => {}; f.fabricSend = (from, to, m) => { m.to = to; out.push(m); };
      Object.defineProperty(v, 'f', { value: f });   // f is a getter on the Seat: plain assignment would miss
      v.callBook = { touchOut() {} };
      raw.leave.call(v, !!reload);
      return out;
    }
    // RELOAD TREE MEMORY (0.9.24 seat.prevTree; run.html saves it for 2 minutes): a reloaded page does not wait out the
    // seat's one-door-at-a-time wave for a door that may be dark; it asks every old neighbour now, the way the wave's
    // own last round does. The seat decides as ever; it just hears its HOME sooner.
    let prevOld = (opts.prevTree && Array.isArray(opts.prevTree.ids) && opts.prevTree.ids.length) ? new Set(opts.prevTree.ids.map(String)) : null, treeAsk = null;
    const hadRoomMem = !!prevOld;   // this page came back from a room it sat in (kept: prevOld is consumed at the first list)
    let connects = 0;   // sockets this page has opened: a later one is a RE-open (the relay may have restarted)
    // ROOMS JOINED BY RELAYED CONNECTIONS: had=1 asks a door to wait for the greeters of a room I come back to; a door I
    // move to (the answer to my room ask) is not that room, and its own grant is short: no hold asked there.
    let roomDoor = 0;   // the door my remembered room is at (where my seat last sat; a reload remembers door 0's room)
    const hadAtConnect = () => { const reopen = connects++ > 0; return (hadRoomMem || (everPopulated && reopen)) && !(seat && seat.state === 3) && doorNow() === roomDoor; };   // the connect URL's had=1 (relay restart hold): only a page back from a reload, or a populated page whose socket re-opens, asks the door to wait for the room's greeters. A requeue on a live socket says nothing; no relay FRAME carries it (the frame law is unchanged)
    function treeMemAsk() {
      if (!treeAsk || !raw || raw.state !== 1) return;
      const list = treeAsk; treeAsk = null; let n = 0;
      for (const g of list) { if (g < 0 || g === raw.id || raw.l16Ask.includes(g)) continue; raw.l16Ask.push(g); const w = GifOS.meshMsg.newMsg('WHOHOME'); w.from = raw.id; w.ttl = 60; raw.emit(g, w); raw.l33NoSockAsk(g); raw.l3115Knock(g); n++; }
      if (opts.trace) { try { opts.trace('{"t":' + (env.TICK | 0) + ',"s":' + raw.id + ',"e":"TREEMEM-ASK","c":null,"d":"doors=' + n + '"}'); } catch (e) {} }
    }
    function sendHeldByes() {
      if (!preLeave || !raw || raw.dead || raw.state !== 3 || !raw.hasCoord) return false;
      const msgM = GifOS.meshMsg; let out = [];
      try {
        for (const m of goodbyeFrames(false)) {
          m.sigAt = preLeave.at; if (m.sigL >= 0) m.sigL = preLeave.at;
          const s4 = preLeave.s4.get(coreOf(msgM, m)); if (!s4) return false;
          out.push([m.to, { t: 'MW2', f: msgM.writeMsg(m), s4, rh: 1 }]);
        }
      } catch (e) { return false; }
      if (!out.length) return false;
      for (const [to, fr] of out) { const pid = layer.ids.pid(to); if (pid && (typeof opts.dcOpen !== 'function' || opts.dcOpen(pid))) deliver(pid, fr); }
      return true;
    }
    function refreshPreLeave() {
      if (preLeaveBusy || stopped || !identity || !raw || raw.dead || raw.state !== 3 || !raw.hasCoord) return;
      const msgM = GifOS.meshMsg; let frames, body;
      try { frames = goodbyeFrames(false).concat(goodbyeFrames(true)); body = Array.from(new Set(frames.map((m) => { m.sigAt = 0; return coreOf(msgM, m); }))).sort().join('|'); } catch (e) { return; }
      if (!frames.length) { preLeave = null; return; }
      if (preLeave && preLeave.body === body && Date.now() - preLeave.signedAt < PRELEAVE_MS) return;
      const at = penv.world.TICK, ts = Date.now(), sign = (c) => net.edSign(identity.priv, JSON.stringify({ v: 3, c, ts }));
      const forms = new Map(); for (const m of frames) { m.sigAt = at; forms.set(coreOf(msgM, m), relayCoreOf(msgM, m)); }
      preLeaveBusy = true;
      Promise.all(Array.from(forms, ([c, rc]) => Promise.all([sign(c), rc ? sign(rc) : null]).then(([sig, r]) => { const b = { ts, sig, pub: identity.pubB64 }; if (r) b.r = r; return [c, b]; })))
        .then((signed) => { preLeaveBusy = false; preLeave = { body, at, s4: new Map(signed), signedAt: Date.now() }; }, () => { preLeaveBusy = false; });
    }
    // ingest(m): the S4 verification gate on the way IN. A signed fill is
    // verified against the TOFU-pinned participant key (FIFO-chained so crypto
    // never reorders a sender's frames); a good frame is delivered with m.s4ok
    // stamped and its key pinned, a forged one is dropped. Non-signed frames and
    // S4-off nodes pass straight through — the structural path is untouched.
    // The directory a frame carries ({int: peer} for the seats it names; env.js checks each entry).
    // A seat id is up to 52 bits (env.js ID_BITS): 16 decimal digits.
    function dirOf(d) {
      if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
      const out = {}; let n = 0;
      for (const k of Object.keys(d)) { if (++n > 32) break; const v = d[k]; if (/^\d{1,16}$/.test(k) && Number(k) < 2 ** 52 && typeof v === 'string' && v.length <= 64) out[k] = v; }
      return out;
    }
    // WAITING ROOM. The page says whether this knocker is still held; a thrown hold fails
    // closed. Only a knocker's ask is withheld: a seat already in my view is no knocker.
    const heldAsks = new Map();   // peer -> its last withheld WHOHOME
    function doorBlocks(f, via, dir, direct) {
      if (typeof opts.doorHeld !== 'function' || !raw) return false;
      if (Array.from(raw.occ.values()).includes(f.from)) return false;
      const who = layer.ids.pid(f.from) || (dir && dir[f.from]) || (f.via < 0 ? via : '');
      let held = true; try { held = !!opts.doorHeld(String(who || '')); } catch (e) {}
      if (held && who) { heldAsks.set(String(who), [f, via, dir, direct]); if (heldAsks.size > 64) heldAsks.delete(heldAsks.keys().next().value); }
      return held;
    }
    // A held knock judged AGAIN now (the page learned something, e.g. a fresh door count): it goes through the
    // waiting-room gate once more, and only a knock the page no longer holds reaches the seat. Never an admit.
    function recheckHeld(list) {
      for (const p of list || []) { const a = heldAsks.get(String(p)); if (!a || stopped || !raw) continue; if (doorBlocks(a[0], a[1], a[2], a[3])) continue; penv.frame(Object.assign({}, a[0]), String(a[1]), dirOf(a[2]), a[3]); }
    }
    // The host's OK answers the held knock now, not at the knocker's next retry (run.html meetWait.admit).
    function answerHeld(list) {
      for (const p of list || []) { const a = heldAsks.get(String(p)); if (!a || stopped || !raw) continue; penv.frame(Object.assign({}, a[0]), String(a[1]), dirOf(a[2]), a[3]); }
    }
    // A PAGE GONE, TAB CLOSED OR RELOADED (L3.11): no browser says which at unload, so the leaver sends both words. The reload
    // mark holds its cell; its plain goodbye (`rh`, outside the signature) waits here RELOAD_HOLD_MS for it to come back. Any
    // frame of its own after that means it did, and the goodbye is dropped; else the goodbye lands and it was a real leave.
    const byeHeld = new Map(), byeArmed = new Map(), byeMark = new Map(), BYE_STRAY_MS = TM.BYE_STRAY_MS;   // leaver's peer id -> timer, when it started
    function byeTrace(e, k, d) { if (opts.trace) { try { opts.trace('{"t":' + (env.TICK | 0) + ',"s":' + layer.ids.nid(peer) + ',"e":"' + e + '","c":null,"d":"peer=' + String(k).slice(0, 8) + ' ' + d + '"}'); } catch (x) {} } }   // DEBUG
    function armBye(k, id, land) {
      clearTimeout(byeHeld.get(k)); byeArmed.set(k, Date.now()); byeTrace('BYE-HOLD', k, '');
      if (opts.onByeHold) { try { opts.onByeHold(k); } catch (e) {} }   // the tile goes now; the cell stays held for the hold
      byeHeld.set(k, setTimeout(() => {
        byeHeld.delete(k); if (stopped || !raw) return; byeTrace('BYE-LAND', k, '');
        raw.relMark.delete(id);   // the mark was for a return that never came: the seat hears a plain goodbye, its closes read as ever
        if (opts.onByeHeld) { try { opts.onByeHeld(k); } catch (e) {} }
        const mk = byeMark.get(k); byeMark.delete(k); if (mk) mk(); else land();   // the verified mark's own words, when it came: nothing left to check
      }, RELOAD_HOLD_MS));
    }
    // A reload mark with no plain goodbye beside it (a link whose channel was not open yet carried the mark by another way): the verified mark starts the same hold.
    function markBye(f, via, dir, direct) {
      const k = String(layer.ids.pid(f.id) || via); byeMark.set(k, () => { f.rel = false; penv.frame(f, String(via), dir, direct); });
      if (!byeHeld.has(k)) armBye(k, f.id, () => {});
    }
    function holdBye(m, f, via, direct) {
      const k = String(via);
      if (m.rh && direct === true && f.t === 'LEAVE' && f.bye && !f.rel) {
        // Its channel's close can reach the seat before the mark clears its signature: a close read as hard would heal over the cell. Its own word about its own seat, on its own channel.
        if (raw && layer.ids.pid(f.id) === k && !raw.relMark.has(f.id)) raw.relMark.set(f.id, raw.TICK);
        armBye(k, f.id, () => { const g = Object.assign({}, m); delete g.rh; ingest(g, via, direct); });
        return true;
      }
      // (frames it signed just before the goodbye can land just after it: a page takes longer than this to come back)
      if (byeHeld.has(k) && f.t !== 'LEAVE' && Date.now() - (byeArmed.get(k) || 0) > BYE_STRAY_MS) { clearTimeout(byeHeld.get(k)); byeHeld.delete(k); byeMark.delete(k); byeTrace('BYE-BACK', k, f.t); }
      return false;
    }
    // FHOP: who sent this envelope, proved. The sim's fabric knows; a page needs the origin's signature over the frame and its target.
    function originSign(to, f) { const ts = Date.now(); return net.edSign(identity.priv, JSON.stringify({ v: 4, to: String(to), f, ts })).then((sig) => ({ ts, sig, pub: identity.pubB64 })).catch(() => null); }
    const originSeen = new Set();
    async function originProved(m, origin) {
      const o = m.o; if (!o || typeof o.sig !== 'string' || typeof o.pub !== 'string' || !Number.isFinite(o.ts)) return false;
      if (Math.abs(o.ts - Date.now()) > FILL_WINDOW_MS || originSeen.has(o.sig)) return false;
      let who = pubPeer.get(o.pub); if (!who) { who = 'k_' + (await net.keyId(o.pub)).slice(0, 40); pubPeer.set(o.pub, who); if (pubPeer.size > 4096) pubPeer.delete(pubPeer.keys().next().value); }
      if (layer.ids.nid(who) !== layer.ids.nid(String(origin))) return false;
      if (!await net.edVerify(o.pub, o.sig, JSON.stringify({ v: 4, to: String(peer), f: m.f, ts: o.ts }))) return false;
      originSeen.add(o.sig); if (originSeen.size > 2048) originSeen.delete(originSeen.values().next().value);
      return true;
    }
    // origin: set only for a friend-hop envelope (run.html's fmesh): the id its envelope names as its sender
    function ingest(m, via, direct, origin) {
      if (stopped || !raw || !m || typeof m !== 'object') return;
      if (typeof opts.excluded === 'function') {
        try { for (const f of [m.src, via, origin]) if (f != null && opts.excluded(String(f))) return; } catch (e) {}
      }
      try {
        const sv = (typeof window !== 'undefined') && window.__severed;
        if (sv && sv.size && via != null && (sv.get(via) || 0) > Date.now()) return;
      } catch (e) {}
      try { if (typeof window !== 'undefined') { const t = (window.__mwRx = window.__mwRx || {}); const k = m.t === 'MW2' && m.f ? m.f.t : m.t; t[k] = (t[k] || 0) + 1; } } catch (e) {} // DEBUG-TREE: per-type ingest counter
      if (via != null) layer.ids.learn(String(via));
      if (m.t === 'MW2') {   // a seat frame
        const msgM = GifOS.meshMsg; let f;
        try { f = msgM.readMsg(m.f); } catch (e) { return; }
        if (holdBye(m, f, via, direct)) return;
        const claim = claimOf(f), dir = direct === true, sponsored = origin != null;
        let proven = null;   // the envelope's origin, once proved: its own signature on this envelope, or the frame's verified author
        const prove = () => (sponsored && claim !== layer.ids.nid(String(origin)) ? originProved(m, origin).then((y) => { if (y) proven = origin; }, () => {}) : Promise.resolve());
        const done = (ok, why) => {
          if (stopped) return;
          if (why === 'SKEW') return;   // refused outright: a signer outside the window cannot move a seat, signed or stripped
          if (!ok) {
            clearClaim(f);
            if (claim !== -1 && !why && opts.trace) { try { opts.trace('{"t":' + (env.TICK | 0) + ',"s":' + layer.ids.nid(peer) + ',"e":"SIG-FAIL","c":null,"d":"mt=' + String(f.t).replace(/[^A-Z0-9_]/g, '') + ' claim=' + claim + ' via=' + layer.ids.nid(String(via)) + '"}'); } catch (e) {} }   // DEBUG trace sink only (T8)
          }
          if (!ok && f.t === 'RECLAIM') return;   // no proof, no reclaim: the seat never hears it
          if (f.t === 'WHOHOME' && doorBlocks(f, via, m.dir, dir)) return;   // waiting room: no HOME, no roster
          if (ok && dir && m.pd) layer.sideIn(String(via), f, m.pd);
          if (ok && f.t === 'LEAVE' && f.rel && f.bye && !f.mvd) markBye(msgM.clone(relayForm(msgM, f)), via, dirOf(m.dir), dir);
          if (ok && sponsored && claim === layer.ids.nid(String(origin))) proven = origin;
          penv.frame(ok ? relayForm(msgM, f) : f, String(via), dirOf(m.dir), dir, sponsored, proven);
        };
        if (claim === -1) { verifyChain(() => prove().then(() => done(true))); return; }
        if (claim === NOSIGNER) { verifyChain(() => prove().then(() => done(false))); return; }
        const s4 = m.s4;
        if (!s4 || typeof s4.sig !== 'string' || typeof s4.pub !== 'string' || !Number.isFinite(s4.ts)) { verifyChain(() => prove().then(() => done(false))); return; }
        verifyChain(async () => {
          await prove();
          let ok = false, why = null;
          try {
            const core = coreOf(msgM, f);
            let who = pubPeer.get(s4.pub); if (!who) { who = 'k_' + (await net.keyId(s4.pub)).slice(0, 40); pubPeer.set(s4.pub, who); if (pubPeer.size > 4096) pubPeer.delete(pubPeer.keys().next().value); }
            ok = layer.ids.nid(who) === claim && await net.edVerify(s4.pub, s4.sig, JSON.stringify({ v: 3, c: core, ts: s4.ts }));
            // Past the signature only a key holder's frame gets here (0.9.24 verifyFill): each check names why it refuses.
            if (ok) {
              const seen = signerTs.get(claim), nowMs = Date.now(), skewMs = s4.ts - nowMs, isDirect = claim === layer.ids.nid(String(via));
              if (Math.abs(skewMs) > FILL_WINDOW_MS) {   // minted outside the window: a stale capture, or one of our clocks is wrong. Dropped, and that is all: no page's word stops a seat
                ok = false; why = 'SKEW';
              } else if (f.t === 'LEAVE' && !isDirect && staleGoodbye(s4.ts, nowMs, seen)) {
                // older than what its signer has since said: the signature is real, its word is spent. (sigL, the seat's freshness
                // test, is the forwarder's word.) No word from this signer yet: judge by the room's clocks as I have verified them;
                // a signer whose clock runs far behind the room loses only its relayed goodbye.
                ok = false; why = 'STALE';
              } else if (isDirect ? fillPins.seen(s4.sig) : fillPins.seenRelayed(f.t === 'FIND' ? s4.sig + '|' + (f.ttl | 0) : s4.sig)) {   // a FIND may pass one seat twice (two seats whose views differ hand it to and fro, an L4 or L7.5 hop comes round): every hop spends its hop budget, so that is what differs
                // An exact copy. A forwarded copy has its own set, so one that wins the race never burns the claimant's own frame
                // at the link behind it, and that frame still does its relaying (each signature: once direct, once forwarded).
                ok = false; why = 'SEEN';
              } else if (!seen || s4.ts > seen.ts) { signerTs.set(claim, { ts: s4.ts, off: nowMs - s4.ts }); if (signerTs.size > 256) signerTs.delete(signerTs.keys().next().value); }
              if (why && opts.trace) { try { opts.trace('{"t":' + (env.TICK | 0) + ',"s":' + layer.ids.nid(peer) + ',"e":"SIG-' + why + '","c":null,"d":"mt=' + String(f.t).replace(/[^A-Z0-9_]/g, '') + ' claim=' + claim + ' via=' + layer.ids.nid(String(via)) + ' skew=' + Math.round(skewMs / 1000) + 's"}'); } catch (e) {} }
            }
            if (ok) {
              layer.ids.learn(who);
              if (claim !== layer.ids.nid(String(via)) && opts.trace) { try { opts.trace('{"t":' + (env.TICK | 0) + ',"s":' + layer.ids.nid(peer) + ',"e":"SIG-FWD","c":null,"d":"mt=' + String(f.t).replace(/[^A-Z0-9_]/g, '') + ' claim=' + claim + ' rl=' + (f.rl ? 1 : 0) + '"}'); } catch (e) {} }   // DEBUG trace sink only: a forwarded claim that verified
              keepSig(core, Promise.resolve(s4));
              if (f.t === 'FINDLEAF' && f.fo >= 0) {
                const me = layer.ids.nid(peer);
                if (f.routing && f.rfinal >= 0 && f.rfinal !== me) { if (Array.isArray(m.oc) && !ordChain.has(core)) keepChain(core, m.oc); keepOrd(core, Promise.resolve(s4)); }   // a router: not mine to read
                else if (await chainOk(core, m.oc, f.fo, me)) { keepChain(core, m.oc); keepOrd(core, Promise.resolve(s4)); raw.w.L25ORD.add(GifOS.meshSeat.l25OrdKey(f.fo, GifOS.meshTopo.ckey(f.hole), f.foAt, me)); }
                else { ok = false; why = 'ORDTO'; if (opts.trace) { try { opts.trace('{"t":' + (env.TICK | 0) + ',"s":' + me + ',"e":"SIG-ORDTO","c":null,"d":"fo=' + f.fo + ' via=' + layer.ids.nid(String(via)) + '"}'); } catch (e) {} } }   // an order nobody sent me by name: unsigned to my seat (L25.7)
              }
              if (m.ord && f.mpK === 1) await takeOrder(msgM, f, m.ord, m.oc);
              const rc = relayCoreOf(msgM, f);   // the author's word for a relay of this frame; a bad one fails at the next hop, on the author's account
              if (rc && typeof s4.r === 'string') keepSig(rc, Promise.resolve({ ts: s4.ts, sig: s4.r, pub: s4.pub }));
            }
          } catch (e) { ok = false; }
          done(ok, why);
        });
        return;
      }
      if (ident.GOSSIP_T && ident.GOSSIP_T.has(m.t)) {
        delete m.lk; delete m.s4ok;
        if (direct === true && via != null) m.lk = via;
        if (via != null && m.from == null) m.from = via;
        if (layer.seen && layer.seen(m.gid, m.lk)) return;   // a copy of a frame already taken: dedup BEFORE paying for a verification
        // one whose verification is in flight, by the same kind of way: a copy on a proven channel is not held back by
        // one on no channel, which the app may refuse for its channel alone (layer.js gref)
        const pk = m.gid + (m.lk != null ? '|lk' : '|');
        if (gpending.has(pk)) return;
        gpending.add(pk);
        gossipChain(() => ident.verifyGossip(gpins, m).then((v) => {
          gpending.delete(pk);
          if (stopped) return;
          if (v && v.ok) { m.s4ok = true; layer.gossipRecv(m); }
          else layer.countForged();   // unsigned, forged or impostor gossip: dropped unforwarded, and counted
        }).catch(() => { gpending.delete(pk); layer.countForged(); }));
        return;
      }
      // anything else is not a mesh frame on the new path: dropped
    }

    // THE RELAY CARRIES NO MESH FRAME. The entry handshake (WHOHOME / FIND /
    // HOME / NOROOM / FINDACK / PLACE) crosses a DataChannel like every other
    // mesh frame: a knocker first opens one to a greeter (opts.dial, the
    // bootstrap the relay exists for) and asks over it. A relay frame that is
    // not of the law's shape (gifos-net.js relayFrameOk: a listed type, one
    // fixed size) is counted here and dropped before anyone opens it.
    let relayRefused = 0; // relay frames refused by shape (dropped unopened)
    let relayUnsent = 0;  // frames a caller tried to put on the relay that are not of the law's shape (never sent)
    // Every close code the relay socket saw in this node's life, newest last
    // (survives the socket being dropped and re-made). stats() reports it so
    // a page can tell a socket the relay CUT from one the network dropped.
    const relayCloses = [];
    const RELAY_CLOSES_KEPT = 64;
    function makeSock() {
      // A live meeting has to stay reachable while the page is hidden, so a
      // dropped relay retries on the short cap. The patient cap is for a
      // hidden page that is not in a call. This socket exists only for the
      // call and stays on duty until the node stops.
      const atDoor = doorNow();
      sock = net.steadySocket(makeUrl, {
        onClose: (code) => { relayCloses.push({ code, at: Date.now() }); if (relayCloses.length > RELAY_CLOSES_KEPT) relayCloses.shift(); },
        onDuty: () => !stopped,
      });
      sock.door = atDoor;   // the room number this socket's URL names (sendRaw moves it when my door moves)
      lastRelayRx = Date.now(); // fresh socket starts its idle clock now
      // EVERY (re)connect: if I am a seated Section-1 greeter, my pool entry
      // died with the old socket — restore it NOW, not at the next E3 tick.
      // The URL CONNECT knock re-seeds the genesis key but carries no sealed
      // address, so without this the pool stays empty until E3 (100-200s):
      // exactly the window the tear drill founds a second meeting in.
      sock.onopen = () => {
        // A reopened socket has NO pool entry (the entry was the old socket's attachment). The 8 s throttle
        // exists to stop a reply chain looping, not to cover a reopen: a greeter that registered 3 s ago and
        // reconnected now sent nothing and was off the door until E3 (seen live 2026-11-09: the next knocker founded).
        if (!stopped && iAmAGreeter()) { lastRegAt = 0; reregister('reconnect'); }
      };
      sock.onmessage = (ev) => {
        if (stopped) return;
        lastRelayRx = Date.now();
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'greeters') {
          if (atDoor !== doorNow()) return;   // a door's answer counts only while that door is mine: my door moved since this socket knocked there
          recountOut = false;
          if (lockedFired && !(seat && seat.state === 3)) return;   // a bad password is the lock prompt: an empty list here would mint a founder
          onGreeters(m);
          if (opts.onDoor) { try { opts.onDoor('seated', m); } catch (e) {} }
          return;
        }
        if (m.t === 'peer') {
          // THE SHAPE GATE: a listed type in the clear and one fixed sealed
          // size (gifos-net.js relayFrameOk), or the frame is counted and
          // dropped unopened. What passes is the app's: a bootstrap, a
          // candidate, a name or a password grant (run.html onRelayPeer).
          if (!net.relayFrameOk(m)) {
            relayRefused++;
            try { if (typeof window !== 'undefined') { const t = (window.__mwRx = window.__mwRx || {}); const k = 'relay-refused:' + String(m.ty == null ? 'untyped' : m.ty).slice(0, 16); t[k] = (t[k] || 0) + 1; } } catch (e) {} // DEBUG-TREE
            return;
          }
          if (opts.onRelayMsg) opts.onRelayMsg(m);
          return;
        }
        // ({t:'nosock'} passes through to the app via onRelayMsg — the wire
        // deliberately does NOT nudge the join loop on it: a stray bounce from
        // an unrelated frame aborting an in-flight FIND descent thrashes the
        // dance. The seat's own 20/60-tick retries govern pre-seat pacing.)
        if (m.t === 'nosock' && penv) { try { penv.relayFrame(m); } catch (e) {} }   // L33.11: the seat hears the bounce as BUSY{nosock}
        if (m.t === 'error' && /password/i.test(m.error || '')) fireLocked(true); // relay courtesy gate
        if (opts.onRelayMsg) opts.onRelayMsg(m);
      };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // THE ONLY WAYS THIS CLIENT MAY EVER TOUCH THE RELAY
    //
    // healing-laws R2: the relay is a zero-knowledge GREETER REGISTRY — a
    // DOOR, not a transport. Which side of that door you are on is a question
    // about the STEP YOU ARE AT, not about the frame you happen to be holding:
    //
    //   before you have a greeter  → the relay is how you find one
    //   once you are seated        → you are INSIDE; you talk over the mesh
    //
    // Every socket write in this file goes through one of the four functions
    // below, each named for the step it belongs to. Each ENFORCES its
    // own precondition rather than trusting its caller — so "who may use the
    // relay, and when" is answered in one place and cannot drift. Nothing else
    // may call sendRaw; an unlisted caller is a bug, and a NEW function needs a
    // law to justify it — that is the point of naming them.
    //
    // This replaced a frame-type allowlist, which was the wrong shape: FIND and
    // WHOHOME are each sent BOTH by an entrant reaching a greeter and by a
    // seated seat routing internally, so the list quietly re-opened the relay
    // as a transport for anything wearing an entry type name.
    // ═══════════════════════════════════════════════════════════════════════
    function sendRaw(obj) {   // PRIVATE — the functions below only
      if (stopped) return;
      // THE LAW, OUTBOUND: a frame leaves this socket only in the law's
      // shape (gifos-net.js relayVerbOk: a listed verb with its exact field
      // set and caps; a member frame of a listed type with one fixed sealed
      // size) and never longer than the largest legal frame. Anything else
      // is counted and never sent, whoever asked.
      if (!net.relayVerbOk(obj) || JSON.stringify(obj).length > net.RELAY_MAX_FRAME_LEN) { relayUnsent++; return; }
      // SUBROOMS: a frame goes out at my door. My door moved (the answer to my ask, or my room took a number): the socket
      // at the old door goes and the next one opens at the new door, before this frame (a knock, a register) is sent.
      if (sock && sock.door !== doorNow() && !sock.rejected) { try { sock.close(); } catch (e) {} sock = null; }
      if (!sock) makeSock(); // recreate on demand (deep seats run socketless)
      // A POLICY-REJECTED socket (4000 replaced / banned / voted off) stays
      // DOWN — steadySocket already refuses to reconnect it, but replacing
      // the OBJECT minted a fresh connect every knock retry and re-ignited
      // the same-device eviction war (the July 12 billing incident,
      // e2e-meet-quiet part B: ~2 fresh sockets/s on the evicted tab).
      // Another tab owns this seat; we have no right to keep knocking.
      // The one sanctioned re-arm is an app credential change (setKey).
      if (sock.rejected) return;
      if (raw && !raw.socketed()) deepSince = env.TICK;   // an admin's door verb from a seat past the door: its socket stays for the send
      sock.send(obj);
    }
    const iAmInsideTheRoom = () => !!(seat && seat.hasCoord && seat.state === 3);
    // FHOP.8: a deep seat called to the door (the seat's doorCallOn) is a greeter for DOORCALL_HOLD: it registers, keeps its socket, answers WHOHOME
    const doorCalled = () => !!(raw && raw.doorCallOn && raw.doorCallOn());
    const iAmAGreeter = () => iAmInsideTheRoom() && (seat.coord.pc === 0 || doorCalled());
    // Is this peer already IN the room? Occupancy is the membership roll, so a
    // peer holding no cell in it has not been seated: it is at the door.

    // (1) KNOCK — I have no greeter yet, so I ask the registry for the sealed
    // list (R3: an empty list mints genesis). The one call that exists precisely
    // because there is no other way in.
    // SUBROOMS: what a registration says for the TURN service's pick: c '1' when my seat heads a Section-1 row on a
    // capable device (a relayed pipe may end here), and ep, my room's founding time (at a door two rooms share, the
    // oldest room's heads are its own).
    function regWords() {
      const w = {};
      if (seat && seat.hasCoord && seat.coord.pc === 0) {
        const cap = typeof opts.capable !== 'function' || opts.capable();
        // c: '1' a capable row head (a pipe may end here); '2' a capable Section-1 seat with its cell key k, which the relay
        // names when its door has no capable row head left (the seat next in line for a head cell, SUB.3); '0' neither
        w.c = cap ? (seat.coord.i === 0 ? '1' : '2') : '0';
        if (w.c === '2') w.k = String(seat.coord.r * 256 + seat.coord.i);
      }
      if (raw && Number.isInteger(raw.lineAt) && raw.lineAt >= 0 && raw.lineAt < 1e15) w.ep = String(raw.lineAt);
      return w;
    }
    function KNOCK_FOR_THE_GREETER_LIST(gk) { sendRaw({ t: 'knock', gk: gk || myKey }); }

    // (2) REGISTER — I am a seated Section-1 seat, so I AM a door; E3 keeps my
    // sealed address in the pool so newcomers can still find one. The address is
    // Seal(K,{peerId,coord}) under the room key the relay never holds (R2).
    // blobFp: a stable 12-char fingerprint of a sealed blob string — lets the
    // greeterTrace say WHOSE blob the door served without opening it (fork
    // forensics: is the unopenable blob my own earlier registration, the
    // other half's, or a third ghost?).
    function blobFp(s) { let h = 5381; const str = String(s); for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + ':' + str.length; }
    // My network's word at the door: its tag and its measured kind. A registration that carried an older word is made again
    // (netWordChanged: my probe's verdict landed, or my address changed).
    let lastRegWord = '';
    const netWord = () => { const t = opts.netTag ? String(opts.netTag() || '') : '', k = opts.netKind ? opts.netKind() : -1; return /^[0-9a-f]{8}$/.test(t) ? t + ':' + (k === 0 || k === 1 || k === 2 ? k : '') : ''; };
    const netWordBlob = (b) => { const w = netWord(); return w ? Object.assign({}, b, { nw: w.slice(0, 8) + w.slice(9) }) : b; };   /* one short field (the tag, then the kind digit): the sealed address is a fixed 128 bytes */
    function netWordChanged() { if (stopped || !seat || !iAmAGreeter()) return; const w = netWord(); if (w && w !== lastRegWord) reregister('net-word'); }
    function REGISTER_MYSELF_AS_A_GREETER(gk) {
      const k = gk || myKey;
      if (!iAmAGreeter()) { KNOCK_FOR_THE_GREETER_LIST(k); return; }
      /* e: when my room was founded, so two rooms that meet agree which is the older (the older one stays) */
      /* nw: my network's word: its tag (the keyed hash of the address the relay saw me connect from, the one my beat carries) and what it measured as (0 open, 1 strict, 2 blocked). A joiner reads from it which doors are on its own network and whether its network and mine can connect at all, and does not wait on a door it cannot reach */
      const blob0 = Object.assign({ p: peer, c: seat.coord, fa: 1 }, raw && raw.lineAt >= 0 ? { e: raw.lineAt } : {});
      const blob1 = netWordBlob(blob0);
      lastRegWord = netWord();
      net.sealFixed(roomKey, net.fitsFixed(blob1) ? blob1 : blob0)
        // a greeter's sealed address is one fixed-size sealed part, like every sealed thing on the relay
        .then((b) => { const s = JSON.stringify(b); greeterTrace.push({ t: Date.now(), tick: env.TICK, state: seat.state, post: seat.state, listLen: -1, open: -1, founded: false, action: 'register-blob:' + blobFp(s) }); if (greeterTrace.length > GREETER_TRACE_CAP) greeterTrace.shift(); sendRaw(Object.assign({ t: 'knock', gk: k, gblob: s }, seat.coord.pc !== 0 ? { dc: '1' } : {}, regWords())); })   /* dc: a door-call registration (FHOP.8), which the relay keeps only for the call */
        .catch(() => sendRaw({ t: 'knock', gk: k }));
    }
    // (2b) RE-REGISTER on a wire event — same door function as (2), fired when
    // the TRANSPORT (not the E3 timer) says the pool entry may be gone: the
    // socket just reconnected, a greeters reply came back empty, or the idle
    // keepalive is due. Throttled so a solo greeter's own empty replies can
    // never chain into a knock loop. Every call is stamped into greeterTrace.
    let regLateT = 0;   // one deferred register while the throttle holds: a throttled call is delayed, never lost
    function reregister(why) {
      if (stopped || !seat || !iAmAGreeter()) return;
      const now = Date.now();
      if (now - lastRegAt < 8000) {
        if (!regLateT) regLateT = setTimeout(() => { regLateT = 0; reregister(why + '-late'); }, 8000 - (now - lastRegAt));
        return;
      }
      lastRegAt = now; regPendingAt = now;
      REGISTER_MYSELF_AS_A_GREETER(gkStr());
      greeterTrace.push({ t: now, tick: env.TICK, state: seat.state, post: seat.state,
        listLen: -1, open: -1, founded: false, action: 're-register:' + why });
      if (greeterTrace.length > GREETER_TRACE_CAP) greeterTrace.shift();
    }

    function fireLocked(door) { if (!lockedFired || (door && !doorFired)) { lockedFired = true; if (door) doorFired = true; if (opts.onLocked) opts.onLocked(!!door); } }   // door: the door itself refused me; else only blobs I cannot open

    async function onGreeters(m) {
      if (opts.holdDoor && opts.holdDoor()) return;   // waiting on the admin with a lock I cannot read: a list I cannot open must not make me a founder
      // ROOMS JOINED BY RELAYED CONNECTIONS: tag 3, my own door is empty (the relay forgot it; the seat asks for a fresh
      // grant); tag 4, door 0 is empty while other doors of the meeting live (the seat asks before founding). The seat decides.
      if ((m.tag === 3 || m.tag === 4) && penv) { if (!stopped && seat) penv.relayFrame({ t: 'greeters', list: [], tag: m.tag }); return; }
      const list = m.list || [];
      const ids = [], sealedFps = [], fa = [], behind = [];
      const ep = new Map(), atOf = (l) => l.map((p) => (ep.has(p) ? ep.get(p) : -1));   // each greeter's word of when its room was founded (-1: not said)
      const ntm = new Map(), ntOf = (l) => l.map((p) => ntm.get(p) || '');   // each greeter's network word: its tag and, after a colon, its kind ('': not said)
      let olderSeen = 0;   // sealed blobs one of my replaced keys opens: their writers are behind me, not ahead
      let aheadN = 0;      // sealed blobs no key I hold or held opens: their writers are under a key I do not have
      for (const s of list) {
        try {
          const o = await net.open(roomKey, JSON.parse(s));
          if (o && o.p && o.p !== peer) { ids.push(o.p); if (o.fa === 1) fa.push(o.p); if (Number.isInteger(o.e) && o.e >= 0) ep.set(o.p, o.e); if (typeof o.nw === 'string' && /^[0-9a-f]{8}[012]?$/.test(o.nw)) ntm.set(o.p, o.nw.slice(0, 8) + ':' + o.nw.slice(8)); }
          else if (o && o.p === peer) sealedFps.push('SELF');
          else { /* net.open resolves NULL on wrong key — the sealed-under-a-different-key case */
            sealedFps.push('X' + blobFp(s));
            let old = false;
            for (const k of oldKeys) { try { const ob = await net.open(k, JSON.parse(s)); if (ob) { old = true; olderSeen++; if (ob.p && ob.p !== peer) behind.push({ p: ob.p, key: k }); break; } } catch (e) {} }
            if (!old) aheadN++;
          }
        } catch (e) { sealedFps.push('E' + blobFp(s)); }
      }
      if (stopped || !seat) return;
      doorAheadN = aheadN;
      // WRITERS BEHIND ME: a blob a key I replaced opens was written
      // by a seat that missed the password change — a member sealed away,
      // possibly in a tree of its own by now, that no pair of mine will ever
      // carry a frame from. Hand the app the writer and the key it still
      // reads; the app replays the signed grant to it over the relay.
      if (behind.length && opts.onBehind) { try { opts.onBehind(behind); } catch (e) {} }
      // DEBUG sever (drill lever, mirrors ingest's drop): while a pid is
      // severed, the DOOR must not show it either. The fragment rescue reads
      // the pool as ground truth for "who is reachable", so a manufactured
      // pair partition that leaves the counterpart visible at the door
      // un-forks itself mid-sever: the solo seat requeues into a knock-loop
      // toward a peer whose frames are all dropped, and the drill's stable
      // both-solo window never forms (e2e-fork-heal premise leak, 2026-08-03
      // — surfaced when the entry-pacing fix made the rescue prompt).
      try {
        const sv = (typeof window !== 'undefined') && window.__severed;
        if (sv && sv.size) { const now = Date.now(); for (let i = ids.length - 1; i >= 0; i--) if ((sv.get(ids[i]) || 0) > now) ids.splice(i, 1); }
      } catch (e) {}
      // ...and an excluded peer (an ejected forger) is never a door.
      if (typeof opts.excluded === 'function') { try { for (let i = ids.length - 1; i >= 0; i--) if (opts.excluded(String(ids[i]))) ids.splice(i, 1); } catch (e) {} }
      regPendingAt = 0; // the relay answered — the socket is provably alive
      // Capture join state BEFORE recv — GREETERS empty+founded take()s at
      // state===0 and leaves state=3, so a post-recv snapshot would hide the
      // actual mint under "already seated".
      const preState = seat.state;
      // R6 is a JOINING-NEWCOMER state ("the stranded newcomer"): only a seat
      // still trying to get in can be "locked out". A SEATED seat hits this
      // path too — its own E3/setKey re-knock right after a password change
      // answers with the OTHER greeters' blobs still sealed under the OLD key
      // (their re-knocks are in flight), decrypting none — and firing onLocked
      // there threw the "This room is locked" join prompt at a member who SET
      // the password. A seated seat ignores the list's content anyway (E3
      // keeps it in the pool; it never seats off it), so just drop the reply.
      let action;
      // FRAGMENT SELF-RESCUE (behavior battery 08a tail, 2026-07-26): I am
      // SEATED in a room of ONE, yet the door's greeter list opens to OTHER
      // live members — my entry collapsed into a fragment (the reload-mash /
      // glare tail: seat-wander, requeue, solo). The DOOR is ground truth
      // for who is reachable; a solo seat is its own greeter and re-knocks
      // every ~55s anyway, so this costs nothing new. Hand the evidence to
      // the app for a clean re-entry.
      // Verified truly alone: a seated-solo suspect whose door reply is EMPTY
      // (no blobs at all) is not a fragment — everyone really left. Disarm;
      // repopulation re-arms via the tick tracker.
      if (preState === 3 && seat.hasCoord && seat.occ.size <= 1 && shrankSolo && !list.length) shrankSolo = false;
      // SEALED-ONLY DOOR while a fragment suspect (the key-divergence fork):
      // the door serves blobs but NONE decrypt — the other half is alive and
      // registering under a DIFFERENT room key (caught live: each half's
      // fresh blob unreadable at the other, churning fingerprints). No dial
      // can cross a key divide; count the consecutive sightings and hand the
      // evidence to the app (whose persisted-credential reload re-converges).
      // A blob that OPENED and was then set aside (a severed pair, an
      // excluded pid) is no key divide: only blobs my key cannot open count.
      // Counting the set-aside ones challenged a member for the password it
      // holds, and the lock flag then dropped its every door reply while
      // unseated, so a member coming back in waited out a full retry.
      const unopened = sealedFps.some((f) => f[0] === 'X');
      if (preState === 3 && seat.hasCoord && seat.occ.size <= 1 && shrankSolo && list.length && !ids.length && unopened) {
        sealedSoloRuns++;
        // STALE-KEY MEMBER = A DOOR CHALLENGE (Nathan's law, 2026-07-29). Root
        // cause of the terminal fork: a member who RELOADS while the room's
        // password is mid-rotation (the relay's courtesy gate is briefly OPEN
        // between a clear and the next set) re-enters from persisted
        // credentials a KEY GENERATION BEHIND — seated, alone, sealed away
        // from everyone, and never challenged. Proven: the stranded half
        // carries pwEpoch=1 with an EMPTY page-life pw ledger (a reload) and
        // no relay rejection anywhere in the run. She is not a stranger and
        // not a crash victim: she is a member holding a stale key, and the
        // honest UI for that has existed all along — the R6 password prompt.
        // A human types the current password, the key re-derives, the door
        // opens. Narrowly gated (SOLO + shrank + repeated sealed-only
        // replies), so the transient post-rotation case that must NOT prompt
        // the setter — a seated member whose neighbours' re-knocks are still
        // in flight — never reaches it.
        if (sealedSoloRuns >= 4 && !olderSeen) fireLocked();   // ...never over blobs a key I replaced opens: their writers are behind me (a setter left alone with a stale member)
        if (opts.onFragment) { try { opts.onFragment([], { shrank: true, sealedOnly: true, runs: sealedSoloRuns }); } catch (e) {} }
      } else if (ids.length || !list.length || !unopened) sealedSoloRuns = 0;
      // BEHIND THE ROOM'S KEY (a member who missed a password
      // change stays out, and is TOLD so). A seated page whose door serves
      // only blobs that neither my key nor any key this room used before it
      // can open was away while the password changed. Its channels are sealed
      // under the old key, so it hears nobody new, yet its view can still
      // list the room (frames sent before the change arrive after a dark
      // spell and read as fresh). Without this it sat seated under a "just
      // you" line until four sealed replies piled up, minutes later; the
      // password prompt is the answer at the first such reply. The cases the
      // count above guards are told apart exactly: a setter, or a member that
      // just took the new key, opens its neighbours' not-yet-re-keyed blobs
      // with the key it replaced.
      // A page still hearing someone under its own key is not behind it: junk at the door proves nothing.
      if (preState === 3 && seat.hasCoord && list.length && !ids.length && !olderSeen && sealedFps.some((f) => f[0] === 'X') && !(raw && Array.from(raw.occ).some(([k, v]) => { const at = v !== raw.id ? raw.live.get(k) : undefined; return at !== undefined && raw.TICK - at <= 16; }))) fireLocked();   // 16 ticks: two beats
      if (preState === 3 && ids.length && seat.hasCoord && seat.occ.size <= 1 && (shrankSolo || (env.TICK - (seat.seatedAt || 0)) > 90)) {
        greeterTrace.push({ t: Date.now(), tick: env.TICK, state: preState, post: seat.state,
          listLen: list.length, open: ids.length, founded: !!m.founded, action: 'fragment-rescue', sealed: sealedFps });
        if (greeterTrace.length > GREETER_TRACE_CAP) greeterTrace.shift();
        if (opts.onFragment) { try { opts.onFragment(ids.slice(), { shrank: shrankSolo }); } catch (e) {} } // the ID LIST — the app filters stale/tombstoned evidence; shrank says THIS page watched the room collapse (fork suspect, not a reload-mash newborn)
        // ...and the seat sees the same list (mesh.js loneGreet): the app
        // stands down when a connection is already up, and a solo seat whose
        // channel to the other fragment is open still has to SAY something on
        // it — nothing else it does addresses a seat it does not hold.
        penv.relayFrame({ t: 'greeters', list: ids, at: atOf(ids), nt: ntOf(ids) });
        return;
      }
      if (list.length && !ids.length) {
        action = preState !== 3 ? 'locked' : 'drop-seated-sealed';
        if (preState !== 3) fireLocked(); // R6: sealed list I can't read — wrong password (joiners only)
      } else if (!ids.length && !m.founded) {
        action = 'hold-mint-gap';                                         // hold; the join loop re-knocks
        if (preState === 3) penv.relayFrame({ t: 'greeters', list: [] });   // ...but a SEATED seat learns nobody else is registered: its old list may name the departed
      } else {
        // empty+founded + still joining ⇒ R3/R6 take-over mints 0/0.0;
        // empty+founded while already seated is a no-op (mesh.js gates on state===0).
        // Non-empty ⇒ deliver greeter ids (gateway pick).
        if (!ids.length && m.founded) action = preState === 0 ? 'MINT' : 'empty-founded-noop';
        else action = 'deliver';
        // RELOAD TREE MEMORY: the doors this page sat with before its reload go first (treeMemAsk asks them all at once)
        if (prevOld && preState !== 3 && ids.length) { const old = ids.filter((p) => prevOld.has(p)); treeAsk = old.map((p) => layer.ids.nid(p)); ids.sort((a, b) => (prevOld.has(b) ? 1 : 0) - (prevOld.has(a) ? 1 : 0)); prevOld = null; }
        penv.relayFrame(m.admitted === false && !m.founded && preState === 3 && iAmAGreeter() ? { t: 'greeters', list: ids, at: atOf(ids), nt: ntOf(ids), tag: 1 } : { t: 'greeters', list: ids, at: atOf(ids), nt: ntOf(ids) }); // the seat's L16 knocker takes it from here. L3.11.6: admitted:false to a seated Section-1 seat rides the list (tag 1): the seat asks a listed mate for the door's key and registers again
      }
      // `adm` is the relay's `admitted`: does my genesis key match the room's?
      // Nothing ACTS on it — but its absence from this trace is why the
      // ghost-genesis brick (healing-laws R3a) took a relay-side instrumented
      // rebuild to see. A seated Section-1 greeter whose E3 registration is
      // being silently dropped (`knock()` stores a blob only when admitted)
      // looks, from the client, exactly like a room where nobody else is
      // registering. Record the one bit that tells those two apart.
      greeterTrace.push({
        t: Date.now(), tick: env.TICK, state: preState, post: seat.state,
        listLen: list.length, open: ids.length, founded: !!m.founded, adm: !!m.admitted, action, sealed: sealedFps,
      });
      if (greeterTrace.length > GREETER_TRACE_CAP) greeterTrace.shift();
      // A seated Section-1 greeter looking at an EMPTY pool is looking at a
      // door with no doorman — the very knock a joiner would stall or FOUND
      // on. My own entry is never in my replies (the relay excludes the
      // asking socket), so an empty reply is the one reliable "pool is bare"
      // signal I get. Re-register (throttled; a reply chain can't loop).
      // NB: after reregister()'s own 8s throttle, a solo greeter settles at
      // E3/keepalive cadence — this adds no steady-state relay traffic.
      if (!ids.length && preState === 3 && iAmAGreeter()) reregister('empty-pool');
    }

    // THE NETWORK EDGE (see tick's SELF-PARTITION HOLD): dark-era silence is
    // not evidence (netHold, both edges), and at the return the dark span is
    // an ABSENCE (mesh.js absence): the clock held still through it, so every
    // first-hand stamp is now that many ticks older than it reads. Taken on
    // the first tick OR the first frame after the edge, whichever comes
    // first: a pair rebuilt at the return can deliver its peer's HELLO before
    // a throttled clock's next tick, and the seat judged it on the dark-era
    // view (the mate first-hand live at its old cell: a probe opened), then
    // the late edge wiped the probe — the claim was lost (preset 14a).
    function netEdge() {
      const netDark = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (netDark !== wasNetDark) {
        wasNetDark = netDark;
        if (netDark) netDarkAt = Date.now();
        else if (netDarkAt) { const n = Math.floor((Date.now() - netDarkAt) / tickMs); netDarkAt = 0; try { if (n > 0) penv.absence(n); } catch (e) {} }
      }
      return netDark;
    }
    function startLoop() {
      // THE TICK CLOCK IS A WORKER where one exists (G1 sender side): this
      // one interval drives seat.tick(), the 55s greeter keepalive and the
      // 12s zombie watchdog — on a backgrounded phone a DOM setInterval
      // stretches into 25-60s chunks, so the keepalive arrives late enough
      // for a NAT to zombie the socket and the watchdog to miss it. Worker
      // messages are not timer-aligned, so the cadence holds while the page
      // is throttled. (A fully frozen renderer stops these too — that is the
      // relay's E3 reopening clause's case, not ours.) Node/sim and any
      // Worker-less context keep the plain interval.
      const tick = () => {
        if (stopped) return;
        // SELF-PARTITION HOLD (behavior battery 06c, 2026-07-26): when the OS
        // says this device has NO network, every silence in the room is OUR
        // silence — running the mesh would confirm every neighbour dead (a
        // solo ring confirms alone), free their seats, and HEAL ourselves
        // into 0/0.0: a seated self-mint fragment, the exact tear the veil
        // law forbids at the door. D3's own law is the model: "a severed-but-
        // alive seat simply re-announces itself when it recovers". So hold
        // the mesh perfectly still (a frozen tab does the same and recovers
        // cleanly); the socket-maintenance below keeps running so the return
        // reconnects on the spot.
        const netDark = netEdge();
        if (!netDark) {
          // THE CLOCK IS WALL TIME, NOT TIMER FIRES. Every absence rule in
          // mesh.js (NBR_GAP, D5 holds, the row horizons) counts ticks, and a
          // browser under load, thermal throttling or battery saver fires
          // this timer late (behavior 14a: a phone's seat ran at half speed,
          // so a 35 s dead spot counted 32 ticks, under NBR_GAP = 60, and the
          // returning head never read as fresh again). Ticks owed are the
          // wall time elapsed over tickMs; late fires catch up, up to
          // TICK_CATCHUP per fire. A gap past TICK_FREEZE_MS is a frozen or
          // backgrounded tab, not a slow one: it runs ONE tick, as before (a
          // frozen tab must not wake up and confirm its whole neighbourhood
          // dead; the freeze detector owns that case).
          // ONLY THE WORKER CLOCK IS WALL TIME. A Worker's posts are a clock
          // (one page, one seat, a thread of its own): a post that arrives
          // late is time the seat lost. The plain interval (Node, the
          // harnesses, a page whose CSP refused the Blob Worker) is a tick
          // generator, as in the sim: one fire is one tick, and tickMs is
          // the harness's time scale, not a promise about wall time.
          // test/mesh/flood.js runs 500 seats at 25 ms ticks in one process;
          // its event loop runs tens of ticks behind under the gate's load
          // (measured: 88% of fires 4+ ticks late while seat.tick() took 9%
          // of the wall time — the loop is full of the harness's own
          // frames), and catching up there ran the protocol at wall speed
          // against latencies the load had stretched: the 500-joiner burst
          // under RELAY_PROD=1 deadlocked at 16 seated. The relay's meters
          // never struck (0 strikes, 0 cuts): a 20x-accelerated protocol's
          // tick-counted timeouts simply had no slack left.
          const nowT = Date.now();
          let n = 1;
          if (workerClock && lastTickAt > 0) {
            // NEVER AHEAD OF THE WALL: lastTickAt is the wall time the ticks run so far
            // stand for, not the last fire. A busy main thread gets the Worker's queued
            // posts back to back: the first one catches the stall up, and a per-fire
            // clock ran one more tick for every post behind it, so a slow device's seat
            // ran a minute ahead of real time. Every silence it timed was inflated: it
            // read a live neighbour as gone (L9.12 echo) and pulled healthy seats out of
            // their own seats into that neighbour's cell, again and again.
            // The frozen gap is an ABSENCE (mesh.js absence): one tick runs,
            // and every first-hand stamp ages by the ticks the gap held.
            const w = wallTicks(lastTickAt, nowT, tickMs);
            n = w.n; lastTickAt = w.at;
            if (w.absent > 0) { try { penv.absence(w.absent); } catch (e) {} }
          } else lastTickAt = nowT;
          for (let i = 0; i < n && !stopped; i++) { penv.tick(); env.TICK = penv.world.TICK; layer.afterTick(); }
          treeMemAsk(); refreshPreLeave();
        } else lastTickAt = 0;
        if (seat.stranded && !strandedFired) { strandedFired = true; if (opts.onStranded) opts.onStranded(); }
        // Socket lifecycle, as the seat's socketed(): a joiner until seated, a greeter while it is one, a seat lost from the mesh that knocks. Anyone else is done with the relay: drop after a grace.
        const needsRelay = !raw || raw.socketed();
        if (needsRelay) deepSince = -1;
        else if (deepSince < 0) deepSince = env.TICK;
        // FHOP.8: the call to the door is over and I sit deep: off the door list now (the relay also ends a door-call entry on its own clock)
        { const dcNow = doorCalled(); if (dcWas && !dcNow && !(raw && raw.hasCoord && raw.state === 3 && raw.coord.pc === 0)) { sendRaw({ t: 'unlist' }); if (opts.trace) { try { opts.trace('{"t":' + (env.TICK | 0) + ',"s":' + raw.id + ',"e":"DOOR-CALL-END","c":null,"d":"unlisted"}'); } catch (e) {} } } dcWas = dcNow; }
        // Off the door's list before the socket goes. A seat that a room merge moved from Section 1 to a deep cell keeps its listing while it
        // sees the merge (L16.4 stands down there, L16.12), and a listed socket that closes with no unlist is the relay's death word for a
        // live seat: every greeter closed its connection to it as a lost one, and the seat left its cell as cut off (D6c) a lease later.
        if (dropDeep && !needsRelay && sock && deepSince >= 0 && env.TICK - deepSince > 20) { try { sendRaw({ t: 'unlist' }); } catch (e) {} try { sock.close(); } catch (e) {} sock = null; }
        if (needsRelay && !sock) makeSock(); // re-arm reachability (a policy-REJECTED socket stays down — see sendRaw)
        // The door refused my socket for want of the room's password (4003):
        // a password changed while I was away, the same verdict as a sealed
        // door (R6), so the same challenge. Not within 15 s of my own key
        // change: my new proof can still be on its way.
        if (sock && sock.rejected === 4003 && Date.now() - keySetAt > 15000) fireLocked(true);
        if (sock && sock.rejected && !rejFired) { rejFired = true; try { const L = (window.__pwLog = window.__pwLog || []); L.push(Date.now() + ' relay-socket REJECTED code=' + sock.rejected + ' — door unreachable'); if (L.length > 64) L.shift(); } catch (e) {} if (opts.onRejected) { try { opts.onRejected(sock.rejected); } catch (e) {} } }
        // Greeter socket health (wire-level, not mesh law — the sim has no
        // sockets). A NAT/middlebox drops a silent websocket without telling
        // either end; the socket then reads OPEN while every send vanishes (a
        // ZOMBIE). E3's 100-200s cadence sits beyond common idle timeouts, so
        // a zombied greeter silently falls out of the pool — the door goes
        // unmanned while the greeter believes it is still on duty (the
        // production monitor spent hours in exactly this state).
        // Shrink detection (see the shrankSolo declaration). The first cut
        // tracked only the last-tick transition >=2 -> 1 and a fork LAUNDERED
        // it: the compacting half REQUEUES (state leaves 3, the counter reads
        // 0) and re-seats already-solo — no transition ever seen. Page-life
        // memory can't be laundered: once this page has BEEN in a populated
        // room, any seated-solo state is a fragment suspect until the door
        // itself says we are truly alone (onGreeters disarms) or the room
        // repopulates.
        {
          const osz = (seat && seat.state === 3 && seat.hasCoord) ? seat.occ.size : 0;
          if (osz >= 2) { everPopulated = true; shrankSolo = false; roomDoor = doorNow(); }
          else if (osz === 1 && everPopulated) shrankSolo = true;
        }
        {
          const nl = (seat && seat.state === 3 && seat.hasCoord) ? seat.linkPeers().size : -1;
          if (nl > 0) { everLinked = true; cutSince = 0; } else if (nl === 0 && everLinked) { if (!cutSince) cutSince = Date.now(); } else cutSince = 0;
        }
        if (iAmAGreeter() && sock && !sock.rejected) {
          const nowMs = Date.now();
          if (regPendingAt && nowMs - regPendingAt > 12000) {
            // a registration the relay never answered ⇒ zombie socket:
            // rebuild it (the fresh socket's onopen re-registers).
            regPendingAt = 0;
            try { sock.close(); } catch (e) {}
            sock = null; makeSock();
          } else if (nowMs - lastRelayRx > 55000) {
            // idle keepalive: re-register before any middlebox forgets the
            // pipe; the greeters reply doubles as proof the socket is alive.
            reregister('keepalive');
          } else if (seat.state === 3 && seat.occ.size <= 1
              && (shrankSolo || (env.TICK - (seat.seatedAt || 0)) > 90)
              && nowMs - lastRegAt > (shrankSolo ? 3000 : 30000)) {
            // SOLO-ROOM DOOR PROBE (fragment self-rescue's trigger): a seated
            // room-of-one asks the door every 30s whether it is truly alone —
            // the idle keepalive above never fires while stray relay traffic
            // keeps the socket "busy", which is exactly a fragment's state.
            // The greeters reply lands in onGreeters' fragment-rescue branch.
            // A room that SHRANK to one skips the 90-tick founder-grace and
            // probes within ~3s — the 2-person fork's heal window (see
            // shrankSolo) must beat human patience, not a cadence.
            reregister(shrankSolo ? 'shrank-solo' : 'solo-probe');
          } else if (seat.state === 3 && cutSince && nowMs - cutSince > 4000) {
            // CUT-OFF DOOR PROBE: every link of mine closed (transport loss) while my relay socket
            // stayed up. My view can still name half a row (the Section-1 ledger), so the solo
            // probe above never fires, and every redial to a lost peer is held (L17) until I hear
            // it. The seat's lone greeting (loneGreet) greets the door list, and the only list it
            // holds is the one from my join: ask the door now (reregister keeps 8 s between asks).
            reregister('cut-probe');
          }
        }
        if (opts.onUpdate) opts.onUpdate(node);
      };
      if (typeof Worker !== 'undefined' && typeof URL !== 'undefined' && typeof Blob !== 'undefined') {
        try {
          const w = new Worker(URL.createObjectURL(new Blob(
            ['setInterval(function(){postMessage(0)},' + (tickMs | 0) + ')'], { type: 'text/javascript' })));
          w.onmessage = tick;
          timer = { worker: w }; workerClock = true;
          return;
        } catch (e) { /* CSP or platform said no — the plain interval below */ }
      }
      timer = setInterval(tick, tickMs);
    }

    // Build the seat once the peer id (and, for S4, the identity) is known, then
    // start the socket + join loop. Deferred when we must mint the keypair
    // first (WebCrypto is async); otherwise runs synchronously.
    function build() {
      const need = ['meshSeat', 'meshMsg', 'meshPortLayer', 'meshPageEnv'];
      for (const g of need) if (!GifOS[g]) { const e = 'mesh-port missing ' + g; try { console.error(e); if (opts.onMissing) opts.onMissing(g); } catch (x) {} throw new Error(e); }
      layer = GifOS.meshPortLayer.create({
        peer, raw: () => raw,
        emit: (to, f) => { if (!stopped || f.t === 'GSP') env2send(to, f); },
        onGossip: opts.onGossip ? (src, m, ag, scoped, link) => (stopped ? undefined : opts.onGossip(src, m, (ag || 0) * tickMs, !!scoped, link)) : null,
        ckey: (c) => net.topo.ckey(c), ownedLinks: (c) => net.topo.ownedLinks(c),
        pipes: () => (penv ? penv.pipePeers() : []),   // the far ends of my joining connections that are up: room-wide traffic crosses them
      });
      seat = layer.view; seat.answerDoor = answerHeld; seat.recheckDoor = recheckHeld;
      penv = GifOS.meshPageEnv.create({
        peer, ids: layer.ids, seat: () => raw, tickMs,
        pc: Object.assign({}, opts.pc || {}, { send: (to, m, dir) => ((typeof opts.dcOpen !== 'function' || opts.dcOpen(to)) ? sendFrameTo(to, m, dir) : false) }),
        relay: {
          knock: (gk, blobOk) => { const k = gkStr(); /* the room's string, as every register presents it ('g' + hex): a decimal genKey was refused (admitted:false), and three refusals requeued a seated greeter */ if (blobOk && iAmAGreeter()) REGISTER_MYSELF_AS_A_GREETER(gk || k); else KNOCK_FOR_THE_GREETER_LIST(gk || k); },
          unlist: () => sendRaw({ t: 'unlist' }),
          busy: (to, body) => { if (opts.relayBusy) { try { opts.relayBusy(to, body); } catch (e) {} } },
        },
        send: (to, m, dir) => sendFrameTo(to, m, dir, true),   // FHOP's sponsored frames: deliver -> opts.sendDC -> the page's rungs, never the relay
        fhop: opts.fhop || null,
        sub: opts.sub || null,   // the page's link manager for rooms joined by relayed connections: { ask(), pipeEnds() }
        levers: opts.levers || null,   // the page's levers (run.html: islands found under the meeting key of the link)
        measure: opts.measure || null,
        trace: opts.trace || null,
        onLinks: opts.onLinks || null,
        onLeft: (reload) => { if (opts.onLeft) { try { opts.onLeft(reload); } catch (e) {} } },
      });
      raw = penv.newSeat ? penv.newSeat() : new GifOS.meshSeat.Seat(penv.me, penv.world);   // the seat is mine (A3); env.seat() reads it back
      penv.world.onRecv = () => { if (!stopped) netEdge(); };
      if (opts.oldCell >= 0) raw.oldCell = opts.oldCell + 1;   // L3.10 (key + 1, 0 is none): my cell before this page loaded: the door's HOME sends me to its neighbours first
      node.seat = seat; node.raw = raw; node.penv = penv; node.__pc = opts.pc || {};
      makeSock();
      if (penv.join) penv.join(); else raw.join();
      startLoop();
      readyResolve(node);
    }
    function env2send(to, f) {   // gossip I author is signed once per gid; one I forward carries its author's block
      if (ident.GOSSIP_T && ident.GOSSIP_T.has(f.t) && !f.s4) {
        if (f.src !== peer) return;
        let pr = gsig.get(f.gid);
        if (!pr) { pr = ident.signGossip(identity, f); gsig.set(f.gid, pr); if (gsig.size > 512) { const it = gsig.keys(); for (let i = 0; i < 128; i++) gsig.delete(it.next().value); } }
        const early = !stopped;
        const q = pr.then((s) => { if (!stopped || early) { f.s4 = s; deliver(to, f); } }).catch(() => {});
        if (early) { gflight.add(q); q.then(() => gflight.delete(q)); }
        return;
      }
      deliver(to, f);
    }
    const gpins = ident.newPins();

    const node = {
      peer, seat: null, env, whenReady: ready,
      // The per-participant identity (S4). pub key + peer-id = H(pubkey); the
      // private key never leaves. null when S4 is off (legacy peer).
      get identity() { return identity; },
      // DataChannel ingestion: the DC layer hands OPENED control objects here
      // (production unwraps its own sealed frames; {mw:1, m} envelopes route m).
      // A stale-key frame's one way in: a plain or reload LEAVE of the seat the channel belongs to (ingest still checks its signature).
      isOwnGoodbye(m, pid) { try { const f = GifOS.meshMsg.readMsg(m.f); return m.t === 'MW2' && f.t === 'LEAVE' && !!f.bye && !f.mvd && String(layer.ids.pid(f.id)) === String(pid); } catch (e) { return false; } },
      recvCtl(m, via, direct, origin) { if (!stopped && seat && m) ingest(m, via, direct, origin); }, // via: the delivering peer; direct === true ONLY for a frame off that peer's own DataChannel (run.html's pair intake) — never for a sponsor envelope or the relay
      // Room-wide app traffic (chat/status/votes/files): flood over the mesh —
      // the relay session is only the greeter pool now, not the room.
      gossip(payload, opts) { if (!stopped && layer) layer.gossip(payload, opts); }, // opts: { scope: 'section', ephemeral } — see js/mesh/page/layer.js
      // § G / G9 — the rollup digest's application face (healing-laws § G).
      // setLeaf: THIS seat's own room-global facts (hand, stage claim, app ad,
      // away, votes) — the next fold reads them. setRefuses: my own first-hand
      // consent state, the only place a refusal is born (G3). roomDigest: the
      // room fold as this seat last computed or heard it, with its age in
      // ticks — DISPLAY input only (G1): nothing may evict, seat or unblur on it.
      setLeaf(f) { if (layer) layer.setLeaf(f); },
      // TEST ONLY — a hostile client speaking in someone else's name: frames
      // with src = `who`, signed with MY key (a valid signature by the wrong
      // author), pushed past send()'s author check straight to my links.
      _forgeGossipForTest(who, payloads) {
        if (!seat || !identity || !ident.signGossip) return 0; let n = 0;
        for (const m of payloads) { const f = { t: 'GSP', gid: who + ':forge' + (++n) + ':' + Date.now(), src: who, m }; ident.signGossip(identity, f).then((s4) => { f.s4 = s4; for (const p of seat.linkPeers()) deliver(p, Object.assign({}, f)); }); }
        return n;
      },
      _signGossipForTest(f) { return (identity && ident.signGossip) ? ident.signGossip(identity, f) : Promise.resolve(''); },   // TEST ONLY — my own signature on a frame I hold back
      // THE DOOR'S COUNT (run.html subscriptions): a seated greeter asks the relay for the greeter list NOW, by
      // registering again; the reply is the usual greeters frame (opts.onDoor). One ask at a time, and only a
      // knocker arriving starts one, so it adds one relay frame per newcomer. false: not a greeter, no list to ask for.
      recountDoor() {
        if (stopped || !seat || !iAmAGreeter()) return false;
        if (!recountOut) { recountOut = true; lastRegAt = regPendingAt = Date.now(); REGISTER_MYSELF_AS_A_GREETER(gkStr()); greeterTrace.push({ t: Date.now(), tick: env.TICK, state: seat.state, post: seat.state, listLen: -1, open: -1, founded: false, action: 're-register:door-count' }); if (greeterTrace.length > GREETER_TRACE_CAP) greeterTrace.shift(); }
        return true;
      },
      socketed() { return !raw || raw.socketed(); },   // the seat's own word: am I at the door (a joiner, a greeter, a seat that knocked)
      setRefuses(b) { if (layer) layer.setRefuses(b); },
      roomDigest() { return layer ? layer.roomDigest() : null; },
      // ROOMS JOINED BY RELAYED CONNECTIONS. sub: my door's number (0: the first room). door(): { sr, sg } for a door
      // other than the first (sg: the grant handed to subGo, or null), else null. subGo(r, sg): the answer to the page's
      // ask (opts.sub.ask): my door is r. With r my own door and a grant: a fresh grant for it, and I register again. meetingCount(): the people in the whole meeting, null while unknown.
      // knownSub(r): room r's people are in my count. standbyCands(): see js/mesh/page/layer.js.
      get sub() { return raw ? raw.sr : 0; },
      door() { return raw && raw.sr > 0 ? { sr: raw.sr, sg: subGrant } : null; },
      subGo(r, sg) {
        if (stopped || !penv || !raw) return false; const g = (typeof sg === 'string' && sg) ? sg : null;
        if (raw.sr === 0) { subGrant = g; /* before the seat knocks at its new door */ return penv.subGo(r); }
        if (r !== raw.sr || !g || raw.state !== 3) return false;   // any other door is refused once my door is not the first
        subGrant = g; raw.emitRelay(raw.genKey); return true;   // a fresh grant for my own door (its door stood empty): I register with it
      },
      meetingCount() { return layer ? layer.meetingCount() : null; },
      knownSub(r) { return !!penv && penv.knownSub(r); },
      standbyCands() { return layer ? layer.standbyCands() : []; },   // the display fold beside the seat (layer.js leaf)
      // App access to the wire's relay socket (the ONE socket): signaling
      // fallback ({t:'peer'}), moderation verbs (setpw/ban/votekick), etc.
      // Recreates the socket on demand, same as the mesh's own sends.
      // (5) FIRST-CONTACT SIGNALING for the app layer (run.html). A WebRTC
      // pair cannot bootstrap over a DataChannel it does not have yet, so the
      // offer/answer that CREATES the first channel needs some path. run.html
      // applies §FWD before it ever reaches here — its own DataChannel, then a
      // sponsor forward through the mesh, and only then this — so what arrives
      // is traffic with no peer path at all. It is named and listed here rather
      // than left as an anonymous export, because an unnamed way to reach the
      // relay is exactly how the last one crept in.
      RELAY_FIRST_CONTACT_SIGNALING(obj) { sendRaw(obj); },
      relaySend(obj) { sendRaw(obj); },   // legacy alias — callers should move to the named form
      // A write that skips the law's outbound gate: what a modified page
      // could do. Only a page running with DEBUG=on exposes it (run.html
      // relayRawSendUnchecked), to prove the relay refuses such a frame
      // when its switch is on.
      // T8 (DEBUG pages only, run.html gates it): a real seat frame of type ty claiming `claimId` (default: me),
      // sent on the open dc to `to` with a garbage signature or none, so the receiver's unsigned path runs.
      // how:'alter': signed for real by me, then `alter` changes the frame on its way out, as a dishonest forwarder would.
      FORGE_FRAME_FOR_TEST(to, ty, fields, how, alter) {
        if (stopped || !raw) return { err: 'stopped' };
        const msgM = GifOS.meshMsg; let m;
        try { m = msgM.newMsg(String(ty)); } catch (e) { return { err: 'bad type' }; }
        const own = (v) => (v === '$me' ? raw.id : v === '$ck' ? (raw.hasCoord ? GifOS.meshTopo.ckey(raw.coord) : 0) : v === '$tn' ? raw.tn : v);
        for (const k of Object.keys(fields || {})) m[k] = own(fields[k]); if (m.id === -1 || m.id === undefined) m.id = raw.id; if (m.from === -1) m.from = raw.id; if (!m.sig && !m.fsig && !(m.fo >= 0)) m.sig = true; m.to = layer.ids.nid(String(to));
        let f; try { f = msgM.writeMsg(m); } catch (e) { return { err: 'encode' }; }
        const out = { t: 'MW2', f };
        const sendIt = () => !!(opts.sendDC && opts.sendDC(String(to), out, peer));
        if (how === 'alter') {
          const ts = Date.now(), core = coreOf(msgM, m), rc = relayCoreOf(msgM, m), sign = (c) => net.edSign(identity.priv, JSON.stringify({ v: 3, c, ts }));
          return Promise.all([sign(core), rc ? sign(rc) : null]).then(([sig, r]) => {
            out.s4 = { ts, sig, pub: identity.pubB64 }; if (r) out.s4.r = r;
            const a = msgM.clone(m); Object.assign(a, alter || {}); out.f = msgM.writeMsg(a);
            if (r && coreOf(msgM, a) === rc) out.s4 = { ts, sig: r, pub: identity.pubB64 };   // posing as a relay: it carries the relay form's signature
            return sendIt() ? { ok: true, ty: m.t, claim: claimOf(a), how, signedCoreSame: coreOf(msgM, a) === core } : { err: 'no open dc' };
          });
        }
        if (how !== 'nosig') out.s4 = { ts: Date.now(), sig: 'AAAA' + Math.random().toString(36).slice(2), pub: identity.pubB64 };
        const sent = sendIt();
        return sent ? { ok: true, ty: m.t, claim: claimOf(m), how: how || 'garbage' } : { err: 'no open dc to ' + String(to).slice(0, 8) };
      },
      RAW_SOCKET_SEND_FOR_TEST(obj) { if (stopped) return { err: 'stopped' }; if (!sock) makeSock(); if (sock.rejected) return { err: 'rejected' }; sock.send(obj); return { ok: true }; },
      relayUp() { return !!(sock && sock.state === 'up'); },
      // The network came back after a dark spell: read the door again now
      // (re-register as a door, or ask for the list), so a change made while
      // I was away — a new room password above all — shows at once (R6).
      netBack() { if (stopped || !seat) return; if (iAmAGreeter()) { lastRegAt = 0; reregister('net-back'); } else if (seat.state === 3) KNOCK_FOR_THE_GREETER_LIST(gkStr()); },   // once per dark return, so not throttled: a register sent into the dark never reached the door
      // Password change re-keyed the room (§LOCK): adopt the NEW key for every
      // wire seal/open, and — if this seat is a Section-1 greeter — re-knock
      // NOW so the registry blob re-seals under it. Without this, newcomers
      // holding the new password can't decrypt any greeter blob (R6 reads as
      // "wrong password") until every greeter's E3 re-knock… which would also
      // have used the stale key, locking them out until a reload.
      setKey(k) { if (k) { if (k !== roomKey) { oldKeys.unshift(roomKey); if (oldKeys.length > 4) oldKeys.length = 4; keySetAt = Date.now(); lockedFired = false; doorFired = false; /* a new key re-arms the door challenge: a seated page re-keys in place (no new node), and a later change it misses must still ask */ } roomKey = k; sealedSoloRuns = 0; /* the counter means "sealed replies under MY CURRENT key" — evidence gathered under the old key must not fire a challenge past a re-key */ try { if (sock && sock.rejected) sock.kick(); } catch (e) {} /* credential change: the ONE sanctioned re-arm of a policy-rejected socket */ try { if (seat && seat.hasCoord && seat.state === 3 && seat.coord.pc === 0) { lastRegAt = 0; /* the old key's blob is what the door serves until this lands: never wait out the throttle */ reregister('setkey'); } } catch (e) {} } },
      stats() { return { peer, state: seat ? seat.state : 0, coord: (seat && seat.hasCoord) ? { pc: seat.coord.pc, r: seat.coord.r, i: seat.coord.i } : null, stranded: !!(seat && seat.stranded), tick: env.TICK, relayRefused, relayUnsent, adapter: (penv && penv.stats) ? penv.stats() : null, closes: relayCloses.slice() }; },
      // Greeter-list forensics: ring of recent onGreeters outcomes (listLen /
      // open / founded / action). See greeterTrace push in onGreeters.
      greeterTrace() { return greeterTrace.slice(); },
      // My latest door reply held blobs that no key I hold or held opens: part of this room is
      // registered under a key I do not have (a password change I missed). The app lets a member
      // of that part hand me its grant over the relay (run.html §LOCK door-side heal).
      doorAhead() { return doorAheadN > 0; },
      // Fork-heal wire state (forensics): is the fragment suspicion armed,
      // how stale is the last registration, and the recent door replies.
      fragState() { return { shrank: shrankSolo, everPop: everPopulated, occ: seat ? seat.occ.size : -1, lastRegAgoMs: lastRegAt ? Date.now() - lastRegAt : null, trace: greeterTrace.slice(-4) }; },
      // Probe-confirmed deaths since the last drain (consume-once). The app's
      // departure intake reads these as facts — diffing occ misses a death
      // whose heal rebuilt the view in the same tick (sole-survivor promotion).
      drainDeaths() {   // [cellKey, peer]: the seat's own death verdicts since the last drain (env.js deathLedger), never a cell that only left my view
        if (!seat || !penv || !penv.drainDeaths) return [];
        const named = new Set(seat.occ.values()), out = [];
        // a verdict is on a cell: a member my view still seats at another cell moved, and is not gone
        for (const [k, x] of penv.drainDeaths()) { const p = layer.ids.pid(x); if (p && !named.has(p)) out.push([k, p]); }
        return out;
      },
      // D5-observation forensics: the seat's standing translosts, its recent
      // forgotten ones (tlLog carries WHY each was dropped), and the occ view —
      // so a stalled departure confirm is attributable to ONE law from a test.
      tlState() {
        return seat ? {
          tick: env.TICK, st: seat.state,
          coord: seat.hasCoord ? seat.coord.pc + '/' + seat.coord.r + '.' + seat.coord.i : null,
          occ: Array.from(seat.occ.entries()).map(([k, v]) => k + ':' + String(v).slice(0, 6)),
          tl: Array.from(seat.translost.entries()),
          tlLog: [],
        } : null;
      },
      // R5/E5§2: after onFork, the app picks one genesis key; seat joins only that room.
      myCell() { return raw && raw.state === 3 && raw.hasCoord ? GifOS.meshTopo.ckey(raw.coord) : -1; },   // for the page's seat memory (L3.10)
      // reload: the page may be coming back with this identity (L3.11). Its plain goodbye goes first, for the far end to hold.
      // None pre-signed for what I would say now: then it is a plain leave, or a closed tab would hold its cell for a whole lease.
      byeIsHeld(pid) { return byeHeld.has(String(pid)); },
      byesHeld() { return byeHeld.size; },   // pages gone whose cell is held: no face, no head in the count
      leave(reload) { if (reload && !sendHeldByes()) reload = false; try { if (raw) { if (penv && penv.leave) penv.leave(!!reload); else raw.leave(!!reload); } } catch (e) {} try { if (sock) sendRaw({ t: 'unlist' }); } catch (e) {} node.stop(); },   // goodbye to the peers, then off the greeter list, then the socket closes: no greeter-gone for a page leaving in order
      // Transport events from the page's pc/dc callbacks and watchdogs (env.js maps hard/quiet and debounces).
      remeasure() { netWordChanged(); /* L4.1.1: the page env's tick reads the verdict itself (js/mesh/page/env.js tick: nat, cnat, l411Verdict), so a verdict that lands after the join is acted on at the next tick; nothing to do here */ },   // a network verdict that lands after the join (seat.join reads it once)
      doorForgive(pid) { if (penv && penv.doorForgive) penv.doorForgive(String(pid)); },
      transport(pid, ev, arg) { if (stopped || !penv) return undefined; try { return penv.transport(String(pid), ev, arg); } catch (e) { return undefined; } },
      dialHeld(pid) { if (stopped || !penv || !penv.dialHeld) return false; try { return penv.dialHeld(String(pid)); } catch (e) { return false; } },
      mark(pid) { if (stopped || !penv || !penv.mark) return null; try { return penv.mark(String(pid)); } catch (e) { return null; } },   // A2's mark my answer carries back
      // A sealed relay `busy` frame from a door (opened by the page): the seat's world turns it into BUSY.
      relayBusyIn(from, d) { if (stopped || !penv) return; try { penv.relayFrame({ t: 'peer', from: String(from), ty: 'busy', d }); } catch (e) {} },
      nidOf(pid) { return layer ? layer.ids.nid(String(pid)) : -1; },
      doorNet(pid) { return (layer && penv && penv.doorNet) ? penv.doorNet(layer.ids.nid(String(pid))) : -1; },   // the network tag the door's last list gave this greeter, against mine: 1 mine, 0 another network, -1 none
      pidOf(n) { return layer ? layer.ids.pid(n) : null; },   // the peer id of a seat number (TURN: the door's list as peer ids)
      tickMs() { return tickMs; },   // DEBUG teleport: a peer id as the seat's number
      setKicks(peers) { if (layer) layer.setKicks(peers); },   // L27: whom I vote off (peer ids)
      kickTally() { return layer ? layer.kickTally() : { tally: {}, need: {}, me: false }; },
      kickDevs(devOf) { return layer ? layer.kickDevs(devOf) : new Set(); },   // L27 across a rejoin (layer.js)
      kickCarry(peers) { return layer ? layer.kickCarry(peers) : 0; },
      kicked(peer) { return layer ? layer.kicked(peer) : false; },
      adapterStats() { return (penv && penv.stats) ? penv.stats() : null; },
      links() { return seat ? Array.from(seat.linkPeers()) : []; },
      // Resolves once every gossip frame and every seat frame handed over before now has been
      // signed and delivered, or after `ms` (the farewell's channels close
      // behind it: run.html afterFarewell).
      flushed(ms) { const all = Promise.all(Array.from(gflight).concat(Array.from(outq.values()))); return Promise.race([all, new Promise((r) => setTimeout(r, Math.max(0, +ms || 0)))]).then(() => undefined); },
      stop() { stopped = true; if (timer && timer.worker) { try { timer.worker.terminate(); } catch (e) {} } else if (timer) clearInterval(timer); timer = null; if (sock) { try { sock.close(); } catch (e) {} sock = null; } },
    };

    if (wantMint) {
      Promise.all([ident.mint(), rsFor()]).then(([id]) => {
        if (stopped) return;
        identity = id; peer = id.peerId; node.peer = peer;
        return ipProofFor().then(() => { if (!stopped) build(); });
      }).catch(() => {});
    } else {
      Promise.all([rsFor(), ipProofFor()]).then(() => { if (!stopped) build(); }, () => { if (!stopped) build(); });
    }
    return node;
  }

  // The Worker clock's arithmetic (see tick()): `at` is the wall time the ticks run so far stand
  // for. A fire owes the whole ticks since then, at most TICK_CATCHUP (the rest carry to the next
  // fire); a post queued behind a catch-up owes nothing and runs no tick. A gap past TICK_FREEZE_MS
  // is a frozen tab: one tick, the gap an absence, the clock re-based on now.
  const TICK_CATCHUP = TM.TICK_CATCHUP, TICK_FREEZE_MS = TM.TICK_FREEZE_MS;
  function wallTicks(at, nowT, tickMs) {
    const gap = nowT - at;
    if (gap > TICK_FREEZE_MS) return { n: 1, at: nowT, absent: Math.floor(gap / tickMs) };
    const n = Math.max(0, Math.min(TICK_CATCHUP, Math.floor((gap + tickMs / 2) / tickMs)));
    return { n, at: at + n * tickMs, absent: 0 };
  }

  GifOS.meshWire = { createMeshNode, goodbyeLive, wallTicks, claims: { CLAIMS, STAMPS, claimOf, coreOf, relayCoreOf, relayForm } };
})(typeof window !== 'undefined' ? window : globalThis);
