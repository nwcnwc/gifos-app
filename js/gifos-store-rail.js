/*
 * gifos-store-rail.js — the store rail: how anything is paid for inside the
 * GifOS Meet apps (Android: Google Play; iPhone and iPad: the App Store).
 *
 * In the apps this is the ONLY rail. Every payment the page can start (a
 * plan, the four-hour pass, a tip from the Tip app) comes here as one
 * request, and the store's own purchase sheet is the only thing the person
 * sees. In a browser this file does nothing: present() is false and the web
 * rails stay exactly as they are.
 *
 *   GifOS.storeRail.present()            in an app whose shell offers purchases
 *   GifOS.storeRail.pay(request)         -> the payment service's answer
 *     request: {what:'sub', tier, period, buyerKey, sign, replace?}
 *              {what:'pass', buyerKey, sign, held}
 *              {what:'tip', cents, buyerKey, sign}
 *              payee (optional): must be GifOS. Any other payee is refused.
 *              sign(text) -> base64 Ed25519 signature by buyerKey's key.
 *     -> {state:'done', ...the service's answer} | {state:'cancelled'} |
 *        {state:'pending'} (the store is still waiting on the buyer; the
 *        purchase is picked up later by restore()) | throws Error(message)
 *   GifOS.storeRail.restore(handlers)    purchases the store already holds
 *   GifOS.storeRail.manage(product?)     the store's own subscription screen
 *   GifOS.storeRail.tipChoice(cents)     the tip one store sheet can take
 *
 * Rules the rail keeps:
 *   - Products are fixed in the store, so each request maps to a product in
 *     the table (gifos-store-skus.js). No matching product: refused, in
 *     words, before any sheet opens.
 *   - The payee is GifOS. The rail never pays anyone else.
 *   - The purchase is proven to the payment service, which checks it with
 *     the store and answers with what it issues for that request on any
 *     rail: a credential for a plan or pass, a thank-you for a tip.
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});
  const SUB = () => GifOS.sub;
  const native = () => root.GifosNative || null;
  const info = () => { const n = native(); try { return (n && n.info && n.info()) || {}; } catch (e) { return {}; } };
  const store = () => { const i = info(); return i.payments === true && (i.store === 'play' || i.store === 'appstore') ? i.store : null; };
  const present = () => !!(store() && native() && typeof native().request === 'function');
  const payBase = () => String(root.GIFOS_PAY_URL || 'https://pay.gifos.app').replace(/\/$/, '');
  const nowS = () => Math.floor(Date.now() / 1000);
  const PAYEE = () => (GifOS.storeSkus && GifOS.storeSkus.payee) || 'gifos.app';

  const TEXT = {
    noProduct: 'This is not available in the app.',
    otherPayee: 'In this app, payments go to GifOS only.',
    wholeDollars: 'A tip is a whole number of dollars.',
    overMax: (max) => 'The largest tip here is $' + max + '.',
    busy: 'Another purchase is still open.',
    failed: 'The purchase did not go through. You were not charged.',
    notConfirmed: 'The store has not confirmed this purchase yet. It will appear here as soon as it does.',
  };
  const word = (key, en) => { try { const L = GifOS.i18n; if (L && L.ui() !== 'en' && L.has('meet.store.' + key)) return L.t('meet.store.' + key); } catch (e) {} return en; };
  const fail = (key, en) => { const e = new Error(word(key, en)); e.storeRail = key; return e; };

  async function post(path, body) {
    const r = await fetch(payBase() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let j = null; try { j = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, body: j };
  }
  // The transaction's own fields, read (not trusted) to name it in the ask.
  function jwsFields(jws) {
    try { const p = String(jws).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(atob(p + '='.repeat((4 - (p.length % 4)) % 4))); } catch (e) { return {}; }
  }
  async function tipAskId(refs) {
    const d = new Uint8Array(await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode('gifos-store-tip:' + refs.join('\n'))));
    let h = ''; for (let i = 0; i < 12; i++) h += d[i].toString(16).padStart(2, '0');
    return h;
  }

  // The request's product(s), or a refusal in words.
  function productsFor(req) {
    const st = store();
    if (req.payee != null && String(req.payee).toLowerCase() !== PAYEE() && String(req.payee).toLowerCase() !== 'payments@' + PAYEE()) throw fail('otherPayee', TEXT.otherPayee);
    if (req.what === 'tip') {
      const plan = SUB().tipPlan(st, req.cents);
      if (!plan.ok && plan.why === 'whole-dollars') throw fail('wholeDollars', TEXT.wholeDollars);
      if (!plan.ok && plan.why === 'over-max') throw fail('overMax', TEXT.overMax(Math.floor(plan.max / 100)));
      const one = plan.ok ? SUB().tipSingle(st, req.cents) : null;
      if (!one) throw fail('noProduct', TEXT.noProduct);   // one sheet per tip: tipChoice() says what fits
      return [{ kind: 'one', product: one.product, quantity: one.quantity }];
    }
    const sku = SUB().storeSku(st, req);
    if (!sku) throw fail('noProduct', TEXT.noProduct);
    return [{ kind: req.what === 'sub' ? 'sub' : 'one', product: sku.product, basePlan: sku.basePlan, quantity: 1 }];
  }

  // Prove one finished purchase to the payment service.
  async function claim(req, bought) {
    const st = store(); const at = nowS(); const S = SUB();
    const ref = st === 'play' ? { token: bought.token } : { jws: bought.jws };
    if (req.what === 'sub') {
      const id = await S.storeSubId(st, st === 'play' ? bought.token : String(jwsFields(bought.jws).originalTransactionId || ''));
      return post('/gifos/store/sub/claim', Object.assign({ store: st, buyerKey: req.buyerKey, at, sig: await req.sign(S.askMessage('store-sub', id, at)), renewalJws: bought.renewalJws }, ref));
    }
    if (req.what === 'pass') {
      const id = st === 'play' ? await S.storeSubId(st, bought.token) : S.storeOrderId(st, String(jwsFields(bought.jws).transactionId || ''));
      return post('/gifos/store/pass/claim', Object.assign({ store: st, buyerKey: req.buyerKey, at, sig: await req.sign(S.askMessage('store-pass', id, at)), held: req.held || [] }, ref));
    }
    const id = await tipAskId([st === 'play' ? bought.token : bought.jws]);
    return post('/gifos/store/tip/claim', { store: st, buyerKey: req.buyerKey, at, sig: await req.sign(S.askMessage('store-tip', id, at)), purchases: [Object.assign({ product: bought.product }, ref)] });
  }
  // The store hands a purchase over only once the payment service has it:
  // a transaction is finished after the answer, never before.
  async function settle(req, bought) {
    const r = await claim(req, bought);
    if (r.status === 202 || (r.body && r.body.pending)) return { state: 'pending' };
    if (!r.ok || !r.body) {
      // Refused for good (not ours, refunded, another key): let the store close it. Unreachable: keep it for restore().
      if (r.status === 403 || r.status === 404 || r.status === 400) await native().request('store.finish', { transactionId: bought.transactionId }).catch(() => {});
      const e = new Error((r.body && r.body.error) || word('notConfirmed', TEXT.notConfirmed)); e.status = r.status; throw e;
    }
    await native().request('store.finish', { transactionId: bought.transactionId }).catch(() => {});
    return Object.assign({ state: 'done' }, r.body);
  }

  let open = false;
  async function pay(req) {
    if (!present()) throw new Error('store purchases are not available here');
    if (!req || typeof req.buyerKey !== 'string' || typeof req.sign !== 'function') throw new Error('the request needs the buyer\'s key');
    const items = productsFor(req);
    if (open) throw fail('busy', TEXT.busy);
    open = true;
    try {
      const it = items[0];
      const got = await native().request('store.buy', {
        kind: it.kind, product: it.product, basePlan: it.basePlan, quantity: it.quantity,
        account: req.buyerKey, accountUuid: await SUB().accountUuid(req.buyerKey),
        replace: req.replace && req.replace.token ? { token: req.replace.token, mode: req.replace.mode === 'downgrade' ? 'downgrade' : 'upgrade' } : undefined,
      });
      if (!got || got.ok === false) {
        if (got && got.error === 'already-owned') { const e = new Error(word('notConfirmed', TEXT.notConfirmed)); e.storeRail = 'owned'; throw e; }
        throw fail('failed', TEXT.failed);
      }
      if (got.state === 'cancelled') return { state: 'cancelled' };
      if (got.state === 'pending') return { state: 'pending' };
      return await settle(req, Object.assign({ product: it.product }, got));
    } finally { open = false; }
  }

  // restore(handlers): what the store already holds for this person. Each
  // purchase is offered to its handler, which names the buyer key to claim
  // it with: handlers.sub / .pass / .tip (purchase) -> request | null.
  async function restore(handlers) {
    if (!present()) return [];
    const got = await native().request('store.owned', {});
    const out = [];
    for (const p of (got && got.purchases) || []) {
      if (p.state !== 'purchased') { out.push({ product: p.product, state: 'pending' }); continue; }
      const f = p.jws ? jwsFields(p.jws) : {};
      const what = SUB().storeProduct(store(), p.product, p.basePlan || (p.basePlans && p.basePlans[0])) || SUB().storeProduct(store(), p.product, 'monthly');
      if (!what) continue;
      const h = handlers && handlers[what.what];
      const req = h ? await h(Object.assign({ account: p.account || f.appAccountToken || null }, what, p)) : null;
      if (!req) continue;
      try { out.push(Object.assign({ product: p.product }, await settle(Object.assign({ what: what.what }, what, req), p))); }
      catch (e) { out.push({ product: p.product, state: 'refused', error: String(e && e.message || e) }); }
    }
    return out;
  }

  // owned(): the store's current purchases, each with what it is.
  async function owned() {
    if (!present()) return [];
    const got = await native().request('store.owned', {});
    return ((got && got.purchases) || []).map((p) => Object.assign({}, p, SUB().storeProduct(store(), p.product, p.basePlan || 'monthly') || { what: null }));
  }
  // A tip the store cannot take in one purchase is offered as the nearest
  // amount below it that it can; the person agrees before any sheet opens.
  function confirmAmount(asked, fit) {
    return new Promise((resolve) => {
      const d = root.document;
      const wrap = d.createElement('div');
      wrap.id = 'gifos-store-confirm';
      wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:1rem';
      const box = d.createElement('div');
      box.style.cssText = 'background:#1b1b2a;color:#e8e8f4;border-radius:.8rem;padding:1.1rem;max-width:22rem;font:16px/1.4 system-ui';
      const p = d.createElement('p'); p.style.margin = '0 0 1rem';
      p.textContent = word('tipFit', 'A tip of ${asked} is not available here. Tip ${fit} instead?').replace('{asked}', String(asked / 100)).replace('{fit}', String(fit / 100));
      const row = d.createElement('div'); row.style.cssText = 'display:flex;gap:.6rem;justify-content:flex-end';
      const mk = (id, text, v) => { const b = d.createElement('button'); b.type = 'button'; b.id = id; b.textContent = text; b.style.cssText = 'font:inherit;min-height:44px;padding:.5rem 1rem;border-radius:.5rem;border:1px solid #3a3a55;background:' + (v ? '#3b6cff' : 'transparent') + ';color:inherit'; b.onclick = () => { wrap.remove(); resolve(v); }; return b; };
      row.appendChild(mk('gifos-store-confirm-no', word('cancel', 'Cancel'), false));
      row.appendChild(mk('gifos-store-confirm-yes', word('tipFitYes', 'Tip ${fit}').replace('{fit}', String(fit / 100)), true));
      box.appendChild(p); box.appendChild(row); wrap.appendChild(box); d.body.appendChild(wrap);
    });
  }
  const manage = (product) => (present() ? native().request('store.manage', { product }) : Promise.resolve(null));
  const tipChoice = (cents) => (present() ? SUB().tipOneSheet(store(), cents) : 0);
  // The store's own price strings for what the page shows.
  async function prices() {
    if (!present()) return {};
    const k = GifOS.storeSkus[store()]; const subs = [], one = [k.pass].concat(Object.keys(k.tips).map((c) => k.tips[c]));
    for (const t of Object.keys(k.subs)) { const row = k.subs[t]; if (row.product) subs.push(row.product); else { subs.push(row.monthly); subs.push(row.yearly); } }
    const r = await native().request('store.products', { subs, oneTime: one }).catch(() => null);
    const out = {};
    for (const p of (r && r.products) || []) { out[p.product] = p.price; for (const b of p.basePlans || []) out[p.product + ':' + b.basePlan] = b.price; }
    return out;
  }

  GifOS.storeRail = { present, store, pay, restore, owned, manage, tipChoice, prices, confirmAmount, TEXT };
})(typeof window !== 'undefined' ? window : globalThis);
