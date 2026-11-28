/*
 * home-view.js — other views of the Home Screen. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * ONE CONCEPT: the Home Screen is one set of things (your apps, your rooms, your people); a VIEW is a way to look at
 * it. The Desktop view (js/desktop.js) lays the apps out as icons you arrange. A LOOK puts meeting first: a frame of
 * its own, with SLOTS that app widgets fill (js/home-widgets.js). A look decides no rule and keeps no data: apps and
 * their pictures come from the Desktop (GifOS.desktop.home), people and rooms from My Room (js/meet-myroom.js), recent
 * rooms from the meeting page's own history, and every action ends in the same page the Desktop's icons open.
 *
 * THE LOOKS ARE A REGISTRY. A look is one file, js/home-looks/<id>.js, that calls GifOS.homeView.look({...}) with its
 * name, its slots, how it paints and its own CSS; LOOK_IDS below is the one list of them. Adding a look is that file
 * plus its id here (and its path in sw.js, which the shell check asks for).
 *
 * Each person picks their look (the bar's button, the GifOS menu, Settings → Look). The choice is about the person,
 * so it follows them to their other devices with their other settings (gifos_home_view, js/gifos-identity.js FOLLOW).
 *
 * TRY-OUT: looks are offered on the edge build only. A release shows the Desktop and nothing here.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS; if (!GifOS || !root.document) return;
  const doc = root.document;
  const KEY = 'gifos_home_view';
  const LOOK_IDS = ['glass', 'orbit', 'pulse'];   // THE REGISTRY: one id per look file in js/home-looks/
  const TV = { room: 'gifos-tv', v: 'cc51c5e4f4418c66aa52a486' };   // the GifOS TV channel
  const available = () => root.GIFOS_VERSION === 'edge';
  const lsGet = (k) => { try { return root.localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { root.localStorage.setItem(k, v); } catch (e) {} };
  const lsJson = (k) => { try { const a = JSON.parse(lsGet(k) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const valid = (id) => id === 'classic' || LOOK_IDS.indexOf(id) >= 0;
  const chosen = () => { const v = available() ? lsGet(KEY) : null; return valid(v) ? v : null; };
  const current = () => chosen() || 'classic';
  const hook = () => (GifOS.desktop && GifOS.desktop.home) || null;
  const MR = () => GifOS.meetMyRoom || null;
  const L = () => GifOS.link;
  const HW = () => GifOS.homeWidgets || null;
  // Words: i18n/<locale>/home.json. W.name reads 'home.name'.
  const T = (k, p) => (GifOS.i18n ? GifOS.i18n.t('home.' + k, p) : k);
  const W = new Proxy({}, { get: (o, k) => T(String(k)) });
  let wordsReady = null;
  const needWords = () => wordsReady || (wordsReady = (GifOS.i18n && GifOS.i18n.load ? Promise.resolve(GifOS.i18n.load(['home', 'common'])).catch(() => {}) : Promise.resolve()));

  // ---- the registry ---------------------------------------------------------------------------------------------------
  const looks = new Map(), lookWait = {};
  function loadScript(src) {
    return new Promise((res) => { const s = doc.createElement('script'); s.src = src; s.onload = res; s.onerror = res; doc.head.appendChild(s); });
  }
  // A look file registers itself; its CSS goes in once.
  function look(def) {
    if (!def || !valid(def.id) || def.id === 'classic' || typeof def.paint !== 'function' || looks.has(def.id)) return;
    looks.set(def.id, def);
    if (def.css) { const st = doc.createElement('style'); st.dataset.hvLook = def.id; st.textContent = def.css; doc.head.appendChild(st); }
  }
  const needLook = (id) => (looks.has(id) ? Promise.resolve(looks.get(id)) : (lookWait[id] || (lookWait[id] = loadScript('js/home-looks/' + id + '.js').then(() => looks.get(id) || null))));
  const needAllLooks = () => Promise.all(LOOK_IDS.map(needLook));
  const lookName = (id) => (id === 'classic' ? W['look.classic.name'] : (looks.get(id) && looks.get(id).name) || id.charAt(0).toUpperCase() + id.slice(1));
  const lookSub = (id) => { const k = 'home.look.' + id + '.sub'; return GifOS.i18n && GifOS.i18n.has(k) ? GifOS.i18n.t(k) : (looks.get(id) && looks.get(id).sub) || ''; };

  // ---- small drawing helpers ----------------------------------------------------------------------------------------
  const ICON = {
    video: '<path d="M15 10l5-3v10l-5-3z"/><rect x="3" y="6" width="12" height="12" rx="3"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    grid: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
    tv: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M8 21h8M9 3l3 3 3-3"/>',
    people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.5a5 5 0 0 1 4.5 5"/>',
    home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="14.5" cy="12" r="1"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
    views: '<rect x="3" y="4" width="8" height="7" rx="2"/><rect x="13" y="4" width="8" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    tune: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  };
  const svg = (n) => '<svg class="hv-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + '</svg>';
  const initials = (n) => (String(n || '?').replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2) || '?').toUpperCase();
  const hue = (n) => { let h = 0; for (const ch of String(n || '')) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const face = (n, cls) => '<span class="hv-av ' + (cls || '') + '" style="--h:' + hue(n) + '" aria-hidden="true">' + esc(initials(n)) + '</span>';
  const plain = (n) => String(n || '').replace(/\.gif$/i, '');   // every app is a GIF; the name never says so
  const relTime = (ts) => (GifOS.i18n && GifOS.i18n.fmt.relative ? GifOS.i18n.fmt.relative(ts || 0) : '');
  const greeting = () => { const h = new Date().getHours(); return W[h < 5 ? 'hello.night' : h < 12 ? 'hello.morning' : h < 18 ? 'hello.afternoon' : 'hello.evening']; };
  const hello = (d) => (d.me.name ? T('hello.named', { hello: greeting(), name: d.me.name }) : greeting());

  // ---- the clock: day, date and time in the person's locale (12 or 24 hours by their locale or their own choice) ---------
  function clockParts(now) {
    const F = GifOS.i18n && GifOS.i18n.fmt, d = now || new Date();
    if (!F) return { time: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), day: d.toLocaleDateString([], { weekday: 'long' }), date: d.toLocaleDateString([], { month: 'long', day: 'numeric' }) };
    return { time: F.time(d, { hour: 'numeric', minute: '2-digit' }), day: F.date(d, { weekday: 'short' }), date: F.date(d, { month: 'short', day: 'numeric' }),
      full: F.date(d, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) };
  }

  // ---- the model: read from where each thing already lives ----------------------------------------------------------
  function me() {
    let id = null; try { id = GifOS.store.identity(); } catch (e) {}
    const name = ((id && id.name) || '').trim();
    return { name, pic: id && id.avatar && id.avatar.url ? id.avatar.url : '' };
  }
  const myFace = (cls) => { const m = me(); return m.pic ? '<span class="hv-av pic ' + (cls || '') + '" aria-hidden="true"><img src="' + esc(m.pic) + '" alt=""></span>' : face(m.name || 'Me', cls); };
  function people() {
    const M = MR(); if (!M) return { mine: null, list: [], missed: [], hosted: [] };
    const rk = (x) => M.roomKey(x.room, x.v);
    const privs = M.privates(), mine = M.mine();
    const ours = privs.filter((x) => x.pubs.length === 1 && x.me);
    const via = new Set(); ours.forEach((p) => { const c = M.cardIn(p); if (c) via.add(rk(c)); });
    const list = ours.map((p) => ({ kind: 'p', name: p.name || W.contact, room: p.room, v: p.v, last: p.last || p.at || 0, ok: true }));
    M.contacts().filter((c) => !via.has(rk(c))).forEach((c) => list.push({ kind: 'c', name: c.name || W.contact, room: c.room, v: c.v, last: c.at || 0, ok: !!c.bound }));
    list.sort((a, b) => b.last - a.last);
    const missed = M.missed().slice().sort((a, b) => (b.at || 0) - (a.at || 0)).map((x) => {
      const n = String(x.label || '').replace(/\s*(✓|\(card\))\s*$/, '');
      const pr = M.privFor(x.room, x.v);
      const who = list.find((p) => (pr && p.kind === 'p' && rk(p) === rk(pr)) || p.name === n) || null;
      return { name: n || W.someone, at: x.at, who };
    });
    const taken = new Set(privs.map(rk)); if (mine) taken.add(rk(mine));
    return { mine, list, missed, hosted: M.hosted().filter((h) => !taken.has(rk(h))), privKeys: new Set(privs.map((p) => p.room)) };
  }
  // Rooms and broadcasts this device has been in: the meeting page's own lists (saved ones first).
  function visited(kind, ppl) {
    const seen = new Set(), out = [];
    const take = (e, saved) => {
      if (!e || typeof e.url !== 'string') return;
      let u; try { u = new URL(e.url, root.location.href); } catch (err) { return; }
      if (u.origin !== root.location.origin) return;
      let r; try { r = L().read(u.pathname, u.search, u.hash); } catch (err) { return; }
      if (!r || !r.room || seen.has(r.room + '.' + (r.v || ''))) return;
      if (ppl.privKeys && ppl.privKeys.has(r.room)) return;                       // a private room is a person, not a place
      if (ppl.mine && ppl.mine.room === r.room) return;                           // my personal room has its own button
      if (kind === 'cast' && r.room === TV.room) return;
      seen.add(r.room + '.' + (r.v || ''));
      out.push({ room: r.room, v: r.v || '', name: plain(String(e.name || r.room).replace(/^(Meeting|Broadcast):\s*/i, '')), ts: e.ts || 0, saved: !!saved });
    };
    lsJson('gifos_' + kind + '_bookmarks').forEach((e) => take(e, true));
    lsJson('gifos_' + kind + '_history').forEach((e) => take(e, false));
    return out.slice(0, 12);
  }
  // The apps: the Desktop's own items, in reading order, with the pictures the Desktop cut.
  function apps(parent) {
    const H = hook(); if (!H) return [];
    return H.items().filter((it) => (it.parent || null) === (parent || null) && it.id !== H.trashId)
      .sort((a, b) => ((a.y || 0) - (b.y || 0)) || ((a.x || 0) - (b.x || 0)));
  }
  function appTile(it, cls) {
    const b = doc.createElement('button');
    b.type = 'button'; b.className = 'hv-app ' + (cls || ''); b.dataset.act = (it.kind === 'folder' ? 'folder:' : 'app:') + it.id;
    b.innerHTML = '<span class="hv-app-pic">' + (it.kind === 'folder' ? '📁' : '') + '</span><span class="hv-app-n">' + esc(plain(it.name)) + '</span>';
    const pic = b.firstChild, H = hook();
    if (H) H.picture(it).then((r) => { if (r && r.img) { pic.textContent = ''; pic.appendChild(r.img); } else if (it.kind !== 'folder') pic.textContent = '📄'; }).catch(() => {});
    return b;
  }
  function allApps(cls) {
    const all = doc.createElement('button'); all.type = 'button'; all.className = 'hv-app ' + (cls || ''); all.dataset.act = 'apps';
    all.innerHTML = '<span class="hv-app-pic">' + svg('grid') + '</span><span class="hv-app-n">' + esc(W.allApps) + '</span>'; return all;
  }
  // The launchers a look already is (Meeting, Rooms, Broadcast) are left out of its short app rows.
  const BUILT_IN = /^(meeting|meet|rooms|broadcast|video|me|my identity)$/i;
  const shortApps = (n) => apps(null).filter((it) => it.kind !== 'folder' && !BUILT_IN.test(plain(it.name))).slice(0, n);

  // ---- the actions: each ends in the page the Desktop's own icon opens ------------------------------------------------
  const page = (name) => { const H = hook(); return (H && H.systemPage(name)) || (name === 'broadcast' ? 'cast.html' : name + '.html'); };
  const openTab = (url) => root.open(url, '_blank');
  const slug = (s) => String(s || '').trim().replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const A = {
    // A name, or a pasted room link of any form (read by the one link parser). No name: the lobby.
    join(text) {
      const t = String(text || '').trim();
      let p = null; try { p = /[:\/#?.]/.test(t) ? L().parseInput(t) : null; } catch (e) { p = null; }
      if (p && p.room) { openTab(page(p.cast ? 'broadcast' : 'meet') + '#' + L().hash({ room: p.room, v: p.v || undefined })); return; }
      const r = slug(t); openTab(page('meet') + (r ? '#' + L().hash({ room: r }) : ''));
    },
    lobby() { openTab(page('meet')); },
    room(room, v) { openTab(page('meet') + '#' + L().hash({ room, v: v || undefined })); },
    watch(room, v) { openTab(page('broadcast') + '#' + L().hash({ room, v: v || undefined })); },
    goLive() { openTab(page('broadcast')); },
    rooms() { openTab(page('rooms')); },
    myRoom() { const m = people().mine; if (m) A.room(m.room, m.v); else A.rooms(); },
    // Call: the same hand-off the Rooms app makes. A private room is entered with mic and camera off until it is answered.
    call(p) {
      const M = MR(); if (!M || !p) return;
      const ss = root.sessionStorage;
      if (p.kind === 'p') {
        try { ss.setItem('gifos_join_av', JSON.stringify({ v: 1, cam: false, mic: false, at: Date.now() })); ss.setItem('gifos_mr_mic', p.room + '.' + p.v); } catch (e) {}
      } else {
        const c = M.contactFor(p.room, p.v), pr = c && M.pairWith(M.contactPub(c));
        if (pr) lsSet('gifos_mr_invite.' + M.roomKey(p.room, p.v), JSON.stringify({ to: pr.room + '.' + pr.v, go: 1, pv: 1, at: Date.now() }));
      }
      A.room(p.room, p.v);   // the new tab starts with a copy of this tab's hand-off notes
      try { ss.removeItem('gifos_join_av'); ss.removeItem('gifos_mr_mic'); } catch (e) {}
    },
    me() { if (GifOS.identityUI) GifOS.identityUI.manage(); },
    settings() { const H = hook(); if (H) H.settings(); },
    store() { const H = hook(); root.location.href = H ? H.storeHref() : '/store'; },
    add() { const H = hook(); if (H) H.add(); },
  };

  // ---- shared blocks ------------------------------------------------------------------------------------------------
  const joinForm = (cls, ph) =>
    '<form class="hv-join ' + (cls || '') + '" data-form="join" autocomplete="off">' +
      '<input name="room" maxlength="300" inputmode="text" enterkeyhint="go" aria-label="' + esc(W.roomName) + '" placeholder="' + esc(ph || W.roomPh) + '">' +
      '<button type="submit" class="hv-go">' + svg('video') + '<span>' + esc(W.join) + '</span></button></form>';
  function missedChip(ppl) {
    if (!ppl.missed.length) return '';
    const m = ppl.missed[0], i = m.who ? ppl.list.indexOf(m.who) : -1;
    return '<div class="hv-missed" role="status"><span class="hv-dot"></span><span class="hv-missed-t"><b>' + esc(T('missed', { name: m.name })) + '</b> ' + esc(relTime(m.at)) +
      (ppl.missed.length > 1 ? ' · ' + esc(T('missedMore', { n: ppl.missed.length - 1 })) : '') + '</span>' +
      (i >= 0 ? '<button type="button" class="hv-pill hot" data-act="call:' + i + '">' + svg('phone') + esc(W.callBack) + '</button>' : '<button type="button" class="hv-pill" data-act="rooms">' + esc(W.see) + '</button>') +
      '<button type="button" class="hv-x" data-act="missed-clear" title="' + esc(W.clearMissed) + '" aria-label="' + esc(W.clearMissed) + '">✕</button></div>';
  }
  const personBubble = (p, i, missed) =>
    '<button type="button" class="hv-person' + (missed ? ' missed' : '') + '" data-act="call:' + i + '" title="' + esc(T('callName', { name: p.name })) + '">' +
      '<span class="hv-ring">' + face(p.name) + '<span class="hv-callbadge">' + svg('phone') + '</span></span>' +
      '<span class="hv-person-n">' + esc(p.name) + '</span></button>';
  const addBubble = (label) =>
    '<button type="button" class="hv-person add" data-act="rooms" title="' + esc(W.addSomeone) + '"><span class="hv-ring"><span class="hv-av ghost">' + svg('plus') + '</span></span><span class="hv-person-n">' + esc(label || W.add) + '</span></button>';
  const isMissed = (ppl, p) => ppl.missed.some((m) => m.who === p);
  // With nobody yet, the row is one plain invitation instead of a lone empty circle.
  const peopleStrip = (ppl, max) => (ppl.list.length ? ppl.list.slice(0, max).map((p, i) => personBubble(p, i, isMissed(ppl, p))).join('') + addBubble()
    : '<button type="button" class="hv-invite" data-act="rooms"><span class="hv-av ghost">' + svg('plus') + '</span><span class="hv-row-t"><b>' + esc(W.addPeople) + '</b><span>' + esc(W.addPeopleSub) + '</span></span></button>');
  const peopleRows = (ppl) => (ppl.list.length ? '<div class="hv-rows">' + ppl.list.map((p, i) =>
    '<div class="hv-row person">' + face(p.name) + '<span class="hv-row-t"><b>' + esc(p.name) + (p.ok ? ' <i class="hv-ok" title="' + esc(W.swapped) + '">✓</i>' : '') + '</b><span>' + esc(p.kind === 'p' ? W.privateRoom : W.cardRoom) + (isMissed(ppl, p) ? ' · ' + esc(W.missedCall) : '') + '</span></span>' +
    '<button type="button" class="hv-pill hot" data-act="call:' + i + '">' + svg('phone') + esc(W.call) + '</button></div>').join('') + '</div>' : '<p class="hv-quiet">' + esc(W.noPeople) + '</p>');
  const roomKind = (r) => (r.v ? W.hosted : W.majority);
  const roomRow = (r, i, kind) =>
    '<button type="button" class="hv-row" data-act="' + kind + ':' + i + '"><span class="hv-row-ic" style="--h:' + hue(r.room) + '">' + svg(kind === 'cast' ? 'tv' : r.v ? 'key' : 'door') + '</span>' +
      '<span class="hv-row-t"><b>' + esc(r.name) + '</b><span>' + esc((kind === 'cast' ? W.broadcast : roomKind(r)) + (r.saved ? ' · ' + W.saved : r.ts ? ' · ' + relTime(r.ts) : '')) + '</span></span>' +
      '<span class="hv-row-go">' + svg('arrow') + '</span></button>';
  const tvRow = () =>
    '<button type="button" class="hv-row tv" data-act="tv"><span class="hv-row-ic live">' + svg('tv') + '</span><span class="hv-row-t"><b>GifOS TV</b><span>' + esc(W.tvSub) + '</span></span><span class="hv-row-go">' + svg('arrow') + '</span></button>';
  const liveCard = () => '<button type="button" class="p-live" data-act="tv"><span class="p-live-tag"><span class="hv-dot"></span>GifOS TV</span><b>' + esc(W.tvWatch) + '</b><span>' + esc(W.tvTune) + '</span></button>';

  // ---- popups: every one is a card of the shared popup library (js/dialog.js), which keeps Close on screen ---------------
  let popEl = null;
  function closePopup() { if (popEl) { const p = popEl; popEl = null; if (HW()) HW().unmount(p); p.remove(); if (p._onClose) p._onClose(); } }
  function popup(title, fill, cls) {
    closePopup();
    const bg = doc.createElement('div'); bg.className = 'modal-bg hv-pop-bg hv-skin-' + current();
    bg.innerHTML = '<div class="modal dlg hv-pop ' + (cls || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="dlg-head hv-pop-head"><button type="button" class="hv-pop-back" data-act="pop-back" hidden aria-label="' + esc(W.back) + '">' + svg('back') + '</button><h2>' + esc(title) + '</h2></div>' +
      '<div class="dlg-body hv-pop-body"></div><div class="dlg-actions hv-pop-actions"><button type="button" class="hv-pill hot" data-act="pop-close">' + esc(W.close) + '</button></div></div>';
    bg.addEventListener('click', (e) => { if (e.target === bg) closePopup(); else onClick(e); });
    bg.addEventListener('submit', onSubmit);
    doc.body.appendChild(bg); popEl = bg;
    fill(bg.querySelector('.hv-pop-body'), bg);
    return bg;
  }
  function appsPopup(folderId) {
    const H = hook(), folder = folderId && H ? H.items().find((x) => x.id === folderId) : null;
    popup(folder ? plain(folder.name) : W.apps, (body, bg) => {
      if (folder) { const bk = bg.querySelector('.hv-pop-back'); bk.hidden = false; bk.dataset.act = folder.parent ? 'folder:' + folder.parent : 'apps'; }
      const list = apps(folderId || null);
      const g = doc.createElement('div'); g.className = 'hv-appgrid';
      list.forEach((it) => g.appendChild(appTile(it)));
      body.appendChild(g);
      if (!list.length) g.innerHTML = '<p class="hv-quiet">' + esc(W.emptyFolder) + '</p>';
      if (!folder) {
        const f = doc.createElement('div'); f.className = 'hv-sheet-foot';
        f.innerHTML = '<button type="button" class="hv-pill hot" data-act="store">' + svg('bag') + esc(W.appStore) + '</button><button type="button" class="hv-pill" data-act="add">' + svg('plus') + esc(W.add) + '</button>' +
          '<button type="button" class="hv-pill" data-act="view:classic">' + esc(W.arrange) + '</button>';
        body.appendChild(f);
      }
    }, 'apps');
  }
  function peoplePopup() {
    const ppl = people();
    popup(W.people, (body) => {
      body.innerHTML = peopleRows(ppl) + '<div class="hv-sheet-foot"><button type="button" class="hv-pill" data-act="rooms">' + svg('people') + esc(W.addSomeone) + '</button></div>';
    });
  }
  const meetRows = (ppl) => '<div class="hv-rows"><button type="button" class="hv-row" data-act="myroom"><span class="hv-row-ic">' + svg('home') + '</span><span class="hv-row-t"><b>' + esc(ppl.mine ? W.myRoom : W.makeMyRoom) + '</b><span>' + esc(ppl.mine ? T('myRoomStands', { room: ppl.mine.room }) : W.myRoomSub) + '</span></span><span class="hv-row-go">' + svg('arrow') + '</span></button>' +
    '<button type="button" class="hv-row" data-act="lobby"><span class="hv-row-ic">' + svg('key') + '</span><span class="hv-row-t"><b>' + esc(W.host) + '</b><span>' + esc(W.hostSub) + '</span></span><span class="hv-row-go">' + svg('arrow') + '</span></button>' +
    '<button type="button" class="hv-row" data-act="golive"><span class="hv-row-ic live">' + svg('tv') + '</span><span class="hv-row-t"><b>' + esc(W.goLive) + '</b><span>' + esc(W.goLiveSub) + '</span></span><span class="hv-row-go">' + svg('arrow') + '</span></button></div>';
  function startPopup() {
    const ppl = people();
    popup(W.meet, (body) => {
      body.innerHTML = joinForm('big') + '<p class="hv-quiet">' + esc(W.joinNote) + '</p>' + meetRows(ppl) + '<p class="hv-quiet">' + esc(W.honest) + '</p>';
      const inp = body.querySelector('input'); if (inp) root.requestAnimationFrame(() => inp.focus());
    });
  }

  // ---- the picker: every look drawn live, small, from this Home Screen's own things ----------------------------------------
  // A preview is the look itself, painted at a real screen size and scaled down; nothing in it takes a tap.
  function preview(box, id) {
    const phone = root.innerWidth < 720, vw = phone ? 390 : 1280, vh = phone ? 720 : 800;
    box.className = 'hv-prev-box'; box.style.aspectRatio = vw + ' / ' + vh; box.innerHTML = '';
    const sc = doc.createElement('div'); sc.className = 'hv-prev-scale'; sc.style.width = vw + 'px'; sc.style.height = vh + 'px'; sc.inert = true; sc.setAttribute('aria-hidden', 'true');
    box.appendChild(sc);
    const fit = () => { sc.style.transform = 'scale(' + (box.clientWidth / vw) + ')'; };
    fit(); if (root.ResizeObserver) new root.ResizeObserver(fit).observe(box);
    const el = doc.createElement('div'); sc.appendChild(el);
    if (id === 'classic') {   // the Desktop: its own icons, in its own order
      el.className = 'hv-prev hv-prev-classic';
      const g = doc.createElement('div'); g.className = 'hv-prev-icons'; apps(null).slice(0, phone ? 16 : 28).forEach((it) => g.appendChild(appTile(it))); el.appendChild(g);
      return;
    }
    needLook(id).then((def) => {
      if (!def || !box.isConnected) return;
      el.className = 'hv hv-prev hv-' + id;
      const d = state.data || data();
      def.paint(el, d, api);
      if (HW()) HW().mount(el, def, { data: d, preview: true });
      if (def.after) def.after(el, api);
    });
  }
  function pick() {
    const first = !chosen();
    Promise.all([needWords(), needRooms(), HW() ? HW().ready() : null]).then(() => {
      popup(first ? W.pickFirst : W.pickTitle, (body) => {
        const cur = current();
        body.innerHTML = '<p class="hv-quiet">' + esc(first ? W.pickFirstNote : W.pickNote) + '</p><div class="hv-picks">' +
          ['classic'].concat(LOOK_IDS).map((id) => '<button type="button" class="hv-pick' + (id === cur && !first ? ' on' : '') + '" data-act="view:' + id + '" data-look="' + id + '" aria-pressed="' + (id === cur && !first) + '">' +
            '<span data-prev="' + id + '"></span><span class="hv-pick-t"><b>' + esc(lookName(id)) + '</b><span></span></span></button>').join('') + '</div>' +
          '<p class="hv-quiet">' + esc(W.pickFoot) + '</p>';
        body.querySelectorAll('[data-prev]').forEach((n) => preview(n, n.dataset.prev));
        const subs = () => body.querySelectorAll('.hv-pick').forEach((b) => { const id = b.dataset.look; b.querySelector('.hv-pick-t b').textContent = lookName(id); b.querySelector('.hv-pick-t span').textContent = id === 'classic' ? W['look.classic.sub'] : lookSub(id); });
        subs(); needAllLooks().then(subs);
      }, 'pick');
    });
  }

  // ---- what a look may use ----------------------------------------------------------------------------------------------
  const state = { tab: 'home', data: null };
  const api = {
    esc, svg, T, words: W, state, hello, hue, face, myFace, relTime, plain,
    slot: (name) => '<div class="hv-slot" data-slot="' + esc(name) + '"></div>',
    joinForm, missedChip, personBubble, addBubble, isMissed, peopleStrip, peopleRows, roomRow, roomKind, tvRow, liveCard, meetRows,
    apps, appTile, allApps, shortApps, width: (el) => el.clientWidth || root.innerWidth,
  };

  // ---- mount, paint, events -----------------------------------------------------------------------------------------
  let host = null, paintQueued = false, frameSig = '';
  function data() { const ppl = people(); return { me: me(), ppl, rooms: visited('meet', ppl), casts: visited('cast', ppl) }; }
  // What a look's own frame is drawn from. While it stays the same only the widgets refresh, so nothing blinks.
  const sigOf = (id, d) => JSON.stringify([id, state.tab, HW() ? HW().layoutSig(id) : '', d.me, d.ppl.list.map((p) => p.name + p.room), d.ppl.missed.map((m) => m.at), !!d.ppl.mine,
    d.rooms.map((r) => r.room + r.v), d.casts.length, apps(null).map((it) => it.id + it.name), Math.round(root.innerWidth / 48), Math.round(root.innerHeight / 48), GifOS.i18n ? GifOS.i18n.tag() : '', greeting()]);
  function paint() {
    const id = current(), def = looks.get(id);
    if (id === 'classic' || !host || !def) return;
    const d = state.data = data(), sig = sigOf(id, d), ctx = { data: d };
    if (sig === frameSig && host.firstChild) { if (HW()) HW().refresh(host, def, ctx); return; }
    const keep = host.querySelector('.hv-join input'), typed = keep && doc.activeElement === keep ? keep.value : null;
    const sc = host.querySelector('.hv-scroll'), top = sc ? sc.scrollTop : 0;
    if (HW()) HW().unmount(host);
    host.className = 'hv hv-' + id;
    def.paint(host, d, api);
    if (HW()) HW().mount(host, def, ctx);
    if (def.after) def.after(host, api);
    frameSig = sig;
    const meBtn = doc.getElementById('hv-me-btn'); if (meBtn) meBtn.innerHTML = myFace();
    const sc2 = host.querySelector('.hv-scroll'); if (sc2) sc2.scrollTop = top;
    if (typed !== null) { const inp = host.querySelector('.hv-join input'); if (inp) { inp.value = typed; inp.focus(); } }
  }
  function queuePaint() { if (paintQueued) return; paintQueued = true; root.requestAnimationFrame(() => { paintQueued = false; paint(); paintBar(); }); }
  function onSubmit(e) {
    const f = e.target.closest ? e.target.closest('[data-form="join"]') : null; if (!f) return;
    e.preventDefault(); const inp = f.querySelector('input'); A.join(inp.value); inp.value = ''; if (popEl && popEl.contains(f)) closePopup();
  }
  function onClick(e) {
    const b = e.target.closest ? e.target.closest('[data-act]') : null; if (!b) return;
    const act = b.dataset.act, i = act.indexOf(':'), verb = i < 0 ? act : act.slice(0, i), arg = i < 0 ? '' : act.slice(i + 1), d = state.data || data();
    const H = hook();
    switch (verb) {
      case 'call': A.call(d.ppl.list[+arg]); break;
      case 'room': { const r = d.rooms[+arg]; if (r) A.room(r.room, r.v); break; }
      case 'cast': { const r = d.casts[+arg]; if (r) A.watch(r.room, r.v); break; }
      case 'tv': A.watch(TV.room, TV.v); break;
      case 'golive': A.goLive(); closePopup(); break;
      case 'lobby': A.lobby(); closePopup(); break;
      case 'myroom': A.myRoom(); closePopup(); break;
      case 'rooms': A.rooms(); break;
      case 'missed-clear': { const M = MR(); if (M) { M.clearMissed(); paint(); } break; }
      case 'me': A.me(); break;
      case 'store': A.store(); break;
      case 'add': closePopup(); A.add(); break;
      case 'settings': A.settings(); break;
      case 'start': startPopup(); break;
      case 'people': peoplePopup(); break;
      case 'apps': appsPopup(null); break;
      case 'folder': if (current() === 'classic') break; appsPopup(arg); break;
      case 'app': { const it = H && H.items().find((x) => x.id === arg); if (it) H.open(it); break; }
      case 'tab': state.tab = arg; paint(); { const sc = host && host.querySelector('.hv-scroll'); if (sc) sc.scrollTop = 0; } break;
      case 'view': closePopup(); set(arg); break;
      case 'pick': pick(); break;
      case 'pop-close': closePopup(); break;
      default: if (HW()) HW().act(verb, arg, b, e); break;
    }
  }
  let roomsReady = null;
  // My Room is read through its own module, loaded the first time a look needs it (the Desktop view never does).
  function needRooms() {
    if (roomsReady) return roomsReady;
    roomsReady = (async () => {
      if (!GifOS.net) await loadScript('js/gifos-net.js');
      if (!GifOS.meetMyRoom) await loadScript('js/meet-myroom.js');
    })();
    return roomsReady;
  }
  // The bar: the look button (with a first invitation until a look is chosen), and on the Desktop view the day, date and time.
  function paintBar() {
    const btn = doc.getElementById('view-btn'); if (!btn || !available()) return;
    const fresh = !chosen();
    btn.classList.toggle('fresh', fresh);
    btn.innerHTML = svg('views') + (fresh ? '<span class="hv-fresh-t">' + esc(W.pickInvite) + '</span>' : '');
    btn.title = W.pickTitle; btn.setAttribute('aria-label', W.pickTitle);
    let c = doc.getElementById('hv-bar-clock'), f = doc.getElementById('hv-foot-clock');
    if (current() !== 'classic') { if (c) c.remove(); if (f) f.remove(); return; }
    if (!f) { f = doc.createElement('div'); f.id = 'hv-foot-clock'; f.className = 'hv-foot-clock'; doc.body.appendChild(f); }
    if (!c) { c = doc.createElement('button'); c.type = 'button'; c.id = 'hv-bar-clock'; c.className = 'hv-bar-clock'; c.addEventListener('click', () => { if (HW()) HW().openApp('calendar') || HW().openApp('clock'); }); btn.parentNode.insertBefore(c, btn); }
    const p = clockParts();
    c.innerHTML = '<span class="hv-bar-day">' + esc(p.day) + ' ' + esc(p.date) + '</span><b>' + esc(p.time) + '</b>'; c.title = p.full || ''; c.setAttribute('aria-label', (p.full || '') + ' ' + p.time);
    f.innerHTML = esc(p.day) + ' ' + esc(p.date) + '<b>' + esc(p.time) + '</b>';
  }
  function apply() {
    const id = current(), on = id !== 'classic';
    doc.body.classList.toggle('hv-on', on);
    if (on) doc.body.dataset.hv = id; else delete doc.body.dataset.hv;
    const btn = doc.getElementById('view-btn');
    if (btn) { btn.style.display = available() ? '' : 'none'; }
    let meBtn = doc.getElementById('hv-me-btn');
    needWords().then(paintBar);
    if (!on) { if (host) { if (HW()) HW().unmount(host); host.remove(); host = null; frameSig = ''; } if (meBtn) meBtn.remove(); return; }
    if (!meBtn && btn) {   // Me & My Contacts: in the bar, beside the look button
      meBtn = doc.createElement('button'); meBtn.type = 'button'; meBtn.id = 'hv-me-btn'; meBtn.className = 'hv-me-btn';
      meBtn.addEventListener('click', () => A.me()); btn.parentNode.insertBefore(meBtn, btn);
    }
    if (!host) {
      host = doc.createElement('main'); host.id = 'home-view'; host.className = 'hv';
      host.addEventListener('click', onClick); host.addEventListener('submit', onSubmit);
      doc.body.appendChild(host);
    }
    Promise.all([needWords(), needLook(id), HW() ? HW().ready() : null]).then((r) => {
      if (current() !== id) return;
      if (!r[1]) { lsSet(KEY, 'classic'); apply(); return; }   // a look this build does not have: the Desktop
      if (meBtn) { meBtn.title = W.meTitle; meBtn.setAttribute('aria-label', W.meTitle); }
      frameSig = ''; paint();
      needRooms().then(queuePaint);
    });
  }
  function set(id) { if (!available() || !valid(id)) return; lsSet(KEY, id); state.tab = 'home'; apply(); }

  // Settings → Look: the same choice as the bar's button, as a list. scopeTag is the Desktop's "Follows you" mark.
  function settingsHtml(scopeTag) {
    const cur = current();
    return '<div class="set-group">' + esc(W.setTitle) + (scopeTag ? scopeTag(true) : '') + '</div><div class="set-card set-pad hv-set"><p class="add-help">' + esc(W.setNote) + '</p>' +
      ['classic'].concat(LOOK_IDS).map((id) => '<label class="hv-set-row"><input type="radio" name="hv-view" value="' + id + '"' + (id === cur ? ' checked' : '') + '><span><b>' + esc(lookName(id)) + '</b> <span class="hv-set-sub">' + esc(id === 'classic' ? W['look.classic.sub'] : lookSub(id)) + '</span></span></label>').join('') +
      '<button type="button" id="hv-set-pick">' + esc(W.setPreview) + '</button></div>';
  }
  function wireSettings(box) {
    box.querySelectorAll('input[name="hv-view"]').forEach((r) => { r.onchange = () => { if (r.checked) set(r.value); }; });
    const b = box.querySelector('#hv-set-pick'); if (b) b.onclick = pick;
    needAllLooks().then(() => box.querySelectorAll('input[name="hv-view"]').forEach((r) => { const row = r.parentNode, id = r.value; if (id === 'classic' || !row.isConnected) return; row.querySelector('b').textContent = lookName(id); row.querySelector('.hv-set-sub').textContent = lookSub(id); }));
  }

  GifOS.homeView = { available, current, set, pick, look, _looks: looks, views: () => ['classic'].concat(LOOK_IDS), get menuLabel() { return GifOS.i18n && GifOS.i18n.has('home.menu') ? W.menu : 'Home look…'; },
    settingsHtml, wireSettings, repaint: queuePaint, preview,
    // What the widgets (js/home-widgets.js) share with the looks: the same blocks, words and actions.
    kit: { api, A, T, W, esc, svg, popup, closePopup, people, data: () => state.data || data(), clockParts, lsGet, lsSet, loadScript, hook, me, TV, host: () => host } };

  if (!available()) return;
  // A link may name a look to try (?view=orbit), or open the picker (?view=pick): it only changes how this Home Screen is drawn.
  let openPick = false;
  try {
    const m = /[?&#]view=([a-z]+)/.exec(root.location.search + root.location.hash);
    if (m && valid(m[1])) lsSet(KEY, m[1]); else if (m && m[1] === 'pick') openPick = true;
  } catch (e) {}
  needWords();
  const H0 = hook(); if (H0) H0.onRender = queuePaint;
  const start = () => {
    const btn = doc.getElementById('view-btn');
    if (btn) btn.addEventListener('click', pick);
    apply();
    if (openPick) pick();
  };
  if (doc.body) start(); else doc.addEventListener('DOMContentLoaded', start);
  root.addEventListener('storage', (e) => { if (!e.key || e.key.indexOf('gifos_') === 0) { if (e.key === KEY) apply(); else queuePaint(); } });
  root.addEventListener('resize', queuePaint);
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) { queuePaint(); if (HW()) HW().minute(); } });
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopup(); });
  try { if (GifOS.store.onIdentity) GifOS.store.onIdentity(queuePaint); } catch (e) {}
  try { if (GifOS.i18n) GifOS.i18n.onChange(() => { frameSig = ''; queuePaint(); }); } catch (e) {}
  // The minute: one timer for the whole Home Screen, set each time to the next minute boundary (no interval, nothing
  // per second). Clocks, "5m ago" lines and every widget are told once a minute, and only while the page is seen.
  const tick = () => {
    if (!doc.hidden) { paintBar(); if (HW()) HW().minute(); if (host) queuePaint(); }
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1);
    root.setTimeout(tick, next - now);   // always in the future: the next minute
  };
  { const now = new Date(); root.setTimeout(tick, new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1) - now); }
})(typeof window !== 'undefined' ? window : globalThis);
