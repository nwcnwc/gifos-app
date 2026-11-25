/*
 * gifos-avatar.js — the picture stored next to the screen name.
 *
 * A GIF is kept byte for byte (it must stay animated; this file never
 * redraws one). A still is scaled down in the browser. Peers receive the
 * picture as small data-channel messages, not as one blob and not on the
 * signaling relay.
 */
(function (root) {
  const GifOS = (root.GifOS = root.GifOS || {});
  const MAX_INPUT = 2 * 1024 * 1024;
  const MAX_GIF = 256 * 1024;
  const MAX_EDGE = 256;
  const MAX_STILL = 64 * 1024;
  const MAX_CHUNK_JSON = 16384;
  const MIMES = ['image/gif', 'image/png', 'image/jpeg', 'image/webp'];

  function u8(bytes) {
    return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  }
  function sniff(bytes) {
    const b = u8(bytes);
    if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x39 || b[4] === 0x37) && b[5] === 0x61) return 'image/gif';
    if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
    return '';
  }
  function gifSize(bytes) {
    const b = u8(bytes);
    if (sniff(b) !== 'image/gif' || b.length < 10) return null;
    return { w: b[6] | (b[7] << 8), h: b[8] | (b[9] << 8) };
  }
  function judge(bytes) {
    const b = u8(bytes);
    if (b.length > MAX_INPUT) return { ok: false, error: 'This file is over 2 MB. Choose a smaller picture.' };
    const mime = sniff(b);
    if (!mime) return { ok: false, error: 'Choose a GIF, PNG, JPG, or WebP.' };
    if (mime !== 'image/gif') return { ok: true, mime: mime, still: true, bytes: b };
    if (b.length > MAX_GIF) {
      const kb = Math.max(1, Math.ceil(b.length / 1024));
      return { ok: false, error: 'This GIF is ' + kb + ' KB. GIFs must be 256 KB or smaller — GifOS keeps them animated and does not shrink them.' };
    }
    const sz = gifSize(b);
    if (!sz || !sz.w || !sz.h) return { ok: false, error: 'This GIF could not be read.' };
    if (sz.w > MAX_EDGE || sz.h > MAX_EDGE) {
      return { ok: false, error: 'This GIF is ' + sz.w + 'x' + sz.h + '. GIFs must be 256 pixels or less on the long side — GifOS keeps them animated and does not shrink them.' };
    }
    return { ok: true, mime: 'image/gif', w: sz.w, h: sz.h, bytes: b };
  }
  function prepareBytes(bytes) {
    const b = u8(bytes);
    const j = judge(b);
    if (!j.ok) return j;
    if (j.mime === 'image/gif') return { ok: true, mime: 'image/gif', bytes: b, w: j.w, h: j.h };
    return { ok: false, error: 'Shrinking a still picture needs a browser.' };
  }
  // One btoa of the whole binary string. btoa() on each 8192-byte slice
  // inserts '=' padding (8192 % 3 !== 0), and atob() rejects '=' mid-string.
  function toB64(bytes) {
    const b = u8(bytes);
    const parts = [];
    for (let i = 0; i < b.length; i += 8192) {
      const slice = b.subarray(i, Math.min(i + 8192, b.length));
      let bin = '';
      for (let j = 0; j < slice.length; j++) bin += String.fromCharCode(slice[j]);
      parts.push(bin);
    }
    return btoa(parts.join(''));
  }
  function fromB64(s) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function hashBytes(bytes) {
    const b = u8(bytes);
    const buf = (b.byteOffset === 0 && b.byteLength === b.buffer.byteLength) ? b : b.slice();
    return root.crypto.subtle.digest('SHA-256', buf).then((dig) => {
      return Array.from(new Uint8Array(dig)).map((x) => x.toString(16).padStart(2, '0')).join('');
    });
  }
  // qualities are a fixed list so a 0.5 cutoff in a test encoder is reached
  function shrinkStill(srcW, srcH, encode) {
    let w = Math.max(1, srcW | 0);
    let h = Math.max(1, srcH | 0);
    const edge = Math.max(w, h);
    if (edge > MAX_EDGE) {
      const s = MAX_EDGE / edge;
      w = Math.max(1, Math.round(w * s));
      h = Math.max(1, Math.round(h * s));
    }
    const qualities = [0.85, 0.7, 0.55, 0.4];
    const mimes = ['image/webp', 'image/jpeg'];
    for (let pass = 0; pass < 6; pass++) {
      for (let mi = 0; mi < mimes.length; mi++) {
        const mime = mimes[mi];
        for (let qi = 0; qi < qualities.length; qi++) {
          let bytes = null;
          try { bytes = encode(w, h, qualities[qi], mime); } catch (e) { bytes = null; }
          if (bytes && bytes.length <= MAX_STILL && Math.max(w, h) <= MAX_EDGE) {
            return { ok: true, bytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), w: w, h: h, mime: mime };
          }
        }
      }
      if (Math.max(w, h) <= 48) break;
      w = Math.max(1, Math.round(w * 0.75));
      h = Math.max(1, Math.round(h * 0.75));
    }
    return { ok: false, error: 'Could not shrink this picture under 64 KB.' };
  }
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new root.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('unreadable'));
      img.src = url;
    });
  }
  async function prepareStill(bytes) {
    if (!root.document || !root.document.createElement) return { ok: false, error: 'Shrinking a still picture needs a browser.' };
    const blobUrl = root.URL.createObjectURL(new root.Blob([bytes]));
    let img;
    try { img = await loadImage(blobUrl); }
    catch (e) { try { root.URL.revokeObjectURL(blobUrl); } catch (e2) {} return { ok: false, error: 'Could not shrink this picture under 64 KB.' }; }
    try { root.URL.revokeObjectURL(blobUrl); } catch (e) {}
    const res = shrinkStill(img.naturalWidth || 1, img.naturalHeight || 1, (w, h, q, mime) => {
      const c = root.document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      if (!g) return null;
      g.drawImage(img, 0, 0, w, h);
      const want = mime === 'image/webp' ? 'image/webp' : 'image/jpeg';
      let data = '';
      try { data = c.toDataURL(want, q); } catch (e) { return null; }
      if (data.indexOf(want) < 0) return null;
      const comma = data.indexOf(',');
      if (comma < 0) return null;
      try { return fromB64(data.slice(comma + 1)); } catch (e) { return null; }
    });
    if (!res.ok) return res;
    const hash = await hashBytes(res.bytes);
    return { ok: true, mime: res.mime, hash: hash, b64: toB64(res.bytes), bytes: res.bytes, w: res.w, h: res.h };
  }
  async function finish(bytes, judged) {
    if (judged.mime === 'image/gif') {
      const hash = await hashBytes(bytes);
      return { ok: true, mime: 'image/gif', hash: hash, b64: toB64(bytes), bytes: bytes, w: judged.w, h: judged.h };
    }
    return prepareStill(bytes);
  }
  async function prepareFile(file) {
    if (!file) return { ok: false, error: 'Choose a GIF, PNG, JPG, or WebP.' };
    if ((file.size | 0) > MAX_INPUT) return { ok: false, error: 'This file is over 2 MB. Choose a smaller picture.' };
    const bytes = u8(await file.arrayBuffer());
    if (bytes.length > MAX_INPUT) return { ok: false, error: 'This file is over 2 MB. Choose a smaller picture.' };
    const judged = judge(bytes);
    if (!judged.ok) return judged;
    return finish(bytes, judged);
  }
  async function prepareDataUrl(url) {
    const m = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(url || ''));
    if (!m) return { ok: false, error: 'Choose a GIF, PNG, JPG, or WebP.' };
    let bytes;
    try { bytes = fromB64(m[2]); } catch (e) { return { ok: false, error: 'Choose a GIF, PNG, JPG, or WebP.' }; }
    if (bytes.length > MAX_INPUT) return { ok: false, error: 'This file is over 2 MB. Choose a smaller picture.' };
    const judged = judge(bytes);
    if (!judged.ok) return judged;
    return finish(bytes, judged);
  }
  function chunks(bytes, meta) {
    const b = u8(bytes);
    if (b.length > MAX_GIF) return [];
    const h = String((meta && meta.hash) || '');
    const mime = String((meta && meta.mime) || '');
    const b64 = toB64(b);
    const overhead = JSON.stringify({ k: 'av', h: h, mime: mime, i: 100, n: 100, b: '' }).length;
    const room = MAX_CHUNK_JSON - overhead;
    if (room < 64) return [];
    const parts = [];
    for (let i = 0; i < b64.length; i += room) parts.push(b64.slice(i, i + room));
    if (!parts.length) parts.push('');
    if (parts.length > 64) return [];
    return parts.map((piece, i) => ({ k: 'av', h: h, mime: mime, i: i, n: parts.length, b: piece }));
  }
  function join(msgs) {
    const sorted = msgs.slice().sort((a, b) => a.i - b.i);
    return fromB64(sorted.map((m) => m.b).join(''));
  }
  function makeInbox() {
    const bags = new Map();
    return {
      push(msg) {
        if (!msg || msg.k !== 'av') return { error: 'not a picture' };
        if (msg.clear) return { clear: true, hash: '' };
        if (typeof msg.b !== 'string' || msg.b.length > MAX_CHUNK_JSON) return { error: 'chunk too large' };
        const n = msg.n | 0;
        const i = msg.i | 0;
        if (n < 1 || n > 64 || i < 0 || i >= n) return { error: 'bad chunk index' };
        const mime = String(msg.mime || '');
        if (MIMES.indexOf(mime) < 0) return { error: 'bad type' };
        const h = String(msg.h || '');
        if (!/^[0-9a-f]{64}$/.test(h)) return { error: 'bad hash' };
        let bag = bags.get(h);
        if (!bag || bag.n !== n || bag.mime !== mime) {
          bag = { n: n, mime: mime, parts: new Array(n), got: 0 };
          bags.set(h, bag);
        }
        if (bag.parts[i] != null) return null;
        bag.parts[i] = msg.b;
        bag.got++;
        if (bag.got < n) return null;
        let bytes;
        try { bytes = fromB64(bag.parts.join('')); }
        catch (e) { bags.delete(h); return { error: 'bad base64' }; }
        bags.delete(h);
        if (bytes.length > MAX_GIF) return { error: 'avatar over 256 KB' };
        return { done: true, bytes: bytes, mime: mime, hash: h };
      },
    };
  }
  function chunkDelay(buffered) {
    return (buffered || 0) > 65536 ? 200 : 40;
  }

  GifOS.avatar = {
    sniff: sniff, gifSize: gifSize, judge: judge, prepareBytes: prepareBytes, prepareFile: prepareFile,
    prepareDataUrl: prepareDataUrl, chunks: chunks, join: join, hashBytes: hashBytes, toB64: toB64, fromB64: fromB64,
    shrinkStill: shrinkStill, makeInbox: makeInbox, chunkDelay: chunkDelay,
    MAX_INPUT: MAX_INPUT, MAX_GIF: MAX_GIF, MAX_EDGE: MAX_EDGE, MAX_STILL: MAX_STILL,
  };
})(typeof window !== 'undefined' ? window : globalThis);
