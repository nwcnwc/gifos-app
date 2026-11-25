/*
 * gifos-assets.js — install-time app assets: DOWNLOAD, VERIFY, CACHE.
 *
 * An app whose payload is genuinely too big to ride inside its GIF — model
 * weights in the tens of MB to gigabytes, typically on a public host like
 * Hugging Face — declares it in the manifest:
 *
 *   "assets": [{ "url": "https://…/model-tq2_0.gguf",
 *                "sha256": "<64-hex of the exact bytes>",
 *                "path": "model.gguf", "bytes": 1200000000 }]
 *
 * Optional pins (`"optional": true`) are NOT fetched at install or on boot.
 * The app asks for them with gifos.assets(path); the OS then downloads that
 * one pin, verifies it, caches it. Same trust as a required pin — the URL
 * and hash are still the author's, the sandbox still never fetches — but a
 * model the user never picks never crosses the wire. Required is the default,
 * so every existing app is unchanged.
 *
 * The OS — always a TRUSTED first-party page (the App Store at install,
 * run.html / the provider mount as a backfill, gifos.assets() on demand),
 * never the sandbox — fetches each pinned URL, verifies the SHA-256, and
 * caches the bytes in the computer's ASSET STORE (IndexedDB `appassets`,
 * Blob-backed so the browser keeps them on disk, keyed by the icon's
 * fileId + path). A later fetch of the same path is THIS PIN only if the
 * stored sha256 still matches the manifest — a store Update keeps the
 * fileId, so a rebuilt file at the same path must replace the first
 * download, not keep serving it. The app reads them back with
 * gifos.assets(path) and never touches the network itself.
 *
 * WHY A STORE, NOT THE GIF. Sealing into the GIF (repack) caps out fast: the
 * payload is base64-inside-JSON, so a fine-at-5-MB engine works but a 1.2 GB
 * model would base64 past the engine's maximum string length before the
 * encoder ever ran. Weights therefore live beside the GIF, not in it — and
 * that matches the distribution story: a shared/exported GIF stays slim, and
 * the receiving computer re-downloads from the SAME manifest pin (the public
 * host is the canonical storage; GifOS holds a verified local cache). For the
 * same reason the cache is excluded from whole-computer backups. A tiny
 * `.assets/<path>` file packed INSIDE a GIF still wins over the cache — an
 * author may hand-seal small fixtures — but nothing writes that path anymore.
 *
 * Why this is safe for network-less apps (including Providers,
 * docs/providers.md): the URL is FIXED in the manifest and the hash pins the
 * exact bytes, so the download can neither carry data out (no app-controlled
 * parameters, and it happens before the app has seen anything) nor bring
 * surprise code in (a byte off and it is refused). It is the author's shipped
 * payload arriving by a second route — same trust as the GIF itself.
 *
 * URL forms: absolute https://…, or origin-relative /… (resolved against the
 * serving origin — what the test harness uses). A pin GifOS keeps its own
 * copy of (MIRROR below) is fetched from models.gifos.app instead, checked
 * against the same hash. `bytes` is UX (progress
 * labels, the store's "+N GB download" copy) — never trusted for anything.
 *
 * Attaches to `GifOS.assets`. Loaded by store.html and run.html.
 */
(function (root) {
  const GifOS = (root.GifOS = root.GifOS || {});
  if (GifOS.assets) return;

  const DIR = '.assets/';
  const MAX_ASSET_BYTES = 2 * 1024 * 1024 * 1024 - 1; // the ArrayBuffer/hashing ceiling

  const normPath = (p) => String(p || '').replace(/^\.?\/+/, '');
  const okHash = (h) => /^[0-9a-f]{64}$/.test(String(h || '').toLowerCase());
  // Reject traversal and absolute paths — an asset name is a bare relative key.
  const okPath = (p) => !!p && p.indexOf('..') < 0 && p[0] !== '/' && p.indexOf('\\') < 0;
  const okUrl = (u) => /^https:\/\/./.test(u) || (/^\/[^/]/.test(u) && u.indexOf('//') !== 0);

  // The validated declaration list. Malformed entries are DROPPED (an app
  // cannot smuggle a fetch through a half-formed row — no hash, no download).
  function list(manifest) {
    const raw = (manifest && manifest.assets) || [];
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const a of raw) {
      if (!a || typeof a !== 'object') continue;
      const url = String(a.url || ''), path = normPath(a.path), sha256 = String(a.sha256 || '').toLowerCase();
      if (!okUrl(url) || !okPath(path) || !okHash(sha256)) continue;
      out.push({
        url, path, sha256,
        bytes: Number(a.bytes) > 0 ? Number(a.bytes) : 0,
        optional: a.optional === true,
      });
    }
    return out;
  }
  const key = (entry) => DIR + normPath(entry.path || entry);

  // A cached row is THIS pin only if the hash stored at download time still
  // matches the manifest. The cache is keyed [fileId, path]; a store Update
  // keeps the fileId, so a rebuilt translation at the same path used to keep
  // serving the first download forever. Size is the stand-in for rows written
  // before sha256 was stored: a different length cannot be the pin.
  function rowMatches(row, pin) {
    if (!row || !row.blob) return false;
    if (!pin || !pin.sha256) return true;
    if (row.sha256) return row.sha256 === pin.sha256;
    if (pin.bytes > 0 && Number(row.bytes) > 0 && Number(row.bytes) !== Number(pin.bytes)) return false;
    return true;
  }

  // What still needs downloading: not hand-sealed inside the GIF's own
  // filesystem, and not already in the asset cache AS THIS PIN. `cache` is
  // the store binding — { has(path, pin), put(path, blob, sha256) } — from
  // assetCache() below; omit it for a session-only context and everything
  // missing re-fetches.
  // opts.requiredOnly — install and boot backfill: skip optional pins. They
  // arrive when gifos.assets(path) asks for that path, not before.
  // opts.optionalOnly — Abilities "Download all": only the extra files, never
  // the install-time pins (those already ran at boot).
  function missing(files, manifest, cache, opts) {
    const requiredOnly = !!(opts && opts.requiredOnly);
    const optionalOnly = !!(opts && opts.optionalOnly);
    const need = list(manifest).filter((a) => {
      if (requiredOnly && a.optional) return false;
      if (optionalOnly && !a.optional) return false;
      return !(files && files[key(a)]);
    });
    if (!cache) return Promise.resolve(need);
    return Promise.all(need.map((a) => cache.has(a.path, a))).then((have) => need.filter((_, i) => !have[i]));
  }

  function resolveUrl(url) {
    if (/^https:\/\//.test(url)) return url;
    const origin = (root.location && root.location.origin) || '';
    return origin + url;
  }

  // FIRST-PARTY COPIES. Some public model files are served by GifOS itself,
  // from models.gifos.app (an R2 bucket behind the gifos.app edge cache), so
  // a page that uses them never contacts an outside site. Keyed by the pin's
  // sha256: the app's manifest (signed, already on people's computers) keeps
  // its URL and hash; the OS fetches the SAME bytes from here and checks them
  // against the same pin. Each path holds the hash, so a file never changes
  // in place. A pin listed here is fetched ONLY from here: if this host
  // fails, the download fails and the app says so (no second host is tried).
  const MIRROR_ORIGIN = 'https://models.gifos.app';
  const MIRROR = {
    // Offline Captions (Whisper): onnx-community int8 exports.
    '2af4a414ca47aa30f61246017e5fe82b0a8d229281d1255ba666a2a7f6b84d19': 'whisper-tiny/2af4a414ca47aa30f61246017e5fe82b0a8d229281d1255ba666a2a7f6b84d19/encoder_model_quantized.onnx',
    '25e807a962b6349356d0ea5d0dfe530b7e5bf0e2a484aeca0359d03143faddd3': 'whisper-tiny/25e807a962b6349356d0ea5d0dfe530b7e5bf0e2a484aeca0359d03143faddd3/decoder_model_merged_quantized.onnx',
    '5862993336bf33acd23736071aae2b32261d3b1b2f37780194460d4ef974dd46': 'whisper-base/5862993336bf33acd23736071aae2b32261d3b1b2f37780194460d4ef974dd46/encoder_model_quantized.onnx',
    'fa3ef9902734ce5ae6f9ef2bdb2ba9a6c4b5785b09f4f420ce036573dc9d090b': 'whisper-base/fa3ef9902734ce5ae6f9ef2bdb2ba9a6c4b5785b09f4f420ce036573dc9d090b/decoder_model_merged_quantized.onnx',
  };
  // Where the OS really fetches a pin from: the first-party copy when there
  // is one, else the author's URL.
  function sourceUrl(pin) {
    const sha = String((pin && pin.sha256) || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(MIRROR, sha)) return MIRROR_ORIGIN + '/' + MIRROR[sha];
    return resolveUrl(String((pin && pin.url) || ''));
  }
  // Same host = one server. Origin-relative pins resolve against this page.
  function assetHost(url) {
    const abs = resolveUrl(url);
    try { return new URL(abs).host.toLowerCase(); } catch (e) {
      try { return new URL(abs, 'https://local.invalid').host.toLowerCase(); } catch (e2) { return abs; }
    }
  }
  function groupByHost(pins) {
    const groups = Object.create(null), order = [];
    for (let i = 0; i < (pins || []).length; i++) {
      const h = assetHost(sourceUrl(pins[i]));
      if (!groups[h]) { groups[h] = []; order.push(h); }
      groups[h].push(pins[i]);
    }
    return { groups, order };
  }

  function sha256Hex(bytes) {
    return root.crypto.subtle.digest('SHA-256', bytes).then((d) => {
      const u = new Uint8Array(d);
      let hex = ''; for (let i = 0; i < u.length; i++) hex += u[i].toString(16).padStart(2, '0');
      return hex;
    });
  }

  const fmtMB = (n) => {
    const f = root.GifOS && root.GifOS.i18n && root.GifOS.i18n.fmt; // the system locale: 1.5 MB, 1,5 MB
    if (n >= 1e9) return f ? f.size(n / 1e9, 'GB', 2) : (n / 1e9).toFixed(2) + ' GB';
    return f ? f.size(n / 1e6, 'MB', 1) : (n / 1e6).toFixed(1) + ' MB';
  };

  // Read a response body to a Blob while REPORTING PROGRESS.
  //
  // r.blob() is one line and tells you nothing until it is finished, which is
  // how an 806 MB model came to download behind a bar that was already full
  // (left over from the App GIF) with no way to tell a stalled download from a
  // slow one. So we pump the stream ourselves and count bytes.
  //
  // The catch, and why this is not just chunks.push(): holding every chunk as
  // a Uint8Array would put the WHOLE asset in the JS heap, which is exactly the
  // thing this module exists to avoid — the weights are Blob-backed end to end
  // precisely so a gigabyte model never becomes a gigabyte of heap. So chunks
  // are folded into Blob PARTS every few MB: the browser can spill a Blob to
  // disk, so the heap holds only the current part. Peak stays ~PART_BYTES
  // instead of ~filesize.
  //
  // No content-length (a chunked transfer, or a CORS response that doesn't
  // expose it) means no honest fraction — report null and let the caller show
  // an indeterminate bar rather than invent a number.
  const PART_BYTES = 4 * 1024 * 1024;
  function readWithProgress(r, declaredBytes, onBytes) {
    if (!(r.body && r.body.getReader)) return r.blob();
    const total = Number(r.headers.get('content-length')) || Number(declaredBytes) || 0;
    const reader = r.body.getReader();
    const parts = [];
    let pending = [], pendingLen = 0, got = 0;
    const flush = () => { if (pendingLen) { parts.push(new Blob(pending)); pending = []; pendingLen = 0; } };
    const pump = () => reader.read().then(({ done, value }) => {
      if (done) { flush(); return new Blob(parts); }
      pending.push(value); pendingLen += value.length; got += value.length;
      if (pendingLen >= PART_BYTES) flush();
      if (onBytes) { try { onBytes(got, total); } catch (e) {} }
      return pump();
    });
    return pump();
  }

  // One pin: fetch, hash-verify, cache. say(text, frac) is the progress line
  // for THIS file; the caller adds " — 3/148" when it has a queue.
  function fetchPin(a, files, cache, say, ofN) {
    const name = a.path.split('/').pop();
    const label = name + (a.bytes ? ' (' + fmtMB(a.bytes) + ')' : '');
    say('Downloading ' + label + ofN + '…', 0);
    return fetch(sourceUrl(a), { credentials: 'omit', redirect: 'follow' })
      .then((r) => {
        if (!r.ok) throw new Error('the download failed (' + r.status + ')');
        return readWithProgress(r, a.bytes, (got, total) => {
          // The size in the label comes from the SERVER when it says so,
          // and from the manifest otherwise — a download that quietly
          // ran long should show it, not keep quoting the pin.
          const shown = total ? fmtMB(total) : (a.bytes ? fmtMB(a.bytes) : '');
          say('Downloading ' + name + (shown ? ' (' + fmtMB(got) + ' of ' + shown + ')' : '') + ofN + '…',
            total ? Math.min(1, got / total) : null);
        });
      })
      .then((blob) => {
        if (blob.size > MAX_ASSET_BYTES) throw new Error('the file exceeds the 2 GB per-asset ceiling');
        // Hashing a gigabyte is not instant and has no sub-steps to
        // report, so the bar goes indeterminate rather than sitting at a
        // full 100% pretending the work is done — the exact lie this
        // whole change exists to stop telling.
        say('Verifying ' + name + '…', null);
        return blob.arrayBuffer()
          .then((buf) => sha256Hex(buf))
          .then((hex) => {
            if (hex !== a.sha256) throw new Error('the bytes don’t match the app’s pinned hash — refused');
            if (cache) return cache.put(a.path, blob, a.sha256);
            // Session-only fallback (no store to cache into): hold the
            // bytes in the in-memory filesystem for this mount's life.
            return blob.arrayBuffer().then((buf2) => { files[key(a)] = new Uint8Array(buf2); });
          });
      })
      .catch((e) => { throw new Error('Asset "' + a.path + '": ' + (e && e.message || e)); });
  }

  // Download every missing asset, hash-verified, into the cache.
  //
  // Default is serial: install/boot of required pins, and gifos.assets() of
  // one path, read as one honest name. opts.parallelHosts (Abilities
  // "Download all") groups by server: one file at a time FROM a given host
  // so a 148-pack library does not open 148 sockets on gifos.app, and
  // different hosts run together. A failure there is recorded and the rest
  // continue — one 404 must not abandon the other 147.
  //
  // Memory note: the response streams into Blob parts (disk-backed), but
  // hashing needs one transient ArrayBuffer of the whole file — the peak is
  // ~1× the asset size per in-flight host, released as soon as the digest is
  // done.
  //
  // onStatus(text, frac) — frac is 0..1 while bytes are arriving, and null for
  // a phase with no measurable progress (verifying, or a download whose length
  // the server never declared). A caller that only wants the words can ignore
  // the second argument, and every existing one does.
  function ensure(files, manifest, onStatus, cache, opts) {
    return missing(files, manifest, cache, opts).then((need) => {
      const total = list(manifest).length;
      if (!need.length) return { changed: false, fetched: 0, failed: 0, total };
      const sayAll = (text, frac) => { if (onStatus) { try { onStatus(text, frac); } catch (e) {} } };

      if (opts && opts.parallelHosts) {
        const split = groupByHost(need);
        let done = 0, failed = 0;
        const errors = [];
        const active = Object.create(null);
        const report = (frac) => {
          const bits = split.order.map((h) => active[h]).filter(Boolean);
          const ofN = need.length > 1 ? ' — ' + (done + failed) + '/' + need.length : '';
          const nActive = bits.length;
          sayAll((bits.join(' · ') || 'Downloading') + ofN, nActive === 1 ? frac : null);
        };
        const runHost = (host) => {
          let chain = Promise.resolve();
          split.groups[host].forEach((a) => {
            chain = chain.then(() => fetchPin(a, files, cache, (text, frac) => {
              active[host] = text.replace(/…$/, '');
              report(frac);
            }, '').then(() => {
              done++;
              delete active[host];
              report(null);
            }, (e) => {
              failed++;
              errors.push({ path: a.path, error: String(e && e.message || e) });
              delete active[host];
              report(null);
            }));
          });
          return chain;
        };
        return Promise.all(split.order.map(runHost)).then(() => ({
          changed: done > 0, fetched: done, failed, errors, total
        }));
      }

      let chain = Promise.resolve();
      need.forEach((a, i) => {
        chain = chain.then(() => {
          const ofN = need.length > 1 ? ' — ' + (i + 1) + '/' + need.length : '';
          return fetchPin(a, files, cache, sayAll, ofN);
        });
      });
      return chain.then(() => ({ changed: true, fetched: need.length, failed: 0, total }));
    });
  }

  // The store binding for a given icon: how ensure() caches, and how the
  // runtime's gifos.assets() serves. `store` is a GifOS.store (namespace-aware).
  function assetCache(store, fileId) {
    if (!store || !fileId || !store.putAsset) return null;
    return {
      has: (path, pin) => {
        const p = normPath(path);
        if (store.getAssetRow) {
          return store.getAssetRow(fileId, p).then((row) => rowMatches(row, pin || null)).catch(() => false);
        }
        return store.hasAsset(fileId, p).catch(() => false);
      },
      put: (path, blob, sha256) => store.putAsset(fileId, normPath(path), blob, sha256),
      get: (path) => store.getAsset(fileId, normPath(path)).catch(() => null),
    };
  }

  // One pin, by path. gifos.assets() uses this when the bytes are not cached
  // yet: the app names a file the author pinned, the OS fetches that row, and
  // nothing else. An unknown path is a miss, not a free-form download.
  function ensurePath(files, manifest, path, onStatus, cache) {
    const p = normPath(path);
    const row = list(manifest).find((a) => a.path === p);
    if (!row) return Promise.resolve({ changed: false, fetched: 0, total: 0, unknown: true });
    const one = { assets: [row] };
    return ensure(files, one, onStatus, cache);
  }

  // Boot backfill for a mounted app or provider: the REQUIRED pins only. An
  // optional pin (a model size nobody picked) arrives when gifos.assets(path)
  // asks for it, so picking Whisper tiny downloads tiny and never base.
  // Resolves null when nothing was missing.
  function backfill(files, manifest, onStatus, cache) {
    const opts = { requiredOnly: true };
    return missing(files, manifest, cache, opts).then((need) => (need.length ? ensure(files, manifest, onStatus, cache, opts) : null));
  }

  GifOS.assets = {
    DIR, list, missing, ensure, ensurePath, backfill, key, normPath, assetCache, rowMatches,
    assetHost, groupByHost, sourceUrl, MIRROR_ORIGIN,
  };
})(typeof window !== 'undefined' ? window : globalThis);
