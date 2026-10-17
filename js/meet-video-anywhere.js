/*
 * meet-video-anywhere.js — the rules of Video Anywhere in a meeting.
 *
 * Video Anywhere lets video cross between networks that block direct
 * connections, in a room whose admin holds a Video Anywhere receipt:
 *
 *   - The admin buys a month (and top-ups) from the payment service. The
 *     receipt names the admin room's own public key as the buyer, and only
 *     that key can present it.
 *   - At launch the admin signs a short room ticket { v:1, room, receiptId,
 *     end } and sends { receipt, ticket } to the room as an admin-signed
 *     message over the meeting's own encrypted channels. Every page checks
 *     the payment service's signature, the period and the admin key.
 *   - A page at the end of a crossing that cannot be reached directly shows
 *     the receipt and ticket to the credential service for that crossing
 *     (a "bridge"), and the pair then carries video as well as voice. Any
 *     refusal leaves the pair on the free voice-only path.
 *   - Hours count only while video crosses networks; the admin sees the
 *     count on their own screen.
 *
 * Everything here is a pure decision with its clock passed in, so it runs
 * the same in a page and in Node.
 */
(function (root) {
  'use strict';

  const BASE_PRODUCT = 'va-month';
  const TOPUP_PRODUCT = 'va-topup';
  const SELLER = 'gifos.app';
  const APP = 'meet';
  const TICKET_S = 12 * 3600;      // a room ticket lasts at most 12 hours
  const MIN_LEFT_S = 60;           // the credential service wants at least this long left
  const RESIGN_BEFORE_S = 3600;    // the admin signs a fresh ticket when less than this is left
  const METER_EVERY_MS = 60000;    // the admin's meter asks this often
  const TOPUP_MARK_HOURS = 2;      // below this many hours left, offer a top-up
  const TX_RE = /^[A-Za-z0-9._:-]{1,64}$/;
  const KEY_RE = /^[A-Za-z0-9+/]{43}=$/;
  // Refusals that asking again with the same receipt and ticket cannot fix.
  // A new launch order (a fresh ticket, or a top-up) starts the pair again.
  const FINAL_REFUSALS = ['paid-closed', 'paid-bad-receipt', 'paid-bad-ticket', 'allowance-used', 'bad-request'];

  const TEXT = {
    explain: 'Your Video Anywhere hours count only while video has to cross between networks that block direct connections. Meetings where everyone connects directly use none.',
    notCounting: 'Not counting: everyone here connects directly.',
    zero: 'Your Video Anywhere hours for this period are used up. Video across networks stops within 10 minutes; voices continue. You are never billed afterwards.',
    topUp: 'Your Video Anywhere hours are running low. A top-up adds hours without interrupting the meeting.',
    // On a tile whose video the network blocks, for everyone who sees that tile.
    blockedTile: 'Your network or theirs (often a work VPN or office network) blocks direct video between you. Getting video across it means sending it through our servers, which costs us real money, so this meeting needs Video Anywhere. Voices still come through.',
  };
  const people = (n) => n + (n === 1 ? ' person' : ' people');
  const countingText = (n) => 'Counting: video is crossing networks for ' + people(n) + '.';
  const waitingText = (n) => 'Video from ' + people(n) + ' starts when the meeting’s admin arrives.';

  const intS = (v) => Number.isInteger(v);

  // checkReceipt(r, nowS) → the parsed base receipt, or null. r is the
  // PARSED receipt (its signature is checked by the caller). The same field
  // rules the credential service applies: a GifOS Meeting month, sold by
  // gifos.app, naming its buyer's key, with time left.
  function checkReceipt(r, nowS) {
    if (!r || typeof r !== 'object') return null;
    if (r.kind !== 'gifos-pay-receipt' || r.appId !== APP || r.payeeId !== SELLER) return null;
    if (r.product !== BASE_PRODUCT || r.productKind !== 'base') return null;
    if (typeof r.tx !== 'string' || !TX_RE.test(r.tx)) return null;
    if (typeof r.buyerKey !== 'string' || !KEY_RE.test(r.buyerKey)) return null;
    if (!(typeof r.hours === 'number' && r.hours > 0)) return null;
    if (!intS(r.periodEnd) || !(nowS + MIN_LEFT_S < r.periodEnd)) return null;
    return r;
  }

  // checkTopup(t, base) → the parsed top-up receipt when it adds to that
  // base receipt, or null.
  function checkTopup(t, base) {
    if (!t || !base || typeof t !== 'object') return null;
    if (t.kind !== 'gifos-pay-receipt' || t.appId !== APP || t.payeeId !== SELLER) return null;
    if (t.product !== TOPUP_PRODUCT || t.productKind !== 'topup') return null;
    if (t.baseReceiptId !== base.tx || typeof t.tx !== 'string' || !TX_RE.test(t.tx)) return null;
    if (!(typeof t.hours === 'number' && t.hours > 0)) return null;
    return t;
  }

  // ticketFor(room, receipt, nowS, lifeS) → the room ticket to sign
  // { v:1, room, receiptId, end }, or null when the period has too little
  // time left. end = the earlier of now + 12 hours and the period's end.
  function ticketFor(room, receipt, nowS, lifeS) {
    if (!room || !receipt || !intS(nowS)) return null;
    const life = intS(lifeS) && lifeS > 0 ? Math.min(lifeS, TICKET_S) : TICKET_S;
    const end = Math.min(nowS + life, receipt.periodEnd);
    if (!(end - nowS >= MIN_LEFT_S)) return null;
    return { v: 1, room: String(room), receiptId: receipt.tx, end };
  }
  // The exact string the admin signs (fixed key order).
  function ticketJson(t) { return JSON.stringify({ v: t.v, room: t.room, receiptId: t.receiptId, end: t.end }); }

  // checkTicket(o, pub, receipt, room, nowS) → 'live' | 'ended' | null.
  // o is the PARSED signed ticket, pub the key that signed it (checked by the
  // caller). Only the key that bought the receipt may present it. 'ended':
  // a genuine ticket for this room whose time is up while the period still
  // runs, which marks a paid room whose admin has not renewed it.
  function checkTicket(o, pub, receipt, room, nowS) {
    if (!o || !receipt || o.v !== 1) return null;
    if (pub !== receipt.buyerKey) return null;
    if (o.room !== room || o.receiptId !== receipt.tx || !intS(o.end)) return null;
    if (o.end - nowS >= MIN_LEFT_S) return 'live';
    return 'ended';
  }

  // needsResign(ticketEnd, nowS) → should the admin sign a fresh ticket?
  function needsResign(ticketEnd, nowS) { return !intS(ticketEnd) || ticketEnd - nowS < RESIGN_BEFORE_S; }

  // better(a, b) → the order a page keeps of two checked orders
  // ({ end, ts }): the later ticket end, then the later signing time.
  function better(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    if (b.end !== a.end) return b.end > a.end ? b : a;
    return (b.ts || 0) > (a.ts || 0) ? b : a;
  }

  // roomState(f) → 'live' | 'waiting' | 'free'.
  // f = { order: 'live' | 'ended' | null (the best order this page holds),
  //       paidUntil: unix seconds this page last knew the room paid until,
  //       nowS }
  //   live     video may cross networks now
  //   waiting  a paid room whose admin has not (yet, or again) launched it
  //   free     nothing known: a free room
  function roomState(f) {
    if (!f) return 'free';
    if (f.order === 'live') return 'live';
    if (f.order === 'ended') return 'waiting';
    if (intS(f.paidUntil) && f.paidUntil > f.nowS) return 'waiting';
    return 'free';
  }

  // bridgeIdFor(a, b) → a stable id for the crossing between two pages: both
  // ends compute the same id, so the credential service counts the crossing
  // once. Until the seating names real bridges, a bridge is a pair of pages.
  function bridgeIdFor(a, b) {
    const ids = [String(a), String(b)].sort();
    const text = ids[0] + '|' + ids[1];
    // two FNV-1a 32-bit hashes with different seeds: 16 hex digits
    let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ c, 0x01000193) >>> 0;
    }
    return 'p-' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  }

  // haltsOn(reason) → true when a paid refusal is final for this order.
  function haltsOn(reason) { return FINAL_REFUSALS.indexOf(String(reason)) >= 0; }

  // wantPaid(f) → should this page ask for the paid pool on this pair?
  // f = { room: roomState, blocked: this page cannot be reached directly,
  //       onTurn: this page already put TURN on this pair, bridge: an id }
  // Only the end that cannot be reached asks (never double TURN), only on a
  // pair already on the free path, only in a live paid room.
  function wantPaid(f) {
    return !!(f && f.room === 'live' && f.blocked && f.onTurn && typeof f.bridge === 'string' && f.bridge.length > 0);
  }

  // farPaid(f) → may the reachable end send video on a pair the far end says
  // is paid? f = { said: the far end said so, room: roomState }. The far end's
  // word alone is not enough: this page must hold a live order too.
  function farPaid(f) { return !!(f && f.said && f.room === 'live'); }

  // peopleCounting(countingNow, people) → N for the meter line: the people
  // known to be on a paid crossing, and at least one while the count runs
  // (their status may not have reached the admin yet).
  function peopleCounting(countingNow, ppl) {
    if (!countingNow) return 0;
    return Math.max(Number(ppl) || 0, 1);
  }

  // fmtHours(h) → "25 minutes", "1 hour", "29.8 hours".
  function fmtHours(h) {
    const v = Math.max(0, Number(h) || 0);
    if (v < 1) { const m = Math.round(v * 60); return m + (m === 1 ? ' minute' : ' minutes'); }
    const r = Math.round(v * 10) / 10;
    return (r === 1 ? '1 hour' : r + ' hours');
  }

  // topUpDue(left, usedThisMeeting) → offer a top-up? Below 2 hours left, or
  // fewer hours left than this meeting has used so far.
  function topUpDue(left, usedThisMeeting) {
    const l = Number(left) || 0, u = Number(usedThisMeeting) || 0;
    return l < TOPUP_MARK_HOURS || l < u;
  }

  // meterView(a, o) → what the admin's meter shows.
  // a = the service's answer { hoursTotal, hoursUsed, periodEnd, countingNow, bridgesNow }
  // o = { usedAtStart: hoursUsed at this meeting's first reading, people,
  //       firstOpen: the subscriber has never opened the meter before }
  function meterView(a, o) {
    if (!a || typeof a !== 'object' || !(Number(a.hoursTotal) >= 0)) return null;
    const opt = o || {};
    const total = Number(a.hoursTotal) || 0;
    const used = Math.min(total, Math.max(0, Number(a.hoursUsed) || 0));
    const left = Math.max(0, total - used);
    const start = Number(opt.usedAtStart);
    const thisMeeting = Number.isFinite(start) ? Math.max(0, used - start) : 0;
    const zero = left <= 0;
    const n = peopleCounting(!!a.countingNow && !zero, opt.people);
    return {
      total, used, left, thisMeeting, zero,
      periodEnd: intS(a.periodEnd) ? a.periodEnd : null,
      counting: n > 0, people: n,
      countingLine: n > 0 ? countingText(n) : TEXT.notCounting,
      topUp: topUpDue(left, thisMeeting),
      explain: !!opt.firstOpen,
    };
  }

  // tileBlocked(f) → does this tile show the blocked-video message instead of
  // a picture? f = {
  //   isMe         the page's own tile (never: it sees its own camera)
  //   camOn        the person's camera is on (a camera that is off is not blocked)
  //   pictureLive  frames from them are arriving on this tile now
  //   freePair     this page's pair with them is on the free voice-only path
  //   voiceCarry   a third person carries their voice to this page, and no picture
  //   inMixOnly    this page hears them only inside its anchor's mixed voice
  // } Only a voice that still comes through makes the message true ("Voices
  // still come through"); no voice at all is another state.
  function tileBlocked(f) {
    if (!f || f.isMe || !f.camOn || f.pictureLive) return false;
    return !!(f.freePair || f.voiceCarry || f.inMixOnly);
  }

  // tileButton(f) → the admin's one-tap button on a blocked tile, or null.
  // f = { amAdmin, adminRoom, terms: termsOf(...), sub }
  //   sub  'none' (no Video Anywhere month for this room), 'live' (a month
  //        with hours left) or 'zero' (a month whose hours ran out)
  // Prices come from the live terms; with no terms there is no button.
  function tileButton(f) {
    if (!f || !f.amAdmin || !f.adminRoom || !f.terms) return null;
    if (f.sub === 'live') return null; // paid for: the video is on its way
    if (f.sub === 'zero') {
      const t = f.terms.topup;
      return t ? { kind: 'topup', product: TOPUP_PRODUCT, price: t.price, label: 'Top up, ' + t.price } : null;
    }
    const m = f.terms.month;
    return m ? { kind: 'month', product: BASE_PRODUCT, price: m.price, label: 'Get Video Anywhere, ' + m.price + '/month' } : null;
  }

  // receiptQuery(claim, buyerKey, base) → the query that reads a GifOS
  // product's receipt (base: the parsed month a top-up adds to, or null).
  function receiptQuery(claim, buyerKey, base) {
    let q = 'claim=' + encodeURIComponent(claim) + '&id=' + SELLER + '&type=domain&buyerKey=' + encodeURIComponent(buyerKey);
    if (base) q += '&baseReceiptId=' + encodeURIComponent(base.tx) + '&basePeriodEnd=' + encodeURIComponent(String(base.periodEnd));
    return q;
  }

  // termsOf(body) → { month, topup } from the payment service's terms, each
  // { id, name, price, hours, periodDays } or null.
  function termsOf(body) {
    const out = { month: null, topup: null };
    const list = body && Array.isArray(body.products) ? body.products : [];
    for (const p of list) {
      if (!p || typeof p.price !== 'string' || !(typeof p.hours === 'number' && p.hours > 0)) continue;
      const t = { id: p.id, name: String(p.name || ''), price: p.price, hours: p.hours, periodDays: p.periodDays || null };
      if (p.id === BASE_PRODUCT) out.month = t;
      else if (p.id === TOPUP_PRODUCT) out.topup = t;
    }
    return out;
  }

  const api = {
    BASE_PRODUCT, TOPUP_PRODUCT, TICKET_S, MIN_LEFT_S, RESIGN_BEFORE_S, METER_EVERY_MS, TOPUP_MARK_HOURS, TEXT,
    countingText, waitingText, checkReceipt, checkTopup, ticketFor, ticketJson, checkTicket, needsResign, better,
    roomState, bridgeIdFor, haltsOn, wantPaid, farPaid, peopleCounting, fmtHours, topUpDue, meterView,
    receiptQuery, termsOf, tileBlocked, tileButton,
  };
  const GifOS = (root.GifOS = root.GifOS || {});
  GifOS.meetVA = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
