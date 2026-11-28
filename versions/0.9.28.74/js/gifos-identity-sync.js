/*
 * gifos-identity-sync.js — "Sync across my devices". Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * ONE CONCEPT: devices that hold the same identity keep each other current. The sync key (js/gifos-identity.js, the
 * record sync/key, made when the person turns the setting on and carried inside the sealed GIF) is the only secret:
 *   room     a DATA ROOM: an ordinary room whose name and verifier are made from the key, so only holders find it. No media,
 *            no Stage, no tiles: a hidden door (js/meet-host.js, listen) that carries data frames and nothing else.
 *   seal     every frame is sealed under a key made from the sync key (a separate key for each sending device), bound to
 *            the sync id, the generation, the sender and the message. The relay sees an opaque room name and nothing else.
 *   merge    the EXISTING identity merge (GifOS.identity.take: per record, the later stamp wins; a removal is a tombstone).
 *            Nothing here decides who is right; it only moves records.
 *   digest   two devices that hold the same records (the same id, stamp, writer and removal, and the same sync key) have
 *            the same digest. A device says its digest when it connects and whenever it changes; a different digest is
 *            answered with the records the other side lacks or holds older. After a merge a device says its new digest,
 *            and a device that hears its own digest back says nothing more: converged devices send no frames.
 *   relay    the relay is an introduction. Once every device this identity knows is here and has the same digest (or
 *            the exchange finished with whoever is present), the HOLDER (this file's second half) lets the relay go;
 *            it comes back when a channel is lost, when something changes here that someone has not heard, and slowly to
 *            look for devices it has not met (SYNC_BACKOFF_*).
 *
 * The wire is versioned and typed so that any GIF can sync the same way later: every frame carries { v, sid, gen,
 * from, id, i, of, d }; `sid` names WHAT syncs (the identity today, a GIF's own id later), the sealed message has a
 * type (unknown types are ignored), the digest is { alg, path, hash } (path '' is the whole set: a folder is a smaller
 * path), and a record is addressed by id with its own merge rule in the part that owns it.
 *
 * part(host)    the part inside the data room's page (it rides the meeting's My Room channel, ops that start with 'sy').
 * holder()      the page that holds the room: one tab per browser (a Web Lock), joins, watches the part, lets go, comes back.
 * Attaches to `GifOS.identitySync`.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  if (GifOS.identitySync) return;

  const V = 1;
  const SID = 'identity';                // what syncs here. A GIF's own id later; a frame for another sid is not mine.
  const CHUNK = 12000;                   // one frame's share of a message (under a data channel's message size)
  const MAX_MSG = 6 * 1024 * 1024;       // a message larger than this is not sync (flood bound)
  const MAX_ASM = 6;                     // messages being put together per sender
  const MAX_MAP = 20000;                 // records a digest map may name
  const MAX_ROUNDS = 8;                  // times one pair may still differ after exchanging before it is called a mismatch
  const T = () => GifOS.timings || {};
  const ID = () => GifOS.identity;
  const subtle = () => root.crypto.subtle;
  const enc = (s) => new TextEncoder().encode(s);
  const dec = (u) => new TextDecoder().decode(u);
  const b64 = (u) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return root.btoa(s); };
  const unb64 = (t) => { const s = root.atob(String(t)); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const hex = (u) => Array.from(u).map((b) => b.toString(16).padStart(2, '0')).join('');
  const rand = (n) => { const u = new Uint8Array(n); root.crypto.getRandomValues(u); return u; };

  // ---- keys: one sync key, separate labels for each use (name, verifier, seal, sync id) -----------------------------
  const kdfCache = new Map();
  async function hkdf(k, gen, label, bytes) {
    const base = await subtle().importKey('raw', unb64(k), 'HKDF', false, ['deriveBits']);
    const bits = await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: enc('gifos-sync/v1'), info: enc('gifos-sync/v1|' + label + '|gen=' + gen) }, base, bytes * 8);
    return new Uint8Array(bits);
  }
  // derive(k, gen) -> { room, v, sid-free names } : the data room's name and verifier. Only holders of k can make them.
  async function derive(k, gen) {
    const ck = k + '|' + gen; if (kdfCache.has(ck)) return kdfCache.get(ck);
    const p = (async () => ({ room: 'sy-' + hex(await hkdf(k, gen, 'room', 16)), v: hex(await hkdf(k, gen, 'verifier', 16)) }))();
    kdfCache.set(ck, p); if (kdfCache.size > 8) kdfCache.delete(kdfCache.keys().next().value);
    return p;
  }
  const sealKeys = new Map();   // k|gen|sender -> CryptoKey: each sending device seals under its own key
  async function sealKey(k, gen, sender) {
    const ck = k + '|' + gen + '|' + sender; if (sealKeys.has(ck)) return sealKeys.get(ck);
    const p = (async () => subtle().importKey('raw', await hkdf(k, gen, 'seal|' + sender, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']))();
    sealKeys.set(ck, p); if (sealKeys.size > 32) sealKeys.delete(sealKeys.keys().next().value);
    return p;
  }
  const aad = (gen, from, id) => enc('gifos-sync/v1|' + SID + '|' + gen + '|' + from + '|' + id);
  async function sealMsg(k, gen, from, id, obj) {
    const iv = rand(12), ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aad(gen, from, id) }, await sealKey(k, gen, from), enc(JSON.stringify(obj))));
    const out = new Uint8Array(12 + ct.length); out.set(iv, 0); out.set(ct, 12);
    return b64(out);
  }
  async function openMsg(k, gen, from, id, text) {
    const u = unb64(text); if (u.length < 29) throw new Error('short');
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12), additionalData: aad(gen, from, id) }, await sealKey(k, gen, from), u.subarray(12));
    return JSON.parse(dec(new Uint8Array(pt)));
  }

  // ---- the digest: exactly what the merge compares ------------------------------------------------------------------
  // A map names every record by id: [stamp, writer, removed?, (the sync key: its generation and key)]. The digest is the
  // hash of the sorted map, so two devices that merged to the same state have the same digest and no other.
  function mapOf(recs) {
    const m = {};
    for (const rid of Object.keys(recs)) {
      const r = recs[rid]; if (!r || typeof r.t !== 'number') continue;
      const e = [r.t, String(r.w || ''), r.d ? 1 : 0];
      if (rid === 'sync/key') { e.push(r.d ? +r.gen || 0 : (r.v && +r.v.gen) || 0); if (!r.d && r.v) e.push(String(r.v.k)); }
      m[rid] = e;
    }
    return m;
  }
  async function digestOf(map) {
    const lines = Object.keys(map).sort().map((rid) => rid + '|' + map[rid].join('|'));
    const h = new Uint8Array(await subtle().digest('SHA-256', enc(lines.join('\n'))));
    return { alg: 'sha256', path: '', hash: hex(h.subarray(0, 16)) };
  }
  // The records of mine that the other side lacks or holds older (the same order the merge uses: later stamp, then writer).
  function wanted(mine, theirs) {
    const out = [];
    for (const rid of Object.keys(mine)) {
      const a = mine[rid], b = theirs[rid];
      if (!b) { out.push(rid); continue; }
      if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3] || a[4] !== b[4]) out.push(rid);
    }
    return out;
  }
  const okMap = (m) => {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return false;
    const ks = Object.keys(m); if (ks.length > MAX_MAP) return false;
    return ks.every((k) => k.length <= 200 && Array.isArray(m[k]) && m[k].length >= 3 && m[k].length <= 5 && typeof m[k][0] === 'number' && typeof m[k][1] === 'string');
  };

  // ---- the part: one data room's side of the exchange ---------------------------------------------------------------
  // host: { send(pid, frame), reach() -> pids with an open channel, now(), key() -> { k, gen } | null, relay?(on), log?(line) }
  // The frames ride the meeting's My Room channel: {op:'sy', v, sid, gen, from, id, i, of, d}.
  function part(host) {
    const log = (l) => { try { if (host.log) host.log(l); } catch (e) {} };
    const peers = new Map();   // pid -> { dev, dg (their last digest), told (the digest I last said to them), acked, rounds, at }
    const asm = new Map();     // from|id -> { of, got, n, gen, pid }
    const stats = { sent: 0, got: 0, took: 0, bad: 0 };
    let mine = null;           // { map, dg, recs, dev, devices } as of the last look
    let lastSync = 0, busy = false, again = false;

    async function look() {
      const v = ID().syncView(); if (!v) { mine = null; return null; }
      const map = mapOf(v.recs), dg = await digestOf(map);
      const changed = !mine || mine.dg.hash !== dg.hash;
      mine = { map, dg, recs: v.recs, dev: v.dev, devices: v.devices };
      return changed;
    }
    async function say(pid, obj) {
      const key = host.key(); if (!key) return;
      const id = hex(rand(6)), text = await sealMsg(key.k, key.gen, mine.dev, id, obj), of = Math.max(1, Math.ceil(text.length / CHUNK));
      for (let i = 0; i < of; i++) { host.send(pid, { op: 'sy', v: V, sid: SID, gen: key.gen, from: mine.dev, id, i, of, d: text.slice(i * CHUNK, (i + 1) * CHUNK) }); stats.sent++; }
    }
    async function hello(pid) {
      const p = peers.get(pid); if (!p || !mine) return;
      p.told = mine.dg.hash;
      await say(pid, { t: 'hello', dg: mine.dg, map: mine.map, devs: mine.devices });
    }
    async function push(pid, ids) {
      if (!ids.length) return;
      const recs = {}; for (const rid of ids) recs[rid] = mine.recs[rid];
      await say(pid, { t: 'recs', r: recs });
    }
    // The whole step: look at this device's records, greet a new channel, say a changed digest, drop a lost channel.
    async function step() {
      if (busy) { again = true; return; }
      busy = true;
      try {
        do {
          again = false;
          const key = host.key(); if (!key) { peers.clear(); mine = null; break; }
          const changed = await look(); if (!mine) break;
          const here = new Set(host.reach());
          for (const pid of Array.from(peers.keys())) if (!here.has(pid)) { peers.delete(pid); log('SYNC channel lost ' + pid.slice(0, 6)); }
          for (const pid of here) if (!peers.has(pid)) { peers.set(pid, { dev: '', dg: '', told: '', acked: false, rounds: 0, at: host.now() }); }
          for (const [pid, p] of peers) if (p.told !== mine.dg.hash) { p.acked = false; await hello(pid); }   // new channel, or my digest changed: tell them
          void changed;
        } while (again);
      } catch (e) { log('SYNC step failed: ' + String(e && e.message || e)); } finally { busy = false; }
    }
    async function onHello(pid, m) {
      const p = peers.get(pid); if (!p || !m.dg || typeof m.dg.hash !== 'string' || !okMap(m.map)) { stats.bad++; return; }
      p.dev = String(m.dev || p.dev || ''); p.dg = m.dg.hash; p.theirs = m.map;
      await look();
      if (!mine) return;
      if (p.dg === mine.dg.hash) {   // the same records: agreed. A hello that is no answer is answered once, so each side hears the agreement.
        p.acked = true; p.rounds = 0; lastSync = host.now();
        if (!m.re) { p.told = mine.dg.hash; await say(pid, { t: 'hello', re: 1, dg: mine.dg, map: {}, devs: mine.devices }); }
        return;
      }
      p.acked = false;
      if (++p.rounds > MAX_ROUNDS) { log('SYNC mismatch ' + pid.slice(0, 6) + ' after ' + MAX_ROUNDS + ' rounds'); return; }
      await push(pid, wanted(mine.map, m.map));   // what they lack or hold older
      // They may hold what I lack and can only know it from MY map (a hello changes nothing for a side whose digest it already
      // had told): answer with mine, once (a reply is never answered), so they push what I am missing.
      if (!m.re) { p.told = mine.dg.hash; await say(pid, { t: 'hello', re: 1, dg: mine.dg, map: mine.map, devs: mine.devices }); }
    }
    async function onRecs(pid, m) {
      const p = peers.get(pid); if (!p || !m.r || typeof m.r !== 'object') { stats.bad++; return; }
      const recs = {}; let n = 0;
      for (const rid of Object.keys(m.r)) { if (++n > MAX_MAP) break; recs[rid] = m.r[rid]; }
      ID().scan();
      const r = ID().take({ kind: 'gifos-identity', v: 1, recs });
      stats.took += r.news.length;
      lastSync = host.now();
      log('SYNC took ' + r.news.length + ' from ' + pid.slice(0, 6));
      await step();   // my digest may have changed: say so
    }
    async function onMsg(pid, f) {
      try {
        if (!f || f.op !== 'sy' || f.v !== V || f.sid !== SID || typeof f.from !== 'string' || typeof f.id !== 'string' || !(f.of >= 1 && f.of <= 600) || !(f.i >= 0 && f.i < f.of) || typeof f.d !== 'string' || f.d.length > CHUNK + 8) { stats.bad++; return; }
        const key = host.key(); if (!key || f.gen !== key.gen) { stats.bad++; return; }   // another generation is not mine
        if (!peers.has(pid)) await step();
        const ak = f.from + '|' + f.id; let a = asm.get(ak);
        if (!a) { if (asm.size >= MAX_ASM * 4) asm.delete(asm.keys().next().value); a = { of: f.of, got: [], n: 0, size: 0 }; asm.set(ak, a); }
        if (a.of !== f.of) { stats.bad++; return; }
        if (a.got[f.i] == null) { a.got[f.i] = f.d; a.n++; a.size += f.d.length; }
        if (a.size > MAX_MSG) { asm.delete(ak); stats.bad++; return; }
        if (a.n < a.of) return;
        asm.delete(ak); stats.got++;
        let msg; try { msg = await openMsg(key.k, key.gen, f.from, f.id, a.got.join('')); } catch (e) { stats.bad++; return; }   // not sealed under this key
        const p = peers.get(pid); if (p && !p.dev) p.dev = f.from;
        if (msg && msg.t === 'hello') await onHello(pid, Object.assign({ dev: f.from }, msg));
        else if (msg && msg.t === 'recs') await onRecs(pid, msg);
        // any other type: a newer page's, ignored
      } catch (e) { log('SYNC frame failed: ' + String(e && e.message || e)); }
    }
    // state() -> what the holder and the status line read.
    function state() {
      const list = Array.from(peers, ([pid, p]) => ({ pid, dev: p.dev, acked: !!p.acked }));
      const known = mine ? mine.devices.filter((d) => d !== mine.dev) : [];
      const seen = new Set(list.filter((x) => x.acked && x.dev).map((x) => x.dev));
      return { on: !!host.key(), peers: list, known, missing: known.filter((d) => !seen.has(d)).length, converged: list.length > 0 && list.every((x) => x.acked), dirty: list.some((x) => !x.acked), lastSync, dg: mine ? mine.dg.hash : '', stats: Object.assign({}, stats) };
    }
    // relay(on): ask the meeting page for its relay socket (off: it lets it go once seated; the channels stay).
    function relay(on) { try { if (host.relay) host.relay(!!on); } catch (e) {} }
    return { step, onMsg, state, tick: step, relay };
  }

  // The status line's source: the holding tab writes it, every tab's sheet reads it (a setting about THIS device, never a record).
  const STATUS_KEY = 'gifos_sync_status';
  function writeStatus(st) { try { root.localStorage.setItem(STATUS_KEY, JSON.stringify({ on: !!st.on, here: st.here || 0, others: st.others || 0, at: st.at || 0, waiting: !!st.waiting })); } catch (e) {} }
  // words() -> the one line a person reads: 'Synced with 1 other device · just now' or 'Waiting for your other devices'.
  function words(st, now) {
    if (!st || !st.on) return '';
    if (!st.here) return 'Waiting for your other devices';
    const ago = st.at ? Math.max(0, (now || Date.now()) - st.at) : 0, m = Math.floor(ago / 60000);
    const when = !st.at || ago < 60000 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.floor(m / 60) + ' h ago' : Math.floor(m / 1440) + ' d ago';
    return 'Synced with ' + st.here + ' other device' + (st.here === 1 ? '' : 's') + ' \u00b7 ' + when;
  }
  function readStatus() { try { return JSON.parse(root.localStorage.getItem(STATUS_KEY) || 'null'); } catch (e) { return null; } }

  // ---- the holder: the page that keeps the data room open ------------------------------------------------------------
  // One tab per browser (a Web Lock named gifos-identity-sync). It opens the room while sync is on, watches the part, lets
  // the relay go once everything it knows is converged, and comes back when something is lost or changed, and slowly (a
  // back-off from SYNC_BACKOFF_MIN_MS to SYNC_BACKOFF_MAX_MS) to look for devices it has not met.
  function holder(opts) {
    opts = opts || {};
    const doc = root.document;
    const lg = (l) => { try { (opts.log || ((x) => { if (root.console && root.__gifosSyncDebug) root.console.log(x); }))(l); } catch (e) {} };
    const listeners = [];
    let run = null;   // { id, el, room, v, at, gone }
    let backoff = 0, nextAt = 0, timer = 0, lock = null, standing = false, status = { here: 0, waiting: false, others: 0, at: 0 }, lastDirty = 0, lastDg = '';
    const emit = () => { for (const f of listeners.slice()) { try { f(status); } catch (e) {} } };
    const set = (st) => { const same = JSON.stringify(st) === JSON.stringify(status); status = st; if (!same) { writeStatus(st); emit(); } };
    const sk = () => { try { return ID().syncState(); } catch (e) { return { on: false }; } };
    const partOf = () => { try { const w = run && run.el && run.el.contentWindow; return w && w.GifOS && w.GifOS.identitySyncPart || null; } catch (e) { return null; } };

    async function open() {
      const s = sk(); if (!s.on || run || !GifOS.meetHost) return;
      const d = await derive(s.k, s.gen);
      const r = run = { id: '', el: null, room: d.room, v: d.v, at: Date.now(), gen: s.gen };
      const link = root.location.origin + GifOS.link.pageFor(root.location.pathname, 'meet') + '#' + GifOS.link.hash({ room: d.room, v: d.v });
      lg('SYNC open data room ' + d.room.slice(0, 8));
      const fr = doc.querySelectorAll('iframe[data-gifos-meet]');
      GifOS.meetHost.join({ link, name: 'sync', bot: false, listen: true }).then((j) => { r.id = j.meetingId; if (run !== r) GifOS.meetHost.leave(j.meetingId).catch(() => {}); }, (e) => { lg('SYNC join failed ' + String(e && e.message || e)); if (run === r) { run = null; later(); } });
      const all = doc.querySelectorAll('iframe[data-gifos-meet]');
      r.el = all.length > fr.length ? all[all.length - 1] : null;   // join() appends its frame at once
      if (r.el) { r.el.removeAttribute('data-mr-listen'); r.el.setAttribute('data-sync-door', '1'); r.el.setAttribute('data-ring-door', 'sync'); }   // a hidden door nobody paints
    }
    function close(why) {
      const r = run; if (!r) return; run = null;
      lg('SYNC relay closed: ' + why + ' (room ' + r.room.slice(0, 8) + ', open ' + (Date.now() - r.at) + ' ms)');
      if (r.id && GifOS.meetHost) GifOS.meetHost.leave(r.id).catch(() => {}); else if (r.el) r.el.remove();
    }
    function later() { backoff = backoff ? Math.min(backoff * 2, T().SYNC_BACKOFF_MAX_MS) : T().SYNC_BACKOFF_MIN_MS; nextAt = Date.now() + backoff; }
    // The relay is an introduction: it is open while devices find each other, then quiet (the part tells the meeting page
    // to let its socket go; the channels between the devices stay), and it opens again when a channel is lost, when a
    // change here is not heard, and slowly to look for a device not met yet.
    function quiet(on, why) {
      const p = partOf(); if (!p || !run) return;
      p.relay(!on);
      run.quiet = !!on; run.at = Date.now();
      if (on) run.peersAtQuiet = p.state().peers.length;
      lg('SYNC relay ' + (on ? 'socket let go, channels kept' : 'socket opened') + ': ' + why + ' (' + (on ? run.peersAtQuiet + ' device(s) connected' : 'room ' + run.room.slice(0, 8)) + ')');
    }
    // One look a second: open the room, read who agrees, let the relay go or ask for it again, paint the status line.
    async function tick() {
      const s = sk();
      if (!s.on) { if (run) close('sync off'); set({ here: 0, waiting: false, others: 0, at: 0, on: false }); return; }
      if (!standing) return;
      const vw = ID().syncView() || { devices: [], dev: '' };
      const others = vw.devices.filter((d) => d !== vw.dev).length;
      if (!run) {
        if (Date.now() >= nextAt) await open();
        set({ here: 0, waiting: true, others, at: status.at || 0, on: true });
        return;
      }
      const p = partOf(); if (!p) { if (Date.now() - run.at > T().SYNC_OPEN_MS) { close('did not open'); later(); } return; }
      p.tick();
      const st = p.state(), now = Date.now();
      const here = st.peers.filter((x) => x.acked).length;
      if (st.dirty) lastDirty = now;
      const at = st.lastSync || status.at || 0;
      set({ here, waiting: !here, others, at, on: true });
      if (!run.quiet) {
        // Open: let go once every device this identity knows is here and agrees, or the exchange is done with whoever is
        // here and nobody else has come for the quiet period, or nobody is here for the alone period.
        if (st.converged && (st.missing === 0 || now - Math.max(run.at, lastDirty) > T().SYNC_QUIET_MS)) {
          if (!run.look || st.peers.length !== run.peersAtQuiet) backoff = 0;   // someone new: start the back-off over; a look that found nobody new waits longer
          later(); quiet(true, 'synced with ' + here + ' device(s)');
        }
        else if (!here && now - run.at > T().SYNC_ALONE_MS) { later(); quiet(true, 'nobody else here'); }
      } else if (st.peers.length < run.peersAtQuiet || (st.dirty && now - lastDirty > T().SYNC_QUIET_MS) || now >= nextAt) {
        const why = st.peers.length < run.peersAtQuiet ? 'a device was lost' : st.dirty ? 'a change is not heard' : 'looking for new devices';
        quiet(false, why); run.look = why === 'looking for new devices';
      }
    }
    function holdLock(want) {
      const nav = root.navigator || {};
      if (want) {
        if (lock) return;
        if (!(nav.locks && nav.locks.request)) { lock = {}; standing = true; return; }
        const ask = lock = new AbortController();
        nav.locks.request('gifos-identity-sync', { signal: ask.signal }, () => new Promise((free) => { if (lock !== ask) { free(); return; } lock.free = free; standing = true; })).catch(() => {}).then(() => { if (lock === ask) { lock = null; standing = false; if (run) close('lock lost'); } });
        return;
      }
      const l = lock; lock = null; standing = false; if (run) close('stopped');
      if (l && l.free) l.free(); else if (l && l.abort) { try { l.abort(); } catch (e) {} }
    }
    function start() {
      if (timer) return;
      const go = () => { holdLock(sk().on); tick().catch(() => {}); };
      timer = root.setInterval(go, T().SYNC_TICK_MS); go();
      root.addEventListener('online', () => { backoff = 0; nextAt = 0; });
      if (doc) doc.addEventListener('visibilitychange', () => { if (!doc.hidden) { backoff = 0; nextAt = 0; go(); } });
    }
    function nudge() { backoff = 0; nextAt = 0; }
    return { start, nudge, close, state: () => status, on: (f) => { listeners.push(f); return () => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }; }, run: () => run };
  }

  // ---- boot: any GifOS page that is not a meeting holds the room while sync is on (like ring-standby) -----------------
  let theHolder = null, booting = false;
  const DEPS = ['timings', 'core/link', 'meet-host'];
  const HAVE = { 'timings': () => GifOS.timings, 'core/link': () => GifOS.link, 'meet-host': () => GifOS.meetHost };
  function deps() {
    const doc = root.document, me = doc.querySelector('script[src*="gifos-identity-sync.js"]'), base = me ? me.src.replace(/gifos-identity-sync\.js.*$/, '') : 'js/';
    return DEPS.reduce((p, n) => p.then(() => (HAVE[n]() ? null : new Promise((ok, no) => { const s = doc.createElement('script'); s.src = base + n + '.js'; s.onload = ok; s.onerror = no; (doc.head || doc.body).appendChild(s); }))), Promise.resolve());
  }
  function wake(now) {
    const doc = root.document;
    if (theHolder && now) theHolder.nudge();   // asked for by a person (turned on, "sync now"): look again at once
    if (!doc || theHolder || booting || !ID() || !ID().syncState || !ID().syncState().on) return;
    try { if (root.top !== root) return; } catch (e) { return; }
    let at = { room: '' }; try { at = GifOS.link ? GifOS.link.read(root.location.pathname, '', root.location.hash) : at; } catch (e) {}
    if (at.room) return;   // a meeting never holds the room
    booting = true;
    deps().then(() => { theHolder = holder(); GifOS.identitySync.holding = theHolder; theHolder.start(); }, () => {}).then(() => { booting = false; });
  }
  GifOS.identitySync = { V, SID, derive, sealMsg, openMsg, mapOf, digestOf, wanted, part, holder, words, readStatus, wake, STATUS_KEY };
  if (root.document) { const boot = () => { try { wake(); } catch (e) {} root.setInterval(() => { try { wake(); } catch (e) {} }, 5 * (T().SYNC_TICK_MS || 1000)); }; if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot); else boot(); }
  if (typeof module !== 'undefined' && module.exports) module.exports = GifOS.identitySync;
})(typeof window !== 'undefined' ? window : globalThis);
