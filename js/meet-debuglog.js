/*
 * meet-debuglog.js — the meeting's debug log, kept on this device.
 *
 * While debug logging is on, the meeting page copies its debug record (the
 * mesh trace, the debug rings and a periodic debugDump snapshot) into this
 * browser's own storage (IndexedDB), so it survives a reload, leaving the
 * meeting or closing the tab, and can be exported to a file afterwards.
 * Nothing here sends anything anywhere: the only way out is Export, which
 * the person presses.
 *
 * - The setting: off unless the person turned it on (remembered in
 *   localStorage as the word 'on' or 'off'), or the page's link carries
 *   DEBUG=on (that turns it on for that page only).
 * - Writes are batched: the recorder reads what the rings gained since the
 *   last batch every few seconds, never per event.
 * - The store is a ring with a size cap: when it is over the cap, the
 *   oldest batches go first.
 * - Every batch carries its session id, its time and the room id.
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};

  const SETTING_KEY = 'gifos_debug_log';
  const STICKY_KEY = 'gifos_debug';          // the tab's memory of a DEBUG=on link
  const CAP = 50 * 1024 * 1024;               // bytes kept across all sessions
  const URL_ON = /(?:^|[#&?])debug=(?:on|1|true)/i;

  // ---- the setting ------------------------------------------------------------
  // Stored as a word in both directions: 'on' or 'off'. Nothing stored means
  // the default, which is off.
  function readSetting(ls) {
    try { const v = ls && ls.getItem(SETTING_KEY); return v === 'on' ? 'on' : (v === 'off' ? 'off' : ''); } catch (e) { return ''; }
  }
  function saveSetting(ls, on) {
    try { if (ls) ls.setItem(SETTING_KEY, on ? 'on' : 'off'); return true; } catch (e) { return false; }
  }
  function urlAsks(href) { return URL_ON.test(String(href || '')); }
  // Is debug on for this page? The link turns it on for the page (and the tab
  // remembers that across the page's own reloads); otherwise the saved choice.
  function wanted(o) {
    o = o || {};
    if (o.url) return true;
    if (o.sticky) return true;
    return o.saved === 'on';
  }
  // Read everything from a page's own location and storage.
  function pageWants(env) {
    env = env || root;
    let href = '';
    try { href = String(env.location.hash || '') + String(env.location.search || ''); } catch (e) {}
    const url = urlAsks(href);
    let ss = null, ls = null;
    try { ss = env.sessionStorage; } catch (e) {}
    try { ls = env.localStorage; } catch (e) {}
    try { if (url && ss) ss.setItem(STICKY_KEY, '1'); } catch (e) {}
    let sticky = false;
    try { sticky = !!ss && ss.getItem(STICKY_KEY) === '1'; } catch (e) {}
    const saved = readSetting(ls);
    return { on: wanted({ url: url, sticky: sticky, saved: saved }), url: url, sticky: sticky, saved: saved };
  }
  // The person turned it off: off for the next page too, link memory included.
  function turnOff(env) {
    env = env || root;
    try { saveSetting(env.localStorage, false); } catch (e) {}
    try { env.sessionStorage.removeItem(STICKY_KEY); } catch (e) {}
  }

  // ---- size ---------------------------------------------------------------------
  const enc = (typeof TextEncoder !== 'undefined') ? new TextEncoder() : null;
  function byteLen(s) {
    s = String(s);
    if (enc) return enc.encode(s).length;
    let n = 0; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); n += c < 0x80 ? 1 : (c < 0x800 ? 2 : 3); }
    return n;
  }
  function fmtSize(b) {
    b = +b || 0;
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // ---- the ring ------------------------------------------------------------------
  // sizes: [[id, bytes], ...] oldest first. Returns the ids to drop, oldest
  // first, so the rest fits in cap. A single batch bigger than the cap is
  // dropped too: the cap is a promise about the disk.
  function dropPlan(sizes, cap) {
    let total = 0;
    for (const s of sizes) total += s[1];
    const out = [];
    for (let i = 0; i < sizes.length && total > cap; i++) { out.push(sizes[i][0]); total -= sizes[i][1]; }
    return { drop: out, total: total };
  }

  // A store over a backend with: put(rec) -> id, sizes() -> [[id, bytes]]
  // oldest first, del(ids), all() -> recs oldest first, clear(). The ring and
  // the cap live here, so every backend keeps the same promise.
  function makeStore(backend, opts) {
    opts = opts || {};
    const cap = opts.cap || CAP;
    let chain = Promise.resolve();
    const serial = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
    // The ring is measured in full when the running estimate passes the cap,
    // and every 30th batch anyway (another tab of this site writes here too).
    let known = -1, since = 0;
    async function trim(added) {
      if (known >= 0 && known + added <= cap && ++since < 30) { known += added; return known; }
      const plan = dropPlan(await backend.sizes(), cap);
      if (plan.drop.length) await backend.del(plan.drop);
      known = plan.total; since = 0;
      return plan.total;
    }
    return {
      cap: cap,
      append: (rec) => serial(async () => {
        const data = typeof rec.data === 'string' ? rec.data : JSON.stringify(rec.data);
        const bytes = byteLen(data);
        await backend.put({ sid: String(rec.sid || ''), room: rec.room == null ? '' : String(rec.room), t: rec.t || Date.now(), bytes: bytes, data: data });
        return trim(bytes);
      }),
      bytes: () => serial(async () => { let n = 0; for (const s of await backend.sizes()) n += s[1]; return n; }),
      sessions: () => serial(async () => {
        const by = new Map();
        for (const r of await backend.all()) {
          const s = by.get(r.sid) || { sid: r.sid, room: r.room, first: r.t, last: r.t, batches: 0, bytes: 0 };
          s.first = Math.min(s.first, r.t); s.last = Math.max(s.last, r.t); s.batches++; s.bytes += r.bytes;
          if (r.room) s.room = r.room;
          by.set(r.sid, s);
        }
        return Array.from(by.values());
      }),
      // NDJSON text parts: one header line, then one line per batch, oldest first.
      exportParts: (meta) => serial(async () => {
        const recs = await backend.all();
        const sessions = new Map();
        for (const r of recs) { const s = sessions.get(r.sid) || { sid: r.sid, room: r.room, first: r.t, last: r.t }; s.last = Math.max(s.last, r.t); sessions.set(r.sid, s); }
        const head = Object.assign({ gifosDebugLog: 1, exported: Date.now(), batches: recs.length, sessions: Array.from(sessions.values()) }, meta || {});
        const parts = [JSON.stringify(head) + '\n'];
        for (const r of recs) parts.push('{"sid":' + JSON.stringify(r.sid) + ',"room":' + JSON.stringify(r.room) + ',"t":' + (+r.t) + ',"batch":' + r.data + '}\n');
        return parts;
      }),
      clear: () => serial(() => { known = 0; since = 0; return backend.clear(); }),
    };
  }

  // In memory: the node units and a page with no IndexedDB.
  function memoryBackend() {
    let next = 1; const rows = new Map();
    return {
      put: async (r) => { const id = next++; rows.set(id, Object.assign({ id: id }, r)); return id; },
      sizes: async () => Array.from(rows.values()).map((r) => [r.id, r.bytes]),
      del: async (ids) => { for (const id of ids) rows.delete(id); },
      all: async () => Array.from(rows.values()),
      clear: async () => { rows.clear(); },
    };
  }

  // IndexedDB: one database, one store of batches with an index on their size,
  // so the ring is measured from the index keys without reading any text, and
  // a batch is one request that can commit at once (the way out of a page).
  function idbBackend(idb, name) {
    idb = idb || root.indexedDB;
    name = name || 'gifos-debug-log';
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const rq = idb.open(name, 1);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        const os = db.objectStoreNames.contains('batch') ? rq.transaction.objectStore('batch') : db.createObjectStore('batch', { keyPath: 'id', autoIncrement: true });
        if (!os.indexNames.contains('bytes')) os.createIndex('bytes', 'bytes');
      };
      rq.onsuccess = () => { const db = rq.result; db.onversionchange = () => { try { db.close(); } catch (e) {} dbp = null; }; res(db); };
      rq.onerror = () => { dbp = null; rej(rq.error); };
      rq.onblocked = () => { dbp = null; rej(new Error('debug log store blocked')); };
    }));
    const tx = (mode, fn) => open().then((db) => new Promise((res, rej) => {
      const t = db.transaction(['batch'], mode); const box = {};
      t.oncomplete = () => res(box.v); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('abort'));
      fn(t.objectStore('batch'), box);
      if (mode === 'readwrite' && typeof t.commit === 'function') { try { t.commit(); } catch (e) {} }
    }));
    return {
      put: (r) => tx('readwrite', (os, box) => { const rq = os.add(r); rq.onsuccess = () => { box.v = rq.result; }; }),
      sizes: () => tx('readonly', (os, box) => {
        const out = box.v = [];
        const rq = os.index('bytes').openKeyCursor();
        rq.onsuccess = () => { const c = rq.result; if (!c) return; out.push([c.primaryKey, c.key]); c.continue(); };
      }).then((v) => (v || []).sort((x, y) => x[0] - y[0])),
      del: (ids) => tx('readwrite', (os) => { for (const id of ids) os.delete(id); }),
      all: () => tx('readonly', (os, box) => { const rq = os.getAll(); rq.onsuccess = () => { box.v = rq.result; }; })
        .then((v) => (v || []).sort((x, y) => x.id - y.id)),
      clear: () => tx('readwrite', (os) => { os.clear(); }),
    };
  }

  // ---- the recorder ---------------------------------------------------------------
  // rings(): { name: array } of the page's live debug rings. Each batch takes
  // what each ring gained since the last batch (by the last item it wrote, so
  // a ring that shifts its oldest items still reads right). snapshot() is a
  // bigger picture (debugDump), taken every snapEvery ms and on the way out.
  function createRecorder(o) {
    const store = o.store, every = o.every || 5000, snapEvery = o.snapEvery || 30000;
    const now = o.now || (() => Date.now());
    const setT = o.setInterval || ((f, ms) => setInterval(f, ms)), clrT = o.clearInterval || ((h) => clearInterval(h));
    const sid = o.sid || (now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));
    const lastOf = new Map();
    let timer = null, lastSnap = -Infinity, live = false, busy = null;   // the first batch carries a snapshot
    function gained(name, arr) {
      if (!Array.isArray(arr) || !arr.length) return [];
      const last = lastOf.get(name);
      const i = last === undefined ? -1 : arr.lastIndexOf(last);
      const out = i >= 0 ? arr.slice(i + 1) : arr.slice();
      if (out.length) lastOf.set(name, out[out.length - 1]);
      return out;
    }
    function collect(forceSnap) {
      const b = {}; let n = 0;
      let R = {}; try { R = (o.rings && o.rings()) || {}; } catch (e) {}
      for (const k of Object.keys(R)) { const g = gained(k, R[k]); if (g.length) { b[k] = g; n += g.length; } }
      const t = now();
      if (o.snapshot && (forceSnap || t - lastSnap >= snapEvery)) {
        lastSnap = t;
        try { b.snapshot = o.snapshot(); n++; } catch (e) { b.snapshot = { err: String(e).slice(0, 80) }; n++; }
      }
      return n ? b : null;
    }
    function flush(forceSnap) {
      if (!live) return Promise.resolve(null);
      const b = collect(!!forceSnap);
      if (!b) return Promise.resolve(null);
      let room = ''; try { room = o.room ? String(o.room() || '') : ''; } catch (e) {}
      busy = store.append({ sid: sid, room: room, t: now(), data: b }).catch(() => null);
      return busy;
    }
    return {
      sid: sid,
      start() { if (live) return; live = true; timer = setT(() => { flush(false); }, every); },
      stop() { live = false; if (timer != null) clrT(timer); timer = null; },
      live: () => live,
      flush: flush,
    };
  }

  // ---- caption lines (export v2) ---------------------------------------------------
  // The export answers "who wrote this caption line, how, and what came of it"
  // without the words. One record per caption line this page took, sent or
  // dropped, and one per change in a peer's caption state. Fields:
  //   by    the voice the line is for (6 characters of the id)
  //   w     the writer: the page whose engine heard it
  //   src   'mic' (the writer's own voice), 'ear' (a voice it heard first-hand), 'mix'
  //   eng   the writer's engine: 'browser' (Web Speech), 'whisper', 'local' (the
  //         phone's on-device model), 'native' (the Meet app's engine); '' unknown
  //         (a line from a page older than the export v2)
  //   inp   what that engine heard: 'mic' (the raw microphone: the system default,
  //         not the call's track), 'track' (the call's own echo-cancelled track),
  //         'mix' (the room-ear mix of call tracks), 'rx' (received audio)
  //   dev / cdev  this page's own lines only: the device the engine listened to
  //         ('default' for the raw microphone) and the call mic's device
  //   dm    1 the engine heard the call's mic device, 0 another device, null unknown
  //   lang, ld  the line's language, and 1 when the engine detected it
  //   res   what this page did: kept, sent, dup, floor, en, rate, gate (the page's
  //         own echo gate threw it away), mute
  // Never the line's text.
  const CAP_ENG = ['browser', 'whisper', 'local', 'native'];
  const CAP_INP = ['mic', 'track', 'mix', 'rx'];
  const CAP_SRC = ['mic', 'ear', 'mix'];
  const CAP_LINE_KEYS = ['t', 'k', 'by', 'w', 'src', 'eng', 'inp', 'dev', 'cdev', 'dm', 'lang', 'ld', 'tl', 'at', 'end', 'res', 'nt'];
  const CAP_PEER_KEYS = ['t', 'k', 'id', 'cap', 'ccst', 'lang', 'muted', 'trs'];
  const CAP_RING_MAX = 2000;
  const id6 = (v) => (v === undefined || v === null ? '' : String(v).slice(0, 6));
  const dev8 = (v) => (v === undefined || v === null ? '' : String(v).slice(0, 8));
  const oneOf = (v, list) => (list.indexOf(v) >= 0 ? v : '');
  function capLineRec(line, o) {
    line = line || {}; o = o || {};
    const dm = line.dm === 1 || line.dm === true ? 1 : (line.dm === 0 || line.dm === false ? 0 : null);
    return {
      t: typeof o.t === 'number' ? o.t : Date.now(), k: 'line',
      by: id6(line.byId), w: id6(line.w), src: oneOf(line.src, CAP_SRC),
      eng: oneOf(line.eng, CAP_ENG), inp: oneOf(line.inp, CAP_INP),
      dev: dev8(o.dev), cdev: dev8(o.cdev), dm: dm,
      lang: String(line.lang || '').slice(0, 8), ld: line.ld ? 1 : 0, tl: line.tl ? 1 : 0,
      at: Number(line.at) || 0, end: Number(line.end) || 0,
      res: String(o.res || '').slice(0, 8),
      nt: String(line.nt || '').slice(0, 5),
    };
  }
  function capPeerRec(id, st, o) {
    st = st || {}; o = o || {};
    return {
      t: typeof o.t === 'number' ? o.t : Date.now(), k: 'peer', id: id6(id),
      cap: st.cap === 1 ? 1 : 0, ccst: String(st.ccst || '').slice(0, 8), lang: String(st.lang || '').slice(0, 8),
      muted: st.muted ? 1 : 0, trs: st.trs ? 1 : 0,
    };
  }
  // A status worth a record: the first one from a peer, or one whose caption state moved.
  function capPeerMoved(prev, next) {
    if (!next) return false;
    if (!prev) return true;
    return (prev.cap === 1) !== (next.cap === 1) || String(prev.ccst || '') !== String(next.ccst || '')
      || String(prev.lang || '') !== String(next.lang || '') || !!prev.muted !== !!next.muted;
  }
  function capPush(ring, rec, max) {
    if (!Array.isArray(ring) || !rec) return ring;
    ring.push(rec);
    const cap = max || CAP_RING_MAX;
    if (ring.length > cap) ring.splice(0, ring.length - cap);
    return ring;
  }
  // Did the engine hear the call's own mic? The raw microphone is the system
  // default; it is the call's device when the default input's group is the
  // call track's group (or the call track itself is the default).
  function capDevMatch(eng, call, defGroup) {
    eng = eng || {}; call = call || {};
    if (eng.dev && eng.dev !== 'default') return call.dev ? (eng.dev === call.dev ? 1 : 0) : null;
    if (call.dev === 'default') return 1;
    if (!call.group || !defGroup) return null;
    return call.group === defGroup ? 1 : 0;
  }

  // ---- export -----------------------------------------------------------------------
  function fileName(t) {
    const d = new Date(t || Date.now()), p = (n) => String(n).padStart(2, '0');
    return 'gifos-debug-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '.ndjson';
  }
  // A Blob of the whole log, gzip when the browser can (CompressionStream).
  async function exportBlob(store, meta) {
    const parts = await store.exportParts(meta);
    const plain = new Blob(parts, { type: 'application/x-ndjson' });
    if (typeof CompressionStream === 'function' && plain.stream) {
      try {
        const gz = await new Response(plain.stream().pipeThrough(new CompressionStream('gzip'))).blob();
        return { blob: new Blob([gz], { type: 'application/gzip' }), gzip: true };
      } catch (e) {}
    }
    return { blob: plain, gzip: false };
  }

  const api = {
    SETTING_KEY: SETTING_KEY, STICKY_KEY: STICKY_KEY, CAP: CAP,
    readSetting: readSetting, saveSetting: saveSetting, urlAsks: urlAsks, wanted: wanted, pageWants: pageWants, turnOff: turnOff,
    byteLen: byteLen, fmtSize: fmtSize, dropPlan: dropPlan,
    makeStore: makeStore, memoryBackend: memoryBackend, idbBackend: idbBackend,
    createRecorder: createRecorder, fileName: fileName, exportBlob: exportBlob,
    CAP_LINE_KEYS: CAP_LINE_KEYS, CAP_PEER_KEYS: CAP_PEER_KEYS, CAP_RING_MAX: CAP_RING_MAX,
    capLineRec: capLineRec, capPeerRec: capPeerRec, capPeerMoved: capPeerMoved, capPush: capPush, capDevMatch: capDevMatch,
  };
  GifOS.debugLog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
