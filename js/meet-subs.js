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
 *   - Making an admin room: anyone may (Nathan 2026-11-11). Without a paid
 *     plan the page gets a FREE license from the payment service (no PayPal;
 *     bound to this browser's own key) and the room carries the free plan:
 *     up to 5 people. When the door turns someone away for that, the host
 *     sees a one-tap "Subscribe for up to 20".
 *   - ONE MEETING AT A TIME: joining a meeting (open or admin room) asks the
 *     payment service for a short ticket for that meeting. Joining another
 *     meeting, here or in any browser holding the same file, moves the
 *     subscription there; this meeting loses it within a few minutes.
 *     Payment is checked when a meeting is joined; a meeting that started
 *     paid keeps the subscription to its end.
 *   - The admin's ticket travels with the room (a signed room order), so the
 *     door knows the room's plan. In a room on the $2 plan that already
 *     holds 20 people (5 on the free plan, or when the room's plan cannot be
 *     shown), the door asks a newcomer to show a ticket for this meeting;
 *     without one they are told plainly and not let in. Rooms on the $5 and
 *     $10 plans have no limit, and open rooms never have one.
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
  const FREE_KEY = 'gifos-sub-free';       // the free plan's license for this browser's key: {subId, licenseJson, sig}
  const WALLET_KEY = 'gifos-pass-wallet';  // this browser's four-hour passes and their key (passes.json in the subscription file)
  // New words read the meeting's catalog (i18n/<lang>/meet.json); English stays beside the call.
  const tx = (key, en) => { try { const L = GifOS.i18n; if (L && L.ui() !== 'en' && L.has('meet.' + key)) return L.t('meet.' + key); } catch (e) {} return en; };
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
  // In the GifOS Meet apps everything is paid for through the store's own
  // purchase sheet (gifos-store-rail.js): the one rail there. RAIL() is null
  // in a browser.
  const RAIL = () => (GifOS.storeRail && GifOS.storeRail.present() ? GifOS.storeRail : null);
  const on = () => !!(SUB && (RAIL() || SUB.enabled(switchFrom(), safeStore())));
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
  function fromProvidersAll() {
    if (!provP) provP = (async () => {
      const out = { cred: null, wallet: null };
      const st = GifOS.store, gif = GifOS.gif;
      if (!st || !st.allItems || !st.getFile || !gif) return out;
      const items = await st.allItems();
      for (const it of items || []) {
        if (!it || (it.parent || null) !== 'sys_providers' || it.kind !== 'file' || !it.fileId) continue;
        const f = await st.getFile(it.fileId).catch(() => null);
        if (!f || f.kind !== 'gif' || !f.bytes) continue;
        const bytes = f.bytes instanceof Uint8Array ? f.bytes : new Uint8Array(f.bytes);
        const arc = await gif.decode(bytes).catch(() => null);
        if (!arc) continue;
        if (!out.cred) out.cred = SUB.credentialFromFiles(arc.files);
        if (!out.wallet) out.wallet = SUB.walletFromFiles(arc.files);
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
    if (c.tier === 'free') { writeJson(FREE_KEY, null); await ensureFree(); return readState(); }
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
    if (!lic || !SUB.isPaid(lic.tier)) return null;
    try { if (lic.buyerKey !== (await myKey()).pub) return null; } catch (e) { return null; }
    return lic;
  }
  // The free plan's license, when it is this browser's key's.
  async function verifiedFree() {
    const f = readJson(FREE_KEY);
    if (!f || !f.licenseJson || !f.sig) return null;
    const lic = await SUB.verifyLicense({ licenseJson: f.licenseJson, sig: f.sig }, verifyPay, nowS()).catch(() => null);
    if (!lic || lic.tier !== 'free') return null;
    try { if (lic.buyerKey !== (await myKey()).pub) return null; } catch (e) { return null; }
    return lic;
  }
  // My library (js/gifos-library.js) signs its requests with this: the
  // current license (or the last one, after the plan ended) and the
  // subscription key. null when this browser holds no subscription.
  async function librarySigner() {
    if (!on()) return null;
    const c = await credential();
    if (!c) return null;
    const st = readState();
    const licenseJson = st.licenseJson || st.lastLicenseJson, sig = st.licenseJson ? st.sig : st.lastSig;
    if (!licenseJson || !sig) return null;
    let lic; try { lic = JSON.parse(licenseJson); } catch (e) { return null; }
    if (!lic || lic.subId !== c.subId) return null;
    try { if (lic.buyerKey !== (await myKey()).pub) return null; } catch (e) { return null; }
    return { subId: c.subId, tier: lic.tier, exp: lic.exp, license: { licenseJson, sig }, sign: signText, libraryKey: await libraryKey(c) };
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
  // The subscription's rights alone (paid, else free).
  async function planRights() {
    if (!on()) return Object.assign({}, SUB ? SUB.FREE : {});
    const lic = await verifiedLicense();
    return SUB.rightsOf(lic || (await verifiedFree()), nowS());
  }
  // What is in effect now: the best of the subscription and a live pass.
  async function rights() {
    const base = await planRights();
    if (!on()) return base;
    const lp = await livePass();
    return lp ? SUB.bestRights([base, SUB.passRights(lp.o)]) : base;
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
    if (c0 && c0.tier === 'free') return null;   // the free plan's license is ensureFree's
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
    return next;
  }
  async function keepFresh() {
    const c = await credential();
    if (!c) return;
    if (readJson(FREE_KEY)) { const f = await verifiedFree(); if (!f || f.exp - nowS() < REFRESH_BEFORE_S) await ensureFree(); }
    if (c.tier === 'free') return;
    const lic = await verifiedLicense();
    const st = readState();
    if (!lic || lic.exp - nowS() < REFRESH_BEFORE_S || st.status === 'APPROVAL_PENDING') { try { await refresh(); } catch (e) {} }
  }

  // ---- bought in the app: the store's purchase sheet ---------------------------
  // The key a store subscription is (or will be) held by: the paid credential
  // this app already has (a plan change keeps its key), else a purchase
  // started earlier and not yet confirmed, else a new one.
  const STORE_PENDING = 'gifos-store-pending';
  async function storeKey(fresh) {
    const cur = SUB.credentialOk(readJson(CRED_KEY));
    const held = readJson(STORE_PENDING);
    let seedB64 = !fresh && cur && cur.tier !== 'free' ? cur.seed : held && typeof held.seed === 'string' ? held.seed : null;
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
      passWatch().catch(() => {});
      if (meet) passJoin(meet.room, true);
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

  async function subscribe(tier, period, say) {
    if (RAIL()) return subscribeInApp(tier, period, say || (() => {}));
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
      if (st && st.licenseJson) { rejoin(true); return st; }
      if (st && st.status && st.status !== 'APPROVAL_PENDING' && st.status !== 'APPROVED') return st;
    }
    return readState();
  }
  // ---- the free plan -----------------------------------------------------------
  // ensureFree() -> the free license (admin rooms of up to 5 people), asked
  // for when this browser has no paid plan. A browser with no key yet gets
  // one now, kept like a subscription file (tier 'free'). Never PayPal.
  let freeP = null;
  function ensureFree() {
    if (!on()) return Promise.resolve(null);
    if (!freeP) {
      freeP = (async () => {
        if (await verifiedLicense()) return null;   // a paid plan already makes admin rooms
        let lic = await verifiedFree();
        if (lic && lic.exp - nowS() > REFRESH_BEFORE_S) return lic;
        if (!(await credential())) {
          const seed = new Uint8Array(32); crypto.getRandomValues(seed);
          const k = await GifOS.ed.keysFromSeed(seed);
          const buyerKey = b64(k.pubRaw);
          writeJson(CRED_KEY, { v: 1, kind: SUB.CRED_KIND, subId: await SUB.freeIdFor(buyerKey), tier: 'free', period: 'monthly', seed: b64(seed), buyerKey });
          keyMemo = { seed: null, p: null };
        }
        const subId = await SUB.freeIdFor((await myKey()).pub);
        const j = await post('/gifos/sub/license', await signed('license', null, subId));
        if (j.active && j.licenseJson) writeJson(FREE_KEY, { subId, licenseJson: j.licenseJson, sig: j.sig, checkedAt: Date.now() });
        lic = await verifiedFree();
        if (lic) rejoin();
        return lic;
      })().catch(() => null).then((x) => { freeP = null; return x; });
    }
    return freeP;
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
    if (cur && cur.seed !== w.seed && cur.passes.some((p) => { const o = passOf(p); return o && o.end > n; })) return false;
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
    if (!on()) return;
    const lp = await livePass().catch(() => null);
    const k = lp ? lp.o.id + ':' + lp.o.end : '';
    if (k !== passSeen) {
      passSeen = k;
      // A pass that started here (a file opened, a window begun) joins this
      // meeting; one that moved to another meeting is never taken back by a
      // watch (only a join the person makes takes it: a page start or a purchase).
      if (lp && meet && !(pmeet && pmeet.room === meet.room && (pmeet.ticket || pmeet.pending || pmeet.moved === 'moved'))) passJoin(meet.room, true);
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
    passWatch().catch(() => {});
    if (meet) passJoin(meet.room, true);   // a new pass (or one stacked on the window): the meeting this page is in takes it now
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
    if (c0 && c0.tier === 'free') return readState();   // nothing to cancel on the free plan
    if (!(await subIdNow())) return readState();
    const j = await post('/gifos/sub/cancel', await signed('cancel'));
    writeState(Object.assign({}, readState(), { status: j.status, until: j.until }));
    try { await refresh(); } catch (e) {}
    return readState();
  }

  // ---- one meeting at a time --------------------------------------------------
  // meet: {room, tag, subId, tier, ticket:{ticketJson,sig}, exp, gen, joining, timer, moved}
  let meet = null;
  let hooks = {};
  function stopTimer() { if (meet && meet.timer) { clearTimeout(meet.timer); meet.timer = null; } }
  function schedule(ms) { stopTimer(); if (meet) meet.timer = setTimeout(renewNow, ms); }
  function take(j) {
    meet.ticket = { ticketJson: j.ticketJson, sig: j.sig }; meet.exp = j.exp; meet.gen = j.gen; meet.tier = j.tier || meet.tier;
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
    if (!on()) return Promise.resolve(null);
    if (meet && meet.room === room && (meet.ticket || meet.moved || meet.pending)) return meet.joining;
    const keep = h || hooks;
    leaveMeeting(!!(pmeet && pmeet.room === room));
    hooks = keep || {};
    const m = meet = { room, tag: null, subId: null, tier: null, ticket: null, exp: 0, gen: 0, timer: null, moved: null, joining: null, pending: true };
    passJoin(room);   // a four-hour pass held here joins this meeting too, one meeting at a time
    m.joining = (async () => {
      const c = await credential();
      if (!c) return null;
      // A paid plan when this browser holds one (or has just bought one: the
      // service checks payment at the join), else the free plan's license.
      const paidLic = await verifiedLicense();
      const freeLic = paidLic ? null : await verifiedFree();
      m.subId = paidLic ? paidLic.subId : freeLic ? freeLic.subId : (c.tier !== 'free' ? c.subId : null);
      if (!m.subId) return null;
      m.tag = await SUB.meetingTag(room);
      const j = await post('/gifos/sub/join', await signed('join:' + m.tag, { meeting: m.tag }, m.subId));
      if (meet !== m) return null;
      if (!j.active) { m.moved = 'inactive'; return null; }
      take(j);
      return m.ticket;
    })().catch(() => null).then((t) => { m.pending = false; return t; });
    return m.joining;
  }
  function leaveMeeting(keepPass) { stopTimer(); meet = null; hooks = {}; if (!keepPass) { passStop(); pmeet = null; } }
  // The subscription on this browser changed (signed up, or a file opened):
  // the meeting this page is in joins with it now.
  // upgrade: a paid plan just arrived, so a meeting held on the free plan
  // joins again with it (the room then carries the paid plan).
  function rejoin(upgrade) { if (meet && (!meet.ticket || (upgrade && !SUB.isPaid(meet.tier)))) { const room = meet.room; stopTimer(); meet = null; joinMeeting(room); } }
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
        if (await livePass().catch(() => null)) { passJoin(m.room, true); return; }
        return passLose(m, 'ended');
      }
      passTake(m, j);
    } catch (e) {
      if (pmeet === m) { if (nowS() >= (m.exp || 0)) passLose(m, 'unreachable'); else passSchedule(m, RETRY_MS); }
    }
  }
  function passJoin(room, force) {
    if (!on()) return Promise.resolve(null);
    if (!force && pmeet && pmeet.room === room && (pmeet.ticket || pmeet.moved || pmeet.pending)) return pmeet.joining;
    passStop();
    const m = pmeet = { room, tag: null, ticket: null, exp: 0, gen: 0, until: 0, timer: null, moved: null, joining: null, pending: true };
    m.joining = (async () => {
      if (!(await livePass())) return null;
      const w = await wallet();
      m.tag = await SUB.meetingTag(room);
      const j = await post('/gifos/pass/join', await passSigned('pass-join:' + m.tag, { meeting: m.tag, passes: w.passes }));
      if (pmeet !== m) return null;
      if (!j.active) { m.moved = 'inactive'; return null; }
      passTake(m, j);
      return m.ticket;
    })().catch(() => null).then((t) => { m.pending = false; return t; });
    return m.joining;
  }
  // This meeting's pass ticket, or null. A page that knocks before its
  // meeting started (no join yet) joins with the pass now.
  async function currentPassTicket(room) {
    if (!on()) return null;
    if (!pmeet || pmeet.room !== room) { if (!(await livePass().catch(() => null))) return null; passJoin(room, true); }
    const m = pmeet;
    await m.joining;
    return m.ticket && nowS() < m.exp ? m.ticket : null;
  }

  // ---- the room's plan and the door's challenge ----------------------------
  // The admin's order that carries their plan into the room, or null.
  // A live four-hour pass rides instead of a ticket whose plan is below it
  // (none, free, $2): the best right held is the one the room reads.
  const beatsPass = (tier) => SUB.isPaid(tier) && !SUB.bestRights([SUB.ticketRights({ tier, exp: 1 }), SUB.passRights({ end: 1 })]).pass;
  async function roomOrder(room) {
    if (!on()) return null;
    const ticket = await currentTicket(room);
    if (!(ticket && meet && beatsPass(meet.tier))) {
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
    if (!on()) return null;
    const ticket = await currentTicket(room);
    if (ticket && meet && SUB.isPaid(meet.tier)) return { ticket, proof: await signText(SUB.proofMessage(SUB.doorContext(room), nonce)) };
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

  // ---- an open room's admin by subscription (capture) -------------------------
  // Only the $5 and $10 plans capture an open room: such a room keeps no door
  // limit. canCapture: this browser's ticket for the meeting is on such a plan.
  const capturePlan = (tier) => SUB.isPaid(tier) && SUB.TIERS[tier].roomLimit == null;
  function canCapture(room) { return !!(meet && meet.room === room && meet.ticket && nowS() < meet.exp && capturePlan(meet.tier)); }
  // A captor's ticket checked by anyone in the room: the ticket or null.
  async function captureTicket(tk, room) {
    try { const t = await SUB.verifyTicket(tk, verifyPay, nowS(), await SUB.meetingTag(room)); return t && capturePlan(t.tier) ? t : null; } catch (e) { return null; }
  }
  // {tk, w}: the ticket and an order signed by the ticket's key, for the meeting server.
  async function captureOrder(room) {
    if (!canCapture(room)) return null;
    const tk = await currentTicket(room); if (!tk) return null;
    const k = await myKey(), sp = JSON.stringify({ act: 'capture', ts: Date.now(), room });
    return { tk, w: { sp, sig: await signText(sp), pub: k.pub } };
  }
  async function captureKeys() { const k = await myKey(); return { priv: k.priv, pubB64: k.pub }; }

  // ---- what this browser holds, and what is in effect now ---------------------
  // Read from this browser's copy of the subscription file (or the one in the
  // Providers folder): each subscription with its plan, period, standing and
  // date; each pass not yet run out with its window; and the rights in effect
  // now with the reason (the best of them wins).
  const PLAN_SHORT = { room20: ['planRoom20', 'Room 20'], unlimited: ['planUnlimited', 'Unlimited'], streamer: ['planStreamer', 'Streamer'], free: ['planFree', 'Free'] };
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
    const free = lic ? null : await verifiedFree();
    let sub = null;
    if (lic) {
      const status = st.status === 'CANCELLED' ? 'cancelled' : st.paidThrough && st.paidThrough < n ? 'grace' : 'active';
      sub = { tier: lic.tier, period: cred && cred.period === 'yearly' ? 'yearly' : 'monthly', status, until: st.until || lic.exp, renews: status === 'active' ? st.paidThrough || null : null };
    }
    const held = (await passes().catch(() => [])).filter((x) => x.o.end > n).map((x) => ({ id: x.o.id, start: x.o.start, end: x.o.end, live: SUB.passLive(x.o, n) }));
    const base = SUB.rightsOf(lic || free, n);
    const live = held.filter((x) => x.live);
    const lp = live.length ? live[live.length - 1] : null;
    // The passes run back to back: the window in effect ends with the last
    // pass that follows on without a gap.
    let passEnd = lp ? lp.end : 0;
    for (const x of held) if (lp && x.start <= passEnd && x.end > passEnd) passEnd = x.end;
    const best = lp ? SUB.bestRights([base, SUB.passRights({ end: passEnd })]) : base;
    const now = best.pass ? { tier: best.tier, why: 'pass', until: passEnd } : base.tier ? { tier: base.tier, why: base.tier === 'free' ? 'free' : 'sub', until: base.until } : { tier: null, why: 'none' };
    const then = best.pass && base.tier ? base.tier : null;
    return { sub, free: !!free, passes: held, now, then };
  }
  // One line for the meeting's status: what is in effect, quietly.
  function nowLine(c) {
    if (c.now.why === 'pass') return fill(tx('nowPassLine', '{plan} until {until}, {left} left'), { plan: planShort(c.now.tier), until: clockOf(c.now.until), left: leftOf(c.now.until - nowS()) });
    if (c.now.why === 'sub') return planShort(c.now.tier);
    return '';
  }
  async function paintNow() {
    if (!on() || typeof document === 'undefined') return;
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
  // The credentials view: what is held and what is in effect, in Settings.
  async function paintHeld(box) {
    const c = await credentialsNow();
    const n = nowS();
    const p = (id, text) => { const e = el('p', { class: 'set-help', id }, text); box.appendChild(e); return e; };
    let why;
    if (c.now.why === 'pass') why = fill(tx('nowByPass', 'In effect now: {plan} until {until} ({left} left), from your four-hour pass.'), { plan: planShort(c.now.tier), until: clockOf(c.now.until), left: leftOf(c.now.until - n) });
    else if (c.now.why === 'sub') why = fill(tx('nowBySub', 'In effect now: {plan}, from your subscription.'), { plan: planShort(c.now.tier) });
    else if (c.now.why === 'free') why = tx('nowByFree', 'In effect now: Free. Admin rooms of up to 5 people.');
    else why = tx('nowByNone', 'In effect now: no plan. Open rooms are free.');
    p('held-now', why);
    if (c.then) p('held-then', fill(tx('nowThen', 'When the pass ends: {plan}, from your subscription.'), { plan: planShort(c.then) }));
    if (c.sub) {
      const per = c.sub.period === 'yearly' ? tx('perYearly', 'yearly') : tx('perMonthly', 'monthly');
      const stand = c.sub.status === 'cancelled' ? fill(tx('subCancelledUntil', 'cancelled, works until {date}'), { date: dateOf(c.sub.until) })
        : c.sub.status === 'grace' ? fill(tx('subGrace', 'payment late, works until {date}'), { date: dateOf(c.sub.until) })
          : c.sub.renews ? fill(tx('subRenews', 'active, renews {date}'), { date: dateOf(c.sub.renews) }) : tx('subActive', 'active');
      p('held-sub', fill(tx('heldSub', 'Subscription: {plan}, {period}, {standing}.'), { plan: planShort(c.sub.tier), period: per, standing: stand }));
    }
    for (const x of c.passes) {
      const e = x.live ? fill(tx('heldPassLive', 'Four-hour pass: Unlimited until {until}, {left} left.'), { until: clockOf(x.end), left: leftOf(x.end - n) })
        : fill(tx('heldPassNext', 'Four-hour pass: Unlimited from {start} to {until}.'), { start: clockOf(x.start), until: clockOf(x.end) });
      const q = p('', e); q.className = 'set-help held-pass'; q.dataset.pass = x.id;
    }
    if (c.passes.length && pmeet && pmeet.moved === 'moved') p('held-pass-moved', tx('passMoved', 'Your four-hour pass is in use in another meeting now: it works in one meeting at a time.'));
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
    const held = el('div', { id: 'sub-held' });
    row.appendChild(held);
    await paintHeld(held).catch(() => {});
    // In the app the prices shown are the store's own.
    const inApp = !!RAIL();
    const price = inApp ? await RAIL().prices().catch(() => ({})) : {};
    const skuOf = (want) => { const k = inApp && SUB.storeSku(RAIL().store(), want); return k ? price[k.basePlan ? k.product + ':' + k.basePlan : k.product] || null : null; };
    const passPrice = skuOf({ what: 'pass' });
    const passBtn = el('button', { type: 'button', class: BTN, style: BTN_STYLE, id: 'sub-pass-buy' }, passPrice ? tx('passBuyAt', '{price}: Unlimited for the next 4 hours').replace('{price}', passPrice) : tx('passBuy', '$1: Unlimited for the next 4 hours'));
    passBtn.onclick = async () => {
      passBtn.disabled = true; say(inApp ? '' : tx('passOpening', 'Opening PayPal…'));
      try {
        const r = await buyPass(say);
        say(r && r.passJson ? tx('passThanks', 'Thank you. Your four-hour pass is on.') : inApp ? msg.textContent : tx('passNotConfirmed', 'PayPal did not confirm the payment.'));
        paintSettings();
      } catch (e) { passBtn.disabled = false; say(String(e.message || e)); }
    };
    row.appendChild(passBtn);
    if (!inApp) row.appendChild(el('p', { class: 'set-help', id: 'sub-pass-how' }, tx('passHow', 'Pay by card or PayPal.')));
    const lic = await verifiedLicense();
    const st = readState();
    const cred = await credential();
    if (lic) {
      const t = SUB.TIERS[lic.tier];
      const yearly = cred && cred.period === 'yearly';
      row.appendChild(el('p', { class: 'set-help' }, 'Your plan: ' + t.name + ' (' + (yearly ? t.priceYear + ' a year' : t.price + ' a month') + ').'));
      const viaStore = /^[GA]-/.test(String(lic.subId || ''));
      row.appendChild(el('p', { class: 'set-help' }, st.status === 'CANCELLED' ? SUB.TEXT.cancelled + ' Ends ' + dateOf(st.until || lic.exp) + '.' : inApp || viaStore ? tx('subRenewsAuto', 'Renews automatically.') : 'Renews through PayPal.'));
      row.appendChild(el('p', { class: 'set-help' }, 'Your subscription works in one meeting at a time. Joining a meeting, here or in another browser with your subscription file, moves it there.'));
      if (meet && meet.moved === 'moved') row.appendChild(el('p', { class: 'set-help' }, 'It is in use in another meeting now.'));
      // The library is a web page; the apps are the meeting only.
      if (t.storage) if (!inApp) {
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
    } else {
      if (st.subId && st.status && st.status !== 'APPROVAL_PENDING') row.appendChild(el('p', { class: 'set-help' }, SUB.TEXT.lapsed));
      if (await verifiedFree()) row.appendChild(el('p', { class: 'set-help', id: 'sub-free-plan' }, tx('subFreePlan', 'Your plan: Free. Admin rooms of up to 5 people.')));
      row.appendChild(el('p', { class: 'set-help' }, 'Open rooms are free. A subscription adds rooms you run as admin, and video for people whose networks block direct connections.'));
      if (!inApp) row.appendChild(el('p', { class: 'set-help', id: 'sub-how' }, tx('subHow', 'Subscribe with PayPal (card or PayPal balance).')));
      for (const period of ['monthly', 'yearly']) {
        for (const id of SUB.TIER_IDS) {
          const t = SUB.TIERS[id];
          if (inApp && !SUB.storeSku(RAIL().store(), { what: 'sub', tier: id, period })) continue;   // not sold in this store: not offered
          const sp = skuOf({ what: 'sub', tier: id, period });
          const label = (period === 'yearly' ? (sp || t.priceYear) + ' a year' : (sp || t.price) + ' a month') + ': ' + t.name;
          const b = el('button', { type: 'button', class: BTN, style: BTN_STYLE, 'data-tier': id, 'data-period': period }, label);
          b.onclick = async () => {
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
          row.appendChild(b);
        }
      }
    }
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
            say(st2 && st2.licenseJson ? tx('credsLoadedSub', 'Your credentials are loaded. A subscription works in one meeting at a time.') : tx('credsLoaded', 'Your credentials are loaded.'));
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
      d.onclick = () => { downloadFile().then(() => say('Saved. Keep it private: anyone with the file can use your subscription' + (lic && SUB.TIERS[lic.tier].storage ? ' and open your library. Keep a backup: if you lose it, nobody, not even GifOS, can recover your library.' : '.')), (e) => say(String(e.message || e))); };
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
  // mayCreateAdminRoom(say) -> true: anyone may make an admin room. Without
  // a paid plan the free plan's license is fetched first (up to 5 people);
  // a payment service that cannot be reached does not stop the room.
  async function mayCreateAdminRoom(say) {
    if (!on()) return true;
    const r = await planRights();
    if (r.adminRooms) return true;
    await ensureFree();
    return true;
  }

  // Shown instead of the meeting when the room is full for this person.
  // free: the room is on the free plan (5 people).
  function showFull(free) {
    const m = document.getElementById('left-modal');
    const t = document.getElementById('left-title');
    const n = document.getElementById('left-note');
    if (t) t.textContent = free ? tx('subFullFree', SUB.TEXT.fullFree) : 'This meeting is full';
    if (n) n.textContent = free ? tx('subFullFreeNote', SUB.TEXT.fullFreeNote) : SUB.TEXT.full;
    if (m && !document.getElementById('sub-full-go')) {
      const b = el('button', { type: 'button', id: 'sub-full-go' }, 'Subscribe');
      b.onclick = () => { m.style.display = 'none'; openSettings(); };
      const box = m.querySelector('.name-box');
      if (box) box.insertBefore(b, box.querySelector('#left-rejoin'));
    }
    if (m) m.style.display = 'flex';
  }

  // The host of a room on the free plan, when the door turned someone away:
  // a one-tap upgrade to the $2 plan (20 people) over the meeting.
  function showHostPrompt() {
    if (!on() || typeof document === 'undefined' || !document.body) return false;
    let bar = document.getElementById('sub-host-up');
    if (bar) { bar.hidden = false; return true; }
    bar = el('div', { id: 'sub-host-up', role: 'status', 'aria-live': 'polite', style: 'position:fixed;left:50%;bottom:5.5rem;transform:translateX(-50%);z-index:41;max-width:min(92vw,28rem);background:var(--panel,#1d1d2b);color:var(--text,#e8e8f4);border:1px solid var(--border,#2a2a3f);border-radius:.6rem;padding:.6rem .8rem;box-shadow:0 12px 32px rgba(0,0,0,.5);font:14px/1.4 system-ui,sans-serif;display:flex;gap:.6rem;align-items:center;flex-wrap:wrap' });
    const msg = el('span', { id: 'sub-host-up-msg', style: 'flex:1 1 12rem' }, tx('subHostTurned', 'Someone was turned away: this room is full on the free plan (5 people).'));
    const go = el('button', { type: 'button', id: 'sub-host-up-go', class: BTN, style: BTN_STYLE }, tx('subUp20', 'Subscribe for up to 20'));
    const x = el('button', { type: 'button', id: 'sub-host-up-x', class: BTN, style: BTN_STYLE, 'aria-label': tx('subUpClose', 'Close') }, '\u00d7');
    go.onclick = async () => {
      go.disabled = true;
      try {
        const r = await subscribe('room20', 'monthly', (t) => { msg.textContent = t; });
        if (r && r.licenseJson) bar.remove(); else { if (!RAIL()) msg.textContent = r && r.status === 'APPROVAL_PENDING' ? SUB.TEXT.pending : 'PayPal did not confirm the subscription.'; go.disabled = false; }
      } catch (e) { msg.textContent = String(e.message || e); go.disabled = false; }
    };
    x.onclick = () => { bar.remove(); };
    bar.appendChild(msg); bar.appendChild(go); bar.appendChild(x);
    document.body.appendChild(bar);
    return true;
  }

  function boot() {
    if (!on()) return;
    const b = document.getElementById('setbtn');
    if (b) b.addEventListener('click', () => { paintSettings().catch(() => {}); });
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

  GifOS.meetSubs = {
    enabled: on, rights, planRights, refresh, subscribe, cancel, buyPass, claimPass, passes, livePass, credentialsNow, paintNow, paintSettings, openSettings, mayCreateAdminRoom, showFull, ensureFree, showHostPrompt,
    roomOrder, roomTier, proveAtDoor, checkShown, newNonce,
    joinMeeting, leaveMeeting, currentTicket, canCapture, captureTicket, captureOrder, captureKeys, fileBytes, downloadFile, useFile, librarySigner, restoreInApp,
    passMeeting: () => (pmeet ? { room: pmeet.room, gen: pmeet.gen, exp: pmeet.exp, until: pmeet.until, moved: pmeet.moved, held: !!pmeet.ticket } : null),
    currentPassTicket,
    meeting: () => (meet ? { room: meet.room, gen: meet.gen, exp: meet.exp, moved: meet.moved, held: !!meet.ticket, tier: meet.tier, paid: !!(meet.ticket && SUB.isPaid(meet.tier)) } : null),
  };
})(typeof window !== 'undefined' ? window : globalThis);
