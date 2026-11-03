'use strict';
/*
 * harness/l18.js: the L18 measurement (`l18 measure on|off`, `l18 report`), a line-for-line port of the sim's
 * mesh_l18.inc. A measurement: it tags frames at their origin (Msg.uxTo / uxId) and counts them at the receiver; no
 * seat reads it. Harness code, never shipped.
 *
 *   require('./l18.js').install(fab);   // plugs l18Lever l18UxOrigin l18UxDeliv l18RoutedNote
 *
 * The fabric calls l18UxOrigin from fabricSend (under fab.lv.L18MEAS) and l18RoutedNote at the L18 route; a seat's
 * recv calls l18UxDeliv. Reads the pc laws (fab.pcl.pc: l18Role), the link state (fab.X.fabricLinkState), friend-hop
 * (fab.X.fhopFriendFor) and the net groups (fab.X.grpReach). The L18DBG stderr prints are not ported.
 */
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const C_ = require(path.join(M, 'consts.js'));
const topo = require(path.join(M, 'topo.js'));

const K = C_.consts, E = C_.enums;
const { ckey } = topo;

function install(fab) {
  const { lv, seats, alive, X } = fab;
  const P = (...a) => fab.printf(...a);
  const L18UX_SENT = new Array(8).fill(0), L18UX_DELIV = new Array(8).fill(0), L18UX_L18 = new Array(8).fill(0);   // class = unreach*4 + friend*2 + mass
  const st = { L18R_REACH: 0, L18R_UNREACH: 0, L18R_MASS: 0 };
  const L18UX_CLS = [];   // uxId -> class+1, high bit once delivered

  // C++: mesh.cpp:l18Role
  const l18Role = (me, x) => { const s = seats[me]; if (!s.hasCoord) return false; return !!s.linkRole(x, E.LR_TOPO); };
  // C++: mesh.cpp:l18DirectFailed
  const l18DirectFailed = (from, to) => from >= 0 && from < lv.nextId && seats[from].dials.pathFailedWithin(to, K.L18_HOLD, seats[from].TICK);
  // C++: mesh_l18.inc:l18Truth
  const l18Truth = (a, b) => X.grpReach(a, b) && !(lv.NUM_SUBNETS > 1 && !fab.reachable(seats[a].subnet, seats[b].subnet));

  // C++: mesh_l18.inc:l18UxOrigin
  function l18UxOrigin(from, to, m) {
    if (!lv.L18MEAS || from < 0 || from >= lv.nextId || !alive[from] || !alive[to]) return;
    const a = seats[from], b = seats[to];
    if (a.state !== 3 || !a.hasCoord || b.state !== 3 || !b.hasCoord || ckey(a.coord) === ckey(b.coord)) return;
    if (!fab.l18Frame(m) || l18Role(from, to) || X.fabricLinkState(from, to) === E.LS_OPEN || !l18DirectFailed(from, to)) return;   // the frames L18 is for (L18.5)
    const cls = (l18Truth(from, to) ? 0 : 4) | (X.fhopFriendFor(from, to) ? 2 : 0) | (a.l13Mass() ? 1 : 0);
    m.uxTo = to; m.uxId = L18UX_CLS.length; L18UX_CLS.push(cls + 1); L18UX_SENT[cls]++;
  }
  // C++: mesh_l18.inc:l18UxDeliv
  function l18UxDeliv(m) {
    if (m.uxId < 0 || m.uxId >= L18UX_CLS.length) return; const c = L18UX_CLS[m.uxId]; if (c & 0x80) return;
    const cls = (c & 0x7f) - 1; L18UX_CLS[m.uxId] = c | 0x80; L18UX_DELIV[cls]++; if (m.l18) L18UX_L18[cls]++;
  }
  // C++: mesh_l18.inc:l18RoutedNote
  function l18RoutedNote(from, to, m) {
    if (!lv.L18MEAS) return;
    if (to < lv.nextId && alive[to] && l18Truth(from, to)) st.L18R_REACH++; else st.L18R_UNREACH++;
    if (seats[from].l13Mass()) st.L18R_MASS++;
  }
  // C++: mesh_l18.inc:l18Lever
  function l18Lever(tk) {
    const sub = tk.length > 1 ? tk[1] : '';
    if (sub === 'measure') { lv.L18MEAS = !(tk.length > 2 && tk[2] === 'off'); P('OK l18 measure %s\n', lv.L18MEAS ? 'on' : 'off'); return; }
    if (sub === 'report') {
      const NM = ['reach', 'reach-mass', 'reach-friend', 'reach-friend-mass', 'unreach', 'unreach-mass', 'unreach-friend', 'unreach-friend-mass'];
      let uS = 0, uD = 0; for (let c = 4; c < 8; c++) { uS += L18UX_SENT[c]; uD += L18UX_DELIV[c]; }
      for (let c = 0; c < 8; c++) if (L18UX_SENT[c]) P('L18UX class=%s sent=%lld delivered=%lld via_l18=%lld\n', NM[c], L18UX_SENT[c], L18UX_DELIV[c], L18UX_L18[c]);
      P('L18REPORT law=%d unreach_sent=%lld unreach_delivered=%lld nofriend_sent=%lld nofriend_delivered=%lld nofriend_via_l18=%lld routed=%lld routed_reach=%lld routed_unreach=%lld routed_mass=%lld\n',
        1, uS, uD, L18UX_SENT[4], L18UX_DELIV[4], L18UX_L18[4], lv.L18_ROUTED, st.L18R_REACH, st.L18R_UNREACH, st.L18R_MASS);
      return;
    }
    P('ERR usage: l18 measure on|off | l18 report\n');
  }

  fab.plug({ l18Lever, l18UxOrigin, l18UxDeliv, l18RoutedNote });
  return { l18Lever, l18UxOrigin, l18UxDeliv, l18RoutedNote, l18Truth };
}

module.exports = { install };
