/*
 * gifos-sub.js — the rules of GifOS subscriptions, one copy for every side.
 *
 * Plans (monthly, through PayPal):
 *   room20     $2   admin rooms of up to 20 people
 *   unlimited  $5   admin rooms with no people limit
 *   streamer   $10  unlimited admin rooms and a storage budget for
 *                   recordings and transcripts
 * Free: open rooms without limit, voice (never video) across networks that
 * block direct connections, and admin rooms of up to 5 people (Nathan,
 * 2026-11-11). The free plan has a license too, signed without PayPal and
 * bound to the person's own key (subscription id "F-" + a hash of that key),
 * so a free admin room carries its plan exactly as a paid one does. A free
 * license is NOT a subscription: it never lets its holder past a room's line.
 *
 * A subscription is shown with a LICENSE: a small JSON text the payment
 * service signs with its key (published at /gifos-pay.key). It names the
 * plan, the subscriber's own public key and when it runs out. A license is
 * only good together with a fresh signature from that key, so a copied
 * license is useless to anyone else.
 *
 * The people limit belongs to the room's admin's plan. A room whose admin
 * holds the $5 or $10 plan has no limit. In a room whose admin holds the $2
 * plan, someone WITHOUT a subscription who tries to enter when the room
 * already holds 20 people is turned away with a plain message. An admin room
 * on the free plan, or whose plan cannot be shown for any reason (none shown,
 * forged, run out, the host left, the subscription moved to another meeting),
 * has the free line of 5. Anyone holding any PAID plan is always let in, even
 * past the line. The line applies only at entry: nobody inside is removed.
 * The room's count is the door's greeter list (plus the door itself), read
 * fresh when someone without a plan comes in (run.html subsRoomCount).
 *
 * One meeting at a time: a subscription powers one meeting (open or admin
 * room) at a time. Joining a meeting gets a short meeting ticket from the
 * payment service, renewed every couple of minutes while that meeting is the
 * subscription's newest; joining another meeting moves it there.
 *
 * How the room's plan is known: the admin puts their meeting ticket in the
 * room's signed admin orders, with a signature from their subscription key
 * over the room's name. Everyone at the door checks it (roomTierOf); a
 * missing, forged, run-out, other-room or borrowed ticket reads as no plan:
 * the free line of 5. A person at the door who has a plan shows their own ticket
 * for this meeting, signing the door's fresh challenge (doorProofOk).
 *
 * Everything here is pure, with the clock and the signature check passed in,
 * so a page, the payment service and the meeting servers apply the same
 * rules.
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});

  const SELLER = 'gifos.app';
  const LICENSE_KIND = 'gifos-sub-license';
  const PROOF_TAG = 'gifos-sub-proof';
  const ASK_TAG = 'gifos-sub-ask';
  const KEY_RE = /^[A-Za-z0-9+/]{43}=$/;          // an Ed25519 public key, 32 bytes base64
  const SUB_ID_RE = /^I-[A-Za-z0-9]{4,40}$/;       // a PayPal subscription id
  const FREE_ID_RE = /^F-[0-9a-f]{24}$/;           // a free plan's id: F- + a hash of its key (freeIdFor)
  const NONCE_RE = /^[A-Za-z0-9+/=_.:-]{8,128}$/;
  const PEOPLE_LIMIT = 20;                         // the room20 plan's room size
  const FREE_LIMIT = 5;                            // the free plan's admin room size
  const ASK_WINDOW_S = 300;                        // a signed request is good this long
  const FLAG_KEY = 'gifos-subs';                   // the page switch (default off)

  // What each PAID plan grants. storage is filled from the license (the
  // payment service's settings), never assumed here. vouches: the TURN video
  // links one subscriber present vouches for per slot (turn/worker paid.js;
  // Nathan 2026-11-11: 3 / 6 / 20).
  const TIERS = {
    room20: { id: 'room20', name: 'Admin rooms, up to 20 people', price: '$2', priceYear: '$20', adminRooms: true, roomLimit: PEOPLE_LIMIT, turnVideo: true, storage: false, vouches: 3, paid: true },
    unlimited: { id: 'unlimited', name: 'Admin rooms, unlimited people', price: '$5', priceYear: '$50', adminRooms: true, roomLimit: null, turnVideo: true, storage: false, vouches: 6, paid: true },
    streamer: { id: 'streamer', name: 'Streamer: unlimited admin rooms and storage', price: '$10', priceYear: '$100', adminRooms: true, roomLimit: null, turnVideo: true, storage: true, vouches: 20, paid: true },
  };
  const TIER_IDS = Object.keys(TIERS);              // the plans sold through PayPal
  // The FREE plan (Nathan 2026-11-11): admin rooms of up to 5 people; no TURN
  // video and so no vouches; no storage. It is never sold, never a TIER.
  const FREE_PLAN = Object.freeze({ id: 'free', name: 'Free: admin rooms, up to 5 people', price: '$0', priceYear: '$0', adminRooms: true, roomLimit: FREE_LIMIT, turnVideo: false, storage: false, vouches: 0, paid: false });
  const PLANS = Object.freeze(Object.assign({}, TIERS, { free: FREE_PLAN }));   // every plan a license or ticket may name
  const PLAN_IDS = Object.keys(PLANS);
  const isPlan = (t) => typeof t === 'string' && Object.prototype.hasOwnProperty.call(PLANS, t);
  const isPaid = (t) => typeof t === 'string' && Object.prototype.hasOwnProperty.call(TIERS, t);
  // A license or ticket names its subscription: a PayPal id for a paid plan,
  // an F- id for the free plan.
  const idFits = (tier, subId) => typeof subId === 'string' && (tier === 'free' ? FREE_ID_RE.test(subId) : SUB_ID_RE.test(subId));
  // freeIdFor(buyerKey) -> 'F-' + 24 hex: the free plan's id is its key's own,
  // so one key holds one free record and nobody can name another key's.
  async function freeIdFor(buyerKey) {
    const d = new Uint8Array(await root.crypto.subtle.digest('SHA-256', utf8('gifos-sub-free:' + String(buyerKey))));
    let h = ''; for (let i = 0; i < 12; i++) h += d[i].toString(16).padStart(2, '0');
    return 'F-' + h;
  }
  const FREE = Object.freeze({ tier: null, subscribed: false, adminRooms: false, openRooms: true, roomLimit: null, turnAudio: true, turnVideo: false, storage: null, bypassLimit: false, vouches: 0 });

  const TEXT = {
    full: 'This meeting is full for people without a subscription. Any GifOS subscription lets you join.',
    fullFree: 'This room is full on the free plan',
    fullFreeNote: 'Any GifOS subscription lets you join.',
    needForAdmin: 'Admin rooms come with a GifOS subscription. Open rooms stay free.',
    waiting: 'Checking whether this meeting has room for you…',
    lapsed: 'Your subscription has ended. Renew it in Settings to keep your admin rooms.',
    pending: 'Finish signing up in the PayPal window. This updates as soon as PayPal confirms.',
    cancelled: 'Your subscription is cancelled. It keeps working until the end of the month you paid for.',
  };

  const intS = (v) => Number.isInteger(v);

  // ---- the license ----------------------------------------------------------
  // checkLicense(o, nowS) -> o or null. o is the PARSED license; its
  // signature is checked by the caller (verifyLicense does both).
  function checkLicense(o, nowS) {
    if (!o || typeof o !== 'object') return null;
    if (o.v !== 1 || o.kind !== LICENSE_KIND || o.payeeId !== SELLER) return null;
    if (!isPlan(o.tier)) return null;
    if (typeof o.buyerKey !== 'string' || !KEY_RE.test(o.buyerKey)) return null;
    if (!idFits(o.tier, o.subId)) return null;
    if (!intS(o.issued) || !intS(o.exp) || o.exp <= o.issued) return null;
    if (!(nowS < o.exp)) return null;
    if (o.issued > nowS + ASK_WINDOW_S) return null;   // not from the future
    return o;
  }

  const b64ToBytes = (s) => {
    const bin = (typeof atob === 'function' ? atob : (x) => Buffer.from(x, 'base64').toString('binary'))(String(s));
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  };
  const utf8 = (s) => new TextEncoder().encode(String(s));

  // verifyLicense({licenseJson, sig}, verify, nowS) -> the parsed license or
  // null. verify(sigBytes, msgBytes) -> bool checks the payment service's
  // signature with its published key (the caller holds the key).
  async function verifyLicense(lic, verify, nowS) {
    if (!lic || typeof lic.licenseJson !== 'string' || typeof lic.sig !== 'string') return null;
    if (lic.licenseJson.length > 2048) return null;
    let sigBytes; try { sigBytes = b64ToBytes(lic.sig); } catch (e) { return null; }
    if (sigBytes.length !== 64) return null;
    let ok = false;
    try { ok = !!(await verify(sigBytes, utf8(lic.licenseJson))); } catch (e) { ok = false; }
    if (!ok) return null;
    let o; try { o = JSON.parse(lic.licenseJson); } catch (e) { return null; }
    o = checkLicense(o, nowS);
    if (o && o.tier === 'free' && o.subId !== (await freeIdFor(o.buyerKey))) return null;   // a free id belongs to its own key
    return o;
  }

  // rightsOf(license or null) -> what this person may do. A null, broken or
  // run-out license is no plan (open rooms only). A free license gives admin
  // rooms of up to 5 and is not a subscription: it lets nobody past a line.
  function rightsOf(o, nowS) {
    const lic = o && checkLicense(o, nowS);
    if (!lic) return Object.assign({}, FREE);
    if (lic.tier === 'free') return freeRights(lic.exp);
    const t = TIERS[lic.tier];
    const st = t.storage && lic.storage && typeof lic.storage === 'object' ? {
      gb: Number(lic.storage.gb) || 0,
      lapseKeepDays: lic.storage.lapseKeepDays == null ? 30 : Number(lic.storage.lapseKeepDays),
      atCap: String(lic.storage.atCap || 'refuse-new'),
      warnAtPercent: Number(lic.storage.warnAtPercent) || 80,
    } : null;
    return {
      tier: t.id, subscribed: true, adminRooms: t.adminRooms, openRooms: true,
      roomLimit: t.roomLimit, turnAudio: true, turnVideo: t.turnVideo,
      storage: st, bypassLimit: true, until: lic.exp, vouches: t.vouches,
    };
  }
  function freeRights(until) {
    return { tier: 'free', subscribed: false, adminRooms: true, openRooms: true, roomLimit: FREE_LIMIT, turnAudio: true, turnVideo: false, storage: null, bypassLimit: false, until, vouches: 0 };
  }

  // storageAfterLapse(untilS, nowS, keepDays) -> 'active' | 'kept' | 'delete-due'.
  // No automatic retention while subscribed; after the plan ends the files are
  // kept keepDays (30) and are then due for deletion. Pure: it deletes nothing.
  function storageAfterLapse(untilS, nowS, keepDays) {
    if (nowS <= untilS) return 'active';
    return nowS <= untilS + (keepDays == null ? 30 : keepDays) * 86400 ? 'kept' : 'delete-due';
  }

  // ---- proving the license is yours -----------------------------------------
  // The holder signs proofMessage(context, nonce) with the private half of
  // the license's buyerKey. context names where it is shown (a room tag, a
  // service name); nonce is the checker's fresh challenge.
  function proofMessage(context, nonce) {
    return PROOF_TAG + '\x00' + String(context) + '\x00' + String(nonce);
  }
  // verifyProof(license, context, nonce, proofSig, verifyKey) -> bool.
  // verifyKey(pubB64, sigBytes, msgBytes) -> bool.
  async function verifyProof(lic, context, nonce, proofSig, verifyKey) {
    if (!lic || typeof lic.buyerKey !== 'string' || !KEY_RE.test(lic.buyerKey)) return false;
    if (typeof nonce !== 'string' || !NONCE_RE.test(nonce)) return false;
    let sig; try { sig = b64ToBytes(proofSig); } catch (e) { return false; }
    if (sig.length !== 64) return false;
    try { return !!(await verifyKey(lic.buyerKey, sig, utf8(proofMessage(context, nonce)))); } catch (e) { return false; }
  }

  // A request to the payment service about one subscription (read the
  // license, cancel) is signed by the subscriber's key: askMessage is what
  // is signed; askFresh says whether its time is inside the window.
  function askMessage(action, subId, at) {
    return ASK_TAG + '\x00' + String(action) + '\x00' + String(subId) + '\x00' + String(at);
  }
  const askFresh = (at, nowS) => intS(at) && Math.abs(nowS - at) <= ASK_WINDOW_S;

  // ---- who may enter an admin room ------------------------------------------
  // admission({adminRoom, roomTier, listLength, hold, entrant}) where entrant
  // is {isAdmin, rights}. roomTier is the room admin's plan when known. An
  // admin room with no valid plan is on the FREE line (Nathan 2026-11-11):
  // whatever the reason, the plan the door can check is the plan it applies.
  // roomLimitFor(null) stays 20, the line of the $2 plan.
  // -> {admit:true, why} | {admit:false, wait:true, why} | {admit:false, why, message}
  function roomLimitFor(roomTier) {
    if (isPlan(roomTier)) return PLANS[roomTier].roomLimit;
    return PEOPLE_LIMIT;
  }
  function admission(o) {
    o = o || {};
    if (!o.adminRoom) return { admit: true, why: 'open-room' };
    const e = o.entrant || {};
    if (e.isAdmin) return { admit: true, why: 'admin' };
    if (e.rights && e.rights.subscribed) return { admit: true, why: 'subscriber' };
    // Right after a meeting server restarts its list refills over a few
    // seconds; a short list then is not a count.
    if (o.hold) return { admit: false, wait: true, why: 'restart-hold', message: TEXT.waiting };
    const n = Number(o.listLength);
    if (!Number.isFinite(n) || n < 0) return { admit: false, wait: true, why: 'no-count', message: TEXT.waiting };
    const tier = isPlan(o.roomTier) ? o.roomTier : 'free';
    const limit = roomLimitFor(tier);
    if (limit != null && n >= limit) return tier === 'free' ? { admit: false, why: 'full', limit, free: true, message: TEXT.fullFree } : { admit: false, why: 'full', limit, message: TEXT.full };
    return { admit: true, why: 'room-has-space' };
  }

  // ---- the room's plan, carried by the room ---------------------------------
  // room is the admin room's full name ("<name>.<verifier>"): a proof made
  // for one room is worth nothing in another.
  const roomContext = (room) => 'room:' + String(room);
  const doorContext = (room) => 'door:' + String(room);
  // The admin's room order: {lic:{licenseJson,sig}, proof, at}. proof signs
  // proofMessage(roomContext(room), 'at:' + at) with the license's key.
  // ---- one meeting at a time: the meeting ticket -----------------------------
  // A subscription powers ONE meeting at a time, admin room or open room.
  // Joining a meeting asks the payment service for a ticket naming that
  // meeting (meetingTag: the service never learns the room's name). The
  // service keeps only the subscription's newest meeting: a ticket lasts
  // TICKET_S and is renewed every RENEW_EVERY_S, and a renewal for any older
  // meeting is refused, so an old meeting loses the subscription within
  // TICKET_S. Payment is checked when the meeting is JOINED, never on a
  // renewal: a meeting that started paid runs to its end.
  const TICKET_KIND = 'gifos-sub-ticket';
  const TICKET_S = 300;
  const RENEW_EVERY_S = 120;
  const MEETING_RE = /^[0-9a-f]{32}$/;
  async function meetingTag(room) {
    const d = new Uint8Array(await root.crypto.subtle.digest('SHA-256', utf8('gifos-sub-meeting:' + String(room))));
    let h = ''; for (let i = 0; i < 16; i++) h += d[i].toString(16).padStart(2, '0');
    return h;
  }
  function checkTicket(o, nowS, meeting) {
    if (!o || typeof o !== 'object') return null;
    if (o.v !== 1 || o.kind !== TICKET_KIND || o.payeeId !== SELLER) return null;
    if (!isPlan(o.tier)) return null;
    if (typeof o.buyerKey !== 'string' || !KEY_RE.test(o.buyerKey)) return null;
    if (!idFits(o.tier, o.subId)) return null;
    if (typeof o.meeting !== 'string' || !MEETING_RE.test(o.meeting)) return null;
    if (meeting != null && o.meeting !== meeting) return null;
    if (!intS(o.gen) || o.gen < 1 || !intS(o.issued) || !intS(o.exp)) return null;
    if (o.exp <= o.issued || o.exp - o.issued > TICKET_S + 60) return null;
    if (!(nowS < o.exp) || o.issued > nowS + ASK_WINDOW_S) return null;
    return o;
  }
  // verifyTicket({ticketJson, sig}, verify, nowS, meeting) -> the ticket or null.
  async function verifyTicket(t, verify, nowS, meeting) {
    if (!t || typeof t.ticketJson !== 'string' || typeof t.sig !== 'string' || t.ticketJson.length > 2048) return null;
    let sigBytes; try { sigBytes = b64ToBytes(t.sig); } catch (e) { return null; }
    if (sigBytes.length !== 64) return null;
    let ok = false;
    try { ok = !!(await verify(sigBytes, utf8(t.ticketJson))); } catch (e) { ok = false; }
    if (!ok) return null;
    let o; try { o = JSON.parse(t.ticketJson); } catch (e) { return null; }
    o = checkTicket(o, nowS, meeting);
    if (o && o.tier === 'free' && o.subId !== (await freeIdFor(o.buyerKey))) return null;
    return o;
  }
  // What a ticket grants in its meeting (same entitlements as the plan).
  function ticketRights(t) {
    if (!t || !isPlan(t.tier)) return Object.assign({}, FREE);
    if (t.tier === 'free') return freeRights(t.exp);
    const x = TIERS[t.tier];
    return { tier: x.id, subscribed: true, adminRooms: x.adminRooms, openRooms: true, roomLimit: x.roomLimit, turnAudio: true, turnVideo: x.turnVideo, storage: null, bypassLimit: true, until: t.exp, vouches: x.vouches };
  }

  // The admin's room order: {ticket:{ticketJson,sig}, proof, at}. The ticket
  // must be current and for THIS room's meeting; proof signs
  // proofMessage(roomContext(room), 'at:' + at) with the ticket's key.
  // -> {tier, exp} or null.
  async function roomTierOf(order, room, verifyPay, verifyKey, nowS) {
    if (!order || typeof order !== 'object' || order.on === false) return null;
    if (!Number.isInteger(order.at)) return null;
    const t = await verifyTicket(order.ticket, verifyPay, nowS, await meetingTag(room));
    if (!t) return null;
    const ok = await verifyProof(t, roomContext(room), 'at:' + order.at, order.proof, verifyKey);
    return ok ? { tier: t.tier, exp: t.exp } : null;
  }
  // doorVerdict: what a greeter does with a knocker it has no proof from.
  // -> 'let-in' (no limit applies, or the room has space, or the count is not
  // readable yet) | 'ask' (the room is at its line: the knocker must show a plan)
  function doorVerdict(o) {
    const v = admission({ adminRoom: o.adminRoom, roomTier: o.roomTier, listLength: o.count, hold: o.hold, entrant: { isAdmin: false, rights: FREE } });
    return v.admit || v.wait ? 'let-in' : 'ask';
  }
  // The knocker's answer to the door's challenge: a current ticket for THIS
  // room's meeting, on a PAID plan (a free ticket is no way past a line), and
  // the ticket key's signature over the door's nonce.
  async function doorProofOk(shown, room, nonce, verifyPay, verifyKey, nowS) {
    if (!shown || typeof shown !== 'object') return null;
    const t = await verifyTicket(shown.ticket, verifyPay, nowS, await meetingTag(room));
    if (!t || !isPaid(t.tier)) return null;
    return (await verifyProof(t, doorContext(room), nonce, shown.proof, verifyKey)) ? t : null;
  }

  // ---- the subscription file (a provider GIF) ----------------------------------
  // The subscription lives in a file the person keeps and can move: a GifOS
  // GIF whose manifest says it provides the meeting subscription, holding the
  // subscription id, its plan and the 32-byte seed of the subscriber's key.
  // Anyone holding the file holds the subscription; the one-meeting-at-a-time
  // rule is what stops a copy from being shared (each join moves it).
  const CRED_KIND = 'gifos-sub-credential';
  const SEED_RE = /^[A-Za-z0-9+/]{43}=$/;
  function credentialOk(c) {
    if (!c || typeof c !== 'object' || c.v !== 1 || c.kind !== CRED_KIND) return null;
    if (!isPlan(c.tier) || !idFits(c.tier, c.subId)) return null;
    if (typeof c.seed !== 'string' || !SEED_RE.test(c.seed)) return null;
    let raw; try { raw = b64ToBytes(c.seed); } catch (e) { return null; }
    if (raw.length !== 32) return null;
    return { v: 1, kind: CRED_KIND, subId: c.subId, tier: c.tier, period: c.period === 'yearly' ? 'yearly' : 'monthly', seed: c.seed, buyerKey: typeof c.buyerKey === 'string' && KEY_RE.test(c.buyerKey) ? c.buyerKey : undefined };
  }
  function credentialFiles(c) {
    const ok = credentialOk(c);
    if (!ok) throw new Error('not a subscription credential');
    const t = PLANS[ok.tier];
    return {
      'manifest.json': JSON.stringify({
        gifos: '1.0', appId: 'gifos-subscription', name: 'GifOS subscription', entry: 'index.html',
        provides: { meet: ['subscription'] },     // a Provider: active only in the Providers folder
        accent: [120, 200, 255],
      }),
      'subscription.json': JSON.stringify(ok),
      'index.html': '<!doctype html><meta charset="utf-8"><title>GifOS subscription</title>' +
        '<body style="font:15px/1.5 system-ui;padding:1.2rem"><h2>GifOS subscription</h2><p>' + t.name + '.</p>' +
        '<p>Keep this file in the Providers folder on your Home Screen, or open it in a meeting\u2019s Settings on another browser. ' +
        'It works in one meeting at a time: joining a meeting moves it there.</p><p>Anyone with this file can use your subscription. Keep it private.</p>',
    };
  }
  function credentialFromFiles(files) {
    if (!files) return null;
    let m, c;
    const text = (v) => (v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v || ''));
    try { m = JSON.parse(text(files['manifest.json'])); c = JSON.parse(text(files['subscription.json'])); } catch (e) { return null; }
    if (!m || m.appId !== 'gifos-subscription' || !m.provides || !Array.isArray(m.provides.meet) || m.provides.meet.indexOf('subscription') < 0) return null;
    return credentialOk(c);
  }

  // ---- the page switch ------------------------------------------------------
  // Off unless #subs=1 / ?subs=1 rides the URL or localStorage['gifos-subs']
  // is '1'. #subs=0 turns it off again.
  function enabled(loc, store) {
    try {
      const s = String((loc && (loc.hash || '')) || '') + '&' + String((loc && (loc.search || '')) || '');
      const m = /(?:^|[#&?])subs=([01])(?:&|$)/.exec(s);
      if (m) return m[1] === '1';
      return !!(store && store.getItem(FLAG_KEY) === '1');
    } catch (e) { return false; }
  }

  GifOS.sub = {
    TIERS, TIER_IDS, FREE, TEXT, PEOPLE_LIMIT, LICENSE_KIND, SELLER, KEY_RE, SUB_ID_RE, ASK_WINDOW_S, FLAG_KEY,
    FREE_PLAN, FREE_LIMIT, FREE_ID_RE, PLANS, PLAN_IDS, isPlan, isPaid, freeIdFor, freeRights,
    checkLicense, verifyLicense, rightsOf, storageAfterLapse, proofMessage, verifyProof, askMessage, askFresh,
    roomLimitFor, admission, enabled, roomContext, doorContext, roomTierOf, doorVerdict, doorProofOk,
    TICKET_KIND, TICKET_S, RENEW_EVERY_S, meetingTag, checkTicket, verifyTicket, ticketRights,
    CRED_KIND, credentialOk, credentialFiles, credentialFromFiles,
  };
})(typeof window !== 'undefined' ? window : globalThis);
