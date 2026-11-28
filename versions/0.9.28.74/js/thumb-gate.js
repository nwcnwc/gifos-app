/*
 * thumb-gate.js: THE VIEWER'S OWN CHECK on a gifos.tv thumbnail, before it is drawn. Copyright (c) 2026 Crowd Concepts, Inc.
 * (docs/safeguard.md "The order": the explicit check runs on the device first (the host before upload, the viewer before
 * display); Cloudflare's CSAM scan at the cache is the second layer.) A host's own verdict is never trusted: an honest
 * viewer covers a dishonest host, like honest receivers cover dishonest senders for video.
 *
 * One module for every page that shows a gifos.tv thumbnail (the Home strip here, the gifos.tv directory, which carries a
 * byte-identical copy: tv/site/js/thumb-gate.js, kept equal by a test).
 *
 *   GifOS.thumbGate.src(hash)            '' until this picture has passed (a blob: address, no second download), else its address.
 *   GifOS.thumbGate.state(hash)          'ok' | 'refused' | '' (not decided yet)
 *   GifOS.thumbGate.load(url, hash)      Promise of the state. Fetches the bytes, checks that they are the picture the hash
 *                                        names, runs GifOS.explicit.checkStill once per hash on this device, and only then
 *                                        makes src(hash) available. Until it says 'ok' the caller shows its placeholder.
 *   GifOS.thumbGate.fill(img, url, hash, done)  img keeps no src (a placeholder) until 'ok'; done(state) after.
 *   GifOS.thumbGate.WORDS                the one note for a refused picture: 'Blurred for safety'
 *   GifOS.thumbGate.busy()               how many pictures are being checked right now
 *   GifOS.thumbGate.stats                { checked, cached, ms:[...] } for timing proofs
 *
 * A picture that cannot be checked (no WebAssembly, model failed, bytes do not match the hash) is NOT drawn.
 * Verdicts are kept per hash in memory and in this browser's localStorage (named with the rule version, so a new line or
 * model re-checks). The model loads only when the first picture needs a check. Nothing is sent anywhere about a result.
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});
  if (GifOS.thumbGate) return;

  const STORE = 'gifos-thumbgate-v1';
  const MAX_KEPT = 400;
  const mem = new Map();        // hash -> 'ok' | 'refused'
  const urls = new Map();       // hash -> blob: address of a picture that passed
  const inflight = new Map();   // hash -> Promise
  const failed = new Set();     // hashes that could not be checked on this page (not remembered for good: the next page tries again)
  const stats = { checked: 0, cached: 0, ms: [] };
  let chain = Promise.resolve();   // one check at a time: a phone holds one

  // The check (js/gifos-explicit.js) sits beside this file and loads only when a picture first needs it.
  const HERE = (function () { try { const s = root.document.currentScript; if (s && s.src) return s.src.replace(/[^/]*$/, ''); } catch (e) {} return '/js/'; })();
  let checkLoad = null;
  function explicitCheck() {
    if (GifOS.explicit) return Promise.resolve(GifOS.explicit);
    if (!checkLoad) {
      checkLoad = new Promise((res, rej) => {
        const s = root.document.createElement('script');
        s.src = HERE + 'gifos-explicit.js';
        s.onload = () => (GifOS.explicit ? res(GifOS.explicit) : rej(new Error('no check')));
        s.onerror = () => rej(new Error('no check'));
        root.document.head.appendChild(s);
      });
      checkLoad.catch(() => { checkLoad = null; });
    }
    return checkLoad;
  }
  // Named here so verdicts can be read before the check loads; a test pins it to GifOS.explicit's MODEL@VERSION.
  const RULE = 'nsfwjs-mnv2@4.4.0-1';
  function version() { return RULE; }
  function readStore() {
    try { const j = JSON.parse(root.localStorage.getItem(STORE) || 'null'); if (j && j.v === version() && j.h && typeof j.h === 'object') return j; } catch (e) {}
    return { v: version(), h: {} };
  }
  function remember(hash, st) {
    mem.set(hash, st);
    try {
      const j = readStore(), keys = Object.keys(j.h);
      if (keys.length >= MAX_KEPT) delete j.h[keys[0]];
      j.h[hash] = st === 'ok' ? 1 : 0;
      root.localStorage.setItem(STORE, JSON.stringify(j));
    } catch (e) {}
  }
  function known(hash) {
    if (mem.has(hash)) return mem.get(hash);
    try { const j = readStore(); if (hash in j.h) { const st = j.h[hash] ? 'ok' : 'refused'; mem.set(hash, st); return st; } } catch (e) {}
    return '';
  }
  function hex(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i++) s += (u[i] < 16 ? '0' : '') + u[i].toString(16); return s; }

  function fetchBytes(url) {
    return root.fetch(url, { credentials: 'omit', mode: 'cors' }).then((r) => {
      if (!r.ok) throw new Error('thumbnail HTTP ' + r.status);
      return r.arrayBuffer();
    });
  }
  // The hash a gifos.tv thumbnail is named by is the first 16 hex of the SHA-256 of its bytes: the bytes shown must be the
  // bytes checked, and the bytes checked must be the picture the cached verdict is about.
  function bytesMatch(hash, buf) {
    return root.crypto.subtle.digest('SHA-256', buf).then((d) => hex(d).slice(0, String(hash).length) === String(hash));
  }
  function decode(buf) {
    const blob = new Blob([buf], { type: 'image/jpeg' });
    if (typeof root.createImageBitmap === 'function') return root.createImageBitmap(blob);
    return new Promise((ok, bad) => { const i = new root.Image(), u = URL.createObjectURL(blob); i.onload = () => { URL.revokeObjectURL(u); ok(i); }; i.onerror = () => { URL.revokeObjectURL(u); bad(new Error('not a picture')); }; i.src = u; });
  }
  function done(hash, st, buf) {
    remember(hash, st);
    if (st === 'ok' && buf) urls.set(hash, URL.createObjectURL(new Blob([buf], { type: 'image/jpeg' })));
    return st;
  }

  function load(url, hash) {
    hash = String(hash || '');
    if (!hash || !/^[0-9a-f]{8,64}$/.test(hash)) return Promise.resolve('refused');
    const k = known(hash);
    if (k === 'refused') { stats.cached++; return Promise.resolve('refused'); }
    if (k === 'ok' && urls.has(hash)) { stats.cached++; return Promise.resolve('ok'); }
    if (inflight.has(hash)) return inflight.get(hash);
    if (failed.has(hash)) return Promise.resolve('refused');
    const p = fetchBytes(url).then((buf) => bytesMatch(hash, buf).then((same) => {
      if (!same) return done(hash, 'refused');                       // not the picture the hash names
      if (k === 'ok') { stats.cached++; return done(hash, 'ok', buf); }   // checked before on this device: no second look
      const t0 = Date.now();
      // cannot check (no WebAssembly, model failed) = not shown, and not remembered
      const run = () => explicitCheck().then((E) => { if (E.unsupported()) throw new Error('cannot check'); return decode(buf).then((bmp) => E.checkStill(bmp)); }).then((r) => {
        stats.checked++; stats.ms.push(Date.now() - t0);
        return done(hash, r.ok ? 'ok' : 'refused', r.ok ? buf : null);
      });
      const next = chain.then(run, run);
      chain = next.catch(() => {});
      return next;
    })).catch(() => { failed.add(hash); return 'refused-unchecked'; }).then((st) => (st === 'refused-unchecked' ? 'refused' : st)).finally(() => { inflight.delete(hash); });
    inflight.set(hash, p);
    return p;
  }
  function fill(img, url, hash, cb) {
    const already = urls.get(hash);
    if (already) { img.src = already; if (cb) cb('ok'); return; }
    load(url, hash).then((st) => {
      if (st === 'ok' && urls.get(hash)) img.src = urls.get(hash);
      if (cb) cb(st);
    });
  }
  GifOS.thumbGate = { load, fill, src: (h) => urls.get(h) || '', state: (h) => known(String(h || '')) , WORDS: 'Blurred for safety', RULE, stats, busy: () => inflight.size };
})(typeof window !== 'undefined' ? window : globalThis);
