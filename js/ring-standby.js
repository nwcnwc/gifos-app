/*
 * ring-standby.js — "Ring me on this device". Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * ONE SETTING (Rooms → Ringing, and the meeting's Settings): Ring me on this device. Behind it, the best way this device
 * has, picked here and never asked:
 *   push   the Doorbell (js/meet-bell.js): rings even when GifOS is closed, where the browser can show notifications.
 *   open   otherwise, while GifOS is open in any tab of this browser. One tab per device stands by (a Web Lock): it opens
 *          hidden doors (js/meet-host.js sessions) in our private rooms and in my personal room, and a ring there shows
 *          here with Answer and Decline. This covers an iPhone's Safari without a Home Screen install.
 * No tab ever moves into a room by itself: Answer (the person's tap) takes it there. A tab in a meeting never stands by.
 * My personal room's own page takes the doors over while it is open (it listens itself: js/core/view/myroom.js).
 * The switch is stored as My Room's device-only `stay` flag (its first name, "stay in my personal room", is retired: a
 * device that had it on now simply rings).
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const doc = root.document;
  if (!doc || GifOS.ringHere) return;
  const T = () => GifOS.timings || {};
  const MR = () => GifOS.meetMyRoom;
  const B = () => GifOS.bell;
  const LOCK = 'gifos-ring-standby';
  const STAY = 'gifos_myroom_stay';
  const PHONE_DOORS = 5;   // a phone stands by in its 5 most recently used private rooms (each door is a meeting page)
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = (k) => { try { return root.localStorage.getItem(k); } catch (e) { return null; } };
  const ssSet = (k, v) => { try { root.sessionStorage.setItem(k, v); } catch (e) {} };
  const nav = root.navigator || {};
  const ua = String(nav.userAgent || '');
  const mobile = () => { try { if (GifOS.meetPower) return !!GifOS.meetPower.mobileDevice(nav); } catch (e) {} return /Android|iPhone|iPad|Mobile/.test(ua); };
  const iphone = () => /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  const installed = () => { try { return !!(nav.standalone || (root.matchMedia && root.matchMedia('(display-mode: standalone)').matches)); } catch (e) { return false; } };
  const debugOn = () => { try { return /(?:^|[#&?])debug=(?:on|1|true)/i.test(root.location.hash + root.location.search) || root.sessionStorage.getItem('gifos_debug') === '1'; } catch (e) { return false; } };

  // ---- the setting and this device's real ringing status --------------------------------------------------------------
  const pushOn = () => { try { return !!(B() && B().on()); } catch (e) { return false; } };
  const flag = () => { try { if (MR()) return MR().stayOn(); } catch (e) {} return lsGet(STAY) === 'true'; };
  const setFlag = (v) => { try { if (MR()) { MR().setStay(!!v); return; } } catch (e) {} try { root.localStorage.setItem(STAY, JSON.stringify(!!v)); } catch (e) {} };
  const on = () => flag() || pushOn();
  const pushable = () => { try { return !!(B() && B().pushable()); } catch (e) { return false; } };
  const blocked = () => { try { return root.Notification && root.Notification.permission === 'denied'; } catch (e) { return false; } };
  // 'push' rings even when GifOS is closed, 'open' while GifOS is open in a tab, 'off' not on this device.
  const mode = () => (pushOn() ? 'push' : flag() ? 'open' : 'off');
  // What the status line says, and whether this device could do better (canPush: a tap may turn on ringing when closed).
  function status() {
    const m = mode();
    if (m === 'push') {
      let more = '';
      try { const M = MR(), n = M ? M.listenSet().filter((rec) => !handed(rec)).length : 0; if (n) more = n === 1 ? 'One contact can ring you here once you are both online: keep GifOS open in a tab until then.' : n + ' contacts can ring you here once you are both online: keep GifOS open in a tab until then.'; } catch (e) {}
      return { mode: m, text: 'Rings even when GifOS is closed.', more, waiting: !!more };
    }
    if (m === 'off') return { mode: m, text: 'Calls from your contacts don’t ring on this device.', more: '' };
    let more = '';
    if (iphone() && !installed()) more = 'To ring when GifOS is closed, add GifOS to your Home Screen (Share, then Add to Home Screen) and turn this on there.';
    else if (!pushable()) more = 'This browser can’t ring when GifOS is closed.';
    else if (blocked()) more = 'To ring when GifOS is closed too, allow notifications for GifOS in this browser’s settings.';
    // Honest about the limit: a device standing by listens in its most recently used private rooms only.
    try { const M = MR(), n = M ? M.listenSet().length : 0, all = M ? M.privates().filter((x) => x.pubs.length === 1).length : 0, max = doorsMax(); if (M && Math.max(n, all) > max) more = 'While GifOS is open, calls ring here from your ' + max + ' most recently used private rooms. ' + more; } catch (e) {}
    return { mode: m, text: 'Rings while GifOS is open in a tab.', more: more.trim(), canPush: pushable() && !blocked() && !(iphone() && !installed()) };
  }
  // The person's tap. On: the Doorbell where the browser can (its notification prompt is part of this tap), else
  // standing by while open. Off: both off. Resolves to a word to show (or '').
  async function set(v) {
    setFlag(!!v);
    let said = '';
    if (v) {
      if (pushable() && !blocked() && !(iphone() && !installed())) {
        try { await B().enable(); } catch (e) { said = String((e && e.message) || e); }
      }
    } else if (pushOn()) {
      try { await B().disable(); } catch (e) { said = String((e && e.message) || e); }
    }
    sync();
    return said;
  }
  // A device that turned the Doorbell on before this switch existed is on.
  function settle() { if (pushOn() && !flag()) setFlag(true); }

  // ---- where this page is ---------------------------------------------------------------------------------------------
  function here() { try { return GifOS.link ? GifOS.link.read(root.location.pathname, '', root.location.hash) : { room: '' }; } catch (e) { return { room: '' }; } }
  const framed = () => { try { return root.top !== root.self || !!root.__gifosMb; } catch (e) { return true; } };
  const roomUrl = (room, v) => GifOS.link.pageFor(root.location.pathname, 'meet') + '#' + GifOS.link.hash({ room, v });
  const myName = () => lsGet('gifos_name') || '';

  // ---- the doors: hidden meeting sessions; a ring in one shows here ---------------------------------------------------
  const doors = new Map();   // room.v -> { el, part, id, rec, mine }
  const stranger = new Set();   // rooms whose door met a stranger: closed until this page loads again
  let ringing = null;        // { door, pid, label, test }
  const doorsMax = () => (mobile() ? PHONE_DOORS : (MR() && MR().LISTEN_MAX) || 20);
  // A contact can push-ring this device only with a Doorbell handle from me, and handles are handed over inside our
  // private room. With the Doorbell on, a door stays open in each private room whose contact holds no live handle yet:
  // the first time their page is there (a call, or their own standing-by door), the handle goes over and the door closes.
  function handed(rec) {
    try {
      const M = MR(), r = M.roomKey(rec.room, rec.v), soon = (T().BELL_RENEW_BEFORE_MS || 0);
      return B().handles().some((h) => h.r === r && rec.pubs.indexOf(h.k) >= 0 && h.x - Date.now() > soon);
    } catch (e) { return false; }
  }
  function wanted() {
    const M = MR(); if (!M) return [];
    const md = mode(); if (md === 'off') return [];
    let recs = M.listenSet().slice(0, doorsMax());
    if (md === 'push') recs = recs.filter((rec) => !handed(rec));
    const out = recs.map((rec) => ({ rec, mine: false }));
    const m = M.mine(); if (m && md === 'open') out.push({ rec: m, mine: true });   // card holders ring my personal room
    return out;
  }
  function openDoors() {
    const M = MR(); if (!M || !GifOS.meetHost) return;
    const want = wanted();
    for (const w of want) {
      const k = M.roomKey(w.rec.room, w.rec.v);
      if (doors.has(k) || stranger.has(k)) continue;
      const d = { el: null, part: null, id: '', rec: w.rec, mine: w.mine };
      doors.set(k, d);
      const link = root.location.origin + roomUrl(w.rec.room, w.rec.v) + (debugOn() ? '&DEBUG=on' : '');
      GifOS.meetHost.join({ link, name: myName(), bot: false, listen: !w.mine }).then((r) => { d.id = r.meetingId; if (!doors.has(k)) GifOS.meetHost.leave(d.id).catch(() => {}); }, () => { if (doors.get(k) === d) doors.delete(k); });
      const fr = doc.querySelectorAll('iframe[data-gifos-meet]');
      d.el = fr.length ? fr[fr.length - 1] : null;   // join() appends its frame at once
      if (d.el) d.el.setAttribute('data-ring-door', k);
      const look = root.setInterval(() => {
        if (doors.get(k) !== d) { root.clearInterval(look); return; }
        let p = null; try { p = d.el && d.el.contentWindow && d.el.contentWindow.GifOS && d.el.contentWindow.GifOS.meetMyRoom && d.el.contentWindow.GifOS.meetMyRoom.live; } catch (e) { p = null; }
        if (!p || p === d.part) return;
        d.part = p;
        p.on((ev) => onDoor(d, ev));
      }, T().MYROOM_TICK_MS);
    }
    for (const [k, d] of Array.from(doors)) if (!want.some((w) => M.roomKey(w.rec.room, w.rec.v) === k)) shut(k, d);   // a contact removed, or no longer among the most recent
  }
  function shut(k, d) {
    if (doors.get(k) === d) doors.delete(k);
    if (ringing && ringing.door === d) endRing();
    if (d.id && GifOS.meetHost) GifOS.meetHost.leave(d.id).catch(() => {}); else if (d.el) d.el.remove();
  }
  function closeDoors() { for (const [k, d] of Array.from(doors)) shut(k, d); }
  function onDoor(d, ev) {
    if (ev.type === 'ring') { if (!ringing) startRing({ door: d, pid: ev.pid, label: ev.label, to: ev.to }); return; }
    if ((ev.type === 'missed' || ev.type === 'stopped' || ev.type === 'declined') && ringing && ringing.door === d && ringing.pid === ev.pid) { endRing(); return; }
    if (ev.type === 'go') { go(ev.room, ev.v, !!ev.priv, false); return; }   // Answer in a private room (or an invitation): there
    // A stranger sat down with a door (a full copy of the room, no member key): that door stops listening until the next load.
    if (ev.type === 'stranger') { const k = MR().roomKey(d.rec.room, d.rec.v); stranger.add(k); shut(k, d); }
  }
  // Going to a room: the person's tap on Answer. This tab is not in a meeting, so it is the one that goes.
  function go(room, v, priv, answer) {
    ssSet('gifos_join_av', JSON.stringify({ v: 1, cam: false, mic: !priv && !answer ? true : false, at: Date.now() }));
    if (priv) ssSet('gifos_mr_mic', room + '.' + v);   // a private room opens the mic once everyone there proved a member key
    endRing();
    holdLock(false);
    const u = roomUrl(room, v), same = GifOS.link.pageFor(root.location.pathname, 'meet') === root.location.pathname;
    root.location.assign(u);
    if (same) root.location.reload();   // the lobby and the meeting are one page: a new fragment alone loads nothing
  }

  // ---- the ring: a sheet with Answer and Decline, a quiet ringtone, a notification when this tab is hidden -------------
  let ac = null, toneTimer = 0, note = null;
  function toneOnce() {
    try {
      if (!ac) { const AC = root.AudioContext || root.webkitAudioContext; ac = AC ? new AC() : null; }
      if (!ac) return;
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      const g = ac.createGain(); g.gain.value = 0; g.connect(ac.destination);
      const t0 = ac.currentTime;
      g.gain.setValueAtTime(0.12, t0); g.gain.setValueAtTime(0.12, t0 + 1.9); g.gain.linearRampToValueAtTime(0, t0 + 2);
      for (const f of [440, 480]) { const o = ac.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t0); o.stop(t0 + 2); }
    } catch (e) {}
  }
  const CSS = '#ring-sheet{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.45);font:16px system-ui,-apple-system,sans-serif}' +
    '#ring-sheet .ring-box{background:var(--surface,#fff);color:var(--text,#111);border-radius:16px;padding:20px;max-width:360px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.35)}' +
    '#ring-sheet h2{margin:0 0 8px;font-size:1.25rem}#ring-sheet p{margin:0 0 16px;opacity:.8;font-size:.95rem}' +
    '#ring-sheet .ring-acts{display:flex;gap:12px;justify-content:flex-end}#ring-sheet button{font:inherit;padding:10px 18px;border-radius:999px;border:1px solid rgba(127,127,127,.5);background:transparent;color:inherit;cursor:pointer}' +
    '#ring-sheet button.go{background:#1a7f37;border-color:#1a7f37;color:#fff}' +
    '@media (prefers-color-scheme: dark){#ring-sheet .ring-box{background:var(--surface,#1d1f24);color:var(--text,#eee)}}';
  function sheet(title, text, yes) {
    let el = doc.getElementById('ring-sheet');
    if (!doc.getElementById('ring-css')) { const s = doc.createElement('style'); s.id = 'ring-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s); }
    if (!el) { el = doc.createElement('div'); el.id = 'ring-sheet'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'ring-t'); doc.body.appendChild(el); }
    el.innerHTML = '<div class="ring-box"><h2 id="ring-t">' + esc(title) + '</h2><p id="ring-n">' + esc(text) + '</p><div class="ring-acts"><button type="button" id="ring-no">Decline</button><button type="button" class="go" id="ring-yes">' + esc(yes) + '</button></div></div>';
    el.hidden = false;
    doc.getElementById('ring-no').onclick = decline;
    doc.getElementById('ring-yes').onclick = answer;
  }
  function startRing(r) {
    ringing = r;
    const title = r.test ? 'Test ring' : r.label + ' is calling';
    const text = r.test ? 'This is how a call rings on this device.' : r.door && r.door.mine ? 'At your personal room. Answer takes you there. Your mic turns on there; your camera stays off.' : 'From our private room. Answer takes you there. Your mic turns on there; your camera stays off.';
    sheet(title, text, r.test ? 'OK' : 'Answer');
    toneOnce(); toneTimer = root.setInterval(toneOnce, 6 * T().MYROOM_TICK_MS);   // 2 s on, 4 s off
    try { if (doc.hidden && root.Notification && root.Notification.permission === 'granted') { note = new root.Notification(title, { body: text, tag: 'gifos-ring' }); note.onclick = () => { try { root.focus(); } catch (e) {} }; } } catch (e) { note = null; }
    if (r.test) r.timer = root.setTimeout(endRing, T().MYROOM_RING_MS / 6);
  }
  function endRing() {
    if (ringing && ringing.timer) root.clearTimeout(ringing.timer);
    ringing = null;
    if (toneTimer) { root.clearInterval(toneTimer); toneTimer = 0; }
    try { if (note) note.close(); } catch (e) {}
    note = null;
    const el = doc.getElementById('ring-sheet'); if (el) el.hidden = true;
  }
  function answer() {
    const r = ringing; if (!r) return;
    if (r.test || !r.door || !r.door.part) { endRing(); return; }
    const d = r.door;
    // A private room's door (or an invitation) answers itself and says where to go ('go', above).
    if (!d.mine || r.to) { d.part.answer(r.pid); return; }
    // My personal room's door holds the caller at its own door: this tab goes in, and the room's page answers that
    // caller when the ring reaches it there (the caller knocks again; the hint names whom).
    ssSet('gifos_ring_answer', JSON.stringify({ room: d.rec.room, v: d.rec.v, label: r.label, at: Date.now() }));
    go(d.rec.room, d.rec.v, false, true);
  }
  function decline() {
    const r = ringing; if (!r) return;
    if (!r.test && r.door && r.door.part) { try { r.door.part.decline(r.pid); } catch (e) {} }
    endRing();
  }
  // Test ring: what a call looks and sounds like here. With the Doorbell on, the Doorbell's own test push is the test.
  async function test() {
    if (pushOn()) { const j = await B().test(); return j && j.sent ? 'Test ring sent.' : 'A test ring was sent a moment ago.'; }
    if (!ringing) startRing({ test: true, label: '' });
    return '';
  }

  // ---- one tab stands by -----------------------------------------------------------------------------------------------
  let lockAsk = null, lockFree = null, standing = false;
  function holdLock(want) {
    if (want) {
      if (lockAsk) return;
      if (!(nav.locks && nav.locks.request)) { lockAsk = {}; standing = true; openDoors(); return; }   // no Web Locks: each tab stands by
      const ask = lockAsk = new AbortController();
      nav.locks.request(LOCK, { signal: ask.signal }, () => new Promise((free) => { if (lockAsk !== ask) { free(); return; } lockFree = free; standing = true; openDoors(); }))
        .catch(() => {})
        .then(() => { if (lockAsk !== ask) return; lockAsk = null; lockFree = null; standing = false; closeDoors(); root.setTimeout(sync, T().MYROOM_TICK_MS); });   // taken over (my personal room's page): wait in line again
      return;
    }
    const a = lockAsk; lockAsk = null; standing = false;
    if (lockFree) { const f = lockFree; lockFree = null; f(); }
    else if (a && a.abort) { try { a.abort(); } catch (e) {} }
    closeDoors();
  }
  // My personal room's page listens itself: it takes the line over while it is open.
  function takeOver() { try { if (nav.locks && nav.locks.request) nav.locks.request(LOCK, { steal: true }, () => new Promise(() => {})).catch(() => {}); } catch (e) {} }
  let role = '';
  function sync() {
    if (role !== 'host') return;
    settle();
    const M = MR();
    const want = !!M && !!GifOS.meetHost && wanted().length > 0;
    if (want && standing) openDoors();
    holdLock(want);
  }
  function start() {
    if (framed()) return;
    const at = here();
    if (at.room) {   // a meeting: it never stands by; my personal room's page takes the doors over
      role = 'meeting';
      const M = MR();
      if (M && M.isMine(at.room, at.v)) takeOver();
      answerHint(at);
      return;
    }
    role = 'host';
    if (!MR() && flag()) { deps().then(() => { follow(); sync(); }, () => {}); return; }   // the Home Screen loads My Room's parts only for a device that rings
    if (!MR()) {   // turned on in another tab later: this one joins then
      const late = (e) => { if (e.key === STAY && flag()) { root.removeEventListener('storage', late); deps().then(() => { follow(); sync(); }, () => {}); } };
      root.addEventListener('storage', late);
      return;
    }
    follow();
    sync();
  }
  function follow() {
    root.setInterval(sync, T().MYROOM_RING_MS);   // a handle that went over, a room used more recently
    root.addEventListener('storage', (e) => { if (!e.key || e.key.indexOf('gifos_') === 0) sync(); });
    root.addEventListener('pagehide', () => holdLock(false));
  }
  // The parts a standing-by tab needs, beside this file (a page that has them loaded already skips this).
  const DEPS = ['timings', 'gifos-ed', 'gifos-net', 'core/link', 'meet-power', 'meet-myroom', 'meet-bell', 'meet-host'];
  const HAVE = { 'timings': () => GifOS.timings, 'core/link': () => GifOS.link, 'meet-power': () => GifOS.meetPower, 'meet-host': () => GifOS.meetHost, 'meet-bell': () => GifOS.bell };
  function deps() {
    const me = doc.querySelector('script[src*="ring-standby.js"]'), base = me ? me.src.replace(/ring-standby\.js.*$/, '') : 'js/';
    return DEPS.reduce((p, n) => p.then(() => (HAVE[n] && HAVE[n]() ? null : new Promise((ok, no) => {
      if (doc.querySelector('script[src$="/' + n + '.js"]') && !(n in HAVE)) return ok();
      const s = doc.createElement('script'); s.src = base + n + '.js'; s.onload = ok; s.onerror = no; (doc.head || doc.body).appendChild(s);
    }))), Promise.resolve());
  }
  // In my personal room after Answer from a standby tab: the caller knocks again here; its ring is answered at once.
  function answerHint(at) {
    let h = null; try { h = JSON.parse(root.sessionStorage.getItem('gifos_ring_answer') || 'null'); } catch (e) { h = null; }
    if (!h || h.room !== at.room || String(h.v) !== String(at.v || '') || Date.now() - (+h.at || 0) > T().MYROOM_RING_MS) return;
    const done = () => { try { root.sessionStorage.removeItem('gifos_ring_answer'); } catch (e) {} };
    const t0 = Date.now();
    const look = root.setInterval(() => {
      if (Date.now() - t0 > T().MYROOM_RING_MS) { root.clearInterval(look); done(); return; }
      const p = MR() && MR().live; if (!p) return;
      const st = p.state();
      const r = (st.rings || []).find((x) => x.label === h.label);
      if (r && p.answer(r.pid)) { root.clearInterval(look); done(); }
    }, T().MYROOM_TICK_MS / 4);
  }

  GifOS.ringHere = { on, mode, status, set, test, settle, takeOver, sync, doorsMax };
  try { if (debugOn()) root.__ringState = () => ({ role, mode: mode(), standing, doors: Array.from(doors, ([k, d]) => ({ room: k, mine: d.mine, part: d.part ? d.part.state() : null })), ringing: ringing ? { label: ringing.label, test: !!ringing.test } : null, sheet: !!(doc.getElementById('ring-sheet') && !doc.getElementById('ring-sheet').hidden) }); } catch (e) {}
  const boot = () => { try { start(); } catch (e) { try { console.error('ring standby: ' + String(e && e.stack || e)); } catch (x) {} } };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
