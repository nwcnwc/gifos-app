// The seller's Base address lives in the signed manifest (pay.baseAddress,
// or the older pay.to). The broker pays that address and no other.
//
//   node test/unit/pay-base-address.js
const path = require('path');
const fs = require('fs');
const vm = require('vm');
globalThis.crypto = require('crypto').webcrypto;

const root = path.join(__dirname, '..', '..');
for (const f of ['gifos-ed.js', 'gifos-gif.js', 'gifos-sign.js', 'gifos-base-net.js', 'gifos-x402.js', 'gifos-charge.js', 'gifos-purse.js', 'gifos-paywallet.js']) {
  require(path.join(root, 'js', f));
}
const { gif, sign, charge } = globalThis.GifOS;

let failures = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + name + (detail ? '  (' + detail + ')' : ''));
  if (!cond) failures++;
}
const refuses = (fn, re) => { try { fn(); return false; } catch (e) { return re ? re.test(String(e && e.message || e)) : true; } };
const hex = (b) => Buffer.from(b).toString('hex');

const AUTHOR = '0x209693Bc6afc0C5328bA36FaF03C514EF312287C';
const THIEF = '0xdeadBEEFdeadBEEFdeadBEEFdeadBEEFdeadBEEF';
const VALID = { status: 'valid', id: 'author.example.com', type: 'domain' };

check('pay.baseAddress is the seller address',
  charge.payeeOf({ pay: { baseAddress: AUTHOR } }).to === AUTHOR);
check('pay.to still works when baseAddress is absent',
  charge.payeeOf({ pay: { to: AUTHOR, chain: 'eip155:84532' } }).to === AUTHOR);
check('matching baseAddress and pay.to are one payee',
  charge.signedPayTo({ pay: { baseAddress: AUTHOR, to: AUTHOR.toLowerCase() } }).toLowerCase() === AUTHOR.toLowerCase());
check('an invalid baseAddress is refused',
  refuses(() => charge.payeeOf({ pay: { baseAddress: 'not-an-address' } }), /baseAddress is not an address/));
check('a mismatched baseAddress and pay.to is refused',
  refuses(() => charge.payeeOf({ pay: { baseAddress: AUTHOR, to: THIEF } }), /does not match/));
check('a claimed address that is not the signed one is refused',
  refuses(() => charge.assertSignedPayTo({ pay: { baseAddress: AUTHOR } }, THIEF), /not the signed manifest address/));
check('a missing claim returns the signed address and does not invent one',
  charge.assertSignedPayTo({ pay: { baseAddress: AUTHOR } }, null).to === AUTHOR);
check('an unsigned app cannot charge, even with a well-formed baseAddress',
  charge.eligibility({ status: 'unsigned' }, { pay: { baseAddress: AUTHOR }, capabilities: { pay: ['x402'] } }).allowed === false);
check('a tampered verdict cannot charge',
  charge.eligibility({ status: 'tampered' }, { pay: { baseAddress: AUTHOR }, capabilities: { pay: ['x402'] } }).allowed === false);
check('a valid app is paid at its signed baseAddress', (() => {
  const e = charge.eligibility(VALID, {
    capabilities: { pay: ['x402'] },
    pay: { baseAddress: AUTHOR, prices: { pro: '2000000' } },
  });
  return e.allowed === true && e.payee.to === AUTHOR && e.payee.chain === 'eip155:84532';
})());

const manifestFor = (addr) => JSON.stringify({
  gifos: '1.0', appId: 'paid-shop', name: 'Paid Shop', entry: 'index.html',
  capabilities: { pay: ['x402'] },
  pay: { baseAddress: addr, chain: 'eip155:84532', prices: { pro: '2000000' } },
});

(async () => {
  const files = { 'manifest.json': manifestFor(AUTHOR), 'index.html': '<h1>buy</h1>' };
  const app = await gif.encode(files);
  const { keyPair, publicKeyB64 } = await sign.generateDomainKey();
  const signedGif = await sign.signDomain(app, 'author.example.com', keyPair, '2026-08-12');
  const pub = sign._b64ToBytes(publicKeyB64);
  const statementFor = async (bytes) => sign.statement('domain', 'author.example.com', hex(await sign.contentHash(bytes)));
  const sigOf = (bytes) => sign._b64ToBytes(sign.readSig(bytes).sig);
  const hashBefore = hex(await sign.contentHash(signedGif));

  const decoded = await gif.decode(signedGif);
  const stolen = Object.assign({}, decoded.files);
  stolen['manifest.json'] = manifestFor(THIEF);
  const tampered = sign.writeSig(await gif.encode(stolen), sign.readSig(signedGif));
  check('editing pay.baseAddress changes the content hash', hex(await sign.contentHash(tampered)) !== hashBefore);
  check('the author signature no longer verifies over the redirected baseAddress',
    (await sign._ed25519Verify(pub, sigOf(tampered), await statementFor(tampered))) === false);

  // ---- the broker pays the signed address, not the request's ----------------
  const created = [];
  function el() {
    const e = {
      id: '', style: {}, children: [], disabled: false, value: '', textContent: '', dataset: {},
      setAttribute() {}, appendChild(c) { this.children.push(c); return c; }, remove() {}, addEventListener() {},
      querySelector(sel) { return (this._ids && this._ids[sel.slice(1)]) || null; },
    };
    Object.defineProperty(e, 'innerHTML', {
      set(html) {
        e._html = html;
        e._ids = {};
        const re = /id="([^"]+)"/g;
        let m;
        while ((m = re.exec(html))) e._ids[m[1]] = { onclick: null, disabled: false, style: {}, textContent: '', value: '', addEventListener() {} };
      },
      get() { return e._html || ''; },
    });
    return e;
  }
  globalThis.document = {
    body: { appendChild() {} },
    createElement: () => { const e = el(); created.push(e); return e; },
    getElementById: (id) => created.find((e) => e.id === id) || null,
  };
  const lsm = new Map();
  globalThis.localStorage = {
    getItem: (k) => (lsm.has(k) ? lsm.get(k) : null),
    setItem: (k, v) => { lsm.set(k, String(v)); },
    removeItem: (k) => { lsm.delete(k); },
    key: (i) => Array.from(lsm.keys())[i],
    get length() { return lsm.size; },
  };
  lsm.set('gifos_pay_worker', 'http://pay.test');
  const signedTds = [];
  let settleBody = null;
  globalThis.__gifosTestProvider = {
    request: async ({ method, params }) => {
      if (method === 'eth_requestAccounts') return ['0x' + 'ab'.repeat(20)];
      if (method === 'eth_chainId') return '0x14a34';
      if (method === 'wallet_switchEthereumChain') return null;
      if (method === 'eth_signTypedData_v4') { signedTds.push(JSON.parse(params[1])); return '0x' + '11'.repeat(65); }
      throw new Error('unexpected ' + method);
    },
  };
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (/\/gifos\.key$/.test(u)) return new Response(publicKeyB64, { status: 200 });
    if (u.indexOf('/rails') !== -1) {
      return new Response(JSON.stringify({ mode: 'test', rails: { x402: { ok: true } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.indexOf('/x402/settle') !== -1) {
      settleBody = JSON.parse(opts.body);
      return new Response('stop-after-payee', { status: 402 });
    }
    return new Response('unexpected ' + u, { status: 404 });
  };
  const brokerSrc = fs.readFileSync(path.join(root, 'js', 'gifos-pay-broker.js'), 'utf8')
    .replace('const USDC_ENABLED = false;', 'const USDC_ENABLED = true;');
  vm.runInThisContext(brokerSrc, { filename: 'gifos-pay-broker.js' });
  const broker = globalThis.GifOS.payBroker;

  const manifest = JSON.parse(manifestFor(AUTHOR));
  const mismatch = await broker.charge(manifest, signedGif, {
    amount: '2000000', reason: 'Unlock', sku: 'pro', payTo: THIEF,
  }, 'Paid Shop').then(() => null, (e) => e);
  check('the broker refuses a request payTo that is not the signed baseAddress',
    mismatch && /not the signed manifest address/.test(String(mismatch.message)) && signedTds.length === 0,
    mismatch && mismatch.message);

  created.length = 0;
  const paid = broker.charge(manifest, signedGif, { amount: '2000000', reason: 'Unlock', sku: 'pro' }, 'Paid Shop');
  let box = null;
  for (let i = 0; i < 50 && !box; i++) {
    await new Promise((r) => setTimeout(r, 10));
    box = created.find((e) => e._ids && e._ids['gp-x402']) || null;
  }
  check('the sheet opened for the signed app', !!box);
  if (box) box._ids['gp-x402'].onclick();
  const err = await paid.then(() => null, (e) => e);
  check('settlement was reached only after the wallet was given the signed payee',
    !!settleBody && settleBody.transfers[0].to === AUTHOR && signedTds[0].message.to === AUTHOR
    && signedTds[1].message.to === '0x1111111111111111111111111111111111111111',
    JSON.stringify(settleBody && settleBody.transfers));
  check('the 97/3 split is 1940000 to the seller and 60000 to the fee address',
    !!settleBody && settleBody.transfers[0].amount === '1940000' && settleBody.transfers[1].amount === '60000');
  check('a settle refusal after signing is an error, not an unlock', err && /stop-after-payee|settlement failed/.test(String(err.message)));

  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nall green');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
