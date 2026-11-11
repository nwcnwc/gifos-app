/*
 * gifos-sub.js — the rules of GifOS subscriptions, one copy for every side.
 *
 * Plans (monthly, through PayPal):
 *   room20     $2   admin rooms of up to 20 people
 *   unlimited  $5   admin rooms with no people limit
 *   streamer   $10  unlimited admin rooms and a storage budget for
 *                   recordings and transcripts
 * Free: open rooms without limit, and voice (never video) across networks
 * that block direct connections.
 *
 * A subscription is shown with a LICENSE: a small JSON text the payment
 * service signs with its key (published at /gifos-pay.key). It names the
 * plan, the subscriber's own public key and when it runs out. A license is
 * only good together with a fresh signature from that key, so a copied
 * license is useless to anyone else.
 *
 * The people limit belongs to the room's admin's plan. A room whose admin
 * holds the $5 or $10 plan has no limit. In a room whose admin holds the $2
 * plan (or whose plan cannot be shown), someone WITHOUT a subscription who
 * tries to enter when the room already holds 20 people is turned away with
 * a plain message. Anyone holding any plan is always let in, even past 20.
 * The room's count is the length of its door's list of greeters.
 *
 * One meeting at a time: a subscription powers one meeting (open or admin
 * room) at a time. Joining a meeting gets a short meeting ticket from the
 * payment service, renewed every couple of minutes while that meeting is the
 * subscription's newest; joining another meeting moves it there.
 *
 * How the room's plan is known: the admin puts their meeting ticket in the
 * room's signed admin orders, with a signature from their subscription key
 * over the room's name. Everyone at the door checks it (roomTierOf); a
 * missing, forged, run-out, other-room or borrowed ticket reads as the
 * 20-person line. A person at the door who has a plan shows their own ticket
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
  const NONCE_RE = /^[A-Za-z0-9+/=_.:-]{8,128}$/;
  const PEOPLE_LIMIT = 20;                         // the room20 plan's room size
  const ASK_WINDOW_S = 300;                        // a signed request is good this long
  const FLAG_KEY = 'gifos-subs';                   // the page switch (default off)

  // What each plan grants. storage is filled from the license (the payment
  // service's settings), never assumed here.
  const TIERS = {
    room20: { id: 'room20', name: 'Admin rooms, up to 20 people', price: '$2', priceYear: '$20', adminRooms: true, roomLimit: PEOPLE_LIMIT, turnVideo: true, storage: false },
    unlimited: { id: 'unlimited', name: 'Admin rooms, unlimited people', price: '$5', priceYear: '$50', adminRooms: true, roomLimit: null, turnVideo: true, storage: false },
    streamer: { id: 'streamer', name: 'Streamer: unlimited admin rooms and storage', price: '$10', priceYear: '$100', adminRooms: true, roomLimit: null, turnVideo: true, storage: true },
  };
  const TIER_IDS = Object.keys(TIERS);
  const FREE = Object.freeze({ tier: null, subscribed: false, adminRooms: false, openRooms: true, roomLimit: null, turnAudio: true, turnVideo: false, storage: null, bypassLimit: false });

  const TEXT = {
    full: 'This meeting is full for people without a subscription. Any GifOS subscription lets you join.',
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
    if (!Object.prototype.hasOwnProperty.call(TIERS, o.tier)) return null;
    if (typeof o.buyerKey !== 'string' || !KEY_RE.test(o.buyerKey)) return null;
    if (typeof o.subId !== 'string' || !SUB_ID_RE.test(o.subId)) return null;
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
    return checkLicense(o, nowS);
  }

  // rightsOf(license or null) -> what this person may do. A null, broken or
  // run-out license is the free plan.
  function rightsOf(o, nowS) {
    const lic = o && checkLicense(o, nowS);
    if (!lic) return Object.assign({}, FREE);
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
      storage: st, bypassLimit: true, until: lic.exp,
    };
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
  // is {isAdmin, rights}. roomTier is the room admin's plan when known; an
  // unknown plan is held to the 20-person line (the strict reading).
  // -> {admit:true, why} | {admit:false, wait:true, why} | {admit:false, why, message}
  function roomLimitFor(roomTier) {
    if (roomTier && Object.prototype.hasOwnProperty.call(TIERS, roomTier)) return TIERS[roomTier].roomLimit;
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
    const limit = roomLimitFor(o.roomTier);
    if (limit != null && n >= limit) return { admit: false, why: 'full', limit, message: TEXT.full };
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
    if (!Object.prototype.hasOwnProperty.call(TIERS, o.tier)) return null;
    if (typeof o.buyerKey !== 'string' || !KEY_RE.test(o.buyerKey)) return null;
    if (typeof o.subId !== 'string' || !SUB_ID_RE.test(o.subId)) return null;
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
    return checkTicket(o, nowS, meeting);
  }
  // What a ticket grants in its meeting (same entitlements as the plan).
  function ticketRights(t) {
    if (!t || !TIERS[t.tier]) return Object.assign({}, FREE);
    const x = TIERS[t.tier];
    return { tier: x.id, subscribed: true, adminRooms: x.adminRooms, openRooms: true, roomLimit: x.roomLimit, turnAudio: true, turnVideo: x.turnVideo, storage: null, bypassLimit: true, until: t.exp };
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
  // room's meeting, and the ticket key's signature over the door's nonce.
  async function doorProofOk(shown, room, nonce, verifyPay, verifyKey, nowS) {
    if (!shown || typeof shown !== 'object') return null;
    const t = await verifyTicket(shown.ticket, verifyPay, nowS, await meetingTag(room));
    if (!t) return null;
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
    if (typeof c.subId !== 'string' || !SUB_ID_RE.test(c.subId)) return null;
    if (!Object.prototype.hasOwnProperty.call(TIERS, c.tier)) return null;
    if (typeof c.seed !== 'string' || !SEED_RE.test(c.seed)) return null;
    let raw; try { raw = b64ToBytes(c.seed); } catch (e) { return null; }
    if (raw.length !== 32) return null;
    return { v: 1, kind: CRED_KIND, subId: c.subId, tier: c.tier, period: c.period === 'yearly' ? 'yearly' : 'monthly', seed: c.seed, buyerKey: typeof c.buyerKey === 'string' && KEY_RE.test(c.buyerKey) ? c.buyerKey : undefined };
  }
  function credentialFiles(c) {
    const ok = credentialOk(c);
    if (!ok) throw new Error('not a subscription credential');
    const t = TIERS[ok.tier];
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
    checkLicense, verifyLicense, rightsOf, storageAfterLapse, proofMessage, verifyProof, askMessage, askFresh,
    roomLimitFor, admission, enabled, roomContext, doorContext, roomTierOf, doorVerdict, doorProofOk,
    TICKET_KIND, TICKET_S, RENEW_EVERY_S, meetingTag, checkTicket, verifyTicket, ticketRights,
    CRED_KIND, credentialOk, credentialFiles, credentialFromFiles,
  };
})(typeof window !== 'undefined' ? window : globalThis);
