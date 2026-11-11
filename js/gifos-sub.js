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
 * How the room's plan is known: the admin puts their license in the room's
 * signed admin orders, with a signature from their subscription key over
 * the room's name (roomOrderProof). Everyone at the door checks it
 * (roomTierOf); a missing, forged, expired or borrowed license reads as the
 * 20-person line. A person at the door who has a plan shows it the same way,
 * signing the door's fresh challenge (doorProof).
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
    room20: { id: 'room20', name: 'Admin rooms, up to 20 people', price: '$2', adminRooms: true, roomLimit: PEOPLE_LIMIT, turnVideo: true, storage: false },
    unlimited: { id: 'unlimited', name: 'Admin rooms, unlimited people', price: '$5', adminRooms: true, roomLimit: null, turnVideo: true, storage: false },
    streamer: { id: 'streamer', name: 'Streamer: unlimited admin rooms and storage', price: '$10', adminRooms: true, roomLimit: null, turnVideo: true, storage: true },
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
      retentionDays: Number(lic.storage.retentionDays) || 0,
      atCap: String(lic.storage.atCap || 'refuse-new'),
      warnAtPercent: Number(lic.storage.warnAtPercent) || 80,
    } : null;
    return {
      tier: t.id, subscribed: true, adminRooms: t.adminRooms, openRooms: true,
      roomLimit: t.roomLimit, turnAudio: true, turnVideo: t.turnVideo,
      storage: st, bypassLimit: true, until: lic.exp,
    };
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
  async function roomTierOf(order, room, verifyPay, verifyKey, nowS) {
    if (!order || typeof order !== 'object' || order.on === false) return null;
    if (!Number.isInteger(order.at)) return null;
    const lic = await verifyLicense(order.lic, verifyPay, nowS);
    if (!lic) return null;
    const ok = await verifyProof(lic, roomContext(room), 'at:' + order.at, order.proof, verifyKey);
    return ok ? lic.tier : null;
  }
  // doorVerdict: what a greeter does with a knocker it has no proof from.
  // -> 'let-in' (no limit applies, or the room has space, or the count is not
  // readable yet) | 'ask' (the room is at its line: the knocker must show a plan)
  function doorVerdict(o) {
    const v = admission({ adminRoom: o.adminRoom, roomTier: o.roomTier, listLength: o.count, hold: o.hold, entrant: { isAdmin: false, rights: FREE } });
    return v.admit || v.wait ? 'let-in' : 'ask';
  }
  // The knocker's answer to the door's challenge: their license, and their
  // key's signature over the door's nonce for this room.
  async function doorProofOk(shown, room, nonce, verifyPay, verifyKey, nowS) {
    if (!shown || typeof shown !== 'object') return null;
    const lic = await verifyLicense(shown.lic, verifyPay, nowS);
    if (!lic) return null;
    return (await verifyProof(lic, doorContext(room), nonce, shown.proof, verifyKey)) ? lic : null;
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
    checkLicense, verifyLicense, rightsOf, proofMessage, verifyProof, askMessage, askFresh,
    roomLimitFor, admission, enabled, roomContext, doorContext, roomTierOf, doorVerdict, doorProofOk,
  };
})(typeof window !== 'undefined' ? window : globalThis);
