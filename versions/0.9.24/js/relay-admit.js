/*
 * relay-admit.js — the waiting-room door.
 *
 * The relay (nwcnwc/gifos, relay/src/relay.js) is a greeter registry, not a
 * media path. This is the admission law that registry runs on a knock.
 * A page loads the same file so its socket treats a `wait` the way the
 * relay means it: not seated, no roster, no media, no chat.
 *
 * Password first. A proof that does not match never enters the waiting
 * room, never sees a greeter, and never restarts the room. Restarting on
 * a bad proof was the takeover: the knocker minted itself as the founder.
 *
 * Waiting room second. With it on, a knocker who is not already seated
 * stays in `waiting` until they present an admit token. The admin mints
 * that token when they press Admit. The relay delivers it only to that
 * knocker. The knocker reconnects and presents it. One use, and only by
 * the peer it was minted for.
 *
 * Not now / deny removes them from `waiting` and does not seat them.
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};

  function createRoom() {
    return {
      founded: false,
      password: '',
      wait: false,
      greeters: new Map(),
      waiting: new Map(),
      tokens: new Map(),
      n: 0,
    };
  }

  function snapshot(room) {
    return JSON.stringify({
      founded: !!room.founded,
      password: room.password || '',
      wait: !!room.wait,
      greeters: Array.from(room.greeters.keys()).sort(),
      waiting: Array.from(room.waiting.keys()).sort(),
    });
  }

  function setPassword(room, proof) {
    room.password = String(proof || '');
    return room.password;
  }

  // Only an admin turns the waiting room on or off. A guest's call is a no-op.
  function setWait(room, on, isAdmin) {
    if (!isAdmin) return { ok: false, wait: !!room.wait };
    room.wait = !!on;
    return { ok: true, wait: room.wait };
  }

  function greetersReply(room, peer) {
    const roster = [];
    for (const id of room.greeters.keys()) if (id !== peer) roster.push(id);
    return { t: 'greeters', list: roster, founded: true, seated: true, admitted: true, roster: roster, media: true, chat: true, restarted: false };
  }

  function waitingReply(reason) {
    return { t: 'wait', seated: false, roster: [], media: false, chat: false, restarted: false, reason: reason || 'no-token' };
  }

  // A knocker's `restart` flag is ignored. Failing the password does not
  // clear `founded` or the greeter registry, and does not mint a new room.
  function knock(room, req) {
    req = req || {};
    const peer = String(req.peer || '');
    const pwOk = !room.password || req.pw === room.password;
    if (!peer || !pwOk) {
      return { t: 'locked', seated: false, roster: [], media: false, chat: false, restarted: false };
    }
    if (room.greeters.has(peer)) return greetersReply(room, peer);
    if (room.wait) {
      const tok = req.admit ? room.tokens.get(req.admit) : null;
      if (!tok || tok.used || tok.peer !== peer) {
        room.waiting.set(peer, 1);
        return waitingReply(!req.admit ? 'no-token' : !tok ? 'unknown' : tok.used ? 'used' : 'bound');
      }
      tok.used = true;
      room.waiting.delete(peer);
    }
    if (!room.founded) room.founded = true;
    room.greeters.set(peer, { gk: String(req.gk || '') });
    room.waiting.delete(peer);
    return greetersReply(room, peer);
  }

  function mintToken(room, peer) {
    room.n = (room.n || 0) + 1;
    let h = 2166136261 >>> 0;
    const s = peer + '|' + room.n + '|' + (room.password || '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    const a = (h >>> 0).toString(16).padStart(8, '0');
    const b = (Math.imul(h ^ room.n, 16777619) >>> 0).toString(16).padStart(8, '0');
    return ('adm' + a + b + String(room.n).padStart(4, '0')).slice(0, 32);
  }

  // The token is handed only to `deliverTo`. Callers must not broadcast it.
  function admit(room, peer, isAdmin) {
    peer = String(peer || '');
    if (!isAdmin || !room.waiting.has(peer)) return { ok: false };
    const tok = mintToken(room, peer);
    room.tokens.set(tok, { peer: peer, used: false });
    return { ok: true, tok: tok, deliverTo: peer };
  }

  function deny(room, peer, isAdmin) {
    peer = String(peer || '');
    if (!isAdmin) return { ok: false, seated: room.greeters.has(peer) };
    room.waiting.delete(peer);
    return { ok: true, seated: room.greeters.has(peer) };
  }

  function release(room, peer) {
    room.greeters.delete(String(peer || ''));
  }

  function rosterOf(room, asker) {
    if (room.waiting.has(asker) && !room.greeters.has(asker)) return [];
    const out = [];
    for (const id of room.greeters.keys()) if (id !== asker) out.push(id);
    return out;
  }

  function mayForward(room, from, to) {
    return room.greeters.has(from) && room.greeters.has(to);
  }

  // What a page does with a relay frame. `unseated` must not reach the
  // mesh: an empty greeter list at state 0 mints a founder.
  function clientDoor(msg, flags) {
    flags = flags || {};
    if (!msg || typeof msg !== 'object') return 'drop';
    if (msg.t === 'wait' || msg.t === 'locked' || msg.t === 'denied') return 'unseated';
    if (msg.t === 'admit-tok') return (typeof msg.tok === 'string' && /^[A-Za-z0-9_.-]{16,128}$/.test(msg.tok)) ? 'reconnect' : 'drop';
    if (msg.t === 'greeters') {
      if (flags.badPassword && flags.state !== 3) return 'unseated';
      if (flags.waitingHold && !flags.admitPresented && flags.state !== 3) return 'unseated';
      return 'seat';
    }
    return 'other';
  }

  GifOS.relayAdmit = {
    createRoom: createRoom,
    snapshot: snapshot,
    setPassword: setPassword,
    setWait: setWait,
    knock: knock,
    admit: admit,
    deny: deny,
    release: release,
    rosterOf: rosterOf,
    mayForward: mayForward,
    clientDoor: clientDoor,
  };
})(typeof window !== 'undefined' ? window : globalThis);
