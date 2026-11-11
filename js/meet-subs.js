/*
 * meet-subs.js — GifOS subscriptions in the meeting page.
 *
 * Off unless switched on (#subs=1 in the link, or localStorage
 * 'gifos-subs' = '1'). While off, nothing here touches the page.
 *
 * What it does when on:
 *   - Settings gets a Subscription group: the plans (monthly or yearly),
 *     sign-up through PayPal, the current plan, Cancel, and the subscription
 *     file: download it, or use one brought from another browser.
 *   - Making an admin room needs a subscription (any plan).
 *   - ONE MEETING AT A TIME: joining a meeting (open or admin room) asks the
 *     payment service for a short ticket for that meeting. Joining another
 *     meeting, here or in any browser holding the same file, moves the
 *     subscription there; this meeting loses it within a few minutes.
 *     Payment is checked when a meeting is joined; a meeting that started
 *     paid keeps the subscription to its end.
 *   - The admin's ticket travels with the room (a signed room order), so the
 *     door knows the room's plan. In a room on the $2 plan (or one whose plan
 *     cannot be shown) that already holds 20 people, the door asks a newcomer
 *     to show a ticket for this meeting; without one they are told plainly
 *     and not let in. Rooms on the $5 and $10 plans have no limit.
 *
 * The subscription is a FILE: a GifOS GIF that provides the meeting
 * subscription (keep it in the Providers folder, or open it here in another
 * browser). It holds the subscription id and the seed of the subscriber's
 * key; whoever holds the file holds the subscription.
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});
  const TM = GifOS.timings || require('./timings.js');   // every wait and timeout: js/timings.js, loaded before this file (required where there is no page)
  const SUB = GifOS.sub;
  const STATE_KEY = 'gifos-sub-state';     // the last license and what PayPal said
  const CRED_KEY = 'gifos-sub-cred';       // this browser's copy of the subscription file's contents
  const POLL_MS = TM.SUBS_POLL_MS;
  const POLL_FOR_MS = TM.SUBS_POLL_FOR_MS;
  const RETRY_MS = TM.SUBS_RETRY_MS;                  // a renewal that could not reach the service tries again
  const REFRESH_BEFORE_S = TM.REFRESH_BEFORE_S;      // fetch a fresh license this long before it runs out

  // The switch in the link is read from the address the page was opened
  // with. Once the meeting page joins it rewrites its own address to the
  // room's plain link, which no longer carries #subs=1; reading only the
  // current address turned the switch off at that moment. A subs= word in
  // the current address still wins.
  const SWITCH_RE = /(?:^|[#&?])subs=[01](?:&|$)/;
  const opened = (() => { try { return { hash: String(root.location.hash || ''), search: String(root.location.search || '') }; } catch (e) { return null; } })();
  function switchFrom() {
    const cur = root.location;
    try { if (SWITCH_RE.test(String(cur.hash || '') + '&' + String(cur.search || ''))) return cur; } catch (e) {}
    return opened || cur;
  }
  const on = () => !!(SUB && SUB.enabled(switchFrom(), safeStore()));
  function safeStore() { try { return root.localStorage; } catch (e) { return null; } }
  const payBase = () => String(root.GIFOS_PAY_URL || 'https://pay.gifos.app').replace(/\/$/, '');
  const nowS = () => Math.floor(Date.now() / 1000);
  const b64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  function readJson(k) { try { return JSON.parse(safeStore().getItem(k) || 'null'); } catch (e) { return null; } }
  function writeJson(k, v) { try { if (v == null) safeStore().removeItem(k); else safeStore().setItem(k, JSON.stringify(v)); } catch (e) {} }
  const readState = () => readJson(STATE_KEY) || {};
  const writeState = (s) => writeJson(STATE_KEY, s || {});

  // ---- the subscription file -------------------------------------------------
  // This browser's credential, else one in the Providers folder of this
  // browser's Home Screen (recognised there only, like every provider).
  let provP = null;
  function fromProviders() {
    if (!provP) provP = (async () => {
      const st = GifOS.store, gif = GifOS.gif;
      if (!st || !st.allItems || !st.getFile || !gif) return null;
      const items = await st.allItems();
      for (const it of items || []) {
        if (!it || (it.parent || null) !== 'sys_providers' || it.kind !== 'file' || !it.fileId) continue;
        const f = await st.getFile(it.fileId).catch(() => null);
        if (!f || f.kind !== 'gif' || !f.bytes) continue;
        const bytes = f.bytes instanceof Uint8Array ? f.bytes : new Uint8Array(f.bytes);
        const arc = await gif.decode(bytes).catch(() => null);
        const c = arc && SUB.credentialFromFiles(arc.files);
        if (c) return c;
      }
      return null;
    })().catch(() => null);
    return provP;
  }
  async function credential() {
    const c = SUB.credentialOk(readJson(CRED_KEY));
    return c || (await fromProviders());
  }
  let keyMemo = { seed: null, p: null };
  async function myKey() {
    const c = await credential();
    if (!c) throw new Error('No subscription on this browser.');
    if (keyMemo.seed !== c.seed) {
      keyMemo = { seed: c.seed, p: GifOS.ed.keysFromSeed(fromB64(c.seed)).then((k) => ({ priv: k.priv, pub: b64(k.pubRaw) })) };
    }
    return keyMemo.p;
  }
  async function signText(text) {
    const k = await myKey();
    return b64(await GifOS.ed.sign(k.priv, new TextEncoder().encode(text)));
  }
  // Download: the file is built here from this browser's credential.
  async function fileBytes() {
    const c = await credential();
    if (!c) throw new Error('No subscription on this browser.');
    return GifOS.gif.encode(SUB.credentialFiles(c), { accent: [120, 200, 255] });
  }
  async function downloadFile() {
    const bytes = await fileBytes();
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/gif' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'GifOS subscription.gif';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  // Use a file brought from another browser. Its key must be the key the
  // subscription was made for (checked by the payment service on every ask).
  async function useFile(bytes) {
    const arc = await GifOS.gif.decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    const c = arc && SUB.credentialFromFiles(arc.files);
    if (!c) throw new Error('That file is not a GifOS subscription.');
    writeJson(CRED_KEY, c);
    writeState({ subId: c.subId, tier: c.tier, status: null });
    keyMemo = { seed: null, p: null };
    const st = await refresh();
    rejoin();
    return st;
  }

  // ---- the payment service's key and the license ------------------------------
  let payKeyP = null;
  function payKey() {
    if (!payKeyP) payKeyP = fetch('/gifos-pay.key').then(async (r) => {
      if (!r.ok) throw new Error('no /gifos-pay.key');
      const raw = fromB64((await r.text()).trim());
      if (raw.length !== 32) throw new Error('bad /gifos-pay.key');
      return raw;
    }).catch((e) => { payKeyP = null; throw e; });
    return payKeyP;
  }
  const verifyPay = async (sig, msg) => GifOS.ed.verify(await payKey(), sig, msg);
  const verifyKey = (pubB64, sig, msg) => GifOS.ed.verify(fromB64(pubB64), sig, msg);
  async function verifiedLicense(st) {
    st = st || readState();
    if (!st.licenseJson || !st.sig) return null;
    const lic = await SUB.verifyLicense({ licenseJson: st.licenseJson, sig: st.sig }, verifyPay, nowS()).catch(() => null);
    if (!lic) return null;
    try { if (lic.buyerKey !== (await myKey()).pub) return null; } catch (e) { return null; }
    return lic;
  }
  async function rights() {
    if (!on()) return Object.assign({}, SUB ? SUB.FREE : {});
    return SUB.rightsOf(await verifiedLicense(), nowS());
  }

  async function post(path, body) {
    const r = await fetch(payBase() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok && !(j && (j.moved || j.ended))) throw new Error((j && j.error) || ('The payment service answered ' + r.status + '.'));
    return j || {};
  }
  async function subIdNow() { const c = await credential(); return c ? c.subId : readState().subId; }
  async function signed(action, extra) {
    const subId = await subIdNow();
    const at = nowS();
    return Object.assign({ subId, buyerKey: (await myKey()).pub, at, sig: await signText(SUB.askMessage(action, subId, at)) }, extra || {});
  }
  // Ask the payment service for a fresh license; keep what it says.
  async function refresh() {
    if (!(await subIdNow())) return null;
    const j = await post('/gifos/sub/license', await signed('license'));
    const st = readState();
    const next = Object.assign({}, st, { subId: await subIdNow(), status: j.status, tier: j.tier || st.tier, until: j.until || null, checkedAt: Date.now() });
    if (j.active && j.licenseJson) { next.licenseJson = j.licenseJson; next.sig = j.sig; }
    else { delete next.licenseJson; delete next.sig; }
    writeState(next);
    return next;
  }
  async function keepFresh() {
    if (!(await credential())) return;
    const lic = await verifiedLicense();
    const st = readState();
    if (!lic || lic.exp - nowS() < REFRESH_BEFORE_S || st.status === 'APPROVAL_PENDING') { try { await refresh(); } catch (e) {} }
  }

  async function subscribe(tier, period, say) {
    const seed = new Uint8Array(32); crypto.getRandomValues(seed);
    const k = await GifOS.ed.keysFromSeed(seed);
    const buyerKey = b64(k.pubRaw);
    const popup = root.open('about:blank', 'gifos-sub', 'width=480,height=720');
    let j;
    try { j = await post('/gifos/sub/create', { tier, period, buyerKey }); }
    catch (e) { try { popup && popup.close(); } catch (x) {} throw e; }
    writeJson(CRED_KEY, { v: 1, kind: SUB.CRED_KIND, subId: j.id, tier, period, seed: b64(seed), buyerKey });
    keyMemo = { seed: null, p: null };
    writeState({ subId: j.id, tier, status: 'APPROVAL_PENDING' });
    if (popup) popup.location.href = j.approveUrl; else root.open(j.approveUrl, '_blank');
    say(SUB.TEXT.pending);
    const until = Date.now() + POLL_FOR_MS;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      let st = null; try { st = await refresh(); } catch (e) {}
      if (st && st.licenseJson) { rejoin(); return st; }
      if (st && st.status && st.status !== 'APPROVAL_PENDING' && st.status !== 'APPROVED') return st;
    }
    return readState();
  }
  async function cancel() {
    if (!(await subIdNow())) return readState();
    const j = await post('/gifos/sub/cancel', await signed('cancel'));
    writeState(Object.assign({}, readState(), { status: j.status, until: j.until }));
    try { await refresh(); } catch (e) {}
    return readState();
  }

  // ---- one meeting at a time --------------------------------------------------
  // meet: {room, tag, ticket:{ticketJson,sig}, exp, gen, joining, timer, moved}
  let meet = null;
  let hooks = {};
  function stopTimer() { if (meet && meet.timer) { clearTimeout(meet.timer); meet.timer = null; } }
  function schedule(ms) { stopTimer(); if (meet) meet.timer = setTimeout(renewNow, ms); }
  function take(j) {
    meet.ticket = { ticketJson: j.ticketJson, sig: j.sig }; meet.exp = j.exp; meet.gen = j.gen;
    schedule((j.renewEvery || SUB.RENEW_EVERY_S) * 1000);
    try { if (hooks.onTicket) hooks.onTicket(meet.ticket); } catch (e) {}
  }
  function lose(why) {
    if (!meet) return;
    stopTimer();
    meet.ticket = null; meet.moved = why;
    try { if (hooks.onLost) hooks.onLost(why); } catch (e) {}
  }
  async function renewNow() {
    const m = meet;
    if (!m || !m.ticket) return;
    try {
      const j = await post('/gifos/sub/renew', await signed('renew:' + m.tag + ':' + m.gen, { meeting: m.tag, gen: m.gen }));
      if (meet !== m) return;
      if (j.moved) return lose('moved');
      if (j.ended || !j.active) return lose('ended');
      take(j);
    } catch (e) {
      // Could not reach the service: keep the ticket while it lasts, ask again.
      if (meet === m) { if (nowS() >= (m.exp || 0)) lose('unreachable'); else schedule(RETRY_MS); }
    }
  }
  // joinMeeting(room, {onTicket, onLost}) — called as the page starts a meeting.
  // Payment is checked here, once; renewals only keep this meeting the newest.
  // A join that got no answer from the service (no subscription on this
  // browser yet, or no connection) is tried again on the next call: a page
  // that starts its meeting first and gets the subscription after (signing
  // up, or opening the subscription file) joins with it then.
  function joinMeeting(room, h) {
    if (!on()) return Promise.resolve(null);
    if (meet && meet.room === room && (meet.ticket || meet.moved || meet.pending)) return meet.joining;
    const keep = h || hooks;
    leaveMeeting();
    hooks = keep || {};
    const m = meet = { room, tag: null, ticket: null, exp: 0, gen: 0, timer: null, moved: null, joining: null, pending: true };
    m.joining = (async () => {
      if (!(await credential())) return null;
      m.tag = await SUB.meetingTag(room);
      const j = await post('/gifos/sub/join', await signed('join:' + m.tag, { meeting: m.tag }));
      if (meet !== m) return null;
      if (!j.active) { m.moved = 'inactive'; return null; }
      take(j);
      return m.ticket;
    })().catch(() => null).then((t) => { m.pending = false; return t; });
    return m.joining;
  }
  function leaveMeeting() { stopTimer(); meet = null; hooks = {}; }
  // The subscription on this browser changed (signed up, or a file opened):
  // the meeting this page is in joins with it now.
  function rejoin() { if (meet && !meet.ticket) { const room = meet.room; meet = null; joinMeeting(room); } }
  async function currentTicket(room) {
    if (!meet || meet.room !== room) return null;
    await meet.joining;
    return meet && meet.ticket && nowS() < meet.exp ? meet.ticket : null;
  }

  // ---- the room's plan and the door's challenge ----------------------------
  // The admin's order that carries their plan into the room, or null.
  async function roomOrder(room) {
    if (!on()) return null;
    const ticket = await currentTicket(room);
    if (!ticket) return null;
    const at = Date.now();
    return { on: true, at, ticket, proof: await signText(SUB.proofMessage(SUB.roomContext(room), 'at:' + at)) };
  }
  // The room's plan from the order the room carries: {tier, exp} or null.
  async function roomTier(order, room) {
    try { return await SUB.roomTierOf(order, room, verifyPay, verifyKey, nowS()); } catch (e) { return null; }
  }
  // A knocker answering the door's challenge, or null without a ticket here.
  async function proveAtDoor(room, nonce) {
    if (!on()) return null;
    const ticket = await currentTicket(room);
    if (!ticket) return null;
    return { ticket, proof: await signText(SUB.proofMessage(SUB.doorContext(room), nonce)) };
  }
  // The door checking a knocker's answer.
  async function checkShown(shown, room, nonce) {
    try { return !!(await SUB.doorProofOk(shown, room, nonce, verifyPay, verifyKey, nowS())); } catch (e) { return false; }
  }
  const newNonce = () => { const u = new Uint8Array(18); crypto.getRandomValues(u); return 'n' + b64(u).replace(/[+/=]/g, ''); };

  // ---- Settings: the Subscription group ---------------------------------------
  const BTN = 'seg';
  const BTN_STYLE = 'border:1px solid var(--border,#2a2a3f);border-radius:.4rem;margin:.2rem .4rem .2rem 0';
  function el(tag, attrs, text) { const e = document.createElement(tag); for (const k in (attrs || {})) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
  const dateOf = (s) => { try { return new Date(s * 1000).toLocaleDateString(); } catch (e) { return ''; } };
  async function paintSettings() {
    if (!on()) return;
    const body = document.querySelector('#set-modal .dlg-body');
    if (!body) return;
    let g = document.getElementById('set-g-sub');
    if (!g) {
      g = el('section', { class: 'set-group', id: 'set-g-sub' });
      const dbg = document.getElementById('set-g-debug');
      body.insertBefore(g, dbg || null);
    }
    g.textContent = '';
    g.appendChild(el('h4', null, 'Subscription'));
    const row = el('div', { class: 'set-row set-wide' });
    g.appendChild(row);
    const msg = el('p', { class: 'set-help', id: 'sub-msg', role: 'status', 'aria-live': 'polite' });
    const say = (t) => { msg.textContent = t || ''; };
    await keepFresh();
    const lic = await verifiedLicense();
    const st = readState();
    const cred = await credential();
    if (lic) {
      const t = SUB.TIERS[lic.tier];
      const yearly = cred && cred.period === 'yearly';
      row.appendChild(el('p', { class: 'set-help' }, 'Your plan: ' + t.name + ' (' + (yearly ? t.priceYear + ' a year' : t.price + ' a month') + ').'));
      row.appendChild(el('p', { class: 'set-help' }, st.status === 'CANCELLED' ? SUB.TEXT.cancelled + ' Ends ' + dateOf(st.until || lic.exp) + '.' : 'Renews through PayPal.'));
      row.appendChild(el('p', { class: 'set-help' }, 'Your subscription works in one meeting at a time. Joining a meeting, here or in another browser with your subscription file, moves it there.'));
      if (meet && meet.moved === 'moved') row.appendChild(el('p', { class: 'set-help' }, 'It is in use in another meeting now.'));
      if (st.status !== 'CANCELLED') {
        const c = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-cancel' }, 'Cancel subscription');
        c.onclick = async () => {
          c.disabled = true; say('Cancelling…');
          try { await cancel(); say(SUB.TEXT.cancelled); paintSettings(); } catch (e) { c.disabled = false; say(String(e.message || e)); }
        };
        row.appendChild(c);
      }
    } else {
      if (st.subId && st.status && st.status !== 'APPROVAL_PENDING') row.appendChild(el('p', { class: 'set-help' }, SUB.TEXT.lapsed));
      row.appendChild(el('p', { class: 'set-help' }, 'Open rooms are free. A subscription adds rooms you run as admin, and video for people whose networks block direct connections.'));
      for (const period of ['monthly', 'yearly']) {
        for (const id of SUB.TIER_IDS) {
          const t = SUB.TIERS[id];
          const label = (period === 'yearly' ? t.priceYear + ' a year' : t.price + ' a month') + ': ' + t.name;
          const b = el('button', { type: 'button', class: BTN, style: BTN_STYLE, 'data-tier': id, 'data-period': period }, label);
          b.onclick = async () => {
            for (const x of row.querySelectorAll('button[data-tier]')) x.disabled = true;
            say('Opening PayPal…');
            try {
              const r = await subscribe(id, period, say);
              say(r && r.licenseJson ? 'You are subscribed. Thank you. Download your subscription file to keep it safe.' : r && r.status === 'APPROVAL_PENDING' ? SUB.TEXT.pending : 'PayPal did not confirm the subscription.');
              paintSettings();
            } catch (e) {
              say(String(e.message || e));
              for (const x of row.querySelectorAll('button[data-tier]')) x.disabled = false;
            }
          };
          row.appendChild(b);
        }
      }
    }
    // The subscription file: download it, or use one from another browser.
    if (cred) {
      const d = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-file-get' }, 'Download subscription file');
      d.onclick = () => { downloadFile().then(() => say('Saved. Keep it private: anyone with the file can use your subscription.'), (e) => say(String(e.message || e))); };
      row.appendChild(d);
    }
    const pick = el('input', { type: 'file', accept: 'image/gif,.gif', id: 'sub-file-use', 'aria-label': 'Use a subscription file' });
    pick.onchange = async () => {
      const f = pick.files && pick.files[0];
      if (!f) return;
      say('Reading the file…');
      try {
        const r = await useFile(new Uint8Array(await f.arrayBuffer()));
        say(r && r.licenseJson ? 'This browser now uses your subscription. It works in one meeting at a time.' : 'The file was read, but the subscription is not active.');
        paintSettings();
      } catch (e) { say(String(e.message || e)); }
    };
    const lab = el('label', { class: 'set-help', style: 'display:block;margin-top:.4rem' }, 'Use a subscription file from another browser: ');
    lab.appendChild(pick);
    row.appendChild(lab);
    row.appendChild(msg);
  }
  function openSettings() {
    const b = document.getElementById('setbtn');
    if (b) b.click();
    setTimeout(() => { const g = document.getElementById('set-g-sub'); if (g && g.scrollIntoView) g.scrollIntoView({ block: 'start' }); }, 50);
  }

  // ---- admin rooms: making one -------------------------------------------------
  // mayCreateAdminRoom(say) -> true when the switch is off or any plan is held.
  async function mayCreateAdminRoom(say) {
    if (!on()) return true;
    const r = await rights();
    if (r.adminRooms) return true;
    if (say) say(SUB.TEXT.needForAdmin);
    openSettings();
    return false;
  }

  // Shown instead of the meeting when the room is full for this person.
  function showFull() {
    const m = document.getElementById('left-modal');
    const t = document.getElementById('left-title');
    const n = document.getElementById('left-note');
    if (t) t.textContent = 'This meeting is full';
    if (n) n.textContent = SUB.TEXT.full;
    if (m && !document.getElementById('sub-full-go')) {
      const b = el('button', { type: 'button', id: 'sub-full-go' }, 'Subscribe');
      b.onclick = () => { m.style.display = 'none'; openSettings(); };
      const box = m.querySelector('.name-box');
      if (box) box.insertBefore(b, box.querySelector('#left-rejoin'));
    }
    if (m) m.style.display = 'flex';
  }

  function boot() {
    if (!on()) return;
    const b = document.getElementById('setbtn');
    if (b) b.addEventListener('click', () => { paintSettings().catch(() => {}); });
    keepFresh().catch(() => {});
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }

  GifOS.meetSubs = {
    enabled: on, rights, refresh, subscribe, cancel, paintSettings, openSettings, mayCreateAdminRoom, showFull,
    roomOrder, roomTier, proveAtDoor, checkShown, newNonce,
    joinMeeting, leaveMeeting, currentTicket, fileBytes, downloadFile, useFile,
    meeting: () => (meet ? { room: meet.room, gen: meet.gen, exp: meet.exp, moved: meet.moved, held: !!meet.ticket } : null),
  };
})(typeof window !== 'undefined' ? window : globalThis);
