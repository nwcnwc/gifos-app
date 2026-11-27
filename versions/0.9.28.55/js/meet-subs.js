/*
 * meet-subs.js — GifOS subscriptions in the meeting page.
 *
 * THE LOGIC ONLY (THINPAGE G5): no screen here. The cards (Settings group, full-room / move / overflow / host prompts, the
 * lobby link) are js/core/view/subs.js, loaded right after this file by every page that has a screen; they reach this
 * file through GifOS.meetSubs and this file reaches them only through the view port (attachView).
 *
 * Always on (0.9.26.13): every meeting page has subscriptions.
 *
 * What it does:
 *   - Settings gets a Subscription group: the plans (monthly or yearly),
 *     sign-up through PayPal, the current plan, Cancel, and the subscription
 *     file: download it, or use one brought from another browser.
 *   - Making an admin room: anyone may (Nathan 2026-11-11). Without a plan
 *     the room has the defaults every verifier applies when no signed right
 *     is shown (Free is no plan at all): up to 5 people. When the door turns
 *     someone away for that, the host sees a one-tap "Subscribe for up to 20".
 *   - MEETINGS AT ONCE (the plan's `meetings` line item, 1 unless it says
 *     more): joining a meeting (open or admin room) asks the payment service
 *     for a short ticket for that meeting. Joining one more meeting than the
 *     plan allows, here or in any browser holding the same file, drops the
 *     oldest joined; that meeting loses it within a few minutes.
 *     Payment is checked when a meeting is joined; a meeting that started
 *     paid keeps the subscription to its end.
 *   - The admin's ticket travels with the room (a signed room order), so the
 *     door knows the room's plan. In a room on the $2 plan that already
 *     holds 20 people (5 with no plan, or when the room's plan cannot be
 *     shown), the door asks a newcomer to show a ticket for this meeting;
 *     without one they are told plainly and not let in. Rooms on the $5 and
 *     $10 plans have no limit, and open rooms never have one.
 *   - WHICH APP (Nathan 2026-11-13): the Meet app offers Room 20, Unlimited,
 *     the four-hour pass and tips. The $10 Streamer plan is sold in the
 *     Broadcast app (the broadcast page, /cast or cast.html) and on
 *     the plans page /subscription (2026-11-25); its library (My library,
 *     files.gifos.app) is managed in the Broadcast app. Meet honors a
 *     Streamer subscription with everything Unlimited gives, but never
 *     sells it and never shows its files (appNow, SUB.tiersSoldIn).
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
  // THE VIEW PORT. This file is the subscription's LOGIC and has no screen: no document, no element, no alert. Where
  // a decision needs a person to see or answer something it asks the view the page registered (js/core/view/subs.js:
  // attachView({ canChoose, askMove, overflowNote, away, changed, download, broadcast })). With no view attached (a
  // host with no screen, a tool) every call is a quiet no-op and nobody is asked.
  let view = {};
  function attachView(v) { view = Object.assign({}, v); }
  function viewCall(name, a, b) { try { return view[name] ? view[name](a, b) : undefined; } catch (e) { return undefined; } }
  // A host with no page (the core in Node: js/core/node.js sets GifOS.host.page false before this file runs) has the
  // subscription, its tickets and captures, and none of the cards, dialogs or Settings group: every page part stays off.
  const NOPAGE = !!(GifOS.host && GifOS.host.page === false);
  const STATE_KEY = 'gifos-sub-state';     // the last license and what PayPal said
  const CRED_KEY = 'gifos-sub-cred';       // this browser's copy of the subscription file's contents
  const WALLET_KEY = 'gifos-pass-wallet';  // this browser's four-hour passes and their key (passes.json in the subscription file)
  const WALLET_HISTORY_KEY = 'gifos-pass-wallets-old';   // wallets a file with another key replaced: kept, never removed
  // New words read the meeting's catalog (i18n/<lang>/meet.json); English stays beside the call.
  const tx = (key, en) => { try { const L = GifOS.i18n; if (L && L.ui() !== 'en' && L.has('meet.' + key)) return L.t('meet.' + key); } catch (e) {} return en; };
  const POLL_MS = TM.SUBS_POLL_MS;
  const POLL_FOR_MS = TM.SUBS_POLL_FOR_MS;
  const RETRY_MS = TM.SUBS_RETRY_MS;                  // a renewal that could not reach the service tries again
  const REFRESH_BEFORE_S = TM.REFRESH_BEFORE_S;      // fetch a fresh license this long before it runs out

  // The address the page was opened with. Once the meeting page joins it
  // rewrites its own address to the room's plain link, so the page in the
  // address (/cast, cast.html) is read from both.
  const opened = (() => { try { return { path: String(root.location.pathname || ''), hash: String(root.location.hash || ''), search: String(root.location.search || '') }; } catch (e) { return null; } })();
  // In the GifOS Meet apps everything is paid for through the store's own
  // purchase sheet (gifos-store-rail.js): the one rail there. RAIL() is null
  // in a browser.
  // The Broadcast app is the broadcast page, /cast or cast.html (js/core/link.js);
  // everything else is the Meet app. Read from the address the page was
  // opened with as well as the current one.
  const castIn = (path, hash) => { try { return !!(root.GifOSLink && root.GifOSLink.read(path, '', hash).cast); } catch (e) { return false; } };
  function appNow() {
    try { if (viewCall('broadcast') === true) return 'broadcast'; } catch (e) {}   // the view reports the skin the page wears
    try {
      const cur = root.location;
      if (castIn(String(cur.pathname || ''), String(cur.hash || ''))) return 'broadcast';
      if (opened && castIn(opened.path, opened.hash)) return 'broadcast';
    } catch (e) {}
    return 'meet';
  }
  const RAIL = () => (GifOS.storeRail && GifOS.storeRail.present() ? GifOS.storeRail : null);
  function safeStore() { try { return root.localStorage; } catch (e) { return null; } }
  const payBase = () => String(root.GIFOS_PAY_URL || 'https://pay.gifos.app').replace(/\/$/, '');
  const nowS = () => Math.floor(Date.now() / 1000);
  const b64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  function readJson(k) { try { return JSON.parse(safeStore().getItem(k) || 'null'); } catch (e) { return null; } }
  function writeJson(k, v) { try { if (v == null) safeStore().removeItem(k); else safeStore().setItem(k, JSON.stringify(v)); } catch (e) {} }

  // ---- THE LEDGER: every plan this browser holds, ever held or started here (append-only) -----------------------
  // A purchase is never overwritten or deleted. Each subscription is its own record, keyed by its id. A checkout
  // started here is a record in state 'pending' until a license is issued for it; a lapsed, cancelled or re-keyed plan
  // stays as history, with its receipt. A record only ever gains facts about itself: its key list grows (a new key
  // marks the older ones superseded), its last word from the payment service is updated, Dismiss hides it.
  // The plan in use is CHOSEN from the records (activeRec): the best one with a current license, else the latest one
  // held; never a pending checkout and never "the last one written". gifos-sub-cred and gifos-sub-state hold a copy
  // of the chosen record for pages from before the ledger; anything such a page writes there is taken in on load.
  const LEDGER_KEY = 'gifos-sub-ledger';
  const STATE_FIELDS = ['status', 'until', 'paidThrough', 'checkedAt', 'licenseJson', 'sig', 'lastLicenseJson', 'lastSig'];
  const NOT_PAID = ['APPROVAL_PENDING', 'APPROVED', 'EXPIRED', 'CANCELLED'];   // a checkout's states before (or instead of) a first payment
  function readLedger() {
    const l = readJson(LEDGER_KEY);
    return l && l.v === 1 && l.subs && typeof l.subs === 'object' && !Array.isArray(l.subs) ? l : { v: 1, subs: {} };
  }
  const recKey = (r) => { const ks = (r && Array.isArray(r.keys) ? r.keys : []).filter((k) => k && typeof k.seed === 'string' && !k.superseded); return ks[ks.length - 1] || null; };
  function recCred(r) {
    const k = recKey(r);
    return k ? SUB.credentialOk({ v: 1, kind: SUB.CRED_KIND, subId: r.subId, tier: r.tier, period: r.period, seed: k.seed, buyerKey: k.buyerKey, libSeed: k.libSeed }) : null;
  }
  const licOf = (j) => { if (typeof j !== 'string' || !j) return null; try { const l = JSON.parse(j); return l && typeof l === 'object' ? l : null; } catch (e) { return null; } };
  // Bought: a license was ever issued for it here (or it was paid through a date).
  const everPaid = (r) => !!r && (!!r.paid || !!licOf(r.licenseJson) || !!licOf(r.lastLicenseJson) || (Number.isInteger(r.paidThrough) && r.paidThrough > 0));
  function stateOf(r) {
    if (!r) return {};
    const st = { subId: r.subId, tier: r.tier };
    for (const f of STATE_FIELDS) if (r[f] !== undefined && r[f] !== null) st[f] = r[f];
    if (r.status === null) st.status = null;
    return st;
  }
  function liveLicense(r, n) {
    const lic = licOf(r.licenseJson), k = recKey(r);
    return !!lic && lic.subId === r.subId && !!k && (!k.buyerKey || lic.buyerKey === k.buyerKey) && Number.isInteger(lic.exp) && lic.exp > n ? lic : null;
  }
  function activeRec(l) {
    l = l || readLedger();
    const n = nowS();
    const held = Object.keys(l.subs).map((id) => l.subs[id]).filter((r) => r && r.state !== 'pending' && recCred(r));
    const live = held.filter((r) => liveLicense(r, n));
    if (live.length) {
      return live.reduce((a, b) => {
        const la = liveLicense(a, n), lb = liveLicense(b, n);
        const bCov = !!(la.grants && lb.grants) && SUB.covers(lb.grants, la.grants), aCov = !!(la.grants && lb.grants) && SUB.covers(la.grants, lb.grants);
        if (bCov !== aCov) return bCov ? b : a;
        return (lb.issued || 0) > (la.issued || 0) ? b : a;
      });
    }
    return held.reduce((a, b) => (!a || (b.at || 0) >= (a.at || 0) ? b : a), null);
  }
  // Change one record: its own fields only (undefined removes that field of it); a key is appended, never replaced.
  function putRec(subId, patch, key) {
    const l = readLedger();
    const r = l.subs[subId] || { subId, at: Date.now(), keys: [], state: 'held' };
    if (!Array.isArray(r.keys)) r.keys = [];
    for (const f of Object.keys(patch || {})) {
      if (f === 'keys' || f === 'subId') continue;
      if (patch[f] === undefined) delete r[f]; else r[f] = patch[f];
    }
    if (key && typeof key.seed === 'string' && !r.keys.some((k) => k && k.seed === key.seed)) {
      const at = Date.now();
      for (const k of r.keys) if (k && !k.superseded) k.superseded = at;
      const entry = { seed: key.seed, at };
      if (key.buyerKey) entry.buyerKey = key.buyerKey;
      if (key.libSeed) entry.libSeed = key.libSeed;
      if (typeof key.via === 'string' && key.via) entry.via = key.via;   // how this key came here: restore, move, file, rekey
      r.keys.push(entry);
      delete r.refused;   // a new key here: the service's "another key" answer was about the old one
    }
    if (everPaid(r)) { r.paid = true; if (r.state === 'pending') r.state = 'held'; }
    l.subs[subId] = r;
    writeJson(LEDGER_KEY, l);
    project(l);
    return r;
  }
  // The copy for pages from before the ledger: the chosen record's credential, state and purchase facts.
  let projected = '';
  function project(l) {
    const r = activeRec(l);
    const c = r ? recCred(r) : null;
    writeJson(CRED_KEY, c);
    writeJson(STATE_KEY, r ? stateOf(r) : null);
    const bag = readJson(PURCHASE_KEY);
    const out = bag && typeof bag === 'object' && !Array.isArray(bag) ? bag : {};
    if (r && r.buy) out.sub = r.buy; else delete out.sub;
    writeJson(PURCHASE_KEY, Object.keys(out).length ? out : null);
    projected = c ? JSON.stringify(c) : '';
  }
  // Take in a credential found in gifos-sub-cred that the ledger does not hold yet (the ledger's first load, or a page
  // from before the ledger wrote it). Never loses one: it becomes a record, or a new key of its record.
  function ingestLegacy() {
    let raw = null; try { raw = safeStore().getItem(CRED_KEY); } catch (e) {}
    if (!raw || raw === projected) return;
    const c = SUB.credentialOk(readJson(CRED_KEY));
    if (!c) return;
    const l = readLedger();
    const had = l.subs[c.subId];
    if (had && Array.isArray(had.keys) && had.keys.some((k) => k && k.seed === c.seed)) { projected = raw; return; }
    const st = readJson(STATE_KEY) || {};
    const mine = st.subId === c.subId;
    const mark = readJson(SUB_RECEIPT_KEY) || {};
    const fields = { tier: c.tier, period: c.period };
    if (mine) for (const f of STATE_FIELDS) if (st[f] !== undefined) fields[f] = st[f];
    const paid = (mine && (!!licOf(st.licenseJson) || !!licOf(st.lastLicenseJson) || (Number.isInteger(st.paidThrough) && st.paidThrough > 0))) || mark.sub === c.subId || !!(had && had.paid);
    if (paid) fields.paid = true;
    // A web checkout whose last word is a not-paid state and that never had a license: a checkout that was never
    // finished (pages before the ledger saved one as the plan). Its state not known yet (a file just used): held.
    if (!had) fields.state = !paid && /^I-/.test(c.subId) && mine && NOT_PAID.indexOf(st.status) >= 0 ? 'pending' : 'held';
    if (!had && mine) { const b = readJson(PURCHASE_KEY); if (b && b.sub && typeof b.sub === 'object') fields.buy = b.sub; }
    putRec(c.subId, fields, { seed: c.seed, buyerKey: c.buyerKey, libSeed: c.libSeed });
  }
  const readState = () => { ingestLegacy(); return stateOf(activeRec()); };
  // The state of one record (the active one when s names none): what the payment service last said about it.
  function writeState(s) {
    s = s || {};
    const id = s.subId || (activeRec() || {}).subId;
    if (!id) return;
    const patch = {};
    if (s.tier) patch.tier = s.tier;
    for (const f of STATE_FIELDS) patch[f] = s[f] === undefined ? undefined : s[f];
    putRec(id, patch);
  }

  // ---- the subscription file -------------------------------------------------
  // This browser's credential, else one on this browser's Home Screen: the
  // subscription file in the Providers folder (recognised there only, like
  // every provider), or the subscription RECEIPT in the Purchases folder.
  // A receipt (appId 'gifos-receipt') is never a Provider, and Purchases
  // holds receipts only.
  const RECEIPT_APP_ID = 'gifos-receipt';
  const fileText = (v) => (v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v == null ? '' : v));
  const fileJson = (files, name) => { try { return files && files[name] != null ? JSON.parse(fileText(files[name])) : null; } catch (e) { return null; } };
  function isSubReceipt(files) {
    const m = fileJson(files, 'manifest.json');
    return !!m && m.appId === RECEIPT_APP_ID && m.receipt === true && m.subscription === true;
  }
  let provP = null;
  function fromProvidersAll() {
    if (!provP) provP = (async () => {
      const out = { cred: null, wallet: null, creds: [] };
      const st = GifOS.store, gif = GifOS.gif;
      if (!st || !st.allItems || !st.getFile || !gif) return out;
      const items = await st.allItems();
      for (const it of items || []) {
        const where = it ? (it.parent || null) : null;
        if (!it || (where !== 'sys_providers' && where !== 'sys_purchases') || it.kind !== 'file' || !it.fileId) continue;
        const f = await st.getFile(it.fileId).catch(() => null);
        if (!f || f.kind !== 'gif' || !f.bytes) continue;
        if (where === 'sys_providers' ? f.appId === RECEIPT_APP_ID : f.appId !== RECEIPT_APP_ID) continue;
        const bytes = f.bytes instanceof Uint8Array ? f.bytes : new Uint8Array(f.bytes);
        const arc = await gif.decode(bytes).catch(() => null);
        if (!arc) continue;
        let c = null;
        if (where === 'sys_purchases') {
          if (!isSubReceipt(arc.files)) continue;
          c = SUB.credentialOk(fileJson(arc.files, 'subscription.json'));
          if (!out.wallet) out.wallet = SUB.walletOk(fileJson(arc.files, 'passes.json'));
        } else {
          c = SUB.credentialFromFiles(arc.files);
          if (!out.wallet) out.wallet = SUB.walletFromFiles(arc.files);
        }
        // Every plan found is kept (a receipt in Purchases was paid for); the first is the old single answer.
        if (c) { out.creds.push({ cred: c, paid: where === 'sys_purchases' }); if (!out.cred) out.cred = c; }
      }
      return out;
    })().catch(() => ({ cred: null, wallet: null, creds: [] }));
    return provP;
  }
  function activeCred() { ingestLegacy(); const r = activeRec(); return r ? recCred(r) : null; }
  async function credential() {
    const c = activeCred();
    if (c) return c;
    // A plan on this browser's Home Screen (the subscription file, a receipt in Purchases) becomes a record here.
    const found = (await fromProvidersAll()).creds || [];
    for (const f of found) {
      const r = readLedger().subs[f.cred.subId];
      if (r && Array.isArray(r.keys) && r.keys.some((k) => k && k.seed === f.cred.seed)) continue;
      putRec(f.cred.subId, Object.assign({ tier: f.cred.tier, period: f.cred.period }, r ? {} : { state: 'held' }, f.paid ? { paid: true } : {}), { seed: f.cred.seed, buyerKey: f.cred.buyerKey, libSeed: f.cred.libSeed });
    }
    return activeCred();
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
    const w = await wallet();
    if (!c && !w) throw new Error('No subscription on this browser.');
    const files = SUB.credentialFiles(c, w);
    const kept = w ? keptWallets().filter((k) => k.seed !== w.seed && k.passes.length) : [];
    if (kept.length) files['passes-kept.json'] = JSON.stringify(kept);   // every key's passes travel with the file
    return GifOS.gif.encode(files, { accent: [120, 200, 255] });
  }
  async function downloadFile() {
    const bytes = await fileBytes();
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/gif' }));
    viewCall('download', url, 'GifOS subscription.gif');   // the view hands the person the file
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  // THE SUBSCRIPTION IN PURCHASES. A plan or pass bought here also lands in
  // the Home Screen's Purchases folder as a RECEIPT: the same credential the
  // subscription file holds (subscription.json, passes.json) plus the signed
  // license, in a receipt GIF (appId 'gifos-receipt', subscription: true).
  // One receipt per subscription, kept for good: a later plan never reuses an
  // earlier plan's receipt. A receipt is brought up to date in place only with
  // facts about its own plan (a renewed license, the passes it carries); the
  // desktop places it (gifos_pay_pending, as for every receipt).
  // Best-effort: a page with no Home Screen store just skips it.
  const SUB_RECEIPT_KEY = 'gifos-sub-receipt';   // { fileId, mark, sub }: the chosen plan's receipt (pages before the ledger read it)
  const RECEIPTS_KEY = 'gifos-sub-receipts';     // { <subId, or '' for passes alone>: { fileId, mark } }: every receipt, never removed
  const PAY_PENDING = 'gifos_pay_pending';       // gifos-pay-broker.js PENDING_KEY: the desktop's placement queue
  const PURCHASE_KEY = 'gifos-sub-purchase';     // { sub (copy of the chosen plan's), pass (the latest pass), passes: {<pass id>: facts} }
  function readPurchase() {
    const b = readJson(PURCHASE_KEY);
    return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
  }
  // Fixed key order, so a later keepReceipt sees the same mark for the same facts.
  function cleanPurchase(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
    const o = {};
    if (Number.isFinite(p.boughtAt)) o.boughtAt = Math.round(Number(p.boughtAt));
    if (typeof p.price === 'string' && p.price) o.price = p.price;
    if (typeof p.currency === 'string' && p.currency) o.currency = p.currency;
    if (typeof p.rail === 'string' && p.rail) o.rail = p.rail;
    if (typeof p.period === 'string' && p.period) o.period = p.period;
    if (typeof p.orderId === 'string' && p.orderId) o.orderId = p.orderId;
    if (typeof p.captureId === 'string' && p.captureId) o.captureId = p.captureId;
    return Object.keys(o).length ? o : null;
  }
  function centsPrice(cents) {
    if (!Number.isInteger(cents) || cents < 0) return '';
    return Math.floor(cents / 100) + '.' + String(cents % 100).padStart(2, '0');
  }
  // A subscription's purchase facts live in its own record.
  function mergeSubFacts(subId, patch) {
    const r = readLedger().subs[subId];
    const next = cleanPurchase(Object.assign({}, cleanPurchase(r && r.buy) || {}, patch || {}));
    if (next) putRec(subId, { buy: next });
  }
  // The signed issue time, and only for a purchase this browser already recorded.
  function adoptIssued(subId, licenseJson) {
    const r = readLedger().subs[subId];
    const lic = licOf(licenseJson);
    if (!r || !cleanPurchase(r.buy) || cleanPurchase(r.buy).boughtAt || !lic || !Number.isInteger(lic.issued)) return;
    mergeSubFacts(subId, { boughtAt: lic.issued * 1000 });
  }
  function noteStoreSub(subId, r) {
    const rail = RAIL();
    const which = rail && typeof rail.store === 'function' ? rail.store() : '';
    const patch = { boughtAt: Date.now() };
    if (r && typeof r.period === 'string' && r.period) patch.period = r.period;
    if (which === 'play' || which === 'appstore') patch.rail = which;
    if (r && typeof r.orderId === 'string' && r.orderId) patch.orderId = r.orderId;
    if (r && typeof r.captureId === 'string' && r.captureId) patch.captureId = r.captureId;
    if (r && typeof r.price === 'string' && r.price) {
      patch.price = r.price;
      if (typeof r.currency === 'string' && r.currency) patch.currency = r.currency;
    }
    mergeSubFacts(subId, patch);
  }
  // A pass's facts: kept under its own id for good; `pass` is the latest one (what a receipt without a plan shows).
  function notePassPurchase(o) {
    if (!o || typeof o !== 'object') return;
    const patch = {};
    const sec = Number.isInteger(o.paid) ? o.paid : (Number.isInteger(o.start) ? o.start : null);
    if (sec != null) patch.boughtAt = sec * 1000;
    if (o.via === 'paypal-order') patch.rail = 'paypal';
    else if (o.via === 'play' || o.via === 'appstore') patch.rail = o.via;
    if (typeof o.order === 'string' && o.order && o.via !== 'mint') patch.orderId = o.order;
    if (typeof o.captureId === 'string' && o.captureId) patch.captureId = o.captureId;
    const bag = readPurchase();
    const facts = cleanPurchase(Object.assign({}, (typeof o.id === 'string' && bag.passes && cleanPurchase(bag.passes[o.id])) || {}, patch));
    if (!facts) return;
    const passes = bag.passes && typeof bag.passes === 'object' && !Array.isArray(bag.passes) ? bag.passes : {};
    if (typeof o.id === 'string' && o.id) passes[o.id] = facts;
    writeJson(PURCHASE_KEY, Object.assign({}, bag, { pass: facts, passes }));
  }
  function licMark(st, c) {
    let exp = '';
    if (c && st && typeof st.licenseJson === 'string' && st.subId === c.subId) {
      const lic = licOf(st.licenseJson);
      if (lic && Number.isInteger(lic.exp)) exp = String(lic.exp);
    }
    const paid = st && Number.isInteger(st.paidThrough) ? String(st.paidThrough) : '';
    const until = st && Number.isInteger(st.until) ? String(st.until) : '';
    return exp + ':' + paid + ':' + until;
  }
  // The files of one receipt: a plan (c, its state st, its purchase facts) and/or the passes (w).
  function subReceiptFiles(c, w, st, bought) {
    const name = tx('subReceiptName', 'Receipt — GifOS Meet subscription');
    const files = {
      'manifest.json': JSON.stringify({ gifos: '1.0', appId: RECEIPT_APP_ID, name, entry: 'index.html', receipt: true, subscription: true, accent: [120, 200, 255] }),
      // Shown only by a Home Screen too old to have the receipt view.
      'index.html': '<!doctype html><meta charset="utf-8"><title>' + name + '</title><body style="font:15px/1.5 system-ui;padding:1.2rem"><main><h2>' + name + '</h2><p>' +
        (c ? 'A GifOS Meet subscription.' : '') + (w ? ' Four-hour passes: ' + w.passes.length + '.' : '') + '</p><p>Anyone with this file can use your subscription and passes. Keep it private.</p></main>',
    };
    if (c) files['subscription.json'] = JSON.stringify(c);
    if (w) files['passes.json'] = JSON.stringify(w);
    if (c && st && st.licenseJson && st.sig && st.subId === c.subId) files['license.json'] = JSON.stringify({ licenseJson: st.licenseJson, sig: st.sig });
    if (bought === undefined) bought = c ? cleanPurchase(readPurchase().sub) : cleanPurchase(readPurchase().pass);
    if (bought) files['purchase.json'] = JSON.stringify(bought);
    if (c && st && (Number.isInteger(st.until) || Number.isInteger(st.paidThrough))) {
      const state = {};
      if (Number.isInteger(st.until)) state.until = st.until;
      if (Number.isInteger(st.paidThrough)) state.paidThrough = st.paidThrough;
      if (typeof st.status === 'string' && st.status) state.status = st.status;
      files['state.json'] = JSON.stringify(state);
    }
    return files;
  }
  // Every receipt this browser has, as receipt files: one per plan that was paid for, newest first (a checkout never
  // finished has none), then one for the passes. Each purchase keeps its own receipt.
  function receiptSets() {
    ingestLegacy();
    const l = readLedger();
    const w = SUB.walletOk(readJson(WALLET_KEY));
    const passN = w ? w.passes.length : 0;
    const paid = Object.keys(l.subs).map((id) => l.subs[id]).filter((r) => r && everPaid(r) && recCred(r)).sort((a, b) => (b.at || 0) - (a.at || 0));
    const out = paid.map((r) => {
      const c = recCred(r), st = stateOf(r);
      const bought = cleanPurchase(r.buy);
      return { id: r.subId, files: subReceiptFiles(c, null, st, bought), mark: [r.subId, c.buyerKey || '', liveLicense(r, nowS()) ? r.tier : '', 0, licMark(st, c), bought ? JSON.stringify(bought) : ''].join('|') };
    });
    if (passN) {
      const bought = cleanPurchase(readPurchase().pass);
      out.push({ id: '', files: subReceiptFiles(null, w, null, bought), mark: ['', '', '', passN, '', bought ? JSON.stringify(bought) : ''].join('|') });
    }
    return out;
  }
  // ---- THE PURCHASES LIST (/subscription's Receipts table) ----------------------------------------------------------
  // Every purchase this browser knows, as plain facts for a table: one row per ledger record (a plan, a checkout), one
  // per four-hour pass. No key, no seed, nothing secret; only what this browser holds (never a claim about another
  // device beyond the service's own answer for this browser's key). Names and words are the view's.
  const PURCHASE_HIDDEN_KEY = 'gifos-purchases-hidden';   // { <pass id>: at }: passes hidden from the table (records carry their own flag)
  async function purchases() {
    ingestLegacy();
    const l = readLedger(), n = nowS(), act = activeRec(l);
    const rmap = readJson(RECEIPTS_KEY) || {};
    const recs = Object.keys(l.subs).map((id) => l.subs[id]).filter((r) => r && typeof r.subId === 'string');
    const rows = recs.map((r) => {
      const keys = Array.isArray(r.keys) ? r.keys.filter((k) => k && typeof k.seed === 'string') : [];
      const k = recKey(r) || keys[keys.length - 1] || {};
      const lic = liveLicense(r, n);
      const any = lic || licOf(r.licenseJson) || licOf(r.lastLicenseJson);
      const buy = cleanPurchase(r.buy) || {};
      // Replaced by: a later record bought as an upgrade of this one that was paid for.
      const by = recs.filter((x) => x.replaces === r.subId && everPaid(x)).sort((a, b) => (a.at || 0) - (b.at || 0))[0] || null;
      return {
        kind: 'plan', id: r.subId, tier: typeof r.tier === 'string' ? r.tier : null, period: r.period || null, at: r.at || null,
        pending: r.state === 'pending', paid: everPaid(r), status: r.status || null,
        until: Number.isInteger(r.until) ? r.until : null, paidThrough: Number.isInteger(r.paidThrough) ? r.paidThrough : null,
        live: !!lic, exp: any && Number.isInteger(any.exp) ? any.exp : null, issued: any && Number.isInteger(any.issued) ? any.issued : null,
        inUse: !!act && act.subId === r.subId,
        hidden: !!r.hidden, refused: Number.isFinite(r.refused) ? r.refused : null,
        via: typeof k.via === 'string' ? k.via : null, viaAt: Number.isFinite(k.at) ? k.at : null, keys: keys.length,
        replaces: typeof r.replaces === 'string' ? r.replaces : null, replacedBy: by ? { id: by.subId, tier: typeof by.tier === 'string' ? by.tier : null } : null,
        continuedAs: typeof r.continuedAs === 'string' ? r.continuedAs : null,
        bought: buy.boughtAt || null, price: buy.price || null, currency: buy.currency || null, rail: buy.rail || (/^I-/.test(r.subId) ? 'paypal' : null),
        orderId: buy.orderId || null, captureId: buy.captureId || null,
        receipt: rmap[r.subId] && typeof rmap[r.subId].fileId === 'string' ? rmap[r.subId].fileId : null,
      };
    });
    // Passes: this browser's wallet, and the wallets it replaced (kept as history).
    const hid = readJson(PURCHASE_HIDDEN_KEY) || {};
    const bag = readPurchase();
    const facts = bag.passes && typeof bag.passes === 'object' && !Array.isArray(bag.passes) ? bag.passes : {};
    const wallets = [SUB.walletOk(readJson(WALLET_KEY))].concat((readJson(WALLET_HISTORY_KEY) || []).map((w) => SUB.walletOk(w))).filter(Boolean);
    const seen = new Set();
    for (const w of wallets) {
      for (const p of w.passes) {
        const o = SUB.checkPass(passOf(p));
        if (!o || seen.has(o.id)) continue;
        seen.add(o.id);
        const f = cleanPurchase(facts[o.id]) || {};
        rows.push({
          kind: 'pass', id: o.id, tier: null, plan: typeof o.plan === 'string' ? o.plan : null, at: (f.boughtAt || o.paid * 1000), paid: true,
          start: o.start, end: Number.isFinite(o.end) ? o.end : null, live: SUB.passLive(o, n), hidden: !!hid[o.id],
          bought: f.boughtAt || o.paid * 1000, price: f.price || null, currency: f.currency || null, rail: f.rail || (o.via === 'paypal-order' ? 'paypal' : o.via),
          orderId: o.via === 'mint' ? null : (f.orderId || o.order), captureId: f.captureId || null,
          receipt: rmap[''] && typeof rmap[''].fileId === 'string' ? rmap[''].fileId : null,
        });
      }
    }
    return rows.sort((a, b) => (b.at || 0) - (a.at || 0));
  }
  // Hide or show one row. Nothing is deleted: a record gets its `hidden` flag, a pass an entry in the hidden list. Hiding a
  // checkout not finished first asks once more (one paid meanwhile becomes the plan and stays shown).
  async function hidePurchase(id, on) {
    on = on !== false;
    const r = readLedger().subs[id];
    if (r) {
      if (on && r.state === 'pending') { try { const st = await checkPending(id); if (st && st.licenseJson) return false; } catch (e) {} }
      putRec(id, { hidden: on ? true : undefined });
      return true;
    }
    const hid = readJson(PURCHASE_HIDDEN_KEY) || {};
    if (on) hid[id] = Date.now(); else delete hid[id];
    writeJson(PURCHASE_HIDDEN_KEY, Object.keys(hid).length ? hid : null);
    return true;
  }
  // Continue one checkout not finished (the row's own button): as continueCheckout, for that record.
  async function continuePurchase(id, say) {
    const r = readLedger().subs[id];
    if (!r || r.state !== 'pending') return readState();
    let st = null; try { st = await checkPending(id); } catch (e) {}
    if (st && st.licenseJson) return st;
    putRec(id, { hidden: true });
    return subscribe(r.tier, r.period, say, { from: id });
  }
  let receiptBusy = null;
  function keepReceipt() {
    if (receiptBusy) return receiptBusy.then(keepReceipt);
    receiptBusy = (async () => {
      const store = GifOS.store, gif = GifOS.gif;
      if (!store || !store.putFile || !store.uid || !gif || !gif.encode) return;
      const map = readJson(RECEIPTS_KEY) || {};
      // The single receipt of pages before the ledger stays the receipt of the plan it was made for.
      const old = readJson(SUB_RECEIPT_KEY) || {};
      if (typeof old.fileId === 'string' && old.fileId && !Object.keys(map).some((k) => map[k] && map[k].fileId === old.fileId)) map[typeof old.sub === 'string' ? old.sub : ''] = { fileId: old.fileId, mark: old.mark };
      const act = activeRec();
      for (const set of receiptSets()) {
        const held = map[set.id] || {};
        if (!(held.mark === set.mark && held.fileId)) {
          const fileId = typeof held.fileId === 'string' && held.fileId ? held.fileId : store.uid('file');
          const bytes = await gif.encode(set.files, { accent: [120, 200, 255] });
          await store.putFile({ id: fileId, name: tx('subReceiptName', 'Receipt — GifOS Meet subscription') + '.gif', bytes, kind: 'gif', isApp: true, appId: RECEIPT_APP_ID, mime: 'image/gif' });
          map[set.id] = { fileId, mark: set.mark };
          writeJson(RECEIPTS_KEY, map);
          // Queued every time: the desktop skips a fileId it already placed.
          const q = readJson(PAY_PENDING);
          const list = Array.isArray(q) ? q : [];
          if (list.indexOf(fileId) < 0) { list.push(fileId); writeJson(PAY_PENDING, list); }
        }
        if ((act && set.id === act.subId) || (!act && set.id === '')) writeJson(SUB_RECEIPT_KEY, { fileId: map[set.id].fileId, mark: set.mark, sub: set.id || null });
      }
      writeJson(RECEIPTS_KEY, map);
    })().catch(() => {}).finally(() => { receiptBusy = null; });
    return receiptBusy;
  }
  // Use a file brought from another browser. Its key must be the key the
  // subscription was made for (checked by the payment service on every ask).
  // Install a credential (and an optional pass wallet) already checked by credentialOk / walletOk.
  // useFile and a plan moved from another device share this path.
  // Returns the plan's state with took: {plan (its id, or null), passes (mergeWallet's answer, or null)}; it is logged.
  async function installCreds(c, w, via, more) {   // via: how it came (checkout|restore|move|file|rekey, RECEIPTS); more: kept wallets (WALLET)
    const took = { plan: null, passes: null };
    const told = (st) => { try { console.info('[meet-subs] credentials taken: ' + JSON.stringify(took)); } catch (e) {} return Object.assign({}, st || {}, { took }); };
    const ws = [w].concat(Array.isArray(more) ? more.slice(0, 16) : []).map((x) => (x ? SUB.walletOk(x) : null)).filter(Boolean);
    if (w && !ws.length && !c) throw new Error('That file’s passes could not be read.');
    for (const ww of ws) {
      const got = await mergeWallet(ww), t = took.passes;
      took.passes = t ? { passes: t.passes + got.passes, dropped: t.dropped + got.dropped, added: t.added + got.added, inUse: t.inUse || got.inUse, pass: got.pass } : got;
    }
    if (ws.length) {
      passChanged();
      // Brought on purpose (a person's act, like a purchase): a new pass now in use takes this meeting.
      if (took.passes && took.passes.inUse && took.passes.added && meet) passJoin(meet.room, true, true);
    }
    if (!c) {
      if (ws.length) return told(readState());
      throw new Error('That file is not a GifOS subscription.');
    }
    const ok = SUB.credentialOk(c);
    if (!ok) throw new Error('That file is not a GifOS subscription.');
    // Its own record (a new key of the same plan, from a restore or a re-key, joins that record and supersedes the
    // older keys); brought here on purpose, so it is the latest one held. No other record changes.
    ingestLegacy();
    putRec(ok.subId, { tier: ok.tier, period: ok.period, state: 'held', at: Date.now() }, { seed: ok.seed, buyerKey: ok.buyerKey, libSeed: ok.libSeed, via: typeof via === 'string' ? via : 'file' });
    let st = null;
    try { st = await refresh(ok.subId); } catch (e) { st = stateOf(readLedger().subs[ok.subId]); }
    rejoin(true);
    took.plan = ok.subId;
    return told(st);
  }
  // The file also carries the kept wallets (passes-kept.json, read by this page only; older pages skip it).
  async function useFile(bytes) {
    const arc = await GifOS.gif.decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    const c = arc && SUB.credentialFromFiles(arc.files);
    const w = arc && SUB.walletFromFiles(arc.files);
    const more = arc && (c || w) ? fileJson(arc.files, 'passes-kept.json') : null;
    return installCreds(c, w, 'file', Array.isArray(more) ? more : null);
  }
  // The JSON sealed into a move package: the credential, with libSeed so My library survives the move, and the pass wallet.
  async function movePackage() {
    const c = await credential();
    if (!c) throw new Error('No subscription on this browser.');
    const cred = Object.assign({}, c, { libSeed: c.libSeed || c.seed });
    const w = await wallet();
    const pkg = { v: 1, credential: cred };
    if (w) pkg.wallet = w;
    const kept = w ? keptWallets().filter((k) => k.seed !== w.seed && k.passes.length) : [];
    if (kept.length) pkg.wallets = kept;   // the kept keys' passes move too
    return pkg;
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
  // My library (js/gifos-library.js) signs its requests with this: the
  // current license (or the last one, after the plan ended) and the
  // subscription key. null when this browser holds no subscription.
  async function librarySigner() {
    const c = await credential();
    if (!c) return null;
    const st = readState();
    const licenseJson = st.licenseJson || st.lastLicenseJson, sig = st.licenseJson ? st.sig : st.lastSig;
    if (!licenseJson || !sig) return null;
    let lic; try { lic = JSON.parse(licenseJson); } catch (e) { return null; }
    if (!lic || lic.subId !== c.subId) return null;
    try { if (lic.buyerKey !== (await myKey()).pub) return null; } catch (e) { return null; }
    return { subId: c.subId, tier: lic.tier, grants: lic.grants || null, exp: lic.exp, license: { licenseJson, sig }, sign: signText, libraryKey: await libraryKey(c) };
  }
  // The library key: derived here from the subscription file's seed, so the
  // file (and its backup) is all it takes to open My library on any browser,
  // and nothing else can. It never leaves this browser.
  let libKeyMemo = { seed: null, p: null };
  function libraryKey(c) {
    const seed = c.libSeed || c.seed;
    if (libKeyMemo.seed !== seed) {
      libKeyMemo = { seed, p: (async () => {
        const ikm = await crypto.subtle.importKey('raw', fromB64(seed), 'HKDF', false, ['deriveKey']);
        return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('gifos-library'), info: new TextEncoder().encode('gifos-library-v1\x00' + c.subId) }, ikm, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      })() };
    }
    return libKeyMemo.p;
  }
  // The subscription's rights alone (its line items, else the defaults).
  async function planRights() {
    const lic = await verifiedLicense();
    return SUB.rightsOf(lic, nowS());   // no license: the defaults
  }
  // What is in effect now: the best of the subscription and a live pass.
  async function rights() {
    const base = await planRights();
    const lp = await livePass();
    return lp ? SUB.heldRights([base, SUB.passRights(lp.o)]) : base;
  }

  async function post(path, body) {
    const r = await fetch(payBase() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok && !(j && (j.moved || j.ended))) { const e = new Error((j && j.error) || ('The payment service answered ' + r.status + '.')); e.status = r.status; throw e; }
    return j || {};
  }
  async function subIdNow() { const c = await credential(); return c ? c.subId : readState().subId; }
  async function signed(action, extra, asId) {
    const subId = asId || (await subIdNow());
    const at = nowS();
    return Object.assign({ subId, buyerKey: (await myKey()).pub, at, sig: await signText(SUB.askMessage(action, subId, at)) }, extra || {});
  }
  // An ask signed by one record's own current key (a checkout, a plan that is not the one in use).
  const recKeys = new Map();
  function keyOfSeed(seed) {
    if (!recKeys.has(seed)) recKeys.set(seed, GifOS.ed.keysFromSeed(fromB64(seed)).then((k) => ({ priv: k.priv, pub: b64(k.pubRaw) })));
    return recKeys.get(seed);
  }
  async function signedBy(c, action) {
    const k = await keyOfSeed(c.seed);
    const at = nowS();
    return { subId: c.subId, buyerKey: k.pub, at, sig: b64(await GifOS.ed.sign(k.priv, new TextEncoder().encode(SUB.askMessage(action, c.subId, at)))) };
  }
  // Ask the payment service for a fresh license for one record (the plan in use when none is named); keep what it
  // says in that record. A license is kept only when it verifies: signed by the payment service, for this record's id
  // and its current key. An "active" answer whose license does not verify changes nothing.
  async function refresh(subId) {
    if (!subId) await credential();
    ingestLegacy();
    const id = subId || (activeRec() || {}).subId;
    const r = id ? readLedger().subs[id] : null;
    const c = r ? recCred(r) : null;
    if (!c) return null;
    const ask = await signedBy(c, 'license');
    let j;
    try { j = await post('/gifos/sub/license', ask); }
    catch (e) {
      // The service holds this plan under another key now (restored, or stopped on other devices, from elsewhere): a
      // fact about this record's key, shown in its row. Nothing else changes; a new key here clears it.
      if (e && e.status === 403 && /another key/.test(String(e.message || ''))) putRec(id, { refused: Date.now() });
      throw e;
    }
    const next = { status: j.status, tier: j.tier || r.tier, until: j.until || null, paidThrough: j.paidThrough || null, checkedAt: Date.now(), refused: undefined };
    let lic = null;
    if (j.active && j.licenseJson && j.sig) {
      lic = await SUB.verifyLicense({ licenseJson: j.licenseJson, sig: j.sig }, verifyPay, nowS()).catch(() => null);
      if (lic && (lic.subId !== id || lic.buyerKey !== ask.buyerKey)) lic = null;
    }
    const cur = readLedger().subs[id] || r;
    if (lic) { next.licenseJson = j.licenseJson; next.sig = j.sig; next.lastLicenseJson = undefined; next.lastSig = undefined; }
    else if (!j.active) {
      // The last license is kept for My library: after a plan ends, its
      // files stay readable for the keep window, shown with that license.
      if (cur.licenseJson) { next.lastLicenseJson = cur.licenseJson; next.lastSig = cur.sig; }
      next.licenseJson = undefined; next.sig = undefined;
    }
    const was = (activeRec() || {}).subId;
    putRec(id, next);
    if (lic) { adoptIssued(id, j.licenseJson); keepReceipt(); }
    // A plan's first license here: a plan it replaced (an upgrade, a store plan change) may have ended at the service
    // before its license runs out. Ask once about every other record still holding a license, so the choice reads
    // what the service says now, not a license it has replaced.
    if (lic && !r.paid) {
      const l = readLedger(), n = nowS();
      for (const other of Object.keys(l.subs)) if (other !== id && liveLicense(l.subs[other], n)) { try { await refresh(other); } catch (e) {} }
    }
    if (lic && was !== (activeRec() || {}).subId) rejoin(true);   // a bigger plan is now the one in use
    return stateOf(readLedger().subs[id]);
  }
  // keepFresh() -> once this browser's license is fresh (fetched when missing or near its end). One check at a time: the
  // page's boot starts it, and every reader of the license (Settings, the /subscription page) awaits the same one, so
  // a returning subscriber whose license is not stored yet is never shown "no plan" while it is on its way.
  let freshP = null;
  function keepFresh() {
    if (!freshP) {
      freshP = (async () => {
        try { await checkPending(); } catch (e) {}
        const c = await credential();
        if (!c) return;
        const lic = await verifiedLicense();
        const st = readState();
        if (!lic || lic.exp - nowS() < REFRESH_BEFORE_S || st.status === 'APPROVAL_PENDING') { try { await refresh(); } catch (e) {} }
      })().finally(() => { freshP = null; });
    }
    return freshP;
  }

  // ---- bought in the app: the store's purchase sheet ---------------------------
  // The key a store subscription is (or will be) held by: the paid credential
  // this app already has (a plan change keeps its key), else a purchase
  // started earlier and not yet confirmed, else a new one.
  const STORE_PENDING = 'gifos-store-pending';
  async function storeKey(fresh) {
    const cur = activeCred();
    const held = readJson(STORE_PENDING);
    let seedB64 = !fresh && cur ? cur.seed : held && typeof held.seed === 'string' ? held.seed : null;
    if (!seedB64) { const seed = new Uint8Array(32); crypto.getRandomValues(seed); seedB64 = b64(seed); writeJson(STORE_PENDING, { seed: seedB64 }); }
    const k = await GifOS.ed.keysFromSeed(fromB64(seedB64));
    return { seed: seedB64, buyerKey: b64(k.pubRaw), sign: async (text) => b64(await GifOS.ed.sign(k.priv, new TextEncoder().encode(text))) };
  }
  async function keepStoreSub(k, r) {
    // The store confirmed the purchase: its own record (the seed now lives there, so the scratch seed can go).
    putRec(r.subId, { tier: r.tier, period: r.period, state: 'held', at: Date.now() }, { seed: k.seed, buyerKey: k.buyerKey });
    writeJson(STORE_PENDING, null);
    noteStoreSub(r.subId, r);
    let st = null;
    try { st = await refresh(r.subId); } catch (e) { st = stateOf(readLedger().subs[r.subId]); }
    rejoin(true);
    return st;
  }
  async function subscribeInApp(tier, period, say) {
    const rail = RAIL();
    const cur = activeCred();
    const k = await storeKey(false);
    // A change of plan replaces the running store subscription (the store prorates an upgrade and defers a downgrade).
    let replace;
    if (cur && SUB.isPaid(cur.tier) && cur.tier !== tier) {
      const mine = await rail.owned().catch(() => []);
      const old = mine.find((p) => p.what === 'sub' && p.token);
      if (old) replace = { token: old.token, mode: (SUB.TIERS[tier].vouches || 0) >= (SUB.TIERS[cur.tier].vouches || 0) ? 'upgrade' : 'downgrade' };
    }
    const r = await rail.pay({ what: 'sub', tier, period, buyerKey: k.buyerKey, sign: k.sign, replace });
    if (r.state === 'done' && r.subId) return keepStoreSub(k, r);
    if (r.state === 'pending') { say(tx('store.pending', rail.TEXT.notConfirmed)); return { status: 'APPROVAL_PENDING' }; }
    return readState();
  }
  function keepPass(j, o) {
    return (async () => {
      await storePass(j, o, (await wallet()) || (await ensureWallet()));
      notePassPurchase(o);
      keepReceipt();
      passWatch().catch(() => {});
      if (meet) passJoin(meet.room, true, true);
      return j;
    })();
  }
  async function passRequest() {
    const w = await ensureWallet();
    const k = await walletKey(w);
    return { what: 'pass', buyerKey: k.pub, held: w.passes, sign: async (text) => b64(await GifOS.ed.sign(k.priv, new TextEncoder().encode(text))) };
  }
  async function buyPassInApp(say) {
    const rail = RAIL();
    const req = await passRequest();
    const r = await rail.pay(req);
    if (r.state === 'pending') { say(tx('store.pending', rail.TEXT.notConfirmed)); return null; }
    if (r.state !== 'done' || !r.passJson) return null;
    const o = await SUB.verifyPass({ passJson: r.passJson, sig: r.sig }, verifyPay).catch(() => null);
    if (!o || o.buyerKey !== req.buyerKey) return null;
    return keepPass(r, o);
  }
  // Restore: what the store already holds for this person (a plan bought on
  // another phone or before a reinstall, a purchase confirmed after the app
  // closed). A plan moves to this app's key; it still works in one meeting
  // at a time.
  async function restoreInApp() {
    const rail = RAIL();
    if (!rail) return [];
    let subKey = null;
    const got = await rail.restore({
      sub: async () => { subKey = await storeKey(false); return { buyerKey: subKey.buyerKey, sign: subKey.sign }; },
      pass: async () => passRequest(),
    });
    for (const r of got) {
      if (r.state === 'done' && r.subId && subKey) await keepStoreSub(subKey, r).catch(() => {});
      if (r.state === 'done' && r.passJson) { const o = await SUB.verifyPass({ passJson: r.passJson, sig: r.sig }, verifyPay).catch(() => null); if (o) await keepPass(r, o); }
    }
    return got;
  }

  // UPGRADES (said on /subscription and in the Terms; Nathan 2026-11-22). Buying a plan while this browser holds an active
  // PayPal subscription is an upgrade or nothing: the pay Worker gives the new plan's FIRST charge a prorated credit for
  // the unused time of the old one (every later charge is the full price) and cancels the old one at PayPal once the
  // new one is on. The old key signs that consent. A store plan changes in the store; a pass is never replaced.
  // -> {upgrade} for the create request, null when nothing is held, or throws when the move is not an upgrade.
  async function upgradeAsk(tier, period) {
    const cur = activeCred();
    const lic = cur ? await verifiedLicense().catch(() => null) : null;
    const st = readState();
    if (!cur || !lic || !/^I-/.test(cur.subId) || st.status === 'CANCELLED') return null;
    if (!SUB.upgradeOk({ tier: cur.tier, period: cur.period }, { tier, period })) throw new Error(tx('subNotUpgrade', 'That is not an upgrade of your plan. A bigger plan replaces yours; to change to another, cancel yours first.'));
    const k = await myKey(), at = nowS();
    return { subId: cur.subId, buyerKey: k.pub, at, sig: await signText(SUB.askMessage('upgrade:' + tier + ':' + period, cur.subId, at)) };
  }
  // ---- a checkout not finished yet ------------------------------------------------
  // A PayPal checkout is a record of its own in state 'pending' from the moment it is created. It never touches the
  // plan this browser holds; it becomes a plan here only when a verified license is issued for it (refresh). Dismiss
  // hides it; nothing deletes it.
  function pendingRecs() {
    ingestLegacy();
    const l = readLedger();
    return Object.keys(l.subs).map((id) => l.subs[id]).filter((r) => r && r.state === 'pending' && !r.hidden && recCred(r)).sort((a, b) => (b.at || 0) - (a.at || 0));
  }
  // What /subscription shows about the newest one (no key). lost: pages before the ledger saved a checkout over a
  // bought plan here, and that plan has not come back (its receipt mark, or a signed purchase time, names it).
  function pendingCheckout() {
    const r = pendingRecs()[0];
    if (!r) return null;
    const l = readLedger();
    const mark = readJson(SUB_RECEIPT_KEY) || {};
    const anyPaid = Object.keys(l.subs).some((id) => everPaid(l.subs[id]));
    const legacyBought = !!(r.buy && Number.isFinite(r.buy.boughtAt));
    const lost = (typeof mark.sub === 'string' && !!mark.sub && !l.subs[mark.sub]) || (legacyBought && !anyPaid);
    return { subId: r.subId, tier: r.tier, period: r.period, at: r.at || null, status: r.status || null, lost };
  }
  // Ask about every checkout not finished yet (one with a final no from PayPal is not asked again): -> the state of
  // the first that became a plan, else of the newest.
  let pendingP = null;
  function checkPending(subId) {
    if (!pendingP) pendingP = (async () => {
      const list = pendingRecs().filter((r) => (!subId || r.subId === subId) && r.status !== 'EXPIRED' && r.status !== 'CANCELLED');
      let first = null;
      for (const r of list) {
        let st = null;
        try { st = await refresh(r.subId); } catch (e) { st = null; }
        if (st && st.licenseJson) return st;
        if (!first) first = st || stateOf(r);
      }
      return first;
    })().finally(() => { pendingP = null; });
    return pendingP;
  }
  // Dismiss: one last look first (a checkout paid meanwhile becomes the plan), then the note is hidden. The record stays.
  async function dismissPending() {
    const r = pendingRecs()[0];
    if (!r) return readState();
    let st = null; try { st = await checkPending(r.subId); } catch (e) {}
    if (st && st.licenseJson) return st;
    putRec(r.subId, { hidden: true });
    return readState();
  }
  // Continue: a fresh checkout of the same plan (PayPal's approval link of the old one may have run out; the old one
  // was never approved, so it lapses at PayPal by itself, and its record stays).
  async function continueCheckout(say) {
    const r = pendingRecs()[0];
    if (!r) return readState();
    let st = null; try { st = await checkPending(r.subId); } catch (e) {}
    if (st && st.licenseJson) return st;
    putRec(r.subId, { hidden: true });
    return subscribe(r.tier, r.period, say, { from: r.subId });
  }
  // opts.from: the unfinished checkout this one continues (its row then says it was started again, and names this one).
  async function subscribe(tier, period, say, opts) {
    if (RAIL()) return subscribeInApp(tier, period, say || (() => {}));
    const upgrade = await upgradeAsk(tier, period);   // signed by the plan in use (it stays in use until the new one is paid)
    const seed = new Uint8Array(32); crypto.getRandomValues(seed);
    const k = await GifOS.ed.keysFromSeed(seed);
    const buyerKey = b64(k.pubRaw);
    const popup = root.open('about:blank', 'gifos-sub', 'width=480,height=720');
    let j;
    try { j = await post('/gifos/sub/create', Object.assign({ tier, period, buyerKey }, upgrade ? { upgrade } : {})); }
    catch (e) { try { popup && popup.close(); } catch (x) {} throw e; }
    const buy = { rail: 'paypal', period };
    const full = j && j.upgrade && j.upgrade.full;
    if (Number.isInteger(full) && centsPrice(full)) { buy.price = centsPrice(full); buy.currency = 'USD'; }
    putRec(j.id, Object.assign({ tier, period, state: 'pending', status: 'APPROVAL_PENDING', at: Date.now(), buy }, upgrade ? { replaces: upgrade.subId } : {}), { seed: b64(seed), buyerKey, via: 'checkout' });
    if (opts && typeof opts.from === 'string' && opts.from !== j.id && readLedger().subs[opts.from]) putRec(opts.from, { continuedAs: j.id });
    if (popup) popup.location.href = j.approveUrl; else root.open(j.approveUrl, '_blank');
    if (say) say(SUB.TEXT.pending);
    const until = Date.now() + POLL_FOR_MS;
    let last = { subId: j.id, tier, status: 'APPROVAL_PENDING' };
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const r = readLedger().subs[j.id];
      if (r && r.state !== 'pending') return stateOf(r);   // became a plan (another tab, the next keepFresh)
      if (r && r.hidden) return last;                       // dismissed, or replaced by Continue checkout
      let st = null; try { st = await checkPending(j.id); } catch (e) {}
      if (st && st.licenseJson && st.subId === j.id) return st;
      const now = readLedger().subs[j.id];
      if (now && now.status) last = stateOf(now);
      if (now && (now.status === 'EXPIRED' || now.status === 'CANCELLED')) return last;
    }
    return last;
  }
  // ---- the four-hour pass ------------------------------------------------------
  // $1 through PayPal for the Unlimited plan's meeting rights for four hours
  // (never capturing an open room). The passes and the seed of the key they
  // are bound to live in WALLET_KEY and in the subscription file
  // (passes.json). One key holds all of them, so a new pass stacks: the
  // payment service starts it when the latest held pass ends.
  let walletMemo = { seed: null, p: null };
  async function wallet() {
    const w = SUB.walletOk(readJson(WALLET_KEY));
    if (w) return w;
    const pw = (await fromProvidersAll()).wallet;
    if (pw) { writeJson(WALLET_KEY, pw); return pw; }
    return null;
  }
  async function walletKey(w) {
    if (walletMemo.seed !== w.seed) walletMemo = { seed: w.seed, p: GifOS.ed.keysFromSeed(fromB64(w.seed)).then((k) => ({ priv: k.priv, pub: b64(k.pubRaw) })) };
    return walletMemo.p;
  }
  async function ensureWallet() {
    const w = await wallet();
    if (w) return w;
    const seed = new Uint8Array(32); crypto.getRandomValues(seed);
    const k = await GifOS.ed.keysFromSeed(seed);
    const nw = { v: 1, kind: SUB.WALLET_KIND, seed: b64(seed), buyerKey: b64(k.pubRaw), passes: [] };
    writeJson(WALLET_KEY, nw);
    return nw;
  }
  const passOf = (p) => { try { return JSON.parse(p.passJson); } catch (e) { return null; } };
  // EVERY PASS KEY IS KEPT. A wallet holds every pass bought or brought here, under every key: a file with another
  // key never replaces the wallet in use and is never turned away. Its wallet joins the kept ones (WALLET_HISTORY_KEY:
  // only ever added to), and the wallet IN USE (WALLET_KEY) is chosen from all of them: the one holding the best live
  // pass (it gives at least everything the other gives, else the newer one), else the one in use while it still has a
  // pass to come, else one with a pass to come, else the file just brought.
  const joinPasses = (a, b) => { const seen = new Set(); return (a || []).concat(b || []).filter((p) => p && !seen.has(p.passJson) && seen.add(p.passJson)); };
  function keptRaw() { const old = readJson(WALLET_HISTORY_KEY); return Array.isArray(old) ? old.filter((x) => x && typeof x === 'object') : []; }
  const keptWallets = () => keptRaw().map((x) => SUB.walletOk(x)).filter(Boolean);
  // Keep a wallet beside the one in use: a new key is added, a key already kept gains the passes it lacks.
  function keepWallet(w, why) {
    if (!w) return;
    const list = keptRaw();
    const had = list.find((x) => x.seed === w.seed);
    if (had) { had.passes = joinPasses(Array.isArray(had.passes) ? had.passes : [], w.passes); delete had.pending; }
    else { const k = Object.assign({}, w, { replacedAt: Date.now(), why: why || 'kept' }); delete k.pending; list.push(k); }   // a checkout belongs to the wallet in use only
    writeJson(WALLET_HISTORY_KEY, list);
  }
  // A pass the payment service signed goes into the wallet of ITS key (in use or kept), never into another key's.
  // owner: the wallet whose key asked for it (it may have left use meanwhile, in this tab or another).
  async function storePass(j, o, owner) {
    const entry = { passJson: j.passJson, sig: j.sig };
    const mine = async (w) => !!w && (await seedPub(w.seed).catch(() => null)) === o.buyerKey;
    const cur = SUB.walletOk(readJson(WALLET_KEY));   // read now: it may have changed while the order was asked for
    if (cur && await mine(cur)) {
      const next = Object.assign({}, cur, { passes: cur.passes.filter((p) => { const x = passOf(p); return !x || x.order !== o.order; }).concat([entry]) }); delete next.pending;
      writeJson(WALLET_KEY, next);
      return;
    }
    let home = null;
    for (const k of keptWallets()) if (await mine(k)) { home = k; break; }
    if (!home && await mine(owner)) home = owner;
    if (home || !cur) { if (home) keepWallet(Object.assign({}, home, { passes: joinPasses(home.passes, [entry]) }), 'bought'); else writeJson(WALLET_KEY, Object.assign({}, owner, { passes: joinPasses(owner && owner.passes, [entry]) })); return; }
    writeJson(WALLET_KEY, Object.assign({}, cur, { passes: joinPasses(cur.passes, [entry]) }));   // no wallet of its key here: never dropped
  }
  const pubMemo = new Map();
  const seedPub = (seed) => { if (!pubMemo.has(seed)) pubMemo.set(seed, GifOS.ed.keysFromSeed(fromB64(seed)).then((k) => b64(k.pubRaw))); return pubMemo.get(seed); };
  const passCheck = new Map();   // sig|passJson -> the verified pass (only a signature that checked out is remembered)
  // The well-signed passes of one wallet's own key.
  async function walletPasses(w) {
    const pub = await seedPub(w.seed).catch(() => null);
    const out = [];
    for (const p of w.passes) {
      const id = p.sig + '|' + p.passJson;
      if (!passCheck.has(id)) { const o = await SUB.verifyPass(p, verifyPay).catch(() => null); if (o) passCheck.set(id, o); }
      const o = passCheck.get(id);
      if (o && o.buyerKey === pub) out.push(o);
    }
    return out;
  }
  // The best-plan rule for passes: b beats a when b gives at least everything a gives and not the other way round;
  // when neither (or both), the newer one (paid later).
  function passBetter(b, a) {
    if (!a) return true;
    const bCov = SUB.covers(b.grants, a.grants), aCov = SUB.covers(a.grants, b.grants);
    if (bCov !== aCov) return bCov;
    return (b.paid || 0) > (a.paid || 0);
  }
  const bestOf = (list) => list.reduce((a, b) => (passBetter(b, a) ? b : a), null);
  // Choose the wallet in use from every wallet held (prefer: the seed of a file just brought). Moves nothing out:
  // the wallet leaving use is kept. Returns {w, o}: the wallet in use and its best live pass (or null).
  async function chooseWallet(prefer, tries) {
    const cur = SUB.walletOk(readJson(WALLET_KEY));
    const kept = keptWallets().filter((k) => !cur || k.seed !== cur.seed);
    const n = nowS();
    if (!kept.length) return { w: cur, o: cur ? bestOf((await walletPasses(cur)).filter((o) => SUB.passLive(o, n))) : null };
    const all = (cur ? [cur] : []).concat(kept).sort((a, b) => (a.seed < b.seed ? -1 : a.seed > b.seed ? 1 : 0));   // a fixed order: the pick never cycles
    const facts = [];
    for (const w of all) { const ps = await walletPasses(w); facts.push({ w, o: bestOf(ps.filter((o) => SUB.passLive(o, n))), ahead: ps.some((o) => o.end > n) }); }
    let pick = null;
    for (const f of facts) if (f.o && (!pick || passBetter(f.o, pick.o))) pick = f;
    const bySeed = (s) => facts.find((f) => f.w.seed === s) || null;
    if (!pick) {
      const c = cur && bySeed(cur.seed), p = prefer && bySeed(prefer);
      pick = (c && c.ahead && c) || (p && p.ahead && p) || facts.find((f) => f.ahead) || p || c || facts[0];
    }
    // A pass checkout under way belongs to the key it was started with: that wallet stays in use until it ends.
    if (cur && cur.pending && pick.w.seed !== cur.seed) pick = bySeed(cur.seed);
    if (!cur || pick.w.seed !== cur.seed) {
      // Read again after the signature checks: a purchase, a checkout or another tab may have written since.
      const again = SUB.walletOk(readJson(WALLET_KEY));
      if (JSON.stringify(again) !== JSON.stringify(cur)) return (tries || 0) < 3 ? chooseWallet(prefer, (tries || 0) + 1) : { w: again, o: null };
      if (cur) keepWallet(cur, 'not in use');
      const next = SUB.walletOk(pick.w); delete next.pending;
      writeJson(WALLET_KEY, next);
      try { console.info('[meet-subs] pass wallet in use: ' + String(pick.w.buyerKey || '').slice(0, 8) + (pick.o ? ' (' + pick.o.id + ')' : '')); } catch (e) {}
    }
    return { w: pick.w, o: pick.o };
  }
  // A file brought from another browser: with the same key its passes join these; with another key its wallet is kept
  // beside this one, and the wallet in use is chosen again. Returns what it took: {passes, added, inUse, pass}.
  async function mergeWallet(w0) {
    // Only passes signed by the payment service for this file's own key are taken (junk never fills storage or
    // pushes real passes out); a checkout under way is never taken from a file.
    try { await payKey(); } catch (e) { throw new Error('The passes in that file cannot be checked right now (no connection to GifOS). Nothing was changed; try again.'); }
    await walletPasses(w0);   // checks every signature once (passCheck)
    const pub = await seedPub(w0.seed).catch(() => null);
    const w = Object.assign({}, w0, { passes: w0.passes.filter((p) => { const o = passCheck.get(p.sig + '|' + p.passJson); return !!o && o.buyerKey === pub; }) });
    delete w.pending;
    const cur = SUB.walletOk(readJson(WALLET_KEY));
    const known = new Set([].concat(cur ? cur.passes : [], ...keptWallets().map((k) => k.passes)).map((p) => p.passJson));
    const added = w.passes.filter((p) => !known.has(p.passJson)).length;
    if (!cur || cur.seed === w.seed) {
      writeJson(WALLET_KEY, Object.assign({}, w, { passes: joinPasses(cur && cur.seed === w.seed ? cur.passes : [], w.passes), pending: (cur && cur.seed === w.seed && cur.pending) || undefined }));
    } else if (w.passes.length) keepWallet(w, 'brought');   // a key with no good pass adds nothing to keep
    const got = await chooseWallet(cur && cur.seed !== w.seed ? w.seed : null);
    return { passes: w.passes.length, dropped: w0.passes.length - w.passes.length, added, inUse: !!got.w && got.w.seed === w.seed, pass: got.o ? got.o.id : null };
  }
  // Every well-signed pass of this browser's key, by start: [{o, raw}].
  async function passes() {
    const w = await wallet();
    if (!w) return [];
    const key = (await walletKey(w)).pub;
    const out = [];
    for (const p of w.passes) {
      const o = await SUB.verifyPass(p, verifyPay).catch(() => null);
      if (o && o.buyerKey === key) out.push({ o, raw: { passJson: p.passJson, sig: p.sig } });
    }
    return out.sort((a, b) => a.o.start - b.o.start);
  }
  async function livePass() {
    if (keptRaw().length) await chooseWallet().catch(() => null);   // a kept key's pass may have begun, or the one in use ended
    const n = nowS();
    const live = (await passes()).filter((x) => SUB.passLive(x.o, n));
    return live.reduce((a, b) => (!a || passBetter(b.o, a.o) ? b : a), null);   // the best-plan rule, as the wallet in use is chosen
  }
  async function passSign(text) {
    const k = await walletKey(await wallet());
    return b64(await GifOS.ed.sign(k.priv, new TextEncoder().encode(text)));
  }
  // The pass that was live when last looked at; a change (bought, started,
  // ended) is told to the meeting page (hooks.onPass), which re-presents
  // the room's plan and its TURN vouch.
  let passSeen = '';
  function passChanged() { try { if (hooks.onPass) hooks.onPass(); } catch (e) {} }
  async function passWatch() {
    const lp = await livePass().catch(() => null);
    const k = lp ? lp.o.id + ':' + lp.o.end : '';
    if (k !== passSeen) {
      passSeen = k;
      // A pass that started here (a file opened, a window begun) joins this
      // meeting; one that moved to another meeting is never taken back by a
      // watch (only a join the person makes takes it: a page start or a purchase).
      // A ticket held under another key (the wallet in use changed) is no ticket of this pass: join again.
      const otherKey = !!(lp && pmeet && pmeet.key && pmeet.key !== lp.o.buyerKey && pmeet.moved !== 'moved');
      if (lp && meet && (otherKey || !(pmeet && pmeet.room === meet.room && (pmeet.ticket || pmeet.pending || pmeet.moved === 'moved')))) passJoin(meet.room, true, !(meet && meet.ticket));
      passChanged();
    }
  }
  // Ask the payment service for the pass of one PayPal order. Shown: every
  // pass held, so a new one starts where they end.
  async function claimPass(order) {
    const w = await wallet();
    if (!w) return null;
    const k = await walletKey(w);
    const at = nowS();
    const r = await fetch(payBase() + '/gifos/pass/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      order, buyerKey: k.pub, at, sig: b64(await GifOS.ed.sign(k.priv, new TextEncoder().encode(SUB.askMessage('pass', order, at)))), held: w.passes,
    }) });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (r.status === 202 || (j && j.pending)) return { pending: true, status: j && j.status };
    if (!r.ok || !j || !j.passJson) return { refused: true, status: r.status, error: j && j.error };
    const o = await SUB.verifyPass({ passJson: j.passJson, sig: j.sig }, verifyPay).catch(() => null);
    if (!o || o.buyerKey !== k.pub) return { refused: true };
    await storePass(j, o, w);
    notePassPurchase(o);
    keepReceipt();
    passWatch().catch(() => {});
    if (meet) passJoin(meet.room, true, true);   // a new pass (or one stacked on the window): the meeting this page is in takes it now
    return j;
  }
  // Buy: a PayPal order for $1, approved in PayPal's window, then claimed.
  async function buyPass(say) {
    say = say || (() => {});
    if (RAIL()) return buyPassInApp(say);
    const w = await ensureWallet();
    const k = await walletKey(w);
    const popup = root.open('about:blank', 'gifos-pass', 'width=480,height=720');
    let j;
    try { j = await post('/gifos/pass/create', { buyerKey: k.pub }); }
    catch (e) { try { popup && popup.close(); } catch (x) {} throw e; }
    // The order is bound to w's key: w is the wallet in use while it is paid for (one that took its place meanwhile is kept).
    const now = SUB.walletOk(readJson(WALLET_KEY));
    if (now && now.seed !== w.seed) keepWallet(now, 'not in use');
    writeJson(WALLET_KEY, Object.assign({}, now && now.seed === w.seed ? now : w, { pending: j.id }));
    if (popup) popup.location.href = j.approveUrl; else root.open(j.approveUrl, '_blank');
    say(tx('passPending', 'Finish paying in the PayPal window. This updates as soon as PayPal confirms.'));
    const until = Date.now() + POLL_FOR_MS;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const r = await claimPass(j.id).catch(() => null);
      if (r && r.passJson) return r;
      if (r && r.refused) return null;
    }
    return null;
  }
  // A purchase whose page closed before PayPal confirmed is claimed on the next visit.
  async function resumePending() {
    const w = await wallet();
    if (!w || !w.pending) return;
    const r = await claimPass(w.pending).catch(() => null);
    if (r && r.refused && (r.status === 403 || r.status === 404)) { const cur = await wallet(); if (cur) { delete cur.pending; writeJson(WALLET_KEY, cur); } }
  }

  async function cancel() {
    const c0 = await credential();
    if (!(await subIdNow())) return readState();
    const j = await post('/gifos/sub/cancel', await signed('cancel'));
    writeState(Object.assign({}, readState(), { status: j.status, until: j.until }));
    try { await refresh(); } catch (e) {}
    return readState();
  }

  // ---- meetings at once (the plan's `meetings`; one unless it says more) ---------
  // meet: {room, tag, subId, tier, ticket:{ticketJson,sig}, exp, gen, joining, timer, moved}
  let meet = null;
  let hooks = {};
  function stopTimer() { if (meet && meet.timer) { clearTimeout(meet.timer); meet.timer = null; } }
  function schedule(ms) { stopTimer(); if (meet) meet.timer = setTimeout(renewNow, ms); }
  // ---- this browser's memory of the meetings its rights power -------------------------------
  // The payment service knows only meeting tags (never a room's name), so the question "move your plan here?" names the
  // other meetings from this memory: tag -> {name (as the person saw it), people (last count), at}. Every tab of this
  // browser shares it; a meeting powered from another browser is not in it.
  const MEM_KEY = 'gifos-sub-meetings';
  const MEM_MAX = 100;
  function noteMeeting(tag) {
    if (!tag) return;
    let name = null, people = null;
    try { name = hooks.name ? String(hooks.name() || '').slice(0, 80) : null; } catch (e) {}
    try { const n = hooks.people ? Number(hooks.people()) : NaN; people = Number.isInteger(n) && n > 0 ? n : null; } catch (e) {}
    const mem = readJson(MEM_KEY) || {};
    const old = mem[tag] || {};
    mem[tag] = { name: name || old.name || null, people: people || old.people || null, at: nowS() };
    const keys = Object.keys(mem);
    if (keys.length > MEM_MAX) keys.sort((a, b) => (mem[a].at || 0) - (mem[b].at || 0)).slice(0, keys.length - MEM_MAX).forEach((k) => { delete mem[k]; });
    writeJson(MEM_KEY, mem);
  }
  // Meetings this plan is powering. The service returns tags; names come from this browser's memory.
  // A tag this browser has never seen has no name: the page says only that this browser has not been in it.
  async function heldMeetings() {
    const j = await post('/gifos/sub/held', await signed('held'));
    const mem = readJson(MEM_KEY) || {};
    const meetings = (Array.isArray(j.meetings) ? j.meetings : []).map((m) => {
      const k = mem[m.meeting] || {};
      return { meeting: m.meeting, gen: m.gen, at: m.at, name: k.name || null };
    });
    return { meetings, keep: j.keep };
  }
  // moveOptions(subFull, passFull) -> {places, keptPlaces, entries:[{right, meeting, name, people, at}]}: what the
  // question lists. Only rights whose signed overflow is 'ask' are listed; a right that keeps (an organization's plan)
  // never gives up another meeting, so its places only count in keptPlaces (the note "all N … are in use").
  function moveOptions(subFull, passFull) {
    const mem = readJson(MEM_KEY) || {};
    const entries = [];
    let places = 0, keptPlaces = 0;
    const add = (right, f) => {
      if (!f) return;
      if (f.overflow === 'keep') { keptPlaces += f.keep || 0; return; }
      places += f.keep || 0;
      for (const x of f.meetings || []) { const k = mem[x.meeting] || {}; entries.push({ right, meeting: x.meeting, name: k.name || null, people: k.people || null, at: x.at || k.at || null }); }
    };
    add('sub', subFull); add('pass', passFull);
    return { places, keptPlaces, entries };
  }
  function take(j) {
    meet.ticket = { ticketJson: j.ticketJson, sig: j.sig }; meet.exp = j.exp; meet.gen = j.gen; meet.tier = j.tier || meet.tier;
    noteMeeting(meet.tag);
    meet.grants = SUB.ownTicketGrants(j.ticketJson);   // what this ticket grants in this meeting (its signed line items)
    schedule((j.renewEvery || SUB.RENEW_EVERY_S) * 1000);
    try { if (hooks.onTicket) hooks.onTicket(meet.ticket); } catch (e) {}
  }
  function lose(why) {
    if (!meet) return;
    stopTimer();
    meet.ticket = null; meet.moved = why;
    try { if (hooks.onLost) hooks.onLost(why); } catch (e) {}
    if (why === 'moved') viewCall('away');
  }
  async function renewNow() {
    const m = meet;
    if (!m || !m.ticket) return;
    try {
      const j = await post('/gifos/sub/renew', await signed('renew:' + m.tag + ':' + m.gen, { meeting: m.tag, gen: m.gen }, m.subId));
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
    if (meet && meet.room === room && (meet.ticket || meet.moved || meet.pending)) return meet.joining;
    const keep = h || hooks;
    leaveMeeting(!!(pmeet && pmeet.room === room));
    hooks = keep || {};
    const m = meet = { room, tag: null, subId: null, tier: null, ticket: null, exp: 0, gen: 0, timer: null, moved: null, joining: null, pending: true };
    // COUNTS STACK: the subscription goes first; a pass held too joins this meeting only when the subscription has no
    // place for it, or when the pass grants more here (so a pass place is never spent on a meeting the plan covers).
    m.joining = (async () => {
      const c = await credential();
      if (!c) { passJoin(room); return null; }
      // This browser's subscription (or one just bought: the service checks payment at the join). Without one there
      // is nothing to join with: the defaults need no ticket.
      const paidLic = await verifiedLicense();
      m.subId = paidLic ? paidLic.subId : c.subId;
      if (!m.subId) return null;
      m.tag = await SUB.meetingTag(room);
      // COUNTS STACK (Nathan 2026-11-22): with a pass held too, ask for a place only if one is free (ifFree); when the
      // subscription is full and the pass holds this meeting, the pass carries it; when every right is full, the
      // subscription takes it from its oldest meeting.
      // ASK BEFORE MOVING (Nathan 2026-11-22): while a place is free it is simply taken; when every place of every
      // right is full, the person chooses which meeting gives up its place, or keeps this one on the free defaults.
      // A page with no screen (and no chooser) is never asked: its newest meeting wins, as before.
      const choose = hooks.choose || (viewCall('canChoose') === true ? view.askMove : null);
      const lp = await livePass().catch(() => null);
      let j = await post('/gifos/sub/join', await signed('join:' + m.tag, { meeting: m.tag, ifFree: !!lp || !!choose }, m.subId));
      if (meet !== m) return null;
      if (j.full) {
        // The plan is full: a pass with a free place carries this meeting.
        const pt = lp ? await passJoin(room, true, false) : null;
        if (meet !== m) return null;
        if (pt) { m.moved = 'full'; return null; }
        let drop;
        const opts = moveOptions(j, pmeet && pmeet.room === room ? pmeet.full : null);
        // OVERFLOW 'keep' (an organization's plan): nothing to ask and nothing moves; this meeting runs on the free
        // defaults, with a plain note. The payment service refuses to drop another meeting for such a right anyway.
        if (!opts.entries.length) { m.moved = 'kept'; viewCall('overflowNote', opts.keptPlaces); return null; }
        if (choose) {
          const pick = await choose(opts).catch(() => null);
          if (meet !== m) return null;
          if (!pick || pick.keep) { m.moved = 'kept'; viewCall('away'); return null; }   // this meeting runs on the free defaults
          if (pick.right === 'pass') { m.moved = 'full'; passJoin(room, true, true, pick.meeting); return null; }
          drop = pick.meeting;
        }
        j = await post('/gifos/sub/join', await signed('join:' + m.tag, drop ? { meeting: m.tag, drop } : { meeting: m.tag }, m.subId));
        if (meet !== m) return null;
      }
      if (!j.active) { m.moved = 'inactive'; if (lp) passJoin(room, true, true); return null; }   // no paid plan here: the pass alone
      take(j);
      if (lp && !beatsPass(meet.grants, lp.o)) passJoin(room, true, false);   // the pass grants more here: it joins too (if it has a place)
      return m.ticket;
    })().catch(() => null).then((t) => { m.pending = false; return t; });
    return m.joining;
  }
  function leaveMeeting(keepPass) { stopTimer(); meet = null; hooks = {}; if (!keepPass) { passStop(); pmeet = null; } }
  // The subscription on this browser changed (signed up, or a file opened):
  // the meeting this page is in joins with it now.
  // upgrade: a new subscription just arrived, so the meeting joins again with it (the room then carries what it grants).
  function rejoin(upgrade) { if (meet && (!meet.ticket || upgrade)) { const room = meet.room; stopTimer(); meet = null; joinMeeting(room); } }
  async function currentTicket(room) {
    if (!meet || meet.room !== room) return null;
    await meet.joining;
    return meet && meet.ticket && nowS() < meet.exp ? meet.ticket : null;
  }

  // ---- a four-hour pass: one meeting at a time --------------------------------
  // The pass's key and passes ride in the provider GIF, so a copy is the whole
  // credential: the pass is never shown to a room, a door or the TURN Worker
  // itself. Joining a meeting shows the held passes to the payment service,
  // which keeps the pass key's newest meeting and signs a pass meeting ticket
  // for it, renewed every RENEW_EVERY_S; a join anywhere else moves it there
  // and this meeting's renewal is refused (moved), exactly as a subscription.
  // pmeet: {room, tag, ticket:{ticketJson,sig}, exp, gen, until, timer, moved, joining, pending}
  let pmeet = null;
  function passStop() { if (pmeet && pmeet.timer) { clearTimeout(pmeet.timer); pmeet.timer = null; } }
  function passSchedule(m, ms) { if (m.timer) clearTimeout(m.timer); m.timer = setTimeout(() => passRenewNow(m), ms); }
  async function passSigned(action, extra) {
    const k = await walletKey(await wallet());
    const at = nowS();
    return Object.assign({ buyerKey: k.pub, at, sig: b64(await GifOS.ed.sign(k.priv, new TextEncoder().encode(SUB.askMessage(action, k.pub, at)))) }, extra || {});
  }
  function passTake(m, j) {
    m.ticket = { ticketJson: j.ticketJson, sig: j.sig }; m.exp = j.exp; m.gen = j.gen; m.until = j.until || m.until; m.moved = null;
    noteMeeting(m.tag);
    m.grants = SUB.ownTicketGrants(j.ticketJson);   // what this pass grants in this meeting (its signed line items)
    passSchedule(m, (j.renewEvery || SUB.RENEW_EVERY_S) * 1000);
    passChanged();
  }
  function passLose(m, why) {
    if (m.timer) { clearTimeout(m.timer); m.timer = null; }
    m.ticket = null; m.moved = why;
    if (pmeet !== m) return;
    // The room's plan and the TURN vouch fall back to the subscription, or out.
    if (meet && meet.ticket) passChanged();
    else { try { if (hooks.onLost) hooks.onLost(why === 'moved' ? 'pass-moved' : 'pass-' + why); } catch (e) {} }
  }
  async function passRenewNow(m) {
    if (pmeet !== m || !m.ticket) return;
    try {
      const j = await post('/gifos/pass/renew', await passSigned('pass-renew:' + m.tag + ':' + m.gen, { meeting: m.tag, gen: m.gen }));
      if (pmeet !== m) return;
      if (j.moved) return passLose(m, 'moved');
      if (j.ended || !j.active) {
        // The window ran out; a pass bought since may carry on (a new join).
        if (await livePass().catch(() => null)) { passJoin(m.room, true, true); return; }
        return passLose(m, 'ended');
      }
      passTake(m, j);
    } catch (e) {
      if (pmeet === m) { if (nowS() >= (m.exp || 0)) passLose(m, 'unreachable'); else passSchedule(m, RETRY_MS); }
    }
  }
  // evict: a person's act (a pass bought or begun here) takes the meeting even when every place is held; otherwise, with a
  // subscription held too, the pass asks for a place only if one is free (ifFree: counts stack).
  // drop: the meeting the person chose to take the pass from (when every place is full).
  function passJoin(room, force, evict, drop) {
    if (!force && pmeet && pmeet.room === room && (pmeet.ticket || pmeet.moved || pmeet.pending)) return pmeet.joining;
    passStop();
    const m = pmeet = { room, tag: null, ticket: null, exp: 0, gen: 0, until: 0, timer: null, moved: null, joining: null, pending: true };
    m.joining = (async () => {
      if (!(await livePass())) return null;
      const w = await wallet();
      m.key = (await walletKey(w)).pub;
      m.tag = await SUB.meetingTag(room);
      const ifFree = !evict && !!(await credential());
      const j = await post('/gifos/pass/join', await passSigned('pass-join:' + m.tag, Object.assign({ meeting: m.tag, passes: w.passes, ifFree }, drop ? { drop } : {})));
      if (pmeet !== m) return null;
      if (j.full) { m.moved = 'full'; m.full = { keep: j.keep || 1, overflow: j.overflow === 'keep' ? 'keep' : 'ask', meetings: j.meetings || [] }; return null; }
      if (!j.active) { m.moved = 'inactive'; return null; }
      passTake(m, j);
      return m.ticket;
    })().catch(() => null).then((t) => { m.pending = false; return t; });
    return m.joining;
  }
  // This meeting's pass ticket, or null. A page that knocks before its
  // meeting started (no join yet) joins with the pass now.
  async function currentPassTicket(room) {
    if (!pmeet || pmeet.room !== room) { if (!(await livePass().catch(() => null))) return null; passJoin(room, true); }
    const m = pmeet;
    await m.joining;
    return m.ticket && nowS() < m.exp ? m.ticket : null;
  }

  // ---- the room's plan and the door's challenge ----------------------------
  // The admin's order that carries their plan into the room, or null.
  // A live four-hour pass rides instead of a ticket whose plan is below it
  // (none, free, $2): the best right held is the one the room reads.
  // A clear-video item rides with the credential that carries it: the room reads ONE ticket, so a pass that carries
  // clearWithoutPassword / clearStageInAdminRoom (and a subscription that does not) rides instead.
  const clearRank = (g) => { const x = g && SUB.grantsOk(g); return !x ? 0 : x.clearWithoutPassword ? 2 : x.clearStageInAdminRoom ? 1 : 0; };
  const beatsPass = (grants, pass) => !!grants && !!pass && clearRank(grants) >= clearRank(pass.grants) && (clearRank(grants) > clearRank(pass.grants) || SUB.rank(SUB.ticketRights({ grants, exp: 1 })) >= SUB.rank(SUB.passRights(Object.assign({}, pass, { end: 1 }))));   // line items against line items (equal: the subscription's ticket rides)
  async function roomOrder(room) {
    const ticket = await currentTicket(room);
    const lp = ticket && meet ? await livePass().catch(() => null) : null;
    if (!(ticket && meet && beatsPass(meet.grants, lp && lp.o))) {
      const pt = await currentPassTicket(room);
      if (pt) {
        const at = Date.now();
        return { on: true, at, ticket: pt, proof: await passSign(SUB.proofMessage(SUB.roomContext(room), 'at:' + at)) };
      }
    }
    if (!ticket) return null;
    const at = Date.now();
    return { on: true, at, ticket, proof: await signText(SUB.proofMessage(SUB.roomContext(room), 'at:' + at)) };
  }
  // THE ROOM ACL: this browser's own meeting right for the meeting, as the
  // meeting service reads it ({ticketJson, sig}), or null. The service keeps
  // only the permissions it carries. The better of the subscription's meeting
  // ticket and a live four-hour pass's, by the same rank the room order uses.
  async function meetingRight(room) {
    const ticket = await currentTicket(room);
    const lp = ticket && meet ? await livePass().catch(() => null) : null;
    if (!(ticket && meet && beatsPass(meet.grants, lp && lp.o))) {
      const pt = await currentPassTicket(room);
      if (pt) return pt;
    }
    return ticket || null;
  }
  // The room's plan from the order the room carries: {tier, exp} or null.
  async function roomTier(order, room) {
    try { return await SUB.roomTierOf(order, room, verifyPay, verifyKey, nowS()); } catch (e) { return null; }
  }
  // A knocker answering the door's challenge, or null without a ticket here.
  async function proveAtDoor(room, nonce) {
    const ticket = await currentTicket(room);
    if (ticket && meet && meet.grants && meet.grants.admitAtFullDoor) return { ticket, proof: await signText(SUB.proofMessage(SUB.doorContext(room), nonce)) };
    // A four-hour pass in this meeting is let in as a subscriber is; a free plan is no way past a room's line.
    const pt = await currentPassTicket(room);
    if (pt) return { ticket: pt, proof: await passSign(SUB.proofMessage(SUB.doorContext(room), nonce)) };
    return null;
  }
  // The door checking a knocker's answer.
  async function checkShown(shown, room, nonce) {
    try { return !!(await SUB.doorProofOk(shown, room, nonce, verifyPay, verifyKey, nowS())); } catch (e) { return false; }
  }
  const newNonce = () => { const u = new Uint8Array(18); crypto.getRandomValues(u); return 'n' + b64(u).replace(/[+/=]/g, ''); };

  // ---- an open room's admin (capture) ------------------------------------------
  // Whoever holds a meeting right whose permissions say capture may take an
  // open room: any ticket whose line items say captureOpenRoom (the $5 and $10 presets; never $2 or the $1 pass), and any pass
  // signed with capture (the staff pass; never the $1 pass). captureVia:
  // which of this browser's rights for the meeting carries it ('sub', 'pass') or null.
  function captureVia(room) {
    const n = nowS();
    if (meet && meet.room === room && meet.ticket && n < meet.exp && meet.grants && meet.grants.captureOpenRoom) return 'sub';
    if (pmeet && pmeet.room === room && pmeet.ticket && n < pmeet.exp && pmeet.grants && pmeet.grants.captureOpenRoom) return 'pass';
    return null;
  }
  function canCapture(room) { return !!captureVia(room); }
  // A captor's ticket checked by anyone in the room: the meeting right or null.
  async function captureTicket(tk, room) {
    try { return await SUB.captureRight(tk, verifyPay, nowS(), await SUB.meetingTag(room)); } catch (e) { return null; }
  }
  // The ticket that carries this browser's capture now (renewed), or null.
  async function captureCurrent(room) {
    const via = captureVia(room);
    return via === 'sub' ? currentTicket(room) : via === 'pass' ? currentPassTicket(room) : null;
  }
  // {tk, w}: the ticket and an order signed by the ticket's key, for the meeting server.
  // peer: this page's relay peer id, signed in so the server binds the proof to the socket that sends it (Clear Stage).
  async function captureOrder(room, peer) {
    const via = captureVia(room);
    if (!via) return null;
    const tk = await captureCurrent(room); if (!tk) return null;
    const k = via === 'pass' ? await walletKey(await wallet()) : await myKey(), sp = JSON.stringify(Object.assign({ act: 'capture', ts: Date.now(), room }, peer ? { peer: String(peer) } : {}));
    return { tk, w: { sp, sig: b64(await GifOS.ed.sign(k.priv, new TextEncoder().encode(sp))), pub: k.pub } };
  }
  // The keys that sign as the captor: the pass key when ck (the room's captor
  // key) is this browser's pass key, else the subscription's.
  async function captureKeys(ck) {
    const w = ck ? await wallet().catch(() => null) : null;
    const pk = w ? await walletKey(w) : null;
    const k = pk && pk.pub === ck ? pk : await myKey();
    return { priv: k.priv, pubB64: k.pub };
  }
  async function credentialsNow() {
    const n = nowS();
    const lic = await verifiedLicense();
    const st = readState();
    const cred = await credential();
    let sub = null;
    if (lic) {
      const status = st.status === 'CANCELLED' ? 'cancelled' : st.paidThrough && st.paidThrough < n ? 'grace' : 'active';
      sub = { subId: lic.subId, tier: lic.tier, grants: lic.grants || null, period: cred && cred.period === 'yearly' ? 'yearly' : 'monthly', status, until: st.until || lic.exp, renews: status === 'active' ? st.paidThrough || null : null };
    }
    const mine = (await passes().catch(() => [])).filter((x) => x.o.end > n);
    const held = mine.map((x) => ({ id: x.o.id, start: x.o.start, end: x.o.end, live: SUB.passLive(x.o, n), never: !Number.isFinite(x.o.end), plan: x.o.plan, capture: x.o.grants.captureOpenRoom, grants: x.o.grants }));
    const base = SUB.rightsOf(lic, n);   // no license: the defaults
    // The passes run back to back: the window in effect ends with the last
    // pass of the same permissions that follows on without a gap (passChain).
    const chain = SUB.passChain(mine.map((x) => x.o), n);
    const passEnd = chain ? chain.until : 0;
    const best = chain ? SUB.heldRights([base, SUB.passRights(Object.assign({}, chain.live, { end: Number.isFinite(passEnd) ? passEnd : null }))]) : base;
    // grants: the line items in effect now (the union held), what a page decides on; tier stays the name to show.
    const now = best.pass ? { tier: best.tier, why: 'pass', until: passEnd, grants: best.grants, passGrants: chain.live.grants, passLen: Number.isFinite(chain.live.end) ? chain.live.end - chain.live.start : null } : base.signed ? { tier: base.tier, why: 'sub', until: base.until, grants: base.grants } : { tier: null, why: 'none', grants: null };
    const then = best.pass && base.signed ? base.tier : null;
    // Passes under a kept key (not the wallet in use): still held, listed, chosen again when they give more.
    const inUse = SUB.walletOk(readJson(WALLET_KEY));
    const kept = [];
    for (const w of keptWallets()) {
      if (inUse && w.seed === inUse.seed) continue;
      for (const o of await walletPasses(w).catch(() => [])) if (o.end > n) kept.push({ id: o.id, start: o.start, end: o.end, never: !Number.isFinite(o.end), plan: o.plan, grants: o.grants, kept: true });
    }
    return { sub, free: !lic, passes: held, kept, now, then };   // free: no plan, the defaults
  }
  // What the Subscription table in Settings marks as selected (no separate status line).
  function subSelection(c) {
    const pass = !!(c && c.now && c.now.why === 'pass');
    const sub = c && c.sub ? c.sub : null;
    const tier = sub && sub.tier ? sub.tier : null;
    const period = tier ? (sub.period === 'yearly' ? 'yearly' : 'monthly') : null;
    return { free: !tier && !pass, tier: tier || null, period, pass };
  }

  // ---- admin rooms: making one -------------------------------------------------
  // mayCreateAdminRoom(say) -> true: anyone may make an admin room. Without
  // a plan everyone has the defaults (up to 5 people); nothing is fetched;
  // a payment service that cannot be reached does not stop the room.
  async function mayCreateAdminRoom(say) {
    const r = await planRights();
    if (r.adminRooms) return true;
    return true;
  }

  // ---- a full door: what gets a person in, read from the rights ------------------
  // Subscriptions are signed menus of rights (Nathan 2026-11-20): which offer
  // shows is chosen from what each product GRANTS, never from its name. A pass
  // preset or a plan is offered at a full door when its rights admit there
  // (pastFull; admitAtFullDoor in the line-item words), and to a host when its
  // rights carry no people line. The words may name the product.
  const admitsAtFull = (g) => !!(g && (g.pastFull === true || g.admitAtFullDoor === true));
  const amountOf = (price) => { const v = parseFloat(String(price || '').replace(/[^0-9.]/g, '')); return Number.isFinite(v) ? v : Infinity; };
  // A plan's line items as sold (SUB.TIERS[id].grants); the people line is its roomLimit (null: no line).
  const planGrants = (id) => (SUB.TIERS[id] && SUB.TIERS[id].grants) || null;
  const planLine = (id) => { const g = planGrants(id); return g && 'roomLimit' in g ? g.roomLimit : undefined; };
  const cheapest = (list) => list.sort((a, b) => amountOf(a.price) - amountOf(b.price))[0] || null;
  // fullOffers(app) -> {pass: {preset, price, hours} | null, sub: {tier, price} | null}
  //   pass: the cheapest pass on sale whose rights admit at a full door
  //   sub:  the cheapest plan this app sells whose rights admit at a full door
  function fullOffers(app) {
    const presets = SUB.PASS_PRESETS || {};
    const passes = Object.keys(presets).filter((k) => presets[k] && presets[k].sold && admitsAtFull(presets[k].grants || presets[k].perms))
      .map((k) => { const s = typeof presets[k].seconds === 'function' ? presets[k].seconds() : presets[k].seconds; return { preset: k, price: presets[k].price, hours: Number.isFinite(s) && s > 0 ? Math.round(s / 360) / 10 : null }; });
    const subs = SUB.tiersSoldIn(app || appNow()).filter((t) => admitsAtFull(planGrants(t))).map((t) => ({ tier: t, price: SUB.TIERS[t].price }));
    return { pass: cheapest(passes), sub: cheapest(subs) };
  }
  // hostOffer(app) -> {tier, price} | null: the cheapest plan this app sells whose rights carry no people line.
  function hostOffer(app) {
    return cheapest(SUB.tiersSoldIn(app || appNow()).filter((t) => planLine(t) === null).map((t) => ({ tier: t, price: SUB.TIERS[t].price })));
  }
  // doorRight() -> true when this browser now holds a right a full door lets in
  // (a subscription or a live pass whose rights say so). Read here, no server.
  async function doorRight() {
    try { const r = await rights(); return !!(r && (r.bypassLimit === true || r.admitAtFullDoor === true)); } catch (e) { return false; }
  }
  // Join this meeting again. The first ask still sends ifFree, so the service lists the meetings instead of
  // dropping the oldest itself, and the person picks which meeting gives up its place. The join that takes the
  // place is the second one, and that one omits ifFree.
  function takePlanHere() {
    if (!meet || !meet.room) return;
    const room = meet.room;
    const keep = hooks;
    stopTimer();
    meet = null;
    joinMeeting(room, keep);
  }

  let booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    keepFresh().catch(() => {});
    resumePending().catch(() => {});
    if (RAIL()) {
      // The store may hold a purchase this app has not been handed yet.
      restoreInApp().catch(() => {});
      root.addEventListener('gifosnative', (ev) => { const d = ev && ev.detail; if (d && d.type === 'store' && d.event === 'purchases-updated') restoreInApp().then(() => viewCall('changed')).catch(() => {}); });
    }
    passWatch().catch(() => {});
    setInterval(() => { passWatch().catch(() => {}); viewCall('changed'); }, POLL_MS);   // a pass starting or ending re-presents the room's plan
  }
  // Before anything reads the credential: what pages from before the ledger stored becomes records (never lost).
  try { ingestLegacy(); } catch (e) {}
  // A host with no page runs the same renewals and pass watch at once (no lobby, no dialogs). A page with a screen
  // starts them when its view says the page is ready (boot(), called by js/core/view/subs.js).
  if (NOPAGE) boot();

  // THE one rights call every interface reads (SDKs, MCP, the hosted-bot host): the union held now, as plain JSON.
  GifOS.rights = async () => SUB.rightsJson(await rights());
  GifOS.meetSubs = {
    moveOptions, attachView, boot, takePlanHere,
    // what the view reads (words and state, no cards): tx, nowS, rail, verifiedLicense, readState, wallet, b64, fromB64
    tx, nowS, rail: RAIL, verifiedLicense, readState, wallet, b64, fromB64,
    rights, planRights, refresh, keepFresh, subscribe, cancel, buyPass, claimPass, passes, livePass, credentialsNow, subSelection, mayCreateAdminRoom, fullOffers, hostOffer, doorRight,
    roomOrder, roomTier, meetingRight, proveAtDoor, checkShown, newNonce,
    appNow, joinMeeting, leaveMeeting, currentTicket, canCapture, captureTicket, captureCurrent, captureOrder, captureKeys, fileBytes, downloadFile, useFile, installCreds, movePackage, heldMeetings, credential, librarySigner, restoreInApp,
    keepReceipt, subReceiptFiles,
    pendingCheckout, checkPending, dismissPending, continueCheckout, receiptSets, purchases, hidePurchase, continuePurchase,
    passMeeting: () => (pmeet ? { grants: pmeet.grants || null, room: pmeet.room, gen: pmeet.gen, exp: pmeet.exp, until: pmeet.until, moved: pmeet.moved, held: !!pmeet.ticket } : null),
    currentPassTicket,
    meeting: () => (meet ? { room: meet.room, gen: meet.gen, exp: meet.exp, moved: meet.moved, held: !!meet.ticket, tier: meet.tier, grants: meet.grants || null, paid: !!(meet.ticket && meet.grants && meet.grants.admitAtFullDoor) } : null),
  };
})(typeof window !== 'undefined' ? window : globalThis);
