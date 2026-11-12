/*
 * gifos-library.js — My library: the page side of cloud recordings.
 *
 * END-TO-END ENCRYPTED. Streamer subscribers save meeting recordings and
 * transcripts to a private library (files.gifos.app), and only they can
 * open them:
 *   - every file gets its own random key; each upload part is sealed with
 *     it (AES-GCM, the part number and count bound in, so parts cannot be
 *     swapped, dropped or reordered);
 *   - the file's details (name, type, size, what it belongs to, and its key)
 *     are sealed with the LIBRARY KEY, derived in this browser from the
 *     subscription file (js/meet-subs.js libraryKey). Whoever holds the
 *     subscription file, or its backup, opens the library on any browser;
 *     nobody else can, not even GifOS;
 *   - the library stores ciphertext, the sealed details and the sealed
 *     sizes (for the storage cap) and nothing else;
 *   - a share link carries the file's key in its #fragment, which browsers
 *     never send to any server; turning the link off ends it for everyone.
 * Every request is also signed by the subscription key (method, path, body
 * hash, nonce) with the subscription license, so nobody else can list,
 * change or replay it.
 *
 * Uploads go in parts. The bytes are first kept in this browser's private
 * storage (OPFS), so an upload interrupted by a reload or a closed tab picks
 * up where it stopped the next time a GifOS page with the library opens.
 * The library refuses an upload that would go past the storage cap before
 * any byte is sent.
 *
 * GifOS.library:
 *   enabled(), status() -> 'streamer' | 'other' | 'none'
 *   list() -> {usage, files, uploads}   files carry the opened details
 *           (name, type, kind, of, plainSize) or locked: true when this
 *           subscription file cannot open them
 *   save(blob, {name, type, kind, of}, onProgress) -> file
 *   resumePending(onProgress), pending()
 *   stream(file, {download}) -> a same-origin URL that plays or saves the
 *           file decrypted on the fly by the service worker (sw.js
 *           libStream): any size, seeking works, memory stays flat
 *   openFile(file, onProgress) -> Blob (whole file in memory: small files,
 *           and browsers without a service worker)   download(file)
 *   rename(file, name)   remove(id)   abort(id)
 *   share(file) -> {share, url}   shareUrl(file, share)   unshare(shareId)
 *   openShare(hash, onProgress) -> {blob, name, type}  (no subscription needed)
 *   streamShare(hash, {download}) -> URL, the same for a share link
 *   sizeText(bytes)
 * Errors are thrown as Error with .code ('full', 'lapsed', 'need-streamer',
 * 'wrong-key', 'share-gone', ...) and a sentence for people.
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});
  const SUB = () => GifOS.sub;
  const SUBS = () => GifOS.meetSubs;
  const TIMINGS = GifOS.timings || (typeof require === 'function' ? require('./timings.js') : {});
  const RETRY_MS = TIMINGS.LIBRARY_RETRY_MS;          // a part that failed on the network is sent again after this
  const TRIES = 5;                                    // tries per request before the upload pauses
  const PENDING_KEY = 'gifos-library-pending';
  const OPFS_DIR = 'gifos-library-pending';
  const PART_BYTES = 8 * 1024 * 1024;                 // the library's stored part size (files Worker PART_BYTES)
  const IV_BYTES = 12, TAG_BYTES = 16;
  const OVERHEAD = IV_BYTES + TAG_BYTES;              // what sealing adds to each part
  const PLAIN_PART = PART_BYTES - OVERHEAD;           // plaintext per part, so every sealed part is exactly PART_BYTES
  const ENC_TYPE = 'application/vnd.gifos.enc';
  const enc = new TextEncoder(), dec = new TextDecoder();
  const META_AD = enc.encode('gifos-library-meta-v1');
  const partAD = (n, parts) => enc.encode('gifos-library-part-v1\x00' + n + '\x00' + parts);

  const store = () => { try { return root.localStorage; } catch (e) { return null; } };
  function base() {
    let b = null;
    try { b = store() && store().getItem('gifos_files'); } catch (e) { b = null; }
    return String(b || root.GIFOS_FILES_URL || 'https://files.gifos.app').replace(/\/$/, '');
  }
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
  const b64u = (u8) => b64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = (s) => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - (s.length % 4)) % 4); return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
  const hex = (buf) => Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const GB = 1e9;
  function sizeText(bytes) {
    const g = bytes / GB;
    if (g >= 10) return Math.round(g) + ' GB';
    if (g >= 1) return (Math.round(g * 10) / 10) + ' GB';
    return Math.max(1, Math.round(bytes / 1e6)) + ' MB';
  }
  function fail(code, message, extra) { const e = new Error(message); e.code = code; if (extra) Object.assign(e, extra); return e; }
  const WRONG_KEY = 'This file cannot be opened with this subscription file.';

  function enabled() { const s = SUBS(); return !!(s && s.enabled && s.enabled()); }
  async function signer() {
    const s = SUBS();
    const sg = s && s.librarySigner ? await s.librarySigner() : null;
    if (!sg) throw fail('need-streamer', 'My library comes with the Streamer plan.');
    return sg;
  }
  async function status() {
    if (!enabled()) return 'none';
    const r = await SUBS().rights().catch(() => null);
    if (r && r.tier === 'streamer' && r.storage) return 'streamer';
    // A plan that ended still reaches its library during the keep window.
    const sg = SUBS().librarySigner ? await SUBS().librarySigner().catch(() => null) : null;
    if (sg && sg.tier === 'streamer') return 'streamer';
    return r && r.subscribed ? 'other' : 'none';
  }

  // ---- sealing ---------------------------------------------------------------
  async function libKey() {
    const sg = await signer();
    if (!sg.libraryKey) throw fail('no-key', 'This browser has no subscription file to open the library with.');
    return sg.libraryKey;
  }
  async function sealMeta(K, o) {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: META_AD }, K, enc.encode(JSON.stringify(o))));
    const out = new Uint8Array(1 + IV_BYTES + ct.length); out[0] = 1; out.set(iv, 1); out.set(ct, 1 + IV_BYTES);
    return b64u(out);
  }
  async function openMeta(K, meta) {
    try {
      const u = unb64u(meta);
      if (u[0] !== 1) throw new Error('version');
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(1, 1 + IV_BYTES), additionalData: META_AD }, K, u.slice(1 + IV_BYTES));
      const o = JSON.parse(dec.decode(pt));
      if (!o || o.v !== 1 || typeof o.k !== 'string') throw new Error('shape');
      return o;
    } catch (e) { throw fail('wrong-key', WRONG_KEY); }
  }
  const fileKey = (raw) => crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  async function sealPart(key, n, parts, bytes) {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: partAD(n, parts) }, key, bytes));
    const out = new Uint8Array(IV_BYTES + ct.length); out.set(iv); out.set(ct, IV_BYTES);
    return out;
  }
  async function openPart(key, n, parts, bytes) {
    try { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES), additionalData: partAD(n, parts) }, key, bytes.slice(IV_BYTES))); } catch (e) { throw fail('wrong-key', WRONG_KEY); }
  }
  const partsFor = (plainSize) => Math.max(1, Math.ceil(plainSize / PLAIN_PART));

  // One signed request. body: null | object (JSON) | Uint8Array (a part).
  async function request(method, path, body) {
    const sg = await signer();
    const bytes = body == null ? new Uint8Array(0) : body instanceof Uint8Array ? body : enc.encode(JSON.stringify(body));
    const at = Math.floor(Date.now() / 1000);
    const nonce = at + '.' + b64u(crypto.getRandomValues(new Uint8Array(16)));
    const bodyHex = hex(await crypto.subtle.digest('SHA-256', bytes));
    const ctx = 'files\x00' + method + '\x00' + path + '\x00' + bodyHex;
    const sig = await sg.sign(SUB().proofMessage(ctx, nonce));
    const headers = { 'X-Gifos-License': b64(enc.encode(JSON.stringify(sg.license))), 'X-Gifos-Nonce': nonce, 'X-Gifos-Sig': sig };
    if (!(body instanceof Uint8Array) && body != null) headers['Content-Type'] = 'application/json';
    const r = await fetch(base() + path, { method, headers, body: method === 'GET' ? undefined : bytes });
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok) throw fail((j && j.error) || 'http-' + r.status, (j && j.message) || ('The library answered ' + r.status + '.'), Object.assign({ status: r.status }, j || {}));
    return j;
  }
  // Network trouble and a busy library are tried again; a refusal is not.
  async function retrying(fn) {
    let last;
    for (let i = 0; i < TRIES; i++) {
      try { return await fn(); } catch (e) {
        last = e;
        const transient = !e.code || e.status >= 500 || e.code === 'rate' || e.code === 'old-sig';
        if (!transient) throw e;
        await sleep(RETRY_MS * (i + 1));
      }
    }
    throw last;
  }

  // ---- what is waiting in this browser ---------------------------------------
  // Entries hold only the upload id, sizes and the SEALED details: no name in clear.
  const readPending = () => { try { return JSON.parse((store() && store().getItem(PENDING_KEY)) || '[]') || []; } catch (e) { return []; } };
  const writePending = (list) => { try { store().setItem(PENDING_KEY, JSON.stringify(list)); } catch (e) { /* storage full or off: no resume after reload */ } };
  async function opfsDir() {
    if (!(root.navigator && navigator.storage && navigator.storage.getDirectory)) return null;
    try { return await (await navigator.storage.getDirectory()).getDirectoryHandle(OPFS_DIR, { create: true }); } catch (e) { return null; }
  }
  async function keepLocal(id, blob) {
    const dir = await opfsDir();
    if (!dir) return false;
    try { const h = await dir.getFileHandle(id, { create: true }); const w = await h.createWritable(); await w.write(blob); await w.close(); return true; } catch (e) { return false; }
  }
  async function readLocal(id) {
    const dir = await opfsDir();
    if (!dir) return null;
    try { return await (await dir.getFileHandle(id)).getFile(); } catch (e) { return null; }
  }
  async function dropLocal(id) {
    writePending(readPending().filter((p) => p.id !== id));
    const dir = await opfsDir();
    if (dir) { try { await dir.removeEntry(id); } catch (e) { /* already gone */ } }
  }

  // Seal and send the parts not yet stored, then complete.
  async function sendParts(up, blob, done, onProgress, key) {
    if (up.partBytes !== PART_BYTES) throw fail('part-size', 'The library uses a different part size; reload GifOS.');
    const have = new Set(done || []);
    let sent = have.size;
    const tell = () => { if (onProgress) { try { onProgress(Math.min(1, sent / up.parts)); } catch (e) { /* the caller's display */ } } };
    tell();
    for (let n = 1; n <= up.parts; n++) {
      if (have.has(n)) continue;
      const plain = new Uint8Array(await blob.slice((n - 1) * PLAIN_PART, Math.min(blob.size, n * PLAIN_PART)).arrayBuffer());
      const sealed = await sealPart(key, n, up.parts, plain);
      await retrying(() => request('PUT', '/v1/uploads/' + up.id + '/' + n, sealed));
      sent++; tell();
    }
    const r = await retrying(() => request('POST', '/v1/uploads/' + up.id + '/complete', {}));
    return r.file;
  }

  async function save(blob, info, onProgress) {
    const K = await libKey();
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const parts = partsFor(blob.size);
    const stored = blob.size + parts * OVERHEAD;
    const meta = await sealMeta(K, { v: 1, n: String(info.name || ''), t: String(info.type || blob.type || '').split(';')[0], s: blob.size, p: parts, k: b64u(raw), kind: info.kind || null, of: info.of || null });
    const up = await retrying(() => request('POST', '/v1/uploads', { type: ENC_TYPE, meta, size: stored }));
    if (up.parts !== parts) throw fail('part-size', 'The library uses a different part size; reload GifOS.');
    const entry = { id: up.id, meta, size: stored, plainSize: blob.size, partBytes: up.partBytes, parts, at: Date.now() };
    if (await keepLocal(up.id, blob)) writePending(readPending().concat([entry]));
    try {
      const f = await sendParts(entry, blob, [], onProgress, await fileKey(raw));
      await dropLocal(up.id);
      return f;
    } catch (e) { e.uploadId = up.id; throw e; }
  }

  // After a reload: finish every upload this browser still holds.
  let resuming = null;
  function resumePending(onProgress) {
    if (resuming) return resuming;
    resuming = (async () => {
      const out = [];
      const K = await libKey().catch(() => null);
      if (!K) return out;
      for (const p of readPending()) {
        const blob = await readLocal(p.id);
        if (!blob) { await dropLocal(p.id); continue; }
        let d; try { d = await openMeta(K, p.meta); } catch (e) { continue; }   // another subscription's upload: leave it
        let st;
        try { st = await retrying(() => request('GET', '/v1/uploads/' + p.id)); } catch (e) {
          if (e.code === 'gone') await dropLocal(p.id);   // the library ended it (idle too long): nothing to resume
          continue;
        }
        try {
          const f = await sendParts(Object.assign({}, p, { partBytes: st.partBytes, parts: st.parts }), blob, st.done, onProgress ? (x) => onProgress(Object.assign({ name: d.n }, p), x) : null, await fileKey(unb64u(d.k)));
          await dropLocal(p.id);
          out.push(f);
        } catch (e) { /* stays pending for the next page */ }
      }
      return out;
    })().finally(() => { resuming = null; });
    return resuming;
  }

  // ---- reading ---------------------------------------------------------------
  const opened = new WeakMap();   // file object -> its opened details (the key stays out of the object)
  async function list() {
    const r = await request('GET', '/v1/library');
    const K = await libKey();
    const open = async (f) => {
      try {
        const d = await openMeta(K, f.meta);
        opened.set(f, d);
        return Object.assign(f, { name: d.n, type: d.t, kind: d.kind, of: d.of, plainSize: d.s, locked: false });
      } catch (e) { return Object.assign(f, { name: null, locked: true }); }
    };
    await Promise.all(r.files.map(open));
    await Promise.all((r.uploads || []).map(open));
    return r;
  }
  async function detailsOf(f) {
    let d = opened.get(f);
    if (!d) { d = await openMeta(await libKey(), f.meta); opened.set(f, d); }
    return d;
  }
  // Fetch sealed bytes part by part (Range) and open them with the file key.
  async function fetchOpen(url, raw, d, onProgress) {
    const key = await fileKey(raw);
    const out = [];
    for (let n = 1; n <= d.p; n++) {
      const from = (n - 1) * PART_BYTES;
      const r = await fetch(url, { headers: { Range: 'bytes=' + from + '-' + (from + PART_BYTES - 1) } });
      if (r.status === 404 || r.status === 410) throw fail('share-gone', (await r.text().catch(() => '')) || 'This link is not there any more.');
      if (!r.ok) throw fail('http-' + r.status, 'The library answered ' + r.status + '.');
      out.push(await openPart(key, n, d.p, new Uint8Array(await r.arrayBuffer())));
      if (onProgress) { try { onProgress(n / d.p); } catch (e) { /* display */ } }
    }
    return new Blob(out, { type: d.t || 'application/octet-stream' });
  }
  async function openFile(f, onProgress) {
    const d = await detailsOf(f);
    const l = await request('POST', '/v1/files/' + encodeURIComponent(f.id) + '/link', {});
    // Only the path is taken from the answer: the bytes come from this page's own library address.
    return fetchOpen(base() + new URL(l.url).pathname, unb64u(d.k), d, onProgress);
  }
  // ---- streaming through the service worker -------------------------------------
  // Whole-file opening holds the file in memory; a phone cannot do that for a
  // multi-GB recording. With the worker, the file key goes to it (same origin,
  // never off this device) and the player or the download reads a decrypted
  // stream that fetches one sealed part at a time.
  async function worker() {
    const sw = root.navigator && navigator.serviceWorker;
    if (!sw) return null;
    try { await sw.ready; } catch (e) { return null; }
    if (!sw.controller) await new Promise((r) => sw.addEventListener('controllerchange', r, { once: true }));
    // A worker from before streaming (an update not applied yet) does not
    // answer the ping; the page then opens small files whole.
    try {
      const r = await fetch('/library-stream/ping', { cache: 'no-store' });
      if (r.headers.get('X-Gifos-Library-Stream') !== '1') return null;
    } catch (e) { return null; }
    return sw.controller;
  }
  async function session(src, raw, d, exp) {
    const w = await worker();
    if (!w) throw fail('no-stream', 'This browser cannot stream from your library here.');
    const sid = b64u(crypto.getRandomValues(new Uint8Array(18)));
    const ch = new MessageChannel();
    const ok = new Promise((res) => { ch.port1.onmessage = (ev) => res(ev.data || {}); });
    w.postMessage({ type: 'gifos-library-stream', sid, src, key: raw, parts: d.p, size: d.s, mime: d.t, name: d.n, partBytes: PART_BYTES, plainPart: PLAIN_PART, exp }, [ch.port2]);
    const a = await ok;
    if (!a.ok) throw fail('no-stream', 'This browser cannot stream from your library here.');
    return { sid, url: '/library-stream/' + sid + '/' + encodeURIComponent(d.n || 'recording') };
  }
  async function stream(f, opts) {
    const d = await detailsOf(f);
    const l = await request('POST', '/v1/files/' + encodeURIComponent(f.id) + '/link', {});
    const s = await session(base() + new URL(l.url).pathname, unb64u(d.k), d, l.exp);
    return Object.assign(s, { url: s.url + (opts && opts.download ? '?dl=1' : '') });
  }
  async function streamShare(hash, opts) {
    const s = parseShare(hash);
    if (!s || !s.k || !(s.p >= 1) || !(s.s >= 0)) throw fail('share-key', 'This link is missing its key. Ask for the whole link.');
    let raw; try { raw = unb64u(s.k); } catch (e) { raw = null; }
    if (!raw || raw.length !== 32) throw fail('share-key', 'This link is missing its key. Ask for the whole link.');
    // Before streaming: the link is still on (a turned-off link answers 404)
    // and its key opens the first part (a wrong key fails here, cleanly).
    const first = await fetch(base() + '/s/' + s.token, { headers: { Range: 'bytes=0-' + (PART_BYTES - 1) } });
    if (first.status === 404 || first.status === 410) throw fail('share-gone', 'This link is not there any more.');
    if (!first.ok) throw fail('http-' + first.status, 'The library answered ' + first.status + '.');
    await openPart(await fileKey(raw), 1, s.p, new Uint8Array(await first.arrayBuffer()));
    const x = await session(base() + '/s/' + s.token, raw, { p: s.p, s: s.s, t: s.t, n: s.n }, 0);
    return Object.assign(x, { url: x.url + (opts && opts.download ? '?dl=1' : '') });
  }
  function endStream(sid) {
    const sw = root.navigator && navigator.serviceWorker;
    if (sw && sw.controller && sid) sw.controller.postMessage({ type: 'gifos-library-stream-end', sid });
  }

  async function download(f, onProgress) {
    const blob = await openFile(f, onProgress);
    const d = await detailsOf(f);
    // The previous download's object URL is let go when the next one starts.
    if (lastUrl) { try { URL.revokeObjectURL(lastUrl); } catch (e) { /* gone */ } }
    const url = lastUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = d.n || 'recording'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }
  let lastUrl = null;
  async function rename(f, name) {
    const d = Object.assign({}, await detailsOf(f), { n: String(name) });
    const r = await request('PATCH', '/v1/files/' + encodeURIComponent(f.id), { meta: await sealMeta(await libKey(), d) });
    opened.delete(f);
    return r;
  }

  // ---- sharing -------------------------------------------------------------------
  // The link: <site>/library#share=<token>&k=<file key>&t=<type>&n=<name>&p=<parts>&s=<plain size>.
  // Everything after # stays in the browser that opens it.
  function linkFor(serverUrl, d) {
    const token = String(serverUrl).split('/s/')[1] || '';
    const site = (root.location && root.location.origin && /^https?:/.test(root.location.origin)) ? root.location.origin : 'https://gifos.app';
    const q = new URLSearchParams({ share: token, k: d.k, t: d.t || '', n: d.n || '', p: String(d.p), s: String(d.s) });
    return site + '/library#' + q.toString();
  }
  async function share(f) {
    const d = await detailsOf(f);
    const r = await request('POST', '/v1/files/' + encodeURIComponent(f.id) + '/share', {});
    return { share: r.share, url: linkFor(r.url, d) };
  }
  // An existing share link again (the list carries each share's server address).
  async function shareUrl(f, s) { return s && s.url ? linkFor(s.url, await detailsOf(f)) : null; }
  function parseShare(hash) {
    const q = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    const token = q.get('share');
    if (!token) return null;
    return { token, k: q.get('k'), t: q.get('t') || '', n: q.get('n') || '', p: Number(q.get('p')), s: q.has('s') ? Number(q.get('s')) : NaN };
  }
  async function openShare(hash, onProgress) {
    const s = parseShare(hash);
    if (!s || !s.k || !(s.p >= 1)) throw fail('share-key', 'This link is missing its key. Ask for the whole link.');
    let raw; try { raw = unb64u(s.k); } catch (e) { raw = null; }
    if (!raw || raw.length !== 32) throw fail('share-key', 'This link is missing its key. Ask for the whole link.');
    const blob = await fetchOpen(base() + '/s/' + s.token, raw, { p: s.p, t: s.t }, onProgress);
    return { blob, name: s.n, type: s.t };
  }

  GifOS.library = {
    enabled, status, base, sizeText, PART_BYTES, ENC_TYPE, OVERHEAD,
    list, save, resumePending,
    pending: () => readPending(),
    openFile, download, rename, share, shareUrl, openShare, parseShare, stream, streamShare, endStream,
    remove: (id) => request('DELETE', '/v1/files/' + encodeURIComponent(id)),
    unshare: (shareId) => request('DELETE', '/v1/shares/' + encodeURIComponent(shareId)),
    abort: async (id) => { const r = await request('DELETE', '/v1/uploads/' + encodeURIComponent(id)); await dropLocal(id); return r; },
    _request: request,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = GifOS.library;
})(typeof window !== 'undefined' ? window : globalThis);
