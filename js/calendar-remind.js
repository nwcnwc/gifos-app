/*
 * calendar-remind.js — a meeting reminder while Calendar is closed. Copyright (c) 2026 Crowd Concepts, Inc.
 * All rights reserved.
 *
 * Calendar leaves its alarms on this device (gifos_calendar_alarms). This page looks every few seconds, and when
 * the tab becomes visible, and shows the first one that is due: the same sheet the page uses for a dialog, the
 * incoming-call ring three times, and a system notification when the tab is hidden and the person has already
 * allowed notifications. It never asks for that permission. One tab of this browser shows it (a Web Lock). The
 * Doorbell and a tab that is fully closed are not this page's job.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  if (GifOS.calendarRemind) return;
  const T = () => GifOS.timings || {};
  const ALARMS = 'gifos_calendar_alarms';
  const SHOWN = 'gifos_calendar_shown';
  const CLAIM = 'gifos_calendar_claim';   // this browser's claim for one reminder; not a setting that follows a person

  function edgeBuild() {
    if (root.GIFOS_VERSION === 'edge') return true;
    if (root.GIFOS_VERSION) return false;
    try {
      const src = String((root.document && root.document.baseURI) || (root.location && root.location.href) || '');
      if (/\/versions\/\d+\.\d+/.test(src)) return false;
    } catch (e) {}
    return true;
  }
  function read() { try { const v = JSON.parse(root.localStorage.getItem(ALARMS) || 'null'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function write(rows) { try { root.localStorage.setItem(ALARMS, JSON.stringify(rows)); } catch (e) {} }
  const keyOf = (a) => String(a.uid || '') + ':' + a.atMs;
  function shownSet() { try { const v = JSON.parse(root.sessionStorage.getItem(SHOWN) || '[]'); return new Set(Array.isArray(v) ? v : []); } catch (e) { return new Set(); } }
  function mark(k) { const s = shownSet(); s.add(k); try { root.sessionStorage.setItem(SHOWN, JSON.stringify(Array.from(s).slice(-200))); } catch (e) {} }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // The incoming-call ring: two tones, two seconds (js/core/view/myroom.js ringOnce). Used when that view is not on this page.
  let ac = null;
  function tone() {
    if (!ac) { try { const AC = root.AudioContext || root.webkitAudioContext; ac = AC ? new AC() : null; } catch (e) { ac = null; } }
    if (!ac) return;
    try {
      const g = ac.createGain(); g.gain.value = 0; g.connect(ac.destination);
      const t0 = ac.currentTime;
      g.gain.setValueAtTime(0.12, t0); g.gain.setValueAtTime(0.12, t0 + 1.9); g.gain.linearRampToValueAtTime(0, t0 + 2);
      for (const f of [440, 480]) { const o = ac.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t0); o.stop(t0 + 2); }
    } catch (e) {}
  }
  function chime() {
    if (GifOS.myRoomRing && GifOS.myRoomRing.brief) { GifOS.myRoomRing.brief(3); return; }
    let left = 3;
    const step = () => { tone(); if (--left > 0) root.setTimeout(step, (T().MYROOM_TICK_MS || 0) * 2); };
    step();
  }

  function go(link) {
    const L = GifOS.link; if (!L) return;
    const p = L.parseInput(String(link || ''), root.location && root.location.origin);
    if (!p || !p.room) return;
    const page = L.pageFor((root.location && root.location.pathname) || '/', 'meet');
    root.location.assign(page + '#' + L.hash({ room: p.room, v: p.v || '' }));
  }

  let sheet = null;
  function closeSheet() { if (sheet && sheet.remove) sheet.remove(); sheet = null; }
  function draw(a) {
    const doc = root.document; if (!doc || !doc.body) return;
    closeSheet();
    const soon = root.Date.now() < a.startMs;
    const line = soon ? 'starts in 5 min' : 'starts now';
    const bg = doc.createElement('div');
    bg.className = 'modal-bg'; bg.id = 'cal-remind';
    const join = a.link ? '<button type="button" data-cal-join>Join</button>' : '';
    bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><h3>' + esc(a.title || 'Meeting') + '</h3><p>' + line + '</p><div class="dlg-actions">' + join + '<button type="button" data-cal-snooze>Snooze 5 min</button><button type="button" data-cal-dismiss>Dismiss</button></div></div>';
    doc.body.appendChild(bg);
    sheet = bg;
    const j = bg.querySelector('[data-cal-join]');
    if (j) j.onclick = () => { closeSheet(); go(a.link); };
    bg.querySelector('[data-cal-snooze]').onclick = () => {
      const rows = read();
      const hit = rows.find((r) => keyOf(r) === keyOf(a));
      if (hit) hit.atMs = root.Date.now() + (T().CAL_SNOOZE_MS || 0);
      write(rows);
      closeSheet();
    };
    bg.querySelector('[data-cal-dismiss]').onclick = () => {
      mark(keyOf(a));
      write(read().filter((r) => keyOf(r) !== keyOf(a)));
      closeSheet();
    };
    chime();
    try {
      if (doc.hidden && root.Notification && root.Notification.permission === 'granted') new root.Notification(a.title || 'Meeting', { body: line });
    } catch (e) {}
  }

  function due(now) {
    const late = (T().CAL_LATE_MS || 0);
    const seen = shownSet();
    const rows = read().filter((a) => a && typeof a.atMs === 'number' && typeof a.startMs === 'number' && a.atMs <= now && now < a.startMs + late && !seen.has(keyOf(a)));
    rows.sort((a, b) => a.atMs - b.atMs);
    return rows[0] || null;
  }
  async function claim(key) {
    const take = () => {
      let cur = null;
      try { cur = JSON.parse(root.localStorage.getItem(CLAIM) || 'null'); } catch (e) {}
      if (cur && cur.key === key && root.Date.now() - cur.at < (T().CAL_LATE_MS || 0)) return false;
      try { root.localStorage.setItem(CLAIM, JSON.stringify({ key, at: root.Date.now() })); } catch (e) {}
      return true;
    };
    const locks = root.navigator && root.navigator.locks;
    if (!locks || typeof locks.request !== 'function') return take();
    let won = false;
    try {
      await locks.request('gifos-calendar-remind', { ifAvailable: true }, (lock) => { if (lock) won = take(); });
    } catch (e) { return take(); }
    return won;
  }
  let showing = false;
  async function check() {
    if (showing || sheet) return;
    const a = due(root.Date.now()); if (!a) return;
    const k = keyOf(a);
    showing = true;
    const won = await claim(k);
    showing = false;
    if (!won || sheet || shownSet().has(k)) return;
    mark(k);
    draw(a);
  }

  let started = false;
  function start() {
    if (started || !edgeBuild()) return;
    started = true;
    const ms = (T().CAL_REMIND_MS || 0);
    if (ms && root.setInterval) { const t = root.setInterval(check, ms); if (t && t.unref) t.unref(); }
    if (root.document) root.document.addEventListener('visibilitychange', () => { check(); });
    check();
  }

  GifOS.calendarRemind = { start, tone };
  if (typeof module !== 'undefined' && module.exports) module.exports = GifOS.calendarRemind;
  if (root.document) {
    const boot = () => { try { start(); } catch (e) {} };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
