/*
 * seat.js: the mesh seat (C++: mesh.cpp `struct Seat`), ported line for line from the 0.9.25 sim.
 *
 * Every data member is declared once, in seat-fields.js (generated from the C++ struct, in its order), and
 * set to its C++ default by the constructor. This file holds the constructor, the seat's clock and world,
 * the inline member functions of the C++ struct, and the four seat methods the sim defines in its fabric
 * region (emit, emitRelay, l13Mass, l14Serve). The rest of the seat's methods live in one file per C++
 * unit; each adds methods only, through Seat.unit(), never fields (so parallel units cannot collide).
 *
 * THE SEAT'S WORLD (port plan §5.1). A seat touches nothing outside itself except through its world `w`:
 *   w.TICK       the shared tick. The seat's own clock is this.TICK = w.TICK - this.clkHeld (a frozen or
 *                slow clock holds back; C++ `#define TICK (::TICK - clkHeld)`).
 *   w.lv         the sim's globals (consts.js levers): shared by every seat, set by the harness.
 *   w.f          the fabric: the calls a seat makes outside itself (FABRIC_CALLS). In C++ these are free
 *                functions; here they are w.f.<name>(args...) with the C++ arguments in the C++ order.
 *   w.trace      (ev, seat, cell, detail) the trace sink, or null (trace off: the detail is not formatted).
 *   w.L13CUR     the seat whose tick or frame runs now (C++ thread_local L13CUR); the caller sets it.
 *   w.L25ORD     the heal orders their originators signed (C++ static L25ORD; a registry all seats share).
 *
 * PORTING RULES (port plan §2 as resolved in the sim by step 3b): maps and sets are JS Map / Set (the sim's
 * OMap / OSet iterate the same way); C++ m[k] is util.ins(m, k, mk), never get(); a struct copy is
 * state.copy(v, type) or msg.clone(m) (never a shared reference); sorts are Array.prototype.sort (stable);
 * hashes are hash.js; a cell key's parts are topo.ckPc / ckR / ckI (never >>). Every function names its C++.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  const isNode = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  const req = (f, g) => (isNode ? require(f) : GifOS[g]);
  if (isNode) require('./laws.js');
  const C_ = req('./consts.js', 'meshConsts');
  const msg = req('./msg.js', 'meshMsg');
  const topo = req('./topo.js', 'meshTopo');
  const hash = req('./hash.js', 'meshHash');
  const rngM = req('./rng.js', 'meshRng');
  const fmt = req('./fmt.js', 'meshFmt');
  const state = req('./state.js', 'meshState');
  const SF = req('./seat-fields.js', 'meshSeatFields');

  // The fabric calls a seat's code makes (C++: mesh_proof_on.inc, the list the proof tapes record).
  const FABRIC_CALLS = Object.freeze([
    'fabricAdmitLog', 'fabricCallFrame', 'fabricDial', 'fabricDialFails', 'fabricDialJoin', 'fabricDialUplink',
    'fabricUpDecline', 'fabricUpTake', 'fabricDoorDrop', 'fabricDoorHanded', 'fabricDoors', 'fabricDupMint',
    'fabricFreeCells', 'fabricKickClose', 'fabricL23Busy', 'fabricLeft', 'fabricLieFor', 'fabricLinkOpen',
    'fabricLinkState', 'fabricMyDoors', 'fabricMyKnocks', 'fabricMyNat', 'fabricMyTier', 'fabricNoSock',
    'fabricNoteBackoff', 'fabricNoteReseat', 'fabricNoteRollback', 'fabricNoteSwap', 'fabricReloadBye',
    'fabricSend', 'fabricUnreachable', 'fabricVerdict', 'fhopActive', 'fhopFriendFor', 'l164Of', 'l18Deliv',
    'l18Hop', 'l18UxDeliv', 'l222Note', 'l22Agree', 'l22Close', 'l22CloseAsk', 'l22Need', 'l22Quiet', 'l28Reply',
    'l915Note', 'relayKnock', 'relayUnlist', 'descEnd', 'descNote', 'wake', 'fabricAudit',
  ]);

  // A fabric that refuses every call: the interface a harness or the page adapter fills in.
  function stubFabric() {
    const f = {};
    for (const n of FABRIC_CALLS) f[n] = () => { throw new Error('mesh fabric: ' + n + ' is not wired'); };
    return f;
  }

  function newWorld(o) {
    o = o || {};
    return { TICK: 0, lv: o.levers || C_.levers, f: o.fabric || stubFabric(), trace: o.trace || null, L13CUR: null, L25ORD: new Set() };
  }
  const WORLD = newWorld();

  class Seat {
    // C++: mesh.cpp:Seat::Seat
    constructor(i, w) {
      state.init(this);
      Object.defineProperty(this, 'w', { value: w || WORLD, enumerable: false, writable: true });
      const lv = this.w.lv;
      this.id = i;
      this.rs = rngM.seedFor(i);   // FNV-1a 32 of "p%08d" xor 0x9e3779b9
      const h = (this.rs ^ 0x9e3779b9) >>> 0;
      const z = hash.fmix32(hash.hmix(hash.H_INIT, ((i >>> 0) + 1) >>> 0)); this.myKey = (z | 1) >>> 0;
      this.linkKey = lv.ISLAND_MODE ? lv.URL_KEY : this.myKey;
      if (lv.NET_SKEW > 0) this.skew = (h >>> 3) % ((lv.NET_SKEW + 1) >>> 0);
      if (lv.CLK_OFF > 0) { const q = hash.fmix32((z ^ 0x636c6b) >>> 0); this.clkHeld = -(q % ((lv.CLK_OFF + 1) >>> 0)); }
    }

    // C++: mesh.cpp:TICK
    // The seat's own clock.
    get TICK() { return this.w.TICK - this.clkHeld; }
    // C++: mesh.cpp:Seat::now
    now() { return this.TICK; }
    // The fabric (C++ free functions fabric*, called with this seat's id where the C++ passes it).
    get f() { return this.w.f; }

    // C++: mesh.cpp:trace
    // A trace line: the detail is formatted as the C++ printf formats it, only when trace is on.
    trace(ev, seat, cell, f, ...a) { const t = this.w.trace; if (!t) return; t(ev, seat, cell, fmt.sprintf(f, ...a)); }

    // Add a unit's methods (one JS file per C++ unit). A unit adds methods only: a name that is already a
    // method or a data member is refused, so two units can never define the same thing.
    static unit(name, methods) {
      for (const k of Object.keys(methods)) {
        if (k in Seat.prototype) throw new Error('mesh seat: unit ' + name + ' redefines ' + k);
        if (FIELD_NAMES.has(k)) throw new Error('mesh seat: unit ' + name + ' defines ' + k + ', a data member');
        Object.defineProperty(Seat.prototype, k, { value: methods[k], writable: true, configurable: true });
      }
    }
  }
  const FIELD_NAMES = new Set(SF.FIELDS.map((f) => f[0]));
  // C++: mesh.cpp:Seat::LEDGER_FRESH
  // Static members (LEDGER_FRESH, L163_CONFIRM_WIN, L711_TAG, the LR_* link roles).
  for (const [k, v] of Object.entries(SF.STATICS)) Seat[k] = v;

  const api = { Seat, FABRIC_CALLS, stubFabric, newWorld, WORLD };
  GifOS.meshSeat = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
