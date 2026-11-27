/*
 * gifos-identity.js — "My identity": one sealed GIF in the Identity folder that holds who you are on GifOS.
 * Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * ONE CONCEPT: your identity is a file. It holds your personal room's key, the keys of our private rooms, your
 * contacts and the cards you gave. Copy the file and you have copied yourself; keep the file and you have a backup.
 * No server ever holds it and there is nothing to register (docs/identity.md).
 *
 * This file is the logic only (no page element): js/gifos-identity-ui.js paints it on the Home Screen and in Meet.
 *
 *   records   The identity is a set of small records, each with an id, a value and a stamp (when, on which device):
 *               room/<room>.<v>     a hosted room's key (the personal room, a private room)
 *               mine                which hosted room is the personal room
 *               contact/<room>.<v>  a card this person holds
 *               card/<id>           a card this person gave
 *               revoked/<id>        a card taken back
 *               private/<room>.<v>  a private room (members, my member key, its password)
 *               device/<id>         a device that holds this identity (a name, for the list a person sees)
 *             The meeting page reads these from the browser's storage at every join (HOMES below says where each
 *             lives), so the browser's storage stays the working copy on a device; the GIF is the sealed copy that
 *             leaves it. scan() notes what changed here; the GIF is rewritten after every change, without asking.
 *   merge     Two copies are merged record by record: the later stamp wins, a removal is a record too (so a contact
 *             removed on one device does not come back from the other), and two devices that both added contacts
 *             keep them all. Three kinds never lose: a hosted room's key leaves only with its private room (a cut),
 *             a taken-back card stays taken back, and (later) a purchase is never removed or replaced.
 *   seal      A random master key seals the records inside the GIF (GifOS.seal, the same wrap a passkey-locked app
 *             uses, at .lock/v1). The master key itself is kept in "ways to open": each is the master key sealed by a
 *             passkey or by a passphrase. A file opens with any one of them; the device that wrote it needs none to
 *             write it again. The GIF's pixels and identity.json (the ways to open, no names, no rooms) stay clear.
 *   copy      Device to device: both devices in my personal room; the device that has the identity shows a one-time
 *             code (a QR carries it); the other proves it knows the code; the records cross the meeting's own
 *             end-to-end encrypted channel sealed once more under a key made from the code, both ways (a merge).
 *
 * Attaches to `GifOS.identity`.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  if (GifOS.identity) return;

  const SHADOW = 'gifos_identity';        // this device's notes about its identity (stamps, the master key, ways to open)
  const DOC_PATH = '.state/identity.json';  // inside the seal
  const CLEAR_PATH = 'identity.json';       // clear: how to open it, nothing about the person
  const CODE_ABC = '23456789ABCDEFGHJKMNPQRSTVWXYZ';   // no 0/O, 1/I/L, U
  const CODE_LEN = 12;
  const CHUNK = 12000;                      // one frame's share of a sealed copy (well under a data channel's message size)
  const MAX_COPY = 4 * 1024 * 1024;         // a copy larger than this is not an identity (flood bound)
  const T = () => GifOS.timings || {};
  const seal = () => GifOS.seal;
  const subtle = () => root.crypto.subtle;

  // ---- small helpers ----------------------------------------------------------------------------------------------
  const enc = (s) => new TextEncoder().encode(s);
  const dec = (u) => new TextDecoder().decode(u);
  const b64 = (u) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return root.btoa(s); };
  const unb64 = (t) => { const s = root.atob(String(t)); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const hex = (u) => Array.from(u).map((b) => b.toString(16).padStart(2, '0')).join('');
  const rand = (n) => { const u = new Uint8Array(n); root.crypto.getRandomValues(u); return u; };
  // Canonical JSON (sorted keys): two devices describe the same value with the same bytes.
  function canon(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  // A short fingerprint of a value (not a secret, not a proof: it only tells "changed since I last looked").
  function mark(str) {
    let a = 0x811c9dc5, b = 0x1b873593;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b ^ c, 0x85ebca6b) + (a >>> 13); }
    return (a >>> 0).toString(36) + (b >>> 0).toString(36) + str.length.toString(36);
  }
  const fail = (msg, code) => { const e = new Error(msg); e.code = code; return e; };

  // ---- where each record lives in the browser's storage ------------------------------------------------------------
  // The storage this device's identity lives in. Meet's My Room part reads the same keys (js/meet-myroom.js KEY).
  let keeper = null;
  const store = () => { if (keeper) return keeper; try { return root.localStorage || null; } catch (e) { return null; } };
  function useStore(k) { keeper = k || null; }
  const RK = /^[a-z0-9-]{1,64}\.[a-f0-9]{16,64}$/i;
  const readJson = (k, d) => { try { const s = store(); const v = s ? JSON.parse(s.getItem(k) || 'null') : null; return v == null ? d : v; } catch (e) { return d; } };
  const rkOf = (x) => (x && x.room && x.v ? String(x.room) + '.' + String(x.v).toLowerCase() : '');
  // A list kept under one storage key, one record per element. soft: fields that change with use and are no news (the
  // later one is simply kept at a merge). cap: the list's own bound. order: newest first, as the page keeps it.
  const LISTS = [
    { cls: 'contact', key: 'gifos_contacts', id: rkOf, ok: (x) => RK.test(rkOf(x)) && !!x.token, soft: ['last'], cap: 500, when: (x) => Math.max(+x.last || 0, +x.at || 0) },
    { cls: 'card', key: 'gifos_myroom_cards', id: (x) => String((x && x.id) || ''), ok: (x) => /^[a-f0-9]{8,64}$/i.test(String((x && x.id) || '')), soft: [], cap: 500, when: (x) => +x.at || 0 },
    { cls: 'private', key: 'gifos_private', id: rkOf, ok: (x) => RK.test(rkOf(x)) && Array.isArray(x.pubs), soft: ['last'], cap: 500, when: (x) => Math.max(+x.last || 0, +x.at || 0) },
  ];
  const HOSTKEY = /^gifos_vadm_([a-z0-9-]{1,64}\.[a-f0-9]{16,64})$/i;
  const KEEPS = (rid) => rid === 'mine' || rid.indexOf('revoked/') === 0 || rid.indexOf('purchase/') === 0;   // never removed by a merge
  const classOf = (rid) => { const i = rid.indexOf('/'); return i < 0 ? rid : rid.slice(0, i); };
  const KNOWN = { room: 1, mine: 1, contact: 1, card: 1, revoked: 1, private: 1, device: 1 };

  // collect() -> { rid: value } read from the storage as it is now.
  function collect() {
    const out = {}, s = store(); if (!s) return out;
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i), m = HOSTKEY.exec(k || '');
      if (m) { const K = s.getItem(k); if (K) out['room/' + m[1].toLowerCase()] = String(K); }
    }
    const mine = readJson('gifos_myroom', null);
    if (mine && RK.test(rkOf(mine))) out.mine = { room: mine.room, v: String(mine.v).toLowerCase(), at: +mine.at || 0 };
    for (const L of LISTS) {
      const a = readJson(L.key, []);
      if (Array.isArray(a)) for (const x of a) if (x && typeof x === 'object' && L.ok(x)) { const rid = L.cls + '/' + L.id(x).toLowerCase(); if (!(rid in out)) out[rid] = x; }
    }
    const rv = readJson('gifos_myroom_revoked', []);
    if (Array.isArray(rv)) for (const id of rv) if (typeof id === 'string' && /^[a-f0-9]{8,64}$/i.test(id)) out['revoked/' + id] = 1;
    return out;
  }
  // put(recs): write the records back where the pages read them. Only what differs is written.
  function put(recs) {
    const s = store(); if (!s) return;
    const set = (k, v) => { if (s.getItem(k) !== v) s.setItem(k, v); };
    const have = new Set();
    for (const rid of Object.keys(recs)) {
      const r = recs[rid]; if (r.d || classOf(rid) !== 'room') continue;
      const k = 'gifos_vadm_' + rid.slice(5); have.add(k.toLowerCase()); set(k, String(r.v));
    }
    const gone = [];
    for (let i = 0; i < s.length; i++) { const k = s.key(i); if (HOSTKEY.test(k || '') && !have.has(k.toLowerCase()) && recs['room/' + k.slice(11).toLowerCase()] && recs['room/' + k.slice(11).toLowerCase()].d) gone.push(k); }
    for (const k of gone) s.removeItem(k);
    if (recs.mine && !recs.mine.d) set('gifos_myroom', JSON.stringify(recs.mine.v));
    for (const L of LISTS) {
      const list = Object.keys(recs).filter((rid) => classOf(rid) === L.cls && !recs[rid].d).map((rid) => recs[rid].v);
      list.sort((a, b) => L.when(b) - L.when(a));
      const was = readJson(L.key, null);
      if (!list.length && was == null) continue;
      // Keep the page's own order when the same set is there (a rewrite in another order is no news to anyone).
      const ids = (a) => a.map((x) => L.id(x).toLowerCase() + '|' + canon(x)).sort().join('\n');
      if (Array.isArray(was) && ids(was.filter((x) => x && L.ok(x))) === ids(list)) continue;
      set(L.key, JSON.stringify(list.slice(0, L.cap)));
    }
    const rv = Object.keys(recs).filter((rid) => classOf(rid) === 'revoked' && !recs[rid].d).map((rid) => rid.slice(8));
    const wasRv = readJson('gifos_myroom_revoked', null);
    if (rv.length || wasRv != null) { const a = Array.isArray(wasRv) ? wasRv.filter((x) => rv.indexOf(x) >= 0) : []; for (const id of rv) if (a.indexOf(id) < 0) a.push(id); if (canon(a) !== canon(wasRv)) set('gifos_myroom_revoked', JSON.stringify(a.slice(0, 1000))); }
  }

  // ---- this device's notes (the shadow) ------------------------------------------------------------------------------
  // { v, id, born, dev, mk, st: { rid: [t, dev, mark, gone?] }, slots: [...], keep: { rid: rec } (records of kinds this
  //   version does not know: carried untouched), saved: { at, n } (the last file the person kept), later: time }
  function shadow() { const sh = readJson(SHADOW, null); return sh && sh.v === 1 && typeof sh.id === 'string' && typeof sh.mk === 'string' ? sh : null; }
  function writeShadow(sh) { const s = store(); if (!s) throw fail('This browser could not keep your identity.', 'no-storage'); s.setItem(SHADOW, JSON.stringify(sh)); }
  let clockLast = 0;
  function tickOf(sh) {
    let top = clockLast;
    if (sh) for (const rid of Object.keys(sh.st)) if (sh.st[rid][0] > top) top = sh.st[rid][0];
    clockLast = Math.max(Date.now(), top + 1);
    return clockLast;
  }
  const softOf = (rid) => { const L = LISTS.find((x) => x.cls === classOf(rid)); return L ? L.soft : []; };
  function hard(rid, v) {   // the value without the fields that change with use
    const soft = softOf(rid);
    if (!soft.length || !v || typeof v !== 'object') return v;
    const o = Object.assign({}, v); for (const f of soft) delete o[f]; return o;
  }
  function deviceName() {
    try {
      const ua = String((root.navigator && root.navigator.userAgent) || '');
      const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iPhone or iPad' : /CrOS/.test(ua) ? 'Chromebook' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
      const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
      return os ? br + ' on ' + os : br;
    } catch (e) { return 'Browser'; }
  }

  // exists(): this device holds an identity. worth(): there is something on this device an identity would hold.
  const exists = () => !!shadow();
  function worth() { const c = collect(); return Object.keys(c).length > 0; }
  // begin(): make this device's identity (a fresh id and master key). Nothing is asked: the seal's ways to open are
  // added when the person first keeps a file (addPassphrase / addPasskey).
  function begin() {
    let sh = shadow(); if (sh) return sh;
    const dev = hex(rand(8)), now = Date.now();
    sh = { v: 1, id: hex(rand(16)), born: now, dev, mk: b64(rand(32)), st: {}, slots: [], keep: {} };
    sh.keep['device/' + dev] = { t: now, w: dev, v: { name: deviceName(), at: now } };
    writeShadow(sh);
    scan();
    return shadow();
  }
  // scan() -> true when something changed on this device since the last look (the notes are updated).
  function scan() {
    const sh = shadow(); if (!sh) return false;
    const cur = collect(); let changed = false;
    for (const rid of Object.keys(cur)) {
      const m = mark(canon(hard(rid, cur[rid]))), st = sh.st[rid];
      if (!st || st[3] || st[2] !== m) { sh.st[rid] = [tickOf(sh), sh.dev, m]; changed = true; }
    }
    for (const rid of Object.keys(sh.st)) {
      if (rid in cur || sh.st[rid][3]) continue;
      if (KEEPS(rid)) { delete sh.st[rid]; changed = true; continue; }   // a kind that is never removed: simply not on this device now
      sh.st[rid] = [tickOf(sh), sh.dev, '', 1]; changed = true;
    }
    if (changed) writeShadow(sh);
    return changed;
  }
  // records() -> { rid: { t, w, v } | { t, w, d: 1 } }: everything, as a copy carries it.
  function records(sh, cur) {
    sh = sh || shadow(); if (!sh) return {};
    cur = cur || collect();
    const out = {};
    for (const rid of Object.keys(sh.st)) {
      const st = sh.st[rid];
      if (st[3]) out[rid] = { t: st[0], w: st[1], d: 1 };
      else if (rid in cur) out[rid] = { t: st[0], w: st[1], v: cur[rid] };
    }
    for (const rid of Object.keys(sh.keep || {})) out[rid] = sh.keep[rid];
    return out;
  }
  function doc() {
    scan();
    const sh = shadow(); if (!sh) return null;
    return { v: 1, kind: 'gifos-identity', id: sh.id, born: sh.born, at: Date.now(), recs: records(sh) };
  }

  // ---- merge ---------------------------------------------------------------------------------------------------------
  const later = (a, b) => (a.t !== b.t ? a.t > b.t : String(a.w) > String(b.w));   // is a later than b
  function okRec(r) { return !!r && typeof r === 'object' && typeof r.t === 'number' && isFinite(r.t) && (r.d === 1 || r.v !== undefined); }
  // mergeRecs(mine, theirs) -> { recs, news }: pure. news lists what the merge changed on my side.
  function mergeRecs(mine, theirs) {
    const out = {}, news = [];
    const rids = new Set(Object.keys(mine).concat(Object.keys(theirs)));
    for (const rid of rids) {
      const a = mine[rid], b = okRec(theirs[rid]) ? theirs[rid] : null;
      if (!b) { out[rid] = a; continue; }
      if (!a) { out[rid] = b; news.push(rid); continue; }
      let pick;
      if (KEEPS(rid) && !!a.d !== !!b.d) pick = a.d ? b : a;                       // never removed: the one that is there
      else if (classOf(rid) === 'room' && !!a.d !== !!b.d) pick = a.d ? b : a;     // a room's key: settled below with its private room
      else pick = later(b, a) ? b : a;
      if (!pick.d && !a.d && !b.d) {   // both there: fields that change with use keep the later of the two
        const soft = softOf(rid);
        if (soft.length && pick.v && typeof pick.v === 'object') {
          const other = pick === a ? b : a, v = Object.assign({}, pick.v);
          for (const f of soft) if (other.v && +other.v[f] > (+v[f] || 0)) v[f] = other.v[f];
          pick = Object.assign({}, pick, { v });
        }
      }
      out[rid] = pick;
      if (pick !== a && canon(pick) !== canon(a)) news.push(rid);
    }
    // A hosted room's key leaves only with its private room (a cut): a removal of the key alone is not believed.
    for (const rid of Object.keys(out)) {
      if (classOf(rid) !== 'room') continue;
      const a = mine[rid], b = okRec(theirs[rid]) ? theirs[rid] : null, pr = out['private/' + rid.slice(5)];
      const cut = !!(pr && pr.d);
      const gone = [a, b].filter((x) => x && x.d).sort((x, y) => (later(x, y) ? -1 : 1))[0];
      const there = [a, b].filter((x) => x && !x.d).sort((x, y) => (later(x, y) ? -1 : 1))[0];
      const want = cut && gone ? gone : (there || out[rid]);
      if (want !== out[rid]) { const i = news.indexOf(rid); if (canon(want) === canon(a)) { if (i >= 0) news.splice(i, 1); } else if (i < 0) news.push(rid); out[rid] = want; }
    }
    return { recs: out, news };
  }
  // take(theirs) -> { news, counts }: merge a copy into this device (its storage and its notes).
  // theirs: { id, born, recs }, with mk and slots when the copy's own seal came with it (a file opened, a device copy).
  function take(theirs) {
    if (!theirs || theirs.kind !== 'gifos-identity' || theirs.v !== 1 || !theirs.recs || typeof theirs.recs !== 'object') throw fail('That is not a GifOS identity.', 'not-identity');
    if (!shadow()) begin();
    scan();
    const sh = shadow(), cur = collect();
    const m = mergeRecs(records(sh, cur), theirs.recs);
    // One identity, one seal: of two identities joined, the one born first keeps its id, master key and ways to open.
    if (theirs.id && theirs.id !== sh.id && typeof theirs.mk === 'string' && (+theirs.born || Infinity) < sh.born) {
      sh.id = theirs.id; sh.born = +theirs.born; sh.mk = theirs.mk; sh.slots = Array.isArray(theirs.slots) ? theirs.slots.filter(okSlot) : [];
      delete sh.saved;
    } else if (theirs.id === sh.id && Array.isArray(theirs.slots)) {
      sh.slots = mergeSlots(sh.slots, theirs.slots.filter(okSlot));
    }
    const known = {}; sh.keep = {};
    for (const rid of Object.keys(m.recs)) { if (KNOWN[classOf(rid)] && classOf(rid) !== 'device') known[rid] = m.recs[rid]; else sh.keep[rid] = m.recs[rid]; }
    put(known);
    // The notes take the merged stamps: what is in the storage now is exactly what the merge said.
    const now = collect(); sh.st = {};
    for (const rid of Object.keys(known)) {
      const r = known[rid];
      if (r.d) sh.st[rid] = [r.t, r.w, '', 1];
      else if (rid in now) sh.st[rid] = [r.t, r.w, mark(canon(hard(rid, now[rid])))];
    }
    writeShadow(sh);
    return { news: m.news, counts: counts() };
  }
  function counts() {
    const c = collect(); const n = (cls) => Object.keys(c).filter((rid) => classOf(rid) === cls).length;
    const sh = shadow();
    return { rooms: n('room'), contacts: n('contact'), privates: n('private'), cards: n('card'), mine: c.mine ? c.mine.room : '', devices: sh ? Object.keys(sh.keep || {}).filter((rid) => classOf(rid) === 'device' && !sh.keep[rid].d).length : 0 };
  }

  // ---- the seal: a master key, and the ways to open it ---------------------------------------------------------------
  // slot: { id, kind: 'passphrase' | 'passkey', at, w (the device that made it), wrap (b64: the master key sealed,
  //         GLK2), meta? (a passkey's record: which passkey, its salt), gone? }
  const okSlot = (s) => !!s && typeof s.id === 'string' && (s.kind === 'passphrase' || s.kind === 'passkey') && (s.gone === 1 || typeof s.wrap === 'string');
  function mergeSlots(a, b) {
    const by = {};
    for (const s of a.concat(b)) { const was = by[s.id]; if (!was || (s.gone && !was.gone) || (!!s.gone === !!was.gone && (+s.at || 0) > (+was.at || 0))) by[s.id] = s; }
    return Object.keys(by).sort().map((k) => by[k]);
  }
  const slots = () => { const sh = shadow(); return sh ? sh.slots.filter((s) => !s.gone) : []; };
  const mkKey = (mk) => subtle().importKey('raw', unb64(mk), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  async function addSlot(kind, secret, meta) {
    const sh = shadow() || begin();
    const wrap = await seal().sealBytes(unb64(sh.mk), secret);
    const cur = shadow();
    // One passphrase at a time: a new one replaces the old way in (the old passphrase no longer opens new files).
    if (kind === 'passphrase') for (const s of cur.slots) if (s.kind === 'passphrase' && !s.gone) { s.gone = 1; s.at = Date.now(); delete s.wrap; }
    const slot = Object.assign({ id: hex(rand(6)), kind, at: Date.now(), w: cur.dev, wrap: b64(wrap) }, meta ? { meta } : {});
    cur.slots.push(slot); writeShadow(cur);
    return slot;
  }
  // addPassphrase(text, opts): opts.iter sets the stretch count (the seal's own default otherwise).
  function addPassphrase(text, opts) {
    const min = (seal() && seal().PASS_MIN) || 8;
    if (typeof text !== 'string' || text.length < min) return Promise.reject(fail('Use at least ' + min + ' characters.', 'short'));
    return addSlot('passphrase', Object.assign({ passphrase: text }, opts && opts.iter ? { iter: opts.iter } : {}));
  }
  // addPasskey(): a passkey of this device (or of its password manager) becomes a way to open. No passkey that can
  // seal here -> err.code 'no-prf' (the page then offers a passphrase).
  async function addPasskey() {
    const sh = shadow() || begin();
    const made = await seal().passkey.create('My identity', 'identity-' + sh.id.slice(0, 8));
    return addSlot('passkey', { key: made.key }, made.meta);
  }
  function removeSlot(id) { const sh = shadow(); if (!sh) return false; const s = sh.slots.find((x) => x.id === id && !x.gone); if (!s) return false; s.gone = 1; s.at = Date.now(); delete s.wrap; writeShadow(sh); return true; }

  // ---- the GIF -------------------------------------------------------------------------------------------------------
  // clearPart(sh): identity.json, readable without the seal: what a device needs to open the file, nothing about the person.
  const clearPart = (sh) => ({ v: 1, kind: 'gifos-identity', slots: sh.slots.filter((s) => !s.gone).map((s) => Object.assign({ id: s.id, kind: s.kind, at: s.at, wrap: s.wrap }, s.meta ? { meta: s.meta } : {})) });
  // pack(base) -> GIF bytes: base is a GifOS GIF (the icon and its manifest); the records go inside the seal.
  async function pack(base) {
    const sh = shadow(); if (!sh) throw fail('No identity on this device.', 'none');
    const d = Object.assign(doc(), { slots: shadow().slots });
    const g = GifOS.gif, arc = await g.decode(base);
    if (!arc || !arc.files) throw fail('not a GifOS gif', 'damaged');
    const files = {};
    for (const p of Object.keys(arc.files)) if (p.indexOf('.lock/') !== 0 && p.indexOf('.state/') !== 0) files[p] = arc.files[p];
    files[CLEAR_PATH] = enc(JSON.stringify(clearPart(shadow())));
    const clear = await g.repack(base, files);
    const extra = {}; extra[DOC_PATH] = enc(JSON.stringify(d));
    return seal().sealGif(clear, { key: await mkKey(sh.mk) }, extra);
  }
  // look(bytes) -> { slots } when the GIF is an identity (nothing is opened), else null.
  async function look(bytes) {
    try {
      const arc = await GifOS.gif.decode(bytes);
      const raw = arc && arc.files && arc.files[CLEAR_PATH]; if (!raw || !arc.files['.lock/v1']) return null;
      const c = JSON.parse(typeof raw === 'string' ? raw : dec(raw));
      if (!c || c.kind !== 'gifos-identity' || !Array.isArray(c.slots)) return null;
      return { slots: c.slots.filter(okSlot) };
    } catch (e) { return null; }
  }
  // open(bytes, how) -> the copy inside ({ id, born, recs, mk, slots }). how: { passphrase } or { passkey: true }, or
  // nothing on the device that wrote it (its own master key opens it). Wrong passphrase -> err.code 'wrong-secret'.
  async function open(bytes, how) {
    const seen = await look(bytes); if (!seen) throw fail('That is not a GifOS identity.', 'not-identity');
    how = how || {};
    const tryMk = async (mk) => {
      const r = await seal().openGif(bytes, { key: await mkKey(mk) });
      const raw = r.files && r.files[DOC_PATH]; if (!raw) throw fail('The identity file is damaged.', 'damaged');
      const d = JSON.parse(typeof raw === 'string' ? raw : dec(raw));
      if (!d || d.kind !== 'gifos-identity') throw fail('The identity file is damaged.', 'damaged');
      return Object.assign(d, { mk, slots: Array.isArray(d.slots) ? d.slots : seen.slots });
    };
    const sh = shadow();
    if (sh && !how.passphrase && !how.passkey) { try { return await tryMk(sh.mk); } catch (e) { throw fail('This file needs its passphrase or passkey.', 'need-secret'); } }
    let last = null;
    for (const s of seen.slots) {
      if (s.gone) continue;
      try {
        let raw = null;
        if (s.kind === 'passphrase' && typeof how.passphrase === 'string') raw = await seal().openBytes(unb64(s.wrap), { passphrase: how.passphrase });
        else if (s.kind === 'passkey' && how.passkey && (!how.slot || how.slot === s.id)) raw = await seal().openBytes(unb64(s.wrap), { key: await seal().passkey.key(s.meta) });
        if (raw && raw.length === 32) return await tryMk(b64(raw));
      } catch (e) { last = e; }
    }
    if (last && last.code && last.code !== 'wrong-secret') throw last;
    throw fail(how.passphrase != null ? 'Wrong passphrase.' : 'This passkey did not open the file.', 'wrong-secret');
  }

  // ---- the GIF in the Identity folder ----------------------------------------------------------------------------
  // The file sits in the device's GIF store under one fixed id; the Home Screen places it in the Identity folder
  // (desktop.js ensureIdentity). Every page that changes the identity rewrites it: sync().
  const FILE_ID = 'identity_me', FILE_NAME = 'My identity.gif', ACCENT = [64, 196, 170];
  const MANIFEST = { gifos: '1.0', type: 'identity', appId: 'gifos-identity', name: 'My identity', accent: ACCENT };
  const packedMark = (sh) => mark(canon([sh.id, sh.st, sh.slots, sh.keep]));
  let syncing = null;
  // sync() -> true when this device holds an identity (made now if there is something to hold). The GIF in the store
  // is rewritten when anything changed since it was last written, or when it is missing.
  function sync() {
    if (syncing) return syncing;
    syncing = (async () => {
      if (!shadow()) { if (!worth()) return false; begin(); }
      scan();
      const st = GifOS.store, g = GifOS.gif; if (!st || !g || !seal()) return true;
      let file = null; try { file = await st.getFile(FILE_ID); } catch (e) {}
      const sh = shadow(), pm = packedMark(sh);
      if (file && file.bytes && sh.packed === pm) return true;
      let base = file && file.bytes ? (file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes)) : null;
      if (!base) base = await g.encode({ 'manifest.json': JSON.stringify(MANIFEST) }, { accent: ACCENT, seed: 7 });
      const bytes = await pack(base);
      await st.putFile({ id: FILE_ID, name: FILE_NAME, bytes, kind: 'gif', isApp: false, appId: MANIFEST.appId, accent: ACCENT, mime: 'image/gif' });
      const now = shadow(); now.packed = packedMark(now); writeShadow(now);
      try { if (typeof root.BroadcastChannel === 'function' && st.syncChannel) { const ch = new root.BroadcastChannel(st.syncChannel); ch.postMessage(1); ch.close(); } } catch (e) {}
      return true;
    })();
    const done = () => { syncing = null; };
    syncing.then(done, done);
    return syncing;
  }
  // fileBytes() -> the sealed GIF as it is now (what a download carries).
  async function fileBytes() {
    await sync();
    const file = await GifOS.store.getFile(FILE_ID);
    if (!file || !file.bytes) throw fail('No identity on this device.', 'none');
    return file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes);
  }

  // ---- the file a person keeps ---------------------------------------------------------------------------------------
  // What the person last kept (downloaded), so the page can say what a lost browser would now lose.
  // privates: how many private rooms that file holds (a file just opened may hold fewer than this device does now).
  function noteSaved(privates) { const sh = shadow(); if (!sh) return; const c = counts(); sh.saved = { at: Date.now(), privates: typeof privates === 'number' ? Math.min(privates, c.privates) : c.privates }; delete sh.later; writeShadow(sh); }
  function noteLater() { const sh = shadow(); if (!sh) return; sh.later = Date.now(); writeShadow(sh); }
  // nudge() -> null, or { kind: 'first' | 'more', privates, since }: say "keep your identity file" now.
  //   first: there is a private room and no file was ever kept.   more: private rooms were added since the kept file.
  // "Later" is honoured for IDENTITY_NUDGE_LATER_MS, then it is said again: losing private rooms must be hard to do by accident.
  function nudge(now) {
    const sh = shadow(); if (!sh) return null;
    const c = counts(); if (!c.privates && !c.mine) return null;
    now = now || Date.now();
    if (sh.later && now - sh.later < (T().IDENTITY_NUDGE_LATER_MS || 0)) return null;
    if (!sh.saved) return c.privates ? { kind: 'first', privates: c.privates } : null;
    if (c.privates > (sh.saved.privates || 0)) return { kind: 'more', privates: c.privates - (sh.saved.privates || 0), since: sh.saved.at };
    return null;
  }
  function status() {
    const sh = shadow(); if (!sh) return { exists: false, worth: worth() };
    const c = counts();
    const devs = Object.keys(sh.keep || {}).filter((rid) => classOf(rid) === 'device' && !sh.keep[rid].d).map((rid) => Object.assign({ id: rid.slice(7), here: rid.slice(7) === sh.dev }, sh.keep[rid].v));
    return { exists: true, id: sh.id, born: sh.born, counts: c, slots: slots().map((s) => ({ id: s.id, kind: s.kind, at: s.at, here: s.w === sh.dev })), saved: sh.saved || null, devices: devs, nudge: nudge() };
  }

  // ---- device to device: the copy code ----------------------------------------------------------------------------
  function newCode() { const u = rand(CODE_LEN); let s = ''; for (let i = 0; i < CODE_LEN; i++) s += CODE_ABC[u[i] % CODE_ABC.length]; return s; }
  const tidyCode = (s) => String(s || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '').replace(/0/g, '').replace(/1/g, '').replace(/U/g, '').slice(0, CODE_LEN);
  const showCode = (c) => String(c).replace(/(.{4})(?=.)/g, '$1-');
  // The code never crosses the channel: both ends stretch it into two keys (one proves, one seals), bound to the room.
  async function codeKeys(code, roomKey) {
    const base = await subtle().importKey('raw', enc(tidyCode(code)), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc('gifos-identity-copy|' + String(roomKey).toLowerCase()), iterations: 200000 }, base, 512));
    return {
      mac: await subtle().importKey('raw', bits.subarray(0, 32), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']),
      box: await subtle().importKey('raw', bits.subarray(32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']),
    };
  }
  const proofOf = async (keys, what, sid, from, to) => b64(new Uint8Array(await subtle().sign('HMAC', keys.mac, enc([what, sid, from, to].join('|')))));
  const proofOk = async (keys, p, what, sid, from, to) => { try { return typeof p === 'string' && p.length < 100 && await subtle().verify('HMAC', keys.mac, unb64(p), enc([what, sid, from, to].join('|'))); } catch (e) { return false; } };
  async function boxSeal(keys, what, sid, obj) {
    const iv = rand(12), ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: enc(what + '|' + sid) }, keys.box, enc(JSON.stringify(obj))));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return b64(out);
  }
  async function boxOpen(keys, what, sid, text) {
    const u = unb64(text);
    return JSON.parse(dec(new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12), additionalData: enc(what + '|' + sid) }, keys.box, u.subarray(12)))));
  }
  // What one device hands the other: the records, and the seal (so files from either device open the same ways).
  function bundle() { const d = doc(); const sh = shadow(); return Object.assign(d, { mk: sh.mk, slots: sh.slots }); }

  // copier(host) -> one meeting's copy part. host: { room(), v(), myId(), owner(), send(pid, frame), peers() (pages I can
  // reach now), now() }. The frames ride the meeting's My Room channel ({k:'mr', op:'id…'}), authenticated and end-to-end
  // encrypted like every My Room frame.
  //   getter -> giver   {op:'idask', sid, n, p}            "I know the code" (n: this device's name; p: a proof bound to both pages)
  //   giver  -> getter  {op:'idok', sid, p}                 "so do I", then its copy:
  //   either -> other   {op:'idpart', sid, w, x, i, of, d}  one share of a sealed copy (w: 'give' or 'back'; x: which sending)
  //   giver  -> getter  {op:'iddone', sid}                  the way back arrived: both hold the same identity now
  //   giver  -> getter  {op:'idno', sid}                    this code is not good here (wrong, used or run out)
  function copier(host) {
    const listeners = [];
    const emit = (ev) => { for (const f of listeners.slice()) { try { f(ev); } catch (e) {} } };
    const rk = () => String(host.room() + '.' + host.v()).toLowerCase();
    let give = null;   // { code, keys, at, tries, sid?, pid?, state: 'shown' | 'copying' | 'done' }
    let get = null;    // { keys, sid, at, state: 'asking' | 'copying' | 'done' | 'no', told: Set, pid? }
    const parts = new Map();   // sid|w -> { of, x, got: [], n }
    let lastDone = null;       // { sid, pid }: the copy that finished here (its other page may not have heard yet)
    async function offer() {
      if (!host.owner()) throw fail('Open your personal room on this device first.', 'not-owner');
      if (!shadow()) begin();
      const code = newCode();
      give = { code, keys: await codeKeys(code, rk()), at: host.now(), tries: 0, state: 'shown' };
      emit({ type: 'give', state: 'shown', code });
      return code;
    }
    function stop() { if (give) { give = null; emit({ type: 'give', state: 'off' }); } if (get && get.state !== 'done') { get = null; emit({ type: 'get', state: 'off' }); } }
    async function ask(code) {
      const c = tidyCode(code); if (c.length !== CODE_LEN) throw fail('The code has ' + CODE_LEN + ' letters and digits.', 'short');
      get = { keys: await codeKeys(c, rk()), sid: hex(rand(8)), at: host.now(), state: 'asking', n: 0 };
      emit({ type: 'get', state: 'asking' });
      tick();
    }
    async function sendCopy(pid, keys, sid, w) {
      const text = await boxSeal(keys, w, sid, bundle());
      const of = Math.ceil(text.length / CHUNK), x = hex(rand(4));   // x: this sending (a copy said again is sealed again)
      for (let i = 0; i < of; i++) host.send(pid, { op: 'idpart', sid, w, x, i, of, d: text.slice(i * CHUNK, (i + 1) * CHUNK) });
    }
    function tick() {
      const now = host.now(), life = T().IDENTITY_CODE_MS || 0;
      if (give && give.state === 'shown' && now - give.at > life) { give = null; emit({ type: 'give', state: 'expired' }); }
      if (!get) return;
      if (get.state === 'asking') {
        if (now - get.at > life) { get = null; emit({ type: 'get', state: 'expired' }); return; }
        for (const pid of host.peers()) askOne(pid);
        return;
      }
      // A channel to a door can close in the middle (a held page's channel is short-lived): every third tick the step
      // that is waiting is said again. Each step is safe to repeat.
      if (++get.n % 3) return;
      // Twice the code's life: a copy under way gets that long to finish.
      if (now - get.at > life + life) { if (get.state === 'copying') { get = null; emit({ type: 'get', state: 'expired' }); } else get = null; return; }
      if (get.state === 'copying') askOne(get.pid);
      else if (get.state === 'done' && get.back) sendCopy(get.pid, get.keys, get.sid, 'back').catch(() => {});
    }
    function askOne(pid) {
      if (!get || pid === host.myId()) return;
      const g = get;
      proofOf(g.keys, 'ask', g.sid, host.myId(), pid).then((p) => { if (get === g && (g.state === 'asking' || g.state === 'copying')) host.send(pid, { op: 'idask', sid: g.sid, n: deviceName(), p }); }, () => {});
    }
    // A door holds this page: its channel is open right now, so the ask goes at once.
    function onHeld(pid) { if (get && get.state === 'asking') askOne(pid); }
    async function onMsg(pid, m) {
      if (!m || typeof m.op !== 'string' || typeof m.sid !== 'string' || m.sid.length > 32) return;
      const me = host.myId();
      if (m.op === 'idask') {
        if (!host.owner()) return;
        if (!give) { host.send(pid, { op: 'idno', sid: m.sid }); return; }   // this room's owner shows no code now
        if (give.state !== 'shown') {
          // The same page asking again for the copy under way (its channel closed in the middle): the copy is sent again.
          if (give.sid === m.sid && give.pid === pid) { if (await proofOk(give.keys, m.p, 'ask', m.sid, pid, me)) { host.send(pid, { op: 'idok', sid: m.sid, p: await proofOf(give.keys, 'ok', m.sid, me, pid) }); await sendCopy(pid, give.keys, m.sid, 'give'); } }
          else host.send(pid, { op: 'idno', sid: m.sid });
          return;
        }
        if (!(await proofOk(give.keys, m.p, 'ask', m.sid, pid, me))) {
          if (!give || give.state !== 'shown') return;
          give.tries++; host.send(pid, { op: 'idno', sid: m.sid });
          if (give.tries >= 5) { give = null; emit({ type: 'give', state: 'spent' }); }   // a code is not guessed at
          return;
        }
        if (!give || give.state !== 'shown') return;
        give.state = 'copying'; give.sid = m.sid; give.pid = pid; give.name = String(m.n || '').slice(0, 40);
        emit({ type: 'give', state: 'copying', name: give.name });
        host.send(pid, { op: 'idok', sid: m.sid, p: await proofOf(give.keys, 'ok', m.sid, me, pid) });
        await sendCopy(pid, give.keys, m.sid, 'give');
        return;
      }
      if (m.op === 'idok') {
        if (!get || get.state !== 'asking' || m.sid !== get.sid) return;
        if (!(await proofOk(get.keys, m.p, 'ok', m.sid, pid, me))) return;
        if (!get || get.state !== 'asking') return;
        get.state = 'copying'; get.pid = pid; get.n = 0; emit({ type: 'get', state: 'copying' });
        return;
      }
      // Only a page that holds the room answers at all: its no is the answer (the person checks the code and types it again).
      if (m.op === 'idno') { if (get && get.state === 'asking' && m.sid === get.sid) { get = null; emit({ type: 'get', state: 'no' }); } return; }
      if (m.op === 'idpart') {
        const giving = !!(give && give.state === 'copying' && give.sid === m.sid && give.pid === pid && m.w === 'back');
        const getting = !!(get && get.state === 'copying' && get.sid === m.sid && get.pid === pid && m.w === 'give');
        if (!giving && !getting) { if (lastDone && lastDone.sid === m.sid && lastDone.pid === pid && m.w === 'back' && m.i === 0) host.send(pid, { op: 'iddone', sid: m.sid }); return; }
        if (typeof m.d !== 'string' || !(m.of >= 1 && m.of <= Math.ceil(MAX_COPY / CHUNK)) || !(m.i >= 0 && m.i < m.of) || m.d.length > CHUNK) return;
        const k = m.sid + '|' + m.w; let pt = parts.get(k);
        if (!pt || pt.of !== m.of || pt.x !== m.x) { pt = { of: m.of, x: m.x, got: [], n: 0 }; parts.set(k, pt); }
        if (pt.got[m.i] == null) { pt.got[m.i] = m.d; pt.n++; }
        if (pt.n < pt.of) return;
        parts.delete(k);
        const keys = giving ? give.keys : get.keys;
        let theirs; try { theirs = await boxOpen(keys, m.w, m.sid, pt.got.join('')); } catch (e) { return; }
        if (getting) {
          // This device has the identity from here on. What it had goes back, so both end with everything; the way
          // back is said again until the other page says done.
          const g = get, r = take(theirs);
          g.state = 'done'; g.back = true; g.n = 0;
          emit({ type: 'get', state: 'done', counts: r.counts, news: r.news.length });
          await sendCopy(pid, g.keys, m.sid, 'back');
        } else {
          const r = take(theirs);
          give.state = 'done'; lastDone = { sid: m.sid, pid }; host.send(pid, { op: 'iddone', sid: m.sid });
          emit({ type: 'give', state: 'done', name: give.name, counts: r.counts, news: r.news.length });
          give = null;
        }
        return;
      }
      if (m.op === 'iddone') {
        if (!get || get.state !== 'done' || m.sid !== get.sid || pid !== get.pid) return;
        get.back = false;
      }
    }
    return { on: (f) => { listeners.push(f); return () => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }; }, offer, ask, stop, tick, onMsg, onHeld, state: () => ({ give: give ? { state: give.state, code: give.code, name: give.name || '' } : null, get: get ? { state: get.state, back: !!get.back } : null }) };
  }

  GifOS.identity = {
    SHADOW, DOC_PATH, CLEAR_PATH, CODE_LEN,
    useStore, collect, put, canon, mergeRecs,
    exists, worth, begin, scan, doc, take, counts, status,
    slots, addPassphrase, addPasskey, removeSlot,
    pack, look, open, sync, fileBytes, FILE_ID, FILE_NAME, MANIFEST,
    noteSaved, noteLater, nudge,
    newCode, tidyCode, showCode, codeKeys, copier, deviceName, bundle,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = GifOS.identity;
})(typeof window !== 'undefined' ? window : globalThis);
