'use strict';
/*
 * pclaws-fab.js: the harness wiring of the pc laws (port plan S11). installPcLaws(fab) installs the link physics, time and
 * net (harness/linknet.js, the one physics), builds the pc world over the fabric (harness/fabric.js) sharing link.js's
 * law tables (DOORN, DOORK, LDOORS, ...), creates the laws (js/mesh/pclaws.js) and plugs them over link.js's own with
 * fab.plug. link.js's startDial calls X.l1611Guard, which is pclaws.js's. Returns { pc, phys, P, ln }; phys is link.js's api.
 */
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const msg = require(path.join(M, 'msg.js'));
const { createPcLaws } = require(path.join(M, 'pclaws.js'));
const linknet = require('./linknet.js');

function installPcLaws(fab) {
  const lv = fab.lv;
  const MT_INDEX = new Map(msg.MT_NAMES.map((n, i) => [n, i]));
  fab.mtI = (t) => MT_INDEX.get(t);
  const ln = linknet.install(fab); require('./gaps-fab.js').install(fab); require('./gaps3-fab.js').install(fab); require('./gaps4-fab.js').install(fab); require('./l25e-fab.js').install(fab); require('./c7proof-fab.js').install(fab); require('./gapa-fab.js').install(fab);
  const phys = ln.link;
  const P = {
    w: fab.w, lv, seats: fab.seats, alive: fab.alive, isFrozen: fab.isFrozen, trace: fab.trace, busPush: fab.busPush,
    schedL10: fab.schedL10, wireTx: fab.wireTx, pairKey: fab.pairKey,
    grpReach: (a, b) => fab.X.grpReach(a, b), l392Contest: (me, from, mt, ck) => fab.X.l392Contest(me, from, mt, ck),
    relayMeter: (id, n) => fab.X.relayMeter(id, n),
    fhopActive: () => fab.X.fhopActive(), get FH() { return fab.FH || []; }, fhopFriendFor: (a, b) => fab.X.fhopFriendFor(a, b),
    phys, S: phys, LINKS: phys.LINKS, LINKPEERS: phys.LINKPEERS, radioOff: phys.radioOff,
  };
  const pc = createPcLaws(P);
  fab.plug(pc.fns);
  fab.plug({ l1611Guard: pc.l1611Guard, fhopFriendFor: () => false });   // l1611Guard: link.js's startDial calls it; fhopFriendFor until installFhop plugs the real one
  fab.plug({ l23Refused: pc.l23Refused });   // the one l23Refused: link.js's dial paths and hostile.js reach it through fab.X
  return { pc, phys, P, ln };
}

module.exports = { installPcLaws };
