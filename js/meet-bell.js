/*
 * meet-bell.js — the Doorbell on this device: rings reach a device that does not have GifOS open.
 * Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * ONE PATH TO RING: a caller's page knocks at the room AND presses the doorbell once. Devices already in the room ring
 * from the knock; every other registered device of the owner rings from a push (Web Push: computers, Android browsers,
 * the iPhone Home Screen app). This file is logic only (no page element); js/core/view/bell.js paints it.
 *
 *   owner      this device's Doorbell identity: a key only its owner's devices hold (gifos_bell). The Doorbell
 *              (bell.gifos.app) keeps one record per owner: the devices to ring (push addresses, sealed by the Worker)
 *              and the handles that may ring.
 *   handle     one contact's right to ring me, for one room: the Worker seals {owner, the contact's key, expiry, id}, so
 *              the contact can present it but read nothing from it, and two contacts' handles share nothing. My page
 *              hands it over the meeting's end-to-end channel to a page that just proved that key (a private room's
 *              member key word, a card shown and proved), together with a ring secret for that handle alone, signed
 *              by the room's host key. Cutting the contact removes the handle at the Doorbell.
 *   ring       the caller signs {time, call id, handle, sealed note} with the handle's key, pays a proof of work over
 *              that signature, and posts it. The Doorbell answers "sent" to every ring; it pushes only a ring that a
 *              live handle's key signed, unpaused, outside the cool-down.
 *   note       sealed end to end with the handle's ring secret (AES-GCM): the call id, the time, the caller's name.
 *              The Doorbell, the push services and Apple or Google see ciphertext only. The owner's service worker
 *              derives the secret, opens the note and shows "Paul is calling" or, when it arrives late, a missed call.
 *              A tap opens the room the handle belongs to (never a room the note names).
 *
 * The service worker (sw.js) reads what it needs from IndexedDB 'gifos-bell' (it cannot read localStorage): the ring
 * master secret, the handle id -> {room, verifier, label} map and how long a ring rings.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const KEY = { me: 'gifos_bell', handles: 'gifos_bell_handles', held: 'gifos_bell_held' };
  const BASE = () => String(root.GIFOS_BELL_URL || 'https://bell.gifos.app');
  const T = () => GifOS.timings || {};
  const net = () => GifOS.net;
  const MR = () => GifOS.meetMyRoom;
  const ROOM_RE = /^[a-z0-9-]{1,64}$/i, VER_RE = /^[a-f0-9]{16,64}$/, PUB_RE = /^[A-Za-z0-9+/]{43}=$/;

  // ---- small helpers ------------------------------------------------------------------------------------------------
  const store = () => { try { return root.localStorage || null; } catch (e) { return null; } };
  function readJson(k, d) { try { const s = store(); const v = s ? JSON.parse(s.getItem(k) || 'null') : null; return v == null ? d : v; } catch (e) { return d; } }
  function writeJson(k, v) { try { const s = store(); if (s) s.setItem(k, JSON.stringify(v)); } catch (e) {} }
  const te = new TextEncoder(), td = new TextDecoder();
  const hex = (u) => Array.from(u, (b) => b.toString(16).padStart(2, '0')).join('');
  const randHex = (n) => { const u = new Uint8Array(n); root.crypto.getRandomValues(u); return hex(u); };
  const b64u = (u) => { let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return root.btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = (t) => { let s = String(t).replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - (s.length % 4)) % 4); const b = root.atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const sha256 = async (s) => new Uint8Array(await root.crypto.subtle.digest('SHA-256', te.encode(s)));
  const sha256hex = async (s) => hex(await sha256(s));
  const roomKey = (room, v) => (room && v ? room + '.' + String(v).toLowerCase() : '');
  const hostSecret = (room, v) => { try { const s = store(); return s ? s.getItem('gifos_vadm_' + roomKey(room, v)) || '' : ''; } catch (e) { return ''; } };
  async function hmac(rawKey, text) {
    const k = await root.crypto.subtle.importKey('raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await root.crypto.subtle.sign('HMAC', k, te.encode(text)));
  }
  async function aes(raw) { return root.crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']); }
  async function sealWith(raw, text, aad) {
    const iv = new Uint8Array(12); root.crypto.getRandomValues(iv);
    const ct = new Uint8Array(await root.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(aad) }, await aes(raw), te.encode(text)));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return b64u(out);
  }
  async function openWith(raw, tok, aad) {
    try { const u = unb64u(tok); return td.decode(await root.crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12), additionalData: te.encode(aad) }, await aes(raw), u.slice(12))); } catch (e) { return null; }
  }

  // ---- this device's Doorbell identity --------------------------------------------------------------------------------
  // gifos_bell = { seed, dev, on }. seed is made once: from My personal room's host secret when there is one (every
  // device that holds that room shares one Doorbell record, and so one device list), else random. It never changes
  // afterwards, so the handles given out stay good.
  const me = () => { const m = readJson(KEY.me, null); return m && /^[a-f0-9]{64}$/.test(m.seed || '') && /^[a-f0-9]{16}$/.test(m.dev || '') ? m : null; };
  async function ensureMe() {
    let m = me(); if (m) return m;
    let seed = '';
    try { const mine = MR() && MR().mine(); const K = mine && hostSecret(mine.room, mine.v); if (K) seed = await sha256hex('gifos-bell|' + K); } catch (e) { seed = ''; }
    m = { seed: seed || randHex(32), dev: randHex(8), on: false };
    writeJson(KEY.me, m);
    return m;
  }
  async function ownerKey(m) { return net().edKeysFromSeedHex(await sha256hex('gifos-bell-owner|' + m.seed)); }
  async function master(m) { return sha256('gifos-bell-ring|' + m.seed); }
  // The ring secret of one handle: only the owner's devices (the master) and the contact it was given to know it.
  async function ringSecret(mst, i, k) { return hmac(mst, 'gifos-bell-handle|' + i + '|' + k); }
  // The owner's tag for (room, contact key): any of the owner's devices can cut that contact's handles by it; it tells
  // the Doorbell nothing (an HMAC under the master).
  async function tagFor(mst, r, k) { return b64u((await hmac(mst, 'gifos-bell-room|' + r + '|' + k)).slice(0, 16)); }
  async function labelKey(mst) { return hmac(mst, 'gifos-bell-label'); }

  // ---- talking to the Doorbell ----------------------------------------------------------------------------------------
  let keyInfo = null;   // { vapid, pow, off } from /key: off = the Doorbell's clock minus this device's
  async function getKey() {
    if (keyInfo) return keyInfo;   // once per page: the key, the work and the clock offset
    const r = await root.fetch(BASE() + '/key', { cache: 'no-store', credentials: 'omit' });
    const j = await r.json();
    keyInfo = { vapid: j.vapid, pow: +j.pow || 16, off: (+j.now || Date.now()) - Date.now() };
    return keyInfo;
  }
  const now = () => Date.now() + (keyInfo ? keyInfo.off : 0);
  async function op(name, args) {
    const m = await ensureMe();
    await getKey().catch(() => null);
    const k = await ownerKey(m), ts = now();
    const sp = JSON.stringify(Object.assign({ act: 'bell', op: name, o: k.pubB64, ts, n: randHex(8) }, args || {}));
    const sig = await net().edSign(k.priv, sp);
    const pow = await net().solvePow('bell', (await sha256hex('gifos-bell-pow|' + sig)).slice(0, 32), ts, (keyInfo && keyInfo.pow) || 16);
    const r = await root.fetch(BASE() + '/owner', { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sp, sig, pow }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || ('doorbell ' + r.status));
    return j;
  }

  // ---- what the service worker reads (IndexedDB: it has no localStorage) -----------------------------------------------
  function idb() {
    return new Promise((resolve, reject) => {
      try {
        const q = root.indexedDB.open('gifos-bell', 1);
        q.onupgradeneeded = () => { q.result.createObjectStore('kv'); };
        q.onsuccess = () => resolve(q.result);
        q.onerror = () => reject(q.error);
      } catch (e) { reject(e); }
    });
  }
  async function idbGet(k) { const db = await idb(); return new Promise((res) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => { res(q.result); db.close(); }; q.onerror = () => { res(undefined); db.close(); }; }); }
  async function idbPut(k, v) { const db = await idb(); return new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => { res(true); db.close(); }; t.onerror = () => { res(false); db.close(); }; }); }
  async function mirror() {
    const m = me(); if (!m) return;
    const map = {};
    for (const h of handles()) map[h.i] = { r: h.room, v: h.v, k: h.k, label: h.label || '' };
    await idbPut('state', { master: b64u(await master(m)), ringMs: T().MYROOM_RING_MS || 0, map, on: !!m.on });
  }

  // ---- registering this device ---------------------------------------------------------------------------------------
  const pushable = () => { try { return !!(root.navigator.serviceWorker && root.PushManager && root.Notification); } catch (e) { return false; } };
  function deviceName() {
    const ua = String((root.navigator && root.navigator.userAgent) || '');
    const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : '';
    return br + (os ? ' on ' + os : '');
  }
  async function subscription(create) {
    const reg = await root.navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub && create) {
      const k = await getKey();
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(k.vapid) });
    }
    return sub;
  }
  // "Ring me on this device": the person's tap (the notification permission needs one).
  async function enable() {
    if (!pushable()) throw new Error('This browser cannot show rings while GifOS is closed.');
    const perm = root.Notification.permission === 'granted' ? 'granted' : await root.Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Notifications are blocked for GifOS in this browser’s settings.');
    const m = await ensureMe();
    const sub = await subscription(true);
    const j = sub.toJSON();
    const l = await sealWith(await labelKey(await master(m)), deviceName(), 'gifos-bell-label');
    await op('add', { d: m.dev, sub: { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } }, l });
    writeJson(KEY.me, Object.assign({}, m, { on: true }));
    await mirror();
    return true;
  }
  async function disable() {
    const m = me(); if (!m) return true;
    await op('del', { d: m.dev }).catch(() => null);
    try { const sub = await subscription(false); if (sub) await sub.unsubscribe(); } catch (e) {}
    writeJson(KEY.me, Object.assign({}, m, { on: false }));
    await mirror();
    return true;
  }
  const on = () => { const m = me(); return !!(m && m.on); };
  // The owner's devices, with their names opened here. me: this device.
  async function devices() {
    const m = await ensureMe(), lk = await labelKey(await master(m));
    const j = await op('list');
    const out = [];
    for (const d of j.devs || []) out.push({ d: d.d, at: d.a, name: (d.l && (await openWith(lk, d.l, 'gifos-bell-label'))) || 'A device', me: d.d === m.dev });
    return { devices: out, paused: !!j.paused, handles: j.handles || 0 };
  }
  async function remove(d) { const m = me(); const j = await op('del', { d }); if (m && d === m.dev) { writeJson(KEY.me, Object.assign({}, m, { on: false })); await mirror(); } return j; }
  async function pause(onOff) { return op('pause', { on: !!onOff }); }
  async function test() { return op('test'); }

  // ---- handles I gave (owner side) ------------------------------------------------------------------------------------
  function handles() { const a = readJson(KEY.handles, []); return Array.isArray(a) ? a.filter((h) => h && h.i && h.h && h.k) : []; }
  // offer(room, v, k, label) -> a frame for the page that proved key k, or null (the doorbell is off on this device,
  // or this device does not hold the room's host key). One handle per room and key, renewed when it runs low.
  async function offer(room, v, k, label, exp) {
    v = String(v || '').toLowerCase();
    if (!on() || !ROOM_RE.test(room || '') || !VER_RE.test(v) || !PUB_RE.test(String(k || ''))) return null;
    const K = hostSecret(room, v); if (!K) return null;
    const m = me(), r = roomKey(room, v);
    let h = handles().find((x) => x.r === r && x.k === k && x.x - Date.now() > (T().BELL_RENEW_BEFORE_MS || 0));
    if (!h) {
      // A handle never outlives the card it goes with (exp), nor a card's life.
      const x = Math.min(now() + (T().MYROOM_CARD_LIFE_MS || 0), +exp > 0 ? +exp : Infinity);
      const j = await op('handle', { k, x, g: await tagFor(await master(m), r, k) });
      if (!/^[a-f0-9]{16}$/.test(String(j.i || '')) || typeof j.h !== 'string' || handles().some((y) => y.i === j.i)) return null;
      h = { r, room, v, k, i: j.i, h: j.h, x, label: String(label || '').slice(0, 40), at: Date.now() };
      const old = handles().filter((y) => y.r === r && y.k === k);
      writeJson(KEY.handles, [h].concat(handles().filter((y) => !(y.r === r && y.k === k))).slice(0, 1000));
      for (const y of old) op('unhandle', { i: y.i }).catch(() => null);   // the one it replaces rings no more
      await mirror();
    } else if (label && label !== h.label) {
      writeJson(KEY.handles, handles().map((y) => (y.i === h.i ? Object.assign({}, y, { label: String(label).slice(0, 40) }) : y)));
      await mirror();
    }
    const s = b64u(await ringSecret(await master(m), h.i, k));
    const hk = await net().edKeysFromSeedHex(K);
    const sp = JSON.stringify({ act: 'bell', room: r, k, h: h.h, s, x: h.x });
    return { op: 'bell', sp, sig: await net().edSign(hk.priv, sp), pub: hk.pubB64 };
  }
  // cutKey(room, v, k): the handles given for this room to that key ring no more (a card revoked). cut(room, v): every
  // handle of the room (a private room forgotten). The Doorbell removes them by the owner's tag, so a handle made on
  // another of my devices goes too. An unhandle that does not reach the Doorbell is kept and sent again with the
  // next request.
  const PEND = 'gifos_bell_cut';
  async function flushCuts() {
    for (const g of readJson(PEND, [])) {
      try { await op('unhandle', { g }); writeJson(PEND, readJson(PEND, []).filter((x) => x !== g)); } catch (e) { return; }
    }
  }
  async function cutWhere(pick, keys) {
    const m = me(); if (!m) return 0;
    const gone = handles().filter(pick);
    writeJson(KEY.handles, handles().filter((y) => !pick(y)));
    const mst = await master(m), tags = new Set();
    for (const [r, k] of keys.concat(gone.map((y) => [y.r, y.k]))) tags.add(await tagFor(mst, r, k));
    writeJson(PEND, Array.from(new Set(readJson(PEND, []).concat(Array.from(tags)))).slice(-1000));
    await mirror().catch(() => null);
    await flushCuts();
    return gone.length;
  }
  const cutKey = (room, v, k) => cutWhere((y) => y.r === roomKey(room, v) && y.k === k, [[roomKey(room, v), k]]);
  async function cut(room, v) {
    const r = roomKey(room, v);
    writeJson(KEY.held, held().filter((y) => y.r !== r));
    return cutWhere((y) => y.r === r, []);
  }

  // ---- handles I hold (caller side) -----------------------------------------------------------------------------------
  function held() { const a = readJson(KEY.held, []); return Array.isArray(a) ? a.filter((h) => h && h.r && h.h && h.k && h.s) : []; }
  const heldFor = (room, v) => { const r = roomKey(room, v); return held().find((h) => h.r === r && h.x > Date.now()) || null; };
  // The private key of a key this device holds: my personal room's, a private room's member key, a card's own key.
  async function seedFor(k) {
    const M = MR(); if (!M) return '';
    try { const mk = await M.myKey(); if (mk && mk.pub === k) return mk.seed; } catch (e) {}
    for (const rec of (M.privates ? M.privates() : [])) if (rec.me && rec.mepub === k) return rec.me;
    for (const c of (M.contacts ? M.contacts() : [])) {
      const t = M.parseToken(c.token);
      if (t && t.seed) { try { if ((await net().edKeysFromSeedHex(t.seed)).pubB64 === k) return t.seed; } catch (e) {} }
    }
    return '';
  }
  // take(frame, room, v): a handle someone gave me, for the room the caller vouches the giver for (this meeting's room
  // with a proved giver, or the room of a card that giver just handed me). Kept only when that room's host key signed
  // it and its key is one of mine.
  async function take(f, room, v) {
    if (!f || typeof f.sp !== 'string' || f.sp.length > 2048 || typeof f.sig !== 'string' || typeof f.pub !== 'string') return false;
    let o; try { o = JSON.parse(f.sp); } catch (e) { return false; }
    const at = o && o.act === 'bell' && /^([a-z0-9-]{1,64})\.([a-f0-9]{16,64})$/i.exec(String(o.room || ''));
    if (!at || roomKey(at[1], at[2]) !== roomKey(room, v) || !PUB_RE.test(String(o.k || '')) || typeof o.h !== 'string' || o.h.length > 600 || typeof o.s !== 'string' || unb64u(o.s).length !== 32 || !(+o.x > Date.now())) return false;
    if (!(await net().edProven(at[2], f.pub, f.sig, f.sp))) return false;
    if (!(await seedFor(o.k))) return false;
    const r = roomKey(at[1], at[2]);
    const was = held().find((h) => h.r === r);
    if (was && was.h === o.h) return true;
    writeJson(KEY.held, [{ r, k: o.k, h: o.h, s: o.s, x: +o.x, at: Date.now() }].concat(held().filter((h) => h.r !== r)).slice(0, 1000));
    return true;
  }
  // press(room, v, name): ring the owner of this room through the Doorbell, once per call. 'sent' (the Doorbell's
  // answer to every ring), 'none' (I hold no handle for this room) or 'nokey'.
  const pressed = new Set();
  async function press(room, v, name, callId) {
    const h = heldFor(room, v); if (!h) return 'none';
    const c = /^[a-f0-9]{8,32}$/.test(String(callId || '')) ? String(callId) : randHex(8);
    if (pressed.has(h.r + '|' + c)) return 'sent';
    const seed = await seedFor(h.k); if (!seed) return 'nokey';
    pressed.add(h.r + '|' + c);
    const k = await getKey();
    const ts = now();
    const n = await sealWith(unb64u(h.s), JSON.stringify({ c, ts, n: String(name || '').slice(0, 40) }), 'gifos-bell-note');
    const r = { h: h.h, ts, c, n };
    r.sig = await net().edSign((await net().edKeysFromSeedHex(seed)).priv, 'gifos-bell-ring|' + r.ts + '|' + r.c + '|' + r.h + '|' + r.n);
    const dev = (await sha256hex('gifos-bell-pow|' + r.sig)).slice(0, 32);
    r.pow = await net().solvePow('bell', dev, ts, k.pow);
    if (!r.pow) return 'nopow';
    const res = await root.fetch(BASE() + '/ring', { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) });
    const j = await res.json().catch(() => ({}));
    return j.ok || 'x';
  }

  // ---- rings this device's service worker saw (the lobby turns the unanswered ones into missed calls) ----------------
  async function takeRings() {
    const list = (await idbGet('rings').catch(() => null)) || [];
    if (!list.length) return [];
    await idbPut('rings', []);
    return list.filter((x) => x && !x.done);
  }

  GifOS.bell = { KEY, pushable, on, enable, disable, devices, remove, pause, test, offer, take, press, cut, cutKey, flushCuts, handles, held, heldFor, takeRings, mirror, deviceName, me };
  if (typeof module !== 'undefined' && module.exports) module.exports = GifOS.bell;
})(typeof window !== 'undefined' ? window : globalThis);
