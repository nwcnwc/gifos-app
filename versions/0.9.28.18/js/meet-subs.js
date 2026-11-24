/*
 * meet-subs.js — GifOS subscriptions in the meeting page.
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
 *     the four-hour pass and tips. The $10 Streamer plan and its library
 *     (My library, files.gifos.app) are offered and managed only in the
 *     Broadcast app: the same page opened at /cast (#bc in the link). Meet
 *     honors a Streamer subscription with everything Unlimited gives, but
 *     never sells it and never shows its files (appNow, SUB.tiersSoldIn).
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
  const WALLET_KEY = 'gifos-pass-wallet';  // this browser's four-hour passes and their key (passes.json in the subscription file)
  // New words read the meeting's catalog (i18n/<lang>/meet.json); English stays beside the call.
  const tx = (key, en) => { try { const L = GifOS.i18n; if (L && L.ui() !== 'en' && L.has('meet.' + key)) return L.t('meet.' + key); } catch (e) {} return en; };
  const POLL_MS = TM.SUBS_POLL_MS;
  const POLL_FOR_MS = TM.SUBS_POLL_FOR_MS;
  const RETRY_MS = TM.SUBS_RETRY_MS;                  // a renewal that could not reach the service tries again
  const REFRESH_BEFORE_S = TM.REFRESH_BEFORE_S;      // fetch a fresh license this long before it runs out

  // The address the page was opened with. Once the meeting page joins it
  // rewrites its own address to the room's plain link, so a word in the link
  // (#bc) is read from both.
  const opened = (() => { try { return { hash: String(root.location.hash || ''), search: String(root.location.search || '') }; } catch (e) { return null; } })();
  // In the GifOS Meet apps everything is paid for through the store's own
  // purchase sheet (gifos-store-rail.js): the one rail there. RAIL() is null
  // in a browser.
  // The Broadcast app is this page opened with #bc (route.html /cast);
  // everything else is the Meet app. Read from the address the page was
  // opened with as well as the current one.
  const BC_RE = /(?:^|[#&?])bc(?:=[^&]*)?(?:&|$)/;
  function appNow() {
    try { if (root.document && root.document.body && root.document.body.classList.contains('broadcast')) return 'broadcast'; } catch (e) {}
    try {
      const cur = root.location;
      if (BC_RE.test(String(cur.hash || '') + '&' + String(cur.search || ''))) return 'broadcast';
      if (opened && BC_RE.test(opened.hash + '&' + opened.search)) return 'broadcast';
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
  const readState = () => readJson(STATE_KEY) || {};
  const writeState = (s) => writeJson(STATE_KEY, s || {});

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
      const out = { cred: null, wallet: null };
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
        if (where === 'sys_purchases') {
          if (!isSubReceipt(arc.files)) continue;
          if (!out.cred) out.cred = SUB.credentialOk(fileJson(arc.files, 'subscription.json'));
          if (!out.wallet) out.wallet = SUB.walletOk(fileJson(arc.files, 'passes.json'));
        } else {
          if (!out.cred) out.cred = SUB.credentialFromFiles(arc.files);
          if (!out.wallet) out.wallet = SUB.walletFromFiles(arc.files);
        }
        if (out.cred && out.wallet) break;
      }
      return out;
    })().catch(() => ({ cred: null, wallet: null }));
    return provP;
  }
  const fromProviders = async () => (await fromProvidersAll()).cred;
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
    const w = await wallet();
    if (!c && !w) throw new Error('No subscription on this browser.');
    return GifOS.gif.encode(SUB.credentialFiles(c, w), { accent: [120, 200, 255] });
  }
  async function downloadFile() {
    const bytes = await fileBytes();
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/gif' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'GifOS subscription.gif';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  // THE SUBSCRIPTION IN PURCHASES. A plan or pass bought here also lands in
  // the Home Screen's Purchases folder as a RECEIPT: the same credential the
  // subscription file holds (subscription.json, passes.json) plus the signed
  // license, in a receipt GIF (appId 'gifos-receipt', subscription: true).
  // One file per browser, rewritten in place when the plan or the passes
  // change; the desktop places it (gifos_pay_pending, as for every receipt).
  // Best-effort: a page with no Home Screen store just skips it.
  const SUB_RECEIPT_KEY = 'gifos-sub-receipt';   // { fileId, mark } of this browser's subscription receipt
  const PAY_PENDING = 'gifos_pay_pending';       // gifos-pay-broker.js PENDING_KEY: the desktop's placement queue
  function subReceiptFiles(c, w, st) {
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
    return files;
  }
  let receiptBusy = null;
  function keepReceipt() {
    if (receiptBusy) return receiptBusy.then(keepReceipt);
    receiptBusy = (async () => {
      const store = GifOS.store, gif = GifOS.gif;
      if (!store || !store.putFile || !store.uid || !gif || !gif.encode) return;
      const c = SUB.credentialOk(readJson(CRED_KEY));
      const w = SUB.walletOk(readJson(WALLET_KEY));
      const st = readState();
      const held = readJson(SUB_RECEIPT_KEY) || {};
      const live = !!(c && st.licenseJson && st.subId === c.subId);
      // A credential goes in once its plan was paid for, and STAYS in after
      // the plan lapses: its key is what reopens a Streamer library.
      const keepSub = !!c && (live || held.sub === c.subId);
      const passN = w ? w.passes.length : 0;
      if (!keepSub && !passN) return;   // nothing bought yet: no receipt
      const mark = [keepSub ? c.subId : '', live ? c.tier : '', passN].join('|');
      if (held.mark === mark && held.fileId) return;
      const fileId = typeof held.fileId === 'string' && held.fileId ? held.fileId : store.uid('file');
      const bytes = await gif.encode(subReceiptFiles(keepSub ? c : null, w, st), { accent: [120, 200, 255] });
      await store.putFile({ id: fileId, name: tx('subReceiptName', 'Receipt — GifOS Meet subscription') + '.gif', bytes, kind: 'gif', isApp: true, appId: RECEIPT_APP_ID, mime: 'image/gif' });
      writeJson(SUB_RECEIPT_KEY, { fileId, mark, sub: keepSub ? c.subId : null });
      // Queued every time: the desktop skips a fileId it already placed.
      const q = readJson(PAY_PENDING);
      const list = Array.isArray(q) ? q : [];
      if (list.indexOf(fileId) < 0) { list.push(fileId); writeJson(PAY_PENDING, list); }
    })().catch(() => {}).finally(() => { receiptBusy = null; });
    return receiptBusy;
  }
  // Use a file brought from another browser. Its key must be the key the
  // subscription was made for (checked by the payment service on every ask).
  async function useFile(bytes) {
    const arc = await GifOS.gif.decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    const c = arc && SUB.credentialFromFiles(arc.files);
    const w = arc && SUB.walletFromFiles(arc.files);
    if (w) { mergeWallet(w); passChanged(); }
    if (!c && w) return readState();
    if (!c) throw new Error('That file is not a GifOS subscription.');
    writeJson(CRED_KEY, c);
    keyMemo = { seed: null, p: null };
    writeState({ subId: c.subId, tier: c.tier, status: null });
    const st = await refresh();
    rejoin(true);
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
    if (libKeyMemo.seed !== c.seed) {
      libKeyMemo = { seed: c.seed, p: (async () => {
        const ikm = await crypto.subtle.importKey('raw', fromB64(c.seed), 'HKDF', false, ['deriveKey']);
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
    if (!r.ok && !(j && (j.moved || j.ended))) throw new Error((j && j.error) || ('The payment service answered ' + r.status + '.'));
    return j || {};
  }
  async function subIdNow() { const c = await credential(); return c ? c.subId : readState().subId; }
  async function signed(action, extra, asId) {
    const subId = asId || (await subIdNow());
    const at = nowS();
    return Object.assign({ subId, buyerKey: (await myKey()).pub, at, sig: await signText(SUB.askMessage(action, subId, at)) }, extra || {});
  }
  // Ask the payment service for a fresh license; keep what it says.
  async function refresh() {
    const c0 = await credential();
    if (!(await subIdNow())) return null;
    const j = await post('/gifos/sub/license', await signed('license'));
    const st = readState();
    const next = Object.assign({}, st, { subId: await subIdNow(), status: j.status, tier: j.tier || st.tier, until: j.until || null, paidThrough: j.paidThrough || null, checkedAt: Date.now() });
    if (j.active && j.licenseJson) { next.licenseJson = j.licenseJson; next.sig = j.sig; delete next.lastLicenseJson; delete next.lastSig; }
    else {
      // The last license is kept for My library: after a plan ends, its
      // files stay readable for the keep window, shown with that license.
      if (st.licenseJson) { next.lastLicenseJson = st.licenseJson; next.lastSig = st.sig; }
      delete next.licenseJson; delete next.sig;
    }
    writeState(next);
    if (next.licenseJson) keepReceipt();
    return next;
  }
  // keepFresh() -> once this browser's license is fresh (fetched when missing or near its end). One check at a time: the
  // page's boot starts it, and every reader of the license (Settings, the /subscription page) awaits the same one, so
  // a returning subscriber whose license is not stored yet is never shown "no plan" while it is on its way.
  let freshP = null;
  function keepFresh() {
    if (!freshP) {
      freshP = (async () => {
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
    const cur = SUB.credentialOk(readJson(CRED_KEY));
    const held = readJson(STORE_PENDING);
    let seedB64 = !fresh && cur ? cur.seed : held && typeof held.seed === 'string' ? held.seed : null;
    if (!seedB64) { const seed = new Uint8Array(32); crypto.getRandomValues(seed); seedB64 = b64(seed); writeJson(STORE_PENDING, { seed: seedB64 }); }
    const k = await GifOS.ed.keysFromSeed(fromB64(seedB64));
    return { seed: seedB64, buyerKey: b64(k.pubRaw), sign: async (text) => b64(await GifOS.ed.sign(k.priv, new TextEncoder().encode(text))) };
  }
  async function keepStoreSub(k, r) {
    writeJson(CRED_KEY, { v: 1, kind: SUB.CRED_KIND, subId: r.subId, tier: r.tier, period: r.period, seed: k.seed, buyerKey: k.buyerKey });
    writeJson(STORE_PENDING, null);
    keyMemo = { seed: null, p: null };
    writeState({ subId: r.subId, tier: r.tier, status: null });
    const st = await refresh();
    rejoin(true);
    return st;
  }
  async function subscribeInApp(tier, period, say) {
    const rail = RAIL();
    const cur = SUB.credentialOk(readJson(CRED_KEY));
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
      const cur = (await wallet()) || (await ensureWallet());
      const list = cur.passes.filter((p) => { const x = passOf(p); return x && x.order !== o.order; }).concat([{ passJson: j.passJson, sig: j.sig }]);
      const next = Object.assign({}, cur, { passes: list }); delete next.pending;
      writeJson(WALLET_KEY, next);
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
    const cur = SUB.credentialOk(readJson(CRED_KEY));
    const lic = cur ? await verifiedLicense().catch(() => null) : null;
    const st = readState();
    if (!cur || !lic || !/^I-/.test(cur.subId) || st.status === 'CANCELLED') return null;
    if (!SUB.upgradeOk({ tier: cur.tier, period: cur.period }, { tier, period })) throw new Error(tx('subNotUpgrade', 'That is not an upgrade of your plan. A bigger plan replaces yours; to change to another, cancel yours first.'));
    const k = await myKey(), at = nowS();
    return { subId: cur.subId, buyerKey: k.pub, at, sig: await signText(SUB.askMessage('upgrade:' + tier + ':' + period, cur.subId, at)) };
  }
  async function subscribe(tier, period, say) {
    if (RAIL()) return subscribeInApp(tier, period, say || (() => {}));
    const upgrade = await upgradeAsk(tier, period);   // before the new key replaces the old one here
    const seed = new Uint8Array(32); crypto.getRandomValues(seed);
    const k = await GifOS.ed.keysFromSeed(seed);
    const buyerKey = b64(k.pubRaw);
    const popup = root.open('about:blank', 'gifos-sub', 'width=480,height=720');
    let j;
    try { j = await post('/gifos/sub/create', Object.assign({ tier, period, buyerKey }, upgrade ? { upgrade } : {})); }
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
      if (st && st.licenseJson) { rejoin(true); return st; }
      if (st && st.status && st.status !== 'APPROVAL_PENDING' && st.status !== 'APPROVED') return st;
    }
    return readState();
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
  // A file brought from another browser: with the same key its passes join
  // these; with another key it replaces a wallet holding no pass still to use.
  function mergeWallet(w) {
    const cur = SUB.walletOk(readJson(WALLET_KEY));
    const n = nowS();
    // Still to use = readable under today's rules (checkPass: it carries line items) and not run out. A pass signed
    // before line items can never be used again, so it never keeps a new file out.
    if (cur && cur.seed !== w.seed && cur.passes.some((p) => { const o = SUB.checkPass(passOf(p)); return o && o.end > n; })) return false;
    const seen = new Set();
    const passes = (cur && cur.seed === w.seed ? cur.passes : []).concat(w.passes).filter((p) => !seen.has(p.passJson) && seen.add(p.passJson));
    writeJson(WALLET_KEY, Object.assign({}, w, { passes, pending: (cur && cur.seed === w.seed && cur.pending) || w.pending }));
    return true;
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
    const n = nowS();
    const live = (await passes()).filter((x) => SUB.passLive(x.o, n));
    return live.length ? live[live.length - 1] : null;
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
      if (lp && meet && !(pmeet && pmeet.room === meet.room && (pmeet.ticket || pmeet.pending || pmeet.moved === 'moved'))) passJoin(meet.room, true, !(meet && meet.ticket));
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
    const cur = (await wallet()) || w;
    const list = cur.passes.filter((p) => { const x = passOf(p); return x && x.order !== o.order; }).concat([{ passJson: j.passJson, sig: j.sig }]);
    const next = Object.assign({}, cur, { passes: list }); delete next.pending;
    writeJson(WALLET_KEY, next);
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
    writeJson(WALLET_KEY, Object.assign({}, (await wallet()) || w, { pending: j.id }));
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
      const choose = hooks.choose || (root.document && root.document.body ? askMove : null);
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
        if (!opts.entries.length) { m.moved = 'kept'; if (root.document && root.document.body) showOverflowNote(opts.keptPlaces); return null; }
        if (choose) {
          const pick = await choose(opts).catch(() => null);
          if (meet !== m) return null;
          if (!pick || pick.keep) { m.moved = 'kept'; return null; }   // this meeting runs on the free defaults
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
  const beatsPass = (grants, pass) => !!grants && !!pass && SUB.rank(SUB.ticketRights({ grants, exp: 1 })) >= SUB.rank(SUB.passRights(Object.assign({}, pass, { end: 1 })));   // line items against line items (equal: the subscription's ticket rides)
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
  async function captureOrder(room) {
    const via = captureVia(room);
    if (!via) return null;
    const tk = await captureCurrent(room); if (!tk) return null;
    const k = via === 'pass' ? await walletKey(await wallet()) : await myKey(), sp = JSON.stringify({ act: 'capture', ts: Date.now(), room });
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

  // ---- what this browser holds, and what is in effect now ---------------------
  // Read from this browser's copy of the subscription file (or the one in the
  // Providers folder): each subscription with its plan, period, standing and
  // date; each pass not yet run out with its window; and the rights in effect
  // now with the reason (the best of them wins).
  const PLAN_SHORT = { room20: ['planRoom20', 'Room 20'], unlimited: ['planUnlimited', 'Unlimited'], streamer: ['planStreamer', 'Streamer'], free: ['planFree', 'Free'],
    family: ['planFamily', 'Family business'], smallBusiness: ['planSmallBusiness', 'Small business'], business: ['planBusiness', 'Business'], largeBusiness: ['planLargeBusiness', 'Large business'], enterprise: ['planEnterprise', 'Enterprise'] };
  // A plan's long name, as Settings and the plan buttons show it (the two kinds of meeting: private meetings, public open-floor meetings).
  const PLAN_NAME = { room20: 'planNameRoom20', unlimited: 'planNameUnlimited', streamer: 'planNameStreamer', free: 'planNameFree',
    family: 'planNameFamily', smallBusiness: 'planNameSmallBusiness', business: 'planNameBusiness', largeBusiness: 'planNameLargeBusiness', enterprise: 'planNameEnterprise' };
  // How many meetings at once the subscription powers, in Settings (n from the license's line items).
  const meetingsWords = (n) => (n > 1 ? fill(tx('subMeetingsN', 'Your subscription works in up to {n} meetings at once. Joining one more, here or in another browser with your subscription file, moves it from the oldest.'), { n })
    : tx('subMeetings1', 'Your subscription works in one meeting at a time. Joining a meeting, here or in another browser with your subscription file, moves it there.'));
  const planName = (tier, t) => (PLAN_NAME[tier] ? tx(PLAN_NAME[tier], t.name) : t.name);
  const planShort = (tier) => { const x = PLAN_SHORT[tier]; return x ? tx(x[0], x[1]) : tx('planNone', 'No plan'); };
  const clockOf = (s) => { try { return new Date(s * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
  function leftOf(sec) {
    const m = Math.max(0, Math.ceil(sec / 60));
    const h = Math.floor(m / 60), mm = m % 60;
    return h ? tx('leftHM', '{h} h {m} m').replace('{h}', h).replace('{m}', mm) : tx('leftM', '{m} m').replace('{m}', mm);
  }
  const fill = (t, vars) => String(t).replace(/\{(\w+)\}/g, (x, k) => (vars[k] != null ? String(vars[k]) : x));
  async function credentialsNow() {
    const n = nowS();
    const lic = await verifiedLicense();
    const st = readState();
    const cred = await credential();
    let sub = null;
    if (lic) {
      const status = st.status === 'CANCELLED' ? 'cancelled' : st.paidThrough && st.paidThrough < n ? 'grace' : 'active';
      sub = { tier: lic.tier, grants: lic.grants || null, period: cred && cred.period === 'yearly' ? 'yearly' : 'monthly', status, until: st.until || lic.exp, renews: status === 'active' ? st.paidThrough || null : null };
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
    const now = best.pass ? { tier: best.tier, why: 'pass', until: passEnd, grants: best.grants, passGrants: chain.live.grants } : base.signed ? { tier: base.tier, why: 'sub', until: base.until, grants: base.grants } : { tier: null, why: 'none', grants: null };
    const then = best.pass && base.signed ? base.tier : null;
    return { sub, free: !lic, passes: held, now, then };   // free: no plan, the defaults
  }
  // One line for the meeting's status: what is in effect, quietly.
  function nowLine(c) {
    if (c.now.why === 'pass' && !Number.isFinite(c.now.until)) return planShort(c.now.tier);
    if (c.now.why === 'pass') return fill(tx('nowPassLine', '{plan} until {until}, {left} left'), { plan: planShort(c.now.tier), until: clockOf(c.now.until), left: leftOf(c.now.until - nowS()) });
    if (c.now.why === 'sub') return planShort(c.now.tier);
    return '';
  }
  async function paintNow() {
    if (typeof document === 'undefined') return;
    const status = document.getElementById('status');
    if (!status) return;
    const c = await credentialsNow();
    const line = nowLine(c);
    let el = document.getElementById('sub-now');
    if (!line) { if (el) el.hidden = true; return; }
    if (!el) {
      el = document.createElement('button'); el.type = 'button'; el.id = 'sub-now'; el.className = 'sub-now';
      el.addEventListener('click', () => openSettings());
      status.appendChild(el);
    }
    el.hidden = false;
    el.dataset.plan = c.now.tier || ''; el.dataset.why = c.now.why;
    if (el.textContent !== line) el.textContent = line;
  }
  // What the Subscription table in Settings marks as selected (no separate status line).
  function subSelection(c) {
    const pass = !!(c && c.now && c.now.why === 'pass');
    const sub = c && c.sub ? c.sub : null;
    const tier = sub && sub.tier ? sub.tier : null;
    const period = tier ? (sub.period === 'yearly' ? 'yearly' : 'monthly') : null;
    return { free: !tier && !pass, tier: tier || null, period, pass };
  }
  function applySubSelection(root, sel) {
    if (!root || !sel) return sel;
    root.querySelectorAll('[aria-selected]').forEach((e) => { e.removeAttribute('aria-selected'); e.classList.remove('sub-on'); });
    const mark = (e) => { if (!e) return; e.setAttribute('aria-selected', 'true'); e.classList.add('sub-on'); };
    if (sel.free) mark(root.querySelector('[data-tier="free"]'));
    if (sel.tier && sel.period) mark(root.querySelector('button[data-tier="' + sel.tier + '"][data-period="' + sel.period + '"]'));
    if (sel.pass) { mark(root.querySelector('#sub-pass-buy')); mark(root.querySelector('tr[data-tier="pass"]')); }
    return sel;
  }
  // Queued (not yet live) passes and a pass that moved away: the table and the
  // pass button show what is on, so this does not repeat a status line.
  async function paintHeld(box, cred) {
    const c = cred || await credentialsNow();
    const p = (id, text) => { const e = el('p', { class: 'set-help', id }, text); box.appendChild(e); return e; };
    for (const x of (c.passes || [])) {
      if (x.live) continue;
      const e = x.never ? fill(tx('heldPassNever', 'Pass: {plan}, no end{capture}.'), { plan: planShort(x.plan), capture: x.capture ? tx('heldPassCaptures', ', takes charge of public open-floor meetings') : '' })
        : fill(tx('heldPassNext', 'Four-hour pass: Unlimited from {start} to {until}.'), { start: clockOf(x.start), until: clockOf(x.end) });
      const q = p('', e); q.className = 'set-help held-pass'; q.dataset.pass = x.id;
    }
    if (c.passes && c.passes.length && pmeet && pmeet.moved === 'moved') p('held-pass-moved', tx('passMoved', 'Your four-hour pass is in use in another meeting now: it works in one meeting at a time.'));
  }

  // ---- Subscription dialog (#sub-modal): same window as Settings ---------------
  const BTN = 'seg';
  const BTN_STYLE = 'border:1px solid var(--border,#2a2a3f);border-radius:.4rem;margin:.2rem .4rem .2rem 0';
  function el(tag, attrs, text) { const e = document.createElement(tag); for (const k in (attrs || {})) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
  // One line near every pay button: terms and privacy open in a new tab (the app wrappers
  // route target=_blank to the system browser, as for /cast and /library). Web PayPal also
  // says whose name the charge shows under.
  function legalLine(id, inApp) {
    const p = el('p', { class: 'set-help', id });
    const a = (href, t) => { const x = el('a', { href, target: '_blank', rel: 'noopener' }, t); return x; };
    p.appendChild(document.createTextNode(tx('payAgreePre', 'By paying you agree to the ') ));
    p.appendChild(a('https://gifos.app/terms/meet', tx('payTerms', 'Terms')));
    p.appendChild(document.createTextNode(tx('payAnd', ' and ')));
    p.appendChild(a('https://gifos.app/privacy/meet', tx('payPrivacy', 'Privacy policy')));
    p.appendChild(document.createTextNode(inApp ? '' : '. '));
    if (!inApp) p.appendChild(document.createTextNode(tx('payCharges', 'Charges show as Crowd Concepts (the company behind GifOS).')));
    return p;
  }
  const dateOf = (s) => { try { return new Date(s * 1000).toLocaleDateString(); } catch (e) { return ''; } };
  async function paintSettings(credNow) {
    const body = document.querySelector('#sub-modal .dlg-body');
    if (!body) return;
    body.textContent = '';
    const row = el('div', { class: 'set-row set-wide', id: 'sub-body' });
    body.appendChild(row);
    const msg = el('p', { class: 'set-help', id: 'sub-msg', role: 'status', 'aria-live': 'polite' });
    const say = (t) => { msg.textContent = t || ''; };
    await keepFresh();
    const held = el('div', { id: 'sub-held' });
    row.appendChild(held);
    const heldCred = credNow || await credentialsNow().catch(() => ({ now: { why: 'none' }, sub: null, passes: [] }));
    const sel = subSelection(heldCred);
    await paintHeld(held, heldCred).catch(() => {});
    // In the app the prices shown are the store's own.
    const inApp = !!RAIL();
    const price = inApp ? await RAIL().prices().catch(() => ({})) : {};
    const skuOf = (want) => { const k = inApp && SUB.storeSku(RAIL().store(), want); return k ? price[k.basePlan ? k.product + ':' + k.basePlan : k.product] || null : null; };
    const passPrice = skuOf({ what: 'pass' });
    const lic = await verifiedLicense();
    const st = readState();
    const cred = await credential();
    const app = appNow();
    if (lic) {
      const t = SUB.TIERS[lic.tier];
      const yearly = cred && cred.period === 'yearly';
      // A plan this app does not sell (Streamer, in Meet) is honored, named,
      // and managed in the app that sells it: no price, no files, no cancel here.
      const elsewhere = SUB.tiersSoldIn(app).indexOf(lic.tier) < 0;
      const viaStore = /^[GA]-/.test(String(lic.subId || ''));
      if (elsewhere) {
        row.appendChild(el('p', { class: 'set-help', id: 'sub-plan-elsewhere' }, tx('subFromBroadcast', '{plan}, from the Broadcast app. In meetings it gives everything Unlimited gives.').replace('{plan}', planShort(lic.tier))));
        row.appendChild(el('p', { class: 'set-help', id: 'sub-meetings' }, meetingsWords(SUB.rightsOf(lic, nowS()).meetings)));
        if (!inApp) row.appendChild(el('a', { class: BTN, style: BTN_STYLE + ';display:inline-block;text-decoration:none', id: 'sub-manage-broadcast', href: '/cast', target: '_blank', rel: 'noopener' }, tx('subManageBroadcast', 'Manage it in the Broadcast app')));
      } else {
        row.appendChild(el('p', { class: 'set-help' }, st.status === 'CANCELLED' ? SUB.TEXT.cancelled + ' Ends ' + dateOf(st.until || lic.exp) + '.' : inApp || viaStore ? tx('subRenewsAuto', 'Renews automatically.') : 'Renews through PayPal.'));
        row.appendChild(el('p', { class: 'set-help', id: 'sub-meetings' }, meetingsWords(SUB.rightsOf(lic, nowS()).meetings)));
        if (meet && meet.moved === 'moved') row.appendChild(el('p', { class: 'set-help' }, 'It is in use in another meeting now.'));
        // The library is a web page, offered only in the Broadcast app; the
        // native apps are the meeting only.
        if (t.storage && app === 'broadcast' && !inApp) {
          const a = el('a', { class: BTN, style: BTN_STYLE + ';display:inline-block;text-decoration:none', id: 'sub-library', href: '/library', target: '_blank', rel: 'noopener' }, 'My library');
          row.appendChild(a);
          row.appendChild(el('p', { class: 'set-help', id: 'sub-library-key' }, 'Only you can open your library. If you lose your subscription file and its backup, nobody, not even GifOS, can recover it.'));
        }
        if (inApp) {
          // A plan bought in the app is managed in the store's own subscription screen.
          // One bought elsewhere shows no purchase control here at all.
          if (viaStore) {
            const m = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-manage' }, tx('subManage', 'Manage subscription'));
            m.onclick = () => { RAIL().manage().catch(() => {}); };
            row.appendChild(m);
          }
        } else if (viaStore) {
          row.appendChild(el('p', { class: 'set-help', id: 'sub-store-managed' }, tx('subStoreManaged', 'This subscription is managed in the GifOS Meet app.')));
        } else if (st.status !== 'CANCELLED') {
          const c = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-cancel' }, 'Cancel subscription');
          c.onclick = async () => {
            c.disabled = true; say('Cancelling…');
            try { await cancel(); say(SUB.TEXT.cancelled); paintSettings(); } catch (e) { c.disabled = false; say(String(e.message || e)); }
          };
          row.appendChild(c);
        }
      }
    }
    // The plan table lives in the Subscription dialog (#sub-modal): same window
    // as Settings (header, body, Close). Free, then the $1 four-hour pass, then
    // one row per paid plan with Monthly and Annual buttons side by side.
    if (st.subId && st.status && st.status !== 'APPROVAL_PENDING' && !lic) row.appendChild(el('p', { class: 'set-help' }, tx('subLapsed', SUB.TEXT.lapsed)));
    const table = el('table', { class: 'sub-plans', id: 'sub-plans' });
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    hr.appendChild(el('th', { scope: 'col' }, ''));
    hr.appendChild(el('th', { scope: 'col' }, tx('subColMonth', 'Monthly')));
    hr.appendChild(el('th', { scope: 'col' }, tx('subColYear', 'Annual')));
    thead.appendChild(hr); table.appendChild(thead);
    const tb = document.createElement('tbody');
    const fr = el('tr', { class: 'sub-plan-free', 'data-tier': 'free' });
    const fd = el('td', { colspan: '3', class: 'sub-plan-desc' }, tx('subFreeTop', 'Free: private meetings up to 5 people; public open-floor meetings always free'));
    fr.appendChild(fd); tb.appendChild(fr);
    // $1 four-hour pass: one row after Free and before the $2 plan, one button.
    const pr = el('tr', { class: 'sub-plan-pass', 'data-tier': 'pass' });
    let passDesc = tx('subPassDesc', 'Unlimited people for 4 hours');
    if (sel.pass && heldCred.now && Number.isFinite(heldCred.now.until)) {
      passDesc = passDesc + ' · ' + fill(tx('passUntil', 'Unlimited until {until}'), { until: clockOf(heldCred.now.until) });
    }
    pr.appendChild(el('td', { class: 'sub-plan-desc' }, passDesc));
    const ptd = el('td', { class: 'sub-plan-buy', colspan: '2' });
    const passBtn = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-pass-buy' }, passPrice ? tx('passForHoursAt', '{price} for 4 hours').replace('{price}', passPrice) : tx('passForHours', '$1 for 4 hours'));
    passBtn.onclick = async () => {
      passBtn.disabled = true; say(inApp ? '' : tx('passOpening', 'Opening PayPal…'));
      try {
        const r = await buyPass(say);
        say(r && r.passJson ? tx('passThanks', 'Thank you. Your four-hour pass is on.') : inApp ? msg.textContent : tx('passNotConfirmed', 'PayPal did not confirm the payment.'));
        paintSettings();
      } catch (e) { passBtn.disabled = false; say(String(e.message || e)); }
    };
    ptd.appendChild(passBtn);
    pr.appendChild(ptd);
    tb.appendChild(pr);
    const onBuy = async (id, period) => {
      for (const x of row.querySelectorAll('button[data-tier]')) x.disabled = true;
      say(inApp ? '' : 'Opening PayPal…');
      try {
        const r = await subscribe(id, period, say);
        if (inApp) say(r && r.licenseJson ? tx('subThanksApp', 'You are subscribed. Thank you.') : msg.textContent);
        else say(r && r.licenseJson ? 'You are subscribed. Thank you. Download your subscription file to keep it safe.' : r && r.status === 'APPROVAL_PENDING' ? SUB.TEXT.pending : 'PayPal did not confirm the subscription.');
        paintSettings();
      } catch (e) {
        say(String(e.message || e));
        for (const x of row.querySelectorAll('button[data-tier]')) x.disabled = false;
      }
    };
    // The window lists Room 20, Unlimited (Streamer in Broadcast) and Family business; every plan is on /subscription.
    for (const id of SUB.tiersListed(app)) {
      const t = SUB.TIERS[id];
      const tr = el('tr', { 'data-tier': id });
      tr.appendChild(el('td', { class: 'sub-plan-desc' }, planName(id, t)));
      for (const period of ['monthly', 'yearly']) {
        const td = el('td', { class: 'sub-plan-buy' });
        if (t.periods.indexOf(period) >= 0 && !(inApp && !SUB.storeSku(RAIL().store(), { what: 'sub', tier: id, period }))) {
          const sp = skuOf({ what: 'sub', tier: id, period });
          const label = period === 'yearly' ? (sp || t.priceYear) + ' a year' : (sp || t.price) + ' a month';
          const b = el('button', { type: 'button', class: BTN, style: BTN_STYLE, 'data-tier': id, 'data-period': period }, label);
          b.onclick = () => onBuy(id, period);
          td.appendChild(b);
        }
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    row.appendChild(table);
    if (!inApp) row.appendChild(el('p', { class: 'set-help', id: 'sub-how' }, tx('passHow', 'Pay by card or PayPal.')));
    row.appendChild(legalLine('sub-legal', inApp));
    // Every plan (the bigger business plans, Enterprise, Negotiated), the one held and the way up: /subscription.
    row.appendChild(el('a', { class: BTN, style: BTN_STYLE + ';display:inline-block;text-decoration:none', id: 'sub-all-plans', href: '/subscription', target: '_blank', rel: 'noopener' }, tx('subAllPlans', 'All plans')));
    applySubSelection(row, sel);
    if (inApp) {
      // In the app: restore, and the credentials file through the system's own
      // share sheet and file picker. The words say what the file is for and
      // nothing about where anything is sold.
      const rs = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-restore' }, tx('storeRestore', 'Restore purchases'));
      rs.onclick = async () => {
        rs.disabled = true;
        try { const got = await restoreInApp(); say(got.some((r) => r.state === 'done') ? tx('storeRestored', 'Your purchases are restored.') : tx('storeNothing', 'No purchases to restore.')); paintSettings(); }
        catch (e) { rs.disabled = false; say(String(e.message || e)); }
      };
      row.appendChild(rs);
      const N = root.GifosNative;
      if (cred || (await wallet())) {
        const d = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-file-get' }, tx('credsSave', 'Save my GifOS Meet credentials'));
        d.onclick = async () => {
          try {
            const r = await N.request('file.save', { name: 'GifOS Meet credentials.gif', mime: 'image/gif', b64: b64(await fileBytes()) });
            if (r && r.ok !== false && r.state !== 'cancelled') say(tx('credsSaved', 'Saved. Keep the file private: anyone with it can use your credentials.'));
          } catch (e) { say(String(e.message || e)); }
        };
        row.appendChild(d);
        row.appendChild(el('p', { class: 'set-help', id: 'sub-file-help' }, tx('credsSaveHelp', 'Back up your credentials, or use them on your other devices.')));
      }
      if (N.info().credentialImport === true) {
        const u = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-file-load' }, tx('credsLoad', 'Load my GifOS Meet credentials'));
        u.onclick = async () => {
          try {
            const r = await N.request('file.pick', { mime: 'image/gif' });
            if (!r || r.ok === false || r.state !== 'picked') return;
            const st2 = await useFile(fromB64(r.b64));
            say(st2 && st2.licenseJson ? tx('credsLoadedSub', 'Your credentials are loaded. A subscription works in as many meetings at once as its plan says.') : tx('credsLoaded', 'Your credentials are loaded.'));
            paintSettings();
          } catch (e) { say(/not a GifOS/.test(String(e && e.message)) ? tx('credsNot', 'That file does not hold GifOS Meet credentials.') : String(e.message || e)); }
        };
        row.appendChild(u);
      }
      row.appendChild(msg);
      return;
    }
    // The subscription file: download it, or use one from another browser.
    if (cred || (await wallet())) {
      const d = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-file-get' }, 'Download subscription file');
      d.onclick = () => { downloadFile().then(() => say('Saved. Keep it private: anyone with the file can use your subscription' + (lic && lic.grants && lic.grants.storage && app === 'broadcast' ? ' and open your library. Keep a backup: if you lose it, nobody, not even GifOS, can recover your library.' : '.')), (e) => say(String(e.message || e))); };
      row.appendChild(d);
    }
    const pick = el('input', { type: 'file', accept: 'image/gif,.gif', id: 'sub-file-use', 'aria-label': 'Use a subscription file' });
    pick.onchange = async () => {
      const f = pick.files && pick.files[0];
      if (!f) return;
      say('Reading the file…');
      try {
        const r = await useFile(new Uint8Array(await f.arrayBuffer()));
        say(r && r.licenseJson ? 'This browser now uses your subscription. It works in as many meetings at once as its plan says.' : 'The file was read, but the subscription is not active.');
        paintSettings();
      } catch (e) { say(String(e.message || e)); }
    };
    const lab = el('label', { class: 'set-help', style: 'display:block;margin-top:.4rem' }, tx('subFileUse', 'Use a subscription file from another browser: '));
    lab.appendChild(pick);
    row.appendChild(lab);
    row.appendChild(msg);
  }
  function closeSubscribe() {
    const m = document.getElementById('sub-modal');
    if (m) m.style.display = 'none';
  }
  function wireSubModal() {
    const m = document.getElementById('sub-modal');
    if (!m || m.dataset.wired) return m;
    m.dataset.wired = '1';
    const c = document.getElementById('sub-close');
    if (c) c.addEventListener('click', closeSubscribe);
    m.addEventListener('click', (e) => { if (e.target === m) closeSubscribe(); });
    return m;
  }
  function openSettings() {
    const b = document.getElementById('setbtn');
    if (b) b.click();
  }
  // The Subscription entry: the Subscription dialog, same window as Settings.
  function openSubscribe() {
    const m = wireSubModal();
    if (m) m.style.display = 'flex';
    paintSettings().catch(() => {});
    return true;
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

  // Shown instead of the meeting when the room is full for this person: what
  // happened, in one line with the room's real size, and the way in now.
  // o: {limit, free, onRight} (a bare boolean is the old free flag). limit: the
  // room's line (the door's own count); onRight(): called once when this
  // browser holds a right the door lets in, from whichever path brought it (the
  // pass here, the Subscription dialog, a file opened, a store restore), so the
  // page knocks again by itself.
  // WHILE IT WAITS the page knocks again by itself, politely (run.html subsReknock), and the offer stays up the whole
  // time: the products on sale (the pass, the plans), with their names and prices, never a single right. fullWaiting()
  // keeps the wait line true: first "we keep knocking", and after a while still outside the reminder that the pass (or,
  // where no pass is sold, a subscription) gets the person in now.
  let fullWatch = null;
  function fullWords(o) {
    const n = Number.isInteger(o.limit) && o.limit > 0 ? o.limit : o.free ? SUB.FREE_LIMIT : null;
    return n ? fill(tx('subFullTitleN', 'This meeting is full ({n} people on its host\'s plan).'), { n }) : tx('subFullTitle', 'This meeting is full.');
  }
  function showFull(o) {
    if (typeof document === 'undefined') return false;
    o = o && typeof o === 'object' ? o : { free: !!o };
    const m = document.getElementById('left-modal');
    if (!m) return false;
    const t = document.getElementById('left-title');
    const n = document.getElementById('left-note');
    if (t) t.textContent = fullWords(o);
    if (n) n.textContent = tx('subFullNote', 'A pass or any subscription walks you right in.');
    const box = m.querySelector('.name-box') || m;
    let card = document.getElementById('sub-full');
    if (card) card.remove();
    card = el('div', { id: 'sub-full', class: 'sub-full' });
    const say = el('p', { id: 'sub-full-say', class: 'sub-full-say', role: 'status', 'aria-live': 'polite' });
    const sayIt = (x) => { say.textContent = x || ''; };
    const inApp = !!RAIL();
    const off = fullOffers();
    const done = () => { if (fullWatch) { clearInterval(fullWatch.t); const f = fullWatch.onRight; fullWatch = null; sayIt(tx('subFullJoining', 'You are in. Joining the meeting\u2026')); try { if (f) f(); } catch (e) {} } };
    const check = () => { const w = fullWatch; if (w && !w.busy) { w.busy = true; doorRight().then((ok) => { w.busy = false; if (ok && fullWatch === w) done(); }); } };
    if (off.pass) {
      const label = fill(tx('subFullPass', 'Get in now: {price} for {hours} hours'), { price: off.pass.price, hours: off.pass.hours || 4 });
      const b = el('button', { type: 'button', id: 'sub-full-pass', class: 'sub-full-pass' }, label);
      b.onclick = async () => {
        b.disabled = true; sayIt(inApp ? '' : tx('passOpening', 'Opening PayPal\u2026'));
        try {
          const r = await buyPass(sayIt);
          if (r && r.passJson) check(); else { b.disabled = false; if (!inApp) sayIt(tx('passNotConfirmed', 'PayPal did not confirm the payment.')); }
        } catch (e) { b.disabled = false; sayIt(String(e.message || e)); }
      };
      card.appendChild(b);
    }
    if (off.sub) {
      const s = el('button', { type: 'button', id: 'sub-full-sub', class: 'sub-full-sub' }, fill(tx('subFullSub', 'or subscribe from {price}/month and never wait at a door'), { price: off.sub.price }));
      s.onclick = () => { openSubscribe(); };
      card.appendChild(s);
    }
    card.appendChild(say);
    card.appendChild(el('p', { id: 'sub-full-wait', class: 'sub-full-wait', role: 'status', 'aria-live': 'polite' }, tx('subFullWait', 'We keep knocking for you. You get in by yourself as soon as a place opens.')));
    if (off.pass || off.sub) card.appendChild(legalLine('sub-full-legal', inApp));
    if (inApp && off.pass) {   // in the app the price shown is the store's own (as in Settings)
      RAIL().prices().then((pr) => {
        const k = SUB.storeSku(RAIL().store(), { what: 'pass' }); const p = k && pr && pr[k.basePlan ? k.product + ':' + k.basePlan : k.product];
        const b = document.getElementById('sub-full-pass');
        if (p && b) b.textContent = fill(tx('subFullPass', 'Get in now: {price} for {hours} hours'), { price: p, hours: off.pass.hours || 4 });
      }).catch(() => {});
    }
    // Above the Rejoin / Close row: the page may have wrapped those buttons, so insert before the box's own child that holds Rejoin.
    let ref = box.querySelector('#left-rejoin');
    while (ref && ref.parentNode !== box) ref = ref.parentNode;
    box.insertBefore(card, ref || null);
    m.dataset.full = '1';
    m.style.display = 'flex';
    if (fullWatch) clearInterval(fullWatch.t);
    fullWatch = typeof o.onRight === 'function' ? { onRight: o.onRight, busy: false, t: setInterval(check, POLL_MS) } : null;
    if (fullWatch) check();   // a right already held (bought a moment ago, or a pass still waiting to start)
    return true;
  }
  // The wait line of the full screen, kept true by the page as its knocks are refused again. o: {still}: still outside
  // after a while: the reminder names the product that gets the person in now (the pass on sale with its price as the
  // button shows it; no pass sold: a subscription). No offer on sale here: the plain wait line stays.
  function fullWaiting(o) {
    if (typeof document === 'undefined') return false;
    const w = document.getElementById('sub-full-wait');
    if (!w) return false;
    const off = fullOffers();
    const still = !!(o && o.still) && !!(off.pass || off.sub);
    w.textContent = !still ? tx('subFullWait', 'We keep knocking for you. You get in by yourself as soon as a place opens.')
      : off.pass ? fill(tx('subFullStillPass', 'Still full, and we keep knocking. The {hours}-hour pass gets you in right now.'), { hours: off.pass.hours || 4 })
        : tx('subFullStillSub', 'Still full, and we keep knocking. A subscription gets you in right now.');
    w.className = 'sub-full-wait' + (still ? ' sub-full-still' : '');
    return true;
  }
  // The full screen goes (the page knocks again): the offer and its watch with it.
  function hideFull() {
    if (fullWatch) { clearInterval(fullWatch.t); fullWatch = null; }
    if (typeof document === 'undefined') return;
    const card = document.getElementById('sub-full'); if (card) card.remove();
    const m = document.getElementById('left-modal');
    if (m && m.dataset.full) { delete m.dataset.full; m.style.display = 'none'; }
  }

  // The small card the host's prompts use (the turned-away prompt, the move question).
  const CARD_STYLE = 'position:fixed;left:50%;bottom:5.5rem;transform:translateX(-50%);z-index:41;max-width:min(92vw,28rem);background:var(--c-white,#fff);color:var(--c-ink,#1d1d1f);border:1px solid var(--c-line,#e8ecf1);border-radius:.6rem;padding:.6rem .8rem;box-shadow:0 12px 32px rgba(0,0,0,.5);font:14px/1.4 system-ui,sans-serif;display:flex;gap:.6rem;align-items:center;flex-wrap:wrap';

  // An organization's plan (overflow 'keep') with every meeting in use: say so plainly; nothing is asked or moved.
  function showOverflowNote(n) {
    if (typeof document === 'undefined' || !document.body) return false;
    const old = document.getElementById('sub-overflow'); if (old) old.remove();
    const box = el('div', { id: 'sub-overflow', role: 'status', 'aria-live': 'polite', style: CARD_STYLE });
    box.appendChild(el('span', { id: 'sub-overflow-msg', style: 'flex:1 1 12rem' }, n > 0 ? fill(tx('subOverflowKeep', 'All {n} of your organization\u2019s meetings are in use; this one runs on the free limits.'), { n }) : tx('subOverflowKeep0', 'Every meeting your organization\u2019s plan covers is in use; this one runs on the free limits.')));
    const x = el('button', { type: 'button', id: 'sub-overflow-x', class: BTN, style: BTN_STYLE, 'aria-label': tx('subUpClose', 'Close') }, '\u00d7');
    x.onclick = () => { box.remove(); };
    box.appendChild(x);
    document.body.appendChild(box);
    return true;
  }

  // ASK BEFORE MOVING (Nathan 2026-11-22): every place of every right this browser holds is in use, and this meeting
  // has just started. opts: {places, entries:[{right, meeting, name, people, at}]} (moveOptions). One place: "Your plan
  // is powering 'X' (N people). Move it here?" with Move it here / Keep it there; several: which meeting to take it
  // from, or keep this one free. Both offer more meetings at once. -> {right, meeting} | {keep: true}.
  function askMove(opts) {
    return new Promise((resolve) => {
      if (typeof document === 'undefined' || !document.body || !opts || !opts.entries || !opts.entries.length) return resolve(null);
      const old = document.getElementById('sub-move'); if (old) old.remove();
      const box = el('div', { id: 'sub-move', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sub-move-title', style: CARD_STYLE });
      const done = (v) => { box.remove(); resolve(v); };
      const nameOf = (e) => e.name || tx('subMoveOther', 'another meeting');
      const line = (id, text, strong) => { const p = el('p', { id, style: 'flex:1 1 100%;margin:0' + (strong ? ';font-weight:600' : '') }, text); box.appendChild(p); return p; };
      const btn = (id, text, v) => { const b = el('button', { type: 'button', id, class: BTN, style: BTN_STYLE }, text); b.onclick = () => done(v); box.appendChild(b); return b; };
      const free = SUB.FREE_LIMIT;
      if (opts.entries.length === 1 && opts.places <= 1) {
        const e = opts.entries[0];
        line('sub-move-title', fill(e.people === 1 ? tx('subMoveOne1', 'Your plan is powering \u201c{name}\u201d (1 person). Move it here?') : e.people ? tx('subMoveOne', 'Your plan is powering \u201c{name}\u201d ({n} people). Move it here?') : tx('subMoveOneNoCount', 'Your plan is powering \u201c{name}\u201d. Move it here?'), { name: nameOf(e), n: e.people }), true);
        line('sub-move-note', fill(tx('subMoveNote', 'That meeting will then let in only {free} new people and lose firewall video.'), { free }));
        line('sub-move-teach', tx('subMoveTeach', 'Your plan powers one meeting at a time.'));
        btn('sub-move-go', tx('subMoveGo', 'Move it here'), { right: e.right, meeting: e.meeting });
        btn('sub-move-keep', tx('subMoveKeep', 'Keep it there'), { keep: true });
      } else {
        line('sub-move-title', tx('subMoveMany', 'Every meeting your plans cover is in use. Take one for this meeting?'), true);
        opts.entries.forEach((e, i) => btn('sub-move-from-' + i, e.people === 1 ? fill(tx('subMoveFrom1', 'Take it from \u201c{name}\u201d (1 person)'), { name: nameOf(e) }) : e.people ? fill(tx('subMoveFrom', 'Take it from \u201c{name}\u201d ({n} people)'), { name: nameOf(e), n: e.people }) : fill(tx('subMoveFromNoCount', 'Take it from \u201c{name}\u201d'), { name: nameOf(e) }), { right: e.right, meeting: e.meeting }));
        btn('sub-move-keep', tx('subMoveKeepFree', 'Keep this meeting free'), { keep: true });
      }
      line('sub-move-free', fill(tx('subMoveFreeNote', 'A meeting your plan does not power runs on the free plan: up to {free} people, voice only through firewalls.'), { free }));
      // More meetings at once: the smallest plan with more places than these rights have, or every plan.
      const up = SUB.TIER_IDS.map((t) => SUB.TIERS[t]).filter((t) => t.meetings > Math.max(1, opts.places) && t.cents.monthly && SUB.tiersSoldIn(appNow()).indexOf(t.id) >= 0)[0];
      const p = line('sub-move-up', up ? fill(tx('subMoveUp', 'More meetings at once: {plan} powers {n} at once, from {price} a month.'), { plan: planShort(up.id), n: up.meetings, price: up.price }) + ' ' : '');
      const a = el('a', { id: 'sub-move-plans', href: '/subscription', target: '_blank', rel: 'noopener' }, tx('subAllPlans', 'All plans'));
      p.appendChild(a);
      document.body.appendChild(box);
      const first = box.querySelector('button'); if (first) try { first.focus(); } catch (e) {}
    });
  }

  // The host of a room with a people line, when its doors turned people away:
  // how many, and the plan whose rights carry no line, in one tap.
  // n: how many people could not get in (1 when not counted).
  function showHostPrompt(n) {
    if (typeof document === 'undefined' || !document.body) return false;
    n = Number.isInteger(n) && n > 0 ? n : 1;
    const up = hostOffer();
    const words = () => (n === 1 ? tx('subHostTurned1', '1 person couldn\'t get in.') : fill(tx('subHostTurnedN', '{n} people couldn\'t get in.'), { n }))
      + (up ? ' ' + fill(tx('subHostUpNote', '{plan} ({price}) removes the limit.'), { plan: planShort(up.tier), price: up.price }) : '');
    let bar = document.getElementById('sub-host-up');
    if (bar) {
      bar.hidden = false;
      const msg = document.getElementById('sub-host-up-msg'), go = document.getElementById('sub-host-up-go');
      if (msg && !(go && go.disabled)) msg.textContent = words();   // a purchase under way keeps its own words
      return true;
    }
    bar = el('div', { id: 'sub-host-up', role: 'status', 'aria-live': 'polite', style: CARD_STYLE });
    const msg = el('span', { id: 'sub-host-up-msg', style: 'flex:1 1 12rem' }, words());
    bar.appendChild(msg);
    if (up) {
      const go = el('button', { type: 'button', id: 'sub-host-up-go', class: BTN, style: BTN_STYLE }, fill(tx('subHostUpGo', 'Get {plan}'), { plan: planShort(up.tier) }));
      go.onclick = async () => {
        go.disabled = true;
        try {
          const r = await subscribe(up.tier, 'monthly', (t) => { msg.textContent = t; });
          if (r && r.licenseJson) bar.remove(); else { if (!RAIL()) msg.textContent = r && r.status === 'APPROVAL_PENDING' ? SUB.TEXT.pending : 'PayPal did not confirm the subscription.'; go.disabled = false; }
        } catch (e) { msg.textContent = String(e.message || e); go.disabled = false; }
      };
      bar.appendChild(go);
    }
    const x = el('button', { type: 'button', id: 'sub-host-up-x', class: BTN, style: BTN_STYLE, 'aria-label': tx('subUpClose', 'Close') }, '\u00d7');
    x.onclick = () => { bar.remove(); };
    bar.appendChild(x);
    document.body.appendChild(bar);
    return true;
  }

  let booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    wireSubModal();
    keepFresh().catch(() => {});
    resumePending().catch(() => {});
    if (RAIL()) {
      // The store may hold a purchase this app has not been handed yet.
      restoreInApp().catch(() => {});
      root.addEventListener('gifosnative', (ev) => { const d = ev && ev.detail; if (d && d.type === 'store' && d.event === 'purchases-updated') restoreInApp().then(() => paintNow()).catch(() => {}); });
    }
    passWatch().catch(() => {});
    setInterval(() => { passWatch().catch(() => {}); paintNow().catch(() => {}); }, POLL_MS);   // a pass starting or ending re-presents the room's plan
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }

  // THE one rights call every interface reads (SDKs, MCP, the hosted-bot host): the union held now, as plain JSON.
  GifOS.rights = async () => SUB.rightsJson(await rights());
  GifOS.meetSubs = {
    askMove, moveOptions, showOverflowNote,
    rights, planRights, refresh, keepFresh, subscribe, cancel, buyPass, claimPass, passes, livePass, credentialsNow, subSelection, applySubSelection, paintNow, paintSettings, openSettings, openSubscribe, mayCreateAdminRoom, showFull, hideFull, fullWaiting, fullOffers, hostOffer, doorRight, showHostPrompt,
    roomOrder, roomTier, proveAtDoor, checkShown, newNonce,
    appNow, joinMeeting, leaveMeeting, currentTicket, canCapture, captureTicket, captureCurrent, captureOrder, captureKeys, fileBytes, downloadFile, useFile, librarySigner, restoreInApp,
    keepReceipt, subReceiptFiles,
    passMeeting: () => (pmeet ? { grants: pmeet.grants || null, room: pmeet.room, gen: pmeet.gen, exp: pmeet.exp, until: pmeet.until, moved: pmeet.moved, held: !!pmeet.ticket } : null),
    currentPassTicket,
    meeting: () => (meet ? { room: meet.room, gen: meet.gen, exp: meet.exp, moved: meet.moved, held: !!meet.ticket, tier: meet.tier, grants: meet.grants || null, paid: !!(meet.ticket && meet.grants && meet.grants.admitAtFullDoor) } : null),
  };
})(typeof window !== 'undefined' ? window : globalThis);
