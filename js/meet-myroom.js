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
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const KEY = { mine: 'gifos_myroom', contacts: 'gifos_contacts', missed: 'gifos_myroom_missed', issued: 'gifos_myroom_cards', revoked: 'gifos_myroom_revoked', stay: 'gifos_myroom_stay' };
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
  async function prove(seed, room, v, myId, now, callId, cardId, to) {
    const k = await net().edKeysFromSeedHex(seed);
    const sp = JSON.stringify(Object.assign({ act: 'ring', room: roomKey(room, v), card: String(cardId || ''), from: String(myId), ts: now || Date.now(), call: String(callId || '') }, to ? { to: String(to) } : {}));
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
  function noteIssued(room, v, id, label, exp) {
    const list = issued().filter((x) => x.id !== id);
    list.unshift({ room, v, id, label: String(label || '').slice(0, 40), exp, at: Date.now() });
    writeJson(KEY.issued, list.slice(0, 500));
  }
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
    let linkCard = null;        // a card the address carried (to save, or to call with once)
    // holder side
    let mk = null; myKey().then((k) => { mk = k; }, () => {});   // My Room's key (a bound card rings with it)
    const callId = randHex(8);
    // An invitation this page carries: the meeting a contact is asked to (set by "Invite a contact" just before this
    // page opened; read once, and only while fresh). The ring names it; accepting takes the contact there.
    let invite = '';
    try {
      const IK = 'gifos_mr_invite.' + roomKey(room, v), raw = JSON.parse(store().getItem(IK) || 'null');
      store().removeItem(IK);
      if (raw && TO_RE.test(String(raw.to || '')) && Math.abs(Date.now() - (+raw.at || 0)) <= (T().MYROOM_PROOF_WINDOW_MS || 0)) invite = String(raw.to);
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
      const p = await prove(mc.seed, room, v, host.myId(), host.now(), callId, cid, invite);
      host.send(pid, { op: 'card', c: mc.c, p, n: String(host.myName() || '').slice(0, 40) });
      if (!call) { call = { label: mc.name || room, state: 'waiting', at: host.now(), invite }; emit({ type: 'call', call }); }
    }

    // THE HOLDER. A door held me (a waiting room): that door may be the owner standing by. A seat proved the host key:
    // the owner is here. Either way, once per channel, I show my card.
    function onHeld(pid) { if (!host.owner()) showCard(pid).catch(() => {}); }
    function tick() {
      const now = host.now();
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
      let ck = '', to = ''; try { const ps = JSON.parse(m.p.sp); ck = pid + '|' + String(ps.call || ''); to = TO_RE.test(String(ps.to || '')) ? String(ps.to) : ''; } catch (e) { ck = pid + '|'; }
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
        rings.set(pid, { label, id: o.id, at: now, ck, to });
        sendSigned(pid, 'ringing');
        emit({ type: 'ring', pid, label, to });
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
        emit({ type: 'go', room: at[1], v: (at[2] || '').toLowerCase(), label: r.label });
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
    async function give(pid, label) {
      const at = host.owner() ? { room, v } : mine(); if (!at) return false;
      const K = hostSecret(at.room, at.v); if (!K) return false;
      // The card swap: a person who has a My Room proves its key here and now, and the card is bound to it (caller ID ✓);
      // one with no room (no answer within two ticks) gets a bearer card.
      const w = await new Promise((resolve) => {
        keyWaits.set(pid, resolve);
        host.send(pid, { op: 'keyask', r: roomKey(at.room, at.v) });
        setTimeout(() => { if (keyWaits.get(pid) === resolve) { keyWaits.delete(pid); resolve(null); } }, 2 * (T().MYROOM_TICK_MS || 0));
      });
      const bind = w && (await keyWordOk(w, at.room, at.v, pid, host.now())) ? w.pub : '';
      const r = await mint(K, at.room, at.v, label, bind ? { bind } : {});
      const t = parseToken(r.token);
      host.send(pid, Object.assign({ op: 'card', c: r.c, from: String(host.myName() || '').slice(0, 40) }, bind ? { nb: 1 } : { s: t.seed }));
      noteIssued(at.room, at.v, r.id, label, r.exp);
      if (!host.owner()) { given.add(pid); emit({ type: 'gave', pid }); }
      return true;
    }
    const given = new Set();   // people I gave my card back to in this meeting
    const keyWaits = new Map(); // pid -> the card swap waiting for that person's key word
    // A card link for this room (the lobby's "Make a card", and the card-back offer when the other side has gone).
    async function linkFor(label, origin) {
      const K = hostSecret(room, v); if (!K) return '';
      const r = await mint(K, room, v, label); noteIssued(room, v, r.id, label, r.exp);
      return cardLink(origin, room, v, r.token);
    }

    async function onMsg(pid, m) {
      if (!hosted || !m || typeof m.op !== 'string') return;
      try {
        if (m.op === 'card' && host.owner() && m.p) return await onCardShown(pid, m);
        if (m.op === 'keyask' && typeof m.r === 'string') {   // someone here is handing me a card: my room's key word, for that room only
          const at = /^([a-z0-9-]{1,64})\.([a-f0-9]{16,64})$/i.exec(m.r); if (!at) return;
          const w = await keyWord(at[1], at[2], host.myId(), host.now()); if (w) host.send(pid, { op: 'key', w });
          return;
        }
        if (m.op === 'key' && m.w && keyWaits.has(pid)) { const f = keyWaits.get(pid); keyWaits.delete(pid); f(m.w); return; }
        if (m.op === 'card' && m.c && ((m.s && typeof m.s === 'string') || m.nb === 1)) {
          // A new card for me, for the room its signed statement names (this room's host hands out this room's cards; a
          // caller hands back a card to its own room). It checks itself; the person decides whether to keep it.
          let at = null; try { at = /^([a-z0-9-]{1,64})\.([a-f0-9]{16,64})$/i.exec(JSON.parse(m.c.sp).room); } catch (e) { at = null; }
          if (!at || isMine(at[1], at[2])) return;
          const tok = b64u(JSON.stringify(m.s ? [m.c.sp, m.c.sig, m.c.pub, m.s] : [m.c.sp, m.c.sig, m.c.pub]));
          const f = await readCard(tok, at[1], at[2]); if (!f) return;
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
      if (linkCard && linkCard.token === f.token) { linkCard = null; try { root.sessionStorage.removeItem(SS); } catch (e) {} }   // kept in Contacts now: one copy
      if (call) { call.label = c.name; emit({ type: 'call', call }); } return c; }

    return {
      on: (f) => { listeners.push(f); if (lastOffer) { const o = lastOffer; lastOffer = null; try { f(o); } catch (e) {} } return () => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }; },
      onMsg, onHeld, tick, answer, decline, give, linkFor, takeLinkCard, save,
      drop: (pid, w) => why(pid, w),
      people: () => host.people(), gaveTo: (pid) => given.has(pid), hostIds: () => host.hosts(),
      state: () => ({ room, v, owner: !!host.owner(), mine: isMine(room, v), standby, live: !!(hosted && host.live()), wentLive, whys: Array.from(whys), call: call ? Object.assign({}, call) : null, rings: Array.from(rings, ([pid, r]) => ({ pid, label: r.label, at: r.at, to: r.to || '' })), holdsCard: !!myCard() }),
    };
  }

  GifOS.meetMyRoom = {
    KEY, make, mint, check, parseToken, prove, proofOk, myKey, keyWord, keyWordOk, sealLabel, openLabel, readCard, renew,
    mine, isMine, create, adopt, hosted, stayOn, setStay,
    contacts, contactFor, keep, forget, rename, issued, revoke, revoked, missed, noteMissed, clearMissed, cardLink, roomKey,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = GifOS.meetMyRoom;
})(typeof window !== 'undefined' ? window : globalThis);
