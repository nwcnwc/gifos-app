/*
 * gifos-onramp.js — buy USDC into the user's Base Account.
 *
 * Coinbase CDP Onramp v2, headless Order API:
 *   POST https://api.cdp.coinbase.com/platform/v2/onramp/orders
 * Guest checkout is Apple Pay, funded by a debit card. US phone numbers
 * only. The minimum is $5. Email and phone must already be verified; this
 * file refuses to order without that proof. The destination is the user's
 * Base Account address, on the network gifos-base-net.js already selected
 * (Sepolia unless mainnet is actually running). GifOS holds no key.
 *
 * Credentials are a slot, empty in this build. Configure one later:
 *   configure({ sessionTokenUrl }) — POST that URL, it returns { token }.
 *     The CDP key stays on that server.
 *   configure({ cdpKey }) — a bearer token, for a later deploy. Nothing
 *     here ships a real key, and the token is never copied into the page.
 *
 * The top-up sheet is OS UI (the trusted sheet), and the USDC balance is
 * an eth_call against the active network's USDC, read over its RPC.
 *
 * Attaches to `GifOS.onramp`.
 */
(function (root) {
  const GifOS = (root.GifOS = root.GifOS || {});
  if (GifOS.onramp) return;

  const ORDER_URL = 'https://api.cdp.coinbase.com/platform/v2/onramp/orders';
  const MIN_CENTS = 500n; // $5
  const METHOD = 'GUEST_CHECKOUT_APPLE_PAY';
  const isAddress = (a) => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);

  const cfg = { sessionTokenUrl: null, cdpKey: null };

  function configure(opts) {
    const o = opts || {};
    if (Object.prototype.hasOwnProperty.call(o, 'sessionTokenUrl')) cfg.sessionTokenUrl = o.sessionTokenUrl || null;
    if (Object.prototype.hasOwnProperty.call(o, 'cdpKey')) cfg.cdpKey = o.cdpKey || null;
    return { sessionTokenUrl: !!cfg.sessionTokenUrl, cdpKey: !!cfg.cdpKey };
  }

  function configured() {
    try {
      const env = typeof process !== 'undefined' && process.env ? process.env : {};
      if (!cfg.sessionTokenUrl && env.GIFOS_ONRAMP_SESSION_URL) cfg.sessionTokenUrl = env.GIFOS_ONRAMP_SESSION_URL;
      if (!cfg.cdpKey && env.GIFOS_ONRAMP_CDP_KEY) cfg.cdpKey = env.GIFOS_ONRAMP_CDP_KEY;
    } catch (e) {}
    return !!(cfg.sessionTokenUrl || cfg.cdpKey);
  }

  // Dollar string to cents, as integer text. "5", "5.0" and "5.00" are $5.
  function paymentCents(amount) {
    if (typeof amount !== 'string' || !/^\d+(\.\d{1,2})?$/.test(amount)) {
      throw new Error('onramp: payment amount must be a dollar string (for example "5.00")');
    }
    const parts = amount.split('.');
    return BigInt(parts[0]) * 100n + BigInt((parts[1] || '').padEnd(2, '0'));
  }

  function destinationNetwork() {
    const net = (GifOS.baseNet && typeof GifOS.baseNet.active === 'function') ? GifOS.baseNet.active() : { id: 'sepolia' };
    return net.id === 'mainnet' ? 'base' : 'base-sepolia';
  }

  // The order body. No fetch. Refuses anything the headless API would be
  // wrong to send: under $5, a non-US phone, an unverified email or phone,
  // a destination that is not an address, any payment method but guest
  // Apple Pay (debit).
  function buildOrder(input) {
    const i = input || {};
    const cents = paymentCents(i.paymentAmount);
    if (cents < MIN_CENTS) throw new Error('onramp: the minimum is $5');
    if (!isAddress(i.destinationAddress)) throw new Error('onramp: destination is not a Base address');
    if (typeof i.email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.email)) throw new Error('onramp: email is required');
    if (typeof i.phoneNumber !== 'string' || !/^\+1[2-9]\d{9}$/.test(i.phoneNumber)) throw new Error('onramp: a US phone number is required (+1 and 10 digits)');
    if (!i.phoneNumberVerifiedAt) throw new Error('onramp: phone verification is required');
    if (!i.emailVerifiedAt && !i.emailVerificationId) throw new Error('onramp: email verification is required');
    if (!i.agreementAcceptedAt) throw new Error('onramp: the guest checkout agreement must be accepted');
    const method = i.paymentMethod || METHOD;
    if (method !== METHOD) throw new Error('onramp: payment method must be guest Apple Pay (debit card)');
    const dollars = String(cents / 100n) + '.' + String(cents % 100n).padStart(2, '0');
    const body = {
      destinationAddress: i.destinationAddress,
      destinationNetwork: destinationNetwork(),
      paymentCurrency: 'USD',
      paymentMethod: method,
      purchaseCurrency: 'USDC',
      paymentAmount: dollars,
      email: i.email,
      phoneNumber: i.phoneNumber,
      phoneNumberVerifiedAt: i.phoneNumberVerifiedAt,
      agreementAcceptedAt: i.agreementAcceptedAt,
      isQuote: false,
    };
    if (i.emailVerificationId) body.emailVerificationId = i.emailVerificationId;
    if (i.emailVerifiedAt) body.emailVerifiedAt = i.emailVerifiedAt;
    return body;
  }

  async function bearer() {
    configured();
    if (cfg.sessionTokenUrl) {
      const r = await fetch(cfg.sessionTokenUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      if (!r.ok) throw new Error('onramp session token endpoint refused (HTTP ' + r.status + ')');
      const body = await r.json();
      const token = body && (body.token || body.sessionToken);
      if (typeof token !== 'string' || !token) throw new Error('onramp session token endpoint returned no token');
      return token;
    }
    if (cfg.cdpKey) return cfg.cdpKey;
    throw new Error('onramp is not configured (no session-token endpoint, no CDP key)');
  }

  async function createOrder(input) {
    const body = buildOrder(input);
    const token = await bearer();
    const r = await fetch(ORDER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch (e) {}
    if (!r.ok) throw new Error('onramp order refused (HTTP ' + r.status + ')');
    if (!parsed || !parsed.paymentLink || typeof parsed.paymentLink.url !== 'string') throw new Error('onramp order returned no payment link');
    return { order: parsed.order || null, paymentLink: { url: parsed.paymentLink.url, paymentLinkType: parsed.paymentLink.paymentLinkType || null } };
  }

  // balanceOf(address) on the active network's USDC, via that network's RPC.
  function balanceOfData(holder) {
    return '0x70a08231' + holder.slice(2).toLowerCase().padStart(64, '0');
  }
  async function readUsdcBalance(holder) {
    if (!isAddress(holder)) throw new Error('onramp: balance address is not an address');
    const net = (GifOS.baseNet && typeof GifOS.baseNet.active === 'function') ? GifOS.baseNet.active() : null;
    if (!net) throw new Error('onramp: no Base network is configured');
    const r = await fetch(net.rpc, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: net.usdc, data: balanceOfData(holder) }, 'latest'] }),
    });
    if (!r.ok) throw new Error('onramp: USDC balance read failed (HTTP ' + r.status + ')');
    const body = await r.json();
    if (!body || typeof body.result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(body.result)) throw new Error('onramp: USDC balance read returned no amount');
    return BigInt(body.result).toString();
  }
  function formatUsdc(units) {
    const n = BigInt(units);
    const whole = n / 1000000n;
    const frac = String(n % 1000000n).padStart(6, '0').replace(/0+$/, '');
    return frac ? (whole + '.' + frac) : String(whole);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // The trusted sheet. Not an app frame. Collects the guest-checkout fields
  // and, only after email and phone verification times are filled in, asks
  // createOrder. The payment link renders here; the bearer token does not.
  function showTopUp(opts) {
    const o = opts || {};
    const doc = root.document;
    if (!doc || !doc.body) return Promise.reject(new Error('no display for the top-up sheet'));
    const old = doc.getElementById('gifos-onramp-sheet');
    if (old) old.remove();
    const bg = doc.createElement('div');
    bg.id = 'gifos-onramp-sheet';
    bg.setAttribute('style', 'position:fixed;inset:0;z-index:75;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:1.2rem;');
    const box = doc.createElement('div');
    box.setAttribute('style', 'background:#14141f;color:#e8e8f4;border:1px solid #2a2a3f;border-radius:.8rem;max-width:24rem;width:100%;padding:1.2rem;font:15px/1.55 system-ui,-apple-system,sans-serif;');
    box.innerHTML =
      '<h3 style="margin:0 0 .35rem;font-size:1.05rem">Add USDC</h3>' +
      '<p style="margin:0 0 .8rem;color:#b6b6cf;font-size:.86rem">Apple Pay, debit card, US only. The minimum is $5. Email and phone have to be verified before the order is sent. USDC lands in your Base Account — GifOS never holds it.</p>' +
      '<div style="background:#0e0e17;border:1px solid #23233a;border-radius:.6rem;padding:.7rem .8rem;margin-bottom:.7rem"><span style="color:#9a9ab5">USDC balance</span> <b id="go-bal">…</b></div>' +
      '<label style="display:block;color:#9a9ab5;font-size:.78rem">Amount (USD)<input id="go-amt" value="5.00" style="display:block;width:100%;box-sizing:border-box;margin:.2rem 0 .6rem;background:#14141f;border:1px solid #2a2a3f;border-radius:.4rem;color:#e8e8f4;padding:.4rem .5rem;font:inherit"></label>' +
      '<label style="display:block;color:#9a9ab5;font-size:.78rem">Email<input id="go-email" style="display:block;width:100%;box-sizing:border-box;margin:.2rem 0 .6rem;background:#14141f;border:1px solid #2a2a3f;border-radius:.4rem;color:#e8e8f4;padding:.4rem .5rem;font:inherit"></label>' +
      '<label style="display:block;color:#9a9ab5;font-size:.78rem">US phone<input id="go-phone" placeholder="+1…" style="display:block;width:100%;box-sizing:border-box;margin:.2rem 0 .6rem;background:#14141f;border:1px solid #2a2a3f;border-radius:.4rem;color:#e8e8f4;padding:.4rem .5rem;font:inherit"></label>' +
      '<label style="display:block;color:#9a9ab5;font-size:.78rem">Email verified at<input id="go-email-at" placeholder="ISO time" style="display:block;width:100%;box-sizing:border-box;margin:.2rem 0 .6rem;background:#14141f;border:1px solid #2a2a3f;border-radius:.4rem;color:#e8e8f4;padding:.4rem .5rem;font:inherit"></label>' +
      '<label style="display:block;color:#9a9ab5;font-size:.78rem">Phone verified at<input id="go-phone-at" placeholder="ISO time" style="display:block;width:100%;box-sizing:border-box;margin:.2rem 0 .6rem;background:#14141f;border:1px solid #2a2a3f;border-radius:.4rem;color:#e8e8f4;padding:.4rem .5rem;font:inherit"></label>' +
      '<label style="display:flex;gap:.4rem;align-items:flex-start;color:#b6b6cf;font-size:.82rem;margin-bottom:.7rem"><input id="go-agree" type="checkbox"> I accept Coinbase guest checkout terms.</label>' +
      '<div id="go-link" style="display:none;margin-bottom:.7rem"></div>' +
      '<p id="go-err" style="color:#e07a7a;font-size:.82rem;margin:0 0 .6rem"></p>' +
      '<div style="display:flex;justify-content:flex-end;gap:.5rem"><button id="go-cancel" type="button" style="padding:.5rem 1rem;border-radius:.5rem;border:1px solid #2a2a3f;background:transparent;color:#b6b6cf;cursor:pointer;font:inherit">Close</button><button id="go-buy" type="button" style="padding:.5rem 1rem;border-radius:.5rem;border:none;background:#1652f0;color:#fff;cursor:pointer;font:inherit">Apple Pay — debit</button></div>';
    bg.appendChild(box);
    doc.body.appendChild(bg);
    const q = (id) => box.querySelector('#' + id);
    q('go-cancel').onclick = () => bg.remove();
    const dest = o.destinationAddress || null;
    const showBal = (text) => { const el = q('go-bal'); if (el) el.textContent = text; };
    const holder = dest;
    if (holder) {
      readUsdcBalance(holder).then((u) => showBal(formatUsdc(u) + ' USDC'), () => showBal('unavailable'));
    } else if (GifOS.payWallet && typeof GifOS.payWallet.peekAddress === 'function') {
      GifOS.payWallet.peekAddress().then((addr) => {
        if (!addr) { showBal('connect a wallet'); return null; }
        o.destinationAddress = addr;
        return readUsdcBalance(addr).then((u) => showBal(formatUsdc(u) + ' USDC'));
      }, () => showBal('unavailable'));
    } else showBal('unavailable');
    q('go-buy').onclick = async () => {
      const err = q('go-err');
      err.textContent = '';
      try {
        const address = o.destinationAddress || dest;
        const result = await createOrder({
          destinationAddress: address,
          paymentAmount: String(q('go-amt').value || '').trim(),
          email: String(q('go-email').value || '').trim(),
          phoneNumber: String(q('go-phone').value || '').trim(),
          emailVerifiedAt: String(q('go-email-at').value || '').trim(),
          phoneNumberVerifiedAt: String(q('go-phone-at').value || '').trim(),
          agreementAcceptedAt: q('go-agree').checked ? new Date().toISOString() : '',
        });
        const link = q('go-link');
        link.style.display = 'block';
        link.innerHTML = '<iframe title="Apple Pay" src="' + esc(result.paymentLink.url) + '" style="width:100%;height:4.5rem;border:0;background:#fff;border-radius:.4rem"></iframe>';
      } catch (e) {
        err.textContent = String(e && e.message || e);
      }
    };
    return bg;
  }

  GifOS.onramp = {
    ORDER_URL, METHOD, MIN_CENTS,
    configure, configured, buildOrder, createOrder, readUsdcBalance, formatUsdc, showTopUp, balanceOfData,
  };
})(typeof window !== 'undefined' ? window : globalThis);
