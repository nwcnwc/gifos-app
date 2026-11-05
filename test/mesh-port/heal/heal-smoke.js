#!/usr/bin/env node
// heal-smoke.js [--proof <dir>...] [--cases N] [--seed S] [--twice]
// L1 smoke for js/mesh/heal.js: seats restored from the sim's state lines (a recorded mass-leave run), filled out
// with seeded random books (goodbyes, pongs, births, heirs, calls ...), then every method of the unit is called
// on them. Checks: no exception, the same seat gives the same frames and trace lines twice (determinism), the
// in-place arrays keep their identity. What it cannot check: that the answers equal the sim's (that is the
// tape replay, X1). The methods other units own are stubbed here (listed in the output).
'use strict';
const fs = require('fs'), path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const topo = require(path.join(M, 'topo.js'));
require('../load-all.js');   // every unit, so the callees the unit makes are the real ones
const seatM = require(path.join(M, 'seat.js'));
const { Seat, FREE, FABRIC_CALLS } = seatM;
const state = require(path.join(M, 'state.js'));
const msg = require(path.join(M, 'msg.js'));
const C_ = require(path.join(M, 'consts.js'));
const { lines } = require('../proof-io.js');
const heal = require(path.join(M, 'heal.js'));
const { ckey, unckey, ownedLinks, down, up } = topo, C = topo.C, K = C_.consts;

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const dirs = []; for (let i = 0; i < argv.length; i++) if (argv[i] === '--proof') dirs.push(argv[i + 1]);
const NCASES = +opt('--cases', 400), SEED = +opt('--seed', 1);

// ---- the stubs of what other units own ------------------------------------------------------------------------
const stubbed = new Set();
for (const f of ['liveElsewhere', 'translostConfirmed', 'routeToProbe', 'requeue', 'islandHeirGone', 'l920Note', 'ownedLinkCell', 'l920Deaf', 'l4Busy', 'take', 'l919Rollback', 'announce', 'otherRing', 'l33WordDenied', 'l33WordRegrant', 'l33WordMine', 'phoneHome', 'hearRook', 'ringName', 'islandSeen', 'mergeCalc', 'digForget', 'rootFold', 'entNote', 'l16AskOne', 'l845Held', 'l828RingOf', 'farStampNeed', 'farStamp', 'onStageOrTalking', 'l828RingOf']) {
  if (f in Seat.prototype) continue; stubbed.add(f);
  Seat.unit('smoke stub ' + f, { [f](...a) { this.w.smoke.log.push('STUB ' + f); return this.w.smoke.stubAns(f, a); } });
}
let cellOkImpl = (k) => { const c = unckey(k); if (c.r >= C || c.i >= C) return false; let pc = c.pc, d = 0; while (pc) { if (((pc - 1) >>> 0) % 6 >= C) return false; pc = Math.floor(((pc - 1) >>> 0) / 6); if (++d > 12) return false; } return true; };
for (const [k, v] of Object.entries({
  ownerCoordOf: (c) => (c.pc === 0 ? null : up({ pc: c.pc, r: c.r, i: 0 })),
  cellOk: cellOkImpl, coordStr: (c) => c.pc + '/' + c.r + '.' + c.i, l35HandOn: (s) => !!s, l35Hinted: () => {}, bumpMoves: () => {}, islandStandM: () => false,
})) if (!(k in FREE)) { Seat.free({ [k]: v }); stubbed.add(k); }

// ---- a deterministic rng for the test itself ---------------------------------------------------------------------
function mkRng(seed) { let s = (seed >>> 0) || 1; return { next() { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }, int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }, pick(a) { return a[Math.floor(this.next() * a.length)]; } }; }

// ---- the world, the fabric ---------------------------------------------------------------------------------------
function mkWorld(tick, rng, log) {
  const w = seatM.newWorld({});
  w.TICK = tick; w.lv.RSEQ = 0; w.lv.TN_SEQ = 0; w.lv.PN_SEQ = 0; w.lv.MOVES = 0;   // the sim's global counters: same start for the twin run
  const f = {};
  for (const n of FABRIC_CALLS) f[n] = (...a) => { log.push('F ' + n + ' ' + JSON.stringify(a)); return ans(n, a); };
  function ans(n, a) {
    switch (n) {
      case 'fabricLinkState': return rng.int(0, 3);
      case 'fabricDialFails': return rng.int(0, 2);
      case 'fabricDoors': return rng.next() < 0.7;
      case 'fabricUpTake': return rng.int(0, 2);
      case 'fabricDialUplink': { const nref = rng.int(0, 3); for (let i = 0; i < nref; i++) a[2].push(rng.int(0, 60)); return rng.next() < 0.5; }
      default: return 0;
    }
  }
  w.f = f;
  w.smoke = { log, stubAns: (name) => (name === 'ownedLinkCell' ? rng.next() < 0.7 : (name === 'l4Busy' || name === 'otherRing' || name === 'l33WordRegrant') ? rng.next() < 0.1 : name === 'l33WordDenied' || name === 'requeue' ? undefined : (name === 'ringName' ? 0 : (name === 'l845Held' ? false : rng.next() < 0.3))) };
  w.trace = (ev, seat, cell, detail) => log.push('T ' + ev + ' ' + seat + ' ' + (cell ? ckey(cell) : '-') + ' ' + detail);
  return w;
}

// ---- a seat: a real state line, then seeded books ---------------------------------------------------------------
function cellsAround(s, rng) {
  const out = [];
  if (!s.hasCoord) return out;
  for (const c of ownedLinks(s.coord)) out.push(c);
  out.push(s.coord);
  const u = up({ pc: s.coord.pc, r: s.coord.r, i: 0 }); if (u) { out.push(u); for (const c of topo.rowMates(u)) out.push(c); }
  out.push(down(s.coord));
  for (const c of s.rosterCells()) out.push(c);
  if (s.coord.pc !== 0) out.push({ pc: s.coord.pc, r: s.coord.r, i: 0 });
  return out;
}
function decorate(s, rng) {
  const T = s.TICK, ids = [...s.occ.values()].filter((v) => v >= 0);
  const peer = () => (ids.length && rng.next() < 0.8 ? rng.pick(ids) : rng.int(0, 90));
  const ago = () => T - rng.int(0, 320);
  const cells = cellsAround(s, rng).map(ckey);
  const some = (p) => cells.filter(() => rng.next() < p);
  for (const k of some(0.3)) s.byeAt.set(k, ago());
  for (const k of some(0.2)) s.pongBy.set(k, [peer(), ago()]);
  for (const k of some(0.3)) s.born.set(k, s.LT() - rng.int(0, 60));
  for (const k of some(0.3)) s.childOf.set(k, rng.next() < 0.8 ? peer() : -1);
  for (const k of some(0.2)) s.l13HeirCallAt.set(k, ago());
  for (const k of some(0.2)) s.l13EmptyAt.set(k, T - rng.int(0, 30));
  for (const k of some(0.2)) s.l13HeldAt.set(k, T - rng.int(0, 70));
  for (const k of some(0.15)) s.l13VacAt.set(k, ago());
  for (const k of some(0.2)) s.rmAskFirst.set(k, ago());
  for (const k of some(0.15)) s.l9PullCell.set(k, T - rng.int(0, 30));
  for (const k of some(0.2)) s.l1ByeKid.set(k, ago());
  for (const k of some(0.2)) s.l1ByeKidId.set(k, peer());
  for (const k of some(0.1)) s.l1Defer.set(k, ago());
  for (const k of some(0.1)) s.l1Vacated.set(k, ago());
  for (const k of some(0.2)) s.probeAck.set(k, T - rng.int(0, 30));
  for (const k of some(0.2)) s.cousins.set(k, peer());
  for (const k of some(0.1)) s.l13ByeKids.set(k, [rng.int(0, 2), ago()]);
  for (const k of some(0.1)) s.rcHanded.set(k, [peer(), ago()]);
  for (const k of some(0.1)) s.l13WordTo.set(k, [peer(), T - rng.int(0, 30)]);
  for (const k of some(0.1)) s.u2Rows.set(k, { heir: rng.int(-1, 20), at: ago(), hot: false });
  for (const k of some(0.1)) s.kidful.set(k, rng.next() < 0.5);
  for (const k of some(0.1)) s.lkAt.set(k, ago()), s.linkedBy.set(k, s.occGet(k));
  for (const k of some(0.1)) s.sitting.set(k, Object.assign(state.newStruct('SoftSit'), { joiner: peer(), assigner: peer(), at: ago() }));
  for (const x of ids) if (rng.next() < 0.3) s.unpAt.set(x, T - rng.int(0, 30));
  for (const x of ids) if (rng.next() < 0.1) s.noChan.add(x);
  for (const x of ids) if (rng.next() < 0.1) s.byeIds.set(x, ago());
  for (let i = rng.int(0, 3); i > 0; i--) { s.l13DownAt.push(ago()); s.l13DownPeer.push(peer()); }
  for (let i = rng.int(0, 3); i > 0; i--) s.lastGreeters.push(peer());
  for (const x of ids) if (rng.next() < 0.1) s.callBook.ringCall(x, T - rng.int(0, 40)), s.callBook.ringCall(x, T - rng.int(0, 40));
  s.rootDec.n = rng.int(-1, 40); s.rootDec.at = rng.int(-1, 300); s.rootDec.part = rng.int(0, 1);
  s.l9GrowN = rng.int(-1, 40); s.l9GrowAt = rng.int(-300, 300);
  s.healAt = T - rng.int(0, 100); s.seatedAt = T - rng.int(0, 400); s.lastAck = T - rng.int(0, 80); s.rowLedgerAt = rng.next() < 0.5 ? T - rng.int(0, 300) : -1;
  s.l13KnockAt = T - rng.int(0, 80); s.rosterAskAt = T - rng.int(0, 80); s.l13NewsAt = T - rng.int(0, 80); s.greetersAt = T - rng.int(0, 600); s.rmHomeAt = T - rng.int(0, 80);
  s.l9PullAt = T - rng.int(0, 30); s.l13OwnerPullAt = T - rng.int(0, 40); s.l14UpAt = T - rng.int(0, 60); s.l14Up = rng.next() < 0.3 ? peer() : -1;
  s.rmHistAt = T - rng.int(0, 300); s.rmBornAt = T - rng.int(0, 100); s.rmNewHeadAt = T - rng.int(0, 100); s.rmVertical = rng.next() < 0.3; s.u2Id = rng.next() < 0.5 ? peer() : -1; s.u2Ck = rng.pick(cells.concat([0])); s.u2AckAt = T - rng.int(0, 30);
  s.bkId = rng.next() < 0.5 ? peer() : -1; s.bkCk = rng.pick(cells.concat([0])); s.u2BeatAt = T - rng.int(0, 30); s.ownDeadCk = rng.pick(cells.concat([0])); s.ownDeadAt = T - rng.int(0, 100); s.ownDeadSeen = peer();
  s.vouchOwner = rng.next() < 0.5 ? peer() : -1; s.vouchOCk = rng.pick(cells.concat([0])); s.ownVouchAt = T - rng.int(0, 30);
  s.d6Mark = rng.next() < 0.1; s.unpAnyAt = T - rng.int(0, 20); s.l13CrashAt = T - rng.int(0, 400); s.l12DepartAt = T - rng.int(0, 400);
  for (let i = rng.int(0, 3); i > 0; i--) s.l14Refer.push(peer());
  return { cells, ids };
}
function mkMsg(t, s, rng, cells, ids) {
  const m = msg.newMsg(t); const T = s.TICK;
  const ck = () => rng.pick(cells);
  m.id = rng.next() < 0.9 ? rng.pick(ids.length ? ids : [1]) : -1; m.lk = m.id; m.ck = ckey(ck()); m.oCk = ckey(ck());
  m.owner = rng.next() < 0.5 ? rng.pick(ids.length ? ids : [1]) : -1; m.child = rng.next() < 0.3 ? rng.pick(ids.length ? ids : [1]) : -1; m.mass = rng.next() < 0.5; m.wordHeld = rng.next() < 0.2;
  for (let i = rng.int(0, 4); i > 0; i--) m.byes.push(ckey(ck()));
  for (let i = rng.int(0, 6); i > 0; i--) m.row.push({ k: ckey(ck()), v: rng.pick(ids.length ? ids : [1]), age: rng.int(-1, 30), ch: -1, ba: -1, tn: 0 });
  for (let i = rng.int(0, 6); i > 0; i--) m.nbrs.push({ k: ckey(ck()), v: rng.pick(ids.length ? ids : [1]) });
  m.tock = ckey(s.coord); m.tag = rng.int(0, 8); m.l9s = rng.next() < 0.1; for (let i = rng.int(0, 3); i > 0; i--) m.list.push(rng.int(0, 60));
  return m;
}

// ---- the calls --------------------------------------------------------------------------------------------------
const CALLS = ['rmRetry', 'tryHeadFill', 'homePull', 'rowPull', 'ownerPull', 'l13Meet', 'l13Condemn', 'l14Uplink', 'heal', 'findLeaf', 'promoteInto', 'rmWitness', 'rmName', 'doMove', 'confirmMove', 'rollbackMove', 'moveEvidence', 'rmRival', 'l13Top', 'l13OnMeet', 'l13OnMeetAck', 'l14Offer', 'l14Declined', 'l1KidHeals', 'l13RowBelow', 'chanless', 'l167HolderHeard', 'l13Fresh', 'l13SettledRight', 'rmRowMaybeLive', 'rmAloneAsked', 'l13HomeWit', 'l14Branch', 'l1DeepKid', 'rmWitCell', 'rmAsk', 'l13Anchor', 'rmArrival', 'l13Answer', 'rmRingAlone'];
const called = new Map();
function exercise(s, rng, cells, ids, k) {
  const pickCell = () => rng.pick(cells);
  const nbrsOf = () => { const n = []; for (let i = rng.int(0, 4); i > 0; i--) n.push({ k: ckey(pickCell()), v: rng.pick(ids.length ? ids : [1]) }); return n; };
  const id = () => rng.pick(ids.length ? ids : [1]);
  const name = CALLS[k % CALLS.length]; called.set(name, (called.get(name) || 0) + 1);
  switch (name) {
    case 'heal': return s.heal(pickCell());
    case 'findLeaf': return s.findLeaf(pickCell(), nbrsOf(), rng.int(0, 3), rng.pick([0, 0, 11, 12]));
    case 'promoteInto': return s.promoteInto(pickCell(), nbrsOf());
    case 'rmWitness': return s.rmWitness(pickCell(), rng.pick([-1, id()]), rng.int(1, 3));
    case 'rmName': { const n = nbrsOf(); const same = n; const r = s.rmName(pickCell(), -1, n); if (n !== same) throw new Error('rmName: array identity lost'); return [r, n]; }
    case 'doMove': { const n = nbrsOf(); const same = n; s.doMove(pickCell(), rng.pick([-1, id()]), n); if (n !== same) throw new Error('doMove: array identity lost'); return n; }
    case 'moveEvidence': return s.moveEvidence(mkMsg(rng.pick(['PONG', 'PHONE', 'HELLO', 'CLAIM']), s, rng, cells, ids));
    case 'rmRival': return s.rmRival(id(), rng.int(-1, 40), 'smoke');
    case 'l13OnMeet': return s.l13OnMeet(mkMsg('MEET', s, rng, cells, ids));
    case 'l13OnMeetAck': return s.l13OnMeetAck(mkMsg('MEETACK', s, rng, cells, ids));
    case 'l14Offer': return s.l14Offer(mkMsg('PHONE', s, rng, cells, ids));
    case 'l14Declined': return s.l14Declined(mkMsg('PHONE', s, rng, cells, ids));
    case 'l1KidHeals': case 'rmAsk': case 'rmWitCell': case 'l167HolderHeard': case 'l13HomeWit': case 'rmAloneAsked': case 'rmRingAlone': return name === 'rmWitCell' ? s.rmWitCell(pickCell(), ckey(pickCell())) : s[name](pickCell());
    case 'l13RowBelow': case 'l13Fresh': return s[name](ckey(pickCell()));
    case 'chanless': return s.chanless(ckey(pickCell()));
    case 'l13SettledRight': return s.l13SettledRight(rng.int(0, C - 1));
    case 'l13Answer': return s.l13Answer(id(), ckey(pickCell()));
    case 'l13Meet': return s.l13Meet(rng.next() < 0.5);
    default: return s[name]();
  }
}

// ---- the main loop ---------------------------------------------------------------------------------------------
const base = [];
for (const d of dirs) {
  let i = 0; const keep = [];
  for (const raw of lines(path.join(d, 'state.jsonl'))) { if (++i % 37) continue; const o = JSON.parse(raw); if (o.s.hasCoord && o.s.state === 3 && o.t > 100) keep.push(o); }
  base.push(...keep);
}
if (!base.length) { console.error('no state lines: pass --proof <dir>'); process.exit(2); }
let bad = 0, runs = 0, frames = 0, traces = 0; const events = new Map(); const msgTypes = new Map();
function oneRun(o, seed, log) {
  const rng = mkRng(seed);
  const w = mkWorld(o.t, rng, log);
  const s = new Seat(o.id, w); state.restore(s, o.s);
  const { cells, ids } = decorate(s, rng);
  // an L13 lever either unset (every sub-rule on) or by the seat's own mass reading
  w.L13CUR = rng.next() < 0.6 ? null : s;
  s.l13MassLast = w.TICK - rng.int(0, 600);
  for (let k = 0; k < 24; k++) {
    const idx = rng.int(0, 1000);
    try { const r = exercise(s, rng, cells, ids, idx); log.push('R ' + JSON.stringify(r === undefined ? null : r)); }
    catch (e) { log.push('X ' + e.message); if (!/not wired/.test(e.message)) throw e; }
    if (rng.next() < 0.15) { w.TICK += rng.int(1, 40); }
  }
}
for (let n = 0; n < NCASES; n++) {
  const o = base[(n * 7919 + SEED) % base.length]; const seed = SEED * 100003 + n;
  const a = [], b = [];
  try {
    oneRun(o, seed, a); oneRun(o, seed, b);
  } catch (e) { bad++; if (bad <= 5) console.log('EXCEPTION case ' + n + ' seat ' + o.id + ' t=' + o.t + ': ' + (e.stack || e).toString().split('\n').slice(0, 4).join('\n  ')); continue; }
  runs++;
  if (JSON.stringify(a) !== JSON.stringify(b)) { bad++; if (bad <= 5) console.log('NONDETERMINISTIC case ' + n); }
  for (const l of a) {
    if (l.startsWith('T ')) { traces++; const ev = l.split(' ')[1]; events.set(ev, (events.get(ev) || 0) + 1); }
    else if (l.startsWith('F fabricSend')) { frames++; const t = JSON.parse(l.slice(13))[2].t; msgTypes.set(t, (msgTypes.get(t) || 0) + 1); }
  }
}
console.log('stubbed (other units): ' + [...stubbed].sort().join(' '));
console.log('base state lines: ' + base.length + '; cases: ' + runs + ' (each run twice); frames sent: ' + frames + ' ' + JSON.stringify([...msgTypes]) + '; trace lines: ' + traces);
console.log('trace events: ' + [...events].sort().map(([k, v]) => k + ':' + v).join(' '));
console.log('calls: ' + [...called].map(([k, v]) => k + ':' + v).join(' '));
console.log(bad ? 'HEAL SMOKE FAIL (' + bad + ')' : 'HEAL SMOKE PASS');
process.exit(bad ? 1 : 0);
