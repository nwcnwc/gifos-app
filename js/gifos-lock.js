/*
 * gifos-lock.js — passkey lock for an installed GifOS app.
 *
 * Launch gate AND crypto wrap, always. A lock that only hid Open while leaving
 * private data readable would be a misunderstanding.
 *
 * WHAT IS WRAPPED. Private data at rest: saved state (IndexedDB gifos.db /
 * .state/* inside the app GIF). The wrapping key comes from WebAuthn PRF
 * (hmac-secret) on a platform passkey.
 *
 * WHAT STAYS CLEAR. GIF frames, the NETSCAPE loop, image descriptors, palettes,
 * the trailer — the animation. stripForDisplay still drops the whole GIFOS1.0
 * Application Extension, so the Home Screen ornament is unchanged and keeps
 * playing. App code (manifest, index.html, assets) stays in the clear
 * filesystem so a downloaded locked GIF is still a playable GIF that looks
 * like an app; only the private payload is sealed.
 *
 * FORMAT. The wrap lives INSIDE the GifOS Application Extension (the
 * filesystem), never in the pixel stream. GifOS.gif.repack swaps that block
 * and leaves every pixel byte identical.
 *
 *   index.html, app.js, manifest.json, assets/  — clear (the app itself)
 *   .state/*                                    — gone (moved into the wrap)
 *   .lock/v1                                    — AES-GCM of the private files
 *
 * .lock/v1 bytes:
 *   magic "GLK1" (4) | version u8=1 | iv (12) | ciphertext (AES-GCM-256,
 *   16-byte tag at the end). Plaintext is UTF-8 JSON
 *   { v:1, files:{ path: b64 } } of every .state/* file (and a packed
 *   .state/db.json of live IndexedDB state). Wrong key / truncated / bad
 *   magic → fail shut.
 *
 * WebAuthn runs in OS chrome (desktop.js / run.html), NEVER inside the GIF:
 * the sandbox is an opaque origin. Same shape as payments: a GifOS sheet
 * first, then the browser passkey dialog. userVerification required; any
 * authenticator that gives PRF (this device, a synced passkey, a phone over
 * QR, a security key). No PRF → the sheet offers a passphrase. No silent skip.
 *
 * PASSPHRASE. Where no passkey with PRF exists (ChromeOS's Linux Chrome has no
 * platform authenticator at all; ChromeOS's own one has no PRF), the lock uses
 * a passphrase: PBKDF2-SHA-256 (PASS_ITER iterations, 16-byte random salt per
 * lock) → AES-GCM-256, the same GLK1 wrap. The item's lock record says which
 * (`kind:'passphrase'` + kdf, iter, salt, and `check`: a GLK1 of a constant,
 * so a wrong passphrase is told at once). Records with no kind are passkeys.
 *
 * GLK2 (GifOS.seal, the shared API, e.g. for identity GIFs) is self-describing:
 *   "GLK2" (4) | version u8=2 | kind u8 (1 key, 2 passphrase)
 *   | kind 2: kdf u8=1 (PBKDF2-SHA-256) | iter u32 BE | salt (16)
 *   | iv (12) | AES-GCM-256 ciphertext+tag, AAD = every byte before the iv.
 * A passphrase GLK2 opens on any device with the passphrase alone.
 *
 * Attaches to `GifOS.lock` and `GifOS.seal`.
 */
(function (root) {
  const GifOS = (root.GifOS = root.GifOS || {});
  if (GifOS.lock) return;

  const MAGIC = [0x47, 0x4c, 0x4b, 0x31]; // GLK1
  const LOCK_PATH = '.lock/v1';
  const INFO = 'gifos-app-lock-v1';
  const CANNOT = 'This device cannot passkey-lock.';
  const NO_PRF = 'This passkey cannot encrypt on this device (no PRF). Use a passphrase instead.';
  const MAGIC2 = [0x47, 0x4c, 0x4b, 0x32]; // GLK2
  // OWASP 2023 floor for PBKDF2-HMAC-SHA256; ~0.3-1 s once per unlock on a Chromebook.
  const PASS_ITER = 600000;
  const PASS_MIN = 8;
  const CHECK = 'gifos-lock-check-v1';
  const fail = (msg, code) => { const e = new Error(msg); e.code = code; return e; };

  const gif = () => GifOS.gif;
  const store = () => GifOS.store;
  const te = (s) => new TextEncoder().encode(s);
  const td = (b) => new TextDecoder().decode(b);
  const b64e = (b) => gif().b64encode(b);
  const b64d = (s) => gif().b64decode(s);
  const asBytes = (v) => (typeof v === 'string' ? gif().textToBytes(v) : (v instanceof Uint8Array ? v : new Uint8Array(v || [])));

  function isPrivatePath(p) {
    return typeof p === 'string' && p.indexOf('.state/') === 0;
  }
  function isLockPath(p) {
    return typeof p === 'string' && p.indexOf('.lock/') === 0;
  }

  // ---- AES-GCM wrap of a files dict ----------------------------------------
  async function importRawKey(raw) {
    const bytes = asBytes(raw);
    if (bytes.length < 32) throw new Error('passkey wrap key is too short');
    return crypto.subtle.importKey('raw', bytes.subarray(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  async function keyFromPrf(prf) {
    const raw = prf instanceof Uint8Array ? prf : new Uint8Array(prf);
    if (raw.length < 32) throw new Error(CANNOT);
    const base = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: te(INFO) },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']);
  }

  function packFiles(files) {
    const out = {};
    for (const p of Object.keys(files || {})) out[p] = b64e(asBytes(files[p]));
    return JSON.stringify({ v: 1, files: out });
  }
  function unpackFiles(json) {
    const obj = JSON.parse(typeof json === 'string' ? json : td(json));
    if (!obj || obj.v !== 1 || !obj.files || typeof obj.files !== 'object') throw new Error('bad wrap payload');
    const out = {};
    for (const p of Object.keys(obj.files)) out[p] = b64d(obj.files[p]);
    return out;
  }

  async function encryptBytes(plain, key) {
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, asBytes(plain)));
    const out = new Uint8Array(4 + 1 + 12 + ct.length);
    out[0] = MAGIC[0]; out[1] = MAGIC[1]; out[2] = MAGIC[2]; out[3] = MAGIC[3];
    out[4] = 1;
    out.set(iv, 5);
    out.set(ct, 17);
    return out;
  }
  async function decryptBytes(wrapped, key) {
    const b = asBytes(wrapped);
    if (isGlk2(b)) return openGlk2(b, { key });
    if (b.length < 17 + 16) throw fail('truncated wrap', 'damaged');
    if (b[0] !== MAGIC[0] || b[1] !== MAGIC[1] || b[2] !== MAGIC[2] || b[3] !== MAGIC[3]) throw fail('not a passkey wrap', 'damaged');
    if (b[4] !== 1) throw fail('unknown wrap version', 'damaged');
    const iv = b.subarray(5, 17);
    const ct = b.subarray(17);
    try {
      return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
    } catch (e) {
      throw fail('wrong passkey, or the wrap is damaged', 'wrong-secret');
    }
  }

  // ---- passphrase key + GLK2 (self-describing) -----------------------------
  async function passphraseKey(passphrase, salt, iter) {
    if (typeof passphrase !== 'string' || !passphrase) throw fail('A passphrase is needed.', 'need-passphrase');
    const s = asBytes(salt);
    if (s.length < 16) throw fail('passphrase salt is too short', 'damaged');
    const n = iter == null ? PASS_ITER : iter;
    if (!(n >= 100000 && n <= 10000000)) throw fail('bad passphrase iteration count', 'damaged');
    const base = await crypto.subtle.importKey('raw', te(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: s, iterations: n },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']);
  }
  function isGlk2(b) {
    return b.length >= 6 && b[0] === MAGIC2[0] && b[1] === MAGIC2[1] && b[2] === MAGIC2[2] && b[3] === MAGIC2[3];
  }
  function inspect(blob) {
    const b = asBytes(blob);
    if (b.length >= 5 && b[0] === MAGIC[0] && b[1] === MAGIC[1] && b[2] === MAGIC[2] && b[3] === MAGIC[3]) return { format: 'GLK1', kind: 'key' };
    if (!isGlk2(b) || b[4] !== 2) return null;
    if (b[5] === 1) return { format: 'GLK2', kind: 'key', head: 6 };
    if (b[5] === 2 && b.length >= 28 && b[6] === 1) {
      const iter = ((b[7] << 24) >>> 0) + (b[8] << 16) + (b[9] << 8) + b[10];
      return { format: 'GLK2', kind: 'passphrase', kdf: 'PBKDF2-SHA256', iter, salt: b.slice(11, 27), head: 27 };
    }
    return null;
  }
  async function sealGlk2(plain, secret) {
    secret = secret || {};
    let head, key;
    if (typeof secret.passphrase === 'string') {
      const salt = rand(16);
      const iter = secret.iter || PASS_ITER;
      key = await passphraseKey(secret.passphrase, salt, iter);
      head = new Uint8Array(27);
      head.set(MAGIC2, 0); head[4] = 2; head[5] = 2; head[6] = 1;
      head[7] = (iter >>> 24) & 255; head[8] = (iter >>> 16) & 255; head[9] = (iter >>> 8) & 255; head[10] = iter & 255;
      head.set(salt, 11);
    } else if (secret.key) {
      key = secret.key;
      head = new Uint8Array(6);
      head.set(MAGIC2, 0); head[4] = 2; head[5] = 1;
    } else {
      throw fail('seal needs { passphrase } or { key }', 'need-secret');
    }
    const iv = rand(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: head }, key, asBytes(plain)));
    const out = new Uint8Array(head.length + 12 + ct.length);
    out.set(head, 0); out.set(iv, head.length); out.set(ct, head.length + 12);
    return out;
  }
  async function openGlk2(b, secret) {
    const info = inspect(b);
    if (!info || info.format !== 'GLK2') throw fail('unknown wrap format', 'damaged');
    if (b.length < info.head + 12 + 16) throw fail('truncated wrap', 'damaged');
    secret = secret || {};
    let key;
    if (info.kind === 'passphrase') {
      if (typeof secret.passphrase !== 'string') throw fail('This was sealed with a passphrase.', 'need-passphrase');
      key = await passphraseKey(secret.passphrase, info.salt, info.iter);
    } else {
      if (!secret.key) throw fail('This was sealed with a passkey.', 'need-key');
      key = secret.key;
    }
    const head = b.subarray(0, info.head);
    const iv = b.subarray(info.head, info.head + 12);
    try {
      return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: head }, key, b.subarray(info.head + 12)));
    } catch (e) {
      throw fail(info.kind === 'passphrase' ? 'Wrong passphrase, or the file is damaged.' : 'wrong passkey, or the wrap is damaged', 'wrong-secret');
    }
  }
  // Open any wrap (GLK1 needs a key; GLK2 says what it needs).
  async function openAny(blob, secret) {
    const b = asBytes(blob);
    if (isGlk2(b)) return openGlk2(b, secret);
    if (!secret || !secret.key) throw fail('This was sealed with a passkey.', 'need-key');
    return decryptBytes(b, secret.key);
  }

  async function wrapFiles(files, key) {
    const priv = {};
    for (const p of Object.keys(files || {})) if (isPrivatePath(p)) priv[p] = files[p];
    return encryptBytes(packFiles(priv), key);
  }
  async function unwrapFiles(blob, key) {
    return unpackFiles(await decryptBytes(blob, key));
  }

  function splitClear(files) {
    const clear = {}, priv = {};
    for (const p of Object.keys(files || {})) {
      if (isLockPath(p)) continue;
      if (isPrivatePath(p)) priv[p] = files[p];
      else clear[p] = files[p];
    }
    return { clear, priv };
  }
  function isWrappedFiles(files) {
    return !!(files && files[LOCK_PATH]);
  }

  async function wrapGif(bytes, key, extraPriv) {
    const g = gif();
    const archive = await g.decode(bytes);
    if (!archive || !archive.files) throw new Error('not a GifOS gif');
    const { clear, priv } = splitClear(archive.files);
    const merged = Object.assign({}, priv, extraPriv || {});
    clear[LOCK_PATH] = await wrapFiles(merged, key);
    return g.repack(bytes, clear);
  }
  async function unwrapGif(bytes, key) {
    const g = gif();
    const archive = await g.decode(bytes);
    if (!archive || !archive.files) throw new Error('not a GifOS gif');
    if (!archive.files[LOCK_PATH]) return { bytes, files: archive.files, changed: false };
    const priv = await unwrapFiles(archive.files[LOCK_PATH], key);
    const files = {};
    for (const p of Object.keys(archive.files)) if (!isLockPath(p)) files[p] = archive.files[p];
    Object.assign(files, priv);
    return { bytes: await g.repack(bytes, files), files, changed: true };
  }

  // ---- IndexedDB state blob -------------------------------------------------
  function isSealed(state) {
    return !!(state && state._gifosLock === 1 && typeof state.blob === 'string');
  }
  async function sealState(state, key) {
    const packed = (store() && store().packJSON) ? store().packJSON(state || { collections: {} }) : JSON.stringify(state || { collections: {} });
    const blob = await encryptBytes(packed, key);
    // Whole GLK1 blob as one b64 so getState returns a non-collections row
    // (not exploded into apprecords).
    return { _gifosLock: 1, v: 1, blob: b64e(blob) };
  }
  async function openState(sealed, key) {
    if (!isSealed(sealed)) return sealed;
    const plain = td(await decryptBytes(b64d(sealed.blob), key));
    if (store() && store().unpackJSON) return store().unpackJSON(plain);
    return JSON.parse(plain);
  }

  // ---- WebAuthn -------------------------------------------------------------
  const sessions = new Map(); // fileId -> CryptoKey (this tab only)

  function prfFrom(cred) {
    try {
      const ext = cred && cred.getClientExtensionResults && cred.getClientExtensionResults();
      const first = ext && ext.prf && ext.prf.results && ext.prf.results.first;
      if (!first) return null;
      const u = first instanceof Uint8Array ? first : new Uint8Array(first);
      return u.length ? u : null;
    } catch (e) { return null; }
  }
  function rand(n) {
    const u = new Uint8Array(n);
    crypto.getRandomValues(u);
    return u;
  }
  function rpId() {
    try { return root.location.hostname || undefined; } catch (e) { return undefined; }
  }

  async function canPasskeyLock() {
    if (overrideRaw()) return { ok: true, test: true };
    const C = root.PublicKeyCredential;
    if (!C || typeof root.navigator === 'undefined' || !root.navigator.credentials) {
      return { ok: false, reason: CANNOT };
    }
    // A passkey needs somewhere to live: this device, a synced passkey
    // provider (both say passkeyPlatformAuthenticator), or a phone over QR
    // (hybridTransport). Linux Chrome under ChromeOS (Crostini) has none of
    // them, so it goes straight to the passphrase.
    try {
      let uv = null, caps = null;
      if (typeof C.isUserVerifyingPlatformAuthenticatorAvailable === 'function') uv = await C.isUserVerifyingPlatformAuthenticatorAvailable();
      if (typeof C.getClientCapabilities === 'function') caps = await C.getClientCapabilities();
      // Absent key: browser too old to advertise; we still try create+get.
      if (caps && caps['extension:prf'] === false) return { ok: false, reason: CANNOT };
      const somewhere = uv === true || !!(caps && (caps.passkeyPlatformAuthenticator || caps.hybridTransport || caps.userVerifyingPlatformAuthenticator));
      if (!somewhere && (uv === false || caps)) return { ok: false, reason: CANNOT };
    } catch (e) {
      return { ok: false, reason: CANNOT };
    }
    return { ok: true };
  }

  function overrideRaw() {
    const direct = GifOS.lock && GifOS.lock._prfOverride;
    if (direct) return direct instanceof Uint8Array ? direct : new Uint8Array(direct);
    try {
      const s = root.localStorage && root.localStorage.getItem('gifos_lock_test_prf');
      if (s) return b64d(s);
    } catch (e) {}
    return null;
  }
  async function overrideKey() {
    const raw = overrideRaw();
    if (!raw) return null;
    return keyFromPrf(raw);
  }

  async function createLock(appName, fileId) {
    const forced = await overrideKey();
    if (forced) {
      return {
        key: forced,
        meta: {
          v: 1, credId: b64e(rand(16)), userId: b64e(rand(16)), salt: b64e(rand(32)),
          rpId: rpId() || '', createdAt: (store() && store().nowISO) ? store().nowISO() : '',
          test: true,
        },
      };
    }
    const cap = await canPasskeyLock();
    if (!cap.ok) throw new Error(cap.reason);
    const userId = rand(16);
    const salt = rand(32);
    const challenge = rand(32);
    const cred = await navigator.credentials.create({
      publicKey: {
        rp: { name: 'GifOS', id: rpId() },
        user: { id: userId, name: String(fileId), displayName: String(appName || 'App') },
        challenge,
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        // No 'platform' pin: a synced passkey, a phone over QR or a security
        // key that gives PRF is as good. PRF is what decides (below).
        authenticatorSelection: {
          userVerification: 'required',
          residentKey: 'preferred',
        },
        hints: ['client-device', 'hybrid'],
        timeout: 120000,
        attestation: 'none',
        extensions: { prf: { eval: { first: salt } } },
      },
    });
    if (!cred || !cred.rawId) throw new Error(CANNOT);
    let transports = null;
    try { transports = cred.response && cred.response.getTransports ? cred.response.getTransports() : null; } catch (e) { transports = null; }
    const allow = { type: 'public-key', id: cred.rawId };
    if (transports && transports.length) allow.transports = transports;
    let prf = prfFrom(cred);
    if (!prf) {
      const got = await navigator.credentials.get({
        publicKey: {
          challenge: rand(32),
          rpId: rpId(),
          allowCredentials: [allow],
          userVerification: 'required',
          timeout: 120000,
          extensions: { prf: { eval: { first: salt } } },
        },
      });
      prf = prfFrom(got);
    }
    if (!prf) throw fail(NO_PRF, 'no-prf');
    const key = await keyFromPrf(prf);
    return {
      key,
      meta: {
        v: 1,
        transports: transports && transports.length ? transports.slice(0, 8) : undefined,
        credId: b64e(new Uint8Array(cred.rawId)),
        userId: b64e(userId),
        salt: b64e(salt),
        rpId: rpId() || '',
        createdAt: (store() && store().nowISO) ? store().nowISO() : '',
      },
    };
  }

  // Passphrase lock record: salt + iterations + a check blob (no secret).
  async function createPassLock(passphrase) {
    if (typeof passphrase !== 'string' || passphrase.length < PASS_MIN) throw fail('Use at least ' + PASS_MIN + ' characters.', 'weak-passphrase');
    const salt = rand(16);
    const key = await passphraseKey(passphrase, salt, PASS_ITER);
    const check = await encryptBytes(te(CHECK), key);
    return {
      key,
      meta: {
        v: 1, kind: 'passphrase', kdf: 'PBKDF2-SHA256', iter: PASS_ITER,
        salt: b64e(salt), check: b64e(check),
        createdAt: (store() && store().nowISO) ? store().nowISO() : '',
      },
    };
  }
  function lockKind(meta) {
    if (!meta) return null;
    if (meta.kind === 'passphrase') return 'passphrase';
    return meta.credId ? 'passkey' : null;
  }
  async function passLockKey(meta, passphrase) {
    if (!meta || !meta.salt || !meta.check) throw new Error('This app is locked, but the lock record is missing.');
    const key = await passphraseKey(passphrase, b64d(meta.salt), meta.iter);
    let ok = false;
    try { ok = td(await decryptBytes(b64d(meta.check), key)) === CHECK; } catch (e) { ok = false; }
    if (!ok) throw fail('Wrong passphrase.', 'wrong-secret');
    return key;
  }

  async function assertLock(meta, opts) {
    if (meta && meta.kind === 'passphrase') {
      if (!opts || typeof opts.passphrase !== 'string') throw fail('This app is locked with a passphrase.', 'need-passphrase');
      return passLockKey(meta, opts.passphrase);
    }
    if (!meta || !meta.credId || !meta.salt) throw new Error('This app is passkey-locked, but the lock record is missing.');
    const forced = await overrideKey();
    if (forced) return forced;
    const cap = await canPasskeyLock();
    if (!cap.ok) throw new Error('This passkey is not on this device.');
    const credId = b64d(meta.credId);
    const salt = b64d(meta.salt);
    const got = await navigator.credentials.get({
      publicKey: {
        challenge: rand(32),
        rpId: meta.rpId || rpId(),
        // Old records were platform-only ('internal'); new ones keep what the authenticator said.
        allowCredentials: [{ type: 'public-key', id: credId, transports: Array.isArray(meta.transports) && meta.transports.length ? meta.transports : ['internal'] }],
        userVerification: 'required',
        timeout: 120000,
        extensions: { prf: { eval: { first: salt } } },
      },
    });
    const prf = prfFrom(got);
    if (!prf) throw new Error('This passkey is not on this device.');
    return keyFromPrf(prf);
  }

  // ---- GifOS sheet (trusted display BEFORE the browser passkey dialog) ------
  // `w` is the secret's word: 'passkey' or 'passphrase' (lockKind of the record).
  const COPY = {
    lock: {
      title: 'Lock this app',
      lead: (n) => 'Require a passkey (fingerprint, Face ID, or this device’s PIN) or a passphrase to open <b>' + n + '</b>. Your saved data is encrypted on this device. The icon still plays.',
      ok: 'Lock this app',
      alt: 'Use a passphrase instead',
    },
    open: {
      title: (n) => 'Unlock ' + n,
      lead: (n, w) => 'This app’s private data is ' + w + '-locked on this device. Use your ' + w + ' to open it.',
      ok: 'Unlock',
    },
    remove: {
      title: 'Remove lock',
      lead: (n, w) => 'Your ' + w + ' will unwrap <b>' + n + '</b>’s private data on this device. Anyone who can use this device can then open it.',
      ok: 'Remove lock',
    },
    export: {
      title: (n) => 'Download ' + n,
      lead: (n, w) => 'This app’s private data is ' + w + '-locked. Unlock to download it with your saved data, or download the app without your data. The animation is included either way.',
      ok: 'Download with my data',
      alt: 'Download without my data',
    },
    // Passphrase entry (askPassphrase). `note` explains why a passphrase.
    passNew: {
      title: (n) => 'Lock ' + n + ' with a passphrase',
      lead: (n, w, note) => (note ? esc(note) + ' ' : '') + 'Choose a passphrase of at least ' + PASS_MIN + ' characters. Nobody can recover it for you: without it, <b>' + n + '</b>’s saved data cannot be opened. The icon still plays.',
      ok: 'Lock this app',
    },
    passAsk: {
      title: (n) => 'Unlock ' + n,
      lead: (n) => 'Enter the passphrase for <b>' + n + '</b>.',
      ok: 'Unlock',
    },
  };
  // The plain data choice (no lock involved): an app with saved data, or a
  // folder holding some. Words come from i18n/<locale>/common.json.
  const tx = (k, fb, p) => { try { const g = root.GifOS && root.GifOS.i18n; if (g) { const v = g.t(k, p); if (v && v !== k) return v; } } catch (e) {} return fb.replace(/\{(\w+)\}/g, (m, n) => (p && p[n] != null ? p[n] : m)); };
  COPY.exportData = {
    title: (n) => tx('common.dl.title', 'Download {name}', { name: n }),
    lead: (n) => tx('common.dl.lead', '<b>{name}</b> has saved data. Download it with your saved data, or as a clean copy that starts fresh. The animation is included either way.', { name: n }),
    ok: () => tx('common.dl.withData', 'Download with my data'),
    alt: () => tx('common.dl.withoutData', 'Download without my data'),
  };
  const CSS = '' +
    '.lock-modal{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:1rem}' +
    '.lock-box{background:var(--surface,#14141f);border:1px solid var(--border,#2a2a3f);border-radius:.8rem;padding:1.4rem 1.5rem;max-width:420px;width:100%;color:var(--text,#e0e0f0);font:15px system-ui,sans-serif}' +
    '.lock-box h3{margin:0 0 .5rem;font-size:1.1rem}' +
    '.lock-box .lead{color:var(--muted,#b0b0c8);font-size:.88rem;line-height:1.5;margin-bottom:1.1rem}' +
    '.lock-btns{display:flex;flex-direction:column;gap:.5rem}' +
    '.lock-field{display:block;font-size:.85rem;color:var(--muted,#b0b0c8);margin:0 0 .7rem}' +
    '.lock-field input{display:block;width:100%;box-sizing:border-box;margin-top:.3rem;padding:.55rem .7rem;border-radius:.5rem;border:1px solid var(--border,#2a2a3f);background:var(--bg,#0b0b14);color:var(--text,#e0e0f0);font:inherit}' +
    '.lock-err{min-height:1.2em;margin:0 0 .8rem;font-size:.85rem;color:var(--danger,#ff7a8a)}' +
    '.lock-box .ok:disabled{opacity:.6;cursor:progress}' +
    '.lock-box .ok{padding:.55rem 1.2rem;border-radius:.5rem;border:1px solid var(--accent,#7b5cff);background:var(--accent,#7b5cff);color:var(--onaccent,#fff);cursor:pointer;font:inherit}' +
    '.lock-box .ghost{padding:.55rem 1.2rem;border-radius:.5rem;border:1px solid var(--border,#2a2a3f);background:transparent;color:var(--text,#e0e0f0);cursor:pointer;font:inherit}';
  function injectCss() {
    const doc = root.document;
    if (!doc || doc.getElementById('gifos-lock-css')) return;
    const s = doc.createElement('style'); s.id = 'gifos-lock-css'; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function sheet(kind, appName, word, note) {
    const c = COPY[kind] || COPY.lock;
    const name = appName || 'this app';
    return {
      kind,
      title: typeof c.title === 'function' ? c.title(name) : c.title,
      lead: c.lead(esc(name), word === 'passphrase' ? 'passphrase' : 'passkey', note),
      ok: typeof c.ok === 'function' ? c.ok() : c.ok,
      alt: (typeof c.alt === 'function' ? c.alt() : c.alt) || null,
    };
  }
  async function showSheet(kind, appName, word) {
    const doc = root.document;
    if (!doc) return 'cancel';
    injectCss();
    if (kind === 'exportData') { try { const g = root.GifOS && root.GifOS.i18n; if (g && g.load) await g.load('common'); } catch (e) {} }
    const s = sheet(kind, appName, word);
    return new Promise((resolve) => {
      const bg = doc.createElement('div');
      bg.className = 'lock-modal';
      bg.setAttribute('data-gifos-lock-sheet', kind);
      const altBtn = s.alt ? '<button class="ghost" data-lock-act="alt">' + esc(s.alt) + '</button>' : '';
      bg.innerHTML = '<div class="lock-box" role="dialog" aria-modal="true"><h3>' + esc(s.title) + '</h3>' +
        '<p class="lead">' + s.lead + '</p>' +
        '<div class="lock-btns">' +
        '<button class="ok" data-lock-act="ok">' + esc(s.ok) + '</button>' +
        altBtn +
        '<button class="ghost" data-lock-act="cancel">' + esc(tx('common.dl.cancel', 'Cancel')) + '</button>' +
        '</div></div>';
      const done = (act) => { try { bg.remove(); } catch (e) {} resolve(act); };
      bg.addEventListener('click', (e) => {
        if (e.target === bg) done('cancel');
        const b = e.target && e.target.closest && e.target.closest('[data-lock-act]');
        if (b) done(b.getAttribute('data-lock-act'));
      });
      doc.body.appendChild(bg);
    });
  }

  // A passphrase sheet. opts.confirm: a new passphrase (two fields, length
  // check). opts.verify(pass): async, throws to show its message in the sheet
  // and ask again (a wrong passphrase); its result is returned. Cancel → null.
  async function askPassphrase(appName, opts) {
    const doc = root.document;
    if (!doc) return null;
    opts = opts || {};
    injectCss();
    const s = sheet(opts.confirm ? 'passNew' : 'passAsk', appName, 'passphrase', opts.note);
    // A caller that is not locking an app (an identity file) says its own words: title and ok are text, lead is HTML it made.
    if (opts.title) s.title = String(opts.title);
    if (opts.lead) s.lead = String(opts.lead);
    if (opts.ok) s.ok = String(opts.ok);
    return new Promise((resolve) => {
      const bg = doc.createElement('div');
      bg.className = 'lock-modal';
      bg.setAttribute('data-gifos-lock-sheet', opts.confirm ? 'passnew' : 'passask');
      const field = (id, label, ac) => '<label class="lock-field">' + esc(label) +
        '<input type="password" data-lock-pass="' + id + '" autocomplete="' + ac + '" spellcheck="false" autocapitalize="off" maxlength="1024"></label>';
      bg.innerHTML = '<div class="lock-box" role="dialog" aria-modal="true"><h3>' + esc(s.title) + '</h3>' +
        '<p class="lead">' + s.lead + '</p>' +
        '<form data-lock-form novalidate>' +
        field('one', 'Passphrase', opts.confirm ? 'new-password' : 'current-password') +
        (opts.confirm ? field('two', 'Type it again', 'new-password') : '') +
        '<p class="lock-err" role="alert" data-lock-err></p>' +
        '</form>' +
        '<div class="lock-btns">' +
        '<button class="ok" data-lock-act="ok">' + esc(s.ok) + '</button>' +
        '<button class="ghost" data-lock-act="cancel">' + esc(tx('common.dl.cancel', 'Cancel')) + '</button>' +
        '</div></div>';
      const one = bg.querySelector('[data-lock-pass="one"]');
      const two = bg.querySelector('[data-lock-pass="two"]');
      const errEl = bg.querySelector('[data-lock-err]');
      const okBtn = bg.querySelector('[data-lock-act="ok"]');
      let busy = false;
      const done = (v) => { try { bg.remove(); } catch (e) {} resolve(v); };
      const say = (m) => { errEl.textContent = m || ''; };
      const submit = async () => {
        if (busy) return;
        const p = one.value;
        if (opts.confirm) {
          if (p.length < PASS_MIN) { say('Use at least ' + PASS_MIN + ' characters.'); one.focus(); return; }
          if (two.value !== p) { say('The two passphrases do not match.'); two.focus(); return; }
        } else if (!p) { say('Enter the passphrase.'); one.focus(); return; }
        if (!opts.verify) { done(p); return; }
        busy = true; okBtn.disabled = true; say('Checking…');
        try {
          const r = await opts.verify(p);
          done(r === undefined ? p : r);
        } catch (e) {
          busy = false; okBtn.disabled = false;
          say((e && e.message) || String(e));
          one.select(); one.focus();
        }
      };
      bg.querySelector('[data-lock-form]').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
      bg.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT') { e.preventDefault(); submit(); }
        if (e.key === 'Escape' && !busy) done(null);
      });
      bg.addEventListener('click', (e) => {
        if (e.target === bg && !busy) done(null);
        const b = e.target && e.target.closest && e.target.closest('[data-lock-act]');
        if (!b) return;
        if (b.getAttribute('data-lock-act') === 'cancel') { if (!busy) done(null); } else submit();
      });
      doc.body.appendChild(bg);
      try { one.focus(); } catch (e) {}
    });
  }

  // The key for a lock record, asking the person in a sheet. Passkey: the
  // browser dialog (no extra sheet). Passphrase: the passphrase sheet, which
  // stays up on a wrong one. Cancel → null.
  async function keyFor(meta, appName) {
    if (lockKind(meta) === 'passphrase') {
      return askPassphrase(appName, { verify: (p) => passLockKey(meta, p) });
    }
    return assertLock(meta);
  }

  // Lock a new item: passkey where one can give PRF, passphrase otherwise or
  // by choice. Returns { key, meta } or null (cancelled). Shows its own sheets.
  async function chooseAndCreate(appName, fileId) {
    const forced = await overrideKey();
    const cap = forced ? { ok: true } : await canPasskeyLock();
    let note = '';
    if (cap.ok) {
      const act = await showSheet('lock', appName);
      if (act === 'cancel') return null;
      if (act === 'ok') {
        try {
          return await createLock(appName, fileId);
        } catch (e) {
          // No PRF from what the browser offered, or the person backed out of
          // the browser dialog: a passphrase is the way forward, not a dead end.
          note = (e && e.code === 'no-prf') ? NO_PRF.replace(/ Use a passphrase instead\.$/, '') : 'The passkey did not work here.';
        }
      }
    } else {
      note = 'This browser has no passkey that can encrypt.';
    }
    const pass = await askPassphrase(appName, { confirm: true, note });
    if (pass == null) return null;
    return createPassLock(pass);
  }

  // ---- at-rest persist (IndexedDB + stored GIF) -----------------------------
  async function liveState(fileId) {
    const s = await store().getState(fileId);
    if (!s) return { collections: {} };
    if (isSealed(s)) return null; // caller must open with the key
    if (s.collections) return s;
    return { collections: {} };
  }
  async function writeSealed(fileId, state, key) {
    const sealed = await sealState(state, key);
    await store().deleteState(fileId);
    await store().setState(fileId, sealed);
  }
  async function wrapAtRest(fileId, key) {
    const file = await store().getFile(fileId);
    if (!file) throw new Error('file not found');
    let state = await liveState(fileId);
    if (state == null) {
      const cur = await store().getState(fileId);
      state = await openState(cur, key);
    }
    const extra = {};
    if (state && (state.collections && Object.keys(state.collections).length || store().packJSON)) {
      extra['.state/db.json'] = gif().textToBytes(store().packJSON(state));
    }
    const bytes = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes);
    const wrapped = await wrapGif(bytes, key, extra);
    await store().putFile(Object.assign({}, file, { bytes: wrapped }));
    await writeSealed(fileId, state, key);
  }
  async function unwrapAtRest(fileId, key) {
    const file = await store().getFile(fileId);
    if (!file) throw new Error('file not found');
    const bytes = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes);
    const opened = await unwrapGif(bytes, key);
    if (opened.changed) await store().putFile(Object.assign({}, file, { bytes: opened.bytes }));
    const sealed = await store().getState(fileId);
    let state = { collections: {} };
    if (isSealed(sealed)) state = await openState(sealed, key);
    else if (sealed && sealed.collections) state = sealed;
    else if (opened.files && opened.files['.state/db.json']) {
      try { state = store().unpackJSON(gif().bytesToText(opened.files['.state/db.json'])); } catch (e) {}
    }
    if (state && state.collections) await store().setState(fileId, state);
    else { await store().deleteState(fileId); }
  }

  // In-memory db for a locked launch. Reads are clear; every write re-seals
  // IndexedDB. The stored GIF stays wrapped until they remove the lock.
  function makeDb(fileId, key, onChange, initial) {
    let state = (initial && initial.collections) ? initial : { collections: {} };
    const chan = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel(store().appChannel(fileId)) : null;
    const persist = () => writeSealed(fileId, state, key);
    const notify = (collection) => { if (chan) chan.postMessage({ collection }); onChange(collection); };
    if (chan) {
      chan.onmessage = () => {
        store().getState(fileId).then((s) => openState(s, key)).then((st) => {
          if (st && st.collections) { state = st; onChange('*'); }
        }).catch(() => {});
      };
    }
    const collOf = (name) => {
      if (GifOS.store.badCollectionName(name)) throw new Error('bad collection name');
      const c = state.collections[name] || (state.collections[name] = { items: {}, seq: 1 });
      if (!c.items) c.items = {};
      if (!c.seq) c.seq = 1;
      return c;
    };
    const full = () => Promise.resolve(state);
    return {
      owner: true,
      load: full,
      import: (s) => { state = s && s.collections ? s : { collections: {} }; return persist(); },
      getFullState: full,
      op(op, collection, id, value) {
        if (op === 'dump') return full();
        if (op === 'get') { const c = state.collections[collection]; return Promise.resolve((c && c.items && c.items[id]) || null); }
        if (op === 'getAll') { const c = state.collections[collection]; return Promise.resolve(c && c.items ? Object.values(c.items) : []); }
        if (op === 'put') {
          const rec = Object.assign(Object.create(null), value || {});
          const c = collOf(collection);
          if (rec.id == null) rec.id = collection + '_' + (c.seq++);
          c.items[rec.id] = rec;
          return persist().then(() => { notify(collection); return rec; });
        }
        if (op === 'delete') {
          const c = state.collections[collection];
          if (c && c.items) delete c.items[id];
          return persist().then(() => { notify(collection); return true; });
        }
        if (op === 'setVisibility') {
          const c = state.collections[collection];
          const rec = c && c.items && c.items[id];
          if (!rec) return Promise.resolve(null);
          rec._vis = value;
          return persist().then(() => { notify(collection); return rec; });
        }
        return Promise.resolve(null);
      },
    };
  }

  function itemOfFile(items, fileId) {
    return (items || []).find((i) => i && i.fileId === fileId && i.passkey) || (items || []).find((i) => i && i.fileId === fileId) || null;
  }
  // item.passkey holds the lock record whatever the secret (the field name is
  // older than passphrases; renaming it would orphan every existing lock).
  function isLockedItem(it) { return !!(it && it.passkey && lockKind(it.passkey)); }

  async function gateOpen(fileId, appName) {
    const items = await store().allItems();
    const it = itemOfFile(items, fileId);
    if (!isLockedItem(it)) return true;
    if (lockKind(it.passkey) === 'passphrase') {
      const key = await keyFor(it.passkey, appName);
      if (!key) return false;
      sessions.set(fileId, key);
      return true;
    }
    const act = await showSheet('open', appName);
    if (act !== 'ok') return false;
    const key = await assertLock(it.passkey);
    sessions.set(fileId, key);
    return true;
  }

  // ---- GifOS.seal: the shared sealing API (identity GIFs and others) -------
  async function sealGif(bytes, secret, extraPriv) {
    const g = gif();
    const archive = await g.decode(bytes);
    if (!archive || !archive.files) throw new Error('not a GifOS gif');
    const { clear, priv } = splitClear(archive.files);
    const merged = Object.assign({}, priv, extraPriv || {});
    clear[LOCK_PATH] = await sealGlk2(packFiles(merged), secret);
    return g.repack(bytes, clear);
  }
  async function openGif(bytes, secret) {
    const g = gif();
    const archive = await g.decode(bytes);
    if (!archive || !archive.files) throw new Error('not a GifOS gif');
    if (!archive.files[LOCK_PATH]) return { bytes, files: archive.files, changed: false };
    const priv = unpackFiles(await openAny(archive.files[LOCK_PATH], secret));
    const files = {};
    for (const p of Object.keys(archive.files)) if (!isLockPath(p)) files[p] = archive.files[p];
    Object.assign(files, priv);
    return { bytes: await g.repack(bytes, files), files, changed: true };
  }
  async function gifSecretKind(bytes) {
    const archive = await gif().decode(bytes);
    const w = archive && archive.files && archive.files[LOCK_PATH];
    const info = w ? inspect(w) : null;
    return info ? info.kind : null;
  }

  GifOS.lock = {
    LOCK_PATH, CANNOT,
    isPrivatePath, isLockPath, isWrappedFiles, isSealed, isLockedItem,
    importRawKey, keyFromPrf,
    wrapFiles, unwrapFiles, wrapGif, unwrapGif,
    sealState, openState,
    canPasskeyLock, createLock, assertLock,
    createPassLock, passphraseKey, lockKind, keyFor, chooseAndCreate, askPassphrase,
    PASS_ITER, PASS_MIN, NO_PRF,
    sheet, showSheet,
    wrapAtRest, unwrapAtRest, makeDb, writeSealed,
    gateOpen, itemOfFile,
    session: {
      get: (id) => sessions.get(id) || null,
      set: (id, key) => sessions.set(id, key),
      del: (id) => sessions.delete(id),
    },
    // Test-only: a page may stuff a raw 32-byte PRF here to skip WebAuthn
    // when the virtual authenticator has no hmac-secret. Production never sets it.
    _prfOverride: null,
  };

  GifOS.seal = {
    FORMAT: 'GLK2', PASS_ITER, PASS_MIN,
    sealBytes: sealGlk2,
    openBytes: openAny,
    inspect: (blob) => { const i = inspect(blob); if (!i) return null; const o = { format: i.format, kind: i.kind }; if (i.kdf) { o.kdf = i.kdf; o.iter = i.iter; } return o; },
    sealGif, openGif, gifSecretKind,
    passphraseKey,
    askPassphrase,
    passkey: {
      available: canPasskeyLock,
      create: createLock,
      key: (meta) => assertLock(meta),
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
