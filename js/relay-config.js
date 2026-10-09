/*
 * relay-config.js — Where the GifOS relay lives.
 *
 * The relay is a greeter and a door. It hands a newcomer the sealed addresses
 * of the room's greeters, and it carries sealed first-contact signaling so
 * browsers can connect directly, peer-to-peer. It never carries room traffic:
 * app state, media, chat and the App GIF all ride the room's WebRTC mesh.
 *
 * Production relay: deployed from relay/ with `wrangler deploy` and mapped to
 * the branded domain below.
 *
 * For local testing you can override without editing this file:
 *   localStorage.setItem('gifos_relay', 'ws://127.0.0.1:8790');
 */
window.GIFOS_RELAY = 'wss://relay.gifos.app';
