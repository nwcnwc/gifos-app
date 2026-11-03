'use strict';
// gaps-fab.js: the L37.4 resend of a FIND lost to a close (C++: mesh_gaps_fab.inc), plugged into a fabric whose link
// physics (link.js) is installed. Harness code: never shipped.
const path = require('path');
const M = path.join(__dirname, '..', '..', '..', 'js', 'mesh');
const msg = require(path.join(M, 'msg.js'));
const hash = require(path.join(M, 'hash.js'));
const E = require(path.join(M, 'consts.js')).enums;
const L374_W = 5, LINK_QCAP = 64;
function install(fab) {
  const { lv, alive } = fab; const T = () => fab.w.TICK; const L = fab.link; const idPair = hash.idPair;
  const L374F = new Map();
  const lEnd = (me, x) => (me < x ? 0 : 1);
  // C++: mesh_gaps_fab.inc:l374Note
  function l374Note(from, to, m) {
    if (m.t !== 'FIND') return;
    if (L374F.size > 4096) { for (const [k, v] of L374F) if (v.length === 0 || T() - v[v.length - 1][0] > L374_W) L374F.delete(k); }
    let v = L374F.get(idPair(from, to)); if (!v) { v = []; L374F.set(idPair(from, to), v); }
    while (v.length && T() - v[0][0] > L374_W) v.shift();
    if (v.length < 8) v.push([T(), msg.clone(m)]);
  }
  // C++: mesh_gaps_fab.inc:l374Resend
  function l374Resend(e, x, Lk) {
    if (e < 0 || x < 0 || e >= lv.nextId || x >= lv.nextId || !alive[e] || !alive[x]) return;
    const it = L374F.get(idPair(e, x)); if (it === undefined) return;
    const q = []; for (const p of it) if (T() - p[0] <= L374_W) q.push(p[1]); L374F.delete(idPair(e, x));
    if (q.length === 0) return;
    fab.trace('L37.4-RESEND', e, null, 'peer=%d n=%zu state=%d', x, q.length, Lk.state);
    for (const f of q) {
      const g = msg.clone(f); g.from = e; g.to = x;
      if (Lk.state === E.LK_OPEN) { if (Lk.agreed[lEnd(e, x)]) { if (Lk.hold[lEnd(e, x)].length < LINK_QCAP) Lk.hold[lEnd(e, x)].push(g); } else if (!(Lk.half & (1 << lEnd(e, x)))) L.linkDeliver(e, x, g, Lk); continue; }
      if (Lk.state !== E.LK_DIALING) { Lk.callClosed = false; L.startDial(e, x, Lk); Lk.dialT = fab.mtI(g.t); Lk.dialHow = 3; }
      if (Lk.q.length < LINK_QCAP) Lk.q.push(g);
    }
  }
  fab.plug({ l374Note, l374Resend });
}
module.exports = { install };
