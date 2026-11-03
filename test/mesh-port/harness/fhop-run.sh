#!/bin/bash
# fhop-run.sh <driver binary> <work dir> [cases] [first seed]: run fhop-check.js on an overlay copy of js/mesh and the
# harness that also holds route.js (Seat.nextHopCoord, strictNextHop) and linkset.js (Seat.linkRole, linkPeers) from their
# port branches, which friend-hop's seats call and which this branch does not have until X1 merges them.
# FHOP_IMPL / FHOP_SEAT_IMPL (mutated copies of harness/fhop.js / js/mesh/fhop.js, for the mutation checks) replace them in the overlay.
set -e
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$HERE/../../.." && pwd)
[ -n "$FHOP_IMPL" ] && FHOP_IMPL=$(realpath "$FHOP_IMPL"); [ -n "$FHOP_SEAT_IMPL" ] && FHOP_SEAT_IMPL=$(realpath "$FHOP_SEAT_IMPL")
BIN=$(realpath "${1:?driver}"); WORK=$(realpath -m "${2:?work dir}")
OV="$WORK/overlay"; rm -rf "$OV"; mkdir -p "$OV/js" "$OV/test/mesh-port"
cp -r "$ROOT/js/mesh" "$OV/js/mesh"; cp -r "$HERE" "$OV/test/mesh-port/harness"
for f in digroute:route.js side:linkset.js; do
  [ -f "$OV/js/mesh/${f##*:}" ] || git -C "$ROOT" show "origin/wip/0925-port-${f%%:*}:js/mesh/${f##*:}" > "$OV/js/mesh/${f##*:}"
done
[ -n "$FHOP_IMPL" ] && cp "$FHOP_IMPL" "$OV/test/mesh-port/harness/fhop.js"
[ -n "$FHOP_SEAT_IMPL" ] && cp "$FHOP_SEAT_IMPL" "$OV/js/mesh/fhop.js"
cd "$OV"
node -r ./js/mesh/route.js -r ./js/mesh/linkset.js test/mesh-port/harness/fhop-check.js "$BIN" "$WORK/cases" "${3:-20}" "${4:-1}" 2>&1
