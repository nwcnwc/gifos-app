// gifos-base-net: one module, Sepolia by default, mainnet behind a flag.
//
// Mainnet is not a manifest field. The fee address shipped in the module is
// a placeholder, and mainnet refuses to run while it stays that way.
//
//   node test/unit/base-net.js
const path = require('path');
const root = path.join(__dirname, '..', '..');

delete globalThis.GifOS;
require(path.join(root, 'js', 'gifos-base-net.js'));
require(path.join(root, 'js', 'gifos-x402.js'));
require(path.join(root, 'js', 'gifos-charge.js'));
require(path.join(root, 'js', 'gifos-paywallet.js'));

const net = globalThis.GifOS.baseNet;
const x = globalThis.GifOS.x402;
const C = globalThis.GifOS.charge;
const W = globalThis.GifOS.payWallet;

let failures = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + ' — ' + name + (detail ? '  (' + detail + ')' : ''));
  if (!cond) failures++;
}
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re ? re.test(e.message) : true; } };

const saved = process.env.GIFOS_BASE_MAINNET;
function flag(v) {
  if (v == null) delete process.env.GIFOS_BASE_MAINNET;
  else process.env.GIFOS_BASE_MAINNET = v;
}
const REAL_FEE = '0x2222222222222222222222222222222222222222';
const manifestMainnet = { pay: { chain: 'eip155:8453', to: REAL_FEE } };

flag(null);
const d = net.active(manifestMainnet);
check('default is Base Sepolia (84532), even if a manifest names mainnet',
  d.chainId === 84532 && d.caip === 'eip155:84532' && d.name === 'Base Sepolia');
check('Sepolia USDC is the pinned test token',
  d.usdc.toLowerCase() === '0x036cbd53842c5426634e7929541ec2318f3dcf7e');
check('mainnet USDC is the canonical Base USDC',
  net.MAINNET.chainId === 8453 && net.MAINNET.caip === 'eip155:8453'
  && net.MAINNET.usdc === '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
check('the fee address is the placeholder constant',
  net.FEE_ADDRESS === '0x1111111111111111111111111111111111111111' && net.feeConfigured(net.FEE_ADDRESS) === false);
check('the flag is off unless GIFOS_BASE_MAINNET is 1 or true',
  net.mainnetFlag() === false);
check('the paying policy lists Sepolia only',
  JSON.stringify(net.policy().networks) === '["eip155:84532"]');

flag('1');
check('mainnet refuses to run while the fee address is the placeholder',
  throws(() => net.active(), /fee address is unset/));
check('a manifest cannot satisfy that refusal',
  throws(() => net.active(manifestMainnet), /fee address is unset/));
check('resolve() pays on mainnet only when the flag is on AND the fee is a real address',
  net.resolve(true, REAL_FEE).chainId === 8453 && net.resolve(true, REAL_FEE).caip === 'eip155:8453');
check('resolve() stays on Sepolia when the flag is off, whatever the fee is',
  net.resolve(false, REAL_FEE).chainId === 84532);
check('the zero address is not a configured fee', net.feeConfigured('0x' + '0'.repeat(40)) === false);
flag('true');
check('GIFOS_BASE_MAINNET=true is the same switch', throws(() => net.active(), /fee address is unset/));
flag('yes');
check('any other flag value stays on Sepolia', net.active().chainId === 84532);

flag(null);
const offer = (over) => Object.assign({
  scheme: 'exact', network: 'eip155:84532', amount: '10000',
  asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
}, over || {});
const required = (accepts) => Buffer.from(JSON.stringify({ x402Version: 2, accepts }), 'utf8').toString('base64');
check('with the module loaded, x402 still refuses a mainnet quote',
  throws(() => x.chooseRequirement(x.parsePaymentRequired(required([offer({ network: 'eip155:8453' })])), { maxAmount: '999999' }), /Base Sepolia only/));
check('with the module loaded, x402 still accepts Sepolia USDC',
  x.chooseRequirement(x.parsePaymentRequired(required([offer()])), { maxAmount: '999999' }).requirement.network === 'eip155:84532');

const FROM = '0xAbCd000000000000000000000000000000000001';
const NONCE = new Uint8Array(32).fill(7);
check('the wallet adapter still refuses to sign a mainnet transfer',
  throws(() => W.buildAuthorization({ to: REAL_FEE, amount: '1', asset: net.MAINNET.usdc, network: 'eip155:8453' }, FROM, NONCE, 1700000000000), /Base Sepolia only/));

check('a manifest chain of mainnet is refused by the charge gate',
  throws(() => C.payeeOf({ pay: { to: REAL_FEE, chain: 'eip155:8453' } }), /Base Sepolia only/));
check('a Sepolia manifest payee is accepted on the default network',
  C.payeeOf({ pay: { to: REAL_FEE, chain: 'eip155:84532' } }).chain === 'eip155:84532');

if (saved == null) delete process.env.GIFOS_BASE_MAINNET;
else process.env.GIFOS_BASE_MAINNET = saved;

console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nall green');
process.exit(failures ? 1 : 0);
