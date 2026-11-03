'use strict';
// gapa-fab.js: L41 fabric side (C++: mesh_gapa_fab.inc): the `hostile densify asked` switch and the `hostile gapa` report.
// Harness code: never shipped.
function install(fab) {
  const { lv } = fab;
  // C++: mesh_gapa_fab.inc:gaDenseAskOn
  function gaDenseAskOn() { lv.GA_DENSE_ASK = 1; fab.printf('OK hostile densify asked\n'); }
  // C++: mesh_gapa_fab.inc:gaReport
  function gaReport() { fab.printf('GAPA dense=%lld unasked=%lld asks=%lld held=%lld free=%lld rollbacks=%lld confVote=%lld confWin=%lld moves=%lld\n', lv.GA_DENSE_N, lv.GA_B1_REFUSED, lv.GA_ASKS, lv.GA_HELD, lv.GA_FREE, lv.GA_RB, lv.GA_CONF_VOTE, lv.GA_CONF_WIN, lv.COMPACT_MOVES); }
  fab.plug({ gaDenseAskOn, gaReport });
}
module.exports = { install };
