/*
 * gifos-base-net.js — the one Base network config.
 *
 * Two networks live here and nowhere else an app can edit:
 *   Base Sepolia (84532) — the default. USDC 0x036CbD53842c5426634e7929541eC2318f3dCF7e.
 *   Base mainnet (8453)  — USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913.
 *
 * Mainnet needs BASE_NETWORK below set to 'mainnet' and a real fee address.
 * In a Node process (tests, tools) it also needs GIFOS_BASE_MAINNET ("1" or
 * "true") in the environment, so a test that loads this file never pays on
 * mainnet by accident. A browser page has no process environment: there the
 * constant is the switch, flipped at the cut deploy (docs/payments.md "The
 * mainnet switch"). A fee address alone never turns it on. A manifest, a query
 * string, localStorage, or an app message cannot select it: active() takes
 * no network argument, and extra arguments are ignored.
 *
 * The fee address is GifOS's treasury (EIP-55 form). The 3% fee leg pays it
 * on every network; on Sepolia that is a test payment to a real address.
 * Mainnet still refuses to run while the fee address is the old
 * placeholder, the zero address, or otherwise unset.
 *
 * GifOS holds no key. This file names chains and a fee address. It does
 * not sign and does not send.
 *
 * Attaches to `GifOS.baseNet`.
 */
(function (root) {
  const GifOS = (root.GifOS = root.GifOS || {});
  if (GifOS.baseNet) return;

  // THE NETWORK SWITCH. 'sepolia' (testnet) until Nathan sets 'mainnet'.
  const BASE_NETWORK = 'sepolia';
  // GifOS's treasury: where the 3% fee leg lands (EIP-55 checksummed).
  const FEE_ADDRESS = '0xBB6Ee87BBFF5F7AB6E8Fb4f38Fe6fE69B500b2d0';
  // The old stand-in. Never a real fee address; mainnet treats it as unset.
  const PLACEHOLDER_FEE = '0x1111111111111111111111111111111111111111';

  const SEPOLIA = Object.freeze({
    id: 'sepolia',
    chainId: 84532,
    caip: 'eip155:84532',
    hex: '0x14a34',
    name: 'Base Sepolia',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    // USDC's EIP-712 domain name on this chain (name() of the contract).
    usdcName: 'USDC',
    rpc: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
  });
  const MAINNET = Object.freeze({
    id: 'mainnet',
    chainId: 8453,
    caip: 'eip155:8453',
    hex: '0x2105',
    name: 'Base',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    // Not 'USDC': mainnet's contract is named "USD Coin", and an EIP-3009
    // signature over the wrong domain name is refused by the contract.
    usdcName: 'USD Coin',
    rpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
  });

  const isAddress = (a) => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);

  // A real fee address is a 20-byte hex address that is not the old
  // placeholder and not the zero address.
  function feeConfigured(addr) {
    if (!isAddress(addr)) return false;
    const x = addr.toLowerCase();
    if (x === PLACEHOLDER_FEE) return false;
    if (x === '0x' + '0'.repeat(40)) return false;
    return true;
  }

  // The environment half of the switch. In Node it is GIFOS_BASE_MAINNET.
  // A page has no process environment, and apps cannot reach one: there the
  // flag is on and BASE_NETWORK alone decides (it ships 'sepolia').
  function mainnetFlag() {
    try {
      if (typeof process === 'undefined' || !process.env) return true;
      const env = process.env.GIFOS_BASE_MAINNET;
      return env === '1' || env === 'true';
    } catch (e) { return false; }
  }

  // Pure: flag + fee (+ the BASE_NETWORK switch) in, network out. A manifest
  // is not an input. Mainnet needs the flag AND BASE_NETWORK === 'mainnet'
  // AND a real fee address; the address alone never selects it.
  function resolve(flagOn, fee, network) {
    if (network === undefined) network = BASE_NETWORK;
    if (!flagOn || network !== 'mainnet') return SEPOLIA;
    if (!feeConfigured(fee)) {
      throw new Error('baseNet: mainnet refuses to run while the GifOS fee address is unset');
    }
    return MAINNET;
  }

  // What this process will pay on. Arguments are ignored so a caller cannot
  // pass a manifest and have it stick.
  function active() {
    return resolve(mainnetFlag(), FEE_ADDRESS);
  }

  // The x402 allow-list for the active network. One chain, one USDC.
  function policy() {
    const net = active();
    const usdc = net.usdc.toLowerCase();
    return {
      schemes: ['exact'],
      networks: [net.caip],
      assets: { [net.caip]: [usdc] },
      chainName: net.name,
    };
  }

  GifOS.baseNet = {
    FEE_ADDRESS, PLACEHOLDER_FEE, BASE_NETWORK,
    SEPOLIA, MAINNET,
    feeConfigured, mainnetFlag, resolve, active, policy,
  };
})(typeof window !== 'undefined' ? window : globalThis);
