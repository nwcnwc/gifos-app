/*
 * GifOS Core: My Room's view (meet.html). Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * Paints what the My Room part (js/meet-myroom.js, GifOS.meetMyRoom.live, built by the core per meeting) says, and turns
 * a person's taps into its intents. It decides no rule: who may ring, what rings and when a ring is missed are the
 * part's. The lobby section (My Room, missed calls, Contacts) reads the device's own lists (GifOS.meetMyRoom).
 *
 *   owner   a ring sheet with a ringtone (Answer: mic on, camera off; Decline), the standby line, missed calls, and
 *           "Give a card" for the people in the meeting
 *   caller  the bar: "Waiting for Ada", "Ringing Ada", "Ada can't answer right now", and "Give Ada your card" once the
 *           call is answered (asked again in the leave question if not used)
 *   anyone  "Save this card?" when a card is handed over or a card link was opened
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const doc = root.document;
  if (!doc) return;
  const $ = (id) => doc.getElementById(id);
  const MR = () => GifOS.meetMyRoom;
  const T = () => GifOS.timings || {};
  const LINKS = () => GifOS.link;
  const show = (el, on) => { if (el) el.style.display = on ? '' : 'none'; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const timeOf = (at) => { try { return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
  const mobile = () => { try { return !!(GifOS.meetPower && GifOS.meetPower.mobileDevice(root.navigator)); } catch (e) { return false; } };
  const roomUrl = (room, v) => LINKS().pageFor(root.location.pathname, 'meet') + '#' + LINKS().hash({ room, v });
  // The lobby and the meeting are one page: a new fragment alone loads nothing, so going to a room reloads (as the
  // lobby's own Create does).
  const openRoom = (room, v, replace) => { const u = roomUrl(room, v); if (replace) root.location.replace(u); else root.location.assign(u); root.location.reload(); };
  const DEL_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9z"/></svg>';

  // ---- the ringtone: two tones in the phone cadence, quiet, until stopped -------------------------------------------
  let ringAc = null, ringTimer = 0;
  function ringCtx() {
    if (!ringAc) { try { const AC = root.AudioContext || root.webkitAudioContext; ringAc = AC ? new AC() : null; } catch (e) { ringAc = null; } }
    return ringAc;
  }
  function ringOnce() {
    const ac = ringCtx(); if (!ac) return;
    try {
      const g = ac.createGain(); g.gain.value = 0; g.connect(ac.destination);
      const t0 = ac.currentTime;
      g.gain.setValueAtTime(0.12, t0); g.gain.setValueAtTime(0.12, t0 + 1.9); g.gain.linearRampToValueAtTime(0, t0 + 2);
      for (const f of [440, 480]) { const o = ac.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t0); o.stop(t0 + 2); }
    } catch (e) {}
  }
  function ringStart() { if (ringTimer) return; ringOnce(); ringTimer = root.setInterval(ringOnce, 3 * T().MYROOM_TICK_MS * 2); }   // 2 s on, 4 s off
  function ringStop() { if (ringTimer) { root.clearInterval(ringTimer); ringTimer = 0; } }
  const ringBlocked = () => { const ac = ringCtx(); return !!ac && ac.state === 'suspended'; };

  // ---- the caller's bar and the owner's standby line share one bar -------------------------------------------------
  let barAct = null;
  function bar(text, act, actText, closable) {
    const el = $('mr-bar'); if (!el) return;
    if (!text) { el.hidden = true; barAct = null; doc.body.classList.remove('mr-on'); return; }
    $('mr-bar-text').textContent = text;
    const b = $('mr-bar-act'); barAct = act || null; b.hidden = !act; if (act) b.textContent = actText;
    $('mr-bar-x').hidden = !closable;
    el.hidden = false; doc.body.classList.add('mr-on');
  }

  // ---- one meeting ----------------------------------------------------------------------------------------------------
  let part = null, ringing = null, offer = null, barShut = false;
  function callWords(c) {
    const n = c.label || 'them';
    if (c.invite && c.state === 'accepted') return n + ' is coming to your meeting.';
    if (c.invite && (c.state === 'waiting' || c.state === 'ringing')) return 'Inviting ' + n + ' to ' + c.invite.split('.')[0] + '…';
    if (c.state === 'waiting') return 'Waiting for ' + n + '. ' + n + '’s devices ring when one of them has this room open.';
    if (c.state === 'ringing') return 'Ringing ' + n + '…';
    if (c.state === 'declined') return n + ' can’t answer right now.';
    if (c.state === 'noanswer') return n + ' didn’t answer. You can keep waiting here.';
    return '';
  }
  function paint() {
    if (!part) return;
    const st = part.state();
    doc.body.classList.toggle('mr-calling', !!(st.call && st.call.state !== 'answered'));   // the "only one here" card stays away while I call
    if (st.owner) {
      if (st.rings.length) {
        const r = st.rings[0];
        if (!ringing || ringing.pid !== r.pid) {
          ringing = r;
          const where = r.to ? r.to.split('.')[0] : '';
          $('mr-ring-title').textContent = where ? r.label + ' invites you to ' + where : r.label + ' is calling';
          $('mr-ring-note').textContent = where ? 'Join takes you to their meeting with your mic on; your camera stays off.' : 'They have a card to your room. Answering turns your mic on; your camera stays off.';
          $('mr-answer').textContent = where ? 'Join' : 'Answer';
          show($('mr-ring'), true);
          ringStart();
        }
      } else if (ringing) { ringing = null; show($('mr-ring'), false); ringStop(); }
      if (st.standby && !barShut) bar(ringBlocked() ? 'Your room is open. Turn on the ringer so calls can ring here.' : 'Your room is open. People with your card ring here.', ringBlocked() ? () => { try { ringCtx().resume(); } catch (e) {} paint(); } : null, 'Turn on the ringer', true);
      else if (!st.standby && st.mine && part.people().length && !barShut) bar('Your room', () => openMake(true), 'Give a card', true);
      else if (!barShut) bar('');
      return;
    }
    const c = st.call;
    // Held at the door (the owner's room stands by): the waiting-room screen names who is being called.
    const wd = $('waitdoor');
    if (c && c.state !== 'answered' && wd && !wd.hidden) {
      const n = c.label || 'them', h = wd.querySelector('h1'), p = wd.querySelector('h1 + p');
      const head = c.invite && c.state !== 'declined' && c.state !== 'noanswer' ? callWords(c) : c.state === 'ringing' ? 'Ringing ' + n + '…' : c.state === 'declined' ? n + ' can’t answer right now' : c.state === 'noanswer' ? n + ' didn’t answer' : 'Calling ' + n + '…';
      const body = c.state === 'ringing' ? 'You’ll join when ' + n + ' answers. ' + n + ' can’t see or hear you yet.' : c.state === 'declined' || c.state === 'noanswer' ? 'You can wait here, or leave and call again later.' : n + '’s room is open. Waiting for it to ring.';
      if (h && h.textContent !== head) h.textContent = head;
      if (p && p.textContent !== body) p.textContent = body;
    }
    if (c && c.state === 'answered') {
      const host = part.hostIds()[0];
      if (MR().mine() && host && !part.gaveTo(host) && !barShut) bar('Give ' + c.label + ' your card, so they can call you back?', () => giveBack(host, c.label), 'Give my card', true);
      else bar('');
    } else if (c && !barShut) bar(callWords(c), null, '', c.state === 'declined' || c.state === 'noanswer');
    else bar('');
  }
  function openPick() {
    const box = $('mr-pick-list'); box.innerHTML = '';
    const here = LINKS().read(root.location.pathname, '', root.location.hash);
    for (const c of MR().contacts()) {
      const b = doc.createElement('button'); b.type = 'button'; b.className = 'mr-who'; b.textContent = c.name;
      b.onclick = () => {
        // The ring rides a window of its own (the contact's room); this meeting stays as it is. The meeting to come to is
        // named by the one link grammar's fields; a password never travels: the meeting's own door decides.
        try { root.localStorage.setItem('gifos_mr_invite.' + MR().roomKey(c.room, c.v), JSON.stringify({ to: here.room + (here.v ? '.' + here.v : ''), at: Date.now() })); } catch (e) {}
        const w = root.open(roomUrl(c.room, c.v), 'mr-invite-' + c.room, 'popup,width=420,height=640');
        b.disabled = true; b.textContent = w ? 'Ringing ' + c.name + '…' : 'Allow pop-ups to invite';
      };
      box.appendChild(b);
    }
    show($('mr-pick'), true);
  }
  async function giveBack(pid, label) { try { await part.give(pid, label); } catch (e) {} bar('Card given. ' + label + ' can call you now.', null, '', true); }
  function onEvent(ev) {
    if (ev.type === 'offer') { offer = ev; openOffer(); }
    else if (ev.type === 'missed') toast('Missed call from ' + ev.label + ', ' + timeOf(ev.at));
    else if (ev.type === 'arrived') toast(ev.label + ' is here (they have a card to this room).');
    else if (ev.type === 'renewed-mine') {}   // a renewal is silent
    else if (ev.type === 'go') {   // an invitation accepted: to that meeting, mic on (the person's own tap), camera off
      try { root.sessionStorage.setItem('gifos_join_av', JSON.stringify({ v: 1, cam: false, mic: true, at: Date.now() })); } catch (e) {}
      ringStop(); openRoom(ev.room, ev.v);
      return;
    }
    else if (ev.type === 'call' && ev.call && ev.call.invite && /accepted|declined|noanswer/.test(ev.call.state) && root.opener) {
      setTimeout(() => { try { root.close(); } catch (e) {} }, 3 * T().MYROOM_TICK_MS);   // the inviting window was only the ring: it closes
    }
    paint();
  }
  function toast(text) { bar(text, null, '', true); setTimeout(paint, 4 * T().MYROOM_RING_MS / 10); }
  function openOffer() {
    if (!offer) return;
    const f = offer.card;
    const known = MR().contactFor(f.room, f.v);
    $('mr-offer-title').textContent = offer.fromLink ? 'Save this card?' : (offer.from || 'Someone') + ' gave you a card';
    $('mr-offer-note').textContent = offer.back ? 'It calls ' + (offer.from || 'them') + '’s room. Keep it in your Contacts to call them.' : 'With it you can call this room from your Contacts.';
    $('mr-offer-name').value = (known && known.name) || offer.from || f.room;
    if (known && known.id === f.id) { offer = null; return; }
    show($('mr-offer'), true);
  }
  // Give a card (owner) — to someone in the meeting, or as a link and QR code.
  function openMake(inMeeting) {
    $('mr-make-out').hidden = true; $('mr-make-label').value = ''; $('mr-make-go').textContent = 'Make card';
    const who = $('mr-make-who'); who.innerHTML = '';
    if (inMeeting && part) {
      for (const p of part.people()) {
        const b = doc.createElement('button'); b.type = 'button'; b.className = 'mr-who'; b.textContent = p.name || 'Guest';
        b.onclick = async () => { const label = $('mr-make-label').value.trim() || p.name || 'Guest'; b.disabled = true; await part.give(p.id, label).catch(() => false); b.textContent = '✓ ' + label; };
        who.appendChild(b);
      }
      if (who.childNodes.length) { const n = doc.createElement('p'); n.textContent = 'Tap a person to hand them a card, or make a link.'; who.insertBefore(n, who.firstChild); }
    }
    show($('mr-make'), true);
    $('mr-make-label').focus();
  }
  async function makeLink() {
    const m = MR().mine(); if (!m) return;
    const label = $('mr-make-label').value.trim(); if (!label) { $('mr-make-label').focus(); return; }
    const K = root.localStorage.getItem('gifos_vadm_' + m.room + '.' + m.v);
    const r = await MR().mint(K, m.room, m.v, label);
    const link = MR().cardLink(root.location.origin, m.room, m.v, r.token);
    $('mr-make-link').value = link; $('mr-make-out').hidden = false;
    try { const list = MR().issued(); list.unshift({ room: m.room, v: m.v, id: r.id, label, exp: r.exp, at: Date.now() }); root.localStorage.setItem(MR().KEY.issued, JSON.stringify(list.slice(0, 500))); } catch (e) {}
    drawQr(link);
    try { if (root.navigator.share && mobile()) await root.navigator.share({ title: 'A card to my room', url: link }); else await root.navigator.clipboard.writeText(link); } catch (e) {}
  }
  function drawQr(text) {
    const box = $('mr-make-qr');
    const draw = () => { try { const q = root.qrcode(0, 'L'); q.addData(text); q.make(); box.innerHTML = q.createSvgTag({ cellSize: 3, margin: 2, scalable: true }); } catch (e) { box.textContent = ''; } };
    if (typeof root.qrcode === 'function') return draw();
    const s = doc.createElement('script'); s.src = 'js/vendor/qrcode.js'; s.onload = draw; doc.head.appendChild(s);
  }

  // ---- the lobby: My Room, missed calls, Contacts ------------------------------------------------------------------
  function paintLobby() {
    const box = $('lob-myroom'); if (!box || !MR()) return;
    const M = MR(), mine = M.mine(), missed = M.missed(), list = M.contacts();
    let h = '';
    if (missed.length) {
      h += '<div class="mr-missed"><b>Missed calls</b>' + missed.slice(0, 5).map((x) => '<div>' + esc(x.label) + ' · ' + esc(timeOf(x.at)) + '</div>').join('') + '<button type="button" id="mr-missed-x" class="lob-text">Clear</button></div>';
    }
    h += '<div class="lob-hist-h">My Room</div>';
    if (mine) {
      h += '<div class="mr-mine"><span class="li-name">' + esc(mine.room) + '</span>' +
        '<button type="button" id="mr-open" class="lob-ghost">Open my room</button>' +
        '<button type="button" id="mr-make-card" class="lob-ghost">Give a card</button></div>';
      if (!mobile()) h += '<label class="mr-stay"><input type="checkbox" id="mr-stay"' + (M.stayOn() ? ' checked' : '') + '> Stay in my room on this computer, so calls ring here</label>';
    } else {
      const own = M.hosted();
      h += '<p class="lob-quiet">Your room is your address: people you give a card to can call you there.</p>' +
        '<div class="mr-mine"><input id="mr-name" maxlength="40" placeholder="Name your room" autocomplete="off"><button type="button" id="mr-create" class="lob-ghost">Make My Room</button></div>';
      if (own.length) h += '<div class="mr-adopt">Or use one of your hosted rooms: ' + own.slice(0, 6).map((o) => '<button type="button" class="lob-text" data-adopt="' + esc(o.room + '.' + o.v) + '">' + esc(o.room) + '</button>').join(' ') + '</div>';
    }
    h += '<div class="lob-hist-h">Contacts</div>';
    if (!list.length) h += '<p class="lob-quiet">No contacts yet. When someone gives you a card, it is kept here.</p>';
    for (const c of list) {
      h += '<div class="lob-item mr-contact" data-room="' + esc(c.room) + '" data-v="' + esc(c.v) + '"><div class="li-main"><span class="li-name">' + esc(c.name) + '</span></div>' +
        '<button type="button" class="lob-ghost" data-call="1">Call</button>' +
        '<button type="button" class="row-del" data-forget="1" title="Remove" aria-label="Remove">' + DEL_ICON + '</button></div>';
    }
    box.innerHTML = h; box.hidden = false;
    const on = (id, f) => { const el = $(id); if (el) el.onclick = f; };
    on('mr-missed-x', () => { M.clearMissed(); paintLobby(); });
    on('mr-open', () => { openRoom(mine.room, mine.v); });
    on('mr-make-card', () => openMake(false));
    on('mr-create', async () => {
      const n = ($('mr-name').value || ($('lob-name-in') || {}).value || '').trim();
      try { await M.create(n); paintLobby(); } catch (e) { $('mr-name').placeholder = e.message; $('mr-name').value = ''; }
    });
    const stay = $('mr-stay'); if (stay) stay.onchange = () => M.setStay(stay.checked);
    box.querySelectorAll('[data-adopt]').forEach((b) => { b.onclick = () => { const [r, v] = b.getAttribute('data-adopt').split('.'); M.adopt(r, v); paintLobby(); }; });
    box.querySelectorAll('.mr-contact').forEach((row) => {
      const r = row.getAttribute('data-room'), v = row.getAttribute('data-v');
      row.querySelector('[data-call]').onclick = () => { openRoom(r, v); };
      row.querySelector('[data-forget]').onclick = () => { M.forget(r, v); paintLobby(); };
    });
  }

  function wire() {
    const on = (id, f) => { const el = $(id); if (el) el.onclick = f; };
    on('mr-answer', () => { if (ringing && part) part.answer(ringing.pid); ringing = null; ringStop(); show($('mr-ring'), false); paint(); });
    on('mr-decline', () => { if (ringing && part) part.decline(ringing.pid); ringing = null; ringStop(); show($('mr-ring'), false); paint(); });
    on('mr-offer-no', () => { offer = null; show($('mr-offer'), false); });
    on('mr-offer-yes', () => {
      if (offer) { const name = $('mr-offer-name').value.trim() || offer.card.room; if (part && !offer.back) part.save(offer.card, name); else MR().keep(Object.assign({}, offer.card, { name })); }
      offer = null; show($('mr-offer'), false); paint();
    });
    on('mr-make-close', () => show($('mr-make'), false));
    on('mr-make-go', () => {
      if (!$('mr-make-out').hidden) { try { root.navigator.clipboard.writeText($('mr-make-link').value); } catch (e) {} $('mr-make-go').textContent = 'Copied'; return; }
      makeLink().then(() => { $('mr-make-go').textContent = 'Copy link'; }, () => {});
    });
    on('mr-bar-act', () => { if (barAct) barAct(); });
    on('mr-bar-x', () => { barShut = true; bar(''); });
    // "Invite a contact" in the meeting's Invite menu: ring a contact's room with my card for it, naming this meeting.
    const inv = $('inv-modal');
    if (inv && root.MutationObserver) new root.MutationObserver(() => {
      const acts = $('inv-actions');
      if (inv.style.display === 'none' || !acts || $('mr-inv-contact') || !MR() || !MR().contacts().length) return;
      const b = doc.createElement('button'); b.type = 'button'; b.id = 'mr-inv-contact'; b.className = 'appear-secondary'; b.textContent = 'Invite a contact';
      b.onclick = () => { inv.style.display = 'none'; openPick(); };
      acts.insertBefore(b, acts.firstChild);
    }).observe(inv, { attributes: true, attributeFilter: ['style'] });
    on('mr-pick-close', () => show($('mr-pick'), false));
    // The leave question asks for the card back too, while the other side is still here to take it.
    const ask = $('leave-ask');
    if (ask && root.MutationObserver) new root.MutationObserver(() => {
      if (ask.style.display === 'none' || !part) return;
      const st = part.state(), host = part.hostIds()[0], note = $('leave-ask-note');
      if (!note || !st.call || st.call.state !== 'answered' || !MR().mine() || !host || part.gaveTo(host)) return;
      note.hidden = false; note.innerHTML = '';
      const b = doc.createElement('button'); b.type = 'button'; b.className = 'lob-text'; b.textContent = 'Give ' + st.call.label + ' your card first';
      b.onclick = async () => { await giveBack(host, st.call.label); note.textContent = 'Card given.'; };
      note.appendChild(b);
    }).observe(ask, { attributes: true, attributeFilter: ['style'] });
  }

  // The dialogs and the bar are this part's own: made once, at start (js/dialog.js shapes them as they arrive).
  const MARKUP = `
  <div class="name-modal" role="alertdialog" aria-modal="true" id="mr-ring" aria-labelledby="mr-ring-title" style="display:none">
    <div class="name-box">
      <h3 id="mr-ring-title">Someone is calling</h3>
      <p id="mr-ring-note">They have a card to your room. Answering turns your mic on; your camera stays off.</p>
      <button id="mr-decline" type="button">Decline</button>
      <button id="mr-answer" type="button">Answer</button>
    </div>
  </div>
  <div class="name-modal" role="dialog" aria-modal="true" id="mr-offer" aria-labelledby="mr-offer-title" style="display:none">
    <div class="name-box">
      <h3 id="mr-offer-title">Save this card?</h3>
      <p id="mr-offer-note">With it you can call this room from your Contacts.</p>
      <label class="lob-pwlab" for="mr-offer-name">Name in your Contacts</label>
      <input id="mr-offer-name" maxlength="40" autocomplete="off">
      <button id="mr-offer-no" type="button">Not now</button>
      <button id="mr-offer-yes" type="button">Save</button>
    </div>
  </div>
  <div class="name-modal" role="dialog" aria-modal="true" id="mr-make" aria-labelledby="mr-make-title" style="display:none">
    <div class="name-box">
      <h3 id="mr-make-title">Give someone a card</h3>
      <p id="mr-make-note">A card lets one person call your room. Write who it is for: it is shown when they call.</p>
      <div id="mr-make-who"></div>
      <label class="lob-pwlab" for="mr-make-label">Who is it for?</label>
      <input id="mr-make-label" maxlength="40" autocomplete="off">
      <div id="mr-make-out" hidden><input id="mr-make-link" readonly aria-label="Card link"><div id="mr-make-qr" class="mr-qr"></div></div>
      <button id="mr-make-close" type="button">Close</button>
      <button id="mr-make-go" type="button">Make card</button>
    </div>
  </div>
  <div class="name-modal" role="dialog" aria-modal="true" id="mr-pick" aria-labelledby="mr-pick-title" style="display:none">
    <div class="name-box">
      <h3 id="mr-pick-title">Invite a contact</h3>
      <p>Their room rings. If they join, they come straight to this meeting; its door rules still apply.</p>
      <div id="mr-pick-list"></div>
      <button id="mr-pick-close" type="button">Close</button>
    </div>
  </div>
  <div id="mr-bar" class="mr-bar" role="status" aria-live="polite" hidden><span id="mr-bar-text"></span><button id="mr-bar-act" type="button" hidden></button><button id="mr-bar-x" type="button" class="mr-x" aria-label="Close" hidden>✕</button></div>`;
  function build() {
    if ($('mr-bar')) return;
    const box = doc.createElement('div'); box.innerHTML = MARKUP;
    while (box.firstChild) doc.body.appendChild(box.firstChild);
    // the lobby's section sits above Recent
    const sep = doc.querySelector('#lobby .lob-sep');
    if (sep && !$('lob-myroom')) { const d = doc.createElement('div'); d.id = 'lob-myroom'; d.className = 'lob-myroom'; d.hidden = true; sep.parentNode.insertBefore(d, sep); }
  }
  function start() {
    build();
    wire();
    // The lobby: a page with no room in its address.
    const here = LINKS() ? LINKS().read(root.location.pathname, '', root.location.hash) : { room: '' };
    if (!here.room) {
      const M = MR(), mine = M && M.mine();
      if (mine && M.stayOn() && !mobile()) { openRoom(mine.room, mine.v, true); return; }   // stay in my room
      paintLobby();
      root.addEventListener('storage', (e) => { if (e.key && e.key.indexOf('gifos_') === 0) paintLobby(); });
      return;
    }
    // A meeting: wait for the core's part, then paint from it.
    const look = root.setInterval(() => {
      const p = MR() && MR().live;
      if (!p) return;
      root.clearInterval(look);
      part = p; part.on(onEvent);
      root.setInterval(paint, T().MYROOM_TICK_MS);
      paint();
    }, T().MYROOM_TICK_MS || 1000);
  }
  // DEBUG=on only: a test reads the part's state and the bar's words.
  const debugOn = () => { try { const D = GifOS.debugLog; if (D && D.pageWants) return !!D.pageWants().on; } catch (e) {} try { return /(?:^|[#&?])debug=(?:on|1|true)/i.test(root.location.hash + root.location.search) || root.sessionStorage.getItem('gifos_debug') === '1'; } catch (e) { return false; } };
  try { if (debugOn()) root.__mrState = () => ({ part: part ? part.state() : null, bar: $('mr-bar') && !$('mr-bar').hidden ? $('mr-bar-text').textContent : '', ring: !!ringing, ringTitle: $('mr-ring-title') ? $('mr-ring-title').textContent : '', offer: $('mr-offer') && $('mr-offer').style.display !== 'none' ? $('mr-offer-title').textContent : '', ringTone: !!ringTimer }); } catch (e) {}
  const go = () => { try { start(); } catch (e) { root.__mrErr = String(e && e.stack || e); try { console.error('my room view: ' + root.__mrErr); } catch (x) {} } };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
})(typeof window !== 'undefined' ? window : globalThis);
