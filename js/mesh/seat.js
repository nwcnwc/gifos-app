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
 * OUT-PARAMETERS. A C++ function that returns bool and fills out-parameters returns the out value (or an
 * object of them) here, and null for false (ownerCoord, bornOf, l165Have, arbCellOf ...). A fabric call with
 * out-parameters returns its arguments as they stand after the call (the proof tape's "o" array).
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
    'fabricFreeCells', 'fabricKickClose', 'fabricL23Busy', 'fabricLeft', 'fabricLieFor', 'fabricLinkOpen', 'fabricOpenPeers',
    'fabricLinkState', 'fabricMyDoors', 'fabricMyKnocks', 'fabricMyNat', 'fabricMyTier', 'fabricNoSock',
    'fabricNoteBackoff', 'fabricNoteReseat', 'fabricNoteRollback', 'fabricNoteSwap', 'fabricReloadBye',
    'fabricSend', 'fabricUnreachable', 'fabricVerdict', 'fhopActive', 'fhopFriendFor', 'l164Of', 'l18Deliv',
    'l18Hop', 'l18UxDeliv', 'l222Note', 'l22Agree', 'l22Close', 'l22CloseAsk', 'l22Need', 'l22Quiet', 'l28Reply',
    'l915Note', 'relayKnock', 'relayUnlist', 'descEnd', 'descNote', 'wake', 'fabricAudit', 'fabricDoorHeard', 'g4Joined', 'fabricDropHalf', 'fabricLinkCarries',
    'fabricTurnOn', 'fabricTurnPc', 'fabricTurnStray', 'fabricTurnLone', 'fabricTurnAcross', 'fabricTurnMine', 'fabricTurnCarried', 'fabricTurnFeeds', 'fabricTurnBoth', 'fabricTurnPeerIn',   /* TURN.14 (mesh_turn.inc) */
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
      const z = hash.fmix32(hash.hmixId(hash.H_INIT, i + 1)); this.myKey = (z | 1) >>> 0;
      this.linkKey = (lv.ISLAND_MODE || lv.LINKKEY_ALL || LINKKEY_ENV) ? lv.URL_KEY : this.myKey;   // C++: linkkeyOn()
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

  // ---- free functions of mesh.cpp the seat code calls -------------------------------------------------------
  const K = C_.consts, E = C_.enums;
  const { ckey, ckPc, ckR, ckI, unckey, ownedLinks, rowMates, colMates, down, up, childPath, pcDepth } = topo;
  const C = topo.C;
  // MESH_LINKKEY=1 under node is the sim's linkkeyEnv(): every page holds the meeting key for a whole run
  const LINKKEY_ENV = (isNode && typeof process !== 'undefined' && process.env && parseInt(process.env.MESH_LINKKEY, 10)) ? 1 : 0;
  // the sim's #define L8_50_OFF in mesh.cpp (a build-time switch): MESH_L8_50_OFF=1 under node, read once at load; a page always runs the law
  const L8_50_OFF = (isNode && typeof process !== 'undefined' && process.env && process.env.MESH_L8_50_OFF === '1') ? 1 : 0;
  // the sim's #define L8_52_OFF in mesh.cpp (a build-time switch): MESH_L8_52_OFF=1 under node, read once at load; a page always runs the law
  const L8_52_OFF = (isNode && typeof process !== 'undefined' && process.env && process.env.MESH_L8_52_OFF === '1') ? 1 : 0;
  const { ins, eraseFirst } = req('./util.js', 'meshUtil');
  const dig = req('./dig.js', 'meshDig');

  // Free functions a later unit supplies (C++ free functions defined in a unit file, e.g. islandStandM in
  // mesh_ring.inc): Seat.free({name: fn}) registers them; FREE.name(...) calls them.
  const FREE = {};
  // C++: mesh.cpp:placeBefore
  // a's claim is the earlier one
  function placeBefore(a, aBorn, b, bBorn) { const d = bBorn - aBorn; return d > K.L167_W || (d >= -K.L167_W && a < b); }
  // C++: mesh.cpp:l13Frame
  function l13Frame(m) { return m.t === 'MEET' || m.t === 'MEETACK' || m.t === 'WALK' || m.t === 'FINDLEAF' || m.t === 'YIELD' || (m.t === 'LEAVE' && m.mv) || ((m.t === 'WHOHOME' || m.t === 'HOME') && m.knock); }
  // C++: mesh.cpp:signedBy
  function signedBy(m, who) { return who >= 0 && m.sig && m.id === who; }
  // C++: mesh.cpp:DEATH_WHY
  const DEATH_WHY = Object.freeze(['ack-horizon', 'child-silent', 'drain-sweep', 'head-early', 'owner-early', 'ring-dead', 'ring-dead-left', 'tlsweep', 'phantomclr', 'phantomclr-deep', 'sit-ttl-ghost', 'vac-word']);
  // C++: mesh.cpp:deathWhy
  function deathWhy(why) { return DEATH_WHY.includes(why); }
  // C++: mesh_ring.inc:islandStand
  function islandStand(s, law) { return FREE.islandStandM(!!s && (law === E.IS_L164 ? s.l1612Keep() : s.mergeCalc()), law, s ? s.w.lv : WORLD.lv); }
  // C++: mesh_roomterm.inc:roomTerm
  function roomTerm(s, v) { void v; return !!s && s.islandSeen(); }
  // C++: mesh.cpp:l13MergingOf
  function l13MergingOf(s) { return islandStand(s, E.IS_L13); }
  // C++: mesh.cpp:l13MassOf
  function l13MassOf(s) { return s.l13Mass(); }
  // C++: mesh.cpp:l25OrdKey
  function l25OrdKey(by, hole, at, to) { return hash.hmixId(hash.hmix(hash.hmixId(hash.hmix64(hash.H_INIT, hole), by), at >>> 0), to); }   // the order names the seat it was sent to
  // C++: mesh.cpp:Seat::ppSigOf
  function ppSigOf(from, at) { return hash.idPair(from, at >>> 0); }   // IdP{signer, tick}
  // C++: mesh.cpp:Seat::ppKey
  // a 32-bit hash of (cell, seat)
  function ppKey(k, x) { return hash.hmix64(hash.hmixId(hash.H_INIT, x), k); }
  // C++: mesh.cpp:Seat::l165Earlier
  function l165Earlier(at1, from1, id1, at2, from2, id2) { if (at1 - at2 > K.PLACE_W || at2 - at1 > K.PLACE_W) return at1 < at2; if (from1 !== from2) return from1 < from2; return id1 < id2; }
  const coordOf = (k) => unckey(k);
  const newMsg = (t) => msg.newMsg(t);
  const LS_NONE = E.LS_NONE, LS_DIALING = E.LS_DIALING, LS_OPEN = E.LS_OPEN;

  // ---- the inline member functions of struct Seat, in struct order ------------------------------------------
  // A C++ function that returns bool and fills out-parameters returns the out value here (null for false).
  Seat.unit('mesh.cpp struct Seat', {
    // C++: mesh.cpp:l13
    l13(sub) { const cur = this.w.L13CUR; return !l13MergingOf(cur) && (!cur || sub === 'L13.12' || sub === 'L13.6' || sub === 'L13.20' || l13MassOf(cur)); },
    // C++: mesh.cpp:l13On
    l13On() { return !l13MergingOf(this.w.L13CUR); },
    // C++: mesh.cpp:Seat::oneRowRoom
    oneRowRoom() { for (const k of this.occ.keys()) if (k >= 256 && this.firstHandLive(k)) return false; return true; },
    // C++: mesh.cpp:Seat::nothingBelow
    nothingBelow(k) {
      const pc = ckPc(k), r = ckR(k), i = ckI(k);
      for (const ek of this.occ.keys()) { if (ckPc(ek) !== 0) return false; if (pc === 0 && ckI(ek) === i && ckR(ek) > r && this.firstHandLive(ek)) return false; }
      return true;
    },
    // C++: mesh.cpp:Seat::ledgerNamed
    ledgerNamed(k) { const it = this.ledgerSeen.get(k); return it !== undefined && this.TICK - it <= Seat.LEDGER_FRESH && this.occ.has(k); },
    // C++: mesh.cpp:Seat::leased
    leased(k) {
      if (!this.occ.has(k)) return false; const it = this.live.get(k); if (it === undefined) return false;
      let since = it; if (this.backAt >= 0 && since < this.backAt) since = this.backAt;
      return this.TICK - since > K.LEASE_ARM && this.TICK - since <= K.LEASE_T;
    },
    // C++: mesh.cpp:Seat::l30Small
    l30Small() { return this.l30; },
    // C++: mesh.cpp:Seat::l31On
    l31On() { return this.l30; },
    // C++: mesh.cpp:Seat::l25Bad
    l25Bad(x) { if (x < 0) return false; const it = this.l25BadPlacer.get(x); return it !== undefined && this.TICK < it[0]; },
    // C++: mesh.cpp:Seat::l25Mark
    l25Mark(x, bare = false) {
      if (x < 0) return; if (this.l25BadPlacer.size >= 64) this.l25BadPlacer.clear();
      const b = ins(this.l25BadPlacer, x, () => [0, 0]);
      if (b[0] >= 0 && this.TICK - b[0] > 4 * K.L25_COOL_MAX) b[1] = 0; b[1]++;
      const cool = bare ? K.L25_COOL_MAX : Math.min(K.L25_COOL_MAX, K.L25_COOL0 * 2 ** Math.min(b[1] - 1, 10));
      b[0] = this.TICK + cool;
    },
    // C++: mesh.cpp:Seat::courtHeld
    courtHeld(k) {
      if (this.courtIgnore || this.occ.has(k) || this.softSitting(k)) return false;
      const it = this.memo.get(k); if (it === undefined || this.TICK - it.at > K.LEASE_T || it.id === this.courtNc) return false;
      if (!this.courtSkipped) this.trace('COURTESY', this.id, this.hasCoord ? this.coord : null, 'cell=%llx last=%d nc=%d', k, it.id, this.courtNc);
      this.courtSkipped = true; return true;
    },
    // C++: mesh.cpp:Seat::kStmt
    kStmt() {
      const k = msg.newKStmt(); k.voter = this.id; k.signer = this.id; k.good = true; k.ver = this.kver; k.ck = this.hasCoord ? ckey(this.coord) : 0; k.tn = this.tn; k.all = this.kall;
      if (!this.kall) { for (const t of this.kyes) if (t !== this.id) k.yes.push(t); for (const t of this.kabsT) if (t !== this.id) k.abs.push(t); }
      return k;
    },
    // C++: mesh.cpp:Seat::kAddOwn
    kAddOwn(d, k) { for (const t of k.yes) if (t !== k.voter) dig.kickAdd(d.kick, [{ tgt: t, up: 1, dn: 0 }], -1); for (const t of k.abs) if (t !== k.voter) dig.kickAdd(d.kick, [{ tgt: t, up: 0, dn: 1 }], -1); if (k.all) d.kabs += 1; },
    // C++: mesh.cpp:Seat::kUpLink
    kUpLink(t) {
      if (!this.hasCoord || this.coord.pc === 0 || t < 0) return false;
      const o = this.ownerCoord(); if (o && this.occGet(ckey(o)) === t) return true;
      if (this.coord.i === 0) return false;
      if (this.occGet(ckey({ pc: this.coord.pc, r: this.coord.r, i: 0 })) === t) return true;
      for (let j = 1; j < C; j++) if (j !== this.coord.i && this.occGet(ckey({ pc: this.coord.pc, r: this.coord.r, i: j })) === t) return true;
      return false;
    },
    // C++: mesh.cpp:Seat::kConfirmed
    kConfirmed(t) { const it = this.kConfAt.get(t); return it !== undefined && this.TICK - it <= K.DIG_TTL; },
    // C++: mesh.cpp:Seat::kBanned
    kBanned(x) { return x >= 0 && x !== this.id && !this.kIgnore && this.vban.size > 0 && this.vban.has(x); },
    // C++: mesh.cpp:Seat::kDropIn
    kDropIn(m) {
      if (!this.vban.size || this.kIgnore) return false;
      if (this.kBanned(m.id) || this.kBanned(m.from) || this.kBanned(m.lk)) return true;
      if ((m.t === 'FIND' || m.t === 'PLACE' || m.t === 'FINDACK' || m.t === 'NOROOM' || m.t === 'YIELD') && this.kBanned(m.nc)) return true;
      if (m.routing && this.kBanned(m.rfinal)) return true;
      return false;
    },
    // C++: mesh.cpp:Seat::talkEntered
    talkEntered() { return this.talkSince >= 0 && (this.talkOffAt < 0 ? this.TICK - this.talkSince >= K.TALK_ON : this.talkOffAt - this.talkSince >= K.TALK_ON); },
    // C++: mesh.cpp:Seat::ownStage
    ownStage() { return !!this.pinT || (this.talkSince >= 0 && (this.talkOffAt < 0 || (this.talkEntered() && this.TICK - this.talkOffAt <= K.TALK_HOLD))); },
    // C++: mesh.cpp:Seat::talkEntry
    // the LE, or null
    talkEntry() {
      if (this.pinT) return { id: this.id, k: this.pinT, f: 1 };
      if (!this.talkEntered()) return null;
      if (this.talkOffAt < 0) return { id: this.id, k: this.talkSince, f: 2 };
      if (this.TICK - this.talkOffAt <= K.TALK_HOLD) return { id: this.id, k: this.talkOffAt, f: 4 };
      return null;
    },
    // C++: mesh.cpp:Seat::talkSet
    talkSet(on) {
      if (on) {
        if (this.talkSince >= 0 && this.talkOffAt >= 0 && this.talkEntered() && this.TICK - this.talkOffAt <= K.TALK_HOLD) this.talkOffAt = -1;
        else if (this.talkOffAt >= 0 || this.talkSince < 0) { this.talkSince = this.TICK; this.talkOffAt = -1; }
      } else if (this.talkSince >= 0 && this.talkOffAt < 0) this.talkOffAt = this.TICK;
    },
    // C++: mesh.cpp:Seat::talkExpire
    talkExpire() { if (this.talkSince >= 0 && this.talkOffAt >= 0 && (!this.talkEntered() || this.TICK - this.talkOffAt > K.TALK_HOLD)) { this.talkSince = -1; this.talkOffAt = -1; } },
    // C++: mesh.cpp:Seat::dRoot
    dRoot() { return this.rootDig; },
    // C++: mesh.cpp:Seat::l10Mark
    l10Mark() { if (!this.l10DirtyUp) { this.l10DirtyUp = true; this.l10DirtyAt = this.TICK; } },
    // C++: mesh.cpp:Seat::l10Refill
    l10Refill() { this.l10Own.refill(this.TICK, K.L10_BUCKET_BURST, 1, K.L10_BUCKET_REFILL); },
    // C++: mesh.cpp:Seat::l10Carried
    l10Carried() { if (this.l10DirtyUp) { const lat = this.TICK - this.l10DirtyAt; if (lat <= 0) this.stLead++; else this.stTrail++; this.stLatSum += lat; if (lat > this.stLatMax) this.stLatMax = lat; this.l10DirtyUp = false; } },
    // C++: mesh.cpp:Seat::l10Spend
    l10Spend() { this.l10Refill(); this.l10Own.tok = this.l10Own.tok >= 1 ? this.l10Own.tok - 1 : 0; },
    // C++: mesh.cpp:Seat::l10Dirty
    l10Dirty(was, now) { if (!was) { if (!this.l10NewAt) this.l10NewAt = this.TICK + 1; } else if (dig.digSig(was) !== dig.digSig(now)) this.l10Mark(); },
    // C++: mesh.cpp:Seat::LT
    LT() { return this.TICK + this.skew; },
    // C++: mesh.cpp:Seat::wireDig
    wireDig(d) { const o = dig.cloneDig(d); const st = d.rx >= 0 ? d.rx : d.at; o.ag = st >= 0 ? Math.max(0, this.LT() - st) : 0; o.rx = -1; return o; },
    // C++: mesh.cpp:Seat::rxDig
    rxDig(d) { if (this.w.lv.DIG_ABS) { d.rx = d.at; return; } const a = d.ag < 0 ? 0 : (d.ag > (1 << 20) ? (1 << 20) : d.ag); d.rx = this.LT() - a; },
    // C++: mesh.cpp:Seat::rng
    rng() {
      const s = this.rs = (this.rs + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    // C++: mesh.cpp:Seat::shuf
    shuf(a) { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(this.rng() * (k + 1)); const tmp = a[k]; a[k] = a[j]; a[j] = tmp; } },
    // C++: mesh.cpp:Seat::occGet
    occGet(k) { const it = this.occ.get(k); return it === undefined ? -1 : it; },
    // C++: mesh.cpp:Seat::occDrop
    // (the L13DBG / MESH_CELLLOG debug prints of the C++ are left out: they write only under those env switches)
    occDrop(k, why) {
      if (this.occ.has(k)) this.f.fabricVerdict(this.id, k, this.occGet(k), why);
      if (this.occ.has(k) && deathWhy(why)) { if (this.hasCoord && this.coord.pc === 0 && ckPc(k) === 0 && this.occGet(k) >= 0) this.digGone.set(k, [this.occGet(k), this.TICK]); this.digForget(k); if (this.hasCoord && this.coord.pc === 0) this.rootFold(true); }
      if (this.occ.has(k) && (deathWhy(why) || why === 'leave' || why === 'goodbye' || why === 'mate-unreach') && this.hasCoord && this.coord.pc === 0 && this.coord.i === 0 && ckPc(k) === 0 && ckR(k) === this.coord.r && ckI(k) !== 0) { const x = this.occGet(k); if (x >= 0 && x !== this.id) { if (this.vacOut.size >= C * C) this.vacOut.delete(this.vacOut.keys().next().value); this.vacOut.set(k, [x, this.TICK]); } }   // D5.2 (headword.js): a death verdict on a cell of my row is told to my row
      if (this.occ.has(k) && deathWhy(why) && ckPc(k) === 0) this.trace('OCC-DEATH', this.id, unckey(k), 'gone=%d why=%s', this.occGet(k), why);   // forensics: a Section-1 occupant read dead, by whom and why
      if (this.occ.has(k) && deathWhy(why)) { const x = this.occGet(k); if (x >= 0 && x !== this.id) this.memo.set(k, { id: x, tok: this.pinned.has(x) ? ins(this.pinned, x, () => 0) : 0, at: this.TICK }); }
      if (this.occ.has(k) && deathWhy(why)) { const kf = this.kidful.get(k); if (kf !== undefined && kf) { this.kidMemo.set(k, this.TICK); if (this.kidMemo.size > 64) eraseFirst(this.kidMemo); } }
      if ((why === 'hint-move' || why === 'moved-by-gossip' || why === 'moved-confirmed') && this.hasCoord && this.coord.pc === 0 && ckPc(k) === 0) { const st = this.s1tab.get(k); if (st !== undefined && st.by >= 0 && st.by === this.occGet(k)) this.digForget(k); }   // the occupant moved to another cell: its report here is not a second person
      this.occ.delete(k);
    },
    // C++: mesh.cpp:Seat::tlForget
    tlForget(k) { this.translost.delete(k); this.tlProbeAt.delete(k); this.probeAck.delete(k); this.tlHard.delete(k); this.tlSent.delete(k); },
    // C++: mesh.cpp:Seat::tlClear
    tlClear() { this.translost.clear(); this.tlProbeAt.clear(); this.probeAck.clear(); this.tlSent.clear(); },
    // C++: mesh.cpp:Seat::absence
    absence(n) {
      if (n <= 0) return;
      if (n >= K.L30_SILENT && this.hasCoord && this.state === 3) { this.rmBornAt = this.TICK; this.tn = ++this.w.lv.TN_SEQ; }   // L30.5.1: back from a gap of L30_SILENT or more, a new tenancy at the cell I still hold (as take() does): my claim is as old as my thaw
      { if (this.l30) { this.l30 = false; this.l30At = this.TICK; this.l30Flips++; } this.l30Since = -1; }
      for (const [k, v] of this.live) this.live.set(k, v - n);
      for (const [k, v] of this.s1seen) this.s1seen.set(k, v - n);
      for (const [k, v] of this.s1told) this.s1told.set(k, v - n);
      for (const v of this.pongBy.values()) v[1] -= n;
      this.rookSeenAt -= n;
      if (this.nbrAt !== -1) { this.nbrAt -= n; if (this.nbrAt === -1) this.nbrAt = -2; }
      for (const [k, v] of this.healTry) this.healTry.set(k, v - n);
      this.backAt = this.TICK;
      if (this.hasCoord && this.state === 3) {
        for (const c of ownedLinks(this.coord)) { const x = this.occGet(ckey(c)); if (x >= 0 && x !== this.id) { const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = this.id; this.emit(x, h); } }
      }
    },
    // C++: mesh.cpp:Seat::setOcc
    setOcc(k, v) {
      if (!this.bareSetting && this.bareAt.size) this.bareAt.delete(k);
      if (v === this.id && (!this.hasCoord || k !== ckey(this.coord))) return;
      if (this.vban.size && this.kBanned(v)) return;
      if (v >= 0 && v !== this.id && this.noChan.has(v) && this.hasCoord && this.ownedLinkCell(k)) { this.darkHold.set(k, v); return; }
      this.darkHold.delete(k);
      const it = this.occ.get(k); if (it !== undefined && it >= 0 && it !== v && it !== this.id) this.gaNoteOver(k, it);   // L41.2: the seat a claim displaced in my view (gapa.js)
      if (it === undefined || it !== v) { this.tlForget(k); this.born.set(k, this.LT()); this.pairAt.set(k, this.TICK); }
      this.occ.set(k, v);
    },
    // C++: mesh.cpp:Seat::noteS1
    noteS1(ck) { if (ckPc(ck) === 0) { this.s1seen.set(ck, this.TICK); this.s1told.delete(ck); } },
    // C++: mesh.cpp:Seat::s1Told
    s1Told(ck) { const t = this.s1told.get(ck); if (t === undefined) return false; const it = this.s1seen.get(ck); return it !== undefined && it === t; },
    // C++: mesh.cpp:Seat::s1Fresh
    s1Fresh(ck) { const it = this.s1seen.get(ck); return it !== undefined && this.TICK - it < 120 && this.occ.has(ck); },
    // C++: mesh.cpp:Seat::heardAny
    // L3.4.1: "unheard on every path": the lease counts from the later of the last frame and the last answered probe
    heardAny(k, since) { const pa = this.probeAck.get(k); return (pa !== undefined && pa > since) ? pa : since; },
    // C++: mesh.cpp:Seat::firstHandLive
    firstHandLive(ck) { const it = this.live.get(ck); return it !== undefined && this.TICK - it <= 60; },
    // C++: mesh.cpp:Seat::darkMate
    darkMate(k) { if (this.hasCoord && ckey(this.coord) === k) return false; if (this.translost.has(k)) return true; const it = this.live.get(k); return it !== undefined && this.TICK - it > 16; },
    // C++: mesh.cpp:Seat::noteBye
    noteBye(x) {
      if (x < 0 || x === this.id) return;
      if (this.byeIds.size >= 256) { for (const [k, v] of this.byeIds) if (this.TICK - v > K.DIG_LOSS_H) this.byeIds.delete(k); if (this.byeIds.size >= 256) eraseFirst(this.byeIds); }
      this.byeIds.set(x, this.TICK);
    },
    // C++: mesh.cpp:Seat::liveMark
    liveMark(k) {
      const it = this.occ.get(k), pt = this.live.get(k);
      if (it === undefined) this.heardSince.delete(k);
      else { const lb = this.liveBy.get(k); if (lb === undefined || lb !== it || pt === undefined || this.TICK - pt > 60) this.heardSince.set(k, this.TICK); }
      this.live.set(k, this.TICK); this.holeSince.delete(k); this.byeAt.delete(k); this.fhEver.add(k);
      if (it === undefined) this.liveBy.delete(k); else this.liveBy.set(k, it);
    },
    // C++: mesh.cpp:Seat::authClear
    authClear() {
      this.waitClaim.clear(); this.liveBy.clear(); this.linkedBy.clear(); this.pairAt.clear(); this.tenOf.clear(); this.pongBy.clear(); this.heardSince.clear(); this.linkedSince.clear(); this.wasAt.clear(); this.carrySince.clear();
      this.rivalId = -1; this.movedClaimId = -1; this.pendYBy = -1; this.challToId = -1; this.lateY.clear(); this.ppNotes.clear(); this.oldPP.clear(); this.gbProbe.clear(); this.upAck.clear(); this.upExpired.clear(); this.upUsed.clear(); this.upOpen.clear();
      this.pp = -1; this.ppAt = -1; this.ppCk = 0; this.oldPp = -1; this.placer = -1; this.oldPlacer = -1;
    },
    // C++: mesh.cpp:Seat::heardAt
    // Two C++ overloads: heardAt(k, x) -> bool (did I hear x at k, first hand or by its PONG), and
    // heardAt(k) -> the occupant of k when I hear it first hand or our link is open, else -1.
    heardAt(k, x) {
      if (arguments.length === 1) { const o = this.occGet(k); if (o < 0) return -1; if (this.firstHandLive(k) || this.f.fabricLinkState(this.id, o) === LS_OPEN) return o; return -1; }
      if (x < 0 || this.translost.has(k)) return false;
      if (this.firstHandLive(k)) { const it = this.liveBy.get(k); if (it !== undefined && it === x) return true; }
      const p = this.pongBy.get(k); return p !== undefined && p[0] === x && this.TICK - p[1] <= 60;
    },
    // C++: mesh.cpp:Seat::wasLinked
    wasLinked(k, p) {
      if (p < 0) return;
      const w = ins(this.wasAt, k, () => []); if (!w.includes(p)) { w.push(p); if (w.length > 3) w.shift(); }
      const pn = this.ppNotes.get(k); if (pn !== undefined) for (const n of pn) if (n.x === p) { this.oldPP.set(ppKey(k, p), n.sig); if (this.oldPP.size > 256) eraseFirst(this.oldPP); break; }
    },
    // C++: mesh.cpp:Seat::noteLinked
    noteLinked(k, x, t) {
      const pl = this.linkedBy.get(k);
      if (pl === undefined || pl !== x) {
        if (pl !== undefined) this.wasLinked(k, pl);
        const cs = this.carrySince.get(x);
        this.linkedSince.set(k, (cs !== undefined && cs.k === k && this.TICK - cs.t <= 60) ? Math.min(cs.at, this.TICK) : this.TICK);
        if (cs !== undefined) this.carrySince.delete(x);
      }
      this.linkedBy.set(k, x);
      if (t >= 0) this.tenOf.set(k, [x, t]); else { const it = this.tenOf.get(k); if (it !== undefined && it[0] !== x) this.tenOf.delete(k); }
    },
    // C++: mesh.cpp:Seat::entryOpen
    entryOpen(k, x) {
      const l = this.linkedBy.get(k); if ((l !== undefined && l === x) || this.translost.has(k)) return false;
      if (!this.pairAt.has(k)) return false;
      const a = this.upAck.get(k); if (a !== undefined && a[0] === x && this.TICK - a[1] <= K.UNPROVEN_HOLD) return true;
      const ex = this.upExpired.get(k); if (ex !== undefined && ex === x) return false;
      let o = this.upOpen.get(k);
      if (o === undefined || o[0] !== x) { if (this.upOpen.size >= 64) eraseFirst(this.upOpen); this.upOpen.set(k, [x, this.TICK]); o = this.upOpen.get(k); }
      if (this.TICK - o[1] <= K.UNPROVEN_HOLD) return true;
      if (this.upExpired.size >= 64) eraseFirst(this.upExpired); this.upExpired.set(k, x); return false;
    },
    // C++: mesh.cpp:Seat::heldRightNow
    heldRightNow(ck) { const it = this.live.get(ck); return it !== undefined && this.TICK - it <= K.HELD_BEATS; },
    // C++: mesh.cpp:Seat::softSitting
    softSitting(k) {
      const it = this.sitting.get(k); if (it === undefined) return false;
      if (this.TICK - it.at > K.SIT_TTL) { this.sitting.delete(k); return false; }
      return true;
    },
    // C++: mesh.cpp:Seat::cellTaken
    cellTaken(k) { return this.occ.has(k) || this.softSitting(k); },
    // C++: mesh.cpp:Seat::occIsPhantom
    occIsPhantom(k) {
      const x = this.occGet(k); if (x < 0) return false;
      if (this.firstHandLive(k)) return false;
      if (this.findNc >= 0 && x === this.findNc) return true;   // (MESH_DUPLOG print left out)
      for (const [kk, v] of this.occ) if (v === x && kk !== k && this.firstHandLive(kk)) return true;
      return false;
    },
    // C++: mesh.cpp:Seat::admitterReachable
    admitterReachable(k) {
      const x = this.occGet(k); if (x < 0 || x === this.id) return false;
      if (this.translost.has(k)) return false;
      if (this.firstHandLive(k)) return true;
      if (this.ledgerNamed(k)) return true;
      return this.f.fabricLinkOpen(this.id, x);
    },
    // C++: mesh.cpp:Seat::l315Id
    l315Id(x) { if (x < 0 || x === this.id) return false; const r = this.relMark.get(x); return r !== undefined && this.TICK - r <= K.LEASE_T; },
    // C++: mesh.cpp:Seat::l315Cell
    l315Cell(k) { const x = this.occGet(k); if (!this.l315Id(x)) return false; const l = this.live.get(k); return l === undefined || l <= this.relMark.get(x); },
    // C++: mesh.cpp:Seat::cellReserved
    cellReserved(k) {
      if (this.softSitting(k)) return true;
      if (!this.occ.has(k)) return false;
      if (this.findNc >= 0 && this.occGet(k) === this.findNc) return false;
      if (this.firstHandLive(k)) return true;
      return !this.occIsPhantom(k);
    },
    // C++: mesh.cpp:Seat::cellSeated
    cellSeated(k) { if (this.hasCoord && ckey(this.coord) === k) return true; return this.firstHandLive(k) && this.occ.has(k); },
    // C++: mesh.cpp:Seat::clearSoft
    clearSoft(k, why = '?') { void why; if (this.sitting.has(k)) this.sitting.delete(k); },
    // C++: mesh.cpp:Seat::markSitting
    markSitting(k, joiner) { const s = state.newStruct('SoftSit'); s.joiner = joiner; s.assigner = this.id; s.at = this.TICK; this.sitting.set(k, s); },
    // C++: mesh.cpp:Seat::ppGrant
    ppGrant(k, joiner) {
      const gk = ppKey(k, joiner); const g = this.ppGiven.get(gk); if (g !== undefined && this.TICK - g <= 60) return;
      if (this.ppGiven.size >= 128) eraseFirst(this.ppGiven); this.ppGiven.set(gk, this.TICK);
      const m = newMsg('PP'); m.coord = coordOf(k); m.id = joiner; m.pp = this.id; m.ppAt = this.TICK; this.emit(joiner, m);
    },
    // C++: mesh.cpp:Seat::confirmSeated
    confirmSeated(k, joiner) {
      let xfer = false; { const it = this.sitting.get(k); xfer = it !== undefined && it.assigner === this.id && it.joiner === joiner && ckPc(k) === 0 && ckI(k) === 0; }
      let sitAt = -1, vouched; { const it = this.sitting.get(k); vouched = it !== undefined && it.joiner === joiner; if (vouched) sitAt = it.at; }
      const l821 = roomTerm(this, 1) && vouched && joiner !== this.id && sitAt >= 0 && this.TICK - sitAt <= (this.f.fabricDoors() ? Seat.L163_CONFIRM_WIN : 2) && this.noChan.has(joiner) && this.hasCoord && this.ownedLinkCell(k) && ckPc(k) !== 0;
      if (l821) this.noChan.delete(joiner);
      const l8211 = roomTerm(this, 1) && vouched && joiner !== this.id && !l821 && ckPc(k) === 0 && this.noChan.has(joiner) && this.hasCoord && this.ownedLinkCell(k);
      if (!l8211) this.clearSoft(k, 'confirm'); this.setOcc(k, joiner);
      if (l821) this.noChan.add(joiner);
      this.liveMark(k); this.noteS1(k);
      if (joiner !== this.id && !vouched && this.ppAdmitter(coordOf(k)) === this.id) this.ppGrant(k, joiner);
      if (xfer) this.sitXfer(k, joiner);
    },
    // C++: mesh.cpp:Seat::sitXfer
    sitXfer(k, joiner) {
      const m = newMsg('SITXFER'); m.ck = k; m.id = joiner;
      const r = ckR(k);
      for (const [ek, s] of this.sitting) if (ckPc(ek) === 0 && ckR(ek) === r && s.assigner === this.id) m.nbrs.push({ k: ek, v: s.joiner });
      { const nk = ckey({ pc: 0, r: (r + 1) % C, i: 0 }); const it = this.sitting.get(nk); if (it !== undefined && it.assigner === this.id) m.nbrs.push({ k: nk, v: it.joiner }); }
      for (let j = 0; j < C; j++) { const rk = ckey({ pc: 0, r, i: j }); const x = this.occGet(rk); if (x >= 0 && rk !== k) m.row.push({ k: rk, v: x, age: -1, ch: -1, ba: -1, tn: 0 }); }
      this.emit(joiner, m);
    },
    // C++: mesh.cpp:Seat::clearVouch
    clearVouch(k, x, why) {
      const it = this.sitting.get(k); if (it === undefined || it.joiner !== x) return;
      const mine = it.assigner === this.id && ckPc(k) === 0 && ckI(k) === 0 && x !== this.id;
      this.clearSoft(k, why);
      if (mine) this.sitXfer(k, x);
    },
    // C++: mesh.cpp:Seat::ownedRowHead
    ownedRowHead() { return { pc: childPath(this.coord.pc, this.coord.i), r: this.coord.r, i: 0 }; },
    // C++: mesh.cpp:Seat::rosterCells
    rosterCells() { const h = this.ownedRowHead(); const out = []; for (let c = 0; c < C; c++) out.push({ pc: h.pc, r: h.r, i: c }); return out; },
    // C++: mesh.cpp:Seat::anyRookLive
    anyRookLive(after = -1) {
      if (!this.hasCoord || this.coord.pc !== 0) return false;
      const ok = (k) => { if (!this.firstHandLive(k)) return false; if (after < 0) return true; const it = this.live.get(k); return it !== undefined && it > after; };
      const rm = rowMates(this.coord), cm = colMates(this.coord);
      for (let q = 0; q < C - 1; q++) { if (ok(ckey(rm[q]))) return true; if (ok(ckey(cm[q]))) return true; }
      return ok(ckey(down(this.coord)));
    },
    // C++: mesh.cpp:Seat::shufCols
    shufCols() { const v = []; for (let q = 0; q < C; q++) v.push(q); for (let k = C - 1; k > 0; k--) { const j = Math.floor(this.rng() * (k + 1)); const t = v[k]; v[k] = v[j]; v[j] = t; } return v; },
    // C++: mesh.cpp:Seat::firstFreeInRoster
    // the free roster cell, or null
    firstFreeInRoster() {
      if (pcDepth(this.coord.pc) >= 12) return null;
      const rc = this.rosterCells();
      const ledger = this.rowLedgerAt >= 0;
      const rmHeadLive = this.occGet(ckey(rc[0])) >= 0 && this.firstHandLive(ckey(rc[0])) && !this.translost.has(ckey(rc[0])); const rmMaybe = this.rmRowMaybeLive();
      for (let c = 0; c < C; c++) {
        const k = ckey(rc[c]); if (c > 0 && !ledger) continue; if (this.cellReserved(k)) continue; if (this.courtHeld(k)) break;
        if (c > 0 && this.l20Held(k)) continue;
        if ((c > 0 && this.l13('L13.7')) || (c === 0 && this.l13('L13.32'))) { const hc = this.l13HeirCallAt.get(k); if (hc !== undefined && this.TICK - hc <= K.LEASE_T) continue; }
        if (c > 0 && this.l13('L13.7')) {
          const mm = this.l13RowMemo.get(k);
          if (mm !== undefined && mm[0] >= 0 && this.TICK - mm[1] <= 2 * K.LEASE_T && !(this.l13('L13.28') && !this.firstHandLive(k) && this.TICK - mm[1] > 64)) { const b = this.byeAt.get(k); if (!(b !== undefined && b >= mm[1])) continue; }
        }
        if (((c > 0 && (!rmHeadLive || this.TICK - this.rmNewHeadAt < (this.l13('L13.28') ? 64 : (this.l13('L13.7') ? K.LEASE_T : 16)))) || (c === 0 && rmMaybe))) continue;
        if (c > 0) { let right = false; for (let j = c + 1; j < C; j++) if (this.occGet(ckey(rc[j])) >= 0) right = true; if (right) continue; }
        if (this.occ.has(k) && this.kidful.has(k) && ins(this.kidful, k, () => 0)) continue;
        { const km = this.kidMemo.get(k); if (km !== undefined) { if (this.TICK - km <= K.LEASE_T) continue; this.kidMemo.delete(k); } }
        const dk = ckey(down(rc[c])); if (this.cellReserved(dk) && !this.occIsPhantom(dk)) continue; if (this.softSitting(dk)) continue;
        { const ht = this.healTry.get(k); if (ht !== undefined && this.TICK - ht <= 45) continue; }
        return rc[c];
      }
      return null;
    },
    // C++: mesh.cpp:Seat::l20Held
    l20Held(k) { const h = this.l20Hold.get(k); if (h === undefined) return false; return !h.bye && this.TICK - h.at <= K.LEASE_T; },
    // C++: mesh.cpp:Seat::ownerCoord
    // my row's owner cell, or null
    ownerCoord() { if (!this.hasCoord || this.coord.pc === 0) return null; return up({ pc: this.coord.pc, r: this.coord.r, i: 0 }); },
    // C++: mesh.cpp:Seat::l13AnchorElse
    l13AnchorElse(k) { if (!this.l13On() || !this.hasCoord || this.state !== 3 || this.coord.pc === 0) return false; if (this.coord.i !== 0) return k === ckey({ pc: this.coord.pc, r: this.coord.r, i: 0 }); const o = this.ownerCoord(); return !!o && ckey(o) === k; },
    // C++: mesh.cpp:Seat::ownerId
    ownerId() { if (!this.hasCoord) return -1; const u = up({ pc: this.coord.pc, r: this.coord.r, i: 0 }); if (!u) return -1; return this.occGet(ckey(u)); },
    // C++: mesh.cpp:Seat::hasChildren
    hasChildren() { const rc = this.rosterCells(); for (let c = 0; c < C; c++) { const x = this.occGet(ckey(rc[c])); if (x >= 0 && x !== this.id) return true; } return false; },
    // C++: mesh.cpp:Seat::linkIs
    linkIs(m, x) { return x >= 0 && m.lk >= 0 && m.lk === x; },
    // C++: mesh.cpp:Seat::standDown
    standDown() { return (this.selfLeaseAt >= 0 || this.islanded()); },
    // C++: mesh.cpp:Seat::provenEv
    provenEv(m, x) { return signedBy(m, x); },
    // C++: mesh.cpp:Seat::arbiterIs
    arbiterIs(x) { return this.arbCellOf(x) !== null; },
    // C++: mesh.cpp:Seat::heldRedial
    heldRedial(k, x, win) {
      if (!(this.f.fabricDoors()) || x < 0) return false;
      const o = this.occ.get(k); if (o === undefined || o !== x) return false;
      if (this.f.fabricLinkState(this.id, x) !== LS_DIALING) return false;
      const lb = this.liveBy.get(k); if (lb === undefined || lb !== x) return false;
      const it = this.live.get(k); return it !== undefined && this.TICK - it <= win;
    },
    // C++: mesh.cpp:Seat::bornOf
    // x's birth tick at k, or null
    bornOf(k, x) {
      if (x < 0) return null;
      const it = this.rmBirthOf.get(k); if (it !== undefined && it[0] === x) return it[1];
      const st = this.sitting.get(k); if (st !== undefined && st.joiner === x && st.assigner === this.id) return st.at;
      { const h = this.l165Have(k, x); if (h) return h.loc; }
      return null;
    },
    // C++: mesh.cpp:Seat::l167Attach
    l167Attach(y, k, keep) { if (!(this.f.fabricDoors()) || keep < 0) return; y.nc = keep; const b = this.bornOf(k, keep); if (b !== null) y.born = b; },
    // C++: mesh.cpp:Seat::l167Gone
    l167Gone(m) { if (!(this.f.fabricDoors()) || !m.sig || m.sigL < 0) return false; const it = this.live.get(m.ck); return it !== undefined && it <= m.sigL + this.w.lv.NET_SKEW; },
    // C++: mesh.cpp:Seat::l167Stand
    l167Stand(rival, rivalBorn) { if (!(this.f.fabricDoors()) || rival < 0 || rival === this.id || rivalBorn < 0 || this.rmBornAt < 0) return false; return placeBefore(this.id, this.rmBornAt, rival, rivalBorn); },
    // C++: mesh.cpp:Seat::claimBorn
    claimBorn(m) { return m.born >= 0 ? m.born : (m.arr >= 0 ? this.TICK - m.arr : -1); },
    // C++: mesh.cpp:Seat::holdsCell
    holdsCell(k, win) {
      const o = this.occ.get(k); if (o === undefined || o < 0 || this.translost.has(k)) return false;
      const lb = this.liveBy.get(k); if (lb === undefined || lb !== o) return false;
      const it = this.live.get(k); return it !== undefined && this.TICK - it <= win;
    },
    // C++: mesh.cpp:Seat::rawClaim
    rawClaim(k, x, win) {
      if (x < 0 || this.occGet(k) === x || !this.holdsCell(k, win)) return false;
      if (!this.ppBacked(k, x)) return true;
      const s = this.heardSince.get(k); if (s === undefined || this.TICK - s < K.TENURE) return false;
      const w = this.wasAt.get(k); return !(w !== undefined && w.includes(x) && this.ppFresh(k, x));
    },
    // C++: mesh.cpp:Seat::fresh
    fresh() { return this.TICK - this.estAt < K.FRESH; },
    // C++: mesh.cpp:Seat::nbrHeard
    nbrHeard() { if (this.nbrAt !== -1 && this.TICK - this.nbrAt > K.NBR_GAP) this.estAt = this.TICK; this.nbrAt = this.TICK; },
    // C++: mesh.cpp:Seat::loneAsk
    loneAsk() {
      if (this.rivalId < 0 || this.state !== 3 || !this.hasCoord || this.coord.pc !== 0 || this.TICK - this.rivalAt > 200) return;
      if (this.hearRook() || this.TICK - this.rookSeenAt <= K.OWNER_SILENT || this.TICK - this.rosterAskAt <= 40) return;
      this.rosterAskAt = this.TICK; const w = newMsg('WHOHOME'); w.from = this.id; w.ttl = 60; this.emit(this.rivalId, w);
    },
    // C++: mesh.cpp:Seat::loneGreet
    loneGreet() {
      if (this.state !== 3 || !this.hasCoord || this.coord.pc !== 0 || this.hearRook() || this.TICK - this.rookSeenAt <= K.LONE_GREET_AFTER) return;
      for (const [k, v] of this.occ) if (v !== this.id && this.firstHandLive(k)) return;
      if (!this.lastGreeters.length || this.greetersAt < 0 || this.TICK - this.greetersAt > K.RELAY_TTL) return;
      for (const g of this.lastGreeters) if (g >= 0 && g !== this.id) { const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = this.id; this.emit(g, h); }
    },
    // C++: mesh.cpp:Seat::carryLinked
    carryLinked(k, mvd, x) { const ls = this.linkedSince.get(k); if (ls === undefined) return; if (this.carrySince.size >= 64) eraseFirst(this.carrySince); this.carrySince.set(x, { k: mvd, at: ls, t: this.TICK }); },
    // C++: mesh.cpp:Seat::arbOk
    arbOk(x) {
      const k = this.arbCellOf(x); if (k === null) return false;
      if (this.l13('L13.1') && x >= 0) {
        for (const w of this.l13Wit) if (w === x) return true;
        if (this.occGet(k) === x) { if (this.firstHandLive(k)) return true; const pb = this.pongBy.get(k); if (pb !== undefined && pb[0] === x && this.TICK - pb[1] <= 16) return true; }
      }
      if (roomTerm(this, 1) && this.l820MergeDeep(k, x)) return false;
      if (x >= 0 && x === this.pp && this.hasCoord && this.ppCk === ckey(this.coord)) return true;
      if (this.fresh()) return this.ppSigned(k, x);
      const ls = this.linkedSince.get(k); if (ls !== undefined && ls <= this.estAt + K.FRESH) return true;
      if (roomTerm(this, 1) && this.strangerOk(x) && this.l818SoleStranger(k, x)) return false;
      if (roomTerm(this, 1) && this.l819CrossRow(k, x)) return false;
      return this.ppBacked(k, x);
    },
    // C++: mesh.cpp:Seat::lateQuorum
    lateQuorum(by, ak, myCk) {
      if (!this.ppSigned(ak, by)) return false;
      if (this.lateYCk !== myCk) { this.lateY.clear(); this.lateYCk = myCk; }
      this.lateY.set(by, [this.TICK, ak]);
      if (this.lateY.size > 16) { const old = []; for (const [x, e] of this.lateY) if (this.TICK - e[0] > 40) old.push(x); for (const o of old) this.lateY.delete(o); }
      for (const [x, e] of this.lateY) { if (x !== by && e[1] !== ak && this.TICK - e[0] <= 40) { const k2 = this.arbCellOf(x); if (k2 !== null && k2 === e[1] && this.ppSigned(e[1], x)) return true; } }
      return false;
    },
    // C++: mesh.cpp:Seat::ppNote
    ppNote(k, x, sig, from, loc) {
      const v = ins(this.ppNotes, k, () => []);
      if (this.ppNotes.size > 256 && !v.length) { eraseFirst(this.ppNotes); ins(this.ppNotes, k, () => []); }
      const vv = ins(this.ppNotes, k, () => []);
      for (const n of vv) if (n.x === x) { n.sig = sig; n.from = from; n.at = this.TICK; n.loc = loc; return; }
      if (vv.length >= 4) vv.shift();
      vv.push({ x, from, sig, at: this.TICK, loc });
    },
    // C++: mesh.cpp:Seat::l165Have
    // {from, at, loc} when x's placement proof at k is whole, else null
    l165Have(k, x) {
      const it = this.ppNotes.get(k); if (it === undefined) return null;
      for (const n of it) if (n.x === x) { const from = n.from, at = hash.pairB(n.sig) | 0, loc = n.loc; return (from >= 0 && at >= 0 && loc >= 0) ? { from, at, loc } : null; }
      return null;
    },
    // C++: mesh.cpp:Seat::l165Attach
    l165Attach(y, k, keep) {
      if (!(this.f.fabricDoors()) || keep < 0) return;
      const h = this.l165Have(k, keep);
      if (h) { y.pp = h.from; y.ppAt = h.at; y.ppL = h.loc; }
      else if (keep === this.id) { /* nothing */ }
      else { const it = this.sitting.get(k); if (it !== undefined && it.joiner === keep && it.assigner === this.id) { y.pp = this.id; y.ppAt = it.at; y.ppL = y.ppAt; } }
    },
    // C++: mesh.cpp:Seat::ppBacked
    ppBacked(k, x) { const it = this.ppNotes.get(k); if (it === undefined) return false; for (const n of it) if (n.x === x) return this.ppAdm(k, n.from, x); return false; },
    // C++: mesh.cpp:Seat::l818SoleStranger
    l818SoleStranger(k, x) {
      const it = this.ppNotes.get(k); if (it === undefined) return false;
      for (const n of it) if (n.x === x && this.ppAdm(k, n.from, x)) {
        if (!this.strangerOk(n.from)) return false;
        for (const [ek, v] of this.occ) if (v === n.from && ek !== k && ckPc(ek) === 0) return false;
        const ax = this.xrOk.get(x), aa = this.xrOk.get(n.from); if (ax === undefined || aa === undefined || aa >= ax) return false;
        return true;
      }
      return false;
    },
    // C++: mesh.cpp:Seat::l819CrossRow
    l819CrossRow(k, x) {
      if (!this.hasCoord || this.coord.pc !== 0 || ckPc(k) !== 0 || this.c7At > -1000000 || !this.strangerOk(x)) return false;
      if (ckR(k) === this.coord.r) return false;
      const ls = this.linkedSince.get(k); return ls !== undefined && this.TICK - ls === 1;
    },
    // C++: mesh.cpp:Seat::l820MergeDeep
    l820MergeDeep(k, x) {
      if (x < 0 || !this.hasCoord || this.coord.pc !== 0 || ckPc(k) !== 0 || !this.fresh() || this.c7At < -100000) return false;
      if (this.TICK - this.estAt < Seat.LEDGER_FRESH) return false;
      return this.TICK - this.c7At <= K.FRESH;
    },
    // C++: mesh.cpp:Seat::ppFresh
    ppFresh(k, x) { const it = this.ppNotes.get(k); if (it === undefined) return false; for (const n of it) if (n.x === x) { const o = this.oldPP.get(ppKey(k, x)); return o === undefined || o !== n.sig; } return false; },
    // C++: mesh.cpp:Seat::ppValid
    ppValid(m) { return m.pp >= 0 && m.pp !== m.id && m.ppAt >= 0; },
    // C++: mesh.cpp:Seat::ppPendingSim
    ppPendingSim() { return false; },
    // C++: mesh.cpp:Seat::ppSigned
    ppSigned(k, x) { const it = this.ppNotes.get(k); if (it === undefined) return false; for (const n of it) if (n.x === x) return n.from >= 0 && n.from !== x; return false; },
    // C++: mesh.cpp:Seat::strangerOk
    strangerOk(x) { const it = this.xrOk.get(x); return it !== undefined && this.TICK - it <= 2 * K.RELAY_TTL; },
    // C++: mesh.cpp:Seat::lowestSurvivor
    lowestSurvivor() { for (let j = 1; j < this.coord.i; j++) { const k = ckey({ pc: this.coord.pc, r: this.coord.r, i: j }); const x = this.occGet(k); if (x < 0 || x === this.id) continue; if (this.coord.pc !== 0 || this.s1Fresh(k)) return false; } return true; },
    // C++: mesh.cpp:Seat::hasDownChild
    hasDownChild(c) { if (this.occGet(ckey(down(c))) >= 0) return true; const it = this.childOf.get(ckey(c)); return it !== undefined && it >= 0; },
    // C++: mesh.cpp:Seat::join
    // (the PROOF_IN tape hook and the MESH_TRACE debug print of the C++ are left out)
    join() {
      { const t0 = this.f.fabricMyTier(this.id) & 0xff, n0 = this.f.fabricMyNat(this.id) & 0xff;
        if (!this.tierInit || this.ctier === this.tier) this.ctier = t0; this.tier = t0;
        if (!this.tierInit || this.cnat === this.nat) this.cnat = n0; this.nat = n0;
        if (!this.tierInit) { const o = this.f.fabricLieFor(this.id, this.ctier, this.cnat); if (o) { this.ctier = o[1] & 0xff; this.cnat = o[2] & 0xff; } }
        this.tierInit = true; }
      if (this.joinTick === this.TICK) { if (!this.hasCoord) { this.state = 0; this.retryAt = this.TICK; } this.reJoin = true; this.f.wake(this.id); return; }
      this.joinTick = this.TICK; this.l16Anch = false; this.l16Ho = -1; this.state = 0; this.retryAt = this.TICK; this.haveRoster = false; this.resumeTries = 0; this.triedSilent.clear(); this.noroomSeen = 0;
      this.emitRelay(this.linkKey); this.f.wake(this.id);
    },
    // C++: mesh.cpp:Seat::resumeAsk
    resumeAsk() {
      if (!this.lastGreeters.length) return false;
      if (this.greetersAt < 0 || this.TICK - this.greetersAt > K.RELAY_TTL) return false;
      if (this.resumeTries >= 6) return false;
      const pool = []; for (const g of this.lastGreeters) if (g >= 0 && g !== this.id) pool.push(g);
      if (!pool.length) return false;
      this.resumeTries++;
      const g = pool[Math.floor(this.rng() * pool.length)]; this.gateway = g; this.entNote(g); if (this.f.fabricDoors()) { this.l16AskOne(g); }
      const w = newMsg('WHOHOME'); w.from = this.id; w.ttl = 60; if (!this.oldCell && !islandStand(this, E.IS_L31)) w.l31 = 1; this.emit(g, w); this.l3115Knock(g);   // L3.11.5
      this.state = 1; this.retryAt = this.TICK; this.f.wake(this.id); return true;
    },
    // C++: mesh.cpp:Seat::silentFor
    silentFor(k, n) { const it = this.live.get(k); return it !== undefined && this.TICK - it > n; },
    // C++: mesh.cpp:Seat::findAck
    findAck(mm, k = 0, hasK = false, deep = false, handed = false) {
      if (mm.from < 0 || mm.from !== mm.nc) return; if (hasK && !deep && this.silentFor(k, K.LONE_GREET_AFTER)) return;
      if (hasK && this.backAt >= 0) { const it = this.live.get(k); if (it === undefined || it <= this.backAt) return; }
      const a = newMsg('FINDACK'); a.nc = mm.nc; this.emit(mm.nc, a); if (handed && this.f.fabricDoors()) this.f.fabricDoorHanded(this.id, mm.nc);
    },
    // C++: mesh.cpp:Seat::l163Close
    l163Close(mm) { const lv = this.w.lv; return this.f.fabricDoors() && mm.from === mm.nc && this.hasCoord && this.coord.pc === 0 && this.f.fabricMyKnocks(this.id) >= lv.L16HOLOAD && !(lv.L16MOBKEEP && lv.TIERS_ACTIVE && mm.tier === E.TIER_MOBILE); },
    // C++: mesh.cpp:Seat::askSeat
    askSeat(target, gwc = false) {
      if (this.askTick === this.TICK) { if (!this.hasCoord) { this.state = 2; this.retryAt = this.TICK; } this.reAsk = true; this.f.wake(this.id); return; }
      this.askTick = this.TICK; this.state = 2; this.retryAt = this.TICK; this.findAckAt = -1; this.triedSilent.add(target); this.lastAsked = target;
      const m = newMsg('FIND'); m.nc = this.id; m.gwc = gwc || (this.l16GwClosed && this.f.fabricDoors()); m.ttl = 200; m.spread = (this.w.lv.SPREAD && this.noroomSeen >= 1); m.dark = this.darkGreeters(target); this.l381Stamp(m); /* L38.1 */ if (this.d6Mark) m.dk = true;
      if (roomTerm(this, 1) && this.searchAt >= 0 && this.TICK - this.searchAt >= K.RELAY_TTL) m.late = true;
      this.emit(target, m); this.f.wake(this.id);
    },
    // C++: mesh.cpp:Seat::l32RosterStale
    l32RosterStale() {
      if (!this.lastGreeters.length || this.greetersAt < 0 || this.TICK - this.greetersAt > K.RELAY_TTL) return false;
      for (const e of this.roster) if (e.v !== this.id) for (const g of this.lastGreeters) if (g === e.v) return false;
      return true;
    },
    // C++: mesh.cpp:Seat::pickRoster
    pickRoster() {
      const live_ = [], fresh_ = [], door_ = [];
      for (const e of this.roster) if (e.v !== this.id) { live_.push(e.v); if (!this.triedSilent.has(e.v)) { fresh_.push(e.v); for (const g of this.lastGreeters) if (g === e.v) { door_.push(e.v); break; } } }
      const pool = !door_.length ? (!fresh_.length ? live_ : fresh_) : door_;
      if (!pool.length) return -1; return pool[Math.floor(this.rng() * pool.length)];
    },
    // C++: mesh.cpp:Seat::s1Roster
    s1Roster() {
      const out = []; if (this.hasCoord && this.coord.pc === 0) out.push({ k: ckey(this.coord), v: this.id });
      for (const [k, v] of this.occ) if (ckPc(k) === 0 && v !== this.id && this.s1Fresh(k) && !this.translost.has(k) && !this.s1Told(k) && !this.l315Cell(k)) out.push({ k, v });
      return out;
    },
    // C++: mesh.cpp:Seat::goodbye
    goodbye(pid, defer = null) {
      if (pid < 0 || pid === this.id || !this.hasCoord || this.state !== 3) return;
      const ks = []; for (const [k, v] of this.occ) if (v === pid && k !== ckey(this.coord)) ks.push(k);
      for (const k of ks) {
        this.linkedBy.delete(k); this.tenOf.delete(k); this.occDrop(k, 'goodbye'); this.live.delete(k); this.kidful.delete(k); this.s1seen.delete(k); this.tlForget(k); this.healTry.delete(k); this.digForget(k);
        { const it = this.sitting.get(k); if (it !== undefined && it.joiner === pid) this.clearSoft(k, 'goodbye'); }
        this.lastChurn = this.TICK; if (defer) defer.push(k); else this.goodbyeHeal(k);
      }
    },
    // C++: mesh.cpp:Seat::greet
    greet(x) {
      if (x < 0 || x === this.id || this.state !== 3 || !this.hasCoord) return;
      for (const c of ownedLinks(this.coord)) if (this.occGet(ckey(c)) === x) return;
      const h = newMsg('HELLO'); h.ck = ckey(this.coord); h.id = this.id; this.emit(x, h);
    },
    // C++: mesh.cpp:Seat::noteDoorAsk
    noteDoorAsk(to) {
      const it = this.doorAsk.get(to);
      if (it !== undefined && this.TICK - it[1] <= K.DARK_ASK_FRESH) it[1] = this.TICK;
      else {
        this.doorAsk.set(to, [this.TICK, this.TICK]);
        if (this.doorAsk.size > 64) { let ok = null, ov = null; for (const [k, v] of this.doorAsk) if (ov === null || v[0] < ov[0]) { ok = k; ov = v; } this.doorAsk.delete(ok); }
      }
    },
    // C++: mesh.cpp:Seat::darkGreeters
    darkGreeters(skip) {
      const out = [];
      for (const [k, e] of this.doorAsk) { if (k !== skip && this.TICK - e[0] >= K.DARK_WAIT && this.TICK - e[1] <= K.DARK_ASK_FRESH) out.push(k); if (out.length >= 32) break; }
      return out;
    },
    // C++: mesh.cpp:Seat::socketed
    socketed() { return this.state !== 3 || (this.hasCoord && this.coord.pc === 0) || (!l13MergingOf(this) && this.TICK - this.l13KnockAt <= K.RELAY_TTL) || this.doorCarry || this.doorCallOn(); },   // FHOP.8: a friend called to the door holds a door socket while it stands there
    // C++: mesh.cpp:Seat::doorCallOn
    // FHOP.8: a friend called to the door (doorCall, island.js) answers there as a greeter until doorCallUntil.
    doorCallOn() { return this.hasCoord && this.state === 3 && this.coord.pc !== 0 && this.TICK < this.doorCallUntil; },
    // C++: mesh.cpp:Seat::l13MassHeard
    l13MassHeard() { this.l13MassLast = this.TICK; this.l13MassTick = -1; },
    // C++: mesh.cpp:Seat::l13OwnerPending
    l13OwnerPending(ak, by) { const hb = this.l13HeldBy.get(ak); if (hb === undefined || hb === by) return false; return this.callBook.ringFresh(hb, 8, this.TICK); },
    // C++: mesh.cpp:Seat::l14FailedNow
    l14FailedNow(x) { const f = this.l14Failed.get(x); return f !== undefined && this.TICK - f < (f >= 0 && this.l14Refused.has(x) ? 8 : 16); },
    // C++: mesh.cpp:Seat::rmAskDue
    rmAskDue(k) {
      const f = this.rmAskFirst.get(k); if (f === undefined || this.TICK - f > 240) { if (this.rmAskFirst.size >= 32) this.rmAskFirst.clear(); this.rmAskFirst.set(k, this.TICK); }
      const a = this.rmAskT.get(k); if (a !== undefined && this.TICK - a < 12) return false;
      if (this.rmAskT.size >= 32) eraseFirst(this.rmAskT); this.rmAskT.set(k, this.TICK); return true;
    },
    // C++: mesh.cpp:Seat::l836Merging
    l836Merging() {
      const mn = this.ringName();
      for (const e of this.l828Ring.values()) if (e[0] !== mn && this.TICK - e[1] <= K.RELAY_TTL) return true;
      for (const v of this.l829Bye.values()) if (this.TICK - v <= K.RELAY_TTL) return true;
      return false;
    },
    // C++: mesh.cpp:Seat::l4Ahead
    // L4.3.1: a neighbour of the cell I am to enter, from the head's go to the exchange.
    l4Ahead(x) { if (this.l4ExecAt < 0 && !this.l4Out) return false; for (const e of this.l4Nb) if (e.v === x) return true; return false; },
    // C++: mesh.cpp:Seat::l4Peer
    l4Peer(x) { return (this.l4MarkUntil >= this.TICK && this.l4Old.has(x)) || this.l4Ahead(x); },
    // C++: mesh.cpp:Seat::l13SplitHole
    l13SplitHole(k) { const it = this.l13SplitCell.get(k); return it !== undefined && this.TICK - it[1] <= K.RELAY_TTL; },
    // C++: mesh.cpp:Seat::l1612Keep
    l1612Keep() { return this.mergeCalc() || this.TICK - this.c7At < K.RELAY_TTL; },
    // C++: mesh.cpp:Seat::l832Settled
    l832Settled() { return this.l827Hist.length > 0 && this.TICK - this.l827Hist[0][0] >= K.L827_HOLD; },
    // C++: mesh.cpp:Seat::l830Merging
    l830Merging() { const mn = this.ringName(); let n = 0; for (const e of this.l828Ring.values()) if (this.TICK - e[1] <= 60 && e[0] !== mn && ++n >= 2) return true; return false; },
  });

  // ---- the seat methods the sim defines in its fabric region (mesh.cpp) -------------------------------------
  Seat.unit('mesh.cpp seat methods beside the fabric', {
    // C++: mesh.cpp:Seat::l13Mass
    // L13: does this seat see a mass leave (two goodbyes, two downed links, two dark links, two silent peers,
    // or two never-heard ring seats whose dials failed), held for two leases. Cached per tick.
    l13Mass() {
      if (this.l13MassTick === this.TICK) return this.l13MassV;
      this.l13MassTick = this.TICK;
      let n = 0; for (const v of this.byeIds.values()) if (this.TICK - v <= K.LEASE_T) { if (++n >= 2) break; }
      let d = 0; { const ps = new Set(); for (let q = 0; q < this.l13DownAt.length; q++) if (this.TICK - this.l13DownAt[q] <= K.LEASE_T) ps.add(q < this.l13DownPeer.length ? this.l13DownPeer[q] : -1 - q); d = ps.size; }
      let sil = 0;
      if (this.hasCoord && this.state === 3) {
        for (const c of ownedLinks(this.coord)) { const k = ckey(c); const x = this.occGet(k); if (x < 0 || x === this.id) continue; const lv = this.live.get(k); if (lv !== undefined && this.TICK - lv >= 60 && lv >= this.seatedAt + 128) sil++; }
      }
      let dk = 0;
      if (this.hasCoord && this.state === 3 && this.coord.pc === 0 && this.TICK - this.seatedAt >= 60) {
        const ol = ownedLinks(this.coord);
        for (let q = 0; q < ol.length && dk < 2; q++) {
          const k = ckey(ol[q]); const x = this.occGet(k); if (x < 0 || x === this.id || this.softSitting(k)) continue;
          const lv = this.live.get(k); if (lv !== undefined && lv >= this.seatedAt) continue;
          const pb = this.pongBy.get(k); if (pb !== undefined && pb[0] === x && pb[1] >= this.seatedAt) continue;
          if (this.f.fabricDialFails(this.id, x) >= 1 && this.f.fabricLinkState(this.id, x) !== LS_OPEN) dk++;
        }
      }
      const v = n >= 2 || d >= 2 || this.noChan.size >= 2 || sil >= 2 || dk >= 2; if (v) this.l13MassLast = this.TICK;
      this.l13MassV = v || this.TICK - this.l13MassLast <= 2 * K.LEASE_T; return this.l13MassV;
    },

    // C++: mesh.cpp:Seat::emit
    // The seat-side send: each rule below stamps a copy of the frame and sends that copy through emit again;
    // the last line hands the frame to the fabric. (The C++'s L13DBG debug traces are left out: they write
    // only under that env switch.)
    emit(to, m) {
      const id = this.id, TICK = this.TICK, lv = this.w.lv;
      if (this.hostDenseLeaf >= 0 && m.t === 'YIELD') return;   // `hostile densify`: the page never evicts the seat it placed (harness gaps3-fab.js)
      if (m.line < 0 && this.line >= 0 && (((m.t === 'HELLO' || m.t === 'PHONE' || m.t === 'PONG' || m.t === 'CONFIRM' || m.t === 'LEAVE' || m.t === 'HOME') && m.id === id) || (m.t === 'WALK' && m.asker === id) || (m.t === 'PLACE' && m.pp === id))) {
        const mm = msg.clone(m); mm.line = (this.hostile & K.H_RINGLIE_BIT) ? K.RINGLIE_LINE : this.line; if (!L8_52_OFF) { mm.lineAt = this.lineAt; } mm.lineF = this.lineFork; mm.cutF = (this.cutAt >= 0 || this.cutHeardAt >= 0); this.emit(to, mm); return;   // L8.38
      }
      if (this.vban.size && !this.kIgnore && (this.kBanned(to) || ((m.t === 'PLACE' || m.t === 'FIND' || m.t === 'FINDACK' || m.t === 'NOROOM') && this.kBanned(m.nc)) || (m.routing && this.kBanned(m.rfinal)))) { this.kTx++; return; }   // L27
      if (m.t === 'YIELD' && m.id === id && !m.yp && to >= 0 && to !== id) { if (this.l24Yielded.size > 128) this.l24Yielded.clear(); this.l24Yielded.set(to, TICK); }   // L24
      this.callBook.touchOut(to, TICK);   // CALL: a frame of mine on the call holds it
      if (this.kver > 0 && m.t === 'PHONE' && m.id === id && m.kv.voter < 0 && !m.l10E && m.tag !== 5 && this.hasCoord && this.state === 3 && this.coord.pc !== 0 && ckey(m.coord) === ckey(this.coord) && TICK >= this.digHoldUntil) {
        const mm = msg.clone(m); mm.kv = this.kStmt();
        if (this.kLast.ver !== mm.kv.ver || this.kLast.ck !== mm.kv.ck) { this.kPrev = this.kLast; this.kLast = dig.cloneKStmt(mm.kv); }
        if (this.kEvil === 2) { mm.kv.good = false; }
        this.emit(to, mm); return;   // L27: my vote rides my beat
      }
      if (this.l13('L13.1') && lv.LINKMODEL && m.t === 'YIELD' && m.id === id && to >= 0 && to !== id && this.f.fabricLinkState(id, to) === LS_NONE && !(this.f.fabricL23Busy(id, to)) && !this.otherRing(to)) this.f.fabricDialJoin(id, to);   // L13.1
      if (roomTerm(this, 1) && m.t === 'YIELD' && m.id === id && !m.yp && (this.l832Settled())) {
        let o = m.nc >= 0 ? m.nc : this.occGet(m.ck); if (o === to) o = -1;   // L8.28
        if (o >= 0) {
          let a = this.l828RingOf(to), b = this.l828RingOf(o);
          if ((a < 0) !== (b < 0) && this.l828At >= 0 && TICK - this.l828At < K.L828_HOLD && this.hasCoord && this.state === 3 && this.l830Merging()) { const mn = this.ringName(); if (a === mn) b = mn + 1; else if (b === mn) a = mn + 1; }   // L8.30
          if (a >= 0 && b >= 0 && a !== b) { if (this.l828At < 0 || TICK - this.l828At > K.RELAY_TTL) this.l828At = TICK; if (TICK - this.l828At < K.L828_HOLD) { this.trace('L8.28-HOLD', id, null, 'to=%d other=%d rings=%d/%d', to, o, a, b); return; } }
        }
      }
      if (roomTerm(this, 1) && m.t === 'PONG' && m.id === id && m.c7Min < 0 && this.hasCoord && this.state === 3) { const mm = msg.clone(m); mm.c7Min = this.ringName(); this.emit(to, mm); return; }   // L8.31
      if (roomTerm(this, 1) && m.t === 'HELLO' && m.c7Min < 0 && this.hasCoord && this.state === 3) { const mm = msg.clone(m); mm.c7Min = this.ringName(); mm.c7Held = this.l845Held(); mm.c7One = this.ringAlone() || (!L8_50_OFF && this.l850Lone()) || this.f.fabricTurnAcross(id); /* L8.50: a founder that has seated nobody is its ring, whatever its view has absorbed from a room it has one pc into */ /* TURN.14.10: the end of a TURN link whose ring lies across it is the one seat of that ring its own side can hear: its vouch is the ring's word there */ this.emit(to, mm); return; }   // L8.5 (L8.5.2: c7One says my ring holds nobody else)
      if (roomTerm(this, 1) && ((m.t === 'HOME' && m.id === id) || (m.t === 'PLACE' && m.pp === id)) && m.c7Min < 0 && this.hasCoord && this.state === 3) { const mm = msg.clone(m); mm.c7Min = this.ringName(); this.emit(to, mm); return; }   // L8.5.1
      if (m.nc >= 0 && m.nc !== id && to !== id && to >= 0 && (m.t === 'FIND' || m.t === 'PLACE') && this.f.fabricTurnPc(id, to) && this.t14Cross(to, m)) return;   /* TURN.14.11 */
      if (m.t === 'PLACE' && m.pp === id && m.t14 < 0 && this.hasCoord && this.state === 3 && this.f.fabricTurnOn()) { const mm = msg.clone(m); const w = this.t14Word(); mm.t14 = (w > 0 && FREE.t14Under(m.coord, w)) ? w : 0; this.emit(to, mm); return; }   /* TURN.14.5: my placement says whether the cell hangs under a link end */
      if (roomTerm(this, 1) && m.t === 'PHONE' && m.id === id && m.c7Min < 0 && this.hasCoord && this.state === 3) { const mm = msg.clone(m); mm.c7Min = this.ringName(); this.emit(to, mm); return; }   // L8.10
      if (m.t === 'WHOHOME' && !this.hasCoord && m.from === id) this.noteDoorAsk(to);   // dark-greeter evidence
      if (roomTerm(this, 1) && m.t === 'CONFIRM' && m.id === id && m.c7Min < 0 && this.hasCoord && this.state === 3) { const mm = msg.clone(m); mm.c7Min = this.ringName(); this.emit(to, mm); return; }   // L8.11
      if (m.t === 'YIELD' && m.id === id && this.hasCoord && !m.yp) { const p = newMsg('PONG'); p.coord = topo.cc(this.coord); p.id = id; p.tag = 7; this.emit(to, p); const y = msg.clone(m); y.yp = true; this.emit(to, y); return; }
      if (m.t === 'FINDLEAF' && m.tag === 0 && this.rmVTag) { const mm = msg.clone(m); mm.tag = this.rmVTag; this.emit(to, mm); return; }   // L11
      if (((m.t === 'HELLO' && m.ck === ckey(this.coord)) || (m.t === 'PHONE' && !m.l10E && this.hasCoord && ckey(m.coord) === ckey(this.coord))) && m.id === id && m.arr < 0 && this.hasCoord && this.state === 3) { const mm = msg.clone(m); mm.arr = Math.max(0, TICK - this.rmBornAt) | 0; mm.born = this.rmBornAt; this.emit(to, mm); return; }   // L11
      // TENANCY: my PHONE/PONG/HELLO/LEAVE about a stay I hold carries its nonce.
      if (m.id === id && m.tn < 0 && (m.t === 'PHONE' || m.t === 'PONG' || m.t === 'HELLO' || m.t === 'LEAVE')) {
        const mk = (m.t === 'PHONE' || m.t === 'PONG') ? ckey(m.coord) : m.ck; let t = -1;
        if (this.hasCoord && mk === ckey(this.coord)) t = this.tn; else if (mk === this.oldCk && this.oldTn >= 0) t = this.oldTn;
        if (t >= 0) { const mm = msg.clone(m); mm.tn = t; this.emit(to, mm); return; }
      }
      if (!m.sig && m.id === id && (m.t === 'HELLO' || m.t === 'CLAIM' || m.t === 'PHONE' || m.t === 'PONG' || m.t === 'TAKEN' || m.t === 'LEAVE' || m.t === 'MOVED' || m.t === 'YIELD' || m.t === 'CONFIRM')) { const mm = msg.clone(m); mm.sig = true; mm.sigAt = TICK; this.emit(to, mm); return; }   // L26, R4
      if (m.t === 'PLACED' && m.l31 !== 6 && !m.sig && (m.l31By === id || m.tag === 31)) { const mm = msg.clone(m); mm.sig = true; mm.sigAt = TICK; this.emit(to, mm); return; }   // L26
      if (m.t === 'FIND' && m.nc === id && !m.fsig) { const mm = msg.clone(m); mm.fsig = true; this.emit(to, mm); return; }   // L24
      if (m.t === 'FINDLEAF' && m.fo < 0) {
        const mm = msg.clone(m);
        if (this.flCur >= 0) { mm.fo = this.flCur; mm.foAt = this.flCurAt; mm.foL = this.flCurL; }
        else { mm.fo = id; mm.foAt = TICK; }
        { const R = this.w.L25ORD; if (R.size > 2000000) R.clear(); R.add(l25OrdKey(mm.fo, ckey(m.hole), mm.foAt, to)); }
        this.emit(to, mm); return;   // L25.7
      }
      if ((m.t === 'HELLO' || m.t === 'CLAIM') && m.id === id && m.mpK === 0 && this.mpK > 0 && this.hasCoord && m.ck === this.mpCk && m.ck === ckey(this.coord)) { const mm = msg.clone(m); mm.mpK = this.mpK; mm.mpBy = this.mpBy; mm.mpAt = this.mpAt; mm.mpL = this.mpL; mm.mpOld = this.mpOld; this.emit(to, mm); return; }   // L25.7
      // PP: my HELLO and CLAIM about the cell I was placed at carry my admitter's proof
      if ((m.t === 'HELLO' || m.t === 'CLAIM') && m.id === id && m.pp < 0 && this.pp >= 0 && m.ck === this.ppCk) { const mm = msg.clone(m); mm.pp = this.pp; mm.ppAt = this.ppAt; mm.ppL = this.ppL; this.emit(to, mm); return; }
      if (m.t === 'PONG' && m.tag === 7 && m.id === id && m.pp < 0 && this.pp >= 0 && ckey(m.coord) === this.ppCk) { const mm = msg.clone(m); mm.pp = this.pp; mm.ppAt = this.ppAt; mm.ppL = this.ppL; this.emit(to, mm); return; }
      if (this.farStampNeed(m)) { const mm = msg.clone(m); this.farStamp(mm); this.emit(to, mm); return; }   // FARVIEW
      if (lv.TIERS_ACTIVE) {   // L4.1
        if (m.t === 'FIND' && m.nc !== id) { if (m.nc === this.fcNc && (this.fcTier | this.fcNat | this.fcTh | m.th)) { const mm = msg.clone(m); mm.tier = this.fcTier & 0xff; mm.nat = this.fcNat & 0xff; mm.th = Math.max(this.fcTh, m.th) & 0xff; this.f.fabricSend(id, to, mm); return; } }
        else if (m.t === 'HELLO' && m.id === id && this.l4MarkUntil >= TICK && m.sw < 0) { const mm = msg.clone(m); mm.tier = this.ctier; mm.nat = this.cnat; mm.sw = this.l4Partner; mm.swCk = this.l4PartnerCk; mm.swHd = this.l4Head; mm.sig = true; mm.sigAt = TICK; this.f.fabricSend(id, to, mm); return; }
        else if ((m.id === id || m.id < 0) && (m.tier !== this.ctier || m.nat !== this.cnat)) { const mm = msg.clone(m); mm.tier = this.ctier; mm.nat = this.cnat; this.f.fabricSend(id, to, mm); return; }
      }
      this.f.fabricSend(id, to, m);
    },

    // C++: mesh.cpp:Seat::emitRelay
    emitRelay(presentedKey, blob = true) { this.f.relayKnock(this.id, presentedKey, blob); },

    // C++: mesh.cpp:Seat::l14Serve
    // L23: the head x named me its uplink in its offer
    l14Serve(x) { if (x < 0 || !this.l14Served.has(x)) return false; const ls = this.f.fabricLinkState(this.id, x); return ls === LS_OPEN || ls === LS_DIALING; },
  });

  Seat.free = (fns) => { for (const k of Object.keys(fns)) { if (k in FREE) throw new Error('mesh seat: free function ' + k + ' defined twice'); FREE[k] = fns[k]; } };

  const api = { Seat, FABRIC_CALLS, stubFabric, newWorld, WORLD, FREE, placeBefore, l13Frame, signedBy, deathWhy, islandStand, roomTerm, l13MergingOf, l13MassOf, l25OrdKey, ppSigOf, ppKey, l165Earlier };
  GifOS.meshSeat = api;
  if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
