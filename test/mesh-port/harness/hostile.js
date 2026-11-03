'use strict';
/*
 * hostile.js: THE HOSTILE PAGE (port plan H3), a line-for-line port of the sim's mesh_hostile.inc: the seat
 * side (Seat.hostileTick, Seat.hostileRecv: a malicious page that sends any frame and ignores any law) and
 * (hostileRecv is js/mesh/seat-rest.js) and the fabric side (the `hostile` verb: hostileMark, hostileReport, hostileMedia, and hostileTickF, the
 * per-tick measurement). Harness code, never shipped: a hostile page is the adversary of the sim.
 *
 *   hostile <frac> <mode> [any|s1|head]   mark max(1,frac*N) seated seats (or, with where, Section-1 seats / deep row heads first)
 *   hostile report                        one HOSTSTAT line over the HONEST seats
 *
 * The seat side reads other seats and the fabric, so it reaches them through its world: `this.w.fab`
 * (set by install). The link layer (linkSchedule, linkGet, startDial, closeFrom, l23Refused, the LINKS table,
 * lEnsure / LINKPEERS, l18Role, l22Need, pcBudget) is H2's and is reached through fab.X: unplugged, the call
 * throws "not wired". The realcheck scope (`RcFabric rcf_`) is a measurement and is not ported.
 * Off (no `hostile` verb) nothing here runs: no frame, no draw, no state.
 */
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const C_ = require(path.join(M, 'consts.js'));
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));
const hash = require(path.join(M, 'hash.js'));
const rng = require(path.join(M, 'rng.js'));
const seatM = require(path.join(M, 'seat.js'));
const { Seat } = seatM;
const { sprintf } = require('./cprintf.js');

const K = C_.consts, E = C_.enums;
const { ckey, unckey, ownedLinks, down, C } = topo;
const MT = new Map(msg.MT_NAMES.map((n, i) => [n, i]));
const { H_COLLUDE, H_VOTE, H_RINGLIE, H_HOLD, H_FLOOD, H_BYE, H_DIAL, H_TIER, H_HOLE, H_FORGE, H_MEDIA, H_FUZZ, H_REFLECT, H_BIG } = E;
const u32 = (x) => x >>> 0;
const atoi = (s) => (parseInt(s, 10) | 0) || 0;
const atof = (s) => { const v = parseFloat(s); return Number.isNaN(v) ? 0 : v; };
const cp = (c) => ({ pc: c.pc, r: c.r, i: c.i });

// The mt19937 a hostile page draws from. C++: mesh_hostile.inc:Seat::hostileTick (hostRng)
const seedOf = (lv, id) => hash.hmixId(u32(Math.imul(lv.SEED0 >>> 0, 31)), id);   // C++ hmixId((uint32_t)(SEED0*31u), id)

// C++: mesh_hostile.inc:hostPickHonest
function hostPickHonest(fab, g, not1) {
  const lv = fab.lv, seats = fab.seats, alive = fab.alive;
  for (let t = 0; t < 16; t++) {
    const x = g.next() % Math.max(1, lv.nextId);
    if (x !== not1 && alive[x] && !seats[x].hostile && seats[x].hasCoord && seats[x].state === 3) return x;
  }
  return -1;
}
// C++: mesh_hostile.inc:isHostile
const isHostile = (fab, q) => q >= 0 && q < fab.lv.nextId && !!fab.seats[q].hostile;
// C++: mesh_hostile.inc:hostDial
function hostDial(fab, me, x) {
  if (x < 0 || x === me || !fab.alive[x]) return;
  if (fab.X.l23Refused(x, me, 'HELLO')) return;
  const L = fab.X.linkGet(me, x);
  if (L.state === E.LK_NONE || L.state === E.LK_CLOSED) fab.X.startDial(me, x, L);
}
// C++: mesh_hostile.inc:hostCloseAll
function hostCloseAll(fab, me) {
  const v = [];
  for (const [key, L] of fab.link.LINKS) {   // LINKS: pair key -> Link, in table order
    const a = hash.pairA(key), b = hash.pairB(key);
    if (L.state === E.LK_OPEN && (a === me || b === me)) v.push(a === me ? b : a);
  }
  v.sort((a, b) => a - b);
  for (const x of v) { const L = fab.X.linkFind(me, x); if (L) fab.X.closeFrom(L, me, x, 'hostile-close'); }
}
// C++: mesh_hostile.inc:hostSend  (m is taken by value)
function hostSend(fab, me, to, m0) {
  const lv = fab.lv; const m = msg.clone(m0);
  if (to < 0 || to === me || to >= lv.nextId || !fab.alive[to]) return;
  if (fab.seats[me].hostile & H_RINGLIE) m.line = K.RINGLIE_LINE;
  if (m.t === 'PLACED' ? m.l31By === me : m.id === me) { m.sig = true; m.sigAt = fab.w.TICK | 0; }
  else if (m.sig && !(m.t === 'PHONE' || m.t === 'PONG')) m.sig = false;
  if (m.t === 'WALK' && m.asker === me) m.id = me;
  m.direct = true; fab.X.linkSchedule(me, to, m);
}
// C++: mesh_hostile.inc:hostAnyCell
function hostAnyCell(fab, g) {
  const lv = fab.lv;
  const x = g.next() % Math.max(1, lv.nextId);
  if (x < lv.nextId && fab.alive[x] && fab.seats[x].hasCoord) return ckey(fab.seats[x].coord);
  const r = g.next() % C; const i = g.next() % C;
  return ckey({ pc: 0, r, i });
}
// C++: mesh_hostile.inc:hostFuzz
function hostFuzz(fab, s, g) {
  const lv = fab.lv; const NT = MT.get('WITNESS') + 1;
  const m = msg.newMsg(msg.MT_NAMES[g.next() % NT]);
  { const only = process.env.HOSTILE_FUZZ_T; if (only) m.t = msg.MT_NAMES[atoi(only)]; }
  const t_ = fab.w.TICK;
  const pid = () => { switch (g.next() % 5) { case 0: return -1; case 1: return s.id; default: { return (g.next() % Math.max(1, lv.nextId)) | 0; } } };
  m.id = pid(); m.owner = pid(); m.nc = pid(); m.asker = pid(); m.via = pid(); m.child = pid();
  m.ttl = ((g.next() % 70) | 0) - 2; m.tag = (g.next() % 14) | 0; m.hold = (g.next() % 5) | 0;
  m.ck = hostAnyCell(fab, g); m.oCk = hostAnyCell(fab, g); m.mvd = (g.next() % 3) ? 0 : hostAnyCell(fab, g);
  m.coord = unckey(hostAnyCell(fab, g)); m.target = unckey(hostAnyCell(fab, g)); m.hole = unckey(hostAnyCell(fab, g));
  m.kids = !!(g.next() % 2); m.mass = !!(g.next() % 2); m.mv = !!(g.next() % 2); m.knock = !!(g.next() % 2); m.gwc = !!(g.next() % 2);
  m.l31 = g.next() % 7; m.l31By = pid(); m.l31At = t_ | 0; m.wordHeld = !!(g.next() % 2); m.spread = !!(g.next() % 2); m.dk = !!(g.next() % 2);
  const nl = (g.next() % 4) | 0;
  for (let q = 0; q < nl; q++) {
    m.byes.push(hostAnyCell(fab, g)); { const a = hostAnyCell(fab, g); const b = pid(); m.nbrs.push({ k: a, v: b }); }
    m.list.push(pid() >= 0 ? pid() : 0);   // (pid() is drawn twice when the first is >= 0: as in C++)
  }
  if (g.next() % 4 === 0) { m.routing = true; m.rdst = unckey(hostAnyCell(fab, g)); m.rfinal = pid(); m.rttl = (g.next() % 64) | 0; m.rvia = s.id; }
  m.sig = (m.id === s.id); m.sigAt = fab.w.TICK | 0; m.fsig = (m.nc === s.id);
  const to = hostPickHonest(fab, g, s.id); if (to >= 0) hostSend(fab, s.id, to, m);
}

Seat.unit('mesh_hostile.inc seat side', {
  // C++: mesh_hostile.inc:Seat::hostileTick
  hostileTick() {
    const fab = this.w.fab, lv = fab.lv, seats = fab.seats, alive = fab.alive; const id = this.id;
    fab.wake(id);
    if (!this.hostRng) this.hostRng = rng.mt19937(seedOf(lv, id));
    const g = this.hostRng; const h = this.hostile; const t = fab.w.TICK;
    const nb = [];
    if (this.hasCoord) { const ol = ownedLinks(this.coord); for (let k = 0; k < ol.length; k++) { const x = this.occGet(ckey(ol[k])); if (x >= 0 && x !== id) nb.push(x); } }
    const send = (to, m) => hostSend(fab, id, to, m);
    const mk = (tn) => msg.newMsg(tn);
    if (h & H_HOLD) { if (t % 16 === 0) for (let q = 0; q < 3; q++) { const x = hostPickHonest(fab, g, id); if (x >= 0) { hostDial(fab, id, x); this.hostHeld.add(x); } } }
    if (h & H_DIAL) {   // false reasons: its word gives an honest seat a role for the pc
      if (t % 4 === 0) for (let q = 0; q < 8; q++) { const x = hostPickHonest(fab, g, id); if (x >= 0) { hostDial(fab, id, x); this.hostHeld.add(x); } }
      if (t % 16 === 0 && this.hasCoord) for (const x of this.hostHeld) {
        if (x < 0 || x >= lv.nextId || !alive[x] || !seats[x].hasCoord) continue;
        const vc = cp(seats[x].coord); const nbr = cp(vc); nbr.i = (vc.i + 1) % C;
        const a = mk('HELLO'); a.id = id; a.ck = (g.next() % 2) ? ckey(nbr) : ckey(vc); a.coord = unckey(a.ck); send(x, a);
        const c = mk('MEET'); c.id = id; c.ck = ckey(nbr); c.oCk = ckey(vc); c.owner = x; c.mass = false; send(x, c);
      }
    }
    if (h & H_FLOOD) {
      if (this.hostTgt < 0 || !alive[this.hostTgt] || !seats[this.hostTgt].hasCoord || seats[this.hostTgt].coord.pc !== 0)
        for (let q = 0; q < lv.nextId; q++) { const y = (id + q * 7 + 1) % lv.nextId; if (alive[y] && !seats[y].hostile && seats[y].hasCoord && seats[y].coord.pc === 0) { this.hostTgt = y; break; } }
      for (let q = 0; q < 100; q++) {
        const x = (q % 10) ? this.hostTgt : hostPickHonest(fab, g, id); if (x < 0) break;
        const m = mk('FIND'); if (q % 3 === 1) { m.fsig = false; }
        if (q % 2) { m.t = 'FIND'; m.nc = (q % 4 === 1) ? id : ((g.next() % Math.max(1, lv.nextId)) | 0); m.fsig = (m.nc === id); m.ttl = K.FIND_TTL; m.tag = (q % 8 === 1) ? 1 : 0; m.id = id; m.owner = id; }
        else { m.t = 'WHOHOME'; m.id = id; m.gkey = lv.URL_KEY; m.knock = true; }
        send(x, m);
      }
    }
    if (h & H_BYE) {
      if (t % 8 === 0 && this.hasCoord) {
        for (const x of nb) {
          const m = mk('LEAVE'); m.ck = ckey(this.coord); m.id = id; m.kids = true; m.child = id; m.sig = true; m.sigAt = t | 0; send(x, m);
          for (const y of nb) if (y !== x && seats[y].hasCoord) { const f = mk('LEAVE'); f.ck = ckey(seats[y].coord); f.id = y; f.kids = true; send(x, f); }
        }
      }
      if (t % 24 === 4) hostCloseAll(fab, id);
      if (t % 24 === 12) for (const x of nb) hostDial(fab, id, x);
      if (t % 24 === 16 && this.hasCoord) for (const x of nb) { const m = mk('HELLO'); m.ck = ckey(this.coord); m.id = id; send(x, m); }
    }
    if (h & H_TIER) {
      if (t % 20 === 0) {
        this.ctier = (this.ctier === E.TIER_MOBILE) ? E.TIER_DESKTOP : E.TIER_MOBILE; this.cnat = (g.next() % 3) | 0;
        if (this.hasCoord) for (const x of nb) { const m = mk('HELLO'); m.ck = ckey(this.coord); m.id = id; m.tier = this.ctier; m.nat = this.cnat; send(x, m); }
      }
    }
    if ((h & H_FORGE) && t % 6 === 0 && this.hasCoord) {
      const v = hostPickHonest(fab, g, id);
      if (v >= 0) {
        const vc = cp(seats[v].coord); const to = nb.length === 0 ? hostPickHonest(fab, g, id) : nb[g.next() % nb.length]; const to2 = hostPickHonest(fab, g, id);
        const coord = this.coord;
        switch (Math.trunc(t / 6) % 14) {
          case 0: {
            const m = mk('HELLO'); m.ck = ckey(vc); m.id = id; m.sig = true; m.sigAt = t | 0; for (const y of [to, to2]) if (y >= 0) send(y, m);
            const o = msg.clone(m); o.mpK = 1; o.mpBy = seats[v].ppAdmitter(vc); o.mpAt = t | 0; if (o.mpBy < 0) o.mpBy = v; for (const y of [to, to2]) if (y >= 0) send(y, o);   // ...and its admitter ordered me there (an order it never signed: L25.7)
            const d = msg.clone(m); d.mpK = 2; d.mpOld = ckey(down(vc)); for (const y of [to, to2]) if (y >= 0) send(y, d); break;   // ...and I was its down-child (L25.7: my view must name me there)
          }
          case 1: { const m = mk('HELLO'); m.ck = ckey(coord); m.id = v; if (to >= 0) send(to, m); break; }   // v sits in my cell (its name, no signature)
          case 2: { const m = mk('CLAIM'); m.ck = ckey(vc); m.id = id; m.coord = cp(vc); if (to >= 0) send(to, m); break; }
          case 3: { const m = mk('YIELD'); m.ck = ckey(vc); m.id = id; m.nc = v; m.yp = true; m.sig = true; m.sigAt = t | 0; send(v, m); break; }   // yield your cell: my word, I am no arbiter
          case 4: { const m = mk('MOVED'); m.ck = ckey(vc); m.id = v; m.mvd = ckey(coord); if (to >= 0) send(to, m); break; }   // v moved (its name)
          case 5: { const m = mk('DRAIN'); m.ck = ckey(vc); m.id = id; m.coord = cp(coord); send(v, m); break; }
          case 6: { const m = mk('PLACE'); m.coord = cp(coord); m.owner = id; m.nc = v; m.pp = id; m.ppAt = t | 0; send(v, m); break; }   // an unasked placement into a cell I hold (the Q2 compaction path)
          case 7: {
            const m = mk('MEETACK'); m.id = id; m.ck = ckey(coord); m.oCk = ckey(vc); m.owner = -1; m.mass = true; m.byes.push(ckey(vc));
            for (let r = 0; r < C; r++) m.byes.push(ckey({ pc: vc.pc, r: vc.r, i: r })); send(v, m); if (to >= 0) send(to, m); break;   // the ring says your whole row left
          }
          case 8: { const m = mk('WALK'); m.target = cp(vc); m.asker = v; m.ttl = 16; m.via = id; if (to >= 0) send(to, m); break; }
          case 9: { const m = mk('SWAPGO'); m.id = id; m.ck = ckey(vc); m.coord = cp(vc); m.target = cp(coord); m.nc = v; send(v, m); break; }
          case 10: { const m = mk('S1SYNC'); m.id = id; m.ck = ckey(vc); m.coord = cp(vc); m.nbrs.push({ k: ckey(vc), v: id }); if (to >= 0) send(to, m); break; }
          case 11: {   // false digest counts
            const m = mk('PHONE'); m.id = id; m.coord = cp(coord);
            m.dgUp.n = 1000000; m.dgUp.at = t | 0; m.dgUp.by = id; m.dgRoot.n = 1000000; m.dgRoot.at = t | 0; m.dgRoot.by = id; m.dgPub.n = 1000000; m.dgPub.at = t | 0; m.dgPub.by = id;
            for (const y of nb) send(y, m); break;
          }
          case 12: { const m = mk('LEAVE'); m.ck = ckey(vc); m.id = v; if (to >= 0) send(to, m); break; }   // an unsigned goodbye in v's name
          case 13: { const m = mk('SITXFER'); m.id = id; m.ck = ckey(vc); m.coord = cp(vc); m.owner = id; if (to >= 0) send(to, m); break; }
        }
      }
      for (let k = 0; k < this.hostRec.length && k < 4; k++) {
        const r = msg.clone(this.hostRec[k]); this.hostRec.shift(); const y = hostPickHonest(fab, g, id);
        if (y >= 0) { r.routing = false; send(y, r); }   // replay: a captured signed frame, its signature intact
      }
    }
    if (h & H_FUZZ) for (let q = 0; q < 4; q++) hostFuzz(fab, this, g);
    if ((h & H_REFLECT) && t % 2 === 0) {
      const v = hostPickHonest(fab, g, id); const to = hostPickHonest(fab, g, id);
      if (v >= 0 && to >= 0) {
        const wk = mk('WALK'); wk.target = cp(seats[to].coord); wk.asker = v; wk.ttl = 16; wk.via = id; send(to, wk);
        const r = mk('ROUTE'); r.target = cp(seats[to].coord); r.tag = 1; r.asker = v; r.via = v; r.ttl = 64; r.id = id; send(to, r);
        const k = mk('RECLAIM'); k.ck = ckey(seats[to].coord); k.id = id; k.tok = require(path.join(M, 'seat.js')).FREE.fabricToken(lv, id); send(v, k);
      }
    }
    if ((h & H_COLLUDE) && t % 12 === 0 && this.hasCoord) {   // collusion: I (an arbiter) name a fellow hostile page as the rival of each honest seat beside me; it confirms
      let mate = -1; for (let q = 0; q < lv.nextId; q++) { const y = (id + 1 + q) % lv.nextId; if (y !== id && alive[y] && (seats[y].hostile & H_COLLUDE)) { mate = y; break; } }
      if (mate >= 0) for (const x of nb) {
        if (isHostile(fab, x) || !seats[x].hasCoord) continue;
        const y = mk('YIELD'); y.ck = ckey(seats[x].coord); y.id = id; y.nc = mate; y.pp = id; y.ppAt = (t | 0) - 500; y.yp = true; y.sig = true; y.sigAt = t | 0; send(x, y);
      }
    }
    if ((h & H_VOTE) && t % 40 === 0) {   // vote forging (L27's kevil kinds): a new honest target every 20 s; forged votes must never act
      const v = hostPickHonest(fab, g, id);
      if (v >= 0) { this.kEvilT = v; if (this.kEvil === 2) { this.kyes = [v]; this.kver = Math.max(this.kver + 1, (fab.w.TICK | 0) + 1); } }
    }
    if ((h & H_BIG) && t % 8 === 0) {
      const to = hostPickHonest(fab, g, id);
      if (to >= 0) { const m = mk('MEETACK'); m.id = id; m.ck = ckey(this.coord); m.oCk = ckey(seats[to].coord); for (let q = 0; q < 20000; q++) m.byes.push(hostAnyCell(fab, g)); send(to, m); }
    }
  },

  // hostileRecv is js/mesh/seat-rest.js (C++: mesh_hostile.inc:Seat::hostileRecv); it reaches this file's hostSend and
  // hostPickHonest through the world (w.hostSend, w.hostPickHonest, w.seats, w.alive, w.nextId), set by install().
});

function install(fab) {
  const lv = fab.lv, seats = fab.seats, alive = fab.alive, w = fab.w;
  const P = (f, ...a) => fab.printf(f, ...a);
  w.fab = fab;
  // the hooks seat-rest.js's hostileRecv reads (C++: hostSend, hostPickHonest, seats, alive, nextId)
  w.seats = seats; w.alive = alive; Object.defineProperty(w, 'nextId', { get: () => lv.nextId, configurable: true });
  w.hostSend = (from, to, m) => hostSend(fab, from, to, m);
  w.hostPickHonest = (g, not1) => hostPickHonest(fab, g, not1);
  const H = fab.hostile = { HM_PCMAX: [0, 0], HM_PCAT: [0, 0], HM_PCSEAT: [-1, -1], HM_RUN: [], HM_LASTIN: [], HM_R1: [] };
  const coordStr = fab.coordStr;

  // C++: mesh_hostile.inc:hostileMark
  function hostileMark(frac, mode, where) {
    let mask = 0;
    if (mode === 'hold') mask = H_HOLD; else if (mode === 'flood') mask = H_FLOOD; else if (mode === 'bye') mask = H_BYE; else if (mode === 'dial') mask = H_DIAL; else if (mode === 'tier') mask = H_TIER;
    else if (mode === 'hole') mask = H_HOLE; else if (mode === 'forge') mask = H_FORGE; else if (mode === 'media') mask = H_MEDIA; else if (mode === 'fuzz') mask = H_FUZZ; else if (mode === 'reflect') mask = H_REFLECT;
    else if (mode === 'big') mask = H_BIG; else if (mode === 'collude') mask = H_COLLUDE;
    else if (mode === 'vote') mask = H_VOTE; else if (mode === 'ringlie') mask = H_RINGLIE | H_FORGE | H_DIAL; else if (mode === 'mix') mask = -1;   // ringlie: forge and dial, every frame stamped with a foreign lineage (L8.38)
    const ids = []; for (let q = 0; q < lv.nextId; q++) if (alive[q] && seats[q].state === 3 && seats[q].hasCoord) ids.push(q);
    const rank = (q) => { const c = seats[q].coord; if (where === 's1') return c.pc === 0 ? 0 : 1; if (where === 'head') return (c.pc !== 0 && c.i === 0) ? 0 : (c.pc === 0 ? 1 : 2); return 0; };
    ids.sort((a, b) => rank(a) - rank(b));   // stable_sort
    if (where === 'any') { const g = rng.mt19937(((lv.SEED0 >>> 0) ^ 0x686f7374) >>> 0); for (let i = ids.length; i > 1; i--) { const j = g.next() % i; const t = ids[i - 1]; ids[i - 1] = ids[j]; ids[j] = t; } }
    const ne = Math.max(1, Math.trunc(frac * lv.N + 0.5)); let done = 0; const MIX = [H_HOLD, H_FLOOD, H_BYE, H_DIAL, H_TIER, H_HOLE, H_FORGE, H_FUZZ, H_REFLECT];   // (not mode media: its harm is measured on its own)
    const KEVIL = [4, 9, 11, 13, 10, 2];   // inflate, minted, mintedself, backdate, equivocate, badsig (mesh.cpp `kevil`)
    for (const q of ids) {
      if (done >= ne) break; seats[q].hostile = mask < 0 ? MIX[done % 9] : mask;
      if (seats[q].hostile & H_TIER) { lv.L4_LIAR = true; fab.X.tierRefresh(); }
      if (seats[q].hostile & H_VOTE) {
        const s = seats[q]; s.kEvil = KEVIL[done % 6]; let v = -1;
        for (let k = 1; k < lv.nextId && v < 0; k++) { const y = (q + k) % lv.nextId; if (alive[y] && !seats[y].hostile && seats[y].state === 3 && seats[y].hasCoord) v = y; }
        s.kEvilT = v; if (s.kEvil === 2 && v >= 0) { s.kyes = [v]; s.kver = Math.max(s.kver + 1, (w.TICK | 0) + 1); }
      }
      fab.wake(q); done++;
    }
    lv.HOSTILE_N += done; lv.HOST_ON = true; lv.HOST_ANY = true; lv.HOST_T0 = w.TICK; lv.HOST_N0 = lv.nextId;
    H.HM_RUN = new Array(lv.nextId).fill(0); H.HM_LASTIN = new Array(lv.nextId).fill(-1); H.HM_R1 = new Array(lv.nextId).fill(0);
    if (mask > 0 && (mask & H_FLOOD)) {   // ...and as many joiners outside that ignore BUSY and every backoff (L16's adversary joiner)
      lv.HOST_OUT = ne;
      for (let q = 0; q < ne; q++) {
        const id = lv.nextId++; while (seats.length <= id) { seats.push(null); alive.push(0); }
        seats[id] = new Seat(id, w); alive[id] = 1; seats[id].evilDoor = true; seats[id].hostile = H_FLOOD; if (lv.NETGRP) fab.X.netSetGrp(id, 0); seats[id].join();
      }
      lv.HOST_N0 = lv.nextId;
    }
    P('OK hostile seats=%d mode=%s where=%s outside=%d\n', done, mode, where, lv.HOST_OUT);
  }

  // C++: mesh_hostile.inc:hostileTickF
  function hostileTickF() {
    if (!lv.HOST_ON) return;
    const n = lv.nextId;
    while (H.HM_RUN.length < n) { H.HM_RUN.push(0); H.HM_LASTIN.push(-1); H.HM_R1.push(0); }
    const pcs = new Array(n).fill(0), hpcs = new Array(n).fill(0); let held = 0;
    for (const [key, L] of fab.link.LINKS) {
      if (L.state !== E.LK_OPEN && L.state !== E.LK_DIALING) continue;
      const a = hash.pairA(key), b = hash.pairB(key); if (a >= n || b >= n) continue;
      if (alive[a]) { pcs[a]++; if (isHostile(fab, b)) hpcs[a]++; }
      if (alive[b]) { pcs[b]++; if (isHostile(fab, a)) hpcs[b]++; }
      for (let e = 0; e < 2; e++) {
        const me = e === 0 ? a : b, x = e === 0 ? b : a; if (!alive[me] || seats[me].hostile || !isHostile(fab, x)) continue;
        const t = L.nnAt[fab.X.lEnd(me, x)]; if (t < 0) continue;
        held++; if (w.TICK - t > lv.HM_HELDMAX) { lv.HM_HELDMAX = w.TICK - t; lv.HM_HELDSEAT = me; }
        const q = Math.min(w.TICK - t, w.TICK - L.txAt[fab.X.lEnd(x, me)]); if (q > lv.HM_IDLEMAX) lv.HM_IDLEMAX = q;
      }
    }
    lv.HM_HELDPCS = held;
    for (let s = 0; s < n; s++) {
      if (!alive[s] || seats[s].hostile) continue; const x = seats[s];
      if (!(x.state === 3 && x.hasCoord)) { H.HM_RUN[s] = 0; continue; }
      const cl = x.coord.pc === 0 ? 0 : 1; const bound = (cl === 0 ? fab.X.pcBudget(s, E.PB_S1) : (1 << 30));   /* information only: a Section-1 seat's total is L16.10's, doors included */
      if (pcs[s] > H.HM_PCMAX[cl]) { H.HM_PCMAX[cl] = pcs[s]; H.HM_PCAT[cl] = w.TICK; H.HM_PCSEAT[cl] = s; }
      if (pcs[s] > bound && hpcs[s] > 0) { lv.HM_OVER++; H.HM_RUN[s]++; if (H.HM_RUN[s] > lv.HM_OVERRUN) lv.HM_OVERRUN = H.HM_RUN[s]; } else H.HM_RUN[s] = 0;
      if (H.HM_LASTIN[s] >= 0) { const d = x.framesIn - H.HM_LASTIN[s]; const f = (d + H.HM_R1[s]); if (f * 1 > lv.HM_FPSMAX) { lv.HM_FPSMAX = f; lv.HM_FPSSEAT = s; } H.HM_R1[s] = d | 0; }
      H.HM_LASTIN[s] = x.framesIn;
    }
  }

  // C++: mesh_hostile.inc:hostileReport
  function hostileReport() {
    const at = new Map(); let honest = 0, seated = 0, dups = 0, hseated = 0, news = 0, newOut = 0;
    for (let q = 0; q < lv.nextId; q++) {
      if (!alive[q]) continue; const s = seats[q];
      if (s.hostile) { if (s.state === 3 && s.hasCoord) hseated++; continue; }
      honest++; if (q >= lv.HOST_N0) news++;
      if (s.state === 3 && s.hasCoord) { seated++; if (at.has(ckey(s.coord))) dups++; at.set(ckey(s.coord), q); } else if (q >= lv.HOST_N0) newOut++;
    }
    let nmax = 0; for (let q = lv.HOST_N0; q < lv.nextId; q++) { if (!alive[q] || seats[q].hostile) continue; if (q < fab.FIRSTSEAT.length && fab.FIRSTSEAT[q] >= 0 && q < fab.SPAWNT.length && fab.SPAWNT[q] >= 0) nmax = Math.max(nmax, fab.FIRSTSEAT[q] - fab.SPAWNT[q]); }
    let shown = 0; for (let q = 0; q < lv.nextId; q++) if (alive[q] && !seats[q].hostile && seats[q].hasCoord) shown = Math.max(shown, seats[q].rootDig.n);
    let vb = 0; for (let q = 0; q < lv.nextId; q++) { if (!alive[q] || seats[q].hostile) continue; for (const [k] of seats[q].vban) if (k >= 0 && k < lv.nextId && alive[k] && !seats[k].hostile) vb++; }   // honest seats banning honest seats: a forged vote that acted
    P('HOSTFRAMES big=%lld relayOnly=%lld l24drop=%lld l26refused=%lld l25twice=%lld l23closed=%lld l23refused=%lld voteBans=%lld\n', lv.HM_BIG_TAKEN, lv.HM_RELAY, lv.L24_DROP, lv.L26_REFUSED, lv.L25_TWICE, lv.L23_CLOSED, lv.L23_REFUSED, vb);
    P('HOSTSTAT tick=%lld hostile=%d honest=%lld seated=%lld unseated=%lld dups=%lld hostileSeated=%lld news=%lld newOut=%lld newMax=%lld pcS1=%lld@%lld pcDeep=%lld@%lld pcOver=%lld pcOverRun=%lld heldMax=%lld heldIdleMax=%lld heldSeat=%d heldNow=%lld fpsMax=%lld fpsSeat=%d shownMax=%lld moves=%lld evict=%lld bigTaken=%lld\n',
      w.TICK - lv.HOST_T0, lv.HOSTILE_N, honest, seated, honest - seated, dups, hseated, news, newOut, nmax, H.HM_PCMAX[0], H.HM_PCAT[0] - lv.HOST_T0, H.HM_PCMAX[1], H.HM_PCAT[1] - lv.HOST_T0, lv.HM_OVER, lv.HM_OVERRUN, lv.HM_HELDMAX, lv.HM_IDLEMAX, lv.HM_HELDSEAT, lv.HM_HELDPCS, lv.HM_FPSMAX, lv.HM_FPSSEAT, shown, lv.MOVES, lv.EVICTIONS, lv.HM_BIG_TAKEN);
  }

  // C++: mesh_hostile.inc:mgapSkip
  const mgapSkip = (s) => lv.HOST_ON && (seats[s].hostile || s >= lv.HOST_N0);   // (a newcomer is judged by its join time, not as a stayer)

  // hostile media on|report: the feed model (mesh_media.inc) over the honest seats: two stage feeds (a Section-1 seat, a deep seat) and every row's stadium.
  // C++: mesh_hostile.inc:hostileMedia
  function hostileMedia(wd) {
    const X = fab.X;
    if (wd === 'on') {
      X.mstageClear(); let deep = -1, top = -1;
      for (let q = 0; q < lv.nextId; q++) if (alive[q] && !seats[q].hostile && seats[q].hasCoord && seats[q].state === 3) { if (seats[q].coord.pc === 0 && top < 0) top = q; if (seats[q].coord.pc !== 0 && deep < 0) deep = q; }
      if (top >= 0) X.mstagePush(top); if (deep >= 0) X.mstagePush(deep);
      X.mediaSetup(); lv.MEDIA = true; X.mediaReset(); P('OK hostile media on feeds=%zu\n', X.mfeeds().length); return;
    }
    const sk = new Set(); for (let q = 0; q < lv.nextId; q++) if (seats[q].hostile) sk.add(q);
    const r = X.mediaReport(sk);
    const o = [0, 0, 0, 0], sd = [0, 0, 0]; const sm = new Map(), ss = new Map(); const whole = w.TICK - lv.MGAP_T0 - 1;
    for (const F of X.mfeeds()) for (const [id, e] of F.rx) if (!sk.has(id)) { const g = Math.max(e.maxGap, e.cur); if (F.stadium) ss.set(id, Math.max(ss.get(id) || 0, g)); else sm.set(id, Math.max(sm.get(id) || 0, g)); }
    for (const [, v] of sm) { if (v > 4) o[0]++; if (v > 40) o[1]++; if (v > 120) o[2]++; if (v >= whole) o[3]++; }
    for (const [, v] of ss) { if (v > 4) sd[0]++; if (v > 40) sd[1]++; if (v >= whole) sd[2]++; }
    P('MEDIAOUT stageMax=%lld stageP50=%lld stadMax=%lld stageSeats=%zu over2s=%lld over20s=%lld over60s=%lld wholeRun=%lld stadSeats=%zu stadOver2s=%lld stadOver20s=%lld stadWholeRun=%lld\n',
      r.stMax, r.stP50, r.sdMax, sm.size, o[0], o[1], o[2], o[3], ss.size, sd[0], sd[1], sd[2]);
  }

  // the `hostile` verb. C++: mesh.cpp:runOp
  function hostileVerb(tk) {
    if (tk.length > 1 && tk[1] === 'report') hostileReport();
    else if (tk.length > 2 && tk[1] === 'densify' && tk[2] === 'asked') fab.X.gaDenseAskOn();   // gapa-fab.js
    else if (tk.length > 2 && tk[1] === 'c7forge') fab.X.hostC7Forge(tk[2]);   // c7proof-fab.js
    else if (tk.length > 2 && tk[1] === 'c7report') fab.X.hostC7Report(Number(tk[2]));
    else if (tk.length > 1 && tk[1] === 'gapa') fab.X.gaReport();   // gapa-fab.js
    else if (tk.length > 1 && tk[1] === 'densify') fab.X.hostDensify();   // gaps3-fab.js
    else if (tk.length > 2 && tk[1] === 'media') hostileMedia(tk[2]);
    else hostileMark(tk.length > 1 ? atof(tk[1]) : 0.02, tk.length > 2 ? tk[2] : 'mix', tk.length > 3 ? tk[3] : 'any');
  }
  fab.plug({ hostileTickF, hostileVerb, hostileMark, hostileReport, hostileMedia, mgapSkip });
  return { hostileMark, hostileReport, hostileMedia, hostileTickF, mgapSkip };
}

module.exports = { install };
