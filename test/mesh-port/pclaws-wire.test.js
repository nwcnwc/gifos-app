#!/usr/bin/env node
// pclaws-wire.test.js: the pc laws on fake page pc pairs, one law path per case (js/mesh/page/pclaws-wire.js).
// Each page has its own Seat, its own world and its own pclaws-wire; a fake net joins two pages' io the way an
// ordered data channel would (frames in order, a close seen by the far end after the frames before it).
'use strict';
const fs = require('fs'), path = require('path');
const M = path.join(__dirname, '..', '..', 'js', 'mesh');
const sm = require(path.join(M, 'seat.js'));
for (const f of fs.readdirSync(M).sort()) if (f.endsWith('.js')) require(path.join(M, f));
const msg = require(path.join(M, 'msg.js'));
const topo = require(path.join(M, 'topo.js'));
const { enums: E, consts: K } = require(path.join(M, 'consts.js'));
const PW = require(path.join(M, 'page', 'pclaws-wire.js'));

let fails = 0, passes = 0;
function ok(c, what) { if (c) { passes++; console.log('  ok   ' + what); } else { fails++; console.log('  FAIL ' + what); } }

function makeNet() {
  const pages = new Map(); const pcs = new Map();   // "a,b" (a<b) -> {open, dialer}
  const key = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
  const net = { pages, pcs, log: [] };
  net.page = function (id, opts = {}) {
    const w = sm.newWorld({}); w.TICK = 100;
    const seat = new sm.Seat(id, w);
    const pg = { id, w, seat, inbox: [], bye: [], refusedSeen: [] };
    const io = {
      dial(x, mark) { net.log.push(['dial', id, x, mark]); pcs.set(key(id, x), { open: false, dialer: id }); const B = pages.get(x); if (!B.wire.offer(id, mark)) pcs.delete(key(id, x)); else pages.get(id).wire.answered(x, B.wire.mark(id)); },
      send(x, f) { const pc = pcs.get(key(id, x)); if (!pc || !pc.open) return false; const B = pages.get(x); const g = structuredClone(f); g.from = id; if (g.t === 'pcbye') B.bye.push([id, g.why]); if (!B.wire.frame(id, g)) B.inbox.push(g); return true; },
      close(x) { const pc = pcs.get(key(id, x)); if (!pc) return; pcs.delete(key(id, x)); const B = pages.get(x); B.wire.lost(id, 'dc-close'); },
      refuse(x, info) { net.log.push(['refuse', id, x, info]); pages.get(x).wire.refused(id, info); },
      deliver(m) { pg.inbox.push(m); },
    };
    const wire = PW.create({ me: id, seat: () => seat, w, io, trace: (ev, s, c, f, ...a) => net.log.push([ev, s, ...a]) });
    for (const n of sm.FABRIC_CALLS) w.f[n] = () => 0;
    Object.assign(w.f, wire.fns);
    w.f.fabricSend = (from, to, m) => wire.send(to, m);
    pg.wire = wire; Object.assign(pg, opts); pages.set(id, pg); return pg;
  };
  net.connect = (a, b) => { const pc = pcs.get(key(a, b)); pc.open = true; const d = pc.dialer, o = d === a ? b : a; pages.get(o).wire.opened(d); pages.get(d).wire.opened(o); };
  net.kill = (a, b) => { pcs.delete(key(a, b)); pages.get(a).wire.lost(b, 'dc-close'); pages.get(b).wire.lost(a, 'dc-close'); };
  // one tick on every page: pc laws first (the sim's linkTick), then the inbox to the seat's handlers this test drives
  net.tick = () => {
    for (const p of pages.values()) p.w.TICK++;
    for (const p of pages.values()) p.wire.tick();
    for (const p of pages.values()) {
      const q = p.inbox.splice(0); p.seen = (p.seen || []).concat(q);
      for (const m of q) {
        if (m.t === 'UNNEEDED') p.seat.onUnneeded(m);
        else if (m.t === 'UPOFFER') p.seat.l14Offer(m);
        else if (m.t === 'BUSY' && m.tag === 14) p.seat.l14Declined(m);
      }
    }
  };
  net.run = (n) => { for (let i = 0; i < n; i++) net.tick(); };
  return net;
}
function seatAt(pg, c) { const s = pg.seat; s.hasCoord = true; s.state = 3; s.coord = c; s.seatedAt = 0; s.occ.set(topo.ckey(c), s.id); }
const S1 = (r, i) => ({ pc: 0, r, i });
const LS = (pg, x) => pg.wire.fns.fabricLinkState(pg.id, x);
const lost = (pg, x) => (pg.seen || []).concat(pg.inbox).filter((m) => m.t === 'TRANSLOST' && m.id === x);

// ---- 1. door join: an outside knocker dials a greeter; the door opens, counts at the greeter, and closes on its limit without a loss
{
  console.log('door join');
  const net = makeNet(); const A = net.page(1), G = net.page(2);
  seatAt(G, S1(0, 0));
  const ask = msg.newMsg('WHOHOME'); ask.id = 1; A.wire.send(2, ask);
  ok(LS(A, 2) === E.LS_DIALING, 'knocker dials the greeter for its ask');
  const d = net.log.find((l) => l[0] === 'dial'); ok(d && d[3].s === 0 && d[3].mt === 'WHOHOME', 'offer mark: outside, first frame WHOHOME');
  net.connect(1, 2); net.tick();
  ok(LS(A, 2) === E.LS_OPEN && LS(G, 1) === E.LS_OPEN, 'door open at both ends');
  ok(G.seen.some((m) => m.t === 'WHOHOME' && m.lk === 1 && m.dsat === false), 'greeter got the ask over the door (lk, dsat stamped)');
  ok(G.wire.fns.fabricMyDoors(2) === 1 && G.wire.fns.fabricMyKnocks(2) === 1, 'greeter counts one door, one knock');
  ok(A.wire.link(2).outside && G.wire.link(1).outside, 'both ends mark the pc a door');
  net.run(K.L16_LIFE + 2);
  ok(LS(G, 1) !== E.LS_OPEN && LS(A, 2) === E.LS_NONE, 'door closed on the greeter limit; the knocker reads NONE');
  ok(A.bye.some((b) => b[0] === 2 && b[1] === 'door'), 'knocker got pcbye{door}');
  ok(lost(A, 2).length === 0, 'no TRANSLOST at the knocker');
  ok(G.wire.fns.fabricMyDoors(2) === 0, 'greeter door count back to 0');
}
// ---- 1b. the joiner drops its door (fabricDoorDrop): pcbye{door}, the greeter reads NONE, no loss
{
  console.log('door drop');
  const net = makeNet(); const A = net.page(1), G = net.page(2);
  seatAt(G, S1(0, 0));
  const ask = msg.newMsg('WHOHOME'); ask.id = 1; A.wire.send(2, ask); net.connect(1, 2); net.tick();
  A.wire.fns.fabricDoorDrop(1, 2); net.tick();
  ok(LS(G, 1) === E.LS_NONE, 'greeter reads NONE after the joiner dropped the door');
  ok(G.bye.some((b) => b[0] === 1 && b[1] === 'door') && lost(G, 1).length === 0, 'pcbye{door}, no TRANSLOST at the greeter');
}
// ---- 2. close handshake (L22): two seated pages with no reason for their pc close it in order; nobody reads a loss
{
  console.log('close handshake');
  const net = makeNet(); const A = net.page(1), B = net.page(2);
  seatAt(A, S1(0, 0)); seatAt(B, S1(3, 3));
  A.wire.fns.fabricDial(1, 2); net.connect(1, 2);
  ok(LS(A, 2) === E.LS_OPEN, 'pc open');
  net.run(K.L22_ASK + K.L22_SETTLE + 20);
  ok(net.log.some((l) => l[0] === 'L22-ASK'), 'an L22 ask went out');
  ok(net.log.some((l) => l[0] === 'L22-CLOSE'), 'one end closed on the handshake');
  ok(LS(A, 2) !== E.LS_OPEN && LS(B, 1) !== E.LS_OPEN, 'pc closed at both ends');
  ok(lost(A, 2).length === 0 && lost(B, 1).length === 0, 'no TRANSLOST either end');
  ok(A.bye.concat(B.bye).some((b) => b[1] === 'unneeded'), 'pcbye{unneeded} carried the close');
}
// ---- 3. keep: a pc my seat names (an owned link) is never asked about
{
  console.log('keep');
  const net = makeNet(); const A = net.page(1), B = net.page(2);
  seatAt(A, S1(0, 0)); seatAt(B, S1(0, 1));
  A.seat.occ.set(topo.ckey(S1(0, 1)), 2); B.seat.occ.set(topo.ckey(S1(0, 0)), 1);
  ok(A.wire.fns.l22Need(1, 2) && B.wire.fns.l22Need(2, 1), 'each end has a reason for the pc');
  A.wire.fns.fabricDial(1, 2); net.connect(1, 2);
  net.run(K.L23_LONG + 10);
  ok(LS(A, 2) === E.LS_OPEN && LS(B, 1) === E.LS_OPEN, 'pc stays open');
  ok(!net.log.some((l) => l[0] === 'L22-ASK' || l[0] === 'L23-CLOSE'), 'no ask, no L23 close');
}
// ---- 4. budget full -> busy: a greeter at its knock budget refuses a second knocker without a pc; the knocker's seat gets BUSY
{
  console.log('budget full -> busy');
  const net = makeNet(); const A = net.page(1), G = net.page(2), C = net.page(3);
  seatAt(G, S1(0, 0));
  const cap = G.wire.laws.pcBudget(2, E.PB_KNOCKS);
  const knockers = [A]; for (let i = 0; i < cap - 1; i++) knockers.push(net.page(10 + i));
  for (const k of knockers) { const m = msg.newMsg('WHOHOME'); m.id = k.id; k.wire.send(2, m); net.connect(k.id, 2); }
  net.tick();
  ok(G.wire.fns.fabricMyKnocks(2) === cap, 'greeter holds ' + cap + ' knocks (its budget)');
  const m = msg.newMsg('WHOHOME'); m.id = 3; C.wire.send(2, m);
  ok(net.log.some((l) => l[0] === 'refuse' && l[1] === 2 && l[2] === 3 && l[3].busy === 1), 'greeter refused the offer with busy (relay, no pc)');
  ok(!net.pcs.has('2,3'), 'no pc between greeter and knocker');
  ok(C.inbox.some((x) => x.t === 'BUSY' && x.id === 2), 'knocker seat gets BUSY{id: greeter}');
  ok(LS(C, 2) === E.LS_NONE, 'knocker reads NONE (no dial failure, no loss)');
}
// ---- 5. uplink decline with referrals: UPOFFER rides the dc; the far page declines with BUSY tag 14 + referrals, then pcbye{declined}
{
  console.log('uplink decline');
  const net = makeNet(); const H = net.page(1), X = net.page(2);
  seatAt(H, { pc: 1, r: 0, i: 0 }); seatAt(X, S1(0, 0));
  X.w.f.fabricUpTake = () => 2;   // X at its budget (the decision itself is pclaws.js's, proven by the harness)
  X.seat.rosterCells = () => [S1(0, 0), S1(0, 1), S1(0, 2), S1(0, 3), S1(0, 4)];
  X.seat.occ.set(topo.ckey(S1(0, 1)), 7); X.seat.occ.set(topo.ckey(S1(0, 2)), 8); X.seat.firstHandLive = () => true;
  ok(H.wire.fns.fabricDialUplink(1, 2, []) === true, 'head dials its uplink');
  ok(H.wire.link(2).uplink && H.wire.link(2).q.some((m) => m.t === 'UPOFFER'), 'UPOFFER queued on the dialling pc');
  net.connect(1, 2); net.run(3);
  ok(X.seen.some((m) => m.t === 'UPOFFER' && m.id === 1), 'far page got UPOFFER over the dc');
  const d = H.seen.find((m) => m.t === 'BUSY' && m.tag === 14);
  ok(d && d.list.join(',') === '7,8', 'head got the decline with referrals [7,8]');
  ok(H.bye.some((b) => b[0] === 2 && b[1] === 'declined'), 'then pcbye{declined}');
  ok(LS(H, 2) === E.LS_NONE && lost(H, 2).length === 0, 'head reads NONE, no TRANSLOST');
  ok(H.seat.l14Refer.includes(7) && H.seat.l14Refer.includes(8) && H.seat.dials.fails(2) >= 1, 'head seat took the referrals and counted the decline');
}
// ---- 6. pcbye vs hard loss
{
  console.log('pcbye vs hard loss');
  const net = makeNet(); const A = net.page(1), B = net.page(2), C = net.page(3);
  seatAt(A, S1(0, 0)); seatAt(B, S1(0, 1)); seatAt(C, S1(0, 2));
  A.seat.occ.set(topo.ckey(S1(0, 1)), 2); A.seat.occ.set(topo.ckey(S1(0, 2)), 3);
  B.seat.occ.set(topo.ckey(S1(0, 0)), 1); C.seat.occ.set(topo.ckey(S1(0, 0)), 1);
  A.wire.fns.fabricDial(1, 2); net.connect(1, 2); A.wire.fns.fabricDial(1, 3); net.connect(1, 3); net.tick();
  net.kill(1, 2); net.tick();
  const tl = lost(B, 1);
  ok(tl.length === 1 && tl[0].hard === true, 'hard loss (dc closed, no goodbye): B gets one TRANSLOST hard');
  ok(LS(B, 1) === E.LS_CLOSED, 'B reads CLOSED');
  net.kill(1, 2); net.tick(); ok(lost(B, 1).length === 1, 'debounced: a second close in the window gives no second TRANSLOST');
  A.wire.leaveAll(); net.tick();
  ok(C.bye.some((b) => b[0] === 1 && b[1] === 'leave') && lost(C, 1).length === 0, 'deliberate leave: pcbye{leave}, C reads no loss');
  ok(LS(C, 1) === E.LS_NONE, 'C reads NONE');
}
// ---- 7. kick: my channel to a voted-off seat closes with pcbye{kick}; the kicked end reads NONE
{
  console.log('kick');
  const net = makeNet(); const A = net.page(1), B = net.page(2);
  seatAt(A, S1(0, 0)); seatAt(B, S1(0, 1)); A.seat.occ.set(topo.ckey(S1(0, 1)), 2); B.seat.occ.set(topo.ckey(S1(0, 0)), 1);
  A.wire.fns.fabricDial(1, 2); net.connect(1, 2); net.tick();
  A.wire.fns.fabricKickClose(1, 2); net.tick();
  ok(B.bye.some((b) => b[1] === 'kick') && LS(B, 1) === E.LS_NONE && lost(B, 1).length === 0, 'kicked end: pcbye{kick}, NONE, no loss');
}
// ---- 8. L23 refusal at the offer: a callee whose suspect strikes stand refuses the dial; the dialler's dial just ends
{
  console.log('L23 refusal');
  const net = makeNet(); const A = net.page(1), B = net.page(2);
  seatAt(A, S1(0, 0)); seatAt(B, S1(3, 3));
  const st = B.wire.laws.S.L23S; st.set(require(path.join(M, 'hash.js')).idPair(2, 1), { until: B.w.TICK + 1000, last: B.w.TICK, n: 3 });
  const m = msg.newMsg('PHONE'); m.id = 1; A.wire.send(2, m);
  ok(net.log.some((l) => l[0] === 'refuse' && l[1] === 2 && l[3].busy === 0), 'B refused (L23), no busy');
  ok(LS(A, 2) === E.LS_NONE && A.seat.dials.fails(2) === 0, 'A reads NONE, no dial failure counted (the sim drops it)');
}
// ---- 9. a dial that never opens fails at LINK_DIAL_FAIL and counts at the dialler
{
  console.log('dial timeout');
  const net = makeNet(); const A = net.page(1); net.page(2);
  seatAt(A, S1(0, 0)); seatAt(net.pages.get(2), S1(3, 3));
  A.wire.fns.fabricDial(1, 2); net.run(K.LINK_DIAL_FAIL + 1);
  ok(LS(A, 2) === E.LS_CLOSED && A.seat.dials.fails(2) === 1, 'A reads CLOSED with one failed dial');
}

// ---- 9b. a far seat my view cannot place (seated by its offer mark, no cell in my view): L18 reads it as unplaced, no throw
{
  console.log('l18Route, far seat with no cell in my view');
  const net = makeNet(); const A = net.page(1), B = net.page(2), C = net.page(3);
  seatAt(A, S1(0, 0)); seatAt(B, S1(0, 1)); seatAt(C, S1(3, 3));
  B.seat.occ.set(topo.ckey(S1(0, 0)), 1); A.seat.occ.set(topo.ckey(S1(0, 1)), 2);
  B.wire.fns.fabricDial(2, 3); net.connect(2, 3); net.tick();   // C learns B is seated from B's offer mark; C's view has no cell for B
  ok(C.wire.link(2) && C.wire.fns.l18Cell(3, 2) === null, 'C holds a pc to B but no cell for it');
  let err = null; try { C.wire.fns.l18Route(3, 2); C.wire.fns.fabricDial(3, 2); const m = msg.newMsg('PHONE'); m.id = 3; C.wire.send(1, m); } catch (e) { err = e; }
  ok(!err, 'l18Route / fabricDial do not throw' + (err ? ' (' + err.message + ')' : ''));
  ok(C.wire.fns.l18Route(3, 2) === false, 'no L18 route to a seat my view cannot place');
}
// ---- 10. page ids reach 2^21: the per-id tables stay sparse (no table sized by an id)
{
  console.log('big ids');
  const net = makeNet(); const A = net.page(2000001), B = net.page(2000002);
  seatAt(A, S1(0, 0)); seatAt(B, S1(3, 3));
  const before = process.memoryUsage().heapUsed;
  A.wire.fns.fabricDial(2000001, 2000002); net.connect(2000001, 2000002);
  net.run(K.L22_ASK + K.L22_SETTLE + 20);
  ok(net.log.some((l) => l[0] === 'L22-CLOSE') && lost(A, 2000002).length === 0 && lost(B, 2000001).length === 0, 'L22 handshake closes with no loss');
  ok(process.memoryUsage().heapUsed - before < 32 * 1024 * 1024, 'heap grew < 32 MB (' + Math.round((process.memoryUsage().heapUsed - before) / 1048576) + ' MB)');
}

console.log((fails ? 'FAIL' : 'PASS') + ' pclaws-wire: ' + passes + ' ok, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
