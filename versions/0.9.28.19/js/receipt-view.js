/*
 * receipt-view.js — the RECEIPT view (receipt.html#id=<fileId>).
 *
 * A receipt GIF (manifest appId 'gifos-receipt', receipt: true) from the
 * Home Screen's Purchases folder opens here instead of running as an app.
 * Every receipt ever issued has that appId, the old App-GIF form included,
 * so old receipts show here too, unchanged.
 *
 * What it shows is drawn by the OS from the SIGNED proof inside, never from
 * the file's own HTML or manifest name:
 *   - a purchase or tip (receipt.json): the pay Worker's receipt, verified
 *     against this site's /gifos-pay.key, then registered on this computer
 *     through gifos-pay-broker.js ingestReceiptFiles, exactly what opening
 *     the file as an app did (the restore story: no account anywhere);
 *   - a Meet subscription (subscription.json / passes.json, meet-subs.js
 *     keepReceipt): the plan, its passes, and the signed license when the
 *     file carries one. GifOS Meet and /subscription read the credential
 *     from the Purchases folder themselves; nothing is granted here.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS || {};
  const I = GifOS.i18n;
  // The receipt words live in i18n/<locale>/charge.json; draw once it landed.
  let ready = Promise.resolve();
  try { if (I && I.load) ready = Promise.resolve(I.load('charge')).catch(() => {}); } catch (e) {}
  const tr = (key, en, p) => {
    try { if (I && I.has(key)) return I.t(key, p); } catch (e) {}
    return String(en).replace(/\{(\w+)\}/g, (m, k) => (p && p[k] != null ? p[k] : m));
  };
  const RECEIPT_APP_ID = 'gifos-receipt';
  const doc = root.document;
  const $ = (id) => doc.getElementById(id);
  const text = (v) => (v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v == null ? '' : v));
  const json = (files, name) => { try { return files[name] != null ? JSON.parse(text(files[name])) : null; } catch (e) { return null; } };
  const fmtUsd = (units) => {
    try {
      const n = BigInt(units);
      if (n % 10000n !== 0n) return '$' + (n / 1000000n) + '.' + String(n % 1000000n).padStart(6, '0').replace(/0+$/, '');   // a 3% leg of an odd amount, never rounded
      const c = n / 10000n; return '$' + (c / 100n) + '.' + String(c % 100n).padStart(2, '0');
    } catch (e) { return String(units || ''); }
  };
  const when = (ms) => { try { return (I && I.fmt) ? I.fmt.dateTime(ms) : new Date(ms).toLocaleString(); } catch (e) { return new Date(ms).toLocaleString(); } };

  function el(tag, cls, t) { const e = doc.createElement(tag); if (cls) e.className = cls; if (t != null) e.textContent = t; return e; }
  function head(title, sub) { $('rv-title').textContent = title; $('rv-sub').textContent = sub || ''; doc.title = title + ' — GifOS'; }
  function slip(rows) {
    const box = el('div', 'slip'); box.id = 'rv-slip';
    for (const [k, v] of rows) {
      if (v == null || v === '') continue;
      const r = el('div', 'row'); r.appendChild(el('span', null, k));
      // A value is text, or a node the view built (a link).
      if (typeof v === 'object' && v.nodeType) { const b = el('b'); b.appendChild(v); r.appendChild(b); } else r.appendChild(el('b', null, String(v)));
      box.appendChild(r);
    }
    $('rv').appendChild(box);
  }
  function line(cls, t, id) { const p = el('p', cls, t); if (id) p.id = id; $('rv').appendChild(p); return p; }
  function fail(msg) { head(tr('charge.receipt.title', 'GifOS Receipt'), msg); doc.documentElement.dataset.receipt = 'none'; }

  async function showPurchase(files, m) {
    const wrapped = json(files, 'receipt.json') || {};
    let receipt = null;
    try { receipt = await GifOS.payBroker.verifyReceipt(wrapped.receiptJson, wrapped.sig); } catch (e) { receipt = null; }
    if (!receipt) {
      head(tr('charge.receipt.title', 'GifOS Receipt'), '');
      line('seal bad', tr('charge.receiptView.unverified', 'This receipt does not verify against gifos.app’s key. It proves nothing and grants nothing.'), 'rv-seal');
      doc.documentElement.dataset.receipt = 'bad';
      return;
    }
    head(String(receipt.appId || tr('charge.receipt.title', 'GifOS Receipt')),
      receipt.sku ? tr('charge.receipt.purchase', 'Purchase — unlocks {sku}', { sku: receipt.sku }) : tr('charge.receipt.tip', 'Tip — thank you!'));
    slip([
      [tr('charge.receipt.amount', 'Amount'), fmtUsd(receipt.amount)],
      [tr('charge.receipt.paid', 'Paid'), ((GifOS.charge && GifOS.charge.PAID_BY) || {})[receipt.rail] || String(receipt.rail || '')],   // the same words the receipt file uses
      [tr('charge.receipt.to', 'To'), receipt.payeeId || ''],
      [tr('charge.receipt.when', 'When'), receipt.at ? when(receipt.at) : ''],
    ].concat(txRows(receipt)));
    paypalNote(receipt);
    line('seal ok', '✓ ' + tr('charge.receiptView.verified', 'Signed by gifos.app and verified on this computer.'), 'rv-seal');
    // Registering is what opening the file always did; a refusal (one
    // payment, one purchase) is said, and the receipt above still stands.
    const st = line('note', '', 'rv-restore');
    try {
      await GifOS.payBroker.ingestReceiptFiles(files);
      st.textContent = receipt.sku ? tr('charge.receiptView.restored', 'The purchase is registered on this computer.') : '';
    } catch (e) { st.textContent = String((e && e.message) || e); }
    line('note', tr('charge.receipt.proof', 'This file IS the proof: it carries a receipt signed by gifos.app, and opening it on any GifOS computer verifies the signature and registers the purchase there. Sharing it shares your license — the app treats whoever holds this receipt as the same buyer (same saves, same identity). Keep it with your backups.'));
    doc.documentElement.dataset.receipt = 'purchase';
  }

  // EACH LEG, CHECKABLE BY ANYONE. On chain: one row per leg, labelled by
  // what it paid (gifos-charge.js receiptLegs), linked to the chain's block
  // explorer (gifos-base-net.js txUrl, the one table of explorers). PayPal
  // has no public explorer: the ids are shown, and the only link is to the
  // buyer's own PayPal activity, which carries no id at all.
  const PAYPAL_ACTIVITY = 'https://www.paypal.com/myaccount/activities';
  function link(href, t, cls) { const a = el('a', cls == null ? 'tx-link' : cls, t); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
  function txRows(receipt) {
    const C = GifOS.charge, B = GifOS.baseNet;
    if (!C || !C.receiptLegs) return [[tr('charge.receipt.transaction', 'Transaction'), receipt.tx || '']];
    const got = C.receiptLegs(receipt, B && B.FEE_ADDRESS);
    // A chain receipt without a network (the transfer rail) was paid on the
    // network the payment service runs: the one this page pays on.
    const net = got.network || (B && B.active ? (() => { try { return B.active().caip; } catch (e) { return null; } })() : null);
    const many = got.legs.filter((l) => l.role === 'tx').length > 1;
    let k = 0;
    return got.legs.map((l) => {
      const label = l.role === 'creator' ? tr('charge.receiptView.legCreator', 'Creator ({amount})', { amount: fmtUsd(l.amount) })
        : l.role === 'fee' ? tr('charge.receiptView.legFee', 'GifOS fee ({amount})', { amount: fmtUsd(l.amount) })
        : l.role === 'order' ? tr('charge.receiptView.paypalOrder', 'PayPal order')
        : got.kind === 'paypal' ? tr('charge.receiptView.paypalTx', 'PayPal transaction')
        : many ? tr('charge.receiptView.legTx', 'Transaction {k}', { k: ++k }) : tr('charge.receipt.transaction', 'Transaction');
      const url = got.kind === 'chain' && B && B.txUrl ? B.txUrl(net, l.tx) : null;
      return [label, url ? link(url, l.tx) : l.tx];
    });
  }
  function paypalNote(receipt) {
    if (receipt.rail !== 'paypal') return;
    const p = el('p', 'note'); p.id = 'rv-paypal';
    p.appendChild(link(PAYPAL_ACTIVITY, tr('charge.receiptView.paypalFind', 'Find it in your PayPal activity'), ''));
    $('rv').appendChild(p);
  }

  // The license verifies against the same key as a purchase receipt
  // (/gifos-pay.key), through gifos-sub.js's own reader.
  async function licenseOf(files) {
    const l = json(files, 'license.json');
    if (!l || !GifOS.sub || !GifOS.sub.verifyLicense) return null;
    try {
      const r = await fetch('/gifos-pay.key');
      if (!r.ok) return null;
      const raw = GifOS.sign._b64ToBytes((await r.text()).trim());
      if (raw.length !== 32) return null;
      return await GifOS.sub.verifyLicense({ licenseJson: l.licenseJson, sig: l.sig }, (sig, msg) => GifOS.ed.verify(raw, sig, msg), Math.floor(Date.now() / 1000));
    } catch (e) { return null; }
  }
  async function showSubscription(files) {
    const SUB = GifOS.sub || {};
    const c = SUB.credentialOk ? SUB.credentialOk(json(files, 'subscription.json')) : null;
    const w = SUB.walletOk ? SUB.walletOk(json(files, 'passes.json')) : null;
    const tier = c && SUB.TIERS && SUB.TIERS[c.tier];
    head(tr('charge.receiptView.subTitle', 'GifOS Meet subscription'), tier ? tier.name : '');
    slip([
      [tr('charge.receiptView.plan', 'Plan'), tier ? tier.name + (c.period ? ' (' + tr('charge.receiptView.period.' + c.period, c.period) + ')' : '') : ''],
      [tr('charge.receiptView.subId', 'Subscription'), c ? c.subId : ''],
      [tr('charge.receiptView.passes', 'Four-hour passes'), w ? String(w.passes.length) : ''],
    ]);
    const lic = c ? await licenseOf(files) : null;
    if (lic) line('seal ok', '✓ ' + tr('charge.receiptView.licenseOk', 'The plan’s license in this file is signed by gifos.app.'), 'rv-seal');
    line('note', tr('charge.receiptView.subNote', 'GifOS Meet and the Plans page find this subscription here in Purchases. Anyone with this file can use your subscription and passes: keep it private.'));
    const links = el('p', 'note');
    const a1 = el('a', null, tr('charge.receiptView.openMeet', 'Open GifOS Meet')); a1.href = '/meet';
    const a2 = el('a', null, tr('charge.receiptView.openPlans', 'Plans')); a2.href = '/subscription';
    links.appendChild(a1); links.appendChild(doc.createTextNode(' · ')); links.appendChild(a2);
    $('rv').appendChild(links);
    doc.documentElement.dataset.receipt = 'subscription';
  }

  async function main() {
    const id = new URLSearchParams(String(root.location.hash || '').slice(1)).get('id');
    const f = id && GifOS.store ? await GifOS.store.getFile(id).catch(() => null) : null;
    if (!f || !f.bytes) return fail(tr('charge.receiptView.missing', 'This receipt is not on this computer.'));
    const bytes = f.bytes instanceof Uint8Array ? f.bytes : new Uint8Array(f.bytes);
    const arc = await GifOS.gif.decode(bytes).catch(() => null);
    const m = arc ? GifOS.gif.readManifest(arc) : null;
    if (!m || m.appId !== RECEIPT_APP_ID) return fail(tr('charge.receiptView.notReceipt', 'This file is not a GifOS receipt.'));
    if (arc.files['receipt.json']) return showPurchase(arc.files, m);
    if (arc.files['subscription.json'] || arc.files['passes.json']) return showSubscription(arc.files);
    return fail(tr('charge.receiptView.notReceipt', 'This file is not a GifOS receipt.'));
  }
  const go = () => { ready.then(main).catch((e) => fail(String((e && e.message) || e))); };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
})(typeof window !== 'undefined' ? window : globalThis);
