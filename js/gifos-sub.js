/*
 * gifos-sub.js — the rules of GifOS subscriptions, one copy for every side.
 *
 * Plans (monthly, through PayPal):
 *   room20     $2   admin rooms of up to 20 people
 *   unlimited  $5   admin rooms with no people limit
 *   streamer   $10  unlimited admin rooms and a storage budget for
 *                   recordings and transcripts. Sold and managed ONLY in
 *                   the Broadcast app (Nathan 2026-11-13); the Meet app
 *                   never sells it or shows its files, but honors it with
 *                   everything Unlimited gives (APP_TIERS below).
 * Passes: what a pass grants is SIGNED INTO IT as permissions (PASS_PERMS
 * below: a plan, capture, one meeting at a time, past a full door) and a
 * window that may never end. Every check reads those permissions, never the
 * kind of pass; what is sold or minted is a preset of them (PASS_PRESETS):
 * the $1 four-hour pass (the Unlimited plan's meeting rights for four hours,
 * without capturing an open room) and the staff pass (no end, captures).
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
 * Everything here is pure, with the clock and the signature check passed in
 * (and the pass's length read from the timings table, GifOS.timings),
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
  // A paid subscription's id: PayPal's own (I-…), or the payment service's
  // id for one bought in the GifOS Meet app: G-… (Google Play, a hash of the
  // purchase token: storeSubId) or A-… (App Store, the original transaction
  // id). One license, ticket and one-meeting rule for all three.
  const SUB_ID_RE = /^(?:I-[A-Za-z0-9]{4,40}|G-[0-9a-f]{24}|A-[0-9]{6,24})$/;
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
  // Which app sells which plan (Nathan 2026-11-13): Meet sells Room 20 and
  // Unlimited only; the Broadcast app (the /cast skin of the meeting page)
  // sells every plan, Streamer and its storage included. Every plan is
  // HONORED everywhere: this is only what each app offers.
  const APP_TIERS = Object.freeze({ meet: Object.freeze(TIER_IDS.filter((t) => !TIERS[t].storage)), broadcast: Object.freeze(TIER_IDS.slice()) });
  const tiersSoldIn = (app) => APP_TIERS[app === 'broadcast' ? 'broadcast' : 'meet'];
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
  const FREE = Object.freeze({ tier: null, subscribed: false, adminRooms: false, openRooms: true, roomLimit: null, turnAudio: true, turnVideo: false, storage: null, bypassLimit: false, vouches: 0, capture: false });

  // ---- PERMISSIONS: what a meeting right grants (Nathan 2026-11-13) ------------
  // A pass carries its permissions signed inside it (perms), and a pass's
  // meeting ticket carries them on. A subscription's ticket reads as the
  // permissions of its plan (permsOfTier). Every check reads these words and
  // nothing else: the door (pastFull), the room's plan and the TURN vouch
  // (plan), open-room capture on the relay and on every page (capture), the
  // pay Worker's meeting record (oneMeeting). The vocabulary:
  //   plan        a paid plan id (TIERS): the size of the holder's admin
  //               rooms, TURN video and its vouch count
  //   capture     may take an open room as its admin (OPEN-ROOM CAPTURE)
  //   oneMeeting  true: one meeting at a time (the pay Worker keeps only the
  //               key's newest meeting); false: any number of meetings at once
  //   pastFull    let past any admin room's people line at the door
  // A word outside this list makes the whole set unreadable (refused): a
  // checker never guesses what an unknown permission grants.
  const PERM_WORDS = Object.freeze(['plan', 'capture', 'oneMeeting', 'pastFull']);
  const PERM_FLAGS = Object.freeze(['capture', 'oneMeeting', 'pastFull']);
  // permsOk(p) -> a clean copy of p, or null.
  function permsOk(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
    for (const k of Object.keys(p)) if (PERM_WORDS.indexOf(k) < 0) return null;
    if (!isPaid(p.plan)) return null;
    for (const k of PERM_FLAGS) if (typeof p[k] !== 'boolean') return null;
    return { plan: p.plan, capture: p.capture, oneMeeting: p.oneMeeting, pastFull: p.pastFull };
  }
  // A paid subscription's permissions: its plan; capture with no room limit
  // ($5, $10; never $2: a captured room keeps no door line); one meeting at a
  // time; past any full door. The free plan has none (null).
  function permsOfTier(tier) {
    if (!isPaid(tier)) return null;
    return { plan: tier, capture: TIERS[tier].roomLimit == null, oneMeeting: true, pastFull: true };
  }
  // What a set of permissions grants, in the rights shape (rightsOf).
  function permsRights(p, until) {
    const x = TIERS[p.plan];
    return { tier: x.id, subscribed: p.pastFull, adminRooms: x.adminRooms, openRooms: true, roomLimit: x.roomLimit, turnAudio: true, turnVideo: x.turnVideo, storage: null, bypassLimit: p.pastFull, until, vouches: x.vouches, capture: p.capture, oneMeeting: p.oneMeeting };
  }

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
      storage: st, bypassLimit: true, until: lic.exp, vouches: t.vouches, capture: permsOfTier(t.id).capture,
    };
  }
  function freeRights(until) {
    return { tier: 'free', subscribed: false, adminRooms: true, openRooms: true, roomLimit: FREE_LIMIT, turnAudio: true, turnVideo: false, storage: null, bypassLimit: false, until, vouches: 0, capture: false };
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
    return permsRights(t.perms ? t.perms : permsOfTier(t.tier), t.exp);
  }

  // The admin's room order: {ticket:{ticketJson,sig}, proof, at}. The ticket
  // must be current and for THIS room's meeting; proof signs
  // proofMessage(roomContext(room), 'at:' + at) with the ticket's key.
  // -> {tier, exp} or null.
  // The ticket may be a pass's meeting ticket (passTicket): the room then
  // reads the pass's plan (perms.plan) while that ticket lasts.
  async function roomTierOf(order, room, verifyPay, verifyKey, nowS) {
    if (!order || typeof order !== 'object' || order.on === false) return null;
    if (!Number.isInteger(order.at)) return null;
    const t = await meetingRight(order.ticket, verifyPay, nowS, await meetingTag(room));
    if (!t) return null;
    const ok = await verifyProof(t, roomContext(room), 'at:' + order.at, order.proof, verifyKey);
    if (!ok) return null;
    return t.pass ? { tier: t.tier, exp: t.exp, pass: true } : { tier: t.tier, exp: t.exp };
  }
  // ---- passes ----------------------------------------------------------------
  // A PASS is a receipt the payment service signs once: {v, kind, payeeId,
  // via, order, id, buyerKey, paid, start, end, plan, perms}. perms is what it
  // grants (PERMISSIONS above), end its last second, or null: it never ends.
  // paid is when it was paid (or minted); start is paid, or the end of a pass
  // the buyer already held (passes stack: passStart). plan repeats perms.plan
  // for readers older than permissions. Its signature is over
  // passMessage(passJson): a domain no other receipt, license or ticket is
  // signed in, so only the pass paths of the payment service (and the staff
  // minting script, with the same key) can make one.
  //
  // What we sell or mint is a PRESET of permissions and a length
  // (PASS_PRESETS). A new product is a new row there and a price: no check
  // anywhere changes. A pass signed before permissions existed (no perms)
  // is the $1 four-hour pass, exactly as it was sold (legacyPerms).
  //
  // ONE MEETING AT A TIME, when perms.oneMeeting (Nathan 2026-11-12:
  // "otherwise we've just created a very costly attack path"). The pass's
  // key and its passes ride in the provider GIF, so a copy of that file is the
  // whole credential. The pass itself is therefore never a meeting right:
  // joining a meeting shows the held passes to the payment service, which
  // keeps the pass key's newest meeting (one record per pass key, passRecId)
  // and signs a PASS MEETING TICKET for it (passTicket below), renewed like a
  // subscription's; joining another meeting moves it there and the older
  // meeting's ticket stops renewing, so that meeting loses the pass within
  // TICKET_S. Rooms, the door and the TURN Worker read only that ticket, and
  // the permissions it carries. Passes of one key and the same permissions
  // stack into one window (passChain).
  //
  // REVOCATION. A pass that never ends must be stoppable: every pass has its
  // own id, and the pay Worker, the relay and the TURN Worker each hold the
  // list of revoked pass ids (the secret GIFOS_PASS_REVOKED: ids split by
  // commas or spaces; a secret, so no deploy of the toml ever un-revokes).
  // The pay Worker then signs no ticket for it (join and renew), the TURN
  // Worker takes none, and the relay drops a capture held by it at the
  // room's next event. Pages honor the relay's word at once and a ticket's
  // own end within TICKET_S. docs/meet-security.md §PASS-PERMS.
  const PASS_KIND = 'gifos-pass4h';                // every pass's kind (named for the first one sold)
  const PASS_TAG = 'gifos-pass4h-receipt';
  // The four-hour pass's length: PASS_S in the timings table (js/timings.js,
  // loaded before this file on a page and imported by every Worker that
  // checks a pass). Without the table no four-hour pass checks out (fails closed).
  const passSeconds = () => { const t = GifOS.timings; return t && Number.isInteger(t.PASS_S) && t.PASS_S > 0 ? t.PASS_S : NaN; };
  // THE PRESETS: every pass we sell or mint. seconds: its length (a function
  // of the timings table), or null: it never ends. sold: offered to buyers.
  const PASS_PRESETS = Object.freeze({
    // $1, one PayPal order (or a store purchase): Unlimited for four hours,
    // one meeting at a time, past any full door, but never capturing an open
    // room (that stays with the $5 and $10 subscriptions).
    pass4h: Object.freeze({ perms: Object.freeze({ plan: 'unlimited', capture: false, oneMeeting: true, pastFull: true }), seconds: passSeconds, price: '$1', value: '1.00', sold: true }),
    // Ours, minted with the pay key for our own bots (scripts/mint-staff-pass.mjs):
    // Unlimited, captures an open room, never ends; one meeting at a time
    // (each bot holds its own pass, so sibling bots share a room freely).
    staff: Object.freeze({ perms: Object.freeze({ plan: 'unlimited', capture: true, oneMeeting: true, pastFull: true }), seconds: () => null, sold: false }),
  });
  // presetPass(name, start) -> {plan, perms, end} for a new pass of that preset.
  function presetPass(name, start) {
    const pr = Object.prototype.hasOwnProperty.call(PASS_PRESETS, name) ? PASS_PRESETS[name] : null;
    if (!pr) return null;
    const len = pr.seconds();
    if (len !== null && !(Number.isInteger(len) && len > 0)) return null;
    const perms = Object.assign({}, pr.perms);
    return { plan: perms.plan, perms, end: len === null ? null : start + len };
  }
  const legacyPerms = () => Object.assign({}, PASS_PRESETS.pass4h.perms);
  const PASS_PLAN = PASS_PRESETS.pass4h.perms.plan;   // the four-hour pass's plan (sold as "Unlimited")
  const PASS_PRICE = PASS_PRESETS.pass4h.price;
  const PASS_VALUE = PASS_PRESETS.pass4h.value;     // the PayPal order amount, USD
  const ORDER_ID_RE = /^[A-Z0-9]{10,40}$/;         // a PayPal order id, or a store order in the same shape (storeOrderId)
  // Where a pass came from: PayPal on the web, the store's own purchase sheet
  // in the GifOS Meet apps, or minted by us (mint). The pass is the same
  // receipt either way.
  const PASS_VIAS = ['paypal-order', 'play', 'appstore', 'mint'];
  const PASS_ID_RE = /^P4-[A-Z0-9]{10,40}$/;
  const passMessage = (passJson) => PASS_TAG + '\x00' + String(passJson);
  // passEnd(o): the pass's last second as a number (Infinity: never ends).
  const passEnd = (o) => (o && o.end === null ? Infinity : o ? o.end : 0);
  // checkPass(o) -> a clean copy of o, its perms read, or null: the shape alone (no clock).
  // The copy's end is a number: Infinity for a pass that never ends.
  function checkPass(o) {
    if (!o || typeof o !== 'object') return null;
    if (o.v !== 1 || o.kind !== PASS_KIND || o.payeeId !== SELLER || PASS_VIAS.indexOf(o.via) < 0) return null;
    if (typeof o.order !== 'string' || !ORDER_ID_RE.test(o.order) || o.id !== 'P4-' + o.order || !PASS_ID_RE.test(o.id)) return null;
    if (typeof o.buyerKey !== 'string' || !KEY_RE.test(o.buyerKey)) return null;
    if (!intS(o.paid) || !intS(o.start) || o.start < o.paid) return null;
    const legacy = o.perms === undefined;
    const perms = legacy ? legacyPerms() : permsOk(o.perms);
    if (!perms || o.plan !== perms.plan) return null;
    if (o.end === null) { if (legacy) return null; }
    else if (!intS(o.end) || o.end <= o.start || (legacy && o.end - o.start !== passSeconds())) return null;
    return Object.assign({}, o, { perms, end: passEnd(o) });
  }
  // passLive(o, nowS): the pass's window holds now (a start a little ahead
  // of this clock, within ASK_WINDOW_S as for any signed time, counts).
  const passLive = (o, nowS) => !!o && o.start <= nowS + ASK_WINDOW_S && nowS < passEnd(o);
  // verifyPass({passJson, sig}, verify, nowS?) -> the pass (checkPass's copy) or null. With
  // nowS it must also be live now; without, any well-signed pass (stacking
  // and the credentials view read passes not started yet, or run out).
  async function verifyPass(p, verify, nowS) {
    if (!p || typeof p.passJson !== 'string' || typeof p.sig !== 'string' || p.passJson.length > 1024) return null;
    let sigBytes; try { sigBytes = b64ToBytes(p.sig); } catch (e) { return null; }
    if (sigBytes.length !== 64) return null;
    let ok = false;
    try { ok = !!(await verify(sigBytes, utf8(passMessage(p.passJson)))); } catch (e) { ok = false; }
    if (!ok) return null;
    let o; try { o = JSON.parse(p.passJson); } catch (e) { return null; }
    o = checkPass(o);
    if (!o) return null;
    if (nowS != null && !passLive(o, nowS)) return null;
    return o;
  }
  // PASSES STACK (Nathan 2026-11-12): a pass bought while others are held
  // starts when the latest of them ends, so no time is lost. held: the
  // buyer's own passes, already verified (same key), each paid BEFORE this
  // one (a pass paid later can never move an earlier one, so asking again
  // for one order never yields a second window). A pass that never ends is
  // nothing to queue behind. -> the new pass's start.
  function passStart(paidS, held, buyerKey) {
    let start = paidS;
    for (const h of held || []) {
      if (!h || h.buyerKey !== buyerKey || !(h.paid < paidS) || !Number.isFinite(passEnd(h))) continue;
      if (h.end > start) start = h.end;
    }
    return start;
  }
  // What a live pass grants, as a ticket would: its permissions.
  function passRights(o) {
    return Object.assign(permsRights(permsOk(o && o.perms) || legacyPerms(), passEnd(o)), { pass: true });
  }
  // ---- the pass's meeting ticket ------------------------------------------------
  // passRecId(buyerKey) -> 'K-' + 24 hex: the payment service's one record
  // for a pass key (its newest meeting). Every pass of that key, stacked or
  // copied, shares it.
  const PASS_TICKET_KIND = 'gifos-pass-ticket';
  const PASS_TICKET_TAG = 'gifos-pass-ticket';
  const PASS_REC_RE = /^K-[0-9a-f]{24}$/;
  async function passRecId(buyerKey) {
    const d = new Uint8Array(await root.crypto.subtle.digest('SHA-256', utf8('gifos-pass-key:' + String(buyerKey))));
    let h = ''; for (let i = 0; i < 12; i++) h += d[i].toString(16).padStart(2, '0');
    return 'K-' + h;
  }
  // Signed over its own domain (never the bare JSON a receipt, license or
  // subscription ticket is signed over), so nothing else verifies as one.
  const passTicketMessage = (ticketJson) => PASS_TICKET_TAG + '\x00' + String(ticketJson);
  const permsKey = (p) => PERM_WORDS.map((k) => String(p[k])).join('|');
  // passChain(passes, nowS) -> {live, until} or null. passes: verified
  // passes of ONE key. The live one (the most it grants, then the latest
  // end), and the window it opens: every pass of the same permissions that
  // starts by the time the window ends carries it on (stacking). A pass
  // granting something else takes over at a new join. until: Infinity when
  // the window never ends.
  function passChain(passes, nowS) {
    const list = (passes || []).filter(Boolean).slice().sort((a, b) => a.start - b.start);
    const better = (a, b) => (rank(passRights(b)) - rank(passRights(a))) || (passEnd(b) > passEnd(a) ? 1 : passEnd(b) < passEnd(a) ? -1 : 0);
    const live = list.filter((o) => passLive(o, nowS)).sort(better)[0];
    if (!live) return null;
    const k = permsKey(live.perms);
    let until = passEnd(live);
    for (const o of list) if (o.buyerKey === live.buyerKey && permsKey(o.perms) === k && o.start <= until && passEnd(o) > until) until = passEnd(o);
    return { live, until };
  }
  // checkPassTicket(o, nowS, meeting) -> o or null: {v, kind, payeeId, plan,
  // perms, pid (the pass's id), buyerKey (the pass key), subId (passRecId of
  // it), meeting, gen, issued, exp}. A ticket signed before permissions (no
  // perms) is the four-hour pass's.
  function checkPassTicket(o, nowS, meeting) {
    if (!o || typeof o !== 'object') return null;
    if (o.v !== 1 || o.kind !== PASS_TICKET_KIND || o.payeeId !== SELLER) return null;
    const perms = o.perms === undefined ? legacyPerms() : permsOk(o.perms);
    if (!perms || o.plan !== perms.plan) return null;
    if (o.pid !== undefined && (typeof o.pid !== 'string' || !PASS_ID_RE.test(o.pid))) return null;
    if (typeof o.buyerKey !== 'string' || !KEY_RE.test(o.buyerKey)) return null;
    if (typeof o.subId !== 'string' || !PASS_REC_RE.test(o.subId)) return null;
    if (typeof o.meeting !== 'string' || !MEETING_RE.test(o.meeting)) return null;
    if (meeting != null && o.meeting !== meeting) return null;
    if (!intS(o.gen) || o.gen < 1 || !intS(o.issued) || !intS(o.exp)) return null;
    if (o.exp <= o.issued || o.exp - o.issued > TICKET_S + 60) return null;
    if (!(nowS < o.exp) || o.issued > nowS + ASK_WINDOW_S) return null;
    return Object.assign({}, o, { perms });
  }
  // verifyPassTicket({ticketJson, sig}, verify, nowS, meeting) -> the ticket or null.
  async function verifyPassTicket(t, verify, nowS, meeting) {
    if (!t || typeof t.ticketJson !== 'string' || typeof t.sig !== 'string' || t.ticketJson.length > 2048) return null;
    let sigBytes; try { sigBytes = b64ToBytes(t.sig); } catch (e) { return null; }
    if (sigBytes.length !== 64) return null;
    let ok = false;
    try { ok = !!(await verify(sigBytes, utf8(passTicketMessage(t.ticketJson)))); } catch (e) { ok = false; }
    if (!ok) return null;
    let o; try { o = JSON.parse(t.ticketJson); } catch (e) { return null; }
    o = checkPassTicket(o, nowS, meeting);
    if (o && o.subId !== (await passRecId(o.buyerKey))) return null;
    return o;
  }
  // The permissions a pass ticket says it carries, unchecked (a page reading
  // its OWN ticket, fresh from the payment service), or null.
  function passTicketPerms(ticketJson) {
    let o; try { o = JSON.parse(String(ticketJson)); } catch (e) { return null; }
    if (!o || o.kind !== PASS_TICKET_KIND) return null;
    return o.perms === undefined ? legacyPerms() : permsOk(o.perms);
  }
  // A pass ticket as a meeting right: the shape the door, the room's plan and
  // the TURN Worker read from a ticket. subId (the pass key's record) keys
  // the TURN Worker's per-customer count: stacked passes count as one.
  const passTicketAsTicket = (o) => ({ tier: o.perms.plan, buyerKey: o.buyerKey, subId: o.subId, meeting: o.meeting, gen: o.gen, exp: o.exp, pass: true, pid: o.pid || null, perms: o.perms });
  const isPassTicket = (r) => { if (!r || typeof r.ticketJson !== 'string') return false; try { return JSON.parse(r.ticketJson).kind === PASS_TICKET_KIND; } catch (e) { return false; } };
  // A meeting right carried where a ticket rides (room order, door answer,
  // TURN ask, capture): a subscription's ticket for this meeting, or a pass's
  // meeting ticket for it, each with the permissions it grants (perms; null
  // for the free plan). A bare pass is NOT one: it names no meeting.
  // -> ticket-shaped or null.
  async function meetingRight(r, verify, nowS, meeting) {
    if (!r || typeof r !== 'object' || typeof r.passJson === 'string') return null;
    if (isPassTicket(r)) { const o = await verifyPassTicket(r, verify, nowS, meeting); return o ? passTicketAsTicket(o) : null; }
    const t = await verifyTicket(r, verify, nowS, meeting);
    return t ? Object.assign({}, t, { perms: permsOfTier(t.tier) }) : null;
  }
  // REVOKED PASSES: revokedSet(text) -> a Set of pass ids from the secret's
  // text (commas or spaces between ids; anything else is ignored).
  function revokedSet(text) {
    const out = new Set();
    for (const w of String(text || '').split(/[\s,]+/)) if (PASS_ID_RE.test(w)) out.add(w);
    return out;
  }
  // A meeting right that a revoked pass stands behind (only passes are revoked here).
  const rightRevoked = (t, revoked) => !!(t && t.pid && revoked && revoked.has(t.pid));
  // captureRight(tk, verify, nowS, meeting, revoked?) -> the meeting right that
  // may take this open room, or null: a current right for THIS meeting whose
  // permissions say capture, from no revoked pass. The relay and every page
  // read it the same way.
  async function captureRight(tk, verify, nowS, meeting, revoked) {
    const t = await meetingRight(tk, verify, nowS, meeting);
    return t && t.perms && t.perms.capture && !rightRevoked(t, revoked) ? t : null;
  }
  // bestRights(list) -> the best of several rights held at once (a
  // subscription's, a pass's): the larger room wins, then the larger vouch
  // count, then capture. A $2 subscriber holding a pass reads Unlimited
  // for the pass's window, then Room 20 again.
  function rank(r) {
    if (!r || !r.tier) return 0;
    const room = r.roomLimit == null ? 1e6 : r.roomLimit;
    return room * 1000 + (r.vouches || 0) * 2 + (r.capture ? 1 : 0);
  }
  function bestRights(list) {
    let best = null;
    for (const r of list || []) if (r && r.tier && (!best || rank(r) > rank(best))) best = r;
    return best || Object.assign({}, FREE);
  }

  // doorVerdict: what a greeter does with a knocker it has no proof from.
  // -> 'let-in' (no limit applies, or the room has space, or the count is not
  // readable yet) | 'ask' (the room is at its line: the knocker must show a plan)
  function doorVerdict(o) {
    const v = admission({ adminRoom: o.adminRoom, roomTier: o.roomTier, listLength: o.count, hold: o.hold, entrant: { isAdmin: false, rights: FREE } });
    return v.admit || v.wait ? 'let-in' : 'ask';
  }
  // The knocker's answer to the door's challenge: a current meeting right for
  // THIS room's meeting whose permissions say pastFull (every paid plan; a
  // free ticket is no way past a line; a pass as its perms say), and the
  // ticket key's signature over the door's nonce.
  async function doorProofOk(shown, room, nonce, verifyPay, verifyKey, nowS) {
    if (!shown || typeof shown !== 'object') return null;
    const t = await meetingRight(shown.ticket, verifyPay, nowS, await meetingTag(room));
    if (!t || !t.perms || !t.perms.pastFull) return null;
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
  // The four-hour passes live in the same file, beside any subscription
  // (passes.json): the seed of the key they are bound to and the signed
  // passes. One key holds every pass, so a new pass can stack on the others.
  const WALLET_KIND = 'gifos-pass-wallet';
  function walletOk(w) {
    if (!w || typeof w !== 'object' || w.v !== 1 || w.kind !== WALLET_KIND) return null;
    if (typeof w.seed !== 'string' || !SEED_RE.test(w.seed)) return null;
    let raw; try { raw = b64ToBytes(w.seed); } catch (e) { return null; }
    if (raw.length !== 32) return null;
    const passes = (Array.isArray(w.passes) ? w.passes : []).filter((p) => p && typeof p.passJson === 'string' && typeof p.sig === 'string' && p.passJson.length <= 1024 && p.sig.length <= 100).slice(-64)
      .map((p) => ({ passJson: p.passJson, sig: p.sig }));
    const pending = typeof w.pending === 'string' && ORDER_ID_RE.test(w.pending) ? w.pending : undefined;
    return { v: 1, kind: WALLET_KIND, seed: w.seed, buyerKey: typeof w.buyerKey === 'string' && KEY_RE.test(w.buyerKey) ? w.buyerKey : undefined, passes, pending };
  }
  // credentialFiles(c, wallet): either may be missing, not both.
  function credentialFiles(c, wallet) {
    const ok = c ? credentialOk(c) : null;
    const w = wallet ? walletOk(wallet) : null;
    if (!ok && !w) throw new Error('not a subscription credential');
    if (c && !ok) throw new Error('not a subscription credential');
    const t = ok ? PLANS[ok.tier] : null;
    const files = {
      'manifest.json': JSON.stringify({
        gifos: '1.0', appId: 'gifos-subscription', name: 'GifOS subscription', entry: 'index.html',
        provides: { meet: w ? ['subscription', 'pass4h'] : ['subscription'] },     // a Provider: active only in the Providers folder
        accent: [120, 200, 255],
      }),
      'index.html': '<!doctype html><meta charset="utf-8"><title>GifOS subscription</title>' +
        '<body style="font:15px/1.5 system-ui;padding:1.2rem"><h2>GifOS subscription</h2><p>' + (t ? t.name + '.' : '') + (w ? ' Four-hour passes: ' + w.passes.length + '.' : '') + '</p>' +
        '<p>Keep this file in the Providers folder on your Home Screen, or open it in a meeting\u2019s Settings on another browser. ' +
        'A subscription works in one meeting at a time: joining a meeting moves it there.</p><p>Anyone with this file can use your subscription and passes. Keep it private.</p>',
    };
    if (ok) files['subscription.json'] = JSON.stringify(ok);
    if (w) files['passes.json'] = JSON.stringify(w);
    return files;
  }
  function filesManifest(files) {
    const text = (v) => (v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v || ''));
    let m; try { m = JSON.parse(text(files['manifest.json'])); } catch (e) { return null; }
    if (!m || m.appId !== 'gifos-subscription' || !m.provides || !Array.isArray(m.provides.meet) || m.provides.meet.indexOf('subscription') < 0) return null;
    return text;
  }
  function credentialFromFiles(files) {
    if (!files) return null;
    const text = filesManifest(files);
    if (!text) return null;
    let c; try { c = JSON.parse(text(files['subscription.json'])); } catch (e) { return null; }
    return credentialOk(c);
  }
  function walletFromFiles(files) {
    if (!files) return null;
    const text = filesManifest(files);
    if (!text) return null;
    let w; try { w = JSON.parse(text(files['passes.json'])); } catch (e) { return null; }
    return walletOk(w);
  }

  // ---- bought in the GifOS Meet apps (Google Play, App Store) --------------------
  // The same plans and the same pass, sold through the store's own purchase
  // sheet; the payment service checks each purchase with the store and then
  // signs exactly what it signs for PayPal. The products are DATA
  // (gifos-store-skus.js, loaded before this file where store purchases are
  // read); without the table no store product checks out.
  const STORE_IDS = ['play', 'appstore'];
  const skus = (store) => { const t = GifOS.storeSkus; return t && STORE_IDS.indexOf(store) >= 0 && t[store] ? t[store] : null; };
  // storeProduct(store, productId, basePlanId?) -> {what:'sub', tier, period} |
  // {what:'pass'} | {what:'tip', cents} | null: what a store product IS. A
  // product that is none of ours reads as null and is never honored.
  function storeProduct(store, productId, basePlanId) {
    const k = skus(store);
    productId = String(productId || '');
    if (!k || !productId) return null;
    if (productId === k.pass) return { what: 'pass' };
    for (const c of Object.keys(k.tips || {})) if (k.tips[c] === productId) return { what: 'tip', cents: Number(c) };
    for (const t of TIER_IDS) {
      const row = (k.subs || {})[t];
      if (!row) continue;
      if (store === 'play') { if (row.product === productId) return (basePlanId === 'monthly' || basePlanId === 'yearly') && row[basePlanId] === basePlanId ? { what: 'sub', tier: t, period: basePlanId } : null; }
      else for (const per of ['monthly', 'yearly']) if (row[per] === productId) return { what: 'sub', tier: t, period: per };
    }
    return null;
  }
  // storeSku(store, {what, tier, period, cents}) -> {product, basePlan?} | null: the reverse.
  function storeSku(store, want) {
    const k = skus(store);
    if (!k || !want) return null;
    if (want.what === 'pass') return k.pass ? { product: k.pass } : null;
    if (want.what === 'tip') { const p = (k.tips || {})[String(want.cents)]; return p ? { product: p } : null; }
    if (want.what === 'sub') {
      const row = (k.subs || {})[want.tier]; const per = want.period === 'yearly' ? 'yearly' : 'monthly';
      if (!row || !isPaid(want.tier) || !row[per]) return null;
      return store === 'play' ? { product: row.product, basePlan: row[per] } : { product: row[per] };
    }
    return null;
  }
  // A TIP is whole dollars, at most tipMaxCents, made of the tip products:
  // tipPlan(store, cents) -> {ok, cents, purchases:[{product, cents, quantity}], why?}.
  // Greedy from the largest price point; one purchase holds one product, up
  // to tipMaxQuantity of it. More than one purchase is more than one store
  // sheet, so tipOneSheet(store, cents) gives the largest tip not above cents
  // that ONE sheet covers: what the apps offer.
  function tipPlan(store, cents) {
    const k = skus(store); const max = GifOS.storeSkus && GifOS.storeSkus.tipMaxCents;
    if (!k || !k.tips) return { ok: false, why: 'no-table', cents: 0, purchases: [] };
    if (!intS(cents) || cents <= 0 || cents % 100 !== 0) return { ok: false, why: 'whole-dollars', cents: 0, purchases: [] };
    if (!intS(max) || cents > max) return { ok: false, why: 'over-max', cents: 0, purchases: [], max: max };
    const q = intS(k.tipMaxQuantity) && k.tipMaxQuantity > 0 ? k.tipMaxQuantity : 1;
    const points = Object.keys(k.tips).map(Number).filter((c) => intS(c) && c > 0).sort((a, b) => b - a);
    const purchases = []; let left = cents;
    for (const c of points) {
      let n = Math.floor(left / c);
      while (n > 0) { const take = Math.min(n, q); purchases.push({ product: k.tips[String(c)], cents: c, quantity: take }); n -= take; left -= take * c; }
    }
    if (left !== 0) return { ok: false, why: 'no-products', cents: 0, purchases: [] };
    return { ok: true, cents, purchases };
  }
  // tipSingle(store, cents) -> {product, cents, quantity} | null: the tip as
  // ONE purchase (one product, a quantity within the cap), the largest price
  // point first. $25 where the cap is 10 is 5 x $5 even though the greedy
  // plan would be $20 + $5.
  function tipSingle(store, cents) {
    const k = skus(store); const max = GifOS.storeSkus && GifOS.storeSkus.tipMaxCents;
    if (!k || !k.tips || !intS(cents) || cents <= 0 || cents % 100 !== 0 || !intS(max) || cents > max) return null;
    const q = intS(k.tipMaxQuantity) && k.tipMaxQuantity > 0 ? k.tipMaxQuantity : 1;
    const points = Object.keys(k.tips).map(Number).filter((c) => intS(c) && c > 0).sort((a, b) => b - a);
    for (const c of points) if (cents % c === 0 && cents / c <= q) return { product: k.tips[String(c)], cents: c, quantity: cents / c };
    return null;
  }
  function tipOneSheet(store, cents) {
    const max = GifOS.storeSkus && GifOS.storeSkus.tipMaxCents;
    if (!intS(cents) || !intS(max)) return 0;
    for (let c = Math.min(cents - (cents % 100), max); c > 0; c -= 100) if (tipSingle(store, c)) return c;
    return 0;
  }
  const hexOf = async (text, n) => {
    const d = new Uint8Array(await root.crypto.subtle.digest('SHA-256', utf8(text)));
    let h = ''; for (let i = 0; i < n; i++) h += d[i].toString(16).padStart(2, '0');
    return h;
  };
  // storeSubId('play', purchaseToken) -> 'G-' + 24 hex; storeSubId('appstore',
  // originalTransactionId) -> 'A-' + that id. The id a license and ticket name.
  async function storeSubId(store, ref) {
    if (store === 'play') return typeof ref === 'string' && ref.length >= 16 && ref.length <= 2048 ? 'G-' + (await hexOf('gifos-play-sub:' + ref, 12)) : null;
    if (store === 'appstore') return /^[0-9]{6,24}$/.test(String(ref)) ? 'A-' + String(ref) : null;
    return null;
  }
  // storeOrderId(store, ref) -> a pass's `order` in PayPal's shape: Google's
  // order id (GPA.1234-…) with its punctuation dropped, or 'APPLE' + the
  // transaction id. One purchase, one order, one pass.
  function storeOrderId(store, ref) {
    const s = String(ref || '');
    const o = store === 'play' ? s.toUpperCase().replace(/[^A-Z0-9]/g, '') : store === 'appstore' && /^[0-9]{1,30}$/.test(s) ? 'APPLE' + s.padStart(8, '0') : '';
    return (store === 'play' ? /^GPA[0-9]{7,37}$/.test(o) : true) && ORDER_ID_RE.test(o) ? o : null;
  }
  // The App Store ties a purchase to its buyer with a UUID (appAccountToken);
  // Google takes the key itself. accountUuid(buyerKey) is that UUID: the
  // first 16 bytes of a hash of the key, so the payment service can check
  // that the transaction was bought for the key that asks.
  async function accountUuid(buyerKey) {
    const h = await hexOf('gifos-store-account:' + String(buyerKey), 16);
    return (h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-8' + h.slice(17, 20) + '-' + h.slice(20, 32)).toLowerCase();
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
    TIERS, TIER_IDS, APP_TIERS, tiersSoldIn, FREE, TEXT, PEOPLE_LIMIT, LICENSE_KIND, SELLER, KEY_RE, SUB_ID_RE, ASK_WINDOW_S, FLAG_KEY,
    FREE_PLAN, FREE_LIMIT, FREE_ID_RE, PLANS, PLAN_IDS, isPlan, isPaid, freeIdFor, freeRights,
    checkLicense, verifyLicense, rightsOf, storageAfterLapse, proofMessage, verifyProof, askMessage, askFresh,
    roomLimitFor, admission, enabled, roomContext, doorContext, roomTierOf, doorVerdict, doorProofOk,
    TICKET_KIND, TICKET_S, RENEW_EVERY_S, meetingTag, checkTicket, verifyTicket, ticketRights,
    PASS_KIND, passSeconds, PASS_PLAN, PASS_PRICE, PASS_VALUE, ORDER_ID_RE, PASS_ID_RE, passMessage, checkPass, passLive, passEnd, verifyPass,
    passStart, passRights, meetingRight, bestRights,
    PERM_WORDS, permsOk, permsOfTier, permsRights, PASS_PRESETS, presetPass, revokedSet, rightRevoked, captureRight,
    PASS_TICKET_KIND, PASS_REC_RE, passRecId, passTicketMessage, passChain, checkPassTicket, verifyPassTicket, isPassTicket, passTicketPerms,
    WALLET_KIND, walletOk,
    CRED_KIND, credentialOk, credentialFiles, credentialFromFiles, walletFromFiles,
    PASS_VIAS, STORE_IDS, storeProduct, storeSku, tipPlan, tipSingle, tipOneSheet, storeSubId, storeOrderId, accountUuid,
  };
})(typeof window !== 'undefined' ? window : globalThis);
