/*
 * turn.js: the pure choices of a relayed connection between two parts of a meeting whose networks cannot
 * connect (C++: mesh_turn.inc). A relayed connection is the last resort, after a direct connection and a path
 * through a friend have both failed. Once it is up it is an ordinary mesh connection: the two parts become one
 * meeting. Without a subscriber's vouch it carries everything except video.
 *   turnPick          which listed greeter a part of the meeting connects to, if any
 *   turnPick52        the same choice when the door says when each part was founded: toward the oldest part, and
 *                     only if it is older than mine (the older room stays)
 *   turnClients       which end uses the relay server (never both, unless both are blocked)
 *   turnSessionBytes  what one relayed connection may carry per tick and direction
 *   turnVideoBytes    the video a vouched connection carries when the server is busy (0: paused)
 *   turnVouchOrder    which connection gets video first when subscribers vouch for fewer than there are
 *   turnTierLinks     how many video connections one subscriber of a tier vouches for
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const C_ = isNode ? require('./consts.js') : GifOS.meshConsts;
  const K = C_.consts;
  const { GT_BLOCKED } = C_.enums;

  // C++: mesh_turn.inc:turnPick   (the lowest unreachable greeter, and only if it is lower than every id of my own view; -1: none)
  function turnPick(foreign, myMin) { let g = -1; for (const x of foreign) if (x >= 0 && (g < 0 || x < g)) g = x; return (g >= 0 && g < myMin) ? g : -1; }
  // C++: mesh_ring.inc:Seat::ringOlder   (is part an, founded at aAt, older than part bn, founded at bAt? unknown or equal times: the lower id)
  function ringOlder(an, aAt, bn, bAt) { if (aAt >= 0 && bAt >= 0 && aAt !== bAt) return aAt < bAt; return an < bn; }
  // C++: mesh_turn.inc:turnPick52   (L8.52.3: the oldest unreachable part, and only if it is older than mine; epOf(g): the door's word for g, -1: none)
  function turnPick52(foreign, epOf, myMin, myAt) {
    let g = -1, ge = -1;
    // L8.52.6: a greeter the door gives no founding time for does not speak for its part's age: a dated one comes before an undated one
    for (const x of foreign) { if (x < 0) continue; const xe = epOf(x); const better = g < 0 || (((xe >= 0) !== (ge >= 0)) ? xe >= 0 : ringOlder(x, xe, g, ge)); if (better) { g = x; ge = xe; } }
    return (g >= 0 && ringOlder(g, ge, myMin, myAt)) ? g : -1;
  }
  // C++: mesh_turn.inc:turnClients   (1 the opener, 2 the target, 3 both: the blocked end is the client)
  function turnClients(kindA, kindB) { const ba = kindA === GT_BLOCKED, bb = kindB === GT_BLOCKED; if (ba && bb) return 3; if (bb) return 2; return 1; }
  // C++: mesh_turn.inc:turnSessionBytes   (what the page sends, held to the free limit when nobody vouches for the connection)
  function turnSessionBytes(vouched, standby, greedy) {
    if (standby) return K.TURN_KEEP_BYTES;
    const want = K.TURN_BASE_BYTES + ((vouched || greedy) ? K.TURN_VIDEO_BYTES : 0);
    if (!vouched && want > K.TURN_FREE_CLAMP) return K.TURN_FREE_CLAMP; return want;
  }
  // C++: mesh_turn.inc:turnVideoBytes   (everything else first, video takes the rest; below the lowest step video pauses)
  function turnVideoBytes(pct) {
    const budget = Math.trunc((K.TURN_BASE_BYTES + K.TURN_VIDEO_BYTES) * pct / 100);
    let v = budget - K.TURN_BASE_BYTES; if (v > K.TURN_VIDEO_BYTES) v = K.TURN_VIDEO_BYTES;
    return v >= K.TURN_VIDEO_MIN_BYTES ? v : 0;
  }
  // C++: mesh_turn.inc:turnVouchOrder   (does x come before y: on the stage first, then the lower seat, then the older connection)
  function turnVouchOrder(stageX, cellX, serialX, stageY, cellY, serialY) { if (stageX !== stageY) return stageX; if (cellX !== cellY) return cellX < cellY; return serialX < serialY; }
  // C++: mesh_turn.inc:turnTierLinks   (0: no such tier)
  function turnTierLinks(tier) { return tier === 'room20' ? K.TURN_VOUCH_ROOM20 : tier === 'unlimited' ? K.TURN_VOUCH_UNLIMITED : tier === 'streamer' ? K.TURN_VOUCH_STREAMER : 0; }

  const api = Object.freeze({ turnPick, turnPick52, turnClients, turnSessionBytes, turnVideoBytes, turnVouchOrder, turnTierLinks });
  if (isNode) module.exports = api; else GifOS.meshTurn = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
