/*
 * rooms.js — the Rooms app (rooms.html, Rooms.gif on the Home Screen). Copyright (c) 2026 Crowd Concepts, Inc.
 * All rights reserved.
 *
 * ONE CONCEPT: a room is a place, and a contact is a room we share. One scrolling screen of rooms; every row ends in
 * one launch into the meeting page, built by launch() through the one link grammar (js/core/link.js). This page decides
 * no rule: the lists, cards and keys are My Room's (js/meet-myroom.js, GifOS.meetMyRoom, device storage only), the
 * Doorbell is js/meet-bell.js (painted by js/core/view/bell.js), and ringing, answering and the private rooms' doors
 * happen in the meeting page.
 *
 *   My personal room   make (or use a hosted room I hold), Open (standby: mic and camera off), Give a card (link + QR),
 *                      Copy link
 *   Missed             calls missed while standing by, and rings the Doorbell showed that nobody answered
 *   Our private rooms  a contact IS our private room, made at the card swap (only the two of us, it rings either of us):
 *                      Call (I go to our private room; its door rings their devices), their personal room if they
 *                      shared it, Remove (cutPrivate: its key, my member key, the record, the cards between us and the
 *                      Doorbell handle go). Cards to someone's room without a private room (a card link) are listed too.
 *   Hosted rooms       other rooms whose host key this device holds: Open, Copy link, room password set or not (the host
 *                      password is never stored: the note says so)
 *   Ringing            stay in my personal room on this computer, how many private rooms a computer listens in, the
 *                      Doorbell (Ring me on this device, Pause, Your devices, Send a test ring)
 *   Cards I gave       Cancel card; Delete my personal room (typed name)
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const doc = root.document;
  const $ = (id) => doc.getElementById(id);
  const MR = () => GifOS.meetMyRoom;
  const L = () => GifOS.link;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mobile = () => { try { return !!(GifOS.meetPower && GifOS.meetPower.mobileDevice(root.navigator)); } catch (e) { return false; } };
  const lsGet = (k) => { try { return root.localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { root.localStorage.setItem(k, v); } catch (e) {} };
  const ssSet = (k, v) => { try { root.sessionStorage.setItem(k, v); } catch (e) {} };
  const timeOf = (at) => {
    try {
      const d = new Date(at), today = new Date().toDateString() === d.toDateString();
      return today ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) { return ''; }
  };

  // ---- launching: the one way into a room ---------------------------------------------------------------------------
  // Beside this page, in its own form: /rooms -> /meet, rooms.html -> meet.html (a snapshot's folder stays the same).
  const meetPath = () => { const p = root.location.pathname; return p.replace(/[^\/]*$/, '') + 'meet' + (/\.html$/.test(p) ? '.html' : ''); };
  const shareLink = (room, v) => root.location.origin + '/meet#' + L().hash({ room, v });
  // launch(room, v, how): how.priv = a private room (mic stays off until everyone there proved they belong; the meeting
  // page opens it), how.invite = the ring to leave for the meeting page (an old card contact's call naming a pair room).
  function launch(room, v, how) {
    how = how || {};
    if (how.invite) lsSet('gifos_mr_invite.' + MR().roomKey(room, v), JSON.stringify(Object.assign({}, how.invite, { at: Date.now() })));
    if (how.priv) { ssSet('gifos_join_av', JSON.stringify({ v: 1, cam: false, mic: false, at: Date.now() })); ssSet('gifos_mr_mic', room + '.' + v); }
    root.location.assign(meetPath() + '#' + L().hash({ room, v }));
  }
  async function copy(text, btn) {
    try { await root.navigator.clipboard.writeText(text); if (btn) btn.textContent = 'Copied'; }   // it reads Copied until the list is painted again
    catch (e) { root.prompt('Copy this link', text); }
  }

  // ---- what this device holds ---------------------------------------------------------------------------------------
  // read through the one model the Meeting lobby and the Home views share (js/rooms-model.js)
  const model = () => GifOS.roomsModel.read();
  const initials = (n) => (String(n || '?').replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2) || '?').toUpperCase();
  // A ring's label carries the caller-ID mark ("Bob ✓", "Bob (card)"); the person is the name before it.
  const bareName = (label) => String(label || '').replace(/\s*(✓|\(card\))\s*$/, '');
  const hue = (n) => { let h = 0; for (const ch of String(n || '')) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const avatar = (n) => '<span class="av" aria-hidden="true" style="--h:' + hue(n) + '">' + esc(initials(n)) + '</span>';
  const pk = (x) => x.room + '.' + x.v;
  // Who a missed call was from, to call back: the private room it rang in, else the person by name.
  function missedWho(m, x) {
    const M = MR(), k = M.roomKey(x.room, x.v), n = bareName(x.label);
    const pr = M.privFor(x.room, x.v);   // it rang in one of our private rooms (a door or the Doorbell)
    if (pr) return 'p:' + pk(pr);
    const o = m.ours.find((y) => y.p.name === n);
    if (o) return 'p:' + pk(o.p);
    const c = m.cards.find((y) => y.c.name === n);
    return c ? 'c:' + pk(c.c) : '';
  }

  // ---- painting -----------------------------------------------------------------------------------------------------
  let bellBox = null;   // the Doorbell's block (js/core/view/bell.js paints it): one element, moved into each new paint
  function paint() {
    if (!MR()) return;
    const M = MR(), m = model();
    let h = '';
    // My personal room
    h += '<section class="card" id="sec-mine" aria-labelledby="h-mine"><h2 id="h-mine">My personal room</h2>';
    if (m.mine) {
      const pw = !!lsGet('gifos_vpw_' + pk(m.mine));
      h += '<div class="room-line"><span class="room-name" id="mine-name">' + esc(m.mine.room) + '</span><span class="quiet">' + (pw ? 'Password set' : 'Your address') + '</span></div>' +
        '<p class="quiet">Open it and it stands by with your mic and camera off. Give a card and that person can ring it.</p>' +
        '<div class="acts"><button type="button" class="go" id="mine-open">Open</button>' +
        '<button type="button" id="mine-card">Give a card</button>' +
        '<button type="button" id="mine-copy">Copy link</button></div>';
    } else {
      const own = M.hosted().filter((x) => !M.privFor(x.room, x.v));
      h += '<p class="quiet">Your personal room is your address, if you choose to share it. Contacts call you in your private rooms with them.</p>' +
        '<div class="acts"><button type="button" class="go" id="mine-make">Make my personal room</button>' +
        (own.length ? '<button type="button" id="mine-adopt">Use a room I already host</button>' : '') + '</div>';
    }
    h += '</section>';

    // Missed
    if (m.missed.length) {
      h += '<section class="card" id="sec-missed" aria-labelledby="h-missed"><div class="sec-h"><h2 id="h-missed">Missed</h2><button type="button" class="text" id="missed-clear">Clear all</button></div><ul class="rows">';
      for (const x of m.missed.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 20)) {   // newest first
        const who = missedWho(m, x);
        h += '<li class="row missed">' + avatar(bareName(x.label)) + '<div class="main"><b>' + esc(x.label) + '</b><span class="quiet">' + esc(timeOf(x.at)) + '</span></div>' +
          (who ? '<button type="button" data-back="' + esc(who) + '">Call back</button>' : '') + '</li>';
      }
      h += '</ul></section>';
    }

    // Our private rooms: the contacts
    h += '<section class="card" id="sec-people" aria-labelledby="h-people"><div class="sec-h"><h2 id="h-people">Our private rooms</h2><button type="button" class="text" id="people-add">Add someone</button></div>';
    if (!m.ours.length && !m.cards.length && !m.loose.length) {
      h += '<p class="quiet" id="people-empty">No contacts yet. Swap cards with someone in a meeting: it makes your private room with them, which only the two of you can use and which rings either of you.</p>';
    } else {
      h += '<ul class="rows" id="people-list">';
      for (const x of m.ours) {
        const k = pk(x.p), n = x.p.name || 'Contact';
        h += '<li class="row person ours" data-pk="' + esc(k) + '">' + avatar(n) +
          '<button type="button" class="main as-text" data-more="p:' + esc(k) + '"><b>' + esc(n) + ' <span class="ok" title="Swapped in person">✓</span></b><span class="quiet">Our private room' + (x.card ? ' · personal room shared' : '') + '</span></button>' +
          '<button type="button" class="go" data-call="p:' + esc(k) + '">Call</button></li>';
      }
      for (const x of m.cards) {
        const k = pk(x.c);
        h += '<li class="row person card-only" data-k="' + esc(k) + '">' + avatar(x.c.name) +
          '<button type="button" class="main as-text" data-more="c:' + esc(k) + '"><b>' + esc(x.c.name) + (x.c.bound ? ' <span class="ok" title="Swapped in person">✓</span>' : ' <span class="quiet">(card)</span>') + '</b><span class="quiet">' + (x.pair ? 'Our private room' : 'A card to their room') + '</span></button>' +
          '<button type="button" class="go" data-call="c:' + esc(k) + '">Call</button></li>';
      }
      for (const p of m.loose) {
        const k = pk(p), n = p.name || (p.pubs.length > 1 ? 'Private room, ' + (p.pubs.length + 1) + ' people' : 'Our private room');
        h += '<li class="row group" data-gk="' + esc(k) + '">' + avatar(n) +
          '<button type="button" class="main as-text" data-gmore="' + esc(k) + '"><b>' + esc(n) + '</b><span class="quiet">' + (p.pubs.length > 1 ? 'Private room, ' + (p.pubs.length + 1) + ' people' : 'Our private room') + '</span></button>' +
          '<button type="button" class="go" data-gopen="' + esc(k) + '">Open</button></li>';
      }
      h += '</ul>';
    }
    h += '</section>';

    // Hosted rooms I hold
    if (m.hosted.length) {
      h += '<section class="card" id="sec-hosted" aria-labelledby="h-hosted"><h2 id="h-hosted">Hosted rooms on this device</h2>' +
        // The plaintext host password is never stored: say what makes this device host instead.
        '<p class="quiet" id="hosted-note">You\'re the host of these rooms. This device holds their host keys, so it doesn\'t need the passwords. ' +
        'A host password is shown only once, when its room is made, and is never stored, not even here. Nobody can recover it. ' +
        'To be host on your other devices, copy My identity to them. Give a password only to someone you want as a co-host.</p><ul class="rows">';
      for (const x of m.hosted) {
        const k = pk(x), pw = !!lsGet('gifos_vpw_' + k);
        h += '<li class="row hosted" data-hk="' + esc(k) + '"><div class="main"><b>' + esc(x.room) + '</b><span class="quiet">' + (pw ? 'Password set' : 'No password') + '</span></div>' +
          '<button type="button" data-hcopy="' + esc(k) + '">Copy link</button><button type="button" class="go" data-hopen="' + esc(k) + '">Open</button></li>';
      }
      h += '</ul></section>';
    }

    // Ringing: standing by, how many private rooms a computer listens in, the Doorbell
    h += '<section class="card" id="sec-ring" aria-labelledby="h-ring"><h2 id="h-ring">Ringing</h2>';
    if (m.mine && !mobile()) {
      h += '<label class="switch"><input type="checkbox" id="stay"' + (M.stayOn() ? ' checked' : '') + '><span>Stay in my personal room on this computer, so calls ring here</span></label>';
      // Honest about the step-1 limit: a computer listens in the most recently used private rooms only.
      const nPriv = M.privates().filter((x) => x.pubs.length === 1).length;
      if (nPriv > M.LISTEN_MAX) h += '<p class="quiet" id="mr-listen-cap">While your personal room is open, calls ring here from your ' + M.LISTEN_MAX + ' most recently used private rooms. Calls from the other ' + (nPriv - M.LISTEN_MAX) + ' ring by the Doorbell.</p>';
      else if (nPriv) h += '<p class="quiet" id="mr-listen-cap">While your personal room is open, calls from your private rooms ring here.</p>';
    } else if (m.mine) h += '<p class="quiet">A phone rings by the Doorbell (below), not by keeping your personal room open.</p>';
    h += '<h3>Doorbell</h3><div id="bell-slot"></div></section>';

    // Cards I gave, deleting my personal room
    if (m.mine) {
      h += '<section class="card" id="sec-settings" aria-labelledby="h-settings"><h2 id="h-settings">Cards I gave</h2>';
      if (!m.issued.length) h += '<p class="quiet">None yet.</p>';
      else {
        h += '<ul class="rows">';
        for (const x of m.issued) h += '<li class="row"><div class="main"><b>' + esc(x.label || 'Card') + '</b><span class="quiet">' + esc(timeOf(x.at)) + (x.cpub ? ' · swapped in person' : ' · link or QR') + '</span></div><button type="button" data-revoke="' + esc(x.id) + '">Cancel card</button></li>';
        h += '</ul>';
      }
      h += '<button type="button" class="danger" id="mine-delete">Delete my personal room…</button></section>';
    }
    $('rooms').innerHTML = h;
    if (!bellBox) { bellBox = doc.createElement('div'); bellBox.id = 'rooms-bell'; bellBox.className = 'bell'; }
    $('bell-slot').appendChild(bellBox);
    wire(m);
  }

  function byKey(k) { const i = k.lastIndexOf('.'); return { room: k.slice(0, i), v: k.slice(i + 1) }; }
  // A call: I go to our private room; its door rings their devices (I prove my member key first), and the Doorbell
  // rings the rest. This is the lobby's Call as it was (js/core/view/myroom.js before Rooms).
  function callOurs(k) { const { room, v } = byKey(k); launch(room, v, { priv: true }); }
  // A card to their room: a call rings their personal room (naming our old pair room, when there is one).
  function callCard(k) {
    const { room, v } = byKey(k), M = MR(), c = M.contactFor(room, v), pr = c && M.pairWith(M.contactPub(c));
    launch(room, v, pr ? { invite: { to: pr.room + '.' + pr.v, go: 1, pv: 1 } } : {});
  }
  function wire(m) {
    const on = (id, f) => { const el = $(id); if (el) el.onclick = f; };
    on('mine-open', () => launch(m.mine.room, m.mine.v));
    on('mine-copy', (e) => copy(shareLink(m.mine.room, m.mine.v), e.currentTarget));
    on('mine-card', () => openCard(''));
    on('mine-make', openMake);
    on('mine-adopt', openAdopt);
    on('mine-delete', openDelete);
    on('missed-clear', () => { MR().clearMissed(); paint(); });
    on('people-add', openAdd);
    const stay = $('stay'); if (stay) stay.onchange = () => MR().setStay(stay.checked);
    const all = (sel, f) => doc.querySelectorAll('#rooms ' + sel).forEach((b) => { b.onclick = (e) => f(b, e); });
    // A person's row: p:<room.v> is our private room, c:<room.v> a card to their room.
    const pick = (w, ours, card) => (w.indexOf('p:') === 0 ? ours(w.slice(2)) : card(w.slice(2)));
    all('[data-call]', (b) => pick(b.getAttribute('data-call'), callOurs, callCard));
    all('[data-more]', (b) => pick(b.getAttribute('data-more'), openOurs, openCardContact));
    all('[data-gmore]', (b) => openGroup(b.getAttribute('data-gmore')));
    all('[data-gopen]', (b) => { const { room, v } = byKey(b.getAttribute('data-gopen')); launch(room, v, { priv: true }); });
    all('[data-back]', (b) => pick(b.getAttribute('data-back'), callOurs, callCard));
    all('[data-hopen]', (b) => { const { room, v } = byKey(b.getAttribute('data-hopen')); launch(room, v); });
    all('[data-hcopy]', (b) => { const { room, v } = byKey(b.getAttribute('data-hcopy')); copy(shareLink(room, v), b); });
    all('[data-revoke]', (b) => { MR().revoke(b.getAttribute('data-revoke')); paint(); });
  }

  // ---- sheets: a sticky header (title + Close), a scrolling body, a sticky footer with the actions --------------------
  function sheet(title, body, actions) {
    closeSheet();
    const wrap = doc.createElement('div'); wrap.className = 'sheet-back'; wrap.id = 'sheet';
    wrap.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-t"><header><h2 id="sheet-t">' + esc(title) + '</h2><button type="button" class="text" id="sheet-x">Close</button></header>' +
      '<div class="sheet-body">' + body + '</div>' + (actions ? '<footer>' + actions + '</footer>' : '') + '</div>';
    wrap.addEventListener('click', (e) => { if (e.target === wrap) closeSheet(); });
    doc.body.appendChild(wrap); doc.body.classList.add('sheet-on');
    $('sheet-x').onclick = closeSheet;
    const f = wrap.querySelector('input'); if (f) root.requestAnimationFrame(() => f.focus());
    return wrap;
  }
  function closeSheet() { const s = $('sheet'); if (s) s.remove(); doc.body.classList.remove('sheet-on'); }
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  function confirmSheet(title, words, go) {
    sheet(title, '<p>' + words + ' It cannot be undone.</p>', '<button type="button" id="rm-keep">Keep</button><button type="button" class="danger" id="rm-go">Remove</button>');
    $('rm-keep').onclick = closeSheet;
    $('rm-go').onclick = () => { go(); closeSheet(); paint(); };
  }

  function openMake() {
    sheet('Make my personal room', '<label for="make-name">Room name</label><input id="make-name" maxlength="40" autocomplete="off" placeholder="e.g. ada"><p class="quiet" id="make-note">Letters, numbers and dashes. This device makes the room\'s key; nothing to remember.</p>',
      '<button type="button" class="go" id="make-go">Make room</button>');
    const go = async () => {
      try { await MR().create($('make-name').value); closeSheet(); paint(); }
      catch (e) { $('make-note').textContent = e.message; }
    };
    $('make-go').onclick = go;
    $('make-name').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  }
  function openAdopt() {
    const own = MR().hosted().filter((x) => !MR().privFor(x.room, x.v));
    sheet('Use a room I already host', '<p class="quiet">It becomes your personal room. Its link and password stay as they are.</p><ul class="rows">' +
      own.map((o) => '<li class="row"><div class="main"><b>' + esc(o.room) + '</b></div><button type="button" class="go" data-adopt="' + esc(pk(o)) + '">Use</button></li>').join('') + '</ul>', '');
    doc.querySelectorAll('[data-adopt]').forEach((b) => { b.onclick = () => { const { room, v } = byKey(b.getAttribute('data-adopt')); MR().adopt(room, v); closeSheet(); paint(); }; });
  }
  // Give a card: a link and a QR that let one person ring my personal room ("Paul (card)" when they call).
  function openCard(label) {
    sheet('Give a card', '<label for="card-label">Who is it for? (only you see this)</label><input id="card-label" maxlength="40" autocomplete="off" value="' + esc(label) + '">' +
      '<p class="quiet">Whoever has this card can ring your personal room. Swapping cards in a meeting is better: you get a private room that only the two of you can use, with a ✓.</p>' +
      '<div id="card-out" hidden><input id="card-link" readonly aria-label="Card link"><div id="card-qr" class="qr"></div></div>',
      '<button type="button" id="card-share" hidden>Share</button><button type="button" class="go" id="card-go">Make card</button>');
    const go = async () => {
      if (!$('card-out').hidden) return copy($('card-link').value, $('card-go'));
      const m = MR().mine(); if (!m) return;
      const lab = $('card-label').value.trim(); if (!lab) { $('card-label').focus(); return; }
      const K = lsGet('gifos_vadm_' + pk(m));
      const r = await MR().mint(K, m.room, m.v, lab);
      const link = MR().cardLink(root.location.origin, m.room, m.v, r.token);
      try { const list = MR().issued(); list.unshift({ room: m.room, v: m.v, id: r.id, label: lab, exp: r.exp, at: Date.now() }); lsSet(MR().KEY.issued, JSON.stringify(list.slice(0, 500))); } catch (e) {}
      $('card-link').value = link; $('card-out').hidden = false; $('card-go').textContent = 'Copy link';
      if (root.navigator.share) { const s = $('card-share'); s.hidden = false; s.onclick = () => root.navigator.share({ title: 'A card to my room', url: link }).catch(() => {}); }
      drawQr(link);
      paint();
    };
    $('card-go').onclick = () => { go().catch(() => {}); };
  }
  function drawQr(text) {
    const box = $('card-qr'); if (!box) return;
    const draw = () => { try { const q = root.qrcode(0, 'L'); q.addData(text); q.make(); box.innerHTML = q.createSvgTag({ cellSize: 3, margin: 2, scalable: true }); } catch (e) { box.textContent = ''; } };
    if (typeof root.qrcode === 'function') return draw();
    const s = doc.createElement('script'); s.src = 'js/vendor/qrcode.js'; s.onload = draw; doc.head.appendChild(s);
  }
  function openAdd() {
    const m = MR().mine();
    sheet('Add someone',
      '<h3>In a meeting together (best)</h3><p class="quiet">In any meeting with them, open their tile’s menu (or People) and choose <b>Our private room</b>: you swap cards and get a private room that only the two of you can use, and that rings either of you.</p>' +
      (m ? '<button type="button" class="go wide" id="add-meet">Open my personal room</button>' : '') +
      '<h3>Give a card by link or QR</h3><p class="quiet">They can ring your personal room. It shows as “Name (card)” when they do.</p>' +
      (m ? '<button type="button" class="wide" id="add-card">Give a card</button>' : '<button type="button" class="wide" id="add-make">Make my personal room first</button>'), '');
    if ($('add-meet')) $('add-meet').onclick = () => launch(m.room, m.v);
    if ($('add-card')) $('add-card').onclick = () => openCard('');
    if ($('add-make')) $('add-make').onclick = openMake;
  }
  // A contact: our private room.
  function openOurs(k) {
    const { room, v } = byKey(k), M = MR(), p = M.privFor(room, v); if (!p) return;
    const n = p.name || 'Contact', card = M.cardIn(p);
    sheet(n + ' ✓',
      '<p class="quiet">Our private room: only you and ' + esc(n) + ' can use it, and it rings either of you. Call takes you there and rings ' + esc(n) + '’s devices.</p>' +
      '<div class="stack"><button type="button" class="go wide" id="p-call">Call</button>' +
      (card ? '<button type="button" class="wide" id="p-visit">' + esc(n) + '’s personal room</button>' : '') + '</div>' +
      '<button type="button" class="danger wide" id="p-remove">Remove ' + esc(n) + '…</button>', '');
    $('p-call').onclick = () => callOurs(k);
    if (card) $('p-visit').onclick = () => launch(card.room, card.v);
    $('p-remove').onclick = () => confirmSheet('Remove ' + n + '?',
      'Our private room is deleted from this device and stops ringing you: its key goes, the Doorbell stops taking ' + esc(n) + '’s rings, and the personal-room cards between you are dropped.',
      () => M.cutPrivate(room, v));
  }
  // A card to someone's room, with no private room of ours.
  function openCardContact(k) {
    const { room, v } = byKey(k), M = MR(), c = M.contactFor(room, v); if (!c) return;
    sheet(c.name + (c.bound ? ' ✓' : ''),
      '<p class="quiet">You hold a card to ' + esc(c.name) + '’s room: Call rings it. Swap cards in a meeting to get a private room.</p>' +
      '<div class="stack"><button type="button" class="go wide" id="p-call">Call</button>' +
      (M.mine() ? '<button type="button" class="wide" id="p-card">Give ' + esc(c.name) + ' a card</button>' : '') + '</div>' +
      '<button type="button" class="danger wide" id="p-remove">Remove ' + esc(c.name) + '…</button>', '');
    $('p-call').onclick = () => callCard(k);
    if ($('p-card')) $('p-card').onclick = () => openCard(c.name);
    $('p-remove').onclick = () => confirmSheet('Remove ' + c.name + '?', 'The card you hold for ' + esc(c.name) + '’s room is deleted from this device.', () => M.forget(room, v));
  }
  function openGroup(k) {
    const { room, v } = byKey(k), M = MR(), p = M.privFor(room, v); if (!p) return;
    const n = p.name || 'Our private room';
    sheet(n, '<p class="quiet">Only its people can use it.</p><div class="stack"><button type="button" class="go wide" id="pv-open">Open</button></div><button type="button" class="danger wide" id="pv-remove">Remove this private room…</button>', '');
    $('pv-open').onclick = () => launch(room, v, { priv: true });
    $('pv-remove').onclick = () => confirmSheet('Remove ' + n + '?', 'This device forgets the room and its key: you can never open it again.', () => M.cutPrivate(room, v));
  }
  function openDelete() {
    const M = MR(), m = M.mine(); if (!m) return;
    const n = M.issued().filter((x) => M.roomKey(x.room, x.v) === M.roomKey(m.room, m.v)).length;
    const tied = M.privates().filter((x) => !x.me).length;
    sheet('Delete my personal room?',
      '<p><b>Every card you gave for it stops working' + (n ? ' (' + n + ')' : '') + '.</b> Nobody can ring you with them again, and this device forgets the room’s key, so the room cannot be got back.</p>' +
      (tied ? '<p>' + tied + ' older private room' + (tied > 1 ? 's are' : ' is') + ' tied to this room’s key, so ' + (tied > 1 ? 'they end' : 'it ends') + ' too.</p>' : '') +
      '<p class="quiet">Your private rooms with your contacts stay: you can still call them.</p>' +
      '<label for="del-type">Type the room name to confirm</label><input id="del-type" autocomplete="off" placeholder="' + esc(m.room) + '">',
      '<button type="button" id="del-keep">Keep</button><button type="button" class="danger" id="del-go" disabled>Delete</button>');
    $('del-keep').onclick = closeSheet;
    $('del-type').oninput = () => { $('del-go').disabled = $('del-type').value.trim().toLowerCase() !== m.room; };
    $('del-go').onclick = () => { M.dropMine(); closeSheet(); paint(); };
  }

  function start() {
    paint();
    // Another tab (the meeting) changed the lists: a missed call, a swap, a removal. A Doorbell write repaints its own block.
    root.addEventListener('storage', (e) => { if (e.key && e.key.indexOf('gifos_') === 0 && e.key.indexOf('gifos_bell') !== 0 && !$('sheet')) paint(); });
    root.addEventListener('pageshow', (e) => { if (e.persisted) paint(); });
  }
  root.__roomsState = () => {
    try {
      const m = model();
      return { mine: m.mine, ours: m.ours.map((x) => ({ name: x.p.name, room: x.p.room, shared: !!x.card })), cards: m.cards.map((x) => ({ name: x.c.name, room: x.c.room, bound: !!x.c.bound, pair: x.pair ? x.pair.room : '' })),
        loose: m.loose.map((p) => p.room), hosted: m.hosted.map((h) => h.room), missed: m.missed.length, issued: m.issued.length, bell: !!$('rooms-bell') };
    } catch (e) { return { err: String(e) }; }
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
