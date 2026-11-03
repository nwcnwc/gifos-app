// Smoke for js/mesh/seat-rest.js: load, and call the pure-ish members on hand-built seats.
'use strict';
const path = require('path'); const M = path.join(__dirname, '..', '..', 'js', 'mesh');
const sm = require(path.join(M, 'seat.js')); require(path.join(M, 'shared.js')); require(path.join(M, 'ring.js')); require(path.join(M, 'seat-rest.js')); require(path.join(M, 'tick.js'));   // l3QuietLoss lives in tick.js
const { Seat } = sm; const topo = require(path.join(M, 'topo.js')); const { ckey } = topo;
let bad = 0; const eq = (a, b, n) => { if (a !== b) { bad++; console.log('FAIL ' + n + ': ' + a + ' != ' + b); } };
const w = sm.newWorld({ levers: Object.assign({}, require(path.join(M, 'consts.js')).levers) });
w.TICK = 500;
const s = new Seat(7, w); s.hasCoord = true; s.coord = { pc: 0, r: 1, i: 2 }; s.state = 3;
const ol = topo.ownedLinks(s.coord);
eq(s.ownedLinkCell(ckey(ol[0])), true, 'ownedLinkCell'); eq(s.ownedLinkCell(ckey({ pc: 3, r: 1, i: 1 })), false, 'ownedLinkCell no');
eq(s.isArbCell(ckey(ol[0])), true, 'isArbCell');
s.occ.set(ckey(ol[0]), 9); s.live.set(ckey(ol[0]), 480);
eq(s.beatsMe(ckey(ol[0])), true, 'beatsMe'); eq(s.ppAdmitter({ pc: 0, r: 1, i: 0 }), -1, 'ppAdmitter');
eq(s.probeNote(5), 1, 'probeNote'); eq(s.probeNote(5), 1, 'probeNote keeps'); eq(s.probeAsked(5, 1), true, 'probeAsked'); eq(s.probeAsked(5, 2), false, 'probeAsked wrong');
eq(s.knowsRing(0), true, 'knowsRing'); eq(s.liveElsewhere(9, 123), true, 'liveElsewhere'); eq(s.l3QuietLoss(5), false, 'l3QuietLoss');
eq(s.l13Merging(), false, 'l13Merging');
s.u2Id = 11; eq(s.l2Peer(11), true, 'l2Peer'); eq(s.l2Peer(12), false, 'l2Peer no'); eq(s.headGone(), false, 'headGone root');
eq(s.l2OwnerHold(ckey(ol[0])), false, 'l2OwnerHold');
const h = new Seat(8, w); h.hostile = 1; const m = require(path.join(M, 'msg.js')).newMsg('UNNEEDED'); eq(h.hostileRecv(m), true, 'hostileRecv');
console.log(bad ? 'rest-smoke: FAIL ' + bad : 'rest-smoke: ok');
process.exit(bad ? 1 : 0);
