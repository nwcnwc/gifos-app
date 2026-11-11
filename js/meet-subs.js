/*
 * meet-subs.js — GifOS subscriptions in the meeting page.
 *
 * Off unless switched on (#subs=1 in the link, or localStorage
 * 'gifos-subs' = '1'). While off, nothing here touches the page.
 *
 * What it does when on:
 *   - Settings gets a Subscription group: the three plans, sign-up through
 *     PayPal, the current plan and when it renews or ends, and Cancel.
 *   - Making an admin room needs a subscription (any plan).
 *   - Entering an admin room that already holds 20 people needs a
 *     subscription; without one the person is told plainly and not let in.
 *
 * The subscriber's key is made in this browser and can never be read out of
 * it (WebCrypto, not extractable). The license the payment service signs
 * names that key; it is checked here against /gifos-pay.key.
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});
  const SUB = GifOS.sub;
  const STATE_KEY = 'gifos-sub-state';
  const DB = 'gifos-sub';
  const POLL_MS = 3000;
  const POLL_FOR_MS = 15 * 60 * 1000;
  const REFRESH_BEFORE_S = 7 * 86400;   // fetch a fresh license this long before it runs out

  const on = () => !!(SUB && SUB.enabled(root.location, safeStore()));
  function safeStore() { try { return root.localStorage; } catch (e) { return null; } }
  const payBase = () => String(root.GIFOS_PAY_URL || 'https://pay.gifos.app').replace(/\/$/, '');
  const nowS = () => Math.floor(Date.now() / 1000);
  const b64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  function readState() { try { return JSON.parse(safeStore().getItem(STATE_KEY) || 'null') || {}; } catch (e) { return {}; } }
  function writeState(s) { try { safeStore().setItem(STATE_KEY, JSON.stringify(s || {})); } catch (e) {} }

  // ---- the subscriber's key (kept in IndexedDB, never readable) -------------
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('k');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbGet(k) { const d = await idb(); return new Promise((res, rej) => { const q = d.transaction('k').objectStore('k').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); }
  async function idbPut(k, v) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction('k', 'readwrite'); t.objectStore('k').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
  let keyP = null;
  function myKey() {
    if (!keyP) keyP = (async () => {
      let k = await idbGet('key');
      if (!k) {
        if (!GifOS.ed || !GifOS.ed.generateSealed) throw new Error('This browser cannot hold a subscription key.');
        const g = await GifOS.ed.generateSealed();
        k = { priv: g.priv, pub: b64(g.pubRaw) };
        await idbPut('key', k);
      }
      return k;
    })().catch((e) => { keyP = null; throw e; });
    return keyP;
  }
  async function signText(text) {
    const k = await myKey();
    return b64(await GifOS.ed.sign(k.priv, new TextEncoder().encode(text)));
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
  async function verifiedLicense(st) {
    st = st || readState();
    if (!st.licenseJson || !st.sig) return null;
    let pub; try { pub = await payKey(); } catch (e) { return null; }
    const lic = await SUB.verifyLicense({ licenseJson: st.licenseJson, sig: st.sig }, (sig, msg) => GifOS.ed.verify(pub, sig, msg), nowS());
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
    if (!r.ok) throw new Error((j && j.error) || ('The payment service answered ' + r.status + '.'));
    return j;
  }
  async function signed(action, subId) {
    const at = nowS();
    return { subId, buyerKey: (await myKey()).pub, at, sig: await signText(SUB.askMessage(action, subId, at)) };
  }
  // Ask the payment service for a fresh license; keep what it says.
  async function refresh() {
    const st = readState();
    if (!st.subId) return null;
    const j = await post('/gifos/sub/license', await signed('license', st.subId));
    const next = Object.assign({}, st, { status: j.status, tier: j.tier || st.tier, until: j.until || null, checkedAt: Date.now() });
    if (j.active && j.licenseJson) { next.licenseJson = j.licenseJson; next.sig = j.sig; }
    else { delete next.licenseJson; delete next.sig; }
    writeState(next);
    return next;
  }
  async function keepFresh() {
    const lic = await verifiedLicense();
    const st = readState();
    if (st.subId && (!lic || lic.exp - nowS() < REFRESH_BEFORE_S || st.status === 'APPROVAL_PENDING')) { try { await refresh(); } catch (e) {} }
  }

  async function subscribe(tier, say) {
    const k = await myKey();
    const popup = root.open('about:blank', 'gifos-sub', 'width=480,height=720');
    let j;
    try { j = await post('/gifos/sub/create', { tier, buyerKey: k.pub }); }
    catch (e) { try { popup && popup.close(); } catch (x) {} throw e; }
    writeState({ subId: j.id, tier, status: 'APPROVAL_PENDING' });
    if (popup) popup.location.href = j.approveUrl; else root.open(j.approveUrl, '_blank');
    say(SUB.TEXT.pending);
    const until = Date.now() + POLL_FOR_MS;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      let st = null; try { st = await refresh(); } catch (e) {}
      if (st && st.licenseJson) return st;
      if (st && st.status && st.status !== 'APPROVAL_PENDING' && st.status !== 'APPROVED') return st;
    }
    return readState();
  }
  async function cancel() {
    const st = readState();
    if (!st.subId) return st;
    const j = await post('/gifos/sub/cancel', await signed('cancel', st.subId));
    writeState(Object.assign({}, st, { status: j.status, until: j.until }));
    try { await refresh(); } catch (e) {}
    return readState();
  }

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
    if (lic) {
      const t = SUB.TIERS[lic.tier];
      row.appendChild(el('p', { class: 'set-help' }, 'Your plan: ' + t.name + ' (' + t.price + ' a month).'));
      row.appendChild(el('p', { class: 'set-help' }, st.status === 'CANCELLED' ? SUB.TEXT.cancelled + ' Ends ' + dateOf(st.until || lic.exp) + '.' : 'Renews through PayPal. This device is covered until ' + dateOf(lic.exp) + '.'));
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
      for (const id of SUB.TIER_IDS) {
        const t = SUB.TIERS[id];
        const b = el('button', { type: 'button', class: BTN, style: BTN_STYLE, 'data-tier': id }, t.price + ' a month: ' + t.name);
        b.onclick = async () => {
          for (const x of row.querySelectorAll('button[data-tier]')) x.disabled = true;
          say('Opening PayPal…');
          try {
            const r = await subscribe(id, say);
            say(r && r.licenseJson ? 'You are subscribed. Thank you.' : r && r.status === 'APPROVAL_PENDING' ? SUB.TEXT.pending : 'PayPal did not confirm the subscription.');
            paintSettings();
          } catch (e) {
            say(String(e.message || e));
            for (const x of row.querySelectorAll('button[data-tier]')) x.disabled = false;
          }
        };
        row.appendChild(b);
      }
    }
    row.appendChild(msg);
  }
  function openSettings() {
    const b = document.getElementById('setbtn');
    if (b) b.click();
    setTimeout(() => { const g = document.getElementById('set-g-sub'); if (g && g.scrollIntoView) g.scrollIntoView({ block: 'start' }); }, 50);
  }

  // ---- admin rooms: making one, entering one ----------------------------------
  // mayCreateAdminRoom(say) -> true when the switch is off or any plan is held.
  async function mayCreateAdminRoom(say) {
    if (!on()) return true;
    const r = await rights();
    if (r.adminRooms) return true;
    if (say) say(SUB.TEXT.needForAdmin);
    openSettings();
    return false;
  }
  // The knock answer at the door of an admin room. Returns the admission
  // verdict; the page keeps going unless admit is false and wait is not set.
  let lastRights = null;
  async function entryCheck(frame, o) {
    if (!on()) return { admit: true, why: 'off' };
    if (!lastRights) lastRights = await rights();
    return SUB.admission({
      adminRoom: !!o.adminRoom,
      roomTier: o.roomTier || null,
      listLength: frame && Array.isArray(frame.list) ? frame.list.length : undefined,
      hold: !!(frame && frame.hold),
      entrant: { isAdmin: !!o.isAdmin, rights: lastRights },
    });
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
    rights().then((r) => { lastRights = r; }).catch(() => {});
    keepFresh().then(() => rights()).then((r) => { lastRights = r; }).catch(() => {});
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }

  GifOS.meetSubs = { enabled: on, rights, refresh, subscribe, cancel, paintSettings, openSettings, mayCreateAdminRoom, entryCheck, showFull };
})(typeof window !== 'undefined' ? window : globalThis);
