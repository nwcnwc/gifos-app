#!/usr/bin/env node
'use strict';
// pclaws-check.js <driver binary> <work dir> [cases] [first seed]
// Differential check of the pc laws (js/mesh/pclaws.js, with the stand-in physics) against the sim's own (l0/pclaws-driver.cpp,
// built by l0/pclaws-build.sh from mesh.cpp and its includes). For each seed it makes a random script of dial / door / uplink /
// close ops and tick steps, runs it through the C++ driver and through the JS laws on real JS seats, and compares, byte for byte:
//   - the driver's line after every op: the counters, the WHOLE link table (every Link field), the law tables (DOORN, DOORK,
//     LDOORS, L16CLOSING, L16COOL, L23S, DOOR_PEND, the link event queue, TLDEB ...), the law counters, and what the op returned
//   - frames.jsonl (every push on the bus), hash.jsonl (the per-tick seat state hashes), the --trace file
// Exit 1 on the first difference.
//   PCLAWS_MUTANT=<name>   plant a fault in the JS laws (see MUTANTS) to show the check goes red.
const fs = require('fs'), path = require('path'), cp = require('child_process'), Module = require('module');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
if (process.env.PCLAWS_MUTANT) require('./pclaws-mutants.js').install(process.env.PCLAWS_MUTANT);   // a planted fault, for the mutation check
const { createFabric } = require('./fabric.js');
const { installPcLaws } = require('./pclaws-fab.js');
const seatM = require(path.join(M, 'seat.js'));
const { Seat } = seatM;
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));
const C_ = require(path.join(M, 'consts.js'));
const E = C_.enums;

// ---- the seat-side units: the merged tree's own js/mesh files (no git refs of unit branches) -------------------------------
function loadUnits() {
  const got = [];
  for (const f of fs.readdirSync(M).sort()) if (f.endsWith('.js')) { require(path.join(M, f)); got.push(f); }
  return got;
}
function standIns() {
  // (S8 liveness holds l2Around; route.js's nextHopToward calls it. u2Rows stays empty in these rooms, so its first loop never runs.)
  if (!('l2Around' in Seat.prototype)) Seat.unit('pclaws-check stand-in 2', {
    // C++: mesh_seat.inc:Seat::l2Around
    l2Around(t, exclude, servedOnly) {
      if (!this.hasCoord) return -1;
      const roles = require(path.join(M, 'roles.js'));
      const usable = (x) => x >= 0 && x !== this.id && x !== exclude && this.f.fabricLinkState(this.id, x) === E.LS_OPEN;
      const view = (c) => topo.ckey(c) === topo.ckey(this.coord) || this.occGet(topo.ckey(c)) >= 0;
      const inSubtree = (row, tt) => { if (tt.r !== row.r) return false; let pc = tt.pc; for (let g = 0; g < 32; g++) { if (pc === row.pc) return true; if (pc === 0) return false; pc = topo.parentPath(pc); } return false; };
      if (this.u2Rows.size) throw new Error('pclaws-check: u2Rows is not modelled in the l2Around stand-in');
      if (servedOnly) return -1;
      const crow = topo.down(this.coord);
      if (inSubtree(crow, t)) {
        let b = roles.backupOwnerOf(crow, view);
        if (b && topo.ckey(b) !== topo.ckey(this.coord)) {
          let x = this.occGet(topo.ckey(b)); if (usable(x)) return x;
          if (x >= 0 && (this.f.fabricLinkState(this.id, x) === E.LS_CLOSED || this.translost.has(topo.ckey(b)))) { b = roles.standbyOf(crow, view); if (b && topo.ckey(b) !== topo.ckey(this.coord)) { x = this.occGet(topo.ckey(b)); if (usable(x)) return x; } }
        }
      }
      return -1;
    },
  });
  return true;
}

// ---- the script generator --------------------------------------------------------------------------------------
function genScript(seed) {
  let s = (seed * 2654435761 + 12345) >>> 0;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (a) => a[ri(0, a.length - 1)];
  const L = [];
  L.push('lever SEED0 ' + ri(1, 1e9));
  L.push('lever LINKMODEL 1'); L.push('lever FHOP_ON 0');   // friend-hop (H4) is off: its sponsor path is not under test
  const starFirst = r() < 0.12; L.push('lever DOORCAP ' + (starFirst ? 2 : pick([2, 3, 4, 8, 96]))); L.push('lever L16_RESERVE ' + (starFirst ? 0 : pick([0, 1, 2])));
  L.push('lever DOORCAP_MOBILE ' + pick([2, 3, 64])); L.push('lever L16_RESERVE_MOBILE ' + pick([0, 1, 8])); L.push('lever L16_MOB_RATE ' + pick([0, 1, 2]));
  L.push('lever L15_SETTLE ' + pick([0, 2, 4]));
  if (r() < 0.3) L.push('lever TIERMIX ' + pick([0.3, 0.6])); if (r() < 0.2) L.push('lever LMOBILE ' + pick([0.3, 0.7]));
  if (r() < 0.4) { L.push('lever NUM_SUBNETS ' + ri(1, 3)); L.push('lever NET_LOSS ' + pick([0, 0.1, 0.3])); L.push('lever NET_LAT ' + ri(1, 4)); L.push('lever NET_SEVER ' + pick([0, 0.05])); L.push('lever NET_QUAL_MIN ' + pick([1, 0.6])); L.push('lever REACH_DENSITY ' + pick([0.5, 1])); }
  const star = starFirst; const N = star ? ri(13, 16) : ri(6, 16);
  L.push('init ' + N + ' 0');
  for (let q = 0; q < N; q++) L.push('mk ' + q);
  // seats 0..G-1 are Section-1 greeters (seated, pc 0), the next D are deep seated, the rest start outside
  const G = Math.min(N - 2, ri(2, 5)), D = ri(0, Math.min(3, N - G - 1));
  const seated = new Set();
  let t = 40;
  L.push('tick ' + t);
  const cxy = new Map();
  const seat = (id, pc, rr, ii) => { cxy.set(id, [pc, rr, ii]); L.push('setc ' + id + ' 3 ' + pc + ' ' + rr + ' ' + ii); L.push('seatedat ' + id + ' ' + ri(0, 30)); seated.add(id); };
  for (let q = 0; q < G; q++) seat(q, 0, q % 5, ri(0, 4));
  for (let q = G; q < G + D; q++) seat(q, ri(1, 3), ri(0, 4), ri(0, 4));
  for (let q = 0; q < G + D; q++) { for (let k = 0; k < 2; k++) { const o = ri(0, G + D - 1); if (o === q) continue; const c = (k ? [ri(0, 3), ri(0, 4), ri(0, 4)] : [0, ri(0, 4), ri(0, 4)]); L.push('occ ' + q + ' ' + c.join(' ') + ' ' + o); } }
  for (let q = 0; q < N; q++) if (r() < 0.25) L.push('ctier ' + q + ' ' + pick([0, 1, 1]));
  const ids = () => ri(0, N - 1);
  const pair = () => { const a = ids(); let b = ids(); if (b === a) b = (a + 1) % N; return [a, b]; };
  const mts = ['WHOHOME', 'HOME', 'FIND', 'FINDACK', 'PLACE', 'NOROOM', 'HANDOFF', 'TAKEN', 'HELLO', 'CLAIM', 'MEET', 'MEETACK', 'YIELD', 'LEAVE', 'PHONE', 'UNNEEDED', 'S1SYNC', 'U2BEAT'];
  const ckCell = () => ri(0, 4) * 256 + ri(0, 4);   // a cell of the home section (pc 0) as a cell key
  const greeters = []; for (let q = 0; q < G; q++) greeters.push(q);
  const stories = [
    () => {   // a joiner dials a greeter, the door carries the join, the joiner sits beside a seat it holds a pc with (L15 retires the door)
      const outs = []; for (let q = G + D; q < N; q++) outs.push(q); if (!outs.length) return;
      const j = pick(outs), g = pick(greeters), x = pick(greeters.filter((v) => v !== g)); if (x === undefined) return;
      t += ri(1, 3); L.push('ltick ' + t); L.push('dial ' + j + ' ' + g); t += 9; L.push('ltick ' + t);
      L.push('callframe ' + j + ' ' + g + ' WHOHOME'); L.push('callframe ' + g + ' ' + j + ' HOME'); t += 3; L.push('ltick ' + t);
      if (r() < 0.5) { L.push('callframe ' + j + ' ' + g + ' FIND'); L.push('callframe ' + g + ' ' + j + ' FINDACK'); t += 2; L.push('ltick ' + t); L.push('doorhanded ' + g + ' ' + j); }
      const rr = ri(0, 4), ii = ri(1, 4), i2 = (ii % 4) + 1; cxy.set(j, [0, rr, ii]);
      L.push('setc ' + j + ' 3 0 ' + rr + ' ' + ii); L.push('seatedat ' + j + ' 0'); L.push('occ ' + j + ' 0 ' + rr + ' ' + i2 + ' ' + x); L.push('lopen ' + j + ' ' + x);
      if (r() < 0.5) L.push('doorheard ' + g + ' ' + j + ' ' + ri(0, 4)); if (r() < 0.3) L.push('doordrop ' + j + ' ' + g);
      for (let q = 0; q < ri(1, 4); q++) { t += ri(2, 9); L.push('ltick ' + t); }
    },
    () => {   // the L22 close handshake with held frames, the timeout and a re-dial
      const a = pick(greeters), b = pick(greeters.filter((v) => v !== a)); if (b === undefined) return;
      L.push('lopen ' + a + ' ' + b); t += 2; L.push('ltick ' + t); if (r() < 0.6) L.push('l22closeask ' + a + ' ' + b); else L.push('l22agree ' + b + ' ' + a);
      L.push('callframe ' + a + ' ' + b + ' ' + pick(['PHONE', 'HELLO', 'S1SYNC', 'FIND'])); L.push('callframe ' + a + ' ' + b + ' MEET');
      if (r() < 0.4) L.push('l22closeask ' + b + ' ' + a);
      for (let q = 0; q < ri(2, 6); q++) { t += ri(3, 9); L.push('ltick ' + t); }
    },
    () => {   // a keep as the only reason, and the keep reply
      const a = pick(greeters), b = pick(greeters.filter((v) => v !== a)); if (b === undefined) return;
      L.push('lopen ' + a + ' ' + b); L.push('keep ' + a + ' ' + b + ' 80'); t += 3; L.push('ltick ' + t); L.push('l28reply ' + a + ' ' + b); L.push('l28reply ' + b + ' ' + a); L.push('need ' + a + ' ' + b);
    },
    () => {   // a heal's greeting from a cell beside me (L23's neighbour exception), with its word / work records
      const a = pick(greeters), b = ids(); if (a === b) return; const mt = pick(['HELLO', 'CLAIM']);
      L.push('l23ref ' + a + ' ' + b + ' ' + mt + ' ' + ckCell()); L.push('callframe ' + b + ' ' + a + ' ' + mt + ' ck=' + ckCell());
      if (r() < 0.5) L.push('word ' + a + ' ' + b + ' ' + ri(Math.max(0, t - 60), t)); if (r() < 0.4) L.push('work ' + a + ' ' + b + ' ' + ri(16, 30) + ' ' + t);
      if (r() < 0.4) L.push('bare ' + a + ' 0 ' + ri(0, 4) + ' ' + ri(0, 4) + ' ' + ri(Math.max(0, t - 120), t)); L.push('need ' + a + ' ' + b); L.push('l23ref ' + a + ' ' + b + ' ' + mt + ' ' + ckCell());
    },
    () => {   // a seated seat dials a seated seat: an island of pcs around a greeter (the pc budget, L16.11)
      const g = pick(greeters); for (let q = 0; q < ri(2, 6); q++) { const d = ids(); if (d !== g) L.push('dial ' + d + ' ' + g); } t += 8; L.push('ltick ' + t);
      for (let q = 0; q < ri(1, 3); q++) { const d = ids(); if (d !== g) { L.push('dial ' + g + ' ' + d); L.push('dialjoin ' + d + ' ' + g); } } t += 8; L.push('ltick ' + t);
    },
  ];
  if (star) {   // a greeter at its pc budget: every other seat is seated beside it and dials it, then two outsiders knock
    for (let q = 1; q < N - 2; q++) { const rr = ri(0, 4), ii = ri(0, 4); if (!cxy.has(q)) { cxy.set(q, [0, rr, ii]); L.push('setc ' + q + ' 3 0 ' + rr + ' ' + ii); L.push('seatedat ' + q + ' 0'); } }
    L.push('setc 0 3 0 0 0'); L.push('seatedat 0 0');
    for (let q = N - 2; q < N; q++) { L.push('dial ' + q + ' 0'); t += 1; L.push('ltick ' + t); }
    for (let q = 1; q < N - 2; q++) { L.push('dial ' + q + ' 0'); t += 2; L.push('ltick ' + t); }
    for (let q = 1; q < N - 2; q++) { L.push('dial 0 ' + q); L.push('lopen 0 ' + q); }
  }
  const nOps = ri(60, 200);
  for (let k = 0; k < nOps; k++) {
    if (r() < 0.06) { pick(stories)(); continue; }
    if (r() < 0.45) { t += ri(1, 7); L.push('ltick ' + t); continue; }
    const x = r(); const [a, b] = pair();
    if (x < 0.14) L.push('dial ' + a + ' ' + b);
    else if (x < 0.22) L.push('dialjoin ' + a + ' ' + b);
    else if (x < 0.27) L.push('dialup ' + a + ' ' + b);
    else if (x < 0.30) L.push('uptake ' + a + ' ' + b);
    else if (x < 0.32) L.push('updecline ' + a + ' ' + b + ' ' + ids() + ' ' + ids());
    else if (x < 0.40) { const f = []; if (r() < 0.2) f.push('gwc=1'); if (r() < 0.2) f.push('knock=1'); if (r() < 0.15) f.push('mv=1'); if (r() < 0.2) f.push('ck=' + ri(1, 99999)); L.push(['callframe', a, b, pick(mts), ...f].join(' ')); }
    else if (x < 0.46) L.push(['sched', a, b, pick(mts), pick([0, 1, 2]), ...(r() < 0.2 ? ['ck=' + ri(1, 99999)] : [])].join(' '));
    else if (x < 0.49) L.push('doordrop ' + a + ' ' + b);
    else if (x < 0.51) L.push('doorhanded ' + a + ' ' + b);
    else if (x < 0.53) L.push('doorheard ' + a + ' ' + b + ' ' + ri(0, 6));
    else if (x < 0.54) L.push('nosock ' + a + ' ' + b);
    else if (x < 0.58) L.push('lopen ' + a + ' ' + b);
    else if (x < 0.60) L.push('lclose ' + a + ' ' + b + ' ' + ri(0, 1));
    else if (x < 0.61) L.push('lhalf ' + a + ' ' + b + ' ' + pick([1, 2, 3]));
    else if (x < 0.62) L.push('lcrash ' + a);
    else if (x < 0.625) L.push('lleave ' + a);
    else if (x < 0.64) L.push('l22agree ' + a + ' ' + b);
    else if (x < 0.66) L.push('l22closeask ' + a + ' ' + b);
    else if (x < 0.68) L.push('l22note ' + a + ' ' + b);
    else if (x < 0.69) L.push('l28reply ' + a + ' ' + b);
    else if (x < 0.73) L.push('need ' + a + ' ' + b);
    else if (x < 0.75) L.push('lstate ' + a + ' ' + b);
    else if (x < 0.77) L.push('budget ' + a + ' ' + pick([0, 1, 2, 3]));
    else if (x < 0.80) L.push('l18route ' + a + ' ' + b);
    else if (x < 0.81) L.push('l18cell ' + a + ' ' + b);
    else if (x < 0.82) L.push('l18deliv ' + ri(0, 16));
    else if (x < 0.86) L.push('refuse ' + a + ' ' + b + ' ' + pick(mts));
    else if (x < 0.88) L.push('l23ref ' + a + ' ' + b + ' ' + pick(mts) + ' ' + pick([0, ri(1, 99999)]));
    else if (x < 0.89) L.push('full ' + a);
    else if (x < 0.90) L.push('keep ' + a + ' ' + b + ' ' + ri(1, 60));
    else if (x < 0.91) L.push('l22cell ' + a + ' ' + b + ' ' + ri(0, 3) + ' ' + ri(0, 4) + ' ' + ri(0, 4) + ' ' + ri(Math.max(0, t - 60), t));
    else if (x < 0.92) L.push('rival ' + a + ' ' + b + ' ' + ri(Math.max(0, t - 60), t));
    else if (x < 0.93) L.push('callin ' + a + ' ' + b);
    else if (x < 0.94) L.push('callout ' + a + ' ' + b);
    else if (x < 0.95) L.push('dialfail ' + a + ' ' + b + ' ' + ri(0, 1));
    else if (x < 0.955) L.push('dialgone ' + a + ' ' + b);
    else if (x < 0.96) L.push('dialheard ' + a + ' ' + b);
    else if (x < 0.965) L.push('word ' + a + ' ' + b + ' ' + ri(Math.max(0, t - 200), t));
    else if (x < 0.97) L.push('work ' + a + ' ' + b + ' ' + ri(0, 30) + ' ' + ri(Math.max(0, t - 60), t));
    else if (x < 0.975) L.push('bare ' + a + ' ' + ri(0, 3) + ' ' + ri(0, 4) + ' ' + ri(0, 4) + ' ' + ri(Math.max(0, t - 80), t));
    else if (x < 0.98) L.push('relmark ' + a + ' ' + b + ' ' + ri(Math.max(0, t - 100), t));
    else if (x < 0.985) L.push('uplinkof ' + a + ' ' + (r() < 0.7 ? b : -1));
    else if (x < 0.99) L.push('moving ' + a + ' ' + ri(0, 1));
    else if (x < 0.995) { if (!seated.has(a) || r() < 0.3) { seated.add(a); L.push('setc ' + a + ' ' + pick([0, 3, 3]) + ' ' + pick([0, 0, 1, 2]) + ' ' + ri(0, 4) + ' ' + ri(0, 4)); L.push('seatedat ' + a + ' ' + ri(0, t)); } }
    else L.push('end');
  }
  L.push('ltick ' + (t + 5)); L.push('ltick ' + (t + 40)); L.push('ltick ' + (t + 200)); L.push('end');
  return L.join('\n') + '\n';
}

// ---- the JS twin of the driver -----------------------------------------------------------------------------------
function runJs(script, dir) {
  const fab = createFabric({ proofDir: path.join(dir, 'js'), traceFile: path.join(dir, 'js.trace') });
  const { pc, phys } = installPcLaws(fab);
  const { lv } = fab; const outLines = [];
  const D = (v) => String(typeof v === 'boolean' ? +v : v);
  const dump = () => {
    let s = ',"links":"';
    for (const [k, L] of phys.LINKS) {
      s += k + '|';
      const a = (v) => { s += D(v) + ','; };
      a(L.state); a(L.view[0]); a(L.view[1]); a(L.half); a(L.stuck); a(L.leverHalf); a(L.wasOpen); a(L.carried); a(L.epoch); a(L.openEp); a(L.dialAt); a(L.halfAt); a(L.askAt);
      a(L.txAt[0]); a(L.txAt[1]); a(L.nnAt[0]); a(L.nnAt[1]); a(L.nnAsk[0]); a(L.nnAsk[1]); a(L.arrAt[0]); a(L.arrAt[1]);
      s += 'q['; for (const m of L.q) s += fab.mtI(m.t) + '/' + m.from + '/' + m.to + ' '; s += '],';
      a(L.outside); a(L.dialBy); a(L.dialT); a(L.dialHow); a(L.callClosed); a(L.gone); a(L.agreed[0]); a(L.agreed[1]);
      for (let e = 0; e < 2; e++) { s += 'h['; for (const m of L.hold[e]) s += fab.mtI(m.t) + '/' + m.from + '/' + m.to + ' '; s += '],'; }
      a(L.closingAt[0]); a(L.closingAt[1]); a(L.farAsk[0]); a(L.farAsk[1]); a(L.uplink); a(L.dHeard); a(L.backAt[0]); a(L.backAt[1]); a(L.dBorn); a(L.dProg);
      a(L.dAsked); a(L.dHomed); a(L.dGw); a(L.dIn); a(L.dSat); a(L.dHoAt); a(L.dWait); a(L.dOwed); a(L.dWaitAtFind); a(L.dOwedAt); s += ';';
    }
    s += '","peers":"'; phys.LINKPEERS.forEach((p, i) => { s += i + ':'; for (const v of p) s += v + ','; s += ';'; });
    const S = pc.S;
    s += '","doorn":"'; for (const v of S.DOORN) s += v + ','; s += '","doork":"'; for (const v of S.DOORK) s += v + ',';
    s += '","ldoors":"'; for (const k of [...S.LDOORS].sort((x, y) => x - y)) s += k + ',';
    s += '","closing":"'; for (const p of S.L16CLOSING) s += p[0] + ':' + p[1] + ',';
    s += '","cool":"'; for (const [k, c] of S.L16COOL) s += k + ':' + c[0] + ':' + c[1] + ',';
    s += '","l23s":"'; for (const [k, c] of S.L23S) s += k + ':' + c.until + ':' + c.last + ':' + c.n + ',';
    s += '","pend":"'; for (const p of S.DOOR_PEND) s += p.a + ':' + p.b + ':' + p.at + ',';
    s += '","levq":"'; for (const k of [...phys.LEVQ.keys()].sort((x, y) => x - y)) { s += k + '{'; for (const v of phys.LEVQ.get(k)) s += v.kind + '/' + v.a + '/' + v.b + '/' + v.epoch + '/' + v.why + '/' + v.ref + ' '; s += '}'; }
    s += '","tldeb":"'; for (const [k, v] of phys.TLDEB) s += k + ':' + v + ',';
    s += '","lrx":"'; for (const v of phys.LRX) s += v + ','; s += '","ltx":"'; for (const v of phys.LTX) s += v + ',';
    s += '","lstat":"'; for (const v of phys.LSTAT) s += v + ',';
    s += '","ctr":"'; for (const n of ['L15_CLOSED', 'L16_DROP', 'L16_DEFERRED', 'L16_PENDDROP', 'L16_ANSPEAK', 'L16_HANDED', 'L16_UNN', 'L16_BUSY', 'L16_BYE', 'L16_IDLEC', 'L16_LIFEC', 'L16_GWC', 'L16_BACKOFF', 'L16_DOORPEAK', 'L16_EVILPEAK', 'L22_CLOSED', 'L23_CLOSED', 'L23_REFUSED', 'L14_REFUSED', 'L1611_SHED', 'L18_NODIAL', 'L18_NOPATH', 'L18_SKIPDIRECT', 'L18_SKIPFRIEND', 'L18_SKIPMASS', 'L18_DELIV', 'L18_HOPS', 'L18_HMAX', 'CLOSEDROPS', 'ERASEDROPS', 'L23PENDT']) s += lv[n] + ',';
    s += '","hh":"'; for (let i = 0; i < 9; i++) s += S.L18_HH[i] + ','; s += '"';
    return s;
  };
  const stateLine = (op, extra) => {
    outLines.push('{"op":"' + op + '","TICK":' + fab.w.TICK + ',"GSEED":' + lv.GSEED + ',"FSEED":' + lv.FSEED + ',"SEQ":' + lv.SEQ + ',"L10SEQ":' + lv.L10SEQ + ',"L22SEQ":' + lv.L22SEQ +
      ',"nextId":' + lv.nextId + ',"bus":' + fab.bus.size + (extra || '') + dump() + '}');
  };
  const mkSeat = (id) => { while (fab.seats.length <= id) { fab.seats.push(null); fab.alive.push(0); } fab.seats[id] = new Seat(id, fab.w); fab.alive[id] = 1; if (id >= lv.nextId) lv.nextId = id + 1; return fab.seats[id]; };
  const B = (b) => (b ? 'true' : 'false');
  const FNS = pc.fns;
  const fld = (m, tk, a) => { for (; a < tk.length; a++) { const e = tk[a].indexOf('='); const k = tk[a].slice(0, e), v = Number(tk[a].slice(e + 1)); m[k] = (k === 'l10E' || k === 'dgOnly' || k === 'direct' || k === 'routing' || k === 'gwc' || k === 'knock' || k === 'l18' || k === 'mv') ? !!v : v; } };
  for (const raw of script.split('\n')) {
    const tk = raw.trim().split(/\s+/).filter(Boolean); if (!tk.length || tk[0][0] === '#') continue;
    const op = tk[0], I = (k) => Number(tk[k] || 0);
    const SE = (k) => fab.seats[I(k)];
    const CK = (k) => topo.ckey({ pc: I(k), r: I(k + 1), i: I(k + 2) });
    switch (op) {
      case 'lever': { const n = tk[1]; if (n === 'JOINMODE') fab.JOINMODE = tk[2]; else lv[n] = Number(tk[2]); stateLine('lever'); break; }
      case 'init': fab.initSim(I(1), Number(tk[2])); stateLine('init'); break;
      case 'mk': mkSeat(I(1)); stateLine('mk'); break;
      case 'setc': { const s = SE(1); s.state = I(2); s.hasCoord = true; s.coord = { pc: I(3), r: I(4), i: I(5) }; stateLine('setc'); break; }
      case 'occ': SE(1).occ.set(topo.ckey({ pc: I(2), r: I(3), i: I(4) }), I(5)); stateLine('occ'); break;
      case 'cousin': SE(1).cousins.set(CK(2), I(5)); stateLine('cousin'); break;
      case 'rosterk': { const e = msg.newKV(); e.k = CK(2); e.v = I(5); SE(1).roster.push(e); stateLine('rosterk'); break; }
      case 'tick': fab.w.TICK = I(1); stateLine('tick'); break;
      case 'seatedat': SE(1).seatedAt = I(2); stateLine('seatedat'); break;
      case 'ctier': SE(1).ctier = I(2); stateLine('ctier'); break;
      case 'moving': SE(1).moving = I(2) !== 0; stateLine('moving'); break;
      case 'uplinkof': SE(1).l14Up = I(2); stateLine('uplinkof'); break;
      case 'keep': SE(1).keepAdd(I(2), I(3)); stateLine('keep'); break;
      case 'l22cell': SE(1).l22Cell.set(I(2), [CK(3), I(6)]); stateLine('l22cell'); break;
      case 'rival': SE(1).l22Rival.set(I(2), I(3)); stateLine('rival'); break;
      case 'callin': SE(1).callBook.noteIn(I(2), SE(1).TICK); stateLine('callin'); break;
      case 'callout': SE(1).callBook.noteOut(I(2), SE(1).TICK); stateLine('callout'); break;
      case 'dialfail': SE(1).dials.failed(I(2), SE(1).TICK, I(3) !== 0); stateLine('dialfail'); break;
      case 'dialgone': SE(1).dials.holdLost(I(2), SE(1).TICK); stateLine('dialgone'); break;
      case 'dialheard': SE(1).dials.heard(I(2)); stateLine('dialheard'); break;
      case 'bare': SE(1).bareAt.set(CK(2), I(5)); stateLine('bare'); break;
      case 'word': SE(1).l23WordAt.set(I(2), I(3)); stateLine('word'); break;
      case 'work': SE(1).l23Work.set(I(2), [I(3), I(4)]); stateLine('work'); break;
      case 'relmark': SE(1).relMark.set(I(2), I(3)); stateLine('relmark'); break;
      case 'sched': { const m = msg.newMsg(tk[3]); fld(m, tk, 5); fab.schedule(I(1), I(2), m, I(4)); stateLine('sched'); break; }
      case 'dial': FNS.fabricDial(I(1), I(2)); stateLine('dial'); break;
      case 'dialjoin': FNS.fabricDialJoin(I(1), I(2)); stateLine('dialjoin'); break;
      case 'dialup': { const r = []; const b = FNS.fabricDialUplink(I(1), I(2), r); stateLine('dialup', ',"r":' + B(b) + ',"n":' + r.length); break; }
      case 'uptake': stateLine('uptake', ',"r":' + FNS.fabricUpTake(I(1), I(2))); break;
      case 'updecline': { const r = []; for (let k = 3; k < tk.length; k++) r.push(I(k)); FNS.fabricUpDecline(I(1), I(2), r); stateLine('updecline'); break; }
      case 'callframe': { const m = msg.newMsg(tk[3]); fld(m, tk, 4); FNS.fabricCallFrame(I(1), I(2), m); stateLine('callframe'); break; }
      case 'doordrop': FNS.fabricDoorDrop(I(1), I(2)); stateLine('doordrop'); break;
      case 'doorhanded': FNS.fabricDoorHanded(I(1), I(2)); stateLine('doorhanded'); break;
      case 'doorheard': FNS.fabricDoorHeard(I(1), I(2), I(3) >>> 0); stateLine('doorheard'); break;
      case 'nosock': FNS.fabricNoSock(I(1), I(2)); stateLine('nosock'); break;
      case 'ltick': fab.w.TICK = I(1); phys.linkTick(); stateLine('ltick'); break;
      case 'lopen': { const a = I(1), b = I(2); const L = phys.linkGet(a, b); L.epoch++; L.leverHalf = false; phys.LBLOCK.delete(fab.pairKey(a, b)); phys.linkOpenNow(L, a, b); stateLine('lopen'); break; }
      case 'lclose': { const a = I(1), b = I(2); const L = phys.linkFind(a, b); const fail = I(3) !== 0; if (L && L.state === E.LK_OPEN) phys.closeBoth(L, a, b, fail, fail ? 'failed-persist' : 'dc-close'); stateLine('lclose'); break; }
      case 'lhalf': { const a = I(1), b = I(2); const L = phys.linkFind(a, b); if (L && L.state === E.LK_OPEN) { L.leverHalf = true; phys.linkHalf(L, a, b, I(3), false); } stateLine('lhalf'); break; }
      case 'lcrash': phys.crashTransport(I(1)); stateLine('lcrash'); break;
      case 'lleave': fab.X.fabricLeft(I(1)); stateLine('lleave'); break;
      case 'l22agree': FNS.l22Agree(I(1), I(2)); stateLine('l22agree'); break;
      case 'l22closeask': FNS.l22CloseAsk(I(1), I(2)); stateLine('l22closeask'); break;
      case 'l22note': FNS.l222Note(I(1), I(2)); stateLine('l22note'); break;
      case 'l28reply': FNS.l28Reply(I(1), I(2)); stateLine('l28reply'); break;
      case 'need': { const r = FNS.l22Need(I(1), I(2)); const w = pc.linkWhy(I(1), I(2), false); const q = FNS.l22Quiet(I(1), I(2)); stateLine('need', ',"r":' + B(r) + ',"w":' + w + ',"q":' + B(q)); break; }
      case 'lstate': stateLine('lstate', ',"r":' + FNS.fabricLinkState(I(1), I(2)) + ',"f":' + FNS.fabricDialFails(I(1), I(2)) + ',"d":' + FNS.fabricMyDoors(I(1)) + ',"k":' + FNS.fabricMyKnocks(I(1)) + ',"b":' + B(FNS.fabricL23Busy(I(1), I(2)))); break;
      case 'budget': stateLine('budget', ',"r":' + pc.pcBudget(I(1), I(2))); break;
      case 'l18route': stateLine('l18route', ',"r":' + B(FNS.l18Route(I(1), I(2)))); break;
      case 'l18cell': { const c = FNS.l18Cell(I(1), I(2)); stateLine('l18cell', ',"r":' + B(!!c) + ',"c":"' + (c ? fab.coordStr(c) : '-') + '"'); break; }
      case 'l18deliv': { const m = msg.newMsg('PHONE'); m.l18 = true; m.rttl = I(1); FNS.l18Deliv(m); stateLine('l18deliv'); break; }
      case 'refuse': { lv.L16_DEFER = false; const r = pc.l16Refuse(I(1), I(2), tk[3]); stateLine('refuse', ',"r":' + B(r) + ',"d":' + B(lv.L16_DEFER)); break; }
      case 'l23ref': stateLine('l23ref', ',"r":' + B(pc.l23Refused(I(1), I(2), tk[3], I(4)))); break;
      case 'full': stateLine('full', ',"r":' + B(pc.l23Full(I(1))) + ',"s":' + pc.l23Stretch(I(1)) + ',"h":' + B(pc.l1610Full(I(1)))); break;
      case 'end': fab.proofTickEnd(); stateLine('end'); break;
      default: throw new Error('bad op ' + op);
    }
  }
  fab.close();
  return outLines.join('\n') + '\n';
}

// ---- compare ----------------------------------------------------------------------------------------------------
function firstDiff(a, b) {
  const x = a.split('\n'), y = b.split('\n');
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return { line: i + 1, sim: x[i], js: y[i] };
  return null;
}
// where two long lines first differ, with context
function around(a, b) {
  a = String(a); b = String(b); let i = 0; while (i < a.length && a[i] === b[i]) i++;
  return '  at col ' + i + '\n  sim ...' + a.slice(Math.max(0, i - 120), i + 160) + '\n  js  ...' + b.slice(Math.max(0, i - 120), i + 160);
}
function readOr(f) { return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; }

function checkSeed(bin, work, seed, script) {
  const dir = path.join(work, 'case' + seed); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const text = script || genScript(seed);
  fs.writeFileSync(path.join(dir, 'script.txt'), text);
  const env = Object.assign({}, process.env, { MESH_PROOF: path.join(dir, 'sim'), MESH_PROOF_TAPES: 'none', MESH_TRACE_FILE: path.join(dir, 'sim.trace') });
  const r = cp.spawnSync(bin, [], { input: text, env, maxBuffer: 1 << 28 });
  if (r.status !== 0) return { bad: 'driver exit ' + r.status + ' ' + String(r.stderr).slice(0, 300) };
  const simOut = r.stdout.toString();
  let jsOut;
  try { jsOut = runJs(text, dir); } catch (e) { return { bad: 'js threw: ' + (e.stack || e).toString().slice(0, 600), dir }; }
  const checks = [
    ['counters+tables', simOut, jsOut],
    ['frames.jsonl', readOr(path.join(dir, 'sim', 'frames.jsonl')), readOr(path.join(dir, 'js', 'frames.jsonl'))],
    ['hash.jsonl', readOr(path.join(dir, 'sim', 'hash.jsonl')), readOr(path.join(dir, 'js', 'hash.jsonl'))],
    ['trace', readOr(path.join(dir, 'sim.trace')), readOr(path.join(dir, 'js.trace'))],
  ];
  const sizes = {};
  for (const [name, a, b] of checks) {
    sizes[name] = a.split('\n').length - 1;
    const d = firstDiff(a, b);
    if (d) return { bad: name + ' line ' + d.line + '\n' + (name === 'counters+tables' ? 'op: ' + text.split('\n').filter((l) => l.trim() && l[0] !== '#')[d.line - 1] + '\n' + around(d.sim, d.js) : '  sim ' + String(d.sim).slice(0, 500) + '\n  js  ' + String(d.js).slice(0, 500)), dir };
  }
  return { ok: true, sizes, text };
}

if (require.main === module) {
  const [bin, work, nStr, firstStr] = process.argv.slice(2);
  if (!bin || !work) { console.error('usage: pclaws-check.js <driver> <work dir> [cases] [first seed]'); process.exit(2); }
  fs.mkdirSync(work, { recursive: true });
  const repo = process.env.GIFOS_APP_REPO || path.join(__dirname, '..', '..', '..');
  const units = loadUnits(); standIns();
  console.log('seat units borrowed: ' + units.join(' '));
  const n = Number(nStr || 20), first = Number(firstStr || 1);
  const tot = { 'counters+tables': 0, 'frames.jsonl': 0, 'hash.jsonl': 0, trace: 0 }; let fails = 0; const opCount = new Map();
  for (let s = first; s < first + n; s++) {
    const r = checkSeed(bin, work, s);
    if (r.bad) { fails++; console.log('seed ' + s + ' DIFF ' + r.bad); if (fails >= 3) break; continue; }
    for (const k of Object.keys(tot)) tot[k] += r.sizes[k];
    for (const l of r.text.split('\n')) { const o = l.split(' ')[0]; if (o) opCount.set(o, (opCount.get(o) || 0) + 1); }
  }
  console.log('ops run: ' + [...opCount].sort((a, b) => b[1] - a[1]).map(([o, c]) => o + '=' + c).join(' '));
  console.log((n - fails) + '/' + n + ' cases equal; lines compared: ' + JSON.stringify(tot));
  console.log(fails ? 'pclaws check FAIL' : 'pclaws check PASS');
  process.exit(fails ? 1 : 0);
}
module.exports = { genScript, runJs, checkSeed, loadUnits };
