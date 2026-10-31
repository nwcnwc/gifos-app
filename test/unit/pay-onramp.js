// CDP Onramp v2 headless order: guest Apple Pay, US only, $5 minimum,
// verified email and phone, destination is the user's Base Account.
// No CDP key ships in the repo. The network call is mocked.
//
//   node test/unit/pay-onramp.js
const path = require('path');
globalThis.crypto = require('crypto').webcrypto;

const saved = {
  flag: process.env.GIFOS_BASE_MAINNET,
  url: process.env.GIFOS_ONRAMP_SESSION_URL,
  key: process.env.GIFOS_ONRAMP_CDP_KEY,
};
delete process.env.GIFOS_BASE_MAINNET;
delete process.env.GIFOS_ONRAMP_SESSION_URL;
delete process.env.GIFOS_ONRAMP_CDP_KEY;

const root = path.join(__dirname, '..', '..');
delete globalThis.GifOS;
for (const f of ['gifos-base-net.js', 'gifos-paywallet.js', 'gifos-onramp.js', 'gifos-pay-broker.js']) {
  require(path.join(root, 'js', f));
}
const on = globalThis.GifOS.onramp;

let failures = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + name + (detail ? '  (' + detail + ')' : ''));
  if (!cond) failures++;
}
const refuses = async (fn, re) => {
  try { await fn(); return false; } catch (e) { return re ? re.test(String(e && e.message || e)) : true; }
};

const DEST = '0x209693Bc6afc0C5328bA36FaF03C514EF312287C';
const GOOD = {
  destinationAddress: DEST,
  paymentAmount: '5.00',
  email: 'buyer@example.com',
  phoneNumber: '+12025550123',
  emailVerifiedAt: '2026-04-24T00:00:00Z',
  phoneNumberVerifiedAt: '2026-04-24T00:00:00Z',
  agreementAcceptedAt: '2026-04-24T00:00:00Z',
};

(async () => {
  on.configure({ sessionTokenUrl: null, cdpKey: null });
  let fetches = 0;
  globalThis.fetch = async () => { fetches++; return new Response('no', { status: 500 }); };
  check('with no session URL and no CDP key, no order is sent',
    await refuses(() => on.createOrder(GOOD), /not configured/) && fetches === 0);

  const body = on.buildOrder(GOOD);
  check('the order is guest Apple Pay for USDC, destination is the Base Account, network is Sepolia',
    body.paymentMethod === 'GUEST_CHECKOUT_APPLE_PAY' && body.purchaseCurrency === 'USDC'
    && body.paymentCurrency === 'USD' && body.destinationAddress === DEST
    && body.destinationNetwork === 'base-sepolia' && body.paymentAmount === '5.00' && body.isQuote === false);
  check('under $5 is refused', await refuses(() => on.buildOrder(Object.assign({}, GOOD, { paymentAmount: '4.99' })), /minimum is \$5/));
  check('a non-US phone is refused', await refuses(() => on.buildOrder(Object.assign({}, GOOD, { phoneNumber: '+442075551234' })), /US phone/));
  check('unverified email is refused', await refuses(() => on.buildOrder(Object.assign({}, GOOD, { emailVerifiedAt: '', emailVerificationId: '' })), /email verification/));
  check('unverified phone is refused', await refuses(() => on.buildOrder(Object.assign({}, GOOD, { phoneNumberVerifiedAt: '' })), /phone verification/));
  check('another payment method is refused', await refuses(() => on.buildOrder(Object.assign({}, GOOD, { paymentMethod: 'CARD' })), /guest Apple Pay/));
  check('a destination that is not an address is refused', await refuses(() => on.buildOrder(Object.assign({}, GOOD, { destinationAddress: 'buyer@example.com' })), /not a Base address/));

  process.env.GIFOS_BASE_MAINNET = '1';
  check('mainnet is not ordered while the fee address is unset',
    await refuses(() => on.buildOrder(GOOD), /fee address is unset/));
  delete process.env.GIFOS_BASE_MAINNET;

  const seen = [];
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    seen.push({ url: u, opts });
    if (u === 'http://token.test/session') return new Response(JSON.stringify({ token: 'test-session-token' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (u === on.ORDER_URL) {
      return new Response(JSON.stringify({
        order: { orderId: 'ord-1', destinationAddress: DEST, status: 'ONRAMP_ORDER_STATUS_PENDING' },
        paymentLink: { url: 'https://pay.coinbase.com/v2/api-onramp/apple-pay?sessionToken=fake', paymentLinkType: 'PAYMENT_LINK_TYPE_APPLE_PAY_BUTTON' },
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    if (u === 'https://sepolia.base.org') {
      const req = JSON.parse(opts.body);
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: '0x0f4240' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('unexpected ' + u, { status: 404 });
  };
  on.configure({ sessionTokenUrl: 'http://token.test/session', cdpKey: null });
  const created = await on.createOrder(GOOD);
  const orderCall = seen.find((s) => s.url === on.ORDER_URL);
  check('createOrder posts the v2 order with the session token as the bearer',
    !!orderCall && orderCall.opts.headers.Authorization === 'Bearer test-session-token'
    && JSON.parse(orderCall.opts.body).destinationAddress === DEST);
  check('the result carries the payment link and not the bearer token',
    created.paymentLink.url.indexOf('apple-pay') !== -1 && JSON.stringify(created).indexOf('test-session-token') === -1);

  const bal = await on.readUsdcBalance(DEST);
  const rpc = seen.find((s) => s.url === 'https://sepolia.base.org');
  const rpcBody = JSON.parse(rpc.opts.body);
  check('USDC balance is an eth_call of balanceOf on Sepolia USDC',
    bal === '1000000' && on.formatUsdc(bal) === '1'
    && rpcBody.method === 'eth_call' && rpcBody.params[0].to === globalThis.GifOS.baseNet.SEPOLIA.usdc
    && rpcBody.params[0].data === on.balanceOfData(DEST));

  // The trusted sheet: fill it, submit, the payment link renders, the token does not.
  const createdEls = [];
  function el() {
    const e = {
      id: '', style: {}, children: [], disabled: false, value: '', textContent: '', checked: false, dataset: {},
      setAttribute() {}, appendChild(c) { this.children.push(c); return c; }, remove() { this.id = ''; }, addEventListener() {},
      querySelector(sel) { return (this._ids && this._ids[sel.slice(1)]) || null; },
    };
    Object.defineProperty(e, 'innerHTML', {
      set(html) {
        e._html = html; e._ids = {}; const re = /id="([^"]+)"/g; let m;
        while ((m = re.exec(html))) {
          if (e._ids[m[1]]) continue;
          const c = { onclick: null, style: {}, textContent: '', value: '', checked: false, addEventListener() {} };
          Object.defineProperty(c, 'innerHTML', { set(h) { c._html = h; }, get() { return c._html || ''; } });
          e._ids[m[1]] = c;
        }
      },
      get() { return e._html || ''; },
    });
    return e;
  }
  globalThis.document = {
    body: { appendChild() {}, children: [] },
    head: { appendChild() {} },
    createElement: () => { const e = el(); createdEls.push(e); return e; },
    getElementById: (id) => createdEls.find((e) => e.id === id) || null,
  };
  const sheet = on.showTopUp({ destinationAddress: DEST });
  await new Promise((r) => setTimeout(r, 20));
  const box = sheet.children[0];
  check('the top-up sheet shows the USDC balance', box._ids['go-bal'].textContent === '1 USDC', box._ids['go-bal'].textContent);
  box._ids['go-amt'].value = '5.00';
  box._ids['go-email'].value = GOOD.email;
  box._ids['go-phone'].value = GOOD.phoneNumber;
  box._ids['go-email-at'].value = GOOD.emailVerifiedAt;
  box._ids['go-phone-at'].value = GOOD.phoneNumberVerifiedAt;
  box._ids['go-agree'].checked = true;
  await box._ids['go-buy'].onclick();
  check('the sheet renders the Apple Pay link and does not print the bearer token',
    /apple-pay/.test(box._ids['go-link']._html || '') && (box._html || '').indexOf('test-session-token') === -1
    && JSON.stringify(box._ids).indexOf('test-session-token') === -1);

  // The pay sheet is the trusted sheet. USDC rails get the balance and the
  // top-up. A PayPal-only sheet stays free of both.
  globalThis.__gifosTestProvider = {
    request: async ({ method }) => {
      if (method === 'eth_accounts') return [DEST];
      throw new Error('unexpected ' + method);
    },
  };
  const sheetData = (rails) => ({
    app: 'Shop', reason: 'Unlock', amount: '2000000', payingTo: 'shop.example',
    payingToType: 'domain', mode: 'test', chain: 'Base Sepolia', rails,
  });
  const openPay = (rails) => {
    const p = globalThis.GifOS.payBroker.showSheet(sheetData(rails));
    p.catch(() => {});
    const pays = createdEls.filter((e) => e.id === 'gifos-pay-sheet');
    const pay = pays[pays.length - 1];
    return { p, box: pay && pay.children[0] };
  };
  const paypalOnly = openPay({ paypal: { ok: true } });
  check('a PayPal-only sheet has no USDC top-up',
    paypalOnly.box && !paypalOnly.box._ids['gp-topup']
    && !/USDC|Base Sepolia|test network/.test(paypalOnly.box._html || ''));
  const usdcPay = openPay({ x402: { ok: true, address: DEST } });
  await new Promise((r) => setTimeout(r, 30));
  check('a USDC sheet shows the balance and an Add USDC button',
    usdcPay.box && !!usdcPay.box._ids['gp-topup'] && usdcPay.box._ids['gp-usdc-bal'].textContent === '1 USDC',
    usdcPay.box && usdcPay.box._ids['gp-usdc-bal'] && usdcPay.box._ids['gp-usdc-bal'].textContent);
  await usdcPay.box._ids['gp-topup'].onclick();
  await new Promise((r) => setTimeout(r, 30));
  check('Add USDC opens the top-up sheet', !!globalThis.document.getElementById('gifos-onramp-sheet'));

  if (saved.flag == null) delete process.env.GIFOS_BASE_MAINNET; else process.env.GIFOS_BASE_MAINNET = saved.flag;
  if (saved.url == null) delete process.env.GIFOS_ONRAMP_SESSION_URL; else process.env.GIFOS_ONRAMP_SESSION_URL = saved.url;
  if (saved.key == null) delete process.env.GIFOS_ONRAMP_CDP_KEY; else process.env.GIFOS_ONRAMP_CDP_KEY = saved.key;

  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nall green');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
