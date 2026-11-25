/*
 * receipt-plan.js — one receipt's rows, for every kind of receipt.
 *
 * receipt.html (js/receipt-view.js) and /subscription (js/subscription.js,
 * the #pm-receipt block) both call rows(), so the slip says the same thing
 * in both places. rows() reads the files and nothing else: a row is omitted
 * when the file does not carry that fact. It never invents a price, a date
 * or a grant. The catalog price, when the receipt recorded none, is marked
 * as the list price.
 *
 * askHeld() is the "Which meeting is it in?" button. Nothing here calls the
 * payment service until that function runs.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS || (root.GifOS = {});
  const SELLER_NAME = 'Crowd Concepts, Inc.';
  const SUPPORT = 'support@gifos.app';
  const PAYPAL_ACTIVITY = 'https://www.paypal.com/myaccount/activities';
  const PAYPAL_AUTOPAY = 'https://www.paypal.com/myaccount/autopay/';
  // Short product names. The long catalog line is a sales sentence; the
  // receipt uses the same short name the plans page uses. A name not in
  // this list is shown only when the loaded catalog has subscription.<id>.name.
  const SHORT = {
    room20: 'Room 20', unlimited: 'Unlimited', streamer: 'Streamer', family: 'Family business',
    smallBusiness: 'Small business', business: 'Business', largeBusiness: 'Large business', enterprise: 'Enterprise',
  };

  const text = (v) => (v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v == null ? '' : v));
  function json(files, name) {
    try { return files && files[name] != null ? JSON.parse(text(files[name])) : null; } catch (e) { return null; }
  }
  const fill = (en, p) => String(en == null ? '' : en).replace(/\{(\w+)\}/g, (m, k) => (p && p[k] != null ? p[k] : m));
  function trOf(opts) {
    const custom = opts && opts.tr;
    const I = GifOS.i18n;
    return (key, en, p) => {
      try {
        if (typeof custom === 'function') {
          const s = custom(key, en, p);
          if (s != null && s !== '') return String(s);
        }
      } catch (e) {}
      try { if (I && I.has && I.has(key)) return I.t(key, p); } catch (e) {}
      return fill(en, p);
    };
  }
  function fmtUsd(units) {
    try {
      const n = BigInt(units);
      if (n % 10000n !== 0n) return '$' + (n / 1000000n) + '.' + String(n % 1000000n).padStart(6, '0').replace(/0+$/, '');
      const c = n / 10000n;
      return '$' + (c / 100n) + '.' + String(c % 100n).padStart(2, '0');
    } catch (e) { return ''; }
  }
  function fmtTime(ms) {
    if (!Number.isFinite(ms)) return '';
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '';
    // People read a date in their own language and time zone; with no page (Node tests) the exact UTC form.
    try { if (typeof document !== 'undefined') return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) {}
    return d.toISOString().replace('.000Z', 'Z');
  }
  function b64(u8) { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); }
  function fromB64(s) { return Uint8Array.from(atob(String(s)), (c) => c.charCodeAt(0)); }
  function payBase() { return String(root.GIFOS_PAY_URL || 'https://pay.gifos.app').replace(/\/$/, ''); }

  function knownName(id) {
    if (typeof id !== 'string' || !id) return '';
    const key = 'subscription.' + id + '.name';
    try {
      const I = GifOS.i18n;
      if (I && I.has && I.has(key)) return I.t(key);
    } catch (e) {}
    return Object.prototype.hasOwnProperty.call(SHORT, id) ? SHORT[id] : '';
  }
  function periodWord(period, tr) {
    if (period === 'monthly') return tr('charge.receiptView.period.monthly', 'monthly');
    if (period === 'yearly') return tr('charge.receiptView.period.yearly', 'yearly');
    if (period === 'monthly12') return tr('charge.receiptView.period.monthly12', '12 monthly payments');
    return '';
  }
  // The signed line items, in the words the plans already use. A grant that
  // is absent stays out of the sentence.
  function grantWords(g, tr) {
    const ok = GifOS.sub && GifOS.sub.grantsOk ? GifOS.sub.grantsOk(g) : null;
    if (!ok) return '';
    const bits = [];
    if (ok.roomLimit === null) bits.push(tr('charge.receiptView.grantAny', 'meetings of any size'));
    else if (Number.isInteger(ok.roomLimit)) bits.push(tr('charge.receiptView.grantPeople', 'meetings of up to {n} people', { n: String(ok.roomLimit) }));
    if (ok.meetings === 1) bits.push(tr('charge.receiptView.grantOne', 'one meeting at a time'));
    else if (Number.isInteger(ok.meetings) && ok.meetings > 1) bits.push(tr('charge.receiptView.grantMany', 'up to {n} meetings at once', { n: String(ok.meetings) }));
    if (Number.isInteger(ok.turnVideoLinks) && ok.turnVideoLinks > 0) bits.push(tr('charge.receiptView.grantVideo', 'video through our relay servers'));
    else if (ok.turnVideoLinks === 0) bits.push(tr('charge.receiptView.grantVoice', 'voice through our relay servers'));
    if (ok.captureOpenRoom === true) bits.push(tr('charge.receiptView.grantCapture', 'taking charge of public open-floor meetings'));
    if (ok.storage === true) bits.push(tr('charge.receiptView.grantStorage', 'a library for recordings and transcripts'));
    return bits.join(', ');
  }
  function itemValue(name, period, grants) {
    let s = name || '';
    if (period) s = s ? s + ' (' + period + ')' : period;
    if (grants) s = s ? s + ': ' + grants : grants;
    return s;
  }
  // Catalog price for a plan and a period the file names. Marked later as
  // the list price, because the receipt itself did not record a charge.
  function listUsd(tier, period) {
    const SUB = GifOS.sub;
    if (!SUB || !SUB.TIERS || !tier || !period) return null;
    const item = SUB.TIERS[tier];
    const cents = item && item.cents && item.cents[period];
    if (!Number.isInteger(cents) || typeof SUB.usd !== 'function') return null;
    return SUB.usd(cents);
  }
  // The four-hour window is the timings length, not a product name. The
  // dollar is the catalog's pass amount. A pass with no end has no list price.
  function fourHour(start, end) {
    const len = GifOS.timings && GifOS.timings.PASS_S;
    return Number.isInteger(len) && Number.isInteger(start) && Number.isInteger(end) && end - start === len;
  }
  function passListUsd(start, end) {
    if (!fourHour(start, end)) return null;
    const v = GifOS.sub && GifOS.sub.PASS_VALUE;
    return typeof v === 'string' && v ? '$' + v : null;
  }
  function priceText(display, currency, list, tr) {
    if (!display) return '';
    let s = String(display);
    const cur = currency || 'USD';
    if (s.charAt(0) !== '$' && cur === 'USD') s = '$' + s;
    if (cur && s.indexOf(cur) < 0) s += ' ' + cur;
    if (!list) return s;
    return tr('charge.receiptView.listPrice', '{price} (list price)', { price: s });
  }
  function methodWord(rail, id, tr) {
    const r = String(rail || '');
    const s = String(id || '');
    let key = '';
    if (r === 'paypal' || r === 'paypal-order' || /^I-/.test(s)) key = 'paypal';
    else if (r === 'x402' || r === 'transfer') key = 'usdc';
    else if (r === 'play' || /^G-/.test(s)) key = 'play';
    else if (r === 'appstore' || /^A-/.test(s)) key = 'appstore';
    else return '';
    if (key === 'paypal') return tr('charge.receiptView.method.paypal', 'PayPal');
    if (key === 'usdc') return tr('charge.receiptView.method.usdc', 'USDC on Base');
    if (key === 'play') return tr('charge.receiptView.method.play', 'Google Play');
    if (key === 'appstore') return tr('charge.receiptView.method.appstore', 'App Store');
    return '';
  }
  function chainUrl(hash, network) {
    const B = GifOS.baseNet;
    if (!B || !B.txUrl || !/^0x[0-9a-fA-F]{64}$/.test(String(hash || ''))) return null;
    let net = network || null;
    if (!net && B.active) { try { net = B.active().caip; } catch (e) { net = null; } }
    try { return B.txUrl(net, hash) || null; } catch (e) { return null; }
  }
  function sellerRows(tr, out) {
    out.push({ id: 'seller', label: tr('charge.receiptView.seller', 'Seller'), value: tr('charge.receiptView.sellerName', SELLER_NAME) });
    out.push({ id: 'support', label: tr('charge.receiptView.support', 'Support'), value: SUPPORT, href: 'mailto:' + SUPPORT });
  }
  function leftText(endMs, now, tr) {
    if (!Number.isFinite(endMs) || !Number.isFinite(now)) return '';
    const sec = Math.floor((endMs - now) / 1000);
    if (sec <= 0) return tr('charge.receiptView.ended', 'Ended');
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return tr('charge.receiptView.leftDays', '{d} days {h} hours', { d: String(d), h: String(h) });
    if (h > 0) return tr('charge.receiptView.leftHours', '{h} hours {m} minutes', { h: String(h), m: String(m) });
    return tr('charge.receiptView.leftMinutes', '{m} minutes', { m: String(Math.max(1, m || 1)) });
  }

  function licenseBody(files) {
    const w = json(files, 'license.json');
    if (!w) return null;
    if (typeof w.licenseJson === 'string') { try { return JSON.parse(w.licenseJson); } catch (e) { return null; } }
    return typeof w === 'object' ? w : null;
  }
  function passesOf(files) {
    const w = json(files, 'passes.json');
    const list = w && Array.isArray(w.passes) ? w.passes : [];
    const out = [];
    for (const p of list) {
      if (!p) continue;
      if (typeof p.passJson === 'string') { try { out.push(JSON.parse(p.passJson)); } catch (e) {} }
      else if (typeof p === 'object' && (p.grants || p.start || p.end || p.order)) out.push(p);
    }
    return out;
  }
  function purchaseOf(files) {
    const p = json(files, 'purchase.json');
    return p && typeof p === 'object' && !Array.isArray(p) ? p : null;
  }
  function stateOf(files) {
    const s = json(files, 'state.json');
    return s && typeof s === 'object' ? s : null;
  }
  function pushTime(out, id, label, ms) {
    const v = fmtTime(ms);
    if (v) out.push({ id, label, value: v });
  }

  function purchaseBody(wrap) {
    if (!wrap || typeof wrap !== 'object') return null;
    if (typeof wrap.receiptJson === 'string') { try { return JSON.parse(wrap.receiptJson); } catch (e) { return null; } }
    if (wrap.amount != null || wrap.rail || wrap.tx) return wrap;
    return null;
  }
  // PayPal ids stay text. The only PayPal link on a purchase is the buyer's
  // own activity page, which carries no id. A chain leg links only when
  // txUrl accepts the hash. Same labels as the receipt view always used.
  function purchaseTx(receipt, tr, out) {
    const C = GifOS.charge;
    const B = GifOS.baseNet;
    if (!C || !C.receiptLegs) {
      if (receipt.tx) out.push({ id: 'tx', label: tr('charge.receipt.transaction', 'Transaction'), value: String(receipt.tx) });
      return;
    }
    const got = C.receiptLegs(receipt, B && B.FEE_ADDRESS);
    const net = got.network || (B && B.active ? (() => { try { return B.active().caip; } catch (e) { return null; } })() : null);
    const many = got.legs.filter((l) => l.role === 'tx').length > 1;
    let k = 0;
    for (const l of got.legs) {
      const label = l.role === 'creator' ? tr('charge.receiptView.legCreator', 'Creator ({amount})', { amount: fmtUsd(l.amount) })
        : l.role === 'fee' ? tr('charge.receiptView.legFee', 'GifOS fee ({amount})', { amount: fmtUsd(l.amount) })
        : l.role === 'order' ? tr('charge.receiptView.paypalOrder', 'PayPal order')
        : got.kind === 'paypal' ? tr('charge.receiptView.paypalTx', 'PayPal transaction')
        : many ? tr('charge.receiptView.legTx', 'Transaction {k}', { k: String(++k) }) : tr('charge.receipt.transaction', 'Transaction');
      const href = got.kind === 'chain' ? chainUrl(l.tx, net) : null;
      const row = { id: 'tx', label, value: String(l.tx || '') };
      if (href) row.href = href;
      if (row.value) out.push(row);
    }
    if (got.kind === 'paypal') out.push({ id: 'paypalFind', place: 'note', label: '', value: tr('charge.receiptView.paypalFind', 'Find it in your PayPal activity'), href: PAYPAL_ACTIVITY });
  }
  function purchaseRows(wrap, tr, money) {
    const out = [];
    const receipt = purchaseBody(wrap);
    if (money && receipt) {
      const item = receipt.sku
        ? tr('charge.receipt.purchase', 'Purchase — unlocks {sku}', { sku: String(receipt.sku) })
        : tr('charge.receipt.tip', 'Tip — thank you!');
      if (item) out.push({ id: 'item', label: tr('charge.receiptView.item', 'Item'), value: item });
      const amount = fmtUsd(receipt.amount);
      if (amount) out.push({ id: 'price', label: tr('charge.receipt.amount', 'Amount'), value: priceText(amount, 'USD', false, tr) });
      const method = methodWord(receipt.rail, '', tr);
      if (method) out.push({ id: 'method', label: tr('charge.receiptView.method', 'Payment'), value: method });
      if (receipt.payeeId) out.push({ id: 'to', label: tr('charge.receipt.to', 'To'), value: String(receipt.payeeId) });
      if (Number.isFinite(receipt.at)) pushTime(out, 'bought', tr('charge.receipt.when', 'When'), Number(receipt.at));
      purchaseTx(receipt, tr, out);
    }
    sellerRows(tr, out);
    return out;
  }

  function planRows(files, tr, now) {
    const cred = json(files, 'subscription.json');
    const c = cred && typeof cred === 'object' ? cred : null;
    const passes = passesOf(files);
    if (!c && !passes.length) return [];
    const lic = licenseBody(files);
    const purch = purchaseOf(files);
    const st = stateOf(files);
    const out = [];
    const subGrants = lic && lic.grants ? grantWords(lic.grants, tr) : '';
    if (c) {
      const period = periodWord(c.period, tr);
      const name = knownName(c.tier);
      const item = itemValue(name, period, subGrants);
      if (item) out.push({ id: 'item', label: tr('charge.receiptView.item', 'Item'), value: item });
      if (purch && Number.isFinite(purch.boughtAt)) pushTime(out, 'bought', tr('charge.receiptView.bought', 'Purchased'), Number(purch.boughtAt));
      let expS = null;
      if (lic && Number.isInteger(lic.exp)) expS = lic.exp;
      else if (st && Number.isInteger(st.paidThrough)) expS = st.paidThrough;
      else if (st && Number.isInteger(st.until)) expS = st.until;
      if (expS != null) {
        pushTime(out, 'expires', tr('charge.receiptView.expires', 'Expires'), expS * 1000);
        const left = leftText(expS * 1000, now, tr);
        if (left) out.push({ id: 'left', label: tr('charge.receiptView.left', 'Time left'), value: left });
      }
      let shown = '';
      let listed = false;
      if (purch && typeof purch.price === 'string' && purch.price) shown = priceText(purch.price, purch.currency || 'USD', false, tr);
      else {
        const list = listUsd(c.tier, c.period);
        if (list) { shown = priceText(list, 'USD', true, tr); listed = true; }
      }
      if (shown) out.push({ id: 'price', label: tr('charge.receiptView.price', 'Price'), value: shown, list: listed });
      const method = methodWord(purch && purch.rail, c.subId, tr);
      if (method) out.push({ id: 'method', label: tr('charge.receiptView.method', 'Payment'), value: method });
      if (typeof c.subId === 'string' && c.subId) {
        const row = { id: 'tx', label: tr('charge.receiptView.subId', 'Subscription'), value: c.subId };
        if (/^I-/.test(c.subId)) row.href = PAYPAL_AUTOPAY;
        else {
          const href = chainUrl(c.subId, null);
          if (href) row.href = href;
        }
        out.push(row);
      }
    }
    const subPrice = !!(c && purch && purch.price);
    passes.forEach((o) => {
      const four = fourHour(o.start, o.end);
      const name = four ? tr('charge.receiptView.pass4h', 'Four-hour pass') : (knownName(o.plan) || tr('charge.receiptView.pass', 'Pass'));
      const grants = o.grants ? grantWords(o.grants, tr) : '';
      const item = itemValue(name, '', grants);
      if (item) out.push({ id: 'item', label: tr('charge.receiptView.item', 'Item'), value: item });
      const whenS = Number.isInteger(o.paid) ? o.paid : (Number.isInteger(o.start) ? o.start : null);
      if (whenS != null) pushTime(out, 'bought', tr('charge.receiptView.bought', 'Purchased'), whenS * 1000);
      else if (!c && purch && Number.isFinite(purch.boughtAt)) pushTime(out, 'bought', tr('charge.receiptView.bought', 'Purchased'), Number(purch.boughtAt));
      if (o.end === null) out.push({ id: 'expires', label: tr('charge.receiptView.expires', 'Expires'), value: tr('charge.receiptView.noEnd', 'No end') });
      else if (Number.isInteger(o.end)) {
        pushTime(out, 'expires', tr('charge.receiptView.expires', 'Expires'), o.end * 1000);
        const left = leftText(o.end * 1000, now, tr);
        if (left) out.push({ id: 'left', label: tr('charge.receiptView.left', 'Time left'), value: left });
      }
      let shown = '';
      let listed = false;
      if (!subPrice && purch && typeof purch.price === 'string' && purch.price && (!purch.orderId || purch.orderId === o.order)) {
        shown = priceText(purch.price, purch.currency || 'USD', false, tr);
      } else {
        const list = passListUsd(o.start, o.end);
        if (list) { shown = priceText(list, 'USD', true, tr); listed = true; }
      }
      if (shown) out.push({ id: 'price', label: tr('charge.receiptView.price', 'Price'), value: shown, list: listed });
      const via = o.via === 'paypal-order' ? 'paypal' : (o.via === 'play' || o.via === 'appstore' ? o.via : (c ? '' : (purch && purch.rail)));
      const method = methodWord(via, '', tr);
      if (method) out.push({ id: 'method', label: tr('charge.receiptView.method', 'Payment'), value: method });
      if (typeof o.order === 'string' && o.order) {
        const href = chainUrl(o.order, null);
        const paypal = o.via === 'paypal-order' || via === 'paypal';
        const row = { id: 'tx', label: paypal ? tr('charge.receiptView.paypalOrder', 'PayPal order') : tr('charge.receipt.transaction', 'Transaction'), value: o.order };
        if (href) row.href = href;
        out.push(row);
        // A PayPal order has no public explorer. The id stays text; the link
        // is the buyer's own activity, the same one a purchase receipt uses.
        if (!href && paypal) out.push({ id: 'paypalFind', place: 'note', label: '', value: tr('charge.receiptView.paypalFind', 'Find it in your PayPal activity'), href: PAYPAL_ACTIVITY });
      }
    });
    if (c && typeof c.subId === 'string' && c.subId && typeof c.seed === 'string' && c.seed) {
      out.push({ id: 'held', label: tr('charge.receiptView.meeting', 'Meeting'), value: tr('charge.receiptView.heldAsk', 'Which meeting is it in?'), action: 'ask' });
    }
    if (c && typeof c.subId === 'string' && c.subId) {
      out.push({ id: 'move', label: tr('charge.receiptView.meeting', 'Meeting'), value: tr('charge.receiptView.move', 'Add this plan to another device'), href: '/subscription#move' });
      out.push({ id: 'moveHow', place: 'note', label: '', value: tr('charge.receiptView.moveHow', 'To use it in a meeting on this device, start or join that meeting.') });
    }
    sellerRows(tr, out);
    return out;
  }

  function rows(files, opts) {
    const o = opts || {};
    const tr = trOf(o);
    const now = Number.isFinite(o.now) ? o.now : Date.now();
    const wrap = json(files, 'receipt.json');
    if (wrap && (typeof wrap.receiptJson === 'string' || wrap.amount != null || wrap.rail || wrap.tx)) return purchaseRows(wrap, tr, o.money !== false);
    return planRows(files, tr, now);
  }

  function el(doc, tag, cls, t) {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (t != null) n.textContent = t;
    return n;
  }
  // Draws the slip into host. A held row is a button; the click handler is
  // the only thing that may call askHeld.
  function mount(host, list, hooks) {
    if (!host || !host.ownerDocument) return;
    const doc = host.ownerDocument;
    const slip = el(doc, 'div', 'slip');
    slip.id = host.id === 'rv' ? 'rv-slip' : 'pm-slip';
    const notes = [];
    for (const r of list || []) {
      if (!r || r.value == null || r.value === '') continue;
      if (r.place === 'note') { notes.push(r); continue; }
      const row = el(doc, 'div', 'row');
      row.setAttribute('data-row', r.id);
      row.appendChild(el(doc, 'span', '', r.label || ''));
      const b = el(doc, 'b');
      if (r.action === 'ask') {
        const btn = el(doc, 'button', '', r.value);
        btn.type = 'button';
        btn.addEventListener('click', () => {
          if (btn.disabled) return;
          btn.disabled = true;
          const job = hooks && hooks.onAsk ? hooks.onAsk() : askHeld(hooks && hooks.files, hooks && hooks.tr);
          Promise.resolve(job).then((res) => {
            let out = doc.getElementById('rv-held-out');
            if (!out) { out = el(doc, 'p', 'note'); out.id = 'rv-held-out'; host.appendChild(out); }
            out.hidden = false;
            out.textContent = res && res.text ? res.text : '';
          }, () => { btn.disabled = false; });
        });
        b.appendChild(btn);
      } else if (r.href) {
        const a = el(doc, 'a', r.id === 'tx' ? 'tx-link' : '', r.value);
        a.href = r.href;
        if (/^https?:/.test(r.href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        b.appendChild(a);
      } else b.textContent = r.value;
      row.appendChild(b);
      slip.appendChild(row);
    }
    host.appendChild(slip);
    for (const r of notes) {
      const p = el(doc, 'p', 'note');
      if (r.id === 'paypalFind') p.id = 'rv-paypal';
      if (r.href) {
        const a = el(doc, 'a', '', r.value);
        a.href = r.href;
        if (/^https?:/.test(r.href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        p.appendChild(a);
      } else p.textContent = r.value;
      host.appendChild(p);
    }
  }
  function foot(host, tr) {
    if (!host || !host.ownerDocument) return;
    const say = trOf(typeof tr === 'function' ? { tr } : null);
    const doc = host.ownerDocument;
    const note = el(doc, 'p', 'note', say('charge.receiptView.subNote', 'GifOS Meet and the Plans page find this subscription here in Purchases. Anyone with this file can use your subscription and passes: keep it private.'));
    host.appendChild(note);
    const links = el(doc, 'p', 'note');
    const a1 = el(doc, 'a', '', say('charge.receiptView.openMeet', 'Open GifOS Meet'));
    a1.href = '/meet';
    const a2 = el(doc, 'a', '', say('charge.receiptView.openPlans', 'Plans and your subscription'));
    a2.href = '/subscription';
    links.appendChild(a1);
    links.appendChild(doc.createTextNode(' · '));
    links.appendChild(a2);
    host.appendChild(links);
  }
  function readMem() {
    try {
      const raw = root.localStorage && root.localStorage.getItem('gifos-sub-meetings');
      const m = JSON.parse(raw || '{}');
      return m && typeof m === 'object' ? m : {};
    } catch (e) { return {}; }
  }
  // Signed with the credential seed in the file, not whatever key the
  // browser happens to hold. The body matches meet-subs signed('held').
  async function askHeld(files, tr) {
    const say = trOf(typeof tr === 'function' ? { tr } : null);
    const fail = say('charge.receiptView.heldFail', 'Could not check which meeting it is in.');
    const c = json(files, 'subscription.json');
    if (!c || typeof c.seed !== 'string' || typeof c.subId !== 'string' || !GifOS.ed || !GifOS.ed.keysFromSeed || !GifOS.sub || !GifOS.sub.askMessage) return { text: fail };
    try {
      const k = await GifOS.ed.keysFromSeed(fromB64(c.seed));
      const at = Math.floor(Date.now() / 1000);
      const sig = b64(await GifOS.ed.sign(k.priv, new TextEncoder().encode(GifOS.sub.askMessage('held', c.subId, at))));
      const body = { subId: c.subId, buyerKey: b64(k.pubRaw), at, sig };
      const r = await fetch(payBase() + '/gifos/sub/held', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      let j = null;
      try { j = await r.json(); } catch (e) { j = null; }
      if (!r.ok || !j) return { text: fail };
      const list = Array.isArray(j.meetings) ? j.meetings : [];
      if (!list.length) return { text: say('charge.receiptView.heldNone', 'This plan is not in a meeting right now') };
      const mem = readMem();
      const names = list.map((m) => {
        const tag = m && m.meeting;
        const known = tag && mem[tag] && mem[tag].name;
        return known ? String(known) : say('charge.receiptView.heldOther', 'a meeting on another device');
      });
      return { text: names.join('\n') };
    } catch (e) { return { text: fail }; }
  }

  GifOS.receiptPlan = { rows, mount, foot, askHeld, SELLER_NAME, SUPPORT };
})(typeof window !== 'undefined' ? window : globalThis);
