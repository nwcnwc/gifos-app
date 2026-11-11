/*
 * gifos-base-net.js — the one Base network config.
 *
 * Two networks live here and nowhere else an app can edit:
 *   Base Sepolia (84532) — the default. USDC 0x036CbD53842c5426634e7929541eC2318f3dCF7e.
 *   Base mainnet (8453)  — USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913.
 *
 * Mainnet is behind GIFOS_BASE_MAINNET, read from the process environment
 * only. It is off unless that variable is "1" or "true". A manifest, a
 * query string, localStorage, or an app message cannot select it: active()
 * takes no network argument, and extra arguments are ignored.
 *
 * The fee address is a config constant. The value shipped here is a
 * placeholder (the same test address the broker already uses on Sepolia).
 * Mainnet refuses to run while the fee address is that placeholder or
 * otherwise unset. Sepolia keeps using the placeholder; it is testnet.
 *
 * GifOS holds no key. This file names chains and a fee address. It does
 * not sign and does not send.
 *
 * Attaches to `GifOS.baseNet`.
 */
(function (root) {
  const GifOS = (root.GifOS = root.GifOS || {});
  if (GifOS.baseNet) return;

  // Placeholder. Not a treasury. Mainnet treats this exact value as unset.
  const FEE_ADDRESS = '0x1111111111111111111111111111111111111111';

  const SEPOLIA = Object.freeze({
    id: 'sepolia',
    chainId: 84532,
    caip: 'eip155:84532',
    hex: '0x14a34',
    name: 'Base Sepolia',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
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
    rpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
  });

  const isAddress = (a) => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);

  // A real fee address is a 20-byte hex address that is not the placeholder
  // and not the zero address. The shipped constant fails this on purpose.
  function feeConfigured(addr) {
    if (!isAddress(addr)) return false;
    const x = addr.toLowerCase();
    if (x === FEE_ADDRESS.toLowerCase()) return false;
    if (x === '0x' + '0'.repeat(40)) return false;
    return true;
  }

  // The only switch. Apps cannot reach process.env, and the browser build
  // has no process, so the flag stays off on the page.
  function mainnetFlag() {
    try {
      const env = typeof process !== 'undefined' && process.env ? process.env.GIFOS_BASE_MAINNET : '';
      return env === '1' || env === 'true';
    } catch (e) { return false; }
  }

  // Pure: flag + fee in, network out. A manifest is not an input.
  function resolve(flagOn, fee) {
    if (!flagOn) return SEPOLIA;
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
    FEE_ADDRESS,
    SEPOLIA, MAINNET,
    feeConfigured, mainnetFlag, resolve, active, policy,
  };
})(typeof window !== 'undefined' ? window : globalThis);
