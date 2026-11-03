'use strict';
/*
 * ring_fab.js: L8.38 the ring signal, fabric side (port plan H3): the `lineage` report, a measurement no seat
 * reads. A line-for-line port of the sim's mesh_ring_fab.inc. Harness code, never shipped.
 *   lineage      LINEAGE tick seated lines none merge <founder:count>...  (merge: seated seats whose mergeSeen() holds now)
 */
function install(fab) {
  const lv = fab.lv, seats = fab.seats, alive = fab.alive, w = fab.w;
  // C++: mesh_ring_fab.inc:lineageReport
  function lineageReport() {
    const h = new Map(); let seated = 0, merge = 0, none = 0;
    for (let q = 0; q < lv.nextId; q++) {
      if (!alive[q]) continue; const s = seats[q]; if (!(s.hasCoord && s.state === 3)) continue;
      seated++; if (s.line < 0) none++; else h.set(s.line, (h.get(s.line) || 0) + 1); if (s.mergeSeen()) merge++;
    }
    fab.printf('LINEAGE tick=%lld seated=%d lines=%zu none=%d merge=%d', w.TICK, seated, h.size, none, merge);
    for (const k of [...h.keys()].sort((a, b) => a - b)) fab.printf(' %d:%d', k, h.get(k));   // a std::map: by founder id
    fab.printf('\n');
  }
  fab.plug({ lineageReport });
  return { lineageReport };
}
module.exports = { install };
