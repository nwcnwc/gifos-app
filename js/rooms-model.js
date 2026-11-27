/*
 * rooms-model.js — what this device keeps, read ONE way. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * ONE MODEL for every screen that shows Meet / Rooms / Contacts: the Meeting lobby's Rooms and Contacts tabs
 * (js/core/view/myroom.js), the Rooms app (js/rooms.js) and the Home views (js/home-view.js). It decides no rule and
 * stores nothing: the records, cards and keys are My Room's (js/meet-myroom.js, GifOS.meetMyRoom, device storage only).
 *
 *   ROOMS     places that are mine: my personal room, the private rooms that are not one person (groups, an old pair
 *             room with no card), and the other rooms whose host key this device holds.
 *   CONTACTS  people: a contact IS our private room (one other person, my own member key for it), or a card to their
 *             room. A missed call belongs to the person who rang.
 *
 *   read()            { mine, ours:[{p, card}], cards:[{c, pair}], loose, hosted, missed, issued }
 *   people(m)         the contacts as one list, most recently used first:
 *                     { kind:'p'|'c', key, name, room, v, last, ok, shared, pair }
 *   missed(m, list)   the missed calls, newest first: { label, name, at, who } (who: the person to call back, or null)
 *   ring(p)           leaves the hand-off notes a call to person p needs (the meeting page reads them) and returns
 *                     { room, v } to open. A private room is entered with mic and camera off until it is answered.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const MR = () => GifOS.meetMyRoom;
  // A ring's label carries the caller-ID mark ("Bob ✓", "Bob (card)"); the person is the name before it.
  const bareName = (label) => String(label || '').replace(/\s*(✓|\(card\))\s*$/, '');

  function read() {
    const M = MR(); if (!M) return { mine: null, ours: [], cards: [], loose: [], hosted: [], missed: [], issued: [] };
    const mine = M.mine(), privs = M.privates();
    // A contact is our private room: one other person, my own member key for it (made at the swap).
    const ours = privs.filter((x) => x.pubs.length === 1 && x.me).map((p) => ({ p, card: M.cardIn(p) }));
    const viaPriv = new Set(ours.filter((x) => x.card).map((x) => M.roomKey(x.card.room, x.card.v)));   // shown with our private room
    // A card to someone's room with no private room of ours (a card link, or from before the swap made one).
    const cards = M.contacts().filter((c) => !viaPriv.has(M.roomKey(c.room, c.v))).map((c) => {
      const pub = M.contactPub(c);
      return { c, pair: pub ? M.pairWith(pub) : null };
    });
    const oursK = new Set(ours.map((x) => M.roomKey(x.p.room, x.p.v)));
    const pairedK = new Set(cards.filter((x) => x.pair).map((x) => M.roomKey(x.pair.room, x.pair.v)));
    const loose = privs.filter((p) => !oursK.has(M.roomKey(p.room, p.v)) && !pairedK.has(M.roomKey(p.room, p.v)));   // groups, an old pair room with no card
    const taken = new Set(privs.map((p) => M.roomKey(p.room, p.v)));
    if (mine) taken.add(M.roomKey(mine.room, mine.v));
    const hosted = M.hosted().filter((h) => !taken.has(M.roomKey(h.room, h.v)));
    return { mine, ours, cards, loose, hosted, missed: M.missed(), issued: M.issued().filter((x) => mine && M.roomKey(x.room, x.v) === M.roomKey(mine.room, mine.v)) };
  }

  function people(m) {
    const M = MR(); if (!M) return [];
    const list = m.ours.map((x) => ({ kind: 'p', key: M.roomKey(x.p.room, x.p.v), name: x.p.name || 'Contact', room: x.p.room, v: x.p.v, last: x.p.last || x.p.at || 0, ok: true, shared: !!x.card, pair: null }));
    for (const x of m.cards) list.push({ kind: 'c', key: M.roomKey(x.c.room, x.c.v), name: x.c.name || 'Contact', room: x.c.room, v: x.c.v, last: x.c.at || 0, ok: !!x.c.bound, shared: false, pair: x.pair });
    return list.sort((a, b) => b.last - a.last);
  }

  // Who a missed call was from, to call back: the private room it rang in, else the person by name.
  function missed(m, list) {
    const M = MR(); if (!M) return [];
    return m.missed.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).map((x) => {
      const name = bareName(x.label), pr = M.privFor(x.room, x.v), k = pr ? M.roomKey(pr.room, pr.v) : '';
      const who = (k && list.find((p) => p.kind === 'p' && p.key === k)) || list.find((p) => p.kind === 'p' && p.name === name) || list.find((p) => p.kind === 'c' && p.name === name) || null;
      return { label: x.label || '', name: name || 'Someone', at: x.at, who };
    });
  }

  function ring(p) {
    const M = MR(); if (!M || !p) return null;
    if (p.kind === 'p') {
      // I go to our private room; its door rings their devices (I prove my member key first), the Doorbell the rest.
      try { root.sessionStorage.setItem('gifos_join_av', JSON.stringify({ v: 1, cam: false, mic: false, at: Date.now() })); root.sessionStorage.setItem('gifos_mr_mic', p.room + '.' + p.v); } catch (e) {}
    } else if (p.pair) {
      // A card to their room: the call rings their personal room, naming our old pair room.
      try { root.localStorage.setItem('gifos_mr_invite.' + p.key, JSON.stringify({ to: p.pair.room + '.' + p.pair.v, go: 1, pv: 1, at: Date.now() })); } catch (e) {}
    }
    return { room: p.room, v: p.v };
  }

  GifOS.roomsModel = { read, people, missed, ring, bareName };
})(typeof window !== 'undefined' ? window : globalThis);
