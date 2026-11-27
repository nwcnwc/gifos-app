/*
 * GifOS Core: My Room's view (meet.html). Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * Paints what the My Room part (js/meet-myroom.js, GifOS.meetMyRoom.live, built by the core per meeting) says, and turns
 * a person's taps into its intents. It decides no rule: who may ring, what rings and when a ring is missed are the
 * part's. The lobby shows one link to the Rooms app (rooms.html: My personal room, our private rooms, Contacts).
 *
 *   owner   a ring sheet with a ringtone (Answer: mic on, camera off; Decline), the standby line, missed calls, and
 *           "Give a card" for the people in the meeting
 *   caller  the bar: "Waiting for Ada", "Ringing Ada", "Ada can't answer right now", and "Give Ada your card" once the
 *           call is answered (asked again in the leave question if not used)
 *   anyone  "Save this card?" when a card is handed over or a card link was opened
 *   private "Private room with <person>" on each person's tile menu and in People; the ask with Join; "Private room with…"
 *           (contacts) in the Invite menu
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
  let part = null, ringing = null, offer = null, barShut = false, pask = null;
  function openPask() {
    if (!pask) return;
    $('mr-pask-title').textContent = (pask.name || 'Someone') + ' asks you to your private room';
    $('mr-pask-note').textContent = 'Just the two of you, the same room every time. Join swaps cards if you have not yet. Your mic turns on there; your camera stays off.';
    show($('mr-pask'), true);
  }
  // "Private room with <person>" (a tile's menu, People): needs My Room on both sides (the room key is who you are).
  async function privateWith(pid, name) {
    if (!part) return;
    if (!MR().mine()) { toast('Make your personal room in Rooms first: your private rooms are tied to it.'); return; }
    barShut = false; bar('Opening a private room with ' + (name || 'them') + '…', null, '', true);
    const r = await part.privateWith(pid, name).catch(() => ({ err: 'x' }));
    if (r && r.err === 'noroom') toast((name || 'They') + ' needs a personal room first (in Rooms).');
    else if (r && r.err) toast('Could not open a private room.');
  }
  function stampPrivate() {
    if (!part || !MR().mine() || part.isPrivate()) return;
    const names = {}; for (const p of part.people()) names[p.id] = p.name || 'Guest';
    doc.querySelectorAll('.tile[data-peer]:not(.me) .modbar').forEach((mb) => {
      const pid = mb.parentNode.dataset.peer;
      if (!names[pid] || mb.querySelector('.mr-priv')) return;
      const b = doc.createElement('button'); b.type = 'button'; b.className = 'mr-priv'; b.dataset.peer = pid;
      b.textContent = 'Private room'; b.title = 'Private room with ' + names[pid]; b.setAttribute('aria-label', 'Private room with ' + names[pid]);
      b.addEventListener('click', (e) => { e.stopPropagation(); privateWith(pid, names[pid]); });
      mb.appendChild(b);
    });
  }
  function stampPeoplePrivate() {
    const list = $('who-list'); if (!list || !part || !MR().mine() || part.isPrivate() || $('mr-who-priv')) return;
    const ppl = part.people(); if (!ppl.length) return;
    const box = doc.createElement('div'); box.id = 'mr-who-priv'; box.className = 'mr-who-priv';
    const h = doc.createElement('div'); h.className = 'who-h'; h.textContent = 'Private room with…'; box.appendChild(h);
    for (const p of ppl) {
      const b = doc.createElement('button'); b.type = 'button'; b.className = 'mr-who'; b.dataset.peer = p.id; b.textContent = p.name || 'Guest';
      b.onclick = () => { $('who-modal').style.display = 'none'; privateWith(p.id, p.name); };
      box.appendChild(b);
    }
    list.insertBefore(box, list.firstChild);   // first: above the address lists
  }
  function callWords(c) {
    const n = c.label || 'them';
    if (c.invite && c.state === 'accepted') return n + ' is coming to your meeting.';
    if (c.invite && /^p-/.test(c.invite) && (c.state === 'waiting' || c.state === 'ringing')) return (c.state === 'ringing' ? 'Ringing ' : 'Calling ') + n + '…';
    if (c.invite && (c.state === 'waiting' || c.state === 'ringing')) return 'Inviting ' + n + ' to ' + c.invite.split('.')[0] + '…';
    if (c.state === 'waiting') return 'Waiting for ' + n + '. ' + n + '’s devices ring when one of them has this room open.';
    if (c.state === 'ringing') return 'Ringing ' + n + '…';
    if (c.state === 'declined') return n + ' can’t answer right now.';
    if (c.state === 'noanswer') return n + ' didn’t answer. You can keep waiting here.';
    return '';
  }
  function paint() {
    if (!part) return;
    try { stampPrivate(); } catch (e) {}
    const st = part.state();
    doc.body.classList.toggle('mr-calling', !!(st.call && st.call.state !== 'answered'));   // the "only one here" card stays away while I call
    if (st.owner) {
      if (st.rings.length) {
        const r = st.rings[0];
        if (!ringing || ringing.pid !== r.pid) {
          ringing = r;
          const where = r.to && !r.pair ? (/^p-/.test(r.to) ? 'a private room' : r.to.split('.')[0]) : '';
          $('mr-ring-title').textContent = where ? r.label + ' invites you to ' + where : r.label + ' is calling';
          $('mr-ring-note').textContent = r.pair ? 'Answer takes you both to your private room. Your mic turns on there; your camera stays off.'
            : where ? 'Join takes you there with your mic on; your camera stays off.' : 'They have a card to your room. Answering turns your mic on; your camera stays off.';
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
  // "Private room with…" (the Invite menu): pick contacts, then either a private room with them (one contact: your pair
  // room; more: a new private room) or this meeting. Each ring rides one window of its own, one contact after another
  // (gifos_mr_queue); this meeting stays as it is. A password never travels: the room's own door decides.
  const QK = 'gifos_mr_queue';
  function ringNext() {
    let q = []; try { q = JSON.parse(root.localStorage.getItem(QK) || '[]'); } catch (e) { q = []; }
    const n = q.shift(); try { root.localStorage.setItem(QK, JSON.stringify(q)); } catch (e) {}
    if (!n) return false;
    try { root.localStorage.setItem('gifos_mr_invite.' + MR().roomKey(n.room, n.v), JSON.stringify(Object.assign({}, n.inv, { at: Date.now() }))); } catch (e) {}
    return n;
  }
  function openPick() {
    const box = $('mr-pick-list'); box.innerHTML = '';
    const picked = new Set();
    for (const c of MR().contacts()) {
      const b = doc.createElement('button'); b.type = 'button'; b.className = 'mr-who'; b.textContent = c.name; b.setAttribute('aria-pressed', 'false');
      b.onclick = () => { const k = MR().roomKey(c.room, c.v); if (picked.has(k)) picked.delete(k); else picked.add(k); b.setAttribute('aria-pressed', picked.has(k) ? 'true' : 'false'); };
      box.appendChild(b);
    }
    const chosen = () => MR().contacts().filter((c) => picked.has(MR().roomKey(c.room, c.v)));
    $('mr-pick-here').onclick = () => {
      const here = LINKS().read(root.location.pathname, '', root.location.hash), list = chosen(); if (!list.length) return;
      start(list, { to: here.room + (here.v ? '.' + here.v : '') }, null);
    };
    $('mr-pick-priv').onclick = async () => {
      const list = chosen(); if (!list.length) return;
      if (!MR().mine()) { toast('Make your personal room in Rooms first: your private rooms are tied to it.'); return; }
      const pubs = list.map((c) => MR().contactPub(c)).filter(Boolean);
      // One person: your pair room with them (made at your card swap), the same room every time. Otherwise a new one.
      let rec = pubs.length === 1 ? MR().pairWith(pubs[0]) : null, fresh = false;
      if (!rec) { rec = await MR().mintPrivate(pubs, list.map((c) => c.name).join(', ')); fresh = true; }
      if (!rec) return;
      const to = rec.room + '.' + rec.v;
      start(list, { to, pv: 1, gk: fresh ? 1 : 0 }, rec);
    };
    function start(list, inv, rec) {
      try { root.localStorage.setItem(QK, JSON.stringify(list.map((c) => ({ room: c.room, v: c.v, inv })))); } catch (e) {}
      const first = ringNext();
      const w = first && root.open(roomUrl(first.room, first.v), 'mr-invite', 'popup,width=420,height=640');
      if (!w) { $('mr-pick-note').textContent = 'Allow pop-ups so the ring can open.'; return; }
      show($('mr-pick'), false);
      if (rec) {   // a private room: I go there now (its door holds everyone until they prove they are its people)
        try { root.sessionStorage.setItem('gifos_join_av', JSON.stringify({ v: 1, cam: false, mic: false, at: Date.now() })); root.sessionStorage.setItem('gifos_mr_mic', rec.room + '.' + rec.v); } catch (e) {}
        openRoom(rec.room, rec.v);
      }
    }
    $('mr-pick-note').textContent = 'Pick people. A private room is just for them; each one’s room rings and Join brings them in.';
    show($('mr-pick'), true);
  }
  async function giveBack(pid, label) { try { await part.give(pid, label); } catch (e) {} bar('Card given. ' + label + ' can call you now.', null, '', true); }
  function onEvent(ev) {
    if (ev.type === 'offer') { offer = ev; openOffer(); }
    else if (ev.type === 'missed') toast('Missed call from ' + ev.label + ', ' + timeOf(ev.at));
    else if (ev.type === 'arrived') toast(ev.label + ' is here (they have a card to this room).');
    else if (ev.type === 'renewed-mine') {}   // a renewal is silent
    else if (ev.type === 'go') {   // an invitation accepted: to that meeting, mic on (the person's own tap), camera off
      // A private room opens the mic only once everyone there has proved a member key (the part does it).
      try { root.sessionStorage.setItem('gifos_join_av', JSON.stringify({ v: 1, cam: false, mic: !ev.priv, at: Date.now() })); if (ev.priv) root.sessionStorage.setItem('gifos_mr_mic', ev.room + '.' + ev.v); } catch (e) {}
      ringStop(); openRoom(ev.room, ev.v);
      return;
    }
    else if (ev.type === 'pask') { pask = ev; openPask(); }
    else if (ev.type === 'asking') { barShut = false; bar('Asking ' + (ev.name || 'them') + ' to your private room…', null, '', true); show($('mr-pick'), false); return; }
    else if (ev.type === 'asked-no') { toast('Not now, they said.'); return; }
    else if (ev.type === 'stranger') {   // someone here cannot prove they are one of this private room's people: I leave
      try { root.sessionStorage.setItem('gifos_mr_notice', 'You left a private room: someone there was not one of its people (' + String(ev.name || 'unknown') + ').'); } catch (e) {}
      ringStop(); root.location.replace(LINKS().pageFor(root.location.pathname, 'meet')); root.location.reload();
      return;
    }
    else if (ev.type === 'call' && ev.call && ev.call.invite && /accepted|declined|noanswer/.test(ev.call.state) && root.opener) {
      setTimeout(() => { const n = ringNext(); if (n) { openRoom(n.room, n.v, true); return; } try { root.close(); } catch (e) {} }, 3 * T().MYROOM_TICK_MS);   // the inviting window was only the ring: the next contact, or it closes
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

  // ---- the lobby: one small link to the Rooms app (rooms.html), where My personal room, our private rooms and the
  // hosted rooms are kept (Nathan 11-26: Make my room was oddly placed here). Missed calls show as a count on it.
  const roomsUrl = () => root.location.pathname.replace(/[^\/]*$/, '') + 'rooms' + (/\.html$/.test(root.location.pathname) ? '.html' : '');
  function paintLobby() {
    const box = $('lob-myroom'); if (!box || !MR()) return;
    const missed = MR().missed().length;
    let h = '';
    let note = ''; try { note = root.sessionStorage.getItem('gifos_mr_notice') || ''; root.sessionStorage.removeItem('gifos_mr_notice'); } catch (e) {}
    if (note) h += '<div class="mr-missed" id="mr-notice">' + esc(note) + '</div>';
    h += '<a class="lob-text mr-rooms-link" id="mr-rooms" href="' + esc(roomsUrl()) + '">Rooms' + (missed ? ' · ' + missed + ' missed' : '') + '</a>';
    box.innerHTML = h; box.hidden = false;
  }

  function wire() {
    const on = (id, f) => { const el = $(id); if (el) el.onclick = f; };
    on('mr-answer', () => { if (ringing && part) part.answer(ringing.pid); ringing = null; ringStop(); show($('mr-ring'), false); paint(); });
    on('mr-decline', () => { if (ringing && part) part.decline(ringing.pid); ringing = null; ringStop(); show($('mr-ring'), false); paint(); });
    on('mr-offer-no', () => { offer = null; show($('mr-offer'), false); });
    on('mr-offer-yes', () => {
      if (offer) { const name = $('mr-offer-name').value.trim() || offer.card.room; if (part) part.save(offer.card, name); else MR().keep(Object.assign({}, offer.card, { name })); }
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
      const b = doc.createElement('button'); b.type = 'button'; b.id = 'mr-inv-contact'; b.className = 'appear-secondary'; b.textContent = 'Private room with…';
      b.onclick = () => { inv.style.display = 'none'; openPick(); };
      acts.insertBefore(b, acts.firstChild);
    }).observe(inv, { attributes: true, attributeFilter: ['style'] });
    on('mr-pick-close', () => show($('mr-pick'), false));
    on('mr-pask-no', () => { if (pask && part) part.privateNo(pask.pid); pask = null; show($('mr-pask'), false); });
    on('mr-pask-yes', async () => {
      const a = pask; pask = null; show($('mr-pask'), false); if (!a || !part) return;
      // Join is also the swap: a card they handed me with the ask is kept under their name.
      if (offer && offer.card) { part.save(offer.card, $('mr-offer-name').value.trim() || a.name); offer = null; show($('mr-offer'), false); }
      bar('Going to your private room with ' + a.name + '…', null, '', false);
      await part.privateJoin(a.pid, a.name).catch(() => false);
    });
    const who = $('who-modal');
    if (who && root.MutationObserver) new root.MutationObserver(() => { if (who.style.display === 'flex') { try { stampPeoplePrivate(); } catch (e) {} } })
      .observe(who, { attributes: true, attributeFilter: ['style'], childList: true, subtree: true });
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
      <h3 id="mr-pick-title">Private room with…</h3>
      <p id="mr-pick-note">Pick people. A private room is just for them; each one’s room rings and Join brings them in.</p>
      <div id="mr-pick-list"></div>
      <button id="mr-pick-close" type="button">Close</button>
      <button id="mr-pick-here" type="button">Into this meeting</button>
      <button id="mr-pick-priv" type="button">Private room</button>
    </div>
  </div>
  <div class="name-modal" role="alertdialog" aria-modal="true" id="mr-pask" aria-labelledby="mr-pask-title" style="display:none">
    <div class="name-box">
      <h3 id="mr-pask-title">Private room</h3>
      <p id="mr-pask-note"></p>
      <button id="mr-pask-no" type="button">Not now</button>
      <button id="mr-pask-yes" type="button">Join</button>
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
  try { if (debugOn()) root.__mrState = () => ({ part: part ? part.state() : null, bar: $('mr-bar') && !$('mr-bar').hidden ? $('mr-bar-text').textContent : '', ring: !!ringing, ringTitle: $('mr-ring-title') ? $('mr-ring-title').textContent : '', offer: $('mr-offer') && $('mr-offer').style.display !== 'none' ? $('mr-offer-title').textContent : '', ringTone: !!ringTimer, pask: $('mr-pask') && $('mr-pask').style.display !== 'none' ? $('mr-pask-title').textContent : '' }); } catch (e) {}
  const go = () => { try { start(); } catch (e) { root.__mrErr = String(e && e.stack || e); try { console.error('my room view: ' + root.__mrErr); } catch (x) {} } };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
})(typeof window !== 'undefined' ? window : globalThis);
