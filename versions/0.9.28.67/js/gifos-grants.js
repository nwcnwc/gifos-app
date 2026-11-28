/*
 * gifos-grants.js — the permission lists of data providers (docs: Data providers).
 * Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * ONE CONCEPT: an app that owns data about you (Me & My Contacts: who you are and who you know; a calendar: your days)
 * keeps a list of what it will give out and to which apps. You grant and take back the entries; the OS checks the
 * list before a request ever reaches the provider.
 *
 *   list      { v:1, list: { <provider>: { <kind>: { <consumer>: { level, name, at } } } } } under gifos_grants (this
 *             device: it is about the apps installed here). provider: 'system:<role>' for the OS's own providers,
 *             'app:<appId>@<fileId>' for a provider app. consumer: the key the OS made for the asking app at mount
 *             (its verified signer + appId, or a hash of its code), never anything the app says about itself.
 *   level     'always' answered without asking until taken back; 'ask' asked each time; 'never' refused without asking.
 *             No entry: asked. "Just this once" is an answer, never an entry.
 *   decide()  the broker's whole rule for one request, pure, so it is the same everywhere and can be read in one place.
 *
 * Attaches to GifOS.grants; require()-able for tools.
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});
  if (GifOS.grants) return;

  const KEY = 'gifos_grants';
  // The fixed vocabulary. Kinds are what a list grants; nobody outside the OS adds one.
  const ROLES = Object.freeze({
    identity: Object.freeze(['name', 'avatar']),
    contacts: Object.freeze(['pick', 'send']),
    calendar: Object.freeze(['freebusy', 'events', 'add']),
  });
  const LEVELS = ['always', 'ask', 'never'];
  const MAX_CONSUMERS = 400;   // per provider and kind: a list a person can still read

  let storeRef = null;
  const ls = () => { if (storeRef) return storeRef; try { return root.localStorage || null; } catch (e) { return null; } };
  function useStore(s) { storeRef = s || null; }
  const okKind = (role, kind) => !!(ROLES[role] && ROLES[role].indexOf(kind) >= 0);
  const okId = (s) => typeof s === 'string' && s.length > 0 && s.length <= 200 && !/[\u0000-\u001f]/.test(s);

  function read() {
    const s = ls(); let doc = null;
    try { doc = s ? JSON.parse(s.getItem(KEY) || 'null') : null; } catch (e) { doc = null; }
    if (!doc || doc.v !== 1 || !doc.list || typeof doc.list !== 'object') doc = { v: 1, list: {} };
    return doc;
  }
  const listeners = [];
  function write(doc) {
    const s = ls(); if (!s) return false;
    try { s.setItem(KEY, JSON.stringify(doc)); } catch (e) { return false; }
    for (const f of listeners.slice()) { try { f(); } catch (e) {} }
    return true;
  }

  function level(provider, kind, consumer) {
    const e = ((read().list[provider] || {})[kind] || {})[consumer];
    return e && LEVELS.indexOf(e.level) >= 0 ? e.level : '';
  }
  // level '' removes the entry (back to "asked").
  function set(provider, kind, consumer, lvl, name, appId) {
    if (!okId(provider) || !okId(kind) || !okId(consumer)) return false;
    if (lvl && LEVELS.indexOf(lvl) < 0) return false;
    const doc = read();
    const byKind = (doc.list[provider] = doc.list[provider] || {});
    const byCon = (byKind[kind] = byKind[kind] || {});
    if (!lvl) delete byCon[consumer];
    else {
      const was = byCon[consumer] || {};
      // appId is the app's own word: shown beside the name, never used to decide.
      byCon[consumer] = { level: lvl, name: String(name || was.name || '').slice(0, 80), appId: String(appId || was.appId || '').slice(0, 80), at: Date.now() };
      const ids = Object.keys(byCon);
      if (ids.length > MAX_CONSUMERS) { ids.sort((a, b) => (byCon[a].at || 0) - (byCon[b].at || 0)); for (const id of ids.slice(0, ids.length - MAX_CONSUMERS)) delete byCon[id]; }
    }
    if (!Object.keys(byCon).length) delete byKind[kind];
    if (!Object.keys(byKind).length) delete doc.list[provider];
    return write(doc);
  }
  // Take back what one app may have from one provider: every kind, or one.
  function revoke(provider, consumer, kind) {
    const doc = read(); const byKind = doc.list[provider]; if (!byKind) return false;
    for (const k of Object.keys(byKind)) { if (kind && k !== kind) continue; delete byKind[k][consumer]; if (!Object.keys(byKind[k]).length) delete byKind[k]; }
    if (!Object.keys(byKind).length) delete doc.list[provider];
    return write(doc);
  }
  function entries(provider) {
    const doc = read(), out = [];
    for (const p of Object.keys(doc.list)) {
      if (provider && p !== provider) continue;
      for (const k of Object.keys(doc.list[p])) for (const c of Object.keys(doc.list[p][k])) {
        const e = doc.list[p][k][c]; out.push({ provider: p, kind: k, consumer: c, name: e.name || '', appId: e.appId || '', level: e.level, at: e.at || 0 });
      }
    }
    return out.sort((a, b) => (a.name || a.consumer).localeCompare(b.name || b.consumer) || a.kind.localeCompare(b.kind));
  }

  /*
   * decide(q) -> { go: 'serve' | 'ask' | 'refuse', why }
   *   q.role, q.kind       what is asked for
   *   q.declared           the asking app's manifest declares this ability (it shows on its Abilities sheet)
   *   q.optedOut           the person switched that ability off for the app
   *   q.provider           { recognised, networky } of the provider that would answer, or null when none can
   *   q.level              the provider's list entry for this consumer and kind ('' when none)
   *   q.inMeeting          the app runs inside a meeting (its room already shows the person's name and picture)
   * The order is the rule: the app must have said it wants this; the person must not have turned it off; a provider
   * must be there, recognised and network-less; then the list decides, and with no entry the person is asked. A pick
   * is always the person's choice (the picker IS the ask), so only 'never' answers it without them.
   */
  function decide(q) {
    q = q || {};
    if (!okKind(q.role, q.kind)) return { go: 'refuse', why: 'unknown' };
    if (!q.declared) return { go: 'refuse', why: 'undeclared' };
    if (q.optedOut) return { go: 'refuse', why: 'off' };
    if (!q.provider) return { go: 'refuse', why: 'no-provider' };
    if (!q.provider.recognised) return { go: 'refuse', why: 'not-recognised' };
    if (q.provider.networky) return { go: 'refuse', why: 'networky' };
    if (q.role === 'identity' && q.inMeeting) return { go: 'serve', why: 'meeting' };
    if (q.level === 'never') return { go: 'refuse', why: 'denied' };
    if (q.kind === 'pick') return { go: 'ask', why: 'pick' };
    if (q.level === 'always') return { go: 'serve', why: 'granted' };
    return { go: 'ask', why: q.level === 'ask' ? 'each-time' : 'new' };
  }

  GifOS.grants = { KEY, ROLES, LEVELS, useStore, read, level, set, revoke, entries, decide, okKind, on: (f) => { listeners.push(f); return () => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = GifOS.grants;
})(typeof window !== 'undefined' ? window : globalThis);
