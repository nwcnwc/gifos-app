/*
 * gifos-library.js — My library: the page side of cloud recordings.
 *
 * Streamer subscribers can save meeting recordings and transcripts to a
 * private library (files.gifos.app). Every request is signed by the
 * subscription's own key over the method, the path, a hash of the body and
 * a fresh nonce, together with the subscription license, so nobody else can
 * read, change or replay it.
 *
 * Uploads are sent in parts. The bytes are first kept in this browser's
 * private storage (OPFS), so an upload interrupted by a reload or a closed
 * tab picks up where it stopped the next time a GifOS page with the
 * library opens. The library refuses an upload that would go past the
 * storage cap before any byte is sent.
 *
 * GifOS.library:
 *   enabled()              subscriptions switched on in this browser
 *   status()  -> 'streamer' | 'other' | 'none'   ('other': a plan without storage)
 *   list() -> {usage, files, uploads}
 *   save(blob, {name, type, kind, of}, onProgress(fraction)) -> file
 *   resumePending(onProgress) -> files completed
 *   pending() -> uploads waiting in this browser
 *   link(id) -> {url, exp}   rename(id, name)   remove(id)
 *   share(id) -> {share, url}   unshare(shareId)   abort(id)
 *   sizeText(bytes)
 * Errors are thrown as Error with .code (the library's refusal code, e.g.
 * 'full', 'lapsed', 'need-streamer') and a sentence for people.
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

  const store = () => { try { return root.localStorage; } catch (e) { return null; } };
  function base() {
    let b = null;
    try { b = store() && store().getItem('gifos_files'); } catch (e) { b = null; }
    return String(b || root.GIFOS_FILES_URL || 'https://files.gifos.app').replace(/\/$/, '');
  }
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
  const b64u = (u8) => b64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const hex = (buf) => Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const GB = 1e9;
  function sizeText(bytes) {
    const g = bytes / GB;
    if (g >= 10) return Math.round(g) + ' GB';
    if (g >= 1) return (Math.round(g * 10) / 10) + ' GB';
    return Math.max(1, Math.round(bytes / 1e6)) + ' MB';
  }

  function enabled() { const s = SUBS(); return !!(s && s.enabled && s.enabled()); }
  async function status() {
    if (!enabled()) return 'none';
    const r = await SUBS().rights().catch(() => null);
    if (r && r.tier === 'streamer' && r.storage) return 'streamer';
    // A plan that ended still reaches its library during the keep window.
    const sg = SUBS().librarySigner ? await SUBS().librarySigner().catch(() => null) : null;
    if (sg && sg.tier === 'streamer') return 'streamer';
    return r && r.subscribed ? 'other' : 'none';
  }

  function fail(code, message, extra) { const e = new Error(message); e.code = code; if (extra) Object.assign(e, extra); return e; }

  // One signed request. body: null | object (JSON) | Uint8Array (a part).
  async function request(method, path, body) {
    const s = SUBS();
    const sg = s && s.librarySigner ? await s.librarySigner() : null;
    if (!sg) throw fail('need-streamer', 'My library comes with the Streamer plan.');
    const bytes = body == null ? new Uint8Array(0) : body instanceof Uint8Array ? body : new TextEncoder().encode(JSON.stringify(body));
    const at = Math.floor(Date.now() / 1000);
    const rnd = new Uint8Array(16); crypto.getRandomValues(rnd);
    const nonce = at + '.' + b64u(rnd);
    const bodyHex = hex(await crypto.subtle.digest('SHA-256', bytes));
    const ctx = 'files\x00' + method + '\x00' + path + '\x00' + bodyHex;
    const sig = await sg.sign(SUB().proofMessage(ctx, nonce));
    const headers = {
      'X-Gifos-License': b64(new TextEncoder().encode(JSON.stringify(sg.license))),
      'X-Gifos-Nonce': nonce,
      'X-Gifos-Sig': sig,
    };
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

  // ---- what is waiting in this browser -------------------------------------
  const readPending = () => { try { return JSON.parse((store() && store().getItem(PENDING_KEY)) || '[]') || []; } catch (e) { return []; } };
  const writePending = (list) => { try { store().setItem(PENDING_KEY, JSON.stringify(list)); } catch (e) { /* storage full or off: no resume after reload */ } };
  async function opfsDir() {
    if (!(root.navigator && navigator.storage && navigator.storage.getDirectory)) return null;
    try { return await (await navigator.storage.getDirectory()).getDirectoryHandle(OPFS_DIR, { create: true }); } catch (e) { return null; }
  }
  async function keepLocal(id, blob) {
    const dir = await opfsDir();
    if (!dir) return false;
    try {
      const h = await dir.getFileHandle(id, { create: true });
      const w = await h.createWritable();
      await w.write(blob); await w.close();
      return true;
    } catch (e) { return false; }
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

  // Send the parts not yet stored, then complete.
  async function sendParts(up, blob, done, onProgress) {
    const have = new Set(done || []);
    const partBytes = up.partBytes;
    let sent = have.size;
    const tell = () => { if (onProgress) { try { onProgress(Math.min(1, sent / up.parts)); } catch (e) { /* the caller's display */ } } };
    tell();
    for (let n = 1; n <= up.parts; n++) {
      if (have.has(n)) continue;
      const slice = new Uint8Array(await blob.slice((n - 1) * partBytes, Math.min(blob.size, n * partBytes)).arrayBuffer());
      await retrying(() => request('PUT', '/v1/uploads/' + up.id + '/' + n, slice));
      sent++; tell();
    }
    const r = await retrying(() => request('POST', '/v1/uploads/' + up.id + '/complete', {}));
    return r.file;
  }

  async function save(blob, meta, onProgress) {
    const type = String(meta.type || blob.type || '').split(';')[0];
    const up = await retrying(() => request('POST', '/v1/uploads', { name: meta.name, type, size: blob.size, kind: meta.kind, of: meta.of || undefined }));
    const entry = { id: up.id, name: meta.name, type, size: blob.size, kind: meta.kind || null, of: meta.of || null, partBytes: up.partBytes, parts: up.parts, at: Date.now() };
    if (await keepLocal(up.id, blob)) writePending(readPending().concat([entry]));
    try {
      const f = await sendParts(entry, blob, [], onProgress);
      await dropLocal(up.id);
      return f;
    } catch (e) {
      e.uploadId = up.id;
      throw e;
    }
  }

  // After a reload: finish every upload this browser still holds.
  let resuming = null;
  function resumePending(onProgress) {
    if (resuming) return resuming;
    resuming = (async () => {
      const out = [];
      for (const p of readPending()) {
        const blob = await readLocal(p.id);
        if (!blob) { await dropLocal(p.id); continue; }
        let st;
        try { st = await retrying(() => request('GET', '/v1/uploads/' + p.id)); } catch (e) {
          if (e.code === 'gone') await dropLocal(p.id);   // the library ended it (idle too long): nothing to resume
          continue;
        }
        try {
          const f = await sendParts(Object.assign({}, p, { partBytes: st.partBytes, parts: st.parts }), blob, st.done, onProgress ? (x) => onProgress(p, x) : null);
          await dropLocal(p.id);
          out.push(f);
        } catch (e) { /* stays pending for the next page */ }
      }
      return out;
    })().finally(() => { resuming = null; });
    return resuming;
  }

  const enc = encodeURIComponent;
  GifOS.library = {
    enabled, status, base, sizeText,
    list: () => request('GET', '/v1/library'),
    save, resumePending,
    pending: () => readPending(),
    link: (id) => request('POST', '/v1/files/' + enc(id) + '/link', {}),
    rename: (id, name) => request('PATCH', '/v1/files/' + enc(id), { name }),
    remove: (id) => request('DELETE', '/v1/files/' + enc(id)),
    share: (id) => request('POST', '/v1/files/' + enc(id) + '/share', {}),
    unshare: (shareId) => request('DELETE', '/v1/shares/' + enc(shareId)),
    abort: async (id) => { const r = await request('DELETE', '/v1/uploads/' + enc(id)); await dropLocal(id); return r; },
    _request: request,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = GifOS.library;
})(typeof window !== 'undefined' ? window : globalThis);
