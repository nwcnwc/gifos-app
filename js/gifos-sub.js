/*
 * gifos-sub.js — the rules of GifOS subscriptions, one copy for every side.
 *
 * Plans (through PayPal; the catalog, TIERS below, is the ONE table of names and prices):
 *   room20     $2/mo  admin rooms of up to 20 people
 *   unlimited  $5/mo  admin rooms with no people limit
 *   streamer   $10/mo unlimited admin rooms and a storage budget for
 *                   recordings and transcripts. Sold and managed ONLY in
 *                   the Broadcast app (Nathan 2026-11-13); the Meet app
 *                   never sells it or shows its files, but honors it with
 *                   everything Unlimited gives (APP_TIERS below).
 *   family $19.90/mo or $199/yr, smallBusiness $34.90/mo or $349/yr,
 *   business $2,999/yr, largeBusiness $24,999/yr, enterprise $199,000/yr
 *                   billed as 12 monthly payments of $16,583.33: Unlimited's
 *                   meeting rights in up to 5 / 10 / 100 / 1,000 / 10,000
 *                   meetings at once (Nathan 2026-11-22); more than 10,000:
 *                   negotiated (NEGOTIATED). Add-on (stacks): the hosted bot
 *                   (ADDONS, coming soon).
 * Every license, meeting ticket and pass carries its LINE ITEMS (grants:
 * room line, past a full door, open-room capture, TURN video links, storage,
 * how many meetings at once), signed by the payment service, and its own end.
 * Every check reads those line items, never the name of a plan or pass; a
 * product is only a preset of them (TIERS[..].grants, PASS_PRESETS);
 * without one, everyone has the DEFAULTS (free is no plan at all), read where it is sold. Passes have a window that may never
 * end; what is sold or minted (PASS_PRESETS):
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
 * WHO DECIDES: the meeting service, alone. It keeps one list of permissions
 * per hosted meeting (the room ACL below) and refuses a joiner on the joining
 * connection itself. No page holds a people line, a count or a refusal: a page
 * shows the service the right it holds and shows the answer it gets back.
 *
 * How many meetings at once (the `meetings` line item; 1 unless a plan says
 * more): joining a meeting gets a short meeting ticket from the payment
 * service, renewed every couple of minutes while that meeting is among the
 * key's `meetings` newest; joining one more drops the oldest joined.
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
  const NONCE_RE = /^[A-Za-z0-9+/=_.:-]{8,128}$/;
  const PEOPLE_LIMIT = 20;                         // the room20 plan's room size
  const FREE_LIMIT = 5;                            // the free plan's admin room size
  const ASK_WINDOW_S = 300;                        // a signed request is good this long

  // What each PAID plan grants. storage is filled from the license (the
  // payment service's settings), never assumed here. vouches: the TURN video
  // links one subscriber present vouches for per slot (turn/worker paid.js;
  // Nathan 2026-11-11: 3 / 6 / 20).
  // The catalog (sales and display). Each row's `grants` is its PRESET: the line items the payment service signs into
  // a license, ticket or pass when it is sold (LINE ITEMS below). Nothing that decides reads a row: verifiers read the
  // signed line items only.
  // agentHost is written only when granted (a set that does not name it reads as 0).
  // overflow is written only when 'keep' (a set that does not name it reads as 'ask').
  const g = (roomLimit, admitAtFullDoor, captureOpenRoom, turnVideoLinks, storage, meetings, agentHost, overflow) => Object.freeze(Object.assign({ roomLimit, admitAtFullDoor, captureOpenRoom, turnVideoLinks, storage, meetings: meetings || 1 }, agentHost ? { agentHost } : {}, overflow === 'keep' ? { overflow } : {}));
  // Money for display, from whole cents: 1990 -> "$19.90", 19900 -> "$199", 299900 -> "$2,999".
  const usd = (c) => '$' + (c % 100 ? (c / 100).toFixed(2) : String(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // THE BILLING PERIODS: monthly, yearly, and monthly12 (an annual subscription billed as 12 monthly payments, so no
  // payment passes PayPal's per-payment cap). days: the length one payment covers (the upgrade credit's period).
  // annual: an annual commitment (a yearly plan moves only to another annual one).
  const PERIODS = Object.freeze({ monthly: Object.freeze({ days: 30, annual: false }), yearly: Object.freeze({ days: 365, annual: true }), monthly12: Object.freeze({ days: 30, annual: true }) });
  // THE CATALOG: the ONE table of plans (Nathan 2026-11-22: a year costs 10 months; Room 20 is the cheap way in).
  // cents: what one payment costs, per billing period sold (the first period named is the one GIFOS_SUBSCRIPTIONS must
  // have); the display prices below are made from it, so a price changes here and nowhere else (and at PayPal, by
  // making a plan of the same price). window: listed in the Subscribe window (Settings); /subscription lists every row.
  // meetings: how many meetings at once (display; the preset's `meetings` line item decides).
  function tier(id, name, cents, window, grants) {
    const periods = Object.keys(cents);
    const r = { id, name, cents: Object.freeze(Object.assign({}, cents)), periods: Object.freeze(periods), window, meetings: grants.meetings,
      price: cents.monthly ? usd(cents.monthly) : cents.monthly12 ? usd(cents.monthly12) : null,
      priceYear: cents.yearly ? usd(cents.yearly) : cents.monthly12 ? usd(Math.round(cents.monthly12 * 12 / 100) * 100) : null,
      adminRooms: true, roomLimit: grants.roomLimit, turnVideo: grants.turnVideoLinks > 0, storage: grants.storage, vouches: grants.turnVideoLinks, paid: true, grants };
    return Object.freeze(r);
  }
  // The meeting-count plans: Unlimited's meeting rights ("unlimited hosting") in N meetings at once. Vouches stay
  // Unlimited's 6: the vouch is per meeting, so N meetings already vouch N times over. overflow: Family business asks
  // (personal and family scale); the organization plans keep (nobody pulls the plan from a colleague's meeting).
  const many = (n, overflow) => g(null, true, true, 6, false, n, 0, overflow);
  const TIERS = {
    room20: tier('room20', 'Private meetings, up to 20 people', { monthly: 200, yearly: 2000 }, true, g(PEOPLE_LIMIT, true, false, 3, false, 1)),
    unlimited: tier('unlimited', 'Private meetings, unlimited people', { monthly: 500, yearly: 5000 }, true, g(null, true, true, 6, false, 1)),
    streamer: tier('streamer', 'Streamer: unlimited private meetings and storage', { monthly: 1000, yearly: 10000 }, true, g(null, true, true, 20, true, 1)),
    family: tier('family', 'Family business: up to 5 meetings at once', { monthly: 1990, yearly: 19900 }, true, many(5)),
    smallBusiness: tier('smallBusiness', 'Small business: up to 10 meetings at once', { monthly: 3490, yearly: 34900 }, false, many(10, 'keep')),
    business: tier('business', 'Business: up to 100 meetings at once', { yearly: 299900 }, false, many(100, 'keep')),
    largeBusiness: tier('largeBusiness', 'Large business: up to 1,000 meetings at once', { yearly: 2499900 }, false, many(1000, 'keep')),
    enterprise: tier('enterprise', 'Enterprise: up to 10,000 meetings at once', { monthly12: 1658333 }, false, many(10000, 'keep')),
  };
  const TIER_IDS = Object.keys(TIERS);              // every plan, every one a PayPal subscription
  // More than the largest plan: no row, no preset; a contract.
  const NEGOTIATED = Object.freeze({ id: 'negotiated', name: 'Negotiated: more than 10,000 meetings at once', meetingsOver: 10000, contact: 'support@gifos.app' });
  // ADD-ONS stack with any plan (their line items add). soon: shown, not sold yet. The hosted bot: one hosted bot
  // session (agentHost 1; the 0.9.29 hosted bot work).
  const ADDONS = Object.freeze({ hostedBot: Object.freeze({ id: 'hostedBot', name: 'Hosted bot', cents: Object.freeze({ monthly: 300 }), price: usd(300), soon: true, grants: Object.freeze({ agentHost: 1 }) }) });
  // Which app sells which plan (Nathan 2026-11-13): Meet sells every plan but Streamer; the Broadcast app (the /cast
  // skin of the meeting page) sells every plan, Streamer and its storage included. Every plan is HONORED everywhere:
  // this is only what each app offers. tiersListed: the part of it the Subscribe window lists (the rest is on
  // /subscription).
  const APP_TIERS = Object.freeze({ meet: Object.freeze(TIER_IDS.filter((t) => !TIERS[t].storage)), broadcast: Object.freeze(TIER_IDS.slice()) });
  const tiersSoldIn = (app) => APP_TIERS[app === 'broadcast' ? 'broadcast' : 'meet'];
  const tiersListed = (app) => tiersSoldIn(app).filter((t) => TIERS[t].window);
  // covers(h, a): line items h give at least everything line items a give (no people line beats any line).
  const big = (v) => (v === null ? Infinity : v);
  function covers(h, a) {
    if (!a) return true;
    if (!h) return false;
    return big(h.roomLimit) >= big(a.roomLimit) && h.turnVideoLinks >= a.turnVideoLinks && (h.meetings || 1) >= (a.meetings || 1)
      && (h.admitAtFullDoor || !a.admitAtFullDoor) && (h.captureOpenRoom || !a.captureOpenRoom) && (h.storage || !a.storage)
      && (h.clearWithoutPassword === true || a.clearWithoutPassword !== true)
      && (h.clearWithoutPassword === true || h.clearStageWithoutPassword === true || a.clearStageWithoutPassword !== true);
  }
  // UPGRADES (Nathan 2026-11-22). upgradeOk({tier, period}, {tier, period}): the move is an upgrade: the new plan gives
  // at least everything the old one gives, it is not the same plan and period, and an annual plan (yearly, or
  // Enterprise's monthly12) moves only to an annual one; a monthly plan moves to monthly or annual.
  function upgradeOk(from, to) {
    const f = from && TIERS[from.tier], t = to && TIERS[to.tier];
    if (!f || !t || !PERIODS[from.period] || !PERIODS[to.period] || f.periods.indexOf(from.period) < 0 || t.periods.indexOf(to.period) < 0) return false;
    if (from.tier === to.tier && from.period === to.period) return false;
    if (PERIODS[from.period].annual && !PERIODS[to.period].annual) return false;
    return covers(t.grants, f.grants);
  }
  // upgradeCharge(from, to, paidThroughS, nowS) -> {credit, first, full} in cents: the credit is the old plan's last
  // payment times the unused share of the period it paid for (paidThroughS: its next billing time); the FIRST charge
  // of the new plan is its price minus the credit, never below $1.00; every later charge is the full price.
  function upgradeCharge(from, to, paidThroughS, nowS) {
    const f = TIERS[from.tier], t = TIERS[to.tier];
    const len = PERIODS[from.period].days * 86400;
    const left = Math.max(0, Math.min(len, (Number(paidThroughS) || 0) - nowS));
    const credit = Math.floor(f.cents[from.period] * left / len);
    const full = t.cents[to.period];
    return { credit, full, first: Math.max(100, full - credit) };
  }
  // FREE is no plan at all (Nathan 2026-11-20: "free plan should be whatever the defaults are in the ABSENCE of a signed
  // ticket"): the DEFAULTS below, with no license, no record and nothing to cancel. This row only names it in the plan
  // list (display).
  const FREE_PLAN = Object.freeze({ id: 'free', name: 'Free: private meetings, up to 5 people', price: '$0', priceYear: '$0', meetings: 1, adminRooms: true, roomLimit: FREE_LIMIT, turnVideo: false, storage: false, vouches: 0, paid: false });
  const PLANS = TIERS;   // every product a license or ticket may name (display/sales label)
  const PLAN_IDS = Object.keys(PLANS);
  const isPlan = (t) => typeof t === 'string' && Object.prototype.hasOwnProperty.call(PLANS, t);
  const isPaid = (t) => typeof t === 'string' && Object.prototype.hasOwnProperty.call(TIERS, t);
  // A license or ticket names its subscription: a PayPal id, or the store's (G-, A-).
  const idFits = (subId) => typeof subId === 'string' && SUB_ID_RE.test(subId);

  // ---- LINE ITEMS: what a right grants (Nathan 2026-11-20) --------------------------
  // "Subs work like signed menus of capabilities." A license, a meeting ticket and a pass each carry `grants`, signed
  // by the payment service, plus their own end; that is the whole contract. Every decision (the door, the room's line,
  // open-room capture, the TURN video vouch, storage, the rights a page shows) reads these line items and nothing
  // else. A product ($2, $5, $10, the $1 pass, the staff pass) is only a PRESET of them: TIERS[..].grants and
  // PASS_PRESETS, read by the payment service when it signs and by the sales/display UI.
  //   roomLimit        the people line of the holder's admin room: 1..ROOM_LIMIT_MAX, or null (no line)
  //   admitAtFullDoor  let past any admin room's line at the door
  //   captureOpenRoom  may take an open room as its admin
  //   turnVideoLinks   TURN video links one holder vouches for per slot (0: voice only across TURN)
  //   storage          a storage budget (its size rides the license: storage settings)
  //   meetings         how many meetings at once: 1..MEETINGS_MAX (the payment service keeps the key's N newest meetings)
  //   agentHost        hosted bot sessions at once: 0..1000 (the hosted bot add-on; nothing grants or reads it yet)
  //   overflow         'ask' | 'keep': a new meeting past the count asks which meeting gives up its place ('ask'), or
  //                    runs on the free defaults and nothing moves ('keep', enforced by the payment service)
  //   clearWithoutPassword  in the holder's hosted room with NO room password, each viewer may tap to unblur (their
  //                    own choice; video stays blurred until then). Optional, false when absent, written only when
  //                    true. No plan or pass preset grants it (Nathan 2026-11-24): staff mint it by hand.
  //   clearStageWithoutPassword  the same, for the STAGE only: rows, the stadium and everyone off the Stage stay
  //                    blurred. The weaker, safer sibling (meant for paid plans first); a set with both reads as the full one.
  // Every word but the optional ones must be present: `meetings` missing reads as 1, `agentHost` missing as 0, `overflow`
  // missing as 'ask' (Nathan 2026-11-22). ISSUED CREDENTIALS NEVER BREAK (Nathan: "we cannot break people's credentials"): the flag every right
  // signed before 0.9.28.x carries, `oneMeeting`, is read forever as what it meant: true = meetings 1, false = no limit
  // on meetings (MEETINGS_MAX); a set naming both is unreadable. Any other unknown word, a missing required one or a bad
  // value makes the set unreadable (refused), so a checker never guesses.
  //
  // THE DEFAULTS (Nathan 2026-11-20): what everyone has WITHOUT a valid signed right, and what every verifier (door,
  // relay, TURN Worker, page) applies when none is shown, or when one is forged, unsigned, run out or for elsewhere:
  // admin and open rooms, a people line of FREE_LIMIT, voice across TURN but no TURN video, no storage, no capture,
  // nothing past a line. A signed right can only ADD to them or RAISE them (effective): a smaller signed line never
  // lowers the default one. Nothing a client writes changes them.
  const ROOM_LIMIT_MAX = 25;   // a signed room line is 1..25 people, or null: no line (Nathan 2026-11-20)
  const MEETINGS_MAX = 1000000;   // a signed meeting count is 1..1,000,000
  const AGENT_HOST_MAX = 1000;
  const GRANT_WORDS = Object.freeze(['roomLimit', 'admitAtFullDoor', 'captureOpenRoom', 'turnVideoLinks', 'storage', 'meetings', 'agentHost', 'overflow', 'clearWithoutPassword', 'clearStageWithoutPassword']);
  const OPTIONAL_WORDS = Object.freeze({ meetings: 1, agentHost: 0, overflow: 'ask', clearWithoutPassword: false, clearStageWithoutPassword: false });
  const OVERFLOWS = Object.freeze(['ask', 'keep']);   // word -> what it reads as when the set does not name it
  const LEGACY_WORDS = Object.freeze(['oneMeeting']);   // read forever (issued credentials), never written
  const DEFAULTS = g(FREE_LIMIT, false, false, 0, false, 1, 0);
  // effective(grants) -> the defaults raised by a signed right's line items (null roomLimit: no line).
  function effective(x) {
    if (!x) return DEFAULTS;
    return { roomLimit: x.roomLimit === null ? null : Math.max(x.roomLimit, DEFAULTS.roomLimit), admitAtFullDoor: !!x.admitAtFullDoor, captureOpenRoom: !!x.captureOpenRoom,
      turnVideoLinks: Math.max(x.turnVideoLinks | 0, DEFAULTS.turnVideoLinks), storage: !!x.storage, meetings: Math.max(x.meetings | 0, DEFAULTS.meetings),
      agentHost: Math.max(x.agentHost | 0, 0), overflow: x.overflow === 'keep' ? 'keep' : 'ask', clearWithoutPassword: x.clearWithoutPassword === true, clearStageWithoutPassword: x.clearStageWithoutPassword === true };
  }
  const meetingsOk = (v) => intS(v) && v >= 1 && v <= MEETINGS_MAX;
  // grantsOk(x) -> a clean copy in today's words (meetings always written, the legacy oneMeeting turned into it;
  // agentHost written only when above 0, overflow only when 'keep'), or null.
  function grantsOk(x) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
    const keys = Object.keys(x);
    if (keys.some((k) => GRANT_WORDS.indexOf(k) < 0 && LEGACY_WORDS.indexOf(k) < 0)) return null;
    if (GRANT_WORDS.some((k) => !(k in x) && !(k in OPTIONAL_WORDS))) return null;
    if ('oneMeeting' in x && ('meetings' in x || typeof x.oneMeeting !== 'boolean')) return null;
    if (!(x.roomLimit === null || (intS(x.roomLimit) && x.roomLimit >= 1 && x.roomLimit <= ROOM_LIMIT_MAX))) return null;
    if (!(intS(x.turnVideoLinks) && x.turnVideoLinks >= 0 && x.turnVideoLinks <= 1000)) return null;
    for (const k of ['admitAtFullDoor', 'captureOpenRoom', 'storage']) if (typeof x[k] !== 'boolean') return null;
    const meetings = 'meetings' in x ? x.meetings : 'oneMeeting' in x ? (x.oneMeeting ? 1 : MEETINGS_MAX) : OPTIONAL_WORDS.meetings;
    if (!meetingsOk(meetings)) return null;
    const agentHost = 'agentHost' in x ? x.agentHost : OPTIONAL_WORDS.agentHost;
    if (!(intS(agentHost) && agentHost >= 0 && agentHost <= AGENT_HOST_MAX)) return null;
    const overflow = 'overflow' in x ? x.overflow : OPTIONAL_WORDS.overflow;
    if (OVERFLOWS.indexOf(overflow) < 0) return null;
    for (const k of ['clearWithoutPassword', 'clearStageWithoutPassword']) if (k in x && typeof x[k] !== 'boolean') return null;
    const out = { roomLimit: x.roomLimit, admitAtFullDoor: x.admitAtFullDoor, captureOpenRoom: x.captureOpenRoom, turnVideoLinks: x.turnVideoLinks, storage: x.storage, meetings };
    if (agentHost) out.agentHost = agentHost;   // written only when granted
    if (overflow === 'keep') out.overflow = overflow;   // written only when not the default
    if (x.clearWithoutPassword === true) out.clearWithoutPassword = true;   // written only when granted
    if (x.clearStageWithoutPassword === true) out.clearStageWithoutPassword = true;
    return out;
  }
  // parseGrantList("roomLimit=12,captureOpenRoom,turnVideoLinks=6") -> { grants } | { error }: the text form of a hand-picked
  // set of line items (pay/mint-pass.mjs --grants). A name alone is true; name=true|false for the flags; roomLimit=1..25 or
  // none (no line); turnVideoLinks=whole number; meetings=1..MEETINGS_MAX; agentHost=0..1000; overflow=ask|keep. Strict: an unknown name, a repeated one or a bad value is an error. A word not
  // named takes the no-grant value (nothing added: line 5, no flags, 0 links, one meeting): defaults fill nothing. The
  // result must also pass grantsOk, the one validator every verifier runs.
  function parseGrantList(text) {
    if (typeof text !== 'string' || !text.trim()) return { error: 'empty grant list' };
    const g = { roomLimit: FREE_LIMIT, admitAtFullDoor: false, captureOpenRoom: false, turnVideoLinks: 0, storage: false, meetings: 1 };
    const seen = {};
    for (const raw of text.split(',')) {
      const m = /^([A-Za-z]+)(?:=([A-Za-z0-9]+))?$/.exec(raw.trim());
      if (!m) return { error: 'bad item "' + raw.trim() + '"' };
      const k = m[1], v = m[2];
      if (GRANT_WORDS.indexOf(k) < 0) return { error: 'unknown item "' + k + '" (known: ' + GRANT_WORDS.join(', ') + ')' };
      if (seen[k]) return { error: 'item "' + k + '" given twice' };
      seen[k] = true;
      if (k === 'roomLimit') {
        if (v === 'none') g.roomLimit = null;
        else if (v !== undefined && /^[0-9]{1,2}$/.test(v) && +v >= 1 && +v <= ROOM_LIMIT_MAX) g.roomLimit = +v;
        else return { error: 'roomLimit needs 1-' + ROOM_LIMIT_MAX + ' or none' };
      } else if (k === 'turnVideoLinks') {
        if (v !== undefined && /^[0-9]{1,4}$/.test(v) && +v <= 1000) g.turnVideoLinks = +v;
        else return { error: 'turnVideoLinks needs a whole number 0-1000' };
      } else if (k === 'meetings') {
        if (v !== undefined && /^[0-9]{1,7}$/.test(v) && meetingsOk(+v)) g.meetings = +v;
        else return { error: 'meetings needs a whole number 1-' + MEETINGS_MAX };
      } else if (k === 'overflow') {
        if (v === 'ask' || v === 'keep') g.overflow = v;
        else return { error: 'overflow needs ask or keep' };
      } else if (k === 'agentHost') {
        if (v !== undefined && /^[0-9]{1,4}$/.test(v) && +v <= AGENT_HOST_MAX) g.agentHost = +v;
        else return { error: 'agentHost needs a whole number 0-' + AGENT_HOST_MAX };
      } else if (v === undefined || v === 'true') g[k] = true;
      else if (v === 'false') g[k] = false;
      else return { error: k + ' is a flag: use ' + k + ', ' + k + '=true or ' + k + '=false' };
    }
    const ok = grantsOk(g);
    return ok ? { grants: ok } : { error: 'the grants fail the line-item check' };
  }
  // The words of a refusal at a full door and the host's upgrade offer (display only, never a decision): the free
  // line's words when the room's signed line items (grants; null: none shown) leave its people line at the default.
  // Read from line items, never the product's name: the same grants under any label (or none) get the same words.
  const fullFreeWords = (grants) => { const x = grants && grantsOk(grants); return !x || (x.roomLimit !== null && x.roomLimit <= FREE_LIMIT); };
  const grantsKey = (x) => GRANT_WORDS.map((k) => String(x[k] == null && k in OPTIONAL_WORDS ? OPTIONAL_WORDS[k] : x[k])).join('|');
  // The rights shape a page reads, from line items. label: the product's name, for display only. signed: a valid signed
  // right backs these rights (true whenever line items were given): every "is a right held" test reads it, never tier.
  // key: the payment service's record the right counts against (a subscription id, a pass key's K- record): rights
  // from different keys add their meeting counts in heldRights.
  function grantsRights(signed, label, until, key) {
    const x = effective(signed);
    return { signed: !!signed, key: signed && key || null, tier: label || null, subscribed: x.admitAtFullDoor, adminRooms: true, openRooms: true, roomLimit: x.roomLimit, turnAudio: true, turnVideo: x.turnVideoLinks > 0,
      storage: null, bypassLimit: x.admitAtFullDoor, until, vouches: x.turnVideoLinks, capture: x.captureOpenRoom, meetings: x.meetings, agentHost: x.agentHost || 0, overflow: x.overflow === 'keep' ? 'keep' : 'ask', clearNoPw: x.clearWithoutPassword === true, clearStageNoPw: x.clearStageWithoutPassword === true, grants: signed || null };
  }
  // What everyone has with no signed right: the defaults, in the rights shape.
  const FREE = Object.freeze(grantsRights(null, null, 0));

  const TEXT = {
    full: 'This meeting is full for people without a subscription. Any GifOS subscription lets you join.',
    fullFree: 'This room is full on the free plan',
    fullFreeNote: 'Any GifOS subscription lets you join.',
    needForAdmin: 'Private meetings come with a GifOS subscription. Public open-floor meetings stay free.',
    waiting: 'Checking whether this meeting has room for you…',
    lapsed: 'Your subscription has ended. Renew it in Settings to keep your private meetings.',
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
    if (!grantsOk(o.grants)) return null;
    if (!edKeyOk(o.buyerKey)) return null;
    if (!idFits(o.subId)) return null;
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

  // ---- weak Ed25519 keys and signatures ---------------------------------------
  // A small-order public key (or a signature whose R is one, the all-zero signature included) lets a signature be
  // forged on engines that skip the check: an all-zero signature by the all-zero key verified on some Workers isolates
  // (2026-11-24). No honest key or signature is one, so every Ed25519 check here and in the Workers and the relay
  // refuses them before asking the engine. The list is libsodium's: the eight small-order points and their
  // non-canonical spellings, compared with the sign bit masked.
  const SMALL_ORDER = ['00'.repeat(32), '01' + '00'.repeat(31),
    '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05',
    'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a',
    'ec' + 'ff'.repeat(30) + '7f', 'ed' + 'ff'.repeat(30) + '7f', 'ee' + 'ff'.repeat(30) + '7f']
    .map((h) => Uint8Array.from(h.match(/../g), (x) => parseInt(x, 16)));
  // edKeyWeak(bytes) -> true for anything that is not a usable 32-byte public key.
  function edKeyWeak(b) {
    if (!b || b.length !== 32) return true;
    return SMALL_ORDER.some((e) => { for (let i = 0; i < 31; i++) if (b[i] !== e[i]) return false; return (b[31] & 0x7f) === e[31]; });
  }
  // edSigWeak(bytes) -> true for anything that is not a usable 64-byte signature.
  function edSigWeak(s) {
    if (!s || s.length !== 64) return true;
    let any = 0; for (let i = 0; i < 64; i++) any |= s[i];
    return any === 0 || edKeyWeak(s.subarray ? s.subarray(0, 32) : Array.prototype.slice.call(s, 0, 32));
  }
  // edKeyOk(base64) -> the key if it is a canonical base64 32-byte key that is not weak, else null.
  function edKeyOk(v) {
    if (typeof v !== 'string' || !KEY_RE.test(v)) return null;
    let b; try { b = b64ToBytes(v); } catch (e) { return null; }
    if (b.length !== 32 || edKeyWeak(b)) return null;
    let bin = ''; for (const x of b) bin += String.fromCharCode(x);
    return (typeof btoa === 'function' ? btoa(bin) : Buffer.from(b).toString('base64')) === v ? v : null;
  }
  // edVerify(subtle, key, sig, msg) -> bool, never throws. key: base64 or 32 bytes; sig: base64 or 64 bytes; msg: text
  // or bytes. The one Ed25519 check the Workers and the relay use for a key they did not make.
  async function edVerify(subtle, key, sig, msg) {
    try {
      const k = typeof key === 'string' ? b64ToBytes(key) : key;
      const g = typeof sig === 'string' ? b64ToBytes(sig) : sig;
      if (edKeyWeak(k) || edSigWeak(g)) return false;
      const pub = await subtle.importKey('raw', k, { name: 'Ed25519' }, false, ['verify']);
      return !!(await subtle.verify('Ed25519', pub, g, typeof msg === 'string' ? utf8(msg) : msg));
    } catch (e) { return false; }
  }

  // verifyLicense({licenseJson, sig}, verify, nowS) -> the parsed license or
  // null. verify(sigBytes, msgBytes) -> bool checks the payment service's
  // signature with its published key (the caller holds the key).
  async function verifyLicense(lic, verify, nowS) {
    if (!lic || typeof lic.licenseJson !== 'string' || typeof lic.sig !== 'string') return null;
    if (lic.licenseJson.length > 2048) return null;
    let sigBytes; try { sigBytes = b64ToBytes(lic.sig); } catch (e) { return null; }
    if (edSigWeak(sigBytes)) return null;
    let ok = false;
    try { ok = !!(await verify(sigBytes, utf8(lic.licenseJson))); } catch (e) { ok = false; }
    if (!ok) return null;
    let o; try { o = JSON.parse(lic.licenseJson); } catch (e) { return null; }
    o = checkLicense(o, nowS);
    return o;
  }

  // rightsOf(license or null) -> what this person may do: the license's signed line items. A null, broken or run-out
  // license is no plan (open rooms only).
  function rightsOf(o, nowS) {
    const lic = o && checkLicense(o, nowS);
    if (!lic) return Object.assign({}, FREE);
    const x = grantsOk(lic.grants);
    const r = grantsRights(x, lic.tier, lic.exp, lic.subId);
    r.storage = x.storage && lic.storage && typeof lic.storage === 'object' ? {
      gb: Number(lic.storage.gb) || 0,
      lapseKeepDays: lic.storage.lapseKeepDays == null ? 30 : Number(lic.storage.lapseKeepDays),
      atCap: String(lic.storage.atCap || 'refuse-new'),
      warnAtPercent: Number(lic.storage.warnAtPercent) || 80,
    } : null;
    return r;
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
    if (!lic || !edKeyOk(lic.buyerKey)) return false;
    if (typeof nonce !== 'string' || !NONCE_RE.test(nonce)) return false;
    let sig; try { sig = b64ToBytes(proofSig); } catch (e) { return false; }
    if (edSigWeak(sig)) return false;
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
  // admission({adminRoom, roomGrants, listLength, hold, entrant, freeWords}) where entrant is {isAdmin, grants}.
  // roomGrants: the line items of the room's plan as the door verified them (roomTierOf), or null when none can be
  // shown: an admin room whose plan cannot be shown, for any reason, has the DEFAULTS' line (Nathan 2026-11-11). The
  // entrant goes past a line only by its own admitAtFullDoor. freeWords (display): say the free line's words.
  // -> {admit:true, why} | {admit:false, wait:true, why} | {admit:false, why, message}
  function admission(o) {
    o = o || {};
    if (!o.adminRoom) return { admit: true, why: 'open-room' };
    const e = o.entrant || {};
    if (e.isAdmin) return { admit: true, why: 'admin' };
    const eg = e.grants && grantsOk(e.grants);
    if (eg && eg.admitAtFullDoor) return { admit: true, why: 'subscriber' };
    // Right after a meeting server restarts its list refills over a few
    // seconds; a short list then is not a count.
    if (o.hold) return { admit: false, wait: true, why: 'restart-hold', message: TEXT.waiting };
    const n = Number(o.listLength);
    if (!Number.isFinite(n) || n < 0) return { admit: false, wait: true, why: 'no-count', message: TEXT.waiting };
    const limit = effective(o.roomGrants && grantsOk(o.roomGrants)).roomLimit;
    if (limit != null && n >= limit) return o.freeWords ? { admit: false, why: 'full', limit, free: true, message: TEXT.fullFree } : { admit: false, why: 'full', limit, message: TEXT.full };
    return { admit: true, why: 'room-has-space' };
  }

  // ---- the room's plan, carried by the room ---------------------------------
  // room is the admin room's full name ("<name>.<verifier>"): a proof made
  // for one room is worth nothing in another.
  const roomContext = (room) => 'room:' + String(room);
  const doorContext = (room) => 'door:' + String(room);
  // The admin's room order: {lic:{licenseJson,sig}, proof, at}. proof signs
  // proofMessage(roomContext(room), 'at:' + at) with the license's key.
  // ---- meetings at once: the meeting ticket ----------------------------------
  // A subscription powers `meetings` meetings at once (its line item; 1 unless
  // the plan says more), admin rooms or open rooms. Joining a meeting asks the
  // payment service for a ticket naming that meeting (meetingTag: the service
  // never learns the room's name). The service keeps the key's `meetings`
  // newest meetings: a ticket lasts TICKET_S and is renewed every
  // RENEW_EVERY_S, and a renewal for a meeting dropped from that list is
  // refused, so a dropped meeting loses the subscription within TICKET_S. Payment is checked when the meeting is JOINED, never on a
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
    if (!grantsOk(o.grants)) return null;
    if (!edKeyOk(o.buyerKey)) return null;
    if (!idFits(o.subId)) return null;
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
    if (edSigWeak(sigBytes)) return null;
    let ok = false;
    try { ok = !!(await verify(sigBytes, utf8(t.ticketJson))); } catch (e) { ok = false; }
    if (!ok) return null;
    let o; try { o = JSON.parse(t.ticketJson); } catch (e) { return null; }
    return checkTicket(o, nowS, meeting);
  }
  // What a meeting right grants in its meeting: its line items (FREE when it carries none readable).
  function ticketRights(t) {
    const x = t && grantsOk(t.grants);
    return x ? grantsRights(x, t.tier, t.exp, t.subId) : Object.assign({}, FREE);
  }

  // The admin's room order: {ticket:{ticketJson,sig}, proof, at}. The ticket
  // must be current and for THIS room's meeting; proof signs
  // proofMessage(roomContext(room), 'at:' + at) with the ticket's key.
  // -> {grants, exp, tier (the product's name: display), pass?} or null.
  // The ticket may be a pass's meeting ticket (passTicket): the room then
  // reads the pass's line items while that ticket lasts.
  async function roomTierOf(order, room, verifyPay, verifyKey, nowS) {
    if (!order || typeof order !== 'object' || order.on === false) return null;
    if (!Number.isInteger(order.at)) return null;
    const t = await meetingRight(order.ticket, verifyPay, nowS, await meetingTag(room));
    if (!t) return null;
    const ok = await verifyProof(t, roomContext(room), 'at:' + order.at, order.proof, verifyKey);
    if (!ok) return null;
    const cred = credId(t);
    return t.pass ? { tier: t.tier, grants: t.grants, exp: t.exp, pass: true, cred } : { tier: t.tier, grants: t.grants, exp: t.exp, cred };
  }
  // credId(meeting right) -> the id GifOS revokes it by, and nothing more: the subscription id (or a pass key's K-
  // record), and for a pass ticket the pass id (the revoked-pass list's word). Never the meeting, a key or a signature.
  function credId(t) {
    const c = { subId: t && (idFits(t.subId) || (typeof t.subId === 'string' && /^K-[0-9a-f]{24}$/.test(t.subId))) ? t.subId : null };   // K-: a pass key's record
    if (t && t.pass && typeof t.pid === 'string' && PASS_ID_RE.test(t.pid)) c.pid = t.pid;
    return c;
  }
  // clearNoPwRight(tier, nowS) -> true only when the room's VERIFIED plan (roomTierOf's answer: a pay-signed meeting
  // ticket for this room, proven by its key in the host's signed orders) is current and its line items say
  // clearWithoutPassword. Anything else (none, forged, run out, revoked: the payment service stops renewing it, so it
  // runs out within TICKET_S; no such line item) is false: video stays blurred with no tap offered.
  function clearNoPwRight(tier, nowS) {
    if (!tier || typeof tier !== 'object' || !Number.isFinite(tier.exp) || !(nowS < tier.exp)) return false;
    const x = grantsOk(tier.grants);
    return !!x && x.clearWithoutPassword === true;
  }
  // clearStageNoPwRight(tier, nowS): the same chain for the Stage-only item (true also when the full item is there:
  // the full one covers the Stage).
  function clearStageNoPwRight(tier, nowS) {
    if (!tier || typeof tier !== 'object' || !Number.isFinite(tier.exp) || !(nowS < tier.exp)) return false;
    const x = grantsOk(tier.grants);
    return !!x && (x.clearStageWithoutPassword === true || x.clearWithoutPassword === true);
  }
  // ---- passes ----------------------------------------------------------------
  // A PASS is a receipt the payment service signs once: {v, kind, payeeId,
  // via, order, id, buyerKey, paid, start, end, plan, grants}. grants is what it
  // grants (PERMISSIONS above), end its last second, or null: it never ends.
  // paid is when it was paid (or minted); start is paid, or the end of a pass
  // the buyer already held (passes stack: passStart). grants: its line items
  // (LINE ITEMS above); plan: the product's name, for display. Its signature is over
  // passMessage(passJson): a domain no other receipt, license or ticket is
  // signed in, so only the pass paths of the payment service (and the staff
  // minting script, with the same key) can make one.
  //
  // What we sell or mint is a PRESET of line items and a length
  // (PASS_PRESETS). A new product is a new row there and a price: no check
  // anywhere changes.
  //
  // ONE MEETING AT A TIME, or grants.meetings at once (Nathan 2026-11-12:
  // "otherwise we've just created a very costly attack path"). The pass's
  // key and its passes ride in the provider GIF, so a copy of that file is the
  // whole credential. The pass itself is therefore never a meeting right:
  // joining a meeting shows the held passes to the payment service, which
  // keeps the pass key's `meetings` newest meetings (one record per pass key, passRecId)
  // and signs a PASS MEETING TICKET for it (passTicket below), renewed like a
  // subscription's; joining a meeting past the count drops the oldest, whose
  // ticket stops renewing, so that meeting loses the pass within
  // TICKET_S. Rooms, the door and the TURN Worker read only that ticket, and
  // the line items it carries. Passes of one key and the same line items
  // stack into one window (passChain).
  //
  // REVOCATION. A pass that never ends must be stoppable: every pass has its
  // own id, and the pay Worker, the relay and the TURN Worker each hold the
  // list of revoked pass ids (the secret GIFOS_PASS_REVOKED: ids split by
  // commas or spaces; a secret, so no deploy of the toml ever un-revokes).
  // The pay Worker then signs no ticket for it (join and renew), the TURN
  // Worker takes none, and the relay drops a capture held by it at the
  // room's next event. Pages honor the relay's word at once and a ticket's
  // own end within TICKET_S.
  const PASS_KIND = 'gifos-pass4h';                // every pass's kind (named for the first one sold)
  const PASS_TAG = 'gifos-pass4h-receipt';
  // The four-hour pass's length: PASS_S in the timings table (js/timings.js,
  // loaded before this file on a page and imported by every Worker that
  // checks a pass). Without the table no four-hour pass checks out (fails closed).
  const passSeconds = () => { const t = GifOS.timings; return t && Number.isInteger(t.PASS_S) && t.PASS_S > 0 ? t.PASS_S : NaN; };
  // THE PRESETS: every pass we sell or mint. seconds: its length (a function
  // of the timings table), or null: it never ends. sold: offered to buyers.
  const PASS_PRESETS = Object.freeze({
    // $1, one PayPal order (or a store purchase): Unlimited's meeting rights for four hours, one meeting at a time (meetings 1),
    // past any full door, but never capturing an open room (that stays with the $5 and $10 subscriptions).
    pass4h: Object.freeze({ plan: 'unlimited', grants: Object.freeze(Object.assign({}, TIERS.unlimited.grants, { captureOpenRoom: false })), seconds: passSeconds, price: '$1', value: '1.00', sold: true }),
    // Ours, minted with the pay key for our own bots, never sold: Unlimited, captures an open room, never ends; one
    // meeting at a time (several sessions of one pass in the SAME meeting all renew: sibling bots may share one pass).
    staff: Object.freeze({ plan: 'unlimited', grants: TIERS.unlimited.grants, seconds: () => null, sold: false }),
  });
  // presetPass(name, start) -> {plan, grants, end} for a new pass of that preset.
  function presetPass(name, start) {
    const pr = Object.prototype.hasOwnProperty.call(PASS_PRESETS, name) ? PASS_PRESETS[name] : null;
    if (!pr) return null;
    const len = pr.seconds();
    if (len !== null && !(Number.isInteger(len) && len > 0)) return null;
    return { plan: pr.plan, grants: Object.assign({}, pr.grants), end: len === null ? null : start + len };
  }
  const PASS_PLAN = PASS_PRESETS.pass4h.plan;   // the four-hour pass's name (sold as "Unlimited")
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
  // checkPass(o) -> a clean copy of o, its grants read, or null: the shape alone (no clock).
  // The copy's end is a number: Infinity for a pass that never ends.
  function checkPass(o) {
    if (!o || typeof o !== 'object') return null;
    if (o.v !== 1 || o.kind !== PASS_KIND || o.payeeId !== SELLER || PASS_VIAS.indexOf(o.via) < 0) return null;
    if (typeof o.order !== 'string' || !ORDER_ID_RE.test(o.order) || o.id !== 'P4-' + o.order || !PASS_ID_RE.test(o.id)) return null;
    if (!edKeyOk(o.buyerKey)) return null;
    if (!intS(o.paid) || !intS(o.start) || o.start < o.paid) return null;
    const grants = grantsOk(o.grants);
    if (!grants) return null;
    if ('plan' in o && typeof o.plan !== 'string') return null;   // the product's name (display)
    if (o.end !== null && (!intS(o.end) || o.end <= o.start)) return null;
    return Object.assign({}, o, { grants, end: passEnd(o) });
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
    if (edSigWeak(sigBytes)) return null;
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
  // What a live pass grants, as a ticket would: its line items.
  function passRights(o) {
    const x = o && grantsOk(o.grants);
    return x ? Object.assign(grantsRights(x, o.plan, passEnd(o), 'K:' + o.buyerKey), { pass: true }) : Object.assign({}, FREE);
  }
  // ---- the pass's meeting ticket ------------------------------------------------
  // passRecId(buyerKey) -> 'K-' + 24 hex: the payment service's one record
  // for a pass key (its newest meetings). Every pass of that key, stacked or
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
    const k = grantsKey(live.grants);
    let until = passEnd(live);
    for (const o of list) if (o.buyerKey === live.buyerKey && grantsKey(o.grants) === k && o.start <= until && passEnd(o) > until) until = passEnd(o);
    return { live, until };
  }
  // checkPassTicket(o, nowS, meeting) -> o or null: {v, kind, payeeId, plan (display),
  // grants, pid (the pass's id), buyerKey (the pass key), subId (passRecId of
  // it), meeting, gen, issued, exp}.
  function checkPassTicket(o, nowS, meeting) {
    if (!o || typeof o !== 'object') return null;
    if (o.v !== 1 || o.kind !== PASS_TICKET_KIND || o.payeeId !== SELLER) return null;
    const grants = grantsOk(o.grants);
    if (!grants) return null;
    if (o.pid !== undefined && (typeof o.pid !== 'string' || !PASS_ID_RE.test(o.pid))) return null;
    if (!edKeyOk(o.buyerKey)) return null;
    if (typeof o.subId !== 'string' || !PASS_REC_RE.test(o.subId)) return null;
    if (typeof o.meeting !== 'string' || !MEETING_RE.test(o.meeting)) return null;
    if (meeting != null && o.meeting !== meeting) return null;
    if (!intS(o.gen) || o.gen < 1 || !intS(o.issued) || !intS(o.exp)) return null;
    if (o.exp <= o.issued || o.exp - o.issued > TICKET_S + 60) return null;
    if (!(nowS < o.exp) || o.issued > nowS + ASK_WINDOW_S) return null;
    return Object.assign({}, o, { grants });
  }
  // verifyPassTicket({ticketJson, sig}, verify, nowS, meeting) -> the ticket or null.
  async function verifyPassTicket(t, verify, nowS, meeting) {
    if (!t || typeof t.ticketJson !== 'string' || typeof t.sig !== 'string' || t.ticketJson.length > 2048) return null;
    let sigBytes; try { sigBytes = b64ToBytes(t.sig); } catch (e) { return null; }
    if (edSigWeak(sigBytes)) return null;
    let ok = false;
    try { ok = !!(await verify(sigBytes, utf8(passTicketMessage(t.ticketJson)))); } catch (e) { ok = false; }
    if (!ok) return null;
    let o; try { o = JSON.parse(t.ticketJson); } catch (e) { return null; }
    o = checkPassTicket(o, nowS, meeting);
    if (o && o.subId !== (await passRecId(o.buyerKey))) return null;
    return o;
  }
  // ownTicketGrants(ticketJson) -> the line items this page's OWN meeting ticket (a subscription's or a pass's, fresh
  // from the payment service, unchecked) carries, or null: what the page shows at a door or tries, never what it accepts.
  function ownTicketGrants(ticketJson) {
    let o; try { o = JSON.parse(String(ticketJson)); } catch (e) { return null; }
    return o && typeof o === 'object' ? grantsOk(o.grants) : null;
  }
  // A pass ticket as a meeting right: the shape the door, the room's plan and
  // the TURN Worker read from a ticket. subId (the pass key's record) keys
  // the TURN Worker's per-customer count: stacked passes count as one.
  const passTicketAsTicket = (o) => ({ tier: o.plan, grants: o.grants, buyerKey: o.buyerKey, subId: o.subId, meeting: o.meeting, gen: o.gen, exp: o.exp, pass: true, pid: o.pid || null });
  const isPassTicket = (r) => { if (!r || typeof r.ticketJson !== 'string') return false; try { return JSON.parse(r.ticketJson).kind === PASS_TICKET_KIND; } catch (e) { return false; } };
  // A meeting right carried where a ticket rides (room order, door answer,
  // TURN ask, capture): a subscription's ticket for this meeting, or a pass's
  // meeting ticket for it, each with the line items it grants (grants). A
  // bare pass is NOT one: it names no meeting.
  // -> ticket-shaped or null.
  async function meetingRight(r, verify, nowS, meeting) {
    if (!r || typeof r !== 'object' || typeof r.passJson === 'string') return null;
    if (isPassTicket(r)) { const o = await verifyPassTicket(r, verify, nowS, meeting); return o ? passTicketAsTicket(o) : null; }
    const t = await verifyTicket(r, verify, nowS, meeting);
    return t ? Object.assign({}, t, { grants: grantsOk(t.grants) }) : null;
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
    return t && t.grants && t.grants.captureOpenRoom && !rightRevoked(t, revoked) ? t : null;
  }
  // captureTicket(tk, room) -> the captor's meeting right for this room now, checked against the payment service's key
  // (/gifos-pay.key, fetched once), or null. For a page with no meet-subs (gifos.app/embed): it only reads a captured room.
  let payKeyP = null;
  async function captureTicket(tk, room) {
    try {
      if (!payKeyP) payKeyP = fetch('/gifos-pay.key').then(async (r) => {
        if (!r.ok) throw new Error('no /gifos-pay.key');
        const raw = Uint8Array.from(atob((await r.text()).trim()), (ch) => ch.charCodeAt(0));
        if (raw.length !== 32) throw new Error('bad /gifos-pay.key');
        return raw;
      }).catch((e) => { payKeyP = null; throw e; });
      const key = await payKeyP;
      return await captureRight(tk, (sig, msg) => GifOS.ed.verify(key, sig, msg), Math.floor(Date.now() / 1000), await meetingTag(room));
    } catch (e) { return null; }
  }
  // rank(r) -> a number that orders one right against another: the larger room first, then the larger vouch count, then
  // capture, then more meetings at once (room 0..1e6, vouches 0..1000, meetings 0..1e6 all fit in 2^53). A right no
  // valid signature backs (r.signed false: the defaults, a forged or run-out right) is 0. Never reads the label.
  function rank(r) {
    if (!r || !r.signed) return 0;
    const room = r.roomLimit == null ? 1000 : r.roomLimit;   // no line beats any line (ROOM_LIMIT_MAX 25)
    return ((room * 1001 + (r.vouches || 0)) * 2 + (r.capture ? 1 : 0)) * (MEETINGS_MAX + 1) + Math.min(r.meetings || 1, MEETINGS_MAX);
  }
  // heldRights(list) -> what several rights held at once give together (a subscription's, a pass's, a stack): the
  // UNION of their line items. roomLimit: the largest (no line wins); flags: any; vouches: the most; meetings and
  // agentHost: ADD across distinct keys (each key is its own record at the payment service; two rights on one key,
  // a stack, are time, not count: the larger one); overflow: 'keep' if any keeps; unionUntil: the first end (the union
  // changes then). Rights no signature backs add nothing; none at all is the defaults. The display fields (tier,
  // pass, until, storage, key) follow the top-ranked right (the first of equals), and sources lists every one. A $2
  // subscriber holding a pass reads the pass's line items for its window, then Room 20 again.
  function heldRights(list) {
    const held = (list || []).filter((r) => r && r.signed);
    if (!held.length) return Object.assign({}, FREE);
    let top = held[0];
    for (const r of held) if (rank(r) > rank(top)) top = r;
    const perKey = new Map();
    const addUp = (word) => { perKey.clear(); held.forEach((r, i) => { const k = r.key || '#' + i; perKey.set(k, Math.max(perKey.get(k) || 0, r[word] | 0)); }); let n = 0; perKey.forEach((v) => { n += v; }); return n; };
    const meetings = Math.min(Math.max(addUp('meetings'), 1), MEETINGS_MAX), agentHost = Math.min(addUp('agentHost'), AGENT_HOST_MAX);
    const roomLimit = held.some((r) => r.roomLimit === null) ? null : Math.max.apply(null, held.map((r) => r.roomLimit));
    const any = (w) => held.some((r) => !!r[w]);
    const vouches = Math.max.apply(null, held.map((r) => r.vouches | 0));
    const overflow = held.some((r) => r.overflow === 'keep') ? 'keep' : 'ask';
    const grants = { roomLimit, admitAtFullDoor: any('bypassLimit'), captureOpenRoom: any('capture'), turnVideoLinks: vouches, storage: held.some((r) => r.grants && r.grants.storage), meetings };
    if (agentHost) grants.agentHost = agentHost;
    if (overflow === 'keep') grants.overflow = overflow;
    const clearNoPw = held.some((r) => r.clearNoPw === true);
    if (clearNoPw) grants.clearWithoutPassword = true;
    const clearStageNoPw = held.some((r) => r.clearStageNoPw === true);
    if (clearStageNoPw) grants.clearStageWithoutPassword = true;
    const until = Math.min.apply(null, held.map((r) => (r.until == null ? Infinity : r.until)));
    return Object.assign({}, top, { signed: true, roomLimit, subscribed: any('subscribed'), bypassLimit: grants.admitAtFullDoor, turnVideo: vouches > 0, vouches, capture: grants.captureOpenRoom,
      meetings, agentHost, overflow, clearNoPw, clearStageNoPw, grants, storage: top.storage || (held.find((r) => r.storage) || {}).storage || null, until: top.until, unionUntil: until,
      sources: held.map((r) => ({ tier: r.tier, pass: !!r.pass, key: r.key, until: r.until })) });
  }

  // rightsJson(r) -> the plain JSON every interface reads (GifOS.rights(), the SDKs, the MCP servers, the hosted-bot
  // host): the signed line items in effect and where they come from. label is the product's name, for display only;
  // decide on the line items. A time that never ends is null; no right held is the defaults with signed false.
  const endJson = (t) => (t == null || !Number.isFinite(t) ? null : t);
  function rightsJson(r) {
    const x = r && r.signed ? r : FREE;
    return { signed: !!x.signed, label: x.tier || null, roomLimit: x.roomLimit, admitAtFullDoor: !!x.bypassLimit, captureOpenRoom: !!x.capture,
      turnVideoLinks: x.vouches | 0, storage: !!(x.grants && x.grants.storage), meetings: x.meetings || 1, agentHost: x.agentHost | 0, overflow: x.overflow === 'keep' ? 'keep' : 'ask',
      clearWithoutPassword: x.clearNoPw === true, clearStageWithoutPassword: x.clearStageNoPw === true,
      until: x.signed ? endJson(x.until) : null,
      sources: (x.sources || (x.signed ? [{ tier: x.tier, pass: !!x.pass, until: x.until }] : [])).map((s) => ({ label: s.tier || null, pass: !!s.pass, until: endJson(s.until) })) };
  }
  // GifOS.rights() -> Promise of rightsJson: THE one rights call. Here (the core, which takes no credentials yet) it is
  // the defaults; the meeting page's subscription code (meet-subs.js) replaces it with what this person holds.
  if (typeof GifOS.rights !== 'function') GifOS.rights = async () => rightsJson(FREE);

  // doorVerdict: what a greeter does with a knocker it has no proof from.
  // -> 'let-in' (no limit applies, or the room has space, or the count is not
  // readable yet) | 'ask' (the room is at its line: the knocker must show a plan)
  function doorVerdict(o) {
    const v = admission({ adminRoom: o.adminRoom, roomGrants: o.roomGrants, listLength: o.count, hold: o.hold, entrant: { isAdmin: false, grants: null } });
    return v.admit || v.wait ? 'let-in' : 'ask';
  }
  // The knocker's answer to the door's challenge: a current meeting right for
  // THIS room's meeting whose line items say admitAtFullDoor, and the
  // ticket key's signature over the door's nonce.
  async function doorProofOk(shown, room, nonce, verifyPay, verifyKey, nowS) {
    if (!shown || typeof shown !== 'object') return null;
    const t = await meetingRight(shown.ticket, verifyPay, nowS, await meetingTag(room));
    if (!t || !t.grants || !t.grants.admitAtFullDoor) return null;
    return (await verifyProof(t, doorContext(room), nonce, shown.proof, verifyKey)) ? t : null;
  }

  // ---- the subscription file (a provider GIF) ----------------------------------
  // The subscription lives in a file the person keeps and can move: a GifOS
  // GIF whose manifest says it provides the meeting subscription, holding the
  // subscription id, its plan and the 32-byte seed of the subscriber's key.
  // Anyone holding the file holds the subscription; the meeting count is what
  // stops a copy from being shared (each join past it drops the oldest meeting).
  const CRED_KIND = 'gifos-sub-credential';
  const SEED_RE = /^[A-Za-z0-9+/]{43}=$/;
  function credentialOk(c) {
    if (!c || typeof c !== 'object' || c.v !== 1 || c.kind !== CRED_KIND) return null;
    if (!isPlan(c.tier) || !idFits(c.subId)) return null;   // tier: which product this file is (sales: cancel, change plan)
    if (typeof c.seed !== 'string' || !SEED_RE.test(c.seed)) return null;
    let raw; try { raw = b64ToBytes(c.seed); } catch (e) { return null; }
    if (raw.length !== 32) return null;
    const out = { v: 1, kind: CRED_KIND, subId: c.subId, tier: c.tier, period: c.period === 'yearly' || c.period === 'monthly12' ? c.period : 'monthly', seed: c.seed, buyerKey: edKeyOk(c.buyerKey) || undefined };
    // libSeed is the library key's seed. A move keeps it; a PayPal restore sets it to the new seed.
    // Unknown fields are otherwise dropped, so this one has to be copied or the library key dies on the way.
    if (typeof c.libSeed === 'string' && SEED_RE.test(c.libSeed)) {
      try { if (b64ToBytes(c.libSeed).length === 32) out.libSeed = c.libSeed; } catch (e) {}
    }
    return out;
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
    return { v: 1, kind: WALLET_KIND, seed: w.seed, buyerKey: edKeyOk(w.buyerKey) || undefined, passes, pending };
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
        'A subscription works in as many meetings at once as its plan says (one, unless it says more): joining one more takes the place of the oldest.</p><p>Anyone with this file can use your subscription and passes. Keep it private.</p>',
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

  // ---- THE ROOM ACL (the relay's, docs/relay-lockdown.md "Meeting size: who decides") -----------------------------
  // Nathan 2026-11-24: "the relay should store per room the very simple ACL ... as people with creds join they enrich
  // the meeting with better acl. doesnt matter if they leave, that acl can last as long as the room lasts" and "The relay
  // keeps the list of all permissions granted, NOT the ephemeral plans. THE PERMISSIONS. ORish." and "the $1 pass does
  // indeed remove the room people limit for everyone."
  // A room's ACL is the OR of the ROOM-scoped line items of every meeting right verified in it: the largest roomLimit
  // (null, no limit, beats any number), and any room-scoped flag. Holder-scoped items (capture, admitAtFullDoor, the
  // meeting count...) are rights of their holder and never enter the room's ACL. Compact, so it rides relay attachments:
  // {l: roomLimit (null = no limit), f: bit set over ACL_FLAGS, s: when the room got its current limit (ms)}. No ACL at all
  // is the DEFAULTS. Only the relay decides by it; anyone in the room may READ it (the License view: aclView).
  // THE SCOPE OF EACH LINE ITEM: 'room' = once anyone in the room shows it, the room has it; 'holder' = only its holder.
  const ACL_SCOPE = Object.freeze({ roomLimit: 'room', admitAtFullDoor: 'holder', captureOpenRoom: 'holder', storage: 'holder', clearWithoutPassword: 'holder',
    clearStageWithoutPassword: 'holder', turnVideoLinks: 'holder', meetings: 'holder', agentHost: 'holder', overflow: 'holder' });
  // The room-scoped flags, in bit order (none today; a new one is appended, never reordered).
  const ACL_FLAGS = Object.freeze(Object.keys(ACL_SCOPE).filter((k) => ACL_SCOPE[k] === 'room' && k !== 'roomLimit'));
  const aclSame = (a, n) => !!a && n.l === a.l && n.f === (a.f | 0);
  // aclAdd(acl, grants) -> the ACL with a right's room-scoped line items ORed in (the same object when nothing is new).
  // at: now (ms), kept as the ACL's `s` when its limit changes.
  function aclAdd(acl, grants, at) {
    const x = grantsOk(grants);
    if (!x) return acl || null;
    const a = acl || { l: DEFAULTS.roomLimit, f: 0 };
    let f = a.f | 0;
    ACL_FLAGS.forEach((k, i) => { if (x[k] === true) f |= (1 << i); });
    const n = { l: a.l === null || x.roomLimit === null ? null : Math.max(a.l | 0, x.roomLimit, DEFAULTS.roomLimit), f };
    if (aclSame(acl, n)) return acl;
    n.s = acl && n.l === acl.l && acl.s ? acl.s : (+at || 0);
    return n;
  }
  // aclJoin(a, b) -> the union of two ACLs (a itself when b adds nothing; null when both are none).
  function aclJoin(a, b) {
    if (!b) return a || null;
    if (!a) return b;
    const n = { l: a.l === null || b.l === null ? null : Math.max(a.l | 0, b.l | 0), f: (a.f | 0) | (b.f | 0) };
    if (aclSame(a, n)) return a;
    n.s = n.l === a.l ? a.s || 0 : b.s || 0;   // since: from the side that holds the limit now
    return n;
  }
  // aclLimit(acl) -> the room's people limit from its ACL: a number, or null (no limit). No ACL: the DEFAULTS' limit.
  const aclLimit = (acl) => (acl ? (acl.l === null ? null : Math.max(acl.l | 0, DEFAULTS.roomLimit)) : DEFAULTS.roomLimit);
  // aclView(acl) -> what the License view shows: the permissions the room holds, never a plan, a name or a ticket:
  // {limit (null = no people limit), none (no permission shown yet: the default rule applies), since (ms, or null)}.
  const aclView = (acl) => ({ limit: aclLimit(acl), none: !acl || (acl.l !== null && (acl.l | 0) <= DEFAULTS.roomLimit && !(acl.f | 0)), since: acl && acl.s ? acl.s : null });
  // aclHas(acl, item) -> whether the room holds a room-scoped flag (a holder-scoped word is never the room's).
  const aclHas = (acl, item) => !!acl && ACL_FLAGS.indexOf(item) >= 0 && ((acl.f | 0) & (1 << ACL_FLAGS.indexOf(item))) !== 0;

  GifOS.sub = {
    ACL_FLAGS, ACL_SCOPE, aclAdd, aclJoin, aclLimit, aclHas, aclView,
    TIERS, TIER_IDS, PERIODS, NEGOTIATED, ADDONS, usd, covers, upgradeOk, upgradeCharge, APP_TIERS, tiersSoldIn, tiersListed, FREE, TEXT, PEOPLE_LIMIT, LICENSE_KIND, SELLER, KEY_RE, edKeyOk, edKeyWeak, edSigWeak, edVerify, SUB_ID_RE, ASK_WINDOW_S,
    FREE_PLAN, FREE_LIMIT, PLANS, PLAN_IDS, isPlan, isPaid,
    checkLicense, verifyLicense, rightsOf, storageAfterLapse, proofMessage, verifyProof, askMessage, askFresh,
    admission, roomContext, doorContext, roomTierOf, clearNoPwRight, clearStageNoPwRight, credId, doorVerdict, doorProofOk,
    TICKET_KIND, TICKET_S, RENEW_EVERY_S, meetingTag, checkTicket, verifyTicket, ticketRights,
    PASS_KIND, passSeconds, PASS_PLAN, PASS_PRICE, PASS_VALUE, ORDER_ID_RE, PASS_ID_RE, passMessage, checkPass, passLive, passEnd, verifyPass,
    passStart, passRights, meetingRight, heldRights, rank, rightsJson,
    ROOM_LIMIT_MAX, MEETINGS_MAX, AGENT_HOST_MAX, OVERFLOWS, GRANT_WORDS, OPTIONAL_WORDS, LEGACY_WORDS, DEFAULTS, effective, grantsOk, parseGrantList, grantsRights, ownTicketGrants, fullFreeWords, PASS_PRESETS, presetPass, revokedSet, rightRevoked, captureRight, captureTicket,
    PASS_TICKET_KIND, PASS_REC_RE, passRecId, passTicketMessage, passChain, checkPassTicket, verifyPassTicket, isPassTicket,
    WALLET_KIND, walletOk,
    CRED_KIND, credentialOk, credentialFiles, credentialFromFiles, walletFromFiles,
    PASS_VIAS, STORE_IDS, storeProduct, storeSku, tipPlan, tipSingle, tipOneSheet, storeSubId, storeOrderId, accountUuid,
  };
})(typeof window !== 'undefined' ? window : globalThis);
