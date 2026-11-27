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

  // The slip itself is receipt-plan.js. Money rows are drawn only after the
  // signature verifies; an unverified file still names who sold it.
  async function showPurchase(files) {
    const plan = GifOS.receiptPlan;
    const wrapped = json(files, 'receipt.json') || {};
    let receipt = null;
    try { receipt = await GifOS.payBroker.verifyReceipt(wrapped.receiptJson, wrapped.sig); } catch (e) { receipt = null; }
    if (!receipt) {
      head(tr('charge.receipt.title', 'GifOS Receipt'), '');
      line('seal bad', tr('charge.receiptView.unverified', 'This receipt does not verify against gifos.app’s key. It proves nothing and grants nothing.'), 'rv-seal');
      if (plan && plan.mount) plan.mount($('rv'), plan.rows(files, { tr, money: false }));
      doc.documentElement.dataset.receipt = 'bad';
      return;
    }
    const rows = plan.rows(files, { tr, money: true });
    const item = rows.filter((r) => r.id === 'item')[0];
    head(String(receipt.appId || tr('charge.receipt.title', 'GifOS Receipt')), item ? item.value : '');
    plan.mount($('rv'), rows);
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
    const plan = GifOS.receiptPlan;
    const rows = plan.rows(files, { tr });
    head(tr('charge.receiptView.subTitle', 'GifOS Meet subscription'), '');
    plan.mount($('rv'), rows, { files, tr });
    const c = GifOS.sub && GifOS.sub.credentialOk ? GifOS.sub.credentialOk(json(files, 'subscription.json')) : null;
    const lic = c ? await licenseOf(files) : null;
    if (lic) line('seal ok', '✓ ' + tr('charge.receiptView.licenseOk', 'The plan’s license in this file is signed by gifos.app.'), 'rv-seal');
    plan.foot($('rv'), tr);
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
