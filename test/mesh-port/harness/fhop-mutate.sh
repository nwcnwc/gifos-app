#!/bin/bash
# fhop-mutate.sh <driver binary> <work dir> [cases]: plant faults one at a time in copies of harness/fhop.js and
# js/mesh/fhop.js, run the differential check on each, and require it to go RED. A fault that stays green is a hole.
set -u
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$HERE/../../.." && pwd)
BIN=${1:?driver}; WORK=${2:?work dir}; N=${3:-60}; mkdir -p "$WORK/mut"; fail=0
mut() {  # name file from to
  local name=$1 file=$2 from=$3 to=$4 src out
  if [ "$file" = harness ]; then src="$HERE/fhop.js"; else src="$ROOT/js/mesh/fhop.js"; fi
  python3 - "$src" "$WORK/mut/$name.js" "$from" "$to" <<'PY' || { echo "$name: pattern not found"; fail=1; return; }
import sys
s=open(sys.argv[1]).read(); a,b=sys.argv[3],sys.argv[4]
assert s.count(a)==1, "pattern count %d: %s"%(s.count(a),a)
open(sys.argv[2],'w').write(s.replace(a,b))
PY
  if [ "$file" = harness ]; then out=$(FHOP_IMPL="$WORK/mut/$name.js" "$HERE/fhop-run.sh" "$BIN" "$WORK/mw" "$N" 1 2>&1); else out=$(FHOP_SEAT_IMPL="$WORK/mut/$name.js" "$HERE/fhop-run.sh" "$BIN" "$WORK/mw" "$N" 1 2>&1); fi
  if echo "$out" | grep -q "fhop check FAIL"; then echo "RED   $name ($(echo "$out" | grep -m1 -o 'DIFF op [0-9]* ([a-z]*'))"; else echo "GREEN $name  <-- hole"; fail=1; fi
}
mut swallow-lane harness "it !== undefined && it === TICK()" "it !== undefined && it !== TICK()"
mut disc-boundary harness "TICK() - L.halfAt >= P('FH_DISC')" "TICK() - L.halfAt > P('FH_DISC')"
mut ttl-edge harness "if (ttl < 0) { FHS[13]++; return; }" "if (ttl < 1) { FHS[13]++; return; }"
mut unlink-grace harness "TICK() - u > P('FH_UNLINK')" "TICK() - u > P('FH_UNLINK') - 4"
mut sponsor-claims harness "for (const r of mc) if (r !== to && fhClaims(me, r, to)) { if (fhDc(me, r))" "for (const r of mc) if (r !== to) { if (fhDc(me, r))"
mut fhtc-plus-one harness "env.fhTc = ckey(m.rdst) + 1;" "env.fhTc = ckey(m.rdst);"
mut nat-meet seat "if (a === GT_SYM && b === GT_SYM) return false;" "if (a === GT_SYM || b === GT_SYM) return false;"
mut free-cells seat "if (r < 0 || t.coord.r === r) free--;" "if (r < 0 || t.coord.r !== r) free--;"
exit $fail
