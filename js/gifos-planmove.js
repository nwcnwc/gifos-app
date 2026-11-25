/*
 * gifos-planmove.js — move a GifOS plan to another device, or restore it with PayPal.
 *
 * Crypto is WebCrypto only (crypto.subtle), so the same helpers run in the
 * page and in Node. The mailbox holds ciphertext. The link and the code image are the channel
 * and the key; the person still types a 6-digit code that only the other device can show.
 */
(function (root) {
  'use strict';
  var GifOS = root.GifOS = root.GifOS || {};
  var LIFE_MS = (GifOS.timings || require('./timings.js')).MOVE_PAGE_LIFE_MS;   // timings.json (the mailbox's life; required where there is no page)

  function cryptoObj() { return root.crypto; }
  function subtle() { return cryptoObj().subtle; }
  function utf8(s) { return new TextEncoder().encode(String(s)); }
  function text(u8) { return new TextDecoder().decode(u8); }

  function b64(u8) {
    var s = '';
    for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
  }
  function fromB64(s) {
    var bin = atob(String(s));
    var u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function b64u(u8) { return b64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function fromB64u(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return fromB64(s);
  }
  function hex(u8) {
    var s = '';
    for (var i = 0; i < u8.length; i++) s += (u8[i] < 16 ? '0' : '') + u8[i].toString(16);
    return s;
  }
  function concat(parts) {
    var n = 0, i;
    for (i = 0; i < parts.length; i++) n += parts[i].length;
    var o = new Uint8Array(n), p = 0;
    for (i = 0; i < parts.length; i++) { o.set(parts[i], p); p += parts[i].length; }
    return o;
  }
  function payBase() { return String(root.GIFOS_PAY_URL || 'https://pay.gifos.app').replace(/\/$/, ''); }

  async function sha256(bytes) { return new Uint8Array(await subtle().digest('SHA-256', bytes)); }

  async function boxId(chan) {
    var h = await sha256(concat([utf8('gifos-move-box'), chan]));
    return hex(h).slice(0, 32);
  }

  async function hkdf(ikm, salt, info) {
    var key = await subtle().importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    var bits = await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: info }, key, 256);
    return new Uint8Array(bits);
  }
  async function aesKey(raw) { return subtle().importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']); }
  async function gcmSeal(keyRaw, iv, data, aad) {
    var k = await aesKey(keyRaw);
    return new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: iv, additionalData: aad }, k, data));
  }
  async function gcmOpen(keyRaw, iv, data, aad) {
    var k = await aesKey(keyRaw);
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: iv, additionalData: aad }, k, data));
  }

  async function ecdh() {
    var pair = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    var pub = new Uint8Array(await subtle().exportKey('raw', pair.publicKey));
    return { publicKey: pair.publicKey, privateKey: pair.privateKey, pub: pub };
  }
  async function ecdhSecret(priv, peerPub) {
    var peer = await subtle().importKey('raw', peerPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    return new Uint8Array(await subtle().deriveBits({ name: 'ECDH', public: peer }, priv, 256));
  }

  function codeDigits(raw) {
    var n = ((raw[0] << 24) | (raw[1] << 16) | (raw[2] << 8) | raw[3]) >>> 0;
    var d = String(n % 1000000);
    while (d.length < 6) d = '0' + d;
    return d;
  }
  async function codeOf(K, chan, eBpub) {
    var raw = await hkdf(K, chan, concat([utf8('gifos-move-code-v1'), eBpub]));
    return codeDigits(raw);
  }

  async function sealHello(K, chan, box, eBpub) {
    var kH = await hkdf(K, chan, utf8('gifos-move-hello-v1'));
    var iv = cryptoObj().getRandomValues(new Uint8Array(12));
    var ct = await gcmSeal(kH, iv, eBpub, utf8(box + '|hello|v1'));
    return b64(concat([iv, ct]));
  }
  async function openHello(K, chan, box, ctB64) {
    var raw = fromB64(ctB64);
    var kH = await hkdf(K, chan, utf8('gifos-move-hello-v1'));
    return gcmOpen(kH, raw.slice(0, 12), raw.slice(12), utf8(box + '|hello|v1'));
  }

  async function sealPkg(K, chan, box, eBpub, obj) {
    var eA = await ecdh();
    var S = await ecdhSecret(eA.privateKey, eBpub);
    var kP = await hkdf(concat([S, K]), chan, utf8('gifos-move-pkg-v1'));
    var iv = cryptoObj().getRandomValues(new Uint8Array(12));
    var pt = utf8(JSON.stringify(obj));
    var ct = await gcmSeal(kP, iv, pt, utf8(box + '|pkg|v1'));
    return b64(concat([eA.pub, iv, ct]));
  }
  async function openPkg(K, chan, box, eBpriv, ctB64) {
    var raw = fromB64(ctB64);
    var eApub = raw.slice(0, 65);
    var iv = raw.slice(65, 77);
    var ct = raw.slice(77);
    var S = await ecdhSecret(eBpriv, eApub);
    var kP = await hkdf(concat([S, K]), chan, utf8('gifos-move-pkg-v1'));
    var pt = await gcmOpen(kP, iv, ct, utf8(box + '|pkg|v1'));
    return JSON.parse(text(pt));
  }

  function link(origin, chan, K) {
    return String(origin || '').replace(/\/$/, '') + '/subscription#move=' + b64u(chan) + '.' + b64u(K);
  }
  function parseMove(token) {
    var parts = String(token || '').split('.');
    if (parts.length !== 2) return null;
    var chan, K;
    try { chan = fromB64u(parts[0]); K = fromB64u(parts[1]); } catch (e) { return null; }
    if (chan.length !== 16 || K.length !== 32) return null;
    return { chan: chan, K: K };
  }

  async function post(path, body) {
    var t0 = Date.now();
    var r = await fetch(payBase() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var j = null;
    try { j = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, body: j || {}, ms: Date.now() - t0 };
  }
  function openBox(box) { return post('/gifos/move/open', { box: box }); }
  function put(slot, box, ct) { return post('/gifos/move/put', { box: box, slot: slot, ct: ct }); }
  function closeBox(box) { return post('/gifos/move/close', { box: box }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // Long-poll until the slot arrives, the box is gone, or the 120 s life ends.
  async function getUntil(box, slot, untilMs, alive) {
    while (Date.now() < untilMs && (!alive || alive())) {
      var r = await post('/gifos/move/get', { box: box, slot: slot });
      if (r.body && r.body.ct) return r.body.ct;
      if (r.status === 410) { var used = new Error('used'); used.used = true; throw used; }
      if (r.status === 404) { var gone = new Error('gone'); gone.gone = true; throw gone; }
      if (!r.ok && !(r.body && r.body.wait)) {
        var err = new Error((r.body && r.body.error) || ('move ' + r.status));
        err.status = r.status;
        throw err;
      }
      if (r.ms < 1000) await sleep(250);
    }
    var exp = new Error('expired');
    exp.expired = true;
    throw exp;
  }

  // BOUND RESTORE (review H4): the new key is made BEFORE leaving for PayPal; only SHA-256 of its public key (k) goes out,
  // and the grant that comes back works only for that key. The seed waits in this tab's sessionStorage.
  var RESTORE_SEED = 'gifos-restore-seed';
  async function restoreStartUrl(subId) {
    var k = await freshSeed();
    try { root.sessionStorage.setItem(RESTORE_SEED, k.seedB64); } catch (e) { throw new Error('This browser cannot keep the restore key for a moment (private mode?).'); }
    var hash = b64u(await sha256(fromB64(k.buyerKey)));
    var u = payBase() + '/gifos/sub/restore/start?k=' + hash;
    if (subId) u += '&sub=' + encodeURIComponent(subId);
    return u;
  }
  async function restoreKey() {
    var seedB64 = null;
    try { seedB64 = root.sessionStorage.getItem(RESTORE_SEED); } catch (e) {}
    if (!seedB64) throw new Error('Start the restore again from this tab.');
    var seed = fromB64(seedB64);
    var k = await GifOS.ed.keysFromSeed(seed);
    return { seed: seed, seedB64: seedB64, buyerKey: b64(k.pubRaw), priv: k.priv };
  }
  function decodeGrant(grant) {
    var s = String(grant || '');
    var i = s.indexOf('.');
    if (i < 1) throw new Error('bad grant');
    var json = JSON.parse(text(fromB64u(s.slice(0, i))));
    if (!json || !Array.isArray(json.subs)) throw new Error('bad grant');
    return json;
  }
  async function freshSeed() {
    var seed = new Uint8Array(32);
    cryptoObj().getRandomValues(seed);
    var k = await GifOS.ed.keysFromSeed(seed);
    return { seed: seed, seedB64: b64(seed), buyerKey: b64(k.pubRaw), priv: k.priv };
  }
  async function claim(grant, subId) {
    var g = decodeGrant(grant);
    var k = await restoreKey();
    var at = Math.floor(Date.now() / 1000);
    var msg = GifOS.sub.askMessage('restore:' + g.n, subId, at);
    var sig = b64(await GifOS.ed.sign(k.priv, utf8(msg)));
    var r = await post('/gifos/sub/restore/claim', { grant: grant, subId: subId, buyerKey: k.buyerKey, at: at, sig: sig });
    if (!r.ok) throw new Error((r.body && r.body.error) || ('restore ' + r.status));
    try { root.sessionStorage.removeItem(RESTORE_SEED); } catch (e) {}
    var body = r.body || {};
    return {
      v: 1, kind: GifOS.sub.CRED_KIND, subId: body.subId || subId, tier: body.tier, period: body.period,
      seed: k.seedB64, buyerKey: k.buyerKey, libSeed: k.seedB64,
    };
  }
  async function rekey(cur) {
    if (!cur || !cur.seed || !cur.subId) throw new Error('No subscription on this browser.');
    var nk = await freshSeed();
    var old = await GifOS.ed.keysFromSeed(fromB64(cur.seed));
    var buyerKey = cur.buyerKey || b64(old.pubRaw);
    var at = Math.floor(Date.now() / 1000);
    var msg = GifOS.sub.askMessage('rekey:' + nk.buyerKey, cur.subId, at);
    var sig = b64(await GifOS.ed.sign(old.priv, utf8(msg)));
    var r = await post('/gifos/sub/rekey', { subId: cur.subId, buyerKey: buyerKey, newKey: nk.buyerKey, at: at, sig: sig });
    if (!r.ok) throw new Error((r.body && r.body.error) || ('rekey ' + r.status));
    var body = r.body || {};
    return {
      v: 1, kind: cur.kind || GifOS.sub.CRED_KIND, subId: cur.subId,
      tier: body.tier || cur.tier, period: body.period || cur.period,
      seed: nk.seedB64, buyerKey: nk.buyerKey, libSeed: cur.libSeed || cur.seed,
    };
  }

  var api = {
    LIFE_MS: LIFE_MS, b64: b64, fromB64: fromB64, b64u: b64u, fromB64u: fromB64u,
    boxId: boxId, codeOf: codeOf, ecdh: ecdh, sealHello: sealHello, openHello: openHello, sealPkg: sealPkg, openPkg: openPkg,
    link: link, parseMove: parseMove, payBase: payBase,
    openBox: openBox, put: put, getUntil: getUntil, closeBox: closeBox,
    restoreStartUrl: restoreStartUrl, decodeGrant: decodeGrant, claim: claim, rekey: rekey,
  };
  GifOS.planMove = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
