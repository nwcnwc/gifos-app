// One approval for the 97/3 split when the wallet can batch (EIP-5792
// wallet_sendCalls). Otherwise the EIP-3009 signatures, one per leg.
// A wallet that rejects wallet_getCapabilities is the fallback, not a failure.
//
//   node test/unit/pay-send-calls.js
const path = require('path');
globalThis.crypto = require('crypto').webcrypto;
delete globalThis.GifOS;
require(path.join(__dirname, '..', '..', 'js', 'gifos-base-net.js'));
require(path.join(__dirname, '..', '..', 'js', 'gifos-paywallet.js'));
const W = globalThis.GifOS.payWallet;

let failures = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + name + (detail ? '  (' + detail + ')' : ''));
  if (!cond) failures++;
}
const refuses = (fn, re) => { try { fn(); return false; } catch (e) { return re ? re.test(e.message) : true; } };

const SELLER = '0x209693Bc6afc0C5328bA36FaF03C514EF312287C';
const FEE = '0x1111111111111111111111111111111111111111';
const USDC = '0x036cbd53842c5426634e7929541ec2318f3dcf7e';
const FROM = '0x' + 'ab'.repeat(20);
const transfers = [
  { to: SELLER, amount: '1940000', asset: USDC, network: 'eip155:84532' },
  { to: FEE, amount: '60000', asset: USDC, network: 'eip155:84532' },
];

const data = W.encodeUsdcTransfer(SELLER, '1940000');
check('a USDC transfer() call is the a9059cbb selector plus two 32-byte words',
  data.startsWith('0xa9059cbb') && data.length === 2 + 8 + 64 + 64
  && data.slice(10, 74) === SELLER.slice(2).toLowerCase().padStart(64, '0')
  && data.slice(74) === (1940000).toString(16).padStart(64, '0'));
check('capabilities: atomic.status supported on this chain is a batch',
  W.capabilitiesSupportBatch({ '0x14a34': { atomic: { status: 'supported' } } }, '0x14a34') === true);
check('capabilities: atomicBatch.supported is a batch',
  W.capabilitiesSupportBatch({ '0x14a34': { atomicBatch: { supported: true } } }, '0x14a34') === true);
check('capabilities: the same support on mainnet does not batch Sepolia',
  W.capabilitiesSupportBatch({ '0x2105': { atomic: { status: 'ready' } } }, '0x14a34') === false);
check('capabilities: unsupported and empty are not a batch',
  W.capabilitiesSupportBatch({ '0x14a34': { atomic: { status: 'unsupported' } } }, '0x14a34') === false
  && W.capabilitiesSupportBatch(null, '0x14a34') === false);

const params = W.sendCallsParams(transfers, FROM);
check('one wallet_sendCalls request holds both USDC transfers, atomic',
  params.version === '2.0.0' && params.chainId === '0x14a34' && params.atomicRequired === true
  && params.from === FROM && params.calls.length === 2
  && params.calls[0].to === USDC && params.calls[1].to === USDC
  && params.calls[0].data === W.encodeUsdcTransfer(SELLER, '1940000')
  && params.calls[1].data === W.encodeUsdcTransfer(FEE, '60000'));
check('a mainnet leg is refused before any wallet sees it',
  refuses(() => W.sendCallsParams([{ to: SELLER, amount: '1', asset: USDC, network: 'eip155:8453' }], FROM), /Base Sepolia only/));

function provider(methods) {
  const seen = [];
  globalThis.__gifosTestProvider = {
    request: async ({ method, params: p }) => {
      seen.push(method);
      if (methods[method]) return methods[method](p);
      throw new Error('unexpected ' + method);
    },
    seen,
  };
  return globalThis.__gifosTestProvider;
}
const accounts = {
  eth_requestAccounts: async () => [FROM],
  eth_chainId: async () => '0x14a34',
  wallet_switchEthereumChain: async () => null,
};

(async () => {
  const batch = provider(Object.assign({}, accounts, {
    wallet_getCapabilities: async () => ({ '0x14a34': { atomic: { status: 'supported' } } }),
    wallet_sendCalls: async () => '0xbatch',
    wallet_getCallsStatus: async () => ({ status: 200, receipts: [{ transactionHash: '0xtx' }] }),
    eth_signTypedData_v4: async () => { throw new Error('EIP-3009 must not run when the wallet can batch'); },
  }));
  const split = await W.paySplit(transfers);
  check('a batch-capable wallet gets one wallet_sendCalls and no typed-data signatures',
    split.mode === 'eip5792' && split.batchId === '0xbatch'
    && split.status.receipts[0].transactionHash === '0xtx'
    && batch.seen.filter((m) => m === 'wallet_sendCalls').length === 1
    && batch.seen.indexOf('eth_signTypedData_v4') === -1
    && split.calls.length === 2);

  const typed = [];
  provider(Object.assign({}, accounts, {
    wallet_getCapabilities: async () => { throw new Error('method not found'); },
    eth_signTypedData_v4: async (p) => { typed.push(JSON.parse(p[1])); return '0x' + '11'.repeat(65); },
  }));
  const fallback = await W.paySplit(transfers);
  check('a wallet that rejects wallet_getCapabilities falls back to EIP-3009, one signature per leg',
    fallback.mode === 'eip3009' && fallback.payloads.length === 2
    && typed.length === 2
    && typed[0].primaryType === 'TransferWithAuthorization'
    && typed[0].message.to === SELLER && typed[0].message.value === '1940000'
    && typed[1].message.to === FEE && typed[1].message.value === '60000');

  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nall green');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
