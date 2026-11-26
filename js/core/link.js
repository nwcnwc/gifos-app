/*
 * GifOS Core: the room link. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * THE ONE GRAMMAR (js/core/link.js). Every address that names a room is read and written HERE, and nowhere else (the page
 * guard link-grammar holds every other file to that). The same names everywhere: the link a person shares, the
 * meeting page's own address, history.replaceState, PiP and pop-outs, cast and embeds, app rooms, QR codes, bots.
 *
 *   room=<name>     the room. [a-z0-9-]{1,64}, case KEPT: the room name is the capability the keys derive from.
 *   v=<verifier>    the host's verifier, [a-f0-9]{16,64}, lower case. With it the room is hosted (an admin room);
 *                   without it the room is open. Name + verifier is the room's identity.
 *   code=<code>     an app room's join secret, [a-z0-9]{1,64}: with room+v the owned app room, alone the app room
 *                   anyone may own. A link without code is a meeting.
 *   cast=1          the Broadcast skin (a skin, never a security boundary). A /cast address implies it.
 *
 * The path forms are first-class input and keep their meaning forever: /meet/<room>[/<verifier>],
 * /cast/<room>[/<verifier>], /join/<code>, /join/<room>/<verifier>/<code> (first segment the room, second the
 * verifier). Any other key in the fragment (relay, at, title, agent, ...) rides along unchanged. The old page-entry
 * keys av, bc, s, j and k mean nothing and are dropped; a lone v= (no room=) names no room.
 *
 * ES5 on purpose: the channel loaders run it before the preflight has said this browser can hold a meeting.
 */
(function (root) {
  'use strict';
  var ROOM = /^[a-z0-9-]{1,64}$/i, VER = /^[a-f0-9]{16,64}$/i, CODE = /^[a-z0-9]{1,64}$/i;
  var PATH = /^\/(meet|cast|join)(?:\/([a-z0-9-]{1,64})(?:\/([a-f0-9]{16,64})(?:\/([a-z0-9]{1,64}))?)?)?\/?$/i;
  var GRAMMAR = { room: 1, v: 1, code: 1, cast: 1 };
  var OLD = { av: 1, bc: 1, s: 1, j: 1, k: 1 };

  function split(s) { s = String(s || '').replace(/^[#?]/, ''); return s ? s.split('&') : []; }
  function keyOf(p) { return p.split('=')[0]; }
  function valOf(p) { var k = keyOf(p), v = p.slice(k.length + 1); try { return decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { return v; } }

  // read(pathname, search, hash) -> { route, room, v, code, cast, bad, rest }
  //   route: 'meet' | 'cast' | 'join' for a /meet, /cast, /join address (path or fragment form), else ''.
  //   bad:   the address names a room badly (a malformed name, verifier or code, or a verifier with no room).
  //   rest:  every other key=value of the fragment, as written (plus the query on a /meet|/cast|/join address,
  //          which the router folds into the fragment).
  function read(pathname, search, hash) {
    pathname = String(pathname || '');
    var m = PATH.exec(pathname);
    var out = { route: m ? m[1].toLowerCase() : '', room: '', v: '', code: '', cast: false, bad: false, rest: [] };
    if (m) {
      out.room = m[2] || ''; out.v = (m[3] || '').toLowerCase(); out.code = m[4] || '';
      if (out.route === 'join' && out.room && !out.v) { out.code = out.room; out.room = ''; }
    }
    var fromPath = !!(m && m[2]);
    var hs = split(hash), parts = hs.concat(m ? split(search) : []);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], k = keyOf(p);
      if (!p || OLD[k]) continue;
      if (!GRAMMAR[k] || i >= hs.length) { out.rest.push(p); continue; }
      var val = valOf(p);
      if (k === 'cast') { if (val === '1') out.cast = true; continue; }
      if (fromPath) continue;   // the path names the room; a fragment cannot rename it
      if (k === 'room') { out.room = val; out.bad = out.bad || !ROOM.test(val); }
      else if (k === 'v') { out.v = val.toLowerCase(); out.bad = out.bad || !VER.test(val); }
      else { out.code = val; out.bad = out.bad || !CODE.test(val); }
    }
    if (out.route === 'cast' || /\/cast(\.html)?$/i.test(pathname)) out.cast = true;
    if (out.v && !out.room) out.bad = true;
    if (out.route === 'join' && (out.room || out.v) && !(out.room && out.v && out.code)) out.bad = true;
    if (out.bad) { out.room = ''; out.v = ''; out.code = ''; }
    return out;
  }

  // The fragment (no '#') for these fields: room, v, code, cast, then `rest` (an array of key=value, or an object).
  function hash(f) {
    f = f || {};
    var out = [];
    if (f.room) out.push('room=' + f.room);
    if (f.v) out.push('v=' + String(f.v).toLowerCase());
    if (f.code) out.push('code=' + f.code);
    if (f.cast) out.push('cast=1');
    var rest = f.rest || [];
    if (Object.prototype.toString.call(rest) !== '[object Array]') {
      var arr = [];
      for (var k in rest) if (Object.prototype.hasOwnProperty.call(rest, k) && rest[k] !== undefined && rest[k] !== null && rest[k] !== '') arr.push(k + '=' + encodeURIComponent(String(rest[k])));
      rest = arr;
    }
    for (var i = 0; i < rest.length; i++) if (rest[i] && !GRAMMAR[keyOf(rest[i])] && !OLD[keyOf(rest[i])]) out.push(rest[i]);
    return out.join('&');
  }

  // The meeting page's fragment for a /meet, /cast or /join address (what route.html, the channel loaders and the
  // core's pageUrl open as run.html#...): null when the address is not one of those or names nothing, '' when it
  // names a room badly.
  function route(pathname, search, hash_) {
    var r = read(pathname, search, hash_);
    if (!r.route) return null;
    if (r.bad) return '';
    if (!r.room && !r.code) return null;
    return hash(r);
  }

  // Whatever a person pasted or typed (a link of any form, "room", "room/verifier", "room.verifier") -> the fields,
  // or null when it names no room. base: the origin a relative link is read against.
  function parseInput(s, base) {
    s = String(s || '').trim();
    if (!s) return null;
    var r = null;
    if (/[:\/#?]/.test(s)) {
      var u = null;
      try { u = base ? new URL(s, base) : new URL(s); } catch (e) { u = null; }
      if (u) {
        r = read(u.pathname, u.search, u.hash);
        var rest = r.rest.slice();
        if (r.route) {} else { var q = split(u.search); for (var i = 0; i < q.length; i++) if (keyOf(q[i]) === 'relay') rest.push(q[i]); }
        r.rest = rest;
        if (!r.room) r = null;
      }
    }
    if (!r) {
      var m = /^([a-z0-9-]{1,64})(?:[\/.]([a-f0-9]{16,64}))?$/i.exec(s);
      if (!m) return null;
      r = { route: '', room: m[1], v: (m[2] || '').toLowerCase(), code: '', cast: false, bad: false, rest: [] };
    }
    if (r.code) return null;
    return r;
  }

  // A fragment with the Broadcast skin on (cast=1 added when missing; everything else kept as written), with its '#'.
  function withCast(h) {
    var parts = split(h);
    for (var i = 0; i < parts.length; i++) if (parts[i] === 'cast=1') return '#' + parts.join('&');
    parts.push('cast=1');
    return '#' + parts.join('&');
  }

  // One key of `rest` (its decoded value), or ''.
  function extra(fields, key) {
    var rest = (fields && fields.rest) || [];
    for (var i = 0; i < rest.length; i++) if (keyOf(rest[i]) === key) return valOf(rest[i]);
    return '';
  }

  // The room key the device's stores use: "<room>" or "<room>.<verifier>".
  function roomKey(f) { return f && f.room ? f.room + (f.v ? '.' + String(f.v).toLowerCase() : '') : ''; }

  var api = { read: read, hash: hash, route: route, withCast: withCast, parseInput: parseInput, extra: extra, roomKey: roomKey, ROOM: ROOM, VER: VER, CODE: CODE };
  // A CommonJS host (the Node core host's own realm) takes the exports and nothing else; a page or a participant's
  // context gets GifOS.link (and GifOSLink for the channel loaders, which run before anything else defines GifOS).
  if (typeof module === 'object' && module && module.exports) { module.exports = api; return; }
  if (root) { root.GifOS = root.GifOS || {}; root.GifOS.link = api; root.GifOSLink = api; }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
