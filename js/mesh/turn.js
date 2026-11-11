/*
 * turn.js: the pure choices of a bridge between two parts of a meeting whose networks cannot connect
 * (C++: mesh_turn.inc). A bridge is the last resort, after a direct connection and a path through a friend
 * have both failed, and it is never an ordinary mesh connection: no seat reads it.
 *   turnPick          which listed greeter a part of the meeting bridges to, if any
 *   turnClients       which end of a bridge uses the relay server (never both, unless both are blocked)
 *   turnSessionBytes  what one bridge connection may carry per tick and direction
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
  // C++: mesh_turn.inc:turnClients   (1 the opener, 2 the target, 3 both: the blocked end is the client)
  function turnClients(kindA, kindB) { const ba = kindA === GT_BLOCKED, bb = kindB === GT_BLOCKED; if (ba && bb) return 3; if (bb) return 2; return 1; }
  // C++: mesh_turn.inc:turnSessionBytes   (mode 1: a free room, audio only and clamped; mode 2: a paid room)
  function turnSessionBytes(mode, standby, greedy) {
    const want = standby ? K.TURN_KEEP_BYTES : (mode === 2 || greedy) ? K.TURN_VIDEO_BYTES : K.TURN_AUDIO_BYTES;
    if (mode === 1 && want > K.TURN_FREE_CLAMP) return K.TURN_FREE_CLAMP; return want;
  }

  const api = Object.freeze({ turnPick, turnClients, turnSessionBytes });
  if (isNode) module.exports = api; else GifOS.meshTurn = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
