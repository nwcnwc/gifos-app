/*
 * fhop.js: the seat-side calls of friend-hop (C++: mesh_fhop.inc), the ones a seat reaches through w.f:
 * fhopFriendFor, fabricUnreachable, fabricFreeCells, and the pure fhNatMeet, fhCarrierScore and fhVideoBudget. Each reads the friend-hop tables,
 * which are the fabric's (harness/fhop.js owns them), so each takes `ctx` first: the object harness/fhop.js
 * builds ({ lv, K, seats, alive, FH, X, NETG, grpOf, fhopActive, fhConns, fhClaims, fhDc }). The harness binds
 * ctx and plugs the result into the fabric (fab.plug).
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const C_ = isNode ? require('./consts.js') : GifOS.meshConsts;
  const topo = isNode ? require('./topo.js') : GifOS.meshTopo;
  const { GT_BLOCKED, GT_SYM, FC_CELL, FC_WIFI, FC_WIRED } = C_.enums;
  const K = C_.consts;

  // C++: mesh_fhop.inc:fhNatMeet
  function fhNatMeet(a, b) { if (a === GT_BLOCKED || b === GT_BLOCKED) return false; if (a === GT_SYM && b === GT_SYM) return false; return true; }

  // C++: mesh_fhop.inc:fhCarrierScore
  // FHOP.9: one score ranks every friend a page may lean on (a media carrier, the friend called to the door): the link
  // class (wired 3, Wi-Fi or unknown 2, cellular 1; from the friend's status beat) counts 10000, packet loss per mille
  // (to 100: ten percent loss costs one class) 100 each, the round trip in ms (to 5000) one each. Higher is better.
  function fhCarrierScore(cls, lossPm, rttMs) {
    if (cls < FC_CELL || cls > FC_WIRED) cls = FC_WIFI;
    if (lossPm < 0) lossPm = 0; if (lossPm > 100) lossPm = 100; if (rttMs < 0) rttMs = 0; if (rttMs > 5000) rttMs = 5000;
    return 10000 * cls - 100 * lossPm - rttMs;
  }

  // C++: mesh_fhop.inc:fhVideoBudget
  // FHOP.9: how many carries a friend runs WITH video, by its own link class; past it a carry forwards the voice only.
  function fhVideoBudget(cls) { return cls === FC_WIRED ? K.FHOP_VIDEO_WIRED : cls === FC_CELL ? K.FHOP_VIDEO_CELL : K.FHOP_MAX_JOBS; }

  // C++: mesh_fhop.inc:fhopFriendFor
  // L18.2: would sponsorSend's friend rung carry me -> to? (an open channel of mine to a peer whose last beat named `to`
  // among its connected peers: cands[0] of the page's sponsorSend). Only while friend-hop runs.
  function fhopFriendFor(ctx, me, to) {
    if (!ctx.fhopActive() || me < 0 || to < 0 || me >= ctx.FH.length) return false;
    for (const r of ctx.fhConns(me)) if (r !== to && ctx.fhClaims(me, r, to)) return ctx.fhDc(me, r);
    return false;
  }

  // C++: mesh_fhop.inc:fabricFreeCells
  function fabricFreeCells(ctx, pc, r) {
    const C = topo.C; let free = (r < 0) ? C * C : C;
    for (let q = 0; q < ctx.seats.length; q++) {
      const t = ctx.seats[q]; if (!t || q >= ctx.alive.length || !ctx.alive[q]) continue;
      if (!t.hasCoord || t.state !== 3 || t.coord.pc !== pc) continue;   // xvOf(t): serial, the seat itself
      if (r < 0 || t.coord.r === r) free--;
    }
    return free;
  }

  // C++: mesh_fhop.inc:fabricUnreachable
  function fabricUnreachable(ctx, me, x) {
    if (!ctx.fhopActive() || me < 0 || x < 0) return false;
    if (ctx.X.fabricDialFails(me, x) < ctx.K.FH_ICE_N) return false;
    const gm = ctx.lv.NETGRP ? ctx.grpOf(me) : -1;
    const mine = (ctx.lv.NETGRP && gm >= 0) ? ctx.NETG[gm].type : -1; if (mine < 0) return false;
    if (me >= ctx.FH.length) return false;
    const n = ctx.FH[me].nat.get(x); if (n === undefined || n < 0) return false;
    return !fhNatMeet(mine, n);
  }

  const api = Object.freeze({ fhNatMeet, fhCarrierScore, fhVideoBudget, fhopFriendFor, fabricUnreachable, fabricFreeCells });
  if (isNode) module.exports = api; else GifOS.meshFhop = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
