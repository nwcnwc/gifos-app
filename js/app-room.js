/*
 * gifos.room: the session engine. An app declares the session it needs (manifest "room"); the app's owner runs this
 * engine over the room's own roster and the requests people's pages send, and writes the result as one record
 * (`__room/session`) that every copy of the app receives with the app's state. The engine has no clock, no network and
 * no storage of its own: every input is handed in, so the same inputs always give the same session.
 *
 * Rules (docs: llms.txt "Multiplayer: gifos.room"):
 *   - A seat is held only by a person on the owner's roster (heard by the room, never through app data), or, right
 *     after a session is (re)started from saved state, by a saved holder the room has not yet heard, until the room's
 *     own hold (resumeMs) runs out.
 *   - A holder the room stops hearing is "away" and keeps the seat for exactly as long as the roster keeps them; the
 *     seat frees in the same pass as the roster lets them go.
 *   - A freed seat goes to the first person in line; the turn stays with the seat.
 *   - Open room: a join takes a free seat at once. Admin room: a guest's join is an ask; an admin seats people.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { const G = (root.GifOS = root.GifOS || {}); G.appRoom = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MAX_SEATS = 16;
  const MAX_LINE = 64;
  const str = (v, n) => String(v == null ? '' : v).slice(0, n || 64);

  // The manifest's "room" block, normalised. null when the app declares no room.
  function spec(m) {
    if (!m || typeof m !== 'object') return null;
    let seats = m.seats;
    if (typeof seats === 'number') { const n = Math.max(1, Math.min(MAX_SEATS, seats | 0)); seats = []; for (let i = 1; i <= n; i++) seats.push(String(i)); }
    if (!Array.isArray(seats) || !seats.length) return null;
    seats = seats.slice(0, MAX_SEATS).map((s) => str(s, 32));
    if (new Set(seats).size !== seats.length) return null;
    const min = Number.isFinite(m.min) ? Math.max(1, Math.min(seats.length, m.min | 0)) : seats.length;
    return {
      seats, min,
      turns: m.turns === 'free' ? 'free' : 'order',
      watchers: m.watchers !== false,
      joinLate: m.joinLate !== false,
      resume: m.resume !== false,
      solo: m.solo === true,
      moves: Array.isArray(m.moves) ? m.moves.map((c) => str(c)).filter(Boolean) : [],
    };
  }

  function fresh(sp) {
    return { id: 'session', v: 1, seats: sp.seats.map((s) => ({ seat: s, k: null, nm: '', h: 'open' })), turn: 0, first: 0, round: 1, moved: false, line: [], asks: [], res: {} };
  }

  // A saved record, checked against the declared seats. Anything that does not fit starts fresh.
  function adopt(sp, saved) {
    const s = fresh(sp);
    if (!saved || typeof saved !== 'object' || !Array.isArray(saved.seats)) return s;
    for (const x of saved.seats) {
      const i = sp.seats.indexOf(x && x.seat);
      // one person, one seat: a record naming the same person twice keeps the first seat only
      if (i >= 0 && x.k && typeof x.k === 'string' && !s.seats.some((y) => y.k === x.k)) s.seats[i] = { seat: sp.seats[i], k: x.k, nm: str(x.nm, 40), h: 'away' };
    }
    if (Number.isInteger(saved.turn) && saved.turn >= 0 && saved.turn < sp.seats.length) s.turn = saved.turn;
    if (Number.isInteger(saved.first) && saved.first >= 0 && saved.first < sp.seats.length) s.first = saved.first;
    if (Number.isInteger(saved.round) && saved.round > 0) s.round = saved.round;
    s.moved = !!saved.moved;
    // The line and the asks name people who were here then; a re-share asks them again.
    return s;
  }

  const copy = (o) => JSON.parse(JSON.stringify(o));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // The engine one owner runs for one share of one app.
  //   sp       spec()
  //   saved    the saved __room/session record (or null)
  //   o.now    when this share started (ms, the owner's clock)
  //   o.resumeMs  the room's hold: how long a saved holder the room has not heard keeps the seat
  function create(sp, saved, o) {
    o = o || {};
    let s = sp.resume ? adopt(sp, saved) : fresh(sp);
    const startedAt = o.now || 0;
    const resumeMs = o.resumeMs || 0;
    const heard = new Set();   // persons this share has heard on the roster: once they go, their seat goes
    let roster = new Map();    // k -> { k, name, admin, here }
    let kind = 'open';

    const isAdmin = (k) => kind === 'admin' && !!(roster.get(k) && roster.get(k).admin);
    const seatOf = (k) => s.seats.findIndex((x) => x.k === k);
    const inLine = (k) => s.line.findIndex((x) => x.k === k);
    const asked = (k) => s.asks.findIndex((x) => x.k === k);
    const nameOf = (k) => (roster.get(k) && roster.get(k).name) || '';
    const holds = (seat, now) => {
      if (!seat.k) return false;
      if (roster.has(seat.k)) return true;
      if (heard.has(seat.k)) return false;                 // the room let them go
      return now - startedAt < resumeMs;                    // saved, not yet heard: the room's hold
    };
    function handOff() {
      for (const seat of s.seats) {
        if (seat.k) continue;
        while (s.line.length && !roster.has(s.line[0].k)) s.line.shift();
        if (!s.line.length) break;
        const p = s.line.shift();
        seat.k = p.k; seat.nm = nameOf(p.k) || p.nm; seat.h = 'here';
      }
    }
    function free(i) { s.seats[i] = { seat: s.seats[i].seat, k: null, nm: '', h: 'open' }; }
    function sync(now) {
      for (let i = 0; i < s.seats.length; i++) {
        const seat = s.seats[i];
        if (!seat.k) { seat.h = 'open'; continue; }
        if (!holds(seat, now)) { free(i); continue; }
        const r = roster.get(seat.k);
        seat.h = r ? (r.here === 'away' ? 'away' : 'here') : 'away';
        if (r && r.name) seat.nm = str(r.name, 40);
      }
      s.line = s.line.filter((x) => roster.has(x.k) && seatOf(x.k) < 0);
      s.asks = s.asks.filter((x) => roster.has(x.k) && seatOf(x.k) < 0 && inLine(x.k) < 0);
      for (const x of s.line) x.nm = nameOf(x.k) || x.nm;
      for (const x of s.asks) x.nm = nameOf(x.k) || x.nm;
      for (const k of Object.keys(s.res)) if (!roster.has(k)) delete s.res[k];
      handOff();
    }
    const solo = () => sp.solo && roster.size === 1;

    // The roster the owner's page hears: [{ k, name, admin, here: 'here' | 'away' }], and the room type.
    function tick(ros, roomKind, now) {
      roster = new Map();
      for (const r of ros || []) if (r && typeof r.k === 'string' && r.k) { roster.set(r.k, { k: r.k, name: str(r.name, 40), admin: !!r.admin, here: r.here === 'away' ? 'away' : 'here' }); heard.add(r.k); }
      kind = roomKind === 'admin' ? 'admin' : 'open';
      const before = copy(s);
      sync(now);
      return !same(before, s);
    }

    // seat in line or seat at once
    function place(k, want) {
      const named = want != null ? sp.seats.indexOf(String(want)) : -1;
      if (want != null && named < 0) return { ok: false, why: 'noSeat' };
      const lateOk = sp.joinLate || !s.moved;
      const freeIdx = named >= 0 ? (s.seats[named].k ? -1 : named) : s.seats.findIndex((x) => !x.k);
      if (freeIdx >= 0 && lateOk) {
        const li = inLine(k); if (li >= 0) s.line.splice(li, 1);
        s.seats[freeIdx] = { seat: s.seats[freeIdx].seat, k, nm: nameOf(k), h: 'here' };
        return { ok: true, seat: s.seats[freeIdx].seat };
      }
      if (!sp.watchers && freeIdx < 0) return { ok: false, why: 'full' };
      if (inLine(k) < 0 && s.line.length < MAX_LINE) s.line.push({ k, nm: nameOf(k) });
      return { ok: true, line: true };
    }

    // One request from person k, already verified (signature, roster, status). Returns { ok, why?, ... }.
    //   { op: 'join', seat? } | { op: 'leave' } | { op: 'move', collection, keep? } | { op: 'newRound', first? }
    //   | { op: 'seat', who, seat? } (admin: seat or line) | { op: 'unseat', who } | { op: 'deny', who }
    function request(k, q, now) {
      if (!roster.has(k)) return { ok: false, why: 'notHere' };
      const before = copy(s);
      const r = apply(k, q || {});
      sync(now);
      if (q && q.q != null) s.res[k] = { q: str(q.q, 24), ok: !!r.ok, why: r.why || '' };
      r.changed = !same(before, s);
      return r;
    }
    function apply(k, q) {
      const mine = seatOf(k);
      switch (q.op) {
        case 'join': {
          if (mine >= 0) return { ok: true, seat: s.seats[mine].seat };
          if (kind === 'admin' && !isAdmin(k)) {
            if (inLine(k) >= 0) return { ok: true, line: true };
            if (asked(k) < 0 && s.asks.length < MAX_LINE) s.asks.push({ k, nm: nameOf(k), seat: q.seat != null ? str(q.seat, 32) : null });
            return { ok: true, asked: true };
          }
          return place(k, q.seat);
        }
        case 'leave': {
          if (mine >= 0) free(mine);
          const li = inLine(k); if (li >= 0) s.line.splice(li, 1);
          const ai = asked(k); if (ai >= 0) s.asks.splice(ai, 1);
          return { ok: true };
        }
        case 'move': {
          if (sp.moves.indexOf(q.collection) < 0) return { ok: false, why: 'notMoves' };
          if (mine < 0) return { ok: false, why: 'watching' };
          if (sp.turns === 'order') {
            const at = s.seats[s.turn];
            if (s.turn !== mine && !(solo() && !at.k)) return { ok: false, why: 'notYourTurn', turn: at.seat, who: at.nm };
            if (!q.keep) s.turn = (s.turn + 1) % s.seats.length;
          }
          s.moved = true;
          return { ok: true };
        }
        case 'newRound': {
          if (q.collection != null && sp.moves.indexOf(q.collection) < 0) return { ok: false, why: 'notMoves' };
          if (mine < 0 && !isAdmin(k)) return { ok: false, why: 'watching' };
          const f = q.first != null ? sp.seats.indexOf(String(q.first)) : (s.first + 1) % s.seats.length;
          if (f < 0) return { ok: false, why: 'noSeat' };
          s.first = f; s.turn = f; s.round += 1; s.moved = false;
          return { ok: true };
        }
        case 'seat': case 'unseat': case 'deny': {
          if (!isAdmin(k)) return { ok: false, why: 'adminOnly' };
          const who = str(q.who);
          if (!roster.has(who)) return { ok: false, why: 'notHere' };
          const ai = asked(who); if (ai >= 0) s.asks.splice(ai, 1);
          if (q.op === 'deny') return { ok: true };
          const at = seatOf(who);
          if (q.op === 'unseat' || q.seat === null) {
            if (at >= 0) free(at);
            const li = inLine(who); if (li >= 0) s.line.splice(li, 1);
            return { ok: true };
          }
          if (at >= 0 && (q.seat == null || s.seats[at].seat === q.seat)) return { ok: true, seat: s.seats[at].seat };
          if (at >= 0) free(at);
          return place(who, q.seat);
        }
        default: return { ok: false, why: 'badOp' };
      }
    }

    return {
      tick, request,
      session: () => copy(s),
      // May person k write this record into a moves collection now? (A plain db write on a moves collection.)
      mayMove: (k, collection) => sp.moves.indexOf(collection) < 0 || (seatOf(k) >= 0 && (sp.turns === 'free' || s.turn === seatOf(k) || (solo() && !s.seats[s.turn].k))),
    };
  }

  // What one page shows its app: the owner's session, seen by person `me`, with this page's own roster for people.
  //   people: [{ k, name, admin, here, me }]
  function view(sp, sess, me, people, kind, amAdmin) {
    const s = sess && Array.isArray(sess.seats) ? sess : fresh(sp);
    const seats = s.seats.map((x) => ({ seat: x.seat, id: x.k || null, name: x.k ? x.nm || '' : '', here: x.k ? (x.h === 'away' ? 'away' : 'here') : 'open' }));
    const mine = s.seats.find((x) => x.k && x.k === me);
    const role = mine ? 'player' : (s.line || []).some((x) => x.k === me) ? 'waiting' : (s.asks || []).some((x) => x.k === me) ? 'asking' : 'watcher';
    const turn = sp.turns === 'order' && s.seats[s.turn] ? s.seats[s.turn].seat : null;
    const ppl = (people || []).map((p) => ({ id: p.k, name: p.name || '', me: !!p.me, admin: !!p.admin, here: p.here === 'away' ? 'away' : 'here' }));
    const meRow = ppl.find((p) => p.me);
    const res = s.res && s.res[me];
    return {
      on: true, kind: kind === 'admin' ? 'admin' : 'open', admin: !!amAdmin, live: ppl.filter((p) => !p.me).length > 0,
      me: { id: me, name: meRow ? meRow.name : '', seat: mine ? mine.seat : null, role },
      seats, turn,
      myTurn: !!mine && (sp.turns === 'free' || turn === mine.seat),
      round: s.round || 1,
      ready: seats.filter((x) => x.here === 'here').length >= sp.min,
      line: (s.line || []).map((x) => ({ id: x.k, name: x.nm || '' })),
      asks: amAdmin ? (s.asks || []).map((x) => ({ id: x.k, name: x.nm || '' })) : [],
      people: ppl,
      last: res ? { q: res.q, ok: res.ok, why: res.why } : null,
    };
  }

  // Words for a refusal, for the app to show.
  const WHY = {
    notHere: 'You are not in this room.', watching: 'You are watching.', notYourTurn: 'It is not your turn.',
    adminOnly: 'Only the host can do that here.', full: 'This table is full.', noSeat: 'There is no such seat.',
    notMoves: 'That is not part of the game.', badOp: 'That is not something a room can do.', pending: 'The room did not answer.',
  };

  return { spec, fresh, adopt, create, view, WHY, MAX_SEATS };
});
