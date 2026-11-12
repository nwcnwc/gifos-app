/*
 * mesh-identity.js — per-PARTICIPANT cryptographic identity for the GifOS mesh
 * (healing-laws.md rules S4 + S5). This is the security layer that makes C3's
 * healer-authorization UNFORGEABLE: an impostor cannot sign as the designated
 * healer, so no seat capture at a distance, no turnover-race capture, no climb.
 *
 * The design in one paragraph:
 *   - ONE Ed25519 keypair per participant, minted ONCE at join (NOT per seat,
 *     NOT per coord). The public key IS the participant's name; it does not
 *     change when they move or promote. Promotion moves your COORD, never your
 *     IDENTITY.
 *   - peer id = H(pubkey). This retires the client-set-id hole: a peer can no
 *     longer hand-pick its id on the socket URL, because the id is bound to a
 *     key it must possess to speak as.
 *   - Every occupancy-authoring frame (FINDLEAF / PLACE / CLAIM — and the
 *     HELLO announce, for exchange) is SIGNED by its author over a canonical
 *     statement that commits to {t, key, from}. The receiver verifies:
 *       (1) H(pub) === the signer's peer id            (id is bound to the key)
 *       (2) the Ed25519 signature is valid over sp     (the signer holds the key)
 *       (3) TOFU: pub matches the key already pinned for this participant, or
 *           this is first contact and we pin it now.
 *     A frame that claims to be participant Q but is not signed by Q's key is
 *     REJECTED — an impostor cannot forge Q's signature, and cannot present its
 *     OWN key under Q's id because H(ownPub) !== Q.
 *   - TOFU pinning is keyed on the PARTICIPANT (peer id), not the coord, so a
 *     neighbour that has pinned a participant recognises it across links AND
 *     across moves (the same key re-appears at the new coord).
 *
 * We REUSE the WebCrypto Ed25519 helpers already in gifos-net.js (edSign /
 * edVerify / edKeysFromSeedHex / sha256hex) — the same primitives the admin
 * authority layer (docs/meet-security.md §SIG) signs its {sp,sig,pub} orders
 * with. No new crypto is invented here.
 *
 * The ONE open edge (S4, honestly named — NOT solved here): the first-contact
 * moment (join, or a total reconnect where nobody remembers your key) is
 * authenticated only by the shared room key K = "a member", not "which member".
 * Sybil and the first-pin race live there and stay open. Everything ELSE — every
 * subsequent fill, at every level — is unforgeable.
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};
  const net = GifOS.net;

  // The authoritative peer id derived from a public key: peer id = H(pubkey).
  // 40 hex chars (160 bits) of SHA-256 over the RAW 32 key bytes (net.keyId —
  // never over the base64 spelling, which is not canonical) — plenty to make
  // a collision infeasible, short enough to ride socket URLs / occ maps.
  // Prefixed 'k_' so an identity-derived id is visibly distinct from a legacy
  // client-set id (the forgeable ids this scheme retires).
  async function peerIdOf(pubB64) {
    return 'k_' + (await net.keyId(pubB64)).slice(0, 40);
  }

  // Mint a fresh per-participant identity. Called ONCE at join. The keypair is
  // deterministic in its seed, but the seed is 32 fresh random bytes, so the
  // participant key is unique and unguessable. Returns everything a seat needs:
  //   { priv, pubB64, peerId }  — priv signs, pubB64 travels, peerId = H(pubB64).
  // seedHex (64 hex): the SAME identity again — run.html hands its own seed
  // back to itself across an update reload of the same tab, so the person
  // keeps their peer id (and their seat) through it.
  async function mint(seedHex) {
    const seed = (typeof seedHex === 'string' && /^[0-9a-f]{64}$/.test(seedHex)) ? seedHex : net.randHex(32);
    const k = await net.edKeysFromSeedHex(seed);
    const peerId = await peerIdOf(k.pubB64);
    return { priv: k.priv, pubB64: k.pubB64, peerId };
  }

  const SEEN_MAX = 4096;
  const PIN_MAX = 4096;

  // A TOFU pin store: participant peer id -> pinned pubB64. First key seen for a
  // participant wins and is recognised thereafter, across links and moves.
  function newPins() {
    const map = new Map();
    const seen = new Set(); // signatures already accepted — an exact replay is refused
    const seenRl = new Set(); // ...and, apart, the relayed goodbye copies (verifyFill opt.relayed): one each
    const take = (set, sig) => {
      if (set.has(sig)) return true;
      set.add(sig);
      if (set.size > SEEN_MAX) { const it = set.values(); for (let i = 0; i < SEEN_MAX / 4; i++) set.delete(it.next().value); }
      return false;
    };
    return {
      seen(sig) { return take(seen, sig); },
      seenRelayed(sig) { return take(seenRl, sig); },
      // pin(id, pub): returns { ok, changed }. ok=false ⇒ this pub CONFLICTS with
      // the one already pinned for id (a key-swap attempt) — reject. changed is
      // reserved for surfacing a key rotation (not used to reject here).
      // The map is an LRU capped at PIN_MAX. A peer id is H(pub), so a
      // different key is a different id. Evicting an id and pinning it
      // again is the same trust as first contact. drop(id) forgets one
      // departed participant.
      pin(id, pub) {
        const cur = map.get(id);
        if (cur === undefined) {
          while (map.size >= PIN_MAX) map.delete(map.keys().next().value);
          map.set(id, pub);
          return { ok: true, changed: false };
        }
        if (cur === pub) { map.delete(id); map.set(id, pub); return { ok: true, changed: false }; }
        return { ok: false, changed: true, first: cur };
      },
      drop(id) { return map.delete(id); },
      get(id) { const v = map.get(id); return v === undefined ? null : v; },
      size() { return map.size; },
    };
  }

  // ---- GOSSIP (GSP / GSPS): the AUTHOR signs, every hop verifies ----------
  // A gossip frame names its author (`src`) and the flood guard budgets by
  // author, so the name must be unforgeable: the author signs a statement
  // committing to the frame type, its id, its scope and a hash of the
  // payload. Relays carry the block unchanged (age and the ephemeral mark are
  // per-hop and unsigned); a receiver recomputes the statement from the
  // frame it holds, so nothing in it can be altered in flight, and pins the
  // author's key TOFU exactly as for fills. Unsigned or forged gossip is
  // dropped at the first honest seat and never forwarded.
  const GOSSIP_T = new Set(['GSP', 'GSPS']);
  async function gossipStatement(from, m, ts) {
    const ph = await net.sha256hex(JSON.stringify(m.m === undefined ? null : m.m));
    return JSON.stringify({ v: 2, t: m.t, gid: String(m.gid), from, sc: (m.sc === undefined ? null : m.sc), ph, ts: (+ts || 0) });
  }
  async function signGossip(identity, m) {
    const sp = await gossipStatement(identity.peerId, m, Date.now());
    const sig = await net.edSign(identity.priv, sp);
    return { sp, sig, pub: identity.pubB64 };
  }
  async function verifyGossip(pins, m) {
    const s = m && m.s4;
    if (!GOSSIP_T.has(m && m.t) || !s || typeof s.sp !== 'string' || !s.sig || !s.pub) return { ok: false, from: null };
    let sp; try { sp = JSON.parse(s.sp); } catch (e) { return { ok: false, from: null }; }
    const from = sp.from;
    if (!from || typeof from !== 'string' || from !== m.src) return { ok: false, from: null };   // the frame's author IS the signer
    if (!String(m.gid).startsWith(from + ':')) return { ok: false, from: null };                 // and the gid names that author: a signer may not mint ids in another seat's name (the seen set is keyed by gid)
    if ((await peerIdOf(s.pub)) !== from) return { ok: false, from: null };                    // id bound to key
    if ((await gossipStatement(from, m, sp.ts)) !== s.sp) return { ok: false, from: null };     // the statement describes THIS frame
    if (!(await net.edVerify(s.pub, s.sig, s.sp))) return { ok: false, from: null };
    const p = pins.pin(from, s.pub);
    if (!p.ok) return { ok: false, from: null };
    return { ok: true, from };
  }

  GifOS.meshIdentity = { mint, peerIdOf, newPins, signGossip, verifyGossip, GOSSIP_T, PIN_MAX };
})(typeof window !== 'undefined' ? window : globalThis);
