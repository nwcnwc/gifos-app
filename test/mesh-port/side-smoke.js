#!/usr/bin/env node
// side-smoke.js <proof dir>... [--every N]
// The `side` units (island ring roomterm farview gaps rcdead tier instant small mltail witness rcleft rcleft-l25
// rcfollow linkset lguard-seat) on seats restored from L1 state lines. For every Nth state line and every method
// below: restore a fresh seat, set the world's tick, call the method with args made from the seat, and fold the
// return value, the seat's state hash after, the trace lines and the fabric calls into one FNV digest.
// Callees that belong to other units are not wired yet: a call that reaches one counts as "waits on <name>"
// (not a failure); any other exception is a failure. This proves the units load, run and are deterministic
// (the digest is stable across runs and moves when a unit's logic changes). It does NOT compare with the C++:
// that waits for X1 (tape replay). Exit 1 on any failure.
'use strict';
const fs = require('fs'), path = require('path');
const M = path.join(__dirname, '..', '..', 'js', 'mesh');
const seatM = require(path.join(M, 'seat.js')); const { Seat } = seatM;
for (const f of ['island', 'ring', 'roomterm', 'farview', 'gaps', 'rcdead', 'tier', 'instant', 'small', 'mltail', 'witness', 'rcleft', 'rcleft-l25', 'rcfollow', 'linkset', 'lguard-seat', 'hostile-laws']) require(path.join(M, f + '.js'));
const state = require(path.join(M, 'state.js'));
const msg = require(path.join(M, 'msg.js'));
const fnv = require(path.join(M, 'fnv.js'));
const C_ = require(path.join(M, 'consts.js'));
const { lines } = require('./proof-io.js');

const argv = process.argv.slice(2); let every = 40; const dirs = [];
for (let i = 0; i < argv.length; i++) { if (argv[i] === '--every') every = +argv[++i]; else dirs.push(argv[i]); }

const mk = (t, o) => Object.assign(msg.newMsg(t), o);
// [method, args(seat)]: args are made from the seat's own state so they hit the interesting branches
const cell = (s) => (s.occ.size ? s.occ.keys().next().value : 0);
const mate = (s) => (s.occ.size ? s.occ.values().next().value : s.id + 1);
const SPECS = [
  ['islandSeen', () => []], ['mergeSeen', () => []], ['mergeCalc', () => []], ['lineForeign', () => []], ['ringMin', () => []], ['ringName', () => []],
  ['l827Note', () => []], ['l845Held', () => []], ['entryTerm', () => []], ['entCheck', () => []], ['entNote', (s) => [mate(s)]], ['cutNote', () => []],
  ['islandNotMine', () => []], ['islandForkLive', () => []], ['islandFork', (s) => [[mate(s), s.id + 7]]], ['islandHeirGone', (s) => [cell(s), s.coord]],
  ['islandTick', () => []], ['l16WaveTick', () => []], ['l16Wait', () => []], ['l16Evil', () => []], ['l16Gateway', (s) => [mate(s), s.id + 1]], ['l16AskOne', (s) => [mate(s)]],
  ['l16Busied', (s) => [mk('HOME', { id: mate(s) })]], ['l16Handoff', (s) => [mk('HANDOFF', { nc: s.id, owner: mate(s) })]], ['l16Taken', (s) => [mk('TAKEN', { nc: s.id, id: mate(s) })]],
  ['islandAsk', (s) => [[mate(s), s.id + 3, s.id + 9]]], ['l16Backoff', () => ['x']],
  ['l828RingOf', (s) => [mate(s)]], ['l842Stranger', (s) => [mk('HELLO', { from: mate(s), id: mate(s), line: s.line + 1 })]],
  ['islandC7', (s) => [mk('HELLO', { from: mate(s), id: mate(s), line: s.line + 1, c7Min: s.id + 5, c7Held: true })]],
  ['c7Follow', (s) => [mk('LEAVE', { id: mate(s), ck: cell(s), c7: true, c7Min: 3 })]], ['c7Yield', () => [3, 'x']],
  ['lineOf', (s) => [mate(s)]], ['otherRing', (s) => [mate(s)]], ['lineStranger', (s) => [mate(s)]], ['mergeSeenBut', (s) => [mate(s)]], ['doorNamed', (s) => [mate(s)]],
  ['l25Stand', (s) => [mate(s), false]], ['lineNote', (s) => [mk('HELLO', { from: mate(s), id: mate(s), line: 9, sig: true })]], ['lineAdopt', () => [5, 'x']],
  ['farLearn', (s) => [mk('FIND', { aId: mate(s), aCk: 5, sgw: 2, nc: 4 })]], ['farStampNeed', () => [mk('FIND', {})]], ['farStamp', () => [mk('FIND', { nc: 4 })]],
  ['l371Keep', () => []], ['l372Fresh', (s) => [mk('MEET', { from: mate(s) })]],
  ['l4TierOf', (s) => [mate(s)]], ['l4NatOf', (s) => [mate(s)]], ['l4Learn', (s) => [mk('HELLO', { id: mate(s), tier: 1, nat: 1 })]], ['l4Links', () => [[]]], ['l4Busy', () => []],
  ['l4Bad', (s) => [1, 1, s.coord]], ['l4HeadPick', () => []], ['l4Ready', (s) => [mk('SWAPQ', { swA: s.id, swCa: s.hasCoord ? C_.consts && require(path.join(M, 'topo.js')).ckey(s.coord) : 0 })]],
  ['l4Tick', () => []], ['l4OnQ', (s) => [mk('SWAPQ', { id: mate(s) })]], ['l4OnRdy', (s) => [mk('SWAPRDY', { id: mate(s), tag: 2 })]], ['l4OnGo', (s) => [mk('SWAPGO', { id: mate(s) })]],
  ['l4SwapHello', (s) => [mk('HELLO', { id: mate(s), sw: 3, swHd: 4, ck: cell(s) })]],
  ['l31Held', (s) => [cell(s), 3]], ['l31Note', (s) => [cell(s), 3, s.TICK, 1, true]], ['l31CellOk', (s) => [s.coord]], ['l31Pick', () => []], ['l31PendTick', () => []],
  ['l31Notify', (s) => [cell(s), 3, false, 0]], ['l31Relay', (s) => [mk('PLACED', { l31By: mate(s), id: 5 })]], ['l31Fallback', () => [{ nc: 1, home: false }]],
  ['l31Door', (s) => [mk('WHOHOME', { l31: 1, from: mate(s) }), mk('HOME', {})]], ['l31Direct', (s) => [s.coord, mk('FIND', { nc: mate(s) })]], ['l31Hold', (s) => [s.coord, mate(s), mk('PLACE', {})]],
  ['l31Replace', (s) => [mk('PLACE', { l31: 7, nc: s.id, owner: mate(s) })]], ['l31Beaten', (s) => [cell(s), 3, s.TICK, 1]],
  ['l30Tick', () => []], ['l30Silence', () => []],
  ['l33NoAdmitter', () => [0, 1, true]], ['l33HeirCalled', (s) => [cell(s)]], ['l33RowGate', () => []], ['l33WordDenied', (s) => [cell(s)]], ['l33WordMine', (s) => [cell(s)]],
  ['l33WordRegrant', (s) => [cell(s), 2]], ['l33HoldFull', () => [3]], ['l33MateArm', (s) => [cell(s)]], ['l33NoSockAsk', (s) => [mate(s)]], ['l33NoSock', (s) => [mate(s)]],
  ['l33ChildVouch', () => [4]], ['l33ChildGone', () => [4]],
  ['l25WitHeard', (s) => [cell(s)]], ['l25WitAskAll', () => []], ['l25WitAnswer', (s) => [mk('CHALLENGE', { from: mate(s), ck: cell(s) })]], ['l25WitClaimed', (s) => [mate(s), cell(s)]],
  ['l25WitVote', (s) => [mk('WITNESS', { id: mate(s), ck: cell(s) })]], ['l25WitDecide', () => [true]], ['l25WitTick', () => []],
  ['l211Withdrawn', () => []], ['l211Ack', (s) => [mk('U2ACK', { id: mate(s), e1dn: true })]], ['l211Stamp', () => [mk('PHONE', { vAt: 3 })]], ['l710Dial', (s) => [s.coord, mate(s)]],
  ['l711Reask', () => ['x']], ['l711Handed', (s) => [cell(s), mate(s), mk('FIND', { nc: 4 })]], ['l711Took', (s) => [mk('FIND', { from: mate(s) })]], ['l711Beat', () => [mk('PHONE', {}), 3]], ['l711Phone', (s) => [mk('PHONE', { id: mate(s) })]],
  ['l2512Tell', (s) => [mate(s)]], ['l2512Heard', (s) => [mk('CHALLENGE', { from: mate(s), ck: cell(s) })]], ['l2512Rook', (s) => [mate(s)]], ['l2512Decide', () => [true]], ['l2512TellHeard', (s) => [mate(s)]],
  ['l2512Witness', () => []], ['l2513Asked', (s) => [mk('CHALLENGE', { asker: mate(s), ck: cell(s) })]], ['l2513Order', (s) => [mk('CHALLENGE', { id: mate(s), pp: 3, ppAt: 4, ppL: 5, ck: cell(s) })]],
  ['l2514Drop', (s) => [mk('FINDLEAF', { from: mate(s), hole: s.coord })]], ['l2513Later', (s) => [mk('CHALLENGE', { id: mate(s), pp: 3, ppAt: 4, ppL: 5 })]], ['l2513Decide', () => [true]],
  ['l191Loop', (s) => [mk('ROUTE', { tag: 1, asker: mate(s), target: s.coord }), 2]], ['l919Rollback', () => []], ['l920Note', () => []], ['l920Deaf', () => [0]],
  ['linkRole', (s) => [mate(s), 31]], ['linkPeers', () => [[], 31]], ['keepHeld', (s) => [mate(s)]], ['keepAdd', (s) => [mate(s), 20]],
  ['lgRecvCells', () => []], ['lgIsWit', (s) => [mate(s)]], ['lgLightSeat', (s) => [mate(s)]], ['lgHeadPick', (s) => [[s.id, 5, 6, -1, -1], [0, 0, 1, -1, -1], 1]],
  ['l24Take', (s) => [mk('FIND', { from: mate(s), nc: mate(s), fsig: true })]], ['l26Check', (s) => [mk('FINDLEAF', { from: mate(s), hole: s.coord })]],
  ['lgRecv', (s) => [mk('LGASK', { id: mate(s), ck: cell(s), tag: 1 })]], ['lgLadder', () => []], ['lgTick', () => []],
];

function makeWorld(trace, fcalls) {
  const w = require(path.join(M, 'seat.js')).newWorld({ trace: (ev, seat, c, d) => trace.push(ev + '|' + seat + '|' + d), levers: Object.assign({}, C_.levers) });
  for (const n of Object.keys(w.f)) w.f[n] = (...a) => { fcalls.push(n + JSON.stringify(a)); return 0; };
  return w;
}

let bad = 0, nCalls = 0, nSeats = 0; const waits = new Map(), perMethod = new Map(); let h = 2166136261;
const fold = (str) => { h = (Math.imul(h ^ fnv.str(str), 16777619)) >>> 0; };
for (const dir of dirs) {
  let n = 0;
  for (const raw of lines(path.join(dir, 'state.jsonl'))) {
    if ((n++) % every) continue;
    const o = JSON.parse(raw); nSeats++;
    for (const [name, argsFn] of SPECS) {
      const trace = [], fcalls = [];
      const w = makeWorld(trace, fcalls); w.TICK = o.t;
      const s = new Seat(o.id, w); state.restore(s, o.s);
      if (name.startsWith('l31') || name.startsWith('l4') || name.startsWith('lg')) { w.lv.TIERS_ACTIVE = true; w.lv.LG_ON = true; w.lv.LINKMODEL = (o.id & 1) === 1; }
      let res;
      try { res = s[name](...argsFn(s)); nCalls++; perMethod.set(name, (perMethod.get(name) || 0) + 1); }
      catch (e) {
        const m = /(?:this|s)\.(\w+) is not a function/.exec(e.message) || /\.(\w+) is not a function/.exec(e.message);
        if (e instanceof TypeError && m) { waits.set(m[1], (waits.get(m[1]) || 0) + 1); fold(name + ':wait:' + m[1]); continue; }
        bad++; if (bad < 10) console.log('FAIL ' + name + ' seat ' + o.id + ' t=' + o.t + ': ' + e.stack.split('\n').slice(0, 3).join(' | ')); continue;
      }
      fold(name + JSON.stringify(res === undefined ? null : res) + '|' + state.stateHash(s) + '|' + trace.join(';') + '|' + fcalls.join(';'));
    }
  }
}
console.log('seats ' + nSeats + ', calls ' + nCalls + ', methods run ' + perMethod.size + '/' + SPECS.length + ', failures ' + bad);
console.log('waits on other units: ' + [...waits].sort().map(([k, v]) => k + '=' + v).join(' '));
console.log('digest ' + h.toString(16));
process.exit(bad ? 1 : 0);
