/*
 * relay-config.js — Where the GifOS relay lives.
 *
 * The relay does two jobs: WebRTC signaling (introducing browsers so they can
 * connect directly, peer-to-peer) and fallback transport (carrying session
 * traffic when P2P can't be established — strict NATs, corporate firewalls).
 *
 * Production relay: deployed from relay/ with `wrangler deploy` and mapped to
 * the branded domain below.
 *
 * For local testing you can override without editing this file:
 *   localStorage.setItem('gifos_relay', 'ws://127.0.0.1:8790');
 */
window.GIFOS_RELAY = 'wss://relay.gifos.app';

// The relay's ADDRESS-ATTESTATION public keys, as
// { kid: base64 raw Ed25519 public key }, where
// kid is the first 16 hex chars of SHA-256 over the raw key bytes. A meeting
// marks a participant's address "verified by the relay" only when it carries
// a statement signed by one of these keys. Empty: every address shows as
// reported by the participant's own device, exactly as before. A fork
// running its own relay lists its own key here. Keys set before this file
// runs (a local test relay) are kept.
window.GIFOS_RELAY_ATTEST_KEYS = Object.assign({
}, window.GIFOS_RELAY_ATTEST_KEYS || {});
