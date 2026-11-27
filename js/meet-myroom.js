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
 *   holder -> host   {op:'card', c, p, n}  "I hold this card" (c: sp/sig/pub, p: the bound proof, n: my name). Sent
 *                    once per channel to a door that holds me (the waiting room) and to each seat that proved the host
 *                    key; the host's page decides what it means (a ring while it stands by, a renewal while together).
 *   host -> holder   {op:'card', c, s?, from}  a card: with s (a seed) a new card to keep, without one a renewal of a
 *                    card the holder has (same id, later expiry).
 *   host -> holder   {op:'ringing' | 'dec' | 'missed', w}  signed by the host key (admSigned), so no guest can fake
 *                    the owner's answer. Answer is no frame: the host admits the caller and goes live.
 *   host -> holder   {op:'stop', w}  another of the owner's devices took the call.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const KEY = { mine: 'gifos_myroom', contacts: 'gifos_contacts', missed: 'gifos_myroom_missed', issued: 'gifos_myroom_cards', revoked: 'gifos_myroom_revoked', stay: 'gifos_myroom_stay' };
  const MAX_TOKEN = 2048;           // a card frame or link larger than this is no card (flood bound, before any crypto)
  const ROOM_RE = /^[a-z0-9-]{1,64}$/i, VER_RE = /^[a-f0-9]{16,64}$/;
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
    let seed = '', cpub = '', id = '', lab = '';
    if (opts.renew) { id = opts.renew.id; cpub = opts.renew.cpub; lab = opts.renew.lab; }
    else { seed = randHex(32); cpub = (await N.edKeysFromSeedHex(seed)).pubB64; id = randHex(8); lab = await sealLabel(K, label); }
    const exp = now + (T().MYROOM_CARD_LIFE_MS || 0);
    const sp = JSON.stringify({ act: 'card', room: roomKey(room, v), id, cpub, iat: now, exp, lab });
    const sig = await N.edSign(hk.priv, sp);
    const token = b64u(JSON.stringify(seed ? [sp, sig, hk.pubB64, seed] : [sp, sig, hk.pubB64]));
    return { token, id, exp, iat: now, cpub, lab, c: { sp, sig, pub: hk.pubB64 } };
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
  async function prove(seed, room, v, myId, now) {
    const k = await net().edKeysFromSeedHex(seed);
    const sp = JSON.stringify({ act: 'ring', room: roomKey(room, v), from: String(myId), ts: now || Date.now() });
    return { sp, sig: await net().edSign(k.priv, sp) };
  }
  async function proofOk(card, p, room, v, from, now) {
    if (!p || typeof p.sp !== 'string' || p.sp.length > 512 || typeof p.sig !== 'string') return false;
    if (!(await net().edVerify(card.cpub, p.sig, p.sp))) return false;
    let o; try { o = JSON.parse(p.sp); } catch (e) { return false; }
    return !!o && o.act === 'ring' && o.room === roomKey(room, v) && o.from === String(from) && Math.abs((now || Date.now()) - (+o.ts || 0)) <= (T().MYROOM_PROOF_WINDOW_MS || 0);
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
    const c = { room: f.room, v: String(f.v).toLowerCase(), token: f.token, id: f.id, exp: f.exp, name: String(f.name || was.name || f.room).slice(0, 40), at: was.at || Date.now(), last: f.last || was.last || 0 };
    list.unshift(c);
    writeJson(KEY.contacts, list.slice(0, 500));
    return c;
  }
  function forget(room, v) { const k = roomKey(room, v); writeJson(KEY.contacts, contacts().filter((c) => roomKey(c.room, c.v) !== k)); }
  function rename(room, v, name) { const c = contactFor(room, v); if (c) keep(Object.assign({}, c, { name })); }
  // A renewal: the same card (id) with a later expiry; the seed stays the one this device holds.
  async function renew(room, v, c) {
    const was = contactFor(room, v); if (!was) return false;
    const old = parseToken(was.token); if (!old || !old.seed) return false;
    const o = await check(c, room, v); if (!o || o.id !== was.id || !(o.exp > (was.exp || 0))) return false;
    keep(Object.assign({}, was, { token: b64u(JSON.stringify([c.sp, c.sig, c.pub, old.seed])), exp: o.exp }));
    return true;
  }
  // A card handed to me (a link or a frame): checked, then returned for the person to save.
  async function readCard(token, room, v) {
    const t = parseToken(token); if (!t || !t.seed) return null;
    const o = await check(t.c, room, v); if (!o) return null;
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
  // verifyAdm(w, act), live() (my mic or camera is on), hostLive() (another seat that proved the host key has its mic or
// camera on), isHost(pid), isHere(pid) (seated in this room), seated(), mic(on), others() (people seated here besides
// me), now().
  function make(host) {
    const listeners = [];
    const emit = (ev) => { for (const f of listeners.slice()) { try { f(ev); } catch (e) {} } };
    const room = host.room(), v = String(host.v() || '').toLowerCase();
    const hosted = !!(room && v);
    let linkCard = null;        // a card the address carried (to save, or to call with once)
    // holder side
    const told = new Set();     // channels I have shown my card on (pid)
    let call = null;            // { label, state: 'waiting'|'ringing'|'answered'|'declined'|'noanswer', at }
    // owner side
    const rings = new Map();    // pid -> { label, id, at, card }
    const lastIn = new Map();   // pid -> last card frame time (flood bound before crypto)
    let standby = false, wentLive = false;

    const myCard = () => {
      if (!hosted) return null;
      if (linkCard) return linkCard;
      const c = contactFor(room, v); if (!c) return null;
      const t = parseToken(c.token); return t && t.seed ? { token: c.token, seed: t.seed, c: t.c, name: c.name } : null;
    };
    async function showCard(pid) {
      const mc = myCard(); if (!mc || told.has(pid)) return;
      told.add(pid);
      const p = await prove(mc.seed, room, v, host.myId(), host.now());
      host.send(pid, { op: 'card', c: mc.c, p, n: String(host.myName() || '').slice(0, 40) });
      if (!call) { call = { label: mc.name || room, state: 'waiting', at: host.now() }; emit({ type: 'call', call }); }
    }

    // THE HOLDER. A door held me (a waiting room): that door may be the owner standing by. A seat proved the host key:
    // the owner is here. Either way, once per channel, I show my card.
    function onHeld(pid) { if (!host.owner()) showCard(pid).catch(() => {}); }
    function tick() {
      const now = host.now();
      if (hosted && !host.owner()) {
        const mc = myCard();
        if (mc) {
          if (!call) { call = { label: mc.name || room, state: 'waiting', at: now }; emit({ type: 'call', call }); }
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
      if (want && !standby) { standby = true; if (!host.holding()) host.hold(true); emit({ type: 'standby', on: true }); }
      if (!want && standby) { standby = false; emit({ type: 'standby', on: false }); }
      const takenElsewhere = host.hostLive();   // another of my devices answered (it went live): mine stops, no missed call
      for (const [pid, r] of Array.from(rings)) {
        if (takenElsewhere) { rings.delete(pid); emit({ type: 'stopped', pid, label: r.label }); continue; }
        const gone = !host.held(pid) && !host.isHere(pid);
        if (gone || now - r.at >= (T().MYROOM_RING_MS || 0)) {
          rings.delete(pid);
          noteMissed(room, v, r.label, r.at);
          if (!gone) sendSigned(pid, 'missed');
          emit({ type: 'missed', pid, label: r.label, at: r.at });
        }
      }
    }
    async function sendSigned(pid, op) { const w = await host.signAdm('mr' + op, { to: String(pid) }); if (w) host.send(pid, { op, w }); }

    async function onCardShown(pid, m) {
      const now = host.now();
      if (now - (lastIn.get(pid) || 0) < (T().MYROOM_TICK_MS || 0)) return;   // one card frame per peer per tick, before any crypto
      lastIn.set(pid, now);
      const o = await check(m.c, room, v, now);
      if (!o || revoked().indexOf(o.id) >= 0) return;
      if (!(await proofOk(o, m.p, room, v, pid, now))) return;
      const K = hostSecret(room, v); if (!K) return;
      const label = (await openLabel(K, o.lab)) || String(m.n || '').slice(0, 40) || 'Someone';
      // Renew while together: a card issued more than a day ago gets a fresh year (same id, same key).
      if (now - (+o.iat || 0) >= (T().MYROOM_RENEW_AFTER_MS || 0)) {
        try { const r = await mint(K, room, v, '', { renew: { id: o.id, cpub: o.cpub, lab: o.lab } }); host.send(pid, { op: 'card', c: r.c, from: String(host.myName() || '') }); noteIssued(room, v, o.id, label, r.exp); emit({ type: 'renewed', pid, label }); } catch (e) {}
      }
      if (standby && !rings.has(pid) && (host.held(pid) || host.isHere(pid))) {
        rings.set(pid, { label, id: o.id, at: now });
        sendSigned(pid, 'ringing');
        emit({ type: 'ring', pid, label });
      } else if (!rings.has(pid)) emit({ type: 'arrived', pid, label });
    }
    function answer(pid) {
      const r = rings.get(pid); if (!r) return false;
      rings.delete(pid);
      wentLive = true;
      if (host.held(pid)) host.admit(pid);
      host.mic(true);                          // Answer is the person's tap: the mic opens; the camera stays off
      for (const other of rings.keys()) { rings.delete(other); sendSigned(other, 'dec'); }
      emit({ type: 'answered', pid, label: r.label });
      return true;
    }
    function decline(pid) {
      const r = rings.get(pid); if (!r) return false;
      rings.delete(pid);
      sendSigned(pid, 'dec');
      emit({ type: 'declined', pid, label: r.label });
      return true;
    }
    // Hand a card to a person in this room (a new card: the frame carries its seed over the end-to-end channel).
    async function give(pid, label) {
      const K = hostSecret(room, v); if (!K || !host.owner()) return false;
      const r = await mint(K, room, v, label);
      const t = parseToken(r.token);
      host.send(pid, { op: 'card', c: r.c, s: t.seed, from: String(host.myName() || '').slice(0, 40) });
      noteIssued(room, v, r.id, label, r.exp);
      return true;
    }
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
        if (m.op === 'card' && !host.owner() && m.c && host.isHost(pid)) {
          if (m.s) {   // a new card for me
            const tok = b64u(JSON.stringify([m.c.sp, m.c.sig, m.c.pub, m.s]));
            const f = await readCard(tok, room, v); if (!f) return;
            emit({ type: 'offer', card: f, from: String(m.from || '').slice(0, 40) });
          } else if (await renew(room, v, m.c)) emit({ type: 'renewed-mine' });
          return;
        }
        if (!host.owner() && call && (m.op === 'ringing' || m.op === 'dec' || m.op === 'missed')) {
          const o = await host.verifyAdm(m.w, 'mr' + m.op);
          if (!o || o.to !== String(host.myId())) return;
          call.state = m.op === 'ringing' ? 'ringing' : m.op === 'dec' ? 'declined' : 'noanswer';
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
      emit({ type: 'offer', card: f, from: '', fromLink: true });
      return f;
    }
    function save(f, name) { const c = keep(Object.assign({}, f, { name })); if (linkCard && linkCard.token === f.token) linkCard.name = c.name; if (call) { call.label = c.name; emit({ type: 'call', call }); } return c; }

    return {
      on: (f) => { listeners.push(f); return () => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }; },
      onMsg, onHeld, tick, answer, decline, give, linkFor, takeLinkCard, save,
      state: () => ({ room, v, owner: !!host.owner(), mine: isMine(room, v), standby, call: call ? Object.assign({}, call) : null, rings: Array.from(rings, ([pid, r]) => ({ pid, label: r.label, at: r.at })), holdsCard: !!myCard() }),
    };
  }

  GifOS.meetMyRoom = {
    KEY, make, mint, check, parseToken, prove, proofOk, sealLabel, openLabel, readCard, renew,
    mine, isMine, create, adopt, hosted, stayOn, setStay,
    contacts, contactFor, keep, forget, rename, issued, revoke, revoked, missed, noteMissed, clearMissed, cardLink, roomKey,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = GifOS.meetMyRoom;
})(typeof window !== 'undefined' ? window : globalThis);
