/*
 * rooms.js — the Rooms app (rooms.html, Rooms.gif on the Home Screen). Copyright (c) 2026 Crowd Concepts, Inc.
 * All rights reserved.
 *
 * ONE CONCEPT: a room is a place, and a contact is a room we share. One scrolling screen of rooms; every row ends in
 * one launch into the meeting page, built by launch() through the one link grammar (js/core/link.js). This page decides
 * no rule: the lists, cards and keys are My Room's (js/meet-myroom.js, GifOS.meetMyRoom, device storage only), and
 * ringing, answering and the private rooms' doors happen in the meeting page.
 *
 *   My personal room   make (or use a hosted room I hold), Open (standby: mic and camera off), Give a card (link + QR),
 *                      Copy link, Stay in it on this computer, Delete (every card it gave stops working)
 *   Missed             calls missed while my personal room stood by (hidden when there are none)
 *   Our private rooms  one per contact: Call (rings their personal room naming our private room; Answer brings both),
 *                      Open our private room, Remove (its key and record go: the room is dead for both)
 *   Hosted rooms       other rooms whose host key this device holds: Open, Copy link, password on this device or not
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
  // page opens it), how.invite = the ring to leave for the meeting page (a call naming our private room).
  function launch(room, v, how) {
    how = how || {};
    if (how.invite) lsSet('gifos_mr_invite.' + MR().roomKey(room, v), JSON.stringify(Object.assign({}, how.invite, { at: Date.now() })));
    if (how.priv) { ssSet('gifos_join_av', JSON.stringify({ v: 1, cam: false, mic: false, at: Date.now() })); ssSet('gifos_mr_mic', room + '.' + v); }
    root.location.assign(meetPath() + '#' + L().hash({ room, v }));
  }
  async function copy(text, btn) {
    try { await root.navigator.clipboard.writeText(text); if (btn) { const t = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = t; }, 1500); } }
    catch (e) { root.prompt('Copy this link', text); }
  }

  // ---- what this device holds ---------------------------------------------------------------------------------------
  function model() {
    const M = MR(), mine = M.mine();
    const privs = M.privates();
    const contacts = M.contacts().map((c) => {
      const pub = M.contactPub(c), pair = pub ? M.pairWith(pub) : null;
      return { c, pub, pair };
    });
    const paired = new Set(contacts.filter((x) => x.pair).map((x) => M.roomKey(x.pair.room, x.pair.v)));
    const loose = privs.filter((p) => !paired.has(M.roomKey(p.room, p.v)));   // groups, or a pair room with no card kept
    const taken = new Set(privs.map((p) => M.roomKey(p.room, p.v)));
    if (mine) taken.add(M.roomKey(mine.room, mine.v));
    const hosted = M.hosted().filter((h) => !taken.has(M.roomKey(h.room, h.v)));
    return { mine, contacts, loose, hosted, missed: M.missed(), issued: M.issued().filter((x) => mine && M.roomKey(x.room, x.v) === M.roomKey(mine.room, mine.v)) };
  }
  const initials = (n) => (String(n || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2) || '?').toUpperCase();
  const hue = (n) => { let h = 0; for (const ch of String(n || '')) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const avatar = (n) => '<span class="av" aria-hidden="true" style="--h:' + hue(n) + '">' + esc(initials(n)) + '</span>';

  // ---- painting -----------------------------------------------------------------------------------------------------
  function paint() {
    if (!MR()) return;
    const m = model();
    let h = '';
    // My personal room
    h += '<section class="card" id="sec-mine" aria-labelledby="h-mine"><h2 id="h-mine">My personal room</h2>';
    if (m.mine) {
      const pw = !!lsGet('gifos_vpw_' + m.mine.room + '.' + m.mine.v);
      h += '<div class="room-line"><span class="room-name" id="mine-name">' + esc(m.mine.room) + '</span><span class="quiet">' + (pw ? 'Password set' : 'Your address') + '</span></div>' +
        '<p class="quiet">Open it and it stands by with your mic and camera off: people with a card from you ring here.</p>' +
        '<div class="acts"><button type="button" class="go" id="mine-open">Open</button>' +
        '<button type="button" id="mine-card">Give a card</button>' +
        '<button type="button" id="mine-copy">Copy link</button></div>';
    } else {
      const own = MR().hosted().filter((x) => !MR().privFor(x.room, x.v));
      h += '<p class="quiet">Make a room that is yours. People you give a card to can ring it, and the people you swap cards with get a private room with you.</p>' +
        '<div class="acts"><button type="button" class="go" id="mine-make">Make my personal room</button>' +
        (own.length ? '<button type="button" id="mine-adopt">Use a room I already host</button>' : '') + '</div>';
    }
    h += '</section>';

    // Missed
    if (m.missed.length) {
      h += '<section class="card" id="sec-missed" aria-labelledby="h-missed"><div class="sec-h"><h2 id="h-missed">Missed</h2><button type="button" class="text" id="missed-clear">Clear all</button></div><ul class="rows">';
      for (const x of m.missed.slice(0, 20)) {
        const who = m.contacts.find((k) => k.c.name === x.label);
        h += '<li class="row">' + avatar(x.label) + '<div class="main"><b>' + esc(x.label) + '</b><span class="quiet">' + esc(timeOf(x.at)) + '</span></div>' +
          (who ? '<button type="button" data-call="' + esc(who.c.room + '.' + who.c.v) + '">Call</button>' : '') + '</li>';
      }
      h += '</ul></section>';
    }

    // Our private rooms (contacts)
    h += '<section class="card" id="sec-people" aria-labelledby="h-people"><div class="sec-h"><h2 id="h-people">Our private rooms</h2><button type="button" class="text" id="people-add">Add someone</button></div>';
    if (!m.contacts.length && !m.loose.length) {
      h += '<p class="quiet" id="people-empty">No one yet. Swap cards with someone in a meeting and you both get a private room that only the two of you can use.</p>';
    } else {
      h += '<ul class="rows" id="people-list">';
      for (const x of m.contacts) {
        const k = x.c.room + '.' + x.c.v;
        const mark = x.c.bound ? ' <span class="ok" title="Swapped in person">✓</span>' : ' <span class="quiet">(card)</span>';
        h += '<li class="row person" data-k="' + esc(k) + '">' + avatar(x.c.name) +
          '<button type="button" class="main as-text" data-more="' + esc(k) + '"><b>' + esc(x.c.name) + mark + '</b><span class="quiet">' + (x.pair ? 'Our private room' : 'A card to their room') + '</span></button>' +
          '<button type="button" class="go" data-call="' + esc(k) + '">Call</button></li>';
      }
      for (const p of m.loose) {
        const k = p.room + '.' + p.v, n = p.name || (p.pubs.length > 1 ? 'Private room, ' + (p.pubs.length + 1) + ' people' : 'Our private room');
        h += '<li class="row group" data-pk="' + esc(k) + '">' + avatar(n) +
          '<button type="button" class="main as-text" data-pmore="' + esc(k) + '"><b>' + esc(n) + '</b><span class="quiet">' + (p.pubs.length > 1 ? 'Private room, ' + (p.pubs.length + 1) + ' people' : 'Our private room') + '</span></button>' +
          '<button type="button" class="go" data-popen="' + esc(k) + '">Open</button></li>';
      }
      h += '</ul>';
    }
    h += '</section>';

    // Hosted rooms I hold
    if (m.hosted.length) {
      h += '<section class="card" id="sec-hosted" aria-labelledby="h-hosted"><h2 id="h-hosted">Hosted rooms on this device</h2><ul class="rows">';
      for (const x of m.hosted) {
        const k = x.room + '.' + x.v, pw = !!lsGet('gifos_vpw_' + k);
        h += '<li class="row hosted" data-hk="' + esc(k) + '"><div class="main"><b>' + esc(x.room) + '</b><span class="quiet">' + (pw ? 'Password set' : 'No password') + '</span></div>' +
          '<button type="button" data-hcopy="' + esc(k) + '">Copy link</button><button type="button" class="go" data-hopen="' + esc(k) + '">Open</button></li>';
      }
      h += '</ul></section>';
    }

    // Settings: ringing, the cards I gave, deleting my personal room
    if (m.mine) {
      h += '<section class="card" id="sec-settings" aria-labelledby="h-settings"><h2 id="h-settings">Ringing and cards</h2>';
      if (!mobile()) h += '<label class="switch"><input type="checkbox" id="stay"' + (MR().stayOn() ? ' checked' : '') + '><span>Stay in my personal room on this computer, so calls ring here</span></label>';
      else h += '<p class="quiet">Calls ring here while your personal room is open on this device.</p>';
      h += '<h3>Cards I gave</h3>';
      if (!m.issued.length) h += '<p class="quiet">None yet.</p>';
      else {
        h += '<ul class="rows">';
        for (const x of m.issued) h += '<li class="row"><div class="main"><b>' + esc(x.label || 'Card') + '</b><span class="quiet">' + esc(timeOf(x.at)) + (x.cpub ? ' · swapped in person' : ' · link or QR') + '</span></div><button type="button" data-revoke="' + esc(x.id) + '">Cancel card</button></li>';
        h += '</ul>';
      }
      h += '<button type="button" class="danger" id="mine-delete">Delete my personal room…</button></section>';
    }
    $('rooms').innerHTML = h;
    wire(m);
  }

  function byKey(k) { const i = k.lastIndexOf('.'); return { room: k.slice(0, i), v: k.slice(i + 1) }; }
  function call(k) {
    const { room, v } = byKey(k), M = MR(), c = M.contactFor(room, v), pr = c && M.pairWith(M.contactPub(c));
    // A call to someone I share a private room with rings their personal room naming it; Answer takes both there.
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
    const all = (sel, f) => doc.querySelectorAll(sel).forEach((b) => { b.onclick = (e) => f(b, e); });
    all('[data-call]', (b) => call(b.getAttribute('data-call')));
    all('[data-more]', (b) => openPerson(b.getAttribute('data-more')));
    all('[data-pmore]', (b) => openPriv(b.getAttribute('data-pmore')));
    all('[data-popen]', (b) => { const { room, v } = byKey(b.getAttribute('data-popen')); launch(room, v, { priv: true }); });
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
    const f = wrap.querySelector('input'); if (f) setTimeout(() => f.focus(), 50);
    return wrap;
  }
  function closeSheet() { const s = $('sheet'); if (s) s.remove(); doc.body.classList.remove('sheet-on'); }
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

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
      own.map((o) => '<li class="row"><div class="main"><b>' + esc(o.room) + '</b></div><button type="button" class="go" data-adopt="' + esc(o.room + '.' + o.v) + '">Use</button></li>').join('') + '</ul>', '');
    doc.querySelectorAll('[data-adopt]').forEach((b) => { b.onclick = () => { const { room, v } = byKey(b.getAttribute('data-adopt')); MR().adopt(room, v); closeSheet(); paint(); }; });
  }
  // Give a card: a link and a QR that let one person ring my personal room ("Paul (card)" when they call).
  function openCard(label) {
    sheet('Give a card', '<label for="card-label">Who is it for? (only you see this)</label><input id="card-label" maxlength="40" autocomplete="off" value="' + esc(label) + '">' +
      '<p class="quiet">Whoever has this card can ring your personal room. Swapping cards in a meeting is better: you both get a private room and a ✓.</p>' +
      '<div id="card-out" hidden><input id="card-link" readonly aria-label="Card link"><div id="card-qr" class="qr"></div></div>',
      '<button type="button" id="card-share" hidden>Share</button><button type="button" class="go" id="card-go">Make card</button>');
    const go = async () => {
      if (!$('card-out').hidden) return copy($('card-link').value, $('card-go'));
      const m = MR().mine(); if (!m) return;
      const lab = $('card-label').value.trim(); if (!lab) { $('card-label').focus(); return; }
      const K = lsGet('gifos_vadm_' + m.room + '.' + m.v);
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
    if (!m) { openMake(); $('make-note').textContent = 'First make your personal room: your cards and private rooms are tied to it.'; return; }
    sheet('Add someone',
      '<h3>In a meeting together (best)</h3><p class="quiet">Open your personal room and invite them, or join theirs. Tap their tile and choose <b>Private room</b>: you swap cards, each of you gets a ✓, and you get a private room that only the two of you can use.</p>' +
      '<button type="button" class="go wide" id="add-meet">Open my personal room</button>' +
      '<h3>Give a card by link or QR</h3><p class="quiet">They can ring your personal room. It shows as “Name (card)” when they do.</p>' +
      '<button type="button" class="wide" id="add-card">Give a card</button>', '');
    $('add-meet').onclick = () => launch(m.room, m.v);
    $('add-card').onclick = () => openCard('');
  }
  function openPerson(k) {
    const { room, v } = byKey(k), M = MR(), c = M.contactFor(room, v); if (!c) return;
    const pr = M.pairWith(M.contactPub(c));
    sheet(c.name + (c.bound ? ' ✓' : ''),
      '<p class="quiet">' + (pr ? 'Call rings ' + esc(c.name) + '’s personal room; Answer takes you both to your private room.' : 'You hold a card to ' + esc(c.name) + '’s room. Meet once in a meeting and swap cards to get a private room.') + '</p>' +
      '<div class="stack"><button type="button" class="go wide" id="p-call">Call</button>' +
      (pr ? '<button type="button" class="wide" id="p-open">Open our private room</button>' : '') +
      (M.mine() ? '<button type="button" class="wide" id="p-card">Give another card</button>' : '') + '</div>' +
      '<button type="button" class="danger wide" id="p-remove">Remove ' + esc(c.name) + '…</button>', '');
    $('p-call').onclick = () => call(k);
    if (pr) $('p-open').onclick = () => launch(pr.room, pr.v, { priv: true });
    if ($('p-card')) $('p-card').onclick = () => openCard(c.name);
    $('p-remove').onclick = () => confirmRemove(c, pr);
  }
  function confirmRemove(c, pr) {
    sheet('Remove ' + c.name + '?',
      '<p>' + (pr ? 'This ends your private room for both of you and cancels the card you gave ' + esc(c.name) + '. Nobody can ring or open it again.' : 'This removes the card you hold for ' + esc(c.name) + '’s room and cancels any card you gave them.') + ' It cannot be undone.</p>',
      '<button type="button" id="rm-keep">Keep</button><button type="button" class="danger" id="rm-go">Remove</button>');
    $('rm-keep').onclick = closeSheet;
    $('rm-go').onclick = () => { MR().cut(c.room, c.v); closeSheet(); paint(); };
  }
  function openPriv(k) {
    const { room, v } = byKey(k), p = MR().privFor(room, v); if (!p) return;
    const n = p.name || 'Our private room';
    sheet(n, '<p class="quiet">Only its people can use it.</p><div class="stack"><button type="button" class="go wide" id="pv-open">Open</button></div><button type="button" class="danger wide" id="pv-remove">Remove this private room…</button>', '');
    $('pv-open').onclick = () => launch(room, v, { priv: true });
    $('pv-remove').onclick = () => {
      sheet('Remove ' + n + '?', '<p>This device forgets the room and its key: you can never open it again. It cannot be undone.</p>',
        '<button type="button" id="rm-keep">Keep</button><button type="button" class="danger" id="rm-go">Remove</button>');
      $('rm-keep').onclick = closeSheet;
      $('rm-go').onclick = () => { MR().dropPrivate(room, v); closeSheet(); paint(); };
    };
  }
  function openDelete() {
    const m = MR().mine(); if (!m) return;
    const n = MR().issued().filter((x) => MR().roomKey(x.room, x.v) === MR().roomKey(m.room, m.v)).length;
    const tied = MR().privates().filter((x) => !x.me).length;
    sheet('Delete my personal room?',
      '<p><b>Every card you gave for it stops working' + (n ? ' (' + n + ')' : '') + '.</b> Nobody can ring you with them again, and this device forgets the room’s key, so the room cannot be got back.</p>' +
      (tied ? '<p>Your private rooms (' + tied + ') are tied to this room’s key, so they end too.</p>' : '') +
      '<p class="quiet">Your contacts stay: you can still call them.</p>' +
      '<label for="del-type">Type the room name to confirm</label><input id="del-type" autocomplete="off" placeholder="' + esc(m.room) + '">',
      '<button type="button" id="del-keep">Keep</button><button type="button" class="danger" id="del-go" disabled>Delete</button>');
    $('del-keep').onclick = closeSheet;
    $('del-type').oninput = () => { $('del-go').disabled = $('del-type').value.trim().toLowerCase() !== m.room; };
    $('del-go').onclick = () => { MR().dropMine(); closeSheet(); paint(); };
  }

  function start() {
    paint();
    // Another tab (the meeting) changed the lists: a missed call, a saved card, a private room.
    root.addEventListener('storage', (e) => { if (e.key && e.key.indexOf('gifos_') === 0 && !$('sheet')) paint(); });
    root.addEventListener('pageshow', (e) => { if (e.persisted) paint(); });
  }
  root.__roomsState = () => { try { const m = model(); return { mine: m.mine, contacts: m.contacts.map((x) => ({ name: x.c.name, room: x.c.room, bound: !!x.c.bound, pair: x.pair ? x.pair.room : '' })), loose: m.loose.map((p) => p.room), hosted: m.hosted.map((h) => h.room), missed: m.missed.length, issued: m.issued.length }; } catch (e) { return { err: String(e) }; } };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
