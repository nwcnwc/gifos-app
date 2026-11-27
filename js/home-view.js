/*
 * home-view.js — other views of the Home Screen. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * ONE CONCEPT: the Home Screen is one set of things (your apps, your rooms, your people); a VIEW is a way to look at
 * it. The Desktop view (js/desktop.js) lays the apps out as icons you arrange. The views here put meeting first:
 * join or start a room, call your people, see what is on, and keep the apps one tap away. A view decides no rule and
 * keeps no data: apps and their pictures come from the Desktop (GifOS.desktop.home), people and rooms from My Room
 * (js/meet-myroom.js, this device's storage), recent rooms from the meeting page's own history, and every action ends
 * in the same page the Desktop's icons open.
 *
 * TRY-OUT: three looks (Glass, Orbit, Pulse) are offered on the edge build only, so they can be compared before one
 * becomes the default. A release shows the Desktop and nothing here.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS; if (!GifOS || !root.document) return;
  const doc = root.document;
  const KEY = 'gifos_home_view';
  const VIEWS = [
    { id: 'classic', name: 'Desktop', sub: 'Icons and folders you arrange yourself.' },
    { id: 'glass', name: 'Glass', sub: 'Calm and clear. Meet first, your people next, apps in a dock.' },
    { id: 'orbit', name: 'Orbit', sub: 'You in the middle. Your people, rooms and apps circle around you.' },
    { id: 'pulse', name: 'Pulse', sub: 'Bold and quick. Your people on top, big cards, tabs under your thumb.' },
  ];
  const TV = { room: 'gifos-tv', v: 'cc51c5e4f4418c66aa52a486' };   // the GifOS TV channel
  const available = () => root.GIFOS_VERSION === 'edge';
  const lsGet = (k) => { try { return root.localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { root.localStorage.setItem(k, v); } catch (e) {} };
  const lsJson = (k) => { try { const a = JSON.parse(lsGet(k) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const valid = (id) => VIEWS.some((v) => v.id === id);
  const current = () => { const v = available() ? lsGet(KEY) : null; return valid(v) ? v : 'classic'; };
  const hook = () => (GifOS.desktop && GifOS.desktop.home) || null;
  const MR = () => GifOS.meetMyRoom || null;
  const L = () => GifOS.link;

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
  };
  const svg = (n) => '<svg class="hv-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + '</svg>';
  const initials = (n) => (String(n || '?').replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2) || '?').toUpperCase();
  const hue = (n) => { let h = 0; for (const ch of String(n || '')) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const face = (n, cls) => '<span class="hv-av ' + (cls || '') + '" style="--h:' + hue(n) + '" aria-hidden="true">' + esc(initials(n)) + '</span>';
  const plain = (n) => String(n || '').replace(/\.gif$/i, '');   // every app is a GIF; the name never says so
  function relTime(ts) {
    const s = Math.max(0, (Date.now() - (ts || 0)) / 1000);
    if (s < 90) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    if (s < 86400 * 2) return 'yesterday';
    return Math.round(s / 86400) + ' days ago';
  }
  const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

  // ---- the model: read from where each thing already lives ----------------------------------------------------------
  function me() {
    let id = null; try { id = GifOS.store.identity(); } catch (e) {}
    const name = ((id && id.name) || '').trim();
    return { name, pic: id && id.avatar && id.avatar.url ? id.avatar.url : '' };
  }
  const myFace = (cls) => { const m = me(); return m.pic ? '<span class="hv-av pic ' + (cls || '') + '" aria-hidden="true"><img src="' + esc(m.pic) + '" alt=""></span>' : face(m.name || 'Me', cls); };
  // Contacts, my room and the hosted rooms: the one model the Meeting lobby and the Rooms app read (js/rooms-model.js).
  // The words are the lobby menu's too: Rooms and Contacts ("People" is who is in a meeting).
  function people() {
    const M = MR(), RM = GifOS.roomsModel; if (!M || !RM) return { mine: null, list: [], missed: [], hosted: [] };
    const m = RM.read(), list = RM.people(m);
    return { mine: m.mine, list, missed: RM.missed(m, list), hosted: m.hosted, privKeys: new Set(M.privates().map((p) => p.room)) };
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
  const appCache = new Map();   // item id -> { el, system }
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
    if (H) H.picture(it).then((r) => { if (r && r.img) { pic.textContent = ''; pic.appendChild(r.img); } else if (it.kind !== 'folder') pic.textContent = '📄'; appCache.set(it.id, r || {}); }).catch(() => {});
    return b;
  }
  // The launchers the Home view already is (Meeting, Rooms, Broadcast) are left out of its short app rows.
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
      const to = GifOS.roomsModel && GifOS.roomsModel.ring(p); if (!to) return;
      A.room(to.room, to.v);   // the new tab starts with a copy of this tab's hand-off notes
      try { root.sessionStorage.removeItem('gifos_join_av'); root.sessionStorage.removeItem('gifos_mr_mic'); } catch (e) {}
    },
    me() { if (GifOS.identityUI) GifOS.identityUI.manage(); },
    settings() { const H = hook(); if (H) H.settings(); },
    store() { const H = hook(); root.location.href = H ? H.storeHref() : '/store'; },
    add() { const H = hook(); if (H) H.add(); },
  };

  // ---- shared blocks ------------------------------------------------------------------------------------------------
  const PH = 'Room name or link';
  const joinForm = (cls, ph) =>
    '<form class="hv-join ' + (cls || '') + '" data-form="join" autocomplete="off">' +
      '<input name="room" maxlength="300" inputmode="text" enterkeyhint="go" aria-label="Room name" placeholder="' + esc(ph || PH) + '">' +
      '<button type="submit" class="hv-go">' + svg('video') + '<span>Join</span></button></form>';
  const JOIN_NOTE = 'Type any name. If the room is new, you start it. A room by name is majority-rules (aka open): anyone with the name can come in.';
  const JOIN_SHORT = 'A new name starts a room. Anyone with the name can come in.';
  const HONEST = 'Calls go device to device, end-to-end encrypted. Your people and rooms are kept on this device.';
  function missedChip(ppl) {
    if (!ppl.missed.length) return '';
    const m = ppl.missed[0], i = m.who ? ppl.list.indexOf(m.who) : -1;
    return '<div class="hv-missed" role="status"><span class="hv-dot"></span><span class="hv-missed-t"><b>Missed: ' + esc(m.name) + '</b> ' + esc(relTime(m.at)) +
      (ppl.missed.length > 1 ? ' · and ' + (ppl.missed.length - 1) + ' more' : '') + '</span>' +
      (i >= 0 ? '<button type="button" class="hv-pill hot" data-act="call:' + i + '">' + svg('phone') + 'Call back</button>' : '<button type="button" class="hv-pill" data-act="rooms">See</button>') +
      '<button type="button" class="hv-x" data-act="missed-clear" title="Clear missed calls" aria-label="Clear missed calls">✕</button></div>';
  }
  const personBubble = (p, i, missed) =>
    '<button type="button" class="hv-person' + (missed ? ' missed' : '') + '" data-act="call:' + i + '" title="Call ' + esc(p.name) + '">' +
      '<span class="hv-ring">' + face(p.name) + '<span class="hv-callbadge">' + svg('phone') + '</span></span>' +
      '<span class="hv-person-n">' + esc(p.name) + '</span></button>';
  const addBubble = (label) =>
    '<button type="button" class="hv-person add" data-act="rooms" title="Add someone"><span class="hv-ring"><span class="hv-av ghost">' + svg('plus') + '</span></span><span class="hv-person-n">' + esc(label || 'Add') + '</span></button>';
  const isMissed = (ppl, p) => ppl.missed.some((m) => m.who === p);
  // With nobody yet, the row is one plain invitation instead of a lone empty circle.
  const peopleStrip = (ppl, max) => (ppl.list.length ? ppl.list.slice(0, max).map((p, i) => personBubble(p, i, isMissed(ppl, p))).join('') + addBubble('Add')
    : '<button type="button" class="hv-invite" data-act="rooms"><span class="hv-av ghost">' + svg('plus') + '</span><span class="hv-row-t"><b>Add your people</b><span>Swap cards in a meeting, then call with one tap</span></span></button>');
  const NO_PEOPLE = 'Nobody here yet. In any meeting, open someone’s tile and choose Our private room: after that you call each other with one tap.';
  const roomKind = (r) => (r.v ? 'Hosted' : 'Majority-rules');
  const roomRow = (r, i, kind) =>
    '<button type="button" class="hv-row" data-act="' + kind + ':' + i + '"><span class="hv-row-ic" style="--h:' + hue(r.room) + '">' + svg(kind === 'cast' ? 'tv' : r.v ? 'key' : 'door') + '</span>' +
      '<span class="hv-row-t"><b>' + esc(r.name) + '</b><span>' + esc((kind === 'cast' ? 'Broadcast' : roomKind(r)) + (r.saved ? ' · saved' : r.ts ? ' · ' + relTime(r.ts) : '')) + '</span></span>' +
      '<span class="hv-row-go">' + svg('arrow') + '</span></button>';
  const tvRow = () =>
    '<button type="button" class="hv-row tv" data-act="tv"><span class="hv-row-ic live">' + svg('tv') + '</span><span class="hv-row-t"><b>GifOS TV</b><span>The GifOS channel</span></span><span class="hv-row-go">' + svg('arrow') + '</span></button>';

  // ---- sheets (over the view, under the Desktop's own dialogs) --------------------------------------------------------
  let sheetEl = null;
  function closeSheet() { if (sheetEl) { sheetEl.remove(); sheetEl = null; } }
  function sheet(title, fill, cls) {
    closeSheet();
    const bg = doc.createElement('div'); bg.className = 'hv-sheet-bg hv-skin-' + current();
    bg.innerHTML = '<div class="hv-sheet ' + (cls || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><header><button type="button" class="hv-sheet-back" data-act="sheet-back" hidden aria-label="Back">' + svg('back') + '</button><h2>' + esc(title) + '</h2><button type="button" class="hv-pill" data-act="sheet-close">Close</button></header><div class="hv-sheet-body"></div></div>';
    bg.addEventListener('click', (e) => { if (e.target === bg) closeSheet(); else onClick(e); });
    bg.addEventListener('submit', onSubmit);
    doc.body.appendChild(bg); sheetEl = bg;
    fill(bg.querySelector('.hv-sheet-body'), bg);
    return bg;
  }
  function appsSheet(folderId) {
    const H = hook(), folder = folderId && H ? H.items().find((x) => x.id === folderId) : null;
    sheet(folder ? plain(folder.name) : 'Apps', (body, bg) => {
      if (folder) { const bk = bg.querySelector('.hv-sheet-back'); bk.hidden = false; bk.dataset.act = folder.parent ? 'folder:' + folder.parent : 'apps'; }
      const list = apps(folderId || null);
      const g = doc.createElement('div'); g.className = 'hv-appgrid';
      list.forEach((it) => g.appendChild(appTile(it)));
      body.appendChild(g);
      if (!list.length) g.innerHTML = '<p class="hv-quiet">Nothing in here yet.</p>';
      if (!folder) {
        const f = doc.createElement('div'); f.className = 'hv-sheet-foot';
        f.innerHTML = '<button type="button" class="hv-pill hot" data-act="store">' + svg('bag') + 'App Store</button><button type="button" class="hv-pill" data-act="add">' + svg('plus') + 'Add</button>' +
          '<button type="button" class="hv-pill" data-act="view:classic">Arrange on the Desktop</button>';
        body.appendChild(f);
      }
    }, 'apps');
  }
  function peopleSheet() {
    const ppl = people();
    sheet('Contacts', (body) => {
      body.innerHTML = (ppl.list.length ? '<div class="hv-rows">' + ppl.list.map((p, i) =>
        '<div class="hv-row person">' + face(p.name) + '<span class="hv-row-t"><b>' + esc(p.name) + (p.ok ? ' <i class="hv-ok" title="Swapped in person">✓</i>' : '') + '</b><span>' + (p.kind === 'p' ? 'Our private room' : 'Card to their room') + (isMissed(ppl, p) ? ' · missed call' : '') + '</span></span>' +
        '<button type="button" class="hv-pill hot" data-act="call:' + i + '">' + svg('phone') + 'Call</button></div>').join('') + '</div>' : '<p class="hv-quiet">' + esc(NO_PEOPLE) + '</p>') +
        '<div class="hv-sheet-foot"><button type="button" class="hv-pill" data-act="rooms">' + svg('people') + 'Add someone</button></div>';
    });
  }
  function startSheet() {
    const ppl = people();
    sheet('Meet', (body) => {
      body.innerHTML = joinForm('big') + '<p class="hv-quiet">' + esc(JOIN_NOTE) + '</p>' +
        '<div class="hv-rows"><button type="button" class="hv-row" data-act="myroom"><span class="hv-row-ic">' + svg('home') + '</span><span class="hv-row-t"><b>' + (ppl.mine ? 'My room' : 'Make my room') + '</b><span>' + (ppl.mine ? esc(ppl.mine.room) + ' · stands by with mic and camera off' : 'Your own address, if you choose to share it') + '</span></span><span class="hv-row-go">' + svg('arrow') + '</span></button>' +
        '<button type="button" class="hv-row" data-act="lobby"><span class="hv-row-ic">' + svg('key') + '</span><span class="hv-row-t"><b>Host a room</b><span>You hold the host password and decide who comes in</span></span><span class="hv-row-go">' + svg('arrow') + '</span></button>' +
        '<button type="button" class="hv-row" data-act="golive"><span class="hv-row-ic live">' + svg('tv') + '</span><span class="hv-row-t"><b>Go live</b><span>Broadcast to as many viewers as come</span></span><span class="hv-row-go">' + svg('arrow') + '</span></button></div>' +
        '<p class="hv-quiet">' + esc(HONEST) + '</p>';
      const inp = body.querySelector('input'); if (inp) root.requestAnimationFrame(() => inp.focus());
    });
  }
  function pick() {
    const cur = current();
    sheet('Home view', (body) => {
      body.innerHTML = '<p class="hv-quiet">One Home Screen, different ways to look at it. Nothing is moved or lost when you switch.</p><div class="hv-picks">' +
        VIEWS.map((v) => '<button type="button" class="hv-pick' + (v.id === cur ? ' on' : '') + '" data-act="view:' + v.id + '" aria-pressed="' + (v.id === cur) + '">' +
          '<span class="hv-thumb t-' + v.id + '" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="hv-pick-t"><b>' + esc(v.name) + '</b><span>' + esc(v.sub) + '</span></span></button>').join('') + '</div>' +
        '<p class="hv-quiet">Glass, Orbit and Pulse are try-outs on this test build.</p>';
    }, 'pick');
  }

  // ---- the three looks ----------------------------------------------------------------------------------------------
  const LOOKS = {
    // GLASS: one calm column. Clock and greeting, the meet card, people, then what is on, apps in a dock.
    glass(el, d) {
      const now = new Date();
      el.innerHTML = '<div class="hv-scroll"><div class="g-col"><div class="g-side">' +
        '<header class="g-head"><div class="g-clock">' + esc(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) + '</div>' +
          '<div class="g-hello">' + esc(greeting() + (d.me.name ? ', ' + d.me.name : '')) + '</div></header>' +
        missedChip(d.ppl) +
        '<section class="g-card g-meet"><h1>Meet</h1>' + joinForm('big') +
          '<div class="g-chips"><button type="button" class="hv-pill" data-act="myroom">' + svg('home') + (d.ppl.mine ? 'My room' : 'Make my room') + '</button>' +
          '<button type="button" class="hv-pill" data-act="lobby">' + svg('key') + 'Host a room</button>' +
          '<button type="button" class="hv-pill" data-act="golive">' + svg('tv') + 'Go live</button></div>' +
          '<p class="hv-quiet">' + esc(JOIN_SHORT) + '</p></section></div><div class="g-side">' +
        '<section class="g-people g-card"><div class="hv-sec-h"><h2>Contacts</h2>' + (d.ppl.list.length ? '<button type="button" class="hv-link" data-act="people">All</button>' : '') + '</div>' +
          '<div class="hv-strip">' + peopleStrip(d.ppl, 12) + '</div></section>' +
        '<div class="g-two"><section class="g-card"><div class="hv-sec-h"><h2>Recent rooms</h2></div><div class="hv-rows">' +
            (d.rooms.length ? d.rooms.slice(0, 4).map((r, i) => roomRow(r, i, 'room')).join('') : '<p class="hv-quiet">Rooms you join show up here.</p>') + '</div></section>' +
          '<section class="g-card"><div class="hv-sec-h"><h2>On now</h2></div><div class="hv-rows">' + tvRow() + d.casts.slice(0, 3).map((r, i) => roomRow(r, i, 'cast')).join('') + '</div></section></div>' +
        '<p class="hv-quiet g-foot">' + esc(HONEST) + '</p></div></div></div>' +
        '<nav class="g-dock" aria-label="Apps"></nav>';
      const dock = el.querySelector('.g-dock');
      shortApps(root.innerWidth < 560 ? 4 : 7).forEach((it) => dock.appendChild(appTile(it, 'dock')));
      const all = doc.createElement('button'); all.type = 'button'; all.className = 'hv-app dock all'; all.dataset.act = 'apps';
      all.innerHTML = '<span class="hv-app-pic">' + svg('grid') + '</span><span class="hv-app-n">All apps</span>'; dock.appendChild(all);
    },
    // ORBIT: you in the middle; people on the first ring, places on the second, apps on the third.
    orbit(el, d) {
      const ring = (n, items) => '<div class="o-ring r' + n + '">' + items.map((h, i) => '<div class="o-b" style="--a:' + (360 * i / items.length + n * 37).toFixed(1) + 'deg"><div class="o-in">' + h + '</div></div>').join('') + '</div>';
      const r1 = d.ppl.list.slice(0, 8).map((p, i) => personBubble(p, i, isMissed(d.ppl, p)));
      r1.push(addBubble('Add'));
      const place = (act, ic, name, cls) => '<button type="button" class="o-place ' + (cls || '') + '" data-act="' + act + '"><span class="o-place-ic">' + svg(ic) + '</span><span class="o-place-n">' + esc(name) + '</span></button>';
      const r2 = [place('myroom', 'home', 'My room'), place('tv', 'tv', 'GifOS TV', 'live')]
        .concat(d.rooms.slice(0, 4).map((r, i) => place('room:' + i, r.v ? 'key' : 'door', r.name)));
      if (r2.length < 5) r2.push(place('lobby', 'key', 'Host a room'), place('golive', 'tv', 'Go live'));   // otherwise behind the middle button
      el.innerHTML = '<div class="o-sky" aria-hidden="true"><i></i><i></i><i></i></div>' +
        '<div class="o-top"><div class="o-hello"><b>' + esc(greeting() + (d.me.name ? ', ' + d.me.name : '')) + '</b><span>Tap a face to call. Tap yourself to meet.</span></div>' + missedChip(d.ppl) + '</div>' +
        '<div class="o-stage"><div class="o-orbits" aria-hidden="true"><i></i><i></i><i></i></div>' + ring(1, r1) + ring(2, r2) + '<div class="o-ring r3"></div>' +
          '<button type="button" class="o-core" data-act="start" title="Start or join a meeting"><span class="o-halo"></span>' + myFace('big') + '<span class="o-core-t">' + svg('video') + 'Meet</span></button></div>' +
        '<div class="o-bar">' + joinForm('') + '<button type="button" class="hv-pill o-apps" data-act="apps">' + svg('grid') + '<span>Apps</span></button></div>';
      const r3 = el.querySelector('.r3'), list = shortApps(9);
      list.forEach((it, i) => {
        const b = doc.createElement('div'); b.className = 'o-b'; b.style.setProperty('--a', (360 * i / Math.max(1, list.length) + 15).toFixed(1) + 'deg');
        const inn = doc.createElement('div'); inn.className = 'o-in'; inn.appendChild(appTile(it, 'orb')); b.appendChild(inn); r3.appendChild(b);
      });
    },
    // PULSE: tabs. Home is people on top and big cards; People, Live and Apps are their own tabs; the middle button starts a meeting.
    pulse(el, d) {
      const tab = state.tab || 'home';
      const story = '<div class="hv-strip p-stories">' + peopleStrip(d.ppl, 14) + '</div>';
      const jump = d.rooms.length ? '<div class="hv-sec-h"><h2>Jump back in</h2></div><div class="p-cards">' + d.rooms.slice(0, 8).map((r, i) =>
        '<button type="button" class="p-card" data-act="room:' + i + '" style="--h:' + hue(r.room) + '"><span class="p-card-k">' + esc(roomKind(r)) + '</span><b>' + esc(r.name) + '</b><span class="p-card-s">' + esc(r.saved ? 'Saved' : relTime(r.ts)) + '</span><span class="p-card-go">' + svg('video') + 'Join</span></button>').join('') + '</div>' : '';
      const live = '<div class="hv-sec-h"><h2>Live</h2></div><button type="button" class="p-live" data-act="tv"><span class="p-live-tag"><span class="hv-dot"></span>GifOS TV</span><b>Watch the GifOS channel</b><span>Tap to tune in</span></button>';
      const panels = {
        home: missedChip(d.ppl) + story +
          '<section class="p-hero"><h1>' + esc(d.me.name ? 'Hey ' + d.me.name + '.' : 'Hey.') + '<br>Where are we meeting?</h1>' + joinForm('big') + '<p class="hv-quiet">' + esc(JOIN_SHORT) + '</p></section>' +
          jump + live + '<div class="hv-sec-h"><h2>Apps</h2><button type="button" class="hv-link" data-act="tab:apps">All</button></div><div class="p-approw"></div><p class="hv-quiet">' + esc(HONEST) + '</p>',
        people: '<h1 class="p-title">Contacts</h1>' + missedChip(d.ppl) + (d.ppl.list.length ? '<div class="hv-rows">' + d.ppl.list.map((p, i) =>
          '<div class="hv-row person">' + face(p.name) + '<span class="hv-row-t"><b>' + esc(p.name) + (p.ok ? ' <i class="hv-ok">✓</i>' : '') + '</b><span>' + (p.kind === 'p' ? 'Our private room' : 'Card to their room') + '</span></span><button type="button" class="hv-pill hot" data-act="call:' + i + '">' + svg('phone') + 'Call</button></div>').join('') + '</div>' : '<p class="hv-quiet">' + esc(NO_PEOPLE) + '</p>') +
          '<div class="hv-rows"><button type="button" class="hv-row" data-act="myroom"><span class="hv-row-ic">' + svg('home') + '</span><span class="hv-row-t"><b>' + (d.ppl.mine ? 'My room' : 'Make my room') + '</b><span>' + (d.ppl.mine ? esc(d.ppl.mine.room) : 'Your own address, if you choose to share it') + '</span></span><span class="hv-row-go">' + svg('arrow') + '</span></button>' +
          '<button type="button" class="hv-row" data-act="rooms"><span class="hv-row-ic">' + svg('people') + '</span><span class="hv-row-t"><b>Add someone</b><span>Cards, ringing and missed calls are in Rooms</span></span><span class="hv-row-go">' + svg('arrow') + '</span></button></div>',
        live: '<h1 class="p-title">Live</h1><button type="button" class="p-live" data-act="tv"><span class="p-live-tag"><span class="hv-dot"></span>GifOS TV</span><b>Watch the GifOS channel</b><span>Tap to tune in</span></button>' +
          (d.casts.length ? '<div class="hv-sec-h"><h2>Watched before</h2></div><div class="hv-rows">' + d.casts.map((r, i) => roomRow(r, i, 'cast')).join('') + '</div>' : '') +
          '<div class="hv-rows"><button type="button" class="hv-row" data-act="golive"><span class="hv-row-ic live">' + svg('tv') + '</span><span class="hv-row-t"><b>Go live</b><span>Broadcast to as many viewers as come</span></span><span class="hv-row-go">' + svg('arrow') + '</span></button></div>',
        apps: '<h1 class="p-title">Apps</h1><div class="hv-appgrid p-allapps"></div><div class="hv-sheet-foot"><button type="button" class="hv-pill hot" data-act="store">' + svg('bag') + 'App Store</button><button type="button" class="hv-pill" data-act="add">' + svg('plus') + 'Add</button></div>',
      };
      const tabBtn = (id, ic, name) => '<button type="button" class="p-tab' + (tab === id ? ' on' : '') + '" data-act="tab:' + id + '" aria-current="' + (tab === id ? 'page' : 'false') + '">' + svg(ic) + '<span>' + name + '</span></button>';
      el.innerHTML = '<div class="hv-scroll"><div class="p-col p-' + tab + '">' + (panels[tab] || panels.home) + '</div></div>' +
        '<nav class="p-tabs" aria-label="Home">' + tabBtn('home', 'home', 'Home') + tabBtn('people', 'people', 'Contacts') +
          '<button type="button" class="p-plus" data-act="start" title="Start or join a meeting" aria-label="Start or join a meeting">' + svg('video') + '</button>' +
          tabBtn('live', 'tv', 'Live') + tabBtn('apps', 'grid', 'Apps') + '</nav>';
      const row = el.querySelector('.p-approw'); if (row) shortApps(8).forEach((it) => row.appendChild(appTile(it)));
      const all = el.querySelector('.p-allapps'); if (all) apps(null).forEach((it) => all.appendChild(appTile(it)));
    },
  };

  // ---- mount, paint, events -----------------------------------------------------------------------------------------
  const state = { tab: 'home', data: null };
  let host = null, paintQueued = false;
  function data() { const ppl = people(); return { me: me(), ppl, rooms: visited('meet', ppl), casts: visited('cast', ppl) }; }
  function paint() {
    const id = current();
    if (id === 'classic' || !host) return;
    const keep = host.querySelector('.hv-join input'), typed = keep && doc.activeElement === keep ? keep.value : null;
    const sc = host.querySelector('.hv-scroll'), top = sc ? sc.scrollTop : 0;
    state.data = data();
    host.className = 'hv hv-' + id;
    LOOKS[id](host, state.data);
    const meBtn = doc.getElementById('hv-me-btn'); if (meBtn) meBtn.innerHTML = myFace();
    const sc2 = host.querySelector('.hv-scroll'); if (sc2) sc2.scrollTop = top;
    if (typed !== null) { const inp = host.querySelector('.hv-join input'); if (inp) { inp.value = typed; inp.focus(); } }
  }
  function queuePaint() { if (paintQueued) return; paintQueued = true; root.requestAnimationFrame(() => { paintQueued = false; if (!sheetEl || !sheetEl.querySelector('input:focus')) paint(); }); }
  function onSubmit(e) {
    const f = e.target.closest ? e.target.closest('[data-form="join"]') : null; if (!f) return;
    e.preventDefault(); const inp = f.querySelector('input'); A.join(inp.value); inp.value = ''; closeSheet();
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
      case 'golive': A.goLive(); closeSheet(); break;
      case 'lobby': A.lobby(); closeSheet(); break;
      case 'myroom': A.myRoom(); closeSheet(); break;
      case 'rooms': A.rooms(); break;
      case 'missed-clear': { const M = MR(); if (M) { M.clearMissed(); paint(); } break; }
      case 'me': A.me(); break;
      case 'store': A.store(); break;
      case 'add': closeSheet(); A.add(); break;
      case 'settings': A.settings(); break;
      case 'start': startSheet(); break;
      case 'people': peopleSheet(); break;
      case 'apps': appsSheet(null); break;
      case 'folder': if (current() === 'classic') break; appsSheet(arg); break;
      case 'app': { const it = H && H.items().find((x) => x.id === arg); if (it) H.open(it); break; }
      case 'tab': state.tab = arg; paint(); { const sc = host && host.querySelector('.hv-scroll'); if (sc) sc.scrollTop = 0; } break;
      case 'view': closeSheet(); set(arg); break;
      case 'pick': pick(); break;
      case 'sheet-close': closeSheet(); break;
      default: break;
    }
  }
  function loadScript(src) {
    return new Promise((res) => { const s = doc.createElement('script'); s.src = src; s.onload = res; s.onerror = res; doc.head.appendChild(s); });
  }
  let roomsReady = null;
  // My Room is read through its own module, loaded the first time a view needs it (the Desktop view never does).
  function needRooms() {
    if (roomsReady) return roomsReady;
    roomsReady = (async () => {
      if (!GifOS.net) await loadScript('js/gifos-net.js');
      if (!GifOS.meetMyRoom) await loadScript('js/meet-myroom.js');
      if (!GifOS.roomsModel) await loadScript('js/rooms-model.js');
    })();
    return roomsReady;
  }
  function apply() {
    const id = current(), on = id !== 'classic';
    doc.body.classList.toggle('hv-on', on);
    if (on) doc.body.dataset.hv = id; else delete doc.body.dataset.hv;
    const btn = doc.getElementById('view-btn');
    if (btn) { btn.style.display = available() ? '' : 'none'; }
    let meBtn = doc.getElementById('hv-me-btn');
    if (!on) { if (host) { host.remove(); host = null; } if (meBtn) meBtn.remove(); return; }
    if (!meBtn && btn) {   // Me & My Contacts: in the bar, beside the view button
      meBtn = doc.createElement('button'); meBtn.type = 'button'; meBtn.id = 'hv-me-btn'; meBtn.className = 'hv-me-btn'; meBtn.title = 'Me & My Contacts'; meBtn.setAttribute('aria-label', 'Me & My Contacts');
      meBtn.addEventListener('click', () => A.me()); btn.parentNode.insertBefore(meBtn, btn);
    }
    if (!host) {
      host = doc.createElement('main'); host.id = 'home-view';
      host.addEventListener('click', onClick); host.addEventListener('submit', onSubmit);
      doc.body.appendChild(host);
    }
    paint();
    needRooms().then(queuePaint);
  }
  function set(id) { if (!available() || !valid(id)) return; lsSet(KEY, id); state.tab = 'home'; apply(); }

  // Settings → Look: the same choice as the bar's button, as a list.
  function settingsHtml() {
    const cur = current();
    return '<div class="set-group">Home view</div><div class="set-card set-pad hv-set"><p class="add-help">One Home Screen, different ways to look at it. Nothing is moved or lost when you switch. Glass, Orbit and Pulse are try-outs on this test build.</p>' +
      VIEWS.map((v) => '<label class="hv-set-row"><input type="radio" name="hv-view" value="' + v.id + '"' + (v.id === cur ? ' checked' : '') + '><span><b>' + esc(v.name) + '</b> <span class="hv-set-sub">' + esc(v.sub) + '</span></span></label>').join('') + '</div>';
  }
  function wireSettings(box) { box.querySelectorAll('input[name="hv-view"]').forEach((r) => { r.onchange = () => { if (r.checked) set(r.value); }; }); }

  GifOS.homeView = { available, current, set, pick, views: () => VIEWS.map((v) => v.id), menuLabel: 'Home view…', settingsHtml, wireSettings, repaint: queuePaint };

  if (!available()) return;
  // A link may name a view to try (?view=orbit): it only changes how this Home Screen is drawn.
  try {
    const m = /[?&#]view=([a-z]+)/.exec(root.location.search + root.location.hash);
    if (m && valid(m[1])) lsSet(KEY, m[1]);
  } catch (e) {}
  const H0 = hook(); if (H0) H0.onRender = queuePaint;
  const start = () => {
    const btn = doc.getElementById('view-btn');
    if (btn) { btn.innerHTML = svg('views'); btn.addEventListener('click', pick); }
    apply();
  };
  if (doc.body) start(); else doc.addEventListener('DOMContentLoaded', start);
  root.addEventListener('storage', (e) => { if (!e.key || e.key.indexOf('gifos_') === 0) { if (e.key === KEY) apply(); else queuePaint(); } });
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) queuePaint(); });
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  try { if (GifOS.store.onIdentity) GifOS.store.onIdentity(queuePaint); } catch (e) {}
  // The clock in the Glass view turns over on the minute: each tick waits for the next minute boundary.
  const tick = () => {
    if (current() === 'glass' && !doc.hidden) { const c = host && host.querySelector('.g-clock'); if (c) c.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1);
    root.setTimeout(tick, next - now);   // always in the future: the next minute
  };
  tick();
})(typeof window !== 'undefined' ? window : globalThis);
