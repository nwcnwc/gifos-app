// A paid app on Base Sepolia: the buyer approves, the wallet pays the signed
// seller (97%) and the fee address (3%), and the sku unlocks only when the
// Worker's receipt verifies against /gifos-pay.key AND binds to this payment.
// The pay key here is generated in the test. No real key, no chain, no money.
//
//   node test/unit/pay-unlock.js
const path = require('path');
const fs = require('fs');
const vm = require('vm');
globalThis.crypto = require('crypto').webcrypto;

const savedFlag = process.env.GIFOS_BASE_MAINNET;
delete process.env.GIFOS_BASE_MAINNET;

const root = path.join(__dirname, '..', '..');
delete globalThis.GifOS;
for (const f of ['gifos-ed.js', 'gifos-gif.js', 'gifos-sign.js', 'gifos-base-net.js', 'gifos-x402.js', 'gifos-charge.js', 'gifos-purse.js', 'gifos-paywallet.js']) {
  require(path.join(root, 'js', f));
}
const { gif, sign } = globalThis.GifOS;
const minted = [];
globalThis.GifOS.store = {
  uid: (kind) => kind + '-' + (minted.length + 1),
  putFile: async (f) => { minted.push(f); },
};

let failures = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + name + (detail ? '  (' + detail + ')' : ''));
  if (!cond) failures++;
}

const AUTHOR = '0x209693Bc6afc0C5328bA36FaF03C514EF312287C';
const THIEF = '0xdeadBEEFdeadBEEFdeadBEEFdeadBEEFdeadBEEF';
const FEE = '0x1111111111111111111111111111111111111111';
const USDC = '0x036cbd53842c5426634e7929541ec2318f3dcf7e';
const FROM = '0x' + 'ab'.repeat(20);
const TX = '0x' + 'cd'.repeat(32);

const manifestJson = JSON.stringify({
  gifos: '1.0', appId: 'paid-shop', name: 'Paid Shop', entry: 'index.html',
  capabilities: { pay: ['x402'] },
  pay: { baseAddress: AUTHOR, chain: 'eip155:84532', prices: { pro: '2000000' } },
});

(async () => {
  const brokerPath = path.join(root, 'js', 'gifos-pay-broker.js');
  const brokerFile = fs.readFileSync(brokerPath, 'utf8');
  check('the shipped USDC switch stays off', /const USDC_ENABLED = false;/.test(brokerFile));

  const app = await gif.encode({ 'manifest.json': manifestJson, 'index.html': '<h1>buy</h1>' });
  const author = await sign.generateDomainKey();
  const signedGif = await sign.signDomain(app, 'author.example.com', author.keyPair, '2026-08-12');
  const unsignedGif = app;

  const payKp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const payPub = Buffer.from(await crypto.subtle.exportKey('raw', payKp.publicKey)).toString('base64');
  async function signReceipt(fields) {
    const receiptJson = JSON.stringify(Object.assign({ v: 1, kind: 'gifos-pay-receipt' }, fields));
    const sigBytes = new Uint8Array(await crypto.subtle.sign('Ed25519', payKp.privateKey, new TextEncoder().encode(receiptJson)));
    return { receiptJson, sig: Buffer.from(sigBytes).toString('base64'), sigBytes };
  }

  const created = [];
  function el() {
    const e = {
      id: '', style: {}, children: [], disabled: false, value: '', textContent: '', dataset: {},
      setAttribute() {}, appendChild(c) { this.children.push(c); return c; },
      remove() { this.id = ''; }, addEventListener() {},
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
    body: { appendChild() {}, children: [] },
    head: { appendChild() {} },
    createElement: () => { const e = el(); created.push(e); return e; },
    getElementById: (id) => {
      for (let i = created.length - 1; i >= 0; i--) if (created[i].id === id) return created[i];
      return null;
    },
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

  const seen = [];
  let walletMode = 'eip3009';
  function installWallet() {
    globalThis.__gifosTestProvider = {
      request: async ({ method, params }) => {
        seen.push(method);
        if (method === 'eth_requestAccounts') return [FROM];
        if (method === 'eth_chainId') return '0x14a34';
        if (method === 'wallet_switchEthereumChain') return null;
        if (method === 'eth_accounts') return [FROM];
        if (method === 'wallet_getCapabilities') {
          if (walletMode !== 'eip5792') throw new Error('unexpected wallet_getCapabilities');
          return { '0x14a34': { atomic: { status: 'supported' } } };
        }
        if (method === 'eth_signTypedData_v4') {
          if (walletMode === 'eip5792') throw new Error('EIP-3009 must not run when the wallet can batch');
          return '0x' + '11'.repeat(65);
        }
        if (method === 'wallet_sendCalls') {
          if (walletMode !== 'eip5792') throw new Error('wallet_sendCalls on a wallet that cannot batch');
          return '0xbatch';
        }
        if (method === 'wallet_getCallsStatus') return { status: 200, receipts: [{ transactionHash: TX }] };
        throw new Error('unexpected ' + method);
      },
    };
  }
  installWallet();

  let settlePlan = 'mismatch';
  const settleBodies = [];
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (/https:\/\/author\.example\.com\/gifos\.key$/.test(u)) return new Response(author.publicKeyB64, { status: 200 });
    if (u === '/gifos-pay.key') return new Response(payPub, { status: 200 });
    if (u.indexOf('/rails') !== -1) {
      return new Response(JSON.stringify({ mode: 'test', rails: { x402: { ok: true } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.indexOf('/x402/settle') !== -1) {
      const body = JSON.parse(opts.body);
      settleBodies.push(body);
      const fields = {
        rail: 'x402', appId: 'paid-shop', sku: 'pro', amount: '2000000',
        payee: settlePlan === 'mismatch' ? THIEF : AUTHOR,
        payeeId: 'author.example.com', payeeType: 'domain',
        payer: FROM, tx: TX, at: 1700000000000,
      };
      const signed = await signReceipt(fields);
      let sig = signed.sig;
      if (settlePlan === 'badsig') {
        const bad = Buffer.from(signed.sigBytes);
        bad[0] ^= 0xff;
        sig = bad.toString('base64');
      }
      return new Response(JSON.stringify({ status: 'COMPLETED', receiptJson: signed.receiptJson, sig }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('unexpected ' + u, { status: 404 });
  };

  vm.runInThisContext(brokerFile.replace('const USDC_ENABLED = false;', 'const USDC_ENABLED = true;'), { filename: 'gifos-pay-broker.js' });
  const broker = globalThis.GifOS.payBroker;
  const manifest = JSON.parse(manifestJson);
  const req = { amount: '2000000', reason: 'Unlock the pro tools', sku: 'pro' };

  async function clickPay() {
    let box = null;
    for (let i = 0; i < 50 && !box; i++) {
      await new Promise((r) => setTimeout(r, 10));
      const sheet = globalThis.document.getElementById('gifos-pay-sheet');
      const inner = sheet && sheet.children[0];
      if (inner && inner._ids && inner._ids['gp-x402']) box = inner;
    }
    if (!box) throw new Error('the pay sheet did not open');
    check('the sheet names Base Sepolia', /Base Sepolia/.test(box._html || ''));
    box._ids['gp-x402'].onclick();
  }

  const unsigned = await broker.charge(manifest, unsignedGif, req, 'Paid Shop').then(() => null, (e) => e);
  check('an unsigned app is refused before any wallet or receipt',
    unsigned && /not signed/.test(String(unsigned.message)) && seen.length === 0 && settleBodies.length === 0,
    unsigned && unsigned.message);

  settlePlan = 'mismatch';
  const mismatchP = broker.charge(manifest, signedGif, req, 'Paid Shop');
  await clickPay();
  const mismatch = await mismatchP.then(() => null, (e) => e);
  const first = settleBodies[0];
  check('EIP-3009 settlement pays the signed seller on Sepolia USDC, 97/3',
    !!first && !first.mode && Array.isArray(first.payloads) && first.payloads.length === 2
    && first.transfers[0].to === AUTHOR && first.transfers[0].amount === '1940000'
    && first.transfers[1].to === FEE && first.transfers[1].amount === '60000'
    && first.transfers[0].network === 'eip155:84532' && first.transfers[0].asset === USDC
    && first.transfers[1].asset === USDC
    && seen.filter((m) => m === 'eth_signTypedData_v4').length === 2
    && seen.filter((m) => m === 'wallet_sendCalls').length === 0);
  check('a receipt that pays someone else does not unlock',
    mismatch && /does not match this payment/.test(String(mismatch.message))
    && (await broker.entitled(manifest, 'pro', signedGif)) === false
    && (await broker.license(manifest, 'pro', signedGif)) === null,
    mismatch && mismatch.message);

  walletMode = 'eip5792';
  settlePlan = 'badsig';
  const beforeSigns = seen.filter((m) => m === 'eth_signTypedData_v4').length;
  const badP = broker.charge(manifest, signedGif, req, 'Paid Shop');
  await clickPay();
  const bad = await badP.then(() => null, (e) => e);
  check('a receipt that does not verify against the pay key does not unlock',
    bad && /does not verify/.test(String(bad.message))
    && seen.filter((m) => m === 'wallet_sendCalls').length === 1
    && seen.filter((m) => m === 'eth_signTypedData_v4').length === beforeSigns
    && (await broker.entitled(manifest, 'pro', signedGif)) === false,
    bad && bad.message);
  const batched = settleBodies[1];
  check('the batch payment is one approval and is not also an EIP-3009 settle',
    !!batched && batched.mode === 'eip5792' && batched.batch && batched.batch.id === '0xbatch'
    && batched.payloads == null
    && batched.transfers[0].to === AUTHOR && batched.transfers[0].network === 'eip155:84532');

  settlePlan = 'good';
  const paid = await (async () => {
    const p = broker.charge(manifest, signedGif, req, 'Paid Shop');
    await clickPay();
    return p;
  })();
  check('a matching signed receipt unlocks the sku on Sepolia',
    paid && paid.ok === true && paid.rail === 'x402' && paid.chain === 'eip155:84532'
    && paid.payee === AUTHOR && paid.sku === 'pro' && paid.tx === TX
    && (await broker.entitled(manifest, 'pro', signedGif)) === true
    && (await broker.license(manifest, 'pro', signedGif)) === TX);
  const packed = minted.length === 1 ? await gif.decode(minted[0].bytes) : null;
  const rawReceipt = packed && packed.files['receipt.json'];
  const wrapped = rawReceipt ? JSON.parse(typeof rawReceipt === 'string' ? rawReceipt : new TextDecoder().decode(rawReceipt)) : null;
  const filed = wrapped ? JSON.parse(wrapped.receiptJson) : null;
  const fileOk = wrapped ? await globalThis.GifOS.ed.verify(sign._b64ToBytes(payPub), sign._b64ToBytes(wrapped.sig), new TextEncoder().encode(wrapped.receiptJson)) : false;
  const pending = JSON.parse(lsm.get('gifos_pay_pending') || '[]');
  check('the purchase is saved as a receipt file that verifies against the pay key',
    minted.length === 1 && minted[0].name === 'Receipt — Paid Shop — pro.gif'
    && pending[0] === minted[0].id && fileOk === true
    && filed.payee === AUTHOR && filed.tx === TX && filed.amount === '2000000' && filed.sku === 'pro');
  const again = await broker.charge(manifest, signedGif, req, 'Paid Shop').then(() => null, (e) => e);
  check('the same sku is not charged again',
    again && /already purchased/.test(String(again.message))
    && seen.filter((m) => m === 'wallet_sendCalls').length === 2,
    again && again.message);

  if (savedFlag == null) delete process.env.GIFOS_BASE_MAINNET; else process.env.GIFOS_BASE_MAINNET = savedFlag;
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nall green');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
