/*
 * meet-myroom.js — My Room: your permanent hosted room, the cards that let a person ring it, and the Contacts this
 * device holds. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * ONE CONCEPT: a ring is a knock with a card. There is no call object and no call server: a call is two people in a
 * hosted room. This file is the logic only (no page element): the meeting core builds one per meeting with make(host)
 * and passes it the room's frames; the meeting view (js/core/view/myroom.js) paints what it says.
 *
 *   My Room   an ordinary hosted room (name + verifier). The device mints a random host secret K; the verifier is the
 *             existing one of the Ed25519 key K seeds (gifos-net edKeysFromSeedHex). K is stored where every hosted
 *             room's is (gifos_vadm_<room>.<v>); gifos_myroom names which hosted room is My Room.
 *   card      the right to ring one room, one per person. It is {sp, sig, pub, seed}: sp (signed by the room's host key)
 *             names the room, the card's id, its own public key (cpub), its expiry and the owner's label for the holder,
 *             sealed so only a device holding K can read it. seed is the card's own private key: the holder proves
 *             each ring with it, bound to its own peer id and the time, so a page that sees a ring cannot replay it.
 *             A link that carries no card never rings (room links stay what they are).
 *   Contacts  the cards this device holds (gifos_contacts), on the device only. Call = open the room; this page finds
 *             the card for the room it is in.
 *
 * The frames ({k:'mr', op}) ride the meeting's authenticated data channels, end-to-end encrypted:
 *   holder -> host   {op:'card', c, p, n}  "I hold this card" (c: sp/sig/pub, p: the bound proof, n: my name). Shown
 *                    to a door that holds me (the waiting room) and to each seat that proved the host key, again each tick
 *                    until that page answers (signed); the proof names this page's call, so the host's page tells a repeat
 *                    from a new call. It decides what the card means: a ring while it stands by, else 'here'; a
 *                    renewal while together.
 *   host -> holder   {op:'card', c, s?, from}  a card: with s (a seed) a new card to keep, without one a renewal of a
 *                    card the holder has (same id, later expiry).
 *   host -> holder   {op:'ringing' | 'dec' | 'missed' | 'here', w}  signed by the host key (admSigned), so no guest can fake
 *                    the owner's answer. Answer is no frame: the host admits the caller and goes live.
 *   host -> holder   {op:'stop', w}  another of the owner's devices took the call.
 *
 * PRIVATE ROOMS ("Private room with <people>", docs/myroom.md): a hosted room whose host secret K every member holds.
 * Membership is the members' My Room keys, not K: a private room's record (gifos_private) lists the other members'
 * My Room public keys, its name is 'p-' + SHA-256('gifos-private|' K '|' sorted member keys) (so K alone does not give
 * the address), its waiting room is always on, and a seat is let in only when its page signs a fresh key word with a
 * member key (that key word IS the Admit). Each page asks every other seat for one; a seat that cannot prove a member
 * key within MYROOM_PROVE_MS is a stranger and this page leaves. The mic opens (the person's own Join/Answer tap) only
 * once everyone here has proved. K is never shown: it travels only over a live channel to a page that just proved its key.
 *   asker -> peer    {op:'pask', to, pk, pp, w, n}  "come to our private room" (pp: both My Room keys, w: my key word for it)
 *   peer -> asker    {op:'pgo', to}                  Join: both go
 *   caller -> owner  {op:'gkey', to, pk, pp}          a group's K, only after the owner's signed 'acc' for a ring naming it
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const KEY = { mine: 'gifos_myroom', contacts: 'gifos_contacts', missed: 'gifos_myroom_missed', issued: 'gifos_myroom_cards', revoked: 'gifos_myroom_revoked', stay: 'gifos_myroom_stay', priv: 'gifos_private' };
  const MAX_TOKEN = 2048;           // a card frame or link larger than this is no card (flood bound, before any crypto)
  const ROOM_RE = /^[a-z0-9-]{1,64}$/i, VER_RE = /^[a-f0-9]{16,64}$/, TO_RE = /^[a-z0-9-]{1,64}(\.[a-f0-9]{16,64})?$/i;
  const T = () => GifOS.timings || {};

  // ---- small helpers ----------------------------------------------------------------------------------------------
  const store = () => { try { return root.localStorage || null; } catch (e) { return null; } };
  function readJson(k, dflt) { try { const s = store(); const v = s ? JSON.parse(s.getItem(k) || 'null') : null; return v == null ? dflt : v; } catch (e) { return dflt; } }
  function writeJson(k, v) { try { const s = store(); if (s) s.setItem(k, JSON.stringify(v)); } catch (e) {} }
  const net = () => GifOS.net;
  const enc = (s) => new TextEncoder().encode(s);
  const hex = (u) => Array.from(u).map((b) => b.toString(16).padStart(2, '0')).join('');
  const randHex = (n) => { const u = new Uint8Array(n); root.crypto.getRandomValues(u); return hex(u); };
  function b64u(str) { const u = enc(str); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return root.btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(t) { const s = root.atob(String(t).replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new TextDecoder().decode(u); }
  const b64 = (u) => { let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return root.btoa(s); };
  const unb64 = (t) => { const s = root.atob(t); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const roomKey = (room, v) => (room && v ? room + '.' + String(v).toLowerCase() : '');
  const hostSecret = (room, v) => { try { const s = store(); return s ? s.getItem('gifos_vadm_' + roomKey(room, v)) || '' : ''; } catch (e) { return ''; } };

  // ---- the sealed label: AES-GCM under a key only K's holders can make, a fresh IV per label -----------------------
  async function labelKey(K) {
    const raw = await root.crypto.subtle.digest('SHA-256', enc('gifos-card-label|' + K));
    return root.crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  async function sealLabel(K, label) {
    const iv = new Uint8Array(12); root.crypto.getRandomValues(iv);
    const ct = new Uint8Array(await root.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await labelKey(K), enc(String(label || '').slice(0, 40))));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
    return b64(out);
  }
  async function openLabel(K, lab) {
    try {
      const u = unb64(lab);
      const pt = await root.crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, await labelKey(K), u.slice(12));
      return new TextDecoder().decode(pt);
    } catch (e) { return ''; }
  }

  // ---- cards --------------------------------------------------------------------------------------------------------
  // mint(K, room, v, label, opts) -> { token, id, exp }. opts.renew = an old card's {id, cpub, lab}: same id and key,
  // a later expiry (the holder keeps its seed). The token is what a link and Contacts carry: base64url of
  // [sp, sig, pub, seed]; a renewal's token has no seed.
  async function mint(K, room, v, label, opts) {
    opts = opts || {};
    const N = net(), now = opts.now || Date.now();
    const hk = await N.edKeysFromSeedHex(K);
    if (hk.verifier !== String(v).toLowerCase()) throw new Error('not this room\'s host key');
    // cpub is who may ring with the card. Bound (opts.bind: the holder's own room key, given while together): only that
    // room's key proves a ring, so a forwarded card rings nobody. Bearer: the card's own key, whose seed travels with it.
    let seed = '', cpub = '', id = '', lab = '', b = 0;
    if (opts.renew) { id = opts.renew.id; cpub = opts.renew.cpub; lab = opts.renew.lab; b = opts.renew.b ? 1 : 0; }
    else { id = randHex(8); lab = await sealLabel(K, label); }
    if (opts.bind) { cpub = opts.bind; b = 1; }
    else if (!cpub) { seed = randHex(32); cpub = (await N.edKeysFromSeedHex(seed)).pubB64; }
    const exp = now + (T().MYROOM_CARD_LIFE_MS || 0);
    const sp = JSON.stringify(Object.assign({ act: 'card', room: roomKey(room, v), id, cpub, iat: now, exp, lab }, b ? { b: 1 } : {}));
    const sig = await N.edSign(hk.priv, sp);
    const token = b64u(JSON.stringify(seed ? [sp, sig, hk.pubB64, seed] : [sp, sig, hk.pubB64]));
    return { token, id, exp, iat: now, cpub, lab, b, c: { sp, sig, pub: hk.pubB64 } };
  }
  function parseToken(token) {
    if (typeof token !== 'string' || !token || token.length > MAX_TOKEN) return null;
    try { const a = JSON.parse(unb64u(token)); if (!Array.isArray(a) || a.length < 3) return null; return { c: { sp: a[0], sig: a[1], pub: a[2] }, seed: typeof a[3] === 'string' ? a[3] : '' }; } catch (e) { return null; }
  }
  // check(c, room, v) -> the card's fields when the room's host key signed it for this room and it has not run out.
  async function check(c, room, v, now) {
    if (!c || typeof c.sp !== 'string' || c.sp.length > MAX_TOKEN || typeof c.sig !== 'string' || typeof c.pub !== 'string') return null;
    if (!(await net().edProven(v, c.pub, c.sig, c.sp))) return null;
    let o; try { o = JSON.parse(c.sp); } catch (e) { return null; }
    if (!o || o.act !== 'card' || o.room !== roomKey(room, v) || typeof o.id !== 'string' || typeof o.cpub !== 'string') return null;
    if (!(+o.exp > (now || Date.now()))) return null;
    return o;
  }
  // The holder's proof for one ring: the card key signs who I am (my peer id), the room and the time.
  // to: an invitation (the meeting to come to, "<room>" or "<room>.<verifier>"), signed with the ring, so a note taken
  // from one ring cannot be put on another.
  // pv: the room named is a private room (the owner's page waits for its key, gkey, after a signed accept).
  async function prove(seed, room, v, myId, now, callId, cardId, to, pv) {
    const k = await net().edKeysFromSeedHex(seed);
    const sp = JSON.stringify(Object.assign({ act: 'ring', room: roomKey(room, v), card: String(cardId || ''), from: String(myId), ts: now || Date.now(), call: String(callId || '') }, to ? { to: String(to) } : {}, to && pv ? { pv: 1 } : {}));
    return { sp, sig: await net().edSign(k.priv, sp) };
  }
  async function proofOk(card, p, room, v, from, now) {
    if (!p || typeof p.sp !== 'string' || p.sp.length > 512 || typeof p.sig !== 'string') return false;
    if (!(await net().edVerify(card.cpub, p.sig, p.sp))) return false;
    let o; try { o = JSON.parse(p.sp); } catch (e) { return false; }
    return !!o && o.act === 'ring' && o.room === roomKey(room, v) && o.card === card.id && o.from === String(from) && Math.abs((now || Date.now()) - (+o.ts || 0)) <= (T().MYROOM_PROOF_WINDOW_MS || 0);
  }

  // ---- My Room ------------------------------------------------------------------------------------------------------
  function mine() { const m = readJson(KEY.mine, null); return m && ROOM_RE.test(m.room || '') && VER_RE.test(m.v || '') && hostSecret(m.room, m.v) ? { room: m.room, v: m.v } : null; }
  function isMine(room, v) { const m = mine(); return !!m && m.room === room && m.v === String(v || '').toLowerCase(); }
  // create(name) -> {room, v}: a fresh hosted room with a random host secret (nothing to type or remember).
  async function create(name) {
    const room = String(name || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    if (!ROOM_RE.test(room)) throw new Error('Pick a name with letters or numbers.');
    const K = randHex(32);
    const v = (await net().edKeysFromSeedHex(K)).verifier;
    try { store().setItem('gifos_vadm_' + roomKey(room, v), K); } catch (e) { throw new Error('This browser could not keep the room.'); }
    writeJson(KEY.mine, { room, v, at: Date.now() });
    return { room, v };
  }
  // adopt(room, v): one of this device's hosted rooms (it holds the host key) becomes My Room.
  function adopt(room, v) {
    v = String(v || '').toLowerCase();
    if (!ROOM_RE.test(room) || !VER_RE.test(v) || !hostSecret(room, v)) return false;
    writeJson(KEY.mine, { room, v, at: Date.now() });
    return true;
  }
  // The hosted rooms this device holds the host key for (what adopt can pick from).
  function hosted() {
    const out = [], s = store(); if (!s) return out;
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i), m = /^gifos_vadm_([a-z0-9-]{1,64})\.([a-f0-9]{16,64})$/i.exec(k || '');
      if (m) out.push({ room: m[1], v: m[2].toLowerCase() });
    }
    return out;
  }
  // My Room's own key: what a bound card names, and what proves a ring with it. { seed (K), pub } or null.
  async function myKey() {
    const m = mine(); if (!m) return null;
    const K = hostSecret(m.room, m.v); if (!K) return null;
    const k = await net().edKeysFromSeedHex(K).catch(() => null);
    return k ? { seed: K, pub: k.pubB64, room: m.room, v: m.v } : null;
  }
  // A statement by my room key that I am this peer, here, now (given while together; the owner binds a card to it).
  async function keyWord(ownerRoom, ownerV, myId, now) {
    const k = await myKey(); if (!k) return null;
    const sp = JSON.stringify({ act: 'key', room: roomKey(ownerRoom, ownerV), from: String(myId), ts: now || Date.now() });
    return { pub: k.pub, sp, sig: await net().edSign((await net().edKeysFromSeedHex(k.seed)).priv, sp) };
  }
  async function keyWordOk(w, room, v, from, now) {
    if (!w || typeof w.pub !== 'string' || typeof w.sp !== 'string' || w.sp.length > 512 || typeof w.sig !== 'string') return false;
    if (!(await net().edVerify(w.pub, w.sig, w.sp))) return false;
    let o; try { o = JSON.parse(w.sp); } catch (e) { return false; }
    return !!o && o.act === 'key' && o.room === roomKey(room, v) && o.from === String(from) && Math.abs((now || Date.now()) - (+o.ts || 0)) <= (T().MYROOM_PROOF_WINDOW_MS || 0);
  }
  const stayOn = () => readJson(KEY.stay, false) === true;
  const setStay = (on) => writeJson(KEY.stay, !!on);

  // ---- Contacts (cards this device holds) ---------------------------------------------------------------------------
  function contacts() { const a = readJson(KEY.contacts, []); return Array.isArray(a) ? a.filter((c) => c && c.room && c.v && c.token) : []; }
  function contactFor(room, v) { const k = roomKey(room, v); return contacts().find((c) => roomKey(c.room, c.v) === k) || null; }
  // keep(fields): add or replace the card for a room (one card per room); returns the stored contact.
  function keep(f) {
    const k = roomKey(f.room, f.v);
    const list = contacts().filter((c) => roomKey(c.room, c.v) !== k);
    const was = contacts().find((c) => roomKey(c.room, c.v) === k) || {};
    const c = { room: f.room, v: String(f.v).toLowerCase(), token: f.token, id: f.id, exp: f.exp, bound: !!f.bound, name: String(f.name || was.name || f.room).slice(0, 40), at: was.at || Date.now(), last: f.last || was.last || 0 };
    list.unshift(c);
    writeJson(KEY.contacts, list.slice(0, 500));
    return c;
  }
  function forget(room, v) { const k = roomKey(room, v); writeJson(KEY.contacts, contacts().filter((c) => roomKey(c.room, c.v) !== k)); }
  function rename(room, v, name) { const c = contactFor(room, v); if (c) keep(Object.assign({}, c, { name })); }
  // A renewal: the same card (id) with a later expiry; the seed stays the one this device holds.
  async function renew(room, v, c) {
    const was = contactFor(room, v); if (!was) return false;
    const old = parseToken(was.token); if (!old) return false;
    const o = await check(c, room, v); if (!o || o.id !== was.id || !(o.exp > (was.exp || 0))) return false;
    if (o.b) { const k = await myKey(); if (!k || k.pub !== o.cpub) return false; keep(Object.assign({}, was, { token: b64u(JSON.stringify([c.sp, c.sig, c.pub])), exp: o.exp, bound: true })); return true; }
    if (!old.seed) return false;
    keep(Object.assign({}, was, { token: b64u(JSON.stringify([c.sp, c.sig, c.pub, old.seed])), exp: o.exp }));
    return true;
  }
  // A card handed to me (a link or a frame): checked, then returned for the person to save.
  async function readCard(token, room, v) {
    const t = parseToken(token); if (!t) return null;
    const o = await check(t.c, room, v); if (!o) return null;
    if (o.b) { const mk = await myKey(); if (!mk || mk.pub !== o.cpub) return null; return { room, v: String(v).toLowerCase(), token, id: o.id, exp: o.exp, bound: true }; }   // bound to my room: mine to use
    if (!t.seed) return null;
    const k = await net().edKeysFromSeedHex(t.seed).catch(() => null);
    if (!k || k.pubB64 !== o.cpub) return null;   // the seed must be this card's own key
    return { room, v: String(v).toLowerCase(), token, id: o.id, exp: o.exp };
  }

  // ---- the owner's lists: cards issued, cards revoked, missed calls ------------------------------------------------
  function issued() { const a = readJson(KEY.issued, []); return Array.isArray(a) ? a : []; }
  function noteIssued(room, v, id, label, exp, cpub) {
    const list = issued().filter((x) => x.id !== id);
    list.unshift(Object.assign({ room, v, id, label: String(label || '').slice(0, 40), exp, at: Date.now() }, cpub ? { cpub } : {}));
    writeJson(KEY.issued, list.slice(0, 500));
  }
  const issuedTo = (pub) => !!pub && issued().some((x) => x.cpub === pub);   // I gave a card bound to this My Room key
  const revoked = () => { const a = readJson(KEY.revoked, []); return Array.isArray(a) ? a : []; };
  function revoke(id) { const a = revoked(); if (a.indexOf(id) < 0) a.unshift(id); writeJson(KEY.revoked, a.slice(0, 1000)); writeJson(KEY.issued, issued().filter((x) => x.id !== id)); }
  function missed() { const a = readJson(KEY.missed, []); return Array.isArray(a) ? a : []; }
  function noteMissed(room, v, label, at) { const a = missed(); a.unshift({ room, v, label: String(label || '').slice(0, 40), at: at || Date.now() }); writeJson(KEY.missed, a.slice(0, 50)); }
  function clearMissed() { writeJson(KEY.missed, []); }

  // ---- the card link: /meet#room=R&v=V&card=TOKEN (card rides the fragment beside the one grammar's keys) --------
  function cardLink(origin, room, v, token) {
    const L = GifOS.link;
    return String(origin || '') + '/meet#' + L.hash({ room, v, rest: { card: token } });
  }

  // ---- private rooms ------------------------------------------------------------------------------------------------
  const PK_RE = /^[a-f0-9]{64}$/;
  async function sha256hex(str) { return hex(new Uint8Array(await root.crypto.subtle.digest('SHA-256', enc(str)))); }
  // The name is computed once, at the mint, from K and every member's My Room key; it is stored, never re-derived.
  async function privName(K, pubs) { return 'p-' + (await sha256hex('gifos-private|' + K + '|' + pubs.slice().sort().join(','))).slice(0, 32); }
  function privates() { const a = readJson(KEY.priv, []); return Array.isArray(a) ? a.filter((x) => x && ROOM_RE.test(x.room || '') && VER_RE.test(x.v || '') && Array.isArray(x.pubs)) : []; }
  function privFor(room, v) { const k = roomKey(room, v); return privates().find((x) => roomKey(x.room, x.v) === k) || null; }
  // The pair room with one person (by their My Room key): the same room every time.
  function pairWith(pub) { return privates().find((x) => x.pubs.length === 1 && x.pubs[0] === pub && hostSecret(x.room, x.v)) || null; }
  // keepPrivate(K, all, myPub, name): store a private room from its key and its members (my own key among them).
  async function keepPrivate(K, all, myPub, name) {
    if (!PK_RE.test(String(K || '')) || !Array.isArray(all) || all.length < 2 || all.length > 50) return null;
    const pubs = Array.from(new Set(all.map(String))).filter((p) => p.length <= 64);
    if (pubs.indexOf(myPub) < 0 || pubs.length < 2) return null;
    const room = await privName(K, pubs);
    const v = (await net().edKeysFromSeedHex(K)).verifier;
    try { store().setItem('gifos_vadm_' + roomKey(room, v), K); } catch (e) { return null; }
    const was = privFor(room, v);
    // pw: the room's password (the content key includes it, docs/meet-security.md §LOCK), derived from K: a link alone
    // reads nothing; a member's page uses it at every visit (meeting.js loadPw).
    const pw = (await sha256hex('gifos-private-pw|' + K)).slice(0, 32);
    const rec = { room, v, pubs: pubs.filter((p) => p !== myPub), name: String(name || (was && was.name) || '').slice(0, 60), at: (was && was.at) || Date.now(), pw };
    writeJson(KEY.priv, [rec].concat(privates().filter((x) => roomKey(x.room, x.v) !== roomKey(room, v))).slice(0, 500));
    return rec;
  }
  // mintPrivate(otherPubs, name): a new private room with these people (their My Room keys), K fresh.
  async function mintPrivate(otherPubs, name) {
    const k = await myKey(); if (!k) return null;
    return keepPrivate(randHex(32), [k.pub].concat(otherPubs), k.pub, name);
  }
  // A contact's My Room key: the key that signed the card I hold for their room (a ring is answered only in a My Room).
  function contactPub(c) { const t = c && parseToken(c.token); return (t && t.c && t.c.pub) || ''; }
  const membersOf = (rec, mine) => [mine].concat(rec.pubs);

  // ---- one meeting's My Room part ----------------------------------------------------------------------------------
  // host (the core): room(), v(), myId(), myName(), owner() (this page holds the room's host key), send(pid, frame),
  // hosts() (seats that proved the host key, not me), held(pid), admit(pid), hold(on) / holding(), signAdm(act, extra),
  // verifyAdm(w, act), label(pid, name) (the waiting room's name for a held knocker), live() (my mic or camera is on), hostLive() (another seat that proved the host key has its mic or
// camera on), isHost(pid), isHere(pid) (seated in this room), seated(), mic(on), others() (people seated here besides
// me), people() ([{id, name}] seated here besides me), now().
  function make(host) {
    const listeners = [];
    let lastOffer = null;   // an offer made before anyone listened (the address's card is read at boot) is handed to the first listener
    const emit = (ev) => { if (ev.type === 'offer' && !listeners.length) lastOffer = ev; for (const f of listeners.slice()) { try { f(ev); } catch (e) {} } };
    const room = host.room(), v = String(host.v() || '').toLowerCase();
    const hosted = !!(room && v);
    // My identity's device-to-device copy (js/gifos-identity.js) rides this channel: every frame whose op starts with 'id'
    // is its own. It asks the pages this one can talk to: seats that proved the host key, and a door that holds it.
    const idSeen = new Set();
    const idCopy = hosted && GifOS.identity && GifOS.identity.copier ? GifOS.identity.copier({ room: host.room, v: host.v, myId: host.myId, owner: host.owner, now: host.now, send: host.send, peers: () => Array.from(new Set(host.hosts().concat(Array.from(idSeen)))) }) : null;
    let linkCard = null;        // a card the address carried (to save, or to call with once)
    // holder side
    let mk = null; myKey().then((k) => { mk = k; }, () => {});   // My Room's key (a bound card rings with it)
    const callId = randHex(8);
    // An invitation this page carries: the meeting a contact is asked to (set by "Invite a contact" just before this
    // page opened; read once, and only while fresh). The ring names it; accepting takes the contact there.
    // go: on the owner's signed accept this page goes there too (a call to our private room); gk: this page then sends the
    // owner that private room's key (a group); pv: the room is a private room.
    let invite = '', inviteGo = false, inviteGk = false, invitePv = false;
    try {
      const IK = 'gifos_mr_invite.' + roomKey(room, v), raw = JSON.parse(store().getItem(IK) || 'null');
      store().removeItem(IK);
      if (raw && TO_RE.test(String(raw.to || '')) && Math.abs(Date.now() - (+raw.at || 0)) <= (T().MYROOM_PROOF_WINDOW_MS || 0)) { invite = String(raw.to); inviteGo = !!raw.go; inviteGk = !!raw.gk; invitePv = !!(raw.pv || raw.gk); }
    } catch (e) {}  // this page's call: a card shown again is the same call, a new load is a new one
    const told = new Map();     // pid -> when I last showed my card there; 0 once that page answered (signed)
    let call = null;            // { label, state: 'waiting'|'ringing'|'answered'|'declined'|'noanswer', at }
    // owner side
    const rings = new Map();    // pid -> { label, id, at, card }
    const lastIn = new Map();   // pid -> last card frame time (flood bound before crypto)
    const whys = new Map();     // pid -> what the last card frame from it came to (state(): a test reads why a call did not ring)
    const why = (pid, w) => { whys.set(pid, w + '@' + host.now()); if (whys.size > 50) whys.delete(whys.keys().next().value); };
    const seen = new Set();     // calls told 'here' (no ring: I am live), once each
    const ended = new Map();    // call -> the signed answer it got ('dec', 'missed', or '' once answered), said again if asked
    const endCall = (r, op) => { if (r && r.ck) { ended.set(r.ck, op); if (ended.size > 200) ended.delete(ended.keys().next().value); } };
    let standby = false, wentLive = false, doorSet = false;
    let pendingGo = null;       // an accepted ring to a private room I do not hold yet: waiting for its key (gkey)

    const SS = 'gifos_mr_card.' + roomKey(room, v);   // this tab's link card, kept across a reload of the call only
    const myCard = () => {
      if (!hosted) return null;
      if (!linkCard) { try { const tok = root.sessionStorage.getItem(SS); const t = tok && parseToken(tok); if (t && t.seed) linkCard = { token: tok, seed: t.seed, c: t.c, name: (contactFor(room, v) || {}).name || room }; } catch (e) {} }
      const c = contactFor(room, v);
      const t = c && parseToken(c.token);
      let saved = t && t.seed ? { token: c.token, seed: t.seed, c: t.c, name: c.name } : null;
      if (t && !t.seed && mk) { try { const o = JSON.parse(t.c.sp); if (o.b && o.cpub === mk.pub) saved = { token: c.token, seed: mk.seed, c: t.c, name: c.name, bound: true }; } catch (e) {} }   // bound to My Room: my room's key rings
      // Two cards for one room (the one in Contacts, the one a link brought this visit): the one that runs out later.
      const expOf = (x) => { try { return +JSON.parse(x.c.sp).exp || 0; } catch (e) { return 0; } };
      if (saved && linkCard) return expOf(saved) >= expOf(linkCard) ? saved : linkCard;
      return saved || linkCard;
    };
    async function showCard(pid) {
      // Shown again each tick until that page answers: a frame that reached a channel the far end had not yet
      // authenticated is dropped there, and one lost card must not leave a call unrung.
      const mc = myCard(), was = told.get(pid);
      if (!mc || was === 0 || (was && host.now() - was < (T().MYROOM_TICK_MS || 0))) return;
      told.set(pid, host.now());
      if (root.__mrLoseCards > 0) { root.__mrLoseCards--; return; }   // test lever (a fault of the network): this card frame is lost on the way
      let cid = ''; try { cid = JSON.parse(mc.c.sp).id; } catch (e) {}
      const p = await prove(mc.seed, room, v, host.myId(), host.now(), callId, cid, invite, invitePv);
      host.send(pid, { op: 'card', c: mc.c, p, n: String(host.myName() || '').slice(0, 40) });
      if (!call) { call = { label: mc.name || room, state: 'waiting', at: host.now(), invite }; emit({ type: 'call', call }); }
    }

    // THE HOLDER. A door held me (a waiting room): that door may be the owner standing by. A seat proved the host key:
    // the owner is here. Either way, once per channel, I show my card.
    // A door that says "held" again may be a new channel (a held knock's idle channel closes and the knock reopens it):
    // while the call is still open, the card is shown there again, so an answer said on the old channel (ringing,
    // missed, declined) is said again on this one.
    function onHeld(pid) {
      idSeen.add(pid); if (idCopy) idCopy.onHeld(pid);
      if (host.owner()) return;
      if (told.get(pid) === 0 && call && (call.state === 'waiting' || call.state === 'ringing') && host.chan && host.chan(pid) !== chanSeen.get(pid)) told.delete(pid);
      if (host.chan) chanSeen.set(pid, host.chan(pid));
      showCard(pid).catch(() => {});
    }
    const chanSeen = new Map();   // pid -> the channel the door last said "held" on
    function tick() {
      const now = host.now();
      if (idCopy) idCopy.tick();
      if (hosted && !host.owner()) {
        const mc = myCard();
        if (mc) {
          if (!call) { call = { label: mc.name || room, state: 'waiting', at: now, invite }; emit({ type: 'call', call }); }
          for (const pid of host.hosts()) showCard(pid).catch(() => {});
          // Answer is no frame: the owner let me in and went live (mic or camera on), which every seat already sees.
          if (call.state === 'ringing' && host.seated() && host.hostLive()) { call.state = 'answered'; call.answeredAt = now; emit({ type: 'call', call }); }
        }
      }
      if (hosted && host.owner()) ownerTick(now);
      if (hosted) privTick(now);
      if (pendingGo && now - pendingGo.at >= (T().MYROOM_GKEY_WAIT_MS || 0)) { const g = pendingGo; pendingGo = null; emit({ type: 'go', room: g.room, v: g.v, label: g.label, priv: false }); }   // no key came: go as a guest (that room's door decides)
    }

    // A PRIVATE ROOM: membership is a member's My Room key. Every other seat (held or seated) is asked for a key word for
    // this room; a proved knocker is let in (the key word is the Admit); a seat that cannot prove within MYROOM_PROVE_MS is
    // a stranger and this page leaves. The mic opens (the person's own Join/Answer tap) once everyone here has proved.
    const proved = new Map(), askedAt = new Map(), unproved = new Map();
    let privDoor = false, strangerSaid = false;
    const MIC_SS = 'gifos_mr_mic';
    function privTick(now) {
      const rec = privFor(room, v); if (!rec) return;
      if (host.owner() && !privDoor) { privDoor = true; if (!host.holding()) host.hold(true); }
      const ids = Array.from(new Set(host.waitIds().concat(host.people().map((p) => p.id))));
      for (const pid of ids) {
        if (proved.has(pid)) { if (host.held(pid)) host.admit(pid); continue; }
        if (host.reach(pid) && now - (askedAt.get(pid) || 0) >= (T().MYROOM_TICK_MS || 0)) { askedAt.set(pid, now); host.send(pid, { op: 'keyask', r: roomKey(room, v) }); }
      }
      const here = host.people();
      for (const p of here) {
        if (proved.has(p.id) || !host.reach(p.id)) { unproved.delete(p.id); continue; }
        const t0 = unproved.get(p.id) || now; unproved.set(p.id, t0);
        if (now - t0 >= (T().MYROOM_PROVE_MS || 0) && !strangerSaid) { strangerSaid = true; emit({ type: 'stranger', pid: p.id, name: p.name }); }
      }
      let want = ''; try { want = root.sessionStorage.getItem(MIC_SS) || ''; } catch (e) {}
      if (want === roomKey(room, v) && here.length && here.every((p) => proved.has(p.id))) { try { root.sessionStorage.removeItem(MIC_SS); } catch (e) {} host.mic(true); emit({ type: 'private-open' }); }
    }
    async function onKeyWord(pid, w) {
      const rec = privFor(room, v); if (!rec || !w) return;
      const k = mk || (await myKey());
      if (!(await keyWordOk(w, room, v, pid, host.now()))) return why(pid, 'priv-word');
      if (rec.pubs.indexOf(w.pub) < 0 && !(k && w.pub === k.pub)) return why(pid, 'priv-stranger');
      if (!proved.has(pid)) { proved.set(pid, w.pub); why(pid, 'priv-ok'); emit({ type: 'proved', pid }); }
      if (host.held(pid)) host.admit(pid);
    }

    // THE OWNER.
    function ownerTick(now) {
      // Standby: My Room open with my mic and camera off and nobody let in yet. Its door is held, so every ring is a held
      // knock with a card and Answer is the admit. Going live (mic or camera on, or anyone admitted) ends it.
      if (host.live()) wentLive = true;
      else if (wentLive && host.others() === 0) wentLive = false;   // the call is over and I am quiet again: standing by
      const want = isMine(room, v) && !wentLive && !host.live();
      // My Room's door is the hosted room's own waiting room: on once when its owner arrives (the owner may turn it off),
      // so a card holder who knocks while the owner is busy waits there and is let in with the room's own Admit.
      if (isMine(room, v) && !doorSet) { doorSet = true; if (!host.holding()) host.hold(true); }
      if (want && !standby) { standby = true; emit({ type: 'standby', on: true }); }
      if (!want && standby) { standby = false; emit({ type: 'standby', on: false }); }
      const takenElsewhere = host.hostLive();   // another of my devices answered (it went live): mine stops, no missed call
      for (const [pid, r] of Array.from(rings)) {
        if (takenElsewhere) { endCall(r, ''); rings.delete(pid); emit({ type: 'stopped', pid, label: r.label }); continue; }
        const gone = !host.held(pid) && !host.isHere(pid);
        if (gone || now - r.at >= (T().MYROOM_RING_MS || 0)) {
          endCall(r, 'missed'); rings.delete(pid);
          noteMissed(room, v, r.label, r.at);
          if (!gone) sendSigned(pid, 'missed');
          emit({ type: 'missed', pid, label: r.label, at: r.at });
        }
      }
    }
    async function sendSigned(pid, op) { const w = await host.signAdm('mr' + op, { to: String(pid) }); if (w) host.send(pid, { op, w }); }

    async function onCardShown(pid, m) {
      const now = host.now();
      if (now - (lastIn.get(pid) || 0) < (T().MYROOM_TICK_MS || 0)) return why(pid, 'rate');   // one card frame per peer per tick, before any crypto
      lastIn.set(pid, now);
      const o = await check(m.c, room, v, now);
      if (!o) return why(pid, 'card');
      if (revoked().indexOf(o.id) >= 0) return why(pid, 'revoked');
      if (!(await proofOk(o, m.p, room, v, pid, now))) return why(pid, 'proof');
      const K = hostSecret(room, v); if (!K) return why(pid, 'nokey');
      why(pid, standby ? 'ok' : 'ok-live');
      // Caller ID: a bound card's ring is proved by the holder's own room key (✓); a bearer card says only that someone
      // holds the card.
      const name = (await openLabel(K, o.lab)) || String(m.n || '').slice(0, 40) || 'Someone';
      const label = name + (o.b ? ' ✓' : ' (card)');
      let ck = '', to = '', pv = false; try { const ps = JSON.parse(m.p.sp); ck = pid + '|' + String(ps.call || ''); to = TO_RE.test(String(ps.to || '')) ? String(ps.to) : ''; pv = !!(to && ps.pv); } catch (e) { ck = pid + '|'; }
      // A call to our pair room: the ring names the private room I keep with this caller's own My Room key (bound card).
      const tp = /^([a-z0-9-]{1,64})\.([a-f0-9]{16,64})$/i.exec(to), tr = tp && privFor(tp[1], tp[2]);
      const pair = !!(tr && o.b && tr.pubs.length === 1 && tr.pubs[0] === o.cpub);
      if (ended.has(ck)) { const op = ended.get(ck); if (op) sendSigned(pid, op); return; }   // the answer was lost: say it again
      if (rings.has(pid)) { sendSigned(pid, 'ringing'); return; }
      // Renew while together: a card issued more than a day ago gets a fresh year (same id, same key).
      if (now - (+o.iat || 0) >= (T().MYROOM_RENEW_AFTER_MS || 0)) {
        try { const r = await mint(K, room, v, '', { renew: { id: o.id, cpub: o.cpub, lab: o.lab } }); host.send(pid, { op: 'card', c: r.c, from: String(host.myName() || '') }); noteIssued(room, v, o.id, label, r.exp); emit({ type: 'renewed', pid, label }); } catch (e) {}
      }
      // A card from a page that is neither held at my door nor seated yet (its knock is still under way) is not answered:
      // the holder shows it again next tick, by when the door holds it (a ring, or its name in the waiting room) or the
      // room seats it.
      if (!host.held(pid) && !host.isHere(pid)) return why(pid, 'early');
      if (host.held(pid)) host.label(pid, label);   // the waiting room lists the caller by the owner's own label for the card
      if (standby && !rings.has(pid)) {
        rings.set(pid, { label, id: o.id, at: now, ck, to, pv, pair });
        sendSigned(pid, 'ringing');
        emit({ type: 'ring', pid, label, to, pair });
      } else if (!seen.has(ck)) {   // not standing by: a quiet notice, once a call, and a signed word so the holder stops
        seen.add(ck);
        sendSigned(pid, 'here');
        if (!host.held(pid)) emit({ type: 'arrived', pid, label });   // held: the waiting room already shows them
      }
    }
    function answer(pid) {
      const r = rings.get(pid); if (!r) return false;
      if (r.to) {   // an invitation: I go to that meeting (the view takes me there), the caller is not let in here
        endCall(r, 'acc'); rings.delete(pid); sendSigned(pid, 'acc');
        for (const [other, ro] of Array.from(rings)) { endCall(ro, 'dec'); rings.delete(other); sendSigned(other, 'dec'); }
        const at = /^([a-z0-9-]{1,64})(?:\.([a-f0-9]{16,64}))?$/i.exec(r.to);
        const g = { type: 'go', room: at[1], v: (at[2] || '').toLowerCase(), label: r.label, priv: false };
        if (r.pv && g.v && privFor(g.room, g.v)) g.priv = true;   // our pair room, or a private room I hold already
        else if (r.pv) { pendingGo = { pid, room: g.room, v: g.v, to: r.to, label: r.label, at: host.now() }; return true; }   // its key comes next (gkey), only now that I signed 'acc'
        emit(g);
        return true;
      }
      endCall(r, ''); rings.delete(pid);
      wentLive = true;
      if (host.held(pid)) host.admit(pid);
      host.mic(true);                          // Answer is the person's tap: the mic opens; the camera stays off
      for (const [other, ro] of Array.from(rings)) { endCall(ro, 'dec'); rings.delete(other); sendSigned(other, 'dec'); }
      emit({ type: 'answered', pid, label: r.label });
      return true;
    }
    function decline(pid) {
      const r = rings.get(pid); if (!r) return false;
      endCall(r, 'dec'); rings.delete(pid);
      sendSigned(pid, 'dec');
      emit({ type: 'declined', pid, label: r.label });
      return true;
    }
    // Hand a person in this meeting a card (a new card: the frame carries its seed over the end-to-end channel). The
    // card is for this room when I host it, else for My Room: the card back a caller gives the person they called.
    // The person's key word for a room (keyask -> key), or null after two ticks. One wait per person and room.
    function askKey(pid, r) {
      return new Promise((resolve) => {
        const wk = pid + '|' + r;
        keyWaits.set(wk, resolve);
        host.send(pid, { op: 'keyask', r });
        setTimeout(() => { if (keyWaits.get(wk) === resolve) { keyWaits.delete(wk); resolve(null); } }, 2 * (T().MYROOM_TICK_MS || 0));
      });
    }
    async function give(pid, label) {
      const at = host.owner() && !privFor(room, v) ? { room, v } : mine(); if (!at) return false;   // in a private room, my card is for My Room
      const K = hostSecret(at.room, at.v); if (!K) return false;
      // The card swap: a person who has a My Room proves its key here and now, and the card is bound to it (caller ID ✓);
      // one with no room (no answer within two ticks) gets a bearer card.
      const w = await askKey(pid, roomKey(at.room, at.v));
      const bind = w && (await keyWordOk(w, at.room, at.v, pid, host.now())) ? w.pub : '';
      const r = await mint(K, at.room, at.v, label, bind ? { bind } : {});
      const t = parseToken(r.token);
      // A bound card also carries our pair room: the first swap mints its key, every later one reuses it. K goes only
      // here, over this live channel, to the page that has just proved its My Room key.
      let pair = null;
      const k = bind ? await myKey() : null;
      if (k) { const rec = pairWith(bind) || (await mintPrivate([bind], label)); const PK = rec && hostSecret(rec.room, rec.v); if (PK) pair = { pk: PK, pp: [k.pub, bind] }; }
      host.send(pid, Object.assign({ op: 'card', c: r.c, from: String(host.myName() || '').slice(0, 40) }, bind ? { nb: 1 } : { s: t.seed }, pair || {}));
      noteIssued(at.room, at.v, r.id, label, r.exp, bind);
      if (!host.owner()) { given.add(pid); emit({ type: 'gave', pid }); }
      return true;
    }
    const given = new Set();   // people I gave my card back to in this meeting
    const keyWaits = new Map(); // pid|room -> a wait for that person's key word for that room (askKey)
    // "Private room with <person>": both are here, so no ring is needed. The person proves their My Room key; our pair room
    // is found (or minted, with the card swap first: bound cards both ways); they are asked to it with its key and my
    // key word for it; their Join takes both there.
    const asking = new Map();   // pid -> the private room I asked them to
    const pasks = new Map();    // pid -> an ask to a private room I may Join
    async function privateWith(pid, name) {
      const k = await myKey(); if (!k) return { err: 'nomine' };
      const w = await askKey(pid, roomKey(k.room, k.v));
      if (!w || !(await keyWordOk(w, k.room, k.v, pid, host.now()))) return { err: 'noroom' };
      let rec = pairWith(w.pub);
      if (!rec || !issuedTo(w.pub)) { await give(pid, name); rec = pairWith(w.pub); }   // the swap first (it mints the pair room)
      if (!rec) return { err: 'nopair' };
      const to = roomKey(rec.room, rec.v), PK = hostSecret(rec.room, rec.v);
      const kw = await keyWord(rec.room, rec.v, host.myId(), host.now()); if (!PK || !kw) return { err: 'nokey' };
      asking.set(pid, to);
      host.send(pid, { op: 'pask', to, pk: PK, pp: [k.pub, w.pub], w: kw, n: String(host.myName() || '').slice(0, 40) });
      emit({ type: 'asking', pid, name, to });
      return { to };
    }
    async function privateJoin(pid, name) {
      const a = pasks.get(pid); if (!a) return false;
      pasks.delete(pid);
      const k = await myKey(); if (!k) return false;
      const rec = await keepPrivate(a.pk, a.pp, k.pub, name || a.n); if (!rec || roomKey(rec.room, rec.v) !== a.to) return false;
      if (!issuedTo(a.other)) await give(pid, name || a.n);   // bound cards both ways
      host.send(pid, { op: 'pgo', to: a.to });
      emit({ type: 'go', room: rec.room, v: rec.v, label: name || a.n, priv: true });
      return true;
    }
    function privateNo(pid) { pasks.delete(pid); host.send(pid, { op: 'pno' }); }

    // A card link for this room (the lobby's "Make a card", and the card-back offer when the other side has gone).
    async function linkFor(label, origin) {
      const K = hostSecret(room, v); if (!K) return '';
      const r = await mint(K, room, v, label); noteIssued(room, v, r.id, label, r.exp);
      return cardLink(origin, room, v, r.token);
    }

    async function onMsg(pid, m) {
      if (idCopy && m && typeof m.op === 'string' && m.op.slice(0, 2) === 'id') return idCopy.onMsg(pid, m);
      if (!hosted || !m || typeof m.op !== 'string') return;
      try {
        if (m.op === 'card' && host.owner() && m.p) return await onCardShown(pid, m);
        if (m.op === 'keyask' && typeof m.r === 'string') {   // someone here is handing me a card: my room's key word, for that room only
          const at = /^([a-z0-9-]{1,64})\.([a-f0-9]{16,64})$/i.exec(m.r); if (!at) return;
          const w = await keyWord(at[1], at[2], host.myId(), host.now()); if (w) host.send(pid, { op: 'key', w });
          return;
        }
        if (m.op === 'key' && m.w && typeof m.w.sp === 'string') {
          let r = ''; try { r = String(JSON.parse(m.w.sp).room || ''); } catch (e) {}
          const wk = pid + '|' + r;
          if (keyWaits.has(wk)) { const f = keyWaits.get(wk); keyWaits.delete(wk); f(m.w); return; }
          if (r === roomKey(room, v)) await onKeyWord(pid, m.w);   // a private room's door
          return;
        }
        if (m.op === 'pask' && typeof m.to === 'string' && PK_RE.test(String(m.pk || '')) && Array.isArray(m.pp) && m.pp.length === 2) {
          const k = await myKey(); if (!k || m.pp.indexOf(k.pub) < 0) return;
          const other = String(m.pp.find((x) => x !== k.pub) || ''), at = /^([a-z0-9-]{1,64})\.([a-f0-9]{16,64})$/i.exec(m.to); if (!at || !other) return;
          if (!m.w || m.w.pub !== other || !(await keyWordOk(m.w, at[1], at[2], pid, host.now()))) return;   // the asker holds that key, here, now
          if ((await privName(m.pk, m.pp.map(String))) !== at[1] || (await net().edKeysFromSeedHex(m.pk)).verifier !== at[2].toLowerCase()) return;
          pasks.set(pid, { to: m.to, pk: m.pk, pp: m.pp.map(String), other, n: String(m.n || '').slice(0, 40) });
          emit({ type: 'pask', pid, name: String(m.n || '').slice(0, 40) || 'Someone' });
          return;
        }
        if (m.op === 'pgo' && asking.get(pid) === m.to) {
          asking.delete(pid);
          const at = /^([a-z0-9-]{1,64})\.([a-f0-9]{16,64})$/i.exec(m.to); const rec = at && privFor(at[1], at[2]);
          if (rec) emit({ type: 'go', room: rec.room, v: rec.v, label: rec.name, priv: true });
          return;
        }
        if (m.op === 'pno' && asking.has(pid)) { asking.delete(pid); emit({ type: 'asked-no', pid }); return; }
        if (m.op === 'gkey' && host.owner() && pendingGo && pendingGo.pid === pid && m.to === pendingGo.to && PK_RE.test(String(m.pk || '')) && Array.isArray(m.pp)) {
          const k = await myKey(); if (!k) return;
          const g = pendingGo; pendingGo = null;
          const rec = await keepPrivate(m.pk, m.pp.map(String), k.pub, g.label);
          const ok = !!rec && roomKey(rec.room, rec.v) === g.to;
          emit({ type: 'go', room: g.room, v: g.v, label: g.label, priv: ok });
          return;
        }
        if (m.op === 'card' && m.c && ((m.s && typeof m.s === 'string') || m.nb === 1)) {
          // A new card for me, for the room its signed statement names (this room's host hands out this room's cards; a
          // caller hands back a card to its own room). It checks itself; the person decides whether to keep it.
          let at = null; try { at = /^([a-z0-9-]{1,64})\.([a-f0-9]{16,64})$/i.exec(JSON.parse(m.c.sp).room); } catch (e) { at = null; }
          if (!at || isMine(at[1], at[2])) return;
          const tok = b64u(JSON.stringify(m.s ? [m.c.sp, m.c.sig, m.c.pub, m.s] : [m.c.sp, m.c.sig, m.c.pub]));
          const f = await readCard(tok, at[1], at[2]); if (!f) return;
          if (f.bound && PK_RE.test(String(m.pk || '')) && Array.isArray(m.pp) && m.pp.length === 2) f.pair = { pk: m.pk, pp: m.pp.map(String) };   // our pair room, kept when the card is saved
          emit({ type: 'offer', card: f, from: String(m.from || '').slice(0, 40), back: !(at[1] === room && at[2] === v) });
          return;
        }
        if (m.op === 'card' && m.c && !m.s && !host.owner() && host.isHost(pid)) { if (await renew(room, v, m.c)) emit({ type: 'renewed-mine' }); return; }
        if (!host.owner() && call && (m.op === 'ringing' || m.op === 'dec' || m.op === 'missed' || m.op === 'here' || m.op === 'acc')) {
          const o = await host.verifyAdm(m.w, 'mr' + m.op);
          if (!o || o.to !== String(host.myId())) return;
          told.set(pid, 0);                       // that page has my card: no more showing it there
          if (m.op === 'here') { if (call.state === 'waiting' && host.seated()) { call.state = 'answered'; call.answeredAt = host.now(); emit({ type: 'call', call }); } return; }
          call.state = m.op === 'ringing' ? 'ringing' : m.op === 'dec' ? 'declined' : m.op === 'acc' ? 'accepted' : 'noanswer';
          if (m.op === 'ringing') call.ringSeen = true;
          emit({ type: 'call', call });
          if (m.op === 'acc' && invite) {
            const at = /^([a-z0-9-]{1,64})\.([a-f0-9]{16,64})$/i.exec(invite), rec = at && privFor(at[1], at[2]);
            if (inviteGk && rec) {   // the owner's page has just signed 'acc' with its room key: now, and only now, the group's key
              const k = await myKey(), PK = hostSecret(rec.room, rec.v);
              if (k && PK) host.send(pid, { op: 'gkey', to: invite, pk: PK, pp: membersOf(rec, k.pub) });
            }
            if (inviteGo && rec) emit({ type: 'go', room: rec.room, v: rec.v, label: call.label, priv: true });
          }
        }
      } catch (e) {}
    }
    // A card the address carried: kept for this visit (it rings with it), offered to Contacts.
    async function takeLinkCard(token) {
      if (!hosted || !token) return null;
      const f = await readCard(token, room, v); if (!f) return null;
      const t = parseToken(token);
      linkCard = { token, seed: t.seed, c: t.c, name: (contactFor(room, v) || {}).name || room };
      try { root.sessionStorage.setItem(SS, token); } catch (e) {}
      emit({ type: 'offer', card: f, from: '', fromLink: true });
      return f;
    }
    function save(f, name) {
      const c = keep(Object.assign({}, f, { name }));
      if (f.pair) myKey().then((k) => (k ? keepPrivate(f.pair.pk, f.pair.pp, k.pub, name) : null)).catch(() => null);
      if (f.room !== room || String(f.v) !== v) return c;   // a card to another room (a card back): this call's label stays
      if (linkCard && linkCard.token === f.token) { linkCard = null; try { root.sessionStorage.removeItem(SS); } catch (e) {} }   // kept in Contacts now: one copy
      if (call) { call.label = c.name; emit({ type: 'call', call }); } return c; }

    return {
      on: (f) => { listeners.push(f); if (lastOffer) { const o = lastOffer; lastOffer = null; try { f(o); } catch (e) {} } return () => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }; },
      onMsg, onHeld, tick, answer, decline, give, linkFor, takeLinkCard, save, privateWith, privateJoin, privateNo,
      isPrivate: () => !!privFor(room, v), proved: (pid) => proved.has(pid),
      drop: (pid, w) => why(pid, w),
      identity: idCopy,
      people: () => host.people(), gaveTo: (pid) => given.has(pid), hostIds: () => host.hosts(),
      state: () => ({ room, v, owner: !!host.owner(), mine: isMine(room, v), standby, live: !!(hosted && host.live()), wentLive, whys: Array.from(whys), call: call ? Object.assign({}, call) : null, rings: Array.from(rings, ([pid, r]) => ({ pid, label: r.label, at: r.at, to: r.to || '', pair: !!r.pair })), holdsCard: !!myCard(), priv: !!privFor(room, v), proved: Array.from(proved.keys()), pasks: Array.from(pasks.keys()), asking: Array.from(asking.values()), pendingGo: !!pendingGo }),
    };
  }

  GifOS.meetMyRoom = {
    KEY, make, mint, check, parseToken, prove, proofOk, myKey, keyWord, keyWordOk, sealLabel, openLabel, readCard, renew,
    mine, isMine, create, adopt, hosted, stayOn, setStay,
    contacts, contactFor, keep, forget, rename, issued, revoke, revoked, missed, noteMissed, clearMissed, cardLink, roomKey,
    privName, privates, privFor, pairWith, keepPrivate, mintPrivate, contactPub, issuedTo,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = GifOS.meetMyRoom;
})(typeof window !== 'undefined' ? window : globalThis);
