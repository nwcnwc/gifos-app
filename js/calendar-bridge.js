/*
 * calendar-bridge.js — the page side of Calendar. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * Calendar (a seeded system app) asks this page to keep its invitations, its reminders and a room it wants to
 * schedule. The invitations travel only over a private room's authenticated channel (js/meet-myroom.js, op 'cal'):
 * nothing is sent to a server. While Calendar is open, and while a note is still waiting, this page opens a hidden
 * listening door into that private room, the same kind the personal room's standby opens (js/core/view/myroom.js
 * listenAll). A phone keeps five of those doors, and only while Calendar is open. A computer uses the personal
 * room's own limit.
 *
 * These four keys stay on this device on purpose. An invitation waiting to go out, one just received, a reminder
 * and a room handed to Calendar are this browser's, not a setting that follows a person (they are not in the
 * identity follow list). The calendar itself lives in the app's own database.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  if (GifOS.calendarBridge) return;
  const T = () => GifOS.timings || {};
  const OUT = 'gifos_calendar_out';
  const IN = 'gifos_calendar_in';
  const ALARMS = 'gifos_calendar_alarms';
  const DRAFT = 'gifos_calendar_draft';
  const PHONE_DOORS = 5;   // a phone, and only while Calendar is open
  const BOX_MAX = 200;
  const ICS_MAX = 65536;

  const store = () => { try { return root.localStorage || null; } catch (e) { return null; } };
  function readList(k) { try { const s = store(); const v = s ? JSON.parse(s.getItem(k) || 'null') : null; return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function writeList(k, v) { try { const s = store(); if (s) s.setItem(k, JSON.stringify(v)); } catch (e) {} }
  const hex = (u) => Array.from(u).map((b) => b.toString(16).padStart(2, '0')).join('');
  function randHex(n) { const u = new Uint8Array(n); root.crypto.getRandomValues(u); return hex(u); }
  const roomKey = (room, v) => (room && v ? room + '.' + String(v).toLowerCase() : '');
  const cidOf = (r) => roomKey(r.room, r.v);
  const MR = () => GifOS.meetMyRoom;

  // The seeded system Calendar, and only that file. A store app that copies the manifest is not it.
  function seededCalendar(file, manifest) {
    const caps = manifest && manifest.capabilities;
    return !!(file && file.isApp && file.isDefault && file.appId === 'calendar' && caps && caps.calendar === true);
  }
  // A release snapshot names itself. The site root is the edge build (the same rule as the build badge).
  function edgeBuild() {
    if (root.GIFOS_VERSION === 'edge') return true;
    if (root.GIFOS_VERSION) return false;
    try {
      const src = String((root.document && root.document.baseURI) || (root.location && root.location.href) || '');
      if (/\/versions\/\d+\.\d+/.test(src)) return false;
    } catch (e) {}
    return true;
  }
  function scheduleShown() { return edgeBuild() && !!MR(); }

  function phone() {
    try {
      const nav = root.navigator || {};
      return !!((nav.userAgentData && nav.userAgentData.mobile) || /Android|iPhone|iPad|Mobi/i.test(nav.userAgent || ''));
    } catch (e) { return false; }
  }

  let active = false;
  const inboxCbs = [];
  const doors = new Map();   // cid -> { el, part, off, id, busy, lastTry }

  function contacts() {
    const M = MR(); if (!M) return [];
    const seen = new Set();
    const out = [];
    for (const r of M.privates()) {
      if (!r || (r.pubs || []).length !== 1) continue;
      const cid = cidOf(r); if (!cid || seen.has(cid)) continue;
      seen.add(cid);
      out.push({ cid, name: r.name || '', avatar: '' });
    }
    return out;
  }
  function recOf(cid) {
    const M = MR(); if (!M) return null;
    for (const r of M.privates()) if (cidOf(r) === cid && (r.pubs || []).length === 1) return r;
    return null;
  }

  function expired(row) { return !row || root.Date.now() - (row.at || 0) >= (T().CAL_OUT_LIFE_MS || 0); }

  function loadOut() { return readList(OUT).filter((r) => r && r.id && r.cid); }
  function saveOut(rows) { writeList(OUT, rows.slice(0, BOX_MAX)); }
  function loadIn() { return readList(IN).filter((r) => r && r.id); }
  function saveIn(rows) { writeList(IN, rows.slice(-BOX_MAX)); }

  function dropGone() {
    const live = new Set(contacts().map((c) => c.cid));
    const out = loadOut().filter((r) => live.has(r.cid));
    const inn = loadIn().filter((r) => live.has(r.cid));
    if (out.length !== loadOut().length) saveOut(out);
    if (inn.length !== loadIn().length) saveIn(inn);
    for (const cid of Array.from(doors.keys())) if (!live.has(cid)) closeDoor(cid);
  }

  function doorCap() {
    if (phone()) return active ? PHONE_DOORS : 0;
    const n = MR() && MR().LISTEN_MAX;
    return n || 20;
  }
  function wanted() {
    const M = MR(); if (!M || !GifOS.meetHost || !root.document) return [];
    const cap = doorCap(); if (!cap) return [];
    const queued = new Set(loadOut().filter((r) => !expired(r)).map((r) => r.cid));
    const all = M.privates().filter((r) => r && (r.pubs || []).length === 1);
    all.sort((a, b) => ((queued.has(cidOf(b)) ? 1 : 0) - (queued.has(cidOf(a)) ? 1 : 0)) || ((b.last || b.at || 0) - (a.last || a.at || 0)));
    const pick = [];
    for (const r of all) {
      if (pick.length >= cap) break;
      if (queued.has(cidOf(r)) || active) pick.push(r);
    }
    return pick;
  }

  // A hidden listening door, the same kind the personal room's standby opens (js/core/view/myroom.js listenAll):
  // a quiet meetHost session, and the room's part read from the frame. Marked at once so that standby does not
  // adopt it, and this page does not adopt the standby's.
  function openDoor(rec) {
    const cid = cidOf(rec);
    if (!cid || doors.has(cid) || !GifOS.meetHost || !root.document || !GifOS.link) return;
    const d = { el: null, part: null, off: null, id: '', busy: false, lastTry: 0 };
    doors.set(cid, d);
    const path = GifOS.link.pageFor(root.location.pathname, 'meet');
    const link = root.location.origin + path + '#' + GifOS.link.hash({ room: rec.room, v: rec.v });
    GifOS.meetHost.join({ link, name: '', bot: false, listen: true }).then((r) => { d.id = r && r.meetingId || ''; }, () => { if (doors.get(cid) === d && !d.el) doors.delete(cid); });
    d.el = root.document.querySelector('iframe[data-mr-listen]:not([data-mr-room])');
    if (d.el) { d.el.setAttribute('data-mr-room', cid); d.el.setAttribute('data-cal-room', cid); }
  }
  function closeDoor(cid) {
    const d = doors.get(cid); if (!d) return;
    doors.delete(cid);
    if (d.off) { try { d.off(); } catch (e) {} }
    if (d.id && GifOS.meetHost && GifOS.meetHost.leave) { try { GifOS.meetHost.leave(d.id).catch(() => {}); } catch (e) {} }
    else if (d.el && d.el.remove) { try { d.el.remove(); } catch (e) {} }
  }
  function reconcile() {
    dropGone();
    const want = wanted();
    const ids = new Set(want.map(cidOf));
    for (const cid of Array.from(doors.keys())) if (!ids.has(cid)) closeDoor(cid);
    for (const rec of want) openDoor(rec);
  }
  function poll() {
    for (const [cid, d] of doors) {
      if (d.part || !d.el) continue;
      let p = null;
      try { p = d.el.contentWindow && d.el.contentWindow.GifOS && d.el.contentWindow.GifOS.meetMyRoom && d.el.contentWindow.GifOS.meetMyRoom.live; } catch (e) { p = null; }
      if (!p || typeof p.calSend !== 'function') continue;
      d.part = p;
      if (typeof p.on === 'function') d.off = p.on((ev) => { if (ev && ev.type === 'cal') ingest(cid, ev); });
      sendQueued(cid);
    }
  }
  function ingest(cid, ev) {
    const id = String(ev.id || '');
    if (!/^[a-f0-9]{16}$/.test(id)) return;
    const rows = loadIn();
    if (rows.some((r) => r.id === id)) return;
    const rec = recOf(cid);
    const item = { id, cid, name: rec && rec.name || '', kind: ev.kind, ics: String(ev.ics || ''), at: root.Date.now() };
    rows.push(item);
    saveIn(rows);
    for (const cb of inboxCbs.slice()) { try { cb(item); } catch (e) {} }
  }
  function sendQueued(cid) {
    const d = doors.get(cid);
    if (!d || !d.part || d.busy) return;
    const row = loadOut().find((r) => r.cid === cid && !expired(r));
    if (!row) return;
    const wait = (T().CAL_RETRY_MS || 0);
    if (row.tries && root.Date.now() - (d.lastTry || 0) < wait) return;
    d.busy = true;
    d.lastTry = root.Date.now();
    row.tries = (row.tries || 0) + 1;
    const rows = loadOut().map((r) => r.id === row.id ? row : r);
    saveOut(rows);
    Promise.resolve(d.part.calSend(row.kind, row.ics, row.id)).then((ok) => {
      d.busy = false;
      if (ok) saveOut(loadOut().filter((r) => r.id !== row.id));
    }, () => { d.busy = false; });
  }

  let timer = 0;
  function pump() {
    const gone = loadOut().filter(expired);
    if (gone.length) saveOut(loadOut().filter((r) => !expired(r)));
    dropGone();
    if (!GifOS.meetHost) return;
    reconcile();
    poll();
    for (const cid of Array.from(doors.keys())) sendQueued(cid);
  }
  function arm() {
    if (timer || !root.setInterval) return;
    const ms = (T().MYROOM_TICK_MS || 0);
    if (!ms) return;
    const t = root.setInterval(pump, ms);
    if (t && t.unref) t.unref();
    timer = t;
  }

  function post(kind, cid, ics) {
    const body = String(ics == null ? '' : ics);
    if (body.length > ICS_MAX) return Promise.reject(new Error('That invitation is too long.'));
    if (!recOf(cid)) return Promise.resolve({ state: 'queued' });
    const row = { id: randHex(8), cid: String(cid), kind, ics: body, at: root.Date.now(), tries: 0 };
    const rows = loadOut();
    rows.unshift(row);
    saveOut(rows);
    arm();
    if (!GifOS.meetHost) return Promise.resolve({ state: 'queued' });
    reconcile();
    poll();
    const d = doors.get(row.cid);
    if (!d || !d.part) return Promise.resolve({ state: 'queued' });
    d.busy = true;
    d.lastTry = root.Date.now();
    row.tries = 1;
    saveOut(loadOut().map((r) => r.id === row.id ? row : r));
    return Promise.resolve(d.part.calSend(row.kind, row.ics, row.id)).then((ok) => {
      d.busy = false;
      if (ok) { saveOut(loadOut().filter((r) => r.id !== row.id)); return { state: 'sent' }; }
      return { state: 'queued' };
    }, () => { d.busy = false; return { state: 'queued' }; });
  }

  function setAlarms(list) {
    const out = [];
    for (const a of (Array.isArray(list) ? list : []).slice(0, BOX_MAX)) {
      if (!a || typeof a.atMs !== 'number' || typeof a.startMs !== 'number') continue;
      out.push({ atMs: a.atMs, startMs: a.startMs, uid: String(a.uid || ''), title: String(a.title || '').slice(0, 200), link: a.link ? String(a.link) : '' });
    }
    try { const s = store(); if (s) s.setItem(ALARMS, JSON.stringify(out)); } catch (e) {}
    return { ok: true };
  }
  function setDraft(d) {
    d = d || {};
    const row = { title: String(d.title || '').slice(0, 200), link: String(d.link || ''), room: String(d.room || ''), v: d.v ? String(d.v) : '', mode: d.mode === 'open' ? 'open' : 'hosted', at: root.Date.now() };
    try { const s = store(); if (s) s.setItem(DRAFT, JSON.stringify(row)); } catch (e) {}
  }
  function draft() {
    let row = null;
    try { const s = store(); row = s ? JSON.parse(s.getItem(DRAFT) || 'null') : null; if (s) s.removeItem(DRAFT); } catch (e) { row = null; }
    if (!row || typeof row.at !== 'number') return null;
    if (root.Date.now() - row.at >= (T().CAL_DRAFT_MS || 0)) return null;
    return { title: row.title || '', link: row.link || '', room: row.room || '', v: row.v || '', mode: row.mode === 'open' ? 'open' : 'hosted' };
  }

  async function newRoom(opts) {
    const mode = opts && opts.mode === 'open' ? 'open' : 'hosted';
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const u = new Uint8Array(8);
    root.crypto.getRandomValues(u);
    let room = 'meet-';
    for (let i = 0; i < 8; i++) room += alphabet[u[i] % alphabet.length];
    let v = '';
    if (mode === 'hosted') {
      if (!GifOS.net || !GifOS.net.edKeysFromSeedHex) throw new Error('This page cannot make a room.');
      const K = randHex(32);
      v = (await GifOS.net.edKeysFromSeedHex(K)).verifier;
      const s = store(); if (!s) throw new Error('This browser could not keep the room.');
      s.setItem('gifos_vadm_' + roomKey(room, v), K);
    }
    const origin = (root.location && root.location.origin) || '';
    const link = origin + '/meet#' + GifOS.link.hash({ room, v: v || undefined });
    return v ? { room, v, link } : { room, link };
  }

  function join(link) {
    const L = GifOS.link;
    if (!L) return Promise.reject(new Error('No meeting page.'));
    const p = L.parseInput(String(link || ''), root.location && root.location.origin);
    if (!p || !p.room) return Promise.reject(new Error('That is not a meeting link.'));
    const page = L.pageFor((root.location && root.location.pathname) || '/', 'meet');
    root.location.assign(page + '#' + L.hash({ room: p.room, v: p.v || '' }));
    return Promise.resolve({ ok: true });
  }

  async function openCalendar() {
    const storeApi = GifOS.store;
    if (!storeApi || !storeApi.allFileMeta) return false;
    const files = await storeApi.allFileMeta();
    const items = await storeApi.allItems();
    const trashed = {};
    for (let i = 0; i < items.length; i++) if (items[i] && items[i].parent === 'sys_trash') trashed[items[i].fileId] = true;
    const f = (files || []).find((x) => x && x.isApp && x.isDefault && x.appId === 'calendar' && !trashed[x.id]);
    if (!f) return false;
    root.location.assign('run.html#id=' + encodeURIComponent(f.id));
    return true;
  }

  function setActive(on) {
    active = !!on;
    if (active) arm();
    pump();
  }
  function onInbox(cb) {
    if (typeof cb !== 'function') return function () {};
    inboxCbs.push(cb);
    return function () { const i = inboxCbs.indexOf(cb); if (i >= 0) inboxCbs.splice(i, 1); };
  }
  function ack(id) {
    saveIn(loadIn().filter((r) => r.id !== id));
    return { ok: true };
  }

  GifOS.calendarBridge = {
    seededCalendar, scheduleShown, edgeBuild, contacts, newRoom, join, openCalendar,
    invite: (cid, ics) => post('request', cid, ics),
    reply: (cid, ics) => post('reply', cid, ics),
    cancel: (cid, ics) => post('cancel', cid, ics),
    onInbox, ack, setAlarms, setDraft, draft, setActive, pump,
  };
  if (root.document) arm();
  if (typeof module !== 'undefined' && module.exports) module.exports = GifOS.calendarBridge;
})(typeof window !== 'undefined' ? window : globalThis);
