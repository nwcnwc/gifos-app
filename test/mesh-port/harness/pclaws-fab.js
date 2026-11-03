'use strict';
/*
 * pclaws-fab.js: the harness wiring of the pc laws (port plan S11). installPcLaws(fab) builds the pc world over a fabric
 * (harness/fabric.js), creates the laws (js/mesh/pclaws.js) and plugs them in with fab.plug:
 *   the seat's calls   fabricDial fabricDialJoin fabricDialUplink fabricDialFails fabricUpTake fabricUpDecline fabricDoors
 *                      fabricLinkState fabricDoorDrop fabricDoorHanded fabricMyDoors fabricMyKnocks fabricNoSock fabricL23Busy
 *                      fabricCallFrame l22Need l22Quiet l222Note l22Agree l22Close l22CloseAsk l28Reply l18Hop l18Deliv
 *   the fabric's calls l18Route l18Cell, and (from the stand-in physics, pclaws-phys.js, until H2) linkTick linkSchedule
 *                      linkOpenFor linkFind closeFrom linkBlackhole linkOnLeave crashTransport linkReset closedDrop
 * Two stand-ins the fabric would otherwise refuse: grpReach (no net groups: everything reaches) and fhopFriendFor (no
 * friend-hop: no friend carries it). Both are the C++ answers with their feature off.
 * Returns { pc, phys }.
 */
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const msg = require(path.join(M, 'msg.js'));
const { createPcLaws } = require(path.join(M, 'pclaws.js'));
const { createPhys } = require('./pclaws-phys.js');

function installPcLaws(fab, opts) {
  opts = opts || {};
  const lv = fab.lv;
  const MT_INDEX = new Map(msg.MT_NAMES.map((n, i) => [n, i]));
  fab.mtI = (t) => MT_INDEX.get(t);
  const P = {
    w: fab.w, lv, seats: fab.seats, alive: fab.alive, isFrozen: fab.isFrozen, trace: fab.trace, busPush: fab.busPush,
    schedL10: fab.schedL10, wireTx: fab.wireTx, pairKey: fab.pairKey,
    grpReach: (a, b) => fab.X.grpReach(a, b),
    relayMeter: () => { throw new Error('pclaws: relayMeter (net groups) is not wired'); },
    fhopActive: () => fab.X.fhopActive(), FH: fab.FH || [], fhopFriendFor: (a, b) => fab.X.fhopFriendFor(a, b),
    phys: null, LINKS: null, LINKPEERS: null, radioOff: null,
  };
  const pc = createPcLaws(P);
  const phys = createPhys(fab, pc);
  P.phys = phys; P.LINKS = phys.LINKS; P.LINKPEERS = phys.LINKPEERS; P.radioOff = phys.radioOff;
  fab.plug(pc.fns);
  fab.plug({
    linkTick: phys.linkTick, linkSchedule: phys.linkSchedule, linkOpenFor: phys.linkOpenFor, linkFind: phys.linkFind, closeFrom: phys.closeFrom,
    linkBlackhole: phys.linkBlackhole, linkOnLeave: phys.linkOnLeave, crashTransport: phys.crashTransport, linkReset: phys.linkReset, closedDrop: phys.closedDrop,
    grpReach: (a, b) => { if (lv.NETGRP) throw new Error('pclaws: net groups are not wired'); return true; },
    fhopFriendFor: () => false,
  });
  return { pc, phys, P };
}

module.exports = { installPcLaws };
