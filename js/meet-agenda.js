/*
 * meet-agenda.js — the meeting's agenda. Pure, no DOM, no network.
 *
 * One agenda per meeting (Nathan 2026-11-11). Items with optional durations,
 * the current item highlighted, a gentle timekeeping bar (time left, time
 * over), the host taps Next.
 *
 * Who edits: the host in an admin room; in an open room the person who
 * shared it, who can hand editing to others (and take it back).
 *
 * The agenda travels as one whole object. Every change raises v; a page
 * keeps the highest v it has proven (a tie goes to the larger hash, so two
 * pages that changed it at once settle on the same one). The page signs each
 * version: the host's admin key in an admin room, the editor's own identity
 * key in an open room. This file only says whether a proven change is
 * allowed (accept) and does the arithmetic.
 *
 * Time: the clock of the person who pressed Next is not mine. The wire
 * carries el, how long the current item has run when the frame was sent;
 * each page turns that into its own start time (now - el - the frame's age).
 *
 * Shape:
 *   { v, owner, ed: [peer ids], items: [{ id, t, min }], cur, by }
 *     owner  who shared it (open rooms; the host's id in an admin room)
 *     ed     who else may edit (open rooms)
 *     items  t: the words (at most 120 chars), min: minutes (0 = no duration)
 *     cur    index of the current item (-1: not started)
 *     by     who made this version
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};

  const MAX_ITEMS = 40, MAX_T = 120, MAX_MIN = 600, MAX_ED = 16;

  function str(x, n) { return typeof x === 'string' ? x.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) : ''; }
  function idOk(x) { return typeof x === 'string' && x.length > 0 && x.length <= 80; }

  function empty(owner) { return { v: 0, owner: owner || null, ed: [], items: [], cur: -1, by: owner || null }; }

  // Anything off the wire, cleaned to the shape above (null: not an agenda).
  function clean(a) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
    const v = Math.floor(+a.v);
    if (!(v >= 0) || v > 1e9) return null;
    const items = [];
    const seen = new Set();
    for (const it of (Array.isArray(a.items) ? a.items : []).slice(0, MAX_ITEMS)) {
      if (!it || typeof it !== 'object') continue;
      const id = idOk(it.id) ? it.id.slice(0, 24) : null;
      const t = str(it.t, MAX_T);
      if (!id || !t || seen.has(id)) continue;
      seen.add(id);
      let min = Math.round(+it.min || 0);
      if (!(min > 0)) min = 0;
      items.push({ id, t, min: Math.min(MAX_MIN, min) });
    }
    let cur = Math.floor(+a.cur);
    if (!(cur >= -1) || cur >= items.length) cur = items.length ? Math.min(Math.max(-1, cur | 0), items.length - 1) : -1;
    if (!(cur >= -1)) cur = -1;
    const ed = (Array.isArray(a.ed) ? a.ed : []).filter(idOk).slice(0, MAX_ED);
    return { v, owner: idOk(a.owner) ? a.owner : null, ed: Array.from(new Set(ed)), items, cur, by: idOk(a.by) ? a.by : null };
  }

  // The words a signature covers: everything but the running time.
  function body(a) {
    const c = clean(a);
    if (!c) return '';
    return JSON.stringify([c.v, c.owner, c.ed, c.items.map((i) => [i.id, i.t, i.min]), c.cur, c.by]);
  }
  // A short stable hash of the body (FNV-1a, 32 bits, hex): the tie-break
  // and what the signed statement names.
  function hash(a) {
    const s = typeof a === 'string' ? a : body(a);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  // May `who` change agenda `a`?
  //   ctx = { adminRoom, isAdmin }   isAdmin: who is a proven admin
  function canEdit(a, who, ctx) {
    ctx = ctx || {};
    if (!who) return false;
    if (ctx.adminRoom) return !!ctx.isAdmin;
    if (!a || !a.owner || !(a.items || []).length) return true;  // nobody shares one now: anyone may start it
    return who === a.owner || (a.ed || []).indexOf(who) >= 0;
  }
  // Only the owner hands editing on (open rooms); the host in an admin room
  // needs no list.
  function canHand(a, who, ctx) {
    ctx = ctx || {};
    if (ctx.adminRoom) return false;
    return !!(a && who && who === a.owner);
  }

  // Should a page holding `cur` take `inc`, a version proven to be made by
  // inc.by? ctx = { adminRoom, isAdmin: inc.by is a proven admin }.
  // Returns true to take it.
  function accept(cur, inc, ctx) {
    ctx = ctx || {};
    const n = clean(inc);
    if (!n || !n.by) return false;
    if (ctx.adminRoom) {
      if (!ctx.isAdmin) return false;
    } else {
      // The editor must have had the right in the version they changed. A
      // new agenda (none held) is owned by whoever made it.
      if (!cur || !cur.owner || !cur.items.length) { if (n.owner !== n.by) return false; }
      else {
        if (!canEdit(cur, n.by, ctx)) return false;
        // Only the owner hands the agenda or the editing on.
        if (n.owner !== cur.owner && n.by !== cur.owner) return false;
        if (n.by !== cur.owner && JSON.stringify(n.ed) !== JSON.stringify(cur.ed)) return false;
      }
    }
    if (!cur) return true;
    if (n.v !== cur.v) return n.v > cur.v;
    return hash(n) > hash(cur);
  }

  // ---- editing: each returns a NEW agenda with v raised, by = who ----
  function bumpOf(a, who) { const c = clean(a) || empty(who); c.v = (c.v || 0) + 1; c.by = who || c.by; return c; }
  let idSeq = 0;
  function newId() { idSeq = (idSeq + 1) % 1e6; return Date.now().toString(36).slice(-5) + idSeq.toString(36) + Math.floor(Math.random() * 1296).toString(36); }

  function add(a, who, t, min) {
    const c = bumpOf(a, who);
    const tt = str(t, MAX_T);
    if (!tt || c.items.length >= MAX_ITEMS) return null;
    if (!c.owner || !c.items.length) { c.owner = who; if (!c.items.length) c.ed = []; c.cur = -1; }
    c.items.push({ id: newId(), t: tt, min: Math.max(0, Math.min(MAX_MIN, Math.round(+min || 0))) });
    return c;
  }
  function edit(a, who, id, t, min) {
    const c = bumpOf(a, who);
    const it = c.items.find((x) => x.id === id);
    if (!it) return null;
    const tt = str(t, MAX_T);
    if (!tt) return null;
    it.t = tt;
    it.min = Math.max(0, Math.min(MAX_MIN, Math.round(+min || 0)));
    return c;
  }
  function remove(a, who, id) {
    const c = bumpOf(a, who);
    const i = c.items.findIndex((x) => x.id === id);
    if (i < 0) return null;
    c.items.splice(i, 1);
    if (c.cur > i) c.cur--;
    else if (c.cur === i) c.cur = Math.min(c.cur, c.items.length - 1);
    if (!c.items.length) c.cur = -1;
    return c;
  }
  function move(a, who, id, dir) {
    const c = bumpOf(a, who);
    const i = c.items.findIndex((x) => x.id === id);
    const j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= c.items.length) return null;
    const t = c.items[i]; c.items[i] = c.items[j]; c.items[j] = t;
    if (c.cur === i) c.cur = j; else if (c.cur === j) c.cur = i;
    return c;
  }
  // Next / back: Next on the last item ends the agenda (cur past the end is
  // kept as the last item, done).
  function go(a, who, to) {
    const c = bumpOf(a, who);
    if (!c.items.length) return null;
    const t = Math.max(-1, Math.min(c.items.length - 1, to | 0));
    if (t === c.cur) return null;
    c.cur = t;
    return c;
  }
  // Stop sharing the agenda: no items, no tab. Anyone may start a new one.
  function clear(a, who) { const c = bumpOf(a, who); if (!c.items.length) return null; c.items = []; c.cur = -1; c.ed = []; return c; }
  function next(a, who) { return go(a, who, (clean(a) || empty()).cur + 1); }
  function prev(a, who) { return go(a, who, (clean(a) || empty()).cur - 1); }
  function hand(a, who, to, on) {
    const c = bumpOf(a, who);
    if (!idOk(to) || to === c.owner) return null;
    const has = c.ed.indexOf(to) >= 0;
    if (on && !has) { if (c.ed.length >= MAX_ED) return null; c.ed.push(to); }
    else if (!on && has) c.ed = c.ed.filter((x) => x !== to);
    else return null;
    return c;
  }

  // Timekeeping for the current item.
  //   startedAt: this page's clock when the current item began
  // Returns { item, ms, left, over, frac } or null when nothing runs.
  //   left  ms left (0 once over); over: ms past its time; frac 0..1 used
  function clock(a, startedAt, now) {
    if (!a || !(a.cur >= 0) || a.cur >= (a.items || []).length) return null;
    const it = a.items[a.cur];
    const ms = Math.max(0, (now || 0) - (startedAt || now || 0));
    if (!(it.min > 0)) return { item: it, ms, left: 0, over: 0, frac: 0, timed: false };
    const dur = it.min * 60000;
    return { item: it, ms, left: Math.max(0, dur - ms), over: Math.max(0, ms - dur), frac: Math.min(1, ms / dur), timed: true };
  }
  // 75 s -> "1:15", 3725 s -> "1:02:05".
  function mmss(ms) {
    const s = Math.max(0, Math.round((ms || 0) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    const p = (x) => (x < 10 ? '0' : '') + x;
    return h ? h + ':' + p(m) + ':' + p(ss) : m + ':' + p(ss);
  }
  function totalMin(a) { return ((a && a.items) || []).reduce((s, i) => s + (i.min || 0), 0); }

  const api = { MAX_ITEMS, MAX_T, MAX_MIN, empty, clean, body, hash, canEdit, canHand, accept, add, edit, remove, move, go, next, prev, hand, clear, clock, mmss, totalMin };
  GifOS.meetAgenda = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
