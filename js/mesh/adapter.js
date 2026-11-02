/*
 * adapter.js: the seat's world on a real page.
 *
 * The seat (the mesh logic in js/mesh/) never touches a peer connection, a
 * data channel, the relay socket, a timer or the DOM. Everything it learns
 * about the world, and everything it asks the world to do, goes through this
 * adapter. The adapter reports what THIS page observed and carries out what
 * the seat asked. It never decides anything the mesh laws decide: who to
 * dial, who is gone, which cell is whose.
 *
 *   page (peer connections, data channels, media, UI)
 *     -> mesh-wire.js (relay socket, signing, the 500 ms clock, gossip)
 *       -> adapter.js (this file: one adapter per page)
 *         -> the seat
 *
 * STATUS: interface only. Nothing here is wired to a page yet, and no page
 * loads this file. Every method below throws until it is built.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};

  // My end's view of the peer connection to one peer (the seat asks by peer
  // id, never by cell).
  const LINK = Object.freeze({
    NONE: 0,     // no connection, or one closed in an orderly hand-off (not a loss)
    DIALING: 1,  // an offer is out or being answered; ICE is still checking
    OPEN: 2,     // the data channel is open
    CLOSED: 3,   // it closed or died without a goodbye: a loss the seat hears about
  });

  // Why a deliberate close happens. Sent as a goodbye frame on the data
  // channel before the close, so the far end reads it as no loss.
  const BYE = Object.freeze(['unneeded', 'door', 'handed', 'kick', 'leave', 'call']);

  const todo = (what) => () => { throw new Error('mesh adapter: ' + what + ' is not built yet'); };

  /**
   * create(opts) -> adapter
   *
   * opts (all supplied by mesh-wire.js):
   *   peer            my peer id (a string; ties break by string order)
   *   tickMs          the logical tick, 500
   *   laws            GifOS.meshLaws
   *   pc              the page's connection plumbing:
   *                     ensure(peer, {why, uplink}) start or join a dial (idempotent)
   *                     close(peer, why)            send the goodbye frame, then close my end
   *                     send(peer, frame)           data channel send; false if not open
   *                     state(peer)                 {pc, dc, heardAt} raw states
   *   relay           knock(gk, blob), unlist(), busy(peer, coolTicks)
   *   sign(frame)     -> Promise<frame>: sign my own frame (the seat marked it)
   *   measure         {tier(), nat()}: my device tier and NAT kind
   *   trace(line)     DEBUG trace sink (no-op without DEBUG)
   *
   * The adapter, once built, exposes two faces.
   */
  function create(opts) {
    void opts;
    return {
      // ---- The face the seat sees (its environment) ----------------------
      // TODO A1: TICK, advanced only by tick() below.
      TICK: 0,

      // Frames out. The seat says which frames are signed; the adapter keeps
      // one queue per peer so a frame never overtakes one sent before it,
      // signed or not.
      // TODO A1: path choice in the seat's order: early state frames only on
      // an open owned link; a held link (open or dialing, queued until open);
      // an open door; the route over owned links; the seeker's gateway; else
      // drop and let the seat retry.
      send: todo('send'),

      // My end's state with one peer: a LINK value.
      // TODO A1: from data-channel and connection events only; an orderly
      // goodbye reads NONE, an unexplained close reads CLOSED.
      linkState: todo('linkState'),

      // Dials. Gates in this order: a peer on a network I cannot reach counts
      // as a failed dial; a peer the seat holds as lost is not dialled
      // (L17); the pc budget may first close my oldest pc without a reason
      // (L23). dialJoin also joins a dial the far end started.
      dial: todo('dial'),
      dialJoin: todo('dialJoin'),
      // TODO A2: an uplink offer carries the uplink mark; the far page counts
      // its held connections and may answer with a decline and referrals
      // (L14.1). The answer reaches the seat as a frame, a tick or more later.
      dialUplink: todo('dialUplink'),
      // A frame over a connection dialled for it: a contest question (L25),
      // an audit (L27.9).
      callFrame: todo('callFrame'),
      audit: todo('audit'),

      // Failed dials are the seat's own record; the adapter only reports
      // them (a dial that reached `failed`, or never opened within the dial
      // window, or was declined).
      // TODO A1: friend-hop typing: enough failed dials and two known NAT
      // kinds that cannot meet.
      unreachable: todo('unreachable'),

      // Doors (connections dialled while one end was outside the room).
      // TODO A2: each end decides from its own state plus frames.
      doors: () => true,
      myDoors: todo('myDoors'),
      myKnocks: todo('myKnocks'),
      doorDrop: todo('doorDrop'),
      doorHanded: todo('doorHanded'),
      // L33.11: nothing to do at send; the relay's no-socket bounce comes
      // back as a refusal frame for the seat (see relayFrame below).
      noSock: () => {},

      // A seat voted off (L27): my channel to it closes with a goodbye.
      kickClose: todo('kickClose'),

      // My identity proof for a seat reclaim (L3.10), from my signing key.
      token: todo('token'),
      // Measured once at join: device tier (L4.1) and NAT kind (L4.6).
      myTier: todo('myTier'),
      myNat: todo('myNat'),

      // Leaving: goodbyes first, then the channels and the socket.
      left: todo('left'),
      reloadBye: todo('reloadBye'),

      // The relay: knock (with my greeter address while I hold a Section-1
      // seat, else a plain ask for the list) and unlist at once when I leave
      // Section 1 (L16.4).
      knock: todo('knock'),
      unlist: todo('unlist'),

      // "Tick me next tick." The seat runs only on ticks where it woke itself
      // or a frame reached it.
      wake: todo('wake'),
      trace: todo('trace'),

      // ---- The face the page sees ----------------------------------------
      // One logical tick: deliver every frame and event that arrived since
      // the last tick, in arrival order; then run the seat if it is awake;
      // then flush the outbound queues.
      tick: todo('tick'),
      // A verified mesh frame off a data channel (direct) or a forward.
      frame: todo('frame'),
      // A relay frame: the greeter list, a no-socket bounce for a greeter I
      // am asking, a door refusal.
      relayFrame: todo('relayFrame'),
      // A transport event from the page's watchdogs and channel callbacks:
      // open, goodbye, close, failed-persist, disconnected-persist, starve,
      // relay-leave. Hard: an unexplained close; quiet: the rest. One loss
      // per peer per debounce window.
      transport: todo('transport'),
      // A media or app use of a connection the seat does not name (L28): the
      // pc stays while the page uses it.
      keep: todo('keep'),
      // A long gap in the clock (a frozen tab, a sleeping phone).
      absence: todo('absence'),
    };
  }

  GifOS.meshAdapter = Object.freeze({ LINK, BYE, create });
})(typeof window !== 'undefined' ? window : globalThis);
